/**
 * Compañeros del gremio que duran (J7.2 de wiki/ROADMAP_SIN_CONEXION.md): los que se unen en una
 * campaña pueden quedarse en el gremio para las siguientes.
 *
 * Hasta ahora, quien se unía en Barovia (Ismark, Ezmerelda) viajaba con el grupo como uno más,
 * pero nada decía qué era de él al acabar: ni se despedía ni se quedaba. Ahora, al terminar la
 * campaña, cada compañero de esa tierra tiene su momento:
 *
 * - **Si quiere venirse**: depende de lo que os une (su vínculo, `guild.rank` de su ficha en
 *   `compendio/companeros.json`, o `STAY_RANK`) y de lo que le ata a su tierra (`guild.never`:
 *   Madam Eva no deja a los suyos). Quien va por el oro se viene con menos vínculo: en el
 *   gremio hay trabajo.
 * - **Tú decides**: «Vente al gremio» o «Quédate en tu tierra». Quien no quiere venirse se
 *   despide igual, con sus palabras (`guild.no`).
 * - **Quien se viene** es ya del gremio: vive en Puerto Alba (a cada hora donde diga su ficha,
 *   `guild.places`), va contigo a la siguiente campaña o se queda en casa (`bench.js`), y lleva
 *   apuntado de dónde es (`from`), para que al volver a su tierra se note.
 *
 * Puro: dice quién puede venirse, monta su escena y reparte el grupo. Quien llama la enseña,
 * guarda el grupo y la casa, y deja en su mundo a quien se queda.
 */

import { cardOf, shortOf } from './companion-cards.js';
import { keyOf } from './social.js';
import { MAX_PARTY } from './recruit.js';

/** El vínculo que hace falta para que alguien deje su tierra y se venga al gremio. */
export const STAY_RANK = 3;

/** Y quien va por el oro: le basta con que el trato sea bueno. */
export const STAY_RANK_COIN = 2;

/** Lo que dice quien no tiene nada escrito, cuando se viene y cuando se queda. */
const DEFAULT_YES = 'Allí donde vayáis haré falta. Voy con vosotros.';
const DEFAULT_NO = 'Mi sitio está aquí. Si volvéis, ya sabéis dónde encontrarme.';
const DEFAULT_NOT_YET = 'Aún no os conozco lo bastante para dejarlo todo. Quizá otro día.';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Quién del grupo es de esta campaña: se unió aquí (`from.campaign`) o es un confidente del
 * paquete sin más señas (los de antes de J7.2). Ni tu héroe, ni tus otros personajes, ni los
 * mercenarios del gremio, ni quien ya es del gremio por otra campaña.
 *
 * @param {any[]} party El grupo, con el héroe primero.
 * @param {string} campaign La campaña que termina (`strahd`, `1387`…).
 * @returns {any[]}
 */
export function campaignCompanions(party, campaign) {
    return (Array.isArray(party) ? party : []).slice(1).filter(m => m && !m.dead && !m.guest && m.confidant
        && !m.guild && (!text(m.from?.campaign) || text(m.from.campaign) === text(campaign)));
}

/**
 * @typedef {Object} StayVerdict
 * @property {boolean} willing Si se vendría.
 * @property {string} why Por qué no, si no.
 * @property {number} rank El vínculo que hace falta.
 * @property {string} line Lo que dice, según venga o no.
 */

/**
 * Si alguien se vendría al gremio.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {number} input.rank Su vínculo contigo.
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @returns {StayVerdict}
 */
export function stayVerdict({ member, rank, cards = [] }) {
    const card = cardOf(cards, member?.name);
    const stay = card?.guild ?? null;
    const coin = text(member?.motive) === 'coin' || card?.wants === 'coin';
    const needed = stay?.rank || (coin ? STAY_RANK_COIN : STAY_RANK);
    if (stay?.never) return { willing: false, why: stay.never, rank: needed, line: stay.no || stay.never };
    if ((Number(rank) || 0) < needed) return { willing: false, why: `Hace falta más vínculo: rango ${needed}.`, rank: needed, line: stay?.no || DEFAULT_NOT_YET };
    return { willing: true, why: '', rank: needed, line: stay?.yes || DEFAULT_YES };
}

/**
 * La escena de la despedida (o de la invitación), para `openMeetupScene`: lo que dice, y tus
 * respuestas. Si se vendría, eliges tú; si no, solo queda despedirse.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {StayVerdict} input.verdict
 * @param {string} [input.land] El nombre de su tierra («Barovia»), para lo que se dice.
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @returns {any} Una escena de quedada de `kind: "despedida"`.
 */
export function stayScene({ member, verdict, land = '', cards = [] }) {
    const name = text(member?.name);
    const short = shortOf(cards, member);
    const card = cardOf(cards, name);
    const where = text(land) ? ` de ${text(land)}` : '';
    const ask = {
        note: `La campaña ha terminado. Antes de que emprendáis el camino de vuelta, ${short} se acerca a ti.`,
        say: '¿Y ahora qué? Vosotros volvéis a vuestro gremio. Yo…',
        mood: '',
        replies: verdict.willing
            ? [
                { text: 'Vente con nosotros al gremio.', bond: 1, then: verdict.line, mood: 'alegre', gold: 0, choice: 'viene' },
                { text: `Quédate. Aquí${where} te necesitan más.`, bond: 0, then: card?.guild?.no || DEFAULT_NO, mood: 'triste', gold: 0, choice: 'queda' },
            ]
            : [
                { text: 'Cuídate mucho.', bond: 0, then: verdict.line, mood: 'triste', gold: 0, choice: 'queda' },
            ],
    };
    return {
        id: `despedida-${keyOf(name)}`,
        kind: 'despedida',
        who: name,
        key: keyOf(name),
        campaign: text(member?.from?.campaign),
        rank: 1,
        title: verdict.willing ? '¿Vienes al gremio?' : 'La despedida',
        where: 'camino',
        beats: [ask],
    };
}

/**
 * Lo que decidiste en la escena: `viene` o `queda`.
 *
 * @param {any} scene La de `stayScene`.
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {'viene'|'queda'}
 */
export function stayChoice(scene, choices) {
    const choice = (Array.isArray(choices) ? choices : [])[0];
    const reply = choice ? scene?.beats?.[choice.beat]?.replies?.[choice.reply] : null;
    return reply?.choice === 'viene' ? 'viene' : 'queda';
}

/**
 * Repartir el grupo al volver: quien se viene sigue en el grupo (o, si no cabe, a casa) y lleva
 * apuntado de dónde es y que ya es del gremio; quien se queda sale del grupo.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any[]} input.bench La casa del gremio (`readBench`).
 * @param {Record<string, 'viene'|'queda'>} input.choices Por id de ficha.
 * @param {string} input.campaign
 * @param {string} [input.land] Su tierra, por nombre (`Barovia`).
 * @param {number} [input.day]
 * @returns {{party: any[], bench: any[], joined: any[], left: any[], lines: string[]}}
 */
export function settleStays({ party, bench, choices, campaign, land = '', day = 0 }) {
    const list = Array.isArray(party) ? party : [];
    const home = Array.isArray(bench) ? [...bench] : [];
    /** @type {any[]} */
    const joined = [];
    /** @type {any[]} */
    const left = [];
    /** @type {any[]} */
    const kept = [];
    for (const member of list) {
        const said = choices?.[String(member?.id)];
        if (!said || !member) {
            kept.push(member);
            continue;
        }
        if (said === 'queda') {
            left.push(member);
            continue;
        }
        const guildMember = {
            ...member,
            guild: true,
            from: { campaign: text(campaign), land: text(land) || text(member.from?.land), since: Math.max(0, Math.floor(Number(day) || 0)) },
        };
        joined.push(guildMember);
        kept.push(guildMember);
    }
    // Si no caben todos, los últimos en llegar esperan en casa.
    const living = kept.filter(m => m && !m.dead);
    const over = Math.max(0, living.length - MAX_PARTY);
    const toBench = over > 0 ? joined.slice(-over) : [];
    const party2 = kept.filter(m => !toBench.includes(m));
    /** @type {string[]} */
    const lines = [];
    for (const m of joined) lines.push(toBench.includes(m)
        ? `${text(m.name)} se viene al gremio. El grupo está lleno: se queda en casa, en Puerto Alba, hasta que le llames.`
        : `${text(m.name)} se viene al gremio. Desde hoy es de los vuestros.`);
    for (const m of left) lines.push(`${text(m.name)} se queda en su tierra.`);
    return { party: party2, bench: [...home, ...toBench], joined, left, lines };
}

/**
 * Los compañeros del gremio que no van en el grupo, como gente de Puerto Alba: para la pantalla
 * del pueblo (`whoIsWhere`), con su casa en Puerto Alba y su horario de allí.
 *
 * @param {Object} input
 * @param {any[]} input.bench La casa del gremio.
 * @param {{people: any[]}} input.data `readMeetupRows` de `quedadas.json`.
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {string} [input.town] El pueblo del gremio.
 * @returns {{residents: any[], data: {people: any[]}}} Los de casa (para `confidants` o `hirelings`) y
 *   las fichas J14 con su casa cambiada a Puerto Alba.
 */
export function guildResidents({ bench, data, cards = [], town = 'Puerto Alba' }) {
    const home = (Array.isArray(bench) ? bench : []).filter(m => m && !m.dead && m.guild);
    const keys = new Set(home.map(m => keyOf(m.name)));
    const people = (data?.people ?? []).map((/** @type {any} */ person) => {
        if (!keys.has(person?.key)) return person;
        const stay = cardOf(cards, person.who)?.guild;
        return { ...person, home: town, ...(stay && Object.keys(stay.places).length > 0 ? { places: stay.places } : {}), ...(stay?.likes?.length ? { likes: stay.likes } : {}) };
    });
    // Quien no tenía ficha J14 (un compañero de una campaña nueva) la tiene ahora, en el gremio.
    for (const member of home) {
        if (people.some((/** @type {any} */ p) => p?.key === keyOf(member.name))) continue;
        const stay = cardOf(cards, member.name)?.guild;
        people.push({
            id: `gremio-${keyOf(member.name)}`, who: text(member.name), key: keyOf(member.name), campaign: 'gremio', home: town,
            places: stay?.places ?? {}, likes: stay?.likes ?? [], gender: text(member.gender), className: text(member.class || member.className),
        });
    }
    return { residents: home.map(m => ({ ...m, home: town })), data: { ...(data ?? {}), people } };
}

/**
 * Lo que se dice cuando alguien del gremio vuelve a su tierra con vosotros (empezar otra vez su
 * campaña, o una partida nueva de ella). Vacío si no es de allí.
 *
 * @param {any} member
 * @param {string} campaign
 * @param {import('./companion-cards.js').CompanionCard[]} [cards]
 * @returns {string}
 */
export function homecomingLine(member, campaign, cards = []) {
    if (!member?.guild || text(member?.from?.campaign) !== text(campaign)) return '';
    const short = shortOf(cards, member);
    const land = text(member.from?.land);
    return land ? `${short} vuelve a ${land}. Mira alrededor en silencio: ha estado fuera más tiempo del que cree.`
        : `${short} vuelve a su tierra. Mira alrededor en silencio: ha estado fuera más tiempo del que cree.`;
}
