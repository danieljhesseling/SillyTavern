/**
 * Tanda 17 (Daniel, 2026-10-02): los nombres debajo de las fichas se cortaban («Ratero del…») y
 * se montaban sobre la ficha de al lado. Debajo de cada ficha va ahora un nombre corto, lo que
 * se dice en la mesa: «Ratero», «Ratero 2», «Keller», «Laedor». El nombre entero sale al pasar el
 * ratón por encima (o al tocarla), en su tarjeta, como siempre.
 *
 * Puro.
 */

/**
 * Lo que va delante de un nombre propio y no es el nombre: «Capitana Keller» es Keller.
 * Sin acentos y en minúscula, como sale de `fold`.
 */
const TITLES = new Set([
    'capitan', 'capitana', 'alguacil', 'sargento', 'teniente', 'cabo', 'senor', 'senora', 'don', 'dona', 'lady', 'lord', 'sir',
    'maese', 'hermano', 'hermana', 'padre', 'madre', 'fray', 'sor', 'baron', 'baronesa', 'conde', 'condesa', 'duque', 'duquesa',
    'rey', 'reina', 'principe', 'princesa', 'tio', 'tia', 'abuelo', 'abuela', 'mama', 'papa', 'doctor', 'doctora', 'profesor',
    'profesora', 'jefe', 'jefa', 'patron', 'patrona', 'santo', 'santa', 'san',
]);

/**
 * @param {string} word
 * @returns {string}
 */
const fold = (word) => String(word ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * El nombre corto de una ficha.
 *
 * - Lo que es («Ratero del muelle», «Lobo famélico»): la primera palabra, «Ratero».
 * - Con número («Ratero del muelle 2»): con él, «Ratero 2».
 * - Un título y un nombre propio («Capitana Keller», «Alguacil Torres»): el nombre, «Keller».
 * - Lo que va entre paréntesis al final («Mirela (herida)») no cuenta.
 *
 * Si dos fichas con nombres distintos se quedarían con el mismo nombre corto («Lobo gris» y
 * «Lobo famélico»), cada una lleva su nombre entero: que no se confundan es más que lo que ocupe.
 *
 * @param {string} name
 * @param {string[]} [others] Los nombres de las demás fichas del tablero.
 * @returns {string}
 */
export function tokenLabel(name, others = []) {
    const short = shortName(name);
    const full = String(name ?? '').trim();
    if (!short || short === full) return short || full;
    const clash = (Array.isArray(others) ? others : [])
        .some(other => String(other ?? '').trim() !== full && shortName(other) === short);
    return clash ? full : short;
}

/**
 * @param {string} name
 * @returns {string}
 */
function shortName(name) {
    const said = String(name ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!said) return '';
    const words = said.split(/\s+/);
    const number = words.length > 1 && /^\d+$/.test(words[words.length - 1]) ? words.pop() : '';
    let word = words[0];
    // Un título delante de un nombre propio: el nombre.
    if (words.length > 1 && TITLES.has(fold(words[0])) && /^\p{Lu}/u.test(words[1])) word = words[1];
    return number ? `${word} ${number}` : word;
}
