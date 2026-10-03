/**
 * Ataques en pareja: con vínculo, dos pelean como uno (R3 del roadmap de profundidad).
 *
 * Los vínculos daban mejoras sueltas (interponerse, animar). Con esto, a partir del rango 3,
 * el héroe y ese compañero pueden hacer una jugada juntos cuando los dos están pegados al
 * mismo enemigo: atacan los dos, con ventaja, y el compañero gasta su reacción. Es la forma
 * más clara de que invertir en alguien se note en el tablero.
 *
 * E3.2 de wiki/ROADMAP_ENTRETENIDO.md, **combos para todos**:
 *
 * - **cualquier pareja del grupo**, no solo tú y un compañero: dos compañeros que se fían de ti
 *   (los dos con vínculo 3) también van a una. El vínculo de la pareja es el del que menos se fía;
 * - **cada uno pega desde donde llega con su arma**: la arquera dispara desde lejos, no hace
 *   falta que esté pegada;
 * - **según sus papeles** (`roleOf`: delante, sombra, tirador, magia, apoyo) la jugada tiene su
 *   nombre, su orden (quien dispara abre, la sombra remata) y lo que deja después: quien va
 *   delante se queda cubriendo al otro, la sombra le despista, el tirador le deja vendido, la
 *   magia le frena y el apoyo bendice a su pareja.
 *
 * Cosecha propia (como *Persona*); debajo, todo son reglas de 5e: ataques con ventaja, Ayudar,
 * Bendición, Rayo de escarcha.
 *
 * Puro: quién puede hacerla con quién, cómo se llama y qué deja. Quien llama tira y aplica.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R3.
 */

import { classKey } from './checks.js';

/** El rango de vínculo desde el que se puede. */
export const PAIR_RANK = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

// ---------------------------------------------------------------- los papeles

/**
 * Los papeles en una pelea, y cómo se dicen.
 *
 * @type {Record<string, {label: string}>}
 */
export const ROLES = {
    frente: { label: 'va delante' },
    sombra: { label: 'golpea por la espalda' },
    tirador: { label: 'dispara desde lejos' },
    magia: { label: 'lanza conjuros' },
    apoyo: { label: 'cuida del grupo' },
};

/** @typedef {'frente'|'sombra'|'tirador'|'magia'|'apoyo'} Role */

/** El papel de cada oficio. El explorador, según lo que lleve en la mano. */
const ROLE_BY_CLASS = {
    fighter: 'frente', barbarian: 'frente', paladin: 'frente', monk: 'frente',
    rogue: 'sombra',
    wizard: 'magia', sorcerer: 'magia', warlock: 'magia',
    cleric: 'apoyo', druid: 'apoyo', bard: 'apoyo',
};

/** El orden de los papeles en la tabla de jugadas. */
const ROLE_ORDER = ['frente', 'sombra', 'tirador', 'magia', 'apoyo'];

/**
 * Si alguien lleva puesta un arma de lejos, por lo que dice de ella (`items` y `equippedItems`).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function shootsFar(member) {
    const items = Array.isArray(member?.items) ? member.items : [];
    const weapon = items.find((/** @type {any} */ i) => i && String(i.id) === String(member?.equippedItems?.weapon ?? ''));
    if (!weapon) return false;
    if (text(weapon.category) === 'distancia' || /ranged/.test(text(weapon.subcategory))) return true;
    if ((Number(weapon.rangeFeet) || 0) > 30) return true;
    return /\b(arco|ballesta|honda|bow|crossbow|sling)\b/i.test(text(weapon.name));
}

/**
 * El papel de alguien en la pelea: por su oficio; el explorador y quien no tiene oficio
 * conocido, por su arma (de lejos, tirador; si no, delante).
 *
 * @param {any} member
 * @returns {Role}
 */
export function roleOf(member) {
    const byClass = /** @type {Record<string, Role>} */ (ROLE_BY_CLASS)[classKey(member?.class ?? member?.className)];
    if (byClass) return byClass;
    return shootsFar(member) ? 'tirador' : 'frente';
}

// ---------------------------------------------------------------- las jugadas por papeles

/**
 * Lo que deja cada papel después de la jugada.
 *
 * - `cubrir`: quien va delante se queda cubriendo a su pareja (le pegan con desventaja hasta su
 *   próximo turno);
 * - `despistar`: el enemigo no sabe a quién mirar (pega con desventaja en su próximo turno);
 * - `vendido`: el siguiente golpe de los vuestros contra él va con ventaja (la acción Ayudar);
 * - `frenar`: se mueve 10 pies menos en su próximo turno (como el Rayo de escarcha);
 * - `bendecir`: su pareja va bendecida dos rondas (como Bendición: pega mejor).
 *
 * @type {Record<Role, 'cubrir'|'despistar'|'vendido'|'frenar'|'bendecir'>}
 */
export const ROLE_EFFECT = {
    frente: 'cubrir', sombra: 'despistar', tirador: 'vendido', magia: 'frenar', apoyo: 'bendecir',
};

/**
 * Las jugadas, por pareja de papeles (en el orden de `ROLE_ORDER`): su nombre y lo que dice el
 * compañero al saltar (vale en boca de cualquiera de los dos).
 *
 * @type {Record<string, {name: string, say: string}>}
 */
export const PAIR_COMBOS = {
    'frente+frente': { name: 'Muro de escudos', say: '¡Hombro con hombro! ¡Que no pase!' },
    'frente+sombra': { name: 'Tú lo entretienes', say: '¡Uno por delante y otro por detrás!' },
    'frente+tirador': { name: 'Yo lo paro, tú tiras', say: '¡Uno lo para y el otro tira!' },
    'frente+magia': { name: 'Cúbreme mientras', say: '¡Acero y conjuro, a la vez!' },
    'frente+apoyo': { name: 'Espada y plegaria', say: '¡Con fe y con acero!' },
    'sombra+sombra': { name: 'Por los dos lados', say: 'Tú por la izquierda, yo por la derecha.' },
    'sombra+tirador': { name: 'Mírame a mí', say: '¡Mira aquí! …y no mires allí.' },
    'sombra+magia': { name: 'Truco y puñal', say: '¡Mira qué luces! …y ahora, el puñal.' },
    'sombra+apoyo': { name: 'A su sombra', say: 'Ve, que yo te guardo la espalda.' },
    'tirador+tirador': { name: 'Dos arcos, un blanco', say: '¡A la de tres! ¡Tres!' },
    'tirador+magia': { name: 'Flecha y chispa', say: '¡Flecha y chispa, a la vez!' },
    'tirador+apoyo': { name: 'Apunta, que te guío', say: 'Respira hondo… ahora.' },
    'magia+magia': { name: 'Dos conjuros a la vez', say: '¡Juntos! ¡Ahora!' },
    'magia+apoyo': { name: 'Luz y conjuro', say: '¡Que la luz nos guíe!' },
    'apoyo+apoyo': { name: 'Rezad conmigo', say: 'Juntos, y no caeremos.' },
};

/**
 * @param {Role} a
 * @param {Role} b
 * @returns {string} «frente+tirador».
 */
export function comboKey(a, b) {
    const [x, y] = [a, b].sort((p, q) => ROLE_ORDER.indexOf(p) - ROLE_ORDER.indexOf(q));
    return `${x}+${y}`;
}

/** @param {any} who @returns {string} El primer nombre. */
const shortName = (who) => text(who?.name).split(/\s+/)[0] || 'tu compañero';

/** Quién abre: el que dispara o lanza, antes; la sombra, la última (remata con ventaja). */
const OPENS = { tirador: 0, magia: 1, frente: 2, apoyo: 3, sombra: 4 };

/**
 * @typedef {Object} PairEffect
 * @property {'cubrir'|'despistar'|'vendido'|'frenar'|'bendecir'} kind
 * @property {string} by Quién lo hace.
 * @property {string} on A quién: su pareja (cubrir, bendecir) o el enemigo (vacío).
 */

/**
 * @typedef {Object} PairCombo
 * @property {string} key «frente+tirador».
 * @property {string} name «Yo lo paro, tú tiras».
 * @property {string} say Lo que dice quien se suma.
 * @property {string[]} order Los dos, en el orden en que pegan.
 * @property {PairEffect[]} effects Lo que deja después.
 * @property {string} describe Lo que hace, en llano.
 */

/**
 * La jugada en pareja de dos del grupo, según sus papeles.
 *
 * @param {{id: any, name?: string, role?: Role}} actor Quien la empieza (a quien le toca).
 * @param {{id: any, name?: string, role?: Role}} partner Quien se suma.
 * @returns {PairCombo}
 */
export function pairCombo(actor, partner) {
    const ra = /** @type {Role} */ (actor?.role ?? 'frente');
    const rb = /** @type {Role} */ (partner?.role ?? 'frente');
    const key = comboKey(ra, rb);
    const combo = PAIR_COMBOS[key];
    const a = { id: String(actor?.id ?? ''), name: shortName(actor), role: ra };
    const b = { id: String(partner?.id ?? ''), name: shortName(partner), role: rb };
    // Abre quien dispara o lanza; la sombra, la última. Si da igual, empieza a quien le toca.
    const [first, second] = OPENS[rb] < OPENS[ra] ? [b, a] : [a, b];
    /** @type {PairEffect[]} */
    const effects = [];
    for (const [me, other] of [[a, b], [b, a]]) {
        const kind = ROLE_EFFECT[me.role];
        // Dos del mismo papel que deja algo al enemigo: una vez basta.
        if (effects.some(e => e.kind === kind && !e.on)) continue;
        effects.push({ kind, by: me.id, on: kind === 'cubrir' || kind === 'bendecir' ? other.id : '' });
    }
    const names = Object.fromEntries([[a.id, a.name], [b.id, b.name]]);
    const after = effects.map(e => EFFECT_TEXT[e.kind](names[e.by], names[e.on] ?? '')).join(' ');
    return {
        key,
        name: combo.name,
        say: combo.say,
        order: [first.id, second.id],
        effects,
        describe: `Pegáis los dos con ventaja: primero ${first.name}, luego ${second.name}. ${after}`,
    };
}

/** Lo que deja cada papel, en llano. */
const EFFECT_TEXT = {
    cubrir: (/** @type {string} */ by, /** @type {string} */ on) => `${by} se queda cubriendo a ${on}: hasta su próximo turno, le pegan con desventaja.`,
    despistar: (/** @type {string} */ by) => `${by} le despista: en su próximo turno pega con desventaja.`,
    vendido: (/** @type {string} */ by) => `${by} le deja vendido: el siguiente golpe de los vuestros va con ventaja.`,
    frenar: (/** @type {string} */ by) => `${by} le frena con un hechizo: se mueve 10 pies menos.`,
    bendecir: (/** @type {string} */ by, /** @type {string} */ on) => `${by} bendice a ${on}: dos rondas pegando con ventaja.`,
};

/**
 * El vínculo de una pareja: si uno eres tú, el del otro contigo; si son dos compañeros, el del
 * que menos se fía de ti (el vínculo es contigo, y por ti se fían el uno del otro).
 *
 * @param {{id: any, rank?: number}} a
 * @param {{id: any, rank?: number}} b
 * @param {string} heroId
 * @returns {number}
 */
export function pairRank(a, b, heroId) {
    const rank = (/** @type {any} */ who) => Math.max(0, Math.floor(Number(who?.rank) || 0));
    if (String(a?.id) === String(heroId)) return rank(b);
    if (String(b?.id) === String(heroId)) return rank(a);
    return Math.min(rank(a), rank(b));
}

/**
 * @typedef {Object} PairFighter
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} hp
 * @property {number} rank El rango de vínculo con el héroe (el héroe no lo usa).
 * @property {boolean} [reactionUsed]
 * @property {number} [reachFeet] Hasta dónde llega con su arma (sin decirlo, 5: pegado).
 * @property {Role} [role] Su papel (`roleOf`); sin decirlo, delante.
 */

/**
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {boolean}
 */
function reaches(a, b) {
    const feet = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * 5;
    return feet <= Math.max(5, Number(/** @type {any} */ (a).reachFeet) || 5);
}

/**
 * @typedef {Object} PairOption
 * @property {string} partnerId Quien se suma.
 * @property {string} partnerName
 * @property {string} companionId El que habla al saltar: quien se suma, salvo que seas tú.
 * @property {string} enemyId
 * @property {string} enemyName
 * @property {PairCombo} combo La jugada de esos dos, por sus papeles.
 */

/**
 * Con quién puede hacer una jugada en pareja quien tiene el turno, y contra quién.
 *
 * E3.2: cualquier pareja del grupo con vínculo 3 (`pairRank`): tú con un compañero, o dos
 * compañeros entre ellos. Los dos tienen que llegar al enemigo con su arma (`reachFeet`; sin
 * decirlo, pegados), y quien se suma tiene que tener la reacción.
 *
 * @param {Object} input
 * @param {PairFighter} input.actor
 * @param {string} input.heroId
 * @param {PairFighter[]} input.party
 * @param {Array<{id: string, name: string, x: number, y: number, hp: number}>} input.enemies
 * @param {boolean} [input.withHero] Si vale sumarte a ti (el juego, llevando a un compañero, no
 *   gasta tu reacción sin preguntarte).
 * @returns {PairOption[]}
 */
export function pairOptions({ actor, heroId, party, enemies, withHero = true }) {
    if (!actor || (Number(actor.hp) || 0) <= 0) return [];
    const partners = (Array.isArray(party) ? party : []).filter(p => String(p.id) !== String(actor.id)
        && (Number(p.hp) || 0) > 0 && !p.reactionUsed
        && (withHero || String(p.id) !== String(heroId))
        && pairRank(actor, p, heroId) >= PAIR_RANK);
    /** @type {PairOption[]} */
    const out = [];
    for (const enemy of Array.isArray(enemies) ? enemies : []) {
        if ((Number(enemy.hp) || 0) <= 0 || !reaches(actor, enemy)) continue;
        for (const partner of partners) {
            if (!reaches(partner, enemy)) continue;
            const speaker = String(partner.id) === String(heroId) ? actor : partner;
            out.push({
                partnerId: String(partner.id), partnerName: String(partner.name), companionId: String(speaker.id),
                enemyId: String(enemy.id), enemyName: String(enemy.name), combo: pairCombo(actor, partner),
            });
        }
    }
    return out;
}

/**
 * La línea que abre la jugada.
 *
 * @param {string} actorName
 * @param {string} partnerName
 * @param {string} enemyName
 * @param {string} [comboName] El nombre de la jugada, como Muro de escudos.
 * @returns {string}
 */
export function pairLine(actorName, partnerName, enemyName, comboName = '') {
    if (comboName) return `🤝 ${comboName}: ${actorName} y ${partnerName} van a una contra ${enemyName}, los dos con ventaja.`;
    return `🤝 ${actorName} y ${partnerName} van a una contra ${enemyName}: los dos atacan con ventaja.`;
}
