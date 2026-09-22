/**
 * Lo que un combate te deja encima cuando ya ha terminado.
 *
 * Hasta ahora caer a 0 y levantarse salía gratis: un descanso largo y volvías entero, así
 * que **ninguna pelea dejaba huella**. Ganar y ganar por los pelos eran lo mismo al día
 * siguiente, y por eso retirarse nunca era una decisión: no había nada que proteger.
 *
 * Lo bueno de esta pieza es que el motor ya estaba listo y no lo sabía. Cada paso de cada
 * turno ya consulta `member.speed`; cada ataque ya consulta la CA y las características.
 * Así que **una pierna rota no es una bandera narrativa: es `speed: 30 → 20`**, y todo el
 * juego la nota sin que haya que tocar ni un sitio donde se lea.
 *
 * Por eso esto guarda la herida como dato **y reescribe la estadística**, en vez de
 * obligar a que veinte sitios pregunten «¿está herido?». Quien lee `member.speed` ya está
 * leyendo la velocidad de alguien que cojea, y la ficha enseña el número de verdad.
 * El original se guarda en `baseStats` para poder volver cuando cure.
 *
 * Puro: la tirada entra como función y nada se muta. Devuelve el parche y quien llama lo
 * aplica y lo cuenta.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 2.
 */

/**
 * @typedef {Object} Injury
 * @property {string} id
 * @property {string} label       Cómo se llama, en la ficha.
 * @property {string} description Qué significa, en una línea.
 * @property {Record<string, number>} modifiers Sobre qué estadísticas, y cuánto.
 * @property {number} days        Cuántos tarda en curar. **0 es para siempre.**
 */

/**
 * @typedef {Injury & {daysLeft: number, permanent: boolean}} ActiveInjury
 */

/** Las estadísticas que una herida puede tocar. Todas se leen ya en alguna parte. */
export const INJURABLE_STATS = [
    'speed', 'armorClass', 'strength', 'dexterity', 'constitution',
    'intelligence', 'wisdom', 'charisma', 'maxHp',
];

/**
 * La tabla por defecto: de rasguño a mutilación.
 *
 * Ordenada de leve a grave a propósito, para que una tirada alta duela más y la tabla se
 * pueda leer de un vistazo. Las tres últimas **no curan**: son las que hacen que una
 * campaña larga tenga cicatrices y no solo historias.
 *
 * @type {Injury[]}
 */
export const INJURY_TABLE = [
    { id: 'bruised', label: 'Magullado', description: 'Duele al respirar.', modifiers: { constitution: -1 }, days: 3 },
    { id: 'sprain', label: 'Tobillo torcido', description: 'Cojea.', modifiers: { speed: -5 }, days: 5 },
    { id: 'deep_cut', label: 'Corte profundo', description: 'Sangra si se esfuerza.', modifiers: { maxHp: -3 }, days: 7 },
    { id: 'cracked_ribs', label: 'Costillas rotas', description: 'No puede cargar peso.', modifiers: { strength: -2 }, days: 12 },
    { id: 'broken_leg', label: 'Pierna rota', description: 'Apenas se mueve.', modifiers: { speed: -10 }, days: 14 },
    { id: 'broken_arm', label: 'Brazo roto', description: 'No sostiene un arma a dos manos.', modifiers: { strength: -3 }, days: 18 },
    { id: 'concussion', label: 'Conmoción', description: 'Le cuesta seguir lo que pasa.', modifiers: { wisdom: -2, dexterity: -1 }, days: 10 },
    { id: 'gut_wound', label: 'Herida en el vientre', description: 'Nunca vuelve a aguantar lo mismo.', modifiers: { maxHp: -5, constitution: -1 }, days: 0 },
    { id: 'lost_eye', label: 'Ojo perdido', description: 'Calcula mal las distancias.', modifiers: { dexterity: -2 }, days: 0 },
    { id: 'lost_hand', label: 'Mano perdida', description: 'Se acabaron las armas a dos manos.', modifiers: { strength: -2, dexterity: -1 }, days: 0 },
    { id: 'lost_leg', label: 'Pierna perdida', description: 'Anda con muleta, y se nota.', modifiers: { speed: -15, dexterity: -2 }, days: 0 },
];

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
 * Las heridas que alguien lleva encima, leídas de una ficha que puede no tenerlas.
 *
 * @param {any} member
 * @returns {ActiveInjury[]}
 */
export function readInjuries(member) {
    const raw = Array.isArray(member?.injuries) ? member.injuries : [];
    return raw
        .filter(injury => injury && typeof injury === 'object')
        .map(injury => ({
            id: String(injury.id ?? ''),
            label: String(injury.label ?? injury.id ?? 'Herida'),
            description: String(injury.description ?? ''),
            modifiers: (injury.modifiers && typeof injury.modifiers === 'object') ? injury.modifiers : {},
            days: Math.max(0, number(injury.days)),
            // Una fila de la tabla no trae `daysLeft`: lo normal es que alguien pase
            // `INJURY_TABLE.find(...)` tal cual, y una herida que nace curada no vale.
            daysLeft: 'daysLeft' in injury
                ? Math.max(0, number(injury.daysLeft))
                : Math.max(0, number(injury.days)),
            permanent: Boolean(injury.permanent) || number(injury.days) === 0,
        }));
}

/**
 * Qué herida te ha tocado.
 *
 * La tirada entra de fuera para que la prueba pueda pedir la que quiera y para que la
 * semilla de la partida la gobierne igual que a todo lo demás.
 *
 * @param {() => number} roll Devuelve 0..1, como `Math.random`.
 * @param {{table?: Injury[], severity?: number}} [options] `severity` empuja hacia el
 *        final de la tabla: 0 normal, 1 grave. Caer por un crítico deja peor recuerdo.
 * @returns {ActiveInjury}
 */
export function rollInjury(roll, options = {}) {
    const table = Array.isArray(options.table) && options.table.length > 0 ? options.table : INJURY_TABLE;
    const severity = Math.max(0, Math.min(1, number(options.severity)));

    const value = Math.max(0, Math.min(0.999999, number(roll?.(), 0)));
    // La gravedad no salta a la última fila: empuja. Un crítico hace probable lo malo,
    // no seguro lo peor, que es lo que mantiene la tabla interesante.
    const pushed = value + (1 - value) * severity * 0.6;
    const index = Math.min(table.length - 1, Math.floor(pushed * table.length));

    const injury = table[index];
    return {
        ...injury,
        modifiers: { ...injury.modifiers },
        daysLeft: injury.days,
        permanent: injury.days === 0,
    };
}

/**
 * Los números de antes de la primera herida.
 *
 * Se guardan la primera vez que hace falta y no se vuelven a tocar: son el suelo al que
 * se vuelve cuando todo cura. Sin esto, dos heridas seguidas y una curada dejarían la
 * velocidad donde nadie la puso.
 *
 * @param {any} member
 * @returns {Record<string, number>}
 */
function baseStatsOf(member) {
    const stored = (member?.baseStats && typeof member.baseStats === 'object') ? member.baseStats : {};
    /** @type {Record<string, number>} */
    const base = {};
    for (const stat of INJURABLE_STATS) {
        base[stat] = stat in stored ? number(stored[stat]) : number(member?.[stat]);
    }
    return base;
}

/**
 * Lo que suman todas las heridas juntas.
 *
 * @param {ActiveInjury[]} injuries
 * @returns {Record<string, number>}
 */
export function totalModifiers(injuries) {
    /** @type {Record<string, number>} */
    const total = {};
    for (const injury of injuries) {
        for (const [stat, amount] of Object.entries(injury.modifiers ?? {})) {
            if (!INJURABLE_STATS.includes(stat)) continue;
            total[stat] = (total[stat] ?? 0) + number(amount);
        }
    }
    return total;
}

/**
 * Las estadísticas tal y como quedan con las heridas puestas.
 *
 * Nada baja de 0, y la velocidad de alguien que sigue vivo no baja de 5: un personaje que
 * no se puede mover ni una casilla no está herido, está fuera del juego, y para eso ya
 * está la muerte.
 *
 * @param {Record<string, number>} base
 * @param {Record<string, number>} modifiers
 * @returns {Record<string, number>}
 */
function applyModifiers(base, modifiers) {
    /** @type {Record<string, number>} */
    const result = {};
    for (const stat of INJURABLE_STATS) {
        const floor = stat === 'speed' ? 5 : (stat === 'maxHp' ? 1 : 1);
        result[stat] = Math.max(floor, number(base[stat]) + number(modifiers[stat]));
    }
    return result;
}

/**
 * El parche de añadir una herida a una ficha.
 *
 * @param {any} member
 * @param {ActiveInjury} injury
 * @returns {{injuries: ActiveInjury[], baseStats: Record<string, number>, stats: Record<string, number>}}
 */
export function applyInjury(member, injury) {
    const base = baseStatsOf(member);
    // Se normaliza aqui, no se exige normalizada: `applyInjury(member, INJURY_TABLE[4])`
    // es lo que cualquiera va a escribir, y tiene que significar lo obvio.
    const [fresh] = readInjuries({ injuries: [injury] });
    const injuries = [...readInjuries(member), fresh];

    return {
        injuries,
        baseStats: base,
        stats: applyModifiers(base, totalModifiers(injuries)),
    };
}

/**
 * El parche de que pase el tiempo.
 *
 * Las permanentes no cuentan días: se quedan. Lo que cura desaparece y devuelve lo suyo,
 * que es la mitad buena de tener heridas — la de esperar a que Bruna pueda andar.
 *
 * @param {any} member
 * @param {number} days
 * @returns {{injuries: ActiveInjury[], baseStats: Record<string, number>, stats: Record<string, number>, healed: ActiveInjury[]}}
 */
export function healInjuries(member, days = 1) {
    const passed = Math.max(0, Math.floor(number(days)));
    const base = baseStatsOf(member);

    /** @type {ActiveInjury[]} */
    const kept = [];
    /** @type {ActiveInjury[]} */
    const healed = [];

    for (const injury of readInjuries(member)) {
        if (injury.permanent) {
            kept.push(injury);
            continue;
        }
        const left = injury.daysLeft - passed;
        if (left <= 0) healed.push(injury);
        else kept.push({ ...injury, daysLeft: left });
    }

    return {
        injuries: kept,
        baseStats: base,
        stats: applyModifiers(base, totalModifiers(kept)),
        healed,
    };
}

/**
 * Lo que costaría quitarle a alguien lo que se le puede quitar.
 *
 * Las permanentes no tienen precio: no hay cirujano que devuelva una pierna. Que el panel
 * de la cuenta pueda decirlo es lo que convierte una herida en una decisión de dinero.
 *
 * @param {any} member
 * @param {number} [goldPerDay] Lo que cobra quien sabe curar, por día ahorrado.
 * @returns {{gold: number, days: number, treatable: ActiveInjury[], permanent: ActiveInjury[]}}
 */
export function treatmentCost(member, goldPerDay = 5) {
    const injuries = readInjuries(member);
    const treatable = injuries.filter(injury => !injury.permanent);
    const permanent = injuries.filter(injury => injury.permanent);
    const days = treatable.reduce((most, injury) => Math.max(most, injury.daysLeft), 0);

    return {
        gold: treatable.reduce((total, injury) => total + injury.daysLeft * Math.max(0, number(goldPerDay)), 0),
        days,
        treatable,
        permanent,
    };
}

/**
 * Las heridas de alguien, en una línea por herida.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describeInjuries(member) {
    return readInjuries(member).map((injury) => {
        const effects = Object.entries(injury.modifiers)
            .map(([stat, amount]) => `${stat} ${amount > 0 ? '+' : ''}${amount}`)
            .join(', ');
        const when = injury.permanent ? 'para siempre' : `${injury.daysLeft} día(s)`;
        return `${injury.label} — ${effects} · ${when}`;
    });
}
