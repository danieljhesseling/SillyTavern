/**
 * Resumen por acto: el chat viejo se comprime en la memoria del mundo (idea 143).
 *
 * En una partida larga, cada turno volvía a mandar todo el chat de los actos anteriores. Al
 * cerrarse un acto, lo que pasó se resume en unas líneas que van a la memoria del mundo (lo
 * que el narrador lee siempre), y los mensajes de ese acto se ocultan del prompt: se siguen
 * viendo en pantalla, pero ya no se pagan.
 *
 * El resumen lo escribe el motor con lo que sabe que pasó —los hitos cumplidos y los hechos
 * apuntados—, así que no gasta ninguna llamada. Si el narrador quiere contarlo mejor, lo
 * cuenta; pero la memoria no depende de él.
 *
 * Puro: escribe el resumen y dice qué mensajes ocultar.
 */

/** Los últimos mensajes que se dejan a la vista del prompt, para que la escena siga. */
export const KEEP_TAIL = 6;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * El resumen de un acto.
 *
 * @param {Object} input
 * @param {number} input.act
 * @param {string[]} input.milestones Los títulos de lo cumplido en el acto.
 * @param {string[]} input.deeds Los hechos apuntados en el acto.
 * @returns {string}
 */
export function summarizeAct({ act, milestones, deeds }) {
    const done = (milestones || []).map(text).filter(Boolean);
    const facts = (deeds || []).map(text).filter(Boolean).slice(-8);
    const parts = [`Acto ${Math.max(1, Math.floor(Number(act) || 1))}:`];
    if (done.length > 0) parts.push(`se cumplió ${done.join('; ')}.`);
    if (facts.length > 0) parts.push(facts.join(' '));
    if (done.length === 0 && facts.length === 0) parts.push('pasó sin nada que apuntar.');
    return parts.join(' ');
}

/**
 * Qué mensajes se ocultan del prompt: los del acto que se cierra, menos los últimos.
 *
 * @param {{from: number, to: number}} input `from`, el primero del acto; `to`, el último del chat.
 * @returns {{start: number, end: number}|null}
 */
export function hideRange({ from, to }) {
    const start = Math.max(0, Math.floor(Number(from) || 0));
    const end = Math.floor(Number(to) || 0) - KEEP_TAIL;
    return end >= start ? { start, end } : null;
}

/**
 * Los resúmenes guardados, en orden de acto.
 *
 * @param {any} raw
 * @returns {Array<{act: number, text: string}>}
 */
export function readSummaries(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(s => s && text(s.text))
        .map(s => ({ act: Math.max(1, Math.floor(Number(s.act) || 1)), text: text(s.text) }))
        .sort((a, b) => a.act - b.act);
}

/**
 * Apuntar el de un acto (uno por acto).
 *
 * @param {any} raw
 * @param {number} act
 * @param {string} summary
 * @returns {Array<{act: number, text: string}>}
 */
export function addSummary(raw, act, summary) {
    return [...readSummaries(raw).filter(s => s.act !== act), { act, text: text(summary) }].sort((a, b) => a.act - b.act);
}
