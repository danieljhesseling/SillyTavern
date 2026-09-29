/**
 * El estado que escriben varios módulos: el grupo, dónde está, el combate, con quién se habla.
 *
 * Cada variable se exporta tal cual (quien la importa ve siempre su valor de ahora) y se
 * cambia solo con su `set…`: un módulo no puede asignar lo que importa. Lo que escribe un
 * solo módulo no está aquí: vive en ese módulo. Una hoja: no importa nada.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md).
 */

/** @typedef {import('./types.js').PartyMember} PartyMember */

/** @type {PartyMember[]} */
export let partyMembers = [];
/** @param {PartyMember[]} value */
export function setPartyMembers(value) { partyMembers = value; }

/** @type {{ tokenId: number|null, boardName: string, locationName: string }} */
export let combatBoardSelection = { tokenId: null, boardName: '', locationName: '' };
/** @param {{ tokenId: number|null, boardName: string, locationName: string }} value */
export function setCombatBoardSelection(value) { combatBoardSelection = value; }

/**
 * Quien ha gastado ya su reaccion en esta ronda.
 *
 * Un ataque de oportunidad cuesta la reaccion, y la reaccion es una por ronda: sin esto,
 * un solo enemigo cobraria peaje a todo el grupo cada vez que alguien se mueve.
 * @type {Set<string>}
 */
export let usedReactions = new Set();
/** @param {Set<string>} value */
export function setUsedReactions(value) { usedReactions = value; }

/** Currently selected location name — per-chat, stored in chat_metadata */
export let currentLocationName = '';
/** @param {string} value */
export function setCurrentLocationName(value) { currentLocationName = value; }
/** Currently selected board name — per-chat, stored in chat_metadata */
export let currentBoardName = '';
/** @param {string} value */
export function setCurrentBoardName(value) { currentBoardName = value; }

/**
 * Las facciones del mundo abierto, ya leidas.
 *
 * Mismo apano que `lastCompendium`: `renderCampaignTab` se dibuja de golpe y no puede ser
 * `async`. Sin facciones escritas esto es una lista vacia y el panel queda como estaba.
 *
 * @type {any[]}
 */
export let currentWorldFactions = [];
/** @param {any[]} value */
export function setCurrentWorldFactions(value) { currentWorldFactions = value; }

/**
 * The fight in progress.
 *
 * Typed as the turn machine's own Encounter now that the machine is what runs it: there
 * is one definition of a turn, and this is it. The enemy list stays widened to the game's
 * EnemyInstance, which carries the sheet the machine does not care about.
 *
 * @type {import('../game-engine/combat/turn-machine.js').Encounter & { enemies: import('../dnd-system.js').EnemyInstance[], collectedTreasures?: string[] }}
 */
export let combatEncounter = { active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null };
/** @param {import('../game-engine/combat/turn-machine.js').Encounter & { enemies: import('../dnd-system.js').EnemyInstance[], collectedTreasures?: string[] }} value */
export function setCombatEncounter(value) { combatEncounter = value; }

/**
 * The combat log shown beside the board.
 *
 * Session state on purpose: the log is a read-out of a fight in progress, and the fight
 * itself already lives in the encounter. Writing 300 entries into the world info on every
 * swing would grow the saved campaign for something nobody reads twice. A reload starts
 * a fresh log, and the chat still holds every line.
 *
 * @type {import('../game-engine/ui/combat-log.js').LogEntry[]}
 */
export let combatLogEntries = [];
/** @param {import('../game-engine/ui/combat-log.js').LogEntry[]} value */
export function setCombatLogEntries(value) { combatLogEntries = value; }

/**
 * Los objetos que la campana abierta tiene escritos.
 *
 * Se guarda aqui porque el botin se reparte en mitad de un combate y leer el mundo del
 * disco en ese momento seria esperar por algo que ya se sabe. Se rellena al abrir la
 * campana y al guardarla desde el editor, que son las dos unicas veces que cambia.
 *
 * @type {any[]}
 */
export let worldItemCatalogue = [];
/** @param {any[]} value */
export function setWorldItemCatalogue(value) { worldItemCatalogue = value; }

/** Con quién se está hablando, para las respuestas sugeridas (idea 144). */
export let talkingTo = '';
/** @param {string} value */
export function setTalkingTo(value) { talkingTo = value; }

/** Lo que se acaba de escribir es para el narrador: contesta él, y con su nombre. */
export let narratorTurn = false;
/** @param {boolean} value */
export function setNarratorTurn(value) { narratorTurn = value; }

/**
 * Los dias que le deben a las facciones.
 *
 * Se acumulan y se vuelcan de una vez porque escribir el mundo es asincrono: un viaje de
 * cinco dias llama a `advanceCampaignDay` cinco veces seguidas, y cinco escrituras a la
 * vez del mismo archivo es como se pierde una. El `setTimeout(0)` espera a que termine el
 * bucle entero, que es sincrono, y entonces pasa los cinco dias de golpe.
 */
export let factionDaysDue = 0;
/** @param {number} value */
export function setFactionDaysDue(value) { factionDaysDue = value; }

/** Lo que pide lo que se esta escribiendo (idea 137). */
/** @type {string[]} */
export let typedIntents = [];
/** @param {string[]} value */
export function setTypedIntents(value) { typedIntents = value; }
