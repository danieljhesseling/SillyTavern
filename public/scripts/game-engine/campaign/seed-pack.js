/**
 * Las campañas que el juego hace con la semilla (J10.7 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * En `mundos.json` hay mundos sin paquete: solo un nombre, un género, una sinopsis y una semilla
 * («La costa que no duerme», «Las tierras del ocaso», «El mundo tras la pantalla»). El tablón del
 * gremio solo sabía empezar campañas con paquete, así que no salían. Aquí se hace el paquete con
 * la semilla, con las mismas piezas con las que el taller hace un mundo nuevo:
 *
 * - **El pueblo** donde se empieza, con nombre de la batería de nombres, su posada, su tienda, su
 *   herrería y su templo, y quien atiende cada una (los oficios de `compendio/actos.json`).
 * - **Sus vecinos**, con sus caminos (`neighbours.js`), y las **facciones** repartidas por ellos
 *   con sus metas y sus relojes (`factions.js`).
 *
 * La historia la pone después `act-grammar.js` (tres actos), y los tableros y los bichos,
 * `pack-fill.js`. `seedCampaignPack` hace las tres cosas.
 *
 * Todo con la semilla del mundo: la misma fila da siempre la misma campaña.
 *
 * Puro: el compendio entra como argumento.
 */

import { createSeededRandom } from '../combat/seeded-random.js';
import { makeName } from '../compendio/names.js';
import { rollNeighbours } from '../world/neighbours.js';
import { rollFactions } from './factions.js';
import { derive, cleanSeed } from './seed.js';
import { guessPlaceType, fillPackGaps } from './pack-fill.js';
import { steadyCompendium, withActThread, needsActThread, DEFAULT_CULTURE } from './act-grammar.js';

/** Lo que tiene el pueblo donde se empieza, en este orden. */
export const SEED_TOWN_SERVICES = ['posada', 'tienda', 'herreria', 'templo'];

/**
 * Los días de camino entre dos sitios, como mucho. La historia va de un sitio a otro cinco o
 * seis veces: con caminos de una semana, se pasa más tiempo andando que jugando.
 */
export const SEED_MAX_DAYS = 3;

/** Para qué niveles es una campaña de semilla si su fila no lo dice. */
export const SEED_LEVELS = [1, 3];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value : []);

/** @param {any} value @returns {string} */
const slug = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Si una fila del tablón es de las que se hacen con la semilla: sin paquete y con semilla.
 *
 * @param {any} row
 * @returns {boolean}
 */
export function isSeedWorld(row) {
    return Boolean(row && typeof row === 'object' && !text(row.pack) && cleanSeed(row.seed));
}

/**
 * El paquete de una fila de semilla, sin historia todavía: el pueblo, sus vecinos, las
 * facciones y la gente que atiende el pueblo.
 *
 * @param {any} row La fila de `mundos.json`.
 * @param {{compendium: any}} options
 * @returns {any}
 */
export function seedWorldPack(row, { compendium }) {
    const seed = cleanSeed(row?.seed) || cleanSeed(slug(row?.name)) || 'campana';
    const steady = steadyCompendium(compendium);
    /** @param {string} part */
    const rng = (part) => createSeededRandom(derive(seed, 'paquete', part));
    const name = text(row?.name) || 'Una campaña';

    const townName = makeName({ compendium: steady, kind: 'place', random: rng('pueblo') }) || name;
    const town = { name: townName, type: 'village', services: [...SEED_TOWN_SERVICES], routes: [] };
    const neighbours = rollNeighbours({ compendium: steady, locations: [town], random: rng('vecinos') })
        .map((/** @type {any} */ place) => ({
            name: text(place.name),
            type: guessPlaceType(place.name),
            ...(text(place.biome) ? { biome: text(place.biome) } : {}),
            routes: list(place.routes).map((/** @type {any} */ r) => ({ to: text(r.to), days: Math.min(SEED_MAX_DAYS, Math.max(1, Math.floor(Number(r.days) || 1))) })),
        }));
    const locations = [town, ...neighbours];

    const factions = rollFactions({ compendium: steady, locations, random: rng('facciones') })
        .map((/** @type {any} */ f) => ({
            id: text(f.id),
            name: text(f.name),
            goals: text(f.note),
            onSuccess: text(f.note),
            reputation: 0,
            seat: text(f.seat),
            holds: list(f.holds).map(text).filter(Boolean),
            enemies: list(f.enemies).map(text).filter(Boolean),
            goal: { kind: text(f.goal?.kind), target: text(f.goal?.target), pace: Math.max(1, Math.floor(Number(f.goal?.pace) || 7)) },
        }));

    // Quien atiende cada servicio del pueblo, y alguien en cada sitio de alrededor: un sitio sin
    // nadie con quien hablar es un sitio sin nada que hacer.
    const people = steadyPeople({
        compendium, steady, town: townName, around: neighbours.map(n => n.name), random: rng('gente'),
        culture: text(row?.culture) || DEFAULT_CULTURE,
    });

    const levels = Array.isArray(row?.levels) && row.levels.length > 0 ? row.levels : SEED_LEVELS;
    return {
        version: 1,
        world: {
            name,
            genre: text(row?.genre),
            synopsis: text(row?.synopsis),
            seed,
            levels,
            // J10.7: la trama que pide la fila, si pide una (el id de una fila de `actos.json`).
            ...(text(row?.trama) ? { trama: text(row.trama) } : {}),
            factions,
        },
        locations,
        npcs: people,
        boards: [],
    };
}

/**
 * La gente del mundo: una persona por servicio del pueblo, y una más en cada sitio de alrededor
 * (con los oficios de quien ve las cosas: pastora, leñador…). Cada una con el oficio que va con
 * su nombre.
 *
 * @param {{compendium: any, steady: any, town: string, around: string[], random: () => number, culture: string}} input
 * @returns {any[]}
 */
function steadyPeople({ compendium, steady, town, around, random, culture }) {
    const rows = compendium?.has?.('actos') ? compendium.find('actos', { kind: 'oficio' }) : [];
    /** @type {string[]} */
    const taken = [];
    /** @type {any[]} */
    const out = [];
    /**
     * @param {any} row
     * @param {string[]} pair
     * @param {string} where
     * @param {string} service
     */
    const add = (row, pair, where, service) => {
        const name = makeName({ compendium: steady, kind: 'person', culture, random, taken });
        if (!name || !text(pair?.[0])) return;
        taken.push(name);
        out.push({
            id: `${service || 'vecino'}-${slug(name)}`,
            name,
            trade: text(/a$/i.test(name) ? pair[1] : pair[0]) || text(pair[0]),
            where,
            wants: text(row?.quiere),
            knows: text(row?.sabe),
            secret: '',
            voice: text(row?.voz),
            ...(service ? { service } : {}),
        });
    };
    for (const service of SEED_TOWN_SERVICES) {
        const row = rows.find((/** @type {any} */ r) => text(r.papel) === service);
        add(row, list(row?.formas)[0] ?? [], town, service);
    }
    const locals = rows.find((/** @type {any} */ r) => text(r.papel) === 'testigo');
    const forms = list(locals?.formas);
    for (const where of around) {
        if (forms.length === 0) break;
        add(locals, forms[Math.floor(random() * forms.length) % forms.length], where, '');
    }
    return out;
}

/**
 * Una campaña lista para el tablón: el paquete de la semilla (si la fila no trae paquete), su
 * historia en tres actos si no traía hilo, y lo que falte, rellenado (`fillPackGaps`).
 *
 * Con un paquete que ya trae hilo, se devuelve tal cual.
 *
 * @param {Object} input
 * @param {any} [input.row] La fila de `mundos.json`, para hacer el paquete con la semilla.
 * @param {any} [input.pack] Un paquete ya leído (una campaña de tu Gem sin hilo).
 * @param {any} input.compendium
 * @returns {{pack: any, made: boolean}} `made`: si se le ha puesto la historia.
 */
export function seedCampaignPack({ row = null, pack = null, compendium }) {
    const base = pack ?? seedWorldPack(row, { compendium });
    if (!needsActThread(base)) return { pack: base, made: false };
    const seed = cleanSeed(base?.world?.seed) || cleanSeed(row?.seed) || '';
    const threaded = withActThread(base, { compendium, seed });
    if (!threaded.made) return { pack: base, made: false };
    return { pack: fillPackGaps(threaded.pack, { compendium, seed }).pack, made: true };
}
