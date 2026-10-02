/**
 * Un trabajo o un rato libre en pantalla (J14.11 de wiki/ROADMAP_SIN_CONEXION.md): servir mesas,
 * echar una mano en la forja, las cartas, leer o pescar, como una escena corta de novela visual.
 *
 * Una sola ventana, con la cara de quien lleva el sitio y el sitio detrás (las piezas de
 * `meetup-scene.js` y su hoja, `quedadas.css`), en cuatro pasos:
 *
 * 1. **Quién viene**: la gente de tu grupo que está libre, en fichas que se encienden. Si no hay
 *    nadie libre, este paso no sale.
 * 2. **La escena**: lo que pasa, lo que dice quien atiende y, donde se decide algo, las respuestas.
 * 3. **Las cartas**, si es eso: la apuesta y la mesa, con las probabilidades de cada lado a la
 *    vista antes de elegir (`card-game.js`).
 * 4. **Lo que te llevas**: lo cuenta quien la abrió (`finish`), que es quien aplica el oro, el
 *    rumor o la experiencia. Puede tardar (un rumor se busca): mientras, la ventana espera.
 *
 * Dejarlo antes de acabar no gasta nada: se cierra sin llamar a `finish`. Una vez puesta la
 * apuesta, la mano se juega hasta el final. Teclas: 1, 2 y 3 eligen; Intro o espacio siguen.
 */

import { sceneStep, sceneView, startScene } from '../campaign/meetups.js';
import { CARD_BETS, canStand, cardName, cardsNet, describeCards, guessCard, oddsOf, standCards, startCards, MAX_GUESSES } from '../campaign/card-game.js';
import { loadPixelManifest } from './pixel-art.js';
import { backdropFor, beatChips, beatLines, portraitFor } from './meetup-scene.js';
import { sayList } from '../campaign/pastimes.js';
import { resolveGender } from '../campaign/grammar.js';
import { asideBox, fillAside, isAsideKind } from './vn-aside.js';

/** @typedef {import('../campaign/card-game.js').CardGame} CardGame */
/** @typedef {import('../campaign/card-game.js').Card} Card */

/** El icono de cada palo, para la carta dibujada. */
const SUIT_ICONS = { oros: 'fa-coins', copas: 'fa-wine-glass', espadas: 'fa-khanda', bastos: 'fa-tree' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className = '', content = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
}

/**
 * Una carta, dibujada: su valor grande (con el que se compara), el palo y cómo se llama.
 *
 * @param {Card} card
 * @param {boolean} [small]
 * @returns {HTMLElement}
 */
export function cardElement(card, small = false) {
    const node = el('div', `pt-card pt-suit-${text(card?.suit)}${small ? ' pt-card-small' : ''}`);
    node.dataset.card = `${Number(card?.value) || 0}-${text(card?.suit)}`;
    node.title = cardName(card, { article: false });
    node.appendChild(el('span', 'pt-card-value', String(Number(card?.value) || 0)));
    node.appendChild(el('i', `fa-solid ${/** @type {Record<string, string>} */ (SUIT_ICONS)[text(card?.suit)] ?? 'fa-diamond'} pt-card-suit`));
    if (!small) node.appendChild(el('span', 'pt-card-name', cardName(card, { article: false })));
    return node;
}

/**
 * Lo que se lee de la mesa antes de elegir: el bote, lo apostado y los aciertos.
 *
 * @param {CardGame} game
 * @returns {string}
 */
export function potLine(game) {
    const hits = Number(game?.guesses) || 0;
    return `Bote: ${Number(game?.pot) || 0} de oro · Apostaste ${Number(game?.bet) || 0} · Aciertos: ${hits} de ${MAX_GUESSES}`;
}

/**
 * Lo que dicen los botones de un lado: «Mayor», cuántas de cuántas y el bote si se acierta.
 *
 * @param {CardGame} game
 * @param {'mayor'|'menor'} side
 * @returns {{label: string, odds: string, pot: string, possible: boolean}}
 */
export function sideButton(game, side) {
    const odds = oddsOf(game);
    const one = odds[side];
    const label = side === 'mayor' ? 'Mayor' : 'Menor';
    if (!one.possible) return { label, odds: `No queda ninguna ${side}`, pot: '', possible: false };
    return {
        label,
        odds: `${one.wins} de ${odds.left} cartas · ${one.percent} %`,
        pot: one.pot > (Number(game.pot) || 0) ? `Si aciertas, el bote sube a ${one.pot}` : `Si aciertas, el bote se queda en ${one.pot}`,
        possible: true,
    };
}

/**
 * La línea de las iguales: con ellas se pierde, y se dice cuántas quedan.
 *
 * @param {CardGame} game
 * @returns {string}
 */
export function sameLine(game) {
    const odds = oddsOf(game);
    const percent = odds.left > 0 ? Math.round((odds.same * 100) / odds.left) : 0;
    if (odds.same === 0) return 'No queda ninguna igual a esta.';
    return `Iguales: ${odds.same} de ${odds.left} (${percent} %). Si sale una igual, pierdes.`;
}

/**
 * La ventana, vacía, dentro del Modo Juego si está abierto (hereda su letra) o en la página.
 *
 * @param {string} label
 * @param {HTMLElement|null} mount
 * @returns {HTMLDialogElement}
 */
function openDialog(label, mount) {
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'qd-dialog pt-dialog'));
    dialog.setAttribute('aria-label', label);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();
    return dialog;
}

/**
 * Poner el retrato: la imagen con su cara, o la silueta si no hay o no carga.
 *
 * @param {HTMLElement} holder
 * @param {string} url
 * @param {string} alt
 */
function drawPortrait(holder, url, alt) {
    if (holder.dataset.src === url && holder.firstChild) return;
    holder.dataset.src = url;
    holder.textContent = '';
    const silhouette = () => holder.appendChild(el('i', 'fa-solid fa-user qd-silhouette'));
    if (!url) {
        silhouette();
        return;
    }
    const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art qd-pixel'));
    image.src = url;
    image.alt = alt;
    image.addEventListener('error', () => {
        image.remove();
        silhouette();
    });
    holder.appendChild(image);
}

/**
 * @typedef {Object} PastimeMate
 * @property {string} key
 * @property {string} name
 * @property {string} [className]
 * @property {string} [gender]
 */

/**
 * @typedef {Object} PastimeResultView
 * @property {boolean} finished Si se llegó al final (y `finish` se llamó).
 * @property {Array<{beat: number, reply: number}>} choices
 * @property {string[]} mates Las claves de quien vino.
 * @property {CardGame|null} game La mano de cartas, si la hubo.
 */

/**
 * Jugar un trabajo o un rato en pantalla.
 *
 * @param {Object} input
 * @param {string} input.title «Servir mesas».
 * @param {string} [input.placeLabel] El sitio dicho («La taberna»), para la cabecera.
 * @param {{name?: string, className?: string, gender?: string}} [input.keeper] Quien lleva el sitio, para el retrato.
 * @param {string} [input.pack] El paquete (`gremio`, `strahd`, `1387`), para el retrato y el escenario.
 * @param {string} [input.place] El dibujo del sitio (`taberna`, `herreria`, `muelle`…).
 * @param {string} [input.town] La localización, si el sitio no tiene dibujo.
 * @param {boolean} [input.night]
 * @param {PastimeMate[]} [input.mates] Tu gente libre ahora, que puede venir.
 * @param {string} [input.joinNote] Lo que da que venga alguien, dicho en una frase.
 * @param {{gender?: string}|null} [input.hero] Tu héroe, para decirle las cosas en su género.
 * @param {(names: string[]) => import('../campaign/meetups.js').Scene} input.makeScene La escena, ya con el
 *   texto de tu héroe, con quien venga (por su nombre).
 * @param {{purse: number, random: () => number}|null} [input.cards] Si es la mesa de cartas: el oro que se lleva y el azar.
 * @param {(done: {choices: Array<{beat: number, reply: number}>, mates: string[], game: CardGame|null}) => (string[]|Promise<string[]>)} input.finish
 *   Lo que se lleva, aplicado y contado.
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<PastimeResultView>}
 */
export async function openPastime({
    title, placeLabel = '', keeper = {}, pack = '', place = '', town = '', night = false, mates = [], joinNote = '', hero = null,
    makeScene, cards = null, finish, mount = null,
}) {
    await loadPixelManifest();
    const free = (Array.isArray(mates) ? mates : []).filter(m => text(m?.name) && text(m?.key));
    const dialog = openDialog(text(title) || 'Un rato', mount);
    const root = el('div', `qd-root pt-root${cards ? ' pt-cards-root' : ''}`);
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ place, town, pack, night });
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait');
    const box = el('div', 'qd-box pt-box');
    const plate = el('div', 'qd-nameplate');
    const head = el('div', 'qd-head');
    const heading = el('span', 'qd-title', [text(title), text(placeLabel)].filter(Boolean).join(' · '));
    const step = el('span', 'qd-step');
    head.append(heading, step);
    const lines = el('div', 'qd-text');
    lines.setAttribute('aria-live', 'polite');
    const table = el('div', 'pt-table');
    const chips = el('div', 'qd-chips');
    const foot = el('div', 'qd-foot');
    box.append(plate, head, lines, table, chips, foot);
    // D-J60: lo que pasa sin que lo diga nadie, las reglas de la mesa y lo que te llevas, fuera de la caja.
    const aside = asideBox();
    root.append(backdrop, portrait, aside, box);
    /** Lo que se ve en el aviso ahora. @type {Array<{kind: string, text: string}>} */
    let asideNow = [];
    dialog.appendChild(root);

    /** @type {'who'|'scene'|'bet'|'table'|'wait'|'end'} */
    let stage = free.length > 0 ? 'who' : 'scene';
    /** @type {Set<string>} */
    const coming = new Set();
    /** @type {import('../campaign/meetups.js').Scene|null} */
    let scene = null;
    let state = startScene();
    /** @type {CardGame|null} */
    let game = null;
    /** @type {string[]} */
    let summary = [];
    const keeperName = text(keeper?.name);

    return new Promise(resolve => {
        const close = (/** @type {boolean} */ finished) => {
            dialog.close();
            dialog.remove();
            resolve({ finished, choices: state.choices, mates: [...coming], game });
        };
        /** @param {string} label @param {string} key @param {string} kind @param {() => void} onClick @param {HTMLElement} [into] */
        const chip = (label, key, kind, onClick, into = chips) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', `qd-chip qd-chip-${kind}`));
            button.type = 'button';
            if (key) button.appendChild(el('span', 'qd-key', key));
            button.appendChild(el('span', 'qd-label', label));
            button.addEventListener('click', onClick);
            into.appendChild(button);
            return button;
        };
        const line = (/** @type {string} */ kind, /** @type {string} */ said) => {
            const p = el('p', `qd-line qd-${kind}`);
            // D-J60: lo que no dice nadie va al aviso, no a la caja.
            if (isAsideKind(kind)) {
                asideNow = [...asideNow, { kind, text: said }];
                fillAside(aside, asideNow);
                return p;
            }
            p.textContent = said;
            lines.appendChild(p);
            return p;
        };
        const leave = (/** @type {string} */ label = 'Dejarlo para otro día') => {
            const b = /** @type {HTMLButtonElement} */ (el('button', 'qd-leave', label));
            b.type = 'button';
            b.addEventListener('click', () => close(false));
            foot.appendChild(b);
        };
        const face = (/** @type {string} */ mood = '') => drawPortrait(portrait, portraitFor({ ...keeper, name: keeperName, pack, mood }), keeperName || 'Quien atiende');
        const names = () => free.filter(m => coming.has(m.key)).map(m => text(m.name));

        const begin = () => {
            scene = makeScene(names());
            state = startScene();
            stage = 'scene';
            draw();
        };
        const afterScene = () => {
            if (cards) {
                stage = 'bet';
                draw();
            } else {
                void end();
            }
        };
        const end = async () => {
            stage = 'wait';
            draw();
            try {
                summary = await finish({ choices: state.choices, mates: [...coming], game });
            } catch (error) {
                console.error('[Trabajos] Al acabar:', error);
                summary = ['Algo ha fallado al apuntar lo que te llevas.'];
            }
            stage = 'end';
            draw();
        };
        const act = (/** @type {{reply?: number, next?: boolean}} */ action) => {
            if (!scene) return;
            state = sceneStep(scene, state, action);
            if (state.done) afterScene();
            else draw();
        };
        const bet = (/** @type {number} */ amount) => {
            if (!cards || amount > (Number(cards.purse) || 0)) return;
            game = startCards(amount, cards.random);
            stage = 'table';
            draw();
        };
        const guess = (/** @type {'mayor'|'menor'} */ side) => {
            if (!game || game.state !== 'guess' || !oddsOf(game)[side].possible) return;
            game = guessCard(game, side);
            draw();
        };
        const stand = () => {
            if (!game || !canStand(game)) return;
            game = standCards(game);
            draw();
        };

        const drawWho = () => {
            plate.textContent = keeperName || text(title);
            step.textContent = '';
            face();
            line('note', '¿Viene alguien contigo? Quien está libre ahora puede echarte una mano.');
            if (joinNote) line('say', joinNote);
            for (const [i, mate] of free.entries()) {
                const on = coming.has(mate.key);
                const b = chip(text(mate.name), String(i + 1), `mate${on ? ' pt-mate-on' : ''}`, () => {
                    if (coming.has(mate.key)) coming.delete(mate.key);
                    else coming.add(mate.key);
                    draw();
                });
                b.dataset.mate = mate.key;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.insertBefore(el('i', `fa-solid ${on ? 'fa-square-check' : 'fa-square'} pt-mate-box`), b.lastChild);
            }
            const go = chip(coming.size > 0 ? `Empezar con ${sayList(names().map(n => n.split(' ')[0]))}` : resolveGender('Empezar {solo|sola}', { heroe: hero }), '↵', 'next', begin);
            go.classList.add('pt-start');
            // Intro empieza; los números encienden o apagan a cada uno.
            go.focus();
            leave();
        };

        const drawScene = () => {
            if (!scene) return;
            const view = sceneView(scene, state);
            plate.textContent = text(view.speaker) || keeperName;
            step.textContent = view.steps > 1 ? `${view.step} / ${view.steps}` : '';
            face(view.face);
            for (const one of beatLines(view)) {
                if (isAsideKind(one.kind)) {
                    line(one.kind, one.text);
                    continue;
                }
                const p = el('p', `qd-line qd-${one.kind}`);
                if (one.kind === 'you') p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(one.text));
                lines.appendChild(p);
            }
            let first = /** @type {HTMLButtonElement|null} */ (null);
            for (const one of beatChips(view)) {
                // Al final de la escena de las cartas no se termina: se pasa a la mesa.
                const label = one.kind === 'finish' && cards ? 'Sentarse a jugar' : one.label;
                const button = one.kind === 'reply'
                    ? chip(one.label, one.key, 'reply', () => act({ reply: one.index }))
                    : chip(label, one.key, one.kind, () => act({ next: true }));
                first = first ?? button;
            }
            first?.focus();
            leave();
        };

        const drawBet = () => {
            const purse = Number(cards?.purse) || 0;
            plate.textContent = text(scene?.who) || keeperName;
            step.textContent = '';
            face();
            line('say', '«¿Cuánto pones en el bote?»');
            line('note', `Llevas ${purse} de oro. Lo que apuestas lo pierdes si fallas; si aciertas, el bote crece.`);
            let first = /** @type {HTMLButtonElement|null} */ (null);
            for (const [i, amount] of CARD_BETS.entries()) {
                const b = chip(`Apostar ${amount} de oro`, String(i + 1), 'reply pt-bet', () => bet(amount));
                b.dataset.bet = String(amount);
                if (amount > purse) {
                    b.disabled = true;
                    b.title = `No llevas ${amount} de oro.`;
                } else first = first ?? b;
            }
            first?.focus();
            leave('Mejor no');
        };

        const drawTable = () => {
            if (!game) return;
            plate.textContent = text(scene?.who) || keeperName;
            step.textContent = '';
            const over = game.state !== 'guess';
            face(over ? (game.state === 'won' ? 'alegre' : '') : '');
            table.hidden = false;
            const row = el('div', 'pt-felt');
            const shown = el('div', 'pt-shown');
            shown.appendChild(el('div', 'pt-shown-label', over ? 'La última carta' : 'En la mesa'));
            shown.appendChild(cardElement(game.shown));
            row.appendChild(shown);
            const past = el('div', 'pt-past');
            past.appendChild(el('div', 'pt-shown-label', 'Han salido'));
            const strip = el('div', 'pt-strip');
            for (const card of game.drawn.slice(0, -1)) strip.appendChild(cardElement(card, true));
            if (game.drawn.length <= 1) strip.appendChild(el('span', 'pt-strip-none', 'Ninguna más'));
            past.appendChild(strip);
            row.appendChild(past);
            table.appendChild(row);
            table.appendChild(el('div', 'pt-pot', potLine(game)));
            if (over) {
                line('summary', describeCards(game));
                const net = cardsNet(game);
                const result = line('say', net > 0 ? `Ganas ${net} de oro.` : net < 0 ? `Pierdes ${-net} de oro.` : 'Ni ganas ni pierdes.');
                result.classList.add(net > 0 ? 'pt-won' : net < 0 ? 'pt-lost' : 'pt-even');
                chip('Seguir', '↵', 'next', () => { void end(); }).focus();
                return;
            }
            line('note', 'La sota vale 8, el caballo 9 y el rey 10. ¿La siguiente será mayor o menor que esta?');
            const sides = el('div', 'pt-sides');
            let first = /** @type {HTMLButtonElement|null} */ (null);
            for (const [i, side] of /** @type {Array<'mayor'|'menor'>} */ (['mayor', 'menor']).entries()) {
                const said = sideButton(game, side);
                const b = /** @type {HTMLButtonElement} */ (el('button', `pt-side pt-side-${side}`));
                b.type = 'button';
                b.dataset.side = side;
                b.appendChild(el('span', 'qd-key', String(i + 1)));
                const stack = el('span', 'pt-side-stack');
                const top = el('span', 'pt-side-label');
                top.appendChild(el('i', `fa-solid ${side === 'mayor' ? 'fa-arrow-up' : 'fa-arrow-down'}`));
                top.appendChild(document.createTextNode(` ${said.label}`));
                stack.appendChild(top);
                stack.appendChild(el('span', 'pt-side-odds', said.odds));
                if (said.pot) stack.appendChild(el('span', 'pt-side-pot', said.pot));
                b.appendChild(stack);
                b.disabled = !said.possible;
                b.addEventListener('click', () => guess(side));
                sides.appendChild(b);
                if (said.possible) first = first ?? b;
            }
            table.appendChild(sides);
            table.appendChild(el('div', 'pt-same', sameLine(game)));
            if (canStand(game)) {
                const b = chip(`Plantarse y cobrar ${game.pot} de oro`, '3', 'finish pt-stand', stand);
                b.dataset.stand = 'true';
            }
            first?.focus();
        };

        const drawEnd = () => {
            root.classList.add('qd-ended');
            plate.hidden = true;
            step.textContent = '';
            face('alegre');
            for (const said of summary) line('summary', said);
            chip('Cerrar', '↵', 'finish', () => close(true)).focus();
        };

        const draw = () => {
            lines.textContent = '';
            asideNow = [];
            fillAside(aside, asideNow);
            chips.textContent = '';
            foot.textContent = '';
            table.textContent = '';
            table.hidden = true;
            plate.hidden = false;
            root.dataset.stage = stage;
            if (stage === 'who') drawWho();
            else if (stage === 'scene') drawScene();
            else if (stage === 'bet') drawBet();
            else if (stage === 'table') drawTable();
            else if (stage === 'wait') line('note', '…');
            else drawEnd();
        };

        // Escape no cierra a medias: se deja con su botón, o se cierra al final.
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            if (stage === 'end') close(true);
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es del rato, no del Modo Juego que hay detrás.
            event.stopPropagation();
            const enter = event.key === 'Enter' || event.key === ' ';
            const onButton = event.target instanceof HTMLButtonElement;
            const digit = /^[1-9]$/.test(event.key) ? Number(event.key) : 0;
            if (stage === 'end') {
                if (enter) {
                    event.preventDefault();
                    close(true);
                }
            } else if (stage === 'who') {
                if (digit && free[digit - 1]) {
                    event.preventDefault();
                    /** @type {HTMLElement|null} */ (chips.querySelector(`[data-mate="${CSS.escape(free[digit - 1].key)}"]`))?.click();
                } else if (enter && !onButton) {
                    event.preventDefault();
                    begin();
                }
            } else if (stage === 'scene' && scene) {
                const view = sceneView(scene, state);
                if (view.next === 'reply' && digit >= 1 && digit <= 3) {
                    const reply = view.replies[digit - 1];
                    if (reply) {
                        event.preventDefault();
                        act({ reply: reply.index });
                    }
                } else if (view.next !== 'reply' && enter && !onButton) {
                    event.preventDefault();
                    act({ next: true });
                }
            } else if (stage === 'bet' && digit >= 1 && digit <= CARD_BETS.length) {
                event.preventDefault();
                bet(CARD_BETS[digit - 1]);
            } else if (stage === 'table' && game) {
                if (game.state !== 'guess') {
                    if (enter && !onButton) {
                        event.preventDefault();
                        void end();
                    }
                } else if (digit === 1 || digit === 2) {
                    event.preventDefault();
                    guess(digit === 1 ? 'mayor' : 'menor');
                } else if (digit === 3) {
                    event.preventDefault();
                    stand();
                }
            }
        });
        if (stage === 'scene') begin();
        else draw();
    });
}
