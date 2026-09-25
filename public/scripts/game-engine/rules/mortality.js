/**
 * Qué pasa cuando alguien se queda sin salvaciones, y cuándo se puede guardar.
 *
 * Son las dos casillas que se eligen al crear una campaña, y están juntas porque **una no
 * significa nada sin la otra**: con el guardado libre, la muerte permanente ya era
 * opcional de facto — vuelves al punto de retorno y Bruna conserva la pierna. Decidir una
 * sin decidir la otra es no decidir nada.
 *
 * El reparto por defecto sale de algo que el juego ya distingue: **el motivo por el que
 * alguien te sigue.**
 *
 * - Quien viene **por dinero** muere. Su relación contigo *era* el sueldo, y la pérdida
 *   duele donde tiene que doler: hay que contratar a otro.
 * - Quien viene **por un vínculo** queda marcado. Sobrevive la inversión de veinte horas
 *   que hizo el jugador, y la partida cambia para siempre — que da mejor historia que un
 *   hueco en la lista.
 *
 * Esa asimetría existe para resolver una pelea real entre dos sistemas: los vínculos
 * premian invertir en alguien a largo plazo, y la muerte al azar destruye esa inversión.
 * Quien quiera el filo entero enciende la casilla y mueren todos.
 *
 * Puro: decide y explica. Ni mata, ni narra, ni guarda.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 2.
 */

import { rollInjury } from './injuries.js';

/** Quién puede morir de verdad en esta campaña. */
export const MORTALITY = {
    /** Solo quien te sigue por dinero. Los tuyos quedan marcados. */
    MERCENARIES: 'mercenaries',
    /** Todos, también los tuyos. Los vínculos se juegan a cara o cruz. */
    EVERYONE: 'everyone',
};

/** Cuándo se puede dejar un punto de retorno. */
export const SAVES = {
    /** Solo en el refugio, entre encargos. Dentro de una misión, lo que pasa pasa. */
    SHELTER: 'shelter',
    /** Cuando quieras. */
    FREE: 'free',
};

/** Lo que trae una campaña que no dice nada: lo más suave de las dos. */
export const DEFAULT_SURVIVAL = {
    mortality: MORTALITY.MERCENARIES,
    saves: SAVES.FREE,
    // Lo que se puede apagar. Todo encendido por defecto: es como se ha jugado hasta hoy,
    // y apagarlo tiene que ser una decision de quien crea la campana, no un descuido.
    needs: true,
    exposure: true,
    injuries: true,
    loyalty: true,
};

/**
 * Las dificultades con nombre (idea 198): tres puntos de partida para no tener que decidir
 * seis interruptores. Se eligen de una vez y luego se afinan uno a uno si se quiere.
 */
export const DIFFICULTIES = {
    historia: {
        label: 'Historia',
        note: 'Para contar una historia: nadie de los tuyos muere, se guarda cuando se quiere, sin hambre ni frío.',
        survival: { mortality: MORTALITY.MERCENARIES, saves: SAVES.FREE, needs: false, exposure: false, injuries: true, loyalty: false },
    },
    veterana: {
        label: 'Veterana',
        note: 'Lo de siempre: muere quien va por dinero, hay hambre, frío y heridas que se quedan.',
        survival: { ...DEFAULT_SURVIVAL },
    },
    hierro: {
        label: 'De hierro',
        note: 'Puede morir cualquiera, y solo se guarda en el refugio. Cada decisión pesa.',
        survival: { mortality: MORTALITY.EVERYONE, saves: SAVES.SHELTER, needs: true, exposure: true, injuries: true, loyalty: true },
    },
};

/**
 * Qué dificultad con nombre es una supervivencia, si es una de las tres.
 *
 * @param {any} survival
 * @returns {string} La clave, o vacío si está afinada a mano.
 */
export function difficultyOf(survival) {
    const read = readSurvival(survival);
    for (const [id, preset] of Object.entries(DIFFICULTIES)) {
        const want = readSurvival(preset.survival);
        if (Object.keys(want).every(key => /** @type {any} */ (want)[key] === /** @type {any} */ (read)[key])) return id;
    }
    return '';
}

/**
 * @param {any} rules
 * @returns {{mortality: string, saves: string, needs: boolean, exposure: boolean,
 *   injuries: boolean, loyalty: boolean}}
 */
export function readSurvival(rules) {
    const source = (rules && typeof rules === 'object') ? rules : {};
    /** Lo que no diga nada sigue encendido: una campana vieja no cambia sola. */
    const on = (/** @type {string} */ key) => source[key] !== false;
    const mortality = Object.values(MORTALITY).includes(source.mortality)
        ? source.mortality : DEFAULT_SURVIVAL.mortality;
    const saves = Object.values(SAVES).includes(source.saves)
        ? source.saves : DEFAULT_SURVIVAL.saves;
    return {
        mortality,
        saves,
        needs: on('needs'),
        exposure: on('exposure'),
        injuries: on('injuries'),
        loyalty: on('loyalty'),
    };
}

/**
 * Por qué te sigue alguien: por la paga o por ti.
 *
 * Quien no lo diga se toma por vínculo, y no al revés. Una partida que ya venía jugándose
 * no tiene este campo en ninguna ficha, y empezar a matar gente por un valor que nadie
 * escribió sería la peor manera posible de estrenar esta regla.
 *
 * @param {any} member
 * @returns {'coin'|'bond'}
 */
export function motiveOf(member) {
    return String(member?.motive ?? '').toLowerCase() === 'coin' ? 'coin' : 'bond';
}

/**
 * Qué le pasa a quien acaba de fallar su tercera salvación.
 *
 * @param {any} member
 * @param {Object} deps
 * @param {() => number} deps.roll        0..1, para la tabla de heridas.
 * @param {any} [deps.rules]              La sección de supervivencia de la campaña.
 * @param {number} [deps.severity]        0..1. Caer por un crítico deja peor recuerdo.
 * @param {any[]} [deps.table]            Una tabla de heridas propia.
 * @returns {{outcome: 'dies'|'maimed', injury: any|null, reason: string}}
 */
export function resolveFall(member, { roll, rules = null, severity = 0, table = undefined }) {
    const { mortality } = readSurvival(rules);
    const name = String(member?.name ?? 'Alguien');

    if (mortality === MORTALITY.EVERYONE) {
        return { outcome: 'dies', injury: null, reason: `${name} ha muerto.` };
    }

    if (motiveOf(member) === 'coin') {
        return {
            outcome: 'dies',
            injury: null,
            reason: `${name} ha muerto. Venía por la paga, y hasta aquí llegó.`,
        };
    }

    const injury = rollInjury(roll, { severity, table });
    return {
        outcome: 'maimed',
        injury,
        reason: `${name} sobrevive, pero no entero: ${injury.label.toLowerCase()}.`,
    };
}

/**
 * Si se puede dejar un punto de retorno aquí, y si no, por qué no.
 *
 * @param {{inShelter?: boolean, inCombat?: boolean}} where
 * @param {any} [rules]
 * @returns {{allowed: boolean, reason: string}}
 */
export function canCheckpoint(where, rules = null) {
    const { saves } = readSurvival(rules);
    if (saves === SAVES.FREE) return { allowed: true, reason: '' };

    if (where?.inCombat) {
        return { allowed: false, reason: 'En mitad de un combate no se guarda: lo que pasa, pasa.' };
    }
    if (!where?.inShelter) {
        return {
            allowed: false,
            reason: 'Esta campaña solo guarda en el refugio. Vuelve y podrás dejar un punto.',
        };
    }
    return { allowed: true, reason: '' };
}

/**
 * Las dos casillas, en una línea, para enseñarlas donde se eligieron.
 *
 * @param {any} rules
 * @returns {string}
 */
export function describeSurvival(rules) {
    const { mortality, saves } = readSurvival(rules);
    return [
        mortality === MORTALITY.EVERYONE
            ? 'Puede morir cualquiera, también los tuyos'
            : 'Solo muere quien viene por dinero; los tuyos quedan marcados',
        saves === SAVES.SHELTER
            ? 'se guarda solo en el refugio'
            : 'se guarda cuando quieras',
    ].join(' · ');
}
