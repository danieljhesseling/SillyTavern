/**
 * La ficha de un companero: quien es, cuanto le importas, y que puedes hacer al respecto.
 *
 * Los botones de vinculo vivian en la pestana de Campana, que es un cajon fuera de la
 * partida; aqui salen de pulsar su cara en la tira del grupo, que es donde se le esta
 * mirando. Dos cosas nuevas: pasar tiempo con alguien — que cuesta un bloque del dia, y
 * por eso es una eleccion — y regalarle algo, que cuesta el objeto.
 *
 * Decide y no dibuja. Lo que un regalo le parece sale de lo que la ficha del personaje
 * declare que le gusta: `likes` y `dislikes`, dos listas que se editan como cualquier otro
 * campo. Sin ellas un regalo no da puntos, que es mejor que dar puntos por cualquier cosa.
 *
 * Ver wiki/ROADMAP_JUEGO_SIN_COMANDOS.md, K4b.
 */

import { buildCampaignView, getRecordableEvents } from '../../campaign/campaign-view.js';
import { BOND_EVENTS } from '../../campaign/bonds.js';

/**
 * @typedef {Object} CardAction
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {boolean} enabled
 * @property {string} why
 * @property {number} [points]
 */

/**
 * @typedef {Object} GiftVerdict
 * @property {'gift_liked'|'gift_disliked'|null} event
 * @property {number} points
 * @property {string} line Lo que se narra al dar el regalo.
 */

/**
 * Las palabras de una lista que puede venir como array o como texto separado por comas.
 *
 * @param {any} value
 * @returns {string[]}
 */
function wordsOf(value) {
    const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
    return raw.map(word => String(word).trim().toLowerCase()).filter(Boolean);
}

/**
 * Que le parece el regalo.
 *
 * Lo que no le dice nada no le da nada: un regalo que siempre suma seria una fuente de
 * puntos con solo tener objetos.
 *
 * @param {Object} input
 * @param {any} input.member A quien se le da.
 * @param {any} input.item Lo que se le da.
 * @returns {GiftVerdict}
 */
export function judgeGift({ member, item }) {
    const haystack = [item?.name, item?.category, item?.subcategory, item?.type]
        .map(part => String(part ?? '').toLowerCase())
        .filter(Boolean)
        .join(' ');
    const name = String(item?.name || 'algo');

    // Lo que le disgusta manda: un mal regalo se recuerda mas que uno correcto.
    if (wordsOf(member?.dislikes).some(word => haystack.includes(word))) {
        return {
            event: 'gift_disliked',
            points: BOND_EVENTS.gift_disliked.points,
            line: `${member?.name} acepta ${name} sin saber que decir.`,
        };
    }

    if (wordsOf(member?.likes).some(word => haystack.includes(word))) {
        return {
            event: 'gift_liked',
            points: BOND_EVENTS.gift_liked.points,
            line: `A ${member?.name} se le ilumina la cara con ${name}.`,
        };
    }

    return {
        event: null,
        points: 0,
        line: `${member?.name} guarda ${name} y da las gracias.`,
    };
}

/**
 * Lo que muestra la ficha de un companero.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} [input.bonds]
 * @param {any} [input.calendar]
 * @param {boolean} [input.fighting]
 * @param {boolean} [input.canLevel] Si tiene experiencia para subir de nivel.
 * @param {Array<any>} [input.giverItems] Lo que el grupo puede regalar.
 * @returns {{
 *   id: string, name: string, avatar: string, rank: number, rankLabel: string,
 *   points: number, nextAt: number, progress: number, maxed: boolean,
 *   perks: Array<any>, actions: CardAction[], gifts: Array<{name: string, verdict: GiftVerdict}>,
 * }}
 */
export function buildCompanionCard({
    member, bonds = null, calendar = null, fighting = false, canLevel = false, giverItems = [],
}) {
    const id = String(member?.id ?? '');
    const view = buildCampaignView({ calendar, bonds, party: [member].filter(Boolean) });
    const character = view.characters.find(c => c.id === id) || {
        rank: 0, points: 0, nextAt: 0, progress: 0, maxed: false, perks: [],
    };

    const items = (Array.isArray(giverItems) ? giverItems : []).filter(Boolean);
    const gifts = items.map(item => ({ name: String(item?.name || ''), verdict: judgeGift({ member, item }) }));

    /** @type {CardAction[]} */
    const actions = [];

    // Subir de nivel va primero cuando toca: es lo unico de esta ficha que cambia los
    // numeros con los que se pelea, y esperar no lo mejora.
    if (canLevel) {
        actions.push({
            id: 'level',
            label: 'Subir de nivel',
            icon: 'fa-arrow-up',
            enabled: true,
            why: 'Tiene experiencia de sobra',
        });
    }

    actions.push(
        {
            id: 'downtime',
            label: 'Pasar tiempo',
            icon: 'fa-mug-hot',
            enabled: !fighting,
            why: fighting
                ? 'No mientras peleas.'
                : `Gasta un bloque del día y suma ${BOND_EVENTS.shared_downtime.points} al vínculo`,
            points: BOND_EVENTS.shared_downtime.points,
        },
        {
            id: 'gift',
            label: 'Regalar',
            icon: 'fa-gift',
            enabled: !fighting && items.length > 0,
            why: fighting
                ? 'No mientras peleas.'
                : (items.length === 0 ? 'No llevas nada que dar.' : 'Le das algo de lo que llevas'),
        },
    );

    // Y lo que ya existia: anotar lo que ha pasado entre vosotros.
    for (const event of getRecordableEvents()) {
        actions.push({
            id: `event:${event.type}`,
            label: event.label,
            icon: event.points >= 0 ? 'fa-heart' : 'fa-heart-crack',
            enabled: true,
            why: `${event.points >= 0 ? '+' : ''}${event.points} al vínculo`,
            points: event.points,
        });
    }

    return {
        id,
        name: String(member?.name || ''),
        avatar: String(member?.avatar || ''),
        rank: character.rank,
        rankLabel: character.maxed ? 'Rango máximo' : `Rango ${character.rank}`,
        points: character.points,
        nextAt: character.nextAt,
        progress: character.progress,
        maxed: character.maxed,
        perks: character.perks,
        actions,
        gifts,
    };
}
