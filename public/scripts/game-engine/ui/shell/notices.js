/**
 * La bandeja de avisos y el grupo de un vistazo (ideas 159 y 162).
 *
 * **La bandeja.** El juego avisa mucho: el tiempo del viaje, un rumor, una pista, una
 * noticia, una frase de un compañero. Como toasts sueltos se apilaban encima de los botones
 * y se perdian a los cinco segundos. Ahora se guardan (los repetidos juntos, con un
 * contador) y se ven los ultimos en una bandeja, y en pantalla nunca hay mas de tres.
 *
 * **El grupo de un vistazo.** Vida, heridas, hambre y sed, oro y vinculo de todos, en una
 * sola tabla, sin abrir cinco fichas.
 *
 * Puro: decide que se guarda y que se ve. Quien llama pinta.
 */

/** Los que se guardan. */
export const MAX_NOTICES = 40;

/** Los que se ven a la vez en pantalla. */
export const MAX_VISIBLE_TOASTS = 3;

/** Dos avisos iguales en menos de esto son el mismo, repetido. */
const SAME_WITHIN_MS = 5000;

/**
 * @typedef {Object} Notice
 * @property {string} kind  info, success, warning o error.
 * @property {string} title
 * @property {string} message
 * @property {number} at
 * @property {number} count
 */

/**
 * Apuntar un aviso. Si es igual que el ultimo y acaba de llegar, se suma a ese.
 *
 * @param {Notice[]|null|undefined} list
 * @param {{kind: string, title: string, message: string, at: number}} notice
 * @returns {Notice[]}
 */
export function addNotice(list, notice) {
    const all = Array.isArray(list) ? [...list] : [];
    const title = String(notice?.title ?? '').trim();
    const message = String(notice?.message ?? '').replace(/<[^>]*>/g, '').trim();
    if (!title && !message) return all;
    const last = all[all.length - 1];
    if (last && last.title === title && last.message === message && notice.at - last.at < SAME_WITHIN_MS) {
        all[all.length - 1] = { ...last, at: notice.at, count: last.count + 1 };
        return all;
    }
    all.push({ kind: String(notice.kind || 'info'), title, message, at: Number(notice.at) || 0, count: 1 });
    return all.slice(-MAX_NOTICES);
}

/**
 * Cuantos hay sin ver desde la ultima vez que se abrio la bandeja.
 *
 * @param {Notice[]} list
 * @param {number} seenAt
 * @returns {number}
 */
export function unseenCount(list, seenAt) {
    return (list ?? []).filter(n => n.at > seenAt).length;
}

/**
 * Una fila del grupo de un vistazo.
 *
 * @param {any} member
 * @param {{injuries: string[], needs: string, rank: number}} extra Lo que ya describen los
 *   modulos de heridas, necesidades y vinculo.
 * @returns {{name: string, hp: string, pct: number, state: 'ok'|'hurt'|'down', lines: string[], gold: number}}
 */
export function glanceRow(member, extra) {
    const hp = Math.max(0, Number(member?.hp) || 0);
    const max = Math.max(1, Number(member?.maxHp) || 1);
    const pct = Math.round((hp / max) * 100);
    const conditions = (Array.isArray(member?.activeConditions) ? member.activeConditions : []).filter(Boolean);
    /** @type {string[]} */
    const lines = [];
    if (extra.injuries.length > 0) lines.push(`Heridas: ${extra.injuries.join('; ')}`);
    if (extra.needs) lines.push(extra.needs);
    if (conditions.length > 0) lines.push(`Estado: ${conditions.join(', ')}`);
    if (extra.rank > 0) lines.push(`Vínculo: rango ${extra.rank}`);
    return {
        name: String(member?.name ?? ''),
        hp: `${hp}/${max}`,
        pct,
        state: hp <= 0 ? 'down' : pct < 50 ? 'hurt' : 'ok',
        lines,
        gold: Math.max(0, Number(member?.gold) || 0),
    };
}
