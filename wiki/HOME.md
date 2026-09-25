---
title: SillyTavern RPG Engine - Wiki Central & Hub de Conocimiento
tags: [home, wiki, moc, silleytavern, rpg, dnd, obsidian, ai-agent, index]
created: 2026-09-20
updated: 2026-09-21
author: DanielJHesseling / Antigravity AI
---

# 🏰 SillyTavern RPG Engine - Hub Central de Conocimiento

Bienvenido a la **Wiki Oficial de SillyTavern & Motor RPG** (`my-silly` fork de DanielJHesseling). Este espacio ha sido estructurado como una base de conocimiento viva para **Obsidian**, diseñada para que tanto desarrolladores humanos como agentes de inteligencia artificial puedan comprender, navegar, depurar y expandir el proyecto de manera ágil y estructurada.

> [!IMPORTANT]
> **Por dónde se empieza**, según a qué vengas:
>
> | Vengo a… | Abre |
> | :--- | :--- |
> | **Saber qué se hace después** | **[[ROADMAP_MAESTRO]]** — el único plan vivo. Todo lo demás cuelga de ahí |
> | **Entender fallas de diseño & soluciones** | **[[ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES]]** — análisis lúdico y amortiguadores de sistemas |
> | **Jugar** | [[EMPEZAR_UNA_CAMPANA]] |
> | **Coger una tarea** | [[POR_HACER]] |
> | **Entender por qué el juego es así** | [[ROADMAP]] (el acta de las fases A–H) y [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]] (la visión original) |
> | **Encontrar un archivo** | [[Mapa-Codigo-Archivos]] |
>
> Los planes cerrados llevan un aviso en su primera línea. **Ninguno es un plan ya**: son historia, y valen por el porqué.

> [!TIP]
> **Modo Obsidian**: Esta wiki aprovecha los enlaces bidireccionales `[[...]]`. Abre la **Vista de Grafo (Graph View)** de Obsidian para explorar visualmente la red de dependencias entre el backend, el frontend y los subsistemas de rol.

---

## 🗺️ Mapa de Contenido (MOC)

```mermaid
mindmap
  root((SillyTavern RPG))
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
      [[ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES]]
      [[Sistema-Party]]
      [[DND-Mecanicas-Items]]
      [[Dynamic-Context-Manager]]
      [[Campanas-Mapas-Tableros]]
      [[World-Content-Popups]]
      [[Relaciones-Memorias]]
      [[Chat-Enhancements]]
    El plan vivo
      [[ROADMAP_MAESTRO]]
      [[POR_HACER]]
      [[DISENO_GENERADOR_MUNDOS_PROFUNDO]]
      [[ROADMAP_INGESTA_CAMPANAS_LIBROS]]
      [[GEM_CREAR_CAMPANA]]
    Jugar
      [[EMPEZAR_UNA_CAMPANA]]
    Cajones de ideas
      [[IDEAS_200]]
      [[PROPUESTAS_MEJORA_V2]]
      [[PROPUESTAS_MEJORA]]
      [[PROBLEMAS_TECNICOS]]
    Historia: planes cerrados
      [[ROADMAP]]
      [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]]
      [[PROPUESTA_FRONTEND_MODO_JUEGO]]
      [[ROADMAP_JUEGO_SIN_COMANDOS]]
      [[PLAN_CREAR_CAMPANA]]
      [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]
    Guías & Referencia
      [[Mapa-Codigo-Archivos]]
      [[Guia-Desarrollo-Flujo]]
```

---

## 📚 Índice Temático de Documentos

### 1. 🏛️ Arquitectura & Fundamentos del Sistema
Documentación exhaustiva sobre cómo está construido el servidor Node.js y el cliente web:
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

### 3. ⚔️ Motor RPG & Campañas D&D 5e (Fork DanielJHesseling)
El núcleo de juego de rol agregado en la rama `my-silly` con más de 24,000 líneas de código:
- [[Sistema-Party]]: Gestión del grupo (`party.js`), líder activo, sincronización de HP/XP/Oro, leveling automático y dados.
- [[DND-Mecanicas-Items]]: Fórmulas D&D 5e (`dnd-system.js`), modificadores, AC por tipo de armadura, ranuras anatómicas y pesos.
- [[Dynamic-Context-Manager]]: Máquina de estados (`combat`, `exploration`, `social`), filtrado inteligente de reglas y presupuesto de tokens.
- [[Campanas-Mapas-Tableros]]: Visualizador zoomable de mapas, planos de ciudades, tableros tácticos con cuadrícula, tokens y niebla de guerra.
- [[World-Content-Popups]]: Formularios modales visuales para crear monstruos, objetos mágicos, conjuros y facciones en el Lorebook.
- [[Relaciones-Memorias]]: Escala de afinidad (-100 a +100), analizador heurístico de chat y memorias narrativas persistentes.
- [[Chat-Enhancements]]: Resaltado de términos de Lorebook con tooltips descriptivos y avatares de diálogo en línea.

### 4. 🔍 Auditoría Técnica, Calidad & Futuro
Diagnóstico crítico y catálogo exhaustivo de propuestas de mejora:
- **[[ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES]]** ⚖️ **Análisis Profundo de Fallas Jugables & Soluciones Sistémicas.** El diagnóstico de fondo sobre la colisión entre D&D, Gloomhaven, Persona y Darkest Dungeon. Detalla las 7 fallas lúdicas críticas (afecto vs mutilación, chat vs tablero, espiral de upkeep, tableros escaparate, acompañante suicida, localidades muros de texto y ficha dormida) y aporta soluciones técnicas a 0 tokens (prótesis, posturas, fail-forward y tableros desacoplados).
- **[[ROADMAP_MAESTRO]]** 🗺️ **El mapa de todos los mapas, y el único plan vivo.** Empieza por la pregunta que ordena todo —**¿por qué querrías jugar mañana?**— y parte lo que queda en seis niveles, cada uno jugable por sí solo: el tablero que sigue a la conversación, **el desgaste** (comer, cobrar, heridas que no sanan, muerte permanente), el mundo que crece solo, el gremio como capa opcional, los modos de juego y el bucle cerrado. Dice en claro **qué veo posible y qué no**.
- **[[ALGORITMOS_GENERACION]]** 🎲 **200 ideas para que dos partidas del mismo texto no se parezcan.** Todo sin IA: tablas, pesos, ruido y una semilla que se guarda con la campaña. La regla que las ordena es una sola — **la semilla no es el texto**: se tira al crear el mundo y lo escrito solo inclina los pesos. Va por áreas (terreno, enemigos, botín, misiones, nombres, facciones) y termina diciendo cuáles diez cambian más que las otras ciento noventa.
- **[[ROADMAP_CREACION]]** 🏗️ **El taller de campañas: trece pasos y tres formas de empezar.** Funde el asistente de *Nueva campaña* con el editor de `/campana`, que hoy hacen lo mismo a medias y no se ven entre ellos. Un solo componente —tarjetas, una con un `+`, y el formulario debajo— configurado trece veces, para que no haya trece sitios donde arreglar el mismo fallo. Dice qué paso va antes que cuál y por qué, cómo funciona la semilla cuando eliges a mano (**es el dado de lo que no has elegido**), y las dos cosas que hay que arreglar antes de empezar.
- **[[ROADMAP_COMPENDIO]]** 📚 **La biblioteca de contenido, batería a batería.** Un JSON por dominio en `public/compendio/` —armas, habilidades, bichos, gente, nombres— del que tiran los generadores con la semilla. Doce baterías, cada una una tarde: se añade sola, **no rompe nada si falta**, y al terminarla se ve algo distinto jugando. Dice qué campos lleva cada fila, cuántas hacen falta de verdad y en qué orden conviene hacerlas.
- [[PROBLEMAS_TECNICOS]]: **Auditoría profunda** con 15 hallazgos críticos de seguridad (XSS, CSP), desincronización de estado, cuellos de botella de memoria y ausencia de tests. Con el estado de cada hallazgo comprobado contra el código: 6 corregidos, 4 parciales y 5 abiertos.
- [[PROPUESTAS_MEJORA]]: **Catálogo de 200 propuestas técnicas estructuradas** en 10 áreas estratégicas (arquitectura, seguridad, D&D, VTT, agentes, UI/UX, bases de datos y DevOps). Cada propuesta con novedad lleva su marca de estado, y el anexo recoge 12 propuestas propias.
- [[IDEAS_200]]: **200 ideas de jugabilidad (2026-09-24)**: combate, compañeros, viaje, mundo vivo, hilo, economía, chat, interfaz y creación, sobre el motor de Mundos vivos. Todas hechas (ocho baterías); quedan solo 3 aparcadas.
- [[PROPUESTAS_MEJORA_V2]]: **Catálogo V2 de 200 Nuevas Propuestas de Mejora**: Nueva batería de 200 propuestas adaptadas a la madurez actual del motor (Game Shell, Zero Comandos, táctica avanzada, magia y spell slots, bucle social Persona y economía reactiva).
- [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]]: `la visión original` **Propuesta de Motor Híbrido RPG** (Persona + Gloomhaven + D&D 5e): combate táctico algorítmico 0 tokens, social links con perks de combate, calendario y lienzo blanco de world building. Incluye el estado de cada pilar y las correcciones que la realidad impuso.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]]: `G1–G4 hechas` — vive como **el contrato del paquete**. **De un libro a una campaña jugable.** El contrato de datos entre un GEM de Gemini y el motor. El validador y el importador **ya están**; lo que se pega en el Gem lo genera [[GEM_CREAR_CAMPANA]].
- [[PROPUESTA_FRONTEND_MODO_JUEGO]]: `cerrado` **Frontend Dedicado "Modo Videojuego"**: Cómo eliminar el ruido de SillyTavern mediante una Pantalla de Título (Nueva/Cargar/Opciones) y un HUD de juego inmersivo (Dock de Party, Diálogo RPG, Tablero), sin tocar `index.html`.
- [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]: `minado` **Hacia la Experiencia "Friends & Fables" (Sin Marketplace)**: Análisis comparativo y hoja de ruta para completar las 6 piezas que faltan (DM autónomo con tiradas CD y opciones rápidas, descansos D&D, magia/spell slots y subida de nivel).
- [[ROADMAP_JUEGO_SIN_COMANDOS]]: **Juego 100% por Clics (Zero Comandos)**: Matriz de migración de comandos de barra a interacción puramente visual con ratón (mover y atacar en el tablero, interactuar con puertas, descansos en el reloj, action chips).
- [[DISENO_GENERADOR_MUNDOS_PROFUNDO]]: **Diseño del Generador de Mundos Profundo**: Especificación de las 7 categorías maestras (Personajes, Enemigos, Mapa Mundi, Localidades con 0..N tableros, Tableros tácticos con salas/puertas, Facciones y Magias/Habilidades) con su esquema JSON unificado para IA.
- [[PLAN_CREAR_CAMPANA]]: **Crear una campaña a mano** ✅ *hecho*: `/campana`, un editor con una pestaña por categoría (mundo, localizaciones con sus tableros, personajes, bestiario, facciones, objetos y misiones) que escribe en el mismo sitio que el importador de libros. Las seis fases, con reclutar, catálogo de objetos enganchado al botín y misiones propias.
- [[GEM_CREAR_CAMPANA]]: **Las instrucciones del Gem que escribe campañas**, generadas desde el motor: quién es, cómo trabaja sección a sección, el contrato completo, las reglas que un esquema no puede expresar y una muestra correcta. Es el *seeding* de una campaña: pegar, pedir, ensamblar, importar.
- [[ROADMAP]]: `fases A–H cerradas` **El acta de lo construido.** Reconcilia la auditoría, el catálogo y el diseño de juego en 6 fases ordenadas por lo que desbloquean, más las transversales de economía de tokens. Cada fase termina en algo jugable. Empieza con *Dónde Estamos*: qué está hecho, qué está conectado al juego y qué falta.
- [[POR_HACER]]: **Lista viva de pendientes**, ordenada por lo que desbloquea. Marca con 🖥️ las tareas que convierten motor construido en juego jugable. Incluye una prueba manual de dos minutos.

### 5. 🛠️ Guías de Desarrollo & Referencia Rápida
Herramientas para desarrolladores y agentes de IA:
- [[Mapa-Codigo-Archivos]]: Inventario archivo por archivo que distingue el código base de los componentes del fork, con `game-engine/`, `party/` y `tools/`, y qué está conectado al juego.
- [[Guia-Desarrollo-Flujo]]: Manual para arrancar, depurar, extender clases, crear nuevos comandos y aplicar buenas prácticas.

---

## ⚡ Guía de Navegación Rápida para Agentes de IA

Si eres un agente de IA interactuando con este repositorio, sigue estas directrices para resolver tareas comunes:

| Si tu tarea es... | Consulta primero... | Archivo clave en el código |
| :--- | :--- | :--- |
| Modificar la ficha de personaje D&D o el inventario | [[Sistema-Party]] y [[DND-Mecanicas-Items]] | `public/scripts/party.js` & `dnd-system.js` |
| Añadir un nuevo estado de campaña o regla de contexto | [[Dynamic-Context-Manager]] | `public/scripts/dynamic-context-manager.js` |
| Intervenir en los mapas, cuadrícula o tokens | [[Campanas-Mapas-Tableros]] | `public/scripts/world-map-renderer.js` |
| Añadir nuevos comandos de barra `/` | [[SlashCommands-Macros]] | `public/scripts/slash-commands.js` |
| Solucionar una vulnerabilidad o condición de carrera | [[PROBLEMAS_TECNICOS]] | `src/server-main.js` & `party.js` |
| Decidir en qué trabajar a continuación | [[ROADMAP]] | Fases A a F |
| Reducir el gasto en tokens | [[ROADMAP]] §1 y Transversales | `dynamic-context-manager.js` |
| Añadir tipos de arma, daño o condiciones | [[ROADMAP]] Fase C | **`/rules`** en el chat: editor visual. El origen está en `game-engine/rules/default-ruleset.js` |
| Saber qué se envía al modelo y qué cuesta | [[ROADMAP]] §1 y T3 | **`/prompt`** en el chat |
| Crear un mundo con IA | [[ROADMAP]] Fase F | *Nueva campaña* → *Generar con IA* · `game-engine/world-builder/world-schema.js` |
| Cambiar cómo se empieza una campaña o añadir una plantilla | [[ROADMAP]] *El Asistente de Campaña* | `game-engine/ui/campaign-wizard.js`, `campaigns.js`, `game-engine/campaign/starter-templates.js` |
| Probar el tablero o el combate sin montar una campaña | [[POR_HACER]] *Probarlo a mano* | `/sandbox` → `game-engine/ui/sandbox.js` |
| Jugar con el ratón, sin comandos | [[ROADMAP_JUEGO_SIN_COMANDOS]] | Clic en tu ficha → casillas; clic en el enemigo → su tarjeta |
| **Empezar a jugar, de cero** | **[[EMPEZAR_UNA_CAMPANA]]** | Los tres caminos para crear una campaña, la primera sesión y los comandos |
| Jugar en Modo Videojuego, a pantalla completa | [[PROPUESTA_FRONTEND_MODO_JUEGO]] (Fase H, completa) | **`/modojuego`** en el chat → `game-engine/ui/shell/` |
| Meter un libro de campaña y jugarlo | [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] (Fase G, completa) | **`/esquema-campana`** para el contrato → *Nueva campaña* → *Importar un libro* |
| Experiencia Friends & Fables (DM y magia) | [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]] | Análisis de paridad y las 6 piezas que faltan (sin marketplace) |
| Integrar cambios de upstream sin romper el fork | [[Guia-Desarrollo-Flujo]] §2 | `.vscode/settings.json` & `public/index.html` |
| Entender cómo se inyectan los datos al LLM | [[Ciclo-De-Vida-Prompt]] | `public/script.js` (~línea 3137) |
| Localizar un archivo en el proyecto | [[Mapa-Codigo-Archivos]] | Índice del repositorio |
| Saber si algo está conectado al juego o solo probado | [[POR_HACER]] | `node tools/check-engine-wiring.mjs` |
| Comprobar que el juego sigue jugándose de principio a fin | [[POR_HACER]] *Probarlo a mano* | `node tools/e2e-campaign.mjs` |

---

## 🚀 Comandos de Terminal Más Frecuentes

```bash
# Iniciar el servidor localmente en http://localhost:8000
npm start

# Iniciar con inspector de depuración de Node.js
npm run debug

# Iniciar en modo global (accesible desde la red local)
npm run start:global

# Iniciar la aplicación de escritorio con Electron
npm run start:electron
```

> [!IMPORTANT]
> Antes de realizar cualquier cambio que altere la estructura de `chat_metadata`, revisa [[Almacenamiento-Persistencia]] y la auditoría en [[PROBLEMAS_TECNICOS]] para garantizar la retrocompatibilidad con chats existentes.
