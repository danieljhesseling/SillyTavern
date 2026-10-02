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
    // Las rejillas de tarjetas de las ventanas del gremio (el tablón, quién va, contratar).
    '.vt-grid',
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

/** Lo que se abre encima, fuera de una ventana, y se lleva el foco al abrirse (`installKeyboard`). */
export const HOLD_ON_OPEN = '.tc-overlay';

/** Lo principal de cada escena, en orden: a donde va el foco cuando se pierde. */
export const PRIMARY_TARGETS = [
    '.wm-dice-overlay.active .wm-dice-next',
    '.tc-overlay .tc-card button',
    '.gs-root .gs-pause-card button',
    '.gs-root .gs-vn-box .gs-chip-continue',
    '.gs-root[data-scene="dialogue"] .gs-vn-box .gs-chip-action',
    // Quien juega en el tablero con el teclado (y salió de él solo para la tarjeta de un enemigo
    // o los dados) vuelve al tablero (`board-keys.js` pone la marca en la página).
    'html[data-gs-board="on"] .gs-root[data-scene="combat"] .gs-scene-map .wm-container.gs-board-keys',
    '.gs-root .gs-actions .gs-btn-attack',
    // En la pelea, sin nadie a quien atacar, lo que toca es andar: el tablero (board-keys.js), y
    // no «Fin de turno», que con un Intro de más se pasaría el turno sin hacer nada.
    '.gs-root[data-scene="combat"] .gs-scene-map .wm-container.gs-board-keys',
    '.gs-root .gs-actions button:not(.gs-btn-end)',
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
const KEY_DATA = ['chip', 'next', 'place', 'action', 'guide', 'pick', 'value', 'toggle', 'game', 'world', 'scene', 'kind', 'result', 'id', 'tokenId', 'x', 'y'];

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
 * Cómo se llama un botón que es solo un icono, por su icono, cuando no dice nada más (ni texto,
 * ni `title`). Lo que el lector de pantalla dice en voz alta, y lo que se lee al pasar el foco.
 */
export const ICON_NAMES = Object.freeze({
    'fa-xmark': 'Cerrar',
    'fa-times': 'Cerrar',
    'fa-bars': 'Pausa',
    'fa-arrow-left': 'Volver',
    'fa-chevron-left': 'Anterior',
    'fa-chevron-right': 'Siguiente',
    'fa-angle-left': 'Anterior',
    'fa-angle-right': 'Siguiente',
    'fa-dice': 'Al azar',
    'fa-dice-d20': 'Dados',
    'fa-magnifying-glass-plus': 'Acercar',
    'fa-magnifying-glass-minus': 'Alejar',
    'fa-search-plus': 'Acercar',
    'fa-search-minus': 'Alejar',
    'fa-border-all': 'Cuadrícula',
    'fa-table-cells': 'Cuadrícula',
    'fa-expand': 'Encuadrar',
    'fa-compress': 'Encuadrar',
    'fa-crosshairs': 'Centrar',
    'fa-plus': 'Añadir',
    'fa-minus': 'Quitar',
    'fa-trash': 'Borrar',
    'fa-trash-can': 'Borrar',
    'fa-pen': 'Editar',
    'fa-pencil': 'Editar',
    'fa-play': 'Seguir',
    'fa-pause': 'Pausa',
    'fa-folder-open': 'Buscar una imagen',
    'fa-upload': 'Subir',
    'fa-download': 'Descargar',
    'fa-gear': 'Opciones',
    'fa-gears': 'Opciones',
    'fa-sliders': 'Opciones',
    'fa-volume-high': 'Sonido',
    'fa-volume-xmark': 'Sin sonido',
    'fa-music': 'Música',
    'fa-book': 'Diario',
    'fa-map': 'Mapa',
    'fa-users': 'Grupo',
    'fa-bell': 'Avisos',
    'fa-circle-question': 'Ayuda',
    'fa-question': 'Ayuda',
    'fa-circle-info': 'Más información',
    'fa-eye': 'Ver',
    'fa-eye-slash': 'Ocultar',
    'fa-check': 'Aceptar',
    'fa-rotate': 'Otra vez',
    'fa-arrows-rotate': 'Otra vez',
    'fa-rotate-left': 'Deshacer',
    'fa-copy': 'Copiar',
    'fa-floppy-disk': 'Guardar',
    'fa-hourglass-end': 'Fin de turno',
    'fa-shoe-prints': 'Moverse',
    'fa-hand-fist': 'Atacar',
    'fa-wand-sparkles': 'Conjuros',
    'fa-shield-halved': 'Defenderse',
    'fa-person-running': 'Huir',
    'fa-comment': 'Hablar',
    'fa-comments': 'Hablar',
    'fa-bed': 'Descansar',
    'fa-campground': 'Acampar',
    'fa-list-ul': 'Elegir',
});

/**
 * @typedef {Object} ButtonFacts Lo que se mira de un botón para saber cómo se llama.
 * @property {string} [text] Lo que se lee dentro.
 * @property {string} [label] Su `aria-label`.
 * @property {string} [labelledby] Su `aria-labelledby`.
 * @property {string} [title]
 * @property {string[]} [icons] Las clases de sus iconos (`fa-xmark`…).
 */

/**
 * El nombre que le falta a un botón de icono: el de su `title` (sin la tecla entre paréntesis,
 * que no es un nombre), y si no tiene, el de su icono. Vacío si ya se llama de alguna forma que
 * se lea (su texto, su `aria-label`) o si no se sabe cómo llamarlo.
 *
 * Un texto que es solo un número (el «4» de los avisos) o un signo no es un nombre.
 *
 * @param {ButtonFacts} facts
 * @returns {string}
 */
export function iconButtonLabel(facts) {
    if (String(facts.label ?? '').trim() || String(facts.labelledby ?? '').trim()) return '';
    const text = String(facts.text ?? '').replace(/\s+/g, ' ').trim();
    if (/\p{L}{2,}/u.test(text)) return '';
    const title = String(facts.title ?? '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
    const icon = (facts.icons ?? []).map(c => /** @type {Record<string, string>} */ (ICON_NAMES)[c]).find(Boolean) ?? '';
    const name = title || icon;
    if (!name) return '';
    return text ? `${name}: ${text}` : name;
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
        return { rgb: /** @type {[number, number, number]} */ ([0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))), alpha: 1 };
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
        // Sin nada que pulsar todavía (los dados aún ruedan), a la caja misma, si se deja.
        const first = focusablesIn(overlay)[0] ?? /** @type {HTMLElement|null} */ (overlay.querySelector('[tabindex="-1"]'));
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

/**
 * A un botón de icono sin nombre, el suyo (`iconButtonLabel`). Dice si se lo puso.
 *
 * @param {Element|null} node
 * @returns {boolean}
 */
export function nameIconButton(node) {
    if (!(node instanceof HTMLElement) || !node.matches('button, [role="button"]')) return false;
    const label = iconButtonLabel({
        text: node.textContent ?? '',
        label: node.getAttribute('aria-label') ?? '',
        labelledby: node.getAttribute('aria-labelledby') ?? '',
        title: node.getAttribute('title') ?? '',
        icons: [...node.querySelectorAll('i, .fa-solid, .fa-regular')].flatMap(i => [...i.classList]).filter(c => c.startsWith('fa-')),
    });
    if (!label) return false;
    node.setAttribute('aria-label', label);
    return true;
}

/**
 * A todos los botones de icono de algo, su nombre. Cuántos se nombraron.
 *
 * @param {ParentNode|null} container
 * @returns {number}
 */
export function nameIconButtons(container) {
    if (!container) return 0;
    let named = 0;
    for (const node of container.querySelectorAll('button, [role="button"]')) {
        if (nameIconButton(node)) named++;
    }
    return named;
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
    // Si ese era de una ventana que ya se cerró, no: el foco vuelve a lo que la abrió
    // (`installKeyboard`, al cerrarse).
    const closed = /** @type {HTMLDialogElement|null} */ (lastFocus?.node.closest('dialog') ?? null);
    if (closed && !(closed.isConnected && closed.open)) return null;
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
    // Lo que lo abrió puede redibujarse mientras tanto (el tablero, tras un ataque): se apunta
    // cómo reconocerlo.
    const key = from ? focusKeyOf(from) : '';
    focusOn(first ?? focusablesIn(container)[0] ?? null);
    return () => returnFocus(from, doc, key);
}

/**
 * Una lista que se abre sobre la barra (a quién atacar, las habilidades, las maniobras): el foco
 * entra en su primera opción; si la lista cambia por dentro (el segundo paso, «¿sobre quién?»),
 * a la primera de nuevo; y al quitarla, vuelve al botón que la abrió.
 *
 * @param {HTMLElement} list
 */
export function focusList(list) {
    const doc = list.ownerDocument;
    const first = () => focusablesIn(list, ITEM).find(node => !node.matches('.gs-targets-close')) ?? focusablesIn(list)[0] ?? null;
    const back = holdFocus(list, first());
    const parent = list.parentElement;
    if (!parent || typeof MutationObserver !== 'function') return;
    const watch = new MutationObserver(() => {
        if (list.isConnected) {
            if (focusLost(doc)) focusOn(first());
            return;
        }
        watch.disconnect();
        back();
    });
    watch.observe(parent, { childList: true });
    watch.observe(list, { childList: true });
}

/**
 * El foco, de vuelta a donde estaba; si eso ya no está, a lo principal.
 *
 * @param {HTMLElement|null} from
 * @param {Document} [doc]
 * @param {string} [key] Cómo reconocer `from` si se redibujó (`focusKeyOf`): entonces, al nuevo.
 */
export function returnFocus(from, doc = document, key = '') {
    // Si el foco ya está en algo (quien juega pulsó otra cosa), no se le quita.
    if (!focusLost(doc)) return;
    if (from && from.isConnected && focusOn(from)) return;
    if (key) {
        const same = focusablesIn(doc).find(node => focusKeyOf(node) === key) ?? null;
        if (same && focusOn(same)) return;
    }
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

/** Las teclas que pulsan o eligen algo. */
const ACTING_KEYS = ['Enter', ' ', ...ARROW_KEYS];

/** Lo que cierra o vuelve atrás: no es lo primero que se enfoca al abrir una ventana. */
const LEAVING = '.hc-back, .gs-close, .tc-close, .gs-targets-close, .popup-button-cancel, .popup-button-close, [data-result="0"]';

/** Lo ya elegido en una lista: al entrar en ella, el foco va ahí. */
const CHOSEN = '.is-current, [aria-selected="true"], [aria-current="true"], [aria-checked="true"]';

/**
 * Lo primero que se pulsa en una ventana o en una lista: lo ya elegido; si no, la primera opción
 * que no sea cerrar o volver; si no, lo primero que reciba el foco.
 *
 * @param {ParentNode} box
 * @returns {HTMLElement|null}
 */
export function firstControl(box) {
    const items = focusablesIn(box, ITEM);
    return items.find(node => node.matches(CHOSEN))
        ?? items.find(node => !node.matches(LEAVING))
        ?? items[0]
        ?? focusablesIn(box)[0]
        ?? null;
}

/**
 * Si algo es un mando (un botón, un campo, el tablero) y no la caja de una ventana o su texto,
 * que el navegador enfoca al abrirla para que se pueda deslizar.
 *
 * @param {HTMLElement} node
 * @returns {boolean}
 */
function isControl(node) {
    return node.matches(ITEM) || (node.matches(FOCUSABLE) && node.tabIndex >= 0) || Boolean(node.closest(OWN_ARROWS));
}

/**
 * Si una flecha arriba o abajo aún desliza la caja (un texto largo): entonces es para leer.
 *
 * @param {HTMLElement} node
 * @param {string} key
 * @returns {boolean}
 */
function scrollsWith(node, key) {
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return false;
    if (node.scrollHeight <= node.clientHeight + 1) return false;
    return key === 'ArrowDown' ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0;
}

/**
 * La lista de opciones de una ventana que se abre para elegir (la clase, la especie…), si es eso.
 *
 * @param {HTMLElement} dialog
 * @returns {HTMLElement|null}
 */
export function choiceListIn(dialog) {
    const list = /** @type {HTMLElement|null} */ ([...dialog.querySelectorAll(`${ARROW_LISTS}, .go-list`)].find(node => focusablesIn(node, ITEM).length >= 2) ?? null);
    return list;
}

/**
 * Lo de encima manda: con los dados, la pausa o una ventana delante y el foco detrás (en
 * «Atacar», que ya no se ve), Intro no puede pulsar lo de detrás. El foco entra en lo de encima y
 * la tecla se queda ahí. Y sin nada delante, si el foco se ha perdido (un redibujado se llevó su
 * botón), la tecla lo trae a lo principal de la escena en vez de caer en la página (donde las
 * flechas de SillyTavern cambian de mensaje). Dice si la tecla era suya.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function guardOverlay(event) {
    if (!ACTING_KEYS.includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return false;
    const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target : null);
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return false;
    const doc = target?.ownerDocument ?? document;
    const box = topDialog(doc) ?? topOverlay(doc);
    if (box) {
        const active = doc.activeElement;
        if (active instanceof HTMLElement && active !== doc.body && box.contains(active)) {
            // El foco está en la caja misma (la ventana recién abierta, su texto): Intro, Espacio o
            // una flecha van a lo primero que se pulsa. Si la flecha aún desliza un texto largo, no.
            if (isControl(active) || event.key === 'Home' || event.key === 'End' || scrollsWith(active, event.key)) return false;
            const first = firstControl(box);
            if (!first) return false;
            event.preventDefault();
            event.stopPropagation();
            focusOn(first);
            return true;
        }
        event.preventDefault();
        event.stopPropagation();
        const first = focusablesIn(box)[0] ?? null;
        if (!focusOn(first) && box.tabIndex >= -1 && box.hasAttribute('tabindex')) box.focus({ preventScroll: true });
        return true;
    }
    if (!focusLost(doc) || !doc.querySelector('.gs-root')) return false;
    event.preventDefault();
    event.stopPropagation();
    rescueFocus(doc);
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
 * Intro o Espacio en un botón que se redibuja al pulsarlo (una fila de fichas que se hace de
 * nuevo, como «Retrato · Iniciales · Icono»): el foco no se pierde en la página. Vuelve al botón
 * nuevo que es el mismo; si ya no está, a la primera opción de su sitio. Si el foco ya está en
 * otra cosa (se abrió una ventana), no se toca.
 *
 * @param {HTMLElement} node
 * @param {Document} doc
 */
function keepFocusThrough(node, doc) {
    const key = focusKeyOf(node);
    /** @type {HTMLElement[]} */
    const around = [];
    for (let up = node.parentElement; up && up !== doc.body && up !== doc.documentElement; up = up.parentElement) around.push(up);
    const attempt = (/** @type {number[]} */ waits) => setTimeout(() => {
        if (!focusLost(doc) && doc.activeElement !== node) return;
        if (node.isConnected) {
            if (waits.length > 1) attempt(waits.slice(1));
            return;
        }
        const home = around.find(up => up.isConnected);
        if (!home) return;
        const same = focusablesIn(home).find(other => focusKeyOf(other) === key) ?? null;
        if (same && focusOn(same)) return;
        focusOn(focusablesIn(home, ITEM)[0] ?? null);
    }, waits[0]);
    attempt([0, 60, 250, 600]);
}

/**
 * Intro en un botón de verdad (`<button>`) con la clase de SillyTavern `menu_button` o
 * `interactable`: SillyTavern lo pulsa (`keyboard.js`) y el navegador también, así que se pulsaba
 * dos veces (dos ataques, una tirada cerrada dos veces). El segundo clic de la misma tecla se
 * descarta.
 *
 * @param {KeyboardEvent} event
 */
function oneClickPerEnter(event) {
    if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.disabled) return;
    let clicks = 0;
    const once = (/** @type {MouseEvent} */ click) => {
        clicks++;
        if (clicks < 2) return;
        click.preventDefault();
        click.stopImmediatePropagation();
    };
    target.addEventListener('click', once, true);
    setTimeout(() => target.removeEventListener('click', once, true), 0);
}

/**
 * El foco, de vuelta a lo que abrió una ventana aunque se haya redibujado mientras tanto: el
 * botón con la misma llave (`focusKeyOf`); si ya no está, lo primero de su zona. Dice si pudo.
 *
 * @param {Document} doc
 * @param {{key: string, region: string}} opener
 * @returns {boolean}
 */
export function returnByKey(doc, opener) {
    const same = opener.key ? focusablesIn(doc).find(node => focusKeyOf(node) === opener.key) ?? null : null;
    if (same && focusOn(same)) return true;
    const region = opener.region ? /** @type {HTMLElement|null} */ ([...doc.querySelectorAll(opener.region)].find(isShown) ?? null) : null;
    const first = region ? focusablesIn(region, ITEM)[0] ?? null : null;
    return Boolean(first && focusOn(first));
}

/**
 * Pone el teclado del juego en la página: flechas, Tab en círculo y el foco que vuelve al
 * cerrarse una ventana. Devuelve con qué quitarlo.
 *
 * @param {Document} [doc]
 * @returns {() => void}
 */
export function installKeyboard(doc = document) {
    /** Lo que abrió cada ventana (`returnByKey`). @type {WeakMap<HTMLElement, {key: string, region: string}>} */
    const openers = new WeakMap();
    /**
     * Lo último que se pulsó: una ventana que se abre justo después la abrió eso. Las que abre el
     * juego solo (una escena del hilo) no se apuntan: al cerrarlas, el foco va a lo principal.
     * @type {HTMLElement|null}
     */
    let pressed = null;
    const onKey = (/** @type {KeyboardEvent} */ event) => {
        // Las teclas que mueven o pulsan dicen que se juega con el teclado (no Mayús ni Ctrl solas).
        if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) lastInput = 'key';
        if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement) pressed = event.target;
        oneClickPerEnter(event);
        if (event.defaultPrevented) return;
        if (guardOverlay(event)) return;
        if (handleTab(event)) return;
        if (handleArrows(event)) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if ((event.key === 'Enter' || event.key === ' ') && target?.matches(ITEM)) keepFocusThrough(target, doc);
    };
    const onPointer = (/** @type {Event} */ event) => {
        lastInput = 'pointer';
        pressed = event.target instanceof Element ? /** @type {HTMLElement|null} */ (event.target.closest(FOCUSABLE)) : null;
    };
    // Lo último que tuvo el foco, para devolvérselo si un redibujado se lo lleva; y a un botón de
    // icono que lo recibe, su nombre (y a los demás de su ventana, de una vez).
    const onFocus = (/** @type {FocusEvent} */ event) => {
        const node = event.target instanceof HTMLElement ? event.target : null;
        if (!node || node === doc.body) return;
        const before = lastFocus;
        lastFocus = { node, region: REGIONS.find(r => node.closest(r)) ?? '' };
        nameIconButton(node);
        const dialog = /** @type {HTMLElement|null} */ (node.closest('dialog, [role="dialog"]'));
        // El foco entra en una ventana desde fuera: lo que la abrió, por si al cerrarla ya se ha
        // redibujado (el botón de avisos, que cambia su número al leerlos).
        if (dialog && !openers.has(dialog) && before && before.node === pressed && !before.node.closest('dialog, [role="dialog"]')) {
            openers.set(dialog, { key: focusKeyOf(before.node), region: before.region });
        }
        if (dialog && !dialog.dataset.gsNamed) {
            dialog.dataset.gsNamed = '1';
            nameIconButtons(dialog);
        }
        // Una ventana para elegir (la clase, la especie…) que se abre con el teclado: el navegador
        // enfoca su caja; el foco pasa a lo ya elegido o a la primera opción, y las flechas andan.
        // Mientras la ventana se abre (entra con una animación) sus opciones aún no se ven: se
        // prueba otra vez un poco después.
        if (dialog && keyboardInUse() && !isControl(node)) {
            const tryList = (/** @type {number[]} */ waits) => setTimeout(() => {
                if (doc.activeElement !== node) return;
                const list = choiceListIn(dialog);
                if (list && focusOn(firstControl(list))) return;
                if (waits.length > 1) tryList(waits.slice(1));
            }, waits[0]);
            tryList([0, 80, 250]);
        }
    };
    // En la fase de captura: algunas ventanas paran las teclas para que no lleguen al juego.
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('pointerdown', onPointer, true);
    doc.addEventListener('focusin', onFocus, true);
    // Al cerrarse una ventana (o quitarse de la página), si el foco se ha quedado en nada: a lo
    // que la abrió (el mismo botón, aunque se haya redibujado), a su zona o a lo principal. Las
    // ventanas de SillyTavern ya devuelven el foco: esto es para cuando su botón ya no está.
    let pending = 0;
    /** @type {HTMLElement|null} */
    let closing = null;
    const later = (/** @type {Event|HTMLElement|undefined} */ what) => {
        const box = what instanceof HTMLElement ? what : what?.target;
        if (box instanceof HTMLElement && openers.has(box)) closing = box;
        if (pending) return;
        pending = Number(setTimeout(() => {
            pending = 0;
            const back = closing ? openers.get(closing) ?? null : null;
            closing = null;
            if (!focusLost(doc)) return;
            if (back && !topDialog(doc) && returnByKey(doc, back)) return;
            rescueFocus(doc);
        }, 30));
    };
    doc.addEventListener('close', later, true);
    // Lo que se abre encima sin ser una ventana (la tarjeta de un enemigo): se anuncia como
    // ventana, el foco entra en su primer botón y, al quitarla, vuelve a lo que la abrió.
    /** @type {WeakMap<HTMLElement, () => void>} */
    const held = new WeakMap();
    const watcher = typeof MutationObserver === 'function'
        ? new MutationObserver((records) => {
            let lost = false;
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (!(node instanceof HTMLElement) || !node.matches(HOLD_ON_OPEN)) continue;
                    if (!node.hasAttribute('role')) {
                        node.setAttribute('role', 'dialog');
                        node.setAttribute('aria-modal', 'true');
                        const title = node.querySelector('.tc-name, .tc-title, h2, h3, h4')?.textContent?.trim();
                        if (title) node.setAttribute('aria-label', title);
                    }
                    held.set(node, holdFocus(node));
                }
                for (const node of record.removedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    const back = held.get(node);
                    if (back) {
                        held.delete(node);
                        back();
                    } else if (node.tagName === 'DIALOG' || node.matches?.('.wm-dice-overlay, .tc-overlay, .vs-card, .gs-keys')) {
                        lost = true;
                        if (openers.has(node)) closing = node;
                    }
                }
            }
            if (lost) later(closing ?? undefined);
        })
        : null;
    if (doc.body) watcher?.observe(doc.body, { childList: true });
    return () => {
        doc.removeEventListener('keydown', onKey, true);
        doc.removeEventListener('pointerdown', onPointer, true);
        doc.removeEventListener('focusin', onFocus, true);
        doc.removeEventListener('close', later, true);
        watcher?.disconnect();
        if (pending) clearTimeout(pending);
    };
}
