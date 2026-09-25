/**
 * La fama del grupo, sitio a sitio (idea 52).
 *
 * La reputación del gremio es una cifra de todo el mundo, y la de una facción es lo que
 * piensa un bando. Faltaba lo más de andar por casa: que en el pueblo donde matasteis a los
 * lobos os saluden por el nombre, y que en el de al lado no os conozca nadie.
 *
 * Se gana haciendo cosas **en** un sitio: entregar un encargo allí, ganar un tablero allí o
 * cumplir allí un hito del hilo. Se nota en tres sitios:
 *
 * - **La tienda** rebaja un poco a quien conoce (`priceToday`).
 * - **El narrador** lo sabe: la gente del sitio os trata como a quien sois allí.
 * - **El diario** dice dónde sois alguien.
 *
 * Puro: cuenta y dice. Quien llama guarda.
 */

/** Los peldaños: desde cuántos puntos, cómo se dice y lo que rebaja la tienda. */
export const FAME_LEVELS = [
    { at: 0, label: '', discount: 0 },
    { at: 2, label: 'os conocen', discount: 0.05 },
    { at: 5, label: 'sois alguien', discount: 0.1 },
    { at: 9, label: 'sois los héroes del sitio', discount: 0.15 },
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function readFame(raw) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const [place, points] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
        const n = Math.max(0, Math.floor(Number(points) || 0));
        if (text(place) && n > 0) out[text(place)] = n;
    }
    return out;
}

/**
 * Cómo de conocidos sois en un sitio.
 *
 * @param {any} raw
 * @param {string} place
 * @returns {{points: number, level: number, label: string, discount: number}}
 */
export function fameAt(raw, place) {
    const fame = readFame(raw);
    const key = Object.keys(fame).find(k => k.toLowerCase() === text(place).toLowerCase());
    const points = key ? fame[key] : 0;
    let level = 0;
    FAME_LEVELS.forEach((step, index) => { if (points >= step.at) level = index; });
    return { points, level, label: FAME_LEVELS[level].label, discount: FAME_LEVELS[level].discount };
}

/**
 * Sumar fama en un sitio, y decir si se ha subido un peldaño.
 *
 * @param {any} raw
 * @param {string} place
 * @param {number} [amount]
 * @returns {{fame: Record<string, number>, rose: boolean, label: string}}
 */
export function addFame(raw, place, amount = 1) {
    const fame = readFame(raw);
    const where = text(place);
    if (!where) return { fame, rose: false, label: '' };
    const before = fameAt(fame, where);
    const key = Object.keys(fame).find(k => k.toLowerCase() === where.toLowerCase()) ?? where;
    fame[key] = Math.max(0, (fame[key] ?? 0) + Math.floor(Number(amount) || 0));
    const after = fameAt(fame, where);
    return { fame, rose: after.level > before.level, label: after.label };
}

/**
 * Para el narrador, en el bloque de lo que pasa aquí. Vacío donde no os conoce nadie.
 *
 * @param {any} raw
 * @param {string} place
 * @returns {string}
 */
export function fameNote(raw, place) {
    const { level, label } = fameAt(raw, place);
    if (level === 0) return '';
    return `En ${text(place)} ${label}: la gente de aquí os trata en consecuencia.`;
}

/**
 * Para el diario: dónde sois alguien, de más a menos.
 *
 * @param {any} raw
 * @returns {string[]}
 */
export function describeFame(raw) {
    return Object.entries(readFame(raw))
        .map(([place, points]) => ({ place, points, ...fameAt(raw, place) }))
        .filter(f => f.level > 0)
        .sort((a, b) => b.points - a.points || a.place.localeCompare(b.place))
        .map(f => `${f.place}: ${f.label}`);
}
