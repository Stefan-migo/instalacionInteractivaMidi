'use strict';

// MIDI output adapter for the local agent.
//
// Contract (see odd/tasks/ableton-music.md, S3-S5):
//   - the virtual port is named `Collage-MIDI`; the Ableton Set binds its MIDI
//     map to that port, so the name is data, not a preference;
//   - @julusian/midi is an OPTIONAL dependency: if it cannot be loaded, or the
//     port is missing, this adapter reports it and every send is a no-op. The
//     visual installation keeps running. It never throws into the caller.
//
// Channels are 1..16 as Ableton displays them, not 0..15 as the wire encodes them.

const DEFAULT_PORT_NAME = 'Collage-MIDI';

const STATUS_CONTROL_CHANGE = 0xb0;
const STATUS_NOTE_OFF = 0x80;
const STATUS_NOTE_ON = 0x90;

function loadMidiModule() {
  try {
    return require('@julusian/midi');
  } catch (error) {
    return null;
  }
}

function to7Bit(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 127) return 127;
  return rounded;
}

function isValidChannel(channel) {
  return Number.isInteger(channel) && channel >= 1 && channel <= 16;
}

function statusByte(base, channel) {
  return base | (channel - 1);
}

function listPortNames(output) {
  const names = [];
  try {
    const count = output.getPortCount();
    for (let index = 0; index < count; index += 1) {
      names.push(output.getPortName(index));
    }
  } catch (error) {
    return [];
  }
  return names;
}

function createMidiOut(options = {}) {
  const portName = options.portName || DEFAULT_PORT_NAME;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const hasInjectedModule = Object.prototype.hasOwnProperty.call(options, 'midiModule');
  const midiModule = hasInjectedModule ? options.midiModule : loadMidiModule();

  const state = {
    output: null,
    reason: null,
    closed: false,
    sendFailureLogged: false,
  };

  function degrade(reason, message) {
    state.reason = reason;
    log(message);
  }

  if (!midiModule || typeof midiModule.Output !== 'function') {
    degrade('no-module', `[midi-out] @julusian/midi not available: visual-only mode (port "${portName}" stays closed)`);
    return api();
  }

  let output;
  try {
    output = new midiModule.Output();
  } catch (error) {
    degrade('no-module', `[midi-out] cannot create a MIDI output (${error.message}): visual-only mode`);
    return api();
  }

  const names = listPortNames(output);
  const index = names.indexOf(portName);

  if (index === -1) {
    degrade(
      'no-port',
      `[midi-out] port "${portName}" not found: visual-only mode. Available outputs: ${
        names.length > 0 ? names.map((name) => `"${name}"`).join(', ') : '(none)'
      }`
    );
    return api();
  }

  try {
    output.openPort(index);
    state.output = output;
    log(`[midi-out] sending on "${portName}" (output index ${index})`);
  } catch (error) {
    degrade('no-port', `[midi-out] cannot open "${portName}" (${error.message}): visual-only mode`);
    return api();
  }

  function send(message) {
    if (!state.output) {
      return false;
    }
    try {
      state.output.sendMessage(message);
      return true;
    } catch (error) {
      if (!state.sendFailureLogged) {
        state.sendFailureLogged = true;
        log(`[midi-out] send failed (${error.message}); further failures are not logged`);
      }
      return false;
    }
  }

  function api() {
    return {
      portName,
      get reason() {
        return state.reason;
      },
      isAvailable() {
        return state.output !== null;
      },
      sendCC(channel, controller, value) {
        if (!isValidChannel(channel)) return false;
        const controller7 = to7Bit(controller);
        const value7 = to7Bit(value);
        if (controller7 === null || value7 === null) return false;
        return send([statusByte(STATUS_CONTROL_CHANGE, channel), controller7, value7]);
      },
      sendNoteOn(channel, note, velocity = 100) {
        if (!isValidChannel(channel)) return false;
        const note7 = to7Bit(note);
        const velocity7 = to7Bit(velocity);
        if (note7 === null || velocity7 === null) return false;
        return send([statusByte(STATUS_NOTE_ON, channel), note7, velocity7]);
      },
      sendNoteOff(channel, note, velocity = 0) {
        if (!isValidChannel(channel)) return false;
        const note7 = to7Bit(note);
        const velocity7 = to7Bit(velocity);
        if (note7 === null || velocity7 === null) return false;
        return send([statusByte(STATUS_NOTE_OFF, channel), note7, velocity7]);
      },
      close() {
        if (!state.output || state.closed) return;
        state.closed = true;
        const closing = state.output;
        state.output = null;
        try {
          closing.closePort();
        } catch (error) {
          log(`[midi-out] close failed (${error.message})`);
        }
      },
    };
  }

  return api();
}

module.exports = { createMidiOut, DEFAULT_PORT_NAME };
