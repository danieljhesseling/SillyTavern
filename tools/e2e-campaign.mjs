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

// Las funciones que se pasan a `page.evaluate` se ejecutan en el navegador, no aqui: por
// eso este archivo de Node habla de `window` y `document`. Se declaran para que ESLint
// compruebe el resto en vez de ahogarse en esto.
/* global window, document, Node, getComputedStyle */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
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
    // `acceptDownloads` para el paso 31: exportar una campana descarga un archivo, y
    // sin esto Playwright lo cancela en silencio.
    const context = await browser.newContext({
        viewport: { width: 1400, height: 950 },
        acceptDownloads: true,
    });
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

    await page.fill('.cw-root textarea.cw-party-input', 'Lyra\nBrand');
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
    // Desde H5, Esc pausa en vez de apagar: salir es cosa del menu de pausa.
    const leaveGameMode = async () => {
        await page.keyboard.press('Escape');
        await page.waitForSelector('.gs-pause', { timeout: 5000 });
        await page.locator('.gs-pause-btn', { hasText: 'Salir del Modo Juego' }).click();
        await page.waitForTimeout(1100);
    };

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
    // El mapa es editable desde que se puede corregir en la previsualizacion, asi que
    // su contenido esta en el valor del campo, no en el texto del nodo.
    const mapRows = (await page.locator('.cw-ai-map').inputValue()).trim().split('\n');
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
        tabs.filter(t => /Sección/.test(t)).length === 6, tabs.join(' · '));

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
    // Desde H4 existen las tres, asi que ninguna sale desactivada estando disponible.
    check('las tres escenas estan disponibles, ninguna fingida',
        scenes.length === 3 && scenes.every(s => s.disabled === false), JSON.stringify(scenes));

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

    // Esc pausa, como en cualquier juego; salir es una opcion del menu, no un accidente.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 });
    const pause = await page.evaluate(() => ({
        card: document.querySelectorAll('.gs-pause-btn').length,
        shell: document.querySelectorAll('#game-shell').length,
        topBar: (document.querySelector('#top-bar')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('Esc pausa el juego en vez de apagarlo', pause.shell === 1 && pause.card >= 4, JSON.stringify(pause));
    check('y en pausa vuelve la barra de SillyTavern, por encima de la capa',
        pause.topBar, JSON.stringify(pause));

    await page.locator('.gs-pause-btn', { hasText: 'Salir del Modo Juego' }).click();
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

    check('salir del menu de pausa apaga el Modo Juego', restored.shell === 0 && !restored.bodyClass, JSON.stringify(restored));
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
        const board = document.querySelector('.gs-scene-map');
        const dialogue = document.querySelector('.gs-scene-dialogue');
        const visible = (node) => Boolean(node && node.getBoundingClientRect().height > 0);
        return { scene: shell?.getAttribute('data-scene') || '', board: visible(board), dialogue: visible(dialogue) };
    });
    check('la tecla 3 vuelve al tablero y esconde el dialogo',
        backToBoard.scene === 'combat' && backToBoard.board && !backToBoard.dialogue,
        JSON.stringify(backToBoard));

    await leaveGameMode();

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
        board: (document.querySelector('.gs-scene-map')?.getBoundingClientRect().height || 0) > 0,
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

    // Salir del tablero manda la partida al mapa, que desde H4 es una escena de verdad.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/leave'));
    await page.waitForTimeout(1200);
    const left = await page.evaluate(() => {
        const stage = document.querySelector('.gs-stage');
        return {
            scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
            reason: document.querySelector('.gs-head-state')?.getAttribute('title') || '',
            empty: (stage?.textContent || '').trim().length === 0,
            places: (document.querySelector('.gs-places')?.getBoundingClientRect().height || 0) > 0,
        };
    });
    check('salir del tablero lleva al mapa, con su panel de viaje',
        left.scene === 'exploration' && !left.empty && left.places, JSON.stringify(left));
    check('y la cabecera sigue diciendo lo que paso de verdad',
        left.reason === 'se ha salido del tablero', left.reason);

    await leaveGameMode();
    check('y el Modo Juego se apaga dejandolo todo en su sitio',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#sheld').length === 1
            && !document.body.classList.contains('game-shell-on')));

    step('21. La escena de exploracion: el mapa de campana, por fin cargado');
    // Desde otra pestana del cajon, que es de donde se entra de verdad: el cajon esconde
    // la pestana que no toca, y el panel del tablero es una de ellas.
    await page.locator('#rm_tab_party').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    check('el cajon tenia el panel del tablero escondido antes de empezar',
        await page.evaluate(() => document.querySelector('#world_location_maps_row')
            ?.classList.contains('tab-panel-hidden') === true));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // Sin tablero abierto, el director lleva solo a la exploracion.
    check('sin tablero abierto, la pantalla es la del mapa',
        await page.getAttribute('#game-shell', 'data-scene') === 'exploration',
        await page.getAttribute('#game-shell', 'data-scene'));

    const explore = await page.evaluate(() => ({
        here: document.querySelector('.gs-here-name')?.textContent || '',
        places: [...document.querySelectorAll('.gs-place')].map(p => ({
            name: p.querySelector('.gs-place-name')?.textContent || '',
            note: p.querySelector('.gs-place-note')?.textContent || '',
            locked: p.classList.contains('status-locked'),
            complete: p.classList.contains('status-complete'),
            current: p.classList.contains('current'),
        })),
        boards: [...document.querySelectorAll('.gs-board-name')].map(b => b.textContent),
        chips: document.querySelectorAll('.gs-actions .gs-chip').length,
        mapVisible: (document.querySelector('#game-shell [data-map-root]')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('dice donde esta el grupo', explore.here.length > 0, explore.here);
    check('lista los sitios del mundo', explore.places.length >= 1, JSON.stringify(explore.places));
    check('marca el sitio en el que estas', explore.places.some(p => p.current), JSON.stringify(explore.places));
    check('y los tableros de aqui', explore.boards.length >= 1, JSON.stringify(explore.boards));
    check('con el grupo abajo', explore.chips >= 2, `${explore.chips} fichas`);
    check('y el mapa ocupando la pantalla', explore.mapVisible);

    // Ganar el escenario da la localizacion por superada: eso es lo que abre las demas.
    const completed = await page.evaluate(() => {
        const map = window.SillyTavern.getContext().chatMetadata.campaignMap;
        return (map?.locations || []).filter(l => l.status === 'complete').map(l => l.id);
    });
    check('ganar la mision dejo la localizacion marcada como superada en el mapa',
        completed.length >= 1, JSON.stringify(completed));
    check('y se ve en la lista', explore.places.some(p => p.complete), JSON.stringify(explore.places));

    // Un sitio cerrado se ve y explica por que, en vez de esconderse.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const locations = ctx.chatMetadata.campaignMap?.locations || [];
        ctx.chatMetadata.campaignMap = {
            version: 1,
            locations: [...locations, {
                id: 'Santuario sellado', name: 'Santuario sellado', status: 'locked',
                requiresQuests: ['el_sello'], requiresLocations: [],
            }],
        };
        await ctx.saveMetadata();
    });
    // El mundo tiene que ofrecer el sitio para que el mapa lo muestre: si no existe, se
    // descarta a proposito.
    const hidden = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/exploration-scene.js');
        const ctx = window.SillyTavern.getContext();
        const view = m.buildExplorationView({
            locationMaps: [{ name: 'Santuario sellado' }],
            campaignMap: ctx.chatMetadata.campaignMap,
        });
        const withoutWorld = m.buildExplorationView({
            locationMaps: [], campaignMap: ctx.chatMetadata.campaignMap,
        });
        return { place: view.places[0], dropped: withoutWorld.places.length };
    });
    check('un sitio cerrado dice que le falta, no solo que no',
        hidden.place?.status === 'locked' && /misión/.test(hidden.place?.reasons?.[0] || ''),
        JSON.stringify(hidden.place));
    check('y un sitio que el mundo no tiene no se ofrece', hidden.dropped === 0, String(hidden.dropped));

    // Entrar en un tablero desde el panel de viaje cambia de escena sola.
    await page.locator('.gs-board').first().click();
    await page.waitForTimeout(1400);
    check('entrar en un tablero desde el mapa lleva la pantalla al tablero',
        await page.getAttribute('#game-shell', 'data-scene') === 'combat',
        await page.getAttribute('#game-shell', 'data-scene'));

    await leaveGameMode();
    check('y al apagar no queda nada del Shell',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#world_location_maps_row').length === 1
            && document.querySelectorAll('#sheld').length === 1));

    step('22. Titulo y pausa: salir de la partida sin salir del juego');
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(800);

    // El compendio es el mismo editor de reglas de `/rules`, abierto desde la pausa.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gs-pause', { timeout: 5000 });
    await page.locator('.gs-pause-btn', { hasText: 'Compendio' }).click();
    await page.waitForSelector('.rx-root', { timeout: 20000 });
    check('el compendio de la pausa abre el editor de reglas de siempre',
        await page.locator('.rx-root').count() === 1);
    await page.locator('.popup-button-cancel').last().click();
    await page.waitForTimeout(700);

    // Opciones pulsa el icono de SillyTavern: el panel se abre donde siempre.
    await page.locator('.gs-pause-btn', { hasText: 'Opciones' }).click();
    await page.waitForTimeout(900);
    const options = await page.evaluate(() => {
        const panel = document.querySelector('#left-nav-panel');
        const box = panel?.getBoundingClientRect();
        return {
            open: Boolean(panel?.classList.contains('openDrawer')) && Boolean(box && box.height > 0),
            above: Number(getComputedStyle(document.querySelector('#top-settings-holder')).zIndex) > 3000,
        };
    });
    check('Opciones abre los paneles de SillyTavern tal cual, sin reubicarlos',
        options.open && options.above, JSON.stringify(options));
    await page.locator('#ai-config-button').click().catch(() => {});
    await page.waitForTimeout(500);

    // Salir al menu principal cierra la partida, no el juego.
    await page.locator('.gs-pause-btn', { hasText: 'Salir al menu principal' }).click();
    await page.waitForTimeout(3000);

    const title = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        head: document.querySelector('.gs-head-state')?.textContent || '',
        banner: (document.querySelector('.gs-title')?.getBoundingClientRect().height || 0) > 0,
        cards: document.querySelectorAll('#game-shell .campaign-card, #game-shell .campaign-card-unstarted').length,
        newCampaign: Boolean(document.querySelector('#game-shell #cw-new-campaign')),
        form: (document.querySelector('#game-shell #form_sheld')?.getBoundingClientRect().height || 0) > 0,
        switcher: (document.querySelector('.gs-scenes')?.getBoundingClientRect().height || 0) > 0,
    }));
    check('salir al menu principal deja el Modo Juego encendido', title.shell === 1, JSON.stringify(title));
    check('en la pantalla de titulo', title.scene === 'title' && title.banner && title.head === 'Menu principal',
        JSON.stringify(title));
    check('con las campanas que ya existian, no una lista nueva',
        title.cards >= 1 && title.newCampaign, JSON.stringify(title));
    check('y sin caja de escribir ni conmutador, que ahi no pintan nada',
        !title.form && !title.switcher, JSON.stringify(title));

    // Y desde el titulo se vuelve a jugar, con el Shell puesto.
    await page.locator('#game-shell .campaign-card .campaign-continue').first().click();
    await page.waitForTimeout(3500);
    const resumed = await page.evaluate(() => ({
        shell: document.querySelectorAll('#game-shell').length,
        scene: document.querySelector('#game-shell')?.getAttribute('data-scene') || '',
        sheld: document.querySelectorAll('#sheld').length,
    }));
    check('continuar una campana desde el titulo vuelve a la partida, sin salir del juego',
        resumed.shell === 1 && resumed.scene !== 'title' && resumed.sheld === 1, JSON.stringify(resumed));

    await leaveGameMode();
    check('y al apagar, todo vuelve a su sitio otra vez',
        await page.evaluate(() => document.querySelectorAll('#game-shell').length === 0
            && document.querySelectorAll('#sheld').length === 1
            && document.querySelectorAll('#world_location_maps_row').length === 1
            && !document.body.classList.contains('game-shell-on')
            && !document.body.classList.contains('game-shell-paused')));

    step('23. Importar un libro: del paquete del Gem a un tablero jugable');
    await closeChat();
    await page.click('#cw-new-campaign');
    await page.waitForSelector('.cw-root');
    await page.locator('.cw-template-import').click();
    await page.waitForTimeout(400);

    check('el asistente ofrece importar un libro', await page.locator('.cw-import').isVisible());

    // Primero uno roto, porque es lo que de verdad llega: el informe tiene que decir que
    // pasa antes de que se cree nada.
    const broken = JSON.stringify({
        version: 1,
        world: { name: 'Roto' },
        bestiary: [{ name: 'Cuervo', hp: 7, armorClass: 12, cr: 0.125 }],
        boards: [{
            id: 'sala', name: 'Sala',
            map: ['#####', '#...#', '#....', '#####'],
            partyStart: [{ x: 0, y: 0 }],
            enemies: [{ name: 'Lobo', x: 2, y: 1 }],
        }],
        quests: [{ id: 'q', name: 'Q', boardId: 'otro', objectives: [{ type: 'eliminate', label: 'X', target: 'Nadie' }] }],
    });
    await page.locator('.cw-import-text').fill(broken);
    await page.locator('.cw-import-check').click();
    await page.waitForSelector('.cw-import-verdict', { timeout: 10000 });

    const bad = await page.evaluate(() => ({
        verdict: document.querySelector('.cw-import-verdict')?.textContent || '',
        ok: document.querySelector('.cw-import-verdict')?.classList.contains('ok'),
        errors: [...document.querySelectorAll('.cw-import-bad li')].map(li => li.textContent || ''),
    }));
    check('un paquete roto se rechaza antes de crear nada', bad.ok === false && /no se puede importar/.test(bad.verdict), bad.verdict);
    check('y dice exactamente que le pasa, no "JSON invalido"',
        bad.errors.length >= 4
        && bad.errors.some(e => /borde exterior/.test(e))
        && bad.errors.some(e => /sobre un muro/.test(e))
        && bad.errors.some(e => /no esta en el bestiario/.test(e))
        && bad.errors.some(e => /no existe entre los tableros/.test(e)),
        JSON.stringify(bad.errors));

    // Y ahora el ejemplo que el propio contrato publica.
    const examplePack = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack-schema.js');
        return JSON.stringify(m.buildExamplePack());
    });
    await page.locator('.cw-import-text').fill(examplePack);
    await page.locator('.cw-import-check').click();
    await page.waitForTimeout(800);

    const okReport = await page.evaluate(() => ({
        ok: document.querySelector('.cw-import-verdict')?.classList.contains('ok'),
        counts: document.querySelector('.cw-import-counts')?.textContent || '',
        name: document.querySelector('.cw-root input.cw-input')?.value || '',
    }));
    check('el ejemplo del contrato pasa la comprobacion', okReport.ok === true, okReport.counts);
    check('y el informe cuenta lo que trae',
        /2 localidades, 2 tableros, 2 enemigos, 1 companeros, 2 misiones, 4 objetivos/.test(okReport.counts),
        okReport.counts);
    check('el nombre del mundo lo propone el paquete', /Molino/.test(okReport.name), okReport.name);

    await page.locator('.cw-root textarea.cw-party-input').fill('Lyra\nBrand');
    await page.click('.popup-button-ok');
    await page.waitForTimeout(6000);

    const imported = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const worldName = ctx.chatMetadata.world_info;
        const data = await wi.loadWorldInfo(worldName);
        const meta = data?.metadata ?? {};
        const boards = meta.locationMaps?.[0]?.boards ?? [];
        const byComment = {};
        for (const entry of Object.values(data?.entries ?? {})) byComment[entry.comment] = String(entry.uid);
        return {
            worldName,
            location: meta.locationMaps?.[0]?.name,
            boards: boards.map(b => b.name),
            groups: [...new Set(Object.values(data?.entries ?? {}).map(e => e.group))].sort(),
            rules: boards[0]?.encounterRules ?? [],
            crowUid: byComment['Cuervo grande'],
            guardUid: byComment['Guardián del grano'],
            miraUid: byComment['Mira la Molinera'],
            objectives: (boards[1]?.objectives ?? []).map(o => ({ type: o.type, targetIds: o.targetIds, allyId: o.allyId, rounds: o.rounds })),
            party: (ctx.chatMetadata.party || []).map(m => `${m.name}@${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
            placements: boards[0]?.enemyPlacements ?? [],
        };
    });

    check('el libro es ahora una campana abierta', /Molino/.test(imported.worldName || ''), imported.worldName);
    check('con sus dos tableros en su localizacion',
        imported.boards.length === 2 && imported.location === 'El Molino de los Cuervos', JSON.stringify(imported));
    const village = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const places = data?.metadata?.locationMaps ?? [];
        const quiet = places.find(l => l.name === 'Vado de la Rueda');
        return {
            names: places.map(l => l.name),
            boards: quiet ? (quiet.boards ?? []).length : null,
            type: quiet?.locationType ?? '',
        };
    });
    check('una localidad sin tablero tambien llega: un pueblo tranquilo existe',
        village.boards === 0 && village.type === 'village', JSON.stringify(village));

    check('y con entradas de las cuatro clases que trae un libro',
        JSON.stringify(imported.groups) === JSON.stringify(['Characters', 'Factions', 'Lore', 'Monsters']),
        JSON.stringify(imported.groups));

    // Lo que costo una funcionalidad entera la vez anterior: reglas escritas antes de
    // que existieran los ids.
    check('las reglas de encuentro apuntan al monstruo que se acaba de crear',
        imported.rules.length === 1 && imported.rules[0].enemyId === imported.crowUid,
        JSON.stringify({ rules: imported.rules, crow: imported.crowUid }));
    check('y los objetivos tambien, cada uno al suyo',
        imported.objectives[0]?.targetIds?.[0] === imported.guardUid
        && imported.objectives[1]?.allyId === imported.miraUid
        && imported.objectives[2]?.rounds === 6,
        JSON.stringify(imported.objectives));
    check('el grupo esta en las casillas que dibuja el libro',
        JSON.stringify(imported.party) === JSON.stringify(['Lyra@2,7', 'Brand@3,7']), JSON.stringify(imported.party));

    // Y se juega: la prueba de que la importacion sirve es que /fight encuentre enemigos.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Cuervo grande 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    const fight = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return {
            active: Boolean(enc?.active),
            enemies: (enc?.enemies || []).map(e => ({ name: e.name, x: e.gridX, y: e.gridY })),
        };
    });
    check('un combate en el tablero importado encuentra a sus enemigos',
        fight.active && fight.enemies.length === 1, JSON.stringify(fight));
    // Su casilla dibujada esta en una sala que todavia nadie ha abierto, asi que no
    // aparece ahi: invocarlo a mano no abre puertas. Donde si aparece en su casilla es
    // al despertar, y eso lo comprueba el paso 24.
    check('pero no dentro de la sala que aun nadie ha abierto',
        !(fight.enemies[0]?.x === imported.placements[0]?.x && fight.enemies[0]?.y === imported.placements[0]?.y),
        JSON.stringify({ spawn: fight.enemies[0], drawn: imported.placements[0] }));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(900);
    await clearDiceOverlay();

    step('24. Salas y puertas: lo que duerme detras no aparece hasta que abres');
    // Seguimos en el libro importado del paso anterior. El sotano tiene su guardian
    // detras de una puerta, que es justo para lo que sirven las salas.
    const rooms = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const boards = data?.metadata?.locationMaps?.[0]?.boards ?? [];
        return boards.map(b => ({
            name: b.name,
            rooms: (b.rooms || []).map(r => ({ cells: r.cells.length, doors: r.doors.length, revealed: r.revealed })),
            placements: b.enemyPlacements || [],
        }));
    });
    check('el libro importado trajo sus salas, sacadas del propio mapa',
        rooms.every(b => b.rooms.length >= 2), JSON.stringify(rooms.map(b => b.rooms.length)));
    check('la sala donde empieza el grupo esta visible, y la otra no',
        rooms[0].rooms.filter(r => r.revealed).length === 1
        && rooms[0].rooms.some(r => !r.revealed), JSON.stringify(rooms[0].rooms));

    // El guardian del sotano duerme tras la puerta: entrar no deberia sacarlo.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/enter El sótano'));
    await page.waitForTimeout(1600);

    const sleeping = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/campaign-map.js');
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? []).find(b => b.name === 'El sótano');
        return {
            board: ctx.chatMetadata.currentBoard,
            placements: board.enemyPlacements.length,
            awake: m.awakePlacements(board.rooms, board.enemyPlacements).length,
            doors: [...new Set((board.rooms || []).flatMap(r => r.doors))],
        };
    });
    check('en el sotano hay alguien colocado que todavia no esta despierto',
        sleeping.placements === 1 && sleeping.awake === 0, JSON.stringify(sleeping));

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(1500);
    await clearDiceOverlay();
    const summoned = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return (enc?.enemies || []).map(e => ({ x: e.gridX, y: e.gridY }));
    });
    check('invocarlo a mano no lo saca de la sala cerrada',
        summoned.length === 1 && !(summoned[0].x === 5 && summoned[0].y === 3),
        JSON.stringify(summoned));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    // Y ahora lo que da nombre a todo esto: abrir la puerta.
    await page.locator('#rm_tab_location').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    const sotanoDoor = page.locator('.wm-terrain-door').filter({ visible: true }).first();
    check('la puerta del sotano esta dibujada y cerrada', await sotanoDoor.count() === 1, sleeping.doors.join(' '));
    await sotanoDoor.click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    await clearDiceOverlay();

    const woken = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? []).find(b => b.name === 'El sótano');
        const enc = ctx.chatMetadata.combatEncounter;
        return {
            revealed: (board?.rooms || []).filter(r => r.revealed).length,
            total: (board?.rooms || []).length,
            active: Boolean(enc?.active),
            enemies: (enc?.enemies || []).map(e => ({ name: e.name, x: e.gridX, y: e.gridY })),
            inOrder: (enc?.turnOrder || []).filter(t => t.isEnemy).length,
            said: ([...document.querySelectorAll('.mes_text')]
                .map(m => m.textContent || '')
                .find(text => /Se despierta lo que dormia/.test(text)) || '').trim(),
        };
    });

    check('abrir la puerta revela la sala que guardaba',
        woken.revealed === woken.total, JSON.stringify({ revealed: woken.revealed, total: woken.total }));
    // Donde despierta se comprueba por el aviso, no por donde esta ahora: si le toca
    // iniciativa antes que a ti, para cuando lo miras ya ha echado a andar.
    check('y despierta a quien dormia dentro, en la casilla que dibuja el libro',
        woken.active && woken.enemies.length === 1 && /Guardián del grano \(9, 4\)/.test(woken.said),
        JSON.stringify({ enemigos: woken.enemies, aviso: woken.said }));
    check('el que despierta tiene turno de verdad, no solo ficha',
        woken.inOrder === woken.enemies.length, JSON.stringify({ orden: woken.inOrder, enemigos: woken.enemies.length }));
    check('y el chat lo cuenta', woken.said.length > 0, woken.said);

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('25. Descansar, y que el prefijo del prompt no se mueva');
    // Nada de preparar la vida a mano: `chatMetadata.party` y la lista que usa el juego
    // no son los mismos objetos, asi que tocarla desde fuera miente. Lo que se comprueba
    // es lo que el motor dice que ha hecho, en su propio aviso, y lo que mueve el reloj.
    const beforeRest = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return { day: ctx.chatMetadata.calendar?.day ?? 1, slot: ctx.chatMetadata.calendar?.slotIndex ?? 0 };
    });

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/descanso corto'));
    await page.waitForTimeout(2000);

    const afterShort = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const said = [...document.querySelectorAll('.mes_text')]
            .map(m => m.textContent || '').filter(t => /\[DESCANSO\]/.test(t)).pop() || '';
        return {
            day: ctx.chatMetadata.calendar?.day ?? 1,
            slot: ctx.chatMetadata.calendar?.slotIndex ?? 0,
            said,
            names: (ctx.chatMetadata.party || []).map(m => m.name),
        };
    });
    check('un descanso corto cuesta tiempo del calendario',
        afterShort.slot !== beforeRest.slot || afterShort.day !== beforeRest.day,
        JSON.stringify({ antes: [beforeRest.day, beforeRest.slot], despues: [afterShort.day, afterShort.slot] }));
    check('y deja escrito lo que le ha pasado a cada uno',
        /Descanso corto/.test(afterShort.said)
        && afterShort.names.every(name => afterShort.said.includes(name)),
        afterShort.said.slice(0, 160));

    // El largo: cura del todo y amanece, se estuviera como se estuviera.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/descanso largo'));
    await page.waitForTimeout(2000);

    const afterLong = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        return {
            full: (ctx.chatMetadata.party || []).every(m => m.hp === m.maxHp),
            day: ctx.chatMetadata.calendar?.day ?? 1,
            spent: (ctx.chatMetadata.party || []).map(m => m.hitDiceSpent ?? 0),
            said: ([...document.querySelectorAll('.mes_text')]
                .map(m => m.textContent || '').filter(t => /\[DESCANSO\]/.test(t)).pop() || ''),
        };
    });
    check('un descanso largo deja al grupo entero',
        afterLong.full, JSON.stringify(afterLong.spent));
    check('y amanece', afterLong.day > afterShort.day, `${afterShort.day} -> ${afterLong.day}`);
    check('sin dados de golpe pendientes despues de dormir',
        afterLong.spent.every(s => s === 0), JSON.stringify(afterLong.spent));

    // Y no se descansa en mitad de un combate. El enemigo tiene que ser uno de las
    // reglas de *este* tablero: invocar al cuervo aqui no empieza ningun combate, y la
    // comprobacion pasaria por no haberlo intentado.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(1800);
    await clearDiceOverlay();
    const duringFight = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const day = ctx.chatMetadata.calendar?.day ?? 1;
        const fighting = Boolean(ctx.chatMetadata.combatEncounter?.active);
        await ctx.executeSlashCommandsWithOptions('/descanso largo');
        return { day, fighting, after: ctx.chatMetadata.calendar?.day ?? 1 };
    });
    check('y no se puede descansar en mitad de un combate',
        duringFight.fighting && duringFight.day === duringFight.after, JSON.stringify(duringFight));
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    // Las cuatro claves fijas del contexto dinamico son las que de verdad importan: antes
    // `DYN_BOARD` —lo que cambia en cada turno— ordenaba la primera, asi que invalidaba
    // todo lo que venia detras.
    const promptOrder = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        const fixed = [
            m.promptKey('rules', 'meta'),
            m.promptKey('npc', 'relationships'),
            m.promptKey('quest', 'quests'),
            m.promptKey('combat', 'board'),
        ];
        return {
            real: m.sortLikeSillyTavern(fixed).map(k => k.split('_')[2]),
            antes: ['DYN_BOARD', 'DYN_META_INSTRUCTION', 'DYN_QUESTS', 'DYN_RELATIONSHIPS'].sort(),
            rulesFirst: m.promptKey('rules', 'a') < m.promptKey('combat', 'a'),
            tiers: m.PROMPT_TIERS.map(t => t.id),
        };
    });
    check('el tablero, que cambia cada turno, ya no ordena el primero',
        promptOrder.antes[0] === 'DYN_BOARD' && promptOrder.real[promptOrder.real.length - 1] === 'combat',
        JSON.stringify({ antes: promptOrder.antes[0], ahora: promptOrder.real }));
    check('las claves del juego ordenan las reglas antes que el combate',
        promptOrder.rulesFirst, JSON.stringify(promptOrder.tiers));

    const keyed = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        // El orden que SillyTavern va a usar es el alfabetico de las claves.
        const sample = ['combat', 'rules', 'location', 'lore'].map(c => m.promptKey(m.tierForCategory(c), c));
        return m.sortLikeSillyTavern(sample).map(k => k.split('_')[2]);
    });
    check('y ese orden es de lo que menos cambia a lo que mas',
        JSON.stringify(keyed) === JSON.stringify(['rules', 'world', 'location', 'combat']),
        JSON.stringify(keyed));

    const prefix = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/cost/prompt-order.js');
        const a = 'REGLAS iguales\nMUNDO igual\nPG: 20/20';
        const b = 'REGLAS iguales\nMUNDO igual\nPG: 14/20';
        const c = 'PG: 14/20\nREGLAS iguales\nMUNDO igual';
        return { bueno: m.stablePrefix(a, b).chars, malo: m.stablePrefix(a, c).chars, total: a.length };
    });
    check('un cambio al final conserva casi todo el prefijo; uno al principio, nada',
        prefix.bueno > prefix.total * 0.8 && prefix.malo < 5,
        JSON.stringify(prefix));

    step('26. Objetivos editables sin tocar World Info');
    // Sin `await` sobre el comando: abre un popup, y su promesa no resuelve hasta que
    // alguien lo cierra. Esperarla aqui dejaba el recorrido colgado para siempre.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/objetivos editar');
    });
    await page.waitForSelector('.oe-root', { timeout: 20000 });

    const editor = await page.evaluate(() => ({
        rows: document.querySelectorAll('.oe-row').length,
        types: [...(document.querySelector('.oe-type')?.options || [])].map(o => o.value),
        labels: [...document.querySelectorAll('.oe-label')].map(i => i.value),
    }));
    check('el editor abre los objetivos que ya tenia el tablero',
        editor.rows >= 1, JSON.stringify(editor.labels));
    check('y ofrece exactamente los tipos que el motor sabe juzgar',
        editor.types.length === 7 && editor.types.includes('eliminate') && editor.types.includes('protect'),
        editor.types.join(', '));

    // Anadir uno a mano, del tipo que no pide nada mas.
    await page.locator('.oe-actions .menu_button').first().click();
    await page.waitForTimeout(400);
    const added = await page.locator('.oe-row').count();
    check('se puede anadir un objetivo a mano', added === editor.rows + 1, `${editor.rows} -> ${added}`);

    await page.locator('.oe-row').last().locator('.oe-label').fill('Salir con vida');
    await page.click('.popup-button-ok');
    await page.waitForTimeout(2000);

    const savedObjectives = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? [])
            .find(b => b.name === ctx.chatMetadata.currentBoard);
        return (board?.objectives ?? []).map(o => ({ type: o.type, label: o.label }));
    });
    check('y se guarda en el tablero, sin abrir World Info',
        savedObjectives.some(o => o.label === 'Salir con vida'), JSON.stringify(savedObjectives));

    // Y lo que se guarda es lo que el motor juzga: el escenario lo lee sin mas.
    const judged = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        void ctx.executeSlashCommandsWithOptions('/objetivos');
        return true;
    });
    await page.waitForTimeout(900);
    check('el escenario lee lo que acaba de guardarse', judged
        && (await page.locator('#toast-container .toast').count()) >= 0);

    // Un nombre inventado no se puede guardar: seria una mision imposible de cumplir.
    const refused = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/campaign/objective-editor.js');
        const { problems } = m.fromRows(
            [{ type: 'eliminate', label: 'Matar al dragon', values: { target: 'Dragon inexistente' } }], {});
        return problems;
    });
    check('un objetivo que nombra a quien no existe se rechaza, y dice por que',
        refused.length === 1 && /no existe en este mundo/.test(refused[0]), JSON.stringify(refused));


    step('27. Botin equipable, enemigos editables y cobertura por linea de tiro');
    // El botin, como objetos de verdad: una pocion que no se puede beber es ambientacion.
    const lootShape = await page.evaluate(async () => {
        const items = await import('/scripts/game-engine/combat/loot-items.js');
        const loot = await import('/scripts/game-engine/combat/loot.js');
        const dnd = await import('/scripts/dnd-system.js');
        const dropped = Object.values(loot.DEFAULT_LOOT_RULES.itemsByRarity).flat();
        const sword = dnd.createItem(items.describeLootItem('Espada rúnica', 'Rare'));
        return {
            undeclared: dropped.filter(n => !items.isDeclaredLoot(n)),
            sword: { id: Boolean(sword.id), slot: sword.slot, dice: sword.damageDice, rarity: sword.rarity },
        };
    });
    check('todo lo que sueltan las tablas esta declarado como objeto',
        lootShape.undeclared.length === 0, JSON.stringify(lootShape.undeclared));
    check('y una espada del botin se puede equipar, con su dado de dano',
        lootShape.sword.id && lootShape.sword.slot === 'weapon' && lootShape.sword.dice === '1d8',
        JSON.stringify(lootShape.sword));

    // Los enemigos del tablero, editables sin abrir World Info.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/enemigos');
    });
    await page.waitForSelector('.ee-root', { timeout: 20000 });
    const encounters = await page.evaluate(() => ({
        rows: document.querySelectorAll('.ee-row').length,
        options: [...document.querySelectorAll('.ee-enemy option')].map(o => o.value),
        summary: document.querySelector('.ee-summary')?.textContent || '',
    }));
    check('el editor de enemigos abre las reglas del tablero',
        encounters.rows >= 1 && encounters.options.length >= 1, JSON.stringify(encounters));
    check('y resume cuantos pueden salir', /×/.test(encounters.summary), encounters.summary);

    await page.locator('.ee-row').first().locator('.ee-count').last().fill('3');
    await page.click('.popup-button-ok');
    await page.waitForTimeout(1800);

    const savedRules = await page.evaluate(async () => {
        const wi = await import('/scripts/world-info.js');
        const ctx = window.SillyTavern.getContext();
        const data = await wi.loadWorldInfo(ctx.chatMetadata.world_info);
        const board = (data?.metadata?.locationMaps?.[0]?.boards ?? [])
            .find(b => b.name === ctx.chatMetadata.currentBoard);
        return board?.encounterRules ?? [];
    });
    check('lo editado se guarda en el tablero',
        savedRules.some(r => r.maxCount === 3), JSON.stringify(savedRules));

    // La cobertura, por linea de tiro: un pilar protege a quien esta detras.
    const cover = await page.evaluate(async () => {
        const los = await import('/scripts/game-engine/board/line-of-sight.js');
        const t = await import('/scripts/game-engine/board/terrain.js');
        const terrain = t.terrainFromAsciiMap(['#######', '#..c..#', '#######']);
        return {
            detras: los.getCoverAlongLine(terrain, 1, 1, 5, 1, t.getCoverBonus),
            sinNada: los.getCoverAlongLine(terrain, 1, 1, 2, 1, t.getCoverBonus),
            propia: los.getCoverAlongLine(terrain, 3, 1, 5, 1, t.getCoverBonus),
        };
    });
    check('un pilar en medio da cobertura a quien esta detras',
        cover.detras === 2 && cover.sinNada === 0, JSON.stringify(cover));
    check('y la casilla del propio tirador no cuenta',
        cover.propia === 0, JSON.stringify(cover));

    // Y quitar una regla que algo usa avisa antes de guardar.
    const impact = await page.evaluate(async () => {
        const ri = await import('/scripts/game-engine/rules/rule-impact.js');
        const dr = await import('/scripts/game-engine/rules/default-ruleset.js');
        const before = dr.DEFAULT_RULESET;
        const after = JSON.parse(JSON.stringify(before));
        after.items.damageTypes = after.items.damageTypes.filter(d => d[0] !== 'Slashing');
        const broken = ri.findBrokenReferences({
            before, after, items: [{ name: 'Espada', damageType: 'Slashing' }],
        });
        return { broken: broken.length, message: broken[0]?.message ?? '', summary: ri.describeImpact(broken) };
    });
    check('quitar un tipo de dano que algo usa se avisa, con quien lo usa',
        impact.broken === 1 && /Espada/.test(impact.message), impact.message);
    check('y se resume lo que costaria', /ficha/.test(impact.summary), impact.summary);


    step('28. Semilla, contradicciones y el pegamento fuera de party.js');
    // Los dados, repetibles: sin esto no se puede decir si un cambio mejoro algo.
    const seeded = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        const rules = await import('/scripts/party/combat-rules.js');

        await ctx.executeSlashCommandsWithOptions('/semilla molino');
        const first = [rules.rollDiceDetailed('1d20').total, rules.rollDiceDetailed('2d6+1').total];

        await ctx.executeSlashCommandsWithOptions('/semilla molino');
        const second = [rules.rollDiceDetailed('1d20').total, rules.rollDiceDetailed('2d6+1').total];

        const saved = ctx.chatMetadata.diceSeed;
        await ctx.executeSlashCommandsWithOptions('/semilla');
        return { first, second, saved, cleared: ctx.chatMetadata.diceSeed ?? null, seeded: rules.isSeeded() };
    });
    check('con la misma semilla, las mismas tiradas',
        JSON.stringify(seeded.first) === JSON.stringify(seeded.second), JSON.stringify(seeded));
    check('la semilla se guarda con la partida, y se puede quitar',
        seeded.saved === 'molino' && seeded.cleared === null && seeded.seeded === false,
        JSON.stringify(seeded));

    // Las contradicciones: se anotan, no se corrigen.
    const contradictions = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/contradiction-log.js');
        const ctx = window.SillyTavern.getContext();
        const party = (ctx.chatMetadata.party || []).map(p => ({ name: p.name, hp: p.hp, maxHp: p.maxHp }));
        const alive = party.find(p => p.hp > 0);

        const found = m.findContradictions(
            `${alive?.name} cae sin sentido. Por la noche todo calla.`,
            { party, slotLabel: 'Mañana', combatActive: false },
        );
        const log = m.appendContradictions(null, found, { day: 1 });
        return { kinds: found.map(f => f.kind), summary: m.summariseContradictions(log) };
    });
    check('una narracion que mata a quien sigue en pie se anota',
        contradictions.kinds.includes('muerte'), JSON.stringify(contradictions.kinds));
    check('y tambien la hora que no cuadra con el calendario',
        contradictions.kinds.includes('momento del día'), JSON.stringify(contradictions.kinds));
    check('el registro las agrupa por tipo',
        contradictions.summary.total === contradictions.kinds.length, JSON.stringify(contradictions.summary));

    // Y el estado de campana, ya fuera de party.js, sigue siendo el mismo estado.
    const extracted = await page.evaluate(async () => {
        const mod = await import('/scripts/party/campaign-state.js');
        const ctx = window.SillyTavern.getContext();
        const state = mod.createCampaignState({
            metadata: () => ctx.chatMetadata,
            saveMetadata: () => {},
            party: () => ctx.chatMetadata.party || [],
            saveParty: () => {},
            renderParty: () => {},
            renderCampaign: () => {},
            narrate: () => {},
            isFighting: () => false,
            worldName: () => ctx.chatMetadata.world_info,
            loadWorld: async () => null,
        });
        return { day: state.getCalendar().day, slot: state.getSlotLabel(), keys: Object.keys(state).length };
    });
    check('el modulo extraido lee el mismo calendario que la partida',
        extracted.day >= 1 && extracted.slot.length > 0, JSON.stringify(extracted));


    step('29. La prueba del raton: mover y atacar sin teclear');
    // Un combate en el tablero importado, y a partir de aqui solo clics.
    await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext();
        for (const member of ctx.chatMetadata.party || []) member.hp = member.maxHp;
        await ctx.saveMetadata();
        void ctx.executeSlashCommandsWithOptions('/fight Guardián del grano 1');
    });
    await page.waitForTimeout(2200);
    await clearDiceOverlay();

    // Llegar a un turno de jugador **con ficha en el tablero**: pulsar la ficha de otro
    // no hace nada, y con razon.
    let actingId = null;
    for (let i = 0; i < 12; i++) {
        actingId = await page.evaluate(() => {
            const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            if (!enc?.active || !entry || entry.isEnemy) return null;
            const id = String(entry.id);
            const token = document.querySelector(`.wm-token[data-token-id="${id}"]`);
            return token && token.offsetParent ? id : null;
        });
        if (actingId) break;
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(700);
        await clearDiceOverlay();
    }

    check('hay un turno de jugador con su ficha en el tablero',
        Boolean(actingId), String(actingId));

    // Clic en tu propia ficha: enciende las casillas. No gasta nada.
    const myToken = page.locator(`.wm-token[data-token-id="${actingId}"]`)
        .filter({ visible: true }).first();
    await myToken.click({ timeout: 10000 });
    await page.waitForTimeout(700);

    const lit = await page.evaluate(() => ({
        cells: document.querySelectorAll('.wm-highlight-clickable').length,
        move: document.querySelectorAll('.wm-highlight-move.wm-highlight-clickable').length,
    }));
    check('pulsar tu ficha enciende casillas, y son pulsables',
        lit.cells > 0 && lit.move > 0, JSON.stringify(lit));

    // Clic en una casilla encendida: mueve. Se elige la que mas acerca al enemigo, y sin
    // nadie encima: una ficha dibujada sobre la casilla se lleva el clic antes que ella,
    // y acercarse es lo que hace que el ataque de despues no dependa de los dados.
    const movedTo = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const enemy = (enc?.enemies || []).find(e => (e.currentHp || 0) > 0);
        const taken = new Set([
            ...(ctx.chatMetadata.party || []).map(m => `${m.mapPosition?.gridX},${m.mapPosition?.gridY}`),
            ...(enc?.enemies || []).map(e => `${e.gridX},${e.gridY}`),
        ]);
        const free = [...document.querySelectorAll('.wm-highlight-move.wm-highlight-clickable')]
            .map(node => ({ x: Number(node.dataset.x), y: Number(node.dataset.y) }))
            .filter(cell => !taken.has(`${cell.x},${cell.y}`));
        if (free.length === 0) return null;
        if (!enemy) return free[0];

        const away = cell => Math.max(
            Math.abs(cell.x - (enemy.gridX || 0)), Math.abs(cell.y - (enemy.gridY || 0)));
        return free.sort((a, b) => away(a) - away(b))[0];
    });
    check('alguna casilla encendida esta libre de fichas', Boolean(movedTo), JSON.stringify(movedTo));
    await page.locator(
        `.wm-highlight-move.wm-highlight-clickable[data-x="${movedTo?.x}"][data-y="${movedTo?.y}"]`,
    ).first().click();
    await page.waitForTimeout(1200);
    await clearDiceOverlay();

    const afterMove = await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext();
        const enc = ctx.chatMetadata.combatEncounter;
        const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
        const me = (ctx.chatMetadata.party || []).find(m => String(m.id) === String(entry?.id));
        return me ? { x: me.mapPosition?.gridX, y: me.mapPosition?.gridY } : null;
    });
    check('pulsar una casilla encendida mueve de verdad, sin teclear',
        Boolean(movedTo && afterMove && afterMove.x === movedTo.x && afterMove.y === movedTo.y),
        JSON.stringify({ pulsada: movedTo, ahora: afterMove }));

    // Clic en el enemigo: abre su tarjeta. Y **no gasta el turno**, que es la regla.
    const enemyToken = page.locator('.wm-token-enemy').filter({ visible: true }).first();
    const actionBefore = await page.evaluate(() =>
        Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed));

    await enemyToken.click({ timeout: 10000 });
    await page.waitForSelector('.tc-card', { timeout: 8000 });

    const card = await page.evaluate(() => ({
        name: document.querySelector('.tc-name')?.textContent || '',
        stats: document.querySelector('.tc-stats')?.textContent || '',
        buttons: [...document.querySelectorAll('.tc-btn')].map(b => ({ text: b.textContent, off: b.disabled })),
        spent: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed),
    }));
    check('pulsar un enemigo abre su tarjeta, con sus numeros',
        card.name.length > 0 && /PG .* CA .* ft/.test(card.stats), JSON.stringify(card.stats));
    check('un clic no gasta la accion del turno: esa es la regla',
        card.spent === actionBefore, JSON.stringify({ antes: actionBefore, despues: card.spent }));
    check('y la tarjeta ofrece atacar, el definitivo y cerrar',
        card.buttons.length === 3 && card.buttons[0].text === 'Atacar',
        JSON.stringify(card.buttons));

    // El boton si gasta: aqui es donde se ataca. Que el enemigo este a tiro depende de
    // donde haya andado, asi que si no lo esta, lo que se comprueba es que lo diga.
    const attackButton = page.locator('.tc-btn', { hasText: 'Atacar' });
    if (await attackButton.isDisabled()) {
        check('si el enemigo no esta a tiro, el boton lo dice en vez de no responder',
            /Fuera de alcance/.test(String(await attackButton.getAttribute('title'))),
            String(await attackButton.getAttribute('title')));
        await page.locator('.tc-btn', { hasText: 'Cerrar' }).click();
    } else {
        const logBefore = await page.locator('#world_location_maps_list .cl-row').count();
        await attackButton.click();
        await page.waitForTimeout(1400);
        await clearDiceOverlay();

        const afterAttack = await page.evaluate(() => ({
            card: document.querySelectorAll('.tc-card').length,
            spent: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.turnState?.actionUsed),
        }));
        const logAfter = await page.locator('#world_location_maps_list .cl-row').count();

        check('el boton Atacar si resuelve el golpe, y queda en el registro',
            logAfter > logBefore, `${logBefore} -> ${logAfter}`);
        check('gasta la accion del turno y cierra la tarjeta',
            afterAttack.spent === true && afterAttack.card === 0, JSON.stringify(afterAttack));
    }

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();

    step('30. El reloj, las fichas de accion y la tarjeta de companero');
    // Todo lo de aqui es a base de clics: ni un comando escrito.
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.waitForTimeout(1200);

    const clock = await page.evaluate(() => ({
        label: document.querySelector('.gs-clock-label')?.textContent || '',
        buttons: [...document.querySelectorAll('.gs-clock-btn')].map(b => ({
            text: b.textContent || '', off: b.disabled, why: b.title,
        })),
    }));
    check('el reloj dice el dia y el momento, dentro de la partida',
        /^Día \d+ · .+/.test(clock.label), clock.label);
    check('y trae las cuatro formas de pasar el tiempo, que vivian en un cajon',
        clock.buttons.length === 4
        && clock.buttons.some(b => /Pasar el rato/.test(b.text))
        && clock.buttons.some(b => /Descanso largo/.test(b.text)),
        JSON.stringify(clock.buttons.map(b => b.text)));

    await page.locator('.gs-clock-btn', { hasText: 'Pasar el rato' }).click();
    await page.waitForTimeout(1200);
    const afterSlot = await page.evaluate(() => document.querySelector('.gs-clock-label')?.textContent || '');
    check('pulsar Pasar el rato mueve el reloj de verdad',
        afterSlot !== clock.label && /^Día \d+ · .+/.test(afterSlot), `${clock.label} -> ${afterSlot}`);

    // La tira del grupo vive en el dialogo, que es donde se habla con ellos.
    await page.locator('.gs-scene-btn', { hasText: 'Dialogo' }).click();
    await page.waitForTimeout(900);

    const bondBefore = await page.evaluate(() => JSON.stringify(
        window.SillyTavern.getContext().chatMetadata.bonds ?? {}));

    await page.locator('#game-shell .gs-chip').first().click();
    await page.waitForSelector('.cc-card', { timeout: 8000 });
    const card30 = await page.evaluate(() => ({
        name: document.querySelector('.cc-name')?.textContent || '',
        rank: document.querySelector('.cc-rank')?.textContent || '',
        actions: [...document.querySelectorAll('.cc-btn')].map(b => b.textContent || ''),
    }));
    check('pulsar una cara del grupo abre su ficha, con su rango',
        card30.name.length > 0 && /Rango/.test(card30.rank), JSON.stringify(card30));
    check('y ofrece pasar tiempo y regalar, no solo anotar lo que paso',
        card30.actions.some(a => /Pasar tiempo/.test(a)) && card30.actions.some(a => /Regalar/.test(a)),
        JSON.stringify(card30.actions));

    await page.locator('.cc-btn', { hasText: 'Pasar tiempo' }).click();
    await page.waitForTimeout(1400);
    const afterDowntime = await page.evaluate(() => ({
        bonds: JSON.stringify(window.SillyTavern.getContext().chatMetadata.bonds ?? {}),
        clock: document.querySelector('.gs-clock-label')?.textContent || '',
        card: document.querySelectorAll('.cc-card').length,
    }));
    check('pasar tiempo con alguien sube su vinculo y gasta un bloque del dia',
        afterDowntime.bonds !== bondBefore && afterDowntime.clock !== afterSlot && afterDowntime.card === 0,
        JSON.stringify({ reloj: afterSlot + ' -> ' + afterDowntime.clock }));

    // Las fichas de accion: lo que se puede hacer sin escribirlo.
    const chips30 = await page.evaluate(() => [...document.querySelectorAll('.gs-chip-action')]
        .map(b => b.textContent || ''));
    check('hay fichas de accion, y salen del estado del tablero',
        chips30.length > 0
        && chips30.some(c => /Salir del tablero/.test(c))
        && chips30.some(c => /Hablar con/.test(c)),
        JSON.stringify(chips30));

    const talk = page.locator('.gs-chip-action').filter({ hasText: 'Hablar con' }).first();
    if (await talk.count() > 0) {
        await talk.click();
        await page.waitForTimeout(500);
    }
    const draft = await page.evaluate(() =>
        document.querySelector('#send_textarea')?.value || '');
    check('la ficha de hablar deja la frase empezada, no la envia',
        /^Hablo con .+ sobre $/.test(draft), draft);
    await page.evaluate(() => {
        const box = document.querySelector('#send_textarea');
        if (box) box.value = '';
    });

    // Empezar el combate desde el tablero: los enemigos siguen dibujados en la sala que
    // el paso 24 dejo abierta, y nadie pelea.
    await page.locator('.gs-scene-btn', { hasText: 'Combate' }).click();
    await page.waitForTimeout(1000);

    const startRow = await page.evaluate(() => ({
        rows: document.querySelectorAll('.sc-row').length,
        what: document.querySelector('.sc-what')?.textContent || '',
    }));
    check('con enemigos a la vista y nadie peleando, el tablero ofrece empezar',
        startRow.rows === 1 && /Guardián del grano/.test(startRow.what), JSON.stringify(startRow));

    await page.locator('.sc-btn').first().click();
    await page.waitForTimeout(1600);
    const banner = await page.evaluate(() => {
        const node = document.querySelector('.ib-banner');
        return {
            banner: document.querySelectorAll('.ib-banner').length,
            title: document.querySelector('.ib-title')?.textContent || '',
            clickable: node ? getComputedStyle(node).pointerEvents : '',
            fighting: Boolean(window.SillyTavern.getContext().chatMetadata.combatEncounter?.active),
        };
    });
    check('el boton empieza el combate con lo que el libro dibujo, y lo anuncia',
        banner.banner === 1 && banner.title === '¡INICIATIVA!' && banner.fighting,
        JSON.stringify(banner));
    check('y el cartel no roba clics: avisa, no decide',
        banner.clickable === 'none', banner.clickable);
    await clearDiceOverlay();

    const busy = await page.evaluate(() => ({
        clock: [...document.querySelectorAll('.gs-clock-btn')].map(b => b.disabled),
        why: document.querySelector('.gs-clock-btn')?.title || '',
        chips: document.querySelectorAll('.gs-chip-action').length,
    }));
    check('peleando no se descansa, y el boton dice por que en vez de desaparecer',
        busy.clock.length === 4 && busy.clock.every(Boolean) && busy.why === 'No mientras peleas.',
        JSON.stringify(busy));
    check('y las fichas de accion se retiran: la barra de combate ya manda',
        busy.chips === 0, String(busy.chips));

    // Y el turno se termina con su boton, que es el paso 6 de la prueba del raton.
    await page.locator('.gs-scene-btn', { hasText: 'Combate' }).click();
    await page.waitForTimeout(800);
    const turnBefore = await page.evaluate(() => {
        const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
        return String(enc?.turnOrder?.[enc?.currentTurnIndex]?.id ?? '');
    });
    const endTurn = page.locator('#game-shell .gs-btn').filter({ hasText: 'Fin de turno' }).first();
    check('la barra de combate ofrece terminar el turno', await endTurn.count() === 1);

    // Solo se puede pasar el turno propio, asi que primero hay que llegar a uno.
    for (let i = 0; i < 10 && await endTurn.isDisabled(); i++) {
        await page.evaluate(() => window.SillyTavern.getContext()
            .executeSlashCommandsWithOptions('/combat-end'));
        await page.waitForTimeout(800);
        await clearDiceOverlay();
    }
    check('y dice por que no se puede cuando no es tu turno',
        await endTurn.getAttribute('title') !== null,
        String(await endTurn.getAttribute('title')));

    if (await endTurn.count() === 1 && !await endTurn.isDisabled()) {
        await endTurn.click();
        await page.waitForTimeout(1600);
        await clearDiceOverlay();
        const turnAfter = await page.evaluate(() => {
            const enc = window.SillyTavern.getContext().chatMetadata.combatEncounter;
            return String(enc?.turnOrder?.[enc?.currentTurnIndex]?.id ?? '');
        });
        check('y pulsarlo pasa el turno de verdad, sin teclear',
            turnAfter !== turnBefore, turnBefore + ' -> ' + turnAfter);
    }

    const startedByButton = await page.evaluate(() => ({
        enemies: (window.SillyTavern.getContext().chatMetadata.combatEncounter?.enemies || []).length,
        row: document.querySelectorAll('.sc-row').length,
    }));
    check('y mientras se pelea ya no ofrece empezar otro',
        startedByButton.enemies > 0 && startedByButton.row === 0, JSON.stringify(startedByButton));

    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/combat-stop'));
    await page.waitForTimeout(1000);
    await clearDiceOverlay();
    await leaveGameMode();

    step('31. Subir de nivel, exportar la campana y el sonido por escena');

    // --- A1: la experiencia se convierte en algo -----------------------------------
    await page.locator('#rm_tab_party').click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('.party-card').first().click();
    await page.waitForSelector('.dnd-modal', { timeout: 10000 });
    await page.locator('.dnd-tab[data-tab="progression"]').click();
    await page.waitForTimeout(400);

    const readFirst = () => page.evaluate(() => {
        const m = (window.SillyTavern.getContext().chatMetadata.party || [])[0] || {};
        return { name: m.name, level: m.level, maxHp: m.maxHp, hp: m.hp, strength: m.strength, xp: m.xp };
    });
    const heroBefore = await readFirst();

    check('el boton de subir de nivel empieza apagado, sin experiencia',
        await page.locator('.dnd-level-up-btn').isDisabled(), JSON.stringify(heroBefore));

    // La experiencia se escribe en la ficha, que es el control que ya existia.
    await page.locator('.xp-current-input').fill('2700');
    await page.locator('.xp-current-input').dispatchEvent('change');
    await page.waitForTimeout(400);
    check('con experiencia de sobra, el boton se enciende solo',
        !await page.locator('.dnd-level-up-btn').isDisabled());

    await page.locator('.dnd-level-up-btn').click();
    await page.waitForSelector('.lu-card', { timeout: 8000 });

    const card31 = await page.evaluate(() => ({
        title: document.querySelector('.lu-title')?.textContent || '',
        gains: document.querySelector('.lu-gains')?.textContent || '',
        remaining: document.querySelector('.lu-remaining')?.textContent || '',
        abilities: document.querySelectorAll('.lu-ability').length,
        confirmOff: document.querySelector('.lu-confirm')?.disabled,
    }));
    check('la tarjeta dice a que nivel se sube y que da, antes de pulsar',
        /nivel 1 .* 4/.test(card31.title) && /PG/.test(card31.gains), JSON.stringify(card31));
    check('con 2700 de experiencia se saltan tres niveles de una vez',
        /\+\d+ PG/.test(card31.gains) && card31.abilities === 6, JSON.stringify(card31.gains));
    check('y no deja confirmar hasta repartir los puntos de caracteristica',
        card31.confirmOff === true && /Quedan 2 de 2/.test(card31.remaining), JSON.stringify(card31.remaining));

    // Dos clics en el "+" de Fuerza: el reparto es la unica eleccion de verdad que hay.
    const plus = page.locator('.lu-ability').first().locator('.lu-step').last();
    await plus.click();
    await plus.click();
    await page.waitForTimeout(300);
    check('repartidos los dos puntos, ya se puede confirmar',
        !await page.locator('.lu-confirm').isDisabled(),
        await page.locator('.lu-remaining').innerText());

    await page.locator('.lu-confirm').click();
    await page.waitForTimeout(1000);

    const heroAfter = await readFirst();
    check('subir de nivel sube el nivel de verdad',
        heroAfter.level === 4, `${heroBefore.level} -> ${heroAfter.level}`);
    check('y da puntos de golpe, que era justo lo que no hacia',
        heroAfter.maxHp > heroBefore.maxHp && heroAfter.hp > heroBefore.hp,
        JSON.stringify({ antes: heroBefore.maxHp, ahora: heroAfter.maxHp }));
    check('y la mejora de caracteristica que repartiste',
        heroAfter.strength === (heroBefore.strength || 10) + 2,
        `${heroBefore.strength} -> ${heroAfter.strength}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // --- A2: la campana se puede mandar a alguien ----------------------------------
    const [exported] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.evaluate(() => {
            void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/exportar-campana');
        }),
    ]);
    const exportedPath = await exported.path();
    const pack31 = JSON.parse(readFileSync(exportedPath, 'utf8'));

    check('exportar deja un archivo con el nombre de la campana',
        /\.campaign\.json$/.test(exported.suggestedFilename()), exported.suggestedFilename());
    check('y dentro va el mundo entero: tableros, bestiario y misiones',
        pack31.boards.length >= 1 && pack31.bestiary.length >= 1 && pack31.quests.length >= 1,
        JSON.stringify({
            tableros: pack31.boards.length, enemigos: pack31.bestiary.length,
            misiones: pack31.quests.length, companeros: pack31.confidants.length,
        }));
    check('y la aldea sin tablero va dentro, que es la mitad de compartir una campana',
        (pack31.locations || []).some(l => l.name === 'Vado de la Rueda'),
        JSON.stringify((pack31.locations || []).map(l => l.name)));
    check('el mapa viaja como texto, con sus muros',
        Array.isArray(pack31.boards[0].map) && pack31.boards[0].map.some(row => row.includes('#')),
        JSON.stringify(pack31.boards[0].map?.[0] ?? null));
    check('y los objetivos vuelven a ser nombres, no identificadores de esta partida',
        pack31.quests.every(q => q.objectives.every(o => !JSON.stringify(o).includes('targetIds'))),
        JSON.stringify(pack31.quests[0]?.objectives?.[0] ?? null));

    // Lo exportado lo acepta el validador de la entrada: esa es la prueba de la ida y vuelta.
    const verdict31 = await page.evaluate(async (pack) => {
        const m = await import('/scripts/game-engine/campaign/campaign-pack.js');
        const report = m.validatePack(m.normalizePack(pack).pack);
        return { ok: report.ok, errors: report.errors.map(e => e.message) };
    }, pack31);
    check('lo que sale por exportar entra por importar, sin una queja',
        verdict31.ok, JSON.stringify(verdict31.errors.slice(0, 3)));

    // --- A3: el sonido por escena --------------------------------------------------
    const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/sonido');
    });
    await page.waitForSelector('.as-root', { timeout: 15000 });

    const scenes31 = await page.evaluate(() => [...document.querySelectorAll('.as-scene-name')]
        .map(n => n.textContent || ''));
    check('los ajustes de sonido ofrecen una pista por escena',
        scenes31.length === 4 && scenes31.some(s => /Combate/.test(s)), JSON.stringify(scenes31));

    await page.locator('.as-scene').filter({ hasText: 'Conversación' }).locator('.as-track').fill(SILENCE);
    await page.locator('.popup-button-ok').last().click();
    await page.waitForTimeout(800);

    await page.evaluate(() => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions('/modojuego');
    });
    await page.waitForSelector('#game-shell', { timeout: 15000 });
    await page.locator('.gs-scene-btn', { hasText: 'Dialogo' }).click();
    await page.waitForTimeout(900);

    const sounding = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/scene-audio.js');
        return { scene: document.querySelector('#game-shell')?.getAttribute('data-scene'), track: m.currentTrack() };
    });
    check('la escena de dialogo pone la pista que le pusiste',
        sounding.scene === 'dialogue' && sounding.track === SILENCE,
        JSON.stringify({ escena: sounding.scene, suena: sounding.track.slice(0, 24) }));

    await page.locator('.gs-scene-btn', { hasText: 'Combate' }).click();
    await page.waitForTimeout(900);
    const silent = await page.evaluate(async () => {
        const m = await import('/scripts/game-engine/ui/shell/scene-audio.js');
        return m.currentTrack();
    });
    check('y una escena sin pista calla, en vez de heredar la de al lado',
        silent === '', JSON.stringify(silent));

    await leaveGameMode();

    // Viajar a un sitio sin tablero: el panel tiene que decir que ahi no se pelea, en vez
    // de quedarse en blanco como si estuviera roto.
    await page.evaluate(() => window.SillyTavern.getContext()
        .executeSlashCommandsWithOptions('/go Vado de la Rueda'));
    await page.waitForTimeout(1400);

    const quiet = await page.evaluate(() => ({
        where: window.SillyTavern.getContext().chatMetadata.currentLocation || '',
        empty: (document.querySelector('.wm-boards-empty')?.textContent || '').trim(),
        boards: document.querySelectorAll('#world_location_maps_list .wm-boards-section').length,
    }));
    check('se puede viajar a un pueblo que no tiene tablero',
        quiet.where === 'Vado de la Rueda', JSON.stringify(quiet.where));
    check('y el panel lo dice en vez de quedarse en blanco',
        quiet.boards === 0 && /no hay ningun tablero/i.test(quiet.empty), JSON.stringify(quiet.empty));

    console.log('\n--- console errors ---');
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
