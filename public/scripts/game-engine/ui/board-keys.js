/**
 * J15.5 de ROADMAP_SIN_CONEXION: el tablero con el teclado solo.
 *
 * El tablero se juega con el ratón o con el dedo: pulsar tu ficha la elige y enciende las
 * casillas a las que llega; pulsar una casilla encendida mueve (o ataca); pulsar un enemigo abre
 * su tarjeta. Con el teclado, lo mismo:
 *
 * - El tablero recibe el foco con Tab, como un botón más. Con el foco dentro sale un **cursor**
 *   (un marco dorado) en la casilla de quien juega, y abajo una línea que dice qué hay en ella y
 *   qué hace Intro.
 * - **Flechas**: el cursor pasa a la casilla de al lado. Si hay una ruta que enseñar (la casilla
 *   está encendida para andar), se dibuja con su coste, como al pasar el ratón.
 * - **Intro o Espacio**: lo que haría un clic en esa casilla: ir, atacar, elegir tu ficha o abrir
 *   la tarjeta del enemigo. Donde no se puede hacer nada, lo dice.
 * - **Inicio**: el cursor vuelve a tu ficha. **Av Pág / Re Pág**: a la ficha siguiente o a la
 *   anterior (el enemigo, un compañero), sin contar casillas.
 * - **Tab** sale del tablero, a la barra de combate. **Esc**, la pausa, como siempre.
 *
 * El tablero se redibuja entero tras cada cosa que pasa. El cursor se queda en su casilla y, si
 * el tablero tenía el foco, el nuevo lo recibe: se puede andar y atacar sin soltar las flechas.
 *
 * Lo que es cálculo (a qué casilla lleva cada tecla, qué hace Intro en una casilla, lo que se
 * dice de ella) es puro y tiene sus pruebas. Lo demás lo prueba `tools/e2e-teclado.mjs`.
 *
 * Nada se hace al importar: `world-map-renderer.js` llama a `attachBoardKeys` al dibujar.
 */

import { focusLost, keyboardInUse } from './keyboard-nav.js';

/**
 * @typedef {Object} Cell Una casilla: columna y fila, desde 0.
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} BoardToken Una ficha, lo que hace falta de ella.
 * @property {number} id
 * @property {string} name
 * @property {number} gridX
 * @property {number} gridY
 * @property {boolean} [isEnemy]
 * @property {boolean} [isNPC]
 * @property {boolean} [isSummon]
 * @property {number} [hp]
 * @property {number} [maxHp]
 * @property {number} [sizeCells]
 */

/**
 * @typedef {Object} LitCell Una casilla encendida: se puede pulsar.
 * @property {number} x
 * @property {number} y
 * @property {'move'|'attack'} kind
 */

/**
 * @typedef {Object} CellAction Lo que hace Intro en una casilla.
 * @property {'move'|'attack'|'token'|'none'} kind
 * @property {BoardToken|null} token La ficha que hay en ella, si hay alguna.
 */

/** Las teclas del cursor. */
export const BOARD_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'PageDown', 'PageUp', 'Enter', ' '];

/** Cómo se usa, en una línea: sale abajo del tablero con el foco dentro. */
export const BOARD_HINT = 'Flechas: elegir casilla · Intro: ir, atacar o ver la ficha · Espacio: centrar la vista · Inicio: tu ficha · Av Pág: la siguiente ficha · Tab: salir';

/**
 * La casilla a la que lleva una flecha, sin salirse del tablero.
 *
 * @param {Cell} cell
 * @param {string} key
 * @param {{width: number, height: number}} grid
 * @returns {Cell}
 */
export function stepCell(cell, key, grid) {
    const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const dy = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
    const clamp = (/** @type {number} */ v, /** @type {number} */ size) => Math.max(0, Math.min(Math.max(0, size - 1), v));
    return { x: clamp(cell.x + dx, grid.width), y: clamp(cell.y + dy, grid.height) };
}

/**
 * La ficha que ocupa una casilla. Una criatura grande ocupa varias (`sizeCells`), desde la suya
 * hacia la derecha y hacia abajo.
 *
 * @param {BoardToken[]} tokens
 * @param {Cell} cell
 * @returns {BoardToken|null}
 */
export function tokenAt(tokens, cell) {
    return tokens.find((t) => {
        const size = Math.max(1, Number(t.sizeCells) || 1);
        const x = Number(t.gridX);
        const y = Number(t.gridY);
        return cell.x >= x && cell.x < x + size && cell.y >= y && cell.y < y + size;
    }) ?? null;
}

/**
 * Lo que hace Intro en una casilla: lo mismo que un clic. Una casilla encendida manda (ir o
 * atacar); si no, la ficha que haya en ella (elegirla o abrir su tarjeta); si no, nada.
 *
 * @param {Cell} cell
 * @param {LitCell[]} lit
 * @param {BoardToken[]} tokens
 * @returns {CellAction}
 */
export function cellAction(cell, lit, tokens) {
    const token = tokenAt(tokens, cell);
    const here = lit.find(c => c.x === cell.x && c.y === cell.y) ?? null;
    if (here) return { kind: here.kind, token };
    return { kind: token ? 'token' : 'none', token };
}

/**
 * La ficha siguiente (o la anterior) a la de la casilla, en el orden del grupo: primero los tuyos,
 * luego los demás. Sin ficha en la casilla, la primera (o la última).
 *
 * @param {BoardToken[]} tokens
 * @param {Cell} cell
 * @param {1|-1} step
 * @returns {BoardToken|null}
 */
export function nextToken(tokens, cell, step) {
    const order = [...tokens.filter(t => !t.isEnemy && !t.isNPC), ...tokens.filter(t => t.isEnemy || t.isNPC)];
    if (order.length === 0) return null;
    const here = tokenAt(order, cell);
    const at = here ? order.indexOf(here) : (step > 0 ? -1 : 0);
    return order[(at + step + order.length) % order.length];
}

/**
 * Quién es una ficha, dicho corto: «Ratero del muelle (enemigo, 5 de 5)».
 *
 * @param {BoardToken} token
 * @returns {string}
 */
export function tokenLine(token) {
    const side = token.isEnemy ? 'enemigo' : token.isSummon ? 'invocación' : token.isNPC ? 'no pelea' : 'de tu grupo';
    const hp = Number.isFinite(Number(token.hp)) && Number(token.maxHp) > 0 ? `, ${Number(token.hp)} de ${Number(token.maxHp)}` : '';
    return `${token.name} (${side}${hp})`;
}

/**
 * Lo que se dice de la casilla del cursor: dónde está, qué es, quién hay y qué hace Intro.
 *
 * @param {Cell} cell
 * @param {CellAction} action
 * @param {string} [place] Lo que es la casilla (su terreno, su sala), si se sabe.
 * @returns {string}
 */
export function cursorLine(cell, action, place = '') {
    // Lo que dice el terreno ya empieza por «Casilla (x, y)» (`describeCell`): no se repite.
    const parts = /^Casilla\b/.test(place) ? [place] : [`Casilla (${cell.x + 1}, ${cell.y + 1})`, ...(place ? [place] : [])];
    if (action.token) parts.push(tokenLine(action.token));
    const does = action.kind === 'move' ? 'Intro: ir aquí'
        : action.kind === 'attack' ? 'Intro: atacar'
            : action.kind === 'token' ? (action.token?.isEnemy ? 'Intro: ver su tarjeta' : 'Intro: elegir')
                : 'Aquí no se puede ir';
    parts.push(does);
    return parts.join(' · ');
}

// ---------------------------------------------------------------- lo que toca la página

/**
 * @typedef {Object} BoardKeysInput
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {BoardToken[]} [tokens]
 * @property {Cell|null} [start] Donde sale el cursor la primera vez: la ficha de quien juega.
 * @property {(x: number, y: number) => string} [describe] Lo que es una casilla (terreno, sala…).
 * @property {(cell: Cell) => void} [reveal] Que la casilla se vea: mueve la cámara si hace falta.
 */

/**
 * Lo que se recuerda entre un dibujo y el siguiente: dónde estaba el cursor (de qué tablero) y
 * si el tablero tenía el foco cuando se quitó para redibujarlo.
 */
const memory = { board: '', x: -1, y: -1, focused: false };

/** Lo que se abre desde el tablero y vuelve a él: la tarjeta de un enemigo, los dados. */
const FROM_BOARD = '.tc-overlay, .wm-dice-overlay';

/** Las barras de colocar al grupo que ya se llevaron el foco una vez (`attachBoardKeys`). */
const offered = new WeakSet();

/**
 * Si quien juega está en el tablero (o en algo que abrió desde él). Se apunta también en la
 * página (`html[data-gs-board="on"]`): así, si el foco se pierde, `keyboard-nav.js` lo trae al
 * tablero y no a «Fin de turno».
 *
 * @param {boolean} on
 */
function setBoardFocused(on) {
    memory.focused = on;
    const html = /** @type {any} */ (globalThis).document?.documentElement;
    if (!html) return;
    if (on) html.dataset.gsBoard = 'on';
    else delete html.dataset.gsBoard;
}

/**
 * Si se ven el cursor y su pista (`.gs-board-typing`, en `teclado.css`): solo mientras se juega
 * con el teclado, nunca por un clic.
 *
 * @param {HTMLElement} container
 * @param {boolean} on
 */
export function showCursor(container, on) {
    container.classList.toggle('gs-board-typing', on);
}

/**
 * Las casillas encendidas del tablero, como están en la página.
 *
 * @param {HTMLElement} content
 * @returns {LitCell[]}
 */
function litCells(content) {
    return [...content.querySelectorAll('.wm-highlight-clickable[data-x][data-y]')].map(node => ({
        x: Number(node.getAttribute('data-x')),
        y: Number(node.getAttribute('data-y')),
        kind: node.classList.contains('wm-highlight-attack') ? /** @type {const} */ ('attack') : /** @type {const} */ ('move'),
    }));
}

/**
 * La casilla encendida de la página en `cell`.
 *
 * @param {HTMLElement} content
 * @param {Cell} cell
 * @returns {HTMLElement|null}
 */
function litNode(content, cell) {
    return /** @type {HTMLElement|null} */ (content.querySelector(`.wm-highlight-clickable[data-x="${cell.x}"][data-y="${cell.y}"]`));
}

/**
 * Lo que un evento de jQuery haría al pasar el ratón: enseñar o quitar la ruta de una casilla.
 *
 * @param {HTMLElement|null} node
 * @param {'mouseenter'|'mouseleave'} type
 */
function hover(node, type) {
    const jq = /** @type {any} */ (globalThis).jQuery;
    if (!node || typeof jq !== 'function') return;
    try {
        jq(node).trigger(type);
    } catch { /* sin ruta que enseñar */ }
}

/**
 * Pone el teclado en un tablero recién dibujado. Se llama en cada dibujo; lo del anterior se va
 * con él.
 *
 * @param {HTMLElement} container `.wm-container`: lo que recibe el foco.
 * @param {HTMLElement} content `.wm-content`: lo que se mueve y se acerca; el cursor va dentro.
 * @param {BoardKeysInput} input
 */
export function attachBoardKeys(container, content, input) {
    if (!container || !content || container.dataset.gsBoardKeys) return;
    container.dataset.gsBoardKeys = '1';
    const grid = { width: Math.max(1, Number(input.gridWidth) || 1), height: Math.max(1, Number(input.gridHeight) || 1) };
    const tokens = Array.isArray(input.tokens) ? input.tokens : [];
    const board = `${grid.width}x${grid.height}:${tokens.filter(t => !t.isEnemy).map(t => t.id).join(',')}`;

    container.classList.add('gs-board-keys');
    container.tabIndex = 0;
    container.setAttribute('role', 'application');
    container.setAttribute('aria-roledescription', 'tablero');
    container.setAttribute('aria-label', `Tablero. ${BOARD_HINT}`);

    const cursor = document.createElement('div');
    cursor.className = 'gs-board-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.width = `${100 / grid.width}%`;
    cursor.style.height = `${100 / grid.height}%`;
    content.appendChild(cursor);
    const hint = document.createElement('div');
    hint.className = 'gs-board-hint';
    hint.setAttribute('aria-hidden', 'true');
    container.appendChild(hint);
    const say = document.createElement('div');
    say.className = 'gs-board-say';
    say.setAttribute('role', 'status');
    say.setAttribute('aria-live', 'polite');
    container.appendChild(say);

    // El cursor, donde estaba si es el mismo tablero; si no, en la ficha de quien juega.
    /** @type {Cell} */
    let at = memory.board === board && memory.x >= 0
        ? { x: Math.min(memory.x, grid.width - 1), y: Math.min(memory.y, grid.height - 1) }
        : input.start ?? { x: 0, y: 0 };
    memory.board = board;
    /** @type {HTMLElement|null} */
    let shown = null;

    const draw = (/** @type {boolean} */ announce) => {
        memory.x = at.x;
        memory.y = at.y;
        cursor.style.left = `${(at.x / grid.width) * 100}%`;
        cursor.style.top = `${(at.y / grid.height) * 100}%`;
        const action = cellAction(at, litCells(content), tokens);
        let place = '';
        try {
            place = String(input.describe?.(at.x, at.y) ?? '');
        } catch { /* sin terreno */ }
        const line = cursorLine(at, action, place);
        hint.textContent = line;
        if (announce) say.textContent = line;
        // La ruta hasta la casilla, como al pasar el ratón.
        const node = litNode(content, at);
        if (shown && shown !== node) hover(shown, 'mouseleave');
        shown = node && action.kind === 'move' ? node : null;
        if (shown) hover(shown, 'mouseenter');
        input.reveal?.(at);
        // La pista, en la mitad del tablero donde no está el cursor: que no lo tape.
        const mark = cursor.getBoundingClientRect();
        const box = container.getBoundingClientRect();
        hint.classList.toggle('gs-board-hint-top', mark.top + mark.height / 2 > box.top + box.height / 2);
    };

    const act = () => {
        const action = cellAction(at, litCells(content), tokens);
        if (action.kind === 'move' || action.kind === 'attack') {
            litNode(content, at)?.click();
            return;
        }
        if (action.kind === 'token' && action.token) {
            const node = /** @type {HTMLElement|null} */ (content.querySelector(`.wm-token[data-token-id="${CSS.escape(String(action.token.id))}"]`));
            if (node) {
                node.click();
                return;
            }
        }
        say.textContent = '';
        say.textContent = cursorLine(at, action);
    };

    container.addEventListener('keydown', (event) => {
        if (event.target !== container || !BOARD_KEYS.includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
        // Las flechas son del tablero: ni la lista de al lado ni los mensajes de SillyTavern.
        event.preventDefault();
        event.stopPropagation();
        showCursor(container, true);
        if (event.key === 'Enter' || event.key === ' ') {
            act();
            return;
        }
        if (event.key === 'Home') {
            at = input.start ?? at;
        } else if (event.key === 'PageDown' || event.key === 'PageUp') {
            const token = nextToken(tokens, at, event.key === 'PageDown' ? 1 : -1);
            if (token) at = { x: Number(token.gridX), y: Number(token.gridY) };
        } else {
            at = stepCell(at, event.key, grid);
        }
        draw(true);
    });
    container.addEventListener('focus', () => {
        setBoardFocused(true);
        // El cursor, solo con el teclado: un clic en el tablero también le da el foco, y con el
        // ratón el marco dorado se quedaba en una casilla que nadie había elegido.
        showCursor(container, keyboardInUse());
        draw(true);
    });
    // El ratón o el dedo en el tablero: el cursor se esconde hasta la próxima tecla.
    container.addEventListener('pointerdown', () => showCursor(container, false));
    container.addEventListener('blur', () => {
        if (shown) hover(shown, 'mouseleave');
        shown = null;
        // Si se va porque se redibuja (se quita de la página), el foco pasa al tablero nuevo; si
        // va a la tarjeta del enemigo o a los dados, volverá. Si va a otra cosa (Tab), lo suelta.
        setTimeout(() => {
            const now = container.ownerDocument.activeElement;
            if (container.isConnected && !now?.closest(FROM_BOARD) && !focusLost(container.ownerDocument)) setBoardFocused(false);
        }, 0);
    });

    draw(false);
    // El tablero de antes tenía el foco y se jugaba con el teclado: el nuevo lo recibe, aunque
    // entretanto el juego lo hubiera llevado a otro botón de la misma escena o de la barra de
    // combate. Con la tarjeta o los dados a la vista, no: el foco es suyo y vuelve después.
    const doc = container.ownerDocument;
    const scene = container.closest('.gs-scene-map');
    const active = doc.activeElement;
    const elsewhere = active && (scene?.contains(active) || active.closest('.gs-actions'));
    // Antes de la pelea sale la barra de colocar al grupo: la primera vez que se ve, el foco va a
    // su «Empezar» (lo que se hace casi siempre). Con Mayús+Tab se vuelve al tablero a mover a alguien.
    const placing = /** @type {HTMLElement|null} */ (doc.querySelector('.cv-place'));
    const start = /** @type {HTMLElement|null} */ (placing?.querySelector('.cv-place-start') ?? null);
    if (placing && start && !offered.has(placing) && keyboardInUse() && (focusLost(doc) || elsewhere || active === container)) {
        offered.add(placing);
        start.focus({ preventScroll: true });
        return;
    }
    if (memory.focused && keyboardInUse() && !active?.closest(FROM_BOARD) && (focusLost(doc) || elsewhere)) {
        container.focus({ preventScroll: true });
    }
}

/**
 * Para las pruebas: olvidar el cursor y el foco.
 */
export function resetBoardKeys() {
    memory.board = '';
    memory.x = -1;
    memory.y = -1;
    setBoardFocused(false);
}
