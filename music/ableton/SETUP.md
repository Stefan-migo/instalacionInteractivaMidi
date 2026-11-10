# Ableton Live setup (MIDI from the installation)

The installation can drive an existing Ableton Live Set: continuous parameters on
**MIDI CC** and clip/scene firing on **MIDI notes**. Nothing here composes music —
the audience conducts a piece that already exists.

This file covers the only part of the system that cannot be automated: the show
machine. Everything below is what has to be true *before* the sound works.

```
phones ──WS──► bridge ──WS──► local agent ──MIDI──► loopMIDI ──► Ableton Live
                (cloud or laptop)     (laptop, always)
```

The agent that emits MIDI runs on the same machine as Ableton, always. MIDI is a
cable, not a network protocol.

## 1. The port name is a contract

The virtual MIDI port is named **`Collage-MIDI`**. Create it in **loopMIDI** with
exactly that name — same case, the hyphen, no trailing space.

The name is data, not a preference: the Live Set binds its MIDI map to that port,
so renaming the port breaks every mapping in the Set at once. If you must rename
it, set `portName` explicitly where the agent creates its output and re-map the
Set.

`bridge/midi-out.js` matches the name by exact string comparison. `Collage-MIDI `
(with a space) is a different port and will not be found.

## 2. Enable the port in Live

**Preferences → Link/Tempo/MIDI → MIDI Ports**, on the row for `Collage-MIDI`:

| Column | Value | Why |
|--------|-------|-----|
| Track  | **On** | Live listens to the port at all |
| Remote | **On** | a message can be assigned to a parameter (`Ctrl+M`) |
| Sync   | Off | we never carry transport clock |

The **Output Ports** section is irrelevant to us: the installation only sends.

## 3. Reboot after creating or deleting loopMIDI ports

Windows does not release a deleted MIDI device until the machine restarts, and
Live keeps showing the old name in the meantime.

Seen during setup: loopMIDI listed a single port named `Collage-MIDI` while Node
also saw `loopMIDI Port` and `collagemidi`, and Live labelled the live port
`loopMIDI Port` (loopMIDI's default name for a new port). `loopMIDI Port` is what
you get by pressing `+` without typing a name first.

Two consequences worth knowing:

- **Live binds its MIDI map to the device, not to the text of the name.** Mapping
  the Set while the ghost name is showing can leave the mappings pointing at a
  device that disappears after a reboot, and the Set then reads as "everything
  unassigned".
- So: reboot, then confirm **both** sides agree before mapping anything of value.

Verify from Node (PowerShell uses `;`, not `&&`):

```powershell
cd path\to\interactive-collage; node -e "const m=require('@julusian/midi');const o=new m.Output();for(let i=0;i<o.getPortCount();i++)console.log(i,o.getPortName(i))"
```

Verify through the project's own adapter, which is what the agent actually uses:

```powershell
node -e "const {createMidiOut}=require('./bridge/midi-out');const o=createMidiOut({log:console.log});console.log('available:',o.isAvailable(),'reason:',o.reason);o.close()"
```

Expected: `available: true`, `reason: null`, plus a line naming the output index.
If it prints `reason: no-port`, the port does not exist under that exact name. If
it prints `reason: no-module`, see section 4.

## 4. `@julusian/midi` is an optional native dependency

It ships as an `optionalDependency`: if it cannot be installed or loaded, the
installation still runs, visual-only, and says so. It never breaks `npm install`.

Two things are unusual about it:

**npm 11+ blocks install scripts by default.** The package arrives, but its native
binding is not built, and `require('@julusian/midi')` throws. The adapter catches
that and reports `no-module`. To build it:

```powershell
npm install-scripts approve @julusian/midi; npm rebuild @julusian/midi
```

**`package.json` pins the approval** in `allowScripts`:

```json
"optionalDependencies": { "@julusian/midi": "3.8.1" },
"allowScripts": { "@julusian/midi@3.8.1": true }
```

The version is exact on purpose: the `allowScripts` key names a version, so a
range that resolves to a new release would silently lose its approval and fall
back to visual-only. If you bump the version, re-run `npm install-scripts approve`.
Older npm versions ignore the field, so the file stays portable.

Verified on Windows with Node v26.13.0 and `@julusian/midi@3.8.1`: a prebuilt
binary is published, so neither `node-gyp` nor Visual Studio is needed.

## 5. Channel map

One port carries every lane; Ableton's MIDI map stores *channel + number*, so the
lanes never collide.

Ten groups of three phones, one channel per group:

| Channel | Group | CC (continuous) | Notes (gestures) |
|---------|-------|-----------------|------------------|
| 1 | slots 0-2 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 2 | slots 3-5 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 3 | slots 6-8 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 4 | slots 9-11 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 5 | slots 12-14 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 6 | slots 15-17 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 7 | slots 18-20 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 8 | slots 21-23 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 9 | slots 24-26 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 10 | slots 27-29 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 16 | operator | reserved | reserved |

Forty parameters in total: ten groups x three gestures = thirty note voices, plus
ten continuous lanes. Every phone in a group triggers the same three sounds,
which is what makes a crowd learnable in five minutes. The number of groups is
configuration: `GROUP_COUNT` in the bridge and the number of groups in
`music/mapping.json` must agree, and the panel says so when they do not.

Channels are written here as Ableton displays them (1..16). `bridge/midi-out.js`
accepts 1..16 and encodes them to the wire format itself. Note numbers are
remappable through the agent's `notes` option today, and will come from
`music/mapping.json` once the mapping file lands.

A gesture is derived in the bridge from the sensor stream: tilt is the device's
beta angle past 30 degrees, rotation is the gyro gamma past 120 deg/s, and flick
is the existing DTW match. Each one re-arms only after falling back below its
release point, and a 200 ms cooldown stops a held phone from machine-gunning.
Phones of the same group gesturing together collapse into one note per 50 ms
tick, carrying the hardest velocity of the batch — a group accent, not ten
stacked notes.

## 6. Diagnosing "nothing happens"

Work down this list; each line is a fact verified on this setup, not a guess.

| Symptom | Cause | Fix |
|---------|-------|-----|
| The adapter logs `no-module` | native binding not built | section 4 |
| The adapter logs `no-port`, and the list is missing the name | loopMIDI closed, or a name mismatch | section 1 |
| The adapter logs `no-port` while loopMIDI shows the port | ghost device, stale enumeration | reboot (section 3) |
| The adapter is available, Live receives nothing | Track off on that port | section 2 |
| Live receives, but nothing can be mapped | Remote off on that port | section 2 |
| A CC maps to a parameter that then ignores it | another lane was mapped last | check channel + number |
| The parameter ends up at zero after a test run | the test ramp returns to 0 | not a bug |

For raw message inspection, Live's **MIDI Monitor** device is the right tool. In
Live 12 the Max for Live packs are downloaded separately: **Browser → Packs → Max
for Live**. Without it, the quick check is to enter `Ctrl+M`, click a parameter,
and run a test message: if the parameter moves, the message arrived.

## 7. Running the agent

The agent is the only process that writes MIDI. Start it after the bridge is
reachable and loopMIDI exists:

```powershell
npm run agent
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `BRIDGE_URL` | `ws://localhost:8080` | where the bridge listens |
| `MIDI_PORT` | `Collage-MIDI` | the virtual port from section 1 |

What it does: registers as `agent`, receives three group values at 20 Hz, and
sends one CC per group on that group's channel (group 1 -> channel 1, and so on).
It only sends when a value changes, so a still crowd is not a CC flood. It also
turns each gesture voice into a note on that same channel.

What it does when things break:

- **A group has no live phones** -> that group is parked at **64** (mid) instead
  of freezing wherever the crowd left it.
- **The bridge link dies** -> every group is parked at 64 and the agent reconnects
  with capped backoff (0.5 s, doubling to 8 s). A clean reconnect resets the counter.
- **The MIDI port is missing** -> the agent still connects and consumes the feed;
  it logs `no-port` once and writes nothing. The installation stays in
  visual-only mode.

Verify the chain without Ableton: the agent logs the port it opened, and
`Ctrl+M` on a mapped parameter in Live moves when a phone moves.

## 8. The score (`music/mapping.json`)

Version this file next to the `.als`. It is the score: the music is tuned on the
show machine, so a change here is a file edit and a restart, never a deploy.

| Field | Meaning |
|-------|---------|
| `group`, `channel` | which ten slots the group owns, and its MIDI channel |
| `aggregation` | `average`, `max` or `last` — how ten phones become one value |
| `ccController` | the CC number of that group's fader |
| `curve` | `linear`, `exponential` or `logarithmic`, with `gamma` |
| `ema` | smoothing in (0, 1]: `1` is no smoothing at all |
| `deadband` | ignore changes smaller than this many 7-bit steps |
| `maxPerSecond` | traffic cap for that group |
| `notes.*` | the note each gesture fires in that group (36 tilt, 37 flick, 38 rotation) |

Top-level `derivation` block: `cooldownMs` plus, per gesture, `onThreshold`,
`offThreshold` and `span`. These describe a phone, not a group, which is why
they live outside the groups.

The agent applies the pipeline in this order: **curve → EMA → deadband → rate
limit**. That order is not arbitrary — it is the order you reason about the sound:
what shape, how smooth, what is too small to hear, how many messages per second.

A broken score never stops the show: every invalid value is replaced by its
default and reported as one line in the agent log.

**Derivation travels with the score.** On connect the agent pushes the
`derivation` block to the bridge over `music-config`, so editing a threshold here
and restarting the agent is enough — no code change, no deploy. Adopting new
numbers also clears the phones' armed state, because a latch armed under the old
thresholds means nothing under the new ones.

`span` is how far past the threshold a gesture must travel to reach full
velocity. With `span: 90` and a 30 degree threshold, a 60 degree tilt is about
half force instead of a maximum hit; measured through the port, a 65 degree tilt
now leaves at velocity 74 and a 70 degree tilt at 79.

## 9. Testing with real phones (Render bridge + local agent)

A real phone needs a secure context: the sensors do not work over a plain LAN IP.
So the phone client has to be served over HTTPS while the agent that writes MIDI
stays on the show machine.

```
phones --wss--> bridge on Render --wss--> laptop (agent) --MIDI--> loopMIDI --> Live
```

Render settings that matter:

| Setting | Value | Why |
|---------|-------|-----|
| Instances | **1** | slots, gestures and group state live in memory; a second instance tells a different truth |
| Start command | `npm start` | runs `node bridge/index.js` and honours `PORT` |
| Health check path | `/health` | it reports `pid` and `startedAt`: two different pids answering means two instances |
| Autoscaling | **off** | same reason as instances |
| Plan | paid | the free tier sleeps on inactivity, and a sleeping bridge is a dead installation |

Point the agent at the cloud bridge (`wss`, not `ws`: Render terminates TLS):

```powershell
$env:BRIDGE_URL="wss://<your-app>.onrender.com"; npm run agent
```

Order of verification before handing phones to people:

1. Open `/health` in a browser: `status: ok`, `agents: 1`, `clients: 0`.
2. Open the phone client on a real phone over HTTPS and allow motion access.
3. `clients` goes to 1 on `/health`, and the agent log stays quiet.
4. Tilt the phone: one note should leave the port.
5. Pull the network on the laptop: the agent parks every group at the safe
   value and reconnects with backoff when the link returns.

Two honest caveats. The deployed collage renders whatever
`images/manifest.json` describes; a deployment whose manifest is empty shows
empty cells, and the sound path does not depend on it either way. And a phone
that walks out of range now gets dropped by the heartbeat after one missed
ping interval (`HEARTBEAT_MS`, 30 s by default) instead of holding its slot
forever.

Flick has no derivation entry: it is recognised by the DTW matcher on the gesture
the phone already sends, not derived from the sensor stream.
