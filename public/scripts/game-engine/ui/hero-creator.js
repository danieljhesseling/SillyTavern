/**
 * «¿Quién eres?», preguntado al entrar y no al rellenar el formulario del mundo.
 *
 * Antes se pedía una lista de nombres en el asistente, entre el género de la campaña y el
 * narrador, y de cada línea salía una ficha genérica. Hacerse un personaje es lo primero
 * que uno espera de un juego de rol y era el paso que menos lo parecía.
 *
 * Solo el nombre es obligatorio. Lo demás puede quedarse en blanco y decidirse jugando:
 * pedir doce campos antes de la primera frase es la mejor forma de que nadie llegue a la
 * primera frase.
 *
 * Dibuja y recoge. Las reglas están en `campaign/hero.js`.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 1.
 */

import {
    DEFAULT_RACES, DEFAULT_CLASSES, GENDERS, validateHero, describeHero,
    buildHeroPrompt, cleanHeroAbout,
} from '../campaign/hero.js';

/**
 * Un campo con su etiqueta, y una lista de sugerencias que no obliga a nada.
 *
 * Es un `datalist` y no un desplegable a propósito: las razas y las clases de este juego
 * son **datos del mundo**, así que escribir una que no esté en la lista tiene que poder
 * hacerse. Un desplegable diría que solo existen ocho.
 *
 * @param {string} label
 * @param {string[]} options
 * @param {string} placeholder
 * @param {string} cls
 * @returns {JQuery}
 */
function suggestField(label, options, placeholder, cls) {
    const id = `hc-list-${cls}`;
    const wrap = $('<label class="hc-field"></label>');
    wrap.append($('<span class="hc-label"></span>').text(label));

    const input = $(`<input type="text" class="text_pole hc-input ${cls}" />`)
        .attr('list', id)
        .attr('placeholder', placeholder);
    const list = $('<datalist></datalist>').attr('id', id);
    for (const option of options) list.append($('<option></option>').attr('value', option));

    wrap.append(input, list);
    return wrap;
}

/**
 * Abre la creación de personaje. Devuelve lo respondido, o null si se cierra.
 *
 * @param {Object} input
 * @param {string} [input.worldName]
 * @param {string[]} [input.races]   Las del mundo, si las tiene.
 * @param {string[]} [input.classes]
 * @param {string} [input.genre]
 * @param {((params: any) => Promise<string>)|null} [input.generate] La llamada al modelo,
 *        inyectada. Sin ella no hay varita, y se dice en vez de ofrecer un boton muerto.
 * @param {((file: File) => Promise<string>)|null} [input.uploadFace] Sube una imagen y
 *        devuelve la ruta con la que el juego la puede pintar.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any|null>}
 */
export async function openHeroCreator({
    worldName = '', races = [], classes = [], genre = '',
    generate = null, uploadFace = null, Popup, POPUP_TYPE,
}) {
    const root = $('<div class="hc-root"></div>');

    root.append($('<div class="hc-title"></div>').text('¿Quién eres?'));
    root.append($('<div class="hc-intro"></div>').text(
        worldName
            ? `Con este personaje entras en "${worldName}". Solo el nombre hace falta; lo demás se puede decidir jugando.`
            : 'Solo el nombre hace falta. Lo demás se puede decidir jugando.',
    ));

    const nameField = $('<label class="hc-field"></label>');
    nameField.append($('<span class="hc-label"></span>').text('Nombre'));
    const nameInput = $('<input type="text" class="text_pole hc-input hc-name" maxlength="60" />')
        .attr('placeholder', 'Lyra, Brand, la que no dice su nombre…');
    nameField.append(nameInput);
    root.append(nameField);

    const row = $('<div class="hc-row"></div>');
    row.append(suggestField('Género', GENDERS, 'Como se presenta', 'hc-gender'));
    row.append(suggestField('Raza', races.length > 0 ? races : DEFAULT_RACES, 'Humano, elfo…', 'hc-race'));
    row.append(suggestField('Clase', classes.length > 0 ? classes : DEFAULT_CLASSES, 'Guerrero, pícara…', 'hc-class'));
    root.append(row);

    const aboutField = $('<label class="hc-field"></label>');
    const aboutHead = $('<span class="hc-label hc-label-row"></span>');
    aboutHead.append($('<span></span>').text('Quién eres'));

    // La varita: lo escrito no es un borrador que pulir, es un **encargo**. Escribes «algo
    // triste sobre lo pobre que es» y te devuelve la ficha escrita.
    const wand = $('<button type="button" class="menu_button hc-wand"></button>')
        .append('<i class="fa-solid fa-wand-magic-sparkles"></i>')
        .append($('<span></span>').text(' Escríbelo por mí'));
    wand.attr('title', generate
        ? 'Escribe qué quieres —«algo triste sobre su pobreza»— y lo redacta'
        : 'Hace falta un proveedor de IA conectado');
    wand.prop('disabled', !generate);
    aboutHead.append(wand);

    aboutField.append(aboutHead);
    const aboutInput = $('<textarea class="text_pole hc-input hc-about" rows="3" maxlength="600"></textarea>')
        .attr('placeholder', 'De dónde vienes, qué se te da bien, qué callas. '
            + 'O dile a la varita qué quieres: «algo triste sobre su pobreza».');
    aboutField.append(aboutInput);
    root.append(aboutField);

    // La cara: se elige del disco. Pedir una ruta escrita a mano era pedir que alguien
    // supiera donde vive el servidor.
    const faceField = $('<label class="hc-field"></label>');
    faceField.append($('<span class="hc-label"></span>').text('Cara (opcional)'));

    const facePick = $('<div class="hc-face-row"></div>');
    const faceFile = $('<input type="file" class="hc-face-file" accept="image/*" />');
    const facePreview = $('<img class="hc-face-preview" alt="" />').hide();
    const faceValue = $('<input type="hidden" class="hc-face" />');
    facePick.append(faceFile, facePreview);
    faceField.append(facePick, faceValue);
    root.append(faceField);

    const warning = $('<div class="hc-warning"></div>').hide();
    root.append(warning);

    // Se sube al elegirla y no al guardar: si falla, te enteras mientras puedes cambiarla.
    faceFile.on('change', async () => {
        const file = /** @type {any} */ (faceFile[0])?.files?.[0];
        if (!file || !uploadFace) return;

        try {
            const path = await uploadFace(file);
            faceValue.val(path);
            facePreview.attr('src', path).show();
        } catch (error) {
            console.error('[hero] could not upload the face', error);
            warning.text('No se pudo guardar esa imagen. Puedes seguir sin cara.').show();
        }
    });

    wand.on('click', async () => {
        if (!generate) return;

        const asked = String(aboutInput.val() || '').trim();
        wand.prop('disabled', true);
        wand.find('span').text(' Escribiendo…');

        try {
            const { systemPrompt, prompt } = buildHeroPrompt({
                name: String(nameInput.val() || ''),
                gender: String(root.find('.hc-gender').val() || ''),
                race: String(root.find('.hc-race').val() || ''),
                className: String(root.find('.hc-class').val() || ''),
                about: asked,
            }, { worldName, genre });

            const answer = await generate({ prompt, systemPrompt, responseLength: 300 });
            const written = cleanHeroAbout(String(answer ?? ''));
            if (written) aboutInput.val(written);
            else warning.text('El modelo no devolvió nada. Prueba a decirle algo más concreto.').show();
        } catch (error) {
            console.error('[hero] the wand failed', error);
            warning.text('No se pudo escribir: mira que haya un proveedor conectado.').show();
        } finally {
            wand.prop('disabled', false);
            wand.find('span').text(' Escríbelo por mí');
        }
    });

    const answers = () => ({
        name: String(nameInput.val() || '').trim(),
        gender: String(root.find('.hc-gender').val() || '').trim(),
        race: String(root.find('.hc-race').val() || '').trim(),
        className: String(root.find('.hc-class').val() || '').trim(),
        about: String(aboutInput.val() || '').trim(),
        image: String(faceValue.val() || '').trim(),
    });

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Empezar',
        cancelButton: 'Ahora no',
        wide: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true;

            const problems = validateHero(answers());
            if (problems.length === 0) return true;

            warning.text(problems.join(' ')).show();
            return false;
        },
    });

    const result = await popup.show();
    if (result !== 1) return null;

    const hero = answers();
    console.log('[hero] created', describeHero(hero));
    return hero;
}
