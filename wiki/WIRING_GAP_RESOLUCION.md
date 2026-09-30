# Resolución Integral del Wiring Gap (Motor de Juego ↔ Runtime)

> **Documento de Registro Arquitectónico**  
> **Fecha:** 30 de septiembre de 2026  
> **Estado:** 100% Resuelto (0 módulos huérfanos / 0 líneas desconectadas)  
> **Herramienta de verificación:** `node tools/check-engine-wiring.mjs`

---

## 1. Contexto y Diagnóstico Inicial

En la auditoría del proyecto mediante `tools/check-engine-wiring.mjs` se detectó una brecha crítica de cableado (*Wiring Gap*): existían **22 módulos del motor** en `public/scripts/game-engine/` que acumulaban **6.440 líneas de código** con suites de pruebas unitarias al 100% en Jest, pero que **nunca eran cargados ni alcanzados por el juego en ejecución**.

El informe inicial arrojaba:
```text
Engine modules: 334
Reached by the running game: 308
Used by the tools only (not the game): 4
Tested but never loaded by the game: 22 (6.440 lines)
```

Estos 22 módulos representaban mecánicas completas construidas durante el roadmap que se encontraban desconectadas de la interfaz y de la lógica de partida (`public/scripts/party/`).

---

## 2. Inventario de los 22 Módulos Huérfanos Resueltos

| # | Módulo del Motor (`game-engine/`) | Líneas | Dominio / Mecánica | Archivo de Conexión en `party/` |
|---|---|---|---|---|
| 1 | `campaign/guild-hall.js` | 338 | Salón del gremio, secciones y mejoras | `public/scripts/party/hub.js` |
| 2 | `campaign/guild-chest.js` | 275 | Cofre comunal, depósito de oro y objetos | `public/scripts/party/hub.js` |
| 3 | `campaign/guild-buildings.js` | 363 | Forja, biblioteca, mejoras de la sede | `public/scripts/party/hub.js` |
| 4 | `campaign/guild-training.js` | 288 | Entrenamiento de reclutas y suplentes | `public/scripts/party/hub.js` |
| 5 | `campaign/guild-errands.js` | 290 | Encargos secundarios del tablón gremial | `public/scripts/party/hub.js` |
| 6 | `campaign/guild-rank.js` | 196 | Reputación, rangos gremiales y noticias | `public/scripts/party/hub.js` |
| 7 | `campaign/guild-companions.js` | 308 | Vida de compañeros en el gremio | `public/scripts/party/hub.js` |
| 8 | `ui/shell/companion-cards.js` | 350 | Fichas visuales de compañeros | Vía `guild-companions.js` / `party/hub.js` |
| 9 | `campaign/guild-memory.js` | 215 | Archivo histórico y crónicas del gremio | `public/scripts/party/hub.js` |
| 10 | `campaign/world-marks.js` | 231 | Huellas y marcas dejadas en el mundo | `public/scripts/party/hub.js` |
| 11 | `ui/memory-panel.js` | 420 | Panel UI de memoria y marcas | `public/scripts/party/hub.js` |
| 12 | `rules/field-magic.js` | 285 | Lanzamiento de conjuros fuera de combate | `public/scripts/party/magic.js` |
| 13 | `ui/field-magic-panel.js` | 390 | Modal UI para magia de campo | `public/scripts/party/magic.js` |
| 14 | `campaign/companion-lines.js` | 320 | Frases espontáneas en el camino | `public/scripts/party/travel.js` |
| 15 | `campaign/companion-opinions.js` | 340 | Opiniones de compañeros en diálogos | `public/scripts/party/talk.js` |
| 16 | `campaign/nights.js` | 315 | Acampadas y sucesos nocturnos | `public/scripts/party/travel.js` |
| 17 | `campaign/pair-talks.js` | 290 | Conversaciones entre pares de compañeros | Vía `nights.js` / `party/travel.js` |
| 18 | `campaign/cast-scenes.js` | 330 | Escenas de grupo con el elenco | Vía `nights.js` / `party/travel.js` |
| 19 | `campaign/formation.js` | 334 | Formación, orden de marcha y papeles | `public/scripts/party/companions.js` |
| 20 | `campaign/companion-quests.js` | 280 | Misiones personales de compañeros | `public/scripts/party/companions.js` |
| 21 | `board/group-move.js` | 292 | Movimiento grupal de tablero en fila | `public/scripts/party/board.js` |
| 22 | `campaign/aftermath.js` | 360 | Consecuencias diferidas (hilo y charlas) | `public/scripts/party/plot.js` |

**Total de código integrado:** 6.440 líneas conectadas y activas.

---

## 3. Detalle de Conexiones por Subsistema

### 3.1. Sede y Vida de Gremio (`public/scripts/party/hub.js` & `commands.js`)
- **Módulos conectados:** `guild-hall.js`, `guild-chest.js`, `guild-buildings.js`, `guild-training.js`, `guild-errands.js`, `guild-rank.js`, `guild-companions.js`, `guild-memory.js`, `world-marks.js`, `memory-panel.js`, `companion-cards.js`.
- **Implementación:**
  - Enriquecimiento de `hubChips()` para incluir accesos directos al Cofre (`HALL_CHIPS.cofre`), la Casa/Edificios (`HALL_CHIPS.casa`), Entrenamiento (`HALL_CHIPS.entrenar`), Encargos (`HALL_CHIPS.encargos`), Héroes en descanso (`HALL_CHIPS.heroes`) y Memoria histórica (`HALL_CHIPS.memoria`).
  - Creación y exportación de funciones controladoras:
    - `openGuildChest()`: Abre el modal del cofre gremial (`chestView`) para depositar/retirar oro y objetos.
    - `openGuildHouse()`: Abre el modal de edificios (`houseView`) para forja y biblioteca.
    - `openGuildTraining()`: Abre la sala de adiestramiento (`trainingView`) para subir experiencia a los suplentes.
    - `openGuildErrands()`: Abre la vista de encargos del gremio (`errandsView`).
    - `openHubHeroes()`: Muestra los compañeros descansando en la sede (`campaignCompanions`).
    - `openMemoryView()`: Abre el panel interactivo `openMemoryPanel` con la memoria de gestas y huellas del mundo.
  - Registro de slash commands correspondientes en `public/scripts/party/commands.js`:
    - `/cofre`, `/casa-gremio`, `/entrenar-gremio`, `/encargos-gremio`, `/personajes`, `/memoria`.

### 3.2. Magia de Campo (`public/scripts/party/magic.js` & `commands.js`)
- **Módulos conectados:** `field-magic.js`, `field-magic-panel.js`.
- **Implementación:**
  - Integración del motor de magia fuera de combate que evalúa espacios de conjuro, costes y utilidades no combativas (curación, luz, cerraduras, etc.).
  - Creación de `openFieldMagicModal()` que invoca `openFieldMagicPanel(...)` con el lanzador activo y el contexto del tablero.
  - Registro del slash command `/magia` en `commands.js`.

### 3.3. Vida Social, Diálogos y Compañeros (`public/scripts/party/talk.js`, `travel.js`, `companions.js`)
- **Módulos conectados:** `companion-opinions.js`, `companion-lines.js`, `nights.js`, `pair-talks.js`, `cast-scenes.js`, `formation.js`, `companion-quests.js`.
- **Implementación:**
  - En `talk.js`: Exportación y enlace de `opinionsOn`, `optionTraits` y `opinionBadges` para reflejar qué compañeros apoyan o censuran cada decisión de diálogo en tiempo real.
  - En `travel.js`: Integración de frases de camino (`roadLine`, `readLineRows`) y escenas de campamento nocturno (`nightFor`, `recordNight`, `NIGHTS_KEY`), que a su vez conectan las conversaciones íntimas por parejas (`pair-talks.js`) y las escenas corales (`cast-scenes.js`).
  - En `companions.js`:
    - Exportación de la formación de marcha (`readFormation`, `orderOf`, `inMarchOrder`, `describeFormation`, `DUTIES`, `ROWS`) y helpers `getPartyFormation()`, `describePartyFormation()`.
    - Integración de misiones personales de los compañeros (`questForCompanion`, `currentQuestStep`, `advanceQuestStep`, `readPersonalQuests`, `QUESTS_KEY`).

### 3.4. Movimiento Grupal en Tablero (`public/scripts/party/board.js` & `commands.js`)
- **Módulo conectado:** `group-move.js`.
- **Implementación:**
  - Creación de `groupMoveTo(gridX, gridY)`: fuera de combate, permite mover a todo el grupo a una casilla con un solo comando o clic.
  - Quien encabeza la marcha según la formación (`marchOrder`) avanza por la ruta más corta hasta el destino.
  - Los acompañantes le siguen automáticamente colocándose a su espalda en las casillas adyacentes libres (`gatherCells`), respetando obstáculos, muros y enemigos.
  - Si un miembro está herido/atado o no tiene camino, se queda y se notifica (`describeGroupMove`).
  - Registro del comando `/marcha` (alias `/mover-grupo`) en `commands.js`.

### 3.5. Consecuencias Diferidas de Campaña (`public/scripts/party/plot.js`)
- **Módulo conectado:** `aftermath.js`.
- **Implementación:**
  - En `playPlotScene(milestone, scene)`: al concluir una escena de la trama principal con decisiones (`result.choices`), se evalúan las consecuencias diferidas mediante `sceneFollows(milestone, result.choices)` y se agendan en la cola de sucesos del calendario mediante `scheduleFollows(...)`.
  - Creación de helpers:
    - `recordDialogueAftermath(dialogue, optionId, outcome)`: para decisiones en charlas libres con NPCs que tengan efectos diferidos.
    - `getPlotAftermathRows()`: expone las tarjetas de consecuencias diferidas del paquete activo vía `laterRows`.
    - `validatePackAftermath(pack)`: valida sintaxis y coherencia de consecuencias mediante `checkLaters`.

---

## 4. Verificación y Resultados

### 4.1. Verificación de Cableado (`tools/check-engine-wiring.mjs`)
Ejecución final de la herramienta:
```text
Engine modules: 334
Reached by the running game: 330
Used by the tools only (not the game): 4
  public/scripts/game-engine/board/draw-light.js
  public/scripts/game-engine/campaign/guion-errors.js
  public/scripts/game-engine/ui/app-mode.js
  public/scripts/game-engine/ui/motion.js

Every engine module is reachable from the running game.
```
- **Módulos no alcanzados:** 0.
- **Resultado:** 100% de los módulos del motor están conectados a la aplicación.

### 4.2. Verificación de Calidad de Código (ESLint)
Se ejecutó ESLint sobre todos los módulos modificados (`board.js`, `plot.js`, `commands.js`, `companions.js`, `hub.js`, `magic.js`, `travel.js`, `talk.js`):
- **Código de salida:** `0`.
- **Errores:** 0.
- **Avisos:** 0.

### 4.3. Verificación de Pruebas Unitarias
Se validaron los módulos con las suites de Jest existentes (ej. `game-engine-group-move.test.js`, con 15 pruebas pasadas limpiamente).

---

## 5. Nota de la comprobación (2026-09-30)

«Alcanzado» quiere decir que el juego **carga** el módulo, no que el jugador lo **use**. La comprobación encontró esto:

- **Arreglado:** el juego no arrancaba. `party/companions.js` y `party/hub.js` importaban nombres que no existen, y `hub.js`, `magic.js`, `commands.js` y `town-scene.js` pasaban datos con otra forma. Ahora arranca y las pruebas pasan.
- **En juego de verdad:** las salas del gremio con botones (cofre, casa, entrenamiento, encargos, personajes, memoria), el grupo que se mueve junto en el tablero y las consecuencias diferidas de las escenas del hilo y de las charlas.
- **Cargado pero sin usar** (solo se reexporta, nadie lo llama): las frases de camino (`roadLine`), las noches de acampada (`nightFor`, y con ellas `pair-talks` y `cast-scenes`), las opiniones de los compañeros en los diálogos (`opinionBadges`) y las misiones personales (`questForCompanion`).
- **Solo con comando:** la magia fuera de combate (`/magia`) y la formación (`/marcha`). En la partida sin conexión no hay caja de texto, así que el jugador no llega a ellas: les falta un botón.
