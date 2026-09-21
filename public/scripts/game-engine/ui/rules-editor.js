/**
 * The rules editor: change what the game is made of without editing JavaScript.
 *
 * This is the point of the Fase C extraction. The 25 tables that used to be constants in
 * dnd-system.js are data now, and this is where a person edits them: add a damage type,
 * a weapon property, a condition, and the sheets and the combat pick it up.
 *
 * Every kind of section is drawn as the same table, because the model above flattens them
 * into rows. What this file owns is the DOM, the saving and the one honest inconvenience:
 * dnd-system.js binds its tables at load, so changes apply after a reload.
 *
 * See wiki/ROADMAP.md, Fase C (C3).
 */

import {
    listSections, getSection, setSection, toRows, fromRows, defaultSection, isSectionModified,
} from '../rules/editor-model.js';
import { resolveRuleset, toPortablePack } from '../rules/ruleset.js';

/**
 * Opens the editor over a pack and resolves with the edited one, or null if cancelled.
 *
 * The pack is never written here: the caller owns where rules live (the world info of the
 * open campaign), so this stays usable from anywhere that has a pack.
 *
 * @param {Object} input
 * @param {any} input.pack           The pack to edit. Null or empty starts from the defaults.
 * @param {string} [input.title]
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any|null>}
 */
export async function openRulesEditor({ pack, title = 'Reglas de la campaña', Popup, POPUP_TYPE }) {
    /**
      * The pack being edited. Replaced wholesale on every change, never mutated.
      *
      * Given its identity here rather than on save: a pack without an id and a name does
      * not validate, and the first version filled those in after the dialog closed — so
      * the check on closing always failed and the dialog could not be closed at all.
      */
    let draft = {
        id: 'campaign-rules',
        name: title,
        version: 1,
        ...structuredClone(pack ?? {}),
    };

    const sections = listSections();
    let current = sections[0];

    const root = $('<div class="rx-root"></div>');
    root.append(`
        <div class="rx-head">
            <div class="rx-title"><i class="fa-solid fa-scroll"></i> ${title}</div>
            <div class="rx-sub">Lo que cambies aquí vale para esta campaña. Se aplica al recargar.</div>
        </div>
    `);

    const body = $('<div class="rx-body"></div>');
    const nav = $('<div class="rx-nav"></div>');
    const panel = $('<div class="rx-panel"></div>');
    body.append(nav, panel);
    root.append(body);

    const footer = $('<div class="rx-footer"></div>');
    const status = $('<div class="rx-status"></div>');
    footer.append(status);
    root.append(footer);

    /** Marks in the side list which sections differ from the built-in rules. */
    const refreshNav = () => {
        nav.find('.rx-nav-item').each(function () {
            const path = String($(this).data('path'));
            $(this).toggleClass('modified', isSectionModified(draft, path));
        });
    };

    for (const section of sections) {
        const item = $('<div class="rx-nav-item"></div>')
            .attr('data-path', section.path)
            .text(section.label)
            .on('click', () => {
                current = section;
                nav.find('.rx-nav-item').removeClass('active');
                item.addClass('active');
                drawSection();
            });
        nav.append(item);
    }
    nav.find('.rx-nav-item').first().addClass('active');

    /** The rows currently on screen, which is what gets read back on save. */
    let liveRows = [];
    let liveRaw = '';

    /** Draws the selected section as a table, or as JSON when it has no table form. */
    function drawSection() {
        panel.empty();
        const value = getSection(draft, current.path) ?? defaultSection(current.path);
        const { rows, columns, editable, raw } = toRows(value, current.kind);
        liveRows = rows.map(r => ({ ...r }));
        liveRaw = raw;

        panel.append($('<div class="rx-section-title"></div>').text(current.label));

        if (!editable) {
            panel.append($('<div class="rx-hint"></div>')
                .text('Esta sección tiene estructura propia, así que se edita como JSON.'));
            const area = $('<textarea class="text_pole rx-json" rows="16" spellcheck="false"></textarea>').val(raw);
            area.on('input', () => { liveRaw = String(area.val() || ''); });
            panel.append(area);
            appendSectionActions();
            return;
        }

        const table = $('<div class="rx-table"></div>');
        const header = $('<div class="rx-row rx-row-head"></div>');
        for (const column of columns) header.append($('<div class="rx-cell"></div>').text(column));
        header.append('<div class="rx-cell rx-cell-actions"></div>');
        table.append(header);

        /** @param {any} row @param {number} index */
        const addRow = (row, index) => {
            const line = $('<div class="rx-row"></div>');
            const fields = ['a', 'b', 'c'].slice(0, columns.length);

            for (const field of fields) {
                const input = $('<input type="text" class="text_pole rx-input">').val(row[field] ?? '');
                if (row.blank && field === 'a') {
                    input.attr('placeholder', '(opción vacía)');
                }
                input.on('input', () => { liveRows[index][field] = String(input.val() || ''); });
                line.append($('<div class="rx-cell"></div>').append(input));
            }

            const remove = $('<button class="menu_button rx-del" title="Quitar"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .on('click', () => {
                    liveRows.splice(index, 1);
                    redrawRows();
                });
            line.append($('<div class="rx-cell rx-cell-actions"></div>').append(remove));
            table.append(line);
        };

        const redrawRows = () => {
            table.find('.rx-row').not('.rx-row-head').remove();
            liveRows.forEach((row, index) => addRow(row, index));
        };

        liveRows.forEach((row, index) => addRow(row, index));
        panel.append(table);

        const add = $('<button class="menu_button rx-add"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir'))
            .on('click', () => {
                liveRows.push({ a: '', b: '', c: '' });
                redrawRows();
            });
        panel.append(add);
        appendSectionActions();
    }

    /** Apply and restore, which belong to the section rather than to the whole pack. */
    function appendSectionActions() {
        const actions = $('<div class="rx-actions"></div>');

        actions.append($('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-check"></i>')
            .append($('<span></span>').text(' Aplicar sección'))
            .on('click', () => {
                const { value, errors } = fromRows(liveRows, current.kind, liveRaw);
                if (errors.length > 0) {
                    status.empty();
                    for (const message of errors) {
                        status.append($('<div class="rx-error"></div>').text(message));
                    }
                    return;
                }
                draft = setSection(draft, current.path, value);
                status.html('').append($('<div class="rx-ok"></div>')
                    .text(`"${current.label}" actualizado. Pulsa Guardar para conservarlo.`));
                refreshNav();
            }));

        actions.append($('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-rotate-left"></i>')
            .append($('<span></span>').text(' Restablecer sección'))
            .on('click', () => {
                draft = setSection(draft, current.path, defaultSection(current.path));
                drawSection();
                refreshNav();
                status.html('').append($('<div class="rx-ok"></div>')
                    .text(`"${current.label}" vuelve a las reglas por defecto.`));
            }));

        panel.append(actions);
    }

    // ---- import and export (C5) -------------------------------------------
    // The pack is a file you can share. Exporting writes only what differs from the
    // built-in rules, so a shared file says what it changes instead of restating D&D.
    const tools = $('<div class="rx-tools"></div>');

    tools.append($('<button class="menu_button"></button>')
        .append('<i class="fa-solid fa-file-export"></i>')
        .append($('<span></span>').text(' Exportar'))
        .on('click', () => {
            const { ruleset } = resolveRuleset(draft);
            const portable = toPortablePack(ruleset);
            const blob = new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(portable.id || 'reglas')}.json`;
            link.click();
            URL.revokeObjectURL(url);
        }));

    const fileInput = $('<input type="file" accept="application/json" style="display:none">');
    tools.append(fileInput);
    tools.append($('<button class="menu_button"></button>')
        .append('<i class="fa-solid fa-file-import"></i>')
        .append($('<span></span>').text(' Importar'))
        .on('click', () => fileInput.trigger('click')));

    fileInput.on('change', async function () {
        const file = /** @type {HTMLInputElement} */ (this).files?.[0];
        if (!file) return;
        try {
            const imported = JSON.parse(await file.text());
            const { errors, usedDefault } = resolveRuleset(imported);
            if (usedDefault) {
                status.html('');
                status.append($('<div class="rx-error"></div>')
                    .text('El archivo no es un paquete de reglas válido.'));
                for (const message of errors.slice(0, 5)) {
                    status.append($('<div class="rx-error"></div>').text(message));
                }
                return;
            }
            draft = imported;
            drawSection();
            refreshNav();
            status.html('').append($('<div class="rx-ok"></div>').text('Paquete importado. Pulsa Guardar para conservarlo.'));
        } catch (error) {
            status.html('').append($('<div class="rx-error"></div>')
                .text(`No se pudo leer el archivo: ${error?.message || error}`));
        } finally {
            fileInput.val('');
        }
    });

    footer.prepend(tools);

    drawSection();
    refreshNav();

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Guardar reglas',
        cancelButton: 'Cancelar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true;

            // Whatever is on screen counts as applied: pressing Save with an edit typed
            // and the section button unpressed should not silently drop it.
            const { value, errors } = fromRows(liveRows, current.kind, liveRaw);
            if (errors.length > 0) {
                status.empty();
                for (const message of errors) {
                    status.append($('<div class="rx-error"></div>').text(message));
                }
                return false;
            }
            draft = setSection(draft, current.path, value);

            const { errors: packErrors, usedDefault } = resolveRuleset(draft);
            if (usedDefault) {
                status.empty();
                status.append($('<div class="rx-error"></div>')
                    .text('El paquete no es válido, así que no se guarda:'));
                for (const message of packErrors.slice(0, 5)) {
                    status.append($('<div class="rx-error"></div>').text(message));
                }
                return false;
            }
            return true;
        },
    });

    const result = await popup.show();
    return result === 1 ? draft : null;
}
