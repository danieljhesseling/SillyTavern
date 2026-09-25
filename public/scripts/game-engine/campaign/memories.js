/**
 * Lo que el grupo recuerda haber vivido junto.
 *
 * Las hazañas (`deeds`) son lo que hizo el grupo, para el mundo. Esto es otra cosa: lo que
 * pasó *entre* ellos. «Bruna se interpuso para salvar a Sela en el Peaje.» Es lo que hace
 * que un grupo parezca tener historia: el narrador lo recibe y los compañeros lo citan.
 *
 * El motor decide que ocurrio; el modelo solo lo cuenta. Por eso cada recuerdo nace de un
 * hecho del juego (un rescate, alguien que cayo y se levanto, un encargo cumplido), nunca
 * del chat.
 *
 * Puro: la lista nueva, sin tocar la vieja.
 */

/** Los que se guardan. Mas atras ya no se cita a nadie. */
export const MAX_MEMORIES = 24;

/** Los que lee el narrador en cada turno. */
export const MEMORIES_TOLD = 3;

/**
 * @typedef {Object} Memory
 * @property {number} day
 * @property {string} text
 * @property {string[]} who Quienes estaban, por nombre.
 */

/**
 * @param {any} raw
 * @returns {Memory[]}
 */
export function readMemories(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(m => m && String(m.text ?? '').trim())
        .map(m => ({
            day: Math.max(1, Math.floor(Number(m.day) || 1)),
            text: String(m.text).trim(),
            who: Array.isArray(m.who) ? m.who.map(String) : [],
        }));
}

/**
 * Apuntar un recuerdo. El mismo texto dos veces no se repite.
 *
 * @param {any} raw
 * @param {Memory} memory
 * @returns {Memory[]}
 */
export function addMemory(raw, memory) {
    const list = readMemories(raw);
    const text = String(memory?.text ?? '').trim();
    if (!text || list.some(m => m.text === text)) return list;
    list.push({ day: Math.max(1, Math.floor(Number(memory.day) || 1)), text, who: (memory.who ?? []).map(String) });
    return list.slice(-MAX_MEMORIES);
}

/**
 * Los recuerdos en los que estaba alguien.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {Memory[]}
 */
export function memoriesOf(raw, name) {
    const who = String(name).toLowerCase();
    return readMemories(raw).filter(m => m.who.some(n => n.toLowerCase() === who));
}

/**
 * Las lineas para el bloque del narrador: las ultimas, con cuando.
 *
 * @param {any} raw
 * @param {number} today
 * @returns {string[]}
 */
export function memoryLines(raw, today) {
    return readMemories(raw).slice(-MEMORIES_TOLD).map(m => {
        const ago = Math.max(0, Math.floor(Number(today) || 1) - m.day);
        return `${ago === 0 ? 'Hoy' : `Hace ${ago} día(s)`}: ${m.text}`;
    });
}

/**
 * Un recuerdo con alguien, para citarlo al invitarle a una ronda o en su ficha.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {string}
 */
export function lastMemoryWith(raw, name) {
    const mine = memoriesOf(raw, name);
    return mine.length > 0 ? mine[mine.length - 1].text : '';
}
