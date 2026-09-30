/**
 * Comprobar una campaña antes de jugarla (J5.6 de ROADMAP_SIN_CONEXION).
 *
 * Junta lo que ya se sabía mirar, dicho para quien va a jugarla y no para quien programa:
 *
 * - **Lo que impide jugarla**: los fallos del validador (`validatePack`). Con uno, la campaña
 *   no entra en el tablón.
 * - **Lo que se quedaría a medias**: los huecos del medidor de densidad (`checkWorldDensity`):
 *   sitios sin nada que hacer, hitos que no se abren nunca o que no llevan a nada, misiones sin
 *   tablero, un hilo que no acaba, sitios a los que no se llega. Se juega, pero algo se atasca.
 * - **Lo que ha puesto el juego**: lo que rellenó el motor (J5.3, `pack-fill.js`).
 * - **Cosas raras**: los avisos, que no impiden nada pero casi siempre son una errata.
 * - **Para que dure como las del juego**: el listón de un mundo largo (M6). No hace falta para
 *   jugarla: es lo que tienen Strahd y 1387.
 *
 * El mismo informe sale en «Añadir una campaña» del gremio y en `tools/comprobar-campana.mjs`.
 *
 * Puro: recibe el paquete (ya relleno) y lo que se rellenó.
 */

import { validatePack } from './campaign-pack.js';
import { checkWorldDensity } from './world-density.js';
import { describeFill } from './pack-fill.js';

/**
 * @typedef {Object} CheckItem
 * @property {string} text Lo que pasa, en una frase.
 * @property {string} [where] Dónde está, en el archivo: `quests[1].boardId`.
 */

/**
 * @typedef {Object} CheckGroup
 * @property {'rota'|'huecos'|'relleno'|'avisos'|'liston'} key
 * @property {string} title
 * @property {string} note Qué hacer con ello, en una línea.
 * @property {CheckItem[]} items
 * @property {boolean} open Si se enseña abierto.
 */

/**
 * @typedef {Object} CampaignCheck
 * @property {string} name
 * @property {'lista'|'huecos'|'rota'} verdict
 * @property {string} headline
 * @property {CheckGroup[]} groups Solo las que traen algo, en este orden: rota, huecos,
 *   relleno, avisos, listón.
 */

/** Lo que dice cada veredicto. */
export const VERDICTS = {
    lista: 'Se puede jugar de principio a fin.',
    huecos: 'Se puede jugar, pero hay cosas que se quedarían a medias.',
    rota: 'Así no se puede jugar: hay que arreglar lo de abajo.',
};

/** Los títulos de cada grupo, y qué hacer con él. */
export const GROUPS = {
    rota: { title: 'Lo que impide jugarla', note: 'Arréglalo en el archivo, o pásale la lista a tu Gem y te la devuelve corregida.', open: true },
    huecos: { title: 'Lo que se quedaría a medias', note: 'Se puede jugar igual, pero en estos sitios algo se atasca o no lleva a nada.', open: true },
    relleno: { title: 'Lo que ha puesto el juego', note: 'La campaña no lo traía: lo ha puesto el motor con la semilla. Si prefieres escribirlo tú, pídeselo a tu Gem.', open: false },
    avisos: { title: 'Cosas raras', note: 'No impiden jugar, pero casi siempre son una errata.', open: false },
    liston: { title: 'Para que dure como las del juego', note: 'No hace falta para jugarla: es lo que tienen Strahd y 1387. Si quieres más, pídeselo a tu Gem.', open: false },
};

/** Cuántas cosas se enseñan de cada grupo, como mucho. */
export const MAX_ITEMS = 12;

/** Los errores del medidor que son el listón de un mundo largo, no un hueco. */
const LISTON = [/se queda corta: le falta/, /^Confidente .*escenas de vínculo/];

/** Los avisos del medidor que sí son un hueco de la historia. */
const HOLE_WARNINGS = [/no lleva a nada/];

/**
 * @param {any} value
 * @returns {string}
 */
const text = (value) => String(value ?? '').trim();

/**
 * Una frase con su punto.
 *
 * @param {string} line
 * @returns {string}
 */
const sentence = (line) => {
    const clean = text(line);
    if (!clean) return '';
    const first = clean[0].toUpperCase() + clean.slice(1);
    return /[.!?…:]$/.test(first) ? first : `${first}.`;
};

/**
 * Comprobar una campaña.
 *
 * @param {any} pack El paquete, en limpio y ya relleno.
 * @param {Object} [options]
 * @param {import('./pack-fill.js').FillNote[]} [options.filled] Lo que puso el motor.
 * @param {import('./campaign-pack.js').PackReport|null} [options.validation] Si ya se validó.
 * @returns {CampaignCheck}
 */
export function checkCampaign(pack, { filled = [], validation = null } = {}) {
    const report = validation ?? validatePack(pack);
    const density = checkWorldDensity(pack);
    const quotaLabels = density.short.map(q => q.label);
    const isQuota = (/** @type {string} */ line) => quotaLabels.some(label => line.startsWith(`${label}:`));
    // Sin ningún camino escrito se va de un sitio a otro directo: que no haya camino no es un hueco.
    const routes = (Array.isArray(pack?.locations) ? pack.locations : [])
        .some((/** @type {any} */ l) => Array.isArray(l?.routes) && l.routes.length > 0);

    /** @type {Record<CheckGroup['key'], CheckItem[]>} */
    const items = { rota: [], huecos: [], relleno: [], avisos: [], liston: [] };

    for (const issue of report.errors) items.rota.push({ text: sentence(issue.message), where: text(issue.path) });

    /** @type {string[]} */
    const thin = [];
    for (const line of density.errors) {
        if (isQuota(line)) continue;
        if (/no tiene camino desde/.test(line) && !routes) continue;
        const short = line.match(/^«(.+)» se queda corta: le falta/);
        if (short) {
            thin.push(short[1]);
            continue;
        }
        if (LISTON.some(pattern => pattern.test(line))) {
            items.liston.push({ text: sentence(line) });
            continue;
        }
        items.huecos.push({ text: sentence(line) });
    }
    for (const line of density.warnings) {
        (HOLE_WARNINGS.some(pattern => pattern.test(line)) ? items.huecos : items.avisos).push({ text: sentence(line) });
    }
    for (const issue of report.warnings) items.avisos.push({ text: sentence(issue.message), where: text(issue.path) });

    for (const q of density.short) {
        items.liston.unshift({ text: `${q.label}: ${q.shown}, y las del juego tienen ${Number.isInteger(q.min) ? q.min : `un ${Math.round(q.min * 100)} %`}.` });
    }
    if (thin.length > 0) {
        const names = thin.length <= 3 ? thin.join(', ') : `${thin.slice(0, 3).join(', ')} y ${thin.length - 3} más`;
        items.liston.push({ text: `${thin.length} ${thin.length === 1 ? 'localización con poco que hacer' : 'localizaciones con poco que hacer'} (sin algo que mirar, un secreto o un rumor): ${names}.` });
    }
    for (const line of describeFill(filled)) items.relleno.push({ text: line });

    const verdict = items.rota.length > 0 ? 'rota' : items.huecos.length > 0 ? 'huecos' : 'lista';
    /** @type {CheckGroup[]} */
    const groups = /** @type {Array<CheckGroup['key']>} */ (['rota', 'huecos', 'relleno', 'avisos', 'liston'])
        .filter(key => items[key].length > 0)
        .map(key => ({ key, title: GROUPS[key].title, note: GROUPS[key].note, items: items[key], open: GROUPS[key].open }));
    return { name: text(pack?.world?.name) || report.counts?.world || '', verdict, headline: VERDICTS[verdict], groups };
}

/**
 * El informe como texto, para pegárselo a tu Gem: lo que hay que arreglar, con dónde está.
 *
 * @param {CampaignCheck} check
 * @returns {string} Vacío si no hay nada que pedirle.
 */
export function checkText(check) {
    const wanted = check.groups.filter(group => group.key === 'rota' || group.key === 'huecos');
    if (wanted.length === 0) return '';
    return [
        `Hola. Al comprobar la campaña «${check.name || 'sin nombre'}» en el juego sale esto. Arréglalo y devuélveme la campaña entera, en un solo bloque JSON y en el mismo formato.`,
        '',
        ...wanted.flatMap(group => [
            `${group.title}:`,
            ...group.items.map(item => `- ${item.text}${item.where ? ` (en ${item.where})` : ''}`),
            '',
        ]),
    ].join('\n').trim();
}
