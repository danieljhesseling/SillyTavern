---
title: Arquitectura General de SillyTavern & Motor RPG
tags: [arquitectura, overview, nodejs, express, frontend, dnd, lifecycle]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Arquitectura General de SillyTavern & Motor RPG

Bienvenido a la documentación arquitectónica de **SillyTavern** y su extensión integral de **Motor RPG / D&D 5e** desarrollada en la rama `my-silly`. Este documento expone el diseño estructural, los componentes de alto nivel, los modelos de ejecución y el flujo global de información.

---

## 1. Visión Global del Sistema

SillyTavern es una plataforma web híbrida (servidor local en Node.js + cliente monomórfico en navegador) diseñada originariamente como interfaz avanzada para modelos de lenguaje (LLM), generadores de imágenes y motores TTS/STT. 

En este fork específico (`danieljhesseling/SillyTavern`), el sistema ha evolucionado de un frontend conversacional tradicional a un **Entorno Virtual de Juego de Rol (VTT / RPG Engine)** que integra:
- Gestión de grupo (Party) y ficha de personajes estilo D&D 5e en tiempo real.
- Motor de combate por turnos, tiradas de dados animadas y control de iniciativas.
- Mapas de mundo, planos de localización y tableros tácticos con colocación de tokens y niebla de guerra.
- **Dynamic Context Manager**: Inyección contextual e inteligente de estados de campaña en los prompts del LLM.
- Resaltado dinámico de entidades de Lorebook en el chat y avatares de diálogo en línea.

```mermaid
graph TD
    User([Usuario / Navegador]) -->|HTTP / SSE / WebSocket| Server[Servidor Node.js Express]
    
    subgraph Frontend [Cliente Web (public/)]
        UI[UI Monolítica (index.html + CSS)]
        CoreScript[Script Central (script.js)]
        PartyMod[Motor de Party (party.js)]
        DndSys[Reglas & Items (dnd-system.js)]
        DynCtx[Dynamic Context Manager]
        MapEngine[World Map & Board Renderer]
        Popups[World Content Popups]
        ChatEnhance[Chat Enhancements]
    end
    
    subgraph Backend [Servidor Express (src/)]
        Main[server-main.js & server-startup.js]
        Auth[Autenticación & Users (users.js)]
        Endpoints[Endpoints REST (src/endpoints/)]
        Proxy[Proxy de Peticiones LLM & CORS]
        Storage[(Almacenamiento Local: data/)]
    end
    
    subgraph AI_Providers [Servicios Externos / Locales]
        OpenAI[OpenAI / OpenRouter]
        Anthropic[Anthropic Claude]
        Gemini[Google Gemini API]
        Kobold[KoboldAI / TextGen / Ollama]
        SD[Stable Diffusion / ComfyUI]
        TTS[Motores TTS / ElevenLabs / Coqui]
    end

    User <--> UI
    UI <--> CoreScript
    CoreScript <--> PartyMod
    PartyMod <--> DndSys
    PartyMod <--> MapEngine
    CoreScript <--> DynCtx
    CoreScript <--> ChatEnhance
    Popups <--> DndSys
    
    CoreScript <-->|REST API & SSE| Endpoints
    Endpoints <--> Auth
    Endpoints <--> Storage
    Endpoints <--> Proxy
    Proxy <--> AI_Providers
```

---

## 2. Modelos de Ejecución

SillyTavern soporta múltiples modos de despliegue según el caso de uso del usuario:

1. **Modo Local Estándar (Node.js)**:
   - Se inicia mediante `npm start`, `Start.bat` (Windows) o `start.sh` (Linux/macOS).
   - Ejecuta `node server.js`, levantando un servidor Express en `http://127.0.0.1:8000` (o IPv6 `[::1]:8000`).
   - El navegador predeterminado se abre automáticamente (salvo que se deshabilite con `--no-open`).

2. **Modo Electron (Aplicación de Escritorio)**:
   - Ubicado en `src/electron/`.
   - Empaqueta el servidor Node.js y la interfaz en una ventana Chromium nativa con integración de bandeja del sistema (tray) y gestión de ciclo de vida del proceso.

3. **Modo Multi-Usuario / Servidor Remoto**:
   - Activado mediante la bandera `--enableUserAccounts` o la configuración `enableUserAccounts: true` en `config.yaml`.
   - Cada usuario dispone de un directorio aislado en `data/<user_handle>/` con sus propios personajes, chats, ajustes y hojas de personajes.
   - Autenticación mediante Scrypt, cookies de sesión seguras (`cookie-session`) y protección CSRF (`csrfSync`).

4. **Modo Contenedor (Docker)**:
   - Soportado mediante `Dockerfile` y scripts en `docker/`. Expone el puerto 8000 con volumen persistente mapeado a `/home/node/app/data`.

---

## 3. Ciclo de Vida del Arranque (Bootstrapping)

### A. Secuencia del Servidor (`server.js`)
1. **Lectura de Argumentos CLI**: `src/command-line.js` procesa los flags de línea de comandos mediante `yargs`.
2. **Carga de Configuración**: `src/config-init.js` lee `config.yaml` (o `default/config.yaml` si no existe).
3. **Instanciación de Express**: En `src/server-main.js` se configura la aplicación Express, configurando Helmet, compresión gzip, límites de body parser y registro de accesos.
4. **Inicialización de Almacenamiento**: `src/users.js::initUserStorage()` asegura las carpetas raíz (`data/`, `data/default-user/`, `backups/`).
5. **Registro de Middleware**:
   - `whitelist.js` (si está habilitado el filtrado de IPs).
   - `basicAuth.js` (si se requiere autenticación básica HTTP).
   - `csrfSync` (generación y validación de tokens anti-CSRF).
   - `requireLoginMiddleware` (para aislamiento multi-usuario).
6. **Mapeo de Endpoints**: `src/server-startup.js::setupPrivateEndpoints()` registra más de 40 routers modulares (`/api/characters`, `/api/chats`, `/api/worldinfo`, etc.).
7. **Carga de Plugins Backend**: `src/plugin-loader.js` descubre y carga módulos desde la carpeta `plugins/`.
8. **Enlace de Puertos**: `ServerStartup.start()` enlaza los sockets TCP en IPv4 e IPv6.

### B. Secuencia del Cliente Web (`public/`)
1. **Descarga de Recursos**: `index.html` carga hojas de estilo CSS (incluyendo las nuevas `campaigns.css`, `dnd-character.css`, `world-map.css`) y bibliotecas base (jQuery 3.5.1, jQuery UI, FontAwesome).
2. **Inicialización de Módulos ES**:
   - `public/lib/structured-clone/monkey-patch.js`
   - `public/lib/eventemitter.js`
   - `public/scripts/i18n.js` (localización de cadenas).
   - `public/script.js` (módulo maestro).
3. **Punto de Entrada: `firstLoadInit()` en `script.js`**:
   - Recupera configuración de usuario y temas.
   - Carga avatares y personajes iniciales.
   - Inicializa los subsistemas del motor RPG:
     ```javascript
     initPartyPanel();              // public/scripts/party.js
     initActiveInstructions();      // public/scripts/active-instructions.js
     initDynamicContextManager();   // public/scripts/dynamic-context-manager.js
     initChatEnhancements();        // public/scripts/chat-enhancements.js
     ```
   - Conecta los event listeners del DOM y renderiza la pantalla de bienvenida o el chat activo.

---

## 4. Comunicación Inter-Módulos y Gestión de Estado

El cliente opera sin frameworks reactivos (como React o Vue), basándose en un patrón híbrido:

1. **Event Bus Central (`eventSource`)**:
   - Definido en `public/scripts/events.js` usando un `EventEmitter`.
   - Emite eventos clave: `CHAT_CHANGED`, `CHARACTER_PAGE_LOADED`, `SETTINGS_UPDATED`, `WORLDINFO_UPDATED`.
   - Permite que módulos desacoplados (ej. `chat-enhancements.js` o `party.js`) reaccionen sin invocar funciones directas.

2. **Metadatos del Chat (`chat_metadata`)**:
   - Objeto singleton en memoria sincronizado con el archivo JSONL del chat actual.
   - Almacena el estado persistente de la sesión:
     - `chat_metadata.party`: Lista de miembros del grupo, estadísticas, equipamiento y relaciones.
     - `chat_metadata.dynamicContext`: Instrucciones activas, estado de campaña (`combat`, `exploration`, etc.) y presupuesto de tokens.
     - `chat_metadata.currentLocation` y `currentBoard`: Ubicación actual en el mapa y tablero táctico activo.

3. **Inyección de Prompts (`setExtensionPrompt`)**:
   - Pipeline donde los módulos agregan bloques contextuales al prompt final enviado a la IA:
     - `PERSONA_PLAYER_STATE`: Estadísticas del líder del grupo (HP, EXP, Oro, Inventario).
     - `PARTY_MEMBERS`: Resumen textual de todos los miembros del grupo.
     - `LOCATION_BOARD_CONTEXT`: Descripción del mapa, tablero y coordenadas de los tokens presentes.
     - `DYNAMIC_CONTEXT`: Instrucciones dinámicas filtradas por el gestor según la situación.

---

## 5. Mapa de Navegación de la Wiki

Para explorar en profundidad cada área del proyecto, consulta los documentos especializados:

| Dimensión | Documento de Referencia |
| :--- | :--- |
| **Backend & Servidor** | [[Backend-Express]] • [[Almacenamiento-Persistencia]] • [[Seguridad-Autenticacion]] |
| **Frontend & Pipeline** | [[Frontend-Estructura]] • [[Ciclo-De-Vida-Prompt]] • [[Conectores-IA]] |
| **Subsistemas Base** | [[WorldInfo-Lorebooks]] • [[SlashCommands-Macros]] • [[Extensiones-Plugins]] |
| **Motor RPG & D&D** | [[Sistema-Party]] • [[DND-Mecanicas-Items]] • [[Dynamic-Context-Manager]] • [[Campanas-Mapas-Tableros]] • [[World-Content-Popups]] • [[Relaciones-Memorias]] • [[Chat-Enhancements]] |
| **Planes & Hojas de Ruta** | [[ROADMAP]] • [[PROPUESTA_FRONTEND_MODO_JUEGO]] • [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] • [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]] • [[ROADMAP_JUEGO_SIN_COMANDOS]] |
| **Auditoría & Futuro** | [[PROBLEMAS_TECNICOS]] • [[PROPUESTAS_MEJORA]] • [[POR_HACER]] |
| **Guías de Desarrollo** | [[Mapa-Codigo-Archivos]] • [[Guia-Desarrollo-Flujo]] |

> [!TIP]
> Si utilizas Obsidian, abre el **Graph View** (Vista de Grafo) para visualizar de forma interactiva las interconexiones entre todos los módulos del sistema.
