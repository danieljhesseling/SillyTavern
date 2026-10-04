/**
 * Las maestrías de armas de D&D 2024 (tanda 10, wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 *
 * Cada arma trae una: la espada corta molesta, el hacha derriba, la maza debilita, el arco largo
 * ralentiza… Es lo que hace que elegir arma sea una decisión táctica y no solo un dado más
 * grande. La usan las clases que la tienen en 2024 (guerrero, bárbaro, paladín, explorador y
 * pícaro, y aquí también el soldado); el resto pega con el arma igual, sin su truco.
 *
 * Los nombres van en castellano, como los dice el manual en su traducción: Molestar (Vex),
 * Derribar (Topple), Debilitar (Sap), Ralentizar (Slow), Empujar (Push), Rozar (Graze), Hender
 * (Cleave) y Mellar (Nick).
 *
 * Aquí también vive lo que el turno de 2024 tiene que recordar entre una acción y otra
 * (`tactics` en el encuentro): a quién molestaste, si ya cambiaste de arma, con qué arma ligera
 * atacaste (para el golpe con la otra mano), si ya hendiste o mellaste este turno.
 *
 * Puro: decide y no toca nada. Quien llama guarda el estado en el combate y lo cuenta.
 */

import { proficiencyBonus } from './checks.js';

/**
 * @typedef {'vex'|'topple'|'sap'|'slow'|'push'|'graze'|'cleave'|'nick'} MasteryId
 */

/**
 * Las ocho, con lo que se lee en la tarjeta del arma.
 *
 * @type {Record<MasteryId, {label: string, short: string, icon: string}>}
 */
export const MASTERIES = {
    vex: { label: 'Molestar', short: 'Si le das, tu siguiente ataque contra él va con ventaja.', icon: 'fa-bullseye' },
    topple: { label: 'Derribar', short: 'Si le das, salva con Constitución o cae al suelo.', icon: 'fa-person-falling' },
    sap: { label: 'Debilitar', short: 'Si le das, su siguiente ataque va con desventaja.', icon: 'fa-heart-crack' },
    slow: { label: 'Ralentizar', short: 'Si le das, anda 10 pies menos hasta tu próximo turno.', icon: 'fa-snowflake' },
    push: { label: 'Empujar', short: 'Si le das, lo apartas hasta 10 pies de ti.', icon: 'fa-arrows-left-right' },
    graze: { label: 'Rozar', short: 'Si fallas, le haces igual tu modificador de daño.', icon: 'fa-feather' },
    cleave: { label: 'Hender', short: 'Si le das, golpeas también a otro pegado a él, sin sumar tu modificador.', icon: 'fa-burst' },
    nick: { label: 'Mellar', short: 'El golpe con la otra mano no gasta tu acción adicional.', icon: 'fa-scissors' },
};

/** Las ids válidas, para leer lo que venga de un archivo. */
export const MASTERY_IDS = /** @type {MasteryId[]} */ (Object.keys(MASTERIES));

/**
 * La maestría de cada forma de `public/compendio/armas.json`, la de su arma de 2024. El archivo
 * la lleva también (`mastery`); esta tabla es para lo forjado, que guarda de qué forma salió
 * (`from.forma`) pero no sus campos, y para el kit de salida (`kitForm`).
 *
 * @type {Record<string, MasteryId>}
 */
export const FORM_MASTERY = {
    'forma-daga': 'nick',
    'forma-espada-corta': 'vex',
    'forma-espada-larga': 'sap',
    'forma-hacha': 'topple',
    'forma-maza': 'sap',
    'forma-martillo': 'push',
    'forma-lanza': 'sap',
    'forma-alabarda': 'cleave',
    'forma-baston': 'topple',
    'forma-arco-corto': 'vex',
    'forma-arco-largo': 'slow',
    'forma-ballesta': 'slow',
    'forma-estoque': 'vex',
    'forma-cimitarra': 'nick',
    'forma-espadon': 'graze',
    'forma-cuchillo-monte': 'nick',
    'forma-hacha-mano': 'vex',
    'forma-hacha-dos-manos': 'cleave',
    'forma-segur': 'topple',
    'forma-porra': 'slow',
    'forma-mayal': 'sap',
    'forma-mazo': 'topple',
    'forma-pica': 'push',
    'forma-tridente': 'topple',
    'forma-guja': 'graze',
    'forma-honda': 'slow',
    'forma-jabalina': 'slow',
    'forma-ballesta-mano': 'vex',
    'forma-arco-compuesto': 'slow',
    'forma-cerbatana': 'vex',
    // Las del SRD que faltaban (ROADMAP_CONTENIDO_DND, sección 4).
    'forma-hoz': 'nick',
    'forma-latigo': 'slow',
    'forma-lucero-alba': 'sap',
    'forma-pico-guerra': 'sap',
    'forma-martillo-ligero': 'nick',
    'forma-gran-clava': 'push',
    'forma-dardo': 'vex',
    'forma-ballesta-pesada': 'push',
};

/**
 * Por el nombre, para lo que no dice de qué forma salió (un arma escrita a mano, una de un
 * paquete, una ficha vieja en inglés). Lo más concreto primero: «hacha de mano» antes que «hacha».
 *
 * @type {Array<[RegExp, MasteryId]>}
 */
const NAME_MASTERY = [
    [/ballesta de mano|hand crossbow/, 'vex'],
    [/ballesta pesada|heavy crossbow/, 'push'],
    [/ballesta|crossbow/, 'slow'],
    [/arco (largo|compuesto)|longbow/, 'slow'],
    [/arco|shortbow|\bbow\b/, 'vex'],
    [/honda|\bsling\b/, 'slow'],
    [/jabalina|javelin/, 'slow'],
    [/cerbatana|blowgun/, 'vex'],
    [/espad[oó]n|mandoble|greatsword/, 'graze'],
    [/espada corta|shortsword/, 'vex'],
    [/espada larga|longsword|espada/, 'sap'],
    [/estoque|rapier/, 'vex'],
    [/cimitarra|scimitar/, 'nick'],
    [/daga|pu[ñn]al|cuchillo|dagger|\bknife\b/, 'nick'],
    [/hacha a dos manos|gran hacha|greataxe/, 'cleave'],
    [/hacha de mano|handaxe/, 'vex'],
    [/martillo ligero|light hammer/, 'nick'],
    [/martillo de guerra|warhammer|martillo/, 'push'],
    [/hacha|segur|battleaxe|\baxe\b/, 'topple'],
    [/mazo|\bmaul\b/, 'topple'],
    [/maza|\bmace\b|lucero del alba|morningstar/, 'sap'],
    [/mayal|flail/, 'sap'],
    [/porra|garrote|\bclub\b/, 'slow'],
    [/bast[oó]n|quarterstaff|\bstaff\b/, 'topple'],
    [/alabarda|halberd/, 'cleave'],
    [/guja|glaive/, 'graze'],
    [/\bpica\b|\bpike\b/, 'push'],
    [/tridente|trident/, 'topple'],
    [/lanza|spear/, 'sap'],
    [/hoz|sickle/, 'nick'],
    [/l[aá]tigo|\bwhip\b/, 'slow'],
    [/pico de guerra|war ?pick/, 'sap'],
    [/gran clava|greatclub/, 'push'],
    [/dardo|\bdarts?\b/, 'vex'],
];

/** Las formas ligeras (`tags: ["ligera"]` en armas.json): las que dejan golpear con la otra mano. */
const LIGHT_FORMS = new Set([
    'forma-daga', 'forma-espada-corta', 'forma-cimitarra', 'forma-cuchillo-monte', 'forma-hacha-mano', 'forma-ballesta-mano',
    'forma-hoz', 'forma-martillo-ligero',
]);

/** Y por el nombre, para lo que no dice su forma. */
const LIGHT_NAMES = /daga|pu[ñn]al|cuchillo|espada corta|cimitarra|hacha de mano|ballesta de mano|martillo ligero|\bhoz\b|dagger|shortsword|scimitar|handaxe|light hammer|sickle/;

/** Lo que se dispara: un arma de distancia, aunque se lleve en una mano. */
const RANGED_NAMES = /arco|ballesta|honda|cerbatana|\bbow\b|crossbow|sling|blowgun/;

/** Las clases con Maestría con armas en 2024 (y el soldado de este juego, que es marcial). */
const MASTERY_CLASSES = /guerrer|b[aá]rbar|palad|explorador|exploradora|montaraz|p[ií]car|ladr[oó]n|soldad|fighter|barbarian|paladin|ranger|rogue|warrior|soldier/;

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/**
 * La forma de la que salió un objeto, si lo dice.
 *
 * @param {any} item
 * @returns {string}
 */
export function formOf(item) {
    return text(item?.from?.forma) || text(item?.kitForm) || text(item?.formId);
}

/**
 * La maestría de un arma: la suya si la trae, la de su fila del compendio, la de su forma o la
 * de su nombre. Vacío si no se sabe (un objeto que no es arma, un arma rara).
 *
 * @param {any} item
 * @param {any} [formRow] Su fila de armas.json, si quien llama la tiene a mano.
 * @returns {MasteryId|''}
 */
export function masteryOf(item, formRow = null) {
    if (!item) return '';
    const own = text(item.mastery).toLowerCase();
    if (MASTERY_IDS.includes(/** @type {MasteryId} */ (own))) return /** @type {MasteryId} */ (own);
    const fromRow = text(formRow?.mastery).toLowerCase();
    if (MASTERY_IDS.includes(/** @type {MasteryId} */ (fromRow))) return /** @type {MasteryId} */ (fromRow);
    const byForm = FORM_MASTERY[formOf(item)];
    if (byForm) return byForm;
    const name = text(item.name).toLowerCase();
    for (const [pattern, mastery] of NAME_MASTERY) if (pattern.test(name)) return mastery;
    return '';
}

/**
 * Si un arma es ligera: la que deja golpear con la otra mano.
 *
 * @param {any} item
 * @param {any} [formRow]
 * @returns {boolean}
 */
export function isLightWeapon(item, formRow = null) {
    if (!item) return false;
    if (item.light === true) return true;
    const tags = [...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(formRow?.tags) ? formRow.tags : [])].map(t => text(t).toLowerCase());
    if (tags.includes('ligera') || tags.includes('light')) return true;
    if (LIGHT_FORMS.has(formOf(item))) return true;
    if (/\blight\b|ligera/i.test(text(item.properties))) return true;
    return LIGHT_NAMES.test(text(item.name).toLowerCase());
}

/**
 * Si un arma se dispara (arco, ballesta, honda…) en vez de golpear de cerca. Las arrojadizas
 * (daga, jabalina de mano no) cuentan como de cerca: es como se usan casi siempre.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isRangedWeapon(item) {
    if (!item) return false;
    if (text(item.category) === 'distancia') return true;
    const range = Number(item.rangeFeet) || 0;
    if (range > 30) return true;
    return RANGED_NAMES.test(text(item.name).toLowerCase());
}

/**
 * Si un arma es algo que se empuña: tiene dado de daño, o va en la mano del arma.
 *
 * @param {any} item
 * @returns {boolean}
 */
export function isWeaponItem(item) {
    if (!item || typeof item !== 'object') return false;
    const kind = `${text(item.type)} ${text(item.category)} ${text(item.legacyType)}`.toLowerCase();
    if (/weapon|arma/.test(kind)) return true;
    return text(item.slot) === 'weapon' && Boolean(text(item.damageDice));
}

/**
 * Si alguien sabe sacarle el truco a sus armas: las clases marciales de 2024.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function hasWeaponMastery(member) {
    if (!member) return false;
    if (member.weaponMastery === true) return true;
    if (member.weaponMastery === false) return false;
    return MASTERY_CLASSES.test(text(member.class ?? member.charClass).toLowerCase());
}

/**
 * La CD de lo que obliga a salvar (Derribar): 8 + el modificador con el que se ataca + la
 * competencia.
 *
 * @param {number} abilityMod
 * @param {number} level
 * @returns {number}
 */
export function masteryDC(abilityMod, level) {
    return 8 + (Math.trunc(Number(abilityMod)) || 0) + proficiencyBonus(level);
}

/**
 * Si la maestría salta con lo que ha pasado. Molestar y Ralentizar piden haber hecho daño;
 * Derribar, Debilitar, Empujar y Hender, solo dar; Rozar, fallar. Mellar no va en el golpe: va
 * en el de la otra mano.
 *
 * @param {MasteryId|''} mastery
 * @param {{hit: boolean, damage?: number}} outcome
 * @returns {boolean}
 */
export function masteryFires(mastery, { hit, damage = 0 }) {
    if (!mastery) return false;
    if (mastery === 'graze') return !hit;
    if (!hit) return false;
    if (mastery === 'vex' || mastery === 'slow') return Number(damage) > 0;
    return mastery !== 'nick';
}

/**
 * Lo que hace Rozar al fallar: el modificador de daño, si es positivo.
 *
 * @param {number} abilityMod
 * @returns {number}
 */
export function grazeDamage(abilityMod) {
    return Math.max(0, Math.trunc(Number(abilityMod)) || 0);
}

/**
 * Si Derribar le tira: su salvación de Constitución contra la CD. El empate salva (5e).
 *
 * @param {{dc: number, saveTotal: number}} input
 * @returns {boolean}
 */
export function toppled({ dc, saveTotal }) {
    return Number(saveTotal) < Number(dc);
}

/**
 * A dónde va a parar alguien al que se aparta en línea recta, casilla a casilla, hasta `cells`
 * casillas: se para delante de lo que no deja pasar, y si detrás hay un precipicio, cae.
 *
 * @param {Object} input
 * @param {{x: number, y: number}} input.from Quien empuja.
 * @param {{x: number, y: number}} input.target El empujado.
 * @param {number} input.cells Cuántas casillas como mucho (10 pies = 2).
 * @param {(x: number, y: number) => boolean} input.isFree
 * @param {(x: number, y: number) => boolean} [input.isChasm]
 * @returns {{to: {x: number, y: number}, moved: number, falls: boolean}}
 */
export function pushPath({ from, target, cells, isFree, isChasm = () => false }) {
    const dx = Math.sign(Number(target.x) - Number(from.x));
    const dy = Math.sign(Number(target.y) - Number(from.y));
    let at = { x: Number(target.x), y: Number(target.y) };
    if (dx === 0 && dy === 0) return { to: at, moved: 0, falls: false };
    let moved = 0;
    for (let step = 0; step < Math.max(0, Math.floor(Number(cells) || 0)); step++) {
        const next = { x: at.x + dx, y: at.y + dy };
        if (isChasm(next.x, next.y)) return { to: next, moved: moved + 1, falls: true };
        if (!isFree(next.x, next.y)) break;
        at = next;
        moved++;
    }
    return { to: at, moved, falls: false };
}

/**
 * Con quién sigue Hender: otro enemigo en pie pegado al primero (5 pies) y al alcance de quien
 * ataca. El más herido primero: es al que más le duele.
 *
 * @param {Object} input
 * @param {{id: string, x: number, y: number}} input.first
 * @param {{x: number, y: number}} input.attacker
 * @param {number} input.reachFeet
 * @param {Array<{id: string, x: number, y: number, hp: number}>} input.others
 * @returns {string} La id del segundo, o vacío.
 */
export function cleaveTarget({ first, attacker, reachFeet, others }) {
    const feet = (/** @type {{x: number, y: number}} */ a, /** @type {{x: number, y: number}} */ b) =>
        Math.max(Math.abs(Number(a.x) - Number(b.x)), Math.abs(Number(a.y) - Number(b.y))) * 5;
    const near = (Array.isArray(others) ? others : [])
        .filter(o => String(o.id) !== String(first.id) && Number(o.hp) > 0)
        .filter(o => feet(o, first) <= 5 && feet(o, attacker) <= Math.max(5, Number(reachFeet) || 5))
        .sort((a, b) => Number(a.hp) - Number(b.hp));
    return near[0] ? String(near[0].id) : '';
}

/**
 * Juntar a la ventaja o desventaja de `attackEdge` las que pone el turno de 2024 (Molestar, el
 * agarre). 5e: una de cada se anulan, y varias de lo mismo no suman. `attackEdge` solo devuelve
 * el modo y las razones juntas; con eso basta para saber si ya había de cada una.
 *
 * @param {{mode: 'advantage'|'disadvantage'|'normal', reasons: string[]}} edge
 * @param {string[]} [up] Razones nuevas a favor.
 * @param {string[]} [down] Razones nuevas en contra.
 * @returns {{mode: 'advantage'|'disadvantage'|'normal', reasons: string[]}}
 */
export function combineEdge(edge, up = [], down = []) {
    const reasons = Array.isArray(edge?.reasons) ? edge.reasons : [];
    const mode = edge?.mode ?? 'normal';
    const both = mode === 'normal' && reasons.length > 0;
    const hasUp = mode === 'advantage' || both || up.length > 0;
    const hasDown = mode === 'disadvantage' || both || down.length > 0;
    const next = hasUp && !hasDown ? 'advantage' : hasDown && !hasUp ? 'disadvantage' : 'normal';
    return { mode: next, reasons: [...reasons, ...up, ...down] };
}

// ---------------------------------------------------------------- lo que recuerda el turno

/**
 * @typedef {Object} TurnFlags Lo de este turno de quien actúa.
 * @property {string} actor
 * @property {number} round
 * @property {boolean} swapped Ya cambió de arma gratis.
 * @property {string} lightWeapon El arma ligera con la que atacó (para la otra mano), o vacío.
 * @property {boolean} offhand Ya golpeó con la otra mano.
 * @property {boolean} cleaved Ya hendió este turno (una vez por turno).
 * @property {boolean} nicked Ya melló este turno (una vez por turno).
 * @property {boolean} stood Se levantó del suelo este turno.
 */

/**
 * @typedef {Object} Tactics
 * @property {Array<{by: string, target: string, round: number}>} vex Molestar: quién tiene ventaja contra quién.
 * @property {TurnFlags|null} turn
 * @property {Record<string, string[]>} studied Lo que ya se sabe de cada enemigo (Estudiar).
 * @property {string[]} [sneak] E3.1: los furtivos ya metidos, por `sneakKey` (quién, en el turno de
 *   quién y en qué ronda): uno por turno.
 * @property {string[]} [bondMoves] E3.4: los compañeros que ya han hecho su jugada del vínculo 7 en
 *   este combate (una por combate).
 */

/**
 * @param {any} raw
 * @returns {Tactics}
 */
export function readTactics(raw) {
    const vex = Array.isArray(raw?.vex)
        ? raw.vex.filter((/** @type {any} */ v) => v && v.by != null && v.target != null)
            .map((/** @type {any} */ v) => ({ by: String(v.by), target: String(v.target), round: Math.floor(Number(v.round) || 0) }))
        : [];
    const t = raw?.turn;
    const turn = t && t.actor != null ? {
        actor: String(t.actor),
        round: Math.floor(Number(t.round) || 0),
        swapped: Boolean(t.swapped),
        lightWeapon: text(t.lightWeapon),
        offhand: Boolean(t.offhand),
        cleaved: Boolean(t.cleaved),
        nicked: Boolean(t.nicked),
        stood: Boolean(t.stood),
    } : null;
    /** @type {Record<string, string[]>} */
    const studied = {};
    if (raw?.studied && typeof raw.studied === 'object') {
        for (const [id, facts] of Object.entries(raw.studied)) {
            if (Array.isArray(facts)) studied[String(id)] = facts.map(String);
        }
    }
    // E3.1: solo los de esta ronda y la anterior; lo demás ya no puede volver.
    const sneak = Array.isArray(raw?.sneak) ? raw.sneak.map(String).filter(Boolean).slice(-24) : [];
    const bondMoves = Array.isArray(raw?.bondMoves) ? raw.bondMoves.map(String).filter(Boolean) : [];
    return { vex, turn, studied, sneak, bondMoves };
}

/**
 * E3.4: apuntar que un compañero ya ha hecho su jugada del vínculo 7 en este combate.
 *
 * @param {any} raw
 * @param {string} companionId
 * @returns {Tactics}
 */
export function noteBondMove(raw, companionId) {
    const state = readTactics(raw);
    const list = state.bondMoves ?? [];
    return { ...state, bondMoves: list.includes(String(companionId)) ? list : [...list, String(companionId)] };
}

/**
 * E3.4: si un compañero ya ha hecho su jugada del vínculo 7 en este combate.
 *
 * @param {any} raw
 * @param {string} companionId
 * @returns {boolean}
 */
export function bondMoveUsed(raw, companionId) {
    return (readTactics(raw).bondMoves ?? []).includes(String(companionId));
}

/**
 * E3.1: apuntar que alguien ya ha metido su furtivo en este turno (`sneakKey` de `sneak-attack.js`).
 *
 * @param {any} raw
 * @param {string} key
 * @returns {Tactics}
 */
export function noteSneak(raw, key) {
    const state = readTactics(raw);
    const list = state.sneak ?? [];
    return { ...state, sneak: list.includes(String(key)) ? list : [...list, String(key)] };
}

/**
 * E3.1: si ya lo ha metido en este turno.
 *
 * @param {any} raw
 * @param {string} key
 * @returns {boolean}
 */
export function sneakSpent(raw, key) {
    return (readTactics(raw).sneak ?? []).includes(String(key));
}

/**
 * Lo de este turno de `actor`. Si lo guardado es de otro turno, uno en blanco: no hace falta
 * que nadie lo borre al pasar de turno.
 *
 * @param {any} raw
 * @param {string} actor
 * @param {number} round
 * @returns {TurnFlags}
 */
export function turnFlags(raw, actor, round) {
    const { turn } = readTactics(raw);
    if (turn && turn.actor === String(actor) && turn.round === Math.floor(Number(round) || 0)) return turn;
    return { actor: String(actor), round: Math.floor(Number(round) || 0), swapped: false, lightWeapon: '', offhand: false, cleaved: false, nicked: false, stood: false };
}

/**
 * Apuntar algo de este turno.
 *
 * @param {any} raw
 * @param {string} actor
 * @param {number} round
 * @param {Partial<TurnFlags>} patch
 * @returns {Tactics}
 */
export function markTurn(raw, actor, round, patch) {
    const state = readTactics(raw);
    return { ...state, turn: { ...turnFlags(raw, actor, round), ...patch, actor: String(actor), round: Math.floor(Number(round) || 0) } };
}

/**
 * Molestar: `by` tiene ventaja en su siguiente ataque contra `target` hasta el final de su
 * próximo turno. Uno por pareja: volver a molestar renueva.
 *
 * @param {any} raw
 * @param {{by: string, target: string, round: number}} mark
 * @returns {Tactics}
 */
export function noteVex(raw, { by, target, round }) {
    const state = readTactics(raw);
    const vex = state.vex.filter(v => !(v.by === String(by) && v.target === String(target)));
    vex.push({ by: String(by), target: String(target), round: Math.floor(Number(round) || 0) });
    return { ...state, vex };
}

/**
 * Si `by` tiene la ventaja de Molestar contra `target` ahora, y el estado sin ella (se gasta en
 * ese ataque). Caduca al acabar la ronda siguiente a la del golpe.
 *
 * @param {any} raw
 * @param {{by: string, target: string, round: number}} attack
 * @returns {{vex: boolean, state: Tactics}}
 */
export function takeVex(raw, { by, target, round }) {
    const state = readTactics(raw);
    const now = Math.floor(Number(round) || 0);
    const live = state.vex.filter(v => now <= v.round + 1);
    const found = live.some(v => v.by === String(by) && v.target === String(target));
    return {
        vex: found,
        state: { ...state, vex: live.filter(v => !(v.by === String(by) && v.target === String(target))) },
    };
}

/**
 * Si `by` tendría la ventaja de Molestar contra `target` (sin gastarla), para enseñarla antes.
 *
 * @param {any} raw
 * @param {{by: string, target: string, round: number}} attack
 * @returns {boolean}
 */
export function hasVex(raw, attack) {
    return takeVex(raw, attack).vex;
}

/**
 * Apuntar lo que se ha averiguado de un enemigo (Estudiar).
 *
 * @param {any} raw
 * @param {string} enemyId
 * @param {string[]} facts Las claves de lo averiguado.
 * @returns {Tactics}
 */
export function noteStudied(raw, enemyId, facts) {
    const state = readTactics(raw);
    const known = new Set(state.studied[String(enemyId)] ?? []);
    for (const fact of facts) known.add(String(fact));
    return { ...state, studied: { ...state.studied, [String(enemyId)]: [...known] } };
}
