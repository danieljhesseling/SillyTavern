/**
 * La concentración (J19.4 del roadmap sin conexión): **un solo** conjuro así a la vez, y un
 * golpe puede romperlo.
 *
 * - Lanzar otro que pida concentración acaba el primero, sin tirar nada.
 * - Recibir daño pide una salvación de Constitución contra la mitad del daño, y nunca
 *   menos de 10. Si falla, el conjuro se acaba.
 * - Quedar incapacitado (paralizado, aturdido, inconsciente…) o morir lo acaba siempre.
 * - Y se acaba solo cuando se le acaba el tiempo.
 *
 * Lo que dependía de él (una zona, unas invocaciones, un estado sobre alguien) lleva el id
 * de quien lo lanzó y del conjuro: `linkedTo` lo encuentra en cualquier lista, sin que este
 * módulo tenga que saber qué es cada cosa.
 *
 * En la ficha, `concentration`: `{ spellId, name, casterId, since, until }` o `null`.
 *
 * Puro: decide y cuenta. Tirar el dado entra como función.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.4.
 */

/** Los estados que la rompen sin tirar nada (5e: incapacitado, o algo que lo incluye). */
export const BREAKING_CONDITIONS = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];

/** Lo mínimo que cuesta aguantar un golpe. */
export const MIN_CONCENTRATION_DC = 10;

/**
 * @typedef {Object} Concentration
 * @property {string} spellId
 * @property {string} name
 * @property {string} casterId
 * @property {number} since
 * @property {number|null} until La ronda en que se acaba sola; `null` si no.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La concentración de una ficha, leída con tolerancia. `null` si no hay.
 *
 * @param {any} raw
 * @returns {Concentration|null}
 */
export function readConcentration(raw) {
    if (!raw || typeof raw !== 'object' || !text(raw.spellId)) return null;
    const until = raw.until === null || raw.until === undefined ? null : Math.floor(Number(raw.until));
    return {
        spellId: text(raw.spellId),
        name: text(raw.name) || text(raw.spellId),
        casterId: text(raw.casterId),
        since: Math.max(1, Math.floor(Number(raw.since) || 1)),
        until: Number.isFinite(until) ? until : null,
    };
}

/**
 * La CD de aguantar un golpe: la mitad del daño, y nunca menos de 10.
 *
 * @param {number} damage
 * @returns {number}
 */
export function concentrationDc(damage) {
    return Math.max(MIN_CONCENTRATION_DC, Math.floor((Number(damage) || 0) / 2));
}

/**
 * El modificador de su salvación de Constitución: la característica, y la competencia si su
 * clase la tiene (`saveProficiencies`, si la ficha la trae).
 *
 * @param {any} member
 * @returns {number}
 */
export function constitutionSave(member) {
    const modifier = Math.floor(((Number(member?.constitution) || 10) - 10) / 2);
    const proficient = (Array.isArray(member?.saveProficiencies) ? member.saveProficiencies : []).map(text).includes('constitution');
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    return modifier + (proficient ? 2 + Math.floor((level - 1) / 4) : 0);
}

/**
 * Empezar a concentrarse. Si ya estaba en otro, se acaba (sin tirar nada).
 *
 * @param {Object} input
 * @param {any} input.current La que tenía, o null.
 * @param {{id: string, name: string, durationRounds?: number}} input.spell
 * @param {string} input.casterId
 * @param {number} input.round
 * @returns {{concentration: Concentration, ended: Concentration|null, lines: string[]}}
 */
export function startConcentration({ current, spell, casterId, round }) {
    const before = readConcentration(current);
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const rounds = Number(spell?.durationRounds);
    const concentration = {
        spellId: text(spell?.id),
        name: text(spell?.name) || text(spell?.id),
        casterId: text(casterId),
        since: now,
        until: Number.isFinite(rounds) && rounds > 0 ? now + Math.floor(rounds) : null,
    };
    return {
        concentration,
        ended: before,
        lines: before ? [`🧠 Deja de concentrarse en ${before.name} para concentrarse en ${concentration.name}.`] : [],
    };
}

/**
 * Lo que pasa con la concentración al recibir daño.
 *
 * @param {Object} input
 * @param {any} input.concentration
 * @param {number} input.damage
 * @param {(formula: string) => {total: number}} input.roll
 * @param {number} [input.saveModifier] El de `constitutionSave`.
 * @param {string} [input.name] De quien se concentra.
 * @returns {{kept: boolean, dc: number, total: number, concentration: Concentration|null, ended: Concentration|null, lines: string[]}}
 */
export function concentrationCheck({ concentration, damage, roll, saveModifier = 0, name = 'Alguien' }) {
    const current = readConcentration(concentration);
    const hurt = Math.max(0, Math.floor(Number(damage) || 0));
    if (!current || hurt === 0) return { kept: true, dc: 0, total: 0, concentration: current, ended: null, lines: [] };
    const dc = concentrationDc(hurt);
    const d20 = Number(roll('1d20').total) || 0;
    const total = d20 + saveModifier;
    const kept = total >= dc;
    const lines = [`🧠 ${name} aguanta la concentración en ${current.name}: d20(${d20}) ${saveModifier >= 0 ? '+' : ''}${saveModifier} = ${total} vs CD ${dc}.`];
    lines.push(kept ? '✔️ La mantiene.' : `💫 La pierde: se acaba ${current.name}.`);
    return { kept, dc, total, concentration: kept ? current : null, ended: kept ? null : current, lines };
}

/**
 * Si unos estados la rompen.
 *
 * @param {any} concentration
 * @param {string[]} conditions
 * @returns {{broken: boolean, ended: Concentration|null, lines: string[]}}
 */
export function concentrationAfterConditions(concentration, conditions) {
    const current = readConcentration(concentration);
    const has = (Array.isArray(conditions) ? conditions : []).map(text);
    const cause = BREAKING_CONDITIONS.find(c => has.includes(c));
    if (!current || !cause) return { broken: false, ended: null, lines: [] };
    return { broken: true, ended: current, lines: [`💫 Así no se puede concentrar: se acaba ${current.name}.`] };
}

/**
 * Si se acaba sola en esta ronda.
 *
 * @param {any} concentration
 * @param {number} round
 * @returns {{expired: boolean, ended: Concentration|null, lines: string[]}}
 */
export function expireConcentration(concentration, round) {
    const current = readConcentration(concentration);
    const now = Math.floor(Number(round) || 0);
    if (!current || current.until === null || current.until > now) return { expired: false, ended: null, lines: [] };
    return { expired: true, ended: current, lines: [`⌛ Se acaba ${current.name}.`] };
}

/**
 * Dejarla a propósito, o porque quien se concentra cae.
 *
 * @param {any} concentration
 * @param {string} [why]
 * @returns {{ended: Concentration|null, lines: string[]}}
 */
export function endConcentration(concentration, why = '') {
    const current = readConcentration(concentration);
    if (!current) return { ended: null, lines: [] };
    return { ended: current, lines: [`🧠 Se acaba ${current.name}${why ? `: ${why}` : ''}.`] };
}

/**
 * Lo que dependía de una concentración, en cualquier lista: las cosas que llevan su
 * `casterId` y su `spellId` (zonas, invocaciones, estados).
 *
 * @template {{casterId?: string, spellId?: string}} T
 * @param {Concentration|null} ended
 * @param {T[]} items
 * @returns {{linked: T[], rest: T[]}}
 */
export function linkedTo(ended, items) {
    const list = Array.isArray(items) ? items : [];
    if (!ended) return { linked: [], rest: list };
    const linked = list.filter(item => text(item?.casterId) === ended.casterId && text(item?.spellId) === ended.spellId);
    return { linked, rest: list.filter(item => !linked.includes(item)) };
}

/**
 * La concentración en una línea, para la ficha y la ficha del tablero.
 *
 * @param {any} concentration
 * @param {number} [round]
 * @returns {string} Vacío si no hay.
 */
export function describeConcentration(concentration, round) {
    const current = readConcentration(concentration);
    if (!current) return '';
    const now = Math.floor(Number(round) || 0);
    const left = current.until !== null && now > 0 ? Math.max(0, current.until - now) : null;
    return `🧠 Concentración: ${current.name}${left !== null ? ` (quedan ${left} ronda${left === 1 ? '' : 's'})` : ''}`;
}
