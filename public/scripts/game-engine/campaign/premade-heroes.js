/**
 * Los héroes hechos de un mundo: entrar a jugar sin crear a nadie (R1, la partida rápida).
 *
 * Crear un personaje es lo primero que uno espera de un juego de rol, pero no siempre lo
 * que quiere hacer esta tarde. Un mundo precreado puede traer tres ya escritos, pensados
 * para él: con su raza y su clase de las que el mundo deja entrar, un pasado y dos líneas
 * de quién son. Se elige uno y se entra.
 *
 * Son **las mismas respuestas** que devuelve el creador de personaje, así que lo que pasa
 * después —su ficha, sus habilidades de clase, dónde empieza— es exactamente lo mismo.
 *
 * Puro: lee, comprueba y describe.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R1.
 */

import { BACKGROUNDS } from './backgrounds.js';

/** Cuántos se ofrecen como mucho: más que tres ya es un catálogo, no una elección. */
export const PREMADE_MAX = 3;

/**
 * @typedef {Object} PremadeHero
 * @property {string} name
 * @property {string} race El nombre de la raza, como la escribe el compendio.
 * @property {string} className Y el de la clase.
 * @property {string} gender
 * @property {string} background Un id de `BACKGROUNDS`, o vacío.
 * @property {string} about Quién es, para el narrador.
 * @property {string} pitch Una línea para elegirlo: lo que le hace distinto.
 * @property {{name: string, species: string, character: string}} [pet] T5: la mascota con la que llega.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function fold(value) {
    return text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Los héroes hechos de un mundo, comprobados.
 *
 * Uno con una raza o una clase que el mundo no deja entrar se descarta: ofrecer un elfo en
 * un mundo de humanos es ofrecer algo que el mundo dice que no existe. Un pasado que no se
 * conoce se queda en blanco, que es lo que haría el creador.
 *
 * @param {any} raw
 * @param {Object} [allowed]
 * @param {string[]} [allowed.races] Los nombres de raza que entran; vacío, todos.
 * @param {string[]} [allowed.classes] Y los de clase.
 * @returns {{heroes: PremadeHero[], dropped: string[]}}
 */
export function readPremadeHeroes(raw, { races = [], classes = [] } = {}) {
    const raceSet = new Set(races.map(fold).filter(Boolean));
    const classSet = new Set(classes.map(fold).filter(Boolean));
    /** @type {PremadeHero[]} */
    const heroes = [];
    /** @type {string[]} */
    const dropped = [];
    for (const row of Array.isArray(raw) ? raw : []) {
        const name = text(row?.name ?? row?.nombre);
        if (!name) continue;
        const race = text(row?.race ?? row?.raza);
        const className = text(row?.className ?? row?.clase);
        if (race && raceSet.size > 0 && !raceSet.has(fold(race))) {
            dropped.push(`${name}: la raza «${race}» no entra en este mundo.`);
            continue;
        }
        if (className && classSet.size > 0 && !classSet.has(fold(className))) {
            dropped.push(`${name}: la clase «${className}» no entra en este mundo.`);
            continue;
        }
        const background = text(row?.background ?? row?.pasado);
        // T5 de wiki/LO_QUE_FALTA.md: la mascota con la que llega, si el guion se la da.
        const petRaw = row?.pet ?? row?.mascota;
        const pet = petRaw && typeof petRaw === 'object' && text(petRaw.name ?? petRaw.nombre) && text(petRaw.species ?? petRaw.especie)
            ? { name: text(petRaw.name ?? petRaw.nombre), species: fold(petRaw.species ?? petRaw.especie), character: fold(petRaw.character ?? petRaw.caracter) || 'leal' }
            : null;
        heroes.push({
            ...(pet ? { pet } : {}),
            name,
            race,
            className,
            gender: text(row?.gender ?? row?.genero),
            background: Object.hasOwn(BACKGROUNDS, background) ? background : '',
            about: text(row?.about ?? row?.quien),
            pitch: text(row?.pitch ?? row?.gancho),
        });
        if (heroes.length >= PREMADE_MAX) break;
    }
    return { heroes, dropped };
}

/**
 * Cómo se enseña para elegirlo: «Maren · Humana, Pícara — Sabe qué barca no vuelve».
 *
 * @param {PremadeHero} hero
 * @returns {string}
 */
export function premadeLine(hero) {
    const what = [hero.race, hero.className].filter(Boolean).join(', ');
    return `${hero.name}${what ? ` · ${what}` : ''}${hero.pitch ? ` — ${hero.pitch}` : ''}`;
}

/**
 * Lo que el creador de personaje habría devuelto para este héroe.
 *
 * @param {PremadeHero} hero
 * @returns {{name: string, race: string, className: string, gender: string, background: string, about: string, image: string}}
 */
export function premadeAnswers(hero) {
    return {
        name: hero.name,
        race: hero.race,
        className: hero.className,
        gender: hero.gender,
        background: hero.background,
        about: hero.about,
        image: '',
    };
}
