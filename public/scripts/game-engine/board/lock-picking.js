/**
 * E2.2 de wiki/ROADMAP_ENTRETENIDO.md: forzar cerraduras con riesgo.
 *
 * Una puerta cerrada con llave (idea 77) se abría con la llave, con maña o a golpes, y fallar no
 * costaba nada: se volvía a probar hasta que salía. Y las ganzúas contaban como una llave: abrían
 * cualquier cerradura sin tirar. Ahora:
 *
 * - **Las ganzúas son herramientas, no una llave** (5e 2024, Herramientas de ladrón: «abrir una
 *   cerradura»). Con ellas, quien sabe de Juego de manos tira **con ventaja** (2024: competente en
 *   la habilidad y en la herramienta de la misma prueba).
 * - **Fallar hace ruido** (5e: el ruido lo oye quien está cerca). Lo que hay en la sala de al lado
 *   se despierta, abre desde dentro y sale a por vosotros. Echar la puerta abajo hace ruido
 *   siempre: también si sale.
 * - **Fallar por 5 o más rompe las ganzúas** (cosecha propia, marcada: en 5e las herramientas no
 *   se rompen).
 *
 * Sin ganzúas se sigue pudiendo probar «con maña», como antes (en 5e sin herramientas no se puede:
 * es cosecha propia de la idea 77, y lo decide Daniel).
 *
 * Puro: dice lo que pasa con la tirada ya hecha. Quien llama tira, despierta la sala y guarda.
 */

/** La prueba de abrir con maña (idea 77) y la de echarla abajo. */
export const LOCK_DC = { pick: 14, force: 16 };

/** Cosecha propia: fallar por tanto o más rompe las ganzúas. */
export const BREAK_MARGIN = 5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si un objeto es una llave (las ganzúas no lo son).
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isKey(item) {
    const name = text(item?.name);
    return /llave/i.test(name) && !isThievesTools(item);
}

/**
 * Si un objeto son ganzúas (las herramientas de ladrón de 5e).
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isThievesTools(item) {
    return /ganz[uú]a|herramientas de ladr[oó]n/i.test(text(item?.name));
}

/**
 * Quién del grupo lleva ganzúas, y cuáles.
 *
 * @param {any[]} members
 * @returns {{member: any, item: any}|null}
 */
export function toolsInParty(members) {
    for (const member of Array.isArray(members) ? members : []) {
        if (!member || member.dead) continue;
        const item = (Array.isArray(member.items) ? member.items : []).find(isThievesTools);
        if (item) return { member, item };
    }
    return null;
}

/**
 * Cómo se tira al abrir con maña: con ventaja si hay ganzúas y quien prueba sabe de Juego de
 * manos (2024); si no, sin más.
 *
 * @param {{withTools: boolean, proficient: boolean}} input
 * @returns {''|'advantage'}
 */
export function pickEdge({ withTools, proficient }) {
    return withTools && proficient ? 'advantage' : '';
}

/**
 * Lo que pasa con una tirada de abrir.
 *
 * @param {Object} input
 * @param {'pick'|'force'} input.how Con maña o a golpes.
 * @param {number} input.total Lo que ha sacado, ya sumado.
 * @param {number} input.natural El d20 que cuenta (un 20 siempre sale, un 1 siempre falla).
 * @param {number} input.dc
 * @param {boolean} [input.withTools] Si se ha probado con ganzúas.
 * @returns {{opened: boolean, noisy: boolean, broke: boolean, margin: number}}
 *   `noisy`: se ha oído (fallar, o echar la puerta abajo). `broke`: las ganzúas se han roto.
 */
export function lockOutcome({ how, total, natural, dc, withTools = false }) {
    const nat = Math.max(1, Math.min(20, Math.floor(Number(natural) || 1)));
    const sum = Math.trunc(Number(total) || 0);
    const opened = nat === 20 || (nat !== 1 && sum >= Number(dc));
    const margin = Number(dc) - sum;
    return {
        opened,
        noisy: !opened || how === 'force',
        broke: how === 'pick' && !opened && Boolean(withTools) && margin >= BREAK_MARGIN,
        margin,
    };
}

/**
 * Los botones de la puerta: la llave (si la hay), con maña (con ganzúas si las hay) y a golpes,
 * cada uno diciendo lo que arriesga.
 *
 * @param {{key?: string, tools?: string, edge?: ''|'advantage', trick?: number}} input `trick`: lo que
 *   baja la CD lo aprendido (la Mano de ganzúa).
 * @returns {{key: string, pick: string, force: string}}
 */
export function lockLabels({ key = '', tools = '', edge = '', trick = 0 }) {
    const dc = LOCK_DC.pick - Math.max(0, Math.trunc(Number(trick) || 0));
    const pick = text(tools)
        ? `Con ${text(tools).toLowerCase()} (Juego de manos, CD ${dc}${edge === 'advantage' ? ', con ventaja' : ''}). Si falla, se oye; si falla por mucho, se rompen`
        : `Con maña (Juego de manos, CD ${dc}). Si falla, se oye`;
    return {
        key: text(key) ? `Usar ${text(key)}` : '',
        pick,
        force: `A golpes (Atletismo, CD ${LOCK_DC.force}). Se oye siempre`,
    };
}

/**
 * Quitar las ganzúas rotas de la mochila de quien las llevaba.
 *
 * @param {any[]} items
 * @param {any} broken El objeto roto.
 * @returns {any[]}
 */
export function dropBrokenTools(items, broken) {
    const list = Array.isArray(items) ? items : [];
    const at = list.findIndex(item => item === broken || (broken?.id && item?.id === broken.id));
    if (at < 0) return [...list];
    return [...list.slice(0, at), ...list.slice(at + 1)];
}

/**
 * Las ganzúas con su artículo: «las ganzúas», «las ganzúas de acero».
 *
 * @param {string} tools
 * @returns {string}
 */
function withArticle(tools) {
    const name = text(tools).toLowerCase() || 'ganzúas';
    return /^(las|los|unas|unos|mis|sus) /.test(name) ? name : `las ${name}`;
}

/**
 * Lo que se dice al fallar: quien lo intenta, con sus palabras (D-J60: nada de narrador).
 *
 * @param {Object} input
 * @param {'pick'|'force'} input.how
 * @param {boolean} input.broke
 * @param {boolean} input.heard Si al otro lado hay alguien que lo ha oído.
 * @param {string} [input.tools] El nombre de las ganzúas.
 * @returns {string}
 */
export function failLine({ how, broke, heard, tools = '' }) {
    const first = how === 'force'
        ? 'La puerta aguanta, y el golpe ha retumbado por todo el pasillo.'
        : broke
            ? `Se me han partido ${withArticle(tools)} dentro de la cerradura.`
            : 'Se me ha escapado el pestillo: ha sonado un chasquido.';
    const then = heard ? ' ¡Silencio! Al otro lado se mueve algo.' : ' Parece que nadie lo ha oído.';
    return `${first}${then}`;
}
