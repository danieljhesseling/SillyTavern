/**
 * El sonido del Modo Juego: una pista por escena, y silencio si no la has puesto.
 *
 * El director de escenas ya sabe si estás peleando, hablando o de viaje, así que lo único
 * que faltaba era decirle a algo que sonara distinto en cada caso. Es la pieza que menos
 * código lleva de todo lo que queda y la que más cambia cómo se siente la partida.
 *
 * **Las pistas las pones tú.** No trae ni un archivo: aquí no hay música con licencia de
 * nadie, hay cuatro casillas donde escribes una dirección — un archivo que sirva tu propio
 * SillyTavern, o una URL. Sin nada escrito, esto no suena y no molesta.
 *
 * Decide y suena, en ese orden y separado: `chooseTrack` es pura y se prueba; el
 * reproductor de abajo es cuatro líneas de `<audio>` que se callan solas si el navegador
 * no las deja sonar.
 *
 * Ver wiki/POR_HACER.md, A3.
 */

/** Dónde se guardan los ajustes. Son de esta máquina, no de la partida. */
export const SCENE_AUDIO_KEY = 'sillytavern_sceneAudio';

/** Las escenas que pueden sonar distinto, con el nombre que se lee en los ajustes. */
export const AUDIO_SCENES = [
    { id: 'title', label: 'Menú principal' },
    { id: 'dialogue', label: 'Conversación' },
    { id: 'exploration', label: 'Viaje y mapa' },
    { id: 'combat', label: 'Combate' },
];

/**
 * @typedef {Object} SceneAudioSettings
 * @property {boolean} enabled
 * @property {number} volume De 0 a 1.
 * @property {Record<string, string>} tracks Una dirección por escena.
 */

/**
 * Ajustes leídos de cualquier sitio, dejados en la forma que espera el reproductor.
 *
 * @param {any} raw
 * @returns {SceneAudioSettings}
 */
export function normalizeAudioSettings(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const volume = Number(source.volume);

    /** @type {Record<string, string>} */
    const tracks = {};
    for (const scene of AUDIO_SCENES) {
        const value = String(source.tracks?.[scene.id] ?? '').trim();
        if (value) tracks[scene.id] = value;
    }

    return {
        enabled: source.enabled !== false,
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.4,
        tracks,
    };
}

/**
 * Qué debería sonar en una escena, si es que algo.
 *
 * Una escena sin pista no hereda la de otra: sonar lo que no toca es peor que no sonar.
 *
 * @param {string} scene
 * @param {any} settings
 * @returns {string|null}
 */
export function chooseTrack(scene, settings) {
    const config = normalizeAudioSettings(settings);
    if (!config.enabled) return null;
    return config.tracks[String(scene)] || null;
}

/**
 * Los ajustes, contados en una línea.
 *
 * @param {any} settings
 * @returns {string}
 */
export function describeAudio(settings) {
    const config = normalizeAudioSettings(settings);
    if (!config.enabled) return 'El sonido está apagado.';

    const named = AUDIO_SCENES.filter(scene => config.tracks[scene.id]);
    if (named.length === 0) return 'No has puesto ninguna pista todavía.';
    return `Suena en: ${named.map(scene => scene.label).join(', ')} · volumen ${Math.round(config.volume * 100)}%.`;
}

/**
 * Lee los ajustes guardados en esta máquina.
 *
 * @returns {SceneAudioSettings}
 */
export function loadAudioSettings() {
    try {
        return normalizeAudioSettings(JSON.parse(window.localStorage.getItem(SCENE_AUDIO_KEY) || '{}'));
    } catch {
        return normalizeAudioSettings(null);
    }
}

/**
 * Guarda los ajustes en esta máquina.
 *
 * @param {any} settings
 * @returns {SceneAudioSettings}
 */
export function saveAudioSettings(settings) {
    const config = normalizeAudioSettings(settings);
    try {
        window.localStorage.setItem(SCENE_AUDIO_KEY, JSON.stringify(config));
    } catch (error) {
        console.warn('[scene-audio] no se pudieron guardar los ajustes', error);
    }
    return config;
}

/** El único elemento que suena. Uno, para que dos escenas no se solapen. */
let element = null;
/** Lo que está sonando ahora, para no reiniciar la misma pista en cada redibujado. */
let playing = '';

/**
 * Pone la pista de una escena, o calla si esa escena no tiene ninguna.
 *
 * Volver a pedir la misma pista no hace nada: el Shell se redibuja constantemente, y
 * reiniciar la música en cada turno de combate sería insufrible.
 *
 * @param {string} scene
 * @param {any} [settings]
 * @returns {string|null} Lo que ha quedado sonando.
 */
export function playForScene(scene, settings = null) {
    const track = chooseTrack(scene, settings ?? loadAudioSettings());
    const config = normalizeAudioSettings(settings ?? loadAudioSettings());

    if (typeof Audio === 'undefined') return null;

    if (!track) {
        stopSceneAudio();
        return null;
    }

    if (track === playing && element) {
        element.volume = config.volume;
        return track;
    }

    stopSceneAudio();
    element = new Audio(track);
    element.loop = true;
    element.volume = config.volume;
    playing = track;

    // Casi todos los navegadores se niegan a sonar antes de que alguien toque la página.
    // No es un error que haya que arreglar: es la regla, y el siguiente clic la levanta.
    const attempt = element.play();
    if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => console.info('[scene-audio] el navegador espera a que pulses algo antes de sonar'));
    }

    return track;
}

/** Para lo que esté sonando. */
export function stopSceneAudio() {
    if (element) {
        element.pause();
        element.src = '';
        element = null;
    }
    playing = '';
}

/** Lo que suena ahora mismo, o cadena vacía. Para las pruebas y para los ajustes. */
export function currentTrack() {
    return playing;
}
