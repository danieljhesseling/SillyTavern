/**
 * Elegir el modo: tres con nombre y las seis letras sueltas (R1 del roadmap de profundidad).
 *
 * El mismo trozo sirve en tres sitios: la partida rápida, la pestaña de jugabilidad del
 * taller y la pausa, para cambiarlo a mitad de partida (DR2). Por eso se construye aparte y
 * cada sitio decide qué hace con lo elegido.
 *
 * Lo que se elige son los interruptores de siempre (`survival`); el modo se lee de ellos.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R1.
 */

import {
    MODES, CUSTOM, CUSTOM_LABEL, survivalFor, modeOf, letterRows, setLetter, describeMode,
} from '../rules/modes.js';
import { readSurvival } from '../rules/mortality.js';

/**
 * El selector, como un elemento. Llama a `onChange` con los interruptores nuevos cada vez
 * que se toca algo.
 *
 * @param {any} survival Lo de ahora.
 * @param {(survival: any) => void} onChange
 * @returns {HTMLElement}
 */
export function buildModePicker(survival, onChange) {
    let current = readSurvival(survival);

    const root = document.createElement('div');
    root.className = 'md-root';
    const cards = document.createElement('div');
    cards.className = 'md-cards';
    const letters = document.createElement('div');
    letters.className = 'md-letters';
    const said = document.createElement('div');
    said.className = 'md-said';
    root.append(cards, letters, said);

    const set = (/** @type {any} */ next) => {
        current = readSurvival(next);
        draw();
        onChange(current);
    };

    function draw() {
        const mode = modeOf(current);
        cards.replaceChildren();
        const entries = [...Object.entries(MODES).map(([id, m]) => ({ id, label: m.label, note: m.note })),
            { id: CUSTOM, label: CUSTOM_LABEL, note: 'Enciende y apaga las letras una a una.' }];
        for (const entry of entries) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'md-card';
            card.dataset.mode = entry.id;
            card.classList.toggle('md-picked', mode === entry.id);
            const title = document.createElement('div');
            title.className = 'md-card-title';
            title.textContent = entry.label;
            const note = document.createElement('div');
            note.className = 'md-card-note';
            note.textContent = entry.note;
            card.append(title, note);
            card.addEventListener('click', () => {
                if (entry.id === CUSTOM) {
                    letters.classList.add('md-open');
                    return;
                }
                set(survivalFor(/** @type {any} */ (MODES)[entry.id].letters));
            });
            cards.appendChild(card);
        }

        letters.replaceChildren();
        // Las letras se ven siempre en «A tu medida»; en un modo con nombre, plegadas.
        letters.classList.toggle('md-open', mode === CUSTOM || letters.classList.contains('md-open'));
        for (const row of letterRows(current)) {
            const label = document.createElement('label');
            label.className = 'md-letter';
            label.dataset.letter = row.id;
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = row.on;
            box.addEventListener('change', () => set(setLetter(current, row.id, box.checked)));
            const text = document.createElement('span');
            text.className = 'md-letter-text';
            const title = document.createElement('b');
            title.textContent = `${row.id}) ${row.title}`;
            text.append(title, document.createTextNode(` · ${row.note}`));
            if (row.needs) {
                const need = document.createElement('span');
                need.className = 'md-needs';
                need.textContent = ` Necesita «${row.needs}».`;
                text.appendChild(need);
            }
            label.append(box, text);
            letters.appendChild(label);
        }
        said.textContent = describeMode(current);
    }

    draw();
    return root;
}

/**
 * Abrir el selector en un cuadro y devolver lo elegido, o `null` si se cancela.
 *
 * @param {Object} input
 * @param {any} input.survival
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {string} [input.title]
 * @param {string} [input.hint]
 * @returns {Promise<any|null>}
 */
export async function openModePanel({ survival, Popup, POPUP_TYPE, title = 'El modo de juego', hint = '' }) {
    let chosen = readSurvival(survival);
    const root = document.createElement('div');
    root.className = 'md-panel';
    const head = document.createElement('h3');
    head.textContent = title;
    root.appendChild(head);
    if (hint) {
        const p = document.createElement('p');
        p.className = 'md-hint';
        p.textContent = hint;
        root.appendChild(p);
    }
    root.appendChild(buildModePicker(survival, next => { chosen = next; }));
    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', { okButton: 'Usar este modo', cancelButton: 'Cancelar', wide: true, allowVerticalScrolling: true });
    const answer = await popup.show();
    return answer ? chosen : null;
}
