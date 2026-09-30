/**
 * El jugador automático de las vueltas (J16 de wiki/ROADMAP_SIN_CONEXION.md): mira la
 * pantalla y pulsa, como quien juega con el ratón, sin escribir nada. Lo usan
 * `tools/vuelta-1387.mjs` y `tools/vuelta-gremio.mjs`.
 *
 * Cada paso es una sola cosa: pasar los dados, elegir una opción de una escena, «Seguir»,
 * cerrar una ventana, una ficha de la fila, un sitio del mapa, un botón de la pelea… Y tras
 * cada paso mira si ha cambiado algo que se vea. Si no, es un **silencio**. Si no hay nada
 * que pulsar para seguir, o lo que pide la historia no está a la vista, es un **atasco**.
 *
 * Lo que decide lo toma del paquete de la campaña (lo que pide el hito abierto), como quien
 * lee «Lo que tienes entre manos»; lo que hace, solo con clics. Cuando se atasca, lo apunta y
 * sigue con un comando (un «rescate»), para medir también lo que viene detrás.
 *
 * Los ganchos de prueba, los mismos que las otras vueltas: en «rápido», los enemigos de cada
 * pelea a un golpe y al lado del héroe (lo que se mide aquí es el camino, no las peleas; las
 * peleas las mide `tools/sim-campana.mjs`).
 */

/* global window, document */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {object} Target Lo que pide la historia ahora, dicho para el bot.
 * @property {string} id El hito.
 * @property {string} kind win | defeat | talk | arrive | check | clues | none
 * @property {string} [place] Dónde hay que estar.
 * @property {string} [board] El tablero que hay que ganar.
 * @property {string} [npc] Con quién hay que hablar.
 * @property {string} [skill] La tirada que se pide.
 * @property {string} [enemy] A quién hay que derrotar.
 */

/**
 * Lo que se ve ahora, en una sola lectura.
 *
 * @param {any} page
 * @returns {Promise<any>}
 */
export function observe(page) {
    // Una página colgada (un bucle sin fin) no contesta: mejor saberlo que esperar para siempre.
    /** @type {any} */
    let timer = null;
    const frozen = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('la página no contesta en 30 s')), 30000); });
    return Promise.race([frozen, page.evaluate(async () => {
        const seen = (/** @type {Element|null|undefined} */ n) => {
            if (!n) return false;
            const box = n.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && window.getComputedStyle(n).visibility !== 'hidden';
        };
        const said = (/** @type {Element|null|undefined} */ n) => (n?.textContent || '').replace(/\s+/g, ' ').trim();
        const ctx = window.SillyTavern?.getContext?.();
        const meta = ctx?.chatMetadata || {};
        const chat = ctx?.chat || [];
        const shell = document.querySelector('#game-shell');
        const dialogs = [...document.querySelectorAll('dialog[open]:not([closing])')].filter(d => seen(d));
        // La de encima es la que recibe el clic en el centro de la pantalla (una ventana abierta
        // después tapa a la anterior aunque vaya antes en la página); si no, la última.
        const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        const top = /** @type {Element|null} */ (hit?.closest('dialog[open]')) ?? dialogs[dialogs.length - 1] ?? null;
        document.querySelectorAll('[data-vuelta-top]').forEach(d => d.removeAttribute('data-vuelta-top'));
        top?.setAttribute('data-vuelta-top', '');
        const dice = document.querySelector('.wm-dice-overlay.active');
        /** @type {any} */
        let layer = null;
        if (top) {
            const qd = top.querySelector('.qd-root');
            const kind = top.querySelector('.end-root') ? 'end'
                : top.querySelector('.su-root') ? 'suceso'
                    : top.querySelector('.tk-root') ? 'talk'
                        : qd ? (top.classList.contains('ps-dialog') ? 'scene' : top.classList.contains('dw-dialog') ? 'dialogue' : 'meetup')
                            : top.querySelector('.hb-root') ? 'hub'
                                : top.classList.contains('lb-dialog') ? 'book'
                                    : 'popup';
            layer = {
                kind,
                id: top.querySelector('.ps-root')?.getAttribute('data-scene') || top.querySelector('.dw-root')?.getAttribute('data-dialogue')
                    || top.querySelector('.su-root')?.getAttribute('data-suceso') || '',
                title: said(top.querySelector('.qd-title, .gs-popup-title, h3, h2')).slice(0, 120),
                text: said(top.querySelector('.qd-text') || top.querySelector('.su-text') || top.querySelector('.tk-log') || top).slice(0, 400),
                options: [...top.querySelectorAll('.dw-option')].filter(seen).map(o => ({
                    id: o.getAttribute('data-option') || '', locked: o.classList.contains('dw-locked'), text: said(o).slice(0, 120),
                })),
                buttons: [...top.querySelectorAll('button, .menu_button')].filter(b => seen(b) && !(/** @type {HTMLButtonElement} */ (b).disabled))
                    .map(b => said(b).slice(0, 60)).filter(Boolean).slice(0, 16),
            };
        }
        const party = await import('/scripts/party.js');
        const enc = /** @type {any} */ (party.getCombatEncounter?.());
        const turn = enc?.active ? enc.turnOrder?.[enc.currentTurnIndex] : null;
        const members = party.getPartyMembersSnapshot?.() || [];
        const hero = members.find((/** @type {any} */ m) => !m.guest) || members[0] || null;
        const vnText = said(document.querySelector('#game-shell .gs-vn-text'));
        const chips = [...document.querySelectorAll('#game-shell .gs-chip-action')].filter(seen).map(c => said(c));
        const view = {
            scene: shell?.getAttribute('data-scene') || '',
            offline: Boolean(document.querySelector('#game-shell.gs-offline, .gs-offline')),
            menu: [...document.querySelectorAll('#game-shell .gs-menu-btn')].filter(seen).map(b => said(b.querySelector('.gs-menu-label') || b)),
            // Los dados, si no los tapa una ventana.
            dice: Boolean(dice) && (!top || Boolean(hit && dice.contains(hit))),
            diceText: said(document.querySelector('.wm-dice-overlay.active .wm-dice-card')).slice(0, 120),
            pause: seen(document.querySelector('#game-shell .gs-pause')),
            layer,
            dialogs: dialogs.length,
            vn: { text: vnText.slice(0, 400), next: document.querySelector('#game-shell .gs-vn-box .gs-chip-continue')?.getAttribute('data-next') || '' },
            focus: said(document.querySelector('#game-shell .gs-focus-title')) + (document.querySelector('#game-shell .gs-focus-hint') ? ` — ${said(document.querySelector('#game-shell .gs-focus-hint'))}` : ''),
            chips: [...new Set(chips)],
            town: {
                places: [...document.querySelectorAll('#game-shell .gs-town-place')].filter(seen).map(p => ({ id: p.getAttribute('data-place') || '', text: said(p).slice(0, 120) })),
                inside: document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '',
                acts: [...document.querySelectorAll('#game-shell .gs-town-act')].filter(seen).map(b => ({ id: b.getAttribute('data-action') || '', text: said(b).slice(0, 80), off: Boolean(/** @type {HTMLButtonElement} */ (b).disabled) })),
            },
            places: [...document.querySelectorAll('#game-shell .gs-place')].filter(seen).map(p => ({
                name: said(p.querySelector('.gs-place-name')), note: said(p).slice(0, 160), off: Boolean(/** @type {HTMLButtonElement} */ (p).disabled),
            })),
            boards: [...document.querySelectorAll('#game-shell .gs-board')].filter(seen).map(b => said(b.querySelector('.gs-board-name'))),
            bar: [...document.querySelectorAll('#game-shell .gs-actions .gs-btn')].filter(seen).map(b => ({ text: said(b), off: Boolean(/** @type {HTMLButtonElement} */ (b).disabled) })),
            world: String(meta.world_info || ''),
            location: String(meta.currentLocation || ''),
            board: String(meta.currentBoard || ''),
            open: [...(meta.plotState?.open || [])],
            done: [...(meta.plotState?.done || [])],
            ending: String(meta.plotState?.ending || ''),
            fight: enc?.active ? {
                round: Number(enc.round) || 0,
                mine: Boolean(turn && !turn.isEnemy),
                who: String(turn?.name || ''),
                foes: (enc.enemies || []).filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0).map((/** @type {any} */ e) => String(e.name)),
            } : null,
            hero: hero ? { name: String(hero.name), hp: Number(hero.hp) || 0, maxHp: Number(hero.maxHp) || 0, level: Number(hero.level) || 1, xp: Number(hero.xp) || 0, gold: Number(hero.gold) || 0 } : null,
            party: members.map((/** @type {any} */ m) => String(m.name)),
            day: Number(/^Día (\d+)/.exec(said(document.querySelector('#game-shell .gs-clock-label')))?.[1]) || 0,
            chat: chat.length,
            last: String(chat[chat.length - 1]?.extra?.display_text ?? chat[chat.length - 1]?.mes ?? '').slice(0, 200),
            toasts: [...document.querySelectorAll('#toast-container .toast')].map(t => said(t).slice(0, 160)),
            box: document.querySelectorAll('#send_textarea').length > 0 && seen(document.querySelector('#send_form')),
        };
        // Lo que tiene que cambiar tras un clic para que no sea un silencio.
        /** @type {any} */ (view).print = JSON.stringify([
            view.scene, view.dice, view.diceText, layer?.kind, layer?.id, layer?.text, layer?.options?.length, view.dialogs, view.vn, view.focus, view.chips,
            view.town.inside, view.town.places.length, view.town.acts.map(a => a.text), view.location, view.board, view.done.length, view.fight,
            view.hero?.hp, view.hero?.gold, view.chat, view.last, view.toasts, view.menu, view.day,
            document.querySelector('#game-shell .gs-targets') ? said(document.querySelector('#game-shell .gs-targets')).slice(0, 80) : '',
            document.querySelector('.hc-root') ? 'hc' : '',
        ]);
        return view;
    })]).finally(() => clearTimeout(timer));
}

/** Las palabras que quitan los acentos, para comparar nombres como los lee una persona. */
export const plain = (/** @type {string} */ v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * @param {any} page
 * @param {object} [options]
 * @param {boolean} [options.fast] Peleas a un golpe (el gancho de las otras vueltas).
 * @param {(line: string) => void} [options.log]
 * @param {string[]} [options.prefer] Opciones de escena que se prefieren, por su id o por un trozo de su texto.
 */
export function createBot(page, { fast = true, log = console.log, prefer = [] } = {}) {
    const started = Date.now();
    /** @type {Array<{n: number, what: string, silent: boolean, ms: number, where: string}>} */
    const steps = [];
    /** @type {Array<{n: number, where: string, what: string, sees: string, module: string}>} */
    const silences = [];
    /** @type {Array<{n: number, where: string, goal: string, sees: string, module: string, rescue: string}>} */
    const blocks = [];
    /** @type {Array<{scene: string, option: string}>} */
    const choices = [];
    const counts = { scenes: 0, options: 0, sucesos: 0, talks: 0, fights: 0, won: 0, travels: 0, popups: 0, checks: 0 };
    /** @type {number|null} */
    let firstDecisionAt = null;
    /** @type {Map<string, number>} */
    const talkTopics = new Map();

    const until = async (/** @type {() => Promise<boolean>} */ test, ms = 3000, every = 150) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (await test().catch(() => false)) return true;
            await page.waitForTimeout(every);
        }
        return false;
    };
    /** Un clic de verdad (respeta lo que tapa): si no se puede, false. */
    /** Por qué no se pudo pulsar lo último que no se pudo pulsar (lo que lo tapaba, sobre todo). */
    let pressError = '';
    const press = async (/** @type {any} */ locator, ms = 1500) => {
        if (await locator.count() === 0) {
            pressError = 'no está';
            return false;
        }
        return locator.first().click({ timeout: ms }).then(() => true).catch((/** @type {any} */ e) => {
            const text = String(e?.message || e);
            pressError = (/<[^>]+> from <[^>]+> subtree intercepts pointer events|<[^>]+> intercepts pointer events|element is not (visible|enabled|stable)|element is outside of the viewport/.exec(text)?.[0] ?? text.split('\n')[0]).slice(0, 200);
            return false;
        });
    };
    const where = (/** @type {any} */ v) => `${v.world.replace(/ · .*/, '')} · ${v.location || '—'}${v.board ? ` · ${v.board}` : ''} · día ${v.day}`;
    const describe = (/** @type {any} */ v) => v.layer
        ? `ventana «${v.layer.kind}» ${v.layer.id || v.layer.title}: ${v.layer.text.slice(0, 140)} [${v.layer.buttons.join(' | ')}]`
        : `escena ${v.scene}; caja: «${v.vn.text.slice(0, 100)}»; fichas: ${v.chips.join(' · ')}; lo que toca: ${v.focus.slice(0, 120)}`;

    /**
     * Hace una cosa y mira si se ve algo nuevo.
     *
     * @param {any} before
     * @param {string} what
     * @param {() => Promise<boolean>} run
     * @param {{quiet?: boolean, module?: string, wait?: number}} [how] quiet: no cuenta como silencio (esperar a los dados).
     */
    const act = async (before, what, run, how = {}) => {
        const t0 = Date.now();
        const did = await run();
        if (!did) {
            // No se pudo pulsar (lo tapa algo, o ya no está): no es un silencio del juego, pero se apunta.
            steps.push({ n: steps.length + 1, what: `${what} (no se pudo pulsar: ${pressError})`, silent: false, ms: Date.now() - t0, where: where(before) });
            if (process.env.VUELTA_VER) log(`  ✗ ${what}: ${pressError}`);
            return false;
        }
        let after = before;
        const changed = await until(async () => {
            after = await observe(page);
            return after.print !== before.print;
        }, how.wait ?? 2500);
        await page.waitForTimeout(120);
        const silent = did && !changed && !how.quiet;
        const entry = { n: steps.length + 1, what, silent, ms: Date.now() - t0, where: where(before) };
        steps.push(entry);
        if (silent) {
            silences.push({ n: entry.n, where: entry.where, what, sees: describe(before), module: how.module || '' });
            log(`MUDO  #${entry.n} ${what} (${entry.where})`);
        }
        return did;
    };
    const noteBlock = (/** @type {any} */ v, /** @type {string} */ goal, /** @type {string} */ module, /** @type {string} */ rescue) => {
        const entry = { n: steps.length, where: where(v), goal, sees: describe(v), module, rescue };
        blocks.push(entry);
        log(`ATASCO #${entry.n} ${goal} (${entry.where}) → ${rescue || 'sin rescate'}\n        se ve: ${entry.sees.slice(0, 300)}`);
    };
    const markDecision = () => {
        if (firstDecisionAt === null) firstDecisionAt = Date.now();
    };
    /** Un comando, como rescate: no lo haría quien juega. */
    const slash = (/** @type {string} */ command) => page.evaluate((c) => {
        void window.SillyTavern.getContext().executeSlashCommandsWithOptions(c).catch(() => '');
    }, command);

    /** Elegir entre las opciones de una escena o una charla: lo preferido, si no la primera abierta. */
    const pickOption = (/** @type {any[]} */ options) => {
        const free = options.filter(o => !o.locked);
        for (const want of prefer) {
            const hit = free.find(o => o.id === want || plain(o.text).includes(plain(want)));
            if (hit) return hit;
        }
        // Quien juega con cabeza no amenaza ni ataca de primeras: lo que no lo dice, antes.
        return free.find(o => !/amenaz|atac|desenvain|mano a la espada|pegar/i.test(o.text)) ?? free[0];
    };

    /**
     * Lo que está encima de todo: dados y ventanas. Devuelve true si hizo algo.
     *
     * @param {any} v
     * @param {object} hooks
     * @param {(v: any) => Promise<boolean>} [hooks.onHub] El tablón y los mercenarios: los decide quien corre la vuelta.
     * @param {(v: any) => Promise<boolean>} [hooks.onEnd] El final de la campaña.
     */
    const handleLayer = async (v, { onHub, onEnd } = {}) => {
        // La pausa no la abre la vuelta a propósito: se cierra con su «Continuar».
        if (v.pause && !v.layer) {
            const back = page.locator('#game-shell .gs-pause .gs-pause-btn:visible').filter({ hasText: /^Continuar/ });
            return act(v, 'cerrar la pausa', async () => (await press(back)) || page.keyboard.press('Escape').then(() => true), { quiet: true });
        }
        if (v.dice) {
            await act(v, `pasar los dados («${v.diceText.slice(0, 60)}»)`, () => press(page.locator('.wm-dice-overlay.active .wm-dice-next'), 2500), { quiet: true });
            return true;
        }
        const layer = v.layer;
        if (!layer) return false;
        const top = page.locator('dialog[data-vuelta-top]');
        if (layer.kind === 'end') return onEnd ? onEnd(v) : false;
        if (layer.kind === 'scene' || layer.kind === 'dialogue' || layer.kind === 'meetup') {
            if (!layer.text && layer.options.length === 0) {
                silences.push({ n: steps.length, where: where(v), what: `ventana ${layer.kind} ${layer.id} sin texto`, sees: describe(v), module: 'plot-scene.js / dialogue-window.js' });
                log(`MUDO  ventana ${layer.kind} ${layer.id} sin texto`);
            }
            const free = layer.options.filter((/** @type {any} */ o) => !o.locked);
            if (free.length > 0) {
                const choice = pickOption(layer.options);
                counts.options++;
                markDecision();
                choices.push({ scene: layer.id || layer.title, option: choice.text });
                return act(v, `elegir «${choice.text.slice(0, 60)}»`, async () => {
                    const option = top.locator(`.dw-option[data-option="${choice.id}"]`);
                    const ok = await press(option);
                    // Lo que no tiene vuelta atrás se decide a la segunda pulsación (J11.1).
                    await page.waitForTimeout(150);
                    if (await top.locator(`.dw-option.nr-armed[data-option="${choice.id}"]`).count() > 0) await press(option);
                    return ok;
                }, { module: layer.kind === 'scene' ? 'plot-scene.js' : 'dialogue-window.js' });
            }
            if (layer.kind === 'scene' && layer.id) counts.scenes += 0;
            const forward = top.locator('.qd-chip-next:visible, .qd-chip-finish:visible, .ps-finish:visible, .dw-finish:visible');
            if (await forward.count() > 0) return act(v, `«${(await forward.first().textContent() || '').replace(/[↵\s]+/g, ' ').trim()}»`, () => press(forward), { module: 'plot-scene.js' });
            const other = top.locator('.qd-chip:not(.dw-option):visible, .qd-pick-card:visible');
            if (await other.count() > 0) {
                markDecision();
                return act(v, `«${(await other.first().textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 50)}»`, () => press(other), { module: 'meetup-scene.js' });
            }
            const leave = top.locator('.qd-leave:not(.ps-skip):visible, .dw-leave:visible, .qd-pick-close:visible');
            if (await leave.count() > 0) return act(v, 'salir de la charla', () => press(leave), { module: 'dialogue-window.js' });
            noteBlock(v, `ventana ${layer.kind} sin nada que pulsar`, 'plot-scene.js / dialogue-window.js', 'Escape');
            await page.keyboard.press('Escape');
            return true;
        }
        if (layer.kind === 'suceso') {
            const option = top.locator('.su-option:not([disabled])');
            if (await option.count() > 0 && await top.locator('.su-go:visible').count() === 0) {
                counts.sucesos++;
                markDecision();
                choices.push({ scene: `suceso ${layer.id}`, option: (await option.first().textContent() || '').trim().slice(0, 80) });
                return act(v, `suceso ${layer.id}: la primera opción`, () => press(option), { module: 'sucesos' });
            }
            return act(v, `suceso ${layer.id}: seguir`, () => press(top.locator('.su-go')), { module: 'sucesos' });
        }
        if (layer.kind === 'talk') {
            const key = `${v.location}::${layer.title}`;
            const asked = talkTopics.get(key) ?? 0;
            const topics = top.locator('.tk-topic');
            if (asked < 2 && await topics.count() > asked) {
                talkTopics.set(key, asked + 1);
                markDecision();
                return act(v, `preguntar (${asked + 1})`, () => press(topics.nth(asked)), { module: 'talk.js' });
            }
            return act(v, 'dejar la charla', () => press(top.locator('.popup-button-ok')), { module: 'talk.js' });
        }
        if (layer.kind === 'hub') {
            if (onHub && await onHub(v)) return true;
            return act(v, 'cerrar el panel del gremio', () => press(top.locator('.hb-close, .popup-button-ok')), { module: 'hub-panel.js' });
        }
        if (layer.kind === 'book') return act(v, 'cerrar el libro', () => press(top.locator('.lb-close')), { module: 'story-book.js' });
        // Una ventana cualquiera (subir de nivel, un botín, «¿viajar?»): lo que se pulsaría.
        counts.popups++;
        // Viajar pregunta a qué ritmo: el de siempre.
        const pace = top.locator('.tr-pace-normal:visible');
        if (await pace.count() > 0) {
            markDecision();
            return act(v, `ritmo normal («${layer.title || layer.text.slice(0, 40)}»)`, () => press(pace), { module: 'travel.js' });
        }
        const ok = top.locator('.popup-button-ok:visible, .hb-close:visible, .mm-close:visible');
        if (await ok.count() > 0) return act(v, `aceptar «${layer.title || layer.text.slice(0, 40)}»`, () => press(ok.last()), { module: 'popup' });
        const custom = top.locator('.popup-button-custom:visible');
        if (await custom.count() > 0) {
            markDecision();
            return act(v, `«${(await custom.first().textContent() || '').trim().slice(0, 40)}» en «${layer.title || layer.text.slice(0, 40)}»`, () => press(custom), { module: 'popup' });
        }
        const any = top.locator('.popup-button-cancel:visible, .popup-button-close:visible, button:visible');
        if (await any.count() > 0) return act(v, `cerrar «${layer.title || layer.text.slice(0, 40)}»`, () => press(any.last()), { module: 'popup' });
        noteBlock(v, 'una ventana sin botón', 'popup', 'Escape');
        await page.keyboard.press('Escape');
        return true;
    };

    /**
     * La pelea: en «rápido», los enemigos a un golpe y al lado; luego, atacar a clics, y andar
     * si el tablero pide llegar a una casilla.
     *
     * @param {any} v
     * @param {{type: string, cell?: {x: number, y: number}}|null} [goal] Lo que pide el tablero.
     */
    const fightTurn = async (v, goal = null) => {
        // Cada enemigo nuevo se marca al verlo: así una pelea que se repite con los mismos
        // nombres (tras una derrota, o el mismo tablero otra vez) también cuenta y se acorta.
        const fresh = await page.evaluate(async (/** @type {boolean} */ quick) => {
            const party = await import('/scripts/party.js');
            const enc = /** @type {any} */ (party.getCombatEncounter());
            const me = /** @type {any} */ (party.getPartyMembersSnapshot()[0]);
            const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
            const live = (enc?.enemies || []).filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0);
            const unseen = live.filter((/** @type {any} */ e) => !e.vueltaSeen);
            let i = 0;
            for (const foe of unseen) {
                foe.vueltaSeen = true;
                if (!quick) continue;
                // A un golpe, sin armadura y casi sin puntería (solo un 20 natural entra): lo
                // que se mide es el camino, no la pelea.
                foe.currentHp = 1;
                foe.armorClass = 1;
                foe.ac = 1;
                foe.strength = 1;
                foe.dexterity = 1;
                foe.levelHit = 0;
                foe.rage = 0;
                const [dx, dy] = spots[i++ % spots.length];
                foe.gridX = (Number(me?.mapPosition?.gridX) || 0) + dx;
                foe.gridY = (Number(me?.mapPosition?.gridY) || 0) + dy;
            }
            if (quick && unseen.length > 0) party.refreshBoardView?.();
            return { unseen: unseen.length, live: live.length };
        }, fast).catch(() => ({ unseen: 0, live: 0 }));
        if (fresh.unseen > 0 && fresh.unseen === fresh.live) counts.fights++;
        if (!v.fight.mine) {
            // El turno de los enemigos se juega solo; se espera un poco.
            await act(v, 'esperar el turno enemigo', async () => true, { quiet: true, wait: 1500 });
            return;
        }
        if (!fast) {
            // Peleas de verdad: cada turno del grupo lo juega la máquina, como «Que actúe solo».
            markDecision();
            await act(v, `su turno, solo (${v.fight.who})`, () => page.evaluate(async () => (await import('/scripts/party.js')).playCurrentTurnAlone()), { module: 'combat', quiet: true });
            return;
        }
        const attack = page.locator('#game-shell .gs-actions .gs-btn-attack:not([disabled])');
        if (await attack.count() > 0) {
            markDecision();
            await press(attack);
            await page.waitForTimeout(150);
            await act(v, `atacar (${v.fight.who})`, () => press(page.locator('#game-shell .gs-targets .gs-target')), { module: 'combat' });
            return;
        }
        const auto = page.locator('#game-shell .gs-actions .gs-btn-auto');
        if (await auto.count() > 0) {
            await act(v, `que actúe solo (${v.fight.who})`, () => press(auto), { module: 'combat' });
            return;
        }
        // Andar: hacia la casilla que pide el tablero («Salir por la ventana»), o hacia el
        // enemigo más cercano. Se pulsa la casilla encendida que más acerca, como quien juega.
        const pickStep = () => page.evaluate(async (/** @type {any} */ want) => {
            const party = await import('/scripts/party.js');
            const enc = /** @type {any} */ (party.getCombatEncounter());
            const entry = enc?.turnOrder?.[enc?.currentTurnIndex];
            const me = party.getPartyMembersSnapshot().find((/** @type {any} */ m) => String(m.name) === String(entry?.name)) ?? party.getPartyMembersSnapshot()[0];
            const from = { x: Number(me?.mapPosition?.gridX) || 0, y: Number(me?.mapPosition?.gridY) || 0 };
            const foes = (enc?.enemies || []).filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0).map((/** @type {any} */ e) => ({ x: Number(e.gridX) || 0, y: Number(e.gridY) || 0 }));
            const far = (/** @type {any} */ a, /** @type {any} */ b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
            const goal = want ?? foes.sort((a, b) => far(from, a) - far(from, b))[0] ?? null;
            if (!goal || far(from, goal) === 0) return null;
            const token = String(me?.id ?? '');
            const cells = [...document.querySelectorAll('.wm-highlight-clickable.wm-highlight-move')]
                .map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }))
                .filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));
            const best = cells.sort((a, b) => far(a, goal) - far(b, goal))[0];
            if (cells.length === 0) return { token, goal, from };
            return best && far(best, goal) < far(from, goal) ? { ...best, token, goal, from } : null;
        }, goal?.cell ?? null).catch(() => null);
        let step = await pickStep();
        // Las casillas a las que se anda se encienden al pulsar tu ficha: primero, tu ficha.
        if (step && step.x === undefined && step.token) {
            await press(page.locator(`#game-shell .wm-token[data-token-id="${step.token}"]`));
            await page.waitForTimeout(250);
            step = await pickStep();
        }
        if (step && step.x === undefined) step = null;
        if (step) {
            markDecision();
            await act(v, `andar a (${step.x + 1}, ${step.y + 1}) hacia (${step.goal.x + 1}, ${step.goal.y + 1})`,
                () => press(page.locator(`.wm-highlight-clickable.wm-highlight-move[data-x="${step.x}"][data-y="${step.y}"]`)), { module: 'board-view.js' });
            return;
        }
        const end = page.locator('#game-shell .gs-actions .gs-btn:not([disabled])', { hasText: 'Fin de turno' });
        await act(v, `fin de turno (${v.fight.who})`, async () => {
            const ok = await press(end);
            // Fin de turno con acción sin gastar pregunta antes.
            await page.waitForTimeout(200);
            await press(page.locator('dialog[open] .popup-button-ok'), 800);
            return ok;
        }, { module: 'combat' });
    };

    /** Una ficha de la fila (o de la caja de la novela) cuyo texto casa. */
    const chip = (/** @type {RegExp} */ pattern) => page.locator('#game-shell .gs-chip-action:visible').filter({ hasText: pattern });
    const escape = (/** @type {string} */ s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /**
     * Pulsar la primera ficha que case; si no se ve, abrir «+N más» y mirar otra vez.
     *
     * @param {any} v
     * @param {RegExp} pattern
     * @param {string} what
     * @param {string} module
     */
    const tapChip = async (v, pattern, what, module) => {
        if (await chip(pattern).count() > 0) return act(v, what, () => press(chip(pattern)), { module });
        // «+N más» abre la ventana con todo lo que se puede hacer: se busca ahí.
        const more = chip(/^\+\d+ más$/);
        if (await more.count() > 0) {
            await press(more);
            await page.waitForTimeout(300);
            const inside = page.locator('dialog[open]:not([closing]) :is(button, .menu_button):visible').filter({ hasText: pattern });
            if (await inside.count() > 0) return act(v, `${what} (en «+N más»)`, () => press(inside), { module });
            await press(page.locator('dialog[open]:not([closing]) :is(.popup-button-ok, .popup-button-close):visible').last(), 800);
            if (await chip(pattern).count() > 0) return act(v, what, () => press(chip(pattern)), { module });
        }
        return false;
    };

    /**
     * Salir de lo que tapa el mapa (la caja de la novela, un sitio del pueblo, un tablero)
     * hasta la pantalla de explorar, donde están los viajes y los tableros.
     *
     * @param {any} v
     */
    const toMap = async (v) => {
        if (v.town.inside) return act(v, 'volver al pueblo', () => press(page.locator('#game-shell .gs-town-back')), { module: 'town-scene.js' });
        // Desde un tablero se sale primero: su «Continuar» lleva otra vez a él.
        if (v.board) {
            if (await tapChip(v, /^Salir del tablero$/, 'salir del tablero', 'action-chips.js')) return true;
            const leave = page.locator('#game-shell .wm-leave-loc-btn:visible');
            if (await leave.count() > 0) return act(v, 'salir del tablero (su botón)', () => press(leave), { module: 'board-view.js' });
        }
        if (v.scene === 'dialogue' && v.vn.next) return act(v, `«Continuar» (a ${v.vn.next})`, () => press(chip(/^Continuar$/)), { module: 'game-shell.js' });
        if (v.scene !== 'exploration') {
            const map = page.locator('#game-shell .gs-tools .gs-map:visible');
            if (await map.count() > 0) return act(v, 'abrir el mapa', () => press(map), { module: 'game-shell.js' });
        }
        return false;
    };

    /**
     * Ir a un sitio, como quien mira el mapa: su tarjeta si está al lado; si queda lejos, la
     * del sitio por donde se pasa.
     *
     * @param {any} v
     * @param {string} place
     */
    const travelTo = async (v, place) => {
        if (v.scene !== 'exploration' || v.board || v.town.inside) {
            if (await tapChip(v, new RegExp(`^Ir a ${escape(place)}$`), `ir a ${place} (ficha)`, 'action-chips.js')) { counts.travels++; return true; }
            return toMap(v);
        }
        const card = v.places.find((/** @type {any} */ p) => plain(p.name) === plain(place));
        const cardAt = (/** @type {string} */ name) => page.locator('#game-shell .gs-place').filter({ has: page.locator('.gs-place-name', { hasText: new RegExp(`^${escape(name)}$`) }) });
        if (card && !card.off) {
            counts.travels++;
            markDecision();
            return act(v, `viajar a ${place}`, () => press(cardAt(place)), { module: 'travel' });
        }
        const via = card ? /pasando por (.+?)(?:Pendiente|$)/.exec(card.note)?.[1]?.trim() : '';
        const step = via ? v.places.find((/** @type {any} */ p) => plain(p.name) === plain(via) && !p.off) : null;
        if (step) {
            counts.travels++;
            return act(v, `viajar a ${step.name}, camino de ${place}`, () => press(cardAt(step.name)), { module: 'travel' });
        }
        if (await tapChip(v, new RegExp(`^Ir a ${escape(place)}$`), `ir a ${place} (ficha)`, 'action-chips.js')) { counts.travels++; return true; }
        return false;
    };

    /**
     * Un paso hacia lo que pide la historia. Devuelve false si no encuentra qué pulsar.
     *
     * @param {any} v
     * @param {Target} t
     */
    const pursue = async (v, t) => {
        if (t.place && plain(v.location) !== plain(t.place)) return travelTo(v, t.place);
        if ((t.kind === 'win' || t.kind === 'defeat') && t.board) {
            if (plain(v.board) === plain(t.board)) {
                if (await tapChip(v, /^Iniciar combate/, 'iniciar el combate', 'action-chips.js')) return true;
                // Sin nadie a la vista, lo que duerme tras una puerta se despierta abriéndola.
                if (await tapChip(v, /^Abrir la puerta/, 'abrir una puerta del tablero', 'action-chips.js')) return true;
                const button = page.locator('#game-shell .wm-start-combat:visible, #game-shell .wm-fight-btn:visible');
                if (await button.count() > 0) return act(v, 'iniciar el combate (botón del tablero)', () => press(button), { module: 'board-view.js' });
                return false;
            }
            if (await tapChip(v, new RegExp(`^Entrar en ${escape(t.board)}$`), `entrar en ${t.board}`, 'action-chips.js')) return true;
            if (v.scene === 'exploration' && v.boards.some((/** @type {string} */ b) => plain(b) === plain(t.board))) {
                return act(v, `entrar en ${t.board} (tarjeta)`, () => press(page.locator('#game-shell .gs-board').filter({ has: page.locator('.gs-board-name', { hasText: new RegExp(`^${escape(t.board)}$`) }) })), { module: 'game-shell.js' });
            }
            return toMap(v);
        }
        if (t.kind === 'talk' && t.npc) {
            const talk = new RegExp(`^Hablar con ${escape(t.npc)}`);
            if (await tapChip(v, talk, `hablar con ${t.npc}`, 'action-chips.js')) { counts.talks++; return true; }
            if (v.town.inside) {
                const act2 = page.locator('#game-shell .gs-town-act:visible').filter({ hasText: talk });
                if (await act2.count() > 0) { counts.talks++; return act(v, `hablar con ${t.npc} (en el sitio)`, () => press(act2), { module: 'town-scene.js' }); }
                return act(v, 'volver al pueblo', () => press(page.locator('#game-shell .gs-town-back')), { module: 'town-scene.js' });
            }
            const spot = v.town.places.find((/** @type {any} */ p) => plain(p.text).includes(plain(t.npc)));
            if (spot) return act(v, `entrar en ${spot.id}, donde está ${t.npc}`, () => press(page.locator(`#game-shell .gs-town-place[data-place="${spot.id}"]`)), { module: 'town-scene.js' });
            return toMap(v);
        }
        if ((t.kind === 'check' || t.kind === 'clues') && t.skill) {
            const list = page.locator(`#game-shell .gs-checks .gs-target[data-check="${t.skill}"]:not([disabled])`);
            if (await list.count() === 0 && await chip(/^Tirada$/).count() > 0) {
                await press(chip(/^Tirada$/));
                await page.waitForTimeout(200);
            }
            if (await list.count() > 0) {
                counts.checks++;
                markDecision();
                return act(v, `tirada de ${t.skill}`, () => press(list), { module: 'game-shell.js (Tirada)' });
            }
            return false;
        }
        // Llegar ya está hecho, o el hito no pide nada: seguir leyendo.
        if (v.scene === 'dialogue' && v.vn.next) return act(v, '«Continuar»', () => press(chip(/^Continuar$/)), { module: 'game-shell.js' });
        return false;
    };

    return {
        steps, silences, blocks, choices, counts,
        /** Cuándo se decidió algo por primera vez (una opción, un viaje, un golpe). */
        get firstDecisionAt() { return firstDecisionAt; },
        started,
        until, press, act, noteBlock, slash, chip, tapChip, toMap, travelTo, pursue, handleLayer, fightTurn, markDecision, where, describe,
        observe: () => observe(page),
        page,
    };
}

/**
 * Jugar el hilo de una campaña (o del prólogo) a clics hasta que `stop` diga basta.
 *
 * Cada vuelta del bucle: lo de encima (dados, ventanas), la pelea si la hay y, si no, un paso
 * hacia lo que pide el hito abierto. Si en muchos pasos no se cumple nada, o se repite lo
 * mismo, o no hay qué pulsar, es un atasco: se apunta y se rescata con un comando (lo haría
 * quien lee la guía, no quien juega). Dos rescates seguidos sin avanzar y se deja.
 *
 * @param {ReturnType<typeof createBot>} bot
 * @param {object} input
 * @param {any} input.pack El paquete de la campaña.
 * @param {(v: any) => boolean} input.stop Cuándo se ha llegado.
 * @param {number} [input.maxSteps]
 * @param {(line: string) => void} [input.log]
 * @param {(v: any) => Promise<boolean>} [input.onHub]
 * @param {(v: any) => Promise<boolean>} [input.onEnd]
 * @param {string[]} [input.order] Qué hito seguir si hay varios abiertos (los primeros, antes).
 * @param {boolean} [input.verbose] Cada paso en el registro (o con VUELTA_VER=1).
 * @returns {Promise<{reached: boolean, gaveUp: string, view: any}>}
 */
export async function runCampaign(bot, { pack, stop, maxSteps = 900, log = console.log, onHub, onEnd, order = [], verbose = Boolean(process.env.VUELTA_VER) }) {
    const targetOf = targetsFromPack(pack);
    const goals = boardGoalsFromPack(pack);
    const side = new Set((pack.plot?.milestones ?? []).filter((/** @type {any} */ m) => m.hidden || m.opens?.kind === 'clock').map((/** @type {any} */ m) => String(m.id)));
    let lastDone = -1;
    let sinceProgress = 0;
    let misses = 0;
    let rescues = 0;
    /** @type {any} */
    let v = await bot.observe();
    for (let i = 0; i < maxSteps; i++) {
        v = await bot.observe();
        if (stop(v)) return { reached: true, gaveUp: '', view: v };
        if (v.done.length !== lastDone) {
            if (lastDone >= 0) log(`  hito: ${v.done[v.done.length - 1]} (${v.done.length} hechos) · ${bot.where(v)} · paso ${bot.steps.length}`);
            lastDone = v.done.length;
            sinceProgress = 0;
            rescues = 0;
        }
        sinceProgress++;
        if (verbose) log(`  · ${bot.steps.length} ${bot.steps[bot.steps.length - 1]?.what ?? ''} · ${bot.where(v)}`);
        else if (i % 40 === 39) log(`  · paso ${bot.steps.length}: ${bot.steps[bot.steps.length - 1]?.what ?? ''} · ${bot.where(v)}`);
        const open = v.open.filter((/** @type {string} */ id) => !side.has(id));
        const main = order.find(id => open.includes(id)) ?? open[0] ?? '';
        const target = main ? targetOf(main) : { id: '', kind: 'none' };
        // Atascado: nada que pulsar, lo mismo una y otra vez, o muchos pasos sin cumplir nada.
        // Pasar dados, turnos y páginas de una escena se repite sin estar atascado.
        const recent = bot.steps.slice(-12).map(s => s.what).filter(w => !/dados|turno enemigo|^atacar|fin de turno|^andar|^«(Seguir|Terminar)»$/.test(w));
        const looping = recent.length >= 8 && new Set(recent).size <= 2;
        if (misses >= 3 || looping || sinceProgress > 150) {
            const why = misses >= 3 ? 'no se ve nada que pulsar para lo que pide la historia'
                : looping ? `se repite lo mismo: ${[...new Set(recent)].join(' / ')}` : 'muchos pasos sin cumplir el hito';
            if (++rescues > 2) {
                bot.noteBlock(v, `${main || 'sin hito'}: ${why}`, '', '');
                return { reached: false, gaveUp: `${main || 'sin hito'}: ${why}`, view: v };
            }
            const command = v.layer ? '' : v.fight ? '/combat-end'
                : target.place && v.location !== target.place ? `/go ${target.place}`
                    : target.board && v.board !== target.board ? `/enter ${target.board}`
                        : target.kind === 'talk' ? `/hablar ${target.npc}`
                            : target.skill ? `/tirada ${target.skill}`
                                : target.board ? 'abrir las puertas del tablero (gancho de sim-campana)' : '';
            const what = `${target.kind}${target.place ? ` en ${target.place}` : ''}${target.board ? `, ${target.board}` : ''}${target.npc ? `, ${target.npc}` : ''}`;
            bot.noteBlock(v, `${main || 'sin hito'} (${what}): ${why}`, '', command || (v.layer ? 'Escape' : 'ninguno'));
            if (v.layer) await bot.page.keyboard.press('Escape');
            else if (command.startsWith('abrir')) await bot.page.evaluate(async () => (await import('/scripts/party.js')).openBoardDoorsForSimulation());
            else if (command) await bot.slash(command);
            await bot.until(async () => false, 1200);
            misses = 0;
            sinceProgress = Math.min(sinceProgress, 100);
            bot.steps.push({ n: bot.steps.length + 1, what: `rescate: ${command || 'Escape'}`, silent: false, ms: 0, where: bot.where(v) });
            continue;
        }
        // Con algo encima (una ventana, los dados, la pausa) solo se puede tocar eso: aunque no
        // se pueda pulsar, no se sigue por debajo (repetirlo es un atasco, y se ve arriba).
        if (v.layer || v.dice || v.pause) {
            await bot.handleLayer(v, { onHub, onEnd });
            misses = 0;
            continue;
        }
        if (v.fight) {
            misses = 0;
            await bot.fightTurn(v, goals.get(v.board) ?? null);
            continue;
        }
        if (!main) {
            // Sin hito que seguir: lo que haya que leer, y si no hay nada, se acabó.
            if (v.scene === 'dialogue' && v.vn.next && await bot.chip(/^Continuar$/).count() > 0) {
                await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)), { module: 'game-shell.js' });
                continue;
            }
            return { reached: false, gaveUp: 'no queda ningún hito abierto que seguir', view: v };
        }
        const moved = await bot.pursue(v, target);
        misses = moved ? 0 : misses + 1;
    }
    return { reached: false, gaveUp: `más de ${maxSteps} pasos`, view: v };
}

/**
 * Desde la portada: «Jugar sin conexión» y el personaje, a clics. Devuelve cuándo se pulsó
 * «Jugar sin conexión», para medir cuánto se tarda en la primera decisión.
 *
 * @param {any} page
 * @param {{name: string, gender?: string, race?: string, klass?: string}} hero
 * @returns {Promise<number>}
 */
export async function startOffline(page, { name, gender = 'Mujer', race = 'Humano', klass = 'Guerrero' }) {
    if (await page.locator('text=Welcome to SillyTavern!').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)) {
        await page.click('.popup-button-ok');
    }
    await page.waitForSelector('#game-shell', { timeout: 90000 });
    const offline = page.locator('#game-shell .gs-menu-btn').filter({ hasText: 'Jugar sin conexión' });
    await offline.waitFor({ state: 'visible', timeout: 30000 });
    const clicked = Date.now();
    await offline.click();
    await page.waitForSelector('.hc-root, dialog[open] .vt-card.vt-new', { timeout: 120000 });
    if (await page.locator('dialog[open] .vt-card.vt-new').count() > 0) await page.locator('dialog[open] .vt-card.vt-new').first().click();
    await page.waitForSelector('.hc-root', { timeout: 120000 });
    await page.fill('.hc-root .hc-name', name);
    await page.locator(`.hc-root .hc-gender[data-value="${gender}"]`).click();
    for (const [pick, wanted] of [['race', race], ['class', klass]]) {
        await page.locator(`.hc-root .hc-card[data-pick="${pick}"] .hc-pick`).click();
        await page.waitForSelector('.hc-picker .hc-option', { timeout: 15000 });
        const values = await page.evaluate(() => [...document.querySelectorAll('.hc-picker .hc-option')].map(o => o.getAttribute('data-value') || ''));
        const chosen = values.find(v => plain(v) === plain(wanted)) ?? values.find(v => plain(v).includes(plain(wanted))) ?? values[0];
        await page.locator(`.hc-picker .hc-option[data-value="${chosen}"]`).first().click();
        await page.waitForSelector('.hc-picker', { state: 'detached', timeout: 15000 }).catch(() => {});
    }
    await page.locator('.hc-root .hc-enter').click();
    await page.waitForFunction(() => /Gremio/.test(String(window.SillyTavern?.getContext?.().chatMetadata?.world_info || '')), null, { timeout: 90000 });
    // El mundo del gremio ya está puesto antes de que se cierre el creador: se espera a que se cierre.
    await page.waitForSelector('.hc-root', { state: 'detached', timeout: 30000 }).catch(() => {});
    return clicked;
}

/**
 * Los números fijos de la sección 6 del plan, que no dependen de la vuelta: cuántas filas
 * tiene el narrador, cuántos sucesos con decisión y cuántas charlas con ramas.
 *
 * @param {(path: string) => any} readJson Lee un JSON del repositorio.
 * @returns {{frases: number, sucesos: number, charlas1387: number, charlasStrahd: number, hitos1387: number}}
 */
export function fixedNumbers(readJson) {
    const rows = (/** @type {any} */ data) => (Array.isArray(data) ? data.length : Array.isArray(data?.rows) ? data.rows.length : Object.keys(data ?? {}).length);
    const pack1387 = readJson('public/mundos/1387.pack.json');
    const packStrahd = readJson('public/mundos/strahd.pack.json');
    return {
        frases: rows(readJson('public/compendio/frases.json')),
        sucesos: rows(readJson('public/compendio/sucesos.json')),
        charlas1387: (pack1387.dialogues ?? []).length,
        charlasStrahd: (packStrahd.dialogues ?? []).length,
        hitos1387: (pack1387.plot?.milestones ?? []).filter((/** @type {any} */ m) => m.opens?.kind !== 'clock').length,
    };
}

/**
 * Las notas del juego (`postForModel`) que traen su versión en prosa (`show:`), de todas las
 * que hay en el código: el «unas pocas de 55» de la sección 6 (J13.1).
 *
 * @param {string} root La raíz del repositorio.
 * @returns {{prose: number, total: number}}
 */
export function proseNotes(root) {
    /** @type {string[]} */
    const files = [];
    const walk = (/** @type {string} */ dir) => {
        for (const name of readdirSync(dir)) {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) walk(path);
            else if (path.endsWith('.js')) files.push(path);
        }
    };
    walk(join(root, 'public/scripts'));
    let total = 0;
    let prose = 0;
    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        for (let at = source.indexOf('postForModel('); at >= 0; at = source.indexOf('postForModel(', at + 1)) {
            // La definición no es una nota.
            if (/function\s+$/.test(source.slice(Math.max(0, at - 20), at))) continue;
            let depth = 1;
            let end = at + 'postForModel('.length;
            while (end < source.length && depth > 0) {
                if (source[end] === '(') depth++;
                else if (source[end] === ')') depth--;
                end++;
            }
            total++;
            if (/\bshow\s*[:,}]/.test(source.slice(at, end))) prose++;
        }
    }
    return { prose, total };
}

/**
 * Del paquete, lo que pide cada tablero para ganarlo (sus misiones): llegar a una casilla,
 * acabar con alguien, aguantar…
 *
 * @param {any} pack
 * @returns {Map<string, {type: string, cell?: {x: number, y: number}}>}
 */
export function boardGoalsFromPack(pack) {
    const quests = new Map((pack.quests ?? []).map((/** @type {any} */ q) => [String(q.id), q]));
    const goals = new Map();
    for (const board of pack.boards ?? []) {
        const quest = quests.get(`q-${board.id}`) ?? (pack.quests ?? []).find((/** @type {any} */ q) => q.board === board.name || q.boardName === board.name);
        const first = (quest?.objectives ?? []).find((/** @type {any} */ o) => o.type === 'reach_cell') ?? quest?.objectives?.[0];
        if (first) goals.set(String(board.name), { type: String(first.type), ...(first.cell ? { cell: { x: Number(first.cell.x), y: Number(first.cell.y) } } : {}) });
    }
    return goals;
}

/**
 * Del paquete, lo que pide cada hito: dónde, qué tablero, con quién.
 *
 * @param {any} pack
 * @returns {(id: string) => Target}
 */
export function targetsFromPack(pack) {
    const boardAt = new Map((pack.boards || []).map((/** @type {any} */ b) => [String(b.name), String(b.locationName || '')]));
    const npcAt = new Map((pack.npcs || []).map((/** @type {any} */ n) => [String(n.name), String(n.where || '')]));
    const enemyBoard = new Map();
    for (const b of pack.boards || []) for (const e of b.enemies || []) if (!enemyBoard.has(String(e.name))) enemyBoard.set(String(e.name), String(b.name));
    const byId = new Map((pack.plot?.milestones || []).map((/** @type {any} */ m) => [String(m.id), m]));
    return (id) => {
        const m = byId.get(id);
        const asks = m?.asks || { kind: 'none' };
        if (asks.kind === 'win') return { id, kind: 'win', board: String(asks.board), place: boardAt.get(String(asks.board)) || '' };
        if (asks.kind === 'defeat') {
            const board = enemyBoard.get(String(asks.enemy)) || '';
            return { id, kind: 'defeat', enemy: String(asks.enemy), board, place: boardAt.get(board) || '' };
        }
        if (asks.kind === 'talk') return { id, kind: 'talk', npc: String(asks.npc), place: npcAt.get(String(asks.npc)) || '' };
        if (asks.kind === 'arrive') return { id, kind: 'arrive', place: String(asks.place) };
        if (asks.kind === 'check') return { id, kind: 'check', skill: String(asks.skill) };
        if (asks.kind === 'clues') return { id, kind: 'clues', place: String(asks.clues?.[0]?.place || ''), skill: String(asks.clues?.[0]?.skill || '') };
        return { id, kind: String(asks.kind || 'none') };
    };
}
