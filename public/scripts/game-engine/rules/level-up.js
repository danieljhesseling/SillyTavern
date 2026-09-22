/**
 * Subir de nivel: lo que cambia, y quién lo decide.
 *
 * Hasta ahora subir de nivel movía un número y nada más — ni puntos de golpe, ni una sola
 * elección. Matar cosas no te hacía más fuerte, que es justo lo contrario de lo que un
 * bucle de progresión promete.
 *
 * Los umbrales y los niveles que dan mejora de característica **viven en el paquete de
 * reglas**, no aquí: una campaña que quiera subir más rápido, o parar en el nivel 10, se
 * edita desde `/rules` sin tocar código. Lo que hay en este archivo es la aritmética, que
 * es la misma para cualquier tabla.
 *
 * Decide y no aplica: devuelve un plan y un parche, y quien llama los escribe. Así el
 * mismo cálculo sirve para enseñar «lo que va a pasar» antes de pulsar el botón.
 *
 * Ver wiki/POR_HACER.md, A1.
 */

import { getHitDice } from './rest.js';
import { DEFAULT_RULESET } from './default-ruleset.js';

/**
 * @typedef {Object} LevelStep
 * @property {number} level El nivel al que se llega en este paso.
 * @property {number} hitDie Las caras del dado de golpe de la clase.
 * @property {number} hpGained Puntos de golpe que da este nivel, ya con Constitución.
 * @property {boolean} ability Si este nivel trae mejora de característica.
 */

/**
 * @typedef {Object} LevelPlan
 * @property {boolean} canLevel
 * @property {string} reason Por qué no se puede, cuando no se puede.
 * @property {number} from
 * @property {number} to
 * @property {LevelStep[]} steps
 * @property {number} hpGained
 * @property {number} hitDiceGained
 * @property {number} abilityPicks Cuántas mejoras de característica hay que repartir.
 * @property {number} pointsToSpend Puntos totales a repartir (2 por mejora).
 * @property {number|null} xpNext La experiencia del siguiente nivel, o null en el tope.
 * @property {boolean} maxed
 */

/**
 * La tabla por defecto, que es la de 5e.
 *
 * Vive en el paquete de reglas y se lee de ahí: dos copias del mismo número acabarían
 * discrepando, y la que gana tiene que ser siempre la editable.
 */
export const DEFAULT_XP_THRESHOLDS = DEFAULT_RULESET.progression.xpThresholds;

/** Los niveles que en 5e traen mejora de característica, del mismo sitio. */
export const DEFAULT_ABILITY_LEVELS = DEFAULT_RULESET.progression.abilityLevels;

/** Ninguna característica pasa de aquí sin magia de por medio. */
export const ABILITY_CAP = 20;

/** Cada mejora reparte esto entre una o dos características. */
const POINTS_PER_IMPROVEMENT = 2;

/** Las seis, con el nombre que llevan en la ficha. */
export const ABILITIES = [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

/**
 * Ordena y limpia una tabla de umbrales venida del paquete de reglas.
 *
 * Todo lo que no sea un par de números se cae, y el resto se ordena por nivel: una tabla
 * escrita a mano con una fila torcida debe seguir jugándose, no reventar a mitad de
 * combate.
 *
 * @param {any} raw
 * @returns {Array<{level: number, xp: number}>}
 */
export function normalizeXpTable(raw) {
    const source = Array.isArray(raw) ? raw : DEFAULT_XP_THRESHOLDS;

    /** @type {Map<number, number>} */
    const byLevel = new Map();
    for (const entry of source) {
        const pair = Array.isArray(entry) ? entry : [entry?.level, entry?.xp];
        const level = Math.floor(Number(pair[0]));
        const xp = Math.floor(Number(pair[1]));
        if (!Number.isFinite(level) || !Number.isFinite(xp)) continue;
        if (level < 2 || xp < 0) continue;
        byLevel.set(level, xp);
    }

    return [...byLevel.entries()]
        .map(([level, xp]) => ({ level, xp }))
        .sort((a, b) => a.level - b.level);
}

/**
 * Los niveles con mejora de característica, como conjunto de números.
 *
 * @param {any} raw
 * @returns {Set<number>}
 */
export function normalizeAbilityLevels(raw) {
    const source = Array.isArray(raw) ? raw : DEFAULT_ABILITY_LEVELS;
    return new Set(source
        .map(value => Math.floor(Number(Array.isArray(value) ? value[0] : value)))
        .filter(level => Number.isFinite(level) && level >= 2));
}

/**
 * El nivel que corresponde a una cantidad de experiencia.
 *
 * @param {number} xp
 * @param {any} [table]
 * @returns {number}
 */
export function levelForXp(xp, table) {
    const rows = normalizeXpTable(table);
    const total = Math.max(0, Math.floor(Number(xp) || 0));

    let level = 1;
    for (const row of rows) {
        if (total >= row.xp) level = row.level;
        else break;
    }
    return level;
}

/**
 * La experiencia que pide el nivel dado, o null si está fuera de la tabla.
 *
 * @param {number} level
 * @param {any} [table]
 * @returns {number|null}
 */
export function xpForLevel(level, table) {
    const row = normalizeXpTable(table).find(r => r.level === Math.floor(Number(level)));
    return row ? row.xp : null;
}

/**
 * La media fija de un dado, que es lo que 5e ofrece a quien no quiere tirar.
 *
 * @param {number} faces
 * @returns {number}
 */
export function averageOfDie(faces) {
    return Math.floor(Number(faces) / 2) + 1;
}

/**
 * El modificador de Constitución, que suma a cada nivel.
 *
 * @param {any} member
 * @returns {number}
 */
function conModifier(member) {
    return Math.floor(((Number(member?.constitution) || 10) - 10) / 2);
}

/**
 * Qué pasaría si este personaje subiera de nivel ahora mismo.
 *
 * Sube **todos** los niveles que la experiencia dé de una vez: quedarse a medias después
 * de una sesión larga obligaría a pulsar el botón cinco veces, y ninguna de las cinco
 * sería una decisión.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} [input.table] Los umbrales del paquete de reglas.
 * @param {any} [input.abilityLevels] Los niveles con mejora, del paquete de reglas.
 * @param {Record<string, string>} [input.hitDieByClass]
 * @param {(faces: number) => number} [input.roll] Si se pasa, los PG se tiran en vez de la media.
 * @returns {LevelPlan}
 */
export function planLevelUp({ member, table, abilityLevels, hitDieByClass = {}, roll = null }) {
    const rows = normalizeXpTable(table);
    const improves = normalizeAbilityLevels(abilityLevels);
    const maxLevel = rows.length > 0 ? rows[rows.length - 1].level : 1;

    const current = Math.max(1, Math.floor(Number(member?.level) || 1));
    const xp = Math.max(0, Math.floor(Number(member?.xp) || 0));
    const earned = levelForXp(xp, rows);
    const target = Math.min(maxLevel, Math.max(current, earned));

    const { faces } = getHitDice(member, hitDieByClass);
    const modifier = conModifier(member);

    /** @type {LevelStep[]} */
    const steps = [];
    for (let level = current + 1; level <= target; level++) {
        const rolled = roll ? Math.max(1, Math.floor(Number(roll(faces)) || 1)) : averageOfDie(faces);
        steps.push({
            level,
            hitDie: faces,
            // Un nivel nunca quita vida, por mala que sea la Constitución.
            hpGained: Math.max(1, rolled + modifier),
            ability: improves.has(level),
        });
    }

    const abilityPicks = steps.filter(step => step.ability).length;
    const maxed = current >= maxLevel;

    return {
        canLevel: steps.length > 0,
        reason: steps.length > 0 ? ''
            : (maxed ? `Ya está en el nivel máximo (${maxLevel}).` : 'Le falta experiencia para el siguiente nivel.'),
        from: current,
        to: target,
        steps,
        hpGained: steps.reduce((total, step) => total + step.hpGained, 0),
        hitDiceGained: steps.length,
        abilityPicks,
        pointsToSpend: abilityPicks * POINTS_PER_IMPROVEMENT,
        xpNext: xpForLevel(target + 1, rows),
        maxed: target >= maxLevel,
    };
}

/**
 * Comprueba un reparto de puntos de característica.
 *
 * @param {Record<string, number>} picks
 * @param {LevelPlan} plan
 * @param {any} member
 * @returns {{ok: boolean, error: string}}
 */
export function validateAbilityPicks(picks, plan, member) {
    const entries = Object.entries(picks ?? {});

    for (const [ability] of entries) {
        if (!ABILITIES.includes(ability)) return { ok: false, error: `"${ability}" no es una característica.` };
    }

    const spent = entries.reduce((total, [, value]) => total + Math.max(0, Math.floor(Number(value) || 0)), 0);
    if (spent !== plan.pointsToSpend) {
        return { ok: false, error: `Hay que repartir ${plan.pointsToSpend} punto(s), y van ${spent}.` };
    }

    for (const [ability, value] of entries) {
        const after = (Number(member?.[ability]) || 10) + Math.max(0, Math.floor(Number(value) || 0));
        if (after > ABILITY_CAP) {
            return { ok: false, error: `${ability} pasaría de ${ABILITY_CAP}.` };
        }
    }

    return { ok: true, error: '' };
}

/**
 * El parche que hay que escribir en la ficha para que el nivel cuente.
 *
 * No toca al personaje: devuelve lo que cambia. Los dados de golpe no aparecen aquí
 * porque se cuentan a partir del nivel — subir uno ya da uno más.
 *
 * @param {any} member
 * @param {LevelPlan} plan
 * @param {Record<string, number>} [picks]
 * @returns {Record<string, number>}
 */
export function buildLevelUpPatch(member, plan, picks = {}) {
    /** @type {Record<string, number>} */
    const patch = {
        level: plan.to,
        maxHp: Math.max(1, (Number(member?.maxHp) || 0) + plan.hpGained),
    };

    // Los puntos nuevos se cobran también en la vida actual: subir de nivel no cura, pero
    // tampoco deja al personaje con un máximo que nunca tuvo.
    patch.hp = Math.max(0, Number(member?.hp) || 0) + plan.hpGained;
    if (plan.xpNext != null) patch.xpNext = plan.xpNext;

    for (const [ability, value] of Object.entries(picks ?? {})) {
        if (!ABILITIES.includes(ability)) continue;
        const points = Math.max(0, Math.floor(Number(value) || 0));
        if (points === 0) continue;
        patch[ability] = Math.min(ABILITY_CAP, (Number(member?.[ability]) || 10) + points);
    }

    return patch;
}

/**
 * El plan en palabras, para el registro y para la tarjeta.
 *
 * @param {any} member
 * @param {LevelPlan} plan
 * @returns {string}
 */
export function describeLevelUp(member, plan) {
    if (!plan.canLevel) return `${member?.name ?? 'Nadie'}: ${plan.reason}`;

    const parts = [
        `${member?.name ?? 'Alguien'} sube al nivel ${plan.to}`,
        `+${plan.hpGained} PG`,
        `+${plan.hitDiceGained} dado(s) de golpe`,
    ];
    if (plan.abilityPicks > 0) parts.push(`${plan.pointsToSpend} punto(s) de característica`);
    return `${parts.join(' · ')}.`;
}
