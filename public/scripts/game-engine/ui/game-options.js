/**
 * J0.4 de ROADMAP_SIN_CONEXION: las opciones del juego, no las de SillyTavern.
 *
 * Lo que se decide para este navegador (quién cuenta, los sucesos, el tamaño y la velocidad
 * del texto, los colores, el sonido y si el juego se abre solo) en una ventana del juego,
 * con las palabras del juego. Los ajustes de SillyTavern siguen al fondo, pero solo con
 * conexión: sin ella no hay modelo que configurar, y el panel de la API solo despista.
 *
 * Aquí se dibuja y se guarda el texto; lo demás lo decide quien abre la ventana.
 */

export const TEXT_SIZE_KEY = 'sillytavern_gameTextSize';
export const TEXT_SPEED_KEY = 'sillytavern_gameTextSpeed';

/** @typedef {{id: string, label: string, scale: number}} TextSize */
/** @typedef {{id: string, label: string, seconds: number}} TextSpeed */

/** @type {TextSize[]} */
export const TEXT_SIZES = [
    { id: 'normal', label: 'Normal', scale: 1 },
    { id: 'grande', label: 'Grande', scale: 1.15 },
    { id: 'enorme', label: 'Muy grande', scale: 1.3 },
];

/** Cómo aparece lo que se cuenta en la caja de la novela visual. @type {TextSpeed[]} */
export const TEXT_SPEEDS = [
    { id: 'momento', label: 'Al momento', seconds: 0 },
    { id: 'suave', label: 'Suave', seconds: 0.5 },
    { id: 'pausada', label: 'Pausada', seconds: 1.2 },
];

/**
 * La opción guardada, o la primera si no hay ninguna o no se entiende.
 *
 * @template {{id: string}} T
 * @param {T[]} list
 * @param {any} raw
 * @returns {T}
 */
export function readChoice(list, raw) {
    return list.find(choice => choice.id === String(raw ?? '')) ?? list[0];
}

/**
 * La siguiente, dando la vuelta al final.
 *
 * @template {{id: string}} T
 * @param {T[]} list
 * @param {any} raw
 * @returns {T}
 */
export function nextChoice(list, raw) {
    const at = list.indexOf(readChoice(list, raw));
    return list[(at + 1) % list.length];
}

/** @param {string} key */
function stored(key) {
    try {
        return localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
}

/**
 * @param {string} key
 * @param {string} value
 */
function store(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch { /* sin almacenamiento, vale para esta visita */ }
}

/** @returns {{size: TextSize, speed: TextSpeed}} */
export function textOptions() {
    return { size: readChoice(TEXT_SIZES, stored(TEXT_SIZE_KEY)), speed: readChoice(TEXT_SPEEDS, stored(TEXT_SPEED_KEY)) };
}

/**
 * Pone el tamaño y la velocidad en la página, como variables de CSS.
 *
 * @param {HTMLElement} [target]
 * @param {{size: TextSize, speed: TextSpeed}} [chosen]
 */
export function applyTextOptions(target = document.documentElement, chosen = textOptions()) {
    target.style.setProperty('--gs-text-scale', String(chosen.size.scale));
    target.style.setProperty('--gs-text-speed', `${chosen.speed.seconds}s`);
    target.dataset.gsTextSpeed = chosen.speed.id;
}

/**
 * Pasa el tamaño o la velocidad a la siguiente, la guarda y la pone.
 *
 * @param {'size'|'speed'} which
 * @returns {TextSize|TextSpeed}
 */
export function cycleTextOption(which) {
    const now = textOptions();
    if (which === 'size') {
        const next = nextChoice(TEXT_SIZES, now.size.id);
        store(TEXT_SIZE_KEY, next.id);
        applyTextOptions(undefined, { ...now, size: next });
        return next;
    }
    const next = nextChoice(TEXT_SPEEDS, now.speed.id);
    store(TEXT_SPEED_KEY, next.id);
    applyTextOptions(undefined, { ...now, speed: next });
    return next;
}

/**
 * @typedef {Object} OptionRow
 * @property {string} id
 * @property {string} label Lo que es: «Tamaño del texto».
 * @property {string} value Cómo está: «Grande».
 * @property {string} [hint]
 * @property {string} [icon] Una clase de FontAwesome.
 */

/**
 * La ventana. Cada fila se pulsa para cambiarla; la fila dice cómo queda.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {() => OptionRow[]} input.rows Se vuelve a pedir tras cada cambio.
 * @param {(id: string) => (void|Promise<void>)} input.onPick
 * @param {(() => void)|null} [input.onAdvanced] Los ajustes de SillyTavern; sin esto no salen.
 * @returns {Promise<void>}
 */
export async function openGameOptions({ Popup, POPUP_TYPE, rows, onPick, onAdvanced = null }) {
    const root = $('<div class="go-root"></div>');
    root.append($('<h3 class="go-title"></h3>').text('Opciones'));
    const list = $('<div class="go-list"></div>');
    root.append(list);

    const draw = () => {
        list.empty();
        for (const row of rows()) {
            const button = $('<button type="button" class="go-row"></button>').attr('data-option', row.id);
            button.append($('<i></i>').addClass(`fa-solid fa-fw ${row.icon || 'fa-sliders'}`));
            const body = $('<span class="go-body"></span>');
            body.append($('<span class="go-label"></span>').text(row.label));
            if (row.hint) body.append($('<span class="go-hint"></span>').text(row.hint));
            button.append(body);
            button.append($('<span class="go-value"></span>').text(row.value));
            list.append(button);
        }
    };
    let busy = false;
    list.on('click', '.go-row', async function () {
        if (busy) return;
        busy = true;
        try {
            await onPick(String($(this).attr('data-option')));
        } finally {
            busy = false;
            draw();
        }
    });
    draw();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', cancelButton: false, allowVerticalScrolling: true });
    if (onAdvanced) {
        const advanced = $('<button type="button" class="go-advanced"></button>')
            .append('<i class="fa-solid fa-plug"></i>')
            .append($('<span></span>').text('Ajustes de SillyTavern: la conexión y el modelo'));
        advanced.on('click', () => {
            void popup.completeCancelled();
            onAdvanced();
        });
        root.append(advanced);
    }
    await popup.show();
}
