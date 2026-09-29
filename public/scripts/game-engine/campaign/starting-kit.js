/**
 * El equipo con el que empieza cada clase (J1.3 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un guerrero recién hecho salía con CA 10: sin armadura, sin escudo y sin espada. La
 * prueba de la bodega del gremio se llegó a perder así. Ahora cada clase del compendio
 * trae su `kit` —una lista de formas de `armas.json`, `armaduras.json` y `trastos.json`—
 * y el héroe nuevo empieza con eso puesto. Se cambia en el compendio, sin tocar código.
 *
 * Son piezas sencillas: la forma tal cual, sin material ni propiedades. Lo bueno se gana.
 *
 * Puro: recibe las filas y devuelve las piezas y dónde va cada una.
 */

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @param {number} fallback */
const number = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * @typedef {Object} KitPiece
 * @property {string} name
 * @property {string} type       weapon | armor | gear
 * @property {string} category
 * @property {string} slot       Donde se lleva: weapon, body, shield, head… o vacío si va en la mochila.
 * @property {number} weight
 * @property {string} rarity
 * @property {string} damageDice
 * @property {string} damageType
 * @property {number} hands
 * @property {number} rangeFeet
 * @property {number} armorClass
 * @property {string} dexMode
 * @property {string} description
 * @property {string} kitForm   La forma de la que sale, para saber de dónde vino.
 */

/**
 * Las piezas del kit de una clase, en el orden en que las escribe el compendio.
 *
 * Lo que el kit nombra y el compendio no tiene se salta sin ruido: un compendio a medias
 * sigue dando lo que sí tiene.
 *
 * @param {Object} input
 * @param {any} input.classRow La fila de la clase, con su `kit`.
 * @param {any[]} input.forms  Las formas de armas, armaduras y trastos.
 * @returns {KitPiece[]}
 */
export function kitFor({ classRow, forms }) {
    const wanted = Array.isArray(classRow?.kit) ? classRow.kit.map(text).filter(Boolean) : [];
    const byId = new Map((Array.isArray(forms) ? forms : []).map(form => [text(form?.id), form]));
    return wanted
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(form => {
            const type = ['weapon', 'armor'].includes(text(form.itemType)) ? text(form.itemType) : 'gear';
            return {
                name: text(form.name),
                type,
                category: type === 'gear' ? 'gear' : type,
                slot: text(form.slot) || (type === 'weapon' ? 'weapon' : ''),
                weight: number(form.kg, 0),
                rarity: 'Common',
                damageDice: text(form.damageDice),
                damageType: text(form.damageType),
                hands: Math.max(1, number(form.hands, 1)),
                rangeFeet: Math.max(0, number(form.rangeFeet, 0)),
                armorClass: Math.max(0, number(form.armorClass, 0)),
                dexMode: text(form.dexMode),
                description: 'Lo que traías al empezar.',
                kitForm: text(form.id),
            };
        });
}

/**
 * Qué va puesto de un kit: la primera pieza de cada sitio. El escudo, solo si el arma se
 * lleva con una mano; lo que no tiene sitio va en la mochila.
 *
 * @param {KitPiece[]} pieces
 * @returns {Record<string, number>} El sitio, y el índice de la pieza que va en él.
 */
export function kitSlots(pieces) {
    /** @type {Record<string, number>} */
    const worn = {};
    (Array.isArray(pieces) ? pieces : []).forEach((piece, index) => {
        const slot = text(piece?.slot);
        if (!slot || slot in worn) return;
        worn[slot] = index;
    });
    const weapon = worn.weapon === undefined ? null : pieces[worn.weapon];
    if (weapon && number(weapon.hands, 1) >= 2) delete worn.shield;
    return worn;
}

/**
 * El kit en una línea, para decirlo al crear el personaje.
 *
 * @param {KitPiece[]} pieces
 * @returns {string}
 */
export function describeKit(pieces) {
    const names = (Array.isArray(pieces) ? pieces : []).map(piece => text(piece?.name)).filter(Boolean);
    return names.length > 0 ? `Llevas: ${names.join(', ')}.` : '';
}
