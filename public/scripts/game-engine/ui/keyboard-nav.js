/**
 * J15.5 de ROADMAP_SIN_CONEXION: el juego sin conexión, con el teclado solo.
 *
 * Lo que hace falta para jugar sin ratón, en un sitio:
 *
 * - **Flechas en las listas**: en una fila de fichas, en un menú o en una rejilla de tarjetas,
 *   las flechas pasan a la de al lado (la de arriba, la de abajo…); Inicio y Fin, a la primera
 *   y a la última. Tab sigue pasando de un grupo a otro, como siempre.
 * - **Tab en círculo dentro de una ventana**: con una ventana delante, el foco no se escapa a
 *   la página de detrás ni a la barra del navegador.
 * - **El foco vuelve**: al cerrar una ventana o una lista, el foco vuelve a lo que la abrió; si
 *   eso ya no está, a lo principal de la escena (la ficha «Continuar», «Atacar»…). Y cuando el
 *   juego se redibuja, el foco sigue en el mismo botón.
 * - **Esc cierra lo de encima** (`closeTopOverlay`): los dados, la tarjeta de un enemigo, una
 *   lista abierta sobre la barra de combate o la chuleta. Las ventanas (`<dialog>`) se cierran
 *   solas con Esc; y sin nada delante, Esc abre la pausa (`game-shell.js`).
 *
 * Lo que es cálculo (qué vecino toca con cada flecha, cómo se reconoce un botón después de
 * redibujarlo, el contraste de dos colores) es puro y tiene sus pruebas. Lo demás toca la
 * página, y lo prueba `tools/e2e-teclado.mjs`, jugando con el teclado solo.
 *
 * Nada se hace al importar: el juego llama a `installKeyboard` al abrirse.
 */

/** Lo que recibe el foco con Tab. */
export const FOCUSABLE = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'summary',
].join(', ');

/** Lo que es una opción de una lista: lo que se elige con las flechas y se pulsa con Intro. */
export const ITEM = [
    'button:not([disabled])',
    'a[href]',
    '[role="button"][tabindex]:not([tabindex="-1"])',
    '[role="option"]',
    '[role="menuitem"]',
    '[role="radio"]',
    '[role="tab"]',
].join(', ');

/**
 * Las listas por las que se anda con las flechas aunque sus opciones no sean hermanas (una
 * rejilla de tarjetas con cosas dentro, una barra con grupos). Fuera de estas, vale el padre
 * directo de la opción si tiene dos o más: una fila de botones es una lista.
 */
export const ARROW_LISTS = [
    '.gs-menu',
    '.gs-saves',
    '.gs-pause-card',
    '.gs-vn-box > .gs-chips',
    '.gs-actions',
    '.gs-targets',
    '.gs-guide',
    '.gs-places',
    '.hc-options',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="radiogroup"]',
    '[role="toolbar"]',
    '[role="tablist"]',
    '[data-arrows]',
].join(', ');

/**
 * Donde las flechas son de otro: al escribir, en un desplegable, en una barra deslizante, en el
 * tablero (que mueve su propio cursor, `board-keys.js`) o donde se diga `data-arrows="off"`.
 */
const OWN_ARROWS = 'input, textarea, select, [contenteditable="true"], .wm-container, [data-arrows="off"]';

/**
 * Lo que va encima de todo sin ser una ventana (`<dialog>`), de lo más alto a lo más bajo: Esc
 * lo cierra antes que nada, y Tab no sale de ello mientras esté.
 */
export const OVERLAYS = [
    { selector: '.gs-keys', close: 'remove' },
    { selector: '.wm-dice-overlay.active', close: '.wm-dice-next' },
    { selector: '.tc-overlay', close: '.tc-close' },
    { selector: '.gs-targets', close: '.gs-targets-close' },
];

/** Lo principal de cada escena, en orden: a donde va el foco cuando se pierde. */
export const PRIMARY_TARGETS = [
    '.wm-dice-overlay.active .wm-dice-next',
    '.tc-overlay .tc-card button',
    '.gs-root .gs-pause-card button',
    '.gs-root .gs-vn-box .gs-chip-continue',
    '.gs-root[data-scene="dialogue"] .gs-vn-box .gs-chip-action',
    '.gs-root .gs-actions .gs-btn-attack',
    '.gs-root .gs-actions button',
    '.gs-root .gs-places button',
    '.gs-root .gs-menu button',
    '.gs-root .gs-scene-map .wm-container',
    '.gs-root button',
];

// ---------------------------------------------------------------- lo que es cálculo

/**
 * @typedef {Object} Box Dónde está algo en pantalla.
 * @property {number} x Izquierda.
 * @property {number} y Arriba.
 * @property {number} w Ancho.
 * @property {number} h Alto.
 */

/** Las teclas que mueven por una lista. */
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

/**
 * La opción a la que se pasa con una tecla, desde `index`, en una lista de cajas en pantalla.
 *
 * Arriba y abajo buscan la más cercana en esa dirección (en una rejilla, la de encima; en una
 * lista, la siguiente); izquierda y derecha, igual de lado. Si no hay ninguna en esa dirección,
 * se sigue por el orden de la lista y se da la vuelta: abajo y derecha, la siguiente; arriba e
 * izquierda, la anterior. Inicio y Fin, la primera y la última.
 *
 * @param {Box[]} boxes
 * @param {number} index
 * @param {string} key
 * @returns {number} El índice elegido, o `index` si no se mueve.
 */
export function pickNeighbour(boxes, index, key) {
    const n = boxes.length;
    if (n === 0 || index < 0 || index >= n) return index;
    if (key === 'Home') return 0;
    if (key === 'End') return n - 1;
    const here = boxes[index];
    const cx = here.x + here.w / 2;
    const cy = here.y + here.h / 2;
    const vertical = key === 'ArrowUp' || key === 'ArrowDown';
    const sign = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < n; i++) {
        if (i === index) continue;
        const box = boxes[i];
        const bx = box.x + box.w / 2;
        const by = box.y + box.h / 2;
        // Lo que avanza en la dirección pedida, y lo que se aparta de ella.
        const ahead = vertical ? (by - cy) * sign : (bx - cx) * sign;
        const aside = vertical ? Math.abs(bx - cx) : Math.abs(by - cy);
        // Hay que avanzar de verdad: más de la mitad de lo que mide (una fila, una columna).
        const step = vertical ? Math.min(here.h, box.h) / 2 : Math.min(here.w, box.w) / 2;
        if (ahead <= step) continue;
        // De lado, solo lo de la misma fila (se solapan en alto); arriba y abajo, cualquiera.
        if (!vertical && (box.y >= here.y + here.h || box.y + box.h <= here.y)) continue;
        const score = ahead + aside * 2;
        if (score < bestScore) {
            bestScore = score;
            best = i;
        }
    }
    if (best >= 0) return best;
    return (index + sign + n) % n;
}

/**
 * @typedef {Object} FocusFacts Lo que se mira de un botón para reconocerlo tras redibujarlo.
 * @property {string} tag
 * @property {Record<string, string>} [data] Sus `data-*`.
 * @property {string} [id]
 * @property {string} [label] `aria-label`.
 * @property {string} [title]
 * @property {string} [text]
 * @property {string[]} [classes]
 */

/** Los `data-*` que dicen qué es un botón del juego, en orden de confianza. */
const KEY_DATA = ['chip', 'next', 'place', 'action', 'pick', 'value', 'toggle', 'game', 'world', 'scene', 'kind', 'result', 'id', 'x', 'y'];

/**
 * Una llave para reconocer el mismo botón después de redibujar: lo que dice qué es (su
 * `data-chip`, su `id`…), y si no lo dice nada, sus clases y su texto.
 *
 * @param {FocusFacts} facts
 * @returns {string}
 */
export function focusKeyFrom(facts) {
    const data = facts.data ?? {};
    const marks = KEY_DATA.filter(k => data[k] !== undefined && data[k] !== '').map(k => `${k}=${data[k]}`);
    const classes = (facts.classes ?? []).filter(c => !/^(active|on|is-on|selected|focus|hover|disabled|current|interactable)$/.test(c)).sort().join('.');
    if (facts.id) return `${facts.tag}#${facts.id}`;
    const words = String(facts.label || facts.text || facts.title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return marks.length > 0 ? `${facts.tag}.${classes}[${marks.join(',')}]` : `${facts.tag}.${classes}「${words}」`;
}

/**
 * El contraste entre dos colores, como lo cuenta la WCAG: de 1 (iguales) a 21 (negro y blanco).
 * Texto normal: 4,5 o más; texto grande (24 px, o 19 en negrita): 3.
 *
 * @param {[number, number, number]} fg
 * @param {[number, number, number]} bg
 * @returns {number}
 */
export function contrastRatio(fg, bg) {
    const lum = (/** @type {[number, number, number]} */ rgb) => {
        const [r, g, b] = rgb.map(v => {
            const c = Math.max(0, Math.min(255, v)) / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(fg);
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Un color de CSS (`rgb(…)`, `rgba(…)`, `#abc`, `#aabbcc`) en números, con su opacidad.
 *
 * @param {string} css
 * @returns {{rgb: [number, number, number], alpha: number}|null}
 */
export function parseColor(css) {
    const text = String(css ?? '').trim().toLowerCase();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
    if (hex) {
        const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
        return { rgb: [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), alpha: 1 };
    }
    const fn = /^rgba?\(([^)]+)\)$/.exec(text);
    if (!fn) return null;
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(v => !Number.isFinite(v))) return null;
    return { rgb: [parts[0], parts[1], parts[2]], alpha: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1 };
}

/**
 * Un color con transparencia puesto sobre otro opaco.
 *
 * @param {[number, number, number]} top
 * @param {number} alpha
 * @param {[number, number, number]} under
 * @returns {[number, number, number]}
 */
export function blend(top, alpha, under) {
    return /** @type {[number, number, number]} */ (top.map((v, i) => Math.round(v * alpha + under[i] * (1 - alpha))));
}

// ---------------------------------------------------------------- lo que toca la página

/**
 * Si algo se ve: con tamaño, sin esconder y sin nada que lo haga invisible.
 *
 * @param {Element|null} node
 * @returns {boolean}
 */
export function isShown(node) {
    if (!(node instanceof HTMLElement) || !node.isConnected) return false;
    if (node.closest('[hidden], [inert]')) return false;
    const box = node.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    const css = getComputedStyle(node);
    return css.visibility !== 'hidden' && css.display !== 'none';
}

/**
 * Lo que recibe el foco dentro de algo, a la vista y en el orden de la página.
 *
 * @param {ParentNode} container
 * @param {string} [selector]
 * @returns {HTMLElement[]}
 */
export function focusablesIn(container, selector = FOCUSABLE) {
    return /** @type {HTMLElement[]} */ ([...container.querySelectorAll(selector)])
        .filter(node => isShown(node) && node.tabIndex >= 0 && !node.matches(':disabled'));
}

/**
 * Con qué se jugó lo último: el teclado o el ratón (o el dedo). El foco solo se lleva a lo
 * principal cuando se juega con el teclado: a quien usa el ratón no se le mueve nada.
 */
let lastInput = '';

/** Lo último que tuvo el foco, y en qué zona estaba (al quitarlo de la página ya no se sabe). */
/** @type {{node: HTMLElement, region: string}|null} */
let lastFocus = null;

/**
 * Si se está jugando con el teclado.
 *
 * @returns {boolean}
 */
export function keyboardInUse() {
    return lastInput === 'key';
}

/**
 * La ventana de encima, si hay alguna abierta como ventana (`showModal`). La última que se abrió
 * es la última de la página que está abierta.
 *
 * @param {Document} [doc]
 * @returns {HTMLDialogElement|null}
 */
export function topDialog(doc = document) {
    const open = /** @type {HTMLDialogElement[]} */ ([...doc.querySelectorAll('dialog[open]')]).filter((d) => {
        try {
            return d.matches(':modal');
        } catch {
            return true;
        }
    });
    return open.length > 0 ? open[open.length - 1] : null;
}

/**
 * Lo de encima que no es una ventana, si hay algo a la vista: la pausa, los dados, la tarjeta de
 * un enemigo, una lista de la barra de combate.
 *
 * @param {Document} [doc]
 * @returns {HTMLElement|null}
 */
export function topOverlay(doc = document) {
    for (const { selector } of OVERLAYS) {
        const found = /** @type {HTMLElement|null} */ ([...doc.querySelectorAll(selector)].filter(isShown).pop() ?? null);
        if (found) return found;
    }
    const trap = /** @type {HTMLElement|null} */ ([...doc.querySelectorAll('[data-trap]')].filter(isShown).pop() ?? null);
    return trap;
}

/**
 * Esc: cierra lo de encima que no es una ventana. Dice si había algo (y entonces Esc era para
 * eso, no para la pausa). Con los dados rodando, Esc espera: se los come sin cerrar nada.
 *
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function closeTopOverlay(doc = document) {
    for (const { selector, close } of OVERLAYS) {
        const found = /** @type {HTMLElement|null} */ ([...doc.querySelectorAll(selector)].filter(isShown).pop() ?? null);
        if (!found) continue;
        if (close === 'remove') {
            found.remove();
            rescueFocus(doc);
            return true;
        }
        const button = /** @type {HTMLButtonElement|null} */ (found.querySelector(close));
        if (button && !button.disabled) button.click();
        return true;
    }
    return false;
}

/**
 * Pone el foco en algo y lo enseña, sin que la página salte de golpe.
 *
 * @param {HTMLElement|null} node
 * @returns {boolean}
 */
export function focusOn(node) {
    if (!node || !isShown(node)) return false;
    node.focus({ preventScroll: true });
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return node.ownerDocument.activeElement === node;
}

/**
 * Si el foco se ha perdido: está en la página entera (`body`) o en nada.
 *
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function focusLost(doc = document) {
    const active = doc.activeElement;
    return !active || active === doc.body || active === doc.documentElement || !active.isConnected;
}

/**
 * El foco perdido, a lo principal de lo que se ve: dentro de la ventana de encima si la hay; si
 * no, a lo de encima (la pausa, los dados…); y si no, a lo principal de la escena.
 *
 * @param {Document} [doc]
 * @returns {boolean} Si se puso en algún sitio.
 */
export function rescueFocus(doc = document) {
    const dialog = topDialog(doc);
    if (dialog) return focusOn(focusablesIn(dialog)[0] ?? null);
    const overlay = topOverlay(doc);
    if (overlay) {
        const first = focusablesIn(overlay)[0] ?? null;
        if (first) return focusOn(first);
    }
    for (const selector of PRIMARY_TARGETS) {
        const found = focusablesIn(doc, selector)[0] ?? null;
        if (found && focusOn(found)) return true;
    }
    return false;
}

/**
 * Lo que dice qué es un botón de la página, para `focusKeyFrom`.
 *
 * @param {HTMLElement} node
 * @returns {string}
 */
export function focusKeyOf(node) {
    return focusKeyFrom({
        tag: node.tagName.toLowerCase(),
        data: { ...node.dataset },
        id: node.id,
        label: node.getAttribute('aria-label') ?? '',
        title: node.getAttribute('title') ?? '',
        text: node.textContent ?? '',
        classes: [...node.classList],
    });
}

/** Las zonas del juego: si el botón con el foco se va, el foco se queda en su zona. */
const REGIONS = ['.gs-vn-box', '.gs-actions', '.gs-targets', '.gs-head', '.gs-menu', '.gs-places', '.gs-party-strip', '.gs-scene-map', '.gs-pause-card'];

/**
 * @typedef {Object} KeptFocus Dónde estaba el foco antes de redibujar.
 * @property {string} key
 * @property {string} region
 * @property {HTMLElement} node
 */

/**
 * Antes de redibujar algo: dónde está el foco, si está dentro.
 *
 * @param {HTMLElement|null} root
 * @returns {KeptFocus|null}
 */
export function captureFocus(root) {
    if (!root) return null;
    const active = /** @type {HTMLElement|null} */ (root.ownerDocument.activeElement ?? null);
    if (active && root.contains(active) && active !== root) {
        return { key: focusKeyOf(active), region: REGIONS.find(r => active.closest(r)) ?? '', node: active };
    }
    // El foco ya se perdió (un redibujado de antes se llevó el botón): se busca el último que
    // lo tuvo dentro, si se juega con el teclado.
    if (focusLost(root.ownerDocument) && keyboardInUse() && lastFocus && (root.contains(lastFocus.node) || !lastFocus.node.isConnected)) {
        return { key: focusKeyOf(lastFocus.node), region: lastFocus.region, node: lastFocus.node };
    }
    return null;
}

/**
 * Después de redibujar: el foco, al mismo botón (o a su sucesor, con la misma llave); si ya no
 * está, a lo primero de su zona; y si la zona ya no se ve, a lo principal de la escena.
 *
 * @param {HTMLElement|null} root
 * @param {KeptFocus|null} kept
 */
export function restoreFocus(root, kept) {
    if (!root || !kept) return;
    const doc = root.ownerDocument;
    // Sigue en el mismo botón, o algo se llevó el foco a propósito (una ventana, la pausa): es suyo.
    if (!focusLost(doc)) return;
    const same = focusablesIn(root).find(node => focusKeyOf(node) === kept.key) ?? null;
    if (same && focusOn(same)) return;
    const region = kept.region ? /** @type {HTMLElement|null} */ ([...root.querySelectorAll(kept.region)].find(isShown) ?? null) : null;
    const first = region ? focusablesIn(region, ITEM)[0] ?? focusablesIn(region)[0] ?? null : null;
    if (first && focusOn(first)) return;
    rescueFocus(doc);
}

/**
 * Al abrir algo encima (la pausa, una lista): el foco entra, y al cerrarlo vuelve a lo que lo
 * abrió. Devuelve lo que hay que llamar al cerrar.
 *
 * @param {HTMLElement} container
 * @param {HTMLElement|null} [first] Lo primero que recibe el foco; si no, lo primero de dentro.
 * @returns {() => void}
 */
export function holdFocus(container, first = null) {
    const doc = container.ownerDocument;
    const from = /** @type {HTMLElement|null} */ (doc.activeElement instanceof HTMLElement && !container.contains(doc.activeElement) && doc.activeElement !== doc.body ? doc.activeElement : null);
    focusOn(first ?? focusablesIn(container)[0] ?? null);
    return () => returnFocus(from, doc);
}

/**
 * El foco, de vuelta a donde estaba; si eso ya no está, a lo principal.
 *
 * @param {HTMLElement|null} from
 * @param {Document} [doc]
 */
export function returnFocus(from, doc = document) {
    // Si el foco ya está en algo (quien juega pulsó otra cosa), no se le quita.
    if (!focusLost(doc)) return;
    if (from && from.isConnected && focusOn(from)) return;
    rescueFocus(doc);
}

/**
 * La lista a la que pertenece una opción: una de `ARROW_LISTS` que la contenga, o su padre si
 * tiene dos opciones o más.
 *
 * @param {HTMLElement} item
 * @returns {{list: HTMLElement, items: HTMLElement[]}|null}
 */
export function listOf(item) {
    const listed = /** @type {HTMLElement|null} */ (item.closest(ARROW_LISTS));
    if (listed) {
        const items = focusablesIn(listed, ITEM);
        if (items.length >= 2 && items.includes(item)) return { list: listed, items };
    }
    const parent = item.parentElement;
    if (!parent) return null;
    const siblings = focusablesIn(parent, ITEM).filter(node => node.parentElement === parent);
    return siblings.length >= 2 ? { list: parent, items: siblings } : null;
}

/**
 * Flechas: a la opción de al lado en su lista. Dice si la tecla era suya.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleArrows(event) {
    if (!ARROW_KEYS.includes(event.key) || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target : null);
    if (!target || target.closest(OWN_ARROWS) || !target.matches(ITEM)) return false;
    const found = listOf(target);
    if (!found) return false;
    const index = found.items.indexOf(target);
    const boxes = found.items.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const next = pickNeighbour(boxes, index, event.key);
    if (next === index) return false;
    event.preventDefault();
    focusOn(found.items[next]);
    return true;
}

/**
 * Tab en círculo: dentro de la ventana de encima o de lo de encima (la pausa, los dados), del
 * último al primero y del primero al último. Si el foco está fuera, entra. Dice si era suya.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleTab(event) {
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return false;
    const doc = /** @type {Document} */ ((/** @type {any} */ (event.target))?.ownerDocument ?? document);
    const box = topDialog(doc) ?? topOverlay(doc);
    if (!box) return false;
    const inside = focusablesIn(box);
    if (inside.length === 0) return false;
    const active = /** @type {HTMLElement|null} */ (doc.activeElement instanceof HTMLElement ? doc.activeElement : null);
    const at = active ? inside.indexOf(active) : -1;
    if (at === -1 && active && box.contains(active) && active !== box) return false;
    let next = -1;
    if (at === -1) next = event.shiftKey ? inside.length - 1 : 0;
    else if (!event.shiftKey && at === inside.length - 1) next = 0;
    else if (event.shiftKey && at === 0) next = inside.length - 1;
    if (next === -1) return false;
    event.preventDefault();
    focusOn(inside[next]);
    return true;
}

/**
 * Pone el teclado del juego en la página: flechas, Tab en círculo y el foco que vuelve al
 * cerrarse una ventana. Devuelve con qué quitarlo.
 *
 * @param {Document} [doc]
 * @returns {() => void}
 */
export function installKeyboard(doc = document) {
    const onKey = (/** @type {KeyboardEvent} */ event) => {
        if (event.defaultPrevented) return;
        if (handleTab(event)) return;
        handleArrows(event);
    };
    // En la fase de captura: algunas ventanas paran las teclas para que no lleguen al juego.
    doc.addEventListener('keydown', onKey, true);
    // Al cerrarse una ventana (o quitarse de la página), si el foco se ha quedado en nada, a lo
    // principal. Las ventanas de SillyTavern ya devuelven el foco: esto es para las demás.
    let pending = 0;
    const later = () => {
        if (pending) return;
        pending = Number(setTimeout(() => {
            pending = 0;
            if (focusLost(doc)) rescueFocus(doc);
        }, 30));
    };
    doc.addEventListener('close', later, true);
    const watcher = typeof MutationObserver === 'function'
        ? new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.removedNodes) {
                    if (node instanceof HTMLElement && (node.tagName === 'DIALOG' || node.matches?.('.wm-dice-overlay, .tc-overlay, .vs-card, .gs-keys'))) {
                        later();
                        return;
                    }
                }
            }
        })
        : null;
    if (doc.body) watcher?.observe(doc.body, { childList: true });
    return () => {
        doc.removeEventListener('keydown', onKey, true);
        doc.removeEventListener('close', later, true);
        watcher?.disconnect();
        if (pending) clearTimeout(pending);
    };
}
