/**
 * El final de una campaña (J4.5 de ROADMAP_SIN_CONEXION) y su sitio en el salón (J3.9).
 *
 * Un final ya se contaba: su escena iba al chat y salía una tarjeta con los números de la
 * partida y qué fue de cada compañero. Faltaba lo que se espera al cerrar una historia:
 *
 * - **Qué fue de la gente**: los epílogos del final. El paquete los trae escritos en cada
 *   final (`epilogues`); si no trae, se sacan de cómo os miran las facciones al acabar.
 * - **Lo que se lleva cada uno**: nivel, experiencia, oro y lo que vale la pena nombrar,
 *   frente a cómo empezó la campaña (`partyAtStart`, que se apunta al empezarla).
 * - **La vuelta al gremio**: una escena corta que dice cómo acabó.
 * - **El salón de la fama**: la campaña terminada, con su final, quién fue y cuándo.
 *
 * Puro: redacta y decide. Quien llama guarda y enseña.
 */

import { listNames } from './engine-narrator.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** Cuántos epílogos sacados de las facciones: los que más se notan. */
const FACTION_EPILOGUES = 3;

/** Cuántas cosas se nombran de lo que se lleva cada uno; el resto va en «y N más». */
const ITEMS_NAMED = 4;

/**
 * Los epílogos que el paquete escribe en un final, leídos con tolerancia: una frase suelta
 * o `{who, text}`.
 *
 * @param {any} raw
 * @returns {Array<{who: string, text: string}>}
 */
export function readEpilogues(raw) {
    return (Array.isArray(raw) ? raw : [])
        .map(e => (typeof e === 'string' ? { who: '', text: text(e) } : { who: text(e?.who), text: text(e?.text) }))
        .filter(e => e.text);
}

/**
 * Qué fue de cada facción, visto cómo os miran al acabar. Solo las que se notan: con quien
 * no tuvisteis trato no hay nada que contar. «Con…» evita tener que saber si el nombre va
 * en singular o en plural.
 *
 * @param {any[]} factions `{name, reputation}`, de -5 a 5.
 * @returns {string[]}
 */
export function factionEpilogues(factions) {
    return (Array.isArray(factions) ? factions : [])
        .map(f => ({ name: text(f?.name), at: Math.round(Number(f?.reputation) || 0) }))
        .filter(f => f.name && f.at !== 0)
        .sort((a, b) => Math.abs(b.at) - Math.abs(a.at))
        .slice(0, FACTION_EPILOGUES)
        .map(({ name, at }) => (at >= 3 ? `Con ${name} quedáis como amigos: allí siempre tendréis la puerta abierta.`
            : at > 0 ? `Con ${name} quedáis en buenos términos.`
                : at <= -3 ? `Con ${name} quedáis como enemigos: mejor no volver a cruzaros.`
                    : `Con ${name} quedáis a malas: nadie os echará de menos por allí.`));
}

/**
 * Los epílogos de un final: los escritos, o los de las facciones si no hay.
 *
 * @param {Object} input
 * @param {any} input.ending El final del hilo, con su `epilogues` si lo trae.
 * @param {any[]} [input.factions]
 * @returns {string[]}
 */
export function endingEpilogues({ ending, factions = [] }) {
    const written = readEpilogues(ending?.epilogues).map(e => e.text);
    return written.length > 0 ? written : factionEpilogues(factions);
}

/**
 * @typedef {{id: string, name: string, level: number, xp: number, gold: number, items: string[]}} StartMember
 * @typedef {{day: number, party: StartMember[]}} PartyStart
 */

/**
 * Cómo empieza el grupo una campaña: lo que hace falta para contar al final lo que ganó.
 *
 * @param {any[]} party
 * @param {number} day
 * @returns {PartyStart}
 */
export function partyAtStart(party, day) {
    return readPartyStart({
        day,
        party: (Array.isArray(party) ? party : []).map(m => ({
            id: m?.id, name: m?.name, level: m?.level, xp: m?.xp, gold: m?.gold,
            items: (Array.isArray(m?.items) ? m.items : []).map((/** @type {any} */ i) => text(i?.id) || text(i?.name)),
        })),
    });
}

/**
 * @param {any} raw
 * @returns {PartyStart|null}
 */
export function readPartyStart(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.party)) return null;
    return {
        day: Math.max(1, whole(raw.day) || 1),
        party: raw.party
            .filter((/** @type {any} */ m) => text(m?.name))
            .map((/** @type {any} */ m) => ({
                id: text(m.id), name: text(m.name), level: Math.max(1, whole(m.level) || 1), xp: whole(m.xp), gold: whole(m.gold),
                items: (Array.isArray(m.items) ? m.items : []).map(text).filter(Boolean),
            })),
    };
}

/** Las rarezas que no merecen nombrarse. */
const PLAIN_RARITY = new Set(['', 'common', 'comun', 'normal', 'mundane', 'mundano']);

/** @param {any} item @returns {number} Cuanto más, antes se nombra; 0, no se nombra. */
function worthNaming(item) {
    if (item?.relic) return 3;
    if (text(item?.heirloom)) return 2;
    const rarity = text(item?.rarity).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return PLAIN_RARITY.has(rarity) ? 0 : 1;
}

/**
 * Lo que se lleva cada uno: nivel, experiencia y oro, y lo que merece nombrarse de lo que
 * lleva (reliquias, herencias y lo que no es común). Con cómo empezó, lo ganado aquí; sin
 * eso (una campaña de antes de apuntarlo), lo que tiene.
 *
 * Quien se escoltaba no se lleva nada: no era del grupo. Quien cayó, tampoco.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {PartyStart|null} [input.start]
 * @returns {Array<{name: string, level: number, levels: number, xp: number, xpGained: number,
 *   gold: number, goldGained: number, items: string[], line: string}>}
 */
export function takeHome({ party, start = null }) {
    const before = readPartyStart(start);
    return (Array.isArray(party) ? party : [])
        .filter(m => text(m?.name) && !m.dead && m?.guest?.kind !== 'ward')
        .map(member => {
            const name = text(member.name);
            const was = before?.party.find(p => p.id && p.id === text(member.id)) ?? before?.party.find(p => p.name === name) ?? null;
            const level = Math.max(1, whole(member.level) || 1);
            const xp = whole(member.xp);
            const gold = whole(member.gold);
            const levels = was ? Math.max(0, level - was.level) : 0;
            const xpGained = was ? Math.max(0, xp - was.xp) : 0;
            const goldGained = was ? gold - was.gold : 0;
            const had = new Set(was?.items ?? []);
            const items = (Array.isArray(member.items) ? member.items : [])
                .filter((/** @type {any} */ i) => text(i?.name) && worthNaming(i) > 0 && !had.has(text(i?.id)) && !had.has(text(i?.name)))
                .sort((/** @type {any} */ a, /** @type {any} */ b) => worthNaming(b) - worthNaming(a))
                .map((/** @type {any} */ i) => text(i.name));
            const named = [...new Set(items)];
            const shown = named.slice(0, ITEMS_NAMED);
            const more = named.length - shown.length;
            const gain = (/** @type {number} */ n) => (n > 0 ? ` (+${n})` : n < 0 ? ` (${n})` : '');
            const parts = [
                `nivel ${level}${levels > 0 ? ` (sube ${levels})` : ''}`,
                // Un mercenario no gana experiencia: «0 de experiencia» no dice nada.
                xp > 0 ? `${xp} de experiencia${gain(xpGained)}` : '',
                gold > 0 || goldGained !== 0 ? `${gold} de oro${gain(goldGained)}` : '',
            ].filter(Boolean);
            const carries = shown.length > 0 ? ` Se lleva: ${shown.join(', ')}${more > 0 ? ` y ${more} más` : ''}.` : '';
            return {
                name, level, levels, xp, xpGained, gold, goldGained, items: shown,
                line: `${name}: ${listNames(parts)}.${carries}`,
            };
        });
}

/**
 * D-J19: cómo se llama una campaña terminada en el salón de la fama: como en el tablón, que es
 * como la conoce quien juega. Una que no salió del tablón se llama como su hilo escrito («La
 * Maldición de Strahd»), sin el héroe que lleva el nombre del mundo; una improvisada, como su
 * mundo.
 *
 * @param {Object} input
 * @param {string} [input.board] Su nombre en el tablón, si salió de él.
 * @param {any} [input.plot] El hilo.
 * @param {string} [input.world] El mundo donde se jugó.
 * @returns {string}
 */
export function hallCampaignName({ board = '', plot = null, world = '' }) {
    if (text(board)) return text(board);
    if (plot?.source === 'written' && text(plot.title)) return text(plot.title);
    return text(world);
}

/**
 * La entrada de una campaña terminada en el salón de la fama.
 *
 * @param {Object} input
 * @param {string} input.campaign Cómo se llama la campaña.
 * @param {string} input.world El mundo donde se jugó: es lo que la distingue de otra vuelta.
 * @param {string} input.ending El título del final.
 * @param {any[]} input.party
 * @param {Array<{name: string}>} [input.graves] Quienes cayeron por el camino.
 * @param {number} input.day Cuántos días duró.
 * @param {string} input.when
 * @param {string} [input.mode]
 * @param {boolean} [input.iron]
 * @returns {import('./legacy.js').HallEntry}
 */
export function campaignHallEntry({ campaign, world, ending, party, graves = [], day, when, mode = '', iron = false }) {
    const members = (Array.isArray(party) ? party : []).filter(m => text(m?.name) && m?.guest?.kind !== 'ward');
    const fallen = [...new Set([
        ...members.filter(m => m.dead).map(m => text(m.name)),
        ...(Array.isArray(graves) ? graves : []).map(g => text(g?.name)).filter(Boolean),
    ])];
    const went = [...new Set([...members.filter(m => !m.dead).map(m => text(m.name)), ...fallen])];
    return {
        kind: 'campaign',
        name: text(campaign) || text(world),
        world: text(world),
        day: Math.max(1, whole(day) || 1),
        epitaph: '',
        when: text(when),
        ending: text(ending),
        party: went,
        fallen,
        ...(text(mode) ? { mode: text(mode) } : {}),
        ...(iron ? { iron: true } : {}),
    };
}

/**
 * La vuelta al gremio después de un final: la noticia ha llegado antes que el grupo.
 *
 * @param {Object} input
 * @param {string} input.campaign
 * @param {string} input.ending
 * @param {string} [input.home] El pueblo del gremio.
 * @param {string[]} [input.fallen] Quienes no vuelven.
 * @returns {string} Vacío si no hay final.
 */
export function homecomingScene({ campaign, ending, home = '', fallen = [] }) {
    if (!text(ending)) return '';
    const where = text(home) && text(home) !== 'el gremio' ? `En ${text(home)}` : 'En el gremio';
    const what = text(campaign) || 'la campaña';
    const lost = (Array.isArray(fallen) ? fallen : []).map(text).filter(Boolean);
    // Sin comillas: el chat pinta lo entrecomillado como diálogo.
    return [
        `${where} ya se sabe cómo acabó ${what}: ${text(ending)}.`,
        'Os reciben con la primera ronda pagada, y en el tablón su papel ya está marcado como terminado.',
        lost.length > 0 ? `Se brinda también por ${listNames(lost)}, que no ${lost.length === 1 ? 'volvió' : 'volvieron'}.` : '',
    ].filter(Boolean).join(' ');
}
