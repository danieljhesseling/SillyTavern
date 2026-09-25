/**
 * Encargos que te nombran: el tablón habla de ti según tu trasfondo (idea 116).
 *
 * Los encargos generados eran de cualquiera: un mercader, un alcalde, un sitio. Ahora uno
 * de ellos te busca **a ti**: al soldado le escribe un viejo compañero de armas, al noble
 * su familia, al criminal su antigua banda. Sale del trasfondo que elegiste al crear el
 * personaje, y lleva tu nombre.
 *
 * Uno a la vez: si ya hay uno en el tablón, no sale otro.
 *
 * Puro: con el azar de la semilla, escribe el encargo. Quien llama lo pone en el tablón.
 */

/**
 * La probabilidad de que, al rehacerse el tablón, uno te nombre. A la vista y cambiable,
 * como las demás tablas de azar: el recorrido del navegador la sube a 1.
 */
export const NAMED_CHANCE = { chance: 0.5 };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que le llega a cada trasfondo: el verbo del tablón, quién lo pide y cómo se dice.
 *
 * @type {Record<string, {kind: string, patron: string, phrase: string}>}
 */
export const NAMED = {
    soldado: { kind: 'hold', patron: 'un viejo compañero de armas', phrase: 'Para {hero}: un viejo compañero de armas pide ayuda para aguantar en {place}' },
    criminal: { kind: 'steal', patron: 'tu antigua banda', phrase: 'Para {hero}: tu antigua banda necesita unas manos en {place}' },
    erudito: { kind: 'recover', patron: 'un antiguo maestro', phrase: 'Para {hero}: tu antiguo maestro busca un libro que se perdió en {place}' },
    acolito: { kind: 'escort', patron: 'tu templo', phrase: 'Para {hero}: tu templo pide que acompañes a un peregrino por {place}' },
    forastero: { kind: 'hunt', patron: 'los de tu tierra', phrase: 'Para {hero}: los de tu tierra piden que caces a {target} en {place}' },
    artesano: { kind: 'recover', patron: 'el gremio de tu oficio', phrase: 'Para {hero}: el gremio de tu oficio quiere recuperar sus herramientas de {place}' },
    noble: { kind: 'recover', patron: 'tu familia', phrase: 'Para {hero}: tu familia quiere que recuperes el sello de la casa en {place}' },
    marinero: { kind: 'escort', patron: 'un capitán que te debe una ronda', phrase: 'Para {hero}: un capitán que te debe una ronda pide escolta hasta {place}' },
    charlatan: { kind: 'steal', patron: 'alguien a quien timaste', phrase: 'Para {hero}: alguien a quien timaste te ofrece un trato en {place}' },
    ermitano: { kind: 'cull', patron: 'nadie: lo sabes tú', phrase: 'Para {hero}: algo se ha metido en tu vieja ermita, en {place}' },
};

/**
 * Si ya hay en el tablón uno que te nombra.
 *
 * @param {any[]} board
 * @returns {boolean}
 */
export function hasNamed(board) {
    return (Array.isArray(board) ? board : []).some(c => c?.named);
}

/**
 * El encargo que te nombra, o null si tu trasfondo no dice nada.
 *
 * @param {Object} input
 * @param {any} input.hero
 * @param {string[]} input.places
 * @param {string[]} [input.bestiary]
 * @param {() => number} input.random
 * @param {number} input.day
 * @returns {any|null}
 */
export function namedContract({ hero, places, bestiary = [], random, day }) {
    const spec = NAMED[text(hero?.background).toLowerCase()];
    const where = (Array.isArray(places) ? places : []).map(text).filter(Boolean);
    if (!spec || where.length === 0) return null;
    const place = where[Math.floor(random() * where.length) % where.length];
    const beasts = (Array.isArray(bestiary) ? bestiary : []).map(text).filter(Boolean);
    const target = beasts.length > 0 ? beasts[Math.floor(random() * beasts.length) % beasts.length] : '';
    const kind = spec.kind === 'hunt' && !target ? 'cull' : spec.kind;
    const heroName = text(hero?.name) || 'ti';
    const title = (kind === 'cull' && spec.kind === 'hunt'
        ? 'Para {hero}: los de tu tierra piden que limpies {place}'
        : spec.phrase).replace('{hero}', heroName).replace('{place}', place).replace('{target}', target);
    const today = Math.max(1, Math.floor(Number(day) || 1));
    return {
        id: `n_${text(hero?.background)}_${today}_${Math.floor(random() * 100000)}`,
        rank: 'C',
        kind,
        title,
        locationName: place,
        reward: 70 + Math.floor(random() * 41),
        days: today + 12,
        difficulty: 1,
        patron: spec.patron,
        named: true,
    };
}
