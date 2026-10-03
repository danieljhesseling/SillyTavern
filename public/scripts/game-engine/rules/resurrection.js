/**
 * E8.7 de wiki/ROADMAP_ENTRETENIDO.md (D-J64): la muerte cuenta, pero se puede deshacer pagando.
 *
 * Las salvaciones de muerte de 5e ya están (`death-saves.js`). Esto es lo que viene después:
 * llevar a quien cayó al **templo** para que le devuelvan la vida, con los conjuros de 5e y sus
 * componentes caros, que se gastan:
 *
 * - **Alzar a los muertos** (nivel 5): si murió hace 10 días o menos. Un diamante de 500.
 * - **Resurrección** (nivel 7): si hace más. Un diamante de 1.000.
 * - (**Revivir**, de nivel 3, solo sirve en el primer minuto: eso es en la pelea, con el
 *   conjuro y su diamante de 300, no en el templo.)
 *
 * Además del diamante, el templo pide un **donativo** por el lanzamiento (cosa del templo, no
 * del libro). Los diamantes que llevéis se gastan primero; el resto, en oro.
 *
 * Quien vuelve, vuelve **tocado**:
 * - débil unos días, como dice el libro (−4 a todas las tiradas de d20, que baja con cada
 *   descanso largo); aquí, −4 a cada característica durante 4 días, que se va curando;
 * - y con una **secuela** para siempre (D-J64, cosecha propia): la muerte deja marca.
 *
 * **Modo duro** (opción del juego, apagado de salida): la muerte de un confidente es para
 * siempre. Los mercenarios mueren de verdad siempre: nadie paga por devolverles la vida.
 *
 * Puro: dice qué se puede, cuánto cuesta y qué cambia en la ficha. Quien llama cobra y lo cuenta.
 */

/** @typedef {{id: string, label: string, level: number, diamond: number, donation: number, maxDays: number, hp: 'one'|'full'}} RaiseSpell */

/** Los conjuros del templo, del más barato al más caro. */
export const RAISE_SPELLS = /** @type {RaiseSpell[]} */ ([
    { id: 'alzar', label: 'Alzar a los muertos', level: 5, diamond: 500, donation: 100, maxDays: 10, hp: 'one' },
    { id: 'resurreccion', label: 'Resurrección', level: 7, diamond: 1000, donation: 200, maxDays: 36500, hp: 'full' },
]);

/** El valor de un diamante de la mochila, si no dice otro (el de `loot-items.js`). */
export const DIAMOND_VALUE = 300;

/** Los días que dura la debilidad de quien vuelve. */
export const RAISED_WEAK_DAYS = 4;

/**
 * Las secuelas de volver de la muerte (cosecha propia, D-J64). Para siempre (`days: 0`).
 *
 * @type {Array<{id: string, label: string, description: string, modifiers: Record<string, number>, days: number}>}
 */
export const RAISE_SCARS = [
    { id: 'vuelta-frio', label: 'El frío de la tumba', description: 'Desde que volvió, siempre tiene frío.', modifiers: { constitution: -1 }, days: 0 },
    { id: 'vuelta-pulso', label: 'El pulso torpe', description: 'Las manos ya no le van tan rápido.', modifiers: { dexterity: -1 }, days: 0 },
    { id: 'vuelta-aliento', label: 'El aliento corto', description: 'Se cansa antes que nadie.', modifiers: { maxHp: -3 }, days: 0 },
    { id: 'vuelta-sombra', label: 'Lo que vio al otro lado', description: 'A veces se queda mirando a la nada.', modifiers: { wisdom: -1 }, days: 0 },
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Si alguien se puede llevar al templo: de los tuyos, y no un mercenario.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function isRaisable(member) {
    return Boolean(member?.dead) && member?.guest?.kind !== 'mercenary' && member?.guest?.kind !== 'ward';
}

/**
 * Cuánto vale lo que lleváis en diamantes, y cuáles son.
 *
 * @param {any[]} party
 * @returns {Array<{memberId: string, itemId: string, value: number}>}
 */
export function diamondsOf(party) {
    /** @type {Array<{memberId: string, itemId: string, value: number}>} */
    const out = [];
    for (const member of Array.isArray(party) ? party : []) {
        for (const item of Array.isArray(member?.items) ? member.items : []) {
            if (!/^diamante\b/i.test(text(item?.name))) continue;
            const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
            for (let i = 0; i < qty; i++) {
                out.push({ memberId: String(member.id), itemId: String(item.id), value: Math.max(1, Number(item?.price) || DIAMOND_VALUE) });
            }
        }
    }
    return out.sort((a, b) => b.value - a.value);
}

/**
 * @typedef {Object} RaiseOffer
 * @property {string} memberId
 * @property {string} name
 * @property {RaiseSpell|null} spell
 * @property {number} days Los días que lleva muerto.
 * @property {number} gold Lo que se paga en oro (con lo que cubren vuestros diamantes ya quitado).
 * @property {Array<{memberId: string, itemId: string, value: number}>} diamonds Los vuestros que se gastan.
 * @property {number} total Lo que cuesta todo (diamante y donativo), con la rebaja si la hay.
 * @property {boolean} enabled
 * @property {string} reason Por qué no, si no.
 * @property {string} detail Lo que se dice antes de pulsar.
 */

/**
 * Lo que el templo puede hacer por alguien que cayó.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {number} input.today
 * @param {number} input.purse El oro del grupo.
 * @param {any[]} [input.party] Para los diamantes.
 * @param {boolean} [input.hard] Modo duro: un confidente muerto lo está para siempre.
 * @param {number} [input.discount] La rebaja (0..1), si un maestro del gremio la consigue (E8.3).
 * @param {boolean} [input.fighting]
 * @returns {RaiseOffer}
 */
export function raiseOffer({ member, today, purse, party = [], hard = false, discount = 0, fighting = false }) {
    const name = text(member?.name) || 'Quien cayó';
    const diedOn = Math.max(1, Math.floor(Number(member?.diedOn) || Number(today) || 1));
    const days = Math.max(0, Math.floor(Number(today) || 1) - diedOn);
    const base = { memberId: String(member?.id ?? ''), name, days, gold: 0, diamonds: [], total: 0 };
    if (!isRaisable(member)) {
        return { ...base, spell: null, enabled: false, reason: `${name} no vuelve: venía por la paga.`, detail: '' };
    }
    if (hard) {
        return { ...base, spell: null, enabled: false, reason: `Modo duro: ${name} no vuelve. La muerte es para siempre.`, detail: '' };
    }
    const spell = RAISE_SPELLS.find(s => days <= s.maxDays) ?? null;
    if (!spell) return { ...base, spell: null, enabled: false, reason: `Hace demasiado que murió ${name}.`, detail: '' };
    const off = Math.max(0, Math.min(1, Number(discount) || 0));
    const diamondPrice = Math.round(spell.diamond * (1 - off));
    const donation = Math.round(spell.donation * (1 - off));
    // Los diamantes vuestros cubren el diamante (no el donativo), de uno en uno, sin pasarse de lo
    // que hace falta más que con el último.
    /** @type {Array<{memberId: string, itemId: string, value: number}>} */
    const used = [];
    let covered = 0;
    for (const gem of diamondsOf(party)) {
        if (covered >= diamondPrice) break;
        used.push(gem);
        covered += gem.value;
    }
    const gold = Math.max(0, diamondPrice - covered) + donation;
    const total = diamondPrice + donation;
    const mine = used.length > 0 ? ` Gastáis ${used.length === 1 ? 'un diamante vuestro' : `${used.length} diamantes vuestros`}.` : '';
    const when = days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
    const detail = `${spell.label}: murió ${when}. Un diamante de ${diamondPrice} y ${donation} de donativo.${mine} `
        + `Se paga ${gold} de oro. Vuelve débil unos días y con una secuela para siempre.`;
    const blocked = fighting ? 'No mientras peleáis.' : purse < gold ? `No llega el oro: hacen falta ${gold}.` : '';
    return { ...base, spell, gold, diamonds: used, total, enabled: !blocked, reason: blocked, detail: blocked || detail };
}

/**
 * La secuela que le queda a quien vuelve: una de la tabla que no tenga ya.
 *
 * @param {any} member
 * @param {() => number} roll 0..1.
 * @returns {typeof RAISE_SCARS[number]}
 */
export function raiseScar(member, roll) {
    const had = new Set((Array.isArray(member?.injuries) ? member.injuries : []).map((/** @type {any} */ i) => String(i?.id)));
    const pool = RAISE_SCARS.filter(scar => !had.has(scar.id));
    const list = pool.length > 0 ? pool : RAISE_SCARS;
    const value = Math.max(0, Math.min(0.999999, Number(roll()) || 0));
    return list[Math.floor(value * list.length)];
}

/** La debilidad de los primeros días. @returns {{id: string, label: string, description: string, modifiers: Record<string, number>, days: number}} */
export function raisedWeakness() {
    return {
        id: 'recien-vuelto',
        label: 'Recién vuelto de la muerte',
        description: 'Le cuesta todo: se le pasa en unos días. (En el libro, −4 a las tiradas de d20, que baja con cada descanso largo.)',
        modifiers: { strength: -4, dexterity: -4, constitution: -4, intelligence: -4, wisdom: -4, charisma: -4 },
        days: RAISED_WEAK_DAYS,
    };
}

/**
 * Lo que se dice al volver, sin narrador: lo dice quien lanza el conjuro (D-J60).
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {RaiseSpell} input.spell
 * @param {{label: string, description: string}} input.scar
 * @param {string} [input.priest]
 * @param {string} [input.hero]
 * @returns {import('../campaign/meetups.js').Scene}
 */
export function raiseScene({ member, spell, scar, priest = 'El sacerdote', hero = '' }) {
    const name = text(member?.name) || 'Quien cayó';
    const who = text(priest) || 'El sacerdote';
    return {
        id: `templo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        kind: 'charla',
        who,
        key: who.toLowerCase(),
        campaign: '',
        rank: 1,
        title: spell.label,
        where: 'templo',
        beats: [
            {
                note: '',
                who,
                say: `Dejadle en el altar. El diamante, aquí, en su pecho. Y ahora, silencio: esto es ${spell.label.toLowerCase()}, y no sale siempre.`,
                mood: 'neutral',
                replies: [],
            },
            {
                note: '',
                who: name,
                say: `${text(hero) ? `¿${text(hero)}? ` : ''}Hace frío… Estaba muy lejos. Gracias por venir a buscarme.`,
                mood: 'triste',
                replies: [],
            },
            {
                note: '',
                who,
                say: `Ha vuelto, pero la muerte no suelta del todo: ${scar.label.toLowerCase()}. ${scar.description} Y unos días estará muy débil. Que descanse.`,
                mood: 'neutral',
                replies: [],
            },
        ],
    };
}

/**
 * Lo que cambia en la ficha al volver: vivo, con 1 PG (alzar) o con toda la vida (resurrección),
 * las salvaciones limpias y las dos heridas puestas por quien llama (`applyInjury`).
 *
 * @param {any} member
 * @param {RaiseSpell} spell
 * @returns {{dead: false, hp: number, deathSaves: {successes: number, failures: number, stable: boolean, dead: boolean}, activeConditions: string[]}}
 */
export function raisedBasics(member, spell) {
    const maxHp = Math.max(1, Number(member?.maxHp) || 1);
    return {
        dead: false,
        hp: spell.hp === 'full' ? maxHp : 1,
        deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
        activeConditions: (Array.isArray(member?.activeConditions) ? member.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== 'Unconscious' && c !== 'Dead'),
    };
}
