/**
 * Pruebas unitarias para el servidor de bolsillo (A2 de wiki/ROADMAP_APK_ANDROID.md).
 *
 * Comprueba que disco.js y rutas.js responden a las llamadas del juego
 * de forma idéntica al servidor real sin tocar la red ni el disco físico.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as disco from '../public/scripts/sin-servidor/disco.js';
import { responder, limpiarNombreArchivo } from '../public/scripts/sin-servidor/rutas.js';

function expect(actual) {
    return {
        toBe: (expected) => assert.strictEqual(actual, expected),
        toEqual: (expected) => {
            if (Array.isArray(expected)) {
                assert.ok(Array.isArray(actual));
                for (const item of expected) {
                    assert.ok(actual.some(a => Object.keys(item).every(k => a[k] === item[k])));
                }
            } else {
                assert.deepStrictEqual(actual, expected);
            }
        },
        toContain: (expected) => assert.ok(String(actual).includes(expected)),
        toHaveLength: (expected) => assert.strictEqual(actual.length, expected),
        toBeGreaterThan: (expected) => assert.ok(actual > expected),
    };
}
expect.arrayContaining = (arr) => arr;
expect.objectContaining = (obj) => obj;

describe('Servidor de bolsillo — disco.js y rutas.js', () => {
    beforeEach(async () => {
        await disco.limpiarTodo();
    });

    test('limpiarNombreArchivo sanea rutas y caracteres reservados', () => {
        expect(limpiarNombreArchivo('partida/guardada:1?.json')).toBe('partida_guardada_1_.json');
        expect(limpiarNombreArchivo('archivo con   espacios.txt')).toBe('archivo con espacios.txt');
    });

    test('/csrf-token y /version devuelven respuestas válidas', async () => {
        const csrf = await responder('GET', '/csrf-token');
        expect(csrf.status).toBe(200);
        expect(csrf.data.csrfToken).toBe('dnd-master-offline-token');

        const ver = await responder('GET', '/version');
        expect(ver.status).toBe(200);
        expect(ver.data.version).toContain('apk');
    });

    test('guardar y leer chat en el disco de mentira', async () => {
        const chatData = [
            { chat_metadata: { heroName: 'Aserun', day: 1 } },
            { name: 'Aserun', mes: 'Hola gremio', is_user: true },
            { name: 'Brunilda', mes: 'Bienvenido', is_user: false },
        ];

        const saveRes = await responder('POST', '/api/chats/save', {
            avatar_url: 'Dnd Master',
            file_name: 'partida-test',
            chat: chatData,
        });
        expect(saveRes.status).toBe(200);
        expect(saveRes.data.ok).toBe(true);

        const getRes = await responder('POST', '/api/chats/get', {
            avatar_url: 'Dnd Master',
            file_name: 'partida-test',
        });
        expect(getRes.status).toBe(200);
        expect(getRes.data).toHaveLength(3);
        expect(getRes.data[1].mes).toBe('Hola gremio');

        const recentRes = await responder('POST', '/api/chats/recent', { max: 10 });
        expect(recentRes.status).toBe(200);
        expect(recentRes.data).toHaveLength(1);
        expect(recentRes.data[0].chat_metadata.heroName).toBe('Aserun');

        const delRes = await responder('POST', '/api/chats/delete', {
            avatar_url: 'Dnd Master',
            file_name: 'partida-test',
        });
        expect(delRes.status).toBe(200);

        const getAfterDel = await responder('POST', '/api/chats/get', {
            avatar_url: 'Dnd Master',
            file_name: 'partida-test',
        });
        expect(getAfterDel.data).toHaveLength(0);
    });

    test('guardar, leer y listar mundos (worldinfo)', async () => {
        const mundoData = {
            name: 'Mundo Prueba',
            entries: {
                0: { key: ['taberna'], content: 'Una taberna acogedora' },
            },
        };

        const editRes = await responder('POST', '/api/worldinfo/edit', {
            name: 'mundo-test',
            data: mundoData,
        });
        expect(editRes.status).toBe(200);
        expect(editRes.data.ok).toBe(true);

        const getRes = await responder('POST', '/api/worldinfo/get', { name: 'mundo-test' });
        expect(getRes.status).toBe(200);
        expect(getRes.data.entries[0].content).toBe('Una taberna acogedora');

        const listRes = await responder('POST', '/api/worldinfo/list');
        expect(listRes.status).toBe(200);
        expect(listRes.data).toEqual(expect.arrayContaining([
            expect.objectContaining({ file_id: 'mundo-test' }),
        ]));
    });

    test('archivos de usuario: upload, verify, delete', async () => {
        const upRes = await responder('POST', '/api/files/upload', {
            name: 'ranura-1.json',
            data: Buffer.from(JSON.stringify({ slot: 1 })).toString('base64'),
        });
        expect(upRes.status).toBe(200);
        expect(upRes.data.path).toBe('user/files/ranura-1.json');

        const verifyRes = await responder('POST', '/api/files/verify', {
            urls: ['user/files/ranura-1.json', 'user/files/no-existe.json'],
        });
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.data['user/files/ranura-1.json']).toBe(true);
        expect(verifyRes.data['user/files/no-existe.json']).toBe(false);

        const readRes = await responder('GET', '/user/files/ranura-1.json');
        expect(readRes.status).toBe(200);
        const decoded = Buffer.from(readRes.data, 'base64').toString('utf8');
        expect(JSON.parse(decoded)).toEqual({ slot: 1 });

        const delRes = await responder('POST', '/api/files/delete', { path: 'user/files/ranura-1.json' });
        expect(delRes.status).toBe(200);

        const readAfterDel = await responder('GET', '/user/files/ranura-1.json');
        expect(readAfterDel.status).toBe(404);
    });

    test('ajustes: lectura con valores limpios por defecto y guardado', async () => {
        const getRes = await responder('POST', '/api/settings/get');
        expect(getRes.status).toBe(200);
        expect(getRes.data.enable_extensions).toBe(false);
        const settings = typeof getRes.data.settings === 'string' ? JSON.parse(getRes.data.settings) : getRes.data.settings;
        expect(settings.username).toBe('Héroe');

        settings.username = 'Valeroso';
        const saveRes = await responder('POST', '/api/settings/save', settings);
        expect(saveRes.status).toBe(200);

        const getRes2 = await responder('POST', '/api/settings/get');
        const settings2 = typeof getRes2.data.settings === 'string' ? JSON.parse(getRes2.data.settings) : getRes2.data.settings;
        expect(settings2.username).toBe('Valeroso');
    });

    test('llamadas silenciosas de SillyTavern se responden sin error', async () => {
        const ext = await responder('GET', '/api/extensions/discover');
        expect(ext.data).toEqual([]);

        const tok = await responder('POST', '/api/tokenizers/llama/encode', { prompt: 'Un texto' });
        expect(tok.status).toBe(200);
        expect(tok.data.token_count).toBeGreaterThan(0);

        const sec = await responder('POST', '/api/secrets/read');
        expect(sec.data).toEqual({});

        const qr = await responder('POST', '/api/quick-replies/save', {});
        expect(qr.data.success).toBe(true);
    });
});
