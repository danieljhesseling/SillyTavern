/**
 * El rango y el renombre del gremio (J3.7 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El gremio ya tenía renombre (`guild.js`): lo daba cada encargo entregado y abría rangos del
 * tablón de encargos (`contracts.js`). Ahora también lo dan **las campañas terminadas**, y el
 * rango que sale de ahí **abre las campañas más difíciles** del tablón de campañas.
 *
 * - **De dónde sale el renombre**: el de los encargos, que está guardado en el gremio, y el de
 *   cada campaña terminada desde él, que se calcula de lo que el gremio ya apunta
 *   (`hub.campaigns[id].finished`). No hay que apuntar nada nuevo al volver de una campaña: se
 *   cuenta solo.
 * - **Cuánto da una campaña**: tres, y la mitad del nivel más alto para el que es. Una
 *   campaña para los niveles 1 a 4 (1387) da cinco; una del 10 al 14, diez.
 * - **Qué abre cada rango**: lo dice la campaña (`rank` en su fila) o, si no, su nivel de
 *   entrada: desde el 5 pide el rango C; desde el 9, el B; desde el 13, el A; desde el 17, el
 *   S. Las que empiezan en el 1 están abiertas desde el primer día.
 * - **Una cerrada no se esconde**: su tarjeta sale en el tablón con lo que falta para abrirla.
 *   Una que ya empezaste no se cierra nunca.
 *
 * Los umbrales son los del tablón de encargos (`RANKS`): el mismo renombre abre las dos cosas.
 *
 * Puro: cuenta y describe. Quien llama guarda el rango ya contado (`rankSeen`).
 */

import { RANKS } from './contracts.js';
import { readGuild } from './guild.js';
import { readHub } from './hub.js';

/** Cómo se llama el gremio en cada rango: lo que se lee en la sala y en el tablón. */
export const RANK_NAMES = {
    D: 'Recién llegados',
    C: 'Compañía conocida',
    B: 'Compañía de fiar',
    A: 'Veteranos del puerto',
    S: 'Leyenda',
};

/**
 * Los rangos del gremio, de menos a más, con el renombre que pide cada uno.
 *
 * @type {Array<{id: string, label: string, min: number}>}
 */
export const GUILD_RANKS = RANKS.map(rank => ({
    id: rank.id,
    label: /** @type {Record<string, string>} */ (RANK_NAMES)[rank.id] ?? rank.label,
    min: rank.minRenown,
}));

/** Lo que da terminar cualquier campaña, antes de contar su nivel. */
export const CAMPAIGN_RENOWN_BASE = 3;

/** Desde qué nivel de entrada pide cada rango una campaña, del más alto al más bajo. */
export const RANK_BY_LEVEL = [
    { level: 17, rank: 'S' },
    { level: 13, rank: 'A' },
    { level: 9, rank: 'B' },
    { level: 5, rank: 'C' },
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La posición de un rango (D es 0), o -1 si no existe.
 *
 * @param {string} id
 * @returns {number}
 */
export function rankIndex(id) {
    return GUILD_RANKS.findIndex(rank => rank.id === text(id).toUpperCase());
}

/**
 * Los niveles de una campaña, como los escribe `mundos.json`: `[1, 4]`, o nada.
 *
 * @param {any} world
 * @returns {[number, number]}
 */
function levelsOf(world) {
    const [min, max] = Array.isArray(world?.levels) ? world.levels.map((/** @type {any} */ n) => Math.floor(Number(n) || 0)) : [0, 0];
    return [Math.max(0, min), Math.max(0, max, min)];
}

/**
 * Cuánto renombre da terminar una campaña: tres y la mitad de su nivel más alto (redondeando
 * hacia arriba). Sin niveles, como una de nivel 1 a 2.
 *
 * @param {any} world La fila de `mundos.json` (o de tus campañas añadidas).
 * @returns {number}
 */
export function campaignRenown(world) {
    const [, max] = levelsOf(world);
    return CAMPAIGN_RENOWN_BASE + Math.max(1, Math.ceil((max || 2) / 2));
}

/**
 * El renombre del gremio: el de los encargos y el de cada campaña terminada desde él.
 *
 * @param {Object} input
 * @param {any} input.guild El gremio, como se guarda (`GUILD_KEY` del chat del gremio).
 * @param {any} input.hub   Lo que el mundo del gremio apunta de sus campañas (`hub`).
 * @param {any[]} [input.worlds] Las filas de `mundos.json` y de tus campañas añadidas.
 * @returns {{renown: number, fromContracts: number, fromCampaigns: Array<{id: string, name: string, renown: number}>}}
 */
export function hubRenown({ guild, hub, worlds = [] }) {
    const rows = Array.isArray(worlds) ? worlds : [];
    const fromContracts = readGuild(guild).renown;
    const fromCampaigns = Object.entries(readHub(hub).campaigns)
        .filter(([, campaign]) => campaign.finished)
        .map(([id, campaign]) => {
            const world = rows.find(row => text(row?.id) === id) ?? null;
            return { id, name: text(world?.name) || campaign.name || campaign.worldName, renown: campaignRenown(world) };
        });
    return {
        renown: fromContracts + fromCampaigns.reduce((sum, one) => sum + one.renown, 0),
        fromContracts,
        fromCampaigns,
    };
}

/**
 * @typedef {Object} GuildRank
 * @property {string} id      D, C, B, A o S.
 * @property {string} label   «Compañía conocida».
 * @property {number} renown  El renombre de ahora.
 * @property {{id: string, label: string, min: number}|null} next El siguiente, si lo hay.
 * @property {number} toNext  Lo que falta para él (0 en el último).
 * @property {string} line    En una línea, para la sala: «Rango C · Compañía conocida · 7 de renombre. Para el B os faltan 1.»
 */

/**
 * El rango que da un renombre.
 *
 * @param {number} renown
 * @returns {GuildRank}
 */
export function guildRank(renown) {
    const have = Math.max(0, Math.floor(Number(renown) || 0));
    let at = 0;
    GUILD_RANKS.forEach((rank, index) => { if (have >= rank.min) at = index; });
    const rank = GUILD_RANKS[at];
    const next = GUILD_RANKS[at + 1] ?? null;
    const toNext = next ? next.min - have : 0;
    const line = [
        `Rango ${rank.id} · ${rank.label} · ${have} de renombre.`,
        next ? `Para el rango ${next.id} ${toNext === 1 ? 'os falta 1' : `os faltan ${toNext}`}.` : 'Más arriba no hay nada.',
    ].join(' ');
    return { id: rank.id, label: rank.label, renown: have, next: next ? { ...next } : null, toNext, line };
}

/**
 * El rango que pide una campaña: el que diga su fila (`rank`) o el de su nivel de entrada.
 *
 * @param {any} world
 * @returns {string} D si está abierta desde el principio.
 */
export function campaignRequirement(world) {
    const written = text(world?.rank).toUpperCase();
    if (rankIndex(written) >= 0) return written;
    const [min] = levelsOf(world);
    return RANK_BY_LEVEL.find(step => min >= step.level)?.rank ?? 'D';
}

/**
 * Lo que dice una campaña cerrada: con qué rango se abre y cómo se llega.
 *
 * @param {string} required
 * @param {number} renown
 * @returns {string}
 */
export function lockLine(required, renown) {
    const rank = GUILD_RANKS[rankIndex(required)];
    if (!rank) return '';
    const missing = Math.max(0, rank.min - Math.max(0, Math.floor(Number(renown) || 0)));
    return `Se abre con el rango ${rank.id} del gremio (${rank.label}). `
        + `${missing === 1 ? 'Os falta 1 de renombre' : `Os faltan ${missing} de renombre`}: terminad campañas o haced encargos del tablón.`;
}

/**
 * Las tarjetas del tablón (`hubCampaignCards`), con las que el rango aún no abre marcadas.
 * Una empezada o terminada no se cierra nunca: ya es vuestra.
 *
 * @template {{id: string, state: string, name: string}} T
 * @param {T[]} cards
 * @param {Object} input
 * @param {number} input.renown
 * @param {any[]} [input.worlds] Las filas de las campañas, para saber qué pide cada una.
 * @returns {Array<T & {locked: boolean, lock: string, requires: string}>}
 */
export function lockCampaignCards(cards, { renown, worlds = [] }) {
    const rows = Array.isArray(worlds) ? worlds : [];
    const now = rankIndex(guildRank(renown).id);
    return (Array.isArray(cards) ? cards : []).map(card => {
        const world = rows.find(row => text(row?.id) === text(card?.id)) ?? card;
        const requires = campaignRequirement(world);
        const locked = card.state === 'nueva' && rankIndex(requires) > now;
        return { ...card, locked, lock: locked ? lockLine(requires, renown) : '', requires };
    });
}

/**
 * Lo que se cuenta al entrar en la sala si el gremio ha subido de rango desde la última vez:
 * el rango nuevo y las campañas que abre. Nada si no ha subido.
 *
 * @param {Object} input
 * @param {any} input.guild El gremio guardado: `rankSeen` es el último rango contado.
 * @param {number} input.renown El de ahora (`hubRenown`).
 * @param {any[]} [input.worlds] Las campañas del tablón, para decir cuáles se abren.
 * @param {any} [input.hub] Para no contar como nueva una que ya empezasteis.
 * @returns {{rank: string, line: string, opened: string[]}|null}
 */
export function rankNews({ guild, renown, worlds = [], hub = null }) {
    const seen = readGuild(guild).rankSeen ?? 'D';
    const rank = guildRank(renown);
    if (rankIndex(rank.id) <= rankIndex(seen)) return null;
    const started = readHub(hub).campaigns;
    const opened = (Array.isArray(worlds) ? worlds : [])
        .filter(world => text(world?.id) && text(world?.pack) && !started[text(world.id)])
        .filter(world => {
            const needs = rankIndex(campaignRequirement(world));
            return needs > rankIndex(seen) && needs <= rankIndex(rank.id);
        })
        .map(world => text(world.name) || text(world.id));
    const line = [
        `El gremio sube a rango ${rank.id}: ${rank.label}.`,
        opened.length === 1 ? `En el tablón de campañas se abre una nueva: ${opened[0]}.` : '',
        opened.length > 1 ? `En el tablón de campañas se abren ${opened.length} nuevas: ${opened.join(', ')}.` : '',
        opened.length === 0 && rank.next ? `El tablón de encargos ya ofrece trabajos de rango ${rank.id}.` : '',
    ].filter(Boolean).join(' ');
    return { rank: rank.id, line, opened };
}
