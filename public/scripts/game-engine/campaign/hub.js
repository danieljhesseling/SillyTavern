/**
 * El gremio: la casa desde la que se juega sin conexión (J4 de ROADMAP_SIN_CONEXION).
 *
 * Una partida es **un gremio**: un mundo pequeño con su posada, su tienda y su templo, donde
 * vive tu personaje. Desde su tablón se empiezan las campañas —1387, La Maldición de
 * Strahd— y cada una es su propio mundo y su propio chat, como siempre. Lo que las une es el
 * grupo: va del gremio a la campaña y vuelve con lo que ha ganado, y en la siguiente
 * campaña sigue siendo el mismo.
 *
 * Por eso aquí no hay mundo nuevo que inventar: el motor ya sabe jugar cada campaña. Lo que
 * hace falta es saber qué campañas hay empezadas desde este gremio, y llevar al grupo de un
 * chat a otro sin perder nada por el camino.
 *
 * Puro: decide y describe. Quien llama abre los chats, crea las fichas y guarda.
 */

import { uniqueWorldName } from './campaign-worlds.js';
import { mercenaryHp } from './guests.js';
import { prologueOf } from './plot.js';

/** En los metadatos del mundo del gremio: su chat y las campañas que ha empezado. */
export const HUB_KEY = 'hub';

/** En los de una campaña: el mundo del gremio del que sale. */
export const HUB_HOME_KEY = 'hubHome';

/** Y cuál es, de las del tablón. */
export const HUB_CAMPAIGN_KEY = 'hubCampaign';

/** El paquete del gremio. */
export const HUB_PACK = '/mundos/gremio.pack.json';

/** El nombre que se propone para el mundo del gremio. */
export const HUB_WORLD_NAME = 'El Gremio';

/** Con lo que llega quien entra al gremio: para la posada y un mercenario. Solo el primero. */
export const HUB_START_GOLD = 100;

/**
 * D-J11: con lo que llega cada personaje nuevo después del primero: para la posada, no para
 * un mercenario. El gremio ya tiene quien se lo gane.
 */
export const HUB_NEXT_HERO_GOLD = 10;

/**
 * D-J19: en los metadatos del chat de una campaña del tablón, cómo se llama en el tablón. Es
 * el nombre que lleva al salón de la fama, y no el del hilo, que a veces es otro.
 */
export const HUB_BOARD_NAME_KEY = 'hubCampaignName';

/** Quien narra el gremio, de `narradores.json`. */
export const HUB_NARRATOR = 'posadero';

/** Lo que pone un mercenario del gremio en su ficha: no se va al acabar ningún encargo. */
export const HUB_CONTRACT = 'gremio';

/**
 * J5.4: las campañas que añades al tablón desde un archivo. Su id empieza así, para no pisar
 * a las del juego; su paquete va entre tus archivos (`data/<tú>/user/files/`) y su fila, en
 * el gremio (`hub.imported`), junto a las campañas que ha empezado.
 */
export const HUB_IMPORTED_PREFIX = 'tuya-';

/** Dónde se sirven tus archivos: el paquete de una campaña añadida tiene que estar ahí. */
export const HUB_IMPORTED_DIR = '/user/files/';

/**
 * J5.4: en los metadatos de una campaña añadida, para qué nivel es. Las del juego lo dicen en
 * `mundos.json`; las tuyas, en su fila del gremio, que desde la campaña no se ve.
 */
export const HUB_LEVELS_KEY = 'hubLevels';

/**
 * D-J35: la lista de tus campañas añadidas, entre tus archivos, al lado de sus paquetes. Es
 * tuya y no de un gremio: sale en el tablón de todos tus gremios.
 */
export const HUB_IMPORTED_LIST = 'tablon-campanas.json';

/**
 * D-J35: lo que dice la tarjeta de una añadida que quitaste del tablón y sigue en el gremio
 * donde la empezaste.
 */
export const HUB_KEPT_NOTE = 'La quitaste del tablón. Sigue aquí porque la empezaste en este gremio.';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const key = (value) => text(value).toLowerCase();

/**
 * @typedef {Object} HubChat
 * @property {string} file   El chat, sin `.jsonl`.
 * @property {string} avatar La ficha con la que se abre.
 */

/**
 * @typedef {Object} HubCampaign
 * @property {string} worldName
 * @property {HubChat|null} chat
 * @property {boolean} finished
 * @property {string} ending El título del final, si se llegó a uno.
 * @property {number} [day] D-J12: el día de su calendario la última vez que se volvió de ella.
 *   Lo que se vivió allí también pasa para quien descansa en el gremio (`hubDay`).
 * @property {string} [name] D-J35: cómo se llamaba en el tablón. Si la quitas del tablón (una
 *   añadida por ti), su tarjeta sigue en este gremio con este nombre, para seguirla.
 * @property {string} [chapter] J9.3: por qué capítulo ibais al volver de ella («Capítulo 2 de 5:
 *   El campamento vistani», de `guildChapterLine`). Lo dice su tarjeta del tablón.
 */

/**
 * @typedef {Object} Hub
 * @property {HubChat|null} chat
 * @property {Record<string, HubCampaign>} campaigns
 * @property {any[]} [imported] J5.4: las campañas añadidas desde un archivo, como filas de
 *   `mundos.json`. Solo está si hay alguna.
 */

/**
 * @param {any} raw
 * @returns {HubChat|null}
 */
function readChat(raw) {
    const file = text(raw?.file);
    const avatar = text(raw?.avatar);
    return file && avatar ? { file, avatar } : null;
}

/**
 * Lo guardado de un gremio, con forma aunque llegue roto.
 *
 * @param {any} raw
 * @returns {Hub}
 */
export function readHub(raw) {
    /** @type {Record<string, HubCampaign>} */
    const campaigns = {};
    for (const [id, value] of Object.entries(raw?.campaigns && typeof raw.campaigns === 'object' ? raw.campaigns : {})) {
        const worldName = text(/** @type {any} */ (value)?.worldName);
        if (!text(id) || !worldName) continue;
        const day = Math.max(0, Math.floor(Number(/** @type {any} */ (value)?.day) || 0));
        const name = text(/** @type {any} */ (value)?.name);
        const chapter = text(/** @type {any} */ (value)?.chapter).slice(0, 140);
        campaigns[text(id)] = {
            worldName,
            chat: readChat(/** @type {any} */ (value)?.chat),
            finished: Boolean(/** @type {any} */ (value)?.finished),
            ending: text(/** @type {any} */ (value)?.ending),
            ...(day > 0 ? { day } : {}),
            ...(name ? { name } : {}),
            ...(chapter ? { chapter } : {}),
        };
    }
    const imported = readImportedRows(raw?.imported);
    return { chat: readChat(raw?.chat), campaigns, ...(imported.length > 0 ? { imported } : {}) };
}

/**
 * J5.4: las filas de las campañas añadidas, con forma aunque lleguen rotas. Una sin nombre,
 * sin el prefijo o con el paquete fuera de tus archivos no se lee; con el mismo id dos veces,
 * vale la última.
 *
 * @param {any} raw
 * @returns {any[]}
 */
export function readImportedRows(raw) {
    /** @type {Map<string, any>} */
    const rows = new Map();
    for (const row of Array.isArray(raw) ? raw : []) {
        const id = text(row?.id);
        const name = text(row?.name);
        const pack = text(row?.pack);
        if (!id.startsWith(HUB_IMPORTED_PREFIX) || id === HUB_IMPORTED_PREFIX || !name) continue;
        if (!pack.startsWith(HUB_IMPORTED_DIR) || !/^[A-Za-z0-9_.-]+$/.test(pack.slice(HUB_IMPORTED_DIR.length))) continue;
        const [min, max] = Array.isArray(row.levels) ? row.levels.map((/** @type {any} */ n) => Math.floor(Number(n) || 0)) : [0, 0];
        const days = Math.max(0, Math.floor(Number(row?.journey?.days) || 0));
        rows.delete(id);
        rows.set(id, {
            id,
            name,
            genre: text(row.genre),
            note: text(row.note),
            synopsis: text(row.synopsis),
            icon: /^fa-[a-z0-9-]+$/.test(text(row.icon)) ? text(row.icon) : 'fa-book-open',
            seed: text(row.seed) || id,
            templateId: text(row.templateId) || 'tavern',
            pack,
            ...(min >= 1 ? { levels: [min, Math.max(min, max)] } : {}),
            ...(days > 0 ? { journey: { days, how: text(row?.journey?.how) } } : {}),
            imported: true,
        });
    }
    return [...rows.values()];
}

/**
 * J5.4: el gremio, con una campaña añadida (o puesta al día, si ya estaba).
 *
 * @param {Hub} hub
 * @param {any} row
 * @returns {Hub}
 */
export function withHubImported(hub, row) {
    const now = readHub(hub);
    const id = text(row?.id);
    return readHub({ ...now, imported: [...(now.imported ?? []).filter(r => r.id !== id), row] });
}

/**
 * D-J35: el gremio, sin las campañas añadidas que guardaba él: desde D-J35 las guarda tu lista
 * (`HUB_IMPORTED_LIST`), que es de todos tus gremios.
 *
 * @param {any} hub
 * @returns {Hub}
 */
export function withoutHubImported(hub) {
    const now = readHub(hub);
    delete now.imported;
    return now;
}

/**
 * D-J35: tu lista de campañas añadidas, como se guarda en su archivo (`{version, campaigns}`)
 * o como una lista suelta. Con forma aunque llegue rota.
 *
 * @param {any} raw
 * @returns {any[]}
 */
export function readImportedList(raw) {
    return readImportedRows(Array.isArray(raw) ? raw : raw?.campaigns);
}

/**
 * D-J35: tu lista, lista para guardar en su archivo.
 *
 * @param {any[]} rows
 * @returns {{version: number, campaigns: any[]}}
 */
export function importedListFile(rows) {
    return { version: 1, campaigns: readImportedRows(rows) };
}

/**
 * D-J35: tu lista con una campaña más, o puesta al día si ya estaba (en su sitio).
 *
 * @param {any} rows
 * @param {any} row
 * @returns {any[]}
 */
export function withImportedRow(rows, row) {
    const list = readImportedList(rows);
    const [clean] = readImportedRows([row]);
    if (!clean) return list;
    const at = list.findIndex(r => r.id === clean.id);
    return at >= 0 ? list.map((r, i) => (i === at ? clean : r)) : [...list, clean];
}

/**
 * D-J35: tu lista sin una campaña.
 *
 * @param {any} rows
 * @param {string} id
 * @returns {any[]}
 */
export function withoutImportedRow(rows, id) {
    return readImportedList(rows).filter(r => r.id !== text(id));
}

/**
 * D-J35: las campañas añadidas que ve un gremio: las de tu lista y, detrás, las que guardaba él
 * antes de D-J35 y aún no han pasado a tu lista.
 *
 * @param {any} rows Tu lista.
 * @param {any} hub El gremio.
 * @returns {any[]}
 */
export function importedForHub(rows, hub) {
    const list = readImportedList(rows);
    const known = new Set(list.map(r => r.id));
    return [...list, ...(readHub(hub).imported ?? []).filter(r => !known.has(r.id))];
}

/**
 * Si un mundo es un gremio.
 *
 * @param {any} meta Los metadatos del mundo.
 * @returns {boolean}
 */
export function isHubWorld(meta) {
    return Boolean(meta && typeof meta === 'object' && meta[HUB_KEY] && typeof meta[HUB_KEY] === 'object');
}

/**
 * De qué gremio sale una campaña, o nada si no sale de ninguno.
 *
 * @param {any} meta Los metadatos del mundo.
 * @returns {string}
 */
export function hubHomeOf(meta) {
    return text(meta?.[HUB_HOME_KEY]);
}

/**
 * El gremio, con el chat donde vive.
 *
 * @param {Hub} hub
 * @param {HubChat} chat
 * @returns {Hub}
 */
export function withHubChat(hub, chat) {
    return { ...readHub(hub), chat: readChat(chat) };
}

/**
 * El gremio, con una campaña empezada o puesta al día.
 *
 * @param {Hub} hub
 * @param {string} id
 * @param {Partial<HubCampaign>} patch
 * @returns {Hub}
 */
export function withHubCampaign(hub, id, patch) {
    const now = readHub(hub);
    const was = now.campaigns[text(id)] ?? { worldName: '', chat: null, finished: false, ending: '' };
    return readHub({ ...now, campaigns: { ...now.campaigns, [text(id)]: { ...was, ...patch } } });
}

/**
 * D-J12: el día del gremio para quien descansa en él. Cada chat lleva su calendario: el del
 * gremio no corre mientras el grupo está en una campaña. Así que su día es el del gremio más
 * los que se han vivido en cada campaña empezada desde él (lo apuntado al volver de ella).
 *
 * @param {Object} input
 * @param {any} input.hub El gremio.
 * @param {number} input.day El día del calendario del chat del gremio.
 * @returns {number}
 */
export function hubDay({ hub, day }) {
    const away = Object.values(readHub(hub).campaigns)
        .reduce((sum, campaign) => sum + Math.max(0, (campaign.day ?? 1) - 1), 0);
    return Math.max(1, Math.floor(Number(day) || 1)) + away;
}

/** Los números que se escriben con letra: «nueve días» se lee mejor que «9 días». */
const NUMBER_WORDS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];

/** @param {string} value @returns {string} */
const capital = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * «de» y «a» delante de un sitio: «del gremio», «al gremio». Solo con «el» en minúscula:
 * si el artículo es parte del nombre («El Gremio») se escribe entero, como «de El Salvador».
 *
 * @param {'de'|'a'} word
 * @param {string} place
 * @returns {string}
 */
function toPlace(word, place) {
    return place.startsWith('el ') ? `${word === 'de' ? 'del' : 'al'} ${place.slice(3)}` : `${word} ${place}`;
}

/**
 * Cuántos días hay de camino desde el pueblo hasta una campaña (J4.9 de ROADMAP_SIN_CONEXION).
 *
 * Cada campaña es su propio mundo, pero tiene que sentirse que se viaja a ella desde el
 * pueblo: el tablón dice lo lejos que queda y el viaje de ida y de vuelta se cuenta.
 *
 * @param {any} world La entrada de `mundos.json`.
 * @returns {number} 0 si no dice nada.
 */
export function journeyDays(world) {
    return Math.max(0, Math.floor(Number(world?.journey?.days) || 0));
}

/**
 * Los días, con letra hasta doce: «un día», «nueve días», «15 días».
 *
 * @param {number} days
 * @returns {string} Vacío si no hay días.
 */
export function journeySpan(days) {
    const n = Math.max(0, Math.floor(Number(days) || 0));
    if (n === 0) return '';
    if (n === 1) return 'un día';
    return `${NUMBER_WORDS[n] ?? n} días`;
}

/**
 * El viaje contado, de ida o de vuelta.
 *
 * Ida: «Salís del gremio hacia Strahd. Vais en carro… Nueve días de camino.»
 * Vuelta: «Nueve días de camino después, volvéis al gremio con lo ganado.»
 *
 * @param {Object} input
 * @param {any} input.world La entrada de `mundos.json`.
 * @param {string} [input.home] De dónde se sale y adónde se vuelve.
 * @param {boolean} [input.back] Si es la vuelta.
 * @returns {string} Vacío si la campaña no dice cuánto queda.
 */
export function journeyLine({ world, home = 'el gremio', back = false }) {
    const span = journeySpan(journeyDays(world));
    if (!span) return '';
    const from = text(home) || 'el gremio';
    if (back) return `${capital(span)} de camino después, volvéis ${toPlace('a', from)} con lo ganado.`;
    // El «cómo» se escribe como frase, con su punto o sin él: aquí se le pone uno solo.
    const how = text(world?.journey?.how).replace(/[.\s]+$/, '');
    const name = text(world?.name) || text(world?.id);
    return [`Salís ${toPlace('de', from)} hacia ${name}.`, how ? `${how}.` : '', `${capital(span)} de camino.`]
        .filter(Boolean).join(' ');
}

/**
 * Las campañas del tablón, con cómo van para este gremio.
 *
 * Solo las que traen su paquete: una campaña del tablón es una historia escrita entera, no
 * una semilla por la que tirar. Y detrás, las que has añadido tú desde un archivo (J5.4): las
 * de tu lista, que salen en todos tus gremios (D-J35), y las que guardaba este gremio antes.
 * Una añadida que quitaste del tablón sigue en el gremio donde la empezaste, sin «Quitar».
 *
 * @param {Object} input
 * @param {any[]} input.worlds Los de `mundos.json`.
 * @param {any} [input.hub]
 * @param {any[]} [input.imported] D-J35: tu lista de campañas añadidas (`readImportedList`).
 * @param {number} [input.level] El del héroe, para decir si le viene grande.
 * @returns {Array<{id: string, name: string, genre: string, note: string, synopsis: string, icon: string,
 *   traits: string[], levels: string, minLevel: number, hard: boolean, distance: string, state: 'nueva'|'en-curso'|'terminada',
 *   action: string, warn: string, ending: string, chapter: string, imported: boolean}>}
 */
export function hubCampaignCards({ worlds, hub = null, imported = [], level = 1 }) {
    const record = readHub(hub);
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const shipped = Array.isArray(worlds) ? worlds : [];
    // J5.4 y D-J35: detrás de las del juego, las que has añadido tú.
    const known = new Set(shipped.map(world => text(world?.id)));
    const listed = [...shipped, ...importedForHub(imported, record).filter(row => !known.has(row.id))]
        .filter(world => text(world?.id) && text(world?.pack));
    // D-J35: una añadida por ti que quitaste del tablón, pero que este gremio tiene empezada o
    // terminada: su tarjeta se queda aquí, para volver a ella. Su mundo ya lo lleva todo dentro.
    const shown = new Set(listed.map(world => text(world.id)));
    const kept = Object.entries(record.campaigns)
        .filter(([id]) => id.startsWith(HUB_IMPORTED_PREFIX) && !shown.has(id))
        .map(([id, started]) => ({
            id,
            name: started.name || started.worldName,
            note: HUB_KEPT_NOTE,
            icon: 'fa-book-open',
        }));
    return [...listed, ...kept]
        .map(world => {
            const id = text(world.id);
            const started = record.campaigns[id];
            const [min, max] = Array.isArray(world.levels) ? world.levels.map(n => Math.floor(Number(n) || 0)) : [0, 0];
            const state = started ? (started.finished ? 'terminada' : 'en-curso') : 'nueva';
            return {
                id,
                name: text(world.name) || id,
                genre: text(world.genre),
                note: text(world.note),
                synopsis: text(world.synopsis),
                icon: text(world.icon) || 'fa-scroll',
                traits: (Array.isArray(world.traits) ? world.traits : []).map(text).filter(Boolean),
                // D-J22: que se vea bien para qué nivel es: las hay que empiezan en el 10.
                levels: min > 0 ? `Nivel recomendado: ${max > min ? `${min} a ${max}` : min}` : '',
                minLevel: Math.max(0, min),
                // Si tu grupo no llega al nivel con el que empieza.
                hard: min >= 1 && lvl < min,
                // Lo lejos que queda del pueblo: cada campaña es otro mundo, pero se llega por el camino.
                distance: journeyDays(world) > 0 ? `A ${journeySpan(journeyDays(world))} de camino` : '',
                state,
                // J4.5: una terminada no se sigue: se vuelve a ella, a pasear por lo ganado.
                action: state === 'nueva' ? 'Empezar' : state === 'terminada' ? 'Volver' : 'Seguir',
                // Solo se avisa: quien quiera meterse con Strahd a nivel 1 puede. J4.6: y lo que
                // pasa entonces, lo mismo que se dice en la primera pelea (`combat/level-adjust.js`).
                // D-J22: por debajo, que quede claro que no es para un grupo sin experiencia.
                warn: state !== 'nueva' || min < 1 ? ''
                    : lvl < min ? `No es para un grupo sin experiencia: empieza en el nivel ${min} y tu grupo es de nivel ${lvl}. Si vais, los enemigos aflojan un poco, pero no del todo.`
                        : lvl > Math.max(min, max) ? `Tu grupo es de nivel ${lvl}, más de lo que pide: los enemigos aprietan más.` : '',
                ending: started?.ending ?? '',
                // J9.3: por qué capítulo ibais, en una empezada; en una terminada ya lo dice el final.
                chapter: state === 'en-curso' ? (started?.chapter ?? '') : '',
                // D-J35: las añadidas por ti se pueden quitar del tablón.
                imported: Boolean(world.imported),
            };
        });
}

/**
 * El nombre del mundo de una campaña empezada desde un gremio: el de la campaña, con quien
 * la juega, para que dos gremios que empiezan la misma no se pisen.
 *
 * @param {string} name
 * @param {string} hero
 * @param {string[]} existing
 * @returns {string}
 */
export function hubCampaignWorldName(name, hero, existing) {
    const base = text(hero) ? `${text(name)} · ${text(hero)}` : text(name);
    return uniqueWorldName(base, existing);
}

/**
 * Lo que se copia de la ficha de un personaje para que exista en otro mundo.
 *
 * Con sus números **de ahora**, los del grupo: la ficha del mundo de salida puede ir por
 * detrás (subió de nivel en la campaña), y una ficha vieja en el mundo de llegada le
 * bajaría el nivel la próxima vez que el editor pusiera el grupo al día.
 *
 * @param {any} entry
 * @param {any} [member] Cómo va ahora, si se sabe.
 * @returns {{comment: string, key: string[], content: string, group: string, dndData: any}}
 */
export function carryEntry(entry, member = null) {
    const dndData = JSON.parse(JSON.stringify(entry?.dndData ?? {}));
    if (member) {
        const now = entryFromMember(member).dndData;
        delete now.entityType;
        if (!now.image) delete now.image;
        Object.assign(dndData, now);
    }
    return {
        comment: text(entry?.comment),
        key: Array.isArray(entry?.key) ? entry.key.map(text).filter(Boolean) : [],
        content: String(entry?.content ?? ''),
        group: text(entry?.group),
        dndData,
    };
}

/**
 * Una ficha hecha con lo que se sabe de alguien, para quien viaja sin la suya (se borró, o
 * era de un mundo que ya no está).
 *
 * @param {any} member
 * @returns {{comment: string, key: string[], content: string, group: string, dndData: any}}
 */
export function entryFromMember(member) {
    const name = text(member?.name);
    const what = [text(member?.race), text(member?.class ?? member?.charClass)].filter(Boolean).join(', ');
    return {
        comment: name,
        key: name ? [name] : [],
        content: what ? `${name}: ${what}.` : name,
        group: 'Characters',
        dndData: {
            entityType: 'character',
            name,
            charClass: text(member?.class ?? member?.charClass),
            race: text(member?.race),
            background: text(member?.background),
            level: Math.max(1, Math.floor(Number(member?.level) || 1)),
            maxHp: Number(member?.maxHp) || 10,
            str: Number(member?.strength) || 10,
            dex: Number(member?.dexterity) || 10,
            con: Number(member?.constitution) || 10,
            int: Number(member?.intelligence) || 10,
            wis: Number(member?.wisdom) || 10,
            cha: Number(member?.charisma) || 10,
            ac: Number(member?.armorClass) || 10,
            speed: Number(member?.speed) || 30,
            image: text(member?.avatar),
        },
    };
}

/**
 * El grupo que llega a otro chat.
 *
 * Llega **entero**: la vida, el oro, lo que llevan, el nivel, los mercenarios. De lo que
 * había allí solo se queda dónde estaba cada uno —vuelves a la campaña donde la dejaste— y
 * a qué ficha de ese mundo apunta. Quien no estaba aparece al lado del primero.
 *
 * @param {Object} input
 * @param {any[]} input.carried El grupo tal y como sale.
 * @param {any[]} input.here    El que había en el chat de llegada (vacío en uno nuevo).
 * @param {string} input.worldName
 * @param {Record<string, number>} [input.uids] Su ficha en el mundo de llegada, por nombre en minúsculas.
 * @param {{locationName?: string, gridX?: number, gridY?: number}} [input.lead] Dónde está el primero.
 * @returns {any[]}
 */
export function settleCarried({ carried, here, worldName, uids = {}, lead = {} }) {
    const before = new Map((Array.isArray(here) ? here : []).map(m => [key(m?.name), m]));
    let beside = 0;
    return (Array.isArray(carried) ? carried : [])
        .filter(member => member && text(member.name))
        .map(member => {
            const was = before.get(key(member.name));
            const uid = uids[key(member.name)];
            const at = was?.mapPosition ?? {
                locationName: text(lead?.locationName),
                gridX: (Number(lead?.gridX) || 0) + (++beside),
                gridY: Number(lead?.gridY) || 0,
            };
            return {
                ...JSON.parse(JSON.stringify(member)),
                // Un invitado no tiene ficha en ningún mundo, y así sigue.
                wiUid: member.guest ? null : (Number.isFinite(uid) ? uid : (was?.wiUid ?? null)),
                worldName: text(worldName),
                mapPosition: { ...at },
            };
        });
}

/**
 * El grupo al cambiar de chat: los mercenarios del gremio entrenan hasta el nivel del héroe
 * (con la vida que da), y el que cayó no vuelve.
 *
 * Sin esto se quedaban a nivel 1 para siempre, con 16 de vida, mientras el héroe llegaba a
 * Strahd a nivel 5.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
export function hubRoster(party) {
    const list = (Array.isArray(party) ? party : []).filter(m => m && !(m.guest?.kind === 'mercenary' && m.dead));
    const hero = list.find(m => !m.guest);
    const level = Math.max(1, Math.floor(Number(hero?.level) || 1));
    return list.map(member => {
        if (member.guest?.kind !== 'mercenary' || (Number(member.level) || 1) >= level) return member;
        const maxHp = mercenaryHp(level);
        const gained = Math.max(0, maxHp - (Number(member.maxHp) || 0));
        return { ...member, level, maxHp, hp: Math.min(maxHp, (Number(member.hp) || 0) + gained) };
    });
}

/**
 * Los mercenarios del gremio, con su precio y si ya van contigo.
 *
 * En el gremio están siempre los tres: aquí no se contrata para un encargo sino para lo que
 * venga, y se quedan hasta que los despides o caen.
 *
 * @param {Object} input
 * @param {Array<{name: string, className: string, strength: number, dexterity: number}>} input.hirelings
 * @param {any[]} input.party
 * @param {number} input.fee Lo que cobra uno de nivel 1.
 * @returns {Array<{name: string, className: string, strength: number, dexterity: number, fee: number, hired: boolean, id: string}>}
 */
export function hireOffers({ hirelings, party, fee }) {
    const list = Array.isArray(party) ? party : [];
    const level = Math.max(1, Math.floor(Number(list.find(m => !m?.guest)?.level) || 1));
    return (Array.isArray(hirelings) ? hirelings : []).map(offer => {
        const inParty = list.find(m => m?.guest && key(m.name) === key(offer.name) && !m.dead);
        return {
            ...offer,
            fee: Math.max(0, Math.floor(Number(fee) || 0)) * level,
            hired: Boolean(inParty),
            id: inParty ? String(inParty.id) : '',
        };
    });
}

/**
 * Lo que `createCampaign` necesita para crear una campaña del tablón sin pasar por el taller.
 *
 * @param {Object} input
 * @param {any} input.world La entrada de `mundos.json`.
 * @param {any} input.pack  Su paquete, ya leído.
 * @param {string} input.worldName
 * @returns {any}
 */
export function answersForWorld({ world, pack, worldName }) {
    return {
        templateId: 'imported',
        importedPack: pack,
        worldName: text(worldName),
        genre: text(world?.genre),
        description: text(world?.synopsis),
        seed: text(world?.seed),
        // El grupo no sale del paquete: es el tuyo, y llega aparte.
        party: [],
        board: world?.board && typeof world.board === 'object' ? world.board : null,
    };
}

/**
 * Una línea para la tarjeta de la portada: quién es y con quién va.
 *
 * @param {any[]} party
 * @returns {string}
 */
export function hubPartyLine(party) {
    const list = (Array.isArray(party) ? party : []).filter(m => m && text(m.name) && !m.dead);
    const hero = list.find(m => !m.guest) ?? list[0];
    if (!hero) return '';
    const what = [text(hero.class ?? hero.charClass), `nivel ${Math.max(1, Math.floor(Number(hero.level) || 1))}`].filter(Boolean).join(', ');
    const others = list.filter(m => m !== hero).map(m => text(m.name));
    return `${text(hero.name)} (${what})${others.length > 0 ? `, con ${others.join(', ')}` : ''}`;
}

/**
 * J2.3: la prueba del gremio, si sigue por hacer: en Puerto Alba, las ratas de la bodega.
 *
 * Desde J2.1 el gremio empieza antes, con un prólogo (el muelle, una charla, Brunilda), y la
 * prueba es su último hito, el último que pide ganar un tablero (`prologueOf`). Se puede saltar
 * mientras quede algo del prólogo por hacer, y saltarla salta el prólogo entero.
 *
 * Saltarla es darla por ganada con el **mismo suceso** que manda la pelea (`{kind: 'win'}`):
 * el hilo da por hecho lo que faltaba del prólogo sin contarlo, abre el hito siguiente y cuenta
 * su escena. Por eso aquí no se decide nada del hilo, solo cuál es la prueba y qué tableros
 * del prólogo quedan por ganar (`boards`, con la prueba la última), para dar su botín y
 * apuntarlos como ganados igual que si se hubieran peleado.
 *
 * Un hilo sin prólogo marcado (un gremio de antes de J2.1) tiene por prueba el hito con el que
 * empieza, si pide ganar un tablero.
 *
 * @param {any} plot El hilo, como lo lee `readPlot`.
 * @param {any} state Por dónde va, como lo lee `readPlotState`.
 * @returns {{id: string, title: string, board: string, place: string, boards: Array<{board: string, place: string}>}|null}
 */
export function hubTrial(plot, state) {
    const open = new Set((Array.isArray(state?.open) ? state.open : []).map(text));
    const over = new Set(['done', 'closed', 'missed'].flatMap(list => (Array.isArray(state?.[list]) ? state[list] : []).map(text)));
    const boardOf = (/** @type {any} */ m) => ({ board: text(m.asks.board), place: text(m.asks.place) });
    const { milestones, trial: written } = prologueOf(plot);
    if (written) {
        if (over.has(text(written.id)) || !milestones.some(m => open.has(text(m.id)))) return null;
        const boards = milestones
            .filter(m => !m.hidden && !over.has(text(m.id)) && key(m.asks?.kind) === 'win' && text(m.asks?.board))
            .map(boardOf);
        return { id: text(written.id), title: text(written.title), ...boardOf(written), boards };
    }
    const trial = (Array.isArray(plot?.milestones) ? plot.milestones : []).find((/** @type {any} */ m) =>
        m && !m.hidden && open.has(text(m.id)) && key(m.opens?.kind) === 'start' && key(m.asks?.kind) === 'win' && text(m.asks?.board));
    if (!trial) return null;
    return { id: text(trial.id), title: text(trial.title), ...boardOf(trial), boards: [boardOf(trial)] };
}
