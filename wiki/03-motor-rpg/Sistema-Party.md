---
title: Sistema de Party (Grupo RPG) & Gestión de Miembros
tags: [rpg, party, dnd, personajes, inventario, estadisticas, leveling, sincronizacion]
created: 2026-09-20
author: DanielJHesseling / Antigravity AI
---

# Sistema de Party (Grupo RPG) & Gestión de Miembros

El módulo **Sistema de Party** (`public/scripts/party.js`) es la columna vertebral de la experiencia de juego de rol introducida en la rama `my-silly`. Transforma la interacción tradicional 1-a-1 de SillyTavern en una campaña cooperativa o en solitario con un grupo activo de aventureros que comparten inventario, combate, economía y presencia espacial.

---

## 1. El Modelo de Datos `PartyMember`

Cada aventurero en el grupo se representa mediante un objeto tipado exhaustivo con atributos D&D 5e completos:

```typescript
interface PartyMember {
  id: number;                          // Identificador numérico único
  personaId: string | null;            // Vínculo con una persona de SillyTavern
  wiUid?: number | null;               // Vínculo con una entrada de World Info
  worldName?: string | null;           // Mundo al que pertenece
  name: string;                        // Nombre visible del personaje
  avatar: string;                      // URL o ruta al avatar del personaje
  group?: string;                      // Facción o gremio
  level: number;                       // Nivel (1 a 20)
  class: string;                       // Clase (Guerrero, Mago, Pícaro, Clérigo, etc.)
  race: string;                        // Raza (Humano, Elfo, Enano, etc.)
  factions: string[];                  // Facciones con las que tiene afinidad
  
  // Recursos y Progresión
  hp: number;                          // Puntos de golpe actuales
  maxHp: number;                       // Puntos de golpe máximos
  xp: number;                          // Experiencia acumulada
  xpNext: number;                      // Experiencia requerida para el siguiente nivel
  gold: number;                        // Monedas de Oro (gp)
  silver: number;                      // Monedas de Plata (sp)
  copper: number;                      // Monedas de Cobre (cp)
  
  // Atributos D&D 5e (1-30)
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  armorClass: number;                  // Clase de Armadura base calculada
  speed: number;                       // Velocidad en pies (ej. 30 ft)
  
  // Estado e Inventario
  inventory: string;                   // Resumen textual de equipo
  conditions: string;                  // Estados alterados (ej. "Envenenado")
  activeConditions: string[];          // Array estructurado de condiciones
  alignment: string;                   // Alineamiento moral (ej. "Neutral Good")
  personality: string;                 // Rasgos de personalidad
  
  // Colecciones Avanzadas (dnd-system.js)
  items: DndItem[];                    // Inventario de objetos detallados
  equippedItems: Record<string, string | null>; // Ranura -> ID de objeto
  relationships: DndRelationship[];    // Lazos afectivos y de lealtad
  memories: DndMemory[];               // Recuerdos clave de eventos pasados
  mapPosition: { x: number; y: number; boardName?: string }; // Posición táctica
}
```

---

## 2. El Cajón del Grupo (`#party_drawer`) y UI en Vivo

El sistema proporciona una barra de estado accesible en cualquier momento en la interfaz principal:

```mermaid
graph TD
    PartyDrawer[#party_drawer: Cajón Superior/Lateral] --> LeaderCard[Tarjeta del Líder: Valerius]
    PartyDrawer --> MemberCard2[Tarjeta: Lyra (Maga)]
    PartyDrawer --> MemberCard3[Tarjeta: Thorin (Clérigo)]
    PartyDrawer --> AddMemberBtn[+ Añadir Aventurero]
    
    LeaderCard --> BarHP[Barra de Vida en Vivo: HP 24/28]
    LeaderCard --> BarXP[Barra de Progreso: XP 1400/2700]
    LeaderCard --> GoldBadge[Monedero: 45 gp, 12 sp]
    LeaderCard --> OpenSheetBtn[Abrir Ficha D&D Completa]
```

- **Líder Activo (`partyMembers[0]`)**: El primer miembro del array actúa como el líder del grupo. 
- **Relevo Automático del Hablante**: Cuando hay un grupo cargado, el líder suplanta al usuario global en el chat mediante `setUserName(partyMembers[0].name, { toastPersonaNameChange: false })`. De este modo, los personajes del LLM se dirigen al líder del grupo por su nombre de rol sin requerir cambio manual de perfil.

---

## 3. Subida de Nivel y Progresión Automática

El módulo implementa las fórmulas estándar de D&D 5e:
- Al recibir experiencia mediante la UI o el comando `/party addxp [nombre] [puntos]`, el sistema comprueba si `xp >= xpNext`.
- Si se supera el umbral:
  1. Incrementa `level`.
  2. Dispara un diálogo de felicitación y animación de subida de nivel.
  3. Calcula el incremento de puntos de golpe según el dado de golpe de la clase (`classHitDice`) y el modificador de Constitución (`Math.floor((constitution - 10) / 2)`).
  4. Actualiza `xpNext` hacia el siguiente escalón de la tabla.

---

## 4. Persistencia y Ciclo de Vida

El estado del grupo se conserva mediante un doble mecanismo en `party.js`:

```javascript
// public/scripts/party.js (Líneas ~93-122)
function savePartyState() {
    // 1. Respaldo local en el almacenamiento del navegador
    try {
        window.localStorage.setItem('sillytavern_partyMembers', JSON.stringify(partyMembers));
    } catch (e) {
        console.warn('Unable to save party state', e);
    }
    // 2. Persistencia atómica en el chat actual
    savePartyToMetadata();
}

async function savePartyToMetadata() {
    if (!chat_metadata) return;
    chat_metadata['party'] = JSON.parse(JSON.stringify(partyMembers));
    await saveMetadata(); // Emite POST /api/chats/save al backend
}
```

Al cambiar de chat (`event_types.CHAT_CHANGED`), se invoca `loadPartyForChat()`:
1. Lee `chat_metadata.party`.
2. Aplica migraciones de esquema mediante `migratePartyMember()`.
3. Restaura el inventario, equipamiento y posición en el mapa.
4. Actualiza el DOM del cajón de grupo.

---

## 5. Overlay de Dados y Combate (`combatDiceQueue`)

Cuando un miembro del grupo realiza una acción de combate o una tirada de dados:
- Las tiradas se encolan en `combatDiceQueue`.
- El componente `combatDiceOverlayElement` muestra un dado 3D virtual o una animación de tarjeta con el desglose de la fórmula (ej. `1d20 [14] + 3 = 17`), coloreando en verde los éxitos críticos (20 natural) y en rojo las pifias (1 natural).

---

## 6. Enlaces Relacionados
- [[DND-Mecanicas-Items]]: Ranuras de equipamiento y cálculo de modificadores.
- [[Dynamic-Context-Manager]]: Cómo se inyecta la salud y el inventario del grupo al LLM.
- [[Campanas-Mapas-Tableros]]: Posicionamiento de los miembros del grupo en tableros.
- [[Relaciones-Memorias]]: Sistema de afecto y lealtad entre compañeros.
