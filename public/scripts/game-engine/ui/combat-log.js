/**
 * The combat log.
 *
 * This panel is the thing that actually saves the money. Every line it shows used to be a
 * sentence the model was asked to write: a move, a miss, six points of damage. The engine
 * already knows all of it, so the log prints it for free and the model is left with the
 * one job it is good at — the epilogue, once the fight is over.
 *
 * Entries are data, not markup. The renderer turns them into DOM; nothing here builds an
 * HTML string from a name, which is how the XSS in this codebase happened the first time.
 *
 * See wiki/ROADMAP.md, Fase B (B4).
 */

import { escapeHtml } from '../../party/html.js';

/**
 * @typedef {'round'|'move'|'attack'|'hit'|'miss'|'crit'|'damage'|'heal'|'down'|'loot'|'info'|'system'} LogKind
 */

/**
 * @typedef {Object} LogEntry
 * @property {LogKind} kind
 * @property {string} text
 * @property {number} [round]
 * @property {string} [actor]
 * @property {{formula: string, rolls: number[], total: number, natural: number|null, dc: number|null}} [roll]
 */

/** Icon and colour class per entry kind. Data, so the editor can extend it later. */
const KIND_STYLE = {
    round: { icon: 'fa-hourglass-start', cls: 'cl-round' },
    move: { icon: 'fa-shoe-prints', cls: 'cl-move' },
    attack: { icon: 'fa-crosshairs', cls: 'cl-attack' },
    hit: { icon: 'fa-burst', cls: 'cl-hit' },
    miss: { icon: 'fa-wind', cls: 'cl-miss' },
    crit: { icon: 'fa-star', cls: 'cl-crit' },
    damage: { icon: 'fa-droplet', cls: 'cl-damage' },
    heal: { icon: 'fa-heart-pulse', cls: 'cl-heal' },
    down: { icon: 'fa-skull', cls: 'cl-down' },
    loot: { icon: 'fa-sack-dollar', cls: 'cl-loot' },
    info: { icon: 'fa-circle-info', cls: 'cl-info' },
    system: { icon: 'fa-gear', cls: 'cl-system' },
};

const DEFAULT_STYLE = KIND_STYLE.info;

/** How many entries to keep before the oldest start dropping off. */
export const MAX_ENTRIES = 300;

/**
 * Los filtros del registro (idea 20): qué clase de línea, y de quién.
 *
 * «Mis tiradas» es Tiradas más tu nombre; «el daño que me han hecho», Daño más tu nombre.
 */
export const LOG_FILTERS = {
    all: 'Todo',
    rolls: 'Tiradas',
    damage: 'Daño',
};

/** Las clases de línea que cuentan como daño. */
const DAMAGE_KINDS = ['damage', 'hit', 'crit', 'down'];

/**
 * Si una línea habla de alguien: por la palabra más larga de su nombre, como la narración lo
 * escribe («el Guardián» por «Guardián del grano»).
 *
 * @param {LogEntry} item
 * @param {string} who
 * @returns {boolean}
 */
function mentions(item, who) {
    const anchor = String(who ?? '').trim().split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? '';
    if (anchor.length < 2) return true;
    const hay = `${item.actor ?? ''} ${item.text ?? ''}`.toLowerCase();
    return hay.includes(anchor.toLowerCase());
}

/**
 * Lo que queda del registro con un filtro puesto.
 *
 * @param {LogEntry[]} entries
 * @param {{kind?: string, who?: string}} [filter]
 * @returns {LogEntry[]}
 */
export function filterLog(entries, filter = {}) {
    const kind = String(filter?.kind ?? 'all');
    const who = String(filter?.who ?? '').trim();
    return (Array.isArray(entries) ? entries : []).filter(item => {
        if (item.kind === 'round') return kind === 'all' && !who;
        if (kind === 'rolls' && !item.roll) return false;
        if (kind === 'damage' && !DAMAGE_KINDS.includes(item.kind)) return false;
        return !who || mentions(item, who);
    });
}

/**
 * @param {LogKind} kind
 * @param {string} text
 * @param {Partial<LogEntry>} [extra]
 * @returns {LogEntry}
 */
export function entry(kind, text, extra = {}) {
    return { kind: KIND_STYLE[kind] ? kind : 'info', text: String(text ?? ''), ...extra };
}

/**
 * Turns a die roll into a log entry, including the breakdown.
 *
 * The breakdown is the point: a player who can see "d20(17) +5 = 22 vs CA 15" does not
 * have to take the engine's word for anything, which is what makes an unsupervised
 * resolver acceptable in the first place.
 *
 * @param {string} actor
 * @param {{formula: string, rolls: number[], total: number, natural: number|null}} roll
 * @param {number|null} dc
 * @param {string} label
 * @returns {LogEntry}
 */
export function rollEntry(actor, roll, dc, label) {
    const isCrit = roll.natural === 20;
    const isFumble = roll.natural === 1;
    const success = isCrit || (dc == null ? true : roll.total >= dc);

    const kind = isCrit ? 'crit' : isFumble ? 'miss' : success ? 'hit' : 'miss';
    return {
        kind,
        actor,
        text: label,
        roll: { ...roll, dc: dc ?? null },
    };
}

/**
 * The kind each combat line announces itself as, by its leading icon.
 *
 * The game has written its combat lines as text with an icon in front since before this
 * log existed. Rather than rewrite every call site to build entries by hand, the icon is
 * read as what it already is: a label. Data, so a rule pack can extend it later.
 *
 * @type {Array<[string, LogKind]>}
 */
const LINE_KINDS = [
    ['⏳', 'round'],
    ['🚶', 'move'],
    ['⚔️', 'attack'],
    ['👹', 'attack'],
    ['🗡️', 'attack'],
    ['❌', 'miss'],
    ['✅', 'hit'],
    ['💥', 'damage'],
    ['❤️', 'info'],
    ['☠️', 'down'],
    ['💀', 'down'],
    ['🏆', 'system'],
    ['🏁', 'system'],
    ['📜', 'system'],
    ['🚪', 'info'],
    ['💬', 'info'],
];

/** Lines already shown as a roll entry, so the log never says the same thing twice. */
const SKIPPED_LINE_PREFIX = '🎲';

/**
 * Turns one line of combat narration into a log entry.
 *
 * @param {string} line
 * @returns {LogEntry|null} Null when the line is empty or already logged as a roll.
 */
export function lineToEntry(line) {
    const text = String(line ?? '').trim();
    if (!text) return null;
    if (text.startsWith(SKIPPED_LINE_PREFIX)) return null;

    for (const [icon, kind] of LINE_KINDS) {
        if (text.startsWith(icon)) {
            // The tag the chat needs is noise in a panel already titled "Registro de combate".
            const stripped = text.slice(icon.length).replace('[COMBAT]', '').trim();
            return entry(kind, stripped || text);
        }
    }

    return entry('info', text.replace('[COMBAT]', '').trim());
}

/**
 * Appends an entry, trimming the oldest once the log is full.
 * @param {LogEntry[]} entries
 * @param {LogEntry} next
 * @returns {LogEntry[]}
 */
export function append(entries, next) {
    const list = [...(Array.isArray(entries) ? entries : []), next];
    return list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list;
}

/**
 * Renders the roll breakdown, or an empty string when there is none.
 * @param {LogEntry} item
 * @returns {string}
 */
function renderRoll(item) {
    if (!item.roll) return '';

    const { formula, rolls, total, natural, dc } = item.roll;
    const dice = Array.isArray(rolls) && rolls.length ? rolls.join(' + ') : String(total);
    const target = dc == null ? '' : ` <span class="cl-dc">vs ${escapeHtml(String(dc))}</span>`;
    const naturalTag = natural === 20
        ? ' <span class="cl-nat cl-nat-20">NAT 20</span>'
        : natural === 1
            ? ' <span class="cl-nat cl-nat-1">NAT 1</span>'
            : '';

    return `<span class="cl-roll"><span class="cl-formula">${escapeHtml(formula)}</span>`
        + `<span class="cl-dice">${escapeHtml(dice)}</span>`
        + `<span class="cl-total">${escapeHtml(String(total))}</span>${target}${naturalTag}</span>`;
}

/**
 * Renders the whole log into a container.
 *
 * @param {JQuery} container
 * @param {LogEntry[]} entries
 * @param {{ autoScroll?: boolean }} [options]
 */
export function renderCombatLog(container, entries, options = {}) {
    const { autoScroll = true } = options;
    const list = Array.isArray(entries) ? entries : [];

    const body = container.find('.cl-body');
    const target = body.length ? body : container;
    target.empty();

    if (list.length === 0) {
        target.append('<div class="cl-empty">Sin actividad de combate.</div>');
        return;
    }

    for (const item of list) {
        const style = KIND_STYLE[item.kind] || DEFAULT_STYLE;
        const row = $('<div class="cl-row"></div>').addClass(style.cls);

        row.append(`<i class="cl-icon fa-solid ${style.icon}"></i>`);

        const text = $('<span class="cl-text"></span>');
        if (item.actor) {
            text.append($('<span class="cl-actor"></span>').text(item.actor));
        }
        text.append(document.createTextNode(item.text));
        row.append(text);

        if (item.roll) {
            row.append(renderRoll(item));
        }

        target.append(row);
    }

    if (autoScroll) {
        target.scrollTop(target[0].scrollHeight);
    }
}

/**
 * Builds the panel shell. The caller drops it wherever it belongs.
 * @param {{ title?: string }} [options]
 * @returns {JQuery}
 */
export function createCombatLogPanel(options = {}) {
    const { title = 'Registro de combate' } = options;

    const panel = $(`
        <div class="combat-log-panel">
            <div class="cl-header">
                <i class="fa-solid fa-scroll"></i>
                <span class="cl-title"></span>
                <span class="cl-round-badge"></span>
                <button class="cl-collapse" title="Plegar"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="cl-filters"></div>
            <div class="cl-body"></div>
        </div>
    `);

    panel.find('.cl-title').text(title);
    panel.find('.cl-collapse').on('click', () => {
        panel.toggleClass('collapsed');
        panel.find('.cl-collapse i')
            .toggleClass('fa-chevron-down')
            .toggleClass('fa-chevron-up');
    });

    return panel;
}

/**
 * Los botones de filtro (idea 20): la clase de línea y, si se quiere, de quién.
 *
 * El filtro vive en el propio panel (`data-kind`, `data-who`), así que sobrevive a cada
 * repintado sin que quien llama tenga que guardarlo.
 *
 * @param {JQuery} panel
 * @param {string[]} people Quién está en el combate, para el desplegable.
 * @param {() => void} onChange
 */
export function renderLogFilters(panel, people, onChange) {
    const box = panel.find('.cl-filters');
    if (!box.length) return;
    const kind = String(panel.attr('data-kind') || 'all');
    const who = String(panel.attr('data-who') || '');
    box.empty();
    for (const [id, label] of Object.entries(LOG_FILTERS)) {
        const button = $('<button type="button" class="cl-filter"></button>')
            .attr('data-kind', id).text(label).toggleClass('active', id === kind);
        button.on('click', () => {
            panel.attr('data-kind', id);
            onChange();
        });
        box.append(button);
    }
    const select = $('<select class="cl-who"></select>');
    select.append($('<option value=""></option>').text('De todos'));
    for (const name of people) select.append($('<option></option>').attr('value', name).text(name));
    select.val(who);
    select.on('change', () => {
        panel.attr('data-who', String(select.val() || ''));
        onChange();
    });
    box.append(select);
}

/**
 * El filtro puesto en el panel.
 *
 * @param {JQuery} panel
 * @returns {{kind: string, who: string}}
 */
export function logFilterOf(panel) {
    return { kind: String(panel?.attr?.('data-kind') || 'all'), who: String(panel?.attr?.('data-who') || '') };
}

/**
 * Updates the round badge in the header.
 * @param {JQuery} panel
 * @param {number} round
 */
export function setRound(panel, round) {
    const badge = panel.find('.cl-round-badge');
    if (!round) {
        badge.text('').hide();
        return;
    }
    badge.text(`Ronda ${round}`).show();
}

/**
 * Condenses a fight into the handful of facts the model needs for its one call.
 *
 * Deliberately small. The point of the epilogue is that it replaces twenty narration
 * requests with one, and that only holds if the prompt does not grow to twenty times the
 * size. Blow-by-blow detail stays in the log, where it costs nothing.
 *
 * @param {LogEntry[]} entries
 * @param {{ rounds: number, victory: boolean, abandoned?: boolean, survivors: string[], defeated: string[], killingBlow?: {actor: string, target: string} }} outcome
 * @returns {string}
 */
export function buildEpiloguePrompt(entries, outcome) {
    const { rounds, victory, abandoned = false, survivors = [], defeated = [], killingBlow } = outcome;

    // Walking away is neither a win nor a defeat, and calling it one puts the model to
    // work writing the wrong scene: the first real epilogue announced a party that was
    // standing and unhurt as having been defeated.
    const headline = abandoned
        ? 'El grupo abandona el combate sin resolverlo.'
        : victory ? 'El grupo ha ganado el combate.' : 'El grupo ha sido derrotado.';

    const lines = [
        headline,
        `Duración: ${rounds} ronda${rounds === 1 ? '' : 's'}.`,
    ];

    if (defeated.length) lines.push(`Derrotados: ${defeated.join(', ')}.`);
    if (survivors.length) lines.push(`En pie: ${survivors.join(', ')}.`);
    if (killingBlow) lines.push(`El golpe final lo dio ${killingBlow.actor} sobre ${killingBlow.target}.`);

    const crits = (Array.isArray(entries) ? entries : []).filter(e => e.kind === 'crit');
    if (crits.length) {
        lines.push(`Momentos críticos: ${crits.slice(0, 3).map(c => `${c.actor || 'alguien'} ${c.text}`).join('; ')}.`);
    }

    lines.push('Describe la escena en un párrafo breve. No inventes resultados de dados ni cambies el estado del combate.');

    return lines.join('\n');
}
