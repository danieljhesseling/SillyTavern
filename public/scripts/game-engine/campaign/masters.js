/**
 * Maestros: aprender una habilidad en un pueblo, con oro y días (idea 54).
 *
 * Hasta ahora, lo que sabía hacer cada uno lo decidía su clase al empezar (y el editor de
 * habilidades, a mano). Aquí hay otra salida, que cuesta lo que cuestan las cosas: en cada
 * pueblo o ciudad hay alguien que enseña un par de cosas, a quien sea de un oficio que
 * pueda aprenderlas, a cambio de oro y de días quietos.
 *
 * Qué se enseña en cada sitio sale con la semilla del mundo y del sitio: el herrero de El
 * Pueblo de Barro enseña siempre lo mismo, y para aprender otra cosa hay que ir a otro sitio.
 *
 * Puro: dice qué se enseña aquí, a quién y cuánto cuesta. Quien llama cobra, pasa los días,
 * añade la habilidad al catálogo del mundo si no estaba y la apunta en la ficha.
 */

/** Lo que cuesta una lección, y lo que dura. */
export const LESSON = { price: 50, days: 2 };

/** Los sitios donde hay a quien pedírselo. */
export const MASTER_PLACES = ['city', 'village'];

/** Cuántas cosas enseña cada maestro, como mucho. */
export const LESSONS_PER_PLACE = 2;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si en un sitio hay maestro.
 *
 * @param {any} location
 * @returns {boolean}
 */
export function hasMaster(location) {
    return MASTER_PLACES.includes(text(location?.locationType ?? location?.type).toLowerCase());
}

/**
 * Lo que se enseña aquí: de lo que el oficio de alguien puede aprender, lo que toca en este
 * sitio (con la semilla) y no sabe todavía.
 *
 * @param {Object} input
 * @param {any[]} input.candidates Las habilidades que su clase puede aprender a su nivel (`abilitiesFor`).
 * @param {string[]} [input.known] Las que ya sabe, por id.
 * @param {() => number} input.random Con la semilla del mundo y del sitio: lo mismo cada vez.
 * @param {number} [input.max]
 * @returns {Array<{ability: any, price: number, days: number}>}
 */
export function lessonsHere({ candidates, known = [], random, max = LESSONS_PER_PLACE }) {
    const pool = [...(Array.isArray(candidates) ? candidates : [])]
        .filter(a => text(a?.id))
        .sort((a, b) => text(a.id).localeCompare(text(b.id)));
    /** @type {any[]} */
    const taught = [];
    // Primero se decide qué enseña el sitio (sin mirar quién pregunta), y luego se quita lo
    // que ya se sabe: el maestro no cambia de oficio según quién entre por la puerta.
    while (taught.length < max && pool.length > 0) {
        taught.push(pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0]);
    }
    const already = new Set((Array.isArray(known) ? known : []).map(text));
    return taught
        .filter(a => !already.has(text(a.id)))
        .map(ability => ({ ability, price: LESSON.price, days: LESSON.days }));
}

/**
 * Si se puede tomar la lección, y si no, por qué.
 *
 * @param {{purse: number, fighting?: boolean}} state
 * @param {{price: number}} lesson
 * @returns {{ok: boolean, reason: string}}
 */
export function canLearn({ purse, fighting = false }, lesson) {
    if (fighting) return { ok: false, reason: 'No mientras peleáis.' };
    if (Math.floor(Number(purse) || 0) < lesson.price) return { ok: false, reason: `No llega el oro: cuesta ${lesson.price}.` };
    return { ok: true, reason: '' };
}

/**
 * Cómo se cuenta: quién aprende qué, dónde y cuánto tardó.
 *
 * @param {string} who
 * @param {any} ability
 * @param {string} place
 * @returns {string}
 */
export function describeLesson(who, ability, place) {
    return `${text(who)} pasa ${LESSON.days} días con quien enseña en ${text(place)} y aprende «${text(ability?.name)}».`
        + (text(ability?.description) ? ` ${text(ability.description)}` : '');
}
