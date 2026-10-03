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
 *   de ninguna campaña. Las muertes quedan. Y desde J3.9, las campañas terminadas: cuál, con
 *   qué final, quién fue y cuándo.
 *
 * Puro: decide y redacta. Quien llama guarda, mueve el objeto y lo cuenta.
 */

import { readFeats } from './feats.js';
import { basePrice } from './shop.js';
import { listNames } from './engine-narrator.js';

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
 * @typedef {{name: string, world: string, day: number, epitaph: string, when: string, mode?: string, iron?: boolean,
 *   kind?: 'campaign'|'couple'|'retired', ending?: string, party?: string[], fallen?: string[]}} HallEntry
 *   J3.9: una campaña terminada también entra (`kind: 'campaign'`): `name` es la campaña,
 *   `ending` el final, `party` quién fue y `fallen` quién no volvió. `day`, cuánto duró.
 *   J14.10: y una pareja (`kind: 'couple'`): `name` son los dos, `epitaph` su línea y `day`
 *   el día en que lo fueron. E8.3: y un héroe que se retiró al gremio de maestro (`kind:
 *   'retired'`): `epitaph` es su línea.
 */

/** @param {any} value @returns {string[]} */
const names = (value) => (Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : []);

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
            // J3.9: una campaña terminada, con su final y su gente.
            ...(e.kind === 'campaign' ? { kind: /** @type {'campaign'} */ ('campaign'), ending: text(e.ending), party: names(e.party), fallen: names(e.fallen) } : {}),
            // J14.10: una pareja.
            ...(e.kind === 'couple' ? { kind: /** @type {'couple'} */ ('couple') } : {}),
            // E8.3: un maestro del gremio.
            ...(e.kind === 'retired' ? { kind: /** @type {'retired'} */ ('retired') } : {}),
        }))
        .slice(0, HALL_MAX);
}

/**
 * Entrar en el salón. Arriba del todo; y quien ya está (mismo nombre, mundo y día) no se
 * repite, aunque se recargue la partida y vuelva a caer. Una campaña terminada está una vez
 * por partida y final: apuntarla otra vez (al volver al gremio) la deja como estaba, salvo el
 * nombre (D-J19): si ahora se sabe cómo se llama en el tablón, se pone ese.
 *
 * @param {any} raw
 * @param {HallEntry} entry
 * @returns {HallEntry[]}
 */
export function addToHall(raw, entry) {
    const hall = readHall(raw);
    const [clean] = readHall([entry]);
    if (!clean) return hall;
    if (clean.kind === 'campaign') {
        const known = (/** @type {HallEntry} */ e) => e.kind === 'campaign' && e.world === clean.world && e.ending === clean.ending;
        return hall.some(known)
            ? hall.map(e => (known(e) ? { ...e, name: clean.name } : e))
            : [clean, ...hall].slice(0, HALL_MAX);
    }
    // J14.10: una pareja está una vez por partida, aunque se recargue y lo vuelva a ser.
    if (clean.kind === 'couple') {
        return hall.some(e => e.kind === 'couple' && e.name === clean.name && e.world === clean.world)
            ? hall
            : [clean, ...hall].slice(0, HALL_MAX);
    }
    // E8.3: quien se retira está una vez por partida.
    if (clean.kind === 'retired') {
        return hall.some(e => e.kind === 'retired' && e.name === clean.name && e.world === clean.world)
            ? hall
            : [clean, ...hall].slice(0, HALL_MAX);
    }
    const same = (/** @type {HallEntry} */ e) => !e.kind && e.name === clean.name && e.world === clean.world && e.day === clean.day;
    return [clean, ...hall.filter(e => !same(e))].slice(0, HALL_MAX);
}

/**
 * Una fila del salón.
 *
 * @param {HallEntry} entry
 * @returns {string}
 */
export function describeHallEntry(entry) {
    if (entry.kind === 'campaign') {
        // «La Maldición de Strahd: terminada con «Barovia, libre». Fueron Tessa y Gerd. (2026-09-29 · 34 días)»
        const lost = entry.fallen ?? [];
        const went = entry.party ?? [];
        const when = [entry.when ? entry.when.slice(0, 10) : '', entry.day > 1 ? `${entry.day} días` : '', entry.iron ? 'de hierro' : '']
            .filter(Boolean).join(' · ');
        return [
            `${entry.name}: terminada${entry.ending ? ` con «${entry.ending}»` : ''}.`,
            went.length > 0 ? `${went.length === 1 ? 'Fue' : 'Fueron'} ${listNames(went)}.` : '',
            lost.length > 0 ? `No ${lost.length === 1 ? 'volvió' : 'volvieron'}: ${listNames(lost)}.` : '',
            when ? `(${when})` : '',
        ].filter(Boolean).join(' ');
    }
    const where = [entry.world, entry.when ? entry.when.slice(0, 10) : '', entry.iron ? 'de hierro' : ''].filter(Boolean).join(' · ');
    // J14.10: «♥ Iria y Nella Tresflechas, juntas desde el día 9…».
    if (entry.kind === 'couple') return `♥ ${entry.epitaph || entry.name}${where ? ` (${where})` : ''}`;
    // E8.3: «Tessa, guerrera de nivel 9, se retiró al gremio de Puerto Alba…».
    if (entry.kind === 'retired') return `🎓 ${entry.epitaph || entry.name}${where ? ` (${where})` : ''}`;
    return `${entry.epitaph || entry.name}${where ? ` (${where})` : ''}`;
}

/**
 * Lo que hay en el salón, dicho corto: «1 campaña terminada · 2 caídos». Vacío si no hay nada.
 *
 * @param {any} raw
 * @returns {string}
 */
export function describeHallCount(raw) {
    const hall = readHall(raw);
    const done = hall.filter(e => e.kind === 'campaign').length;
    const couples = hall.filter(e => e.kind === 'couple').length;
    const retired = hall.filter(e => e.kind === 'retired').length;
    const fallen = hall.length - done - couples - retired;
    return [
        done > 0 ? `${done} ${done === 1 ? 'campaña terminada' : 'campañas terminadas'}` : '',
        fallen > 0 ? `${fallen} ${fallen === 1 ? 'caído' : 'caídos'}` : '',
        // J14.10: las parejas (si el romance está apagado, quien llama las quita antes).
        couples > 0 ? `${couples} ${couples === 1 ? 'pareja' : 'parejas'}` : '',
        retired > 0 ? `${retired} ${retired === 1 ? 'maestro' : 'maestros'}` : '',
    ].filter(Boolean).join(' · ');
}

/**
 * E8.7: quien vuelve a la vida en el templo sale de la lista de los caídos (de esa partida).
 * Las campañas, las parejas y los maestros no se tocan.
 *
 * @param {any} raw
 * @param {{name: string, world: string}} who
 * @returns {HallEntry[]}
 */
export function withoutFallen(raw, { name, world }) {
    const hall = readHall(raw);
    const index = hall.findIndex(e => !e.kind && e.name === text(name) && e.world === text(world));
    return index < 0 ? hall : [...hall.slice(0, index), ...hall.slice(index + 1)];
}
