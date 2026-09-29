/**
 * La pantalla del pueblo (J3.11 de wiki/ROADMAP_SIN_CONEXION.md): los sitios de dentro de una
 * localización —la herrería, la posada, la tienda, el templo, el gremio— y quién está en cada uno.
 *
 * Hasta ahora un pueblo era una localización con sus servicios en tarjetas, todas en la misma
 * columna. Pero la gente del mundo ya dice qué atiende (`service`) y la localización ya dice qué
 * hay (`services`, o lo propio de su tipo en `services.js`): esto los junta en **sitios**, cada
 * uno con quien lo lleva, y la pantalla deja moverse entre ellos como entre localizaciones.
 *
 * - **De dónde salen**: de la lista `places` de la localización si el paquete la escribe (con
 *   sus nombres y su orden); si no, de sus servicios, uno por servicio.
 * - **Quién está**: la persona que el sitio nombra (`keeper`) o la primera de aquí con ese
 *   servicio. Los demás con ese servicio, con ella. Quien no atiende nada, en la plaza.
 * - **Qué se hace**: las tarjetas de servicios que ya existen (`serviceActions` y lo que añade
 *   party.js), repartidas por sitio. Lo que no es de ningún sitio va a la plaza.
 * - **La hora**: de noche, el dibujo de noche y el saludo de noche. Cerrar la tienda de noche es
 *   `hours.js`, y espera a la decisión D11: aquí solo se dice, no se cierra.
 *
 * Puro: con la localización, la gente y las tarjetas, dice qué sitios hay y qué lleva cada uno.
 */

import { servicesOf } from './services.js';

/**
 * Las clases de sitio: cómo se llaman, su icono, su dibujo (`pixel/sitios/`), el servicio que
 * atiende quien lo lleva y qué otras tarjetas recoge si no hay un sitio propio para ellas.
 */
export const PLACE_KINDS = {
    gremio: { label: 'El gremio', icon: 'fa-shield-halved', art: 'gremio', service: 'gremio', takes: ['tablon', 'maestro'] },
    posada: { label: 'La posada', icon: 'fa-beer-mug-empty', art: 'taberna', service: 'posada', takes: [] },
    herreria: { label: 'La herrería', icon: 'fa-hammer', art: 'herreria', service: 'herreria', takes: [] },
    tienda: { label: 'La tienda', icon: 'fa-shop', art: 'tienda', service: 'tienda', takes: [] },
    templo: { label: 'El templo', icon: 'fa-hands-praying', art: 'templo', service: 'templo', takes: [] },
    tablon: { label: 'El tablón', icon: 'fa-clipboard-list', art: 'plaza', service: 'tablon', takes: [] },
    plaza: { label: 'La plaza', icon: 'fa-users', art: 'plaza', service: '', takes: ['caso', 'maestro'] },
    muelle: { label: 'El muelle', icon: 'fa-anchor', art: 'muelle', service: '', takes: [] },
};

/** Los tipos de localización que tienen plaza: donde vive gente junta. */
const SQUARE_TYPES = new Set(['city', 'village']);

/**
 * @typedef {Object} TownPerson
 * @property {string} name
 * @property {string} trade Su oficio, dicho corto: «Herrero».
 */

/**
 * @typedef {Object} TownPlace
 * @property {string} id El de su clase (`herreria`), o con número si se repite (`posada-2`).
 * @property {keyof typeof PLACE_KINDS} kind
 * @property {string} name Lo que se lee: «La herrería», o el nombre propio que le da el paquete.
 * @property {string} icon
 * @property {string} art El dibujo de `pixel/sitios/`, sin el `.png` ni el `-noche`.
 * @property {string} description Una línea del paquete, si la trae.
 * @property {TownPerson|null} keeper Quien lo atiende, si hay alguien.
 * @property {TownPerson[]} people Los demás que están ahí.
 * @property {string[]} cards Las tarjetas de servicios de aquí que son de este sitio, por id.
 */

/**
 * @typedef {Object} TownPlaceSpec Un sitio tal y como lo escribe un paquete.
 * @property {keyof typeof PLACE_KINDS} kind
 * @property {string} [name]
 * @property {string} [keeper] El nombre de quien lo atiende (el importador cambia el id por el nombre).
 * @property {string} [description]
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} a @param {any} b @returns {boolean} */
const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();

/**
 * La lista `places` de una localización, limpia: solo las clases que existen, con lo escrito
 * recortado. Con `npcs` (los del paquete, con su `id`), el `keeper` escrito como id pasa a ser
 * el nombre: el mundo guarda a la gente por nombre, no por id.
 *
 * @param {any} raw
 * @param {Array<{id?: string, name?: string}>} [npcs]
 * @returns {TownPlaceSpec[]}
 */
export function readPlaces(raw, npcs = []) {
    if (!Array.isArray(raw)) return [];
    const people = Array.isArray(npcs) ? npcs : [];
    /** @type {TownPlaceSpec[]} */
    const out = [];
    for (const row of raw) {
        const kind = text(row?.kind);
        if (!(kind in PLACE_KINDS)) continue;
        const keeper = text(row?.keeper);
        const known = keeper ? people.find(p => same(p?.id, keeper) || same(p?.name, keeper)) : null;
        out.push({
            kind: /** @type {keyof typeof PLACE_KINDS} */ (kind),
            ...(text(row?.name) ? { name: text(row.name) } : {}),
            ...(keeper ? { keeper: text(known?.name) || keeper } : {}),
            ...(text(row?.description) ? { description: text(row.description) } : {}),
        });
    }
    return out;
}

/**
 * La gente del mundo, de las entradas del Lorebook: quien es, dónde vive, qué atiende y si vive.
 * Los confidentes no: son para reclutar, no gente del pueblo.
 *
 * @param {any} entries Las `entries` de un mundo.
 * @returns {Array<{name: string, where: string, service: string, trade: string, dead: boolean}>}
 */
export function townNpcsFromEntries(entries) {
    return Object.values(entries && typeof entries === 'object' ? entries : {})
        .filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && !e.dndData.confidant)
        .map((/** @type {any} */ e) => ({
            name: text(e.dndData.name || e.comment),
            where: text(e.dndData.mapPosition?.locationName),
            service: text(e.dndData.service),
            trade: text(e.dndData.trade || e.dndData.title),
            dead: Boolean(e.dndData.dead),
        }))
        .filter(n => n.name);
}

/**
 * Los sitios de una localización, con quién está en cada uno y qué tarjetas de servicios le tocan.
 *
 * @param {Object} input
 * @param {any} input.location La localización (de `locationMaps`), con `services` y quizá `places`.
 * @param {Array<{name: string, where?: string, service?: string, trade?: string, title?: string, dead?: boolean}>} [input.npcs]
 * @param {Array<{id: string}>|null} [input.cards] Las tarjetas de servicios de aquí. Sin ellas
 *   (para contar sitios), un sitio de un servicio que hay aquí cuenta aunque no se sepa aún qué ofrece.
 * @param {boolean} [input.guild] Si es el pueblo del gremio: tenga o no lista, sale el gremio.
 * @returns {{places: TownPlace[], rest: string[]}} Los sitios, y las tarjetas que no caben en ninguno.
 */
export function townPlaces({ location, npcs = [], cards = null, guild = false }) {
    const here = text(location?.name);
    if (!here) return { places: [], rest: (cards ?? []).map(c => text(c?.id)) };
    const services = servicesOf(location);
    const living = (Array.isArray(npcs) ? npcs : []).filter(n => n && text(n.name) && !n.dead);
    const local = living.filter(n => same(n.where, here));
    /** @param {any} n @returns {TownPerson} */
    const person = (n) => ({ name: text(n.name), trade: text(n.trade || n.title) });

    // La lista escrita manda; sin ella, un sitio por servicio, y el gremio si lo hay.
    const written = readPlaces(location?.places);
    /** @type {TownPlaceSpec[]} */
    const specs = written.length > 0 ? written
        : services.filter(s => s in PLACE_KINDS).map(s => ({ kind: /** @type {keyof typeof PLACE_KINDS} */ (s) }));
    const hasGuildKeeper = local.some(n => same(n.service, 'gremio'));
    if ((guild || hasGuildKeeper) && !specs.some(s => s.kind === 'gremio')) specs.push({ kind: 'gremio' });

    /** @type {Set<string>} */
    const taken = new Set();
    /** @type {Record<string, number>} */
    const seen = {};
    /** @type {TownPlace[]} */
    const places = specs.map(spec => {
        const kind = PLACE_KINDS[spec.kind];
        seen[spec.kind] = (seen[spec.kind] ?? 0) + 1;
        // Quien nombra el paquete, esté donde esté apuntado; si no, el primero de aquí con su servicio.
        const named = spec.keeper ? living.find(n => same(n.name, spec.keeper)) : null;
        const keeper = named ?? (spec.keeper ? null
            : local.find(n => kind.service && same(n.service, kind.service) && !taken.has(text(n.name).toLowerCase())) ?? null);
        if (keeper) taken.add(text(keeper.name).toLowerCase());
        return {
            id: seen[spec.kind] > 1 ? `${spec.kind}-${seen[spec.kind]}` : spec.kind,
            kind: spec.kind,
            name: text(spec.name) || kind.label,
            icon: kind.icon,
            art: kind.art,
            description: text(spec.description),
            keeper: keeper ? person(keeper) : null,
            people: [],
            cards: [],
        };
    });

    // Los demás con el servicio de un sitio, en ese sitio; quien no atiende nada, en la plaza.
    /** @type {TownPlace|null} */
    let square = places.find(p => p.kind === 'plaza') ?? null;
    const squareFor = () => {
        if (!square) {
            const type = text(location?.locationType || location?.type);
            square = {
                id: 'plaza', kind: 'plaza', name: SQUARE_TYPES.has(type) ? PLACE_KINDS.plaza.label : 'La gente de aquí',
                icon: PLACE_KINDS.plaza.icon, art: SQUARE_TYPES.has(type) ? PLACE_KINDS.plaza.art : '',
                description: '', keeper: null, people: [], cards: [],
            };
            places.push(square);
        }
        return square;
    };
    for (const npc of local) {
        if (taken.has(text(npc.name).toLowerCase())) continue;
        const home = places.find(p => PLACE_KINDS[p.kind].service && same(PLACE_KINDS[p.kind].service, npc.service));
        if (home) home.people.push(person(npc));
        // Sin plaza en el pueblo, la gente suelta solo tiene sitio donde vive gente junta, o
        // si ya hay otros sitios: en unas ruinas con un ermitaño no se abre una plaza.
        else if (square || places.length > 0 || SQUARE_TYPES.has(text(location?.locationType || location?.type))) squareFor().people.push(person(npc));
    }

    // Cada tarjeta, a su sitio: el de su servicio, el que la recoge, o la plaza.
    /** @type {string[]} */
    const rest = [];
    for (const card of cards ?? []) {
        const id = text(card?.id);
        if (!id) continue;
        const home = places.find(p => same(PLACE_KINDS[p.kind].service, id))
            ?? places.find(p => PLACE_KINDS[p.kind].takes.includes(id));
        if (home) home.cards.push(id);
        else if (places.length > 0) squareFor().cards.push(id);
        else rest.push(id);
    }

    // Un sitio sin nadie y sin nada que hacer sobra. Sin tarjetas (al contar), vale con que
    // su servicio esté aquí.
    const offered = new Set(services);
    const kept = places.filter(p => p.keeper || p.people.length > 0 || p.cards.length > 0
        || (cards === null && offered.has(PLACE_KINDS[p.kind].service)));
    return { places: kept, rest };
}

/**
 * La franja del día por su nombre en el reloj: «Noche» es `night`.
 *
 * @param {string} label
 * @returns {'morning'|'afternoon'|'night'|''}
 */
export function slotOf(label) {
    const said = text(label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/noche|night|madrugada/.test(said)) return 'night';
    if (/tarde|afternoon|evening/.test(said)) return 'afternoon';
    if (/manana|morning|alba|amanecer/.test(said)) return 'morning';
    return '';
}

/** Cómo se saluda a cada hora. */
const HELLO = { morning: 'Buenos días', afternoon: 'Buenas tardes', night: 'Buenas noches', '': 'Hola' };

/**
 * Lo que dice quien atiende al entrar, por la clase de sitio. Escrito por el motor: sin modelo
 * también se entra en la herrería y alguien te recibe.
 *
 * @type {Record<string, (who: string, hi: string, late: boolean) => string>}
 */
const GREETINGS = {
    gremio: (who, hi) => `${who} levanta la vista del tablón: «${hi}. Aquí están las campañas y la gente que se alquila. Mira sin prisa.»`,
    posada: (who, hi) => `${who} seca un vaso detrás de la barra: «${hi}. ¿Una cama, algo caliente o una ronda?»`,
    herreria: (who, hi, late) => `${who} deja el martillo sobre el yunque: «${hi}. ${late ? 'Iba a apagar la fragua, pero pasa. ' : ''}¿Qué hay que arreglar?»`,
    tienda: (who, hi, late) => `${who} se apoya en el mostrador: «${hi}. ${late ? 'Iba a cerrar, pero pasa. ' : ''}Mira lo que tengo hoy; los precios están a la vista.»`,
    templo: (who, hi) => `${who} te recibe junto al altar: «${hi}. ¿Vienes a curarte o a que miren algo?»`,
    tablon: (who, hi) => `${who} señala los papeles clavados: «${hi}. Esto es lo que se pide por aquí.»`,
    plaza: (who, hi) => `${who} te ve llegar: «${hi}. ¿Buscas a alguien?»`,
    muelle: (who, hi) => `${who} deja de remendar una red: «${hi}. Hoy el mar está tranquilo.»`,
};

/** Lo que se ve al entrar donde no atiende nadie. */
const EMPTY_LINES = {
    tablon: () => 'Un tablón de madera lleno de papeles clavados: lo que la gente de aquí necesita que alguien haga.',
    plaza: (/** @type {string} */ town) => `La plaza de ${town}. Por aquí pasa todo el mundo.`,
    muelle: () => 'El muelle, con las barcas atadas y el olor del mar.',
};

/**
 * La frase con la que se entra en un sitio.
 *
 * @param {Object} input
 * @param {TownPlace} input.place
 * @param {string} [input.town] El nombre de la localización.
 * @param {string} [input.slot] La franja, por su id (`night`) o por su nombre en el reloj («Noche»).
 * @param {string} [input.hero] A quién se saluda.
 * @returns {string}
 */
export function greetingFor({ place, town = '', slot = '', hero = '' }) {
    const when = slotOf(slot);
    const hi = `${HELLO[when]}${text(hero) ? `, ${text(hero)}` : ''}`;
    const who = text(place?.keeper?.name);
    if (who) {
        const say = GREETINGS[place.kind] ?? ((/** @type {string} */ w, /** @type {string} */ h) => `${w} te saluda: «${h}.»`);
        return say(who, hi, when === 'night');
    }
    const blank = /** @type {Record<string, (town: string) => string>} */ (EMPTY_LINES)[place?.kind];
    if (blank) return blank(text(town) || 'aquí');
    const others = place?.people?.length ?? 0;
    return others > 0
        ? `${text(place?.name)}. Nadie atiende, pero hay gente con quien hablar.`
        : `${text(place?.name)}. Ahora mismo no hay nadie atendiendo.`;
}

/**
 * Quién está en un sitio, en una línea para su tarjeta: «Ramiro, herrero», «Nadie atiende».
 *
 * @param {TownPlace} place
 * @returns {string}
 */
export function describeWho(place) {
    const keeper = place?.keeper;
    const others = place?.people?.length ?? 0;
    if (keeper) {
        const line = keeper.trade ? `${keeper.name}, ${keeper.trade.charAt(0).toLowerCase()}${keeper.trade.slice(1)}` : keeper.name;
        return others > 0 ? `${line} y ${others === 1 ? 'alguien más' : `${others} más`}` : line;
    }
    if (others === 1) return place.people[0].name;
    if (others > 1) return `${place.people[0].name} y ${others - 1} más`;
    return 'Nadie atiende';
}
