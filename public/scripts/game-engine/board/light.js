/**
 * E2.1 de wiki/ROADMAP_ENTRETENIDO.md: la luz cuenta.
 *
 * Hasta aquí la oscuridad de una cripta solo se dibujaba: se peleaba y se buscaban trampas igual
 * que a pleno sol. Ahora cuenta con las reglas de 5e (2024):
 *
 * - **Tres luces.** Luz plena, **penumbra** (poco oscurecido) y **oscuridad** (muy oscurecido).
 * - **Penumbra:** desventaja en las pruebas de Sabiduría (Percepción) que dependen de la vista. La
 *   Percepción pasiva baja 5 (lo mismo que la desventaja, como en 5e).
 * - **Oscuridad:** quien mira a algo a oscuras está **como cegado** respecto a eso: no lo ve. Atacar
 *   a quien no ves, con desventaja; a quien no te ve, con ventaja. Si ninguno ve al otro, se anulan
 *   (es la regla, no un descuido). Y lo que está a oscuras no se encuentra buscando.
 * - **Visión en la oscuridad** (60 pies casi siempre; 120 enanos y orcos en 2024): dentro de su
 *   alcance, la penumbra es luz plena y la oscuridad, penumbra.
 * - **Lo que alumbra:** la antorcha (20 pies de luz y 20 más de penumbra, una hora, ocupa una mano),
 *   el farol (30 y 30) y la Luz (20 y 20). La luz no pasa paredes ni puertas cerradas.
 * - **La mano de la antorcha** (5e): quien la lleva no tiene esa mano para otra cosa. Se la da a
 *   quien tiene una libre; si nadie la tiene, a quien lleva escudo, que pelea sin él.
 *
 * Qué sitios están oscuros lo dice el tablero (`light`: «oscuro», «penumbra», «luz») o, si no lo
 * dice, lo mismo que la Luz de fuera de combate (`darkHere`, D-J51): una cueva, una cripta o una
 * mazmorra, siempre. La noche al raso la lleva `world/visibility.js`: aquí no se cuenta dos veces.
 *
 * Puro: dice qué luz hay en cada casilla y lo que cambia. Quien llama dibuja, tira y guarda.
 */

import { hasLineOfSight } from './line-of-sight.js';
import { equippedIn, weaponOf } from '../rules/equipment.js';

/** Las tres luces, de más a menos. */
export const LIGHT_LEVELS = /** @type {const} */ (['bright', 'dim', 'dark']);

/** Lo que alumbra: luz plena y penumbra, en pies (5e). `hand`: se lleva en la mano. `burns`: se gasta. */
export const LIGHT_SOURCES = {
    antorcha: { label: 'Antorcha', icon: '🔥', bright: 20, dim: 20, hand: true, burns: true },
    farol: { label: 'Farol', icon: '🏮', bright: 30, dim: 30, hand: true, burns: false },
    luz: { label: 'Luz', icon: '✨', bright: 20, dim: 20, hand: false, burns: false },
};

/** La visión en la oscuridad de casi todos (5e). */
export const DARKVISION_FEET = 60;

/** Lo que baja la Percepción pasiva en la penumbra (la desventaja, en pasiva: −5). */
export const DIM_PASSIVE_PENALTY = 5;

/** Las especies del compendio que ven a oscuras, y hasta dónde (2024; las de 2014, 60). */
const SPECIES_DARKVISION = [
    [/\benan[oa]s?\b/i, 120],
    [/\borc[oa]s?\b/i, 120],
    [/semiorc|semi-orc|media orca|medio orco/i, 60],
    [/\belf[oa]s?\b|semielf|media elfa|medio elfo|drow/i, 60],
    [/\bgnom[oa]s?\b/i, 60],
    [/tifl[ií]n|tiefling/i, 60],
    [/drac[oó]nid/i, 60],
];

/** Lo que ve a oscuras de los bichos de siempre (5e: muertos, trasgos, arañas, brujas…). */
const MONSTER_DARKVISION = /zombi|esquelet|no[\s-]?muert|vampir|engendro|necr[oó]fag|\bgul\b|espectr|fantasm|aparecid|tumulari|momia|revenant|\bsombra|goblin|trasg|hobgoblin|osgo|kobold|\borc[oa]|gnoll|ogro|\btrol|drow|diablo|demonio|ara[ñn]a|murci[eé]lag|\brata|bruja|hag\b|sabueso infernal|g[aá]rgola|undead|fiend/i;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const num = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * La luz de un sitio, sin contar lo que lleva el grupo.
 *
 * @param {{declared?: string, dark?: boolean}} input `declared`: lo que dice el tablero; `dark`:
 *   si el sitio es de los oscuros (`darkHere`).
 * @returns {'bright'|'dim'|'dark'}
 */
export function ambientLight({ declared = '', dark = false } = {}) {
    const said = text(declared).toLowerCase();
    if (/^(luz|bright|iluminad[oa]|claro)$/.test(said)) return 'bright';
    if (/^(penumbra|dim|tenue)$/.test(said)) return 'dim';
    if (/^(oscuro|oscura|oscuridad|dark)$/.test(said)) return 'dark';
    return dark ? 'dark' : 'bright';
}

/**
 * Hasta dónde ve alguien a oscuras, en pies (0: no ve). Lo que diga su ficha (`darkvision`)
 * manda; si no, su especie o, si es un bicho, lo que es.
 *
 * @param {any} creature Un miembro del grupo, un enemigo o su plantilla.
 * @param {{monster?: boolean}} [options] `monster`: es un bicho (un enemigo), y lo que es cuenta.
 * @returns {number}
 */
export function darkvisionOf(creature, { monster = false } = {}) {
    if (!creature) return 0;
    if (creature.darkvision !== undefined && creature.darkvision !== null && text(creature.darkvision) !== '') {
        return Math.max(0, num(creature.darkvision));
    }
    const species = text(creature.race ?? creature.species);
    for (const [pattern, feet] of SPECIES_DARKVISION) {
        if (/** @type {RegExp} */ (pattern).test(species)) return /** @type {number} */ (feet);
    }
    const senses = text(creature.senses);
    const told = senses.match(/(?:visi[oó]n en la oscuridad|darkvision)\D{0,4}(\d+)/i);
    if (told) return num(told[1]);
    const kind = [creature.name, creature.archetype, creature.type, creature.creatureType, creature.kind]
        .map(text).filter(Boolean).join(' ');
    if (monster && MONSTER_DARKVISION.test(kind)) return DARKVISION_FEET;
    return 0;
}

/**
 * Los focos de luz, en casillas del tablero.
 *
 * @param {Array<{x: number, y: number, kind: string}>} carried Donde está cada luz y de qué es (`antorcha`, `farol`, `luz`).
 * @returns {Array<{x: number, y: number, kind: string, bright: number, dim: number}>} `bright` y `dim` en pies.
 */
export function lightSources(carried) {
    return (Array.isArray(carried) ? carried : [])
        .map(c => {
            const spec = /** @type {Record<string, {bright: number, dim: number}>} */ (LIGHT_SOURCES)[text(c?.kind)];
            return spec ? { x: Math.trunc(num(c.x)), y: Math.trunc(num(c.y)), kind: text(c.kind), bright: spec.bright, dim: spec.dim } : null;
        })
        .filter(/** @returns {s is {x: number, y: number, kind: string, bright: number, dim: number}} */ s => s !== null);
}

/**
 * La distancia entre dos casillas en pies, como la mide el resto del tablero (5 por casilla, en
 * diagonal también).
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function feetBetweenCells(a, b) {
    return Math.max(Math.abs(num(a?.x) - num(b?.x)), Math.abs(num(a?.y) - num(b?.y))) * 5;
}

/**
 * La luz que hay en una casilla: la del sitio, o la de un foco que llegue hasta ella sin pared
 * de por medio.
 *
 * @param {{x: number, y: number}} cell
 * @param {'bright'|'dim'|'dark'} ambient
 * @param {Array<{x: number, y: number, bright: number, dim: number}>} sources
 * @param {any} [terrain] Para que la luz no atraviese paredes ni puertas cerradas.
 * @returns {'bright'|'dim'|'dark'}
 */
export function lightLevelAt(cell, ambient, sources, terrain = null) {
    if (ambient === 'bright') return 'bright';
    let best = ambient === 'dim' ? 1 : 2;
    for (const source of Array.isArray(sources) ? sources : []) {
        const feet = feetBetweenCells(source, cell);
        if (feet > source.bright + source.dim) continue;
        const level = feet <= source.bright ? 0 : 1;
        if (level >= best) continue;
        if (terrain && !hasLineOfSight(terrain, source.x, source.y, Math.trunc(num(cell?.x)), Math.trunc(num(cell?.y)))) continue;
        best = level;
        if (best === 0) break;
    }
    return LIGHT_LEVELS[best];
}

/**
 * La luz como la ve alguien: con visión en la oscuridad, dentro de su alcance, la penumbra es luz
 * plena y la oscuridad, penumbra (5e).
 *
 * @param {'bright'|'dim'|'dark'} level
 * @param {number} darkvisionFeet
 * @param {number} distanceFeet De quien mira a lo que mira.
 * @returns {'bright'|'dim'|'dark'}
 */
export function seenAs(level, darkvisionFeet, distanceFeet) {
    if (num(darkvisionFeet) <= 0 || num(distanceFeet) > num(darkvisionFeet)) return level;
    return level === 'dark' ? 'dim' : 'bright';
}

/**
 * Lo que la luz le hace a un ataque: quién ve a quién.
 *
 * - Quien ataca no ve a su blanco (está a oscuras para él): desventaja.
 * - El blanco no ve a quien le ataca: ventaja.
 * - Si pasan las dos cosas, se anulan (5e).
 *
 * @param {Object} input
 * @param {'bright'|'dim'|'dark'} input.ambient
 * @param {Array<{x: number, y: number, bright: number, dim: number}>} input.sources
 * @param {{x: number, y: number, darkvision?: number}} input.attacker
 * @param {{x: number, y: number, darkvision?: number}} input.target
 * @param {any} [input.terrain]
 * @returns {{up: string[], down: string[], attackerSees: boolean, targetSees: boolean}}
 */
export function sightEdge({ ambient, sources, attacker, target, terrain = null }) {
    if (ambient === 'bright') return { up: [], down: [], attackerSees: true, targetSees: true };
    const distance = feetBetweenCells(attacker, target);
    const attackerSees = seenAs(lightLevelAt(target, ambient, sources, terrain), num(attacker?.darkvision), distance) !== 'dark';
    const targetSees = seenAs(lightLevelAt(attacker, ambient, sources, terrain), num(target?.darkvision), distance) !== 'dark';
    return {
        up: targetSees ? [] : ['a oscuras: no le ve venir'],
        down: attackerSees ? [] : ['a oscuras: no ve a quien ataca'],
        attackerSees,
        targetSees,
    };
}

/**
 * Lo que la luz le hace a mirar (buscar trampas, ver lo escondido): la luz que ve quien mira.
 *
 * @param {'bright'|'dim'|'dark'} seen La luz de la casilla, ya como la ve quien mira (`seenAs`).
 * @returns {{edge: ''|'disadvantage', blind: boolean, passivePenalty: number, why: string}}
 */
export function perceptionInLight(seen) {
    if (seen === 'dark') return { edge: '', blind: true, passivePenalty: 0, why: 'a oscuras no se ve nada' };
    if (seen === 'dim') return { edge: 'disadvantage', blind: false, passivePenalty: DIM_PASSIVE_PENALTY, why: 'en penumbra cuesta ver' };
    return { edge: '', blind: false, passivePenalty: 0, why: '' };
}

/**
 * Si un objeto es una antorcha, un farol, o nada que alumbre.
 *
 * @param {any} item
 * @returns {''|'antorcha'|'farol'}
 */
export function lightKindOf(item) {
    const name = text(item?.name);
    if (/^antorchas?\b/i.test(name)) return 'antorcha';
    if (/^(farol|linterna|l[aá]mpara)/i.test(name)) return 'farol';
    return '';
}

/**
 * Cuántas antorchas lleva alguien (un montón cuenta por su `quantity`).
 *
 * @param {any} member
 * @returns {number}
 */
export function torchesOf(member) {
    return (Array.isArray(member?.items) ? member.items : [])
        .filter((/** @type {any} */ item) => lightKindOf(item) === 'antorcha')
        .reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + Math.max(1, Math.floor(num(item.quantity) || 1)), 0);
}

/**
 * Si alguien lleva un farol.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function carriesLantern(member) {
    return (Array.isArray(member?.items) ? member.items : []).some((/** @type {any} */ item) => lightKindOf(item) === 'farol');
}

/**
 * Qué mano le queda a alguien: libre, la del escudo (lo deja para llevar la luz) o ninguna (un
 * arma a dos manos).
 *
 * @param {any} member
 * @returns {'free'|'shield'|'two-handed'}
 */
export function handFor(member) {
    if (num(weaponOf(member)?.hands) >= 2) return 'two-handed';
    if (equippedIn(member, 'shield')) return 'shield';
    return 'free';
}

/**
 * Lo que suma el escudo que lleva alguien a su clase de armadura.
 *
 * @param {any} member
 * @returns {number}
 */
export function shieldBonusOf(member) {
    const shield = equippedIn(member, 'shield');
    if (!shield) return 0;
    const effects = (Array.isArray(shield.effects) ? shield.effects : [])
        .filter((/** @type {any} */ e) => text(e?.stat) === 'armorClass')
        .reduce((/** @type {number} */ sum, /** @type {any} */ e) => sum + num(e.modifier), 0);
    return Math.max(0, effects + num(shield.armorClass));
}

/** @param {any} member @returns {boolean} */
const able = (member) => Boolean(member) && !member.dead && num(member.hp ?? 1) > 0;

/**
 * Quién lleva la luz: el elegido en la formación (si puede); si no, quien tiene una mano libre
 * (antes quien ya lleva la luz encima), luego quien lleva escudo y, si no queda otro, cualquiera.
 *
 * @param {any[]} members
 * @param {string} [chosenId] El de la formación (`antorcha`).
 * @param {(member: any) => boolean} [carries] Si lleva algo que alumbre.
 * @returns {{member: any, hand: 'free'|'shield'|'two-handed'}|null}
 */
export function pickBearer(members, chosenId = '', carries = () => false) {
    const list = (Array.isArray(members) ? members : []).filter(able);
    if (list.length === 0) return null;
    const chosen = text(chosenId) ? list.find(m => text(m.id) === text(chosenId)) : null;
    if (chosen) return { member: chosen, hand: handFor(chosen) };
    const rank = (/** @type {any} */ m) => ({ free: 0, shield: 1, 'two-handed': 2 })[handFor(m)] * 2 + (carries(m) ? 0 : 1);
    const best = [...list].sort((a, b) => rank(a) - rank(b))[0];
    return { member: best, hand: handFor(best) };
}

/**
 * Si la antorcha encendida sigue ardiendo: dura una hora, y el juego cuenta por partes del día
 * (como la Luz): se apaga cuando pasa la parte del día en que se encendió (un descanso corto, que
 * es una hora, se la lleva).
 *
 * @param {any} torch Lo guardado: `{bearerId, day, slotIndex}`.
 * @param {any} calendar
 * @returns {boolean}
 */
export function torchBurning(torch, calendar) {
    if (!torch || typeof torch !== 'object') return false;
    return Math.floor(num(torch.day)) === Math.floor(num(calendar?.day))
        && Math.floor(num(torch.slotIndex)) === Math.floor(num(calendar?.slotIndex));
}

/**
 * @typedef {Object} LightPlan
 * @property {'bright'|'dim'|'dark'} ambient
 * @property {Array<{x: number, y: number, kind: string}>} carried Las luces que hay y dónde.
 * @property {any|null} bearer Quien lleva la luz de mano (la antorcha o el farol).
 * @property {'free'|'shield'|'two-handed'|''} hand
 * @property {''|'antorcha'|'farol'} handLight
 * @property {boolean} lightTorch Si hay que encender una antorcha nueva (y gastarla).
 * @property {any|null} torchFrom Quién pone la antorcha nueva (de su mochila).
 * @property {number} torchesLeft Las que quedan en el grupo, sin contar la que arde.
 */

/**
 * Qué luz lleva el grupo aquí y ahora.
 *
 * - Un farol, si alguien lo lleva: no se gasta (el aceite no se cuenta).
 * - La Luz lanzada fuera de combate, en quien la lanzó, mientras dure.
 * - La antorcha que arde, en quien la lleva; si no arde ninguna y queda alguna, se enciende una.
 *
 * @param {Object} input
 * @param {'bright'|'dim'|'dark'} input.ambient
 * @param {Array<{member: any, x: number, y: number}>} input.party Los del grupo en el tablero.
 * @param {any} [input.torch] La antorcha encendida (`{bearerId, day, slotIndex}`).
 * @param {any} [input.calendar]
 * @param {string} [input.chosenId] Quien lleva la luz, según la formación.
 * @param {string} [input.fieldLightBy] El id de quien lanzó la Luz, si sigue encendida.
 * @returns {LightPlan}
 */
export function planLight({ ambient, party, torch = null, calendar = null, chosenId = '', fieldLightBy = '' }) {
    const here = (Array.isArray(party) ? party : []).filter(p => able(p?.member));
    /** @type {LightPlan} */
    const plan = { ambient, carried: [], bearer: null, hand: '', handLight: '', lightTorch: false, torchFrom: null, torchesLeft: 0 };
    plan.torchesLeft = here.reduce((sum, p) => sum + torchesOf(p.member), 0);
    if (ambient === 'bright' || here.length === 0) return plan;
    const at = (/** @type {any} */ member) => here.find(p => p.member === member) ?? null;
    const caster = text(fieldLightBy) ? here.find(p => text(p.member.id) === text(fieldLightBy)) : null;
    if (caster) plan.carried.push({ x: caster.x, y: caster.y, kind: 'luz' });
    const lantern = here.find(p => carriesLantern(p.member));
    if (lantern) {
        plan.bearer = lantern.member;
        plan.hand = handFor(lantern.member);
        plan.handLight = 'farol';
        plan.carried.push({ x: lantern.x, y: lantern.y, kind: 'farol' });
        return plan;
    }
    const burning = torchBurning(torch, calendar) ? here.find(p => text(p.member.id) === text(torch?.bearerId)) : null;
    if (burning) {
        plan.bearer = burning.member;
        plan.hand = handFor(burning.member);
        plan.handLight = 'antorcha';
        plan.carried.push({ x: burning.x, y: burning.y, kind: 'antorcha' });
        return plan;
    }
    if (plan.torchesLeft <= 0) return plan;
    const pick = pickBearer(here.map(p => p.member), chosenId, m => torchesOf(m) > 0);
    if (!pick) return plan;
    const spot = at(pick.member);
    plan.bearer = pick.member;
    plan.hand = pick.hand;
    plan.handLight = 'antorcha';
    plan.lightTorch = true;
    plan.torchFrom = torchesOf(pick.member) > 0 ? pick.member : here.find(p => torchesOf(p.member) > 0)?.member ?? null;
    plan.torchesLeft = Math.max(0, plan.torchesLeft - 1);
    if (spot) plan.carried.push({ x: spot.x, y: spot.y, kind: 'antorcha' });
    return plan;
}

/**
 * Quitar una antorcha de la mochila de alguien (un montón baja en uno; la última se va).
 *
 * @param {any[]} items
 * @returns {any[]}
 */
export function spendTorch(items) {
    const list = Array.isArray(items) ? [...items] : [];
    const at = list.findIndex(item => lightKindOf(item) === 'antorcha');
    if (at < 0) return list;
    const count = Math.max(1, Math.floor(num(list[at].quantity) || 1));
    if (count > 1) list[at] = { ...list[at], quantity: count - 1 };
    else list.splice(at, 1);
    return list;
}

/**
 * La línea de la luz para el tablero: lo que hay y quién la lleva, con lo que cuesta. Vacía si
 * aquí se ve bien.
 *
 * @param {LightPlan} plan
 * @param {Array<{name: string, darkvision: number}>} [seers] Los del grupo que ven a oscuras.
 * @returns {string}
 */
export function describeLight(plan, seers = []) {
    if (!plan || plan.ambient === 'bright') return '';
    const eyes = (Array.isArray(seers) ? seers : []).filter(s => num(s?.darkvision) > 0).map(s => text(s.name));
    const sees = eyes.length === 0 ? '' : ` ${eyes.join(' y ')} ${eyes.length > 1 ? 'ven' : 've'} en la oscuridad.`;
    const who = text(plan.bearer?.name);
    const handNote = plan.hand === 'shield' ? ' Sin escudo mientras la lleva.' : plan.hand === 'two-handed' ? ' Para pelear a dos manos, la deja en el suelo.' : '';
    const luz = plan.carried.some(c => c.kind === 'luz') ? ' La Luz alumbra también.' : '';
    if (plan.handLight === 'farol') return `🏮 Farol: lo lleva ${who}.${handNote}${luz}${sees}`;
    if (plan.handLight === 'antorcha') {
        const left = plan.torchesLeft === 0 ? 'es la última' : `quedan ${plan.torchesLeft}`;
        return `🔥 Antorcha: la lleva ${who} (${left}). Dura una hora.${handNote}${luz}${sees}`;
    }
    if (luz) return `✨ La Luz alumbra.${sees}`;
    if (plan.ambient === 'dim') return `🌘 Penumbra: cuesta ver trampas y lo escondido.${sees}`;
    return `🌑 A oscuras: sin luz no se ve.${sees}`;
}
