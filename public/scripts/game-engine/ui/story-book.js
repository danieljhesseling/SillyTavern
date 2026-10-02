/**
 * El Diario como un libro (J9.6 de wiki/ROADMAP_SIN_CONEXION.md), con los plazos a la vista
 * (J9.5) y lo que decidisteis, para buscarlo (J11.5).
 *
 * A la izquierda, el índice: cada capítulo con su nombre (el que no ha empezado, en blanco),
 * «Lo que decidisteis», los apuntes de siempre y, si se llegó, el final. A la derecha, la página:
 * la viñeta del sitio, el capítulo con su entrada, cada hito como un párrafo con lo que decidisteis
 * y lo que salió de ello, y al pie las flechas para pasar de capítulo. En el móvil, el índice va
 * arriba, en una tira que se desliza.
 *
 * Se abre sola, sin `party.js`: un `<dialog>` modal encima de lo que haya (el Modo Juego, o el
 * tablón del gremio para leer la crónica de una campaña). Lo que se lee lo monta
 * `campaign/story-book.js`; aquí solo se dibuja. Teclas: flechas izquierda y derecha pasan de
 * capítulo; Escape cierra.
 */

import { searchDecided } from '../campaign/story-book.js';
import { loadPixelManifest } from './pixel-art.js';
import { backdropFor } from './meetup-scene.js';
import { maskShown } from './shown-names.js';

/** @typedef {import('../campaign/story-book.js').StoryBook} StoryBook */
/** @typedef {import('../campaign/story-book.js').BookChapter} BookChapter */
/** @typedef {import('../campaign/story-book.js').BookPage} BookPage */
/** @typedef {import('../campaign/story-book.js').BookClock} BookClock */
/** @typedef {import('../campaign/story-book.js').BookDecision} BookDecision */

/**
 * @typedef {Object} BookNotes Lo que el Diario apuntaba antes, por secciones: sigue en «Apuntes».
 * @property {string} title
 * @property {string[]} items
 */

/**
 * @typedef {Object} BookChronicle La crónica del chat por categorías, con su filtro (`chronicleSections`).
 * @property {string} category
 * @property {string} title
 * @property {string[]} items
 */

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

/** @param {string} name @returns {HTMLElement} */
const icon = (name) => {
    const node = el('i', `fa-solid ${name}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
};

/** Cómo se dice el estado de cada página. */
const PAGE_TAGS = { hecho: 'Hecho', abierto: 'Entre manos', perdido: 'Se pasó el plazo', cerrado: 'Camino cerrado' };

/** El icono del reloj, según lo apurado que va. */
const CLOCK_ICONS = { hoy: 'fa-hourglass-end', pronto: 'fa-hourglass-half', holgado: 'fa-hourglass-start' };

/**
 * J9.5: el reloj de un hito, para ponerlo junto a lo que tenéis entre manos (en la cabecera del
 * juego) o en la página del libro: «⏳ Quedan 2 días», en ámbar si aprieta y en rojo el último día.
 *
 * @param {BookClock|null} clock
 * @param {{long?: boolean}} [options] `long`: con el nombre del hito («La nieve manchada»: quedan 2 días de 3).
 * @returns {HTMLElement|null}
 */
export function deadlineBadge(clock, { long = false } = {}) {
    if (!clock) return null;
    const badge = el('span', 'lb-badge');
    badge.dataset.urgency = clock.urgency;
    badge.dataset.milestone = clock.id;
    badge.title = `${clock.line} ${clock.late}`.trim();
    badge.appendChild(icon(CLOCK_ICONS[clock.urgency] ?? 'fa-hourglass-half'));
    badge.appendChild(el('span', 'lb-badge-text', long ? clock.line : clock.label));
    return badge;
}

/**
 * Una lista con título pequeño: «Lo que salió», «Lo que os contaron»…
 *
 * @param {string} className
 * @param {string} title
 * @param {string[]} items
 * @returns {HTMLElement|null}
 */
function smallList(className, title, items) {
    if (!items || items.length === 0) return null;
    const box = el('div', `lb-list ${className}`);
    box.appendChild(el('h5', 'lb-list-title', title));
    const list = el('ul', 'lb-list-items');
    for (const item of items) list.appendChild(el('li', '', item));
    box.appendChild(list);
    return box;
}

/**
 * Una decisión y lo que salió de ella.
 *
 * @param {BookDecision} decision
 * @param {{where?: boolean}} [options] Con el capítulo y la página (en la crónica).
 * @returns {HTMLElement}
 */
function decisionItem(decision, { where = false } = {}) {
    const item = el('li', 'lb-decision');
    item.appendChild(el('span', 'lb-said', decision.text));
    if (where) {
        const bits = [decision.page, decision.day > 0 ? `día ${decision.day}` : ''].filter(Boolean);
        if (bits.length > 0) item.appendChild(el('span', 'lb-where', bits.join(' · ')));
    }
    if (decision.came.length > 0) {
        const came = el('ul', 'lb-came');
        for (const line of decision.came) came.appendChild(el('li', '', line));
        item.appendChild(came);
    }
    return item;
}

/**
 * Lo decidido, con su título.
 *
 * @param {string} title
 * @param {BookDecision[]} decided
 * @returns {HTMLElement|null}
 */
function decisionsBox(title, decided) {
    if (!decided || decided.length === 0) return null;
    const box = el('div', 'lb-list lb-decisions');
    box.appendChild(el('h5', 'lb-list-title', title));
    const list = el('ul', 'lb-decision-list');
    for (const decision of decided) list.appendChild(decisionItem(decision));
    box.appendChild(list);
    return box;
}

/**
 * Un hito, como párrafo del libro.
 *
 * @param {BookPage} page
 * @returns {HTMLElement}
 */
function entry(page) {
    const box = el('section', 'lb-entry');
    box.dataset.state = page.state;
    box.dataset.page = page.id;
    if (page.secret) box.dataset.secret = 'true';
    const head = el('header', 'lb-entry-head');
    head.appendChild(el('h4', 'lb-entry-title', page.title));
    head.appendChild(el('span', 'lb-tag', page.secret ? 'Secreto encontrado' : PAGE_TAGS[page.state] ?? ''));
    box.appendChild(head);
    if (page.text) box.appendChild(el('p', 'lb-entry-text', page.text));
    if (page.hint) {
        const hint = el('p', 'lb-entry-hint');
        hint.appendChild(el('strong', '', 'Lo que toca: '));
        hint.appendChild(document.createTextNode(page.hint));
        box.appendChild(hint);
    }
    if (page.clock) {
        const clock = el('p', 'lb-entry-clock');
        const badge = deadlineBadge(page.clock);
        if (badge) clock.appendChild(badge);
        clock.appendChild(el('span', 'lb-late', page.clock.late));
        box.appendChild(clock);
    }
    for (const part of [decisionsBox('Lo que decidisteis', page.decided), smallList('lb-outcome', page.state === 'cerrado' ? 'Por qué' : 'Lo que salió', page.came)]) {
        if (part) box.appendChild(part);
    }
    return box;
}

/**
 * La viñeta del capítulo: el sitio donde pasa, si hay dibujo; si no, nada.
 *
 * @param {BookChapter} chapter
 * @param {string} pack
 * @returns {HTMLElement|null}
 */
function vignette(chapter, pack) {
    const url = chapter.state === 'en-blanco' ? '' : backdropFor({ place: chapter.backdrop.place, town: chapter.backdrop.town, pack });
    if (!url) return null;
    const box = el('div', 'lb-vignette');
    const image = /** @type {HTMLImageElement} */ (el('img', 'pixel-art'));
    image.alt = '';
    image.src = url;
    image.addEventListener('error', () => box.remove());
    box.appendChild(image);
    return box;
}

/**
 * Lo que dice cada capítulo en el índice, debajo de su nombre.
 *
 * @param {BookChapter} chapter
 * @returns {string}
 */
function tabNote(chapter) {
    if (chapter.state === 'en-blanco') return 'En blanco';
    if (chapter.state === 'ahora') return 'Aquí estáis';
    return chapter.pending > 0 ? `${chapter.pending} por hacer` : 'Hecho';
}

/**
 * La línea de bajo el título: por qué capítulo vais, o que la historia ya acabó.
 *
 * @param {StoryBook} book
 * @returns {string}
 */
export function nowLine(book) {
    const now = book?.now;
    if (!now) return '';
    if (now.ended) return `La historia llegó a su final${book.ending ? `: ${book.ending.title}` : ''}.`;
    if (now.of > 1) return `Vais por el capítulo ${now.number} de ${now.of}${now.title ? `: ${now.title}` : ''}.`;
    return now.title ? `${now.title}.` : '';
}

/**
 * Dibujar el libro. Devuelve su raíz (`.lb-root`); `openStoryBook` la pone en su ventana.
 *
 * @param {StoryBook} book
 * @param {Object} [options]
 * @param {string} [options.pack] El paquete de la campaña, para las viñetas.
 * @param {BookNotes[]} [options.notes] Los apuntes de siempre (lo que viene, lo oído, los secretos…).
 * @param {BookChronicle[]} [options.chronicle] La crónica del chat, con su filtro.
 * @param {string} [options.view] Por dónde se abre: `chapter:<acto>`, `decided`, `notes` o `ending`.
 * @param {string} [options.kicker] Lo que va sobre el título: «Diario», o «La crónica» desde el gremio.
 * @param {() => void} [options.onClose]
 * @returns {HTMLElement}
 */
export function renderStoryBook(book, { pack = '', notes = [], chronicle = [], view = '', kicker = 'Diario', onClose = () => {} } = {}) {
    const root = el('div', 'lb-root');
    const head = el('header', 'lb-head');
    const titles = el('div', 'lb-titles');
    titles.appendChild(el('div', 'lb-kicker', kicker));
    titles.appendChild(el('h2', 'lb-title', book.title));
    const where = nowLine(book);
    if (where) {
        const now = el('p', 'lb-now');
        now.appendChild(icon(book.now?.ended ? 'fa-flag-checkered' : 'fa-bookmark'));
        now.appendChild(el('span', '', where));
        titles.appendChild(now);
    }
    head.appendChild(titles);
    const close = /** @type {HTMLButtonElement} */ (el('button', 'menu_button lb-close'));
    close.type = 'button';
    close.appendChild(icon('fa-xmark'));
    close.appendChild(el('span', '', 'Cerrar'));
    close.addEventListener('click', () => onClose());
    head.appendChild(close);
    root.appendChild(head);

    // J9.5: los plazos, arriba y a la vista, del más apurado al más holgado.
    if (book.clocks.length > 0) {
        const clocks = el('div', 'lb-clocks');
        clocks.setAttribute('role', 'status');
        for (const clock of book.clocks) {
            const badge = deadlineBadge(clock, { long: true });
            if (badge) clocks.appendChild(badge);
        }
        root.appendChild(clocks);
    }

    const body = el('div', 'lb-body');
    const toc = el('nav', 'lb-toc');
    toc.setAttribute('aria-label', 'Índice del diario');
    const page = el('article', 'lb-page');
    page.tabIndex = -1;
    body.appendChild(toc);
    body.appendChild(page);
    root.appendChild(body);

    const readable = book.chapters.filter(c => c.state !== 'en-blanco');
    /** @type {Array<{view: string, label: string, note: string, state: string, disabled: boolean, number: string, iconName: string}>} */
    const tabs = book.chapters.map(chapter => ({
        view: `chapter:${chapter.act}`,
        label: chapter.title || chapter.name,
        note: tabNote(chapter),
        state: chapter.state,
        disabled: chapter.state === 'en-blanco',
        number: String(chapter.number),
        iconName: '',
    }));
    tabs.push({ view: 'decided', label: 'Lo que decidisteis', note: book.decided.length > 0 ? `${book.decided.length}` : 'Nada aún', state: 'extra', disabled: false, number: '', iconName: 'fa-scale-balanced' });
    if (notes.length > 0 || chronicle.length > 0) tabs.push({ view: 'notes', label: 'Apuntes', note: 'Lo oído, lo que viene…', state: 'extra', disabled: false, number: '', iconName: 'fa-feather' });
    if (book.ending) tabs.push({ view: 'ending', label: 'El final', note: book.ending.title, state: 'extra', disabled: false, number: '', iconName: 'fa-flag-checkered' });

    /** @type {Map<string, HTMLButtonElement>} */
    const tabButtons = new Map();
    for (const tab of tabs) {
        const button = /** @type {HTMLButtonElement} */ (el('button', 'lb-tab'));
        button.type = 'button';
        button.dataset.view = tab.view;
        button.dataset.state = tab.state;
        if (tab.disabled) {
            button.setAttribute('aria-disabled', 'true');
            button.title = 'Todavía no ha empezado: se escribe jugando.';
        }
        const mark = el('span', 'lb-tab-mark');
        if (tab.number) mark.textContent = tab.number;
        else mark.appendChild(icon(tab.iconName));
        button.appendChild(mark);
        const words = el('span', 'lb-tab-words');
        words.appendChild(el('span', 'lb-tab-name', tab.label));
        words.appendChild(el('span', 'lb-tab-note', tab.note));
        button.appendChild(words);
        button.addEventListener('click', () => { if (!tab.disabled) show(tab.view); });
        toc.appendChild(button);
        tabButtons.set(tab.view, button);
    }

    /** @type {string} */
    let current = '';

    /**
     * Un capítulo.
     *
     * @param {BookChapter} chapter
     */
    const drawChapter = (chapter) => {
        const art = vignette(chapter, pack);
        if (art) page.appendChild(art);
        page.appendChild(el('div', 'lb-chapter-name', chapter.name));
        page.appendChild(el('h3', 'lb-chapter-title', chapter.title || (chapter.state === 'en-blanco' ? 'En blanco' : chapter.name)));
        if (chapter.summary) page.appendChild(el('p', 'lb-epigraph', chapter.summary));
        if (chapter.state === 'en-blanco') {
            page.appendChild(el('p', 'lb-blank', 'Estas páginas siguen en blanco. Se escriben jugando.'));
            return;
        }
        if (chapter.pages.length === 0 && chapter.decided.length === 0) {
            page.appendChild(el('p', 'lb-blank', 'Todavía no ha pasado nada que contar en este capítulo.'));
        }
        const entries = el('div', 'lb-entries');
        for (const one of chapter.pages) entries.appendChild(entry(one));
        page.appendChild(entries);
        for (const part of [
            decisionsBox('Por el camino decidisteis', chapter.decided),
            smallList('lb-road', 'Lo que pasó por el camino', chapter.road),
            smallList('lb-told', 'Lo que os contaron', chapter.told),
            smallList('lb-moments', 'Con los vuestros', chapter.moments),
        ]) {
            if (part) page.appendChild(part);
        }
        if (chapter.closing) page.appendChild(el('p', 'lb-closing', chapter.closing));
    };

    /** J11.5: lo decidido en toda la campaña, con un buscador. */
    const drawDecided = () => {
        page.appendChild(el('div', 'lb-chapter-name', book.title));
        page.appendChild(el('h3', 'lb-chapter-title', 'Lo que decidisteis'));
        page.appendChild(el('p', 'lb-epigraph', 'Lo que elegisteis en esta campaña, capítulo a capítulo, y lo que salió de ello.'));
        if (book.decided.length === 0) {
            page.appendChild(el('p', 'lb-blank', 'Todavía no habéis decidido nada que cambie la historia. Se apunta aquí cuando elegís en una escena o en un suceso.'));
            return;
        }
        const search = /** @type {HTMLInputElement} */ (el('input', 'text_pole lb-search'));
        search.type = 'search';
        search.placeholder = 'Buscar: un nombre, un sitio, una palabra…';
        search.setAttribute('aria-label', 'Buscar en lo que decidisteis');
        const count = el('p', 'lb-count');
        count.setAttribute('role', 'status');
        const results = el('div', 'lb-decided');
        const fill = () => {
            const query = search.value;
            const found = searchDecided(book.decided, query);
            results.textContent = '';
            count.textContent = found.length === 0 ? `Nada con «${query.trim()}».`
                : text(query) ? `${found.length} de ${book.decided.length}` : `${found.length} ${found.length === 1 ? 'decisión' : 'decisiones'}`;
            /** @type {Map<string, BookDecision[]>} */
            const byWhere = new Map();
            for (const decision of found) byWhere.set(decision.where, [...(byWhere.get(decision.where) ?? []), decision]);
            for (const [where, list] of byWhere) {
                const group = el('section', 'lb-decided-group');
                group.appendChild(el('h4', 'lb-decided-where', where || 'Sin capítulo'));
                const items = el('ul', 'lb-decision-list');
                for (const decision of list) items.appendChild(decisionItem(decision, { where: true }));
                group.appendChild(items);
                results.appendChild(group);
            }
        };
        search.addEventListener('input', fill);
        // Las flechas del buscador son para escribir, no para pasar de capítulo.
        search.addEventListener('keydown', (event) => event.stopPropagation());
        page.appendChild(search);
        page.appendChild(count);
        page.appendChild(results);
        fill();
    };

    /** Lo de siempre: lo que viene, lo oído, los secretos… y la crónica del chat con su filtro. */
    const drawNotes = () => {
        page.appendChild(el('div', 'lb-chapter-name', book.title));
        page.appendChild(el('h3', 'lb-chapter-title', 'Apuntes'));
        for (const section of notes) {
            const part = smallList('lb-note', section.title, section.items);
            if (part) page.appendChild(part);
        }
        if (chronicle.length === 0) return;
        page.appendChild(el('h4', 'lb-notes-head', 'Crónica'));
        const filters = el('div', 'lb-filters');
        const list = el('ul', 'lb-list-items lb-chronicle');
        for (const section of chronicle) {
            for (const item of section.items) {
                const line = el('li', 'lb-chron', `${section.title}: ${item}`);
                line.dataset.cat = section.category;
                list.appendChild(line);
            }
        }
        const filter = (/** @type {string} */ only) => {
            for (const chip of filters.querySelectorAll('.lb-filter')) chip.classList.toggle('lb-filter-on', /** @type {HTMLElement} */ (chip).dataset.cat === only);
            for (const line of list.querySelectorAll('.lb-chron')) /** @type {HTMLElement} */ (line).hidden = Boolean(only) && /** @type {HTMLElement} */ (line).dataset.cat !== only;
        };
        for (const [category, label] of [['', 'Todo'], ...chronicle.map(s => [s.category, s.title])]) {
            const chip = /** @type {HTMLButtonElement} */ (el('button', 'menu_button lb-filter', label));
            chip.type = 'button';
            chip.dataset.cat = category;
            chip.addEventListener('click', () => filter(category));
            filters.appendChild(chip);
        }
        page.appendChild(filters);
        page.appendChild(list);
        filter('');
    };

    const drawEnding = () => {
        if (!book.ending) return;
        page.appendChild(el('div', 'lb-chapter-name', 'El final'));
        page.appendChild(el('h3', 'lb-chapter-title', book.ending.title));
        if (book.ending.scene) page.appendChild(el('p', 'lb-entry-text lb-ending-text', book.ending.scene));
        const people = smallList('lb-epilogues', 'Lo que dejáis atrás', book.ending.epilogues);
        if (people) page.appendChild(people);
    };

    /** Las flechas del pie: el capítulo de antes y el de después que se pueden leer. */
    const drawTurn = () => {
        if (!current.startsWith('chapter:')) return;
        const act = Number(current.slice('chapter:'.length));
        const at = book.chapters.findIndex(c => c.act === act);
        const before = book.chapters[at - 1];
        const after = book.chapters[at + 1];
        const turn = el('footer', 'lb-turn');
        /** @param {BookChapter|undefined} chapter @param {'prev'|'next'} way */
        const arrow = (chapter, way) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', `menu_button lb-turn-${way}`));
            button.type = 'button';
            const blank = !chapter || chapter.state === 'en-blanco';
            button.disabled = blank;
            if (way === 'prev') button.appendChild(icon('fa-chevron-left'));
            button.appendChild(el('span', '', chapter ? chapter.name : way === 'prev' ? 'Principio' : 'Fin'));
            if (way === 'next') button.appendChild(icon('fa-chevron-right'));
            if (!blank && chapter) button.addEventListener('click', () => show(`chapter:${chapter.act}`));
            return button;
        };
        turn.appendChild(arrow(before, 'prev'));
        turn.appendChild(el('span', 'lb-folio', `${at + 1} / ${book.chapters.length}`));
        turn.appendChild(arrow(after, 'next'));
        page.appendChild(turn);
    };

    /** @param {string} next */
    const show = (next) => {
        current = next;
        page.textContent = '';
        page.dataset.view = next;
        for (const [id, button] of tabButtons) {
            const on = id === next;
            button.classList.toggle('lb-tab-on', on);
            if (on) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        }
        if (next === 'decided') drawDecided();
        else if (next === 'notes') drawNotes();
        else if (next === 'ending') drawEnding();
        else {
            const act = Number(next.slice('chapter:'.length));
            const chapter = book.chapters.find(c => c.act === act);
            if (chapter) drawChapter(chapter);
        }
        drawTurn();
        page.scrollTop = 0;
        tabButtons.get(next)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };

    /** Pasar de capítulo con las flechas. @param {number} step */
    const turnPage = (step) => {
        if (!current.startsWith('chapter:')) return;
        const act = Number(current.slice('chapter:'.length));
        const at = readable.findIndex(c => c.act === act);
        const to = readable[at + step];
        if (to) show(`chapter:${to.act}`);
    };
    root.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') turnPage(-1);
        else if (event.key === 'ArrowRight') turnPage(1);
    });

    // Se abre por donde se pida; si no, por el capítulo en el que estáis (o el último que se lee).
    const wanted = tabs.find(t => t.view === view && !t.disabled)?.view;
    const nowView = book.now && readable.some(c => c.act === book.now?.act) ? `chapter:${book.now.act}` : '';
    const fallback = readable.length > 0 ? `chapter:${readable[readable.length - 1].act}` : (notes.length > 0 ? 'notes' : 'decided');
    show(wanted || (book.empty && notes.length > 0 ? 'notes' : '') || nowView || fallback);
    return root;
}

/**
 * Abrir el libro en su ventana. Se cierra con «Cerrar», con Escape o pulsando fuera.
 *
 * @param {Object} input
 * @param {StoryBook} input.book
 * @param {string} [input.pack]
 * @param {BookNotes[]} [input.notes]
 * @param {BookChronicle[]} [input.chronicle]
 * @param {string} [input.view]
 * @param {string} [input.kicker]
 * @param {HTMLElement|null} [input.mount]
 * @returns {Promise<void>} Cuando se cierra.
 */
export async function openStoryBook({ book, pack = '', notes = [], chronicle = [], view = '', kicker = 'Diario', mount = null }) {
    await loadPixelManifest();
    const dialog = /** @type {HTMLDialogElement} */ (el('dialog', 'lb-dialog'));
    dialog.setAttribute('aria-label', `${kicker}: ${book.title}`);
    (mount ?? document.querySelector('.gs-root') ?? document.body).appendChild(dialog);
    return new Promise(resolve => {
        const done = () => {
            if (!dialog.isConnected) return;
            dialog.close();
            dialog.remove();
            resolve();
        };
        const root = renderStoryBook(book, { pack, notes, chronicle, view, kicker, onClose: done });
        dialog.appendChild(root);
        // J13.7: quien aún no se ha presentado sale por lo que es, también al pasar de página.
        maskShown(root);
        if (typeof MutationObserver === 'function') new MutationObserver(() => maskShown(root)).observe(root, { childList: true, subtree: true });
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            done();
        });
        // Pulsar fuera del libro (en el fondo oscuro) lo cierra.
        dialog.addEventListener('click', (event) => { if (event.target === dialog) done(); });
        // Las teclas del libro no llegan al juego de debajo.
        dialog.addEventListener('keydown', (event) => { if (event.key !== 'Escape') event.stopPropagation(); });
        dialog.showModal();
        /** @type {HTMLElement|null} */ (root.querySelector('.lb-tab-on'))?.focus();
    });
}
