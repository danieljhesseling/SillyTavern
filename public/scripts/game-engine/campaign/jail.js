/**
 * El calabozo (D-J47 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Antes, a la segunda vez que os pillaban robando en la misma tienda, no os vendía nada en
 * cuatro semanas. Daniel: «cuatro semanas sin venderte es muchísimo; ¿un par de días en el
 * calabozo?». Así queda:
 *
 * - **La primera vez** que os pillan, quien atiende se acuerda: os saluda con ello y os cobra un
 *   30 % más durante una semana (`compendio/ecos.json`); la multa del doble sigue (`crime.js`).
 * - **La segunda**, mientras se acuerdan de la primera, la guardia del sitio se lleva a quien
 *   robó: una escena corta, como una novela visual, y dos días en la celda (el reloj pasa). Lo
 *   robado en esa tienda se lo quedan, y si llega el oro se paga una multa pequeña. Lo que os
 *   buscaban en el pueblo queda saldado: ya habéis pagado.
 * - **Después**, la tienda os vuelve a vender, algo más cara unos días.
 *
 * Cuándo toca lo dice `jailFor` (`world-marks.js`), con el `calabozo` de la fila de `ecos.json`.
 *
 * Puro: quién es la guardia, qué se requisa, cuánto se paga y lo que se ve. Quien llama
 * (`party/jail.js`) lo aplica y pasa los días.
 */

import { resolveGender } from './grammar.js';

/** La multa del calabozo, como poco. Es pequeña: los días en la celda ya son el castigo. */
export const JAIL_MIN_FINE = 5;

/** Lo que dice el oficio de quien es la guardia de un sitio (el alguacil de El Pueblo de Barro). */
const GUARD_TRADE = /\b(alguacil|guardia|sargento|carceler[oa]|capit[aá]n de la guardia|jefe de la guardia)\b/i;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Los días, dichos: «dos días». */
const DAY_WORDS = ['', 'un día', 'dos días', 'tres días', 'cuatro días', 'cinco días', 'seis días', 'siete días'];

/**
 * @param {number} days
 * @returns {string}
 */
export function daysWord(days) {
    const n = Math.max(1, Math.floor(Number(days) || 1));
    return DAY_WORDS[n] ?? `${n} días`;
}

/** @param {string} line @returns {string} */
const capital = (line) => (line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}` : line);

/**
 * La multa del calabozo: lo que valía lo que se intentó llevar, y como poco `JAIL_MIN_FINE`.
 *
 * @param {number} price
 * @returns {number}
 */
export function jailFine(price) {
    return Math.max(JAIL_MIN_FINE, Math.round(Number(price) || 0));
}

/**
 * Quién es la guardia de un sitio: alguien de su gente cuyo oficio es guardar (el alguacil, un
 * sargento…); si no hay nadie así, «Un guardia», sin nombre.
 *
 * @param {Object} input
 * @param {Array<{name: string, where?: string, trade?: string, dead?: boolean}>} [input.npcs]
 * @param {string} input.town
 * @returns {{name: string, named: boolean}}
 */
export function guardOf({ npcs = [], town }) {
    const here = fold(town);
    const found = (Array.isArray(npcs) ? npcs : [])
        .find(n => n && !n.dead && text(n.name) && fold(n.where) === here && GUARD_TRADE.test(text(n.trade)));
    return found ? { name: text(found.name), named: true } : { name: 'Un guardia', named: false };
}

/**
 * Lo que se robó en la tienda de un sitio (sin que os pillaran) y todavía lleva alguien: es lo
 * que la guardia se lleva.
 *
 * @param {any[]} members
 * @param {string} town
 * @returns {Array<{memberId: string, itemId: string, name: string}>}
 */
export function stolenHere(members, town) {
    const here = fold(town);
    if (!here) return [];
    return (Array.isArray(members) ? members : []).flatMap(member => (Array.isArray(member?.items) ? member.items : [])
        .filter((/** @type {any} */ item) => item && fold(item.stolenFrom) === here)
        .map((/** @type {any} */ item) => ({ memberId: text(member.id), itemId: text(item.id), name: text(item.name) })));
}

/**
 * Lo que sale de la tienda sin pagar, con de dónde es: si la guardia os lleva, se lo queda.
 *
 * @template {Record<string, any>} T
 * @param {T} item
 * @param {string} town
 * @returns {T & {stolenFrom: string}}
 */
export function markStolen(item, town) {
    return { ...item, stolenFrom: text(town) };
}

/**
 * Una lista dicha: «el aceite, la cuerda y la vela».
 *
 * @param {string[]} names
 * @returns {string}
 */
function listed(names) {
    const list = names.map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * @typedef {Object} JailFacts Lo que pasa en el calabozo, ya decidido.
 * @property {string} town
 * @property {{name: string, named: boolean}} guard
 * @property {string} [keeper] Quien atiende la tienda.
 * @property {any} thief Quien robó: su ficha (nombre, género).
 * @property {any} [hero] Quien juega.
 * @property {any} [visitor] Quien va a verle a la celda; nadie, si no hay.
 * @property {number} days
 * @property {number} fine
 * @property {boolean} paid Si llegó el oro para la multa.
 * @property {string[]} taken Lo que se lleva la guardia: lo de ahora y lo robado antes allí.
 * @property {number} releaseDay El día en que sale.
 */

/**
 * La escena del calabozo, lista para `openPlotScene` (`ui/plot-scene.js`): el grito en la
 * tienda, la guardia, la celda, quien va a ver al preso y la salida. Sin decisiones: se lee.
 *
 * Si quien robó eres tú, la escena te habla a ti; si es alguien de tu gente, le ves a él.
 *
 * @param {JailFacts} facts
 * @returns {import('./plot-scenes.js').PlotScene}
 */
export function jailScene(facts) {
    const { town, guard, keeper = '', thief, hero = null, visitor = null, days, fine, paid, taken, releaseDay } = facts;
    const you = !hero || text(thief?.id) === text(hero?.id);
    const name = text(thief?.name) || 'Quien robó';
    const who = { heroe: hero ?? thief, ladron: thief, visita: visitor };
    const say = (/** @type {string} */ line) => resolveGender(line, who).replace(/\s+/g, ' ').trim();
    const time = daysWord(days);
    const goods = listed(taken);
    const place = text(town) || 'el pueblo';

    /** @type {import('./plot-scenes.js').SceneBeat[]} */
    const beats = [];
    const beat = (/** @type {string} */ speaker, /** @type {string} */ mood, /** @type {string} */ line) => {
        beats.push({ who: speaker, mood, text: say(line), decision: null });
    };

    beat('', 'neutral', `${text(keeper) || 'Alguien'} grita «¡Al ladrón!» y la guardia de ${place} llega enseguida.`);
    beat(guard.name, 'enfadado', you
        ? 'Otra vez tú. Ya te avisaron la primera vez. Ahora vienes con nosotros.'
        : `Otra vez ${name}. Ya se le avisó la primera vez. Ahora viene con nosotros.`);
    beat('', 'neutral', you
        ? `Te quitan ${goods || 'lo que llevabas'} y te llevan al calabozo. ${capital(time)} a pan y agua, en una celda que huele a paja mojada.`
        : `Le quitan ${goods || 'lo que llevaba'} a ${name} y se {ladron:lo|la} llevan al calabozo. ${capital(time)} a pan y agua, en una celda que huele a paja mojada.`);
    if (you && visitor) {
        beat(text(visitor.name), 'triste', `Te traigo pan y algo de queso. Los demás esperamos en la posada. Aguanta, que son ${time}.`);
    } else if (you) {
        beat('', 'neutral', 'Nadie viene a verte. Las horas pasan despacio entre la paja y el frío.');
    } else {
        beat('', 'neutral', `Vas a ver a ${name} a la reja. No tiene buena cara.`);
        beat(name, 'triste', 'No me mires así. Ya sé que me pillaron. Esto se pasa pronto.');
    }
    if (paid) {
        beat(guard.name, 'neutral', you
            ? `Son ${fine} de oro de multa. Pagas y te vas. Si te vuelvo a ver robando aquí, será peor.`
            : `Son ${fine} de oro de multa. Se paga y se va. Si {ladron:lo|la} vuelvo a ver robando aquí, será peor.`);
    } else {
        beat(guard.name, 'neutral', you
            ? 'No llevas ni para la multa: los días de celda la pagan. Largo de aquí, y no vuelvas a robar.'
            : `No lleváis ni para la multa: los días de celda la pagan. Llevaos a ${name}, y que no vuelva a robar aquí.`);
    }
    beat('', 'neutral', you
        ? `Al amanecer del día ${releaseDay} sales a la calle. En la tienda te volverán a vender, pero unos días más caro.`
        : `Al amanecer del día ${releaseDay}, ${name} sale a la calle. En la tienda os volverán a vender, pero unos días más caro.`);

    const title = `El calabozo de ${place}`;
    return {
        kind: 'scene',
        id: 'calabozo',
        title,
        text: jailLine(facts),
        beats,
        dialogue: null,
        backdrop: { place: '', town: text(town) },
    };
}

/**
 * Lo que pasó, en una línea: para el registro, la crónica y el narrador.
 *
 * @param {JailFacts} facts
 * @returns {string}
 */
export function jailLine({ town, guard, thief, days, fine, paid, taken }) {
    const name = text(thief?.name) || 'Quien robó';
    const goods = listed(taken);
    const watch = guard?.named ? `${text(guard.name)}, de la guardia de ${text(town) || 'el pueblo'},` : `La guardia de ${text(town) || 'el pueblo'}`;
    return [
        `${watch} se lleva a ${name} al calabozo por robar otra vez en la tienda: ${daysWord(days)}.`,
        goods ? `Se quedan con ${goods}.` : '',
        paid ? `Multa: ${fine} de oro.` : 'No llegaba el oro para la multa: la pagan los días de celda.',
    ].filter(Boolean).join(' ');
}
