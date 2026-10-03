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
 *
 * E2 de wiki/ROADMAP_ENTRETENIDO.md (Daniel, 2026-10-03): todos empiezan además con 5 antorchas
 * (como el paquete de explorador o el de mazmorra de 5e), y quien tiene herramientas de ladrón
 * por su trasfondo (el criminal) empieza con ganzúas (`startingGear`).
 */

import { backgroundOf } from './backgrounds.js';

/** Las antorchas con las que empieza cada héroe (el paquete de explorador de 5e trae 10; el de mazmorra, 10; aquí 5). */
export const STARTING_TORCHES = 5;

/** La antorcha cuando el compendio no la trae: la de la tienda (`loot-items.js`). */
const TORCH_FALLBACK = { id: 'forma-antorcha', name: 'Antorcha', itemType: 'gear', kg: 0.5, slot: '' };

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
 * @property {number} [quantity] Cuántas son, si es un montón (las antorchas).
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
 * Todo con lo que empieza un héroe: el kit de su clase, lo que da su trasfondo (las ganzúas del
 * criminal) si la clase no lo trae ya, y las antorchas (E2.1: un montón de `STARTING_TORCHES`).
 *
 * @param {Object} input
 * @param {any} input.classRow La fila de la clase, con su `kit` (sin fila, solo lo demás).
 * @param {any[]} input.forms  Las formas de armas, armaduras y trastos.
 * @param {string} [input.background] El id del trasfondo (`backgrounds.js`).
 * @returns {KitPiece[]}
 */
export function startingGear({ classRow, forms, background = '' }) {
    const pieces = kitFor({ classRow, forms });
    const has = new Set(pieces.map(piece => piece.kitForm));
    const extra = (backgroundOf(background)?.tools ?? []).filter(id => !has.has(id));
    const fromBackground = extra.length > 0 ? kitFor({ classRow: { kit: extra }, forms }) : [];
    const all = [...pieces, ...fromBackground];
    const torchAt = all.findIndex(piece => piece.kitForm === 'forma-antorcha');
    if (torchAt >= 0) {
        all[torchAt] = { ...all[torchAt], quantity: Math.max(STARTING_TORCHES, Math.floor(Number(all[torchAt].quantity) || 1)) };
        return all;
    }
    const torch = kitFor({ classRow: { kit: ['forma-antorcha'] }, forms })[0]
        ?? kitFor({ classRow: { kit: ['forma-antorcha'] }, forms: [TORCH_FALLBACK] })[0];
    return [...all, { ...torch, quantity: STARTING_TORCHES }];
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
    // Un montón se dice con su número: «5 antorchas».
    const names = (Array.isArray(pieces) ? pieces : [])
        .map(piece => {
            const name = text(piece?.name);
            const count = Math.floor(Number(piece?.quantity) || 1);
            if (!name || count <= 1) return name;
            return `${count} ${name.toLowerCase()}${/[aeiouáéíóú]$/i.test(name) ? 's' : 'es'}`;
        })
        .filter(Boolean);
    return names.length > 0 ? `Llevas: ${names.join(', ')}.` : '';
}
