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
 */

import { focusList } from '../keyboard-nav.js';
import { pickable } from './action-menus.js';

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
    /** De quién era el turno al abrirlo: si cambia, el menú se cierra. */
    turn: '',
};

/** @type {{footer: HTMLElement|null, view: {bar: BarView, menu: (id: string, filter?: string) => MenuView|null}|null, handlers: BarHandlers|null}} */
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
    if (item.desc) body.appendChild(el('span', 'gs-card-desc', item.desc));
    // Lo que impide usarla, escrito: con el dedo no hay ratón que pase por encima (J20.2).
    if (!item.enabled && item.reason) body.appendChild(el('span', 'gs-card-why', item.reason));
    node.appendChild(body);

    const right = badges(item.badges ?? [], 'gs-card-badges');
    if (right) node.appendChild(right);
    if (item.next && item.enabled) node.appendChild(icon('fa-chevron-right gs-card-more'));
    return node;
}

/**
 * Pulsar una tarjeta: dentro de su paso siguiente, o hacer lo suyo.
 *
 * @param {MenuItem} item
 */
function activate(item) {
    if (!item.enabled || item.kind === 'weapon') return;
    if (item.next) {
        memory.steps = [...memory.steps, item.key];
        paintMenu();
        return;
    }
    if (!item.pick) return;
    const pick = item.pick;
    const handlers = current.handlers;
    closeActionMenu();
    const after = handlers?.onPick(pick);
    // Cambiar de arma no gasta el turno: el menú de Atacar vuelve, con el arma nueva.
    if (after && after.keepOpen) {
        memory.open = after.keepOpen;
        memory.steps = [];
        paintMenu();
    }
}

/**
 * Lo alto que puede ser el menú sin cortarse por arriba: hasta la cabecera del juego, y nunca
 * más de 440 px.
 *
 * @param {HTMLElement} bar
 * @returns {number}
 */
function roomAbove(bar) {
    const top = bar.getBoundingClientRect().top;
    const head = Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--gs-head-bottom')) || 0;
    return Math.max(140, Math.min(440, Math.floor(top - head - 14)));
}

/** Dibujar (o redibujar) el menú abierto, con el paso en que esté. */
function paintMenu() {
    const footer = current.footer;
    const view = current.view;
    footer?.querySelector('.gs-grimoire')?.remove();
    if (!footer || !view || !memory.open) return;
    const menu = view.menu(memory.open, memory.filter);
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

    const box = el('div', 'gs-targets gs-grimoire');
    box.dataset.menu = menu.id;
    box.setAttribute('role', 'menu');
    box.setAttribute('aria-label', list.title);
    // Pulsar dentro no es pulsar el mapa.
    box.addEventListener('pointerdown', event => event.stopPropagation());

    const head = el('div', 'gs-grimoire-head');
    if (memory.steps.length > 0) {
        const back = button('gs-grimoire-back');
        back.appendChild(icon('fa-arrow-left'));
        back.appendChild(el('span', '', ' Atrás'));
        back.title = 'Volver (Esc)';
        back.addEventListener('click', () => {
            memory.steps = memory.steps.slice(0, -1);
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
                paintMenu();
            });
            tabs.appendChild(tab);
        }
        box.appendChild(tabs);
    }

    const body = el('div', 'gs-grimoire-body');
    const order = pickable(list.items);
    let shown = 0;
    for (const section of list.sections) {
        if (section.items.length === 0) continue;
        if (section.title) body.appendChild(el('div', 'gs-grimoire-section', section.title));
        for (const item of section.items) {
            const index = order.indexOf(item);
            const node = card(item, index >= 0 && index < 9 ? index + 1 : 0);
            if (item.kind !== 'weapon') node.addEventListener('click', () => activate(item));
            body.appendChild(node);
            shown++;
        }
    }
    if (shown === 0) body.appendChild(el('div', 'gs-grimoire-empty', list.empty));
    box.appendChild(body);

    const bar = /** @type {HTMLElement|null} */ (footer.querySelector('.gs-vtt-bar'));
    footer.insertBefore(box, footer.firstChild);
    if (bar) box.style.maxHeight = `${roomAbove(bar)}px`;
    footer.querySelectorAll('.gs-btn[data-menu]').forEach(b => {
        const on = /** @type {HTMLElement} */ (b).dataset.menu === memory.open;
        b.classList.toggle('active-menu', on);
        b.setAttribute('aria-expanded', String(on));
    });
    // J15.5: el foco, a la primera que se puede pulsar; al cerrarlo, vuelve al botón.
    focusList(box);
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
        const menu = view.menu(memory.open, memory.filter);
        const list = menu ? currentList(menu) : null;
        const item = list ? pickable(list.items)[n - 1] : null;
        if (!item) return true;
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
        // Esc dentro de un paso: un paso atrás. En lo alto del menú lo cierra el teclado del juego.
        if (event.key === 'Escape' && memory.open && memory.steps.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            memory.steps = memory.steps.slice(0, -1);
            paintMenu();
            return;
        }
        if (event.key === 'Backspace' && memory.open && memory.steps.length > 0) {
            event.preventDefault();
            memory.steps = memory.steps.slice(0, -1);
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
}

/**
 * Dibujar la barra en el pie del juego.
 *
 * @param {HTMLElement} footer `.gs-actions`
 * @param {{bar: BarView, menu: (id: string, filter?: string) => MenuView|null}} view
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
        memory.open = '';
        memory.steps = [];
    }
    if (!bar.isPlayerTurn) {
        memory.open = '';
        memory.steps = [];
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
        current.footer = null;
        current.view = null;
        current.handlers = null;
    }
}

/** Para las pruebas: el estado del menú. */
export function actionMenuState() {
    return { open: memory.open, steps: [...memory.steps], filter: memory.filter };
}
