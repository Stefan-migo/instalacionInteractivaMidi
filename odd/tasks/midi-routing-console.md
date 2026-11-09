# MIDI routing console in the Operator

Feature branch: `feat/midi-routing-console`, branched from `origin/main` (`dd8ad9e`, the merge of PR #15) in the existing worktree `E:\Proyectos\InstalacionInteractivaMidi-midi`. Goal: an operator panel that explains, graphically and in plain words, what each phone action sends to Ableton, what has to be mapped there, and what is happening right now.

The music feature this panel configures is documented in `odd/tasks/ableton-music.md`; the setup it describes lives in `music/ableton/SETUP.md`.

## Specs

S1 — The panel's job, stated by the user: "Yo necesito que sea un panel visual de la configuracion de la organizacion de acciones de cada dispositivo."

S2 — It must show both directions: "que el panel muestre que es lo que se recibe, que ese lo que se manda." Received = the gesture or movement a phone produces. Sent = the MIDI message that leaves the port.

S3 — It must teach the difference between the two lanes, because the user himself was unsure: "por ejemplo que diga algo asi como: Este corresponde al gesto latigo de un dispositivo, va con CC XX no nota midi XX." Gestures send notes; continuous movement sends CC. The panel states this in words, not only in numbers.

S4 — Its purpose is to explain what has to be configured in Ableton afterwards: "solo que explique graficamente lo que despues debe ser configurado en ableton." It cannot write Ableton's MIDI map: Live does not expose that to an external process, and that belongs to the Max for Live phase.

S5 — Read-only first: "1. si read only primero." No editing of `mapping.json` in this stage. The panel may not be able to break a rehearsal.

S6 — The routing sheet must be printable and copyable: "2. si que se pueda imprimir o copiar", so the artist can take it to paper or a message.

S7 — It opens in its own window: "3. ventana aparte", so it can live on a second monitor while the show runs.

S8 — Placement, decided by the user: "es verdad el panel de configuracion lo necesito en local. no lo necesito deployado en render." Resolved as one page, not two: the bridge serves it, so the same panel opens at the deployed URL or at localhost depending on where the bridge runs. Because the phones connect to the bridge, the panel must read from the same bridge the phones talk to, or it shows a show that is not happening.

S9 — Visual grammar: the Operator page (`/operator/`) is Spanish, with numbered sections (01 Distribución ... 06 Acciones), a theme toggle and a connection line. This panel is section `07 · Ruteo MIDI` in that grammar, in that language.

S10 — Behavioural floor: the existing suite stays green (39 suites / 437 tests at `dd8ad9e`), and the panel adds no load to the music path: it reads state, it never writes to the MIDI side.

## Tasks

| ID | Task | Specs | Route | Commit |
|----|------|-------|-------|--------|
| T9.1 | Design directions first: artboards for the panel in the project's design system, before code | S1-S4, S9 | design | `4fea482` |
| T9.2 | The agent pushes the full score (channels, notes, ccController) over `music-config`; the bridge keeps it | S2, S3 | - | - |
| T9.3 | The bridge records per-group/gesture last-fired and the current shaped CC per group, exposed by `GET /api/music` | S2, S8 | - | - |
| T9.4 | Operator section `07 · Ruteo MIDI`: the 3x3 sheet, the three fader rows, the status block, built from the chosen direction `03-dos-columnas` (handoff started) | S1-S5, S9 | writer | - |
| T9.5 | Printable and copyable sheet — folded into T9.4, because the chosen artboard already draws both controls | S6 | writer | - |
| T9.6 | Own-window mode: the section alone when the page is opened for it — folded into T9.4 | S7 | writer | - |

## Log

L1 — "ok vamos con T9", then the correction that reframed the feature: "ok wait. es verdad el panel de configuracion lo necesito en local. no lo necesito deployado en render. o lo necesito en ambos?" Answered with S8: one page, served by the bridge, opened wherever the bridge runs; editing is the only local-only capability, and it is out of scope here.

L2 — The three decisions, verbatim: "1. si read only primero. 2. si que se pueda imprimir o copiar 3. ventana aparte" (S5, S6, S7).

L3 — Discovery while scoping: `p5-collage/control-panel.js` no longer exists in `main`; the operator surface moved to `operator/` (index.html, operator.css, operator.js) served at `/operator/`, titled "MIDI · Operador", in Spanish, with numbered sections. The panel is a new section there, not a new application. The worktree from the music feature is reused for this branch instead of being removed.

L4 — Directions written in `design/midi-routing/` (commit `4fea482`), three structures and one palette: `01-matriz` makes the 3x3 grid the page, `02-planilla` is a routing schedule per group, `03-dos-columnas` splits the sheet from the live state. The user chose **03 · Dos columnas**: "deja la matriz a la izquierda y los faders y el diagnóstico a la derecha para mantener la hoja y el estado a la vista".

L5 — The artboards first carried invented MIDI data, written by the worker from the panel brief instead of from the score: every cell said `NOTA 36` whichever the gesture, every cell mapped `Pad 1 del Drum Rack`, and the three groups were shown with three different aggregation modes. Corrected against `music/mapping.json` and `SETUP.md` §5 before showing them: `tilt` 36, `flick` 37, `rotation` 38, one channel per group, `CC 21` on each, `average` in all three, and the mapping target stated as "Nota N en canal C → la voz del grupo C", because Live stores a channel+number pair and the setup sheet numbers no pads. Recorded so the implementation does not inherit the first draft.
