/**
 * Salir de una pelea hablando (J8.5 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * En combate ya se podía pedir tregua solo si la pedían ellos (`morale-options.js`), o huir
 * pagando el golpe al darse la vuelta (`retreat.js`). Faltaba lo que se hace en cualquier mesa
 * cuando la pelea se tuerce, o cuando nunca debió empezar: **hablar en mitad de ella**. Cuatro
 * formas, y cada una con su consecuencia:
 *
 * - **Entregarse**: se tiran las armas. Se acaba la pelea, pero os llevan: os quitan la bolsa,
 *   perdéis un día atados y se sabe. A las bestias y a los muertos no se les rinde nadie.
 * - **Sobornar**: oro a cambio de que se vayan. Lo que piden, según quién queda en pie; si se
 *   regatea mal, no lo cogen y se sigue.
 * - **Convencer**: que no merece la pena. A medias, dudan: una ronda sin atacar.
 * - **Engañar**: que vienen refuerzos, que su jefe ha huido. Si cuela, se van; pero cuando se
 *   enteren, os la guardarán. Si no cuela, se enfadan.
 *
 * Lo difícil depende de **cómo va la pelea**, como en la moral de siempre: con la mitad de los
 * suyos en el suelo o su jefe caído, escuchan; con un jefe en pie, no tanto. El panel lo dice.
 *
 * Intentarlo gasta la acción de quien habla, y cada forma se intenta una vez por pelea.
 * Ganar así da el tablero, pero **sin botín**: lo que llevan, se lo llevan.
 *
 * Lo que un tablero puede escribir para su pelea (`parley`), como en la posada de 1387:
 *
 *     "parley": {
 *       "leader": "Alguacil Torres",
 *       "entregarse": { "text": "Soltar la espada", "success": { "text": "…", "effects": [...] }, "resolves": true },
 *       "sobornar": { "gold": 5, "text": "…", "success": "…", "failure": "…" },
 *       "convencer": { "dc": 14, "text": "…", "success": "…" },
 *       "engañar": { "dc": 13, "text": "…", "success": "…" },
 *       "no": ["entregarse"] }
 *
 * Puro, con el dado inyectado.
 */

import { rollCheck, SKILLS } from '../rules/checks.js';
import { outcomeOf } from '../campaign/consequences.js';
import { resolveGender } from '../campaign/grammar.js';
import {
    mindOf, leaderOf, readBranch, readExitEffects, rollerFor, skillOf, rollFormula, AVOID_DC_LIMITS, EXIT_EFFECT_KINDS,
} from './avoid-fight.js';

/** Las cuatro formas, con su habilidad y lo que le parece al grupo (`approval.js`). */
export const PARLEY_WAYS = {
    entregarse: { label: 'Entregarse', icon: 'fa-hands-bound', skill: '', judge: 'retirada' },
    sobornar: { label: 'Sobornar', icon: 'fa-coins', skill: 'persuasion', judge: 'pagar' },
    convencer: { label: 'Convencer', icon: 'fa-handshake', skill: 'persuasion', judge: 'hito-hablando' },
    enganar: { label: 'Engañar', icon: 'fa-mask', skill: 'deception', judge: 'hito-maña' },
};

/** La CD de cada una con la pelea igualada, antes de lo que diga cómo va. */
export const PARLEY_BASE_DC = { sobornar: 12, convencer: 15, enganar: 14 };

/** Lo que suben o bajan la CD las cosas de la pelea. */
export const MORALE_SHIFTS = { halfDown: -3, leaderDown: -2, allHurt: -2, bossStanding: 4, partyLosing: 2 };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** El nombre sin el número que le pone el combate. */
const bareName = (/** @type {any} */ name) => text(name).replace(/\s+\d+$/, '');

/**
 * La forma, venga como venga escrita.
 *
 * @param {any} raw
 * @returns {'entregarse'|'sobornar'|'convencer'|'enganar'|''}
 */
export function wayOf(raw) {
    const said = fold(raw);
    if (said in PARLEY_WAYS) return /** @type {any} */ (said);
    /** @type {Record<string, string>} */
    const aliases = { rendirse: 'entregarse', surrender: 'entregarse', pagar: 'sobornar', bribe: 'sobornar', persuadir: 'convencer', convince: 'convencer', deceive: 'enganar', mentir: 'enganar' };
    return /** @type {any} */ (aliases[said] ?? '');
}

/**
 * @typedef {Object} ParleyWay Lo escrito para una forma en un tablero.
 * @property {string} text Lo que se dice o se hace.
 * @property {string} skill
 * @property {number|null} dc La CD base escrita; sin ella, la de siempre.
 * @property {number|null} gold Lo que piden (sobornar).
 * @property {boolean|null} resolves Si ganar así cuenta como pasar el tablero.
 * @property {import('./avoid-fight.js').ExitBranch|null} success
 * @property {import('./avoid-fight.js').ExitBranch|null} partial
 * @property {import('./avoid-fight.js').ExitBranch|null} failure
 */

/**
 * @typedef {Object} Parley
 * @property {string} leader Quien manda, si se escribe.
 * @property {Record<string, ParleyWay>} ways
 * @property {string[]} no Las que no se pueden en esta pelea.
 */

/**
 * Lo que un tablero escribe para hablar en su pelea.
 *
 * @param {any} raw
 * @returns {Parley}
 */
export function readParley(raw) {
    const source = isObject(raw) ? raw : {};
    /** @type {Record<string, ParleyWay>} */
    const ways = {};
    for (const [key, value] of Object.entries(source)) {
        const way = wayOf(key);
        if (!way || !isObject(value)) continue;
        const dc = Number(value.dc);
        const gold = Number(value.gold);
        ways[way] = {
            text: text(value.text),
            skill: skillOf(value.skill) || PARLEY_WAYS[way].skill,
            dc: Number.isFinite(dc) && dc > 0 ? Math.max(AVOID_DC_LIMITS.min, Math.min(AVOID_DC_LIMITS.max, Math.round(dc))) : null,
            gold: Number.isFinite(gold) && gold > 0 ? Math.round(gold) : null,
            resolves: typeof value.resolves === 'boolean' ? value.resolves : null,
            success: value.success == null ? null : readBranch(value.success),
            partial: value.partial == null ? null : readBranch(value.partial),
            failure: value.failure == null ? null : readBranch(value.failure),
        };
    }
    const no = (Array.isArray(source.no) ? source.no : []).map(wayOf).filter(Boolean);
    return { leader: text(source.leader), ways, no };
}

/**
 * @typedef {Object} Foe Un enemigo del combate.
 * @property {string} name
 * @property {number} [hp] O `currentHp`.
 * @property {number} [currentHp]
 * @property {number} [maxHp]
 * @property {number} [cr]
 * @property {boolean} [boss]
 * @property {string} [role]
 * @property {boolean} [surrendered]
 * @property {boolean} [fled]
 * @property {string} [mind]
 */

/** @param {Foe} foe @returns {number} */
const hpOf = (foe) => Number(foe?.currentHp ?? foe?.hp) || 0;

/** @param {Foe[]} foes @returns {Foe[]} */
export function standingFoes(foes) {
    return (Array.isArray(foes) ? foes : []).filter(f => hpOf(f) > 0 && !f.surrendered && !f.fled);
}

/**
 * Quien manda en la pelea (el escrito, o el de más desafío de todos, caído o no) y quien habla
 * por ellos ahora: el mismo si sigue en pie, y si no, el que más vale de los que quedan.
 *
 * @param {Parley} parley
 * @param {Foe[]} enemies
 * @returns {{chief: string, leader: string}}
 */
function leadersOf(parley, enemies) {
    const standing = standingFoes(enemies);
    const chief = parley.leader || leaderOf(enemies);
    const up = standing.some(f => bareName(f.name) === chief);
    return { chief, leader: up ? chief : (leaderOf(standing) || chief) };
}

/**
 * Cómo va la pelea para ellos: cuánto suben o bajan las CD, y por qué, en llano.
 *
 * @param {Object} input
 * @param {Foe[]} input.enemies Todos los del combate, caídos incluidos.
 * @param {any[]} [input.party]
 * @param {string} [input.leader]
 * @returns {{shift: number, reasons: Array<{text: string, shift: number}>}}
 */
export function moraleOf({ enemies, party = [], leader = '' }) {
    const all = Array.isArray(enemies) ? enemies : [];
    const standing = standingFoes(all);
    /** @type {Array<{text: string, shift: number}>} */
    const reasons = [];
    const down = all.length - standing.length;
    if (all.length > 0 && down * 2 >= all.length) reasons.push({ text: 'La mitad de los suyos ya no pelea', shift: MORALE_SHIFTS.halfDown });
    const boss = standing.find(f => f.boss);
    const chief = all.find(f => f.role === 'lider' || (leader && bareName(f.name) === leader));
    if (chief && !standing.includes(chief)) reasons.push({ text: `${bareName(chief.name)} ha caído`, shift: MORALE_SHIFTS.leaderDown });
    if (standing.length > 0 && standing.every(f => hpOf(f) * 2 < (Number(f.maxHp) || 1))) {
        reasons.push({ text: 'Los que quedan sangran', shift: MORALE_SHIFTS.allHurt });
    }
    if (boss) reasons.push({ text: `${bareName(boss.name)} sigue en pie`, shift: MORALE_SHIFTS.bossStanding });
    const mine = (Array.isArray(party) ? party : []).filter(m => !m?.dead);
    const hurt = mine.filter(m => (Number(m.hp) || 0) * 2 < (Number(m.maxHp) || 1));
    if (mine.length > 0 && hurt.length * 2 >= mine.length) reasons.push({ text: 'Os ven flojos', shift: MORALE_SHIFTS.partyLosing });
    return { shift: reasons.reduce((sum, r) => sum + r.shift, 0), reasons };
}

/**
 * Lo que piden por irse los que quedan en pie.
 *
 * @param {Foe[]} enemies
 * @returns {number}
 */
export function bribePrice(enemies) {
    const standing = standingFoes(enemies);
    const base = standing.reduce((sum, f) => sum + Math.max(2, Math.round((Number(f.cr) || 0) * 10)), 0);
    return Math.max(2, standing.some(f => f.boss) ? base * 2 : base);
}

/** Lo que se dice sin nada escrito. */
const DEFAULT_TEXT = {
    entregarse: 'Tirar las armas y levantar las manos',
    sobornar: 'Ofrecerles oro para que se vayan',
    convencer: 'Decirles que esta pelea no les compensa',
    enganar: 'Gritar que vienen refuerzos detrás de vosotros',
};

/** Lo que pasa sin nada escrito. */
const DEFAULT_RESULT = {
    entregarse: {
        success: '{leader} acepta. Os atan las manos, os quitan la bolsa y os tienen un día entero a pan y agua antes de soltaros.',
    },
    sobornar: {
        success: '{leader} coge el oro, lo sopesa y hace una seña a los suyos: se van.',
        partial: '{leader} regatea con el arma en alto hasta sacaros más, pero se van.',
        failure: '{leader} escupe al suelo: «¿Crees que nos vendemos?». Siguen.',
    },
    convencer: {
        success: '{leader} baja el arma. Los suyos se retiran sin dar la espalda.',
        partial: 'Dudan. Se miran entre ellos y, esta ronda, no atacan.',
        failure: '{leader} no quiere oír nada. Has perdido el aliento.',
    },
    enganar: {
        success: '{leader} mira detrás de vosotros, duda y da la orden: se van a toda prisa.',
        partial: 'Se giran a mirar. Esta ronda, no atacan.',
        failure: '{leader} no se lo traga y se enfada: ahora van a por quien ha mentido.',
    },
};

/**
 * Lo que pasa al entregarse, sin nada escrito: os quitan la bolsa, un día atados y se sabe.
 *
 * @param {number} gold
 * @returns {import('./avoid-fight.js').ExitEffect[]}
 */
export function surrenderCost(gold) {
    /** @type {import('./avoid-fight.js').ExitEffect[]} */
    const out = [];
    if (gold > 0) out.push({ kind: 'gold', amount: -Math.round(gold) });
    out.push({ kind: 'days', amount: 1 }, { kind: 'fame', amount: -1 });
    return out;
}

/**
 * @typedef {Object} ParleyChip Una forma, como se ve en el panel.
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} text Lo que se dice.
 * @property {string} check «Persuasión · CD 12», o vacío.
 * @property {string} who «Habla Bran (+5)».
 * @property {string} cost «Piden 20 de oro», «Os quitan la bolsa y un día».
 * @property {string} win Lo que se gana si sale.
 * @property {string} locked Por qué no, o vacío.
 * @property {number} dc
 */

/**
 * La CD de una forma ahora mismo.
 *
 * @param {string} way
 * @param {Parley} parley
 * @param {number} shift
 * @returns {number}
 */
function dcFor(way, parley, shift) {
    const base = parley.ways[way]?.dc ?? /** @type {Record<string, number>} */ (PARLEY_BASE_DC)[way] ?? 15;
    return Math.max(AVOID_DC_LIMITS.min, Math.min(25, base + shift));
}

/**
 * Las cuatro formas, como se ven ahora: lo que se dice, quién habla, contra cuánto, lo que
 * cuesta y, si no se puede, por qué.
 *
 * @param {Object} input
 * @param {Foe[]} input.enemies Todos los del combate.
 * @param {any[]} input.party
 * @param {number} [input.gold]
 * @param {any} [input.parley] Lo escrito en el tablero (sin leer o leído).
 * @param {string[]} [input.tried] Las ya intentadas en esta pelea.
 * @param {any} [input.speakerId] Quien habla (el del turno).
 * @param {any} [input.hero] Para el género de lo escrito.
 * @returns {{leader: string, morale: ReturnType<typeof moraleOf>, chips: ParleyChip[]}}
 */
export function parleyChips({ enemies, party, gold = 0, parley = null, tried = [], speakerId = null, hero = null }) {
    const able = (Array.isArray(party) ? party : []).filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0);
    const who = { heroe: hero ?? able[0] ?? null, grupo: able };
    const read = parley && isObject(parley) && 'ways' in parley ? /** @type {Parley} */ (parley) : readParley(parley);
    const standing = standingFoes(enemies);
    const { chief, leader } = leadersOf(read, enemies);
    const morale = moraleOf({ enemies, party, leader: chief });
    const done = new Set((tried ?? []).map(wayOf));
    const minds = new Set(standing.map(f => mindOf(f)));
    const talkers = minds.has('gente');
    const beasts = minds.has('bestia');
    const bossUp = standing.some(f => f.boss);
    const price = read.ways.sobornar?.gold ?? bribePrice(enemies);

    const chips = /** @type {Array<keyof typeof PARLEY_WAYS>} */ (Object.keys(PARLEY_WAYS)).map(way => {
        const spec = PARLEY_WAYS[way];
        const written = read.ways[way];
        const skill = written?.skill ?? spec.skill;
        const dc = dcFor(way, read, morale.shift);
        let locked = '';
        if (standing.length === 0) locked = 'No queda nadie con quien hablar.';
        else if (read.no.includes(way)) locked = 'Aquí no: no hay trato posible.';
        else if (done.has(way)) locked = 'Ya lo habéis intentado en esta pelea.';
        else if (!talkers && !written) locked = beasts ? 'Las bestias no entienden de tratos.' : 'Esto no escucha: no piensa, solo ataca.';
        else if (way === 'entregarse' && bossUp && !written) locked = `${bareName(standing.find(f => f.boss)?.name)} no quiere presos.`;
        else if (way === 'sobornar' && gold < price) locked = `Piden ${price} de oro y tenéis ${Math.max(0, gold)}.`;
        let who = '';
        if (skill) {
            const roller = rollerFor(party, skill, { speakerId });
            if (roller) who = `Habla ${roller.member.name} (${roller.modifier >= 0 ? '+' : ''}${roller.modifier})`;
        }
        const resolves = written?.resolves ?? way !== 'entregarse';
        return {
            id: way,
            label: spec.label,
            icon: spec.icon,
            text: resolveGender(written?.text || DEFAULT_TEXT[way], who),
            check: skill ? `${SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill} · CD ${dc}` : '',
            who,
            cost: way === 'sobornar' ? `Piden ${price} de oro`
                : way === 'entregarse' ? (written?.success?.effects.length ? 'Os rendís: lo que pase, pasa' : 'Os quitan la bolsa y perdéis un día')
                    : way === 'enganar' ? 'Si cuela, os la guardarán' : '',
            win: way === 'entregarse'
                ? (resolves ? 'Se acaba la pelea y la historia sigue' : 'Se acaba la pelea, pero la perdéis')
                : 'Si sale, se van: la pelea es vuestra, sin botín',
            locked,
            dc,
        };
    });
    return { leader, morale, chips };
}

/**
 * @typedef {Object} ParleyResult
 * @property {string} way
 * @property {'bien'|'medias'|'mal'} outcome
 * @property {import('./avoid-fight.js').ExitRoll[]} rolls
 * @property {'ended'|'captured'|'lull'|'continue'|'enraged'} ends
 *   `ended`: se van y ganáis sin botín; `captured`: os rendís; `lull`: esta ronda no atacan;
 *   `continue`: no pasa nada (se pierde la acción); `enraged`: van a por quien mintió.
 * @property {boolean} resolves Si el tablero cuenta como pasado para la historia.
 * @property {boolean} costsAction Si gasta la acción de quien habla.
 * @property {import('./avoid-fight.js').ExitEffect[]} effects
 * @property {string[]} lines
 * @property {string} judge
 * @property {string} speaker
 * @property {string} leader
 */

/**
 * Intentar una forma: tirar y decir lo que pasa.
 *
 * @param {Object} input
 * @param {string} input.way
 * @param {Foe[]} input.enemies
 * @param {any[]} input.party
 * @param {number} [input.gold]
 * @param {any} [input.parley]
 * @param {() => number} input.rollD20
 * @param {(sides: number) => number} [input.rollDie]
 * @param {any} [input.speakerId]
 * @param {any} [input.hero]
 * @returns {ParleyResult}
 */
export function resolveParley({ way: rawWay, enemies, party, gold = 0, parley = null, rollD20, rollDie, speakerId = null, hero = null }) {
    const way = wayOf(rawWay) || 'convencer';
    const read = parley && isObject(parley) && 'ways' in parley ? /** @type {Parley} */ (parley) : readParley(parley);
    const { chief, leader: voice } = leadersOf(read, enemies);
    const leader = voice || 'Quien manda';
    const morale = moraleOf({ enemies, party, leader: chief });
    const written = read.ways[way] ?? null;
    const spec = PARLEY_WAYS[way];
    const skill = written?.skill ?? spec.skill;
    const die = rollDie ?? ((/** @type {number} */ sides) => 1 + Math.floor(Math.random() * sides));
    const able = (Array.isArray(party) ? party : []).filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0);
    const who = { heroe: hero ?? able[0] ?? null, grupo: able };
    const say = (/** @type {string} */ line) => resolveGender(line, who).replace(/\{leader\}/g, leader);
    const defaults = /** @type {Record<string, string>} */ (DEFAULT_RESULT[way]);

    if (way === 'entregarse') {
        const branch = written?.success ?? null;
        const effects = branch && branch.effects.length > 0 ? branch.effects : surrenderCost(gold);
        const resolves = written?.resolves ?? false;
        return {
            way, outcome: 'bien', rolls: [], ends: 'captured', resolves, costsAction: false,
            effects, lines: [say(branch?.text || defaults.success)], judge: spec.judge, speaker: text(able[0]?.name), leader,
        };
    }

    const picked = rollerFor(party, skill, { speakerId });
    const dc = dcFor(way, read, morale.shift);
    const roll = picked ? rollCheck({ member: picked.member, skill, rollD20, dc }) : null;
    const speaker = text(picked?.member?.name);
    /** @type {import('./avoid-fight.js').ExitRoll[]} */
    const rolls = roll ? [{ who: speaker, said: roll.said, natural: roll.natural, total: roll.total, dc: roll.dc, success: roll.success }] : [];
    const price = written?.gold ?? bribePrice(enemies);
    /** @type {'bien'|'medias'|'mal'} */
    let outcome = roll ? outcomeOf(roll) : 'mal';
    if (way === 'sobornar' && gold < price) outcome = 'mal';

    /** @type {import('./avoid-fight.js').ExitEffect[]} */
    const effects = [];
    /** @type {ParleyResult['ends']} */
    let ends = 'continue';
    let line = '';
    if (outcome === 'bien' || (outcome === 'medias' && way === 'sobornar')) {
        const branch = outcome === 'medias' ? (written?.partial ?? null) : (written?.success ?? null);
        effects.push(...(branch?.effects ?? []));
        if (way === 'sobornar') {
            const paid = outcome === 'medias' ? Math.min(Math.max(price, gold), Math.ceil(price * 1.5)) : price;
            effects.unshift({ kind: 'gold', amount: -paid });
        }
        if (way === 'enganar' && !effects.some(e => e.kind === 'grudge')) effects.push({ kind: 'grudge', who: leader });
        ends = 'ended';
        line = branch?.text || (outcome === 'medias' ? defaults.partial : defaults.success);
    } else if (outcome === 'medias') {
        const branch = written?.partial ?? null;
        effects.push(...(branch?.effects ?? []));
        ends = 'lull';
        line = branch?.text || defaults.partial;
    } else {
        const branch = written?.failure ?? null;
        effects.push(...(branch?.effects ?? []));
        ends = way === 'enganar' ? 'enraged' : 'continue';
        line = branch?.text || defaults.failure;
    }
    for (const effect of effects) {
        if (effect.kind === 'hurt' && effect.amount == null) effect.amount = rollFormula(effect.dice || '1d4', die);
    }
    const resolves = ends === 'ended' && (written?.resolves ?? true);
    return {
        way, outcome, rolls, ends, resolves, costsAction: true, effects,
        lines: [...rolls.map(r => r.said), say(line)], judge: ends === 'ended' ? spec.judge : '', speaker, leader,
    };
}

/**
 * Lo escrito en `parley`, comprobado para el importador.
 *
 * @param {any} raw
 * @param {{path?: string}} [context]
 * @returns {{errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>}}
 */
export function checkParley(raw, { path = 'parley' } = {}) {
    /** @type {Array<{path: string, message: string}>} */
    const errors = [];
    /** @type {Array<{path: string, message: string}>} */
    const warnings = [];
    if (raw === undefined) return { errors, warnings };
    if (!isObject(raw)) {
        errors.push({ path, message: '`parley` es un objeto: { "convencer": { … }, "sobornar": { … } }.' });
        return { errors, warnings };
    }
    for (const [key, value] of Object.entries(raw)) {
        if (key === 'leader') continue;
        if (key === 'no') {
            const bad = (Array.isArray(value) ? value : [value]).filter(v => !wayOf(v));
            if (bad.length > 0) errors.push({ path: `${path}.no`, message: `No son formas: ${bad.join(', ')}. Valen entregarse, sobornar, convencer y engañar.` });
            continue;
        }
        const way = wayOf(key);
        if (!way) {
            errors.push({ path: `${path}.${key}`, message: `«${key}» no es una forma: entregarse, sobornar, convencer o engañar.` });
            continue;
        }
        if (!isObject(value)) {
            errors.push({ path: `${path}.${key}`, message: 'Cada forma es un objeto: { "text": "…", "success": "…" }.' });
            continue;
        }
        if (value.skill !== undefined && !skillOf(value.skill)) {
            errors.push({ path: `${path}.${key}.skill`, message: `«${text(value.skill)}» no es una habilidad.` });
        }
        for (const branchKey of ['success', 'partial', 'failure']) {
            const branch = value[branchKey];
            if (!isObject(branch)) continue;
            readExitEffects(branch.effects).forEach((effect, i) => {
                if (effect.kind === 'unknown') {
                    errors.push({ path: `${path}.${key}.${branchKey}.effects[${i}]`, message: `No se entiende el efecto. Valen: ${EXIT_EFFECT_KINDS.join(', ')}.` });
                }
            });
        }
    }
    return { errors, warnings };
}
