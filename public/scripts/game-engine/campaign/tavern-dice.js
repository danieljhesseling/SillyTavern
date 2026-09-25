/**
 * Dados en la taberna: «A veintiuno», un minijuego (idea 128).
 *
 * En los pueblos no había nada que hacer que no fuera trabajo. Esto es lo que se hace en
 * una taberna con unas monedas y una tarde: se apuesta, se tira un dado detrás de otro y se
 * suma. Quien se pasa de 21, pierde. Cuando uno se planta, tira la casa hasta llegar a 17 o
 * pasarse. Gana quien quede más cerca de 21.
 *
 * Es de suerte, pero se decide: cada dado es la pregunta de si pedir otro. Y quien tenga
 * buenas manos puede **hacer trampa** una vez por partida (Juego de manos): si sale, su
 * último dado se vuelve un seis; si no, le pillan, pierde lo apostado y ese día ya no juega.
 *
 * Tres partidas al día en cada taberna: es un rato, no un oficio.
 *
 * Puro: con el azar que se pase. Quien llama cobra, paga y pinta.
 */

/** Las apuestas que se aceptan. */
export const BETS = [5, 10, 20];

/** A cuánto se juega, y cuándo se planta la casa. */
export const TARGET = 21;
export const HOUSE_STANDS = 17;

/** Partidas por día en cada taberna. */
export const ROUNDS_PER_DAY = 3;

/** Lo que cuesta hacer trampa sin que te pillen. */
export const CHEAT_DC = 14;

/**
 * @typedef {Object} DiceGame
 * @property {number} bet
 * @property {number[]} mine
 * @property {number[]} house
 * @property {'playing'|'won'|'lost'|'push'|'caught'} state
 * @property {boolean} cheated
 */

/** @param {number[]} dice @returns {number} */
export const total = (dice) => (dice || []).reduce((s, d) => s + d, 0);

/** @param {() => number} random @returns {number} */
const d6 = (random) => 1 + (Math.floor(random() * 6) % 6);

/**
 * Empezar: dos dados para quien juega, como en la mesa.
 *
 * @param {number} bet
 * @param {() => number} random
 * @returns {DiceGame}
 */
export function startGame(bet, random) {
    const stake = BETS.includes(Number(bet)) ? Number(bet) : BETS[0];
    return { bet: stake, mine: [d6(random), d6(random)], house: [], state: 'playing', cheated: false };
}

/**
 * Pedir otro dado. Si se pasa de 21, pierde en el acto.
 *
 * @param {DiceGame} game
 * @param {() => number} random
 * @returns {DiceGame}
 */
export function drawDie(game, random) {
    if (game.state !== 'playing') return game;
    const mine = [...game.mine, d6(random)];
    return { ...game, mine, state: total(mine) > TARGET ? 'lost' : 'playing' };
}

/**
 * Plantarse: la casa tira hasta 17 y se ve quién gana.
 *
 * @param {DiceGame} game
 * @param {() => number} random
 * @returns {DiceGame}
 */
export function stand(game, random) {
    if (game.state !== 'playing') return game;
    const house = [];
    while (total(house) < HOUSE_STANDS) house.push(d6(random));
    const me = total(game.mine);
    const them = total(house);
    const state = them > TARGET || me > them ? 'won' : me === them ? 'push' : 'lost';
    return { ...game, house, state };
}

/**
 * Hacer trampa: una vez por partida, con el último dado.
 *
 * @param {DiceGame} game
 * @param {{total: number}} check La tirada de Juego de manos ya hecha.
 * @returns {DiceGame}
 */
export function cheat(game, check) {
    if (game.state !== 'playing' || game.cheated || game.mine.length === 0) return game;
    if (Number(check?.total) < CHEAT_DC) return { ...game, cheated: true, state: 'caught' };
    const mine = [...game.mine.slice(0, -1), 6];
    return { ...game, mine, cheated: true, state: total(mine) > TARGET ? 'lost' : 'playing' };
}

/**
 * Lo que se gana o se pierde: la apuesta, en un sentido o en el otro.
 *
 * @param {DiceGame} game
 * @returns {number}
 */
export function payout(game) {
    if (game.state === 'won') return game.bet;
    if (game.state === 'lost' || game.state === 'caught') return -game.bet;
    return 0;
}

/**
 * La mesa en una línea.
 *
 * @param {DiceGame} game
 * @returns {string}
 */
export function describeGame(game) {
    const mine = `Tú: ${game.mine.join(' + ')} = ${total(game.mine)}`;
    const house = game.house.length > 0 ? ` · La casa: ${game.house.join(' + ')} = ${total(game.house)}` : '';
    const verdict = {
        playing: '',
        won: ` · Ganas ${game.bet} de oro.`,
        lost: total(game.mine) > TARGET ? ` · Te pasas: pierdes ${game.bet}.` : ` · Pierdes ${game.bet}.`,
        push: ' · Empate: nadie cobra.',
        caught: ` · ¡Te pillan! Pierdes ${game.bet}, y hoy ya no juegas aquí.`,
    }[game.state];
    return `${mine}${house}${verdict}`;
}

/**
 * Cuántas partidas quedan hoy aquí.
 *
 * @param {any} raw Lo apuntado: `{place, day, played, banned}`.
 * @param {string} place
 * @param {number} today
 * @returns {{left: number, banned: boolean}}
 */
export function roundsLeft(raw, place, today) {
    const same = raw && raw.place === place && Number(raw.day) === Number(today);
    if (!same) return { left: ROUNDS_PER_DAY, banned: false };
    return { left: Math.max(0, ROUNDS_PER_DAY - (Number(raw.played) || 0)), banned: Boolean(raw.banned) };
}
