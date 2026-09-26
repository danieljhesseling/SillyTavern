/**
 * Arquetipo × plantilla = bicho.
 *
 * Un bestiario escrito ficha a ficha tiene los bichos que alguien tuvo tiempo de escribir,
 * y siempre los mismos. Aqui un **arquetipo** dice que es y como reparte lo que le toca
 * por su desafio, y una **plantilla** lo modifica y le cambia el nombre: viejo, rabioso,
 * de las minas, jefe. Veinte por quince son trescientos bichos escribiendo treinta y cinco
 * filas, y encima salen equilibrados, porque los numeros no son absolutos.
 *
 * Esa es la idea que sostiene todo esto: **los factores son relativos a la linea base del
 * desafio**. Un lobo de CR 1/4 y un lobo de CR 3 se escriben con la misma fila; lo que
 * cambia es contra que se multiplica. Escribir "35 puntos de vida" en una ficha es atarla
 * a un nivel concreto, y por eso los bestiarios envejecen mal.
 *
 * Lo que sale tiene **exactamente** los campos de la ficha de enemigo del editor, y se
 * puede mirar y cambiar antes de guardarlo: una ayuda, no una caja negra.
 *
 * Puro: recibe el compendio y el azar, y devuelve un borrador.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#67-#82) y wiki/ROADMAP_COMPENDIO.md, B6.
 */

import { fillPattern } from './names.js';

/** Los cuatro que el motor sabe jugar. Cualquier otro seria un bicho que no se mueve. */
export const PROFILES = ['aggressive', 'skirmisher', 'guardian', 'coward'];

/** Cuantas plantillas se apilan como mucho. Tres ya no se leen en el nombre. */
export const MAX_TEMPLATES = 2;

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
 * Lo que un bicho corriente de ese desafio tiene.
 *
 * La curva esta aqui y no en el archivo a proposito: es **una sola** para todo el
 * bestiario, y tenerla repetida en cuarenta filas es como se acaba con cuarenta curvas
 * distintas. Los factores, que si son cosa de cada bicho, si estan en el archivo.
 *
 * @param {number} cr
 * @returns {{hp: number, armorClass: number}}
 */
export function baselineFor(cr) {
    const level = Math.max(0, number(cr, 0));
    return {
        hp: Math.round(9 + level * 12),
        armorClass: 11 + Math.floor(level / 2),
    };
}

/**
 * Lo que cuesta un arquetipo, para poder decir que uno se ha pasado.
 *
 * Vida y armadura se pagan de la misma bolsa: un bicho que aguanta el doble **y** es mas
 * dificil de acertar no es una variante, es un error de escritura. Esto existe para que
 * ese error se vea en una prueba en vez de en una partida.
 *
 * @param {any} row
 * @returns {number}
 */
export function archetypeCost(row) {
    const hp = (number(row?.hpFactor, 1) - 1) * 10;
    const ac = number(row?.acBonus, 0) * 3;
    const speed = (number(row?.speed, 30) - 30) / 10;
    const range = Math.max(0, number(row?.rangeFeet, 5) - 5) / 20;
    return Math.round((hp + ac + speed + range) * 10) / 10;
}

/**
 * El nombre, con el adjetivo concordado.
 *
 * "Araña rabioso" se lee mal y delata que detras hay una maquina. El arquetipo dice su
 * genero y la plantilla trae las dos formas: es una columna mas y se nota en cada linea.
 *
 * @param {any} archetype
 * @param {any[]} templates
 * @param {() => number} random
 * @returns {string}
 */
export function breedName(archetype, templates, random) {
    let name = text(archetype?.name);
    const feminine = text(archetype?.gender) === 'f';

    for (const template of templates) {
        const pattern = text(template?.pattern);
        if (!pattern) continue;

        name = fillPattern(pattern, {
            bicho: [name],
            adj: [text(feminine ? (template.adjf ?? template.adj) : template.adj)],
            lugar: [text(template.lugar)],
        }, random).replace(/\s+/g, ' ').trim();
    }

    return name;
}

/**
 * Un bicho de un arquetipo y sus plantillas.
 *
 * Devuelve null cuando la bateria no esta, y quien llama sigue con lo que hiciera antes.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {() => number} [input.random]
 * @param {number} [input.cr]        El desafio que se quiere. Manda sobre todo lo demas.
 * @param {string} [input.biome]     Donde se juega: el pantano no da lobos de nieve.
 * @param {number} [input.templates] Cuantas plantillas apilar. Por defecto, una o ninguna.
 * @param {string} [input.season]    La estación (idea 97): los que migran solo salen en la suya.
 * @returns {any|null}
 */
export function breedMonster({ compendium, random = Math.random, cr = 0.5, biome = '', templates = -1, season = '' }) {
    if (!compendium?.has?.('bestiario')) return null;

    /** @type {Record<string, any>} */
    const ask = { kind: 'arquetipo' };
    if (text(biome)) ask.biome = text(biome);
    // Quien no dice estación sale siempre; quien la dice, solo en ella.
    if (text(season)) ask.season = text(season);

    // Un bioma sin bichos escritos no puede dejar el tablero vacio: se prueba sin el.
    const archetype = compendium.pick('bestiario', { where: ask, random })
        ?? compendium.pick('bestiario', { where: { kind: 'arquetipo' }, random });
    if (!archetype) return null;

    const howMany = templates >= 0
        ? Math.min(MAX_TEMPLATES, templates)
        // Sin decir nada: la mitad de las veces sale tal cual. Un bestiario donde todo
        // lleva apellido cansa igual que uno donde nada lo lleva.
        : (random() < 0.5 ? 0 : 1);

    const stack = compendium.take('bestiario', howMany, { where: { kind: 'plantilla' }, random });

    const base = baselineFor(cr);
    let hpFactor = number(archetype.hpFactor, 1);
    let acBonus = number(archetype.acBonus, 0);
    let speed = number(archetype.speed, 30);
    let level = number(cr, 0.5);
    let profile = text(archetype.profile);
    // Lo que sabe hacer: lo suyo mas lo de sus plantillas. Un cultista «sagrado» cura.
    const abilities = new Set(listOf(archetype.abilities));

    for (const template of stack) {
        hpFactor *= number(template.hpFactor, 1);
        acBonus += number(template.acBonus, 0);
        speed += number(template.speedDelta, 0);
        level += number(template.crDelta, 0);
        // La ultima manda: apilar "rabioso" sobre "herido" deja al bicho rabioso, que es
        // lo que dice el nombre que lee quien juega.
        if (PROFILES.includes(text(template.profile))) profile = text(template.profile);
        for (const id of listOf(template.abilities)) abilities.add(id);
    }

    const description = [
        text(archetype.quirk),
        text(archetype.weakness),
        ...stack.map((/** @type {any} */ t) => text(t.note)),
    ].filter(Boolean).join(' ');

    return {
        name: breedName(archetype, stack, random),
        hp: Math.max(1, Math.round(base.hp * hpFactor)),
        armorClass: Math.max(5, base.armorClass + acBonus),
        cr: Math.max(0, Math.round(level * 100) / 100),
        speed: Math.max(5, speed),
        attackRangeFeet: Math.max(5, number(archetype.rangeFeet, 5)),
        profile: PROFILES.includes(profile) ? profile : 'aggressive',
        abilities: [...abilities],
        description,
        // T6: si se doma, y en qué, lo dice su fila; las plantillas no lo cambian.
        ...(archetype.domable !== undefined ? { domable: text(archetype.domable) } : {}),
        from: { arquetipo: text(archetype.id), plantillas: stack.map((/** @type {any} */ t) => text(t.id)) },
    };
}

/**
 * Una lista de ids, venga como lista o como texto con comas.
 *
 * @param {any} value
 * @returns {string[]}
 */
function listOf(value) {
    const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
    return raw.map((/** @type {any} */ id) => text(id)).filter(Boolean);
}

/**
 * Una banda: varios bichos distintos del mismo sitio.
 *
 * Cinco copias del mismo esqueleto son una pelea; dos matones, un tirador y uno que huye
 * son un problema. Eso es lo que separa un encuentro de un monton.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {number} input.howMany
 * @param {() => number} [input.random]
 * @param {number} [input.cr]
 * @param {string} [input.biome]
 * @param {string} [input.season] La estación (idea 97).
 * @returns {any[]}
 */
export function breedBand({ compendium, howMany, random = Math.random, cr = 0.5, biome = '', season = '' }) {
    /** @type {any[]} */
    const out = [];
    const seen = new Set();

    for (let i = 0; i < Math.max(0, howMany) * 3 && out.length < howMany; i++) {
        const monster = breedMonster({ compendium, random, cr, biome, season });
        if (!monster) break;

        const key = `${monster.from.arquetipo}|${monster.from.plantillas.join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(monster);
    }

    return out;
}

/**
 * El bicho en una linea, para el aviso de despues.
 *
 * @param {any} monster
 * @returns {string}
 */
export function describeMonster(monster) {
    if (!monster) return '';
    return [
        text(monster.name),
        `${monster.hp} PG`,
        `CA ${monster.armorClass}`,
        `CR ${monster.cr}`,
        text(monster.profile),
    ].filter(Boolean).join(' · ');
}
