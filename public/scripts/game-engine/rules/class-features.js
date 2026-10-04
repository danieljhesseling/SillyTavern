/**
 * Lo que da la clase sin que sea una habilidad que se pulsa: los rasgos que se notan solos
 * (wiki/gemini/ROADMAP_CONTENIDO_DND.md, Paladín y Monje).
 *
 * - **Defensa sin armadura** (2024): sin armadura de cuerpo, el monje tiene 10 + Destreza +
 *   Sabiduría (y sin escudo); el bárbaro, 10 + Destreza + Constitución (con escudo, si lo lleva).
 * - **Artes marciales**: el dado del golpe sin armas del monje (1d6, 1d8 desde el 5, 1d10 desde
 *   el 11 y 1d12 desde el 17), con la mejor entre Fuerza y Destreza.
 * - **Movimiento sin armadura**: el monje anda 10 pies más desde el nivel 2, y 5 más en los
 *   niveles 6, 10, 14 y 18. Se escribe en la ficha al subir (`classLevelPatch`).
 * - **Estilo de combate** del paladín, desde el nivel 2: Defensa, +1 a la CA (`classBonus`,
 *   que se suma donde ya se suman las mejoras).
 *
 * Las habilidades que se pulsan (Imposición de manos, Ráfaga de golpes…) son filas de
 * `habilidades.json`; el Castigo divino, un conjuro de `conjuros.json`.
 *
 * Puro y sin imports: lo leen `equipment.js`, `unarmed.js` y `level-perks.js`, y `checks.js`
 * ya depende de este último.
 */

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} score @returns {number} */
const modOf = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/** @param {any} value @returns {number} */
const levelOf = (value) => Math.max(1, Math.floor(Number(value) || 1));

/**
 * La clase de alguien, solo para estos rasgos: `monk`, `paladin`, `barbarian` o vacío.
 *
 * @param {any} member
 * @returns {''|'monk'|'paladin'|'barbarian'}
 */
export function featureClassOf(member) {
    const kind = plain(member?.class ?? member?.charClass ?? member?.className);
    if (/^(monk|monj)/.test(kind)) return 'monk';
    if (/^palad/.test(kind)) return 'paladin';
    if (/^(barbarian|barbar)/.test(kind)) return 'barbarian';
    return '';
}

/**
 * La Defensa sin armadura, si le toca: la CA y de dónde sale. Null si no le toca (otra clase,
 * o el monje con escudo).
 *
 * @param {any} member
 * @param {number} dexModifier
 * @param {{shield?: boolean}} [worn] Si lleva escudo.
 * @returns {{armorClass: number, from: string[]}|null}
 */
export function unarmoredDefense(member, dexModifier, { shield = false } = {}) {
    const key = featureClassOf(member);
    const dex = Math.round(Number(dexModifier) || 0);
    const signed = (/** @type {number} */ n) => `${n >= 0 ? '+' : ''}${n}`;
    if (key === 'monk' && !shield) {
        const wis = modOf(member?.wisdom);
        return { armorClass: 10 + dex + wis, from: ['Defensa sin armadura 10', `Destreza ${signed(dex)}`, `Sabiduría ${signed(wis)}`] };
    }
    if (key === 'barbarian') {
        const con = modOf(member?.constitution);
        return { armorClass: 10 + dex + con, from: ['Defensa sin armadura 10', `Destreza ${signed(dex)}`, `Constitución ${signed(con)}`] };
    }
    return null;
}

/**
 * El dado de Artes marciales del monje a ese nivel.
 *
 * @param {any} level
 * @returns {string}
 */
export function martialArtsDie(level) {
    const at = levelOf(level);
    if (at >= 17) return '1d12';
    if (at >= 11) return '1d10';
    if (at >= 5) return '1d8';
    return '1d6';
}

/**
 * Lo que suma el Movimiento sin armadura del monje a ese nivel, en pies.
 *
 * @param {any} level
 * @returns {number}
 */
export function unarmoredMovement(level) {
    const at = levelOf(level);
    if (at < 2) return 0;
    return 10 + 5 * [6, 10, 14, 18].filter(step => at >= step).length;
}

/**
 * Lo que cambia en la ficha al subir de un nivel a otro por la clase: la velocidad del monje.
 *
 * @param {any} member Con su clase y su velocidad de antes.
 * @param {number} from El nivel de antes.
 * @param {number} to El nivel nuevo.
 * @returns {{speed?: number}}
 */
export function classLevelPatch(member, from, to) {
    if (featureClassOf(member) !== 'monk') return {};
    const gain = unarmoredMovement(to) - unarmoredMovement(from);
    if (gain <= 0) return {};
    return { speed: Math.max(0, Number(member?.speed) || 30) + gain };
}

/**
 * Lo que suma la clase a algo que ya suman las mejoras (`perkBonus`): el Estilo de combate
 * del paladín (Defensa, +1 a la CA desde el nivel 2).
 *
 * @param {any} member
 * @param {string} kind `armorClass`, `attack`, `initiative`…
 * @returns {number}
 */
export function classBonus(member, kind) {
    if (kind === 'armorClass' && featureClassOf(member) === 'paladin' && levelOf(member?.level) >= 2) return 1;
    return 0;
}

/**
 * Los rasgos que se notan solos, para enseñarlos en la ficha o al subir.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describeClassFeatures(member) {
    const key = featureClassOf(member);
    const level = levelOf(member?.level);
    if (key === 'monk') {
        return [
            `Artes marciales: golpe sin armas de ${martialArtsDie(level)} con la mejor entre Fuerza y Destreza.`,
            'Defensa sin armadura: 10 + Destreza + Sabiduría, sin armadura ni escudo.',
            ...(level >= 2 ? [`Movimiento sin armadura: +${unarmoredMovement(level)} pies.`] : []),
        ];
    }
    if (key === 'paladin') return level >= 2 ? ['Estilo de combate (Defensa): +1 a la CA.'] : [];
    if (key === 'barbarian') return ['Defensa sin armadura: 10 + Destreza + Constitución, sin armadura de cuerpo.'];
    return [];
}
