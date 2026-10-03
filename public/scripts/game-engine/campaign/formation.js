/**
 * Formación y papeles del grupo (J7.4 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Hasta aquí el orden del grupo era el de la lista, y los papeles de viaje (`travel-roles.js`)
 * los repartía el juego solo, al que mejor lo hacía. Ahora se elige:
 *
 * - **El orden de la marcha**: quién va delante, en medio y detrás. Quien va delante abre la
 *   marcha al andar por el tablero (J12.4), ve primero lo que hay en el suelo y se lleva el
 *   primer golpe de una emboscada de frente; quien va detrás, el de una por la espalda.
 * - **Quién cura**: quien venda a los caídos al acabar una pelea, si sabe.
 * - **Quién habla**: quien tira por el grupo cuando se intenta evitar una pelea hablando o
 *   pagando (`avoid-fight.js`) o salir de ella (`parley.js`).
 * - **Los papeles del camino**: guía, vigía y cazador. El vigía también hace la primera
 *   guardia de la noche en el campamento.
 *
 * Lo que no se elige («Automático») lo decide el juego como antes. Lo elegido se respeta
 * mientras esa persona esté en el grupo y en pie; si no, vuelve a decidir el juego.
 *
 * Se guarda así (en la partida): `{ order: ["id", …], duties: { cura: "id", portavoz: "", … } }`.
 *
 * Puro: lee, propone y ordena. No guarda nada.
 */

import { ROLES } from '../world/travel-roles.js';
import { NIGHT_ROLES } from './camp-roles.js';
import { skillModifier } from '../rules/checks.js';

/** Las filas de la marcha, en orden. */
export const ROWS = {
    delante: 'Delante',
    medio: 'En medio',
    detras: 'Detrás',
};

/** Los papeles que se eligen, con lo que hace cada uno. Los del camino, los de `travel-roles.js`. */
export const DUTIES = {
    cura: { label: 'Quién cura', does: 'Venda a los caídos al acabar una pelea.' },
    portavoz: { label: 'Quién habla', does: 'Tira por el grupo al hablar o pagar para evitar una pelea.' },
    guia: { label: ROLES.guia.label, does: `En el camino: ${ROLES.guia.gives}.` },
    vigia: { label: ROLES.vigia.label, does: `En el camino, ${ROLES.vigia.gives}; de noche, hace la primera guardia.` },
    cazador: { label: ROLES.cazador.label, does: `En el camino: ${ROLES.cazador.gives}.` },
    // E2.1: la antorcha ocupa una mano (5e). Quien la lleva, sin escudo; sin elegir, quien tenga una libre.
    antorcha: { label: 'Quién lleva la luz', does: 'En los sitios oscuros, lleva la antorcha o el farol. Ocupa una mano: con escudo, pelea sin él.' },
    // E6.2: los papeles de la noche al acampar (`camp-roles.js`). Sin elegir, al acampar se propone.
    cocinero: { label: NIGHT_ROLES.cocinero.label, does: `Al acampar: ${NIGHT_ROLES.cocinero.does}` },
    erudito: { label: NIGHT_ROLES.erudito.label, does: `Al acampar: ${NIGHT_ROLES.erudito.does}` },
    tasador: { label: NIGHT_ROLES.tasador.label, does: `Al acampar: ${NIGHT_ROLES.tasador.does}` },
};

/** Las clases que van delante y las que van detrás; las demás, en medio. */
const FRONT_CLASSES = ['fighter', 'guerrer', 'paladin', 'barbar', 'soldad', 'caballer'];
const BACK_CLASSES = ['wizard', 'mago', 'maga', 'sorcerer', 'hechicer', 'warlock', 'brujo', 'bruja', 'bard', 'bardo', 'barda', 'erudit', 'alquimist'];
/** Las que curan, de más a menos. */
const HEALER_CLASSES = ['cleric', 'clerig', 'sacerdot', 'druid', 'paladin', 'bard', 'bardo', 'barda', 'ranger', 'explorador', 'montaraz'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} member @returns {boolean} */
const able = (member) => Boolean(member) && !member.dead && (Number(member.hp ?? 1) || 0) > 0;

/**
 * @typedef {Object} Formation
 * @property {string[]} order Los ids, del primero al último.
 * @property {Record<string, string>} duties `cura`, `portavoz`, `guia`, `vigia`, `cazador`: un id o vacío.
 */

/**
 * La formación guardada, venga como venga.
 *
 * @param {any} raw
 * @returns {Formation}
 */
export function readFormation(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const order = [...new Set((Array.isArray(source.order) ? source.order : []).map(text).filter(Boolean))];
    /** @type {Record<string, string>} */
    const duties = {};
    for (const key of Object.keys(DUTIES)) duties[key] = text(source.duties?.[key]);
    return { order, duties };
}

/**
 * Cuánto de «delante» es alguien: su clase, su armadura y su vida.
 *
 * @param {any} member
 * @returns {number}
 */
export function frontness(member) {
    const kind = fold(member?.class ?? member?.className);
    const byClass = FRONT_CLASSES.some(c => kind.includes(c)) ? 20 : BACK_CLASSES.some(c => kind.includes(c)) ? -20 : 0;
    const armor = Number(member?.armorClass ?? member?.ac) || 10;
    const life = Number(member?.maxHp) || 0;
    return byClass + armor + life / 10;
}

/**
 * El orden que propone el juego: los que aguantan delante, los frágiles detrás.
 *
 * @param {any[]} members
 * @returns {string[]}
 */
export function suggestOrder(members) {
    return (Array.isArray(members) ? members : [])
        .filter(Boolean)
        .map((member, index) => ({ id: text(member.id), score: frontness(member), index }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.id);
}

/**
 * El orden de ahora: el elegido, sin los que ya no están, y los nuevos detrás en el orden que
 * propone el juego.
 *
 * @param {Formation} formation
 * @param {any[]} members
 * @returns {string[]}
 */
export function orderOf(formation, members) {
    const present = new Set((Array.isArray(members) ? members : []).map(m => text(m?.id)));
    const kept = (formation?.order ?? []).filter(id => present.has(id));
    const rest = suggestOrder(members).filter(id => !kept.includes(id));
    return [...kept, ...rest];
}

/**
 * La fila de cada puesto, según cuántos sois: el primero delante y el último detrás; con
 * cuatro o más, dos delante; con cinco o más, dos detrás.
 *
 * @param {number} index
 * @param {number} count
 * @returns {'delante'|'medio'|'detras'}
 */
export function rowOf(index, count) {
    if (count <= 1 || index <= 0) return 'delante';
    const front = count >= 4 ? 2 : 1;
    const back = count >= 5 ? 2 : 1;
    if (index < front) return 'delante';
    if (index >= count - back) return 'detras';
    return 'medio';
}

/**
 * Subir o bajar a alguien en la marcha.
 *
 * @param {Formation} formation
 * @param {any[]} members
 * @param {any} id
 * @param {number} delta −1 sube (hacia delante), +1 baja.
 * @returns {Formation}
 */
export function moveInOrder(formation, members, id, delta) {
    const order = orderOf(formation, members);
    const from = order.indexOf(text(id));
    if (from < 0) return { ...formation, order };
    const to = Math.max(0, Math.min(order.length - 1, from + Math.sign(Number(delta) || 0)));
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, text(id));
    return { ...readFormation(formation), order: next };
}

/**
 * Elegir a alguien para un papel (o vacío, que lo decida el juego).
 *
 * @param {Formation} formation
 * @param {string} duty
 * @param {any} id
 * @returns {Formation}
 */
export function setDuty(formation, duty, id) {
    const read = readFormation(formation);
    if (!(duty in DUTIES)) return read;
    return { ...read, duties: { ...read.duties, [duty]: text(id) } };
}

/**
 * Quien cura mejor, si no se elige: por su clase y su Sabiduría.
 *
 * @param {any[]} members
 * @returns {any|null}
 */
export function suggestHealer(members) {
    const list = (Array.isArray(members) ? members : []).filter(able);
    const rank = (/** @type {any} */ m) => {
        const kind = fold(m?.class ?? m?.className);
        const at = HEALER_CLASSES.findIndex(c => kind.includes(c));
        return at < 0 ? 100 : at;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || (Number(b.wisdom) || 10) - (Number(a.wisdom) || 10))[0] ?? null;
}

/**
 * Quien hace un papel ahora: el elegido si está y puede; si no, el que propone el juego.
 *
 * @param {Formation} formation
 * @param {string} duty
 * @param {any[]} members
 * @returns {any|null}
 */
export function dutyHolder(formation, duty, members) {
    const list = (Array.isArray(members) ? members : []).filter(able);
    const chosen = text(formation?.duties?.[duty]);
    const found = chosen ? list.find(m => text(m.id) === chosen) : null;
    if (found) return found;
    if (duty === 'cura') return suggestHealer(list);
    if (duty === 'portavoz') {
        return [...list].sort((a, b) => skillModifier(b, 'persuasion').modifier - skillModifier(a, 'persuasion').modifier)[0] ?? null;
    }
    return null;
}

/**
 * El grupo con quien cura el primero: así lo encuentra quien busca al que venda
 * (`patchUpAfterFight`), que se queda con el primero que sabe.
 *
 * @template T
 * @param {Formation} formation
 * @param {T[]} members
 * @returns {T[]}
 */
export function healerFirst(formation, members) {
    const list = Array.isArray(members) ? [...members] : [];
    const healer = dutyHolder(formation, 'cura', list);
    if (!healer) return list;
    return [healer, ...list.filter(m => m !== healer)];
}

/**
 * Los papeles del camino, como `assignRoles` de `travel-roles.js` (misma forma, para
 * `rollRoles` y `describeRoles`), respetando a quien se eligió para cada uno.
 *
 * @param {Object} input
 * @param {Formation} input.formation
 * @param {Array<{id: any, name: string}>} input.party Los que viajan y pueden hacer algo.
 * @param {(member: any, skill: string) => number} input.modifierOf
 * @returns {Array<{role: string, id: string, name: string, modifier: number}>}
 */
export function travelRolesOf({ formation, party, modifierOf }) {
    const free = [...(Array.isArray(party) ? party : []).filter(Boolean)];
    /** @type {Record<string, any>} */
    const fixed = {};
    for (const role of Object.keys(ROLES)) {
        const chosen = text(formation?.duties?.[role]);
        const member = chosen ? free.find(m => text(m.id) === chosen) : null;
        if (member) {
            fixed[role] = member;
            free.splice(free.indexOf(member), 1);
        }
    }
    /** @type {Array<{role: string, id: string, name: string, modifier: number}>} */
    const out = [];
    for (const [role, spec] of Object.entries(ROLES)) {
        let member = fixed[role];
        if (!member) {
            if (free.length === 0) continue;
            member = free
                .map(m => ({ m, modifier: Number(modifierOf(m, spec.skill)) || 0 }))
                .sort((a, b) => b.modifier - a.modifier || text(a.m.name).localeCompare(text(b.m.name)))[0].m;
            free.splice(free.indexOf(member), 1);
        }
        out.push({ role, id: text(member.id), name: text(member.name), modifier: Number(modifierOf(member, spec.skill)) || 0 });
    }
    return out;
}

/**
 * Quienes hacen guardia de noche: el vigía elegido el primero, y detrás los que propone el
 * campamento (`defaultGuards`), sin repetir.
 *
 * @param {Formation} formation
 * @param {any[]} members
 * @param {string[]} guards Los que propone el campamento (sus ids).
 * @param {number} [max]
 * @returns {string[]}
 */
export function guardsOf(formation, members, guards, max = 2) {
    const watcher = text(formation?.duties?.vigia);
    const ok = watcher && (Array.isArray(members) ? members : []).some(m => text(m?.id) === watcher && able(m));
    const list = [...(ok ? [watcher] : []), ...(Array.isArray(guards) ? guards.map(text) : [])];
    return [...new Set(list)].slice(0, Math.max(1, max));
}

/**
 * Quien se lleva el primer golpe de una emboscada: el de delante si vienen de frente, el de
 * detrás si vienen por la espalda.
 *
 * @param {Formation} formation
 * @param {any[]} members
 * @param {'delante'|'detras'} side
 * @returns {any|null}
 */
export function ambushed(formation, members, side) {
    const list = (Array.isArray(members) ? members : []).filter(able);
    const order = orderOf(formation, list);
    const id = side === 'detras' ? order[order.length - 1] : order[0];
    return list.find(m => text(m.id) === id) ?? null;
}

/**
 * El grupo en el orden de la marcha (para ponerlo en las casillas de inicio de un tablero:
 * el de delante, en la primera).
 *
 * @template T
 * @param {Formation} formation
 * @param {T[]} members
 * @returns {T[]}
 */
export function inMarchOrder(formation, members) {
    const list = Array.isArray(members) ? members : [];
    const order = orderOf(formation, list);
    return [...list].sort((a, b) => order.indexOf(text(/** @type {any} */ (a)?.id)) - order.indexOf(text(/** @type {any} */ (b)?.id)));
}

/**
 * La formación dicha en una línea: «Delante: Bran · En medio: Lyra · Detrás: Mira. Cura:
 * Lyra. Habla: Mira.»
 *
 * @param {Formation} formation
 * @param {any[]} members
 * @returns {string}
 */
export function describeFormation(formation, members) {
    const list = Array.isArray(members) ? members : [];
    const order = orderOf(formation, list);
    const nameOf = (/** @type {string} */ id) => text(list.find(m => text(m?.id) === id)?.name);
    /** @type {Record<string, string[]>} */
    const rows = { delante: [], medio: [], detras: [] };
    order.forEach((id, index) => rows[rowOf(index, order.length)].push(nameOf(id)));
    const march = Object.entries(ROWS).filter(([key]) => rows[key].length > 0).map(([key, label]) => `${label}: ${rows[key].join(', ')}`).join(' · ');
    const extras = [];
    const healer = dutyHolder(formation, 'cura', list);
    if (healer) extras.push(`Cura: ${healer.name}`);
    const speaker = dutyHolder(formation, 'portavoz', list);
    if (speaker) extras.push(`Habla: ${speaker.name}`);
    return [march, ...extras].filter(Boolean).join('. ') + (march ? '.' : '');
}
