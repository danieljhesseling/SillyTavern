/**
 * «Mayor o menor»: las cartas de la taberna (J14.11 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un rato de cartas es otra forma de gastar una parte del día. Tenía que ser un juego que se
 * entienda sin leer reglas, de suerte y de nervio, y honrado. Este:
 *
 * - **La baraja española**, cuarenta cartas: del as al siete, la sota, el caballo y el rey, en
 *   oros, copas, espadas y bastos. Valen del 1 al 10 (la sota 8, el caballo 9, el rey 10).
 * - **Apuestas lo que eliges** (`CARD_BETS`) y se pone en el bote. La mesa saca una carta.
 * - **Dices si la siguiente será mayor o menor.** Si aciertas, el bote crece; si fallas, o sale
 *   una igual, lo pierdes.
 * - **Las probabilidades, a la vista**: cuántas cartas quedan, cuántas son mayores, menores o
 *   iguales, y en cuánto se queda el bote si aciertas. Se cuenta con las cartas que quedan: las
 *   que ya salieron no vuelven.
 * - **Paga lo justo**: acertar lo difícil paga más. El bote nuevo es el de antes dividido por
 *   la probabilidad de acertar, redondeado hacia abajo, y nunca más de diez veces lo apostado
 *   (`MAX_MULTIPLIER`). Así ninguna jugada gana de media: la casa solo se queda el redondeo.
 * - **Tres aciertos como mucho** (`MAX_GUESSES`). Tras cada acierto puedes plantarte y cobrar
 *   el bote, o arriesgarlo a otra carta. Al tercero se cobra solo.
 *
 * Puro: con el azar que se pase. Quien llama cobra, paga y pinta.
 */

/** Las apuestas que se aceptan en la mesa. */
export const CARD_BETS = [5, 10, 20];

/** Cuántas veces se puede acertar seguidas antes de cobrar. */
export const MAX_GUESSES = 3;

/** Lo más que paga la mesa: tantas veces lo apostado. */
export const MAX_MULTIPLIER = 10;

/** Los palos, con cómo se dicen. */
export const SUITS = [
    { id: 'oros', label: 'oros' },
    { id: 'copas', label: 'copas' },
    { id: 'espadas', label: 'espadas' },
    { id: 'bastos', label: 'bastos' },
];

/** Las cartas de cada palo, con lo que valen. */
export const RANKS = [
    { value: 1, label: 'As' },
    { value: 2, label: 'Dos' },
    { value: 3, label: 'Tres' },
    { value: 4, label: 'Cuatro' },
    { value: 5, label: 'Cinco' },
    { value: 6, label: 'Seis' },
    { value: 7, label: 'Siete' },
    { value: 8, label: 'Sota' },
    { value: 9, label: 'Caballo' },
    { value: 10, label: 'Rey' },
];

/**
 * @typedef {Object} Card
 * @property {number} value Del 1 al 10.
 * @property {string} suit `oros`, `copas`, `espadas` o `bastos`.
 */

/**
 * @typedef {Object} CardGame
 * @property {number} bet Lo apostado.
 * @property {number} pot Lo que hay en el bote ahora.
 * @property {Card} shown La carta boca arriba: la que hay que superar o no llegar.
 * @property {Card[]} deck Las que quedan por salir, en orden.
 * @property {Card[]} drawn Las que ya salieron, la primera la de la mesa.
 * @property {number} guesses Cuántas veces se ha acertado.
 * @property {'guess'|'won'|'lost'} state `guess`: toca decir; `won`: cobrado; `lost`: perdido.
 * @property {'mayor'|'menor'|''} last Lo último que se dijo.
 * @property {boolean} [tie] Si se perdió porque salió una igual.
 */

/**
 * @typedef {Object} SideOdds
 * @property {number} wins Cuántas de las que quedan hacen ganar.
 * @property {number} chance De 0 a 1.
 * @property {number} percent Redondeado, para leerlo.
 * @property {number} pot En cuánto se queda el bote si se acierta.
 * @property {boolean} possible Si queda alguna que haga ganar.
 */

/** @param {() => number} random @param {number} n @returns {number} Del 0 al n-1. */
const pick = (random, n) => Math.min(n - 1, Math.max(0, Math.floor((Number(random()) || 0) * n)));

/**
 * La baraja entera, barajada.
 *
 * @param {() => number} random
 * @returns {Card[]}
 */
export function newDeck(random) {
    /** @type {Card[]} */
    const deck = SUITS.flatMap(s => RANKS.map(r => ({ value: r.value, suit: s.id })));
    for (let i = deck.length - 1; i > 0; i--) {
        const j = pick(random, i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

/**
 * Cómo se dice una carta: «el caballo de copas», «el as de oros».
 *
 * @param {Card} card
 * @param {{article?: boolean}} [how] Sin artículo: «Caballo de copas».
 * @returns {string}
 */
export function cardName(card, { article = true } = {}) {
    const rank = RANKS.find(r => r.value === Number(card?.value))?.label ?? String(card?.value ?? '');
    const suit = SUITS.find(s => s.id === card?.suit)?.label ?? String(card?.suit ?? '');
    return article ? `el ${rank.toLowerCase()} de ${suit}` : `${rank} de ${suit}`;
}

/**
 * Sentarse: la apuesta al bote y la primera carta boca arriba.
 *
 * @param {number} bet Una de `CARD_BETS`; otra cosa se queda en la más baja.
 * @param {() => number} random
 * @returns {CardGame}
 */
export function startCards(bet, random) {
    const stake = CARD_BETS.includes(Number(bet)) ? Number(bet) : CARD_BETS[0];
    const [shown, ...deck] = newDeck(random);
    return { bet: stake, pot: stake, shown, deck, drawn: [shown], guesses: 0, state: 'guess', last: '' };
}

/**
 * En cuánto se queda el bote si se acierta, con tantas cartas que hagan ganar de tantas.
 * Paga lo justo, redondeando hacia abajo, y con el tope de la mesa.
 *
 * @param {number} pot
 * @param {number} wins
 * @param {number} left
 * @param {number} bet
 * @returns {number}
 */
export function potIfRight(pot, wins, left, bet) {
    if (!(wins > 0) || !(left > 0)) return pot;
    return Math.min(bet * MAX_MULTIPLIER, Math.floor((pot * left) / wins));
}

/**
 * Las probabilidades de ahora: cuántas cartas quedan y qué pasa con cada lado.
 *
 * @param {CardGame} game
 * @returns {{left: number, higher: number, lower: number, same: number, mayor: SideOdds, menor: SideOdds}}
 */
export function oddsOf(game) {
    const deck = Array.isArray(game?.deck) ? game.deck : [];
    const value = Number(game?.shown?.value) || 0;
    const left = deck.length;
    const higher = deck.filter(c => c.value > value).length;
    const lower = deck.filter(c => c.value < value).length;
    const same = left - higher - lower;
    /** @param {number} wins @returns {SideOdds} */
    const side = (wins) => ({
        wins,
        chance: left > 0 ? wins / left : 0,
        percent: left > 0 ? Math.round((wins * 100) / left) : 0,
        pot: potIfRight(Number(game?.pot) || 0, wins, left, Number(game?.bet) || 0),
        possible: wins > 0,
    });
    return { left, higher, lower, same, mayor: side(higher), menor: side(lower) };
}

/** @param {CardGame} game @returns {boolean} Si se puede plantar: tras un acierto, jugando. */
export const canStand = (game) => game?.state === 'guess' && (Number(game?.guesses) || 0) > 0;

/**
 * Decir «mayor» o «menor»: sale la siguiente carta. Si acierta, el bote crece y, al tercer
 * acierto, se cobra solo; si falla o sale igual, se pierde.
 *
 * @param {CardGame} game
 * @param {'mayor'|'menor'} side
 * @returns {CardGame}
 */
export function guessCard(game, side) {
    if (game?.state !== 'guess' || (side !== 'mayor' && side !== 'menor') || game.deck.length === 0) return game;
    const odds = oddsOf(game)[side];
    if (!odds.possible) return game;
    const [next, ...deck] = game.deck;
    const right = side === 'mayor' ? next.value > game.shown.value : next.value < game.shown.value;
    const drawn = [...game.drawn, next];
    if (!right) {
        return { ...game, shown: next, deck, drawn, state: 'lost', pot: 0, last: side, tie: next.value === game.shown.value };
    }
    const guesses = game.guesses + 1;
    const pot = odds.pot;
    // Sin cartas para otra, o al tercer acierto, se cobra.
    const done = guesses >= MAX_GUESSES || deck.length === 0;
    return { ...game, shown: next, deck, drawn, guesses, pot, state: done ? 'won' : 'guess', last: side };
}

/**
 * Plantarse y cobrar el bote. Solo tras un acierto.
 *
 * @param {CardGame} game
 * @returns {CardGame}
 */
export function standCards(game) {
    return canStand(game) ? { ...game, state: 'won' } : game;
}

/**
 * Lo ganado o perdido: el bote menos lo apostado, o lo apostado en negativo.
 *
 * @param {CardGame} game
 * @returns {number}
 */
export function cardsNet(game) {
    if (game?.state === 'won') return (Number(game.pot) || 0) - (Number(game.bet) || 0);
    if (game?.state === 'lost') return -(Number(game.bet) || 0);
    return 0;
}

/**
 * Lo que se lee de un lado antes de elegirlo: «Mayor: 20 de 38 cartas (53 %). Si aciertas, el bote
 * queda en 18.»
 *
 * @param {CardGame} game
 * @param {'mayor'|'menor'} side
 * @returns {string}
 */
export function describeSide(game, side) {
    const odds = oddsOf(game);
    const one = odds[side];
    const label = side === 'mayor' ? 'Mayor' : 'Menor';
    if (!one.possible) return `${label}: no queda ninguna carta ${side}.`;
    const gain = one.pot > game.pot ? `el bote sube a ${one.pot}` : `el bote se queda en ${one.pot}`;
    return `${label}: ${one.wins} de ${odds.left} cartas (${one.percent} %). Si aciertas, ${gain}.`;
}

/**
 * Cómo acabó, en una frase.
 *
 * @param {CardGame} game
 * @returns {string}
 */
export function describeCards(game) {
    const net = cardsNet(game);
    const seen = game?.drawn?.map(c => cardName(c, { article: false })).join(', ') ?? '';
    if (game?.state === 'lost') {
        const why = game.tie ? `Sale ${cardName(game.shown)}: igual, y la igual pierde.` : `Sale ${cardName(game.shown)}.`;
        return `${why} Pierdes lo apostado: ${-net} de oro. Salieron: ${seen}.`;
    }
    if (game?.state === 'won') {
        const hits = game.guesses === 1 ? 'un acierto' : `${game.guesses} aciertos`;
        return net > 0
            ? `Con ${hits}, te llevas el bote: ${game.pot} de oro, ${net} más de lo que pusiste. Salieron: ${seen}.`
            : `Con ${hits}, te llevas el bote: ${game.pot} de oro, lo mismo que pusiste. Salieron: ${seen}.`;
    }
    return `En la mesa, ${cardName(game?.shown)}. Bote: ${Number(game?.pot) || 0} de oro.`;
}
