/**
 * Cartas que esperan en la posada (idea 113): el mundo os busca a vosotros.
 *
 * Salen de lo que ya pasa, nunca del aire:
 *
 * - **Quien os aprecia** (reputación +3 o más) escribe ofreciendo trabajo o favor.
 * - **Quien os odia** (−3 o menos) escribe amenazando.
 * - **Quien os prestó** escribe cuando la deuda está a tres días o menos de vencer.
 *
 * Una carta de cada tipo y remitente por semana, como mucho: el correo que llega todos los
 * días deja de leerse. Se recogen en cualquier posada.
 *
 * Puro: decide qué cartas hay y qué dicen.
 */

/**
 * @typedef {Object} Letter
 * @property {string} id
 * @property {string} from
 * @property {'favor'|'threat'|'debt'} kind
 * @property {string} text Lo que dice, para el narrador.
 * @property {number} day
 */

/**
 * @param {any} raw
 * @returns {Letter[]}
 */
export function readLetters(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(l => l && String(l.id ?? '') && String(l.text ?? '').trim())
        .map(l => ({
            id: String(l.id),
            from: String(l.from ?? 'Alguien'),
            kind: /** @type {'favor'|'threat'|'debt'} */ (['favor', 'threat', 'debt'].includes(l.kind) ? l.kind : 'favor'),
            text: String(l.text).trim(),
            day: Math.max(1, Math.floor(Number(l.day) || 1)),
        }));
}

/**
 * Las cartas nuevas de hoy.
 *
 * @param {Object} input
 * @param {Array<{id: string, name: string, reputation: number}>} input.factions
 * @param {{amount: number, due: number, creditor?: string}|null} [input.debt]
 * @param {number} input.today
 * @param {string[]} [input.sent] Las que ya se mandaron (por id), para no repetir.
 * @returns {Letter[]}
 */
export function newLetters({ factions, debt = null, today, sent = [] }) {
    const week = Math.floor((Math.max(1, Number(today) || 1) - 1) / 7);
    const already = new Set(sent.map(String));
    /** @type {Letter[]} */
    const out = [];
    for (const faction of factions || []) {
        const rep = Number(faction?.reputation) || 0;
        if (rep >= 3) {
            const id = `favor:${faction.id}:${week}`;
            if (!already.has(id)) {
                out.push({
                    id, from: String(faction.name), kind: 'favor', day: today,
                    text: `${faction.name} os escribe: saben lo que habéis hecho por ellos y quieren veros. Hay trabajo, y se paga bien.`,
                });
            }
        } else if (rep <= -3) {
            const id = `threat:${faction.id}:${week}`;
            if (!already.has(id)) {
                out.push({
                    id, from: String(faction.name), kind: 'threat', day: today,
                    text: `Una carta sin firmar, con el sello de ${faction.name}: sabéis lo que habéis hecho. Mirad por dónde andáis.`,
                });
            }
        }
    }
    if (debt && Number(debt.amount) > 0 && Number(debt.due) - Number(today) <= 3 && Number(debt.due) >= Number(today)) {
        const id = `debt:${debt.due}`;
        if (!already.has(id)) {
            const who = String(debt.creditor ?? 'Quien os prestó');
            out.push({
                id, from: who, kind: 'debt', day: today,
                text: `${who} os recuerda que el día ${debt.due} vence lo que debéis: ${debt.amount} de oro.`,
            });
        }
    }
    return out;
}
