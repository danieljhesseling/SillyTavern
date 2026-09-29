/**
 * Las dos ventanas del gremio (J4 de ROADMAP_SIN_CONEXION): el tablón de campañas y los
 * mercenarios.
 *
 * Con la misma forma que «¿Quién entra?»: la cabecera arriba y tarjetas que se pulsan, sin
 * botones al pie. Cada tarjeta es su botón y dice al pie lo que pasa al pulsarla.
 *
 * Dibuja y recoge. Qué campañas hay, cómo van y cuánto cobra cada uno lo decide
 * `campaign/hub.js`.
 */

/** @param {string} value @returns {JQuery} */
const div = (value) => $('<div></div>').addClass(value);

/**
 * Una tarjeta que se pulsa. Lo que dice entero va en su etiqueta, para quien no la ve.
 *
 * @param {Object} input
 * @param {string} input.icon
 * @param {string} input.label
 * @param {() => void} input.onClick
 * @param {boolean} [input.disabled]
 * @returns {JQuery}
 */
function card({ icon, label, onClick, disabled = false }) {
    return $('<button type="button" class="vt-card hb-card"></button>')
        .attr('aria-label', label)
        .prop('disabled', disabled)
        .toggleClass('is-off', disabled)
        .append(div('vt-face').append(`<i class="fa-solid ${icon}"></i>`))
        .on('click', () => { if (!disabled) onClick(); });
}

/**
 * El tablón de campañas. Devuelve la elegida, o null.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {ReturnType<typeof import('../campaign/hub.js').hubCampaignCards>} input.cards
 * @returns {Promise<string|null>}
 */
export async function openHubBoard({ Popup, POPUP_TYPE, cards }) {
    const body = div('vt-root hb-root');
    body.append(div('vt-head')
        .append($('<h3 class="vt-title"></h3>').text('El tablón de campañas'))
        .append($('<p class="vt-sub"></p>').text('Cada papel es una campaña entera. Tu grupo va entero y vuelve con lo que gane. Puedes volver al gremio cuando quieras y seguir donde lo dejaste.')));

    /** @type {any} */
    let popup = null;
    /** @type {string|null} */
    let chosen = null;
    const grid = div('vt-grid hb-grid');
    for (const one of cards) {
        const state = { nueva: 'Sin empezar', 'en-curso': 'En curso', terminada: 'Terminada' }[one.state];
        const tile = card({
            icon: one.icon,
            label: `${one.action} ${one.name}. ${state}.`,
            onClick: () => {
                chosen = one.id;
                void popup?.completeCancelled();
            },
        }).attr('data-campaign', one.id);
        tile.append(div('vt-name').text(one.name));
        tile.append(div('vt-what').text([one.genre, one.levels].filter(Boolean).join(' · ')));
        tile.append(div(`hb-state hb-${one.state}`).text(one.ending ? `${state}: ${one.ending}` : state));
        if (one.note) tile.append(div('vt-pitch').text(one.note));
        if (one.synopsis) tile.append(div('vt-about').text(one.synopsis));
        if (one.warn) tile.append(div('hb-warn').text(one.warn));
        tile.append(div('vt-go').append(`<i class="fa-solid ${one.state === 'nueva' ? 'fa-play' : 'fa-forward'}"></i>`)
            .append($('<span></span>').text(`${one.action}: ${one.name}`)));
        grid.append(tile);
    }
    if (cards.length === 0) grid.append($('<p class="vt-note"></p>').text('El tablón está vacío: no hay campañas escritas.'));
    body.append(grid);
    body.append(div('hb-foot').append($('<button type="button" class="menu_button hb-close"></button>')
        .text('Ahora no')
        .on('click', () => { void popup?.completeCancelled(); })));

    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide: true, allowVerticalScrolling: true });
    await popup.show();
    return chosen;
}

/**
 * Los mercenarios del gremio. Devuelve a quién contratar o despedir, o null.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {ReturnType<typeof import('../campaign/hub.js').hireOffers>} input.offers
 * @param {number} input.purse Lo que lleva el grupo.
 * @returns {Promise<{action: 'hire'|'fire', name: string}|null>}
 */
export async function openHirePanel({ Popup, POPUP_TYPE, offers, purse }) {
    const body = div('vt-root hb-root');
    body.append(div('vt-head')
        .append($('<h3 class="vt-title"></h3>').text('Espadas de alquiler'))
        .append($('<p class="vt-sub"></p>').text(`Se paga una vez y van contigo, de campaña en campaña, hasta que los despidas o caigan. Lleváis ${purse} de oro.`)));

    /** @type {any} */
    let popup = null;
    /** @type {{action: 'hire'|'fire', name: string}|null} */
    let chosen = null;
    const grid = div('vt-grid hb-grid');
    for (const offer of offers) {
        const short = !offer.hired && purse < offer.fee;
        const tile = card({
            icon: /explor/i.test(offer.className) ? 'fa-crosshairs' : 'fa-shield-halved',
            label: offer.hired ? `Despedir a ${offer.name}` : `Contratar a ${offer.name} por ${offer.fee} de oro`,
            disabled: short,
            onClick: () => {
                chosen = { action: offer.hired ? 'fire' : 'hire', name: offer.name };
                void popup?.completeCancelled();
            },
        }).attr('data-hireling', offer.name).toggleClass('is-hired', offer.hired);
        tile.append(div('vt-name').text(offer.name));
        tile.append(div('vt-what').text(`${offer.className} · Fuerza ${offer.strength} · Destreza ${offer.dexterity}`));
        tile.append(div(`hb-state ${offer.hired ? 'hb-en-curso' : 'hb-nueva'}`).text(offer.hired ? 'Va contigo' : `${offer.fee} de oro`));
        if (short) tile.append(div('hb-warn').text(`No llega el oro: cuesta ${offer.fee}.`));
        tile.append(div('vt-go').append(`<i class="fa-solid ${offer.hired ? 'fa-hand' : 'fa-coins'}"></i>`)
            .append($('<span></span>').text(offer.hired ? 'Despedirle' : 'Contratarle')));
        grid.append(tile);
    }
    body.append(grid);
    body.append(div('hb-foot').append($('<button type="button" class="menu_button hb-close"></button>')
        .text('Cerrar')
        .on('click', () => { void popup?.completeCancelled(); })));

    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide: true, allowVerticalScrolling: true });
    await popup.show();
    return chosen;
}
