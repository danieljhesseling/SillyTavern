/**
 * Lo que alguien sabe hacer, sacado del compendio.
 *
 * Elegir «Picara» en la pantalla de personaje era escribir una palabra en la cabecera: la
 * clase no traia nada consigo. Una bateria de habilidades con su clase escrita es lo que
 * hace que esa eleccion signifique algo **desde el nivel 1**.
 *
 * Y hay un motivo para que esto tenga validacion propia y no solo la del compendio: los
 * cuatro campos que mandan son **vocabularios cerrados**, y escribir otro valor no da
 * error. Degrada en silencio. `resource: 'per_long_rest'` se convierte en `at_will`, y una
 * habilidad de una vez al dia pasa a poder usarse cada turno sin que nadie se entere hasta
 * mitad de una campana.
 *
 * Puro: recibe el compendio y el azar, y devuelve fichas de habilidad.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#70, #79) y wiki/ROADMAP_COMPENDIO.md, B5.
 */

import {
    ABILITY_COSTS, ABILITY_RESOURCES, ABILITY_TARGETS, ABILITY_RESOLUTIONS,
    describeAbility,
} from '../rules/abilities.js';

/** Los cuatro vocabularios, juntos, para poder comprobarlos de una pasada. */
export const CLOSED_FIELDS = {
    cost: ABILITY_COSTS,
    resource: ABILITY_RESOURCES,
    target: ABILITY_TARGETS,
    resolution: ABILITY_RESOLUTIONS,
};

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
 * Lo que impide usar una fila de habilidad.
 *
 * Esto **no** lo puede hacer el validador del compendio: alli las reglas son las de toda
 * fila —id, nombre, peso— y esto son las de este dominio. Un valor fuera de vocabulario
 * pasa esa validacion y luego no hace lo que dice.
 *
 * @param {any} row
 * @returns {string[]}
 */
export function validateAbility(row) {
    /** @type {string[]} */
    const errors = [];
    const name = text(row?.name) || text(row?.id) || '(sin nombre)';

    for (const [field, allowed] of Object.entries(CLOSED_FIELDS)) {
        const value = text(row?.[field]);
        if (!value) {
            errors.push(`${name}: falta "${field}".`);
        } else if (!allowed.includes(value)) {
            errors.push(
                `${name}: "${field}" dice "${value}", que no existe. Vale: ${allowed.join(', ')}.`,
            );
        }
    }

    // Usos por descanso en algo que no se descansa es un numero que nadie mira.
    if (text(row?.resource) === 'at_will' && row?.usesPerRest !== undefined) {
        errors.push(`${name}: "usesPerRest" no pinta nada en algo a voluntad.`);
    }
    if (text(row?.resource) !== 'at_will' && text(row?.resource) && !(number(row?.usesPerRest, 0) > 0)) {
        errors.push(`${name}: lo que se gasta tiene que decir cuántas veces ("usesPerRest").`);
    }

    // Una salvacion sin CD es una salvacion contra que: el panel escribe «CD undefined».
    if (text(row?.resolution) === 'save' && !(number(row?.saveDc, 0) > 0)) {
        errors.push(`${name}: se salva contra algo, y no dice contra qué CD ("saveDc").`);
    }
    if (text(row?.resolution) !== 'save' && row?.saveDc !== undefined) {
        errors.push(`${name}: trae una CD y no pide salvación.`);
    }
    // Salva el objetivo, no quien la usa: sobre uno mismo no hay nadie al otro lado.
    if (text(row?.resolution) === 'save' && text(row?.target) === 'self') {
        errors.push(`${name}: pide salvación y apunta a uno mismo; no salva nadie.`);
    }
    // Una salvacion que no hace dano, no cura y no deja condicion es un dado que se tira
    // para nada: el motor la resuelve y no cambia nada en el tablero.
    if (text(row?.resolution) === 'save'
        && !text(row?.damage) && !text(row?.healing) && !text(row?.condition)) {
        errors.push(`${name}: se salva de nada — ni daño, ni cura, ni condición.`);
    }

    // Curar a un enemigo o hacer dano a uno mismo es casi siempre una fila mal copiada.
    if (text(row?.healing) && text(row?.target) === 'enemy') {
        errors.push(`${name}: cura, y apunta a un enemigo.`);
    }
    if (text(row?.damage) && text(row?.target) === 'self') {
        errors.push(`${name}: hace daño, y apunta a uno mismo.`);
    }

    return errors;
}

/**
 * Todas las de la bateria que no se pueden usar.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
export function validateAbilities(compendium) {
    if (!compendium?.has?.('habilidades')) return [];
    return compendium.find('habilidades', {})
        .flatMap((/** @type {any} */ row) => validateAbility(row));
}

/**
 * Una fila del compendio con la forma que el catalogo del motor espera.
 *
 * @param {any} row
 * @returns {any}
 */
export function asAbility(row) {
    /** @type {any} */
    const ability = {
        id: text(row?.id),
        name: text(row?.name),
        description: text(row?.note),
        cost: text(row?.cost),
        resource: text(row?.resource),
        target: text(row?.target),
        resolution: text(row?.resolution),
    };

    if (number(row?.usesPerRest, 0) > 0) ability.usesPerRest = number(row.usesPerRest, 1);
    // El alcance va siempre, aunque sea cuerpo a cuerpo: `describeAbility` lo escribe, y
    // sin el sale «undefined ft» en la lista de todo el que no sea sobre si mismo.
    ability.rangeFeet = Math.max(0, number(row?.rangeFeet, 5));
    if (number(row?.saveDc, 0) > 0) ability.saveDc = number(row.saveDc, 10);
    if (text(row?.damage)) ability.damage = text(row.damage);
    if (text(row?.damageType)) ability.damageType = text(row.damageType);
    if (text(row?.healing)) ability.healing = text(row.healing);
    // `party.js` saca el modificador de salvacion de aqui: sin esto todo salvaba por
    // destreza, y una zarza que te agarra las piernas se esquivaba igual que un rayo.
    if (text(row?.saveAbility)) ability.saveAbility = text(row.saveAbility);
    // Y sin la condicion, «Sueño pesado» tiraba la salvacion y no pasaba nada.
    if (text(row?.condition)) {
        ability.condition = text(row.condition);
        ability.conditionRounds = Math.max(1, number(row?.conditionRounds, 1));
    }

    return ability;
}

/**
 * Lo que sabe hacer alguien de esa clase a ese nivel.
 *
 * Lo comun —vendar, cubrirse, dar la voz— sale con cualquier clase: son cosas que sabe
 * cualquiera que haya salido dos veces de casa, y dejarlas fuera obligaria a repetirlas en
 * cada clase del archivo.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {string} [input.className]
 * @param {number} [input.level]
 * @returns {any[]}
 */
export function abilitiesFor({ compendium, className = '', level = 1 }) {
    if (!compendium?.has?.('habilidades')) return [];

    const at = Math.max(1, Math.round(number(level, 1)));
    const wanted = text(className).toLowerCase();

    return compendium.find('habilidades', { kind: 'habilidad' })
        .filter((/** @type {any} */ row) => {
            if (number(row.level, 1) > at) return false;
            const classes = (row.when?.class ?? []).map(text).map(c => c.toLowerCase());
            if (classes.length === 0 || classes.includes('*')) return true;
            return wanted ? classes.includes(wanted) : false;
        })
        .map(asAbility);
}

/**
 * Las clases que la bateria conoce, para poder ofrecerlas.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
export function classesOf(compendium) {
    if (!compendium?.has?.('habilidades')) return [];

    const found = compendium.find('habilidades', { kind: 'habilidad' })
        .flatMap((/** @type {any} */ row) => (row.when?.class ?? []).map(text))
        .filter((/** @type {string} */ name) => name && name !== '*');

    return [...new Set(found)].sort();
}

/**
 * La habilidad con su nombre delante, para una lista.
 *
 * Lo de detras lo cuenta `describeAbility` del motor, que ya sabia hacerlo y ademas
 * mejor: conoce las etiquetas, la CD de salvacion y las condiciones. Escribir aqui una
 * segunda version era tener dos sitios donde arreglar lo mismo.
 *
 * @param {any} ability
 * @returns {string}
 */
export function nameAndAbility(ability) {
    if (!ability) return '';
    return `${text(ability.name)} · ${describeAbility(ability)}`;
}
