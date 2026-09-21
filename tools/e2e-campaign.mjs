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

    /**
     * Plays one combat turn for whoever is up: close the distance, then attack.
     *
     * Written as a helper because three checks need it and each one that reimplemented it
     * got the same thing wrong — a single /combat-move only works if the target square is
     * already within this turn's movement, and where the enemy lands is rolled.
     *
     * @returns {Promise<'attacked'|'moved'|'passed'|'over'>}
     */
    const playOneTurn = () => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        if (!enc?.active) return 'over';

        const entry = enc.turnOrder?.[enc.currentTurnIndex];
        if (!entry || entry.isEnemy) {
            await ctx.executeSlashCommandsWithOptions('/combat-end');
            return 'passed';
        }

        const member = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry.id));
        const enemy = (enc.enemies || []).find(e => (e.currentHp || 0) > 0);
        if (!member || !enemy) {
            await ctx.executeSlashCommandsWithOptions('/combat-end');
            return 'passed';
        }

        const mx = member.mapPosition?.gridX ?? 0;
        const my = member.mapPosition?.gridY ?? 0;
        const dx = enemy.gridX - mx;
        const dy = enemy.gridY - my;

        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
            await ctx.executeSlashCommandsWithOptions(`/combat-attack ${enemy.name}`);
            return 'attacked';
        }

        // One step at a time towards it: a whole-way move is refused when the distance is
        // more than this turn's speed, and then nothing happens at all.
        const stepX = mx + Math.sign(dx);
        const stepY = my + Math.sign(dy);
        await ctx.executeSlashCommandsWithOptions(`/combat-move ${stepX + 1} ${stepY + 1}`);
        return 'moved';
    });

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
    // The picker binds its click handler a moment after the markup lands.
    await page.waitForTimeout(1500);
    const pickable = await page.locator('.party-card').count();
    for (let i = 0; i < Math.min(2, pickable); i++) {
        await page.locator('.party-card').nth(i).click();
    }
    check('the party picker offers the generated world characters', pickable >= 1, `${pickable} cards`);
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

    step('11. The initiative tracker: who acts, who is next, and what ails them');
    // The board panel has to be open for anything drawn in it to exist.
    if (await page.locator('#world_location_maps_list').count() === 0
        || !(await page.locator('#world_location_maps_list').isVisible().catch(() => false))) {
        await page.locator('#partyDrawerIcon').click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1200);
    }
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    // Conditions through the command a player would use, not by poking at the metadata:
    // the first attempt did the latter and never reached the party held in memory.
    const firstFighter = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return ctx.chatMetadata.party?.[0]?.name ?? '';
    });
    for (const condition of ['Poisoned', 'Prone']) {
        await page.evaluate(([name, cond]) => {
            void window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions(`/condition ${name} ${cond}`);
        }, [firstFighter, condition]);
        await page.waitForTimeout(600);
    }

    const trackerRows = await page.locator('.wm-init-row').count();
    check('the tracker lists every combatant', trackerRows >= 3, `${trackerRows} rows`);
    check('exactly one is marked as acting',
        await page.locator('.wm-init-row.current').count() === 1);
    check('and one as going next, never the same one',
        await page.locator('.wm-init-row.next').count() === 1
        && await page.locator('.wm-init-row.current.next').count() === 0);
    check('the round is stated instead of counted by hand',
        /Ronda \d/.test(await page.locator('.wm-init-round').innerText()),
        (await page.locator('.wm-init-head').innerText()).replace(/\s+/g, ' '));
    check('each combatant shows its health', await page.locator('.wm-init-hp-fill').count() >= 3);
    check('conditions are drawn as markers, in the tracker and on the board',
        await page.locator('.wm-init-status').count() >= 2
        && await page.locator('.wm-token-status').count() >= 2,
        `${await page.locator('.wm-init-status').count()} en el rastreador, `
        + `${await page.locator('.wm-token-status').count()} sobre las fichas`);

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();

    step('12. Winning is worth something');
    const purseBefore = await page.evaluate(() => {
        const party = window.SillyTavern.getContext().chatMetadata.party || [];
        return { gold: party.reduce((s, m) => s + (m.gold || 0), 0), xp: party.reduce((s, m) => s + (m.xp || 0), 0) };
    });

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();

    // Killed through the engine, not by editing state: the reward has to come from the
    // same path a real victory takes.
    for (let i = 0; i < 60; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        await page.waitForTimeout(what === 'attacked' ? 650 : 200);
        if (what === 'attacked') await clearDiceOverlay();
        // Ending the turn after acting keeps the order moving.
        if (what !== 'passed') {
            await page.evaluate(() => window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions('/combat-end'));
        }
    }
    await clearDiceOverlay();

    const purseAfter = await page.evaluate(() => {
        const party = window.SillyTavern.getContext().chatMetadata.party || [];
        return { gold: party.reduce((s, m) => s + (m.gold || 0), 0), xp: party.reduce((s, m) => s + (m.xp || 0), 0) };
    });

    const lootLine = await page.locator('#world_location_maps_list .cl-row', { hasText: 'Botín' }).count()
        + await page.locator('.mes_text', { hasText: 'Botín' }).count();

    // Whether the party wins is rolled, so what is checked is the rule: a victory pays,
    // and anything else does not. Asserting a win outright failed about one run in three.
    const won = await page.evaluate(() =>
        [...document.querySelectorAll('.mes_text')]
            .some(m => /ha ganado el combate|Objetivos cumplidos/.test(m.textContent || '')));

    check('the fight ended', await page.locator('.wm-combat-section').count() === 0);

    if (won) {
        check('winning makes the party richer', purseAfter.gold > purseBefore.gold,
            `${purseBefore.gold} -> ${purseAfter.gold}`);
        check('and earns experience', purseAfter.xp > purseBefore.xp,
            `${purseBefore.xp} -> ${purseAfter.xp}`);
        check('and the reward is announced, not applied in silence', lootLine >= 1,
            `${lootLine} líneas de botín`);
    } else {
        check('losing pays nothing', purseAfter.gold === purseBefore.gold,
            `perdieron: ${purseBefore.gold} -> ${purseAfter.gold}`);
        check('and nothing is announced either', lootLine === 0, `${lootLine} líneas de botín`);
    }

    step('13. The campaign panel: the day and the bonds, reachable at last');
    await page.locator('#rm_tab_campaign').click({ timeout: 10000 });
    await page.waitForSelector('.cp-clock', { timeout: 15000 });

    check('the campaign tab exists and opens', await page.locator('.cp-clock').count() === 1);
    check('it states the day and marks the part of it',
        /Día \d+/.test(await page.locator('.cp-day').innerText())
        && await page.locator('.cp-slot.current').count() === 1,
        (await page.locator('.cp-clock').innerText()).replace(/\s+/g, ' ').slice(0, 60));

    const bondCards = await page.locator('.cp-bond').count();
    check('every party member has a bond card', bondCards === 2, `${bondCards} cards`);
    check('each one lists the perks it will unlock, earned or not',
        await page.locator('.cp-bond').first().locator('.cp-perk').count() === 4);

    // Time moves, and the slot marker moves with it.
    const slotBefore = await page.locator('.cp-slot.current').innerText();
    await page.locator('.cp-clock-actions .menu_button').first().click();
    await page.waitForTimeout(900);
    const slotAfter = await page.locator('.cp-slot.current').innerText();
    check('passing the time moves the day on', slotBefore !== slotAfter, `${slotBefore} -> ${slotAfter}`);

    // A recorded event is the only way a bond moves: the narration never decides it.
    const rankBefore = await page.locator('.cp-bond').first().locator('.cp-bond-points').innerText();
    await page.locator('.cp-bond').first().locator('.cp-event').selectOption('saved_their_life');
    await page.locator('.cp-bond').first().locator('.cp-bond-actions .menu_button').click();
    await page.waitForTimeout(900);
    const rankAfter = await page.locator('.cp-bond').first().locator('.cp-bond-points').innerText();
    check('recording an event moves that bond', rankBefore !== rankAfter, `${rankBefore} -> ${rankAfter}`);

    // Sleeping rolls the day over, which is also what brings back the daily perks.
    const dayBefore = await page.locator('.cp-day').innerText();
    await page.locator('.cp-clock-actions .menu_button').last().click();
    await page.waitForTimeout(900);
    check('sleeping starts a new day', (await page.locator('.cp-day').innerText()) !== dayBefore,
        `${dayBefore} -> ${await page.locator('.cp-day').innerText()}`);

    // And it survives a reload, because it lives with the chat.
    const stored = await page.evaluate(() => {
        const meta = window.SillyTavern.getContext().chatMetadata || {};
        return { day: meta.calendar?.day ?? null, bonds: Object.keys(meta.bonds?.bonds ?? {}).length };
    });
    check('the day and the bonds are saved with the campaign',
        stored.day > 1 && stored.bonds >= 1, JSON.stringify(stored));

    step('14. The turn machine, now the one running the fight');
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    // The previous step may have left the party on the floor, and a fight cannot start
    // with nobody standing. Healing through the sheet is the player's own path.
    await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) {
            if ((member.hp || 0) <= 0) member.hp = member.maxHp || 10;
            member.activeConditions = (member.activeConditions || []).filter(c => c !== 'Unconscious');
        }
    });
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Ghoul 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    const turnShape = await page.evaluate(() => {
        const encounter = window.SillyTavern.getContext().chatMetadata.combatEncounter
            ?? window.SillyTavern.getContext().chatMetadata.combat ?? null;
        return encounter?.turnState ?? null;
    });
    check('a turn now tracks the action, the bonus action and the reaction',
        turnShape !== null
        && 'actionUsed' in turnShape && 'bonusActionUsed' in turnShape && 'reactionUsed' in turnShape,
        JSON.stringify(turnShape));

    check('the round counter is still running', /Ronda \d/.test(
        await page.locator('.wm-init-round').innerText().catch(() => '')));

    // Spending the action twice in one turn has to be refused, which is the whole reason
    // to have an action economy at all.
    // Getting into reach is itself rolled — who goes first, where the enemy lands — so
    // the check closes the distance the way a player would instead of assuming it. An
    // earlier version assumed, and failed every other run for no reason.
    // Walk the fight with the shared helper until somebody is in reach, then attack
    // twice: the second one has to be refused, which is what an action economy is for.
    // Whether anybody gets in reach at all is rolled too, so the loop reports what it
    // managed instead of leaving the checks below to fail for a reason that is not theirs.
    let reachedSomebody = false;
    for (let i = 0; i < 40; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        if (what === 'attacked') { reachedSomebody = true; break; }
        await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    await clearDiceOverlay();

    const spentTwice = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const first = ctx.chatMetadata.combatEncounter?.turnState?.actionUsed ?? null;
        const enemy = (ctx.chatMetadata.combatEncounter?.enemies || []).find(e => (e.currentHp || 0) > 0);
        if (enemy) await ctx.executeSlashCommandsWithOptions(`/combat-attack ${enemy.name}`);
        const refused = [...document.querySelectorAll('#toast-container .toast')]
            .some(t => /ya fue usada/.test(t.innerText));
        return { first, refused };
    });
    await page.waitForTimeout(500);
    await clearDiceOverlay();

    if (reachedSomebody) {
        check('attacking spends the action', spentTwice.first === true, JSON.stringify(spentTwice));
        check('and a second attack in the same turn is refused', spentTwice.refused === true,
            JSON.stringify(spentTwice));
    } else {
        console.log('SKIP  nadie llego al alcance en 40 turnos: la economia de accion la fijan los tests');
    }

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1200);
    await clearDiceOverlay();
    check('the fight still ends cleanly', await page.locator('.wm-combat-section').count() === 0);

    step('15. A bond that changes how a fight goes');
    // Raised through the real command, so the rank comes from recorded events like any
    // other: the point of the design is that nothing else may move a bond.
    const raised = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const names = (ctx.chatMetadata.party || []).map(m => m.name);
        for (let i = 0; i < 25; i++) {
            await ctx.executeSlashCommandsWithOptions(`/bond ${names[1]} saved_their_life`);
        }
        const bonds = ctx.chatMetadata.bonds?.bonds ?? {};
        const entry = Object.values(bonds).find(b => b.points >= 84);
        return { names, points: entry?.points ?? 0 };
    });
    check('a bond reaches rank 8 through recorded events alone',
        raised.points >= 84, JSON.stringify(raised));

    await page.locator('#rm_tab_campaign').click({ timeout: 10000 });
    await page.waitForTimeout(700);
    const unlocked = await page.locator('.cp-bond').last().locator('.cp-perk.unlocked').count();
    check('the panel shows the perks it has earned', unlocked >= 3, `${unlocked} unlocked`);

    // Whether a killing blow actually lands inside one test run is a matter of dice, so
    // what is checked here is the decision the engine makes from the bonds this campaign
    // really has saved. That the rescue then applies is covered by the unit tests; this
    // is the seam between the two that nothing else exercises.
    const decisions = await page.evaluate(async () => {
        const { planEndure, planFollowUp, planBatonPass } =
            await import('/scripts/game-engine/combat/bond-perks.js');
        const ctx = window.SillyTavern.getContext();
        const bonds = ctx.chatMetadata.bonds;
        const party = (ctx.chatMetadata.party || []).map(m => ({ id: m.id, name: m.name, hp: m.hp || 10 }));
        const leader = party[0];
        const helper = party[1];

        return {
            lethal: planEndure({
                bonds, party, targetId: String(leader.id), currentHp: 5, damage: 99,
            }),
            survivable: planEndure({
                bonds, party, targetId: String(leader.id), currentHp: 5, damage: 1,
            }),
            followUp: planFollowUp({
                bonds, party, attackerId: String(leader.id), canReach: () => true, random: () => 0,
            }),
            relay: planBatonPass({
                bonds, party, actorId: String(helper.id), remainingFeet: 15,
            }),
        };
    });

    check('with the bonds this campaign earned, a companion would take a killing blow',
        decisions.lethal !== null, JSON.stringify(decisions.lethal));
    check('and would not step in for a scratch', decisions.survivable === null);
    check('the rank-3 follow-up is available too', decisions.followUp !== null);
    check('and the rank-5 relay offers somebody', (decisions.relay || []).length >= 1,
        JSON.stringify(decisions.relay));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/combat-stop');
    });
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('16. A fight with a purpose: the scenario decides it');
    // Back to the *template* campaign specifically: the generated one has no mission,
    // because the AI is not asked for objectives yet.
    await closeChat();
    await page.locator('.campaign-card[data-world="Mazmorra clásica"] .campaign-continue')
        .first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(900);

    const board = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const first = data?.metadata?.locationMaps?.[0]?.boards?.[0];
        return { world: ctx.chatMetadata.world_info, objectives: (first?.objectives || []).map(o => o.label) };
    });
    check('the starter dungeon carries a mission, not just a brawl',
        board.objectives.length >= 1, JSON.stringify(board));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    const shown = await page.locator('.wm-objective').count();
    check('the objectives are shown where the fight is', shown >= 1, `${shown} objetivos`);
    check('and above the initiative order, because what the fight is for outranks whose turn it is',
        await page.evaluate(() => {
            const objectives = document.querySelector('.wm-objectives');
            const tracker = document.querySelector('.wm-init');
            if (!objectives || !tracker) return false;
            return (objectives.compareDocumentPosition(tracker) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }));

    // Win it, and the victory has to come from the objective being met.
    for (let i = 0; i < 60; i++) {
        const what = await playOneTurn();
        if (what === 'over') break;
        await page.waitForTimeout(what === 'attacked' ? 650 : 200);
        if (what === 'attacked') await clearDiceOverlay();
        if (what !== 'passed') {
            await page.evaluate(() => window.SillyTavern.getContext()
                .executeSlashCommandsWithOptions('/combat-end'));
        }
    }
    await clearDiceOverlay();

    check('the mission ends the fight', await page.locator('.wm-combat-section').count() === 0);
    const said = await page.evaluate(() =>
        [...document.querySelectorAll('.mes_text')].some(m => /Objetivos cumplidos/.test(m.textContent || '')));
    check('and says so as a mission accomplished, not just as a body count', said);

    step('17. The contract you paste into your Gem');
    // The rules-editor step leaves a toast open on purpose (it holds the reload button),
    // and it sits over the dialog this step clicks in.
    await page.evaluate(() => {
        document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/esquema-campana');
    });
    await page.waitForSelector('.cs-root', { timeout: 20000 });

    const tabs = await page.locator('.cs-tab').allInnerTexts();
    check('the contract opens with a view per thing you might copy', tabs.length >= 5, tabs.join(' · '));
    check('including the example of a correct pack', tabs.some(t => /Ejemplo/.test(t)));
    check('and one per section, because a book does not fit in one answer',
        tabs.filter(t => /Sección/.test(t)).length === 5);

    const instructions = await page.locator('.cs-text').inputValue();
    check('the instructions carry the schema and the version',
        instructions.includes('eliminate_all') && /Versión \d/.test(instructions),
        `${instructions.length} caracteres`);

    // The point of generating it: what you paste always matches what validates.
    const matches = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack-schema.js');
        const { OBJECTIVE_TYPES } = await import('/scripts/game-engine/campaign/scenarios.js');
        const schema = m.buildCampaignPackSchema();
        const types = schema.properties.quests.items.properties.objectives.items.properties.type.enum;
        return {
            same: JSON.stringify([...types].sort()) === JSON.stringify(Object.keys(OBJECTIVE_TYPES).sort()),
            asksForNames: Boolean(schema.properties.quests.items.properties.objectives.items.properties.target),
            asksForIds: Boolean(schema.properties.quests.items.properties.objectives.items.properties.targetIds),
        };
    });
    check('the objective types come from the engine, not from a copy',
        matches.same, JSON.stringify(matches));
    check('and it asks the author for names, never for ids a book cannot know',
        matches.asksForNames && !matches.asksForIds, JSON.stringify(matches));

    await page.locator('.cs-tab', { hasText: 'Ejemplo' }).click();
    await page.waitForTimeout(400);
    const example = await page.locator('.cs-text').inputValue();
    check('the example is valid JSON, as a sample of correct output must be',
        (() => { try { JSON.parse(example); return true; } catch { return false; } })());

    check('the rules a schema cannot express are stated too',
        await page.locator('.cs-rules li').count() >= 8,
        `${await page.locator('.cs-rules li').count()} reglas`);

    await page.click('.popup-button-ok');
    await page.waitForTimeout(500);

    step('18. El Modo Juego: el tablero a pantalla completa, y apagarlo no deja rastro');
    // Where the board panel lives logBefore the Shell touches it. Putting it back exactly
    // here is the whole promise of a layer that can be switched off.
    const home = await page.evaluate(() => {
        const panel = document.querySelector('#world_location_maps_row');
        return {
            parent: panel?.parentElement?.id || '',
            previous: panel?.previousElementSibling?.id || '',
            copies: document.querySelectorAll('#world_location_maps_row').length,
        };
    });

    // A fight to look at, with the party on its feet: an attack button that is disabled
    // because everyone is unconscious would prove nothing about the bar.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/fight Esqueleto 2');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(900);

    check('el Modo Juego se enciende con un comando', await page.locator('#game-shell').count() === 1);
    check('y la barra superior de SillyTavern se aparta mientras dura',
        await page.locator('#top-bar').isVisible().catch(() => false) === false);

    // The point of moving instead of copying: there is still exactly one board.
    const moved = await page.evaluate(() => ({
        copies: document.querySelectorAll('#world_location_maps_row').length,
        onStage: Boolean(document.querySelector('.gs-stage #world_location_maps_row')),
        inDrawer: Boolean(document.querySelector('#rm_party_block #world_location_maps_row')),
    }));
    check('el tablero se mueve al escenario, no se duplica',
        moved.copies === 1 && moved.onStage && !moved.inDrawer, JSON.stringify(moved));

    const shellWalls = await page.locator('#game-shell .wm-terrain-wall').count();
    const shellTokens = await page.locator('#game-shell .wm-token').count();
    check('el tablero se ve dentro del Shell, con sus muros', shellWalls > 20, `${shellWalls} muros`);
    check('y con los combatientes encima', shellTokens >= 3, `${shellTokens} fichas`);

    const shellTracker = await page.locator('#game-shell .wm-init-row').count();
    check('el rastreador de iniciativa lista a todo el mundo', shellTracker >= 3, `${shellTracker} filas`);
    check('la cabecera dice por que ronda va',
        /Ronda \d+/.test(await page.locator('.gs-head-state').innerText()),
        await page.locator('.gs-head-state').innerText());

    const scenes = await page.evaluate(() => [...document.querySelectorAll('.gs-scene-btn')]
        .map(b => ({ scene: b.dataset.scene, active: b.classList.contains('active'), disabled: b.disabled })));
    check('el conmutador marca la escena de combate como la activa',
        scenes.find(s => s.scene === 'combat')?.active === true, JSON.stringify(scenes));
    // La de dialogo existe desde H2; la de exploracion todavia no, y sale anunciada y
    // desactivada en vez de fingida. Cuando H4 la construya, esta linea cambia.
    check('la escena de dialogo esta disponible',
        scenes.find(s => s.scene === 'dialogue')?.disabled === false, JSON.stringify(scenes));
    check('y la que aun no existe sale anunciada, no fingida',
        scenes.find(s => s.scene === 'exploration')?.disabled === true, JSON.stringify(scenes));

    // The action bar either offers an attack or says why it cannot: which of the two it
    // is depends on the dice and on where the enemy AI walked, so the rule is what gets
    // checked, not the outcome.
    const readAttack = () => page.evaluate(() => {
        const button = document.querySelector('.gs-btn-attack');
        return { present: Boolean(button), enabled: Boolean(button && !button.disabled), why: button?.title || '' };
    });

    let attack = await readAttack();
    for (let i = 0; i < 12 && !attack.enabled; i++) {
        const state = await page.evaluate(() => window.SillyTavern.getContext().chatMetadata.combatEncounter?.active);
        if (!state) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDiceOverlay();
        attack = await readAttack();
    }

    check('la barra de acciones dice de quien es el turno',
        (await page.locator('.gs-turn-label').innerText()).length > 0);
    check('atacar esta disponible, o explica por que no',
        attack.present && (attack.enabled || attack.why.length > 0), JSON.stringify(attack));

    if (attack.enabled) {
        const logBefore = await page.locator('#game-shell .cl-row').count();
        await page.locator('.gs-btn-attack').click();
        await page.waitForSelector('.gs-targets .gs-target', { timeout: 5000 });
        const targets = await page.locator('.gs-target').count();
        check('elegir objetivo es una lista de quien esta a tu alcance, no un nombre que teclear',
            targets >= 1, `${targets} objetivos`);
        await page.locator('.gs-target').first().click();
        await page.waitForTimeout(1200);
        await clearDiceOverlay();
        const logAfter = await page.locator('#game-shell .cl-row').count();
        check('y el ataque se resuelve y queda escrito en el registro', logAfter > logBefore, `${logBefore} -> ${logAfter}`);
    } else {
        console.log(`SKIP  ningun turno de jugador con enemigos al alcance en 12 rondas (${attack.why})`);
    }

    // Esc, because that is how anyone leaves a full-screen game.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);

    const restored = await page.evaluate((expected) => {
        const panel = document.querySelector('#world_location_maps_row');
        return {
            shell: document.querySelectorAll('#game-shell').length,
            bodyClass: document.body.classList.contains('game-shell-on'),
            copies: document.querySelectorAll('#world_location_maps_row').length,
            parent: panel?.parentElement?.id || '',
            previous: panel?.previousElementSibling?.id || '',
            sameParent: panel?.parentElement?.id === expected.parent,
            samePlace: (panel?.previousElementSibling?.id || '') === expected.previous,
            tokens: document.querySelectorAll('#world_location_maps_list .wm-token').length,
            leftovers: document.querySelectorAll('.gs-root, .gs-stage, .gs-adopted').length,
        };
    }, home);

    check('Esc apaga el Modo Juego', restored.shell === 0 && !restored.bodyClass, JSON.stringify(restored));
    check('y devuelve la barra superior', await page.locator('#top-bar').isVisible().catch(() => false));
    check('el tablero vuelve exactamente a donde estaba',
        restored.sameParent && restored.samePlace && restored.copies === 1, JSON.stringify(restored));
    check('sin dejar nada del Shell por el camino', restored.leftovers === 0, JSON.stringify(restored));
    check('y se sigue dibujando en su sitio de siempre', restored.tokens >= 2, `${restored.tokens} fichas`);

    // Leave the fight closed so the run ends the way it found things.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop').catch(() => {}));
    await page.waitForTimeout(600);

    step('19. La escena de dialogo: el chat se mueve, no se replica');
    // Where the chat lives before the Shell borrows it. This is the check the whole step
    // exists for: `#sheld` carries the messages, the form, the streaming and the swipes.
    const chatHome = await page.evaluate(() => {
        const sheld = document.querySelector('#sheld');
        return {
            parent: sheld?.parentElement?.tagName || '',
            previous: sheld?.previousElementSibling?.id || '',
            copies: document.querySelectorAll('#sheld').length,
            messages: document.querySelectorAll('#chat .mes').length,
        };
    });
    check('antes de empezar hay un chat con mensajes', chatHome.messages > 0, JSON.stringify(chatHome));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // La tecla, como la usaria cualquiera.
    await page.keyboard.press('1');
    await page.waitForTimeout(800);

    const scene = await page.evaluate(() => {
        const sheld = document.querySelector('#sheld');
        const shell = document.querySelector('#game-shell');
        return {
            scene: shell?.getAttribute('data-scene') || '',
            copies: document.querySelectorAll('#sheld').length,
            inSlot: Boolean(document.querySelector('.gs-chat-slot > #sheld')),
            messages: document.querySelectorAll('#game-shell #chat .mes').length,
            form: Boolean(document.querySelector('#game-shell #form_sheld')),
            textarea: Boolean(document.querySelector('#game-shell #send_textarea')),
            insideShell: Boolean(shell && sheld && shell.contains(sheld)),
        };
    });
    check('la tecla 1 lleva a la escena de dialogo', scene.scene === 'dialogue', JSON.stringify(scene));
    check('el chat se mueve dentro de la escena, y sigue habiendo uno solo',
        scene.copies === 1 && scene.inSlot && scene.insideShell, JSON.stringify(scene));
    check('con sus mensajes, no con una copia vacia', scene.messages > 0, `${scene.messages} mensajes`);
    check('y con el formulario de escribir, que viaja dentro de `#sheld`',
        scene.form && scene.textarea, JSON.stringify(scene));

    check('el retrato dice quien habla',
        (await page.locator('.gs-speaker-name').innerText()).trim().length > 0,
        await page.locator('.gs-speaker-name').innerText().catch(() => '(sin retrato)'));
    const chips = await page.locator('.gs-chip').count();
    check('la franja de abajo lista al grupo', chips >= 2, `${chips} fichas de grupo`);
    check('con la vida de cada uno', await page.locator('.gs-chip-hp-fill').count() === chips);
    check('y la cabecera dice el dia y el momento',
        /^Día \d+ · /.test(await page.locator('.gs-head-state').innerText()),
        await page.locator('.gs-head-state').innerText());

    // Escribir desde dentro: el formulario es el de siempre, y el chat que hay en la
    // escena es el vivo, no una foto.
    await page.locator('#game-shell #send_textarea').fill('Hola desde la escena');
    const typed = await page.locator('#game-shell #send_textarea').inputValue();
    check('se puede escribir en la caja desde dentro de la escena',
        typed === 'Hola desde la escena', typed);

    const sendVisible = await page.evaluate(() => {
        const button = document.querySelector('#game-shell #send_but');
        if (!button) return null;
        const box = button.getBoundingClientRect();
        return { w: Math.round(box.width), h: Math.round(box.height) };
    });
    check('y el boton de enviar se ve dentro de la escena',
        Boolean(sendVisible && sendVisible.w > 0 && sendVisible.h > 0), JSON.stringify(sendVisible));

    // Enviar de verdad llamaria al proveedor, que en este recorrido no existe. `/send`
    // mete el mensaje por el mismo camino sin pedir respuesta, que es lo que hace falta
    // para saber si el chat montado en la escena es el que recibe.
    await page.locator('#game-shell #send_textarea').fill('');
    const grew = await page.evaluate(async () => {
        const before = document.querySelectorAll('#game-shell #chat .mes').length;
        await window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/send Hola desde la escena');
        await new Promise(r => setTimeout(r, 900));
        const after = document.querySelectorAll('#game-shell #chat .mes').length;
        const last = [...document.querySelectorAll('#game-shell #chat .mes .mes_text')].pop();
        return { before, after, text: (last?.textContent || '').trim().slice(0, 40) };
    });
    check('un mensaje nuevo aparece en el chat de la escena',
        grew.after === grew.before + 1 && /Hola desde la escena/.test(grew.text), JSON.stringify(grew));

    // Escribir en el chat deja el foco dentro, y entonces las teclas son del mensaje, no
    // del juego. Escape sale de la caja: sin eso, pinchar en el chat seria una puerta de
    // ida, y solo el raton te sacaria del Modo Juego.
    await page.locator('#game-shell #send_textarea').click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const afterBlur = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        focused: document.activeElement?.id || '',
    }));
    check('Escape con el foco en la caja sale de la caja, no del juego',
        afterBlur.shell === 1 && afterBlur.focused !== 'send_textarea', JSON.stringify(afterBlur));

    // Volver al tablero y comprobar que el conmutador ensena una escena y esconde la otra.
    await page.keyboard.press('3');
    await page.waitForTimeout(700);
    const backToBoard = await page.evaluate(() => {
        const shell = document.querySelector('#game-shell');
        const board = document.querySelector('.gs-scene-combat');
        const dialogue = document.querySelector('.gs-scene-dialogue');
        const visible = (node) => Boolean(node && node.getBoundingClientRect().height > 0);
        return { scene: shell?.getAttribute('data-scene') || '', board: visible(board), dialogue: visible(dialogue) };
    });
    check('la tecla 3 vuelve al tablero y esconde el dialogo',
        backToBoard.scene === 'combat' && backToBoard.board && !backToBoard.dialogue,
        JSON.stringify(backToBoard));

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);

    const chatBack = await page.evaluate((expected) => {
        const sheld = document.querySelector('#sheld');
        const textarea = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        if (textarea) textarea.value = 'sigue viva';
        return {
            copies: document.querySelectorAll('#sheld').length,
            sameParent: sheld?.parentElement?.tagName === expected.parent,
            samePlace: (sheld?.previousElementSibling?.id || '') === expected.previous,
            insideShell: Boolean(document.querySelector('#game-shell')),
            messages: document.querySelectorAll('#chat .mes').length,
            typed: textarea?.value || '',
            styled: sheld ? getComputedStyle(sheld).position : '',
        };
    }, chatHome);
    check('al apagar, el chat vuelve exactamente a donde estaba',
        chatBack.copies === 1 && chatBack.sameParent && chatBack.samePlace && !chatBack.insideShell,
        JSON.stringify(chatBack));
    check('con sus mensajes intactos, incluido el recien enviado',
        chatBack.messages === chatHome.messages + 1, `${chatHome.messages} -> ${chatBack.messages}`);
    check('la caja de escribir sigue aceptando texto', chatBack.typed === 'sigue viva', chatBack.typed);
    check('y `#sheld` recupera su posicion propia, sin restos del Shell',
        chatBack.styled === 'absolute', chatBack.styled);
    await page.evaluate(() => {
        const textarea = /** @type {HTMLTextAreaElement|null} */ (document.querySelector('#send_textarea'));
        if (textarea) textarea.value = '';
    });

    step('20. El director automatico: la pantalla sigue a la partida, no al modelo');
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // De charla, a proposito: lo que se comprueba es que el combate venga a buscarte.
    await page.keyboard.press('1');
    await page.waitForTimeout(600);
    check('se empieza en la escena de dialogo',
        await page.getAttribute('#game-shell', 'data-scene') === 'dialogue');

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Esqueleto 1');
    });
    await page.waitForTimeout(2000);
    await clearDiceOverlay();

    const started = await page.evaluate(() => ({
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
        board: (document.querySelector('.gs-scene-combat')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('empezar un combate lleva la pantalla al tablero, sin tocar nada',
        started.scene === 'combat' && started.board, JSON.stringify(started));
    check('y la cabecera dice por que ha cambiado', started.reason === 'empieza un combate', started.reason);

    // Mirar el mapa en mitad de una pelea sigue siendo cosa tuya.
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-end'));
    await page.waitForTimeout(900);
    await clearDiceOverlay();
    check('una eleccion tuya manda sobre la automatica mientras no pase nada nuevo',
        await page.getAttribute('#game-shell', 'data-scene') === 'dialogue',
        await page.getAttribute('#game-shell', 'data-scene'));

    // Y al terminar, de vuelta a la conversacion: lo que viene es el epilogo.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1600);
    await clearDiceOverlay();

    const ended = await page.evaluate(() => {
        const messages = [...document.querySelectorAll('#game-shell #chat .mes')];
        const last = messages[messages.length - 1];
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
            speaker: document.querySelector('.gs-speaker-name')?.textContent || '',
            lastIsSystem: last?.getAttribute('is_system') === 'true',
            text: (last?.querySelector('.mes_text')?.textContent || '').trim().slice(0, 60),
        };
    });
    check('terminar el combate devuelve la pantalla al dialogo, que es donde va el epilogo',
        ended.scene === 'dialogue', JSON.stringify(ended));
    check('y lo dice', ended.reason === 'termina el combate', ended.reason);
    check('el epilogo esta ahi, y no es un mensaje de sistema',
        ended.text.length > 0 && !ended.lastIsSystem, JSON.stringify(ended));
    check('el retrato es de quien acaba de hablar', ended.speaker.length > 0, ended.speaker);

    // Salir del tablero manda la partida al mapa, y esa escena todavia no existe: lo que
    // se ensena es lo mas parecido que hay, no una pantalla que solo diga que no existe.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(1200);
    const left = await page.evaluate(() => {
        const stage = document.querySelector('.gs-stage');
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
            empty: (stage?.textContent || '').trim().length === 0,
            chatVisible: (document.querySelector('#game-shell #chat')?.getBoundingClientRect().height || 0) > 0,
        };
    });
    check('salir del tablero no deja al jugador en una pantalla vacia',
        left.scene === 'dialogue' && !left.empty && left.chatVisible, JSON.stringify(left));
    check('y la cabecera sigue diciendo lo que paso de verdad',
        left.reason === 'se ha salido del tablero', left.reason);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    check('y el Modo Juego se apaga dejandolo todo en su sitio',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#sheld').length === 1
            && !document.body.classList.contains('game-shell-on')));

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
        // Windows holds the directory for a moment logAfter the server dies.
        await new Promise(resolve => setTimeout(resolve, 1000));
        rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5 });
    } else {
        console.log(`\nKept for inspection: ${dataRoot}`);
    }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
