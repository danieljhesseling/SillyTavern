#!/usr/bin/env node
/**
 * Fails when the shape of the prompt changes without anybody saying so.
 *
 * What a turn sends is assembled from a dozen places — the rule pack, the world, the
 * party sheet, the board, whatever the model asked to have injected — and the order they
 * arrive in decides whether a provider can reuse the beginning of the request. Change a
 * key by accident and the cache stops paying, silently, and the only sign is a bill that
 * grows.
 *
 * So the order and the tiers are written down here as a snapshot, and this compares the
 * engine against it. It checks the **shape** — which blocks exist, in what order, under
 * what tier — and never the text, because the text is supposed to change every turn.
 *
 * Usage:
 *   node tools/check-prompt-shape.mjs             # compare
 *   node tools/check-prompt-shape.mjs --update    # accept the current shape
 *
 * See wiki/ROADMAP.md, Transversales (T1) · wiki/POR_HACER.md.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const SNAPSHOT = new URL('prompt-shape.snapshot.json', import.meta.url);
const UPDATE = process.argv.includes('--update');

const order = await import(pathToFileURL(
    new URL('public/scripts/game-engine/cost/prompt-order.js', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
).href);

/**
 * The blocks this game injects, named the way the application names them.
 *
 * Adding one here is the point: a new injected block has to be declared, which is the
 * moment somebody decides where in the order it belongs.
 */
const BLOCKS = [
    { source: 'ctx', id: 'meta', tier: 'rules', what: 'Instruccion maestra del sistema' },
    { source: 'ctx', id: 'length', tier: 'rules', what: 'El largo de la narracion elegido en la partida (idea 149)' },
    { source: 'ctx', id: 'relationships', tier: 'npc', what: 'Vinculos con los companeros' },
    { source: 'ctx', id: 'quests', tier: 'quest', what: 'Misiones en curso' },
    { source: 'ctx', id: 'memory', tier: 'quest', what: 'Lo que el mundo sabe del grupo: hechos, reputacion, deudas' },
    { source: 'ctx', id: 'board', tier: 'combat', what: 'Tablero y posiciones' },
    { source: 'ctx', id: 'body', tier: 'combat', what: 'Como esta el grupo: vida, heridas, cansancio (C1)' },
    { source: 'ctx', id: 'retry', tier: 'combat', what: 'Una sola vez: rehacer la ultima respuesta mas corta o mas intensa (idea 150)' },
    { source: 'dyn', id: 'ejemplo_reglas', tier: 'rules', what: 'Instruccion dinamica de reglas' },
    { source: 'dyn', id: 'ejemplo_combate', tier: 'combat', what: 'Instruccion dinamica de combate' },
    { source: 'instr', id: 'ejemplo_custom', tier: 'custom', what: 'Instruccion activa del jugador' },
];

const shape = {
    tiers: order.PROMPT_TIERS.map(tier => ({ id: tier.id, order: tier.order })),
    blocks: order.sortLikeSillyTavern(
        BLOCKS.map(block => order.promptKey(block.tier, block.id, block.source)),
    ).map(key => {
        const block = BLOCKS.find(b => order.promptKey(b.tier, b.id, b.source) === key);
        return { key, tier: block?.tier ?? '?', what: block?.what ?? '?' };
    }),
};

if (UPDATE || !existsSync(SNAPSHOT)) {
    writeFileSync(SNAPSHOT, `${JSON.stringify(shape, null, 2)}\n`, 'utf8');
    console.log(`Snapshot ${existsSync(SNAPSHOT) ? 'actualizado' : 'creado'}: ${shape.blocks.length} bloques.`);
    process.exit(0);
}

const stored = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const current = JSON.stringify(shape, null, 2);
const expected = JSON.stringify(stored, null, 2);

if (current === expected) {
    console.log(`La forma del prompt no ha cambiado: ${shape.blocks.length} bloques, `
        + `${shape.tiers.length} niveles, el tablero el ultimo.`);
    process.exit(0);
}

console.error('\nLa forma del prompt ha cambiado.\n');
console.error('Esperado:');
console.error(expected);
console.error('\nAhora:');
console.error(current);
console.error('\nSi el cambio es intencionado, acepta la nueva forma:');
console.error('  node tools/check-prompt-shape.mjs --update\n');
console.error('Y explica en el commit por que se movio, porque mover un bloque hacia');
console.error('delante invalida la cache de todo lo que venga detras.\n');
process.exit(1);
