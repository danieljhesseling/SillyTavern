/**
 * J12.19 (Daniel, 2026-10-02: «quería que implementaras efectos cuando haga ataques o mueran,
 * porque ni se notan»). Cómo se ve un golpe según lo que lo hace —un tajo, una punzada, un
 * porrazo, una llamarada, escarcha, un rayo, luz sagrada…— y lo que se dice de quien cae.
 *
 * Arriba, lo puro: de un tipo de daño (o del arma, si no se sabe el tipo) a una forma de golpe; el
 * cartel de quien cae y las salvaciones de muerte que se ven. Abajo, las piezas que pone `fx.js`
 * en la ficha y el tablero: todo con CSS (combat-vtt.css, sección 7), nada de fuera.
 */

/**
 * @typedef {'cut'|'pierce'|'blunt'|'fire'|'cold'|'lightning'|'thunder'|'acid'|'poison'|'necrotic'|'radiant'|'force'|'psychic'|'heal'} ImpactKind
 *   (`heal`: la cura, unas chispas verdes que suben; no sale de `impactKind`).
 */

/** Las formas de golpe que se dibujan. */
export const IMPACT_KINDS = /** @type {const} */ ([
    'cut', 'pierce', 'blunt', 'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'necrotic', 'radiant', 'force', 'psychic', 'heal',
]);

/**
 * De las palabras a la forma, en orden: lo mágico antes que el arma («Rayo de fuego» es fuego) y
 * el tipo de daño antes que el nombre del arma. En castellano y en inglés (el catálogo de
 * conjuros los trae en inglés).
 *
 * @type {Array<[ImpactKind, RegExp]>}
 */
const WORDS = [
    ['fire', /fuego|fire|llama|ardient|quemad|abrasad/],
    ['cold', /fr[ií]o|cold|hielo|escarcha|helad/],
    ['lightning', /rel[aá]mpago|lightning|el[eé]ctric|\brayo\b(?! de)/],
    ['thunder', /trueno|thunder/],
    ['acid', /[aá]cido|acid/],
    ['poison', /venen|poison/],
    ['necrotic', /necr/],
    ['radiant', /radiant|sagrad/],
    ['force', /\bfuerza\b|force/],
    ['psychic', /ps[ií]quic|psychic/],
    ['cut', /cortante|slash|\bcorte|espad|hacha|cimitarra|guja|alabarda|garra|zarpa|sable|cuchill|segur/],
    ['pierce', /perforante|pierc|punz|daga|lanza|estoque|flecha|\barco\b|ballesta|virote|pica|tridente|jabalina|mordisc|colmillo|aguij|dardo|cerbatana/],
    ['blunt', /contundente|bludg|maza|martillo|porra|garrote|mayal|mazo|bast[oó]n|honda|pu[ñn]o|patada|piedra/],
];

/**
 * La forma de un golpe. Sin nada que la diga, por cómo sale: un disparo es una punzada, lo que
 * se tira, un porrazo, un conjuro, fuerza; y de cerca, un tajo.
 *
 * @param {string} [type] El tipo de daño («cortante», «fire») o el nombre del arma («hacha»).
 * @param {{style?: string}} [options] Cómo sale el golpe: melee, ranged, spell o throw.
 * @returns {ImpactKind}
 */
export function impactKind(type = '', { style = '' } = {}) {
    const said = String(type ?? '').toLowerCase();
    if (said) {
        for (const [kind, words] of WORDS) {
            if (words.test(said)) return kind;
        }
    }
    if (style === 'ranged') return 'pierce';
    if (style === 'throw') return 'blunt';
    if (style === 'spell') return 'force';
    return 'cut';
}

/**
 * Lo que se dice encima de quien cae, en la secuencia: «Cae Ratero del muelle»; uno de los tuyos,
 * «Nerea cae inconsciente» (o «Nerea ha muerto»).
 *
 * @param {{name: string, side: 'enemy'|'party', dead?: boolean}} who
 * @returns {string}
 */
export function downCaption({ name, side, dead = false }) {
    const said = String(name ?? '').trim() || 'Alguien';
    if (side === 'enemy') return `Cae ${said}`;
    return dead ? `${said} ha muerto` : `${said} cae inconsciente`;
}

/**
 * Las salvaciones de muerte que se ven debajo de quien está en el suelo: tres de cada, llenas
 * las que lleva. Estabilizado, lo dice.
 *
 * @param {{successes?: number, failures?: number, stable?: boolean}|null|undefined} saves
 * @returns {{successes: boolean[], failures: boolean[], stable: boolean, title: string}}
 */
export function deathPips(saves) {
    const ok = Math.max(0, Math.min(3, Math.floor(Number(saves?.successes) || 0)));
    const bad = Math.max(0, Math.min(3, Math.floor(Number(saves?.failures) || 0)));
    const stable = Boolean(saves?.stable);
    return {
        successes: [0, 1, 2].map(i => i < ok),
        failures: [0, 1, 2].map(i => i < bad),
        stable,
        title: stable
            ? 'Inconsciente, pero estabilizado: ya no tira salvaciones'
            : `Inconsciente: salvaciones de muerte, ${ok} de 3 éxitos y ${bad} de 3 fallos`,
    };
}

// ---------------------------------------------------------------- en la página

/**
 * @param {Document} doc
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function piece(doc, className, text) {
    const node = doc.createElement('span');
    node.className = className;
    if (text !== undefined) node.textContent = text;
    node.setAttribute('aria-hidden', 'true');
    return node;
}

/**
 * El golpe dibujado encima de la ficha: tres tajos, una punzada, una onda, una llamarada… Con
 * `still` (reducir movimiento), solo aparece y se apaga, sin moverse.
 *
 * @param {Document} doc
 * @param {ImpactKind} kind
 * @param {{crit?: boolean, still?: boolean, angle?: number, ms?: number}} [options]
 * @returns {HTMLElement}
 */
export function impactNode(doc, kind, { crit = false, still = false, angle = 0, ms = 600 } = {}) {
    const node = piece(doc, `vfx-impact vfx-impact-${kind}${crit ? ' vfx-impact-crit' : ''}${still ? ' vfx-still' : ''}`);
    node.style.setProperty('--vfx-angle', `${Number(angle) || 0}rad`);
    node.style.setProperty('--vfx-ms', `${Math.max(120, Math.round(Number(ms) || 600))}ms`);
    // Tres trazos: los tres tajos de un corte, las tres esquirlas del hielo, los rayos de la luz.
    for (let i = 0; i < 3; i++) node.appendChild(piece(doc, `vfx-impact-bit vfx-impact-bit-${i + 1}`));
    return node;
}

/**
 * Las salvaciones de muerte, en la ficha o en su fila: «Inconsciente» y los tres y tres puntos.
 *
 * @param {Document} doc
 * @param {{successes?: number, failures?: number, stable?: boolean}|null|undefined} saves
 * @param {{word?: string}} [options]
 * @returns {HTMLElement}
 */
export function deathSavesNode(doc, saves, { word = 'Inconsciente' } = {}) {
    const pips = deathPips(saves);
    const box = doc.createElement('span');
    box.className = `gs-death-saves${pips.stable ? ' gs-death-stable' : ''}`;
    box.title = pips.title;
    box.setAttribute('aria-label', pips.title);
    box.appendChild(piece(doc, 'gs-death-word', pips.stable ? 'Estable' : word));
    const row = piece(doc, 'gs-death-pips');
    for (const on of pips.successes) row.appendChild(piece(doc, `gs-death-pip gs-death-ok${on ? ' on' : ''}`));
    row.appendChild(piece(doc, 'gs-death-gap'));
    for (const on of pips.failures) row.appendChild(piece(doc, `gs-death-pip gs-death-bad${on ? ' on' : ''}`));
    box.appendChild(row);
    return box;
}

/**
 * La marca de quien ha caído, en su ficha (y en su casilla): una calavera si es un enemigo; si es
 * de los tuyos, un corazón roto (está en el suelo, no muerto).
 *
 * @param {Document} doc
 * @param {'enemy'|'party'} team
 * @returns {HTMLElement}
 */
export function downMarkNode(doc, team) {
    const node = piece(doc, `wm-token-down-mark wm-token-down-${team === 'party' ? 'party' : 'enemy'}`);
    const glyph = doc.createElement('i');
    glyph.className = `fa-solid ${team === 'party' ? 'fa-heart-crack' : 'fa-skull'}`;
    node.appendChild(glyph);
    return node;
}

/**
 * Si una ficha del tablero es de alguien caído: en pelea, con vida máxima y a 0. Quien espera sin
 * pelear todavía o la gente del lugar, nunca.
 *
 * @param {{hp?: number, maxHp?: number, idle?: boolean, isNPC?: boolean}|null|undefined} token
 * @param {boolean} fighting
 * @returns {boolean}
 */
export function isDownToken(token, fighting) {
    if (!fighting || !token || token.idle || token.isNPC) return false;
    return Number(token.maxHp) > 0 && (Number(token.hp) || 0) <= 0;
}
