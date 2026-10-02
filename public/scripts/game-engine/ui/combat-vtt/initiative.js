/**
 * Tanda 10: la iniciativa del tablero de combate, arriba a la derecha. Cada uno con su cara en
 * un círculo de 26 px (su retrato o su bicho en pixel; si no, su inicial), su vida en una barra
 * y el turno marcado. Pulsar una fila lleva la cámara a esa persona. Ver
 * wiki/maquetas/ENCARGO_COMBATE_VTT.md.
 *
 * Las filas guardan los nombres de clase de antes (`wm-init-row`, `wm-init-face`…): lo que ya los
 * miraba (las pruebas, el teclado) sigue sirviendo. Quién mueve a un compañero o a una invocación
 * (J7.3, D-J32) va en su fila, con el botón de siempre (`wm-combat-control-btn`).
 *
 * Solo dibuja: lo que se pinta viene ya decidido en `buildTracker` (initiative-tracker.js).
 */

import { tokenLabel } from './token-label.js';

/**
 * @typedef {import('../../combat/initiative-tracker.js').TrackerEntry} TrackerEntry
 */

/**
 * @typedef {Object} ControlChoice Quién mueve a uno del grupo que no es el héroe.
 * @property {string} id
 * @property {string} name
 * @property {'player'|'engine'} control
 * @property {boolean} [summon]
 */

/**
 * @typedef {Object} InitiativeOptions
 * @property {{round: number, entries: TrackerEntry[], activeName: string, nextName: string}} tracker
 * @property {(entry: TrackerEntry) => string} [faceOf] Su cara (una URL), o vacío.
 * @property {(entry: TrackerEntry) => void} [onPick] Pulsar su fila: la cámara va a esa persona.
 * @property {string} [youId] El héroe: su fila dice «(tú)».
 * @property {ControlChoice[]} [controls]
 * @property {Record<string, string>} [controlLabels] Lo que dice cada forma de mover.
 * @property {(id: string, next: 'player'|'engine') => void} [onControl]
 * @property {Array<{label: string, status: string, optional?: boolean}>} [objectives] Lo que hay que conseguir.
 */

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * Lo que dice la cabecera: de quién es el turno y quién va después.
 *
 * @param {{activeName: string, nextName: string}} tracker
 * @returns {string}
 */
export function turnLine(tracker) {
    if (!tracker?.activeName) return '';
    const next = tracker.nextName && tracker.nextName !== tracker.activeName ? ` · después, ${tracker.nextName}` : '';
    return `Turno de ${tracker.activeName}${next}`;
}

/**
 * La inicial que sale si no hay cara.
 *
 * @param {string} name
 * @returns {string}
 */
export function initialOf(name) {
    return String(name ?? '').trim().charAt(0).toUpperCase() || '?';
}

/**
 * La isla de la iniciativa.
 *
 * @param {InitiativeOptions} options
 * @returns {HTMLElement}
 */
export function buildInitiative({
    tracker, faceOf = () => '', onPick = () => {}, youId = '', controls = [], controlLabels = {}, onControl = () => {}, objectives = [],
}) {
    const panel = el('section', 'vtt-init vtt-island');
    panel.setAttribute('aria-label', 'Iniciativa');

    const head = el('div', 'wm-init-head vtt-init-head');
    const round = el('span', 'wm-init-round');
    const roundIcon = el('i', 'fa-solid fa-list-ol');
    roundIcon.setAttribute('aria-hidden', 'true');
    round.append(roundIcon, document.createTextNode(` Ronda ${Number(tracker?.round) || 1}`));
    head.append(round, el('span', 'wm-init-turn', turnLine(tracker)));
    panel.appendChild(head);

    const list = el('div', 'wm-init-list');
    const byId = new Map((Array.isArray(controls) ? controls : []).map(choice => [String(choice.id), choice]));
    // Tanda 17: en el teléfono, la fila de caras lleva el nombre corto («Ratero»; `token-label.js`).
    const names = (tracker?.entries ?? []).map(entry => String(entry.name ?? ''));
    for (const entry of tracker?.entries ?? []) {
        const row = el('div', 'wm-init-row');
        row.classList.toggle('current', Boolean(entry.isCurrent));
        row.classList.toggle('next', Boolean(entry.isNext));
        row.classList.toggle('enemy', Boolean(entry.isEnemy));
        row.classList.toggle('defeated', Boolean(entry.defeated));
        row.classList.toggle('bloodied', Boolean(entry.bloodied));
        row.dataset.entryId = String(entry.id);
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.title = `Pulsa para ver a ${entry.name} en el tablero`;
        if (entry.isCurrent) row.setAttribute('aria-current', 'true');

        row.appendChild(el('span', 'wm-init-score', String(entry.initiative)));
        // Su cara, o su inicial si no hay ninguna o no carga.
        const face = faceOf(entry);
        const initial = () => {
            const badge = el('span', 'wm-init-face wm-init-initial', initialOf(entry.name));
            badge.setAttribute('aria-hidden', 'true');
            return badge;
        };
        if (face) {
            const image = /** @type {HTMLImageElement} */ (el('img', 'wm-init-face'));
            image.alt = '';
            image.src = face;
            image.loading = 'lazy';
            image.decoding = 'async';
            if (face !== entry.avatar) image.classList.add('pixel-art');
            image.addEventListener('error', () => image.replaceWith(initial()), { once: true });
            row.appendChild(image);
        } else {
            row.appendChild(initial());
        }

        const body = el('div', 'wm-init-body');
        const nameLine = el('div', 'wm-init-name-line');
        const nameNode = el('span', 'wm-init-name', entry.name);
        nameNode.dataset.label = tokenLabel(String(entry.name ?? ''), names);
        nameLine.appendChild(nameNode);
        if (youId && String(entry.id) === String(youId)) nameLine.appendChild(el('span', 'vtt-init-you', '(tú)'));
        for (const status of entry.statuses ?? []) {
            const mark = el('i', `wm-init-status fa-solid ${String(status.icon || 'fa-circle-exclamation')}`);
            mark.title = String(status.label ?? '');
            nameLine.appendChild(mark);
        }
        if (entry.maxHp > 0) nameLine.appendChild(el('span', 'wm-init-hp-text', `${entry.hp}/${entry.maxHp}`));
        body.appendChild(nameLine);
        // J20.2: a toques, los estados escritos (el CSS solo los enseña donde no hay ratón).
        if ((entry.statuses ?? []).length > 0) {
            body.appendChild(el('div', 'wm-init-status-text', entry.statuses.map(s => String(s.label)).join(' · ')));
        }
        if (entry.maxHp > 0) {
            const bar = el('div', 'wm-init-hp');
            bar.setAttribute('role', 'meter');
            bar.setAttribute('aria-label', `Vida de ${entry.name}`);
            bar.setAttribute('aria-valuemin', '0');
            bar.setAttribute('aria-valuemax', String(entry.maxHp));
            bar.setAttribute('aria-valuenow', String(Math.max(0, entry.hp)));
            const fill = el('div', 'wm-init-hp-fill');
            fill.style.width = `${Math.max(0, Math.min(100, entry.hpPct))}%`;
            bar.appendChild(fill);
            body.appendChild(bar);
        }
        row.appendChild(body);

        // J7.3 y D-J32: quién le mueve, en su propia fila.
        const choice = byId.get(String(entry.id));
        if (choice) {
            row.appendChild(controlButton(choice, controlLabels, onControl));
            byId.delete(String(entry.id));
        }

        const pick = (/** @type {Event} */ event) => {
            if (/** @type {HTMLElement} */ (event.target).closest('.wm-combat-control-btn')) return;
            onPick(entry);
        };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            pick(event);
        });
        list.appendChild(row);
    }
    panel.appendChild(list);
    // Tanda 17: la fila de quien tiene el turno, a la vista dentro de la lista. En el teléfono la
    // lista es una fila de caras que se desliza, y con muchos la de ahora se quedaba fuera.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => revealCurrent(list));

    // Quien no tiene fila (todavía no ha entrado en la iniciativa) lleva su botón debajo.
    if (byId.size > 0) {
        const rest = el('div', 'vtt-init-controls');
        for (const choice of byId.values()) rest.appendChild(controlButton(choice, controlLabels, onControl));
        panel.appendChild(rest);
    }

    // Lo que hay que conseguir en esta pelea, si el tablero lo dice.
    const goals = Array.isArray(objectives) ? objectives : [];
    if (goals.length > 0) {
        const box = el('div', 'wm-objectives vtt-init-goals');
        box.appendChild(el('div', 'wm-objectives-title', goals.length === 1 ? 'Objetivo' : 'Objetivos'));
        for (const goal of goals) {
            const line = el('div', `wm-objective status-${String(goal.status || 'pending').replace(/[^a-z-]/gi, '')}`);
            const icon = el('i', `wm-objective-icon fa-solid ${goal.status === 'complete' ? 'fa-circle-check' : goal.status === 'failed' ? 'fa-circle-xmark' : 'fa-circle'}`);
            icon.setAttribute('aria-hidden', 'true');
            line.append(icon, el('span', 'wm-objective-label', goal.label));
            if (goal.optional) line.appendChild(el('span', 'wm-objective-optional', 'opcional'));
            box.appendChild(line);
        }
        panel.appendChild(box);
    }
    return panel;
}

/**
 * Tanda 17: desliza la lista (no la página) lo justo para que se vea la fila de quien tiene el turno.
 *
 * @param {HTMLElement} list
 */
export function revealCurrent(list) {
    const row = list?.isConnected ? list.querySelector('.wm-init-row.current') : null;
    if (!row) return;
    const box = list.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    if (at.left < box.left) list.scrollLeft -= box.left - at.left + 6;
    else if (at.right > box.right) list.scrollLeft += at.right - box.right + 6;
    if (at.top < box.top) list.scrollTop -= box.top - at.top + 4;
    else if (at.bottom > box.bottom) list.scrollTop += at.bottom - box.bottom + 4;
}

/**
 * El botón de quién mueve a uno: pasa de «Lo muevo yo» a «Que lo lleve el juego» y vuelta. Su
 * nombre va dentro, para los lectores de pantalla y para quien lo busque por él.
 *
 * @param {ControlChoice} choice
 * @param {Record<string, string>} labels
 * @param {(id: string, next: 'player'|'engine') => void} onControl
 * @returns {HTMLButtonElement}
 */
function controlButton(choice, labels, onControl) {
    const next = choice.control === 'player' ? 'engine' : 'player';
    const button = /** @type {HTMLButtonElement} */ (el('button', 'wm-combat-control-btn vtt-init-control'));
    button.type = 'button';
    button.dataset.controlId = String(choice.id);
    button.dataset.control = choice.control;
    const now = labels[choice.control] ?? choice.control;
    button.title = `Pulsa para cambiarlo a «${labels[next] ?? next}»`;
    const icon = el('i', `fa-solid ${choice.control === 'player' ? 'fa-hand-pointer' : 'fa-gears'}`);
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, el('span', 'vtt-sr', `${choice.summon ? 'Invocación ' : ''}${choice.name}: `), el('span', 'vtt-init-control-text', now));
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        onControl(String(choice.id), next);
    });
    return button;
}
