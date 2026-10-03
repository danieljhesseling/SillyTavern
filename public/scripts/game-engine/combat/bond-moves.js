/**
 * Que el vínculo se note en la pelea (E3.4 de wiki/ROADMAP_ENTRETENIDO.md).
 *
 * Las ventajas de vínculo ya existían (`campaign/bonds.js`, `combat/bond-perks.js`,
 * `rules/pair-moves.js`), pero apenas se veían. Este módulo dice **cómo se ven y cómo suenan**:
 *
 * - la **jugada propia del rango 7** de cada compañero, con su nombre, su frase y lo que hace;
 * - el **golpe definitivo del rango 10**, con su nombre, su frase y su arma personal;
 * - la **frase corta** que dice el compañero cuando salta cada ventaja (D-J60: la dice él);
 * - y la **lista para su ficha**: «Con vínculo 5: Relevo» y lo siguiente que se abre.
 *
 * Todo esto es cosecha propia (como *Persona*), no reglas de 5e: las tiradas que hay debajo sí lo
 * son (ataques, la salvación para no caer al suelo).
 *
 * Puro: decide y dice. Quien llama tira los dados, aplica y dibuja.
 */

import { classKey } from '../rules/checks.js';
import { PAIR_RANK, pairCombo, roleOf, shootsFar } from '../rules/pair-moves.js';

/** El rango de la jugada propia de cada compañero. */
export const PAIR_MOVE_RANK = 7;

/** El rango de «amigo»: desde él lo mueves tú en combate (`CONTROL_RANK` de `bonds.js`). */
const FRIEND_RANK = 5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} name @returns {string} Como `keyOf` de `social.js`, sin depender de él. */
function keyOf(name) {
    return text(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Las tres formas que puede tener la jugada del rango 7. Las tres gastan la acción de quien la
 * empieza y la reacción del otro, y se hacen **una vez por combate**.
 *
 * - `derribo`: el compañero lo tira al suelo (salva con Fuerza o Destreza contra su CD de golpe
 *   sin armas) y el héroe le pega: de cerca, con ventaja; y remata la jugada (+1d4).
 * - `tiro`: el compañero dispara primero, desde donde esté; si acierta, le ha abierto la guardia
 *   y el golpe del héroe va con ventaja.
 * - `guardia`: atacáis los dos con ventaja y el compañero se queda cubriéndote: hasta tu próximo
 *   turno, te pegan con desventaja.
 */
export const PAIR_STYLES = {
    derribo: {
        label: 'Derribo',
        icon: 'fa-person-falling',
        reach: 'melee',
        describe: (/** @type {string} */ who) => `${who} lo tira al suelo y tú le pegas con ventaja.`,
    },
    tiro: {
        label: 'Tiro',
        icon: 'fa-crosshairs',
        reach: 'range',
        describe: (/** @type {string} */ who) => `${who} dispara primero, desde donde esté; si acierta, tu golpe va con ventaja.`,
    },
    guardia: {
        label: 'Guardia',
        icon: 'fa-shield-halved',
        reach: 'melee',
        describe: (/** @type {string} */ who) => `Atacáis los dos con ventaja, y ${who} te cubre: hasta tu próximo turno te pegan con desventaja.`,
    },
};

/**
 * @typedef {Object} BondSpec Lo propio de un compañero escrito.
 * @property {{name: string, style: keyof typeof PAIR_STYLES, say: string}} move La jugada del rango 7.
 * @property {{name: string, say: string}} ultimate El golpe del rango 10.
 * @property {any} weapon Su arma personal, como especificación para `createItem`.
 */

/**
 * Los tres del gremio (Gerd, Nella y Osric), con lo suyo. Los demás tienen lo de su oficio
 * (`STYLE_BY_CLASS`), con un nombre que lo dice.
 *
 * @type {Record<string, BondSpec>}
 */
export const COMPANION_BONDS = {
    'gerd-el-mellado': {
        move: { name: 'Yunque y martillo', style: 'derribo', say: '¡Lo tengo en el suelo! ¡Dale ahora!' },
        ultimate: { name: 'La carga del Mellado', say: '¡Apartaos, que voy!' },
        weapon: {
            name: 'Martillo de Gerd', subcategory: 'martial_melee', damageDice: '1d10', damageType: 'bludgeoning', hands: 2,
            description: 'El martillo de guerra de Gerd, con el mango vendado. Te lo deja porque confía en ti.',
        },
    },
    'nella-tresflechas': {
        move: { name: 'Flecha y filo', style: 'tiro', say: '¡Quieto ahí! ¡Ahora tú!' },
        ultimate: { name: 'Las tres flechas', say: '¡Ahora vas a ver por qué me llaman Tresflechas!' },
        weapon: {
            name: 'Arco de Nella', subcategory: 'martial_ranged', category: 'distancia', damageDice: '1d8', damageType: 'piercing', hands: 2, rangeFeet: 150,
            description: 'El arco largo de Nella, de tejo y con tres muescas en la empuñadura.',
        },
    },
    'osric-mediapaga': {
        move: { name: 'Escudo y espada', style: 'guardia', say: 'Yo te cubro. Tú pega.' },
        ultimate: { name: 'Sin un paso atrás', say: 'Esta vez no me echo atrás.' },
        weapon: {
            name: 'Espada de Osric', subcategory: 'martial_melee', damageDice: '1d10', damageType: 'slashing', hands: 1,
            description: 'La espada que Osric guardó once años sin usarla. Ahora la usa contigo.',
        },
    },
};

/** El nombre de la jugada de quien no tiene una escrita, por su forma. */
const STYLE_NAMES = { derribo: 'Al suelo con él', tiro: 'Fuego cruzado', guardia: 'Espalda con espalda' };

/** Lo que dice al hacerla quien no tiene frase escrita, por su forma. */
const STYLE_LINES = { derribo: '¡Al suelo con él! ¡Ahora!', tiro: '¡Lo tengo a tiro! ¡Ve!', guardia: 'Yo te cubro. ¡Pega!' };

/** Lo que dice al soltar su golpe definitivo quien no tiene frase escrita. */
const ULTIMATE_LINE = '¡Ahora o nunca!';

/**
 * Los oficios que derriban y los que se quedan cubriendo; el resto, si lleva un arma de lejos,
 * dispara.
 */
const STYLE_BY_CLASS = {
    fighter: 'derribo', barbarian: 'derribo', monk: 'derribo', paladin: 'guardia', cleric: 'guardia',
    ranger: 'tiro', rogue: 'tiro', wizard: 'tiro', sorcerer: 'tiro', warlock: 'tiro', bard: 'guardia', druid: 'guardia',
};

/**
 * Lo escrito para alguien, si lo hay.
 *
 * @param {any} member
 * @returns {BondSpec|null}
 */
export function bondSpecOf(member) {
    const key = keyOf(member?.name);
    if (!key) return null;
    if (COMPANION_BONDS[key]) return COMPANION_BONDS[key];
    // Por su primer nombre también («Gerd» es Gerd el Mellado).
    const first = key.split('-')[0];
    const found = Object.entries(COMPANION_BONDS).find(([k]) => k.split('-')[0] === first);
    return found ? found[1] : null;
}

/**
 * @typedef {Object} PairMove
 * @property {string} name «Yunque y martillo».
 * @property {keyof typeof PAIR_STYLES} style
 * @property {string} say Lo que dice al hacerla.
 * @property {string} describe Lo que hace, en una frase.
 */

/**
 * La jugada del rango 7 de un compañero: la suya si la tiene escrita; si no, la de su oficio.
 *
 * @param {any} member
 * @returns {PairMove}
 */
export function pairMoveOf(member) {
    const spec = bondSpecOf(member);
    const who = shortOf(member);
    if (spec) {
        return { name: spec.move.name, style: spec.move.style, say: spec.move.say, describe: PAIR_STYLES[spec.move.style].describe(who) };
    }
    const byClass = /** @type {Record<string, keyof typeof PAIR_STYLES>} */ (STYLE_BY_CLASS)[classKey(member?.class ?? member?.className)];
    /** @type {keyof typeof PAIR_STYLES} */
    const style = shootsFar(member) ? 'tiro' : (byClass ?? 'guardia');
    return { name: STYLE_NAMES[style], style, say: STYLE_LINES[style], describe: PAIR_STYLES[style].describe(who) };
}

/**
 * El golpe definitivo del rango 10 de alguien: su nombre y lo que dice.
 *
 * @param {any} member
 * @returns {{name: string, say: string}}
 */
export function ultimateOf(member) {
    const spec = bondSpecOf(member);
    if (spec) return { name: spec.ultimate.name, say: spec.ultimate.say };
    return { name: 'Golpe definitivo', say: ULTIMATE_LINE };
}

/**
 * Cómo se le llama en corto: el primer nombre.
 *
 * @param {any} member
 * @returns {string}
 */
function shortOf(member) {
    return text(member?.name).split(/\s+/)[0] || 'tu compañero';
}

/**
 * El arma personal del rango 10, como especificación para `createItem`: la suya si la tiene
 * escrita (el arco de Nella es un arco); si no, una de su estilo (de lejos, si dispara).
 *
 * @param {any} member
 * @returns {any}
 */
export function personalWeaponOf(member) {
    const name = text(member?.name) || 'Compañero';
    const spec = bondSpecOf(member);
    const base = {
        type: 'weapon', category: 'weapon', weight: 1.5, slot: 'weapon', rarity: 'Very Rare',
    };
    if (spec) return { ...base, ...spec.weapon, category: spec.weapon.category ?? 'weapon' };
    if (shootsFar(member)) {
        return {
            ...base, name: `Arco personal de ${name}`, subcategory: 'martial_ranged', category: 'distancia', damageDice: '1d8',
            damageType: 'piercing', hands: 2, rangeFeet: 150,
            description: `Hecho para ${name}. Solo aparece cuando ese vínculo llega al final.`,
        };
    }
    return null;
}

// ---------------------------------------------------------------- lo que dice al saltar

/**
 * Las frases cortas de cada ventaja al saltar, dichas por el compañero (D-J60). Varias, para que
 * no se repita siempre la misma.
 */
export const PERK_LINES = {
    follow_up: ['¡Lo dejaste abierto!', '¡Detrás de ti!', '¡Ese es mío también!'],
    pair: ['¡A la vez, ahora!', '¡Contigo!', '¡Vamos juntos!'],
    baton_pass: ['¡Tuyo! ¡Sigue tú!', '¡Te toca, ve!', '¡Relevo! ¡Adelante!'],
    endure: ['¡Detrás de mí!', '¡A ti no te toca!', '¡Aguanta, que estoy aquí!'],
};

/**
 * La frase de un compañero cuando salta una de sus ventajas. La de su jugada y la de su golpe
 * definitivo son las suyas; las demás, una de las de siempre.
 *
 * @param {any} member
 * @param {'follow_up'|'pair'|'baton_pass'|'endure'|'pair_move'|'ultimate'} perkId
 * @param {() => number} [random]
 * @returns {string}
 */
export function perkLine(member, perkId, random = Math.random) {
    if (perkId === 'pair_move') return pairMoveOf(member).say;
    if (perkId === 'ultimate') return ultimateOf(member).say;
    const pool = /** @type {Record<string, string[]>} */ (PERK_LINES)[perkId] ?? [];
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.max(0, Math.min(0.9999, Number(random()) || 0)) * pool.length)];
}

/**
 * El rótulo que sale en el tablero al saltar: «Vínculo 7 · Yunque y martillo».
 *
 * @param {any} member
 * @param {'follow_up'|'pair'|'baton_pass'|'endure'|'pair_move'|'ultimate'} perkId
 * @returns {string}
 */
export function perkBanner(member, perkId) {
    switch (perkId) {
        case 'follow_up': return `Vínculo ${PAIR_RANK} · Ataque de seguimiento`;
        case 'pair': return `Vínculo ${PAIR_RANK} · A una`;
        case 'baton_pass': return `Vínculo ${FRIEND_RANK} · Relevo`;
        case 'pair_move': return `Vínculo ${PAIR_MOVE_RANK} · ${pairMoveOf(member).name}`;
        case 'endure': return 'Vínculo 8 · Aguantar';
        case 'ultimate': return `Vínculo 10 · ${ultimateOf(member).name}`;
        default: return '';
    }
}

// ---------------------------------------------------------------- quién puede hacer la del rango 7

/**
 * @typedef {Object} MoveFighter
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} hp
 * @property {number} rank Su vínculo con el héroe (el héroe no lo usa).
 * @property {number} [reachFeet] Hasta dónde llega con su arma.
 * @property {boolean} [reactionUsed]
 * @property {boolean} [moveUsed] Si ya ha hecho su jugada en este combate.
 * @property {keyof typeof PAIR_STYLES} [style] La forma de su jugada (`pairMoveOf`).
 */

/** @param {{x: number, y: number}} a @param {{x: number, y: number}} b */
const feet = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;

/**
 * Con quién puede hacer quien tiene el turno la jugada del rango 7, y contra quién. Como la del
 * rango 3 (`pairOptions`): entre el héroe y un compañero con vínculo; si le toca al héroe, vale
 * cualquier compañero con rango 7 que no la haya hecho ya; si le toca a un compañero, solo con el
 * héroe. El héroe tiene que llegar al enemigo con su arma; el compañero, pegado a él (derribo,
 * guardia) o a tiro (tiro).
 *
 * @param {Object} input
 * @param {MoveFighter} input.actor
 * @param {string} input.heroId
 * @param {MoveFighter[]} input.party
 * @param {Array<{id: string, name: string, x: number, y: number, hp: number}>} input.enemies
 * @returns {Array<{partnerId: string, partnerName: string, companionId: string, enemyId: string, enemyName: string}>}
 */
export function pairMoveOptions({ actor, heroId, party, enemies }) {
    if (!actor || (Number(actor.hp) || 0) <= 0) return [];
    const list = Array.isArray(party) ? party : [];
    const isHero = String(actor.id) === String(heroId);
    const hero = isHero ? actor : list.find(p => String(p.id) === String(heroId));
    if (!hero || (Number(hero.hp) || 0) <= 0) return [];
    /** @type {MoveFighter[]} */
    const companions = isHero
        ? list.filter(p => String(p.id) !== String(heroId) && (Number(p.hp) || 0) > 0 && (Number(p.rank) || 0) >= PAIR_MOVE_RANK
            && !p.moveUsed && !p.reactionUsed)
        : ((Number(actor.rank) || 0) >= PAIR_MOVE_RANK && !actor.moveUsed && !hero.reactionUsed ? [actor] : []);
    /** @type {Array<{partnerId: string, partnerName: string, companionId: string, enemyId: string, enemyName: string}>} */
    const out = [];
    for (const enemy of Array.isArray(enemies) ? enemies : []) {
        if ((Number(enemy.hp) || 0) <= 0) continue;
        if (feet(hero, enemy) > Math.max(5, Number(hero.reachFeet) || 5)) continue;
        for (const mate of companions) {
            const style = mate.style ?? 'guardia';
            const reach = PAIR_STYLES[style]?.reach === 'range' ? Math.max(5, Number(mate.reachFeet) || 5) : 5;
            if (feet(mate, enemy) > reach) continue;
            const partner = isHero ? mate : hero;
            out.push({
                partnerId: String(partner.id), partnerName: String(partner.name), companionId: String(mate.id),
                enemyId: String(enemy.id), enemyName: String(enemy.name),
            });
        }
    }
    return out;
}

// ---------------------------------------------------------------- el Relevo

/**
 * El Relevo (rango 5): quien acaba de tumbar a un enemigo le pasa el turno a uno de los suyos que
 * aún no ha jugado esta ronda, que juega justo después. El orden de la ronda no se rompe: nadie
 * juega dos veces ni se queda sin jugar.
 *
 * @param {Array<{id: any, isEnemy?: boolean}>} order La iniciativa.
 * @param {number} currentIndex De quién es el turno ahora.
 * @param {string} receiverId A quién se le pasa.
 * @returns {any[]|null} La iniciativa con él justo después, o null si ya ha jugado (o no está).
 */
export function relayOrder(order, currentIndex, receiverId) {
    const list = Array.isArray(order) ? [...order] : [];
    const now = Math.floor(Number(currentIndex) || 0);
    const at = list.findIndex((e, i) => i > now && e && !e.isEnemy && String(e.id) === String(receiverId));
    if (at < 0) return null;
    const [entry] = list.splice(at, 1);
    list.splice(now + 1, 0, entry);
    return list;
}

/**
 * Quiénes del grupo aún no han jugado esta ronda (los que van detrás en la iniciativa).
 *
 * @param {Array<{id: any, isEnemy?: boolean}>} order
 * @param {number} currentIndex
 * @returns {string[]}
 */
export function stillToAct(order, currentIndex) {
    const now = Math.floor(Number(currentIndex) || 0);
    return (Array.isArray(order) ? order : []).filter((e, i) => i > now && e && !e.isEnemy).map(e => String(e.id));
}

// ---------------------------------------------------------------- la ficha

/**
 * @typedef {Object} BondSheetRow
 * @property {number} rank
 * @property {string} label «Relevo».
 * @property {string} describe Lo que hace, en una frase.
 * @property {boolean} unlocked
 * @property {boolean} next Si es lo siguiente que se abre.
 */

/**
 * Lo que da el vínculo con alguien en combate, para su ficha: todo, con lo ya abierto marcado y lo
 * siguiente señalado («Con vínculo 7: Yunque y martillo»).
 *
 * E3.2: con el héroe (`hero`), la fila del rango 3 dice la jugada en pareja de los dos por sus
 * papeles («Con vínculo 3: Yo lo paro, tú tiras»).
 *
 * @param {any} member
 * @param {number} rank Su vínculo contigo.
 * @param {any} [hero] El héroe, para nombrar la jugada en pareja de los dos.
 * @returns {BondSheetRow[]}
 */
export function bondSheetRows(member, rank, hero = null) {
    const r = Math.max(0, Math.floor(Number(rank) || 0));
    const who = shortOf(member);
    const move = pairMoveOf(member);
    const ult = ultimateOf(member);
    const combo = hero ? pairCombo({ id: 'hero', name: hero.name, role: roleOf(hero) }, { id: 'mate', name: member?.name, role: roleOf(member) }) : null;
    const rows = [
        { rank: PAIR_RANK, label: 'Ataque de seguimiento', describe: `Si aciertas un crítico, ${who} puede atacar gratis al mismo enemigo (la mitad de las veces).` },
        combo
            ? { rank: PAIR_RANK, label: combo.name, describe: `En pareja: ${combo.describe} Gasta su reacción. Con otro del grupo que también tenga vínculo ${PAIR_RANK}, la suya según sus papeles.` }
            : { rank: PAIR_RANK, label: 'A una', describe: 'Llegando los dos al mismo enemigo, atacáis los dos con ventaja (gasta su reacción).' },
        { rank: FRIEND_RANK, label: 'Relevo', describe: 'Si tumba a un enemigo, puede pasarle el turno a alguien del grupo que aún no haya jugado.' },
        { rank: FRIEND_RANK, label: 'Lo muevo yo', describe: 'En combate puedes moverle tú, o dejárselo al juego.' },
        { rank: PAIR_MOVE_RANK, label: move.name, describe: `${move.describe} Una vez por combate.` },
        { rank: 8, label: 'Aguantar', describe: `Si fueras a caer, ${who} se interpone y te quedas con 1 PG. Una vez al día.` },
        { rank: 10, label: ult.name, describe: 'Su golpe definitivo: acierta sin tirar, con el máximo de su arma más su nivel. Una vez al día. Y su arma personal.' },
    ];
    const firstLocked = rows.find(row => row.rank > r)?.rank ?? 0;
    return rows.map(row => ({ ...row, unlocked: row.rank <= r, next: row.rank === firstLocked }));
}

/**
 * Las filas de la ficha en palabras: «Con vínculo 5: Relevo» y, la siguiente, «Con vínculo 7:
 * Yunque y martillo (lo siguiente)».
 *
 * @param {BondSheetRow} row
 * @returns {string}
 */
export function bondSheetLine(row) {
    return `Con vínculo ${row.rank}: ${row.label}${row.next ? ' (lo siguiente)' : ''}`;
}
