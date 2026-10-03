/**
 * El jugador automático de las vueltas (J16 de wiki/ROADMAP_SIN_CONEXION.md): mira la
 * pantalla y pulsa, como quien juega con el ratón, sin escribir nada. Lo usan
 * `tools/vuelta-1387.mjs`, `tools/vuelta-gremio.mjs`, `tools/vuelta-strahd.mjs` y
 * `tools/vuelta-campana.mjs` (la de cualquier campaña, añadida desde un archivo).
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

import { spawn } from 'node:child_process';
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
        // La tarjeta de «ha caído todo el grupo» (`.pf-root`) lleva también `.end-root`: no es un final.
        // «Guardar y cargar» (`.sv-root`), la de las ranuras.
        const KINDS = [['.pf-root', 'fallen'], ['.end-root', 'end'], ['.sv-root', 'saves'], ['.su-root', 'suceso'], ['.tk-root', 'talk']];
        const kindOf = (/** @type {Element} */ d) => {
            const found = KINDS.find(([selector]) => d.querySelector(selector))?.[1];
            if (found) return found;
            if (d.querySelector('.qd-root')) return d.classList.contains('ps-dialog') ? 'scene' : d.classList.contains('dw-dialog') ? 'dialogue' : 'meetup';
            if (d.querySelector('.hb-root')) return 'hub';
            return d.classList.contains('lb-dialog') ? 'book' : 'popup';
        };
        /** @type {any} */
        let layer = null;
        if (top) {
            const kind = kindOf(top);
            layer = {
                kind,
                id: top.querySelector('.ps-root')?.getAttribute('data-scene') || top.querySelector('.dw-root')?.getAttribute('data-dialogue')
                    || top.querySelector('.su-root')?.getAttribute('data-suceso') || '',
                title: said(top.querySelector('.qd-title, .gs-popup-title, h3, h2')).slice(0, 120),
                text: said(top.querySelector('.qd-text') || top.querySelector('.su-text') || top.querySelector('.tk-log') || top).slice(0, 400),
                // Las opciones de una escena llevan `data-option`; las de «otra salida» (antes o en mitad
                // de una pelea, avoid-scene.js), `data-exit`.
                options: [...top.querySelectorAll('.dw-option')].filter(seen).map(o => ({
                    id: o.getAttribute('data-option') || o.getAttribute('data-exit') || '',
                    attr: o.hasAttribute('data-option') ? 'data-option' : o.hasAttribute('data-exit') ? 'data-exit' : '',
                    locked: o.classList.contains('dw-locked'), text: said(o).slice(0, 120),
                })),
                // «Otra salida»: `avoid` antes de pelear (Pelear, Hablar, Pagar…), `parley` en mitad.
                exit: top.classList.contains('ev-dialog') ? (top.classList.contains('ev-parley') ? 'parley' : 'avoid') : '',
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
            // Las ventanas que quedan debajo de la de encima (una escena sobre un suceso, J16).
            under: dialogs.filter(d => d !== top).map(d => `${kindOf(d)}${d.querySelector('.su-root')?.getAttribute('data-suceso') ? ` ${d.querySelector('.su-root')?.getAttribute('data-suceso')}` : ''}`),
            vn: { text: vnText.slice(0, 400), next: document.querySelector('#game-shell .gs-vn-box .gs-chip-continue')?.getAttribute('data-next') || '' },
            focus: said(document.querySelector('#game-shell .gs-focus-title')) + (document.querySelector('#game-shell .gs-focus-hint') ? ` — ${said(document.querySelector('#game-shell .gs-focus-hint'))}` : ''),
            chips: [...new Set(chips)],
            town: {
                places: [...document.querySelectorAll('#game-shell .gs-town-place')].filter(seen).map(p => ({ id: p.getAttribute('data-place') || '', text: said(p).slice(0, 120) })),
                // Dentro de un sitio solo si se ve: tras un tablero, la escena del sitio sigue en la
                // página, tapada, y su «Volver» no se puede pulsar.
                inside: seen(document.querySelector('#game-shell .gs-town-scene')) ? (document.querySelector('#game-shell .gs-town-scene')?.getAttribute('data-place') || '') : '',
                acts: [...document.querySelectorAll('#game-shell .gs-town-act')].filter(seen).map(b => ({ id: b.getAttribute('data-action') || '', text: said(b).slice(0, 80), off: Boolean(/** @type {HTMLButtonElement} */ (b).disabled) })),
            },
            places: [...document.querySelectorAll('#game-shell .gs-place')].filter(seen).map(p => ({
                name: said(p.querySelector('.gs-place-name')), note: said(p).slice(0, 160), off: Boolean(/** @type {HTMLButtonElement} */ (p).disabled),
            })),
            boards: [...document.querySelectorAll('#game-shell .gs-board')].filter(seen).map(b => said(b.querySelector('.gs-board-name'))),
            // D-J62, el modo guiado: lo que pide la historia (ir, el tablero de aquí, hablar, intentarlo).
            steps: [...document.querySelectorAll('#game-shell .gs-story-step')].filter(seen).map(s => ({
                id: s.getAttribute('data-step') || '', kind: s.getAttribute('data-kind') || '', note: said(s.querySelector('.gs-card-note')),
                off: Boolean(/** @type {HTMLButtonElement} */ (s).disabled),
            })),
            bar: [...document.querySelectorAll('#game-shell .gs-actions .gs-btn')].filter(seen).map(b => ({ text: said(b), off: Boolean(/** @type {HTMLButtonElement} */ (b).disabled) })),
            // De quién dice la barra que es el turno («Tu turno: Tessa», «Turno de…»).
            turnLabel: said(document.querySelector('#game-shell .gs-turn-label')).slice(0, 80),
            // El combate nuevo (wiki/maquetas/ENCARGO_COMBATE_VTT.md) empieza solo al entrar en el
            // tablero: primero se colocan los tuyos y luego se confirma. El botón que lo confirma, si
            // se ve (fuera de las ventanas); se busca por lo que dice, que es lo que lee quien juega.
            // La barra de colocar (`.cv-place`, placement-bar.js) va en el Modo Juego o, si no está, suelta.
            start: [...document.querySelectorAll('#game-shell button, #game-shell .menu_button, .gs-root button, .cv-place button')]
                .filter(b => seen(b) && !b.closest('dialog') && !(/** @type {HTMLButtonElement} */ (b).disabled))
                .map(b => said(b)).filter(t => /^(¡?A pelear!?|Empezar( la pelea| el combate)?|Comenzar( la pelea| el combate)?|Listo|Hecho, a pelear|Confirmar( la colocación)?)$/i.test(t)).slice(0, 3),
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
            hero: hero ? { name: String(hero.name), hp: Number(hero.hp) || 0, maxHp: Number(hero.maxHp) || 0, level: Number(hero.level) || 1, xp: Number(hero.xp) || 0, gold: Number(hero.gold) || 0, dead: Boolean(hero.dead), at: `${hero.mapPosition?.gridX ?? ''},${hero.mapPosition?.gridY ?? ''}` } : null,
            party: members.map((/** @type {any} */ m) => String(m.name)),
            // El agotamiento (hambre, sed, sueño) del peor del grupo: lo que avisa el «Agotamiento
            // N de 6» y lo que se ve en su ficha. Quien juega con cabeza come y duerme antes del 6.
            tired: Math.max(0, ...members.filter((/** @type {any} */ m) => !m.dead).map((/** @type {any} */ m) => Number(/agotamiento (\d)/i
                .exec(String((Array.isArray(m.injuries) ? m.injuries : []).find((/** @type {any} */ i) => i?.id === 'exhaustion')?.label ?? ''))?.[1]) || 0)),
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
            view.hero?.hp, view.hero?.gold, view.hero?.at, view.chat, view.last, view.toasts, view.menu, view.day, view.start,
            document.querySelector('#game-shell .gs-targets') ? said(document.querySelector('#game-shell .gs-targets')).slice(0, 80) : '',
            document.querySelector('.hc-root') ? 'hc' : '',
            // El tablón: lo que dice al añadir una campaña (va debajo de las tarjetas) y si está comprobando.
            said(document.querySelector('dialog[open] .hb-import')).slice(0, 120),
            document.querySelector('dialog[open] .hb-add.is-busy') ? 'comprobando' : '',
        ]);
        return view;
    })]).finally(() => clearTimeout(timer));
}

/**
 * Si quien juega con cabeza pararía a descansar, y por qué: con el aviso «Agotamiento 2 de 6»
 * (hambre, sed o sueño) o con el héroe por debajo de la mitad de su vida. Vacío si no.
 *
 * @param {{tired?: number, hero?: {hp: number, maxHp: number, dead?: boolean}|null}} v Lo que se ve (`observe`).
 * @returns {string} «agotamiento 3 de 6, 7 de 34 de vida»
 */
export function restNeed(v) {
    const hero = v?.hero;
    if (!hero || hero.dead) return '';
    const tired = Number(v.tired) || 0;
    const low = hero.maxHp > 0 && hero.hp < hero.maxHp / 2;
    return [tired >= 2 ? `agotamiento ${tired} de 6` : '', low ? `${hero.hp} de ${hero.maxHp} de vida` : ''].filter(Boolean).join(', ');
}

/**
 * En la ventana de «otra salida» (party/avoid.js), lo que elige la vuelta: antes de pelear,
 * «Pelear» (el hito pide ganar el tablero); en mitad de la pelea, «Seguir peleando». Por su id
 * (`pelear`, `seguir`) o, si cambia, por lo que dice.
 *
 * @param {string} exit `avoid`, `parley` o vacío (no es esa ventana).
 * @param {Array<{id: string, text: string, locked?: boolean}>} options
 * @returns {{id: string, text: string}|null}
 */
export function exitPick(exit, options) {
    if (!exit) return null;
    const free = (options || []).filter(o => !o.locked);
    const [id, words] = exit === 'parley' ? ['seguir', /seguir peleando|dejarlo estar/] : ['pelear', /^\d*\s*pelear\b|empezar la pelea/];
    return free.find(o => o.id === id) ?? free.find(o => words.test(plain(o.text))) ?? null;
}

/**
 * Por qué no entró un clic de Playwright en la barra de combate: `busy` si el clic salió pero la
 * página no lo atendió a tiempo (se quedó en «performing click action»: está ocupada pintando, y el
 * clic llega tarde), `covered` si una ventana (`<dialog>`) se ha puesto encima del botón.
 *
 * @param {string} text El mensaje del error de Playwright.
 * @returns {{busy: boolean, covered: string}}
 */
export function clickVerdict(text) {
    const said = String(text || '');
    const afterAction = said.split('performing click action').slice(1).pop() ?? '';
    return {
        busy: /Timeout/.test(said) && said.includes('performing click action') && !/intercepts pointer events/.test(afterAction),
        // Playwright lo dice así: `<dialog open class="popup …">…</dialog> intercepts pointer events`;
        // los dados que salen encima (combat-log.js), `<div class="wm-dice-backdrop"></div> from … subtree …`.
        covered: /<(?:dialog\b|div [^>\n]*wm-dice-)[^\n]*?intercepts pointer events/.exec(said)?.[0]?.slice(0, 160) ?? '',
    };
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
    /** Los clics que la página tardó en atender más que la espera de un clic (1,5 s). */
    /** @type {Array<{what: string, ms: number, where: string}>} */
    const slow = [];
    /**
     * Lo que se ve mal sin ser un silencio ni un atasco: una etiqueta del motor en lo que se lee
     * («[HILO] …»), una ventana encima de otra a medias, la escena de un hito ya cumplido.
     *
     * @type {Array<{kind: 'crudo'|'encima'|'tarde'|'descanso'|'portada'|'anda'|'cierre'|'turno'|'gancho'|'barra', n: number, where: string, text: string}>}
     */
    const oddities = [];
    const oddSeen = new Set();
    /** Dónde y cuándo se cumplió cada hito, para saber si su escena llega tarde. */
    /** @type {Map<string, {where: string, n: number, location: string}>} */
    const doneAt = new Map();
    const TAG = /(?:^|[\s«"(])\[[A-ZÁÉÍÓÚÜÑ]{2}[A-ZÁÉÍÓÚÜÑ ·]{0,28}\]/u;
    /**
     * `exits`: «otra salida» antes o en mitad de una pelea; `hooked`: turnos jugados con el gancho;
     * `loads`: partidas cargadas tras caer el grupo.
     */
    const counts = { scenes: 0, options: 0, sucesos: 0, talks: 0, fights: 0, won: 0, travels: 0, popups: 0, checks: 0, rests: 0, exits: 0, hooked: 0, loads: 0 };
    /** Cuando cae el grupo entero (la tarjeta «X ha muerto»): dónde, de qué y qué salidas había. */
    /** @type {Array<{n: number, where: string, text: string, ways: string[]}>} */
    const falls = [];
    /** Descansar: el día en que se intentó y cuántos pasos lleva, para no dar vueltas sin fin. */
    let restDay = -1;
    let restTries = 0;
    /** Los sitios del pueblo donde ya se ha mirado si se puede descansar («día:localización:sitio»). */
    const restLooked = new Set();
    /** Lo pulsado en la barra de combate que no hizo nada, seguido; con dos, el turno va con el gancho. */
    let fightFails = 0;
    let hookSaid = false;
    /** Lo que no respondió en esta pelea, dicho (para explicar por qué un turno va con el gancho). */
    /** @type {string[]} */
    let fightMissed = [];
    /** El turno («ronda:quién») en el que ya se atacó: una acción por turno. */
    let lastAttack = '';
    /**
     * El turno en el que se anduvo, y en el que ya se volvió a probar a atacar tras andar: como
     * quien juega, se anda hasta el enemigo y se le pega en el mismo turno. Sin esto, la bruja que
     * se aparta y dispara (la taberna, el molino) no caía nunca.
     */
    let walkedOn = '';
    let retriedOn = '';
    /**
     * Lo último que se anduvo («ronda:quién» y la casilla de salida): si en el mismo turno se sale
     * otra vez de la misma casilla, la casilla encendida no llevó a ninguna parte. Se apunta (con
     * el aviso que se vea) y se acaba el turno, en vez de pulsarla sin fin.
     */
    let lastWalk = { turn: '', from: '' };
    /** Cuántas veces ha salido cada ventana con botones propios (por su título): para no repetir la misma salida. */
    /** @type {Map<string, number>} */
    const popupTries = new Map();
    /** Los turnos («tablero|quién») en los que ya se apuntó que no había «Fin de turno». */
    const turnSeen = new Set();
    /** La barra de combate, dicha: cada botón, y si está apagado. */
    const barSaid = (/** @type {any} */ seen) => (seen.bar ?? []).map((/** @type {any} */ b) => `${b.text}${b.off ? ' (apagado)' : ''}`).join(' | ') || 'ninguna';
    /**
     * Las peleas («tablero|hitos hechos|pelea») sin enemigos en pie: desde cuándo se espera a que se
     * cierren, o -1 si ya se midió.
     *
     * @type {Map<string, number>}
     */
    const closing = new Map();
    /** Se pulsó «Cargar partida» en la tarjeta de «ha caído el grupo»: en «Guardar y cargar», cargar. */
    let loadAfterFall = false;
    /** Cuántas veces se ha esperado en cada tablero a que la pelea empiece sola. */
    /** @type {Map<string, number>} */
    const startWaits = new Map();
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
        let did = await run();
        // Un clic cuyo manejador tarda más que la espera del clic sale como «no se pudo pulsar»,
        // pero ha pasado: si la pantalla cambia, se pulsó, y se apunta como clic lento.
        if (!did && /Timeout/.test(pressError)) {
            let late = before;
            if (await until(async () => {
                late = await observe(page);
                return late.print !== before.print;
            }, 2500)) {
                did = true;
                slow.push({ what, ms: Date.now() - t0, where: where(before) });
                if (process.env.VUELTA_VER) log(`  ~ ${what}: lento (${Date.now() - t0} ms)`);
            }
        }
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
        // En el registro detallado, los avisos nuevos («La cerradura aguanta.»): lo que lee quien juega.
        if (process.env.VUELTA_VER) {
            const fresh = (after.toasts ?? []).filter((/** @type {string} */ t) => !(before.toasts ?? []).includes(t));
            if (fresh.length > 0) log(`  aviso: ${fresh.join(' / ').slice(0, 200)}`);
        }
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

    /**
     * Elegir entre las opciones de una escena o una charla: lo preferido, si no la primera abierta.
     * En «otra salida» (`exit`), pelear: lo que se mide es el camino, y el hito pide ganar el tablero.
     */
    const pickOption = (/** @type {any[]} */ options, exit = '') => {
        const free = options.filter(o => !o.locked);
        const fight = exitPick(exit, free);
        if (fight) return fight;
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
        if (layer.kind === 'fallen') {
            // Ha caído el grupo entero. Quien juega vuelve al punto guardado, si se lo ofrecen; si
            // no, la vuelta acaba aquí (lo decide `runCampaign`).
            if (!falls.some(f => f.n === steps.length)) {
                falls.push({ n: steps.length, where: where(v), text: layer.text.slice(0, 240), ways: layer.buttons });
                log(`CAÍDO #${steps.length} ${layer.title}: ${layer.text.slice(0, 200)} (${where(v)}) [${layer.buttons.join(' | ')}]`);
            }
            const back = top.locator('.pf-back:visible');
            if (await back.count() > 0) return act(v, 'volver al punto guardado', () => press(back), { module: 'combat-flow.js (sayPartyFallen)', wait: 8000 });
            // Si no, la partida de la mañana («Cargar partida», H7): hasta tres veces por vuelta.
            const load = top.locator('.pf-load:visible');
            if (await load.count() > 0 && falls.length <= 3) {
                loadAfterFall = true;
                return act(v, 'cargar partida (ha caído el grupo)', () => press(load), { module: 'combat-flow.js (sayPartyFallen)', wait: 5000 });
            }
            return false;
        }
        if (layer.kind === 'saves') {
            // «Guardar y cargar» (save-screen.js): tras caer el grupo, la ranura de la mañana (la
            // automática) o, si no se puede, la más reciente que se pueda cargar; si no, se cierra.
            const yes = top.locator('.sv-confirm-yes:visible');
            if (await yes.count() > 0) {
                counts.loads++;
                return act(v, `«${(await yes.first().textContent() || '').trim()}»`, () => press(yes), { module: 'save-screen.js', wait: 15000 });
            }
            if (loadAfterFall) {
                loadAfterFall = false;
                const auto = top.locator('.sv-slot.sv-auto .sv-load:not([disabled])');
                const slot = await auto.count() > 0 ? auto : top.locator('.sv-slot .sv-load:not([disabled])');
                if (await slot.count() > 0) {
                    const said = (await slot.first().locator('xpath=ancestor::article[1]').textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
                    return act(v, `cargar la ranura «${said.slice(0, 80)}»`, () => press(slot), { module: 'save-screen.js' });
                }
            }
            return act(v, 'cerrar «Guardar y cargar»', () => press(top.locator('.sv-close')), { module: 'save-screen.js' });
        }
        if (layer.kind === 'scene' || layer.kind === 'dialogue' || layer.kind === 'meetup') {
            if (!layer.text && layer.options.length === 0) {
                silences.push({ n: steps.length, where: where(v), what: `ventana ${layer.kind} ${layer.id} sin texto`, sees: describe(v), module: 'plot-scene.js / dialogue-window.js' });
                log(`MUDO  ventana ${layer.kind} ${layer.id} sin texto`);
            }
            const free = layer.options.filter((/** @type {any} */ o) => !o.locked);
            if (free.length > 0) {
                const choice = pickOption(layer.options, layer.exit);
                counts.options++;
                if (layer.exit) counts.exits++;
                markDecision();
                choices.push({ scene: layer.exit ? `otra salida (${layer.exit}) ${layer.title}` : layer.id || layer.title, option: choice.text });
                const attr = choice.attr || 'data-option';
                return act(v, `elegir «${choice.text.slice(0, 60)}»${layer.id ? ` (${layer.id})` : layer.exit ? ` (otra salida: ${layer.title.slice(0, 40)})` : ''}`, async () => {
                    const option = top.locator(`.dw-option[${attr}="${choice.id}"]`);
                    const ok = await press(option);
                    // Lo que no tiene vuelta atrás se decide a la segunda pulsación (J11.1).
                    await page.waitForTimeout(150);
                    if (await top.locator(`.dw-option.nr-armed[${attr}="${choice.id}"]`).count() > 0) await press(option);
                    return ok;
                }, { module: layer.exit ? 'avoid-scene.js (party/avoid.js)' : layer.kind === 'scene' ? 'plot-scene.js' : 'dialogue-window.js', wait: layer.exit ? 5000 : undefined });
            }
            if (layer.kind === 'scene' && layer.id) counts.scenes += 0;
            const forward = top.locator('.qd-chip-next:visible, .qd-chip-finish:visible, .ps-finish:visible, .dw-finish:visible');
            if (await forward.count() > 0) return act(v, `«${(await forward.first().textContent() || '').replace(/[↵\s]+/g, ' ').trim()}»${layer.id ? ` (${layer.id})` : ''}`, () => press(forward), { module: 'plot-scene.js' });
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
        const ok = top.locator('.popup-button-ok:visible, .hb-close:visible, .mm-close:visible, .cm-close:visible');
        if (await ok.count() > 0) return act(v, `aceptar «${layer.title || layer.text.slice(0, 40)}»`, () => press(ok.last()), { module: 'popup' });
        const custom = top.locator('.popup-button-custom:visible');
        if (await custom.count() > 0) {
            markDecision();
            // La misma ventana otra vez (una puerta cerrada tras fallar «Con maña»): quien juega prueba
            // la otra salida, no la misma tirada sin fin.
            const key = layer.title || layer.text.slice(0, 60);
            const tries = popupTries.get(key) ?? 0;
            popupTries.set(key, tries + 1);
            const pick = custom.nth(tries % await custom.count());
            return act(v, `«${(await pick.textContent() || '').trim().slice(0, 40)}» en «${key.slice(0, 40)}»`, () => press(pick), { module: 'popup' });
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
    /**
     * Lo que hay en la pelea, dicho en una línea: los enemigos (con su vida, también los caídos), el
     * orden de turnos, el grupo (vida, muerto, salvaciones) y la misión del tablero. Para explicar
     * una pelea que no se cierra.
     *
     * @returns {Promise<string>}
     */
    const fightSaid = () => page.evaluate(async () => {
        const party = await import('/scripts/party.js');
        const enc = /** @type {any} */ (party.getCombatEncounter());
        const ctx = /** @type {any} */ ((await import('/scripts/party/board.js')).getActiveBoardContext());
        const foes = (enc?.enemies || []).map((/** @type {any} */ e) => `${e.name} ${e.currentHp}/${e.maxHp}${e.fled ? ' huido' : ''}${e.surrendered ? ' rendido' : ''}`).join(', ');
        const order = (enc?.turnOrder || []).map((/** @type {any} */ t) => `${t.name}${t.isEnemy ? '*' : ''}`).join(' > ');
        const crew = party.getPartyMembersSnapshot().map((/** @type {any} */ m) => `${m.name} ${m.hp}/${m.maxHp}${m.dead ? ' muerto' : ''}${m.deathSaves ? ` salv ${JSON.stringify(m.deathSaves)}` : ''}`).join(', ');
        const goals = (ctx?.board?.objectives || ctx?.objectives || []).map((/** @type {any} */ o) => `${o.type}${o.label ? ` «${o.label}»` : ''}`).join(', ');
        return `enemigos [${foes || 'ninguno'}]; turnos [${order}]; grupo [${crew}]${goals ? `; misión [${goals}]` : ''}; ronda ${enc?.round}`;
    }).catch((/** @type {any} */ e) => `(no se pudo leer: ${String(e).slice(0, 80)})`);

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
                // Y con la vida entera (1 de 1): con 1 de 16, la cobarde (la bruja de la taberna)
                // se ve malherida y huye por la sala para siempre.
                foe.maxHp = 1;
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
        if (fresh.unseen > 0 && fresh.unseen === fresh.live) {
            // Una pelea nueva: lo que no respondió en la anterior no cuenta para el gancho.
            counts.fights++;
            fightFails = 0;
            fightMissed = [];
            hookSaid = false;
        }
        // Recién puestos al lado, la barra aún no los tiene a su alcance: se mira otra vez (si no,
        // el primer turno se iba en «Fin de turno»).
        if (fast && fresh.unseen > 0) {
            await page.waitForTimeout(400);
            v = await observe(page).catch(() => v);
            if (!v.fight) return;
        }
        // Sin enemigos en pie la pelea se cierra sola (la victoria): quien juega espera, sin pulsar.
        // Se mide cuánto tarda (si salen dados o una ventana, se atienden y se sigue esperando);
        // si pasan 20 s y sigue abierta, se apunta y se sigue como siempre.
        const closeKey = `${v.board}|${v.done.length}|${counts.fights}`;
        const killAll = !goal || /^eliminate/.test(String(goal.type));
        if (killAll && v.fight.foes.length === 0 && closing.get(closeKey) !== -1) {
            if (!closing.has(closeKey)) closing.set(closeKey, Date.now());
            const t0 = Number(closing.get(closeKey));
            let now = v;
            await until(async () => {
                now = await observe(page);
                return !now.fight || now.dice || Boolean(now.layer);
            }, Math.max(0, 20000 - (Date.now() - t0)), 300);
            if (now.fight && (now.dice || now.layer)) return;
            const ms = Date.now() - t0;
            closing.set(closeKey, -1);
            steps.push({ n: steps.length + 1, what: `esperar a que se cierre la pelea, sin enemigos en pie (${ms} ms)`, silent: false, ms, where: where(v) });
            if (now.fight || ms > 3000) {
                const text = !now.fight
                    ? `sin enemigos en pie, la pelea tarda ${(ms / 1000).toFixed(1)} s en cerrarse (sin barra ni «Fin de turno» mientras tanto)`
                    : `sin enemigos en pie, la pelea sigue abierta a los 20 s, en el turno de ${now.fight.who} (barra: ${barSaid(now)}); en la pelea: ${await fightSaid()}`;
                oddities.push({ kind: 'cierre', n: steps.length, where: where(v), text });
                log(`RARO  cierre #${steps.length} ${text} (${where(v)})`);
            }
            if (!now.fight) return;
        }
        if (!v.fight.mine) {
            // El turno de los enemigos se juega solo; se espera un poco.
            await act(v, 'esperar el turno enemigo', async () => true, { quiet: true, wait: 1500 });
            return;
        }
        // El turno con el gancho (`playCurrentTurnAlone`, como «Que actúe solo»): en las peleas de
        // verdad (`fast` apagado), con VUELTA_PELEAS=gancho, o si la barra de combate no responde a
        // lo que pulsa la vuelta (la pelea se está rehaciendo: wiki/maquetas/ENCARGO_COMBATE_VTT.md).
        const hooked = !fast || process.env.VUELTA_PELEAS === 'gancho' || fightFails >= 2;
        if (hooked) {
            if (fast && !hookSaid) {
                hookSaid = true;
                log(`GANCHO #${steps.length} la barra de combate no responde a lo que pulsa la vuelta${process.env.VUELTA_PELEAS === 'gancho' ? ' (o VUELTA_PELEAS=gancho)' : ''}: los turnos del grupo van con playCurrentTurnAlone (${where(v)})`);
                // Por qué, una vez por pelea: lo que no respondió y lo que enseñaba la barra.
                if (fightMissed.length > 0) {
                    const text = `turno de ${v.fight.who} (ronda ${v.fight.round}, ${v.fight.foes.length} enemigos en pie) con el gancho: no respondió ${fightMissed.slice(-3).join(' / ')}; la barra dice «${v.turnLabel || '—'}» (${barSaid(v)})`;
                    oddities.push({ kind: 'gancho', n: steps.length, where: where(v), text });
                    log(`RARO  gancho #${steps.length} ${text}`);
                }
            }
            markDecision();
            if (fast) counts.hooked++;
            const did = await act(v, `su turno, solo (${v.fight.who})${fast ? ' (gancho)' : ''}`, () => page.evaluate(async () => (await import('/scripts/party.js')).playCurrentTurnAlone()), { module: 'combat', quiet: true });
            if (did) fightFails = 0;
            return;
        }
        // Lo que se pulsó en la barra y no hizo nada (no se pudo pulsar, o fue un silencio) cuenta
        // para pasar al gancho.
        const tally = (/** @type {boolean} */ did) => {
            const last = steps[steps.length - 1];
            if (did && !last?.silent) {
                fightFails = 0;
                fightMissed = [];
                return;
            }
            // Una ventana encima de la barra (la pregunta de «Fin de turno» de un clic que entró tarde,
            // o un aviso): no es la barra la que falla; la ventana se atiende en la vuelta siguiente.
            if (!did && /tapado por (una ventana|los dados)/.test(String(last?.what || ''))) return;
            fightFails++;
            fightMissed.push(`«${String(last?.what || '').slice(0, 320)}»${last?.silent ? ' (no cambia nada)' : ''}`);
        };
        // La barra se repinta a menudo (cada tirada, cada aviso): un botón puede no estar justo en el
        // momento de mirar. Se le da un momento antes de darlo por ausente.
        const settle = async (/** @type {any} */ locator) => {
            if (await locator.count() === 0) await locator.first().waitFor({ state: 'visible', timeout: 700 }).catch(() => {});
            return locator;
        };
        /**
         * Pulsar un botón de la barra que va y viene: se mira y se pulsa varias veces en 2,5 s. Si
         * hacen falta más de dos intentos, la barra se está repintando sin parar (se apunta una vez
         * por tablero: es lo que hacía pasar turnos al gancho en el Comedor del Conde).
         *
         * @param {any} locator
         * @param {string} what
         */
        const pressFlicker = async (locator, what) => {
            const until2 = Date.now() + 2500;
            let tries = 0;
            // Por qué no entró el último clic (lo que tapa el botón, sobre todo).
            let clickError = '';
            // El clic salió pero la página no lo atendió a tiempo («performing click action»: está
            // ocupada pintando), o una ventana se ha puesto encima de la barra: no se insiste.
            let busy = false;
            let covered = '';
            while (Date.now() < until2 && !busy && !covered) {
                tries++;
                if (await locator.count() > 0 && await locator.first().click({ timeout: 800 }).then(() => true).catch((/** @type {any} */ e) => {
                    const text = String(e?.message || e);
                    ({ busy, covered } = clickVerdict(text));
                    // Lo que dice Playwright al final de su registro (lo último que esperaba), si no hay algo más claro.
                    const tail = text.split('\n').map(l => l.trim()).filter(Boolean).slice(-2).join(' / ');
                    clickError = (/<[^>]+> from <[^>]+> subtree intercepts pointer events|<[^>]+> intercepts pointer events|element is not (visible|enabled|stable)|element is outside of the viewport|element was detached/.exec(text)?.[0] ?? tail).slice(0, 220);
                    return false;
                })) {
                    if (tries > 2 && !oddSeen.has(`barra:${v.board}:${what}`)) {
                        oddSeen.add(`barra:${v.board}:${what}`);
                        const text = `«${what}» aparece y desaparece: hicieron falta ${tries} intentos en ${2500 - Math.max(0, until2 - Date.now())} ms para pulsarlo (ronda ${v.fight.round}, ${v.fight.foes.length} enemigos en pie)`;
                        oddities.push({ kind: 'barra', n: steps.length, where: where(v), text });
                        log(`RARO  barra #${steps.length} ${text} (${where(v)})`);
                    }
                    return true;
                }
                await page.waitForTimeout(120);
            }
            const seen = await page.evaluate((/** @type {string} */ words) => {
                const all = [...document.querySelectorAll('button, .menu_button, .gs-btn, .gs-target')].filter(b => (b.textContent || '').includes(words));
                const shown = all.filter(b => { const r = b.getBoundingClientRect(); return r.width > 1 && r.height > 1 && window.getComputedStyle(b).visibility !== 'hidden'; });
                // Lo que hay justo encima de su centro (si no es él, algo lo tapa) y si deja pulsarse.
                const first = shown[0];
                const box = first?.getBoundingClientRect();
                const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
                const hitSaid = !first ? '' : !hit ? 'nada' : first.contains(hit) ? 'él mismo'
                    : `${hit.tagName.toLowerCase()}.${String(hit.className || '').trim().split(/\s+/).slice(0, 3).join('.')}`;
                const pointer = first ? window.getComputedStyle(first).pointerEvents : '';
                return `en la página: ${all.length}, a la vista: ${shown.length}, apagados: ${all.filter(b => /** @type {HTMLButtonElement} */ (b).disabled || b.getAttribute('aria-disabled') === 'true').length}${first ? `, encima de su centro: ${hitSaid}, pointer-events: ${pointer}` : ''}`;
            }, what === 'Fin de turno' ? 'Fin de turno' : '').catch(() => '');
            // «Timeout» hace que act() mire si la pantalla cambia después (clic lento, no fallo).
            pressError = busy ? `Timeout: la página no atendió el clic en 800 ms (estaba ocupada); intento ${tries}`
                : covered ? `tapado por ${/wm-dice-/.test(covered) ? 'los dados' : 'una ventana'} (${covered}; intento ${tries})`
                    : `no está (${tries} intentos en 2,5 s${what === 'Fin de turno' && seen ? `; «Fin de turno» ${seen}` : ''}${clickError ? `; el clic: ${clickError}` : ''})`;
            return false;
        };
        const attack = page.locator('#game-shell .gs-actions .gs-btn-attack:not([disabled])');
        // Una acción por turno: tras atacar, la barra tarda en apagar «Atacar», y pulsarlo otra vez
        // no abre nada. Se ataca una vez por turno y luego se anda o se acaba el turno.
        const turnKey = `${v.fight.round}:${v.fight.who}`;
        const barAttack = v.bar.find((/** @type {any} */ b) => /^Atacar$/.test(b.text));
        const retry = walkedOn === turnKey && retriedOn !== turnKey;
        if (v.fight.foes.length > 0 && (lastAttack !== turnKey || retry) && !barAttack?.off && await attack.count() > 0) {
            markDecision();
            lastAttack = turnKey;
            if (retry) retriedOn = turnKey;
            // La barra nueva (combat-vtt/action-bar.js): «Atacar» abre y cierra su menú (`.gs-grimoire`),
            // con el arma y debajo a quién llegas (`.gs-target`, apagado si no llegas). Si ya está
            // abierto, no se pulsa otra vez (lo cerraría).
            const targets = page.locator('#game-shell .gs-targets .gs-target:not([disabled])');
            if (await targets.count() === 0) {
                await press(attack);
                await page.waitForTimeout(200);
                // Los dados de la iniciativa salen de uno en uno, y entre uno y otro la barra ya dice
                // «Turno de …»: si han salido encima, se pasan en la vuelta siguiente (no cuenta).
                if (await page.locator('.wm-dice-overlay.active').count() > 0 && await targets.count() === 0) {
                    lastAttack = '';
                    steps.push({ n: steps.length + 1, what: `atacar (${v.fight.who}): tapado por los dados (salen otros dados encima)`, silent: false, ms: 0, where: where(v) });
                    return;
                }
            }
            // Nadie a su alcance: las tarjetas apagadas, o el menú que lo dice («Nadie a tu alcance: el más
            // cercano…», `.gs-grimoire-empty`).
            const anyTarget = await page.locator('#game-shell .gs-targets .gs-target, #game-shell .gs-targets .gs-grimoire-empty').count();
            if (anyTarget > 0 && await targets.count() === 0) {
                // Nadie a su alcance (las tarjetas, apagadas): se anda; no cuenta para el gancho.
                steps.push({ n: steps.length + 1, what: `atacar (${v.fight.who}): nadie a su alcance`, silent: false, ms: 0, where: where(v) });
            } else {
                tally(await act(v, `atacar (${v.fight.who})`, () => pressFlicker(targets, 'el enemigo en «Atacar»'), { module: 'combat' }));
            }
            // Sin nadie a su alcance, el menú se queda abierto: se cierra para andar.
            await press(page.locator('#game-shell .gs-targets-close:visible'), 500);
            return;
        }
        const auto = page.locator('#game-shell .gs-actions .gs-btn-auto');
        if (await auto.count() > 0) {
            tally(await act(v, `que actúe solo (${v.fight.who})`, () => press(auto), { module: 'combat' }));
            return;
        }
        // Andar: hacia la casilla que pide el tablero («Salir por la ventana»), o hacia el
        // enemigo más cercano. Se pulsa la casilla encendida que más acerca, como quien juega.
        const pickStep = () => stepToward(goal?.cell ?? null);
        let step = await pickStep();
        // Las casillas a las que se anda se encienden al pulsar tu ficha: primero, tu ficha.
        if (step && step.x === undefined && step.token) {
            await press(page.locator(`#game-shell .wm-token[data-token-id="${step.token}"]`));
            await page.waitForTimeout(250);
            step = await pickStep();
        }
        if (step && step.x === undefined) step = null;
        if (step && lastWalk.turn === turnKey && lastWalk.from === `${step.from.x},${step.from.y}`) {
            const said = (await observe(page).catch(() => null))?.toasts?.join(' / ') || 'sin aviso';
            oddities.push({ kind: 'anda', n: steps.length, where: where(v), text: `la casilla (${step.x + 1}, ${step.y + 1}) se enciende para andar, pero ${v.fight.who} no se mueve de (${step.from.x + 1}, ${step.from.y + 1}): ${said}` });
            step = null;
        }
        if (step) {
            markDecision();
            walkedOn = turnKey;
            lastWalk = { turn: turnKey, from: `${step.from.x},${step.from.y}` };
            tally(await act(v, `andar a (${step.x + 1}, ${step.y + 1}) hacia (${step.goal.x + 1}, ${step.goal.y + 1})`,
                () => press(page.locator(`.wm-highlight-clickable.wm-highlight-move[data-x="${step.x}"][data-y="${step.y}"]`)), { module: 'board-view.js' }));
            return;
        }
        // «Fin de turno», en la barra de siempre o en la nueva (que va fuera de `.gs-actions`).
        const end = page.locator('#game-shell .gs-actions .gs-btn:not([disabled]):visible, #game-shell button:not([disabled]):visible').filter({ hasText: /Fin de turno/ });
        if (await (await settle(end)).count() === 0 && !turnSeen.has(`${v.board}|${v.fight.who}`)) {
            turnSeen.add(`${v.board}|${v.fight.who}`);
            const text = `es el turno de ${v.fight.who} (ronda ${v.fight.round}, ${v.fight.foes.length} enemigos en pie) y no hay «Fin de turno» que pulsar: la barra dice «${v.turnLabel || '—'}» (${barSaid(v)})`;
            oddities.push({ kind: 'turno', n: steps.length, where: where(v), text });
            log(`RARO  turno #${steps.length} ${text} (${where(v)})`);
        }
        tally(await act(v, `fin de turno (${v.fight.who})`, async () => {
            const ok = await pressFlicker(end, 'Fin de turno');
            const why = pressError;
            // Fin de turno con acción sin gastar pregunta antes.
            await page.waitForTimeout(200);
            await press(page.locator('dialog[open] .popup-button-ok'), 800);
            pressError = why;
            return ok;
        }, { module: 'combat' }));
    };

    /**
     * La casilla encendida que más acerca a `want` (o, sin `want`, al enemigo en pie más cercano),
     * para quien tiene el turno o, fuera de combate, para el héroe. Sin casillas encendidas, su
     * ficha (`token`), para pulsarla y que se enciendan; null si no hay adónde ir.
     *
     * @param {{x: number, y: number}|null} want
     * @returns {Promise<any>}
     */
    const stepToward = (want) => page.evaluate(async (/** @type {any} */ wanted) => {
        const party = await import('/scripts/party.js');
        const enc = /** @type {any} */ (party.getCombatEncounter());
        const entry = enc?.active ? enc?.turnOrder?.[enc?.currentTurnIndex] : null;
        const me = party.getPartyMembersSnapshot().find((/** @type {any} */ m) => String(m.name) === String(entry?.name)) ?? party.getPartyMembersSnapshot()[0];
        const from = { x: Number(me?.mapPosition?.gridX) || 0, y: Number(me?.mapPosition?.gridY) || 0 };
        const foes = (enc?.active ? enc?.enemies || [] : []).filter((/** @type {any} */ e) => (Number(e.currentHp) || 0) > 0).map((/** @type {any} */ e) => ({ x: Number(e.gridX) || 0, y: Number(e.gridY) || 0 }));
        const far = (/** @type {any} */ a, /** @type {any} */ b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const goal = wanted ?? foes.sort((a, b) => far(from, a) - far(from, b))[0] ?? null;
        if (!goal || far(from, goal) === 0) return null;
        const token = String(me?.id ?? '');
        const cells = [...document.querySelectorAll('.wm-highlight-clickable.wm-highlight-move')]
            .map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) }))
            .filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));
        const best = cells.sort((a, b) => far(a, goal) - far(b, goal))[0];
        if (cells.length === 0) return { token, goal, from };
        return best && far(best, goal) < far(from, goal) ? { ...best, token, goal, from } : null;
    }, want).catch(() => null);

    /** Las veces que se ha andado fuera de combate en cada tablero, para no dar vueltas sin fin. */
    /** @type {Map<string, number>} */
    const boardWalks = new Map();

    /**
     * Fuera de combate, en el tablero: andar hasta la casilla que pide su misión («Llegar a la
     * puerta principal»). Acabada la pelea sin nadie en pie, lo que queda se hace andando (Tanda
     * 16, combat-flow.js `checkObjectiveLeft`): quien juega pulsa su ficha y luego la casilla.
     * Devuelve false si no hay adónde ir o ya se ha probado muchas veces.
     *
     * @param {any} v
     * @param {{x: number, y: number}} cell
     */
    const walkBoard = async (v, cell) => {
        const key = `${v.board}|${v.done.length}`;
        const tries = boardWalks.get(key) ?? 0;
        if (tries >= 12) return false;
        boardWalks.set(key, tries + 1);
        let step = await stepToward(cell);
        if (step && step.x === undefined && step.token) {
            await press(page.locator(`#game-shell .wm-token[data-token-id="${step.token}"]`));
            await page.waitForTimeout(250);
            step = await stepToward(cell);
        }
        if (!step || step.x === undefined) return false;
        markDecision();
        return act(v, `andar (fuera de combate) a (${step.x + 1}, ${step.y + 1}), lo que pide el tablero: (${cell.x + 1}, ${cell.y + 1})`,
            () => press(page.locator(`.wm-highlight-clickable.wm-highlight-move[data-x="${step.x}"][data-y="${step.y}"]`)), { module: 'board-view.js (andar fuera de combate)', wait: 4000 });
    };

    /**
     * Fuera de combate, en un tablero cuya misión pide un tesoro («Encontrar la reliquia: está en
     * un cofre del tablero; id a su lado y pulsadlo»): andar al lado del cofre cerrado más cercano
     * y pulsarlo, como quien juega. Devuelve false si no queda cofre o ya se ha probado mucho.
     *
     * @param {any} v
     */
    const lootChest = async (v) => {
        const key = `cofre|${v.board}|${v.done.length}`;
        const tries = boardWalks.get(key) ?? 0;
        if (tries >= 12) return false;
        boardWalks.set(key, tries + 1);
        // Los cofres que siguen cerrados (abierto, pasa a ser suelo) y dónde está el héroe.
        const seen = await page.evaluate(async () => {
            const board = await import('/scripts/party/board.js');
            const party = await import('/scripts/party.js');
            const cells = /** @type {any} */ (board.getActiveBoardTerrain())?.cells ?? {};
            const chests = Object.entries(cells).filter(([, c]) => /** @type {any} */ (c)?.type === 'chest')
                .map(([at]) => ({ x: Number(at.split(',')[0]), y: Number(at.split(',')[1]) }));
            const me = /** @type {any} */ (party.getPartyMembersSnapshot()[0]);
            return { chests, from: { x: Number(me?.mapPosition?.gridX) || 0, y: Number(me?.mapPosition?.gridY) || 0 } };
        }).catch(() => ({ chests: [], from: { x: 0, y: 0 } }));
        const far = (/** @type {any} */ a, /** @type {any} */ b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        const chest = [...seen.chests].sort((a, b) => far(seen.from, a) - far(seen.from, b))[0];
        if (!chest) return false;
        if (far(seen.from, chest) > 1) {
            let step = await stepToward(chest);
            if (step && step.x === undefined && step.token) {
                await press(page.locator(`#game-shell .wm-token[data-token-id="${step.token}"]`));
                await page.waitForTimeout(250);
                step = await stepToward(chest);
            }
            if (!step || step.x === undefined) return false;
            markDecision();
            return act(v, `andar (fuera de combate) a (${step.x + 1}, ${step.y + 1}), hacia el cofre de (${chest.x + 1}, ${chest.y + 1})`,
                () => press(page.locator(`.wm-highlight-clickable.wm-highlight-move[data-x="${step.x}"][data-y="${step.y}"]`)), { module: 'board-view.js (andar fuera de combate)', wait: 4000 });
        }
        // Al lado: el cofre del dibujo (no lleva su casilla; van en el mismo orden que en el mapa).
        const marked = await page.evaluate((/** @type {any} */ want) => {
            document.querySelectorAll('[data-vuelta-chest]').forEach(n => n.removeAttribute('data-vuelta-chest'));
            const nodes = [...document.querySelectorAll('#game-shell .wm-terrain-chest.wm-terrain-door-actionable')]
                .map(n => ({ n, left: parseFloat(/** @type {HTMLElement} */ (n).style.left) || 0, top: parseFloat(/** @type {HTMLElement} */ (n).style.top) || 0 }))
                .sort((a, b) => a.top - b.top || a.left - b.left);
            const cells = [...want.all].sort((a, b) => a.y - b.y || a.x - b.x);
            if (nodes.length !== cells.length) return false;
            const at = cells.findIndex(c => c.x === want.chest.x && c.y === want.chest.y);
            nodes[at]?.n.setAttribute('data-vuelta-chest', '');
            return at >= 0;
        }, { all: seen.chests, chest }).catch(() => false);
        if (!marked) return false;
        markDecision();
        return act(v, `abrir el cofre de (${chest.x + 1}, ${chest.y + 1}), lo que pide el tablero`, () => press(page.locator('[data-vuelta-chest]')), { module: 'loot.js (openChest)', wait: 4000 });
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
     * D-J62, el modo guiado: pulsar un paso de «Lo que pide la historia» que case
     * (`story:go:La Granja`, `story:board:…`, `story:talk:…`, `story:check:…`).
     *
     * @param {any} v
     * @param {(step: {id: string, kind: string, note: string, off: boolean}) => boolean} test
     * @param {string} what
     * @param {string} [module]
     */
    const storyStep = async (v, test, what, module = 'guided-mode.js') => {
        if (v.scene !== 'exploration' || v.town.inside) return false;
        const found = (v.steps ?? []).find((/** @type {any} */ s) => !s.off && test(s));
        if (!found) return false;
        return act(v, what, () => press(page.locator(`#game-shell .gs-story-step[data-step="${String(found.id).replace(/"/g, '')}"]`)), { module });
    };

    /**
     * D-J62: lo del gremio (saltar la prueba, el tablón, contratar) está dentro de la Casa del Gremio.
     * Un paso hacia ello: salir del sitio abierto, entrar en la sala, pulsarlo.
     *
     * @param {any} v
     * @param {string} id `hub-skip`, `hub-board`…
     * @param {string} what
     * @returns {Promise<boolean>}
     */
    const hallAct = async (v, id, what) => {
        if (v.scene !== 'exploration') return false;
        if (v.town.inside && v.town.inside !== 'gremio') return act(v, 'volver al pueblo', () => press(page.locator('#game-shell .gs-town-back')), { module: 'town-scene.js' });
        if (!v.town.inside) {
            if (!v.town.places.some((/** @type {any} */ p) => p.id === 'gremio')) return false;
            return act(v, 'entrar en la Casa del Gremio', () => press(page.locator('#game-shell .gs-town-place[data-place="gremio"]')), { module: 'town-scene.js' });
        }
        if (!v.town.acts.some((/** @type {any} */ a) => a.id === id && !a.off)) return false;
        return act(v, what, () => press(page.locator(`#game-shell .gs-town-scene .gs-town-act[data-action="${id}"]`)), { module: 'guild-hall.js' });
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
        // D-J62: con el modo guiado, «Ir a…» en lo que pide la historia (el sitio, o el primero del camino).
        if (await storyStep(v, (s) => s.kind === 'go' && (plain(s.id) === plain(`story:go:${place}`) || plain(s.note).includes(plain(`De camino a ${place}`))
            || plain(s.note).includes(plain(`De vuelta a ${place}`))), `ir a ${place} (lo que pide la historia)`)) {
            counts.travels++;
            markDecision();
            return true;
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
     * Si toca descansar, como lo haría quien juega con cabeza: con «Agotamiento 2 de 6» (hambre,
     * sed o sueño) o con el héroe por debajo de la mitad de su vida. Una vez por día de campaña:
     * si en unos pasos no encuentra dónde, lo apunta como atasco y sigue con la historia.
     *
     * @param {any} v
     */
    const wantsRest = (v) => {
        if (v.fight || v.layer || !restNeed(v)) return false;
        if (restDay !== v.day) {
            restDay = v.day;
            restTries = 0;
        }
        return restTries < 10;
    };

    /**
     * Un paso hacia descansar: la habitación de la posada (o comer caliente, o la sala común);
     * donde no hay posada, la tarjeta «Descansar» (acampar o el descanso largo); y si no, las
     * fichas «Acampar aquí» o «Cazar y forrajear». Devuelve false si no hay nada de eso a la vista.
     *
     * @param {any} v
     */
    const tend = async (v) => {
        restTries++;
        const why = restNeed(v);
        // Los botones de la posada y de «Descansar»: dentro de un sitio del pueblo (`gs-town-act`)
        // o en la columna «Aquí mismo» de la pantalla del sitio (`gs-service-btn`).
        const town = (/** @type {string} */ id) => page.locator(`#game-shell :is(.gs-town-act, .gs-service-btn)[data-action="${id}"]:not([disabled]):visible`);
        const rested = async (/** @type {string} */ what, /** @type {any} */ button, /** @type {string} */ module) => {
            counts.rests++;
            markDecision();
            const done = await act(v, `${what} (${why})`, () => press(button), { module, wait: 6000 });
            if (done) restTries = 99;
            return done;
        };
        const back = () => act(v, 'volver al pueblo', () => press(page.locator('#game-shell .gs-town-back')), { module: 'town-scene.js' });
        // Lo que se ve ya: dormir (o comer) en la posada; si no hay, acampar o el descanso largo. El
        // corto solo da de beber: solo si lo que falta es vida.
        const beds = [['inn-room', 'dormir en una habitación'], ['inn-meal', 'comer caliente'], ['chip:camp', 'acampar'], ['clock:long', 'descanso largo'],
            ['inn-common', 'dormir en la sala común'], ...(v.tired >= 2 ? [] : [['clock:short', 'descanso corto']])];
        for (const [id, what] of beds) {
            if (await town(id).count() > 0) return rested(what, town(id), id.startsWith('inn-') ? 'town.js (posada)' : 'game-shell.js (Descansar)');
        }
        if (v.town.inside) return back();
        if (v.board) return toMap(v);
        // La posada; si no hay, «Descansar»; y si tampoco, la plaza, que recoge lo que no tiene sitio
        // propio (en el Castillo de Vane, el descanso largo está ahí). Cada uno, una vez al día.
        const spot = ['posada', 'descanso', 'plaza'].map(id => v.town.places.find((/** @type {any} */ p) => p.id === id))
            .find(p => p && !restLooked.has(`${v.day}:${v.location}:${p.id}`));
        if (spot) {
            restLooked.add(`${v.day}:${v.location}:${spot.id}`);
            return act(v, `entrar en ${spot.id} para descansar (${why})`, () => press(page.locator(`#game-shell .gs-town-place[data-place="${spot.id}"]`)), { module: 'town-scene.js' });
        }
        // Mientras se lee no se ofrece descansar (J18.9): primero, a la pantalla del sitio.
        if (v.scene !== 'exploration' && await toMap(v)) return true;
        for (const [pattern, what] of /** @type {Array<[RegExp, string]>} */ ([[/^Acampar aquí$/, 'acampar aquí'], [/^Cazar y forrajear$/, 'cazar y forrajear']])) {
            if (await tapChip(v, pattern, `${what} (${why})`, 'action-chips.js')) {
                counts.rests++;
                markDecision();
                restTries = 99;
                return true;
            }
        }
        // Aún no se ve la pantalla del sitio (la caja de la novela a medio cambiar): otra vuelta.
        if (v.scene !== 'exploration' || (v.town.places.length === 0 && v.places.length === 0)) {
            return act(v, `esperar a ver el sitio para descansar (${why})`, async () => true, { quiet: true, wait: 1500 });
        }
        // Ni posada, ni «Descansar», ni acampar a la vista: se apunta y se sigue con la historia.
        restTries = 99;
        const key = `descanso:${v.location}`;
        if (!oddSeen.has(key)) {
            oddSeen.add(key);
            oddities.push({ kind: 'descanso', n: steps.length, where: where(v), text: `hace falta descansar (${why}) y no se ve dónde: ni posada, ni «Descansar», ni «Acampar aquí»` });
            log(`RARO  descanso #${steps.length} sin sitio para descansar (${why}) (${where(v)})`);
        }
        return false;
    };

    /**
     * El combate nuevo (ENCARGO_COMBATE_VTT.md): al entrar en un tablero con gente, se colocan los
     * tuyos en las casillas de salida y se confirma. La vuelta deja la colocación que viene y pulsa
     * el botón que lo confirma (`v.start`).
     *
     * @param {any} v
     */
    const confirmStart = (v) => {
        markDecision();
        const said = String(v.start[0] || '');
        return act(v, `«${said}» (colocados, a pelear)`, () => press(page.locator('#game-shell button:visible, #game-shell .menu_button:visible, .gs-root button:visible, .cv-place button:visible')
            .filter({ hasText: new RegExp(`^\\s*${escape(said)}\\s*$`) })), { module: 'combate nuevo (colocar)', wait: 5000 });
    };

    /**
     * Un paso hacia lo que pide la historia. Devuelve false si no encuentra qué pulsar.
     *
     * @param {any} v
     * @param {Target} t
     * @param {{type: string, cell?: {x: number, y: number}, loot?: boolean}|null} [goal] Lo que pide el tablero del hito.
     */
    const pursue = async (v, t, goal = null) => {
        if (t.place && plain(v.location) !== plain(t.place)) return travelTo(v, t.place);
        if ((t.kind === 'win' || t.kind === 'defeat') && t.board) {
            if (plain(v.board) === plain(t.board)) {
                if (v.start.length > 0) return confirmStart(v);
                // La llegada al tablero se lee antes de pelear (el muelle del prólogo): «Continuar».
                if (v.scene === 'dialogue' && v.vn.next && await chip(/^Continuar$/).count() > 0) {
                    return act(v, '«Continuar» (antes de pelear)', () => press(chip(/^Continuar$/)), { module: 'game-shell.js' });
                }
                if (await tapChip(v, /^Iniciar combate/, 'iniciar el combate', 'action-chips.js')) return true;
                if (await tapChip(v, /^(¡?A pelear!?|Pelear)$/, 'pelear', 'action-chips.js')) return true;
                // Al llegar, como quien mira el tablero un momento: la pelea con lo que está a la vista
                // empieza sola. Abrir antes una puerta despierta solo esa sala, y la pelea empieza sin
                // quien está a la vista (Strahd, la taberna: sin la bruja, la pelea no se acaba; H17).
                // A veces la pelea tarda más de 3 s en abrirse: se espera dos veces.
                const waitKey = `${v.board}|${v.done.length}`;
                const waited = startWaits.get(waitKey) ?? 0;
                if (waited < 2) {
                    startWaits.set(waitKey, waited + 1);
                    return act(v, `esperar a que empiece la pelea (${t.board})`, async () => true, { quiet: true, wait: 3000 });
                }
                // Sin nadie a la vista, lo que duerme tras una puerta se despierta abriéndola.
                if (await tapChip(v, /^Abrir la puerta/, 'abrir una puerta del tablero', 'action-chips.js')) return true;
                const button = page.locator('#game-shell .wm-start-combat:visible, #game-shell .wm-fight-btn:visible');
                if (await button.count() > 0) return act(v, 'iniciar el combate (botón del tablero)', () => press(button), { module: 'board-view.js' });
                // Sin pelea y con lo que queda por hacer andando (la pelea ya acabó): el cofre que
                // pide la misión, y la casilla a la que hay que llegar.
                if (goal?.loot && await lootChest(v)) return true;
                if (goal?.cell && await walkBoard(v, goal.cell)) return true;
                // El combate nuevo empieza solo al entrar: se espera un poco antes de darlo por atascado.
                if (waited < 3) {
                    startWaits.set(waitKey, waited + 1);
                    return act(v, `esperar a que empiece la pelea (${t.board})`, async () => true, { quiet: true, wait: 3000 });
                }
                return false;
            }
            // D-J62: «Ir a…» el tablero de aquí que pide la historia (sin la fila ni «Tableros de aquí»).
            if (await storyStep(v, (s) => s.kind === 'board' && plain(s.id) === plain(`story:board:${t.board}`), `ir a ${t.board} (lo que pide la historia)`)) return true;
            if (await tapChip(v, new RegExp(`^Entrar en ${escape(t.board)}$`), `entrar en ${t.board}`, 'action-chips.js')) return true;
            if (v.scene === 'exploration' && v.boards.some((/** @type {string} */ b) => plain(b) === plain(t.board))) {
                return act(v, `entrar en ${t.board} (tarjeta)`, () => press(page.locator('#game-shell .gs-board').filter({ has: page.locator('.gs-board-name', { hasText: new RegExp(`^${escape(t.board)}$`) }) })), { module: 'game-shell.js' });
            }
            return toMap(v);
        }
        if (t.kind === 'talk' && t.npc) {
            const talk = new RegExp(`^Hablar con ${escape(t.npc)}`);
            if (await storyStep(v, (s) => s.kind === 'talk' && plain(s.id) === plain(`story:talk:${t.npc}`), `hablar con ${t.npc} (lo que pide la historia)`)) { counts.talks++; return true; }
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
            // D-J62: sin la «Tirada» suelta, lo que pide la historia («Intentarlo», «Buscar una pista»).
            if (await storyStep(v, (s) => s.kind === 'check' && plain(s.id) === plain(`story:check:${t.skill}`), `tirada de ${t.skill} (lo que pide la historia)`)) {
                counts.checks++;
                markDecision();
                return true;
            }
            if (v.town.inside && (v.steps ?? []).length === 0) return act(v, 'volver al pueblo', () => press(page.locator('#game-shell .gs-town-back')), { module: 'town-scene.js' });
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

    /**
     * Mirar lo que se ve ahora por si algo se lee mal (lo llama `runCampaign` en cada paso).
     *
     * @param {any} v
     * @param {{onDone?: Set<string>}} [how] onDone: los hitos cuya escena se juega al cumplirse (los
     *   de «llegar a», que cuentan la llegada, y los que no piden nada): no llegan tarde si salen allí.
     */
    const inspect = (v, { onDone = new Set() } = {}) => {
        const odd = (/** @type {'crudo'|'encima'|'tarde'|'portada'} */ kind, /** @type {string} */ key, /** @type {string} */ text) => {
            if (oddSeen.has(`${kind}:${key}`)) return;
            oddSeen.add(`${kind}:${key}`);
            oddities.push({ kind, n: steps.length, where: where(v), text });
            log(`RARO  ${kind} #${steps.length} ${text.slice(0, 200)} (${where(v)})`);
        };
        for (const id of v.done) {
            if (!doneAt.has(id)) doneAt.set(id, { where: where(v), n: steps.length, location: v.location, day: v.day });
        }
        // J18.10: la etiqueta del motor, a la vista (en la caja de la novela o en una ventana).
        for (const seen of [v.vn.text, v.layer?.text ?? '']) {
            const hit = TAG.exec(seen);
            if (hit) odd('crudo', seen.slice(Math.max(0, hit.index - 20), hit.index + 60), `se lee «${seen.slice(Math.max(0, hit.index - 20), hit.index + 140)}»`);
        }
        // La portada («DnD Coin», Jugar sin conexión…) a la vista con una partida ya empezada: al
        // cargar una campaña desde el tablón se veía un momento.
        if (v.scene === 'title' && v.world && v.menu.length > 0) {
            odd('portada', v.world, `se ve la portada (${v.menu.slice(0, 3).join(', ')}…) con la partida ya empezada (${v.world})`);
        }
        // Una ventana encima de otra que espera un clic (una escena sobre un suceso a medias).
        if (v.layer && v.under.some((/** @type {string} */ u) => /^(suceso|scene|dialogue|talk)/.test(u))) {
            odd('encima', `${v.layer.kind} ${v.layer.id} / ${v.under.join(',')}`, `ventana «${v.layer.kind}» ${v.layer.id || v.layer.title} abierta encima de: ${v.under.join(', ')}`);
        }
        // La escena de un hito que ya se cumplió antes de salir ella (J9.2): llega tarde. Solo al
        // abrirse: la escena que es la charla del hito (D-J39) lo cumple mientras está abierta.
        const opening = v.layer?.kind === 'scene' && v.layer.id && !oddSeen.has(`abierta:${v.layer.id}`);
        if (opening) oddSeen.add(`abierta:${v.layer.id}`);
        // J9.1: la escena de una llegada sale al cumplirse (al llegar): allí y ese día no es tarde.
        // Y la de un hito «llegar a» o sin nada que pedir (`onDone`) puede esperar a los sucesos de la
        // llegada, que a veces se llevan un día: mientras siga en el mismo sitio, tampoco.
        const arrival = (/** @type {any} */ was) => plain(was.location) === plain(v.location) && (was.day === v.day || onDone.has(String(v.layer?.id)));
        if (opening && doneAt.has(v.layer.id) && !arrival(doneAt.get(v.layer.id))) {
            const was = /** @type {any} */ (doneAt.get(v.layer.id));
            odd('tarde', v.layer.id, `la escena del hito «${v.layer.id}» sale con el hito ya cumplido (paso ${was.n}, ${was.where})${plain(was.location) !== plain(v.location) ? ', y en otro sitio' : ''}`);
        }
    };

    return {
        steps, silences, blocks, choices, counts, slow, oddities, falls, inspect, wantsRest, tend, confirmStart,
        /** Cuándo se decidió algo por primera vez (una opción, un viaje, un golpe). */
        get firstDecisionAt() { return firstDecisionAt; },
        started,
        until, press, act, noteBlock, slash, chip, tapChip, storyStep, hallAct, toMap, travelTo, pursue, handleLayer, fightTurn, markDecision, where, describe,
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
    // J9.1: la escena de un hito «llegar a» se juega al llegar (al cumplirse); la de uno que no pide
    // nada, también: se cumple en cuanto se abre.
    const onDone = new Set((pack.plot?.milestones ?? []).filter((/** @type {any} */ m) => ['arrive', 'none'].includes(String(m.asks?.kind || 'none'))).map((/** @type {any} */ m) => String(m.id)));
    let lastDone = -1;
    let sinceProgress = 0;
    let misses = 0;
    let rescues = 0;
    // Lo repetido se mira solo en lo que se ha hecho desde aquí: lo de antes (el tablón, el gremio)
    // no es de esta campaña.
    const first = bot.steps.length;
    /** @type {any} */
    let v = await bot.observe();
    for (let i = 0; i < maxSteps; i++) {
        // Al cargar una partida la página se rehace un momento: se mira otra vez.
        v = await bot.observe().catch(async () => {
            await bot.page.waitForTimeout(3000);
            return bot.observe();
        });
        bot.inspect(v, { onDone });
        if (stop(v)) return { reached: true, gaveUp: '', view: v };
        if (v.done.length !== lastDone) {
            if (lastDone >= 0) log(`  hito: ${v.done[v.done.length - 1]} (${v.done.length} hechos) · ${bot.where(v)} · paso ${bot.steps.length}`);
            lastDone = v.done.length;
            sinceProgress = 0;
            rescues = 0;
        }
        sinceProgress++;
        if (verbose) log(`  · ${bot.steps.length} ${bot.steps[bot.steps.length - 1]?.what ?? ''} · ${bot.where(v)}${v.hero ? ` · ${v.hero.hp}/${v.hero.maxHp} PG${v.tired ? ` · agot. ${v.tired}` : ''}` : ''}`);
        else if (i % 40 === 39) log(`  · paso ${bot.steps.length}: ${bot.steps[bot.steps.length - 1]?.what ?? ''} · ${bot.where(v)}`);
        // Ha caído el grupo entero y no hay punto guardado al que volver, ni partida que cargar (o ya
        // se ha cargado tres veces): la vuelta acaba aquí.
        if (v.layer?.kind === 'fallen' && await bot.page.locator('dialog[data-vuelta-top] .pf-back:visible').count() === 0
            && (bot.falls.length >= 3 || await bot.page.locator('dialog[data-vuelta-top] .pf-load:visible').count() === 0)) {
            await bot.handleLayer(v, { onHub, onEnd });
            return { reached: false, gaveUp: `ha caído el grupo: ${v.layer.text.slice(0, 160)}`, view: v };
        }
        const open = v.open.filter((/** @type {string} */ id) => !side.has(id));
        const main = order.find(id => open.includes(id)) ?? open[0] ?? '';
        const target = main ? targetOf(main) : { id: '', kind: 'none' };
        // Atascado: nada que pulsar, lo mismo una y otra vez, o muchos pasos sin cumplir nada.
        // Pasar dados, turnos y páginas de una escena se repite sin estar atascado.
        const recent = bot.steps.slice(Math.max(first, bot.steps.length - 12)).map(s => s.what).filter(w => !/dados|turno enemigo|^atacar|fin de turno|^andar|^su turno, solo|^esperar a|^«(Seguir|Terminar)»/.test(w));
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
        // El combate nuevo, a medio empezar (colocando a los tuyos): se confirma, sea o no el
        // tablero que pide el hito (una pelea al llegar también empieza así).
        if (v.board && v.start.length > 0) {
            misses = 0;
            await bot.confirmStart(v);
            continue;
        }
        // Comer y dormir antes de que el hambre o las heridas maten (como quien lee el aviso).
        if (bot.wantsRest(v) && await bot.tend(v)) {
            misses = 0;
            continue;
        }
        if (!main) {
            // Recién empezada la campaña, el hilo tarda un momento en abrir su primer hito.
            if (v.done.length === 0 && i < 40) {
                await bot.page.waitForTimeout(500);
                continue;
            }
            // Sin hito que seguir: lo que haya que leer, y si no hay nada, se acabó.
            if (v.scene === 'dialogue' && v.vn.next && await bot.chip(/^Continuar$/).count() > 0) {
                await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)), { module: 'game-shell.js' });
                continue;
            }
            return { reached: false, gaveUp: 'no queda ningún hito abierto que seguir', view: v };
        }
        const moved = await bot.pursue(v, target, target.board ? goals.get(target.board) ?? null : null);
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
 * En el gremio recién hecho, como quien ya sabe jugar: la pelea del muelle (sola al entrar:
 * «otra salida», colocar y «Empezar») y luego «Saltar la prueba». Devuelve si el prólogo quedó
 * hecho (`la-prueba`).
 *
 * @param {ReturnType<typeof createBot>} bot
 * @param {{guildPack: any, tries?: number}} input El paquete del gremio (lo que pide su muelle).
 * @returns {Promise<boolean>}
 */
export async function skipTrial(bot, { guildPack, tries = 120 }) {
    const goals = boardGoalsFromPack(guildPack);
    let v = await bot.observe();
    for (let i = 0; i < tries && !v.done.includes('la-prueba'); i++) {
        v = await bot.observe();
        if (await bot.handleLayer(v)) continue;
        if (v.fight) {
            await bot.fightTurn(v, goals.get(v.board) ?? null);
            continue;
        }
        if (v.board && v.start.length > 0) {
            await bot.confirmStart(v);
            continue;
        }
        if (await bot.tapChip(v, /^Saltar la prueba$/, 'saltar la prueba', 'hub.js')) continue;
        // D-J62: con el modo guiado, «Saltar la prueba» está en la Casa del Gremio, fuera del tablero.
        if (v.board && !v.fight && await bot.tapChip(v, /^Salir del tablero$/, 'salir del tablero', 'action-chips.js')) continue;
        if (await bot.hallAct(v, 'hub-skip', 'saltar la prueba (en la Casa del Gremio)')) continue;
        if (await bot.tapChip(v, /^Iniciar combate/, 'iniciar el combate', 'action-chips.js')) continue;
        if (v.scene === 'dialogue' && v.vn.next) await bot.act(v, '«Continuar»', () => bot.press(bot.chip(/^Continuar$/)));
        else await bot.page.waitForTimeout(300);
    }
    return v.done.includes('la-prueba');
}

/**
 * Lo que la vuelta deja guardado para jugar sin animaciones: «Animaciones: ninguna» en las
 * opciones del juego (`MOTION_KEY` de game-engine/ui/motion.js).
 */
export const QUIET_MOTION = Object.freeze({ key: 'sillytavern_gameMotion', value: 'ninguna' });

/**
 * El ritmo del combate (`PACE_KEY` de game-engine/ui/combat-vtt/fx.js): `instant`, cada paso de la
 * secuencia del golpe (el ataque, el d20, el daño, la vida) deja su resultado al momento y en orden.
 */
export const COMBAT_PACE = Object.freeze({ key: 'sillytavern_gameCombatPace', value: 'instant' });

/**
 * Las vueltas miden el camino, no las animaciones. El ataque se juega en orden (el golpe, el
 * dado que rueda, el daño): con «Animaciones: ninguna», «reducir movimiento» y el combate al
 * momento sale todo de una vez y en el mismo orden. Con VUELTA_ANIMACIONES=1 se dejan como las ve
 * quien juega (el combate a su ritmo de verdad; más lento, para mirar cómo se ven).
 *
 * @param {any} context El contexto del navegador, antes de abrir la portada.
 * @param {any} page
 * @returns {Promise<boolean>} Si se han quitado.
 */
export async function quietMotion(context, page) {
    const keep = Boolean(process.env.VUELTA_ANIMACIONES);
    const saved = keep ? [{ key: COMBAT_PACE.key, value: 'normal' }] : [{ ...QUIET_MOTION }, { ...COMBAT_PACE }];
    await context.addInitScript((/** @type {Array<{key: string, value: string}>} */ pairs) => {
        try {
            for (const pair of pairs) window.localStorage.setItem(pair.key, pair.value);
        } catch { /* sin almacenamiento, queda «reducir movimiento» */ }
    }, saved);
    if (keep) return false;
    await page.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});
    return true;
}

/**
 * Un servidor propio para la vuelta, con sus datos en `dataRoot` (una carpeta temporal): no toca
 * tu partida. Con muchas pruebas a la vez (e2e-todo.mjs) tarda en arrancar: hasta seis minutos.
 *
 * @param {{root: string, port: number, dataRoot: string}} input
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
export function startServer({ root, port, dataRoot }) {
    const child = spawn(process.execPath, ['server.js', '--browserLaunchEnabled', 'false', '--port', String(port), '--dataRoot', dataRoot], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('the server did not start in 360s')), 360000);
        const watch = (/** @type {any} */ buffer) => {
            const text = String(buffer);
            if (text.includes(String(port)) || text.toLowerCase().includes('listening')) {
                clearTimeout(timer);
                setTimeout(() => resolve(child), 1500);
            }
        };
        child.stdout?.on('data', watch);
        child.stderr?.on('data', watch);
        child.on('exit', (/** @type {number} */ code) => reject(new Error(`the server exited with code ${code}`)));
    });
}

/**
 * Lo que ha apuntado la vuelta, por partes: silencios, atascos, lo que se ve mal, las caídas del
 * grupo y los clics lentos. Lo mismo en todas las vueltas, para leerlas igual.
 *
 * @param {ReturnType<typeof createBot>} bot
 * @param {(line: string) => void} [log]
 */
export function printFindings(bot, log = console.log) {
    log('\n--- los silencios ---');
    for (const s of bot.silences) log(`  #${s.n} ${s.where} · ${s.what}\n      se ve: ${s.sees.slice(0, 260)}${s.module ? `\n      módulo: ${s.module}` : ''}`);
    if (bot.silences.length === 0) log('  (ninguno)');
    log('\n--- los atascos ---');
    for (const b of bot.blocks) log(`  #${b.n} ${b.where} · ${b.goal}\n      se ve: ${b.sees.slice(0, 300)}\n      rescate: ${b.rescue}`);
    if (bot.blocks.length === 0) log('  (ninguno)');
    log('\n--- lo que se ve mal (sin ser silencio ni atasco) ---');
    for (const o of bot.oddities) log(`  #${o.n} ${o.where} · ${o.kind}: ${o.text.slice(0, 300)}`);
    if (bot.oddities.length === 0) log('  (nada)');
    log('\n--- el grupo ha caído (la tarjeta «ha muerto») ---');
    for (const f of bot.falls) log(`  #${f.n} ${f.where} · ${f.text}\n      salidas: ${f.ways.join(' | ') || '(ninguna)'}`);
    if (bot.falls.length === 0) log('  (nunca)');
    log('\n--- los clics lentos (la página tarda más de 1,5 s en atenderlos) ---');
    for (const s of bot.slow) log(`  ${s.ms} ms · ${s.what} · ${s.where}`);
    if (bot.slow.length === 0) log('  (ninguno)');
    log('\n--- lo que se eligió ---');
    for (const c of bot.choices) log(`  ${c.scene}: ${c.option}`);
    if (bot.choices.length === 0) log('  (nada)');
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
 * @returns {Map<string, {type: string, cell?: {x: number, y: number}, loot?: boolean}>}
 */
export function boardGoalsFromPack(pack) {
    const quests = new Map((pack.quests ?? []).map((/** @type {any} */ q) => [String(q.id), q]));
    const goals = new Map();
    for (const board of pack.boards ?? []) {
        // Strahd nombra el tablero de cada misión por su id (`boardId`).
        const quest = quests.get(`q-${board.id}`) ?? (pack.quests ?? []).find((/** @type {any} */ q) => q.board === board.name || q.boardName === board.name || (q.boardId && String(q.boardId) === String(board.id)));
        const first = (quest?.objectives ?? []).find((/** @type {any} */ o) => o.type === 'reach_cell') ?? quest?.objectives?.[0];
        // «Encontrar la reliquia»: está en un cofre del tablero (se abre estando al lado).
        const loot = (quest?.objectives ?? []).some((/** @type {any} */ o) => o.type === 'loot');
        if (first) goals.set(String(board.name), { type: String(first.type), ...(first.cell ? { cell: { x: Number(first.cell.x), y: Number(first.cell.y) } } : {}), ...(loot ? { loot: true } : {}) });
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
    // Con quien se habla puede ser un PNJ o un confidente (las campañas del Gem traen los dos).
    const npcAt = new Map([...(pack.confidants || []), ...(pack.npcs || [])].map((/** @type {any} */ n) => [String(n.name), String(n.where || '')]));
    const enemyBoard = new Map();
    for (const b of pack.boards || []) for (const e of b.enemies || []) if (!enemyBoard.has(String(e.name))) enemyBoard.set(String(e.name), String(b.name));
    // «Derrotar a Lobo» lo cumple «Lobo 2» (el hilo mira el principio del nombre).
    const boardOfEnemy = (/** @type {string} */ enemy) => enemyBoard.get(enemy)
        ?? [...enemyBoard.entries()].find(([name]) => plain(name).startsWith(plain(enemy)))?.[1] ?? '';
    const byId = new Map((pack.plot?.milestones || []).map((/** @type {any} */ m) => [String(m.id), m]));
    /**
     * @param {string} id
     * @param {any} asks
     * @returns {Target}
     */
    const read = (id, asks) => {
        // Idea 101: un hito que se cumple de varias formas: la vuelta sigue la primera que sabe
        // hacer a clics (un encargo del tablón, no).
        if (asks.kind === 'any') {
            const options = (Array.isArray(asks.options) ? asks.options : []).filter((/** @type {any} */ o) => o && o.kind !== 'any');
            const first = options.find((/** @type {any} */ o) => o.kind !== 'contract') ?? options[0];
            return first ? read(id, first) : { id, kind: 'none' };
        }
        if (asks.kind === 'win') return { id, kind: 'win', board: String(asks.board), place: boardAt.get(String(asks.board)) || String(asks.place || '') };
        if (asks.kind === 'defeat') {
            const board = boardOfEnemy(String(asks.enemy));
            return { id, kind: 'defeat', enemy: String(asks.enemy), board, place: boardAt.get(board) || String(asks.place || '') };
        }
        if (asks.kind === 'talk') return { id, kind: 'talk', npc: String(asks.npc), place: npcAt.get(String(asks.npc)) || String(asks.place || '') };
        if (asks.kind === 'arrive') return { id, kind: 'arrive', place: String(asks.place) };
        if (asks.kind === 'check') return { id, kind: 'check', skill: String(asks.skill), ...(asks.place ? { place: String(asks.place) } : {}) };
        if (asks.kind === 'clues') return { id, kind: 'clues', place: String(asks.clues?.[0]?.place || ''), skill: String(asks.clues?.[0]?.skill || '') };
        return { id, kind: String(asks.kind || 'none') };
    };
    return (id) => read(id, byId.get(id)?.asks || { kind: 'none' });
}
