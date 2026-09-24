/**
 * Las maniobras: lo que se puede hacer en combate además de pegar.
 *
 * Son las cuatro acciones básicas de 5e que el tablero no tenía — **esquivar,
 * destrabarse, empujar y ayudar** — y la ventaja y desventaja que las hacen valer. Sin
 * ellas, todos los combates se resuelven igual: el tanque traba, el tirador dispara y se
 * intercambia daño hasta vaciar una barra. Con ellas hay decisiones de verdad:
 * destrabarse para salir sin pagar el golpe, empujar al del borde, ayudar para que el
 * pícaro acierte, o cubrirse cuando no llegas a nada.
 *
 * Y cierran una parte de la brecha entre el chat y el tablero: lo que antes solo se podía
 * *contar* («le doy una patada para apartarlo») ahora se puede *hacer*, y el motor lo
 * resuelve con dados.
 *
 * Puro: decide y no toca nada. Quien llama guarda el estado en el combate.
 */

/** Cuerpo a cuerpo, en pies. */
const MELEE_FEET = 5;

export const MANEUVERS = {
    esquivar: {
        label: 'Esquivar',
        icon: 'fa-shield',
        description: 'Hasta tu próximo turno, los ataques contra ti tienen desventaja.',
        needsTarget: false,
    },
    destrabarse: {
        label: 'Destrabarse',
        icon: 'fa-person-running',
        description: 'Este turno puedes moverte sin provocar ataques de oportunidad.',
        needsTarget: false,
    },
    empujar: {
        label: 'Empujar',
        icon: 'fa-hand',
        description: 'Atletismo contra el suyo. Si ganas, lo apartas una casilla; si no hay sitio, lo tiras al suelo.',
        needsTarget: true,
    },
    ayudar: {
        label: 'Ayudar',
        icon: 'fa-handshake-angle',
        description: 'Distraes a un enemigo a tu lado: el próximo ataque del grupo contra él tiene ventaja.',
        needsTarget: true,
    },
};

/**
 * @typedef {Object} ManeuverState
 * @property {string[]} dodging     Quién se está cubriendo, hasta su próximo turno.
 * @property {string[]} disengaged  Quién se puede mover sin pagar, este turno.
 * @property {Array<{targetId: string, by: string}>} helped A quién le han abierto la guardia.
 */

/**
 * @param {any} raw
 * @returns {ManeuverState}
 */
export function readManeuvers(raw) {
    const list = (/** @type {any} */ value) => (Array.isArray(value) ? value.map(String) : []);
    return {
        dodging: list(raw?.dodging),
        disengaged: list(raw?.disengaged),
        helped: Array.isArray(raw?.helped)
            ? raw.helped
                .filter((/** @type {any} */ h) => h && h.targetId != null)
                .map((/** @type {any} */ h) => ({ targetId: String(h.targetId), by: String(h.by ?? '') }))
            : [],
    };
}

/**
 * Lo que caduca cuando a alguien le vuelve a tocar.
 *
 * Esquivar dura «hasta tu próximo turno», destrabarse «este turno», y la ayuda se pierde
 * si nadie la ha aprovechado cuando el que ayudaba vuelve a actuar.
 *
 * @param {any} raw
 * @param {string} actorId
 * @returns {ManeuverState}
 */
export function startTurn(raw, actorId) {
    const state = readManeuvers(raw);
    const id = String(actorId);
    return {
        dodging: state.dodging.filter(who => who !== id),
        disengaged: state.disengaged.filter(who => who !== id),
        helped: state.helped.filter(h => h.by !== id),
    };
}

/**
 * Apuntar una maniobra hecha.
 *
 * @param {any} raw
 * @param {'esquivar'|'destrabarse'|'ayudar'} kind
 * @param {string} actorId
 * @param {string} [targetId]
 * @returns {ManeuverState}
 */
export function recordManeuver(raw, kind, actorId, targetId = '') {
    const state = readManeuvers(raw);
    const id = String(actorId);
    if (kind === 'esquivar' && !state.dodging.includes(id)) state.dodging.push(id);
    if (kind === 'destrabarse' && !state.disengaged.includes(id)) state.disengaged.push(id);
    if (kind === 'ayudar' && targetId) {
        state.helped = state.helped.filter(h => h.targetId !== String(targetId));
        state.helped.push({ targetId: String(targetId), by: id });
    }
    return state;
}

/**
 * Qué maniobras se pueden hacer ahora, y por qué no las otras.
 *
 * @param {Object} input
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>}
 */
export function judgeManeuvers({ hasAction, enemies }) {
    const close = (enemies || []).filter(e => Number(e.distanceFeet) <= MELEE_FEET);
    const targets = close.map(e => ({ id: String(e.id), name: String(e.name) }));

    return Object.entries(MANEUVERS).map(([id, maneuver]) => {
        let reason = '';
        if (!hasAction) reason = 'La acción de este turno ya está gastada.';
        else if (maneuver.needsTarget && targets.length === 0) reason = 'No tienes a ningún enemigo pegado.';

        return {
            id,
            label: maneuver.label,
            icon: maneuver.icon,
            detail: reason || maneuver.description,
            enabled: !reason,
            needsTarget: maneuver.needsTarget,
            targets: maneuver.needsTarget ? targets : [],
        };
    });
}

/**
 * Si un ataque va con ventaja, con desventaja o normal, y por qué.
 *
 * Las reglas de 5e: una de cada anula una de la otra, y varias de lo mismo no se suman.
 *
 * @param {Object} input
 * @param {string} input.targetId
 * @param {string[]} [input.targetConditions]
 * @param {string[]} [input.attackerConditions]
 * @param {number} input.distanceFeet
 * @param {any} [input.maneuvers]
 * @param {boolean} [input.byParty] Si ataca el grupo: la ayuda solo vale para los tuyos.
 * @returns {{mode: 'advantage'|'disadvantage'|'normal', reasons: string[], usesHelp: boolean}}
 */
export function attackEdge({ targetId, targetConditions = [], attackerConditions = [], distanceFeet, maneuvers = null, byParty = false }) {
    const state = readManeuvers(maneuvers);
    const id = String(targetId);
    const has = (/** @type {string[]} */ list, /** @type {string} */ name) =>
        (list || []).some(c => String(c).toLowerCase() === name.toLowerCase());

    /** @type {string[]} */
    const up = [];
    /** @type {string[]} */
    const down = [];

    if (state.dodging.includes(id)) down.push('se está cubriendo');
    if (has(targetConditions, 'Prone')) {
        if (Number(distanceFeet) <= MELEE_FEET) up.push('está en el suelo');
        else down.push('está en el suelo, y de lejos cuesta');
    }
    if (has(attackerConditions, 'Prone')) down.push('ataca desde el suelo');
    const usesHelp = byParty && state.helped.some(h => h.targetId === id);
    if (usesHelp) up.push('le han abierto la guardia');

    const mode = up.length > 0 && down.length === 0 ? 'advantage'
        : down.length > 0 && up.length === 0 ? 'disadvantage'
            : 'normal';
    return { mode, reasons: [...up, ...down], usesHelp };
}

/**
 * Gastar la ayuda que se acaba de aprovechar.
 *
 * @param {any} raw
 * @param {string} targetId
 * @returns {ManeuverState}
 */
export function consumeHelp(raw, targetId) {
    const state = readManeuvers(raw);
    return { ...state, helped: state.helped.filter(h => h.targetId !== String(targetId)) };
}

/**
 * Tirar un d20 con la ventaja o la desventaja que toque.
 *
 * @param {() => number} rollD20 Un d20, del dado de la partida.
 * @param {'advantage'|'disadvantage'|'normal'} mode
 * @returns {{natural: number, rolls: number[]}}
 */
export function rollWithEdge(rollD20, mode) {
    const first = rollD20();
    if (mode === 'normal') return { natural: first, rolls: [first] };
    const second = rollD20();
    const natural = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
    return { natural, rolls: [first, second] };
}

/**
 * Cómo se dice una tirada con ventaja, para el registro.
 *
 * @param {{natural: number, rolls: number[]}} roll
 * @param {'advantage'|'disadvantage'|'normal'} mode
 * @param {string[]} reasons
 * @returns {string}
 */
export function describeEdge(roll, mode, reasons) {
    if (mode === 'normal' || roll.rolls.length < 2) return '';
    const word = mode === 'advantage' ? 'ventaja' : 'desventaja';
    return ` · con ${word} (${reasons.join(', ')}): ${roll.rolls.join(' y ')}, se queda el ${roll.natural}`;
}

/**
 * Un empujón: quién gana, y a dónde va a parar.
 *
 * Es una prueba enfrentada: el Atletismo del que empuja contra el mejor entre el
 * Atletismo y las Acrobacias del otro. **El empate lo gana quien se defiende**: en 5e
 * las cosas se quedan como estaban.
 *
 * Si gana, el otro retrocede una casilla en línea recta. Si ahí hay pared o alguien,
 * cae al suelo: el empujón no se pierde, cambia de forma.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.from Dónde está el que empuja.
 * @param {{x: number, y: number}} input.target Dónde está el empujado.
 * @param {number} input.attackTotal
 * @param {number} input.defenseTotal
 * @param {(x: number, y: number) => boolean} input.isFree Si se puede acabar en esa casilla.
 * @param {(x: number, y: number) => boolean} [input.isChasm] Si detras hay un precipicio.
 * @returns {{success: boolean, pushedTo: {x: number, y: number}|null, prone: boolean, falls: boolean}}
 */
export function resolveShove({ from, target, attackTotal, defenseTotal, isFree, isChasm = () => false }) {
    if (!(Number(attackTotal) > Number(defenseTotal))) return { success: false, pushedTo: null, prone: false, falls: false };

    const dx = Math.sign(target.x - from.x);
    const dy = Math.sign(target.y - from.y);
    const to = { x: target.x + dx, y: target.y + dy };
    const moves = dx !== 0 || dy !== 0;
    // Detras, el vacio: el empujon lo decide todo.
    if (moves && isChasm(to.x, to.y)) return { success: true, pushedTo: to, prone: false, falls: true };
    if (moves && isFree(to.x, to.y)) return { success: true, pushedTo: to, prone: false, falls: false };
    return { success: true, pushedTo: null, prone: true, falls: false };
}
