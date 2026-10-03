/**
 * Quien no habla hasta cierto rango (tanda 22 de wiki/ROADMAP_SIN_CONEXION.md, «Retoques que he
 * decidido»).
 *
 * Grimm, de 1387, es «una montaña de músculo que solo habla con gruñidos»: no dice una palabra
 * hasta el rango 8 (su escena «La primera palabra»). Sus escenas y charlas ya lo escriben así
 * («Mm.», «Hmf.», sin acotaciones); esto cubre lo que el juego le pone en la boca por su cuenta:
 * lo que grita en la pelea, lo que opina de un encargo o si se apunta. Hasta ese rango, un
 * gruñido. Y lo que alguien tiene que contar (cómo fue la noche, lo que se ve al mirar, la
 * trampa que se ve venir) lo cuenta otro de los tuyos.
 *
 * Se escribe en su ficha de `compendio/companeros.json` o en su confidente del paquete:
 * `"callaHasta": 8`. Sin el campo, habla como todos.
 *
 * Puro: de una ficha y un rango, si calla y con qué gruñido.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Los gruñidos, por lo que pasa: lo mismo que diría con palabras, sin ellas.
 *
 * - en la pelea (`barks.js`): acertar, un crítico, tumbar a uno, ver caer a un amigo, llevarse un
 *   golpe y ganar;
 * - al opinar de un encargo: si le gusta o no;
 * - al apuntarse o quedarse (`voz-encargo-voy`, `voz-encargo-me-quedo`).
 */
export const GRUNTS = Object.freeze({
    hit: 'Mm.',
    crit: '¡Mm!',
    kill: 'Hmf.',
    ally_down: '¡Mm!',
    hurt: 'Hmf.',
    victory: 'Mm.',
    like: 'Mm.',
    dislike: 'Hmf.',
    voy: '¡Mm!',
    quedo: 'Mm…',
});

/**
 * Hasta qué rango calla alguien, por su ficha (`callaHasta`). 0 si habla.
 *
 * @param {any} row Su ficha de `companeros.json` o su confidente del paquete.
 * @returns {number}
 */
export function silentUntil(row) {
    const until = Math.floor(Number(row?.callaHasta) || 0);
    return until > 0 ? until : 0;
}

/**
 * Si alguien aún no habla.
 *
 * @param {any} row Su ficha.
 * @param {number} rank Su rango contigo.
 * @returns {boolean}
 */
export function isSilent(row, rank) {
    const until = silentUntil(row);
    return until > 0 && (Number(rank) || 0) < until;
}

/**
 * La ficha de alguien entre varias listas (las de `companeros.json` y los confidentes del
 * paquete), por su nombre: la primera que diga hasta cuándo calla.
 *
 * @param {string} name
 * @param {...any[]} lists
 * @returns {any|null}
 */
export function silentRow(name, ...lists) {
    const wanted = fold(name);
    if (!wanted) return null;
    for (const list of lists) {
        for (const row of Array.isArray(list) ? list : []) {
            const own = fold(row?.who) || fold(row?.name);
            if (own === wanted && silentUntil(row) > 0) return row;
        }
    }
    return null;
}

/**
 * El gruñido de quien calla, por lo que pasa (una de `GRUNTS`); «Mm.» si no hay uno propio.
 *
 * @param {string} kind
 * @returns {string}
 */
export function gruntFor(kind) {
    return GRUNTS[/** @type {keyof typeof GRUNTS} */ (text(kind))] ?? 'Mm.';
}
