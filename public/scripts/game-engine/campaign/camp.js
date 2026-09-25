/**
 * El campamento como escena: el fuego, las guardias, la charla y la cena (idea 67, y la
 * propuesta P16 de los encuentros de noche).
 *
 * Dormir al raso era igual de seguro que en una posada. Ahora, fuera de pueblos y ciudades,
 * se puede **acampar**, y cada decisión se nota:
 *
 * - **El fuego** abriga y deja cocinar, pero se ve de lejos: algo más de riesgo de noche.
 *   Sin fuego, con nieve o tormenta, nadie duerme de verdad (salvo quien lleve algo que
 *   abrigue, como una capa de pieles).
 * - **Las guardias**: si algo se acerca de noche, quien vigila tira Percepción. Si lo ve
 *   venir, se va sin nada; si no hay guardia o no lo ve, os roba oro mientras dormís.
 * - **La charla**: una noche junto al fuego con alguien acerca el vínculo.
 * - **La cena**: con fuego, se busca qué echarle (Supervivencia, como al forrajear). Si sale,
 *   se cena caliente y se acaba el hambre.
 *
 * Lo que pasa de noche es azar del motor, con su tabla a la vista (`NIGHT_CHANCE`), y su
 * `scale` es lo que el recorrido del navegador pone a cero para que dormir no le robe.
 *
 * Puro: decide y cuenta. Quien llama descansa, cobra y guarda.
 */

/** Lo que pasa de noche, por tipo de sitio. `scale` lo multiplica todo. */
export const NIGHT_CHANCE = {
    base: /** @type {Record<string, number>} */ ({
        wilderness: 0.25, ruins: 0.3, dungeon: 0.35, camp: 0.2, sanctuary: 0.1, outpost: 0.1,
    }),
    /** Donde no dice qué es. */
    fallback: 0.2,
    /** El fuego se ve de lejos. */
    fire: 0.1,
    /** Tierra de quien os tiene ganas. */
    hostile: 0.15,
    scale: 1,
};

/** La Percepción que hace falta para ver venir lo que se acerca. */
export const WATCH_DC = 12;

/** Cuántos pueden hacer guardia en una noche. */
export const MAX_GUARDS = 2;

/** Donde hay posada no se acampa: se duerme en ella. */
export const SETTLED = ['village', 'city', 'port'];

/** El frío que no deja dormir sin fuego. */
export const COLD = ['nieve', 'tormenta'];

/** Lo que abriga, por el nombre de lo que se lleva. */
const WARM = /capa de pieles|manta|abrigo|pelliza/i;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si aquí se puede acampar, y por qué no si no.
 *
 * @param {{locationType?: string, fighting?: boolean}} input
 * @returns {{ok: boolean, reason: string}}
 */
export function canCamp({ locationType = '', fighting = false }) {
    if (fighting) return { ok: false, reason: 'No mientras peleáis.' };
    if (SETTLED.includes(text(locationType).toLowerCase())) return { ok: false, reason: 'Aquí hay posada: se duerme en ella.' };
    return { ok: true, reason: '' };
}

/**
 * La probabilidad de que algo se acerque esta noche.
 *
 * @param {{locationType?: string, fire?: boolean, hostile?: boolean}} input
 * @returns {number} De 0 a 0,9.
 */
export function nightRisk({ locationType = '', fire = false, hostile = false }) {
    const base = NIGHT_CHANCE.base[text(locationType).toLowerCase()] ?? NIGHT_CHANCE.fallback;
    const raw = base + (fire ? NIGHT_CHANCE.fire : 0) + (hostile ? NIGHT_CHANCE.hostile : 0);
    return Math.max(0, Math.min(0.9, raw * (Number(NIGHT_CHANCE.scale) || 0)));
}

/**
 * Quién vigila si no se elige: los que mejor ven, de los que siguen en pie.
 *
 * @param {any[]} party
 * @param {(member: any) => number} perceptionOf
 * @returns {string[]} Sus ids.
 */
export function defaultGuards(party, perceptionOf) {
    return (Array.isArray(party) ? party : [])
        .filter(m => !m?.dead && (Number(m?.hp) || 0) > 0)
        .sort((a, b) => perceptionOf(b) - perceptionOf(a))
        .slice(0, MAX_GUARDS)
        .map(m => String(m.id));
}

/**
 * @typedef {Object} NightResult
 * @property {boolean} came     Si algo se acercó.
 * @property {boolean} spotted  Si alguien lo vio venir.
 * @property {string} intruder
 * @property {{name: string, total: number, dc: number, success: boolean}|null} watch La tirada de guardia.
 * @property {{kind: 'oro', amount: number}|null} loss Lo que se llevaron.
 * @property {string} line
 */

/**
 * Lo que pasa de noche.
 *
 * Tira quien mejor ve de los que vigilan; sin guardia, no lo ve nadie. Lo que se llevan es
 * algo de oro: una noche mala cuesta, pero no mata.
 *
 * @param {Object} input
 * @param {number} input.risk
 * @param {any[]} input.guards Los que vigilan (miembros).
 * @param {() => number} input.random
 * @param {() => number} input.rollD20
 * @param {(member: any) => number} input.perceptionOf
 * @param {number} [input.purse] El oro del grupo.
 * @param {string} [input.intruder] Qué se acerca.
 * @returns {NightResult}
 */
export function resolveNight({ risk, guards, random, rollD20, perceptionOf, purse = 0, intruder = '' }) {
    const who = text(intruder) || 'Algo';
    if (!(random() < Math.max(0, Number(risk) || 0))) {
        return { came: false, spotted: false, intruder: who, watch: null, loss: null, line: 'La noche pasa sin sobresaltos.' };
    }
    const awake = (Array.isArray(guards) ? guards : []).filter(m => !m?.dead && (Number(m?.hp) || 0) > 0);
    const best = awake.reduce((/** @type {any} */ top, m) => (!top || perceptionOf(m) > perceptionOf(top) ? m : top), null);
    /** @type {NightResult['watch']} */
    let watch = null;
    if (best) {
        const natural = Math.max(1, Math.min(20, Math.floor(Number(rollD20()) || 1)));
        const total = natural + perceptionOf(best);
        watch = { name: text(best.name) || 'Alguien', total, dc: WATCH_DC, success: natural === 20 || (natural !== 1 && total >= WATCH_DC) };
    }
    if (watch?.success) {
        return {
            came: true, spotted: true, intruder: who, watch, loss: null,
            line: `${who} se acerca de noche, pero ${watch.name} lo ve venir (${watch.total} contra ${WATCH_DC}): se va sin nada.`,
        };
    }
    const amount = Math.min(Math.max(0, Math.floor(Number(purse) || 0)), 5 + Math.floor(random() * 16));
    const why = watch ? `${watch.name} no lo ve venir (${watch.total} contra ${WATCH_DC})` : 'nadie hacía guardia';
    return {
        came: true, spotted: false, intruder: who, watch,
        loss: amount > 0 ? { kind: 'oro', amount } : null,
        line: amount > 0
            ? `${who} entra en el campamento de noche: ${why}. Se lleva ${amount} de oro.`
            : `${who} entra en el campamento de noche: ${why}. Revuelve, pero no encuentra nada que llevarse.`,
    };
}

/**
 * Si alguien lleva algo que abrigue.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function wrappedUp(member) {
    return (Array.isArray(member?.items) ? member.items : []).some((/** @type {any} */ item) => WARM.test(text(item?.name)));
}

/**
 * Lo que deja la noche por la mañana: quién duerme de verdad y quién cena.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {boolean} input.fire
 * @param {string} [input.weather]
 * @param {boolean} [input.cook] Si se quiere cenar caliente.
 * @param {boolean} [input.caught] Si la tirada de buscar qué cenar salió.
 * @returns {{restless: string[], fed: boolean, lines: string[]}}
 */
export function campMorning({ party, fire, weather = '', cook = false, caught = false }) {
    const living = (Array.isArray(party) ? party : []).filter(m => !m?.dead && (Number(m?.hp) || 0) > 0);
    const cold = COLD.includes(text(weather).toLowerCase());
    /** @type {string[]} */
    const lines = [];
    const restless = cold && !fire ? living.filter(m => !wrappedUp(m)).map(m => String(m.id)) : [];
    if (restless.length > 0) {
        lines.push(`Sin fuego y con este tiempo no duerme nadie de verdad${restless.length < living.length ? ', salvo quien va bien abrigado' : ''}.`);
    } else if (cold && fire) {
        lines.push('El fuego aguanta el frío: se duerme.');
    }
    const fed = Boolean(cook && fire && caught && living.length > 0);
    if (cook && !fire) lines.push('Sin fuego no hay cena caliente.');
    else if (cook && !caught) lines.push('No sale nada que echar al fuego: se cena frío, y poco.');
    else if (fed) lines.push('Se cena caliente junto al fuego: nadie pasa hambre.');
    return { restless, fed, lines };
}
