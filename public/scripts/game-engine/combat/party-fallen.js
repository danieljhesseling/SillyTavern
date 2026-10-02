/**
 * J9.1 (wiki/ROADMAP_SIN_CONEXION.md): cuando cae todo el grupo.
 *
 * En una campaña donde «muere cualquiera» (1387) el héroe puede morir de verdad: en una pelea,
 * de hambre por el camino o de frío. Hasta ahora la partida seguía como si nada, con los muertos
 * andando de un sitio a otro, y la pelea siguiente empezaba sin nadie del grupo en la iniciativa:
 * los enemigos jugaban sus turnos para siempre y no había nada que pulsar.
 *
 * Esto decide qué se dice y qué salidas hay; lo pinta y lo hace quien llama.
 *
 * Puro: no toca la partida.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * «Tessa», «Tessa y Gerd», «Tessa, Gerd y Nella».
 *
 * @param {string[]} names
 * @returns {string}
 */
function listNames(names) {
    const list = names.map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * Si ya no queda nadie del grupo con vida. Un grupo vacío no ha caído: es que aún no hay grupo.
 *
 * @param {any[]} party
 * @returns {boolean}
 */
export function partyHasFallen(party) {
    const list = (Array.isArray(party) ? party : []).filter(m => m && typeof m === 'object');
    return list.length > 0 && list.every(m => Boolean(m.dead));
}

/** Cada cuánto se mira otra vez si ya hay grupo, en ms. */
export const PARTY_WAIT_MS = 900;
/** El respiro tras entrar el primero, en ms: lo que tarda en ponerse en cola la escena que empieza la partida. */
export const PARTY_SETTLE_MS = 2000;

/**
 * Si la pelea que empieza sola (party/fight-entry.js) tiene que esperar a que haya grupo.
 *
 * Una partida nueva abre su tablero antes de crear al héroe: con el grupo vacío, la decisión de
 * pelear salía con todas las salidas cerradas y antes que la escena del hilo. Sin nadie, se
 * espera; al entrar el primero, un respiro más (la escena que empieza la partida se pone en
 * cola justo después de crear al héroe, y la pelea espera a las escenas).
 *
 * @param {number} partySize Cuántos hay en el grupo.
 * @param {boolean} waited Si ya se estaba esperando a que hubiera alguien.
 * @returns {{delay: number, waited: boolean}} `delay` 0: se puede abrir ya.
 */
export function fightWait(partySize, waited) {
    if (!(Number(partySize) > 0)) return { delay: PARTY_WAIT_MS, waited: true };
    if (waited) return { delay: PARTY_SETTLE_MS, waited: false };
    return { delay: 0, waited: false };
}

/**
 * El punto guardado al que tiene sentido volver: el más nuevo en el que alguien seguía vivo.
 * Los puntos vienen del más nuevo al más viejo, como los guarda `addCheckpoint`.
 *
 * @param {any[]} checkpoints
 * @returns {any|null}
 */
export function checkpointToReturn(checkpoints) {
    for (const checkpoint of Array.isArray(checkpoints) ? checkpoints : []) {
        const party = checkpoint?.state?.party;
        if (Array.isArray(party) && party.some(m => m && !m.dead)) return checkpoint;
    }
    return null;
}

/**
 * Lo que dice la tarjeta y qué botones lleva.
 *
 * @param {object} input
 * @param {any[]} input.party El grupo, ya con sus muertos.
 * @param {string} [input.place] Dónde ha caído.
 * @param {any[]} [input.checkpoints] Los puntos guardados de la partida, del más nuevo al más viejo.
 * @param {boolean} [input.home] Si la campaña sale de un gremio (se puede volver a él).
 * @param {boolean} [input.saves] Si se puede cargar una partida guardada (la de cada mañana, H7 de
 *   las vueltas): quien ha visto «Nuevo día. Partida guardada» espera poder volver a ella.
 * @returns {{title: string, text: string, ways: string, checkpoint: any|null, home: boolean, saves: boolean}}
 */
export function fallenCard({ party, place = '', checkpoints = [], home = false, saves = false }) {
    const names = (Array.isArray(party) ? party : []).filter(m => m && m.dead).map(m => text(m.name)).filter(Boolean);
    const where = text(place);
    const alone = names.length <= 1;
    const title = alone ? `${names[0] || 'Tu personaje'} ha muerto` : 'Ha caído todo el grupo';
    const said = `${listNames(names) || 'Tu personaje'} ${alone ? 'ha muerto' : 'han muerto'}${where ? ` en ${where}` : ''}. Sin nadie en pie, la campaña no puede seguir.`;
    const checkpoint = checkpointToReturn(checkpoints);
    const ways = [
        checkpoint ? `Puedes volver al último punto guardado («${text(checkpoint.label) || 'sin nombre'}»).` : '',
        saves ? 'Puedes cargar una partida guardada: cada mañana se guarda sola.' : '',
        home ? `Puedes volver al gremio: allí se recuerda a ${alone ? 'quien cayó' : 'los que cayeron'}, y se sigue con otro personaje. La campaña se queda donde está.` : '',
        !checkpoint && !home && !saves ? 'Desde la pausa puedes cargar otra partida.' : '',
    ].filter(Boolean).join(' ');
    return { title, text: said, ways, checkpoint, home: Boolean(home), saves: Boolean(saves) };
}
