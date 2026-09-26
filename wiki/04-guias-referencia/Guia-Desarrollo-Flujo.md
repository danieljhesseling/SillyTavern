---
title: Guía de Desarrollo, Flujo de Trabajo & Mejores Prácticas
tags: [desarrollo, workflow, nodejs, git, debugging, extensiones, buenas-practicas]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Guía de Desarrollo, Flujo de Trabajo & Mejores Prácticas

Esta guía proporciona a desarrolladores humanos y agentes de IA las pautas necesarias para configurar el entorno de desarrollo, ejecutar y depurar la aplicación, extender el motor de juego de rol y mantener la coherencia del código en la rama `my-silly`.

---

## 1. Requisitos del Entorno y Ejecución

### Requisitos Previos:
- **Node.js**: Versión 20.x o superior (Node.js 22 LTS o Node.js 24 recomendados).
- **Gestor de Paquetes**: `npm` v10+.
- **Git**: Para control de versiones y sincronización con el repositorio remoto.

### Comandos de Ejecución Clave:
```bash
# Instalación de dependencias (raíz)
npm install

# Iniciar en modo estándar (puerto 8000)
npm start

# Iniciar en modo depuración (habilita inspector V8 en chrome://inspect)
npm run debug

# Iniciar permitiendo conexiones desde la red local
npm run start:global

# Iniciar deshabilitando validación CSRF (sólo para pruebas automatizadas)
npm run start:no-csrf

# Iniciar la versión de escritorio con Electron
npm run start:electron
```

---

## 2. Flujo de Trabajo con Git (Fork `danieljhesseling/SillyTavern`)

### Topología de remotes

| Remote | Apunta a | Uso |
| :--- | :--- | :--- |
| `origin` | `danieljhesseling/SillyTavern` | **Tu fork.** Aquí se hace push. |
| `upstream` | `SillyTavern/SillyTavern` | **Oficial.** Solo lectura: el push está desactivado con `git remote set-url --push upstream DISABLED`. |

> [!WARNING]
> `origin/release` **no** es la rama oficial de SillyTavern: es tu copia del fork, y se queda congelada en el momento en que ramificaste. Para ver el estado real de upstream hay que consultar `upstream/release`.

```bash
git fetch upstream
git merge upstream/release
```

### La regla que abarata los merges

> [!IMPORTANT]
> **Código nuevo va en archivo nuevo.**
>
> Los archivos creados por el fork (`party.js`, `dnd-system.js`, `world-map-renderer.js`, `dynamic-context-manager.js`, `campaigns.js`, y las hojas CSS del motor RPG) **no los toca upstream jamás**: colisión cero, para siempre. Cada línea escrita dentro de un archivo de upstream, en cambio, se paga en todos los merges futuros.
>
> Cuando haga falta un punto de enganche en un archivo de upstream, que sea **lo más pequeño posible**: un `import`, una llamada, un contenedor vacío que rellene el código del fork.

### No reformatear archivos de upstream

El formateador HTML integrado de VSCode reescribe cosméticamente líneas que upstream edita de verdad, y cada reescritura se convierte en un conflicto. `.vscode/settings.json` desactiva `editor.formatOnSave` y `html.format.enable` precisamente por esto.

**Evidencia** (merge del 2026-09-20, 194 commits de upstream): de los 39 bloques en conflicto de `public/index.html`, **38 eran ruido del formateador** y solo 1 un cambio real. Sin ese ruido, el merge habría sido prácticamente automático.

### Archivos de upstream modificados por el fork

Estos son los puntos de contacto que conviene mantener al mínimo y revisar en cada merge:

`public/index.html` · `public/script.js` · `public/style.css` · `public/scripts/world-info.js` · `public/scripts/personas.js` · `public/scripts/welcome-screen.js` · `public/scripts/RossAscends-mods.js` · `public/global.d.ts`

Ver [[ROADMAP]] (Batería 0) para el detalle del procedimiento y las métricas.

---

## 3. Cómo Extender el Motor RPG: Guías Paso a Paso

### A. Cómo Registrar un Nuevo Comando de Barra en el Motor RPG
Para añadir un nuevo comando relacionado con el juego en `public/scripts/party.js`:

```javascript
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'misupercomando',
    callback: async (args, value) => {
        const miembro = args.nombre;
        const puntos = Number(args.cantidad) || 0;
        // 1. Mutar el estado del grupo
        // 2. Invocar savePartyState()
        // 3. Notificar a la UI
        return 'Comando ejecutado con éxito';
    },
    namedArgumentList: [
        SlashCommandArgument.fromProps({
            name: 'nombre',
            description: 'Nombre del aventurero',
            type: ARGUMENT_TYPE.STRING,
            isRequired: true,
        }),
        SlashCommandArgument.fromProps({
            name: 'cantidad',
            description: 'Puntos a modificar',
            type: ARGUMENT_TYPE.NUMBER,
            isRequired: false,
            defaultValue: '10',
        }),
    ],
    helpString: 'Modifica un atributo especial del aventurero seleccionado.',
}));
```

### B. Cómo Añadir un Nuevo Estado de Campaña en el Dynamic Context Manager
1. Abrir `public/scripts/dynamic-context-manager.js`.
2. Añadir el identificador a la constante `CAMPAIGN_STATES`:
   ```javascript
   export const CAMPAIGN_STATES = [
       'idle', 'combat', 'exploration', 'social', 'rest', 
       'stealth', 'travel', 'shopping', 'downtime', // <-- Nuevo estado
   ];
   ```
3. Añadir el botón correspondiente en el modal de selección de estado en `public/index.html` (o renderizarlo dinámicamente desde el array).
4. El gestor comenzará a evaluar y filtrar automáticamente cualquier instrucción que declare `states: ['downtime']`.

---

## 4. Buenas Prácticas y Reglas de Codificación

1. **Evitar la Desincronización de Persistencia**:
   - Nunca modificar `partyMembers` en memoria sin invocar inmediatamente `savePartyState()` (que persiste en `chat_metadata.party` y llama a `saveMetadata()`).
2. **Sanitización Obligatoria de HTML**:
   - **Regla Crítica**: No concatenar variables de usuario o de tarjetas (`${token.name}`, `${item.name}`) directamente en plantillas jQuery.
   - Utilizar siempre funciones de escape seguras o crear elementos mediante atributos DOM:
     ```javascript
     // Correcto:
     const row = $('<div class="wm-char-row"></div>');
     const nameSpan = $('<span class="wm-char-name"></span>').text(token.name);
     row.append(nameSpan);
     ```
3. **Limpieza de Event Listeners**:
   - Al renderizar componentes dinámicos recurrentes (como listas de tokens o cuadrículas de mapa), asegurarse de desacoplar los listeners previos (`.off()`) o limpiar el contenedor antes de re-instanciar handlers para evitar fugas de memoria.
4. **Respeto al Presupuesto de Tokens**:
   - Cualquier nuevo bloque inyectado mediante `setExtensionPrompt` debe considerar el tamaño del contexto. Si es extenso, debe canalizarse a través del Dynamic Context Manager para someterse a la poda priorizada por tokens.

---

## 5. Enlaces Relacionados
- [[Mapa-Codigo-Archivos]]: Localización de todos los archivos del proyecto.
- *PROBLEMAS_TECNICOS*: Lista de problemas a tener en cuenta durante el desarrollo.
- [[PROPUESTAS_MEJORA]]: Líneas de trabajo recomendadas para futuras versiones.
