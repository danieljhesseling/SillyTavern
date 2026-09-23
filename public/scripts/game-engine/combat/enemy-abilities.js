/**
 * Cuándo un enemigo usa una habilidad en vez de pegar.
 *
 * El catálogo de habilidades es compartido —la misma fila sirve para la *Furia* de un
 * bárbaro y para el aliento de un dragón— pero hasta ahora solo lo usaba el grupo: la IA de
 * los enemigos no sabía lanzar nada. Así que un cultista con *Rayo de fuego* en su ficha
 * se acercaba a darte puñetazos.
 *
 * Las reglas son pocas y se pueden leer, como toda la IA de este motor: quien juega tiene
 * que poder prever lo que hará el enemigo para planear contra ello.
 *
 * 1. **Curar primero.** Si alguien de su bando está por debajo de la mitad y tiene con
 *    qué curarlo, lo cura. El peor, antes.
 * 2. **Lo gordo, cuando llega.** Una habilidad con usos contados se gasta en cuanto hay
 *    a quien alcanzar: es su golpe especial, y guardárselo no lo hace mejor.
 * 3. **Lo de siempre, si pega más.** Una a voluntad solo sustituye al ataque normal si
 *    hace más daño de media, o si llega donde el ataque no.
 *
 * Puro: elige y no toca nada.
 */

import { usesLeft } from '../rules/abilities.js';

/**
 * La media de una fórmula de dados, `2d6+3` → 10.
 *
 * @param {string} formula
 * @returns {number}
 */
export function averageOf(formula) {
    const match = String(formula || '').replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!match) return Number(formula) || 0;
    const count = Math.max(1, Number(match[1]) || 1);
    const sides = Math.max(1, Number(match[2]) || 1);
    return count * (sides + 1) / 2 + (Number(match[3]) || 0);
}

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
function feet(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;
}

/** @param {{currentHp?: number, maxHp?: number}} c */
function fraction(c) {
    const max = Number(c?.maxHp) || 0;
    return max > 0 ? (Number(c?.currentHp) || 0) / max : 1;
}

/**
 * @typedef {Object} AbilityChoice
 * @property {import('../rules/abilities.js').Ability} ability
 * @property {string} targetId
 * @property {'enemy'|'ally'|'self'} side
 * @property {string} reason
 */

/**
 * Qué habilidad usa, y sobre quién. `null` si no le compensa ninguna.
 *
 * @param {Object} input
 * @param {{id: string, abilityUses?: Record<string, number>, currentHp?: number, maxHp?: number}} input.actor
 * @param {{x: number, y: number}} input.from Donde acaba de moverse.
 * @param {import('../rules/abilities.js').Ability[]} input.abilities Las que se sabe, ya normalizadas.
 * @param {Array<{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number}>} input.targets El grupo.
 * @param {Array<{id: string, gridX: number, gridY: number, currentHp?: number, maxHp?: number}>} [input.allies] Los suyos, sin él.
 * @param {string|null} [input.focusId] A quién iba, para preferirlo.
 * @param {number} [input.basicAverage] El daño medio de su ataque normal.
 * @param {number} [input.basicRangeFeet]
 * @returns {AbilityChoice|null}
 */
export function chooseEnemyAbility({
    actor, from, abilities, targets, allies = [], focusId = null, basicAverage = 4, basicRangeFeet = 5,
}) {
    const usable = (abilities || []).filter(a => a && usesLeft(actor, a) > 0 && a.cost !== 'free');
    if (usable.length === 0) return null;

    // 1. Curar.
    const self = { ...actor, gridX: from.x, gridY: from.y };
    const hurt = [self, ...(allies || [])]
        .filter(c => (Number(c.currentHp) || 0) > 0 && fraction(c) < 0.5)
        .sort((a, b) => fraction(a) - fraction(b));
    for (const who of hurt) {
        const isSelf = String(who.id) === String(actor.id);
        const heal = usable
            .filter(a => a.healing && (a.target === 'ally' || (isSelf && a.target === 'self')))
            .filter(a => isSelf || feet(from.x, from.y, who.gridX, who.gridY) <= a.rangeFeet)
            .sort((a, b) => averageOf(b.healing) - averageOf(a.healing))[0];
        if (heal) {
            return {
                ability: heal,
                targetId: String(who.id),
                side: isSelf && heal.target === 'self' ? 'self' : 'ally',
                reason: isSelf ? 'Se cura antes de caer.' : 'Cura al más herido de los suyos.',
            };
        }
    }

    // 2 y 3. Hacer daño o tumbar.
    const living = (targets || []).filter(t => (Number(t.currentHp) || 0) > 0);
    const harmful = usable.filter(a => a.target === 'enemy' && (a.damage || a.condition));

    /** @type {Array<{ability: any, target: any, score: number}>} */
    const options = [];
    for (const ability of harmful) {
        const inRange = living
            .filter(t => feet(from.x, from.y, t.gridX, t.gridY) <= ability.rangeFeet)
            .sort((a, b) =>
                Number(String(b.id) === String(focusId)) - Number(String(a.id) === String(focusId))
                || fraction(a) - fraction(b)
                || String(a.id).localeCompare(String(b.id)));
        const target = inRange[0];
        if (!target) continue;

        const damage = averageOf(ability.damage);
        const limited = ability.resource !== 'at_will';
        const basicReaches = living.some(t => feet(from.x, from.y, t.gridX, t.gridY) <= basicRangeFeet);
        // Una a voluntad tiene que ganarle al ataque normal; si no, no hay motivo.
        if (!limited && basicReaches && damage <= basicAverage) continue;

        options.push({ ability, target, score: damage + (ability.condition ? 3 : 0) + (limited ? 100 : 0) });
    }

    const best = options.sort((a, b) => b.score - a.score || a.ability.id.localeCompare(b.ability.id))[0];
    if (!best) return null;
    return {
        ability: best.ability,
        targetId: String(best.target.id),
        side: 'enemy',
        reason: best.ability.resource === 'at_will' ? 'Le sale más a cuenta que el golpe.' : 'Saca su golpe especial.',
    };
}

/**
 * Lo más lejos que llega con algo que haga daño y pueda usar. Sirve para que un tirador
 * de conjuros se quede a su distancia en vez de acercarse a dar puñetazos.
 *
 * @param {{abilityUses?: Record<string, number>}} actor
 * @param {import('../rules/abilities.js').Ability[]} abilities
 * @returns {number}
 */
export function longestReach(actor, abilities) {
    return (abilities || [])
        .filter(a => a && a.target === 'enemy' && a.damage && usesLeft(actor, a) > 0)
        .reduce((max, a) => Math.max(max, Number(a.rangeFeet) || 0), 0);
}
