/**
 * E7.4 de wiki/ROADMAP_ENTRETENIDO.md (G5.4 y G5.6 de ROADMAP_AUTOMATIZAR): subir de nivel con
 * lo recomendado para el papel de cada uno, y preparar los conjuros según ese papel.
 *
 * - **El papel** sale de la formación (quien cura en ella, cura) y si no, de la clase: clérigo y
 *   druida curan; guerrero, paladín y bárbaro van delante; pícaro, explorador y monje hacen daño;
 *   mago, hechicero y brujo, magia de ataque; el bardo apoya.
 * - **Las características** van a la principal de su clase (2024: Fuerza el guerrero, Sabiduría
 *   el clérigo…) hasta 20; lo que sobra, a la segunda, y luego a la Constitución.
 * - **La mejora a elegir** (idea 46), la que más le sirve en su papel.
 * - **Los conjuros**: quien cura, curas primero; quien ataca, daño; quien apoya, lo que deja un
 *   estado o una zona. Del círculo más alto que ya lanza antes que de los bajos.
 *
 * El jugador sigue eligiendo: esto propone. A los compañeros que lleva el juego se les aplica sin
 * preguntar (`party/friction.js`).
 *
 * Puro: recomienda. No cambia ninguna ficha.
 */

import { classKey } from './checks.js';
import { ABILITY_CAP } from './level-up.js';
import { casterOf } from './spell-slots.js';
import { classSpellList, maxSpellLevel, preparedLimit } from './spell-prep.js';

/** Los papeles, y cómo se dicen. */
export const ROLES = {
    sanador: 'curar',
    frente: 'aguantar delante',
    dano: 'hacer daño',
    magia: 'magia de ataque',
    apoyo: 'apoyar al grupo',
};

/** El papel de cada clase. */
const CLASS_ROLE = {
    cleric: 'sanador', druid: 'sanador',
    fighter: 'frente', paladin: 'frente', barbarian: 'frente',
    rogue: 'dano', ranger: 'dano', monk: 'dano',
    wizard: 'magia', sorcerer: 'magia', warlock: 'magia',
    bard: 'apoyo',
};

/** Las características que más le valen a cada clase, en orden (2024). */
const CLASS_ABILITIES = {
    fighter: ['strength', 'constitution'], paladin: ['strength', 'charisma'], barbarian: ['strength', 'constitution'],
    ranger: ['dexterity', 'wisdom'], rogue: ['dexterity', 'constitution'], monk: ['dexterity', 'wisdom'],
    cleric: ['wisdom', 'constitution'], druid: ['wisdom', 'constitution'], bard: ['charisma', 'dexterity'],
    wizard: ['intelligence', 'constitution'], sorcerer: ['charisma', 'constitution'], warlock: ['charisma', 'constitution'],
};

/** Las seis, para quien no tiene clase conocida. */
const SIX = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

/** Cuánto vale cada efecto de una mejora para cada papel. */
const PERK_WEIGHTS = {
    sanador: { maxHp: 3, armorClass: 3, initiative: 1.5, attack: 0.5, speed: 0.5, perception: 1.5, insight: 1.2, persuasion: 0.8 },
    frente: { armorClass: 4, maxHp: 3.5, attack: 3, initiative: 1, speed: 0.8, athletics: 1.5, intimidation: 1 },
    dano: { attack: 4, initiative: 2.5, speed: 1.5, maxHp: 1.5, armorClass: 1.5, stealth: 2, perception: 1.5, sleight: 1 },
    magia: { maxHp: 3, initiative: 2.5, armorClass: 2.5, speed: 1, attack: 0.5, perception: 1.2, insight: 1 },
    apoyo: { persuasion: 3, insight: 2, maxHp: 2.5, initiative: 2, armorClass: 2, perception: 1.5, attack: 0.5 },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * El papel de alguien en el grupo.
 *
 * @param {any} member
 * @param {{duties?: Record<string, string>}|null} [formation] Si quien cura en la formación es él.
 * @returns {keyof typeof ROLES}
 */
export function roleOf(member, formation = null) {
    const id = text(member?.id);
    if (id && text(formation?.duties?.cura) === id) return 'sanador';
    const key = classKey(member?.class);
    const byClass = /** @type {Record<string, keyof typeof ROLES>} */ (CLASS_ROLE)[key];
    if (byClass) return byClass;
    // Una clase del taller: por su mejor característica.
    const best = SIX.map(ability => ({ ability, score: num(member?.[ability]) || 10 })).sort((a, b) => b.score - a.score)[0].ability;
    return best === 'strength' || best === 'constitution' ? 'frente' : best === 'dexterity' ? 'dano' : best === 'wisdom' ? 'sanador' : 'magia';
}

/**
 * Las características que más le valen, en orden: las de su clase y la Constitución al final.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function keyAbilities(member) {
    const key = classKey(member?.class);
    let list = /** @type {Record<string, string[]>} */ (CLASS_ABILITIES)[key];
    if (!list) list = [SIX.map(ability => ({ ability, score: num(member?.[ability]) || 10 })).sort((a, b) => b.score - a.score)[0].ability];
    // El guerrero que pelea con Destreza sube Destreza.
    if (key === 'fighter' && num(member?.dexterity) > num(member?.strength)) list = ['dexterity', 'constitution'];
    return [...new Set([...list, 'constitution'])];
}

/**
 * El reparto recomendado de los puntos de característica: a la principal hasta 20 (de dos en
 * dos, que es como sube el modificador), y lo que sobra a la siguiente.
 *
 * @param {any} member
 * @param {number} points
 * @returns {Record<string, number>}
 */
export function recommendAbilityPicks(member, points) {
    /** @type {Record<string, number>} */
    const picks = {};
    let left = Math.max(0, Math.floor(num(points)));
    const order = keyAbilities(member);
    for (const ability of [...order, ...SIX]) {
        if (left <= 0) break;
        const now = (num(member?.[ability]) || 10) + (picks[ability] ?? 0);
        const room = Math.max(0, ABILITY_CAP - now);
        // Con un número impar, un punto basta para subir el modificador.
        const give = Math.min(left, room);
        if (give <= 0) continue;
        picks[ability] = (picks[ability] ?? 0) + give;
        left -= give;
    }
    return picks;
}

/**
 * Lo que vale una mejora (idea 46) para un papel.
 *
 * @param {{effect?: Record<string, any>}} perk
 * @param {keyof typeof ROLES} role
 * @returns {number}
 */
export function perkWorth(perk, role) {
    const effect = perk?.effect ?? {};
    const weights = /** @type {Record<string, number>} */ (PERK_WEIGHTS[role] ?? PERK_WEIGHTS.frente);
    // Una rama que enseña una habilidad nueva vale para cualquiera.
    let worth = effect.ability ? 5 : 0;
    for (const [key, value] of Object.entries(effect)) {
        if (key === 'ability' || key === 'amount') continue;
        if (key === 'skill') worth += (weights[text(value)] ?? 0.3) * Math.max(1, num(effect.amount) / 2);
        else worth += (weights[key] ?? 0.3) * Math.max(1, Math.abs(num(value)) / (key === 'maxHp' ? 4 : key === 'speed' ? 5 : 1));
    }
    return worth;
}

/**
 * La mejora recomendada de las que se ofrecen.
 *
 * @param {Array<{id: string, effect?: Record<string, any>}>} offered
 * @param {keyof typeof ROLES} role
 * @returns {string} Su id, o vacío.
 */
export function recommendPerk(offered, role) {
    const list = Array.isArray(offered) ? offered : [];
    return text(list.map((perk, index) => ({ perk, index, worth: perkWorth(perk, role) }))
        .sort((a, b) => b.worth - a.worth || a.index - b.index)[0]?.perk?.id);
}

/**
 * Lo que sirve un conjuro para un papel: más, antes.
 *
 * @param {any} spell
 * @param {keyof typeof ROLES} role
 * @returns {number}
 */
export function spellWorth(spell, role) {
    const heals = Boolean(text(spell?.healing) || spell?.stabilizes || spell?.revives);
    const hurts = Boolean(text(spell?.damage));
    const controls = Boolean(text(spell?.condition) || spell?.zone);
    const slow = spell?.combat === false || ['minute', '10min', 'hour'].includes(text(spell?.castingTime));
    const reaction = text(spell?.castingTime) === 'reaction';
    /** @type {Record<string, [number, number, number]>} curar, dañar, controlar */
    const table = {
        sanador: [10, 4, 6],
        frente: [7, 6, 5],
        dano: [3, 10, 6],
        magia: [2, 10, 7],
        apoyo: [6, 5, 10],
    };
    const [heal, hurt, control] = table[role] ?? table.magia;
    let worth = Math.max(heals ? heal : 0, hurts ? hurt : 0, controls ? control : 0, 2);
    // Lo que pega a varios, un poco más.
    if (hurts && (spell?.area || spell?.zone || num(spell?.targets) > 1)) worth += 1;
    if (reaction) worth -= 1;
    if (slow) worth -= 5;
    return worth + num(spell?.level) * 0.5;
}

/**
 * Los conjuros recomendados de una lista de opciones.
 *
 * @param {any[]} options
 * @param {number} count
 * @param {keyof typeof ROLES} role
 * @returns {string[]} Sus ids.
 */
export function recommendSpells(options, count, role) {
    return (Array.isArray(options) ? options : [])
        .map((spell, index) => ({ spell, index, worth: spellWorth(spell, role) }))
        .sort((a, b) => b.worth - a.worth || a.index - b.index)
        .slice(0, Math.max(0, Math.floor(num(count))))
        .map(entry => text(entry.spell?.id))
        .filter(Boolean);
}

/**
 * G5.6: lo que prepara alguien tras un descanso largo según su papel: de su libro (mago) o de
 * su lista (clérigo, druida), de los niveles que ya lanza, hasta lo que le cabe. Nada si no
 * prepara (los que se saben sus conjuros, quien solo lanza rituales).
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @param {keyof typeof ROLES} input.role
 * @returns {string[]|null}
 */
export function preparedByRole({ member, classRow, catalogue, role }) {
    const casting = casterOf(classRow);
    if (!casting || casting.mode === 'known' || casting.ritualsOnly) return null;
    const max = maxSpellLevel(classRow, member?.level);
    const book = new Set((Array.isArray(member?.spellbook) ? member.spellbook : []).map(text));
    const pool = classSpellList(classRow, catalogue).filter(spell => spell.level > 0 && spell.level <= max
        && (casting.mode !== 'spellbook' || book.has(spell.id) || spell.aliases.some((/** @type {string} */ a) => book.has(a))));
    return recommendSpells(pool, preparedLimit(classRow, member), role);
}

/**
 * Decisión de Daniel (2026-10-03): el cuadro de preparar del héroe sale ya marcado con lo de su
 * papel, igual que lo preparan solos los compañeros, y una línea que lo dice. Él lo cambia antes
 * de aceptar. Nada si no prepara o no hay nada que marcar.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue
 * @param {keyof typeof ROLES} input.role
 * @returns {{chosen: string[], line: string}|null}
 */
export function heroPreparation({ member, classRow, catalogue, role }) {
    const chosen = preparedByRole({ member, classRow, catalogue, role });
    if (!chosen || chosen.length === 0) return null;
    return { chosen, line: `Marcado lo de su papel: ${ROLES[role] ?? role}. Cámbialo si quieres.` };
}

/**
 * En una frase, lo recomendado: «Su papel: curar. +2 a Sabiduría; Aguante; Curar heridas.»
 *
 * @param {Object} input
 * @param {keyof typeof ROLES} input.role
 * @param {Record<string, number>} [input.picks]
 * @param {string} [input.perk] El nombre de la mejora.
 * @param {string[]} [input.spells] Los nombres de los conjuros.
 * @returns {string}
 */
export function describeAdvice({ role, picks = {}, perk = '', spells = [] }) {
    const names = { strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución', intelligence: 'Inteligencia', wisdom: 'Sabiduría', charisma: 'Carisma' };
    const parts = Object.entries(picks).filter(([, n]) => n > 0)
        .map(([ability, n]) => `+${n} a ${/** @type {Record<string, string>} */ (names)[ability] ?? ability}`);
    if (text(perk)) parts.push(text(perk));
    if (spells.length > 0) parts.push(spells.join(', '));
    return `Su papel: ${ROLES[role] ?? role}.${parts.length > 0 ? ` Lo recomendado: ${parts.join('; ')}.` : ''}`;
}
