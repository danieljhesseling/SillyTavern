/**
 * E8.2 de wiki/ROADMAP_ENTRETENIDO.md: después del nivel 20, dones épicos en vez de niveles.
 *
 * En 5e el nivel 20 es el techo. La guía del máster sigue después con los dones épicos: cada
 * 30.000 PX de más (por encima de los 355.000 del nivel 20) dan un don. El manual de 2024
 * los trae como dotes de nivel 19 («Epic Boon»), y cada uno sube además una característica
 * en 1, hasta 30. Así el techo no corta el progreso: seguir jugando sigue dando algo.
 *
 * Los dones van **aparte** de las mejoras de cada nivel (`level-perks.js`): no se rehacen en
 * el templo ni ocupan su sitio. Lo que dan se escribe en la ficha al cogerlos (la vida, la
 * velocidad, la característica) o se suma donde ya se suman las mejoras (`boonBonus`, que
 * lee `perkBonus`).
 *
 * Los que el motor no puede jugar tal cual van **adaptados** y lo dicen: «Proeza en combate»
 * convierte un fallo en acierto una vez por turno; aquí es +2 al ataque.
 *
 * Puro: cuenta los dones ganados, ofrece, aplica y suma.
 */

/** Los PX del nivel 20 en la tabla de 5e. */
export const EPIC_XP_START = 355000;

/** Lo que cuesta cada don, en PX, por encima del nivel 20 (la regla de la guía del máster). */
export const EPIC_XP_STEP = 30000;

/** El nivel desde el que se ganan dones en vez de niveles. */
export const EPIC_LEVEL = 20;

/** Hasta dónde sube una característica con los dones (5e: 30). */
export const EPIC_ABILITY_CAP = 30;

/**
 * @typedef {Object} EpicBoon
 * @property {string} id
 * @property {string} label
 * @property {string} describe Lo que hace aquí, dicho llano.
 * @property {string[]} abilities Las características que puede subir en 1.
 * @property {boolean} [adapted] Si el motor lo juega distinto que el libro (y lo dice).
 * @property {{maxHp?: number, speed?: number, attack?: number, initiative?: number, armorClass?: number, skill?: string, amount?: number}} effect
 */

/** Las que puede subir cualquiera. */
const ANY = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

/** @type {EpicBoon[]} */
export const EPIC_BOONS = [
    {
        id: 'don-fortaleza', label: 'Don de la fortaleza', describe: '+40 PG máximos, para siempre.',
        abilities: ANY, effect: { maxHp: 40 },
    },
    {
        id: 'don-velocidad', label: 'Don de la velocidad', describe: '+30 pies de velocidad.',
        abilities: ANY, effect: { speed: 30 },
    },
    {
        id: 'don-proeza', label: 'Don de la proeza en combate',
        describe: '+2 a las tiradas de ataque. (En el libro, una vez por turno un fallo se vuelve acierto.)',
        abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], adapted: true, effect: { attack: 2 },
    },
    {
        id: 'don-destino', label: 'Don del destino',
        describe: '+2 a la iniciativa. (En el libro, sumas o restas 2d4 a una tirada de d20.)',
        abilities: ANY, adapted: true, effect: { initiative: 2 },
    },
    {
        id: 'don-vision', label: 'Don de la visión verdadera',
        describe: '+5 a Percepción: ves lo invisible y lo disfrazado. (En el libro, visión verdadera a 60 pies.)',
        abilities: ['intelligence', 'wisdom', 'charisma'], adapted: true, effect: { skill: 'perception', amount: 5 },
    },
    {
        id: 'don-espiritu-nocturno', label: 'Don del espíritu nocturno',
        describe: '+5 a Sigilo: en la penumbra no te ven. (En el libro, invisible en luz tenue u oscuridad.)',
        abilities: ['intelligence', 'wisdom', 'charisma'], adapted: true, effect: { skill: 'stealth', amount: 5 },
    },
    {
        id: 'don-recuperacion', label: 'Don de la recuperación',
        describe: '+20 PG máximos y +1 a la CA: cuesta tumbarte. (En el libro, vuelves en ti con la mitad de la vida una vez al día.)',
        abilities: ANY, adapted: true, effect: { maxHp: 20, armorClass: 1 },
    },
];

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Los PX en los que empieza el nivel 20 según la tabla de la partida (la de 5e si no hay otra).
 *
 * @param {any} [table] Los umbrales (`[{level, xp}]` o `[[nivel, px]]`).
 * @returns {number}
 */
export function epicStart(table) {
    const rows = Array.isArray(table) ? table : [];
    for (const row of rows) {
        const level = Number(Array.isArray(row) ? row[0] : row?.level);
        const xp = Number(Array.isArray(row) ? row[1] : row?.xp);
        if (level === EPIC_LEVEL && Number.isFinite(xp) && xp > 0) return xp;
    }
    return EPIC_XP_START;
}

/**
 * Los dones que ya ha cogido.
 *
 * @param {any} member
 * @returns {EpicBoon[]}
 */
export function boonsOf(member) {
    const ids = new Set((Array.isArray(member?.epicBoons) ? member.epicBoons : []).map(String));
    return EPIC_BOONS.filter(boon => ids.has(boon.id));
}

/**
 * Cuántos dones le dan sus PX: ninguno hasta el nivel 20; luego uno por cada 30.000 de más.
 *
 * @param {any} member
 * @param {any} [table]
 * @returns {number}
 */
export function boonsEarned(member, table) {
    if (whole(member?.level) < EPIC_LEVEL) return 0;
    const over = whole(member?.xp) - epicStart(table);
    return over >= EPIC_XP_STEP ? Math.floor(over / EPIC_XP_STEP) : 0;
}

/**
 * Los que tiene por coger. Nunca más que los que quedan en la lista.
 *
 * @param {any} member
 * @param {any} [table]
 * @returns {number}
 */
export function pendingBoons(member, table) {
    const taken = Array.isArray(member?.epicBoons) ? member.epicBoons.length : 0;
    const left = EPIC_BOONS.length - boonsOf(member).length;
    return Math.max(0, Math.min(left, boonsEarned(member, table) - taken));
}

/**
 * Cuántos PX le faltan para el siguiente don (0 si no está en el 20).
 *
 * @param {any} member
 * @param {any} [table]
 * @returns {number}
 */
export function xpToNextBoon(member, table) {
    if (whole(member?.level) < EPIC_LEVEL) return 0;
    const next = epicStart(table) + (boonsEarned(member, table) + 1) * EPIC_XP_STEP;
    return Math.max(0, next - whole(member?.xp));
}

/**
 * Los que se pueden elegir: los que no tiene.
 *
 * @param {any} member
 * @returns {EpicBoon[]}
 */
export function boonChoices(member) {
    const taken = new Set(boonsOf(member).map(boon => boon.id));
    return EPIC_BOONS.filter(boon => !taken.has(boon.id));
}

/**
 * La característica que sube el don: la más alta de las que deja, si no ha llegado a 30.
 *
 * @param {any} member
 * @param {EpicBoon} boon
 * @param {string} [chosen] La que se elija, si se elige.
 * @returns {string}
 */
export function boonAbility(member, boon, chosen = '') {
    const open = boon.abilities.filter(key => (Number(member?.[key]) || 10) < EPIC_ABILITY_CAP);
    if (chosen && open.includes(chosen)) return chosen;
    return [...open].sort((a, b) => (Number(member?.[b]) || 10) - (Number(member?.[a]) || 10))[0] ?? '';
}

/**
 * Coger un don: lo que cambia en la ficha.
 *
 * @param {any} member
 * @param {string} boonId
 * @param {{ability?: string, table?: any}} [options]
 * @returns {{ok: boolean, reason: string, patch: Record<string, any>|null, line: string}}
 */
export function takeBoon(member, boonId, { ability = '', table = undefined } = {}) {
    const boon = EPIC_BOONS.find(b => b.id === String(boonId));
    const name = String(member?.name ?? 'Alguien');
    if (!boon) return { ok: false, reason: 'Ese don no existe.', patch: null, line: '' };
    if (boonsOf(member).some(b => b.id === boon.id)) return { ok: false, reason: `${name} ya tiene ${boon.label.toLowerCase()}.`, patch: null, line: '' };
    if (pendingBoons(member, table) <= 0) {
        return { ok: false, reason: `${name} no tiene ningún don por coger: el siguiente llega con ${xpToNextBoon(member, table)} PX más.`, patch: null, line: '' };
    }
    /** @type {Record<string, any>} */
    const patch = { epicBoons: [...(Array.isArray(member?.epicBoons) ? member.epicBoons.map(String) : []), boon.id] };
    if (boon.effect.maxHp) {
        patch.maxHp = (Number(member?.maxHp) || 0) + boon.effect.maxHp;
        patch.hp = (Number(member?.hp) || 0) + boon.effect.maxHp;
    }
    if (boon.effect.speed) patch.speed = (Number(member?.speed) || 30) + boon.effect.speed;
    const key = boonAbility(member, boon, ability);
    if (key) patch[key] = Math.min(EPIC_ABILITY_CAP, (Number(member?.[key]) || 10) + 1);
    const said = ABILITY_WORDS[key] ? ` y +1 a ${ABILITY_WORDS[key]}` : '';
    return { ok: true, reason: '', patch, line: `${name} gana el ${boon.label.toLowerCase()}: ${boon.describe.replace(/\s*\(En el libro.*$/, '').replace(/\.$/, '')}${said}.` };
}

/** Cómo se dice cada característica. */
export const ABILITY_WORDS = /** @type {Record<string, string>} */ ({
    strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución',
    intelligence: 'Inteligencia', wisdom: 'Sabiduría', charisma: 'Carisma',
});

/**
 * Lo que suman los dones a una cosa, como `perkBonus` (la vida y la velocidad ya están en la
 * ficha: aquí no se cuentan).
 *
 * @param {any} member
 * @param {'initiative'|'attack'|'armorClass'|'skill'} kind
 * @param {string} [skill]
 * @returns {number}
 */
export function boonBonus(member, kind, skill = '') {
    return boonsOf(member).reduce((sum, boon) => {
        if (kind === 'skill') return sum + (boon.effect.skill === skill ? Number(boon.effect.amount) || 0 : 0);
        return sum + (Number(boon.effect[kind]) || 0);
    }, 0);
}

/**
 * Para la ficha: los dones, uno por línea.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describeBoons(member) {
    return boonsOf(member).map(boon => `${boon.label}: ${boon.describe}`);
}
