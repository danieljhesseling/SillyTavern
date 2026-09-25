/**
 * Cargar partida de un vistazo: el día, el sitio, lo que tenéis entre manos y quién va
 * (idea 160).
 *
 * La lista de partidas decía el nombre del mundo, cuántas sesiones y el nombre del archivo
 * del chat («1387 - 2026-9-24, 18h 03m»). Para elegir cuál seguir había que abrirlas.
 * Todo lo que hace falta ya está en los metadatos de cada chat: el calendario, dónde se
 * quedó el grupo, el hilo y el grupo mismo. Aquí se resume en una tarjeta.
 *
 * Puro: lee los metadatos de un chat y dice lo que se enseña.
 */

import { readPlot, focusOf } from './plot.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} SaveSummary
 * @property {number} day
 * @property {string} place
 * @property {string} focus Lo que tienen entre manos, o el final si ya acabó.
 * @property {boolean} ended
 * @property {Array<{name: string, avatar: string, fallen: boolean}>} party
 */

/**
 * Lo que se sabe de una partida guardada.
 *
 * @param {any} meta Los metadatos del chat.
 * @returns {SaveSummary}
 */
export function saveSummary(meta) {
    const day = Math.max(1, Math.floor(Number(meta?.calendar?.day) || 1));
    const plot = readPlot(meta?.plot);
    const ended = text(meta?.plotEnding);
    const endingTitle = ended ? text(plot?.endings?.[ended]?.title) || ended : '';
    const focus = ended ? `Final: ${endingTitle}` : text(focusOf(plot, meta?.plotState)?.title);
    const party = (Array.isArray(meta?.party) ? meta.party : [])
        .filter((/** @type {any} */ m) => text(m?.name))
        .map((/** @type {any} */ m) => ({
            name: text(m.name),
            // Una imagen enorme en línea no cabe en una tarjeta: solo rutas cortas.
            avatar: text(m.avatar).length > 0 && text(m.avatar).length < 400 ? text(m.avatar) : '',
            fallen: Boolean(m.dead),
        }));
    return { day, place: text(meta?.currentLocation), focus, ended: Boolean(ended), party };
}

/**
 * La tarjeta en una línea: «Día 12 · El Peaje Norte · La vanguardia de Keller».
 *
 * @param {SaveSummary} summary
 * @returns {string}
 */
export function describeSave(summary) {
    return [`Día ${summary.day}`, summary.place, summary.focus].filter(Boolean).join(' · ');
}

/**
 * Quién va, en una línea: los caídos, tachados con una cruz.
 *
 * @param {SaveSummary} summary
 * @returns {string}
 */
export function describeSaveParty(summary) {
    return summary.party.map(m => (m.fallen ? `${m.name} ✝` : m.name)).join(', ');
}
