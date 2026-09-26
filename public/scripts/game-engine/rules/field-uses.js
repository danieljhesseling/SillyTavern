/**
 * Las habilidades fuera del combate: cada una enganchada a un sistema que ya existe (R3 del
 * roadmap de profundidad).
 *
 * *Leer el rastro* no ayudaba a viajar, *Mano de ganzúa* no abría las cerraduras de la idea
 * 77 y la *Burla que escuece* no era una carta del Duelo de Palabras. Saber hacer algo tiene
 * que notarse también cuando no hay nadie a quien pegar.
 *
 * | Habilidad | Dónde | Qué hace |
 * | :--- | :--- | :--- |
 * | Leer el rastro | el viaje | Un día menos en los viajes de dos o más |
 * | Mano de ganzúa | las cerraduras | +5 a abrirlas |
 * | Dar la voz | el campamento | +2 a la guardia |
 * | Burla que escuece | el duelo | Una carta que no se tira: intimida |
 * | Palabra de ánimo | el duelo | Una carta que devuelve aplomo |
 * | Primeros auxilios | después del combate | Cura 1d4 a quien quedó en el suelo |
 *
 * La magia de R4 añade sus filas aquí, y un conjuro fuera del combate **gasta su carga**
 * como dentro: la *Luz* en el campamento (un truco, gratis), *Paso sin rastro* en el camino,
 * *Detectar mentiras* y *Encanto* hablando, *Hablar con los muertos* en un caso.
 *
 * Puro: quién sabe qué y cuánto suma. Lo aplica quien llama, cada uno en su sitio.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R3.
 */

import { spellById, chargesLeft } from './grimoire.js';

/**
 * @typedef {Object} FieldEffect
 * @property {number} [travelDaysOff]
 * @property {number} [lockBonus]
 * @property {number} [watchBonus]
 * @property {string} [patchUp] Fórmula de lo que cura tras el combate.
 * @property {{label: string, as: string, power: number, composure?: number, spell?: string, risky?: boolean}} [card] Una carta del duelo.
 * @property {boolean} [campLight] R4: alumbra el campamento como un fuego.
 * @property {boolean} [hideTrail] R4: los cazarrecompensas del camino no os encuentran.
 * @property {boolean} [deadTalk] R4: en un asesinato, el muerto da una pista.
 */

/**
 * @typedef {Object} FieldUse
 * @property {string} where Dónde se nota: `viaje`, `cerradura`, `campamento`, `duelo`, `combate`.
 * @property {string} note Lo que hace, dicho para quien juega.
 * @property {FieldEffect} effect
 */

/** @type {Record<string, FieldUse>} */
export const FIELD_USES = {
    'hab-rastrear': { where: 'viaje', note: 'Un día menos en los viajes de dos o más: encuentra el atajo.', effect: { travelDaysOff: 1 } },
    'hab-ganzua': { where: 'cerradura', note: '+5 a abrir cerraduras.', effect: { lockBonus: 5 } },
    'hab-gritar': { where: 'campamento', note: '+2 a la guardia: nadie os pilla dormidos.', effect: { watchBonus: 2 } },
    'hab-burla': {
        where: 'duelo', note: 'En una conversación, una burla que no se tira: intimida.',
        effect: { card: { label: 'Soltarle una burla que escuece', as: 'intimidar', power: 4 } },
    },
    'hab-animo': {
        where: 'duelo', note: 'En una conversación, una palabra a los tuyos: recuperáis aplomo.',
        effect: { card: { label: 'Una palabra de ánimo a los tuyos', as: 'persuadir', power: 1, composure: 2 } },
    },
    'hab-primeros-auxilios': { where: 'combate', note: 'Al acabar un combate, cura 1d4 a quien quedó en el suelo.', effect: { patchUp: '1d4' } },
    // R4: la magia fuera del combate. Gasta su carga (la Luz es un truco: no gasta).
    'mag-luz': { where: 'campamento', note: 'Una luz que no se apaga: la noche da menos miedo, aunque no haya fuego.', effect: { campLight: true } },
    'mag-paso-sin-rastro': { where: 'viaje', note: 'Nadie os sigue el rastro: los cazarrecompensas no os encuentran (una carga).', effect: { hideTrail: true } },
    'mag-detectar-mentiras': {
        where: 'duelo', note: 'Hablando, se sabe si miente (una carga).',
        effect: { card: { label: 'Saber si miente (Detectar mentiras)', as: 'prueba', power: 4, spell: 'mag-detectar-mentiras' } },
    },
    'mag-encanto': {
        where: 'duelo', note: 'Hablando, encantarle: pesa mucho, y si no cede, os tiene ganas (una carga).',
        effect: { card: { label: 'Encantarle (Encanto)', as: 'persuadir', power: 6, spell: 'mag-encanto', risky: true } },
    },
    'mag-hablar-muertos': { where: 'caso', note: 'En un asesinato, el muerto contesta: una pista (una carga y polvo de hueso).', effect: { deadTalk: true } },
};

/** Cómo se llama cada sitio. */
export const WHERE_LABELS = {
    viaje: 'en el camino',
    cerradura: 'con las cerraduras',
    campamento: 'en el campamento',
    duelo: 'hablando',
    combate: 'después de pelear',
    caso: 'con un caso',
};

/**
 * Si alguien puede usar ahora algo que sabe: una técnica, siempre; un conjuro, si le quedan
 * cargas de su círculo (los trucos no gastan).
 *
 * @param {any} member
 * @param {string} id
 * @returns {boolean}
 */
function ready(member, id) {
    const spell = spellById(id);
    return !spell || chargesLeft(member, spell.circle) > 0;
}

/**
 * @param {any} member
 * @returns {string[]}
 */
function abilitiesOf(member) {
    return (Array.isArray(member?.abilities) ? member.abilities : [])
        .map((/** @type {any} */ a) => String(typeof a === 'string' ? a : a?.id ?? ''))
        .filter(Boolean)
        .filter(id => ready(member, id));
}

/**
 * @param {any} member
 * @returns {boolean}
 */
function standing(member) {
    return !member?.dead && (Number(member?.hp) || 0) > 0;
}

/**
 * Quién del grupo sabe usar algo fuera del combate, y para qué.
 *
 * @param {any[]} party
 * @returns {Array<{id: string, who: string, where: string, note: string}>}
 */
export function fieldUsesOf(party) {
    /** @type {Array<{id: string, who: string, where: string, note: string}>} */
    const out = [];
    for (const member of Array.isArray(party) ? party : []) {
        if (member?.dead) continue;
        for (const id of abilitiesOf(member)) {
            const use = FIELD_USES[id];
            if (use) out.push({ id, who: String(member.name ?? ''), where: use.where, note: use.note });
        }
    }
    return out;
}

/**
 * El mejor de un efecto en todo el grupo (de pie), y quién lo pone.
 *
 * @param {any[]} party
 * @param {keyof FieldEffect} key
 * @returns {{amount: number, who: string}}
 */
function best(party, key) {
    let amount = 0;
    let who = '';
    for (const member of Array.isArray(party) ? party : []) {
        if (!standing(member)) continue;
        for (const id of abilitiesOf(member)) {
            const value = Number(FIELD_USES[id]?.effect?.[key]) || 0;
            if (value > amount) {
                amount = value;
                who = String(member.name ?? '');
            }
        }
    }
    return { amount, who };
}

/**
 * Cuántos días menos cuesta un viaje, y quién lo consigue. Solo en los de dos o más: un
 * paseo de un día no tiene atajo que encontrar.
 *
 * @param {any[]} party
 * @param {number} days
 * @returns {{days: number, who: string, line: string}}
 */
export function travelShortcut(party, days) {
    const total = Math.max(0, Math.floor(Number(days) || 0));
    const { amount, who } = best(party, 'travelDaysOff');
    if (amount <= 0 || total < 2) return { days: total, who: '', line: '' };
    const cut = Math.min(amount, total - 1);
    return { days: total - cut, who, line: `${who} lee el rastro y encuentra un atajo: ${cut === 1 ? 'un día' : `${cut} días`} menos.` };
}

/**
 * Lo que suma alguien a abrir una cerradura.
 *
 * @param {any} member
 * @returns {number}
 */
export function lockBonus(member) {
    return best([member], 'lockBonus').amount;
}

/**
 * Lo que suma el grupo a la guardia del campamento, y quién.
 *
 * @param {any[]} party
 * @returns {{amount: number, who: string}}
 */
export function watchBonus(party) {
    return best(party, 'watchBonus');
}

/**
 * Las cartas del duelo que da lo que sabe hacer quien habla.
 *
 * @param {any} member
 * @returns {Array<{id: string, kind: 'truco', label: string, as: string, power: number, composure?: number}>}
 */
export function duelTricks(member) {
    return abilitiesOf(member)
        .filter(id => FIELD_USES[id]?.effect?.card)
        .map(id => {
            const card = /** @type {NonNullable<FieldEffect['card']>} */ (FIELD_USES[id].effect.card);
            return {
                id: `truco:${id}`, kind: /** @type {'truco'} */ ('truco'), label: card.label, as: card.as, power: card.power,
                ...(card.composure ? { composure: card.composure } : {}),
                // R4: una carta de conjuro gasta su carga al jugarla; y la arriesgada se nota.
                ...(card.spell ? { spell: card.spell } : {}),
                ...(card.risky ? { risky: true } : {}),
            };
        });
}

/**
 * Quién del grupo (de pie) sabe algo con este efecto y puede usarlo ahora.
 *
 * @param {any[]} party
 * @param {'campLight'|'hideTrail'|'deadTalk'} key
 * @returns {{who: any, id: string}|null}
 */
export function whoCan(party, key) {
    for (const member of Array.isArray(party) ? party : []) {
        if (!standing(member)) continue;
        for (const id of abilitiesOf(member)) {
            if (FIELD_USES[id]?.effect?.[key]) return { who: member, id };
        }
    }
    return null;
}

/**
 * Quién cura tras el combate, y con qué.
 *
 * @param {any[]} party
 * @returns {{who: string, formula: string}|null}
 */
export function patchUpAfterFight(party) {
    for (const member of Array.isArray(party) ? party : []) {
        if (!standing(member)) continue;
        for (const id of abilitiesOf(member)) {
            const formula = FIELD_USES[id]?.effect?.patchUp;
            if (formula) return { who: String(member.name ?? ''), formula };
        }
    }
    return null;
}
