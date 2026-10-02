/**
 * Tanda 10: el resumen del combate, debajo de la iniciativa. Sustituye a la franja del registro
 * que iba al pie del tablero y se comía un cuarto del alto: aquí se pliega con un botón y, plegado,
 * deja ver lo último que ha pasado en una línea. Ver wiki/maquetas/ENCARGO_COMBATE_VTT.md.
 *
 * Por dentro lleva las mismas piezas que el registro de antes (`.cl-filters`, `.cl-body`,
 * `.cl-round-badge`), así que lo pintan las mismas funciones (`renderCombatLog`, `renderLogFilters`,
 * `setRound` de `ui/combat-log.js`), con sus filtros de idea 20.
 */

/** Dónde se recuerda si quien juega lo dejó plegado: es cosa de su navegador, no de la partida. */
export const SUMMARY_FOLD_KEY = 'sillytavern_vttSummaryFolded';

/**
 * Si el resumen sale plegado: lo que dejó quien juega o, si nunca lo tocó, plegado en una
 * pantalla estrecha (un teléfono) y abierto en las demás.
 *
 * @param {string|null} stored Lo guardado ('true', 'false' o nada).
 * @param {number} viewportWidth
 * @returns {boolean}
 */
export function startsFolded(stored, viewportWidth) {
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return Number(viewportWidth) > 0 && Number(viewportWidth) < 700;
}

/** @returns {string|null} */
function readFold() {
    try {
        return globalThis.localStorage?.getItem(SUMMARY_FOLD_KEY) ?? null;
    } catch {
        return null;
    }
}

/** @param {boolean} folded */
function writeFold(folded) {
    try {
        globalThis.localStorage?.setItem(SUMMARY_FOLD_KEY, String(folded));
    } catch {
        // Sin almacenamiento (ventana privada): se pliega igual, solo que no se recuerda.
    }
}

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
 * La isla del resumen. `title` es su rótulo.
 *
 * @param {{title?: string}} [options]
 * @returns {HTMLElement}
 */
export function buildSummary({ title = 'Resumen del combate' } = {}) {
    const panel = el('section', 'vtt-summary vtt-island');
    panel.setAttribute('aria-label', title);
    const folded = startsFolded(readFold(), globalThis.innerWidth || 0);
    panel.classList.toggle('collapsed', folded);

    const head = el('div', 'vtt-summary-head');
    const label = el('span', 'vtt-summary-title');
    const icon = el('i', 'fa-solid fa-feather-pointed');
    icon.setAttribute('aria-hidden', 'true');
    label.append(icon, document.createTextNode(` ${title}`));
    const badge = el('span', 'cl-round-badge');
    badge.style.display = 'none';
    const toggle = /** @type {HTMLButtonElement} */ (el('button', 'vtt-summary-toggle'));
    toggle.type = 'button';
    const chevron = el('i', 'fa-solid');
    chevron.setAttribute('aria-hidden', 'true');
    toggle.appendChild(chevron);
    head.append(label, badge, toggle);

    // Plegado, lo último que ha pasado, en una línea.
    const last = el('div', 'vtt-summary-last');
    const filters = el('div', 'cl-filters');
    const body = el('div', 'cl-body vtt-summary-list');
    body.setAttribute('aria-live', 'polite');
    panel.append(head, last, filters, body);

    const sync = () => {
        const isFolded = panel.classList.contains('collapsed');
        chevron.className = `fa-solid ${isFolded ? 'fa-chevron-down' : 'fa-chevron-up'}`;
        toggle.title = isFolded ? 'Desplegar el resumen' : 'Plegar el resumen';
        toggle.setAttribute('aria-label', toggle.title);
        toggle.setAttribute('aria-expanded', String(!isFolded));
    };
    sync();
    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        panel.classList.toggle('collapsed');
        writeFold(panel.classList.contains('collapsed'));
        sync();
    });

    // La última línea, cada vez que el registro pinta algo.
    const showLast = () => {
        const rows = body.querySelectorAll('.cl-row');
        const text = rows.length > 0 ? (rows[rows.length - 1].textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (last.textContent !== text) last.textContent = text;
    };
    if (typeof MutationObserver === 'function') new MutationObserver(showLast).observe(body, { childList: true });
    return panel;
}
