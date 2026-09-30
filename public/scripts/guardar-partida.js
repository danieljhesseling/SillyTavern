/**
 * Guardar como un juego, enchufado a SillyTavern (J15.2, J3.3 y J15.6 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor (`game-engine/campaign/game-saves.js`) sabe guardar, cargar, exportar e importar
 * una partida entera, pero no toca SillyTavern: pide cada cosa a un adaptador. Aquí está el
 * de verdad —los mundos por `world-info.js`, los chats por `/api/chats`, tus archivos por
 * `/api/files`, las ranuras en `extension_settings`— y las puertas que el juego abre:
 *
 * - `openSaveGame()`: la pantalla de guardar y cargar, con la partida abierta (el menú de pausa).
 * - `openGameSlots(id)`: las ranuras de una partida desde «Cargar partida», sin abrirla.
 * - `onGuildSleep()`: J3.3, dormir en el gremio guarda.
 * - `onDayTurned(calendar)`: J15.2, el guardado automático al cambiar de día.
 * - `exportGameFile(id)` e `importGameFile()`: J15.6, la partida entera en un archivo.
 * - `forgetGameSlots(id)`: al borrar una partida, sus ranuras con ella.
 *
 * Lo que va en `party/` (quién llama a estas puertas y cuándo) está en el archivo de
 * enganches: este módulo no lo toca.
 */

import {
    characters, chat_metadata, getRequestHeaders, saveChatConditional, closeCurrentChat, openCharacterChat,
    selectCharacterById, getCharacters, getCurrentChatId, this_chid, saveSettingsDebounced, unshallowCharacter,
} from '../script.js';
import { extension_settings } from './extensions.js';
import {
    world_names, loadWorldInfo, saveWorldInfo, deleteWorldInfo, createNewWorldInfo, METADATA_KEY,
} from './world-info.js';
import { convertTextToBase64, download } from './utils.js';
import { HUB_IMPORTED_DIR, HUB_IMPORTED_LIST, readImportedList, importedListFile, isHubWorld } from './game-engine/campaign/hub.js';
import { readHall } from './game-engine/campaign/legacy.js';
import { canCheckpoint } from './game-engine/rules/mortality.js';
import { getActiveRuleset } from './game-engine/rules/ruleset.js';
import { CHECKPOINT_KEY } from './game-engine/campaign/checkpoint.js';
import { campaignTitle } from './game-engine/campaign/saved-games.js';
import {
    GAME_SLOTS_KEY, slotsOfGame, withGameSlots, slotCards, overwriteQuestion, loadQuestion, todayPoints, earlierPoints,
    readSlots, SLOT_ORDER,
} from './game-engine/campaign/save-slots.js';
import {
    saveToSlot, loadSlot, saveOnSleep, autosave, exportGame, importGame, forgetSlots, openGameId,
} from './game-engine/campaign/game-saves.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Por qué no salió, de un resultado `{ok: false, reason}`.
 *
 * @param {any} result
 * @returns {string}
 */
const whyNot = (result) => text(result?.reason) || 'No se ha podido.';

/** Tus archivos, como los sirve el servidor. */
const FILES_DIR = '/user/files/';

/** Las fichas cuyo directorio de chats ya se sabe que existe. */
const knownChatDirs = new Set();

/**
 * Una cosa detrás de otra: guardar mientras se carga (o dos guardados a la vez) escribiría
 * una partida a medias.
 *
 * @type {Promise<any>}
 */
let queue = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function inTurn(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
}

/**
 * @param {string} url
 * @param {any} body
 * @returns {Promise<Response>}
 */
function post(url, body) {
    return fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body), cache: 'no-cache' });
}

/**
 * Una imagen en base64, sin la cabecera `data:`.
 *
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

/**
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Lo que va por delante en memoria, al disco: el grupo, el chat abierto y lo que el mundo
 * tenga en cola.
 */
async function flush() {
    try {
        const roster = await import('./party/roster.js');
        if (chat_metadata && typeof chat_metadata === 'object' && Object.keys(chat_metadata).length > 0) roster.savePartyState?.();
    } catch (error) {
        console.warn('[guardar] no se pudo poner el grupo al día', error);
    }
    if (this_chid !== undefined && getCurrentChatId()) await saveChatConditional();
    try {
        const growth = await import('./party/world-growth.js');
        await growth.worldWrite?.(async () => {});
    } catch { /* sin cola del mundo no hay nada que esperar */ }
}

/**
 * El adaptador de verdad para `game-saves.js`.
 *
 * @returns {import('./game-engine/campaign/game-saves.js').GameSavesAdapter}
 */
export function stAdapter() {
    return {
        openWorld: () => text(chat_metadata?.[METADATA_KEY]),
        openChat: () => {
            const avatar = text(characters[Number(this_chid)]?.avatar);
            const file = text(getCurrentChatId());
            return this_chid !== undefined && avatar && file ? { avatar, file } : null;
        },
        flush,
        listChats: async () => {
            const response = await post('/api/chats/recent', { metadata: true });
            if (!response.ok) throw new Error(`el servidor no da la lista de chats (${response.status})`);
            const list = await response.json();
            return (Array.isArray(list) ? list : []).filter(c => text(c?.avatar) && text(c?.file_name))
                .map(c => ({ avatar: text(c.avatar), file_name: text(c.file_name), chat_metadata: c.chat_metadata ?? {} }));
        },
        listWorlds: () => (Array.isArray(world_names) ? [...world_names] : []),
        readWorld: async (name) => {
            // Uno que no está en la lista no existe: el servidor daría uno vacío de mentira.
            if (!Array.isArray(world_names) || !world_names.includes(name)) return null;
            return (await loadWorldInfo(name)) ?? null;
        },
        writeWorld: async (name, data, isNew) => {
            if (isNew && !(await createNewWorldInfo(name, { interactive: false }))) throw new Error(`no se pudo crear el mundo «${name}»`);
            await saveWorldInfo(name, structuredClone(data), true);
        },
        deleteWorld: async (name) => Boolean(await deleteWorldInfo(name)),
        readChat: async (avatar, file) => {
            const response = await post('/api/chats/get', { avatar_url: avatar, file_name: file });
            if (!response.ok) return [];
            const lines = await response.json();
            return Array.isArray(lines) ? lines : [];
        },
        writeChat: async (avatar, file, lines) => {
            // La carpeta de chats de la ficha: `get` la crea si no está.
            if (!knownChatDirs.has(avatar)) {
                await post('/api/chats/get', { avatar_url: avatar, file_name: '' }).catch(() => null);
                knownChatDirs.add(avatar);
            }
            const response = await post('/api/chats/save', { avatar_url: avatar, file_name: file, chat: lines, force: true });
            if (!response.ok) throw new Error(`el servidor no ha guardado el chat «${file}» (${response.status})`);
        },
        deleteChat: async (avatar, file) => {
            const response = await post('/api/chats/delete', { avatar_url: avatar, chatfile: `${file}.jsonl` });
            return response.ok;
        },
        avatars: () => characters.map((/** @type {any} */ c) => text(c?.avatar)).filter(Boolean),
        readNarrator: async (avatar, withImage) => {
            const index = characters.findIndex((/** @type {any} */ c) => c?.avatar === avatar);
            if (index < 0) return null;
            await unshallowCharacter(String(index));
            const c = /** @type {any} */ (characters[index]);
            const card = {
                ch_name: text(c.name),
                description: String(c.description ?? c.data?.description ?? ''),
                personality: String(c.personality ?? c.data?.personality ?? ''),
                scenario: String(c.scenario ?? c.data?.scenario ?? ''),
                first_mes: String(c.first_mes ?? c.data?.first_mes ?? ''),
                mes_example: String(c.mes_example ?? c.data?.mes_example ?? ''),
                creator_notes: String(c.data?.creator_notes ?? c.creatorcomment ?? ''),
                system_prompt: String(c.data?.system_prompt ?? ''),
                post_history_instructions: String(c.data?.post_history_instructions ?? ''),
                tags: (Array.isArray(c.tags) ? c.tags : []).join(','),
                talkativeness: String(c.talkativeness ?? c.data?.extensions?.talkativeness ?? '0.5'),
            };
            let image = '';
            if (withImage) {
                try {
                    const response = await fetch(`/characters/${encodeURIComponent(avatar)}`, { cache: 'no-cache' });
                    if (response.ok) image = await blobToBase64(await response.blob());
                } catch (error) {
                    console.warn('[guardar] sin la cara del narrador', avatar, error);
                }
            }
            return { avatar, name: text(c.name), card, ...(image ? { image } : {}) };
        },
        createNarrator: async (narrator) => {
            const form = new FormData();
            for (const [field, value] of Object.entries(narrator.card ?? {})) form.append(field, String(value ?? ''));
            if (!form.has('ch_name')) form.append('ch_name', narrator.name || narrator.avatar.replace(/\.png$/i, ''));
            // El mismo nombre de ficha que tenía: así los chats la encuentran sin renombrar nada.
            form.append('file_name', narrator.avatar.replace(/\.png$/i, ''));
            if (narrator.image) {
                const bytes = /** @type {BlobPart} */ (/** @type {unknown} */ (base64ToBytes(narrator.image)));
                form.append('avatar', new File([bytes], narrator.avatar, { type: 'image/png' }), narrator.avatar);
            }
            const response = await fetch('/api/characters/create', {
                method: 'POST', headers: getRequestHeaders({ omitContentType: true }), body: form, cache: 'no-cache',
            });
            if (!response.ok) throw new Error(`el servidor no ha creado a ${narrator.name} (${response.status})`);
            const avatar = text(await response.text());
            await getCharacters();
            knownChatDirs.add(avatar);
            return avatar;
        },
        readText: async (url) => {
            const response = await fetch(url.startsWith('/') ? url : `/${url}`, { cache: 'no-store' });
            return response.ok ? await response.text() : null;
        },
        writeText: async (name, content) => {
            const response = await post('/api/files/upload', { name, data: convertTextToBase64(content) });
            if (!response.ok) throw new Error(`el servidor no ha guardado «${name}» (${response.status}: ${await response.text()})`);
            const said = await response.json();
            return text(said?.path);
        },
        deleteFile: async (url) => {
            await post('/api/files/delete', { path: url });
        },
        fileUrl: (name) => `${FILES_DIR}${name}`,
        filesExist: async (urls) => {
            const response = await post('/api/files/verify', { urls });
            return response.ok ? await response.json() : {};
        },
        readImported: async () => {
            const response = await fetch(`${HUB_IMPORTED_DIR}${HUB_IMPORTED_LIST}`, { cache: 'no-cache' });
            if (response.status === 404) return [];
            if (!response.ok) throw new Error(`no se lee tu lista de campañas (${response.status})`);
            return readImportedList(await response.json());
        },
        writeImported: async (rows) => {
            const response = await post('/api/files/upload', {
                name: HUB_IMPORTED_LIST, data: convertTextToBase64(JSON.stringify(importedListFile(rows), null, 1)),
            });
            if (!response.ok) throw new Error(`no se guarda tu lista de campañas (${response.status})`);
        },
        readHall: () => readHall(/** @type {any} */ (extension_settings).partyHall),
        writeHall: (entries) => {
            /** @type {any} */ (extension_settings).partyHall = readHall(entries);
            saveSettingsDebounced();
        },
        getSlots: (gameId) => slotsOfGame(/** @type {any} */ (extension_settings)[GAME_SLOTS_KEY], gameId),
        setSlots: (gameId, slots) => {
            const settings = /** @type {any} */ (extension_settings);
            settings[GAME_SLOTS_KEY] = withGameSlots(settings[GAME_SLOTS_KEY], gameId, slots);
            saveSettingsDebounced();
        },
        closeChat: async () => Boolean(await closeCurrentChat()),
        openChatFile: async ({ avatar, file }) => {
            const index = characters.findIndex((/** @type {any} */ c) => c?.avatar === avatar);
            if (index < 0) return false;
            try {
                await selectCharacterById(index);
                await openCharacterChat(file);
            } catch (error) {
                console.error('[guardar] no se pudo abrir el chat', avatar, file, error);
                return false;
            }
            return text(getCurrentChatId()) === text(file);
        },
        now: () => Date.now(),
    };
}

/**
 * Si ahora se puede guardar a mano: en mitad de un combate no, y en una campaña que solo
 * guarda en el refugio, solo allí (lo mismo que los puntos de retorno).
 *
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
async function savingNow() {
    try {
        const state = await import('./party/state.js');
        return canCheckpoint(
            { inShelter: !state.currentBoardName, inCombat: Boolean(state.combatEncounter?.active) },
            getActiveRuleset()?.survival ?? null,
        );
    } catch {
        return { allowed: true, reason: '' };
    }
}

/**
 * El título de una partida, como en «Cargar partida».
 *
 * @param {string} gameId
 * @returns {Promise<string>}
 */
async function gameTitle(gameId) {
    const data = world_names?.includes(gameId) ? await loadWorldInfo(gameId).catch(() => null) : null;
    return text(data?.metadata?.displayName) || gameId;
}

/**
 * Las ranuras de una partida en pantalla, con lo que se pregunta antes de cada cosa.
 *
 * @param {string} gameId
 * @param {boolean} inGame
 * @returns {Promise<import('./game-engine/ui/save-screen.js').SaveScreenView>}
 */
async function screenView(gameId, inGame) {
    const adapter = stAdapter();
    const slots = adapter.getSlots(gameId);
    const read = readSlots(slots);
    const saving = inGame ? await savingNow() : { allowed: false, reason: '' };
    const cards = slotCards(slots, { inGame, saving }).map(card => ({
        ...card,
        saveAsk: overwriteQuestion(read[card.id]),
        loadAsk: read[card.id] ? loadQuestion(read[card.id], { inGame }) : '',
    }));
    const title = await gameTitle(gameId);
    if (!inGame) return { title: `Las ranuras de «${title}»`, subtitle: 'Elige una para seguir desde allí.', inGame, cards, canExport: true };

    const day = Math.max(1, Math.floor(Number(chat_metadata?.calendar?.day) || 1));
    const world = text(chat_metadata?.[METADATA_KEY]);
    const place = text(chat_metadata?.currentLocation);
    const where = world && world !== gameId ? campaignTitle(await gameTitle(world)) : '';
    return {
        title: 'Guardar y cargar',
        subtitle: [title, where ? `en ${where}` : '', `Día ${day}`, place].filter(Boolean).join(' · '),
        inGame,
        cards,
        points: todayPoints(chat_metadata?.[CHECKPOINT_KEY], day),
        earlier: earlierPoints(chat_metadata?.[CHECKPOINT_KEY], day),
        canPoint: saving.allowed,
        pointWhy: saving.reason,
        canExport: true,
    };
}

/**
 * Tras importar o cargar, la lista de partidas del título se vuelve a leer.
 */
async function refreshGameList() {
    try {
        const { renderCampaignCards } = await import('./campaigns.js');
        const grid = document.querySelector('#welcomeCampaignsGrid');
        await renderCampaignCards(grid instanceof HTMLElement ? grid : document.createElement('div'));
    } catch (error) {
        console.warn('[guardar] no se pudo volver a leer la lista de partidas', error);
    }
}

/**
 * Las acciones de la pantalla, las mismas con la partida abierta y desde el título.
 *
 * @param {string} gameId
 * @param {boolean} inGame
 */
function screenActions(gameId, inGame) {
    const adapter = stAdapter();
    return {
        onSave: inGame ? async (/** @type {string} */ slotId) => inTurn(async () => {
            const saving = await savingNow();
            if (!saving.allowed) return { ok: false, message: saving.reason };
            const done = await saveToSlot(adapter, { slotId, gameId });
            return done.ok ? { ok: true, message: `${done.notice.title}: ${done.notice.line}.` } : { ok: false, message: whyNot(done) };
        }) : undefined,
        onLoad: async (/** @type {string} */ slotId) => inTurn(async () => {
            const done = await loadSlot(adapter, { gameId, slotId });
            if (!done.ok) return { ok: false, message: whyNot(done) };
            toastr.success('La partida está como la guardaste.', 'Partida cargada');
            void refreshGameList();
            return { ok: true, close: true };
        }),
        onPoint: inGame ? async (/** @type {string} */ id) => {
            const { restoreCheckpoint } = await import('./party/checkpoints.js');
            return (await restoreCheckpoint(id))
                ? { ok: true, message: 'Vuelta al punto: el grupo y el mundo, como estaban.' }
                : { ok: false, message: 'Ese punto ya no está.' };
        } : undefined,
        onNewPoint: inGame ? async () => {
            const { saveCheckpoint } = await import('./party/checkpoints.js');
            const place = text(chat_metadata?.currentLocation);
            const id = saveCheckpoint(place ? `A mano, en ${place}` : 'A mano');
            return id ? { ok: true, message: 'Punto de retorno dejado.' } : { ok: false, message: (await savingNow()).reason || 'Aquí no se puede dejar un punto.' };
        } : undefined,
        onExport: async () => inTurn(async () => {
            const done = await exportGame(adapter, gameId);
            if (!done.ok) return { ok: false, message: whyNot(done) };
            download(done.content, done.name, 'application/json');
            return {
                ok: true,
                message: `Exportada: ${done.name}.`,
                lines: ['Guárdalo donde quieras. En otro ordenador, abre «Guardar y cargar» o «Cargar partida» y pulsa «Importar una partida».'],
            };
        }),
        onImport: async (/** @type {string} */ content) => inTurn(async () => {
            const done = await importGame(adapter, content);
            if (!done.ok) return { ok: false, message: 'Esa partida no se puede importar.', lines: /** @type {any} */ (done).problems ?? [] };
            void refreshGameList();
            return {
                ok: true,
                message: `Partida importada: «${done.title}».`,
                lines: done.lines,
                play: {
                    label: 'Jugarla ahora',
                    run: async () => {
                        await flush();
                        if (!(await adapter.openChatFile(done.where))) toastr.warning('Búscala en «Cargar partida».', 'No se ha podido abrir');
                    },
                },
            };
        }),
    };
}

/**
 * J15.2: la pantalla de guardar y cargar, con la partida abierta.
 *
 * @returns {Promise<void>}
 */
export async function openSaveGame() {
    const gameId = await openGameId(stAdapter());
    if (!gameId) {
        toastr.info('Abre una partida para guardarla. Desde el título, «Cargar partida» tiene las ranuras de cada una.');
        return;
    }
    const { openSaveScreen } = await import('./game-engine/ui/save-screen.js');
    await openSaveScreen({ getView: () => screenView(gameId, true), ...screenActions(gameId, true) });
}

/**
 * J15.2: las ranuras de una partida desde «Cargar partida», sin abrirla.
 *
 * @param {string} gameId
 * @returns {Promise<void>}
 */
export async function openGameSlots(gameId) {
    const { openSaveScreen } = await import('./game-engine/ui/save-screen.js');
    await openSaveScreen({ getView: () => screenView(gameId, false), ...screenActions(gameId, false) });
}

/**
 * J15.6: meter una partida exportada desde el título, sin ninguna abierta.
 *
 * @returns {Promise<void>}
 */
export async function importGameFile() {
    const { openSaveScreen } = await import('./game-engine/ui/save-screen.js');
    const actions = screenActions('', false);
    await openSaveScreen({
        getView: () => ({ title: 'Importar una partida', subtitle: 'Un archivo «.partida.json» exportado desde este juego.', inGame: false, cards: [], canExport: false }),
        onImport: actions.onImport,
    });
}

/**
 * J15.6: la partida entera en un archivo, sin abrir la pantalla.
 *
 * @param {string} [gameId] Por defecto, la abierta.
 * @returns {Promise<boolean>}
 */
export async function exportGameFile(gameId = '') {
    const done = await inTurn(() => exportGame(stAdapter(), gameId));
    if (!done.ok) {
        toastr.warning(whyNot(done), 'No se ha exportado');
        return false;
    }
    download(done.content, done.name, 'application/json');
    toastr.success(done.name, 'Partida exportada');
    return true;
}

/** @type {ReturnType<typeof setTimeout>|null} */
let autosaveTimer = null;

/** Lo que espera el automático, por si detrás viene «dormir» (que ya guarda). */
export const AUTOSAVE_DELAY_MS = 1500;

/**
 * J3.3: dormir en el gremio guarda (en la ranura «Al dormir»). Fuera del gremio no hace nada.
 *
 * @returns {Promise<boolean>} Si guardó.
 */
export async function onGuildSleep() {
    // El automático de esta misma noche sobra: esta ranura ya lo tiene.
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = null;
    const done = await inTurn(() => saveOnSleep(stAdapter()));
    if (!done) return false;
    if (!done.ok) {
        toastr.warning(whyNot(done), 'No se ha guardado al dormir');
        return false;
    }
    toastr.success(done.notice.line, done.notice.title, { timeOut: 4000 });
    return true;
}

/**
 * J15.2: el guardado automático al cambiar de día. Se llama con el calendario nuevo cada vez
 * que pasa el día; espera un momento por si es una noche en el gremio (que guarda en su
 * ranura) y guarda en «Al empezar el día».
 *
 * @param {any} calendar El calendario de después.
 */
export function onDayTurned(calendar) {
    const day = Math.floor(Number(calendar?.day) || 0);
    if (day <= 0) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        void inTurn(async () => {
            // En una campaña que solo guarda en el refugio, el automático tampoco guarda fuera.
            if (!(await savingNow()).allowed) return null;
            return autosave(stAdapter(), { day });
        }).then(done => {
            if (done?.ok) toastr.info(done.notice.line, done.notice.title, { timeOut: 3000 });
            else if (done && !done.ok) console.warn('[guardar] el automático no ha guardado', whyNot(done));
        }).catch(error => console.error('[guardar] el automático ha fallado', error));
    }, AUTOSAVE_DELAY_MS);
}

/**
 * D-J23: al borrar una partida, sus ranuras se van con ella.
 *
 * @param {string} gameId
 * @returns {Promise<number>}
 */
export async function forgetGameSlots(gameId) {
    return inTurn(() => forgetSlots(stAdapter(), gameId));
}

/**
 * Para la tarjeta de «Cargar partida»: cuántas ranuras tiene guardadas.
 *
 * @param {string} gameId
 * @returns {string} «3 ranuras guardadas», o nada.
 */
export function gameSlotsLine(gameId) {
    const slots = slotsOfGame(/** @type {any} */ (extension_settings)[GAME_SLOTS_KEY], gameId);
    const count = SLOT_ORDER.filter(id => slots[id]).length;
    if (count === 0) return '';
    return count === 1 ? '1 ranura guardada' : `${count} ranuras guardadas`;
}

/**
 * Si el chat abierto es de un gremio (para quien decide si dormir guarda).
 *
 * @returns {Promise<boolean>}
 */
export async function inGuild() {
    const world = text(chat_metadata?.[METADATA_KEY]);
    if (!world || !world_names?.includes(world)) return false;
    const data = await loadWorldInfo(world).catch(() => null);
    return isHubWorld(data?.metadata);
}
