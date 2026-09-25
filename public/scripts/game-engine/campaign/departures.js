/**
 * Se van: un compañero harto se marcha (idea 29). Opcional: se enciende en la pausa.
 *
 * El vínculo solo subía. Ahora, con esto puesto, lo que les parece lo que haces (idea 28)
 * pesa también hacia abajo: quien acumula disgustos avisa primero y, si sigue, se va. Nunca
 * de golpe ni sin decirlo: un aviso antes, con el motivo.
 *
 * Se mira una vez por semana. Lo que cuenta es la aprobación de las últimas decisiones y
 * que el vínculo no lo sujete (quien tiene rango 3 o más aguanta).
 *
 * Puro: dice quién avisa y quién se va. Quien llama lo saca del grupo.
 */

/** Donde avisa y donde se va, por la suma de lo que le ha parecido. */
export const LEAVE = { warn: -2, leave: -4, holdRank: 3 };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Quién avisa y quién se va.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {(member: any) => number} input.approvalOf La suma de lo que le ha parecido.
 * @param {(member: any) => number} input.rankOf
 * @param {string[]} [input.warned] A quién ya se avisó.
 * @returns {{warn: any[], leave: any[]}}
 */
export function judgeDepartures({ party, approvalOf, rankOf, warned = [] }) {
    const told = new Set((warned || []).map(String));
    /** @type {any[]} */
    const warn = [];
    /** @type {any[]} */
    const leave = [];
    for (const member of (Array.isArray(party) ? party : []).slice(1)) {
        if (!member || member.dead || member.guest || rankOf(member) >= LEAVE.holdRank) continue;
        const score = approvalOf(member);
        if (score <= LEAVE.leave && told.has(String(member.id))) leave.push(member);
        else if (score <= LEAVE.warn && !told.has(String(member.id))) warn.push(member);
    }
    return { warn, leave };
}

/**
 * @param {any} member
 * @returns {string}
 */
export function describeWarning(member) {
    return `${text(member?.name)} está harto de cómo se hacen las cosas. Si sigue así, se irá.`;
}

/**
 * @param {any} member
 * @returns {string}
 */
export function describeLeaving(member) {
    return `${text(member?.name)} recoge sus cosas y se va: no le gusta lo que hacéis, y ya lo avisó.`;
}
