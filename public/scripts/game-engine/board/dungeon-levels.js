/**
 * Mazmorras de varios tableros, con escaleras y estado que persiste (idea 75).
 *
 * Un sitio ya podía tener varios tableros, pero eran salas sueltas: se entraba en cada una
 * desde el mapa. Ahora un tablero puede tener **escaleras** (`>` en el mapa) que llevan al
 * siguiente nivel (`next`), y bajar es andar hasta ellas. Cada nivel guarda lo suyo —puertas
 * abiertas, salas vistas, lo que arde— porque cada uno es su propio tablero.
 *
 * Los encargos grandes se generan con dos niveles.
 *
 * Puro: dice dónde están las escaleras, si alguien está en ellas y adónde llevan.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Las escaleras de un tablero.
 *
 * @param {any} terrain
 * @returns {Array<{x: number, y: number}>}
 */
export function stairsOf(terrain) {
    return Object.entries(terrain?.cells ?? {})
        .filter(([, cell]) => cell?.type === 'stairs')
        .map(([key]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
}

/**
 * Si alguien del grupo está en una escalera o pegado a ella.
 *
 * @param {any} terrain
 * @param {Array<{x: number, y: number}>} party
 * @returns {{x: number, y: number}|null}
 */
export function stairsReached(terrain, party) {
    const stairs = stairsOf(terrain);
    for (const member of Array.isArray(party) ? party : []) {
        const found = stairs.find(s => Math.max(Math.abs(s.x - member.x), Math.abs(s.y - member.y)) <= 1);
        if (found) return found;
    }
    return null;
}

/**
 * Adónde lleva la escalera de un tablero: el que dice `next`, si existe en el sitio.
 *
 * @param {any} board
 * @param {any[]} boards Los del sitio.
 * @returns {any|null}
 */
export function nextLevel(board, boards) {
    const wanted = text(board?.next);
    if (!wanted) return null;
    return (Array.isArray(boards) ? boards : []).find(b => text(b?.name) === wanted) ?? null;
}

/**
 * Poner una escalera en el sitio más lejano de donde se empieza, en suelo libre.
 *
 * @param {string[]} rows El mapa, en filas.
 * @param {{x: number, y: number}} from Donde empieza el grupo.
 * @returns {string[]}
 */
export function withStairs(rows, from) {
    const map = (Array.isArray(rows) ? rows : []).map(r => String(r));
    let best = null;
    let far = -1;
    map.forEach((row, y) => [...row].forEach((char, x) => {
        if (char !== '.') return;
        const d = Math.abs(x - (Number(from?.x) || 0)) + Math.abs(y - (Number(from?.y) || 0));
        if (d > far) {
            far = d;
            best = { x, y };
        }
    }));
    if (!best) return map;
    const { x, y } = /** @type {{x: number, y: number}} */ (best);
    return map.map((row, i) => (i === y ? `${row.slice(0, x)}>${row.slice(x + 1)}` : row));
}

/**
 * El nombre del nivel siguiente.
 *
 * @param {string} name
 * @returns {string}
 */
export function levelName(name) {
    return `${text(name)} (nivel 2)`;
}
