---
title: Mapa Completo del Código & Estructura de Archivos
tags: [codigo, estructura, mapa, directorios, backend, frontend, fork, dnd]
created: 2026-09-20
updated: 2026-09-21
author: DanielJHesseling / Antigravity AI
---

# Mapa Completo del Código & Estructura de Archivos

Este documento sirve como inventario exhaustivo del repositorio, clasificando los archivos y carpetas clave entre los componentes base de SillyTavern y las extensiones introducidas en el fork de DanielJHesseling.

---

## 1. Directorios Principales del Repositorio

| Directorio | Propósito & Contenido | Origen |
| :--- | :--- | :--- |
| `src/` | Código fuente del servidor Node.js (Express, routers, middleware, utilidades). | SillyTavern Core |
| `src/endpoints/` | Más de 40 routers REST modulares para personajes, chats, IA y configuración. | SillyTavern Core |
| `src/middleware/` | Filtros HTTP: protección CSRF, whitelist de IP, host headers, auth. | SillyTavern Core |
| `src/vectors/` | Motor RAG vectorial local basado en Vectra y transformers.js. | SillyTavern Core |
| `src/png/` | Extractor e inyector de metadatos en chunks tEXt/iTXt de imágenes PNG. | SillyTavern Core |
| `public/` | Código fuente del cliente web servido al navegador (HTML, CSS, JS, libs). | SillyTavern Core + Fork |
| `public/scripts/` | Módulos ES de lógica de frontend (más de 80 archivos). | SillyTavern Core + Fork |
| `public/scripts/game-engine/` | **Motor de juego del fork**: tablero, combate, campaña, reglas e interfaz. Módulos puros, probados en Node. | Fork |
| `public/scripts/party/` | Piezas extraídas de `party.js` por las costuras que los tests cubren. | Fork |
| `tools/` | Comprobaciones propias: tipos, cableado del motor y recorrido del juego en navegador. | Fork |
| `public/css/` | Hojas de estilo CSS del cliente. | SillyTavern Core + Fork |
| `public/lib/` | Bibliotecas de terceros (jQuery, jQuery UI, Select2, Toastr, etc.). | SillyTavern Core |
| `data/` | Directorio de almacenamiento de datos persistentes por usuario. | Generado en runtime |
| `default/` | Plantillas de configuración y assets por defecto (`config.yaml`). | SillyTavern Core |
| `plugins/` | Directorio para plugins de servidor adicionales en Node.js. | SillyTavern Core |
| `tests/` | Suite de pruebas automatizadas (Jest y Playwright). | SillyTavern Core |
| `docker/` | Archivos de configuración para despliegues con Docker y Docker Compose. | SillyTavern Core |
| `wiki/` | Esta base de conocimiento para Obsidian y agentes de IA. | Documentación |

---

## 2. Inventario de Archivos Clave del Motor RPG (Fork `my-silly`)

> [!NOTE]
> **Cifras medidas el 2026-09-21.** El motor de juego vive desde entonces en dos carpetas nuevas, `game-engine/` y `party/`, que esta página no recogía. El criterio que las ordena está en [[Guia-Desarrollo-Flujo]] §2: código nuevo va en archivo nuevo, para que un merge con upstream no lo toque nunca.

### 2.1. El motor de juego — `public/scripts/game-engine/` (50 archivos, 12.516 líneas)

Módulos puros: sin DOM, sin estado global, sin lecturas del chat. Por eso se prueban en Node y por eso el coste de merge es cero. Los marcados ⬜ están escritos y probados pero **el juego todavía no los carga**; compruébalo con `node tools/check-engine-wiring.mjs`.

| Archivo | Líneas | Función | En el juego |
| :--- | ---: | :--- | :---: |
| `board/terrain.js` | 343 | Muros, cobertura, terreno difícil y puertas. Almacenamiento disperso | ✅ |
| `board/pathfinding.js` | 262 | A*, celdas alcanzables y coste de ruta | ✅ |
| `board/reachability.js` | 160 | ¿Se puede llegar? La inundación que caza una sala amurallada (PROP2-039) | ✅ |
| `board/fog-of-war.js` | 189 | Niebla de 3 estados; solo se persiste lo explorado | ✅ |
| `board/line-of-sight.js` | 166 | Visión simétrica con Bresenham canonizado | ✅ |
| `combat/enemy-ai.js` | 447 | Cuatro perfiles tácticos. Devuelve un plan, no lo ejecuta | ✅ |
| `combat/turn-machine.js` | 308 | Iniciativa, rondas y economía de acciones | ⬜ |
| `combat/roll-guard.js` | 163 | Corrige tiradas inventadas por el modelo | ✅ |
| `campaign/scenarios.js` | 307 | Siete tipos de objetivo de escenario | ⬜ |
| `campaign/bonds.js` | 298 | Vínculos 1–10 por eventos registrados, y sus perks | ⬜ |
| `campaign/campaign-map.js` | 403 | Salas deducidas del mapa, puertas que revelan, y localizaciones que se desbloquean | ✅ |
| `campaign/starter-templates.js` | 253 | Las 4 plantillas del asistente, como datos | ✅ |
| `campaign/calendar.js` | 195 | Días y bloques de tiempo estilo Persona | ⬜ |
| `campaign/campaign-worlds.js` | 77 | Qué es una campaña, dónde empieza, nombres libres | ✅ |
| `rules/ruleset.js` | 307 | Validación, fusión, migración y exportación de paquetes | ✅ |
| `rules/level-up.js` | 300 | Qué da subir de nivel, con la tabla en el paquete de reglas (A1) | ✅ |
| `rules/abilities.js` | 354 | Conjuros, técnicas y recursos de clase, como datos editables (D5) | ✅ |
| `rules/death-saves.js` | 174 | Los tres éxitos contra los tres fallos, a 0 PG (PROP2-059) | ✅ |
| `rules/default-ruleset.js` | 251 | Las 25 tablas D&D, fuera del código | ✅ |
| `ui/sandbox.js` | 353 | Banco de pruebas de combate (`/sandbox`) | ✅ |
| `ui/combat-log.js` | 293 | Registro de combate y prompt del epílogo | ✅ |
| `ui/campaign-wizard.js` | 245 | El asistente de 3 pasos y `createCampaign` | ✅ |
| `ui/chat-channel.js` | 86 | Decide si un mensaje lo lee solo el jugador o también el modelo | ✅ |
| `world-builder/world-schema.js` | 334 | Genera un mundo con IA: esquema, prompt y reparación de lo que vuelva | ✅ |
| `rules/editor-model.js` | 318 | Traduce el paquete de reglas a filas editables, y de vuelta | ✅ |
| `ui/rules-editor.js` | 297 | El editor visual de reglas (`/rules`), con importar y exportar | ✅ |
| `cost/prompt-meter.js` | 239 | Desglosa lo que se envía cada turno y acumula el gasto | ✅ |
| `ui/prompt-preview.js` | 179 | El panel de `/prompt` | ✅ |
| `campaign/campaign-pack-schema.js` | 573 | El contrato del paquete de campaña, generado desde el motor | ✅ |
| `campaign/campaign-pack.js` | 538 | Si un paquete se sostiene: errores, avisos y lo que se reparó | ✅ |
| `campaign/campaign-export.js` | 349 | El camino de vuelta: empaquetar tu campaña para mandarla (A2) | ✅ |
| `campaign/checkpoint.js` | 141 | Puntos de retorno, y uno automático antes de cada jefe (PROP2-163) | ✅ |
| `campaign/campaign-importer.js` | 508 | Del paquete a mundo, entradas, tableros y misiones; los ids, al final | ✅ |
| `campaign/narrator.js` | 158 | Quién narra la campaña y con qué voz: la ficha que sí llega al prompt (A10) | ✅ |
| `campaign/campaign-delete.js` | 114 | Qué se va al borrar una campaña, y qué se dice antes de tocar nada (A9) | ✅ |
| `campaign/campaign-editor.js` | 750 | Escribir una campaña a mano: lee el mundo, lo valida y dice qué fichas tocar (M1–M6) | ✅ |
| `ui/campaign-editor.js` | 852 | El panel de `/campana`: siete pestañas, una por categoría | ✅ |
| `combat/spawn.js` | 95 | Dónde aparecen los enemigos: donde los dibujó el libro, nunca en un muro | ✅ |
| `rules/rest.js` | 216 | Descanso corto y largo, con dados de golpe | ✅ |
| `rules/injuries.js` | 286 | Lo que un combate deja encima: heridas que curan y cicatrices que no (N2) | ✅ |
| `rules/mortality.js` | 152 | Quién muere y quién queda marcado, y cuándo se puede guardar (N2) | ✅ |
| `rules/upkeep.js` | 247 | La cuenta de la semana: comer, cobrar, dormir bajo techo (N2) | ✅ |
| `world-builder/dungeon-generator.js` | 253 | Un sitio donde pelear, con una semilla y cero tokens (N3) | ✅ |
| `campaign/contracts.js` | 250 | El tablón de encargos: rangos, plazos y la temática como pesos (N4) | ✅ |
| `campaign/guild.js` | 246 | Plantilla, lealtad, edificios y reputación (N4) | ✅ |
| `rules/companions.js` | 247 | Por qué van contigo, por qué no, y quién se lleva solo (N5) | ✅ |
| `ui/guild-panel.js` | 157 | El panel de `/gremio`: tablón, casa y compañía | ✅ |
| `combat/loot-items.js` | 120 | Qué es cada cosa que sueltan los enemigos, para que se pueda usar | ✅ |
| `combat/combat-hold.js` | 53 | Las puertas que un combate cierra mientras dura, y por qué (A8) | ✅ |
| `combat/seeded-random.js` | 97 | Dados que se pueden repetir: una partida dos veces igual | ✅ |
| `combat/target-card.js` | 94 | Qué dice la tarjeta de un enemigo y qué botones ofrece | ✅ |
| `combat/condition-timers.js` | 119 | Las condiciones con duración, que se van solas al pasar la ronda (D5) | ✅ |
| `combat/opportunity.js` | 110 | Escaparse cuesta un golpe: por eso importa la posición (PROP2-053) | ✅ |
| `ui/contradiction-log.js` | 223 | Lo que la narración dijo y el motor no confirma | ✅ |
| `campaign/encounter-editor.js` | 117 | Qué enemigos puede sacar un tablero, como filas | ✅ |
| `ui/encounter-editor.js` | 119 | El panel de `/enemigos` | ✅ |
| `rules/rule-impact.js` | 157 | Qué referencias rompería un cambio de reglas | ✅ |
| `cost/prompt-order.js` | 184 | El orden de los bloques del prompt: de lo que nunca cambia a lo que cambia siempre | ✅ |
| `campaign/objective-editor.js` | 351 | Objetivos como filas editables, y pedírselos a un modelo | ✅ |
| `ui/objective-editor.js` | 203 | El panel de `/objetivos editar` | ✅ |
| `ui/audio-settings.js` | 102 | El panel de `/sonido`: una pista por escena (A3) | ✅ |
| `ui/abilities-panel.js` | 225 | El panel de `/habilidades`: escribir un conjuro y repartirlo (D5) | ✅ |
| `combat/initiative-tracker.js` | 242 | Quién actúa, quién sigue y qué le pasa | ✅ |
| `combat/loot.js` | 183 | Botín y experiencia por CR, repartidos entre los que siguen en pie | ✅ |
| `ui/shell/game-shell.js` | 732 | La capa a pantalla completa: mueve el tablero y el chat, y los devuelve | ✅ |
| `ui/shell/scene-director.js` | 282 | Qué pantalla toca, y qué la cambia: lee el motor, nunca al modelo | ✅ |
| `ui/shell/dialogue-scene.js` | 115 | Quién habla en la escena de diálogo | ✅ |
| `ui/shell/exploration-scene.js` | 145 | Dónde estás, qué hay abierto y qué le falta a lo cerrado | ✅ |
| `ui/shell/party-strip.js` | 66 | La franja del grupo: vida, estados y rango, para dos escenas | ✅ |
| `ui/shell/clock-widget.js` | 104 | El día, el momento y las cuatro formas de gastar tiempo (K3) | ✅ |
| `ui/shell/action-chips.js` | 143 | Qué se puede hacer sin escribirlo, sacado del estado (K4a) | ✅ |
| `ui/shell/companion-card.js` | 163 | La ficha de un compañero: vínculo, pasar tiempo y regalos (K4b) | ✅ |
| `ui/shell/scene-audio.js` | 180 | Qué suena en cada escena, con tus propias pistas (A3) | ✅ |
| `ui/campaign-panel.js` | 149 | La pestaña Campaña: el calendario y los vínculos | ✅ |
| `combat/bond-perks.js` | 114 | Las perks que cambian un combate: aguantar, rematar, dar el relevo | ✅ |
| `ui/campaign-schema-panel.js` | 111 | Las diez vistas de `/esquema-campana` | ✅ |
| `campaign/campaign-view.js` | 110 | El calendario y los vínculos como algo que dibujar | ✅ |
| `combat/scenario-board.js` | 102 | Juzga los objetivos contra el tablero y decide el combate | ✅ |

### 2.2. El subsistema de grupo — `public/scripts/party/` (6 archivos, 868 líneas)

Extraído de `party.js` por las costuras que los tests ya cubrían.

| Archivo | Líneas | Función |
| :--- | ---: | :--- |
| `campaign-state.js` | 295 | Reloj, vínculos, descansos y mapa, con sus dependencias inyectadas |
| `combat-rules.js` | 218 | Dados, distancias, fórmulas de daño y cobertura |
| `item-forms.js` | 183 | Formularios de objetos |
| `positions.js` | 65 | De dónde sale la casilla de cada miembro |
| `types.js` | 52 | Tipos compartidos |
| `html.js` | 26 | Escape HTML sin dependencias (copia intencional, con test) |

### 2.3. Archivos del fork que siguen siendo grandes

| Archivo | Líneas | Función Principal |
| :--- | ---: | :--- |
| `public/scripts/party.js` | 4.954 | Grupo, ficha D&D, combate real, comandos y tablero. **Sigue creciendo**: cada enganche nuevo se añade aquí, aunque la lógica viva fuera |
| `public/scripts/dynamic-context-manager.js` | 1.911 | Estados de campaña, presupuesto de tokens y las 8 herramientas `dnd_*` |
| `public/scripts/dnd-system.js` | 1.225 | Fórmulas D&D 5e. Lee sus tablas del paquete de reglas |
| `public/scripts/world-map-renderer.js` | 1.188 | Mapas, tableros, capas de terreno y niebla, puertas |
| `public/scripts/world-content-popups.js` | 1.110 | Formularios de monstruos, hechizos, ítems y facciones |
| `public/scripts/campaigns.js` | 905 | Tarjetas de campaña y arranque de partida |
| `public/scripts/world-content-browser.js` | 674 | Navegador de entidades del Lorebook |
| `public/scripts/chat-enhancements.js` | 661 | Términos resaltados y avatares en línea |
| `public/scripts/active-instructions.js` | 278 | Instrucciones inyectadas en el prompt |

### 2.4. Archivos de upstream que el fork modifica

Cada uno cuesta en cada merge. La lista no debería crecer.

| Archivo | Cambio |
| :--- | :--- |
| `public/scripts/world-info.js` | Mapas, tableros, monstruos y el esquema `dndData` |
| `public/script.js` | Arranque de los subsistemas RPG e inyección en el prompt |
| `public/index.html` | Marcado de modales, cajón de grupo y superposiciones |
| `public/scripts/personas.js` | Estadísticas D&D en los descriptores de persona |

### 2.5. Hojas de estilo

| Archivo | Líneas | Función |
| :--- | ---: | :--- |
| `public/css/world-map.css` | 1.520 | Zoom, cuadrícula, tokens, terreno, niebla y puertas |
| `public/css/dnd-character.css` | 1.330 | Ficha, inventario, ranuras y estados |
| `public/css/campaigns.css` | 1.304 | Tarjetas de campaña y bienvenida |
| `public/css/world-content-browser.css` | 794 | Cuadrícula de entidades y modales |
| `public/css/dynamic-context-manager.css` | 355 | Modal de reglas y barra de presupuesto |
| `public/css/combat-log.css` | 232 | Registro de combate con marco de pixel art y `/sandbox` |
| `public/css/chat-enhancements.css` | 149 | Términos resaltados y avatares en línea |
| `public/css/campaign-wizard.css` | 212 | Asistente de campaña, tarjetas sin empezar y panel de generación con IA |
| `public/css/game-shell.css` | 579 | El Modo Juego: la capa a pantalla completa y la retícula tablero/registro |
| `public/css/rules-editor.css` | 237 | El editor de reglas |
| `public/css/campaign-panel.css` | 174 | La pestaña Campaña: calendario, vínculos y perks |
| `public/css/prompt-preview.css` | 116 | El desglose de coste por turno |

### 2.6. Herramientas — `tools/`

| Archivo | Para qué |
| :--- | :--- |
| `check-fork-types.mjs` | Gate de tipos sobre los 64 archivos propios. Falla si aparece un error |
| `check-prompt-shape.mjs` | Falla si la forma del prompt cambia sin que nadie lo diga |
| `gem-instructions.mjs` | Genera `wiki/GEM_CREAR_CAMPANA.md` desde el contrato; con `--check` falla si se quedó viejo |
| `check-engine-wiring.mjs` | Lista los módulos del motor que el juego no carga. Informa, no falla |
| `e2e-campaign.mjs` | Recorre el juego en un navegador real, con servidor y datos propios. 202 comprobaciones |

---

## 3. Inventario de Archivos Clave de SillyTavern Core

| Archivo | Función Principal |
| :--- | :--- |
| `server.js` | Script de entrada raíz (`node server.js`). |
| `src/server-main.js` | Configuración de Express, middlewares globales y ciclo de vida del proceso. |
| `src/server-startup.js` | Enlace de puertos de red IPv4/IPv6 y registro de endpoints privados. |
| `src/command-line.js` | Definición de argumentos de consola (`--port`, `--ssl`, `--listen`, etc.). |
| `src/config-init.js` | Lectura de `config.yaml` y establecimiento de valores por defecto. |
| `src/users.js` | Gestión de cuentas de usuario, sesiones firmadas, Scrypt y carpetas en `data/`. |
| `src/endpoints/characters.js` | Lectura y escritura de tarjetas de personaje V2/V3 en imágenes PNG. |
| `src/endpoints/chats.js` | Operaciones CRUD de historiales de conversación en archivos JSONL. |
| `src/endpoints/worldinfo.js` | Operaciones CRUD de Lorebooks en archivos JSON. |
| `src/endpoints/secrets.js` | Gestión y ocultación de API keys en `secrets.json`. |
| `public/scripts/slash-commands.js` | Parser y ejecutor de comandos `/` de la interfaz. |
| `public/scripts/tokenizers.js` | Recuento local de tokens mediante WASM (`tiktoken`, `sentencepiece`). |
| `public/scripts/group-chats.js` | Lógica de conversaciones con múltiples personajes simultáneos. |
| `public/scripts/power-user.js` | Ajustes avanzados de interfaz y parámetros de comportamiento. |

---

## 4. Enlaces Relacionados
- [[Arquitectura-General]]: Visión de conjunto de la arquitectura.
- [[Guia-Desarrollo-Flujo]]: Instrucciones para ejecutar, depurar y programar en el proyecto.
- [[PROBLEMAS_TECNICOS]]: Diagnóstico técnico y deuda encontrada en estos archivos.
- [[PROPUESTAS_MEJORA]]: Propuestas de refactorización y desacoplamiento.
