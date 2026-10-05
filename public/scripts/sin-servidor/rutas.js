/**
 * Enrutador del servidor de bolsillo (A2 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * Contesta las llamadas que el juego le hace al servidor (tablas 3.1 y 3.2),
 * leyendo y guardando en `disco.js` (IndexedDB / memoria).
 */

import * as disco from './disco.js';

/**
 * Limpia un nombre de archivo quitando caracteres ilegales.
 *
 * @param {string} name
 * @returns {string}
 */
export function limpiarNombreArchivo(name) {
    return String(name || '')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Ajustes de partida iniciales limpios si el disco está vacío.
 */
export const AJUSTES_POR_DEFECTO = Object.freeze({
    firstRun: false,
    username: 'Héroe',
    user_avatar: 'user-default.png',
    amount_gen: 350,
    max_context: 8192,
    main_api: 'openai',
    world_info_settings: {
        world_info: { globalSelect: [] },
        world_info_depth: 2,
        world_info_budget: 25,
        world_info_recursive: true,
    },
    extension_settings: {
        gameSlots: {},
    },
});

/**
 * Responde una petición simulando la respuesta de server.js.
 *
 * @param {string} method GET, POST, etc.
 * @param {string} urlPath Ruta relativa (e.g. '/api/chats/get' o '/csrf-token')
 * @param {any} [body={}] Cuerpo de la petición ya parseado o string
 * @param {Record<string, string>} [headers={}]
 * @returns {Promise<{ status: number, statusText: string, headers: Record<string, string>, data: any }>}
 */
export async function responder(method, urlPath, body = {}, headers = {}) {
    const m = String(method || 'GET').toUpperCase();
    const parsedUrl = new URL(urlPath, 'https://localhost');
    const pathname = parsedUrl.pathname;

    const json = (data, status = 200) => ({
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: { 'content-type': 'application/json', ...headers },
        data,
    });

    const text = (data, status = 200, contentType = 'text/plain') => ({
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: { 'content-type': contentType, ...headers },
        data,
    });

    // ------------------------------------------------ SEGURIDAD Y VERSIÓN
    if (pathname === '/csrf-token') {
        return json({ token: 'dnd-master-offline-token', csrfToken: 'dnd-master-offline-token' });
    }
    if (pathname === '/version') {
        return json({ version: '1.0.0-apk', pkgVersion: '1.0.0-apk', agent: 'Dnd Master', gitBranch: 'apk', gitRevision: 'local' });
    }

    // ------------------------------------------------ AJUSTES
    if (pathname === '/api/settings/get' && m === 'POST') {
        let ajustes = await disco.leerAjustes();
        if (!ajustes) {
            ajustes = { ...AJUSTES_POR_DEFECTO };
            await disco.guardarAjustes(ajustes);
        }
        const mundos = await disco.listarMundos();
        const world_names = mundos.map((w) => w.file_id || w.name);

        return json({
            settings: typeof ajustes === 'string' ? ajustes : JSON.stringify(ajustes),
            koboldai_settings: [],
            koboldai_setting_names: [],
            world_names,
            novelai_settings: [],
            novelai_setting_names: [],
            openai_settings: [],
            openai_setting_names: [],
            textgenerationwebui_presets: [],
            textgenerationwebui_preset_names: [],
            themes: [],
            movingUIPresets: [],
            quickReplyPresets: [],
            instruct: [],
            context: [],
            sysprompt: [],
            reasoning: [],
            enable_extensions: false,
            enable_extensions_auto_update: false,
            enable_accounts: false,
            request_compression: { enabled: false, minPayloadSize: 0, maxPayloadSize: 0, timeout: 0 },
        });
    }

    if (pathname === '/api/settings/save' && m === 'POST') {
        const nuevos = typeof body === 'string' ? JSON.parse(body) : body;
        await disco.guardarAjustes(nuevos);
        return json({ result: 'ok' });
    }

    // ------------------------------------------------ CHATS
    if (pathname === '/api/chats/save' && m === 'POST') {
        const { avatar_url, file_name, chat } = body;
        if (!Array.isArray(chat)) {
            return json({ error: 'chat is not an array' }, 400);
        }
        await disco.guardarChat(avatar_url, file_name, chat);
        return json({ ok: true });
    }

    if (pathname === '/api/chats/get' && m === 'POST') {
        const { avatar_url, file_name } = body;
        if (!file_name) return json({});
        const chat = await disco.leerChat(avatar_url, file_name);
        return json(chat);
    }

    if (pathname === '/api/chats/recent' && m === 'POST') {
        const max = Number(body?.max) || 100;
        const pinned = Array.isArray(body?.pinned) ? body.pinned : [];
        const recientes = await disco.listarChatsRecientes(max, pinned);
        return json(recientes);
    }

    if (pathname === '/api/chats/delete' && m === 'POST') {
        const { avatar_url, file_name } = body;
        await disco.borrarChat(avatar_url, file_name);
        return json({ ok: true });
    }

    if (pathname === '/api/characters/chats' && m === 'POST') {
        const { avatar_url } = body;
        const chats = await disco.listarChatsPersonaje(avatar_url);
        return json(chats);
    }

    // ------------------------------------------------ MUNDOS (World Info)
    if (pathname === '/api/worldinfo/get' && m === 'POST') {
        const nombre = body?.name;
        if (!nombre) return json({ entries: {} });
        let mundo = await disco.leerMundo(nombre);
        // Si no está aún en el disco, devuelve entradas vacías
        if (!mundo || !mundo.entries) {
            mundo = { entries: {} };
        }
        return json(mundo);
    }

    if (pathname === '/api/worldinfo/edit' && m === 'POST') {
        const nombre = body?.name;
        const data = body?.data;
        if (!nombre || !data) return json({ error: 'Faltan datos' }, 400);
        await disco.guardarMundo(nombre, data);
        return json({ ok: true });
    }

    if (pathname === '/api/worldinfo/delete' && m === 'POST') {
        const nombre = body?.name;
        if (nombre) await disco.borrarMundo(nombre);
        return json({ ok: true });
    }

    if (pathname === '/api/worldinfo/list' && m === 'POST') {
        const mundos = await disco.listarMundos();
        return json(mundos);
    }

    // ------------------------------------------------ FICHAS (Personajes)
    if (pathname === '/api/characters/all' && m === 'POST') {
        const personajes = await disco.listarPersonajes();
        return json(personajes);
    }

    if (pathname === '/api/characters/get' && m === 'POST') {
        const avatar = body?.avatar_url;
        const p = await disco.leerPersonaje(avatar);
        if (!p) return json({ error: 'not found' }, 404);
        return json(p);
    }

    if (pathname === '/api/characters/create' && m === 'POST') {
        const avatar = body?.file_name || body?.name || 'nuevo';
        await disco.guardarPersonaje(avatar, body);
        return json({ file_name: `${avatar}.png`, ...body });
    }

    if (pathname === '/api/characters/edit' && m === 'POST') {
        const avatar = body?.avatar_url || body?.name;
        await disco.guardarPersonaje(avatar, body);
        return json({ ok: true });
    }

    if (pathname === '/api/characters/merge-attributes' && m === 'POST') {
        const avatar = body?.avatar;
        const existente = (await disco.leerPersonaje(avatar)) || {};
        const mezclado = { ...existente, ...(body?.data || {}) };
        await disco.guardarPersonaje(avatar, mezclado);
        return json({ ok: true });
    }

    // ------------------------------------------------ ARCHIVOS DE USUARIO
    if (pathname === '/api/files/sanitize-filename' && m === 'POST') {
        const fileName = limpiarNombreArchivo(body?.fileName);
        return json({ fileName });
    }

    if (pathname === '/api/files/upload' && m === 'POST') {
        const { name, data } = body;
        if (!name || !data) return json({ error: 'Missing name or data' }, 400);
        const res = await disco.guardarArchivo(name, data);
        return json({ path: res.path });
    }

    if (pathname === '/api/files/delete' && m === 'POST') {
        const ruta = body?.path;
        if (ruta) await disco.borrarArchivo(ruta);
        return text('OK', 200);
    }

    if (pathname === '/api/files/verify' && m === 'POST') {
        const urls = Array.isArray(body?.urls) ? body.urls : [];
        const verificados = await disco.verificarArchivos(urls);
        return json(verificados);
    }

    if (pathname.startsWith('/user/files/') && m === 'GET') {
        const archivo = await disco.leerArchivo(pathname);
        if (!archivo) return text('Not Found', 404);
        // Si fue guardado en base64, lo devuelve
        return text(archivo.dataBase64, 200, archivo.mimeType);
    }

    // ------------------------------------------------ IMÁGENES / CARAS
    if (pathname === '/api/images/upload' && m === 'POST') {
        const { name, image } = body;
        const ruta = `user/images/${limpiarNombreArchivo(name || 'img.png')}`;
        await disco.guardarArchivo(ruta, image || '', 'image/png');
        return json({ path: ruta });
    }

    if (pathname.startsWith('/user/images/') && m === 'GET') {
        const archivo = await disco.leerArchivo(pathname);
        if (!archivo) return text('Not Found', 404);
        return text(archivo.dataBase64, 200, 'image/png');
    }

    if ((pathname.startsWith('/characters/') || pathname.startsWith('/thumbnail')) && m === 'GET') {
        // Retrato por defecto o avatar guardado
        return text('', 200, 'image/png');
    }

    // ------------------------------------------------ SILENCIOSOS (Tabla 3.2)
    if (pathname === '/api/extensions/discover') return json([]);
    if (pathname === '/api/secrets/read') return json({});
    if (pathname === '/api/horde/status') return json({ is_online: false });
    if (pathname === '/api/horde/text-models') return json({ models: [] });
    if (pathname.startsWith('/api/tokenizers/')) {
        const str = typeof body === 'string' ? body : JSON.stringify(body || '');
        const count = Math.max(1, Math.ceil(str.length / 4));
        return json({ tokens: [], count, token_count: count });
    }
    if (pathname === '/api/quick-replies/save') return json({ success: true });
    if (pathname === '/api/sprites/get') return json({});
    if (pathname === '/api/avatars/get') return json([]);
    if (pathname === '/api/groups/all') return json([]);
    if (pathname === '/api/backgrounds/all') return json({ images: [], config: { width: 1920, height: 1080 } });
    if (pathname === '/api/backgrounds/folders') return json({ folders: [], imageFolderMap: {} });
    if (pathname === '/api/image-metadata/all') return json({});
    if (pathname === '/api/sd/comfy/workflows') return json([]);
    if (pathname === '/css/user.css') return text('', 200, 'text/css');

    // ------------------------------------------------ NO IMPLEMENTADO
    console.warn(`[ServidorBolsillo] Llamada no interceptada: ${m} ${pathname}`);
    return json({ error: `La app no sabe contestar ${m} ${pathname}` }, 404);
}
