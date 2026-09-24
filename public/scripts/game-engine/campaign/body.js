/**
 * Cómo está el grupo, en una línea para el narrador (C1).
 *
 * El modelo narraba con calma después de que el grupo casi muriera en el tablero, porque no
 * lo sabía: la vida, las heridas y el cansancio viven en el motor. Esta línea se lo dice
 * antes de cada turno, corta, para que describa a Bruna apoyándose en la barra en vez de
 * inventarse que está como una rosa.
 *
 * Solo lo que se nota: quien está bien no se nombra, y un grupo entero sano es una frase.
 * Cuesta unas pocas palabras por turno, y va al final del prompt, con lo que cambia en cada
 * turno, para no romper la caché del principio.
 *
 * Puro: lee fichas y devuelve texto.
 */

import { readInjuries } from '../rules/injuries.js';
import { describeNeeds } from '../rules/needs.js';

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Cómo está uno, en pocas palabras, o vacío si está bien.
 *
 * @param {any} member
 * @returns {string}
 */
export function bodyOf(member) {
    const name = text(member?.name) || 'Alguien';
    if (member?.dead) return `${name}: muerto.`;
    const hp = Number(member?.hp) || 0;
    const max = Math.max(1, Number(member?.maxHp) || 1);
    /** @type {string[]} */
    const bits = [];
    if (hp <= 0) bits.push('en el suelo, sin sentido');
    else if (hp / max < 0.3) bits.push('muy malherido');
    else if (hp / max < 0.7) bits.push('herido');
    for (const injury of readInjuries(member)) bits.push(text(injury.label).toLowerCase());
    const needs = describeNeeds(member);
    if (needs) bits.push(needs.toLowerCase().replace(/\.$/, ''));
    return bits.length > 0 ? `${name}: ${bits.join(', ')}.` : '';
}

/**
 * La línea del grupo entero.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {number} [input.day]
 * @param {string} [input.slot]    La parte del día.
 * @param {string} [input.climate]
 * @param {string} [input.place]
 * @returns {string} Vacío si no hay grupo.
 */
export function bodyLine({ party, day = 0, slot = '', climate = '', place = '' }) {
    const people = (Array.isArray(party) ? party : []).filter(Boolean);
    if (people.length === 0) return '';
    const when = [day > 0 ? `Día ${day}` : '', text(slot)].filter(Boolean).join(', ');
    const where = [text(place), text(climate) && text(climate) !== 'mild' ? `tiempo ${text(climate)}` : ''].filter(Boolean).join(', ');
    const states = people.map(bodyOf).filter(Boolean);
    return [
        '[CÓMO ESTÁ EL GRUPO]',
        [when, where].filter(Boolean).join(' · '),
        states.length > 0 ? states.join(' ') : 'Todos están bien.',
        'Que se note en la narración, sin exagerarlo.',
    ].filter(Boolean).join('\n');
}
