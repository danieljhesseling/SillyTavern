/**
 * Monturas: menos días de viaje, a cambio de oro y de pienso (idea 129).
 *
 * Una meta de oro que se nota en el mapa. Se compran en el establo de la posada; y solo
 * acortan el viaje si **todos** van montados, que un grupo va al paso del que va a pie. Una
 * mula ahorra un día de cada cuatro; un caballo, uno de cada dos. Y comen: la cuenta de la
 * semana sube lo que cuesta su pienso.
 *
 * Puro: dice cuánto se tarda y cuánto cuesta. Quien llama cobra y guarda.
 */

/** Las monturas que hay: precio, pienso por semana y cuánto acortan. */
export const MOUNTS = {
    mula: { label: 'Mula', price: 40, feedPerWeek: 2, factor: 0.75 },
    caballo: { label: 'Caballo', price: 120, feedPerWeek: 4, factor: 0.5 },
};

/**
 * Las monturas del grupo, leídas con tolerancia.
 *
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function readMounts(raw) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const id of Object.keys(MOUNTS)) {
        const n = Math.max(0, Math.floor(Number(raw?.[id]) || 0));
        if (n > 0) out[id] = n;
    }
    return out;
}

/**
 * Comprar una.
 *
 * @param {any} raw
 * @param {string} id
 * @returns {Record<string, number>}
 */
export function addMount(raw, id) {
    const mounts = readMounts(raw);
    if (!(id in MOUNTS)) return mounts;
    return { ...mounts, [id]: (mounts[id] ?? 0) + 1 };
}

/**
 * Cuánto dura un viaje con las monturas que hay: si no alcanzan para todos, lo mismo que a
 * pie; si alcanzan, al paso de la más lenta de las que se usan (las mejores primero).
 *
 * @param {Object} input
 * @param {number} input.days Lo que se tarda a pie.
 * @param {any} input.mounts
 * @param {number} input.riders Quien viaja.
 * @returns {{days: number, saved: number, note: string}}
 */
export function mountedDays({ days, mounts, riders }) {
    const walking = Math.max(1, Math.floor(Number(days) || 1));
    const owned = readMounts(mounts);
    const needed = Math.max(1, Math.floor(Number(riders) || 1));
    // Las mejores primero: si sobran, la mula se queda en el establo.
    const order = Object.keys(MOUNTS).sort((a, b) => MOUNTS[a].factor - MOUNTS[b].factor);
    let seats = 0;
    let slowest = 0;
    for (const id of order) {
        const count = owned[id] ?? 0;
        if (count <= 0 || seats >= needed) continue;
        seats += count;
        slowest = Math.max(slowest, MOUNTS[/** @type {keyof typeof MOUNTS} */ (id)].factor);
    }
    if (seats < needed || slowest === 0) {
        const short = seats > 0 ? ` (hay monturas para ${seats} de ${needed}: se va al paso del que anda)` : '';
        return { days: walking, saved: 0, note: short };
    }
    const mounted = Math.max(1, Math.round(walking * slowest));
    return { days: mounted, saved: walking - mounted, note: walking > mounted ? `a caballo: ${walking - mounted} día(s) menos` : '' };
}

/**
 * Lo que comen en una semana.
 *
 * @param {any} raw
 * @returns {number}
 */
export function feedPerWeek(raw) {
    return Object.entries(readMounts(raw))
        .reduce((sum, [id, n]) => sum + MOUNTS[/** @type {keyof typeof MOUNTS} */ (id)].feedPerWeek * n, 0);
}

/**
 * Para la ficha del grupo.
 *
 * @param {any} raw
 * @returns {string}
 */
export function describeMounts(raw) {
    const list = Object.entries(readMounts(raw)).map(([id, n]) => `${n} ${MOUNTS[/** @type {keyof typeof MOUNTS} */ (id)].label.toLowerCase()}${n === 1 ? '' : 's'}`);
    return list.length > 0 ? `Monturas: ${list.join(', ')} (${feedPerWeek(raw)} de oro de pienso a la semana)` : '';
}
