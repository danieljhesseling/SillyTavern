/**
 * Viajar con decisiones: a que ritmo, y que hacer con cada contratiempo.
 *
 * Hasta ahora un viaje pasaba: se pulsaba el sitio, corrian los dias y los sucesos se
 * contaban hechos. Aqui el grupo decide dos cosas (ideas 64 y 66):
 *
 * - **El ritmo.** Rapido: menos dias, pero se llega sin dormir. Con cuidado: mas dias, pero
 *   la mitad de los contratiempos se ven venir y se esquivan. Normal: lo de siempre.
 * - **Cada contratiempo que retrasa** (un puente caido, una crecida, una tormenta): rodear y
 *   perder el tiempo, o forzar el paso con una tirada. Si sale, no se pierde nada; si no,
 *   se pierde el tiempo igual y alguien se hace daño.
 *
 * Puro: calcula. Quien llama pregunta al jugador y tira los dados.
 */

/** La prueba de forzar el paso. */
export const FORCE_DC = 12;

/** Lo que cuesta un paso forzado que sale mal: 1d6, a quien lo intento. */
export const FORCE_HURT = 6;

export const PACES = {
    rapido: {
        label: 'Rápido', factor: 0.75,
        note: 'Menos días, pero se llega sin haber dormido.',
    },
    normal: {
        label: 'Normal', factor: 1,
        note: 'Lo de siempre.',
    },
    cauteloso: {
        label: 'Con cuidado', factor: 1.25,
        note: 'Más días, pero la mitad de los contratiempos se ven venir y se esquivan.',
    },
};

/** Horas de sueño que se deben al llegar a paso rapido. */
export const RUSH_REST_HOURS = 24;

/**
 * @param {string} pace
 * @returns {keyof typeof PACES}
 */
export function readPace(pace) {
    return Object.prototype.hasOwnProperty.call(PACES, String(pace)) ? /** @type {keyof typeof PACES} */ (String(pace)) : 'normal';
}

/**
 * Los dias de camino a un ritmo. Nunca menos de uno.
 *
 * @param {number} days
 * @param {string} pace
 * @returns {number}
 */
export function paceDays(days, pace) {
    const base = Math.max(1, Math.floor(Number(days) || 1));
    const factor = PACES[readPace(pace)].factor;
    // Con cuidado se redondea hacia arriba: ir despacio siempre cuesta algo.
    const scaled = factor > 1 ? Math.ceil(base * factor) : Math.round(base * factor);
    return Math.max(1, scaled);
}

/**
 * Un contratiempo: un suceso que retrasa. Los atajos y lo que no cuesta tiempo no se
 * eligen, pasan.
 *
 * @param {{days: number}} event
 * @returns {boolean}
 */
export function isSetback(event) {
    return Number(event?.days) > 0;
}

/**
 * Lo que el ritmo hace con los sucesos: con cuidado, la mitad de los contratiempos se
 * esquivan (y se dice).
 *
 * @template {{days: number, name: string, note: string}} T
 * @param {T[]} events
 * @param {string} pace
 * @param {() => number} random
 * @returns {{events: T[], avoided: string[]}}
 */
export function paceEvents(events, pace, random) {
    if (readPace(pace) !== 'cauteloso') return { events: [...events], avoided: [] };
    /** @type {T[]} */
    const kept = [];
    /** @type {string[]} */
    const avoided = [];
    for (const event of events) {
        if (isSetback(event) && random() < 0.5) avoided.push(event.name);
        else kept.push(event);
    }
    return { events: kept, avoided };
}

/**
 * Las dos salidas de un contratiempo.
 *
 * @param {{days: number, name: string}} event
 * @param {string} skill La habilidad con que se fuerza, ya elegida por quien llama.
 * @returns {{title: string, detour: string, force: string}}
 */
export function setbackChoice(event, skill = 'Atletismo') {
    const days = Math.max(1, Number(event.days) || 1);
    return {
        title: event.name,
        detour: `Rodear: ${days === 1 ? 'un día más' : `${days} días más`}, sin riesgo.`,
        force: `Forzar el paso: ${skill} CD ${FORCE_DC}. Si sale, no se pierde nada; si no, se pierde el tiempo y alguien sale herido.`,
    };
}

/**
 * Como queda un contratiempo tras decidir.
 *
 * @param {{days: number, name: string, note: string}} event
 * @param {'detour'|'force'} choice
 * @param {{success: boolean, who: string, hurt: number}|null} [roll]
 * @returns {{days: number, note: string, hurt: number}}
 */
export function resolveSetback(event, choice, roll = null) {
    if (choice === 'force' && roll?.success) {
        return { days: 0, note: `${event.note} ${roll.who} abre paso y no se pierde tiempo.`, hurt: 0 };
    }
    if (choice === 'force' && roll) {
        return { days: event.days, note: `${event.note} ${roll.who} intenta forzar el paso, no sale y se lleva ${roll.hurt} de daño.`, hurt: roll.hurt };
    }
    return { days: event.days, note: `${event.note} Dais un rodeo.`, hurt: 0 };
}
