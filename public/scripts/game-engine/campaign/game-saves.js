/**
 * Guardar, cargar, exportar e importar la partida entera (J15.2, J3.3 y J15.6 de
 * wiki/ROADMAP_SIN_CONEXION.md), de principio a fin.
 *
 * `game-archive.js` sabe qué es una partida y cómo se renombra; `save-slots.js`, qué ranura
 * tiene qué. Esto hace los pasos en su orden, que es donde se rompen las cosas:
 *
 * - **Guardar en una ranura**: primero se escribe al disco lo que va por delante en memoria
 *   (el chat abierto), luego se junta la partida, se deja en su archivo y, solo si eso ha
 *   ido bien, se apunta la ranura. Una ranura nunca apunta a un archivo a medias.
 * - **Cargar una ranura**: se lee y se comprueba el archivo **antes** de tocar nada; luego se
 *   cierra el chat abierto (si no, SillyTavern lo volvería a guardar encima), se escribe todo,
 *   se quita lo que se empezó después y se abre el chat donde se guardó.
 * - **Exportar**: la partida en un archivo que te llevas.
 * - **Importar**: como partida nueva, con los nombres que estén libres.
 *
 * No toca SillyTavern: todo lo de fuera llega en `adapter` (ver `GameSavesAdapter`). Así se
 * prueba entero con un disco de mentira, y quien lo enchufa solo tiene que dar las llamadas.
 */

import {
    buildArchive, readArchive, gameIdOf, gameMembers, chatHeader, pointFilesOf, fileNameOf, importedIdsOf,
    planImport, withAvatars, planRestore, describeImport, archiveFileName, archiveSummary,
} from './game-archive.js';
import {
    slotEntry, slotFileName, withSlot, withoutSlot, slotFiles, readSlots, savedNotice, autosaveNeeded, SLOT_AUTO, SLOT_SLEEP,
    isSlotId,
} from './save-slots.js';
import { campaignTitle } from './saved-games.js';
import { isHubWorld } from './hub.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo de fuera que hace falta. Todo puede ser asíncrono.
 *
 * @typedef {Object} GameSavesAdapter
 * @property {() => string} openWorld El mundo del chat abierto, o vacío.
 * @property {() => {avatar: string, file: string}|null} openChat El chat abierto.
 * @property {() => Promise<void>} flush Escribe al disco lo que va por delante en memoria.
 * @property {() => Promise<Array<{avatar: string, file_name: string, chat_metadata: any}>>} listChats
 * @property {() => string[]|Promise<string[]>} listWorlds
 * @property {(name: string) => Promise<any|null>} readWorld
 * @property {(name: string, data: any, isNew: boolean) => Promise<void>} writeWorld
 * @property {(name: string) => Promise<boolean>} deleteWorld
 * @property {(avatar: string, file: string) => Promise<any[]>} readChat
 * @property {(avatar: string, file: string, lines: any[]) => Promise<void>} writeChat
 * @property {(avatar: string, file: string) => Promise<boolean>} deleteChat
 * @property {() => string[]|Promise<string[]>} avatars Las fichas que existen.
 * @property {(avatar: string, withImage: boolean) => Promise<import('./game-archive.js').ArchiveNarrator|null>} readNarrator
 * @property {(narrator: import('./game-archive.js').ArchiveNarrator) => Promise<string>} createNarrator Devuelve su ficha.
 * @property {(url: string) => Promise<string|null>} readText Un archivo tuyo, o null si no está.
 * @property {(name: string, content: string) => Promise<string>} writeText Devuelve su dirección.
 * @property {(url: string) => Promise<void>} deleteFile
 * @property {(name: string) => string} fileUrl La dirección de un archivo tuyo por su nombre.
 * @property {(urls: string[]) => Promise<Record<string, boolean>>} filesExist
 * @property {() => Promise<any[]>} readImported Tu lista de campañas añadidas.
 * @property {(rows: any[]) => Promise<void>} writeImported
 * @property {() => any[]} readHall
 * @property {(entries: any[]) => void} writeHall
 * @property {(gameId: string) => any} getSlots
 * @property {(gameId: string, slots: any) => void} setSlots
 * @property {() => Promise<boolean>} closeChat
 * @property {(chat: {avatar: string, file: string}) => Promise<boolean>} openChatFile
 * @property {() => number} [now]
 */

/**
 * La partida a la que pertenece el chat abierto.
 *
 * @param {GameSavesAdapter} adapter
 * @returns {Promise<string>}
 */
export async function openGameId(adapter) {
    const world = text(adapter.openWorld());
    if (!world) return '';
    const data = await adapter.readWorld(world).catch(() => null);
    return gameIdOf(world, data?.metadata ?? {});
}

/**
 * Los mundos de la partida y lo que dice cada uno, para saber quién es de quién.
 *
 * @param {GameSavesAdapter} adapter
 * @param {any[]} chats
 * @returns {Promise<Record<string, any>>} Los metadatos de cada mundo, por nombre.
 */
async function worldMetas(adapter, chats) {
    const names = new Set((await adapter.listWorlds()).map(text).filter(Boolean));
    for (const chat of chats) {
        const name = text(chat?.chat_metadata?.world_info);
        if (name) names.add(name);
    }
    /** @type {Record<string, any>} */
    const metas = {};
    for (const name of names) {
        const data = await adapter.readWorld(name).catch(() => null);
        if (data) metas[name] = data.metadata ?? {};
    }
    return metas;
}

/**
 * Junta la partida entera.
 *
 * @param {GameSavesAdapter} adapter
 * @param {Object} input
 * @param {string} input.gameId
 * @param {boolean} [input.withImages] Las caras de los narradores (para llevársela a otro ordenador).
 * @param {boolean} [input.withHall]
 * @returns {Promise<import('./game-archive.js').GameArchive>}
 */
export async function collectArchive(adapter, { gameId, withImages = false, withHall = false }) {
    const chats = await adapter.listChats();
    const metas = await worldMetas(adapter, chats);
    const members = gameMembers({ gameId, worlds: metas, chats });
    if (members.worlds.length === 0) throw new Error(`No se encuentra la partida «${gameId}».`);

    const worlds = [];
    for (const name of members.worlds) {
        const data = await adapter.readWorld(name);
        if (data) worlds.push({ name, data });
    }
    const lines = [];
    for (const chat of members.chats) {
        const read = await adapter.readChat(chat.avatar, chat.file).catch(() => []);
        if (chatHeader(read)) lines.push({ ...chat, lines: read });
    }

    // Dónde se quedó: el chat abierto, si es de la partida; si no, el último que se tocó.
    const open = adapter.openChat();
    const openHere = open && lines.some(c => c.avatar === open.avatar && c.file === text(open.file).replace(/\.jsonl$/i, ''));
    const last = lines[0];
    const where = openHere && open
        ? { world: lines.find(c => c.avatar === open.avatar && c.file === text(open.file).replace(/\.jsonl$/i, ''))?.world ?? '', avatar: open.avatar, file: text(open.file).replace(/\.jsonl$/i, '') }
        : { world: last?.world ?? gameId, avatar: last?.avatar ?? '', file: last?.file ?? '' };

    const narrators = [];
    for (const avatar of [...new Set(lines.map(c => c.avatar))]) {
        const narrator = await adapter.readNarrator(avatar, withImages).catch(() => null);
        if (narrator) narrators.push(narrator);
    }

    // Lo tuyo que nombra: el mundo de cada punto de retorno y los paquetes de tus campañas.
    const files = [];
    for (const url of pointFilesOf(lines)) {
        const content = await adapter.readText(url).catch(() => null);
        if (content !== null) files.push({ name: fileNameOf(url), kind: /** @type {const} */ ('punto'), text: content });
    }
    const ids = importedIdsOf(worlds, gameId);
    const rows = ids.length > 0 ? (await adapter.readImported().catch(() => [])).filter(r => ids.includes(text(r?.id))) : [];
    for (const row of rows) {
        const url = text(row?.pack);
        const content = url ? await adapter.readText(url).catch(() => null) : null;
        if (content !== null) files.push({ name: fileNameOf(url), kind: /** @type {const} */ ('campana'), text: content });
    }
    const hall = withHall ? (adapter.readHall() ?? []).filter(e => members.worlds.includes(text(e?.world))) : [];

    const home = worlds.find(w => w.name === gameId);
    return buildArchive({
        game: {
            id: gameId,
            title: text(home?.data?.metadata?.displayName) || gameId,
            kind: isHubWorld(home?.data?.metadata) ? 'gremio' : 'campaña',
        },
        where,
        worlds,
        chats: lines,
        narrators,
        files,
        imported: rows,
        hall,
        now: () => new Date(adapter.now?.() ?? Date.now()).toISOString(),
    });
}

/**
 * La ranura, con la tarjeta del chat donde se quedó la partida.
 *
 * @param {import('./game-archive.js').GameArchive} archive
 * @param {string} slotId
 * @param {string} file
 * @param {number} bytes
 * @returns {import('./save-slots.js').SlotEntry}
 */
function entryFor(archive, slotId, file, bytes) {
    const chat = archive.chats.find(c => c.avatar === archive.where.avatar && c.file === archive.where.file) ?? archive.chats[0];
    const world = archive.worlds.find(w => w.name === chat?.world);
    const where = world && world.name !== archive.game.id ? campaignTitle(text(world.data?.metadata?.displayName) || world.name) : '';
    return slotEntry({ id: slotId, file, meta: chatHeader(chat?.lines)?.chat_metadata ?? {}, where, bytes, savedAt: archive.savedAt });
}

/**
 * Guarda la partida abierta en una ranura.
 *
 * @param {GameSavesAdapter} adapter
 * @param {Object} input
 * @param {string} input.slotId
 * @param {string} [input.gameId] Por defecto, la del chat abierto.
 * @returns {Promise<{ok: true, entry: import('./save-slots.js').SlotEntry, notice: {title: string, line: string}}|{ok: false, reason: string}>}
 */
export async function saveToSlot(adapter, { slotId, gameId = '' }) {
    if (!isSlotId(slotId)) return { ok: false, reason: `No hay una ranura «${slotId}».` };
    await adapter.flush();
    const id = text(gameId) || await openGameId(adapter);
    if (!id) return { ok: false, reason: 'No hay ninguna partida abierta que guardar.' };
    try {
        const archive = await collectArchive(adapter, { gameId: id });
        const content = JSON.stringify(archive);
        const url = await adapter.writeText(slotFileName(id, slotId), content);
        if (!text(url)) return { ok: false, reason: 'El servidor no ha guardado el archivo de la partida.' };
        const entry = entryFor(archive, slotId, url, content.length);
        adapter.setSlots(id, withSlot(adapter.getSlots(id), entry));
        return { ok: true, entry, notice: savedNotice(entry) };
    } catch (error) {
        return { ok: false, reason: `No se ha podido guardar: ${String(/** @type {any} */ (error)?.message ?? error)}` };
    }
}

/**
 * J3.3: dormir en el gremio guarda. Fuera del gremio no hace nada: dormir en la posada de una
 * campaña no es dormir en casa.
 *
 * @param {GameSavesAdapter} adapter
 * @returns {Promise<{ok: true, entry: import('./save-slots.js').SlotEntry, notice: {title: string, line: string}}|{ok: false, reason: string}|null>}
 *   null si no estáis en el gremio.
 */
export async function saveOnSleep(adapter) {
    const world = text(adapter.openWorld());
    if (!world) return null;
    const data = await adapter.readWorld(world).catch(() => null);
    if (!isHubWorld(data?.metadata)) return null;
    return saveToSlot(adapter, { slotId: SLOT_SLEEP, gameId: world });
}

/**
 * J15.2: el guardado automático al cambiar de día. No se repite si ya está el de hoy, ni justo
 * después de dormir en el gremio (esa ranura ya lo tiene).
 *
 * @param {GameSavesAdapter} adapter
 * @param {{day: number}} input El día que empieza.
 * @returns {Promise<{ok: true, entry: import('./save-slots.js').SlotEntry, notice: {title: string, line: string}}|{ok: false, reason: string}|null>}
 *   null si no hacía falta.
 */
export async function autosave(adapter, { day }) {
    const id = await openGameId(adapter);
    if (!id) return null;
    if (!autosaveNeeded(adapter.getSlots(id), { day, now: adapter.now?.() ?? Date.now() })) return null;
    return saveToSlot(adapter, { slotId: SLOT_AUTO, gameId: id });
}

/**
 * Lee y comprueba el archivo de una ranura, sin tocar nada.
 *
 * @param {GameSavesAdapter} adapter
 * @param {string} gameId
 * @param {string} slotId
 * @returns {Promise<{archive: import('./game-archive.js').GameArchive|null, problems: string[]}>}
 */
export async function readSlotArchive(adapter, gameId, slotId) {
    const entry = readSlots(adapter.getSlots(gameId))[slotId];
    if (!entry) return { archive: null, problems: ['Esa ranura está vacía.'] };
    const content = await adapter.readText(entry.file).catch(() => null);
    if (content === null) return { archive: null, problems: ['El archivo de esa ranura ya no está. Guarda otra vez en ella.'] };
    const read = readArchive(content);
    if (read.archive && read.archive.game.id !== gameId) {
        return { archive: null, problems: [`Esa ranura guarda otra partida, «${read.archive.game.title}».`] };
    }
    return read;
}

/**
 * Carga una ranura encima de su partida y abre el chat donde se guardó.
 *
 * @param {GameSavesAdapter} adapter
 * @param {Object} input
 * @param {string} input.gameId
 * @param {string} input.slotId
 * @returns {Promise<{ok: true, where: {avatar: string, file: string, world: string}, failed: number}|{ok: false, reason: string}>}
 */
export async function loadSlot(adapter, { gameId, slotId }) {
    const id = text(gameId);
    const read = await readSlotArchive(adapter, id, slotId);
    if (!read.archive) return { ok: false, reason: read.problems.join(' ') };
    const archive = read.archive;

    // Lo que tiene la partida ahora: para quitar lo que se empezó después de guardar.
    await adapter.flush();
    const chats = await adapter.listChats();
    const metas = await worldMetas(adapter, chats);
    const present = gameMembers({ gameId: id, worlds: metas, chats });
    const fileNames = await existingFileNames(adapter, archive.files.map(f => f.name));
    const plan = planRestore(archive, { worlds: present.worlds, chats: present.chats, fileNames });

    // Se cierra antes de escribir: el chat abierto se guardaría encima de lo cargado.
    const open = text(adapter.openWorld());
    if (open && (present.worlds.includes(open) || plan.worlds.some(w => w.name === open))) {
        if (!(await adapter.closeChat())) return { ok: false, reason: 'No se puede cerrar la partida ahora (¿está escribiendo el narrador?). Prueba en un momento.' };
    }

    let failed = 0;
    const existing = new Set((await adapter.listWorlds()).map(text));
    for (const world of plan.worlds) {
        try {
            await adapter.writeWorld(world.name, world.data, !existing.has(world.name));
        } catch (error) {
            console.error('[guardar] no se pudo escribir el mundo', world.name, error);
            failed++;
        }
    }
    for (const chat of plan.chats) {
        try {
            await adapter.writeChat(chat.avatar, chat.file, chat.lines);
        } catch (error) {
            console.error('[guardar] no se pudo escribir el chat', chat.file, error);
            failed++;
        }
    }
    for (const file of plan.files) {
        await adapter.writeText(file.name, file.text).catch(() => { failed++; });
    }
    for (const chat of plan.dropChats) await adapter.deleteChat(chat.avatar, chat.file).catch(() => false);
    for (const name of plan.dropWorlds) await adapter.deleteWorld(name).catch(() => false);

    const first = plan.chats[0];
    const where = plan.where.file ? plan.where : { world: first?.world ?? '', avatar: first?.avatar ?? '', file: first?.file ?? '' };
    const opened = where.avatar && where.file ? await adapter.openChatFile({ avatar: where.avatar, file: where.file }) : false;
    if (!opened) return { ok: false, reason: 'La partida se ha cargado, pero su chat no se ha podido abrir. Búscala en «Cargar partida».' };
    return { ok: true, where: { avatar: where.avatar, file: where.file, world: where.world }, failed };
}

/**
 * Cuáles de estos archivos tuyos existen.
 *
 * @param {GameSavesAdapter} adapter
 * @param {string[]} names
 * @returns {Promise<string[]>}
 */
async function existingFileNames(adapter, names) {
    if (names.length === 0) return [];
    const urls = names.map(name => adapter.fileUrl(name));
    const exist = await adapter.filesExist(urls).catch(() => ({}));
    return names.filter((_name, i) => exist[urls[i]]);
}

/**
 * La partida en un archivo para llevársela (J15.6).
 *
 * @param {GameSavesAdapter} adapter
 * @param {string} [gameId] Por defecto, la abierta.
 * @returns {Promise<{ok: true, name: string, content: string, summary: ReturnType<typeof archiveSummary>}|{ok: false, reason: string}>}
 */
export async function exportGame(adapter, gameId = '') {
    await adapter.flush();
    const id = text(gameId) || await openGameId(adapter);
    if (!id) return { ok: false, reason: 'No hay ninguna partida abierta que exportar.' };
    try {
        const archive = await collectArchive(adapter, { gameId: id, withImages: true, withHall: true });
        return {
            ok: true,
            name: archiveFileName(archive.game.title, new Date(adapter.now?.() ?? Date.now())),
            content: JSON.stringify(archive),
            summary: archiveSummary(archive),
        };
    } catch (error) {
        return { ok: false, reason: `No se ha podido exportar: ${String(/** @type {any} */ (error)?.message ?? error)}` };
    }
}

/**
 * Mete una partida exportada como partida nueva (J15.6).
 *
 * @param {GameSavesAdapter} adapter
 * @param {string} content El texto del archivo.
 * @returns {Promise<{ok: true, gameId: string, title: string, lines: string[], where: {avatar: string, file: string, world: string}}|{ok: false, problems: string[]}>}
 */
export async function importGame(adapter, content) {
    const read = readArchive(content);
    if (!read.archive) return { ok: false, problems: read.problems };
    const archive = read.archive;

    const chats = await adapter.listChats();
    /** @type {Record<string, string[]>} */
    const chatFiles = {};
    for (const chat of chats) {
        const avatar = text(chat?.avatar);
        (chatFiles[avatar] = chatFiles[avatar] ?? []).push(text(chat?.file_name).replace(/\.jsonl$/i, ''));
    }
    const plan = planImport(archive, {
        worldNames: await adapter.listWorlds(),
        chatFiles,
        avatars: await adapter.avatars(),
        fileNames: await existingFileNames(adapter, archive.files.map(f => f.name)),
    });

    // Los narradores que faltan, primero: sin su ficha, un chat no se abre.
    /** @type {Record<string, string>} */
    const avatars = {};
    for (const narrator of plan.narrators.filter(n => n.create)) {
        const made = text(await adapter.createNarrator(narrator).catch(() => ''));
        if (!made) return { ok: false, problems: [`No se ha podido crear a ${narrator.name || 'su narrador'}, que cuenta la partida.`] };
        avatars[narrator.avatar] = made;
    }
    // Un chat sin la ficha de su narrador (no venía en el archivo) no se puede abrir.
    const have = new Set([...(await adapter.avatars()).map(text), ...Object.values(avatars)]);
    const missing = [...new Set(plan.chats.map(c => avatars[c.avatar] ?? c.avatar))].filter(a => !have.has(a));
    if (missing.length > 0) return { ok: false, problems: [`Falta quien narra: ${missing.join(', ')}. El archivo no trae su ficha.`] };
    withAvatars(plan, avatars);

    let failed = 0;
    for (const world of plan.worlds) {
        try {
            await adapter.writeWorld(world.name, world.data, true);
        } catch (error) {
            console.error('[importar] no se pudo escribir el mundo', world.name, error);
            failed++;
        }
    }
    for (const chat of plan.chats) {
        try {
            await adapter.writeChat(chat.avatar, chat.file, chat.lines);
        } catch (error) {
            console.error('[importar] no se pudo escribir el chat', chat.file, error);
            failed++;
        }
    }
    for (const file of plan.files) await adapter.writeText(file.name, file.text).catch(() => { failed++; });
    if (plan.imported.length > 0) {
        const rows = await adapter.readImported().catch(() => []);
        const known = new Set(rows.map(r => text(r?.id)));
        const added = plan.imported.filter(r => !known.has(text(r?.id)));
        if (added.length > 0) await adapter.writeImported([...rows, ...added]).catch(() => { failed++; });
    }
    if (plan.hall.length > 0) {
        const hall = adapter.readHall() ?? [];
        const same = (/** @type {any} */ a, /** @type {any} */ b) => text(a?.name) === text(b?.name) && text(a?.world) === text(b?.world)
            && text(a?.ending) === text(b?.ending) && Number(a?.day) === Number(b?.day);
        adapter.writeHall([...plan.hall.filter(e => !hall.some((/** @type {any} */ h) => same(h, e))), ...hall]);
    }
    return { ok: true, gameId: plan.gameId, title: plan.title, lines: describeImport(plan, { failed }), where: plan.where };
}

/**
 * Borra las ranuras de una partida, con sus archivos: al borrar la partida (D-J23), o una
 * ranura sola.
 *
 * @param {GameSavesAdapter} adapter
 * @param {string} gameId
 * @param {string} [slotId] Sin ella, todas.
 * @returns {Promise<number>} Cuántas.
 */
export async function forgetSlots(adapter, gameId, slotId = '') {
    const slots = adapter.getSlots(gameId);
    const read = readSlots(slots);
    const gone = slotId ? (read[slotId] ? [read[slotId]] : []) : Object.values(read);
    for (const entry of gone) {
        // Un archivo que otra ranura sigue usando no se borra.
        const others = slotFiles(slotId ? withoutSlot(slots, slotId) : {});
        if (!others.includes(entry.file)) await adapter.deleteFile(entry.file).catch(() => {});
    }
    adapter.setSlots(gameId, slotId ? withoutSlot(slots, slotId) : {});
    return gone.length;
}
