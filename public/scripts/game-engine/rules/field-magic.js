/**
 * La magia fuera de combate (J19.10 de wiki/ROADMAP_SIN_CONEXION.md): los conjuros que
 * sirven cuando no hay nadie a quien pegar, cada uno enchufado a algo que ya existe.
 *
 * | Conjuro | Qué hace | Dónde se nota |
 * | :--- | :--- | :--- |
 * | Luz, Luz del día | Alumbra esta parte del día | La noche en el campamento cuenta como con fuego; en un sitio oscuro, +2 a examinar |
 * | Curar heridas, Palabra de curación, Plegaria de curación… | Cura a los heridos | La vida de la ficha, entre pelea y pelea o al llegar de un viaje |
 * | Hablar con los muertos | La víctima de un asesinato contesta, una vez cada siete días (D-J50) | Una pista de las buenas del caso abierto (`cases.js`) |
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
import { gendered } from '../campaign/grammar.js';

/** Los conjuros que no se deducen de sus columnas. */
export const FIELD_SPELL_IDS = { 'mag-hablar-muertos': 'muertos' };

/** Los de ritual que también se pueden lanzar con un espacio, fuera de combate. */
const SLOT_RITUAL_KINDS = ['detect', 'identify', 'alarm'];

/** Lo que suma la Luz a examinar en un sitio oscuro. */
export const LIGHT_LOOK_BONUS = 2;

/**
 * D-J50: cada cuántos días se le puede volver a preguntar al mismo muerto con Hablar con los
 * muertos. En la mesa son diez; Daniel lo dejó en siete.
 */
export const SPEAK_DEAD_DAYS = 7;

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
 * @property {Record<string, number>} [spokenDead] D-J50: el día en que se le preguntó a cada muerto
 *   (`deadKey`), para no volver a preguntarle hasta que pasen `SPEAK_DEAD_DAYS`.
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
 * @property {number} [targets] Si cura, a cuántos de los tuyos (D-J53).
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
 * D-J51: los sitios del pueblo bajo techo que ya tienen luz (velas, un fuego, la fragua): ahí la
 * Luz no se ofrece, ni de noche. La plaza, el tablón y el muelle son al raso.
 */
export const LIT_PLACES = ['gremio', 'posada', 'taberna', 'tienda', 'templo', 'herreria'];

/** D-J51: los tableros bajo techo con luz: el interior de madera (una taberna, una casa). */
const LIT_BIOMES = ['madera'];

/**
 * D-J51: si un sitio del pueblo (`posada`, `posada-2`, `herreria`…) está bajo techo y con luz.
 *
 * @param {string} place El id del sitio abierto del pueblo (`currentTownPlace`), o vacío.
 * @returns {boolean}
 */
export function litIndoors(place) {
    const kind = text(place).toLowerCase().replace(/-\d+$/, '');
    return LIT_PLACES.includes(kind);
}

/**
 * Si aquí no se ve sin luz. D-J51: en una cueva, una cripta o una mazmorra, siempre; bajo techo
 * con luz (la posada, la tienda, el templo, la herrería, el gremio, un tablero de madera), nunca;
 * y al raso (el camino, la plaza, el campamento), de noche.
 *
 * @param {{night?: boolean, biome?: string, type?: string, place?: string}} where `place`: el sitio
 *   del pueblo en el que se está (`litIndoors`); `biome`: el del tablero o el de la localización.
 * @returns {boolean}
 */
export function darkHere({ night = false, biome = '', type = '', place = '' } = {}) {
    const said = text(biome).toLowerCase();
    if (DARK_BIOMES.includes(said)) return true;
    if (litIndoors(place) || LIT_BIOMES.includes(said)) return false;
    return Boolean(night) || text(type) === 'dungeon';
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
 * D-J50: cómo se apunta a un muerto: su caso y su nombre. El mismo muerto de otro caso es otro.
 *
 * @param {any} active El caso abierto.
 * @returns {string}
 */
export function deadKey(active) {
    return `${text(active?.id)}|${text(active?.victim)}`.toLowerCase();
}

/**
 * D-J50: cuántos días faltan para poder volver a preguntarle al muerto del caso abierto. 0: ya
 * se puede (o nunca se le preguntó).
 *
 * @param {any} cases Los casos (`readCases`).
 * @param {Record<string, number>|null|undefined} spokenDead Lo apuntado (`FieldContext.spokenDead`).
 * @param {number} today
 * @returns {number}
 */
export function speakDeadWait(cases, spokenDead, today) {
    const active = cases?.active;
    if (!active) return 0;
    const asked = Math.floor(Number(spokenDead?.[deadKey(active)]) || 0);
    const now = Math.floor(Number(today) || 0);
    if (asked <= 0 || now <= 0) return 0;
    return Math.max(0, asked + SPEAK_DEAD_DAYS - now);
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
        case 'luz': {
            if (lightActive(context.light, context.calendar)) return 'Ya hay una Luz encendida.';
            // D-J51: quien dice si está oscuro es `dark` (`darkHere`: de noche solo al raso). Sin
            // él, la noche, como antes.
            const dark = typeof context.dark === 'boolean' ? context.dark : Boolean(context.night);
            if (dark) return '';
            return context.night ? 'Aquí dentro ya hay luz: no hace falta.' : 'Aquí se ve bien: ahora no hace falta.';
        }
        case 'curar':
            return woundedOf(context.party ?? []).length > 0 ? '' : 'Nadie está herido.';
        case 'muertos': {
            const active = context.cases?.active;
            if (!active || active.kind !== 'asesinato') return 'No hay ningún muerto a quien preguntar.';
            if (!deadClue(context.cases)) return `${text(active.victim) || 'El muerto'} ya no tiene nada más que decir.`;
            // D-J50: al mismo muerto, una vez cada siete días. Se dice cuándo, y no se gasta nada.
            const wait = speakDeadWait(context.cases, context.spokenDead, context.calendar?.day);
            if (wait <= 0) return '';
            const who = text(active.victim) || 'Este muerto';
            return `${who} ya contestó hace poco. Se le puede volver a preguntar ${wait === 1 ? 'mañana' : `dentro de ${wait} días`}.`;
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
            // D-J53: a cuántos cura, para decir a quién en la pregunta de al llegar.
            ...(kind === 'curar' ? { targets: Math.max(1, upcastSpell(spell, (how === 'truco' ? 0 : slotLevel) || spell.level).targets || 1) } : {}),
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
 *   spokeDead?: {key: string, day: number},
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
            // D-J50: se apunta el día, para no volver a preguntarle hasta dentro de siete.
            out.effects.spokeDead = { key: deadKey(context.cases?.active), day: Math.max(0, Math.floor(Number(context.calendar?.day) || 0)) };
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
 * @typedef {Object} ArrivalHealAsk D-J53: la pregunta de «curar al llegar», en llano.
 * @property {string} healer Quien lo lanza.
 * @property {boolean} yours Si lo lanza tu héroe.
 * @property {string[]} names A quién cura, del más herido al menos.
 * @property {string[]} notes Cómo llega cada uno y quién puede curarle: «Bran llega herido: le quedan 5 de 20.».
 * @property {string} question «¿Curar a Bran con magia? (gasta un espacio de nivel 1)».
 */

/**
 * D-J53: al llegar de un viaje con alguien herido y alguien que cura con magia, lo que se
 * pregunta. Nada si nadie está herido o nadie puede (`roadHeal`).
 *
 * @param {{member: any, choice: FieldChoice}|null} pick Lo que curaría (`roadHeal`).
 * @param {any[]} party El grupo, con tu héroe primero.
 * @returns {ArrivalHealAsk|null}
 */
export function arrivalHealAsk(pick, party) {
    if (!pick?.choice || pick.choice.kind !== 'curar' || !pick.choice.ok) return null;
    const hurt = woundedOf(party).slice(0, Math.max(1, Number(pick.choice.targets) || 1));
    if (hurt.length === 0) return null;
    const names = hurt.map(m => text(m.name) || 'Alguien');
    const list = names.length === 1 ? `a ${names[0]}` : `${names.slice(0, -1).map(n => `a ${n}`).join(', ')} y a ${names[names.length - 1]}`;
    const cost = pick.choice.how === 'truco' ? 'es un truco: no gasta nada' : `gasta un espacio de nivel ${Math.max(1, Number(pick.choice.slotLevel) || 1)}`;
    const healer = text(pick.member?.name) || 'Alguien';
    const yours = Array.isArray(party) && party[0] === pick.member;
    const notes = hurt.map(m => `${text(m.name) || 'Alguien'} llega ${gendered(m, 'herido', 'herida', 'herido')}: le quedan ${Math.max(0, Number(m.hp) || 0)} de ${Math.max(0, Number(m.maxHp) || 0)} de vida.`);
    notes.push(yours ? `Puedes curar con ${pick.choice.name}.` : `${healer} puede curar con ${pick.choice.name}.`);
    return { healer, yours, names, notes, question: `¿Curar ${list} con magia? (${cost})` };
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
