/**
 * Comer, beber, dormir y no morirse de frío.
 *
 * La cuenta semanal ya te cobraba la comida y **no pasaba nada si no comías**: un aviso y
 * a seguir. Esto es lo que le faltaba — que pasar hambre, sed, frío, calor o noches sin
 * dormir tenga un precio que se paga en el tablero, y que al final **mate**.
 *
 * La decisión que ordena todo esto: **cuatro necesidades, un solo marcador.** Cuatro
 * barras que suben y bajan por su cuenta son contabilidad; un número que todo el mundo
 * entiende es un juego. Y ese número ya existe y es de D&D: el **agotamiento**, de 1 a 6,
 * donde 6 es morirse. El motor ya lo tenía en su lista de condiciones y en el rastreador
 * de iniciativa — con su icono y todo — y **nada lo producía nunca**. Era una etiqueta sin
 * mecánica esperando a esto.
 *
 * La segunda decisión, y la que evita un lío de verdad: el agotamiento **se aplica como
 * una herida**. No escribe `speed` por su cuenta ni lleva su propia copia de las
 * estadísticas: pasa por el mismo sitio que una pierna rota. Así hay **un solo** mecanismo
 * que empeora a alguien y **un solo** dueño de `baseStats`. Dos sistemas tocando la
 * velocidad a la vez es exactamente como se pierde el número de partida.
 *
 * Puro: cuenta horas y devuelve lo que toca. No mata a nadie, no narra y no da de comer.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 2.
 */

/**
 * @typedef {Object} NeedState
 * @property {number} hunger  Horas desde la última comida.
 * @property {number} thirst  Horas desde el último trago.
 * @property {number} rest    Horas despierto.
 * @property {number} exposure Horas aguantando un clima que castiga.
 */

/**
 * Cuántas horas aguanta cada cosa antes de empezar a doler, y cada cuántas empeora.
 *
 * La sed aprieta mucho antes que el hambre porque es verdad y porque hace que el agua sea
 * una decisión de viaje: se puede salir sin cena, no sin cantimplora.
 */
export const NEED_LIMITS = {
    thirst: { grace: 24, every: 12, label: 'sed' },
    hunger: { grace: 72, every: 24, label: 'hambre' },
    rest: { grace: 24, every: 12, label: 'sueño' },
    exposure: { grace: 4, every: 3, label: 'la intemperie' },
};

/**
 * Lo que cuesta cada nivel de agotamiento, en la misma forma que una herida.
 *
 * Son las reglas de 5e, que son buenas y además ya las entiende quien juega: desventaja,
 * la velocidad partida, el máximo de vida a la mitad, y al final ya no te levantas.
 */
export const EXHAUSTION = [
    { level: 1, label: 'Cansado', modifiers: {} },
    { level: 2, label: 'Agotado', modifiers: { speed: -10 } },
    { level: 3, label: 'Exhausto', modifiers: { speed: -10, strength: -2, dexterity: -2 } },
    { level: 4, label: 'Al límite', modifiers: { speed: -15, strength: -3, dexterity: -3, maxHp: -5 } },
    { level: 5, label: 'Sin fuerzas', modifiers: { speed: -25, strength: -4, dexterity: -4, maxHp: -10 } },
    { level: 6, label: 'Se acabó', modifiers: { speed: -25, strength: -5, dexterity: -5, maxHp: -15 } },
];

/** El nivel del que ya no se vuelve. */
export const LETHAL_EXHAUSTION = 6;

/** Climas que castigan, y cuánto. */
export const CLIMATES = {
    mild: { label: 'templado', harsh: false, damagePerDay: 0 },
    cold: { label: 'frío', harsh: true, damagePerDay: 2 },
    freezing: { label: 'helador', harsh: true, damagePerDay: 5 },
    hot: { label: 'caluroso', harsh: true, damagePerDay: 2 },
    scorching: { label: 'abrasador', harsh: true, damagePerDay: 5 },
};

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {any} member
 * @returns {NeedState}
 */
export function readNeeds(member) {
    const raw = (member?.needs && typeof member.needs === 'object') ? member.needs : {};
    return {
        hunger: Math.max(0, number(raw.hunger)),
        thirst: Math.max(0, number(raw.thirst)),
        rest: Math.max(0, number(raw.rest)),
        exposure: Math.max(0, number(raw.exposure)),
    };
}

/**
 * Cuánto agotamiento acarrea cada necesidad por su cuenta.
 *
 * @param {NeedState} needs
 * @returns {Record<string, number>}
 */
export function levelsFrom(needs) {
    /** @type {Record<string, number>} */
    const levels = {};
    for (const [key, limit] of Object.entries(NEED_LIMITS)) {
        const over = number(needs[key]) - limit.grace;
        levels[key] = over <= 0 ? 0 : 1 + Math.floor(over / limit.every);
    }
    return levels;
}

/**
 * El agotamiento de alguien: **el peor de sus motivos**, no la suma.
 *
 * Sumarlos haría que tres molestias pequeñas mataran antes que una grave, y eso no se
 * parece a nada. Lo que te tumba es lo peor que te pasa; lo demás lo acompaña.
 *
 * @param {NeedState} needs
 * @returns {number}
 */
export function exhaustionOf(needs) {
    const levels = Object.values(levelsFrom(needs));
    return Math.min(LETHAL_EXHAUSTION, Math.max(0, ...levels, 0));
}

/**
 * El agotamiento en forma de herida, para que lo aplique el mismo sitio que las demás.
 *
 * @param {number} level
 * @returns {any|null}
 */
export function exhaustionInjury(level) {
    const step = EXHAUSTION.find(entry => entry.level === Math.max(0, Math.min(LETHAL_EXHAUSTION, level)));
    if (!step) return null;

    return {
        id: 'exhaustion',
        label: `${step.label} (agotamiento ${step.level})`,
        description: 'Comer, beber y dormir lo arreglan. Dejarlo correr, no.',
        modifiers: { ...step.modifiers },
        days: 0,
    };
}

/**
 * Lo que le hacen a alguien unas horas más.
 *
 * Devuelve el estado nuevo, el daño que se ha llevado por el clima y qué hay que decirle.
 * **No mata**: si se derrumba lo dice y quien llama decide, que es quien conoce las reglas
 * de esta campaña.
 *
 * @param {any} member
 * @param {Object} [options]
 * @param {number} [options.hours]
 * @param {string} [options.climate]
 * @param {boolean} [options.sheltered] Bajo techo no cuenta la intemperie.
 * @param {boolean} [options.ate]
 * @param {boolean} [options.drank]
 * @param {boolean} [options.slept]
 * @returns {{needs: NeedState, exhaustion: number, damage: number, collapsed: boolean, lines: string[]}}
 */
export function tickNeeds(member, options = {}) {
    const hours = Math.max(0, number(options.hours, 0));
    const climate = CLIMATES[options.climate ?? 'mild'] ?? CLIMATES.mild;
    const before = readNeeds(member);
    const name = String(member?.name ?? 'Alguien');

    const needs = {
        hunger: options.ate ? 0 : before.hunger + hours,
        thirst: options.drank ? 0 : before.thirst + hours,
        rest: options.slept ? 0 : before.rest + hours,
        // Bajo techo se descansa de la intemperie, no solo se deja de sumar.
        exposure: (options.sheltered || !climate.harsh)
            ? Math.max(0, before.exposure - hours)
            : before.exposure + hours,
    };

    const exhaustion = exhaustionOf(needs);
    const damage = (climate.harsh && !options.sheltered)
        ? Math.round(climate.damagePerDay * (hours / 24))
        : 0;

    /** @type {string[]} */
    const lines = [];
    const levels = levelsFrom(needs);
    const wasLevels = levelsFrom(before);

    for (const [key, limit] of Object.entries(NEED_LIMITS)) {
        if (levels[key] > wasLevels[key] && levels[key] > 0) {
            lines.push(`${name} empieza a acusar ${limit.label}.`);
        }
    }
    if (damage > 0) lines.push(`${climate.label}: ${name} pierde ${damage} de vida.`);
    if (exhaustion >= LETHAL_EXHAUSTION) lines.push(`${name} no puede más.`);

    return { needs, exhaustion, damage, collapsed: exhaustion >= LETHAL_EXHAUSTION, lines };
}

/**
 * Comer, beber o dormir pone a cero lo suyo.
 *
 * @param {any} member
 * @param {'ate'|'drank'|'slept'} what
 * @returns {NeedState}
 */
export function relieve(member, what) {
    const needs = readNeeds(member);
    if (what === 'ate') needs.hunger = 0;
    if (what === 'drank') needs.thirst = 0;
    if (what === 'slept') needs.rest = 0;
    return needs;
}

/**
 * Cómo está alguien, en una línea, y solo si hay algo que decir.
 *
 * @param {any} member
 * @returns {string}
 */
export function describeNeeds(member) {
    const needs = readNeeds(member);
    const levels = levelsFrom(needs);

    const hurting = Object.entries(NEED_LIMITS)
        .filter(([key]) => levels[key] > 0)
        .map(([key, limit]) => `${limit.label} (${levels[key]})`);

    if (hurting.length === 0) return '';

    const level = exhaustionOf(needs);
    const step = EXHAUSTION.find(entry => entry.level === level);
    return `${step ? step.label : 'Bien'} — ${hurting.join(', ')}`;
}
