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
import { combatLogPanel, combatLogFilter, showTip } from './main.js';

/** @type {HTMLElement|null} */
let combatDiceOverlayElement = null;

/** @type {Array<{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string}>} */
let combatDiceQueue = [];

let combatDiceAnimating = false;

/**
 * Pinta el registro con el filtro puesto.
 */
export function paintCombatLog() {
    if (!combatLogPanel) return;
    renderCombatLog(combatLogPanel, filterLog(combatLogEntries, combatLogFilter));
}

/**
 * Adds an entry to the log and repaints it if it is visible.
 * @param {import('../game-engine/ui/combat-log.js').LogEntry|null} item
 */
export function pushCombatLogEntry(item) {
    if (!item) return;
    setCombatLogEntries(appendLogEntry(combatLogEntries, item));
    paintCombatLog();
}

/**
 * Mirrors a narration line into the log, one entry per line.
 * @param {string} text
 */
export function pushCombatLogLines(text) {
    for (const line of String(text ?? '').split('\n')) {
        pushCombatLogEntry(lineToEntry(line));
    }
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
    const durationMs = 820;
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

        if (elapsed >= durationMs) {
            window.clearInterval(timer);
            dcEl.textContent = next.dc;
            totalEl.textContent = next.total;
            dcEl.classList.remove('rolling');
            totalEl.classList.remove('rolling');
            nextBtn.disabled = false;
            nextBtn.textContent = finalBtnText;
        }
    }, 42);

    nextBtn.onclick = () => {
        if (!combatDiceAnimating) return;
        window.clearInterval(timer);
        dcEl.classList.remove('rolling');
        totalEl.classList.remove('rolling');
        nextBtn.disabled = false;
        overlay.classList.remove('active');
        window.setTimeout(() => {
            combatDiceAnimating = false;
            flushCombatDiceQueue();
        }, 120);
    };

    overlay.classList.add('active');
}

/**
 * @param {{title: string, subtitle: string, dc: string, total: string, formula: string, classification: 'critical-success'|'success'|'failure'|'critical-failure', detail: string, glyph: string}} payload
 */
function queueCombatDiceRoll(payload) {
    combatDiceQueue.push(payload);
    flushCombatDiceQueue();
}

/**
 * @param {{ title: string, subtitle: string, formula: string, detail: string, total: number, dc?: number|null, natural?: number|null, glyph?: string }} param0
 */
export function showCombatDiceRoll({ title, subtitle, formula, detail, total, dc = null, natural = null, glyph = 'd20' }) {
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

    queueCombatDiceRoll({
        title,
        subtitle,
        dc: dc == null ? '--' : String(dc),
        total: String(total),
        formula,
        classification,
        detail,
        glyph,
    });
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
