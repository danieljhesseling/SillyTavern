/**
 * Los modos de juego: qué sistemas existen en esta partida (R1 del roadmap de profundidad).
 *
 * Había seis interruptores de supervivencia, tres dificultades con nombre que solo tocaban
 * esos seis, y todo lo que vino después —la cuenta, los rivales, los casos— encendido
 * siempre, se quisiera o no. Para jugar una tarde había que entender demasiado.
 *
 * Aquí se ordena en **seis letras**, cada una un sistema entero que se entiende en una
 * frase, y **tres modos** que son tres juegos de letras:
 *
 * | Modo | Letras |
 * | :--- | :--- |
 * | Relajado | a, b, c |
 * | Normal | a, b, c, d, f |
 * | Supervivencia | a, b, c, d, e, f |
 *
 * Cualquier otra combinación es «A tu medida».
 *
 * Tres decisiones:
 *
 * 1. **Los interruptores de siempre siguen siendo la verdad.** El modo no se guarda aparte:
 *    se lee de ellos. Así una campaña vieja ya está en un modo sin migrar nada, y afinar un
 *    interruptor a mano no deja un modo que dice una cosa y unos interruptores que dicen otra.
 * 2. **Sustituyen a las dificultades** (DR1): *Historia*, *Veterana* y *De hierro* eran casi
 *    exactamente Relajado, Normal y Supervivencia, y dos juegos de nombres para lo mismo
 *    confunden.
 * 3. **Se puede cambiar cuando se quiera** (DR2), y queda escrito: una partida que bajó de
 *    Supervivencia ya no cuenta como de hierro en el salón de la fama.
 *
 * Puro: decide y explica. No guarda, no pinta.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R1.
 */

import { MORTALITY, SAVES, readSurvival } from './mortality.js';

/**
 * @typedef {Object} SystemLetter
 * @property {string} id La letra.
 * @property {string} title Cómo se llama, dicho para quien juega.
 * @property {string} note Qué trae, en una frase.
 * @property {string} [needs] Otra letra sin la que esta no hace nada.
 */

/** Las seis letras, en orden. */
/** @type {SystemLetter[]} */
export const LETTERS = [
    { id: 'a', title: 'Heridas', note: 'Quien cae se levanta con una herida que tarda días en curar.' },
    { id: 'b', title: 'La cuenta', note: 'Cada semana se paga comida, sueldos y posada; quien no cobra acaba yéndose.' },
    { id: 'c', title: 'El mundo se mueve', note: 'Las facciones avanzan, los rivales se llevan encargos, la gente se muda y a veces hay un caso.' },
    { id: 'd', title: 'El cuerpo', note: 'Hambre, sed y sueño: hay que comer, beber y dormir.' },
    { id: 'e', title: 'De hierro', note: 'Puede morir cualquiera, también los tuyos, y solo se guarda en el refugio.' },
    { id: 'f', title: 'La intemperie', note: 'El frío y el calor pesan, y dormir al raso se paga.', needs: 'd' },
];

/**
 * Los modos con nombre. Lo que no es ninguno de estos es «A tu medida».
 *
 * `extras` son los ajustes de la pausa que el modo pone al elegirlo: la red de seguridad
 * (idea 25) y que los hartos se vayan (idea 29). Luego se pueden tocar sueltos.
 */
export const MODES = {
    relajado: {
        label: 'Relajado',
        letters: 'abc',
        note: 'Para la historia: nadie de los tuyos muere, nada te mata de hambre ni de frío, y se guarda cuando se quiere.',
        extras: { safetyNet: true, companionsLeave: false },
    },
    normal: {
        label: 'Normal',
        letters: 'abcdf',
        note: 'Lo de siempre: el cuerpo y el camino pesan, muere quien va por dinero, y guardas cuando quieres.',
        extras: { safetyNet: false, companionsLeave: true },
    },
    supervivencia: {
        label: 'Supervivencia',
        letters: 'abcdef',
        note: 'Todo: cada decisión pesa, puede morir cualquiera y solo se guarda en el refugio.',
        extras: { safetyNet: false, companionsLeave: true },
    },
};

/** El nombre de lo que no es ningún modo con nombre. */
export const CUSTOM = 'custom';
export const CUSTOM_LABEL = 'A tu medida';

/** El modo de una campaña que no dice nada: lo que se ha jugado hasta hoy. */
export const DEFAULT_MODE = 'normal';

/**
 * @param {any} letters
 * @returns {Set<string>}
 */
function letterSet(letters) {
    const known = new Set(LETTERS.map(l => l.id));
    const list = Array.isArray(letters) ? letters : String(letters ?? '').split('');
    return new Set(list.map(l => String(l).trim().toLowerCase()).filter(l => known.has(l)));
}

/**
 * Las letras en su orden, como texto: `abcdf`.
 *
 * @param {Iterable<string>} letters
 * @returns {string}
 */
function spell(letters) {
    const on = new Set(letters);
    return LETTERS.map(l => l.id).filter(id => on.has(id)).join('');
}

/**
 * Quitar lo que no se sostiene solo: la intemperie sin el cuerpo no pesa en nada, porque el
 * frío se cobra en hambre y cansancio. Se dice por qué.
 *
 * @param {any} letters
 * @returns {{letters: string, dropped: string[], reasons: string[]}}
 */
export function fixLetters(letters) {
    const on = letterSet(letters);
    /** @type {string[]} */
    const dropped = [];
    /** @type {string[]} */
    const reasons = [];
    for (const letter of LETTERS) {
        if (letter.needs && on.has(letter.id) && !on.has(letter.needs)) {
            on.delete(letter.id);
            dropped.push(letter.id);
            const need = LETTERS.find(l => l.id === letter.needs);
            reasons.push(`«${letter.title}» necesita «${need?.title ?? letter.needs}»: sin eso no pesa en nada.`);
        }
    }
    return { letters: spell(on), dropped, reasons };
}

/**
 * Los interruptores que ponen unas letras.
 *
 * @param {any} letters
 * @returns {{mortality: string, saves: string, needs: boolean, exposure: boolean,
 *   injuries: boolean, loyalty: boolean, upkeep: boolean, world: boolean}}
 */
export function survivalFor(letters) {
    const on = letterSet(fixLetters(letters).letters);
    return {
        mortality: on.has('e') ? MORTALITY.EVERYONE : MORTALITY.MERCENARIES,
        saves: on.has('e') ? SAVES.SHELTER : SAVES.FREE,
        needs: on.has('d'),
        exposure: on.has('f'),
        injuries: on.has('a'),
        // Que se vaya quien no cobra es la mitad de la cuenta: sin cuenta no hay a quién
        // no pagar.
        loyalty: on.has('b'),
        upkeep: on.has('b'),
        world: on.has('c'),
    };
}

/**
 * Qué letras están encendidas en unos interruptores.
 *
 * Una letra con dos interruptores (la cuenta y quien se va sin cobrar; de hierro, que es
 * morir y guardar) cuenta encendida si lo está **lo que la define**: la cuenta, y que muera
 * cualquiera. Lo fino se ve en `modeOf`, que por eso da «A tu medida».
 *
 * @param {any} survival
 * @returns {string}
 */
export function lettersOf(survival) {
    const read = readSurvival(survival);
    /** @type {string[]} */
    const on = [];
    if (read.injuries) on.push('a');
    if (read.upkeep) on.push('b');
    if (read.world) on.push('c');
    if (read.needs) on.push('d');
    if (read.mortality === MORTALITY.EVERYONE) on.push('e');
    if (read.exposure && read.needs) on.push('f');
    return spell(on);
}

/**
 * En qué modo está una campaña, leído de sus interruptores.
 *
 * @param {any} survival
 * @returns {string} `relajado`, `normal`, `supervivencia` o `custom`.
 */
export function modeOf(survival) {
    const read = readSurvival(survival);
    for (const [id, mode] of Object.entries(MODES)) {
        const want = survivalFor(mode.letters);
        if (Object.keys(want).every(key => /** @type {any} */ (want)[key] === /** @type {any} */ (read)[key])) return id;
    }
    return CUSTOM;
}

/**
 * Cómo se llama un modo.
 *
 * @param {string} id
 * @returns {string}
 */
export function modeLabel(id) {
    return /** @type {any} */ (MODES)[String(id)]?.label ?? CUSTOM_LABEL;
}

/**
 * Si un sistema existe en esta partida.
 *
 * Es la pregunta que se hacen los sistemas antes de pintarse o de pasar: con la cuenta
 * apagada no hay cuenta en la cabecera, ni cobro el viernes, ni «la cuenta» en lo que viene.
 * **Lo apagado no sale**: un botón que no hace nada confunde más que no tenerlo.
 *
 * @param {any} survival
 * @param {string} letter
 * @returns {boolean}
 */
export function hasLetter(survival, letter) {
    return lettersOf(survival).includes(String(letter ?? '').toLowerCase());
}

/**
 * Qué letra hace falta para cada etapa del paso del tiempo (U3). Las que no están aquí
 * pasan siempre: el hilo, las cartas, curar, los despachos, el tablón y la mesa.
 *
 * Los buscados no: son la consecuencia de algo que hiciste tú, no el mundo moviéndose solo.
 */
export const STAGE_LETTERS = {
    necesidades: 'd',
    facciones: 'c',
    deuda: 'b',
    gente: 'c',
    rivales: 'c',
    cuenta: 'b',
    caso: 'c',
};

/**
 * Qué letra hace falta para cada clase de asunto: en «Lo que viene» (U3) y en la mesa (U5).
 */
export const KIND_LETTERS = {
    cuenta: 'b',
    deuda: 'b',
    faccion: 'c',
    caso: 'c',
    herida: 'a',
    // T7: los rivales solo se mueven con el mundo en marcha.
    rivales: 'c',
};

/**
 * Las etapas que pasan en este modo.
 *
 * @template {{id: string}} T
 * @param {T[]} stages
 * @param {any} survival
 * @returns {T[]}
 */
export function stagesFor(stages, survival) {
    const letters = lettersOf(survival);
    return (Array.isArray(stages) ? stages : []).filter(stage => {
        const need = /** @type {Record<string, string>} */ (STAGE_LETTERS)[stage.id];
        return !need || letters.includes(need);
    });
}

/**
 * Lo que se enseña en este modo, de una lista con `kind`.
 *
 * @template {{kind: string}} T
 * @param {T[]} items
 * @param {any} survival
 * @returns {T[]}
 */
export function keepOn(items, survival) {
    const letters = lettersOf(survival);
    return (Array.isArray(items) ? items : []).filter(item => {
        const need = /** @type {Record<string, string>} */ (KIND_LETTERS)[item?.kind];
        return !need || letters.includes(need);
    });
}

/**
 * Lo que está encendido, en una línea: «Normal · Heridas, La cuenta, …».
 *
 * @param {any} survival
 * @returns {string}
 */
export function describeMode(survival) {
    const letters = lettersOf(survival);
    const titles = LETTERS.filter(l => letters.includes(l.id)).map(l => l.title);
    return `${modeLabel(modeOf(survival))} · ${titles.length > 0 ? titles.join(', ') : 'nada encendido'}`;
}

/**
 * Las filas para enseñar qué está encendido y qué no, con su frase.
 *
 * @param {any} survival
 * @returns {Array<{id: string, title: string, note: string, on: boolean, needs: string}>}
 */
export function letterRows(survival) {
    const letters = lettersOf(survival);
    return LETTERS.map(l => ({
        id: l.id, title: l.title, note: l.note, on: letters.includes(l.id),
        needs: l.needs ? (LETTERS.find(n => n.id === l.needs)?.title ?? '') : '',
    }));
}

/**
 * Encender o apagar una letra sobre unos interruptores. Lo que no depende de esa letra no
 * se toca: si habías afinado a mano que se guarde solo en el refugio, sigue así.
 *
 * @param {any} survival
 * @param {string} letter
 * @param {boolean} on
 * @returns {ReturnType<typeof survivalFor>}
 */
export function setLetter(survival, letter, on) {
    const read = readSurvival(survival);
    const id = String(letter ?? '').toLowerCase();
    if (id === 'a') read.injuries = on;
    else if (id === 'b') {
        read.upkeep = on;
        read.loyalty = on;
    } else if (id === 'c') read.world = on;
    else if (id === 'd') {
        read.needs = on;
        // Sin cuerpo, la intemperie no pesa: se apaga con él, como dice `fixLetters`.
        if (!on) read.exposure = false;
    } else if (id === 'e') {
        read.mortality = on ? MORTALITY.EVERYONE : MORTALITY.MERCENARIES;
        read.saves = on ? SAVES.SHELTER : SAVES.FREE;
    } else if (id === 'f') {
        read.exposure = on;
        // Y encenderla sin cuerpo lo enciende: es lo que quien la marca espera.
        if (on) read.needs = true;
    }
    return read;
}

/**
 * Lo que queda escrito al cambiar de modo, y si la partida deja de ser de hierro.
 *
 * Una partida es de hierro si **siempre** lo ha sido: bajar de Supervivencia, aunque sea un
 * día, la saca. Subir no la mete: empezar en Relajado y subir al final no es lo mismo.
 *
 * @param {Object} input
 * @param {any} input.from Los interruptores de antes.
 * @param {any} input.to Los de ahora.
 * @param {number} input.day
 * @param {any} [input.history] Lo que ya se había apuntado.
 * @returns {{history: any, line: string, changed: boolean}}
 */
export function recordModeChange({ from, to, day, history = null }) {
    // Sin historial, la partida era lo que era antes de este cambio: una de hierro que nunca
    // se tocó sigue siéndolo hasta que baje.
    const before = (history && typeof history === 'object') ? readModeHistory(history) : startModeHistory(from);
    const was = modeOf(from);
    const now = modeOf(to);
    const lettersFrom = lettersOf(from);
    const lettersTo = lettersOf(to);
    if (lettersFrom === lettersTo && was === now) return { history: before, line: '', changed: false };

    const lostIron = before.iron && !ironOn(to);
    const changes = [...before.changes, { day: Math.max(1, Math.floor(Number(day) || 1)), from: was, to: now, letters: lettersTo }];
    const line = `Se cambia el modo: de ${modeLabel(was)} a ${modeLabel(now)}.`
        + (lostIron ? ' Esta partida ya no cuenta como de hierro.' : '');
    return {
        history: { iron: before.iron && !lostIron, changes: changes.slice(-20) },
        line,
        changed: true,
    };
}

/**
 * El historial de modos de una partida.
 *
 * `iron` dice si ha sido de hierro desde el principio. Una partida sin historial lo es si
 * empezó con la letra *e*: por eso se escribe al crearla con `startModeHistory`.
 *
 * @param {any} raw
 * @returns {{iron: boolean, changes: Array<{day: number, from: string, to: string, letters: string}>}}
 */
export function readModeHistory(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const changes = Array.isArray(source.changes)
        ? source.changes
            .filter((/** @type {any} */ c) => c && typeof c === 'object')
            .map((/** @type {any} */ c) => ({
                day: Math.max(1, Math.floor(Number(c.day) || 1)),
                from: String(c.from ?? ''),
                to: String(c.to ?? ''),
                letters: String(c.letters ?? ''),
            }))
        : [];
    return { iron: source.iron === true, changes };
}

/**
 * El historial de una partida que empieza.
 *
 * @param {any} survival
 * @returns {{iron: boolean, changes: any[]}}
 */
export function startModeHistory(survival) {
    return { iron: ironOn(survival), changes: [] };
}

/**
 * Si unos interruptores son de hierro de verdad: que pueda morir cualquiera **y** que solo
 * se guarde en el refugio. Con el guardado libre, la muerte se deshace volviendo atrás.
 *
 * @param {any} survival
 * @returns {boolean}
 */
export function ironOn(survival) {
    const read = readSurvival(survival);
    return read.mortality === MORTALITY.EVERYONE && read.saves === SAVES.SHELTER;
}

/**
 * Si la partida cuenta como de hierro para el salón de la fama. Sin historial, se mira lo
 * que hay ahora: una partida anterior a los modos no tiene cómo saberlo mejor.
 *
 * @param {any} survival
 * @param {any} history
 * @returns {boolean}
 */
export function isIronRun(survival, history) {
    if (!history || typeof history !== 'object') return ironOn(survival);
    return readModeHistory(history).iron && ironOn(survival);
}
