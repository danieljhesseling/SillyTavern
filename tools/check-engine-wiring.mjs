#!/usr/bin/env node
/**
 * Reports which game-engine modules the game itself never loads.
 *
 * Written after a status review found six modules — 1,541 lines with full test coverage —
 * that nothing outside the test suite imported. Every one of them was recorded as done.
 * Tests prove a module works; they say nothing about whether the game uses it, and the
 * difference is invisible in a green test run.
 *
 * This is a report, not a gate: a module can be legitimately unwired while it waits for
 * the interface that will call it. It exits 0 so CI never fails on work in progress. The
 * point is that the number is stated instead of assumed.
 *
 * Usage: node tools/check-engine-wiring.mjs
 * See wiki/POR_HACER.md and the N-10 proposal in wiki/archivo/PROPUESTAS_MEJORA.md.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ENGINE = join(ROOT, 'public/scripts/game-engine');
const SCRIPTS = join(ROOT, 'public/scripts');

/** Windows gives paths with its own separator; imports are always written with slashes. */
const slashes = (path) => path.split(sep).join('/');

/** Every .js file under a directory, recursively. */
function listJs(dir) {
    /** @type {string[]} */
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...listJs(full));
        else if (name.endsWith('.js')) out.push(full);
    }
    return out;
}

const engineFiles = listJs(ENGINE);

// Everything the app could import from, minus the engine itself: a module imported only
// by another engine module is still unreachable if nothing outside the engine calls in.
const appFiles = listJs(SCRIPTS)
    .filter(file => !file.startsWith(ENGINE))
    .concat([join(ROOT, 'public/script.js')]);

const appSource = appFiles.map(file => readFileSync(file, 'utf8')).join('\n');

/** Modules the app imports directly, by their path inside the engine. */
const reachable = new Set();
const queue = [];

for (const file of engineFiles) {
    const inEngine = slashes(relative(ENGINE, file));
    if (appSource.includes(`game-engine/${inEngine}`)) {
        reachable.add(file);
        queue.push(file);
    }
}

// Then whatever those modules pull in themselves.
while (queue.length) {
    const source = readFileSync(queue.pop(), 'utf8');
    for (const candidate of engineFiles) {
        if (reachable.has(candidate)) continue;
        if (source.includes(`/${basename(candidate)}`)) {
            reachable.add(candidate);
            queue.push(candidate);
        }
    }
}

// K6 de wiki/LO_QUE_FALTA.md: lo que solo usa una herramienta de `tools/` (el conversor del
// guion, por ejemplo) no es código muerto: es de la herramienta. Se dice aparte.
const TOOLS = join(ROOT, 'tools');
const toolSource = readdirSync(TOOLS)
    .filter(name => name.endsWith('.mjs') || name.endsWith('.js'))
    .map(name => readFileSync(join(TOOLS, name), 'utf8'))
    .join('\n');
const byTools = engineFiles.filter(file => !reachable.has(file) && toolSource.includes(slashes(relative(ENGINE, file))));

const unwired = engineFiles.filter(file => !reachable.has(file) && !byTools.includes(file));
const countLines = file => readFileSync(file, 'utf8').split('\n').length;
const show = file => slashes(relative(ROOT, file));

console.log(`Engine modules: ${engineFiles.length}`);
console.log(`Reached by the running game: ${reachable.size}`);
if (byTools.length > 0) {
    console.log(`Used by the tools only (not the game): ${byTools.length}`);
    for (const file of byTools.sort()) console.log(`  ${show(file)}`);
}

if (unwired.length === 0) {
    console.log('\nEvery engine module is reachable from the running game.');
    process.exit(0);
}

const total = unwired.reduce((sum, file) => sum + countLines(file), 0);
console.log(`\nTested but never loaded by the game: ${unwired.length} (${total} lines)\n`);
for (const file of unwired.sort()) {
    console.log(`  ${show(file)}  (${countLines(file)} lines)`);
}
console.log('\nNot a failure: a module may be waiting for the interface that will call it.');
console.log('It is a failure to record one of these as done. See wiki/POR_HACER.md.');
