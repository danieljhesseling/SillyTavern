/**
 * La magia fuera de combate (J19.10 de wiki/ROADMAP_SIN_CONEXION.md): los conjuros que
 * sirven cuando no hay nadie a quien pegar, cada uno enchufado a algo que ya existe.
 *
 * | Conjuro | Qué hace | Dónde se nota |
 * | :--- | :--- | :--- |
 * | Luz, Luz del día | Alumbra esta parte del día | La noche en el campamento cuenta como con fuego; en un sitio oscuro, +2 a examinar |
 * | Curar heridas, Palabra de curación, Plegaria de curación… | Cura a los heridos | La vida de la ficha, entre pelea y pelea o al llegar de un viaje |
 * | Hablar con los muertos | La víctima de un asesinato contesta | Una pista de las buenas del caso abierto (`cases.js`) |
 * | Detectar magia, Identificar, Alarma | Lo mismo que como ritual | Para quien no los lanza como ritual (el explorador): con un espacio |
 *
 * Los rituales (sin espacio, diez minutos) los decide `rituals.js`, y aquí solo se listan
 * junto a lo demás, para que la magia de fuera de combate esté en un solo sitio: lanzarlos es
 * cosa de quien ya los lanza (`party/rituals.js`). Lo de esta tabla gasta su espacio, como en
 * la mesa; los trucos, nada.
 *
 * Qué conjuro es de qué clase sale de sus columnas (`conjuros.json`): el que cura a un aliado
 * cura, el de luz alumbra. Así, un conjuro nuevo que cure no pide código.
 *
 * Puro: qué se puede lanzar ahora, qué hace aquí y lo que cambia. Quien llama tira los dados,
 * lo aplica y lo guarda.
 */

import { canCastSpell, upcastSpell } from './spell-cast.js';
import { castableSpells, ritualSpells } from './spell-prep.js';
import { spendSlot, spellcastingStats, SLOT_LABELS } from './spell-slots.js';
import { normalizeSpell } from './spell-catalogue.js';
import { ritualChoices, ritualKind, detectMagic, identifyAll, setAlarm, ALARM_WATCH_BONUS } from './rituals.js';

/** Los conjuros que no se deducen de sus columnas. */
export const FIELD_SPELL_IDS = { 'mag-hablar-muertos': 'muertos' };

/** Los de ritual que también se pueden lanzar con un espacio, fuera de combate. */
const SLOT_RITUAL_KINDS = ['detect', 'identify', 'alarm'];

/** Lo que suma la Luz a examinar en un sitio oscuro. */
export const LIGHT_LOOK_BONUS = 2;

/** Los biomas y tipos de sitio donde no se ve sin luz. */
const DARK_BIOMES = ['cueva', 'cripta', 'mazmorra', 'mina', 'tunel'];

/**
 * @typedef {Object} FieldContext
 * @property {boolean} [night] Si es de noche.
 * @property {boolean} [dark] Si aquí no se ve (una cueva, una cripta), sea la hora que sea.
 * @property {any} [calendar] El calendario de la campaña (`day`, `slotIndex`).
 * @property {any} [light] La Luz que ya está encendida (`castField` → `effects.light`).
 * @property {any} [cases] Los casos (`readCases`).
 * @property {number} [unknownItems] Cuántas cosas lleva el grupo sin identificar.
 * @property {boolean} [alarmSet] Si la alarma ya está puesta esta noche.
 * @property {string} [pet] La mascota que ya os acompaña (para el ritual del familiar).
 * @property {any[]} [party] El grupo, para saber quién está herido.
 * @property {Array<{name: string, carried: any[], focus?: string}>} [others] Lo que llevan los demás.
 */

/**
 * @typedef {Object} FieldChoice
 * @property {string} id
 * @property {string} name
 * @property {string} kind `luz`, `curar`, `muertos` o uno de los rituales (`detect`, `identify`…).
 * @property {'truco'|'espacio'|'ritual'} how
 * @property {number} level El nivel del conjuro.
 * @property {number} slotLevel El espacio que gastará (0: truco o ritual).
 * @property {string} cost Lo que cuesta, dicho: «Truco», «Un espacio de 1.er nivel», «Ritual: diez minutos, sin espacio».
 * @property {number} minutes
 * @property {boolean} ok
 * @property {string} reason Por qué no, si no.
 * @property {string} does Lo que hará aquí, en una frase.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Qué hace un conjuro fuera de combate, o nada si fuera de combate no hace nada.
 *
 * @param {any} spell Normalizado o no.
 * @returns {string}
 */
export function fieldKind(spell) {
    const read = spell?.aliases && spell?.area ? spell : normalizeSpell(spell);
    const ids = [read.id, ...read.aliases];
    const named = ids.map(id => /** @type {Record<string, string>} */ (FIELD_SPELL_IDS)[id]).find(Boolean);
    if (named) return named;
    if (read.healing && read.target === 'ally' && read.castingTime !== 'reaction' && !read.revives) return 'curar';
    if (read.element === 'luz' || read.zone?.kind === 'luz') return 'luz';
    const ritual = ritualKind(read);
    return SLOT_RITUAL_KINDS.includes(ritual) ? ritual : '';
}

/**
 * Si aquí no se ve sin luz: de noche, o en una cueva, una cripta o una mazmorra.
 *
 * @param {{night?: boolean, biome?: string, type?: string}} where
 * @returns {boolean}
 */
export function darkHere({ night = false, biome = '', type = '' } = {}) {
    return Boolean(night) || DARK_BIOMES.includes(text(biome).toLowerCase()) || text(type) === 'dungeon';
}

/**
 * Si la Luz sigue encendida: dura lo que queda de la parte del día en que se lanzó.
 *
 * @param {any} light
 * @param {any} calendar
 * @returns {boolean}
 */
export function lightActive(light, calendar) {
    if (!light || typeof light !== 'object') return false;
    return Math.floor(Number(light.day) || 0) === Math.floor(Number(calendar?.day) || 0)
        && Math.floor(Number(light.slotIndex) || 0) === Math.floor(Number(calendar?.slotIndex) || 0);
}

/**
 * Lo que suma la Luz a examinar aquí, si está encendida y aquí está oscuro.
 *
 * @param {any} light
 * @param {any} calendar
 * @param {boolean} dark
 * @returns {number}
 */
export function lightLookBonus(light, calendar, dark) {
    return dark && lightActive(light, calendar) ? LIGHT_LOOK_BONUS : 0;
}

/**
 * Quién necesita curarse, de más herido a menos.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
export function woundedOf(party) {
    return (Array.isArray(party) ? party : [])
        .filter(m => m && !m.dead && (Number(m.hp) || 0) > 0 && (Number(m.maxHp) || 0) > (Number(m.hp) || 0))
        .sort((a, b) => ((Number(b.maxHp) || 0) - (Number(b.hp) || 0)) - ((Number(a.maxHp) || 0) - (Number(a.hp) || 0)));
}

/**
 * La pista que daría Hablar con los muertos: una de las que señalan de verdad, sin encontrar.
 *
 * @param {any} cases
 * @returns {any|null}
 */
function deadClue(cases) {
    const active = cases?.active;
    if (!active || active.kind !== 'asesinato') return null;
    const found = Array.isArray(cases.found) ? cases.found : [];
    return (Array.isArray(active.clues) ? active.clues : []).find((/** @type {any} */ c) => !c.misleading && !found.includes(c.id)) ?? null;
}

/**
 * Por qué no serviría ahora de nada. Vacío si sirve.
 *
 * @param {string} kind
 * @param {FieldContext} context
 * @returns {string}
 */
function uselessNow(kind, context) {
    switch (kind) {
        case 'luz':
            if (lightActive(context.light, context.calendar)) return 'Ya hay una Luz encendida.';
            return context.night || context.dark ? '' : 'Aquí se ve bien: ahora no hace falta.';
        case 'curar':
            return woundedOf(context.party ?? []).length > 0 ? '' : 'Nadie está herido.';
        case 'muertos': {
            const active = context.cases?.active;
            if (!active || active.kind !== 'asesinato') return 'No hay ningún muerto a quien preguntar.';
            return deadClue(context.cases) ? '' : `${text(active.victim) || 'El muerto'} ya no tiene nada más que decir.`;
        }
        case 'identify':
            return Number(context.unknownItems) > 0 ? '' : 'No lleváis nada sin identificar.';
        case 'alarm':
            return context.alarmSet ? 'La alarma ya está puesta para esta noche.' : '';
        default:
            return '';
    }
}

/**
 * Lo que hará aquí, en una frase.
 *
 * @param {string} kind
 * @param {import('./spell-catalogue.js').Spell} spell
 * @param {number} slotLevel
 * @param {any} member
 * @param {any} classRow
 * @param {FieldContext} context
 * @returns {string}
 */
function doesHere(kind, spell, slotLevel, member, classRow, context) {
    switch (kind) {
        case 'luz':
            return context.night
                ? `Alumbra la noche: +${LIGHT_LOOK_BONUS} a examinar mientras dure, y si acampáis cuenta como un fuego.`
                : context.dark
                    ? `Alumbra este sitio oscuro: +${LIGHT_LOOK_BONUS} a examinar aquí mientras dure.`
                    // De día y con luz, no decir «este sitio oscuro» junto a «aquí se ve bien».
                    : `Alumbra un sitio oscuro (de noche, una cueva, una cripta): +${LIGHT_LOOK_BONUS} a examinar allí mientras dure.`;
        case 'curar': {
            const up = upcastSpell(spell, slotLevel || spell.level);
            const mod = spell.addModifier ? spellcastingStats(member, classRow).modifier : 0;
            const formula = `${up.healing}${mod > 0 ? ` + ${mod}` : mod < 0 ? ` − ${-mod}` : ''}`;
            const hurt = woundedOf(context.party ?? []);
            if (up.targets > 1) return `Cura ${formula} a cada uno, hasta ${up.targets} de los tuyos.`;
            return hurt[0] ? `Cura ${formula} a ${text(hurt[0].name)}, que es quien más lo necesita.` : `Cura ${formula}.`;
        }
        case 'muertos':
            return `${text(context.cases?.active?.victim) || 'El muerto'} contesta con lo que sabía en vida: una pista de las buenas.`;
        case 'detect':
            return 'Dice qué de lo que lleváis tiene magia, y avisa de lo maldito.';
        case 'identify':
            return `Dice qué es cada cosa sin identificar${Number(context.unknownItems) > 0 ? ` (${Number(context.unknownItems)})` : ''}, como el templo.`;
        case 'alarm':
            return `Esta noche, +${ALARM_WATCH_BONUS} a la guardia del campamento.`;
        default:
            return text(spell.note);
    }
}

/**
 * Cómo se dice lo que cuesta.
 *
 * @param {'truco'|'espacio'|'ritual'} how
 * @param {number} slotLevel
 * @returns {string}
 */
export function describeCost(how, slotLevel) {
    if (how === 'truco') return 'Truco: no gasta nada';
    if (how === 'ritual') return 'Ritual: diez minutos, sin espacio';
    return `Un espacio de ${SLOT_LABELS[/** @type {1} */ (slotLevel)] ?? `nivel ${slotLevel}`}`;
}

/**
 * Lo que alguien puede lanzar fuera de combate, cada cosa con si se puede ahora y por qué no.
 * Primero los trucos y lo que gasta espacio (lo de esta tabla); luego sus rituales. Si un
 * conjuro sale como ritual, no sale además con espacio: fuera de combate nadie gasta un
 * espacio en lo que puede hacer gratis, y lo que impide el ritual (el material, que no haya
 * nada que identificar) impide igual el otro. Salía dos veces, y confundía.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any[]} input.catalogue Las filas de `conjuros.json`.
 * @param {any[]} [input.carried] Lo que lleva encima.
 * @param {FieldContext} [input.context]
 * @returns {FieldChoice[]}
 */
export function fieldChoices({ member, classRow, catalogue, carried = [], context = {} }) {
    /** @type {FieldChoice[]} */
    const rituals = ritualChoices({
        member, classRow, catalogue, inCombat: false, carried, others: context.others ?? [],
        state: { unknownItems: context.unknownItems, pet: context.pet, alarmSet: context.alarmSet },
    }).map(choice => ({
        id: choice.id,
        name: choice.name,
        kind: choice.kind,
        how: /** @type {'ritual'} */ ('ritual'),
        level: normalizeSpell((Array.isArray(catalogue) ? catalogue : []).find(row => text(row?.id) === choice.id)).level,
        slotLevel: 0,
        cost: describeCost('ritual', 0),
        minutes: choice.minutes,
        ok: choice.ok,
        reason: choice.reason,
        does: choice.note,
    }));
    const freeRituals = new Set(rituals.map(r => r.id));

    const { cantrips, spells } = castableSpells(member, classRow, catalogue);
    /** @type {FieldChoice[]} */
    const cast = [];
    for (const spell of [...cantrips, ...spells]) {
        const kind = fieldKind(spell);
        if (!kind || freeRituals.has(spell.id)) continue;
        const verdict = canCastSpell({ member, classRow, spell, inCombat: false, carried });
        const useless = verdict.ok ? uselessNow(kind, context) : '';
        const how = spell.level === 0 ? 'truco' : 'espacio';
        const slotLevel = verdict.ok ? verdict.slotLevel : spell.level;
        cast.push({
            id: spell.id,
            name: spell.name,
            kind,
            how,
            level: spell.level,
            slotLevel: how === 'truco' ? 0 : slotLevel,
            cost: describeCost(how, slotLevel),
            minutes: verdict.minutes,
            ok: verdict.ok && !useless,
            reason: verdict.ok ? useless : verdict.reason,
            does: doesHere(kind, spell, slotLevel, member, classRow, context),
        });
    }
    return [...cast, ...rituals];
}

/**
 * @typedef {Object} FieldCast
 * @property {boolean} ok
 * @property {string} reason
 * @property {string} kind
 * @property {number} slotLevel El espacio gastado (0: ninguno).
 * @property {Record<string, number>|null} slotsUsed Lo que queda apuntado en la ficha de quien lo lanza.
 * @property {string[]} consumes El material que se gasta.
 * @property {number} minutes
 * @property {string[]} lines Lo que se cuenta.
 * @property {{
 *   light?: {day: number, slotIndex: number, by: string},
 *   heal?: Array<{memberId: string, name: string, amount: number, hp: number}>,
 *   clue?: any,
 *   identify?: Array<{memberId: string, itemId: string, item: any}>,
 *   alarm?: {day: number},
 * }} effects Lo que cambia; lo aplica quien llama.
 */

/**
 * Lanzar un conjuro fuera de combate, con un espacio o como truco. (Los rituales, sin espacio,
 * los lanza `party/rituals.js`: aquí devuelven que no.)
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {any} input.spell Su fila de `conjuros.json` (o ya normalizada).
 * @param {any[]} [input.carried]
 * @param {FieldContext} [input.context]
 * @param {(formula: string) => number} [input.rollDice] Tira una fórmula de dados: «1d8».
 * @returns {FieldCast}
 */
export function castField({ member, classRow, spell: raw, carried = [], context = {}, rollDice = () => 1 }) {
    const spell = raw?.aliases && raw?.area ? raw : normalizeSpell(raw);
    /** @type {(reason: string) => FieldCast} */
    const no = (reason) => ({ ok: false, reason, kind: '', slotLevel: 0, slotsUsed: null, consumes: [], minutes: 0, lines: [], effects: {} });
    const kind = fieldKind(spell);
    if (!kind) return no(`${spell.name || 'Ese conjuro'} no sirve de nada fuera de una pelea.`);
    const verdict = canCastSpell({ member, classRow, spell, inCombat: false, carried });
    if (!verdict.ok) return no(verdict.reason);
    const useless = uselessNow(kind, context);
    if (useless) return no(useless);

    /** @type {Record<string, number>|null} */
    let slotsUsed = null;
    if (spell.level > 0) {
        const spent = spendSlot(member, classRow, verdict.slotLevel);
        if (!spent.ok) return no(spent.reason);
        slotsUsed = spent.slotsUsed;
    }
    const caster = text(member?.name) || 'Alguien';
    const party = Array.isArray(context.party) ? context.party : [];
    /** @type {FieldCast} */
    const out = {
        ok: true, reason: '', kind, slotLevel: spell.level > 0 ? verdict.slotLevel : 0, slotsUsed,
        consumes: verdict.consumes, minutes: verdict.minutes, lines: [], effects: {},
    };

    switch (kind) {
        case 'luz': {
            const day = Math.max(0, Math.floor(Number(context.calendar?.day) || 0));
            const slotIndex = Math.max(0, Math.floor(Number(context.calendar?.slotIndex) || 0));
            out.effects.light = { day, slotIndex, by: caster };
            out.lines.push(context.night
                ? `${caster} lanza ${spell.name}: una luz blanca que no parpadea, y todo queda alumbrado. Esta noche se examina mejor (+${LIGHT_LOOK_BONUS}) y, si acampáis, cuenta como un fuego.`
                : `${caster} lanza ${spell.name}: lo que estaba a oscuras se ve. Mientras dure, examinar aquí es más fácil (+${LIGHT_LOOK_BONUS}).`);
            break;
        }
        case 'curar': {
            const up = upcastSpell(spell, out.slotLevel || spell.level);
            const mod = spell.addModifier ? spellcastingStats(member, classRow).modifier : 0;
            /** @type {Array<{memberId: string, name: string, amount: number, hp: number}>} */
            const heal = [];
            for (const who of woundedOf(party).slice(0, up.targets)) {
                const rolled = Math.max(1, Math.floor(Number(rollDice(up.healing)) || 0) + mod);
                const before = Number(who.hp) || 0;
                const hp = Math.min(Number(who.maxHp) || before, before + rolled);
                heal.push({ memberId: String(who.id), name: text(who.name), amount: hp - before, hp });
            }
            out.effects.heal = heal;
            out.lines.push(`${caster} lanza ${spell.name}${out.slotLevel > spell.level ? ` con un espacio de ${SLOT_LABELS[/** @type {1} */ (out.slotLevel)]}` : ''}.`);
            out.lines.push(heal.map(h => `${h.name} recupera ${h.amount} (${h.hp} de vida)`).join('; ') + '.');
            break;
        }
        case 'muertos': {
            const clue = deadClue(context.cases);
            out.effects.clue = clue;
            out.lines.push(`${caster} se arrodilla junto a ${text(context.cases?.active?.victim) || 'el muerto'} y le hace sus preguntas. Contesta con lo que sabía en vida.`);
            break;
        }
        case 'detect':
            out.lines.push(...detectMagic({ caster, party }));
            break;
        case 'identify': {
            const done = identifyAll({ caster, party });
            out.effects.identify = done.changes;
            out.lines.push(...done.lines);
            break;
        }
        case 'alarm': {
            const done = setAlarm({ caster, calendar: context.calendar });
            out.effects.alarm = done.alarm;
            out.lines.push(...done.lines);
            break;
        }
        default:
            break;
    }
    return out;
}

/**
 * «Curar en el viaje»: al llegar, lo más barato del grupo para curar a los heridos. Nada si
 * nadie está herido o nadie puede.
 *
 * @param {Array<{member: any, choices: FieldChoice[]}>} casters
 * @returns {{member: any, choice: FieldChoice}|null}
 */
export function roadHeal(casters) {
    const options = (Array.isArray(casters) ? casters : [])
        .flatMap(({ member, choices }) => (choices ?? []).filter(c => c.kind === 'curar' && c.ok).map(choice => ({ member, choice })))
        .sort((a, b) => a.choice.slotLevel - b.choice.slotLevel || b.choice.level - a.choice.level);
    return options[0] ?? null;
}

/**
 * Los rituales que alguien tiene a mano, para quien quiera saber si listarlos.
 *
 * @param {any} member
 * @param {any} classRow
 * @param {any[]} catalogue
 * @returns {number}
 */
export function ritualCount(member, classRow, catalogue) {
    return ritualSpells(member, classRow, catalogue).length;
}
