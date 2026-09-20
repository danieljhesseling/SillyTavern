---
title: Ecosistema de Extensiones & Plugins
tags: [extensiones, plugins, arquitectura, hooks, api, frontend, backend, modularidad]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Ecosistema de Extensiones & Plugins

SillyTavern ofrece una arquitectura extensible bidireccional que permite incorporar nuevas funcionalidades tanto en el navegador (Extensiones de Cliente) como en el servidor Node.js (Plugins de Servidor).

Este documento compara ambos paradigmas, detalla sus ciclos de vida y explica las razones de diseño por las cuales el motor RPG de este fork fue integrado como un subsistema de primer nivel en el núcleo de la aplicación.

---

## 1. Comparativa: Extensiones vs. Plugins vs. Núcleo

| Característica | Extensión de Cliente (`public/scripts/extensions/`) | Plugin de Servidor (`plugins/`) | Subsistema del Núcleo (Fork Actual) |
| :--- | :--- | :--- | :--- |
| **Entorno de Ejecución** | Navegador web (Sandbox DOM / JS). | Servidor Node.js (Acceso al SO). | Híbrido (Cliente + Backend + DOM estático). |
| **Puntos de Inserción** | Cajón de extensiones, eventos del chat, prompts. | Rutas Express (`/api/plugins/*`), WebSockets. | Modales dedicados, barra de grupo, index.html. |
| **Persistencia** | `settings.json`, metadatos de chat. | Sistema de archivos, bases de datos externas. | Integrado nativo en `chat_metadata` y Lorebook. |
| **Acceso a Hardware** | Limitado por la API Web del navegador. | Total (GPUs, red local, procesos nativos). | Completo a través de endpoints dedicados. |
| **Caso de Uso Típico** | Visualizadores de dados, temas, lectores TTS. | Enlaces a Stable Diffusion local, RAG pesado. | **Motor RPG, Campañas, D&D y Tableros Tácticos**. |

---

## 2. Extensiones de Cliente (Frontend)

Las extensiones de cliente se instalan en `public/scripts/extensions/<nombre-extension>/`:

```
public/scripts/extensions/dice-roller/
├── manifest.json            # Metadatos, versión y punto de entrada
├── index.js                 # Módulo ES que exporta la función init()
├── style.css                # Estilos específicos de la extensión
└── settings.html            # Fragmento HTML inyectado en el cajón de ajustes
```

### Ciclo de Vida y Hooks de Eventos
Las extensiones interactúan con el núcleo suscribiéndose al bus de eventos `eventSource`:

```javascript
import { eventSource, event_types } from '../../events.js';
import { setExtensionPrompt, extension_prompt_types } from '../../../script.js';

export async function init() {
    // Escucha cambios de conversación
    eventSource.on(event_types.CHAT_CHANGED, (chatId) => {
        console.log('Conversación activa modificada:', chatId);
    });

    // Inyecta instrucciones previas a la generación
    eventSource.on(event_types.BEFORE_CHAT_COMPLETION, async () => {
        setExtensionPrompt('MI_PROMPT_CUSTOM', 'Instrucción inyectada', extension_prompt_types.IN_PROMPT, 0);
    });
}
```

---

## 3. Plugins de Servidor (Backend Express)

Los plugins de servidor residen en `plugins/<plugin-name>/` y son cargados dinámicamente durante el arranque por `src/plugin-loader.js`:

```javascript
// plugins/mi-plugin/index.js
export async function init(app, serverStartup) {
    // Registra una nueva ruta en Express
    app.post('/api/plugins/mi-servicio', async (req, res) => {
        // Ejecución en Node.js con acceso a filesystem y módulos CJS/ESM
        res.json({ status: 'ok', data: 42 });
    });
}
```

- Disponen de aislamiento de dependencias mediante su propio `package.json`.
- Pueden levantar procesos hijos (ej. scripts de Python para procesamiento de audio o inferencia de visión).

---

## 4. ¿Por qué el Motor RPG se Integró en el Núcleo?

Una de las decisiones arquitectónicas clave adoptadas por DanielJHesseling en este fork fue **no crear el sistema D&D como una simple extensión aislada**, sino integrarlo profundamente en los archivos base (`script.js`, `personas.js`, `world-info.js`, `index.html`).

### Razones Técnicas:
1. **Acoplamiento Profundo con la Ficha de Personaje**:
   - El motor RPG necesitaba que las estadísticas del líder del grupo (`partyLeader`) sobreescribieran de forma transparente el perfil de la persona del usuario (`addPersonaDescriptionExtensionPrompt` en `script.js`).
2. **Ampliación del Esquema de Lorebooks**:
   - `world-info.js` debió ser modificado para almacenar y renderizar mapas de mundo, monstruos y tableros (`dndData`), algo inviable mediante la API estándar de extensiones sin parches dinámicos frágiles.
3. **Optimización de Renderizado y DOM**:
   - El cajón de grupo permanente (`#party_drawer`), los tableros de cuadrícula zoomables y la superposición de dados de combate requerían estilos globales y marcado directo en `index.html` para evitar parpadeos visuales (FOUC).
4. **Control Total del Contexto Dinámico**:
   - El `Dynamic Context Manager` necesita intervenir directamente en el cálculo del presupuesto de tokens (`tokenBudget`) antes de que se dispare la tokenización final.

---

## 5. Enlaces Relacionados
- [[Frontend-Estructura]]: Estructura de archivos de cliente y `index.html`.
- [[Backend-Express]]: Arquitectura del cargador de plugins `plugin-loader.js`.
- [[Sistema-Party]]: Implementación central del motor de grupo en el núcleo.
- [[PROPUESTAS_MEJORA]]: Propuesta para crear una SDK formal de extensiones que evite la necesidad de modificar el núcleo.
