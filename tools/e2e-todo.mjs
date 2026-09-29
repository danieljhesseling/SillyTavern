#!/usr/bin/env node
/**
 * Todas las pruebas a la vez (pedido por Daniel el 2026-09-28: «¿puedes poner algunos tests
 * a la vez?»).
 *
 * Cada e2e arranca su propio servidor, en su puerto y con sus datos en una carpeta temporal,
 * así que no se pisan entre ellos ni tocan tu partida del puerto 8000. La vuelta larga va en
 * dos mitades (`e2e-campaign.mjs --parte a` y `--parte b`), que también corren a la vez.
 *
 * Uso:
 *   node tools/e2e-todo.mjs            # unitarios, rápido, sin modelo, el gremio y la vuelta larga en dos mitades
 *   node tools/e2e-todo.mjs --rapido   # sin la vuelta larga: lo de cada cambio
 *
 * Cada prueba escribe su registro entero en una carpeta temporal, que se dice al final; aquí
 * solo sale cuándo acaba cada una y, al final, lo que ha fallado.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, createWriteStream, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const QUICK = process.argv.includes('--rapido');
const logs = mkdtempSync(join(tmpdir(), 'st-pruebas-'));

/**
 * @typedef {object} Job
 * @property {string} name
 * @property {string[]} args Para `node`.
 * @property {string} [cwd]
 * @property {'jest'|'e2e'} kind Cómo se lee su resultado.
 */

/** @type {Job[]} */
const jobs = [
    // Pocos hilos: comparten la máquina con cuatro navegadores.
    { name: 'unitarios', kind: 'jest', cwd: join(ROOT, 'tests'),
        args: ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', 'jest.config.json', '--maxWorkers=4'] },
    { name: 'e2e rápido', kind: 'e2e', args: ['tools/e2e-quick.mjs'] },
    { name: 'sin modelo', kind: 'e2e', args: ['tools/e2e-sin-modelo.mjs'] },
    { name: 'gremio', kind: 'e2e', args: ['tools/e2e-gremio.mjs'] },
    // J2.3: saltar la prueba de la bodega. Corto: el personaje, saltarla y el tablón.
    { name: 'saltar la prueba', kind: 'e2e', args: ['tools/e2e-saltar-prueba.mjs'] },
    ...(QUICK ? [] : /** @type {Job[]} */ ([
        { name: 'vuelta 1-48', kind: 'e2e', args: ['tools/e2e-campaign.mjs', '--parte', 'a', '--port', '8126'] },
        { name: 'vuelta 49-73', kind: 'e2e', args: ['tools/e2e-campaign.mjs', '--parte', 'b', '--port', '8127'] },
    ])),
];

/**
 * @param {number} ms
 * @returns {string}
 */
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

/**
 * Lo que dice un registro: cuántas bien, cuántas mal y cuáles.
 *
 * @param {Job} job
 * @param {string} text
 * @returns {{ok: number, bad: number, failed: string[]}}
 */
function readLog(job, text) {
    if (job.kind === 'jest') {
        const line = text.match(/^Tests:\s+(.+)$/m)?.[1] ?? '';
        const ok = Number(line.match(/(\d+) passed/)?.[1] ?? 0);
        const bad = Number(line.match(/(\d+) failed/)?.[1] ?? 0);
        const failed = [...text.matchAll(/^\s+● (.+)$/gm)].map(m => m[1].trim());
        return { ok, bad, failed: [...new Set(failed)] };
    }
    const lines = text.split(/\r?\n/);
    const ok = lines.filter(l => l.startsWith('PASS')).length;
    const failed = [];
    lines.forEach((line, i) => {
        if (!line.startsWith('FAIL')) return;
        const detail = (lines[i + 1] ?? '').trim().startsWith('->') ? ` ${lines[i + 1].trim()}` : '';
        failed.push(`${line.slice(4).trim()}${detail}`.slice(0, 400));
    });
    for (const line of lines) if (line.startsWith('WAIT')) failed.push(line.slice(4).trim().slice(0, 300));
    return { ok, bad: failed.length, failed };
}

/**
 * @param {Job} job
 * @returns {Promise<{job: Job, code: number, ms: number, log: string}>}
 */
function run(job) {
    const started = Date.now();
    const log = join(logs, `${job.name.replace(/[^a-z0-9]+/gi, '-')}.log`);
    const out = createWriteStream(log);
    console.log(`▶ ${job.name}`);
    return new Promise(resolve => {
        const child = spawn(process.execPath, job.args, { cwd: job.cwd ?? ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.pipe(out, { end: false });
        child.stderr.pipe(out, { end: false });
        child.on('close', (code) => {
            out.end(() => resolve({ job, code: code ?? 1, ms: Date.now() - started, log }));
        });
    });
}

const started = Date.now();
const results = await Promise.all(jobs.map(job => run(job).then(result => {
    const seen = readLog(job, readFileSync(result.log, 'utf8'));
    const fine = result.code === 0 && seen.bad === 0;
    console.log(`${fine ? '✔' : '✘'} ${job.name} (${clock(result.ms)}): ${seen.ok} bien${seen.bad ? `, ${seen.bad} mal` : ''}`);
    return { ...result, ...seen, fine };
})));

console.log(`\n=== Todo en ${clock(Date.now() - started)} ===`);
for (const r of results) {
    if (r.fine) continue;
    console.log(`\n--- ${r.job.name}: lo que falló ---`);
    if (r.failed.length === 0) console.log(`  (salió con código ${r.code} sin decir qué: mira el registro)`);
    for (const line of r.failed) console.log(`  ${line}`);
}
console.log(`\nRegistros: ${logs}`);
const allFine = results.every(r => r.fine);
console.log(allFine ? '\nTODO BIEN' : `\n${results.filter(r => !r.fine).length} PRUEBA(S) CON FALLOS`);
process.exit(allFine ? 0 : 1);
