/**
 * El hilo como grafo que se toca: mover hitos de acto, cambiar cómo se abren y qué piden
 * (idea 176).
 *
 * Escribir el hilo era escribir YAML. El editor visual pone cada hito como una tarjeta en la
 * columna de su acto; arrastrarla a otra columna la cambia de acto, y pulsarla deja cambiar
 * el título, la pista, tras qué hito se abre y qué pide. Aquí está lo que el editor hace con
 * los datos; lo que se dibuja está en `ui/world-workshop.js`.
 *
 * Nunca deja un hilo roto: no se puede hacer que un hito se abra tras sí mismo, ni tras uno
 * que no existe, y mover de acto no toca lo demás.
 *
 * Puro: devuelve el hilo cambiado, o el motivo por el que no.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Las columnas: los hitos de cada acto, en su orden.
 *
 * @param {any} plot
 * @returns {Array<{act: number, milestones: any[]}>}
 */
export function columnsOf(plot) {
    const acts = new Map();
    for (const m of Array.isArray(plot?.milestones) ? plot.milestones : []) {
        const act = Math.max(1, Math.floor(Number(m?.act) || 1));
        if (!acts.has(act)) acts.set(act, []);
        acts.get(act).push(m);
    }
    const last = Math.max(3, ...acts.keys());
    return Array.from({ length: last }, (_, i) => ({ act: i + 1, milestones: acts.get(i + 1) ?? [] }));
}

/**
 * Cambiar un hito de acto.
 *
 * @param {any} plot
 * @param {string} id
 * @param {number} act
 * @returns {{ok: boolean, reason: string, plot: any}}
 */
export function moveMilestone(plot, id, act) {
    const list = Array.isArray(plot?.milestones) ? plot.milestones : [];
    if (!list.some((/** @type {any} */ m) => text(m?.id) === text(id))) return { ok: false, reason: 'Ese hito no existe.', plot };
    const to = Math.max(1, Math.min(9, Math.floor(Number(act) || 1)));
    return {
        ok: true, reason: '',
        plot: { ...plot, milestones: list.map((/** @type {any} */ m) => (text(m?.id) === text(id) ? { ...m, act: to } : m)) },
    };
}

/**
 * Cambiar lo que se puede cambiar de un hito: título, pista, tras cuál se abre y qué pide.
 *
 * @param {any} plot
 * @param {string} id
 * @param {{title?: string, hint?: string, after?: string, asks?: {kind: string, npc?: string, place?: string, board?: string, skill?: string}}} patch
 * @returns {{ok: boolean, reason: string, plot: any}}
 */
export function editMilestone(plot, id, patch) {
    const list = Array.isArray(plot?.milestones) ? plot.milestones : [];
    const target = list.find((/** @type {any} */ m) => text(m?.id) === text(id));
    if (!target) return { ok: false, reason: 'Ese hito no existe.', plot };
    /** @type {any} */
    const next = { ...target };
    if (patch.title !== undefined) {
        if (!text(patch.title)) return { ok: false, reason: 'Un hito sin título no se entiende.', plot };
        next.title = text(patch.title);
    }
    if (patch.hint !== undefined) next.hint = text(patch.hint);
    if (patch.after !== undefined) {
        const after = text(patch.after);
        if (after === text(id)) return { ok: false, reason: 'Un hito no puede abrirse tras sí mismo.', plot };
        if (after && !list.some((/** @type {any} */ m) => text(m?.id) === after)) return { ok: false, reason: `No hay ningún hito «${after}».`, plot };
        next.opens = after ? { kind: 'after', milestone: after } : { kind: 'start' };
    }
    if (patch.asks) next.asks = { ...(target.asks ?? {}), ...patch.asks };
    return { ok: true, reason: '', plot: { ...plot, milestones: list.map((/** @type {any} */ m) => (m === target ? next : m)) } };
}

/**
 * Las flechas del grafo: qué hito abre cuál.
 *
 * @param {any} plot
 * @returns {Array<{from: string, to: string}>}
 */
export function edgesOf(plot) {
    return (Array.isArray(plot?.milestones) ? plot.milestones : [])
        .filter((/** @type {any} */ m) => text(m?.opens?.kind) === 'after' && text(m?.opens?.milestone))
        .map((/** @type {any} */ m) => ({ from: text(m.opens.milestone), to: text(m.id) }));
}
