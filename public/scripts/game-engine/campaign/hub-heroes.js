/**
 * Tus personajes del gremio (J1.6 y J18.1 de ROADMAP_SIN_CONEXION).
 *
 * En un gremio puede haber más de un personaje tuyo. Va uno con el grupo —el de siempre,
 * con los mercenarios— y los demás **se quedan en el gremio** con lo suyo: su nivel, su
 * experiencia, su equipo y su oro. Se elige con quién se entra al volver a la partida, y en
 * el tablón, con quién se va a la próxima campaña.
 *
 * Los que se quedan viven en los metadatos del mundo del gremio, en su propia clave, al lado
 * de `hub`: tal cual estaban en el grupo, para volver enteros. Su ficha del Lorebook sigue
 * en el mundo; no va en el grupo mientras descansan.
 *
 * No son los mercenarios (esos son de `hub.js` y se contratan), ni la casa de la compañía
 * (`bench.js`, compañeros de una campaña).
 *
 * Puro: decide quién va y quién se queda. Quien llama guarda el mundo y el grupo.
 */

import { classIcon } from './hero.js';

/** En los metadatos del mundo del gremio: los tuyos que se quedan en él. */
export const HUB_HEROES_KEY = 'hubHeroes';

/** La cara que pone SillyTavern a quien no tiene una: esa no se enseña. */
const DEFAULT_FACE = 'img/user-default.png';

/** Cuántas cosas de lo que lleva se nombran en la tarjeta. */
const CARRY_SHOWN = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {any} */
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Si alguien del grupo es de los tuyos: ni invitado (mercenario, escoltado) ni confidente.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isOwnHero(member) {
    return Boolean(member && typeof member === 'object' && text(member.name) && !member.guest && !member.confidant);
}

/**
 * El tuyo que va ahora con el grupo, o null.
 *
 * @param {any[]} party
 * @returns {any|null}
 */
export function activeHero(party) {
    return (Array.isArray(party) ? party : []).find(isOwnHero) ?? null;
}

/**
 * Los que se quedan en el gremio, con forma aunque llegue roto: uno por id, con nombre.
 *
 * @param {any} raw
 * @returns {any[]}
 */
export function readRestingHeroes(raw) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw : []).filter(hero => {
        if (!isOwnHero(hero) || hero.id == null || seen.has(String(hero.id))) return false;
        seen.add(String(hero.id));
        return true;
    });
}

/**
 * Las fichas del Lorebook de los que se quedan: tienen ficha de personaje en el mundo, pero
 * no van en el grupo, y lo que pone el grupo al día con las fichas no debe meterlos.
 *
 * @param {any} raw
 * @returns {Set<number>}
 */
export function restingUids(raw) {
    return new Set(readRestingHeroes(raw)
        .filter(hero => hero.wiUid != null && Number.isFinite(Number(hero.wiUid)))
        .map(hero => Number(hero.wiUid)));
}

/**
 * Los que se quedan, con uno más o uno menos.
 *
 * El que se queda entra tal cual está: con su vida, su nivel y lo que lleva. El que ha caído
 * no: los muertos no vuelven.
 *
 * @param {any} raw
 * @param {{add?: any, remove?: string|number}} change
 * @returns {any[]}
 */
export function withResting(raw, { add = null, remove = '' } = {}) {
    const gone = text(remove);
    const list = readRestingHeroes(raw).filter(hero => !gone || String(hero.id) !== gone);
    if (!isOwnHero(add) || add.dead || add.id == null) return list;
    const kept = clone(add);
    return [...list.filter(hero => String(hero.id) !== String(kept.id)), kept];
}

/**
 * Uno de los tuyos pasa a ir con el grupo, en el sitio del que va ahora: su hueco en la
 * lista y su casilla. Los mercenarios y los demás se quedan como estaban.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any} input.incoming
 * @returns {{party: any[], outgoing: any|null}} El grupo nuevo, y el que sale (o null si no iba nadie).
 */
export function seatHero({ party, incoming }) {
    const list = Array.isArray(party) ? party : [];
    const index = list.findIndex(isOwnHero);
    const outgoing = index >= 0 ? list[index] : null;
    const seated = clone(incoming);
    if (outgoing?.mapPosition) seated.mapPosition = { ...outgoing.mapPosition };
    if (outgoing?.worldName) seated.worldName = outgoing.worldName;
    return {
        party: index >= 0 ? list.map((member, i) => (i === index ? seated : member)) : [seated, ...list],
        outgoing,
    };
}

/**
 * Lo que se cuenta al cambiar: quién va y quién se queda.
 *
 * @param {any} incoming
 * @param {any} [outgoing]
 * @returns {string}
 */
export function swapLine(incoming, outgoing = null) {
    const goes = `${text(incoming?.name)} va con el grupo.`;
    return outgoing && text(outgoing.name) ? `${goes} ${text(outgoing.name)} se queda en el gremio, con lo suyo.` : goes;
}

/**
 * Lo que lleva, en una línea: lo puesto primero, y el oro.
 *
 * @param {any} member
 * @returns {string} «Lleva: Espada larga, Cota de malla y Escudo. 57 de oro.»
 */
export function carryLine(member) {
    const items = (Array.isArray(member?.items) ? member.items : []).filter(item => text(item?.name));
    const worn = new Set(Object.values(member?.equippedItems ?? {}).map(text).filter(Boolean));
    const sorted = [...items.filter(item => worn.has(text(item.id))), ...items.filter(item => !worn.has(text(item.id)))]
        .map(item => text(item.name));
    const gold = Math.max(0, Math.floor(Number(member?.gold) || 0));
    const shown = sorted.slice(0, CARRY_SHOWN);
    const more = sorted.length - shown.length;
    let things = '';
    if (more > 0) things = `${shown.join(', ')} y ${more === 1 ? 'una cosa más' : `${more} cosas más`}`;
    else if (shown.length > 1) things = `${shown.slice(0, -1).join(', ')} y ${shown[shown.length - 1]}`;
    else things = shown[0] ?? '';
    return [things ? `Lleva: ${things}.` : 'No lleva nada.', gold > 0 ? `${gold} de oro.` : ''].filter(Boolean).join(' ');
}

/**
 * @typedef {Object} HeroCard
 * @property {string} id
 * @property {string} name
 * @property {string} what   «Humana · Guerrera · Nivel 3»
 * @property {number} level
 * @property {string} icon   El de su clase, si no tiene cara.
 * @property {string} face   Su imagen, o vacío.
 * @property {string} carry  Lo que lleva y su oro.
 * @property {boolean} active Si es el que va ahora con el grupo.
 */

/**
 * La tarjeta de uno de los tuyos.
 *
 * @param {any} member
 * @param {boolean} active
 * @returns {HeroCard}
 */
function heroCard(member, active) {
    const className = text(member.class ?? member.charClass);
    const level = Math.max(1, Math.floor(Number(member.level) || 1));
    const face = text(member.avatar);
    return {
        id: String(member.id),
        name: text(member.name),
        what: [text(member.race), className, `Nivel ${level}`].filter(Boolean).join(' · '),
        level,
        icon: classIcon(className),
        face: face && face !== DEFAULT_FACE ? face : '',
        carry: carryLine(member),
        active,
    };
}

/**
 * Tus personajes del gremio, para elegir: primero el que va ahora, luego los que se quedan.
 * Los caídos no salen.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any} input.resting Lo guardado en el mundo del gremio.
 * @returns {HeroCard[]}
 */
export function hubHeroCards({ party, resting }) {
    const hero = activeHero(party);
    return [
        ...(hero && !hero.dead ? [heroCard(hero, true)] : []),
        ...readRestingHeroes(resting).filter(one => !one.dead).map(one => heroCard(one, false)),
    ];
}
