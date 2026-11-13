# Gesture quality — girar como perilla, látigo sin gravedad

Feature: `gesture-quality`. Branch: `fix/gesture-quality`. Owner: parent session (inline, no writer: the three units share `phone-client/app.js`).

## Specs

S1 (verbatim, user): "necesito que sigamos revisando la calidad de los gestos aun se me confunden gestos. sore tododo el latigo se confunde con girar."

S2 (verbatim, user): "el gesto girar quedo funcionando cuando el celular esta en vertical. pero el gesto girar el celular deberia estar acostado. o algo asi. ara que sea como girar una perilla."

S3 (verbatim, decision accepted): "Perilla en cualquier pose (eje z del teléfono)" — girar se mide con `DeviceMotionEvent.rotationRate.alpha` (velocidad angular alrededor del eje z del dispositivo, es decir el eje de la perilla, independiente de la pose). Acumular con signo, disparar a |ángulo| > 45°, rearmar cuando |ω| baja de 40 °/s, cooldown 1200 ms. `DeviceOrientationEvent.alpha` deja de participar: cerca de `beta = ±90°` la descomposición Euler es singular y salta con el roll.

S4 (verbatim, decisions accepted): "Veto cruzado latigo ↔ girar ↔ inclinar", "Latigo sin gravedad (e.acceleration)", "Alinear latigo/flick a shuffle", "Tests de detector real (no copia)". Un solo gesto por ráfaga: lockout compartido de 800 ms y veto bidireccional entre los tres detectores.

S5 (verbatim, decisión aceptada): "Perilla en cualquier pose" implica que la pose acostada NO se exige; queda documentada como pose de referencia en la guía, sin gate.

## Tasks

| ID | Specs | Route | Task | Commit |
|----|-------|-------|------|--------|
| T1 | S1, S4 | inline | Extraer los detectores a `phone-client/gesture-detector.js` (módulo con shim CommonJS) y reemplazar la copia de `tests/gesture-gallery.test.js` por tests del módulo real. | fbe5ef2, f9cd719 |
| T2 | S2, S3 | inline | Girar por `rotationRate.alpha` integrado: 45°, rearme con `|ω| < 40 °/s` sostenido 120 ms, cooldown 1200. Sin `DeviceOrientationEvent.alpha`. | f9cd719 |
| T3 | S1, S4 | inline | Látigo sobre aceleración lineal (`e.acceleration`, fallback de gravedad por pasa-bajos sobre `accelerationIncludingGravity`). | fbe5ef2, f9cd719 |
| T4 | S4 | inline | Lockout compartido de 800 ms + veto cruzado en ambos sentidos (girar activo bloquea látigo e inclinar; látigo armado bloquea girar). | fbe5ef2, f9cd719 |
| T5 | S4 | inline | Alinear látigo/flick a `shuffle`: `GESTURE_ACTIONS.flick` y el `defaultAction` del DTW en `bridge/index.js`, con los tests pineados actualizados. | 16314d7 |
| T6 | S2, S3 | inline | Reconciliar `openspec/specs/phone-client/spec.md` (R-GG-2, R-GG-4) con el comportamiento real; hoy declara `rotationRate.gamma` y nombres de gesto viejos. | 7fad071 |
| T7 | S1–S4 | inline | Verificación: suite completa, copia de la guía del teléfono coherente con la acción real. | ver L4 |

## Log

L1 (verbatim, user): "hey chat necesito que continuemos con el proyecto. necesito que sigamos revisando la calidad de los gestos aun se me confunden gestos. sore tododo el latigo se confunde con girar. y me parece (revisa) que el gesto girar quedo funcionando cuando el celular esta en vertical. pero el gesto girar el celular deberia estar acostado. o algo asi. ara que sea como girar una perilla. puedes revisar?"

L2 — exploración (evidencia): `phone-client/app.js:499-526` medía `DeviceOrientationEvent.alpha` (rumbo terrestre) con delta > 20°; `app.js:379-424` derivaba el jerk del látigo de `accelerationIncludingGravity`, así que cualquier rotación del vector gravedad armaba el flick; `app.js:409` marcaba `lastFiredGesture = 'latigo'` pero los gates de `:439` y `:452` solo comparaban `'twist'` y `'inclinar'`, así que ningún detector frenaba a otro. Acción inconsistente: práctica `latigo → shuffle` (`app.js:405-406`) contra vivo `flick → cycle-next` (`bridge/index.js:68`). `p5-collage/sensor-mapper.js` solo guarda su resultado en `s.sensor` (`p5-collage/sketch.js:143-147`), no dispara acciones: fuera de alcance.

L3 — decisión (verbatim, respuesta del humano al cuestionario): girar = "Perilla en cualquier pose (eje z del teléfono)"; alcance = "Veto cruzado latigo ↔ girar ↔ inclinar", "Latigo sin gravedad (e.acceleration)", "Alinear latigo/flick a shuffle", "Tests de detector real (no copia)".


L4 — cierre: commits `fbe5ef2` (módulo de detectores + 20 tests), `f9cd719` (cableado del cliente y copia de tests reemplazada), `16314d7` (bridge: `flick` → `shuffle`), `7fad071` (spec y mapa de módulos). Suite: 52 suites / 557 tests verdes. El verificador independiente que pedía el plan de assess no fue admitido por el runtime (el lanzamiento no llevaba una declaración `Risk: item N` reconocible y la regla prohíbe reintentar), así que sus comprobaciones se corrieron inline: ninguna suite re-declara los detectores, `app.js` no conserva detector propio ni lectura de `alpha`, el fallback de gravedad sólo se usa cuando falta `e.acceleration`, los DEFAULTS del módulo coinciden con R-GG-4 y `p5-collage/` quedó intacto. Observación fuera de alcance: el botón "Cambiar foto" sigue enviando `cycle-next` (avanza el mazo de esa celda) mientras el gesto Látigo hace `shuffle` (intercambia con otro fragmento); misma promesa, dos efectos.