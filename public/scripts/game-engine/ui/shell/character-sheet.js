/**
 * La ficha que enseña un videojuego, no la que edita un diseñador.
 *
 * Pulsarte a ti mismo abría el **editor**: desplegables de raza, una lista de facciones
 * con casillas, la personalidad en una caja de texto y las seis características como
 * campos que se pueden escribir. Eso es para cambiar un personaje a conciencia. Para
 * mirarte en mitad de una partida es exactamente lo contrario de lo que hace falta: un
 * formulario donde buscabas un vistazo.
 *
 * Así que esto **no deja tocar nada** y responde a lo que de verdad se pregunta uno
 * mirando su ficha: cómo estoy, qué llevo puesto, qué sé hacer, qué me falta para subir y
 * qué me pasa ahora mismo. El editor sigue existiendo y se llega a él por un botón, que es
 * donde tiene que estar: a un paso de distancia y no en el camino.
 *
 * Y enseña lo que el resto del juego ya sabe pero tenía repartido: las heridas que
 * arrastras, el hambre y la sed, los usos que te quedan de cada habilidad, y las
 * salvaciones de muerte cuando estás en el suelo. Una ficha que no dice que te falta una
 * pierna no es una ficha.
 *
 * Puro: arma lo que hay que dibujar. No dibuja, no guarda y no cambia nada.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 1.
 */

import { knownAbilities, usesLeft } from '../../rules/abilities.js';
import { describeInjuries } from '../../rules/injuries.js';
import { describeNeeds } from '../../rules/needs.js';
import { readDeathSaves, isDying } from '../../rules/death-saves.js';
import { levelForXp } from '../../rules/level-up.js';
import { armourClassOf, describeArmour } from '../../rules/equipment.js';
import { shownName } from '../../campaign/item-lore.js';

/** Las seis, en el orden en que se leen en una hoja de personaje. */
export const SHEET_ABILITIES = [
    ['strength', 'FUE'], ['dexterity', 'DES'], ['constitution', 'CON'],
    ['intelligence', 'INT'], ['wisdom', 'SAB'], ['charisma', 'CAR'],
];

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * El modificador de D&D: lo que de verdad se suma a una tirada.
 *
 * Se enseña junto al número porque es lo que se usa. Un 14 no dice nada por sí solo; un
 * «+2» dice cuánto mejor eres.
 *
 * @param {number} score
 * @returns {number}
 */
export function modifierOf(score) {
    return Math.floor((number(score, 10) - 10) / 2);
}

/**
 * Lo que lleva puesto, ranura por ranura, incluidas las vacías.
 *
 * Las vacías se enseñan a propósito: un hueco es información — es donde puedes mejorar, y
 * esconderlo hace que una armadura que falta parezca una que no existe.
 *
 * @param {any} member
 * @param {Record<string, {label: string, icon: string}>} slotInfo
 * @returns {Array<{slot: string, label: string, icon: string, item: string, empty: boolean}>}
 */
export function equipmentOf(member, slotInfo) {
    const worn = (member?.equippedItems && typeof member.equippedItems === 'object')
        ? member.equippedItems : {};

    return Object.entries(slotInfo ?? {}).map(([slot, info]) => {
        const held = worn[slot];
        const name = typeof held === 'string' ? held : String(held?.name ?? '');
        return {
            slot,
            label: String(info?.label ?? slot),
            icon: String(info?.icon ?? 'fa-circle'),
            item: name,
            empty: !name,
        };
    });
}

/**
 * Todo lo que hay que dibujar de alguien.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} [input.slotInfo]   Las ranuras del paquete de reglas.
 * @param {any[]} [input.abilities] El catálogo de habilidades del mundo.
 * @param {any} [input.xpTable]    La tabla de experiencia, para el nivel siguiente.
 * @param {number} [input.bondRank]
 * @returns {any}
 */
export function buildCharacterSheet({ member, slotInfo = {}, abilities = [], xpTable = null, bondRank = 0 }) {
    const hp = Math.max(0, number(member?.hp));
    const maxHp = Math.max(1, number(member?.maxHp, 1));
    const known = knownAbilities(member, abilities);

    const xp = Math.max(0, number(member?.xp));
    const level = Math.max(1, number(member?.level, 1));
    const nextLevel = xpTable ? levelForXp(xp + 1, xpTable) : level;

    // Lo que lleva puesto, sumado una vez: la ficha lo ensena y el combate tira contra lo
    // mismo. Dos cuentas distintas de la misma CA seria la peor clase de fallo.
    const armour = armourClassOf({ member, dexModifier: modifierOf(member?.dexterity) });

    return {
        name: String(member?.name ?? ''),
        avatar: String(member?.avatar ?? ''),
        // Lo que uno lee primero: quien es y de que nivel.
        title: [String(member?.race ?? ''), `Nivel ${level} ${String(member?.class ?? '')}`.trim()]
            .filter(Boolean).join(' · '),

        health: {
            hp,
            maxHp,
            fraction: Math.max(0, Math.min(1, hp / maxHp)),
            // Un tercio o menos es cuando empieza a doler mirar la barra.
            hurt: hp > 0 && hp / maxHp <= 0.34,
            down: hp <= 0,
        },

        // Las salvaciones solo aparecen cuando se estan jugando: el resto del tiempo son
        // ceros que no significan nada.
        deathSaves: isDying(member) ? readDeathSaves(member) : null,

        stats: SHEET_ABILITIES.map(([key, label]) => ({
            key,
            label,
            score: number(member?.[key], 10),
            modifier: modifierOf(member?.[key]),
        })),

        defence: {
            // Lo que lleva puesto manda sobre el numero de la ficha; y se dice de donde
            // sale cada punto, porque una CA que no se puede explicar parece una trampa.
            armorClass: armour.worn ? armour.armorClass : number(member?.armorClass, 10),
            armourFrom: armour.worn ? describeArmour(armour) : '',
            speed: number(member?.speed, 30),
            initiative: modifierOf(member?.dexterity),
        },

        equipment: equipmentOf(member, slotInfo),

        // Lo que lleva encima, con su peso: es lo que decide si puedes coger una cosa mas.
        inventory: (Array.isArray(member?.items) ? member.items : []).map(item => ({
            // Idea 163: para dárselo a otro.
            id: String(item?.id ?? ''),
            // Idea 135: lo no identificado lo dice.
            name: shownName(item),
            type: String(item?.type ?? ''),
            weight: number(item?.weight),
            equipped: Boolean(item?.equipped),
        })),

        abilities: known.map(ability => {
            const left = usesLeft(member, ability);
            return {
                id: ability.id,
                name: ability.name,
                cost: ability.cost,
                left: left === Infinity ? null : left,
                spent: left === 0,
            };
        }),

        // Lo que te pasa ahora mismo, junto y no repartido por tres pantallas.
        conditions: (Array.isArray(member?.activeConditions) ? member.activeConditions : []).map(String),
        injuries: describeInjuries(member),
        needs: describeNeeds(member),

        progress: {
            level,
            xp,
            xpNext: Math.max(0, number(member?.xpNext)),
            canLevel: nextLevel > level,
        },

        bondRank: Math.max(0, number(bondRank)),
        gold: Math.max(0, number(member?.gold)),
    };
}

/**
 * Cómo está alguien, en una línea, para la cabecera.
 *
 * @param {any} sheet
 * @returns {string}
 */
export function describeSheet(sheet) {
    const parts = [`${sheet.health.hp}/${sheet.health.maxHp} PG`];
    if (sheet.injuries.length > 0) parts.push(`${sheet.injuries.length} herida(s)`);
    if (sheet.needs) parts.push(sheet.needs);
    if (sheet.conditions.length > 0) parts.push(sheet.conditions.join(', '));
    return parts.join(' · ');
}
