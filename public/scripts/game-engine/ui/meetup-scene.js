/**
 * La quedada en pantalla (J14.3 y J14.5): una escena de novela visual con quien quedas. Su
 * retrato grande, con la cara que toca (`alegre`, `enfadado`, `triste`), su nombre en la placa,
 * lo que dice en la caja de abajo, y tus respuestas como fichas. Detrás, el sitio donde estáis
 * (la posada, el muelle…), de noche si es de noche. D-J60: lo que pasa sin que lo diga nadie
 * (`note`) y lo que se cuenta al acabar no van en la caja: van en un aviso fuera de ella.
 *
 * También enseña una charla corta (`talkScene` de `small-talk.js`: un solo paso) y el selector
 * de con quién y dónde quedar.
 *
 * Se abre sola, sin `party.js`: es un `<dialog>` modal encima de lo que haya (el Modo Juego
 * incluido, que con una ventana abierta no atiende a sus atajos). Juega la escena con
 * `sceneStep` y devuelve lo elegido; lo que eso cambia lo decide `meetups.js` y lo guarda
 * quien la abrió. Teclas: 1, 2 y 3 eligen; Intro o espacio siguen.
 */

import { RANK_UP_LINE, sceneStep, sceneView, startScene } from '../campaign/meetups.js';
import { firstArt, loadPixelManifest, pixelManifest, slugify, PIXEL_BASE } from './pixel-art.js';
import { hearLine, knowsName, meetPerson, shownName, shownText } from './shown-names.js';
import { asideBox, fillAside, splitLines } from './vn-aside.js';

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
 * El retrato de alguien, con su cara si está dibujada: el de su paquete, el de mercenario o,
 * si no tiene, el de relleno de su clase. Vacío: la silueta.
 *
 * @param {{name?: string, pack?: string, mood?: string, className?: string, gender?: string, race?: string}} who
 * @param {any} [manifest]
 * @returns {string}
 */
export function portraitFor({ name = '', pack = '', mood = '', className = '', gender = '', race = '' }, manifest = pixelManifest()) {
    return firstArt('portrait', { name, pack, mood }, manifest)
        || firstArt('mercenary', { name, mood }, manifest)
        || (className ? firstArt('hero', { className, gender, name, race }, manifest) : '');
}

/** Lo que va delante de quien sale por lo que es: «el tabernero», «un bandido». */
const ROLE_ARTICLE = /^(?:el|la|los|las|un|una|unos|unas)\s+/iu;

/**
 * Tanda 22: la cara de alguien que habla en una quedada sin ser de los tuyos (el tabernero, un
 * mercenario borracho, un bandido). Si no tiene retrato propio, el de **la misma persona** en
 * esa campaña:
 *
 * - quien está allí haciendo eso (`standIns`: el tabernero de la posada de aquí es Tomás);
 * - la gente de la campaña que se llama así y algo más («el tabernero» es «El tabernero Giles»);
 * - el dibujo de la criatura, sin el artículo («un bandido» es el bandido del bestiario).
 *
 * Sin ninguno, la silueta: va a `wiki/PIXELLAB_PENDIENTE.md`.
 *
 * @param {string} name
 * @param {{pack?: string, standIns?: Record<string, string>}} [input] `standIns`: por lo que es, en
 *   minúsculas («el tabernero»), quién lo hace aquí.
 * @param {any} [manifest]
 * @returns {string}
 */
export function guestPortrait(name, { pack = '', standIns = {} } = {}, manifest = pixelManifest()) {
    const said = text(name);
    if (!said) return '';
    const own = portraitFor({ name: said, pack }, manifest);
    if (own) return own;
    const stand = text(standIns?.[said.toLocaleLowerCase('es')]);
    const standing = stand && stand !== said ? portraitFor({ name: stand, pack }, manifest) : '';
    if (standing) return standing;
    const files = manifest?.files instanceof Set ? manifest.files : new Set();
    const head = slugify(said);
    if (pack && head) {
        const prefix = `retratos/${slugify(pack)}/${head}-`;
        const same = [...files].filter(f => f.startsWith(prefix) && !f.slice(prefix.length).includes('--')).sort()[0];
        if (same) return `${PIXEL_BASE}${same}`;
    }
    const bare = said.replace(ROLE_ARTICLE, '');
    return firstArt('creature', { name: said }, manifest) || (bare !== said ? firstArt('creature', { name: bare }, manifest) : '');
}

/**
 * Lo de detrás: el sitio del pueblo (`sitios/`) o, si no, el escenario de la localización.
 *
 * @param {{place?: string, town?: string, pack?: string, night?: boolean}} where
 * @param {any} [manifest]
 * @returns {string}
 */
export function backdropFor({ place = '', town = '', pack = '', night = false }, manifest = pixelManifest()) {
    return (place ? firstArt('place', { id: place, night }, manifest) : '')
        || (town ? firstArt('scene', { name: town, pack, night }, manifest) : '');
}

/**
 * Las líneas de la caja en un paso: lo que pasa, lo que dice, lo que contestas y lo que te
 * contesta.
 *
 * @param {ReturnType<typeof sceneView>} view
 * @returns {Array<{kind: 'note'|'say'|'you'|'then', text: string}>}
 */
export function beatLines(view) {
    /** @type {Array<{kind: 'note'|'say'|'you'|'then', text: string}>} */
    const lines = [];
    if (view.note) lines.push({ kind: 'note', text: view.note });
    if (view.say) lines.push({ kind: 'say', text: view.say });
    if (view.answer) {
        lines.push({ kind: 'you', text: view.answer.text });
        if (view.answer.then) lines.push({ kind: 'then', text: view.answer.then });
    }
    return lines;
}

/**
 * Las fichas de un paso: las respuestas, o seguir, o terminar.
 *
 * @param {ReturnType<typeof sceneView>} view
 * @returns {Array<{kind: 'reply'|'next'|'finish', label: string, index?: number, key: string}>}
 */
export function beatChips(view) {
    if (view.next === 'reply') {
        return view.replies.map((reply, i) => ({
            kind: /** @type {'reply'} */ ('reply'),
            index: reply.index,
            key: String(i + 1),
            label: reply.gold < 0 ? `${reply.text} (${-reply.gold} de oro)` : reply.text,
        }));
    }
    if (view.next === 'continue') return [{ kind: 'next', label: 'Seguir', key: '↵' }];
    if (view.next === 'finish') return [{ kind: 'finish', label: 'Terminar', key: '↵' }];
    return [];
}

/**
 * Las tarjetas del selector: primero quien quiere quedar contigo, luego el resto por nombre.
 *
 * @param {Array<{name: string, wantsToMeet?: boolean, why?: string, placeLabel?: string, rankLabel?: string}>} people
 * @returns {Array<any>}
 */
export function pickerCards(people) {
    return (Array.isArray(people) ? people : [])
        .filter(p => text(p?.name))
        .map(p => ({
            ...p,
            badge: p.wantsToMeet ? 'Quiere quedar contigo' : '',
            where: text(p.placeLabel),
        }))
        .sort((a, b) => Number(Boolean(b.wantsToMeet)) - Number(Boolean(a.wantsToMeet)) || text(a.name).localeCompare(text(b.name), 'es'));
}

/**
 * La ventana, vacía, dentro del Modo Juego si está abierto (hereda su letra) o en la página.
 *
 * @param {string} label
 * @param {HTMLElement|null} [mount]
 * @param {string} [extra] Una clase más (`qd-dialog-picker`: a la medida de lo que lleva).
 * @returns {HTMLDialogElement}
 */
function openDialog(label, mount = null, extra = '') {
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', `qd-dialog${extra ? ` ${extra}` : ''}`));
    dialog.setAttribute('aria-label', label);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    dialog.showModal();
    return dialog;
}

/**
 * Poner el retrato: la imagen con su cara, o la silueta si no hay o no carga.
 *
 * @param {HTMLElement} holder
 * @param {string} url
 * @param {string} alt
 */
function drawPortrait(holder, url, alt) {
    if (holder.dataset.src === url && holder.firstChild) return;
    holder.dataset.src = url;
    holder.textContent = '';
    const silhouette = () => holder.appendChild(el('i', 'fa-solid fa-user qd-silhouette'));
    if (!url) {
        silhouette();
        return;
    }
    const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art qd-pixel'));
    image.src = url;
    image.alt = alt;
    image.addEventListener('error', () => {
        image.remove();
        silhouette();
    });
    holder.appendChild(image);
}

/**
 * Jugar una escena de quedada (o una charla) en pantalla.
 *
 * @param {Object} input
 * @param {import('../campaign/meetups.js').Scene} input.scene Ya con el texto de tu héroe (`renderScene`).
 * @param {{name?: string, className?: string, gender?: string, race?: string}} [input.person] Para el retrato.
 * @param {string} [input.pack] El paquete (`gremio`, `strahd`, `1387`), para su retrato y su escenario.
 * @param {string} [input.place] El sitio (`posada`, `muelle`…), para el fondo.
 * @param {string} [input.town] La localización, si el sitio no tiene dibujo.
 * @param {boolean} [input.night]
 * @param {string} [input.placeLabel] El sitio dicho para el título («La posada»).
 * @param {((choices: Array<{beat: number, reply: number}>) => string[])|null} [input.summarize] Lo que se
 *   cuenta al acabar (`meetupSummary`). Sin él, se cierra al terminar.
 * @param {boolean} [input.canLeave] Si se puede dejar a medias («Dejarlo para otro día»).
 * @param {Array<{name: string, short?: string, className?: string, gender?: string}>} [input.cast] J14.7 y J14.8:
 *   en una escena con varios (la noche, una charla de pareja), quién sale. Cada paso pone en la placa
 *   y en el retrato a quien habla en él (`who` del paso), no siempre al mismo.
 * @param {Record<string, string>} [input.standIns] Tanda 22: quién hace aquí de lo que dice un paso
 *   («el tabernero»: el que lleva la posada de aquí), para su cara (`guestPortrait`).
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<{finished: boolean, choices: Array<{beat: number, reply: number}>}>}
 */
export async function openMeetupScene({
    scene, person = {}, pack = '', place = '', town = '', night = false, placeLabel = '', summarize = null, canLeave = true, cast = [], standIns = {}, mount = null,
}) {
    await loadPixelManifest();
    const who = text(person?.name) || text(scene?.who);
    const people = (Array.isArray(cast) ? cast : []).filter(p => text(p?.name));
    /**
     * Quien habla en un paso, con su ficha para el retrato: de la escena con varios, o el de siempre.
     *
     * @param {string} name
     * @returns {{name: string, short?: string, className?: string, gender?: string, race?: string}}
     */
    const speakerOf = (name) => {
        const found = people.find(p => text(p.name) === text(name) || text(p.short) === text(name));
        if (found) return { ...found, name: text(found.name) };
        // J13.9: en una quedada, un paso que dice otro que está allí (el tabernero): con su nombre.
        return text(name) && text(name) !== who && text(name) !== text(scene?.who) ? { name: text(name) } : { ...person, name: who };
    };
    const dialog = openDialog(people.length > 1 ? text(scene?.title) || `Con ${who}` : `Quedada con ${who}`, mount);
    const root = el('div', `qd-root qd-${text(scene?.kind) || 'escena'}`);
    root.dataset.scene = text(scene?.id);
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ place, town, pack, night });
    // Entera: una URL relativa dentro de una variable se lee desde la hoja que la usa (css/).
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait');
    const box = el('div', 'qd-box');
    // J13.7: por lo que es hasta que se presente.
    const plate = el('div', 'qd-nameplate', shownName(who));
    const head = el('div', 'qd-head');
    const title = el('span', 'qd-title', shownText([text(scene?.title), text(placeLabel)].filter(Boolean).join(' · '), { mask: true }));
    const step = el('span', 'qd-step');
    head.append(title, step);
    const lines = el('div', 'qd-text');
    lines.setAttribute('aria-live', 'polite');
    const chips = el('div', 'qd-chips');
    const foot = el('div', 'qd-foot');
    box.append(plate, head, lines, chips, foot);
    // D-J60: lo que pasa sin que lo diga nadie (`note`) y lo que se cuenta al acabar, fuera de la caja.
    const aside = asideBox();
    root.append(backdrop, portrait, aside, box);
    dialog.appendChild(root);

    let state = startScene();
    let summary = /** @type {string[]|null} */ (null);

    return new Promise(resolve => {
        const close = (/** @type {boolean} */ finished) => {
            // J13.7: después de pasar un rato juntos, ya sabes cómo se llama.
            if (finished && !knowsName(who)) meetPerson(who, 'charla');
            dialog.close();
            dialog.remove();
            resolve({ finished, choices: state.choices });
        };
        const act = (/** @type {{reply?: number, next?: boolean}} */ action) => {
            state = sceneStep(scene, state, action);
            if (state.done && summary === null) {
                summary = summarize ? summarize(state.choices) : [];
                if (summary.length === 0) {
                    close(true);
                    return;
                }
            }
            draw();
        };
        const chip = (/** @type {string} */ label, /** @type {string} */ key, /** @type {string} */ kind, /** @type {() => void} */ onClick) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', `qd-chip qd-chip-${kind}`));
            button.type = 'button';
            if (key) button.appendChild(el('span', 'qd-key', key));
            button.appendChild(el('span', 'qd-label', label));
            button.addEventListener('click', onClick);
            chips.appendChild(button);
            return button;
        };
        const draw = () => {
            lines.textContent = '';
            chips.textContent = '';
            foot.textContent = '';
            if (state.done) {
                root.classList.add('qd-ended');
                plate.hidden = true;
                step.textContent = '';
                drawPortrait(portrait, portraitFor({ ...person, name: who, pack, mood: 'alegre' }), who);
                // D-J63: si sube el rango, el momento, en grande y claro: «Rango 3 con Gerd».
                const rankUp = (summary ?? []).find(line => RANK_UP_LINE.test(line));
                if (rankUp && !root.querySelector('.qd-rankup')) {
                    const banner = el('div', 'qd-rankup');
                    banner.setAttribute('role', 'status');
                    banner.appendChild(el('i', 'fa-solid fa-link'));
                    banner.appendChild(el('span', 'qd-rankup-text', shownText(rankUp, { mask: true })));
                    root.insertBefore(banner, box);
                }
                // D-J60: no es nadie quien lo cuenta: en el aviso, y la caja solo con «Cerrar».
                fillAside(aside, (summary ?? []).filter(line => line !== rankUp).map(line => ({ kind: 'summary', text: line })));
                chip('Cerrar', '↵', 'finish', () => close(true)).focus();
                return;
            }
            const view = sceneView(scene, state);
            // J14.10: la respuesta que funde a negro (`fade`): la escena se apaga, y así se queda.
            if (state.answered !== null && /** @type {any} */ (scene?.beats?.[state.beat]?.replies?.[state.answered])?.fade) root.classList.add('qd-fade');
            plate.hidden = false;
            step.textContent = view.steps > 1 ? `${view.step} / ${view.steps}` : '';
            // Con varios, la placa y el retrato son de quien habla en este paso.
            const speaking = /** @type {{name: string, short?: string}} */ (speakerOf(text(view.speaker) || who));
            // J13.7: lo que dice enseña su nombre (si lo dice); la placa, después.
            for (const line of beatLines(view)) if (line.kind === 'say') hearLine({ who: speaking.name, text: line.text });
            plate.textContent = knowsName(speaking.name) ? text(speaking.short) || speaking.name : shownName(speaking.name);
            root.dataset.speaker = speaking.name;
            // Tanda 22: quien habla sin ser de los tuyos (el tabernero), con la cara de la misma persona.
            drawPortrait(portrait, portraitFor({ ...speaking, pack, mood: view.face }) || guestPortrait(speaking.name, { pack, standIns }), speaking.name);
            // D-J60: en la caja, lo que dice quien está en la placa y lo que contestas; lo demás, al aviso.
            const split = splitLines(beatLines(view));
            for (const line of split.box) {
                const p = el('p', `qd-line qd-${line.kind}`);
                if (line.kind === 'you') p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(shownText(line.text, { mask: line.kind === 'then' })));
                lines.appendChild(p);
            }
            // D-J63: en el punto de inflexión, el aviso del paso donde se decide, mientras se elige.
            const warn = view.next === 'reply' ? text(/** @type {any} */ (scene?.beats?.[state.beat])?.warn) : '';
            fillAside(aside, warn ? [...split.aside, { kind: 'warn', text: warn }] : split.aside);
            root.classList.toggle('qd-turning', Boolean(warn));
            let first = /** @type {HTMLButtonElement|null} */ (null);
            for (const one of beatChips(view)) {
                const button = one.kind === 'reply'
                    ? chip(shownText(one.label, { mask: true }), one.key, 'reply', () => act({ reply: one.index }))
                    : chip(one.label, one.key, one.kind, () => act({ next: true }));
                // J14.10: la respuesta romántica lleva su corazón delante; que se vea a la primera.
                if (one.kind === 'reply' && one.label.startsWith('♥')) button.classList.add('qd-chip-love');
                first = first ?? button;
            }
            first?.focus();
            if (canLeave) {
                const leave = /** @type {HTMLButtonElement} */ (el('button', 'qd-leave', 'Dejarlo para otro día'));
                leave.type = 'button';
                leave.addEventListener('click', () => close(false));
                foot.appendChild(leave);
            }
        };
        // Escape no cierra a medias: se deja con su botón, o se cierra al final.
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            if (state.done) close(true);
        });
        dialog.addEventListener('keydown', (event) => {
            // Lo que se pulsa aquí es de la escena, no del Modo Juego que hay detrás.
            event.stopPropagation();
            if (state.done) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    close(true);
                }
                return;
            }
            const view = sceneView(scene, state);
            if (view.next === 'reply' && /^[1-3]$/.test(event.key)) {
                const reply = view.replies[Number(event.key) - 1];
                if (reply) {
                    event.preventDefault();
                    act({ reply: reply.index });
                }
            } else if (view.next !== 'reply' && (event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)) {
                event.preventDefault();
                act({ next: true });
            }
        });
        draw();
    });
}

/**
 * D-J63: la invitación, al pulsar a alguien de tu gente (como en *Persona*). Su retrato, el sitio
 * detrás y lo que dice al verte (`invitationFor` de `campaign/invitations.js`): si no os
 * conocíais, primero se presenta. Si tiene una charla corta (J14.1, `talk`), va dentro del saludo,
 * con sus respuestas. Luego la pregunta y dos respuestas: «Pasar el rato con X» y «Hablamos en
 * otro momento». La pista de que el vínculo subirá hoy (`hint`) va fuera de la caja (D-J60).
 *
 * @param {Object} input
 * @param {{name: string, className?: string, gender?: string, race?: string}} input.person
 * @param {string[]} input.lines Lo que dice al verte.
 * @param {string} input.ask La pregunta.
 * @param {Array<{id: string, label: string}>} input.options
 * @param {string} [input.hint]
 * @param {{say: string, replies: Array<{text: string, then?: string}>}|null} [input.talk] Una charla corta suya.
 * @param {string} [input.pack]
 * @param {string} [input.place]
 * @param {string} [input.town]
 * @param {boolean} [input.night]
 * @param {string} [input.placeLabel]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<{choice: string, talkReply: number|null}>}
 */
export async function openInvitation({
    person, lines, ask, options, hint = '', talk = null, pack = '', place = '', town = '', night = false, placeLabel = '', mount = null,
}) {
    await loadPixelManifest();
    const who = text(person?.name);
    const dialog = openDialog(`${shownName(who)} te saluda`, mount);
    const root = el('div', 'qd-root qd-invite');
    root.dataset.person = who;
    const backdrop = el('div', 'qd-backdrop');
    const art = backdropFor({ place, town, pack, night });
    if (art) backdrop.style.setProperty('--qd-backdrop', `url("${new URL(art, document.baseURI).href}")`);
    backdrop.hidden = !art;
    const portrait = el('div', 'qd-portrait');
    const box = el('div', 'qd-box');
    const plate = el('div', 'qd-nameplate');
    const head = el('div', 'qd-head');
    head.appendChild(el('span', 'qd-title', text(placeLabel)));
    const said = el('div', 'qd-text');
    said.setAttribute('aria-live', 'polite');
    const chips = el('div', 'qd-chips');
    box.append(plate, head, said, chips);
    const aside = asideBox();
    root.append(backdrop, portrait, aside, box);
    dialog.appendChild(root);
    drawPortrait(portrait, portraitFor({ ...person, name: who, pack }), who);
    fillAside(aside, text(hint) ? [{ kind: 'hint', text: text(hint) }] : []);

    /** @type {Array<{kind: string, text: string}>} */
    const shown = (Array.isArray(lines) ? lines : []).filter(line => text(line)).map(line => ({ kind: 'say', text: text(line) }));
    const replies = Array.isArray(talk?.replies) ? talk.replies.filter(r => text(r?.text)).slice(0, 3) : [];
    if (talk && text(talk.say)) shown.push({ kind: 'say', text: text(talk.say) });
    let phase = replies.length > 0 ? 'talk' : 'ask';
    if (phase === 'ask') shown.push({ kind: 'say', text: text(ask) });
    /** @type {number|null} */
    let talkReply = null;

    return new Promise(resolve => {
        const close = (/** @type {string} */ choice) => {
            dialog.close();
            dialog.remove();
            resolve({ choice, talkReply });
        };
        /** @type {Array<{label: string, run: () => void}>} */
        let current = [];
        const draw = () => {
            said.textContent = '';
            chips.textContent = '';
            // J13.7: lo que dice enseña su nombre (al presentarse); la placa, después.
            for (const line of shown) if (line.kind === 'say') hearLine({ who, text: line.text });
            plate.textContent = knowsName(who) ? who.split(' ')[0] : shownName(who);
            for (const line of shown) {
                const p = el('p', `qd-line qd-${line.kind}`);
                if (line.kind === 'you') p.appendChild(el('span', 'qd-who', 'Tú'));
                p.appendChild(document.createTextNode(shownText(line.text, { mask: line.kind !== 'you' })));
                said.appendChild(p);
            }
            current = phase === 'talk'
                ? replies.map((reply, index) => ({
                    label: text(reply.text),
                    run: () => {
                        talkReply = index;
                        shown.push({ kind: 'you', text: text(reply.text) });
                        if (text(reply.then)) shown.push({ kind: 'then', text: text(reply.then) });
                        shown.push({ kind: 'say', text: text(ask) });
                        phase = 'ask';
                        draw();
                    },
                }))
                : options.map(option => ({ label: text(option.label), run: () => close(option.id) }));
            current.forEach((one, i) => {
                const button = /** @type {HTMLButtonElement} */ (el('button', `qd-chip qd-chip-reply${phase === 'ask' ? ' qd-chip-invite' : ''}`));
                button.type = 'button';
                if (phase === 'ask') button.dataset.choice = options[i]?.id ?? '';
                button.appendChild(el('span', 'qd-key', String(i + 1)));
                button.appendChild(el('span', 'qd-label', shownText(one.label, { mask: true })));
                button.addEventListener('click', one.run);
                chips.appendChild(button);
            });
            /** @type {HTMLElement|null} */ (chips.querySelector('button'))?.focus();
        };
        // Escape es «Hablamos en otro momento»: no se gasta nada.
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            close(options.find(o => o.id !== options[0]?.id)?.id ?? '');
        });
        dialog.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (/^[1-3]$/.test(event.key) && current[Number(event.key) - 1]) {
                event.preventDefault();
                current[Number(event.key) - 1].run();
            }
        });
        draw();
    });
}

/**
 * Elegir con quién quedar y dónde. Primero la persona (quien quiere quedar contigo, delante),
 * luego el sitio (los que le gustan, marcados). Devuelve lo elegido, o null.
 *
 * @param {Object} input
 * @param {Array<{key?: string, name: string, place?: string, placeLabel?: string, wantsToMeet?: boolean, why?: string,
 *   rankLabel?: string, className?: string, gender?: string}>} input.people
 * @param {(person: any) => Array<{id: string, label: string, liked?: boolean}>} input.placesFor
 * @param {string} [input.pack]
 * @param {string} [input.slotLabel] La franja, para el título («Tarde»).
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<{name: string, key: string, place: string}|null>}
 */
export async function openMeetupPicker({ people, placesFor, pack = '', slotLabel = '', mount = null }) {
    await loadPixelManifest();
    const dialog = openDialog('Quedar con alguien', mount, 'qd-dialog-picker');
    const root = el('div', 'qd-root qd-picker');
    const box = el('div', 'qd-pick-box');
    root.appendChild(box);
    dialog.appendChild(root);
    const cards = pickerCards(people);

    return new Promise(resolve => {
        const close = (/** @type {{name: string, key: string, place: string}|null} */ chosen) => {
            dialog.close();
            dialog.remove();
            resolve(chosen);
        };
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            close(null);
        });
        dialog.addEventListener('keydown', (event) => event.stopPropagation());
        const button = (/** @type {string} */ className, /** @type {string} */ label, /** @type {() => void} */ onClick) => {
            const b = /** @type {HTMLButtonElement} */ (el('button', className, label));
            b.type = 'button';
            b.addEventListener('click', onClick);
            return b;
        };
        const whoStep = () => {
            box.textContent = '';
            box.appendChild(el('h3', 'qd-pick-title', slotLabel ? `Quedar con alguien · ${slotLabel}` : 'Quedar con alguien'));
            box.appendChild(el('p', 'qd-pick-sub', 'Pasas esta parte del día con alguien de tu gente. Elige con quién.'));
            const grid = el('div', 'qd-pick-grid');
            for (const person of cards) {
                const card = button('qd-pick-card', '', () => whereStep(person));
                card.dataset.person = text(person.key || person.name);
                if (person.wantsToMeet) card.classList.add('qd-eager');
                const face = el('div', 'qd-pick-face');
                drawPortrait(face, portraitFor({ ...person, pack }), text(person.name));
                card.appendChild(face);
                card.appendChild(el('div', 'qd-pick-name', text(person.name)));
                if (person.where || person.rankLabel) card.appendChild(el('div', 'qd-pick-where', [person.where, person.rankLabel].filter(Boolean).join(' · ')));
                if (person.badge) {
                    const badge = el('div', 'qd-pick-badge');
                    badge.appendChild(el('i', 'fa-solid fa-heart'));
                    badge.appendChild(document.createTextNode(` ${person.badge}`));
                    if (person.why) badge.title = text(person.why);
                    card.appendChild(badge);
                }
                grid.appendChild(card);
            }
            if (cards.length === 0) grid.appendChild(el('p', 'qd-pick-sub', 'Aquí y ahora no hay nadie de tu gente con quien quedar.'));
            box.appendChild(grid);
            box.appendChild(button('menu_button qd-pick-close', 'Ahora no', () => close(null)));
            /** @type {HTMLElement|null} */ (box.querySelector('.qd-pick-card'))?.focus();
        };
        const whereStep = (/** @type {any} */ person) => {
            box.textContent = '';
            box.appendChild(el('h3', 'qd-pick-title', `¿Dónde quedas con ${text(person.name)}?`));
            box.appendChild(el('p', 'qd-pick-sub', 'Los sitios con corazón le gustan: allí os acercáis un poco más.'));
            const list = el('div', 'qd-chips qd-pick-places');
            for (const place of placesFor(person) ?? []) {
                const b = button('qd-chip qd-chip-place', '', () => close({ name: text(person.name), key: text(person.key), place: place.id }));
                b.dataset.place = place.id;
                if (place.liked) b.appendChild(el('i', 'fa-solid fa-heart qd-liked'));
                b.appendChild(el('span', 'qd-label', place.label));
                list.appendChild(b);
            }
            box.appendChild(list);
            box.appendChild(button('menu_button qd-pick-close', 'Atrás', whoStep));
            /** @type {HTMLElement|null} */ (list.querySelector('button'))?.focus();
        };
        whoStep();
    });
}
