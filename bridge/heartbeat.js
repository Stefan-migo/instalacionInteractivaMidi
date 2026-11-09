'use strict';

// WebSocket liveness (see odd/tasks/ableton-music.md, T7).
//
// Cloud proxies cut idle sockets, and a phone that walks out of range leaves a
// half-open socket that never fires "close". Without a ping/pong sweep the
// bridge accumulates corpses and their slots stay occupied.
//
// The sweep is deliberately small and pure: give it anything that looks like a
// socket and it decides who to ping and who to drop. That keeps the decision
// testable without a network.

const DEFAULT_INTERVAL_MS = 30000;

function isOpen(client) {
  return client && (client.readyState === undefined || client.readyState === 1);
}

// A client answered the previous ping if isAlive came back true. Anything else
// is either being pinged now, or has been silent for a whole interval.
function sweepClients(clients) {
  let pinged = 0;
  let terminated = 0;
  if (!clients) return { pinged, terminated };

  for (const client of clients) {
    if (!client) continue;
    if (!isOpen(client)) continue;

    if (client.isAlive === false) {
      terminated += 1;
      try {
        client.terminate();
      } catch (error) {
        // Already gone: nothing to report, nothing to leak.
      }
      continue;
    }

    client.isAlive = false;
    try {
      client.ping();
      pinged += 1;
    } catch (error) {
      // A socket that cannot be pinged will fail the next sweep and be dropped.
    }
  }

  return { pinged, terminated };
}

function startHeartbeat(options = {}) {
  const clients = options.clients;
  const intervalMs = Number.isFinite(options.intervalMs) && options.intervalMs > 0
    ? options.intervalMs
    : DEFAULT_INTERVAL_MS;
  const setTimer = options.setTimer || ((fn, ms) => setInterval(fn, ms));
  const clearTimer = options.clearTimer || ((handle) => clearInterval(handle));

  const timer = setTimer(() => sweepClients(clients), intervalMs);
  // A liveness sweep must never be the reason the process (or a test) stays alive.
  if (timer && typeof timer.unref === 'function') timer.unref();

  return {
    intervalMs,
    stop() {
      clearTimer(timer);
    },
  };
}

module.exports = { sweepClients, startHeartbeat, DEFAULT_INTERVAL_MS };
