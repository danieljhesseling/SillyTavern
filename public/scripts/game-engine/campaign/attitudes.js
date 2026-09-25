/**
 * Cambios de actitud de un PNJ, propuestos por el narrador y con límites (idea 140).
 *
 * El diálogo no movía nada: se podía convencer a Giles en el chat y al día siguiente seguía
 * igual. Ahora el narrador puede proponer (`cambiar_actitud`) que alguien mire mejor o peor
 * al grupo, y el motor lo apunta con límites: un paso cada vez, uno por persona y día, y
 * entre −3 (hostil) y +3 (de los vuestros). La actitud se nota en las tiradas de trato con
 * esa persona: suma o resta lo que valga.
 *
 * Puro: apunta, limita y dice cuánto suma.
 */

/** Los límites. */
export const ATTITUDE = { min: -3, max: 3 };

/** Cómo se dice cada punto. */
const WORDS = { '-3': 'hostil', '-2': 'recelosa', '-1': 'fría', 0: 'neutral', 1: 'cordial', 2: 'amistosa', 3: 'de los vuestros' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {{values: Record<string, number>, changed: Record<string, number>}}
 */
export function readAttitudes(raw) {
    /** @type {Record<string, number>} */
    const values = {};
    for (const [name, v] of Object.entries(raw?.values ?? {})) {
        const n = Math.max(ATTITUDE.min, Math.min(ATTITUDE.max, Math.round(Number(v) || 0)));
        if (text(name) && n !== 0) values[text(name)] = n;
    }
    /** @type {Record<string, number>} */
    const changed = {};
    for (const [name, day] of Object.entries(raw?.changed ?? {})) if (text(name)) changed[text(name)] = Math.floor(Number(day) || 0);
    return { values, changed };
}

/**
 * Proponer un cambio: un paso, uno por persona y día, dentro de los límites.
 *
 * @param {any} raw
 * @param {{name: string, delta: number, day: number}} input
 * @returns {{ok: boolean, reason: string, state: {values: Record<string, number>, changed: Record<string, number>}, value: number}}
 */
export function shiftAttitude(raw, { name, delta, day }) {
    const state = readAttitudes(raw);
    const who = text(name);
    const now = state.values[who] ?? 0;
    if (!who) return { ok: false, reason: 'Falta quién.', state, value: now };
    const step = Math.sign(Number(delta) || 0);
    if (step === 0) return { ok: false, reason: 'Un cambio es +1 o −1.', state, value: now };
    if (state.changed[who] === Math.floor(Number(day) || 0)) return { ok: false, reason: `La actitud de ${who} ya cambió hoy.`, state, value: now };
    const value = Math.max(ATTITUDE.min, Math.min(ATTITUDE.max, now + step));
    if (value === now) return { ok: false, reason: `${who} ya está en el límite.`, state, value: now };
    return {
        ok: true, reason: '', value,
        state: { values: { ...state.values, [who]: value }, changed: { ...state.changed, [who]: Math.floor(Number(day) || 0) } },
    };
}

/**
 * Lo que suma la actitud de alguien a las tiradas de trato con él.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {number}
 */
export function attitudeBonus(raw, name) {
    return readAttitudes(raw).values[text(name)] ?? 0;
}

/**
 * @param {number} value
 * @returns {string}
 */
export function describeAttitude(value) {
    return WORDS[/** @type {keyof typeof WORDS} */ (String(Math.max(ATTITUDE.min, Math.min(ATTITUDE.max, Math.round(Number(value) || 0)))))] ?? 'neutral';
}
