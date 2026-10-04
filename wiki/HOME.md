---
title: SillyTavern RPG Engine - Wiki Central & Hub de Conocimiento
tags: [home, wiki, moc, silleytavern, rpg, dnd, obsidian, ai-agent, index]
created: 2026-09-20
updated: 2026-10-02
author: DanielJHesseling / Antigravity AI / Claude Opus 5.5
---

# 🏰 SillyTavern RPG Engine - Hub Central de Conocimiento

Bienvenido a la **Wiki de SillyTavern & Motor RPG** (`my-silly`, el fork de DanielJHesseling). Está hecha para **Obsidian** y para que tanto personas como agentes de IA puedan entender, navegar y ampliar el proyecto.

> [!IMPORTANT]
> **Por dónde se empieza**, según a qué vengas:
>
> | Vengo a… | Abre |
> | :--- | :--- |
> | **Jugar** | [[EMPEZAR_UNA_CAMPANA]] |
> | **Aprender a hacer algo, paso a paso** | **[[Tutoriales]]**: jugar, el móvil, crear campañas con los Gems, el guion en Word y las herramientas |
> | **Saber qué le falta al juego** | **[[LO_QUE_FALTA]]**: lo que falta fuera del plan, puesto al día el 2026-09-29, con el orden recomendado |
> | **Ver el plan de ahora** | **[[ROADMAP_SIN_CONEXION]]**: el juego entero sin IA, con gremio, campañas y amigos (J0–J18) |
> | **Ver lo último que se construyó** | La tabla «Cómo va» de [[ROADMAP_SIN_CONEXION]], y la A17 de [[POR_HACER]] |
> | **Coger una tarea** | [[POR_HACER]], el marcador |
> | **Entender por qué el juego es así** | [[ROADMAP_MAESTRO]] (el porqué) y [[ROADMAP]] (el acta de las fases A–H), los dos en `archivo/` |
> | **Escribir un mundo** | [[GEM_GUIONISTA]] y [[GEM_CREAR_CAMPANA]] |
> | **Mejorar cómo se ve** | [[GEM_DIRECTOR_UX]] |
> | **Encontrar un archivo** | [[Mapa-Codigo-Archivos]] |
>
> **La regla de la casa**: un marcador ([[POR_HACER]]), un plan vivo y un documento de lo que falta. Un plan que se cierra pasa a `archivo/` el mismo día, y lo que le quede, a [[LO_QUE_FALTA]].

> [!TIP]
> **Modo Obsidian**: la wiki usa enlaces `[[...]]`, que se resuelven por nombre aunque el documento esté en `archivo/`. La **Vista de Grafo** enseña cómo se enganchan el backend, el frontend y el motor de rol.

---

## 🗺️ Mapa de Contenido (MOC)

```mermaid
mindmap
  root((SillyTavern RPG))
    Jugar
      [[EMPEZAR_UNA_CAMPANA]]
    Tutoriales
      [[Tutoriales]]
      [[GEM_COMO_HACER_CAMPANA]]
      [[TUTORIAL_GUION_WORD]]
      [[SERVIDOR_PRIVADO]]
    Lo que falta y lo que se hace
      [[ROADMAP_SIN_CONEXION]]
      [[LO_QUE_FALTA]]
      [[POR_HACER]]
    El porqué en el archivo
      [[ROADMAP_MAESTRO]]
      [[ROADMAP]]
    Escribir mundos
      [[GEM_GUIONISTA]]
      [[GEM_CREAR_CAMPANA]]
      [[ROADMAP_COMPENDIO]]
      [[ALGORITMOS_GENERACION]]
    Arquitectura
      [[Arquitectura-General]]
      [[Backend-Express]]
      [[Frontend-Estructura]]
      [[Almacenamiento-Persistencia]]
      [[Ciclo-De-Vida-Prompt]]
    Subsistemas Core
      [[Conectores-IA]]
      [[WorldInfo-Lorebooks]]
      [[SlashCommands-Macros]]
      [[Extensiones-Plugins]]
      [[Seguridad-Autenticacion]]
    Motor RPG D&D
      [[Sistema-Party]]
      [[DND-Mecanicas-Items]]
      [[Dynamic-Context-Manager]]
      [[Campanas-Mapas-Tableros]]
      [[World-Content-Popups]]
      [[Relaciones-Memorias]]
      [[Chat-Enhancements]]
    Guías & Referencia
      [[Mapa-Codigo-Archivos]]
      [[Guia-Desarrollo-Flujo]]
```

---

## 📚 Índice Temático de Documentos

### 1. 🏛️ Arquitectura & Fundamentos del Sistema
Cómo está construido el servidor Node.js y el cliente web (sobre todo, lo que viene de upstream):
- [[Arquitectura-General]]: Visión de alto nivel del sistema, modelos de ejecución (local, Electron, Docker, multiusuario) y ciclo de vida global.
- [[Backend-Express]]: Desglose del servidor Express en `src/`, jerarquía de middlewares, más de 40 routers REST y motor RAG.
- [[Frontend-Estructura]]: Estructura de `public/`, index.html monolítico, script.js y orquestación del DOM en jQuery/Vanilla.
- [[Almacenamiento-Persistencia]]: Esquema del sistema de archivos en `data/`, tarjetas de personaje PNG con chunks tEXt/iTXt y chats JSONL.
- [[Ciclo-De-Vida-Prompt]]: Pipeline de 8 fases desde la entrada del usuario hasta la respuesta transmitida vía Server-Sent Events (SSE).

### 2. 🧠 Subsistemas Centrales de SillyTavern
Capacidades base que sustentan la interacción con modelos de lenguaje:
- [[Conectores-IA]]: Catálogo de proveedores (OpenAI, Claude, Gemini, Kobold, OpenRouter, Ollama), samplers y tokenizadores WASM.
- [[WorldInfo-Lorebooks]]: Libros del mundo, claves primarias/secundarias, lógica booleana, escaneo recursivo e inyección por profundidad.
- [[SlashCommands-Macros]]: Motor de comandos de barra `/`, tipos de argumentos, cierres (closures) y sustitución de macros `{{...}}`.
- [[Extensiones-Plugins]]: Diferencias entre extensiones de navegador y plugins de servidor; justificación de la integración del RPG en el núcleo.
- [[Seguridad-Autenticacion]]: Aislamiento multi-usuario, Scrypt, CSRF-Sync, listas blancas de IP y vectores de riesgo identificados.

### 3. ⚔️ Motor RPG & Campañas (el fork)
El juego de rol añadido en la rama `my-silly`: **255 módulos en `game-engine/` (unas 56.000 líneas)**, cableados desde `party/` (42 módulos, 24.000 líneas; `party.js` es su fachada), con 3.468 pruebas unitarias y cuatro vueltas en el navegador.
- [[Sistema-Party]]: Gestión del grupo (`party/`), líder activo, sincronización de HP/XP/Oro, leveling automático y dados.
- [[DND-Mecanicas-Items]]: Fórmulas D&D 5e (`dnd-system.js`), modificadores, AC por tipo de armadura, ranuras anatómicas y pesos.
- [[Dynamic-Context-Manager]]: El prompt por bloques y su presupuesto de tokens.
- [[Campanas-Mapas-Tableros]]: Visualizador zoomable de mapas, planos de ciudades, tableros tácticos con cuadrícula, tokens y niebla de guerra.
- [[World-Content-Popups]]: Formularios modales visuales para crear monstruos, objetos y facciones en el Lorebook.
- [[Relaciones-Memorias]]: Escala de afinidad (-100 a +100), analizador heurístico de chat y memorias narrativas persistentes.
- [[Chat-Enhancements]]: Resaltado de términos de Lorebook con tooltips descriptivos y avatares de diálogo en línea.

### 4. 🧭 Lo que falta, lo que se hace y el porqué
- **[[LO_QUE_FALTA]]** 🔭 **Lo que falta fuera del plan (puesto al día el 2026-09-29).** La radiografía en números, lo que ya es fuerte, el diagnóstico en cinco frases, y lo que falta por áreas: terminar lo empezado, el tablero que pide el guion, la IA, el contenido, la primera hora y lo técnico. Dice adónde fue lo que les quedaba a los roadmaps archivados, el orden recomendado, lo que descartaste (para que nadie lo vuelva a proponer) y lo hecho desde el análisis.
- **[[POR_HACER]]** 📋 **El marcador**, dividido por quién tiene que actuar: A (se hace), D (decides tú) y P (propuestas). Con la deuda conocida y una prueba manual de cinco minutos.
- **[[ROADMAP_SIN_CONEXION]]** 🏰 **Jugar sin conexión: tu gremio, tus campañas, tus amigos (2026-09-28). El plan de ahora.** El juego entero sin IA, desde un botón «Jugar sin conexión» en la portada:
  - creas tu personaje (nombre, especie y clase) y juegas un prólogo;
  - el gremio es vuestra base, y desde su tablón se empiezan **campañas** que llegan en un JSON (como *Curse of Strahd*);
  - el grupo va de una a otra con lo ganado;
  - se juega **con amigos**, cada uno desde su PC, en tu servidor privado.

  Parte de un repaso del código. Desde el 2026-09-29, también **la cara del juego** (J18): elegir personaje, crearlo en su pantalla y la historia contada como una novela visual.

  Trae diez decisiones (D-J1 a D-J10; quedan el nombre del juego y jugar con amigos, aparcado), diecinueve fases (J0–J18), seis hitos jugables (M1–M6) y un marcador.
- **[[ROADMAP_APK_ANDROID]]** 📱 **Dnd Master como APK de Android (2026-10-03).** El juego dentro de una app que juegas en el móvil sin PC, sin servidor y sin internet: un «servidor de bolsillo» guarda en el teléfono, con copias de seguridad en un archivo. Fases A0–A9, al 0 %; empieza cuando acabe [[ROADMAP_ENTRETENIDO]].
- **[[ROADMAP_MUNDO_SEMIABIERTO_STRAHD]]** 🗺️ **El mundo semiabierto, construido con Strahd (2026-10-04).** Barovia entera (de la Casa de la Muerte a Ravenloft, con el Templo de Ámbar, Tsolenka y la lectura de Tarokka) hecha a la vez que un motor y un editor de mundos semiabiertos que sirvan para otras campañas grandes. Fases S0–S11, al 0 %; empieza cuando acabe [[ROADMAP_APK_ANDROID]].
- Los planes anteriores (el acta de las fases A–H, el maestro, el pegamento, la profundidad, sin tokens y el compendio) están cerrados y en el archivo (sección 6).

### 5. ✍️ Escribir mundos
- **[[GEM_GUIONISTA]]** 🎬 **Las instrucciones del Gem que escribe la biblia de un mundo por rondas.** Sabe de áreas, elementos, terreno, el grimorio y los héroes hechos. `tools/guion-a-paquete.mjs` lo convierte en paquete y avisa de lo que no lee.
- **[[GEM_DIRECTOR_UX]]** 🎨 **Las instrucciones del Gem director de UX/UI.** Mira capturas del juego, propone cómo mejorar lo que se ve y entrega un mockup en HTML más un «Encargo para Claude» con criterios que se comprueban en el navegador. Conoce la paleta, las clases y las restricciones del juego (sin arte, solo CSS, iconos y emoji).
- **[[GEM_CREAR_CAMPANA]]** 📦 **Las instrucciones del Gem que escribe campañas**, generadas desde el motor (`node tools/gem-instructions.mjs`): el contrato completo, las reglas que un esquema no puede expresar y una muestra correcta.
- **[[ROADMAP_COMPENDIO]]** 📚 *(archivo)* **La biblioteca de contenido.** Un JSON por dominio en `public/compendio/` —armas, habilidades, bichos, gente, nombres, sitios— del que tiran los generadores con la semilla. Dice qué campos lleva cada fila.
- **[[ALGORITMOS_GENERACION]]** 🎲 **200 ideas para que dos partidas del mismo texto no se parezcan.** Todo sin IA. La regla que las ordena: **la semilla no es el texto**.
- `guiones/1387/`: las doce rondas del guion de 1387 y sus dudas.
- `campanas/strahd/`: *La Maldición de Strahd* en tres capas (tu JSON, lo sacado del libro y las mejoras); `node tools/campana-a-paquete.mjs strahd` las junta en un paquete.
- `maquetas/`: las maquetas del Gem de UX para la cara del juego (J18).

### 6. 🗄️ Archivo: planes cerrados
En `wiki/archivo/`. Están hechos o minados, pero el código los cita en sus comentarios como el porqué de lo que existe, así que no se borran. Lo que les quedaba pendiente está en [[LO_QUE_FALTA]], sección 10:
- [[ROADMAP_SIN_TOKENS]]: jugar sin gastar tokens (Z0–Z8, 2026-09-27). Lo que quedaba siguió en [[ROADMAP_SIN_CONEXION]].
- [[ROADMAP_PROFUNDIDAD]]: modos, taller en pestañas, habilidades, magia en código, mascota, tableros con intención, enemigos, compañeros y mundo (R1–R10, 2026-09-26).
- [[ROADMAP_PEGAMENTO]]: que lo construido se hable entre sí: un narrador, un estado, un reloj, una crónica, la mesa, el duelo y los casos (U0–U8, 2026-09-25).
- [[ROADMAP_MAESTRO]]: el porqué. «¿Por qué querrías jugar mañana?», los cuatro relojes y los seis niveles.
- [[ROADMAP]]: el acta de las fases A–H, con *El Principio que Ordena Todo* y *De Dónde Sale el Gasto*.
- [[ROADMAP_COMPENDIO]]: las doce baterías del compendio, con los campos de cada fila.
- [[ROADMAP_MUNDOS_VIVOS]]: las localidades con servicios, los mundos precreados y las ocho baterías de ideas, con su detalle en «Hecho». Aquí se explican los números de idea que citan los comentarios del código.
- [[ROADMAP_CREACION]]: el taller de campañas en trece pasos (lo retomó R2).
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]]: de un libro a una campaña jugable (Fase G).
- [[ROADMAP_JUEGO_SIN_COMANDOS]]: jugar con el ratón.
- [[PROPUESTA_FRONTEND_MODO_JUEGO]]: el Modo Videojuego (Fase H).
- [[PLAN_CREAR_CAMPANA]]: `/campana`, el editor por categorías.
- [[PROPUESTAS_BUCLE_DE_JUEGO]]: el análisis del bucle del que salió el pegamento.
- [[PROPUESTAS_MEJORA]] y [[PROPUESTAS_MEJORA_V2]]: los dos catálogos de 200 propuestas (`N-xx`, `PROP-xxx`, `PROP2-xxx`).

### 7. 🛠️ Guías de Desarrollo & Referencia Rápida
- [[Mapa-Codigo-Archivos]]: Inventario archivo por archivo que distingue el código base de los componentes del fork, con `game-engine/`, `party/` y `tools/`.
- [[Guia-Desarrollo-Flujo]]: Manual para arrancar, depurar, extender clases, crear nuevos comandos y aplicar buenas prácticas.

---

## ⚡ Guía de Navegación Rápida para Agentes de IA

Si eres un agente de IA interactuando con este repositorio, sigue estas directrices para resolver tareas comunes:

| Si tu tarea es... | Consulta primero... | Archivo clave en el código |
| :--- | :--- | :--- |
| Decidir en qué trabajar a continuación | [[ROADMAP_SIN_CONEXION]] §4 (el orden y los hitos), [[LO_QUE_FALTA]] §12 y [[POR_HACER]] | — |
| Tocar el gremio y sus campañas | [[ROADMAP_SIN_CONEXION]] y [[EMPEZAR_UNA_CAMPANA]] (1b) | `game-engine/campaign/hub.js` · `campaigns.js` · `node tools/e2e-gremio.mjs` |
| Convertir una campaña en JSON (como Strahd) | [[ROADMAP_SIN_CONEXION]] J5 | `wiki/campanas/` · `node tools/campana-a-paquete.mjs strahd` |
| Modificar la ficha de personaje D&D o el inventario | [[Sistema-Party]] y [[DND-Mecanicas-Items]] | `public/scripts/party/sheet.js` & `dnd-system.js` |
| Añadir o cambiar lo que se envía al modelo | [[Dynamic-Context-Manager]] | `dynamic-context-manager.js` · comprueba con `node tools/check-prompt-shape.mjs` |
| Intervenir en los mapas, cuadrícula o tokens | [[Campanas-Mapas-Tableros]] | `public/scripts/world-map-renderer.js` · `game-engine/board/` |
| Tocar los tableros generados | [[ROADMAP_PROFUNDIDAD]] R6 (archivo) | `game-engine/world-builder/board-intent.js` y `dungeon-generator.js` |
| Añadir un conjuro | [[ROADMAP_PROFUNDIDAD]] R4 (archivo) | `game-engine/rules/grimoire.js`: **solo en código**; los datos solo ajustan números |
| Añadir nuevos comandos de barra `/` | [[SlashCommands-Macros]] | `public/scripts/slash-commands.js` |
| Añadir una clave nueva a la partida | [[ROADMAP_PEGAMENTO]] U2 (archivo) | `game-engine/campaign/state-registry.js` · `node tools/check-state-keys.mjs` |
| Añadir tipos de arma, daño o condiciones | [[ROADMAP]] Fase C (archivo) | **`/rules`** en el chat. El origen está en `game-engine/rules/default-ruleset.js` |
| Saber qué se envía al modelo y qué cuesta | [[ROADMAP]] §1 y T3 (archivo) | **`/prompt`** en el chat |
| Crear un mundo con IA | [[ROADMAP]] Fase F (archivo) | *Nueva campaña* → *Generar con IA* · `game-engine/world-builder/world-schema.js` |
| Cambiar cómo se empieza una campaña | [[ROADMAP_PROFUNDIDAD]] R1 y R2 (archivo) | `game-engine/ui/taller/taller.js`, `game-engine/campaign/taller.js`, `campaigns.js` |
| Probar el tablero o el combate sin montar una campaña | [[POR_HACER]] *Probarlo a mano* | `/sandbox` → `game-engine/ui/sandbox.js` |
| **Empezar a jugar, de cero** | **[[EMPEZAR_UNA_CAMPANA]]** | Las tres puertas, el taller, la primera sesión y los comandos |
| Jugar en Modo Videojuego, a pantalla completa | [[PROPUESTA_FRONTEND_MODO_JUEGO]] (archivo) | **`/modojuego`** en el chat → `game-engine/ui/shell/` |
| Meter un libro de campaña y jugarlo | [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] (archivo) | **`/esquema-campana`** para el contrato → *Nueva campaña* → *Importar un libro* |
| Integrar cambios de upstream sin romper el fork | [[Guia-Desarrollo-Flujo]] §2 | `.vscode/settings.json` & `public/index.html` |
| Entender cómo se inyectan los datos al LLM | [[Ciclo-De-Vida-Prompt]] | `public/script.js` |
| Localizar un archivo en el proyecto | [[Mapa-Codigo-Archivos]] | Índice del repositorio |
| Saber si algo está conectado al juego o solo probado | [[POR_HACER]] | `node tools/check-engine-wiring.mjs` |
| Comprobar que el juego sigue jugándose de principio a fin | [[POR_HACER]] *Probarlo a mano* | `node tools/e2e-todo.mjs --rapido` (unos 4 min: tests, empezar en 1387, una partida sin modelo y el gremio, a la vez) · `node tools/e2e-todo.mjs` (unos 15 min: además, la vuelta entera en dos mitades a la vez) |

---

## 🚀 Comandos de Terminal Más Frecuentes

```bash
# Iniciar el servidor localmente en http://localhost:8000
npm start

# Iniciar con inspector de depuración de Node.js
npm run debug

# Las comprobaciones del fork
node tools/check-fork-types.mjs
node tools/check-engine-wiring.mjs
node tools/check-prompt-shape.mjs
node tools/check-state-keys.mjs
node tools/gem-instructions.mjs --check
npm run test:unit --prefix tests
```

> [!IMPORTANT]
> Antes de cambiar la estructura de `chat_metadata`, revisa [[Almacenamiento-Persistencia]] y registra la clave en `state-registry.js`: el comprobador de claves falla si una clave nueva no está registrada.
