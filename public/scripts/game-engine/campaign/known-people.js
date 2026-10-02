/**
 * Solo sabes el nombre de quien se ha presentado (J13.7 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Al bajar de la barca en Puerto Alba, el posadero gritaba «¡Al ladrón!», su placa ya decía
 * «Tomás» y tú le contestabas «Quédate atrás, Tomás» sin que nadie te hubiera dicho cómo se
 * llama. Ahora la partida recuerda a quién conoces, y cómo:
 *
 * - **se presentó** (`presentado`): dijo su nombre en una línea («Soy Tomás, el de la posada»);
 * - **te lo dijeron** (`nombrado`): otra persona lo nombró en algo que oíste («¡Brunilda! Mira…»);
 * - **lo cuenta la historia** (`contado`): el narrador, que habla desde tus ojos, lo nombró («El
 *   alguacil Torres entra con dos guardias»). Si eso no debería saberse, la línea se reescribe;
 *   `checkIntroductions` lo avisa;
 * - **por escrito** (`escrito`): una nota, un cartel, un encargo del tablón;
 * - **hablasteis** (`charla`): después de la primera charla de verdad.
 *
 * Mientras no, se le llama por lo que es, con su artículo y su género: «el posadero», «la
 * maestra del gremio», «una cazadora»; en la placa, «Posadero». Sale de su oficio (`trade`) o,
 * si el paquete lo escribe, de `stranger` («una cazadora»).
 *
 * El paquete también lo puede decir a mano: `presenta` en una línea (quién se da a conocer
 * ahí; `true` es quien la dice), y `{npc:tomas}` en un texto, que sale como su nombre si ya lo
 * sabes y como «el posadero» si no (`{npc:tomas:un}`, «un posadero»; `{npc:tomas:placa}`,
 * «Posadero»). Detrás de «a» y «de» se contrae: «al posadero», «del posadero».
 *
 * Solo se esconde a la gente del mundo (`npcs` y `confidants`). Tu grupo, los bichos y quien no
 * tiene ficha salen siempre con su nombre; y quien se llama por lo que es («El ermitaño de la
 * cascada»), también.
 *
 * Puro: de lo sabido y de la gente del mundo, a nombres y textos. Quien llama lo guarda.
 */

import { genderOf, GENDER } from './grammar.js';

/** Cómo se llegó a saber el nombre de alguien, dicho para quien juega. */
export const MET = {
    presentado: 'Se presentó',
    nombrado: 'Te dijeron cómo se llama',
    contado: 'Lo supiste',
    escrito: 'Lo leíste',
    charla: 'Hablasteis',
};

/**
 * @typedef {Object} Person Alguien del mundo, como lo trae el paquete o el lorebook.
 * @property {string} name
 * @property {string} [id] El del paquete (`tomas`), si lo tiene.
 * @property {string} [trade] Su oficio: «Posadero». En un compañero, su clase.
 * @property {string} [gender] `Mujer` u `Hombre` (o `f`, `m`), si se sabe.
 * @property {string} [stranger] Cómo se le llama sin conocerle, con su artículo: «una cazadora».
 * @property {boolean} [famous] Su nombre lo sabe todo el mundo (el señor del valle): se ve siempre.
 * @property {boolean} [fromClass] Si `trade` es su clase (un confidente): «Picaro» no dice si es mujer.
 */

/**
 * @typedef {Object} Acquaintance
 * @property {string} how Una clave de `MET`.
 * @property {number} day
 * @property {string} by Quién lo nombró, si fue otro.
 */

/**
 * @typedef {Object} KnownPeople Lo que la partida guarda (`knownPeople`).
 * @property {boolean} all Una partida de antes de J13.7: se conoce a todos (no se le quita nada).
 * @property {Record<string, Acquaintance>} people Por el nombre sin tildes ni mayúsculas.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** @param {string} value @returns {string} */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @param {string} value @returns {string} */
const capital = (value) => (value ? value.charAt(0).toLocaleUpperCase('es') + value.slice(1) : value);

/**
 * Si lo que va detrás empieza frase: al principio, tras un punto o una apertura, y también tras
 * una cita que acaba en punto («…encargo.» El posadero).
 *
 * @param {string} before Lo de antes, sin espacios al final.
 * @returns {boolean}
 */
const startsSentence = (before) => !before || /(?:[.!?…¡¿«"“:—\n]|[.!?…]["»”])$/.test(before);

/**
 * La primera letra en minúscula, salvo que sea una sigla («IA»).
 *
 * @param {string} value
 * @returns {string}
 */
const lowerFirst = (value) => (value && !/^\p{Lu}{2}/u.test(value) ? value.charAt(0).toLocaleLowerCase('es') + value.slice(1) : value);

/** Lo que va delante de un nombre y no es el nombre: «Madre Elvira» es Elvira. */
const HONORIFICS = new Set([
    'madre', 'padre', 'hermano', 'hermana', 'lord', 'lady', 'sir', 'maese', 'don', 'dona', 'baron', 'baronesa', 'madam',
    'madame', 'fray', 'sor', 'capitan', 'capitana', 'senor', 'senora', 'el', 'la', 'doctor', 'doctora', 'tio', 'tia',
]);

/** Lo que une un nombre con su mote: «Oswald el Senescal», «María la Loca», «Karl el Sordo». */
const LINKS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'y']);

/** Palabras de oficio que no dicen el género: «el guardia» y «la guardia», «el líder» y «la líder». */
const COMMON = new Set([
    'guardia', 'guia', 'espia', 'vigia', 'centinela', 'poeta', 'profeta', 'druida', 'pirata', 'atleta', 'colega', 'camarada',
    'homicida', 'lider', 'comandante', 'lugarteniente', 'joven', 'noble', 'testigo', 'comerciante', 'estudiante', 'aprendiz',
    'fantasma', 'agente', 'cliente', 'amante', 'caminante', 'viajante', 'representante', 'conserje', 'contrabandista',
    'artista', 'herbolaria', 'recluta', 'cuidante', 'huesped', 'forastero', 'forastera',
]);

/** Oficios y tratos que son de hombre aunque no acaben en -o. */
const MASC = new Set([
    'hombre', 'padre', 'jefe', 'alcalde', 'conde', 'duque', 'principe', 'sacerdote', 'fraile', 'monje', 'abad', 'rey', 'baron',
    'senor', 'don', 'sir', 'lord', 'maese', 'hermano', 'heroe', 'burgomaestre', 'alguacil', 'senescal', 'juez', 'capitan',
    'chaval', 'mozo', 'tio', 'abuelo', 'hijo', 'ermitano', 'guardian', 'cura', 'papa', 'patriarca', 'monarca', 'el',
]);

/** Oficios y tratos que son de mujer. */
const FEM = new Set([
    'mujer', 'madre', 'jefa', 'alcaldesa', 'condesa', 'duquesa', 'princesa', 'sacerdotisa', 'monja', 'abadesa', 'reina',
    'baronesa', 'senora', 'dona', 'lady', 'madam', 'madame', 'hermana', 'heroina', 'jueza', 'capitana', 'tia', 'abuela', 'hija',
    'dama', 'sor', 'la',
]);

/** Las que empiezan por «a» tónica y llevan «el» aunque sean de mujer: «el ama de llaves». */
const STRESSED_A = new Set(['ama', 'aya', 'hada', 'aguila', 'alma']);

// ---------------------------------------------------------------------------------------------
// La gente del mundo
// ---------------------------------------------------------------------------------------------

/** Las listas ya leídas, para no leerlas en cada nombre que se dibuja. */
const readLists = new WeakMap();

/**
 * La gente, en limpio: de una lista de nombres o de fichas (del paquete, del lorebook o de
 * `lastWorldNpcs`). Un compañero trae su clase donde la gente trae su oficio.
 *
 * @param {any} list
 * @returns {Person[]}
 */
export function peopleOf(list) {
    if (!Array.isArray(list)) return [];
    const cached = readLists.get(list);
    if (cached) return cached;
    /** @type {Person[]} */
    const people = [];
    for (const raw of list) {
        const person = typeof raw === 'string' ? { name: text(raw) }
            : isObject(raw) ? {
                name: text(raw.name),
                id: text(raw.id),
                trade: text(raw.trade || raw.title || raw.className || raw.charClass),
                gender: text(raw.gender),
                stranger: text(raw.stranger),
                famous: raw.famous === true,
                fromClass: raw.fromClass === true || (!text(raw.trade || raw.title) && Boolean(text(raw.className || raw.charClass))),
            } : null;
        if (person?.name) people.push(person);
    }
    readLists.set(list, people);
    return people;
}

/**
 * Si un nombre es una descripción y no un nombre: «El ermitaño de la cascada». Esa gente se
 * llama por lo que es desde el principio: no tiene nada que esconder.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isDescriptiveName(name) {
    const words = text(name).replace(/[«»"“”]/g, '').split(/\s+/).filter(Boolean);
    const article = words.length > 1 && (fold(words[0]) === 'el' || fold(words[0]) === 'la');
    const rest = article ? words.slice(1) : words;
    // «El Abad»: con artículo y un trato solo, es lo que es, no cómo se llama.
    if (article && rest.length === 1 && (MASC.has(fold(rest[0])) || FEM.has(fold(rest[0])))) return true;
    return rest.length > 0 && !rest.some(word => /^\p{Lu}/u.test(word));
}

/**
 * Cómo se puede nombrar a alguien en un texto: entero, sin el trato («Elvira» de «Madre
 * Elvira»), su nombre de pila y su apellido. «Oswald el Senescal» es también «Oswald».
 *
 * @param {string} name
 * @returns {string[]}
 */
export function nameVariants(name) {
    const full = text(name).replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
    if (!full) return [];
    let words = full.split(' ');
    while (words.length > 1 && HONORIFICS.has(fold(words[0]))) words = words.slice(1);
    const cut = words.findIndex((word, i) => i > 0 && LINKS.has(fold(word)));
    const given = cut > 0 ? words.slice(0, cut) : words;
    const proper = (/** @type {string} */ word) => /^\p{Lu}/u.test(word) && fold(word).length >= 3;
    const out = [full];
    if (words.join(' ') !== full && words.some(proper)) out.push(words.join(' '));
    if (given.length > 0 && proper(given[0])) out.push(given[0]);
    if (given.length > 1 && proper(given[given.length - 1])) out.push(given[given.length - 1]);
    return [...new Set(out)];
}

/** Las formas de cada nombre que solo son de una persona, por lista. */
const variantTables = new WeakMap();

/**
 * Cada forma de nombrar a alguien, con de quién es. Un apellido que comparten dos (los dos
 * Martikov) no nombra a ninguno: solo el nombre entero.
 *
 * @param {any} list
 * @returns {Array<{variant: string, person: Person}>}
 */
function variantTable(list) {
    const people = peopleOf(list);
    const cached = variantTables.get(people);
    if (cached) return cached;
    /** @type {Map<string, Person[]>} */
    const owners = new Map();
    for (const person of people) {
        if (isDescriptiveName(person.name)) continue;
        for (const variant of nameVariants(person.name)) {
            const key = fold(variant);
            owners.set(key, [...(owners.get(key) ?? []), person]);
        }
    }
    /** @type {Array<{variant: string, person: Person}>} */
    const table = [];
    for (const person of people) {
        if (isDescriptiveName(person.name)) continue;
        for (const variant of nameVariants(person.name)) {
            const mine = owners.get(fold(variant)) ?? [];
            if (mine.length === 1 || fold(variant) === fold(person.name)) table.push({ variant, person });
        }
    }
    // Lo más largo antes: «Lord Edmund Vane» antes que «Vane».
    table.sort((a, b) => b.variant.length - a.variant.length);
    variantTables.set(people, table);
    return table;
}

/**
 * Las formas de nombrar que valen en un texto con sitios y facciones: un apellido que también es
 * de un sitio o de una casa («Keller» de la Casa Keller, «Vane» del Castillo de Vane) no nombra
 * a la persona; su nombre entero sí.
 *
 * @param {any} list
 * @param {string[]} skip
 * @returns {Array<{variant: string, person: Person}>}
 */
function textTable(list, skip) {
    const places = Array.isArray(skip) ? skip : [];
    if (places.length === 0) return variantTable(list);
    const people = peopleOf(list);
    const key = places.join('|');
    const cached = textTables.get(people);
    if (cached?.key === key) return cached.table;
    const words = new Set(places.flatMap(name => text(name).split(/[\s,.;:()«»"']+/)).map(fold).filter(w => w.length >= 3));
    const table = variantTable(list).filter(row => fold(row.variant) === fold(row.person.name) || !words.has(fold(row.variant)));
    textTables.set(people, { key, table });
    return table;
}

/** La última tabla de `textTable` de cada lista, con los sitios con que se hizo. */
const textTables = new WeakMap();

/**
 * Quién es alguien de la gente del mundo, por su nombre, su id o una forma de su nombre que
 * solo es suya («Elvira»). Null si no es de la gente.
 *
 * @param {any} ref Un nombre, un id o una ficha.
 * @param {any} list
 * @returns {Person|null}
 */
export function findPerson(ref, list) {
    const want = fold(isObject(ref) ? ref.name : ref);
    if (!want) return null;
    const people = peopleOf(list);
    // Un id sin ficha que lo diga es el nombre con guiones: `ireena-kolyana`.
    const spaced = want.replace(/-/g, ' ');
    return people.find(p => fold(p.name) === want)
        ?? people.find(p => p.id && fold(p.id) === want)
        ?? people.find(p => fold(p.name) === spaced)
        ?? variantTable(list).find(row => fold(row.variant) === want)?.person
        ?? null;
}

// ---------------------------------------------------------------------------------------------
// Lo que se sabe
// ---------------------------------------------------------------------------------------------

/**
 * Lo guardado, en limpio. Sin nada guardado, no se conoce a nadie; pero una partida de antes
 * de esto (`legacy`: ya con escenas jugadas) conoce a todos: no se le esconde a quien ya trató.
 *
 * @param {any} raw
 * @param {{legacy?: boolean}} [input]
 * @returns {KnownPeople}
 */
export function readKnownPeople(raw, { legacy = false } = {}) {
    if (!isObject(raw)) return { all: Boolean(legacy), people: {} };
    /** @type {Record<string, Acquaintance>} */
    const people = {};
    for (const [key, value] of Object.entries(isObject(raw.people) ? raw.people : {})) {
        const at = fold(key);
        if (!at) continue;
        const how = text(value?.how);
        people[at] = { how: how in MET ? how : 'contado', day: whole(value?.day), by: text(value?.by) };
    }
    return { all: Boolean(raw.all), people };
}

/**
 * @typedef {Object} NameInput
 * @property {any} [state] Lo sabido (`knownPeople`), leído o no.
 * @property {any[]} [people] La gente del mundo.
 * @property {string[]} [always] Los que se conocen siempre: tu grupo.
 */

/**
 * Si se sabe el nombre de alguien. Quien no es de la gente del mundo sale siempre con su
 * nombre: tu grupo, un bicho o alguien sin ficha.
 *
 * @param {any} ref
 * @param {NameInput} [input]
 * @returns {boolean}
 */
export function knowsName(ref, { state = null, people = [], always = [] } = {}) {
    const person = findPerson(ref, people);
    if (!person || person.famous || isDescriptiveName(person.name)) return true;
    if ((Array.isArray(always) ? always : []).some(name => fold(name) === fold(person.name))) return true;
    const known = readKnownPeople(state);
    return known.all || Boolean(known.people[fold(person.name)]);
}

/**
 * Apuntar que ya se sabe el nombre de alguien. Si ya se sabía, queda como estaba (la primera
 * vez es la que cuenta).
 *
 * @param {any} state
 * @param {any} ref
 * @param {string} how Una clave de `MET`.
 * @param {{day?: number, by?: string, people?: any[]}} [input]
 * @returns {KnownPeople}
 */
export function meetPerson(state, ref, how, { day = 0, by = '', people = [] } = {}) {
    const known = readKnownPeople(state);
    const person = findPerson(ref, people);
    const key = fold(person?.name ?? (isObject(ref) ? ref.name : ref));
    if (!key || known.all || known.people[key]) return known;
    const said = text(how);
    return { ...known, people: { ...known.people, [key]: { how: said in MET ? said : 'contado', day: whole(day), by: text(by) } } };
}

// ---------------------------------------------------------------------------------------------
// Cómo se le llama
// ---------------------------------------------------------------------------------------------

/**
 * El género de un oficio: «Maestra del gremio» es de mujer, «Herrero» de hombre, «Guardia» no
 * lo dice. Se mira lo que va antes de «de».
 *
 * @param {string} trade
 * @returns {string} `f`, `m` o vacío.
 */
export function tradeGender(trade) {
    const words = fold(text(trade).replace(/\([^)]*\)/g, ' ')).split(/[\s,;/]+/).filter(Boolean);
    for (const raw of words) {
        if (['de', 'del', 'que', 'con', 'en', 'para', 'sin'].includes(raw)) break;
        const word = raw.replace(/^ex-/, '');
        if (!word || ['y', 'e', 'o', 'ex'].includes(word) || COMMON.has(word)) continue;
        if (FEM.has(word)) return GENDER.F;
        if (MASC.has(word)) return GENDER.M;
        if (/(o|os|or|ores|on|an|in|es|al)$/.test(word)) return GENDER.M;
        if (/a$/.test(word)) return GENDER.F;
    }
    return '';
}

/**
 * El género de alguien por su nombre, cuando su oficio no lo dice: el trato («Madre», «Sir»)
 * o un nombre de pila en -a («Elara»).
 *
 * @param {string} name
 * @returns {string}
 */
function nameGender(name) {
    const words = text(name).replace(/[«»"“”]/g, '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const first = fold(words[0]);
    if (FEM.has(first)) return GENDER.F;
    if (MASC.has(first)) return GENDER.M;
    let rest = words;
    while (rest.length > 1 && HONORIFICS.has(fold(rest[0]))) rest = rest.slice(1);
    return /a$/.test(fold(rest[0])) ? GENDER.F : '';
}

/**
 * El género de alguien de la gente: el escrito, el de su oficio o el de su nombre. Sin saberlo,
 * vacío (y el texto sale en masculino, como el resto del motor).
 *
 * @param {any} ref Una ficha.
 * @returns {string}
 */
export function personGender(ref) {
    const person = peopleOf([ref])[0];
    if (!person) return '';
    const said = genderOf(person.gender);
    if (said === GENDER.F || said === GENDER.M) return said;
    // Una clase se escribe en masculino («Picaro»): de un confidente manda su nombre (Isolda).
    if (person.fromClass && !person.stranger) return nameGender(person.name) || tradeGender(person.trade);
    return tradeGender(person.stranger || person.trade) || nameGender(person.name);
}

/**
 * Una clase dicha como se dice de una persona: con su tilde («Picaro» es «pícaro») y, de una
 * mujer, en femenino («exploradora», «pícara»). Lo que ya es de las dos (`Druida`) o ya está en
 * femenino (`guerrera`) se queda.
 *
 * @param {string} noun
 * @param {boolean} female
 * @returns {string}
 */
function classNoun(noun, female) {
    const [first, ...rest] = noun.split(/\s+/);
    const key = fold(first);
    const accented = { picaro: 'pícaro', clerigo: 'clérigo', barbaro: 'bárbaro', paladin: 'paladín' };
    const male = accented[/** @type {keyof typeof accented} */ (key)] ?? first;
    let word = male;
    if (female && !COMMON.has(key)) {
        if (key === 'paladin') word = 'paladina';
        else if (/or$/.test(key)) word = `${male}a`;
        else if (/o$/.test(key)) word = `${male.slice(0, -1)}a`;
    }
    // La mayúscula, como venía.
    if (/^\p{Lu}/u.test(first)) word = capital(word);
    return [word, ...rest].join(' ');
}

/**
 * Cómo se llama a alguien que no se ha presentado.
 *
 * - `el`: con su artículo, dentro de una frase: «el posadero», «la maestra del gremio».
 * - `un`: sin conocerle de nada: «un posadero», «una tendera».
 * - `placa`: para la placa de quien habla: «Posadero».
 *
 * Con `stranger`, lo que diga el paquete («una cazadora»), tal cual.
 *
 * @param {any} ref Una ficha.
 * @param {'el'|'un'|'placa'} [form]
 * @returns {string}
 */
export function roleOf(ref, form = 'el') {
    const person = peopleOf([ref])[0];
    if (!person) return '';
    const female = personGender(person) === GENDER.F;
    if (person.stranger) {
        const said = lowerFirst(person.stranger);
        return form === 'placa' ? capital(said.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')) : said;
    }
    const written = text(person.trade.replace(/\([^)]*\)/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1');
    const trade = person.fromClass ? classNoun(written, female) : written;
    if (!trade) {
        if (form === 'placa') return female ? 'Desconocida' : 'Desconocido';
        return form === 'un' ? (female ? 'una desconocida' : 'un desconocido') : (female ? 'la desconocida' : 'el desconocido');
    }
    if (form === 'placa') return capital(trade);
    const noun = lowerFirst(trade);
    const elided = female && STRESSED_A.has(fold(noun.split(/\s+/)[0]));
    const article = form === 'un' ? (female && !elided ? 'una' : 'un') : (female && !elided ? 'la' : 'el');
    return `${article} ${noun}`;
}

/**
 * Cómo sale alguien ahora: su nombre si se sabe; si no, lo que es. Quien no es de la gente del
 * mundo, con su nombre.
 *
 * @param {any} ref
 * @param {NameInput & {form?: 'el'|'El'|'un'|'placa'}} [input] `El`: al empezar una frase.
 * @returns {string}
 */
export function nameFor(ref, { state = null, people = [], always = [], form = 'placa' } = {}) {
    const person = findPerson(ref, people);
    const plain = text(isObject(ref) ? ref.name : ref);
    if (!person) return plain;
    if (knowsName(person.name, { state, people, always })) return person.name;
    const role = roleOf(person, form === 'El' ? 'el' : form);
    return form === 'El' ? capital(role) : role;
}

/**
 * La línea con la que alguien se presenta la primera vez que se habla con él, si su charla no
 * trae la suya: «Soy Ramiro, el herrero.»
 *
 * @param {any} ref
 * @param {any[]} [people]
 * @returns {string}
 */
export function introLine(ref, people = []) {
    const person = findPerson(ref, people) ?? peopleOf([ref])[0] ?? null;
    if (!person) return '';
    if (!person.trade && !person.stranger) return `Me llamo ${person.name}.`;
    // Dos maneras, siempre la misma para la misma persona: que no suenen todos igual.
    let hash = 0;
    for (const char of fold(person.name)) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
    return hash % 2 === 0 ? `Soy ${person.name}, ${roleOf(person, 'el')}.` : `Me llamo ${person.name}. Soy ${roleOf(person, 'el')}.`;
}

// ---------------------------------------------------------------------------------------------
// Los nombres en un texto
// ---------------------------------------------------------------------------------------------

/**
 * Los trozos entre comillas de un texto: lo que dice alguien dentro de lo que cuenta el narrador.
 *
 * @param {string} said
 * @returns {Array<[number, number]>}
 */
function quoteSpans(said) {
    /** @type {Array<[number, number]>} */
    const spans = [];
    for (const [open, close] of [['«', '»'], ['“', '”'], ['"', '"']]) {
        let from = 0;
        for (;;) {
            const start = said.indexOf(open, from);
            if (start < 0) break;
            const end = said.indexOf(close, start + 1);
            if (end < 0) break;
            spans.push([start, end]);
            from = end + 1;
        }
    }
    return spans;
}

/**
 * @typedef {Object} NameHit
 * @property {Person} person
 * @property {boolean} quoted Si sale dentro de unas comillas (lo dice alguien).
 * @property {boolean} plain Si sale fuera (lo cuenta el narrador).
 */

/**
 * A quién nombra un texto. Los nombres de los sitios no cuentan: «el castillo de Vane» es un
 * sitio, no Lord Vane presentándose.
 *
 * @param {any} said
 * @param {any[]} people
 * @param {{skip?: string[]}} [input] Los nombres de sitios (y de lo que no sea gente) que hay que saltar.
 * @returns {NameHit[]}
 */
export function namesIn(said, people, { skip = [] } = {}) {
    let body = text(said);
    if (!body) return [];
    // Los huecos de persona no son nombres escritos: se quitan antes de mirar.
    body = body.replace(/\{(?:npc|persona):[^{}]*\}/g, ' ');
    // Sin mirar mayúsculas y sin su artículo: «la Casa Keller» es «La Casa Keller».
    const skipped = [...new Set((Array.isArray(skip) ? skip : []).map(text).filter(Boolean)
        .flatMap(name => [name, name.replace(/^(el|la|los|las)\s+/i, '')]))].filter(name => name.length >= 3);
    for (const place of skipped.sort((a, b) => b.length - a.length)) {
        body = body.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(place)}(?![\\p{L}\\p{N}])`, 'giu'), m => ' '.repeat(m.length));
    }
    const quotes = quoteSpans(body);
    /** @type {Map<string, NameHit>} */
    const found = new Map();
    // Lo que ya es de un nombre más largo no se vuelve a leer como uno corto.
    const taken = new Array(body.length).fill(false);
    for (const { variant, person } of textTable(people, skip)) {
        const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(variant)}(?![\\p{L}\\p{N}])`, 'gu');
        for (const match of body.matchAll(pattern)) {
            const at = match.index ?? 0;
            if (taken[at]) continue;
            for (let i = at; i < at + variant.length; i++) taken[i] = true;
            const quoted = quotes.some(([a, b]) => at > a && at < b);
            const hit = found.get(person.name) ?? { person, quoted: false, plain: false };
            if (quoted) hit.quoted = true;
            else hit.plain = true;
            found.set(person.name, hit);
        }
    }
    return [...found.values()];
}

/**
 * @param {any} value
 * @returns {string[]}
 */
function presentsOf(value) {
    if (value === true) return ['\u0000'];
    return (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);
}

/**
 * @typedef {Object} HeardLine Una línea que se ha leído en pantalla.
 * @property {string} [who] Quién la dice; vacío, el narrador.
 * @property {string} [text]
 * @property {string|string[]|boolean} [presenta] Quién se da a conocer en ella (`true`: quien la dice).
 * @property {boolean} [quotes] Del narrador, solo cuenta lo que dice alguien entre comillas: lo que
 *   escribe el motor («Tomás te sirve») no enseña nombres, y un «Soy Tomás» citado, sí.
 */

/**
 * Lo que se aprende de una línea: quien la dice y dice su nombre, se presenta; a quien nombra
 * otro, te lo han dicho; lo que cuenta el narrador (tus ojos), también se sabe; y `presenta`,
 * lo que diga. Lo que dices tú no enseña nada: no se le pasa aquí.
 *
 * @param {any} state
 * @param {HeardLine} line
 * @param {NameInput & {day?: number, skip?: string[]}} [input]
 * @returns {{state: KnownPeople, learned: Array<{name: string, how: string}>}}
 */
export function learnFromLine(state, line, { people = [], always = [], day = 0, skip = [] } = {}) {
    let known = readKnownPeople(state);
    /** @type {Array<{name: string, how: string}>} */
    const learned = [];
    const who = text(line?.who);
    const speaker = who ? findPerson(who, people) : null;
    const learn = (/** @type {string} */ ref, /** @type {string} */ how, /** @type {string} */ by) => {
        const person = findPerson(ref, people);
        if (!person || knowsName(person.name, { state: known, people, always })) return;
        known = meetPerson(known, person.name, how, { day, by, people });
        learned.push({ name: person.name, how });
    };
    for (const ref of presentsOf(line?.presenta)) learn(ref === '\u0000' ? who : ref, 'presentado', '');
    for (const hit of namesIn(line?.text, people, { skip })) {
        const self = Boolean(speaker) && speaker?.name === hit.person.name;
        if (who) learn(hit.person.name, self ? 'presentado' : 'nombrado', self ? '' : who);
        else if (hit.quoted || (hit.plain && !line?.quotes)) learn(hit.person.name, hit.quoted ? 'nombrado' : 'contado', '');
    }
    return { state: known, learned };
}

/** Un hueco de persona, con «a» o «de» delante si los lleva: `de {npc:tomas}`. */
const TOKEN = /(?:(?<![\p{L}\p{N}])(a|de|A|De)(\s+))?\{(?:npc|persona):([^{}|:]+?)(?::(el|un|placa|nombre))?\}/gu;

/**
 * Cambiar cada `{npc:…}` por su nombre, si se sabe, o por lo que es: «el posadero». Detrás de
 * «a» y «de» se contrae («al posadero»), y al empezar una frase va en mayúscula.
 *
 * @param {any} said
 * @param {NameInput} [input]
 * @returns {string}
 */
export function resolvePeopleTokens(said, { state = null, people = [], always = [] } = {}) {
    const source = String(said ?? '');
    if (!source.includes('{npc:') && !source.includes('{persona:')) return source;
    return source.replace(TOKEN, (all, prep, space, ref, form, offset) => {
        const person = findPerson(ref, people);
        let out = !person ? text(ref)
            : form === 'nombre' || knowsName(person.name, { state, people, always }) ? person.name
                : roleOf(person, form === 'un' ? 'un' : form === 'placa' ? 'placa' : 'el');
        if (prep) {
            const contracted = /^el\s/.test(out);
            if (contracted) out = out.slice(3);
            const joined = contracted ? (fold(prep) === 'a' ? 'al' : 'del') : prep;
            const cased = /^\p{Lu}/u.test(prep) ? capital(joined) : joined;
            return `${cased}${space}${out}`;
        }
        const before = source.slice(0, Number(offset)).replace(/\s+$/, '');
        return startsSentence(before) ? capital(out) : out;
    });
}

/**
 * Lo mismo por dentro de un objeto (el hilo, el libro): una copia con cada texto resuelto. Lo
 * que va en `skipKeys` se deja como está (las `beats` de un hito se resuelven al leerse, línea
 * a línea, porque alguien se puede presentar a mitad de escena).
 *
 * @template T
 * @param {T} value
 * @param {NameInput} [input]
 * @param {string[]} [skipKeys]
 * @returns {T}
 */
export function resolvePeopleTokensDeep(value, input = {}, skipKeys = []) {
    if (typeof value === 'string') return /** @type {any} */ (resolvePeopleTokens(value, input));
    if (Array.isArray(value)) return /** @type {any} */ (value.map(item => resolvePeopleTokensDeep(item, input, skipKeys)));
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return /** @type {any} */ (Object.fromEntries(Object.entries(value)
            .map(([key, item]) => [key, skipKeys.includes(key) ? item : resolvePeopleTokensDeep(item, input, skipKeys)])));
    }
    return value;
}

/**
 * Un texto escrito por el motor (un saludo, una nota del chat, una línea del Diario) con cada
 * nombre que todavía no se sabe cambiado por lo que es: «Tomás te sirve» sale «El posadero te
 * sirve». Lo que nombra a un sitio («la Casa Keller») no se toca.
 *
 * Es la red para lo que no se escribió pensando en esto: lo escrito en el paquete ya lo mira
 * `checkIntroductions`, y una escena enseña el nombre en cuanto se dice.
 *
 * @param {any} said
 * @param {NameInput & {skip?: string[]}} [input]
 * @returns {string}
 */
export function maskNames(said, { state = null, people = [], always = [], skip = [] } = {}) {
    const source = String(said ?? '');
    if (!source.trim()) return source;
    // Lo normal es que el texto no nombre a nadie: se mira antes de montar nada.
    const hidden = textTable(people, skip).filter(row => source.includes(row.variant) && !knowsName(row.person.name, { state, people, always }));
    if (hidden.length === 0) return source;
    // Los trozos que son sitios no se tocan.
    /** @type {Array<[number, number]>} */
    const kept = [];
    for (const place of (Array.isArray(skip) ? skip : []).map(text).filter(name => name.length >= 3)) {
        for (const match of source.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escape(place)}(?![\\p{L}\\p{N}])`, 'giu'))) {
            kept.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
        }
    }
    const owner = new Map(hidden.map(row => [row.variant, row.person]));
    const names = [...owner.keys()].map(escape).join('|');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:(a|de|A|De)(\\s+))?(${names})(?![\\p{L}\\p{N}])`, 'gu');
    return source.replace(pattern, (all, prep, space, name, offset) => {
        const at = Number(offset) + (prep ? prep.length + space.length : 0);
        if (kept.some(([a, b]) => at >= a && at < b)) return all;
        const person = owner.get(name);
        if (!person) return all;
        let out = roleOf(person, 'el');
        if (prep) {
            const contracted = /^el\s/.test(out);
            if (contracted) out = out.slice(3);
            const joined = contracted ? (fold(prep) === 'a' ? 'al' : 'del') : prep;
            return `${/^\p{Lu}/u.test(prep) ? capital(joined) : joined}${space}${out}`;
        }
        const before = source.slice(0, Number(offset)).replace(/\s+$/, '');
        return startsSentence(before) ? capital(out) : out;
    });
}

// ---------------------------------------------------------------------------------------------
// Durante una escena: quién lleva la cuenta
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Namer Lo que usa una ventana mientras se juega (la escena, la charla): cómo
 *   se llama ahora a cada uno, y lo que se aprende de cada línea que se lee.
 * @property {(ref: any, form?: 'el'|'El'|'un'|'placa') => string} name
 * @property {(said: any) => string} text Los `{npc:…}` resueltos con lo que se sabe ahora.
 * @property {(said: any) => string} mask `maskNames` con lo que se sabe ahora.
 * @property {(line: HeardLine) => Array<{name: string, how: string}>} hear Leer una línea.
 * @property {(ref: any, how?: string, by?: string) => boolean} meet Apuntarlo a mano (`charla`,
 *   `escrito`…). Si era nuevo, true.
 * @property {(ref: any) => boolean} knows
 * @property {(ref: any) => string} intro Cómo se presenta alguien de la gente que aún no se
 *   conoce («Soy Ramiro, el herrero.»); vacío si ya se le conoce o no es de la gente.
 * @property {() => KnownPeople} state
 */

/**
 * Quien lleva la cuenta de los nombres durante una escena. Cada vez que se aprende uno, avisa
 * (`onLearn`) con lo sabido ya puesto, para guardarlo.
 *
 * @param {NameInput & {day?: number, skip?: string[], onLearn?: (state: KnownPeople, learned: Array<{name: string, how: string}>) => void}} [input]
 * @returns {Namer}
 */
export function createNamer({ state = null, people = [], always = [], day = 0, skip = [], onLearn = () => {} } = {}) {
    let known = readKnownPeople(state);
    const now = () => ({ state: known, people, always });
    /** @param {Array<{name: string, how: string}>} learned */
    const tell = (learned) => {
        if (learned.length === 0) return learned;
        // Si guardarlo falla, la escena sigue: el nombre ya se ve.
        try {
            onLearn(known, learned);
        } catch {
            // nada
        }
        return learned;
    };
    return {
        name: (ref, form = 'placa') => nameFor(ref, { ...now(), form }),
        text: (said) => resolvePeopleTokens(said, now()),
        mask: (said) => maskNames(said, { ...now(), skip }),
        hear: (line) => {
            const out = learnFromLine(known, line, { people, always, day, skip });
            known = out.state;
            return tell(out.learned);
        },
        meet: (ref, how = 'charla', by = '') => {
            const person = findPerson(ref, people);
            if (!person || knowsName(person.name, now())) return false;
            known = meetPerson(known, person.name, how, { day, by, people });
            tell([{ name: person.name, how }]);
            return true;
        },
        knows: (ref) => knowsName(ref, now()),
        intro: (ref) => {
            const person = findPerson(ref, people);
            return person && !knowsName(person.name, now()) ? introLine(person, people) : '';
        },
        state: () => known,
    };
}

/**
 * Lo que se sabe de la gente, para el Diario: quién es cada uno que conoces y cómo lo supiste
 * (Tomás, el posadero: se presentó el día 1). A quien no conoces no se le cuenta.
 *
 * @param {any} state
 * @param {any[]} people
 * @returns {Array<{name: string, role: string, how: string, day: number}>}
 */
export function knownPeopleRows(state, people) {
    const known = readKnownPeople(state);
    /** @type {Array<{name: string, role: string, how: string, day: number}>} */
    const rows = [];
    for (const person of peopleOf(people)) {
        // Una partida de antes conoce a todos, pero no sabe cómo: solo se cuenta lo apuntado.
        const met = known.people[fold(person.name)];
        if (!met) continue;
        rows.push({ name: person.name, role: person.trade || person.stranger ? roleOf(person, 'el') : '', how: MET[/** @type {keyof typeof MET} */ (met.how)] ?? '', day: met.day });
    }
    return rows;
}

/**
 * Las líneas del Diario: «Tomás, el posadero. Se presentó el día 1.».
 *
 * @param {any} state
 * @param {any[]} people
 * @returns {string[]}
 */
export function knownPeopleLines(state, people) {
    return knownPeopleRows(state, people).map(row => {
        const who = row.role ? `${row.name}, ${row.role}.` : `${row.name}.`;
        const how = row.how ? ` ${row.how}${row.day > 0 ? ` el día ${row.day}` : ''}.` : '';
        return `${who}${how}`;
    });
}

// ---------------------------------------------------------------------------------------------
// Comprobar un paquete: nadie llama a nadie por un nombre que no sabe
// ---------------------------------------------------------------------------------------------

/**
 * La gente de un paquete: `npcs` y `confidants`.
 *
 * @param {any} pack
 * @returns {Person[]}
 */
export function packPeople(pack) {
    return peopleOf([...(Array.isArray(pack?.npcs) ? pack.npcs : []), ...(Array.isArray(pack?.confidants) ? pack.confidants : [])]);
}

/**
 * Los hitos en el orden en que se juegan: cada uno detrás del que lo abre; lo demás, como está
 * escrito.
 *
 * @param {any[]} milestones
 * @returns {Array<{milestone: any, index: number}>}
 */
function playOrder(milestones) {
    const list = milestones.map((milestone, index) => ({ milestone, index })).filter(e => isObject(e.milestone));
    const ids = new Set(list.map(e => text(e.milestone.id)));
    /** @type {Array<{milestone: any, index: number}>} */
    const out = [];
    const placed = new Set();
    let guard = list.length + 1;
    while (out.length < list.length && guard-- > 0) {
        for (const entry of list) {
            if (placed.has(entry.index)) continue;
            const after = entry.milestone.opens?.kind === 'after' ? text(entry.milestone.opens.milestone) : '';
            const ready = !after || !ids.has(after) || out.some(e => text(e.milestone.id) === after);
            if (!ready) continue;
            out.push(entry);
            placed.add(entry.index);
        }
    }
    for (const entry of list) if (!placed.has(entry.index)) out.push(entry);
    return out;
}

/**
 * @typedef {Object} IntroIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * Dónde un paquete llama a alguien por su nombre antes de que se sepa (J13.7). Se juega el hilo
 * en orden, apuntando quién se presenta en cada línea:
 *
 * - **errores**: una opción (lo que dices tú) nombra a alguien que todavía no se ha presentado;
 * - **avisos**: el narrador nombra a alguien nuevo sin `presenta` (¿de verdad lo sabe quien
 *   juega?), y un título o una pista nombran a alguien antes de su escena.
 *
 * Las charlas sueltas se miran con lo que se sabe al acabar el hilo, que es lo más que se puede
 * saber: lo que falle ahí, falla siempre.
 *
 * @param {any} pack
 * @returns {{errors: IntroIssue[], warnings: IntroIssue[]}}
 */
export function checkIntroductions(pack) {
    /** @type {IntroIssue[]} */
    const errors = [];
    /** @type {IntroIssue[]} */
    const warnings = [];
    const people = packPeople(pack);
    const skip = [
        ...(Array.isArray(pack?.locations) ? pack.locations : []).map((/** @type {any} */ l) => text(l?.name)),
        ...(Array.isArray(pack?.boards) ? pack.boards : []).map((/** @type {any} */ b) => text(b?.name)),
        ...(Array.isArray(pack?.world?.factions) ? pack.world.factions : []).map((/** @type {any} */ f) => text(f?.name)),
    ].filter(Boolean);
    const dialogues = new Map((Array.isArray(pack?.dialogues) ? pack.dialogues : []).filter(isObject).map((/** @type {any} */ d) => [text(d.id), d]));
    const opts = { people, skip };
    const knows = (/** @type {any} */ state, /** @type {Person} */ person) => knowsName(person.name, { state, people });
    const idOf = (/** @type {Person} */ person) => person.id || fold(person.name).replace(/\s+/g, '-');
    const wantsPresenta = (/** @type {any} */ line, /** @type {Person} */ person) => presentsOf(line?.presenta)
        .some(ref => findPerson(ref === '\u0000' ? line?.who : ref, people)?.name === person.name);

    /** Una línea: se aprende de ella; si el narrador nombra a alguien nuevo sin decirlo, aviso. */
    const hear = (/** @type {any} */ state, /** @type {any} */ raw, /** @type {string} */ path) => {
        const line = typeof raw === 'string' ? { text: raw } : isObject(raw) ? raw : null;
        if (!line) return state;
        if (!text(line.who)) {
            for (const hit of namesIn(line.text, people, { skip })) {
                if (hit.plain && !knows(state, hit.person) && !wantsPresenta(line, hit.person)) {
                    warnings.push({
                        path,
                        message: `El narrador nombra a ${hit.person.name} antes de que se presente. Si quien juega ya lo sabe, pon "presenta": "${idOf(hit.person)}" en la línea; si no, llámale por lo que es (${roleOf(hit.person, 'el')}).`,
                    });
                }
            }
        }
        return learnFromLine(state, line, opts).state;
    };

    /** Lo que dices tú: nombrar a quien no se ha presentado es el error. */
    const say = (/** @type {any} */ state, /** @type {any} */ said, /** @type {string} */ path) => {
        for (const hit of namesIn(said, people, { skip })) {
            if (!knows(state, hit.person)) {
                errors.push({
                    path,
                    message: `Quien juega llama a ${hit.person.name} por su nombre, y todavía no se ha presentado. Quítalo, o escribe {npc:${idOf(hit.person)}} (sale «${roleOf(hit.person, 'el')}» hasta que se presente).`,
                });
            }
        }
    };

    /** Lo que se oye tras elegir: se mira, pero no cuenta para después (se oye solo una). */
    const replies = (/** @type {any} */ state, /** @type {any} */ option, /** @type {string} */ path) => {
        const lines = (/** @type {any} */ raw) => (Array.isArray(raw) ? raw : raw == null ? [] : [raw]);
        let now = state;
        lines(option?.reply).forEach((line, i) => { now = hear(now, line, `${path}.reply${Array.isArray(option.reply) ? `[${i}]` : ''}`); });
        for (const outcome of ['success', 'partial', 'failure']) {
            const branch = option?.check?.[outcome];
            const reply = typeof branch === 'string' ? branch : branch?.reply;
            let after = now;
            lines(reply).forEach((line, i) => { after = hear(after, line, `${path}.check.${outcome}.reply${Array.isArray(reply) ? `[${i}]` : ''}`); });
        }
    };

    /** Una charla: sus líneas en orden (la de inicio primero) y lo que se puede contestar. */
    const talk = (/** @type {any} */ state, /** @type {any} */ dialogue, /** @type {string} */ path) => {
        const speaker = text(dialogue?.speaker);
        const nodes = (Array.isArray(dialogue?.nodes) ? dialogue.nodes : []).filter(isObject);
        const start = text(dialogue?.start) || text(nodes[0]?.id);
        const ordered = [...nodes.filter(n => text(n.id) === start), ...nodes.filter(n => text(n.id) !== start)];
        let now = state;
        for (const node of ordered) {
            const at = nodes.indexOf(node);
            now = learnFromLine(now, { who: speaker, text: node.line, presenta: node.presenta }, opts).state;
            (Array.isArray(node.options) ? node.options : []).forEach((/** @type {any} */ option, o) => {
                if (isObject(option)) say(now, option.text, `${path}.nodes[${at}].options[${o}].text`);
            });
        }
        return now;
    };

    const milestones = Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : [];
    /** @type {Map<string, KnownPeople>} */
    const ends = new Map();
    let pooled = readKnownPeople(null);
    const used = new Set();
    for (const { milestone, index } of playOrder(milestones)) {
        const path = `plot.milestones[${index}]`;
        const after = milestone.opens?.kind === 'after' ? ends.get(text(milestone.opens.milestone)) : null;
        // La mecha empieza sin conocer a nadie; un secreto o lo que abre un reloj, con lo sabido hasta ahí.
        let known = after ?? (milestone.opens?.kind === 'start' && !milestone.hidden ? readKnownPeople(null) : pooled);
        // Un secreto que se encuentra hablando con alguien se cuenta después de esa charla: para
        // entonces ya se ha presentado (la charla empieza por su nombre).
        const talked = milestone.hidden && milestone.asks?.kind === 'talk' ? findPerson(milestone.asks.npc, people) : null;
        if (talked) known = meetPerson(known, talked.name, 'charla', { people });
        /** El título sale en la cabecera de la escena, antes de que nadie hable. */
        const unknownIn = (/** @type {string} */ field, /** @type {any} */ state, /** @type {string} */ when) => {
            for (const hit of namesIn(milestone[field], people, { skip })) {
                if (!knows(state, hit.person)) {
                    warnings.push({
                        path: `${path}.${field}`,
                        message: `Se ve ${when} y nombra a ${hit.person.name}, que todavía no se ha presentado. Llámale por lo que es (${roleOf(hit.person, 'el')}).`,
                    });
                }
            }
        };
        unknownIn('title', known, 'al empezar la escena');
        // Un hito de texto dice en `presenta` a quién se conoce en él (no tiene líneas donde ponerlo).
        const beats = Array.isArray(milestone.beats) ? milestone.beats
            : text(milestone.scene) ? text(milestone.scene).split(/\n\s*\n/).map(part => ({ text: part, presenta: milestone.presenta })) : [];
        const where = Array.isArray(milestone.beats) ? 'beats' : 'scene';
        beats.forEach((/** @type {any} */ beat, b) => {
            const at = where === 'beats' ? `${path}.beats[${b}]` : `${path}.scene`;
            known = hear(known, beat, at);
            (Array.isArray(beat?.options) ? beat.options : []).forEach((/** @type {any} */ option, o) => {
                if (!isObject(option)) return;
                say(known, option.text, `${at}.options[${o}].text`);
                replies(known, option, `${at}.options[${o}]`);
            });
        });
        const dialogue = dialogues.get(text(milestone.sceneDialogue));
        if (dialogue) {
            used.add(text(dialogue.id));
            const d = (Array.isArray(pack?.dialogues) ? pack.dialogues : []).indexOf(dialogue);
            known = talk(known, dialogue, `dialogues[${d}]`);
        }
        // La pista se lee mientras el hito está abierto: después de su escena, que se juega al abrirse.
        unknownIn('hint', known, 'en la pista');
        ends.set(text(milestone.id), known);
        pooled = { all: false, people: { ...pooled.people, ...known.people } };
    }
    (Array.isArray(pack?.dialogues) ? pack.dialogues : []).forEach((/** @type {any} */ dialogue, d) => {
        if (!isObject(dialogue) || used.has(text(dialogue.id))) return;
        talk(pooled, dialogue, `dialogues[${d}]`);
    });
    return { errors, warnings };
}
