/**
 * Un paso del taller. El mismo para los trece.
 *
 * Trece pantallas distintas serian trece sitios donde arreglar el mismo fallo, asi que todos
 * los pasos son esto: **dos acordeones**. Arriba las tarjetas —la primera con un `+`—, y al
 * pulsar una se abre el de abajo con su formulario. Lo elegido va en ambar, que es lo unico
 * que hay que mirar para saber que entra en el mundo.
 *
 * Lo que cambia de un paso a otro son **datos**: que tarjetas hay y que campos tiene el
 * formulario. Nada mas. Anadir el paso de bestiario sera escribir su configuracion, no otra
 * pantalla.
 *
 * Dibuja y ya. Quien decide que se puede y que no es `campaign/taller.js`.
 *
 * Ver wiki/ROADMAP_CREACION.md.
 */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} title
 * @property {string} [note]    Una linea de que es.
 * @property {string} [icon]    Un icono de Font Awesome, si no hay retrato.
 * @property {string} [image]   Un retrato, si lo hay.
 * @property {string[]} [traits] Lo que lo hace distinto, en tres palabras cada uno.
 * @property {boolean} [add]    La del `+`: abre el formulario vacio.
 * @property {boolean} [picked] Si entra en el mundo.
 */

/**
 * @typedef {Object} Field
 * @property {string} key
 * @property {string} label
 * @property {string} [value]
 * @property {string} [hint]        Lo que va debajo, explicando.
 * @property {string} [placeholder]
 * @property {'text'|'area'|'choice'|'check'} [kind]
 * @property {Array<{id: string, label: string}>} [options] Para `choice`.
 * @property {boolean} [wand]       Si lleva el lapicito de escribir con el modelo.
 * @property {boolean} [mono]       Para la semilla, que se lee mejor en monoespaciada.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Una tarjeta.
 *
 * @param {Card} card
 * @param {(id: string) => void} onPick
 * @returns {JQuery}
 */
function drawCard(card, onPick) {
    const root = $('<button type="button" class="tl-card"></button>')
        .toggleClass('add', Boolean(card.add))
        .toggleClass('picked', Boolean(card.picked))
        .attr('data-card', text(card.id));

    if (card.image) {
        root.append($('<img class="tl-card-face" alt="">').attr('src', text(card.image)));
    } else {
        root.append($('<div class="tl-card-face"></div>')
            .append(`<i class="fa-solid ${text(card.icon) || (card.add ? 'fa-plus' : 'fa-circle')}"></i>`));
    }

    root.append($('<div class="tl-card-title"></div>').text(text(card.title)));
    if (text(card.note)) root.append($('<div class="tl-card-note"></div>').text(text(card.note)));

    // Lo que lo hace distinto, en tres palabras: es lo que se lee de verdad al elegir.
    for (const trait of (Array.isArray(card.traits) ? card.traits : []).slice(0, 3)) {
        root.append($('<div class="tl-card-trait"></div>').text(text(trait)));
    }

    root.on('click', () => onPick(text(card.id)));
    return root;
}

/**
 * Un campo del formulario.
 *
 * @param {Field} field
 * @param {(key: string, value: string) => void} onWrite
 * @param {((key: string) => Promise<string>)|null} onWand
 * @returns {JQuery}
 */
function drawField(field, onWrite, onWand) {
    const row = $('<div class="tl-field"></div>');
    const kind = text(field.kind) || 'text';

    if (kind === 'check') {
        const id = `tl-${text(field.key)}`;
        const box = $('<input type="checkbox" class="tl-check">').attr('id', id)
            .prop('checked', text(field.value) === 'si');
        box.on('change', () => onWrite(text(field.key), box.prop('checked') ? 'si' : ''));
        row.addClass('is-check');
        row.append(box);
        row.append($('<label class="tl-check-label"></label>').attr('for', id).text(text(field.label)));
        if (text(field.hint)) row.append($('<div class="tl-hint"></div>').text(text(field.hint)));
        return row;
    }

    const head = $('<div class="tl-field-head"></div>');
    head.append($('<label class="tl-label"></label>').text(text(field.label)));

    // El lapicito solo donde una frase escrita por el modelo tiene sentido. Nunca en un
    // numero ni en un desplegable: ahi no hay nada que redactar.
    if (field.wand && onWand) {
        const wand = $('<button type="button" class="tl-wand" title="Que lo escriba el modelo"></button>')
            .append('<i class="fa-solid fa-wand-magic-sparkles"></i>');
        wand.on('click', async () => {
            wand.prop('disabled', true).addClass('busy');
            try {
                const written = await onWand(text(field.key));
                if (text(written)) {
                    row.find('.tl-input').val(written);
                    onWrite(text(field.key), written);
                }
            } finally {
                wand.prop('disabled', false).removeClass('busy');
            }
        });
        head.append(wand);
    }
    row.append(head);

    /** @type {JQuery} */
    let input;
    if (kind === 'area') {
        input = $('<textarea class="text_pole tl-input" rows="3"></textarea>');
    } else if (kind === 'choice') {
        input = $('<select class="text_pole tl-input"></select>');
        for (const option of (Array.isArray(field.options) ? field.options : [])) {
            input.append($('<option></option>').attr('value', text(option.id)).text(text(option.label)));
        }
    } else {
        input = $('<input type="text" class="text_pole tl-input">');
    }

    input.toggleClass('mono', Boolean(field.mono));
    if (text(field.placeholder)) input.attr('placeholder', text(field.placeholder));
    input.val(text(field.value));
    input.on('change input', () => onWrite(text(field.key), String(input.val() ?? '')));
    row.append(input);

    if (text(field.hint)) row.append($('<div class="tl-hint"></div>').text(text(field.hint)));
    return row;
}

/**
 * Dibujar un paso entero dentro de un contenedor.
 *
 * @param {JQuery} into
 * @param {Object} input
 * @param {string} input.title
 * @param {string} input.hint
 * @param {string} [input.cardsTitle] Lo que dice el acordeon de arriba.
 * @param {string} [input.formTitle]  Lo que dice el de abajo.
 * @param {Card[]} input.cards
 * @param {Field[]} input.fields
 * @param {boolean} [input.formOpen]  Si el de abajo empieza abierto.
 * @param {boolean} [input.cardsOpen] Si el de arriba empieza abierto. Sin decir nada, se
 *        abre cuando no hay nada elegido: en el paso 1 eso es «elige»; en uno donde las
 *        tarjetas **son** el contenido, hay que pedirlo.
 * @param {(id: string) => void} input.onPick
 * @param {(key: string, value: string) => void} input.onWrite
 * @param {((key: string) => Promise<string>)|null} [input.onWand]
 * @returns {void}
 */
export function drawStep(into, {
    title, hint, cards, fields, onPick, onWrite,
    cardsTitle = '', formTitle = '', formOpen = true, cardsOpen = null, onWand = null,
}) {
    into.empty();

    const head = $('<div class="tl-step-head"></div>');
    head.append($('<div class="tl-step-title"></div>').text(text(title)));
    if (text(hint)) head.append($('<div class="tl-step-hint"></div>').text(text(hint)));
    into.append(head);

    const list = Array.isArray(cards) ? cards : [];
    if (list.length > 0) {
        const open = cardsOpen === null ? list.every(card => !card.picked) : Boolean(cardsOpen);
        into.append(fold(text(cardsTitle) || 'Elige', open, (body) => {
            const grid = $('<div class="tl-cards"></div>');
            for (const card of list) grid.append(drawCard(card, onPick));
            body.append(grid);
        }));
    }

    const rows = Array.isArray(fields) ? fields : [];
    if (rows.length > 0) {
        into.append(fold(text(formTitle) || 'La ficha', formOpen, (body) => {
            const form = $('<div class="tl-form"></div>');
            for (const field of rows) form.append(drawField(field, onWrite, onWand));
            body.append(form);
        }));
    }
}

/**
 * Un acordeon.
 *
 * @param {string} title
 * @param {boolean} open
 * @param {(body: JQuery) => void} fill
 * @returns {JQuery}
 */
function fold(title, open, fill) {
    const root = $('<div class="tl-fold"></div>').toggleClass('open', Boolean(open));
    const head = $('<button type="button" class="tl-fold-head"></button>')
        .append('<i class="fa-solid fa-chevron-down tl-fold-arrow"></i>')
        .append($('<span></span>').text(text(title)));
    const body = $('<div class="tl-fold-body"></div>');

    head.on('click', () => root.toggleClass('open'));
    fill(body);

    return root.append(head).append(body);
}
