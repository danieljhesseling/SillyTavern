/**
 * Secretos que se destapan (idea 110).
 *
 * El guion escribe un secreto para cada PNJ, y el importador lo guarda en su ficha **sin
 * dárselo al narrador**, que lo contaría a la primera. Hasta ahora no servía de nada: nadie
 * podía llegar a él. Aquí se llega sonsacando (Perspicacia contra su guardia), una vez al
 * día por persona. Si sale, el secreto pasa a la ficha que lee el narrador —con la nota de
 * que el grupo ya lo sabe—, así que desde entonces esa persona habla distinto; y queda en
 * el diario.
 *
 * Puro: dice si se puede intentar, lo que se sabe y cómo se cuenta. Quien llama tira,
 * guarda y reescribe la ficha.
 */

/** Lo que cuesta sonsacar un secreto. */
export const SECRET_DC = 14;

/** Con qué se sonsaca. */
export const SECRET_SKILL = 'insight';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que ya se sabe, leído con tolerancia: `{[nombre]: {day, secret}}`, y los intentos de
 * hoy.
 *
 * @param {any} raw
 * @returns {{known: Record<string, {day: number, secret: string}>, tried: Record<string, number>}}
 */
export function readSecrets(raw) {
    /** @type {Record<string, {day: number, secret: string}>} */
    const known = {};
    for (const [name, value] of Object.entries(raw?.known && typeof raw.known === 'object' ? raw.known : {})) {
        if (text(name) && text(/** @type {any} */ (value)?.secret)) {
            known[text(name)] = { day: Math.max(1, Math.floor(Number(/** @type {any} */ (value).day) || 1)), secret: text(/** @type {any} */ (value).secret) };
        }
    }
    /** @type {Record<string, number>} */
    const tried = {};
    for (const [name, day] of Object.entries(raw?.tried && typeof raw.tried === 'object' ? raw.tried : {})) {
        if (text(name)) tried[text(name)] = Math.floor(Number(day) || 0);
    }
    return { known, tried };
}

/**
 * Si se puede intentar sonsacar a alguien ahora, y si no, por qué.
 *
 * @param {Object} input
 * @param {{name: string, secret?: string, where?: string}} input.npc
 * @param {string} input.here
 * @param {any} input.secrets
 * @param {number} input.today
 * @returns {{ok: boolean, reason: string}}
 */
export function canPry({ npc, here, secrets, today }) {
    const name = text(npc?.name);
    if (!name || !text(npc?.secret)) return { ok: false, reason: 'No esconde nada que se sepa.' };
    const state = readSecrets(secrets);
    if (state.known[name]) return { ok: false, reason: 'Eso ya lo sabéis.' };
    if (text(npc?.where) && text(npc.where).toLowerCase() !== text(here).toLowerCase()) {
        return { ok: false, reason: `${name} no está aquí.` };
    }
    if (state.tried[name] === Math.floor(Number(today) || 0)) return { ok: false, reason: `Hoy ${name} ya está en guardia.` };
    return { ok: true, reason: '' };
}

/**
 * Apuntar el intento: si salió, lo que se sabe; si no, que hoy ya no.
 *
 * @param {any} secrets
 * @param {{name: string, secret: string}} npc
 * @param {boolean} success
 * @param {number} today
 * @returns {{known: Record<string, {day: number, secret: string}>, tried: Record<string, number>}}
 */
export function notePry(secrets, npc, success, today) {
    const state = readSecrets(secrets);
    const name = text(npc?.name);
    const day = Math.floor(Number(today) || 0);
    return {
        known: success ? { ...state.known, [name]: { day, secret: text(npc?.secret) } } : state.known,
        tried: { ...state.tried, [name]: day },
    };
}

/**
 * La línea que se añade a su ficha para el narrador: el secreto, y que el grupo lo sabe.
 *
 * @param {string} secret
 * @returns {string}
 */
export function secretNote(secret) {
    return `Su secreto, que el grupo ya conoce: ${text(secret)} Lo sabe, y se le nota al hablar con ellos.`;
}

/**
 * Para el diario: lo que se sabe de cada uno.
 *
 * @param {any} secrets
 * @returns {string[]}
 */
export function describeSecrets(secrets) {
    return Object.entries(readSecrets(secrets).known)
        .sort((a, b) => a[1].day - b[1].day || a[0].localeCompare(b[0]))
        .map(([name, value]) => `${name}: ${value.secret}`);
}
