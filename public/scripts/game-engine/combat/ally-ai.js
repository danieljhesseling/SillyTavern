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
 * A quién prefiere pegar (idea 35). La postura dice dónde se pone; esto, a quién va.
 */
export const PREFERENCES = {
    debil: { label: 'Al más débil', icon: 'fa-heart-crack', description: 'Remata al que menos vida le queda.' },
    cerca: { label: 'Al más cercano', icon: 'fa-location-crosshairs', description: 'Al que tenga más a mano.' },
    tirador: { label: 'A los tiradores', icon: 'fa-crosshairs', description: 'Primero a los que pegan de lejos.' },
    jefe: { label: 'Al jefe', icon: 'fa-crown', description: 'Al más duro, o al jefe si lo hay.' },
};

/** La de quien no ha elegido nada: rematar, que es lo que hacía siempre. */
export const DEFAULT_PREFERENCE = 'debil';

/**
 * Ordenar a los enemigos por la preferencia, del que va primero al último.
 *
 * @template {{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number, reachFeet?: number, boss?: boolean}} E
 * @param {E[]} enemies
 * @param {string} prefer
 * @param {{x: number, y: number}} from
 * @returns {E[]}
 */
export function byPreference(enemies, prefer, from) {
    const away = (/** @type {any} */ e) => feet(from.x, from.y, e.gridX, e.gridY);
    const tie = (/** @type {any} */ a, /** @type {any} */ b) => healthFraction(a) - healthFraction(b) || String(a.id).localeCompare(String(b.id));
    const ranged = (/** @type {any} */ e) => (Number(e.reachFeet) || 5) > 10 ? 0 : 1;
    const tough = (/** @type {any} */ e) => (e.boss ? 1e6 : 0) + (Number(e.maxHp) || 0);
    const list = [...(enemies || [])];
    switch (prefer) {
        case 'cerca': return list.sort((a, b) => away(a) - away(b) || tie(a, b));
        case 'tirador': return list.sort((a, b) => ranged(a) - ranged(b) || away(a) - away(b) || tie(a, b));
        case 'jefe': return list.sort((a, b) => tough(b) - tough(a) || tie(a, b));
        default: return list.sort(tie);
    }
}

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
 * E3.1: entre los que tiene a tiro, va antes a por quien le da ventaja: el que está en el suelo
 * (de cerca), al que le han abierto la guardia y, si es pícaro (`actor.sneak`), al que tiene un
 * aliado pegado (su furtivo). Sin nada de eso, como siempre.
 *
 * @param {Object} input
 * @param {{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number, speedFeet?: number, attackRangeFeet?: number, name?: string, sneak?: boolean}} input.actor
 * @param {{gridX: number, gridY: number}|null} [input.leader] El tuyo, al que se arrima «a mi lado».
 * @param {Array<{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number, reachFeet?: number, prone?: boolean, helped?: boolean}>} input.enemies
 * @param {Array<{id: string, gridX: number, gridY: number}>} [input.allies]
 * @param {string} [input.stance]
 * @param {string} [input.prefer] A quién va primero (idea 35).
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @returns {AllyPlan}
 */
export function planAllyTurn({ actor, leader = null, enemies, allies = [], stance = DEFAULT_STANCE, prefer = DEFAULT_PREFERENCE, terrain, gridWidth, gridHeight }) {
    const here = { x: actor.gridX, y: actor.gridY };
    const living = (enemies || []).filter(e => e && (Number(e.currentHp) || 0) > 0);
    const range = Math.max(5, Number(actor.attackRangeFeet) || 5);
    const speed = Number.isFinite(Number(actor.speedFeet)) ? Number(actor.speedFeet) : 30;

    /** @type {AllyPlan} */
    const still = { destination: here, path: [here], action: 'none', targetId: null, rationale: '' };
    if (living.length === 0) return { ...still, rationale: 'No queda nadie: baja el arma.' };

    const chosen = stance in STANCES ? stance : DEFAULT_STANCE;

    /**
     * E3.1: cuánto mejor blanco es un enemigo desde una casilla: en el suelo y de cerca (de lejos,
     * peor), con la guardia abierta y, para un pícaro, con ventaja o un aliado pegado (su furtivo).
     *
     * @param {any} e
     * @param {boolean} close Si le pegaría de cerca (a 5 pies).
     * @returns {number}
     */
    const edgeScore = (e, close) => {
        let score = 0;
        if (e.prone) score += close ? 2 : -2;
        if (e.helped) score += 2;
        if (actor.sneak && score >= 0 && (score > 0 || (allies || []).some(a => a && feet(a.gridX, a.gridY, e.gridX, e.gridY) <= 5))) score += 1;
        return score;
    };

    // A la carga es el comportamiento de siempre: la máquina de los enemigos, sin más.
    // Pero solo mientras aguanta; malherido se retira como todos.
    const wounded = healthFraction(actor) < FLEE_HP_FRACTION;
    // M4: «a mi lado» sin nadie a cuyo lado estar (es el tuyo, o el tuyo ha caído) no es
    // esperar: va a por el más cercano. Antes el héroe solo, con «Que actúe solo», se quedaba
    // quieto ronda tras ronda mientras el enemigo no se acercara.
    if ((chosen === 'carga' || (chosen === 'cerca' && !leader)) && !wounded) {
        // A la carga, pero hacia quien prefiere: si hay alguno de esos, va a por el.
        const first = byPreference(living, prefer, here)[0];
        // E3.1: y antes, a quien le da ventaja y le pilla de camino (en el suelo, la guardia abierta).
        const favored = living.filter(e => feet(here.x, here.y, e.gridX, e.gridY) <= speed + range
            && edgeScore(e, range <= 5) > 0);
        const preferred = favored.length > 0 ? [byPreference(favored, prefer, here)[0]]
            : prefer === DEFAULT_PREFERENCE || !first ? living : [first];
        const plan = planEnemyTurn({
            actor: { ...actor, profile: 'aggressive' },
            targets: preferred,
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
    const targetFrom = (cell) => {
        const ordered = byPreference(living.filter(e => feet(cell.x, cell.y, e.gridX, e.gridY) <= range), prefer, cell);
        if (ordered.length === 0) return null;
        // E3.1: el de más ventaja; a igualdad, el de su preferencia.
        const score = (/** @type {any} */ e) => edgeScore(e, feet(cell.x, cell.y, e.gridX, e.gridY) <= 5);
        const best = Math.max(...ordered.map(score));
        return ordered.find(e => score(e) === best) ?? ordered[0];
    };

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
        // M4: malherido, sin a dónde ir, sin nadie encima y sin nadie a cuyo lado estar: cubrirse
        // no acaba nunca. En el molino, la saga disparaba de lejos ronda tras ronda y el héroe
        // solo se cubría hasta la ronda 30. Ahí va a por ellos: es su única salida.
        // Lo mismo un mercenario con su héroe lejos: en la cripta, los dos se cubrían en su
        // esquina mientras Strahd disparaba de lejos, y la pelea no acababa nunca.
        const besideLeader = Boolean(leader) && feet(here.x, here.y, leader.gridX, leader.gridY) <= 5;
        if (!moves && wounded && !hemmedIn && !besideLeader) {
            const plan = planEnemyTurn({ actor: { ...actor, profile: 'aggressive' }, targets: living, allies, terrain, gridWidth, gridHeight });
            return {
                destination: plan.destination,
                path: plan.path,
                action: plan.action === 'attack' ? 'attack' : 'none',
                targetId: plan.targetId,
                rationale: 'Malherido y sin a dónde ir: se la juega.',
            };
        }
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

// ---------------------------------------------------------------- tanda 12: las reglas de 2024

/** Por debajo de esto, un compañero con poción se la bebe (acción adicional). */
export const POTION_HP_FRACTION = 0.35;

/**
 * @typedef {Object} Ally2024
 * @property {'give-potion'|'shove'|'hide'|'help'} kind
 * @property {string} [targetId] El enemigo (empujar, ayudar) o el compañero (la poción).
 * @property {'chasm'|'hazard'} [why]
 * @property {string} reason
 */

/**
 * Tanda 12: la poción de un compañero que va solo. Malherido y con una encima, se la bebe
 * antes de decidir nada: es la acción adicional, y después hace su turno igual.
 *
 * @param {{hp: number, maxHp: number, potions: number, hasBonus?: boolean}} actor
 * @returns {boolean}
 */
export function allyDrinks(actor) {
    if (!(Number(actor?.potions) > 0) || actor?.hasBonus === false) return false;
    const hp = Number(actor.hp) || 0;
    return hp > 0 && hp / Math.max(1, Number(actor.maxHp) || 1) < POTION_HP_FRACTION;
}

/**
 * Tanda 12: lo que un compañero que va solo hace **en vez de su golpe**, ya movido, si le sale
 * mejor (`null` si pega como siempre):
 *
 * 1. **Darle una poción** al de los suyos que está en el suelo a su lado (Utilizar).
 * 2. **Empujar** al enemigo que tiene al borde del vacío (cae) o de algo que quema.
 * 3. **Ayudar**: si no pega (un familiar) o pega mucho menos que otro de los suyos que también
 *    tiene a ese enemigo al lado, le abre la guardia.
 * 4. **Ocultarse**: quien se queda atrás y no llega a nadie, si hay dónde.
 *
 * @param {Object} input
 * @param {{id: string, x: number, y: number, reachFeet?: number, avgDamage?: number, potions?: number, attacks?: boolean, stance?: string, shoveDC?: number}} input.actor
 * @param {{action: string, targetId: string|null}} input.plan Lo que iba a hacer (`planAllyTurn`).
 * @param {Array<{id: string, x: number, y: number, hp: number, maxHp?: number, saveMod?: number, avgDamage?: number}>} input.enemies
 * @param {Array<{id: string, x: number, y: number, hp: number, dead?: boolean, avgDamage?: number, reachFeet?: number}>} [input.allies]
 * @param {{isFree: (x: number, y: number) => boolean, isChasm?: (x: number, y: number) => boolean, isHazard?: (x: number, y: number) => boolean}} [input.ground]
 * @param {{canHide?: boolean, dim?: boolean}} [input.sight]
 * @returns {Ally2024|null}
 */
export function planAlly2024({ actor, plan, enemies, allies = [], ground, sight = {} }) {
    const here = { x: actor.x, y: actor.y };
    const living = (enemies || []).filter(e => e && (Number(e.hp) || 0) > 0);
    const near = (/** @type {{x: number, y: number}} */ c) => feet(here.x, here.y, c.x, c.y) <= 5;

    // 1. Quien está en el suelo a su lado, y él con una poción: eso antes que nada.
    if ((Number(actor.potions) || 0) > 0) {
        const down = (allies || []).find(a => a && !a.dead && (Number(a.hp) || 0) <= 0 && a.id !== actor.id && near(a));
        if (down) return { kind: 'give-potion', targetId: down.id, reason: 'Ve a uno de los suyos en el suelo: le da una poción.' };
    }

    // 2. Empujar al vacío o a lo que quema al enemigo que está al borde.
    if (ground && actor.attacks !== false && Number(actor.shoveDC) > 0) {
        const edge = living.filter(near).map(e => {
            const dx = Math.sign(e.x - here.x);
            const dy = Math.sign(e.y - here.y);
            const next = { x: e.x + dx, y: e.y + dy };
            const why = ground.isChasm?.(next.x, next.y) ? 'chasm'
                : ground.isFree(next.x, next.y) && ground.isHazard?.(next.x, next.y) ? 'hazard' : '';
            const odds = Math.max(0.05, Math.min(0.95, (Number(actor.shoveDC) - (Number(e.saveMod) || 0) - 1) / 20));
            return { enemy: e, why, odds };
        })
            // Al vacío, con que haya una posibilidad entre cuatro; a lo que quema, si no lo tumba
            // antes a golpes.
            .filter(o => (o.why === 'chasm' && o.odds >= 0.25)
                || (o.why === 'hazard' && o.odds >= 0.4 && (Number(o.enemy.hp) || 0) > (Number(actor.avgDamage) || 0)))
            .sort((a, b) => (a.why === 'chasm' ? 0 : 1) - (b.why === 'chasm' ? 0 : 1) || b.odds - a.odds)[0];
        if (edge) {
            return {
                kind: 'shove', targetId: edge.enemy.id, why: /** @type {'chasm'|'hazard'} */ (edge.why),
                reason: edge.why === 'chasm' ? 'Lo tiene al borde del vacío: le empuja.' : 'Le empuja contra lo que quema.',
            };
        }
    }

    // 3. Ayudar a quien pega más: un familiar siempre; los demás, si el otro pega el triple (la
    // ventaja le sube un cuarto lo que acierta: con menos, rinde más su propio golpe).
    const mine = actor.attacks === false ? 0 : (Number(actor.avgDamage) || 0);
    const assist = living.filter(near).flatMap(e => (allies || [])
        .filter(a => a && !a.dead && (Number(a.hp) || 0) > 0 && a.id !== actor.id
            && feet(a.x, a.y, e.x, e.y) <= Math.max(5, Number(a.reachFeet) || 5)
            && (Number(a.avgDamage) || 0) >= Math.max(1, 3 * mine))
        .map(a => ({ enemy: e, friend: a })))
        .sort((a, b) => (Number(b.friend.avgDamage) || 0) - (Number(a.friend.avgDamage) || 0) || String(a.enemy.id).localeCompare(String(b.enemy.id)))[0];
    if (assist) {
        return { kind: 'help', targetId: assist.enemy.id, reason: 'Le abre la guardia a quien pega más fuerte.' };
    }

    // 4. Ocultarse: atrás, sin nadie a tiro, y con algo que le tape o poca luz.
    const ranged = (Number(actor.reachFeet) || 5) > 10;
    if (plan?.action !== 'attack' && actor.attacks !== false && (ranged || actor.stance === 'atras')
        && (sight.canHide || sight.dim) && living.length > 0 && !living.some(near)) {
        return { kind: 'hide', reason: sight.dim ? 'No llega a nadie: se pierde en la penumbra.' : 'No llega a nadie: se esconde detrás de algo.' };
    }
    return null;
}

// ---------------------------------------------------------------- tanda 16: ir a por quien cae

/** Con tantos fallos, el siguiente le mata: se arriesga a tener a alguien pegado para llegar. */
export const URGENT_FAILURES = 2;

/**
 * @typedef {Object} RescuePlan
 * @property {'give-potion'|'stabilize'} kind Con una poción encima, se la da; si no, le estabiliza.
 * @property {string} targetId El caído.
 * @property {{x: number, y: number}} destination A su lado.
 * @property {Array<{x: number, y: number}>} path
 * @property {string} reason
 */

/**
 * Tanda 16: un compañero que va solo, si uno de los suyos está en el suelo desangrándose y es
 * bastante seguro, va a su lado y le da una poción o, sin poción, le estabiliza (Medicina
 * contra 10, la acción de Ayudar de 2024). Antes solo se la daba si ya estaba pegado a él.
 *
 * «Bastante seguro»: llegar no le cuesta ningún golpe al irse de nadie, y donde se pone no tiene
 * a ningún enemigo pegado. Si al caído le quedan ya dos fallos (el siguiente le mata), se
 * arriesga a tener a alguien al lado, pero sigue sin pagar golpes por el camino. Primero el más
 * apurado; a igualdad, el más cercano.
 *
 * @param {Object} input
 * @param {{id: string, gridX: number, gridY: number, speedFeet?: number, potions?: number}} input.actor
 * @param {Array<{id: string, gridX: number, gridY: number, failures?: number}>} input.dying Los suyos que se desangran.
 * @param {Array<{id: string, gridX: number, gridY: number, currentHp?: number, reachFeet?: number}>} input.enemies
 * @param {Array<{id: string, gridX: number, gridY: number}>} [input.allies] Los demás que ocupan casilla.
 * @param {any} input.terrain
 * @param {number} input.gridWidth
 * @param {number} input.gridHeight
 * @returns {RescuePlan|null}
 */
export function planRescue({ actor, dying, enemies, allies = [], terrain, gridWidth, gridHeight }) {
    const fallen = (dying || []).filter(d => d && String(d.id) !== String(actor.id));
    if (fallen.length === 0) return null;
    const here = { x: actor.gridX, y: actor.gridY };
    const living = (enemies || []).filter(e => e && (Number(e.currentHp) || 0) > 0);
    const speed = Number.isFinite(Number(actor.speedFeet)) ? Number(actor.speedFeet) : 30;
    const occupied = buildOccupiedSet([...living, ...(allies || []), ...fallen], actor.id);
    const cells = getReachableCells(terrain, here.x, here.y, speed, gridWidth, gridHeight, { occupied })
        .map(c => ({ x: c.gridX, y: c.gridY, cost: c.cost }));
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
    const enemyBeside = (cell) => living.some(e => feet(cell.x, cell.y, e.gridX, e.gridY) <= 5);

    const order = [...fallen].sort((a, b) => (Number(b.failures) || 0) - (Number(a.failures) || 0)
        || feet(here.x, here.y, a.gridX, a.gridY) - feet(here.x, here.y, b.gridX, b.gridY)
        || String(a.id).localeCompare(String(b.id)));
    for (const down of order) {
        const urgent = (Number(down.failures) || 0) >= URGENT_FAILURES;
        const spot = cells
            .filter(c => feet(c.x, c.y, down.gridX, down.gridY) <= 5 && !(c.x === down.gridX && c.y === down.gridY))
            .filter(c => (c.x === here.x && c.y === here.y) || provokes(c) === 0)
            .filter(c => urgent || !enemyBeside(c))
            .sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
        if (!spot) continue;
        const path = spot.x === here.x && spot.y === here.y
            ? [here]
            : (findPath(terrain, here.x, here.y, spot.x, spot.y, gridWidth, gridHeight, { occupied }) || null);
        if (!path) continue;
        const potion = (Number(actor.potions) || 0) > 0;
        return {
            kind: potion ? 'give-potion' : 'stabilize',
            targetId: String(down.id),
            destination: { x: spot.x, y: spot.y },
            path,
            reason: potion
                ? 'Uno de los suyos se desangra: va a su lado y le da una poción.'
                : 'Uno de los suyos se desangra: va a su lado a cortarle la sangre.',
        };
    }
    return null;
}
