/**
 * Lo que va a pasar, antes de que pase: la probabilidad de un golpe y lo que hace, y a
 * por quien va cada enemigo.
 *
 * Con los numeros delante, atacar al goblin que esta en el suelo en vez de al orco
 * cubierto es una decision, no una corazonada. Y saber a quien va a pegar el jefe es lo
 * que da sentido a esquivar, ayudar o empujar: se reacciona a algo que se ve.
 *
 * Puro: calcula con las mismas reglas que la tirada de verdad (un 20 siempre acierta, y
 * no hay pifia automatica con el 1, igual que en `handlePlayerCombatAttack`).
 */

/**
 * La probabilidad de acertar, de 0 a 1.
 *
 * @param {number} attackMod
 * @param {number} armorClass
 * @param {'advantage'|'disadvantage'|'normal'} [mode]
 * @returns {number}
 */
export function hitChance(attackMod, armorClass, mode = 'normal') {
    let hits = 0;
    for (let natural = 1; natural <= 20; natural++) {
        if (natural === 20 || natural + Number(attackMod || 0) >= Number(armorClass || 10)) hits++;
    }
    const once = hits / 20;
    if (mode === 'advantage') return 1 - (1 - once) ** 2;
    if (mode === 'disadvantage') return once ** 2;
    return once;
}

/**
 * El daño minimo y maximo de una formula como `2d6+1`, mas un modificador.
 *
 * @param {string} formula
 * @param {number} [bonus]
 * @returns {{min: number, max: number}}
 */
export function damageRange(formula, bonus = 0) {
    let min = 0;
    let max = 0;
    const text = String(formula || '').replace(/\s+/g, '');
    for (const [, sign, count, sides, flat] of text.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
        const k = sign === '-' ? -1 : 1;
        if (sides) {
            const n = Number(count || 1);
            min += k * n;
            max += k * n * Number(sides);
        } else {
            min += k * Number(flat);
            max += k * Number(flat);
        }
    }
    const b = Number(bonus) || 0;
    // Como en la tirada de verdad: un golpe que entra hace al menos 1.
    return { min: Math.max(1, min + b), max: Math.max(1, max + b) };
}

/**
 * Una linea para la tarjeta del objetivo.
 *
 * @param {Object} input
 * @param {number} input.attackMod
 * @param {number} input.armorClass
 * @param {'advantage'|'disadvantage'|'normal'} input.mode
 * @param {string[]} [input.reasons]
 * @param {string} input.formula
 * @param {number} input.damageBonus
 * @param {number} [input.targetHp]
 * @returns {{percent: number, min: number, max: number, text: string, kills: boolean}}
 */
export function describeForecast({ attackMod, armorClass, mode, reasons = [], formula, damageBonus, targetHp = Infinity }) {
    const percent = Math.round(hitChance(attackMod, armorClass, mode) * 100);
    const { min, max } = damageRange(formula, damageBonus);
    const edge = mode === 'advantage' ? ', con ventaja' : mode === 'disadvantage' ? ', con desventaja' : '';
    const why = reasons.length > 0 && mode !== 'normal' ? ` (${reasons.join(', ')})` : '';
    const kills = Number(targetHp) <= max;
    const tail = Number(targetHp) <= min ? ' · lo tumba si acierta' : kills ? ' · puede tumbarlo' : '';
    return {
        percent, min, max, kills,
        text: `${percent} % de acertar${edge}${why} · ${min === max ? min : `${min}–${max}`} de daño${tail}`,
    };
}

/**
 * Lo que va a hacer cada enemigo en su turno, en una linea por enemigo.
 *
 * @param {Array<{name: string, plan: {focusId: string|null, action: string, targetId: string|null}}>} plans
 * @param {Record<string, string>} names Nombre de cada miembro del grupo, por id.
 * @returns {Array<{enemy: string, targetId: string, text: string}>}
 */
export function describeIntents(plans, names) {
    return (plans || []).map(({ name, plan }) => {
        const targetId = String(plan?.targetId ?? plan?.focusId ?? '');
        const who = names[targetId] || '';
        const text = !who ? `${name} espera`
            : plan?.action === 'attack' && plan?.targetId ? `${name} → ${who}`
                : `${name} va hacia ${who}`;
        return { enemy: name, targetId, text };
    });
}
