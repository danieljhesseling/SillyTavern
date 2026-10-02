/**
 * La pelea contada rápido: ¿es fácil o difícil este tablero? (J5.9 de ROADMAP_SIN_CONEXION).
 *
 * El taller de campañas del gremio quiere saber, antes de jugar, qué peleas de una campaña se
 * quedan cortas y cuáles se pasan. `tools/sim-campana.mjs` lo mide de verdad, pero juega el
 * juego entero en un navegador y tarda media hora. Esto es la cuenta de servilleta: un grupo
 * de cuatro del nivel recomendado contra los enemigos del tablero, doscientas veces, sin
 * mapa (todos llegan a todos), y lo que sale.
 *
 * Con las reglas del juego, no las del manual:
 *
 * - **Los enemigos** pegan como en `party/enemy-turn.js`: un d20 con su modificador (los de
 *   un paquete no traen Fuerza ni Destreza, así que +0) y el daño de su desafío (la tabla de
 *   `getEnemyDamageFormula`). Un jefe contesta una vez por ronda (idea 24): pega dos veces.
 * - **El grupo** es el de siempre en D&D: guerrero, clérigo, pícaro y mago, con la vida de su
 *   dado de golpe, su modificador (+3, y +1 a nivel 4 y a nivel 8) y, cada cuatro niveles, un
 *   punto de puntería y de CA, que es lo que dan las mejoras de subir (`level-perks.js`). El
 *   clérigo cura con sus espacios y el mago gasta los suyos en lo que da a varios.
 * - **Sin mapa**: no hay casillas, ni cobertura, ni flanqueo, ni puertas; solo que la primera
 *   ronda es para acercarse (pega quien llega de lejos). Un tablero que se gana por la posición
 *   sale más difícil de lo que es, y uno de arqueros tras un foso, más fácil. Tampoco cuenta los
 *   conjuros de 5e de un enemigo (`enemy-spells.js`) ni las maniobras de 2024. Es una
 *   aproximación, y lo dice.
 *
 * Puro y determinista: con la misma semilla, lo mismo. `simulateBoards` va tablero a tablero
 * y devuelve el control al navegador entre uno y otro, para no congelar la ventana.
 */

import { createSeededRandom, rollWith } from './seeded-random.js';

/** Cuántas peleas se juegan por tablero. Con 200, el porcentaje baila menos de un 5 %. */
export const SIM_RUNS = 200;

/** A partir de aquí, la pelea no acaba: el grupo no puede con ellos ni ellos con el grupo. */
export const SIM_MAX_ROUNDS = 20;

/** El tamaño del grupo para el que se escriben los tableros (`WRITTEN_PARTY_SIZE`). */
export const SIM_PARTY_SIZE = 4;

/**
 * Lo que dice cada veredicto. `key` es estable (lo leen las pruebas y el CSS).
 */
export const SIM_VERDICTS = {
    'muy-facil': { label: 'Demasiado fácil', note: 'Se gana siempre y casi sin un rasguño.' },
    justa: { label: 'Justa', note: 'Se gana casi siempre, pero cuesta.' },
    dificil: { label: 'Difícil', note: 'Se pierde a menudo, o se gana con el grupo en el suelo.' },
    'muy-dificil': { label: 'Demasiado difícil', note: 'Se pierde más de la mitad de las veces.' },
};

/**
 * La misma tabla que `getEnemyDamageFormula` (party/combat-rules.js): el daño de un golpe por
 * el desafío. Repetida aquí porque aquella vive con el estado del combate y esto es puro.
 *
 * @param {number} cr
 * @returns {string}
 */
export function enemyDamageFormula(cr) {
    const value = Number(cr) || 0;
    if (value <= 0.5) return '1d6';
    if (value <= 2) return '1d8';
    if (value <= 5) return '2d6';
    if (value <= 10) return '2d8';
    return '3d8';
}

/**
 * @typedef {Object} SimFighter
 * @property {string} name
 * @property {string} role guerrero | clerigo | picaro | mago | enemigo
 * @property {number} maxHp
 * @property {number} hp
 * @property {number} ac
 * @property {number} attack Lo que se suma al d20.
 * @property {string} damage La fórmula del golpe, sin el modificador.
 * @property {number} damageBonus
 * @property {number} attacks Golpes por turno.
 * @property {number} initiative Lo que se suma a la iniciativa.
 * @property {number} reach Hasta dónde llega, en pies: con 5, cuerpo a cuerpo.
 * @property {boolean} [boss]
 * @property {string[]} [heals] Las curas que le quedan (la clériga), de la más fuerte a la más floja.
 * @property {Array<{dice: string, reach: number}>} [blasts] Los conjuros de área que le quedan (el
 *   mago): su daño y a cuántos alcanza.
 */

/**
 * El grupo de cuatro de un nivel. El quinto o el sexto, si se pide, repiten guerrero y pícaro.
 *
 * @param {number} level
 * @param {number} [size]
 * @returns {SimFighter[]}
 */
export function simParty(level, size = SIM_PARTY_SIZE) {
    const L = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    const mod = 3 + (L >= 4 ? 1 : 0) + (L >= 8 ? 1 : 0);
    const perk = Math.floor((L - 1) / 4);
    // Con su dado de golpe: el primer nivel entero y luego la media, más la Constitución.
    const hp = (/** @type {number} */ die, /** @type {number} */ con) => die + con + (L - 1) * (die / 2 + 1 + con);
    // Las cargas de conjuro del grimorio (`CIRCLE_CHARGES` y `CIRCLE_LEVEL`): tres del 1.er
    // círculo desde nivel 1, dos del 2.º desde el 3 y una del 3.º desde el 5, con los conjuros del
    // grimorio: Bola de fuego (6d6), Cono de escarcha (3d6) y Ola de trueno (2d8). El mago las
    // gasta en lo que da a varios, de lo más fuerte a lo más flojo; la clériga, en curar (Curar
    // heridas y Oración de curación).
    /** @type {Array<{dice: string, reach: number}>} */
    const blasts = [...(L >= 5 ? [{ dice: '6d6', reach: 3 }] : []), ...(L >= 3 ? [{ dice: '3d6', reach: 2 }, { dice: '3d6', reach: 2 }] : []),
        { dice: '2d8', reach: 2 }, { dice: '2d8', reach: 2 }, { dice: '2d8', reach: 2 }];
    const heals = [...(L >= 5 ? ['2d8+3'] : []), ...(L >= 3 ? ['2d4+2', '2d4+2'] : []), '1d8+3', '1d8+3', '1d8+3'];
    /** @type {SimFighter[]} */
    const roster = [
        { name: 'Guerrero', role: 'guerrero', maxHp: hp(10, 2), hp: 0, ac: 16 + perk, attack: mod + perk, damage: '1d8', damageBonus: mod, attacks: 1, initiative: 1, reach: 5 },
        { name: 'Clériga', role: 'clerigo', maxHp: hp(8, 2), hp: 0, ac: 16 + perk, attack: mod - 1 + perk, damage: '1d6', damageBonus: mod - 1, attacks: 1, initiative: 0, reach: 5, heals },
        { name: 'Pícara', role: 'picaro', maxHp: hp(8, 1), hp: 0, ac: 14 + perk, attack: mod + perk, damage: '1d6', damageBonus: mod, attacks: 1, initiative: mod, reach: 80 },
        { name: 'Mago', role: 'mago', maxHp: hp(6, 1), hp: 0, ac: 12 + perk, attack: mod + perk, damage: L >= 5 ? '2d10' : '1d10', damageBonus: 0, attacks: 1, initiative: 2, reach: 120, blasts },
    ];
    /** @type {SimFighter[]} */
    const out = [];
    for (let i = 0; i < Math.max(1, Math.floor(Number(size) || SIM_PARTY_SIZE)); i++) {
        const base = roster[i < roster.length ? i : (i % 2 === 0 ? 0 : 2)];
        out.push({ ...base, name: i < roster.length ? base.name : `${base.name} ${Math.floor(i / 2)}`, maxHp: Math.round(base.maxHp), hp: Math.round(base.maxHp) });
    }
    return out;
}

/** La media de una fórmula de dados: `2d6+1` → 8. @param {string} formula @returns {number} */
function average(formula) {
    let total = 0;
    for (const [, sign, count, sides, flat] of String(formula ?? '').replace(/\s+/g, '').matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/gi)) {
        const k = sign === '-' ? -1 : 1;
        total += sides ? k * Number(count || 1) * (Number(sides) + 1) / 2 : k * Number(flat);
    }
    return total;
}

/**
 * Los enemigos de un tablero, con sus números del bestiario del paquete.
 *
 * Una habilidad suya que hace daño (`hab-embate`, `rayo_de_fuego`…) cuenta como su golpe si pega
 * más que el de su desafío, y la de lejos le deja pegar desde el principio.
 *
 * @param {any[]} placements Los `enemies` del tablero: `{name, x, y}`.
 * @param {any[]} bestiary El `bestiary` del paquete.
 * @param {any[]} [abilities] Las `abilities` del paquete.
 * @returns {{foes: SimFighter[], unknown: string[]}}
 */
export function simEnemies(placements, bestiary, abilities = []) {
    const byName = new Map((Array.isArray(bestiary) ? bestiary : [])
        .filter(b => b && b.name).map(b => [String(b.name).trim().toLowerCase(), b]));
    const abilityById = new Map((Array.isArray(abilities) ? abilities : []).filter(a => a && a.id).map(a => [String(a.id), a]));
    /** @type {SimFighter[]} */
    const foes = [];
    /** @type {string[]} */
    const unknown = [];
    for (const placement of Array.isArray(placements) ? placements : []) {
        const name = String(placement?.name ?? '').trim();
        if (!name) continue;
        const row = byName.get(name.toLowerCase());
        if (!row && !unknown.includes(name)) unknown.push(name);
        const cr = Number(row?.cr) || 0.25;
        // Lo que lleva el paquete; si no lo dice, el bicho corriente de su desafío (`baselineFor`).
        const hp = Math.max(1, Math.round(Number(row?.hp) || (9 + cr * 12)));
        const strength = Number(row?.strength ?? row?.str) || 10;
        const dexterity = Number(row?.dexterity ?? row?.dex) || 10;
        const modOf = (/** @type {number} */ score) => Math.floor((score - 10) / 2);
        let damage = enemyDamageFormula(cr);
        let reach = Number(row?.attackRangeFeet) || 5;
        for (const id of Array.isArray(row?.abilities) ? row.abilities : []) {
            const ability = abilityById.get(String(id));
            if (!ability?.damage || ability.target === 'self' || ability.target === 'ally') continue;
            if (average(ability.damage) > average(damage)) damage = String(ability.damage);
            reach = Math.max(reach, Number(ability.rangeFeet ?? ability.range) || 5);
        }
        foes.push({
            name,
            role: 'enemigo',
            maxHp: hp,
            hp,
            ac: Math.max(5, Number(row?.armorClass ?? row?.ac) || (11 + Math.floor(cr / 2))),
            attack: Math.max(modOf(strength), modOf(dexterity)),
            damage,
            damageBonus: Math.max(0, modOf(strength)),
            attacks: row?.boss || placement?.boss ? 2 : 1,
            initiative: modOf(dexterity),
            reach,
            boss: Boolean(row?.boss || placement?.boss),
        });
    }
    return { foes, unknown };
}

/**
 * Un golpe: el d20 contra la CA (un 20 siempre entra, y dobla los dados).
 *
 * @param {SimFighter} by
 * @param {SimFighter} at
 * @param {() => number} random
 * @returns {number} El daño hecho (0 si falla).
 */
function strike(by, at, random) {
    const natural = Math.floor(random() * 20) + 1;
    if (natural !== 20 && natural + by.attack < at.ac) return 0;
    const dice = rollWith(by.damage, random).total + (natural === 20 ? rollWith(by.damage, random).total : 0);
    return Math.max(1, dice + by.damageBonus);
}

/**
 * Una pelea entera.
 *
 * @param {SimFighter[]} partyTemplate
 * @param {SimFighter[]} foesTemplate
 * @param {() => number} random
 * @returns {{won: boolean, stuck: boolean, rounds: number, hpLost: number, down: number}}
 */
export function simulateFight(partyTemplate, foesTemplate, random) {
    // Cada pelea empieza con todo: vida entera y todas las cargas.
    const party = partyTemplate.map(f => ({ ...f, hp: f.maxHp, heals: [...(f.heals ?? [])], blasts: [...(f.blasts ?? [])] }));
    const foes = foesTemplate.map(f => ({ ...f, hp: f.maxHp }));
    const alive = (/** @type {SimFighter[]} */ list) => list.filter(f => f.hp > 0);
    const order = [...party, ...foes]
        .map(f => ({ f, roll: Math.floor(random() * 20) + 1 + f.initiative + random() / 10 }))
        .sort((a, b) => b.roll - a.roll)
        .map(e => e.f);
    /** A quién va cada uno del grupo: sigue con el mismo hasta tumbarlo, como quien juega. */
    /** @type {Map<SimFighter, SimFighter>} */
    const aim = new Map();
    let rounds = 0;
    while (alive(party).length > 0 && alive(foes).length > 0 && rounds < SIM_MAX_ROUNDS) {
        rounds++;
        for (const actor of order) {
            if (actor.hp <= 0) continue;
            // La primera ronda se acerca cada uno: solo pega quien llega de lejos.
            const close = rounds > 1 || actor.reach > 5;
            const mine = foes.includes(actor) ? foes : party;
            const theirs = mine === foes ? party : foes;
            const targets = alive(theirs);
            if (targets.length === 0) break;
            if (mine === party) {
                // La clériga levanta al que ha caído o cura al que está por debajo de la mitad.
                if (actor.role === 'clerigo' && (actor.heals ?? []).length > 0) {
                    const hurt = party.filter(p => p.hp < p.maxHp / 2).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                    if (hurt) {
                        const dice = String(actor.heals?.shift() ?? '1d8+3');
                        hurt.hp = Math.min(hurt.maxHp, Math.max(0, hurt.hp) + rollWith(dice, random).total);
                        continue;
                    }
                }
                // El mago gasta una carga si hay dos o más a los que darles.
                if (actor.role === 'mago' && (actor.blasts ?? []).length > 0 && targets.length >= 2) {
                    const blast = actor.blasts?.shift() ?? { dice: '2d8', reach: 2 };
                    const caught = targets.slice(0, Math.min(blast.reach, targets.length));
                    const total = rollWith(blast.dice, random).total;
                    // Media salvación: la mitad de las veces se queda en la mitad.
                    for (const foe of caught) foe.hp -= random() < 0.5 ? Math.floor(total / 2) : total;
                    continue;
                }
                if (!close) continue;
                for (let n = 0; n < actor.attacks; n++) {
                    let target = aim.get(actor);
                    if (!target || target.hp <= 0) {
                        const standing = alive(foes);
                        if (standing.length === 0) break;
                        target = standing[Math.floor(random() * standing.length)];
                        aim.set(actor, target);
                    }
                    target.hp -= strike(actor, target, random);
                }
                continue;
            }
            if (!close) continue;
            // Los enemigos van a por quien tienen delante: el guerrero y la clériga, el doble.
            for (let n = 0; n < actor.attacks; n++) {
                const standing = alive(party);
                if (standing.length === 0) break;
                const weights = standing.map(p => (p.role === 'guerrero' || p.role === 'clerigo' ? 2 : 1));
                let pick = random() * weights.reduce((s, w) => s + w, 0);
                let target = standing[0];
                for (let i = 0; i < standing.length; i++) {
                    pick -= weights[i];
                    if (pick < 0) {
                        target = standing[i];
                        break;
                    }
                }
                target.hp -= strike(actor, target, random);
            }
        }
    }
    const won = alive(foes).length === 0 && alive(party).length > 0;
    const total = party.reduce((s, p) => s + p.maxHp, 0);
    const left = party.reduce((s, p) => s + Math.max(0, p.hp), 0);
    return {
        won,
        stuck: !won && alive(party).length > 0 && rounds >= SIM_MAX_ROUNDS,
        rounds,
        hpLost: total > 0 ? (total - left) / total : 0,
        down: party.filter(p => p.hp <= 0).length,
    };
}

/**
 * @typedef {Object} BoardSim
 * @property {string} id
 * @property {string} name
 * @property {number} level El nivel con el que se ha jugado.
 * @property {{low: number, high: number}|null} band Para qué nivel es el tablero.
 * @property {number} enemies Cuántos.
 * @property {string} foes Quiénes: «3 lobos, Karl».
 * @property {number} winRate De 0 a 1.
 * @property {number} rounds Las rondas de media.
 * @property {number} hpLost La vida perdida del grupo, de 0 a 1, de media.
 * @property {number} down Los del grupo en el suelo al acabar, de media.
 * @property {number} stuck Las que no acaban, de 0 a 1.
 * @property {keyof typeof SIM_VERDICTS} verdict
 * @property {string} said La frase entera, para leer.
 * @property {string[]} unknown Enemigos que no están en el bestiario (se juegan como uno corriente).
 */

/**
 * El veredicto de una serie de peleas.
 *
 * @param {{winRate: number, hpLost: number, rounds: number}} stats
 * @returns {keyof typeof SIM_VERDICTS}
 */
export function simVerdict({ winRate, hpLost, rounds }) {
    if (winRate < 0.5) return 'muy-dificil';
    if (winRate < 0.85 || hpLost > 0.65) return 'dificil';
    if (winRate >= 0.99 && hpLost < 0.12 && rounds <= 3) return 'muy-facil';
    return 'justa';
}

/**
 * «3 lobos, Karl el Sordo»: los enemigos de un tablero, contados.
 *
 * @param {SimFighter[]} foes
 * @returns {string}
 */
function foesLine(foes) {
    /** @type {Map<string, number>} */
    const count = new Map();
    for (const foe of foes) count.set(foe.name, (count.get(foe.name) ?? 0) + 1);
    return [...count].map(([name, n]) => (n > 1 ? `${n} × ${name}` : name)).join(', ');
}

/**
 * Un tablero, jugado `runs` veces con un grupo de cuatro de `level`.
 *
 * @param {Object} input
 * @param {any} input.board Del paquete: `{id, name, enemies}`.
 * @param {any[]} input.bestiary
 * @param {any[]} [input.abilities] Las del paquete, para los golpes especiales de los enemigos.
 * @param {number} input.level
 * @param {{low: number, high: number}|null} [input.band]
 * @param {number} [input.runs]
 * @param {string} [input.seed]
 * @returns {BoardSim|null} Null si el tablero no tiene a nadie contra quien pelear.
 */
export function simulateBoard({ board, bestiary, abilities = [], level, band = null, runs = SIM_RUNS, seed = '' }) {
    const { foes, unknown } = simEnemies(board?.enemies, bestiary, abilities);
    if (foes.length === 0) return null;
    const party = simParty(level);
    const random = createSeededRandom(`${seed}|${String(board?.id ?? board?.name ?? '')}|${level}`);
    let wins = 0;
    let rounds = 0;
    let hpLost = 0;
    let down = 0;
    let stuck = 0;
    const total = Math.max(1, Math.floor(Number(runs) || SIM_RUNS));
    for (let i = 0; i < total; i++) {
        const fight = simulateFight(party, foes, random);
        if (fight.won) wins++;
        if (fight.stuck) stuck++;
        rounds += fight.rounds;
        hpLost += fight.hpLost;
        down += fight.down;
    }
    const stats = { winRate: wins / total, rounds: rounds / total, hpLost: hpLost / total, down: down / total, stuck: stuck / total };
    const verdict = simVerdict(stats);
    const percent = Math.round(stats.winRate * 100);
    const lost = Math.round(stats.hpLost * 100);
    const said = `${SIM_VERDICTS[verdict].label}: con cuatro de nivel ${level}, se gana ${percent} de cada 100`
        + ` en ${Math.max(1, Math.round(stats.rounds))} ${Math.round(stats.rounds) === 1 ? 'ronda' : 'rondas'}`
        + ` y el grupo pierde un ${lost} % de su vida.`;
    return {
        id: String(board?.id ?? ''),
        name: String(board?.name ?? board?.id ?? ''),
        level,
        band,
        enemies: foes.length,
        foes: foesLine(foes),
        ...stats,
        verdict,
        said,
        unknown,
    };
}

/**
 * Para qué nivel es cada tablero de un paquete, como lo calcula el ajuste de nivel
 * (`levelPlanOf` y `boardBand`) con lo que guarda la importación: sus misiones, los hitos que
 * piden ganarlo y sus encargos, por el nombre del tablero.
 *
 * @param {any} pack
 * @returns {any} Lo que `levelPlanOf` espera como metadatos del mundo.
 */
export function levelMetaOfPack(pack) {
    const boards = Array.isArray(pack?.boards) ? pack.boards : [];
    const nameOf = (/** @type {any} */ id) => String(boards.find((/** @type {any} */ b) => String(b?.id) === String(id))?.name ?? '');
    return {
        quests: (Array.isArray(pack?.quests) ? pack.quests : []).map((/** @type {any} */ q) => ({ boardName: nameOf(q?.boardId), act: q?.act, levels: q?.levels })),
        plot: { milestones: Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : [] },
        writtenContracts: (Array.isArray(pack?.contracts) ? pack.contracts : []).map((/** @type {any} */ c) => ({ boardName: nameOf(c?.boardId), act: c?.act, levels: c?.levels })),
    };
}

/**
 * Todos los tableros con pelea de un paquete, uno a uno, devolviendo el control entre tablero
 * y tablero (`pause`) para que la ventana no se quede helada.
 *
 * @param {Object} input
 * @param {any} input.pack El paquete ya relleno (con su bestiario).
 * @param {(board: any) => {low: number, high: number}|null} input.bandOf Para qué nivel es cada tablero.
 * @param {number} [input.runs]
 * @param {string} [input.seed]
 * @param {(done: number, total: number, last: BoardSim|null) => void} [input.onProgress]
 * @param {() => Promise<void>} [input.pause] Lo que se espera entre tablero y tablero. En el
 *   navegador, un `setTimeout` de cero; en las pruebas, nada.
 * @returns {Promise<BoardSim[]>}
 */
export async function simulateBoards({ pack, bandOf, runs = SIM_RUNS, seed = '', onProgress = () => {}, pause = () => Promise.resolve() }) {
    const boards = (Array.isArray(pack?.boards) ? pack.boards : []).filter((/** @type {any} */ b) => Array.isArray(b?.enemies) && b.enemies.length > 0);
    /** @type {BoardSim[]} */
    const out = [];
    for (let i = 0; i < boards.length; i++) {
        const band = bandOf(boards[i]);
        const level = Math.max(1, Math.floor(Number(band?.low) || 1));
        const sim = simulateBoard({ board: boards[i], bestiary: pack?.bestiary, abilities: pack?.abilities, level, band, runs, seed });
        if (sim) out.push(sim);
        onProgress(i + 1, boards.length, sim);
        await pause();
    }
    return out;
}
