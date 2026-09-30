/**
 * J20.6 de ROADMAP_SIN_CONEXION: las animaciones del juego, cortas en el móvil y ninguna si se
 * pide «reducir movimiento».
 *
 * Tres niveles:
 *
 * - `normal`: como siempre.
 * - `short`: la mitad. Es lo que toca en un teléfono (pantalla táctil): se juega a toques
 *   rápidos, y cada animación larga es batería y espera.
 * - `none`: nada se mueve; lo que se cuenta aparece de una vez. Lo pide el teléfono
 *   (`prefers-reduced-motion`), el ajuste de SillyTavern (`body.reduced-motion`) o las
 *   opciones del juego.
 *
 * En las opciones del juego se elige «Animaciones»: según el aparato (lo de arriba), normales,
 * cortas o ninguna. Lo elegido se pone en la página como `html[data-gs-motion]`, y
 * `css/movil-app.css` hace el resto. Lo que se anima desde el código (la tirada de dados) pide
 * su duración a `motionMs`.
 *
 * Sin que nadie llame a esto, la hoja ya respeta «reducir movimiento» y acorta en un teléfono:
 * mira las mismas preguntas con `@media`.
 */

/** Donde se guarda lo elegido. Es de este navegador, no de la partida. */
export const MOTION_KEY = 'sillytavern_gameMotion';

/** @typedef {'normal'|'short'|'none'} MotionLevel */
/** @typedef {{id: string, label: string, level: MotionLevel|null}} MotionChoice */

/** Lo que se elige en las opciones, en su orden. `level: null` es «según el aparato». @type {MotionChoice[]} */
export const MOTION_CHOICES = [
    { id: 'auto', label: 'Según el aparato', level: null },
    { id: 'normales', label: 'Normales', level: 'normal' },
    { id: 'cortas', label: 'Cortas', level: 'short' },
    { id: 'ninguna', label: 'Ninguna', level: 'none' },
];

/** Cuánto duran, con respecto a lo normal. */
const SCALE = Object.freeze({ normal: 1, short: 0.5, none: 0 });

/** Cómo se dice cada nivel, cuando lo decide el aparato. */
const LEVEL_LABEL = Object.freeze({ normal: 'normales', short: 'cortas', none: 'ninguna' });

/**
 * @typedef {Object} MotionEnv Lo que se mira. En las pruebas se pasa a mano.
 * @property {string} [stored] Lo guardado en `MOTION_KEY`.
 * @property {boolean} [reduced] El teléfono o SillyTavern piden reducir movimiento.
 * @property {boolean} [touch] Un aparato que se toca con el dedo (`pointer: coarse`).
 */

/**
 * @param {string} key
 * @returns {string}
 */
function stored(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? '';
    } catch {
        return '';
    }
}

/**
 * @param {string} query
 * @returns {boolean}
 */
function media(query) {
    try {
        return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(query).matches;
    } catch {
        return false;
    }
}

/** @returns {MotionEnv} */
function browserEnv() {
    const body = /** @type {any} */ (globalThis).document?.body;
    return {
        stored: stored(MOTION_KEY),
        reduced: media('(prefers-reduced-motion: reduce)') || Boolean(body?.classList?.contains('reduced-motion')),
        touch: media('(pointer: coarse)'),
    };
}

/**
 * Lo elegido, o «según el aparato» si no hay nada o no se entiende.
 *
 * @param {any} raw
 * @returns {MotionChoice}
 */
export function readMotionChoice(raw) {
    return MOTION_CHOICES.find(choice => choice.id === String(raw ?? '')) ?? MOTION_CHOICES[0];
}

/**
 * El nivel que toca. Lo elegido a mano manda; si no, reducir movimiento antes que el dedo.
 *
 * @param {MotionEnv} [env]
 * @returns {MotionLevel}
 */
export function motionLevel(env = browserEnv()) {
    const choice = readMotionChoice(env.stored);
    if (choice.level) return choice.level;
    if (env.reduced) return 'none';
    return env.touch ? 'short' : 'normal';
}

/**
 * Cuánto dura algo que normalmente dura `ms`. Con «ninguna», 0: se enseña de una vez.
 *
 * @param {number} ms
 * @param {MotionLevel} [level]
 * @returns {number}
 */
export function motionMs(ms, level = motionLevel()) {
    const base = Number(ms);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return Math.round(base * SCALE[level]);
}

/**
 * Pone el nivel en la página: `html[data-gs-motion]` y `--gs-motion-scale`.
 *
 * @param {HTMLElement|null} [target]
 * @param {MotionEnv} [env]
 * @returns {MotionLevel}
 */
export function applyMotion(target = /** @type {any} */ (globalThis).document?.documentElement ?? null, env = browserEnv()) {
    const level = motionLevel(env);
    if (target) {
        target.dataset.gsMotion = level;
        target.style.setProperty('--gs-motion-scale', String(SCALE[level]));
    }
    return level;
}

/**
 * Pasa a la siguiente opción, dando la vuelta al final; la guarda y la pone.
 *
 * @param {MotionEnv} [env]
 * @returns {MotionChoice}
 */
export function cycleMotion(env = browserEnv()) {
    const now = readMotionChoice(env.stored);
    const next = MOTION_CHOICES[(MOTION_CHOICES.indexOf(now) + 1) % MOTION_CHOICES.length];
    try {
        globalThis.localStorage?.setItem(MOTION_KEY, next.id);
    } catch { /* sin almacenamiento, vale para esta visita */ }
    applyMotion(undefined, { ...env, stored: next.id });
    return next;
}

/**
 * La fila de «Animaciones» para la ventana de opciones del juego (`game-options.js`).
 *
 * @param {MotionEnv} [env]
 * @returns {{id: string, icon: string, label: string, value: string, hint: string}}
 */
export function motionOptionRow(env = browserEnv()) {
    const choice = readMotionChoice(env.stored);
    const value = choice.level ? choice.label : `${choice.label}: ${LEVEL_LABEL[motionLevel(env)]}`;
    return {
        id: 'motion',
        icon: 'fa-wind',
        label: 'Animaciones',
        value,
        hint: 'Menos movimiento en pantalla: descansa la vista y gasta menos batería',
    };
}

/**
 * Vuelve a poner el nivel cuando cambia lo que pide el teléfono (activar «reducir movimiento»
 * con el juego abierto) o cuando se conecta un ratón a una tableta.
 *
 * @returns {() => void} Para dejar de mirar.
 */
export function watchMotion() {
    if (typeof globalThis.matchMedia !== 'function') return () => {};
    const queries = ['(prefers-reduced-motion: reduce)', '(pointer: coarse)'].map(q => globalThis.matchMedia(q));
    const update = () => { applyMotion(); };
    for (const query of queries) query.addEventListener?.('change', update);
    return () => {
        for (const query of queries) query.removeEventListener?.('change', update);
    };
}
