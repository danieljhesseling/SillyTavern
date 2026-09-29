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
 * @property {{location: any, npcs: any[]}|null} [data] Lo que da `getTown`, si lo da.
 * @property {(actionId: string) => void} onService
 * @property {(chip: ActionChip) => void} onChip
 * @property {() => void} refresh Redibujar el Shell.
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
    const hubChips = (ctx.chips ?? []).filter(c => String(c?.id ?? '').startsWith('hub-'));
    const guild = hubChips.some(c => c.id === 'hub-board' || c.id === 'hub-hire');
    const { places, rest } = townPlaces({ location: source.location, npcs: source.npcs, cards: ctx.cards ?? [], guild });
    if (open.town !== ctx.here || !places.some(p => p.id === open.id)) open = { town: '', id: '' };
    return { here: ctx.here, places, rest, guild, hubChips };
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
    if (content !== undefined) node.textContent = content;
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
 * El retrato en pixel de alguien del paquete, o vacío.
 *
 * @param {string} name
 * @param {string} pack
 * @returns {string}
 */
function faceOf(name, pack) {
    return name ? firstArt('portrait', { name, pack }) : '';
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
    return { id: `talk-local:${name}`, label: `Hablar con ${name}`, icon: 'fa-comments', source: 'motor', draft: `Le digo a ${name}: ` };
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
        card.title = `Entrar en ${place.name}`;
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
        body.appendChild(el('span', 'gs-town-place-who', describeWho(place)));
        card.appendChild(body);
        card.addEventListener('click', () => {
            open = { town: town.here, id: place.id };
            ctx.refresh();
        });
        grid.appendChild(card);
    }
    section.appendChild(grid);

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
    if (place.kind === 'gremio' && town.guild && town.hubChips.length > 0) {
        groups.push({
            title: 'El gremio',
            acts: town.hubChips.map(chip => ({
                id: chip.id, label: chip.label, icon: chip.icon, detail: '', enabled: true, cost: 0, run: () => ctx.onChip(chip),
            })),
        });
    }
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
                run: () => ctx.onService(action.id),
            }));
        // Lo del propio sitio, con su nombre de aquí («La taberna»), no el del servicio («La posada»).
        const own = card.id === PLACE_KINDS[place.kind].service;
        if (acts.length > 0) groups.push({ title: own ? place.name : card.label, acts });
    }
    const people = [...(keeper ? [keeper] : []), ...place.people.map(p => p.name)].slice(0, 5);
    if (people.length > 0) {
        groups.push({
            title: 'Hablar',
            acts: people.map(name => {
                const chip = talkChip(name);
                return { id: chip.id, label: chip.label, icon: chip.icon, detail: `Lo que ${name} sabe y lo que quiere.`, enabled: true, cost: 0, run: () => ctx.onChip(chip) };
            }),
        });
    }
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

    // Quien atiende, grande, de pie sobre la caja.
    const stage = el('div', 'gs-town-stage');
    const face = faceOf(place.keeper?.name ?? '', pack);
    if (face) {
        const portrait = el('div', 'gs-town-portrait');
        portrait.appendChild(pixelImage(face, 'gs-town-portrait-img', place.keeper?.name ?? ''));
        stage.appendChild(portrait);
    } else if (place.keeper) {
        const portrait = el('div', 'gs-town-portrait gs-town-portrait-none');
        portrait.appendChild(el('i', 'fa-solid fa-user'));
        stage.appendChild(portrait);
    }
    scene.appendChild(stage);

    const box = el('div', 'gs-town-box');
    box.appendChild(el('div', 'gs-town-plate', place.keeper?.name || place.name));
    const heading = el('div', 'gs-town-where');
    heading.appendChild(el('i', `fa-solid ${place.icon}`));
    heading.appendChild(el('span', '', place.keeper ? `${place.name} · ${place.keeper.trade || 'quien atiende'}` : place.name));
    box.appendChild(heading);
    box.appendChild(el('p', 'gs-town-line', greetingFor({ place, town: town.here, slot: ctx.slot, hero: ctx.hero })));
    if (place.description) box.appendChild(el('p', 'gs-town-desc', place.description));

    const groups = placeActs(place, town, ctx);
    const acts = el('div', 'gs-town-acts');
    for (const group of groups) {
        if (groups.length > 1) acts.appendChild(el('div', 'gs-town-group', group.title));
        for (const act of group.acts) {
            const go = button('gs-town-act');
            go.dataset.action = act.id;
            go.appendChild(el('i', `fa-solid ${act.icon}`));
            go.appendChild(el('span', 'gs-btn-label', act.label));
            if (act.cost > 0) go.appendChild(el('span', 'gs-btn-cost', `${act.cost} oro`));
            if (act.detail) go.title = act.detail;
            go.disabled = !act.enabled;
            go.addEventListener('click', () => act.run());
            acts.appendChild(go);
        }
    }
    if (groups.length === 0) acts.appendChild(el('div', 'ex-empty', 'Ahora mismo aquí no hay nada que hacer.'));
    box.appendChild(acts);
    scene.appendChild(box);

    panel.appendChild(scene);
    return true;
}
