'use strict';

// Local music agent (see odd/tasks/ableton-music.md, T4).
//
// Runs on the show machine, next to Ableton. It registers with the bridge as an
// `agent`, receives one aggregated value per group, and writes MIDI through
// loopMIDI. It must survive a flaky network: reconnect with backoff, and never
// leave a parameter frozen wherever the crowd left it when the link dies.
//
// Everything is injectable (socket, MIDI output, scheduler, clock) so the whole
// behaviour is testable without a network, a port or a timer.

const DEFAULT_GROUP_MODES = ['average', 'average', 'average'];
const DEFAULT_BRIDGE_URL = 'ws://localhost:8080';
const DEFAULT_CC_CONTROLLER = 21;
// Musically neutral: a lost link parks the parameters in the middle, which is
// neither silence nor the last position the crowd happened to hold.
const DEFAULT_SAFE_VALUE = 64;
// One note per gesture per group: the nine voices of the score (S3).
const DEFAULT_GESTURE_NOTES = { tilt: 36, flick: 37, rotation: 38 };
const DEFAULT_NOTE_DURATION_MS = 120;

function backoffDelay(attempt, options = {}) {
  const baseMs = Number.isFinite(options.baseMs) ? options.baseMs : 500;
  const maxMs = Number.isFinite(options.maxMs) ? options.maxMs : 8000;
  const exponent = Math.max(0, attempt - 1);
  const delay = baseMs * Math.pow(2, exponent);
  return Math.min(maxMs, delay);
}

function to7Bit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 127) return 127;
  return rounded;
}

function createMusicAgent(options = {}) {
  const WebSocketImpl = options.WebSocketImpl || require('ws');
  const midiOut = options.midiOut;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const scheduler = options.scheduler || {
    setTimeout: (fn, delay) => setTimeout(fn, delay),
    clearTimeout: (handle) => clearTimeout(handle),
  };
  const bridgeUrl = options.bridgeUrl || DEFAULT_BRIDGE_URL;
  const ccController = Number.isInteger(options.ccController) ? options.ccController : DEFAULT_CC_CONTROLLER;
  const safeValue = Number.isInteger(options.safeValue) ? options.safeValue : DEFAULT_SAFE_VALUE;
  const notes = {
    ...DEFAULT_GESTURE_NOTES,
    ...(options.notes && typeof options.notes === 'object' ? options.notes : {}),
  };
  const noteDurationMs = Number.isFinite(options.noteDurationMs) ? options.noteDurationMs : DEFAULT_NOTE_DURATION_MS;
  const modes = Array.isArray(options.modes) && options.modes.length > 0
    ? options.modes.slice()
    : DEFAULT_GROUP_MODES.slice();
  const backoff = {
    baseMs: options.backoff && Number.isFinite(options.backoff.baseMs) ? options.backoff.baseMs : 500,
    maxMs: options.backoff && Number.isFinite(options.backoff.maxMs) ? options.backoff.maxMs : 8000,
  };

  const groupCount = modes.length;
  const lastSent = new Map();
  let socket = null;
  let reconnectTimer = null;
  let attempt = 0;
  let reconnectCount = 0;
  let stopped = false;
  const pendingNoteOffs = new Set();

  function sendValue(group, value) {
    if (!Number.isInteger(group) || group < 1 || group > groupCount) return false;
    const value7 = to7Bit(value);
    if (value7 === null) return false;
    if (lastSent.get(group) === value7) return false;
    lastSent.set(group, value7);
    if (midiOut && typeof midiOut.sendCC === 'function') {
      midiOut.sendCC(group, ccController, value7);
    }
    return true;
  }

  // On a lost link every group goes to the safe value, unconditionally: the
  // point is to leave a known position, not to save three messages.
  function parkAllGroups() {
    for (let group = 1; group <= groupCount; group += 1) {
      lastSent.set(group, safeValue);
      if (midiOut && typeof midiOut.sendCC === 'function') {
        midiOut.sendCC(group, ccController, safeValue);
      }
    }
  }

  function sendToBridge(message) {
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      log(`[agent] send failed: ${error.message}`);
      return false;
    }
  }

  function handleMusicState(message) {
    if (!Array.isArray(message.groups)) return;
    for (const entry of message.groups) {
      if (!entry || typeof entry !== 'object') continue;
      const value = to7Bit(entry.value);
      sendValue(entry.group, value === null ? safeValue : value);
    }
  }

  // A gesture is a note on the group's channel, held just long enough to be
  // heard and then released, so an instrument never keeps a stuck note.
  function playNote(group, gesture, velocity) {
    const note = notes[gesture];
    if (!Number.isInteger(note)) return false;
    if (!Number.isInteger(group) || group < 1) return false;
    if (!midiOut || typeof midiOut.sendNoteOn !== 'function') return false;

    midiOut.sendNoteOn(group, note, velocity);
    const entry = { handle: null, group, note };
    entry.handle = scheduler.setTimeout(() => {
      pendingNoteOffs.delete(entry);
      if (midiOut && typeof midiOut.sendNoteOff === 'function') midiOut.sendNoteOff(group, note);
    }, noteDurationMs);
    pendingNoteOffs.add(entry);
    return true;
  }

  function handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'music-config') {
      // The bridge reports what it is applying; the agent answers with what it
      // wants, which is the point of keeping the musical score local.
      sendToBridge({
        type: 'music-config',
        groups: modes.map((mode, index) => ({ group: index + 1, mode })),
      });
      return;
    }
    if (message.type === 'music-state') {
      handleMusicState(message);
      return;
    }
    if (message.type === 'music-gesture' && Array.isArray(message.voices)) {
      for (const voice of message.voices) {
        if (!voice || typeof voice !== 'object') continue;
        const velocity = to7Bit(voice.velocity);
        playNote(voice.group, voice.gesture, velocity === null ? 100 : velocity);
      }
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    attempt += 1;
    reconnectCount += 1;
    const delay = backoffDelay(attempt, backoff);
    log(`[agent] bridge lost, reconnect #${attempt} in ${delay}ms`);
    reconnectTimer = scheduler.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (stopped) return;
    let next;
    try {
      next = new WebSocketImpl(bridgeUrl);
    } catch (error) {
      log(`[agent] cannot create socket: ${error.message}`);
      scheduleReconnect();
      return;
    }
    socket = next;

    next.on('open', () => {
      attempt = 0;
      log(`[agent] connected to ${bridgeUrl}`);
      sendToBridge({ type: 'register', role: 'agent' });
    });

    next.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (error) {
        return;
      }
      try {
        handleMessage(message);
      } catch (error) {
        log(`[agent] message handling failed: ${error.message}`);
      }
    });

    next.on('error', (error) => {
      log(`[agent] socket error: ${error && error.message ? error.message : 'unknown'}`);
      if (socket === next) socket = null;
      parkAllGroups();
      scheduleReconnect();
    });

    next.on('close', () => {
      if (socket !== next) return;
      socket = null;
      if (stopped) return;
      parkAllGroups();
      scheduleReconnect();
    });
  }

  function start() {
    if (socket) return;
    stopped = false;
    connect();
  }

  function stop() {
    stopped = true;
    if (reconnectTimer) {
      scheduler.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Release anything still ringing: stopping must not leave a stuck note.
    for (const entry of pendingNoteOffs) {
      scheduler.clearTimeout(entry.handle);
      if (midiOut && typeof midiOut.sendNoteOff === 'function') midiOut.sendNoteOff(entry.group, entry.note);
    }
    pendingNoteOffs.clear();
    const closing = socket;
    socket = null;
    if (closing) {
      try {
        closing.close();
      } catch (error) {
        log(`[agent] close failed: ${error.message}`);
      }
    }
  }

  return {
    start,
    stop,
    get reconnects() {
      return reconnectCount;
    },
    get attempt() {
      return attempt;
    },
    isMidiAvailable() {
      return Boolean(midiOut && typeof midiOut.isAvailable === 'function' && midiOut.isAvailable());
    },
  };
}

// Running this file directly is the show-machine entry point.
if (require.main === module) {
  const { createMidiOut, DEFAULT_PORT_NAME } = require('../bridge/midi-out');
  const portName = process.env.MIDI_PORT || DEFAULT_PORT_NAME;
  const bridgeUrl = process.env.BRIDGE_URL || DEFAULT_BRIDGE_URL;

  const midiOut = createMidiOut({ portName, log: (line) => console.log(line) });
  const agent = createMusicAgent({ midiOut, bridgeUrl, log: (line) => console.log(line) });

  if (!agent.isMidiAvailable()) {
    console.warn(`[agent] MIDI output "${portName}" unavailable: the installation keeps running in visual-only mode.`);
  }
  agent.start();

  const shutdown = () => {
    console.log('[agent] shutting down');
    agent.stop();
    if (typeof midiOut.close === 'function') midiOut.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createMusicAgent, backoffDelay };
