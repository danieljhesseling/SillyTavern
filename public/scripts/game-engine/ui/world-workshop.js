/**
 * El taller del mundo, desde la pausa: verlo, tocar el hilo, añadir gente o sitios, e
 * ilustrarlo (ideas 175, 176, 185 y 183).
 *
 * Cuatro cosas de quien hace el mundo, juntas en un solo botón para no llenar la pausa:
 *
 * - **Ver el mundo** (175): sitios con sus caminos, facciones y el hilo por actos. Con
 *   clave de ilustraciones, cada sitio y cada persona tiene su botón de ilustrar.
 * - **Editar el hilo** (176): una columna por acto con sus hitos como tarjetas. Se
 *   arrastran de columna y se pulsan para cambiar título, pista y tras cuál se abren.
 * - **Añadir alguien o un sitio** (185).
 * - **Ilustraciones** (183): la clave de PixelLab, su dirección y el tamaño.
 *
 * Dibuja y recoge; lo que decide está en `campaign/world-preview.js`, `plot-graph.js`,
 * `director.js` e `illustrations.js`.
 */

import { columnsOf, moveMilestone, editMilestone } from '../campaign/plot-graph.js';
import { PLACE_TYPES } from '../campaign/director.js';

/**
 * El menú del taller. Devuelve lo elegido, o vacío.
 *
 * @param {{Popup: any, POPUP_TYPE: any}} deps
 * @returns {Promise<string>}
 */
export async function openWorkshopMenu({ Popup, POPUP_TYPE }) {
    const body = $('<div class="ww-root"></div>');
    body.append($('<h3></h3>').text('Taller del mundo'));
    const options = [
        ['preview', 'fa-map', 'Ver el mundo'],
        ['plot', 'fa-diagram-project', 'Editar el hilo'],
        ['director', 'fa-user-plus', 'Añadir alguien o un sitio'],
        ['art', 'fa-palette', 'Ilustraciones (PixelLab)'],
    ];
    let chosen = '';
    /** @type {any} */
    let popup = null;
    for (const [id, icon, label] of options) {
        const button = $('<button type="button" class="menu_button ww-option"></button>').attr('data-option', id)
            .append($('<i></i>').addClass(`fa-solid ${icon}`)).append($('<span></span>').text(` ${label}`));
        button.on('click', () => {
            chosen = id;
            void popup?.completeAffirmative();
        });
        body.append(button);
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar' });
    await popup.show();
    return chosen;
}

/**
 * Ver el mundo, con los botones de ilustrar si hay clave.
 *
 * @param {Object} input
 * @param {string[]} input.lines
 * @param {Array<{kind: 'place'|'person', name: string, image: string}>} input.subjects
 * @param {boolean} input.canIllustrate
 * @param {(kind: 'place'|'person', name: string) => Promise<boolean>} input.onIllustrate
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<void>}
 */
export async function openWorldPreview({ lines, subjects, canIllustrate, onIllustrate, Popup, POPUP_TYPE }) {
    const body = $('<div class="ww-root ww-preview"></div>');
    body.append($('<h3></h3>').text('El mundo'));
    for (const line of lines) body.append($('<div class="ww-line"></div>').text(line));
    if (subjects.length > 0) {
        body.append($('<h4></h4>').text('Caras y sitios'));
        for (const subject of subjects) {
            const row = $('<div class="ww-subject"></div>').attr('data-name', subject.name);
            if (subject.image) row.append($('<img class="ww-art" alt="">').attr('src', subject.image));
            row.append($('<span></span>').text(`${subject.kind === 'place' ? '📍' : '👤'} ${subject.name}`));
            if (canIllustrate && !subject.image) {
                const draw = $('<button type="button" class="menu_button ww-illustrate"></button>')
                    .attr('data-kind', subject.kind).attr('data-name', subject.name).text('Ilustrar (gasta créditos)');
                draw.on('click', async () => {
                    draw.prop('disabled', true).text('Pidiendo…');
                    const ok = await onIllustrate(subject.kind, subject.name);
                    draw.text(ok ? 'Hecho' : 'No se pudo');
                });
                row.append(draw);
            }
            body.append(row);
        }
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, allowVerticalScrolling: true }).show();
}

/**
 * El editor del hilo: una columna por acto, tarjetas que se arrastran y se editan.
 *
 * @param {{plot: any, onSave: (plot: any) => void, Popup: any, POPUP_TYPE: any}} input
 * @returns {Promise<boolean>} Si se guardó.
 */
export async function openPlotEditor({ plot, onSave, Popup, POPUP_TYPE }) {
    let draft = JSON.parse(JSON.stringify(plot ?? { milestones: [] }));
    const body = $('<div class="ww-root pe-root"></div>');
    const note = $('<div class="pe-note"></div>');
    const draw = () => {
        body.find('.pe-board').remove();
        const board = $('<div class="pe-board"></div>');
        for (const column of columnsOf(draft)) {
            const col = $('<div class="pe-col"></div>').attr('data-act', String(column.act));
            col.append($('<div class="pe-col-title"></div>').text(`Acto ${column.act}`));
            col.on('dragover', (event) => event.preventDefault());
            col.on('drop', (event) => {
                event.preventDefault();
                const id = String(/** @type {DragEvent} */ (event.originalEvent)?.dataTransfer?.getData('text/plain') ?? '');
                const moved = moveMilestone(draft, id, column.act);
                if (moved.ok) draft = moved.plot;
                note.text(moved.reason);
                draw();
            });
            for (const m of column.milestones) {
                const card = $('<div class="pe-card" draggable="true"></div>').attr('data-id', String(m.id));
                card.append($('<div class="pe-card-title"></div>').text(String(m.title ?? m.id)));
                if (m.opens?.kind === 'after') card.append($('<div class="pe-card-after"></div>').text(`tras «${m.opens.milestone}»`));
                card.on('dragstart', (event) => {
                    /** @type {DragEvent} */ (event.originalEvent)?.dataTransfer?.setData('text/plain', String(m.id));
                });
                card.on('click', () => {
                    const form = $('<div class="pe-form"></div>');
                    const title = $('<input type="text" class="text_pole pe-title">').val(String(m.title ?? ''));
                    const hint = $('<input type="text" class="text_pole pe-hint">').val(String(m.hint ?? ''));
                    const after = $('<select class="pe-after"></select>').append($('<option value=""></option>').text('Desde el principio'));
                    for (const other of draft.milestones) {
                        if (other.id !== m.id) after.append($('<option></option>').attr('value', String(other.id)).text(String(other.title ?? other.id)));
                    }
                    after.val(m.opens?.kind === 'after' ? String(m.opens.milestone) : '');
                    const apply = $('<button type="button" class="menu_button pe-apply"></button>').text('Aplicar');
                    apply.on('click', () => {
                        const edited = editMilestone(draft, String(m.id), { title: String(title.val() ?? ''), hint: String(hint.val() ?? ''), after: String(after.val() ?? '') });
                        if (edited.ok) draft = edited.plot;
                        note.text(edited.reason);
                        draw();
                    });
                    form.append($('<label></label>').text('Título ')).append(title)
                        .append($('<label></label>').text(' Pista ')).append(hint)
                        .append($('<label></label>').text(' Se abre ')).append(after).append(apply);
                    card.after(form);
                });
                col.append(card);
            }
            board.append(col);
        }
        body.append(board);
    };
    body.append($('<h3></h3>').text('El hilo'));
    body.append($('<div class="pe-hint"></div>').text('Arrastra un hito a otro acto; púlsalo para cambiar su título, su pista o tras cuál se abre.'));
    body.append(note);
    draw();
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Guardar', cancelButton: 'Dejarlo', wide: true, large: true, allowVerticalScrolling: true }).show();
    if (!ok) return false;
    onSave(draft);
    return true;
}

/**
 * El director: una persona o un sitio nuevos.
 *
 * @param {{places: string[], Popup: any, POPUP_TYPE: any}} input
 * @returns {Promise<{kind: 'person'|'place', data: any}|null>}
 */
export async function openDirector({ places, Popup, POPUP_TYPE }) {
    const body = $('<div class="ww-root dr-root"></div>');
    body.append($('<h3></h3>').text('Modo director'));
    const kind = $('<select class="dr-kind"></select>')
        .append($('<option value="person"></option>').text('Alguien'))
        .append($('<option value="place"></option>').text('Un sitio'));
    const name = $('<input type="text" class="text_pole dr-name" placeholder="Nombre">');
    const where = $('<select class="dr-where"></select>');
    for (const place of places) where.append($('<option></option>').attr('value', place).text(place));
    const trade = $('<input type="text" class="text_pole dr-trade" placeholder="Oficio (alguien) o descripción (sitio)">');
    const type = $('<select class="dr-type"></select>');
    for (const t of PLACE_TYPES) type.append($('<option></option>').attr('value', t).text(t));
    const days = $('<input type="number" class="text_pole dr-days" min="1" max="9" value="1">');
    body.append($('<div class="dr-row"></div>').append(kind).append(name));
    body.append($('<div class="dr-row"></div>').append($('<span></span>').text('Vive en / se une a: ')).append(where));
    body.append($('<div class="dr-row"></div>').append(trade));
    body.append($('<div class="dr-row"></div>').append($('<span></span>').text('Tipo de sitio: ')).append(type).append($('<span></span>').text(' Días: ')).append(days));
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Añadir', cancelButton: 'Dejarlo' }).show();
    if (!ok) return null;
    const isPlace = String(kind.val()) === 'place';
    return isPlace
        ? { kind: 'place', data: { name: String(name.val() ?? ''), type: String(type.val() ?? ''), linkTo: String(where.val() ?? ''), days: Number(days.val()) || 1, description: String(trade.val() ?? '') } }
        : { kind: 'person', data: { name: String(name.val() ?? ''), where: String(where.val() ?? ''), trade: String(trade.val() ?? '') } };
}

/**
 * Los ajustes de ilustraciones.
 *
 * @param {{settings: {key: string, endpoint: string, size: number}, Popup: any, POPUP_TYPE: any}} input
 * @returns {Promise<{key: string, endpoint: string, size: number}|null>}
 */
export async function openArtSettings({ settings, Popup, POPUP_TYPE }) {
    const body = $('<div class="ww-root art-root"></div>');
    body.append($('<h3></h3>').text('Ilustraciones con PixelLab'));
    body.append($('<p></p>').text('Opcional. Cada ilustración gasta créditos de tu cuenta de PixelLab, y se pide solo al pulsar su botón en «Ver el mundo». La clave se guarda en este navegador.'));
    const key = $('<input type="password" class="text_pole art-key" placeholder="Clave de PixelLab">').val(settings.key);
    const endpoint = $('<input type="text" class="text_pole art-endpoint">').val(settings.endpoint);
    const size = $('<select class="art-size"></select>');
    for (const s of [64, 128, 256]) size.append($('<option></option>').attr('value', String(s)).text(`${s} px`));
    size.val(String(settings.size));
    body.append(key).append($('<div class="dr-row"></div>').append($('<span></span>').text('Dirección: ')).append(endpoint)).append(size);
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Guardar', cancelButton: 'Dejarlo' }).show();
    if (!ok) return null;
    return { key: String(key.val() ?? ''), endpoint: String(endpoint.val() ?? ''), size: Number(size.val()) || 128 };
}
