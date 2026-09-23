/**
 * Gente que quiere algo.
 *
 * Un PNJ escrito a mano es un nombre, un oficio y una linea de sabor, y por eso todos los
 * pueblos del mundo se parecen: son fichas que esperan a que alguien les hable. Lo que
 * convierte a una ficha en una persona son **dos tiradas**: que quiere y que teme. De ahi
 * salen todas sus decisiones, y de ahi sale que haga cosas cuando no estas mirando.
 *
 * Las otras tres columnas hacen el resto del trabajo:
 *
 * - **El oficio es una mecanica**, no un adorno: el herrero repara, la barquera cruza, el
 *   escriba lee lo que nadie entiende. Preguntar por alguien deja de ser conversacion y
 *   pasa a ser una forma de resolver algo.
 * - **El secreto trae escrito que lo saca a la luz.** Un secreto sin salida no es una
 *   trama: es una nota que nadie va a leer nunca.
 * - **La voz** le da al narrador con que distinguirlos sin inventarse nada.
 *
 * Y el nombre sale de la bateria de nombres, si esta: una persona del norte se llama como
 * se llama la gente del norte. Sin ella, el nombre se queda vacio y quien llama pone el
 * suyo, que es la regla aditiva de siempre.
 *
 * Lo que sale tiene **exactamente** los campos de la ficha de persona del editor.
 *
 * Puro: recibe el compendio y el azar, y devuelve un borrador.
 *
 * Ver wiki/ALGORITMOS_GENERACION.md (#121-#134) y wiki/ROADMAP_COMPENDIO.md, B7.
 */

import { makeName } from './names.js';

/** Las seis, como las llama la ficha del grupo. */
export const ABILITIES = [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

/** Cuantos rasgos lleva alguien. Dos se leen; cuatro son un horoscopo. */
export const TRAITS = 2;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Coge rasgos que no se contradigan.
 *
 * «Terco y conciliador» no describe a nadie: describe a quien escribio la tabla sin
 * mirar. La fila dice con cuales se lleva mal, y eso se respeta aqui.
 *
 * @param {any} compendium
 * @param {() => number} random
 * @param {number} howMany
 * @returns {any[]}
 */
export function pickTraits(compendium, random, howMany = TRAITS) {
    /** @type {any[]} */
    const chosen = [];
    const banned = new Set();

    for (let guard = 0; guard < howMany * 6 && chosen.length < howMany; guard++) {
        const trait = compendium.pick('personas', { where: { kind: 'rasgo' }, random });
        if (!trait) break;
        if (banned.has(trait.id) || chosen.some(t => t.id === trait.id)) continue;

        // Y al reves tambien: si el ya elegido choca con este, este no entra.
        const clashes = chosen.some(t => (t.conflictsWith ?? []).some(
            (/** @type {string} */ c) => trait.id.endsWith(c),
        ));
        if (clashes) continue;

        for (const conflict of (trait.conflictsWith ?? [])) {
            for (const row of compendium.find('personas', { kind: 'rasgo' })) {
                if (row.id.endsWith(text(conflict))) banned.add(row.id);
            }
        }
        chosen.push(trait);
    }

    return chosen;
}

/**
 * Una persona entera.
 *
 * Devuelve null cuando la bateria no esta, y quien llama sigue con lo que hiciera antes.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {() => number} [input.random]
 * @param {string} [input.culture]      Para el nombre.
 * @param {string} [input.region]
 * @param {string} [input.locationName] Donde vive.
 * @param {{name: string, wants?: string, note?: string}|null} [input.banner] De quien
 *   es este sitio, si es de alguien.
 * @returns {any|null}
 */
export function writePerson({
    compendium, random = Math.random, culture = '', region = '', locationName = '',
    banner = null,
}) {
    if (!compendium?.has?.('personas')) return null;

    const job = compendium.pick('personas', { where: { kind: 'oficio' }, random });
    const traits = pickTraits(compendium, random);
    const want = compendium.pick('personas', { where: { kind: 'deseo' }, random });
    const fear = compendium.pick('personas', { where: { kind: 'miedo' }, random });
    const secret = compendium.pick('personas', { where: { kind: 'secreto' }, random });
    const voice = compendium.pick('personas', { where: { kind: 'voz' }, random });
    const arcana = compendium.pick('personas', { where: { kind: 'arcano' }, random });

    const name = makeName({ compendium, kind: 'person', culture, region, random });

    // Las seis en diez, y el oficio sube la suya: es lo que hace que el herrero sea
    // fuerte sin escribir una ficha por oficio.
    /** @type {Record<string, number>} */
    const abilities = {};
    for (const ability of ABILITIES) abilities[ability] = 10;
    if (job && ABILITIES.includes(text(job.stat))) abilities[text(job.stat)] = 13;

    // Lo unico de la ficha que lee el modelo son estas dos. Los numeros son del motor.
    // De quien es este sitio, si es de alguien. Es lo que le da a un vecino un motivo
    // que no es suyo: lo que quieren los que mandan aqui le pasa a el tambien.
    // «Es de La casa del Vado, los que quiere…» no lo dice nadie. El articulo del nombre
    // decide, y quien pone la bandera ya manda el verbo hecho.
    const flag = banner && text(banner.name)
        ? `Es de ${text(banner.name)}${text(banner.wants)
            ? `, ${/^(los|las)\b/i.test(text(banner.name)) ? 'los que' : 'que'} ${text(banner.wants)}`
            : ''}.`
            + (text(banner.note) ? ` ${text(banner.note)}` : '')
        : '';

    const backstory = [
        job ? `${capitalise(text(job.name))} de ${locationName || 'aquí'}: ${text(job.does)}` : '',
        flag,
        want ? `Quiere ${text(want.name)}. ${text(want.note)}` : '',
        // En indicativo: «saldria si aparezca» no lo escribe nadie.
        secret ? `Esconde que ${text(secret.name)}. Sale a la luz si ${text(secret.outIf)}.` : '',
    ].filter(Boolean).join(' ');

    // El genero sale del oficio, que es de donde sale como la llama la gente: «es
    // agarrado» para una cazadora delata que detras hay una maquina.
    const feminine = text(job?.gender) === 'f';
    const said = (/** @type {any} */ trait) => text(feminine ? (trait.namef ?? trait.name) : trait.name);

    const personality = [
        traits.length > 0 ? `Es ${traits.map(said).join(' y ')}.` : '',
        ...traits.map(t => text(t.note)),
        fear ? `Teme ${text(fear.name)}. ${text(fear.note)}` : '',
        voice ? `Al hablar: ${text(voice.name)}.` : '',
    ].filter(Boolean).join(' ');

    return {
        name,
        title: text(job?.title),
        className: '',
        race: '',
        level: 1,
        abilities,
        maxHp: 10,
        armorClass: 10,
        speed: 30,
        locationName: text(locationName),
        // El campo que la ficha ya tenia, ahora con una faccion que existe de verdad.
        factions: banner && text(banner.name) ? [text(banner.name)] : [],
        backstory,
        personality,
        arcana: text(arcana?.name),
        initialBondPoints: 0,
        image: '',
        // Lo que lo despierta en el Lorebook: su nombre y como lo llama la gente.
        keys: [name, text(job?.title)].filter(Boolean),
        from: {
            oficio: text(job?.id),
            rasgos: traits.map(t => text(t.id)),
            deseo: text(want?.id),
            miedo: text(fear?.id),
            secreto: text(secret?.id),
            voz: text(voice?.id),
            arcano: text(arcana?.id),
            bandera: banner && text(banner.name) ? text(banner.name) : '',
        },
    };
}

/**
 * @param {string} value
 * @returns {string}
 */
function capitalise(value) {
    const clean = text(value);
    return clean ? clean[0].toUpperCase() + clean.slice(1) : '';
}

/**
 * Un pueblo: varias personas que no se pisan.
 *
 * Dos herreros en la misma aldea se leen como un error. Lo que no se repite es el oficio,
 * que es lo que la gente usa para referirse a alguien.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {number} input.howMany
 * @param {() => number} [input.random]
 * @param {string} [input.culture]
 * @param {string} [input.locationName]
 * @param {{name: string, wants?: string, note?: string}|null} [input.banner] De quien es el
 *   sitio: la llevan todos los que viven en el.
 * @returns {any[]}
 */
export function writeVillage({
    compendium, howMany, random = Math.random, culture = '', locationName = '', banner = null,
}) {
    /** @type {any[]} */
    const out = [];
    const jobs = new Set();
    const names = new Set();
    const wants = new Set();
    const fears = new Set();

    for (let i = 0; i < Math.max(0, howMany) * 8 && out.length < howMany; i++) {
        // La bandera es del sitio, asi que la llevan todos los que viven en el.
        const person = writePerson({ compendium, random, culture, locationName, banner });
        if (!person) break;

        // Tres vecinos que quieren lo mismo y temen lo mismo no son tres vecinos: son el
        // mismo escrito tres veces. Lo que no se repite es lo que mueve a cada uno.
        if (jobs.has(person.from.oficio)) continue;
        if (person.from.deseo && wants.has(person.from.deseo)) continue;
        if (person.from.miedo && fears.has(person.from.miedo)) continue;
        if (person.name && names.has(person.name)) continue;

        jobs.add(person.from.oficio);
        wants.add(person.from.deseo);
        fears.add(person.from.miedo);
        if (person.name) names.add(person.name);
        out.push(person);
    }

    return out;
}

/**
 * La persona en una linea, para el aviso de despues.
 *
 * @param {any} person
 * @returns {string}
 */
export function describePerson(person) {
    if (!person) return '';
    return [
        text(person.name) || '(sin nombre)',
        text(person.title),
        // De quien es, si es de alguien: en un mundo con facciones es la mitad de quien es.
        (Array.isArray(person?.factions) ? person.factions : []).map(text).filter(Boolean)[0] ?? '',
        text(person.arcana),
    ].filter(Boolean).join(' · ');
}
