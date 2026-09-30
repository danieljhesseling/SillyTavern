/**
 * El mapa de la campaña, dibujado (J10.5 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un pergamino oscuro con los sitios y los caminos que los unen: cada sitio con su dibujo
 * (el escenario en pixel de `escenarios/`, si lo tiene y ya habéis estado) o el icono de su
 * tipo, y con su nombre debajo. Lo que no habéis pisado sale en gris; un camino que no sale de
 * ningún sitio conocido, apenas marcado y sin días; uno cerrado, en rojo y con su candado; uno
 * que se abre con algo (J10.1), con el icono de lo que pide.
 *
 * Al pulsar un sitio, a la derecha (abajo, en el móvil): cómo se llega desde aquí, por qué no
 * si no se puede, sus caminos, lo que sabéis de él y **tu nota**. Si es vecino, «Viajar aquí».
 *
 * Se abre sola, sin `party.js`: es un `<dialog>` modal. Qué es cada cosa lo decide
 * `world/map-layout.js`; guardar la nota y viajar, quien lo abre.
 */

import { describeReach } from '../world/map-layout.js';
import { NOTE_MAX } from '../campaign/text-map.js';
import { firstArt, loadPixelManifest } from './pixel-art.js';

/** El nombre de cada tipo de sitio, para quien juega. */
export const PLACE_TYPE_LABELS = {
    city: 'Ciudad', village: 'Pueblo', outpost: 'Puesto', ruins: 'Ruinas',
    dungeon: 'Mazmorra', camp: 'Campamento', sanctuary: 'Santuario', wilderness: 'Paraje',
};

/** El icono de cada tipo de sitio, cuando no hay dibujo. */
export const PLACE_TYPE_ICONS = {
    city: 'fa-city', village: 'fa-house-chimney', outpost: 'fa-tower-observation', ruins: 'fa-archway',
    dungeon: 'fa-dungeon', camp: 'fa-campground', sanctuary: 'fa-place-of-worship', wilderness: 'fa-tree',
};

/** El icono de cada forma de abrir un camino (J10.1). */
export const GATE_ICONS = { standing: 'fa-handshake', fame: 'fa-star', key: 'fa-key', guide: 'fa-person-hiking' };

/** Cómo se dice el estado de un sitio. */
const STATE_LABELS = { aqui: 'Estáis aquí', visitado: 'Ya habéis estado', 'sin-visitar': 'Sin visitar' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className = '', content = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
}

/**
 * @param {string} icon
 * @param {string} [extra]
 * @returns {HTMLElement}
 */
function icon(icon, extra = '') {
    const node = el('i', `fa-solid ${icon}${extra ? ` ${extra}` : ''}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}

/**
 * Por qué está abierto un camino con puerta: «Abierto: Finn os guía.», «Abierto con una barca.».
 *
 * @param {string} by La forma cumplida (`gateOpen`).
 * @returns {string}
 */
function openedBy(by) {
    const said = text(by);
    return said.startsWith('si ') ? `Abierto: ${said.slice(3)}.` : `Abierto ${said}.`;
}

/**
 * @typedef {Object} CampaignMapInput
 * @property {import('../world/map-layout.js').MapModel} model
 * @property {string} [title]
 * @property {string} [pack] El paquete (`1387`, `strahd`…), para los dibujos de cada sitio.
 * @property {boolean} [night]
 * @property {(place: string, note: string) => void} [onNote] Guardar tu nota (vacía: borrarla).
 * @property {(place: string) => void} [onTravel] «Viajar aquí».
 * @property {string} [selected] El sitio que sale elegido al abrir; sin él, donde estáis.
 */

/**
 * El mapa, listo para meter donde haga falta.
 *
 * @param {CampaignMapInput} input
 * @returns {HTMLElement}
 */
export function buildCampaignMap({ model, title = 'El mapa', pack = '', night = false, onNote = () => {}, onTravel, selected = '' }) {
    const root = el('div', 'cm-root');
    const head = el('div', 'cm-head');
    const heading = el('h3', 'cm-title');
    heading.append(icon('fa-map'), document.createTextNode(` ${title}`));
    head.appendChild(heading);
    const hint = el('p', 'cm-hint', 'Pulsa un sitio para ver cómo se llega, sus caminos y tu nota.');
    head.appendChild(hint);
    root.appendChild(head);

    const body = el('div', 'cm-body');
    const board = el('div', 'cm-board');
    board.setAttribute('role', 'group');
    board.setAttribute('aria-label', 'Los sitios de la campaña');
    const side = el('aside', 'cm-side');
    side.setAttribute('aria-live', 'polite');
    body.append(board, side);
    root.appendChild(body);

    // --- Los caminos: una capa de líneas y, encima, sus días o su candado.
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'cm-roads');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    board.appendChild(svg);
    const where = new Map(model.places.map(place => [place.name, place]));
    for (const road of model.roads) {
        const a = where.get(road.a);
        const b = where.get(road.b);
        if (!a || !b) continue;
        const line = document.createElementNS(svgNs, 'line');
        line.setAttribute('x1', String(a.x));
        line.setAttribute('y1', String(a.y));
        line.setAttribute('x2', String(b.x));
        line.setAttribute('y2', String(b.y));
        const state = !road.known ? 'unknown' : road.closed ? 'closed' : road.fromHere ? 'near' : 'open';
        line.setAttribute('class', `cm-road cm-road-${state}`);
        line.dataset.road = `${road.a}|${road.b}`;
        svg.appendChild(line);
        if (!road.known) continue;
        // En el medio del camino: los días, o el candado y lo que pide.
        const mark = el('span', `cm-mark cm-mark-${state}`);
        mark.style.left = `${(a.x + b.x) / 2}%`;
        mark.style.top = `${(a.y + b.y) / 2}%`;
        mark.dataset.road = `${road.a}|${road.b}`;
        if (road.gate) {
            for (const kind of road.gate.kinds) mark.appendChild(icon(/** @type {Record<string, string>} */ (GATE_ICONS)[kind] ?? 'fa-key'));
            mark.classList.add(road.gate.open ? 'cm-gate-open' : 'cm-gate-shut');
        }
        if (road.closed) mark.appendChild(icon('fa-lock'));
        mark.appendChild(el('span', 'cm-days', `${road.days} d`));
        mark.title = road.closed ? `Cerrado: ${road.note}` : road.gate?.open ? openedBy(road.gate.by) : `${road.days} ${road.days === 1 ? 'día' : 'días'} de camino`;
        board.appendChild(mark);
    }

    // --- Los sitios.
    /** @type {Map<string, HTMLButtonElement>} */
    const tokens = new Map();
    for (const place of model.places) {
        const token = /** @type {HTMLButtonElement} */ (el('button', 'cm-place'));
        token.type = 'button';
        token.dataset.place = place.name;
        token.dataset.state = place.state;
        token.dataset.reach = place.reach;
        token.style.left = `${place.x}%`;
        token.style.top = `${place.y}%`;
        token.setAttribute('aria-label', `${place.name}: ${STATE_LABELS[place.state]}`);
        const medal = el('span', 'cm-medal');
        // El dibujo, solo de lo que habéis visto: lo demás es su tipo, en la niebla.
        const art = place.state !== 'sin-visitar' ? firstArt('scene', { name: place.name, pack, night }) : '';
        if (art) {
            const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art cm-art'));
            image.src = art;
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('error', () => {
                image.remove();
                medal.appendChild(icon(PLACE_TYPE_ICONS[/** @type {keyof typeof PLACE_TYPE_ICONS} */ (place.type)] ?? 'fa-location-dot', 'cm-type'));
            });
            medal.appendChild(image);
        } else {
            medal.appendChild(icon(PLACE_TYPE_ICONS[/** @type {keyof typeof PLACE_TYPE_ICONS} */ (place.type)] ?? 'fa-location-dot', 'cm-type'));
        }
        token.appendChild(medal);
        if (place.note) {
            const pin = el('span', 'cm-pin');
            pin.title = 'Tiene una nota tuya';
            pin.appendChild(icon('fa-thumbtack'));
            token.appendChild(pin);
        }
        if (place.state === 'aqui') token.appendChild(el('span', 'cm-here', 'Aquí'));
        token.appendChild(el('span', 'cm-name', place.name));
        token.addEventListener('click', () => select(place.name));
        board.appendChild(token);
        tokens.set(place.name, token);
    }
    // Una rosa de los vientos, de adorno.
    board.appendChild(icon('fa-compass', 'cm-compass'));

    // --- La leyenda.
    const legend = el('div', 'cm-legend');
    const add = (/** @type {string} */ cls, /** @type {string} */ label, /** @type {string} */ ico = '') => {
        const item = el('span', `cm-legend-item ${cls}`);
        if (ico) item.appendChild(icon(ico));
        item.appendChild(document.createTextNode(label));
        legend.appendChild(item);
    };
    add('cm-l-here', 'Aquí');
    add('cm-l-visited', 'Visitado');
    add('cm-l-unvisited', 'Sin visitar');
    add('cm-l-road', 'Camino');
    add('cm-l-closed', 'Cerrado', 'fa-lock');
    add('cm-l-gate', 'Se abre con algo', 'fa-key');
    add('cm-l-note', 'Tu nota', 'fa-thumbtack');
    root.appendChild(legend);

    /**
     * Lo de la derecha: el sitio elegido.
     *
     * @param {string} name
     */
    function select(name) {
        const place = where.get(name);
        if (!place) return;
        for (const [key, token] of tokens) token.classList.toggle('cm-selected', key === name);
        for (const node of board.querySelectorAll('[data-road]')) {
            const [a, b] = String(/** @type {HTMLElement} */ (node).dataset.road).split('|');
            node.classList.toggle('cm-lit', a === name || b === name);
        }
        side.textContent = '';
        side.dataset.place = name;
        side.appendChild(el('h4', 'cm-side-name', place.name));
        const facts = [STATE_LABELS[place.state], PLACE_TYPE_LABELS[/** @type {keyof typeof PLACE_TYPE_LABELS} */ (place.type)]].filter(Boolean).join(' · ');
        side.appendChild(el('div', 'cm-side-state', facts));
        side.appendChild(el('p', `cm-side-reach cm-reach-${place.reach}`, describeReach(place)));
        side.appendChild(el('p', 'cm-side-desc', place.state === 'sin-visitar' ? 'Todavía no habéis estado aquí.' : place.description));

        const roads = model.roads.filter(road => road.a === name || road.b === name);
        if (roads.length > 0) {
            side.appendChild(el('div', 'cm-side-title', 'Caminos'));
            const list = el('ul', 'cm-side-roads');
            for (const road of roads) {
                const other = road.a === name ? road.b : road.a;
                const item = el('li', `cm-side-road${road.closed ? ' cm-side-closed' : ''}${road.known ? '' : ' cm-side-unknown'}`);
                if (!road.known) item.textContent = 'Un camino que no conocéis.';
                else {
                    item.appendChild(el('span', 'cm-side-to', `${other}, ${road.days} ${road.days === 1 ? 'día' : 'días'}`));
                    if (road.closed) item.appendChild(el('span', 'cm-side-why', `Cerrado: ${road.note || 'ahora no se puede pasar'}`));
                    else if (road.gate?.open) item.appendChild(el('span', 'cm-side-why cm-side-opened', openedBy(road.gate.by)));
                }
                list.appendChild(item);
            }
            side.appendChild(list);
        }

        // Tu nota.
        const label = el('label', 'cm-note-label', 'Tu nota');
        const area = /** @type {HTMLTextAreaElement} */ (el('textarea', 'text_pole cm-note'));
        area.maxLength = NOTE_MAX;
        area.rows = 3;
        area.placeholder = 'Algo que quieras recordar de este sitio…';
        area.value = place.note;
        label.appendChild(area);
        side.appendChild(label);
        const noteRow = el('div', 'cm-note-row');
        const count = el('span', 'cm-note-count', `${area.value.length}/${NOTE_MAX}`);
        const save = /** @type {HTMLButtonElement} */ (el('button', 'menu_button cm-note-save', 'Guardar nota'));
        save.type = 'button';
        area.addEventListener('input', () => { count.textContent = `${area.value.length}/${NOTE_MAX}`; });
        save.addEventListener('click', () => {
            const note = text(area.value).slice(0, NOTE_MAX);
            place.note = note;
            onNote(place.name, note);
            const token = tokens.get(place.name);
            const pin = token?.querySelector('.cm-pin');
            if (note && token && !pin) {
                const mark = el('span', 'cm-pin');
                mark.title = 'Tiene una nota tuya';
                mark.appendChild(icon('fa-thumbtack'));
                token.insertBefore(mark, token.querySelector('.cm-name'));
            } else if (!note && pin) pin.remove();
            save.textContent = note ? 'Guardada' : 'Borrada';
            setTimeout(() => { save.textContent = 'Guardar nota'; }, 1200);
        });
        noteRow.append(count, save);
        side.appendChild(noteRow);

        if (onTravel && place.reach === 'near') {
            const go = /** @type {HTMLButtonElement} */ (el('button', 'menu_button cm-travel'));
            go.type = 'button';
            go.append(icon('fa-person-hiking'), document.createTextNode(` Viajar aquí (${place.days} ${place.days === 1 ? 'día' : 'días'})`));
            go.addEventListener('click', () => onTravel(place.name));
            side.appendChild(go);
        }
    }

    select(selected && where.has(selected) ? selected : model.here && where.has(model.here) ? model.here : model.places[0]?.name ?? '');
    return root;
}

/**
 * Abrir el mapa en su ventana. Se cierra con «Cerrar», con Escape o eligiendo viajar.
 *
 * @param {CampaignMapInput & {mount?: HTMLElement|null}} input
 * @returns {Promise<{travelTo: string}>} A dónde se eligió viajar, o vacío.
 */
export async function openCampaignMap(input) {
    await loadPixelManifest().catch(() => null);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'cm-dialog'));
    dialog.setAttribute('aria-label', input.title || 'El mapa');
    (input.mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    return new Promise(resolve => {
        let done = false;
        const finish = (/** @type {string} */ travelTo) => {
            if (done) return;
            done = true;
            if (dialog.open) dialog.close();
            dialog.remove();
            resolve({ travelTo });
        };
        const map = buildCampaignMap({ ...input, onTravel: (place) => finish(place) });
        const close = /** @type {HTMLButtonElement} */ (el('button', 'menu_button cm-close'));
        close.type = 'button';
        close.setAttribute('aria-label', 'Cerrar el mapa');
        close.append(icon('fa-xmark'), document.createTextNode(' Cerrar'));
        close.addEventListener('click', () => finish(''));
        map.querySelector('.cm-head')?.appendChild(close);
        dialog.appendChild(map);
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            finish('');
        });
        dialog.showModal();
        /** @type {HTMLElement|null} */ (map.querySelector('.cm-place.cm-selected') ?? close)?.focus();
    });
}
