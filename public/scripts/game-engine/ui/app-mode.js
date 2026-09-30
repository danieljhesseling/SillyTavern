/**
 * J20.7 de ROADMAP_SIN_CONEXION: el juego como una app del móvil.
 *
 * Dos cosas, las dos pequeñas:
 *
 * 1. **Lo que dice el manifiesto**: el nombre bajo el icono, los colores de la pantalla de
 *    carga, los iconos y por dónde se entra. Sale de `APP_INFO`, y `tools/app-movil.mjs` lo
 *    escribe en `public/juego.webmanifest`. El nombre es provisional hasta que Daniel lo decida
 *    (D-J9): se cambia aquí, se pasa la herramienta y ya está.
 * 2. **Lo que el juego hace al abrirse desde el icono**: entra directo en su portada aunque
 *    «Abrir el juego al entrar» esté apagado, y marca la página (`html.gs-app`) para que
 *    `css/movil-app.css` deje sitio a la muesca y a la barra del teléfono.
 *
 * Nada de esto toca la partida: es cómo se abre la página.
 */

/**
 * @typedef {Object} AppInfo
 * @property {string} name El nombre entero: la pantalla de carga y la lista de apps.
 * @property {string} shortName El que cabe bajo el icono (unas 12 letras).
 * @property {string} description
 * @property {string} lang
 * @property {string} background El fondo de la pantalla de carga.
 * @property {string} theme La barra del teléfono.
 * @property {string} startParam Lo que lleva la dirección al entrar desde el icono: `/?juego`.
 * @property {'fullscreen'|'standalone'} display
 */

/** @type {Readonly<AppInfo>} */
export const APP_INFO = Object.freeze({
    // D-J9: hasta que Daniel le ponga nombre, «SillyTavern RPG».
    name: 'SillyTavern RPG',
    shortName: 'ST RPG',
    description: 'Un juego de rol de fantasía oscura: tu gremio, tus compañeros y sus campañas. Se juega sin conexión.',
    lang: 'es',
    // La pantalla de carga, del fondo del icono (el escudo sobre gris casi negro): el icono y
    // la pantalla son una sola cosa, y no destella en blanco.
    background: '#1a181b',
    // La barra del teléfono, del fondo del juego (`--gs-bg-dark` en game-shell.css).
    theme: '#12100e',
    startParam: 'juego',
    // A pantalla entera: sin la barra del navegador ni la del teléfono. Donde no se puede
    // (el iPhone), el navegador baja solo a «standalone».
    display: 'fullscreen',
});

/**
 * @typedef {Object} AppIcon
 * @property {string} src Desde `public/`.
 * @property {number} size
 * @property {'any'|'maskable'} purpose
 */

/**
 * El icono del juego (el escudo con la espada, hecho con PixelLab), en
 * `public/img/game-engine/pixel/app/`:
 *
 * - `icono-192` e `icono-512`: los de siempre (Android los pide en estos dos tamaños).
 * - `icono-maskable-512`: el mismo con más fondo, para los Android que recortan el icono en
 *   círculo o en gota; el escudo y la espada quedan dentro del círculo del centro.
 *
 * @type {ReadonlyArray<Readonly<AppIcon>>}
 */
export const ART_ICONS = Object.freeze([
    Object.freeze({ src: 'img/game-engine/pixel/app/icono-192.png', size: 192, purpose: /** @type {const} */ ('any') }),
    Object.freeze({ src: 'img/game-engine/pixel/app/icono-512.png', size: 512, purpose: /** @type {const} */ ('any') }),
    Object.freeze({ src: 'img/game-engine/pixel/app/icono-maskable-512.png', size: 512, purpose: /** @type {const} */ ('maskable') }),
]);

/**
 * Los de repuesto, si faltara el icono del juego: el guerrero de las clases, ampliado píxel a
 * píxel sobre el fondo del juego. Los hace `tools/app-movil.mjs`, en `img/game-engine/app/`.
 *
 * @type {ReadonlyArray<Readonly<AppIcon>>}
 */
export const FALLBACK_ICONS = Object.freeze([
    Object.freeze({ src: 'img/game-engine/app/icono-192.png', size: 192, purpose: /** @type {const} */ ('any') }),
    Object.freeze({ src: 'img/game-engine/app/icono-512.png', size: 512, purpose: /** @type {const} */ ('any') }),
    Object.freeze({ src: 'img/game-engine/app/icono-mascara-512.png', size: 512, purpose: /** @type {const} */ ('maskable') }),
]);

/**
 * El icono del iPhone (`apple-touch-icon`, 180 × 180), sacado del de 512 por
 * `tools/app-movil.mjs`. Sin transparencias: el iPhone las pinta de negro.
 */
export const APPLE_ICON = Object.freeze({ src: 'img/game-engine/app/icono-180.png', size: 180 });

/** Donde se escribe el manifiesto, desde `public/`. */
export const MANIFEST_FILE = 'juego.webmanifest';

/**
 * La dirección por la que se entra desde el icono, relativa al manifiesto (que está en la
 * raíz): `./?juego`, es decir, `/?juego`.
 *
 * @param {AppInfo} [info]
 * @returns {string}
 */
export function appStartUrl(info = APP_INFO) {
    return `./?${info.startParam}`;
}

/**
 * El manifiesto de la app, tal y como se escribe en `public/juego.webmanifest`.
 *
 * El orden de las claves es fijo: la herramienta lo compara con el escrito (`--check`).
 *
 * @param {AppInfo} [info]
 * @param {ReadonlyArray<AppIcon>} [icons] Los del juego; los de repuesto si faltaran.
 * @returns {Record<string, any>}
 */
export function buildWebManifest(info = APP_INFO, icons = ART_ICONS) {
    return {
        id: appStartUrl(info),
        name: info.name,
        short_name: info.shortName,
        description: info.description,
        lang: info.lang,
        dir: 'ltr',
        start_url: appStartUrl(info),
        scope: './',
        display: info.display,
        display_override: [info.display, 'standalone'].filter((mode, at, all) => all.indexOf(mode) === at),
        // De pie y tumbado (J20.1): el juego se ve bien de las dos maneras.
        orientation: 'any',
        background_color: info.background,
        theme_color: info.theme,
        categories: ['games'],
        prefer_related_applications: false,
        icons: icons.map(icon => ({
            src: icon.src,
            sizes: `${icon.size}x${icon.size}`,
            type: 'image/png',
            purpose: icon.purpose,
        })),
    };
}

/**
 * @typedef {Object} AppEnv Lo que se mira de la página. En las pruebas se pasa a mano.
 * @property {string} [search] `location.search`.
 * @property {boolean} [standalone] `navigator.standalone`: el iPhone lo pone a `true` desde el icono.
 * @property {((query: string) => {matches: boolean}|null|undefined)|null} [matchMedia]
 */

/** @returns {AppEnv} */
function browserEnv() {
    const scope = /** @type {any} */ (globalThis);
    return {
        search: String(scope.location?.search ?? ''),
        standalone: scope.navigator?.standalone === true,
        matchMedia: typeof scope.matchMedia === 'function' ? (/** @type {string} */ query) => scope.matchMedia(query) : null,
    };
}

/**
 * Si la página se ha abierto como app: desde el icono (la dirección lleva `?juego`), o a
 * pantalla entera sin la barra del navegador.
 *
 * `display-mode: fullscreen` no cuenta solo: también es un ordenador con F11. Desde el icono
 * de Android ya entra por `?juego`; el iPhone, que a veces abre la dirección en la que
 * estabas al añadirlo, se reconoce por `standalone`.
 *
 * @param {AppEnv} [env]
 * @returns {boolean}
 */
export function launchedAsApp(env = browserEnv()) {
    let byUrl = false;
    try {
        byUrl = new URLSearchParams(String(env.search ?? '')).has(APP_INFO.startParam);
    } catch {
        byUrl = false;
    }
    if (byUrl || env.standalone === true) return true;
    if (typeof env.matchMedia !== 'function') return false;
    for (const mode of ['standalone', 'minimal-ui']) {
        try {
            if (env.matchMedia(`(display-mode: ${mode})`)?.matches) return true;
        } catch { /* un navegador que no lo entiende: no es una app */ }
    }
    return false;
}

/**
 * Marca la página si se ha abierto como app: `html.gs-app`, para la hoja `movil-app.css`, y
 * la barra del teléfono del color del juego (SillyTavern la pinta del color de su tema).
 *
 * @param {Document|null} [doc]
 * @param {AppEnv} [env]
 * @returns {boolean} Si es una app.
 */
export function markAppMode(doc = /** @type {any} */ (globalThis).document ?? null, env = browserEnv()) {
    const on = launchedAsApp(env);
    if (!doc?.documentElement) return on;
    doc.documentElement.classList.toggle('gs-app', on);
    if (on) doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_INFO.theme);
    return on;
}
