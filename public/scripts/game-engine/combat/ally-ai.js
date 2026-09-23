/**
 * Cómo pelea un compañero que se lleva solo.
 *
 * Hasta ahora usaba **la máquina de los enemigos**, y eso tiene un defecto de fondo: una IA
 * que vale para un enemigo no vale para un aliado. Al goblin le da igual morir mal
 * colocado; está ahí para durar dos turnos. A Bruna, que te cuesta veinte monedas a la
 * semana y con la que llevas un rango 4, no: si se come un ataque de oportunidad por una
 * casilla mal elegida y sale de ahí sin pierna, lo que sientes no es admiración por el
 * motor, es rabia contra él.
 *
 * Así que aquí hay **tres posturas que eliges tú**, en un clic, y dos reglas que valen
 * para las tres:
 *
 * - **A mi lado**: no se separa del tuyo. Pega a lo que llegue sin irse de su lado.
 * - **A la carga**: va a por el más cercano. Es la de antes, y la única que acepta
 *   pagar ataques de oportunidad: la has elegido sabiendo lo que es.
 * - **Atrás**: se queda lo más lejos que puede de los enemigos. Dispara si llega.
 *
 * Las dos reglas: **nadie sale del alcance de un enemigo andando** (si hay que irse, se
 * destraba primero), y **quien está malherido se retira**, sea cual sea su postura.
 *
 * Como `enemy-ai.js`, devuelve un **plan** y no hace nada: quien llama lo aplica por los
 * mismos caminos que usarías tú.
 */

import { getReachableCells, findPath } from '../board/pathfinding.js';
import { buildOccupiedSet, healthFraction, planEnemyTurn, FLEE_HP_FRACTION } from './enemy-ai.js';
import { findOpportunityAttacks } from './opportunity.js';

/** Las posturas, por id. */
export const STANCES = {
    cerca: { label: 'A mi lado', icon: 'fa-shield-halved', description: 'No se separa de ti. Pega a lo que llegue sin irse de tu lado.' },
    carga: { label: 'A la carga', icon: 'fa-bolt', description: 'Va a por el más cercano, aunque le cueste un golpe por el camino.' },
    atras: { label: 'Atrás', icon: 'fa-person-walking-arrow-right', description: 'Lo más lejos que pueda de los enemigos. Dispara si llega.' },
};

/** La de quien no ha elegido nada: la que menos disgustos da. */
export const DEFAULT_STANCE = 'cerca';

/**
 * El perfil de combate que ya traía la ficha, traducido a postura.
 *
 * Un compañero escrito como «hostigador» ya decía que prefería quedarse atrás; eso se
 * respeta. Lo que no se respeta es el valor por defecto de antes, «agresivo», que no lo
 * había elegido nadie.
 */
const FROM_PROFILE = { aggressive: 'carga', skirmisher: 'atras', guardian: 'cerca', coward: 'atras' };

/**
 * La postura de alguien.
 *
 * @param {any} member
 * @returns {string}
 */
export function stanceOf(member) {
    const chosen = String(member?.stance ?? '');
    if (chosen in STANCES) return chosen;
    const profile = String(member?.reasons?.profile ?? '').trim();
    return FROM_PROFILE[/** @type {keyof typeof FROM_PROFILE} */ (profile)] ?? DEFAULT_STANCE;
}

/**
 * @typedef {Object} AllyPlan
 * @property {{x: number, y: number}} destination
 * @property {Array<{x: number, y: number}>} path
 * @property {'attack'|'disengage'|'dodge'|'none'} action
 *   `disengage` se hace **antes** de moverse: es lo que permite irse sin pagar.
 * @property {string|null} targetId A quién ataca, si ataca.
 * @property {string} rationale Una línea, en castellano, para el registro.
 */

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
function feet(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;
}

/**
 * El turno de un compañero.
 *
 * @param {Object} input
 * @param {{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number, speedFeet?: number, attackRangeFeet?: number, name?: string}} input.actor
 * @param {{gridX: number, gridY: number}|null} [input.leader] El tuyo, al que se arrima «a mi lado».
 * @param {Array<{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number, reachFeet?: number}>} input.enemies
 * @param {Array<{id: string, gridX: number, gridY: number}>} [input.allies]
 * @param {string} [input.stance]
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @returns {AllyPlan}
 */
export function planAllyTurn({ actor, leader = null, enemies, allies = [], stance = DEFAULT_STANCE, terrain, gridWidth, gridHeight }) {
    const here = { x: actor.gridX, y: actor.gridY };
    const living = (enemies || []).filter(e => e && (Number(e.currentHp) || 0) > 0);
    const range = Math.max(5, Number(actor.attackRangeFeet) || 5);
    const speed = Number.isFinite(Number(actor.speedFeet)) ? Number(actor.speedFeet) : 30;

    /** @type {AllyPlan} */
    const still = { destination: here, path: [here], action: 'none', targetId: null, rationale: '' };
    if (living.length === 0) return { ...still, rationale: 'No queda nadie: baja el arma.' };

    const chosen = stance in STANCES ? stance : DEFAULT_STANCE;

    // A la carga es el comportamiento de siempre: la máquina de los enemigos, sin más.
    // Pero solo mientras aguanta; malherido se retira como todos.
    const wounded = healthFraction(actor) < FLEE_HP_FRACTION;
    if (chosen === 'carga' && !wounded) {
        const plan = planEnemyTurn({
            actor: { ...actor, profile: 'aggressive' },
            targets: living,
            allies,
            terrain,
            gridWidth,
            gridHeight,
        });
        return {
            destination: plan.destination,
            path: plan.path,
            action: plan.action === 'attack' ? 'attack' : 'none',
            targetId: plan.targetId,
            rationale: plan.action === 'attack' ? 'Carga contra el más cercano.' : 'Carga, pero no llega este turno.',
        };
    }

    const occupied = buildOccupiedSet([...living, ...(allies || [])], actor.id);
    const reachable = getReachableCells(terrain, here.x, here.y, speed, gridWidth, gridHeight, { occupied });
    /** @type {Array<{x: number, y: number, cost: number}>} */
    const cells = reachable.map(c => ({ x: c.gridX, y: c.gridY, cost: c.cost }));
    if (!cells.some(c => c.x === here.x && c.y === here.y)) cells.push({ ...here, cost: 0 });

    /** @param {{x: number, y: number}} to */
    const provokes = (to) => findOpportunityAttacks({
        mover: actor,
        from: here,
        to,
        threats: living,
        reachOf: (threat) => Number(threat.reachFeet) || 5,
    }).length;

    /** @param {{x: number, y: number}} cell */
    const nearestEnemy = (cell) => Math.min(...living.map(e => feet(cell.x, cell.y, e.gridX, e.gridY)));

    /** @param {{x: number, y: number}} cell */
    const targetFrom = (cell) => living
        .filter(e => feet(cell.x, cell.y, e.gridX, e.gridY) <= range)
        .sort((a, b) => healthFraction(a) - healthFraction(b) || String(a.id).localeCompare(String(b.id)))[0] ?? null;

    /** @param {{x: number, y: number}} to */
    const route = (to) => (to.x === here.x && to.y === here.y)
        ? [here]
        : (findPath(terrain, here.x, here.y, to.x, to.y, gridWidth, gridHeight, { occupied }) || [here]);

    const hemmedIn = nearestEnemy(here) <= 5;

    // Malherido, o atrás: lo más lejos posible. Si hay alguien encima, primero se destraba:
    // eso gasta la acción, pero es lo que le deja irse sin pagar el golpe.
    if (wounded || chosen === 'atras') {
        const safest = [...cells].sort((a, b) =>
            nearestEnemy(b) - nearestEnemy(a)
            || (leader ? feet(a.x, a.y, leader.gridX, leader.gridY) - feet(b.x, b.y, leader.gridX, leader.gridY) : 0)
            || a.cost - b.cost || a.y - b.y || a.x - b.x)[0];

        const moves = safest && (safest.x !== here.x || safest.y !== here.y) && nearestEnemy(safest) > nearestEnemy(here);
        if (!moves) {
            // No hay a dónde ir. Malherido, se cubre; si no, pega a quien tenga delante.
            const target = targetFrom(here);
            if (!wounded && target) {
                return { ...still, action: 'attack', targetId: target.id, rationale: 'No tiene a dónde retroceder: pega desde donde está.' };
            }
            return { ...still, action: 'dodge', rationale: wounded ? 'Malherido y acorralado: se cubre.' : 'Sin sitio al que ir: se cubre.' };
        }

        if (hemmedIn && provokes(safest) > 0) {
            return {
                destination: safest,
                path: route(safest),
                action: 'disengage',
                targetId: null,
                rationale: wounded ? 'Malherido: se destraba y se retira.' : 'Se destraba y se echa atrás.',
            };
        }

        const target = wounded ? null : targetFrom(safest);
        return {
            destination: safest,
            path: route(safest),
            action: target ? 'attack' : 'none',
            targetId: target?.id ?? null,
            rationale: wounded ? 'Malherido: se retira.' : (target ? 'Se echa atrás y dispara.' : 'Se echa atrás.'),
        };
    }

    // A mi lado. Solo casillas pegadas al tuyo (o las más cercanas, si no llega) y que no
    // le cuesten un golpe; entre ellas, la que le deja pegar a alguien.
    const safe = cells.filter(c => provokes(c) === 0);
    const pool = safe.length > 0 ? safe : [{ ...here, cost: 0 }];
    const byLeader = (/** @type {{x: number, y: number}} */ c) => (leader ? feet(c.x, c.y, leader.gridX, leader.gridY) : 0);
    const closest = Math.min(...pool.map(byLeader));
    const beside = pool.filter(c => byLeader(c) <= Math.max(5, closest));

    const withTarget = beside
        .map(c => ({ cell: c, target: targetFrom(c) }))
        .filter(o => o.target)
        .sort((a, b) => a.cell.cost - b.cell.cost || a.cell.y - b.cell.y || a.cell.x - b.cell.x)[0];

    if (withTarget && withTarget.target) {
        return {
            destination: withTarget.cell,
            path: route(withTarget.cell),
            action: 'attack',
            targetId: withTarget.target.id,
            rationale: 'Se queda a tu lado y pega a lo que llega.',
        };
    }

    const spot = [...beside].sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0] ?? here;
    return {
        destination: spot,
        path: route(spot),
        action: 'none',
        targetId: null,
        rationale: 'Se queda a tu lado, esperando.',
    };
}
