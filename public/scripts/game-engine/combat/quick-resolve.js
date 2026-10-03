/**
 * E7.2 de wiki/ROADMAP_ENTRETENIDO.md, «Resolver rápido»: las peleas que son claramente vuestras
 * (dos ratas contra un grupo de nivel 5) no se juegan golpe a golpe.
 *
 * Aquí solo se decide **si se ofrece**. La pelea, si se elige, la juega el motor de siempre con
 * todos los del grupo en manos del juego y sin enseñar los golpes (`party/friction.js`): los PG que
 * se pierden, los conjuros que se gastan, el botín y la experiencia son los de verdad.
 *
 * Se ofrece solo si se cumplen las dos cosas:
 *
 * 1. **El presupuesto de 2024.** La Guía del Dungeon Master (2024) da a cada personaje un
 *    presupuesto de PX por encuentro (bajo, moderado, alto). Si lo que valen los enemigos no
 *    llega a la mitad del presupuesto *bajo* del grupo, la pelea queda muy por debajo de lo que
 *    el grupo aguanta.
 * 2. **La cuenta de servilleta** (`quick-sim.js`), con el grupo de verdad: su vida de ahora, su
 *    CA, su arma y su puntería, contra los enemigos del tablero. Se gana casi siempre y cuesta
 *    poco. El grupo va sin curas ni conjuros de área en la cuenta: si así sale fácil, lo es.
 *
 * Y nunca para una pelea que cuenta en la historia: la que pide el hilo, la de una misión con
 * otra forma de ganar, la de refuerzos o la de alguien a quien proteger, una pelea sin muertes,
 * ni contra un jefe o una némesis. Esas se juegan.
 *
 * Puro: decide con números. No empieza ni aplica nada.
 */

import { createSeededRandom } from './seeded-random.js';
import { simulateFight, simEnemies } from './quick-sim.js';
import { xpForChallenge } from './loot.js';
import { proficiencyBonus } from '../rules/checks.js';
import { weaponOf, weaponBonus } from '../rules/equipment.js';

/**
 * El presupuesto de PX por personaje de la Guía del Dungeon Master (2024), por nivel: bajo,
 * moderado y alto.
 */
export const XP_BUDGET_2024 = {
    1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100],
    6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100],
    11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
    16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
};

/** Lo que tiene que quedarse por debajo: esta parte del presupuesto bajo del grupo. */
export const TRIVIAL_SHARE = 0.5;

/** Cuántas peleas se cuentan para decidir. */
export const QUICK_RUNS = 120;

/** Lo mínimo que se gana y lo máximo que se pierde de vida, de media, para ofrecerlo. */
export const QUICK_LIMITS = { winRate: 0.98, hpLost: 0.2, down: 0.05 };

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {number} score @returns {number} */
const modOf = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/**
 * El presupuesto bajo de 2024 de un grupo: la suma del de cada uno, por su nivel.
 *
 * @param {Array<{level?: number}>} members
 * @returns {number}
 */
export function lowBudget(members) {
    return (Array.isArray(members) ? members : []).reduce((sum, member) => {
        const level = Math.max(1, Math.min(20, Math.floor(num(member?.level) || 1)));
        return sum + XP_BUDGET_2024[/** @type {keyof typeof XP_BUDGET_2024} */ (level)][0];
    }, 0);
}

/**
 * Lo que valen los enemigos en PX (la tabla de desafío de siempre, `loot.js`).
 *
 * @param {Array<{cr?: number}>} foes
 * @returns {number}
 */
export function foesXp(foes) {
    return (Array.isArray(foes) ? foes : []).reduce((sum, foe) => sum + xpForChallenge(num(foe?.cr)), 0);
}

/**
 * Alguien del grupo, como lo cuenta la simulación: su vida de ahora (como si fuera la entera:
 * la cuenta no cura), su CA, su puntería con lo que empuña y el dado de su arma.
 *
 * @param {any} member
 * @returns {import('./quick-sim.js').SimFighter}
 */
export function simFighterOf(member) {
    const weapon = weaponOf(member);
    const level = Math.max(1, Math.floor(num(member?.level) || 1));
    const range = num(weapon?.rangeFeet ?? weapon?.range);
    const strength = modOf(member?.strength);
    const dexterity = modOf(member?.dexterity);
    const ability = range > 5 ? dexterity : Math.max(strength, dexterity);
    const bonus = weaponBonus(member);
    const hp = Math.max(1, Math.round(num(member?.hp)));
    return {
        name: text(member?.name) || '?',
        // Sin papel de cura ni de mago: la cuenta no gasta conjuros (se queda corta, no larga).
        role: 'guerrero',
        maxHp: hp,
        hp,
        ac: Math.max(8, Math.round(num(member?.armorClass) || 10)),
        attack: ability + proficiencyBonus(level) + bonus,
        damage: text(weapon?.damageDice) || '1d6',
        damageBonus: Math.max(0, ability) + bonus,
        attacks: 1,
        initiative: dexterity,
        reach: range > 5 ? range : 5,
    };
}

/**
 * @typedef {Object} QuickBlockers Lo que hace que una pelea se juegue sí o sí.
 * @property {boolean} [story] La pide el hilo de la campaña.
 * @property {boolean} [scenario] Se gana de otra forma (escapar, aguantar, proteger…).
 * @property {boolean} [waves] Trae refuerzos.
 * @property {boolean} [ward] Hay alguien a quien proteger.
 * @property {boolean} [brawl] Es una pelea sin muertes (taberna, duelo).
 * @property {boolean} [nemesis] Hay una némesis.
 */

/**
 * @typedef {Object} QuickOffer
 * @property {boolean} offer Si se ofrece «Resolver rápido».
 * @property {string} reason Por qué no, si no (para las pruebas y la consola).
 * @property {number} xp Lo que valen los enemigos.
 * @property {number} budget La mitad del presupuesto bajo del grupo.
 * @property {number} winRate
 * @property {number} hpLost De 0 a 1, de media.
 * @property {string} said La línea de la ficha: lo que va a costar, más o menos.
 */

/**
 * Si se ofrece «Resolver rápido» antes de esta pelea.
 *
 * @param {Object} input
 * @param {any[]} input.party Los del grupo que pelean (vivos, en pie).
 * @param {any[]} input.foes Los enemigos, con su ficha del mundo (`cr`, `hp`/`maxHp`, `armorClass`, `boss`…).
 * @param {QuickBlockers} [input.blockers]
 * @param {string} [input.seed]
 * @param {number} [input.runs]
 * @returns {QuickOffer}
 */
export function quickResolveOffer({ party, foes, blockers = {}, seed = '', runs = QUICK_RUNS }) {
    const members = (Array.isArray(party) ? party : []).filter(m => m && !m.dead && num(m.hp) > 0);
    const list = Array.isArray(foes) ? foes.filter(Boolean) : [];
    const xp = foesXp(list);
    const budget = Math.floor(lowBudget(members) * TRIVIAL_SHARE);
    /** @type {QuickOffer} */
    const no = { offer: false, reason: '', xp, budget, winRate: 0, hpLost: 1, said: '' };
    if (members.length === 0) return { ...no, reason: 'Nadie en pie.' };
    if (list.length === 0) return { ...no, reason: 'Nadie contra quien pelear.' };
    const why = blockers.story ? 'La pide la historia.'
        : blockers.scenario ? 'Se gana de otra forma.'
            : blockers.waves ? 'Trae refuerzos.'
                : blockers.ward ? 'Hay alguien a quien proteger.'
                    : blockers.brawl ? 'Es una pelea sin muertes.'
                        : blockers.nemesis ? 'Hay una némesis.'
                            : list.some(f => f.boss) ? 'Hay un jefe.' : '';
    if (why) return { ...no, reason: why };
    if (xp > budget) return { ...no, reason: `Valen ${xp} PX: más de la mitad del presupuesto bajo (${budget}).` };

    // Los enemigos como los cuenta la simulación, con sus números de la ficha del mundo.
    const bestiary = list.map(f => ({
        name: text(f.name), cr: num(f.cr), hp: num(f.maxHp ?? f.hp), armorClass: num(f.armorClass ?? f.ac),
        strength: num(f.strength) || 10, dexterity: num(f.dexterity) || 10, attackRangeFeet: num(f.attackRangeFeet) || 5,
    }));
    const { foes: simmed } = simEnemies(list.map(f => ({ name: text(f.name) })), bestiary);
    // El ajuste de nivel del tablero (D-J56), si lo lleva: la puntería y el daño de más.
    const fighters = simmed.map((fighter, i) => ({
        ...fighter,
        attack: fighter.attack + num(list[i]?.levelHit),
        damageBonus: Math.max(0, fighter.damageBonus + num(list[i]?.levelDamage)),
    }));
    const team = members.map(simFighterOf);
    const random = createSeededRandom(`${seed}|rapido|${list.map(f => text(f.name)).join(',')}`);
    const total = Math.max(1, Math.floor(num(runs) || QUICK_RUNS));
    let wins = 0;
    let hpLost = 0;
    let down = 0;
    for (let i = 0; i < total; i++) {
        const fight = simulateFight(team, fighters, random);
        if (fight.won) wins++;
        hpLost += fight.hpLost;
        down += fight.down;
    }
    const stats = { winRate: wins / total, hpLost: hpLost / total, down: down / total };
    if (stats.winRate < QUICK_LIMITS.winRate) return { ...no, ...stats, reason: `Se gana ${Math.round(stats.winRate * 100)} de cada 100: no es tan fácil.` };
    if (stats.hpLost > QUICK_LIMITS.hpLost || stats.down > QUICK_LIMITS.down) return { ...no, ...stats, reason: 'Cuesta demasiada vida para resolverla sin mirar.' };
    const lost = Math.round(stats.hpLost * 100);
    return {
        offer: true,
        reason: '',
        xp,
        budget,
        ...stats,
        said: lost <= 2 ? 'Apenas un rasguño' : `Unos pocos PG (en torno a un ${lost} % de la vida)`,
    };
}
