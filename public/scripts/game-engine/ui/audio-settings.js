/**
 * Los ajustes de sonido: cuatro casillas y un volumen.
 *
 * Una casilla por escena, y en cada una escribes de dónde sale la música. No hay
 * catálogo, ni descargas, ni un archivo incluido: son tus pistas, servidas por tu propio
 * SillyTavern o por donde quieras. Lo que no escribas, no suena.
 *
 * Dibuja y recoge; lo que decide qué suena está en `shell/scene-audio.js`.
 *
 * Ver wiki/POR_HACER.md, A3.
 */

import {
    AUDIO_SCENES, loadAudioSettings, saveAudioSettings, describeAudio, playForScene,
    stopSceneAudio,
} from './shell/scene-audio.js';

/**
 * Abre el panel. Guarda al cerrar, y no antes: probar una pista no debería dejarla puesta
 * si al final cierras sin querer cambiarla.
 *
 * @param {{Popup: any, POPUP_TYPE: any}} deps
 * @returns {Promise<string>}
 */
export async function openAudioSettings({ Popup, POPUP_TYPE }) {
    const settings = loadAudioSettings();

    const root = $('<div class="as-root"></div>');
    root.append($('<div class="as-intro"></div>').text(
        'Una pista por escena. Escribe una dirección de tu servidor (por ejemplo '
        + '"user/files/taberna.mp3") o una URL completa. Lo que dejes vacío, no suena.',
    ));

    const enabled = $('<input type="checkbox" />').prop('checked', settings.enabled);
    root.append($('<label class="as-enabled"></label>').append(enabled).append(
        $('<span></span>').text(' Sonido del Modo Juego encendido')));
    // Idea 186: el golpe, el fallo, la puerta. No traen archivos: se hacen al momento.
    const effects = $('<input type="checkbox" class="as-effects" />').prop('checked', settings.effects);
    root.append($('<label class="as-enabled"></label>').append(effects).append(
        $('<span></span>').text(' Sonidos de cada acción (golpe, fallo, puerta, monedas)')));

    /** @type {Record<string, JQuery>} */
    const inputs = {};
    const list = $('<div class="as-scenes"></div>');
    for (const scene of AUDIO_SCENES) {
        const row = $('<div class="as-scene"></div>');
        row.append($('<label class="as-scene-name"></label>').text(scene.label));

        const input = $('<input type="text" class="text_pole as-track" />')
            .val(settings.tracks[scene.id] ?? '')
            .attr('placeholder', 'vacío = en silencio');
        inputs[scene.id] = input;
        row.append(input);

        // Probar suena de verdad: una dirección mal escrita se descubre aquí y no en
        // mitad de un combate.
        const test = $('<button class="menu_button as-test" type="button"></button>')
            .attr('title', 'Probar esta pista')
            .append('<i class="fa-solid fa-play"></i>');
        test.on('click', () => {
            const track = String(input.val() ?? '').trim();
            if (!track) return;
            playForScene(scene.id, {
                enabled: true,
                volume: Number(volume.val()) / 100,
                tracks: { [scene.id]: track },
            });
        });
        row.append(test);
        list.append(row);
    }
    root.append(list);

    const volume = $('<input type="range" min="0" max="100" class="as-volume" />')
        .val(Math.round(settings.volume * 100));
    const volumeLabel = $('<span class="as-volume-value"></span>').text(`${Math.round(settings.volume * 100)}%`);
    volume.on('input', () => volumeLabel.text(`${Number(volume.val())}%`));
    root.append($('<div class="as-volume-row"></div>')
        .append($('<label></label>').text('Volumen'))
        .append(volume)
        .append(volumeLabel));

    const stop = $('<button class="menu_button as-stop" type="button"></button>').text('Callar');
    stop.on('click', () => stopSceneAudio());
    root.append(stop);

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, null, {
        okButton: 'Guardar', cancelButton: 'Cancelar', wider: true,
    });

    const result = await popup.show();
    stopSceneAudio();
    if (!result) return describeAudio(settings);

    /** @type {Record<string, string>} */
    const tracks = {};
    for (const scene of AUDIO_SCENES) tracks[scene.id] = String(inputs[scene.id].val() ?? '').trim();

    const saved = saveAudioSettings({
        enabled: enabled.prop('checked'),
        volume: Number(volume.val()) / 100,
        tracks,
        effects: effects.prop('checked'),
    });

    return describeAudio(saved);
}
