/**
 * El narrador pide una tirada; la tira quien juega (idea 138).
 *
 * Es la misma idea que `proponer_sitio`: el modelo no decide numeros. Cuando la escena pide
 * una prueba («el guardia no se lo cree del todo»), el narrador llama a la herramienta
 * `pedir_tirada` con la habilidad y el motivo, y aparece una ficha: *Tirar Persuasion (lo
 * pide el narrador: convencer al guardia)*. El dado lo tira el motor, al pulsar.
 *
 * Puro: guarda, valida y entrega las peticiones.
 */

/** La dificultad si el narrador no dice otra, y los limites de lo que puede pedir. */
export const REQUEST_DC = { default: 12, min: 5, max: 25 };

/** Mas de dos a la vez y deja de ser una escena para ser un examen. */
export const MAX_REQUESTS = 2;

/**
 * @typedef {Object} CheckRequest
 * @property {string} skill
 * @property {string} reason
 * @property {number} dc
 */

/**
 * @param {any} raw
 * @param {Record<string, any>} skills El catalogo de habilidades.
 * @returns {CheckRequest[]}
 */
export function readRequests(raw, skills) {
    return (Array.isArray(raw) ? raw : [])
        .filter(r => r && Object.prototype.hasOwnProperty.call(skills, String(r.skill)))
        .map(r => ({
            skill: String(r.skill),
            reason: String(r.reason ?? '').trim().slice(0, 120),
            dc: clampDc(r.dc),
        }));
}

/** @param {any} dc @returns {number} */
function clampDc(dc) {
    const n = Math.round(Number(dc));
    if (!Number.isFinite(n) || n <= 0) return REQUEST_DC.default;
    return Math.max(REQUEST_DC.min, Math.min(REQUEST_DC.max, n));
}

/**
 * La habilidad que pide el narrador, por su id o por su nombre en español.
 *
 * @param {string} said
 * @param {Record<string, {label: string}>} skills
 * @returns {string} El id, o vacio si no existe.
 */
export function resolveSkill(said, skills) {
    const wanted = String(said ?? '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!wanted) return '';
    for (const [id, def] of Object.entries(skills)) {
        const label = String(def.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (id === wanted || label === wanted) return id;
    }
    return '';
}

/**
 * Apuntar una peticion.
 *
 * @param {any} raw
 * @param {{skill: string, reason?: string, dc?: number}} request
 * @param {Record<string, {label: string}>} skills
 * @returns {{added: boolean, reason: string, requests: CheckRequest[]}}
 */
export function addRequest(raw, request, skills) {
    const list = readRequests(raw, skills);
    const skill = resolveSkill(request?.skill ?? '', skills);
    if (!skill) {
        return { added: false, reason: `Esa habilidad no existe. Hay: ${Object.values(skills).map(s => s.label).join(', ')}.`, requests: list };
    }
    if (list.some(r => r.skill === skill)) return { added: false, reason: 'Ya está pedida.', requests: list };
    if (list.length >= MAX_REQUESTS) return { added: false, reason: 'Ya hay dos tiradas esperando.', requests: list };
    list.push({ skill, reason: String(request.reason ?? '').trim().slice(0, 120), dc: clampDc(request.dc) });
    return { added: true, reason: '', requests: list };
}

/**
 * Sacar la peticion de una habilidad, al tirarla.
 *
 * @param {any} raw
 * @param {string} skill
 * @param {Record<string, any>} skills
 * @returns {{request: CheckRequest|null, requests: CheckRequest[]}}
 */
export function takeRequest(raw, skill, skills) {
    const list = readRequests(raw, skills);
    const request = list.find(r => r.skill === skill) ?? null;
    return { request, requests: list.filter(r => r !== request) };
}
