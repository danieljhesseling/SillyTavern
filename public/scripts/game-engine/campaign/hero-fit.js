/**
 * El mundo se adapta al héroe: hitos opcionales según el trasfondo (idea 184).
 *
 * Un guion puede traer hitos que solo existen para ciertos héroes (`trasfondo: [soldado]`):
 * un viejo sargento que reconoce al soldado, un archivo que solo el erudito sabe leer. Al
 * empezar la partida, con el héroe ya hecho, los que no encajan con su trasfondo se cierran
 * sin decir nada, y los que encajan se quedan. Así el mismo mundo se juega distinto según
 * quién entre.
 *
 * Los hitos sin trasfondo son de todos.
 *
 * Puro: dice qué hitos no son para este héroe.
 */

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Los trasfondos para los que es un hito (vacío: para todos).
 *
 * @param {any} milestone
 * @returns {string[]}
 */
export function backgroundsOf(milestone) {
    const raw = milestone?.backgrounds ?? milestone?.background;
    return (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map(plain).filter(Boolean);
}

/**
 * Los hitos que no son para este héroe: se cierran al empezar.
 *
 * @param {any} plot
 * @param {any} hero
 * @returns {string[]} Sus ids.
 */
export function notForHero(plot, hero) {
    const mine = plain(hero?.background);
    return (Array.isArray(plot?.milestones) ? plot.milestones : [])
        .filter((/** @type {any} */ m) => {
            const wanted = backgroundsOf(m);
            return wanted.length > 0 && !wanted.includes(mine);
        })
        .map((/** @type {any} */ m) => String(m.id));
}

/**
 * Los que sí son para él, y lo dicen: para que el narrador sepa por qué están.
 *
 * @param {any} plot
 * @param {any} hero
 * @returns {string[]} Sus títulos.
 */
export function forHero(plot, hero) {
    const mine = plain(hero?.background);
    if (!mine) return [];
    return (Array.isArray(plot?.milestones) ? plot.milestones : [])
        .filter((/** @type {any} */ m) => backgroundsOf(m).includes(mine))
        .map((/** @type {any} */ m) => String(m.title ?? m.id));
}
