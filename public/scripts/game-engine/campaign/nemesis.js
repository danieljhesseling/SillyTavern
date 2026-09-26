/**
 * La némesis: quien escapa vuelve (R7 del roadmap de profundidad).
 *
 * Un enemigo que huye de una pelea no desaparece del mundo. Se lleva una cicatriz y rencor,
 * y más adelante vuelve: en otro encargo, en otro sitio, un poco más fuerte y con algo
 * aprendido. Y el narrador lo sabe. Es el «Némesis» de *Sombras de Mordor*, en pequeño.
 *
 * Reglas:
 *
 * - Como mucho tres a la vez: más que eso es una lista, no una historia.
 * - Vuelve a partir de cinco días después, con una probabilidad por encargo.
 * - Cada vez que vuelve y escapa otra vez, sube un escalón: más vida y una frase nueva.
 * - Si cae, se acaba, y queda en la crónica.
 *
 * Puro: decide y cuenta. Quien llama guarda y coloca.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R7.
 */

/** Cuántas a la vez, y cuándo pueden volver. */
export const NEMESIS = { max: 3, afterDays: 5, chance: 0.35 };

/** Las cicatrices, según con qué le dieron. */
const SCARS = {
    fuego: 'la cara quemada',
    frio: 'dos dedos menos',
    corte: 'una cicatriz de oreja a boca',
    golpe: 'una cojera que no se le quita',
    otro: 'una mirada que no olvida',
};

/** Lo que dice al volver, por veces. */
const RETURNS = [
    '«¿Os acordáis de mí? Yo de vosotros, sí.»',
    '«Esta vez no voy a salir corriendo.»',
    '«Tres veces. A la tercera va la vencida.»',
];

/**
 * @typedef {Object} Nemesis
 * @property {string} id
 * @property {string} name
 * @property {string} scar
 * @property {string} grudge Contra quién.
 * @property {number} times Cuántas veces ha escapado.
 * @property {number} since El día en que escapó la última vez.
 * @property {boolean} gone Si cayó.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {Nemesis[]}
 */
export function readNemeses(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(n => text(n?.name))
        .map(n => ({
            id: text(n.id) || `nemesis-${text(n.name).toLowerCase().replace(/[^a-z0-9ñ]+/g, '-')}`,
            name: text(n.name),
            scar: text(n.scar) || SCARS.otro,
            grudge: text(n.grudge),
            times: Math.max(1, Math.floor(Number(n.times) || 1)),
            since: Math.max(1, Math.floor(Number(n.since) || 1)),
            gone: n.gone === true,
        }));
}

/**
 * Alguien ha escapado. Si ya era una némesis, sube un escalón.
 *
 * @param {Object} input
 * @param {any} input.raw
 * @param {string} input.name
 * @param {string} [input.cause] Con qué le dieron: fuego, frio, corte, golpe.
 * @param {string} [input.grudge] Contra quién.
 * @param {number} input.day
 * @returns {{list: Nemesis[], line: string}}
 */
export function noteEscape({ raw, name, cause = '', grudge = '', day }) {
    const list = readNemeses(raw);
    const who = text(name).replace(/\s+\d+$/, '');
    const found = list.find(n => n.name === who && !n.gone);
    if (found) {
        const next = list.map(n => (n === found ? { ...n, times: n.times + 1, since: day } : n));
        return { list: next, line: `${who} vuelve a escapar. No será la última vez.` };
    }
    const alive = list.filter(n => !n.gone);
    if (alive.length >= NEMESIS.max) return { list, line: '' };
    const scar = /** @type {Record<string, string>} */ (SCARS)[text(cause)] ?? SCARS.otro;
    const made = { id: `nemesis-${who.toLowerCase().replace(/[^a-z0-9ñ]+/g, '-')}`, name: who, scar, grudge: text(grudge), times: 1, since: day, gone: false };
    return { list: [...list, made], line: `${who} escapa con ${scar}${grudge ? `, y se acordará de ${grudge}` : ''}.` };
}

/**
 * Si vuelve alguna en este encargo, y cuál.
 *
 * @param {Object} input
 * @param {any} input.raw
 * @param {number} input.today
 * @param {() => number} input.random
 * @returns {Nemesis|null}
 */
export function whoReturns({ raw, today, random }) {
    const ready = readNemeses(raw).filter(n => !n.gone && today - n.since >= NEMESIS.afterDays);
    if (ready.length === 0 || !(random() < NEMESIS.chance)) return null;
    return ready[Math.floor(random() * ready.length) % ready.length];
}

/**
 * Cómo vuelve: más vida por cada vez que escapó, y lo que dice.
 *
 * @param {Nemesis} nemesis
 * @returns {{hpFactor: number, line: string, forModel: string}}
 */
export function comeback(nemesis) {
    const said = RETURNS[Math.min(RETURNS.length - 1, nemesis.times - 1)];
    return {
        hpFactor: 1 + 0.25 * nemesis.times,
        line: `😈 ${nemesis.name} vuelve, con ${nemesis.scar}. ${said}`,
        forModel: `[NÉMESIS] ${nemesis.name} vuelve: ya escapó ${nemesis.times === 1 ? 'una vez' : `${nemesis.times} veces`} y lleva ${nemesis.scar}${nemesis.grudge ? `; tiene cuentas pendientes con ${nemesis.grudge}` : ''}. Que se note que os conoce. No cambies nada más.`,
    };
}

/**
 * Cayó: se acaba.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {{list: Nemesis[], line: string}}
 */
export function nemesisFalls(raw, name) {
    const list = readNemeses(raw);
    const who = text(name).replace(/\s+\d+$/, '');
    const found = list.find(n => n.name === who && !n.gone);
    if (!found) return { list, line: '' };
    return {
        list: list.map(n => (n === found ? { ...n, gone: true } : n)),
        line: `${who} cae por fin. Después de ${found.times === 1 ? 'una huida' : `${found.times} huidas`}, se acabó.`,
    };
}
