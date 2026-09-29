/**
 * Las invocaciones (J19.5 del roadmap sin conexión): un familiar, unos lobos, un esqueleto.
 *
 * Una invocación es una ficha más del grupo durante un rato. Lo que hace falta saber de
 * ella está en la columna `summon` del conjuro (`conjuros.json`):
 *
 * - **Qué criatura**: una del bestiario (`creature`, el id de un arquetipo, con su desafío
 *   `cr`: los números salen de la misma curva que los enemigos) o unos números escritos
 *   ahí mismo (`stats`), para lo que no está en el bestiario, como un familiar.
 * - **Cuántas** (`count`), que subir el conjuro de nivel puede multiplicar.
 * - **Quién la mueve** (`control`): `player`, la mueves tú; `engine`, la lleva el juego. Es
 *   el mismo interruptor que los compañeros (J7.3), y se puede cambiar a mitad de pelea.
 * - **Cuánto dura**: lo que dure el conjuro, o `duration` si es otra cosa (el familiar se
 *   queda hasta que lo maten). Si el conjuro pide concentración, se va al perderla.
 *
 * Puro: dice qué fichas salen, dónde y cuándo se van. Quien las pone en el tablero y les da
 * turno es `party.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.5.
 */

import { baselineFor } from '../compendio/bestiary.js';
import { isPassable } from '../board/terrain.js';
import { hasLineOfSight } from '../board/line-of-sight.js';

/** Quién mueve una invocación (J7.3). */
export const SUMMON_CONTROLS = ['player', 'engine'];

/** Cómo se dice, para el interruptor. */
export const SUMMON_CONTROL_LABELS = { player: 'Lo muevo yo', engine: 'Que lo lleve el juego' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @param {number} fallback @returns {number} */
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * @typedef {Object} SummonSpec
 * @property {string} creature El id de un arquetipo del bestiario, o vacío.
 * @property {number|null} cr Su desafío, para sacar sus números de la curva.
 * @property {{name: string, hp: number, armorClass: number, speed: number, attackRangeFeet: number, damage: string}|null} stats
 * @property {number} count
 * @property {'player'|'engine'} control
 * @property {string} duration Vacío: lo que dure el conjuro.
 * @property {boolean} attacks Si puede atacar (un familiar no).
 */

/**
 * La columna `summon`, leída con tolerancia.
 *
 * @param {any} raw
 * @returns {SummonSpec}
 */
export function normalizeSummon(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const stats = source.stats && typeof source.stats === 'object' ? {
        name: text(source.stats.name) || 'Invocación',
        hp: Math.max(1, Math.floor(number(source.stats.hp, 1))),
        armorClass: Math.max(1, Math.floor(number(source.stats.armorClass, 10))),
        speed: Math.max(0, Math.floor(number(source.stats.speed, 30))),
        attackRangeFeet: Math.max(5, Math.floor(number(source.stats.attackRangeFeet, 5))),
        damage: text(source.stats.damage),
    } : null;
    return {
        creature: text(source.creature),
        cr: source.cr === undefined || source.cr === null ? null : Math.max(0, number(source.cr, 0)),
        stats,
        count: Math.max(1, Math.floor(number(source.count, 1))),
        control: SUMMON_CONTROLS.includes(text(source.control)) ? /** @type {'player'|'engine'} */ (text(source.control)) : 'player',
        duration: text(source.duration),
        attacks: source.attacks !== false,
    };
}

/**
 * Lo que está mal en una columna `summon`.
 *
 * @param {any} raw
 * @param {{creatureIds?: string[]}} [context] Los ids del bestiario, para comprobar `creature`.
 * @returns {string[]}
 */
export function validateSummon(raw, context = {}) {
    /** @type {string[]} */
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['"summon" tiene que ser un objeto.'];
    const creature = text(raw.creature);
    if (!creature && !raw.stats) errors.push('"summon" no dice qué sale: ni "creature" (del bestiario) ni "stats".');
    if (creature && raw.stats) errors.push('"summon" trae "creature" y "stats": una de las dos.');
    if (creature && Array.isArray(context.creatureIds) && !context.creatureIds.includes(creature)) {
        errors.push(`"summon.creature" dice "${creature}", que no está en el bestiario.`);
    }
    if (creature && !(Number(raw.cr) >= 0)) errors.push('"summon" con "creature" tiene que decir su desafío ("cr").');
    if (raw.stats && !(Number(raw.stats.hp) > 0)) errors.push('"summon.stats" tiene que decir sus puntos de vida ("hp").');
    if (raw.count !== undefined && !(Number.isInteger(Number(raw.count)) && Number(raw.count) >= 1)) {
        errors.push('"summon.count" tiene que ser un número entero, 1 o más.');
    }
    if (raw.control !== undefined && !SUMMON_CONTROLS.includes(text(raw.control))) {
        errors.push(`"summon.control" dice "${text(raw.control)}". Vale: ${SUMMON_CONTROLS.join(', ')}.`);
    }
    return errors;
}

/**
 * Los números de una invocación: los escritos, o los de su arquetipo a su desafío.
 *
 * @param {SummonSpec} summon
 * @param {any[]} [bestiary] Las filas de `bestiario.json`.
 * @returns {{name: string, hp: number, armorClass: number, speed: number, attackRangeFeet: number, profile: string, damage: string, cr: number}}
 */
export function summonStats(summon, bestiary = []) {
    if (summon.stats) return { ...summon.stats, profile: 'guardian', cr: summon.cr ?? 0 };
    const row = (Array.isArray(bestiary) ? bestiary : []).find(r => text(r?.id) === summon.creature) ?? null;
    const cr = summon.cr ?? 0.25;
    const base = baselineFor(cr);
    return {
        name: text(row?.name) || 'Invocación',
        hp: Math.max(1, Math.round(base.hp * number(row?.hpFactor, 1))),
        armorClass: Math.max(5, base.armorClass + number(row?.acBonus, 0)),
        speed: Math.max(5, number(row?.speed, 30)),
        attackRangeFeet: Math.max(5, number(row?.rangeFeet, 5)),
        profile: text(row?.profile) || 'aggressive',
        damage: '',
        cr,
    };
}

/**
 * Casillas libres junto a quien invoca, de la más cercana a la más lejana y siempre en el
 * mismo orden: la misma invocación sale en el mismo sitio. Solo donde quien invoca ve (5e):
 * encerrado entre paredes, no salen al otro lado.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.caster
 * @param {number} input.count
 * @param {Array<{x: number, y: number}>} [input.occupied]
 * @param {any} [input.terrain]
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @param {number} [input.reach] Lo más lejos que se mira, en casillas.
 * @returns {Array<{x: number, y: number}>}
 */
export function placeNextToCaster({ caster, count, occupied = [], terrain = null, width = 50, height = 50, reach = 6 }) {
    const used = new Set((Array.isArray(occupied) ? occupied : []).map(c => `${Math.trunc(c.x)},${Math.trunc(c.y)}`));
    used.add(`${Math.trunc(caster.x)},${Math.trunc(caster.y)}`);
    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    for (let ring = 1; ring <= reach && out.length < count; ring++) {
        for (let y = caster.y - ring; y <= caster.y + ring && out.length < count; y++) {
            for (let x = caster.x - ring; x <= caster.x + ring && out.length < count; x++) {
                if (Math.max(Math.abs(x - caster.x), Math.abs(y - caster.y)) !== ring) continue;
                if (used.has(`${x},${y}`) || !isPassable(terrain, x, y, width, height)) continue;
                if (terrain && !hasLineOfSight(terrain, caster.x, caster.y, x, y)) continue;
                used.add(`${x},${y}`);
                out.push({ x, y });
            }
        }
    }
    return out;
}

/**
 * @typedef {Object} SummonToken
 * @property {string} id
 * @property {string} name
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} armorClass
 * @property {number} speed
 * @property {number} attackRangeFeet
 * @property {string} profile
 * @property {string} damage
 * @property {boolean} attacks
 * @property {number} x
 * @property {number} y
 * @property {'player'|'engine'} control
 * @property {string} casterId
 * @property {string} spellId
 * @property {number|null} until La ronda en que se va; `null` si no se va sola.
 * @property {boolean} concentration
 */

/**
 * Las fichas que salen de una invocación, junto a quien la lanza.
 *
 * @param {Object} input
 * @param {any} input.spell Un conjuro normalizado, con `summon`, `durationRounds` y `concentration`.
 * @param {{id: string, x: number, y: number, name?: string}} input.caster
 * @param {number} input.round
 * @param {number} [input.count] Cuántas, si subir de nivel lo ha cambiado (`upcastSpell`).
 * @param {number} [input.durationRounds] La de `summon.duration`, si la trae (`durationRounds` del catálogo).
 * @param {any[]} [input.bestiary]
 * @param {Array<{x: number, y: number}>} [input.occupied]
 * @param {any} [input.terrain]
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @returns {{tokens: SummonToken[], lines: string[]}}
 */
export function planSummon({
    spell, caster, round, count, durationRounds, bestiary = [], occupied = [], terrain = null, width = 50, height = 50,
}) {
    const summon = normalizeSummon(spell?.summon);
    const stats = summonStats(summon, bestiary);
    const howMany = Math.max(1, Math.floor(Number(count) || summon.count));
    const cells = placeNextToCaster({ caster, count: howMany, occupied, terrain, width, height });
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const rounds = durationRounds ?? Number(spell?.durationRounds);
    const lasts = Number.isFinite(rounds) && rounds > 0 ? now + Math.floor(rounds) : null;
    const tokens = cells.map((cell, index) => ({
        id: `inv-${text(spell?.id)}-${text(caster.id)}-${now}-${index + 1}`,
        name: howMany > 1 ? `${stats.name} ${index + 1}` : stats.name,
        hp: stats.hp,
        maxHp: stats.hp,
        armorClass: stats.armorClass,
        speed: stats.speed,
        attackRangeFeet: stats.attackRangeFeet,
        profile: stats.profile,
        damage: stats.damage,
        attacks: summon.attacks,
        x: cell.x,
        y: cell.y,
        control: summon.control,
        casterId: text(caster.id),
        spellId: text(spell?.id),
        until: lasts,
        concentration: Boolean(spell?.concentration) && !summon.duration,
    }));
    const who = text(caster.name) || 'Alguien';
    /** @type {string[]} */
    const lines = tokens.length > 0
        ? [`🐾 ${who} invoca ${tokens.length > 1 ? `${tokens.length} × ${stats.name}` : stats.name}.`]
        : [`🐾 ${who} invoca, pero no hay sitio libre a su lado.`];
    if (tokens.length > 0 && tokens.length < howMany) lines.push(`Solo caben ${tokens.length} de ${howMany}.`);
    return { tokens, lines };
}

/**
 * Las que se van en esta ronda porque se les acabó el tiempo.
 *
 * @param {SummonToken[]} tokens
 * @param {number} round
 * @returns {{kept: SummonToken[], gone: SummonToken[], lines: string[]}}
 */
export function expireSummons(tokens, round) {
    const now = Math.floor(Number(round) || 0);
    const list = Array.isArray(tokens) ? tokens : [];
    const gone = list.filter(t => t.until !== null && t.until <= now);
    return { kept: list.filter(t => !gone.includes(t)), gone, lines: gone.map(t => `🐾 ${t.name} se desvanece.`) };
}

/**
 * Las de un conjuro (o todas las de alguien) que se van de golpe: al perder la
 * concentración, o si quien las llamó cae.
 *
 * @param {SummonToken[]} tokens
 * @param {{casterId: string, spellId?: string, onlyConcentration?: boolean}} from
 * @returns {{kept: SummonToken[], gone: SummonToken[], lines: string[]}}
 */
export function dismissSummons(tokens, { casterId, spellId = '', onlyConcentration = false }) {
    const list = Array.isArray(tokens) ? tokens : [];
    const gone = list.filter(t => t.casterId === text(casterId)
        && (!spellId || t.spellId === text(spellId))
        && (!onlyConcentration || t.concentration));
    return { kept: list.filter(t => !gone.includes(t)), gone, lines: gone.map(t => `🐾 ${t.name} se desvanece.`) };
}

/**
 * Cambiar quién la mueve, a mitad de pelea si hace falta (J7.3).
 *
 * @param {SummonToken} token
 * @param {'player'|'engine'} control
 * @returns {SummonToken}
 */
export function setSummonControl(token, control) {
    return { ...token, control: SUMMON_CONTROLS.includes(control) ? control : token.control };
}
