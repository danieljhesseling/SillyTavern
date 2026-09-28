/**
 * Lo que se cambia en el taller de un mundo escrito entero (1387): sus sitios, sus tableros,
 * sus facciones y su gente (pedido por Daniel el 2026-09-28).
 *
 * El paquete llega escrito y **no se toca**: lo que se cambia se guarda aparte, por pestaña
 * y con una clave estable (`loc:2`, `board:enc-huida-posada`, `mio:1`), y se aplica encima
 * al crear la campaña. Así volver a la de serie es borrar una entrada, y el paquete sigue
 * siendo el mismo para el siguiente que lo elija.
 *
 * Tres cosas que se cuidan al aplicar:
 * - **Renombrar arrastra**: el mundo empareja por nombre, así que un sitio que cambia de
 *   nombre lo cambia también en los caminos, los tableros, las facciones y la gente. Solo
 *   se cambia lo que dice exactamente el nombre viejo; una frase que lo nombre se queda.
 * - **Un sitio nuevo tiene camino**: se dice desde dónde se llega y se pone en los dos
 *   sentidos. Un sitio sin camino es un sitio al que no se puede ir.
 * - **Un tablero nuevo se dibuja con la semilla**: forma y tamaño, como en «desde cero», y
 *   el mismo mundo da el mismo tablero.
 *
 * Puro: de un paquete y lo cambiado, a otro paquete. No guarda nada.
 */

import { LOCATION_TYPES } from './campaign-pack-schema.js';
import { describeStanding, STANDING } from './factions.js';
import { draftOf, draftProblem, settleEnemies } from './board-draft.js';

/** Las pestañas que un mundo escrito deja cambiar. */
export const PACK_EDIT_STEPS = ['localidades', 'tableros', 'facciones', 'personajes'];

/** Cómo se llama uno nuevo en cada pestaña. */
export const PACK_NEW_LABELS = {
    localidades: 'Nuevo sitio', tableros: 'Nuevo tablero', facciones: 'Nueva facción', personajes: 'Nueva persona',
};

/** Qué clase de sitio es, dicho para quien juega. */
const TYPE_LABELS = {
    city: 'Ciudad', village: 'Pueblo', outpost: 'Puesto', ruins: 'Ruinas', dungeon: 'Mazmorra',
    camp: 'Campamento', sanctuary: 'Santuario', wilderness: 'Tierra salvaje',
};

/** Las formas de tablero, igual que en «desde cero». */
const SHAPE_LABELS = { rooms: 'Salas y pasillos', cave: 'Cueva', camp: 'Campo abierto', temple: 'Templo' };

/** Y lo que ocupa. */
const SIZE_LABELS = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' };

/** Cuánto se tarda en llegar a un sitio nuevo. */
const DAYS = ['1', '2', '3', '4', '5'];

/**
 * @typedef {object} PackItem
 * @property {string} key Estable: no cambia al renombrar.
 * @property {any} row Como está ahora, con lo cambiado encima.
 * @property {string} kind 'sitio', 'tablero', 'faccion', 'vecino' o 'companero'.
 * @property {boolean} mine Si es nuevo, de este taller.
 * @property {boolean} changed Si es del paquete y se ha retocado.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @returns {any[]}
 */
function list(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * Un id a partir de un nombre, como los que escribe el guion.
 *
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function slug(name, fallback) {
    const base = text(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base || fallback;
}

/**
 * Lo que trae el paquete de una pestaña, con su clave.
 *
 * @param {any} pack
 * @param {string} step
 * @returns {{key: string, row: any, kind: string}[]}
 */
function stockOf(pack, step) {
    switch (step) {
        case 'localidades':
            return list(pack?.locations).map((row, i) => ({ key: `loc:${i}`, row, kind: 'sitio' }));
        case 'tableros':
            return list(pack?.boards).map((row, i) => ({ key: `board:${text(row?.id) || i}`, row, kind: 'tablero' }));
        case 'facciones':
            return list(pack?.world?.factions).map((row, i) => ({ key: `fac:${text(row?.id) || i}`, row, kind: 'faccion' }));
        case 'personajes':
            return [
                ...list(pack?.confidants).map((row, i) => ({ key: `conf:${i}`, row, kind: 'companero' })),
                ...list(pack?.npcs).map((row, i) => ({ key: `npc:${text(row?.id) || i}`, row, kind: 'vecino' })),
            ];
        default:
            return [];
    }
}

/**
 * Lo que hay en una pestaña ahora: lo del paquete con lo retocado encima, y lo nuevo al final.
 *
 * @param {any} pack
 * @param {Record<string, Record<string, any>>|null|undefined} edits
 * @param {string} step
 * @returns {PackItem[]}
 */
export function packItems(pack, edits, step) {
    const mine = edits?.[step] ?? {};
    const stock = stockOf(pack, step).map(({ key, row, kind }) => ({
        key, kind, row: mine[key] ?? row, mine: false, changed: Boolean(mine[key]),
    }));
    const added = Object.entries(mine)
        .filter(([key]) => key.startsWith('mio:'))
        .map(([key, row]) => ({ key, row, kind: text(row?.kind) || kindOf(step), mine: true, changed: false }));
    return [...stock, ...added];
}

/**
 * @param {string} step
 * @returns {string}
 */
function kindOf(step) {
    return { localidades: 'sitio', tableros: 'tablero', facciones: 'faccion', personajes: 'vecino' }[step] ?? '';
}

/**
 * Los nombres de los sitios tal como quedan, para los desplegables.
 *
 * @param {any} pack
 * @param {any} edits
 * @returns {string[]}
 */
export function placeNames(pack, edits) {
    const names = packItems(pack, edits, 'localidades').map(item => text(item.row?.name)).filter(Boolean);
    // Un tablero puede apuntar a un sitio que el paquete no declara: también es un sitio.
    for (const board of packItems(pack, edits, 'tableros')) {
        const where = text(board.row?.locationName);
        if (where && !names.includes(where)) names.push(where);
    }
    return names;
}

/**
 * La línea de debajo del nombre en cada tarjeta.
 *
 * @param {PackItem} item
 * @returns {string}
 */
export function packNote(item) {
    const row = item.row ?? {};
    const own = item.mine ? 'Tuyo' : item.changed ? 'Retocado' : '';
    let said = '';
    if (item.kind === 'sitio') said = [TYPE_LABELS[text(row.type)] ?? '', row.hidden ? 'escondido' : ''].filter(Boolean).join(', ');
    else if (item.kind === 'tablero') said = text(row.locationName);
    else if (item.kind === 'faccion') said = text(row.seat);
    else if (item.kind === 'companero') said = 'Compañero';
    else said = [text(row.trade), text(row.where)].filter(Boolean).join(' - ');
    return [own, said].filter(Boolean).join(' · ');
}

/**
 * Los caminos de un sitio, en una línea: «El Camino Viejo (1 día), Castillo de Vane (1 día)».
 *
 * @param {any} row
 * @returns {string}
 */
function routesText(row) {
    return list(row?.routes).map((/** @type {any} */ r) => {
        const days = Math.max(1, Number(r?.days) || 1);
        const closed = text(r?.closedUntil) ? ', cerrado al principio' : '';
        return `${text(r?.to)} (${days} ${days === 1 ? 'día' : 'días'}${closed})`;
    }).join(', ');
}

/**
 * La ficha de uno: lo que tiene sentido cambiar, en palabras de quien juega.
 *
 * @param {PackItem} item
 * @param {{places?: string[], factions?: string[]}} [context]
 * @returns {any[]} Los campos, con la forma que dibuja `drawStep`.
 */
export function packForm(item, { places = [], factions = [] } = {}) {
    const row = item.row ?? {};
    const others = places.filter(name => name !== text(row.name));
    const choose = (/** @type {string[]} */ names) => [{ id: '', label: '-' }, ...names.map(name => ({ id: name, label: name }))];

    if (item.kind === 'sitio') {
        return [
            // Los caminos de uno del mundo, para saber dónde está; en uno nuevo ya se ven abajo.
            { key: 'name', label: 'Nombre', value: text(row.name), placeholder: 'Cómo se llama',
                hint: !item.mine && routesText(row) ? `Caminos: ${routesText(row)}.` : '' },
            { key: 'type', label: 'Qué clase de sitio es', value: text(row.type), kind: 'choice',
                options: [{ id: '', label: '-' }, ...LOCATION_TYPES.map(id => ({ id, label: TYPE_LABELS[id] ?? id }))] },
            ...(item.mine ? [
                { key: 'link', label: 'Se llega desde', value: text(list(row.routes)[0]?.to), kind: 'choice', options: choose(others),
                    hint: 'El camino se pone en los dos sentidos.' },
                { key: 'days', label: 'Días de camino', value: String(Number(list(row.routes)[0]?.days) || 1), kind: 'choice',
                    options: DAYS.map(id => ({ id, label: id === '1' ? '1 día' : `${id} días` })) },
            ] : []),
            { key: 'factionName', label: 'Quién manda aquí', value: text(row.factionName), kind: 'choice', options: choose(factions) },
            { key: 'hidden', label: 'Escondido: se descubre jugando', value: row.hidden ? 'si' : '', kind: 'check' },
            { key: 'description', label: 'Cómo es', value: text(row.description), kind: 'area', placeholder: 'Lo que se ve y a qué huele.' },
        ];
    }

    if (item.kind === 'tablero') {
        // El tamaño y los enemigos ya se ven en el tablero, debajo.
        return [
            { key: 'name', label: 'Nombre', value: text(row.name) },
            { key: 'locationName', label: 'En qué sitio está', value: text(row.locationName), kind: 'choice', options: choose(places) },
            ...(item.mine ? [
                { key: 'shape', label: 'Cómo es por dentro', value: text(row.shape) || 'rooms', kind: 'choice',
                    options: Object.entries(SHAPE_LABELS).map(([id, label]) => ({ id, label })) },
                { key: 'size', label: 'Cuánto ocupa', value: text(row.size) || 'medium', kind: 'choice',
                    options: Object.entries(SIZE_LABELS).map(([id, label]) => ({ id, label })) },
            ] : []),
        ];
    }

    if (item.kind === 'faccion') {
        return [
            { key: 'name', label: 'Nombre', value: text(row.name), placeholder: 'Los del Molino' },
            { key: 'seat', label: 'Dónde mandan', value: text(row.seat), kind: 'choice', options: choose(places) },
            { key: 'goals', label: 'Qué quieren', value: text(row.goals), kind: 'area', placeholder: 'Quedarse con el molino antes del invierno.' },
            { key: 'reputation', label: 'Qué piensan de ti al empezar', value: String(Number(row.reputation) || 0), kind: 'choice',
                options: Array.from({ length: (STANDING * 2) + 1 }, (unused, i) => ({ id: String(i - STANDING), label: describeStanding(i - STANDING) })) },
        ];
    }

    if (item.kind === 'companero') {
        return [
            { key: 'name', label: 'Nombre', value: text(row.name), hint: 'Se une al grupo si le convences.' },
            { key: 'className', label: 'A qué se dedica', value: text(row.className), placeholder: 'guerrero, ladrón…' },
            { key: 'description', label: 'Quién es', value: text(row.description), kind: 'area' },
        ];
    }

    return [
        { key: 'name', label: 'Nombre', value: text(row.name) },
        { key: 'trade', label: 'Oficio', value: text(row.trade), placeholder: 'Tabernero, herrera…' },
        { key: 'where', label: 'Dónde vive', value: text(row.where), kind: 'choice', options: choose(places) },
        { key: 'wants', label: 'Qué quiere', value: text(row.wants), kind: 'area' },
        { key: 'knows', label: 'Qué sabe', value: text(row.knows), kind: 'area' },
        { key: 'secret', label: 'Qué esconde', value: text(row.secret), kind: 'area' },
        { key: 'voice', label: 'Cómo habla', value: text(row.voice), kind: 'area' },
    ];
}

/**
 * Escribir un campo de la ficha en su fila.
 *
 * @param {PackItem} item
 * @param {string} key
 * @param {any} value
 * @returns {any} La fila nueva.
 */
export function applyPackField(item, key, value) {
    const row = { ...(item.row ?? {}) };
    if (key === 'hidden') row.hidden = value === true || text(value) === 'si';
    else if (key === 'reputation') row.reputation = Number(value) || 0;
    else if (key === 'link' || key === 'days') {
        const first = { ...(list(row.routes)[0] ?? { to: '', days: 1 }) };
        if (key === 'link') first.to = text(value);
        else first.days = Math.max(1, Number(value) || 1);
        row.routes = [first];
    } else row[key] = typeof value === 'string' ? value : text(value);
    // Otra forma u otro tamaño es otro tablero: se vuelve a dibujar.
    if (key === 'shape' || key === 'size') {
        delete row.map;
        delete row.partyStart;
    }
    return row;
}

/**
 * Uno nuevo, con lo mínimo para que el mundo lo sepa usar.
 *
 * @param {string} step
 * @param {{places?: string[], factions?: string[], n?: number}} [context]
 * @returns {{key: string, row: any}}
 */
export function newPackRow(step, { places = [], n = 1 } = {}) {
    const key = `mio:${n}`;
    const first = places[0] ?? '';
    if (step === 'localidades') {
        return { key, row: { kind: 'sitio', name: `Sitio nuevo ${n}`, type: 'wilderness', description: '', hidden: false,
            factionName: '', services: [], routes: [{ to: first, days: 1 }] } };
    }
    if (step === 'tableros') {
        return { key, row: { kind: 'tablero', name: `Tablero nuevo ${n}`, locationName: first, shape: 'rooms', size: 'medium' } };
    }
    if (step === 'facciones') {
        return { key, row: { kind: 'faccion', name: `Facción nueva ${n}`, seat: first, goals: '', reputation: 0 } };
    }
    return { key, row: { kind: 'vecino', name: `Persona nueva ${n}`, trade: '', where: first, wants: '', knows: '', secret: '', voice: '' } };
}

/**
 * Lo que impide crear con esta ficha, o '' si nada.
 *
 * @param {PackItem} item
 * @param {PackItem[]} all Los de su pestaña, para ver repetidos.
 * @returns {string}
 */
export function packProblem(item, all) {
    const name = text(item.row?.name);
    if (!name) return 'Hay uno sin nombre.';
    const same = all.filter(other => other.kind === item.kind && text(other.row?.name).toLowerCase() === name.toLowerCase());
    if (same.length > 1) return `Hay dos que se llaman «${name}».`;
    if (item.mine && item.kind === 'sitio' && !text(list(item.row?.routes)[0]?.to)) return `${name}: di desde dónde se llega.`;
    if (item.mine && item.kind === 'tablero' && !text(item.row?.locationName)) return `${name}: di en qué sitio está.`;
    // Un tablero pintado a mano se puede quedar sin sitio donde empezar. Los enemigos no se
    // miran aquí: no se enseñan, y al crear se recolocan solos.
    if (item.kind === 'tablero' && Array.isArray(item.row?.map) && item.row.map.length > 0) {
        const problem = draftProblem(draftOf(item.row, ''));
        if (problem) return `${name}: ${problem.charAt(0).toLocaleLowerCase('es')}${problem.slice(1)}`;
    }
    return '';
}

/**
 * El primer problema de una pestaña, o ''.
 *
 * @param {any} pack
 * @param {any} edits
 * @param {string} step
 * @returns {string}
 */
export function packStepProblem(pack, edits, step) {
    // Solo lo tocado: lo que trae el paquete ya lo comprobó quien lo escribió.
    const all = packItems(pack, edits, step);
    for (const item of all.filter(i => i.mine || i.changed)) {
        const problem = packProblem(item, all);
        if (problem) return problem;
    }
    return '';
}

/**
 * Cambiar, en todo el paquete, los textos que son exactamente un nombre viejo.
 *
 * @param {any} value
 * @param {Map<string, string>} renames
 * @returns {any}
 */
function renameAll(value, renames) {
    if (typeof value === 'string') return renames.get(value) ?? value;
    if (Array.isArray(value)) return value.map(v => renameAll(v, renames));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameAll(v, renames)]));
    }
    return value;
}

/**
 * Una fila tal como la quiere el paquete: sin las marcas del taller.
 *
 * @param {any} row
 * @returns {any}
 */
function clean(row) {
    const rest = { ...(row ?? {}) };
    for (const key of ['kind', 'shape', 'size', 'take']) delete rest[key];
    // Lo escrito se guarda recortado: «La Poza » y «La Poza» son el mismo sitio.
    for (const [key, value] of Object.entries(rest)) if (typeof value === 'string') rest[key] = value.trim();
    return rest;
}

/**
 * El paquete con lo del taller encima. Sin nada cambiado, el mismo paquete.
 *
 * @param {any} pack
 * @param {Record<string, Record<string, any>>|null|undefined} edits
 * @param {{seed?: string}} [options]
 * @returns {any}
 */
export function applyPackEdits(pack, edits, { seed = '' } = {}) {
    if (!pack || !edits || Object.values(edits).every(step => Object.keys(step ?? {}).length === 0)) return pack;
    const out = JSON.parse(JSON.stringify(pack));
    out.world = out.world ?? {};
    out.world.factions = list(out.world.factions);
    for (const field of ['locations', 'boards', 'confidants', 'npcs']) out[field] = list(out[field]);

    /** @type {Map<string, string>} */
    const renames = new Map();
    const holder = (/** @type {string} */ kind) => ({
        sitio: out.locations, tablero: out.boards, faccion: out.world.factions, companero: out.confidants, vecino: out.npcs,
    }[kind]);

    // Lo del paquete que se ha retocado, en su sitio.
    for (const step of PACK_EDIT_STEPS) {
        const stock = stockOf(pack, step);
        for (const [key, row] of Object.entries(edits[step] ?? {})) {
            if (key.startsWith('mio:')) continue;
            const at = stock.find(item => item.key === key);
            if (!at) continue;
            const rows = holder(at.kind);
            const index = stock.filter(item => item.kind === at.kind).findIndex(item => item.key === key);
            if (!rows || index < 0) continue;
            const before = text(at.row?.name);
            const after = text(row?.name);
            if (before && after && before !== after) renames.set(before, after);
            rows[index] = { ...rows[index], ...clean(row) };
            // Un tablero repintado: sus enemigos, donde se pueda estar y llegar.
            if (at.kind === 'tablero' && Array.isArray(row?.map) && row.map.length > 0) {
                rows[index].enemies = settleEnemies(draftOf(rows[index], ''), list(rows[index].enemies));
            }
        }
    }

    // Lo nuevo, al final.
    const used = new Set([...out.boards.map((/** @type {any} */ b) => text(b.id)),
        ...out.world.factions.map((/** @type {any} */ f) => text(f.id)), ...out.npcs.map((/** @type {any} */ p) => text(p.id))]);
    const freshId = (/** @type {string} */ name, /** @type {string} */ fallback) => {
        let id = slug(name, fallback);
        for (let i = 2; used.has(id); i++) id = `${slug(name, fallback)}-${i}`;
        used.add(id);
        return id;
    };
    for (const step of PACK_EDIT_STEPS) {
        for (const [key, row] of Object.entries(edits[step] ?? {})) {
            if (!key.startsWith('mio:')) continue;
            const kind = text(row?.kind) || kindOf(step);
            if (kind === 'sitio') {
                const route = list(row.routes)[0];
                out.locations.push({ ...clean(row), routes: text(route?.to) ? [{ to: text(route.to), days: Math.max(1, Number(route.days) || 1) }] : [] });
                // Y la vuelta: el camino se anda en los dos sentidos.
                const from = out.locations.find((/** @type {any} */ place) => text(place.name) === text(route?.to));
                if (from) from.routes = [...list(from.routes), { to: text(row.name), days: Math.max(1, Number(route.days) || 1) }];
            } else if (kind === 'tablero') {
                const id = freshId(text(row.name), `tablero-${key.slice(4)}`);
                // El mismo borrador que se ve en la ficha: pintado, o de la semilla con su clave.
                const drawn = draftOf({ ...row, id: key }, seed);
                out.boards.push({ id, name: text(row.name), locationName: text(row.locationName),
                    map: drawn.map, partyStart: drawn.partyStart, enemies: [] });
            } else if (kind === 'faccion') {
                out.world.factions.push({ id: freshId(text(row.name), `faccion-${key.slice(4)}`), ...clean(row),
                    holds: text(row.seat) ? [text(row.seat)] : [], enemies: [] });
            } else {
                out.npcs.push({ id: freshId(text(row.name), `persona-${key.slice(4)}`), ...clean(row) });
            }
        }
    }

    return renames.size > 0 ? renameAll(out, renames) : out;
}
