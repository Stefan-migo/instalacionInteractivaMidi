# Device groups: round-robin by connection, decoupled from the cell

Assign MIDI groups by connection order instead of by slot block, and keep a
phone's group when it changes cell.

## Specs

- **S1** — User, verbatim: "si realiza el cambio. y reubicar debe desacoplarse. o sea que el telefono conserve su grupo aunque cambie de celda."
  A phone keeps its group for the lifetime of its connection, even after
  `cell-next` / `cell-prev` reassign it to another slot.
- **S2** — User, verbatim: "segun mi logica deberia ser: 1er dispositivo = grupo1, 2do dispositivo = grupo2, 3er dispositivo = grupo3 ... 10mo dispositivo = grupo 10, 11 avo dispositivo = grupo 1".
  The group is round-robin over **connection order**, not over slots. The first
  connection takes group 1, the second group 2, the eleventh returns to group 1.
- **S3** — User, verbatim: "de esta forma se me ocurre que ya con 10 dispositivos conectados podemos tener todas las notas y CC midi disponibles".
  With 10 concurrent phones all ten groups must be active. Today they are not:
  the block mapping `floor(slot/3)+1` reaches only groups 1-4 with slots 0-9.
- **S4** — The group count and the score stay in agreement. `bridge/topology.js`
  keeps rejecting a `GROUP_COUNT` that does not divide the 30 slots evenly, and
  `music/mapping.json` keeps declaring the same number of groups. A phone that
  reconnects is a new connection and takes the next group in rotation.

## Tasks

| ID | Task | Specs | Route | Commit |
| --- | --- | --- | --- | --- |
| T1 | Round-robin group helper over connection ordinals | S2 | worker | U1 |
| T2 | Aggregator resolves the group from the connection, not the slot | S1, S2 | worker | U1 |
| T3 | Bridge assigns a group at registration and moves it across a reassignment | S1, S3 | worker | U1 |
| T4 | Update every test that pinned the block mapping; add the regression pins | S1-S3 | worker | U1 |
| T5 | Verify: suite green, 10 phones cover 10 groups, group survives Reubicar | S1-S3 | parent | — |

## Log

- **L1** — User, verbatim: "puedes explicarme como es el orden de ingreso de dispositivos al sistema? sobre todo el orden que tiene relacion con los grupos de dispositivos en los que se organizan las notas midi y CC midi que se envian a ableton. son 10 grupos que cada grupo envia 3 notas y 3 faders. como funciona el orden de ingreso de los dispositivos a estos grupos?"
- **L2** — Measured state before the change: `bridge/topology.js` derives
  `{slotCount: 30, groupCount: 10, slotsPerGroup: 3}` and
  `groupForSlot(slot) = floor(slot / 3) + 1`, so groups are contiguous blocks of
  three slots. Executed: with ten phones (slots 0-9) the groups reached are
  **1, 2, 3, 4**. The rotation the user describes is not implemented.
- **L3** — Decoupling is not cosmetic: `groupForSlot(info.slot)` was called at
  three gesture sites (`bridge/index.js` 460, 477, 487) and the reassignment path
  ran `groupAggregator.drop(oldSlot)` + `seedTouchLanes(targetSlot)`, so
  Reubicar moved the phone's three notes and three CCs to another MIDI channel.
- **L4** — User, verbatim: "si realiza el cambio. y reubicar debe desacoplarse. o sea que el telefono conserve su grupo aunque cambie de celda."
