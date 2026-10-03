/**
 * Lo que se ve de cada tirada: los dados que ruedan en pantalla, lo que sale flotando de una
 * ficha y el registro del combate junto al tablero.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata } from '../../script.js';
import { getRollClassification, getRollClassificationLabel } from './combat-rules.js';
import { addRoll } from '../game-engine/campaign/dice-log.js';
import {
    renderCombatLog, rollEntry, lineToEntry, append as appendLogEntry, filterLog,
} from '../game-engine/ui/combat-log.js';
import { DICE_LOG_KEY } from './keys.js';
import { combatLogEntries, setCombatLogEntries } from './state.js';
import { combatLogPanel, combatLogFilter } from './board-view.js';
import { showTip } from './narration.js';
import { focusLost, holdFocus } from '../game-engine/ui/keyboard-nav.js';
import { motionMs } from '../game-engine/ui/motion.js';
import { holdRedraw, stageFloat, stageRoll } from './combat-fx.js';

/** @type {HTMLElement|null} */
let combatDiceOverlayElement = null;

/** J15.5: al quitar los dados, el foco vuelve a lo que lo tenía antes de la primera tirada. @type {(() => void)|null} */
let combatDiceFocusBack = null;

/**
 * @typedef {Object} InitiativeRow H19 (tanda 22): la iniciativa de alguien, para la tarjeta de todos.
 * @property {string} id
 * @property {string} name
 * @property {number} natural El d20.
 * @property {number} modifier Lo que suma (Destreza, moral, quien vigila…).
 * @property {number} total
 * @property {boolean} enemy
 */

/** @type {Array<{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string, rows?: InitiativeRow[], onDone?: (() => void)|null}>} */
let combatDiceQueue = [];

let combatDiceAnimating = false;

/** H19 (tanda 22): si la tarjeta de la iniciativa está a la vista o esperando su turno. */
let initiativePending = 0;

/**
 * Pinta el registro con el filtro puesto.
 */
export function paintCombatLog() {
    if (!combatLogPanel) return;
    renderCombatLog(combatLogPanel, filterLog(combatLogEntries, combatLogFilter));
}

/** J20.6: si ya hay un repintado del registro pedido para el siguiente fotograma. */
let paintPending = false;

/**
 * J20.6: repinta el registro una vez por fotograma, justo antes de pintarlo, y no una vez por
 * línea. Un ataque escribe diez o doce líneas, y cada repintado obligaba al navegador a medir
 * la página entera (`scrollHeight`): en un teléfono, casi un tercio del trabajo de una pelea.
 */
function paintSoon() {
    if (paintPending) return;
    paintPending = true;
    const later = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (/** @type {() => void} */ fn) => setTimeout(fn, 0);
    later(() => {
        paintPending = false;
        // Tanda 17: mientras se ve un golpe, el resumen espera a que llegue (`combat-fx.js`).
        if (holdRedraw(paintCombatLog)) return;
        paintCombatLog();
    });
}

/**
 * Adds an entry to the log and repaints it if it is visible.
 * @param {import('../game-engine/ui/combat-log.js').LogEntry|null} item
 */
export function pushCombatLogEntry(item) {
    if (!item) return;
    setCombatLogEntries(appendLogEntry(combatLogEntries, item));
    paintSoon();
}

/**
 * Mirrors a narration line into the log, one entry per line.
 * @param {string} text
 */
export function pushCombatLogLines(text) {
    // J20.6: todas las líneas, y un solo repintado.
    let entries = combatLogEntries;
    for (const line of String(text ?? '').split('\n')) {
        const item = lineToEntry(line);
        if (item) entries = appendLogEntry(entries, item);
    }
    if (entries === combatLogEntries) return;
    setCombatLogEntries(entries);
    paintSoon();
}

function ensureCombatDiceOverlay() {
    if (combatDiceOverlayElement) return combatDiceOverlayElement;

    const overlay = document.createElement('div');
    overlay.className = 'wm-dice-overlay';
    overlay.innerHTML = `
        <div class="wm-dice-backdrop"></div>
        <div class="wm-dice-card">
            <div class="wm-dice-header">
                <div>
                    <div class="wm-dice-title"></div>
                    <div class="wm-dice-subtitle"></div>
                </div>
                <div class="wm-dice-result-badge"></div>
            </div>
            <div class="wm-dice-body">
                <div class="wm-dice-glyph"></div>
                <div class="wm-dice-metrics">
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Dificultad</div>
                        <div class="wm-dice-metric-value" data-field="dc"></div>
                    </div>
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Resultado</div>
                        <div class="wm-dice-metric-value" data-field="total"></div>
                    </div>
                    <div class="wm-dice-metric">
                        <div class="wm-dice-metric-label">Fórmula</div>
                        <div class="wm-dice-metric-value" data-field="formula"></div>
                    </div>
                </div>
            </div>
            <div class="wm-dice-result">
                <div class="wm-dice-detail"></div>
            </div>
            <div class="wm-dice-actions">
                <button class="menu_button wm-dice-next" type="button">Siguiente</button>
            </div>
        </div>
    `;

    // J15.5: los dados son una ventana: se anuncian con su título, y la tarjeta recibe el foco
    // mientras ruedan (el botón aún no se puede pulsar).
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.querySelector('.wm-dice-title')?.setAttribute('id', 'wm-dice-title');
    overlay.setAttribute('aria-labelledby', 'wm-dice-title');
    overlay.querySelector('.wm-dice-card')?.setAttribute('tabindex', '-1');
    overlay.querySelector('.wm-dice-result')?.setAttribute('aria-live', 'polite');
    // Escondidos (transparentes), no se pueden enfocar: Tab no llega a un botón que no se ve.
    overlay.inert = true;
    document.body.appendChild(overlay);
    combatDiceOverlayElement = overlay;
    return overlay;
}

function flushCombatDiceQueue() {
    if (combatDiceAnimating || combatDiceQueue.length === 0) return;
    const overlay = ensureCombatDiceOverlay();
    const next = combatDiceQueue.shift();
    if (!next) return;

    combatDiceAnimating = true;

    const titleEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-title'));
    const subtitleEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-subtitle'));
    const dcEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="dc"]'));
    const totalEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="total"]'));
    const formulaEl = /** @type {HTMLElement|null} */ (overlay.querySelector('[data-field="formula"]'));
    const glyphEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-glyph'));
    const detailEl = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-detail'));
    const badge = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-result-badge'));
    const nextBtn = /** @type {HTMLButtonElement|null} */ (overlay.querySelector('.wm-dice-next'));
    if (!titleEl || !subtitleEl || !dcEl || !totalEl || !formulaEl || !glyphEl || !detailEl || !badge || !nextBtn) return;

    titleEl.textContent = next.title;
    subtitleEl.textContent = next.subtitle;
    formulaEl.textContent = next.formula;
    // H19 (tanda 22): la iniciativa de todos, en una sola tarjeta que rueda a la vez.
    const initiative = paintInitiativeRows(overlay, next.rows ?? null);
    // La cara del dado: «d20» se lee tal cual; la iniciativa y el daño, con un dibujo.
    glyphEl.textContent = next.glyph === 'init' ? '⚡' : next.glyph === 'dmg' ? '💥' : next.glyph;
    detailEl.textContent = next.detail;

    // Sin nada que superar (la iniciativa, el daño), no hay éxito ni fallo que decir.
    const judged = next.dc !== '--' || next.classification !== 'success';
    badge.textContent = judged ? getRollClassificationLabel(next.classification) : '';
    badge.className = `wm-dice-result-badge ${judged ? next.classification : ''}`;

    const finalBtnText = combatDiceQueue.length > 0 ? 'Siguiente' : 'Cerrar';
    nextBtn.disabled = true;
    nextBtn.textContent = 'Tirando…';
    dcEl.classList.add('rolling');
    totalEl.classList.add('rolling');

    const dcNumeric = /^-?\d+$/.test(next.dc) ? Number(next.dc) : null;
    const totalNumeric = /^-?\d+$/.test(next.total) ? Number(next.total) : 0;
    const startedAt = Date.now();
    // J20.6 y J15.5: más corta en el teléfono, y sin rodar con «reducir movimiento».
    const durationMs = motionMs(820);
    const timer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        if (dcNumeric == null) {
            dcEl.textContent = '--';
        } else {
            const spread = Math.max(6, Math.abs(dcNumeric) + 6);
            const randomValue = Math.max(0, dcNumeric + Math.floor((Math.random() * spread) - spread / 2));
            dcEl.textContent = String(randomValue);
        }

        const totalSpread = Math.max(8, Math.abs(totalNumeric) + 8);
        const randomTotal = Math.max(0, totalNumeric + Math.floor((Math.random() * totalSpread) - totalSpread / 2));
        totalEl.textContent = String(randomTotal);
        for (const row of initiative) row.el.textContent = String(1 + Math.floor(Math.random() * 20) + row.modifier);

        if (elapsed >= durationMs) {
            window.clearInterval(timer);
            dcEl.textContent = next.dc;
            totalEl.textContent = next.total;
            for (const row of initiative) {
                row.el.textContent = String(row.total);
                row.el.classList.remove('rolling');
                row.roll.textContent = row.said;
            }
            dcEl.classList.remove('rolling');
            totalEl.classList.remove('rolling');
            nextBtn.disabled = false;
            nextBtn.textContent = finalBtnText;
            // J15.5: ya se puede pasar: el foco, al botón (Intro sigue).
            if (overlay.contains(document.activeElement) || focusLost()) nextBtn.focus({ preventScroll: true });
        }
    }, 42);

    // Un segundo clic en la misma tirada (dos toques seguidos, o Intro, que SillyTavern pulsa
    // además del navegador) no la cierra dos veces: la segunda vez dejaba la siguiente tirada a
    // la vista y sin poder cerrarse.
    let closed = false;
    nextBtn.onclick = () => {
        if (!combatDiceAnimating || closed) return;
        closed = true;
        window.clearInterval(timer);
        dcEl.classList.remove('rolling');
        totalEl.classList.remove('rolling');
        nextBtn.disabled = false;
        overlay.classList.remove('active');
        overlay.inert = true;
        window.setTimeout(() => {
            combatDiceAnimating = false;
            // H19: cerrada la iniciativa, la barra ya deja jugar (quien la pidió repinta).
            if (next.rows) {
                initiativePending = Math.max(0, initiativePending - 1);
                try {
                    next.onDone?.();
                } catch (error) {
                    console.error('[iniciativa]', error);
                }
            }
            flushCombatDiceQueue();
            // La última tirada: el foco, de vuelta a donde estaba (o a lo principal de la pelea).
            if (!combatDiceAnimating) {
                const back = combatDiceFocusBack;
                combatDiceFocusBack = null;
                back?.();
            }
        }, 120);
    };

    overlay.classList.add('active');
    overlay.inert = false;
    // J15.5: el foco entra en los dados; con la primera tirada se apunta de dónde venía.
    const card = /** @type {HTMLElement|null} */ (overlay.querySelector('.wm-dice-card'));
    if (!combatDiceFocusBack && card) combatDiceFocusBack = holdFocus(card, card);
    else if (card && !overlay.contains(document.activeElement)) card.focus({ preventScroll: true });
}

/**
 * @param {{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string, rows?: InitiativeRow[], onDone?: (() => void)|null}} payload
 */
function queueCombatDiceRoll(payload) {
    combatDiceQueue.push(payload);
    flushCombatDiceQueue();
}

/**
 * H19 (tanda 22): la lista de la tarjeta de la iniciativa (o quitarla, si la tirada es otra).
 *
 * @param {HTMLElement} overlay
 * @param {InitiativeRow[]|null} rows Ya en el orden de la pelea.
 * @returns {Array<{el: HTMLElement, total: number, modifier: number, roll: HTMLElement, said: string}>} Los números que ruedan.
 */
function paintInitiativeRows(overlay, rows) {
    overlay.classList.toggle('wm-dice-init', Boolean(rows));
    overlay.querySelector('.wm-dice-ini-list')?.remove();
    if (!rows) return [];
    const list = document.createElement('ol');
    list.className = 'wm-dice-ini-list';
    /** @type {Array<{el: HTMLElement, total: number, modifier: number, roll: HTMLElement, said: string}>} */
    const rolling = [];
    for (const row of rows) {
        const item = document.createElement('li');
        item.className = `wm-dice-ini-row${row.enemy ? ' wm-dice-ini-enemy' : ''}`;
        const name = document.createElement('span');
        name.className = 'wm-dice-ini-name';
        name.textContent = row.name;
        const roll = document.createElement('span');
        roll.className = 'wm-dice-ini-roll';
        // El dado se dice al pararse; mientras rueda, solo lo que se suma.
        const plus = `${row.modifier >= 0 ? '+' : '−'} ${Math.abs(row.modifier)}`;
        roll.textContent = `d20 ${plus}`;
        const total = document.createElement('span');
        total.className = 'wm-dice-ini-total rolling';
        total.textContent = String(row.total);
        item.append(name, roll, total);
        list.appendChild(item);
        rolling.push({ el: total, total: row.total, modifier: row.modifier, roll, said: `d20 (${row.natural}) ${plus}` });
    }
    overlay.querySelector('.wm-dice-result')?.before(list);
    return rolling;
}

/**
 * H19 (tanda 22): la iniciativa de todos a la vez, en una sola tarjeta. Antes salía un dado por
 * cabeza, y entre uno y otro la barra ya dejaba atacar (y el dado siguiente tapaba el menú). La
 * barra no se enciende hasta cerrarla (`initiativeShowing`); al cerrarla, `onDone`.
 *
 * @param {InitiativeRow[]} rows Ya en el orden de la pelea.
 * @param {{onDone?: (() => void)|null, title?: string}} [options]
 */
export function showInitiativeRolls(rows, { onDone = null, title = '¡Iniciativa!' } = {}) {
    const list = (Array.isArray(rows) ? rows : []).filter(row => row && row.name);
    if (list.length === 0) {
        onDone?.();
        return;
    }
    for (const row of list) {
        pushCombatLogEntry(rollEntry(
            `Iniciativa de ${row.name}`,
            { formula: `1d20${row.modifier >= 0 ? '+' : ''}${row.modifier}`, rolls: [], total: Number(row.total) || 0, natural: row.natural },
            null,
            row.enemy ? 'Iniciativa de enemigo' : 'Iniciativa de aliado',
        ));
    }
    initiativePending += 1;
    queueCombatDiceRoll({
        title,
        subtitle: list.length === 1 ? 'Entra en el orden de la pelea' : 'El orden de la pelea: de arriba abajo',
        dc: '--',
        total: '',
        formula: '',
        classification: 'success',
        detail: '',
        glyph: 'init',
        rows: list,
        onDone,
    });
}

/**
 * H19: si la tarjeta de la iniciativa está a la vista (o esperando): la barra espera.
 *
 * @returns {boolean}
 */
export function initiativeShowing() {
    return initiativePending > 0;
}

/**
 * Tanda 17: con `stage` (quién pega a quién y lo que ha decidido el motor), en el Modo Juego la
 * tirada no sale en su ventana: va a la secuencia del combate (`combat-fx.js`), con el dado que
 * rueda en el tablero.
 *
 * @param {{ title: string, subtitle: string, formula: string, detail: string, total: number, dc?: number|null, natural?: number|null, glyph?: string, stage?: import('./combat-fx.js').RollStage|null }} param0
 */
export function showCombatDiceRoll({ title, subtitle, formula, detail, total, dc = null, natural = null, glyph = 'd20', stage = null }) {
    // Idea 168: cada d20, apuntado, para poder contestar a «este dado me odia».
    if (glyph === 'd20' && chat_metadata && Number(natural) >= 1) {
        chat_metadata[DICE_LOG_KEY] = addRoll(chat_metadata[DICE_LOG_KEY], { title: String(title), natural: Number(natural), total: Number(total) || 0, dc });
    }
    // J2.2: la primera tirada contra un número (un golpe contra una CA, una prueba contra
    // una CD). La iniciativa no: ahí no hay nada que pasar.
    if (glyph === 'd20' && dc != null) showTip('roll');
    const classification = getRollClassification(natural, total, dc);

    // The log gets the breakdown, not the prose: seeing "1d20+5 · 17 · vs 15" is what
    // lets a player audit a resolver nobody is supervising.
    pushCombatLogEntry(rollEntry(
        String(title || ''),
        { formula: String(formula || ''), rolls: [], total: Number(total) || 0, natural },
        dc == null ? null : Number(dc),
        String(subtitle || ''),
    ));

    const shown = {
        title,
        subtitle,
        dc: dc == null ? '--' : String(dc),
        total: String(total),
        formula,
        classification,
        detail,
        glyph,
    };
    // Tanda 17: en la secuencia del combate, o su ventana de siempre en su sitio de la secuencia.
    if (stageRoll({ title, subtitle, formula, total, dc, natural, glyph, stage }, () => queueCombatDiceRoll(shown))) return classification;
    queueCombatDiceRoll(shown);
    return classification;
}

/**
 * Idea 188: algo que sale flotando de una ficha (daño, un grito). Se pinta un poco despues,
 * cuando el tablero ya se ha redibujado con el golpe.
 *
 * @param {number|string} tokenId
 * @param {string} text
 * @param {'damage'|'crit'|'heal'|'bark'} kind
 */
export function floatOnToken(tokenId, text, kind) {
    // Tanda 17: en pelea, el golpe llega en su sitio de la secuencia (`combat-fx.js`).
    if (stageFloat(tokenId, text, kind)) return;
    setTimeout(() => {
        const token = [...document.querySelectorAll('.wm-token')]
            .find(t => t instanceof HTMLElement && t.dataset.tokenId === String(tokenId) && t.offsetParent);
        if (!token) return;
        const node = document.createElement('div');
        node.className = kind === 'bark' ? 'wm-bark wm-bark-enemy' : `wm-float wm-float-${kind}`;
        node.textContent = text;
        token.appendChild(node);
        setTimeout(() => node.remove(), kind === 'bark' ? 2600 : 1400);
    }, 250);
}
