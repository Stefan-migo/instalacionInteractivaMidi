'use strict';

const { validateMusicScore } = require('./message-relay');

function createMusicState() {
  let score = null;
  let port = 'absent';
  const values = new Map();
  const notes = new Map();
  let lastNoteAt = null;

  function acceptConfig(message) {
    if (!message || !validateMusicScore(message.score)) return false;
    score = {
      version: message.score.version,
      safeValue: message.score.safeValue,
      derivation: message.score.derivation,
      groups: message.score.groups.map(group => ({ ...group, notes: { ...group.notes }, curve: { ...group.curve } })),
    };
    return true;
  }

  function recordOutput(message) {
    if (!message) return;
    if (message.output === 'port') { port = message.status === 'open' ? 'open' : 'closed'; return; }
    if (!score || !Number.isInteger(message.group)) return;
    if (message.output === 'cc' && Number.isInteger(message.value)) values.set(message.group, message.value);
    if (message.output === 'note' && typeof message.gesture === 'string' && Number.isInteger(message.note)) {
      const note = { gesture: message.gesture, note: message.note, channel: message.channel, velocity: message.velocity, at: message.at || new Date().toISOString() };
      notes.set(`${message.group}:${message.gesture}`, note);
      lastNoteAt = note.at;
    }
  }

  function snapshot({ agent = false, phones = 0, now = Date.now() } = {}) {
    const groups = score ? score.groups.map(config => ({
      group: config.group,
      channel: config.channel,
      ccController: config.ccController,
      aggregation: config.aggregation,
      value: values.has(config.group) ? values.get(config.group) : score.safeValue,
      lastNote: ['tilt', 'flick', 'rotation'].map(gesture => notes.get(`${config.group}:${gesture}`)).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at))[0] || null,
    })) : [];
    let symptom = null;
    if (!score) symptom = 'sin-mapeo';
    else if (!agent) symptom = 'sin-agente';
    else if (port !== 'open') symptom = 'sin-puerto';
    else if (!lastNoteAt || now - Date.parse(lastNoteAt) > 15000) symptom = 'sin-actividad';
    return { score, groups, status: { port, agent, phones, lastNoteAt, symptom } };
  }

  return { acceptConfig, recordOutput, snapshot };
}

module.exports = { createMusicState };
