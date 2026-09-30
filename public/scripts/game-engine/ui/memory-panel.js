/**
 * Lo que se recuerda de vosotros, en su ventana (J11.3 y J11.4 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Dos partes, una encima de otra:
 *
 * - **En este pueblo**: lo que la gente de aquí recuerda de lo que hicisteis (`world-marks.js`):
 *   dónde os cobran más, dónde no os atienden, y cuánto falta para que se olvide.
 * - **En el gremio**: las campañas terminadas y cómo acabó cada una (`guild-memory.js`), con
 *   cómo os conocen desde entonces. Arriba, el nombre que más se oye.
 *
 * Se abre sola, sin `party.js`: un `<dialog>` modal encima de lo que haya. Lo propio va en
 * decisiones.css.
 */

import { describeMarks } from '../campaign/world-marks.js';
import { describeGuildMemory, guildMemoryOf, guildTitle } from '../campaign/guild-memory.js';

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
 * @typedef {Object} MemoryPanelModel
 * @property {string} title Cómo os conocen, o vacío.
 * @property {string} town
 * @property {ReturnType<typeof describeMarks>} here Lo de este pueblo.
 * @property {ReturnType<typeof describeGuildMemory>} guild Lo del gremio, lo último arriba.
 * @property {boolean} empty Si no hay nada que contar.
 */

/**
 * Lo que se enseña, sin pintar nada: para la ventana y para las pruebas.
 *
 * @param {Object} input
 * @param {string} [input.town] El pueblo donde estáis.
 * @param {any} [input.marks] Las huellas (`WORLD_MARKS_KEY`).
 * @param {any} [input.rows] Las filas de `ecos.json`.
 * @param {number} [input.today]
 * @param {any} [input.memory] Lo que recuerda el gremio (`GUILD_MEMORY_KEY`).
 * @param {any} [input.hub] El gremio, para las campañas de antes de J11.4.
 * @returns {MemoryPanelModel}
 */
export function memoryPanelModel({ town = '', marks = [], rows = [], today = 1, memory = null, hub = null }) {
    const known = guildMemoryOf({ memory, hub });
    const here = text(town) ? describeMarks({ marks, rows, town, today }) : [];
    const guild = describeGuildMemory(known);
    return { title: guildTitle(known), town: text(town), here, guild, empty: here.length === 0 && guild.length === 0 };
}

/** El icono de cada tono del gremio. */
const TONE_ICONS = { luz: 'fa-sun', sombra: 'fa-skull', gris: 'fa-scale-balanced' };

/**
 * Abrir la ventana de lo que se recuerda.
 *
 * @param {Object} input Lo de `memoryPanelModel`.
 * @param {string} [input.town]
 * @param {any} [input.marks]
 * @param {any} [input.rows]
 * @param {number} [input.today]
 * @param {any} [input.memory]
 * @param {any} [input.hub]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<void>}
 */
export function openMemoryPanel({ mount = null, ...input }) {
    const model = memoryPanelModel(input);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'mm-dialog'));
    dialog.setAttribute('aria-label', 'Lo que se recuerda de vosotros');
    const box = el('div', 'mm-box');
    const head = el('div', 'mm-head');
    head.appendChild(el('i', 'fa-solid fa-book-skull'));
    head.appendChild(document.createTextNode(' Lo que se recuerda de vosotros'));
    box.appendChild(head);
    if (model.title) {
        const known = el('p', 'mm-title');
        known.appendChild(document.createTextNode('Os conocen como '));
        known.appendChild(el('strong', '', model.title));
        known.appendChild(document.createTextNode('.'));
        box.appendChild(known);
    }

    if (model.town) {
        const section = el('section', 'mm-section mm-here');
        section.appendChild(el('h4', 'mm-subtitle', `En ${model.town}`));
        if (model.here.length === 0) section.appendChild(el('p', 'mm-empty', 'Aquí nadie os guarda nada, ni bueno ni malo.'));
        for (const line of model.here) {
            const row = el('p', `mm-row mm-${line.tone}`);
            row.dataset.echo = line.id;
            row.appendChild(el('i', `fa-solid ${line.tone === 'bien' ? 'fa-hand-holding-heart' : /no os atienden/.test(line.text) ? 'fa-ban' : 'fa-coins'}`));
            row.appendChild(document.createTextNode(` ${line.text}`));
            section.appendChild(row);
        }
        box.appendChild(section);
    }

    const guild = el('section', 'mm-section mm-guild');
    guild.appendChild(el('h4', 'mm-subtitle', 'En el gremio'));
    if (model.guild.length === 0) guild.appendChild(el('p', 'mm-empty', 'Todavía no habéis terminado ninguna campaña. Lo que hagáis en ellas, el gremio lo recordará.'));
    for (const entry of model.guild) {
        const row = el('div', `mm-campaign mm-tone-${entry.tone}`);
        row.dataset.campaign = entry.id;
        const name = el('div', 'mm-campaign-name');
        name.appendChild(el('i', `fa-solid ${TONE_ICONS[entry.tone] ?? TONE_ICONS.gris}`));
        name.appendChild(document.createTextNode(` ${entry.name}`));
        row.appendChild(name);
        row.appendChild(el('div', 'mm-campaign-line', entry.line));
        guild.appendChild(row);
    }
    box.appendChild(guild);

    const close = /** @type {HTMLButtonElement} */ (el('button', 'mm-close', 'Cerrar'));
    close.type = 'button';
    box.appendChild(close);
    dialog.appendChild(box);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();
    close.focus();
    return new Promise(resolve => {
        const done = () => {
            dialog.close();
            dialog.remove();
            resolve();
        };
        close.addEventListener('click', done);
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            done();
        });
        dialog.addEventListener('keydown', (event) => event.stopPropagation());
    });
}
