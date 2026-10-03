/**
 * Tanda 17 (Daniel, 2026-10-02: «cuando le doy a ataque, las tiradas y el daño se hacen y aplican
 * antes de que termine la animación… quiero una animación cuando ataquen, así como una animación
 * de dado»). La secuencia del combate: cada golpe se ve en orden.
 *
 *   1. Rueda el d20 (`dice.js`) y se dice la cuenta: «14 + 5 = 19 contra CA 13: impacta».
 *      Mientras, quien ataca se queda quieto, brillando («preparándose»).
 *   2. Tanda 21: entonces, y una sola vez, se lanza hacia su objetivo (o le dispara: una flecha,
 *      un conjuro).
 *   3. El golpe llega: un destello, una sacudida y el daño que sube flotando (o «Falla»).
 *   4. Y solo entonces bajan la vida de la iniciativa y el resumen del combate.
 *
 * Los turnos de los enemigos y de los compañeros van igual, uno detrás de otro, con un rótulo de
 * quién juega; y cuando vuelve a ser tuyo, «Te toca».
 *
 * Las cuentas no cambian: el motor decide como siempre, todo de una vez, y va dejando aquí lo que
 * pasa (`pushFx`, desde `party/combat-fx.js`). Esto lo enseña paso a paso. Mientras se enseña, el
 * tablero y la pantalla del juego no se redibujan (`holdRedraw`): se quedan como estaban antes del
 * golpe y la secuencia los va cambiando (quien anda, la vida que baja); al acabar se dibujan de
 * verdad, con todo lo que el motor ya sabía. El final de la pelea (el panel de victoria, la
 * novela) espera también (`afterFx`).
 *
 * Los tiempos salen de `motionMs` (motion.js): la mitad en el teléfono. Con «reducir movimiento» o
 * «Animaciones: ninguna» nada se mueve: cada tirada se ve un momento, quieta, y se sigue. Pulsar
 * «Pasar» en la tarjeta del dado enseña lo que queda de golpe.
 */

import { motionLevel, motionMs } from '../motion.js';
import { buildDie, damageSentence, edgeSentence, rollSentence, rollVerdict, spinDie } from './dice.js';
// J12.19: cómo se ve un golpe según lo que lo hace, y lo que se dice de quien cae.
import { downCaption, downMarkNode, impactKind, impactNode } from './impact.js';
// El cartel del turno es de «que el tablero se sienta» (`turn-banner.js`): aquí se usa el mismo, por
// su nombre, para los turnos que pasan dentro de la secuencia. Si no está, sale el de aquí.
import * as turnBanner from './turn-banner.js';

/**
 * @typedef {'you'|'ally'|'enemy'} FxSide De quién es: tuyo (o de quien mueves tú), de un
 *   compañero que va solo o de un enemigo.
 */

/**
 * @typedef {Object} FxStep Un paso de la secuencia. Según `kind`:
 *   - `turn`: empieza el turno de alguien (`entryId`, `tokenId`, `name`, `side`).
 *   - `move`: alguien anda (`tokenId`, `path`: las casillas, de la de salida a la de llegada).
 *   - `attack`: el golpe sale (`from`, `to`: fichas; `style`: melee, ranged, spell o throw).
 *   - `roll`: el d20 (`title`, `subtitle`, `natural`, `total`, `dc`, `against`, `hit`, `rolls`,
 *     `edge`, `side`).
 *   - `damage`: la línea del daño bajo el dado (`total`, `dice`, `modifier`, `crit`).
 *   - `impact`: el golpe llega (`tokenId`, `entryId`, `text`, `style`: damage, crit o heal;
 *     `hp`, `max`: la vida que queda). J12.19: `damageType` (o el del golpe que salió, `attack`)
 *     dice cómo se dibuja; `name` y `team` (enemy o party), lo que se dice si cae.
 *   - `miss`: no llega (`tokenId`).
 *   - `bark`: alguien grita algo (`tokenId`, `text`).
 *   - `call`: algo que tiene que pasar en su sitio de la secuencia (`fn`), como una ventana de
 *     dados de las de antes.
 * @property {'turn'|'move'|'attack'|'roll'|'damage'|'impact'|'miss'|'bark'|'call'} kind
 * @property {any} [entryId]
 * @property {any} [tokenId]
 * @property {any} [from]
 * @property {any} [to]
 * @property {string} [name]
 * @property {FxSide} [side]
 * @property {string} [style]
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {string} [text]
 * @property {number} [natural]
 * @property {number} [total]
 * @property {number|null} [dc]
 * @property {'CA'|'CD'|''} [against]
 * @property {boolean|null} [hit]
 * @property {number[]} [rolls]
 * @property {'advantage'|'disadvantage'|'normal'} [edge]
 * @property {string} [dice]
 * @property {number} [modifier]
 * @property {boolean} [crit]
 * @property {number} [hp]
 * @property {number} [max]
 * @property {Array<{x: number, y: number}>} [path]
 * @property {() => void} [fn]
 * @property {string} [damageType] J12.19: el tipo de daño, o el arma («cortante», «fire», «Hacha»).
 * @property {'enemy'|'party'} [team] J12.19: de qué lado es quien recibe (lo que se dice si cae).
 */

/** Lo que dura cada paso, normal (en el teléfono, la mitad). En milisegundos. */
export const FX_MS = Object.freeze({
    turn: 750,
    turnYou: 1000,
    moveCell: 120,
    moveMax: 900,
    lunge: 400,
    shot: 430,
    tumble: 850,
    read: 750,
    damage: 420,
    impact: 650,
    // J12.19: «¡Falla!» se lee antes de que el tablero se redibuje (era 500).
    miss: 750,
    gap: 150,
    // J12.19: quien cae se tumba y se apaga, y se dice.
    down: 700,
});

/** Con «Animaciones: ninguna», lo que hay que leer (la tirada, de quién es el turno) se ve esto. */
export const STILL_READ_MS = 450;

/** Lo más que se espera a una secuencia: si algo se atasca, lo que queda se pasa de golpe. */
const MAX_SEQUENCE_MS = 60000;

/**
 * El ritmo, guardado en este navegador: `normal` (se ve, con los tiempos de las animaciones) o
 * `instant` (cada paso deja su resultado al momento, en orden). Sin nada guardado, normal; y si el
 * navegador lo maneja una prueba automática (`navigator.webdriver`), al momento: las vueltas de
 * prueba miran lo que pasa, no esperan a verlo. La sonda de esta parte lo pone en `normal`.
 */
export const PACE_KEY = 'sillytavern_gameCombatPace';

/** @returns {boolean} Si la secuencia va al momento. */
function instantPace() {
    try {
        const chosen = globalThis.localStorage?.getItem(PACE_KEY) ?? '';
        if (chosen === 'normal') return false;
        if (chosen === 'instant') return true;
    } catch { /* sin almacenamiento, lo de siempre */ }
    return Boolean(/** @type {any} */ (globalThis).navigator?.webdriver);
}

/** Lo que tapa la secuencia (las ventanas de dados de antes, la pausa): se espera a que se cierre. */
const BLOCKERS = '.wm-dice-overlay.active, body.game-shell-paused';

/** @type {FxStep[]} */
let queue = [];
let playing = false;
let skipping = false;
let startedAt = 0;
/** @type {'normal'|'short'|'none'} */
let level = 'normal';
/** Para las pruebas: el nivel a mano (`null`, el de motion.js). @type {'normal'|'short'|'none'|null} */
let forcedLevel = null;
/** Los redibujados pedidos mientras se enseña la secuencia: se hacen al acabar, una vez cada uno. */
const owed = new Set();
/** Lo que espera a que acabe la secuencia (el panel de victoria). @type {Array<() => void>} */
let waiters = [];
/** Las esperas en marcha, para cortarlas al pasar. @type {Set<() => void>} */
const sleepers = new Set();
/** J12.19: el último golpe que salió (cómo, con qué y hacia dónde), para dibujar cómo llega. */
let lastBlow = { style: '', damageType: '', angle: 0 };
/**
 * Tanda 21: el golpe anunciado que aún no ha salido. Mientras rueda su dado, quien ataca se queda
 * quieto, con un brillo de «preparándose»; se lanza una sola vez, al llegar el golpe (o el fallo).
 * `rolled`: su dado ya ha rodado.
 *
 * @type {{step: FxStep, rolled: boolean}|null}
 */
let pendingBlow = null;

/**
 * Para las pruebas: el nivel de las animaciones, a mano. `null` vuelve al de siempre.
 *
 * @param {'normal'|'short'|'none'|null} value
 */
export function setFxLevel(value) {
    forcedLevel = value;
}

/**
 * Si hay una secuencia enseñándose o pendiente.
 *
 * @returns {boolean}
 */
export function fxBusy() {
    return playing || queue.length > 0;
}

/**
 * Lo que quiere redibujar el tablero o la pantalla del juego: si hay secuencia, se apunta y se
 * hace al acabar (y entonces devuelve `true`: no se redibuja ahora).
 *
 * @param {() => void} redraw
 * @returns {boolean}
 */
export function holdRedraw(redraw) {
    if (!fxBusy() || typeof redraw !== 'function') return false;
    owed.add(redraw);
    return true;
}

/**
 * Hacer algo cuando acabe la secuencia (o ya, si no hay ninguna).
 *
 * @param {() => void} fn
 */
export function afterFx(fn) {
    if (typeof fn !== 'function') return;
    if (!fxBusy()) {
        fn();
        return;
    }
    waiters.push(fn);
}

/**
 * Pasar lo que queda de la secuencia de golpe: cada paso deja su resultado sin animarse.
 */
export function skipFx() {
    if (!fxBusy()) return;
    skipping = true;
    for (const done of [...sleepers]) done();
}

/**
 * Cómo va la secuencia, para las pruebas y para mirar desde la consola: si suena, lo que queda y
 * si algo la tapa.
 *
 * @returns {{busy: boolean, left: string[], ms: number, blocked: boolean}}
 */
export function fxState() {
    return {
        busy: fxBusy(),
        left: queue.map(step => step.kind),
        ms: playing ? Date.now() - startedAt : 0,
        blocked: Boolean(doc()?.querySelector(BLOCKERS)),
    };
}

/**
 * Cuántos pasos esperan. Dentro de una misma jugada del motor (que va de una vez, sin esperar a
 * nada) la cola solo crece: sirve de marca para meter un paso antes de los que vinieron después.
 *
 * @returns {number}
 */
export function fxLength() {
    return queue.length;
}

/**
 * Añadir un paso. La secuencia empieza sola, en cuanto el motor acaba lo que estaba haciendo. Con
 * `at` (de `fxLength`), el paso va en ese sitio de la cola y no al final.
 *
 * @param {FxStep} step
 * @param {number} [at]
 */
export function pushFx(step, at) {
    if (!step || typeof step !== 'object') return;
    if (Number.isInteger(at) && /** @type {number} */ (at) >= 0 && /** @type {number} */ (at) < queue.length) queue.splice(/** @type {number} */ (at), 0, step);
    else queue.push(step);
    if (playing) return;
    playing = true;
    startedAt = Date.now();
    markBusy(true);
    // Lo que el motor hace en esta misma llamada (más pasos, el redibujado que se aplaza) va antes.
    void Promise.resolve().then(play);
}

/** @returns {Document|null} */
function doc() {
    return typeof document === 'undefined' ? null : document;
}

/**
 * Una espera que se corta al pasar la secuencia.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
    if (skipping || !(ms > 0)) return Promise.resolve();
    return new Promise(resolve => {
        const done = () => {
            clearTimeout(timer);
            sleepers.delete(done);
            resolve();
        };
        const timer = setTimeout(done, ms);
        sleepers.add(done);
    });
}

/**
 * Lo que dura algo, con el nivel de las animaciones. `read`: es para leerlo, y con «ninguna» se deja
 * un momento a la vista en vez de nada.
 *
 * @param {number} base
 * @param {{read?: boolean}} [options]
 * @returns {number}
 */
export function fxMs(base, { read = false } = {}) {
    if (skipping) return 0;
    const now = forcedLevel ?? level;
    if (now === 'none') return read ? Math.min(base, STILL_READ_MS) : 0;
    return motionMs(base, now);
}

async function play() {
    level = forcedLevel ?? safeLevel();
    if (instantPace()) skipping = true;
    try {
        while (queue.length > 0) {
            if (Date.now() - startedAt > MAX_SEQUENCE_MS) skipping = true;
            await waitForBlockers();
            const step = /** @type {FxStep} */ (queue.shift());
            if (!skipping && (step.kind === 'attack' || step.kind === 'roll' || step.kind === 'turn')) await waitForWalks();
            try {
                // Tanda 21: el golpe que espera sale justo antes de lo que le toca (el impacto, el
                // «Falla»); el primer dado y la línea del daño van antes que él.
                if (pendingBlow && blowGoesBefore(step.kind, pendingBlow.rolled)) await releaseBlow();
                else if (pendingBlow && step.kind === 'roll') pendingBlow.rolled = true;
                await runStep(step);
            } catch (error) {
                console.warn('[combat-fx] un paso de la secuencia ha fallado', step?.kind, error);
            }
        }
        // Lo anunciado que nada ha recibido (una salvación superada) sale al final, una vez.
        if (pendingBlow) await releaseBlow();
    } catch (error) {
        console.warn('[combat-fx] la secuencia se ha cortado', error);
    } finally {
        dropPendingBlow();
        finish();
    }
}

/**
 * Tanda 21 (Daniel, 2026-10-03: «la ficha se mueve dos veces al atacar»): si el golpe anunciado
 * (`attack`) sale antes de un paso. Se lanza una sola vez, al ejecutarse: no con el primer dado
 * (rueda con quien ataca quieto) ni con la línea del daño, que se lee en la tarjeta; sí antes del
 * impacto, del «Falla», de otro dado, de otro golpe o de otro turno.
 *
 * @param {FxStep['kind']} kind El paso que llega.
 * @param {boolean} rolled Si el dado de ese golpe ya ha rodado.
 * @returns {boolean}
 */
export function blowGoesBefore(kind, rolled) {
    if (kind === 'damage' || kind === 'bark') return false;
    if (kind === 'roll') return rolled;
    return true;
}

/** @returns {'normal'|'short'|'none'} */
function safeLevel() {
    try {
        return motionLevel();
    } catch {
        return 'normal';
    }
}

/** Se acabó: la tarjeta se va, se redibuja lo aplazado y sigue lo que esperaba. */
function finish() {
    clearStage();
    playing = false;
    skipping = false;
    markBusy(false);
    const redraws = [...owed];
    owed.clear();
    for (const redraw of redraws) {
        try {
            redraw();
        } catch (error) {
            console.error('[combat-fx] al redibujar tras la secuencia', error);
        }
    }
    // Si al redibujar ha empezado otra secuencia, lo que esperaba sigue esperando a esa.
    if (fxBusy()) return;
    const after = waiters;
    waiters = [];
    for (const fn of after) {
        try {
            fn();
        } catch (error) {
            console.error('[combat-fx] lo que esperaba a la secuencia', error);
        }
    }
}

/** Mientras haya una ventana de dados de las de antes, se espera a que se cierre. */
async function waitForBlockers() {
    const d = doc();
    if (!d) return;
    while (d.querySelector(BLOCKERS)) {
        hideCard();
        await new Promise(resolve => setTimeout(resolve, 150));
    }
}

/**
 * @param {boolean} on
 */
function markBusy(on) {
    const root = doc()?.documentElement;
    if (!root) return;
    if (on) root.dataset.vfxBusy = 'true';
    else {
        delete root.dataset.vfxBusy;
        delete root.dataset.vfxTurn;
    }
}

/**
 * @param {FxStep} step
 * @returns {Promise<void>}
 */
async function runStep(step) {
    switch (step.kind) {
        case 'turn': return runTurn(step);
        case 'move': return runMove(step);
        case 'attack': return runAttack(step);
        case 'roll': return runRoll(step);
        case 'damage': return runDamage(step);
        case 'impact': return runImpact(step);
        case 'miss': return runMiss(step);
        case 'bark': return runBark(step);
        case 'call':
            step.fn?.();
            return;
        default: return;
    }
}

// ---- El tablero ------------------------------------------------------------------------

/**
 * La ficha a la vista con ese id (`data-token-id`).
 *
 * @param {any} id
 * @returns {HTMLElement|null}
 */
function tokenEl(id) {
    const d = doc();
    if (!d || id === null || id === undefined || id === '') return null;
    for (const token of d.querySelectorAll('.wm-token')) {
        if (token instanceof HTMLElement && token.dataset.tokenId === String(id) && token.offsetParent) return token;
    }
    return null;
}

/**
 * @param {HTMLElement} el
 * @param {'left'|'top'} prop
 * @returns {number}
 */
function px(el, prop) {
    return parseFloat(el.style[prop]) || 0;
}

/**
 * Una animación del navegador, si la hay; se espera a que acabe (o se corta al pasar).
 *
 * @param {HTMLElement} el
 * @param {Keyframe[]} frames
 * @param {number} ms
 * @param {string} [easing]
 * @returns {Promise<void>}
 */
async function animate(el, frames, ms, easing = 'ease-out') {
    if (!(ms > 0) || typeof el.animate !== 'function') return;
    const run = el.animate(frames, { duration: ms, easing });
    const done = () => run.finish();
    sleepers.add(done);
    try {
        await run.finished;
    } catch { /* cortada */ } finally {
        sleepers.delete(done);
    }
}

/**
 * La vida de alguien en lo que se ve: su fila de la iniciativa y la ficha. Se cambia a mano en el
 * tablero que se está enseñando; al acabar la secuencia se redibuja con lo de verdad.
 *
 * @param {any} entryId
 * @param {any} tokenId
 * @param {number} hp
 * @param {number} max
 */
function showHp(entryId, tokenId, hp, max) {
    const d = doc();
    if (!d || !(max > 0)) return;
    const left = Math.max(0, Number(hp) || 0);
    const pct = Math.max(0, Math.min(100, (left / max) * 100));
    for (const row of d.querySelectorAll('.wm-init-row')) {
        if (!(row instanceof HTMLElement) || row.dataset.entryId !== String(entryId)) continue;
        // La marca antes que el ancho: con ella, la barra baja deslizándose (combat-vtt.css, sección 6).
        row.classList.remove('vfx-hp-changed');
        void row.offsetWidth;
        row.classList.add('vfx-hp-changed');
        const fill = /** @type {HTMLElement|null} */ (row.querySelector('.wm-init-hp-fill'));
        if (fill) fill.style.width = `${pct}%`;
        const text = row.querySelector('.wm-init-hp-text');
        if (text) text.textContent = `${left}/${max}`;
        row.querySelector('.wm-init-hp')?.setAttribute('aria-valuenow', String(left));
        row.classList.toggle('bloodied', left > 0 && left <= max / 2);
        row.classList.toggle('defeated', left <= 0);
    }
    const token = tokenEl(tokenId);
    const tip = /** @type {HTMLElement|null} */ (token?.querySelector('.wm-token-tooltip-hp-fill') ?? null);
    if (tip) tip.style.width = `${pct}%`;
    token?.classList.toggle('vfx-down', left <= 0);
}

/**
 * De quién es el turno, en lo que se ve: su fila de la iniciativa marcada, la cabecera y su ficha.
 *
 * @param {FxStep} step
 */
function showTurnHolder(step) {
    const d = doc();
    if (!d) return;
    for (const row of d.querySelectorAll('.wm-init-row')) {
        if (!(row instanceof HTMLElement)) continue;
        const on = row.dataset.entryId === String(step.entryId);
        row.classList.toggle('current', on);
        if (on) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
    }
    for (const line of d.querySelectorAll('.wm-init-turn')) line.textContent = `Turno de ${step.name ?? ''}`;
    // El aro de quien tiene el turno (el de world-map-renderer.js: `wm-token-active` y su aro), en
    // su ficha: el tablero no se redibuja mientras se enseña la secuencia.
    const side = step.side === 'you' ? 'yours' : String(step.side ?? '');
    for (const token of d.querySelectorAll('.wm-token.wm-token-active, .wm-token.vfx-turn-token')) {
        token.classList.remove('wm-token-active', 'vfx-turn-token');
        token.querySelector('.wm-token-turn-ring')?.remove();
    }
    const token = tokenEl(step.tokenId);
    if (token) {
        token.classList.add('wm-token-active', 'vfx-turn-token');
        token.dataset.turnSide = side;
        const ring = d.createElement('span');
        ring.className = 'wm-token-turn-ring';
        ring.setAttribute('aria-hidden', 'true');
        token.prepend(ring);
    }
    // La barra de abajo, en espera mientras juega otro (la de verdad llega al acabar).
    for (const bar of d.querySelectorAll('#game-shell .gs-vtt-bar')) {
        bar.classList.toggle('gs-vtt-waiting', step.side !== 'you');
        const label = bar.querySelector('.gs-turn-label');
        if (label) label.textContent = `Turno de ${step.name ?? ''}`;
    }
    const root = d.documentElement;
    if (root) {
        root.dataset.vfxTurn = String(step.side ?? '');
        root.dataset.gsTurnSide = side;
    }
}

// ---- La capa de la secuencia: la tarjeta del dado y el rótulo del turno ----------------------

/** @type {HTMLElement|null} */
let stage = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let bannerTimer = null;

/**
 * La capa encima del tablero, del tamaño del tablero. No recibe clics; la tarjeta, sí.
 *
 * @returns {HTMLElement|null}
 */
function stageEl() {
    const d = doc();
    if (!d) return null;
    const shell = d.querySelector('#game-shell');
    const host = shell ?? d.body;
    if (!stage || !stage.isConnected || stage.parentElement !== host) {
        stage?.remove();
        stage = d.createElement('div');
        stage.className = 'vfx-stage';
        host.appendChild(stage);
    }
    // Encima del tablero, sea cual sea su sitio (en el teléfono, la pantalla entera).
    const board = d.querySelector('#game-shell .gs-scene-map') ?? d.querySelector('#game-shell .gs-stage');
    const box = board instanceof HTMLElement ? board.getBoundingClientRect() : null;
    if (box && box.width > 40 && box.height > 40) {
        Object.assign(stage.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    } else {
        Object.assign(stage.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
    }
    return stage;
}

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
    const node = /** @type {Document} */ (doc()).createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/** Las fichas del golpe que se está enseñando (quien ataca y a quién): la tarjeta no las tapa. */
let focusIds = /** @type {any[]} */ ([]);

/**
 * En el teléfono el tablero es una franja entre las islas de arriba (la iniciativa, el resumen) y
 * las de abajo (la cámara, la barra): la tarjeta, apretada (combat-vtt.css, sección 6), va justo
 * debajo de las de arriba; si ahí tapa a quien ataca o a quien recibe, justo encima de las de
 * abajo. En pantalla grande se queda donde la pone la hoja: encima de la barra.
 *
 * @param {HTMLElement} card
 */
function placeCard(card) {
    const d = doc();
    if (!d || !stage) return;
    const box = stage.getBoundingClientRect();
    if (box.width > 600) return;
    const islands = [...d.querySelectorAll('#game-shell .vtt-hud .vtt-island, #game-shell .gs-vtt-bar')]
        .map(node => node.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0);
    const middle = box.top + box.height / 2;
    const topLimit = Math.max(box.top, ...islands.filter(r => r.bottom < middle).map(r => r.bottom));
    const bottomLimit = Math.min(box.bottom, ...islands.filter(r => r.top > middle).map(r => r.top));
    const height = card.offsetHeight || 96;
    const hides = (/** @type {number} */ top) => focusIds.some(id => {
        const r = tokenEl(id)?.getBoundingClientRect();
        return Boolean(r) && /** @type {DOMRect} */ (r).bottom > top && /** @type {DOMRect} */ (r).top < top + height;
    });
    const above = topLimit + 6;
    const below = bottomLimit - 6 - height;
    const top = hides(above) && below > above && !hides(below) ? below : above;
    card.style.top = `${Math.round(top - box.top)}px`;
    card.style.bottom = 'auto';
}

/** La tarjeta del dado, si está. @returns {HTMLElement|null} */
function cardEl() {
    return /** @type {HTMLElement|null} */ (stage?.querySelector('.vfx-card') ?? null);
}

function hideCard() {
    const card = cardEl();
    if (!card) return;
    card.classList.add('vfx-out');
    card.classList.remove('vfx-in');
    const gone = card;
    setTimeout(() => gone.remove(), 220);
}

/**
 * @param {boolean} [keepYours] El «Te toca» se queda un momento más, aunque la secuencia acabe.
 */
function hideBanner(keepYours = false) {
    const banner = /** @type {HTMLElement|null} */ (stage?.querySelector('.vfx-banner') ?? null);
    if (!banner) return;
    if (keepYours && banner.classList.contains('vfx-banner-you')) {
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => {
            banner.classList.add('vfx-out');
            setTimeout(() => {
                banner.remove();
                if (stage && stage.childElementCount === 0) stage.remove();
            }, 260);
        }, Math.max(STILL_READ_MS, motionMs(1300, level)));
        return;
    }
    banner.remove();
}

function clearStage() {
    hideCard();
    hideBanner(true);
    const d = doc();
    for (const token of d?.querySelectorAll('.wm-token.vfx-turn-token, .wm-token.vfx-acting, .wm-token.vfx-targeted, .wm-token.vfx-readying') ?? []) {
        token.classList.remove('vfx-turn-token', 'vfx-acting', 'vfx-targeted', 'vfx-readying');
    }
    if (stage && !stage.querySelector('.vfx-banner')) {
        const gone = stage;
        setTimeout(() => { if (gone.childElementCount === 0) gone.remove(); }, 260);
    }
}

// ---- Los pasos --------------------------------------------------------------------------

/** Cuántos turnos se han anunciado desde aquí: cada uno es nuevo para el cartel. */
let turnsSaid = 0;

/**
 * Empieza el turno de alguien: su fila de la iniciativa encendida, su aro en el tablero y, si no
 * es tuyo, el cartel («Turno del ratero del muelle»). El tuyo lo anuncia el tablero al dibujarse de
 * verdad, al acabar la secuencia («Tu turno, Nerea»): justo cuando ya se puede jugar.
 *
 * @param {FxStep} step
 */
async function runTurn(step) {
    hideCard();
    lastBlow = { style: '', damageType: '', angle: 0 };
    focusIds = [step.tokenId];
    showTurnHolder(step);
    if (step.side === 'you') {
        await wait(fxMs(FX_MS.gap));
        return;
    }
    const side = step.side === 'ally' ? 'ally' : 'enemy';
    const name = String(step.name ?? '');
    const d = doc();
    let said = false;
    if (d && typeof turnBanner.announceTurn === 'function') {
        turnsSaid += 1;
        const text = typeof turnBanner.turnBannerText === 'function' ? turnBanner.turnBannerText({ name, side }) : `Turno de ${name}`;
        said = turnBanner.announceTurn({
            key: `secuencia|${turnsSaid}|${step.entryId}`,
            text,
            side,
            anchor: () => /** @type {HTMLElement|null} */ (d.querySelector('.gs-root .wm-vtt .wm-container') ?? d.querySelector('#game-shell .gs-scene-map')),
        });
    }
    if (!said) {
        const host = stageEl();
        if (host) {
            if (bannerTimer) clearTimeout(bannerTimer);
            host.querySelector('.vfx-banner')?.remove();
            const banner = el('div', `vfx-banner vfx-banner-${side}`, `Turno de ${name}`);
            banner.setAttribute('role', 'status');
            host.appendChild(banner);
            banner.classList.add('vfx-in');
        }
    }
    await wait(fxMs(FX_MS.turn, { read: true }));
    stage?.querySelector('.vfx-banner')?.classList.add('vfx-out');
}

/**
 * Alguien anda: su ficha recorre las casillas del camino.
 *
 * @param {FxStep} step
 */
async function runMove(step) {
    const token = tokenEl(step.tokenId);
    const path = Array.isArray(step.path) ? step.path.filter(c => c && Number.isFinite(Number(c.x)) && Number.isFinite(Number(c.y))) : [];
    if (!token || path.length < 2) return;
    const from = path[0];
    const cellW = px(token, 'left') / (Number(from.x) + 0.5);
    const cellH = px(token, 'top') / (Number(from.y) + 0.5);
    if (!(cellW > 0) || !(cellH > 0)) return;
    const frames = path.map(c => ({ left: `${(Number(c.x) + 0.5) * cellW}px`, top: `${(Number(c.y) + 0.5) * cellH}px` }));
    const last = frames[frames.length - 1];
    await animate(token, frames, fxMs(Math.min(FX_MS.moveMax, FX_MS.moveCell * (path.length - 1))), 'linear');
    token.style.left = last.left;
    token.style.top = last.top;
    // Ya se ha visto andar: al redibujarse el tablero (que recuerda dónde estaba cada ficha y la
    // hace andar si ha cambiado, `token-slide.js`), no vuelve a andar el mismo camino.
    const end = path[path.length - 1];
    const renderer = await boardRenderer();
    if (typeof renderer?.noteTokenShownAt === 'function') renderer.noteTokenShownAt(step.tokenId, { x: Number(end.x), y: Number(end.y) });
}

/** @type {Promise<any>|null} */
let rendererLoad = null;

/**
 * El que dibuja el tablero (`world-map-renderer.js`), ya cargado en la página: lo que recuerda de
 * las fichas que andan. Sin página (las pruebas), nada.
 *
 * @returns {Promise<any>}
 */
function boardRenderer() {
    if (!doc()) return Promise.resolve(null);
    rendererLoad ??= import('../../../world-map-renderer.js').catch(() => null);
    return rendererLoad;
}

/**
 * Si una ficha va andando en el tablero (`token-slide.js`: has andado y atacas), el golpe espera a
 * que llegue. Como mucho, un segundo y medio.
 */
async function waitForWalks() {
    const renderer = await boardRenderer();
    if (typeof renderer?.boardMotionLeftMs !== 'function') return;
    const left = Math.min(1500, Number(renderer.boardMotionLeftMs()) || 0);
    if (left > 0) await wait(left + 40);
}

/**
 * Se anuncia un golpe: quién ataca a quién. Tanda 21: aún no se mueve nadie. Quien ataca brilla
 * («preparándose») y su objetivo queda marcado mientras rueda el dado; el golpe sale después, una
 * sola vez (`releaseBlow`).
 *
 * @param {FxStep} step
 */
async function runAttack(step) {
    hideCard();
    focusIds = [step.from, step.to];
    // J12.19: cómo llega el golpe (un tajo, una flecha, fuego…) se decide con esto.
    lastBlow = { style: String(step.style || 'melee'), damageType: String(step.damageType ?? ''), angle: 0 };
    const from = tokenEl(step.from);
    const to = tokenEl(step.to);
    if (from && to) lastBlow.angle = Math.atan2(px(to, 'top') - px(from, 'top'), px(to, 'left') - px(from, 'left'));
    from?.classList.add('vfx-acting', 'vfx-readying');
    to?.classList.add('vfx-targeted');
    pendingBlow = { step, rolled: false };
}

/** Tanda 21: quita lo que esperaba sin que se vea (al cortarse la secuencia). */
function dropPendingBlow() {
    if (!pendingBlow) return;
    const step = pendingBlow.step;
    pendingBlow = null;
    tokenEl(step.from)?.classList.remove('vfx-readying', 'vfx-acting');
}

/**
 * El golpe sale: de cerca, quien ataca se lanza hacia su objetivo y vuelve; de lejos, sale la
 * flecha (o el conjuro, o lo que se tira) hasta él. Tanda 21: una sola vez, cuando llega.
 */
async function releaseBlow() {
    const blow = pendingBlow;
    pendingBlow = null;
    if (!blow) return;
    const step = blow.step;
    const from = tokenEl(step.from);
    const to = tokenEl(step.to);
    from?.classList.remove('vfx-readying');
    if (!from || !to) {
        from?.classList.remove('vfx-acting');
        return;
    }
    const dx = px(to, 'left') - px(from, 'left');
    const dy = px(to, 'top') - px(from, 'top');
    from.classList.add('vfx-acting');
    to.classList.add('vfx-targeted');
    try {
        if (step.style === 'melee' || !step.style) {
            await animate(from, [
                { translate: '0px 0px' },
                { translate: `${-dx * 0.08}px ${-dy * 0.08}px`, offset: 0.3 },
                { translate: `${dx * 0.42}px ${dy * 0.42}px`, offset: 0.62 },
                { translate: '0px 0px' },
            ], fxMs(FX_MS.lunge), 'cubic-bezier(.4,.1,.3,1)');
        } else {
            const layer = from.parentElement;
            if (!layer) return;
            const bolt = el('div', `vfx-bolt vfx-bolt-${String(step.style).replace(/[^a-z]/g, '')}`);
            bolt.style.left = from.style.left;
            bolt.style.top = from.style.top;
            bolt.style.setProperty('--vfx-angle', `${Math.atan2(dy, dx)}rad`);
            layer.appendChild(bolt);
            // Quien dispara se echa un poco atrás.
            void animate(from, [{ translate: '0px 0px' }, { translate: `${-dx * 0.06}px ${-dy * 0.06}px` }, { translate: '0px 0px' }], fxMs(FX_MS.shot * 0.6));
            await animate(bolt, [{ translate: '0px 0px', opacity: 0.4 }, { translate: `${dx * 0.15}px ${dy * 0.15}px`, opacity: 1, offset: 0.15 }, { translate: `${dx}px ${dy}px`, opacity: 1 }], fxMs(FX_MS.shot), 'ease-in');
            bolt.remove();
        }
    } finally {
        from.classList.remove('vfx-acting');
    }
}

/**
 * El d20: la tarjeta con quién tira y contra quién, el dado (dos, con ventaja o desventaja) que
 * rueda y se para, y la cuenta con lo que pasa.
 *
 * @param {FxStep} step
 */
async function runRoll(step) {
    const host = stageEl();
    if (!host) return;
    host.querySelector('.vfx-banner:not(.vfx-banner-you)')?.remove();
    cardEl()?.remove();
    const natural = Number(step.natural) || 0;
    const shown = {
        natural, total: Number(step.total) || 0, dc: step.dc ?? null, against: step.against ?? '', hit: step.hit ?? null,
        rolls: step.rolls, edge: step.edge,
    };
    const verdict = rollVerdict({ ...shown, against: shown.against || (shown.dc == null ? '' : 'CA') });
    const side = step.side === 'enemy' ? 'enemy' : 'party';

    const card = el('div', `vfx-card vfx-card-${side}`);
    card.setAttribute('role', 'status');
    const head = el('div', 'vfx-card-head');
    head.appendChild(el('div', 'vfx-card-title', String(step.title ?? '')));
    if (step.subtitle) head.appendChild(el('div', 'vfx-card-sub', String(step.subtitle)));
    card.appendChild(head);

    const rolls = Array.isArray(step.rolls) && step.rolls.length === 2 && step.edge && step.edge !== 'normal'
        ? step.rolls.map(Number) : [natural];
    const keptAt = Math.max(0, rolls.indexOf(natural));
    const diceRow = el('div', 'vfx-dice');
    const dice = rolls.map(() => buildDie({ side, kept: true }));
    for (const die of dice) diceRow.appendChild(die);
    card.appendChild(diceRow);
    const edgeLine = el('div', 'vfx-edge-line', '');
    card.appendChild(edgeLine);
    const line = el('div', 'vfx-roll-line', '');
    card.appendChild(line);
    card.appendChild(el('div', 'vfx-dmg-line', ''));

    const skip = /** @type {HTMLButtonElement} */ (el('button', 'vfx-skip', 'Pasar'));
    skip.type = 'button';
    skip.title = 'Enseñar lo que queda de golpe';
    skip.addEventListener('click', (event) => {
        event.stopPropagation();
        skipFx();
    });
    card.appendChild(skip);
    host.appendChild(card);
    placeCard(card);
    card.classList.add('vfx-in');

    const tumble = fxMs(FX_MS.tumble);
    const lands = dice.map(die => spinDie(die, tumble));
    await wait(tumble);
    lands.forEach((land, i) => land(rolls[i]));
    dice.forEach((die, i) => die.classList.toggle('vfx-die-dropped', rolls.length > 1 && i !== keptAt));

    edgeLine.textContent = edgeSentence(shown);
    line.textContent = rollSentence(shown);
    card.classList.add('vfx-landed');
    card.classList.toggle('vfx-good', verdict.good === true);
    card.classList.toggle('vfx-bad', verdict.good === false);
    card.classList.toggle('vfx-crit', verdict.crit);
    card.classList.toggle('vfx-fumble', verdict.fumble);
    await wait(fxMs(FX_MS.read, { read: true }));
}

/**
 * La línea del daño, debajo del dado.
 *
 * @param {FxStep} step
 */
async function runDamage(step) {
    const line = /** @type {HTMLElement|null} */ (cardEl()?.querySelector('.vfx-dmg-line') ?? null);
    if (!line) return;
    line.textContent = damageSentence({ total: Number(step.total) || 0, dice: step.dice, modifier: step.modifier, crit: step.crit });
    line.classList.add('vfx-in');
    await wait(fxMs(FX_MS.damage, { read: true }));
}

/**
 * El golpe llega: un destello y una sacudida en la ficha, el número que sube y, a la vez, la vida
 * que baja en la iniciativa.
 *
 * @param {FxStep} step
 */
async function runImpact(step) {
    const token = tokenEl(step.tokenId);
    const style = step.style === 'crit' ? 'crit' : step.style === 'heal' ? 'heal' : 'damage';
    // Con «Animaciones: ninguna», el número y la vida se quedan quietos un momento, para verlos.
    const total = fxMs(FX_MS.impact, { read: true });
    if (token) {
        token.classList.remove('vfx-hit', 'vfx-hit-crit', 'vfx-heal');
        void token.offsetWidth;
        token.classList.add(style === 'heal' ? 'vfx-heal' : style === 'crit' ? 'vfx-hit-crit' : 'vfx-hit');
        // J12.19: el golpe dibujado según lo que lo hace (tres tajos, una punzada, una llamarada…);
        // la cura, unas chispas verdes. Con «Animaciones: ninguna», aparece quieto y se va.
        const still = (forcedLevel ?? level) === 'none';
        const kind = style === 'heal' ? 'heal' : impactKind(step.damageType || lastBlow.damageType, { style: lastBlow.style });
        const blow = impactNode(token.ownerDocument, kind, { crit: style === 'crit', still, angle: lastBlow.angle, ms: fxMs(FX_MS.impact) || STILL_READ_MS });
        token.appendChild(blow);
        setTimeout(() => blow.remove(), Math.max(900, total * 1.6));
        token.dataset.vfxImpact = kind;
        // El número, grande; un crítico, en oro con «¡Crítico!» encima.
        const float = el('div', `wm-float wm-float-${style} vfx-float vfx-float-big`, String(step.text ?? ''));
        token.appendChild(float);
        setTimeout(() => float.remove(), Math.max(1600, total * 2.5));
        if (style === 'crit') {
            const word = el('div', 'wm-float vfx-float vfx-crit-word', '¡Crítico!');
            token.appendChild(word);
            setTimeout(() => word.remove(), Math.max(1800, total * 2.8));
        }
        if (style !== 'heal') {
            void animate(token, [
                { translate: '0px 0px' }, { translate: '-5px 1px' }, { translate: '5px -1px' },
                { translate: '-3px 0px' }, { translate: '3px 0px' }, { translate: '0px 0px' },
            ], fxMs(FX_MS.impact) * 0.6, 'linear');
        }
    }
    await wait(total * 0.4);
    if (step.max) showHp(step.entryId, step.tokenId, Number(step.hp) || 0, Number(step.max) || 0);
    await wait(total * 0.6);
    token?.classList.remove('vfx-hit', 'vfx-hit-crit', 'vfx-heal', 'vfx-targeted');
    if (token) delete token.dataset.vfxImpact;
    // J12.19: si cae, se tumba, se apaga y se dice; su marca se queda (el tablero, al dibujarse de
    // verdad, la pone igual: `isDownToken` en world-map-renderer.js).
    if (style !== 'heal' && Number(step.max) > 0 && (Number(step.hp) || 0) <= 0) await runDown(step, token);
    await wait(fxMs(FX_MS.gap));
}

/**
 * J12.19: quien cae. La ficha se tumba y se apaga con su marca (calavera, o el corazón roto de
 * uno de los tuyos) y encima se lee «Cae Ratero del muelle» o «Nerea cae inconsciente».
 *
 * @param {FxStep} step
 * @param {HTMLElement|null} token
 */
async function runDown(step, token) {
    if (!token) return;
    const team = step.team === 'party' ? 'party' : 'enemy';
    token.classList.add('vfx-down', 'vfx-fall', 'wm-token-down');
    token.dataset.down = team;
    if (!token.querySelector('.wm-token-down-mark')) token.appendChild(downMarkNode(token.ownerDocument, team));
    const said = String(step.name ?? '').trim();
    if (said) {
        const caption = el('div', `vfx-down-caption vfx-down-${team}`, downCaption({ name: said, side: team }));
        token.appendChild(caption);
        setTimeout(() => caption.remove(), Math.max(1800, fxMs(FX_MS.down, { read: true }) * 2.6));
    }
    await wait(fxMs(FX_MS.down, { read: true }));
}

/**
 * No llega: el objetivo se aparta y sale «Falla».
 *
 * @param {FxStep} step
 */
async function runMiss(step) {
    const token = tokenEl(step.tokenId);
    const total = fxMs(FX_MS.miss, { read: true });
    if (token) {
        // J12.19: «¡Falla!», claro y grande, y un silbido al lado de la ficha.
        const float = el('div', 'wm-float vfx-float vfx-float-miss', '¡Falla!');
        token.appendChild(float);
        setTimeout(() => float.remove(), Math.max(1400, total * 2.5));
        const whoosh = el('div', `vfx-miss-whoosh${(forcedLevel ?? level) === 'none' ? ' vfx-still' : ''}`);
        whoosh.setAttribute('aria-hidden', 'true');
        whoosh.style.setProperty('--vfx-angle', `${lastBlow.angle}rad`);
        token.appendChild(whoosh);
        setTimeout(() => whoosh.remove(), Math.max(700, total * 1.4));
        await animate(token, [{ translate: '0px 0px' }, { translate: '9px -4px', offset: 0.35 }, { translate: '0px 0px' }], fxMs(FX_MS.miss) * 0.7);
        token.classList.remove('vfx-targeted');
    }
    // Lo que queda para leer «Falla» (sin moverse, con «Animaciones: ninguna», todo el rato).
    await wait(Math.max(total * 0.3, total - fxMs(FX_MS.miss) * 0.7) + fxMs(FX_MS.gap));
}

/**
 * Alguien grita algo (lo de siempre de `floatOnToken`), en su sitio de la secuencia. No espera.
 *
 * @param {FxStep} step
 */
function runBark(step) {
    const token = tokenEl(step.tokenId);
    if (!token) return;
    const node = el('div', 'wm-bark wm-bark-enemy', String(step.text ?? ''));
    token.appendChild(node);
    setTimeout(() => node.remove(), 2600);
}
