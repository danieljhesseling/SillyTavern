/**
 * Lo que le queda a alguien despues: heridas con causa y enfermedades con curso.
 *
 * La tabla de heridas del motor es **una sola**, asi que caerse por un pozo y salir de un
 * incendio dejaban lo mismo. Y no dejan lo mismo: una caida rompe huesos, el fuego quema
 * manos y pulmones, el frio se lleva dedos. La causa tiene que elegir la rama.
 *
 * Eso no pide motor nuevo: `rollInjury` ya acepta la tabla que se le pase. Lo que faltaba
 * era **de donde sacarla**, y eso es contenido.
 *
 * Y las enfermedades: tres etapas y una tirada por dia para pasar de una a la siguiente.
 * Un numero que baja es aritmetica; tres etapas con un plazo son una carrera contra el
 * reloj, y eso se juega. Pasan por `setInjury` con un solo id, que es el mismo mecanismo
 * que el agotamiento: **una sola cosa que empeora a alguien**, y `baseStats` con un unico
 * dueno.
 *
 * Puro: recibe el compendio y el azar, y devuelve tablas y etapas.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#182-#188) y wiki/ROADMAP_COMPENDIO.md, B12.
 */

/** De que se hace uno dano. Una fila sin causa vale para todo. */
export const CAUSES = ['caida', 'hoja', 'contundente', 'fuego', 'frio', 'veneno', 'bestia'];

/** El id con el que viaja una enfermedad. Uno solo: no se acumulan tres gripes. */
export const DISEASE_SLOT = 'disease';

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
 * Una fila del compendio, con la forma que `rollInjury` espera.
 *
 * @param {any} row
 * @returns {any}
 */
export function asInjury(row) {
    return {
        id: text(row?.id),
        label: text(row?.name),
        description: text(row?.note),
        modifiers: (row?.modifiers && typeof row.modifiers === 'object') ? { ...row.modifiers } : {},
        days: Math.max(0, Math.round(number(row?.days, 0))),
    };
}

/**
 * La tabla de heridas de una causa, de la mas leve a la mas grave.
 *
 * El orden **es** el contrato: `rollInjury` indexa por posicion, asi que una tabla
 * desordenada convierte un rasguno en una pierna perdida. Sale del archivo en el orden en
 * que esta escrita, que es donde se ve y donde se corrige.
 *
 * Devuelve lista vacia cuando no hay bateria o la causa no tiene nada escrito, y entonces
 * quien llama usa la del motor: aditivo, como todo el compendio.
 *
 * @param {any} compendium
 * @param {string} cause
 * @returns {any[]}
 */
export function injuryTableFor(compendium, cause) {
    if (!compendium?.has?.('estados')) return [];

    const wanted = text(cause);
    const rows = wanted
        ? compendium.find('estados', { kind: 'herida', cause: wanted })
        : compendium.find('estados', { kind: 'herida' });

    return rows.map(asInjury);
}

/**
 * Las causas que la bateria sabe distinguir.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
export function causesOf(compendium) {
    if (!compendium?.has?.('estados')) return [];
    const found = compendium.find('estados', { kind: 'herida' })
        .map((/** @type {any} */ row) => text(row.cause))
        .filter(Boolean);
    return [...new Set(found)];
}

/**
 * Una enfermedad, en su primera etapa.
 *
 * @param {any} compendium
 * @param {Object} [options]
 * @param {() => number} [options.random]
 * @param {string} [options.tag] Para pedir una de un sitio: pantano, cueva, herida…
 * @returns {{disease: any, stage: number, injury: any}|null}
 */
export function catchDisease(compendium, options = {}) {
    if (!compendium?.has?.('estados')) return null;

    const random = options.random ?? Math.random;
    const where = text(options.tag)
        ? { kind: 'enfermedad', tags: text(options.tag) }
        : { kind: 'enfermedad' };

    const disease = compendium.pick('estados', { where, random })
        ?? compendium.pick('estados', { where: { kind: 'enfermedad' }, random });
    if (!disease || !Array.isArray(disease.stages) || disease.stages.length === 0) return null;

    return { disease, stage: 0, injury: stageInjury(disease, 0) };
}

/**
 * La herida que representa una etapa de una enfermedad.
 *
 * Una enfermedad **es** una herida a ojos del motor: asi hay un solo sitio que empeora a
 * alguien y un solo dueno de `baseStats`. Dos sistemas escribiendo `speed` a la vez es
 * como se pierde el numero de partida.
 *
 * @param {any} disease
 * @param {number} stage
 * @returns {any|null}
 */
export function stageInjury(disease, stage) {
    const stages = Array.isArray(disease?.stages) ? disease.stages : [];
    const at = Math.max(0, Math.min(stages.length - 1, Math.round(number(stage, 0))));
    const step = stages[at];
    if (!step) return null;

    return {
        id: DISEASE_SLOT,
        label: `${text(disease.name)} (${text(step.label)})`,
        description: text(step.note),
        modifiers: (step.modifiers && typeof step.modifiers === 'object') ? { ...step.modifiers } : {},
        // Cero dias en la ultima etapa es lo de siempre: no se va sola.
        days: Math.max(0, Math.round(number(step.days, 0))),
    };
}

/**
 * Un dia de enfermedad: empeora, se queda igual o se cura.
 *
 * La tirada decide, y **se dice lo que ha pasado** en vez de devolver un numero: es lo que
 * el narrador tiene que contar, y redactarlo en cada sitio que lo llame daria una version
 * distinta por sitio.
 *
 * @param {Object} input
 * @param {any} input.disease
 * @param {number} input.stage      En cual esta.
 * @param {number} [input.days]     Cuantos lleva en ella.
 * @param {() => number} [input.random]
 * @param {boolean} [input.tended]  Si alguien la esta cuidando.
 * @returns {{stage: number, injury: any, done: boolean, reason: string}}
 */
export function advanceDisease({ disease, stage, days = 1, random = Math.random, tended = false }) {
    const stages = Array.isArray(disease?.stages) ? disease.stages : [];
    let at = Math.max(0, Math.min(stages.length - 1, Math.round(number(stage, 0))));

    for (let day = 0; day < Math.max(1, Math.round(days)); day++) {
        const roll = random();

        // Cuidarla no la cura: hace que gane la resistencia mas veces que la enfermedad.
        // Sin cuidados la balanza cae del otro lado, que es lo que hace que buscar a la
        // boticaria sea una decision y no un adorno.
        const worse = tended ? 0.25 : 0.45;
        const better = tended ? 0.45 : 0.2;

        if (roll < worse) {
            if (at < stages.length - 1) at++;
        } else if (roll > 1 - better) {
            if (at === 0) {
                return {
                    stage: 0,
                    injury: null,
                    done: true,
                    reason: `${text(disease.name)} se le pasa.`,
                };
            }
            at--;
        }
    }

    const injury = stageInjury(disease, at);
    const worst = at === stages.length - 1;

    return {
        stage: at,
        injury,
        done: false,
        reason: worst
            ? `${text(disease.name)}: ${text(stages[at]?.label)}. ${text(stages[at]?.note)}`
            : `${text(disease.name)}: ${text(stages[at]?.label)}.`,
    };
}

/**
 * La enfermedad en una linea, para el aviso.
 *
 * @param {any} disease
 * @param {number} stage
 * @returns {string}
 */
export function describeDisease(disease, stage) {
    const stages = Array.isArray(disease?.stages) ? disease.stages : [];
    const at = Math.max(0, Math.min(stages.length - 1, Math.round(number(stage, 0))));
    if (!stages[at]) return '';
    return `${text(disease.name)} · ${text(stages[at].label)} · etapa ${at + 1} de ${stages.length}`;
}
