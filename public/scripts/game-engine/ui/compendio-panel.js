/**
 * El compendio, visto: que tienes, que te falta y que sale si lo pides.
 *
 * Sin esto la biblioteca es una carpeta de archivos y no sabes lo que hay dentro. Y sin
 * saberlo, nadie escribe la bateria siguiente: llenar un compendio a ciegas es como
 * escribir en un folio que no puedes leer.
 *
 * Tres cosas la separan de ser una tabla:
 *
 * 1. **Los huecos.** No solo lo que hay: lo que falta. Una bateria sin escribir sale
 *    apagada y con su motivo, igual que las escenas apagadas del Modo Juego, asi que la
 *    pantalla es de paso la barra de progreso del roadmap.
 * 2. **El boton de probar.** Diez tiradas con la semilla que escribas, ahi mismo. Es como
 *    se ajusta un peso sin jugarse una partida entera para descubrir que la daga sale
 *    siempre.
 * 3. **De donde vino cada fila.** Importaste un libro, no te convencio, y se ve cuales
 *    entraron con el.
 *
 * Dibuja y pregunta. No escribe: mientras no haya por donde guardar, ensenar un campo
 * editable seria prometer algo que no pasa.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md.
 */

import { DOMAINS } from '../compendio/compendio.js';

/** Como se llama cada bateria en pantalla, y que se supone que trae. */
export const DOMAIN_LABELS = {
    nombres: ['Nombres', 'De qué se hacen los nombres de cada cultura'],
    materiales: ['Materiales', 'Formas y materiales: forma × material = objeto'],
    propiedades: ['Propiedades', 'Lo que da y lo que quita: sin contrapartida no hay decisión'],
    habilidades: ['Habilidades', 'Lo que sabe hacer alguien, y cuánto se gasta'],
    bestiario: ['Bestiario', 'Arquetipos y plantillas que se apilan'],
    personas: ['Personas', 'Rasgos, deseos, miedos y oficios'],
    sitios: ['Sitios', 'Tipos de localidad y plantillas de sala'],
    misiones: ['Misiones', 'Verbos, objetos y giros'],
    facciones: ['Facciones', 'Quién quiere qué, y contra quién'],
    mundo: ['Mundo', 'Biomas, climas y estaciones'],
    estados: ['Estados', 'Heridas, enfermedades y condiciones'],
};

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Lo que una fila dice de si misma, en una celda.
 *
 * @param {any} row
 * @returns {string}
 */
function conditionsOf(row) {
    const bits = Object.entries(row?.when ?? {}).map(([key, value]) => {
        const shown = Array.isArray(value) ? value.join(', ') : text(value);
        return `${key}: ${shown}`;
    });
    return bits.join(' · ');
}

/**
 * Los huecos de una bateria: por donde esta floja.
 *
 * Cuenta cuantas filas hay de cada valor de un campo y **dice los que estan a cero**. Es
 * lo que convierte llenar el compendio en una lista de tareas en vez de en un folio en
 * blanco, que es la diferencia entre llenarlo y no llenarlo nunca.
 *
 * @param {any[]} rows
 * @param {string} field
 * @returns {Array<[string, number]>}
 */
export function countBy(rows, field) {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const row of rows) {
        const value = text(row?.[field]) || text(row?.when?.[field]) || '(sin decir)';
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Abre el compendio.
 *
 * @param {Object} input
 * @param {any} input.compendium
 * @param {string[]} [input.errors] Lo que el cargador no pudo leer.
 * @param {(domain: string, seed: string, howMany: number) => string[]} [input.sample]
 *        Diez tiradas de esa bateria. Sin esto no hay botón de probar.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<void>}
 */
export async function openCompendiumPanel({ compendium, errors = [], sample = null, Popup, POPUP_TYPE }) {
    const root = $('<div class="cx-root"></div>');

    const loaded = DOMAINS.filter(domain => compendium?.has?.(domain));
    const total = loaded.reduce((sum, domain) => sum + compendium.count(domain), 0);

    root.append($('<div class="cx-title"></div>').text('Compendio'));
    root.append($('<div class="cx-intro"></div>').text(
        loaded.length === 0
            ? 'Todavía no hay ninguna batería escrita. Van en public/compendio/, un archivo por dominio.'
            : `${loaded.length} de ${DOMAINS.length} baterías, ${total} filas en total. `
              + 'De aquí sacan los generadores.',
    ));

    if (errors.length > 0) {
        const box = $('<div class="cx-errors"></div>');
        box.append($('<div class="cx-errors-title"></div>').text('Lo que no se pudo leer:'));
        for (const message of errors.slice(0, 8)) box.append($('<div></div>').text(message));
        root.append(box);
    }

    const tabs = $('<div class="cx-tabs"></div>');
    const body = $('<div class="cx-body"></div>');
    root.append(tabs, body);

    let current = loaded[0] ?? DOMAINS[0];

    /** Lo que se esté escribiendo en el buscador, por batería. */
    /** @type {Record<string, string>} */
    const filters = {};

    /** Dibuja la batería abierta. */
    function drawBody() {
        body.empty();

        const [label, about] = DOMAIN_LABELS[current] ?? [current, ''];

        if (!compendium?.has?.(current)) {
            // Apagada y con su motivo, igual que las escenas apagadas del Modo Juego: una
            // pestaña que no dice por qué está vacía parece rota.
            const empty = $('<div class="cx-empty"></div>');
            empty.append($('<div class="cx-empty-title"></div>').text(`${label}: todavía no existe`));
            empty.append($('<div></div>').text(about));
            empty.append($('<code></code>').text(`public/compendio/${current}.json`));
            body.append(empty);
            return;
        }

        const rows = compendium.find(current, {});
        body.append($('<div class="cx-about"></div>').text(about));

        // --- Probar -------------------------------------------------------------------
        if (sample) {
            const tryRow = $('<div class="cx-try"></div>');
            const seedInput = $('<input type="text" class="text_pole cx-seed" />')
                .attr('placeholder', 'una semilla: molino, cripta…')
                .val('molino');
            const go = $('<button class="menu_button cx-try-go" type="button"></button>')
                .append('<i class="fa-solid fa-dice-d20"></i>')
                .append($('<span></span>').text(' Probar'));
            const out = $('<div class="cx-try-out"></div>');

            go.on('click', () => {
                const lines = sample(current, String(seedInput.val() || ''), 10);
                out.empty();
                if (lines.length === 0) {
                    out.append($('<div class="cx-dim"></div>').text(
                        'Esta batería todavía no tiene quien la sortee.'));
                    return;
                }
                for (const line of lines) out.append($('<div class="cx-try-line"></div>').text(line));
            });

            tryRow.append($('<span class="cx-label"></span>').text('Semilla'), seedInput, go);
            body.append(tryRow, out);
        }

        // --- Los huecos ---------------------------------------------------------------
        const facet = current === 'nombres' ? 'kind'
            : current === 'materiales' ? 'kind'
                : 'rarity';
        const counts = countBy(rows, facet);
        if (counts.length > 1 || text(counts[0]?.[0]) !== '(sin decir)') {
            const gaps = $('<div class="cx-gaps"></div>');
            gaps.append($('<span class="cx-label"></span>').text(`Por ${facet}`));
            for (const [value, count] of counts) {
                gaps.append($('<span class="cx-chip"></span>').text(`${value}: ${count}`));
            }
            body.append(gaps);
        }

        // --- La tabla -----------------------------------------------------------------
        const search = $('<input type="text" class="text_pole cx-search" />')
            .attr('placeholder', 'Buscar por nombre, etiqueta o procedencia')
            .val(filters[current] ?? '');
        body.append(search);

        const table = $('<div class="cx-table"></div>');
        body.append(table);

        const drawRows = () => {
            const needle = String(search.val() || '').trim().toLowerCase();
            const shown = rows.filter(row => !needle
                || text(row.name).toLowerCase().includes(needle)
                || text(row.id).toLowerCase().includes(needle)
                || text(row.source).toLowerCase().includes(needle)
                || (row.tags ?? []).some((/** @type {string} */ tag) => tag.toLowerCase().includes(needle)));

            table.empty();
            const head = $('<div class="cx-row cx-head"></div>');
            for (const column of ['Nombre', 'Etiquetas', 'Peso', 'Cuándo sale', 'De dónde']) {
                head.append($('<span></span>').text(column));
            }
            table.append(head);

            if (shown.length === 0) {
                table.append($('<div class="cx-dim"></div>').text('Nada con eso.'));
                return;
            }

            for (const row of shown) {
                const line = $('<div class="cx-row"></div>');
                line.append($('<span class="cx-name"></span>').text(row.name).attr('title', row.id));
                line.append($('<span></span>').text((row.tags ?? []).join(', ')));
                // Cero no es "poco probable": es "nunca sola, se pide por id".
                line.append($('<span></span>').text(row.weight === 0 ? '0 (solo por id)' : String(row.weight)));
                line.append($('<span class="cx-when"></span>').text(conditionsOf(row) || '—'));
                line.append($('<span></span>').text(text(row.source) || 'escrita a mano'));
                table.append(line);
            }

            table.append($('<div class="cx-dim"></div>').text(
                shown.length === rows.length
                    ? `${rows.length} filas`
                    : `${shown.length} de ${rows.length} filas`));
        };

        search.on('input', () => {
            filters[current] = String(search.val() || '');
            drawRows();
        });
        drawRows();
    }

    /** Dibuja las pestañas, con su cuenta y las apagadas al final. */
    function drawTabs() {
        tabs.empty();
        for (const domain of DOMAINS) {
            const [label] = DOMAIN_LABELS[domain] ?? [domain, ''];
            const has = Boolean(compendium?.has?.(domain));
            const button = $('<button class="cx-tab" type="button"></button>')
                .attr('data-domain', domain)
                .toggleClass('empty', !has)
                .toggleClass('active', domain === current);

            button.append($('<span></span>').text(label));
            button.append($('<span class="cx-count"></span>').text(has ? String(compendium.count(domain)) : '—'));
            button.attr('title', has ? `${compendium.count(domain)} filas` : 'Todavía no existe');

            button.on('click', () => {
                current = domain;
                drawTabs();
                drawBody();
            });
            tabs.append(button);
        }
    }

    drawTabs();
    drawBody();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
    });

    await popup.show();
}
