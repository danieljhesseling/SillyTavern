/**
 * De una campaña a otra: lo que el gremio recuerda (J11.4 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Terminar una campaña ya dejaba su fila en el salón de la fama y su final en el tablón. Pero al
 * volver, Brunilda os saludaba igual tras vender el valle de Vane a los Keller que tras echar a
 * sus señores, y nadie venía a buscaros. Aquí cada final deja un **legado** que el gremio
 * recuerda, y que cambia tres cosas:
 *
 * - **Cómo os reciben**: quien lleva el gremio os saluda sabiendo lo que hicisteis, y la vuelta
 *   dice cómo os llaman desde entonces («los que trajeron el sol a Barovia»). En la taberna se
 *   cuenta.
 * - **Qué campañas se ofrecen**: la tarjeta de otra campaña puede decir por qué os la ofrecen a
 *   vosotros; y una fila de `mundos.json` con `needs` no sale en el tablón hasta que el gremio
 *   recuerde lo que pide.
 * - **Quién os busca**: días después de volver, alguien viene al gremio por lo que hicisteis
 *   allí. Es una tarjeta de suceso, con su decisión, que vuelve como las continuaciones.
 *
 * Cómo se escribe, en cada final del paquete (`plot.endings.<id>.legacy`, o `legado`):
 *
 *     "legacy": {
 *       "tone": "sombra",
 *       "title": "quienes vendieron el valle de Vane a los Keller",
 *       "greeting": "{hola}. Ha llegado antes que tú la noticia del valle…",
 *       "rumor": "En el puerto se cuenta que alguien del gremio…",
 *       "tags": ["mano-dura"],
 *       "visitor": { "days": 3, "name": "…", "text": "…", "options": [ …como un suceso… ] },
 *       "offers": [{ "campaign": "strahd", "line": "Brunilda: «…»" }]
 *     }
 *
 * `tone` es `luz`, `sombra` o `gris`: cómo se recuerda, para el color de la ventana. En
 * `greeting`, `{quien}` es quien lleva el gremio y `{hola}` el saludo con tu nombre.
 *
 * Lo recordado se guarda en el mundo del gremio (`GUILD_MEMORY_KEY`), al volver de un final.
 *
 * Puro: de lo recordado a lo que se dice y se ofrece. Quien llama guarda y enseña.
 */

import { resolveGender } from './grammar.js';

/** En los metadatos del mundo del gremio: lo que recuerda de cada campaña terminada. */
export const GUILD_MEMORY_KEY = 'hubMemory';

/** Cómo se recuerda un final. */
export const TONES = ['luz', 'sombra', 'gris'];

/** Cuántos días dura el saludo de la vuelta: después, el gremio vuelve a lo de siempre. */
export const GREETING_DAYS = 21;

/** Días que tarda en llegar quien os busca, si no lo dice. */
export const VISITOR_DAYS = 3;

/** Cómo se saluda a cada hora; lo mismo que `town.js`. */
const HELLO = { morning: 'Buenos días', afternoon: 'Buenas tardes', night: 'Buenas noches', '': 'Hola' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/** @param {any} value @returns {string} */
const slug = (value) => fold(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

/**
 * @typedef {Object} Legacy
 * @property {'luz'|'sombra'|'gris'} tone
 * @property {string} title Cómo os llaman desde entonces, en minúscula: «quienes trajeron el sol a Barovia».
 * @property {string} greeting
 * @property {string} rumor
 * @property {string[]} tags
 * @property {{days: number, name: string, text: string, options: any[]}|null} visitor
 * @property {Array<{campaign: string, line: string}>} offers
 */

/**
 * El legado de un final, se escriba en inglés (`legacy`) o en castellano (`legado`, con `tono`,
 * `titulo`, `saludo`, `etiquetas`, `visita` y `ofrece`). También vale el final entero.
 *
 * @param {any} raw
 * @returns {Legacy|null} Nada si no dice nada.
 */
export function readLegacy(raw) {
    const source = isObject(raw?.legacy) ? raw.legacy : isObject(raw?.legado) ? raw.legado : raw;
    if (!isObject(source)) return null;
    const tone = text(source.tone ?? source.tono);
    const visit = source.visitor ?? source.visita;
    const options = isObject(visit) ? (Array.isArray(visit.options) ? visit.options : []).filter((/** @type {any} */ o) => isObject(o) && text(o.label)) : [];
    const visitor = isObject(visit) && text(visit.name) && text(visit.text) && options.length > 0
        ? { days: Math.max(1, Math.min(30, Math.floor(Number(visit.days ?? visit.dias) || VISITOR_DAYS))), name: text(visit.name), text: text(visit.text), options }
        : null;
    const offers = (Array.isArray(source.offers ?? source.ofrece) ? (source.offers ?? source.ofrece) : [])
        .map((/** @type {any} */ o) => ({ campaign: text(o?.campaign ?? o?.campana), line: text(o?.line ?? o?.texto) }))
        .filter((/** @type {{campaign: string, line: string}} */ o) => o.campaign && o.line);
    const legacy = {
        tone: /** @type {'luz'|'sombra'|'gris'} */ (TONES.includes(tone) ? tone : 'gris'),
        title: text(source.title ?? source.titulo).replace(/[.\s]+$/, ''),
        greeting: text(source.greeting ?? source.saludo),
        rumor: text(source.rumor),
        tags: listOf(source.tags ?? source.etiquetas).map(fold),
        visitor,
        offers,
    };
    return legacy.title || legacy.greeting || legacy.rumor || visitor || offers.length > 0 || legacy.tags.length > 0 ? legacy : null;
}

/**
 * @typedef {Object} RememberedCampaign
 * @property {string} id El de la campaña en el tablón.
 * @property {string} name Cómo se llama en el tablón.
 * @property {string} ending El id del final.
 * @property {string} endingTitle Su título.
 * @property {Legacy|null} legacy
 * @property {number} day El día del gremio en que se volvió.
 */

/**
 * @typedef {Object} GuildMemory
 * @property {RememberedCampaign[]} campaigns En el orden en que se terminaron.
 * @property {string[]} told Los rumores de lo recordado que ya se contaron.
 */

/**
 * Lo que recuerda el gremio, con forma aunque llegue roto.
 *
 * @param {any} raw
 * @returns {GuildMemory}
 */
export function readGuildMemory(raw) {
    /** @type {Map<string, RememberedCampaign>} */
    const campaigns = new Map();
    for (const entry of Array.isArray(raw?.campaigns) ? raw.campaigns : []) {
        const id = text(entry?.id);
        const endingTitle = text(entry?.endingTitle);
        if (!id || !(endingTitle || text(entry?.ending))) continue;
        campaigns.delete(id);
        campaigns.set(id, {
            id,
            name: text(entry.name) || id,
            ending: text(entry.ending),
            endingTitle: endingTitle || text(entry.ending),
            legacy: readLegacy(entry.legacy),
            day: Math.max(1, Math.floor(Number(entry.day) || 1)),
        });
    }
    return { campaigns: [...campaigns.values()], told: listOf(raw?.told) };
}

/**
 * Apuntar una campaña terminada. Si ya estaba (se vuelve a ella a pasear), se queda como la
 * primera vez: el día que se volvió de su final es el que cuenta.
 *
 * @param {any} raw
 * @param {{id: string, name?: string, ending?: string, endingTitle: string, legacy?: any, day: number}} entry
 * @returns {GuildMemory}
 */
export function rememberCampaign(raw, entry) {
    const memory = readGuildMemory(raw);
    const id = text(entry?.id);
    if (!id || !(text(entry?.endingTitle) || text(entry?.ending))) return memory;
    const was = memory.campaigns.find(c => c.id === id);
    if (was && was.endingTitle === (text(entry.endingTitle) || text(entry.ending))) return memory;
    const [clean] = readGuildMemory({ campaigns: [{ ...entry, legacy: readLegacy(entry.legacy) }] }).campaigns;
    return { ...memory, campaigns: [...memory.campaigns.filter(c => c.id !== id), clean] };
}

/**
 * Lo recordado, con las campañas que el gremio tiene por terminadas y no están apuntadas (de
 * antes de J11.4): sin legado, pero con su final.
 *
 * @param {Object} input
 * @param {any} input.memory
 * @param {any} [input.hub] El gremio (`readHub`): sus campañas, con `finished` y `ending`.
 * @returns {GuildMemory}
 */
export function guildMemoryOf({ memory, hub = null }) {
    const known = readGuildMemory(memory);
    const ids = new Set(known.campaigns.map(c => c.id));
    const older = Object.entries(isObject(hub?.campaigns) ? hub.campaigns : {})
        .filter(([id, c]) => !ids.has(text(id)) && /** @type {any} */ (c)?.finished && text(/** @type {any} */ (c)?.ending))
        .map(([id, c]) => ({
            id: text(id),
            name: text(/** @type {any} */ (c).name) || text(/** @type {any} */ (c).worldName) || text(id),
            ending: '',
            endingTitle: text(/** @type {any} */ (c).ending),
            legacy: null,
            day: Math.max(1, Math.floor(Number(/** @type {any} */ (c).day) || 1)),
        }));
    return { ...known, campaigns: [...older, ...known.campaigns] };
}

/**
 * El legado de un final del hilo, para apuntarlo al volver: el del final por su id, o por su
 * título si solo se sabe eso.
 *
 * @param {any} plot El hilo (leído o no).
 * @param {string} ending El id del final, o su título.
 * @returns {{ending: string, endingTitle: string, legacy: Legacy|null}|null}
 */
export function endingLegacy(plot, ending) {
    const endings = isObject(plot?.endings) ? plot.endings : {};
    const wanted = text(ending);
    const found = Object.entries(endings).find(([id, e]) => id === wanted || fold(/** @type {any} */ (e)?.title) === fold(wanted));
    if (!found) return null;
    const [id, raw] = found;
    return { ending: id, endingTitle: text(/** @type {any} */ (raw)?.title) || id, legacy: readLegacy(raw) };
}

/**
 * Las huecos de una línea: `{quien}`, `{hola}` y el género de quien juega.
 *
 * @param {string} line
 * @param {{keeper?: string, slot?: string, hero?: any}} facts
 * @returns {string}
 */
function voice(line, { keeper = '', slot = '', hero = null }) {
    const name = text(hero?.name ?? (typeof hero === 'string' ? hero : ''));
    const when = /noche|night/i.test(slot) ? 'night' : /tarde|afternoon/i.test(slot) ? 'afternoon' : /ma[nñ]ana|morning/i.test(slot) ? 'morning' : '';
    const hello = `${HELLO[when]}${name ? `, ${name}` : ''}`;
    const filled = text(line).replace(/\{quien\}/g, text(keeper) || 'Quien lleva el gremio').replace(/\{hola\}/g, hello);
    return resolveGender(filled, { heroe: hero && typeof hero === 'object' ? hero : '' }).replace(/\s+/g, ' ').trim();
}

/**
 * Lo último que el gremio recuerda con algo que decir.
 *
 * @param {GuildMemory} memory
 * @returns {RememberedCampaign|null}
 */
function latest(memory) {
    return [...memory.campaigns].reverse().find(c => c.legacy) ?? null;
}

/**
 * Lo que dice quien lleva el gremio al entrar, las semanas después de volver de un final: su
 * `greeting`, con quien lo dice delante. Vacío si no hay nada reciente (y vale el de siempre).
 *
 * @param {Object} input
 * @param {any} input.memory
 * @param {any} input.place El sitio (`TownPlace`): solo en el gremio, y con alguien que lo lleve.
 * @param {number} input.today El día del gremio (`hubDay`).
 * @param {string} [input.slot]
 * @param {any} [input.hero]
 * @returns {string}
 */
export function guildGreeting({ memory, place, today, slot = '', hero = null }) {
    const keeper = text(place?.keeper?.name);
    if (place?.kind !== 'gremio' || !keeper || place?.closed) return '';
    const last = latest(readGuildMemory(memory));
    if (!last?.legacy?.greeting || Math.floor(Number(today) || 1) - last.day >= GREETING_DAYS) return '';
    return `${keeper} deja lo que estaba haciendo al verte: «${voice(last.legacy.greeting, { keeper, slot, hero })}»`;
}

/**
 * Cómo os llaman desde el último final que dejó nombre: «los que trajeron el sol a Barovia».
 *
 * @param {any} memory
 * @returns {string} Vacío si no hay.
 */
export function guildTitle(memory) {
    return [...readGuildMemory(memory).campaigns].reverse().find(c => c.legacy?.title)?.legacy?.title ?? '';
}

/**
 * La línea que se añade a la vuelta al gremio tras un final (`homecomingScene`): cómo os llaman
 * desde hoy.
 *
 * @param {Object} input
 * @param {any} input.legacy
 * @param {string} [input.home] El pueblo del gremio.
 * @param {any} [input.hero] Para el género.
 * @returns {string}
 */
export function homecomingLegacyLine({ legacy, home = '', hero = null }) {
    const read = readLegacy(legacy);
    if (!read?.title) return '';
    const where = text(home) && text(home) !== 'el gremio' ? `en ${text(home)}` : 'en el gremio';
    return voice(`Desde hoy, ${where} os conocen como ${read.title}.`, { hero });
}

/**
 * Lo que se cuenta en la taberna del pueblo del gremio de lo recordado, sin repetir.
 *
 * @param {any} memory
 * @returns {Array<{id: string, text: string}>}
 */
export function guildRumors(memory) {
    const read = readGuildMemory(memory);
    const told = new Set(read.told);
    return read.campaigns
        .filter(c => c.legacy?.rumor)
        .map(c => ({ id: `gremio:${c.id}:${c.ending || slug(c.endingTitle)}`, text: /** @type {Legacy} */ (c.legacy).rumor }))
        .filter(r => !told.has(r.id))
        .reverse();
}

/**
 * Apuntar que un rumor de lo recordado ya se contó.
 *
 * @param {any} memory
 * @param {string} id
 * @returns {GuildMemory}
 */
export function tellGuildRumor(memory, id) {
    const read = readGuildMemory(memory);
    return text(id) && !read.told.includes(text(id)) ? { ...read, told: [...read.told, text(id)] } : read;
}

/**
 * El id del suceso de quien viene a buscaros por una campaña.
 *
 * @param {string} campaign
 * @returns {string}
 */
export function visitorId(campaign) {
    return `visita-${slug(campaign)}`;
}

/**
 * Quienes os buscan, como filas de suceso de continuación: se juntan con las de `sucesos.json`
 * en el gremio, y vuelven con la cola de siempre (`scheduleFollows` de `aftermath.js`).
 *
 * @param {any} memory
 * @returns {any[]}
 */
export function visitorRows(memory) {
    return readGuildMemory(memory).campaigns
        .filter(c => c.legacy?.visitor)
        .map(c => {
            const visitor = /** @type {NonNullable<Legacy['visitor']>} */ (/** @type {Legacy} */ (c.legacy).visitor);
            return { id: visitorId(c.id), name: visitor.name, weight: 1, when: { momento: 'continuacion' }, text: visitor.text, options: visitor.options, kind: 'suceso' };
        });
}

/**
 * Lo que queda pendiente al volver de un final: quien vendrá a buscaros, y cuándo.
 *
 * @param {any} legacy
 * @param {string} campaign
 * @returns {{id: string, days: number}|null}
 */
export function visitorFollow(legacy, campaign) {
    const read = readLegacy(legacy);
    return read?.visitor && text(campaign) ? { id: visitorId(campaign), days: read.visitor.days } : null;
}

/**
 * Si el gremio recuerda lo que pide una campaña para salir en el tablón (`needs` en su fila de
 * `mundos.json`): basta con una de la lista. Cada una es el id de una campaña (terminada de
 * cualquier forma), `campaña:final` (con ese final) o `#etiqueta` (de algún legado).
 *
 * @param {any} needs
 * @param {GuildMemory} memory
 * @returns {boolean}
 */
export function meetsNeeds(needs, memory) {
    const wanted = listOf(needs);
    if (wanted.length === 0) return true;
    return wanted.some(need => {
        if (need.startsWith('#')) return memory.campaigns.some(c => c.legacy?.tags.includes(fold(need.slice(1))));
        const [campaign, ending] = need.split(':').map(text);
        return memory.campaigns.some(c => c.id === campaign && (!ending || c.ending === ending || fold(c.endingTitle) === fold(ending)));
    });
}

/**
 * Las tarjetas del tablón, vistas por lo que el gremio recuerda (`hubCampaignCards` de `hub.js`):
 *
 * - una campaña que pide algo que el gremio no recuerda (`needs`) no sale;
 * - una que otro final os ofrece dice por qué (`because`), y va delante de las que no se han
 *   empezado.
 *
 * @param {Object} input
 * @param {any[]} input.cards
 * @param {any} input.memory Lo recordado (mejor con `guildMemoryOf`).
 * @param {any[]} [input.worlds] Las filas de `mundos.json` (y las tuyas), para sus `needs`.
 * @returns {any[]}
 */
export function offeredCampaigns({ cards, memory, worlds = [] }) {
    const read = readGuildMemory(memory);
    const rows = new Map((Array.isArray(worlds) ? worlds : []).map(w => [text(w?.id), w]));
    /** @type {Record<string, string>} */
    const because = {};
    for (const campaign of read.campaigns) {
        for (const offer of campaign.legacy?.offers ?? []) {
            // Lo último que se terminó manda: su razón pisa a la de antes.
            if (offer.campaign !== campaign.id) because[offer.campaign] = offer.line;
        }
    }
    const shown = (Array.isArray(cards) ? cards : [])
        .filter(card => card?.state !== 'nueva' || meetsNeeds(rows.get(text(card?.id))?.needs, read))
        .map(card => (because[text(card?.id)] && card.state === 'nueva' ? { ...card, because: because[text(card.id)] } : card));
    return [...shown.filter(c => c.because), ...shown.filter(c => !c.because)];
}

/**
 * Lo que recuerda el gremio, para su ventana: una fila por campaña terminada, la última arriba.
 *
 * @param {any} memory
 * @returns {Array<{id: string, name: string, ending: string, title: string, tone: 'luz'|'sombra'|'gris', line: string}>}
 */
export function describeGuildMemory(memory) {
    return [...readGuildMemory(memory).campaigns].reverse().map(c => ({
        id: c.id,
        name: c.name,
        ending: c.endingTitle,
        title: c.legacy?.title ?? '',
        tone: c.legacy?.tone ?? 'gris',
        line: c.legacy?.title
            ? `Terminasteis ${c.name} con «${c.endingTitle}». Desde entonces os conocen como ${c.legacy.title}.`
            : `Terminasteis ${c.name} con «${c.endingTitle}».`,
    }));
}
