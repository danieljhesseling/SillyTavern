/**
 * Quién está dónde (J14.4 y J14.6 de wiki/ROADMAP_SIN_CONEXION.md): en un pueblo y a una hora,
 * en qué sitio está cada persona de tu gente y quién quiere quedar contigo.
 *
 * Es lo que enseña la pantalla del pueblo (J3.11) en cada sitio, con un icono para quien tiene
 * algo que contarte. Las reglas son pocas y se leen en los datos:
 *
 * - **Los sitios de un pueblo** salen de sus servicios (posada, tienda, herrería, templo,
 *   tablón), más la plaza, el muelle si es un puerto y la sala del gremio en Puerto Alba.
 *   La tienda y la herrería cierran de noche (`hours.js`).
 * - **Tu grupo** va contigo: cada uno está a cada hora donde diga su ficha
 *   (`compendio/quedadas.json`, `kind: "gente"`, `places`) o, si no dice nada, donde le lleva
 *   lo que busca. Quien va mal de vida está en el templo, si lo hay.
 * - **La gente del pueblo** (Tomás, Ramiro…) está en su sitio mientras abre; cerrado, en la
 *   posada con una jarra, como ya cuenta `hours.js`.
 * - **Los compañeros de cada campaña** que aún no van contigo (J14.6) están en **su pueblo**
 *   (`home`), y solo allí se queda con ellos; los del gremio (los mercenarios sin contratar),
 *   en Puerto Alba.
 *
 * Puro: con el pueblo, la hora y la gente, dice quién está dónde. Quien llama lo pinta.
 */

import { isOpen } from './hours.js';
import { servicesOf } from './services.js';
import { keyOf } from './social.js';
import { PLACE_KINDS } from './town.js';

/**
 * Los sitios de un pueblo, con cómo se llaman y su icono: las clases de sitio de la pantalla
 * del pueblo (`town.js`, J3.11), para que las dos digan lo mismo.
 */
export const PLACES = PLACE_KINDS;

/** Los sitios que no son un servicio: siempre abiertos. */
const ALWAYS_OPEN = ['plaza', 'muelle', 'gremio'];

/** Dónde anda quien no tiene horario escrito, por lo que busca. */
export const SCHEDULE_BY_WANTS = {
    coin: { morning: 'tienda', afternoon: 'plaza', night: 'posada' },
    glory: { morning: 'plaza', afternoon: 'tablon', night: 'posada' },
    blood: { morning: 'herreria', afternoon: 'plaza', night: 'posada' },
    quiet: { morning: 'templo', afternoon: 'plaza', night: 'posada' },
    knowledge: { morning: 'templo', afternoon: 'tienda', night: 'posada' },
};

/** Por debajo de esta parte de su vida, alguien de tu grupo está en el templo. */
export const HEALING_AT = 0.5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Las clases de sitio de un pueblo, en el orden en que se enseñan: las que escribe el paquete
 * (`places`, las mismas que lee la pantalla del pueblo) o las de sus servicios. Siempre con la
 * plaza, y con el muelle si es un puerto: ahí no atiende nadie, pero ahí se queda (J14.3 habla
 * de «la taberna, la herrería, el muelle…»).
 *
 * @param {any} location La localización (con `services` o su tipo, y quizá `places`).
 * @param {{hub?: boolean, port?: boolean}} [flags] Si es el pueblo del gremio; si es un puerto.
 * @returns {string[]}
 */
export function placesOf(location, { hub = false, port = false } = {}) {
    const harbour = port || hub || /\bpuerto\b|\bmuelle\b/i.test(text(location?.name));
    const written = Array.isArray(location?.places)
        ? [...new Set(location.places.map((/** @type {any} */ p) => text(p?.kind)).filter((/** @type {string} */ k) => k in PLACE_KINDS))]
        : [];
    const services = servicesOf(location);
    const type = text(location?.type || location?.locationType);
    const town = written.length > 0 || services.length > 0 || ['city', 'village', 'camp', 'outpost'].includes(type);
    if (!town) return [];
    const base = written.length > 0 ? written : [
        ...(hub ? ['gremio'] : []),
        ...['posada', 'tienda', 'herreria', 'templo', 'tablon'].filter(s => services.includes(s)),
    ];
    return [...new Set([
        ...(hub && !base.includes('gremio') ? ['gremio'] : []),
        ...base,
        'plaza',
        ...(harbour ? ['muelle'] : []),
    ])];
}

/**
 * Cómo se llama un sitio aquí: el nombre que le da el paquete («La capilla», como en la
 * pantalla del pueblo) o el de su clase; en un campamento, la plaza es el fuego.
 *
 * @param {string} place
 * @param {any} [location]
 * @returns {string}
 */
export function placeLabel(place, location = null) {
    const named = (Array.isArray(location?.places) ? location.places : []).find((/** @type {any} */ p) => text(p?.kind) === place && text(p?.name));
    if (named) return text(named.name);
    if (place === 'plaza' && text(location?.type || location?.locationType) === 'camp') return 'El fuego del campamento';
    return /** @type {Record<string, {label: string}>} */ (PLACES)[place]?.label ?? text(place);
}

/**
 * Si un sitio está abierto a esa hora.
 *
 * @param {string} place
 * @param {string} slot
 * @returns {boolean}
 */
export function placeOpen(place, slot) {
    return ALWAYS_OPEN.includes(place) || isOpen(place, slot);
}

/**
 * El primer sitio de la lista que hay aquí y está abierto a esa hora.
 *
 * @param {string[]} wanted
 * @param {string[]} places
 * @param {string} slot
 * @returns {string}
 */
function firstOpen(wanted, places, slot) {
    return wanted.find(p => p && places.includes(p) && placeOpen(p, slot)) ?? '';
}

/**
 * Dónde está alguien de tu grupo a esa hora.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} [input.person] Su ficha J14 (`personOf`), si la tiene.
 * @param {string[]} input.places
 * @param {string} input.slot
 * @param {string} [input.wants]
 * @returns {string}
 */
export function companionPlace({ member, person = null, places, slot, wants = '' }) {
    const max = Number(member?.maxHp) || 0;
    const hurt = max > 0 && (Number(member?.hp) || 0) / max < HEALING_AT;
    const own = text(person?.places?.[slot]);
    const byWants = text(/** @type {Record<string, Record<string, string>>} */ (SCHEDULE_BY_WANTS)[text(wants)]?.[slot]);
    return firstOpen([hurt ? 'templo' : '', own, byWants, slot === 'night' ? 'posada' : 'plaza', 'plaza', 'posada'], places, slot)
        || places.find(p => placeOpen(p, slot)) || '';
}

/**
 * Dónde está alguien del pueblo a esa hora: su horario, o su servicio mientras abre; cerrado,
 * en la posada. Sin servicio, en la sala del gremio o en la plaza. Vacío: en su casa.
 *
 * @param {Object} input
 * @param {any} input.npc `{name, service}`.
 * @param {any} [input.person]
 * @param {string[]} input.places
 * @param {string} input.slot
 * @returns {string}
 */
export function townsfolkPlace({ npc, person = null, places, slot }) {
    const own = text(person?.places?.[slot]);
    if (own) return firstOpen([own], places, slot);
    const service = text(npc?.service);
    if (service) return firstOpen([service, 'posada'], places, slot);
    return firstOpen(['gremio', 'plaza'], places, slot);
}

/**
 * Su pueblo: el de su ficha J14 o, si no, el primer sitio de los que dice al llegar.
 *
 * @param {any} person Su ficha J14.
 * @param {any} [confidant] Su ficha del paquete (`arrivals`).
 * @returns {string}
 */
export function homeOf(person, confidant = null) {
    const home = text(person?.home);
    if (home) return home;
    const arrivals = Array.isArray(confidant?.arrivals) ? confidant.arrivals : [];
    return text(arrivals[0]?.place);
}

/**
 * @typedef {Object} Here
 * @property {string} key
 * @property {string} name
 * @property {'grupo'|'pueblo'|'confidente'|'mercenario'} kind
 * @property {string} place
 * @property {boolean} inParty
 * @property {boolean} canMeet Si se puede quedar con él (tu gente sí; la del pueblo, charlar).
 * @property {boolean} wantsToMeet
 * @property {string} why
 * @property {any} source La ficha de la que sale (el compañero, el PNJ…).
 */

/**
 * Quién está dónde, en un pueblo y a una hora.
 *
 * @param {Object} input
 * @param {string} input.town El nombre de la localización.
 * @param {any} [input.location] La localización (servicios, tipo), para sus sitios.
 * @param {string} input.slot `morning`, `afternoon` o `night`.
 * @param {Array<string|{kind: string}>} [input.places] Los sitios, si la pantalla del pueblo ya los
 *   sabe: sus clases (`posada`) o los sitios de `townPlaces` de `town.js`.
 * @param {boolean} [input.hub] Si es Puerto Alba, el pueblo del gremio.
 * @param {any[]} [input.party] El grupo, con el héroe primero.
 * @param {any[]} [input.townsfolk] La gente del mundo: `{name, where, service, dead}`.
 * @param {any[]} [input.confidants] Los compañeros de la campaña que aún no van contigo.
 * @param {any[]} [input.hirelings] Los mercenarios del gremio sin contratar.
 * @param {{people: any[]}} [input.data] `readMeetupRows` de `quedadas.json`.
 * @param {(member: any) => string} [input.wantsOf]
 * @param {(here: Here) => {wants: boolean, why?: string}|boolean} [input.wants] Si quiere quedar.
 * @returns {{places: Array<{id: string, label: string, icon: string, open: boolean, people: Here[]}>, people: Here[]}}
 */
export function whoIsWhere({
    town, location = null, slot, places = [], hub = false, party = [], townsfolk = [], confidants = [], hirelings = [],
    data = { people: [] }, wantsOf = (m) => text(m?.reasons?.wants), wants = () => false,
}) {
    // Los de la pantalla del pueblo (ids o sitios de `town.js`, por su clase), o los de aquí.
    const given = [...new Set((Array.isArray(places) ? places : [])
        .map((/** @type {any} */ p) => text(typeof p === 'string' ? p.replace(/-\d+$/, '') : p?.kind))
        .filter(k => k in PLACE_KINDS))];
    const where = { ...(location ?? {}), name: text(location?.name) || text(town) };
    const here = placesOf(given.length > 0 ? { ...where, places: given.map(kind => ({ kind })) } : where, { hub });
    const personOf = (/** @type {any} */ name) => (data?.people ?? []).find((/** @type {any} */ p) => p.key === keyOf(name)) ?? null;
    const sameTown = (/** @type {any} */ a) => keyOf(a) === keyOf(town);
    /** @type {Here[]} */
    const people = [];
    const taken = new Set();
    const add = (/** @type {Omit<Here, 'key'|'wantsToMeet'|'why'>} */ entry) => {
        const key = keyOf(entry.name);
        if (!key || !entry.place || taken.has(key)) return;
        taken.add(key);
        const said = wants({ ...entry, key, wantsToMeet: false, why: '' });
        const flag = typeof said === 'object' ? Boolean(said?.wants) : Boolean(said);
        people.push({ ...entry, key, wantsToMeet: entry.canMeet && flag, why: entry.canMeet && flag && typeof said === 'object' ? text(said?.why) : '' });
    };

    for (const member of (Array.isArray(party) ? party : []).slice(1)) {
        if (!member || member.dead || member.guest?.kind === 'ward') continue;
        const place = companionPlace({ member, person: personOf(member.name), places: here, slot, wants: wantsOf(member) });
        add({ name: text(member.name), kind: member.guest ? 'mercenario' : 'grupo', place, inParty: true, canMeet: true, source: member });
    }
    for (const npc of Array.isArray(townsfolk) ? townsfolk : []) {
        if (!npc || npc.dead || !sameTown(npc.where)) continue;
        add({ name: text(npc.name), kind: 'pueblo', place: townsfolkPlace({ npc, person: personOf(npc.name), places: here, slot }), inParty: false, canMeet: false, source: npc });
    }
    for (const one of [...(Array.isArray(confidants) ? confidants : []), ...(Array.isArray(hirelings) ? hirelings : [])]) {
        const person = personOf(one?.name);
        if (!one || one.dead || !sameTown(homeOf(person, one))) continue;
        const mercenary = (Array.isArray(hirelings) ? hirelings : []).includes(one);
        add({
            name: text(one.name),
            kind: mercenary ? 'mercenario' : 'confidente',
            place: companionPlace({ member: one, person, places: here, slot }),
            inParty: false,
            canMeet: true,
            source: one,
        });
    }

    return {
        people,
        places: here.map(id => ({
            id,
            label: placeLabel(id, location),
            icon: /** @type {Record<string, {icon: string}>} */ (PLACES)[id]?.icon ?? 'fa-location-dot',
            open: placeOpen(id, slot),
            people: people.filter(p => p.place === id),
        })),
    };
}

/**
 * Dónde se puede quedar con alguien ahora: los sitios abiertos, con el suyo primero y los
 * que le gustan marcados (quedar en uno de esos suma un punto más).
 *
 * @param {Object} input
 * @param {string[]} input.places
 * @param {string} input.slot
 * @param {string} [input.current] Donde está ahora.
 * @param {any} [input.person] Su ficha J14 (`likes`).
 * @param {any} [input.location]
 * @returns {Array<{id: string, label: string, icon: string, liked: boolean}>}
 */
export function meetPlaces({ places, slot, current = '', person = null, location = null }) {
    const likes = new Set((Array.isArray(person?.likes) ? person.likes : []).map(text));
    const open = (Array.isArray(places) ? places : []).filter(p => placeOpen(p, slot));
    const ordered = current && open.includes(current) ? [current, ...open.filter(p => p !== current)] : open;
    return ordered.map(id => ({
        id,
        label: placeLabel(id, location),
        icon: /** @type {Record<string, {icon: string}>} */ (PLACES)[id]?.icon ?? 'fa-location-dot',
        liked: likes.has(id),
    }));
}

/**
 * Las fichas de la escena para lo social: quedar (si la franja está libre y hay con quién) y
 * charlar con quien está en el mismo sitio. Con la forma de `hub` de `buildActionChips`.
 *
 * @param {Object} input
 * @param {Here[]} input.people
 * @param {boolean} input.free Si la franja de ahora está libre (`freeTime`).
 * @param {string} [input.at] El sitio donde estás; sin él, cualquiera del pueblo.
 * @param {(here: Here) => boolean} [input.canTalk] Si tiene frases para charlar.
 * @param {number} [input.limit] Cuántas de charlar, como mucho.
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function socialChips({ people, free, at = '', canTalk = () => true, limit = 2 }) {
    const list = Array.isArray(people) ? people : [];
    /** @type {Array<{id: string, label: string, icon: string, command: string}>} */
    const chips = [];
    if (free && list.some(p => p.canMeet)) {
        const eager = list.find(p => p.canMeet && p.wantsToMeet);
        chips.push({
            id: 'quedar',
            label: eager ? `Quedar con alguien (${eager.name.split(' ')[0]} quiere)` : 'Quedar con alguien',
            icon: 'fa-mug-hot',
            command: '/quedar',
        });
    }
    const near = list.filter(p => (!at || p.place === at) && canTalk(p)).slice(0, Math.max(0, limit));
    for (const person of near) {
        chips.push({ id: `charlar:${person.key}`, label: `Charlar con ${person.name.split(' ')[0]}`, icon: 'fa-comments', command: `/charlar ${person.name}` });
    }
    return chips;
}
