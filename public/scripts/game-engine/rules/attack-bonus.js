/**
 * Lo que suma alguien del grupo al d20 cuando ataca con un arma (o a puñetazos): su
 * característica **y su competencia**, como en D&D.
 *
 * Hasta aquí el grupo solo sumaba la característica: un guerrero de nivel 1 con Fuerza 16
 * atacaba con +3 en vez de +5, y acertaba a una CA 13 la mitad de las veces en vez del 65 %.
 * La competencia es la misma de las pruebas (`proficiencyBonus` de `checks.js`): +2 de nivel
 * 1 a 4, +3 de 5 a 8, y así.
 *
 * Con qué armas se tiene competencia (D&D 2024): todo el mundo con las sencillas y con los
 * puños. Las marciales, las clases de armas (guerrero, paladín, explorador, bárbaro); el
 * pícaro, las que son sutiles o ligeras; el monje, las ligeras. Mago, hechicero, brujo,
 * clérigo, druida y bardo, solo las sencillas. Un arma que no dice si es marcial cuenta como
 * sencilla: así nadie pierde lo suyo por una ficha a medio escribir.
 *
 * La característica es la de siempre en este motor: de lejos, la Destreza; de cerca, la mejor
 * entre Fuerza y Destreza.
 *
 * Puro: decide con números y devuelve también la explicación en palabras, para la tarjeta del
 * objetivo: «+5 al ataque: +3 de Fuerza y +2 de competencia».
 */

import { classKey, proficiencyBonus } from './checks.js';

/** Las clases que solo saben de armas sencillas (D&D 2024). */
const SIMPLE_ONLY = new Set(['wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'bard']);

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/**
 * El modificador de una puntuación.
 *
 * @param {any} score
 * @returns {number}
 */
function modOf(score) {
    return Math.floor(((Number(score) || 10) - 10) / 2);
}

/**
 * Las propiedades de un arma, en minúsculas y en una sola cadena, para buscar en ella.
 *
 * @param {any} weapon
 * @returns {string}
 */
function traitsOf(weapon) {
    const tags = Array.isArray(weapon?.tags) ? weapon.tags.join(' ') : '';
    const props = Array.isArray(weapon?.properties) ? weapon.properties.join(' ') : text(weapon?.properties);
    return `${tags} ${props}`.toLowerCase();
}

/**
 * Si un arma es marcial: lo dice su subcategoría (`martial_melee`, `martial_ranged`) o su
 * categoría. Lo que no lo dice, sencilla.
 *
 * @param {any} weapon
 * @returns {boolean}
 */
export function isMartialWeapon(weapon) {
    if (!weapon) return false;
    const kind = `${text(weapon.subcategory)} ${text(weapon.weaponCategory)} ${text(weapon.category)}`.toLowerCase();
    return /martial|marcial/.test(kind);
}

/**
 * Si quien ataca tiene competencia con esa arma. Sin arma (puños), siempre.
 *
 * @param {any} member
 * @param {any} weapon El arma que empuña, o null.
 * @param {{light?: boolean}} [opts] `light`: si el arma es ligera (lo sabe `isLightWeapon`).
 * @returns {boolean}
 */
export function weaponProficient(member, weapon, { light = false } = {}) {
    if (!weapon || !isMartialWeapon(weapon)) return true;
    const key = classKey(member?.class);
    if (SIMPLE_ONLY.has(key)) return false;
    const traits = traitsOf(weapon);
    const isLight = light || weapon.light === true || /\blight\b|ligera/.test(traits);
    if (key === 'rogue') return isLight || weapon.finesse === true || /finesse|sutil/.test(traits);
    if (key === 'monk') return isLight;
    return true;
}

/**
 * @typedef {Object} AttackBonusParts
 * @property {number} total Lo que se suma al d20.
 * @property {'Fuerza'|'Destreza'} abilityLabel Con qué característica ataca.
 * @property {number} ability Su modificador.
 * @property {number} proficiency La competencia que suma (0 sin competencia con esa arma).
 * @property {boolean} proficient
 * @property {Array<{label: string, value: number}>} extras Lo demás que suma (el «+1» del arma…).
 */

/**
 * Lo que suma al d20, por partes.
 *
 * @param {Object} input
 * @param {any} input.member Quien ataca (su Fuerza, su Destreza, su nivel, su clase).
 * @param {number} input.rangeFeet Hasta dónde llega el golpe: más de 5 pies es de lejos.
 * @param {any} [input.weapon] El arma que empuña, o null (puños).
 * @param {boolean} [input.light] Si el arma es ligera.
 * @param {Array<{label: string, value: number}>} [input.extras] Lo demás que suma; lo que vale 0 no sale.
 * @returns {AttackBonusParts}
 */
export function attackBonusParts({ member, rangeFeet, weapon = null, light = false, extras = [] }) {
    const strength = modOf(member?.strength);
    const dexterity = modOf(member?.dexterity);
    const useDex = Number(rangeFeet) > 5 || dexterity > strength;
    const ability = useDex ? dexterity : strength;
    const proficient = weaponProficient(member, weapon, { light });
    const proficiency = proficient ? proficiencyBonus(member?.level) : 0;
    const kept = (Array.isArray(extras) ? extras : [])
        .map(e => ({ label: text(e?.label), value: Math.trunc(Number(e?.value) || 0) }))
        .filter(e => e.value !== 0 && e.label);
    return {
        total: ability + proficiency + kept.reduce((sum, e) => sum + e.value, 0),
        abilityLabel: useDex ? 'Destreza' : 'Fuerza',
        ability,
        proficiency,
        proficient,
        extras: kept,
    };
}

/** @param {number} n @returns {string} «+3», «-1», «+0». */
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

/**
 * El número explicado: «+5 al ataque: +3 de Fuerza y +2 de competencia». Sin competencia con
 * esa arma, lo dice: «+3 al ataque: +3 de Fuerza (sin competencia con esta arma)».
 *
 * @param {AttackBonusParts} parts
 * @returns {string}
 */
export function describeAttackBonus(parts) {
    const bits = [`${signed(parts.ability)} de ${parts.abilityLabel}`];
    if (parts.proficiency > 0) bits.push(`${signed(parts.proficiency)} de competencia`);
    for (const extra of parts.extras) bits.push(`${signed(extra.value)} ${extra.label}`);
    const list = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} y ${bits[bits.length - 1]}`;
    return `${signed(parts.total)} al ataque: ${list}${parts.proficient ? '' : ' (sin competencia con esta arma)'}`;
}

/**
 * La razón de la ventaja o la desventaja, en palabras: «con desventaja: está en el suelo, y de
 * lejos cuesta». Vacío si va normal.
 *
 * @param {'advantage'|'disadvantage'|'normal'|string} mode
 * @param {string[]} [reasons]
 * @returns {string}
 */
export function describeEdgeReason(mode, reasons = []) {
    if (mode !== 'advantage' && mode !== 'disadvantage') return '';
    const word = mode === 'advantage' ? 'con ventaja' : 'con desventaja';
    const why = (Array.isArray(reasons) ? reasons : []).map(text).filter(Boolean);
    return why.length > 0 ? `${word}: ${why.join(', ')}` : word;
}
