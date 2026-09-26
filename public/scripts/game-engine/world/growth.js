/**
 * El mundo crece mientras juegas (fase G).
 *
 * Los generadores ya existían, y buenos —nombres, sitios, gente, bichos, objetos, todo del
 * compendio y con la semilla del mundo—, pero solo los usaban el editor de campaña y los
 * encargos. Aquí se conectan al juego:
 *
 * - **G1 · Explorar los alrededores**: descubrir un sitio nuevo junto al que estás, con su
 *   camino. Con tope, porque un mapa que no se acaba deja de ser un mapa. Y nunca destapa
 *   los sitios escondidos de la trama: esos los revelan sus hitos y sus rumores.
 * - **G2 · Un tablero al llegar**: el sitio descubierto trae el suyo, de su tipo.
 * - **G3 · Gente**: cuánta falta en un sitio para que llegar sea llegar a alguna parte.
 * - **G6 · El chat propone**: el narrador puede **proponer** un sitio; queda apuntado como
 *   propuesta, y solo existe si quien juega va a buscarlo. El modelo no crea estado.
 *
 * Los bichos (G4) y los objetos (G5) los crían y forjan el bestiario y la forja del
 * compendio; aquí solo se decide cuántos y para qué.
 *
 * Puro: devuelve lo nuevo y no guarda nada.
 *
 * Ver wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase G.
 */

import { makeName } from '../compendio/names.js';
import { generateBoard } from '../world-builder/dungeon-generator.js';
import { terrainFromAsciiMap } from '../board/terrain.js';

/** Cuántos sitios puede tener el mapa, contando los descubiertos. */
export const MAX_PLACES = 18;

/** Cuánta gente con nombre hace falta en un sitio para que haya con quién hablar. */
export const PEOPLE_PER_PLACE = 2;

/** Cuántas propuestas del chat se guardan a la vez. */
export const MAX_PROPOSALS = 3;

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Si todavía se puede descubrir algo.
 *
 * @param {any[]} locations Los del mapa.
 * @param {any[]} [hidden] Los escondidos de la trama: cuentan, porque ya tienen su sitio.
 * @returns {boolean}
 */
export function canExplore(locations, hidden = []) {
    return (Array.isArray(locations) ? locations.length : 0) + (Array.isArray(hidden) ? hidden.length : 0) < MAX_PLACES;
}

/**
 * Descubrir un sitio junto al que estás.
 *
 * Su tipo sale de la batería de sitios, preferiblemente uno que pegue con el bioma de donde
 * estás; su nombre, de la de nombres. Queda a un día o dos de camino.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {any[]} input.locations Los que ya hay (y los escondidos, para no repetir nombre).
 * @param {string} input.here
 * @param {() => number} input.random
 * @param {string} [input.name] Si ya tiene nombre: una propuesta del chat.
 * @param {string} [input.note]  Y lo que se contó de él.
 * @param {'seed'|'chat'} [input.source]
 * @returns {any|null}
 */
export function discoverPlace({ compendium, locations, here, random, name = '', note = '', source = 'seed' }) {
    const places = Array.isArray(locations) ? locations : [];
    const home = places.find(l => text(l?.name).toLowerCase() === text(here).toLowerCase());
    if (!home) return null;

    const taken = places.map(l => text(l?.name)).filter(Boolean);
    const chosen = text(name) || makeName({ compendium, kind: 'place', random, taken });
    if (!chosen || taken.some(t => t.toLowerCase() === chosen.toLowerCase())) return null;

    const biome = text(home.biome);
    const type = compendium?.has?.('sitios')
        ? (compendium.pick('sitios', { where: { kind: 'tipo', biome }, random })
            ?? compendium.pick('sitios', { where: { kind: 'tipo' }, random }))
        : null;
    const days = 1 + Math.floor(random() * 2);

    return {
        name: chosen,
        description: [text(note), type ? `${text(type.name)}: ${text(type.note)}` : ''].filter(Boolean).join(' '),
        url: '',
        gridWidth: Number(home.gridWidth) || 20,
        gridHeight: Number(home.gridHeight) || 15,
        biome,
        locationType: text(type?.locationType),
        siteType: text(type?.id),
        shape: text(type?.shape),
        boards: [],
        // Un camino basta: el viaje los anda en los dos sentidos.
        routes: [{ to: text(home.name), days }],
        discovered: source,
    };
}

/**
 * El tablero de un sitio descubierto, de su forma y con los bichos que se le den.
 *
 * @param {Object} input
 * @param {any} input.place
 * @param {() => number} input.random
 * @param {string[]} [input.bestiary] Los nombres que pueden salir.
 * @param {number} [input.partySize]
 * @returns {any}
 */
export function boardForPlace({ place, random, bestiary = [], partySize = 1 }) {
    const generated = generateBoard({
        random,
        size: 'medium',
        shape: text(place?.shape) || 'rooms',
        bestiary,
        partySize: Math.max(1, partySize),
    });
    return {
        name: text(place?.name),
        description: text(place?.description),
        url: '',
        gridWidth: generated.gridWidth,
        gridHeight: generated.gridHeight,
        terrain: terrainFromAsciiMap(generated.map),
        partyStart: generated.partyStart,
        enemyPlacements: generated.enemies,
        objectives: [],
        isCombat: generated.enemies.length > 0,
    };
}

/**
 * Cuánta gente falta en un sitio.
 *
 * @param {number} present Los que ya viven ahí.
 * @param {number} [want]
 * @returns {number}
 */
export function peopleWanted(present, want = PEOPLE_PER_PLACE) {
    return Math.max(0, Math.floor(want) - Math.max(0, Math.floor(Number(present) || 0)));
}

/**
 * @typedef {{name: string, note: string, near: string}} Proposal
 */

/**
 * @param {any} raw
 * @returns {Proposal[]}
 */
export function readProposals(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(p => p && text(p.name))
        .map(p => ({ name: text(p.name), note: text(p.note), near: text(p.near) }))
        .slice(-MAX_PROPOSALS);
}

/**
 * Apuntar lo que propone el narrador. No crea nada: queda como opción para quien juega.
 *
 * Un nombre que ya existe en el mapa, o ya propuesto, no se apunta dos veces. Las viejas
 * se olvidan: el chat sigue y la cueva de hace veinte turnos ya no se estaba mirando.
 *
 * @param {any} raw
 * @param {{name: string, note?: string, near?: string}} proposal
 * @param {string[]} [existing] Los nombres que ya hay en el mapa.
 * @returns {{proposals: Proposal[], added: boolean, reason: string}}
 */
export function addProposal(raw, proposal, existing = []) {
    const list = readProposals(raw);
    const name = text(proposal?.name);
    if (!name) return { proposals: list, added: false, reason: 'Sin nombre.' };
    const known = [...existing, ...list.map(p => p.name)].map(n => text(n).toLowerCase());
    if (known.includes(name.toLowerCase())) return { proposals: list, added: false, reason: 'Ya está.' };
    return {
        proposals: [...list, { name, note: text(proposal.note), near: text(proposal.near) }].slice(-MAX_PROPOSALS),
        added: true,
        reason: '',
    };
}

/**
 * Sacar una propuesta de la lista, al ir a buscarla.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {{proposal: Proposal|null, proposals: Proposal[]}}
 */
export function takeProposal(raw, name) {
    const list = readProposals(raw);
    const wanted = text(name).toLowerCase();
    const proposal = list.find(p => p.name.toLowerCase() === wanted) ?? null;
    return { proposal, proposals: list.filter(p => p !== proposal) };
}
