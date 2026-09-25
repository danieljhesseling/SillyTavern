/**
 * Lo que cada uno lleva encima de la campaña: hazañas, apodos, rasgos y cicatrices.
 *
 * - **Hazañas** (la cuenta): a quién ha tumbado, cuántos críticos, cuántas veces cayó y se
 *   levantó, a cuántos salvó. Las apunta el motor al pasar; nadie las escribe a mano.
 * - **Apodos** (idea 44): con hazañas suficientes, un apodo que se queda. «Bruna Tres Vidas».
 * - **Rasgos** (idea 47): tumbar a cinco de lo mismo enseña a pelear contra ello: +1 al
 *   ataque contra esa criatura.
 * - **Cicatrices** (idea 56): una herida que se cura deja marca, y la marca impone: +1 a
 *   Intimidación por cicatriz, hasta +2.
 * - **Qué quiere ahora** (idea 38): una línea en su ficha, para saber cómo ganártelo.
 *
 * Puro: devuelve la cuenta nueva; quien llama la guarda en la ficha.
 */

/** Cuántos de lo mismo hacen falta para aprender a pelear contra ello. */
export const TRAIT_AT = 5;

/** Lo más que suman las cicatrices a Intimidación. */
export const SCAR_CAP = 2;

/**
 * @typedef {Object} Feats
 * @property {number} kills
 * @property {number} crits
 * @property {number} downed  Veces que cayó a 0 y siguió vivo.
 * @property {number} rescues Veces que se interpuso por otro.
 * @property {Record<string, number>} killsBy Tumbados, por nombre de criatura.
 * @property {Record<string, number>} hitsWith Golpes que han entrado, por arma (idea 55).
 */

/** @param {any} value @returns {number} */
const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * @param {any} member
 * @returns {Feats}
 */
export function readFeats(member) {
    const raw = member?.feats ?? {};
    /** @type {Record<string, number>} */
    const killsBy = {};
    for (const [name, n] of Object.entries(raw.killsBy ?? {})) if (count(n) > 0) killsBy[String(name)] = count(n);
    /** @type {Record<string, number>} */
    const hitsWith = {};
    for (const [name, n] of Object.entries(raw.hitsWith ?? {})) if (count(n) > 0) hitsWith[String(name)] = count(n);
    return { kills: count(raw.kills), crits: count(raw.crits), downed: count(raw.downed), rescues: count(raw.rescues), killsBy, hitsWith };
}

/**
 * Apuntar una hazaña.
 *
 * @param {any} member
 * @param {'kill'|'crit'|'downed'|'rescue'|'hit'} kind
 * @param {string} [about] Para `kill`, a quién; para `hit`, con qué arma.
 * @returns {Feats}
 */
export function noteFeat(member, kind, about = '') {
    const feats = readFeats(member);
    if (kind === 'kill') {
        feats.kills += 1;
        const name = String(about).trim();
        if (name) feats.killsBy[name] = (feats.killsBy[name] ?? 0) + 1;
    }
    if (kind === 'crit') feats.crits += 1;
    if (kind === 'hit' && String(about).trim()) feats.hitsWith[String(about).trim()] = (feats.hitsWith[String(about).trim()] ?? 0) + 1;
    if (kind === 'downed') feats.downed += 1;
    if (kind === 'rescue') feats.rescues += 1;
    return feats;
}

/** Los apodos, por orden: el primero que se gana es el que se queda. */
export const NICKNAMES = [
    { id: 'tres-vidas', name: 'Tres Vidas', why: 'cayó tres veces y se levantó las tres', test: (/** @type {Feats} */ f) => f.downed >= 3 },
    { id: 'escudo', name: 'el Escudo', why: 'se ha puesto delante de los suyos más de una vez', test: (/** @type {Feats} */ f) => f.rescues >= 2 },
    { id: 'mano-de-hierro', name: 'Mano de Hierro', why: 'cinco golpes que todavía se cuentan', test: (/** @type {Feats} */ f) => f.crits >= 5 },
    { id: 'siegavidas', name: 'Siegavidas', why: 'lleva quince enemigos tumbados', test: (/** @type {Feats} */ f) => f.kills >= 15 },
    { id: 'mil-cicatrices', name: 'Mil Cicatrices', why: 'lleva la campaña escrita en la piel', test: (/** @type {Feats} */ _f, /** @type {number} */ scars) => scars >= 3 },
];

/**
 * El apodo que se acaba de ganar, si hay uno nuevo. Quien ya tiene apodo lo conserva: un
 * apodo que cambia cada semana no es un apodo.
 *
 * @param {any} member
 * @returns {{name: string, why: string}|null}
 */
export function newNickname(member) {
    if (String(member?.nickname ?? '').trim()) return null;
    const feats = readFeats(member);
    const scars = Array.isArray(member?.scars) ? member.scars.length : 0;
    const earned = NICKNAMES.find(n => n.test(feats, scars));
    return earned ? { name: earned.name, why: earned.why } : null;
}

/**
 * Lo que ha aprendido a fuerza de tumbar a lo mismo.
 *
 * @param {any} member
 * @returns {Array<{vs: string, label: string}>}
 */
export function traitsOf(member) {
    return Object.entries(readFeats(member).killsBy)
        .filter(([, n]) => n >= TRAIT_AT)
        .map(([vs]) => ({ vs, label: `Sabe pelear contra ${vs}: +1 al atacarle` }));
}

/**
 * Lo que suma al ataque contra esa criatura.
 *
 * @param {any} member
 * @param {string} enemyName
 * @returns {number}
 */
export function traitBonus(member, enemyName) {
    const name = String(enemyName ?? '').trim().toLowerCase();
    return traitsOf(member).some(t => t.vs.toLowerCase() === name) ? 1 : 0;
}

/**
 * Una herida curada que deja marca. Se guardan las últimas cinco.
 *
 * @param {any} member
 * @param {string} injuryLabel
 * @returns {string[]}
 */
export function addScar(member, injuryLabel) {
    const scars = Array.isArray(member?.scars) ? member.scars.map(String) : [];
    const label = `Cicatriz de ${String(injuryLabel).trim().toLowerCase()}`;
    if (!String(injuryLabel).trim()) return scars;
    return [...scars, label].slice(-5);
}

/**
 * Lo que las cicatrices suman a Intimidación.
 *
 * @param {any} member
 * @returns {number}
 */
export function scarBonus(member) {
    return Math.min(SCAR_CAP, Array.isArray(member?.scars) ? member.scars.length : 0);
}

/**
 * Qué quiere ahora (idea 38): lo que más pesa, en una línea.
 *
 * Primero el cuerpo (malherido, hambriento), porque eso manda sobre todo; luego lo que le
 * mueve.
 *
 * @param {Object} input
 * @param {string} input.wants
 * @param {number} input.hpPct
 * @param {boolean} [input.hungry]
 * @param {boolean} [input.tired]
 * @param {string} [input.mourning] Por quién guarda duelo (idea 43).
 * @returns {string}
 */
export function desireLine({ wants, hpPct, hungry = false, tired = false, mourning = '' }) {
    if (mourning) return `Está de duelo por ${mourning}: pide un día.`;
    if (Number(hpPct) < 40) return 'Necesita curarse antes de volver a pelear.';
    if (hungry) return 'Tiene hambre: una comida caliente le cambiaría la cara.';
    if (tired) return 'Está agotado: pide una noche bajo techo.';
    switch (String(wants)) {
        case 'coin': return 'Quiere un encargo que pague bien (40 de oro o más).';
        case 'glory': return 'Quiere pelea de verdad: una caza, o aguantar una posición.';
        case 'blood': return 'Quiere pelea, la que sea.';
        case 'quiet': return 'Prefiere encargos sin sangre.';
        case 'knowledge': return 'Quiere ver cosas nuevas: recuperar, investigar, preguntar.';
        default: return '';
    }
}

/**
 * La historia de alguien (idea 57): lo que ha hecho, lo que le ha pasado y lo que se ha
 * ganado, por orden. Sale de lo que el motor ya apuntó; no se inventa nada.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {Array<{day: number, text: string}>} [input.deeds]
 * @param {Array<{day: number, text: string, who: string[]}>} [input.memories]
 * @returns {string[]}
 */
export function heroStory({ member, deeds = [], memories = [] }) {
    const name = String(member?.name ?? '').trim();
    const lower = name.toLowerCase();
    /** @type {Array<{day: number, text: string}>} */
    const lines = [];
    for (const deed of deeds) {
        if (String(deed?.text ?? '').toLowerCase().includes(lower)) lines.push({ day: Number(deed.day) || 0, text: String(deed.text) });
    }
    for (const memory of memories) {
        const was = (memory?.who ?? []).some((/** @type {string} */ w) => String(w).toLowerCase() === lower);
        if (was && !lines.some(l => l.text === memory.text)) lines.push({ day: Number(memory.day) || 0, text: String(memory.text) });
    }
    lines.sort((a, b) => a.day - b.day);
    const feats = readFeats(member);
    const tail = [
        member?.nickname ? `Le llaman «${member.nickname}».` : '',
        feats.kills > 0 ? `Lleva ${feats.kills} enemigo${feats.kills === 1 ? '' : 's'} tumbado${feats.kills === 1 ? '' : 's'}${feats.crits ? ` y ${feats.crits} golpe${feats.crits === 1 ? '' : 's'} que se recuerdan` : ''}.` : '',
        feats.downed > 0 ? `Ha caído ${feats.downed} ${feats.downed === 1 ? 'vez' : 'veces'} y se ha levantado.` : '',
        feats.rescues > 0 ? `Se ha puesto delante de los suyos ${feats.rescues} ${feats.rescues === 1 ? 'vez' : 'veces'}.` : '',
        ...traitsOf(member).map(t => `${t.label}.`),
        ...(Array.isArray(member?.scars) ? member.scars.map((/** @type {string} */ s) => `${s}.`) : []),
    ].filter(Boolean);
    return [...lines.map(l => `Día ${l.day}: ${l.text}`), ...tail];
}

/** Golpes que hacen falta con un arma para cogerle el tranquillo (idea 55). */
export const KNACK_AT = 15;

/**
 * Lo que suma al daño el arma que lleva, si ya le ha cogido el tranquillo.
 *
 * @param {any} member
 * @param {string} weaponName
 * @returns {number}
 */
export function knackBonus(member, weaponName) {
    const name = String(weaponName ?? '').trim();
    return name && (readFeats(member).hitsWith[name] ?? 0) >= KNACK_AT ? 1 : 0;
}

/**
 * Las armas a las que ha cogido el tranquillo, para su ficha.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function knacksOf(member) {
    return Object.entries(readFeats(member).hitsWith)
        .filter(([, n]) => n >= KNACK_AT)
        .map(([weapon]) => `Soltura con ${weapon}: +1 al daño`);
}
