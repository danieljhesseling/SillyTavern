/**
 * La conversación en su ventana (J8.4 de wiki/ROADMAP_SIN_CONEXION.md): una charla con ramas
 * (`campaign/dialogues.js`) jugada como una escena de novela visual.
 *
 * Quien habla sale grande, con la cara que toca (`alegre`, `enfadado`, `triste`); su nombre en
 * la placa; lo que dice en la caja de abajo, y lo que puedes contestar como fichas numeradas.
 * Lo que depende de quién eres lleva su etiqueta delante («[Enano] …»); lo que todavía no se
 * puede decir sale apagado, con el porqué debajo; una tirada dice cuál y contra cuánto. Detrás,
 * el sitio donde estáis, apagado.
 *
 * El mismo marco que la quedada (`meetup-scene.js`, las clases `qd-*` de quedadas.css), para
 * que hablar con Brunilda y quedar con Bran se vean igual; lo propio va en dialogos.css.
 *
 * Se abre sola, sin `party.js`: es un `<dialog>` modal encima de lo que haya. Juega la charla
 * con el motor (`startDialogue`, `choose`) y lo que eso cambia lo aplica quien la abrió, con
 * `applyEffects`: la ventana solo dice lo que ha pasado. Teclas: del 1 al 9 eligen, Intro
 * cierra al final y Escape se despide.
 */

import {
    startDialogue, choose, dialogueView, rememberDialogue, describeDialogueEffect,
} from '../campaign/dialogues.js';
import { describeAttitude } from '../campaign/attitudes.js';
import { loadPixelManifest } from './pixel-art.js';
import { portraitFor, backdropFor } from './meetup-scene.js';

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
 * @typedef {Object} OptionChip
 * @property {string} id
 * @property {string} key La tecla: del 1 al 9, o vacío.
 * @property {string} tag «[Enano]», o vacío.
 * @property {string} label Lo que se dice.
 * @property {string} check «Persuasión · CD 13», o vacío.
 * @property {string} locked Por qué no se puede, o vacío.
 * @property {boolean} ends Si acaba la charla.
 */

/**
 * Las fichas de las opciones, como se ven: la tecla, la etiqueta, lo que se dice, la tirada y,
 * si está cerrada, por qué. Las que se pueden elegir se numeran primero.
 *
 * @param {import('../campaign/dialogues.js').DialogueView} view
 * @returns {OptionChip[]}
 */
export function optionChips(view) {
    let key = 0;
    return (view?.options ?? []).map(option => ({
        id: option.id,
        key: !option.locked && key < 9 ? String(++key) : '',
        tag: option.tag ? `[${option.tag}]` : '',
        label: option.text,
        check: option.check ? `${option.check.label} · CD ${option.check.dc}` : '',
        locked: option.locked,
        ends: option.ends,
    }));
}

/**
 * Las líneas de la caja de un paso: lo que dijiste, la tirada, lo que te contesta y lo que ha
 * pasado (los efectos, en llano).
 *
 * @param {import('../campaign/dialogues.js').DialogueState} state
 * @param {number} from Desde qué línea del registro son de este paso.
 * @param {string[]} [notes]
 * @returns {Array<{kind: 'you'|'roll'|'say'|'note', text: string}>}
 */
export function stepLines(state, from, notes = []) {
    /** @type {Array<{kind: 'you'|'roll'|'say'|'note', text: string}>} */
    const lines = [];
    for (const entry of state.log.slice(Math.max(0, from))) {
        if (entry.kind === 'hero') lines.push({ kind: 'you', text: entry.text });
        else if (entry.kind === 'roll') lines.push({ kind: 'roll', text: entry.text });
        else if (entry.kind === 'npc') lines.push({ kind: 'say', text: entry.text });
    }
    for (const note of notes) if (text(note)) lines.push({ kind: 'note', text: text(note) });
    return lines;
}

/**
 * @typedef {Object} DialogueWindowResult
 * @property {boolean} ended Si la charla acabó (y no se dejó a medias).
 * @property {import('../campaign/dialogues.js').DialogueState} state
 * @property {any} memory Lo recordado de todas las charlas, con esta dentro.
 * @property {string} [extra] El id de la ficha de fuera de la charla que se pulsó («convencer»).
 */

/**
 * Jugar una charla con ramas en pantalla.
 *
 * @param {Object} input
 * @param {import('../campaign/dialogues.js').Dialogue} input.dialogue Ya leída (`readDialogue`).
 * @param {any} input.hero Quien habla: su ficha tira y su género concuerda.
 * @param {() => import('../campaign/dialogues.js').DialogueWorld} [input.getWorld] Cómo está la
 *   partida ahora: se pide en cada paso, porque lo que se aplica (cómo os mira, el oro) cambia
 *   lo que se puede decir después.
 * @param {any} [input.memory] Lo recordado de las charlas (`readDialogueMemory`).
 * @param {() => number} [input.rollD20]
 * @param {(effects: import('../campaign/dialogues.js').DialogueEffect[], context: {dialogue: any, state: any, roll: any}) => (string[]|void|Promise<string[]|void>)} [input.applyEffects]
 *   Lo aplica quien abre la ventana, y devuelve cómo decirlo; sin nada, se dice en llano. Con
 *   `roll`, la tirada de ese paso (la de `rollCheck`), para su registro de dados.
 * @param {(memory: any) => void} [input.onMemory] Para guardar lo recordado en cada paso.
 * @param {Array<{id: string, label: string, icon?: string, title?: string}>} [input.extras] Fichas de
 *   fuera de la charla (sonsacar, convencer…): cierran la ventana y dicen cuál se pulsó.
 * @param {string} [input.pack] El paquete, para el retrato y el escenario.
 * @param {string} [input.place] El sitio del pueblo (`posada`…), para el fondo.
 * @param {string} [input.town] La localización, si el sitio no tiene dibujo.
 * @param {boolean} [input.night]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<DialogueWindowResult>}
 */
export async function openDialogueWindow({
    dialogue, hero, getWorld = () => ({}), memory = null, rollD20 = () => 1 + Math.floor(Math.random() * 20),
    applyEffects = () => [], onMemory = () => {}, extras = [], pack = '', place = '', town = '', night = false, mount = null,
}) {
    await loadPixelManifest();
    const speaker = text(dialogue?.speaker) || 'Alguien';
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'qd-dialog dw-dialog'));
    dialog.setAttribute('aria-label', `Conversación con ${speaker}`);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();

    const root = el('div', 'qd-root dw-root');
    root.dataset.dialogue = text(dialogue?.id);
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ place, town, pack, night });
    // Entera: una URL relativa dentro de una variable se lee desde la hoja que la usa (css/).
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait dw-portrait');
    const box = el('div', 'qd-box dw-box');
    const plate = el('div', 'qd-nameplate', speaker);
    const head = el('div', 'qd-head');
    const title = el('span', 'qd-title', text(dialogue?.title));
    const mood = el('span', 'dw-attitude');
    head.append(title, mood);
    const lines = el('div', 'qd-text dw-text');
    lines.setAttribute('aria-live', 'polite');
    const chips = el('div', 'qd-chips dw-options');
    const foot = el('div', 'qd-foot dw-foot');
    box.append(plate, head, lines, chips, foot);
    root.append(backdrop, portrait, box);
    dialog.appendChild(root);

    let state = startDialogue(dialogue, { memory, hero, world: getWorld() });
    let remembered = rememberDialogue(memory, state);
    let busy = false;

    return new Promise(resolve => {
        const close = (/** @type {boolean} */ ended, /** @type {string} */ extra = '') => {
            dialog.close();
            dialog.remove();
            resolve({ ended, state, memory: remembered, ...(extra ? { extra } : {}) });
        };

        /** Lo aplica quien abrió la ventana; lo que devuelve (o, si nada, lo de siempre) se dice. */
        const apply = async (/** @type {any[]} */ effects, /** @type {any} */ roll = null) => {
            // Con tirada se llama aunque no haya efectos: quien abrió la ventana la apunta en el registro de dados.
            if (effects.length === 0 && !roll) return [];
            try {
                const said = await applyEffects(effects, { dialogue, state, roll });
                if (Array.isArray(said)) return said.map(text).filter(Boolean);
            } catch (error) {
                console.error('[charla] no se pudo aplicar', error);
            }
            return effects.map(describeDialogueEffect).filter(Boolean);
        };

        const drawPortrait = (/** @type {string} */ face) => {
            const url = portraitFor({ name: speaker, pack, mood: face === 'neutral' ? '' : face });
            // El gesto, aunque no haya cara dibujada para él (se ve el retrato de siempre).
            portrait.dataset.mood = face;
            if (portrait.dataset.src === url && portrait.firstChild) return;
            portrait.dataset.src = url;
            portrait.textContent = '';
            const silhouette = () => portrait.appendChild(el('i', 'fa-solid fa-user qd-silhouette'));
            if (!url) {
                silhouette();
                return;
            }
            const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art qd-pixel'));
            image.src = url;
            image.alt = speaker;
            image.addEventListener('error', () => {
                image.remove();
                silhouette();
            });
            portrait.appendChild(image);
        };

        const chip = (/** @type {string} */ className, /** @type {() => void} */ onClick) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', className));
            button.type = 'button';
            button.addEventListener('click', onClick);
            return button;
        };

        const draw = (/** @type {Array<{kind: string, text: string}>} */ said) => {
            const world = getWorld();
            const view = dialogueView(state, hero, world);
            drawPortrait(view.mood);
            const attitude = Number(world.attitude);
            mood.textContent = Number.isFinite(attitude) && world.attitude !== undefined ? `Os mira de forma ${describeAttitude(attitude)}` : '';
            lines.textContent = '';
            for (const line of said) {
                const p = el('p', `qd-line qd-${line.kind === 'you' ? 'you' : line.kind === 'note' ? 'note' : 'say'} dw-${line.kind}`);
                // La línea de la tirada ya trae su dado (`rollLine`): no se pone otro.
                if (line.kind === 'you') p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(line.text));
                lines.appendChild(p);
            }
            lines.scrollTop = lines.scrollHeight;
            chips.textContent = '';
            foot.textContent = '';

            if (state.ended || view.final || view.options.length === 0) {
                root.classList.add('dw-ended');
                const finish = chip('qd-chip qd-chip-finish dw-finish', () => close(true));
                finish.append(el('span', 'qd-key', '↵'), el('span', 'qd-label', state.ended || view.final ? 'Terminar' : 'Despedirse'));
                chips.appendChild(finish);
                finish.focus();
                return;
            }
            root.classList.remove('dw-ended');
            for (const option of optionChips(view)) {
                const button = chip(`qd-chip dw-option${option.locked ? ' dw-locked' : ''}${option.check ? ' dw-has-check' : ''}`, () => {
                    if (!option.locked) void pick(option.id);
                });
                button.dataset.option = option.id;
                if (option.locked) {
                    button.setAttribute('aria-disabled', 'true');
                    button.title = option.locked;
                }
                button.appendChild(el('span', 'qd-key', option.locked ? '' : option.key));
                const body = el('span', 'dw-body');
                const saying = el('span', 'dw-said');
                if (option.tag) saying.appendChild(el('span', 'dw-tag', option.tag));
                saying.appendChild(document.createTextNode(option.label));
                body.appendChild(saying);
                if (option.locked) {
                    const why = el('span', 'dw-why');
                    why.appendChild(el('i', 'fa-solid fa-lock'));
                    why.appendChild(document.createTextNode(` ${option.locked}`));
                    body.appendChild(why);
                }
                button.appendChild(body);
                if (option.check) {
                    const check = el('span', 'dw-check');
                    check.appendChild(el('i', 'fa-solid fa-dice-d20'));
                    check.appendChild(document.createTextNode(` ${option.check}`));
                    button.appendChild(check);
                }
                if (option.ends) button.appendChild(el('i', 'fa-solid fa-door-open dw-ends'));
                chips.appendChild(button);
            }
            for (const extra of Array.isArray(extras) ? extras : []) {
                const button = chip('dw-extra', () => close(false, extra.id));
                button.dataset.extra = extra.id;
                if (extra.title) button.title = extra.title;
                if (extra.icon) button.appendChild(el('i', `fa-solid ${extra.icon}`));
                button.appendChild(document.createTextNode(` ${extra.label}`));
                foot.appendChild(button);
            }
            const leave = chip('qd-leave dw-leave', () => close(false));
            leave.textContent = 'Despedirse';
            foot.appendChild(leave);
            /** @type {HTMLElement|null} */ (chips.querySelector('.dw-option:not(.dw-locked)'))?.focus();
        };

        const pick = async (/** @type {string} */ id) => {
            if (busy) return;
            busy = true;
            try {
                const from = state.log.length;
                const result = choose(state, id, { hero, world: getWorld(), rollD20, memory: remembered });
                if (!result.ok) {
                    draw([{ kind: 'note', text: result.reason }]);
                    return;
                }
                state = result.state;
                const notes = await apply(result.effects, result.roll);
                remembered = rememberDialogue(remembered, state);
                onMemory(remembered);
                draw(stepLines(state, from, notes));
            } finally {
                busy = false;
            }
        };

        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            close(state.ended);
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es de la charla, no del Modo Juego que hay detrás.
            event.stopPropagation();
            if (/^[1-9]$/.test(event.key)) {
                const option = optionChips(dialogueView(state, hero, getWorld())).find(o => o.key === event.key);
                if (option) {
                    event.preventDefault();
                    void pick(option.id);
                }
            } else if ((event.key === 'Enter' || event.key === ' ') && root.classList.contains('dw-ended') && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
                close(true);
            }
        });

        // Lo que hace el nudo de inicio (la primera vez), y a pintar.
        void (async () => {
            busy = true;
            try {
                const notes = await apply(state.pending);
                onMemory(remembered);
                draw(stepLines(state, 0, notes));
            } finally {
                busy = false;
            }
        })();
    });
}
