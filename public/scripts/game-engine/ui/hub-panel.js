/**
 * Las ventanas del gremio (J4 de ROADMAP_SIN_CONEXION): el tablón de campañas y los
 * mercenarios. Y tus personajes (J1.6 y J18.1): con quién entras, y en el tablón, quién va.
 *
 * Con la misma forma que «¿Quién entra?»: la cabecera arriba y tarjetas que se pulsan, sin
 * botones al pie. Cada tarjeta es su botón y dice al pie lo que pasa al pulsarla.
 *
 * Dibuja y recoge. Qué campañas hay, cómo van y cuánto cobra cada uno lo decide
 * `campaign/hub.js`; quién de los tuyos va y quién se queda, `campaign/hub-heroes.js`.
 */

import { firstArt, loadPixelManifest } from './pixel-art.js';

/** @param {string} value @returns {JQuery} */
const div = (value) => $('<div></div>').addClass(value);

/**
 * La cara de una tarjeta: un dibujo en pixel si lo hay (un retrato o el icono de su clase)
 * y, si no o si no carga, el icono de Font Awesome.
 *
 * @param {string} art   La URL del dibujo, o vacío.
 * @param {string} icon  El icono de Font Awesome.
 * @param {boolean} [bust] Si el dibujo es un retrato (128×160) y no un icono (64×64).
 * @returns {JQuery}
 */
function face(art, icon, bust = false) {
    const box = div('vt-face');
    const fallback = () => box.removeClass('hb-face-bust hb-face-icon').empty().append(`<i class="fa-solid ${icon}"></i>`);
    if (!art) return fallback();
    return box.addClass(bust ? 'hb-face-bust' : 'hb-face-icon')
        .append($('<img alt="" class="pixel-art hb-pixel" />').attr('src', art).on('error', fallback));
}

/**
 * Una tarjeta que se pulsa. Lo que dice entero va en su etiqueta, para quien no la ve.
 *
 * @param {Object} input
 * @param {string} input.icon
 * @param {string} input.label
 * @param {() => void} input.onClick
 * @param {boolean} [input.disabled]
 * @param {string} [input.art] Un retrato en pixel en vez del icono.
 * @returns {JQuery}
 */
function card({ icon, label, onClick, disabled = false, art = '' }) {
    return $('<button type="button" class="vt-card hb-card"></button>')
        .attr('aria-label', label)
        .prop('disabled', disabled)
        .toggleClass('is-off', disabled)
        .append(face(art, icon, true))
        .on('click', () => { if (!disabled) onClick(); });
}

/**
 * J1.6 y J18.1: la tarjeta de uno de tus personajes. Su cara si la tiene; si no, el retrato de
 * relleno de su clase en pixel, o el icono de su clase. Debajo, quién es y lo que lleva.
 *
 * @param {import('../campaign/hub-heroes.js').HeroCard} hero
 * @param {Object} input
 * @param {string} input.go    Lo que pasa al pulsarla.
 * @param {string} input.goIcon
 * @param {(() => void)|null} input.onClick Null: no se pulsa (el que ya va, en el tablón).
 * @returns {JQuery}
 */
function heroTile(hero, { go, goIcon, onClick }) {
    const tile = $('<button type="button" class="vt-card hb-card hb-hero"></button>')
        .attr('data-hero', hero.id)
        .attr('aria-label', `${go}. ${hero.name}, ${hero.what}. ${hero.carry}`)
        .toggleClass('is-active', hero.active)
        .on('click', () => { if (onClick) onClick(); });
    if (!onClick) tile.attr('aria-disabled', 'true');
    if (hero.face) tile.append(div('vt-face').append($('<img alt="">').attr('src', hero.face)));
    else {
        const bust = firstArt('hero', { className: hero.className, gender: hero.gender, name: hero.name, race: hero.race });
        tile.append(bust ? face(bust, hero.icon, true) : face(firstArt('class', { name: hero.className }), hero.icon));
    }
    tile.append(div('vt-name').text(hero.name));
    tile.append(div('vt-what').text(hero.what));
    tile.append(div(`hb-state ${hero.active ? 'hb-en-curso' : 'hb-nueva'}`).text(hero.active ? 'Va con el grupo' : 'En el gremio'));
    tile.append(div('vt-about hb-carry').text(hero.carry));
    tile.append(div('vt-go').append(`<i class="fa-solid ${goIcon}"></i>`).append($('<span></span>').text(go)));
    return tile;
}

/**
 * J1.6: la tarjeta de hacer uno más.
 *
 * @param {() => void} onClick
 * @returns {JQuery}
 */
function newHeroTile(onClick) {
    return $('<button type="button" class="vt-card vt-new hb-card hb-hero"></button>')
        .attr('data-hero-new', 'true')
        .attr('aria-label', 'Nuevo personaje. Lo haces tú; el de ahora se queda en el gremio con lo suyo.')
        .append(div('vt-face').append('<i class="fa-solid fa-user-plus"></i>'))
        .append(div('vt-name').text('Nuevo personaje'))
        .append(div('vt-about').text('Lo haces tú. El de ahora se queda en el gremio, con lo suyo.'))
        .append(div('vt-go').append('<i class="fa-solid fa-pen"></i>').append($('<span></span>').text('Crearlo')))
        .on('click', onClick);
}

/**
 * J18.1: con quién se entra al gremio. Tus personajes en tarjetas, y «Nuevo personaje».
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {import('../campaign/hub-heroes.js').HeroCard[]} input.heroes
 * @returns {Promise<{hero: string}|{create: true}|null>} Null: se sigue con el que iba.
 */
export async function openHeroChooser({ Popup, POPUP_TYPE, heroes }) {
    await loadPixelManifest();
    const body = div('vt-root hb-root');
    body.append(div('vt-head')
        .append($('<h3 class="vt-title"></h3>').text('¿Con quién entras?'))
        .append($('<p class="vt-sub"></p>').text('Tus personajes del gremio. El que no entra se queda aquí, con su nivel y su equipo.')));

    /** @type {any} */
    let popup = null;
    /** @type {{hero: string}|{create: true}|null} */
    let chosen = null;
    const grid = div('vt-grid hb-grid hb-heroes');
    for (const hero of heroes) {
        grid.append(heroTile(hero, {
            go: hero.active ? `Seguir con ${hero.name}` : `Entrar con ${hero.name}`,
            goIcon: 'fa-play',
            onClick: () => {
                chosen = hero.active ? null : { hero: hero.id };
                void popup?.completeCancelled();
            },
        }));
    }
    grid.append(newHeroTile(() => {
        chosen = { create: true };
        void popup?.completeCancelled();
    }));
    body.append(grid);

    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide: true, allowVerticalScrolling: true });
    await popup.show();
    return chosen;
}

/**
 * El tablón de campañas. Devuelve la elegida, o null.
 *
 * J1.6: con `heroes`, arriba va «Quién va»: tus personajes, para cambiar con quién se va a
 * la próxima campaña, y hacer uno más. Elegir uno devuelve `{hero}` o `{create}`, no una campaña.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {ReturnType<typeof import('../campaign/hub.js').hubCampaignCards>} input.cards
 * @param {import('../campaign/hub-heroes.js').HeroCard[]} [input.heroes]
 * @returns {Promise<string|{hero: string}|{create: true}|null>}
 */
export async function openHubBoard({ Popup, POPUP_TYPE, cards, heroes = [] }) {
    await loadPixelManifest();
    const body = div('vt-root hb-root');
    body.append(div('vt-head')
        .append($('<h3 class="vt-title"></h3>').text('El tablón de campañas'))
        .append($('<p class="vt-sub"></p>').text('Cada papel es una campaña entera. Tu grupo va entero y vuelve con lo que gane. Puedes volver al gremio cuando quieras y seguir donde lo dejaste.')));

    /** @type {any} */
    let popup = null;
    /** @type {string|{hero: string}|{create: true}|null} */
    let chosen = null;
    if (heroes.length > 0) {
        body.append(div('vt-section hb-section').text('Quién va'));
        body.append($('<p class="vt-note"></p>').text('Elige con quién vas. Los demás se quedan en el gremio, con su nivel y su equipo.'));
        const team = div('vt-grid vt-small hb-heroes');
        for (const hero of heroes) {
            team.append(heroTile(hero, {
                go: hero.active ? 'Va ahora' : `Que vaya ${hero.name}`,
                goIcon: hero.active ? 'fa-check' : 'fa-right-left',
                onClick: hero.active ? null : () => {
                    chosen = { hero: hero.id };
                    void popup?.completeCancelled();
                },
            }));
        }
        team.append(newHeroTile(() => {
            chosen = { create: true };
            void popup?.completeCancelled();
        }));
        body.append(team);
        body.append(div('vt-section hb-section').text('Las campañas'));
    }
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
        // Lo lejos que queda va con el género y los niveles: «Horror gótico · Para nivel 1 a 6 · A nueve días de camino».
        tile.append(div('vt-what').text([one.genre, one.levels, one.distance].filter(Boolean).join(' · ')));
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
    await loadPixelManifest();
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
            // Su retrato; si no lo tiene, el de relleno de su clase.
            art: firstArt('mercenary', { name: offer.name })
                || firstArt('hero', { className: offer.className, gender: /** @type {any} */ (offer).gender, name: offer.name }),
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
