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

El proyecto opera sobre la rama personalizada `my-silly`:
- **Rama Activa**: `my-silly` (alberga todas las características de Party, D&D, Mapas y Dynamic Context).
- **Ramas Upstream**: `origin/staging` o `origin/release` del repositorio oficial de SillyTavern.
- **Recomendación para Merges / Rebase**:
  Al sincronizar con el upstream oficial de SillyTavern, prestar especial atención a los archivos centrales modificados (`public/script.js`, `public/index.html`, `public/scripts/world-info.js`, `public/scripts/personas.js`), resolviendo posibles conflictos de marcado DOM de forma manual para no sobreescribir los modales D&D.

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
- [[PROBLEMAS_TECNICOS]]: Lista de problemas a tener en cuenta durante el desarrollo.
- [[PROPUESTAS_MEJORA]]: Líneas de trabajo recomendadas para futuras versiones.
