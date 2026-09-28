/**
 * Un paso del taller. El mismo para los trece.
 *
 * Trece pantallas distintas serian trece sitios donde arreglar el mismo fallo, asi que todos
 * los pasos son esto: **la lista y la ficha, lado a lado**. A la izquierda las tarjetas, con
 * sus filtros y el `+` en una barra que no se va con el scroll; a la derecha, fija, la ficha
 * de la que esta abierta. Pulsar una la abre al lado: antes la ficha salia debajo de la
 * rejilla, y con veinte sitios habia que bajar dos pantallas para editar uno y subirlas para
 * elegir el siguiente (Gem director de UX, 2026-09-27). Lo que entra en el mundo lleva su
 * marca; la abierta, el borde dorado.
 *
 * Un paso sin ficha (lo que trae un mundo escrito) es solo la rejilla, a lo ancho.
 *
 * Lo que cambia de un paso a otro son **datos**: que tarjetas hay y que campos tiene el
 * formulario. Nada mas. Anadir el paso de bestiario sera escribir su configuracion, no otra
 * pantalla.
 *
 * Dibuja y ya. Quien decide que se puede y que no es `campaign/taller.js`.
 *
 * Ver wiki/archivo/ROADMAP_CREACION.md.
 */

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} title
 * @property {string} [note]    Una linea de que es.
 * @property {string} [icon]    Un icono de Font Awesome, si no hay retrato.
 * @property {string} [image]   Un retrato, si lo hay.
 * @property {string[]} [traits] Lo que lo hace distinto, en tres palabras cada uno.
 * @property {boolean} [add]    La del `+`: abre la ficha vacia. Sin grupo va a la barra de
 *   arriba, siempre a la vista; con grupo se queda al principio del suyo (un tablero nuevo es
 *   de un sitio concreto).
 * @property {boolean} [picked] Si entra en el mundo.
 * @property {boolean} [open]   Si es la que se ve en la ficha de al lado.
 * @property {string} [group]   El grupo al que va en la rejilla («De serie», «Tuyos…»).
 * @property {string} [tag]     Por lo que se filtra («bosque», «Armas»…). Con dos distintos
 *   o mas, salen los filtros.
 */

/**
 * @typedef {Object} Field
 * @property {string} key
 * @property {string} label
 * @property {string} [value]
 * @property {string} [hint]        Lo que va debajo, explicando.
 * @property {string} [placeholder]
 * @property {'text'|'area'|'choice'|'check'|'file'} [kind]
 * @property {Array<{id: string, label: string}>} [options] Para `choice`.
 * @property {boolean} [wand]       Si lleva el lapicito de escribir con el modelo.
 * @property {boolean} [mono]       Para la semilla, que se lee mejor en monoespaciada.
 */

/**
 * Un boton al pie de la ficha.
 *
 * @typedef {Object} Action
 * @property {string} label
 * @property {string} [icon]
 * @property {boolean} [danger]  Lo que no se deshace: va en rojo.
 * @property {() => void} onClick
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * «bosque» → «Bosque», para los filtros.
 *
 * @param {string} value
 * @returns {string}
 */
function capital(value) {
    const clean = text(value);
    return clean ? clean[0].toLocaleUpperCase('es') + clean.slice(1) : '';
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
        .toggleClass('open', Boolean(card.open))
        .attr('data-card', text(card.id))
        .attr('data-tag', text(card.tag));

    if (card.image) {
        root.append($('<img class="tl-card-face" alt="">').attr('src', text(card.image)));
    } else {
        root.append($('<div class="tl-card-face"></div>')
            .append(`<i class="fa-solid ${text(card.icon) || (card.add ? 'fa-plus' : 'fa-circle')}"></i>`));
    }
    // Lo que entra en el mundo, con su marca: el color solo no se distingue del de la abierta.
    if (card.picked && !card.add) root.append('<i class="fa-solid fa-check tl-card-in" aria-hidden="true"></i>');

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
 * @param {((file: any) => Promise<string>)|null} [onFile]
 * @returns {JQuery}
 */
function drawField(field, onWrite, onWand, onFile = null) {
    const row = $('<div class="tl-field"></div>').attr('data-key', text(field.key));
    const kind = text(field.kind) || 'text';

    // La cara: se busca en el disco y se ve al elegirla. Se sube al elegir y no al
    // guardar, para que si falla te enteres mientras todavia puedes cambiarla.
    if (kind === 'file') {
        row.addClass('is-file');
        row.append($('<div class="tl-field-head"></div>')
            .append($('<label class="tl-label"></label>').text(text(field.label))));

        const pick = $('<input type="file" class="tl-file" accept="image/*">');
        const seen = $('<img class="tl-face" alt="">').toggle(Boolean(text(field.value)));
        if (text(field.value)) seen.attr('src', text(field.value));

        pick.on('change', async () => {
            const file = /** @type {any} */ (pick[0])?.files?.[0];
            if (!file || !onFile) return;
            try {
                const path = await onFile(file);
                if (!text(path)) return;
                seen.attr('src', path).show();
                onWrite(text(field.key), path);
            } catch (error) {
                console.error('[taller] no se pudo guardar esa imagen', error);
                row.append($('<div class="tl-hint bad"></div>')
                    .text('No se pudo guardar esa imagen. Puedes seguir sin cara.'));
            }
        });

        row.append($('<div class="tl-file-row"></div>').append(pick).append(seen));
        if (text(field.hint)) row.append($('<div class="tl-hint"></div>').text(text(field.hint)));
        return row;
    }

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
    // Solo lo que cambia de verdad: al salir del campo el navegador repite con `change` lo
    // que ya dijo `input`, y ese redibujado de mas se comia el clic en la tarjeta de al lado.
    // Y un espacio al final no cambia nada (se guarda recortado): redibujar por el lo borraba
    // mientras escribias, y «Mirador de» salia «Miradorde».
    let sent = text(input.val());
    input.on('change input', () => {
        const value = String(input.val() ?? '');
        if (text(value) === sent) return;
        sent = text(value);
        onWrite(text(field.key), value);
    });
    row.append(input);

    if (text(field.hint)) row.append($('<div class="tl-hint"></div>').text(text(field.hint)));
    return row;
}

/**
 * Que campos van a lo ancho en una ficha a dos columnas: lo largo (un texto, la cara, una
 * casilla, la semilla con su dado, una etiqueta que en media columna ocuparia tres lineas) y
 * el que se quedaria solo en su fila, que dejaria un hueco al lado.
 *
 * @param {Field[]} rows
 * @returns {boolean[]}
 */
function wideOnes(rows) {
    const long = rows.map(field => ['area', 'file', 'check'].includes(text(field.kind)) || Boolean(field.mono)
        || text(field.label).length >= 28);
    const wide = [...long];
    let run = 0;
    rows.forEach((field, index) => {
        if (!long[index]) {
            run += 1;
            return;
        }
        if (run % 2 === 1) wide[index - 1] = true;
        run = 0;
    });
    if (run % 2 === 1) wide[rows.length - 1] = true;
    return wide;
}

/**
 * Los botones del pie de la ficha.
 *
 * @param {Action[]} actions
 * @returns {JQuery}
 */
function drawActions(actions) {
    const foot = $('<div class="tl-detail-foot"></div>');
    for (const action of actions) {
        const button = $('<button type="button" class="menu_button tl-action"></button>')
            .toggleClass('danger', Boolean(action.danger));
        if (text(action.icon)) button.append(`<i class="fa-solid ${text(action.icon)}"></i>`);
        button.append($('<span></span>').text(text(action.label)));
        button.on('click', () => action.onClick());
        foot.append(button);
    }
    return foot;
}

/**
 * Lo que la pantalla tiene que conservar al redibujarse, que es a cada cosa que se toca:
 * donde estaba el scroll de la lista y el de la ficha, el filtro puesto, y en que campo se
 * estaba escribiendo. Sin esto, escribir una letra en el nombre sacaba el cursor del campo,
 * y abrir la tarjeta veinte devolvia la lista arriba del todo.
 *
 * Se guarda en el propio contenedor, por paso: es de la pantalla, no del mundo.
 *
 * @param {JQuery} into
 * @param {string} step
 * @returns {{view: any, field: string, caret: number[]|null}}
 */
function remember(into, step) {
    /** @type {Record<string, any>} */
    const views = into.data('tl-views') ?? {};
    const work = into.children('.tl-work');
    const was = text(work.attr('data-step'));
    if (was) {
        const box = /** @type {HTMLElement|undefined} */ (work.find('.tl-list-scroll')[0]);
        const card = /** @type {HTMLElement|undefined} */ (work.find('.tl-list-scroll .tl-card.open')[0]);
        views[was] = {
            ...views[was],
            list: box?.scrollTop ?? 0,
            detail: work.find('.tl-detail-body').scrollTop() ?? 0,
            // Si la abierta se estaba viendo: al escribir su nombre crece, y tiene que seguir entera.
            seen: Boolean(box && card && card.offsetTop < box.scrollTop + box.clientHeight
                && card.offsetTop + card.offsetHeight > box.scrollTop),
        };
    }
    views[step] = views[step] ?? { list: 0, detail: 0, filter: '', open: '' };
    into.data('tl-views', views);

    const active = /** @type {any} */ (document.activeElement);
    let field = '';
    /** @type {number[]|null} */
    let caret = null;
    if (was === step && active && into[0]?.contains(active)) {
        field = text($(active).closest('.tl-field').attr('data-key'));
        if (typeof active.selectionStart === 'number') caret = [active.selectionStart, active.selectionEnd];
    }
    return { view: views[step], field, caret };
}

/**
 * Devolver a la pantalla lo que `remember` guardo.
 *
 * @param {JQuery} into
 * @param {{view: any, field: string, caret: number[]|null}} kept
 * @returns {void}
 */
function restore(into, kept) {
    const list = into.find('.tl-list-scroll')[0];
    const detail = into.find('.tl-detail-body')[0];
    if (list) list.scrollTop = Number(kept.view.list) || 0;
    if (detail) detail.scrollTop = Number(kept.view.detail) || 0;

    // Si se ha abierto otra (o una nueva, que va al final), que se vea; y si la abierta se
    // estaba viendo, que se siga viendo entera aunque haya crecido. A mano y no con
    // `scrollIntoView`, que movia tambien la ventana entera.
    const open = /** @type {HTMLElement|undefined} */ (into.find('.tl-list-scroll .tl-card.open')[0]);
    const openId = text(open?.getAttribute('data-card'));
    if (list && open && (openId !== kept.view.open || kept.view.seen)) {
        if (open.offsetTop < list.scrollTop) list.scrollTop = open.offsetTop - 8;
        else if (open.offsetTop + open.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTop = open.offsetTop + open.offsetHeight - list.clientHeight + 8;
        }
    }
    kept.view.open = openId;

    if (!kept.field) return;
    const input = /** @type {any} */ (into.find(`.tl-field[data-key="${kept.field}"]`).find('.tl-input, .tl-check').first()[0]);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (kept.caret && typeof input.setSelectionRange === 'function') {
        try {
            input.setSelectionRange(kept.caret[0], kept.caret[1]);
        } catch {
            // Un desplegable no tiene cursor.
        }
    }
}

/**
 * Dibujar un paso entero dentro de un contenedor.
 *
 * @param {JQuery} into
 * @param {Object} input
 * @param {string} input.title
 * @param {string} input.hint
 * @param {string} [input.cardsTitle] Lo que dice encima de las tarjetas.
 * @param {string} [input.formTitle]  Lo que dice la ficha; sin campos, lo que se lee en ella vacia.
 * @param {Card[]} input.cards
 * @param {Field[]} input.fields
 * @param {boolean} [input.formOpen]  Sin ficha al lado (solo tarjetas): si la de debajo va fija o plegada.
 * @param {boolean} [input.cardsOpen] Sin ficha al lado: si las tarjetas empiezan a la vista.
 *        Sin decir nada, se abren cuando no hay nada elegido.
 * @param {string} [input.detailIcon] El icono de la ficha.
 * @param {Action[]} [input.actions]  Los botones al pie de la ficha: quitar, dejar fuera…
 * @param {string} [input.tally]      Una cuenta para la barra de la lista («30 de 41 dentro»).
 * @param {(id: string) => void} input.onPick
 * @param {(key: string, value: string) => void} input.onWrite
 * @param {((key: string) => Promise<string>)|null} [input.onWand]
 * @param {((file: any) => Promise<string>)|null} [input.onFile] Para los campos de imagen.
 * @param {((body: JQuery) => void)|null} [input.extra] Lo propio de esta ficha, debajo de los
 *        campos: el tablero para pintarlo.
 * @returns {void}
 */
export function drawStep(into, {
    title, hint, cards, fields, onPick, onWrite,
    cardsTitle = '', formTitle = '', formOpen = true, cardsOpen = null, onWand = null,
    onFile = null, detailIcon = 'fa-pen-to-square', actions = [], tally = '', extra = null,
}) {
    const kept = remember(into, text(title));
    into.empty();

    const head = $('<div class="tl-step-head"></div>');
    head.append($('<div class="tl-step-title"></div>').text(text(title)));
    if (text(hint)) head.append($('<div class="tl-step-hint"></div>').text(text(hint)));
    into.append(head);

    const list = Array.isArray(cards) ? cards : [];
    const rows = Array.isArray(fields) ? fields : [];
    const buttons = Array.isArray(actions) ? actions : [];

    /** @param {JQuery} body */
    const fillForm = (body) => {
        const form = $('<div class="tl-form"></div>');
        const wide = wideOnes(rows);
        rows.forEach((field, index) => {
            form.append(drawField(field, onWrite, onWand, onFile).toggleClass('tl-wide', wide[index]));
        });
        body.append(form);
    };

    /**
     * @param {JQuery} body
     * @param {Card[]} shown
     */
    const fillCards = (body, shown) => {
        const grid = $('<div class="tl-cards"></div>');
        // Por grupos, si los traen: lo de serie y lo tuyo no se mezclan.
        let group = '';
        for (const card of shown) {
            if (text(card.group) && text(card.group) !== group) {
                group = text(card.group);
                grid.append($('<div class="tl-cards-group"></div>').text(group));
            }
            grid.append(drawCard(card, onPick));
        }
        body.append(grid);
    };

    // Con ficha: la lista y la ficha, lado a lado.
    if (list.length > 0 && (rows.length > 0 || text(formTitle))) {
        const work = $('<div class="tl-work"></div>').attr('data-step', text(title));
        const side = $('<div class="tl-list"></div>');
        const bar = $('<div class="tl-toolbar"></div>');

        // El `+` va arriba, siempre a la vista: con la lista filtrada o a mitad de scroll,
        // una tarjeta mas se perdia.
        const loose = (/** @type {Card} */ card) => Boolean(card.add) && !text(card.group);
        const shown = list.filter(card => !loose(card));
        const tags = [...new Set(shown.filter(card => !card.add).map(card => text(card.tag)).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));
        // La que se acaba de abrir no se esconde (una nueva no tiene de que filtrarse): si el
        // filtro la dejaria fuera, se quita el filtro.
        const opened = shown.find(card => card.open);
        if (!tags.includes(kept.view.filter)) kept.view.filter = '';
        else if (opened && text(opened.id) !== kept.view.open && text(opened.tag) !== kept.view.filter) kept.view.filter = '';

        const pills = $('<div class="tl-filters"></div>');
        const scroll = $('<div class="tl-list-scroll"></div>');
        /** Enseñar solo lo del filtro, sin redibujar: el grupo que se queda vacío, fuera. */
        const applyFilter = () => {
            const want = text(kept.view.filter);
            pills.children().each((i, pill) => {
                $(pill).toggleClass('on', text($(pill).attr('data-tag')) === want);
            });
            /** @type {JQuery|null} */
            let header = null;
            let seen = 0;
            scroll.find('.tl-cards').children().each((i, child) => {
                const node = $(child);
                if (node.hasClass('tl-cards-group')) {
                    if (header) header.toggle(seen > 0);
                    header = node;
                    seen = 0;
                    return;
                }
                const show = !want || node.hasClass('add') || text(node.attr('data-tag')) === want;
                node.toggleClass('tl-hidden', !show);
                if (show) seen += 1;
            });
            if (header) header.toggle(seen > 0);
        };
        if (tags.length >= 2) {
            for (const tag of ['', ...tags]) {
                const pill = $('<button type="button" class="tl-pill"></button>')
                    .attr('data-tag', tag).text(tag ? capital(tag) : 'Todos');
                pill.on('click', () => {
                    kept.view.filter = tag;
                    applyFilter();
                });
                pills.append(pill);
            }
        }
        // Sin filtros, la barra dice qué hay en la lista.
        if (pills.children().length > 0) bar.append(pills);
        else bar.append($('<div class="tl-toolbar-title"></div>').text(text(cardsTitle)));
        if (text(tally)) bar.append($('<div class="tl-tally"></div>').text(text(tally)));
        for (const card of list.filter(loose)) {
            const add = $('<button type="button" class="menu_button tl-add"></button>')
                .attr('data-card', text(card.id))
                .attr('title', text(card.note))
                .toggleClass('open', Boolean(card.open || card.picked))
                .append(`<i class="fa-solid ${text(card.icon) || 'fa-plus'}"></i>`)
                .append($('<span></span>').text(text(card.title)));
            add.on('click', () => onPick(text(card.id)));
            bar.append(add);
        }
        side.append(bar);

        fillCards(scroll, shown);
        // Una lista vacia dice como se llena, no se queda en blanco.
        if (shown.length === 0) {
            const first = list.find(loose);
            scroll.append($('<div class="tl-empty"></div>').text(first
                ? `Todavía no hay nada aquí. Con «${text(first.title)}», arriba, empiezas.`
                : 'Aquí no hay nada todavía.'));
        }
        side.append(scroll);
        applyFilter();

        // La ficha, fija al lado. Vacía, dice qué hacer para llenarla.
        const detail = $('<div class="tl-detail"></div>');
        if (rows.length > 0) {
            detail.append($('<div class="tl-detail-head"></div>')
                .append(`<i class="fa-solid ${text(detailIcon) || 'fa-pen-to-square'}"></i>`)
                .append($('<div class="tl-detail-title"></div>').text(text(formTitle) || 'La ficha')));
            const inside = $('<div class="tl-detail-body"></div>');
            fillForm(inside);
            if (typeof extra === 'function') extra(inside);
            detail.append(inside);
            // Los botones, fuera del scroll: una ficha larga (la del narrador) los escondía abajo.
            if (buttons.length > 0) detail.append(drawActions(buttons));
        } else {
            detail.addClass('empty').append($('<div class="tl-detail-empty"></div>')
                .append(`<i class="fa-solid ${text(detailIcon) || 'fa-pen-to-square'}"></i>`)
                .append($('<div></div>').text(text(formTitle))));
        }

        into.append(work.append(side).append(detail));
        restore(into, kept);
        return;
    }

    // Sin ficha: la rejilla a lo ancho.
    if (list.length > 0) {
        if (cardsOpen === true) {
            // Siempre a la vista: sin desplegable que plegar (Gem director de UX, 2026-09-27).
            const section = $('<div class="tl-section"></div>');
            section.append($('<div class="tl-section-title"></div>').text(text(cardsTitle) || 'Elige'));
            fillCards(section, list);
            into.append(section);
        } else {
            const open = cardsOpen === null ? list.every(card => !card.picked) : Boolean(cardsOpen);
            into.append(fold(text(cardsTitle) || 'Elige', open, (body) => fillCards(body, list)));
        }
    }

    if (rows.length > 0) {
        if (formOpen) {
            const block = $('<div class="tl-block"></div>');
            block.append($('<div class="tl-block-title"></div>').text(text(formTitle) || 'La ficha'));
            fillForm(block);
            into.append(block);
        } else {
            into.append(fold(text(formTitle) || 'La ficha', false, fillForm));
        }
    }
    if (buttons.length > 0) into.append(drawActions(buttons));
    restore(into, kept);
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
