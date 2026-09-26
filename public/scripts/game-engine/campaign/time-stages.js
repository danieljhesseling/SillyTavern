/**
 * Un solo paso del tiempo: las etapas, en orden, declaradas una vez (U3 del pegamento).
 *
 * El tiempo pasaba por tres caminos: lo del día en una función, lo de la semana en otra
 * (con sus ganchos en fila, en el orden en que se fueron añadiendo) y las facciones con su
 * propio contador aparte. Los plazos del tablón, además, solo vencían al abrir el gremio:
 * si no lo abrías, dejar pasar un encargo no costaba nada.
 *
 * Aquí está la lista entera, en el orden en que pasan las cosas, y un ejecutor que las
 * recorre. Dos reglas:
 *
 * 1. **El orden se escribe una vez y se prueba.** Primero se cura y se come, luego se
 *    mueve el mundo, y al final, si toca, la semana: cobrar va lo último porque lo de antes
 *    puede cambiar lo que hay que pagar.
 * 2. **Una etapa que falla no para a las demás.** Antes, un error en los rivales dejaba la
 *    cuenta sin cobrar. Ahora se apunta y se sigue.
 *
 * Puro: la lista y el recorrido. Lo que hace cada etapa lo pone quien llama.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U3.
 */

/**
 * @typedef {Object} TimeStage
 * @property {string} id
 * @property {string} what Qué pasa, dicho para quien lee el código o el panel.
 */

/** Lo que pasa cada día, en este orden. */
/** @type {TimeStage[]} */
export const DAY_STAGES = [
    { id: 'hilo', what: 'El hilo: lo que se abre con el día y los plazos de los hitos' },
    { id: 'pistas', what: 'Una pista, si el hilo lleva días quieto' },
    { id: 'cartas', what: 'Las cartas que se escriben hoy' },
    { id: 'fiesta', what: 'La fiesta de hoy, si la hay' },
    { id: 'curar', what: 'Las heridas cuentan los días; lo permanente se queda' },
    { id: 'necesidades', what: 'Comer, beber, dormir y aguantar el clima' },
    { id: 'facciones', what: 'Los relojes de las facciones avanzan' },
    { id: 'despachos', what: 'Vuelven los que mandasteis sin el héroe (U8)' },
    { id: 'tablon', what: 'Los encargos del tablón que caducan, y el sitio que los pedía lo nota' },
    { id: 'semana', what: 'Si toca, la semana entera' },
];

/** Lo que pasa cada semana, en este orden: cobrar al final, y la mesa de la siguiente detrás. */
/** @type {TimeStage[]} */
export const WEEK_STAGES = [
    { id: 'deuda', what: 'Lo que se debe a un patrón' },
    { id: 'gente', what: 'De vez en cuando, alguien del mundo se muda' },
    { id: 'hartos', what: 'Quien está harto avisa, y si ya avisó, se va' },
    { id: 'rivales', what: 'Los rivales se llevan un encargo del tablón' },
    { id: 'buscados', what: 'Lo que os buscan se va olvidando' },
    { id: 'cuenta', what: 'La cuenta: comida, sueldos, posada y tasas' },
    { id: 'caso', what: 'A veces, un caso: alguien muere, roba o desaparece, y hay una verdad que encontrar (U8)' },
    { id: 'mesa', what: 'La mesa de la semana que empieza: lo que pasó, y lo que no cabe entero (U5)' },
];

/**
 * Recorrer unas etapas en orden. Cada una recibe lo mismo; si una falla, se apunta y se
 * sigue con la siguiente.
 *
 * **Síncrono a propósito**: quien pasa el tiempo (un descanso, un viaje de varios días) lee
 * justo después el oro o las heridas, y tiene que verlos ya cobrados y curados. Una etapa
 * que lanza algo por detrás (una promesa) sigue su camino; si esa promesa falla, se avisa
 * por `onLateFailure`.
 *
 * @template T
 * @param {TimeStage[]} stages
 * @param {Record<string, (context: T) => any>} handlers
 * @param {T} context
 * @param {(id: string, error: string) => void} [onLateFailure]
 * @returns {{ran: string[], failed: Array<{id: string, error: string}>, missing: string[]}}
 */
export function runStages(stages, handlers, context, onLateFailure = () => {}) {
    /** @type {string[]} */
    const ran = [];
    /** @type {Array<{id: string, error: string}>} */
    const failed = [];
    /** @type {string[]} */
    const missing = [];
    for (const stage of stages) {
        const handler = handlers?.[stage.id];
        if (typeof handler !== 'function') {
            missing.push(stage.id);
            continue;
        }
        try {
            const result = handler(context);
            if (result && typeof result.then === 'function') {
                result.then(undefined, (/** @type {any} */ error) => onLateFailure(stage.id, String(error?.message ?? error)));
            }
            ran.push(stage.id);
        } catch (error) {
            failed.push({ id: stage.id, error: String(/** @type {any} */ (error)?.message ?? error) });
        }
    }
    return { ran, failed, missing };
}

/**
 * Cuántas semanas se cobran hoy, y cuándo vence la siguiente.
 *
 * La primera vez no se cobra nada: la primera semana empieza a contar hoy, no se debe desde
 * el minuto uno. Si se han pasado varias de golpe (un viaje largo), se cobran todas.
 *
 * @param {number} today
 * @param {number} due El día en que vence la cuenta; 0 o nada si aún no se ha puesto.
 * @param {number} weekLength
 * @returns {{weeks: number, nextDue: number}}
 */
export function weeksDue(today, due, weekLength) {
    const now = Math.max(1, Math.floor(Number(today) || 1));
    const week = Math.max(1, Math.floor(Number(weekLength) || 7));
    let next = Math.floor(Number(due) || 0);
    if (!(next > 0)) return { weeks: 0, nextDue: now + week };
    let weeks = 0;
    while (now >= next) {
        weeks++;
        next += week;
    }
    return { weeks, nextDue: next };
}
