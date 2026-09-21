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

    /** Back to the welcome screen the way a player gets there: close the chat. */
    const closeChat = async () => {
        await page.locator('#options_button').click({ timeout: 10000 });
        // This id appears more than once in the DOM; only one copy is on screen.
        await page.locator('#option_close_chat').filter({ visible: true }).first().click({ timeout: 10000 });
        await page.waitForSelector('#cw-new-campaign', { timeout: 30000 });
        await page.waitForTimeout(800);
    };

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
    await closeChat();
    check('the campaign is listed with Continue',
        await page.locator('.campaign-card .campaign-continue').count() >= 1);

    step('7. The blank canvas: generate a world, review it, and play it');
    // Driven with a stand-in provider, so this costs nothing and stays deterministic.
    // Everything after the provider is the real thing: the schema, the repair pass, the
    // preview, the wizard, and the same world builders a hand-written template uses.
    // The answer below is deliberately sloppy — ragged rows, a stray symbol, an invented
    // tactical profile, a duplicate name — because that is what models actually return.
    await page.evaluate(async () => {
        const [{ askWizard }, { generateWorld }, { Popup, POPUP_TYPE }] = await Promise.all([
            import('/scripts/game-engine/ui/campaign-wizard.js'),
            import('/scripts/game-engine/world-builder/world-schema.js'),
            import('/scripts/popup.js'),
        ]);

        const sloppy = JSON.stringify({
            name: 'Cripta de Sal',
            genre: 'Terror gótico',
            description: 'Una cripta inundada bajo una iglesia en ruinas.',
            locationName: 'Cripta de Sal',
            boardName: 'Nave anegada',
            map: [
                '############',
                '#..........#',
                '#..##..~..',
                '#...cX.....#',
                '#..........#',
                '############',
            ],
            enemies: [
                { name: 'Ghoul', hp: 22, armorClass: 12, cr: 1, profile: 'devorador' },
                { name: 'Ghoul', hp: 22, armorClass: 12, cr: 1, profile: 'aggressive' },
            ],
        });

        window.__wizard = { done: false, answers: null };
        askWizard({
            Popup,
            POPUP_TYPE,
            existingWorldNames: [],
            generateWorld: (idea, partySize) => generateWorld({
                idea,
                partySize,
                generate: async () => sloppy,
            }),
        }).then(answers => { window.__wizard = { done: true, answers }; });
    });

    await page.waitForSelector('.cw-template-ai', { timeout: 15000 });
    check('the wizard offers to generate the world with AI', true);

    await page.locator('.cw-template-ai').click();
    await page.fill('.cw-ai textarea.cw-input', 'una cripta inundada con cultistas');
    await page.locator('.cw-ai-go').click();

    await page.waitForSelector('.cw-ai-map', { timeout: 20000 });
    const mapRows = (await page.locator('.cw-ai-map').innerText()).trim().split('\n');
    const widths = new Set(mapRows.map(r => r.length));

    check('the generated board is shown before anything is created', mapRows.length >= 5, `${mapRows.length} rows`);
    check('its ragged rows were squared off', widths.size === 1, `widths: ${[...widths].join(',')}`);
    check('its open edge was sealed into wall',
        mapRows.every(r => r.startsWith('#') && r.endsWith('#'))
        && /^#+$/.test(mapRows[0]) && /^#+$/.test(mapRows[mapRows.length - 1]));
    check('the repairs are reported rather than done silently',
        await page.locator('.cw-ai-warn').count() >= 2,
        `${await page.locator('.cw-ai-warn').count()} warnings`);
    check('the world name was carried into step 2',
        (await page.inputValue('.cw-root input.cw-input >> nth=0')).includes('Cripta de Sal'));

    // Accept it, then build the world through the very same createCampaign the wizard
    // uses. Driving askWizard directly means this test owns the glue that campaigns.js
    // normally owns, so the world is then started from its card like any other: that is
    // the real path, and the part worth proving.
    await page.click('.popup-button-ok');
    const built = await page.evaluate(async () => {
        const [{ createCampaign }, wi] = await Promise.all([
            import('/scripts/game-engine/ui/campaign-wizard.js'),
            import('/scripts/world-info.js'),
        ]);

        for (let i = 0; i < 100 && !window.__wizard.done; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!window.__wizard.answers) return { error: 'the wizard returned nothing' };

        try {
            const created = await createCampaign({
                answers: window.__wizard.answers,
                createWorld: name => wi.createNewWorldInfo(name, { interactive: false }),
                loadWorld: wi.loadWorldInfo,
                saveWorld: (name, data) => wi.saveWorldInfo(name, data, true),
                createEntry: wi.createWorldInfoEntry,
            });

            const data = await wi.loadWorldInfo(created.worldName);
            const board = data.metadata.locationMaps[0].boards[0];
            return {
                worldName: created.worldName,
                locationName: created.locationName,
                boardName: created.boardName,
                party: created.party,
                walls: Object.values(board.terrain.cells).filter(c => c.type === 'wall').length,
                encounterRules: (board.encounterRules || []).length,
                monsters: Object.values(data.entries).filter(e => e.group === 'Monsters').length,
            };
        } catch (error) {
            return { error: String(error?.message || error) };
        }
    });

    check('the generated world is built through the same createCampaign as a template',
        !built.error, built.error || '');
    check('it kept the name, location and board the model described',
        built.worldName === 'Cripta de Sal' && built.boardName === 'Nave anegada',
        `${built.worldName} / ${built.locationName} / ${built.boardName}`);
    check('its repaired map became real terrain', built.walls > 20, `${built.walls} wall cells`);
    check('its enemies are in the Lorebook and reachable by /fight',
        built.monsters === 2 && built.encounterRules === 2,
        `${built.monsters} monsters, ${built.encounterRules} encounter rules`);

    step('8. The generated world is started from its card, like any other');
    await closeChat();
    const aiCard = page.locator('.campaign-card-unstarted[data-world="Cripta de Sal"]');
    check('it is listed as a campaign that was never played', await aiCard.count() === 1);

    await aiCard.locator('.campaign-start').click();
    await page.waitForSelector('.party-picker-container', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.click('.popup-button-ok');
    await page.waitForTimeout(2500);

    const aiState = await readState();
    const aiWalls = await page.locator('.wm-terrain-wall').filter({ visible: true }).count();
    check('you end up on the board the model generated',
        aiState.world === 'Cripta de Sal' && aiState.board === 'Nave anegada',
        `${aiState.world} · ${aiState.location} / ${aiState.board}`);
    check('drawn with the walls it generated', aiWalls > 20, `${aiWalls} wall cells`);

    step('9. The rules editor: add a damage type without touching any code');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/rules');
    });
    await page.waitForSelector('.rx-root', { timeout: 20000 });

    const sectionCount = await page.locator('.rx-nav-item').count();
    check('every editable section is offered', sectionCount >= 20, `${sectionCount} sections`);
    check('the first one is what you came for: damage types',
        (await page.locator('.rx-nav-item').first().innerText()).includes('Tipos de daño'));

    const before = await page.locator('.rx-table .rx-row').count();
    await page.locator('.rx-add').click();
    const rows = page.locator('.rx-table .rx-row');
    await rows.last().locator('.rx-input').first().fill('void');
    await rows.last().locator('.rx-input').nth(1).fill('Vacío');
    check('a row can be added to the table', await rows.count() === before + 1);

    await page.locator('.rx-actions .menu_button').first().click();
    await page.waitForTimeout(400);
    check('applying the section reports success rather than failing quietly',
        await page.locator('.rx-ok').count() === 1,
        await page.locator('.rx-status').innerText());
    check('the section is marked as changed from the built-in rules',
        await page.locator('.rx-nav-item.modified').count() >= 1);

    await page.click('.popup-button-ok');
    await page.waitForTimeout(2500);

    // Saved into the world, which is where a campaign's rules belong: exporting the
    // world takes them along, and two campaigns can disagree about what a weapon is.
    const saved = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const pack = data?.metadata?.rulesetPack ?? null;
        const stored = window.localStorage.getItem('sillytavern_activeRulesetPack');
        return {
            damageTypes: pack?.items?.damageTypes ?? null,
            remembered: stored ? JSON.parse(stored)?.items?.damageTypes ?? null : null,
        };
    });

    check('the new damage type is stored in the campaign world',
        JSON.stringify(saved.damageTypes || []).includes('void'),
        JSON.stringify(saved.damageTypes));
    // dnd-system binds its tables at load, so the pack has to be waiting before the next
    // one. That is what makes "the campaign's own rules" possible at all.
    check('and remembered so the next page load starts with it',
        JSON.stringify(saved.remembered || []).includes('void'));

    const reloadToast = await page.locator('#toast-container .toast', { hasText: 'Recarga' }).count();
    check('you are told a reload is needed rather than left wondering', reloadToast >= 1);

    step('10. The prompt preview: see what a turn actually sends');
    // No provider is connected here, so the turn is fed in directly. What is exercised is
    // everything after the request is built: the split into named blocks, the ordering,
    // the fixed-versus-conversation ratio and the session total.
    await page.evaluate(async () => {
        const { recordPrompt, resetSession } = await import('/scripts/game-engine/ui/prompt-preview.js');
        resetSession();
        recordPrompt({
            messages: [
                { role: 'system', content: 'Eres el narrador de una campaña. '.repeat(60) },
                { role: 'system', content: '[DYN_COMBAT: Tono urgente] Frases cortas.' },
                { role: 'system', content: 'Lyra HP: 12/12 AC: 15 Inventario: espada corta' },
                { role: 'user', content: 'Ataco al ghoul' },
            ],
        }, false);
    });

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/prompt');
    });
    await page.waitForSelector('.pp-root', { timeout: 20000 });

    const blockCount = await page.locator('.pp-block').count();
    const labels = await page.locator('.pp-block-label').allInnerTexts();
    check('the turn is broken into named blocks', blockCount >= 3, labels.join(' · '));
    check('the blocks it names are the ones the fork injects',
        labels.includes('Contexto dinámico') && labels.includes('Ficha del grupo'), labels.join(' · '));

    const sizes = await page.locator('.pp-block-tokens').allInnerTexts();
    const numbers = sizes.map(s => parseInt(s, 10));
    check('and they are sorted biggest first, which is the question being asked',
        numbers.every((n, i) => i === 0 || numbers[i - 1] >= n), numbers.join(' > '));

    const splitText = await page.locator('.pp-split').innerText();
    check('it states how much is context resent every turn', /Contexto fijo/.test(splitText), splitText.trim());
    check('the session total is shown', (await page.locator('.pp-session').innerText()).includes('turno'));
    // The figures are the app's own, not the provider's. Saying so is the point.
    check('and it says plainly that these are its own numbers, not a bill',
        /no la factura/.test(await page.locator('.pp-warning').innerText()));

    await page.click('.popup-button-ok');
    await page.waitForTimeout(500);

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
