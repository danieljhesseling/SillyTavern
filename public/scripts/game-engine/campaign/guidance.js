/**
 * Que nadie se quede sin saber que hacer: el diario, las pistas que escalan y la lista de
 * lo que se puede hacer aqui (ideas 100, 103 y 136).
 *
 * - **El diario** junta lo que el grupo sabe: lo que tiene entre manos, las pistas que se le
 *   han dado, el encargo aceptado y lo que ha oido, con quien lo dijo y adonde lleva.
 * - **Las pistas escalan**: si un hito lleva dias abierto sin moverse, llega una pista. A los
 *   3 dias, una que apunta; a los 6, una que dice exactamente que hacer. Salen de lo que el
 *   hito pide (llegar, ganar, hablar, tirar), asi que nunca mienten.
 * - **La ayuda** es la lista de todo lo que se puede hacer ahora, junta y pulsable.
 *
 * Puro: decide el texto. Quien llama lo ensena y lo cuenta.
 */

/** Los dias sin avanzar que hacen falta para cada pista: la que apunta y la clara. */
export const STALL_DAYS = [3, 6];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * La pista de un hito, del nivel que toque.
 *
 * @param {{title: string, asks: {kind: string, place?: string, board?: string, enemy?: string, npc?: string, skill?: string, options?: any[], clues?: Array<{place: string, skill: string}>, need?: number}}} milestone
 * @param {1|2} level 1 apunta; 2 dice que hacer.
 * @param {(skill: string) => string} [skillLabel]
 * @returns {string}
 */
export function hintFor(milestone, level, skillLabel = s => s) {
    const asks = milestone?.asks ?? { kind: 'none' };
    // Idea 101: varias formas. La primera pista apunta a la primera; la segunda las dice todas.
    if (asks.kind === 'any') {
        const ways = (asks.options ?? []).map((/** @type {any} */ option) => hintFor({ ...milestone, asks: option }, level, skillLabel)).filter(Boolean);
        if (level === 1 || ways.length < 2) return ways[0] ?? '';
        return `Hay más de una forma. ${ways.map((w, i) => (i === 0 ? w : `O bien, ${w.charAt(0).toLowerCase()}${w.slice(1)}`)).join(' ')}`;
    }
    // Idea 107: una investigación. Dónde están las pistas, y con qué se sacan.
    if (asks.kind === 'clues') {
        const clues = (asks.clues ?? []).map((/** @type {any} */ c) => `${text(c.place)} (${skillLabel(text(c.skill))})`);
        if (level === 1) return `Hay que ir juntando pistas: ${asks.need ?? clues.length} en total.`;
        return clues.length > 0 ? `Las pistas están en: ${clues.join(', ')}.` : '';
    }
    const place = text(asks.place);
    const at = place ? ` en ${place}` : '';
    if (level === 1) {
        if (asks.kind === 'defeat' && asks.enemy) return `Se habla de ${text(asks.enemy)} por ahí. Alguien sabrá dónde.`;
        if (asks.kind === 'talk' && asks.npc) return `${text(asks.npc)} podría saber algo${at}.`;
        if (place) return `Lo que buscáis tiene que ver con ${place}.`;
        if (asks.kind === 'contract') return 'Echad un ojo al tablón: algo de lo que hay ahí tira de este hilo.';
        return '';
    }
    switch (asks.kind) {
        case 'arrive': return place ? `Hay que llegar a ${place}.` : '';
        case 'win': return `Hay que ganar ${asks.board ? `«${text(asks.board)}»` : 'el combate de allí'}${at}.`;
        case 'defeat': return asks.enemy ? `Hay que derrotar a ${text(asks.enemy)}${at}.` : '';
        case 'talk': return asks.npc ? `Hay que hablar con ${text(asks.npc)}${at}: nombradle en el chat.` : '';
        case 'check': return asks.skill ? `Una tirada de ${skillLabel(text(asks.skill))}${at} lo resuelve.` : '';
        case 'contract': return 'Hay que aceptar y cumplir el encargo del tablón que lo mueve.';
        default: return '';
    }
}

/**
 * Las pistas que tocan hoy, y la fecha en que se abrio cada hito.
 *
 * @param {Object} input
 * @param {Array<any>} input.open Los hitos abiertos.
 * @param {Record<string, number>} [input.openedDay] Cuando se vio abierto cada uno.
 * @param {Record<string, number>} [input.given] Hasta que nivel se ha dado ya.
 * @param {number} input.today
 * @param {(skill: string) => string} [input.skillLabel]
 * @returns {{hints: Array<{id: string, level: 1|2, text: string}>, openedDay: Record<string, number>, given: Record<string, number>}}
 */
export function dueHints({ open, openedDay = {}, given = {}, today, skillLabel }) {
    /** @type {Record<string, number>} */
    const opened = {};
    /** @type {Record<string, number>} */
    const now = { ...given };
    /** @type {Array<{id: string, level: 1|2, text: string}>} */
    const hints = [];
    for (const milestone of open || []) {
        const id = text(milestone?.id);
        if (!id) continue;
        opened[id] = Number.isFinite(Number(openedDay[id])) ? Number(openedDay[id]) : today;
        const waited = today - opened[id];
        /** @type {0|1|2} */
        const level = waited >= STALL_DAYS[1] ? 2 : waited >= STALL_DAYS[0] ? 1 : 0;
        if (level === 0 || (now[id] ?? 0) >= level) continue;
        // Si se salta un nivel (se viaja una semana de golpe), se da la clara directamente.
        const hint = hintFor(milestone, level, skillLabel) || (level === 2 ? hintFor(milestone, 1, skillLabel) : '');
        now[id] = level;
        if (hint) hints.push({ id, level, text: hint });
    }
    return { hints, openedDay: opened, given: now };
}

/**
 * @typedef {Object} JournalSection
 * @property {string} title
 * @property {string[]} items
 */

/**
 * El diario: lo que el grupo sabe, junto.
 *
 * @param {Object} input
 * @param {Array<{id: string, title: string, hint: string}>} input.open
 * @param {Record<string, string[]>} [input.clues] Las pistas ya dadas, por hito.
 * @param {any} [input.taken] El encargo aceptado.
 * @param {number} [input.today]
 * @param {Array<{text: string, by?: string, where?: string, leadsTo?: string, day?: number}>} [input.heard]
 * @param {string[]} [input.memories] Lo que el grupo recuerda.
 * @param {Array<{day: number, text: string}>} [input.deeds] Lo que ha pasado: la crónica (idea 95).
 * @returns {JournalSection[]}
 */
export function buildJournal({ open, clues = {}, taken = null, today = 1, heard = [], memories = [], deeds = [] }) {
    /** @type {JournalSection[]} */
    const sections = [];
    const threads = (open || []).map(m => {
        const extra = (clues[m.id] ?? []).map(c => `   ↳ ${c}`);
        return [`${text(m.title)}${m.hint ? ` — ${text(m.hint)}` : ''}`, ...extra].join('\n');
    });
    sections.push({ title: 'Entre manos', items: threads.length > 0 ? threads : ['Nada abierto ahora mismo.'] });

    if (taken) {
        const days = Number(taken.days) - Number(today);
        sections.push({
            title: 'Encargo aceptado',
            items: [`${text(taken.title)}${taken.locationName ? ` — en ${text(taken.locationName)}` : ''}`
                + `${Number.isFinite(days) ? (days >= 0 ? ` · quedan ${days} día(s)` : ' · vencido') : ''}`],
        });
    }
    if (heard.length > 0) {
        sections.push({
            title: 'Lo que se oye',
            items: heard.slice(-8).map(r => `«${text(r.text)}»${r.by ? ` (${text(r.by)}` : ''}${r.where ? `${r.by ? ', ' : ' ('}${text(r.where)})` : (r.by ? ')' : '')}`
                + `${r.leadsTo ? ` → lleva a ${text(r.leadsTo)}` : ''}`
                // Idea 91: lo que se oyó hace mucho puede no ser verdad ya.
                + (Number.isFinite(Number(r.day)) && Number(r.day) > 0
                    ? (today - Number(r.day) >= RUMOR_COLD_DAYS ? ' · ya frío: puede que no sea verdad'
                        : today - Number(r.day) > 0 ? ` · hace ${today - Number(r.day)} día(s)` : ' · hoy')
                    : '')),
        });
    }
    if (memories.length > 0) sections.push({ title: 'Lo que recordáis', items: memories });
    // Idea 95: la crónica, lo último arriba.
    const chronicle = [...(deeds || [])]
        .filter(d => text(d?.text))
        .sort((a, b) => Number(b.day) - Number(a.day))
        .slice(0, 15)
        .map(d => `Día ${Number(d.day) || 1}: ${text(d.text)}`);
    if (chronicle.length > 0) sections.push({ title: 'Crónica', items: chronicle });
    return sections;
}

/**
 * @typedef {Object} HelpItem
 * @property {string} label
 * @property {string} detail
 * @property {string} key  Que ejecutar al pulsarlo: `service:<id>`, `board:<nombre>`, `chip:<id>`.
 */

/**
 * «¿Qué puedo hacer aquí?»: todo lo que se puede hacer ahora, por secciones.
 *
 * @param {Object} input
 * @param {{title: string, hint: string}|null} [input.focus]
 * @param {Array<{label: string, actions: Array<{id: string, label: string, detail: string, enabled: boolean}>}>} [input.services]
 * @param {string[]} [input.boards]
 * @param {Array<{id: string, label: string}>} [input.chips]
 * @param {number} [input.places] A cuantos sitios se puede viajar.
 * @param {boolean} [input.fighting]
 * @returns {Array<{title: string, items: HelpItem[]}>}
 */
export function buildHelp({ focus = null, services = [], boards = [], chips = [], places = 0, fighting = false }) {
    if (fighting) {
        return [{
            title: 'En combate',
            items: [{ label: 'Usa la barra de abajo', detail: 'Pulsa un enemigo para ver cuánto le das. Maniobras, habilidades o huir, también abajo.', key: '' }],
        }];
    }
    /** @type {Array<{title: string, items: HelpItem[]}>} */
    const sections = [];
    if (focus) sections.push({ title: 'Lo que tenéis entre manos', items: [{ label: text(focus.title), detail: text(focus.hint), key: 'journal' }] });
    const here = services.flatMap(card => card.actions.filter(a => a.enabled)
        .map(a => ({ label: a.label, detail: `${card.label}: ${a.detail}`, key: `service:${a.id}` })));
    if (here.length > 0) sections.push({ title: 'Aquí', items: here });
    if (boards.length > 0) {
        sections.push({ title: 'Entrar en', items: boards.map(name => ({ label: name, detail: 'Un tablero de este sitio.', key: `board:${name}` })) });
    }
    if (chips.length > 0) sections.push({ title: 'También', items: chips.map(c => ({ label: c.label, detail: '', key: `chip:${c.id}` })) });
    sections.push({
        title: 'Siempre',
        items: [
            { label: 'Escribir en el chat', detail: 'Lo que quieras hacer, con tus palabras: el narrador responde.', key: '' },
            { label: 'Tirar una habilidad', detail: 'El botón «Tirada», arriba: el dado decide y el narrador lo cuenta.', key: '' },
            { label: 'Glosario', detail: 'Las palabras de las reglas, en llano (tecla L).', key: 'glossary' },
            ...(places > 0 ? [{ label: `Viajar (${places} sitios)`, detail: 'En el mapa de campaña. Cuesta días y comida.', key: '' }] : []),
        ],
    });
    return sections;
}

/** A partir de estos días, un rumor oído se ha enfriado (idea 91). */
export const RUMOR_COLD_DAYS = 14;

/**
 * Lo pendiente en cada sitio, para la lista de viaje (idea 81).
 *
 * @param {Object} input
 * @param {string[]} input.places
 * @param {any[]} [input.board] Los encargos del tablón.
 * @param {any} [input.taken] El encargo aceptado.
 * @param {Record<string, number>} [input.rumors] Rumores sin oír, por sitio.
 * @param {string[]} [input.thread] Los sitios que pide el hilo ahora.
 * @returns {Record<string, string>}
 */
export function pendingByPlace({ places, board = [], taken = null, rumors = {}, thread = [] }) {
    /** @type {Record<string, string>} */
    const out = {};
    const same = (/** @type {any} */ a, /** @type {string} */ b) => text(a).toLowerCase() === b.toLowerCase();
    for (const place of places || []) {
        const bits = [];
        if (thread.some(t => same(t, place))) bits.push('el hilo');
        if (taken && same(taken.locationName, place)) bits.push('tu encargo');
        const offered = board.filter(c => same(c?.locationName, place)).length;
        if (offered > 0) bits.push(`${offered} encargo${offered === 1 ? '' : 's'}`);
        const heard = Number(rumors[place] ?? Object.entries(rumors).find(([k]) => same(k, place))?.[1] ?? 0);
        if (heard > 0) bits.push(`${heard} rumor${heard === 1 ? '' : 'es'}`);
        if (bits.length > 0) out[place] = `Pendiente: ${bits.join(' · ')}`;
    }
    return out;
}

/**
 * «Anteriormente…» (idea 108): lo que hace falta para retomar, sin leer el chat entero.
 *
 * @param {Object} input
 * @param {number} input.day
 * @param {string} input.place
 * @param {{title: string, hint: string}|null} [input.focus]
 * @param {Array<{day: number, text: string}>} [input.deeds]
 * @param {string} [input.memory]
 * @param {any} [input.taken]
 * @returns {{title: string, lines: string[]}|null}
 */
export function buildRecap({ day, place, focus = null, deeds = [], memory = '', taken = null }) {
    /** @type {string[]} */
    const lines = [];
    if (focus) lines.push(`Entre manos: ${text(focus.title)}${focus.hint ? ` — ${text(focus.hint)}` : ''}`);
    if (taken) lines.push(`Encargo: ${text(taken.title)}${taken.locationName ? `, en ${text(taken.locationName)}` : ''}`);
    for (const deed of deeds.slice(-3)) lines.push(`Día ${deed.day}: ${text(deed.text)}`);
    if (memory) lines.push(`Recordáis: ${text(memory)}`);
    if (lines.length === 0) return null;
    return { title: `Anteriormente… (día ${Math.max(1, Math.floor(Number(day) || 1))}${place ? `, en ${text(place)}` : ''})`, lines };
}
