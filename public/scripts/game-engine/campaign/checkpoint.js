/**
 * El punto de retorno: lo que hace que probar algo difícil no dé miedo.
 *
 * Una campaña larga tiene dos o tres momentos en los que la partida se puede torcer para
 * siempre — el jefe que te barre en dos rondas, la decisión que cierra una rama entera —
 * y hasta ahora la única red era no jugarlos. Guardar antes de eso no es hacer trampa: es
 * lo que hace cualquier juego con un archivo de guardado, y lo que convierte un combate
 * duro en algo que se intenta en vez de algo que se evita.
 *
 * Esto **no guarda la conversación**, y merece decirse: el chat es de SillyTavern y tiene
 * su propio historial. Lo que se guarda aquí es el estado del juego — quién está vivo,
 * dónde, con qué, qué día es y a quién conoce. Volver a un punto deja el chat como está y
 * el mundo como estaba.
 *
 * Puro: recoge y devuelve. Quien lo escriba en el disco, que lo escriba.
 *
 * Ver wiki/PROPUESTAS_MEJORA_V2.md, PROP2-163.
 */

/** Versión del formato, para que un punto viejo se reconozca en vez de romper. */
export const CHECKPOINT_VERSION = 1;

/** Dónde viven, dentro de los metadatos del chat. */
export const CHECKPOINT_KEY = 'checkpoints';

/** Más de esto y son un cajón de sastre: se cae el más viejo. */
export const MAX_CHECKPOINTS = 5;

/**
 * @typedef {Object} Checkpoint
 * @property {number} version
 * @property {string} id
 * @property {string} label Por qué se guardó: "Antes de El Guardián".
 * @property {string} savedAt ISO, para ordenarlos y enseñarlos.
 * @property {boolean} automatic Si lo puso el juego o una persona.
 * @property {any} state Lo que hay que devolver a su sitio.
 */

/**
 * @param {any} value
 * @returns {any}
 */
function clone(value) {
    // `structuredClone` está en todos los navegadores que corren esto, y a diferencia de
    // JSON.parse(JSON.stringify(...)) no convierte un `undefined` en un agujero.
    return value === undefined ? undefined : structuredClone(value);
}

/**
 * Toma la foto.
 *
 * @param {Object} input
 * @param {string} input.label
 * @param {any} input.state Lo que el juego da por cierto: grupo, combate, calendario, mapa…
 * @param {boolean} [input.automatic]
 * @param {() => string} [input.now]
 * @returns {Checkpoint}
 */
export function createCheckpoint({ label, state, automatic = false, now = () => new Date().toISOString() }) {
    return {
        version: CHECKPOINT_VERSION,
        id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        label: String(label ?? '').trim() || 'Sin nombre',
        savedAt: now(),
        automatic: Boolean(automatic),
        state: clone(state) ?? {},
    };
}

/**
 * Lee la lista guardada, tirando lo que no se sostiene.
 *
 * @param {any} raw
 * @returns {Checkpoint[]}
 */
export function normalizeCheckpoints(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(cp => cp && typeof cp === 'object' && cp.state && typeof cp.state === 'object')
        .map(cp => ({
            version: Math.max(1, Math.floor(Number(cp.version) || CHECKPOINT_VERSION)),
            id: String(cp.id ?? ''),
            label: String(cp.label ?? '').trim() || 'Sin nombre',
            savedAt: String(cp.savedAt ?? ''),
            automatic: Boolean(cp.automatic),
            state: cp.state,
        }))
        .filter(cp => cp.id);
}

/**
 * Añade uno y deja la lista en su tamaño.
 *
 * El automático no desplaza a los que pusiste tú: si el juego guarda solo antes de cada
 * jefe, en tres peleas se habría llevado por delante el punto que guardaste a mano.
 *
 * @param {any} list
 * @param {Checkpoint} checkpoint
 * @returns {Checkpoint[]}
 */
export function addCheckpoint(list, checkpoint) {
    const all = [checkpoint, ...normalizeCheckpoints(list)];
    if (all.length <= MAX_CHECKPOINTS) return all;

    // Se cae el automático más viejo; si no hay ninguno, el más viejo a secas.
    const oldestAuto = [...all].reverse().find(cp => cp.automatic && cp.id !== checkpoint.id);
    const victim = oldestAuto ?? all[all.length - 1];
    return all.filter(cp => cp !== victim);
}

/**
 * Busca uno por id.
 *
 * @param {any} list
 * @param {string} id
 * @returns {Checkpoint|null}
 */
export function findCheckpoint(list, id) {
    return normalizeCheckpoints(list).find(cp => cp.id === String(id)) ?? null;
}

/**
 * Quita uno.
 *
 * @param {any} list
 * @param {string} id
 * @returns {Checkpoint[]}
 */
export function removeCheckpoint(list, id) {
    return normalizeCheckpoints(list).filter(cp => cp.id !== String(id));
}

/**
 * Cómo se lee en una lista.
 *
 * @param {Checkpoint} checkpoint
 * @returns {string}
 */
export function describeCheckpoint(checkpoint) {
    const when = checkpoint.savedAt ? checkpoint.savedAt.slice(0, 16).replace('T', ' ') : 'sin fecha';
    return `${checkpoint.label} · ${when}${checkpoint.automatic ? ' · automático' : ''}`;
}
