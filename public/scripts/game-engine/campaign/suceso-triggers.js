/**
 * Sucesos con disparador de facción y de reputación (J10.3 de wiki/ROADMAP_SIN_CONEXION.md;
 * lo que quedaba de Z4 en ROADMAP_SIN_TOKENS) y los sucesos propios de cada campaña (D-J42).
 *
 * Un suceso ya salía según el momento, el sitio, el tiempo o el bioma. Ahora también según
 * **cómo está el mundo con vosotros**: los guardias de quien manda aquí os paran si os tienen
 * ganas; los Lobos os piden ayuda cuando os miran bien; los de Vane requisan comida cuando
 * están a punto de salirse con la suya.
 *
 * Los disparadores van en el `when` de la fila, junto a los de siempre:
 *
 * | Clave | Sale si… |
 * | :--- | :--- |
 * | `faccion: "id"` (o una lista, o `"*"`) | manda aquí esa facción (o cualquiera) |
 * | `reputacionAqui: [min, max]` | quien manda aquí os mira entre esos dos valores (de −5 a 5) |
 * | `reputacion: {"id": [min, max]}` | esa facción os mira así, estéis donde estéis |
 * | `fama: [min, max]` | vuestra fama en este sitio está entre esos puntos |
 * | `relojAqui: [min, max]` | el plan de quien manda aquí va por esos segmentos |
 * | `reloj: {"id": [min, max]}` | el plan de esa facción va por esos segmentos |
 *
 * Un rango también puede ser un número solo (desde ahí para arriba) o `{min, max}`. En el
 * texto, `{bando}` es el nombre de la facción del disparador (o de quien manda aquí).
 *
 * Y lo que puede pasar al elegir, además de lo de siempre (`sucesos.js`):
 *
 * - `faccion:<id>:+1` mueve lo que piensa esa facción (y su enemigo, al revés).
 * - `reloj:<id>:-1` retrasa (o adelanta) el plan de esa facción un segmento.
 * - `llave:<nombre>` os da algo que abre caminos (J10.1): el objeto, si el paquete lo tiene; si
 *   no, se apunta (una barca, un permiso de palabra).
 * - `guia:<nombre>` alguien se ofrece a guiaros: abre los caminos que piden ese guía.
 *
 * Puro: de las facciones, el sitio y la fama, a si un suceso sale y con qué nombre. Quien llama
 * lo aplica.
 */

import { readFactions, clockOf, factionWorldOn } from './factions.js';
import { fameAt } from './fame.js';

/** Las claves de `when` que miran el mundo y no los hechos del momento. */
export const TRIGGER_KEYS = ['faccion', 'reputacion', 'reputacionAqui', 'fama', 'reloj', 'relojAqui'];

/** Los momentos en que puede salir un suceso. */
export const SUCESO_MOMENTS = ['viaje', 'llegada', 'descanso', 'semana'];

/**
 * Y el de lo que vuelve: un suceso con `continuacion` no se sortea, solo sale cuando otro lo pide
 * con su `follow` (J11.2). Sin él, la continuación de un suceso de la campaña no se encontraría.
 */
export const FOLLOW_MOMENT = 'continuacion';

/**
 * @typedef {Object} SucesoWorld
 * @property {string} here
 * @property {{id: string, name: string}|null} ruler Quien manda aquí.
 * @property {Record<string, number>} standing Cómo os mira cada facción, por id.
 * @property {Record<string, string>} names El nombre de cada facción, por id.
 * @property {Record<string, number>} clocks Por qué segmento va el plan de cada una.
 * @property {number} fame Vuestra fama aquí, en puntos.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Cómo está el mundo con vosotros, aquí: lo que miran los disparadores.
 *
 * @param {Object} input
 * @param {any[]} [input.factions] Las del mundo, con su reputación y su reloj.
 * @param {string} [input.here]
 * @param {any} [input.fame] La fama por sitio (`fame.js`).
 * @returns {SucesoWorld}
 */
export function sucesoWorld({ factions = [], here = '', fame = {} } = {}) {
    const all = readFactions(factions);
    const where = plain(here);
    const ruler = where
        ? all.find(f => plain(f.seat) === where || f.holds.some((/** @type {string} */ h) => plain(h) === where)) ?? null
        : null;
    return {
        here: text(here),
        ruler: ruler ? { id: ruler.id, name: ruler.name } : null,
        standing: Object.fromEntries(all.map(f => [f.id, f.reputation])),
        names: Object.fromEntries(all.map(f => [f.id, f.name])),
        clocks: Object.fromEntries(all.map(f => [f.id, clockOf(f).at])),
        fame: fameAt(fame, here).points,
    };
}

/**
 * Si un valor cae en un rango: `[min, max]`, `{min, max}` o un número (desde ahí).
 *
 * @param {number} value
 * @param {any} rule
 * @returns {boolean}
 */
export function inRange(value, rule) {
    if (rule === undefined || rule === null) return true;
    let low = -Infinity;
    let high = Infinity;
    if (Array.isArray(rule)) {
        low = Number.isFinite(Number(rule[0])) ? Number(rule[0]) : -Infinity;
        high = Number.isFinite(Number(rule[1])) ? Number(rule[1]) : Infinity;
    } else if (typeof rule === 'object') {
        low = Number.isFinite(Number(rule.min)) ? Number(rule.min) : -Infinity;
        high = Number.isFinite(Number(rule.max)) ? Number(rule.max) : Infinity;
    } else if (Number.isFinite(Number(rule))) {
        low = Number(rule);
    } else {
        return false;
    }
    return value >= low && value <= high;
}

/**
 * Si una fila tiene algún disparador del mundo.
 *
 * @param {any} row
 * @returns {boolean}
 */
export function hasTriggers(row) {
    const when = row?.when;
    return Boolean(when && typeof when === 'object' && TRIGGER_KEYS.some(key => when[key] !== undefined));
}

/**
 * Si un suceso puede salir, con cómo está el mundo. Uno sin disparadores sale siempre (lo
 * deciden sus otras condiciones); uno con disparadores, sin saber cómo está el mundo, no.
 *
 * @param {any} row
 * @param {SucesoWorld|null|undefined} world
 * @returns {boolean}
 */
export function passesTriggers(row, world) {
    if (!hasTriggers(row)) return true;
    if (!world) return false;
    const when = row.when;
    // D-J58: lo que sale porque una facción mueve su plan (su reloj) espera al mundo vivo. Lo
    // que sale por quién manda aquí o por lo que os aprecian es historia, y sigue.
    if (!factionWorldOn() && (when.reloj !== undefined || when.relojAqui !== undefined)) return false;

    if (when.faccion !== undefined) {
        if (!world.ruler) return false;
        const wanted = [when.faccion].flat().map(text);
        if (!wanted.includes('*') && !wanted.some(id => plain(id) === plain(world.ruler?.id) || plain(id) === plain(world.ruler?.name))) return false;
    }
    if (when.reputacionAqui !== undefined) {
        if (!world.ruler) return false;
        if (!inRange(world.standing[world.ruler.id] ?? 0, when.reputacionAqui)) return false;
    }
    if (when.relojAqui !== undefined) {
        if (!world.ruler) return false;
        if (!inRange(world.clocks[world.ruler.id] ?? 0, when.relojAqui)) return false;
    }
    if (when.reputacion !== undefined) {
        const rules = when.reputacion && typeof when.reputacion === 'object' && !Array.isArray(when.reputacion) ? when.reputacion : {};
        for (const [id, rule] of Object.entries(rules)) {
            if (!(id in world.standing)) return false;
            if (!inRange(world.standing[id], rule)) return false;
        }
    }
    if (when.reloj !== undefined) {
        const rules = when.reloj && typeof when.reloj === 'object' && !Array.isArray(when.reloj) ? when.reloj : {};
        for (const [id, rule] of Object.entries(rules)) {
            if (!(id in world.clocks)) return false;
            if (!inRange(world.clocks[id], rule)) return false;
        }
    }
    if (when.fama !== undefined && !inRange(world.fame, when.fama)) return false;
    return true;
}

/**
 * El nombre que va en `{bando}`: la facción que nombra el disparador o, si no nombra
 * ninguna, quien manda aquí.
 *
 * @param {any} row
 * @param {SucesoWorld|null|undefined} world
 * @returns {Record<string, string>}
 */
export function triggerFacts(row, world) {
    if (!world) return {};
    const when = row?.when ?? {};
    const named = [
        ...[when.faccion ?? []].flat().map(text).filter(id => id && id !== '*'),
        ...Object.keys(when.reputacion && typeof when.reputacion === 'object' && !Array.isArray(when.reputacion) ? when.reputacion : {}),
        ...Object.keys(when.reloj && typeof when.reloj === 'object' && !Array.isArray(when.reloj) ? when.reloj : {}),
    ];
    const byId = named.map(id => world.names[id] ?? Object.values(world.names).find(name => plain(name) === plain(id))).find(Boolean);
    const bando = byId || world.ruler?.name || '';
    return bando ? { bando } : {};
}

/**
 * Los hechos del momento sin las claves de los disparadores: las mira `passesTriggers`, no
 * `matches` (que compararía un rango con un texto).
 *
 * @param {Record<string, any>} facts
 * @returns {Record<string, any>}
 */
export function withoutTriggers(facts) {
    const out = { ...(facts ?? {}) };
    for (const key of TRIGGER_KEYS) delete out[key];
    return out;
}

/**
 * Un efecto, partido: `faccion:los-lobos:+1` es la facción, a quién y cuánto.
 *
 * @param {string} effect
 * @returns {{kind: string, target: string, amount: number, raw: string}}
 */
export function readSucesoEffect(effect) {
    const raw = text(effect);
    const [kind = '', ...rest] = raw.split(':');
    if (kind === 'llave' || kind === 'guia') return { kind, target: rest.join(':').trim(), amount: 0, raw };
    if ((kind === 'faccion' || kind === 'reloj') && rest.length >= 2) {
        return { kind, target: text(rest[0]), amount: Math.trunc(Number(rest[1]) || 0), raw };
    }
    const amount = Number(rest[0]);
    return { kind, target: '', amount: Number.isFinite(amount) ? amount : 0, raw };
}

/**
 * Los efectos nuevos, dichos para quien juega. Vacío para los de siempre (los dice
 * `describeEffect` de `sucesos.js`).
 *
 * @param {string} effect
 * @param {Record<string, string>} [names] El nombre de cada facción, por id.
 * @returns {string}
 */
export function describeWorldEffect(effect, names = {}) {
    const read = readSucesoEffect(effect);
    const who = names[read.target] || read.target;
    if (read.kind === 'llave') return read.target ? `conseguís: ${read.target}` : '';
    if (read.kind === 'guia') return read.target ? `${read.target} os guiará` : '';
    if (read.kind === 'faccion' && read.target) return read.amount < 0 ? `${who}: os miran peor` : `${who}: os miran mejor`;
    // D-J58: sin el mundo vivo, el plan de nadie se retrasa ni adelanta: no se dice.
    if (read.kind === 'reloj' && read.target && factionWorldOn()) return read.amount < 0 ? `${who} se retrasa en lo suyo` : `${who} adelanta en lo suyo`;
    return '';
}

/**
 * Los sucesos de una campaña, tal como se sortean: los que traen id, texto, un momento y al
 * menos dos opciones. Lo demás no sale.
 *
 * @param {any} raw
 * @returns {any[]}
 */
export function readCampaignSucesos(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(row => row && typeof row === 'object' && text(row.id) && text(row.text) && Array.isArray(row.options) && row.options.length >= 2)
        .filter(row => [row.when?.momento ?? []].flat().map(text).some(moment => SUCESO_MOMENTS.includes(moment) || moment === FOLLOW_MOMENT))
        .map(row => ({ ...row, kind: 'suceso', id: text(row.id), name: text(row.name) || text(row.id), weight: Number.isFinite(Number(row.weight)) ? Number(row.weight) : 1 }));
}

/**
 * Los del compendio y los de la campaña, juntos. Uno de la campaña con el mismo id que uno
 * del compendio lo sustituye.
 *
 * @param {any[]} base
 * @param {any[]} own
 * @returns {any[]}
 */
export function mergeSucesoRows(base, own) {
    const mine = readCampaignSucesos(own);
    const taken = new Set(mine.map(row => row.id));
    return [...(Array.isArray(base) ? base : []).filter(row => !taken.has(text(row?.id))), ...mine];
}

/** Los efectos que entiende un suceso, de siempre y nuevos. */
const EFFECT = /^(oro:[+-](\d+|\d*d\d+)|hora|dia|herida:(\d+|\d*d\d+)|cura:\d*d\d+|comida|fama:[+-]1|faccion:[+-]1|faccion:[a-z0-9-]+:[+-]\d|reloj:[a-z0-9-]+:[+-]\d|llave:.+|guia:.+|vinculo:\+1|rumor|pista)$/;

/**
 * Lo que un paquete escribe mal en sus sucesos: sin momento, con un efecto que no existe, una
 * facción que no está, una tirada que no es de ninguna habilidad o una continuación que no
 * lleva a ningún suceso.
 *
 * @param {any} raw
 * @param {Object} input
 * @param {any[]} [input.factions]
 * @param {string[]} [input.skills] Las habilidades que valen para tirar.
 * @returns {Array<{path: string, message: string}>}
 */
export function checkCampaignSucesos(raw, { factions = [], skills = [] } = {}) {
    /** @type {Array<{path: string, message: string}>} */
    const out = [];
    if (raw === undefined) return out;
    if (!Array.isArray(raw)) return [{ path: 'sucesos', message: 'Tiene que ser una lista de sucesos; se ignora.' }];
    const ids = new Set(readFactions(factions).map(f => f.id));
    const known = new Set(raw.map(row => text(row?.id)).filter(Boolean));
    raw.forEach((row, index) => {
        const path = `sucesos[${index}]`;
        if (!text(row?.id) || !text(row?.text)) {
            out.push({ path, message: 'Sin `id` o sin `text`: no saldrá.' });
            return;
        }
        const moments = [row.when?.momento ?? []].flat().map(text);
        if (!moments.some(m => SUCESO_MOMENTS.includes(m) || m === FOLLOW_MOMENT)) {
            out.push({ path: `${path}.when.momento`, message: `Sin momento: tiene que ser uno de ${[...SUCESO_MOMENTS, FOLLOW_MOMENT].join(', ')}. No saldrá.` });
        }
        if (!Array.isArray(row.options) || row.options.length < 2) {
            out.push({ path: `${path}.options`, message: 'Hacen falta al menos dos opciones: sin elegir no es un suceso. No saldrá.' });
        }
        const named = [
            ...[row.when?.faccion ?? []].flat().map(text).filter(id => id && id !== '*'),
            ...Object.keys(row.when?.reputacion && typeof row.when.reputacion === 'object' ? row.when.reputacion : {}),
            ...Object.keys(row.when?.reloj && typeof row.when.reloj === 'object' ? row.when.reloj : {}),
        ];
        for (const id of named) {
            if (!ids.has(id)) out.push({ path: `${path}.when`, message: `"${id}" no es el id de ninguna facción del paquete: no saldrá nunca.` });
        }
        (Array.isArray(row.options) ? row.options : []).forEach((/** @type {any} */ option, /** @type {number} */ at) => {
            const effects = [...(option?.effects ?? []), ...(option?.success?.effects ?? []), ...(option?.fail?.effects ?? [])].map(text);
            for (const effect of effects) {
                if (!EFFECT.test(effect)) {
                    out.push({ path: `${path}.options[${at}]`, message: `"${effect}" no es un efecto que el juego sepa hacer.` });
                    continue;
                }
                const read = readSucesoEffect(effect);
                if ((read.kind === 'faccion' || read.kind === 'reloj') && read.target && !ids.has(read.target)) {
                    out.push({ path: `${path}.options[${at}]`, message: `"${read.target}" no es el id de ninguna facción del paquete.` });
                }
            }
            if (option?.check && skills.length > 0 && !skills.includes(text(option.check.skill))) {
                out.push({ path: `${path}.options[${at}].check.skill`, message: `"${text(option.check.skill)}" no es una habilidad para tirar.` });
            }
            if (option?.follow && !known.has(text(option.follow.id))) {
                out.push({ path: `${path}.options[${at}].follow`, message: `Vuelve como "${text(option.follow.id)}", que no es ningún suceso del paquete.` });
            }
        });
    });
    return out;
}
