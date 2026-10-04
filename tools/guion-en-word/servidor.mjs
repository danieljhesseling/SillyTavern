#!/usr/bin/env node
/**
 * GuionEnWord (J5.7 y J5.8 de wiki/ROADMAP_SIN_CONEXION.md, con ventana): sacar el guion de una
 * campaña a Word y devolverlo al juego sin abrir la consola. Lo abre `GuionEnWord.exe` (o este
 * archivo con `node`). Hace lo mismo que `tools/guion-word.mjs`, que es quien hace el trabajo.
 *
 * - Enciende un servidor pequeño solo para esta ventana (en 127.0.0.1, en un puerto libre) y la
 *   abre como una ventana suelta de Microsoft Edge (`msedge --app=…`, con su propio perfil: no
 *   abre pestañas en tu navegador). No enciende el juego.
 * - Exportar: la campaña, las categorías (o todo) y dónde guardar el Word (el cuadro de «Guardar
 *   como» de Windows).
 * - Importar: el Word corregido (el cuadro de «Abrir» de Windows), lo que cambiaría por
 *   categorías y, al darle a «Guardar en el juego», una copia de lo que hay antes en
 *   `Documentos\Guiones\copias\<fecha>_<campaña>\`.
 * - Cuando cierras la ventana, se apaga solo.
 *
 * Uso:
 *   node tools/guion-en-word/servidor.mjs                 # abre la ventana
 *   node tools/guion-en-word/servidor.mjs --sin-ventana   # sin abrir la ventana (dice la dirección)
 *   node tools/guion-en-word/servidor.mjs --puerto 8611   # la ventana en ese puerto (si no, uno libre)
 *   … --cdp 0 --perfil D:\perfil                          # para probarla con Playwright
 */

import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { edgePath } from '../probar-campanas/windows.mjs';
import { EXE_NAME, desktopShortcut, dialog } from './windows.mjs';
import {
    CATEGORIES, loadCampaign, scriptOf, categoriesIn, categoryOf, parseCategories, exportScript, importScript, describeImport,
    defaultFolder, defaultName, backupFolder, writeGemNotes,
} from '../guion-word.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] ?? '' : '');
const NO_WINDOW = process.argv.includes('--sin-ventana');
const UI_PORT = Number(argAfter('--puerto')) || 0;
const CDP_PORT = process.argv.includes('--cdp') ? String(Number(argAfter('--cdp')) || 0) : '';
const LOCAL = join(process.env.LOCALAPPDATA || tmpdir(), 'GuionEnWord');
const EDGE_PROFILE = argAfter('--perfil') || join(LOCAL, 'edge');
const IDLE_MS = 45 * 1000;
mkdirSync(LOCAL, { recursive: true });
const SERVER_LOG = join(LOCAL, 'ventana.log');
const say = (/** @type {string} */ line) => {
    try { appendFileSync(SERVER_LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* nada */ }
    if (NO_WINDOW || process.stdout.isTTY) console.log(line);
};
const STATE_FILE = join(tmpdir(), 'guion-en-word-ventana.json');
/** Las copias de antes de guardar: al lado de los guiones. */
const BACKUPS = () => join(defaultFolder(), 'copias');

// ------------------------------------------------------------------ las campañas

/**
 * Las campañas del menú: las del juego, las de public/mundos (las experimentales) y un .json suelto.
 *
 * @returns {Array<{id: string, name: string, group: string, note: string, json?: boolean}>}
 */
function campaigns() {
    /** @type {any[]} */
    let rows = [];
    try { rows = JSON.parse(readFileSync(join(ROOT, 'public/mundos/mundos.json'), 'utf8')).worlds ?? []; } catch { rows = []; }
    const own = [
        { id: 'gremio', name: 'El prólogo y el gremio', group: 'Del juego', note: 'El texto va a su paquete (public/mundos/gremio.pack.json) y al compendio (charlas, quedadas…).' },
        { id: '1387', name: '1387 (El valle de Vane)', group: 'Del juego', note: 'El texto va a su paquete (public/mundos/1387.pack.json) y al compendio.' },
        { id: 'strahd', name: 'La Maldición de Strahd', group: 'Del juego', note: 'El texto va a sus capas (wiki/campanas/strahd) y el paquete se vuelve a hacer.' },
    ];
    /** @type {any[]} */
    const more = [];
    let packs = [];
    try { packs = readdirSync(join(ROOT, 'public/mundos')).filter(f => /^[\w-]+\.pack\.json$/.test(f)); } catch { packs = []; }
    for (const file of packs.sort()) {
        const id = file.replace(/\.pack\.json$/, '');
        if (own.some(c => c.id === id)) continue;
        const row = rows.find(r => r?.pack === `/mundos/${file}` || r?.id === id);
        const rounds = existsSync(join(ROOT, 'wiki/guiones', id));
        more.push({
            id, name: String(row?.name || id), group: rounds ? 'Experimentales' : 'Otros paquetes',
            note: rounds ? `Lo corregido va a una ronda nueva de su guion (wiki/guiones/${id}) y el paquete se vuelve a hacer de las rondas.`
                : `El texto va a su paquete (public/mundos/${file}).`,
        });
    }
    return [...own, ...more, { id: 'json', name: 'Un .json suelto…', group: 'Tuya', note: 'Un paquete o la campaña que te ha dado tu Gem, en un archivo .json: el texto corregido va a ese mismo archivo.', json: true }];
}

/**
 * Lo que se le pasa a guion-word: el id, o la ruta del .json suelto.
 *
 * @param {any} input
 * @returns {string}
 */
function whichOf(input) {
    const id = String(input?.campaign ?? '');
    if (id === 'json') {
        const file = String(input?.json ?? '');
        if (!file || !/\.json$/i.test(file) || !existsSync(file)) throw new Error('Elige primero el archivo .json de tu campaña.');
        return resolve(file);
    }
    if (!campaigns().some(c => c.id === id && !c.json)) throw new Error('Esa campaña no está en el menú.');
    return id;
}

/** Las categorías de cada campaña, guardadas mientras su paquete no cambie. */
/** @type {Map<string, {stamp: string, data: any}>} */
const categoryCache = new Map();

/**
 * Las categorías del guion de una campaña, con cuántas líneas tiene cada una.
 *
 * @param {string} which
 */
function categoriesOf(which) {
    const campaign = loadCampaign(which);
    const stamp = [campaign.packFile, ...Object.values(campaign.compendioFiles)].map(f => `${f}:${statSync(f).mtimeMs}`).join('|');
    const cached = categoryCache.get(which);
    if (cached && cached.stamp === stamp) return cached.data;
    const script = scriptOf(campaign);
    const data = {
        title: script.title, lines: script.counts.lines, categories: categoriesIn(script),
        suggested: join(defaultFolder(), defaultName(campaign)), rounds: Boolean(campaign.rounds),
    };
    categoryCache.set(which, { stamp, data });
    return data;
}

// ------------------------------------------------------------------ exportar e importar

/**
 * Exportar: el Word (y si se pide, el .md) donde se ha elegido.
 *
 * @param {any} input
 */
function doExport(input) {
    const which = whichOf(input);
    const categories = parseCategories(input?.categories);
    const out = String(input?.out ?? '').trim();
    if (out && !/\.docx$/i.test(out)) throw new Error('El archivo tiene que acabar en .docx.');
    const { file, md, script } = exportScript(which, { out, md: Boolean(input?.md), categories });
    say(`exportar ${which} ${categories ? categories.join(',') : 'todo'}: ${file}`);
    return { ok: true, file, md, title: script.title, lines: script.counts.lines, categories };
}

/** Lo de una línea cambiada que enseña la ventana. */
const changeView = (/** @type {any} */ change) => {
    const category = categoryOf(change.block);
    return {
        id: change.id, label: change.block.label, before: change.before, after: change.after, warnings: change.warnings ?? [],
        category, categoryName: CATEGORIES.find(c => c.id === category)?.name ?? '',
    };
};

/**
 * Importar: lo que cambiaría (sin `apply`) o guardarlo (con `apply`, después de copiar lo de antes).
 *
 * @param {any} input
 * @param {boolean} apply
 */
function doImport(input, apply) {
    const which = whichOf(input);
    const file = String(input?.file ?? '');
    if (!file || !existsSync(file)) throw new Error('Elige primero el Word corregido.');
    if (!/\.(docx|md|txt)$/i.test(file)) throw new Error('Tiene que ser un Word (.docx), o un .md o .txt con las mismas marcas.');
    const categories = input?.categories == null ? null : parseCategories(input.categories);
    if (apply && categories === null && Array.isArray(input?.categories)) throw new Error('Marca al menos una categoría para guardar.');
    const name = which === resolve(which) ? basename(which).replace(/\.json$/i, '') : which;
    const backup = apply ? backupFolder(BACKUPS(), name) : '';
    const result = importScript(file, which, { apply, categories, backup });
    const notes = apply ? '' : writeGemNotes(file, result);
    const changes = result.ready.flatMap(entry => entry.changes);
    say(`${apply ? 'guardar' : 'revisar'} ${which} ${file}: ${changes.length} cambiadas${apply ? `, escritos ${result.written.length}${result.undone ? ', deshecho' : ''}` : ''}`);
    return {
        ok: true,
        title: result.title,
        report: describeImport(result, { file, which: input?.campaign === 'json' ? `"${which}"` : which, apply }),
        byCategory: result.byCategory,
        present: result.present,
        changes: changes.map(c => changeView(c)),
        refused: result.refused.map(({ change, error }) => ({ ...changeView(change), error })),
        skipped: result.skipped.map(c => changeView(c)),
        newer: result.review.newer.length,
        conflicts: result.review.conflicts.length,
        unknown: result.review.unknown.length,
        broken: result.review.broken.length,
        missing: result.review.missing.length,
        same: result.review.same,
        notes: result.review.notes.length,
        notesFile: notes,
        written: result.written.map(f => f.replace(ROOT, '').replace(/^[\\/]+/, '').replace(/\\/g, '/')),
        checks: result.checks,
        undone: result.undone,
        backup: result.backup && existsSync(result.backup) ? result.backup : '',
    };
}

// ------------------------------------------------------------------ Windows: la ventana, los cuadros, la carpeta

/**
 * Abre la ventana: Edge en modo aplicación, con un perfil suyo. Sin Edge, en el navegador de siempre.
 *
 * @param {string} url
 */
function openWindow(url) {
    if (NO_WINDOW) return;
    const edge = edgePath();
    if (!edge) {
        spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
        return;
    }
    const args = [`--app=${url}`, `--user-data-dir=${EDGE_PROFILE}`, '--no-first-run', '--no-default-browser-check', '--window-size=1200,900', '--disable-features=Translate'];
    if (CDP_PORT) args.push(`--remote-debugging-port=${CDP_PORT}`);
    spawn(edge, args, { detached: true, stdio: 'ignore' }).unref();
}

/**
 * Enseña un archivo o una carpeta en el Explorador, o abre un Word con su programa.
 *
 * @param {string} target
 * @param {'carpeta'|'archivo'} how
 */
function reveal(target, how) {
    if (!target || !existsSync(target)) return false;
    if (how === 'archivo') {
        if (!/\.(docx|md|txt)$/i.test(target)) return false;
        spawn('cmd.exe', ['/c', 'start', '""', target], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
        return true;
    }
    const isDir = statSync(target).isDirectory();
    spawn('explorer.exe', isDir ? [target] : [`/select,${target}`], { detached: true, stdio: 'ignore' }).unref();
    return true;
}

// ------------------------------------------------------------------ el servidor de la ventana

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();
let lastClientAt = Date.now();
let everConnected = false;

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {any} data
 */
function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>}
 */
function body(req) {
    return new Promise((done) => {
        /** @type {Buffer[]} */
        const parts = [];
        req.on('data', (/** @type {Buffer} */ chunk) => parts.push(chunk));
        req.on('end', () => {
            try { done(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { done({}); }
        });
    });
}

/**
 * Lo que se hace con la respuesta a un error: dicho en castellano, sin la pila.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {() => any} work
 */
function answer(res, work) {
    try {
        return json(res, 200, work());
    } catch (error) {
        const message = String(/** @type {any} */ (error)?.message ?? error);
        say(`error: ${/** @type {any} */ (error)?.stack ?? error}`);
        return json(res, 200, { ok: false, error: message });
    }
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    try {
        if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(readFileSync(join(HERE, 'app.html')));
            return;
        }
        if (req.method === 'GET' && path === '/api/hola') return json(res, 200, { app: 'guion-en-word', pid: process.pid });
        if (req.method === 'GET' && path === '/api/estado') {
            return json(res, 200, { campaigns: campaigns(), folder: defaultFolder(), backups: BACKUPS(), exe: existsSync(join(ROOT, EXE_NAME)) });
        }
        if (req.method === 'GET' && path === '/api/eventos') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
            res.write('event: hola\ndata: {}\n\n');
            clients.add(res);
            lastClientAt = Date.now();
            everConnected = true;
            const ping = setInterval(() => { try { res.write(': sigo\n\n'); } catch { /* nada */ } }, 15000);
            req.on('close', () => {
                clearInterval(ping);
                clients.delete(res);
                lastClientAt = Date.now();
            });
            return;
        }
        if (req.method !== 'POST') return json(res, 404, { error: 'No está.' });
        const input = await body(req);
        if (path === '/api/categorias') return answer(res, () => ({ ok: true, ...categoriesOf(whichOf(input)) }));
        if (path === '/api/exportar') return answer(res, () => doExport(input));
        if (path === '/api/revisar') return answer(res, () => doImport(input, false));
        if (path === '/api/guardar') return answer(res, () => doImport(input, true));
        if (path === '/api/elegir') {
            // Los cuadros de Windows: «Guardar como» para el Word nuevo, «Abrir» para el corregido o el .json.
            const kind = String(input?.kind ?? '');
            const start = String(input?.start ?? '') || defaultFolder();
            mkdirSync(defaultFolder(), { recursive: true });
            const picked = kind === 'guardar'
                ? await dialog({ save: true, title: 'Dónde guardar el guion', filter: 'Word (*.docx)|*.docx', start })
                : kind === 'json'
                    ? await dialog({ title: 'El .json de tu campaña', filter: 'Campaña (*.json)|*.json', start: existsSync(start) ? start : ROOT })
                    : await dialog({ title: 'El guion corregido', filter: 'Word o texto (*.docx;*.md;*.txt)|*.docx;*.md;*.txt|Todos (*.*)|*.*', start });
            return json(res, 200, { ok: true, file: picked });
        }
        if (path === '/api/abrir') {
            openWindow(`http://127.0.0.1:${/** @type {any} */ (server.address()).port}/`);
            return json(res, 200, { ok: true });
        }
        if (path === '/api/ensenar') return json(res, 200, { ok: reveal(String(input?.path ?? ''), input?.how === 'archivo' ? 'archivo' : 'carpeta') });
        if (path === '/api/escritorio') return json(res, 200, desktopShortcut(ROOT));
        json(res, 404, { error: 'No está.' });
    } catch (error) {
        say(`error en ${path}: ${/** @type {any} */ (error)?.stack ?? error}`);
        json(res, 500, { ok: false, error: String(/** @type {any} */ (error)?.message ?? error) });
    }
});

/**
 * Si ya hay una ventana encendida (otro doble clic), se le pide que se abra otra vez y ya.
 *
 * @returns {Promise<boolean>}
 */
function reopenRunning() {
    /** @type {any} */
    let saved = null;
    try { saved = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return Promise.resolve(false); }
    if (!saved?.port || (UI_PORT && saved.port !== UI_PORT)) return Promise.resolve(false);
    const ask = (/** @type {string} */ method, /** @type {string} */ where) => new Promise((done) => {
        const req = request({ host: '127.0.0.1', port: saved.port, path: where, method, timeout: 1500 }, (res) => {
            let text = '';
            res.on('data', (/** @type {Buffer} */ c) => { text += c; });
            res.on('end', () => done(text));
        });
        req.on('error', () => done(''));
        req.on('timeout', () => { req.destroy(); done(''); });
        req.end();
    });
    return ask('GET', '/api/hola').then(async (said) => {
        if (!/guion-en-word/.test(String(said))) return false;
        await ask('POST', '/api/abrir');
        return true;
    });
}

if (await reopenRunning()) {
    say('ya estaba encendida: se abre su ventana otra vez');
    process.exit(0);
}

server.listen(UI_PORT, '127.0.0.1', () => {
    const port = /** @type {any} */ (server.address()).port;
    const address = `http://127.0.0.1:${port}/`;
    try { writeFileSync(STATE_FILE, JSON.stringify({ port, pid: process.pid })); } catch { /* nada */ }
    say(`GuionEnWord en ${address} (guiones en ${defaultFolder()})`);
    openWindow(address);
    if (!NO_WINDOW) {
        setInterval(() => {
            if (clients.size > 0) return;
            if (Date.now() - lastClientAt > (everConnected ? IDLE_MS : 3 * IDLE_MS)) {
                say('ventana cerrada: se apaga');
                try { rmSync(STATE_FILE, { force: true }); } catch { /* nada */ }
                process.exit(0);
            }
        }, 5000);
    }
});
server.on('error', (error) => {
    say(`no se pudo encender: ${error}`);
    process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, () => {
        try { rmSync(STATE_FILE, { force: true }); } catch { /* nada */ }
        process.exit(0);
    });
}
