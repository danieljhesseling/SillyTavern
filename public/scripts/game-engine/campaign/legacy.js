/**
 * Lo que queda de quien muere (ideas 36 y 199).
 *
 * Con muerte permanente, morir era un toast rojo y una ficha tachada. Aquí la muerte deja
 * cuatro cosas, todas sacadas de lo que ya se sabe de esa persona:
 *
 * - **Un epitafio**: quién era y qué hizo, en una línea. Sale de sus hazañas (`feats.js`) y
 *   de su mote, no de una llamada al modelo.
 * - **Una tumba** donde cayó. Al volver a ese sitio se ve, y el narrador lo sabe.
 * - **Una herencia**: lo mejor que llevaba pasa a quien más le quería.
 * - **El salón de la fama** (199): los caídos de todas las partidas, en una lista que no es
 *   de ninguna campaña. Las muertes quedan.
 *
 * Puro: decide y redacta. Quien llama guarda, mueve el objeto y lo cuenta.
 */

import { readFeats } from './feats.js';
import { basePrice } from './shop.js';

/** Cuántos caídos caben en el salón. Los más viejos se van al fondo y luego fuera. */
export const HALL_MAX = 100;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La línea que queda en la lápida.
 *
 * @param {any} member
 * @param {{day: number, place?: string, className?: string}} where
 * @returns {string}
 */
export function epitaphFor(member, { day, place = '', className = '' }) {
    const name = text(member?.name) || 'Alguien';
    const nick = text(member?.nickname) ? ` «${text(member.nickname)}»` : '';
    const level = Math.max(0, Math.floor(Number(member?.level) || 0));
    const who = [text(className || member?.charClass || member?.className), level > 0 ? `de nivel ${level}` : '']
        .filter(Boolean).join(' ');
    const feats = readFeats(member);
    const did = [
        feats.kills > 0 ? `tumbó a ${feats.kills} enemigo${feats.kills === 1 ? '' : 's'}` : '',
        feats.rescues > 0 ? `se puso delante de los suyos ${feats.rescues} ${feats.rescues === 1 ? 'vez' : 'veces'}` : '',
        feats.downed > 0 ? `se levantó ${feats.downed} ${feats.downed === 1 ? 'vez' : 'veces'}` : '',
    ].filter(Boolean);
    const deeds = did.length > 0 ? ` ${did.join(', ').replace(/^./, c => c.toUpperCase())}.` : '';
    const when = `Cayó${text(place) ? ` en ${text(place)}` : ''} el día ${Math.max(1, Math.floor(Number(day) || 1))}.`;
    return `${name}${nick}${who ? `, ${who}` : ''}. ${when}${deeds}`;
}

/**
 * Lo que se hereda: el arma que llevaba en la mano, o lo que más vale de lo que llevaba.
 *
 * Nada que se gaste ni ninguna llave: se hereda algo para llevarlo, no para usarlo una vez.
 *
 * @param {any} member
 * @returns {any|null}
 */
export function heirloomOf(member) {
    const items = (Array.isArray(member?.items) ? member.items : [])
        .filter((/** @type {any} */ item) => item?.id && !item.consumable && !/llave|ganz[uú]a/i.test(text(item.name)));
    if (items.length === 0) return null;
    const weaponId = member?.equippedItems?.weapon;
    const held = items.find((/** @type {any} */ item) => item.id === weaponId);
    if (held) return held;
    return [...items].sort((a, b) => basePrice(b) - basePrice(a))[0] ?? null;
}

/**
 * Quién hereda: si muere un compañero, quien lleva el grupo; si muere quien lleva el grupo,
 * el que más vínculo tenía con él.
 *
 * @param {Object} input
 * @param {any} input.dead
 * @param {any[]} input.party El grupo entero, con el héroe primero.
 * @param {Record<string, number>} [input.bondRanks] El rango de vínculo de cada uno, por id.
 * @returns {any|null}
 */
export function heirOf({ dead, party, bondRanks = {} }) {
    const alive = (Array.isArray(party) ? party : []).filter(m => m && m !== dead && !m.dead && (Number(m.hp) || 0) > 0);
    if (alive.length === 0) return null;
    const hero = (party || [])[0];
    if (hero && hero !== dead && alive.includes(hero)) return hero;
    return [...alive].sort((a, b) => (Number(bondRanks[String(b.id)]) || 0) - (Number(bondRanks[String(a.id)]) || 0))[0];
}

/**
 * @typedef {{name: string, place: string, day: number, epitaph: string}} Grave
 */

/**
 * @param {any} raw
 * @returns {Grave[]}
 */
export function readGraves(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(g => text(g?.name))
        .map(g => ({ name: text(g.name), place: text(g.place), day: Math.max(1, Math.floor(Number(g.day) || 1)), epitaph: text(g.epitaph) }));
}

/**
 * Apuntar una tumba. La misma persona no se entierra dos veces.
 *
 * @param {any} raw
 * @param {Grave} grave
 * @returns {Grave[]}
 */
export function addGrave(raw, grave) {
    const graves = readGraves(raw);
    if (graves.some(g => g.name === text(grave.name))) return graves;
    return [...graves, ...readGraves([grave])];
}

/**
 * Las tumbas de un sitio.
 *
 * @param {any} raw
 * @param {string} place
 * @returns {Grave[]}
 */
export function gravesAt(raw, place) {
    const here = text(place).toLowerCase();
    return here ? readGraves(raw).filter(g => g.place.toLowerCase() === here) : [];
}

/**
 * @typedef {{name: string, world: string, day: number, epitaph: string, when: string, mode?: string, iron?: boolean}} HallEntry
 */

/**
 * El salón de la fama, leído con tolerancia: el más reciente primero.
 *
 * @param {any} raw
 * @returns {HallEntry[]}
 */
export function readHall(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(e => text(e?.name))
        .map(e => ({
            name: text(e.name), world: text(e.world), day: Math.max(1, Math.floor(Number(e.day) || 1)),
            epitaph: text(e.epitaph), when: text(e.when),
            // R1: en qué modo se jugaba, y si fue de hierro de principio a fin.
            ...(text(e.mode) ? { mode: text(e.mode) } : {}),
            ...(e.iron === true ? { iron: true } : {}),
        }))
        .slice(0, HALL_MAX);
}

/**
 * Entrar en el salón. Arriba del todo; y quien ya está (mismo nombre, mundo y día) no se
 * repite, aunque se recargue la partida y vuelva a caer.
 *
 * @param {any} raw
 * @param {HallEntry} entry
 * @returns {HallEntry[]}
 */
export function addToHall(raw, entry) {
    const hall = readHall(raw);
    const [clean] = readHall([entry]);
    if (!clean) return hall;
    const same = (/** @type {HallEntry} */ e) => e.name === clean.name && e.world === clean.world && e.day === clean.day;
    return [clean, ...hall.filter(e => !same(e))].slice(0, HALL_MAX);
}

/**
 * Una fila del salón.
 *
 * @param {HallEntry} entry
 * @returns {string}
 */
export function describeHallEntry(entry) {
    const where = [entry.world, entry.when ? entry.when.slice(0, 10) : '', entry.iron ? 'de hierro' : ''].filter(Boolean).join(' · ');
    return `${entry.epitaph || entry.name}${where ? ` (${where})` : ''}`;
}
