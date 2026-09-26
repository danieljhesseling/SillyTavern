/**
 * Una sola crónica: lo que pasó, con categoría, sacado de lo que el juego ya cuenta (U4 del
 * pegamento).
 *
 * El juego avisa en el chat con más de cuarenta etiquetas —`[GREMIO]`, `[POSADA]`,
 * `[RIVALES]`, `[HILO]`…—, cada sistema con la suya, y además apunta lo que pasó en diez
 * registros distintos. El diario, la memoria del narrador y el resumen por acto leían cada
 * uno de un sitio, y el chat, con tanto aviso, se volvía ruido.
 *
 * Aquí las etiquetas se quedan en unas pocas categorías, y cada línea del chat que lleva una
 * se lee como un suceso: categoría, texto y si es de las menores (las que se pliegan en el
 * chat). No hace falta tocar los ciento y pico sitios que avisan: su etiqueta ya dice qué son.
 *
 * Puro: de texto a sucesos, y cómo plegarlos. Quien llama dibuja.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U4.
 */

/** Las categorías, en el orden en que salen en el diario. */
export const CATEGORIES = {
    hilo: 'El hilo',
    grupo: 'El grupo',
    mundo: 'El mundo',
    gremio: 'El gremio',
    combate: 'Combate',
    comercio: 'Pueblo y comercio',
    viaje: 'Viaje',
    campamento: 'Campamento',
    partida: 'La partida',
    otros: 'Otras',
};

/** @typedef {keyof typeof CATEGORIES} Category */

/**
 * Cada etiqueta, en su categoría. Lo que no está aquí va a «otros», y el comprobador de la
 * crónica (las pruebas) avisa si una etiqueta del código se queda sin sitio.
 *
 * @type {Record<string, Category>}
 */
export const TAG_CATEGORIES = {
    'HILO': 'hilo', 'PISTA': 'hilo', 'PRESAGIO': 'hilo', 'SECRETO': 'hilo', 'INTERROGATORIO': 'hilo', 'VILLANO': 'hilo', 'RESUMEN': 'hilo', 'CASO': 'hilo',
    'GRUPO': 'grupo', 'VINCULO': 'grupo', 'ROCE': 'grupo', 'SE VA': 'grupo', 'HARTO': 'grupo', 'MUERTE': 'grupo', 'NIVEL': 'grupo',
    'RELIQUIA': 'grupo', 'APRENDIZAJE': 'grupo', 'ENCARGO PERSONAL': 'grupo', 'MASCOTA': 'grupo',
    'MUNDO': 'mundo', 'EL MUNDO CAMBIA': 'mundo', 'RIVALES': 'mundo', 'NOTICIAS': 'mundo', 'RUMOR': 'mundo', 'GENTE': 'mundo',
    'FIESTA': 'mundo', 'CARTA': 'mundo', 'GUARDIAS': 'mundo', 'DIRECTOR': 'mundo', 'DUELO': 'mundo', 'NEMESIS': 'mundo',
    'GREMIO': 'gremio', 'ENCARGO': 'gremio',
    'COMBAT': 'combate', 'BOARD': 'combate', 'TABLERO': 'combate',
    'TIENDA': 'comercio', 'POSADA': 'comercio', 'TABERNA': 'comercio', 'TEMPLO': 'comercio', 'HERRERÍA': 'comercio', 'ROBO': 'comercio',
    'CAMPAÑA': 'viaje', 'EXPLORAR': 'viaje', 'ATAJO': 'viaje', 'CAMPO': 'viaje',
    'CAMPAMENTO': 'campamento', 'CHARLA': 'campamento', 'DESCANSO': 'campamento',
    'PARTIDA': 'partida', 'CAMPANA': 'partida', 'MODO': 'partida',
};

/**
 * Las categorías menores: en el chat se pliegan cuando van varias seguidas. Lo que mueve la
 * historia (el hilo, el grupo, el mundo, el gremio, la partida) no se pliega nunca.
 */
export const MINOR = new Set(['combate', 'comercio', 'viaje', 'campamento']);

/**
 * @typedef {Object} ChronicleEntry
 * @property {number} index Dónde está en el chat.
 * @property {string} tag
 * @property {Category} category
 * @property {string} text El texto sin el emoji ni la etiqueta.
 * @property {boolean} minor
 */

/**
 * Leer una línea del juego: `🩹 [CAMPAÑA] Bran: costilla rota, curado.`
 *
 * @param {string} said
 * @returns {{tag: string, category: Category, text: string, minor: boolean}|null} Nada si no lleva etiqueta.
 */
export function readTaggedLine(said) {
    const match = /^\s*(?:[^\s[\]]{1,4}\s+)?\[([A-ZÁÉÍÓÚÑ ]{3,22})\]\s*([\s\S]*)$/u.exec(String(said ?? ''));
    if (!match) return null;
    const tag = match[1].trim();
    const category = TAG_CATEGORIES[tag] ?? 'otros';
    return { tag, category, text: match[2].trim(), minor: MINOR.has(category) };
}

/**
 * La crónica de un chat: cada mensaje del juego con etiqueta, como suceso.
 *
 * @param {Array<{mes?: string, is_user?: boolean}>} chat
 * @returns {ChronicleEntry[]}
 */
export function chronicleOf(chat) {
    /** @type {ChronicleEntry[]} */
    const out = [];
    (Array.isArray(chat) ? chat : []).forEach((message, index) => {
        if (!message || message.is_user) return;
        const line = readTaggedLine(String(message.mes ?? ''));
        if (line) out.push({ index, ...line });
    });
    return out;
}

/**
 * La crónica en secciones para el diario: por categoría, lo último arriba.
 *
 * @param {ChronicleEntry[]} entries
 * @param {Object} [options]
 * @param {Category|''} [options.only] Solo una categoría.
 * @param {number} [options.limit] Cuántas líneas por categoría.
 * @returns {Array<{category: Category, title: string, items: string[]}>}
 */
export function chronicleSections(entries, { only = '', limit = 12 } = {}) {
    return /** @type {Category[]} */ (Object.keys(CATEGORIES))
        .filter(category => !only || category === only)
        .map(category => ({
            category,
            title: CATEGORIES[category],
            items: entries.filter(e => e.category === category).slice(-limit).reverse().map(e => e.text.split('\n')[0]),
        }))
        .filter(section => section.items.length > 0);
}

/**
 * Cómo plegar el chat: cada tanda de sucesos menores seguidos (dos o más) se queda en el
 * último, con un «y N más» para abrir el resto. Un mensaje sin etiqueta o uno importante
 * corta la tanda.
 *
 * @param {Array<{index: number, minor: boolean}|null>} lines Una por mensaje del chat, en orden;
 *   nada para los que no son del juego.
 * @returns {Array<{hide: number[], show: number, categories: string[]}>}
 */
export function foldPlan(lines) {
    /** @type {Array<{hide: number[], show: number, categories: string[]}>} */
    const plan = [];
    /** @type {Array<any>} */
    let run = [];
    const close = () => {
        if (run.length >= 2) {
            plan.push({
                hide: run.slice(0, -1).map(line => line.index),
                show: run[run.length - 1].index,
                categories: [...new Set(run.slice(0, -1).map(line => line.category).filter(Boolean))],
            });
        }
        run = [];
    };
    for (const line of Array.isArray(lines) ? lines : []) {
        if (line && line.minor) run.push(line);
        else close();
    }
    close();
    return plan;
}

/**
 * Lo que dice el botón de una tanda plegada: «y 6 más: combate, pueblo y comercio».
 *
 * @param {{hide: number[], categories: string[]}} fold
 * @returns {string}
 */
export function describeFold(fold) {
    const names = fold.categories.map(c => (CATEGORIES[/** @type {Category} */ (c)] ?? c).toLowerCase());
    return `y ${fold.hide.length} más${names.length > 0 ? `: ${names.join(', ')}` : ''}`;
}
