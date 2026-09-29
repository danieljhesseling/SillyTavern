/**
 * Los espacios de conjuro de 5e (J19.1 del roadmap sin conexión): la magia de la mesa,
 * **encima** de la capa ligera.
 *
 * La capa ligera (`abilities.js` y las cargas por círculo de `grimoire.js`) no se toca:
 * sigue siendo lo que usa quien no tenga la columna `casting` en su clase. Una clase que
 * sí la tiene gasta espacios de nivel 1 a 9, con las tablas del SRD:
 *
 * - **Lanzador completo** (`full`): el mago, el clérigo, el druida, el bardo.
 * - **Medio lanzador** (`half`): el explorador, desde el nivel 2.
 * - **Un tercio** (`third`): los guerreros y pícaros con magia, desde el nivel 3.
 * - **Pacto** (`pact`): pocos espacios, todos del mismo nivel, que vuelven con el descanso
 *   **corto**. Es el del brujo; hoy no lo usa ninguna clase del compendio, pero está.
 *
 * Todos los demás vuelven con el descanso largo.
 *
 * Lo gastado se guarda en la ficha como `slotsUsed`: `{ "1": 2, "3": 1, "pacto": 1 }`.
 * Guardar lo gastado y no lo que queda es lo que hace que subir de nivel dé los espacios
 * nuevos sin tocar nada: el máximo sale de la tabla, lo gastado no cambia.
 *
 * Puro: tablas y cuentas. Quien lanza, gasta y guarda está en `party.js`.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.1.
 */

/** Las cuatro formas de progresar en magia, en vocabulario cerrado. */
export const PROGRESSIONS = ['full', 'half', 'third', 'pact'];

/** Cómo aprende sus conjuros: del libro, de toda su lista o sabiéndoselos. */
export const CASTING_MODES = ['spellbook', 'prepared', 'known'];

/** Qué dice cada progresión, para quien lea la ficha. */
export const PROGRESSION_LABELS = {
    full: 'Lanzador completo',
    half: 'Medio lanzador',
    third: 'Un tercio de lanzador',
    pact: 'Magia de pacto',
};

/** Cómo se dice cada nivel de espacio. */
export const SLOT_LABELS = {
    1: '1.er nivel', 2: '2.º nivel', 3: '3.er nivel', 4: '4.º nivel', 5: '5.º nivel',
    6: '6.º nivel', 7: '7.º nivel', 8: '8.º nivel', 9: '9.º nivel',
};

/**
 * Los espacios del lanzador completo por nivel de personaje (tabla del SRD). La posición 0
 * es el nivel 1; dentro, el primer número son los de 1.er nivel, el segundo los de 2.º…
 */
export const FULL_CASTER_SLOTS = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2],
    [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** El medio lanzador: nada en el nivel 1, y hasta el 5.º nivel de espacio. */
export const HALF_CASTER_SLOTS = [
    [], [2], [3], [3], [4, 2],
    [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
    [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

/** Un tercio: nada hasta el nivel 3, y hasta el 4.º nivel de espacio. */
export const THIRD_CASTER_SLOTS = [
    [], [], [2], [3], [3],
    [3], [4, 2], [4, 2], [4, 2], [4, 3],
    [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2],
    [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
];

/** El pacto: cuántos espacios y de qué nivel son todos, por nivel de personaje. */
export const PACT_SLOTS = [
    { count: 1, level: 1 }, { count: 2, level: 1 }, { count: 2, level: 2 }, { count: 2, level: 2 }, { count: 2, level: 3 },
    { count: 2, level: 3 }, { count: 2, level: 4 }, { count: 2, level: 4 }, { count: 2, level: 5 }, { count: 2, level: 5 },
    { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 3, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 },
];

/**
 * Los arcanos del pacto: un conjuro de 6.º a 9.º, una vez por descanso largo, sin espacio.
 * La clave es el nivel de personaje desde el que se tiene; el valor, el nivel del conjuro.
 */
export const PACT_ARCANUM = { 11: 6, 13: 7, 15: 8, 17: 9 };

/** La clave de `slotsUsed` para los espacios de pacto. */
export const PACT_KEY = 'pacto';

/** @type {Record<string, number[][]>} */
const TABLES = { full: FULL_CASTER_SLOTS, half: HALF_CASTER_SLOTS, third: THIRD_CASTER_SLOTS };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {any} value
 * @returns {number} Entre 1 y 20.
 */
function levelOf(value) {
    return Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));
}

/**
 * @typedef {Object} Casting
 * @property {'full'|'half'|'third'|'pact'} progression
 * @property {string} ability La característica con la que lanza.
 * @property {'spellbook'|'prepared'|'known'} mode
 * @property {string} list De qué lista de clase saca los conjuros (su propio id si no dice).
 * @property {Record<number, number>} cantrips Trucos que sabe, «desde el nivel N, tantos».
 * @property {Record<number, number>|null} known Conjuros que sabe (solo si `mode` es known).
 * @property {'level'|'half'} prepares Cuántos prepara: modificador + nivel, o + medio nivel.
 * @property {{start: number, perLevel: number}} spellbook Lo que entra gratis en el libro.
 * @property {''|'book'|'prepared'|'known'} rituals De dónde saca los rituales.
 * @property {boolean} ritualsOnly D-J27: solo lanza rituales, sin espacios (el erudito). Su
 *   progresión dice hasta qué nivel de ritual llega, no cuántos espacios tiene.
 * @property {string} focus El tipo de foco que le sirve: Arcane, Divine o Druidic.
 */

/**
 * Unos escalones «desde el nivel N, tantos», leídos con tolerancia.
 *
 * @param {any} raw
 * @returns {Record<number, number>|null}
 */
function readSteps(raw) {
    if (Array.isArray(raw)) {
        /** @type {Record<number, number>} */
        const out = {};
        raw.forEach((value, index) => { out[index + 1] = Math.max(0, Math.floor(Number(value) || 0)); });
        return out;
    }
    if (!raw || typeof raw !== 'object') return null;
    /** @type {Record<number, number>} */
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const level = Math.floor(Number(key));
        if (level >= 1 && level <= 20) out[level] = Math.max(0, Math.floor(Number(value) || 0));
    }
    return Object.keys(out).length > 0 ? out : null;
}

/**
 * Lo que vale un escalón en un nivel: el del mayor «desde» que no lo pase.
 *
 * @param {Record<number, number>|null} steps
 * @param {number} level
 * @returns {number}
 */
export function stepValue(steps, level) {
    if (!steps) return 0;
    let best = 0;
    let from = 0;
    for (const [key, value] of Object.entries(steps)) {
        const at = Number(key);
        if (at <= level && at >= from) {
            from = at;
            best = value;
        }
    }
    return best;
}

/**
 * La magia de una clase, leída de su columna `casting`. `null` si no hace magia de 5e:
 * entonces manda la capa ligera, como hasta ahora.
 *
 * @param {any} classRow Una fila de `clases.json`, o ya su bloque `casting`.
 * @returns {Casting|null}
 */
export function casterOf(classRow) {
    const raw = classRow?.casting ?? (classRow?.progression ? classRow : null);
    if (!raw || typeof raw !== 'object') return null;
    const progression = /** @type {Casting['progression']} */ (PROGRESSIONS.includes(text(raw.progression)) ? text(raw.progression) : '');
    if (!progression) return null;
    const mode = /** @type {Casting['mode']} */ (CASTING_MODES.includes(text(raw.mode)) ? text(raw.mode) : 'known');
    const ritualsOnly = raw.ritualsOnly === true;
    // Quien solo lanza rituales los saca de donde guarda sus conjuros, aunque no lo diga.
    const own = /** @type {Casting['rituals']} */ (mode === 'spellbook' ? 'book' : mode);
    const rituals = /** @type {Casting['rituals']} */ (['book', 'prepared', 'known'].includes(text(raw.rituals)) ? text(raw.rituals) : ritualsOnly ? own : '');
    return {
        progression,
        ability: text(raw.ability) || 'intelligence',
        mode,
        list: text(raw.list) || text(classRow?.id),
        cantrips: readSteps(raw.cantrips) ?? {},
        known: mode === 'known' ? readSteps(raw.known) : null,
        prepares: text(raw.prepares) === 'half' ? 'half' : 'level',
        spellbook: {
            start: Math.max(0, Math.floor(Number(raw.spellbook?.start ?? 6) || 0)),
            perLevel: Math.max(0, Math.floor(Number(raw.spellbook?.perLevel ?? 2) || 0)),
        },
        rituals,
        ritualsOnly,
        focus: text(raw.focus),
    };
}

/**
 * La fila de clase de alguien, por el nombre que tenga en la ficha: «Maga» es la de
 * `mago`, «Clériga» la de `clerigo`. Sin acentos ni mayúsculas.
 *
 * @param {string} className
 * @param {any[]} classRows
 * @returns {any|null}
 */
export function classRowFor(className, classRows) {
    const wanted = plain(className);
    if (!wanted) return null;
    const rows = Array.isArray(classRows) ? classRows : [];
    const exact = rows.find(row => plain(row?.id) === wanted || plain(row?.name) === wanted);
    if (exact) return exact;
    // El femenino y los apellidos («Mago de batalla»): se compara la raíz, sin la última letra.
    return rows.find(row => {
        const stem = plain(row?.id).slice(0, -1);
        return stem.length >= 3 && wanted.startsWith(stem);
    }) ?? null;
}

/**
 * @typedef {Object} SlotTable
 * @property {''|'full'|'half'|'third'|'pact'} progression
 * @property {Record<number, number>} slots Los espacios normales, por nivel de espacio.
 * @property {{count: number, level: number}|null} pact Los de pacto, si los hay.
 * @property {number[]} arcanum Los niveles de conjuro de sus arcanos.
 * @property {number} maxLevel El nivel de conjuro más alto que puede lanzar con espacio; o,
 *   si solo lanza rituales (D-J27), el del ritual más alto que ya sabe hacer.
 */

/**
 * Los espacios que da una clase a un nivel.
 *
 * @param {any} classRow
 * @param {number} level
 * @returns {SlotTable}
 */
export function slotsFor(classRow, level) {
    const casting = casterOf(classRow);
    const at = levelOf(level);
    if (!casting) return { progression: '', slots: {}, pact: null, arcanum: [], maxLevel: 0 };

    if (casting.progression === 'pact') {
        const pact = PACT_SLOTS[at - 1];
        const arcanum = Object.entries(PACT_ARCANUM)
            .filter(([from]) => Number(from) <= at)
            .map(([, spellLevel]) => spellLevel);
        if (casting.ritualsOnly) return { progression: 'pact', slots: {}, pact: null, arcanum: [], maxLevel: pact.level };
        return { progression: 'pact', slots: {}, pact: { ...pact }, arcanum, maxLevel: pact.level };
    }

    const row = TABLES[casting.progression][at - 1] ?? [];
    /** @type {Record<number, number>} */
    const slots = {};
    // D-J27: sin espacios; la tabla solo dice hasta qué nivel de ritual llega.
    if (!casting.ritualsOnly) row.forEach((count, index) => { if (count > 0) slots[index + 1] = count; });
    return { progression: casting.progression, slots, pact: null, arcanum: [], maxLevel: row.length };
}

/**
 * Lo gastado, leído con tolerancia.
 *
 * @param {any} member
 * @returns {Record<string, number>}
 */
function usedOf(member) {
    const raw = member?.slotsUsed;
    /** @type {Record<string, number>} */
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        const spent = Math.max(0, Math.floor(Number(value) || 0));
        if (spent > 0) out[key] = spent;
    }
    return out;
}

/**
 * Lo que le queda de cada nivel.
 *
 * @param {any} member
 * @param {any} classRow
 * @returns {{slots: Record<number, number>, pact: number, pactLevel: number}}
 */
export function slotsLeft(member, classRow) {
    const table = slotsFor(classRow, member?.level);
    const used = usedOf(member);
    /** @type {Record<number, number>} */
    const slots = {};
    for (const [key, max] of Object.entries(table.slots)) {
        slots[Number(key)] = Math.max(0, max - (used[key] ?? 0));
    }
    const pact = table.pact ? Math.max(0, table.pact.count - (used[PACT_KEY] ?? 0)) : 0;
    return { slots, pact, pactLevel: table.pact?.level ?? 0 };
}

/**
 * El espacio más bajo que sirve para un conjuro de ese nivel. Cero si no queda ninguno.
 *
 * Gastar el más bajo que sirva es lo que haría cualquiera en la mesa: el de 3.er nivel se
 * guarda para la bola de fuego.
 *
 * @param {any} member
 * @param {any} classRow
 * @param {number} spellLevel
 * @returns {number}
 */
export function lowestFreeSlot(member, classRow, spellLevel) {
    const wanted = Math.max(1, Math.floor(Number(spellLevel) || 1));
    const left = slotsLeft(member, classRow);
    if (left.pactLevel > 0) return left.pact > 0 && left.pactLevel >= wanted ? left.pactLevel : 0;
    for (let level = wanted; level <= 9; level++) {
        if ((left.slots[level] ?? 0) > 0) return level;
    }
    return 0;
}

/**
 * Gastar un espacio, como parche para la ficha.
 *
 * Con pacto, el espacio es siempre del nivel del pacto: pedir uno de 1.er nivel a un brujo
 * de nivel 5 gasta uno de 3.º, y el conjuro sale a 3.º (`slotLevel`).
 *
 * @param {any} member
 * @param {any} classRow
 * @param {number} level El nivel de espacio que se quiere gastar.
 * @returns {{ok: boolean, reason: string, slotLevel: number, slotsUsed: Record<string, number>}}
 */
export function spendSlot(member, classRow, level) {
    const used = usedOf(member);
    const wanted = Math.floor(Number(level) || 0);
    const table = slotsFor(classRow, member?.level);
    if (!table.progression) return { ok: false, reason: 'Su clase no tiene espacios de conjuro.', slotLevel: 0, slotsUsed: used };
    if (casterOf(classRow)?.ritualsOnly) return { ok: false, reason: 'Solo lanza rituales: no tiene espacios de conjuro.', slotLevel: 0, slotsUsed: used };
    if (wanted < 1 || wanted > 9) return { ok: false, reason: 'Un espacio es de nivel 1 a 9.', slotLevel: 0, slotsUsed: used };

    if (table.pact) {
        if (wanted > table.pact.level) {
            return { ok: false, reason: `Sus espacios de pacto son de ${SLOT_LABELS[/** @type {1} */ (table.pact.level)]}.`, slotLevel: 0, slotsUsed: used };
        }
        if ((used[PACT_KEY] ?? 0) >= table.pact.count) {
            return { ok: false, reason: 'Sin espacios de pacto: vuelven con un descanso corto.', slotLevel: 0, slotsUsed: used };
        }
        return { ok: true, reason: '', slotLevel: table.pact.level, slotsUsed: { ...used, [PACT_KEY]: (used[PACT_KEY] ?? 0) + 1 } };
    }

    const max = table.slots[wanted] ?? 0;
    const label = SLOT_LABELS[/** @type {1} */ (wanted)];
    if (max === 0) return { ok: false, reason: `Todavía no tiene espacios de ${label}.`, slotLevel: 0, slotsUsed: used };
    if ((used[wanted] ?? 0) >= max) {
        return { ok: false, reason: `Sin espacios de ${label}: vuelven con un descanso largo.`, slotLevel: 0, slotsUsed: used };
    }
    return { ok: true, reason: '', slotLevel: wanted, slotsUsed: { ...used, [wanted]: (used[wanted] ?? 0) + 1 } };
}

/**
 * Lo que devuelve un descanso, como parche para `slotsUsed`.
 *
 * El largo lo devuelve todo (también los arcanos); el corto, solo los de pacto. Acepta los
 * nombres de `rest.js` («corto», «largo») y los ingleses.
 *
 * @param {any} member
 * @param {'corto'|'largo'|'short'|'long'} kind
 * @returns {Record<string, number>}
 */
export function recoverSlots(member, kind) {
    const long = kind === 'largo' || kind === 'long';
    if (long) return {};
    const used = usedOf(member);
    delete used[PACT_KEY];
    return used;
}

/**
 * La característica de lanzar, la CD de salvación y el bono de ataque de conjuro (5e: 8 +
 * competencia + modificador, y competencia + modificador).
 *
 * @param {any} member
 * @param {any} classRow
 * @returns {{ability: string, modifier: number, proficiency: number, saveDc: number, attackBonus: number}}
 */
export function spellcastingStats(member, classRow) {
    const casting = casterOf(classRow);
    const ability = casting?.ability ?? 'intelligence';
    const modifier = Math.floor(((Number(member?.[ability]) || 10) - 10) / 2);
    // La misma cuenta de competencia que `checks.js`.
    const proficiency = 2 + Math.floor((levelOf(member?.level) - 1) / 4);
    return { ability, modifier, proficiency, saveDc: 8 + proficiency + modifier, attackBonus: proficiency + modifier };
}

/**
 * Los espacios, en una línea para la ficha: «Espacios: 1.º 3/4 · 2.º 2/3».
 *
 * @param {any} member
 * @param {any} classRow
 * @returns {string} Vacío si no tiene.
 */
export function describeSlots(member, classRow) {
    const table = slotsFor(classRow, member?.level);
    const left = slotsLeft(member, classRow);
    if (casterOf(classRow)?.ritualsOnly && table.maxLevel > 0) return `Solo rituales, sin espacios: hasta los de ${SLOT_LABELS[/** @type {1} */ (table.maxLevel)]}`;
    if (table.pact) return `Espacios de pacto (${table.pact.level}.º): ${left.pact}/${table.pact.count}`;
    const parts = Object.entries(table.slots).map(([level, max]) => `${level}.º ${left.slots[Number(level)] ?? 0}/${max}`);
    return parts.length > 0 ? `Espacios: ${parts.join(' · ')}` : '';
}
