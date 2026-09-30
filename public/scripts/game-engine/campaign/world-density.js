/**
 * ¿Llega este mundo al listón? El comprobador de densidad (M6), como pieza del motor.
 *
 * Vivía solo en `tools/check-world-density.mjs`, para la consola. Aquí está la cuenta, para
 * que la use también el taller (idea 181): quien crea un mundo ve lo que le falta sin salir
 * del juego, y la herramienta sigue diciendo exactamente lo mismo.
 *
 * Cuenta lo que hay contra el listón y, sobre todo, **busca huecos**: un sitio al que no se
 * puede llegar, un rumor que apunta a la nada, un hito que nunca se abre, un PNJ que no
 * quiere nada o un encargo cuyo tablero no existe.
 *
 * Y, desde J10.2 y J10.4 (wiki/ROADMAP_SIN_CONEXION.md), **sitio por sitio**: cada localización
 * con gente o servicios, algo que mirar, un rumor o un hito, un secreto y, si toca, un tablero;
 * y los secretos del mundo, con cómo se descubre cada uno.
 *
 * Puro: recibe el paquete y devuelve el informe.
 */

import { spellById, magicInData } from '../rules/grimoire.js';
import { tamableAs } from './pet.js';
import { servicesOf } from './services.js';
import { readSights } from './sights.js';

/** El listón, por mundo. Los mínimos de la tabla de M1 (lo escrito), y los de J10.4. */
export const QUOTA = {
    milestones: 12, endings: 2, contracts: 14, chains: 3, noFightShare: 1 / 3,
    visible: 7, hidden: 2, npcs: 22, confidants: 5, scenesEach: 5, maps: 10,
    encounters: 15, bestiary: 15, bosses: 3, factions: 3, items: 20, rumors: 25,
    objectiveKinds: 4, secrets: 3, secretWays: 3,
};

/**
 * J10.2: lo que tiene que tener cada localización. La clave es la de `has` en `placeDensity`;
 * el texto, cómo se dice lo que falta.
 */
export const PLACE_NEEDS = {
    who: 'gente o servicios',
    look: 'algo que mirar',
    event: 'un rumor o un hito',
    secret: 'un secreto',
    board: 'un tablero',
};

/**
 * J10.4: cómo se descubre un secreto. Un sitio que solo revela un hito de la historia no es un
 * secreto: es el siguiente capítulo (`hilo`, que no se cuenta).
 */
export const SECRET_WAYS = {
    rumor: 'un rumor',
    persona: 'una persona',
    tirada: 'una tirada',
    objeto: 'un mapa o un objeto',
    llegar: 'llegar hasta allí',
    pelea: 'una pelea',
    encargo: 'un encargo',
};

/** Los tipos de localización que piden tablero siempre: una mazmorra sin él no se juega. */
const BOARD_TYPES = new Set(['dungeon']);

/** @param {any} v */
const text = (v) => String(v ?? '').trim();
/** @param {any} v */
const low = (v) => text(v).toLowerCase();
/** @param {any} v @returns {any[]} */
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * Una lista dicha: «a», «a y b», «a, b y c».
 *
 * @param {string[]} items
 * @returns {string}
 */
function sayList(items) {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * @typedef {Object} PlaceCheck Una localización, contra lo que pide J10.2.
 * @property {string} name
 * @property {boolean} hidden
 * @property {Record<keyof typeof PLACE_NEEDS, boolean>} has
 * @property {boolean} needsBoard Si le toca tablero: una mazmorra, o un encargo con pelea aquí.
 * @property {string[]} missing Lo que le falta, dicho (`PLACE_NEEDS`).
 * @property {number} reasons Cuántas razones distintas hay para ir: gente, servicios, algo que
 *   mirar, rumores, el hilo, un secreto, un tablero y encargos.
 * @property {boolean} ok
 */

/**
 * @typedef {Object} WorldSecret Un secreto del mundo (J10.4).
 * @property {string} what El sitio escondido, o el título del hito oculto.
 * @property {'sitio'|'cosa'} kind
 * @property {string[]} ways Cómo se descubre (claves de `SECRET_WAYS`).
 * @property {string[]} where Dónde se descubre: las localizaciones, con su nombre.
 */

/**
 * @typedef {Object} DensityReport
 * @property {string} name
 * @property {string[]} counts Una línea por cifra del listón, con ✓ o ✗.
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {Array<{label: string, value: number, min: number, shown: string}>} short Lo que falta para el listón.
 * @property {PlaceCheck[]} places Cada localización, sitio por sitio (J10.2).
 * @property {WorldSecret[]} secrets Los secretos del mundo (J10.4).
 * @property {boolean} ok
 */

/**
 * Lo que las cuentas de J10 necesitan saber del paquete, leído una vez: dónde vive cada cual,
 * dónde está cada tablero y qué hitos traen una reliquia.
 *
 * @param {any} pack
 */
function worldIndex(pack) {
    const locations = list(pack?.locations).filter(l => text(l?.name));
    const people = [...list(pack?.npcs), ...list(pack?.confidants)].filter(p => text(p?.name));
    const boards = list(pack?.boards);
    /** @type {Map<string, string>} */
    const boardPlace = new Map();
    for (const b of boards) {
        if (text(b?.name)) boardPlace.set(low(b.name), low(b.locationName));
        if (text(b?.id)) boardPlace.set(low(b.id), low(b.locationName));
    }
    /**
     * Dónde vive alguien, por su nombre entero o por un trozo (el hilo escribe «Karl»).
     *
     * @param {any} name
     * @returns {string}
     */
    const whereIs = (name) => {
        const wanted = low(name);
        if (!wanted) return '';
        const person = people.find(p => low(p.name) === wanted) ?? people.find(p => low(p.name).includes(wanted));
        return low(person?.where);
    };
    return {
        locations,
        people,
        boards,
        boardPlace,
        whereIs,
        hidden: new Set(locations.filter(l => l.hidden).map(l => low(l.name))),
        names: new Map(locations.map(l => [low(l.name), text(l.name)])),
        milestones: list(pack?.plot?.milestones),
        rumors: list(pack?.rumors),
        relics: new Set(list(pack?.items).filter(i => i?.boundTo?.kind === 'milestone' && text(i.boundTo.id)).map(i => text(i.boundTo.id))),
    };
}

/**
 * Las localizaciones a las que está atado un hito: donde pide llegar, hablar, buscar pistas,
 * ganar o derrotar a alguien, y donde se abre al llegar.
 *
 * @param {any} milestone
 * @param {ReturnType<typeof worldIndex>} world
 * @returns {Set<string>} En minúscula.
 */
function milestonePlaces(milestone, world) {
    /** @type {Set<string>} */
    const out = new Set();
    /** @param {any} asks */
    const walk = (asks) => {
        if (!asks || typeof asks !== 'object') return;
        if (text(asks.place)) out.add(low(asks.place));
        if (asks.kind === 'talk') {
            const home = world.whereIs(asks.npc);
            if (home) out.add(home);
        }
        if (asks.kind === 'win' && text(asks.board)) {
            const where = world.boardPlace.get(low(asks.board));
            if (where) out.add(where);
        }
        if (asks.kind === 'defeat' && text(asks.enemy)) {
            for (const b of world.boards) {
                if (list(b?.enemies).some(e => low(e?.name).startsWith(low(asks.enemy)))) out.add(low(b.locationName));
            }
        }
        for (const clue of list(asks.clues)) if (text(clue?.place)) out.add(low(clue.place));
        for (const option of list(asks.options)) walk(option);
    };
    walk(milestone?.asks);
    if (milestone?.opens?.kind === 'arrive' && text(milestone.opens.place)) out.add(low(milestone.opens.place));
    out.delete('');
    return out;
}

/**
 * Cómo se cumple un hito oculto, en formas de descubrir (`SECRET_WAYS`).
 *
 * @param {any} asks
 * @param {any} [opens]
 * @returns {string[]}
 */
function waysOf(asks, opens) {
    switch (text(asks?.kind)) {
        case 'talk': return ['persona'];
        case 'check':
        case 'clues': return ['tirada'];
        case 'arrive': return ['llegar'];
        case 'win':
        case 'defeat': return ['pelea'];
        case 'contract': return ['encargo'];
        case 'any': return [...new Set(list(asks.options).flatMap(option => waysOf(option)))];
        default:
            // Uno que se cumple solo al abrirse: se descubre por lo que lo abre.
            return opens?.kind === 'contract' ? ['encargo'] : opens?.kind === 'arrive' ? ['llegar'] : [];
    }
}

/**
 * J10.4: los secretos del mundo. Son de dos clases:
 *
 * - **Un sitio escondido** que se puede encontrar sin esperar a la historia: por un rumor que se
 *   oye en otro sitio, por una persona que lo cuenta (un rumor con quién lo dice y sin dónde), o
 *   por un hito oculto. Si ese hito trae una reliquia, el sitio se descubre por ella: es el mapa.
 * - **Una cosa escondida**: un hito oculto que no revela ningún sitio (idea 111), con lo que pide
 *   para encontrarlo.
 *
 * @param {any} pack
 * @returns {WorldSecret[]}
 */
export function secretsOf(pack) {
    const world = worldIndex(pack);
    /** @param {Set<string>} set @returns {string[]} */
    const named = (set) => [...set].map(p => world.names.get(p) ?? p);
    /** @type {WorldSecret[]} */
    const out = [];
    /** @type {Set<string>} */
    const counted = new Set();
    for (const place of world.locations.filter(l => l.hidden)) {
        const name = low(place.name);
        /** @type {Set<string>} */
        const ways = new Set();
        /** @type {Set<string>} */
        const where = new Set();
        for (const r of world.rumors) {
            if (low(r?.leadsTo) !== name) continue;
            // Un rumor que solo se oye en el sitio al que lleva no descubre nada.
            if (text(r.where) && low(r.where) !== name) {
                ways.add('rumor');
                where.add(low(r.where));
            } else if (!text(r.where) && text(r.by)) {
                ways.add('persona');
                if (world.whereIs(r.by)) where.add(world.whereIs(r.by));
            }
        }
        for (const m of world.milestones) {
            if (![...list(m?.changes?.reveal), ...list(m?.late?.reveal)].map(low).includes(name)) continue;
            if (!m.hidden) continue;
            counted.add(text(m.id));
            for (const way of world.relics.has(text(m.id)) ? ['objeto'] : waysOf(m.asks, m.opens)) ways.add(way);
            for (const p of milestonePlaces(m, world)) where.add(p);
        }
        if (ways.size > 0) out.push({ what: text(place.name), kind: 'sitio', ways: [...ways], where: named(where) });
    }
    for (const m of world.milestones) {
        if (!m?.hidden || counted.has(text(m.id))) continue;
        const ways = waysOf(m.asks, m.opens);
        if (ways.length === 0) continue;
        out.push({ what: text(m.title) || text(m.id), kind: 'cosa', ways, where: named(milestonePlaces(m, world)) });
    }
    return out;
}

/**
 * J10.2: cada localización, contra lo que pide. Una se queda corta si le falta algo de
 * `PLACE_NEEDS`; el tablero, solo si le toca (una mazmorra, o un encargo con pelea aquí).
 *
 * - **Gente o servicios**: sus servicios (los escritos o los de su tipo), sus sitios de dentro,
 *   o alguien que viva aquí.
 * - **Algo que mirar**: una cosa que examinar escrita para este sitio (`sights`), o una pista
 *   del hilo que se busca aquí. La descripción sola no cuenta: no se puede examinar.
 * - **Un rumor o un hito**: un rumor que se oye aquí o que cuenta alguien de aquí, o un hito
 *   que pasa aquí (llegar, hablar, buscar, ganar).
 * - **Un secreto**: el sitio está escondido, alguien de aquí esconde algo (sonsacar), un rumor
 *   de aquí lleva a un sitio escondido, o aquí se descubre un secreto del mundo.
 *
 * @param {any} pack
 * @returns {PlaceCheck[]}
 */
export function placeDensity(pack) {
    const world = worldIndex(pack);
    const secrets = secretsOf(pack);
    const contracts = list(pack?.contracts);
    return world.locations.map(place => {
        const name = low(place.name);
        const locals = world.people.filter(p => low(p.where) === name);
        const localNames = new Set(locals.map(p => low(p.name)));
        const told = world.rumors.filter(r => low(r?.where) === name || (text(r?.by) && localNames.has(low(r.by))));
        const tied = world.milestones.filter(m => milestonePlaces(m, world).has(name));
        const clueHere = world.milestones.some(m => list(m?.asks?.clues).some(c => low(c?.place) === name));
        const sights = readSights(place.sights, place.name);
        const services = servicesOf(place);
        const jobs = contracts.filter(c => low(c?.where) === name);
        const needsBoard = BOARD_TYPES.has(text(place.type)) || jobs.some(c => !c.noFight);
        const has = {
            who: services.length > 0 || list(place.places).length > 0 || locals.length > 0,
            look: sights.length > 0 || clueHere,
            event: told.length > 0 || tied.length > 0,
            secret: Boolean(place.hidden) || locals.some(p => text(p.secret))
                || told.some(r => world.hidden.has(low(r.leadsTo)) && low(r.leadsTo) !== name)
                || secrets.some(s => s.where.some(w => low(w) === name)),
            board: world.boards.some(b => low(b?.locationName) === name),
        };
        const missing = /** @type {Array<keyof typeof PLACE_NEEDS>} */ (Object.keys(PLACE_NEEDS))
            .filter(key => !has[key] && (key !== 'board' || needsBoard))
            .map(key => PLACE_NEEDS[key]);
        const reasons = [locals.length > 0, services.length > 0, has.look, told.length > 0, tied.length > 0,
            has.secret, has.board, jobs.length > 0].filter(Boolean).length;
        return { name: text(place.name), hidden: Boolean(place.hidden), has, needsBoard, missing, reasons, ok: missing.length === 0 };
    });
}

/**
 * El informe entero.
 *
 * @param {any} pack
 * @returns {DensityReport}
 */
export function checkWorldDensity(pack) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];
    /** @type {string[]} */
    const counts = [];
    /** @type {Array<{label: string, value: number, min: number, shown: string}>} */
    const short = [];

    /**
     * @param {string} label
     * @param {number} value
     * @param {number} min
     * @param {string} [shown]
     */
    const quota = (label, value, min, shown = String(value)) => {
        const ok = value >= min;
        const wanted = Number.isInteger(min) ? min : `${Math.round(min * 100)} %`;
        counts.push(`${ok ? '✓' : '✗'} ${label}: ${shown} (mínimo ${wanted})`);
        if (!ok) {
            errors.push(`${label}: ${shown}, y el listón pide ${wanted}`);
            short.push({ label, value, min, shown });
        }
    };

    const locations = list(pack?.locations);
    const places = new Set(locations.map(l => low(l.name)));
    const visible = locations.filter(l => !l.hidden);
    const hidden = locations.filter(l => l.hidden);
    const boards = list(pack?.boards);
    const boardNames = new Set(boards.map(b => low(b.name)));
    const boardIds = new Set(boards.map(b => text(b.id)));
    const npcs = list(pack?.npcs);
    const confidants = list(pack?.confidants);
    const people = [...npcs, ...confidants];
    const bestiary = list(pack?.bestiary);
    const creatures = new Set(bestiary.map(b => low(b.name)));
    const factions = list(pack?.world?.factions);
    const factionIds = new Set(factions.map(f => text(f.id)));
    const contracts = list(pack?.contracts);
    const rumors = list(pack?.rumors);
    const milestones = list(pack?.plot?.milestones);
    const endings = pack?.plot?.endings ?? {};
    const quests = list(pack?.quests);

    // ------------------------------------------------------------ el listón
    quota('Hitos del hilo', milestones.length, QUOTA.milestones);
    quota('Finales', Object.keys(endings).length, QUOTA.endings);
    quota('Encargos escritos', contracts.length, QUOTA.contracts);
    const chains = new Set(contracts.filter(c => c.chain).map(c => text(c.chain.id)));
    quota('Cadenas de encargos', chains.size, QUOTA.chains);
    const noFight = contracts.filter(c => c.noFight).length;
    quota('Encargos sin pelear', contracts.length ? noFight / contracts.length : 0, QUOTA.noFightShare,
        `${noFight} de ${contracts.length}`);
    quota('Localizaciones al empezar', visible.length, QUOTA.visible);
    quota('Localizaciones que se descubren', hidden.length, QUOTA.hidden);
    quota('PNJ con nombre', npcs.length, QUOTA.npcs);
    quota('Confidentes', confidants.length, QUOTA.confidants);
    const maps = new Set(boards.map(b => text(b.mapId) || text(b.id)));
    quota('Tableros dibujados', maps.size, QUOTA.maps);
    const encounters = boards.filter(b => list(b.enemies).length > 0);
    quota('Encuentros', encounters.length, QUOTA.encounters);
    quota('Bestiario', bestiary.length, QUOTA.bestiary);
    quota('Jefes', bestiary.filter(b => b.boss).length, QUOTA.bosses);
    quota('Facciones vivas', factions.filter(f => text(f.seat) && f.goal).length, QUOTA.factions);
    quota('Objetos', list(pack?.items).length, QUOTA.items);
    quota('Rumores', rumors.length, QUOTA.rumors);
    const objectiveKinds = new Set(quests.flatMap(q => list(q.objectives).map(o => text(o.type))));
    quota('Tipos de objetivo en los combates', objectiveKinds.size, QUOTA.objectiveKinds, [...objectiveKinds].join(', '));

    // J10.4: los secretos, y de cuántas formas se descubren.
    const secrets = secretsOf(pack);
    quota('Secretos', secrets.length, QUOTA.secrets);
    const ways = [...new Set(secrets.flatMap(s => s.ways))];
    quota('Formas de descubrir un secreto', ways.length, QUOTA.secretWays,
        ways.length > 0 ? ways.map(w => SECRET_WAYS[/** @type {keyof typeof SECRET_WAYS} */ (w)] ?? w).join(', ') : '0');

    // J10.2: cada sitio con algo que hacer. Uno corto es un error, con lo que le falta.
    const placeChecks = placeDensity(pack);
    const thin = placeChecks.filter(p => !p.ok);
    counts.push(`${thin.length === 0 ? '✓' : '✗'} Localizaciones con algo que hacer: ${placeChecks.length - thin.length} de ${placeChecks.length} (todas)`);
    for (const p of thin) errors.push(`«${p.name}» se queda corta: le falta ${sayList(p.missing)}`);

    // ------------------------------------------------------------ referencias
    /**
     * @param {string} what
     * @param {any} name
     * @param {Set<string>} set
     */
    const mustExist = (what, name, set) => {
        if (text(name) && !set.has(low(name))) errors.push(`${what}: «${name}» no existe`);
    };

    for (const c of confidants) {
        const scenes = list(c.scenes).length;
        if (scenes < QUOTA.scenesEach) errors.push(`Confidente ${c.name}: ${scenes} escenas de vínculo, el listón pide ${QUOTA.scenesEach}`);
    }
    for (const p of npcs) {
        mustExist(`PNJ ${p.name} vive en`, p.where, places);
        if (!text(p.wants)) warnings.push(`PNJ ${p.name} no quiere nada: es decorado`);
        if (!text(p.knows)) warnings.push(`PNJ ${p.name} no sabe nada que interese`);
    }
    for (const r of rumors) {
        mustExist(`Rumor ${r.id} se oye en`, r.where, places);
        mustExist(`Rumor ${r.id} lleva a`, r.leadsTo, places);
    }
    for (const c of contracts) {
        mustExist(`Encargo ${c.id} se juega en`, c.where, places);
        if (text(c.boardId) && !boardIds.has(text(c.boardId))) errors.push(`Encargo ${c.id}: su tablero «${c.boardId}» no existe`);
        if (!c.noFight && !text(c.boardId)) errors.push(`Encargo ${c.id}: tiene pelea pero no tiene tablero`);
    }
    for (const f of factions) {
        mustExist(`Facción ${f.name}, sede`, f.seat, places);
        for (const h of list(f.holds)) mustExist(`Facción ${f.name} controla`, h, places);
        for (const e of list(f.enemies)) if (!factionIds.has(text(e))) errors.push(`Facción ${f.name}: su enemigo «${e}» no existe`);
        if (list(f.enemies).length === 0) warnings.push(`Facción ${f.name} no tiene enemigos: sus encargos no toman partido`);
    }
    for (const l of locations) {
        for (const r of list(l.routes)) mustExist(`Camino desde ${l.name} hacia`, r.to, places);
    }
    for (const b of boards) mustExist(`Tablero ${b.name} está en`, b.locationName, places);

    // ------------------------------------------------------------ el hilo se puede jugar
    const milestoneIds = new Set(milestones.map(m => text(m.id)));
    const revealed = new Set([
        ...milestones.flatMap(m => list(m.changes?.reveal).map(low)),
        ...milestones.flatMap(m => list(m.late?.reveal).map(low)),
        ...rumors.map(r => low(r.leadsTo)).filter(Boolean),
    ]);
    for (const m of milestones) {
        // Idea 101: cada una de sus formas se comprueba igual. Idea 107: y cada pista, su sitio.
        const ways = m.asks?.kind === 'any' ? list(m.asks.options) : [m.asks ?? {}];
        for (const a of ways) {
            if (a.kind === 'arrive') mustExist(`Hito ${m.id} pide llegar a`, a.place, places);
            if (a.kind === 'win' && a.board) mustExist(`Hito ${m.id} pide ganar en`, a.board, boardNames);
            if (a.kind === 'defeat') mustExist(`Hito ${m.id} pide derrotar a`, a.enemy, creatures);
            if (a.kind === 'talk' && !people.some(p => low(p.name).includes(low(a.npc)))) {
                errors.push(`Hito ${m.id} pide hablar con «${a.npc}», y nadie se llama así`);
            }
        }
        for (const clue of list(m.asks?.clues)) mustExist(`Hito ${m.id}: una pista está en`, clue.place, places);
        for (const id of list(m.changes?.close)) {
            if (!milestoneIds.has(text(id))) errors.push(`Hito ${m.id} cierra «${id}», que no existe`);
        }
        for (const r of list(m.changes?.reveal)) {
            if (!hidden.some(h => low(h.name) === low(r))) warnings.push(`Hito ${m.id} revela «${r}», que ya estaba en el mapa`);
        }
        if (m.opens?.kind === 'after' && !milestoneIds.has(text(m.opens.milestone))) {
            errors.push(`Hito ${m.id} se abre tras «${m.opens.milestone}», que no existe: nunca se abrirá`);
        }
        const ending = text(m.changes?.ending);
        if (ending && !endings[ending]) errors.push(`Hito ${m.id} lleva al final «${ending}», que no está escrito`);
        for (const e of Object.values(m.changes?.endingBy ?? {})) if (!endings[text(e)]) errors.push(`Hito ${m.id}: el final «${e}» no está escrito`);
    }
    if (!milestones.some(m => m.opens?.kind === 'start')) errors.push('El hilo no tiene mecha: ningún hito se abre al empezar');
    for (const h of hidden) if (!revealed.has(low(h.name))) errors.push(`«${h.name}» empieza escondida y nada la revela: nunca se podrá ir`);

    // Un sitio escondido no se puede pedir antes de revelarse: se recorre el hilo en orden.
    const openable = new Set(milestones.filter(m => m.opens?.kind && m.opens.kind !== 'after').map(m => text(m.id)));
    const knownPlaces = new Set(visible.map(l => low(l.name)));
    for (let changed = true; changed;) {
        changed = false;
        for (const m of milestones) {
            if (!openable.has(text(m.id))) continue;
            for (const r of list(m.changes?.reveal)) knownPlaces.add(low(r));
            for (const n of milestones) {
                const after = n.opens?.kind === 'after' && text(n.opens.milestone) === text(m.id);
                const named = list(m.changes?.open).includes(text(n.id)) || list(m.late?.open).includes(text(n.id));
                if ((after || named) && !openable.has(text(n.id))) {
                    openable.add(text(n.id));
                    changed = true;
                }
            }
        }
    }
    for (const r of rumors) if (r.leadsTo) knownPlaces.add(low(r.leadsTo));
    for (const m of milestones) {
        if (!openable.has(text(m.id))) errors.push(`Hito ${m.id} no se abre nunca`);
        if (m.asks?.kind === 'arrive' && !knownPlaces.has(low(m.asks.place))) {
            errors.push(`Hito ${m.id} pide llegar a «${m.asks.place}», que nada revela`);
        }
    }

    // J5.6: el hilo tiene que poder acabar, y cada hito a la vista, llevar a algo. Un secreto
    // (`hidden`) puede ser un callejón: se encuentra por gusto.
    const leadsToEnding = (/** @type {any} */ m) => Boolean(endings[text(m.changes?.ending)])
        || Object.values(m.changes?.endingBy ?? {}).some(e => Boolean(endings[text(e)]));
    if (milestones.length > 0 && !milestones.some(m => openable.has(text(m.id)) && leadsToEnding(m))) {
        errors.push('Ningún hito que se pueda abrir lleva a un final: la campaña no se puede acabar');
    }
    const followed = new Set([
        ...milestones.filter(m => m.opens?.kind === 'after').map(m => text(m.opens.milestone)),
        ...milestones.flatMap(m => [...list(m.changes?.open), ...list(m.late?.open)].map(text)),
    ]);
    for (const m of milestones) {
        if (m.hidden || followed.has(text(m.id)) || leadsToEnding(m)) continue;
        warnings.push(`Hito ${m.id} no lleva a nada: ni abre otro hito ni acaba la campaña`);
    }

    // J5.6: cada misión, con su tablero.
    for (const q of quests) {
        const name = text(q.name) || text(q.id);
        if (!text(q.boardId)) errors.push(`Misión ${name}: no dice en qué tablero se juega`);
        else if (!boardIds.has(text(q.boardId))) errors.push(`Misión ${name}: su tablero «${q.boardId}» no existe`);
    }

    // ------------------------------------------------------------ se puede llegar a todo
    const start = low(locations[0]?.name);
    const graph = new Map(locations.map(l => [low(l.name), new Set()]));
    for (const l of locations) {
        for (const r of list(l.routes)) {
            graph.get(low(l.name))?.add(low(r.to));
            graph.get(low(r.to))?.add(low(l.name));
        }
    }
    const reach = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
        for (const next of graph.get(/** @type {string} */ (queue.shift())) ?? []) {
            if (!reach.has(next)) {
                reach.add(next);
                queue.push(next);
            }
        }
    }
    for (const l of locations) {
        if (!reach.has(low(l.name))) errors.push(`«${l.name}» no tiene camino desde ${locations[0]?.name}`);
    }

    // ------------------------------------------------------------ la variedad
    const verbs = [...contracts].sort((a, b) => (a.act ?? 1) - (b.act ?? 1)).map(c => low(c.verb));
    for (let i = 2; i < verbs.length; i++) {
        if (verbs[i] && verbs[i] === verbs[i - 1] && verbs[i] === verbs[i - 2]) {
            warnings.push(`Tres encargos seguidos de «${verbs[i]}» (regla 1 de la variedad)`);
        }
    }
    /** @type {Map<string, number>} */
    const mapUse = new Map();
    for (const b of encounters) mapUse.set(text(b.mapId) || text(b.id), (mapUse.get(text(b.mapId) || text(b.id)) ?? 0) + 1);
    for (const [id, n] of mapUse) if (n > 2) warnings.push(`El tablero «${id}» sale en ${n} combates (la regla dice dos como mucho)`);
    for (const l of locations) {
        const who = npcs.filter(p => low(p.where) === low(l.name)).length;
        const said = rumors.filter(r => low(r.where) === low(l.name)).length;
        // Los servicios escritos o, sin ellos, los de su tipo: una aldea tiene posada aunque no lo diga.
        const services = servicesOf(l).length;
        const hasBoard = boards.some(b => low(b.locationName) === low(l.name));
        if (who + said + services === 0 && !hasBoard) errors.push(`En «${l.name}» no hay nada que hacer: ni gente, ni rumores, ni servicios, ni tablero`);
        else if (who === 0 && said === 0) warnings.push(`«${l.name}»: nadie con quien hablar y nada que oír`);
    }

    // R10 del roadmap de profundidad: lo nuevo también cuenta.
    const heroes = list(pack?.heroes);
    counts.push(`${heroes.length >= 3 ? '✓' : '·'} Héroes hechos: ${heroes.length} (se recomiendan 3, para entrar sin crear a nadie)`);
    if (heroes.length === 0) warnings.push('Sin héroes hechos: al entrar habrá que crear uno.');
    const tamable = bestiary.filter(b => tamableAs(b)).length;
    counts.push(`· Bestias que se pueden domar: ${tamable}`);
    for (const row of list(pack?.abilities)) {
        const magic = spellById(text(row?.id)) ? '' : magicInData(row);
        if (magic) errors.push(magic);
    }
    for (const who of [...confidants, ...heroes]) {
        for (const id of list(who?.spells)) {
            if (!spellById(text(id))) errors.push(`${text(who?.name)}: el conjuro «${text(id)}» no está en el grimorio.`);
        }
    }

    return { name: text(pack?.world?.name), counts, errors, warnings, short, places: placeChecks, secrets, ok: errors.length === 0 };
}

/**
 * El encargo para el Gem (idea 182): lo que falta y lo que hay que arreglar, listo para
 * pegar. Vacío si no hay nada que pedir.
 *
 * @param {DensityReport} report
 * @returns {string}
 */
export function gemRequest(report) {
    const name = report.name || 'este mundo';
    const need = report.short.map(q => (Number.isInteger(q.min)
        ? `- ${q.min - q.value} más de «${q.label.toLowerCase()}» (hay ${q.value}; el listón pide ${q.min}).`
        : `- Más «${q.label.toLowerCase()}»: ahora ${q.shown}, y hace falta llegar al ${Math.round(q.min * 100)} %.`));
    const fix = report.errors.filter(e => !report.short.some(q => e.startsWith(`${q.label}:`))).map(e => `- ${e}.`);
    const nice = report.warnings.map(w => `- ${w}.`);
    if (need.length + fix.length + nice.length === 0) return '';
    return [
        `Hola. El mundo «${name}» todavía no está completo. Escribe una ronda nueva del guion (la siguiente a la última), con bloques YAML como las anteriores.`,
        'Usa ids nuevos para lo nuevo; si algo corrige un bloque que ya existe, repite su id y pon solo lo que cambia.',
        '',
        ...(need.length ? ['Añade:', ...need, ''] : []),
        ...(fix.length ? ['Arregla:', ...fix, ''] : []),
        ...(nice.length ? ['Si te da tiempo, también:', ...nice, ''] : []),
        'Que todo encaje con lo que ya está escrito: los mismos sitios, la misma gente y el mismo tono.',
    ].join('\n');
}
