'use strict';

const http = require('http');
const WebSocket = require('ws');
const server = require('../bridge/index');
const { buildMusicConfig } = require('../music/agent');
const mapping = require('../music/mapping.json');
const PORT = 8114;
const BASE = `http://127.0.0.1:${PORT}`;

function getMusic() {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}/api/music`, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}
function waitMessage(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message timeout')), 1500);
    ws.on('message', function listener(data) {
      const message = JSON.parse(data.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      ws.off('message', listener);
      resolve(message);
    });
  });
}

describe('GET /api/music', () => {
  let agent;
  beforeAll(done => { server.listen(PORT, done); });
  afterAll(done => { if (agent) agent.terminate(); server.close(done); });

  test('reports no map, keeps a valid score, exposes live note and ignores malformed score', async () => {
    const initial = await getMusic();
    expect(initial.score).toBeNull();
    expect(initial.groups).toEqual([]);
    expect(initial.status.symptom).toBe('sin-mapeo');

    agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    await waitMessage(agent, m => m.type === 'music-config');
    const score = buildMusicConfig(mapping);
    agent.send(JSON.stringify({ type: 'music-config', groups: score.groups.map(g => ({ group: g.group, mode: g.aggregation })), derivation: score.derivation, score }));
    await waitMessage(agent, m => m.type === 'music-config-applied');
    let state = await getMusic();
    expect(state.score).toMatchObject({ version: 2, groups: score.groups });
    expect(state.groups).toHaveLength(3);
    expect(state.groups.map(g => [g.channel, g.ccController, g.value])).toEqual([
      [1, 21, 64], [2, 21, 64], [3, 21, 64],
    ]);

    agent.send(JSON.stringify({ type: 'music-output', output: 'note', group: 2, gesture: 'flick', note: 37, channel: 2, velocity: 74, at: new Date().toISOString() }));
    state = await getMusic();
    expect(state.groups[1].lastNote).toMatchObject({ gesture: 'flick', note: 37, channel: 2, velocity: 74 });
    expect(state.status.lastNoteAt).toBe(state.groups[1].lastNote.at);

    expect(() => agent.send(JSON.stringify({ type: 'music-config', groups: [{ group: 1 }] }))).not.toThrow();
    await waitMessage(agent, m => m.type === 'music-config-applied');
    expect(() => agent.send(JSON.stringify({ type: 'music-config' }))).not.toThrow();
    await waitMessage(agent, m => m.type === 'music-config-applied');
    state = await getMusic();
    expect(state.score).toMatchObject({ version: 2, groups: score.groups });
  });
});
