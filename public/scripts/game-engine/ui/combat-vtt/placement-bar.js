/**
 * La barra de colocar al grupo antes de la pelea (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * Una isla del HUD, abajo en el centro, como la barra de acciones de la maqueta: lo que pasa
 * («Colocad al grupo antes de la iniciativa»), las caras de los tuyos (pulsar una la elige; a
 * quien coloca el juego, apagado y diciendo por qué) y el botón «Empezar». El tablero enciende
 * en azul las casillas de salida; pulsar una pone ahí al elegido.
 *
 * Solo dibuja y avisa: colocar y empezar lo hace quien la monta (`party/fight-entry.js`). Intro
 * empieza, salvo con una ventana delante o escribiendo.
 */

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
 * @typedef {Object} PlacementFace Alguien del grupo, como sale en la barra.
 * @property {string} id
 * @property {string} name
 * @property {string} [face] Su cara (una URL), o vacío: su inicial.
 * @property {boolean} [locked] Lo coloca el juego.
 * @property {boolean} [selected] El elegido ahora.
 */

/**
 * @typedef {Object} PlacementView
 * @property {string} title «Colocad al grupo» o «¡Emboscada!».
 * @property {string} hint Qué hacer, en una línea.
 * @property {PlacementFace[]} members
 * @property {boolean} [ambush]
 */

/**
 * Montar la barra.
 *
 * @param {Object} input
 * @param {PlacementView} input.view
 * @param {(id: string) => void} input.onSelect Pulsar una cara.
 * @param {() => void} input.onStart «Empezar».
 * @param {HTMLElement|null} [input.mount] Dónde va (el Modo Juego, si está abierto).
 * @returns {{update: (view: PlacementView) => void, destroy: () => void, root: HTMLElement}}
 */
export function mountPlacementBar({ view, onSelect, onStart, mount = null }) {
    document.querySelectorAll('.cv-place').forEach(old => old.remove());
    const root = el('div', 'cv-place cv-island');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Colocar al grupo');
    const head = el('div', 'cv-place-head');
    const icon = el('i', 'fa-solid fa-chess-pawn');
    const title = el('span', 'cv-place-title');
    head.append(icon, title);
    const hint = el('div', 'cv-place-hint');
    hint.setAttribute('aria-live', 'polite');
    const faces = el('div', 'cv-place-faces');
    const start = /** @type {HTMLButtonElement} */ (el('button', 'cv-place-start'));
    start.type = 'button';
    start.dataset.placeStart = '';
    start.title = 'Empezar la pelea: se tira la iniciativa (Intro)';
    start.append(el('i', 'fa-solid fa-flag'), el('span', '', 'Empezar'));
    start.addEventListener('click', (event) => {
        event.stopPropagation();
        onStart();
    });
    const body = el('div', 'cv-place-body');
    body.append(head, hint, faces);
    root.append(body, start);
    // Los clics de la isla son de la isla: no llegan al tablero de debajo.
    for (const kind of ['pointerdown', 'mousedown', 'touchstart', 'wheel']) {
        root.addEventListener(kind, event => event.stopPropagation(), { passive: true });
    }

    const draw = (/** @type {PlacementView} */ next) => {
        root.classList.toggle('cv-place-ambush', Boolean(next.ambush));
        icon.className = `fa-solid ${next.ambush ? 'fa-triangle-exclamation' : 'fa-chess-pawn'}`;
        title.textContent = text(next.title);
        hint.textContent = text(next.hint);
        faces.textContent = '';
        for (const member of next.members ?? []) {
            const button = /** @type {HTMLButtonElement} */ (el('button', 'cv-place-face'));
            button.type = 'button';
            button.dataset.placeId = member.id;
            button.classList.toggle('selected', Boolean(member.selected));
            button.classList.toggle('locked', Boolean(member.locked));
            button.setAttribute('aria-pressed', member.selected ? 'true' : 'false');
            button.title = member.locked ? `A ${member.name} lo coloca el juego` : `Colocar a ${member.name}`;
            const ring = el('span', 'cv-place-ring');
            if (member.face) {
                const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
                image.src = member.face;
                image.alt = '';
                image.addEventListener('error', () => {
                    image.remove();
                    ring.textContent = text(member.name).charAt(0).toUpperCase();
                });
                ring.appendChild(image);
            } else {
                ring.textContent = text(member.name).charAt(0).toUpperCase();
            }
            button.appendChild(ring);
            button.appendChild(el('span', 'cv-place-name', member.name));
            if (member.locked) button.appendChild(el('i', 'fa-solid fa-robot cv-place-lock'));
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!member.locked) onSelect(member.id);
            });
            faces.appendChild(button);
        }
    };

    const onKey = (/** @type {KeyboardEvent} */ event) => {
        if (event.key !== 'Enter' || event.defaultPrevented) return;
        const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target : null);
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        // Un botón con el foco hace lo suyo con Intro; y con una ventana delante, la tecla es suya.
        if (tag === 'button' && target !== start) return;
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        onStart();
    };
    document.addEventListener('keydown', onKey);

    draw(view);
    (mount ?? document.body).appendChild(root);

    return {
        root,
        update: (next) => draw(next),
        destroy: () => {
            document.removeEventListener('keydown', onKey);
            root.remove();
        },
    };
}
