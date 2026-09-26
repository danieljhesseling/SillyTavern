/**
 * El grimorio: **toda la magia que existe**, escrita en el código (R4 del roadmap de
 * profundidad).
 *
 * Magia, sí; locuras, no. Hasta ahora un conjuro era una fila de datos como *Embate*, y
 * cualquiera —el paquete de reglas, el guion del Gem— podía añadir otra. Desde aquí:
 *
 * - **Cada conjuro está programado**: su efecto se hace con las piezas de R3 (el área, el
 *   elemento, el estado), no se describe en una fila que alguien pueda inventarse.
 * - **Nadie más crea magia.** El guion y el Gem pueden decir *quién sabe qué conjuro* y
 *   *dónde hay un pergamino*, por su id. El paquete de reglas puede ajustar números, no
 *   añadir conjuros. Una fila de datos con escuela o círculo se rechaza (`magicInData`).
 * - **Siete escuelas y cuatro círculos**: los trucos (0), a voluntad; y el 1.º, 2.º y 3.º,
 *   con **cargas por círculo** (DR4): tres, dos y una, que vuelven con el descanso largo.
 * - **Lo gordo pide algo que se gasta**: polvo de hueso, ámbar, azufre, mirra. Sale de la
 *   tienda de la botica, de lo que se caza y de lo que se encuentra.
 * - **Pesa en el mundo**: cada conjuro dice su escuela, y hay sitios donde una escuela es un
 *   crimen (la nigromancia) o donde se paga bien (la divina).
 *
 * Los conjuros que antes eran filas de datos (*Rayo de fuego*, *Curar heridas*, *Zarzas*…)
 * viven aquí ahora, con su id de siempre como alias: quien ya los sabía, los sigue sabiendo.
 *
 * Puro: datos y cuentas. Quien lanza, gasta y cuenta está en `party.js`.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R4.
 */

/** Las escuelas, con cómo se llaman. */
export const SCHOOLS = {
    evocacion: { label: 'Evocación', note: 'Fuego, frío y trueno: lo que se lanza.' },
    abjuracion: { label: 'Abjuración', note: 'Protegerse y deshacer.' },
    encantamiento: { label: 'Encantamiento', note: 'La mente: el sueño, el encanto, no ser visto.' },
    adivinacion: { label: 'Adivinación', note: 'Saber lo que no se ve.' },
    naturaleza: { label: 'Naturaleza', note: 'Las plantas, las bestias y el camino.' },
    divina: { label: 'Divina', note: 'Curar, bendecir y la luz.' },
    nigromancia: { label: 'Nigromancia', note: 'Lo que queda de los muertos. En muchos sitios, un crimen.' },
};

/** Las cargas de cada círculo por descanso largo (DR4). Los trucos no gastan. */
export const CIRCLE_CHARGES = { 1: 3, 2: 2, 3: 1 };

/** El nivel desde el que se lanza cada círculo. */
export const CIRCLE_LEVEL = { 0: 1, 1: 1, 2: 3, 3: 5 };

/** Cómo se dice cada círculo. */
export const CIRCLE_LABELS = { 0: 'truco', 1: '1.er círculo', 2: '2.º círculo', 3: '3.er círculo' };

/**
 * @typedef {Object} Spell
 * @property {string} id
 * @property {string[]} [aliases] Los ids que tenía cuando era una fila de datos.
 * @property {string} name
 * @property {string} school
 * @property {0|1|2|3} circle
 * @property {string[]} classes Quién lo aprende por su clase.
 * @property {string} note
 * @property {string} [component] Lo que se gasta al lanzarlo.
 * @property {boolean} [combat] `false` si solo sirve fuera del combate.
 * @property {boolean} [drain] Quien lo lanza se cura la mitad del daño.
 * @property {Record<string, any>} ability Las piezas de habilidad (`rules/abilities.js`).
 */

/** Todos los conjuros que existen. No hay otros. */
/** @type {Spell[]} */
export const SPELLS = [
    // --- Trucos: a voluntad
    {
        id: 'hab-rayo-fuego', aliases: ['rayo_de_fuego'], name: 'Rayo de fuego', school: 'evocacion', circle: 0, classes: ['mago'],
        note: 'Un dardo de fuego que no se acaba nunca. Prende lo que arde donde cae.',
        ability: { cost: 'action', target: 'enemy', resolution: 'attack', rangeFeet: 120, damage: '1d10', damageType: 'Fire' },
    },
    {
        id: 'mag-escarcha', name: 'Dedo de escarcha', school: 'evocacion', circle: 0, classes: ['mago'],
        note: 'Un frío que muerde. El agua donde cae se hiela.',
        ability: { cost: 'action', target: 'enemy', resolution: 'attack', rangeFeet: 60, damage: '1d8', damageType: 'Cold' },
    },
    {
        id: 'mag-latigo-espinas', name: 'Látigo de espinas', school: 'naturaleza', circle: 0, classes: ['druida'],
        note: 'Una rama que sale del suelo y azota.',
        ability: { cost: 'action', target: 'enemy', resolution: 'attack', rangeFeet: 30, damage: '1d6', damageType: 'Piercing', element: 'naturaleza' },
    },
    {
        id: 'mag-luz', name: 'Luz', school: 'divina', circle: 0, classes: ['clerigo', 'mago', 'bardo'],
        note: 'Una luz que no se apaga con el viento. En el campamento, la noche da menos miedo.',
        ability: { cost: 'action', target: 'self', resolution: 'auto', area: { shape: 'radius', size: 20 }, element: 'luz' },
    },
    {
        id: 'hab-mano-lejana', name: 'Mano lejana', school: 'abjuracion', circle: 0, classes: ['mago'],
        note: 'Coger, empujar o abrir algo a treinta pies.',
        ability: { cost: 'bonus', target: 'self', resolution: 'auto', rangeFeet: 30 },
    },
    // --- 1.er círculo: tres cargas
    {
        id: 'hab-curar', aliases: ['curar_heridas'], name: 'Curar heridas', school: 'divina', circle: 1, classes: ['clerigo', 'druida'],
        note: 'Cierra lo que se pueda cerrar, con las manos encima.',
        ability: { cost: 'action', target: 'ally', resolution: 'auto', rangeFeet: 5, healing: '1d8+3' },
    },
    {
        id: 'hab-bendicion', name: 'Bendición', school: 'divina', circle: 1, classes: ['clerigo'],
        note: 'Tres rondas pegando con la fe de su lado.',
        ability: { cost: 'action', target: 'ally', resolution: 'auto', rangeFeet: 30, condition: 'Bendecido', conditionRounds: 3 },
    },
    {
        id: 'hab-luz-severa', name: 'Luz severa', school: 'divina', circle: 1, classes: ['clerigo'],
        note: 'Una luz que quema a quien no la aguanta.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 60, saveAbility: 'dexterity', saveDc: 13, damage: '2d6', damageType: 'Radiant' },
    },
    {
        id: 'hab-escudo-arcano', name: 'Escudo arcano', school: 'abjuracion', circle: 1, classes: ['mago'],
        note: 'Una lámina de fuerza delante. Pegarle cuesta, esta ronda.',
        ability: { cost: 'free', target: 'self', resolution: 'auto', condition: 'Escudado', conditionRounds: 1 },
    },
    {
        id: 'hab-sueno', name: 'Sueño pesado', school: 'encantamiento', circle: 1, classes: ['mago', 'bardo'],
        note: 'Quien no aguanta, se duerme: pierde el turno y no se defiende.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 60, area: { shape: 'radius', size: 5 }, saveAbility: 'wisdom', saveDc: 13, condition: 'Unconscious', conditionRounds: 2 },
    },
    {
        id: 'hab-espinas', name: 'Zarzas', school: 'naturaleza', circle: 1, classes: ['druida'],
        note: 'El suelo se cierra alrededor de sus piernas. Y deja la maleza.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 60, area: { shape: 'radius', size: 5 }, saveAbility: 'strength', saveDc: 13, damage: '2d4', damageType: 'Piercing', condition: 'Restrained', conditionRounds: 2, element: 'naturaleza' },
    },
    {
        id: 'mag-ola-trueno', name: 'Ola de trueno', school: 'evocacion', circle: 1, classes: ['mago', 'druida', 'bardo'],
        note: 'Un estallido alrededor: tumba, y revienta las puertas.',
        ability: { cost: 'action', target: 'self', resolution: 'save', area: { shape: 'radius', size: 5 }, saveAbility: 'constitution', saveDc: 13, damage: '2d8', damageType: 'Thunder', condition: 'Prone', conditionRounds: 1 },
    },
    {
        id: 'mag-encanto', name: 'Encanto', school: 'encantamiento', circle: 1, classes: ['bardo', 'mago'], combat: false,
        note: 'Hablando, una carta que pesa mucho… y si se descubre, os tienen ganas.',
        ability: { cost: 'action', target: 'self', resolution: 'auto' },
    },
    {
        id: 'mag-detectar-mentiras', name: 'Detectar mentiras', school: 'adivinacion', circle: 1, classes: ['clerigo', 'bardo', 'mago'], combat: false,
        note: 'Hablando o preguntando por un caso, se sabe quién miente.',
        ability: { cost: 'action', target: 'self', resolution: 'auto' },
    },
    {
        id: 'mag-paso-sin-rastro', name: 'Paso sin rastro', school: 'naturaleza', circle: 1, classes: ['druida'], combat: false,
        note: 'Por el camino no se os sigue: los cazarrecompensas no os encuentran.',
        ability: { cost: 'action', target: 'self', resolution: 'auto' },
    },
    // --- 2.º círculo: dos cargas
    {
        id: 'mag-cono-escarcha', name: 'Cono de escarcha', school: 'evocacion', circle: 2, classes: ['mago'],
        note: 'Un soplo helado en cono. Hiela el agua; quien está en ella, se queda helado.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 15, area: { shape: 'cone', size: 15 }, saveAbility: 'constitution', saveDc: 14, damage: '3d6', damageType: 'Cold' },
    },
    {
        id: 'mag-relampago', name: 'Relámpago', school: 'evocacion', circle: 2, classes: ['mago'], component: 'Ámbar',
        note: 'Una línea de treinta pies que atraviesa a todos. Gasta un ámbar.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 30, area: { shape: 'line', size: 30 }, saveAbility: 'dexterity', saveDc: 14, damage: '3d6', damageType: 'Thunder' },
    },
    {
        id: 'mag-oracion', name: 'Oración de curación', school: 'divina', circle: 2, classes: ['clerigo'], component: 'Mirra',
        note: 'Todos los tuyos de alrededor recobran vida. Gasta mirra.',
        ability: { cost: 'action', target: 'ally', resolution: 'auto', rangeFeet: 30, area: { shape: 'radius', size: 15 }, healing: '2d4+2' },
    },
    {
        id: 'mag-invisibilidad', name: 'Invisibilidad', school: 'encantamiento', circle: 2, classes: ['mago', 'bardo'], component: 'Plumas negras',
        note: 'Dos rondas sin que se le vea: pega con ventaja. Gasta plumas negras.',
        ability: { cost: 'action', target: 'ally', resolution: 'auto', rangeFeet: 5, condition: 'Invisible', conditionRounds: 2 },
    },
    {
        id: 'mag-toque-vampirico', name: 'Toque vampírico', school: 'nigromancia', circle: 2, classes: ['mago'], drain: true,
        note: 'Lo que le quita, te lo quedas: te curas la mitad.',
        ability: { cost: 'action', target: 'enemy', resolution: 'attack', rangeFeet: 5, damage: '3d6', damageType: 'Necrotic' },
    },
    {
        id: 'mag-hablar-muertos', name: 'Hablar con los muertos', school: 'nigromancia', circle: 2, classes: ['clerigo', 'mago'], combat: false, component: 'Polvo de hueso',
        note: 'Un muerto contesta una pregunta: en un caso, una pista de la víctima. Gasta polvo de hueso.',
        ability: { cost: 'action', target: 'self', resolution: 'auto' },
    },
    {
        id: 'hab-forma-animal', name: 'Forma de bestia', school: 'naturaleza', circle: 2, classes: ['druida'],
        note: 'La bestia aguanta lo que el cuerpo no: recobra vida al cambiar.',
        ability: { cost: 'action', target: 'self', resolution: 'auto', healing: '2d8' },
    },
    // --- 3.er círculo: una carga
    {
        id: 'mag-bola-fuego', name: 'Bola de fuego', school: 'evocacion', circle: 3, classes: ['mago'], component: 'Azufre',
        note: 'Veinte pies de fuego donde cae, y todo lo que arde, ardiendo. Gasta azufre.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 120, area: { shape: 'radius', size: 15 }, saveAbility: 'dexterity', saveDc: 15, damage: '6d6', damageType: 'Fire' },
    },
    {
        id: 'mag-muro-fuego', name: 'Muro de fuego', school: 'evocacion', circle: 3, classes: ['mago', 'druida'], component: 'Azufre',
        note: 'Una línea de llamas que se queda ardiendo tres rondas. Gasta azufre.',
        ability: { cost: 'action', target: 'enemy', resolution: 'save', rangeFeet: 60, area: { shape: 'line', size: 30 }, saveAbility: 'dexterity', saveDc: 15, damage: '4d6', damageType: 'Fire', leaves: 'fuego' },
    },
    {
        id: 'mag-volver-orilla', name: 'Volver de la orilla', school: 'divina', circle: 3, classes: ['clerigo'], component: 'Mirra',
        note: 'A quien está en el suelo, lo trae de vuelta con media vida. Gasta mirra.',
        ability: { cost: 'action', target: 'ally', resolution: 'auto', rangeFeet: 5, healing: '4d8' },
    },
];

/** Lo que se gasta, de dónde sale y cuánto cuesta en la botica. */
export const COMPONENTS = {
    'Ámbar': { price: 25, from: 'la botica' },
    'Mirra': { price: 20, from: 'la botica o un templo' },
    'Azufre': { price: 30, from: 'la botica' },
    'Polvo de hueso': { price: 15, from: 'la botica, o un cementerio' },
    'Plumas negras': { price: 10, from: 'los cuervos y los buitres que se cazan' },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Por id y por alias. */
const BY_ID = new Map(/** @type {Array<[string, Spell]>} */ (SPELLS.flatMap(spell => [[spell.id, spell], ...(spell.aliases ?? []).map(alias => [alias, spell])])));

/** Por nombre, para cazar a quien quiera colar uno como fila de datos. */
const BY_NAME = new Map(SPELLS.map(spell => [plain(spell.name), spell]));

/**
 * Un conjuro por su id (o por el que tenía de fila de datos).
 *
 * @param {string} id
 * @returns {Spell|null}
 */
export function spellById(id) {
    return BY_ID.get(text(id)) ?? null;
}

/**
 * El conjuro como habilidad del motor: lo que `planAbilityUse` y el tablero ya saben
 * resolver, con su círculo y su escuela encima.
 *
 * @param {Spell} spell
 * @returns {any}
 */
export function spellAbility(spell) {
    return {
        id: spell.id,
        name: spell.name,
        description: spell.note,
        // Los trucos, a voluntad; lo demás gasta cargas de su círculo, no usos propios.
        resource: spell.circle === 0 ? 'at_will' : 'long_rest',
        usesPerRest: 1,
        ...spell.ability,
        school: spell.school,
        circle: spell.circle,
        ...(spell.component ? { component: spell.component } : {}),
        ...(spell.drain ? { drain: true } : {}),
        ...(spell.combat === false ? { combat: false } : {}),
    };
}

/** Todos, como habilidades. */
export function grimoireAbilities() {
    return SPELLS.map(spellAbility);
}

/**
 * Si una clase hace magia, y de qué.
 *
 * @param {string} className
 * @returns {string}
 */
export function classKey(className) {
    const kind = plain(className);
    if (/mago|maga|hechicer|wizard|sorcer|brujo|bruja/.test(kind)) return 'mago';
    if (/cleri|sacerd/.test(kind)) return 'clerigo';
    if (/druid/.test(kind)) return 'druida';
    if (/bard/.test(kind)) return 'bardo';
    return '';
}

/**
 * Lo que sabe por su clase a su nivel: los trucos y los círculos que ya lanza.
 *
 * @param {Object} input
 * @param {string} input.className
 * @param {number} [input.level]
 * @returns {string[]}
 */
export function spellsForClass({ className, level = 1 }) {
    const key = classKey(className);
    if (!key) return [];
    const at = Math.max(1, Math.floor(Number(level) || 1));
    return SPELLS
        .filter(spell => spell.classes.includes(key) && CIRCLE_LEVEL[spell.circle] <= at)
        .map(spell => spell.id);
}

/**
 * Los conjuros que alguien sabe, de su lista de habilidades (con los alias viejos).
 *
 * @param {any} member
 * @returns {Spell[]}
 */
export function knownSpells(member) {
    const seen = new Set();
    /** @type {Spell[]} */
    const out = [];
    for (const id of Array.isArray(member?.abilities) ? member.abilities : []) {
        const spell = spellById(String(typeof id === 'string' ? id : id?.id ?? ''));
        if (spell && !seen.has(spell.id)) {
            seen.add(spell.id);
            out.push(spell);
        }
    }
    return out;
}

/**
 * Las cargas que le quedan de un círculo.
 *
 * @param {any} member
 * @param {number} circle
 * @returns {number} `Infinity` para los trucos.
 */
export function chargesLeft(member, circle) {
    const c = Math.floor(Number(circle) || 0);
    if (c <= 0) return Infinity;
    const max = /** @type {Record<number, number>} */ (CIRCLE_CHARGES)[c] ?? 0;
    const used = Number(member?.spellCharges?.[c]) || 0;
    return Math.max(0, max - used);
}

/**
 * Gastar una carga, como parche para la ficha.
 *
 * @param {any} member
 * @param {number} circle
 * @returns {Record<string, number>}
 */
export function spendCharge(member, circle) {
    const c = Math.floor(Number(circle) || 0);
    const charges = { ...(member?.spellCharges ?? {}) };
    if (c > 0) charges[c] = Math.min(/** @type {Record<number, number>} */ (CIRCLE_CHARGES)[c] ?? 0, (Number(charges[c]) || 0) + 1);
    return charges;
}

/**
 * Si alguien puede lanzar un conjuro ahora, y si no, por qué.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.spell Un `Spell` o su habilidad.
 * @param {string[]} [input.carried] Lo que lleva encima el grupo, por nombre.
 * @returns {{ok: boolean, reason: string}}
 */
export function canCast({ member, spell, carried = [] }) {
    const circle = Math.floor(Number(spell?.circle) || 0);
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    const needs = /** @type {Record<number, number>} */ (CIRCLE_LEVEL)[circle] ?? 1;
    if (level < needs) return { ok: false, reason: `El ${CIRCLE_LABELS[/** @type {0|1|2|3} */ (circle)]} se lanza desde el nivel ${needs}.` };
    if (chargesLeft(member, circle) <= 0) return { ok: false, reason: `Sin cargas de ${CIRCLE_LABELS[/** @type {0|1|2|3} */ (circle)]}: vuelven con un descanso largo.` };
    const component = text(spell?.component);
    if (component && !carried.map(plain).includes(plain(component))) {
        return { ok: false, reason: `Hace falta ${component} (${COMPONENTS[/** @type {keyof typeof COMPONENTS} */ (component)]?.from ?? 'se compra'}).` };
    }
    return { ok: true, reason: '' };
}

/**
 * Las cargas, en una línea para la ficha: «Cargas: 1.º 2/3 · 2.º 2/2».
 *
 * @param {any} member
 * @returns {string}
 */
export function describeCharges(member) {
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    const parts = [1, 2, 3]
        .filter(c => /** @type {Record<number, number>} */ (CIRCLE_LEVEL)[c] <= level)
        .map(c => `${c}.º ${chargesLeft(member, c)}/${/** @type {Record<number, number>} */ (CIRCLE_CHARGES)[c]}`);
    return parts.length > 0 ? `Cargas: ${parts.join(' · ')}` : '';
}

/**
 * Si una fila de datos intenta ser magia: trae escuela o círculo, o se llama como un conjuro
 * del grimorio. La magia solo existe en el código.
 *
 * @param {any} row
 * @returns {string} Por qué no vale, o vacío.
 */
export function magicInData(row) {
    const name = text(row?.name) || text(row?.id) || '(sin nombre)';
    if (row?.school !== undefined || row?.circle !== undefined || row?.spell !== undefined) {
        return `${name}: la magia solo existe en el grimorio del juego; una fila de datos no puede traer escuela ni círculo.`;
    }
    const clash = BY_NAME.get(plain(row?.name));
    if (clash && !BY_ID.has(text(row?.id))) {
        return `${name}: se llama como un conjuro del grimorio. Para que alguien lo sepa, se nombra su id: ${clash.id}.`;
    }
    return '';
}

/**
 * Lo que el narrador tiene que saber, en una línea, solo si alguien del grupo hace magia.
 *
 * @param {any[]} party
 * @returns {string} Vacío si nadie la hace: cero tokens.
 */
export function magicLine(party) {
    const names = new Set();
    for (const member of Array.isArray(party) ? party : []) {
        if (member?.dead) continue;
        for (const spell of knownSpells(member)) names.add(spell.name);
    }
    if (names.size === 0) return '';
    return `[MAGIA] Lo que el grupo sabe lanzar: ${[...names].join(', ')}. No existe otra magia: si alguien intenta otra cosa, no pasa nada.`;
}

/**
 * El conjuro en una línea: «Bola de fuego · evocación, 3.er círculo · gasta azufre».
 *
 * @param {Spell} spell
 * @returns {string}
 */
export function describeSpell(spell) {
    const school = /** @type {any} */ (SCHOOLS)[spell.school]?.label?.toLowerCase() ?? spell.school;
    return [
        spell.name,
        `${school}, ${CIRCLE_LABELS[spell.circle]}`,
        spell.component ? `gasta ${spell.component.toLowerCase()}` : '',
        spell.combat === false ? 'fuera del combate' : '',
    ].filter(Boolean).join(' · ');
}
