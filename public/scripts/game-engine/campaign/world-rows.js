/**
 * Las filas propias de un mundo: razas, clases, habilidades, objetos y bichos que el taller
 * deja retocar o inventar (pedido por Daniel el 2026-09-28).
 *
 * El compendio es **de todos**: lo que se cambia en un mundo no puede cambiar los demás.
 * Así que retocar una fila de serie hace una copia con el mismo id, que en ese mundo tapa a
 * la de serie; y una nueva lleva un id propio (`mio-…`). El mundo guarda las suyas y el
 * juego las mezcla al leer el compendio de esa campaña.
 *
 * Una fila nueva **nace de otra**: la que estés mirando, o la primera. Así hereda lo que el
 * motor necesita y nadie ve (la categoría, cómo se nombra, cómo funciona) y la ficha solo
 * enseña lo que tiene sentido cambiar. Una habilidad nueva «funciona como» una que ya
 * existe: la magia no se inventa en datos (DR3), y una mecánica nueva es código.
 *
 * Puro: de una fila y lo escrito, a otra fila. No guarda nada.
 */

import { STAT_LABELS, KIN_STATS, effectsOf } from '../compendio/kin.js';

/** Las pestañas del taller que llevan filas del compendio. */
export const ROW_STEPS = ['habilidades', 'razas', 'clases', 'objetos', 'bestiario'];

/** Cómo se llama una nueva en cada pestaña. */
export const NEW_LABELS = {
    habilidades: 'Nueva habilidad', razas: 'Nueva raza', clases: 'Nueva clase', objetos: 'Nuevo objeto', bestiario: 'Nuevo bicho',
};

/** Los dados que se pueden elegir. */
const DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6'];

/** Cómo se dice cada tipo de daño de un arma. */
const DAMAGE_TYPES = ['cortante', 'perforante', 'contundente'];

/** Cómo aguanta un bicho, en palabras. */
const TOUGHNESS = [
    { id: '0.6', label: 'Poco (se cae enseguida)' },
    { id: '0.85', label: 'Algo menos que un hombre' },
    { id: '1', label: 'Como un hombre' },
    { id: '1.2', label: 'Más que un hombre' },
    { id: '1.4', label: 'Mucho' },
    { id: '1.8', label: 'Una barbaridad' },
];

/** Cómo pelea un bicho, en palabras (los cuatro perfiles que mueve el motor). */
const PROFILES = [
    { id: 'aggressive', label: 'Agresivo: va a por el más cercano' },
    { id: 'skirmisher', label: 'Hostigador: pega y se aparta' },
    { id: 'guardian', label: 'Guardián: protege y aguanta' },
    { id: 'coward', label: 'Cobarde: huye si le va mal' },
];

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @returns {string}
 */
function fold(value) {
    return text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * La batería en la que vive una fila de una pestaña. Los objetos se reparten entre tres.
 *
 * @param {string} step
 * @param {any} row
 * @returns {string}
 */
export function domainOf(step, row) {
    if (step === 'objetos') return { weapon: 'armas', armor: 'armaduras' }[text(row?.itemType)] ?? 'trastos';
    return step;
}

/**
 * Lo que da y quita una raza o una clase, escrito como se lee: «+2 Fuerza, −1 Inteligencia».
 *
 * @param {any} row
 * @returns {string}
 */
export function effectsText(row) {
    return effectsOf(row)
        .map(effect => `${effect.modifier > 0 ? '+' : '−'}${Math.abs(effect.modifier)} ${STAT_LABELS[/** @type {keyof typeof STAT_LABELS} */ (effect.stat)]}`)
        .join(', ');
}

/**
 * Lo contrario: «+2 fuerza, -1 inteligencia» a efectos. Lo que no se entiende se ignora y se
 * dice aparte.
 *
 * @param {string} said
 * @returns {{effects: Array<{stat: string, modifier: number}>, unread: string[]}}
 */
export function parseEffects(said) {
    const byLabel = new Map(KIN_STATS.map(stat => [fold(STAT_LABELS[/** @type {keyof typeof STAT_LABELS} */ (stat)]), stat]));
    /** @type {Array<{stat: string, modifier: number}>} */
    const effects = [];
    /** @type {string[]} */
    const unread = [];
    for (const part of text(said).split(/[,;\n]+/).map(text).filter(Boolean)) {
        const match = /^([+\-−]?\s*\d+)\s+(.+)$/.exec(part);
        const stat = match ? byLabel.get(fold(match[2])) : undefined;
        const modifier = match ? Number(match[1].replace(/[−\s]/g, m => (m === '−' ? '-' : ''))) : 0;
        if (!stat || !Number.isFinite(modifier) || modifier === 0) {
            unread.push(part);
            continue;
        }
        effects.push({ stat, modifier });
    }
    return { effects, unread };
}

/**
 * @typedef {Object} RowField
 * @property {string} key
 * @property {string} label
 * @property {string} value
 * @property {'text'|'area'|'choice'} [kind]
 * @property {Array<{id: string, label: string}>} [options]
 * @property {string} [hint]
 * @property {string} [placeholder]
 */

/**
 * Lo que la ficha deja cambiar de una fila.
 *
 * @param {string} step
 * @param {any} row
 * @param {Object} [context]
 * @param {Array<{id: string, name: string}>} [context.classes] Las clases, para las habilidades.
 * @param {Array<{id: string, name: string}>} [context.abilities] Las habilidades de serie, para «funciona como».
 * @returns {RowField[]}
 */
export function rowForm(step, row, { classes = [], abilities = [] } = {}) {
    const name = { key: 'name', label: 'Nombre', value: text(row?.name) };
    const note = { key: 'note', label: 'Qué es', value: text(row?.note), kind: /** @type {'area'} */ ('area'), placeholder: 'Una o dos frases.' };
    const effects = {
        // Lo que escribiste tal cual, si lo escribiste: lo que está a medio teclear no se pierde.
        key: 'effects', label: 'Qué da y qué quita', value: text(row?.effectsSaid) || effectsText(row),
        hint: `Así: «+2 Fuerza, −1 Inteligencia». Vale: ${KIN_STATS.map(s => STAT_LABELS[/** @type {keyof typeof STAT_LABELS} */ (s)]).join(', ')}. Algo tiene que quitar.`,
    };
    switch (step) {
        case 'razas':
            return [name, effects, note];
        case 'clases':
            return [
                name,
                { key: 'hitDie', label: 'Dado de golpe (lo que aguanta)', value: text(row?.hitDie) || '1d8', kind: 'choice', options: DICE.slice(0, 5).map(d => ({ id: d, label: d })) },
                effects, note,
            ];
        case 'habilidades': {
            const mine = (Array.isArray(row?.when?.class) ? row.when.class : []).map(text);
            return [
                name,
                {
                    key: 'class', label: 'De qué clase', value: mine[0] ?? '', kind: 'choice',
                    options: [{ id: '', label: 'Cualquiera' }, ...classes.map(c => ({ id: text(c.id), label: text(c.name) }))],
                },
                { key: 'level', label: 'Desde qué nivel', value: String(Number(row?.level) || 1), kind: 'choice', options: [1, 2, 3, 4, 5].map(n => ({ id: String(n), label: String(n) })) },
                {
                    key: 'base', label: 'Funciona como', value: text(row?.base) || text(row?.id), kind: 'choice',
                    options: abilities.map(a => ({ id: text(a.id), label: text(a.name) })),
                    hint: 'Lo que hace en el juego es lo de esa. Una mecánica nueva no se escribe aquí: es código.',
                },
                note,
            ];
        }
        case 'objetos': {
            const type = text(row?.itemType);
            /** @type {RowField[]} */
            const out = [
                name,
                { key: 'gender', label: 'Se dice…', value: text(row?.gender) || 'f', kind: 'choice', options: [{ id: 'f', label: 'la (una daga)' }, { id: 'm', label: 'el (un hacha)' }] },
            ];
            if (type === 'weapon') {
                out.push(
                    { key: 'damageDice', label: 'Daño', value: text(row?.damageDice) || '1d6', kind: 'choice', options: DICE.map(d => ({ id: d, label: d })) },
                    { key: 'damageType', label: 'Tipo de daño', value: text(row?.damageType) || 'cortante', kind: 'choice', options: DAMAGE_TYPES.map(d => ({ id: d, label: d })) },
                    { key: 'hands', label: 'Manos', value: String(Number(row?.hands) || 1), kind: 'choice', options: [{ id: '1', label: 'Una' }, { id: '2', label: 'Dos (sin escudo)' }] },
                    { key: 'rangeFeet', label: 'Alcance', value: String(Number(row?.rangeFeet) || 5), kind: 'choice', options: [5, 10, 20, 30, 60, 80, 150].map(n => ({ id: String(n), label: n === 5 ? 'Cuerpo a cuerpo' : `${n} pies` })) },
                );
            }
            if (type === 'armor') {
                out.push({ key: 'armorClass', label: 'Defensa (CA)', value: String(Number(row?.armorClass) || 11), kind: 'choice', options: [1, 2, 11, 12, 13, 14, 15, 16, 17, 18].map(n => ({ id: String(n), label: n < 10 ? `+${n} (escudo)` : String(n) })) });
            }
            out.push({ key: 'kg', label: 'Peso (kg)', value: String(Number(row?.kg) || 1) });
            return out;
        }
        case 'bestiario':
            return [
                name,
                { key: 'profile', label: 'Cómo pelea', value: text(row?.profile) || 'aggressive', kind: 'choice', options: PROFILES },
                { key: 'hpFactor', label: 'Cuánto aguanta', value: String(Number(row?.hpFactor) || 1), kind: 'choice', options: TOUGHNESS },
                { key: 'weakness', label: 'Su debilidad (cómo se le gana)', value: text(row?.weakness), kind: 'area' },
                { key: 'quirk', label: 'Su manía', value: text(row?.quirk), kind: 'area' },
            ];
        default:
            return [name, note];
    }
}

/**
 * Lo escrito en un campo, puesto en la fila.
 *
 * @param {string} step
 * @param {any} row
 * @param {string} key
 * @param {string} value
 * @param {Object} [context]
 * @param {any[]} [context.abilities] Las habilidades de serie, para copiar cómo funciona una.
 * @returns {any}
 */
export function applyRowField(step, row, key, value, { abilities = [] } = {}) {
    const said = text(value);
    const out = { ...row };
    if (key === 'effects') {
        out.effects = parseEffects(said).effects;
        out.effectsSaid = said;
    } else if (key === 'class') out.when = { ...(row?.when ?? {}), class: said ? [said] : [] };
    else if (key === 'level' || key === 'hands' || key === 'rangeFeet' || key === 'armorClass') out[key] = Number(said) || 1;
    else if (key === 'kg' || key === 'hpFactor') out[key] = Math.max(0, Number(said.replace(',', '.')) || 0);
    else if (key === 'base') {
        // Cómo funciona: se copia de la otra lo que el motor lee, y se queda lo tuyo.
        const from = abilities.find(a => text(a.id) === said);
        if (from) {
            for (const field of ['cost', 'resource', 'usesPerRest', 'target', 'resolution', 'rangeFeet', 'damage', 'damageType', 'healing', 'saveDc', 'saveAbility', 'condition', 'conditionRounds']) {
                if (from[field] === undefined) delete out[field];
                else out[field] = from[field];
            }
            out.base = said;
        }
    } else out[key] = said;
    return out;
}

/**
 * Lo que no cuadra de una fila, dicho para arreglarlo.
 *
 * @param {string} step
 * @param {any} row
 * @returns {string[]}
 */
export function rowProblems(step, row) {
    /** @type {string[]} */
    const out = [];
    if (!text(row?.name)) out.push('Le falta el nombre.');
    if (step === 'razas' || step === 'clases') {
        const unread = parseEffects(text(row?.effectsSaid)).unread;
        if (unread.length > 0) out.push(`No entiendo «${unread[0]}»: escríbelo como «+2 Fuerza».`);
        const all = effectsOf(row);
        if (all.length === 0) out.push('No da nada ni quita nada: elegirla no significaría nada.');
        else if (!all.some(effect => effect.modifier < 0)) out.push('Solo suma. Algo tiene que quitar, o se elegiría siempre.');
    }
    return out;
}

/**
 * Una fila nueva, hecha a partir de otra: hereda lo que no se ve y se le pone un nombre.
 *
 * @param {string} step
 * @param {any} from La fila de la que parte.
 * @param {number} n Un número que no se repita en este mundo.
 * @returns {any}
 */
export function newRow(step, from, n) {
    const base = { ...(from ?? {}) };
    const out = {
        ...base,
        id: `mio-${step}-${n}`,
        name: NEW_LABELS[/** @type {keyof typeof NEW_LABELS} */ (step)] ?? 'Nuevo',
        note: '',
        mine: true,
    };
    if (step === 'habilidades') out.base = text(base.base) || text(base.id);
    if (step === 'bestiario') {
        out.weakness = '';
        out.quirk = '';
        delete out.domable;
    }
    return out;
}

/**
 * Las filas de una pestaña: las de serie, con las tuyas encima (mismo id) y las nuevas al
 * final.
 *
 * @param {any[]} stock
 * @param {Record<string, any>} mine Por id.
 * @returns {any[]}
 */
export function mergeRows(stock, mine) {
    const own = mine && typeof mine === 'object' ? mine : {};
    const seen = new Set();
    const out = (Array.isArray(stock) ? stock : []).map(row => {
        const id = text(row?.id);
        seen.add(id);
        return own[id] ? { ...own[id], changed: true } : row;
    });
    for (const [id, row] of Object.entries(own)) if (!seen.has(id)) out.push(row);
    return out;
}

/**
 * Lo que un mundo guarda de lo suyo, por batería, para el juego.
 *
 * @param {Record<string, Record<string, any>>} rowsByStep Por pestaña y por id.
 * @returns {Record<string, any[]>}
 */
export function worldRowsFor(rowsByStep) {
    /** @type {Record<string, any[]>} */
    const out = {};
    for (const [step, byId] of Object.entries(rowsByStep ?? {})) {
        for (const row of Object.values(byId ?? {})) {
            const domain = domainOf(step, row);
            const clean = { ...row };
            for (const key of ['changed', 'mine', 'effectsSaid']) delete clean[key];
            // «Funciona como» se queda: es de dónde sale lo que hace, por si se vuelve a abrir.
            if (!clean.base) delete clean.base;
            (out[domain] ??= []).push(clean);
        }
    }
    return out;
}

/**
 * Las baterías de un mundo: las de todos, con las suyas encima. Lo que el mundo tiene con el
 * mismo id sustituye a la fila de serie; lo que no, se añade.
 *
 * @param {Record<string, any[]>} batteries
 * @param {Record<string, any[]>|null|undefined} worldRows
 * @returns {Record<string, any[]>}
 */
export function mergeWorldRows(batteries, worldRows) {
    const source = batteries && typeof batteries === 'object' ? batteries : {};
    if (!worldRows || typeof worldRows !== 'object') return source;
    /** @type {Record<string, any[]>} */
    const out = { ...source };
    for (const [domain, rows] of Object.entries(worldRows)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const byId = new Map(rows.filter(r => text(r?.id)).map(r => [text(r.id), r]));
        const list = (Array.isArray(source[domain]) ? source[domain] : []).map(row => byId.get(text(row?.id)) ?? row);
        const have = new Set(list.map(row => text(row?.id)));
        out[domain] = [...list, ...rows.filter(r => text(r?.id) && !have.has(text(r.id)))];
    }
    return out;
}
