/**
 * Las peleas sin muertes (J12.7 de wiki/ROADMAP_SIN_CONEXION.md): una pelea de taberna o un
 * duelo, a puñetazos.
 *
 * La regla es una bandera en el combate (`encounter.brawl`), y cambia cuatro cosas:
 *
 * - **Nadie muere.** Quien cae a 0 PG queda fuera de combate: sin salvaciones de muerte, sin
 *   heridas que queden, y al acabar se levanta con 1 PG y dolor de cabeza.
 * - **Puños y lo que haya a mano.** El golpe de siempre hace `FISTS` (un puñetazo, una jarra,
 *   la pata de una silla) y solo llega al de al lado; las sillas y los barriles se tiran (la
 *   maniobra de siempre, «Lanzar lo que hay a mano»), y se rompen.
 * - **Sin magia que hiere.** Lo que cura, protege o duerme vale; lo que quema o raja, no.
 * - **Se acaba cuando un bando está en el suelo o se rinde.** En un duelo, el rival también
 *   puede rendirse antes de caer.
 *
 * Aquí, lo que decide la regla y cómo se monta la pelea: el tablero de la taberna, los rivales
 * y quién se rinde. Lo que se gana o se pierde, y lo que dice el pueblo, está en
 * `campaign/tavern-brawl.js`. Puro: quien llama tira, guarda y enseña.
 */

/** Las dos clases de pelea sin muertes. */
export const BRAWL_KINDS = ['taberna', 'duelo'];

/** Por qué se pelea un duelo: por honor (fama) o por una apuesta (oro). */
export const DUEL_WAYS = ['honor', 'apuesta'];

/** Lo que se puede apostar en un duelo, en oro. */
export const STAKES = [5, 10, 25];

/** El daño de un puñetazo o de una jarra en la cabeza, a nivel 1. */
export const FISTS = '1d4';

/**
 * El daño de los puños de alguien, por su nivel: quien lleva años peleando pega más fuerte,
 * aunque sea sin arma. 1d4 hasta el nivel 4, 1d6 hasta el 8 y 1d8 desde el 9.
 *
 * @param {number} level
 * @returns {string}
 */
export function fistsFor(level) {
    const l = Math.floor(Number(level) || 1);
    return l >= 9 ? '1d8' : l >= 5 ? '1d6' : FISTS;
}

/** Hasta dónde llega un puño: la casilla de al lado. */
export const FIST_REACH_FEET = 5;

/** Lo que cobra el posadero por cada mueble roto. */
export const FURNITURE_PRICE = 3;

/** Por debajo de esta parte de su vida, un rival de duelo piensa en rendirse. */
export const YIELD_AT = 0.25;

/** Lo que se dice de la regla al empezar, para que no pille a nadie por sorpresa. */
export const RULE_LINE = 'Pelea sin muertes: a puñetazos y con lo que haya a mano. Quien cae a 0 PG queda fuera de combate, y la magia que hiere no vale.';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @typedef {Object} Brawl La bandera de la pelea, en `encounter.brawl`.
 * @property {'taberna'|'duelo'} kind
 * @property {'honor'|'apuesta'|''} way En un duelo, por qué; vacío en la taberna.
 * @property {'ellos'|'tu'|''} started En la taberna, quién la empezó.
 * @property {number} stake Lo apostado (duelo por apuesta).
 * @property {string} rival Quien reta o acepta el duelo, con su nombre.
 * @property {string} town La localización.
 * @property {string} tavern El nombre de la taberna, como se ve en el pueblo.
 * @property {string} board El tablero de la pelea (se quita al acabar).
 * @property {number} furniture Los muebles que había al empezar.
 * @property {string[]} watching En un duelo, los tuyos que miran (por id).
 * @property {number} rivals Cuántos había enfrente al empezar.
 * @property {string} back El tablero en el que se estaba antes (vacío: el pueblo), para volver.
 */

/**
 * La bandera leída, o nulo si no es una pelea sin muertes.
 *
 * @param {any} raw
 * @returns {Brawl|null}
 */
export function readBrawl(raw) {
    if (!isObject(raw)) return null;
    const kind = text(raw.kind);
    if (!BRAWL_KINDS.includes(kind)) return null;
    const way = kind === 'duelo' && DUEL_WAYS.includes(text(raw.way)) ? text(raw.way) : '';
    const started = kind === 'taberna' && ['ellos', 'tu'].includes(text(raw.started)) ? text(raw.started) : '';
    return {
        kind: /** @type {'taberna'|'duelo'} */ (kind),
        way: /** @type {'honor'|'apuesta'|''} */ (kind === 'duelo' ? (way || 'apuesta') : ''),
        started: /** @type {'ellos'|'tu'|''} */ (kind === 'taberna' ? (started || 'ellos') : ''),
        stake: Math.max(0, Math.floor(Number(raw.stake) || 0)),
        rival: text(raw.rival),
        town: text(raw.town),
        tavern: text(raw.tavern),
        board: text(raw.board),
        furniture: Math.max(0, Math.floor(Number(raw.furniture) || 0)),
        watching: (Array.isArray(raw.watching) ? raw.watching : []).map(text).filter(Boolean),
        rivals: Math.max(0, Math.floor(Number(raw.rivals) || 0)),
        back: text(raw.back),
    };
}

/**
 * La pelea sin muertes en marcha, si el combate lo es.
 *
 * @param {any} encounter
 * @returns {Brawl|null}
 */
export function brawlOf(encounter) {
    return encounter?.active ? readBrawl(encounter.brawl) : null;
}

/**
 * Si alguien del grupo está mirando el duelo (no pelea: nadie le pega y no tiene turno).
 *
 * @param {any} encounter
 * @param {string|number} memberId
 * @returns {boolean}
 */
export function isWatching(encounter, memberId) {
    const brawl = brawlOf(encounter);
    return Boolean(brawl) && /** @type {Brawl} */ (brawl).watching.includes(String(memberId ?? ''));
}

/**
 * Quien pelea de los tuyos y sigue en pie: sin los que miran ni los muertos.
 *
 * @template {{id: any, hp?: any, dead?: any}} T
 * @param {T[]} party
 * @param {Brawl|null} brawl
 * @returns {T[]}
 */
export function standingFighters(party, brawl) {
    const watching = new Set(brawl?.watching ?? []);
    return (Array.isArray(party) ? party : []).filter(m => !m?.dead && (Number(m?.hp) || 0) > 0 && !watching.has(String(m?.id)));
}

/**
 * Quien cae a 0 en una pelea sin muertes: fuera de combate, sin tirar salvaciones (está
 * estable desde el primer momento) y con lo suyo encima. Lo que cambia en su ficha.
 *
 * @param {any} member
 * @returns {{hp: number, deathSaves: {successes: number, failures: number, stable: boolean, dead: boolean}, activeConditions: string[]}}
 */
export function knockOut(member) {
    const conditions = (Array.isArray(member?.activeConditions) ? member.activeConditions : []).map(String);
    return {
        hp: 0,
        deathSaves: { successes: 0, failures: 0, stable: true, dead: false },
        activeConditions: conditions.includes('Unconscious') ? conditions : [...conditions, 'Unconscious'],
    };
}

/**
 * Lo que se lee cuando alguien del grupo cae en una pelea sin muertes.
 *
 * @param {string} name
 * @returns {string}
 */
export function knockOutLine(name) {
    return `💫 ${text(name) || 'Alguien'} cae redondo y se queda en el suelo: fuera de combate. Aquí nadie muere.`;
}

/**
 * Al acabar: quien quedó fuera de combate se levanta con 1 PG. Lo que cambia en su ficha, o
 * nulo si seguía en pie.
 *
 * @param {any} member
 * @returns {{hp: number, deathSaves: {successes: number, failures: number, stable: boolean, dead: boolean}, activeConditions: string[]}|null}
 */
export function wakeUp(member) {
    if (!member || member.dead || (Number(member.hp) || 0) > 0) return null;
    return {
        hp: 1,
        deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
        activeConditions: (Array.isArray(member.activeConditions) ? member.activeConditions : []).map(String).filter(c => c !== 'Unconscious'),
    };
}

/**
 * Si una habilidad o un conjuro hiere de verdad: lo que hace daño y no va a un aliado (contra
 * alguien, o alrededor de quien lo lanza, como una onda atronadora). Lo que cura, protege,
 * duerme o asusta, no.
 *
 * @param {any} ability
 * @returns {boolean}
 */
export function isLethalAbility(ability) {
    if (!isObject(ability)) return false;
    return text(ability.target) !== 'ally' && Boolean(text(ability.damage));
}

/**
 * Por qué no se puede usar algo en una pelea sin muertes; vacío si se puede.
 *
 * @param {any} ability
 * @param {Brawl|null} brawl
 * @returns {string}
 */
export function brawlRefusal(ability, brawl) {
    if (!brawl || !isLethalAbility(ability)) return '';
    const what = brawl.kind === 'duelo' ? 'un duelo a puñetazos' : 'una pelea de taberna';
    return `En ${what} no vale ${text(ability.name) || 'la magia que hiere'}: aquí se pega con los puños. Lo que cura, protege o duerme sí se puede usar.`;
}

/**
 * Si un rival de duelo se rinde en su turno: por debajo de `YIELD_AT` de su vida, y con su
 * suerte. Quien pelea por honor aguanta más (se rinde menos veces).
 *
 * @param {Object} input
 * @param {Brawl|null} input.brawl
 * @param {any} input.enemy
 * @param {() => number} input.random
 * @returns {boolean}
 */
export function wantsToYield({ brawl, enemy, random }) {
    if (!brawl || brawl.kind !== 'duelo' || !enemy) return false;
    const hp = Number(enemy.currentHp) || 0;
    const max = Math.max(1, Number(enemy.maxHp) || 1);
    if (hp <= 0 || hp / max > YIELD_AT) return false;
    return random() < (brawl.way === 'honor' ? 0.35 : 0.6);
}

/**
 * Lo que dice quien se rinde en un duelo.
 *
 * @param {string} name
 * @returns {string}
 */
export function yieldLine(name) {
    return `🏳️ ${text(name) || 'Tu rival'} levanta las manos, escupe sangre y dice que ya basta: se rinde.`;
}

/** Los muebles de una taberna: mesas y sillas (media cobertura), bancos (tres cuartos) y barriles. */
const FURNITURE = new Set(['cover_half', 'cover_three_quarters', 'barrel']);

/**
 * Cuántos muebles hay en un tablero.
 *
 * @param {any} terrain El terreno del tablero (`cells`, por `x,y`).
 * @returns {number}
 */
export function countFurniture(terrain) {
    const cells = isObject(terrain?.cells) ? terrain.cells : {};
    return Object.values(cells).filter(cell => FURNITURE.has(text(/** @type {any} */ (cell)?.type))).length;
}

/**
 * Cuántos muebles se han roto en la pelea.
 *
 * @param {Brawl|null} brawl
 * @param {any} terrain El de ahora.
 * @returns {number}
 */
export function brokenFurniture(brawl, terrain) {
    if (!brawl) return 0;
    return Math.max(0, brawl.furniture - countFurniture(terrain));
}

/**
 * Cómo acabó, de lo que dice el combate: `victory` es ganar, `defeat` perder (todos los tuyos en
 * el suelo), `fled` o `yield` es rendirse, y lo demás (se corta a mano, se paga la paz) tablas.
 *
 * @param {string} reason
 * @returns {'gana'|'pierde'|'rinde'|'tablas'}
 */
export function verdictOf(reason) {
    const said = text(reason);
    if (said === 'victory') return 'gana';
    if (said === 'defeat') return 'pierde';
    if (said === 'fled' || said === 'yield') return 'rinde';
    return 'tablas';
}

// ---------------------------------------------------------------------------------------
// El tablero

/**
 * Las tabernas donde se pelea: la barra arriba (con sus toneles detrás), mesas y sillas en
 * medio. Los camorristas empiezan junto a la barra y el grupo junto a la puerta.
 *
 * `#` muro y barra, `C` toneles apilados (tres cuartos de cobertura: no se tiran ni revientan,
 * como los barriles de pólvora), `c` mesa o silla (media cobertura: se coge y se tira). 14 × 10.
 */
const TAVERN_MAPS = [
    [
        '##############',
        '#CC.......CC.#',
        '#...######...#',
        '#............#',
        '#.cc....c....#',
        '#......cc..c.#',
        '#..c.........#',
        '#......c..cc.#',
        '#............#',
        '##############',
    ],
    [
        '##############',
        '#.CC......CC.#',
        '#..########..#',
        '#............#',
        '#..c..c..c...#',
        '#.cc......cc.#',
        '#............#',
        '#..c.cc...c..#',
        '#............#',
        '##############',
    ],
];

/** Donde se pelea un duelo: las mesas apartadas a las paredes y el corro en medio. 14 × 9. */
const DUEL_MAP = [
    '##############',
    '#CC.c....c.CC#',
    '#c..........c#',
    '#............#',
    '#c..........c#',
    '#............#',
    '#c..........c#',
    '#..c..cc..c..#',
    '##############',
];

/** Los nombres de los tableros (uno por localización: se quita al acabar). */
export const BRAWL_BOARD = 'Pelea en la taberna';
export const DUEL_BOARD = 'Duelo en la taberna';

/** Donde empieza cada bando, en cada mapa: los rivales junto a la barra, el grupo en la puerta. */
const TAVERN_FOES = [{ x: 4, y: 3 }, { x: 8, y: 3 }, { x: 11, y: 3 }, { x: 6, y: 3 }];
const TAVERN_PARTY = [{ x: 4, y: 8 }, { x: 7, y: 8 }, { x: 10, y: 8 }, { x: 2, y: 8 }, { x: 12, y: 8 }, { x: 5, y: 8 }];
const DUEL_HERO = { x: 4, y: 4 };
const DUEL_RIVAL = { x: 9, y: 4 };
/** En un duelo, los tuyos miran desde la pared de abajo. */
const DUEL_WATCH = [{ x: 1, y: 7 }, { x: 4, y: 7 }, { x: 8, y: 7 }, { x: 12, y: 7 }, { x: 2, y: 5 }, { x: 11, y: 5 }];

/**
 * El tablero de la pelea, como lo escribe un paquete de campaña (con su mapa en letras), para
 * ponerlo en la localización. Su nombre es siempre el mismo y lleva «taberna», que es lo que le
 * da el suelo y las paredes de madera (`boardBiome`): con el nombre del pueblo detrás, «Puerto
 * Alba» o «Aldea de Barovia» lo pintaban de hierba o de calle.
 *
 * @param {Object} input
 * @param {'taberna'|'duelo'} input.kind
 * @param {string} input.town
 * @param {number} input.fighters Cuántos de los tuyos entran (o miran, en un duelo).
 * @param {number} input.rivals Cuántos hay enfrente.
 * @param {() => number} [input.random] Para elegir la taberna.
 * @returns {{board: {id: string, name: string, locationName: string, map: string[], partyStart: Array<{x: number, y: number}>, enemies: any[]},
 *   partyCells: Array<{x: number, y: number}>, rivalCells: Array<{x: number, y: number}>}} `board.partyStart`:
 *   alrededor de dónde se coloca quien pelea antes de la iniciativa; `partyCells`: dónde empieza cada uno, quien
 *   pelea primero y, en un duelo, luego los que miran.
 */
export function brawlBoard({ kind, town, fighters, rivals, random = Math.random }) {
    const place = text(town) || 'el pueblo';
    if (kind === 'duelo') {
        const watchers = Math.max(0, Math.floor(Number(fighters) || 0) - 1);
        const partyCells = [DUEL_HERO, ...DUEL_WATCH.slice(0, watchers)];
        return {
            board: {
                id: 'duelo-taberna',
                name: DUEL_BOARD,
                locationName: place,
                map: [...DUEL_MAP],
                // Las casillas de salida al colocarse (tanda 10): solo el corro; la pared es de los que miran.
                partyStart: [{ ...DUEL_HERO }],
                enemies: [],
            },
            partyCells: partyCells.map(c => ({ ...c })),
            rivalCells: [{ ...DUEL_RIVAL }],
        };
    }
    const map = TAVERN_MAPS[Math.floor(random() * TAVERN_MAPS.length) % TAVERN_MAPS.length];
    const count = Math.max(1, Math.min(TAVERN_PARTY.length, Math.floor(Number(fighters) || 1)));
    const partyCells = TAVERN_PARTY.slice(0, count).map(c => ({ ...c }));
    const rivalCells = TAVERN_FOES.slice(0, Math.max(1, Math.min(TAVERN_FOES.length, Math.floor(Number(rivals) || 1)))).map(c => ({ ...c }));
    return {
        board: {
            id: 'pelea-taberna',
            name: BRAWL_BOARD,
            locationName: place,
            map: [...map],
            partyStart: partyCells.map(c => ({ ...c })),
            enemies: [],
        },
        partyCells,
        rivalCells,
    };
}

// ---------------------------------------------------------------------------------------
// Los rivales

/**
 * Cuántos camorristas salen a pelear contra un grupo: uno por cada uno de los tuyos, entre dos
 * y cuatro.
 *
 * @param {number} fighters
 * @returns {number}
 */
export function rowdyCount(fighters) {
    return Math.max(2, Math.min(4, Math.floor(Number(fighters) || 1)));
}

/**
 * La ficha de un camorrista para el nivel del grupo: poca armadura, algo de fuerza y los puños.
 * El daño sale de su valor de desafío (`getEnemyDamageFormula`): 1d6 o 1d8 más su Fuerza.
 *
 * @param {number} level El nivel medio del grupo.
 * @returns {{maxHp: number, armorClass: number, strength: number, dexterity: number, constitution: number, intelligence: number, wisdom: number, charisma: number, speed: number, cr: number}}
 */
export function rowdyStats(level) {
    const l = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    return {
        maxHp: 5 + 3 * l,
        armorClass: 10 + Math.floor(l / 4),
        strength: 12 + Math.floor(l / 3),
        dexterity: 10,
        constitution: 12,
        intelligence: 8,
        wisdom: 10,
        charisma: 8,
        speed: 30,
        cr: l <= 2 ? 0.125 : l <= 5 ? 0.5 : 1,
    };
}

/**
 * La ficha de quien pelea un duelo: uno solo, así que aguanta más que un camorrista.
 *
 * @param {number} level El nivel de tu héroe.
 * @param {'honor'|'apuesta'} way
 * @returns {ReturnType<typeof rowdyStats>}
 */
export function duelistStats(level, way) {
    const l = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    const honor = way === 'honor';
    return {
        maxHp: (honor ? 9 : 10) + (honor ? 4 : 5) * l,
        armorClass: 11 + Math.floor(l / 3),
        strength: 14 + Math.floor(l / 4),
        dexterity: 12,
        constitution: 13,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        speed: 30,
        cr: l <= 2 ? 0.5 : l <= 5 ? 1 : 2,
    };
}

/**
 * Los rivales, listos para el combate (sin su id ni su casilla, que pone quien llama).
 *
 * @param {Object} input
 * @param {'taberna'|'duelo'} input.kind
 * @param {'honor'|'apuesta'|''} [input.way]
 * @param {number} input.level
 * @param {Array<{name: string, archetype?: string}>} input.who Quiénes: los camorristas o el rival.
 * @returns {any[]}
 */
export function rivalFighters({ kind, way = '', level, who }) {
    const list = (Array.isArray(who) ? who : []).filter(w => text(w?.name));
    const stats = kind === 'duelo' ? duelistStats(level, way === 'honor' ? 'honor' : 'apuesta') : rowdyStats(level);
    /** @type {Map<string, number>} */
    const seen = new Map();
    for (const w of list) seen.set(text(w.name), (seen.get(text(w.name)) ?? 0) + 1);
    /** @type {Map<string, number>} */
    const numbered = new Map();
    return list.map(w => {
        const base = text(w.name);
        const n = (numbered.get(base) ?? 0) + 1;
        numbered.set(base, n);
        return {
            templateId: kind === 'duelo' ? 'duelo-taberna' : 'pelea-taberna',
            name: (seen.get(base) ?? 0) > 1 ? `${base} ${n}` : base,
            ...(text(w.archetype) ? { archetype: text(w.archetype) } : {}),
            currentHp: stats.maxHp,
            ...stats,
            profile: 'aggressive',
            role: 'bruto',
            attackRangeFeet: FIST_REACH_FEET,
            boss: false,
            brawler: true,
        };
    });
}
