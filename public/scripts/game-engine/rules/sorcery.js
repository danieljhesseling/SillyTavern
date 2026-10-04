/**
 * El hechicero de 2024: sus puntos de hechicería y lo que hace con ellos (la Metamagia), y la
 * Magia innata (wiki/gemini/ROADMAP_CONTENIDO_DND.md, fase 2).
 *
 * - **Puntos de hechicería**: desde el nivel 2, tantos como su nivel. Se gastan en la Metamagia
 *   y vuelven con el descanso largo. Se guardan en `abilityUses` con la clave
 *   `puntos-hechiceria`, así que el descanso largo los devuelve sin tocar nada más
 *   (`restoreAbilityUses` borra todo con el largo y, con el corto, solo lo de descanso corto).
 * - **Metamagia**: son habilidades de `habilidades.json` con `sorceryCost` (lo que cuestan en
 *   puntos). Dejan un estado en quien las usa, que cambia su próximo conjuro:
 *   - **Conjuro rápido** (2 puntos): un conjuro de una acción se lanza con la acción adicional.
 *   - **Conjuro cuidadoso** (1 punto): un conjuro de área no toca a los suyos.
 *   El estado se va al lanzar ese conjuro, o al acabar el turno.
 * - **Magia innata** (nivel 1, dos veces por descanso largo): durante un minuto, +1 a la CD de
 *   sus conjuros y ventaja al atacar con ellos.
 *
 * Puro: cuenta y dice. Quien llama guarda la ficha.
 */

/** Dónde se apuntan los puntos gastados, dentro de `abilityUses`. */
export const SORCERY_POOL = 'puntos-hechiceria';

/** Los estados que dejan la Magia innata y la Metamagia. */
export const INNATE_SORCERY = 'Magia innata';
export const QUICKENED = 'Conjuro rápido';
export const CAREFUL = 'Conjuro cuidadoso';

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Si es hechicero (o hechicera), por su clase.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isSorcerer(member) {
    return /^(hechicer|sorcer)/.test(plain(member?.class ?? member?.charClass ?? member?.className));
}

/**
 * Cuántos puntos tiene en total: su nivel, desde el 2.
 *
 * @param {any} member
 * @returns {number}
 */
export function sorceryMax(member) {
    if (!isSorcerer(member)) return 0;
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    return level >= 2 ? level : 0;
}

/**
 * Los que le quedan.
 *
 * @param {any} member
 * @returns {number}
 */
export function sorceryLeft(member) {
    const spent = Math.max(0, Math.floor(Number(member?.abilityUses?.[SORCERY_POOL]) || 0));
    return Math.max(0, sorceryMax(member) - spent);
}

/**
 * Gastar puntos, como parche de `abilityUses`.
 *
 * @param {any} member
 * @param {number} cost
 * @returns {Record<string, number>}
 */
export function spendSorcery(member, cost) {
    const uses = { ...(member?.abilityUses ?? {}) };
    const spent = Math.max(0, Math.floor(Number(uses[SORCERY_POOL]) || 0));
    uses[SORCERY_POOL] = Math.min(sorceryMax(member), spent + Math.max(0, Math.floor(Number(cost) || 0)));
    return uses;
}

/**
 * Los puntos en una línea, para la ficha. Vacío si no tiene.
 *
 * @param {any} member
 * @returns {string}
 */
export function describeSorcery(member) {
    const max = sorceryMax(member);
    return max > 0 ? `Puntos de hechicería: ${sorceryLeft(member)}/${max}` : '';
}

/**
 * Si lleva ese estado ahora.
 *
 * @param {any} member
 * @param {string} condition
 * @returns {boolean}
 */
export function hasCondition(member, condition) {
    return (Array.isArray(member?.activeConditions) ? member.activeConditions : []).map(String).includes(condition);
}

/**
 * Un conjuro suyo ya hecho habilidad (`spellToAbility`), con lo que le cambia su Metamagia:
 * con Conjuro rápido, el de una acción va con la acción adicional.
 *
 * @template {Record<string, any>} T
 * @param {T} ability
 * @param {any} member
 * @returns {T}
 */
export function withMetamagic(ability, member) {
    if (!ability || typeof ability.spellLevel !== 'number') return ability;
    if (ability.cost === 'action' && hasCondition(member, QUICKENED)) return { ...ability, cost: 'bonus', quickened: true };
    return ability;
}

/**
 * Lo que queda de sus estados después de lanzar un conjuro: el Conjuro rápido se va si lo
 * ha usado, y el cuidadoso, con el primer conjuro de área.
 *
 * @param {any} member
 * @param {Record<string, any>} ability
 * @returns {string[]|null} Los estados que le quedan, o null si no cambia nada.
 */
export function afterMetamagic(member, ability) {
    if (!ability || typeof ability.spellLevel !== 'number') return null;
    const now = (Array.isArray(member?.activeConditions) ? member.activeConditions : []).map(String);
    const area = Boolean(ability.area && ability.area.shape && ability.area.shape !== 'single');
    const drop = new Set([...(ability.quickened ? [QUICKENED] : []), ...(area ? [CAREFUL] : [])]);
    const left = now.filter(c => !drop.has(c));
    return left.length === now.length ? null : left;
}

/**
 * Con Conjuro cuidadoso, los suyos no los toca un conjuro de área que hace daño.
 *
 * @template {{kind: string}} V
 * @param {any} actor
 * @param {string} side El bando de quien lo lanza.
 * @param {Record<string, any>} ability
 * @param {V[]} victims
 * @returns {V[]}
 */
export function carefulVictims(actor, side, ability, victims) {
    const area = Boolean(ability?.area?.shape && ability.area.shape !== 'single');
    if (!area || ability?.target === 'ally' || typeof ability?.spellLevel !== 'number' || !hasCondition(actor, CAREFUL)) return victims;
    return victims.filter(v => v.kind !== side);
}
