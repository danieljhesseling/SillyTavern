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
    // Idea 10: agarrar. Atletismo contra el suyo; si ganas, no se mueve hasta tu próximo
    // turno. Y un agarrado que empujas no tiene a dónde escapar.
    agarrar: {
        label: 'Agarrar',
        icon: 'fa-hand-back-fist',
        description: 'Atletismo contra el suyo. Si ganas, no se mueve hasta tu próximo turno.',
        needsTarget: true,
    },
    // Idea 11: esconderse. Solo con algo delante de cada enemigo que mira; Sigilo contra la
    // mejor Percepción pasiva de ellos. Si no te ven, tu próximo ataque va con ventaja.
    esconderse: {
        label: 'Esconderse',
        icon: 'fa-user-secret',
        description: 'Tras cobertura: Sigilo contra su Percepción. Si no te ven, tu próximo ataque va con ventaja.',
        needsTarget: false,
    },
    // Idea 4: preparar un golpe. El primero que se te acerque se lo lleva antes de actuar.
    preparar: {
        label: 'Preparar golpe',
        icon: 'fa-hourglass-half',
        description: 'Hasta tu próximo turno: el primer enemigo que se te acerque se lleva un golpe antes de hacer nada.',
        needsTarget: false,
    },
};

/**
 * @typedef {Object} ManeuverState
 * @property {string[]} dodging     Quién se está cubriendo, hasta su próximo turno.
 * @property {string[]} disengaged  Quién se puede mover sin pagar, este turno.
 * @property {Array<{targetId: string, by: string}>} helped A quién le han abierto la guardia.
 * @property {{targetId: string, by: string, round: number}|null} [combo] A quién ha tirado al
 *   suelo alguien del grupo esta ronda: el siguiente de los tuyos que le pegue, suma (idea 17).
 * @property {Array<{id: string, fresh: boolean}>} [hidden] Quién está escondido (idea 11).
 *   `fresh` es que se escondió en su turno de ahora: aguanta hasta el final del siguiente.
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
        combo: raw?.combo && raw.combo.targetId != null
            ? { targetId: String(raw.combo.targetId), by: String(raw.combo.by ?? ''), round: Math.floor(Number(raw.combo.round) || 0) }
            : null,
        hidden: Array.isArray(raw?.hidden)
            ? raw.hidden
                .filter((/** @type {any} */ h) => h && h.id != null)
                .map((/** @type {any} */ h) => ({ id: String(h.id), fresh: Boolean(h.fresh) }))
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
        combo: state.combo,
        // Escondido en este turno: aguanta el siguiente, para poder atacar desde ahí. Si
        // tampoco entonces ataca, al empezar el otro ya le han visto.
        hidden: (state.hidden ?? [])
            .filter(h => h.id !== id || h.fresh)
            .map(h => (h.id === id ? { id, fresh: false } : h)),
    };
}

/**
 * Apuntar una maniobra hecha.
 *
 * @param {any} raw
 * @param {'esquivar'|'destrabarse'|'ayudar'|'esconderse'} kind
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
    if (kind === 'esconderse') state.hidden = [...(state.hidden ?? []).filter(h => h.id !== id), { id, fresh: true }];
    return state;
}

/**
 * Si alguien está escondido ahora mismo (idea 11).
 *
 * @param {any} raw
 * @param {string} id
 * @returns {boolean}
 */
export function isHidden(raw, id) {
    return (readManeuvers(raw).hidden ?? []).some(h => h.id === String(id));
}

/**
 * Dejar de estar escondido: al atacar, o cuando le han visto.
 *
 * @param {any} raw
 * @param {string} id
 * @returns {ManeuverState}
 */
export function revealHidden(raw, id) {
    const state = readManeuvers(raw);
    return { ...state, hidden: (state.hidden ?? []).filter(h => h.id !== String(id)) };
}

/**
 * Si hay dónde esconderse: algo delante de **cada** enemigo que mira (idea 11).
 *
 * Con que uno solo te vea de lleno, no hay escondite que valga. La cobertura que cuenta es
 * la media o más (2 de CA): detrás de una silla no se esconde nadie.
 *
 * @param {Array<{name: string, cover: number, sees?: boolean}>} watchers Cada enemigo en pie,
 *   con la cobertura que tienes frente a él y si tiene línea de visión.
 * @returns {{ok: boolean, reason: string}}
 */
export function canHide(watchers) {
    const looking = (watchers || []).filter(w => w.sees !== false);
    if ((watchers || []).length === 0) return { ok: false, reason: 'No hay nadie de quien esconderse.' };
    const exposed = looking.filter(w => Number(w.cover) < 2);
    if (exposed.length > 0) {
        return { ok: false, reason: `${exposed[0].name} te ve de lleno: hace falta algo delante (mesa, carro, columna).` };
    }
    return { ok: true, reason: '' };
}

/**
 * Lo que hay que sacar para esconderse: la mejor Percepción pasiva de quien mira.
 *
 * @param {Array<{wisdom?: number, perception?: number}>} watchers
 * @returns {number}
 */
export function hideDC(watchers) {
    const passive = (/** @type {any} */ w) => (Number.isFinite(Number(w?.perception))
        ? 10 + Number(w.perception)
        : 10 + Math.floor(((Number(w?.wisdom) || 10) - 10) / 2));
    return Math.max(10, ...(watchers || []).map(passive));
}

/**
 * Qué maniobras se pueden hacer ahora, y por qué no las otras.
 *
 * @param {Object} input
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @param {{ok: boolean, reason: string}} [input.hide] Si hay dónde esconderse (`canHide`).
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>}
 */
export function judgeManeuvers({ hasAction, enemies, hide = { ok: false, reason: 'No hay dónde esconderse.' } }) {
    const close = (enemies || []).filter(e => Number(e.distanceFeet) <= MELEE_FEET);
    const targets = close.map(e => ({ id: String(e.id), name: String(e.name) }));

    return Object.entries(MANEUVERS).map(([id, maneuver]) => {
        let reason = '';
        if (!hasAction) reason = 'La acción de este turno ya está gastada.';
        else if (maneuver.needsTarget && targets.length === 0) reason = 'No tienes a ningún enemigo pegado.';
        else if (id === 'esconderse' && !hide?.ok) reason = hide?.reason || 'No hay dónde esconderse.';

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
 * @param {boolean} [input.flanked] Si hay un aliado del atacante al otro lado (idea 3).
 * @param {string} [input.attackerId] Quién ataca: si estaba escondido, ataca con ventaja (idea 11).
 * @param {string[]} [input.hindered] Lo que estorba desde fuera: la niebla, la noche, el viento
 *   (ideas 73 y 90, `visibilityPenalties`). Cada cosa es una razón de desventaja.
 * @returns {{mode: 'advantage'|'disadvantage'|'normal', reasons: string[], usesHelp: boolean, usesHidden: boolean}}
 */
export function attackEdge({ targetId, targetConditions = [], attackerConditions = [], distanceFeet, maneuvers = null, byParty = false, flanked = false, attackerId = '', hindered = [] }) {
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
    // Sujeto (una red, un golpe que le clava): no esquiva, y pega mal (5e).
    if (has(targetConditions, 'Restrained')) up.push('está sujeto');
    if (has(attackerConditions, 'Restrained')) down.push('ataca sujeto');
    const usesHelp = byParty && state.helped.some(h => h.targetId === id);
    if (usesHelp) up.push('le han abierto la guardia');
    if (flanked && Number(distanceFeet) <= MELEE_FEET) up.push('lo tenéis flanqueado');
    // Idea 11: quien sale de su escondite pega primero; a quien no se ve, se le pega mal.
    const usesHidden = Boolean(attackerId) && (state.hidden ?? []).some(h => h.id === String(attackerId));
    if (usesHidden) up.push('no le ven venir');
    if ((state.hidden ?? []).some(h => h.id === id)) down.push('no se le ve bien');
    // Ideas 73 y 90: la niebla, la noche o el viento.
    for (const reason of Array.isArray(hindered) ? hindered : []) if (reason) down.push(String(reason));

    const mode = up.length > 0 && down.length === 0 ? 'advantage'
        : down.length > 0 && up.length === 0 ? 'disadvantage'
            : 'normal';
    return { mode, reasons: [...up, ...down], usesHelp, usesHidden };
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

/** Lo que suma pegar a quien un compañero acaba de tirar al suelo (idea 17). */
export const COMBO_DICE = '1d4';

/**
 * Apuntar que alguien del grupo ha tirado a un enemigo al suelo esta ronda.
 *
 * @param {any} raw
 * @param {string} targetId
 * @param {string} by
 * @param {number} round
 * @returns {ManeuverState}
 */
export function noteKnockdown(raw, targetId, by, round) {
    return { ...readManeuvers(raw), combo: { targetId: String(targetId), by: String(by), round: Math.floor(Number(round) || 0) } };
}

/**
 * Si este golpe remata la jugada de otro: el enemigo lo tiró al suelo otro de los tuyos, en
 * esta misma ronda. Se gasta al usarse.
 *
 * @param {any} raw
 * @param {{targetId: string, attackerId: string, round: number}} blow
 * @returns {{combo: boolean, by: string, state: ManeuverState}}
 */
export function takeCombo(raw, { targetId, attackerId, round }) {
    const state = readManeuvers(raw);
    const combo = state.combo;
    const fits = Boolean(combo) && combo?.targetId === String(targetId) && combo?.by !== String(attackerId)
        && combo?.round === Math.floor(Number(round) || 0);
    return { combo: fits, by: fits ? String(combo?.by) : '', state: fits ? { ...state, combo: null } : state };
}
