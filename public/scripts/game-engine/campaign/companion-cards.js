/**
 * Cómo es cada compañero (J7.2 y J7.5 de wiki/ROADMAP_SIN_CONEXION.md): lo que busca, lo que le
 * gusta y lo que no, cómo se le llama en corto y si se viene al gremio al acabar su campaña.
 *
 * Hasta ahora eso salía solo de su oficio y de si iba por el oro (`wantsOf` de `barks.js`), y
 * los tres mercenarios del gremio no tenían nada escrito: los tres «buscaban oro» y opinaban
 * igual de todo. Ahora cada uno tiene su ficha en `compendio/companeros.json`:
 *
 *     { "id": "gerd", "kind": "companero", "who": "Gerd el Mellado", "short": "Gerd",
 *       "wants": "coin", "likes": ["ayudar", "amable"], "dislikes": ["desairar"],
 *       "guild": { "rank": 3, "never": "", "yes": "…", "no": "…",
 *                  "places": { "morning": "muelle", "afternoon": "plaza", "night": "posada" } } }
 *
 * - `wants`: lo que busca (`coin`, `glory`, `blood`, `quiet`, `knowledge`), como en
 *   `rules/companions.js`. Decide sus gustos de siempre y de qué habla.
 * - `likes` y `dislikes`: lo que le gusta o no además de eso, con las palabras de
 *   `companion-opinions.js` (`pagar`, `amenazar`, `apostar`…) o las decisiones de `approval.js`.
 * - `guild`: solo los compañeros de una campaña. `rank`, el vínculo que hace falta para que se
 *   venga al gremio; `never`, por qué no se viene nunca (su tierra le ata); `yes` y `no`, lo que
 *   dice; `places`, dónde anda en Puerto Alba a cada hora si se queda.
 *
 * Puro: lee las fichas y responde. Quien llama las carga del compendio.
 */

import { wantsOf as wantsFromTrade } from '../combat/barks.js';
import { keyOf } from './social.js';

/** Lo que puede buscar alguien (`WANTS` de `rules/companions.js`). */
export const CARD_WANTS = ['coin', 'glory', 'blood', 'quiet', 'knowledge'];

/** Las horas de un horario. */
const SLOTS = ['morning', 'afternoon', 'night'];

/** Los títulos que no sirven de nombre corto («Madam Eva» es Eva… pero se la llama entera). */
const TITLES = ['madam', 'madre', 'lord', 'lady', 'sir', 'don', 'dona', 'fray', 'sor', 'hermano', 'hermana', 'padre'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/**
 * @typedef {Object} GuildStay Si se viene al gremio al acabar su campaña, y qué dice.
 * @property {number} rank El vínculo que hace falta. 0: el de siempre (`STAY_RANK`).
 * @property {string} never Por qué no se viene nunca; vacío si puede venirse.
 * @property {string} yes Lo que dice cuando acepta.
 * @property {string} no Lo que dice cuando se queda (o cuando no se lo pides).
 * @property {Record<string, string>} places Dónde anda en Puerto Alba, por hora.
 * @property {string[]} likes Los sitios de Puerto Alba donde le gusta quedar.
 */

/**
 * @typedef {Object} CompanionCard
 * @property {string} id
 * @property {string} who
 * @property {string} key
 * @property {string} short Cómo se le llama en corto («Gerd»).
 * @property {string} campaign `gremio`, `strahd`, `1387`…
 * @property {string} wants
 * @property {string[]} likes
 * @property {string[]} dislikes
 * @property {GuildStay|null} guild
 */

/**
 * @param {any} raw
 * @returns {GuildStay|null}
 */
function readStay(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const places = raw.places && typeof raw.places === 'object' ? raw.places : {};
    return {
        rank: Math.max(0, Math.min(10, Math.floor(Number(raw.rank) || 0))),
        never: text(raw.never),
        yes: text(raw.yes),
        no: text(raw.no),
        places: Object.fromEntries(SLOTS.filter(slot => text(places[slot])).map(slot => [slot, text(places[slot])])),
        likes: listOf(raw.likes),
    };
}

/**
 * Las fichas de `compendio/companeros.json` (el archivo, su `rows` o las filas del compendio).
 * Las que no dicen de quién son se quedan fuera.
 *
 * @param {any} raw
 * @returns {CompanionCard[]}
 */
export function readCompanionCards(raw) {
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.rows) ? raw.rows : [];
    /** @type {CompanionCard[]} */
    const out = [];
    for (const row of rows) {
        const who = text(row?.who);
        if (!who || (text(row?.kind) && text(row.kind) !== 'companero')) continue;
        const wants = text(row.wants);
        out.push({
            id: text(row.id) || keyOf(who),
            who,
            key: keyOf(who),
            short: text(row.short) || shortName(who),
            campaign: text(row.campaign),
            wants: CARD_WANTS.includes(wants) ? wants : '',
            likes: listOf(row.likes),
            dislikes: listOf(row.dislikes),
            guild: readStay(row.guild),
        });
    }
    return out;
}

/**
 * La ficha de alguien, por su nombre (o por su primer nombre: «Gerd»).
 *
 * @param {CompanionCard[]} cards
 * @param {any} name
 * @returns {CompanionCard|null}
 */
export function cardOf(cards, name) {
    const key = keyOf(name);
    if (!key) return null;
    const list = Array.isArray(cards) ? cards : [];
    return list.find(card => card.key === key) ?? list.find(card => keyOf(card.short) === key) ?? null;
}

/**
 * Cómo se le llama en corto: la primera palabra de su nombre, salvo que sea un título.
 * «Gerd el Mellado» es Gerd; «Arthur «Doc»», Arthur; «Madam Eva», Madam Eva.
 *
 * @param {any} name
 * @returns {string}
 */
export function shortName(name) {
    const words = text(name).split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const first = words[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return TITLES.includes(first) && words.length > 1 ? `${words[0]} ${words[1]}` : words[0];
}

/**
 * El nombre corto de un compañero: el de su ficha, o el de su nombre.
 *
 * @param {CompanionCard[]} cards
 * @param {any} member Una ficha del grupo o un nombre.
 * @returns {string}
 */
export function shortOf(cards, member) {
    const name = typeof member === 'string' ? member : text(member?.name);
    return cardOf(cards, name)?.short || shortName(name);
}

/**
 * Lo que busca alguien: lo de su ficha de compañero manda; si no, lo que diga su ficha del
 * grupo (`reasons.wants`); si no, lo de su oficio y su motivo (`wantsOf` de `barks.js`).
 *
 * @param {CompanionCard[]} cards
 * @param {any} member
 * @returns {string}
 */
export function wantsFor(cards, member) {
    const card = cardOf(cards, member?.name);
    if (card?.wants) return card.wants;
    const own = text(member?.reasons?.wants);
    if (CARD_WANTS.includes(own)) return own;
    return wantsFromTrade({ motive: member?.motive, className: member?.className || member?.class || member?.charClass, wants: member?.wants });
}
