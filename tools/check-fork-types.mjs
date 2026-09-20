#!/usr/bin/env node
/**
 * Type-check gate for the fork's own code.
 *
 * A plain `tsc --noEmit` over public/ reports ~3,600 errors, nearly all of them in
 * vendored libraries (public/lib, scripts/extensions/tts/lib) and in upstream files
 * we deliberately do not own. Gating on that number is impossible.
 *
 * This script runs the same type check but only fails on errors inside files the
 * fork created. Those are at zero and should stay there.
 *
 * Usage: node tools/check-fork-types.mjs
 * See wiki/ROADMAP.md, Bateria 1.
 */

import { spawnSync } from 'node:child_process';

/**
 * Files created by the fork. Upstream never touches these, so they are ours to keep clean.
 * Add new RPG-engine modules here as they appear.
 */
const FORK_FILES = [
    'public/scripts/party.js',
    'public/scripts/party/combat-rules.js',
    'public/scripts/party/types.js',
    'public/scripts/party/item-forms.js',
    'public/scripts/party/html.js',
    'public/scripts/dnd-system.js',
    'public/scripts/world-map-renderer.js',
    'public/scripts/dynamic-context-manager.js',
    'public/scripts/campaigns.js',
    'public/scripts/world-content-browser.js',
    'public/scripts/world-content-popups.js',
    'public/scripts/chat-enhancements.js',
    'public/scripts/active-instructions.js',
];

// Invoke the local compiler directly: no npx, no shell, no platform branching.
const tsc = new URL('../node_modules/typescript/bin/tsc', import.meta.url);
const result = spawnSync(
    process.execPath,
    [tsc.pathname.replace(/^\/([A-Za-z]:)/, '$1'), '--noEmit', '-p', 'public/jsconfig.json'],
    { encoding: 'utf8' },
);

const output = `${result.stdout || ''}${result.stderr || ''}`;
const lines = output.split('\n');

const owned = new Set(FORK_FILES);
const failures = lines.filter((line) => {
    const match = line.match(/^([^(]+)\(\d+,\d+\): error TS/);
    return match !== null && owned.has(match[1].replace(/\\/g, '/'));
});

if (failures.length > 0) {
    console.error(`\nType errors in fork-owned files: ${failures.length}\n`);
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    console.error('\nThese files are expected to type-check cleanly. Fix the errors or');
    console.error('add a narrowly scoped JSDoc cast — do not reintroduce // @ts-nocheck.\n');
    process.exit(1);
}

console.log(`Type check clean across ${FORK_FILES.length} fork-owned files.`);
