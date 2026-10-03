/**
 * J12.21 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md): la pantalla
 * de victoria o de derrota, con lo de la partida.
 *
 * `combat-flow.js` (`endCombat`) llama aquí dos veces: antes de repartir el botín
 * (`noteBeforeLoot`, para saber luego qué PX y qué objetos son de esta pelea) y al acabar
 * (`planOutcome`). La pantalla no sale entonces: sale cuando se ha visto todo el último golpe
 * (la secuencia del combate, `afterFx`). Mientras, una tarjeta escondida (`.vs-card`) hace
 * esperar a lo que espera a la de antes: las escenas del hilo y las misiones personales no salen
 * encima del último golpe.
 *
 * Lo que dice lo decide `game-engine/combat/outcome.js`; lo pinta
 * `game-engine/ui/combat-vtt/outcome-screen.js`. Aquí se junta lo de la partida (las caras, la
 * vida, los PX, el botín, a dónde se sigue, lo que queda en el tablero, quién os recoge) y se
 * hace lo que pide cada botón:
 *
 * - victoria: «Seguir…» hace lo de «Continuar» de la novela (D-J45); «Registrar la sala» lleva
 *   al tablero; «Descanso corto»; «Subir a nivel N» abre la subida de nivel.
 * - derrota: «Despertar en …» paga el rescate, pasa el día en cama y os saca del tablero con la
 *   mitad de la vida; «Volver al punto guardado», «Cargar partida» y «Volver al gremio» (sin
 *   nadie con vida), como la tarjeta de siempre de J9.1.
 */

import { chat_metadata } from '../../script.js';
import { tokenArt } from '../world-map-renderer.js';
import { firstArt, isPlainFace } from '../game-engine/ui/pixel-art.js';
import { outcomeView, rescueFor, RESCUE_DAYS } from '../game-engine/combat/outcome.js';
import { closeOutcomeScreen, showOutcomeScreen } from '../game-engine/ui/combat-vtt/outcome-screen.js';
import { readInjuries } from '../game-engine/rules/injuries.js';
import { clearDeathSaves } from '../game-engine/rules/death-saves.js';
import { hasLetter } from '../game-engine/rules/modes.js';
import { boardLeftovers } from '../game-engine/board/leftovers.js';
import { TROPHIES } from '../game-engine/campaign/trophies.js';
import { readTally } from '../game-engine/combat/tally.js';
import { fogOnFor } from '../game-engine/board/board-camera.js';
import { checkpointToReturn, partyHasFallen } from '../game-engine/combat/party-fallen.js';
import { normalizeCheckpoints, CHECKPOINT_KEY } from '../game-engine/campaign/checkpoint.js';
import { isShellOpen, refreshGameShell, setScene } from '../game-engine/ui/shell/game-shell.js';
import { partyMembers, currentBoardName, currentLocationName, setCurrentBoardName } from './state.js';
import { afterFx } from './combat-fx.js';
import { afterFightNow } from './combat-flow.js';
import { lastHub, lastHubHome, saveCurrentBoard } from './world.js';
import { advanceCampaignDay, getCampaignCalendar, getCurrentSlotLabel, takeRest } from './time.js';
import { canLevelUp, openLevelUpCard } from './level-up.js';
import { getActiveBoardContext, isBoardWon } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { restoreCheckpoint } from './checkpoints.js';
import { survivalNow } from './modes.js';
import { postCombatNarration } from './narration.js';

/**
 * @typedef {Object} LootSnapshot Lo de cada uno antes de repartir el botín.
 * @property {Map<string, {xp: number, gold: number, items: Set<string>}>} members
 */

/**
 * @typedef {Object} OutcomePlan Lo que se sabe al acabar la pelea (luego el combate se vacía).
 * @property {'victory'|'defeat'} kind
 * @property {string} place
 * @property {number} round
 * @property {string[]} downed Los del grupo que cayeron a 0 PG en esta pelea.
 * @property {import('../game-engine/combat/tally.js').Tally} tally Idea 191: quién hizo qué.
 * @property {LootSnapshot|null} snapshot
 * @property {string} [failed] Derrota con el grupo en pie: lo que dice la misión.
 * @property {string[]} upgrades Idea 63: lo del botín que mejora lo que lleva alguien.
 * @property {any} owner La partida (`chat_metadata`): si se cambia, la pantalla no sale.
 */

/** Lo de antes del botín de la pelea que acaba ahora. @type {LootSnapshot|null} */
let pendingSnapshot = null;

/**
 * Antes de repartir el botín: lo que tiene cada uno, para saber luego lo que ha ganado aquí.
 */
export function noteBeforeLoot() {
    pendingSnapshot = {
        members: new Map(partyMembers.map(m => [String(m.id), {
            xp: Number(m.xp) || 0,
            gold: Number(m.gold) || 0,
            items: new Set((Array.isArray(m.items) ? m.items : []).map((/** @type {any} */ i) => String(i?.id ?? ''))),
        }])),
    };
}

/**
 * La tarjeta escondida que hace esperar (a las escenas, a las misiones personales) hasta que salga
 * la pantalla de verdad y se cierre.
 */
function holdPlace() {
    if (typeof document === 'undefined' || !document.body) return;
    document.querySelectorAll('.vs-card.vo-pending').forEach(card => card.remove());
    const card = document.createElement('div');
    card.className = 'vs-card vo-pending';
    card.hidden = true;
    card.setAttribute('aria-hidden', 'true');
    document.body.appendChild(card);
}

/** Quitar la tarjeta escondida (ya sale la de verdad, o no va a salir). */
function dropPlace() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.vs-card.vo-pending').forEach(card => card.remove());
}

/**
 * Al acabar la pelea (desde `endCombat`, antes de vaciar el combate): apuntar lo que hace falta
 * y sacar la pantalla cuando se haya visto el último golpe.
 *
 * @param {Object} input
 * @param {'victory'|'defeat'} input.kind
 * @param {number} input.round
 * @param {any} [input.tally] La cuenta del combate (quién cayó).
 * @param {string} [input.failed] Derrota con el grupo en pie: lo que dice la misión.
 * @param {string[]} [input.upgrades] Idea 63: lo del botín que mejora lo que lleva alguien.
 */
export function planOutcome({ kind, round, tally = null, failed = '', upgrades = [] }) {
    /** @type {OutcomePlan} */
    const plan = {
        kind,
        place: currentBoardName || currentLocationName,
        round: Math.max(1, Number(round) || 1),
        downed: readTally(tally).downed,
        tally: readTally(tally),
        snapshot: kind === 'victory' ? pendingSnapshot : null,
        failed: String(failed || ''),
        upgrades: Array.isArray(upgrades) ? upgrades.map(String) : [],
        owner: chat_metadata,
    };
    pendingSnapshot = null;
    holdPlace();
    // Cuando se haya visto todo (la secuencia del combate), y con `endCombat` ya acabado: lo que
    // toca después (D-J45) lo apunta al final.
    afterFx(() => setTimeout(() => {
        try {
            if (plan.owner !== chat_metadata) return;
            showPlan(plan);
        } catch (error) {
            console.error('[combat-outcome] la pantalla de victoria o derrota', error);
        } finally {
            dropPlace();
        }
    }, 0));
}

/**
 * La cara de alguien del grupo: su retrato en pixel, o la suya.
 *
 * @param {any} member
 * @returns {string}
 */
function faceOf(member) {
    const drawn = tokenArt({
        name: String(member?.name ?? ''), avatar: String(member?.avatar ?? ''),
        className: member?.class, gender: member?.gender, race: member?.race,
    });
    if (drawn) return drawn;
    const own = String(member?.avatar ?? '');
    return isPlainFace(own) ? '' : own;
}

/** @returns {string} La hora del juego: «Día 3 · Tarde». */
function timeNow() {
    const day = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const slot = String(getCurrentSlotLabel() ?? '').trim();
    return `Día ${day}${slot ? ` · ${slot}` : ''}`;
}

/** @returns {{chests: number, rooms: number, clues: number}|null} Lo que queda por mirar en el tablero. */
function leftoversNow() {
    const { board, gridWidth, gridHeight } = getActiveBoardContext();
    if (!board || !currentBoardName) return null;
    const left = boardLeftovers({
        board,
        won: isBoardWon(currentLocationName, currentBoardName),
        fogOn: fogOnFor(board, gridWidth, gridHeight),
        gridWidth,
        gridHeight,
        party: partyMembers.filter(m => !m.dead).map(m => ({ x: Number(m.mapPosition?.gridX) || 0, y: Number(m.mapPosition?.gridY) || 0 })),
    });
    return { chests: left.chests, rooms: left.rooms, clues: left.clues };
}

/** @returns {boolean} D-J64: el modo de hierro (quien muere no vuelve, tampoco un confidente). */
function hardMode() {
    try {
        return hasLetter(survivalNow(), 'e');
    } catch {
        return false;
    }
}

/**
 * Lo de cada uno, para la pantalla.
 *
 * @param {OutcomePlan} plan
 * @returns {import('../game-engine/combat/outcome.js').OutcomeMember[]}
 */
function membersOf(plan) {
    const t = plan.tally;
    // Idea 191: quien sostuvo el combate (como `buildVictoryReport`: el daño y diez por tumbado).
    const score = (/** @type {string} */ id) => (t.dealt[id] ?? 0) + (t.kills[id] ?? 0) * 10;
    const best = plan.kind === 'victory'
        ? partyMembers.map(m => String(m.id)).reduce((/** @type {string} */ top, id) => (score(id) > (top ? score(top) : 0) ? id : top), '')
        : '';
    return partyMembers.filter(m => m && !(/** @type {any} */ (m).summon)).map((m) => {
        const id = String(m.id);
        const before = plan.snapshot?.members.get(id);
        const level = Math.max(1, Math.floor(Number(m.level) || 1));
        return {
            dealt: t.dealt[id] ?? 0,
            kills: t.kills[id] ?? 0,
            taken: t.taken[id] ?? 0,
            best: Boolean(best) && best === id,
            id,
            name: String(m.name ?? ''),
            face: faceOf(m),
            className: String(m.class ?? ''),
            level,
            hp: Number(m.hp) || 0,
            maxHp: Number(m.maxHp) || 0,
            dead: Boolean(m.dead),
            downed: plan.downed.includes(id),
            injuries: readInjuries(m).map(i => ({ label: i.label, permanent: i.permanent, daysLeft: i.daysLeft })),
            xp: before ? Math.max(0, (Number(m.xp) || 0) - before.xp) : 0,
            nextLevel: !m.dead && canLevelUp(m) ? level + 1 : 0,
            guest: Boolean(/** @type {any} */ (m).guest),
            confidant: Boolean(/** @type {any} */ (m).confidant),
            gender: String(/** @type {any} */ (m).gender ?? ''),
        };
    });
}

/**
 * El botín de esta pelea: el oro que ha ganado cada uno y lo que ha entrado en las mochilas.
 *
 * @param {OutcomePlan} plan
 * @returns {{gold: number, items: import('../game-engine/combat/outcome.js').OutcomeItem[]}}
 */
function lootOf(plan) {
    let gold = 0;
    /** @type {import('../game-engine/combat/outcome.js').OutcomeItem[]} */
    const items = [];
    for (const member of partyMembers) {
        const before = plan.snapshot?.members.get(String(member.id));
        if (!before) continue;
        gold += Math.max(0, (Number(member.gold) || 0) - before.gold);
        for (const item of Array.isArray(member.items) ? member.items : []) {
            if (!item || before.items.has(String(item.id ?? ''))) continue;
            const any = /** @type {any} */ (item);
            const name = String(any.name ?? '');
            // Lo que dejan las bestias (idea 121) es material para la herrería: la mochila no
            // guarda esa subcategoría, se reconoce por su nombre.
            const trophy = TROPHIES.some(t => t.items.includes(name));
            items.push({
                name,
                type: String(any.type ?? ''),
                subcategory: trophy ? 'material' : String(any.subcategory ?? ''),
                rarity: String(any.rarity ?? ''),
                quest: Boolean(any.quest || any.relic || any.questItem),
                art: firstArt('item', { name: String(any.name ?? ''), id: String(any.compendiumId ?? any.id ?? '') }),
            });
        }
    }
    return { gold, items };
}

/** La pantalla que se ve ahora (para volver a pintarla tras subir de nivel). @type {OutcomePlan|null} */
let shown = null;

/**
 * Sacar la pantalla de una pelea que acaba de terminar.
 *
 * @param {OutcomePlan} plan
 */
function showPlan(plan) {
    shown = plan;
    const members = membersOf(plan);
    const hard = hardMode();
    if (plan.kind === 'victory') {
        const view = outcomeView({
            kind: 'victory', place: plan.place, round: plan.round, members, loot: lootOf(plan), time: timeNow(),
            step: afterFightNow(), here: currentLocationName, leftovers: leftoversNow(), canRest: true, hard, upgrades: plan.upgrades,
        });
        showOutcomeScreen(view, { onAction: (id, member) => onVictory(id, member) });
        return;
    }
    const checkpoint = chat_metadata ? checkpointToReturn(normalizeCheckpoints(chat_metadata[CHECKPOINT_KEY])) : null;
    const allDead = partyHasFallen(partyMembers);
    const alive = partyMembers.filter(m => !m.dead && !(/** @type {any} */ (m).guest)).length || partyMembers.filter(m => !m.dead).length;
    const standing = partyMembers.some(m => !m.dead && (Number(m.hp) || 0) > 0);
    const rescue = !allDead && !standing ? rescueFor({ inHub: Boolean(lastHub), place: currentLocationName, alive, purse: partyPurse() }) : null;
    const view = outcomeView({
        kind: 'defeat', place: plan.place, round: plan.round, members, time: timeNow(), hard,
        rescue, checkpoint: Boolean(checkpoint), saves: allDead && !hard, home: allDead && Boolean(lastHubHome),
        failed: standing ? (plan.failed || 'La misión se ha perdido') : '',
    });
    showOutcomeScreen(view, { onAction: (id) => onDefeat(id, { rescue, checkpoint }) });
}

/**
 * Lo que hace cada botón de la victoria.
 *
 * @param {string} id
 * @param {string} [memberId]
 * @returns {void|boolean}
 */
function onVictory(id, memberId) {
    if (id === 'level') {
        const member = partyMembers.find(m => String(m.id) === String(memberId));
        if (!member) return;
        void Promise.resolve(openLevelUpCard(member)).finally(() => {
            // La pantalla, con lo nuevo (sin el botón, si ya no le toca).
            if (shown && document.querySelector('.vs-card.vo-layer-victory')) showPlan(shown);
        });
        return;
    }
    shown = null;
    if (id === 'continue') {
        // D-J45: lo mismo que «Continuar» de la novela (la escena que espera, lo siguiente de la
        // campaña, volver al sitio o al tablero), que sabe dónde está y qué toca.
        const chip = /** @type {HTMLElement|null} */ (document.querySelector('#game-shell .gs-vn-box .gs-chip-continue'));
        if (chip) setTimeout(() => chip.click(), 0);
        return;
    }
    if (id === 'search') {
        // Al tablero, sin pelea: a abrir cofres y puertas.
        if (isShellOpen()) setScene(/** @type {any} */ ('combat'));
        return;
    }
    if (id === 'rest') {
        void takeRest('corto').then(() => {
            savePartyState();
            renderPartyMembers();
            if (isShellOpen()) refreshGameShell();
        });
    }
}

/**
 * Lo que hace cada botón de la derrota.
 *
 * @param {string} id
 * @param {{rescue: import('../game-engine/combat/outcome.js').OutcomeRescue|null, checkpoint: any}} context
 */
function onDefeat(id, { rescue, checkpoint }) {
    shown = null;
    if (id === 'wake' && rescue) {
        wakeUp(rescue);
        return;
    }
    if (id === 'back' && checkpoint) {
        void restoreCheckpoint(String(checkpoint.id));
        return;
    }
    if (id === 'load') {
        void import('../guardar-partida.js').then(({ openSaveGame }) => openSaveGame());
        return;
    }
    if (id === 'home') {
        void import('../campaigns.js').then(({ returnToHub }) => returnToHub());
    }
}

/**
 * Tras caer todo el grupo: os recogen, pagáis el rescate y las curas (lo que haya), pasáis el día
 * en cama y despertáis fuera del tablero con la mitad de la vida.
 *
 * @param {import('../game-engine/combat/outcome.js').OutcomeRescue} rescue
 */
function wakeUp(rescue) {
    if (rescue.cost > 0) payFromParty(rescue.cost);
    for (const member of partyMembers.filter(m => !m.dead)) {
        const max = Math.max(1, Number(member.maxHp) || 1);
        member.hp = Math.max(Number(member.hp) || 0, Math.max(1, Math.ceil(max / 2)));
        member.deathSaves = clearDeathSaves();
        member.activeConditions = (Array.isArray(member.activeConditions) ? member.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== 'Unconscious');
    }
    for (let day = 0; day < Math.max(1, rescue.days || RESCUE_DAYS); day++) advanceCampaignDay();
    postCombatNarration(`🏥 [COMBAT] ${rescue.who} os recogen.${rescue.cost > 0 ? ` Pagáis ${rescue.cost} de oro.` : ''} Despertáis en ${rescue.where}.`);
    // Fuera del tablero: al sitio (en el gremio, a su sala).
    if (currentBoardName) {
        setCurrentBoardName('');
        saveCurrentBoard();
    }
    savePartyState();
    renderPartyMembers();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
}

/** Para las pruebas: quitar la pantalla abierta, si la hay. */
export function dropOutcomeScreen() {
    shown = null;
    dropPlace();
    closeOutcomeScreen();
}
