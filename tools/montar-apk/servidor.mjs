#!/usr/bin/env node
/**
 * Servidor local para MontarAPK.exe (Dnd Master para Android).
 *
 * Abre una ventana independiente de Microsoft Edge en modo aplicación con
 * una interfaz estética de fantasía oscura y pixel art para:
 * - Diagnosticar entorno (Node, Java JDK, Android SDK, ADB, móvil USB).
 * - Montar y compilar la APK de Dnd Master con 1 solo clic.
 * - Instalarla directamente en el teléfono por cable USB.
 * - Abrir la carpeta donde queda la APK.
 * - Probar el juego sin servidor directamente en el PC.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
    appendFileSync, existsSync, mkdirSync, readFileSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edgePath } from '../probar-campanas/windows.mjs';
import { detectarEntorno, copiarApp, verificarCopia, sincronizarCapacitor, compilarApk, instalarApk } from '../apk.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const APP_DIR = join(ROOT, 'app-android');
const SALIDA_DIR = join(APP_DIR, 'salida');
const LOCAL = join(process.env.LOCALAPPDATA || tmpdir(), 'MontarAPK');
mkdirSync(LOCAL, { recursive: true });
const LOG_FILE = join(LOCAL, 'ventana.log');

const argAfter = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] ?? '' : '');
const NO_WINDOW = process.argv.includes('--sin-ventana');
const PORT = Number(argAfter('--puerto')) || 8614;

let construyendo = false;
/** @type {Array<(data: string) => void>} */
const sseListeners = [];

function emitLog(msg) {
    const time = new Date().toLocaleTimeString();
    const linea = `[${time}] ${msg}`;
    try { appendFileSync(LOG_FILE, `${linea}\n`); } catch { /* nada */ }
    if (process.stdout.isTTY || NO_WINDOW) console.log(linea);
    for (const listener of sseListeners) {
        listener(linea);
    }
}

function infoApk() {
    const apkPath = join(SALIDA_DIR, 'Dnd-Master.apk');
    if (!existsSync(apkPath)) return null;
    const st = statSync(apkPath);
    return {
        path: apkPath,
        sizeMb: (st.size / (1024 * 1024)).toFixed(2),
        mtime: st.mtimeMs,
        fecha: new Date(st.mtimeMs).toLocaleString(),
    };
}

let lastPing = Date.now();
const IDLE_TIMEOUT = 50 * 1000;

const server = createServer(async (req, res) => {
    lastPing = Date.now();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS básico local
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === '/' || pathname === '/app.html') {
        const html = readFileSync(join(HERE, 'app.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
    }

    if (pathname === '/api/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (pathname === '/api/estado') {
        const entorno = detectarEntorno();
        const apk = infoApk();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            node: process.version,
            entorno,
            ultimaApk: apk,
            construyendo,
        }));
        return;
    }

    if (pathname === '/api/logs') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.write('retry: 1000\n\n');

        const listener = (linea) => {
            res.write(`data: ${JSON.stringify(linea)}\n\n`);
        };
        sseListeners.push(listener);

        req.on('close', () => {
            const idx = sseListeners.indexOf(listener);
            if (idx >= 0) sseListeners.splice(idx, 1);
        });
        return;
    }

    if (pathname === '/api/montar' && req.method === 'POST') {
        if (construyendo) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Ya hay una compilación en curso.' }));
            return;
        }

        construyendo = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mensaje: 'Compilación iniciada' }));

        // Ejecutar en segundo plano
        (async () => {
            try {
                emitLog('⚔️  Iniciando montaje de la APK Dnd Master...');
                await copiarApp((msg) => emitLog(msg));
                verificarCopia((msg) => emitLog(msg));
                await sincronizarCapacitor((msg) => emitLog(msg));
                const apk = await compilarApk('debug', (msg) => emitLog(msg));
                emitLog(`✨ ¡APK lista! Guardada en: ${apk}`);
            } catch (err) {
                emitLog(`❌ Error montando la APK: ${err.message}`);
            } finally {
                construyendo = false;
            }
        })();
        return;
    }

    if (pathname === '/api/instalar' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

        (async () => {
            try {
                emitLog('📲 Instalando APK en el dispositivo por USB...');
                await instalarApk(null, (msg) => emitLog(msg));
            } catch (err) {
                emitLog(`❌ Error de instalación: ${err.message}`);
            }
        })();
        return;
    }

    if (pathname === '/api/abrir-carpeta' && req.method === 'POST') {
        const apk = infoApk();
        const objetivo = apk ? apk.path : (existsSync(SALIDA_DIR) ? SALIDA_DIR : ROOT);
        const args = apk ? ['/select,', objetivo] : [objetivo];
        spawn('explorer.exe', args, { detached: true, stdio: 'ignore' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' ? address.port : PORT;
    const url = `http://127.0.0.1:${port}/`;
    emitLog(`Servidor de MontarAPK escuchando en ${url}`);

    if (!NO_WINDOW) {
        const edge = edgePath();
        if (edge) {
            spawn(edge, [`--app=${url}`, `--user-data-dir=${join(LOCAL, 'edge')}`], {
                detached: true,
                stdio: 'ignore',
            });
        }
    }

    // Apagado automático al cerrar la ventana (si no hay pings en 45 segundos)
    setInterval(() => {
        if (!NO_WINDOW && Date.now() - lastPing > IDLE_TIMEOUT) {
            emitLog('Ventana cerrada (tiempo de inactividad). Apagando servidor.');
            process.exit(0);
        }
    }, 10000);
});
