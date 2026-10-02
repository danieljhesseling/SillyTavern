/**
 * La IA juega con las reglas de 2024 (tanda 12, wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * Quien juega ya tiene las opciones de 2024 en su barra (las maestrías de armas, agarrar y
 * empujar, Esquivar, Ocultarse, Ayudar, Destrabarse, la poción como acción adicional, lanzar a
 * más nivel). Aquí está lo que hace que **los enemigos y los compañeros que lleva el juego** las
 * usen con cabeza, y no solo «acercarse y pegar»:
 *
 * - **El arma de cada enemigo**, de su ficha (`weapon`) o de lo que dice de él su descripción
 *   («empuña una horca oxidada», «usa dagas»), con su maestría: el de la maza debilita, el del
 *   hacha derriba, el de las dos dagas pega también con la otra mano.
 * - **Lo que hace en vez de pegar**, cuando le sale mejor: empujar al que está al borde de un
 *   desnivel, del agua honda o de algo que quema; agarrar al que lanza conjuros o dispara para
 *   que no se escape; abrirle la guardia a un compañero que pega mucho más fuerte; tirar al
 *   suelo al que tienen rodeado; ocultarse si no llega a nadie y hay dónde.
 * - **Lo que hace antes de moverse**: beberse una poción si va malherido y la lleva;
 *   cubrirse si está acorralado y malherido; destrabarse si irse le costaría un golpe.
 * - **El espacio de conjuro** con el que lanza: uno mayor si el conjuro crece con él y ese
 *   espacio no lo guarda para otro.
 *
 * Todo es puro y legible a propósito, como `enemy-ai.js`: quien juega tiene que poder prever
 * lo que hará el enemigo. Cada decisión trae su frase (`reason`) para el registro.
 *
 * Puro: decide y no toca nada. Quien llama tira los dados y lo apunta.
 */

import { masteryOf, isLightWeapon, isRangedWeapon, MASTERIES } from '../rules/weapon-mastery.js';
import { healingPotionOf } from '../rules/actions-2024.js';
import { proficiencyBonus } from '../rules/checks.js';
import { upcastSteps, upcastSpell } from '../rules/spell-cast.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
const feet = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;

/** @param {{hp?: number, maxHp?: number}} c */
const fraction = (c) => {
    const max = Number(c?.maxHp) || 0;
    if (max <= 0) return 1;
    return Math.max(0, Math.min(1, (Number(c?.hp) || 0) / max));
};

/** @param {any} score */
const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/**
 * Una palabra entera (sin trozos de otra: «lanza» no es «se lanza a», «maza» no es «amenaza»).
 *
 * @param {string} source
 * @returns {RegExp}
 */
const word = (source) => new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, 'giu');

/**
 * Las armas que se reconocen en lo que dice un enemigo, de lo más concreto a lo más suelto.
 * `name` es el del compendio (de ahí salen su maestría y si es ligera, con `masteryOf`); `hands`,
 * las manos que pide. El látigo no está en el compendio: su maestría (Ralentizar) va aquí.
 *
 * @type {Array<{match: RegExp, name: string, hands?: number, mastery?: import('../rules/weapon-mastery.js').MasteryId}>}
 */
export const ENEMY_WEAPONS = [
    { match: word('ballestas? de mano'), name: 'ballesta de mano' },
    { match: word('ballestas?(?: pesadas?)?|ballester[oa]s?'), name: 'ballesta', hands: 2 },
    { match: word('arcos? largos?'), name: 'arco largo', hands: 2 },
    { match: word('arcos?(?: cortos?)?|arquer[oa]s?'), name: 'arco corto', hands: 2 },
    { match: word('jabalinas?'), name: 'jabalina' },
    { match: word('espad[oó]n(?:es)?|mandobles?'), name: 'espadón', hands: 2 },
    { match: word('espadas? cortas?'), name: 'espada corta' },
    { match: word('espadas? roperas?|roperas?|estoques?'), name: 'estoque' },
    { match: word('cimitarras?'), name: 'cimitarra' },
    { match: word('dagas?|pu[ñn]al(?:es)?|cuchill(?:o|a)s?'), name: 'daga' },
    { match: word('hachas? (?:a|de) dos manos|gran(?:des)? hachas?'), name: 'hacha a dos manos', hands: 2 },
    { match: word('hachas? de mano|hachuelas?'), name: 'hacha de mano' },
    { match: word('hachas?|segur(?:es)?'), name: 'hacha' },
    { match: word('alabardas?|alabarder[oa]s?'), name: 'alabarda', hands: 2 },
    { match: word('gujas?|guada[ñn]as?'), name: 'guja', hands: 2 },
    { match: word('picas?|piquer[oa]s?'), name: 'pica', hands: 2 },
    { match: word('tridentes?|horcas?|bieldos?'), name: 'tridente' },
    { match: word('lanzas|lancer[oa]s?|(?:una|la|su|sus|con|de|y) lanza'), name: 'lanza' },
    { match: word('mazos?'), name: 'mazo', hands: 2 },
    { match: word('mazas?|lucero del alba|manguales?'), name: 'maza' },
    { match: word('martillos?(?: de guerra)?'), name: 'martillo de guerra' },
    { match: word('mayales?'), name: 'mayal' },
    { match: word('l[aá]tigos?'), name: 'látigo', mastery: 'slow' },
    { match: word('porras?|garrotes?|cachiporras?'), name: 'porra' },
    { match: word('bast[oó]n(?:es)?|b[aá]culos?|cayados?'), name: 'bastón' },
    { match: word('espadas? largas?|espadas?|sables?'), name: 'espada larga' },
];

/**
 * @typedef {Object} EnemyWeapon
 * @property {string} name     El arma, como la nombra el compendio («maza», «daga»).
 * @property {import('../rules/weapon-mastery.js').MasteryId|''} mastery
 * @property {string} masteryLabel Su maestría en castellano («Debilitar»), o vacío.
 * @property {boolean} light
 * @property {boolean} ranged
 * @property {number} hands
 * @property {{name: string, mastery: import('../rules/weapon-mastery.js').MasteryId|''}|null} offHand
 *   La de la otra mano, si lleva dos ligeras (dos dagas, espada corta y daga): pega con ella también.
 */

/**
 * Las armas que nombra un texto, en el orden en que salen, sin contar dos veces el mismo trozo
 * («espada ropera» no es además «espada»).
 *
 * @param {string} said
 * @returns {Array<{at: number, name: string, hands: number, plural: boolean, mastery: string}>}
 */
export function weaponsIn(said) {
    const source = text(said);
    /** @type {Array<{at: number, end: number, name: string, hands: number, plural: boolean, mastery: string}>} */
    const found = [];
    for (const weapon of ENEMY_WEAPONS) {
        weapon.match.lastIndex = 0;
        for (const hit of source.matchAll(weapon.match)) {
            const at = Number(hit.index) || 0;
            const end = at + hit[0].length;
            if (found.some(f => at < f.end && end > f.at)) continue;
            // «dagas», «dos cuchillos»: una en cada mano.
            const plural = /s$/i.test(hit[0].trim().split(/\s+/)[0]) || /(?<!\p{L})dos\s+$/iu.test(source.slice(Math.max(0, at - 5), at));
            found.push({ at, end, name: weapon.name, hands: weapon.hands ?? 1, plural, mastery: weapon.mastery ?? '' });
        }
    }
    return found.sort((a, b) => a.at - b.at).map(({ at, name, hands, plural, mastery }) => ({ at, name, hands, plural, mastery }));
}

/**
 * El arma con la que pega un enemigo: la de su ficha (`weapon`) si la dice, o la primera que
 * nombre su nombre o su descripción **que vaya con su forma de pegar** (un tirador, la de
 * disparar; uno de cuerpo a cuerpo, la de cerca). Sin arma reconocible (un lobo, un zombi, un
 * enjambre), `null`: pega como siempre, sin maestría.
 *
 * @param {{weapon?: any, name?: string, description?: string, attackRangeFeet?: number, range?: number}} source
 *   La plantilla del bestiario, o el enemigo con lo de su plantilla.
 * @returns {EnemyWeapon|null}
 */
export function enemyWeapon(source) {
    if (!source) return null;
    const reach = Number(source.attackRangeFeet ?? source.range) || 5;
    const wantsRanged = reach > 10;
    const own = typeof source.weapon === 'object' && source.weapon ? text(source.weapon.name) : text(source.weapon);
    const listed = own ? weaponsIn(own) : weaponsIn(`${text(source.name)}. ${text(source.description)}`);
    // Un arma escrita a mano que no está en la tabla: la del compendio por su nombre, tal cual.
    if (own && listed.length === 0) {
        const mastery = masteryOf({ name: own, mastery: source.weapon?.mastery });
        return mastery ? describe({ name: own.toLowerCase(), hands: 1, plural: false, mastery }, null) : null;
    }
    const fits = listed.filter(w => isRangedWeapon({ name: w.name }) === wantsRanged);
    const main = fits[0];
    if (!main) return null;
    const light = isLightWeapon({ name: main.name });
    // La otra mano: la misma, si lleva dos; o la siguiente ligera que nombre.
    const second = main.plural && light ? main : listed.find(w => w !== main && isLightWeapon({ name: w.name }) && !isRangedWeapon({ name: w.name }));
    const offHand = light && !wantsRanged && main.hands < 2 && second ? second : null;
    return describe(main, offHand);
}

/**
 * @param {{name: string, hands: number, plural: boolean, mastery: string}} main
 * @param {{name: string, mastery: string}|null} offHand
 * @returns {EnemyWeapon}
 */
function describe(main, offHand) {
    const mastery = /** @type {import('../rules/weapon-mastery.js').MasteryId|''} */ (main.mastery || masteryOf({ name: main.name }));
    return {
        name: main.name,
        mastery,
        masteryLabel: mastery ? MASTERIES[mastery].label : '',
        light: isLightWeapon({ name: main.name }),
        ranged: isRangedWeapon({ name: main.name }),
        hands: main.hands,
        offHand: offHand
            ? { name: offHand.name, mastery: /** @type {import('../rules/weapon-mastery.js').MasteryId|''} */ (offHand.mastery || masteryOf({ name: offHand.name })) }
            : null,
    };
}

/**
 * La competencia de un enemigo, de su desafío (5e: +2 hasta el 4, +3 hasta el 8…).
 *
 * @param {number} cr
 * @returns {number}
 */
export function proficiencyFromCr(cr) {
    return proficiencyBonus(Math.max(1, Math.ceil(Number(cr) || 0)));
}

/**
 * La CD de lo que obliga a salvar un enemigo (agarrar, empujar, Derribar): 8 + su mejor
 * característica de pegar + su competencia.
 *
 * @param {{strength?: number, dexterity?: number, cr?: number}} enemy
 * @param {'strength'|'best'} [using] Agarrar y empujar van con la Fuerza; Derribar, con la que pega.
 * @returns {number}
 */
export function enemySaveDC(enemy, using = 'best') {
    const strength = mod(enemy?.strength);
    const best = Math.max(strength, mod(enemy?.dexterity));
    return 8 + (using === 'strength' ? strength : best) + proficiencyFromCr(Number(enemy?.cr) || 0);
}

/**
 * La probabilidad de fallar una salvación de d20 + `modifier` contra `dc` (el empate salva).
 *
 * @param {number} dc
 * @param {number} modifier
 * @returns {number} De 0,05 a 0,95: un 1 siempre puede pasar, un 20 siempre puede salvar.
 */
export function failChance(dc, modifier) {
    const needed = Number(dc) - Number(modifier);
    const fails = (needed - 1) / 20;
    return Math.max(0.05, Math.min(0.95, fails));
}

/**
 * Las pociones de curar que le quedan a un enemigo: las de su ficha (`potions`, un número, o
 * `items`), menos las que ya se ha bebido en esta pelea (`potionsUsed`).
 *
 * @param {{potions?: any, items?: any[]}} template
 * @param {{potionsUsed?: number}} [enemy]
 * @returns {{count: number, heal: string, name: string}}
 */
export function enemyPotions(template, enemy = {}) {
    const fromItems = (Array.isArray(template?.items) ? template.items : [])
        .map(item => ({ heal: healingPotionOf(item), name: text(item?.name), qty: Math.max(1, Math.floor(Number(item?.quantity) || 1)) }))
        .filter(p => p.heal);
    const counted = Math.max(0, Math.floor(Number(template?.potions) || 0));
    const total = counted + fromItems.reduce((sum, p) => sum + p.qty, 0);
    const count = Math.max(0, total - Math.max(0, Math.floor(Number(enemy?.potionsUsed) || 0)));
    return {
        count,
        heal: fromItems[0]?.heal || '2d4+2',
        name: fromItems[0]?.name || 'Poción de curación',
    };
}

// ---------------------------------------------------------------- lo que decide un enemigo

/**
 * @typedef {Object} Body Alguien en el tablero, con lo que la IA necesita mirar.
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} [reachFeet] Hasta dónde pega.
 * @property {number} [avgDamage] Lo que hace de media su golpe.
 * @property {boolean} [caster] Si lanza conjuros (o dispara): lo que un bruto quiere sujetar.
 * @property {string[]} [conditions]
 * @property {number} [saveMod] Su mejor salvación de Fuerza o Destreza (contra agarrar y empujar).
 * @property {boolean} [boss]
 * @property {boolean} [laterThisRound] Si aún le toca en esta ronda (lo del suelo le sirve).
 * @property {boolean} [helped] Si ya le han abierto la guardia.
 */

/**
 * @typedef {Object} Ground Lo que hay en el tablero, preguntado por casilla.
 * @property {(x: number, y: number) => boolean} isFree Se puede pisar y no hay nadie.
 * @property {(from: {x: number, y: number}, to: {x: number, y: number}) => number} [drop]
 *   Cuántos pies se cae al pasar de una a otra (negativo si se sube). Lo alto (`high`) son 10.
 * @property {(x: number, y: number) => boolean} [isDeepWater]
 * @property {(x: number, y: number) => boolean} [isHazard] Fuego, una trampa armada.
 * @property {(x: number, y: number) => boolean} [isChasm] El vacío: quien cae dentro, se acabó.
 */

/**
 * @typedef {Object} Choice2024
 * @property {'shove'|'grapple'|'help'|'hide'|'dodge'|'disengage'|'potion'} kind
 * @property {string} [targetId]
 * @property {string} [friendId] A quién le abre la guardia (Ayudar).
 * @property {'ledge'|'water'|'hazard'|'prone'} [why] Por qué empuja.
 * @property {{x: number, y: number}} [to] A dónde va a parar el empujado.
 * @property {string} reason Una frase para el registro.
 */

/** Lo que cuenta como caer de un desnivel: diez pies o más. */
export const LEDGE_FEET = 10;

/**
 * A dónde va a parar alguien al que apartan `cells` casillas en línea recta desde `from`, y qué
 * se encuentra: un desnivel por el que cae (ahí se para), el agua honda (se cae dentro desde la
 * orilla y sale por donde cayó), o algo que quema o una trampa (ahí se para, encima). Lo que no
 * se pisa, o subir un risco, le para antes.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.from Quien empuja.
 * @param {{x: number, y: number}} input.target El empujado.
 * @param {number} input.cells 5 pies = 1.
 * @param {Ground} input.ground
 * @returns {{to: {x: number, y: number}, moved: number, why: 'ledge'|'water'|'hazard'|'chasm'|'', dropFeet: number}}
 */
export function pushTrail({ from, target, cells, ground }) {
    const dx = Math.sign(target.x - from.x);
    const dy = Math.sign(target.y - from.y);
    let at = { x: target.x, y: target.y };
    if (dx === 0 && dy === 0) return { to: at, moved: 0, why: '', dropFeet: 0 };
    let moved = 0;
    for (let step = 0; step < Math.max(0, Math.floor(Number(cells) || 0)); step++) {
        const next = { x: at.x + dx, y: at.y + dy };
        if (ground.isChasm?.(next.x, next.y)) return { to: next, moved: moved + 1, why: 'chasm', dropFeet: 0 };
        if (ground.isDeepWater?.(next.x, next.y)) return { to: at, moved, why: 'water', dropFeet: 0 };
        const drop = Number(ground.drop?.(at, next)) || 0;
        if (!ground.isFree(next.x, next.y) || drop <= -LEDGE_FEET) break;
        at = next;
        moved++;
        if (drop >= LEDGE_FEET) return { to: at, moved, why: 'ledge', dropFeet: drop };
        if (ground.isHazard?.(at.x, at.y)) return { to: at, moved, why: 'hazard', dropFeet: 0 };
    }
    return { to: at, moved, why: '', dropFeet: 0 };
}

/** Lo que se dice de cada empujón, para el registro. */
const SHOVE_WHY = {
    ledge: 'Lo tiene al borde del desnivel: le empuja abajo.',
    water: 'Lo tiene al borde del agua honda: le empuja dentro.',
    hazard: 'Le empuja contra lo que quema.',
    prone: 'Lo tienen rodeado: lo tira al suelo para que los suyos le peguen mejor.',
};

/**
 * Lo que hace un enemigo **en vez de su golpe**, si algo le sale mejor; `null` si pega.
 *
 * Por orden: empujar al borde (un desnivel, el agua honda, algo que quema), agarrar al que lanza
 * o dispara, abrirle la guardia a quien pega mucho más fuerte, tirar al suelo al que tienen
 * rodeado, y ocultarse si no llega a nadie y hay dónde.
 *
 * @param {Object} input
 * @param {Body & {profile?: string, role?: string, str?: number, dex?: number, cr?: number, freeHand?: boolean, grappling?: string, grabbed?: string[], hidden?: boolean}} input.actor
 *   Donde queda **después** de moverse. `grabbed`: a quién ha intentado agarrar ya en esta pelea.
 * @param {boolean} input.canAttack Si su golpe de siempre llega a alguien.
 * @param {Body[]} input.foes
 * @param {Body[]} [input.friends]
 * @param {Ground} input.ground
 * @param {{canHide?: boolean, dim?: boolean}} [input.sight]
 * @returns {Choice2024|null}
 */
export function chooseEnemyAction2024({ actor, canAttack, foes, friends = [], ground, sight = {} }) {
    const here = { x: actor.x, y: actor.y };
    const living = (foes || []).filter(f => f && f.hp > 0);
    const reach = Math.max(5, Number(actor.reachFeet) || 5);
    const melee = reach <= 10;
    const adjacent = living.filter(f => feet(here.x, here.y, f.x, f.y) <= 5);
    const brute = melee && (mod(actor.str) >= mod(actor.dex) || ['bruto', 'tanque', 'lider'].includes(text(actor.role)));
    const dc = enemySaveDC({ strength: actor.str, dexterity: actor.dex, cr: actor.cr }, 'strength');

    // 1. Empujar al borde: es lo que más cambia una pelea, y solo se puede donde el tablero lo deja.
    if (brute && adjacent.length > 0) {
        const edge = adjacent
            .map(f => ({ foe: f, land: pushTrail({ from: here, target: f, cells: 1, ground }), odds: failChance(dc, Number(f.saveMod) || 0) }))
            .filter(o => o.land.why && o.odds >= 0.25 && !(o.foe.conditions || []).includes('Prone'))
            // Lo que más duele primero (el agua honda saca de la pelea un rato), y el que mejor cae.
            .sort((a, b) => ['water', 'ledge', 'hazard'].indexOf(a.land.why) - ['water', 'ledge', 'hazard'].indexOf(b.land.why) || b.odds - a.odds)[0];
        if (edge) {
            const why = /** @type {'ledge'|'water'|'hazard'} */ (edge.land.why);
            return { kind: 'shove', targetId: edge.foe.id, why, to: edge.land.to, reason: SHOVE_WHY[why] };
        }
    }

    // 2. Agarrar al que lanza o dispara, para que no se le escape. Con una mano libre, y sin
    // gastarlo en quien ya está casi en el suelo (a ese, mejor pegarle). Una vez a cada uno por
    // pelea: si se le suelta, ya le pega (agarrar cada ronda alargaba la pelea sin hacer daño).
    const tried = new Set((actor.grabbed || []).map(String));
    if (brute && actor.freeHand !== false && !actor.grappling) {
        const hold = adjacent
            .filter(f => f.caster && fraction(f) >= 0.5 && !tried.has(String(f.id)) && !(f.conditions || []).some(c => /grappled|restrained/i.test(c)))
            .map(f => ({ foe: f, odds: failChance(dc, Number(f.saveMod) || 0) }))
            .filter(o => o.odds >= 0.3)
            .sort((a, b) => b.odds - a.odds || String(a.foe.id).localeCompare(String(b.foe.id)))[0];
        if (hold && living.length > 1) {
            return { kind: 'grapple', targetId: hold.foe.id, reason: 'Agarra al que lanza conjuros para que no se le escape.' };
        }
    }

    // 3. Ayudar: si al lado tiene a uno de los suyos que pega el triple que él, le abre la guardia
    // (la ventaja le sube un cuarto lo que acierta: con menos, rinde más su propio golpe).
    const mine = Number(actor.avgDamage) || 0;
    if (adjacent.length > 0 && mine > 0) {
        const assist = adjacent
            .filter(f => !f.helped)
            .flatMap(f => (friends || [])
                .filter(a => a && a.hp > 0 && a.id !== actor.id && feet(a.x, a.y, f.x, f.y) <= Math.max(5, Number(a.reachFeet) || 5))
                .filter(a => (Number(a.avgDamage) || 0) >= 3 * mine)
                .map(a => ({ foe: f, friend: a })))
            .sort((a, b) => (Number(b.friend.avgDamage) || 0) - (Number(a.friend.avgDamage) || 0) || String(a.foe.id).localeCompare(String(b.foe.id)))[0];
        if (assist) {
            return { kind: 'help', targetId: assist.foe.id, friendId: assist.friend.id, reason: 'Le abre la guardia a quien pega más fuerte.' };
        }
    }

    // 4. Tirar al suelo al que tienen rodeado: si dos de los suyos más le pegan de cerca después.
    if (brute && adjacent.length > 0) {
        const surrounded = adjacent
            .filter(f => !(f.conditions || []).includes('Prone'))
            .map(f => ({
                foe: f,
                helpers: (friends || []).filter(a => a && a.hp > 0 && a.id !== actor.id && a.laterThisRound
                    && feet(a.x, a.y, f.x, f.y) <= 5).length,
                odds: failChance(dc, Number(f.saveMod) || 0),
            }))
            .filter(o => o.helpers >= 2 && o.odds >= 0.35)
            .sort((a, b) => b.helpers - a.helpers || b.odds - a.odds)[0];
        if (surrounded) return { kind: 'shove', targetId: surrounded.foe.id, why: 'prone', reason: SHOVE_WHY.prone };
    }

    // 5. Ocultarse: quien pega de lejos y no llega a nadie este turno, si hay dónde (algo que le
    // tape o poca luz). El siguiente disparo, con ventaja.
    if (!canAttack && !actor.hidden && (reach > 10 || text(actor.profile) === 'skirmisher') && (sight.canHide || sight.dim)) {
        return { kind: 'hide', reason: sight.dim ? 'No llega a nadie: se pierde en la penumbra.' : 'No llega a nadie: se esconde detrás de algo.' };
    }

    return null;
}

/**
 * Lo que hace un enemigo **antes de moverse**: beberse una poción (acción adicional), cubrirse
 * si está acorralado y malherido, o destrabarse si irse le costaría un golpe.
 *
 * @param {Object} input
 * @param {Body & {profile?: string, role?: string, potions?: number, dodged?: boolean}} input.actor
 *   `dodged`: si ya se ha cubierto una vez en esta pelea.
 * @param {{action: string, movementCostFeet: number, rationale?: string}} input.plan Lo que iba a hacer (`planEnemyTurn`).
 * @param {Body[]} input.foes
 * @param {Body[]} [input.friends]
 * @param {Body[]} [input.provokes] Quién le daría un golpe si se va (`findOpportunityAttacks`).
 * @returns {{potion: Choice2024|null, before: Choice2024|null}}
 */
export function chooseEnemyBefore2024({ actor, plan, foes, friends = [], provokes = [] }) {
    const living = (foes || []).filter(f => f && f.hp > 0);
    const hurt = fraction(actor);

    // La poción: malherido (menos de la mitad) y con una encima. Es la acción adicional: después
    // hace su turno igual.
    const potion = hurt < 0.5 && actor.hp > 0 && (Number(actor.potions) || 0) > 0
        ? { kind: /** @type {const} */ ('potion'), reason: 'Va malherido: se bebe una poción.' }
        : null;
    // Lo que cura la poción cambia lo demás: con ella, ya no está tan mal.
    const after = potion ? Math.min(1, hurt + 0.2) : hurt;

    const adjacent = living.filter(f => feet(actor.x, actor.y, f.x, f.y) <= 5);
    const standing = (friends || []).filter(a => a && a.hp > 0 && a.id !== actor.id).length;
    const stays = !(Number(plan?.movementCostFeet) > 0);

    // Cubrirse: malherido, acorralado (dos encima, o sin a dónde irse) y con los suyos aún en pie,
    // que vienen a ayudar. El jefe y el bruto no se cubren: pelean hasta el final. Una vez por
    // pelea: cubrirse cada ronda mientras otro le curaba dejaba la pelea sin acabar.
    const cornered = adjacent.length >= 2 || (adjacent.length >= 1 && stays && plan?.action !== 'attack');
    if (after < 0.3 && cornered && standing > 0 && !actor.boss && text(actor.role) !== 'bruto' && !actor.dodged) {
        return { potion, before: { kind: 'dodge', reason: 'Acorralado y malherido: se cubre y espera a los suyos.' } };
    }

    // Destrabarse: si irse le costaría un golpe. Si no iba a pegar, es gratis; si iba a pegar,
    // solo cuando los golpes que se llevaría le pueden tumbar.
    const threats = (provokes || []).filter(Boolean);
    if (!stays && threats.length > 0) {
        const risk = threats.reduce((sum, t) => sum + (Number(t.avgDamage) || 5) * 0.65, 0);
        if (plan?.action !== 'attack' || risk >= actor.hp * 0.5) {
            return {
                potion,
                before: {
                    kind: 'disengage',
                    reason: plan?.action !== 'attack' ? 'Se destraba para irse sin llevarse un golpe.' : 'Irse le costaría caro: se destraba y se aparta.',
                },
            };
        }
    }
    return { potion, before: null };
}

// ---------------------------------------------------------------- el espacio de conjuro

/**
 * J19.3 para los enemigos: con qué espacio lanza un conjuro. El más bajo que sirva, salvo que
 * le compense uno mayor:
 *
 * - el conjuro crece con el espacio (más dados, más dardos, más objetivos);
 * - ese espacio mayor no lo guarda para otro conjuro suyo de ese nivel;
 * - y lo de más no se tira: si con el más bajo ya tumba al objetivo, no gasta más.
 *
 * @param {Object} input
 * @param {any} input.spell El conjuro, normalizado (`normalizeSpell`).
 * @param {Record<number, number>} input.left Los espacios que le quedan, por nivel.
 * @param {number[]} [input.reservedLevels] Los niveles de sus otros conjuros preparados.
 * @param {number} [input.targetHp] La vida que le queda al objetivo, si es uno.
 * @param {(formula: string) => number} [input.average]
 * @returns {{slotLevel: number, upcast: boolean, detail: string}} `detail`: lo que gana, en palabras.
 */
export function chooseEnemySlot({ spell, left, reservedLevels = [], targetHp = 0, average = (f) => Number(f) || 0 }) {
    const base = Math.max(1, Number(spell?.level) || 1);
    const open = Object.entries(left || {})
        .map(([level, count]) => ({ level: Number(level), count: Number(count) || 0 }))
        .filter(s => s.level >= base && s.count > 0)
        .sort((a, b) => a.level - b.level);
    if (open.length === 0) return { slotLevel: 0, upcast: false, detail: '' };
    const lowest = open[0].level;
    if (!spell || Number(spell.level) === 0) return { slotLevel: lowest, upcast: false, detail: '' };
    const reserved = new Set((reservedLevels || []).map(Number));
    const grows = (/** @type {number} */ level) => upcastSteps(spell, level) > 0;
    const free = open.filter(s => s.level > lowest && grows(s.level) && !reserved.has(s.level));
    if (free.length === 0) return { slotLevel: lowest, upcast: false, detail: '' };
    // Si con el más bajo ya basta para tumbarlo, no gasta más.
    const low = upcastSpell(spell, lowest);
    const lowDamage = average(low.damage) * Math.max(1, Number(low.rays) || 1);
    if (targetHp > 0 && lowDamage > 0 && lowDamage >= targetHp) return { slotLevel: lowest, upcast: false, detail: '' };
    const best = free[free.length - 1].level;
    const up = upcastSpell(spell, best);
    const detail = up.rays > low.rays ? `${up.rays} dardos en vez de ${low.rays}`
        : up.targets > low.targets ? `${up.targets} objetivos en vez de ${low.targets}`
            : up.damage && up.damage !== low.damage ? `${up.damage} de daño en vez de ${low.damage}`
                : up.healing && up.healing !== low.healing ? `cura ${up.healing} en vez de ${low.healing}` : 'más fuerza';
    return { slotLevel: best, upcast: true, detail };
}

// ---------------------------------------------------------------- lo que dice el registro

/**
 * La frase de una maestría de enemigo que ha saltado, en palabras de quien lo recibe.
 *
 * @param {import('../rules/weapon-mastery.js').MasteryId} mastery
 * @param {{who: string, at: string, weapon: string}} names
 * @returns {string}
 */
export function masteryLine(mastery, { who, at, weapon }) {
    const label = MASTERIES[mastery]?.label ?? mastery;
    switch (mastery) {
        case 'vex': return `🎯 ${label} (${weapon}): ${who} le tiene medido; su próximo golpe contra ${at}, con ventaja.`;
        case 'sap': return `💢 ${label} (${weapon}): el golpe le pesa a ${at}; su próximo ataque, con desventaja.`;
        case 'slow': return `🐢 ${label} (${weapon}): ${at} anda 10 pies menos hasta la próxima ronda.`;
        case 'topple': return `🪓 ${label} (${weapon}): ${who} intenta tirar al suelo a ${at}.`;
        case 'push': return `💨 ${label} (${weapon}): ${who} aparta a ${at} de un golpe.`;
        case 'graze': return `🪶 ${label} (${weapon}): falla, pero el filo le roza.`;
        case 'cleave': return `🪓 ${label} (${weapon}): el tajo sigue hasta otro.`;
        default: return `⚔️ ${label} (${weapon}).`;
    }
}
