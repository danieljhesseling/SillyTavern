/**
 * Nombres que suenan al sitio del que salen.
 *
 * Una fila de `nombres.json` no es un nombre: es **de que se hacen** los nombres de una
 * cultura. Trae sus trozos y sus plantillas, y de ahi salen cientos. Veinte silabas dan
 * mas nombres que doscientos escritos a mano, y ademas los da **coherentes**: los del
 * norte se parecen entre si porque comparten trozos.
 *
 * La plantilla es texto con huecos —`"{inicio}{fin}"`, `"El {adjetivo} {animal}"`— y eso
 * es a proposito: sirve igual para una persona, un vado y una taberna, se lee sin saber
 * programar y se cambia sin tocar codigo. Un solo mecanismo para las cuatro cosas.
 *
 * Puro: recibe el compendio y el azar, y devuelve texto.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#159-#170) y wiki/ROADMAP_COMPENDIO.md, B1.
 */

/** Lo que se puede pedir. Es el campo `kind` de la bateria. */
export const NAME_KINDS = ['person', 'place', 'tavern', 'nickname'];

/** Cuantas veces se reintenta antes de rendirse cuando el nombre ya estaba cogido. */
const TRIES = 12;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Rellena una plantilla con los trozos que pida.
 *
 * Un hueco que no existe se deja **tal cual**, con sus llaves: verlo en pantalla dice
 * exactamente que falta y en que fila, que es mas util que un nombre a medias.
 *
 * @param {string} pattern
 * @param {Record<string, string[]>} parts
 * @param {() => number} random
 * @returns {string}
 */
export function fillPattern(pattern, parts, random) {
    return text(pattern).replace(/\{([a-z0-9_]+)\}/gi, (whole, key) => {
        const pool = parts?.[key];
        if (!Array.isArray(pool) || pool.length === 0) return whole;
        return text(pool[Math.floor(random() * pool.length) % pool.length]);
    });
}

/**
 * Un nombre de una fila concreta.
 *
 * Las plantillas se sortean a lo bruto y repetir una en la lista es subirle el peso. Es
 * el truco mas barato que hay para pesar algo desde un JSON que edita una persona.
 *
 * @param {any} row
 * @param {() => number} random
 * @returns {string}
 */
export function nameFromRow(row, random) {
    const patterns = Array.isArray(row?.patterns) ? row.patterns.filter(Boolean) : [];
    if (patterns.length === 0) return '';

    const pattern = patterns[Math.floor(random() * patterns.length) % patterns.length];
    return fillPattern(pattern, row?.parts ?? {}, random).replace(/\s+/g, ' ').trim();
}

/**
 * Un nombre del compendio, o cadena vacia si esa bateria no esta.
 *
 * Vacio **no es un error**: es la bateria que todavia no has escrito, y quien llama sigue
 * con lo que hiciera antes. Es la regla que permite ir una bateria por tarde.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {string} [input.kind]    Persona, sitio, taberna, apodo.
 * @param {string} [input.culture] La del mundo, si la tiene.
 * @param {string} [input.region]
 * @param {() => number} [input.random]
 * @param {Iterable<string>} [input.taken] Los que ya estan cogidos en este sitio.
 * @returns {string}
 */
export function makeName({
    compendium, kind = 'person', culture = '', region = '', random = Math.random, taken = [],
}) {
    if (!compendium?.has?.('nombres')) return '';

    const where = { kind };
    if (text(culture)) where.culture = text(culture);
    if (text(region)) where.region = text(region);

    // Nada de esa cultura no puede dejarte sin nombre: se prueba sin ella antes de
    // rendirse. Un mundo con una cultura sin escribir sigue teniendo gente.
    const row = compendium.pick('nombres', { where, random })
        ?? compendium.pick('nombres', { where: { kind }, random });
    if (!row) return '';

    const used = new Set([...taken].map(name => text(name).toLowerCase()));
    for (let i = 0; i < TRIES; i++) {
        const name = nameFromRow(row, random);
        if (!name) return '';
        if (!used.has(name.toLowerCase())) return name;
    }

    // Se acabaron los intentos: mejor uno repetido que ninguno, y quien llama ya sabe
    // cuales tenia cogidos.
    return nameFromRow(row, random);
}

/**
 * Varios de golpe, sin repetirse entre ellos.
 *
 * Es lo que pide un pueblo: diez personas con diez nombres, no diez tiradas sueltas que
 * a veces coinciden.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {number} input.howMany
 * @param {string} [input.kind]
 * @param {string} [input.culture]
 * @param {string} [input.region]
 * @param {() => number} [input.random]
 * @returns {string[]}
 */
export function makeNames({ compendium, howMany, kind = 'person', culture = '', region = '', random = Math.random }) {
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < Math.max(0, howMany); i++) {
        const name = makeName({ compendium, kind, culture, region, random, taken: out });
        if (!name) break;
        out.push(name);
    }
    return out;
}

/**
 * Las culturas que la bateria trae, para poder ofrecerlas.
 *
 * @param {any} compendium
 * @param {string} [kind]
 * @returns {string[]}
 */
export function culturesOf(compendium, kind = 'person') {
    if (!compendium?.has?.('nombres')) return [];
    const found = compendium.find('nombres', { kind })
        .map((/** @type {any} */ row) => text(row.culture))
        .filter(Boolean);
    return [...new Set(found)];
}
