/**
 * La partida entera en un archivo (J15.6 de wiki/ROADMAP_SIN_CONEXION.md), y lo que lleva
 * dentro cada ranura de guardado (J15.2, `save-slots.js`).
 *
 * Una partida no es un archivo: es **un gremio** (su mundo, con el pueblo, la gente y los
 * héroes que esperan en él), **cada campaña empezada desde su tablón** (su mundo) y **los
 * chats de todos**, que es donde vive lo jugado: el grupo, el día, el hilo, los puntos de
 * retorno. Repartido por el disco en tres carpetas. Para llevársela a otro ordenador, o para
 * guardarla en una ranura y volver a ella, hay que juntarlo todo:
 *
 * - `worlds`: los mundos, enteros, el del gremio primero.
 * - `chats`: los chats, línea a línea, con su cabecera (sus metadatos).
 * - `narrators`: las fichas de quien narra cada chat, para que otro ordenador pueda abrirlos.
 * - `files`: lo que la partida tiene entre tus archivos: el mundo guardado de cada punto de
 *   retorno y el paquete de las campañas que añadiste tú al tablón.
 * - `imported`: las filas del tablón de esas campañas tuyas.
 * - `hall`: lo que el salón de la fama apuntó de esta partida.
 *
 * Lo que no entra: tus ajustes, tus otras partidas y el salón de las demás.
 *
 * Dos maneras de volver a meterla:
 *
 * - **Importarla** (`planImport`): como partida nueva, al lado de las que haya. Si un nombre
 *   ya está cogido (importar dos veces la misma), se renombra, y todo lo que lo nombraba se
 *   pone al día: el gremio sabe dónde están sus campañas y cada chat, a qué mundo pertenece.
 * - **Cargarla encima** (`planRestore`): una ranura vuelve a su sitio con los mismos nombres,
 *   y lo que se empezó después de guardarla (una campaña nueva, su chat) se quita.
 *
 * Puro: junta, comprueba y planea. Quien llama lee y escribe el disco.
 */

import { uniqueWorldName } from './campaign-worlds.js';
import { saveSummary, describeSave } from './save-card.js';
import { hubPartyLine, isHubWorld, hubHomeOf, readHub, HUB_KEY, HUB_HOME_KEY } from './hub.js';
import { campaignTitle } from './saved-games.js';
import { CHECKPOINT_KEY } from './checkpoint.js';

/** Lo que dice el archivo que es. */
export const ARCHIVE_FORMAT = 'sillytavern-rpg-partida';

/** La versión del formato. Uno de una versión más nueva se rechaza con su porqué. */
export const ARCHIVE_VERSION = 1;

/** Cómo termina el nombre de una partida exportada. */
export const ARCHIVE_EXTENSION = '.partida.json';

/** Lo más grande que se lee: una partida muy larga, con sus chats, cabe de sobra. */
export const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;

/** En los metadatos del chat, el mundo al que pertenece (el `METADATA_KEY` de world-info.js). */
export const CHAT_WORLD_KEY = 'world_info';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {any} */
const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/**
 * @typedef {Object} ArchiveWorld
 * @property {string} name
 * @property {any} data El lorebook entero: `{entries, metadata}`.
 */

/**
 * @typedef {Object} ArchiveChat
 * @property {string} avatar La ficha de quien narra (`Posadero.png`).
 * @property {string} file   El chat, sin `.jsonl`.
 * @property {string} world  El mundo al que pertenece.
 * @property {any[]} lines   Las líneas del chat; la primera, su cabecera con `chat_metadata`.
 */

/**
 * @typedef {Object} ArchiveNarrator
 * @property {string} avatar
 * @property {string} name
 * @property {Record<string, string>} card Los campos de la ficha, como los pide `/api/characters/create`.
 * @property {string} [image] Su cara, en base64 (PNG), si se exportó con ella.
 */

/**
 * @typedef {Object} ArchiveFile
 * @property {string} name  El nombre entre tus archivos.
 * @property {'punto'|'campana'} kind
 * @property {string} text  Su contenido.
 */

/**
 * @typedef {Object} ArchiveWhere
 * @property {string} world
 * @property {string} avatar
 * @property {string} file
 */

/**
 * @typedef {Object} GameArchive
 * @property {string} format
 * @property {number} version
 * @property {string} savedAt
 * @property {{id: string, title: string, kind: 'gremio'|'campaña'}} game
 * @property {ArchiveWhere} where Dónde se quedó: el chat que se abre al cargarla.
 * @property {ArchiveWorld[]} worlds
 * @property {ArchiveChat[]} chats
 * @property {ArchiveNarrator[]} narrators
 * @property {ArchiveFile[]} files
 * @property {any[]} imported
 * @property {any[]} hall
 */

/**
 * La partida a la que pertenece un mundo: un gremio es la suya; una campaña de su tablón es
 * de ese gremio; una campaña suelta es su propia partida. Como en «Cargar partida».
 *
 * @param {string} worldName
 * @param {any} meta Los metadatos de ese mundo.
 * @returns {string}
 */
export function gameIdOf(worldName, meta) {
    const name = text(worldName);
    if (!name) return '';
    if (isHubWorld(meta)) return name;
    return hubHomeOf(meta) || name;
}

/**
 * Qué mundos y qué chats son de una partida.
 *
 * El gremio, los mundos que dicen salir de él y los que su tablón apunta como empezados; y de
 * chats, los de esos mundos. El gremio va primero, y luego sus campañas en el orden en que
 * vienen (los chats llegan del último tocado al primero).
 *
 * @param {Object} input
 * @param {string} input.gameId
 * @param {Record<string, any>} input.worlds Los metadatos de cada mundo que existe, por nombre.
 * @param {Array<{avatar?: string, file_name?: string, chat_metadata?: any}>} input.chats
 * @returns {{worlds: string[], chats: Array<{avatar: string, file: string, world: string}>}}
 */
export function gameMembers({ gameId, worlds, chats }) {
    const id = text(gameId);
    const known = worlds && typeof worlds === 'object' ? worlds : {};
    if (!id) return { worlds: [], chats: [] };
    const recorded = Object.values(readHub(known[id]?.[HUB_KEY]).campaigns).map(c => c.worldName);
    const names = [id];
    const add = (/** @type {string} */ name) => {
        if (name && !names.includes(name)) names.push(name);
    };
    for (const chat of Array.isArray(chats) ? chats : []) {
        const name = text(chat?.chat_metadata?.[CHAT_WORLD_KEY]);
        if (name && name !== id && text(known[name]?.[HUB_HOME_KEY]) === id) add(name);
    }
    for (const name of Object.keys(known)) {
        if (text(known[name]?.[HUB_HOME_KEY]) === id) add(name);
    }
    for (const name of recorded) {
        if (Object.prototype.hasOwnProperty.call(known, name)) add(name);
    }
    const members = names.filter(name => Object.prototype.hasOwnProperty.call(known, name));
    /** @type {Array<{avatar: string, file: string, world: string}>} */
    const listed = [];
    for (const chat of Array.isArray(chats) ? chats : []) {
        const world = text(chat?.chat_metadata?.[CHAT_WORLD_KEY]);
        const file = text(chat?.file_name).replace(/\.jsonl$/i, '');
        const avatar = text(chat?.avatar);
        if (!members.includes(world) || !file || !avatar) continue;
        if (listed.some(c => c.avatar === avatar && c.file === file)) continue;
        listed.push({ avatar, file, world });
    }
    return { worlds: members, chats: listed };
}

/**
 * La cabecera de un chat (su primera línea), o null.
 *
 * @param {any[]} lines
 * @returns {any|null}
 */
export function chatHeader(lines) {
    const first = Array.isArray(lines) ? lines[0] : null;
    return first && typeof first === 'object' && first.chat_metadata && typeof first.chat_metadata === 'object' ? first : null;
}

/**
 * Los archivos tuyos que nombra una partida: el mundo guardado de cada punto de retorno.
 *
 * @param {ArchiveChat[]} chats
 * @returns {string[]} Sus direcciones (`user/files/punto-….json`).
 */
export function pointFilesOf(chats) {
    const files = new Set();
    for (const chat of Array.isArray(chats) ? chats : []) {
        const points = chatHeader(chat?.lines)?.chat_metadata?.[CHECKPOINT_KEY];
        for (const point of Array.isArray(points) ? points : []) {
            if (text(point?.worldFile)) files.add(text(point.worldFile));
        }
    }
    return [...files];
}

/**
 * El nombre de un archivo tuyo a partir de su dirección.
 *
 * @param {string} url
 * @returns {string}
 */
export function fileNameOf(url) {
    return decodeURIComponent(text(url).split('?')[0].split('/').pop() ?? '');
}

/**
 * Las campañas que añadiste tú y que esta partida empezó: sus ids (`tuya-…`).
 *
 * @param {ArchiveWorld[]} worlds
 * @param {string} gameId
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function importedIdsOf(worlds, gameId, prefix = 'tuya-') {
    const home = (Array.isArray(worlds) ? worlds : []).find(w => w?.name === gameId);
    return Object.keys(readHub(home?.data?.metadata?.[HUB_KEY]).campaigns).filter(id => id.startsWith(prefix));
}

/**
 * Junta la partida.
 *
 * @param {Object} input
 * @param {{id: string, title?: string, kind?: 'gremio'|'campaña'}} input.game
 * @param {ArchiveWhere} input.where
 * @param {ArchiveWorld[]} input.worlds
 * @param {ArchiveChat[]} input.chats
 * @param {ArchiveNarrator[]} [input.narrators]
 * @param {ArchiveFile[]} [input.files]
 * @param {any[]} [input.imported]
 * @param {any[]} [input.hall]
 * @param {() => string} [input.now]
 * @returns {GameArchive}
 */
export function buildArchive({ game, where, worlds, chats, narrators = [], files = [], imported = [], hall = [], now = () => new Date().toISOString() }) {
    const worldList = (Array.isArray(worlds) ? worlds : []).filter(w => text(w?.name) && w?.data && typeof w.data === 'object')
        .map(w => ({ name: text(w.name), data: clone(w.data) }));
    const home = worldList.find(w => w.name === text(game?.id));
    return {
        format: ARCHIVE_FORMAT,
        version: ARCHIVE_VERSION,
        savedAt: now(),
        game: {
            id: text(game?.id),
            title: text(game?.title) || text(home?.data?.metadata?.displayName) || text(game?.id),
            kind: game?.kind ?? (isHubWorld(home?.data?.metadata) ? 'gremio' : 'campaña'),
        },
        where: { world: text(where?.world), avatar: text(where?.avatar), file: text(where?.file).replace(/\.jsonl$/i, '') },
        worlds: worldList,
        chats: (Array.isArray(chats) ? chats : []).filter(c => text(c?.avatar) && text(c?.file) && chatHeader(c?.lines))
            .map(c => ({ avatar: text(c.avatar), file: text(c.file).replace(/\.jsonl$/i, ''), world: text(c.world), lines: clone(c.lines) })),
        narrators: (Array.isArray(narrators) ? narrators : []).filter(n => text(n?.avatar))
            .map(n => ({ avatar: text(n.avatar), name: text(n.name), card: clone(n.card ?? {}), ...(text(n.image) ? { image: text(n.image) } : {}) })),
        files: (Array.isArray(files) ? files : []).filter(f => text(f?.name) && typeof f?.text === 'string')
            .map(f => ({ name: text(f.name), kind: f.kind === 'campana' ? 'campana' : 'punto', text: f.text })),
        imported: clone(Array.isArray(imported) ? imported : []),
        hall: clone(Array.isArray(hall) ? hall : []),
    };
}

/**
 * Lee un archivo de partida y dice lo que le pasa, en español y sin tecnicismos.
 *
 * @param {any} raw El texto del archivo o el objeto ya leído.
 * @returns {{archive: GameArchive|null, problems: string[]}}
 */
export function readArchive(raw) {
    /** @type {string[]} */
    const problems = [];
    let data = raw;
    if (typeof raw === 'string') {
        if (raw.length > MAX_ARCHIVE_BYTES) return { archive: null, problems: ['El archivo es demasiado grande para ser una partida.'] };
        try {
            data = JSON.parse(raw);
        } catch {
            return { archive: null, problems: ['El archivo no se puede leer: no es una partida guardada (le falta o le sobra algo por dentro).'] };
        }
    }
    if (!data || typeof data !== 'object' || data.format !== ARCHIVE_FORMAT) {
        return { archive: null, problems: ['Este archivo no es una partida del juego. Una partida exportada termina en «.partida.json».'] };
    }
    const version = Math.floor(Number(data.version) || 0);
    if (version < 1) problems.push('No se sabe de qué versión del juego es la partida.');
    if (version > ARCHIVE_VERSION) problems.push('La partida es de una versión más nueva del juego. Pon el juego al día y vuelve a probar.');

    const worlds = Array.isArray(data.worlds) ? data.worlds : [];
    const gameId = text(data.game?.id);
    if (!gameId) problems.push('No dice cuál es la partida.');
    if (worlds.length === 0) problems.push('No trae ningún mundo.');
    const names = new Set();
    worlds.forEach((/** @type {any} */ w, /** @type {number} */ i) => {
        const name = text(w?.name);
        if (!name) problems.push(`Al mundo número ${i + 1} le falta el nombre.`);
        else if (names.has(name)) problems.push(`El mundo «${name}» viene dos veces.`);
        names.add(name);
        if (!w?.data || typeof w.data !== 'object' || typeof w.data.entries !== 'object' || w.data.entries === null) {
            problems.push(`El mundo «${name || i + 1}» está roto: le faltan sus fichas.`);
        }
    });
    if (gameId && worlds.length > 0 && !names.has(gameId)) problems.push(`Falta el mundo de la partida, «${gameId}».`);

    const chats = Array.isArray(data.chats) ? data.chats : [];
    chats.forEach((/** @type {any} */ c, /** @type {number} */ i) => {
        if (!text(c?.avatar) || !text(c?.file)) problems.push(`Al chat número ${i + 1} le falta de quién es o cómo se llama.`);
        else if (!chatHeader(c?.lines)) problems.push(`El chat «${text(c.file)}» está roto: le falta su cabecera.`);
        else if (text(c.world) && !names.has(text(c.world))) problems.push(`El chat «${text(c.file)}» es de un mundo que no viene, «${text(c.world)}».`);
    });

    if (problems.length > 0) return { archive: null, problems };
    return {
        archive: buildArchive({
            game: data.game,
            where: data.where ?? {},
            worlds,
            chats,
            narrators: data.narrators,
            files: data.files,
            imported: data.imported,
            hall: data.hall,
            now: () => text(data.savedAt),
        }),
        problems: [],
    };
}

/**
 * Lo que se enseña de una partida antes de importarla o al cargar su ranura.
 *
 * @param {GameArchive} archive
 * @returns {{title: string, line: string, hero: string, where: string, campaigns: string[], sessions: number, savedAt: string}}
 */
export function archiveSummary(archive) {
    const whereChat = archive.chats.find(c => c.avatar === archive.where.avatar && c.file === archive.where.file)
        ?? archive.chats.find(c => c.world === archive.game.id) ?? archive.chats[0];
    const meta = chatHeader(whereChat?.lines)?.chat_metadata ?? {};
    const campaigns = archive.worlds.filter(w => w.name !== archive.game.id)
        .map(w => campaignTitle(text(w.data?.metadata?.displayName) || w.name));
    const whereWorld = archive.worlds.find(w => w.name === whereChat?.world);
    const where = whereWorld && whereWorld.name !== archive.game.id
        ? campaignTitle(text(whereWorld.data?.metadata?.displayName) || whereWorld.name) : '';
    return {
        title: archive.game.title,
        line: whereChat ? describeSave(saveSummary(meta)) : '',
        hero: hubPartyLine(meta.party),
        where,
        campaigns,
        sessions: archive.chats.length,
        savedAt: archive.savedAt,
    };
}

/**
 * El nombre del archivo al exportar: «partida-el-gremio-2026-09-30.partida.json».
 *
 * @param {string} title
 * @param {Date} [date]
 * @returns {string}
 */
export function archiveFileName(title, date = new Date()) {
    const slug = text(title).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'partida';
    const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
    return `partida-${slug}-${day}${ARCHIVE_EXTENSION}`;
}

/**
 * Pone al día lo que un mundo dice de otros: el gremio, dónde viven su chat y sus campañas;
 * una campaña, de qué gremio sale; y quién narra.
 *
 * @param {any} data El lorebook; se cambia en el sitio.
 * @param {Object} maps
 * @param {Record<string, string>} [maps.worlds] Nombre viejo → nuevo.
 * @param {(avatar: string, file: string) => string} [maps.chat] El nombre nuevo de un chat.
 * @param {Record<string, string>} [maps.avatars] Ficha vieja → nueva.
 * @returns {any}
 */
export function renameInWorld(data, { worlds = {}, chat = (_a, file) => file, avatars = {} }) {
    const meta = data?.metadata;
    if (!meta || typeof meta !== 'object') return data;
    const world = (/** @type {string} */ name) => worlds[name] ?? name;
    const avatar = (/** @type {string} */ name) => avatars[name] ?? name;
    if (text(meta[HUB_HOME_KEY])) meta[HUB_HOME_KEY] = world(text(meta[HUB_HOME_KEY]));
    if (text(meta.narratorAvatar)) meta.narratorAvatar = avatar(text(meta.narratorAvatar));
    const hub = meta[HUB_KEY];
    if (hub && typeof hub === 'object') {
        if (hub.chat && typeof hub.chat === 'object' && text(hub.chat.file)) {
            hub.chat = { ...hub.chat, file: chat(text(hub.chat.avatar), text(hub.chat.file)), avatar: avatar(text(hub.chat.avatar)) };
        }
        for (const campaign of Object.values(hub.campaigns && typeof hub.campaigns === 'object' ? hub.campaigns : {})) {
            const one = /** @type {any} */ (campaign);
            if (!one || typeof one !== 'object') continue;
            if (text(one.worldName)) one.worldName = world(text(one.worldName));
            if (one.chat && typeof one.chat === 'object' && text(one.chat.file)) {
                one.chat = { ...one.chat, file: chat(text(one.chat.avatar), text(one.chat.file)), avatar: avatar(text(one.chat.avatar)) };
            }
        }
    }
    return data;
}

/**
 * Pone al día lo que un chat dice: a qué mundo pertenece y dónde está el mundo guardado de
 * cada punto de retorno.
 *
 * @param {any[]} lines Se cambian en el sitio.
 * @param {Object} maps
 * @param {Record<string, string>} [maps.worlds]
 * @param {Record<string, string>} [maps.files] Dirección vieja → nueva. Una que no está se quita.
 * @returns {any[]}
 */
export function renameInChat(lines, { worlds = {}, files = null }) {
    const header = chatHeader(lines);
    if (!header) return lines;
    const meta = header.chat_metadata;
    const world = text(meta[CHAT_WORLD_KEY]);
    if (world && worlds[world]) meta[CHAT_WORLD_KEY] = worlds[world];
    if (files && Array.isArray(meta[CHECKPOINT_KEY])) {
        meta[CHECKPOINT_KEY] = meta[CHECKPOINT_KEY].map((/** @type {any} */ point) => {
            const was = text(point?.worldFile);
            if (!was) return point;
            const next = { ...point };
            if (files[was]) next.worldFile = files[was];
            else delete next.worldFile;
            return next;
        });
    }
    // La comprobación de SillyTavern compara con el archivo que había: un chat que llega de
    // otro sitio no tiene nada con qué compararse.
    delete meta.integrity;
    return lines;
}

/**
 * @typedef {Object} ImportPlan
 * @property {string} gameId  El nombre del mundo de la partida, ya libre.
 * @property {string} title
 * @property {ArchiveWorld[]} worlds Con sus nombres nuevos y lo que nombran, al día.
 * @property {ArchiveChat[]} chats
 * @property {Array<ArchiveNarrator & {create: boolean}>} narrators Las que hay que crear, y las que ya están.
 * @property {ArchiveFile[]} files Con sus nombres nuevos.
 * @property {any[]} imported
 * @property {any[]} hall
 * @property {ArchiveWhere} where
 * @property {Record<string, string>} renamed Los mundos que cambiaron de nombre (viejo → nuevo).
 */

/**
 * Cómo entra una partida como nueva, sin pisar nada de lo que hay.
 *
 * @param {GameArchive} archive
 * @param {Object} context
 * @param {string[]} context.worldNames Los mundos que ya existen.
 * @param {Record<string, string[]>} [context.chatFiles] Los chats que ya tiene cada ficha, sin `.jsonl`.
 * @param {string[]} [context.avatars] Las fichas que ya existen.
 * @param {string[]} [context.fileNames] Tus archivos que ya existen.
 * @param {string} [context.stamp] Para renombrar lo que choca; por defecto, la hora.
 * @returns {ImportPlan}
 */
export function planImport(archive, { worldNames, chatFiles = {}, avatars = [], fileNames = [], stamp = Date.now().toString(36) }) {
    const taken = (Array.isArray(worldNames) ? worldNames : []).map(text);
    /** @type {Record<string, string>} */
    const worldMap = {};
    for (const world of archive.worlds) {
        const next = uniqueWorldName(world.name, taken);
        worldMap[world.name] = next;
        taken.push(next);
    }

    // Los chats, por ficha: el que choca con uno que ya está se llama «… (importada)».
    /** @type {Record<string, string>} */
    const chatMap = {};
    /** @type {Record<string, Set<string>>} */
    const usedChats = {};
    const used = (/** @type {string} */ avatar) => {
        usedChats[avatar] = usedChats[avatar] ?? new Set((chatFiles[avatar] ?? []).map(f => text(f).replace(/\.jsonl$/i, '').toLowerCase()));
        return usedChats[avatar];
    };
    for (const chat of archive.chats) {
        const names = used(chat.avatar);
        let next = chat.file;
        for (let n = 1; names.has(next.toLowerCase()); n++) next = n === 1 ? `${chat.file} (importada)` : `${chat.file} (importada ${n})`;
        names.add(next.toLowerCase());
        chatMap[`${chat.avatar}\u0000${chat.file}`] = next;
    }
    const chatName = (/** @type {string} */ avatar, /** @type {string} */ file) => chatMap[`${avatar}\u0000${file}`] ?? file;

    // Los archivos: el mundo de un punto va con otro nombre si choca; el paquete de una
    // campaña tuya, con el mismo (el tablón lo busca por él), y solo si no está.
    const takenFiles = new Set((Array.isArray(fileNames) ? fileNames : []).map(f => text(f).toLowerCase()));
    /** @type {Record<string, string>} */
    const fileMap = {};
    /** @type {ArchiveFile[]} */
    const files = [];
    for (const file of archive.files) {
        if (file.kind === 'campana') {
            if (!takenFiles.has(file.name.toLowerCase())) files.push({ ...file });
            takenFiles.add(file.name.toLowerCase());
            continue;
        }
        let next = file.name;
        if (takenFiles.has(next.toLowerCase())) next = file.name.replace(/(\.json)?$/i, `-${stamp}$1`);
        takenFiles.add(next.toLowerCase());
        files.push({ ...file, name: next });
        fileMap[file.name] = next;
    }
    /** @type {Record<string, string>} */
    const urlMap = {};
    for (const url of pointFilesOf(archive.chats)) {
        const name = fileNameOf(url);
        if (fileMap[name]) urlMap[url] = url.slice(0, url.length - name.length) + fileMap[name];
    }

    const worlds = archive.worlds.map(world => {
        const data = renameInWorld(clone(world.data), { worlds: worldMap, chat: chatName });
        // Una copia en el mismo ordenador se llama distinto también en «Cargar partida».
        if (worldMap[world.name] !== world.name && world.name === archive.game.id && data?.metadata) {
            data.metadata.displayName = `${text(data.metadata.displayName) || world.name} (copia)`;
        }
        return { name: worldMap[world.name], data };
    });
    const chats = archive.chats.map(chat => ({
        avatar: chat.avatar,
        file: chatName(chat.avatar, chat.file),
        world: worldMap[chat.world] ?? chat.world,
        lines: renameInChat(clone(chat.lines), { worlds: worldMap, files: urlMap }),
    }));

    const have = new Set((Array.isArray(avatars) ? avatars : []).map(text));
    const needed = new Set(archive.chats.map(c => c.avatar));
    const narrators = archive.narrators.filter(n => needed.has(n.avatar)).map(n => ({ ...clone(n), create: !have.has(n.avatar) }));
    const hallWorlds = new Set(archive.worlds.map(w => w.name));

    return {
        gameId: worldMap[archive.game.id] ?? archive.game.id,
        title: worlds.find(w => w.name === (worldMap[archive.game.id] ?? archive.game.id))?.data?.metadata?.displayName || archive.game.title,
        worlds,
        chats,
        narrators,
        files,
        imported: clone(archive.imported),
        hall: archive.hall.map(entry => (hallWorlds.has(text(entry?.world)) ? { ...clone(entry), world: worldMap[text(entry.world)] } : clone(entry))),
        where: {
            world: worldMap[archive.where.world] ?? archive.where.world,
            avatar: archive.where.avatar,
            file: chatName(archive.where.avatar, archive.where.file),
        },
        renamed: Object.fromEntries(Object.entries(worldMap).filter(([from, to]) => from !== to)),
    };
}

/**
 * Si al crear una ficha el servidor le dio otro nombre, lo que la nombraba se pone al día.
 *
 * @param {ImportPlan} plan Se cambia en el sitio.
 * @param {Record<string, string>} avatars Ficha vieja → nueva.
 * @returns {ImportPlan}
 */
export function withAvatars(plan, avatars) {
    const changed = Object.entries(avatars ?? {}).filter(([from, to]) => text(to) && from !== to);
    if (changed.length === 0) return plan;
    const map = Object.fromEntries(changed);
    for (const world of plan.worlds) renameInWorld(world.data, { avatars: map });
    for (const chat of plan.chats) chat.avatar = map[chat.avatar] ?? chat.avatar;
    plan.where = { ...plan.where, avatar: map[plan.where.avatar] ?? plan.where.avatar };
    return plan;
}

/**
 * @typedef {Object} RestorePlan
 * @property {ArchiveWorld[]} worlds Los que se escriben, tal cual se guardaron.
 * @property {ArchiveChat[]} chats
 * @property {string[]} dropWorlds Los de la partida que se empezaron después: se quitan.
 * @property {Array<{avatar: string, file: string}>} dropChats
 * @property {ArchiveFile[]} files Los que faltan y la partida nombra.
 * @property {ArchiveWhere} where
 */

/**
 * Cómo vuelve una ranura a su sitio: los mismos nombres, lo de entonces encima de lo de
 * ahora, y fuera lo que la partida tiene y la ranura no (se empezó después de guardarla).
 *
 * @param {GameArchive} archive
 * @param {Object} present
 * @param {string[]} present.worlds Los mundos de la partida ahora (`gameMembers`).
 * @param {Array<{avatar: string, file: string}>} present.chats Sus chats ahora.
 * @param {string[]} [present.fileNames] Tus archivos que existen.
 * @returns {RestorePlan}
 */
export function planRestore(archive, { worlds, chats, fileNames = [] }) {
    const keptWorlds = new Set(archive.worlds.map(w => w.name));
    const keptChats = new Set(archive.chats.map(c => `${c.avatar}\u0000${c.file}`));
    const haveFiles = new Set((Array.isArray(fileNames) ? fileNames : []).map(f => text(f).toLowerCase()));
    return {
        worlds: archive.worlds.map(w => ({ name: w.name, data: clone(w.data) })),
        chats: archive.chats.map(c => ({ ...c, lines: renameInChat(clone(c.lines), {}) })),
        dropWorlds: (Array.isArray(worlds) ? worlds : []).map(text).filter(name => name && !keptWorlds.has(name)),
        dropChats: (Array.isArray(chats) ? chats : [])
            .map(c => ({ avatar: text(c?.avatar), file: text(c?.file).replace(/\.jsonl$/i, '') }))
            .filter(c => c.avatar && c.file && !keptChats.has(`${c.avatar}\u0000${c.file}`)),
        files: archive.files.filter(f => !haveFiles.has(f.name.toLowerCase())).map(f => ({ ...f })),
        where: { ...archive.where },
    };
}

/**
 * Lo que se dice al acabar de importar: qué ha entrado y, si algo se renombró, cómo se llama.
 *
 * @param {ImportPlan} plan
 * @param {{failed?: number}} [done]
 * @returns {string[]}
 */
export function describeImport(plan, done = {}) {
    const campaigns = plan.worlds.length - 1;
    const lines = [
        `Entra «${plan.title}»: ${campaigns <= 0 ? 'el gremio' : campaigns === 1 ? 'el gremio y 1 campaña' : `el gremio y ${campaigns} campañas`}, `
            + `${plan.chats.length === 1 ? 'con 1 sesión' : `con ${plan.chats.length} sesiones`}.`,
    ];
    const renamed = Object.entries(plan.renamed);
    if (renamed.length > 0) {
        lines.push(`Ya tenías una partida con ese nombre: la nueva es «${plan.title}», y sus mundos llevan un número detrás.`);
    }
    const created = plan.narrators.filter(n => n.create).length;
    if (created > 0) lines.push(created === 1 ? 'Se ha creado 1 narrador que no tenías.' : `Se han creado ${created} narradores que no tenías.`);
    if ((done.failed ?? 0) > 0) lines.push(`${done.failed} cosa(s) no se pudieron escribir: mira la consola.`);
    return lines;
}
