/**
 * El cartel de una pelea sin muertes (J12.7 de wiki/ROADMAP_SIN_CONEXION.md): al empezar, la
 * regla dicha claro (a puñetazos, quien cae queda fuera de combate, la magia que hiere no vale)
 * y, en un duelo, quién mira.
 *
 * Como el cartel de la iniciativa: no decide nada ni roba clics; se va solo. El estilo, en
 * peleas-taberna.css (`br-*`).
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className, content = '') {
    const node = document.createElement(tag);
    node.className = className;
    if (content) node.textContent = content;
    return node;
}

/**
 * Enseñar el cartel.
 *
 * @param {Object} input
 * @param {string} input.title «Pelea en la taberna», «Duelo con Rosa la Remera».
 * @param {string} input.rule La regla, en una frase.
 * @param {string} [input.stakes] Lo que hay en juego («10 de oro en la mesa»).
 * @param {string[]} [input.watching] Los tuyos que miran, por su nombre.
 * @param {number} [input.ms] Cuánto se queda.
 * @param {HTMLElement|null} [input.mount]
 * @returns {HTMLElement}
 */
export function showBrawlBanner({ title, rule, stakes = '', watching = [], ms = 4800, mount = null }) {
    document.querySelectorAll('.br-banner').forEach(node => node.remove());
    const root = el('div', 'br-banner');
    root.setAttribute('role', 'status');
    const head = el('div', 'br-title');
    head.appendChild(el('i', 'fa-solid fa-hand-fist'));
    head.appendChild(document.createTextNode(` ${text(title)}`));
    root.appendChild(head);
    root.appendChild(el('div', 'br-rule', text(rule)));
    if (text(stakes)) root.appendChild(el('div', 'br-stakes', text(stakes)));
    const names = (Array.isArray(watching) ? watching : []).map(text).filter(Boolean);
    if (names.length > 0) root.appendChild(el('div', 'br-watch', `Miran desde la pared: ${names.join(', ')}.`));
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(root);
    root.addEventListener('click', () => root.remove());
    setTimeout(() => root.classList.add('br-out'), Math.max(800, ms - 700));
    setTimeout(() => root.remove(), Math.max(1500, ms));
    return root;
}
