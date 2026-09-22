/**
 * The party, as a row of chips: who is standing, who is hurt, who is down and what ails
 * them.
 *
 * Two scenes want exactly this — the conversation, under the portrait, and the map, under
 * the journey — so it lives on its own rather than in whichever one needed it first. The
 * icons come from the same table as the initiative tracker: a condition should not look
 * like one thing in a fight and another out of it.
 *
 * Pure. See wiki/PROPUESTA_FRONTEND_MODO_JUEGO.md, H2 y H4.
 */

import { buildCampaignView } from '../../campaign/campaign-view.js';
import { statusMarkers } from '../../combat/initiative-tracker.js';
import { levelForXp } from '../../rules/level-up.js';
import { describeDeathSaves } from '../../rules/death-saves.js';

/**
 * @typedef {Object} PartyChip
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} hpPct
 * @property {boolean} fallen
 * @property {boolean} bloodied
 * @property {number} rank
 * @property {boolean} canLevel Si tiene experiencia de sobra para subir de nivel.
 * @property {string} dying Como va su cuenta de salvaciones de muerte, si esta a 0 PG.
 * @property {{icon: string, label: string}[]} statuses
 */

/** Below this share of their hit points, somebody is in trouble and the strip says so. */
const BLOODIED_AT = 0.5;

/**
 * @param {Object} input
 * @param {any[]} [input.party]
 * @param {any} [input.bonds]
 * @param {any} [input.calendar]
 * @param {any} [input.xpTable] Los umbrales del paquete de reglas activo.
 * @returns {{chips: PartyChip[], moment: string}}
 */
export function buildPartyStrip({ party = [], bonds = null, calendar = null, xpTable = null } = {}) {
    const members = Array.isArray(party) ? party.filter(Boolean) : [];
    // The day and the bond ranks come from the same view model the campaign tab uses:
    // two panels reading the same thing cannot disagree about what rank somebody is.
    const campaign = buildCampaignView({ calendar, bonds, party: members });
    const rankById = new Map(campaign.characters.map(c => [c.id, c.rank]));

    const chips = members.map(member => {
        const id = String(member?.id ?? '');
        const maxHp = Number(member?.maxHp) || 0;
        const hp = Math.max(0, Number(member?.hp) || 0);
        return {
            id,
            name: String(member?.name || ''),
            avatar: String(member?.avatar || ''),
            hp,
            maxHp,
            hpPct: maxHp > 0 ? Math.min(100, Math.round((hp / maxHp) * 100)) : 0,
            fallen: maxHp > 0 && hp <= 0,
            bloodied: maxHp > 0 && hp > 0 && hp / maxHp < BLOODIED_AT,
            rank: rankById.get(id) ?? 0,
            // Una estrella en la cara es el aviso mas corto posible de que hay algo que
            // hacer con ese personaje: antes solo lo decia una linea del registro.
            canLevel: levelForXp(member?.xp, xpTable) > (Math.max(1, Math.floor(Number(member?.level) || 1))),
            // Quien esta en el suelo no es "0/20 PG" y ya: son tres exitos contra tres
            // fallos, y eso es lo que hay que poder mirar sin abrir nada.
            dying: describeDeathSaves(member),
            statuses: statusMarkers(member?.activeConditions ?? member?.conditions),
        };
    });

    return { chips, moment: `Día ${campaign.day} · ${campaign.slotLabel}` };
}
