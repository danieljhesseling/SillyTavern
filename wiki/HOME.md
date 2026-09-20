---
title: SillyTavern RPG Engine - Wiki Central & Hub de Conocimiento
tags: [home, wiki, moc, silleytavern, rpg, dnd, obsidian, ai-agent, index]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# 🏰 SillyTavern RPG Engine - Hub Central de Conocimiento

Bienvenido a la **Wiki Oficial de SillyTavern & Motor RPG** (`my-silly` fork de DanielJHesseling). Este espacio ha sido estructurado como una base de conocimiento viva para **Obsidian**, diseñada para que tanto desarrolladores humanos como agentes de inteligencia artificial puedan comprender, navegar, depurar y expandir el proyecto de manera ágil y estructurada.

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
      [[Sistema-Party]]
      [[DND-Mecanicas-Items]]
      [[Dynamic-Context-Manager]]
      [[Campanas-Mapas-Tableros]]
      [[World-Content-Popups]]
      [[Relaciones-Memorias]]
      [[Chat-Enhancements]]
    Auditoría & Roadmap
      [[PROBLEMAS_TECNICOS]]
      [[PROPUESTAS_MEJORA]]
      [[ROADMAP]]
      [[POR_HACER]]
      [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]]
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
- [[PROBLEMAS_TECNICOS]]: **Auditoría profunda** con 15 hallazgos críticos de seguridad (XSS, CSP), desincronización de estado, cuellos de botella de memoria y ausencia de tests.
- [[PROPUESTAS_MEJORA]]: **Catálogo de 200 propuestas técnicas estructuradas** en 10 áreas estratégicas (arquitectura, seguridad, D&D, VTT, agentes, UI/UX, bases de datos y DevOps).
- [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]]: **Propuesta de Motor Híbrido RPG** (Persona + Gloomhaven + D&D 5e): combate táctico algorítmico 0 tokens, social links con perks de combate, calendario y lienzo blanco de world building.
- [[ROADMAP]]: **El plan de trabajo único.** Reconcilia la auditoría, el catálogo y el diseño de juego en 6 fases ordenadas por lo que desbloquean, más las transversales de economía de tokens. Cada fase termina en algo jugable.
- [[POR_HACER]]: **Lista viva de pendientes**, ordenada por lo que desbloquea. Marca con 🖥️ las tareas que convierten motor construido en juego jugable.

### 5. 🛠️ Guías de Desarrollo & Referencia Rápida
Herramientas para desarrolladores y agentes de IA:
- [[Mapa-Codigo-Archivos]]: Inventario detallado archivo por archivo que distingue entre el código base y los componentes del fork.
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
| Añadir tipos de arma, daño o condiciones | [[ROADMAP]] Fase C | `game-engine/rules/default-ruleset.js` (son datos, no código) |
| Integrar cambios de upstream sin romper el fork | [[Guia-Desarrollo-Flujo]] §2 | `.vscode/settings.json` & `public/index.html` |
| Entender cómo se inyectan los datos al LLM | [[Ciclo-De-Vida-Prompt]] | `public/script.js` (~línea 3137) |
| Localizar un archivo en el proyecto | [[Mapa-Codigo-Archivos]] | Índice del repositorio |

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
