/**
 * Lo que les parece a tus compañeros lo que haces, y cuando chocan entre ellos (ideas 28
 * y 32).
 *
 * Cada compañero busca algo (`wants`: oro, gloria, sangre, tranquilidad o saber). Hasta
 * ahora solo opinaban de los encargos, y la opinión se quedaba en una frase. Ahora:
 *
 * - **Aprobación visible**: tras una decisión que toca lo que quieren —pagar o plantar
 *   cara, soltar o entregar a un prisionero, retirarse, cómo se cumple un hito—, cada uno
 *   aprueba o no, a la vista (👍 / 👎). Y cuenta: un punto de vínculo arriba o abajo, y
 *   queda apuntado en su ficha.
 * - **Roces**: si la misma decisión le gusta a uno y a otro no, chocan. Se dice, lo lee el
 *   narrador, y ese día pesa en la moral del grupo.
 *
 * Puro: decide quién aprueba, quién choca y qué se apunta. Quien llama suma el vínculo.
 */

import { WANTS } from '../rules/companions.js';

/**
 * Las decisiones que se notan, con lo que le parecen a cada deseo.
 *
 * @type {Record<string, {label: string, moods: Partial<Record<keyof typeof WANTS, 1|-1>>}>}
 */
export const DECISIONS = {
    'pagar': { label: 'pagar para que os dejen pasar', moods: { coin: -1, glory: -1, quiet: 1 } },
    'plantar-cara': { label: 'plantar cara', moods: { glory: 1, blood: 1, quiet: -1 } },
    'soltar-prisionero': { label: 'soltar a un prisionero', moods: { quiet: 1, blood: -1, coin: -1 } },
    'entregar-prisionero': { label: 'entregar a un prisionero por la recompensa', moods: { coin: 1, quiet: 1 } },
    'interrogar': { label: 'interrogar a un prisionero', moods: { knowledge: 1 } },
    'retirada': { label: 'retirarse del combate', moods: { glory: -1, blood: -1, quiet: 1 } },
    'hito-luchando': { label: 'resolverlo luchando', moods: { blood: 1, glory: 1, quiet: -1 } },
    'hito-hablando': { label: 'resolverlo hablando', moods: { quiet: 1, knowledge: 1, blood: -1 } },
    'hito-maña': { label: 'resolverlo con maña', moods: { knowledge: 1, glory: -1 } },
};

/** Lo que se guarda por compañero. */
export const MAX_LOG = 30;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {{id: string, name: string, want: string, mood: 1|-1, what: string}} Verdict
 */

/**
 * Lo que le parece a cada compañero una decisión. El héroe no opina de sí mismo, y los
 * muertos tampoco.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {string} input.decision Una de `DECISIONS`.
 * @param {(member: any) => string} input.wantsOf Lo que busca cada uno.
 * @returns {Verdict[]}
 */
export function approvalFor({ party, decision, wantsOf }) {
    const spec = DECISIONS[text(decision)];
    if (!spec) return [];
    return (Array.isArray(party) ? party : []).slice(1)
        .filter(m => m && !m.dead && (Number(m.hp) || 0) > 0)
        .flatMap(m => {
            const want = text(wantsOf(m));
            const mood = spec.moods[/** @type {keyof typeof WANTS} */ (want)];
            return mood ? [{ id: String(m.id), name: text(m.name) || 'Alguien', want, mood, what: spec.label }] : [];
        });
}

/**
 * Las opiniones de un encargo (`opinionOf`), como aprobación.
 *
 * @param {Array<{member: any, opinion: {mood: 'like'|'dislike', line: string}|null}>} said
 * @param {(member: any) => string} wantsOf
 * @param {string} what
 * @returns {Verdict[]}
 */
export function approvalFromOpinions(said, wantsOf, what) {
    return (Array.isArray(said) ? said : []).flatMap(({ member, opinion }) => (opinion
        ? [{ id: String(member?.id), name: text(member?.name) || 'Alguien', want: text(wantsOf(member)), mood: /** @type {1|-1} */ (opinion.mood === 'like' ? 1 : -1), what: text(what) }]
        : []));
}

/**
 * El primer roce: uno aprueba, otro no, y buscan cosas distintas.
 *
 * @param {Verdict[]} verdicts
 * @returns {{a: Verdict, b: Verdict, line: string}|null}
 */
export function frictionOf(verdicts) {
    const likes = (verdicts || []).filter(v => v.mood > 0);
    const dislikes = (verdicts || []).filter(v => v.mood < 0);
    for (const a of likes) {
        const b = dislikes.find(d => d.want !== a.want && d.id !== a.id);
        if (!b) continue;
        const wa = WANTS[/** @type {keyof typeof WANTS} */ (a.want)]?.label ?? a.want;
        const wb = WANTS[/** @type {keyof typeof WANTS} */ (b.want)]?.label ?? b.want;
        return { a, b, line: `${a.name} y ${b.name} chocan por ${a.what}: uno busca ${wa} y el otro ${wb}.` };
    }
    return null;
}

/**
 * La aprobación en una línea: «👍 Bran · 👎 Lyra».
 *
 * @param {Verdict[]} verdicts
 * @returns {string}
 */
export function describeApproval(verdicts) {
    return (verdicts || []).map(v => `${v.mood > 0 ? '👍' : '👎'} ${v.name}`).join(' · ');
}

/**
 * @typedef {Object} ApprovalState
 * @property {Array<{id: string, mood: 1|-1, what: string, day: number}>} log
 * @property {Array<{a: string, b: string, day: number, line: string}>} frictions
 */

/**
 * @param {any} raw
 * @returns {ApprovalState}
 */
export function readApproval(raw) {
    const log = (Array.isArray(raw?.log) ? raw.log : [])
        .filter((/** @type {any} */ e) => e && text(e.id) && (e.mood === 1 || e.mood === -1))
        .map((/** @type {any} */ e) => ({ id: text(e.id), mood: /** @type {1|-1} */ (e.mood), what: text(e.what), day: Math.max(1, Math.floor(Number(e.day) || 1)) }));
    const frictions = (Array.isArray(raw?.frictions) ? raw.frictions : [])
        .filter((/** @type {any} */ f) => f && text(f.a) && text(f.b))
        .map((/** @type {any} */ f) => ({ a: text(f.a), b: text(f.b), day: Math.max(1, Math.floor(Number(f.day) || 1)), line: text(f.line) }));
    return { log: log.slice(-MAX_LOG), frictions: frictions.slice(-10) };
}

/**
 * Apuntar lo que les ha parecido, y el roce si lo hubo.
 *
 * @param {any} raw
 * @param {Verdict[]} verdicts
 * @param {number} day
 * @returns {{state: ApprovalState, friction: {a: Verdict, b: Verdict, line: string}|null}}
 */
export function noteApproval(raw, verdicts, day) {
    const state = readApproval(raw);
    const today = Math.max(1, Math.floor(Number(day) || 1));
    const log = [...state.log, ...(verdicts || []).map(v => ({ id: v.id, mood: v.mood, what: v.what, day: today }))].slice(-MAX_LOG);
    const friction = frictionOf(verdicts);
    const frictions = friction
        ? [...state.frictions, { a: friction.a.id, b: friction.b.id, day: today, line: friction.line }].slice(-10)
        : state.frictions;
    return { state: { log, frictions }, friction };
}

/**
 * Los roces de hoy: pesan en la moral.
 *
 * @param {any} raw
 * @param {number} day
 * @returns {number}
 */
export function frictionsOn(raw, day) {
    const today = Math.max(1, Math.floor(Number(day) || 1));
    return readApproval(raw).frictions.filter(f => f.day === today).length;
}

/**
 * Lo que le ha parecido a alguien lo último, para su ficha.
 *
 * @param {any} raw
 * @param {string} id
 * @param {number} [count]
 * @returns {{score: number, recent: string[]}}
 */
export function approvalOf(raw, id, count = 3) {
    const mine = readApproval(raw).log.filter(e => e.id === String(id));
    return {
        score: mine.reduce((sum, e) => sum + e.mood, 0),
        recent: mine.slice(-count).reverse().map(e => `${e.mood > 0 ? '👍' : '👎'} ${e.what}`),
    };
}
