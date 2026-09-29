/**
 * Las reacciones mágicas (J19.7 del roadmap sin conexión): Escudo, Contraconjuro, Caída de
 * pluma. Un conjuro que se lanza **fuera de tu turno**, con la reacción de la ronda.
 *
 * Cada conjuro de reacción dice en su columna `reaction` cuándo salta (`on`) y qué hace
 * (`effect`):
 *
 * | `on` | Cuándo | `effect` | Qué hace |
 * | :--- | :--- | :--- | :--- |
 * | `hit` | le aciertan un ataque | `ac` | suma `amount` a la CA hasta su turno: el golpe puede fallar |
 * | `spell` | alguien lanza un conjuro a la vista | `counter` | lo corta, si puede con él |
 * | `fall` | alguien cae | `nofall` | cae despacio y no se hace daño |
 *
 * Una reacción por ronda, como cualquier otra: quien ya la gastó no puede. Eso lo lleva
 * `turn-machine.js` (`reactionUsed`); aquí solo se pregunta.
 *
 * Puro: qué se puede lanzar ahora y qué pasa. Gastar el espacio es de `spell-slots.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.7.
 */

/** Cuándo salta una reacción. */
export const REACTION_TRIGGERS = ['hit', 'spell', 'fall'];

/** Qué hace. */
export const REACTION_EFFECTS = ['ac', 'counter', 'nofall'];

/** Cómo se dice cada momento, para el botón que aparece. */
export const REACTION_LABELS = {
    hit: 'Cuando te aciertan',
    spell: 'Cuando alguien lanza un conjuro cerca',
    fall: 'Cuando alguien cae',
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los conjuros de una lista que responden a ese momento.
 *
 * @param {any[]} spells Conjuros normalizados.
 * @param {string} trigger
 * @returns {any[]}
 */
export function reactionSpells(spells, trigger) {
    return (Array.isArray(spells) ? spells : []).filter(spell => text(spell?.reaction?.on) === text(trigger));
}

/**
 * Lo que alguien puede lanzar ahora como reacción, con el espacio que gastaría.
 *
 * @param {Object} input
 * @param {any[]} input.spells Los que puede lanzar (`castableSpells`).
 * @param {string} input.trigger
 * @param {boolean} input.reactionUsed Si ya gastó la reacción esta ronda.
 * @param {(spellLevel: number) => number} input.slotFor El espacio más bajo libre para ese nivel (0 si no hay).
 * @param {number} [input.distanceFeet] A qué distancia está lo que la dispara.
 * @returns {{options: Array<{spell: any, slotLevel: number}>, reason: string}}
 */
export function reactionOptions({ spells, trigger, reactionUsed, slotFor, distanceFeet = 0 }) {
    if (reactionUsed) return { options: [], reason: 'La reacción de esta ronda ya está gastada.' };
    const options = reactionSpells(spells, trigger).flatMap(spell => {
        const range = Number(spell.rangeFeet) || 0;
        if (range > 0 && distanceFeet > range) return [];
        const slotLevel = Number(spell.level) === 0 ? 0 : slotFor(Number(spell.level));
        if (Number(spell.level) > 0 && slotLevel <= 0) return [];
        return [{ spell, slotLevel }];
    });
    return { options, reason: options.length > 0 ? '' : 'No tiene nada que lanzar ahora.' };
}

/**
 * Si un conjuro puede con otro: sale solo si el espacio es de su nivel o más; si no, una
 * prueba de su característica contra 10 + el nivel del otro. Lo usan Contraconjuro y
 * Disipar magia.
 *
 * @param {Object} input
 * @param {number} input.slotLevel El espacio que se gasta.
 * @param {number} input.spellLevel El del conjuro que se quiere cortar.
 * @param {(formula: string) => {total: number}} input.roll
 * @param {number} [input.modifier] El de su característica de lanzar.
 * @returns {{success: boolean, auto: boolean, dc: number, total: number, lines: string[]}}
 */
export function beatsSpell({ slotLevel, spellLevel, roll, modifier = 0 }) {
    const level = Math.max(0, Math.floor(Number(spellLevel) || 0));
    if (Math.floor(Number(slotLevel) || 0) >= level) {
        return { success: true, auto: true, dc: 0, total: 0, lines: ['✨ Sale solo: el espacio es de su nivel o más.'] };
    }
    const dc = 10 + level;
    const d20 = Number(roll('1d20').total) || 0;
    const total = d20 + modifier;
    return {
        success: total >= dc,
        auto: false,
        dc,
        total,
        lines: [`🎲 Prueba: d20(${d20}) ${modifier >= 0 ? '+' : ''}${modifier} = ${total} vs CD ${dc}${total >= dc ? '.' : ': no puede con él.'}`],
    };
}

/**
 * Lo que pasa al lanzar una reacción.
 *
 * `context` según el efecto:
 * - `ac`: `{attackTotal, targetAc, magicMissile}`: el ataque que acertaba.
 * - `counter`: `{spellName, spellLevel, modifier}`: el conjuro que se quiere cortar.
 * - `nofall`: `{falling}`: los nombres de quienes caen.
 *
 * @param {Object} input
 * @param {any} input.spell
 * @param {number} input.slotLevel
 * @param {Record<string, any>} input.context
 * @param {(formula: string) => {total: number}} [input.roll]
 * @param {string} [input.casterName]
 * @returns {{effect: string, hitNow?: boolean, acBonus?: number, negatesMissiles?: boolean,
 *   countered?: boolean, safe?: string[], lines: string[]}}
 */
export function resolveReaction({ spell, slotLevel, context = {}, roll = () => ({ total: 10 }), casterName = 'Alguien' }) {
    const effect = text(spell?.reaction?.effect);
    const lines = [`⚡ ${casterName} reacciona: ${text(spell?.name)}.`];

    if (effect === 'ac') {
        const bonus = Math.max(0, Math.floor(Number(spell?.reaction?.amount) || 0));
        const ac = (Number(context.targetAc) || 10) + bonus;
        const hitNow = !context.magicMissile && (Number(context.attackTotal) || 0) >= ac;
        lines.push(context.magicMissile
            ? '🛡️ Los proyectiles se deshacen contra el escudo.'
            : `🛡️ CA ${ac} hasta su turno: ${hitNow ? 'el golpe entra igual.' : 'el golpe ya no entra.'}`);
        return { effect, hitNow, acBonus: bonus, negatesMissiles: Boolean(context.magicMissile), lines };
    }

    if (effect === 'counter') {
        const check = beatsSpell({ slotLevel, spellLevel: Number(context.spellLevel) || 0, roll, modifier: Number(context.modifier) || 0 });
        lines.push(...check.lines);
        lines.push(check.success ? `✋ ${text(context.spellName) || 'El conjuro'} se corta en seco.` : `${text(context.spellName) || 'El conjuro'} sale igual.`);
        return { effect, countered: check.success, lines };
    }

    if (effect === 'nofall') {
        const most = Math.max(1, Math.floor(Number(spell?.targets) || 1));
        const safe = (Array.isArray(context.falling) ? context.falling : []).map(text).filter(Boolean).slice(0, most);
        lines.push(safe.length > 0 ? `🪶 ${safe.join(', ')} ${safe.length > 1 ? 'caen' : 'cae'} como una pluma, sin hacerse daño.` : 'No cae nadie.');
        return { effect, safe, lines };
    }

    return { effect, lines };
}
