/**
 * El botín que se recuerda, y el que muerde (ideas 119 y 135).
 *
 * - **Con historia** (119): lo que cae de poco común para arriba trae de quién fue y cómo lo
 *   perdió. «Fue de Brunilda, que la perdió a los dados en El Peaje Norte.» Una línea, hecha
 *   con los nombres del compendio y los sitios del mundo: no cuesta ni un token.
 * - **Maldito** (135): de lo que se equipa, alguno lleva una maldición. No se sabe hasta que
 *   el templo lo mira, o hasta que te lo pones: entonces resta, y **no se suelta** hasta que
 *   un templo la quita. Por eso lo que cae sin identificar dice que lo está.
 *
 * Una maldición resta como una herida (`curseInjury`): el combate lee las características de
 * la ficha, y es por ahí por donde restan también el cansancio y una pierna rota. Mientras se
 * lleva puesto, resta; al quitarla el templo, deja de restar.
 *
 * Puro: decide y redacta. Quien llama tira los dados, cobra y guarda.
 */

/** Desde qué rareza el botín trae historia y puede estar maldito. */
const WORTHY = ['uncommon', 'rare', 'very rare', 'legendary', 'poco común', 'raro'];

/** Lo probable que es que algo equipable esté maldito. Un objeto: las pruebas lo suben. */
export const LOOT_ODDS = { curse: 0.12 };

/** Lo que cobra el templo: por mirar cada cosa, y por quitar cada maldición. */
export const TEMPLE_PRICES = { identify: 5, lift: 40 };

/** Las maldiciones: cada una resta una característica, como una propiedad al revés. */
export const CURSES = [
    { id: 'torpeza', label: 'Maldición de la torpeza', stat: 'dexterity', note: 'Las manos no obedecen.' },
    { id: 'flojera', label: 'Maldición de la flojera', stat: 'strength', note: 'Pesa el doble de lo que parece.' },
    { id: 'carne', label: 'Maldición de la carne blanda', stat: 'constitution', note: 'Quien lo lleva se cansa por nada.' },
    { id: 'nublado', label: 'Maldición del ojo nublado', stat: 'wisdom', note: 'Se ven sombras donde no hay nada.' },
];

/** Cuánto resta una maldición. */
export const CURSE_PENALTY = -2;

/** Cómo se perdió, con el sitio en medio. */
const FATES = [
    'que cayó con ello en la mano en {place}',
    'que lo perdió a los dados en {place}',
    'que lo empeñó en {place} y nunca volvió a por ello',
    'que lo enterró con su hermano cerca de {place}',
    'a quien se lo quitaron en {place}, y no por las buenas',
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si algo merece historia (y puede estar maldito): de poco común para arriba.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isWorthy(item) {
    return WORTHY.includes(text(item?.rarity).toLowerCase());
}

/**
 * La historia de un objeto en una línea.
 *
 * @param {Object} input
 * @param {string} input.owner  Un nombre de persona.
 * @param {string} input.place  Un sitio del mundo.
 * @param {() => number} input.random
 * @returns {string}
 */
export function loreFor({ owner, place, random }) {
    const fate = FATES[Math.floor(random() * FATES.length) % FATES.length].replace('{place}', text(place) || 'algún camino');
    return `Fue de ${text(owner) || 'alguien'}, ${fate}.`;
}

/**
 * Colgarle a un objeto su historia y, a veces, una maldición.
 *
 * Solo a lo que lo merece (`isWorthy`). La maldición, solo a lo que se equipa: una poción no
 * se te pega a la mano. Lo que puede estarlo cae **sin identificar**, esté o no: si solo lo
 * dijeran los malditos, la etiqueta los delataría.
 *
 * @param {any} item Un objeto listo para el inventario.
 * @param {{owner: string, place: string, random: () => number}} input
 * @returns {any}
 */
export function dressLoot(item, { owner, place, random }) {
    if (!item || !isWorthy(item)) return item;
    const lore = loreFor({ owner, place, random });
    const dressed = { ...item, lore, description: [text(item.description), lore].filter(Boolean).join(' ') };
    if (!text(item.slot)) return dressed;
    dressed.identified = false;
    if (random() >= LOOT_ODDS.curse) return dressed;
    const curse = CURSES[Math.floor(random() * CURSES.length) % CURSES.length];
    return {
        ...dressed,
        cursed: true,
        curse: { id: curse.id, label: curse.label, note: curse.note, stat: curse.stat },
    };
}

/**
 * Lo que resta lo maldito que se lleva puesto, en forma de herida (una sola, `curse`).
 *
 * Permanente (`days: 0`): no se cura durmiendo, ni en el templo curando heridas. Se va al
 * quitar la maldición, o si alguna vez se consigue soltar el objeto.
 *
 * @param {any} member
 * @returns {import('../rules/injuries.js').ActiveInjury|null}
 */
export function curseInjury(member) {
    const worn = new Set(Object.values(member?.equippedItems ?? {}).filter(Boolean).map(String));
    const cursed = (Array.isArray(member?.items) ? member.items : [])
        .filter((/** @type {any} */ item) => item?.cursed && worn.has(String(item.id)));
    if (cursed.length === 0) return null;
    /** @type {Record<string, number>} */
    const modifiers = {};
    for (const item of cursed) {
        const stat = text(item.curse?.stat);
        if (stat) modifiers[stat] = (modifiers[stat] ?? 0) + CURSE_PENALTY;
    }
    return {
        id: 'curse',
        label: cursed.map((/** @type {any} */ item) => text(item.curse?.label) || 'Maldición').join(', '),
        description: cursed.map((/** @type {any} */ item) => `${text(item.name)}: ${text(item.curse?.note)}`.trim()).join(' '),
        modifiers,
        days: 0,
        daysLeft: 0,
        permanent: true,
    };
}

/**
 * Si todavía no se sabe lo que es.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isUnknown(item) {
    return item?.identified === false;
}

/**
 * El nombre como se lee en la mochila: lo no identificado lo dice.
 *
 * @param {any} item
 * @returns {string}
 */
export function shownName(item) {
    return isUnknown(item) ? `${text(item?.name)} (sin identificar)` : text(item?.name);
}

/**
 * Mirarlo en el templo: se sabe lo que es, maldición incluida.
 *
 * @param {any} item
 * @returns {{item: any, line: string}}
 */
export function identify(item) {
    const known = { ...item, identified: true };
    const line = item?.cursed
        ? `${text(item.name)}: ${text(item.curse?.label) || 'maldito'}. ${text(item.curse?.note)}`.trim()
        : `${text(item?.name)}: limpio, es lo que parece.`;
    return { item: known, line };
}

/**
 * Quitarle la maldición: se va lo que restaba, y ya se puede soltar.
 *
 * @param {any} item
 * @returns {any}
 */
export function liftCurse(item) {
    if (!item?.cursed) return item;
    const rest = { ...item };
    delete rest.curse;
    return { ...rest, cursed: false, identified: true };
}

/**
 * Si se puede soltar lo que se lleva puesto: lo maldito, no.
 *
 * @param {any} item
 * @returns {{ok: boolean, reason: string}}
 */
export function canTakeOff(item) {
    if (!item?.cursed) return { ok: true, reason: '' };
    return { ok: false, reason: `${text(item.name)} no se suelta: está maldito. En un templo te lo quitan.` };
}

/**
 * Lo que hay que llevar al templo, de todo el grupo.
 *
 * @param {any[]} party
 * @returns {{unknown: Array<{memberId: string, itemId: string}>, cursed: Array<{memberId: string, itemId: string}>}}
 */
export function templeWork(party) {
    /** @type {Array<{memberId: string, itemId: string}>} */
    const unknown = [];
    /** @type {Array<{memberId: string, itemId: string}>} */
    const cursed = [];
    for (const member of Array.isArray(party) ? party : []) {
        for (const item of Array.isArray(member?.items) ? member.items : []) {
            if (!item?.id) continue;
            if (isUnknown(item)) unknown.push({ memberId: String(member.id), itemId: String(item.id) });
            else if (item.cursed) cursed.push({ memberId: String(member.id), itemId: String(item.id) });
        }
    }
    return { unknown, cursed };
}
