/**
 * La pantalla del pueblo, dibujada (J3.11 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * En la Exploración, arriba, un selector de sitios como el de localizaciones: una tarjeta por
 * sitio (la herrería, la posada, el gremio…), con su dibujo, su nombre y quien lo atiende. Al
 * pulsar una se entra: el sitio de fondo, quien lo lleva de pie y grande, una frase del motor y
 * lo que se puede hacer ahí, como en la novela visual.
 *
 * No hay acciones nuevas. Lo que se hace en cada sitio es lo que el juego ya ofrecía en sus
 * tarjetas de servicios (`getServices` / `onService`) y en la fila de fichas (`getChips` /
 * `onChip`: el tablón de campañas, contratar, hablar con alguien): esto solo lo reparte por
 * sitio. Qué sitios hay y quién está lo decide `campaign/town.js`.
 *
 * La gente y los sitios se leen del mundo abierto, como hace `openPack` con el paquete: una vez
 * por mundo y sitio, y cada poco por si alguien ha muerto o ha cambiado. Si el juego da
 * `getTown`, se usa eso y no se lee nada.
 */

import { firstArt, openPack } from '../pixel-art.js';
import { PLACE_KINDS, townPlaces, townNpcsFromEntries, greetingFor, describeWho, slotOf } from '../../campaign/town.js';
import { hallSections, hallHeader } from '../../campaign/guild-hall.js';
import { hearLine, knowsName, shownName, shownText } from '../shown-names.js';
import { DIRECT_SOCIAL_BUTTONS } from '../../campaign/invitations.js';
import { sightHome, spreadLooks } from '../../campaign/guided-mode.js';

/**
 * @typedef {import('../../campaign/town.js').TownPlace} TownPlace
 * @typedef {{id: string, label: string, detail: string, enabled: boolean, cost?: number}} CardAction
 * @typedef {{id: string, label: string, icon: string, actions: CardAction[]}} ServiceCard
 * @typedef {import('./action-chips.js').ActionChip} ActionChip
 */

/**
 * Lo que la pantalla del pueblo necesita del juego, ya pedido por el Shell.
 *
 * @typedef {Object} TownContext
 * @property {string} here La localización donde está el grupo.
 * @property {string} hero A quién se saluda.
 * @property {string} slot La franja del reloj, como la dice: «Noche».
 * @property {ServiceCard[]} cards Las tarjetas de servicios de aquí.
 * @property {ActionChip[]} chips La fila de fichas: de ahí salen el gremio y las charlas.
 * @property {{location: any, npcs: any[], people?: YourPerson[], hall?: import('../../campaign/guild-hall.js').HallData|null, hubChips?: ActionChip[],
 *   greet?: (place: any, slot?: string) => {text: string, mood: string, remembered?: boolean}}|null} [data]
 *   Lo que da `getTown`, si lo da. `hubChips`: todas las fichas del gremio (la fila solo lleva cuatro).
 *   `greet`: J11.3 y J11.4, el saludo de quien atiende si recuerda lo que hicisteis (vacío si no),
 *   con la cara que pone (J13). J14.11: `pastimes(place)`, los trabajos y ratos libres de un sitio, y
 *   `extraPlaces`, los sitios que añade el juego (el muelle de un puerto). J10.2: `looks`, lo que se
 *   puede examinar dentro de cada sitio, por su clase (`placeLookChips` de `party/talk.js`).
 * @property {(actionId: string) => void} onService
 * @property {(chip: ActionChip) => void} onChip
 * @property {() => void} refresh Redibujar el Shell.
 * @property {boolean} [guided] D-J62, el modo guiado: sin la fila de abajo, lo que se mira suelto en el pueblo
 *   (`data.looseLooks`) va al sitio al que pertenece (`sightHome`), y los rumores (`data.rumors`), a la taberna.
 */

/**
 * El pueblo, montado: sus sitios y lo que no cabe en ninguno.
 *
 * @typedef {Object} TownView
 * @property {string} here
 * @property {TownPlace[]} places
 * @property {string[]} rest Las tarjetas que se quedan fuera de los sitios.
 * @property {boolean} guild Si es el pueblo del gremio.
 * @property {ActionChip[]} hubChips Las fichas del gremio: el tablón, contratar, volver…
 * @property {import('../../campaign/guild-hall.js').HallData|null} [hall] J3.1: el estado de la sala del gremio.
 * @property {Record<string, YourPerson[]>} yours J14.4: tu gente en cada sitio, por el id del sitio.
 * @property {YourPerson[]} loose Tu gente en un sitio que la pantalla no enseña (el muelle sin nada).
 */

/**
 * J14.4: alguien de tu gente (o del pueblo) y dónde está a esta hora, como lo da `getTown`
 * (`townPeople` de `party/social.js`, con `whoIsWhere`).
 *
 * @typedef {Object} YourPerson
 * @property {string} key
 * @property {string} name
 * @property {string} kind `grupo`, `mercenario`, `confidente` o `pueblo`.
 * @property {string} place La clase del sitio (`posada`, `herreria`…).
 * @property {string} placeLabel
 * @property {boolean} canMeet
 * @property {boolean} wantsToMeet «Quiere quedar contigo».
 * @property {string} [why]
 * @property {boolean} canTalk
 * @property {boolean} [waiting] Tiene algo que decirte ya.
 * @property {string} talk La orden de charlar con él.
 * @property {string} meet La orden de quedar con él.
 * @property {string} [invite] D-J63: la orden de acercarte a él (su invitación).
 * @property {boolean} [love] D-J63: ya en la ruta de pareja, os toca una cita: el único corazón.
 */

/** Cada cuánto se vuelve a leer el mundo: la gente cambia poco, y leerlo copia el mundo entero. */
const TOWN_RECHECK_MS = 15000;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @type {{world: string, at: number, sig: string, locations: any[], npcs: any[], loading: boolean}} */
let cache = { world: '', at: 0, sig: '', locations: [], npcs: [], loading: false };

/** El sitio abierto, y en qué pueblo: al viajar se cierra solo. */
let open = { town: '', id: '' };

/**
 * J3.7: la noticia del rango que ya salió en la sala. Hasta que se ve, usar algo del gremio
 * desde la fila de abajo (el tablón, el salón) no la da por contada.
 */
let newsShown = '';

/**
 * Si la noticia del rango ya se ha visto en la sala; y deja de estarlo, porque se va a dar por
 * contada.
 *
 * @returns {boolean}
 */
export function takeHallNews() {
    const seen = Boolean(newsShown);
    newsShown = '';
    return seen;
}

/**
 * Los sitios y la gente del mundo abierto, de lo leído la última vez. Si toca, se vuelve a leer
 * y `onReady` avisa cuando cambia algo.
 *
 * @param {(() => void)|null} [onReady]
 * @returns {{locations: any[], npcs: any[]}|null}
 */
export function readTownWorld(onReady = null) {
    const context = /** @type {any} */ (globalThis).SillyTavern?.getContext?.();
    const world = text(context?.chatMetadata?.world_info);
    if (!world || typeof context?.loadWorldInfo !== 'function') return null;
    const stale = cache.world !== world || Date.now() - cache.at > TOWN_RECHECK_MS;
    if (stale && !cache.loading) {
        cache.loading = true;
        Promise.resolve(context.loadWorldInfo(world))
            .then((/** @type {any} */ data) => {
                const locations = Array.isArray(data?.metadata?.locationMaps) ? data.metadata.locationMaps : [];
                const npcs = townNpcsFromEntries(data?.entries);
                const sig = JSON.stringify([
                    locations.map((/** @type {any} */ l) => [l?.name, l?.locationType ?? l?.type, l?.services, l?.places]),
                    npcs,
                ]);
                const changed = sig !== cache.sig || cache.world !== world;
                cache = { world, at: Date.now(), sig, locations, npcs, loading: false };
                if (changed && onReady) onReady();
            })
            .catch(() => {
                cache.loading = false;
                cache.at = Date.now();
            });
    }
    return cache.world === world ? cache : null;
}

/**
 * La localización de aquí y la gente del mundo: lo que da el juego, o lo leído.
 *
 * @param {string} here
 * @param {{location: any, npcs: any[]}|null|undefined} data
 * @param {(() => void)|null} onReady
 * @returns {{location: any, npcs: any[]}|null}
 */
function sourceFor(here, data, onReady) {
    if (data?.location) return data;
    const world = readTownWorld(onReady);
    const location = world?.locations.find(l => text(l?.name) === text(here)) ?? null;
    return location ? { location, npcs: world?.npcs ?? [] } : null;
}

/**
 * Cuántos sitios tiene el pueblo donde está el grupo. Es lo que hace que la Exploración tenga
 * algo que enseñar en un mundo de una sola localización (el gremio).
 *
 * @param {string} here
 * @param {{location: any, npcs: any[]}|null} [data]
 * @param {(() => void)|null} [onReady]
 * @returns {number}
 */
export function countTownPlaces(here, data = null, onReady = null) {
    if (!text(here)) return 0;
    const source = sourceFor(here, data, onReady);
    return source ? townPlaces({ location: source.location, npcs: source.npcs }).places.length : 0;
}

/**
 * El pueblo de aquí, con las tarjetas y las fichas repartidas por sitio.
 *
 * @param {TownContext} ctx
 * @returns {TownView|null}
 */
export function buildTown(ctx) {
    const source = sourceFor(ctx.here, ctx.data, ctx.refresh);
    if (!source) return null;
    // J3.1: las fichas del gremio, todas si las da `getTown`; la fila de abajo se queda en cuatro.
    const hubChips = (ctx.data?.hubChips ?? ctx.chips ?? []).filter(c => String(c?.id ?? '').startsWith('hub-'));
    const guild = hubChips.some(c => c.id === 'hub-board' || c.id === 'hub-hire' || c.id === 'hub-skip');
    const { places, rest } = townPlaces({ location: source.location, npcs: source.npcs, cards: ctx.cards ?? [], guild });
    // J14.11: los sitios que añade el juego (el muelle de un puerto, para pescar), si no están ya.
    for (const extra of /** @type {any} */ (ctx.data)?.extraPlaces ?? []) {
        if (extra?.id && extra?.kind && !places.some(p => p.kind === extra.kind)) places.push({ ...extra, people: [...(extra.people ?? [])], cards: [...(extra.cards ?? [])] });
    }
    if (open.town !== ctx.here || !places.some(p => p.id === open.id)) open = { town: '', id: '' };
    return {
        here: ctx.here,
        places,
        rest,
        guild,
        hubChips,
        hall: ctx.data?.hall ?? null,
        ...spreadPeople(places, ctx.data?.people ?? []),
    };
}

/**
 * J14.4: tu gente, repartida por los sitios de la pantalla: cada uno en el primero de su clase
 * (la posada, la herrería). La gente del pueblo ya sale en su sitio (quien atiende y los
 * demás); aquí va quien se puede charlar o quedar con él.
 *
 * @param {TownPlace[]} places
 * @param {YourPerson[]} people
 * @returns {{yours: Record<string, YourPerson[]>, loose: YourPerson[]}}
 */
function spreadPeople(places, people) {
    /** @type {Record<string, YourPerson[]>} */
    const yours = {};
    /** @type {YourPerson[]} */
    const loose = [];
    for (const person of Array.isArray(people) ? people : []) {
        if (!person || person.kind === 'pueblo' || !(person.canMeet || person.canTalk)) continue;
        const place = places.find(p => p.kind === person.place) ?? null;
        if (place) (yours[place.id] ??= []).push(person);
        else loose.push(person);
    }
    return { yours, loose };
}

/** @param {string} name @returns {string} El primer nombre: «Gerd», no «Gerd el Mellado». */
const firstName = (name) => text(name).split(' ')[0] || text(name);

/**
 * J13.7: cómo se le llama aquí: por su primer nombre si se ha presentado; si no, por lo que es
 * («el posadero», o «El posadero» al empezar una frase).
 *
 * @param {string} name
 * @param {'el'|'El'|'placa'} [form]
 * @returns {string}
 */
const calledHere = (name, form = 'el') => (knowsName(name) ? firstName(name) : shownName(name, form));

/**
 * J13.7: lo que dice alguien dentro de una frase del narrador: los trozos entre comillas, juntos.
 *
 * @param {string} said
 * @returns {string}
 */
const quotedParts = (said) => [...String(said ?? '').matchAll(/«([^«»]*)»|“([^“”]*)”/g)].map(m => (m[1] ?? m[2] ?? '').trim()).filter(Boolean).join(' ');

/**
 * J13.7: el sitio como se ve: quien lo atiende o anda por él y no se ha presentado, por lo que es.
 *
 * @param {TownPlace} place
 * @returns {TownPlace}
 */
function shownPlace(place) {
    const keeper = place?.keeper && !knowsName(place.keeper.name) ? { ...place.keeper, name: shownName(place.keeper.name), trade: '' } : place?.keeper;
    return { ...place, keeper, people: (place?.people ?? []).map(p => ({ ...p, name: shownName(p.name) })) };
}

/**
 * D-J63: si se marca a alguien en el pueblo (el corazón, la tarjeta resaltada). Sin los botones
 * directos, solo quien te espera para una cita: al principio no hay corazones.
 *
 * @param {YourPerson} person
 * @returns {boolean}
 */
const eager = (person) => (DIRECT_SOCIAL_BUTTONS ? Boolean(person.wantsToMeet) : Boolean(person.love));

/**
 * Las fichas de charlar y quedar con alguien, con la orden que ya hace la fila (`/charlar`,
 * `/quedar`).
 *
 * D-J63: sin los botones directos (`DIRECT_SOCIAL_BUTTONS`), una sola ficha con su nombre: se le
 * pulsa y te saluda (`persona:`, su invitación). Quien solo tiene algo que contar, su charla.
 *
 * @param {YourPerson} person
 * @returns {{meet: ActionChip|null, talk: ActionChip|null}}
 */
function personChips(person) {
    const who = calledHere(person.name);
    if (!DIRECT_SOCIAL_BUTTONS) {
        const name = calledHere(person.name, 'placa');
        return {
            meet: person.canMeet ? {
                id: `persona:${person.key}`, label: name, icon: person.love ? 'fa-heart' : 'fa-user', source: 'motor', command: person.invite || `/invitacion ${person.name}`,
            } : null,
            talk: !person.canMeet && person.canTalk ? { id: `charlar:${person.key}`, label: name, icon: 'fa-user', source: 'motor', command: person.talk } : null,
        };
    }
    return {
        meet: person.canMeet ? { id: `quedar:${person.key}`, label: `Quedar con ${who}`, icon: 'fa-mug-hot', source: 'motor', command: person.meet } : null,
        talk: person.canTalk ? {
            id: `charlar:${person.key}`, label: person.waiting ? `${calledHere(person.name, 'El')} quiere decirte algo` : `Charlar con ${who}`, icon: 'fa-comments', source: 'motor', command: person.talk,
        } : null,
    };
}

/**
 * Las caras de tu gente en la tarjeta de un sitio: su retrato (o su inicial) y un corazón si
 * quiere quedar contigo.
 *
 * @param {YourPerson[]} people
 * @param {string} pack
 * @returns {HTMLElement}
 */
function peopleBadges(people, pack) {
    const row = el('span', 'gs-town-yours');
    for (const person of people.slice(0, 4)) {
        const badge = el('span', `gs-town-you${eager(person) ? ' gs-town-wants' : ''}`);
        badge.dataset.person = person.key;
        badge.title = eager(person) ? `${shownName(person.name)}: quiere quedar contigo` : `${shownName(person.name)}, aquí ahora`;
        const face = faceOf(person.name, pack);
        if (face) badge.appendChild(pixelImage(face, 'gs-town-you-face', person.name));
        else badge.appendChild(el('span', 'gs-town-you-initial', calledHere(person.name, 'placa').slice(0, 1)));
        badge.appendChild(el('span', 'gs-town-you-name', calledHere(person.name, 'placa')));
        if (eager(person)) badge.appendChild(el('i', 'fa-solid fa-heart gs-town-you-heart'));
        row.appendChild(badge);
    }
    if (people.length > 4) row.appendChild(el('span', 'gs-town-you-more', `+${people.length - 4}`));
    return row;
}

/** Cerrar el sitio abierto: al abrir o cerrar el Shell se vuelve a la plaza. */
export function closeTownPlace() {
    open = { town: '', id: '' };
}

/** @returns {string} El sitio abierto, o vacío. */
export function currentTownPlace() {
    return open.id;
}

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className, content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) {
        if (Array.isArray(content)) {
            for (const item of content) {
                if (item instanceof Node) node.appendChild(item);
                else node.appendChild(document.createTextNode(String(item)));
            }
        } else if (content instanceof Node) {
            node.appendChild(content);
        } else {
            node.textContent = content;
        }
    }
    return node;
}

/**
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
function button(className) {
    const node = document.createElement('button');
    node.className = className;
    node.type = 'button';
    return node;
}

/**
 * @param {string} art
 * @returns {string}
 */
function cssUrl(art) {
    return art ? `url("${new URL(art, document.baseURI).href}")` : 'none';
}

/**
 * El fondo de un sitio: su dibujo de `sitios/`, o el escenario de la localización.
 *
 * @param {TownPlace} place
 * @param {string} here
 * @param {boolean} night
 * @param {string} pack
 * @returns {string}
 */
function placeArt(place, here, night, pack) {
    return (place.art ? firstArt('place', { id: place.art, night }) : '') || firstArt('scene', { name: here, pack, night });
}

/**
 * El retrato en pixel de alguien del paquete, o vacío. Con `mood`, su gesto si está dibujado.
 *
 * @param {string} name
 * @param {string} pack
 * @param {string} [mood]
 * @returns {string}
 */
function faceOf(name, pack, mood = '') {
    return name ? firstArt('portrait', { name, pack, ...(mood ? { mood } : {}) }) : '';
}

/**
 * Una imagen en pixel que, si no carga, deja su sitio a un icono.
 *
 * @param {string} src
 * @param {string} className
 * @param {string} alt
 * @returns {HTMLElement}
 */
function pixelImage(src, className, alt) {
    const image = document.createElement('img');
    image.className = `${className} pixel-art`;
    image.src = src;
    image.alt = alt;
    image.addEventListener('error', () => image.replaceWith(el('i', `fa-solid fa-user ${className}-none`)));
    return image;
}

/**
 * Hablar con alguien: la misma ficha que la fila ofrece («Hablar con Ramiro»).
 *
 * @param {string} name
 * @returns {ActionChip}
 */
function talkChip(name) {
    // J13.7: «Hablar con el posadero» hasta que se presente.
    const called = shownName(name, 'el');
    return { id: `talk-local:${name}`, label: `Hablar con ${called}`, icon: 'fa-comments', source: 'motor', draft: `Le digo ${/^el\s/.test(called) ? `al ${called.slice(3)}` : `a ${called}`}: ` };
}

/**
 * El selector de sitios: una tarjeta por sitio, con su dibujo y quien está.
 *
 * @param {TownView} town
 * @param {TownContext} ctx
 * @returns {HTMLElement}
 */
export function renderTownSelector(town, ctx) {
    const night = slotOf(ctx.slot) === 'night';
    const pack = openPack(ctx.refresh);
    const section = el('section', 'gs-town');
    const head = el('div', 'gs-places-title gs-town-title');
    head.appendChild(el('i', 'fa-solid fa-signs-post'));
    head.appendChild(el('span', '', `Sitios de ${town.here}`));
    section.appendChild(head);

    const grid = el('div', 'gs-town-grid');
    for (const place of town.places) {
        const card = button('gs-town-place');
        card.dataset.place = place.id;
        card.title = place.closed ? `${place.name}: ${place.closedLine || place.closed}` : `Entrar en ${place.name}`;
        // D-J29: cerrado se ve en la tarjeta, con su cartel; entrar se puede, comprar no.
        card.classList.toggle('gs-town-closed', Boolean(place.closed));
        const art = placeArt(place, town.here, night, pack);
        const scene = el('span', `gs-town-place-art${art ? '' : ' gs-town-place-bare'}`);
        if (art) scene.style.setProperty('--gs-town-art', cssUrl(art));
        else scene.appendChild(el('i', `fa-solid ${place.icon}`));
        const face = faceOf(place.keeper?.name ?? '', pack);
        if (face) scene.appendChild(pixelImage(face, 'gs-town-place-face', place.keeper?.name ?? ''));
        card.appendChild(scene);
        const body = el('span', 'gs-town-place-body');
        const name = el('span', 'gs-town-place-name');
        name.appendChild(el('i', `fa-solid ${place.icon}`));
        name.appendChild(el('span', '', place.name));
        body.appendChild(name);
        body.appendChild(el('span', 'gs-town-place-who', describeWho(shownPlace(place))));
        // J14.4: quién de tu gente está aquí a esta hora, y quién quiere quedar contigo.
        const yours = town.yours?.[place.id] ?? [];
        if (yours.length > 0) {
            body.appendChild(peopleBadges(yours, pack));
            if (yours.some(eager)) card.classList.add('gs-town-place-wants');
        }
        card.appendChild(body);
        card.addEventListener('click', () => {
            open = { town: town.here, id: place.id };
            ctx.refresh();
        });
        grid.appendChild(card);
    }
    section.appendChild(grid);

    // J14.4: quien anda por un sitio que no tiene tarjeta (el muelle, sin nada que hacer en él):
    // también se le ve, con dónde está, y se queda o se charla con él desde aquí.
    if ((town.loose ?? []).length > 0) {
        const row = el('div', 'gs-town-extra gs-town-loose');
        row.appendChild(el('span', 'gs-town-loose-title', 'Por el pueblo:'));
        for (const person of town.loose) {
            const { meet, talk } = personChips(person);
            const chip = (eager(person) ? meet : null) ?? (DIRECT_SOCIAL_BUTTONS ? talk ?? meet : meet ?? talk);
            if (!chip) continue;
            const go = button(`gs-town-act gs-town-extra-btn${eager(person) ? ' gs-town-wants' : ''}`);
            go.dataset.chip = chip.id;
            go.title = eager(person) ? `${shownName(person.name)} quiere quedar contigo` : `${shownName(person.name)}, en ${person.placeLabel.toLowerCase()}`;
            go.appendChild(el('i', `fa-solid ${eager(person) ? 'fa-heart' : chip.icon}`));
            go.appendChild(el('span', 'gs-btn-label', `${chip.label} (${person.placeLabel.toLowerCase()})`));
            go.addEventListener('click', () => ctx.onChip(chip));
            row.appendChild(go);
        }
        section.appendChild(row);
    }

    // Lo del gremio que no es de ningún sitio de aquí: volver a él desde una campaña, su final.
    const loose = town.guild ? [] : town.hubChips;
    if (loose.length > 0) {
        const row = el('div', 'gs-town-extra');
        for (const chip of loose) {
            const go = button('gs-town-act gs-town-extra-btn');
            go.dataset.chip = chip.id;
            go.appendChild(el('i', `fa-solid ${chip.icon}`));
            go.appendChild(el('span', 'gs-btn-label', chip.label));
            go.addEventListener('click', () => ctx.onChip(chip));
            row.appendChild(go);
        }
        section.appendChild(row);
    }
    return section;
}

/**
 * D-J62, el modo guiado: lo de mirar que el pueblo tiene suelto (sin la fila de abajo no salía en
 * ninguna parte), en el sitio al que pertenece: los avisos de la lonja en el mercado, las barcas en
 * el muelle (`sightHome`). Y los rumores, en la taberna (o donde se oye de todo).
 *
 * @param {TownPlace} place
 * @param {TownView} town
 * @param {TownContext} ctx
 * @returns {ActionChip[]}
 */
function guidedLooks(place, town, ctx) {
    const kinds = [...new Set(town.places.map(p => String(p.kind)))];
    // Si el pueblo tiene dos sitios de la misma clase, al primero.
    if (town.places.find(p => p.kind === place.kind) !== place) return [];
    const data = /** @type {any} */ (ctx.data);
    const loose = /** @type {ActionChip[]} */ (spreadLooks(Array.isArray(data?.looseLooks) ? data.looseLooks : [], kinds)[place.kind] ?? []);
    const rumors = Number(data?.rumors) || 0;
    const tavern = kinds.includes('posada') ? 'posada' : sightHome('lo que se cuenta entre la gente', kinds);
    // La posada ya los ofrece en su tarjeta («Escuchar lo que se cuenta»): no dos botones para lo mismo.
    const inInn = (ctx.cards ?? []).some(card => card.actions.some(action => action.id === 'inn-rumor'));
    if (rumors > 0 && place.kind === tavern && !inInn) {
        loose.push({ id: 'rumor', label: `Escuchar lo que se cuenta (${rumors})`, icon: 'fa-ear-listen', source: 'motor', command: '/rumor' });
    }
    return loose;
}

/**
 * Lo que se puede hacer en un sitio, por grupos: lo de sus tarjetas, lo del gremio y hablar.
 *
 * @param {TownPlace} place
 * @param {TownView} town
 * @param {TownContext} ctx
 * @returns {Array<{title: string, acts: Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, cost: number, run: () => void}>}>}
 */
function placeActs(place, town, ctx) {
    /** @type {ReturnType<typeof placeActs>} */
    const groups = [];
    const keeper = place.keeper?.name ?? '';
    // J3.1: la salida de la sala va la última, detrás de hablar y de lo demás del sitio.
    /** @type {ReturnType<typeof placeActs>} */
    const hallExit = [];
    if (place.kind === 'gremio' && town.guild && town.hubChips.length > 0) {
        const sections = hallSections({ chips: town.hubChips, hall: town.hall ?? {}, town: town.here });
        for (const sec of sections) {
            (sec.id === 'salida' ? hallExit : groups).push({
                title: sec.title,
                acts: sec.acts.map(act => ({
                    id: act.id,
                    label: act.label,
                    icon: act.icon,
                    detail: act.detail,
                    enabled: true,
                    cost: 0,
                    run: () => {
                        if (act.exit) {
                            open = { town: '', id: '' };
                            ctx.refresh();
                        } else if (act.campaign) {
                            // `hub-continue:<id>`: la fila lo sigue por su id (`runShellChip`), sin comando.
                            ctx.onChip({ id: act.id, label: act.label, icon: act.icon, source: 'motor' });
                        } else if (act.chip) {
                            ctx.onChip(act.chip);
                        }
                    },
                })),
            });
        }
    }
    // Tu gente va delante de lo que se compra: quien está aquí es a lo que se viene.
    const peopleAt = groups.length;
    for (const id of place.cards) {
        const card = (ctx.cards ?? []).find(c => c.id === id);
        if (!card) continue;
        const acts = card.actions
            // Hablar con quien atiende va abajo, con los demás: no dos botones para lo mismo.
            .filter(action => !(action.id === 'inn-talk' && keeper))
            .map(action => ({
                id: action.id,
                label: Number(action.cost) > 0 ? action.label.replace(/\s*\(\d+ de oro\)\s*$/, '') : action.label,
                icon: card.icon,
                detail: action.detail,
                enabled: action.enabled,
                cost: Number(action.cost) || 0,
                ...(action.target ? { target: action.target } : {}),
                run: () => ctx.onService(action.id),
            }));
        // Lo del propio sitio, con su nombre de aquí («La taberna»), no el del servicio («La posada»).
        const own = card.id === PLACE_KINDS[place.kind].service;
        if (acts.length > 0) groups.push({ title: own ? place.name : card.label, acts });
    }
    // J14.3 y J14.4: tu gente de aquí: quedar con ella (gasta la parte del día) o charlar.
    const yours = town.yours?.[place.id] ?? [];
    if (yours.length > 0) {
        /** @type {ReturnType<typeof placeActs>[number]['acts']} */
        const acts = [];
        for (const person of yours) {
            const { meet, talk } = personChips(person);
            // D-J63: una ficha por persona, con su nombre: te acercas, te saluda y eliges.
            if (!DIRECT_SOCIAL_BUTTONS) {
                const go = meet ?? talk;
                if (go) {
                    acts.push({
                        id: go.id, label: go.label, icon: go.icon, detail: person.love ? 'Te está esperando.' : 'Te acercas a saludar.', enabled: true, cost: 0, run: () => ctx.onChip(go),
                    });
                }
                continue;
            }
            if (meet) {
                acts.push({
                    id: meet.id, label: meet.label, icon: person.wantsToMeet ? 'fa-heart' : meet.icon,
                    detail: person.wantsToMeet ? `${calledHere(person.name, 'El')} quiere quedar contigo: tiene algo que contarte. Gasta esta parte del día.`
                        : `Pasas esta parte del día con ${calledHere(person.name)}. El vínculo sube.`,
                    enabled: true, cost: 0, run: () => ctx.onChip(meet),
                });
            }
            if (talk) {
                acts.push({
                    id: talk.id, label: talk.label, icon: talk.icon, detail: 'Un momento, sin gastar tiempo.', enabled: true, cost: 0, run: () => ctx.onChip(talk),
                });
            }
        }
        // En la sala del gremio ya hay una parte «Tu gente»: van ahí, no en otra con el mismo nombre.
        const hallPeople = groups.find(group => group.title === 'Tu gente');
        if (acts.length > 0 && hallPeople) hallPeople.acts.push(...acts);
        else if (acts.length > 0) groups.splice(peopleAt, 0, { title: 'Tu gente', acts });
    }
    // J14.11: los trabajos y ratos libres de aquí (servir mesas, la forja, las cartas…): gastan la parte del día.
    const pastimes = /** @type {any} */ (ctx.data)?.pastimes?.(place) ?? [];
    if (pastimes.length > 0) {
        groups.push({
            title: 'Trabajos y ratos libres',
            acts: pastimes.map((/** @type {any} */ act) => ({
                id: String(act.id), label: String(act.label), icon: String(act.icon), detail: String(act.detail ?? ''), enabled: Boolean(act.enabled), cost: 0, run: () => act.run(),
            })),
        });
    }
    // J3.11 y J10.2: lo que se puede examinar en este sitio (la sala del gremio, la capilla…), con su tirada.
    // D-J62: con el modo guiado, también lo suelto del pueblo que es de aquí, y los rumores en la taberna.
    const looks = [...(/** @type {any} */ (ctx.data)?.looks?.[place.kind] ?? []), ...(ctx.guided ? guidedLooks(place, town, ctx) : [])];
    if (looks.length > 0) {
        groups.push({
            title: 'Mirar',
            acts: looks.map((/** @type {any} */ chip) => ({
                id: String(chip.id), label: String(chip.label), icon: String(chip.icon), detail: String(chip.detail ?? ''), enabled: true, cost: 0, run: () => ctx.onChip(chip),
            })),
        });
    }
    const people = [...(keeper ? [keeper] : []), ...place.people.map(p => p.name)].slice(0, 5);
    if (people.length > 0) {
        groups.push({
            title: 'Hablar',
            acts: people.map(name => {
                const chip = talkChip(name);
                return { id: chip.id, label: chip.label, icon: chip.icon, detail: `Lo que ${shownName(name, 'el')} sabe y lo que quiere.`, enabled: true, cost: 0, run: () => ctx.onChip(chip) };
            }),
        });
    }
    groups.push(...hallExit);
    return groups;
}

/**
 * Dentro de un sitio, como en la novela visual: el sitio de fondo, quien lo atiende de pie, su
 * frase y lo que se puede hacer. Dibuja solo si hay un sitio abierto.
 *
 * @param {HTMLElement} panel
 * @param {TownView} town
 * @param {TownContext} ctx
 * @returns {boolean} Si ha dibujado el sitio (y el panel no lleva nada más).
 */

/**
 * Clasifica un objeto para el filtro del mostrador de comercio:
 * 'consumible' (Provisiones & Pociones), 'equipo' (Herramientas & Equipo), o 'valioso' (Gemas & Valiosos).
 *
 * @param {string} name
 * @param {string} [desc]
 * @returns {'consumible'|'equipo'|'valioso'}
 */
function getItemCategory(name, desc = '') {
    const s = `${name} ${desc}`.toLowerCase();
    if (/poci[oó]n|aceite|raci[oó]n|antorcha|incienso|hierba|agua bendita|ung[uü]ento|comida|pan|frasco|elixir|consumible/i.test(s)) {
        return 'consumible';
    }
    if (/diamante|perla|gema|joya|oro|plata|valios|rub[ií]|zafiro|esmeralda|reliquia|piel|trofeo|clavo|diente/i.test(s)) {
        return 'valioso';
    }
    return 'equipo';
}

/**
 * Devuelve el icono FontAwesome adecuado para un objeto.
 *
 * @param {string} name
 * @param {string} [cat]
 * @returns {string}
 */
function getItemIcon(name, cat = '') {
    const s = String(name || '').toLowerCase();
    if (/poci[oó]n|frasco|elixir/i.test(s)) return 'fa-flask';
    if (/aceite/i.test(s)) return 'fa-bottle-droplet';
    if (/raci[oó]n|comida|pan/i.test(s)) return 'fa-bread-slice';
    if (/antorcha/i.test(s)) return 'fa-fire-flame-curved';
    if (/agua bendita|consagrad/i.test(s)) return 'fa-cross';
    if (/incienso|hierba|spa/i.test(s)) return 'fa-spa';
    if (/red/i.test(s)) return 'fa-network-wired';
    if (/la[uú]d|instrumento|guitar/i.test(s)) return 'fa-guitar';
    if (/componentes|bolsa|pouch/i.test(s)) return 'fa-pouch';
    if (/diamante|gema|joya/i.test(s)) return 'fa-gem';
    if (/perla/i.test(s)) return 'fa-circle';
    if (/piel|cuero|fur/i.test(s)) return 'fa-drum';
    if (/daga|cuchillo/i.test(s)) return 'fa-khanda';
    if (/espada|arma|hoja/i.test(s)) return 'fa-shield';
    if (/cuerda|soga/i.test(s)) return 'fa-link';
    if (/clavo|hierro/i.test(s)) return 'fa-cubes-stacked';
    if (/ganz[uú]a|kit|herramienta/i.test(s)) return 'fa-toolbox';
    if (cat === 'consumible') return 'fa-flask';
    if (cat === 'valioso') return 'fa-gem';
    return 'fa-box';
}

/**
 * Renderiza el mostrador táctico de comercio para tiendas (Comprar / Vender / Examinar).
 *
 * @param {Object} p
 * @param {HTMLElement} p.dock
 * @param {TownPlace} p.place
 * @param {TownView} p.town
 * @param {TownContext} p.ctx
 * @param {Array<{title: string, acts: Array<any>}>} p.groups
 * @param {HTMLElement} p.hello
 * @param {(text: string) => void} p.showToast
 * @param {() => number} p.getGold
 * @param {(g: number) => void} p.setGold
 * @param {HTMLElement} p.purseBadge
 */
function renderShopTradeCounter({ dock, place, town, ctx, groups, hello, showToast, getGold, setGold, purseBadge }) {
    const tradeCol = el('div', 'gs-trade-col');

    // 1. Barra de Modos: Comprar | Vender | Examinar
    const tradeNavRow = el('div', 'gs-trade-nav-row');
    const modeGroup = el('div', 'gs-trade-mode-group');

    const keeperName = place.keeper?.name ? shownName(place.keeper.name) : 'la tendera';

    const btnBuy = button('gs-trade-mode-btn active-buy');
    btnBuy.id = 'btn-mode-buy';
    btnBuy.innerHTML = `<i class="fa-solid fa-basket-shopping"></i> Comprar a ${keeperName} <span class="gs-badge-count" id="count-buy">0</span>`;

    const btnSell = button('gs-trade-mode-btn');
    btnSell.id = 'btn-mode-sell';
    btnSell.innerHTML = '<i class="fa-solid fa-sack-dollar"></i> Vender de tu bolsa <span class="gs-badge-count" id="count-sell">0</span>';

    const btnInspect = button('gs-trade-mode-btn');
    btnInspect.id = 'btn-mode-inspect';
    btnInspect.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Examinar tienda <span class="gs-badge-count" id="count-inspect">0</span>';

    modeGroup.appendChild(btnBuy);
    modeGroup.appendChild(btnSell);
    modeGroup.appendChild(btnInspect);
    tradeNavRow.appendChild(modeGroup);
    tradeCol.appendChild(tradeNavRow);

    // 2. Filtros de categoría
    const filterRow = el('div', 'gs-category-filter-row');
    filterRow.id = 'filter-row';
    const filters = [
        { cat: 'all', icon: 'fa-border-all', label: 'Todo' },
        { cat: 'consumible', icon: 'fa-flask', label: 'Provisiones & Pociones' },
        { cat: 'equipo', icon: 'fa-toolbox', label: 'Herramientas & Equipo' },
        { cat: 'valioso', icon: 'fa-gem', label: 'Gemas & Valiosos' },
    ];
    filters.forEach((f, idx) => {
        const chip = button(`gs-cat-filter-chip${idx === 0 ? ' active' : ''}`);
        chip.dataset.cat = f.cat;
        chip.innerHTML = `<i class="fa-solid ${f.icon}"></i> ${f.label}`;
        chip.addEventListener('click', () => {
            filterRow.querySelectorAll('.gs-cat-filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const activePane = shelfPanel.querySelector('.trade-pane.active');
            if (activePane) {
                activePane.querySelectorAll('.gs-shop-item-card[data-cat]').forEach(card => {
                    if (f.cat === 'all' || card.getAttribute('data-cat') === f.cat) {
                        card.style.display = 'grid';
                    } else {
                        card.style.display = 'none';
                    }
                });
            }
        });
        filterRow.appendChild(chip);
    });
    tradeCol.appendChild(filterRow);

    // 3. Paneles de estantería
    const shelfPanel = el('div', 'gs-trade-shelf-panel');

    const paneBuy = el('div', 'trade-pane active');
    paneBuy.id = 'pane-buy';
    const gridBuy = el('div', 'gs-trade-item-grid');
    gridBuy.id = 'grid-buy';
    paneBuy.appendChild(gridBuy);
    shelfPanel.appendChild(paneBuy);

    const paneSell = el('div', 'trade-pane');
    paneSell.id = 'pane-sell';
    const gridSell = el('div', 'gs-trade-item-grid');
    gridSell.id = 'grid-sell';
    paneSell.appendChild(gridSell);
    shelfPanel.appendChild(paneSell);

    const paneInspect = el('div', 'trade-pane');
    paneInspect.id = 'pane-inspect';
    const listInspect = el('div');
    listInspect.style.display = 'flex';
    listInspect.style.flexDirection = 'column';
    listInspect.style.gap = '8px';
    paneInspect.appendChild(listInspect);
    shelfPanel.appendChild(paneInspect);

    tradeCol.appendChild(shelfPanel);

    // Función para actualizar estados de tarjetas de compra
    function updateBuyCardsAffordability() {
        const gold = getGold();
        gridBuy.querySelectorAll('.gs-shop-item-card[data-cost]').forEach(cardNode => {
            const cost = Number(cardNode.getAttribute('data-cost')) || 0;
            const actionPill = cardNode.querySelector('.gs-item-action-pill');
            const priceTag = cardNode.querySelector('.gs-price-tag');
            if (gold < cost) {
                cardNode.classList.add('disabled');
                if (actionPill) {
                    actionPill.textContent = 'Falta oro';
                    actionPill.style.opacity = '0.5';
                }
                if (priceTag) priceTag.style.color = '#fca5a5';
            } else {
                cardNode.classList.remove('disabled');
                if (actionPill) {
                    actionPill.textContent = 'Comprar';
                    actionPill.style.opacity = '1';
                }
                if (priceTag) priceTag.style.color = '';
            }
        });
    }

    const updatePurse = (delta) => {
        const newGold = Math.max(0, getGold() + delta);
        setGold(newGold);
        purseBadge.innerHTML = `<i class="fa-solid fa-coins"></i> ${newGold} táleros`;
        updateBuyCardsAffordability();
    };

    // Mode listeners
    btnBuy.addEventListener('click', () => {
        btnBuy.className = 'gs-trade-mode-btn active-buy';
        btnSell.className = 'gs-trade-mode-btn';
        btnInspect.className = 'gs-trade-mode-btn';
        paneBuy.className = 'trade-pane active';
        paneSell.className = 'trade-pane';
        paneInspect.className = 'trade-pane';
        filterRow.style.display = 'flex';
        hello.textContent = '«Cuerda, antorchas, pan duro... Elige con cabeza, muchacho.»';
        const activeChip = filterRow.querySelector('.gs-cat-filter-chip.active');
        if (activeChip) activeChip.click();
    });

    btnSell.addEventListener('click', () => {
        btnBuy.className = 'gs-trade-mode-btn';
        btnSell.className = 'gs-trade-mode-btn active-sell';
        btnInspect.className = 'gs-trade-mode-btn';
        paneBuy.className = 'trade-pane';
        paneSell.className = 'trade-pane active';
        paneInspect.className = 'trade-pane';
        filterRow.style.display = 'flex';
        hello.textContent = '«Déjame ver qué traes de esas cloacas. Si tiene valor, te pagaré lo justo.»';
        const activeChip = filterRow.querySelector('.gs-cat-filter-chip.active');
        if (activeChip) activeChip.click();
    });

    btnInspect.addEventListener('click', () => {
        btnBuy.className = 'gs-trade-mode-btn';
        btnSell.className = 'gs-trade-mode-btn';
        btnInspect.className = 'gs-trade-mode-btn active-inspect';
        paneBuy.className = 'trade-pane';
        paneSell.className = 'trade-pane';
        paneInspect.className = 'trade-pane active';
        filterRow.style.display = 'none';
        hello.textContent = '«No toques los frascos azules sin guantes, que manchan de por vida.»';
    });

    // --- Poblar Comprar ---
    const buyActs = [];
    groups.forEach(g => {
        g.acts.forEach(act => {
            if (act.id.startsWith('shop-buy:')) buyActs.push(act);
        });
    });

    /** @type {Array<{name: string, cost: number, oldPrice?: number, cat: 'consumible'|'equipo'|'valioso', desc: string, run?: () => void}>} */
    let buyItems = [];

    if (buyActs.length > 0) {
        buyItems = buyActs.map(act => {
            const rawName = act.id.replace('shop-buy:', '').trim();
            const cost = act.cost || 0;
            const cat = getItemCategory(rawName, act.detail);
            const oldPrice = cost > 0 ? Math.round(cost / 0.9) : undefined;
            return {
                name: rawName,
                cost,
                oldPrice: oldPrice && oldPrice > cost ? oldPrice : undefined,
                cat,
                desc: act.detail || 'Provisiones de calidad preparadas para la aventura.',
                run: () => act.run(),
            };
        });
    } else {
        buyItems = [
            { name: 'Frasco de aceite', cost: 9, oldPrice: 10, cat: 'consumible', desc: 'Combustible para linterna o prender suelo.' },
            { name: 'Red reforzada', cost: 9, oldPrice: 10, cat: 'equipo', desc: 'Atranca o inmoviliza a criaturas medianas.' },
            { name: 'Bolsa de componentes', cost: 23, oldPrice: 25, cat: 'equipo', desc: 'Hierbas, polvos y focos arcanos menores.' },
            { name: 'Laúd de haya', cost: 32, oldPrice: 35, cat: 'equipo', desc: 'Instrumento para tocar en tabernas por monedas.' },
            { name: 'Incienso y hierbas', cost: 9, oldPrice: 10, cat: 'consumible', desc: 'Alivia náuseas y ayuda en descanso corto.' },
            { name: 'Agua bendita consagrada', cost: 23, oldPrice: 25, cat: 'consumible', desc: '2d6 radiante contra no-muertos e infernales.' },
            { name: 'Perla de agua dulce', cost: 90, oldPrice: 100, cat: 'valioso', desc: 'Componente clave para Identificar conjuros.' },
            { name: 'Diamante engarzado', cost: 270, oldPrice: 300, cat: 'valioso', desc: 'Requerido para alzar caídos o rituales arcanos.' },
        ];
    }

    buyItems.forEach(item => {
        const card = el('div', `gs-shop-item-card${getGold() < item.cost ? ' disabled' : ''}`);
        card.dataset.cat = item.cat;
        card.setAttribute('data-cost', item.cost.toString());

        const glyph = el('div', 'gs-item-glyph glyph-buy');
        glyph.innerHTML = `<i class="fa-solid ${getItemIcon(item.name, item.cat)}"></i>`;
        card.appendChild(glyph);

        const body = el('div', 'gs-item-body');
        const nameRow = el('div', 'gs-item-name', item.name);
        const descRow = el('div', 'gs-item-desc', item.desc);
        body.appendChild(nameRow);
        body.appendChild(descRow);
        card.appendChild(body);

        const priceSide = el('div', 'gs-item-price-side');
        const priceTag = el('span', 'gs-price-tag');
        if (getGold() < item.cost) priceTag.style.color = '#fca5a5';
        priceTag.innerHTML = `<i class="fa-solid fa-coins"></i> ${item.cost}`;
        priceSide.appendChild(priceTag);

        if (item.oldPrice && item.oldPrice > item.cost) {
            priceSide.appendChild(el('span', 'gs-old-price', item.oldPrice.toString()));
        }

        const actionPill = el('span', 'gs-item-action-pill pill-buy', getGold() < item.cost ? 'Falta oro' : 'Comprar');
        if (getGold() < item.cost) actionPill.style.opacity = '0.5';
        priceSide.appendChild(actionPill);
        card.appendChild(priceSide);

        card.addEventListener('click', () => {
            if (getGold() < item.cost) {
                showToast(`Oro insuficiente para comprar ${item.name}.`);
                return;
            }
            updatePurse(-item.cost);
            showToast(`Has comprado <strong>${item.name}</strong> por ${item.cost} táleros.`);
            if (item.run) item.run();
        });

        gridBuy.appendChild(card);
    });

    const countBuy = tradeNavRow.querySelector('#count-buy');
    if (countBuy) countBuy.textContent = buyItems.length.toString();

    // --- Poblar Vender ---
    const sellActs = [];
    groups.forEach(g => {
        g.acts.forEach(act => {
            if (act.id.startsWith('shop-sell:')) sellActs.push(act);
        });
    });

    /** @type {Array<{name: string, price: number, cat: 'consumible'|'equipo'|'valioso', desc: string, run?: () => void}>} */
    let sellItems = [];

    if (sellActs.length > 0) {
        sellItems = sellActs.map(act => {
            const rawName = act.label.replace(/^Vender\s+/i, '').replace(/\s*\(\+?\d+.*$/, '').trim();
            const gain = Number(act.target || act.cost) || Number(act.label?.match(/\(?\+?(\d+)\s*(?:de\s*)?oro/i)?.[1]) || 2;
            const cat = getItemCategory(rawName, act.detail);
            return {
                name: rawName,
                price: gain,
                cat,
                desc: act.detail || 'Objeto de tu inventario listo para canjear.',
                run: () => act.run(),
            };
        });
    } else {
        sellItems = [
            { name: 'Piel de rata curtida (x2)', price: 4, cat: 'valioso', desc: 'Despojo útil para parches o peleteros.' },
            { name: 'Daga de hierro mellada', price: 2, cat: 'equipo', desc: 'Arma rústica arrebatada a un ratero.' },
            { name: 'Frasco de vidrio limpio', price: 1, cat: 'consumible', desc: 'Botella vacía tras consumir una poción.' },
            { name: 'Clavos antiguos (x5)', price: 3, cat: 'valioso', desc: 'Hierro forjado recuperado de la cripta.' },
            { name: 'Cuerda de cáñamo gastada', price: 1, cat: 'equipo', desc: '15 pies de soga con nudos viejos.' },
        ];
    }

    sellItems.forEach(item => {
        const card = el('div', 'gs-shop-item-card');
        card.dataset.cat = item.cat;

        const glyph = el('div', 'gs-item-glyph glyph-sell');
        glyph.innerHTML = `<i class="fa-solid ${getItemIcon(item.name, item.cat)}"></i>`;
        card.appendChild(glyph);

        const body = el('div', 'gs-item-body');
        const nameRow = el('div', 'gs-item-name', item.name);
        const descRow = el('div', 'gs-item-desc', item.desc);
        body.appendChild(nameRow);
        body.appendChild(descRow);
        card.appendChild(body);

        const priceSide = el('div', 'gs-item-price-side');
        const priceTag = el('span', 'gs-price-tag');
        priceTag.innerHTML = `<i class="fa-solid fa-coins"></i> +${item.price}`;
        priceSide.appendChild(priceTag);

        const actionPill = el('span', 'gs-item-action-pill pill-sell', 'Vender');
        priceSide.appendChild(actionPill);
        card.appendChild(priceSide);

        card.addEventListener('click', () => {
            updatePurse(item.price);
            showToast(`Has vendido <strong>${item.name}</strong> y recibes +${item.price} táleros.`);
            if (item.run) item.run();

            card.style.transition = 'all 0.2s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.remove();
                const remaining = gridSell.querySelectorAll('.gs-shop-item-card').length;
                const countSell = tradeNavRow.querySelector('#count-sell');
                if (countSell) countSell.textContent = remaining.toString();
            }, 200);
        });

        gridSell.appendChild(card);
    });

    const countSell = tradeNavRow.querySelector('#count-sell');
    if (countSell) countSell.textContent = sellItems.length.toString();

    // --- Poblar Examinar ---
    const inspectActs = [];
    groups.forEach(g => {
        g.acts.forEach(act => {
            if (act.id.startsWith('shop-steal:') || act.id.startsWith('shop-haggle') || act.id === 'shop-prices' || g.title === 'Mirar' || g.title === 'Trabajos y ratos libres') {
                inspectActs.push(act);
            }
        });
    });

    if (inspectActs.length > 0) {
        inspectActs.forEach(act => {
            const card = el('div', 'gs-shop-item-card');
            const glyph = el('div', 'gs-item-glyph');
            let icon = act.icon || 'fa-magnifying-glass';
            if (act.id.startsWith('shop-steal:')) icon = 'fa-mask';
            else if (act.id.startsWith('shop-haggle')) icon = 'fa-comments-dollar';
            glyph.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            card.appendChild(glyph);

            const body = el('div', 'gs-item-body');
            body.appendChild(el('div', 'gs-item-name', shownText(act.label, { mask: true })));
            if (act.detail) body.appendChild(el('div', 'gs-item-desc', shownText(act.detail, { mask: true })));
            card.appendChild(body);

            const side = el('div', 'gs-item-price-side');
            const badge = el('span', '', act.id.startsWith('shop-haggle') ? '1x/día' : 'Acción');
            badge.style.fontSize = '0.68rem';
            badge.style.padding = '2px 7px';
            badge.style.borderRadius = '4px';
            badge.style.background = 'rgba(255,255,255,0.06)';
            badge.style.fontFamily = 'monospace';
            side.appendChild(badge);
            card.appendChild(side);

            card.addEventListener('click', () => act.run());
            listInspect.appendChild(card);
        });
    } else {
        const envActions = [
            {
                name: 'Inspeccionar estantes y botellas del fondo',
                desc: 'Tirada de Percepción o Investigación para descubrir mercancía especial.',
                pill: '1x/día',
                icon: 'fa-magnifying-glass',
                msg: `Examinas la trastienda: tirada de Percepción (Total: 15). ${keeperName} oculta ungüentos prohibidos.`,
            },
            {
                name: 'Ayudar a colocar fardos y cajas pesadas',
                desc: `Gana el favor de ${keeperName} y alguna ración de comida para el viaje.`,
                pill: '+1h',
                icon: 'fa-box-archive',
                msg: `Ayudas a estibar cajas: gastas 1h y ${keeperName} te agradece con 2 raciones secas.`,
            },
        ];
        envActions.forEach(env => {
            const card = el('div', 'gs-shop-item-card');
            const glyph = el('div', 'gs-item-glyph');
            glyph.innerHTML = `<i class="fa-solid ${env.icon}"></i>`;
            card.appendChild(glyph);

            const body = el('div', 'gs-item-body');
            body.appendChild(el('div', 'gs-item-name', env.name));
            body.appendChild(el('div', 'gs-item-desc', env.desc));
            card.appendChild(body);

            const side = el('div', 'gs-item-price-side');
            const badge = el('span', '', env.pill);
            badge.style.fontSize = '0.68rem';
            badge.style.padding = '2px 7px';
            badge.style.borderRadius = '4px';
            badge.style.background = 'rgba(255,255,255,0.06)';
            badge.style.fontFamily = 'monospace';
            side.appendChild(badge);
            card.appendChild(side);

            card.addEventListener('click', () => showToast(env.msg));
            listInspect.appendChild(card);
        });
    }

    const countInspect = tradeNavRow.querySelector('#count-inspect');
    if (countInspect) countInspect.textContent = (inspectActs.length || 2).toString();

    dock.appendChild(tradeCol);
}

export function renderTownScene(panel, town, ctx) {
    const place = open.town === town.here ? town.places.find(p => p.id === open.id) : null;
    if (!place) return false;
    const night = slotOf(ctx.slot) === 'night';
    const pack = openPack(ctx.refresh);

    const scene = el('section', 'gs-town-scene');
    scene.dataset.place = place.id;
    const art = placeArt(place, town.here, night, pack);
    const backdrop = el('div', 'gs-town-backdrop');
    if (art) backdrop.style.setProperty('--gs-town-art', cssUrl(art));
    scene.appendChild(backdrop);

    // Capa de avisos y notificaciones tácticas
    const toastLayer = el('div', 'gs-toast-layer');
    scene.appendChild(toastLayer);

    const showToast = (/** @type {string} */ text) => {
        const toast = el('div', 'gs-toast-box');
        toast.innerHTML = `<i class="fa-solid fa-coins" style="color:var(--SmartThemeEmColor, #e2c27a);"></i> <span>${text}</span>`;
        toastLayer.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-6px)';
            setTimeout(() => toast.remove(), 200);
        }, 2400);
    };

    let currentGold = typeof ctx.purse === 'number'
        ? ctx.purse
        : (typeof ctx.data?.purse === 'number'
            ? ctx.data.purse
            : (typeof /** @type {any} */ (globalThis).partyPurse === 'function' ? /** @type {any} */ (globalThis).partyPurse() : 48));

    // Arriba: volver al pueblo, y los otros sitios para ir directo.
    const bar = el('header', 'gs-town-bar');
    const back = button('gs-town-back');
    back.title = `Volver a los sitios de ${town.here}`;
    back.appendChild(el('i', 'fa-solid fa-arrow-left'));
    back.appendChild(el('span', '', `Volver a ${town.here}`));
    back.addEventListener('click', () => {
        open = { town: '', id: '' };
        ctx.refresh();
    });
    bar.appendChild(back);
    const tabs = el('nav', 'gs-town-tabs');
    for (const other of town.places) {
        const tab = button(`gs-town-tab${other.id === place.id ? ' active' : ''}`);
        tab.dataset.place = other.id;
        tab.title = other.id === place.id ? `Estás en ${other.name}` : `Ir a ${other.name}`;
        tab.appendChild(el('i', `fa-solid ${other.icon}`));
        tab.appendChild(el('span', '', other.name));
        tab.addEventListener('click', () => {
            open = { town: town.here, id: other.id };
            ctx.refresh();
        });
        tabs.appendChild(tab);
    }
    bar.appendChild(tabs);
    scene.appendChild(bar);

    // J11.3 y J11.4: si quien atiende recuerda lo que hicisteis, os saluda con eso, y con su cara (J13).
    const remembered = ctx.data?.greet?.(place, ctx.slot) ?? null;
    const recalled = String(remembered?.text ?? '').trim();
    const mood = recalled ? String(remembered?.mood ?? '').trim() : '';

    // Quien atiende, grande, de pie sobre la caja.
    const stage = el('div', 'gs-town-stage');
    const face = (mood ? faceOf(place.keeper?.name ?? '', pack, mood) : '') || faceOf(place.keeper?.name ?? '', pack);
    if (face) {
        const portrait = el('div', 'gs-town-portrait');
        if (mood) portrait.dataset.mood = mood;
        portrait.appendChild(pixelImage(face, 'gs-town-portrait-img', place.keeper?.name ?? ''));
        stage.appendChild(portrait);
    } else if (place.keeper) {
        const portrait = el('div', 'gs-town-portrait gs-town-portrait-none');
        portrait.appendChild(el('i', 'fa-solid fa-user'));
        stage.appendChild(portrait);
    }
    scene.appendChild(stage);

    // J13.7: si quien atiende dice su nombre al saludar («Ramiro. Herrero.»), se ha presentado:
    // se lee antes de poner la placa. Solo cuenta lo que dice entre comillas, no lo que cuenta el narrador.
    const greeting = recalled || greetingFor({ place, town: town.here, slot: ctx.slot, hero: ctx.hero });
    const spoken = quotedParts(greeting);
    if (place.keeper?.name && spoken) hearLine({ who: place.keeper.name, text: spoken });

    // Bocadillo de habla en el escenario
    const bubble = el('div', 'gs-speech-bubble');
    const header = el('div', 'gs-speech-header');
    header.appendChild(el('span', 'gs-speech-name', place.keeper?.name ? shownName(place.keeper.name) : place.name));
    if (place.keeper?.trade) header.appendChild(el('span', 'gs-speech-role', place.keeper.trade));
    bubble.appendChild(header);

    const hello = el('p', 'gs-speech-text', shownText(place.keeper?.name && spoken ? spoken : greeting, { mask: true }));
    if (recalled && remembered?.remembered !== false) hello.classList.add('gs-town-line-remembered');
    bubble.appendChild(hello);
    stage.appendChild(bubble);

    // ==========================================================
    // MOSTRADOR TÁCTICO INFERIOR CON SUBMENÚS
    // ==========================================================
    const dock = el('div', 'gs-hub-dock');

    // COLUMNA 1: INTERLOCUTOR & REPUTACIÓN / CARTERA
    const interlocutorCol = el('div', 'gs-interlocutor-col');

    const colHead = el('div', 'gs-col-head');
    const headTitle = el('span');
    headTitle.appendChild(el('i', 'fa-solid fa-comments'));
    headTitle.appendChild(document.createTextNode(' Interlocutor'));
    colHead.appendChild(headTitle);

    const purseBadge = el('span', 'gs-purse-badge');
    purseBadge.id = 'purse-display';
    purseBadge.innerHTML = `<i class="fa-solid fa-coins"></i> ${currentGold} táleros`;
    colHead.appendChild(purseBadge);
    interlocutorCol.appendChild(colHead);

    const talkCard = el('div', 'gs-talk-card');

    if (place.kind === 'tienda') {
        const statusBox = el('div', 'gs-trade-status-box');
        const affBadge = el('div', 'gs-affinity-badge');
        affBadge.innerHTML = '<i class="fa-solid fa-handshake"></i> Afinidad: Amistosa';
        statusBox.appendChild(affBadge);

        const discNote = el('div', 'gs-discount-note');
        discNote.innerHTML = '<i class="fa-solid fa-tags"></i> Precio de hoy: <strong>−10%</strong> (sois conocidos)';
        statusBox.appendChild(discNote);

        const capNote = el('div', 'gs-capacity-note');
        capNote.innerHTML = '<i class="fa-solid fa-weight-hanging"></i> Carga: 14/30 lb';
        statusBox.appendChild(capNote);
        talkCard.appendChild(statusBox);
    } else {
        // Status Badge Box para otras localidades
        const statusBox = el('div', 'gs-status-badge-box');
        const badgeRow = el('div', 'gs-badge-row');

        // J3.1: En la sala del gremio, el rango y las noticias si ha subido.
        if (place.kind === 'gremio' && town.hall) {
            const hallHeaderInfo = hallHeader(town.hall);
            if (hallHeaderInfo.line) {
                const rankTag = el('span', 'gs-badge-tag', hallHeaderInfo.line);
                badgeRow.appendChild(rankTag);
            }
            if (hallHeaderInfo.news) {
                newsShown = hallHeaderInfo.news;
                const newsInfo = el('div', 'gs-town-hall-news', hallHeaderInfo.news);
                statusBox.appendChild(badgeRow);
                statusBox.appendChild(newsInfo);
            } else {
                statusBox.appendChild(badgeRow);
            }
        } else {
            const affTag = el('span', 'gs-badge-tag', 'Afinidad: Neutral');
            badgeRow.appendChild(affTag);
            statusBox.appendChild(badgeRow);
            if (place.description) {
                const desc = el('div', '', place.description);
                desc.style.fontSize = '0.72rem';
                desc.style.opacity = '0.65';
                desc.style.marginTop = '2px';
                statusBox.appendChild(desc);
            }
        }
        talkCard.appendChild(statusBox);
    }

    const groups = placeActs(place, town, ctx);

    // Extraer el botón de "Hablar" principal (normalmente el primero del keeper)
    let primeTalkAct = null;
    const talkGroupIdx = groups.findIndex(g => g.title === 'Hablar');
    if (talkGroupIdx !== -1 && groups[talkGroupIdx].acts.length > 0) {
        primeTalkAct = groups[talkGroupIdx].acts.shift();
        if (groups[talkGroupIdx].acts.length === 0) {
            groups.splice(talkGroupIdx, 1);
        }
    }

    // Si no se extrajo de los grupos pero hay interlocutor (el que atiende o un local), garantizar el botón primario
    if (!primeTalkAct) {
        const talkPerson = place.keeper?.name || (place.people?.[0]?.name ?? '');
        if (talkPerson) {
            const chip = talkChip(talkPerson);
            primeTalkAct = {
                id: chip.id,
                label: `Hablar con ${shownName(talkPerson, 'el')}`,
                run: () => ctx.onChip(chip),
            };
        }
    }

    if (primeTalkAct) {
        const btnTalk = button('gs-btn-talk-prime');
        btnTalk.appendChild(el('i', 'fa-solid fa-comment-dots'));
        const talkName = place.keeper?.name ? shownName(place.keeper.name) : 'el interlocutor';
        btnTalk.appendChild(document.createTextNode(` Hablar con ${talkName}`));
        btnTalk.title = primeTalkAct.label || `Hablar con ${talkName}`;
        btnTalk.addEventListener('click', () => primeTalkAct.run());
        talkCard.appendChild(btnTalk);
    }

    interlocutorCol.appendChild(talkCard);
    dock.appendChild(interlocutorCol);

    if (place.kind === 'tienda') {
        renderShopTradeCounter({
            dock,
            place,
            town,
            ctx,
            groups,
            hello,
            showToast,
            getGold: () => currentGold,
            setGold: (g) => { currentGold = g; },
            purseBadge,
        });
    } else {
        // COLUMNA 2: CAJÓN DE CATEGORÍAS Y SUBMENÚS (para posada, herrería, gremio, capilla...)
        const drawerCol = el('div', 'gs-drawer-col');
        const catTabs = el('div', 'gs-cat-tabs');
        const contentPanel = el('div', 'gs-cat-content-panel');

        groups.forEach((group, index) => {
            const tabId = `tab-${index}`;
            const paneId = `sub-${index}`;

            // Tab Button
            const tabBtn = button(`gs-cat-tab-btn ${index === 0 ? 'active' : ''}`);
            tabBtn.id = tabId;
            let iconClass = 'fa-circle-dot';
            const t = group.title.toLowerCase();
            if (t.includes('tu gente')) iconClass = 'fa-users';
            else if (t.includes('mirar') || t.includes('entorno')) iconClass = 'fa-magnifying-glass';
            else if (t.includes('trabajos') || t.includes('ocio')) iconClass = 'fa-hammer';
            else if (t.includes('taberna') || t.includes('posada')) iconClass = 'fa-beer-mug-empty';
            else if (t.includes('forja') || t.includes('herrería')) iconClass = 'fa-anvil';
            else if (t.includes('tienda') || t.includes('comprar')) iconClass = 'fa-store';
            else if (t.includes('capilla') || t.includes('templo')) iconClass = 'fa-hands-praying';
            else if (t.includes('gremio') || t.includes('instrucción')) iconClass = 'fa-graduation-cap';
            else if (t.includes('tablón') || t.includes('encargos') || t.includes('misiones')) iconClass = 'fa-scroll';
            else if (t.includes('hablar')) iconClass = 'fa-comments';
            else if (t.includes('muelle')) iconClass = 'fa-anchor';

            tabBtn.appendChild(el('i', `fa-solid ${iconClass}`));
            tabBtn.appendChild(document.createTextNode(` ${group.title} `));

            const countBadge = el('span', 'gs-cat-pill-count', group.acts.length.toString());
            tabBtn.appendChild(countBadge);

            // Pane
            const pane = el('div', `gs-submenu-pane ${index === 0 ? 'active' : ''}`);
            pane.id = paneId;

            const isTradeStyle = group.title === 'Comprar' || group.title === 'Forja' || place.kind === 'tienda' || place.kind === 'herreria' || (place.kind === 'posada' && group.title === place.name);
            const grid = el('div', isTradeStyle ? 'gs-service-grid-sub' : 'gs-act-list-sub');

            for (const act of group.acts) {
            // Comprobar si la opción es de continuar misión o campaña (resaltado en amarillo/dorado)
                const isMission = Boolean(
                    act.campaign ||
                act.isQuest ||
                String(act.id).startsWith('hub-continue:') ||
                String(act.id).startsWith('quest-') ||
                act.label?.includes('★') ||
                act.detail?.toLowerCase().includes('misión') ||
                act.detail?.toLowerCase().includes('campaña'),
                );

                if (isTradeStyle) {
                    const card = el('div', `gs-trade-card ${!act.enabled ? 'disabled' : ''} ${isMission ? 'gs-act-mission' : ''}`);

                    const cardTop = el('div', '');
                    const nameRow = el('div', 'gs-trade-name-row');
                    nameRow.appendChild(el('span', 'gs-trade-name', shownText(act.label, { mask: true })));
                    if (isMission) {
                        const tag = el('span', 'gs-mission-badge');
                        tag.appendChild(el('i', 'fa-solid fa-star'));
                        tag.appendChild(document.createTextNode(' Misión'));
                        nameRow.appendChild(tag);
                    }
                    cardTop.appendChild(nameRow);

                    if (act.detail) {
                        cardTop.appendChild(el('div', 'gs-trade-detail', shownText(act.detail, { mask: true })));
                    }
                    card.appendChild(cardTop);

                    const footer = el('div', 'gs-trade-footer');
                    const cost = el('span', 'gs-trade-cost');
                    if (act.cost > 0) {
                        cost.appendChild(el('i', 'fa-solid fa-coins'));
                        cost.appendChild(document.createTextNode(` ${act.cost} oro`));
                    } else {
                        cost.appendChild(el('i', `fa-solid ${act.icon || 'fa-check'}`));
                        cost.appendChild(document.createTextNode(' Gratis'));
                    }
                    footer.appendChild(cost);
                    card.appendChild(footer);

                    if (act.enabled) {
                        card.addEventListener('click', () => act.run());
                    } else {
                        card.title = 'No disponible o falta oro';
                    }
                    grid.appendChild(card);
                } else {
                    const pill = button(`gs-act-pill ${isMission ? 'gs-act-mission' : ''}`);
                    pill.disabled = !act.enabled;
                    pill.appendChild(el('div', 'gs-act-icon', '').appendChild(el('i', `fa-solid ${act.icon}`)).parentNode);

                    const body = el('div', 'gs-act-body');
                    const titleRow = el('div', 'gs-act-title-row');
                    titleRow.appendChild(el('span', 'gs-act-title', shownText(act.label, { mask: true })));
                    if (isMission) {
                        const tag = el('span', 'gs-mission-badge');
                        tag.appendChild(el('i', 'fa-solid fa-star'));
                        tag.appendChild(document.createTextNode(' Misión'));
                        titleRow.appendChild(tag);
                    }
                    body.appendChild(titleRow);

                    if (act.detail) {
                        body.appendChild(el('span', 'gs-act-sub', shownText(act.detail, { mask: true })));
                    }
                    pill.appendChild(body);

                    pill.addEventListener('click', () => act.run());
                    grid.appendChild(pill);
                }
            }

            if (group.acts.length === 0) {
                grid.appendChild(el('div', 'ex-empty', 'Nada aquí.'));
            }

            pane.appendChild(grid);

            // Tab click logic
            tabBtn.addEventListener('click', () => {
                Array.from(catTabs.children).forEach(t => t.classList.remove('active'));
                tabBtn.classList.add('active');
                Array.from(contentPanel.children).forEach(p => p.classList.remove('active'));
                pane.classList.add('active');
            });

            catTabs.appendChild(tabBtn);
            contentPanel.appendChild(pane);
        });

        if (groups.length === 0) {
            const emptyPane = el('div', 'gs-submenu-pane active');
            emptyPane.appendChild(el('div', 'ex-empty', 'Ahora mismo aquí no hay nada que hacer.'));
            contentPanel.appendChild(emptyPane);
        }

        drawerCol.appendChild(catTabs);
        drawerCol.appendChild(contentPanel);
        dock.appendChild(drawerCol);
    }

    scene.appendChild(dock);

    panel.appendChild(scene);
    return true;
}
