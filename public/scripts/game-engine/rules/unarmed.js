/**
 * El impacto sin armas de D&D 2024: un golpe, agarrar o empujar (tanda 10,
 * wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * En 2024 los tres son la misma cosa: un «impacto sin armas» que gasta un ataque de la acción
 * de Atacar. El golpe hace 1 más tu Fuerza, contundente. Agarrar y empujar ya no son pruebas
 * enfrentadas: el otro **salva** (con Fuerza o Destreza, la que mejor tenga) contra una CD de
 * 8 + tu Fuerza + tu competencia. Si falla, agarrado (no se mueve) o empujado (5 pies o al
 * suelo, lo que elijas).
 *
 * Agarrar pide una mano libre: con un arma a dos manos, o con arma y escudo, no hay con qué.
 *
 * Puro: decide con números y no toca nada.
 */

import { proficiencyBonus } from './checks.js';

/** El alcance, en pies: la casilla de al lado. */
export const UNARMED_REACH_FEET = 5;

/** Lo que se lee de cada una en el menú de Atacar. */
export const UNARMED_MODES = {
    golpe: { label: 'Golpe sin armas', short: 'Puñetazo, codazo o patada: 1 más tu Fuerza, contundente.', icon: 'fa-hand-back-fist' },
    agarrar: { label: 'Agarrar', short: 'Salva con Fuerza o Destreza; si falla, no se mueve mientras lo sujetes.', icon: 'fa-hands-holding' },
    empujar: { label: 'Empujar', short: 'Salva con Fuerza o Destreza; si falla, lo apartas 5 pies o lo tiras al suelo.', icon: 'fa-person-falling' },
};

/** @param {any} value */
const num = (value) => Math.trunc(Number(value)) || 0;

/**
 * El modificador de una característica, de su puntuación.
 *
 * @param {any} score
 * @returns {number}
 */
export function abilityMod(score) {
    return Math.floor(((Number(score) || 10) - 10) / 2);
}

/**
 * El golpe: 1 más la Fuerza. Nunca menos de 1 (el motor no hace golpes de 0).
 *
 * @param {any} member
 * @returns {{damage: number, modifier: number, formula: string, damageType: string}}
 */
export function unarmedDamage(member) {
    const modifier = abilityMod(member?.strength);
    return { damage: Math.max(1, 1 + modifier), modifier, formula: `1${modifier >= 0 ? '+' : ''}${modifier}`, damageType: 'contundente' };
}

/**
 * La CD de agarrar y empujar: 8 + Fuerza + competencia.
 *
 * @param {any} member
 * @returns {number}
 */
export function unarmedDC(member) {
    return 8 + abilityMod(member?.strength) + proficiencyBonus(member?.level);
}

/**
 * Con qué salva el otro: la mejor entre su Fuerza y su Destreza, y cuál es.
 *
 * @param {any} target
 * @returns {{modifier: number, ability: 'strength'|'dexterity', label: string}}
 */
export function escapeSave(target) {
    const str = abilityMod(target?.strength);
    const dex = abilityMod(target?.dexterity);
    return dex > str
        ? { modifier: dex, ability: 'dexterity', label: 'Destreza' }
        : { modifier: str, ability: 'strength', label: 'Fuerza' };
}

/**
 * Si le queda una mano libre para agarrar.
 *
 * @param {{weapon: any, shield: any}} hands Lo que lleva en la mano del arma y en la del escudo.
 * @returns {{ok: boolean, reason: string}}
 */
export function freeHand({ weapon, shield }) {
    if (weapon && num(weapon.hands) >= 2) {
        return { ok: false, reason: `Llevas ${String(weapon.name || 'el arma').toLowerCase()} a dos manos: no te queda una libre para agarrar.` };
    }
    if (weapon && shield) return { ok: false, reason: 'Llevas arma y escudo: no te queda una mano libre para agarrar.' };
    return { ok: true, reason: '' };
}

/**
 * Si la salvación falla: por debajo de la CD. El empate salva (5e).
 *
 * @param {{dc: number, saveTotal: number}} input
 * @returns {boolean}
 */
export function saveFails({ dc, saveTotal }) {
    return Number(saveTotal) < Number(dc);
}

/**
 * Lo que se dice de una salvación, para el registro.
 *
 * @param {{who: string, label: string, natural: number, modifier: number, dc: number}} input
 * @returns {string}
 */
export function saveLine({ who, label, natural, modifier, dc }) {
    const total = num(natural) + num(modifier);
    const sign = num(modifier) >= 0 ? '+' : '';
    const fails = total < dc;
    return `🎲 Salvación de ${label} de ${who}: ${natural}${sign}${num(modifier)} = ${total} contra CD ${dc} · ${fails ? 'falla' : 'aguanta'}`;
}
