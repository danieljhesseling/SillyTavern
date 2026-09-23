/**
 * Los vecinos: que un mundo nuevo tenga a donde ir.
 *
 * Una campana recien creada tenia **un solo sitio**. Con uno solo no hay distancia, y sin
 * distancia no hay nada de lo que el mundo-lista prometia: ni viaje que cueste dias, ni
 * rodeo que salga mas corto, ni paso que alguien pueda cerrar, ni facciones que quieran lo
 * de al lado. Todo eso estaba escrito y no se veia nunca, que es la peor forma de que algo
 * no exista.
 *
 * Asi que al crear el mundo se le ponen dos o tres vecinos con sus caminos. Los nombres
 * salen del compendio —de la misma bateria que da nombre a las tabernas— y el bioma de
 * `mundo.json`, asi que anadir sitios distintos es escribir filas, no codigo.
 *
 * La forma del mapa importa: **no es una estrella**. Si todo colgara del sitio de partida,
 * ir de un vecino a otro seria siempre volver al centro, y `planTravel` no tendria nunca
 * un rodeo que proponer. Se cierra el corro con un camino largo entre los dos extremos:
 * asi hay dos maneras de llegar, una corta y otra larga, y cerrar un paso significa algo.
 *
 * Puro: recibe el compendio y el azar, y devuelve sitios. No guarda nada.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#88, #92) y wiki/ROADMAP_COMPENDIO.md, B11.
 */

import { makeName } from '../compendio/names.js';

/** Cuantos vecinos se le ponen a un mundo nuevo. Pocos: un mapa que se pueda tener en la cabeza. */
export const DEFAULT_NEIGHBOURS = 3;

/** Lo que cuesta el camino mas corto, en dias. */
const NEAR = 2;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Los biomas que la bateria del mundo conoce.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
function biomesOf(compendium) {
    if (!compendium?.has?.('mundo')) return [];
    return compendium.find('mundo', { kind: 'bioma' })
        .map((/** @type {any} */ row) => text(row.biome) || text(row.id))
        .filter(Boolean);
}

/**
 * Sitios vecinos para un mundo que solo tiene uno.
 *
 * Aditivo: sin la bateria de nombres devuelve una lista vacia y la campana sale como
 * salia. Y si el mundo ya tiene mas de un sitio no toca nada: alguien los puso a mano, y
 * eso manda sobre esto.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {any[]} input.locations Los sitios que ya hay.
 * @param {() => number} input.random
 * @param {number} [input.howMany]
 * @returns {any[]} Los sitios nuevos, ya con sus rutas.
 */
export function rollNeighbours({ compendium, locations, random, howMany = DEFAULT_NEIGHBOURS }) {
    const places = Array.isArray(locations) ? locations : [];
    if (places.length !== 1) return [];

    const home = places[0];
    const homeName = text(home?.name);
    if (!homeName) return [];

    const biomes = biomesOf(compendium);
    /** @type {string[]} */
    const taken = [homeName];
    /** @type {any[]} */
    const made = [];

    for (let i = 0; i < Math.max(0, howMany); i++) {
        const name = makeName({ compendium, kind: 'place', random, taken });
        // Sin bateria de nombres no hay vecinos: inventarlos aqui seria contenido en el
        // codigo, que es justo lo que el compendio viene a quitar.
        if (!name || taken.includes(name)) break;
        taken.push(name);

        made.push({
            name,
            description: '',
            url: '',
            gridWidth: Number(home?.gridWidth) || 20,
            gridHeight: Number(home?.gridHeight) || 15,
            biome: biomes.length > 0 ? biomes[Math.floor(random() * biomes.length) % biomes.length] : '',
            // Sin tablero: un sitio del mapa no es una pelea hasta que alguien la ponga.
            boards: [],
            routes: [],
        });
    }

    if (made.length === 0) return [];

    // En fila desde casa, cada uno un poco mas lejos que el anterior. Que la distancia
    // crezca es lo que hace que el ultimo sea un viaje y no un paseo.
    made[0].routes.push({ to: homeName, days: NEAR });
    for (let i = 1; i < made.length; i++) {
        made[i].routes.push({ to: made[i - 1].name, days: NEAR + i });
    }

    // Y el corro se cierra con el camino largo: dos formas de llegar, una corta y otra
    // larga, que es lo unico que hace que cerrar un paso sea una noticia.
    if (made.length >= 2) {
        const last = made[made.length - 1];
        last.routes.push({
            to: homeName,
            days: NEAR + made.length + 1,
            note: 'El camino largo, por fuera.',
        });
    }

    return made;
}

/**
 * El mundo entero con sus vecinos puestos, listo para guardar.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {any[]} input.locations
 * @param {() => number} input.random
 * @param {number} [input.howMany]
 * @returns {any[]}
 */
export function withNeighbours({ compendium, locations, random, howMany = DEFAULT_NEIGHBOURS }) {
    const places = Array.isArray(locations) ? locations : [];
    const made = rollNeighbours({ compendium, locations: places, random, howMany });
    if (made.length === 0) return places;

    // Los caminos se escriben una sola vez, en el vecino. `buildRouteMap` ya sabe que un
    // camino vale para los dos sentidos salvo que diga lo contrario, y escribirlos en los
    // dos lados seria la mejor forma de que un dia digan cosas distintas.
    return [places[0], ...made];
}
