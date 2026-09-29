/**
 * Las etiquetas del motor, fuera de lo que se lee (J18.10 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor marca cada línea que deja en el chat con su etiqueta —«📜 [HILO]», «🗣️ [DUELO]»,
 * «[GREMIO]», «[RUMOR]», «[VIAJE]»…— para que el modelo sepa de dónde viene. Quien juega no
 * la necesita: en la caja de la novela visual se leía «[HILO] Hecho: El ratero del muelle.»
 * encima de la prosa. Aquí se quitan:
 *
 * - la etiqueta del principio de cada línea, con su emoji si lo lleva;
 * - y las líneas «Hecho: …» del hilo, que son el apunte del Diario, no lo que pasa.
 *
 * El mensaje no se toca: lo que se limpia es la copia que pinta la caja. En el registro (el
 * chat de siempre) la etiqueta se envuelve en un `<span class="gs-engine-tag">` que el Modo
 * Juego esconde en las partidas sin conexión; fuera del juego se ve como siempre.
 */

/**
 * La etiqueta del principio de una línea: un emoji opcional y una palabra en mayúsculas entre
 * corchetes («🔮 [HILO] », «[PRESAGIO] », «🗡️ [SE UNE AL GRUPO] »).
 */
const TAG = /^\s*(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][️‍\p{Extended_Pictographic}]*\s*)?\[[\p{Lu}][\p{Lu}\p{N} ]{0,30}\]\s*/u;

/** El apunte de un hito cumplido: «Hecho: La prueba del gremio.». Va al Diario, no a la caja. */
const DONE = /^Hecho:\s/u;

/** Lo que parte líneas en el HTML de un mensaje. */
const BLOCKS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'TABLE', 'HR']);

/**
 * Cuánto mide la etiqueta del principio de un texto (0 si no la hay).
 *
 * @param {string} text
 * @returns {number}
 */
export function tagLength(text) {
    const found = TAG.exec(String(text ?? ''));
    return found ? found[0].length : 0;
}

/**
 * Un texto sin las etiquetas del motor ni los apuntes «Hecho:», línea a línea.
 *
 * @param {string} text
 * @returns {string} La prosa. Vacía si no quedaba nada más que la etiqueta.
 */
export function stripEngineTags(text) {
    return String(text ?? '')
        .split('\n')
        .map(line => line.slice(tagLength(line)))
        .filter(line => !DONE.test(line.trim()))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Las líneas de un bloque de HTML: los nodos de cada una, y el `<br>` que la cierra.
 *
 * @param {Node} root
 * @returns {Array<{nodes: Node[], br: Node|null}>}
 */
function linesOf(root) {
    /** @type {Array<{nodes: Node[], br: Node|null}>} */
    const lines = [];
    /** @type {{nodes: Node[], br: Node|null}} */
    let current = { nodes: [], br: null };
    const close = (/** @type {Node|null} */ br) => {
        current.br = br;
        if (current.nodes.length > 0 || br) lines.push(current);
        current = { nodes: [], br: null };
    };
    const walk = (/** @type {Node} */ node) => {
        for (const child of [...node.childNodes]) {
            if (child.nodeName === 'BR') {
                close(child);
            } else if (child.nodeType === 1 && BLOCKS.has(child.nodeName)) {
                close(null);
                walk(child);
                close(null);
            } else {
                current.nodes.push(child);
            }
        }
    };
    walk(root);
    close(null);
    return lines;
}

/**
 * Quitar los primeros `count` caracteres de unos nodos, en orden, bajando a los de dentro.
 *
 * @param {Node[]} nodes
 * @param {number} count
 * @returns {number} Lo que quedaba por quitar.
 */
function trimStart(nodes, count) {
    let left = count;
    for (const node of nodes) {
        if (left <= 0) break;
        const length = (node.textContent ?? '').length;
        if (length <= left) {
            node.parentNode?.removeChild(node);
            left -= length;
        } else if (node.nodeType === 3) {
            node.textContent = String(node.textContent).slice(left);
            left = 0;
        } else {
            left = trimStart([...node.childNodes], left);
        }
    }
    return left;
}

/**
 * La copia de un mensaje que pinta la caja, sin etiquetas ni apuntes «Hecho:». Cambia el nodo
 * que recibe: se le pasa un clon, nunca el del chat.
 *
 * @param {Element} copy
 * @returns {boolean} Si queda algo que leer.
 */
export function cleanNovelCopy(copy) {
    for (const line of linesOf(copy)) {
        const said = line.nodes.map(n => n.textContent ?? '').join('');
        const cut = tagLength(said);
        if (DONE.test(said.slice(cut).trim())) {
            for (const node of line.nodes) node.parentNode?.removeChild(node);
            line.br?.parentNode?.removeChild(line.br);
            continue;
        }
        if (cut > 0) trimStart(line.nodes, cut);
    }
    // Un párrafo que se ha quedado en nada no deja su hueco.
    for (const block of [...copy.querySelectorAll('p, div, li')]) {
        if (!(block.textContent ?? '').trim() && !block.querySelector('img')) block.remove();
    }
    return Boolean((copy.textContent ?? '').trim());
}

/**
 * En el registro, envolver la etiqueta del principio de cada línea en un
 * `<span class="gs-engine-tag">`, que el Modo Juego esconde sin conexión. No borra nada: fuera
 * del juego, el chat se ve como estaba. Solo si la etiqueta cabe entera en un texto.
 *
 * @param {Element} body El `.mes_text` de un mensaje del chat.
 * @returns {number} Cuántas etiquetas ha envuelto.
 */
export function markEngineTags(body) {
    let marked = 0;
    for (const line of linesOf(body)) {
        const first = line.nodes.find(n => (n.textContent ?? '').trim().length > 0);
        if (!first || first.nodeType !== 3) continue;
        const text = String(first.textContent);
        const cut = tagLength(text);
        if (cut === 0) continue;
        const rest = /** @type {Text} */ (first).splitText(cut);
        const span = (first.ownerDocument ?? document).createElement('span');
        span.className = 'gs-engine-tag';
        first.parentNode?.insertBefore(span, rest);
        span.appendChild(first);
        marked += 1;
    }
    return marked;
}
