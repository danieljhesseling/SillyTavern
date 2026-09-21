/**
 * The dialog that hands you the contract for your Gem.
 *
 * A panel rather than a file download, because where this text is going is a text box in
 * somebody else's web app. Copying is the operation, so copying is the button.
 *
 * See wiki/ROADMAP_INGESTA_CAMPANAS_LIBROS.md (G1).
 */

import {
    buildGemInstructions, buildCampaignPackSchema, buildExamplePack,
    getSectionSchema, getPackRules, SECTION_ORDER, CAMPAIGN_PACK_VERSION,
} from '../campaign/campaign-pack-schema.js';

/**
 * @param {{Popup: any, POPUP_TYPE: any}} deps
 */
export async function openCampaignSchema({ Popup, POPUP_TYPE }) {
    const root = $('<div class="cs-root"></div>');

    root.append(`
        <div class="cs-head">
            <div class="cs-title"><i class="fa-solid fa-file-contract"></i> Contrato del paquete de campaña</div>
            <div class="cs-sub">Versión ${CAMPAIGN_PACK_VERSION} · generado desde el motor, no escrito a mano</div>
        </div>
    `);

    root.append($('<div class="cs-note"></div>').text(
        'Pega esto en las instrucciones de tu Gem. Se genera desde el mismo código que '
        + 'después valida lo que devuelva, así que si el motor cambia, esto cambia con él: '
        + 'una copia guardada aparte se queda vieja sin avisar.',
    ));

    /** One tab per thing you might want to copy. */
    const views = {
        'Instrucciones': () => buildGemInstructions(),
        'Solo el esquema': () => JSON.stringify(buildCampaignPackSchema(), null, 2),
        'Ejemplo de salida': () => JSON.stringify(buildExamplePack(), null, 2),
        ...Object.fromEntries(SECTION_ORDER.map(section => [
            `Sección: ${section}`,
            () => JSON.stringify(getSectionSchema(section), null, 2),
        ])),
    };

    const tabs = $('<div class="cs-tabs"></div>');
    const area = $('<textarea class="text_pole cs-text" rows="18" spellcheck="false" readonly></textarea>');

    let current = 'Instrucciones';
    const draw = () => {
        area.val(views[current]());
        tabs.find('.cs-tab').each(function () {
            $(this).toggleClass('active', $(this).text() === current);
        });
    };

    for (const name of Object.keys(views)) {
        tabs.append($('<span class="cs-tab"></span>').text(name).on('click', () => {
            current = name;
            draw();
        }));
    }

    root.append(tabs, area);

    const actions = $('<div class="cs-actions"></div>');
    actions.append(
        $('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-copy"></i>')
            .append($('<span></span>').text(' Copiar'))
            .on('click', async () => {
                try {
                    await navigator.clipboard.writeText(String(area.val() || ''));
                    toastr.success('Copiado al portapapeles.');
                } catch {
                    // Clipboard access can be refused; selecting the text still works.
                    area.trigger('select');
                    toastr.info('Selecciona y copia con Ctrl+C.');
                }
            }),
    );
    actions.append(
        $('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-download"></i>')
            .append($('<span></span>').text(' Descargar'))
            .on('click', () => {
                const isJson = current !== 'Instrucciones';
                const blob = new Blob([String(area.val() || '')], {
                    type: isJson ? 'application/json' : 'text/markdown',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = isJson ? 'campaign-pack-schema.json' : 'gem-instructions.md';
                link.click();
                URL.revokeObjectURL(url);
            }),
    );
    root.append(actions);

    // The cross-reference rules, said out loud: a JSON Schema cannot express them, and
    // they are where a generated pack really fails.
    const rules = $('<details class="cs-rules"></details>');
    rules.append($('<summary></summary>').text('Lo que el esquema no puede comprobar'));
    const list = $('<ul></ul>');
    for (const rule of getPackRules()) list.append($('<li></li>').text(rule));
    rules.append(list);
    root.append(rules);

    draw();
    await new Popup(root, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, large: true, allowVerticalScrolling: true }).show();
}
