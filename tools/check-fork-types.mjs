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
    'public/scripts/game-engine/board/terrain.js',
    'public/scripts/game-engine/board/line-of-sight.js',
    'public/scripts/game-engine/board/fog-of-war.js',
    'public/scripts/game-engine/board/pathfinding.js',
    'public/scripts/game-engine/combat/turn-machine.js',
    'public/scripts/game-engine/combat/enemy-ai.js',
    'public/scripts/game-engine/combat/roll-guard.js',
    'public/scripts/game-engine/combat/initiative-tracker.js',
    'public/scripts/game-engine/combat/loot.js',
    'public/scripts/game-engine/combat/spawn.js',
    'public/scripts/game-engine/combat/loot-items.js',
    'public/scripts/game-engine/combat/seeded-random.js',
    'public/scripts/game-engine/combat/target-card.js',
    'public/scripts/game-engine/campaign/campaign-pack.js',
    'public/scripts/game-engine/campaign/campaign-importer.js',
    'public/scripts/game-engine/campaign/objective-editor.js',
    'public/scripts/game-engine/campaign/encounter-editor.js',
    'public/scripts/game-engine/ui/encounter-editor.js',
    'public/scripts/game-engine/rules/rule-impact.js',
    'public/scripts/game-engine/ui/objective-editor.js',
    'public/scripts/game-engine/ui/contradiction-log.js',
    'public/scripts/game-engine/combat/bond-perks.js',
    'public/scripts/game-engine/combat/scenario-board.js',
    'public/scripts/game-engine/ui/combat-log.js',
    'public/scripts/game-engine/ui/chat-channel.js',
    'public/scripts/game-engine/ui/rules-editor.js',
    'public/scripts/game-engine/ui/prompt-preview.js',
    'public/scripts/game-engine/cost/prompt-meter.js',
    'public/scripts/game-engine/cost/prompt-order.js',
    'public/scripts/game-engine/rules/editor-model.js',
    'public/scripts/game-engine/world-builder/world-schema.js',
    'public/scripts/game-engine/ui/sandbox.js',
    'public/scripts/game-engine/ui/campaign-wizard.js',
    'public/scripts/game-engine/campaign/starter-templates.js',
    'public/scripts/game-engine/campaign/campaign-worlds.js',
    'public/scripts/game-engine/campaign/campaign-view.js',
    'public/scripts/game-engine/campaign/campaign-pack-schema.js',
    'public/scripts/game-engine/ui/campaign-schema-panel.js',
    'public/scripts/game-engine/ui/campaign-panel.js',
    'public/scripts/game-engine/ui/shell/scene-director.js',
    'public/scripts/game-engine/ui/shell/game-shell.js',
    'public/scripts/game-engine/ui/shell/dialogue-scene.js',
    'public/scripts/game-engine/ui/shell/exploration-scene.js',
    'public/scripts/game-engine/ui/shell/party-strip.js',
    'public/scripts/game-engine/rules/level-up.js',
    'public/scripts/game-engine/rules/abilities.js',
    'public/scripts/game-engine/combat/condition-timers.js',
    'public/scripts/game-engine/ui/abilities-panel.js',
    'public/scripts/game-engine/campaign/campaign-export.js',
    'public/scripts/game-engine/ui/shell/scene-audio.js',
    'public/scripts/game-engine/ui/audio-settings.js',
    'public/scripts/game-engine/ui/shell/clock-widget.js',
    'public/scripts/game-engine/ui/shell/action-chips.js',
    'public/scripts/game-engine/ui/shell/companion-card.js',
    'public/scripts/game-engine/rules/ruleset.js',
    'public/scripts/game-engine/rules/default-ruleset.js',
    'public/scripts/game-engine/rules/rest.js',
    'public/scripts/game-engine/campaign/calendar.js',
    'public/scripts/game-engine/campaign/bonds.js',
    'public/scripts/game-engine/campaign/scenarios.js',
    'public/scripts/game-engine/campaign/campaign-map.js',
    'public/scripts/party/combat-rules.js',
    'public/scripts/party/types.js',
    'public/scripts/party/item-forms.js',
    'public/scripts/party/html.js',
    'public/scripts/party/positions.js',
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
