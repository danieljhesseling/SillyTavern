/**
 * La barra de acciones flotante, abajo en el centro, y sus menús que se abren hacia arriba como
 * un grimorio (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md; la maqueta aprobada es
 * wiki/maquetas/combate-vtt-v3.html).
 *
 * La barra dice de quién es el turno y lo que le queda (Acción, Adicional y Reacción, listas o
 * gastadas; los pies; «Cuerpo a tierra») y lleva seis botones: Atacar, Magia, Acciones,
 * Adicional, Fin de turno y Abandonar. Cada uno de los cuatro primeros abre su menú de tarjetas
 * (`action-menus.js`): nunca pasa de 440 px de alto ni se corta por arriba, y se cierra pulsando
 * el mapa o con Esc.
 *
 * Con el teclado: Tab y las flechas andan por la barra y por el menú; Intro pulsa; Esc cierra (o
 * vuelve un paso atrás); los números 1 a 9 eligen la tarjeta de ese número del menú abierto, y
 * con el menú cerrado, 1 a 4 abren Atacar, Magia, Acciones y Adicional (sin conexión, o con el
 * foco en la barra: con conexión, 1, 2 y 3 son las teclas de escena).
 *
 * El menú es una `.gs-targets` con su `.gs-targets-close`: el teclado del juego (`keyboard-nav.js`)
 * ya sabe cerrarla con Esc y no dejar que Tab se salga de ella.
 *
 * Lo que dibuja sale de la foto del turno (`party/combat-bar.js`); aquí no se decide nada del
 * juego.
 *
 * J12.18 (Daniel, 2026-10-02): elegir un ataque o un conjuro que pide a quién («Hacha») abre los
 * objetivos **debajo de su tarjeta, en el mismo menú**: con su cara, su vida en una barra, los pies,
 * lo que tienes de acertar (o la CD) y, apagados, los que no alcanzas con el porqué. Pulsar uno es
 * hacerlo, lo mismo que pulsar su ficha. Al pasar el ratón (o con el teclado) por una tarjeta o un
 * objetivo, en el tablero se encienden en rojo los que se llevarían el golpe y en azul los tuyos que
 * se llevarían la ayuda (`aim-glow.js`). Con el dedo, el primer toque en un objetivo lo enciende y
 * el segundo lo hace.
 *
 * J12.20 (Daniel, 2026-10-03, wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md): el menú ya no
 * sale en el centro, encima de la barra (tapaba el tercio de abajo del tablero, donde están las
 * fichas). Es el **muelle táctico**: a la izquierda, encima del minimapa, 360 px de ancho y su
 * propio scroll (`dock.js`); entra deslizándose desde la izquierda. Se cierra con su ✕, volviendo
 * a pulsar su botón o su tecla (1 Atacar, 2 Magia, 3 Acciones, 4 Adicional; sus tarjetas llevan
 * las demás teclas) o pulsando el mapa. Si aun así tapa alguna ficha, la cámara se aparta lo justo
 * mientras está abierto. En el teléfono es una hoja que sube desde abajo, y el tablero sube lo justo
 * para que el objetivo se vea encima.
 */

import { focusList, focusOn, keyboardInUse } from '../keyboard-nav.js';
import { cardKeyAt, cardKeys, pickable, unfolds } from './action-menus.js';
import { clearAim, showAim } from './aim-glow.js';
import { DOCK, dockNudge, dockPlace } from './dock.js';

/**
 * @typedef {import('./action-menus.js').BarView} BarView
 * @typedef {import('./action-menus.js').MenuView} MenuView
 * @typedef {import('./action-menus.js').MenuItem} MenuItem
 */

/**
 * @typedef {Object} BarHandlers
 * @property {(pick: string) => ({keepOpen?: string}|void)} onPick
 * @property {() => void} onEndTurn
 * @property {() => void} onFlee
 * @property {() => void} [onAutoTurn]
 */

/**
 * Lo que la barra recuerda entre un repintado y otro: el tablero se redibuja a menudo (una
 * tirada, un aviso) y un menú abierto no puede cerrarse solo por eso.
 */
const memory = {
    /** El menú abierto, o vacío. */
    open: '',
    /** Los pasos dentro del menú (las tarjetas pulsadas, por su `key`). */
    steps: /** @type {string[]} */ ([]),
    /** El filtro de Magia. */
    filter: 'todos',
    /** J19.3: el espacio elegido para cada conjuro (por su id), en este turno. */
    slots: /** @type {Record<string, number>} */ ({}),
    /** De quién era el turno al abrirlo: si cambia, el menú se cierra. */
    turn: '',
    /** J12.18: la tarjeta con sus objetivos abiertos debajo (su `key`), o vacío. */
    unfold: '',
    /** J12.18: con el dedo, el objetivo tocado una vez (encendido; otro toque lo hace), o vacío. */
    armed: '',
};

/** Cómo se pulsó lo último del menú: con el dedo, el primer toque en un objetivo solo lo enciende. */
let lastPointer = '';

/** @typedef {(id: string, filter?: string, slots?: Record<string, number>) => MenuView|null} MenuMaker */

/** @type {{footer: HTMLElement|null, view: {bar: BarView, menu: MenuMaker}|null, handlers: BarHandlers|null}} */
const current = { footer: null, view: null, handlers: null };

/** Si los oyentes de la página ya están puestos. */
let listening = false;

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * @param {string} className
 * @returns {HTMLButtonElement}
 */
function button(className) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    return node;
}

/**
 * Un icono de Font Awesome (el que trae el juego).
 *
 * @param {string} name
 * @returns {HTMLElement}
 */
function icon(name) {
    const node = el('i', `fa-solid ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
}

/** Cerrar el menú abierto (y olvidar sus pasos). */
export function closeActionMenu() {
    if (!memory.open) return;
    memory.open = '';
    memory.steps = [];
    memory.unfold = '';
    memory.armed = '';
    clearAim();
    // J12.20: la cámara vuelve a donde estaba antes de apartarse para el muelle.
    resetNudge();
    current.footer?.querySelector('.gs-grimoire')?.remove();
    current.footer?.querySelectorAll('.gs-btn.active-menu').forEach(b => b.classList.remove('active-menu'));
    current.footer?.querySelectorAll('.gs-btn[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

/**
 * La lista que se ve ahora en el menú: la de arriba del todo, o la del último paso.
 *
 * @param {MenuView} menu
 * @returns {{title: string, items: MenuItem[], empty: string, sections: Array<{title: string, items: MenuItem[]}>}|null}
 */
function currentList(menu) {
    let sections = menu.sections;
    let title = menu.title;
    let empty = menu.empty ?? 'Nada que hacer aquí ahora.';
    for (const key of memory.steps) {
        // `@head`: lo de la cabecera (cambiar de arma), solo desde lo alto del menú.
        const atTop = sections === menu.sections;
        const from = key === '@head' ? null : sections.flatMap(s => s.items).find(item => item.key === key && item.next);
        const next = key === '@head' ? (atTop ? menu.headAction?.next : null) : from?.next;
        if (!next) return null;
        sections = [{ title: '', items: next.items }];
        title = next.title;
        empty = next.empty ?? 'No hay a quién.';
    }
    return { title, items: sections.flatMap(s => s.items), empty, sections };
}

/**
 * J12.18: lo que se ve de una lista, en orden: cada tarjeta y, si tiene sus objetivos abiertos,
 * ellos detrás (para las teclas 1 a 9 y sus números).
 *
 * @param {MenuItem[]} items
 * @returns {MenuItem[]}
 */
function visibleItems(items) {
    return (items || []).flatMap(item => (item.key === memory.unfold && unfolds(item) && item.enabled ? [item, ...(item.next?.items ?? [])] : [item]));
}

/**
 * J12.18: lo que vuelve a encenderse al salir de una opción: el objetivo tocado una vez con el
 * dedo, si lo hay; si no, nada.
 */
function restoreAim() {
    if (!memory.armed || !current.view || !memory.open) {
        clearAim();
        return;
    }
    const menu = current.view.menu(memory.open, memory.filter, memory.slots);
    const list = menu ? currentList(menu) : null;
    const armed = list ? visibleItems(list.items).find(i => i.key === memory.armed) : null;
    if (armed?.aim) showAim(armed.aim);
    else clearAim();
}

/**
 * J12.18: al pasar por una opción (con el ratón, o con el teclado), su gente se enciende en el
 * tablero; al salir, se apaga.
 *
 * @param {HTMLElement} node
 * @param {MenuItem} item
 */
function aimOnHover(node, item) {
    if (!item.aim) return;
    const aim = item.aim;
    node.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'touch') showAim(aim);
    });
    node.addEventListener('pointerleave', (event) => {
        if (event.pointerType !== 'touch') restoreAim();
    });
    node.addEventListener('focus', () => {
        if (keyboardInUse()) showAim(aim);
    });
    node.addEventListener('blur', () => {
        if (keyboardInUse()) restoreAim();
    });
}

/**
 * La vida de un objetivo, en una barra pequeña con sus números.
 *
 * @param {{hp: number, max: number}} meter
 * @returns {HTMLElement}
 */
function hpMeter(meter) {
    const pct = Math.max(0, Math.min(100, (meter.hp / Math.max(1, meter.max)) * 100));
    const box = el('span', `gs-card-hp${pct <= 50 ? ' gs-card-hp-low' : ''}`);
    box.setAttribute('role', 'meter');
    box.setAttribute('aria-label', 'Vida');
    box.setAttribute('aria-valuemin', '0');
    box.setAttribute('aria-valuemax', String(meter.max));
    box.setAttribute('aria-valuenow', String(meter.hp));
    const bar = el('span', 'gs-card-hp-bar');
    const fill = el('span', 'gs-card-hp-fill');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    box.append(bar, el('span', 'gs-card-hp-text', `${meter.hp}/${meter.max}`));
    return box;
}

/**
 * Las etiquetas de una tarjeta.
 *
 * @param {import('./action-menus.js').Badge[]} list
 * @param {string} className
 * @returns {HTMLElement|null}
 */
function badges(list, className) {
    if (!list || list.length === 0) return null;
    const box = el('span', className);
    for (const badge of list) box.appendChild(el('span', `gs-card-badge gs-badge-${badge.kind}`, badge.text));
    return box;
}

/**
 * Una tarjeta del grimorio: su icono (su dibujo si lo hay), su nombre con sus etiquetas, su
 * frase y, a la derecha, el daño, el alcance y lo que cuesta. Apagada, con el porqué escrito.
 *
 * @param {MenuItem} item
 * @param {number} number Su tecla (1 a 9), o 0.
 * @returns {HTMLElement}
 */
function card(item, number) {
    const isButton = item.kind !== 'weapon';
    const node = isButton ? button(`gs-card gs-spell-card${item.kind === 'target' ? ' gs-target gs-card-target' : ''}`) : el('div', 'gs-card gs-spell-card gs-card-weapon');
    node.dataset.pick = item.key;
    if (item.kind === 'target') node.dataset.target = item.key.split(':').pop() ?? '';
    if (isButton) {
        /** @type {HTMLButtonElement} */ (node).disabled = !item.enabled;
        node.setAttribute('role', 'menuitem');
    }
    if (item.reason) node.title = item.reason;
    else if (item.desc) node.title = item.desc;

    const glyph = el('span', `gs-card-glyph gs-tone-${item.tone || (item.kind === 'target' ? 'target' : 'action')}`);
    const art = item.art || '';
    if (art) {
        const img = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
        img.src = art;
        img.alt = '';
        img.loading = 'lazy';
        // Sin dibujo que cargue, su icono.
        img.addEventListener('error', () => {
            img.remove();
            glyph.appendChild(icon(item.icon || 'fa-circle'));
        }, { once: true });
        glyph.appendChild(img);
    } else {
        glyph.appendChild(icon(item.icon || 'fa-circle'));
    }
    if (number > 0) glyph.appendChild(el('kbd', 'gs-card-key', String(number)));
    node.appendChild(glyph);

    const body = el('span', 'gs-card-body');
    const name = el('span', 'gs-card-name');
    name.appendChild(el('span', 'gs-card-name-text', item.name));
    for (const tag of item.tags ?? []) name.appendChild(el('span', tag.kind === 'mastery' ? 'gs-tag-mastery' : tag.kind === 'dc' ? 'gs-tag-dc' : 'gs-tag-plain', tag.text));
    body.appendChild(name);
    // J12.18: un objetivo, con su vida en una barra.
    if (item.meter) body.appendChild(hpMeter(item.meter));
    if (item.desc) body.appendChild(el('span', 'gs-card-desc', item.desc));
    // J12.18: un área apuntada a él: a quién más pilla.
    if (item.caught) body.appendChild(el('span', 'gs-card-caught', item.caught));
    // Lo que impide usarla, escrito: con el dedo no hay ratón que pase por encima (J20.2).
    if (!item.enabled && item.reason) body.appendChild(el('span', 'gs-card-why', item.reason));
    // J12.18: con el dedo, tocado una vez: encendido en el tablero; otro toque lo hace.
    if (item.kind === 'target' && memory.armed === item.key && item.enabled) {
        node.classList.add('gs-card-armed');
        body.appendChild(el('span', 'gs-card-confirm', 'Toca otra vez para hacerlo'));
    }
    node.appendChild(body);

    const right = badges(item.badges ?? [], 'gs-card-badges');
    if (right) node.appendChild(right);
    if (item.next && item.enabled) {
        // J12.18: la que abre sus objetivos debajo lleva la flecha hacia abajo (o arriba, abierta).
        if (unfolds(item)) {
            const open = memory.unfold === item.key;
            node.appendChild(icon(`${open ? 'fa-chevron-up' : 'fa-chevron-down'} gs-card-more`));
            node.setAttribute('aria-expanded', String(open));
            node.classList.toggle('gs-card-open', open);
        } else {
            node.appendChild(icon('fa-chevron-right gs-card-more'));
        }
    }
    aimOnHover(node, item);
    return node;
}

/**
 * J19.3: los niveles de espacio con que lanzar un conjuro, debajo de su tarjeta (la tarjeta es
 * un botón: dentro no puede ir otro). Elegir uno repinta el menú con sus números.
 *
 * @param {NonNullable<MenuItem['levels']>} levels
 * @returns {HTMLElement}
 */
function levelRow(levels) {
    const row = el('div', 'gs-card-levels');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', 'Con qué espacio lanzarlo');
    row.appendChild(el('span', 'gs-card-levels-word', 'Espacio:'));
    for (const option of levels.options) {
        const chip = button(`gs-level-pill${option.active ? ' active' : ''}`);
        chip.textContent = option.label;
        chip.title = option.title;
        chip.dataset.slotLevel = String(option.level);
        chip.dataset.spell = levels.id;
        chip.setAttribute('role', 'radio');
        chip.setAttribute('aria-checked', String(option.active));
        chip.addEventListener('click', () => {
            memory.slots = { ...memory.slots, [levels.id]: option.level };
            paintMenu();
            // El foco, al nivel elegido (el menú se ha dibujado de nuevo).
            const again = /** @type {HTMLElement|null} */ (current.footer?.querySelector(`.gs-level-pill[data-spell="${CSS.escape(levels.id)}"][data-slot-level="${option.level}"]`) ?? null);
            again?.focus();
        });
        row.appendChild(chip);
    }
    return row;
}

/**
 * Pulsar una tarjeta: dentro de su paso siguiente, o hacer lo suyo.
 *
 * @param {MenuItem} item
 */
function activate(item) {
    const touch = lastPointer === 'touch';
    lastPointer = '';
    if (!item.enabled || item.kind === 'weapon') return;
    // J12.18: la lista de a quién se abre debajo de la tarjeta, en el mismo menú (otra vez, se
    // cierra); con el teclado, el foco va al primero que se puede elegir.
    if (item.next && unfolds(item)) {
        memory.unfold = memory.unfold === item.key ? '' : item.key;
        memory.armed = '';
        const first = memory.unfold ? (item.next?.items ?? []).find(i => i.enabled) : null;
        paintMenu(first ? first.key : item.key);
        return;
    }
    if (item.next) {
        memory.steps = [...memory.steps, item.key];
        memory.unfold = '';
        memory.armed = '';
        paintMenu();
        return;
    }
    if (!item.pick) return;
    // J12.18: con el dedo, el primer toque en un objetivo lo enciende en el tablero (y dice «Toca
    // otra vez»); el segundo lo hace.
    if (touch && item.kind === 'target' && memory.armed !== item.key) {
        memory.armed = item.key;
        paintMenu(item.key);
        return;
    }
    const pick = item.pick;
    const handlers = current.handlers;
    closeActionMenu();
    const after = handlers?.onPick(pick);
    // Cambiar de arma no gasta el turno: el menú de Atacar vuelve, con el arma nueva.
    if (after && after.keepOpen) {
        memory.open = after.keepOpen;
        memory.steps = [];
        memory.unfold = '';
        memory.armed = '';
        paintMenu();
    }
}

/**
 * J12.18: los objetivos de una tarjeta, debajo de ella (abiertos), con lo que se dice si no hay
 * ninguno.
 *
 * @param {MenuItem} item
 * @param {MenuItem[]} order Lo que se puede pulsar, en orden (para sus números).
 * @returns {HTMLElement}
 */
function unfoldedTargets(item, order) {
    const box = el('div', 'gs-card-unfold');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', item.next?.title ?? item.name);
    const list = item.next?.items ?? [];
    for (const target of list) {
        const index = order.indexOf(target);
        const node = card(target, cardKeyAt(index, ownKey()));
        node.addEventListener('click', () => activate(target));
        box.appendChild(node);
    }
    if (list.length === 0) box.appendChild(el('div', 'gs-grimoire-empty', item.next?.empty ?? 'No hay nadie a su alcance.'));
    return box;
}

/**
 * Lo alto que puede ser el menú sin cortarse por arriba: hasta la cabecera del juego, y nunca
 * más de 440 px. J12.20: solo para la hoja del teléfono; el muelle lo mide `dockPlace`.
 *
 * @param {HTMLElement} bar
 * @returns {number}
 */
function roomAbove(bar) {
    const top = bar.getBoundingClientRect().top;
    const head = headBottom();
    return Math.max(140, Math.min(440, Math.floor(top - head - 14)));
}

/** @returns {number} Dónde acaba la cabecera del juego (la pone game-shell). */
function headBottom() {
    return Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--gs-head-bottom')) || 0;
}

/** @returns {string} J12.20: la tecla del menú abierto (1 Atacar…), o vacío. */
function ownKey() {
    return String(current.view?.bar.buttons.find(b => b.id === memory.open)?.key ?? '');
}

/**
 * J12.20: el teléfono (de pie, o tumbado y poco alto): el muelle es una hoja que sube desde abajo.
 * Lo mismo que las reglas de combat-vtt.css.
 *
 * @returns {boolean}
 */
function sheetMode() {
    return typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 600px), (orientation: landscape) and (max-height: 500px) and (max-width: 1000px)').matches;
}

/** J12.20: lo que la cámara se ha apartado para el muelle (el contenido del tablero, y cuánto). */
const nudged = { /** @type {HTMLElement|null} */ el: null, x: 0, y: 0 };

/**
 * J12.20: la cámara vuelve a su sitio.
 *
 * @param {boolean} [closed] El muelle se ha cerrado: el resumen del teléfono vuelve también.
 */
function resetNudge(closed = true) {
    if (closed) delete document.documentElement.dataset.gsDock;
    const el = nudged.el;
    nudged.el = null;
    nudged.x = 0;
    nudged.y = 0;
    if (!el) return;
    el.style.translate = '';
    // La clase se va al acabar de volver: con ella, vuelve deslizándose.
    setTimeout(() => {
        if (nudged.el !== el) el.classList.remove('gs-dock-nudged');
    }, 400);
}

/**
 * J12.20: si el muelle (o la hoja del teléfono) tapa alguna ficha, la cámara se aparta lo justo
 * (`dockNudge`): el tablero se corre con `translate`, aparte de la vista de la cámara (que no
 * cambia: al cerrarse el muelle, vuelve). Importan quien juega y los objetivos del menú.
 *
 * @param {HTMLElement} box El muelle.
 * @param {'x'|'y'} axis
 * @param {Set<string>} keys Las fichas que importan (`data-token-id`).
 */
function nudgeBoard(box, axis, keys) {
    const content = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .wm-vtt .wm-container .wm-content'));
    const container = content?.closest('.wm-container');
    if (!content || !container) {
        resetNudge(false);
        return;
    }
    // Lo apartado antes no cuenta: se mide como si la cámara estuviera en su sitio.
    const was = nudged.el === content ? { x: nudged.x, y: nudged.y } : { x: 0, y: 0 };
    const board = container.getBoundingClientRect();
    const view = { left: board.left, top: board.top, right: board.right, bottom: board.bottom };
    // La columna de la derecha (la iniciativa, el resumen) también tapa: se mira lo de su izquierda.
    const column = document.querySelector('#game-shell .vtt-top-right')?.getBoundingClientRect();
    if (axis === 'x' && column && column.width > 0 && column.left > board.left + board.width / 2) view.right = Math.min(view.right, column.left - 8);
    // En el teléfono, las islas de arriba tapan por arriba.
    if (axis === 'y') {
        for (const part of document.querySelectorAll('#game-shell .vtt-top-left, #game-shell .vtt-top-right, #game-shell .vtt-top-center')) {
            const r = part.getBoundingClientRect();
            if (r.height > 0 && r.top < board.top + board.height / 2) view.top = Math.max(view.top, r.bottom + 6);
        }
    }
    const tokens = [...container.querySelectorAll('.wm-token[data-token-id]')].map((token) => {
        const r = token.getBoundingClientRect();
        return {
            left: r.left - was.x, right: r.right - was.x, top: r.top - was.y, bottom: r.bottom - was.y,
            key: keys.has(String(/** @type {HTMLElement} */ (token).dataset.tokenId)) || token.classList.contains('wm-token-active'),
        };
    }).filter(t => t.right > t.left);
    // Dónde queda el muelle, sin lo que lo mueve al entrar (se desliza desde la izquierda o sube):
    // su sitio en el pie. En el teléfono tumbado la hoja va centrada con `transform`: sus lados, los
    // que se ven.
    const foot = /** @type {HTMLElement} */ (current.footer).getBoundingClientRect();
    const seen = box.getBoundingClientRect();
    const top = foot.top + box.offsetTop;
    const left = axis === 'x' ? foot.left + box.offsetLeft : seen.left;
    const width = axis === 'x' ? box.offsetWidth : seen.width;
    const dockBox = { left, top, right: left + width, bottom: top + box.offsetHeight };
    const shift = dockNudge({ dock: dockBox, view, tokens, axis });
    const x = axis === 'x' ? Math.round(shift) : 0;
    const y = axis === 'y' ? Math.round(shift) : 0;
    if (x === 0 && y === 0) {
        if (nudged.el === content) resetNudge(false);
        return;
    }
    if (nudged.el && nudged.el !== content) resetNudge(false);
    content.classList.add('gs-dock-nudged');
    content.style.translate = `${x}px ${y}px`;
    nudged.el = content;
    nudged.x = x;
    nudged.y = y;
}

/**
 * J12.20: el muelle en su sitio. En pantalla grande, a la izquierda encima del minimapa
 * (`dockPlace`, en coordenadas del pie, que es donde vive); en el teléfono, la hoja que sube. Y la
 * cámara, apartada si hace falta.
 *
 * @param {HTMLElement} box
 * @param {HTMLElement|null} bar
 * @param {Set<string>} keys Las fichas que importan (los objetivos del menú).
 */
function placeDock(box, bar, keys) {
    const footer = current.footer;
    if (!footer) return;
    if (sheetMode()) {
        box.dataset.dock = 'sheet';
        // Mientras sube la hoja, el resumen del combate se pliega (combat-vtt.css): el tablero
        // tiene que verse encima de ella.
        document.documentElement.dataset.gsDock = 'sheet';
        const room = bar ? roomAbove(bar) : 440;
        box.style.maxHeight = `${Math.max(140, Math.min(room, Math.round(window.innerHeight * DOCK.sheetShare)))}px`;
        nudgeBoard(box, 'y', keys);
        return;
    }
    const boardNode = document.querySelector('#game-shell .gs-scene-map .wm-container') ?? document.querySelector('#game-shell .gs-scene-map') ?? document.querySelector('#game-shell .gs-stage');
    const board = boardNode?.getBoundingClientRect();
    if (!board || board.width < 200 || board.height < 200) {
        // Sin tablero que medir, como antes: encima de la barra.
        if (bar) box.style.maxHeight = `${roomAbove(bar)}px`;
        return;
    }
    const camera = document.querySelector('#game-shell .vtt-camera')?.getBoundingClientRect() ?? null;
    const place = dockPlace({ board, head: headBottom(), viewportH: window.innerHeight, camera: camera && camera.width > 0 && camera.height > 0 ? camera : null });
    const foot = footer.getBoundingClientRect();
    box.dataset.dock = 'left';
    document.documentElement.dataset.gsDock = 'left';
    box.style.left = `${Math.round(place.left - foot.left)}px`;
    box.style.bottom = `${Math.round(foot.bottom - place.bottom)}px`;
    box.style.maxHeight = `${Math.round(place.maxHeight)}px`;
    nudgeBoard(box, 'x', keys);
}

/**
 * Dibujar (o redibujar) el menú abierto, con el paso en que esté.
 *
 * @param {string} [focusKey] J12.18: la opción que se queda con el foco (la que se acaba de abrir).
 */
function paintMenu(focusKey = '') {
    const footer = current.footer;
    const view = current.view;
    footer?.querySelector('.gs-grimoire')?.remove();
    if (!footer || !view || !memory.open) {
        resetNudge();
        return;
    }
    const menu = view.menu(memory.open, memory.filter, memory.slots);
    if (!menu) {
        memory.open = '';
        return;
    }
    const list = currentList(menu);
    if (!list) {
        memory.steps = [];
        paintMenu();
        return;
    }

    // J12.20: el muelle táctico (`gs-dock`): a la izquierda, o la hoja del teléfono.
    const box = el('div', 'gs-targets gs-grimoire gs-dock');
    box.dataset.menu = menu.id;
    box.setAttribute('role', 'menu');
    box.setAttribute('aria-label', list.title);
    // Pulsar dentro no es pulsar el mapa. J12.18: y se apunta si fue con el dedo.
    box.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        lastPointer = event.pointerType || '';
    });
    box.addEventListener('keydown', () => { lastPointer = ''; });

    const head = el('div', 'gs-grimoire-head');
    if (memory.steps.length > 0) {
        const back = button('gs-grimoire-back');
        back.appendChild(icon('fa-arrow-left'));
        back.appendChild(el('span', '', ' Atrás'));
        back.title = 'Volver (Esc)';
        back.addEventListener('click', () => {
            memory.steps = memory.steps.slice(0, -1);
            memory.unfold = '';
            memory.armed = '';
            paintMenu();
        });
        head.appendChild(back);
    }
    const title = el('div', 'gs-grimoire-title');
    title.appendChild(icon(menu.icon));
    title.appendChild(el('span', '', list.title));
    head.appendChild(title);

    if (memory.steps.length === 0 && menu.gems && menu.gems.length > 0) {
        const gems = el('div', 'gs-slot-counter');
        gems.title = 'Los espacios de conjuro que te quedan';
        gems.appendChild(el('span', 'gs-slot-word', 'Espacios'));
        for (const gem of menu.gems) {
            const group = el('span', 'gs-slot-group');
            group.appendChild(el('span', 'gs-slot-level', `N${gem.level}`));
            const row = el('span', 'gs-slot-gems');
            for (let i = 0; i < gem.max; i++) row.appendChild(icon(i < gem.left ? 'fa-diamond' : 'fa-diamond gs-slot-gem-spent'));
            group.setAttribute('aria-label', `Nivel ${gem.level}: quedan ${gem.left} de ${gem.max}`);
            group.appendChild(row);
            gems.appendChild(group);
        }
        head.appendChild(gems);
    }
    if (memory.steps.length === 0 && menu.headAction) {
        const action = button('gs-filter-pill gs-head-action');
        action.dataset.pick = '@head';
        action.appendChild(icon(menu.headAction.icon));
        action.appendChild(el('span', '', ` ${menu.headAction.label}`));
        action.disabled = !menu.headAction.enabled;
        action.title = menu.headAction.enabled ? 'Cambiar el arma que llevas, sin gastar nada' : menu.headAction.reason;
        action.addEventListener('click', () => {
            memory.steps = ['@head'];
            paintMenu();
        });
        head.appendChild(action);
    }
    const close = button('gs-targets-close');
    close.setAttribute('aria-label', 'Cerrar');
    close.title = 'Cerrar (Esc)';
    close.appendChild(icon('fa-xmark'));
    close.addEventListener('click', () => closeActionMenu());
    head.appendChild(close);
    box.appendChild(head);

    if (memory.steps.length === 0 && menu.filters && menu.filters.length > 1) {
        const tabs = el('div', 'gs-filter-tabs');
        tabs.setAttribute('role', 'tablist');
        for (const filter of menu.filters) {
            const tab = button(`gs-filter-pill${filter.active ? ' active' : ''}`);
            tab.textContent = filter.label;
            tab.dataset.filter = filter.id;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(filter.active));
            tab.addEventListener('click', () => {
                memory.filter = filter.id;
                memory.unfold = '';
                memory.armed = '';
                paintMenu();
            });
            tabs.appendChild(tab);
        }
        box.appendChild(tabs);
    }

    const body = el('div', 'gs-grimoire-body');
    // J12.18: si la tarjeta abierta ya no está (o se ha apagado), se cierra.
    const unfolded = list.items.find(i => i.key === memory.unfold && i.enabled && unfolds(i));
    if (!unfolded) memory.unfold = '';
    const order = pickable(visibleItems(list.items));
    if (memory.armed && !order.some(i => i.key === memory.armed)) memory.armed = '';
    let shown = 0;
    for (const section of list.sections) {
        if (section.items.length === 0) continue;
        if (section.title) body.appendChild(el('div', 'gs-grimoire-section', section.title));
        for (const item of section.items) {
            const index = order.indexOf(item);
            const node = card(item, cardKeyAt(index, ownKey()));
            if (item.kind !== 'weapon') node.addEventListener('click', () => activate(item));
            body.appendChild(node);
            if (item.levels) body.appendChild(levelRow(item.levels));
            if (item === unfolded) body.appendChild(unfoldedTargets(item, order));
            shown++;
        }
    }
    if (shown === 0) body.appendChild(el('div', 'gs-grimoire-empty', list.empty));
    box.appendChild(body);

    const bar = /** @type {HTMLElement|null} */ (footer.querySelector('.gs-vtt-bar'));
    footer.insertBefore(box, footer.firstChild);
    // J12.20: en su sitio, y la cámara apartada si tapa a quien juega o a sus objetivos.
    const keys = new Set(visibleItems(list.items).flatMap(i => [...(i.aim?.marks ?? []), ...(i.next?.items ?? []).flatMap(t => t.aim?.marks ?? [])])
        .map(m => (m.token === undefined || m.token === null ? '' : String(m.token))).filter(Boolean));
    placeDock(box, bar, keys);
    footer.querySelectorAll('.gs-btn[data-menu]').forEach(b => {
        const on = /** @type {HTMLElement} */ (b).dataset.menu === memory.open;
        b.classList.toggle('active-menu', on);
        b.setAttribute('aria-expanded', String(on));
    });
    // J12.18: lo tocado una vez con el dedo sigue encendido en el tablero; lo demás, apagado (con
    // el teclado, se enciende lo que coge el foco, aquí debajo).
    restoreAim();
    // J15.5: el foco, a la primera que se puede pulsar; al cerrarlo, vuelve al botón.
    focusList(box);
    // J12.18: o a la que se acaba de abrir (o al primero de sus objetivos).
    if (focusKey) {
        const again = /** @type {HTMLElement|null} */ (box.querySelector(`[data-pick="${CSS.escape(focusKey)}"]`));
        if (again) focusOn(again);
    }
}

/**
 * Abrir un menú (o cerrarlo, si ya estaba abierto).
 *
 * @param {string} id
 */
export function toggleActionMenu(id) {
    if (memory.open === id) {
        closeActionMenu();
        return;
    }
    memory.open = id;
    memory.steps = [];
    memory.unfold = '';
    memory.armed = '';
    paintMenu();
}

/**
 * Lo que se hace con una tecla de número: con el menú abierto, la tarjeta de ese número; con
 * él cerrado, el menú de ese número.
 *
 * @param {number} n
 * @returns {boolean} Si la tecla era suya.
 */
function pressNumber(n) {
    const view = current.view;
    if (!view || !view.bar.isPlayerTurn) return false;
    if (memory.open) {
        // J12.20: la tecla del propio muelle lo cierra, como volver a pulsar su botón; el foco
        // vuelve a él.
        const own = ownKey();
        if (own && String(n) === own) {
            const id = memory.open;
            closeActionMenu();
            const again = /** @type {HTMLElement|null} */ (current.footer?.querySelector(`.gs-btn[data-menu="${CSS.escape(id)}"]`) ?? null);
            if (again && keyboardInUse()) focusOn(again);
            return true;
        }
        const menu = view.menu(memory.open, memory.filter, memory.slots);
        const list = menu ? currentList(menu) : null;
        // J12.18: con los objetivos de una tarjeta abiertos debajo, también ellos llevan número.
        const item = list ? pickable(visibleItems(list.items))[cardKeys(own).indexOf(n)] : null;
        if (!item) return true;
        lastPointer = '';
        activate(item);
        return true;
    }
    const menuButton = view.bar.buttons.find(b => b.key === String(n));
    if (!menuButton || !menuButton.enabled) return false;
    toggleActionMenu(menuButton.id);
    return true;
}

/**
 * Los oyentes de la página: teclas y pulsar fuera (el mapa) para cerrar. Se ponen una vez.
 */
function listen() {
    if (listening) return;
    listening = true;
    document.addEventListener('keydown', (event) => {
        const footer = current.footer;
        if (!footer || !footer.isConnected || !footer.querySelector('.gs-vtt-bar')) return;
        const target = /** @type {HTMLElement|null} */ (event.target);
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        if (document.querySelector('dialog[open], .tc-overlay, .wm-dice-overlay.active, .gs-keys') || document.body.classList.contains('game-shell-paused')) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        // J12.18: Esc con los objetivos de una tarjeta abiertos: se cierran, y el foco vuelve a ella.
        if ((event.key === 'Escape' || event.key === 'Backspace') && memory.open && memory.unfold) {
            event.preventDefault();
            event.stopPropagation();
            const key = memory.unfold;
            memory.unfold = '';
            memory.armed = '';
            paintMenu(key);
            return;
        }
        // Esc dentro de un paso: un paso atrás. En lo alto del menú lo cierra el teclado del juego.
        if (event.key === 'Escape' && memory.open && memory.steps.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            memory.steps = memory.steps.slice(0, -1);
            memory.armed = '';
            paintMenu();
            return;
        }
        if (event.key === 'Backspace' && memory.open && memory.steps.length > 0) {
            event.preventDefault();
            memory.steps = memory.steps.slice(0, -1);
            memory.armed = '';
            paintMenu();
            return;
        }
        if (!/^[1-9]$/.test(event.key)) return;
        // Con conexión, 1, 2 y 3 cambian de escena: solo son de la barra con el foco en ella.
        const offline = Boolean(footer.closest('.gs-offline'));
        const inside = Boolean(target && footer.contains(target));
        if (!memory.open && !offline && !inside) return;
        if (pressNumber(Number(event.key))) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
    // Pulsar el mapa (o cualquier sitio fuera de la barra y su menú) cierra el menú, y ese
    // toque no cuenta como un toque en el tablero: no se anda por accidente.
    document.addEventListener('pointerdown', (event) => {
        const footer = current.footer;
        if (!memory.open || !footer || !footer.isConnected) return;
        const target = /** @type {Node|null} */ (event.target);
        if (target && footer.contains(target)) return;
        if (target instanceof Element && target.closest('dialog, .popup, .tc-overlay, .wm-dice-overlay, #toast-container')) return;
        closeActionMenu();
        const onBoard = target instanceof Element && target.closest('.wm-container');
        if (!onBoard) return;
        const swallow = (/** @type {MouseEvent} */ click) => {
            click.stopPropagation();
            click.preventDefault();
        };
        document.addEventListener('click', swallow, { capture: true, once: true });
        // Si no llega el clic (se arrastró el mapa), que no se coma el siguiente.
        setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 600);
    }, true);
    // J12.20: al cambiar el tamaño de la ventana (o girar el teléfono), el muelle abierto se
    // vuelve a poner en su sitio.
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            if (memory.open && current.footer?.isConnected) paintMenu();
        }, 120);
    });
}

/**
 * Dibujar la barra en el pie del juego.
 *
 * @param {HTMLElement} footer `.gs-actions`
 * @param {{bar: BarView, menu: MenuMaker}} view
 * @param {BarHandlers} handlers
 */
export function renderCombatActionBar(footer, view, handlers) {
    listen();
    current.footer = footer;
    current.view = view;
    current.handlers = handlers;
    const bar = view.bar;
    // Otro turno, otro menú: lo abierto era del de antes.
    const turnKey = `${bar.turnLabel}|${bar.isPlayerTurn}`;
    if (turnKey !== memory.turn) {
        memory.turn = turnKey;
        memory.slots = {};
        memory.open = '';
        memory.steps = [];
        memory.unfold = '';
        memory.armed = '';
        clearAim();
    }
    if (!bar.isPlayerTurn) {
        memory.open = '';
        memory.steps = [];
        memory.unfold = '';
        memory.armed = '';
    }

    footer.textContent = '';
    footer.classList.add('gs-actions-vtt');
    const root = el('div', 'gs-vtt-bar gs-actions-hud');
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Tu turno');
    root.classList.toggle('gs-vtt-waiting', !bar.isPlayerTurn);

    const status = el('div', 'gs-actions-status');
    status.appendChild(el('div', 'gs-turn-label', bar.turnLabel));
    const pills = el('div', 'gs-budget-pills');
    for (const pill of bar.pills) {
        const node = el('span', `gs-pill gs-pill-${pill.id}${pill.ready ? ' ready' : ' spent'}`, pill.label);
        node.title = pill.title;
        node.setAttribute('aria-label', pill.title);
        pills.appendChild(node);
    }
    status.appendChild(pills);
    const moveRow = el('div', 'gs-move-container');
    if (bar.move) {
        const move = el('span', 'gs-move-label');
        move.appendChild(icon('fa-person-walking'));
        move.appendChild(el('span', '', ` ${bar.move}`));
        move.title = 'Lo que te queda de movimiento este turno';
        moveRow.appendChild(move);
    }
    if (bar.isPlayerTurn) {
        const prone = button(`gs-prone-toggle${bar.prone.on ? ' active' : ''}`);
        prone.dataset.pick = bar.prone.pick;
        prone.appendChild(icon(bar.prone.on ? 'fa-person-arrow-up-from-line' : 'fa-person-falling'));
        prone.appendChild(el('span', '', ` ${bar.prone.label}`));
        prone.title = bar.prone.title;
        prone.disabled = !bar.prone.enabled;
        prone.setAttribute('aria-pressed', String(bar.prone.on));
        prone.addEventListener('click', () => {
            closeActionMenu();
            handlers.onPick(bar.prone.pick);
        });
        moveRow.appendChild(prone);
    }
    status.appendChild(moveRow);
    root.appendChild(status);

    const buttons = el('div', 'gs-actions-buttons');
    for (const spec of bar.buttons) {
        const node = button(`gs-btn gs-btn-${spec.id}${spec.id === 'atacar' ? ' gs-btn-attack' : ''}${spec.id === 'adicional' ? ' gs-btn-bonus' : ''}${spec.id === 'flee' ? ' gs-btn-quiet' : ''}`);
        node.appendChild(icon(spec.icon));
        node.appendChild(el('span', 'gs-btn-label', spec.label));
        if (spec.key) node.appendChild(el('kbd', 'gs-btn-key', spec.key));
        node.disabled = !spec.enabled;
        node.title = spec.title;
        if (['atacar', 'magia', 'acciones', 'adicional'].includes(spec.id)) {
            node.dataset.menu = spec.id;
            node.setAttribute('aria-haspopup', 'menu');
            node.setAttribute('aria-expanded', String(memory.open === spec.id));
            node.classList.toggle('active-menu', memory.open === spec.id);
            node.addEventListener('click', () => toggleActionMenu(spec.id));
        } else if (spec.id === 'end') {
            node.addEventListener('click', () => {
                closeActionMenu();
                handlers.onEndTurn();
            });
        } else if (spec.id === 'flee') {
            node.addEventListener('click', () => {
                closeActionMenu();
                handlers.onFlee();
            });
        }
        buttons.appendChild(node);
        // Idea 18: el turno de un compañero, que lo juegue la máquina con su postura.
        if (spec.id === 'adicional' && bar.canAuto && handlers.onAutoTurn) {
            const auto = button('gs-btn gs-btn-auto');
            auto.appendChild(icon('fa-robot'));
            auto.appendChild(el('span', 'gs-btn-label', 'Que actúe solo'));
            auto.title = 'Juega su turno con la postura y la preferencia de su ficha';
            auto.addEventListener('click', () => {
                closeActionMenu();
                handlers.onAutoTurn?.();
            });
            buttons.appendChild(auto);
        }
    }
    root.appendChild(buttons);
    footer.appendChild(root);
    if (memory.open) paintMenu();
    else resetNudge();
}

/**
 * Quitar la barra nueva del pie (al salir de la pelea): el pie vuelve a ser el de siempre.
 *
 * @param {HTMLElement} footer
 */
export function releaseCombatActionBar(footer) {
    footer.classList.remove('gs-actions-vtt');
    if (current.footer === footer) {
        memory.open = '';
        memory.steps = [];
        memory.unfold = '';
        memory.armed = '';
        clearAim();
        resetNudge();
        current.footer = null;
        current.view = null;
        current.handlers = null;
    }
}

/** Para las pruebas: el estado del menú. */
export function actionMenuState() {
    return { open: memory.open, steps: [...memory.steps], filter: memory.filter, slots: { ...memory.slots }, unfold: memory.unfold, armed: memory.armed };
}
