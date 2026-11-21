# Operator state persistence — the wall keeps its tuning across a projector reload

The operator's live tuning (scatter scale, paper grain, layout preset, cycle running) lives only in the projector's memory, so reloading the projector throws it away and the operator has to re-tune the wall in front of the public. The bridge already owns two small JSON files it writes under a guard; this adds the third.

## Specs

**S1 — The bridge stores the wall's tuning.** `GET /api/operator-state` returns the stored object, or `{ "version": 1, "state": null }` when the file is missing or corrupt — never an error. `POST /api/operator-state` is gated exactly like the other authoring writes (`AUTHORING_WRITES_ENABLED` and, when set, the `X-Operator-Token` header compared in constant time), writes `images/operator-state.json` through a temp file and a rename so a crash never leaves half a file, and answers `400` on an invalid body without touching the stored bytes. The path is overridable with `OPERATOR_STATE_PATH`, like the other data files, so tests never write into the repository.

**S2 — The stored state is wall-level tuning, and it is bounded.** Shape:

```json
{
  "version": 1,
  "state": {
    "scatterScale": 1.0,
    "noiseIntensity": 0.35,
    "preset": "scatter",
    "cycleRunning": false,
    "updatedAt": "2026-11-21T03:00:00.000Z"
  }
}
```

`scatterScale` is a finite number in `0.4…1.8`, `noiseIntensity` in `0…1`, `preset` one of the six known preset names, `cycleRunning` a boolean. Anything else, an unknown field or a missing value is rejected. Per-cell state (filter, rotation, scale, opacity) is deliberately **out of scope** for this pass.

**S3 — The projector applies it on boot and the operator saves it.** On setup the projector fetches `/api/operator-state` once and, when a state exists, applies each field through the same code path the live operator command uses (`applyScatterScale`, the noise value plus a texture reset, the layout preset, the cycle start). If the fetch fails, the file is absent or a field is rejected, that field keeps its default and nothing else changes: the wall never blocks on the network. The operator posts a snapshot, debounced, after the commands it sends, and merges the projector's published snapshot for the values the projector owns (the cycle moves the scatter scale on its own).

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2 | worker: `bridge/operator-state.js`, `bridge/index.js` | `cdc6789` |
| T2 | S3 | worker: `p5-collage/sketch.js`, `p5-collage/operator-state.js`, `p5-collage/index.html` | `cdc6789` |
| T3 | S3 | worker: `operator/operator.js` | `cdc6789` |
| T4 | S1–S3 | verify: full Jest suite + served routes | `cdc6789` |

## Log

**L1 —** "necesito el token para guardar las configuraciones. las configuraciones modificadas en el operator se guardan solo en el navegador que esta abriendose verdad? es posible guardar las configuraciones si agregamos un supabase?"

**L2 (hallazgos) —** El bridge escribe hoy dos archivos, `images/sizes.json` (`POST /api/sizes`) e `images/deck.json` (`POST /api/deck`), ambos detrás de `AUTHORING_WRITES_ENABLED` + `AUTHORING_TOKEN`; en el droplet están encendidos y sin el header la ruta responde `401 Operator token required`. Todo lo demás que el operador hace (`setPreset`, `setScatterScale`, `setNoiseIntensity`, `setCycle`, `setFilter`, `setRotation`, `setScale`, `setOpacity`, `toggleVisibility`, `hideCell`, `bringToFront`) se aplica **en la memoria del proyector** por el enlace en vivo y no lo persiste nadie: recargar el proyector vuelve a los valores de `config.js` y `layout.json`.

**L3 (decisión) —** **No se agrega Supabase.** Lo que hay que persistir es un objeto de un kilobyte que el proyector ya tiene en memoria, y el bridge ya escribe archivos de datos al lado. Supabase aportaría Postgres gestionado, auth y realtime: sirve para control remoto, varias sedes o historial de estados, y ninguna de las tres es lo que se pidió. Además mete dependencia de red en el camino crítico de una instalación que tiene que funcionar con wifi mala, y una anon key en un cliente público. Se reevalúa el día que la obra se opere a distancia.

**L4 (decisión) —** El POST queda detrás del mismo guard que las otras escrituras (token), no del canal WebSocket del proyector: el proyector es la fuente de verdad del estado vivo, pero abrir una escritura de archivo sin autenticar en un bridge público es peor que la duplicación mínima de que el operador mande el snapshot que ya recibe.

**L5 (alcance) —** Queda fuera de este pase el estado por celda (filtro, rotación, escala, opacidad): son 30 celdas × 4 valores y cambia más seguido. Con la escala, el grano, el preset y el ciclo ya se resuelve el dolor real, que es volver a afinar la pared después de cada recarga.

**L6 (evidencia y correcciones del padre) —** Suite completa: **64 suites, 655 tests verdes**. El worker entregó T1–T3 pero dejó tres huecos que se cerraron inline: (a) `p5-collage/operator-state.js` no estaba cargado por la página del proyector, así que el helper era código muerto y `sketch.js` tenía una copia inline de la misma lógica — se agregó el `<script>` antes de `sketch.js` y se borró la copia, dejando **una sola** implementación; (b) faltaban los tests de ruta (401 sin token sin escribir nada, 400 con los bytes intactos, round-trip por HTTP) y el de cableado del setup, que ahora viven en `tests/operator-state-routes.test.js`; (c) el worker había satisfecho una aserción de `tests/cycle-control.test.js` **agregando un comentario** con el texto `loadCycleSpec();` cuando la llamada real quedó dentro de una cadena de promesas — se restauró la llamada real en `setup` y se borró el comentario, porque un test que se satisface con un comentario deja de probar nada.

**L7 (verificación cruzada de rangos) —** Se comprobó que el snapshot y la validación hablan la misma escala, que es donde un guard de rango se vuelve decoración: `makeSnapshot` publica `noiseIntensity` como `Math.round(CONFIG.noiseIntensity * 100)` (0…100) y el operador lo divide por 100 antes de guardar (0…1, el rango que valida el bridge); `scatterScale` viaja como multiplicador real en ambos lados (slider `0.4…1.6`, validación `0.4…1.8`). Si esas dos escalas se hubieran cruzado, cada guardado habría dado 400 en silencio y el ajuste nunca se habría persistido, con la suite igual en verde.
