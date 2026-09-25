/**
 * El tiempo y la hora en el tablero: niebla, lluvia, viento y noche (ideas 73 y 90).
 *
 * El clima ya existía para el viaje y la hora para el calendario, pero en combate daba igual
 * pelear a mediodía que a medianoche, con sol o con niebla. Ahora cuentan, y todo por el
 * mismo sitio (la ventaja y la desventaja del ataque):
 *
 * - **Niebla o tormenta**: más allá de 30 pies no se ve bien; **nieve**, más allá de 60.
 * - **Viento**: lo que se dispara o se lanza se desvía (a más de 5 pies).
 * - **Lluvia o tormenta**: el fuego no prende (el aceite no arde).
 * - **Noche** (a cielo abierto): sin luz, más allá de 30 pies no se ve; con una antorcha o
 *   un farol en el grupo, más allá de 60. Y la niebla de guerra, si el tablero la tiene,
 *   se cierra igual.
 *
 * Bajo techo no hay tiempo que valga; y de noche, bajo techo, hay velas.
 *
 * Puro: dice lo que hay y lo que cambia. Quien llama lo suma al ataque y al fuego.
 */

/** Lo que hace cada tiempo en combate. */
export const WEATHER_IN_COMBAT = {
    niebla: { maxFeet: 30, reason: 'con esta niebla no se ve' },
    tormenta: { maxFeet: 30, reason: 'la tormenta no deja ver', wet: true, windy: true },
    lluvia: { wet: true },
    nieve: { maxFeet: 60, reason: 'la nieve lo emborrona todo' },
    viento: { windy: true },
};

/** Hasta dónde se ve de noche, sin luz y con ella. */
export const NIGHT_FEET = { dark: 30, lit: 60 };

/** Lo que alumbra, por el nombre de lo que se lleva. */
const LIGHTS = /antorcha|farol|linterna|lámpara|lampara|vela/i;

/** Lo que es un sitio con techo, por el nombre del tablero o el tipo de sitio. */
const ROOFED = /cuarto|sal[oó]n|s[oó]tano|cripta|cueva|mina|taberna|posada|tienda|torre|bodega|capilla|celda|t[uú]nel|mazmorra/i;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si es de noche, por la franja del calendario.
 *
 * @param {string} slot «Mañana», «Tarde», «Noche», «Madrugada»…
 * @returns {boolean}
 */
export function isNight(slot) {
    return /noche|madrugada/i.test(text(slot));
}

/**
 * Si un tablero está bajo techo: lo dice el tablero (`indoors`), el tipo de sitio o, si no,
 * su nombre.
 *
 * @param {any} board
 * @param {any} [location]
 * @returns {boolean}
 */
export function isIndoors(board, location = null) {
    if (typeof board?.indoors === 'boolean') return board.indoors;
    if (['dungeon'].includes(text(location?.locationType ?? location?.type).toLowerCase())) return true;
    return ROOFED.test(text(board?.name));
}

/**
 * Si alguien del grupo lleva algo que alumbre.
 *
 * @param {any[]} party
 * @returns {boolean}
 */
export function carriesLight(party) {
    return (Array.isArray(party) ? party : []).some(member => !member?.dead
        && (Array.isArray(member?.items) ? member.items : []).some((/** @type {any} */ item) => LIGHTS.test(text(item?.name))));
}

/**
 * Cómo se ve y qué pasa en el tablero ahora mismo.
 *
 * @param {Object} input
 * @param {string} [input.weather] El tiempo de hoy aquí (`niebla`, `lluvia`…).
 * @param {string} [input.slot] La franja del día.
 * @param {boolean} [input.indoors]
 * @param {boolean} [input.lit] Si el grupo lleva luz.
 * @returns {{maxFeet: number|null, reasons: string[], windy: boolean, wet: boolean, note: string}}
 */
export function combatVisibility({ weather = '', slot = '', indoors = false, lit = false }) {
    if (indoors) return { maxFeet: null, reasons: [], windy: false, wet: false, note: '' };
    /** @type {{maxFeet?: number, reason?: string, wet?: boolean, windy?: boolean}} */
    const effect = WEATHER_IN_COMBAT[/** @type {keyof typeof WEATHER_IN_COMBAT} */ (text(weather).toLowerCase())] ?? {};
    /** @type {Array<{feet: number, reason: string}>} */
    const limits = [];
    if (effect.maxFeet) limits.push({ feet: effect.maxFeet, reason: effect.reason ?? '' });
    if (isNight(slot)) {
        limits.push(lit
            ? { feet: NIGHT_FEET.lit, reason: 'es de noche, y la luz no llega más lejos' }
            : { feet: NIGHT_FEET.dark, reason: 'es de noche' });
    }
    const worst = limits.sort((a, b) => a.feet - b.feet)[0] ?? null;
    const windy = Boolean(effect.windy);
    const wet = Boolean(effect.wet);
    const bits = [
        worst ? `no se ve más allá de ${worst.feet} pies (${worst.reason})` : '',
        windy ? 'el viento desvía lo que se tira' : '',
        wet ? 'con esta agua, el fuego no prende' : '',
    ].filter(Boolean);
    return {
        maxFeet: worst ? worst.feet : null,
        reasons: worst ? [worst.reason] : [],
        windy,
        wet,
        note: bits.length > 0 ? `${bits.join('; ')}.`.replace(/^./, c => c.toUpperCase()) : '',
    };
}

/**
 * Lo que la vista y el viento le hacen a un ataque a esa distancia: la razón para la
 * desventaja, o nada.
 *
 * @param {{maxFeet: number|null, reasons: string[], windy: boolean}} visibility
 * @param {number} distanceFeet
 * @returns {string[]}
 */
export function visibilityPenalties(visibility, distanceFeet) {
    /** @type {string[]} */
    const out = [];
    const far = Number(distanceFeet) || 0;
    if (visibility?.maxFeet != null && far > visibility.maxFeet) out.push(visibility.reasons[0] || 'no se ve bien');
    if (visibility?.windy && far > 5) out.push('el viento lo desvía');
    return out;
}

/**
 * Hasta dónde ve cada uno en la niebla de guerra.
 *
 * @param {{maxFeet: number|null}} visibility
 * @param {number} baseFeet
 * @returns {number}
 */
export function sightFeetFor(visibility, baseFeet) {
    const base = Math.max(0, Number(baseFeet) || 0);
    return visibility?.maxFeet != null ? Math.min(base, visibility.maxFeet) : base;
}
