---
title: SillyTavern RPG Engine - Wiki Central & Hub de Conocimiento
tags: [home, wiki, moc, silleytavern, rpg, dnd, obsidian, ai-agent, index]
created: 2026-09-20
updated: 2026-09-26
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
> | **Saber qué le falta al juego** | **[[LO_QUE_FALTA]]**: el análisis del 2026-09-26, con el orden recomendado |
> | **Ver lo último que se construyó** | [[ROADMAP_PROFUNDIDAD]] (R1–R10) y su tabla «Cómo va» |
> | **Coger una tarea** | [[POR_HACER]], el marcador |
> | **Entender por qué el juego es así** | [[ROADMAP_MAESTRO]] (el porqué) y [[ROADMAP]] (el acta de las fases A–H) |
> | **Escribir un mundo** | [[GEM_GUIONISTA]] y [[GEM_CREAR_CAMPANA]] |
> | **Encontrar un archivo** | [[Mapa-Codigo-Archivos]] |
>
> **La regla de la casa**: un marcador ([[POR_HACER]]), un plan vivo y un documento de lo que falta. Un plan que se cierra pasa a `archivo/` el mismo día.

> [!TIP]
> **Modo Obsidian**: la wiki usa enlaces `[[...]]`, que se resuelven por nombre aunque el documento esté en `archivo/`. La **Vista de Grafo** enseña cómo se enganchan el backend, el frontend y el motor de rol.

---

## 🗺️ Mapa de Contenido (MOC)

```mermaid
mindmap
  root((SillyTavern RPG))
    Jugar
      [[EMPEZAR_UNA_CAMPANA]]
    Lo que falta y lo que se hace
      [[LO_QUE_FALTA]]
      [[POR_HACER]]
      [[ROADMAP_PROFUNDIDAD]]
      [[ROADMAP_PEGAMENTO]]
    El porqué
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
El juego de rol añadido en la rama `my-silly`: **234 módulos en `game-engine/` (unas 50.000 líneas)**, cableados desde `party.js` (19.000 líneas), con 3.267 pruebas unitarias y un recorrido de 73 pasos en navegador.
- [[Sistema-Party]]: Gestión del grupo (`party.js`), líder activo, sincronización de HP/XP/Oro, leveling automático y dados.
- [[DND-Mecanicas-Items]]: Fórmulas D&D 5e (`dnd-system.js`), modificadores, AC por tipo de armadura, ranuras anatómicas y pesos.
- [[Dynamic-Context-Manager]]: El prompt por bloques y su presupuesto de tokens.
- [[Campanas-Mapas-Tableros]]: Visualizador zoomable de mapas, planos de ciudades, tableros tácticos con cuadrícula, tokens y niebla de guerra.
- [[World-Content-Popups]]: Formularios modales visuales para crear monstruos, objetos y facciones en el Lorebook.
- [[Relaciones-Memorias]]: Escala de afinidad (-100 a +100), analizador heurístico de chat y memorias narrativas persistentes.
- [[Chat-Enhancements]]: Resaltado de términos de Lorebook con tooltips descriptivos y avatares de diálogo en línea.

### 4. 🧭 Lo que falta, lo que se hace y el porqué
- **[[LO_QUE_FALTA]]** 🔭 **Lo que le falta al juego (2026-09-26).** El análisis del proyecto entero tras R1–R10: la radiografía en números, lo que ya es fuerte, el diagnóstico en cinco frases, y lo que falta por áreas (terminar lo empezado, el tablero que pide el guion, la IA, el contenido, la primera hora y lo técnico). Termina con el orden recomendado y la lista de lo que descartaste, para que nadie lo vuelva a proponer.
- **[[POR_HACER]]** 📋 **El marcador**, dividido por quién tiene que actuar: A (se hace), D (decides tú) y P (propuestas). Con la deuda conocida y una prueba manual de cinco minutos.
- **[[ROADMAP_PROFUNDIDAD]]** 🌳 **Profundidad: más hondo, no más ancho (2026-09-26).** Diez fases, hechas: modos de juego (Relajado, Normal, Supervivencia, a tu medida) y partida rápida con héroes hechos, el taller en pestañas, habilidades con áreas y elementos que tocan el terreno, la magia solo desde el código (un grimorio de 25 conjuros), la mascota, tableros con intención, enemigos con papel y némesis, compañeros con arco y un mundo que responde. Su tabla «Cómo va» dice lo que falta de cada fase.
- **[[ROADMAP_PEGAMENTO]]** 🧩 **El pegamento: un juego, no doscientos (2026-09-25).** Nueve fases para que lo construido se hable entre sí: un narrador, un estado, un reloj, una crónica, la Mesa de la Semana, el Duelo de Palabras, una forma de mundo, despachos y casos. Con el marcador de números que tienen que bajar.
- **[[ROADMAP_MAESTRO]]** 🗺️ **El porqué.** La pregunta que ordena todo —**¿por qué querrías jugar mañana?**—, los cuatro relojes y los seis niveles.
- **[[ROADMAP]]** 📜 `fases A–H cerradas` **El acta de lo construido**, que sigue valiendo por *El Principio que Ordena Todo* y *De Dónde Sale el Gasto*.

### 5. ✍️ Escribir mundos
- **[[GEM_GUIONISTA]]** 🎬 **Las instrucciones del Gem que escribe la biblia de un mundo por rondas.** Sabe de áreas, elementos, terreno, el grimorio y los héroes hechos. `tools/guion-a-paquete.mjs` lo convierte en paquete y avisa de lo que no lee.
- **[[GEM_CREAR_CAMPANA]]** 📦 **Las instrucciones del Gem que escribe campañas**, generadas desde el motor (`node tools/gem-instructions.mjs`): el contrato completo, las reglas que un esquema no puede expresar y una muestra correcta.
- **[[ROADMAP_COMPENDIO]]** 📚 **La biblioteca de contenido.** Un JSON por dominio en `public/compendio/` —armas, habilidades, bichos, gente, nombres, sitios— del que tiran los generadores con la semilla. Dice qué campos lleva cada fila.
- **[[ALGORITMOS_GENERACION]]** 🎲 **200 ideas para que dos partidas del mismo texto no se parezcan.** Todo sin IA. La regla que las ordena: **la semilla no es el texto**.
- `guiones/1387/`: las nueve rondas del guion de 1387, el único mundo escrito entero.

### 6. 🗄️ Archivo: planes cerrados
En `wiki/archivo/`. Están hechos o minados, pero el código los cita en sus comentarios como el porqué de lo que existe, así que no se borran:
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
| Decidir en qué trabajar a continuación | [[LO_QUE_FALTA]] §11 y [[POR_HACER]] | — |
| Modificar la ficha de personaje D&D o el inventario | [[Sistema-Party]] y [[DND-Mecanicas-Items]] | `public/scripts/party.js` & `dnd-system.js` |
| Añadir o cambiar lo que se envía al modelo | [[Dynamic-Context-Manager]] | `dynamic-context-manager.js` · comprueba con `node tools/check-prompt-shape.mjs` |
| Intervenir en los mapas, cuadrícula o tokens | [[Campanas-Mapas-Tableros]] | `public/scripts/world-map-renderer.js` · `game-engine/board/` |
| Tocar los tableros generados | [[ROADMAP_PROFUNDIDAD]] R6 | `game-engine/world-builder/board-intent.js` y `dungeon-generator.js` |
| Añadir un conjuro | [[ROADMAP_PROFUNDIDAD]] R4 | `game-engine/rules/grimoire.js`: **solo en código**; los datos solo ajustan números |
| Añadir nuevos comandos de barra `/` | [[SlashCommands-Macros]] | `public/scripts/slash-commands.js` |
| Añadir una clave nueva a la partida | [[ROADMAP_PEGAMENTO]] U2 | `game-engine/campaign/state-registry.js` · `node tools/check-state-keys.mjs` |
| Añadir tipos de arma, daño o condiciones | [[ROADMAP]] Fase C | **`/rules`** en el chat. El origen está en `game-engine/rules/default-ruleset.js` |
| Saber qué se envía al modelo y qué cuesta | [[ROADMAP]] §1 y T3 | **`/prompt`** en el chat |
| Crear un mundo con IA | [[ROADMAP]] Fase F | *Nueva campaña* → *Generar con IA* · `game-engine/world-builder/world-schema.js` |
| Cambiar cómo se empieza una campaña | [[ROADMAP_PROFUNDIDAD]] R1 y R2 | `game-engine/ui/taller/taller.js`, `game-engine/campaign/taller.js`, `campaigns.js` |
| Probar el tablero o el combate sin montar una campaña | [[POR_HACER]] *Probarlo a mano* | `/sandbox` → `game-engine/ui/sandbox.js` |
| **Empezar a jugar, de cero** | **[[EMPEZAR_UNA_CAMPANA]]** | La partida rápida, el taller, la primera sesión y los comandos |
| Jugar en Modo Videojuego, a pantalla completa | [[PROPUESTA_FRONTEND_MODO_JUEGO]] (archivo) | **`/modojuego`** en el chat → `game-engine/ui/shell/` |
| Meter un libro de campaña y jugarlo | [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] (archivo) | **`/esquema-campana`** para el contrato → *Nueva campaña* → *Importar un libro* |
| Integrar cambios de upstream sin romper el fork | [[Guia-Desarrollo-Flujo]] §2 | `.vscode/settings.json` & `public/index.html` |
| Entender cómo se inyectan los datos al LLM | [[Ciclo-De-Vida-Prompt]] | `public/script.js` |
| Localizar un archivo en el proyecto | [[Mapa-Codigo-Archivos]] | Índice del repositorio |
| Saber si algo está conectado al juego o solo probado | [[POR_HACER]] | `node tools/check-engine-wiring.mjs` |
| Comprobar que el juego sigue jugándose de principio a fin | [[POR_HACER]] *Probarlo a mano* | `node tools/e2e-campaign.mjs` (unos 55 min) · `node tools/e2e-quick.mjs` (2 min, la partida rápida) |

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
