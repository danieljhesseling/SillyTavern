/**
 * E5 de wiki/ROADMAP_ENTRETENIDO.md, el gremio que paga: el pegamento de `guild-perks.js` con la
 * partida.
 *
 * - **La casa** (`openGuildHouse`, hub.js) enseña, además de los edificios, lo que la forja y la
 *   cocina preparan para la próxima salida y los libros de bichos de la biblioteca.
 * - **Quién está para salir** (la ficha `hub-rest` de la sala): cada uno dice cómo está —herido,
 *   cansado del camino, fuera de encargo— y desde ahí se deja en casa, se llama o se manda a un
 *   encargo del tablón (`openDispatch`, contracts.js).
 * - **Al volver al gremio** (`guildHomecoming`, desde campaigns.js): lo preparado se acaba, los
 *   que fueron suman una salida y quien encadena vuelve cansado; quien se quedó, la borra.
 * - **Los informes**: quien vuelve de un encargo lo cuenta en una escena corta (`reportScene`),
 *   en cuanto no hay otra cosa en pantalla.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldEnemies, loadWorldInfo, METADATA_KEY } from '../world-info.js';
import {
    prepOffers, prepareFor, describePrep, readBooks, writeBook, bookOffers, bookFactsFor, GUILD_BOOKS_KEY,
    homecomingFatigue, outingsOf, HOME_REST_DAYS, restRoster, restDetail, reportScene, forgeMixOffers,
} from '../game-engine/campaign/guild-perks.js';
import { cloakItem, upgradedWeapon } from '../game-engine/campaign/trophies.js';
import { weaponOf } from '../game-engine/rules/equipment.js';
import { addItemToInventory, removeItemFromInventory, createItem } from '../dnd-system.js';
import { payPlan, spendFromChest } from '../game-engine/campaign/guild-chest.js';
import { readBench, benchMember, callFromBench } from '../game-engine/campaign/bench.js';
import { canDispatch, dispatchOdds, dispatchDays } from '../game-engine/campaign/dispatch.js';
import { setInjury } from '../game-engine/rules/injuries.js';
import { faceElement, faceOf } from '../game-engine/ui/hero-face.js';
import { isChatSwitching, onChatSwitchEnd } from '../game-engine/ui/shell/chat-switch.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { BENCH_KEY, BOARD_KEY, DISPATCHES_KEY, GUILD_KEY } from './keys.js';
import { combatEncounter, currentLocationName, partyMembers, setPartyMembers } from './state.js';
import { lastHub, lastPack } from './world.js';
import { getGuild, openDispatch } from './contracts.js';
import { savePartyState, renderPartyMembers, partyPurse, payFromParty } from './roster.js';
import { postCombatNarration, narratorMode } from './narration.js';
import { getPlot, revealLocations } from './plot.js';

/** En los metadatos del chat: los informes de los que volvieron, por contar. */
export const DISPATCH_REPORTS_KEY = 'dispatchReports';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

// ---- La casa: la forja, la cocina y la biblioteca para la próxima salida -----------------

/**
 * Cobrar lo de la casa: primero del arca y lo que falte, de las bolsas.
 *
 * @param {number} cost
 * @param {string} title
 * @returns {boolean}
 */
function payHouse(cost, title) {
    const guild = getGuild();
    const plan = payPlan({ cost, guild, purse: partyPurse() });
    if (!plan.ok || (plan.fromPurse > 0 && !payFromParty(plan.fromPurse))) {
        toastr.warning(plan.line || 'No llega el oro para eso.', title);
        return false;
    }
    chat_metadata[GUILD_KEY] = spendFromChest(guild, plan.fromChest);
    saveMetadata();
    return true;
}

/**
 * Una fila de la casa: lo que se lee, su botón y, si no se puede, por qué.
 *
 * @param {string} label
 * @param {string} button
 * @param {{ok: boolean, why: string}} state
 * @param {() => void} onClick
 * @returns {JQuery<HTMLElement>}
 */
function houseRow(label, button, state, onClick) {
    const row = $('<div class="hb-chest-row hb-prep-row"></div>');
    row.append($('<span class="hb-prep-what"></span>').text(label));
    row.append($('<button type="button" class="menu_button hb-prep-go"></button>').text(button)
        .prop('disabled', !state.ok || combatEncounter.active)
        .attr('title', state.why || 'Se paga del arca y, lo que falte, de las bolsas.')
        .on('click', onClick));
    if (!state.ok && state.why) row.append($('<small class="hb-warn"></small>').text(state.why));
    return row;
}

/**
 * E5.1: lo que la forja templa y la cocina prepara para la próxima salida, dentro de la casa.
 *
 * @param {JQuery<HTMLElement>} inside
 * @param {() => void} redraw
 */
export function drawGuildPrep(inside, redraw) {
    const offers = prepOffers({ guild: getGuild(), party: partyMembers, purse: partyPurse() });
    if (offers.forge === 0 && offers.kitchen === 0) return;
    const box = $('<div class="hb-prep"></div>');
    box.append($('<div class="vt-section hb-section"></div>').text('Para la próxima salida'));
    box.append($('<p class="hb-state"></p>').text('Dura hasta volver al gremio: la armadura templada suma en la pelea; el caldo y el guiso, cuando hacen falta.'));
    const prepared = partyMembers.filter(m => !m.dead).flatMap(m => describePrep(m).map(line => `${m.name}: ${line}`));
    for (const line of prepared) box.append($('<p class="hb-opened"></p>').text(line));
    const apply = (/** @type {any} */ offer, /** @type {string} */ title) => () => {
        const member = partyMembers.find(m => String(m.id) === offer.memberId);
        const done = member ? prepareFor({ member, kind: offer.kind, guild: getGuild(), purse: partyPurse() }) : null;
        if (!member || !done?.ok || !payHouse(done.cost, title)) {
            if (done && !done.ok) toastr.warning(done.reason, title);
            redraw();
            return;
        }
        member.guildPrep = done.guildPrep;
        savePartyState();
        renderPartyMembers();
        postCombatNarration(`${offer.kind === 'temple' ? '🔨' : '🍲'} [GREMIO] ${done.line}`);
        toastr.success(done.line, title);
        redraw();
    };
    for (const offer of offers.temper) {
        box.append(houseRow(`${offer.memberName}: ${offer.label}`, `Templar (${offer.cost} de oro)`, offer, apply(offer, 'La forja')));
    }
    for (const offer of offers.rations) {
        box.append(houseRow(`${offer.memberName}: ${offer.label}`, `Pedirlo (${offer.cost} de oro)`, offer, apply(offer, 'La cocina')));
    }
    drawForgeMix(box, redraw);
    inside.append(box);
}

/**
 * E5.1: mezclar materiales en la forja del gremio (lo cazado: una capa de pieles o un arma a +1).
 *
 * @param {JQuery<HTMLElement>} box
 * @param {() => void} redraw
 */
function drawForgeMix(box, redraw) {
    const mix = forgeMixOffers({ guild: getGuild(), party: partyMembers, purse: partyPurse() });
    if (mix.forge === 0) return;
    box.append($('<div class="vt-section hb-section"></div>').text('Mezclar materiales en la forja'));
    if (mix.empty) {
        box.append($('<p class="hb-empty"></p>').text(mix.empty));
        return;
    }
    for (const offer of mix.offers) {
        box.append(houseRow(offer.label, offer.button, offer, () => {
            // Se vuelve a mirar al pulsar: entre dibujar y pulsar puede haber cambiado algo.
            const now = forgeMixOffers({ guild: getGuild(), party: partyMembers, purse: partyPurse() }).offers
                .find(o => o.recipe === offer.recipe && o.memberId === offer.memberId);
            const member = partyMembers.find(m => String(m.id) === offer.memberId);
            if (!now?.ok || !member) {
                toastr.warning(now?.why || 'Ya no se puede.', 'La forja');
                redraw();
                return;
            }
            if (!payHouse(now.cost, 'La forja')) {
                redraw();
                return;
            }
            for (const used of now.use) {
                const owner = partyMembers.find(m => String(m.id) === used.memberId);
                if (owner) removeItemFromInventory(/** @type {any} */ (owner), used.itemId);
            }
            const spent = now.use.map(u => u.name).join(', ');
            let line = '';
            if (now.recipe === 'capa') {
                addItemToInventory(/** @type {any} */ (member), createItem(/** @type {any} */ (cloakItem())));
                line = `En la forja del gremio cosen una capa de pieles para ${member.name} (${now.cost} de oro, ${spent}).`;
            } else {
                const weapon = weaponOf(member);
                if (weapon) Object.assign(weapon, upgradedWeapon(weapon));
                line = `En la forja del gremio mejoran el arma de ${member.name}: ahora es ${weapon?.name ?? 'su arma'} (${now.cost} de oro, ${spent}).`;
            }
            savePartyState();
            renderPartyMembers();
            postCombatNarration(`⚒️ [GREMIO] ${line}`);
            toastr.success(line, 'La forja');
            redraw();
        }));
    }
}

/** Las campañas del tablón con su bestiario, leídas una vez. @type {Promise<any[]>|null} */
let boardBeasts = null;

/**
 * Las campañas del juego con los bichos de su paquete.
 *
 * @returns {Promise<Array<{id: string, name: string, bestiary: any[]}>>}
 */
function readBoardBeasts() {
    boardBeasts ??= fetch('/mundos/mundos.json', { cache: 'no-cache' })
        .then(response => response.json())
        .then(async json => {
            const worlds = (Array.isArray(json?.worlds) ? json.worlds : []).filter((/** @type {any} */ w) => w?.id && w?.pack);
            return await Promise.all(worlds.map(async (/** @type {any} */ world) => {
                const pack = await fetch(String(world.pack), { cache: 'no-cache' }).then(r => r.json()).catch(() => null);
                return { id: String(world.id), name: String(world.name || world.id), bestiary: Array.isArray(pack?.bestiary) ? pack.bestiary : [] };
            }));
        })
        .catch(error => {
            boardBeasts = null;
            console.warn('[gremio] no se leyeron los bichos del tablón', error);
            return [];
        });
    return boardBeasts;
}

/**
 * E5.1: los libros de bichos de la biblioteca, dentro de la casa. Se leen las campañas del
 * tablón y se dibujan al llegar.
 *
 * @param {JQuery<HTMLElement>} inside
 * @param {() => void} redraw
 */
export function drawGuildBooks(inside, redraw) {
    const box = $('<div class="hb-books"></div>');
    inside.append(box);
    void readBoardBeasts().then(worlds => {
        const view = bookOffers({ guild: getGuild(), worlds, books: chat_metadata?.[GUILD_BOOKS_KEY], purse: partyPurse() });
        if (view.level === 0) return;
        box.append($('<div class="vt-section hb-section"></div>').text('Libros de bichos'));
        box.append($('<p class="hb-state"></p>').text('Antes de salir, lo que aguanta cada bicho de una campaña, lo que le duele y cómo pelea. En la pelea, se lee en su tarjeta.'));
        if (view.empty) box.append($('<p class="hb-empty"></p>').text(view.empty));
        for (const offer of view.offers) {
            const label = `${offer.title}: ${offer.count === 1 ? '1 bicho' : `${offer.count} bichos`}`;
            box.append(houseRow(label, offer.owned ? 'En la biblioteca' : `Comprarlo (${offer.cost} de oro)`, offer, () => {
                const world = worlds.find(w => w.id === offer.id);
                if (!world || !payHouse(offer.cost, 'La biblioteca')) {
                    redraw();
                    return;
                }
                const book = writeBook(world);
                chat_metadata[GUILD_BOOKS_KEY] = [...readBooks(chat_metadata[GUILD_BOOKS_KEY]), book];
                saveMetadata();
                savePartyState();
                renderPartyMembers();
                const line = `En la biblioteca del gremio ya está el libro «${book.title}»: ${book.creatures.length} bichos, con lo que aguantan y lo que les duele.`;
                postCombatNarration(`📚 [GREMIO] ${line}`);
                toastr.success(line, 'La biblioteca');
                redraw();
            }));
        }
    });
}

/**
 * E5.1: lo que dicen los libros de la biblioteca de un enemigo, para su tarjeta en la pelea.
 *
 * @param {any} enemy
 * @returns {string}
 */
export function bookLineFor(enemy) {
    const books = chat_metadata?.[GUILD_BOOKS_KEY];
    if (!Array.isArray(books) || books.length === 0) return '';
    const template = getCurrentWorldEnemies().find((/** @type {any} */ t) => String(t?.id) === String(enemy?.templateId));
    const found = bookFactsFor(books, String(template?.name ?? '')) ?? bookFactsFor(books, String(enemy?.name ?? ''));
    return found ? `📚 Del libro del gremio: ${found.facts.join(' ')}` : '';
}

// ---- El banquillo: quién está para salir --------------------------------------------------

/** Los que acaban de volver de un encargo: su salida ya se ha contado. @type {Set<string>} */
const justBack = new Set();

/**
 * E5.2: la vuelta al gremio de una campaña. Lo preparado en casa se acaba; los que fueron
 * suman una salida, y quien encadena vuelve cansado del camino; quien esperaba en casa, la borra.
 *
 * @param {{days: number}} input Lo que ha durado la salida, con el viaje.
 * @returns {string[]} Quién vuelve cansado.
 */
export function guildHomecoming({ days }) {
    if (!chat_metadata) return [];
    const bench = readBench(chat_metadata[BENCH_KEY]);
    const went = partyMembers.filter(m => !m.dead && !justBack.has(String(m.id)));
    const plan = homecomingFatigue({ went, stayed: bench, days });
    /** @type {string[]} */
    const tired = [];
    for (const member of partyMembers) delete member.guildPrep;
    for (const step of plan.went) {
        const member = partyMembers.find(m => String(m.id) === step.id);
        if (!member) continue;
        member.outings = step.outings;
        member.homeDays = 0;
        if (!step.injury) continue;
        const patch = setInjury(member, step.injury, 'cansancio');
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
        tired.push(`${member.name} vuelve ${String(step.injury.label).toLowerCase()}`);
    }
    for (const member of bench) {
        if (plan.stayed.includes(String(member.id))) member.outings = 0;
        delete member.guildPrep;
    }
    justBack.clear();
    chat_metadata[BENCH_KEY] = bench;
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    if (tired.length > 0) {
        const line = `${tired.join('; ')}. Unos días en casa ${tired.length > 1 ? 'les' : 'le'} sientan bien; o que salgan otros.`;
        postCombatNarration(`🏠 [GREMIO] ${line}`);
        toastr.info(line, 'El banquillo', { timeOut: 10000 });
    }
    return tired;
}

/**
 * E5.2: días seguidos en casa: a la semana, se olvidan las salidas encadenadas.
 *
 * @param {number} days
 */
export function restAtHome(days) {
    if (!lastHub) return;
    const passed = Math.max(0, Math.floor(Number(days) || 0));
    if (passed === 0) return;
    let changed = false;
    for (const member of partyMembers) {
        if (member.dead || outingsOf(member) === 0) continue;
        member.homeDays = (Number(member.homeDays) || 0) + passed;
        if (member.homeDays >= HOME_REST_DAYS) {
            member.outings = 0;
            member.homeDays = 0;
        }
        changed = true;
    }
    if (changed) savePartyState();
}

/**
 * E5.3: apuntar que alguien ha vuelto de un encargo (su salida ya cuenta).
 *
 * @param {any} member
 */
export function noteBackFromErrand(member) {
    member.outings = outingsOf(member) + 1;
    member.homeDays = 0;
    justBack.add(String(member.id));
}

/**
 * La línea de la sala para «Quién está para salir».
 *
 * @returns {string}
 */
export function restHallLine() {
    try {
        const rows = restRoster({
            party: partyMembers,
            bench: readBench(chat_metadata?.[BENCH_KEY]),
            away: Array.isArray(chat_metadata?.[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : [],
            guild: getGuild(),
        });
        const reports = Array.isArray(chat_metadata?.[DISPATCH_REPORTS_KEY]) ? chat_metadata[DISPATCH_REPORTS_KEY].length : 0;
        return restDetail(rows, reports);
    } catch (error) {
        console.warn('[gremio] quién está para salir', error);
        return '';
    }
}

/**
 * Mover a alguien entre el grupo y casa, desde la ventana.
 *
 * @param {'bench'|'call'} what
 * @param {string} id
 */
function moveMember(what, id) {
    const result = what === 'bench'
        ? benchMember({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id })
        : callFromBench({ party: partyMembers, bench: chat_metadata[BENCH_KEY], id, atHome: true });
    if (!result.ok) {
        toastr.warning(result.line);
        return;
    }
    setPartyMembers(result.party);
    chat_metadata[BENCH_KEY] = result.bench;
    savePartyState();
    saveMetadata();
    renderPartyMembers();
    postCombatNarration(`🏠 [GREMIO] ${result.line}`);
}

/**
 * E5.2 y E5.3: quién está para salir. Cada uno dice cómo está; desde aquí se deja en casa, se
 * llama, o se manda a quien está en casa a un encargo del tablón.
 *
 * @returns {Promise<string>}
 */
export async function openRestRoster() {
    if (!lastHub) {
        toastr.info('Eso se mira en la sala del gremio.', 'Quién está para salir');
        return '';
    }
    // Los informes que esperan, primero: han vuelto y te lo quieren contar.
    await showDispatchReports();
    const body = $('<div class="vt-root hb-root hb-rest"></div>');
    /** @type {Popup|null} */
    let popup = null;
    const draw = () => {
        body.find('.hb-rest-inside').remove();
        const inside = $('<div class="hb-rest-inside"></div>');
        const guild = getGuild();
        const infirmary = Number(guild.buildings?.infirmary) || 0;
        inside.append($('<div class="vt-head"></div>')
            .append($('<h3 class="vt-title"></h3>').text('Quién está para salir'))
            .append($('<p class="vt-sub"></p>').text(infirmary > 0
                ? `Quien se queda en casa descansa en la enfermería (nivel ${infirmary}): cura ${infirmary === 1 ? 'el doble de deprisa' : `${infirmary + 1} veces más deprisa`}.`
                : 'Quien se queda en casa descansa y cura con los días. Con enfermería, antes.')));
        const bench = readBench(chat_metadata?.[BENCH_KEY]);
        const rows = restRoster({
            party: partyMembers, bench, guild,
            away: Array.isArray(chat_metadata?.[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : [],
        });
        const board = (Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).filter((/** @type {any} */ c) => canDispatch(c).ok);
        const grid = $('<div class="vt-grid hb-grid hb-rest-grid"></div>');
        const where = { grupo: 'Va con el grupo', casa: 'En casa', fuera: 'Fuera' };
        for (const row of rows) {
            const member = [...partyMembers, ...bench].find(m => String(m.id) === row.id)
                ?? { id: row.id, name: row.name };
            const card = $('<div class="vt-card hb-card hb-rest-card"></div>').attr('data-where', row.where).attr('data-mood', row.mood);
            const head = $('<div class="hb-rest-head"></div>');
            head.append($(faceElement({
                name: String(member.name ?? row.name), avatar: String(member.avatar ?? ''), className: String(member.class ?? ''),
                gender: String(member.gender ?? ''), race: String(member.race ?? ''), mercenary: member.guest?.kind === 'mercenary',
                face: member.face ?? null,
            }, { imageClass: 'hb-rest-face', badgeClass: 'hb-rest-face hb-rest-initials' })));
            head.append($('<div></div>')
                .append($('<div class="vt-name"></div>').text(row.name))
                .append($('<div class="hb-state"></div>').text(`${where[row.where]} · ${row.state}`)));
            card.append(head);
            // Lo dice esa persona, no nadie (D-J60).
            if (row.says) card.append($('<p class="hb-rest-says"></p>').text(`«${row.says}»`));
            const actions = $('<div class="hb-rest-actions"></div>');
            if (row.where === 'grupo' && !row.hero) {
                actions.append($('<button type="button" class="menu_button"></button>').text('Que se quede en casa')
                    .prop('disabled', combatEncounter.active)
                    .on('click', () => { moveMember('bench', row.id); draw(); }));
            }
            if (row.where === 'casa') {
                actions.append($('<button type="button" class="menu_button"></button>').text('Que venga con el grupo')
                    .prop('disabled', combatEncounter.active)
                    .on('click', () => { moveMember('call', row.id); draw(); }));
                for (const contract of board.slice(0, 3)) {
                    const odds = dispatchOdds({ members: [member], contract });
                    actions.append($('<button type="button" class="menu_button hb-rest-send"></button>')
                        .text(`Mandarle a «${contract.title}»`)
                        .attr('title', `${Math.round(odds.chance * 100)} % de que salga bien · ${dispatchDays(contract)} días fuera`)
                        .prop('disabled', combatEncounter.active)
                        .on('click', async () => {
                            if (await openDispatch(contract, { bench: true, pick: row.id })) draw();
                        }));
                }
            }
            if (actions.children().length > 0) card.append(actions);
            grid.append(card);
        }
        inside.append(grid);
        if (board.length === 0 && bench.length > 0) {
            inside.append($('<p class="hb-empty"></p>').text('En el tablón no hay ahora encargos menores a los que mandar a nadie.'));
        }
        body.prepend(inside);
        if (isShellOpen()) refreshGameShell();
    };
    draw();
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide: true, allowVerticalScrolling: true });
    body.append($('<div class="hb-foot"></div>').append($('<button type="button" class="menu_button hb-close"></button>')
        .text('Cerrar').on('click', () => { void popup?.completeCancelled(); })));
    await popup.show();
    if (isShellOpen()) refreshGameShell();
    return '';
}

// ---- Los informes de los que vuelven ------------------------------------------------------

/**
 * E5.3: apuntar un informe para contarlo en cuanto se pueda.
 *
 * @param {import('../game-engine/campaign/guild-perks.js').DispatchReport} report
 */
export function queueDispatchReport(report) {
    if (!chat_metadata) return;
    const queued = Array.isArray(chat_metadata[DISPATCH_REPORTS_KEY]) ? chat_metadata[DISPATCH_REPORTS_KEY] : [];
    chat_metadata[DISPATCH_REPORTS_KEY] = [...queued, report];
    saveMetadata();
    scheduleDispatchReports();
}

/** Si ya hay una vuelta esperando turno para contarse. */
let scheduled = false;

/**
 * Contar los informes cuando la pantalla esté libre: no en mitad de un cambio de chat ni de una
 * pelea.
 */
export function scheduleDispatchReports() {
    if (scheduled) return;
    scheduled = true;
    const go = () => {
        scheduled = false;
        if (combatEncounter.active) return;
        void showDispatchReports().catch(error => console.error('[gremio] informes', error));
    };
    if (isChatSwitching()) {
        const off = onChatSwitchEnd(() => {
            off();
            setTimeout(go, 400);
        });
        return;
    }
    setTimeout(go, 400);
}

/** Si se está contando uno: no se abren dos a la vez. */
let telling = false;

/**
 * E5.3: los que vuelven lo cuentan, uno detrás de otro (una escena corta cada vuelta).
 *
 * @returns {Promise<void>}
 */
export async function showDispatchReports() {
    if (telling || !chat_metadata) return;
    const queued = Array.isArray(chat_metadata[DISPATCH_REPORTS_KEY]) ? chat_metadata[DISPATCH_REPORTS_KEY] : [];
    if (queued.length === 0) return;
    // Sin el motor narrando (con el modelo), la línea del registro ya lo dijo.
    if (narratorMode() !== 'motor') {
        delete chat_metadata[DISPATCH_REPORTS_KEY];
        saveMetadata();
        return;
    }
    telling = true;
    const owner = chat_metadata;
    try {
        const { openPlotScene } = await import('../game-engine/ui/plot-scene.js');
        while (chat_metadata === owner && Array.isArray(chat_metadata[DISPATCH_REPORTS_KEY]) && chat_metadata[DISPATCH_REPORTS_KEY].length > 0) {
            const [report, ...rest] = chat_metadata[DISPATCH_REPORTS_KEY];
            chat_metadata[DISPATCH_REPORTS_KEY] = rest;
            if (rest.length === 0) delete chat_metadata[DISPATCH_REPORTS_KEY];
            saveMetadata();
            const revealed = report?.map ? await revealOnTheWay() : '';
            // Sus caras: las de la tira del grupo (su retrato de relleno, si no tienen uno con nombre).
            const people = [...partyMembers, ...readBench(chat_metadata[BENCH_KEY])];
            /** @type {Record<string, string>} */
            const faces = {};
            for (const one of Array.isArray(report?.members) ? report.members : []) {
                const member = people.find(m => String(m.id) === String(one.id)) ?? one;
                const face = faceOf({ name: String(member.name ?? ''), avatar: String(member.avatar ?? ''), className: String(member.class ?? ''), gender: String(member.gender ?? ''), race: String(member.race ?? '') });
                if (face.src) faces[String(member.name)] = face.src;
            }
            await openPlotScene({
                scene: reportScene(report, { revealed }), hero: partyMembers[0] ?? null, pack: lastPack, faces,
                // En el gremio, en su sala; en una campaña, donde estéis.
                place: lastHub ? 'gremio' : '', town: currentLocationName,
            })
                .catch(error => console.error('[gremio] no se pudo contar el informe', error));
        }
    } finally {
        telling = false;
        if (isShellOpen()) refreshGameShell();
    }
}

/**
 * E5.3: el sitio del mapa con el que dieron por el camino: uno escondido que la historia no
 * guarda para sí (si sale en el hilo, no se enseña antes de tiempo).
 *
 * @returns {Promise<string>}
 */
async function revealOnTheWay() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName).catch(() => null) : null;
    const hidden = Array.isArray(data?.metadata?.hiddenLocations) ? data.metadata.hiddenLocations : [];
    const plot = JSON.stringify(getPlot() ?? {}).toLowerCase();
    const free = hidden.map((/** @type {any} */ l) => text(l?.name)).filter(name => name && !plot.includes(name.toLowerCase()));
    if (free.length === 0) return '';
    await revealLocations([free[0]]);
    return free[0];
}
