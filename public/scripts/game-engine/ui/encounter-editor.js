/**
 * The panel that says which enemies a board can field.
 *
 * Small on purpose: a row per creature, how few and how many. The wizard and the importer
 * already write these; this is the one place they can be changed without opening World
 * Info and editing a list of uids, which is the thing this project keeps promising
 * nobody will have to do.
 *
 * Draws and collects; every decision lives in `campaign/encounter-editor.js`.
 *
 * See wiki/ROADMAP.md, Fase B y Fase E · wiki/POR_HACER.md.
 */

import { toRows, fromRows, describeEncounters } from '../campaign/encounter-editor.js';

/**
 * Open the editor over a board's encounter rules.
 *
 * @param {Object} input
 * @param {string} input.boardName
 * @param {any[]} input.rules
 * @param {Record<string, string>} input.namesById
 * @param {Record<string, string>} input.idsByName
 * @param {string[]} input.available Every creature this world has.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any[]|null>} The rules to save, or null if cancelled.
 */
export async function openEncounterEditor({
    boardName, rules, namesById, idsByName, available, Popup, POPUP_TYPE,
}) {
    const root = $('<div class="ee-root"></div>');
    let rows = toRows(rules, namesById);

    root.append($('<div class="ee-head"></div>')
        .append($('<div class="ee-title"></div>')
            .append('<i class="fa-solid fa-skull"></i> ')
            .append(document.createTextNode(`Enemigos de "${boardName}"`)))
        .append($('<div class="ee-sub"></div>').text(
            'Lo que `/fight` puede sacar en este tablero. El número es cuántos aparecen.')));

    const list = $('<div class="ee-list"></div>');
    const problems = $('<div class="ee-problems"></div>').hide();
    const summary = $('<div class="ee-summary"></div>');

    const draw = () => {
        list.empty();
        summary.text(describeEncounters(rows));

        if (rows.length === 0) {
            list.append($('<div class="ee-empty"></div>').text(
                'Sin enemigos declarados: `/fight` no encontrará nada en este tablero.'));
        }

        rows.forEach((row, index) => {
            const card = $('<div class="ee-row"></div>');

            const select = $('<select class="text_pole ee-enemy"></select>');
            for (const name of available) {
                select.append($('<option></option>').attr('value', name).text(name));
            }
            // Un nombre que ya no existe en el mundo sigue viéndose, para poder quitarlo.
            if (!available.includes(row.name)) {
                select.append($('<option></option>').attr('value', row.name).text(`${row.name} (ya no existe)`));
            }
            select.val(row.name);
            select.on('change', () => { row.name = String(select.val()); draw(); });
            card.append(select);

            const min = $('<input type="number" class="text_pole ee-count" min="1">').val(row.minCount);
            const max = $('<input type="number" class="text_pole ee-count" min="1">').val(row.maxCount);
            min.on('input', () => { row.minCount = Number(min.val()) || 1; summary.text(describeEncounters(rows)); });
            max.on('input', () => { row.maxCount = Number(max.val()) || 1; summary.text(describeEncounters(rows)); });

            card.append($('<span class="ee-label"></span>').text('de'), min);
            card.append($('<span class="ee-label"></span>').text('a'), max);

            card.append($('<button class="menu_button ee-remove" type="button" title="Quitar"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .on('click', () => { rows.splice(index, 1); draw(); }));

            list.append(card);
        });
    };
    draw();

    const actions = $('<div class="ee-actions"></div>');
    actions.append($('<button class="menu_button" type="button"></button>')
        .append('<i class="fa-solid fa-plus"></i>')
        .append($('<span></span>').text(' Añadir enemigo'))
        .prop('disabled', available.length === 0)
        .on('click', () => {
            rows.push({ name: available[0] ?? '', minCount: 1, maxCount: 1 });
            draw();
        }));

    root.append(list, summary, actions, problems);

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Guardar enemigos',
        cancelButton: 'Cancelar',
        wide: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true;
            const { problems: found } = fromRows(rows, idsByName);
            if (found.length === 0) return true;

            problems.empty().show();
            for (const message of found) problems.append($('<div class="ee-problem"></div>').text(message));
            return false;
        },
    });

    const result = await popup.show();
    if (result !== 1) return null;

    return fromRows(rows, idsByName).rules;
}
