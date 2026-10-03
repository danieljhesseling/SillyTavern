/**
 * J12.18 (Daniel, 2026-10-02: «que los enemigos que vayan a ser afectados por el movimiento
 * brillen en rojo cuando pases sobre la opción de usar ese ataque o habilidad sobre ellos; si es
 * un aliado, que brille en azul, para dar al usuario un feedback visual»).
 *
 * Al pasar por una tarjeta o por un objetivo del menú de la barra (o al tocarlo una vez con el
 * dedo), se encienden en el tablero las fichas de quienes se llevarían lo que hace: en **rojo** a
 * quien le haría daño (un enemigo, o uno de los tuyos que pille un área), en **azul** a quien le
 * cura o le ayuda. Su fila de la iniciativa, igual. Un área enseña además sus casillas, con todos
 * los de dentro encendidos. Al salir, se apaga.
 *
 * Lo que se enciende viene ya decidido en el menú (`MenuItem.aim`, de `action-menus.js`): aquí
 * solo se pinta. Los colores, en combat-vtt.css (sección 7).
 */

/**
 * @typedef {import('./action-menus.js').Aim} Aim
 * @typedef {import('./action-menus.js').AimMark} AimMark
 */

/** La clase de cada tono, en las fichas y en las filas de la iniciativa. */
export const AIM_CLASSES = Object.freeze({ harm: 'gs-aim-harm', help: 'gs-aim-help' });

/** Lo que se ha encendido, para apagarlo. */
const lit = /** @type {Set<Element>} */ (new Set());

/**
 * Las clases que lleva cada ficha y cada fila con lo que se apunta: a quien se le hace daño y a
 * quien se le ayuda a la vez (un área que cura a unos y pega a otros no existe, pero por si acaso),
 * gana el rojo: avisar de un golpe vale más.
 *
 * @param {Aim|null|undefined} aim
 * @returns {{tokens: Map<string, string>, rows: Map<string, string>}}
 */
export function aimClassMap(aim) {
    /** @type {Map<string, string>} */
    const tokens = new Map();
    /** @type {Map<string, string>} */
    const rows = new Map();
    for (const mark of Array.isArray(aim?.marks) ? aim.marks : []) {
        const cls = mark.tone === 'help' ? AIM_CLASSES.help : AIM_CLASSES.harm;
        const put = (/** @type {Map<string, string>} */ map, /** @type {string} */ key) => {
            if (!key) return;
            if (map.get(key) === AIM_CLASSES.harm) return;
            map.set(key, cls);
        };
        put(tokens, mark.token === undefined || mark.token === null ? '' : String(mark.token));
        put(rows, String(mark.id ?? ''));
    }
    return { tokens, rows };
}

/**
 * Las casillas de un área, como cajas (en px dentro del tablero), con su borde por fuera: se lee
 * como una zona, igual que el alcance azul de tu ficha.
 *
 * @param {Array<{x: number, y: number}>} cells
 * @param {number} cellW
 * @param {number} cellH
 * @returns {Array<{left: number, top: number, width: number, height: number, edge: string}>}
 */
export function areaBoxes(cells, cellW, cellH) {
    const list = Array.isArray(cells) ? cells.filter(c => Number.isFinite(Number(c?.x)) && Number.isFinite(Number(c?.y))) : [];
    const on = new Set(list.map(c => `${Number(c.x)},${Number(c.y)}`));
    return list.map((c) => {
        const x = Number(c.x);
        const y = Number(c.y);
        const edge = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]
            .filter(([, dx, dy]) => !on.has(`${x + Number(dx)},${y + Number(dy)}`))
            .map(([side]) => side).join('');
        return { left: x * cellW, top: y * cellH, width: cellW, height: cellH, edge };
    });
}

/**
 * @param {Document} doc
 * @returns {HTMLElement|null}
 */
function boardTokens(doc) {
    return /** @type {HTMLElement|null} */ (doc.querySelector('#game-shell .wm-tokens-layer') ?? doc.querySelector('.wm-vtt .wm-tokens-layer'));
}

/**
 * La capa de las casillas del área: en el tablero, debajo de las fichas.
 *
 * @param {Document} doc
 * @returns {{layer: HTMLElement, cellW: number, cellH: number}|null}
 */
function areaLayer(doc) {
    const tokens = boardTokens(doc);
    const content = tokens?.parentElement;
    if (!tokens || !content) return null;
    const gridW = Number(tokens.dataset.gridW) || 0;
    const gridH = Number(tokens.dataset.gridH) || 0;
    const width = tokens.offsetWidth || parseFloat(tokens.style.width) || 0;
    const height = tokens.offsetHeight || parseFloat(tokens.style.height) || 0;
    if (!(gridW > 0) || !(gridH > 0) || !(width > 0) || !(height > 0)) return null;
    let layer = /** @type {HTMLElement|null} */ (content.querySelector(':scope > .gs-aim-layer'));
    if (!layer) {
        layer = doc.createElement('div');
        layer.className = 'gs-aim-layer';
        layer.setAttribute('aria-hidden', 'true');
        content.insertBefore(layer, tokens);
    }
    return { layer, cellW: width / gridW, cellH: height / gridH };
}

/**
 * Encender lo que se apunta (y apagar lo de antes).
 *
 * @param {Aim|null|undefined} aim
 * @param {Document} [doc]
 */
export function showAim(aim, doc = document) {
    clearAim(doc);
    if (!aim || !doc) return;
    const { tokens, rows } = aimClassMap(aim);
    if (tokens.size > 0) {
        for (const token of doc.querySelectorAll('#game-shell .wm-token[data-token-id]')) {
            const cls = tokens.get(String(/** @type {HTMLElement} */ (token).dataset.tokenId));
            if (!cls) continue;
            token.classList.add(cls);
            lit.add(token);
        }
    }
    if (rows.size > 0) {
        for (const row of doc.querySelectorAll('#game-shell .wm-init-row[data-entry-id]')) {
            const cls = rows.get(String(/** @type {HTMLElement} */ (row).dataset.entryId));
            if (!cls) continue;
            row.classList.add(cls);
            lit.add(row);
        }
    }
    const cells = Array.isArray(aim.cells) ? aim.cells : [];
    if (cells.length > 0) {
        const place = areaLayer(doc);
        if (place) {
            const tone = aim.cellsTone === 'help' ? 'help' : 'harm';
            place.layer.textContent = '';
            place.layer.dataset.tone = tone;
            for (const box of areaBoxes(cells, place.cellW, place.cellH)) {
                const cell = doc.createElement('div');
                cell.className = 'gs-aim-cell';
                cell.dataset.edge = box.edge;
                Object.assign(cell.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
                place.layer.appendChild(cell);
            }
            place.layer.classList.add('on');
        }
    }
    doc.documentElement.dataset.gsAim = 'on';
}

/**
 * Apagarlo todo.
 *
 * @param {Document} [doc]
 */
export function clearAim(doc = document) {
    if (!doc) return;
    for (const node of lit) node.classList.remove(AIM_CLASSES.harm, AIM_CLASSES.help);
    lit.clear();
    // Lo que se encendió antes de un redibujado ya no está en la lista: se busca.
    for (const node of doc.querySelectorAll(`.${AIM_CLASSES.harm}, .${AIM_CLASSES.help}`)) node.classList.remove(AIM_CLASSES.harm, AIM_CLASSES.help);
    for (const layer of doc.querySelectorAll('.gs-aim-layer')) {
        layer.textContent = '';
        layer.classList.remove('on');
    }
    delete doc.documentElement.dataset.gsAim;
}

/**
 * Lo que está encendido ahora, para las pruebas y para mirarlo desde la consola.
 *
 * @param {Document} [doc]
 * @returns {{harm: string[], help: string[], rows: string[], cells: number}}
 */
export function aimState(doc = document) {
    const ids = (/** @type {string} */ cls) => [...doc.querySelectorAll(`#game-shell .wm-token.${cls}`)].map(t => String(/** @type {HTMLElement} */ (t).dataset.tokenId));
    return {
        harm: ids(AIM_CLASSES.harm),
        help: ids(AIM_CLASSES.help),
        rows: [...doc.querySelectorAll(`#game-shell .wm-init-row.${AIM_CLASSES.harm}, #game-shell .wm-init-row.${AIM_CLASSES.help}`)].map(r => String(/** @type {HTMLElement} */ (r).dataset.entryId)),
        cells: doc.querySelectorAll('.gs-aim-layer.on .gs-aim-cell').length,
    };
}
