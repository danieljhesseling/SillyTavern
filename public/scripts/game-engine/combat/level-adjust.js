/**
 * El nivel recomendado y el ajuste (J4.6 de ROADMAP_SIN_CONEXION).
 *
 * Una campaña del tablón dice para qué nivel es («Para nivel 1 a 6», en `mundos.json`), y
 * sus tableros están escritos a mano: los mismos enemigos, en las mismas casillas. Pero lo
 * ganado se lleva de una campaña a otra (D-J4), así que un grupo puede llegar a la taberna
 * de Barovia a nivel 8, o a la cripta a nivel 2. Esto mira el tablero y el grupo, y ajusta
 * la pelea **sin cambiarle la cara**:
 *
 * 1. **Para qué nivel es cada tablero.** El tramo de la campaña, repartido entre sus actos:
 *    en Strahd (1 a 6, cinco actos), el acto 1 es para nivel 1 a 2 y el 5, para 5 a 6. Un
 *    tablero sin acto conocido es para todo el tramo.
 * 2. **Cuánto se aparta el grupo**: nada dentro del tramo; fuera, los niveles que le faltan
 *    o le sobran hasta el borde.
 * 3. **El ajuste, con tope**: la vida (hasta ×1,35, D-J21), la puntería y el daño; y desde dos
 *    niveles de diferencia, un esbirro de más o de menos, solo si cabe en el presupuesto del
 *    encuentro (`board-intent.js`). Los jefes no se quitan nunca, y el tablero no se queda sin
 *    ninguno de los que tenía: solo se quita la copia de uno repetido. Y no se copia a nadie
 *    con CA 15 o más (D-J21): con nivel 8, la Entrada a Ravenloft llegó a durar 20 rondas.
 *
 * Puro: quien llama lo aplica y lo dice.
 */

import { budgetFor, threatOf } from '../world-builder/board-intent.js';
import { isPassable } from '../board/terrain.js';

/**
 * Los topes del ajuste, hacia abajo y hacia arriba. Un grupo de nivel 1 en la cripta de
 * Strahd no la gana porque el vampiro tenga poca vida; y uno de nivel 9 en la taberna no
 * tiene por qué sudar como en la cripta. Se ajusta, no se reescribe.
 */
export const LEVEL_LIMITS = {
    /** Por cuánto se multiplica la vida (D-J21: hasta ×1,35; con ×1,5 las peleas no acababan). */
    hp: { min: 0.7, max: 1.35 },
    /** Lo que se suma a la tirada de ataque. */
    hit: { min: -2, max: 2 },
    /** Lo que se suma a cada golpe. */
    damage: { min: -2, max: 3 },
    /** Esbirros de más (o de menos, en negativo). */
    minions: { min: -1, max: 2 },
};

/** Lo que mueve cada nivel de diferencia en la vida. */
const HP_PER_LEVEL = 0.12;

/**
 * D-J21: desde esta CA no se añade ninguna copia. Un enemigo acorazado de más no es un
 * esbirro: es media pelea más, golpe a golpe fallado.
 */
export const NO_COPY_AC = 15;

/** Hasta dónde se busca sitio para un esbirro de más, en casillas desde uno de los suyos. */
const NEAR = 3;

/**
 * @typedef {Object} LevelPlan
 * @property {number} min El nivel más bajo para el que es la campaña.
 * @property {number} max El más alto.
 * @property {number} acts Cuántos actos tiene.
 * @property {Record<string, number>} actOf El acto de cada tablero, por su nombre en minúsculas.
 */

/**
 * @typedef {Object} LevelAdjustment
 * @property {number} steps Los niveles que se aparta el grupo: en negativo, por debajo.
 * @property {number} hpFactor
 * @property {number} hit
 * @property {number} damage
 * @property {number} minions
 */

/** @param {any} value @returns {string} */
const lower = (value) => String(value ?? '').trim().toLowerCase();

/**
 * @param {number} value
 * @param {{min: number, max: number}} limits
 * @returns {number}
 */
const clamp = (value, { min, max }) => Math.min(max, Math.max(min, value)) || 0;

/**
 * El tramo de niveles como lo escribe `mundos.json`: `[1, 6]`. Nulo si no dice ninguno.
 *
 * @param {any} raw
 * @returns {{min: number, max: number}|null}
 */
export function readLevelRange(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const min = Math.floor(Number(raw[0]) || 0);
    if (min < 1) return null;
    const max = Math.max(min, Math.floor(Number(raw[1]) || 0));
    return { min, max };
}

/**
 * El plan de niveles de una campaña: su tramo y el acto de cada tablero, sacado de sus
 * misiones, de los hitos de su hilo y de sus encargos escritos (el más alto, si discrepan).
 *
 * @param {any} meta Los metadatos del mundo, tal y como los guarda la importación.
 * @param {any} levels El tramo de la campaña, de su fila del tablón.
 * @returns {LevelPlan|null} Nulo si la campaña no dice para qué nivel es.
 */
export function levelPlanOf(meta, levels) {
    const range = readLevelRange(levels);
    if (!range) return null;

    /** @type {Record<string, number>} */
    const actOf = {};
    let acts = 1;
    const note = (/** @type {any} */ board, /** @type {any} */ act) => {
        const n = Math.floor(Number(act) || 0);
        if (n < 1) return;
        acts = Math.max(acts, n);
        const name = lower(board);
        if (name) actOf[name] = Math.max(actOf[name] ?? 0, n);
    };
    for (const quest of Array.isArray(meta?.quests) ? meta.quests : []) note(quest?.boardName, quest?.act);
    for (const milestone of Array.isArray(meta?.plot?.milestones) ? meta.plot.milestones : []) {
        note(milestone?.asks?.kind === 'win' ? milestone.asks.board : '', milestone?.act);
    }
    for (const contract of Array.isArray(meta?.writtenContracts) ? meta.writtenContracts : []) note(contract?.boardName, contract?.act);

    return { ...range, acts, actOf };
}

/**
 * Para qué nivel es un tablero: el trozo del tramo que le toca a su acto.
 *
 * @param {LevelPlan} plan
 * @param {string} boardName
 * @returns {{low: number, high: number, act: number}}
 */
export function boardBand(plan, boardName) {
    const act = plan.actOf[lower(boardName)] ?? 0;
    if (!act || plan.acts <= 1) return { low: plan.min, high: plan.max, act };
    const span = (plan.max - plan.min) / plan.acts;
    const k = Math.min(act, plan.acts);
    // El pequeño margen evita que 1 + 3 × 1,0 se quede en 3,9999 y redondee mal.
    const low = Math.max(plan.min, Math.floor(plan.min + (k - 1) * span + 1e-9));
    const high = Math.min(plan.max, Math.max(low, Math.ceil(plan.min + k * span - 1e-9)));
    return { low, high, act };
}

/**
 * El nivel del grupo: la media de los que pelean (los mercenarios cuentan; a quien se
 * escolta no se le cuenta, ni a quien ha muerto).
 *
 * @param {any[]} members
 * @returns {{level: number, size: number}}
 */
export function partyLevelOf(members) {
    const fighters = (Array.isArray(members) ? members : []).filter(m => m && !m.dead && m.guest?.kind !== 'ward');
    if (fighters.length === 0) return { level: 1, size: 0 };
    const sum = fighters.reduce((total, m) => total + Math.max(1, Math.floor(Number(m.level) || 1)), 0);
    return { level: Math.max(1, Math.round(sum / fighters.length)), size: fighters.length };
}

/**
 * Cuánto se aparta el grupo del tramo del tablero: nada dentro; fuera, hasta el borde.
 *
 * @param {number} partyLevel
 * @param {{low: number, high: number}} band
 * @returns {number} En negativo, por debajo.
 */
export function levelGap(partyLevel, band) {
    const level = Math.max(1, Math.floor(Number(partyLevel) || 1));
    if (level < band.low) return level - band.low;
    if (level > band.high) return level - band.high;
    return 0;
}

/**
 * El ajuste para esa diferencia, con sus topes. Cada nivel mueve la vida un 12 %; cada dos,
 * un punto de puntería; cada uno, un punto de daño; y desde dos, un esbirro.
 *
 * @param {number} gap
 * @returns {LevelAdjustment}
 */
export function levelAdjustment(gap) {
    const steps = Math.trunc(Number(gap) || 0);
    let minions = 0;
    if (steps >= 2) minions = Math.floor(steps / 2);
    else if (steps <= -2) minions = -1;
    return {
        steps,
        hpFactor: Math.round(clamp(1 + HP_PER_LEVEL * steps, LEVEL_LIMITS.hp) * 100) / 100,
        hit: clamp(Math.trunc(steps / 2), LEVEL_LIMITS.hit),
        damage: clamp(steps, LEVEL_LIMITS.damage),
        minions: clamp(minions, LEVEL_LIMITS.minions),
    };
}

/**
 * Un enemigo, con el ajuste puesto. La vida se multiplica (la que le queda, en la misma
 * proporción); la puntería y el daño van aparte, en `levelHit` y `levelDamage`, porque el
 * combate los suma a su tirada.
 *
 * @template T
 * @param {T} enemy
 * @param {LevelAdjustment|null} adjustment
 * @returns {T & {levelHit?: number, levelDamage?: number, levelSteps?: number}}
 */
export function adjustEnemy(enemy, adjustment) {
    const base = /** @type {any} */ (enemy) ?? {};
    if (!adjustment || !adjustment.steps) return { ...base };
    const maxHp = Math.max(1, Math.round((Number(base.maxHp) || 1) * adjustment.hpFactor));
    const current = Number(base.currentHp);
    return {
        ...base,
        maxHp,
        currentHp: Number.isFinite(current) ? Math.min(maxHp, Math.max(1, Math.round(current * adjustment.hpFactor))) : maxHp,
        levelHit: adjustment.hit,
        levelDamage: adjustment.damage,
        levelSteps: adjustment.steps,
    };
}

/**
 * Los que salen al empezar la pelea, con un esbirro de más o de menos.
 *
 * El esbirro que se añade es copia del más flojo de los que no son jefe ni llevan CA 15 o
 * más (`NO_COPY_AC`), puesto al lado de uno suyo; y solo si cabe en lo que el grupo tiene de
 * más (la diferencia de presupuesto entre su nivel y el del tablero). Si todos van
 * acorazados, no se añade nadie. El que se quita es la última copia del más flojo que
 * esté repetido, y solo si su amenaza cabe en lo que al grupo le falta: el tablero sigue
 * teniendo a todos los que tenía, y a sus jefes siempre.
 *
 * @param {Object} input
 * @param {Array<{name: string, x: number, y: number}>} input.placements Los que van a salir.
 * @param {LevelAdjustment} input.adjustment
 * @param {any[]} input.bestiary Las fichas del mundo: quién es jefe y cuánto amenaza.
 * @param {number} input.partyLevel
 * @param {number} input.partySize
 * @param {{low: number, high: number}} input.band
 * @param {any} [input.terrain]
 * @param {number} [input.gridWidth]
 * @param {number} [input.gridHeight]
 * @param {Array<{x: number, y: number}>} [input.taken] Casillas ya ocupadas (el grupo, los que duermen).
 * @returns {{placements: Array<{name: string, x: number, y: number}>, added: string[], removed: string[]}}
 */
export function adjustPlacements({
    placements, adjustment, bestiary, partyLevel, partySize, band,
    terrain = null, gridWidth = 50, gridHeight = 50, taken = [],
}) {
    const list = (Array.isArray(placements) ? placements : []).filter(p => p && p.name).map(p => ({ ...p }));
    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const removed = [];
    const want = Math.trunc(Number(adjustment?.minions) || 0);
    if (want === 0 || list.length === 0) return { placements: list, added, removed };

    const rows = new Map((Array.isArray(bestiary) ? bestiary : []).map(row => [lower(row?.name), row]));
    const isBoss = (/** @type {string} */ name) => {
        const row = rows.get(lower(name));
        const tags = (Array.isArray(row?.tags) ? row.tags : []).map(lower);
        return Boolean(row?.boss) || tags.some(t => /jefe|alfa|lider/.test(t));
    };
    const threat = (/** @type {string} */ name) => threatOf(rows.get(lower(name)) ?? {});

    // El presupuesto de más (o de menos) que trae el grupo frente al borde del tramo.
    const edge = want > 0 ? band.high : band.low;
    const slack = Math.abs(budgetFor({ partyLevel, partySize }) - budgetFor({ partyLevel: edge, partySize }));

    // Los que no son jefe, del más flojo al más fuerte (y, a igual amenaza, en el orden del tablero).
    const kinds = [...new Set(list.map(p => p.name))].filter(name => !isBoss(name))
        .sort((a, b) => threat(a) - threat(b));

    if (want < 0) {
        const repeated = kinds.find(name => list.filter(p => p.name === name).length > 1);
        if (repeated && threat(repeated) <= slack) {
            const last = list.map(p => p.name).lastIndexOf(repeated);
            list.splice(last, 1);
            removed.push(repeated);
        }
        return { placements: list, added, removed };
    }

    // D-J21: al acorazado no se le copia. Su CA, en la ficha del mundo o en la plantilla.
    const armour = (/** @type {string} */ name) => {
        const row = rows.get(lower(name));
        return Number(row?.armorClass ?? row?.ac) || 0;
    };
    const minion = kinds.find(name => armour(name) < NO_COPY_AC);
    if (!minion) return { placements: list, added, removed };
    const cost = threat(minion);
    const used = new Set([...(Array.isArray(taken) ? taken : []), ...list]
        .filter(Boolean).map(c => `${Number(c.x) || 0},${Number(c.y) || 0}`));
    const free = (/** @type {number} */ x, /** @type {number} */ y) =>
        !used.has(`${x},${y}`) && (terrain ? isPassable(terrain, x, y, gridWidth, gridHeight) : (x >= 0 && y >= 0 && x < gridWidth && y < gridHeight));

    let spent = 0;
    for (let i = 0; i < want && spent + cost <= slack; i++) {
        const cell = cellNear(list.filter(p => p.name === minion), free);
        if (!cell) break;
        list.push({ name: minion, x: cell.x, y: cell.y });
        used.add(`${cell.x},${cell.y}`);
        added.push(minion);
        spent += cost;
    }
    return { placements: list, added, removed };
}

/**
 * La primera casilla libre junto a uno de los suyos: anillo a anillo, en el mismo orden
 * siempre (con el mismo tablero, el mismo sitio).
 *
 * @param {Array<{x: number, y: number}>} around
 * @param {(x: number, y: number) => boolean} free
 * @returns {{x: number, y: number}|null}
 */
function cellNear(around, free) {
    for (let r = 1; r <= NEAR; r++) {
        for (const origin of around) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = (Number(origin.x) || 0) + dx;
                    const y = (Number(origin.y) || 0) + dy;
                    if (free(x, y)) return { x, y };
                }
            }
        }
    }
    return null;
}

/**
 * Lo que se le dice al jugador, una vez: llano, con el tramo y su nivel.
 *
 * @param {{adjustment: LevelAdjustment, band: {low: number, high: number}, level: number}} input
 * @returns {string} Vacío si no hay nada que decir.
 */
export function levelNote({ adjustment, band, level }) {
    const steps = Number(adjustment?.steps) || 0;
    if (steps === 0) return '';
    const range = band.high > band.low ? `nivel ${band.low} a ${band.high}` : `nivel ${band.low}`;
    const why = `Este tablero es para ${range} y vuestro grupo es de nivel ${level}.`;
    return steps > 0
        ? `Vais por encima de lo que pide la campaña: los enemigos aprietan más. ${why}`
        : `Vais por debajo de lo que pide la campaña: los enemigos aflojan un poco, pero no del todo. ${why}`;
}
