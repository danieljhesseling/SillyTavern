/**
 * E8.4 de wiki/ROADMAP_ENTRETENIDO.md: dos capas de gente.
 *
 * Los **confidentes** escritos (Gerd, Nella, Osric y los de los dormitorios) son pocos y son el
 * corazón: tienen su historia, sus charlas y su romance. Escribir uno cuesta mucho, así que no
 * puede haber muchos. Por eso el gremio tiene además **mercenarios de paso**: cada semana del
 * juego llegan unos pocos, hechos por el juego, más baratos y siempre a mano.
 *
 * Cada uno trae:
 * - un nombre que suena a su gente (la batería `nombres` del compendio, si está; si no, la de aquí)
 *   y un mote («Brandar el Callado»), como los escritos;
 * - una clase de 5e de las que tienen retrato de relleno y fila en `clases.json` (el retrato sale
 *   de `retratos/heroes/raza-<especie>-<clase>-<género>`, así que no hace falta dibujar a nadie);
 * - su especie, un nivel cercano al del héroe y sus seis características (la serie estándar,
 *   puesta según su clase);
 * - un rasgo y una línea con la que se presenta, dicha por él (sin narrador, D-J60).
 *
 * Salen de la semilla de la partida y del número de semana: la misma semana, la misma gente, y
 * la siguiente, otra. El que contratas se guarda en el grupo con todo lo suyo (`recruit`).
 *
 * **Sin misión personal ni romance hasta que sea veterano** (E8.6): no tiene nada escrito, y lo
 * que gane, lo gana jugando. `waitsForVeteran` lo dice.
 *
 * Puro: con el azar y lo que se le da, dice quién hay. Quien llama los enseña y los contrata.
 */

import { nameFromRow } from '../compendio/names.js';

/** Cuántos pasan por el gremio cada semana. */
export const WEEKLY_MERCENARIES = 3;

/** Lo que cobra uno de paso por nivel, al contratarle: menos que uno de los de siempre (40). */
export const WEEKLY_MERCENARY_FEE = 25;

/** Los días de una semana del juego. */
export const WEEK_DAYS = 7;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T}
 */
const pickOne = (list, random) => list[Math.floor(random() * list.length) % list.length];

/**
 * La semana del juego de un día: del 1 al 7 es la 1.
 *
 * @param {number} day
 * @returns {number}
 */
export function weekOf(day) {
    const whole = Math.max(1, Math.floor(Number(day) || 1));
    return Math.floor((whole - 1) / WEEK_DAYS) + 1;
}

/**
 * Las clases que pueden traer: las de 5e con retrato y fila en `clases.json`. Por su orden, las
 * características que más le importan (la serie estándar 15, 14, 13, 12, 10, 8 va en ese orden).
 */
const CLASSES = [
    { masc: 'guerrero', fem: 'guerrera', order: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'] },
    { masc: 'bárbaro', fem: 'bárbara', order: ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'] },
    { masc: 'pícaro', fem: 'pícara', order: ['dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'strength'] },
    { masc: 'explorador', fem: 'exploradora', order: ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'] },
    { masc: 'clérigo', fem: 'clériga', order: ['wisdom', 'constitution', 'strength', 'charisma', 'dexterity', 'intelligence'] },
    { masc: 'druida', fem: 'druida', order: ['wisdom', 'constitution', 'dexterity', 'intelligence', 'charisma', 'strength'] },
    { masc: 'mago', fem: 'maga', order: ['intelligence', 'constitution', 'dexterity', 'wisdom', 'charisma', 'strength'] },
    { masc: 'bardo', fem: 'barda', order: ['charisma', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'strength'] },
];

/** La serie estándar de 5e. */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/**
 * Las especies, con la gente de la batería de nombres de la que sale su nombre. `name` es como
 * la llama `razas.json`; `fem`, como se dice de ella.
 */
const SPECIES = [
    { name: 'Humano', masc: 'humano', fem: 'humana', culture: 'valle', weight: 4 },
    { name: 'Enano', masc: 'enano', fem: 'enana', culture: 'norte', weight: 2 },
    { name: 'Elfo', masc: 'elfo', fem: 'elfa', culture: 'bosque', weight: 2 },
    { name: 'Mediano', masc: 'mediano', fem: 'mediana', culture: 'valle', weight: 2 },
    { name: 'Semiorco', masc: 'semiorco', fem: 'semiorca', culture: 'norte', weight: 1 },
    { name: 'Gnomo', masc: 'gnomo', fem: 'gnoma', culture: 'bosque', weight: 1 },
    { name: 'Tiflin', masc: 'tiflin', fem: 'tiflin', culture: 'arena', weight: 1 },
    { name: 'Media elfa', masc: 'medio elfo', fem: 'media elfa', culture: 'bosque', weight: 1 },
];

/** Nombres de relleno, por si falta la batería de nombres. */
const FALLBACK_NAMES = {
    norte: ['Brandar', 'Sigrun', 'Haldis', 'Ulfgar', 'Ketvik', 'Eirhild', 'Thormund', 'Gunnvar'],
    valle: ['Tomé', 'Aldara', 'Benito', 'Clara', 'Rodrigo', 'Jimena', 'Sancho', 'Urraca'],
    bosque: ['Faelan', 'Ilyra', 'Theren', 'Lirien', 'Aerin', 'Sylvar', 'Nimae', 'Caelir'],
    arena: ['Zahir', 'Nadira', 'Kasim', 'Leila', 'Rashad', 'Samira', 'Tarik', 'Yasmin'],
};

/** Los motes que se ponen detrás del nombre, como «Gerd el Mellado»: `[él, ella]`. */
const NICKNAMES = [
    ['el Callado', 'la Callada'], ['el Zurdo', 'la Zurda'], ['Mediabarba', 'Medialuna'], ['el Rápido', 'la Rápida'],
    ['Pocapaga', 'Pocapaga'], ['el Tuerto', 'la Tuerta'], ['Dosfilos', 'Dosfilos'], ['el Paciente', 'la Paciente'],
    ['Piedrasuelta', 'Piedrasuelta'], ['el Descalzo', 'la Descalza'], ['Ceniza', 'Ceniza'], ['el Cuervo', 'la Cuerva'],
];

/**
 * @typedef {Object} RecruitTrait
 * @property {string} id
 * @property {[string, string]} label `[él, ella]`
 * @property {[string, string]} says Lo que dice de sí, `[él, ella]`.
 */

/** @type {RecruitTrait[]} */
const TRAITS = [
    { id: 'madrugador', label: ['Madrugador', 'Madrugadora'], says: ['Me levanto antes que nadie: la guardia del alba es mía.', 'Me levanto antes que nadie: la guardia del alba es mía.'] },
    { id: 'supersticioso', label: ['Supersticioso', 'Supersticiosa'], says: ['Antes de cruzar una puerta toco madera. No me miréis así.', 'Antes de cruzar una puerta toco madera. No me miréis así.'] },
    { id: 'callado', label: ['Callado', 'Callada'], says: ['Hablo poco, pero escucho todo.', 'Hablo poco, pero escucho todo.'] },
    { id: 'gloton', label: ['Glotón', 'Glotona'], says: ['Pago mi parte en la posada, pero que la comida sea abundante.', 'Pago mi parte en la posada, pero que la comida sea abundante.'] },
    { id: 'ahorrador', label: ['Ahorrador', 'Ahorradora'], says: ['Cada moneda que gano va a una bolsa: quiero comprarme una granja.', 'Cada moneda que gano va a una bolsa: quiero comprarme una granja.'] },
    { id: 'bromista', label: ['Bromista', 'Bromista'], says: ['Cuento chistes malos en los peores momentos. Así no tiemblo.', 'Cuento chistes malos en los peores momentos. Así no tiemblo.'] },
    { id: 'valiente', label: ['Valiente', 'Valiente'], says: ['No me escondo detrás de nadie. Si hay que entrar primero, entro yo.', 'No me escondo detrás de nadie. Si hay que entrar primero, entro yo.'] },
    { id: 'prudente', label: ['Prudente', 'Prudente'], says: ['Miro dos veces antes de pisar. Por eso sigo vivo.', 'Miro dos veces antes de pisar. Por eso sigo viva.'] },
    { id: 'curioso', label: ['Curioso', 'Curiosa'], says: ['Todo lo que encuentro lo quiero ver de cerca.', 'Todo lo que encuentro lo quiero ver de cerca.'] },
    { id: 'leal', label: ['Leal', 'Leal'], says: ['Si me pagas, me quedo hasta el final. Palabra.', 'Si me pagas, me quedo hasta el final. Palabra.'] },
    { id: 'grunon', label: ['Gruñón', 'Gruñona'], says: ['Me quejo de todo, pero cumplo.', 'Me quejo de todo, pero cumplo.'] },
    { id: 'cantarin', label: ['Cantarín', 'Cantarina'], says: ['Canto mientras camino. Dicen que espanto a los lobos.', 'Canto mientras camino. Dicen que espanto a los lobos.'] },
];

/** Cómo se presenta según su clase, dicho por él: `[él, ella]`. */
const INTROS = {
    guerrero: [['Llevo media vida con la espada al hombro.', 'Llevo media vida con la espada al hombro.'], ['Fui soldado hasta que dejaron de pagarnos.', 'Fui soldada hasta que dejaron de pagarnos.']],
    barbaro: [['Vengo de las montañas. Allí se pelea para comer.', 'Vengo de las montañas. Allí se pelea para comer.'], ['Cuando me enfado, no hay puerta que aguante.', 'Cuando me enfado, no hay puerta que aguante.']],
    picaro: [['Abro cerraduras y veo las trampas antes de que salten.', 'Abro cerraduras y veo las trampas antes de que salten.'], ['Me crié en los callejones del puerto. Sé moverme sin ruido.', 'Me crié en los callejones del puerto. Sé moverme sin ruido.']],
    explorador: [['Conozco los caminos y tiro bien con el arco.', 'Conozco los caminos y tiro bien con el arco.'], ['He guiado caravanas por sitios peores que este.', 'He guiado caravanas por sitios peores que este.']],
    clerigo: [['Curo heridas y rezo por quien lo necesite.', 'Curo heridas y rezo por quien lo necesite.'], ['Mi templo me manda a ayudar donde haga falta. Y cobro poco.', 'Mi templo me manda a ayudar donde haga falta. Y cobro poco.']],
    druida: [['Las plantas y los animales me hacen caso. Y sé curar.', 'Las plantas y los animales me hacen caso. Y sé curar.'], ['Vivía en el bosque hasta que se quedó pequeño.', 'Vivía en el bosque hasta que se quedó pequeña.']],
    mago: [['Estudié magia en la ciudad. Ahora necesito oro para más libros.', 'Estudié magia en la ciudad. Ahora necesito oro para más libros.'], ['Sé lanzar fuego. Lo demás, lo voy aprendiendo.', 'Sé lanzar fuego. Lo demás, lo voy aprendiendo.']],
    bardo: [['Toco el laúd, sé historias y, si hace falta, curo un poco.', 'Toco el laúd, sé historias y, si hace falta, curo un poco.'], ['Busco aventuras para tener algo que cantar.', 'Busco aventuras para tener algo que cantar.']],
};

/**
 * @typedef {Object} WeeklyMercenary
 * @property {string} name
 * @property {string} className Su clase, dicha según su género («maga»).
 * @property {string} classId La clase sin acentos ni género («mago»).
 * @property {string} gender `Hombre` o `Mujer`.
 * @property {string} race Como la llama `razas.json` («Enano»).
 * @property {string} raceLabel Como se dice de él o de ella («enana»).
 * @property {number} level
 * @property {number} strength
 * @property {number} dexterity
 * @property {number} constitution
 * @property {number} intelligence
 * @property {number} wisdom
 * @property {number} charisma
 * @property {{id: string, label: string, says: string}} trait
 * @property {string} pitch Cómo se presenta, en primera persona.
 * @property {number} week
 * @property {number} fee Lo que cobra al contratarle.
 * @property {true} weekly
 */

/**
 * @param {any} compendium
 * @param {string} culture
 * @param {() => number} random
 * @returns {string}
 */
function givenName(compendium, culture, random) {
    const rows = compendium?.has?.('nombres') ? compendium.find('nombres', { kind: 'person', culture }) : [];
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const name = row ? nameFromRow(row, random) : '';
    return name || pickOne(FALLBACK_NAMES[/** @type {keyof typeof FALLBACK_NAMES} */ (culture)] ?? FALLBACK_NAMES.valle, random);
}

/**
 * La especie, por su peso.
 *
 * @param {() => number} random
 * @returns {typeof SPECIES[number]}
 */
function pickSpecies(random) {
    const total = SPECIES.reduce((sum, s) => sum + s.weight, 0);
    let roll = random() * total;
    for (const species of SPECIES) {
        roll -= species.weight;
        if (roll < 0) return species;
    }
    return SPECIES[0];
}

/**
 * Los mercenarios de paso de una semana.
 *
 * @param {Object} input
 * @param {() => number} input.random Con la semilla de la partida y la semana.
 * @param {number} input.week
 * @param {number} input.level El nivel del héroe.
 * @param {any} [input.compendium] Para los nombres; sin él, los de aquí.
 * @param {string[]} [input.taken] Los nombres que ya hay (los escritos y el grupo).
 * @param {number} [input.count]
 * @returns {WeeklyMercenary[]}
 */
export function weeklyMercenaries({ random, week, level, compendium = null, taken = [], count = WEEKLY_MERCENARIES }) {
    const lead = Math.max(1, Math.floor(Number(level) || 1));
    const used = new Set((Array.isArray(taken) ? taken : []).map(fold));
    const usedClasses = new Set();
    const usedTraits = new Set();
    /** @type {WeeklyMercenary[]} */
    const out = [];
    for (let i = 0; i < Math.max(0, count); i++) {
        // Que no salgan dos de la misma clase la misma semana, si se puede.
        const free = CLASSES.filter(c => !usedClasses.has(c.masc));
        const cls = pickOne(free.length > 0 ? free : CLASSES, random);
        usedClasses.add(cls.masc);
        const species = pickSpecies(random);
        let given = '';
        for (let tries = 0; tries < 8 && (!given || used.has(fold(given))); tries++) given = givenName(compendium, species.culture, random);
        used.add(fold(given));
        // El nombre avisa, como en castellano: «Alira» es ella y «Lenasso», él; si no, al azar.
        const woman = /a$/i.test(given) ? true : /o$/i.test(given) ? false : random() < 0.5;
        const g = woman ? 1 : 0;
        const name = `${given} ${pickOne(NICKNAMES, random)[g]}`;
        const stats = Object.fromEntries(cls.order.map((ability, n) => [ability, STANDARD_ARRAY[n]]));
        const freeTraits = TRAITS.filter(t => !usedTraits.has(t.id));
        const trait = pickOne(freeTraits.length > 0 ? freeTraits : TRAITS, random);
        usedTraits.add(trait.id);
        const classId = fold(cls.masc);
        const intro = pickOne(INTROS[/** @type {keyof typeof INTROS} */ (classId)], random)[g];
        // Cerca del nivel del héroe: el suyo o uno menos (y más barato).
        const lvl = Math.max(1, lead - (random() < 0.34 ? 1 : 0));
        out.push({
            name,
            className: woman ? cls.fem : cls.masc,
            classId,
            gender: woman ? 'Mujer' : 'Hombre',
            race: species.name,
            raceLabel: woman ? species.fem : species.masc,
            level: lvl,
            strength: stats.strength,
            dexterity: stats.dexterity,
            constitution: stats.constitution,
            intelligence: stats.intelligence,
            wisdom: stats.wisdom,
            charisma: stats.charisma,
            trait: { id: trait.id, label: trait.label[g], says: trait.says[g] },
            pitch: `${intro} ${trait.says[g]}`,
            week: Math.max(1, Math.floor(Number(week) || 1)),
            fee: WEEKLY_MERCENARY_FEE * lvl,
            weekly: true,
        });
    }
    return out;
}

/**
 * Las ofertas de paso para el panel de contratar, con la forma de `hireOffers`: los de esta
 * semana (marcados si ya van contigo) y los de otras semanas que siguen en el grupo, para poder
 * despedirlos.
 *
 * @param {Object} input
 * @param {WeeklyMercenary[]} input.week Los de esta semana.
 * @param {any[]} input.party
 * @returns {Array<WeeklyMercenary & {hired: boolean, id: string}>}
 */
export function weeklyOffers({ week, party }) {
    const list = (Array.isArray(party) ? party : []).filter(m => m && !m.dead);
    const inParty = (/** @type {string} */ name) => list.find(m => m.guest && fold(m.name) === fold(name));
    const offers = (Array.isArray(week) ? week : []).map(offer => {
        const member = inParty(offer.name);
        return { ...offer, hired: Boolean(member), id: member ? String(member.id) : '' };
    });
    const shown = new Set(offers.map(o => fold(o.name)));
    for (const member of list) {
        const recruit = member.recruit && typeof member.recruit === 'object' ? member.recruit : null;
        if (!recruit || member.guest?.kind !== 'mercenary' || shown.has(fold(member.name))) continue;
        offers.push({
            name: text(member.name),
            className: text(member.class),
            classId: fold(member.class),
            gender: text(member.gender),
            race: text(member.race),
            raceLabel: text(recruit.raceLabel) || fold(member.race),
            level: Math.max(1, Math.floor(Number(member.level) || 1)),
            strength: Number(member.strength) || 10,
            dexterity: Number(member.dexterity) || 10,
            constitution: Number(member.constitution) || 10,
            intelligence: Number(member.intelligence) || 10,
            wisdom: Number(member.wisdom) || 10,
            charisma: Number(member.charisma) || 10,
            trait: { id: text(recruit.trait?.id), label: text(recruit.trait?.label), says: text(recruit.trait?.says) },
            pitch: text(recruit.pitch),
            week: Math.max(1, Math.floor(Number(recruit.week) || 1)),
            fee: 0,
            weekly: true,
            hired: true,
            id: String(member.id),
        });
    }
    return offers;
}

/**
 * Lo que se le pone a la ficha del invitado al contratarle (`guestMember` solo pone la fuerza
 * y la destreza): su especie, el resto de sus características y lo suyo de mercenario de paso.
 *
 * @param {WeeklyMercenary} offer
 * @returns {Record<string, any>}
 */
export function recruitPatch(offer) {
    return {
        race: text(offer?.race),
        constitution: Number(offer?.constitution) || 10,
        intelligence: Number(offer?.intelligence) || 10,
        wisdom: Number(offer?.wisdom) || 10,
        charisma: Number(offer?.charisma) || 10,
        recruit: {
            week: Math.max(1, Math.floor(Number(offer?.week) || 1)),
            raceLabel: text(offer?.raceLabel),
            trait: { id: text(offer?.trait?.id), label: text(offer?.trait?.label), says: text(offer?.trait?.says) },
            pitch: text(offer?.pitch),
        },
    };
}

/**
 * Si es un mercenario de paso (hecho por el juego, no escrito).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isWeeklyMercenary(member) {
    return Boolean(member?.recruit && typeof member.recruit === 'object') && member?.guest?.kind === 'mercenary';
}

/**
 * Si aún no puede pedir misión personal ni tener romance: es de paso y todavía no es veterano.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function waitsForVeteran(member) {
    return isWeeklyMercenary(member) && !member?.veteran?.promoted;
}

/**
 * Cómo se dice en una línea: «maga enana, nivel 3».
 *
 * @param {{className: string, raceLabel?: string, level: number, gender?: string}} offer
 * @returns {string}
 */
export function recruitLine(offer) {
    const what = [text(offer?.className), text(offer?.raceLabel)].filter(Boolean).join(' ');
    return `${what}, nivel ${Math.max(1, Math.floor(Number(offer?.level) || 1))}`;
}
