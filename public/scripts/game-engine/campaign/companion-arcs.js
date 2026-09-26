/**
 * Compañeros con arco: lo que cambia en alguien cuando se cumple lo suyo, los confidentes
 * que ayudan sin venir, y quien se fue y vuelve (R8 del roadmap de profundidad).
 *
 * - **Lo personal abre algo** (idea 30): cumplir el encargo personal de un compañero le deja
 *   un rasgo que solo tiene él, según lo que busca. Su historia cambia lo que sabe hacer.
 * - **Confidentes que no pelean** (era la P14): la gente del mundo que os aprecia (idea 140,
 *   actitud +2 o más) os hace favores de su oficio: la posadera no cobra una noche, el
 *   tendero rebaja, el herrero cobra menos, el templo cura, y los demás avisan.
 * - **Los que se fueron vuelven** (idea 29): quien se marchó harto puede reaparecer semanas
 *   después, cambiado, con los disgustos olvidados.
 *
 * Puro: decide. Quien llama aplica, guarda y cuenta.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R8.
 */

/**
 * El rasgo que deja cumplir lo suyo, por lo que busca. Con los efectos de siempre
 * (`level-perks.js`), así que se nota en los mismos sitios.
 *
 * @type {Array<{id: string, wants: string, label: string, describe: string, effect: Record<string, any>, branch: string, tier: number}>}
 */
export const ARC_PERKS = [
    { id: 'arco:coin', wants: 'coin', label: 'Buen ojo', describe: '+2 a Persuasión: los tratos le salen mejor.', effect: { skill: 'persuasion', amount: 2 }, branch: 'arco', tier: 1 },
    { id: 'arco:glory', wants: 'glory', label: 'Sin miedo', describe: '+1 al ataque: ya no tiene nada que demostrar.', effect: { attack: 1 }, branch: 'arco', tier: 1 },
    { id: 'arco:blood', wants: 'blood', label: 'Primero en entrar', describe: '+2 a la iniciativa: la cuenta que tenía, saldada.', effect: { initiative: 2 }, branch: 'arco', tier: 1 },
    { id: 'arco:quiet', wants: 'quiet', label: 'Temple sereno', describe: '+1 a la CA: ya no le tiembla el pulso.', effect: { armorClass: 1 }, branch: 'arco', tier: 1 },
    { id: 'arco:knowledge', wants: 'knowledge', label: 'Saber viejo', describe: '+2 a Investigación: sabe dónde mirar.', effect: { skill: 'investigation', amount: 2 }, branch: 'arco', tier: 1 },
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que le deja a alguien cumplir lo suyo, como parche para la ficha. Una vez.
 *
 * @param {any} member
 * @param {string} wants
 * @returns {{perks: string[], line: string}|null}
 */
export function completeArc(member, wants) {
    const perk = ARC_PERKS.find(p => p.wants === text(wants));
    if (!perk) return null;
    const had = Array.isArray(member?.perks) ? member.perks.map(String) : [];
    if (had.some(id => id.startsWith('arco:'))) return null;
    return {
        perks: [...had, perk.id],
        line: `${text(member?.name) || 'Alguien'} ya no es quien era: ${perk.label.toLowerCase()} (${perk.describe})`,
    };
}

/** La actitud desde la que alguien del mundo os hace favores (idea 140). */
export const FAVOR_ATTITUDE = 2;

/**
 * Los favores de cada oficio. `discount` es lo que rebaja; `free` es lo que no cobra una vez
 * por semana; `tell` es que avisa de lo que viene.
 */
export const HOME_FAVORS = {
    posada: { favor: 'una noche gratis por semana', free: 'posada' },
    tienda: { favor: 'un 10 % menos en la tienda', discount: 0.1, on: 'tienda' },
    herreria: { favor: 'la herrería un 25 % más barata', discount: 0.25, on: 'herreria' },
    templo: { favor: 'curar una herida gratis por semana', free: 'templo' },
    otro: { favor: 'os avisa de lo que viene', tell: true },
};

/**
 * @param {string} service
 * @returns {keyof typeof HOME_FAVORS}
 */
function favorKind(service) {
    const s = text(service).toLowerCase();
    if (/posad|taberna|mesón|meson/.test(s)) return 'posada';
    if (/tienda|mercad|botica/.test(s)) return 'tienda';
    if (/herrer|forja/.test(s)) return 'herreria';
    if (/templo|capilla|ermita|sanador/.test(s)) return 'templo';
    return 'otro';
}

/**
 * Los favores de la gente de aquí que os aprecia.
 *
 * @param {Object} input
 * @param {Array<{name: string, where: string, service?: string, dead?: boolean}>} input.npcs
 * @param {{values?: Record<string, number>}|null} input.attitudes
 * @param {string} input.here
 * @returns {Array<{name: string, kind: string, favor: string, discount?: number, on?: string, free?: string, tell?: boolean}>}
 */
export function homeFavors({ npcs, attitudes, here }) {
    const values = attitudes?.values ?? {};
    return (Array.isArray(npcs) ? npcs : [])
        .filter(n => n && !n.dead && text(n.where).toLowerCase() === text(here).toLowerCase() && (Number(values[n.name]) || 0) >= FAVOR_ATTITUDE)
        .map(n => {
            const kind = favorKind(String(n.service ?? ''));
            return { name: n.name, kind, ...HOME_FAVORS[kind] };
        });
}

/**
 * Lo que rebaja la gente que os aprecia en un sitio, para un servicio.
 *
 * @param {ReturnType<typeof homeFavors>} favors
 * @param {string} on `tienda` o `herreria`.
 * @returns {{discount: number, who: string}}
 */
export function favorDiscount(favors, on) {
    const best = (Array.isArray(favors) ? favors : []).filter(f => f.on === on).sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))[0];
    return best ? { discount: best.discount ?? 0, who: best.name } : { discount: 0, who: '' };
}

/** Cuándo puede volver quien se fue, y con qué probabilidad cada semana. */
export const COMEBACK = { afterDays: 14, chance: 0.3 };

/**
 * @typedef {Object} GoneMember
 * @property {any} sheet La ficha tal como se fue.
 * @property {string} name
 * @property {number} day
 * @property {string} why
 */

/**
 * @param {any} raw
 * @returns {GoneMember[]}
 */
export function readGone(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(g => g && text(g.name) && g.sheet && typeof g.sheet === 'object')
        .map(g => ({ sheet: g.sheet, name: text(g.name), day: Math.max(1, Math.floor(Number(g.day) || 1)), why: text(g.why) }));
}

/**
 * Apuntar a quien se va, con su ficha. Como mucho los tres últimos.
 *
 * @param {any} raw
 * @param {any} member
 * @param {number} day
 * @param {string} [why]
 * @returns {GoneMember[]}
 */
export function noteGone(raw, member, day, why = 'harto') {
    const list = readGone(raw).filter(g => g.name !== text(member?.name));
    return [...list, { sheet: structuredClone(member), name: text(member?.name), day: Math.max(1, Math.floor(Number(day) || 1)), why }].slice(-3);
}

/**
 * Si vuelve alguien esta semana, y quién.
 *
 * @param {Object} input
 * @param {any} input.raw
 * @param {number} input.today
 * @param {() => number} input.random
 * @returns {GoneMember|null}
 */
export function whoComesBack({ raw, today, random }) {
    const ready = readGone(raw).filter(g => today - g.day >= COMEBACK.afterDays);
    if (ready.length === 0 || !(random() < COMEBACK.chance)) return null;
    return ready[0];
}

/**
 * Cómo vuelve: su ficha, con los disgustos olvidados y sin la cuenta de semanas sin cobrar.
 *
 * @param {GoneMember} gone
 * @returns {{member: any, line: string, forModel: string}}
 */
export function comebackOf(gone) {
    const member = { ...structuredClone(gone.sheet), unpaidWeeks: 0 };
    return {
        member,
        line: `${gone.name} vuelve. Ha pasado tiempo y algo ha cambiado: se queda, si le dejáis.`,
        forModel: `[VUELVE] ${gone.name}, que se fue ${gone.why === 'sin cobrar' ? 'porque no cobraba' : 'harto'}, vuelve al grupo semanas después. Cuenta el reencuentro en tres o cuatro frases: qué ha hecho, qué ha cambiado. No inventes nada más.`,
    };
}

/**
 * Quitar de la lista a quien ha vuelto.
 *
 * @param {any} raw
 * @param {string} name
 * @returns {GoneMember[]}
 */
export function forgetGone(raw, name) {
    return readGone(raw).filter(g => g.name !== text(name));
}
