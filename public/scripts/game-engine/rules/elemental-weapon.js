/**
 * Imbuir el arma de un aliado (E3.3 de wiki/ROADMAP_ENTRETENIDO.md): el conjuro **Arma
 * elemental** de 5e, y no un truco inventado (decidido por Daniel el 2026-10-03).
 *
 * Las reglas de 2024: un arma no mágica que tocas se vuelve mágica mientras te concentres
 * (hasta una hora). Eliges ácido, frío, fuego, rayo o trueno; el arma suma +1 al ataque y
 * 1d4 de ese tipo a cada golpe que entra. Con un espacio de nivel 5 o 6, +2 y 2d4; con uno de
 * 7 o más, +3 y 3d4. Ese escalón está en la fila del conjuro (`imbue.tiers`), no aquí.
 *
 * En la ficha de quien lleva el arma, `spellWeapon`:
 * `{ spellId, casterId, casterName, name, weaponId, weaponName, bonus, dice, type }`. Lleva el
 * id de quien lo lanzó y del conjuro, como el `spellAc` de Escudo de fe, para que se acabe
 * con su concentración.
 *
 * El tipo lo elige el juego por ti: el que más les duele a los que tienes delante (lo que
 * resisten, a lo que son inmunes, lo que les duele el doble y su punto débil), y si da igual,
 * fuego. Nada de un menú más para una pregunta que tiene una respuesta buena.
 *
 * Puro: decide, cuenta y dice. Tirar el dado entra como número ya tirado.
 */

/** Los tipos que admite el conjuro, en el orden de preferencia cuando da igual. */
export const IMBUE_TYPES = ['Fire', 'Cold', 'Lightning', 'Acid', 'Thunder'];

/** Cómo se dicen (los mismos que `DAMAGE_TYPES` de `spell-catalogue.js`). */
export const IMBUE_WORDS = {
    Fire: 'fuego', Cold: 'frío', Lightning: 'rayo', Acid: 'ácido', Thunder: 'trueno',
};

/** Su dibujo en el registro y la ficha. */
export const IMBUE_ICONS = {
    Fire: '🔥', Cold: '❄️', Lightning: '⚡', Acid: '🧪', Thunder: '💥',
};

/** Lo máximo que suma un arma mágica en 5e. */
export const MAX_WEAPON_BONUS = 3;

/** Las palabras de un punto débil que apuntan a cada tipo («El fuego lo hace dudar»). */
const WEAKNESS_WORDS = {
    Fire: /\b(fuego|llamas?|arde|arda|ardiendo)\b/,
    Cold: /\b(frio|hielo|escarcha|helad[oa])\b/,
    Lightning: /\b(rayo|rayos|relampago|electricidad)\b/,
    Acid: /\b(acido)\b/,
    Thunder: /\b(trueno|ruido|estruendo)\b/,
};

/** Las formas en que una ficha puede decir un tipo de daño, a su nombre en inglés. */
const TYPE_ALIASES = {
    fire: 'Fire', fuego: 'Fire',
    cold: 'Cold', frio: 'Cold',
    lightning: 'Lightning', rayo: 'Lightning', relampago: 'Lightning',
    acid: 'Acid', acido: 'Acid',
    thunder: 'Thunder', trueno: 'Thunder',
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @typedef {Object} ImbueTier
 * @property {number} slot Desde qué espacio.
 * @property {number} bonus Lo que suma al ataque.
 * @property {string} dice Lo que suma al daño, del tipo elegido.
 */

/**
 * @typedef {Object} ImbueSpec
 * @property {string[]} types
 * @property {ImbueTier[]} tiers De menor a mayor espacio.
 */

/**
 * La columna `imbue` de una fila de `conjuros.json`, leída con tolerancia. `null` si no hay.
 *
 * @param {any} raw
 * @returns {ImbueSpec|null}
 */
export function readImbueSpec(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const types = (Array.isArray(raw.types) ? raw.types : []).map(text).filter(t => IMBUE_TYPES.includes(t));
    const tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
        .map((/** @type {any} */ t) => ({
            slot: Math.max(1, Math.floor(Number(t?.slot) || 1)),
            bonus: Math.max(0, Math.min(MAX_WEAPON_BONUS, Math.floor(Number(t?.bonus) || 0))),
            dice: text(t?.dice),
        }))
        .filter(t => t.bonus > 0 || t.dice)
        .sort((a, b) => a.slot - b.slot);
    if (tiers.length === 0) return null;
    return { types: types.length > 0 ? types : [...IMBUE_TYPES], tiers };
}

/**
 * Lo que impide usar la columna `imbue`. Vacío si está bien.
 *
 * @param {any} raw
 * @param {(value: any) => boolean} isFormula
 * @returns {string[]}
 */
export function imbueProblems(raw, isFormula) {
    /** @type {string[]} */
    const out = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['"imbue" tiene que ser un objeto con "types" y "tiers".'];
    for (const type of Array.isArray(raw.types) ? raw.types : []) {
        if (!IMBUE_TYPES.includes(text(type))) out.push(`"imbue.types" dice "${text(type)}". Vale: ${IMBUE_TYPES.join(', ')}.`);
    }
    const tiers = Array.isArray(raw.tiers) ? raw.tiers : [];
    if (tiers.length === 0) out.push('"imbue.tiers" tiene que decir, por espacio, lo que suma: [{"slot": 3, "bonus": 1, "dice": "1d4"}].');
    for (const tier of tiers) {
        if (!(Number.isInteger(Number(tier?.slot)) && Number(tier.slot) >= 1 && Number(tier.slot) <= 9)) out.push('"imbue.tiers": cada "slot" es un nivel de espacio, de 1 a 9.');
        if (!(Number.isInteger(Number(tier?.bonus)) && Number(tier.bonus) >= 0 && Number(tier.bonus) <= MAX_WEAPON_BONUS)) out.push(`"imbue.tiers": cada "bonus" va de 0 a ${MAX_WEAPON_BONUS}.`);
        if (tier?.dice !== undefined && !isFormula(tier.dice)) out.push(`"imbue.tiers": "${text(tier.dice)}" no es una fórmula de dados.`);
    }
    return out;
}

/**
 * Lo que da con ese espacio: el escalón más alto al que llega.
 *
 * @param {ImbueSpec|null} spec
 * @param {number} slotLevel
 * @returns {{bonus: number, dice: string}}
 */
export function imbueTier(spec, slotLevel) {
    const slot = Math.floor(Number(slotLevel) || 0);
    const tiers = spec?.tiers ?? [];
    const reached = tiers.filter(t => t.slot <= slot);
    const tier = reached[reached.length - 1] ?? tiers[0];
    return tier ? { bonus: tier.bonus, dice: tier.dice } : { bonus: 0, dice: '' };
}

/**
 * Si un objeto ya es mágico: lleva «+N», es de la categoría de magia o lo dice.
 *
 * @param {any} weapon
 * @returns {boolean}
 */
export function isMagicWeapon(weapon) {
    if (!weapon) return false;
    return Number(weapon.magicalBonus) > 0 || weapon.magic === true || text(weapon.category) === 'magic'
        || Boolean(weapon.requiresAttunement);
}

/**
 * Si se le puede imbuir el arma a alguien, y si no, por qué.
 *
 * @param {any} member La ficha de quien lo recibe.
 * @param {any} weapon El arma que lleva puesta (`weaponOf`), o null.
 * @returns {{ok: boolean, reason: string}}
 */
export function canImbue(member, weapon) {
    const name = text(member?.name) || 'Esa persona';
    if (!weapon) return { ok: false, reason: `${name} no lleva arma: Arma elemental necesita una.` };
    if (isMagicWeapon(weapon)) return { ok: false, reason: `${text(weapon.name) || 'Su arma'} ya es mágica: Arma elemental solo sirve en un arma corriente.` };
    if (readImbue(member?.spellWeapon)) return { ok: false, reason: `El arma de ${name} ya está imbuida.` };
    return { ok: true, reason: '' };
}

/**
 * @typedef {Object} Imbue
 * @property {string} spellId
 * @property {string} casterId
 * @property {string} casterName
 * @property {string} name El nombre del conjuro.
 * @property {string} weaponId
 * @property {string} weaponName
 * @property {number} bonus
 * @property {string} dice
 * @property {string} type En inglés, como lo guarda el motor.
 */

/**
 * El `spellWeapon` de una ficha, leído con tolerancia. `null` si no hay.
 *
 * @param {any} raw
 * @returns {Imbue|null}
 */
export function readImbue(raw) {
    if (!raw || typeof raw !== 'object' || !text(raw.spellId)) return null;
    const type = IMBUE_TYPES.includes(text(raw.type)) ? text(raw.type) : 'Fire';
    return {
        spellId: text(raw.spellId),
        casterId: text(raw.casterId),
        casterName: text(raw.casterName),
        name: text(raw.name) || 'Arma elemental',
        weaponId: text(raw.weaponId),
        weaponName: text(raw.weaponName),
        bonus: Math.max(0, Math.min(MAX_WEAPON_BONUS, Math.floor(Number(raw.bonus) || 0))),
        dice: text(raw.dice),
        type,
    };
}

/**
 * Lo imbuido, si vale para el arma con la que golpea ahora: la otra mano no lo lleva.
 *
 * @param {any} member
 * @param {any} weapon El arma del golpe, o null.
 * @returns {Imbue|null}
 */
export function imbueFor(member, weapon) {
    const imbue = readImbue(member?.spellWeapon);
    if (!imbue || !weapon) return null;
    if (imbue.weaponId && text(weapon.id) && imbue.weaponId !== text(weapon.id)) return null;
    return imbue;
}

/**
 * Una lista de tipos de daño, venga como venga («fire», «fuego», «Fuego, frío»), en inglés.
 *
 * @param {any} value
 * @returns {string[]}
 */
function typeList(value) {
    const raw = Array.isArray(value) ? value : text(value).split(/[,;]/);
    return raw.map(v => /** @type {Record<string, string>} */ (TYPE_ALIASES)[plain(v)] ?? '').filter(Boolean);
}

/**
 * Cómo le sienta un tipo de daño a un enemigo: inmune, resiste, le duele el doble o normal.
 *
 * @param {any} enemy
 * @param {string} type
 * @returns {'immune'|'resist'|'vulnerable'|'normal'}
 */
export function affinityOf(enemy, type) {
    if (typeList(enemy?.immunities ?? enemy?.damageImmunities).includes(type)) return 'immune';
    if (typeList(enemy?.resistances ?? enemy?.damageResistances).includes(type)) return 'resist';
    if (typeList(enemy?.vulnerabilities ?? enemy?.damageVulnerabilities).includes(type)) return 'vulnerable';
    return 'normal';
}

/**
 * El daño de más del arma contra un enemigo, con lo que resiste: la mitad si lo resiste,
 * nada si es inmune y el doble si le duele.
 *
 * @param {number} rolled
 * @param {string} type
 * @param {any} enemy
 * @returns {{damage: number, note: string}}
 */
export function imbueDamage(rolled, type, enemy) {
    const base = Math.max(0, Math.floor(Number(rolled) || 0));
    const affinity = affinityOf(enemy, type);
    if (affinity === 'immune') return { damage: 0, note: 'no le hace nada' };
    if (affinity === 'resist') return { damage: Math.floor(base / 2), note: 'lo resiste: la mitad' };
    if (affinity === 'vulnerable') return { damage: base * 2, note: 'le duele el doble' };
    return { damage: base, note: '' };
}

/**
 * El tipo que más les duele a los enemigos que hay. Si da igual, el primero de la lista
 * (fuego).
 *
 * @param {Object} input
 * @param {string[]} [input.types]
 * @param {any[]} [input.enemies] Los que siguen en pie, con sus resistencias y su `weakness`.
 * @returns {{type: string, word: string, why: string}}
 */
export function bestImbueType({ types = IMBUE_TYPES, enemies = [] } = {}) {
    const list = (Array.isArray(types) && types.length > 0 ? types : IMBUE_TYPES).filter(t => IMBUE_TYPES.includes(t));
    const foes = (Array.isArray(enemies) ? enemies : []).filter(Boolean);
    const WEIGHT = { immune: -4, resist: -2, vulnerable: 3, normal: 0 };
    let best = { type: list[0] ?? 'Fire', score: 0, why: '' };
    for (const type of list) {
        let score = 0;
        let why = '';
        for (const enemy of foes) {
            const affinity = affinityOf(enemy, type);
            score += WEIGHT[affinity];
            const pattern = /** @type {Record<string, RegExp>} */ (WEAKNESS_WORDS)[type];
            const weak = pattern && pattern.test(plain(enemy.weakness));
            if (weak) score += 1;
            if (!why && affinity === 'vulnerable') why = `a ${text(enemy.name)} le duele el doble`;
            else if (!why && weak && affinity === 'normal') why = `${text(enemy.name)}: ${text(enemy.weakness).replace(/\.$/, '').toLowerCase()}`;
        }
        if (score > best.score) best = { type, score, why };
    }
    return { type: best.type, word: /** @type {Record<string, string>} */ (IMBUE_WORDS)[best.type] ?? 'fuego', why: best.why };
}

/**
 * Lo imbuido en una línea, para la ficha y la tarjeta del objetivo:
 * «Arma elemental en la espada larga: +1 al ataque y +1d4 de fuego».
 *
 * @param {any} raw El `spellWeapon`.
 * @returns {string} Vacío si no hay.
 */
export function describeImbue(raw) {
    const imbue = readImbue(raw);
    if (!imbue) return '';
    const word = /** @type {Record<string, string>} */ (IMBUE_WORDS)[imbue.type] ?? 'fuego';
    const weapon = imbue.weaponName ? ` en ${imbue.weaponName.toLowerCase()}` : '';
    const parts = [
        ...(imbue.bonus > 0 ? [`+${imbue.bonus} al ataque`] : []),
        ...(imbue.dice ? [`+${imbue.dice} de ${word}`] : []),
    ];
    const by = imbue.casterName ? ` (mientras ${imbue.casterName} se concentre)` : '';
    const icon = /** @type {Record<string, string>} */ (IMBUE_ICONS)[imbue.type] ?? '✨';
    return `${icon} ${imbue.name}${weapon}: ${parts.join(' y ')}${by}`;
}

/**
 * @typedef {Object} ImbueCandidate
 * @property {string} id
 * @property {string} name
 * @property {number} distanceFeet De quien lanza.
 * @property {boolean} ok Si se le puede imbuir (`canImbue`).
 * @property {number} [attacks] Golpes por turno con el arma (1 si no se sabe).
 * @property {boolean} [melee] Si pelea cuerpo a cuerpo.
 */

/**
 * La IA de un compañero que sabe Arma elemental: si le compensa lanzarlo ahora, y a quién.
 *
 * Solo si no se está concentrando ya en otra cosa (lo perdería), si la pelea es larga
 * (un jefe, tres enemigos o más, o mucha vida por quitar) y hay a mano, a un paso, alguien
 * con un arma corriente. Prefiere a quien más golpes da y pelea de cerca, y entre iguales a
 * otro antes que a sí mismo: quien lanza tiene que aguantar la concentración.
 *
 * @param {Object} input
 * @param {{id: string, concentrating: boolean}} input.caster
 * @param {ImbueCandidate[]} input.candidates Los del grupo en pie (también quien lanza).
 * @param {Array<{currentHp: number, boss?: boolean}>} input.enemies Los que siguen en pie.
 * @param {number} [input.touchFeet]
 * @returns {{targetId: string, why: string}|null}
 */
export function planAllyImbue({ caster, candidates, enemies, touchFeet = 5 }) {
    if (!caster || caster.concentrating) return null;
    const foes = (Array.isArray(enemies) ? enemies : []).filter(e => (Number(e?.currentHp) || 0) > 0);
    if (foes.length === 0) return null;
    const hpLeft = foes.reduce((sum, e) => sum + (Number(e.currentHp) || 0), 0);
    const long = foes.some(e => e.boss) || foes.length >= 3 || hpLeft >= 40;
    if (!long) return null;
    const near = (Array.isArray(candidates) ? candidates : [])
        .filter(c => c && c.ok && (Number(c.distanceFeet) || 0) <= touchFeet);
    if (near.length === 0) return null;
    const score = (/** @type {ImbueCandidate} */ c) => (Math.max(1, Number(c.attacks) || 1) * 10) + (c.melee ? 3 : 0) + (String(c.id) === String(caster.id) ? 0 : 1);
    const pick = [...near].sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)))[0];
    const why = foes.some(e => e.boss) ? 'está aquí quien manda' : foes.length >= 3 ? 'son muchos' : 'les queda mucha vida';
    return { targetId: String(pick.id), why };
}
