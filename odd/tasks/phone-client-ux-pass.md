# Phone client UX pass — copy, sheet navigation and the end of gesture creation

Rework the phone client's three screens and its bottom sheet, and lower the collage brand mark's opacity. The phone stops creating gestures entirely and starts teaching the pad's two-finger transform instead; the transform controls also reset when a fragment changes image, so a photo always enters at its original size.

## Specs

**S1 — The collage mark is fainter.** The MIDI mark painted on the 1920×1080 canvas goes from `opacity: 0.6` to `0.35`, in both the module default (`p5-collage/brand-mark.js`) and the only call site (`p5-collage/sketch.js`). Nothing else about the mark changes.

**S2 — Splash copy.** The splash title and lead read exactly:

```
Collage interactivo sonoro-visual 
sumate a la experiencia MIDI desde tu celular.
```

The title keeps the display treatment it already has; the lead keeps the `.lead` treatment.

**S3 — The splash stops reporting and starts dedicating.** The three `Fragmentos / Lienzo / Sesión` rows disappear, and their place holds a plaque reading exactly:

```
NOCHE DE LOS MUSEOS 2026

«Somos ese quimérico museo de formas
inconstantes, ese montón de espejos rotos.»

Jorge Luis Borges, Cambridge
```

The `.data` primitive and its `.k` / `.v` children are removed from `phone-client/style.css`; nothing else uses them. The quote reads in **two lines** from 360px wide up, breaking after `formas`; `.plaque-quote` is capped at `45ch`, the only window that yields that break (under 43ch it falls to three lines, at 50ch or more it pulls `inconstantes,` up and leaves a short second line).

**S4 — The permission screen asks for one thing.** The `Campo 02` block (`Opcional` — the gestures paragraph) is removed; only `Campo 01` (`Requerido`) remains. The gap between the `Acceso al movimiento` title and the field grows, so the title breathes. Campo 01 explains how the sensors are used and that no sensitive data is collected:

```
Usamos el acelerómetro y el giroscopio para mover tu fragmento en vivo. No recopilamos datos personales: el movimiento no se guarda ni se comparte.
```

**S5 — The guide lists seven steps in this order.** Verbatim:

```
1. Arrastrá sobre la imagen para mover tu fragmento en el collage
2. Dos toques rápidos para ascender tu fragmento al frente
3. Incliná hacia adelante → saltás a otra celda del collage
4. Sacudí → cambia foto
5. Girá como perilla → cambia filtro
6. Revisá la pestaña controles para más opciones
7. Revisá la pestaña gestos para más información
```

The `La hoja de abajo ajusta opacidad, rotación y escala` step is gone; step 6 covers it.

Above the list, one preamble says what the piece is, so the two primaries have something to mean. Verbatim:

```
Un collage se arma con pedazos. Este reparte el lienzo en 30 celdas: en cada una vive un fragmento, y podés saltar entre todas. Las fotos salen de una librería: cada una que entra deja el collage distinto.
```

It is a preamble, not an eighth step: the numbered list stays at seven. It also settles the vocabulary without renaming anything — **fragmento** is the thing that lives in a **celda**, the place — which is the model the client already used in the header and in step 3.

**S6 — `?` opens the guide, and only collapses it when the guide is already there.** Pressing the header's `?` always selects the Guía tab and opens the sheet. If Guía was already the selected tab and the sheet was already open, the same press collapses the sheet instead.

**S7 — The first tab is called Controles.** The visible label `Forma` becomes `Controles`; its `data-tab` / `data-panel` identifier becomes `controles` so the markup and the guide's step 6 agree.

**S8 — Two filled primaries, then the z-order pair, then a wide Filtro.** The `Gestos` button leaves the action grid. `Otra celda` and `Otra foto` share the first row as the only two filled buttons: they are the two things a visitor can change, and **each names the object it changes, in the same shape**, so the difference is the noun and not a low-frequency verb like "reubicar". `Al frente` / `Enviar atrás` keep their existing pair on the next row. `Filtro` closes the grid as one wide button spanning both columns, **not** filled. Every `.button-pair` still holds exactly two buttons, so the grid never leaves a gap.

**S9 — A new image enters at its original size.** When the phone receives `cell-image` — which covers both a deck cycle and a reubicación — the three sliders return to `opacidad 100%`, `rotación 0°`, `escala 100%`, their labels follow, and those three values are sent to the bridge so the collage cell actually renders unscaled. A user's last adjustment never survives into the next photo.

**S10 — The phone no longer creates gestures.** The `+ Crear mi gesto` button, the wizard overlay, its five steps, its timers and its `record-start` / `record-stop` sends are removed from the phone client. With nothing left able to start a recording, the `Grabando` chip, the `gesture-status` chip and the `recording` state go too. The bridge's recording protocol is untouched: it is a contract other consumers hold, and retiring it is a separate decision.

**S11 — The Gestos tab teaches the pad.** In place of the creation button, the tab explains that the main touch pad also transforms the fragment: pinch to scale, two-finger turn to rotate. The explanation is one sentence with **no heading above it** — the sheet is short on vertical room, and a `Pad táctil` label only repeated what the sentence says. The three existing gesture cards and their `Practicar` buttons stay exactly as they are.

## Tasks

| ID | Spec | Route | Commit |
|----|------|-------|--------|
| T1 | S1 | inline: `p5-collage/brand-mark.js`, `p5-collage/sketch.js`, `tests/brand-mark.test.js`, `tests/brand-mark-draw.test.js` | `5a6aee0` |
| T2 | S2, S3, S4 | inline: `phone-client/index.html`, `phone-client/style.css`, `tests/phone-client-ux.test.js` | `46a3433` |
| T3 | S5, S6, S7 | inline: `phone-client/index.html`, `phone-client/app.js`, `tests/phone-sheet-navigation.test.js` | `ce51ec3` |
| T4 | S8 | inline: `phone-client/index.html`, `phone-client/style.css`, `phone-client/app.js`, `tests/phone-panel-layout.test.js` | `d67b608` |
| T5 | S9 | inline: `phone-client/pad-transform.js`, `phone-client/app.js`, `tests/phone-pad-transform.test.js` | `36d308a` |
| T6 | S10, S11 | inline: `phone-client/index.html`, `phone-client/app.js`, `phone-client/style.css`, `tests/phone-gestos-tab.test.js` | `2876ef8` |
| T7 | S1–S11 | verify: full Jest suite + structural pass over the served pages | — |

## Log

**L1 —** "hey chat necesito que modifiquemos unos detalles visuales del phone client y tambien del p5-collage. para el p5-collage. el logo midi debe tener una transparencia aun mayor. para phone-client: la pagina principal se ve actualmente asi: […] vamos a cambiar el texto. ahora debe decir: Collage interactivo sonoro-visual / sumate a la experiencia MIDI desde tu celular. luego vamos a remover los datos que estab was abajo. como el lienzo/fragmentos/sesion abierta. Creo que se ven bien pero son solo datos informativos que no suman mucho mas que de lo estetico. que datos podriamos agregar ahi? para que sea mas poetico que informativo? podira ser algo como / Noche de los museos 2026 / La coincidencia de los opuestos. / Jorge Luis Borges"

**L2 —** "la pag 2 actualmente se ve asi: […] hay que remover el texto 2. que habla de los gestos. no lo necesitamos. dejaremos solo el texto 1 que habla de que vamos a utilizar los sensores. ademas hay que darle un poco de espacio entre el titulo y el texto 1. El texto uno podria explicar como utilizaremos los sensores y que no recopilaremos data sensible. o algo asi."

**L3 —** "la tercera pagina. […] el apartado de guia debe tener este orden: 1. sigue igual 2. Dos toques rápidos para ascender tu fragmento al frente 3. Incliná hacia adelante → saltás a otra celda del collage 4. Sacudí → cambia foto 5. Girá como perilla → cambia filtro 6. Revisá la pestaña controles para más opciones 7. Revisá la pestaña gestos para más información"

**L4 —** "el boton guia con el icono "?" en el header no funciona correctamente. de hecho cuando lo clickeo compacta el cajon inferior con las 3 pestañas, en realida deberia siempre abrir la pestaña de guia, y si esta ya esta abiera y seleccionada deberia colapsar el cajon inferior."

**L5 —** "tab forma actual se ve asi: […] vamos a renombrar ys e llamara controles. aqui hay un boton gestos que es redundante ya que existe la pestaña gestos. asi que eliminamos ese boton y redistribuimos los otros para que no se rompa el layout. deja el boton cambiar de foto como princial usando las dos column arriba, y el resto que sigan igual."

**L6 —** "aqui hay una cosa de funcionalidad. cuando se mdoifican los sliders de tamaño, opacidad, rotacion, todo funciona ok. pero cuando se cambia de imagen, ya sea por reubicacion o por cambio de imagen desde el deck, los sliders se mantienen como la ultima modificacion. podrian reiniciarse, para que la imagen entre con su tamaño original?"

**L7 —** "pestaña gestos. aqui basicamente eliminaremos completamente la logica de crear gestos. y volveremos a trabajr la mejora de los gestos actuales. desde lo visual de esta pestaña, solo remover el boton crear gestos. y agregar la informacion del touch pad principal o sea explicar que ahora con el touch pad tambien sirve para la rotacion con dos dedos y la escala con gesto pinch. o algo asi n ose como se escribe."

**L8 (decisión) —** Bloque poético: **evento + cita de Borges**. Se descartó «La coincidencia de los opuestos» como cita porque no es de Borges: es el nombre de la actividad "Borges o la Coincidencia de los Opuestos" de la Noche de los Museos 2026 (UNC, Córdoba). La cita elegida sí es suya: *Cambridge*, en *Elegio de la sombra* (1969) — «Somos nuestra memoria, somos ese quimérico museo de formas inconstantes, ese montón de espejos rotos», recortada a su segunda mitad.

**L9 (decisión) —** Alcance de la eliminación de gestos: **solo el teléfono**. `bridge/message-relay.js`, `bridge/gesture-store.js` y `bridge/dtw-matcher.js` no se tocan: `record-start` / `record-stop` son contrato del protocolo y retirarlo es otra decisión.

**L10 (decisión) —** Opacidad del logo: **0.35**. «Aun mayor» transparencia que 0.6, sin volverlo invisible sobre el papel.

**L11 (diagnóstico) —** El `?` no estaba roto: `openHelp()` (`phone-client/app.js:979-981`) llamaba a `selectSheetTab('guia')`, que siempre hace `setTools(true)`. Pero el listener de "tap afuera" (`app.js:119-126`) corre después en el mismo click y, como el `?` no está dentro de `#tools-panel` ni es `#sheet-toggle`, colapsaba la hoja recién abierta. De ahí la sensación de que "compacta el cajón".

**L12 (cambio de requisito) —** "ok en la pag principal la cita de borges la frase, puede ser solo en dos lineas? actualmente esta en 3". Afecta solo S3: `.plaque-quote` pasa de `max-width: 32ch` a `45ch`. Con 80 caracteres en DM Mono a 12px la segunda línea necesita 43ch (310px) y el ancho útil desde un viewport de 360px es 328px; por debajo de 360px (320px de viewport, 288px útiles) la cita vuelve a tres líneas por geometría, no por el CSS.

**L13 (evidencia T7) —** Suite completa: **51 suites, 542 tests, todos verdes**. Cada tarea observó RED con `git stash` de su fuente antes de GREEN: T2 3 fallos, T3 3, T4 1, T5 5, T6 3. Chequeo estructural sobre lo servido por el bridge (`node bridge/index.js`, :8080): los 7 assets responden 200; las 33 referencias `$('id')` de `app.js` tienen markup (0 colgadas); 0 selectores huérfanos en `style.css` para las clases removidas (`rec-indicator`, `gesture-status`, `state-sq`, `chip`, `hud`, `wizard*`, `duration-btn`, `data`); `<div>` 43/43 balanceados; la placa y la nota del pad llegan en el HTML servido. **Pendiente:** confirmación visual en un teléfono real — el repo no tiene navegador headless, así que el ancho de la placa y el corte de las tres líneas del título se verifican a ojo.

**L14 (cambio de requisito) —** "En el tab gestos sacaría el título que dice pad táctil. Siento que usa más espacio. dejaría solamente el texto que explica que con los dos dedos pellizcar o, bueno, el otro ya no recuerdo. Pellizcar o girar para rotar y escalar los fragmentos. Eso sí queda, pero saca el título que dice pad táctil, que ocupa espacio." Afecta solo S11: se va el `<p class="pad-note-title">Pad táctil</p>` y su regla CSS; la oración queda sola y `.pad-note` deja de ser flex, porque con un solo hijo el gap no hacía nada.

**L15 (cambio de requisito) —** "Creo que el botón principal debería ser reubicar y quizás debería ser los dos principales: reubicar y cambiar foto. Los dos botones en negro, uno al lado del otro. Después continúa al frente o enviar al frente, traer al frente, enviar atrás para las fotos, para las imágenes. Y claro, serían dos, cuatro. Y claro, filtro quedaría como uno grande ocupando las dos columnas, como el botón largo. No es necesario que esté resaltado, solamente van a estar resaltados cambiar foto y reubicar." Afecta solo S8: `Reubicar` y `Cambiar foto` son el par relleno de la primera fila; `Al frente` / `Enviar atrás` bajan a la segunda; `Filtro` cierra como fila ancha sin relleno. `.row-primary` pasa a llamarse `.row-wide` porque ya no describe un primario sino un ancho.

**L16 (pregunta abierta) —** "Consulta: acá creo que no es tan intuitivo entender qué significa cambiar foto y qué significa reubicar. […] ¿cómo podemos hacer para que se explique cuál es la diferencia entre cambiar la foto, que eventualmente es sacar fotos desde la librería, desde el deck de fotos, desde el mazo de fotos disponibles […] y reubicar, que es cambiarse a otra celda dentro del collage." Pendiente de decisión de copy: el par de primarios no dice **qué** cambia cada uno. Hallazgo relacionado: el vocabulario del cliente mezcla **fragmento** (header, guía paso 1, `.cap`) con **celda** (guía paso 3, `alt="Tu celda"`), y esa mezcla es parte de por qué "reubicar" no se ancla a nada.

**L17 (decisión de copy) —** El par de primarios pasa a `Otra foto` / `Otra celda`. Principio: cada primario nombra el **objeto** que cambia, con la misma forma que el otro, así la diferencia es el sustantivo y no un verbo de baja frecuencia como "reubicar". `Otra foto` trae otra imagen del mazo; `Otra celda` te mueve a otro lugar del collage.

**L18 (deuda abierta) —** Consecuencia de L17: "celda" tiene que existir como palabra del cliente, y hoy el vocabulario mezcla **fragmento** (header `Fragmento`, `.cap` "Tu fragmento", guía paso 1, texto del permiso, nota del pad) con **celda** (guía paso 3 "saltás a otra celda", `alt="Tu celda"`). Recomendación: mantener *fragmento* como **la cosa** y *celda* como **el lugar**, que es el uso que la guía paso 3 ya hace, y anclar ambos nombres una sola vez en la guía paso 6 (que hoy es "Revisá la pestaña controles para más opciones"). Pendiente de aprobación porque toca la lista de 7 pasos de S5.

**L19 (cambio de requisito) —** "puedes agregar un poco mas de info a la guia. un texto que explique el proyecto. que es un collage y que hay 30 celdas disponibles en las cuales se puede ir saltando, y tambien hay una libreria de imagenes que puede ir cambiando las imagenes que estan actualmente en el collage. eso pero resumido. preciso y conciso". Afecta solo S5: se agrega un preámbulo de tres oraciones arriba de la lista numerada, que sigue en 7 pasos. Resuelve L18 sin renombrar nada: *fragmento* es la cosa, *celda* es el lugar. Deja sin efecto la propuesta de reescribir el paso 6 (L18), porque el preámbulo ya ancla los dos nombres de los primarios.
