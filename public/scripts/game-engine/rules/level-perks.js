/**
 * Subir de nivel como momento: una mejora a elegir entre tres (idea 46).
 *
 * Subir de nivel era una cuenta: más vida, un dado de golpe y, a veces, puntos de
 * característica. Todo números. Aquí, además, se **elige** una cosa de entre tres, y cada
 * una cambia algo que se nota jugando: la iniciativa, una habilidad concreta, la velocidad,
 * la vida. Dos guerreros del mismo nivel dejan de ser iguales.
 *
 * Las tres que se ofrecen salen con la semilla de quién sube y a qué nivel: la misma subida
 * ofrece lo mismo, y lo que ya se tiene no se vuelve a ofrecer.
 *
 * Cada mejora toca **un número que ya se lee en alguna parte** (`perkBonus`): la vida y la
 * velocidad se escriben en la ficha; la iniciativa, el ataque, la CA y las habilidades se
 * suman donde ya se suman sus parecidos.
 *
 * Puro: ofrece, aplica y suma. Quien llama tira la semilla y guarda la ficha.
 */

/**
 * @typedef {Object} Perk
 * @property {string} id
 * @property {string} label
 * @property {string} describe
 * @property {{maxHp?: number, speed?: number, initiative?: number, attack?: number, armorClass?: number, skill?: string, amount?: number}} effect
 */

/** @type {Perk[]} */
export const PERKS = [
    { id: 'aguante', label: 'Aguante', describe: '+4 PG máximos, para siempre.', effect: { maxHp: 4 } },
    { id: 'reflejos', label: 'Reflejos', describe: '+2 a la iniciativa.', effect: { initiative: 2 } },
    { id: 'pies-ligeros', label: 'Pies ligeros', describe: '+5 pies de velocidad.', effect: { speed: 5 } },
    { id: 'mano-firme', label: 'Mano firme', describe: '+1 a las tiradas de ataque.', effect: { attack: 1 } },
    { id: 'piel-dura', label: 'Piel dura', describe: '+1 a la CA.', effect: { armorClass: 1 } },
    { id: 'ojo-avizor', label: 'Ojo avizor', describe: '+2 a Percepción.', effect: { skill: 'perception', amount: 2 } },
    { id: 'labia', label: 'Labia', describe: '+2 a Persuasión.', effect: { skill: 'persuasion', amount: 2 } },
    { id: 'paso-de-gato', label: 'Paso de gato', describe: '+2 a Sigilo.', effect: { skill: 'stealth', amount: 2 } },
    { id: 'mirada-dura', label: 'Mirada dura', describe: '+2 a Intimidación.', effect: { skill: 'intimidation', amount: 2 } },
    { id: 'buen-ojo', label: 'Buen ojo', describe: '+2 a Perspicacia.', effect: { skill: 'insight', amount: 2 } },
    { id: 'brazo-fuerte', label: 'Brazo fuerte', describe: '+2 a Atletismo.', effect: { skill: 'athletics', amount: 2 } },
    { id: 'dedos-listos', label: 'Dedos listos', describe: '+2 a Juego de manos.', effect: { skill: 'sleight', amount: 2 } },
];

/** Cuántas se ofrecen. */
export const PERK_CHOICES = 3;

/**
 * Las que ya tiene alguien.
 *
 * @param {any} member
 * @returns {Perk[]}
 */
export function perksOf(member) {
    const ids = new Set((Array.isArray(member?.perks) ? member.perks : []).map(String));
    return PERKS.filter(p => ids.has(p.id));
}

/**
 * Las tres que se ofrecen al subir: con la semilla, sin repetir lo que ya se tiene.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {() => number} input.random
 * @returns {Perk[]}
 */
export function perkChoices({ member, random }) {
    const taken = new Set(perksOf(member).map(p => p.id));
    const pool = PERKS.filter(p => !taken.has(p.id));
    /** @type {Perk[]} */
    const out = [];
    while (out.length < PERK_CHOICES && pool.length > 0) {
        out.push(pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0]);
    }
    return out;
}

/**
 * Coger una: lo que cambia en la ficha. La vida y la velocidad se escriben ya; lo demás se
 * suma donde se usa (`perkBonus`).
 *
 * @param {any} member
 * @param {string} perkId
 * @returns {{perks: string[], maxHp?: number, hp?: number, speed?: number}|null}
 */
export function takePerk(member, perkId) {
    const perk = PERKS.find(p => p.id === String(perkId));
    if (!perk) return null;
    const perks = [...new Set([...(Array.isArray(member?.perks) ? member.perks.map(String) : []), perk.id])];
    /** @type {{perks: string[], maxHp?: number, hp?: number, speed?: number}} */
    const patch = { perks };
    if (perk.effect.maxHp) {
        patch.maxHp = Math.max(1, (Number(member?.maxHp) || 0) + perk.effect.maxHp);
        patch.hp = Math.max(0, (Number(member?.hp) || 0) + perk.effect.maxHp);
    }
    if (perk.effect.speed) patch.speed = Math.max(0, (Number(member?.speed) || 30) + perk.effect.speed);
    return patch;
}

/**
 * Lo que suman las mejoras de alguien a una cosa: `initiative`, `attack`, `armorClass`, o
 * una habilidad por su id.
 *
 * @param {any} member
 * @param {'initiative'|'attack'|'armorClass'|'skill'} kind
 * @param {string} [skill]
 * @returns {number}
 */
export function perkBonus(member, kind, skill = '') {
    return perksOf(member).reduce((sum, perk) => {
        if (kind === 'skill') return sum + (perk.effect.skill === skill ? Number(perk.effect.amount) || 0 : 0);
        return sum + (Number(perk.effect[kind]) || 0);
    }, 0);
}

/**
 * Para la ficha: lo que ha elegido, en una línea cada una.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describePerks(member) {
    return perksOf(member).map(p => `${p.label}: ${p.describe}`);
}
