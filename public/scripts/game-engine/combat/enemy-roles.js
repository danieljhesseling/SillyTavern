/**
 * Enemigos con cabeza: cada uno tiene un papel, y su bando una forma de pelear (R7 del
 * roadmap de profundidad).
 *
 * La IA de siempre ya sabía acercarse, disparar de lejos, cubrir al herido o huir (los
 * perfiles de `enemy-ai.js`). Esto le pone encima lo que hace que una banda parezca una
 * banda y no cinco enemigos sueltos:
 *
 * - **Papeles**: el **tanque** va a por el más cercano; el **tirador**, a por el más débil
 *   que tenga a tiro; el **sanador** se queda detrás; el **líder** empuja a los suyos (+1 al
 *   ataque de quien tiene cerca) y, si cae, a los demás les tiembla el pulso.
 * - **Tácticas de bando**: los lobos rodean (buscan el flanco); la infantería forma línea
 *   (se pega a los suyos); los cultistas protegen al que lanza.
 * - **Moral**: además de rendirse (idea 6), con el líder caído y malheridos, huyen.
 *
 * Puro: decide papeles, bonos y preferencias. Mover y pegar es de `enemy-ai.js` y
 * `party.js`.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R7.
 */

/** Los papeles, con lo que hacen. */
export const ROLES = {
    tanque: { label: 'tanque', note: 'Va a por el más cercano y aguanta.', profile: 'aggressive' },
    tirador: { label: 'tirador', note: 'A por el más débil que tenga a tiro, desde lejos.', profile: 'skirmisher' },
    sanador: { label: 'sanador', note: 'Se queda detrás y cura a los suyos.', profile: 'guardian' },
    lider: { label: 'líder', note: 'Empuja a los suyos: +1 al ataque de quien tiene cerca. Si cae, tiemblan.', profile: 'aggressive' },
    bruto: { label: 'bruto', note: 'Pega a lo que tenga delante.', profile: 'aggressive' },
};

/** Las tácticas de cada bando, por palabras de su nombre o sus etiquetas. */
export const TACTICS = [
    { id: 'rodear', match: /lobo|huargo|manada|chacal|hiena/, note: 'Rodean: buscan el flanco antes de morder.' },
    { id: 'linea', match: /infanter|soldad|guardia|keller|legion|milicia/, note: 'Forman línea: se pegan a los suyos.' },
    { id: 'proteger', match: /cultist|acolit|sectari|nigromant|brujo/, note: 'Protegen al que lanza: se ponen delante.' },
];

/** Lo que suma el líder a quien tiene cerca, y hasta dónde llega su voz. */
export const LEADER_AURA = { attack: 1, feet: 10 };

/** @param {any} value @returns {string} */
const plain = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El papel de un enemigo, de lo que dice su ficha: sus etiquetas, su perfil y lo que sabe.
 *
 * @param {any} enemy
 * @param {any[]} [known] Sus habilidades, ya resueltas del catálogo.
 * @returns {keyof typeof ROLES}
 */
export function roleOf(enemy, known = []) {
    const said = plain(enemy?.role);
    if (Object.hasOwn(ROLES, said)) return /** @type {keyof typeof ROLES} */ (said);
    const tags = [...(Array.isArray(enemy?.tags) ? enemy.tags : []), String(enemy?.name ?? '')].map(plain).join(' ');
    if (enemy?.boss || /jefe|alfa|lider|capitan|sargento/.test(tags)) return 'lider';
    if ((Array.isArray(known) ? known : []).some(a => a?.healing && a?.target !== 'enemy')) return 'sanador';
    if (plain(enemy?.profile) === 'skirmisher' || Number(enemy?.attackRangeFeet ?? enemy?.range) > 10) return 'tirador';
    if (plain(enemy?.profile) === 'guardian' || Number(enemy?.hpFactor) >= 1.3) return 'tanque';
    return 'bruto';
}

/**
 * La táctica del bando de un enemigo, o null.
 *
 * @param {any} enemy
 * @returns {{id: string, note: string}|null}
 */
export function tacticOf(enemy) {
    const said = [String(enemy?.name ?? ''), ...(Array.isArray(enemy?.tags) ? enemy.tags : []), String(enemy?.faction ?? '')].map(plain).join(' ');
    const found = TACTICS.find(t => t.match.test(said));
    return found ? { id: found.id, note: found.note } : null;
}

/**
 * A por quién va, según su papel. Los que no se alcanzan, nunca primero.
 *
 * @param {keyof typeof ROLES} role
 * @param {Array<{id: string, distanceFeet: number, reachable: boolean, hpFraction: number, armorClass?: number}>} options
 * @param {number} rangeFeet
 * @returns {string} El id elegido, o vacío.
 */
export function pickTarget(role, options, rangeFeet) {
    const list = (Array.isArray(options) ? options : []).filter(o => o && o.id);
    if (list.length === 0) return '';
    const reach = list.filter(o => o.reachable);
    const pool = reach.length > 0 ? reach : list;
    if (role === 'tirador') {
        const inRange = pool.filter(o => o.distanceFeet <= Math.max(5, rangeFeet));
        const from = inRange.length > 0 ? inRange : pool;
        return [...from].sort((a, b) => a.hpFraction - b.hpFraction || (a.armorClass ?? 10) - (b.armorClass ?? 10) || a.distanceFeet - b.distanceFeet)[0].id;
    }
    if (role === 'lider') {
        // El líder va a por quien más amenaza: el que está más entero y más cerca.
        return [...pool].sort((a, b) => b.hpFraction - a.hpFraction || a.distanceFeet - b.distanceFeet)[0].id;
    }
    return [...pool].sort((a, b) => a.distanceFeet - b.distanceFeet || a.hpFraction - b.hpFraction)[0].id;
}

/**
 * Lo que le suma al ataque tener a su líder cerca.
 *
 * @param {{x: number, y: number, id: string}} enemy
 * @param {Array<{x: number, y: number, id: string, hp: number, role: string}>} allies
 * @returns {number}
 */
export function leaderBonus(enemy, allies) {
    const cells = Math.floor(LEADER_AURA.feet / 5);
    return (Array.isArray(allies) ? allies : []).some(a => a.role === 'lider' && a.id !== enemy.id && a.hp > 0
        && Math.max(Math.abs(a.x - enemy.x), Math.abs(a.y - enemy.y)) <= cells) ? LEADER_AURA.attack : 0;
}

/**
 * Si un enemigo huye: con su líder caído y malherido (menos de la mitad), el que no es jefe
 * se va. Una vez: quien huye no vuelve a esta pelea… pero puede volver en otra (la némesis).
 *
 * @param {{hp: number, maxHp: number, boss?: boolean, role: string}} enemy
 * @param {boolean} leaderDown
 * @returns {boolean}
 */
export function breaksAndRuns(enemy, leaderDown) {
    if (!leaderDown || enemy.boss || enemy.role === 'lider') return false;
    return enemy.maxHp > 0 && enemy.hp / enemy.maxHp < 0.5;
}

/**
 * Las casillas de flanco de un objetivo respecto a un aliado: la opuesta.
 *
 * @param {{x: number, y: number}} target
 * @param {{x: number, y: number}} ally
 * @returns {{x: number, y: number}}
 */
export function flankCell(target, ally) {
    return { x: target.x + Math.sign(target.x - ally.x), y: target.y + Math.sign(target.y - ally.y) };
}

/**
 * Lo que se dice al empezar una pelea con una banda que se organiza.
 *
 * @param {Array<{name: string, role: string}>} band
 * @param {{note: string}|null} tactic
 * @returns {string}
 */
export function describeBand(band, tactic) {
    const leader = band.find(e => e.role === 'lider');
    const parts = [];
    if (leader) parts.push(`${leader.name} manda`);
    const shooters = band.filter(e => e.role === 'tirador').length;
    if (shooters > 0) parts.push(`${shooters} dispara${shooters > 1 ? 'n' : ''} desde atrás`);
    const healers = band.filter(e => e.role === 'sanador').length;
    if (healers > 0) parts.push(`${healers} cura${healers > 1 ? 'n' : ''}`);
    if (tactic) parts.push(tactic.note.toLowerCase().replace(/\.$/, ''));
    return parts.length > 0 ? `${parts.join('; ')}.`.replace(/^./, c => c.toUpperCase()) : '';
}
