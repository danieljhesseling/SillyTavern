/**
 * Tanda 10: los marcadores de borde. Un enemigo que queda fuera de la vista sale en el borde de
 * la pantalla, del lado por el que está, con su nombre y a cuántos pies («Tirador furtivo ·
 * 90 pies»). Pulsarlo lleva la cámara hasta él. Ver wiki/maquetas/ENCARGO_COMBATE_VTT.md.
 *
 * `placeEdgeMarkers` es puro (dónde va cada uno); `renderEdgeMarkers` los pone en la capa del HUD.
 */

/**
 * @typedef {Object} EdgeTarget
 * @property {number|string} id La ficha.
 * @property {string} name
 * @property {number} x Dónde cae en la pantalla (contado desde la esquina del tablero).
 * @property {number} y
 * @property {number} [feet] A cuántos pies está de quien tiene el turno.
 */

/**
 * @typedef {Object} EdgeMarker
 * @property {number|string} id
 * @property {string} name
 * @property {string} text Lo que dice: el nombre y la distancia.
 * @property {string} [feetText] Solo la distancia (« · 90 pies»), o nada: va en su propio trozo, que no encoge.
 * @property {number} left El centro del marcador.
 * @property {number} top
 * @property {number} angle Hacia dónde apunta su flecha, en grados (0 es a la derecha, 90 abajo).
 * @property {'top'|'right'|'bottom'|'left'} side
 */

/**
 * @param {any} value
 * @returns {number}
 */
function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lo que dice el marcador: «Tirador furtivo · 90 pies».
 *
 * @param {string} name
 * @param {number} [feet]
 * @returns {string}
 */
export function edgeText(name, feet) {
    const parts = edgeParts(name, feet);
    return parts.name + parts.feet;
}

/**
 * El marcador en dos trozos: el nombre (si no cabe, lleva puntos suspensivos) y la distancia
 * (« · 90 pies», que siempre se lee entera).
 *
 * @param {string} name
 * @param {number} [feet]
 * @returns {{name: string, feet: string}}
 */
export function edgeParts(name, feet) {
    const said = String(name ?? '').trim() || 'Alguien';
    return { name: said, feet: Number.isFinite(Number(feet)) && Number(feet) > 0 ? ` · ${Math.round(Number(feet))} pies` : '' };
}

/**
 * Dónde va el marcador de cada objetivo que no se ve: en el borde de `rect` (con `inset` de
 * margen), en la línea que va del centro de la vista hacia él. Los que se ven no llevan.
 * Dos marcadores que caerían encima se separan a lo largo del borde.
 *
 * @param {Object} input
 * @param {EdgeTarget[]} input.targets
 * @param {{left: number, top: number, right: number, bottom: number}} input.rect La parte que se mira.
 * @param {number} [input.inset] Lo que se aparta el marcador del borde.
 * @param {number} [input.gap] Lo que se separan dos marcadores en el mismo borde.
 * @returns {EdgeMarker[]}
 */
export function placeEdgeMarkers({ targets, rect, inset = 22, gap = 34 }) {
    const left = num(rect?.left) + inset;
    const top = num(rect?.top) + inset;
    const right = num(rect?.right) - inset;
    const bottom = num(rect?.bottom) - inset;
    if (right <= left || bottom <= top) return [];
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;

    /** @type {EdgeMarker[]} */
    const placed = [];
    for (const target of Array.isArray(targets) ? targets : []) {
        const x = num(target?.x);
        const y = num(target?.y);
        // Se ve (con el mismo margen): no lleva marcador.
        if (x >= num(rect?.left) && x <= num(rect?.right) && y >= num(rect?.top) && y <= num(rect?.bottom)) continue;
        const dx = x - cx;
        const dy = y - cy;
        // Lo que hay que andar desde el centro, en cada eje, para tocar el borde.
        const tx = dx === 0 ? Infinity : (dx > 0 ? right - cx : left - cx) / dx;
        const ty = dy === 0 ? Infinity : (dy > 0 ? bottom - cy : top - cy) / dy;
        const t = Math.max(0, Math.min(tx, ty, 1));
        /** @type {EdgeMarker['side']} */
        const side = tx <= ty ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
        placed.push({
            id: target.id,
            name: String(target.name ?? ''),
            text: edgeText(String(target.name ?? ''), target.feet),
            feetText: edgeParts(String(target.name ?? ''), target.feet).feet,
            left: cx + dx * t,
            top: cy + dy * t,
            angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
            side,
        });
    }

    // Que no se monten: en el mismo borde, cada uno a `gap` del anterior, a lo largo del borde.
    for (const side of /** @type {EdgeMarker['side'][]} */ (['top', 'right', 'bottom', 'left'])) {
        const along = side === 'top' || side === 'bottom' ? 'left' : 'top';
        const min = along === 'left' ? left : top;
        const max = along === 'left' ? right : bottom;
        const row = placed.filter(m => m.side === side).sort((a, b) => a[along] - b[along]);
        for (let i = 1; i < row.length; i++) {
            if (row[i][along] - row[i - 1][along] < gap) row[i][along] = row[i - 1][along] + gap;
        }
        // Si se han salido por el final, se empujan hacia atrás.
        for (let i = row.length - 1; i >= 0; i--) {
            const limit = i === row.length - 1 ? max : row[i + 1][along] - gap;
            if (row[i][along] > limit) row[i][along] = Math.max(min, limit);
        }
    }
    return placed;
}

/**
 * La esquina de arriba a la izquierda de un marcador de `width` × `height` puesto en su punto:
 * pegado al borde por dentro, y sin salirse de `bounds`.
 *
 * @param {EdgeMarker} marker
 * @param {number} width
 * @param {number} height
 * @param {{left: number, top: number, right: number, bottom: number}|null} [bounds]
 * @returns {{x: number, y: number}}
 */
export function markerBox(marker, width, height, bounds = null) {
    const w = Math.max(0, num(width));
    const h = Math.max(0, num(height));
    let x = marker.left - w / 2;
    let y = marker.top - h / 2;
    if (marker.side === 'right') x = marker.left - w;
    if (marker.side === 'left') x = marker.left;
    if (marker.side === 'top') y = marker.top;
    if (marker.side === 'bottom') y = marker.top - h;
    if (bounds) {
        x = Math.max(num(bounds.left) + 4, Math.min(num(bounds.right) - w - 4, x));
        y = Math.max(num(bounds.top) + 4, Math.min(num(bounds.bottom) - h - 4, y));
    }
    return { x, y };
}

/**
 * @typedef {{left: number, top: number, right: number, bottom: number}} Box
 */

/**
 * Aparta la caja de un marcador de las islas del HUD (la cámara, el minimapa, la barra de abajo):
 * si pisa alguna, se corre a lo largo de su borde hasta el lado libre más cercano de esa isla.
 * Si no hay sitio libre dentro de `bounds`, se queda donde estaba.
 *
 * @param {{x: number, y: number}} box La esquina de arriba a la izquierda (`markerBox`).
 * @param {number} width
 * @param {number} height
 * @param {EdgeMarker['side']} side
 * @param {Box[]} [avoid]
 * @param {Box|null} [bounds]
 * @returns {{x: number, y: number}}
 */
export function dodgeIslands(box, width, height, side, avoid = [], bounds = null) {
    const w = Math.max(0, num(width));
    const h = Math.max(0, num(height));
    const islands = (Array.isArray(avoid) ? avoid : []).filter(r => r && num(r.right) > num(r.left) && num(r.bottom) > num(r.top));
    const hits = (/** @type {{x: number, y: number}} */ at) => islands.find(r => at.x < num(r.right) && at.x + w > num(r.left) && at.y < num(r.bottom) && at.y + h > num(r.top)) ?? null;
    const inside = (/** @type {{x: number, y: number}} */ at) => !bounds
        || (at.x >= num(bounds.left) && at.x + w <= num(bounds.right) && at.y >= num(bounds.top) && at.y + h <= num(bounds.bottom));
    let at = { x: num(box?.x), y: num(box?.y) };
    // Unas pocas vueltas: al correrse de una isla puede caer en otra.
    for (let round = 0; round < 4; round++) {
        const hit = hits(at);
        if (!hit) return at;
        const alongY = side === 'left' || side === 'right';
        const options = alongY
            ? [{ x: at.x, y: num(hit.top) - h - 4 }, { x: at.x, y: num(hit.bottom) + 4 }]
            : [{ x: num(hit.left) - w - 4, y: at.y }, { x: num(hit.right) + 4, y: at.y }];
        options.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
        const next = options.find(inside);
        if (!next) break;
        at = next;
    }
    return hits(at) ? { x: num(box?.x), y: num(box?.y) } : at;
}

/**
 * Pone los marcadores en su capa. Cada uno es un botón: pulsarlo llama a `onPick` con su ficha.
 *
 * @param {HTMLElement} layer
 * @param {EdgeMarker[]} markers
 * @param {(id: number|string) => void} onPick
 * @param {Box|null} [bounds] De aquí no se salen.
 * @param {Box[]} [avoid] Las islas del HUD que no pisan (contadas como `bounds`).
 */
export function renderEdgeMarkers(layer, markers, onPick, bounds = null, avoid = []) {
    if (!layer) return;
    /** @type {Map<string, HTMLButtonElement>} */
    const before = new Map();
    for (const node of /** @type {HTMLButtonElement[]} */ ([...layer.querySelectorAll('.vtt-edge')])) before.set(String(node.dataset.tokenId), node);

    for (const marker of markers) {
        const key = String(marker.id);
        let button = before.get(key);
        before.delete(key);
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'vtt-edge vtt-island';
            button.dataset.tokenId = key;
            const icon = document.createElement('i');
            icon.className = 'vtt-edge-arrow fa-solid fa-location-arrow';
            icon.setAttribute('aria-hidden', 'true');
            // El nombre encoge (puntos suspensivos); los pies, no.
            const label = document.createElement('span');
            label.className = 'vtt-edge-text';
            const name = document.createElement('span');
            name.className = 'vtt-edge-name';
            const feet = document.createElement('span');
            feet.className = 'vtt-edge-feet';
            label.append(name, feet);
            button.append(icon, label);
            const id = marker.id;
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                onPick(id);
            });
            layer.appendChild(button);
        }
        const feetText = String(marker.feetText ?? '');
        const nameText = feetText && marker.text.endsWith(feetText) ? marker.text.slice(0, -feetText.length) : marker.text;
        const nameNode = /** @type {HTMLElement} */ (button.querySelector('.vtt-edge-name'));
        const feetNode = /** @type {HTMLElement} */ (button.querySelector('.vtt-edge-feet'));
        if (nameNode.textContent !== nameText) nameNode.textContent = nameText;
        if (feetNode.textContent !== feetText) feetNode.textContent = feetText;
        feetNode.hidden = !feetText;
        button.title = `${marker.text}. Pulsa para ir a verlo`;
        button.setAttribute('aria-label', button.title);
        button.dataset.side = marker.side;
        // La flecha de Font Awesome apunta arriba a la derecha (-45°).
        const arrow = /** @type {HTMLElement} */ (button.querySelector('.vtt-edge-arrow'));
        arrow.style.transform = `rotate(${marker.angle + 45}deg)`;
        const box = dodgeIslands(markerBox(marker, button.offsetWidth, button.offsetHeight, bounds),
            button.offsetWidth, button.offsetHeight, marker.side, avoid, bounds);
        button.style.left = `${Math.round(box.x)}px`;
        button.style.top = `${Math.round(box.y)}px`;
    }
    for (const stale of before.values()) stale.remove();
}
