/**
 * Que lo que llevas encima signifique algo.
 *
 * Hasta aqui el equipo era **decorado**. La forja escribia `damageDice`, `damageType`,
 * `slot` y `effects` en cada objeto, y el combate no leia ninguno: el alcance salia de
 * buscar «bow|crossbow|sling|wand» en el nombre —en ingles, asi que un «Arco corto de
 * tejo» del compendio era cuerpo a cuerpo— y el dano salia **solo del nivel**, asi que una
 * daga y un hacha a dos manos pegaban igual. Escribir treinta armas mas sobre eso habria
 * sido escribir treinta filas que nadie mira.
 *
 * La regla que lo arregla sin tirar la progresion:
 *
 * > **El nivel dice de que dado partes; el arma te mueve por la escalera.**
 *
 * El nivel sigue dando la base que daba —1d8, 1d10, 2d8—, y el arma la sube o la baja por
 * una escalera de dados. Una daga baja dos peldanos y un arma a dos manos sube tres. Asi
 * un personaje de nivel 9 con una daga sigue siendo de nivel 9, pero elegir arma **cuesta
 * algo**: es la diferencia entre botin y una lista de numeros.
 *
 * Y la armadura, igual de literal: la clase de armadura sale de lo que llevas puesto, con
 * la destreza que la armadura te deje usar. Una placa no se lleva bien con ser agil, y eso
 * lo dice la fila, no este codigo.
 *
 * Puro: lee una ficha y devuelve numeros. No equipa, no guarda y no dibuja.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md, B3 y B4.
 */

/**
 * La escalera de dados, de menos a mas.
 *
 * Un solo sitio donde se decide que es «un peldano mas». Sin esto, cada regla que quisiera
 * subir el dano inventaria su propia progresion y acabarian diciendo cosas distintas.
 */
export const DAMAGE_LADDER = [
    '1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '2d10', '3d8', '3d10', '4d8',
];

/** Cuanta destreza deja usar una armadura. Vocabulario cerrado. */
export const DEX_MODES = ['full', 'half', 'none'];

/** Lo que el dado de un arma vale en peldanos, respecto al d8 de toda la vida. */
const DIE_STEP = { 4: -2, 6: -1, 8: 0, 10: 1, 12: 2 };

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * El objeto que lleva puesto en esa ranura, si lo lleva.
 *
 * @param {any} member
 * @param {string} slot
 * @returns {any}
 */
export function equippedIn(member, slot) {
    const id = member?.equippedItems?.[text(slot)];
    if (!id) return null;
    return (Array.isArray(member?.items) ? member.items : [])
        .find((/** @type {any} */ item) => item?.id === id) ?? null;
}

/**
 * El arma que empuna, si empuna alguna.
 *
 * @param {any} member
 * @returns {any}
 */
export function weaponOf(member) {
    return equippedIn(member, 'weapon');
}

/**
 * Lo que un arma mueve por la escalera.
 *
 * El dado manda, y las dos manos suman: renunciar al escudo tiene que pagar algo, o nadie
 * renunciaria al escudo.
 *
 * @param {any} item
 * @returns {number}
 */
export function damageStepOf(item) {
    const dice = text(item?.damageDice);
    if (!dice) return 0;

    const die = /d(\d+)/i.exec(dice);
    const faces = die ? Number(die[1]) : 0;
    const step = DIE_STEP[faces] ?? 0;

    // Un «2d6» ya viene subido de fabrica: cada dado de mas es un peldano.
    const count = Math.max(1, number(/^(\d+)d/i.exec(dice)?.[1], 1));

    return step + (count - 1) + (number(item?.hands, 1) >= 2 ? 1 : 0);
}

/**
 * Subir o bajar una formula por la escalera.
 *
 * Lo que no esta en la escalera se devuelve tal cual: una formula rara escrita a mano vale
 * mas que un dado inventado por este codigo.
 *
 * @param {string} formula
 * @param {number} step
 * @returns {string}
 */
export function stepDamage(formula, step) {
    const at = DAMAGE_LADDER.indexOf(text(formula));
    if (at < 0) return text(formula);

    const moved = Math.min(DAMAGE_LADDER.length - 1, Math.max(0, at + Math.round(number(step, 0))));
    return DAMAGE_LADDER[moved];
}

/**
 * El dano de quien lleva lo que lleva.
 *
 * Devuelve `''` cuando el arma no dice nada —o no hay arma—, y entonces quien llama se
 * queda con lo que hiciera antes. Aditivo: una partida vieja, con objetos sin estos
 * campos, pega exactamente igual que pegaba.
 *
 * @param {any} member
 * @param {string} base Lo que el nivel ya decia.
 * @returns {string}
 */
export function weaponDamage(member, base) {
    const weapon = weaponOf(member);
    if (!weapon || !text(weapon.damageDice)) return '';

    const step = damageStepOf(weapon);
    return step === 0 ? text(base) : stepDamage(base, step);
}

/**
 * Hasta donde llega el arma, si lo dice.
 *
 * Devuelve 0 cuando no lo dice, para que quien llama siga con su regla de siempre —la que
 * mira el nombre en ingles y la clase—. Un arma del compendio si lo dice, y por eso un
 * arco del compendio por fin dispara.
 *
 * @param {any} member
 * @returns {number}
 */
export function weaponRange(member) {
    const weapon = weaponOf(member);
    return Math.max(0, number(weapon?.rangeFeet, 0));
}

/**
 * Si lo que empuna le deja llevar escudo.
 *
 * Devuelve el motivo, no un booleano: «no te queda mano» es una frase que se puede
 * ensenar, y eso es lo que convierte una regla en una decision entendida.
 *
 * @param {any} member
 * @returns {string}
 */
export function shieldBlocked(member) {
    const weapon = weaponOf(member);
    if (number(weapon?.hands, 1) < 2) return '';
    return `${text(weapon.name) || 'El arma'} se lleva a dos manos: no te queda mano para el escudo.`;
}

/**
 * La clase de armadura de lo que lleva puesto.
 *
 * Una armadura **sustituye** al 10 de partida, no se suma a el; el escudo y los demas
 * trastos si suman. Y la destreza cuenta segun lo que la armadura deje: entera en una
 * ligera, la mitad en una media, nada en una placa. Eso lo dice la fila con `dexMode`.
 *
 * Devuelve tambien de donde sale cada cosa, porque una clase de armadura que no se puede
 * explicar se siente como una trampa del motor.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {number} input.dexModifier
 * @returns {{armorClass: number, from: string[], worn: boolean}}
 */
export function armourClassOf({ member, dexModifier }) {
    const dex = Math.round(number(dexModifier, 0));
    const body = equippedIn(member, 'body');
    const base = number(body?.armorClass, 0);
    /** @type {string[]} */
    const from = [];

    let armorClass = 10;
    let dexAllowed = dex;

    if (base > 0) {
        armorClass = base;
        from.push(`${text(body.name) || 'Armadura'} ${base}`);
        const mode = DEX_MODES.includes(text(body.dexMode)) ? text(body.dexMode) : 'full';
        if (mode === 'none') dexAllowed = 0;
        else if (mode === 'half') dexAllowed = Math.min(dex, 2);
    } else {
        from.push('Sin armadura 10');
    }

    if (dexAllowed !== 0) {
        armorClass += dexAllowed;
        from.push(`Destreza ${dexAllowed >= 0 ? '+' : ''}${dexAllowed}`);
    }

    // Lo demas —escudo, yelmo, un anillo— suma lo que diga su `effects`, que es el campo
    // que la ficha ya tenia y que nadie leia.
    for (const slot of ['shield', 'head', 'hands', 'feet', 'ring']) {
        const item = equippedIn(member, slot);
        const plus = (Array.isArray(item?.effects) ? item.effects : [])
            .filter((/** @type {any} */ effect) => text(effect?.stat) === 'armorClass')
            .reduce((/** @type {number} */ sum, /** @type {any} */ effect) =>
                sum + number(effect.modifier, 0), 0)
            + number(item?.armorClass, 0);
        if (plus === 0) continue;
        armorClass += plus;
        from.push(`${text(item.name) || slot} ${plus >= 0 ? '+' : ''}${plus}`);
    }

    return { armorClass, from, worn: base > 0 };
}

/**
 * La clase de armadura en una linea, para poder ensenarla.
 *
 * @param {any} sum
 * @returns {string}
 */
export function describeArmour(sum) {
    if (!sum) return '';
    return `CA ${sum.armorClass} (${sum.from.join(', ')})`;
}
