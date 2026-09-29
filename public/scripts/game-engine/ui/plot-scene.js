/**
 * Las escenas del hilo en pantalla (J9.2 de wiki/ROADMAP_SIN_CONEXION.md): cada hito importante
 * jugado como una novela visual, en vez de contado en una nota «[HILO]».
 *
 * Quien habla sale grande, con su cara (`alegre`, `enfadado`, `triste`) y su nombre en la placa;
 * lo que cuenta el narrador sale sin retrato y en cursiva. Se sigue con un toque en cualquier
 * sitio de la escena (o Intro, o la ficha «Seguir»); en una decisión, las opciones son las de
 * una charla (`dialogue-window.js`): con su etiqueta, apagadas con el porqué si no se pueden, y
 * con su tirada. Lo que se elige lo aplica quien abre la escena (`applyEffects`), y la ventana
 * dice lo que ha pasado. Si el hito trae una charla (`sceneDialogue`), se abre al acabar.
 *
 * Se abre sola, sin `party.js`: un `<dialog>` modal con el marco de la quedada (`qd-*`,
 * quedadas.css) y las opciones de la charla (`dw-*`, dialogos.css); lo propio va en escenas.css.
 * Teclas: del 1 al 9 eligen, Intro o espacio siguen, Escape salta hasta la próxima decisión.
 */

import { sceneOptions, chooseInScene, sceneTranscript } from '../campaign/plot-scenes.js';
import { describeDialogueEffect } from '../campaign/dialogues.js';
import { loadPixelManifest } from './pixel-art.js';
import { portraitFor, backdropFor } from './meetup-scene.js';
import { optionChips, openDialogueWindow } from './dialogue-window.js';

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
 * @typedef {Object} SceneFrame Lo que se ve de una vez: quién, con qué cara y qué líneas.
 * @property {number} beat La línea de la escena de la que sale.
 * @property {string} who Vacío: el narrador.
 * @property {string} mood
 * @property {Array<{kind: 'say'|'narration'|'you'|'roll'|'note', text: string}>} lines
 * @property {boolean} ask Si aquí se decide.
 */

/**
 * Las pantallas de una escena antes de decidir nada: una por línea.
 *
 * @param {import('../campaign/plot-scenes.js').PlotScene} scene
 * @returns {SceneFrame[]}
 */
export function sceneFrames(scene) {
    return (scene?.beats ?? []).map((beat, index) => ({
        beat: index,
        who: beat.who,
        mood: beat.mood,
        lines: [{ kind: beat.who ? 'say' : 'narration', text: beat.text }],
        ask: Boolean(beat.decision),
    }));
}

/**
 * Las pantallas de lo que pasa al decidir: lo que dijiste (y la tirada) y lo que se oye después.
 * Lo que ha cambiado va en la primera, que es cuando se entiende por qué.
 *
 * @param {SceneFrame} at La pantalla de la decisión.
 * @param {import('../campaign/plot-scenes.js').SceneChoiceResult} result
 * @param {string[]} notes
 * @returns {SceneFrame[]}
 */
export function choiceFrames(at, result, notes = []) {
    /** @type {SceneFrame['lines']} */
    const head = [{ kind: 'you', text: result.said }];
    if (result.roll?.said) head.push({ kind: 'roll', text: result.outcome === 'medias' ? String(result.roll.said).replace(/ ✗ Fallo\b/, ' ✗ A medias') : String(result.roll.said) });
    const tail = notes.map(note => ({ kind: /** @type {'note'} */ ('note'), text: note }));
    const replies = result.reply ?? [];
    if (replies.length === 0) return [{ beat: at.beat, who: at.who, mood: at.mood, lines: [...head, ...tail], ask: false }];
    return replies.map((line, i) => ({
        beat: at.beat,
        who: line.who,
        mood: line.mood,
        lines: [...(i === 0 ? head : []), { kind: line.who ? 'say' : 'narration', text: line.text }, ...(i === 0 ? tail : [])],
        ask: false,
    }));
}

/**
 * @typedef {Object} PlotSceneResult
 * @property {boolean} finished
 * @property {import('../campaign/plot-scenes.js').SceneChoice[]} choices Lo que se eligió.
 * @property {string[]} transcript Lo que pasó, línea a línea (`sceneTranscript`).
 * @property {import('./dialogue-window.js').DialogueWindowResult|null} dialogue La charla del final, si la hubo.
 */

/**
 * Jugar la escena de un hito en pantalla.
 *
 * @param {Object} input
 * @param {import('../campaign/plot-scenes.js').PlotScene} input.scene La de `milestoneScene`, de clase `scene`.
 * @param {any} [input.hero] Quien decide: su ficha tira y su género concuerda.
 * @param {(who: string) => import('../campaign/dialogues.js').DialogueWorld} [input.getWorld] Cómo está la
 *   partida ahora, con cómo os mira `who` en `attitude`. Se pide en cada decisión.
 * @param {() => number} [input.rollD20]
 * @param {(effects: import('../campaign/dialogues.js').DialogueEffect[], context: {scene: any, beat: number, roll: any}) => (string[]|void|Promise<string[]|void>)} [input.applyEffects]
 *   Lo aplica quien abre la escena (con `applySceneEffects`) y devuelve cómo decirlo; sin nada,
 *   se dice en llano. También recibe los de la charla del final.
 * @param {any} [input.memory] Lo recordado de las charlas, para la del final.
 * @param {(memory: any) => void} [input.onMemory]
 * @param {string} [input.pack] El paquete, para los retratos y el escenario.
 * @param {string} [input.place] El sitio del pueblo, si la escena no dice el suyo.
 * @param {string} [input.town] La localización, si la escena no dice la suya.
 * @param {boolean} [input.night]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<PlotSceneResult>}
 */
export async function openPlotScene({
    scene, hero = null, getWorld = () => ({}), rollD20 = () => 1 + Math.floor(Math.random() * 20),
    applyEffects = () => [], memory = null, onMemory = () => {}, pack = '', place = '', town = '', night = false, mount = null,
}) {
    await loadPixelManifest();
    /** @type {import('../campaign/plot-scenes.js').SceneChoice[]} */
    const choices = [];
    const where = scene?.backdrop?.place || scene?.backdrop?.town ? scene.backdrop : { place, town };
    const frames = sceneFrames(scene);

    // Solo la charla: se abre directamente, sin pantalla de líneas vacía.
    const talk = async () => (scene?.dialogue ? openDialogueWindow({
        dialogue: scene.dialogue, hero, getWorld: () => getWorld(scene.dialogue?.speaker ?? ''), rollD20, memory, onMemory, pack,
        place: where.place, town: where.town, night, mount,
        applyEffects: (effects, context) => applyEffects(effects, { scene, beat: -1, roll: context.roll }),
    }) : null);
    if (frames.length === 0) {
        const dialogue = await talk();
        return { finished: true, choices, transcript: sceneTranscript(scene, choices), dialogue };
    }

    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'qd-dialog dw-dialog ps-dialog'));
    dialog.setAttribute('aria-label', text(scene?.title) || 'Una escena');
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();

    const root = el('div', 'qd-root dw-root ps-root');
    root.dataset.scene = text(scene?.id);
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ place: where.place, town: where.town, pack, night });
    // Entera: una URL relativa dentro de una variable se lee desde la hoja que la usa (css/).
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait ps-portrait');
    const box = el('div', 'qd-box dw-box ps-box');
    const plate = el('div', 'qd-nameplate');
    const head = el('div', 'qd-head');
    const title = el('span', 'qd-title', text(scene?.title));
    const step = el('span', 'qd-step');
    head.append(title, step);
    const lines = el('div', 'qd-text dw-text ps-text');
    lines.setAttribute('aria-live', 'polite');
    const chips = el('div', 'qd-chips dw-options ps-chips');
    const foot = el('div', 'qd-foot dw-foot');
    box.append(plate, head, lines, chips, foot);
    root.append(backdrop, portrait, box);
    dialog.appendChild(root);

    let at = 0;
    let busy = false;
    /** @type {Set<number>} */
    const decided = new Set();
    const total = scene.beats.length;

    return new Promise(resolve => {
        const finish = async () => {
            dialog.close();
            dialog.remove();
            const dialogue = await talk();
            resolve({ finished: true, choices, transcript: sceneTranscript(scene, choices), dialogue });
        };

        const drawPortrait = (/** @type {string} */ who, /** @type {string} */ mood) => {
            portrait.dataset.mood = who ? mood : '';
            portrait.dataset.who = who;
            // El narrador no tiene cara.
            portrait.hidden = !who;
            root.classList.toggle('ps-narrator', !who);
            if (!who) {
                portrait.textContent = '';
                delete portrait.dataset.src;
                return;
            }
            const url = portraitFor({ name: who, pack, mood: mood === 'neutral' ? '' : mood });
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
            image.alt = who;
            image.addEventListener('error', () => {
                image.remove();
                silhouette();
            });
            portrait.appendChild(image);
        };

        const chip = (/** @type {string} */ className, /** @type {() => void} */ onClick) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', className));
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                onClick();
            });
            return button;
        };

        /** Si en esta pantalla hay que decidir todavía. */
        const asking = () => {
            const frame = frames[at];
            return Boolean(frame?.ask) && !decided.has(frame.beat);
        };

        const optionsNow = () => {
            const frame = frames[at];
            return sceneOptions(scene, frame.beat, { hero, world: getWorld(frame.who) });
        };

        const draw = () => {
            const frame = frames[at];
            root.dataset.beat = String(frame.beat);
            plate.textContent = frame.who;
            plate.hidden = !frame.who;
            drawPortrait(frame.who, frame.mood);
            step.textContent = total > 1 ? `${frame.beat + 1} / ${total}` : '';
            lines.textContent = '';
            for (const line of frame.lines) {
                const kind = line.kind === 'narration' ? 'qd-note' : line.kind === 'you' ? 'qd-you' : line.kind === 'note' ? 'qd-note dw-note' : line.kind === 'roll' ? 'dw-roll' : 'qd-say';
                const p = el('p', `qd-line ${kind} ps-${line.kind}`);
                if (line.kind === 'you') p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(line.text));
                lines.appendChild(p);
            }
            lines.scrollTop = lines.scrollHeight;
            chips.textContent = '';
            foot.textContent = '';
            root.classList.toggle('ps-asking', asking());

            if (asking()) {
                for (const option of optionChips({ speaker: frame.who, mood: frame.mood, line: '', options: optionsNow(), ended: false, final: false })) {
                    const button = chip(`qd-chip dw-option ps-option${option.locked ? ' dw-locked' : ''}${option.check ? ' dw-has-check' : ''}`, () => {
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
                    chips.appendChild(button);
                }
                /** @type {HTMLElement|null} */ (chips.querySelector('.dw-option:not(.dw-locked)'))?.focus();
                return;
            }

            const last = at >= frames.length - 1;
            const next = chip(`qd-chip ${last ? 'qd-chip-finish ps-finish' : 'qd-chip-next ps-next'}`, () => advance());
            next.append(el('span', 'qd-key', '↵'), el('span', 'qd-label', last ? (scene.dialogue ? `Hablar con ${scene.dialogue.speaker}` : 'Terminar') : 'Seguir'));
            chips.appendChild(next);
            if (!last) {
                const skip = chip('qd-leave ps-skip', () => skipAhead());
                skip.textContent = 'Saltar';
                skip.title = 'Hasta la próxima decisión, o hasta el final';
                foot.appendChild(skip);
            }
            next.focus();
        };

        const advance = () => {
            if (busy || asking()) return;
            if (at >= frames.length - 1) {
                void finish();
                return;
            }
            at += 1;
            draw();
        };

        // Saltar no se salta una decisión: se para en la próxima, o en la última pantalla.
        const skipAhead = () => {
            if (busy || asking()) return;
            if (at >= frames.length - 1) {
                void finish();
                return;
            }
            let to = at + 1;
            while (to < frames.length - 1 && !(frames[to].ask && !decided.has(frames[to].beat))) to += 1;
            at = Math.min(to, frames.length - 1);
            draw();
        };

        /** Lo aplica quien abrió la escena; lo que devuelve (o, si nada, lo de siempre) se dice. */
        const apply = async (/** @type {any[]} */ effects, /** @type {number} */ beat, /** @type {any} */ roll) => {
            if (effects.length === 0 && !roll) return [];
            try {
                const said = await applyEffects(effects, { scene, beat, roll });
                if (Array.isArray(said)) return said.map(text).filter(Boolean);
            } catch (error) {
                console.error('[escena] no se pudo aplicar', error);
            }
            return effects.map(describeDialogueEffect).filter(Boolean);
        };

        const pick = async (/** @type {string} */ id) => {
            if (busy || !asking()) return;
            busy = true;
            try {
                const frame = frames[at];
                const result = chooseInScene(scene, frame.beat, id, { hero, world: getWorld(frame.who), rollD20 });
                if (!result.ok) {
                    lines.appendChild(el('p', 'qd-line qd-note ps-refused', result.reason));
                    return;
                }
                decided.add(frame.beat);
                if (result.choice) choices.push(result.choice);
                const notes = await apply(result.effects, frame.beat, result.roll);
                frames.splice(at + 1, 0, ...choiceFrames(frame, result, notes));
                at += 1;
                draw();
            } finally {
                busy = false;
            }
        };

        // Un toque en cualquier sitio de la escena sigue (con el dedo, la ficha queda lejos).
        root.addEventListener('click', (event) => {
            if (event.target instanceof Element && event.target.closest('button')) return;
            advance();
        });
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            skipAhead();
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es de la escena, no del Modo Juego que hay detrás.
            event.stopPropagation();
            if (asking() && /^[1-9]$/.test(event.key)) {
                const frame = frames[at];
                const option = optionChips({ speaker: frame.who, mood: frame.mood, line: '', options: optionsNow(), ended: false, final: false })
                    .find(o => o.key === event.key);
                if (option) {
                    event.preventDefault();
                    void pick(option.id);
                }
            } else if ((event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
                advance();
            }
        });
        draw();
    });
}
