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
import { resolveGender } from '../campaign/grammar.js';
import { HUB_NEXT_HERO_GOLD } from '../campaign/hub.js';

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
    // D-J11: el primero llega con cien de oro; los siguientes, con lo justo para la posada.
    const purse = `Empieza con ${HUB_NEXT_HERO_GOLD} de oro.`;
    return $('<button type="button" class="vt-card vt-new hb-card hb-hero"></button>')
        .attr('data-hero-new', 'true')
        .attr('aria-label', `Nuevo personaje. Lo haces tú. ${purse} El de ahora se queda en el gremio con lo suyo.`)
        .append(div('vt-face').append('<i class="fa-solid fa-user-plus"></i>'))
        .append(div('vt-name').text('Nuevo personaje'))
        .append(div('vt-about').text(`Lo haces tú. ${purse} El de ahora se queda en el gremio, con lo suyo.`))
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

/** @typedef {ReturnType<typeof import('../campaign/hub.js').hubCampaignCards>[number]} CampaignCard */

/** @typedef {{ok: true, card: CampaignCard, name: string, replaced: boolean, notes: string[]}} ImportDone */
/** @typedef {{ok: false, headline: string, problems: Array<{path: string, message: string}>, more: number, notes?: string[]}} ImportRefused */
/** @typedef {ImportDone|ImportRefused} ImportResult */

/** J5.4: lo más grande que se lee. Strahd, entero, pesa 120 KB. */
const MAX_CAMPAIGN_FILE = 20 * 1024 * 1024;

/**
 * La tarjeta de una campaña del tablón.
 *
 * D-J35: una añadida por ti lleva debajo «Quitar del tablón». Va fuera de la tarjeta (que es un
 * botón, y un botón no puede llevar otro dentro): las dos juntas, en su caja.
 *
 * @param {CampaignCard} one
 * @param {() => void} onClick
 * @param {(() => void)|null} [onRemove] Quitarla del tablón. Sin él, no se ofrece.
 * @param {any} [who] D-J17: quién va, para que la sinopsis le hable como toca («Eres una
 *   mercenaria…»). Sin él, la primera forma.
 * @returns {JQuery}
 */
function campaignTile(one, onClick, onRemove = null, who = {}) {
    const state = { nueva: 'Sin empezar', 'en-curso': 'En curso', terminada: 'Terminada' }[one.state];
    const tile = card({ icon: one.icon, label: [`${one.action} ${one.name}. ${state}.`, one.levels ? `${one.levels}.` : ''].filter(Boolean).join(' '), onClick })
        .attr('data-campaign', one.id);
    tile.append(div('vt-name').text(one.name));
    // Lo lejos que queda va con el género: «Horror gótico · A nueve días de camino».
    tile.append(div('vt-what').text([one.genre, one.distance].filter(Boolean).join(' · ')));
    // D-J22: el nivel recomendado, aparte y a la vista: las hay que empiezan en el 10. En
    // naranja si tu grupo no llega.
    if (one.levels) {
        tile.append(div('hb-levels').toggleClass('is-hard', Boolean(one.hard))
            .append('<i class="fa-solid fa-signal"></i>').append($('<span></span>').text(one.levels)));
    }
    tile.append(div(`hb-state hb-${one.state}`).text(one.ending ? `${state}: ${one.ending}` : state));
    if (one.note) tile.append(div('vt-pitch').text(one.note));
    if (one.synopsis) tile.append(div('vt-about').text(resolveGender(one.synopsis, who)));
    if (one.warn) tile.append(div('hb-warn').text(one.warn));
    tile.append(div('vt-go').append(`<i class="fa-solid ${one.state === 'nueva' ? 'fa-play' : 'fa-forward'}"></i>`)
        .append($('<span></span>').text(`${one.action}: ${one.name}`)));
    if (!one.imported || !onRemove) return tile;
    const remove = $('<button type="button" class="menu_button hb-remove"></button>')
        .attr('data-campaign-remove', one.id)
        .attr('aria-label', `Quitar ${one.name} del tablón`)
        .append('<i class="fa-solid fa-trash-can"></i>').append($('<span></span>').text('Quitar del tablón'))
        .on('click', onRemove);
    return div('hb-tile').attr('data-campaign-tile', one.id).append(tile, remove);
}

/**
 * J5.4: la tarjeta de añadir una campaña desde un archivo.
 *
 * @param {() => void} onClick
 * @returns {JQuery}
 */
function addCampaignTile(onClick) {
    return $('<button type="button" class="vt-card vt-new hb-card hb-add"></button>')
        .attr('data-campaign-add', 'true')
        .attr('aria-label', 'Añadir una campaña desde un archivo JSON: el paquete del juego o lo que te da tu Gem. También se puede pegar el texto, debajo.')
        .append(div('vt-face').append('<i class="fa-solid fa-file-import"></i>'))
        .append(div('vt-name').text('Añadir una campaña'))
        .append(div('vt-about').text('Desde un archivo JSON: el paquete del juego o el que te da tu Gem. Si lo tienes copiado, pégalo debajo. Se comprueba antes de guardarla, y sale en todos tus gremios.'))
        .append(div('vt-go').append('<i class="fa-solid fa-folder-open"></i>').append($('<span></span>').text('Elegir el archivo')))
        .on('click', onClick);
}

/**
 * J5.4: lo que ha pasado al añadir. Bien: cuál, y lo que se puso en limpio. Mal: por qué, con
 * lo que dice el validador, fallo a fallo, para arreglarlo o pasárselo al Gem.
 *
 * @param {JQuery} box
 * @param {ImportResult} result
 * @param {string} source De dónde venía, como se dice: «roto.json» o «el texto pegado».
 */
function showImport(box, result, source) {
    box.empty().removeClass('is-ok is-bad').addClass(result.ok ? 'is-ok' : 'is-bad').show();
    if (result.ok) {
        const done = /** @type {ImportDone} */ (result);
        box.append(div('hb-import-title').text(done.replaced
            ? `Puesta al día en el tablón: ${done.name}.`
            : `Añadida al tablón: ${done.name}. Ya se puede empezar.`));
        for (const note of done.notes ?? []) box.append(div('hb-import-note').text(note));
        return;
    }
    const refused = /** @type {ImportRefused} */ (result);
    box.append(div('hb-import-title').text(`No se ha podido añadir ${source}.`));
    box.append(div('hb-import-note').text(refused.headline));
    if (refused.problems.length === 0) return;
    const list = $('<ul class="hb-import-list"></ul>');
    for (const problem of refused.problems) {
        list.append($('<li></li>').text(problem.message).append(' ').append($('<code></code>').text(problem.path)));
    }
    if (refused.more > 0) list.append($('<li></li>').text(`… y ${refused.more} más.`));
    box.append(list);
    box.append(div('hb-import-note').text('Arréglalos en el archivo, o pásale esta lista a tu Gem: te devuelve la campaña corregida entera. Luego vuelve a añadirla.'));
}

/**
 * J5.4: añadir desde el gremio, lo de siempre: `campaigns.js` guarda el paquete y su fila.
 *
 * @param {string} content
 * @returns {Promise<ImportResult>}
 */
async function importCampaignFile(content) {
    const { importHubCampaign } = await import('../../campaigns.js');
    return /** @type {Promise<ImportResult>} */ (importHubCampaign(content));
}

/** @typedef {{ok: true, name: string}|{ok: false, headline: string}} RemoveResult */

/**
 * D-J35: quitar del tablón, lo de siempre: `campaigns.js` la saca de tu lista y borra su archivo.
 *
 * @param {string} id
 * @returns {Promise<RemoveResult>}
 */
async function removeCampaign(id) {
    const { removeHubCampaign } = await import('../../campaigns.js');
    return /** @type {Promise<RemoveResult>} */ (removeHubCampaign(id));
}

/**
 * Un texto dentro del HTML de una ventana de confirmar, sin que cuente como HTML.
 *
 * @param {string} value
 * @returns {string}
 */
const asHtml = (value) => $('<div></div>').text(value).html();

/**
 * El tablón de campañas. Devuelve la elegida, o null.
 *
 * J1.6: con `heroes`, arriba va «Quién va»: tus personajes, para cambiar con quién se va a
 * la próxima campaña, y hacer uno más. Elegir uno devuelve `{hero}` o `{create}`, no una campaña.
 *
 * J5.4: al final, «Añadir una campaña»: se elige un archivo, se comprueba y, si vale, su
 * tarjeta aparece en el tablón sin cerrarlo. Si no, se dice por qué debajo. D-J35: también
 * pegando el texto, y las añadidas se pueden quitar, con «Quitar del tablón».
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {ReturnType<typeof import('../campaign/hub.js').hubCampaignCards>} input.cards
 * @param {import('../campaign/hub-heroes.js').HeroCard[]} [input.heroes]
 * @param {(content: string) => Promise<ImportResult>} [input.onImport] Guardar una campaña
 *   leída de un archivo o pegada. Sin él, la guarda `campaigns.js` en tu lista.
 * @param {(id: string) => Promise<RemoveResult>} [input.onRemove] Quitar una añadida del
 *   tablón. Sin él, la quita `campaigns.js`.
 * @returns {Promise<string|{hero: string}|{create: true}|null>}
 */
export async function openHubBoard({ Popup, POPUP_TYPE, cards, heroes = [], onImport = importCampaignFile, onRemove = removeCampaign }) {
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
    /** @param {CampaignCard} one */
    const pick = (one) => () => {
        chosen = one.id;
        void popup?.completeCancelled();
    };
    // Lo que pasa al añadir o quitar se dice bajo las tarjetas.
    const report = div('hb-import').attr('role', 'status').hide();
    /**
     * D-J35: quitar una añadida del tablón, después de decir qué pasa.
     *
     * @param {CampaignCard} one
     */
    const unpin = (one) => async () => {
        const where = one.state === 'nueva' ? ''
            : ` En este gremio la tienes ${one.state === 'terminada' ? 'terminada' : 'empezada'}: para volver a ella desde el tablón, tendrás que añadirla otra vez.`;
        const sure = await Popup.show.confirm(`¿Quitar «${asHtml(one.name)}» del tablón?`,
            asHtml(`Deja de salir en el tablón de todos tus gremios, y se borra su archivo. Las partidas que ya empezaste con ella no se borran.${where}`),
            { okButton: 'Quitarla', cancelButton: 'Dejarla' });
        if (!sure) return;
        const result = await onRemove(one.id);
        report.empty().removeClass('is-ok is-bad').addClass(result.ok ? 'is-ok' : 'is-bad').show()
            .append(div('hb-import-title').text(result.ok
                ? `Quitada del tablón: ${/** @type {{name: string}} */ (result).name}.`
                : /** @type {{headline: string}} */ (result).headline));
        if (result.ok) grid.find(`[data-campaign-tile="${CSS.escape(one.id)}"]`).remove();
    };
    // D-J17: la sinopsis le habla a quien va ahora.
    const goes = heroes.find(hero => hero.active);
    const who = goes ? { heroe: goes.gender } : {};
    /** @param {CampaignCard} one */
    const tileOf = (one) => campaignTile(one, pick(one), unpin(one), who);
    for (const one of cards) grid.append(tileOf(one));
    const empty = cards.length === 0
        ? $('<p class="vt-note"></p>').text('El tablón está vacío: no hay campañas escritas. Puedes añadir la tuya.')
        : $();
    grid.append(empty);

    // J5.4: añadir una campaña desde un archivo; D-J35, o pegando su texto.
    const picker = $('<input type="file" accept=".json,application/json" hidden />');
    const addTile = addCampaignTile(() => { if (!addTile.hasClass('is-busy')) picker.trigger('click'); });
    /**
     * Comprobar y guardar lo leído; si vale, su tarjeta sale en el tablón sin cerrarlo.
     *
     * @param {() => Promise<ImportResult>} read
     * @param {string} source Cómo se dice de dónde viene: «molino.json» o «el texto pegado».
     * @returns {Promise<boolean>} Si se añadió.
     */
    const add = async (read, source) => {
        addTile.addClass('is-busy').find('.vt-go span').text('Comprobando…');
        try {
            const result = await read();
            showImport(report, result, source);
            if (result.ok) {
                const tile = tileOf(result.card);
                tile.find('.vt-card').addBack('.vt-card').addClass('is-new');
                const was = grid.find(`[data-campaign="${CSS.escape(result.card.id)}"]`);
                const box = was.closest('.hb-tile');
                if (was.length > 0) (box.length > 0 ? box : was).replaceWith(tile);
                else tile.insertBefore(addTile);
                empty.remove();
                tile[0].scrollIntoView({ block: 'nearest' });
            } else {
                report[0].scrollIntoView({ block: 'nearest' });
            }
            return result.ok;
        } catch (error) {
            console.error('[gremio] no se pudo leer la campaña', error);
            showImport(report, /** @type {ImportResult} */ ({ ok: false, headline: `No se pudo leer: ${String(/** @type {any} */ (error)?.message || error)}.`, problems: [], more: 0 }), source);
            return false;
        } finally {
            addTile.removeClass('is-busy').find('.vt-go span').text('Elegir el archivo');
        }
    };
    picker.on('change', async () => {
        const file = /** @type {HTMLInputElement} */ (picker[0]).files?.[0];
        // Vaciado, para que el mismo archivo arreglado se pueda elegir otra vez.
        picker.val('');
        if (!file) return;
        await add(async () => (file.size > MAX_CAMPAIGN_FILE
            ? /** @type {ImportResult} */ ({ ok: false, headline: 'Es demasiado grande para ser una campaña: más de 20 MB.', problems: [], more: 0 })
            : onImport(await file.text())), `«${file.name}»`);
    });
    grid.append(addTile);

    // D-J35: pegar el texto, para quien lo tiene copiado del chat de su Gem.
    const pasteText = $('<textarea class="text_pole hb-paste-text" rows="7"></textarea>')
        .attr('placeholder', 'Pega aquí la campaña tal cual te la da tu Gem: el JSON entero, desde la primera llave hasta la última.');
    const pasteAdd = $('<button type="button" class="menu_button hb-paste-add"></button>')
        .append('<i class="fa-solid fa-check"></i>').append($('<span></span>').text('Añadir lo pegado'));
    const pasteBox = div('hb-paste-box').append(pasteText, pasteAdd).hide();
    const pasteOpen = $('<button type="button" class="menu_button hb-paste-open"></button>')
        .append('<i class="fa-solid fa-paste"></i>').append($('<span></span>').text('Pegar el texto de una campaña'))
        .on('click', () => {
            pasteOpen.hide();
            pasteBox.show();
            pasteText.trigger('focus');
        });
    pasteAdd.on('click', async () => {
        if (pasteAdd.prop('disabled')) return;
        const content = String(pasteText.val() ?? '');
        if (!content.trim()) {
            showImport(report, /** @type {ImportResult} */ ({ ok: false, headline: 'No has pegado nada todavía.', problems: [], more: 0 }), 'el texto pegado');
            return;
        }
        pasteAdd.prop('disabled', true);
        const done = content.length > MAX_CAMPAIGN_FILE
            ? await add(async () => /** @type {ImportResult} */ ({ ok: false, headline: 'Es demasiado grande para ser una campaña: más de 20 MB.', problems: [], more: 0 }), 'el texto pegado')
            : await add(() => onImport(content), 'el texto pegado');
        pasteAdd.prop('disabled', false);
        if (done) pasteText.val('');
    });
    body.append(grid, div('hb-paste').append(pasteOpen, pasteBox), report, picker);
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
