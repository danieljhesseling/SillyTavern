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
import { addScar } from './feats.js';
import { listNames } from './engine-narrator.js';
import { healInjuries, readInjuries } from '../rules/injuries.js';
import { planLongRest, getHitDice } from '../rules/rest.js';
import { readNeeds } from '../rules/needs.js';

/** En los metadatos del mundo del gremio: los tuyos que se quedan en él. */
export const HUB_HEROES_KEY = 'hubHeroes';

/**
 * D-J12: cuántas noches de descanso se cuentan como mucho. Con más, ya no queda nada que
 * curar con dormir: lo que falte es para siempre.
 */
const MAX_NIGHTS = 60;

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
 * D-J12: con `day` (el del gremio, `hubDay`), se apunta desde cuándo descansa, para que al
 * volver al grupo se cure lo que da el tiempo (`wakeFromRest`).
 *
 * @param {any} raw
 * @param {{add?: any, remove?: string|number, day?: number}} change
 * @returns {any[]}
 */
export function withResting(raw, { add = null, remove = '', day = NaN } = {}) {
    const gone = text(remove);
    const since = Math.floor(Number(day));
    const dated = Number.isFinite(since) && since >= 0;
    // Quien ya descansaba antes de apuntarse el día (un gremio de antes de D-J12) empieza a
    // contar desde hoy: si no, no se curaría nunca.
    const list = readRestingHeroes(raw).filter(hero => !gone || String(hero.id) !== gone)
        .map(hero => (dated && !Number.isFinite(Number(hero.restDay)) ? { ...hero, restDay: since } : hero));
    if (!isOwnHero(add) || add.dead || add.id == null) return list;
    const kept = clone(add);
    if (dated) kept.restDay = since;
    return [...list.filter(hero => String(hero.id) !== String(kept.id)), kept];
}

/**
 * D-J12: el que vuelve al grupo después de descansar en el gremio, curado por los días que han
 * pasado, con las reglas de siempre:
 *
 * - **Las heridas** cuentan los días, como en campaña (`healInjuries`): las que curan se van y
 *   dejan su cicatriz; las permanentes se quedan.
 * - **Cada noche es un descanso largo** (`planLongRest`): la primera le pone en pie, y le va
 *   devolviendo los dados de golpe; sus conjuros y habilidades, como tras dormir.
 * - **Come, bebe y duerme** en el gremio: vuelve sin hambre, sin sed y sin sueño.
 *
 * Sin la marca de desde cuándo descansa (un gremio de antes de esto), no se cura nada.
 *
 * @param {any} hero Tal cual se quedó en el gremio.
 * @param {{day: number}} input El día del gremio de ahora (`hubDay`).
 * @returns {{hero: any, days: number, line: string}} Quien vuelve, los días que descansó y lo
 *   que se cuenta (vacío si no pasó ninguno).
 */
export function wakeFromRest(hero, { day }) {
    const woke = clone(hero ?? {});
    const since = Math.floor(Number(woke.restDay));
    delete woke.restDay;
    const now = Math.floor(Number(day));
    const days = Number.isFinite(since) && Number.isFinite(now) ? Math.max(0, now - since) : 0;
    if (days === 0 || woke.dead) return { hero: woke, days: 0, line: '' };

    /** @type {string[]} */
    const healed = [];
    if (readInjuries(woke).length > 0) {
        const patch = healInjuries(woke, days);
        woke.injuries = patch.injuries;
        woke.baseStats = patch.baseStats;
        Object.assign(woke, patch.stats);
        for (const injury of patch.healed) {
            healed.push(text(injury.label).toLowerCase());
            woke.scars = addScar(woke, injury.label);
        }
    }

    const hpBefore = Math.max(0, Number(woke.hp) || 0);
    for (let night = 0; night < Math.min(days, MAX_NIGHTS); night++) {
        const [entry] = planLongRest({ party: [woke] }).entries;
        if (!entry) break;
        const dice = getHitDice(woke);
        woke.hp = entry.hpAfter;
        woke.hitDiceSpent = Math.max(0, dice.spent - entry.diceRegained);
        if (entry.hpAfter >= (Number(woke.maxHp) || 0) && woke.hitDiceSpent === 0) break;
    }
    // Lo que devuelve dormir: `restoreAbilityUses` y `recoverSlots` dejan esto vacío tras un descanso largo.
    if (woke.abilityUses) woke.abilityUses = {};
    if (woke.spellCharges) woke.spellCharges = {};
    if (woke.slotsUsed) woke.slotsUsed = {};
    if (woke.needs) woke.needs = { ...readNeeds(woke), hunger: 0, thirst: 0, rest: 0 };

    const name = text(woke.name);
    const full = hpBefore < (Number(woke.maxHp) || 0) && woke.hp >= (Number(woke.maxHp) || 0);
    const line = [
        `${name} ha descansado ${days === 1 ? 'un día' : `${days} días`} en el gremio${full ? ': vuelve con la vida entera' : ''}.`,
        healed.length === 1 ? `Se le ha curado una herida: ${healed[0]}. Le queda la cicatriz.` : '',
        healed.length > 1 ? `Se le han curado ${healed.length} heridas: ${listNames(healed)}. Le quedan las cicatrices.` : '',
    ].filter(Boolean).join(' ');
    return { hero: woke, days, line };
}

/**
 * D-J14: un nombre, para compararlo: sin tildes, sin mayúsculas y con los espacios justos.
 * «Íria» y «iria » son el mismo nombre.
 *
 * @param {any} value
 * @returns {string}
 */
export function plainName(value) {
    return text(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}

/**
 * D-J14: los nombres que ya tiene un gremio: las fichas de personaje de su mundo (también las de
 * quien cayó), el tuyo que va con el grupo y los que se quedan. Los mercenarios no cuentan.
 *
 * @param {Object} input
 * @param {any[]} [input.entries] Las fichas del Lorebook con `dndData.entityType === 'character'`.
 * @param {any[]} [input.party]
 * @param {any} [input.resting] Lo guardado en el mundo del gremio (`HUB_HEROES_KEY`).
 * @returns {string[]} Cada nombre una vez, como se escribe.
 */
export function takenHeroNames({ entries = [], party = [], resting = null }) {
    const names = [
        ...(Array.isArray(entries) ? entries : []).map(entry => text(entry?.dndData?.name) || text(entry?.comment)),
        ...(Array.isArray(party) ? party : []).filter(isOwnHero).map(member => text(member.name)),
        ...readRestingHeroes(resting).map(hero => text(hero.name)),
    ].filter(Boolean);
    /** @type {Map<string, string>} */
    const seen = new Map();
    for (const name of names) if (!seen.has(plainName(name))) seen.set(plainName(name), name);
    return [...seen.values()];
}

/**
 * D-J14: si un nombre ya está cogido en el gremio.
 *
 * @param {any} name
 * @param {string[]} taken
 * @returns {string} El que ya lo tiene, como se escribe, o vacío si está libre.
 */
export function heroNameTaken(name, taken) {
    const wanted = plainName(name);
    if (!wanted) return '';
    return (Array.isArray(taken) ? taken : []).find(other => plainName(other) === wanted) ?? '';
}

/**
 * D-J14: lo que se dice cuando el nombre ya lo tiene otro.
 *
 * @param {string} name El que ya lo tiene.
 * @returns {string}
 */
export function nameTakenLine(name) {
    return `Ya hay un personaje que se llama ${text(name)} en este gremio. Elige otro nombre.`;
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
 * @property {string} className Su clase, como se escribe: para el retrato de relleno.
 * @property {string} race   Su especie, como se escribe.
 * @property {string} gender Cómo se presenta.
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
        className,
        race: text(member.race),
        gender: text(member.gender),
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
