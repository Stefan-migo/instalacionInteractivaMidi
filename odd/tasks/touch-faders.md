# touch-faders — los faders del ruteo los mueve el pad

Feature: touch-faders · Specs S1-S3 · 8 tareas · rama `feat/touch-faders`
Reemplaza la intensidad de giroscopio por los parámetros del touchpad: 3 carriles CC por grupo (CC21 posición · CC22 escala · CC23 rotación).

## Specs

- **S1.** "vamos a cambiar la logica de los faders actuales. que promedian sensores de los 3 dispositivos del grupo. ahora lo que va a controlar esos faders van a ser los parametros del touchpad."
- **S2.** "cuando el usuario este modificand: posicion, escala, rotacion. estos faders deberian estar moviendose."
- **S3.** "3 carriles por grupo (30 CC)": CC 21 posición · CC 22 escala · CC 23 rotación, en el canal del grupo, para los 10 grupos.

## Tasks

- T1 · S1,S2 · `bridge/group-state.js`: tres carriles por grupo, fuentes de touch (`touchPosition`, `touchScale`, `touchRotation`) y decaimiento de la posición en `snapshot()` · inline
- T2 · S1,S2 · `bridge/index.js`: alimentar el agregador desde el stream de acciones `move`/`scale`/`rotation` con el slot de la conexión · inline
- T3 · S3 · `bridge/message-relay.js` + `music/mapping.js`: partitura con `ccControllers` por carril y compatibilidad con la partitura v2 (`ccController`) · inline
- T4 · S2,S3 · `music/agent.js` + `bridge/music-state.js`: un shaper y un CC por carril, valores por `grupo:carril` en el estado · inline
- T5 · S2,S3 · `operator/operator.js`: tres barritas por fila con su CC, y recorrido de mapeo de 60 pasos (30 notas + 30 continuos) · inline
- T6 · S3 · `music/mapping.json`: partitura al formato nuevo con los tres controladores · inline
- T7 · S1-S3 · docs: `AGENTS.md` (tabla de carriles) y `music/ableton/SETUP.md` (30 mapeos, uno por carril) · inline
- T8 · S1-S3 · verificación: suite completa + corrida con `scripts/simulate-phones.js` y panel del operador · inline

## Log

- **L1** (pedido original, verbatim): "ok perfecto. me gusto. ahora necesitamos que el touch, o los parametros que nos entrega el touch del pad principal modifiquen los faders en vivo de router midi. o sea, vamos a cambiar la logica de los faders actuales. que promedian sensores de los 3 dispositivos del grupo. ahora lo que va a controlar esos faders van a ser los parametros del touchpad. o sea que cuando el usuario este modificand: posicion, escala, rotacion. estos faders deberian estar moviendose. es posible?"
- **L2** (decisión del usuario, verbatim de la opción elegida): "3 carriles por grupo (30 CC) — CC21 posición · CC22 escala · CC23 rotación".
- **L3** (decisión técnica): el bridge ya recibe cada acción con su slot (`bridge/index.js:465` → `:534`), así que no se toca el phone-client ni el protocolo: solo cambia quién alimenta el agregador.
- **L4** (decisión técnica): los tres parámetros no son intensidad. La posición son deltas y **decae** al soltar (se calcula en `snapshot()` con el tiempo transcurrido, sin timers). Escala y rotación son estado absoluto y **quedan** donde el teléfono las dejó.
- **L5** (decisión técnica): cada teléfono contribuye también en reposo (escala 100, rotación 0, posición 0), para que el promedio de los 3 del grupo no salte cuando el segundo teléfono toca.
- **L6** (decisión técnica): la partitura v2 (`ccController: 21`) sigue siendo válida y deriva los tres carriles (21, 22, 23), para no romper un deploy en curso.
