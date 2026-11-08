# Ableton Live musical interaction (the phones conduct an existing composition)

Feature branch: `feat/ableton-midi`, branched from `c118146` (`origin/main`), developed in the worktree `E:\Proyectos\InstalacionInteractivaMidi-midi`. Goal: a phone-driven layer that lets the audience modulate parameters and fire clips/scenes of a pre-existing Ableton Live 12 Suite composition, while the phone client never composes anything.

## Specs

S1 — The audience interprets; it does not compose: "el público, desde su celular, modula parámetros y dispara clips/scenes de una composición YA EXISTENTE en Ableton Live 12 Suite, hecha por un artista sonoro. El público no compone: interpreta."

S2 — MIDI is local by physics, not by preference: "todo proceso que EMITA MIDI tiene que correr en la misma máquina que Ableton. MIDI no cruza internet. La nube puede existir; el cable MIDI no."

S3 — Protocol: MIDI CC for continuous parameters, MIDI notes for firing clips/scenes. OSC is discarded as a base because Live has no native OSC. Lane contract on the single virtual port `Collage-MIDI`: channels 1..6 = groups of 5 phones, channel 10 = fire, channel 16 = operator.

S4 — Silent degradation: "la instalación sigue en modo visual, NUNCA crashea". A missing port, an unavailable native module, or a cable pulled mid-show must never take down the visual installation.

S5 — Dependency decision, stated by the user: "ok vamos con B". `@julusian/midi` ships as an optional dependency behind a guarded require: `npm install` never fails because of it, `/health` reports `midi: "unavailable"`, and the bridge logs one clear line instead of dying.

S6 — Order of work: "NO agregar la red hasta que el sonido funcione solo." Cloud transport is the last step, never the first.

S7 — Deployment, stated by the user: "ok tengo el proyecto levantado en render. por tanto. lo vamos a ir trabajando local y cuando hagamos merges al github se ira a produccion automaticamente". `main` is production; every change lands through a feature branch and a pull request.

S8 — Process: ODD only. The OpenSpec cycle still documented in `AGENTS.md` is deprecated for this project.

S9 — Musical timing absorbs latency: quantization on 1 Bar plus Follow Actions, so a crowd sounds like a composition and WAN latency does not read as sloppiness.

S10 — The score is a versioned artifact: `music/mapping.json` lives next to the `.als`, because the music is tuned on the show laptop, not by deploying to the cloud.

S11 — Behavioral floor: the existing suite stays green (29 suites / 354 tests at `c118146`), and the visual installation keeps working with zero MIDI present.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T1 | `bridge/midi-out.js`: injectable MIDI output adapter, guarded require, silent degradation when the port is missing, sends CC and notes | S3, S4, S5, S11 | inline, test-first | - |
| T2 | `music/ableton/SETUP.md`: loopMIDI port contract, Track/Remote, npm 11 install-script approval, phantom-port reboot, MIDI Monitor pack | S5, S7 | inline | - |
| T3 | `agent` role in the bridge: registration, fan-out of aggregated group state | S2, S3 | - | - |
| T4 | Local agent: reconnect with backoff, no dangling parameters on disconnect | S2, S3 | - | - |
| T5 | `bridge/music-mapping.js` + `music/mapping.json`: pure mapping (aggregation, curve, EMA, rate limit, deadband) | S3, S9, S10 | - | - |
| T6 | Load rehearsal with 30 virtual phones; measure real CC/s | S1, S11 | - | - |
| T7 | Cloud hardening: WebSocket heartbeat, single instance, Render limits | S2, S6, S7 | - | - |

## Log

L1 — Session handoff (memory 2633, "El handoff. Empezá por esta"), the entry point for this work: "Continuamos un proyecto en `E:\Proyectos\InstalacionInteractivaMidi` ... La sesión anterior fue sólo de diseño y aclaración de dudas. **No se escribió código.**" Objective as quoted in S1. Agreed order: "0. **Prueba de humo MIDI** ... 1. `bridge/midi-out.js` ... 5. Recién al final: mover a Render y conectar el agente remoto."

L2 — "ok vamos ahi. necesito hacer un repositorio en github para eso?" Answer: no repository for the throwaway smoke script. It lives in `C:\Users\El Mismisimo\midi-smoke\`, outside the repo, so the project's dependency graph stays untouched during discovery.

L3 — Step 0 evidence, all four assumptions confirmed against Live 12 Suite on Windows, Node v26.13.0, loopMIDI port `Collage-MIDI`: the port opens from Node, `@julusian/midi@3.8.1` ships a prebuild (no node-gyp, no Visual Studio), Live receives with Track + Remote on, and Live responds to CC (the volume fader follows the 0..127..0 ramp under `Ctrl+M`) and to notes ("ok quedo probado live responde a notas tambien"). Detail recorded in memory 2638.

L4 — Found during step 0, absent from the original diagnosis: npm 11.20.0 blocks install scripts by default, so `npm i @julusian/midi` leaves the native binding unbuilt and `require` throws until `npm install-scripts approve @julusian/midi` plus `npm rebuild`. Also, Live displayed the port under a ghost name (`loopMIDI Port`, the loopMIDI default) while Node and loopMIDI showed `Collage-MIDI`; Windows does not release deleted MIDI devices until reboot, and Live binds its MIDI map to the device rather than to the name. Reboot and verify both sides read `Collage-MIDI` before mapping the artist's Set.

L5 — "respcto al siguiente paso. dentro de los 3 caminos cual me recomiendas? puedes explicarlo de forma sencilla?" The three routes were a normal dependency, an optional dependency with a guarded require, and an injected module with no declaration. Recommendation and decision: "ok vamos con B" (S5).

L6 — "ok ya esta todo limpio en el otro worktree. mergeado en main y en produccion. tu puedes continuar en la ruta que me remoendaste. crea el worktree aparte." Work happens in `E:\Proyectos\InstalacionInteractivaMidi-midi` on `feat/ableton-midi`. The main worktree was left untouched with its in-flight brand-identity work; baseline measured there before isolation was 29 suites / 354 tests green.
