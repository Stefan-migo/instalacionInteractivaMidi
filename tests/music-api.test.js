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
function postEmit(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request(`${BASE}/api/music/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(raw); } catch (error) { parsed = {}; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    request.on('error', reject);
    request.write(data);
    request.end();
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
    expect(state.groups).toHaveLength(10);
    expect(state.groups.map(g => [g.channel, g.ccController, g.value])).toEqual(
      Array.from({ length: 10 }, (_, index) => [index + 1, 21, 64]),
    );

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

  test('POST /api/music/emit validates, refuses without an agent and forwards one voice', async () => {
    const malformed = await postEmit({ output: 'note', channel: 1, note: 999 });
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ ok: false, reason: 'invalido' });

    if (agent) { agent.terminate(); agent = null; }
    for (let wait = 0; wait < 40 && (await getMusic()).status.agent; wait += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const withoutAgent = await postEmit({ output: 'note', channel: 1, note: 36, velocity: 100 });
    expect(withoutAgent.status).toBe(409);
    expect(withoutAgent.body.reason).toBe('sin-agente');

    const score = buildMusicConfig(mapping);
    agent = await connect();
    agent.send(JSON.stringify({ type: 'register', role: 'agent' }));
    await waitMessage(agent, (m) => m.type === 'music-config' || m.event === 'agent-ready');
    agent.send(JSON.stringify({ type: 'music-config', portStatus: 'open', groups: score.groups.map((group) => ({ group: group.group, mode: group.aggregation })), derivation: score.derivation, score }));
    let ready = null;
    for (let wait = 0; wait < 40; wait += 1) {
      ready = await getMusic();
      if (ready.status.port === 'open') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(ready.status.port).toBe('open');

    const forwardedMessage = waitMessage(agent, (m) => m.type === 'music-test');
    const forwarded = await postEmit({ output: 'note', channel: 4, note: 37, velocity: 100 });
    expect(forwarded.status).toBe(200);
    expect(forwarded.body).toEqual({ ok: true });
    expect(await forwardedMessage).toEqual({
      type: 'music-test', output: 'note', channel: 4, note: 37, velocity: 100,
    });
  });

  test('exposes the last sensor frames so a wrong gesture can be read, not guessed', async () => {
    const body = await new Promise((resolve, reject) => {
      http.get(`${BASE}/api/music/debug`, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve(JSON.parse(raw)));
      }).on('error', reject);
    });

    expect(body.frames).toBe(900);
    expect(body.slots).toEqual(expect.any(Object));
  });
});
