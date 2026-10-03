#!/usr/bin/env node
/**
 * ProbarCampañas (J16.6 de wiki/ROADMAP_SIN_CONEXION.md): la ventana para probar una campaña con
 * el bot sin abrir la consola. Lo abre `ProbarCampañas.exe` (o este archivo con `node`).
 *
 * - Enciende un servidor pequeño solo para esta ventana (en 127.0.0.1, en un puerto libre que
 *   elige Windows) y la abre como una ventana suelta de Microsoft Edge (`msedge --app=…`, con su
 *   propio perfil: no abre pestañas en tu navegador).
 * - Al darle a «Correr», lanza la vuelta que toca (`tools/vuelta-1387.mjs`, `vuelta-strahd.mjs`,
 *   `vuelta-gremio.mjs` o `vuelta-campana.mjs`) contra su propio servidor del juego, con sus
 *   datos en una carpeta temporal: tu partida no se toca. Lo que va escribiendo la vuelta llega a
 *   la ventana mientras juega.
 * - Al acabar, lee el registro (`clasificar.mjs`) y guarda el resultado, el registro entero y las
 *   capturas en `Documentos\ProbarCampañas\historial\<fecha>_<campaña>\`.
 * - Cuando cierras la ventana y no hay ninguna vuelta en marcha, se apaga solo.
 *
 * Uso:
 *   node tools/probar-campanas/servidor.mjs                    # abre la ventana
 *   node tools/probar-campanas/servidor.mjs --puerto-bot 8600  # el puerto del juego que usa el bot (si no, 8590 o el siguiente libre)
 *   node tools/probar-campanas/servidor.mjs --carpeta D:\x     # guardar los resultados en otra carpeta
 *   node tools/probar-campanas/servidor.mjs --sin-ventana      # sin abrir la ventana (dice la dirección)
 *   node tools/probar-campanas/servidor.mjs --puerto 8601      # la ventana en ese puerto (si no, uno libre)
 *   … --cdp 0 --perfil D:\perfil                               # para probarla con Playwright (Edge apunta su puerto en el perfil)
 *
 * Sin dependencias: solo lo que trae Node.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { basename, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readLog, classify, progressOf } from './clasificar.mjs';
import { EXE_NAME, edgePath, desktopShortcut } from './windows.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] ?? '' : '');
const NO_WINDOW = process.argv.includes('--sin-ventana');
const UI_PORT = Number(argAfter('--puerto')) || 0;
const BOT_PORT_GIVEN = Number(argAfter('--puerto-bot')) || 0;
const BOT_PORT_DEFAULT = 8590;
/**
 * Para probar la ventana desde fuera (Playwright por CDP): el puerto de depuración de Edge. Con
 * `--cdp 0`, uno libre: Edge lo apunta en `DevToolsActivePort`, en su perfil.
 */
const CDP_PORT = process.argv.includes('--cdp') ? String(Number(argAfter('--cdp')) || 0) : '';
/** El perfil de Edge de la ventana (con `--perfil`, otro: para las pruebas). */
const EDGE_PROFILE = argAfter('--perfil') || join(process.env.LOCALAPPDATA || tmpdir(), 'ProbarCampanas', 'edge');
/** Lo más que puede durar una vuelta: con las peleas de verdad, Strahd entera tarda mucho. */
const MAX_RUN_MS = 4 * 60 * 60 * 1000;
/** Sin ventana abierta (y sin vuelta en marcha) tanto tiempo, se apaga. */
const IDLE_MS = 45 * 1000;

// ------------------------------------------------------------------ dónde se guarda

/**
 * La carpeta Documentos de verdad: la de Windows puede estar en OneDrive («Documentos»), y eso lo
 * dice el registro. El lanzador la pasa en `PROBAR_DOCUMENTOS`; si no, se pregunta.
 *
 * @returns {string}
 */
function documentsFolder() {
    if (process.env.PROBAR_DOCUMENTOS && existsSync(process.env.PROBAR_DOCUMENTOS)) return process.env.PROBAR_DOCUMENTOS;
    try {
        const said = spawnSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders', '/v', 'Personal'], { encoding: 'utf8', windowsHide: true });
        const found = /Personal\s+REG_\w+\s+(.+)/.exec(String(said.stdout ?? ''))?.[1]?.trim();
        if (found && existsSync(found)) return found;
    } catch { /* sin registro: la de siempre */ }
    return join(homedir(), 'Documents');
}

const DATA = argAfter('--carpeta') || join(documentsFolder(), 'ProbarCampañas');
const HISTORY = join(DATA, 'historial');
mkdirSync(HISTORY, { recursive: true });
const SERVER_LOG = join(DATA, 'ventana.log');
const say = (/** @type {string} */ line) => {
    try { appendFileSync(SERVER_LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* nada */ }
    if (NO_WINDOW || process.stdout.isTTY) console.log(line);
};
/** Dónde apunta la ventana abierta su puerto, para que un segundo doble clic la reabra en vez de encender otra. */
const STATE_FILE = join(tmpdir(), 'probar-campanas-ventana.json');

// ------------------------------------------------------------------ las campañas

/**
 * Las campañas del menú. `endCheck`: la comprobación de la vuelta que dice que ha llegado a un
 * final (`null`: todas lo son, como en la vuelta del gremio). `pack`: su paquete, para contar sus
 * hitos (la barra de avance).
 *
 * @returns {Array<{id: string, name: string, group: string, note: string, script: string, args: string[], endCheck: RegExp|null, fights: boolean, pack?: string, board?: string, json?: boolean}>}
 */
function campaigns() {
    /** @type {any[]} */
    let rows = [];
    try { rows = JSON.parse(readFileSync(join(ROOT, 'public/mundos/mundos.json'), 'utf8')).worlds ?? []; } catch { rows = []; }
    // Las experimentales: las del tablón sin paquete y con semilla (su historia la escribe el juego).
    const seeds = rows.filter(r => r && !r.pack && r.seed).map(r => ({
        id: String(r.id), name: String(r.name), group: 'Experimentales',
        note: `${r.genre ? `${r.genre}. ` : ''}Sin historia escrita: el juego le pone tres actos con su semilla.`,
        script: 'tools/vuelta-campana.mjs', args: ['--tablon', String(r.id)], endCheck: /hasta uno de sus finales/, fights: true, board: String(r.id),
    }));
    return [
        { id: 'gremio', name: 'El prólogo y el gremio', group: 'Del juego', note: 'El prólogo entero (el muelle, Tomás, Brunilda y la bodega), contratar a alguien, 1387 hasta su segundo hito, volver al gremio y Strahd hasta su primer hito.',
            script: 'tools/vuelta-gremio.mjs', args: [], endCheck: null, fights: false },
        { id: '1387', name: '1387', group: 'Del juego', note: 'Saltar la prueba y 1387 entera, a clics, hasta uno de sus tres finales.',
            script: 'tools/vuelta-1387.mjs', args: [], endCheck: /finales/, fights: true, pack: 'public/mundos/1387.pack.json' },
        { id: 'strahd', name: 'La Maldición de Strahd', group: 'Del juego', note: 'Saltar la prueba y Strahd entera (los doce hitos del hilo) hasta uno de sus tres finales.',
            script: 'tools/vuelta-strahd.mjs', args: [], endCheck: /finales/, fights: true, pack: 'public/mundos/strahd.pack.json' },
        { id: 'strahd-corto', name: 'La Maldición de Strahd (solo el camino al final)', group: 'Del juego', note: 'Strahd sin la bodega, Krezk ni Argynvostholt: el camino más corto a un final.',
            script: 'tools/vuelta-strahd.mjs', args: ['--corto'], endCheck: /finales/, fights: true, pack: 'public/mundos/strahd.pack.json' },
        ...seeds,
        { id: 'json', name: 'Un JSON tuyo…', group: 'Tuya', note: 'La campaña que te ha dado tu Gem, en un archivo .json: se añade al tablón como quien juega y se juega hasta un final.',
            script: 'tools/vuelta-campana.mjs', args: [], endCheck: /hasta uno de sus finales/, fights: true, json: true },
    ];
}

/**
 * Cuántos hitos tiene una campaña (los del hilo: ni escondidos ni de reloj), para la barra.
 *
 * @param {any} pack
 * @returns {number}
 */
function milestonesOf(pack) {
    const list = Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : [];
    return list.filter((/** @type {any} */ m) => m && !m.hidden && m.opens?.kind !== 'clock').length;
}

/**
 * Los hitos de una experimental: se hace su paquete aquí con la misma semilla (como `e2e-actos.mjs`).
 *
 * @param {string} id
 * @returns {Promise<number>}
 */
async function seedMilestones(id) {
    try {
        const engine = (/** @type {string} */ path) => import(pathToFileURL(join(ROOT, 'public/scripts/game-engine', path)).href);
        const { createCompendium } = await engine('compendio/compendio.js');
        const { seedCampaignPack } = await engine('campaign/seed-pack.js');
        const battery = (/** @type {string} */ name) => JSON.parse(readFileSync(join(ROOT, 'public/compendio', `${name}.json`), 'utf8')).rows;
        const compendium = createCompendium(Object.fromEntries(['actos', 'nombres', 'mundo', 'facciones', 'bestiario', 'frases'].map(d => [d, battery(d)])));
        const row = JSON.parse(readFileSync(join(ROOT, 'public/mundos/mundos.json'), 'utf8')).worlds.find((/** @type {any} */ w) => w.id === id);
        return milestonesOf(seedCampaignPack({ row, compendium }).pack);
    } catch {
        return 0;
    }
}

// ------------------------------------------------------------------ el historial

/** @param {number} ms */
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;
const SAFE = /^[\w.-]+$/;

/**
 * Las capturas de una vuelta, con lo que enseña cada una (las vueltas les ponen sufijos).
 *
 * @param {string} dir
 * @returns {Array<{file: string, label: string}>}
 */
function shotsIn(dir) {
    const label = (/** @type {string} */ file) => {
        if (file === 'captura.png') return 'Al empezar la campaña';
        if (/\.error\.png$/.test(file)) return 'Cuando se rompió';
        if (/\.final\.png$/.test(file)) return 'Al final';
        const rest = file.replace(/^captura[.-]?/, '').replace(/\.png$/i, '').replace(/^png\./, '');
        return rest.replace(/[-.]/g, ' ').replace(/^\w/, c => c.toUpperCase());
    };
    try {
        return readdirSync(dir).filter(f => /\.png$/i.test(f) && SAFE.test(f))
            .map(f => ({ file: f, at: statSync(join(dir, f)).mtimeMs }))
            .sort((a, b) => a.at - b.at)
            .map(({ file }) => ({ file, label: label(file) }));
    } catch {
        return [];
    }
}

/**
 * La captura que se enseña en la tarjeta: la del fallo, la del final o la última.
 *
 * @param {Array<{file: string, label: string}>} shots
 * @returns {string}
 */
function mainShot(shots) {
    return (shots.find(s => /\.error\.png$/.test(s.file)) ?? shots.find(s => /\.final\.png$/.test(s.file)) ?? shots[shots.length - 1])?.file ?? '';
}

/**
 * Todas las vueltas guardadas, de la más nueva a la más vieja. Una carpeta sin resultado (la
 * ventana se cerró a medias) se lee de su registro.
 *
 * @returns {any[]}
 */
function history() {
    /** @type {any[]} */
    const out = [];
    let dirs = [];
    try { dirs = readdirSync(HISTORY).filter(d => SAFE.test(d)); } catch { dirs = []; }
    for (const id of dirs) {
        if (current && current.id === id) continue;
        const dir = join(HISTORY, id);
        try {
            if (existsSync(join(dir, 'resultado.json'))) {
                out.push(JSON.parse(readFileSync(join(dir, 'resultado.json'), 'utf8')));
                continue;
            }
            if (!existsSync(join(dir, 'registro.txt'))) continue;
            const meta = existsSync(join(dir, 'vuelta.json')) ? JSON.parse(readFileSync(join(dir, 'vuelta.json'), 'utf8')) : { id, campaign: { id: '?', name: id } };
            const log = readLog(readFileSync(join(dir, 'registro.txt'), 'utf8'));
            const found = classify(log, { endCheck: null, exitCode: null });
            out.push({ ...meta, ...found, verdict: 'mal', reasons: ['La vuelta se cortó a medias (se cerró la ventana o el ordenador).', ...found.reasons], numbers: log.numbers, shots: shotsIn(dir), mainShot: mainShot(shotsIn(dir)) });
        } catch { /* una carpeta rota no tapa las demás */ }
    }
    return out.sort((a, b) => String(b.started ?? '').localeCompare(String(a.started ?? '')));
}

// ------------------------------------------------------------------ la vuelta en marcha

/** @type {null|{id: string, dir: string, campaign: any, fights: string, started: string, t0: number, child: any, text: string, stopped: boolean, timedOut: boolean, total: number, port: number, timer: any, command: string}} */
let current = null;
/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();
let lastClientAt = Date.now();
let everConnected = false;

/**
 * Manda un aviso a todas las ventanas abiertas (Server-Sent Events).
 *
 * @param {string} event
 * @param {any} data
 */
function broadcast(event, data) {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try { res.write(chunk); } catch { /* se ha cerrado */ }
    }
}

/** Lo que se sabe de la vuelta en marcha, para la ventana. */
function runningState() {
    if (!current) return null;
    const log = readLog(current.text);
    return {
        id: current.id, campaign: { id: current.campaign.id, name: current.campaign.name }, fights: current.fights,
        started: current.started, elapsed: Date.now() - current.t0, total: current.total, stopping: current.stopped,
        progress: progressOf(log), tail: current.text.split('\n').slice(-300).join('\n'),
    };
}

/**
 * Si un puerto está libre en 127.0.0.1.
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function portFree(port) {
    return new Promise(resolve => {
        const probe = createNetServer();
        probe.once('error', () => resolve(false));
        probe.once('listening', () => probe.close(() => resolve(true)));
        probe.listen(port, '127.0.0.1');
    });
}

/** El puerto del juego para la vuelta: el dado, o 8590 y siguientes. */
async function botPort() {
    if (BOT_PORT_GIVEN) return (await portFree(BOT_PORT_GIVEN)) ? BOT_PORT_GIVEN : 0;
    for (let port = BOT_PORT_DEFAULT; port < BOT_PORT_DEFAULT + 10; port++) if (await portFree(port)) return port;
    return 0;
}

/** Corta la vuelta y todo lo que ha abierto (su servidor del juego, su navegador). */
function killTree(/** @type {number} */ pid) {
    try { spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }); } catch { /* ya no está */ }
}

/**
 * El nombre de la carpeta de una vuelta: la fecha y la campaña.
 *
 * @param {string} campaignId
 * @returns {string}
 */
function runId(campaignId) {
    const d = new Date();
    const two = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}-${two(d.getSeconds())}`;
    let id = `${stamp}_${campaignId.replace(/[^\w-]+/g, '-')}`;
    for (let i = 2; existsSync(join(HISTORY, id)); i++) id = `${stamp}_${campaignId}-${i}`;
    return id;
}

/**
 * Empieza una vuelta.
 *
 * @param {{campaign: string, fights?: string, json?: {name: string, text: string}}} input
 * @returns {Promise<{ok: boolean, error?: string, id?: string}>}
 */
async function startRun(input) {
    if (current || starting) return { ok: false, error: 'Ya hay una vuelta en marcha. Espera a que acabe o párala.' };
    starting = true;
    try {
        return await launchRun(input);
    } finally {
        starting = false;
    }
}

/** Mientras se prepara una vuelta (antes de que haya `current`): un segundo «Correr» no cuenta. */
let starting = false;

/**
 * @param {{campaign: string, fights?: string, json?: {name: string, text: string}}} input
 * @returns {Promise<{ok: boolean, error?: string, id?: string}>}
 */
async function launchRun(input) {
    const campaign = campaigns().find(c => c.id === input?.campaign);
    if (!campaign) return { ok: false, error: 'Esa campaña no está en el menú.' };
    const fights = campaign.fights && input.fights === 'de-verdad' ? 'de-verdad' : 'rapidas';
    /** @type {any} */
    let pack = null;
    const text = String(input.json?.text ?? '');
    if (campaign.json) {
        if (!text.trim()) return { ok: false, error: 'Elige primero el archivo .json de tu campaña.' };
        try { pack = JSON.parse(text); } catch (error) {
            return { ok: false, error: `Ese archivo no es un JSON que se pueda leer: ${/** @type {any} */ (error)?.message ?? error}` };
        }
    }
    const port = await botPort();
    if (!port) return { ok: false, error: `El puerto del juego para el bot (${BOT_PORT_GIVEN || `${BOT_PORT_DEFAULT} a ${BOT_PORT_DEFAULT + 9}`}) está ocupado. ¿Hay otra vuelta abierta en otra ventana?` };
    const id = runId(campaign.id);
    const dir = join(HISTORY, id);
    mkdirSync(dir, { recursive: true });

    const args = [...campaign.args];
    let name = campaign.name;
    let total = 0;
    if (campaign.json) {
        const file = basename(String(input.json?.name || 'campana.json')).replace(/[^\w.-]+/g, '-').replace(/^-+/, '') || 'campana.json';
        const saved = join(dir, /\.json$/i.test(file) ? file : `${file}.json`);
        writeFileSync(saved, text);
        args.push(saved);
        name = String(pack?.world?.name || pack?.name || pack?.titulo || input.json?.name || name).slice(0, 80);
        total = milestonesOf(pack);
    } else if (campaign.pack) {
        try { total = milestonesOf(JSON.parse(readFileSync(join(ROOT, campaign.pack), 'utf8'))); } catch { total = 0; }
    } else if (campaign.board) {
        total = await seedMilestones(campaign.board);
    }
    if (fights === 'de-verdad') args.push('--peleas');
    args.push('--port', String(port), '--captura', join(dir, 'captura.png'));

    const started = new Date().toISOString();
    const meta = { id, campaign: { id: campaign.id, name, group: campaign.group }, fights, started, port, command: `node ${campaign.script} ${args.join(' ')}` };
    writeFileSync(join(dir, 'vuelta.json'), JSON.stringify(meta, null, 2));
    const out = createWriteStream(join(dir, 'registro.txt'));
    // VUELTA_VER: la vuelta dice cada paso (para la barra de avance); no cambia lo que hace.
    const child = spawn(process.execPath, [join(ROOT, campaign.script), ...args], {
        cwd: ROOT, env: { ...process.env, VUELTA_VER: '1', FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    current = { id, dir, campaign: { ...campaign, name }, fights, started, t0: Date.now(), child, text: '', stopped: false, timedOut: false, total, port, timer: null, command: meta.command };
    const run = current;
    say(`vuelta ${id}: ${meta.command}`);

    /** @type {string[]} */
    let pending = [];
    let partial = '';
    // Una letra con tilde puede llegar partida entre dos trozos: el decodificador la junta.
    const decoder = new StringDecoder('utf8');
    const take = (/** @type {Buffer} */ chunk) => {
        const text = partial + decoder.write(chunk);
        const lines = text.split(/\r?\n/);
        partial = lines.pop() ?? '';
        for (const line of lines) {
            run.text += `${line}\n`;
            pending.push(line);
        }
        out.write(chunk);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => say(`vuelta ${id}: no arranca: ${error}`));
    // Lo nuevo, a la ventana, cada medio segundo (no una vez por línea).
    const pump = setInterval(() => {
        if (pending.length === 0) return;
        broadcast('lineas', { id, lines: pending });
        pending = [];
        broadcast('avance', runningState());
    }, 500);
    run.timer = setTimeout(() => {
        run.timedOut = true;
        killTree(child.pid);
    }, MAX_RUN_MS);

    child.on('close', (/** @type {number|null} */ code) => {
        clearInterval(pump);
        clearTimeout(run.timer);
        if (partial) { run.text += `${partial}\n`; pending.push(partial); }
        if (pending.length) broadcast('lineas', { id, lines: pending });
        out.end();
        const log = readLog(run.text);
        const found = classify(log, { endCheck: run.campaign.endCheck, exitCode: code, stopped: run.stopped, timedOut: run.timedOut });
        const shots = shotsIn(dir);
        const ms = Date.now() - run.t0;
        const result = {
            ...meta,
            finished: new Date().toISOString(), ms, clock: clock(ms), exitCode: code,
            ...found,
            oneLine: log.oneLine,
            numbers: log.numbers, silences: log.silences, blocks: log.blocks, oddities: log.oddities, falls: log.falls,
            slow: log.slow, missing: log.missing, hooks: log.hooks, checks: log.checks,
            shots, mainShot: mainShot(shots),
        };
        try { writeFileSync(join(dir, 'resultado.json'), JSON.stringify(result, null, 2)); } catch (error) { say(`no se pudo guardar ${id}: ${error}`); }
        say(`vuelta ${id}: ${result.verdict} en ${result.clock}`);
        current = null;
        broadcast('fin', result);
    });
    broadcast('empieza', runningState());
    return { ok: true, id };
}

/** «Parar»: corta la vuelta en marcha. */
function stopRun() {
    if (!current) return false;
    current.stopped = true;
    killTree(current.child.pid);
    broadcast('avance', runningState());
    return true;
}

// ------------------------------------------------------------------ Windows: la ventana, la carpeta, el escritorio

/**
 * Abre la ventana: Edge en modo aplicación (sin barra de direcciones ni pestañas), con un perfil
 * suyo para no tocar tu navegador. Sin Edge, en el navegador de siempre.
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
    const args = [`--app=${url}`, `--user-data-dir=${EDGE_PROFILE}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--disable-features=Translate'];
    if (CDP_PORT) args.push(`--remote-debugging-port=${CDP_PORT}`);
    spawn(edge, args, { detached: true, stdio: 'ignore' }).unref();
}

// ------------------------------------------------------------------ el servidor de la ventana

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {any} data
 */
function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>}
 */
function body(req) {
    return new Promise((resolve) => {
        /** @type {Buffer[]} */
        const parts = [];
        let size = 0;
        req.on('data', (/** @type {Buffer} */ chunk) => {
            size += chunk.length;
            // Una campaña grande cabe de sobra en 40 MB.
            if (size < 40 * 1024 * 1024) parts.push(chunk);
        });
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { resolve({}); }
        });
    });
}

/** La última vez que se jugó cada campaña (y con qué peleas), para decir cuánto suele tardar. */
function lastTimes() {
    /** @type {Record<string, string>} */
    const out = {};
    for (const r of history()) {
        const key = `${r.campaign?.id}|${r.fights}`;
        if (!out[key] && r.clock && r.verdict !== 'parada') out[key] = r.clock;
    }
    return out;
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    try {
        if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
            res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
            res.end(readFileSync(join(HERE, 'app.html')));
            return;
        }
        if (req.method === 'GET' && path === '/api/hola') return json(res, 200, { app: 'probar-campanas', pid: process.pid });
        if (req.method === 'GET' && path === '/api/estado') {
            return json(res, 200, {
                campaigns: campaigns().map(({ id, name, group, note, fights, json: isJson }) => ({ id, name, group, note, fights, json: Boolean(isJson) })),
                running: runningState(), folder: DATA, lastTimes: lastTimes(), exe: existsSync(join(ROOT, EXE_NAME)),
            });
        }
        if (req.method === 'GET' && path === '/api/historial') return json(res, 200, history());
        if (req.method === 'GET' && path === '/api/eventos') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
            res.write(`event: hola\ndata: ${JSON.stringify(runningState())}\n\n`);
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
        const file = /^\/api\/archivo\/([^/]+)\/([^/]+)$/.exec(path);
        if (req.method === 'GET' && file) {
            const [, id, name] = file;
            const full = join(HISTORY, id, name);
            if (!SAFE.test(id) || !SAFE.test(name) || !existsSync(full)) return json(res, 404, { error: 'No está.' });
            res.writeHead(200, { 'Content-Type': TYPES[/** @type {keyof typeof TYPES} */ (extname(name).toLowerCase())] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(readFileSync(full));
            return;
        }
        if (req.method === 'POST' && path === '/api/correr') return json(res, 200, await startRun(await body(req)));
        if (req.method === 'POST' && path === '/api/parar') return json(res, 200, { ok: stopRun() });
        if (req.method === 'POST' && path === '/api/abrir') {
            openWindow(`http://127.0.0.1:${/** @type {any} */ (server.address()).port}/`);
            return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && path === '/api/carpeta') {
            const { id } = await body(req);
            const target = id && SAFE.test(String(id)) && existsSync(join(HISTORY, String(id))) ? join(HISTORY, String(id)) : DATA;
            spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
            return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && path === '/api/borrar') {
            const { id } = await body(req);
            if (!id || !SAFE.test(String(id)) || (current && current.id === id)) return json(res, 400, { ok: false });
            rmSync(join(HISTORY, String(id)), { recursive: true, force: true });
            return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && path === '/api/escritorio') return json(res, 200, desktopShortcut(ROOT));
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
    const ask = (/** @type {string} */ method, /** @type {string} */ where) => new Promise((resolve) => {
        const req = request({ host: '127.0.0.1', port: saved.port, path: where, method, timeout: 1500 }, (res) => {
            let text = '';
            res.on('data', (/** @type {Buffer} */ c) => { text += c; });
            res.on('end', () => resolve(text));
        });
        req.on('error', () => resolve(''));
        req.on('timeout', () => { req.destroy(); resolve(''); });
        req.end();
    });
    return ask('GET', '/api/hola').then(async (said) => {
        if (!/probar-campanas/.test(String(said))) return false;
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
    const url = `http://127.0.0.1:${port}/`;
    try { writeFileSync(STATE_FILE, JSON.stringify({ port, pid: process.pid })); } catch { /* nada */ }
    say(`ProbarCampañas en ${url} (resultados en ${DATA})`);
    openWindow(url);
    // Sin ventana abierta y sin vuelta en marcha, se apaga (con --sin-ventana, nunca).
    if (!NO_WINDOW) {
        setInterval(() => {
            if (current || clients.size > 0) return;
            // La primera vez se espera más: Edge tarda en abrir la ventana con un perfil nuevo.
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
// Si se cierra a la fuerza, que no se quede la vuelta (ni su servidor del juego) colgada.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, () => {
        if (current) killTree(current.child.pid);
        try { rmSync(STATE_FILE, { force: true }); } catch { /* nada */ }
        process.exit(0);
    });
}
