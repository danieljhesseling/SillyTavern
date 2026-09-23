/**
 * Lo que hay en el tablero y se dispara: trampas, sucesos de ronda y estados que crecen.
 *
 * Son la misma cosa escrita tres veces en casi todos los juegos, y aqui son **un solo
 * mecanismo**: algo puesto en una casilla (o en el tablero entero), con un aviso, un
 * disparador y un efecto. Una trampa se dispara al pisarla; un suceso, en una ronda; un
 * fuego, cada ronda y ademas se extiende.
 *
 * La regla que manda sobre todo lo demas:
 *
 * > **Toda trampa deja un aviso.** Una trampa sin `tell` no es una trampa: es un impuesto
 * > aleatorio. Lo que hace que pisar una sea culpa tuya es que se podia ver.
 *
 * Y la segunda: **lo que se dispara se dice**. Devolver un booleano obligaria a quien
 * llama a redactar el motivo, y entonces cada sitio lo redactaria distinto.
 *
 * Puro: recibe el tablero y el azar, y devuelve lo que pasa. No mueve a nadie, no tira
 * dano y no escribe en disco.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#25, #42, #173, #177).
 */

/** Cuando se dispara una cosa de estas. */
export const TRIGGERS = ['enter', 'round', 'leave'];

/**
 * Lo que puede hacer al dispararse.
 *
 * Son los que el motor ya sabe aplicar. Escribir aqui uno que nadie lee seria una
 * promesa: el efecto saldria en la ficha y no pasaria nada al pisarla.
 */
export const EFFECTS = ['damage', 'condition', 'terrain', 'none'];

/** Lo que cuesta ver una trampa que no se ha buscado. */
export const DEFAULT_SPOT_DC = 13;

/** Y lo que cuesta desarmarla cuando ya se ha visto. */
export const DEFAULT_DISARM_DC = 13;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * La clave de una casilla, igual que la usa el terreno.
 *
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export function cellKey(x, y) {
    return `${Math.round(number(x, 0))},${Math.round(number(y, 0))}`;
}

/**
 * Deja una cosa del tablero como el resto del modulo espera encontrarla.
 *
 * @param {any} raw
 * @returns {any}
 */
export function readHazard(raw) {
    const trigger = TRIGGERS.includes(text(raw?.trigger)) ? text(raw.trigger) : 'enter';

    return {
        id: text(raw?.id),
        name: text(raw?.name) || 'Algo',
        kind: text(raw?.kind) || 'trampa',
        trigger,
        x: Math.round(number(raw?.x, -1)),
        y: Math.round(number(raw?.y, -1)),
        // En que ronda salta, para las que van por ronda. Cero es «todas».
        round: Math.max(0, Math.round(number(raw?.round, 0))),
        every: Math.max(0, Math.round(number(raw?.every, 0))),
        // El aviso. Sin el, esto no es una trampa.
        tell: text(raw?.tell),
        note: text(raw?.note),
        effect: EFFECTS.includes(text(raw?.effect)) ? text(raw.effect) : 'none',
        // De que es el dano, para que la herida que deje sea la de esa causa: el fuego
        // quema manos y una losa rompe huesos.
        cause: text(raw?.cause),
        damageDice: text(raw?.damageDice),
        condition: text(raw?.condition),
        terrain: text(raw?.terrain),
        spotDC: Math.max(1, Math.round(number(raw?.spotDC, DEFAULT_SPOT_DC))),
        disarmDC: Math.max(1, Math.round(number(raw?.disarmDC, DEFAULT_DISARM_DC))),
        // Lo que cambia mientras se juega.
        armed: raw?.armed !== false,
        seen: Boolean(raw?.seen),
        // Si se extiende a las casillas de al lado cada vez que salta.
        spreads: Math.max(0, Math.round(number(raw?.spreads, 0))),
        // Una que salta una vez y se acaba no vuelve a saltar.
        once: Boolean(raw?.once),
    };
}

/**
 * Todo lo que un tablero tiene puesto, normalizado.
 *
 * @param {any} board
 * @returns {any[]}
 */
export function hazardsOf(board) {
    return (Array.isArray(board?.hazards) ? board.hazards : []).map(readHazard);
}

/**
 * Lo que hay en una casilla, visto o no.
 *
 * @param {any} board
 * @param {number} x
 * @param {number} y
 * @returns {any[]}
 */
export function hazardsAt(board, x, y) {
    const key = cellKey(x, y);
    return hazardsOf(board).filter(hazard => cellKey(hazard.x, hazard.y) === key);
}

/**
 * Lo que se ve de un tablero: solo lo ya descubierto.
 *
 * Lo que no se ha visto **no se dibuja**. Ensenar todas las trampas convierte el tablero
 * en una lista de casillas prohibidas, y buscarlas deja de tener sentido.
 *
 * @param {any} board
 * @returns {any[]}
 */
export function visibleHazards(board) {
    return hazardsOf(board).filter(hazard => hazard.seen && hazard.armed);
}

/**
 * Los avisos que se pueden leer sin buscar.
 *
 * Una trampa sin descubrir deja su rastro —una corriente de aire, una losa gastada— y ese
 * rastro **si** se ve. Es lo que convierte pisarla en culpa tuya.
 *
 * @param {any} board
 * @returns {Array<{x: number, y: number, tell: string}>}
 */
export function tellsOf(board) {
    return hazardsOf(board)
        .filter(hazard => hazard.armed && !hazard.seen && hazard.tell)
        .map(hazard => ({ x: hazard.x, y: hazard.y, tell: hazard.tell }));
}

/**
 * Lo que pasa al entrar en una casilla.
 *
 * Devuelve **lo que se dispara**, no un booleano: quien llama tiene que poder contarlo sin
 * redactarlo, o cada sitio lo redactaria distinto.
 *
 * @param {any} board
 * @param {{x: number, y: number}} cell
 * @returns {{fired: any[], hazards: any[]}}
 */
export function enterCell(board, cell) {
    const all = hazardsOf(board);
    /** @type {any[]} */
    const fired = [];

    const next = all.map(hazard => {
        if (hazard.trigger !== 'enter' || !hazard.armed) return hazard;
        if (cellKey(hazard.x, hazard.y) !== cellKey(cell?.x, cell?.y)) return hazard;

        fired.push(hazard);
        // Se descubre al saltar, siempre: una trampa que salta y sigue invisible haria
        // que la segunda vez fuera la misma sorpresa, y eso no lo aguanta nadie.
        return { ...hazard, seen: true, armed: !hazard.once };
    });

    return { fired, hazards: next };
}

/**
 * Lo que pasa al empezar una ronda.
 *
 * Aqui caen los hitos —«en la ronda 3 se derrumba el techo»— y lo que crece: un fuego que
 * se extiende, un agua que sube. Un tablero que cambia mientras peleas es lo que hace que
 * quedarse quieto tenga precio.
 *
 * @param {any} board
 * @param {number} round
 * @returns {{fired: any[], hazards: any[], spread: Array<{x: number, y: number, terrain: string}>}}
 */
export function startRound(board, round) {
    const now = Math.max(1, Math.round(number(round, 1)));
    const all = hazardsOf(board);
    /** @type {any[]} */
    const fired = [];
    /** @type {Array<{x: number, y: number, terrain: string}>} */
    const spread = [];

    const next = all.map(hazard => {
        if (hazard.trigger !== 'round' || !hazard.armed) return hazard;

        const onSchedule = hazard.round > 0
            ? now === hazard.round
            : (hazard.every > 0 ? now % hazard.every === 0 : true);
        if (!onSchedule) return hazard;

        fired.push(hazard);

        // Lo que se extiende se lleva las casillas de al lado. Quien llama decide si las
        // pinta: aqui solo se dice cuales.
        if (hazard.spreads > 0 && hazard.x >= 0 && hazard.y >= 0) {
            for (let dx = -hazard.spreads; dx <= hazard.spreads; dx++) {
                for (let dy = -hazard.spreads; dy <= hazard.spreads; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    spread.push({
                        x: hazard.x + dx,
                        y: hazard.y + dy,
                        terrain: hazard.terrain || 'difficult',
                    });
                }
            }
        }

        return { ...hazard, seen: true, armed: !hazard.once };
    });

    return { fired, hazards: next, spread };
}

/**
 * Buscar lo que hay: una tirada contra lo que cuesta verlo.
 *
 * Lo que se encuentra se queda encontrado. Volver a tirar por lo mismo seria pedirle a
 * quien juega que repita el boton hasta que salga.
 *
 * @param {any} board
 * @param {{x: number, y: number}} cell
 * @param {number} roll Lo que sacó, ya sumado.
 * @returns {{found: any[], missed: any[], hazards: any[], reason: string}}
 */
export function searchCell(board, cell, roll) {
    const all = hazardsOf(board);
    const here = all.filter(h => cellKey(h.x, h.y) === cellKey(cell?.x, cell?.y) && h.armed);

    if (here.length === 0) {
        return { found: [], missed: [], hazards: all, reason: 'Aquí no hay nada raro.' };
    }

    /** @type {any[]} */
    const found = [];
    /** @type {any[]} */
    const missed = [];

    const next = all.map(hazard => {
        if (!here.includes(hazard) || hazard.seen) return hazard;
        if (number(roll, 0) < hazard.spotDC) {
            missed.push(hazard);
            return hazard;
        }
        found.push(hazard);
        return { ...hazard, seen: true };
    });

    const reason = found.length > 0
        ? `Encuentras ${found.map(h => h.name.toLowerCase()).join(', ')}.`
        : 'Hay algo que no encaja, pero no sabes qué.';

    return { found, missed, hazards: next, reason };
}

/**
 * Desarmar lo que ya se ha visto.
 *
 * No se puede desarmar lo que no se ha encontrado: buscar primero es media mecanica, y
 * saltarselo la convierte en un boton que siempre funciona.
 *
 * @param {any} board
 * @param {string} id
 * @param {number} roll
 * @returns {{ok: boolean, hazards: any[], reason: string}}
 */
export function disarmHazard(board, id, roll) {
    const all = hazardsOf(board);
    const target = all.find(hazard => hazard.id === text(id));

    if (!target) return { ok: false, hazards: all, reason: 'Ahí no hay nada que desarmar.' };
    if (!target.armed) return { ok: false, hazards: all, reason: `${target.name} ya está desarmada.` };
    if (!target.seen) {
        return { ok: false, hazards: all, reason: 'Primero hay que encontrarla.' };
    }

    if (number(roll, 0) < target.disarmDC) {
        return { ok: false, hazards: all, reason: `Se te resiste: ${target.name} sigue puesta.` };
    }

    return {
        ok: true,
        hazards: all.map(hazard => (hazard === target ? { ...hazard, armed: false } : hazard)),
        reason: `${target.name} queda desarmada.`,
    };
}

/**
 * Lo que se cuenta cuando algo salta.
 *
 * @param {any} hazard
 * @returns {string}
 */
export function describeHazard(hazard) {
    if (!hazard) return '';
    const bits = [text(hazard.name)];
    if (hazard.effect === 'damage' && text(hazard.damageDice)) bits.push(text(hazard.damageDice));
    if (hazard.effect === 'condition' && text(hazard.condition)) bits.push(text(hazard.condition));
    if (text(hazard.note)) bits.push(text(hazard.note));
    return bits.join(' · ');
}
