---
title: Almacenamiento & Persistencia de Datos
tags: [persistencia, storage, jsonl, png, metadata, filesystem, dnd, backup]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Almacenamiento & Persistencia de Datos

SillyTavern utiliza una arquitectura de persistencia basada íntegramente en el **sistema de archivos local** (Flat-File Storage). No requiere bases de datos SQL o NoSQL externas (como PostgreSQL o MongoDB), lo que garantiza portabilidad absoluta, facilidad de copias de seguridad y privacidad completa para el usuario.

Este documento explica cómo se estructuran las carpetas en `data/`, el formato de cada tipo de archivo y los mecanismos de sincronización de estado.

---

## 1. Topología del Directorio de Datos (`data/`)

Cuando se ejecuta en modo usuario único, los datos residen en `data/default-user/`. En modo multi-usuario (`enableUserAccounts: true`), cada cuenta posee una carpeta independiente basada en su identificador o nombre sanitizado:

```
data/
└── <user_handle>/
    ├── characters/          # Tarjetas de personaje (imágenes PNG con metadatos y archivos JSON)
    ├── chats/               # Historiales de chat individuales (archivos .jsonl)
    ├── groupChats/          # Historiales de chats grupales (archivos .jsonl)
    ├── groups/              # Definiciones de grupos (archivos JSON con miembros y configuraciones)
    ├── worlds/              # Lorebooks / World Info (archivos JSON con facciones, monstruos, dndData)
    ├── avatars/             # Avatares del usuario
    ├── backgrounds/         # Fondos de pantalla subidos o generados
    ├── userImages/          # Imágenes compartidas en chats y multimedia
    ├── settings.json        # Preferencias de interfaz, samplers y configuración del usuario
    ├── secrets.json         # Claves de API externas (cifradas u ocultas por el servidor)
    ├── themes/              # Temas CSS personalizados
    ├── instruct/            # Plantillas de formato de instrucción (Alpaca, Vicuna, ChatML, Llama-3)
    ├── context/             # Plantillas de contexto de sistema (System Prompts y separadores)
    ├── quickreplies/        # Botones de respuesta rápida configurados
    ├── assets/              # Archivos auxiliares, audios, mapas y tableros importados
    ├── vectors/             # Índices vectoriales en disco generados por Vectra
    └── backups/             # Instantáneas automáticas de chats y datos
```

---

## 2. Formato de Tarjetas de Personaje (`characters/`)

SillyTavern es el estándar de facto para la especificación de tarjetas de personaje V2 y V3. Se guardan predominantemente como **archivos PNG con metadatos embebidos**:

```
Archivo PNG (Imagen física de 512x768 o similar)
├── Fragmento IHDR (Cabecera de imagen)
├── Fragmento IDAT (Datos comprimidos de la imagen gráfica)
├── Fragmento tEXt / iTXt (Clave 'chara')
│   └── Base64 Payload -> JSON con la definición del personaje:
│       {
│         "spec": "chara_card_v2",
│         "data": {
│           "name": "Eldrin el Mago",
│           "description": "Un elfo erudito con túnica azul...",
│           "personality": "Analítico, reservado, curioso",
│           "first_mes": "Saludos, viajero. ¿Qué te trae a mi torre?",
│           "scenario": "Encontrándose en la biblioteca arcana",
│           "mes_example": "<START>\n{{user}}: Hola\n{{char}}: Bienvenido.",
│           "creator_notes": "...",
│           "character_book": { ... } // Lorebook embebido si lo tiene
│         }
│       }
└── Fragmento IEND
```

- Si una tarjeta se importa en formato `.json` plano, el servidor la almacena como tal o genera un PNG sintético con un avatar genérico.
- La lectura y escritura de estos fragmentos PNG se gestiona en el servidor mediante `src/png/png-chunks-extract.js` y `src/png/png-chunk-text.js`.

---

## 3. Formato de Chats: Archivos JSONL (`chats/*.jsonl`)

Los chats se almacenan en formato JSON Lines (cada línea es un documento JSON independiente terminado en salto de línea). Esto permite lecturas parciales y escrituras incrementales eficientes.

### A. Línea 0: El Objeto de Metadatos (`chat_metadata`)
La primera línea del archivo JSONL define el estado contextual completo de la conversación:

```json
{
  "user_name": "Aventurero",
  "character_name": "Eldrin",
  "create_date": 1726820000000,
  "world_info": "Mundo_Faerun",
  "currentLocation": "Bosque del Susurro",
  "currentBoard": "Campamento Nocturno",
  "party": [
    {
      "id": 1,
      "name": "Valerius",
      "level": 3,
      "class": "Guerrero",
      "race": "Humano",
      "hp": 28,
      "maxHp": 28,
      "xp": 900,
      "xpNext": 2700,
      "gold": 45,
      "silver": 12,
      "copper": 5,
      "strength": 16,
      "dexterity": 12,
      "constitution": 14,
      "intelligence": 10,
      "wisdom": 11,
      "charisma": 13,
      "armorClass": 16,
      "inventory": "Espada larga, Escudo, Raciones (x5)",
      "conditions": "Ninguna",
      "items": [ ... ],
      "relationships": [ ... ],
      "mapPosition": { "x": 120, "y": 240 }
    }
  ],
  "dynamicContext": {
    "campaign": {
      "currentState": "combat",
      "activeLocation": "Bosque del Susurro",
      "activeQuests": ["Derrotar a los incursores goblins"],
      "tokenBudget": 1500
    },
    "instructions": [ ... ]
  }
}
```

### B. Líneas Subsiguientes: Mensajes Individuales
A partir de la línea 1, cada registro describe un turno de conversación:

```json
{
  "name": "Valerius",
  "is_user": true,
  "is_name": true,
  "send_date": 1726820010000,
  "mes": "Desenvaino mi espada y me coloco frente al grupo en posición defensiva.",
  "extra": {
    "dndRoll": { "formula": "1d20+5", "total": 18, "type": "initiative" }
  }
}
{
  "name": "Eldrin",
  "is_user": false,
  "is_name": true,
  "send_date": 1726820015000,
  "mes": "Comienzo a conjurar una barrera de energía mágica. *«¡Mantengan la formación!»*, grito.",
  "swipes": [
    "Comienzo a conjurar una barrera...",
    "Preparo un rayo de fuego hacia la penumbra..."
  ],
  "swipe_id": 0
}
```

---

## 4. Lorebooks con Metadatos D&D (`worlds/*.json`)

Los Lorebooks almacenan información del mundo y entradas reactivas por palabras clave. En este fork, cada entrada (`entries[uid]`) incluye propiedades D&D adicionales en `dndData`:

```json
{
  "name": "Mundo_Faerun",
  "metadata": {
    "displayName": "Reinos Olvidados",
    "genre": "High Fantasy",
    "coverImage": "/assets/faerun-cover.webp",
    "worldMapUrl": "/assets/mapa-reinos.webp"
  },
  "entries": {
    "101": {
      "uid": 101,
      "key": ["Goblin", "Trasgo"],
      "comment": "Goblin Explorador",
      "content": "Pequeña criatura humanoide verde, astuta y cobarde en solitario.",
      "disable": false,
      "dndData": {
        "entityType": "monster",
        "name": "Goblin Incursor",
        "cr": "1/4",
        "hp": 7,
        "maxHp": 7,
        "armorClass": 15,
        "speed": 30,
        "abilities": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 }
      }
    }
  }
}
```

---

## 5. Sincronización y Retos de Persistencia

### Doble Persistencia de Party (Metadata vs LocalStorage)
Como se detalla en `public/scripts/party.js`:
- `savePartyState()` guarda en `window.localStorage.setItem('sillytavern_partyMembers', ...)` para respaldo rápido en navegador.
- Paralelamente, `savePartyToMetadata()` persiste en `chat_metadata.party` y llama a `saveMetadata()`, enviando una petición `POST /api/chats/save` al backend.
- **Riesgo Detectado**: Si el usuario abre dos pestañas del navegador con chats distintos, `localStorage` sobreescribe el grupo globalmente provocando desincronización entre chats. La fuente de la verdad debe ser siempre `chat_metadata`.

---

## 6. Enlaces Relacionados
- [[Backend-Express]]: Controladores de guardado y endpoints `/api/chats/*`.
- [[Sistema-Party]]: Estructura en memoria del array `partyMembers`.
- [[Campanas-Mapas-Tableros]]: Vinculación de mapas con el archivo de mundo.
- *PROBLEMAS_TECNICOS*: Análisis de escrituras concurrentes y atomicidad en disco.
