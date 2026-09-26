/**
 * El panel del estado: lo que el juego da por cierto (U2 del pegamento; era la P5).
 *
 * `/prompt` enseña lo que se manda al modelo. Esto enseña lo otro: lo que el motor cree que
 * es verdad ahora mismo, clave a clave, con qué es cada cosa y cuánto hay. Sale del registro
 * del estado, así que una clave nueva aparece aquí sola en cuanto se registra.
 *
 * Solo lee. No cambia nada.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U2.
 */

import { describeState } from '../campaign/state-registry.js';

/**
 * El panel, como un elemento listo para meter en un cuadro.
 *
 * @param {Record<string, any>} metadata
 * @returns {HTMLElement}
 */
export function buildStatePanel(metadata) {
    const root = document.createElement('div');
    root.className = 'sp-root';
    const title = document.createElement('h3');
    title.textContent = 'Lo que el juego da por cierto';
    root.appendChild(title);
    const intro = document.createElement('p');
    intro.className = 'sp-intro';
    intro.textContent = 'Cada cosa que la partida guarda, con cuánto hay. Lo de arriba vuelve con un punto de retorno; tus ajustes, no.';
    root.appendChild(intro);

    for (const section of describeState(metadata)) {
        const details = document.createElement('details');
        details.className = `sp-section sp-${section.kind}`;
        details.open = section.kind === 'juego';
        const summary = document.createElement('summary');
        const used = section.rows.filter(row => row.size !== '—').length;
        summary.textContent = `${section.title} · ${used} de ${section.rows.length}`;
        details.appendChild(summary);
        const table = document.createElement('table');
        table.className = 'sp-table';
        for (const row of section.rows) {
            const tr = document.createElement('tr');
            tr.dataset.key = row.key;
            for (const text of [row.what, row.size]) {
                const td = document.createElement('td');
                td.textContent = text;
                tr.appendChild(td);
            }
            tr.title = row.key;
            table.appendChild(tr);
        }
        details.appendChild(table);
        root.appendChild(details);
    }
    return root;
}

/**
 * Abrir el panel en un cuadro.
 *
 * @param {Object} input
 * @param {Record<string, any>} input.metadata
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<void>}
 */
export async function openStatePanel({ metadata, Popup, POPUP_TYPE }) {
    await new Popup(buildStatePanel(metadata), POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, allowVerticalScrolling: true }).show();
}
