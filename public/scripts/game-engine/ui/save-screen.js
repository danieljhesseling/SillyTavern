/**
 * La pantalla de guardar y cargar (J15.2 y J15.6 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Como la de un juego: las ranuras una debajo de otra, cada una con su tarjeta de guardado
 * (el dibujo del sitio, el día, dónde, qué tenéis entre manos, quién va y cuándo se guardó).
 * Arriba, las dos que se llenan solas: al dormir en el gremio y al empezar el día. Luego las
 * tres tuyas, con «Guardar aquí» y «Cargar». Debajo, los puntos de retorno de hoy, que vuelven
 * atrás dentro de la partida sin tocar la conversación. Y al pie, sacar la partida entera en
 * un archivo o meter una.
 *
 * Nada se pisa ni se carga sin preguntar antes, en llano: qué se pierde y adónde se vuelve.
 * La pregunta sale en una franja dentro de la misma ventana, no en otra encima.
 *
 * Se abre sola, sin `party.js`: es un `<dialog>` modal. No guarda nada: cada botón llama a
 * quien la abrió (`onSave`, `onLoad`…), que hace el trabajo y devuelve cómo decirlo; luego la
 * pantalla se vuelve a pintar con lo que haya (`getView`). Desde el título (`inGame: false`)
 * solo se carga, se exporta y se importa. Escape cierra.
 */

import { loadPixelManifest } from './pixel-art.js';
import { backdropFor } from './meetup-scene.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [content]
 * @returns {HTMLElement}
 */
function el(tag, className = '', content = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
}

/**
 * @param {string} className
 * @param {string} icon
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function button(className, icon, label) {
    const node = /** @type {HTMLButtonElement} */ (el('button', `menu_button sv-btn ${className}`));
    node.type = 'button';
    if (icon) node.appendChild(el('i', `fa-solid ${icon}`));
    node.appendChild(el('span', '', label));
    return node;
}

/**
 * Una ranura como se ve en la pantalla.
 *
 * @typedef {import('../campaign/save-slots.js').SlotCard & {saveAsk?: string, loadAsk?: string}} ScreenSlot
 */

/**
 * Lo que enseña la pantalla. Se pide otra vez después de cada cosa que se hace.
 *
 * @typedef {Object} SaveScreenView
 * @property {string} title
 * @property {string} [subtitle]
 * @property {boolean} inGame
 * @property {ScreenSlot[]} cards
 * @property {import('../campaign/save-slots.js').TodayPoint[]} [points] Los de hoy.
 * @property {import('../campaign/save-slots.js').TodayPoint[]} [earlier] Los de otros días.
 * @property {boolean} [canPoint] Si se puede dejar un punto ahora.
 * @property {string} [pointWhy] Por qué no, si no.
 * @property {boolean} [canExport]
 */

/**
 * Cómo ha ido lo que se pidió.
 *
 * @typedef {Object} ActionResult
 * @property {boolean} ok
 * @property {string} [message] La línea de estado.
 * @property {string[]} [lines] Más líneas, debajo.
 * @property {boolean} [close] Cerrar la pantalla (se ha cargado otra partida).
 * @property {{label: string, run: () => (void|Promise<void>)}} [play] Un botón para seguir (jugar la importada).
 */

/**
 * La pregunta de antes de volver a un punto.
 *
 * @param {import('../campaign/save-slots.js').TodayPoint} point
 * @returns {string}
 */
export function pointQuestion(point) {
    return `¿Volver a «${point.label}»${point.time ? `, de las ${point.time}` : ''}? `
        + 'El grupo y el mundo vuelven a como estaban entonces; lo dicho en la conversación se queda.';
}

/**
 * Abre la pantalla.
 *
 * @param {Object} input
 * @param {() => SaveScreenView|Promise<SaveScreenView>} input.getView
 * @param {(slotId: string) => Promise<ActionResult>} [input.onSave]
 * @param {(slotId: string) => Promise<ActionResult>} [input.onLoad]
 * @param {(pointId: string) => Promise<ActionResult>} [input.onPoint]
 * @param {() => Promise<ActionResult>} [input.onNewPoint]
 * @param {() => Promise<ActionResult>} [input.onExport]
 * @param {(content: string, fileName: string) => Promise<ActionResult>} [input.onImport]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<void>} Cuando se cierra.
 */
export async function openSaveScreen({ getView, onSave, onLoad, onPoint, onNewPoint, onExport, onImport, mount = null }) {
    await loadPixelManifest().catch(() => null);
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'sv-dialog'));
    dialog.setAttribute('aria-label', 'Guardar y cargar');
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();

    const root = el('div', 'sv-root');
    const head = el('div', 'sv-head');
    const titleBox = el('div', 'sv-titles');
    const title = el('h2', 'sv-title');
    const subtitle = el('div', 'sv-sub');
    titleBox.append(title, subtitle);
    const close = /** @type {HTMLButtonElement} */ (el('button', 'sv-close'));
    close.type = 'button';
    close.title = 'Cerrar (Esc)';
    close.setAttribute('aria-label', 'Cerrar');
    close.appendChild(el('i', 'fa-solid fa-xmark'));
    head.append(el('i', 'fa-solid fa-floppy-disk sv-head-icon'), titleBox, close);

    const status = el('div', 'sv-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const slots = el('div', 'sv-slots');
    const points = el('section', 'sv-points');
    const foot = el('div', 'sv-foot');
    const ask = el('div', 'sv-confirm');
    ask.hidden = true;
    const body = el('div', 'sv-body');
    body.append(slots, points, foot);
    root.append(head, status, body, ask);
    dialog.appendChild(root);

    const picker = /** @type {HTMLInputElement} */ (el('input', 'sv-file'));
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.hidden = true;
    root.appendChild(picker);

    let busy = false;
    /** @type {SaveScreenView|null} */
    let view = null;

    return new Promise(resolve => {
        const finish = () => {
            if (!dialog.open && !dialog.isConnected) return;
            dialog.close();
            dialog.remove();
            resolve();
        };
        close.addEventListener('click', () => { if (!busy) finish(); });
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            if (!ask.hidden) {
                ask.hidden = true;
                return;
            }
            if (!busy) finish();
        });

        /**
         * La línea de estado, y las de debajo.
         *
         * @param {string} line
         * @param {'info'|'ok'|'bad'|'busy'} [tone]
         * @param {string[]} [more]
         * @param {ActionResult['play']} [play]
         */
        const say = (line, tone = 'info', more = [], play = undefined) => {
            status.textContent = '';
            status.dataset.tone = tone;
            if (!text(line) && more.length === 0) return;
            if (tone === 'busy') status.appendChild(el('i', 'fa-solid fa-spinner fa-spin'));
            status.appendChild(el('span', 'sv-status-line', line));
            for (const extra of more) if (text(extra)) status.appendChild(el('div', 'sv-status-more', extra));
            if (play) {
                const go = button('sv-play', 'fa-play', play.label);
                go.addEventListener('click', async () => {
                    finish();
                    await play.run();
                });
                status.appendChild(go);
            }
        };

        /** Todo quieto mientras se trabaja: un doble clic no guarda dos veces. */
        const lock = (/** @type {boolean} */ on) => {
            busy = on;
            root.classList.toggle('sv-busy', on);
            for (const node of root.querySelectorAll('button')) {
                const b = /** @type {HTMLButtonElement} */ (node);
                if (on) {
                    b.dataset.wasDisabled = b.disabled ? '1' : '';
                    b.disabled = true;
                } else if (b.dataset.wasDisabled !== undefined) {
                    b.disabled = b.dataset.wasDisabled === '1';
                    delete b.dataset.wasDisabled;
                }
            }
        };

        /**
         * Pregunta en la franja de abajo; resuelve con la respuesta.
         *
         * @param {string} question
         * @param {string} yes
         * @returns {Promise<boolean>}
         */
        const confirm = (question, yes) => new Promise(answer => {
            ask.textContent = '';
            ask.appendChild(el('div', 'sv-confirm-text', question));
            const row = el('div', 'sv-confirm-row');
            const ok = button('sv-confirm-yes', 'fa-check', yes);
            const no = button('sv-confirm-no', 'fa-xmark', 'Mejor no');
            row.append(ok, no);
            ask.appendChild(row);
            ask.hidden = false;
            const done = (/** @type {boolean} */ value) => {
                ask.hidden = true;
                ask.textContent = '';
                answer(value);
            };
            ok.addEventListener('click', () => done(true));
            no.addEventListener('click', () => done(false));
            // Si se cierra la franja con Escape, es un no.
            const watch = new MutationObserver(() => {
                if (ask.hidden) {
                    watch.disconnect();
                    if (ask.childElementCount > 0) done(false);
                }
            });
            watch.observe(ask, { attributes: true, attributeFilter: ['hidden'] });
            ok.focus();
        });

        /**
         * Hace una cosa: pregunta si toca, avisa mientras, dice cómo ha ido y repinta.
         *
         * @param {string} doing «Guardando…»
         * @param {() => Promise<ActionResult|undefined>} work
         * @param {{question?: string, yes?: string}} [before]
         */
        const act = async (doing, work, before = {}) => {
            // Con una pregunta en pie, lo demás espera a que se conteste.
            if (busy || !ask.hidden) return;
            if (before.question && !(await confirm(before.question, before.yes ?? 'Sí'))) return;
            lock(true);
            say(doing, 'busy');
            /** @type {ActionResult} */
            let result = { ok: false, message: 'No ha pasado nada.' };
            try {
                result = (await work()) ?? { ok: true };
            } catch (error) {
                console.error('[guardar] algo ha fallado', error);
                result = { ok: false, message: `Algo ha fallado: ${String(/** @type {any} */ (error)?.message ?? error)}` };
            }
            lock(false);
            if (result.close && result.ok) {
                finish();
                return;
            }
            say(text(result.message), result.ok ? 'ok' : 'bad', result.lines ?? [], result.play);
            await render();
        };

        /**
         * Una ranura.
         *
         * @param {ScreenSlot} card
         * @param {boolean} inGame
         * @returns {HTMLElement}
         */
        const slotNode = (card, inGame) => {
            const node = el('article', `sv-slot${card.empty ? ' sv-empty' : ''}${card.auto ? ' sv-auto' : ''}`);
            node.dataset.slot = card.id;
            const art = el('div', 'sv-thumb');
            // El dibujo del sitio donde se quedó, si lo hay; si no, el icono de la ranura.
            const picture = card.empty || !card.place ? '' : backdropFor({ town: card.place });
            if (picture) {
                const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
                image.src = picture;
                image.alt = card.place || 'El sitio';
                image.addEventListener('error', () => {
                    image.remove();
                    art.appendChild(el('i', `fa-solid ${card.icon}`));
                });
                art.appendChild(image);
            } else {
                art.appendChild(el('i', `fa-solid ${card.icon}`));
            }
            const info = el('div', 'sv-info');
            const name = el('div', 'sv-name');
            name.append(el('i', `fa-solid ${card.icon}`), el('span', '', card.label));
            info.appendChild(name);
            if (card.hint) info.appendChild(el('div', 'sv-hint', card.hint));
            info.appendChild(el('div', 'sv-line', card.line));
            if (card.where) info.appendChild(el('div', 'sv-where', card.where));
            if (card.hero) info.appendChild(el('div', 'sv-hero', card.hero));
            if (card.when) info.appendChild(el('div', 'sv-when', card.when));

            const actions = el('div', 'sv-actions');
            if (inGame && !card.auto && onSave) {
                const save = button('sv-save', 'fa-floppy-disk', 'Guardar aquí');
                save.disabled = !card.canSave;
                if (card.saveWhy) {
                    save.title = card.saveWhy;
                    info.appendChild(el('div', 'sv-why', card.saveWhy));
                }
                save.addEventListener('click', () => act('Guardando la partida…', () => onSave(card.id), {
                    question: card.saveAsk, yes: 'Sí, guardar encima',
                }));
                actions.appendChild(save);
            }
            if (onLoad) {
                const load = button('sv-load', 'fa-folder-open', 'Cargar');
                load.disabled = !card.canLoad;
                load.addEventListener('click', () => act('Cargando la partida…', () => onLoad(card.id), {
                    question: card.loadAsk || `¿Cargar la ${card.label.toLowerCase()}?`, yes: 'Sí, cargar',
                }));
                actions.appendChild(load);
            }
            node.append(art, info, actions);
            return node;
        };

        /**
         * La lista de puntos.
         *
         * @param {import('../campaign/save-slots.js').TodayPoint[]} list
         * @returns {HTMLElement}
         */
        const pointList = (list) => {
            const ul = el('ul', 'sv-point-list');
            for (const point of list) {
                const li = el('li', 'sv-point');
                li.dataset.point = point.id;
                const label = el('span', 'sv-point-label', point.label);
                li.appendChild(label);
                if (point.time) li.appendChild(el('span', 'sv-point-time', point.time));
                if (point.automatic) li.appendChild(el('span', 'sv-point-auto', 'lo dejó el juego'));
                if (onPoint) {
                    const back = button('sv-point-back', 'fa-rotate-left', 'Volver');
                    back.addEventListener('click', () => act('Volviendo al punto…', () => onPoint(point.id), {
                        question: pointQuestion(point), yes: 'Sí, volver',
                    }));
                    li.appendChild(back);
                }
                ul.appendChild(li);
            }
            return ul;
        };

        const render = async () => {
            try {
                view = await getView();
            } catch (error) {
                console.error('[guardar] no se pudo leer', error);
                say('No se pueden leer las ranuras ahora.', 'bad');
                return;
            }
            const now = view;
            title.textContent = now.title || 'Guardar y cargar';
            subtitle.textContent = text(now.subtitle);
            subtitle.hidden = !text(now.subtitle);

            slots.textContent = '';
            for (const card of now.cards) slots.appendChild(slotNode(card, now.inGame));

            points.textContent = '';
            points.hidden = !now.inGame;
            if (now.inGame) {
                const top = el('div', 'sv-points-head');
                top.appendChild(el('h3', 'sv-points-title', 'Los puntos de hoy'));
                if (onNewPoint) {
                    const mark = button('sv-point-new', 'fa-flag', 'Dejar un punto aquí');
                    mark.disabled = now.canPoint === false;
                    if (now.pointWhy) mark.title = now.pointWhy;
                    mark.addEventListener('click', () => act('Dejando un punto…', () => onNewPoint()));
                    top.appendChild(mark);
                }
                points.appendChild(top);
                points.appendChild(el('p', 'sv-points-note',
                    'Un punto de retorno vuelve el grupo y el mundo a como estaban, dentro de esta partida. '
                    + 'La conversación no cambia. Van con la partida cuando la guardas en una ranura.'));
                const today = now.points ?? [];
                if (today.length === 0) points.appendChild(el('p', 'sv-points-empty', 'Hoy todavía no hay ninguno.'));
                else points.appendChild(pointList(today));
                const earlier = now.earlier ?? [];
                if (earlier.length > 0) {
                    const fold = /** @type {HTMLDetailsElement} */ (el('details', 'sv-earlier'));
                    fold.appendChild(el('summary', '', earlier.length === 1 ? 'Uno de otro día' : `${earlier.length} de otros días`));
                    fold.appendChild(pointList(earlier));
                    points.appendChild(fold);
                }
            }

            foot.textContent = '';
            if (onExport && now.canExport !== false) {
                const out = button('sv-export', 'fa-file-export', 'Exportar la partida');
                out.title = 'Un archivo con el gremio, tus personajes, las campañas y sus chats, para llevarla a otro ordenador.';
                out.addEventListener('click', () => act('Juntando la partida entera…', () => onExport()));
                foot.appendChild(out);
            }
            if (onImport) {
                const inn = button('sv-import', 'fa-file-import', 'Importar una partida');
                inn.title = 'Mete una partida exportada, al lado de las tuyas: no pisa ninguna.';
                inn.addEventListener('click', () => { if (!busy) picker.click(); });
                foot.appendChild(inn);
            }
            if (foot.childElementCount > 0) {
                foot.appendChild(el('div', 'sv-foot-note',
                    'Exportar saca la partida entera en un archivo: el gremio, tus personajes, las campañas y lo jugado. '
                    + 'Importarla la mete como una partida más, sin pisar ninguna.'));
            }
        };

        picker.addEventListener('change', () => {
            const file = picker.files?.[0];
            picker.value = '';
            if (!file || !onImport) return;
            void act('Leyendo la partida…', async () => onImport(await file.text(), file.name));
        });

        void render().then(() => {
            const first = /** @type {HTMLButtonElement|null} */ (root.querySelector('.sv-slot button:not([disabled])'));
            (first ?? close).focus();
        });
    });
}
