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

### 2.1. El motor de juego — `public/scripts/game-engine/` (19 archivos, 4.884 líneas)

Módulos puros: sin DOM, sin estado global, sin lecturas del chat. Por eso se prueban en Node y por eso el coste de merge es cero. Los marcados ⬜ están escritos y probados pero **el juego todavía no los carga**; compruébalo con `node tools/check-engine-wiring.mjs`.

| Archivo | Líneas | Función | En el juego |
| :--- | ---: | :--- | :---: |
| `board/terrain.js` | 343 | Muros, cobertura, terreno difícil y puertas. Almacenamiento disperso | ✅ |
| `board/pathfinding.js` | 262 | A*, celdas alcanzables y coste de ruta | ✅ |
| `board/fog-of-war.js` | 189 | Niebla de 3 estados; solo se persiste lo explorado | ✅ |
| `board/line-of-sight.js` | 166 | Visión simétrica con Bresenham canonizado | ✅ |
| `combat/enemy-ai.js` | 447 | Cuatro perfiles tácticos. Devuelve un plan, no lo ejecuta | ✅ |
| `combat/turn-machine.js` | 308 | Iniciativa, rondas y economía de acciones | ⬜ |
| `combat/roll-guard.js` | 163 | Corrige tiradas inventadas por el modelo | ✅ |
| `campaign/scenarios.js` | 307 | Siete tipos de objetivo de escenario | ⬜ |
| `campaign/bonds.js` | 298 | Vínculos 1–10 por eventos registrados, y sus perks | ⬜ |
| `campaign/campaign-map.js` | 275 | Salas, puertas y desbloqueo de localizaciones | ⬜ |
| `campaign/starter-templates.js` | 253 | Las 4 plantillas del asistente, como datos | ✅ |
| `campaign/calendar.js` | 195 | Días y bloques de tiempo estilo Persona | ⬜ |
| `campaign/campaign-worlds.js` | 77 | Qué es una campaña, dónde empieza, nombres libres | ✅ |
| `rules/ruleset.js` | 307 | Validación, fusión, migración y exportación de paquetes | ✅ |
| `rules/default-ruleset.js` | 251 | Las 25 tablas D&D, fuera del código | ✅ |
| `ui/sandbox.js` | 353 | Banco de pruebas de combate (`/sandbox`) | ✅ |
| `ui/combat-log.js` | 293 | Registro de combate y prompt del epílogo | ✅ |
| `ui/campaign-wizard.js` | 245 | El asistente de 3 pasos y `createCampaign` | ✅ |
| `ui/chat-channel.js` | 86 | Decide si un mensaje lo lee solo el jugador o también el modelo | ✅ |

### 2.2. El subsistema de grupo — `public/scripts/party/` (5 archivos, 544 líneas)

Extraído de `party.js` por las costuras que los tests ya cubrían.

| Archivo | Líneas | Función |
| :--- | ---: | :--- |
| `combat-rules.js` | 218 | Dados, distancias, fórmulas de daño y cobertura |
| `item-forms.js` | 183 | Formularios de objetos |
| `positions.js` | 65 | De dónde sale la casilla de cada miembro |
| `types.js` | 52 | Tipos compartidos |
| `html.js` | 26 | Escape HTML sin dependencias (copia intencional, con test) |

### 2.3. Archivos del fork que siguen siendo grandes

| Archivo | Líneas | Función Principal |
| :--- | ---: | :--- |
| `public/scripts/party.js` | 4.810 | Grupo, ficha D&D, combate real, comandos y tablero. **Sigue creciendo**: la integración del motor se hizo dentro |
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
| `public/css/campaign-wizard.css` | 131 | Asistente de campaña y tarjetas sin empezar |

### 2.6. Herramientas — `tools/`

| Archivo | Para qué |
| :--- | :--- |
| `check-fork-types.mjs` | Gate de tipos sobre los 33 archivos propios. Falla si aparece un error |
| `check-engine-wiring.mjs` | Lista los módulos del motor que el juego no carga. Informa, no falla |
| `e2e-campaign.mjs` | Recorre el juego en un navegador real, con servidor y datos propios |

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
