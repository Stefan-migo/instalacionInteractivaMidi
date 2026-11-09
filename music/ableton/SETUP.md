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

Three groups of ten phones, one channel per group:

| Channel | Group | CC (continuous) | Notes (gestures) |
|---------|-------|-----------------|------------------|
| 1 | slots 0-9 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 2 | slots 10-19 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 3 | slots 20-29 | CC 21 | 36 tilt, 37 flick, 38 rotation |
| 16 | operator | reserved | reserved |

Nine voices in total: 3 groups x 3 gestures. Every phone in a group triggers the
same three sounds — that is what makes a crowd learnable in five minutes.

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
| `gestures.*.note` | the note each gesture fires (36 tilt, 37 flick, 38 rotation) |

The agent applies the pipeline in this order: **curve → EMA → deadband → rate
limit**. That order is not arbitrary — it is the order you reason about the sound:
what shape, how smooth, what is too small to hear, how many messages per second.

A broken score never stops the show: every invalid value is replaced by its
default and reported as one line in the agent log.

**Not wired yet.** `onThreshold`, `offThreshold` and `span` are recorded here for
the operator and for the console, but the bridge still derives gestures with its
built-in defaults (tilt 30/20, rotation 120/60, 200 ms cooldown). Editing a
threshold in this file changes nothing until the agent pushes them over
`music-config`.
