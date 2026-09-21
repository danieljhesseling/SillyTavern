#!/usr/bin/env node
/**
 * Walks the campaign flow in a real browser, against a server of its own.
 *
 * Unit tests said the campaign wizard worked. It did not: it created a world but no chat,
 * so the campaign never appeared; and it wrote starting positions that nothing read, so
 * characters stood on walls. Both passed every assertion, because the tests checked the
 * data the wizard produced rather than what the game did with it. This script checks the
 * second thing, which is the only one a player can see.
 *
 * It never touches your own data. It starts SillyTavern on its own port with a temporary
 * --dataRoot, runs against that, and deletes it afterwards. Your own server on port 8000
 * can stay open while this runs.
 *
 * Requirements: Microsoft Edge (used as installed, nothing is downloaded) and the test
 * dependencies (npm ci --prefix tests), which bring Playwright.
 *
 * Usage:
 *   node tools/e2e-campaign.mjs               # headless
 *   node tools/e2e-campaign.mjs --headed      # watch it happen
 *   node tools/e2e-campaign.mjs --keep        # keep the temp data dir for inspection
 *
 * See wiki/POR_HACER.md and the N-09 proposal in wiki/PROPUESTAS_MEJORA.md.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, '$1');
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;
const HEADED = process.argv.includes('--headed');
const KEEP = process.argv.includes('--keep');

// Playwright lives with the test dependencies, not the app's.
const require = createRequire(join(ROOT, 'tests/package.json'));
let chromium;
try {
    ({ chromium } = require('@playwright/test'));
} catch {
    console.error('Playwright is missing. Run:  npm ci --prefix tests');
    process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        -> ${detail}` : ''}`);
};
const step = title => console.log(`\n=== ${title} ===`);

const dataRoot = mkdtempSync(join(tmpdir(), 'st-e2e-'));
console.log(`Temporary data root: ${dataRoot}`);

let server = null;
let browser = null;

/** Starts the app and resolves once it answers. */
function startServer() {
    // Assigned before the promise: if start-up times out, the finally block still has
    // something to kill. Not doing this left a server holding the port and the pipe.
    server = spawn(process.execPath, ['server.js', '--port', String(PORT), '--dataRoot', dataRoot], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const child = server;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 90s')), 90000);
        const watch = (buffer) => {
            const text = String(buffer);
            if (text.includes(String(PORT)) || text.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                // The port is open a moment before the app is ready to serve.
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', code => reject(new Error(`the server exited with code ${code}`)));
    });
}

try {
    await startServer();
    console.log(`Server up on ${BASE}`);

    browser = await chromium.launch({ channel: 'msedge', headless: !HEADED });
    const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await context.newPage();

    const problems = new Set();
    page.on('pageerror', e => problems.add(`PAGEERROR ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error') problems.add(`ERROR ${m.text().slice(0, 200)}`);
    });

    /** What the game holds for the chat that is currently open. */
    const readState = () => page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const meta = ctx.chatMetadata || {};
        return {
            world: meta.world_info,
            party: meta.party,
            location: meta.currentLocation,
            board: meta.currentBoard,
        };
    });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

    // A fresh data root opens SillyTavern's own first-run dialog.
    const firstRun = page.locator('text=Welcome to SillyTavern!');
    if (await firstRun.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#cw-new-campaign', { timeout: 90000 });

    step('1. The welcome screen offers to start a campaign');
    check('the New campaign button is on the welcome screen',
        await page.locator('#cw-new-campaign').count() === 1);

    step('2. The wizard creates a world, a chat, and puts the party on the board');
    await page.click('#cw-new-campaign');
    await page.waitForSelector('.cw-root');
    const proposed = await page.inputValue('.cw-root input.cw-input >> nth=0');
    check('it proposes a free name instead of demanding one', Boolean(proposed), `proposed "${proposed}"`);

    await page.fill('.cw-root textarea.cw-input >> nth=1', 'Lyra\nBrand');
    await page.click('.popup-button-ok');

    const toast = page.locator('#toast-container .toast', { hasText: 'creada' });
    await toast.first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    const toastText = ((await toast.count()) ? await toast.first().innerText() : 'NO TOAST').replace(/\s+/g, ' ');
    check('the campaign is created and the toast says where you are', /Estás en/.test(toastText), toastText);

    // The three failures the unit tests could not see, one check each.
    await page.waitForTimeout(1500);
    const state = await readState();
    const walls = await page.locator('.wm-terrain-wall').filter({ visible: true }).count();
    const tokens = await page.locator('.wm-token').filter({ visible: true }).count();
    const positions = (state.party || []).map(m => `${m?.name}(${m?.mapPosition?.gridX},${m?.mapPosition?.gridY})`);

    check('a chat exists and is bound to the new world', Boolean(state.world), `world_info=${state.world}`);
    check('the party is built from the world entries', (state.party || []).length === 2, positions.join('  '));
    check('nobody starts on (0,0), which is a wall in every template',
        positions.length > 0 && !positions.some(p => p.includes('(0,0)')), positions.join('  '));
    check('you are already on the first board, with no /go and no /enter',
        Boolean(state.location && state.board), `${state.location} / ${state.board}`);
    check('the board is on screen with its walls', walls > 20, `${walls} wall cells`);
    check('both characters are on it', tokens === 2, `${tokens} tokens`);

    /** Clicks through the dice overlay until it stops covering the page. */
    const clearDiceOverlay = async () => {
        for (let i = 0; i < 40; i++) {
            const next = page.locator('.wm-dice-overlay.active .wm-dice-next');
            if (await next.count() === 0) return;
            await next.click({ timeout: 4000 }).catch(() => {});
            await page.waitForTimeout(250);
        }
    };

    step('3. A door on the board opens when it is clicked');
    const door = page.locator('.wm-terrain-door').filter({ visible: true }).first();
    check('the closed door is drawn on the board', await door.count() === 1);
    if (await door.count() === 1) {
        await door.click({ timeout: 10000 });
        await page.waitForTimeout(700);
        check('clicking it leaves an open door behind',
            await page.locator('.wm-terrain-door-open').count() >= 1);
    }

    step('4. A combat logs to the board and leaves the model a summary it can read');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(2000);
    check('the combat log is mounted on the real board, not only in /sandbox',
        await page.locator('#world_location_maps_list .combat-log-panel').count() === 1);
    check('the log already holds the opening entries',
        await page.locator('#world_location_maps_list .cl-row').count() > 0,
        `${await page.locator('#world_location_maps_list .cl-row').count()} entries`);

    await clearDiceOverlay();

    // /combat-end ends the player's turn. Leaving the fight is /combat-stop, which is
    // what reaches endCombat and therefore the epilogue.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    // The defect this whole flow exists to catch: the epilogue was posted as a system
    // message, which the prompt filter drops, so the model never learned the fight had
    // happened. What matters is not that a message exists but that it is not is_system.
    const epilogue = await page.evaluate(() => {
        const chat = window.SillyTavern.getContext().chat || [];
        const mine = chat.filter(m => m?.extra?.model === 'game-engine');
        const last = mine[mine.length - 1];
        return last ? { isSystem: last.is_system, text: String(last.mes || '').slice(0, 120) } : null;
    });

    check('the combat leaves an epilogue in the chat', epilogue !== null);
    check('and it is NOT a system message, so the next prompt carries it',
        epilogue?.isSystem === false, `is_system=${epilogue?.isSystem} · "${epilogue?.text}"`);

    step('5. The combat sandbox opens with its own log');
    // Deliberately not awaited inside the page: /sandbox opens a popup whose promise only
    // settles when the popup is closed, so awaiting it here waits for a click that this
    // script has not made yet. The first run hung exactly there.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sandbox');
    });
    await page.waitForSelector('.combat-log-panel', { timeout: 20000 }).catch(() => {});
    check('the sandbox is on screen with a combat log',
        await page.locator('.combat-log-panel').count() >= 1);

    // Close it again, or the popup sits over everything the next step needs to click.
    await page.locator('.popup-button-close, .popup-button-ok').filter({ visible: true })
        .first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    step('6. A closed campaign is listed and can be continued');
    await page.locator('#options_button').click({ timeout: 10000 });
    // This id appears more than once in the DOM; only one copy is on screen.
    await page.locator('#option_close_chat').filter({ visible: true }).first().click({ timeout: 10000 });
    await page.waitForSelector('#cw-new-campaign', { timeout: 30000 });
    await page.waitForTimeout(800);
    check('the campaign is listed with Continue',
        await page.locator('.campaign-card .campaign-continue').count() >= 1);

    console.log(`\n--- console errors ---`);
    console.log(problems.size ? [...problems].join('\n') : '(none)');
} catch (error) {
    failures++;
    console.log(`FAIL  the run threw: ${error?.message || error}`);
} finally {
    if (browser) await browser.close().catch(() => {});
    if (server) {
        // Detach the pipes first: an inherited stdout keeps the calling shell waiting.
        server.stdout?.destroy();
        server.stderr?.destroy();
        server.kill('SIGKILL');
    }
    if (!KEEP) {
        // Windows holds the directory for a moment after the server dies.
        await new Promise(resolve => setTimeout(resolve, 1000));
        rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
    } else {
        console.log(`\nKept for inspection: ${dataRoot}`);
    }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
