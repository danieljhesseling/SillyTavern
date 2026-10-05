/**
 * Disco de mentira para Dnd Master sin servidor (A2 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * En Android y en el navegador sin server.js, guarda chats, mundos, fichas,
 * ajustes y archivos de usuario en IndexedDB (base 'dndcoin').
 * Si indexedDB no existe (por ejemplo en tests de Node), usa un almacén en memoria.
 */

const DB_NAME = 'dndcoin';
const DB_VERSION = 1;

/** @type {IDBDatabase|null} */
let dbInstance = null;

/** Almacén en memoria por si no hay IndexedDB (Node unit tests). */
const memoria = {
    chats: new Map(),
    mundos: new Map(),
    personajes: new Map(),
    archivos: new Map(),
    imagenes: new Map(),
    ajustes: new Map(),
};

/**
 * Abre la base de datos IndexedDB o usa el almacén de memoria.
 *
 * @returns {Promise<IDBDatabase|null>}
 */
export async function abrirBD() {
    if (typeof indexedDB === 'undefined') {
        return null;
    }
    if (dbInstance) {
        return dbInstance;
    }

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = /** @type {IDBOpenDBRequest} */ (e.target).result;

            if (!db.objectStoreNames.contains('chats')) {
                const store = db.createObjectStore('chats', { keyPath: 'clave' });
                store.createIndex('avatar', 'avatar', { unique: false });
                store.createIndex('mtime', 'mtime', { unique: false });
            }
            if (!db.objectStoreNames.contains('mundos')) {
                const store = db.createObjectStore('mundos', { keyPath: 'nombre' });
                store.createIndex('mtime', 'mtime', { unique: false });
            }
            if (!db.objectStoreNames.contains('personajes')) {
                const store = db.createObjectStore('personajes', { keyPath: 'avatar' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('mtime', 'mtime', { unique: false });
            }
            if (!db.objectStoreNames.contains('archivos')) {
                const store = db.createObjectStore('archivos', { keyPath: 'ruta' });
                store.createIndex('mtime', 'mtime', { unique: false });
            }
            if (!db.objectStoreNames.contains('imagenes')) {
                const store = db.createObjectStore('imagenes', { keyPath: 'ruta' });
                store.createIndex('mtime', 'mtime', { unique: false });
            }
            if (!db.objectStoreNames.contains('ajustes')) {
                db.createObjectStore('ajustes', { keyPath: 'clave' });
            }
        };

        req.onsuccess = (e) => {
            dbInstance = /** @type {IDBOpenDBRequest} */ (e.target).result;
            resolve(dbInstance);
        };

        req.onerror = () => {
            reject(req.error);
        };
    });
}

/**
 * Operación genérica sobre un almacén.
 *
 * @template T
 * @param {string} storeName
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest} fn
 * @returns {Promise<T>}
 */
async function transaccion(storeName, mode, fn) {
    const db = await abrirBD();
    if (!db) {
        throw new Error('Sin IndexedDB');
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ---------------------------------------------------- CHATS

/**
 * Guarda un chat.
 *
 * @param {string} avatar
 * @param {string} fileName Sin .jsonl
 * @param {any[]} chat
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarChat(avatar, fileName, chat) {
    const cleanAvatar = String(avatar || '').replace(/\.png$/i, '');
    const cleanFile = String(fileName || '').replace(/\.jsonl$/i, '');
    const clave = `${cleanAvatar}/${cleanFile}`;
    const mtime = Date.now();
    const item = { clave, avatar: cleanAvatar, file_name: cleanFile, chat, mtime };

    const db = await abrirBD();
    if (!db) {
        memoria.chats.set(clave, item);
        return { ok: true };
    }
    await transaccion('chats', 'readwrite', (s) => s.put(item));
    return { ok: true };
}

/**
 * Lee un chat completo.
 *
 * @param {string} avatar
 * @param {string} fileName Sin .jsonl
 * @returns {Promise<any[]>} Array de mensajes (o líneas). Vacío si no existe.
 */
export async function leerChat(avatar, fileName) {
    const cleanAvatar = String(avatar || '').replace(/\.png$/i, '');
    const cleanFile = String(fileName || '').replace(/\.jsonl$/i, '');
    const clave = `${cleanAvatar}/${cleanFile}`;

    const db = await abrirBD();
    if (!db) {
        return memoria.chats.get(clave)?.chat || [];
    }
    try {
        const res = await transaccion('chats', 'readonly', (s) => s.get(clave));
        return res?.chat || [];
    } catch {
        return [];
    }
}

/**
 * Borra un chat.
 *
 * @param {string} avatar
 * @param {string} fileName
 * @returns {Promise<{ ok: boolean }>}
 */
export async function borrarChat(avatar, fileName) {
    const cleanAvatar = String(avatar || '').replace(/\.png$/i, '');
    const cleanFile = String(fileName || '').replace(/\.jsonl$/i, '');
    const clave = `${cleanAvatar}/${cleanFile}`;

    const db = await abrirBD();
    if (!db) {
        memoria.chats.delete(clave);
        return { ok: true };
    }
    await transaccion('chats', 'readwrite', (s) => s.delete(clave));
    return { ok: true };
}

/**
 * Lista los chats de un personaje.
 *
 * @param {string} avatar
 * @returns {Promise<Array<{ file_name: string }>>}
 */
export async function listarChatsPersonaje(avatar) {
    const cleanAvatar = String(avatar || '').replace(/\.png$/i, '');
    const db = await abrirBD();

    if (!db) {
        const lista = [];
        for (const val of memoria.chats.values()) {
            if (val.avatar === cleanAvatar) {
                lista.push({ file_name: `${val.file_name}.jsonl` });
            }
        }
        return lista;
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction('chats', 'readonly');
        const store = tx.objectStore('chats');
        const idx = store.index('avatar');
        const req = idx.getAll(cleanAvatar);
        req.onsuccess = () => {
            const res = (req.result || []).map((x) => ({ file_name: `${x.file_name}.jsonl` }));
            resolve(res);
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Lista chats recientes para la pantalla de título y «Continuar».
 *
 * @param {number} [max=100]
 * @param {any[]} [pinned=[]]
 * @returns {Promise<any[]>}
 */
export async function listarChatsRecientes(max = 100, pinned = []) {
    const db = await abrirBD();
    /** @type {any[]} */
    let items = [];

    if (!db) {
        items = Array.from(memoria.chats.values());
    } else {
        items = await transaccion('chats', 'readonly', (s) => s.getAll());
    }

    // Ordenar de más reciente a más antiguo
    items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    const resultado = items.slice(0, max).map((item) => {
        const first = Array.isArray(item.chat) ? item.chat[0] : null;
        const last = Array.isArray(item.chat) && item.chat.length > 1 ? item.chat[item.chat.length - 1] : first;
        const metadata = first?.chat_metadata || {};
        return {
            file_name: `${item.file_name}.jsonl`,
            avatar: `${item.avatar}.png`,
            chat_metadata: metadata,
            mes: last?.mes || '',
            send_date: last?.send_date || item.mtime,
            mtime: item.mtime,
        };
    });

    return resultado;
}

// ---------------------------------------------------- MUNDOS (World Info)

/**
 * Lee un mundo.
 *
 * @param {string} nombre
 * @returns {Promise<any>} Objeto del mundo con { entries: { ... } }
 */
export async function leerMundo(nombre) {
    const clean = String(nombre || '').replace(/\.json$/i, '');
    const db = await abrirBD();
    if (!db) {
        return memoria.mundos.get(clean)?.data || { entries: {} };
    }
    try {
        const res = await transaccion('mundos', 'readonly', (s) => s.get(clean));
        return res?.data || { entries: {} };
    } catch {
        return { entries: {} };
    }
}

/**
 * Guarda o actualiza un mundo.
 *
 * @param {string} nombre
 * @param {any} data
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarMundo(nombre, data) {
    const clean = String(nombre || '').replace(/\.json$/i, '');
    const item = { nombre: clean, data, mtime: Date.now() };

    const db = await abrirBD();
    if (!db) {
        memoria.mundos.set(clean, item);
        return { ok: true };
    }
    await transaccion('mundos', 'readwrite', (s) => s.put(item));
    return { ok: true };
}

/**
 * Borra un mundo.
 *
 * @param {string} nombre
 * @returns {Promise<{ ok: boolean }>}
 */
export async function borrarMundo(nombre) {
    const clean = String(nombre || '').replace(/\.json$/i, '');
    const db = await abrirBD();
    if (!db) {
        memoria.mundos.delete(clean);
        return { ok: true };
    }
    await transaccion('mundos', 'readwrite', (s) => s.delete(clean));
    return { ok: true };
}

/**
 * Lista todos los mundos.
 *
 * @returns {Promise<Array<{ file_id: string, name: string, extensions: any }>>}
 */
export async function listarMundos() {
    const db = await abrirBD();
    /** @type {any[]} */
    let items = [];
    if (!db) {
        items = Array.from(memoria.mundos.values());
    } else {
        items = await transaccion('mundos', 'readonly', (s) => s.getAll());
    }
    return items.map((x) => ({
        file_id: x.nombre,
        name: x.data?.name || x.nombre,
        extensions: x.data?.extensions || {},
    }));
}

// ---------------------------------------------------- PERSONAJES (Narradores / Héroes)

/**
 * Lee una ficha de personaje.
 *
 * @param {string} avatar Nombre del avatar (e.g. 'El juglar.png' o 'El juglar')
 * @returns {Promise<any|null>}
 */
export async function leerPersonaje(avatar) {
    const clean = String(avatar || '').replace(/\.png$/i, '');
    const avatarKey = `${clean}.png`;

    const db = await abrirBD();
    if (!db) {
        return memoria.personajes.get(avatarKey)?.data || null;
    }
    try {
        const res = await transaccion('personajes', 'readonly', (s) => s.get(avatarKey));
        return res?.data || null;
    } catch {
        return null;
    }
}

/**
 * Guarda o actualiza una ficha de personaje.
 *
 * @param {string} avatar
 * @param {any} data
 * @param {string} [pngDataUrl]
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarPersonaje(avatar, data, pngDataUrl = '') {
    const clean = String(avatar || '').replace(/\.png$/i, '');
    const avatarKey = `${clean}.png`;
    const item = {
        avatar: avatarKey,
        name: data?.name || clean,
        data,
        pngDataUrl,
        mtime: Date.now(),
    };

    const db = await abrirBD();
    if (!db) {
        memoria.personajes.set(avatarKey, item);
        return { ok: true };
    }
    await transaccion('personajes', 'readwrite', (s) => s.put(item));
    return { ok: true };
}

/**
 * Lista todos los personajes.
 *
 * @returns {Promise<any[]>}
 */
export async function listarPersonajes() {
    const db = await abrirBD();
    /** @type {any[]} */
    let items = [];
    if (!db) {
        items = Array.from(memoria.personajes.values());
    } else {
        items = await transaccion('personajes', 'readonly', (s) => s.getAll());
    }
    return items.map((x) => ({
        avatar: x.avatar,
        name: x.name,
        ...(x.data || {}),
    }));
}

// ---------------------------------------------------- ARCHIVOS (/user/files/)

/**
 * Guarda un archivo de usuario (ranuras, tablon-campanas.json, mundos guardados).
 *
 * @param {string} ruta Nombre o subruta relativa a user/files/
 * @param {string} dataBase64
 * @param {string} [mimeType='application/octet-stream']
 * @returns {Promise<{ path: string }>}
 */
export async function guardarArchivo(ruta, dataBase64, mimeType = 'application/octet-stream') {
    const cleanRuta = String(ruta || '').replace(/^[/\\]*(user[/\\]files[/\\])?/, '');
    const fullPath = `user/files/${cleanRuta}`;
    const item = { ruta: cleanRuta, fullPath, dataBase64, mimeType, mtime: Date.now() };

    const db = await abrirBD();
    if (!db) {
        memoria.archivos.set(cleanRuta, item);
        return { path: fullPath };
    }
    await transaccion('archivos', 'readwrite', (s) => s.put(item));
    return { path: fullPath };
}

/**
 * Lee un archivo de usuario.
 *
 * @param {string} ruta
 * @returns {Promise<{ dataBase64: string, mimeType: string }|null>}
 */
export async function leerArchivo(ruta) {
    const cleanRuta = String(ruta || '').replace(/^[/\\]*(user[/\\]files[/\\])?/, '');
    const db = await abrirBD();
    if (!db) {
        const item = memoria.archivos.get(cleanRuta);
        return item ? { dataBase64: item.dataBase64, mimeType: item.mimeType } : null;
    }
    try {
        const res = await transaccion('archivos', 'readonly', (s) => s.get(cleanRuta));
        return res ? { dataBase64: res.dataBase64, mimeType: res.mimeType } : null;
    } catch {
        return null;
    }
}

/**
 * Borra un archivo de usuario.
 *
 * @param {string} ruta
 * @returns {Promise<{ ok: boolean }>}
 */
export async function borrarArchivo(ruta) {
    const cleanRuta = String(ruta || '').replace(/^[/\\]*(user[/\\]files[/\\])?/, '');
    const db = await abrirBD();
    if (!db) {
        memoria.archivos.delete(cleanRuta);
        return { ok: true };
    }
    await transaccion('archivos', 'readwrite', (s) => s.delete(cleanRuta));
    return { ok: true };
}

/**
 * Verifica existencia de una lista de URLs / rutas.
 *
 * @param {string[]} rutas
 * @returns {Promise<Record<string, boolean>>}
 */
export async function verificarArchivos(rutas) {
    const res = {};
    for (const r of rutas) {
        const existe = await leerArchivo(r);
        res[r] = Boolean(existe);
    }
    return res;
}

// ---------------------------------------------------- AJUSTES (settings.json)

/**
 * Lee los ajustes de SillyTavern / Dnd Master.
 *
 * @returns {Promise<any|null>}
 */
export async function leerAjustes() {
    const db = await abrirBD();
    if (!db) {
        return memoria.ajustes.get('actual')?.data || null;
    }
    try {
        const res = await transaccion('ajustes', 'readonly', (s) => s.get('actual'));
        return res?.data || null;
    } catch {
        return null;
    }
}

/**
 * Guarda los ajustes.
 *
 * @param {any} data
 * @returns {Promise<{ ok: boolean }>}
 */
export async function guardarAjustes(data) {
    const item = { clave: 'actual', data, mtime: Date.now() };
    const db = await abrirBD();
    if (!db) {
        memoria.ajustes.set('actual', item);
        return { ok: true };
    }
    await transaccion('ajustes', 'readwrite', (s) => s.put(item));
    return { ok: true };
}

/**
 * Limpia toda la base de datos (para pruebas y reinicio limpio).
 *
 * @returns {Promise<void>}
 */
export async function limpiarTodo() {
    memoria.chats.clear();
    memoria.mundos.clear();
    memoria.personajes.clear();
    memoria.archivos.clear();
    memoria.imagenes.clear();
    memoria.ajustes.clear();

    const db = await abrirBD();
    if (db) {
        const stores = ['chats', 'mundos', 'personajes', 'archivos', 'imagenes', 'ajustes'];
        for (const st of stores) {
            await transaccion(st, 'readwrite', (s) => s.clear());
        }
    }
}
