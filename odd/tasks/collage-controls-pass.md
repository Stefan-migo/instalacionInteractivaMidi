# Collage controls pass — free movement, image picker, and the end of the event furniture

Six owner requests in one pass: the projector stops carrying event furniture (QR, brand mark), gains a subtle paper texture, fragments move freely past the canvas edge, "send back" jumps to the bottom of the stack, "Otra celda" picks a free cell at random, and "Otra foto" gains an image picker that only offers images not already on the wall.

## Specs

**S1 — Send back goes to the bottom.** The `send-back` action takes the fragment to the very back of the draw order in one step, not one layer. The dense renumbering stays: after the action the 30 cells hold consecutive `zIndex` values and no two share one.

**S2 — The canvas carries no furniture.** The projector page no longer renders the join QR, and the MIDI brand mark is no longer painted behind the fragments. Nothing else about the projector page changes.

**S3 — The canvas has a paper texture.** The projector paints a subtle paper texture over its background colour, at an intensity the operator can still drive. The texture stays subtle: it must never read as grain or as a visible pattern.

**S4 — A fragment moves freely, including past the edge.** A fragment can be dragged anywhere the operator or the phone sends it, in every size class, and only a small part has to stay visible: a floor of 8% of the fragment's own size, instead of the current 25%. A manual position survives a change of image: once moved, the fragment stops being re-anchored by its composition percentage.

**S5 — Otra celda jumps at random.** `cell-next` moves the phone to a random empty slot instead of the next one in slot order. It still only targets free, out-of-cooldown slots, and it still keeps the phone in its own group.

**S6 — Otra foto offers two ways.** Pressing "Otra foto" opens a choice: pick a specific image from the library, or just skip to another one. The library shows only images that are not currently on the collage — distinctness is preserved and never violated by a pick. Skipping keeps today's behaviour (a random image from the remaining deck).

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1 | inline: `p5-collage/cell-actions.js` | `6f7a5f4` |
| T2 | S2 | inline: `p5-collage/index.html`, `p5-collage/sketch.js`, `p5-collage/brand-mark.js` | `6f7a5f4` |
| T3 | S3 | inline: `p5-collage/config.js`, `p5-collage/background-texture.js` | `6f7a5f4` |
| T4 | S4 | inline: `p5-collage/cell-renderer.js`, `p5-collage/drag-manager.js`, `p5-collage/cell-actions.js`, `p5-collage/layout-preset-engine.js`, `p5-collage/config.js` | `6f7a5f4` |
| T5 | S5 | inline: `bridge/index.js` | `6f7a5f4` |
| T6 | S6 | worker: `bridge/index.js`, `bridge/message-relay.js`, `p5-collage/image-deck.js`, `p5-collage/cell-actions.js`, `p5-collage/sketch.js`, `phone-client/index.html`, `phone-client/app.js`, `phone-client/style.css` | `6f7a5f4` |
| T7 | S1–S6 | verify: full Jest suite + served-page structural pass | `6f7a5f4` |

## Log

**L1 —** "son estas las modificaciones que me gustaria hacer. puedes darme un overview de las posibilidades de implementarlas antes de tocar codigo? - [ ] Poder abrir una librería con thumbnails, para seleccionar una imagen específica, sería posible hacerlo? - [ ] Los saltos de enviar atrás tienen que ser de al menos 10 capas, actualmente es solo una, es muy tedioso llegar atrás - [ ] Las imágenes tienen que poder moverse libremente e incluso poder quedar fuera del canvas,necesito que se puedan desplazar libremente en todos sus tamaños. - [ ] Sacar el qr del collage, sacar el logo MIDI atrás en el canvas - [ ] Agregarle textura al canvas atrás sutil - [ ] Al cambiar de celda puede ser aleatorio, actualmente al parecer vamos en orden fragmento x fragmento"

**L2 (decisiones) —** "1. si habria que agregar un boton en el phone-client para seleccionar la foto o lo ideal aqui seria que cuando se haga click en el boton otra foto, esta permita seleccionar entre dos opciones, seleccionar desde la libreria una imagen especifica, o bien simplemente saltar a una nueva. las imagenes siguen sin repetirse por tanto las que aparecen en la libreria solo se deben mostrar las imagenes disponibles que no se repitan co las que ya estan en el collage. / 2. ok vamos con eso. al fondo directo. / 3. si eso libre con un minimo chico visible. (5-10%) / 4. ok borrar qr y logo / 5. ok vamos con ese / 6. esta bien que sea random solo entre slots vacios."

**L3 (decisión) —** S1 se resuelve moviendo `send-back` al fondo en un solo paso, no a diez capas: pedido el "al fondo directo" en L2. El reordenamiento denso de `zIndex` que ya existe se conserva.

**L4 (decisión) —** S4 fija el mínimo visible en 8% del tamaño del fragmento (dentro del 5-10% pedido), medido sobre el rectángulo dibujado y aplicado en los cuatro lugares que hoy recortan: el drag del proyector, la acción `move` del teléfono, el anclaje por composición y el layout inicial.

**L5 (hueco abierto, no bloqueante) —** El QR era la puerta de entrada del público al teléfono. Al sacarlo de la proyección, ese acceso queda sin lugar en la obra: falta decidir si vive en un cartel impreso, en una leyenda al arrancar el proyector o en material aparte. No bloquea T2 ni la suite; queda pendiente del dueño.

**L6 (recorte de alcance) —** S4 pedía que la posición manual sobreviviera también a un cambio de la escala de dispersión. No se implementa: `_recalculateLayout` reescribe `pos.x`/`pos.y` con la nueva composición antes de adaptar, así que preservar `_userMoved` no conservaría la posición, solo saltearía el anclaje dentro de la caja nueva; y el ciclo de reordenamiento (cada 30 s) depende de que cada paso sea un reordenamiento completo. Se implementa el resto de S4: piso de 8%, el drag y el `move` del teléfono aceptan que el fragmento salga del canvas, y un fragmento arrastrado ya no se re-ancla al cambiar de imagen (el drag no marcaba `_userMoved`; solo lo hacía el `move`).

**L7 (decisión) —** El color del canvas no cambia con S3: `shader-paper` pasa a pintar el mismo tono papel que `solid` (`[244,244,244]`), porque ahora el shader es una capa de grano translúcida y no el color de fondo. Antes `shader-paper` pintaba un beige cálido `[235,217,179]`, que habría cambiado el color de la obra al encender la textura.

**L8 (evidencia T7) —** Suite completa: **62 suites, 641 tests verdes** (baja de 63/643 porque T2 borra `tests/brand-mark-draw.test.js` y consolida `tests/brand-mark.test.js`). Cada tarea observó RED antes de su fuente. Chequeo estructural sobre lo servido por el bridge (`PORT=8231 node bridge/index.js`): `/phone-client/`, `/p5-collage/` y `/operator/` responden 200; `/api/deck/available` devuelve **210 claves, `001`…`210`, ordenadas**; la página del proyector da **0** coincidencias de `qr-wrapper`, `qrserver` y `brand-mark.js`; el cliente del teléfono sirve `photo-choice`, `photo-library` y `choose-library-btn`. **Pendientes de verificación a ojo** (no hay navegador headless en el repo): que el grano se lea como papel y no como ruido de compresión, y que la grilla de miniaturas entre en la hoja del teléfono sin empujar los controles.

**L9 (deuda de tests, T6) —** El test de ruta `GET /api/deck/available` lo escribió el padre, no el worker: cubre exclusiones, orden ascendente, formato de tres dígitos y el filtro de una imagen que un proyector reporta sobre una celda. Falta un test que cubra el filtro **en vivo** con dos proyectores reportando a la vez, y un test de que un `assign` rechazado deja intactos tanto el mazo como las dos celdas involucradas.
