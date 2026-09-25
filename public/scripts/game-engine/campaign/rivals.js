/**
 * Aventureros rivales: otra compañía que compite por los mismos encargos (idea 94).
 *
 * El tablón esperaba a que lo cogieras. Ahora hay otros: una compañía con nombre, sacado de
 * la semilla del mundo, que cada semana se lleva uno de los encargos del tablón (el mejor
 * pagado de los que no has cogido) y se sabe. Si les ganas por la mano —cumples antes uno
 * que también querían—, se sabe también, y os tienen ganas.
 *
 * Puro: quiénes son, qué se llevan y cómo se cuenta.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

const FIRST = ['Los Cuervos', 'Los Lobos', 'Las Hachas', 'Los Hijos', 'La Compañía', 'Los Perros', 'Las Espadas', 'Los Halcones'];
const SECOND = ['Grises', 'de Ceniza', 'del Alba', 'Rojos', 'de Hierro', 'del Vado', 'Negros', 'de la Sal'];

/**
 * La compañía rival de un mundo: siempre la misma con la misma semilla.
 *
 * @param {() => number} random
 * @returns {{name: string, leader: string}}
 */
export function rivalOf(random) {
    const name = `${FIRST[Math.floor(random() * FIRST.length) % FIRST.length]} ${SECOND[Math.floor(random() * SECOND.length) % SECOND.length]}`;
    const leaders = ['Mara la Tuerta', 'Edric Doscaras', 'Ilse Mediamano', 'Bertrand el Largo', 'Sabela Sinfuego'];
    return { name, leader: leaders[Math.floor(random() * leaders.length) % leaders.length] };
}

/**
 * Lo que se llevan esta semana: el mejor pagado de los del tablón, salvo los escritos por el
 * mundo, los personales y los que te nombran (esos son tuyos).
 *
 * @param {any[]} board
 * @returns {{taken: any|null, board: any[]}}
 */
export function rivalsTake(board) {
    const list = Array.isArray(board) ? board : [];
    const theirs = list
        .filter(c => c && !c.written && !c.personal && !c.named && !c.favor)
        .sort((a, b) => (Number(b.reward) || 0) - (Number(a.reward) || 0))[0] ?? null;
    return { taken: theirs, board: theirs ? list.filter(c => c !== theirs) : list };
}

/**
 * Cómo se cuenta.
 *
 * @param {{name: string, leader: string}} rival
 * @param {any} contract
 * @returns {string}
 */
export function describeRivalTake(rival, contract) {
    return `${text(rival.name)} (los de ${text(rival.leader)}) se os adelantan: se llevan «${text(contract?.title)}» del tablón.`;
}
