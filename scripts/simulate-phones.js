/**
 * Simulate 30 phones connecting to the bridge.
 * Each connection registers as a phone, gets a slot,
 * and sends random sensor data to animate the collage.
 *
 * Usage:
 *   node scripts/simulate-phones.js
 *   node scripts/simulate-phones.js --port 8080 --count 30
 */

const WebSocket = require('ws');
const { VALID_ACTIONS } = require('../bridge/message-relay');

const args = process.argv.slice(2);
const PORT = parseInt(args[args.indexOf('--port') + 1], 10) || 8080;
const COUNT = parseInt(args[args.indexOf('--count') + 1], 10) || 30;

const URL = `ws://localhost:${PORT}`;

// ── Sensor simulation helpers ────────────────────────────────────────

const rand = (min, max) => Math.random() * (max - min) + min;

function randomSensorData() {
  return {
    accel: {
      x: rand(-12, 12),
      y: rand(-12, 12),
      z: rand(-12, 12),
    },
    gyro: {
      a: rand(-5, 5),
      b: rand(-5, 5),
      g: rand(-5, 5),
    },
    orientation: {
      a: rand(-180, 180),
      b: rand(-90, 90),
      g: rand(-180, 180),
    },
  };
}

// ── Individual phone simulation ──────────────────────────────────────

class SimulatedPhone {
  constructor(index) {
    this.index = index;
    this.slot = null;
    this.ws = null;
    this.sensorInterval = null;
    this.actionTimeout = null;
    this.alive = true;
  }

  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(URL);

      this.ws.on('open', () => {
        this.ws.send(JSON.stringify({ type: 'register', role: 'phone' }));
      });

      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'assigned') {
          this.slot = msg.slot;
          console.log(
            `  [Phone ${String(this.index).padStart(2, '0')}] → slot ${String(this.slot).padStart(2, '0')}`
          );
          resolve();
        }
      });

      this.ws.on('close', () => {
        this.alive = false;
        this.stop();
      });

      this.ws.on('error', (err) => {
        console.error(`  [Phone ${this.index}] error: ${err.message}`);
        this.alive = false;
        resolve();
      });
    });
  }

  startSending() {
    // Send sensor data every 80–120ms (randomized per phone)
    this.sensorInterval = setInterval(() => {
      if (!this.alive) return;
      const data = { type: 'sensor', ...randomSensorData() };
      this.ws.send(JSON.stringify(data));
    }, rand(80, 120));

    // Occasionally send a random action
    this.scheduleAction();
  }

  scheduleAction() {
    if (!this.alive) return;
    const delay = rand(3000, 10000);
    this.actionTimeout = setTimeout(() => {
      if (!this.alive) return;
      const action = VALID_ACTIONS[Math.floor(Math.random() * VALID_ACTIONS.length)];
      this.ws.send(JSON.stringify({ type: 'action', action }));
      this.scheduleAction(); // schedule next one
    }, delay);
  }

  stop() {
    clearInterval(this.sensorInterval);
    clearTimeout(this.actionTimeout);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔌 Simulating ${COUNT} phones → ${URL}\n`);

  const phones = [];

  // Connect all phones sequentially so the bridge assigns distinct slots
  for (let i = 0; i < COUNT; i++) {
    const phone = new SimulatedPhone(i);
    phones.push(phone);
    await phone.connect();
  }

  const connected = phones.filter((p) => p.slot !== null);
  console.log(`\n✅ ${connected.length}/${COUNT} phones connected\n`);

  if (connected.length === 0) {
    console.error('❌ No phones connected. Is the bridge running?');
    process.exit(1);
  }

  // Start sending sensor data + random actions
  for (const phone of connected) {
    phone.startSending();
  }

  console.log('📡 Sending sensor data & random actions...');
  console.log('   Press Ctrl+C to stop.\n');

  // Graceful shutdown
  let exiting = false;
  const shutdown = () => {
    if (exiting) return;
    exiting = true;
    console.log('\n\n🛑 Shutting down simulators...');
    for (const phone of phones) phone.stop();
    console.log('👋 Done.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
