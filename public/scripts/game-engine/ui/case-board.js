/**
 * El tablero del caso: lo que se sabe, los sospechosos y acusar (U8 del pegamento; la F3 de
 * «Casos con verdad» en wiki/archivo/PROPUESTAS_BUCLE_DE_JUEGO.md).
 *
 * Una pantalla de texto, sin arte: los hechos encontrados, cada sospechoso con lo que apunta a
 * él, y un formulario para acusar —quién, por qué y cómo—. Equivocarse cuenta: por eso se
 * acusa una vez.
 *
 * Solo dibuja. Qué pasa al acusar lo decide quien llama.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U8.
 */

import { suspectsBoard, HOW } from '../campaign/cases.js';

/**
 * El tablero, listo para meter en un cuadro.
 *
 * @param {Object} input
 * @param {import('../campaign/cases.js').CaseState} input.state
 * @param {(accusation: {culprit: string, motive: string, method: string}) => void} input.onAccuse
 * @returns {HTMLElement}
 */
export function buildCaseBoard({ state, onAccuse }) {
    const root = document.createElement('div');
    root.className = 'cb-root';
    const add = (/** @type {string} */ tag, /** @type {string} */ cls, /** @type {string} */ text) => {
        const node = document.createElement(tag);
        node.className = cls;
        node.textContent = text;
        root.appendChild(node);
        return node;
    };
    const mystery = state.active;
    if (!mystery) {
        add('h3', 'cb-title', 'El caso');
        add('p', 'cb-empty', 'No hay ningún caso abierto.');
        return root;
    }
    add('h3', 'cb-title', mystery.title);
    add('p', 'cb-where', `En ${mystery.place}, el día ${mystery.day}.`);

    add('div', 'cb-section', 'Lo que sabéis');
    const found = mystery.clues.filter(c => state.found.includes(c.id));
    if (found.length === 0) add('div', 'cb-fact', 'Nada todavía. Preguntad a la gente del sitio y buscad donde pasó.');
    for (const clue of found) add('div', 'cb-fact', clue.fact);

    add('div', 'cb-section', 'Dónde queda por buscar');
    const left = mystery.clues.filter(c => !state.found.includes(c.id));
    const places = [...new Set(left.map(c => `${HOW[c.how].label} ${c.source.name}`))];
    for (const where of places.slice(0, 6)) add('div', 'cb-lead', where);
    if (places.length === 0) add('div', 'cb-lead', 'Ya lo habéis encontrado todo.');

    add('div', 'cb-section', 'Los sospechosos');
    for (const suspect of suspectsBoard(state)) {
        add('div', 'cb-suspect', suspect.name);
        for (const fact of suspect.facts) add('div', 'cb-suspect-fact', `· ${fact}`);
    }

    add('div', 'cb-section', 'Acusar (una vez: equivocarse cuenta)');
    const form = document.createElement('div');
    form.className = 'cb-accuse';
    const select = (/** @type {string} */ cls, /** @type {string} */ label, /** @type {string[]} */ options) => {
        const wrap = document.createElement('label');
        wrap.className = 'cb-field';
        wrap.textContent = `${label} `;
        const node = document.createElement('select');
        node.className = `text_pole ${cls}`;
        for (const value of options) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            node.appendChild(option);
        }
        wrap.appendChild(node);
        form.appendChild(wrap);
        return node;
    };
    const who = select('cb-culprit', 'Quién:', mystery.suspects);
    const why = select('cb-motive', 'Por qué:', mystery.motives);
    const how = select('cb-method', 'Cómo:', mystery.methods);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button cb-go';
    button.textContent = 'Acusar';
    button.addEventListener('click', () => onAccuse({ culprit: who.value, motive: why.value, method: how.value }));
    form.appendChild(button);
    root.appendChild(form);
    return root;
}
