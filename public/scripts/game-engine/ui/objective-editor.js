/**
 * The panel that lets a board be *about* something, without opening World Info.
 *
 * Until now a mission was written field by field in a Lorebook entry, or it came inside
 * an imported book. Neither helps somebody who already has a board. This shows the
 * objectives as rows, asks each one for exactly the fields its type needs, and can ask a
 * model to draft them — against the same schema the engine judges by, so a generated
 * mission is editable rather than magic.
 *
 * Draws and collects; every decision lives in `campaign/objective-editor.js`.
 *
 * See wiki/ROADMAP.md, Fase E · Fase F · wiki/POR_HACER.md.
 */

import {
    toRows, fromRows, fieldsFor, objectiveTypeOptions, generateObjectives,
} from '../campaign/objective-editor.js';

/**
 * @param {import('../campaign/objective-editor.js').ObjectiveRow} row
 * @param {() => void} onChange
 * @param {() => void} onRemove
 * @returns {JQuery}
 */
function renderRow(row, onChange, onRemove) {
    const card = $('<div class="oe-row"></div>');

    const head = $('<div class="oe-row-head"></div>');
    const typeSelect = $('<select class="text_pole oe-type"></select>');
    for (const option of objectiveTypeOptions()) {
        typeSelect.append($('<option></option>').attr('value', option.id).attr('title', option.description).text(option.label));
    }
    typeSelect.val(row.type);
    typeSelect.on('change', () => {
        row.type = String(typeSelect.val());
        // The fields belong to the type, so changing it starts them clean rather than
        // carrying a target into an objective that has no targets.
        row.values = {};
        onChange();
    });
    head.append(typeSelect);

    const label = $('<input type="text" class="text_pole oe-label" maxlength="80">').val(row.label);
    label.on('input', () => { row.label = String(label.val() ?? ''); });
    head.append(label);

    const optional = $('<label class="oe-optional"></label>');
    const box = $('<input type="checkbox">').prop('checked', row.optional);
    box.on('change', () => { row.optional = Boolean(box.prop('checked')); });
    optional.append(box).append($('<span></span>').text('Opcional'));
    head.append(optional);

    const remove = $('<button class="menu_button oe-remove" type="button" title="Quitar"></button>')
        .append('<i class="fa-solid fa-trash"></i>')
        .on('click', () => onRemove());
    head.append(remove);
    card.append(head);

    const fields = fieldsFor(row.type);
    if (fields.length === 0) {
        card.append($('<div class="oe-hint"></div>').text('Este objetivo no necesita nada más.'));
    }

    for (const field of fields) {
        const wrap = $('<label class="oe-field"></label>');
        wrap.append($('<span class="oe-field-name"></span>').text(field.writes));

        if (field.kind === 'cell') {
            const cell = row.values[field.writes] ?? { x: 0, y: 0 };
            row.values[field.writes] = cell;
            const x = $('<input type="number" class="text_pole oe-cell" min="0">').val(cell.x);
            const y = $('<input type="number" class="text_pole oe-cell" min="0">').val(cell.y);
            x.on('input', () => { cell.x = Number(x.val()) || 0; });
            y.on('input', () => { cell.y = Number(y.val()) || 0; });
            wrap.append(x).append($('<span class="oe-sep"></span>').text('·')).append(y);
        } else {
            const input = $('<input type="text" class="text_pole">')
                .attr('type', field.kind === 'number' ? 'number' : 'text')
                .val(row.values[field.writes] ?? '');
            input.on('input', () => { row.values[field.writes] = String(input.val() ?? ''); });
            wrap.append(input);
        }

        wrap.append($('<span class="oe-help"></span>').text(field.help));
        card.append(wrap);
    }

    return card;
}

/**
 * Open the editor over a board's objectives.
 *
 * Nothing is written here: what the player leaves is handed back, already translated into
 * what the engine judges, and the caller decides where it goes. A mission that names
 * somebody who does not exist refuses to close, because saving it would make a mission
 * that can never be completed.
 *
 * @param {Object} input
 * @param {string} input.boardName
 * @param {any[]} input.objectives What the board has now.
 * @param {Record<string, string>} input.namesById
 * @param {Record<string, string>} input.idsByName
 * @param {string[]} [input.enemies] Names on this board, for the generator.
 * @param {string[]} [input.allies]
 * @param {number} [input.width]
 * @param {number} [input.height]
 * @param {((params: any) => Promise<any>)|null} [input.generate] Null when no provider.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any[]|null>} The objectives to save, or null if cancelled.
 */
export async function openObjectiveEditor({
    boardName, objectives, namesById, idsByName,
    enemies = [], allies = [], width = 0, height = 0, generate = null, Popup, POPUP_TYPE,
}) {
    const root = $('<div class="oe-root"></div>');
    let rows = toRows(objectives, namesById);

    root.append(`
        <div class="oe-head">
            <div class="oe-title"><i class="fa-solid fa-list-check"></i> Objetivos de "${$('<div></div>').text(boardName).html()}"</div>
            <div class="oe-sub">Lo que decide si este combate se gana. Sin objetivos, gana quien limpie el tablero.</div>
        </div>
    `);

    const list = $('<div class="oe-list"></div>');
    const problems = $('<div class="oe-problems"></div>').hide();

    const draw = () => {
        list.empty();
        if (rows.length === 0) {
            list.append($('<div class="oe-empty"></div>').text('Sin objetivos. Gana quien deje el tablero vacío.'));
        }
        rows.forEach((row, index) => {
            list.append(renderRow(row, draw, () => { rows.splice(index, 1); draw(); }));
        });
    };
    draw();

    const actions = $('<div class="oe-actions"></div>');
    actions.append($('<button class="menu_button" type="button"></button>')
        .append('<i class="fa-solid fa-plus"></i>')
        .append($('<span></span>').text(' Añadir objetivo'))
        .on('click', () => {
            rows.push({ id: `obj_${rows.length + 1}`, type: 'eliminate_all', label: 'Nuevo objetivo', optional: false, values: {} });
            draw();
        }));

    if (typeof generate === 'function') {
        const idea = $('<input type="text" class="text_pole oe-idea" maxlength="200" placeholder="Una idea, opcional: «que no muera el molinero»">');
        const ai = $('<button class="menu_button" type="button"></button>')
            .append('<i class="fa-solid fa-wand-magic-sparkles"></i>')
            .append($('<span></span>').text(' Proponer con IA'));

        ai.on('click', async () => {
            ai.prop('disabled', true);
            problems.empty().show().append($('<div class="oe-working"></div>').text('Pensando…'));
            const result = await generateObjectives({
                generate, boardName, enemies, allies, width, height, idea: String(idea.val() ?? ''),
            });
            ai.prop('disabled', false);
            problems.empty();

            for (const message of [...result.errors, ...result.warnings]) {
                problems.append($('<div class="oe-problem"></div>').text(message));
            }
            if (result.errors.length === 0 && result.warnings.length === 0) problems.hide();

            if (result.rows.length > 0) {
                // Propuestas, no decisiones: reemplazan lo que hubiera y se pueden editar
                // o borrar antes de guardar.
                rows = result.rows;
                draw();
            }
        });

        actions.append(idea, ai);
    }

    root.append(list, actions, problems);

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Guardar objetivos',
        cancelButton: 'Cancelar',
        wide: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true;
            const { problems: found } = fromRows(rows, idsByName);
            if (found.length === 0) return true;

            problems.empty().show();
            for (const message of found) problems.append($('<div class="oe-problem"></div>').text(message));
            return false;
        },
    });

    const result = await popup.show();
    if (result !== 1) return null;

    return fromRows(rows, idsByName).objectives;
}
