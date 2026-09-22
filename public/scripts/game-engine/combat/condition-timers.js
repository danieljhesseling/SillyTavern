/**
 * Condiciones que se van solas.
 *
 * Una condición puesta a mano con `/condition` se quita a mano, y eso está bien: la pones
 * porque la narración lo pide. Pero una habilidad que dice *«queda derribado una ronda»* y
 * deja al goblin en el suelo para siempre está mintiendo, y el número de rondas sería un
 * dato decorativo — justo lo que este proyecto no quiere.
 *
 * Así que lo que se aplica con duración se apunta con la ronda en la que caduca, y el
 * combate las barre al pasar de ronda. Lo puesto a mano no lleva apunte y no caduca.
 *
 * Puro: ni toca fichas ni narra. Devuelve qué ha vencido y quien llama lo aplica.
 *
 * Ver wiki/POR_HACER.md, D5.
 */

/**
 * @typedef {Object} ConditionTimer
 * @property {string} who Id del personaje, o instanceId del enemigo.
 * @property {string} condition
 * @property {number} until La primera ronda en la que ya no está.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Deja la lista en la forma que espera el resto, tirando lo que no se sostiene.
 *
 * @param {any} raw
 * @returns {ConditionTimer[]}
 */
export function normalizeTimers(raw) {
    return (Array.isArray(raw) ? raw : [])
        .map(timer => ({
            who: text(timer?.who),
            condition: text(timer?.condition),
            until: Math.floor(Number(timer?.until) || 0),
        }))
        .filter(timer => timer.who && timer.condition && timer.until > 0);
}

/**
 * Apunta una condición que caduca.
 *
 * Volver a aplicar la misma sobre el mismo no la duplica: se queda la que dure más, que es
 * lo que espera cualquiera que encadene dos golpes.
 *
 * @param {any} timers
 * @param {{who: string, condition: string, round: number, rounds: number}} input
 * @returns {ConditionTimer[]}
 */
export function addConditionTimer(timers, { who, condition, round, rounds }) {
    const list = normalizeTimers(timers);
    const until = Math.max(1, Math.floor(Number(round) || 1)) + Math.max(1, Math.floor(Number(rounds) || 1));
    const key = (/** @type {ConditionTimer} */ t) =>
        t.who === text(who) && t.condition.toLowerCase() === text(condition).toLowerCase();

    const existing = list.find(key);
    if (existing) {
        existing.until = Math.max(existing.until, until);
        return list;
    }

    list.push({ who: text(who), condition: text(condition), until });
    return list;
}

/**
 * Las que vencen al llegar a esta ronda.
 *
 * @param {any} timers
 * @param {number} round
 * @returns {{timers: ConditionTimer[], expired: Array<{who: string, condition: string}>}}
 */
export function expireConditions(timers, round) {
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const list = normalizeTimers(timers);

    return {
        timers: list.filter(timer => timer.until > now),
        expired: list.filter(timer => timer.until <= now)
            .map(timer => ({ who: timer.who, condition: timer.condition })),
    };
}

/**
 * Todo lo apuntado sobre alguien, para cuando cae o se acaba el combate.
 *
 * @param {any} timers
 * @param {string} who
 * @returns {ConditionTimer[]}
 */
export function clearTimersFor(timers, who) {
    return normalizeTimers(timers).filter(timer => timer.who !== text(who));
}

/**
 * Lo que le queda puesto a alguien, contado en palabras.
 *
 * @param {any} timers
 * @param {string} who
 * @param {number} round
 * @returns {string}
 */
export function describeTimers(timers, who, round) {
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const mine = normalizeTimers(timers).filter(timer => timer.who === text(who));
    if (mine.length === 0) return '';

    return mine
        .map(timer => `${timer.condition} (${Math.max(1, timer.until - now)} ronda(s))`)
        .join(', ');
}
