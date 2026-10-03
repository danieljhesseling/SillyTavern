/**
 * Las peleas que se pueden evitar, en el juego (J12.2 y J8.5 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor ya sabía hacerlo (`combat/avoid-fight.js` y `combat/parley.js`) y nadie lo llamaba.
 * Aquí se enchufa:
 *
 * - **Antes de pelear** (J12.2): la elección, en una ventana de novela visual (`ui/avoid-scene.js`):
 *   quien manda de los que esperan, y hablar, pagar, huir o esconderse, cada una con su tirada.
 *   «Pelear» también está. Desde la tanda 10 se abre sola al entrar en un tablero con enemigos
 *   que os ven (`fight-entry.js`), sin «Todavía no»; las fichas «Iniciar combate» y «Evitar la
 *   pelea» ya no existen.
 *   Si sale, el tablero queda pasado (la historia sigue, sin botín); huyendo, os vais y la pelea
 *   se queda ahí; si sale mal, se pelea, y a veces empiezan ellos.
 * - **En mitad de la pelea** (J8.5): el botón «Hablar» de la barra del combate abre las cuatro
 *   formas de salir hablando: entregarse, sobornar, convencer o engañar, con lo que cuesta cada
 *   una y cómo va la pelea para ellos.
 *
 * Lo que cambia cada salida (el oro, cómo os mira alguien, un rumor, un día atados…) se aplica
 * aquí, con lo mismo que las escenas (`applySceneEffectsToGame`) y lo propio de las peleas.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldEnemies } from '../world-info.js';
import {
    avoidFor, avoidChips, resolveAvoid, avoidNotices, exitPlan, leaderOf, describeExitEffect, AVOID_KINDS,
} from '../game-engine/combat/avoid-fight.js';
import { parleyChips, resolveParley, parleyPlan, readParley, standingFoes, PARLEY_WAYS } from '../game-engine/combat/parley.js';
import { useAction } from '../game-engine/combat/turn-machine.js';
import { openExitScene } from '../game-engine/ui/avoid-scene.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    combatEncounter, currentBoardName, currentLocationName, partyMembers, setCombatBoardSelection, setCurrentBoardName,
} from './state.js';
import { rollDiceDetailed } from './combat-rules.js';
import { getActiveBoardContext, isBoardWon, recordBoardWon } from './board.js';
import { lastWaiting, renderLocationMapsPreview } from './board-view.js';
import { endCombat, startWaitingFight } from './combat-flow.js';
import { getAliveEnemies, getCurrentActingMember, getCurrentTurnEntry, saveCombatState } from './combat-state.js';
import { applySceneEffectsToGame, notePlot, storyHero, storyNight } from './plot.js';
import { lastPack, saveCurrentBoard } from './world.js';
import { partyPurse, renderPartyMembers, savePartyState } from './roster.js';
import { getPartyFormation, judgeDecision } from './companions.js';
import { noteDeed } from './world-growth.js';
import { raiseFame } from './town.js';
import { getCurrentWorldFactions, shiftFactionStanding } from './factions.js';
import { advanceCampaignDay } from './time.js';
import { deliverTakenContract } from './contracts.js';
import { noteRollInWindow, offlineGame, postCombatNarration, postForModel, speakerFor } from './narration.js';
import { brawlOf } from '../game-engine/combat/brawl.js';
import { brawlTalk } from './brawl.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Los efectos que aplica lo mismo que las escenas y las charlas. */
const SCENE_EFFECTS = new Set(['gold', 'attitude', 'rumor', 'clue', 'give', 'take', 'time', 'milestone']);

/** Un d20 con el azar de la partida (la semilla, si la hay). */
const rollD20 = () => rollDiceDetailed('1d20', 20).total;

/** Un dado de tantas caras, con el mismo azar. */
const rollDie = (/** @type {number} */ sides) => rollDiceDetailed(`1d${Math.max(1, Math.floor(sides) || 1)}`, sides).total;

/**
 * Quien espera en el tablero, como lo sabe el motor antes de pelear: su nombre y lo que dice de
 * él la ficha del mundo (su desafío, si es jefe, cómo pelea).
 *
 * @param {Array<{name: string}>} placements
 * @returns {import('../game-engine/combat/avoid-fight.js').FoeInfo[]}
 */
export function foesOf(placements) {
    const templates = getCurrentWorldEnemies();
    return (Array.isArray(placements) ? placements : []).map(placement => {
        const template = /** @type {any} */ (templates.find(e => fold(e.name) === fold(placement.name)));
        const archetype = fold(template?.archetype ?? template?.from?.arquetipo);
        return {
            name: text(placement.name),
            cr: Number(template?.cr) || 0,
            boss: Boolean(template?.boss || /** @type {any} */ (placement).boss),
            profile: text(template?.profile),
            description: text(template?.description),
            // El bestiario puede decir que es una bestia aunque su nombre no lo diga.
            ...(archetype.startsWith('bestia') ? { mind: 'bestia' } : {}),
        };
    });
}

/**
 * Si ahora se puede buscar otra salida: fuera de combate, en un tablero con su pelea escrita a la
 * vista y sin ganar. Lo mismo que ofrece «Iniciar combate».
 *
 * @returns {boolean}
 */
export function canAvoidHere() {
    return !combatEncounter.active && Boolean(currentBoardName) && lastWaiting.board === currentBoardName
        && lastWaiting.placements.length > 0 && !isBoardWon(currentLocationName, currentBoardName);
}

/**
 * Lo que cambia una salida, aplicado a la partida. Devuelve cómo decirlo.
 *
 * @param {import('../game-engine/combat/avoid-fight.js').ExitEffect[]} effects
 * @param {{roller?: string, leader?: string}} [context] Quien tiró (para la herida) y quien manda
 *   de ellos (a quien se refiere lo que no dice quién).
 * @returns {Promise<string[]>}
 */
export async function applyExitEffects(effects, { roller = '', leader = '' } = {}) {
    const list = Array.isArray(effects) ? effects : [];
    /** @type {string[]} */
    const notes = [];
    // Lo de las escenas, con quien lo dice: «os miran mejor» sin nombre es quien manda de ellos.
    const scene = list.filter(e => SCENE_EFFECTS.has(e.kind))
        .map(e => (e.kind === 'attitude' && !text(e.who) && leader ? { ...e, who: leader } : e));
    /** @type {string[]} */
    const clues = [];
    if (scene.length > 0) notes.push(...await applySceneEffectsToGame(/** @type {any} */ (scene), { hero: storyHero(), clues }));
    // Las pistas, apuntadas en lo que el mundo recuerda (la ventana ya las dice).
    for (const clue of clues) noteDeed(`Pista: ${clue}`);

    for (const effect of list) {
        if (SCENE_EFFECTS.has(effect.kind)) continue;
        const amount = Math.round(Number(effect.amount) || 0);
        switch (effect.kind) {
            case 'standing': {
                const factions = getCurrentWorldFactions();
                const wanted = fold(effect.faction);
                const faction = factions.find((/** @type {any} */ f) => fold(f?.id) === wanted || fold(f?.name) === wanted);
                if (faction && amount) await shiftFactionStanding(String(faction.id), amount);
                break;
            }
            case 'fame':
                if (amount) raiseFame(currentLocationName, amount);
                break;
            case 'hurt': {
                const hit = Math.max(0, amount);
                const who = effect.who === 'todos'
                    ? partyMembers.filter(m => !m.dead)
                    : [partyMembers.find(m => !m.dead && text(m.name) === text(roller)) ?? storyHero()].filter(Boolean);
                // Fuera de un golpe de verdad, nadie cae por salir mal parado: se queda en pie.
                for (const member of who) member.hp = Math.max(1, (Number(member.hp) || 1) - hit);
                break;
            }
            case 'days':
                for (let i = 0; i < Math.max(1, amount); i++) advanceCampaignDay();
                break;
            case 'grudge':
                if (text(effect.who)) {
                    notes.push(...await applySceneEffectsToGame([{ kind: 'attitude', who: text(effect.who), amount: -1 }], { hero: storyHero() }));
                    noteDeed(`${text(effect.who)} os la guarda.`);
                }
                break;
            default:
                break;
        }
        const said = describeExitEffect(effect, { roller });
        if (said) notes.push(said);
    }
    savePartyState();
    renderPartyMembers();
    return [...new Set(notes)];
}

/**
 * Apuntar las tiradas en el registro de dados, como cualquier otra.
 *
 * @param {Array<{who: string, said: string, natural: number, total: number, dc: number}>} rolls
 * @param {string} label
 */
function noteRolls(rolls, label) {
    for (const roll of rolls ?? []) {
        const member = partyMembers.find(m => text(m.name) === text(roll.who));
        if (member) noteRollInWindow(member, { label, natural: roll.natural, total: roll.total, dc: roll.dc, said: roll.said });
    }
}

/**
 * Salir del tablero: la pelea se queda ahí, esperando.
 */
function leaveBoard() {
    setCurrentBoardName('');
    setCombatBoardSelection({ tokenId: null, boardName: '', locationName: '' });
    saveCurrentBoard();
}

/**
 * El tablero, pasado sin pelear: ya no espera nadie, y la historia sigue como si se hubiera
 * ganado (el hito que lo pide se cumple). Sin botín.
 *
 * @param {string} how Cómo, para lo que el mundo recuerda.
 * @param {{contract?: boolean}} [options] Si el encargo de este tablero queda cumplido (echar a
 *   los contrabandistas hablando lo cumple; entregarse, no).
 */
function passBoard(how, { contract = true } = {}) {
    const board = currentBoardName;
    const place = currentLocationName;
    recordBoardWon(place, board);
    noteDeed(`${how} en ${board || place}.`);
    notePlot({ kind: 'win', place, board });
    if (contract) deliverTakenContract();
}

/**
 * J12.2: la elección antes de pelear, en su ventana. Pelear, o una de las salidas del tablero
 * (las escritas, o las de siempre según quién espera).
 *
 * Tanda 10: `auto`, abierta sola porque os han visto: sin «Todavía no» (Escape no la cierra), y
 * lo que pasa al pelear lo decide `onFight` (colocarse antes de la iniciativa).
 *
 * E7.2: `quick`, si la pelea es claramente vuestra: la ficha «Resolver rápido», con lo que costará
 * más o menos (`said`), y lo que la resuelve (`onQuick`).
 *
 * @param {{auto?: boolean, onFight?: ((placements: Array<{name: string, x: number, y: number}>, how: {enemiesFirst?: boolean}) => void)|null,
 *   quick?: {said: string, onQuick: (placements: Array<{name: string, x: number, y: number}>) => void}|null}} [options]
 * @returns {Promise<string>} Lo que pasó: `pelear`, `rapido`, `pasado`, `fuera`, `pelea` o vacío (sin decidir).
 */
export async function openAvoidChoice({ auto = false, onFight = null, quick = null } = {}) {
    if (!canAvoidHere()) return '';
    const board = getActiveBoardContext().board;
    if (!board) return '';
    const placements = [...lastWaiting.placements];
    const foes = foesOf(placements);
    const options = avoidFor(board, foes);
    const hero = storyHero();
    const party = partyMembers.filter(m => !m.dead);
    // J7.4: si hay portavoz elegido, habla él.
    const speakerId = text(getPartyFormation()?.duties?.portavoz) || null;
    const chips = avoidChips({ options, party, gold: partyPurse(), speakerId, hero });
    const leader = leaderOf(foes);
    /** @type {ReturnType<typeof exitPlan>|null} */
    let plan = null;
    /** Lo que pasó, para el registro (la nota corta) y para la novela (lo que se lee y quién lo dice). */
    const told = { note: '', show: '', who: '' };
    const fight = onFight ?? ((/** @type {any[]} */ awake, /** @type {{enemiesFirst?: boolean}} */ how) => startWaitingFight(awake, how));
    const { picked } = await openExitScene({
        title: text(board.name),
        speaker: leader,
        // Un aviso como mucho (2026-10-03): quién espera; lo de pelear o buscar otra salida ya lo
        // dicen las opciones.
        intro: avoidNotices(foes, { auto }),
        closable: !auto,
        choices: [
            { id: 'pelear', label: 'Pelear', icon: 'fa-hand-fist', text: 'Empezar la pelea', win: 'Si ganáis, os lleváis lo que lleven' },
            // E7.2: la pelea fácil, resuelta de una vez con las reglas de siempre.
            ...(quick ? [{ id: 'rapido', label: 'Resolver rápido', icon: 'fa-forward-fast', text: 'Sois muy superiores: se pelea al instante, con las reglas de siempre', win: text(quick.said) }] : []),
            ...chips.map(chip => ({ id: chip.id, label: chip.label, icon: chip.icon, text: chip.text, check: chip.check, who: chip.who, cost: chip.cost, win: chip.win, locked: chip.locked })),
        ],
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
        kind: 'avoid',
        onPick: async (id) => {
            if (id === 'pelear' || id === 'rapido') return null;
            const option = options.find(o => o.id === id);
            const chip = chips.find(c => c.id === id);
            if (!option || !chip || chip.locked) return null;
            const result = resolveAvoid({ option, party, gold: partyPurse(), rollD20, rollDie, speakerId, leader, hero });
            plan = exitPlan(result);
            noteRolls(result.rolls, chip.label);
            const notes = await applyExitEffects(result.effects, { roller: result.roller, leader });
            judgeDecision(result.judge);
            const outcome = result.lines.slice(result.rolls.length);
            told.note = `🗝️ [TABLERO] ${chip.label}: ${chip.text}. ${[...result.rolls.map(r => r.said), ...outcome].join(' ')}`;
            told.show = outcome.join('\n\n');
            // Tanda 22 (D-J60): lo que pasa lo dice quien está allí, si la rama dice quién
            // («{companero}»: uno de los tuyos; a solas, nadie, y va al aviso).
            const who = result.voice ? speakerFor(result.voice.who, `${board.name}|${id}`) : '';
            const voice = who && result.voice ? { who, text: result.voice.text } : null;
            told.who = voice?.who ?? '';
            return {
                said: chip.text,
                rolls: result.rolls.map(r => r.said),
                lines: voice ? outcome.filter(line => line !== voice.text) : outcome,
                say: voice ? [voice] : [],
                notes,
                next: plan.fight ? '¡A pelear!' : plan.leave ? 'Salir del tablero' : 'Seguir',
            };
        },
    });
    if (picked === 'pelear') {
        fight(placements, {});
        return 'pelear';
    }
    if (picked === 'rapido' && quick) {
        quick.onQuick(placements);
        return 'rapido';
    }
    const done = /** @type {ReturnType<typeof exitPlan>|null} */ (plan);
    if (!done) return '';
    if (done.fight) {
        postCombatNarration(told.note);
        fight(placements, { enemiesFirst: done.enemiesFirst });
        return 'pelea';
    }
    // D-J45: lo que pasó se cuenta en la novela, y «Continuar» sigue el hilo como tras ganar.
    await postForModel(told.note, { show: told.show, ...(told.who && offlineGame() ? { speaker: told.who } : {}) })
        .catch(error => console.error('[salidas] no se pudo contar la salida', error));
    const kind = /** @type {keyof typeof AVOID_KINDS} */ (options.find(o => o.id === picked)?.kind ?? 'hablar');
    if (done.passed) passBoard(`Pasasteis sin pelear (${AVOID_KINDS[kind]?.label.toLowerCase() ?? 'hablar'})`);
    else leaveBoard();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    return done.passed ? 'pasado' : 'fuera';
}

/**
 * Si ahora se puede hablar para salir de la pelea: en combate, en el turno de uno de los tuyos
 * y con alguien en pie enfrente.
 *
 * @returns {boolean}
 */
export function canParleyNow() {
    if (!combatEncounter.active) return false;
    const entry = getCurrentTurnEntry();
    return Boolean(entry && !entry.isEnemy && getCurrentActingMember()) && getAliveEnemies().length > 0;
}

/**
 * Los enemigos del combate como los lee `parley.js`: caídos incluidos (la moral los cuenta).
 *
 * @returns {any[]}
 */
function parleyEnemies() {
    return combatEncounter.enemies.map(e => ({
        ...e,
        name: text(e.name),
        cr: Number(e.cr) || 0,
        boss: Boolean(/** @type {any} */ (e).boss),
    }));
}

/**
 * J8.5: hablar en mitad de la pelea, en su ventana: entregarse, sobornar, convencer o engañar.
 *
 * @returns {Promise<string>} Cómo acabó (`ended`, `captured`, `lull`, `continue`, `enraged`) o vacío.
 */
export async function openParleyChoice() {
    if (!canParleyNow()) return '';
    // J12.7: en una pelea sin muertes se habla para rendirse o para pagar una ronda.
    if (brawlOf(combatEncounter)) {
        await brawlTalk();
        return '';
    }
    const board = getActiveBoardContext().board;
    const parley = readParley(board?.parley);
    const member = getCurrentActingMember();
    const hero = storyHero();
    const party = partyMembers.filter(m => !m.dead);
    const encounter = /** @type {any} */ (combatEncounter);
    const tried = Array.isArray(encounter.parleyTried) ? encounter.parleyTried : [];
    const view = parleyChips({ enemies: parleyEnemies(), party, gold: partyPurse(), parley, tried, speakerId: member?.id ?? null, hero });
    const hasAction = Boolean(combatEncounter.turnState && !combatEncounter.turnState.actionUsed);
    const morale = view.morale.reasons.map(r => r.text).join(' · ');
    /** @type {ReturnType<typeof resolveParley>|null} */
    let result = null;
    /** Lo que pasó, para la novela cuando se acaba la pelea. */
    let told = '';
    const { picked } = await openExitScene({
        title: text(board?.name) || 'La pelea',
        speaker: view.leader,
        intro: [
            `${member?.name ?? 'Quien tiene el turno'} baja un poco el arma y habla.`,
            ...(morale ? [`Cómo va la pelea para ellos: ${morale}.`] : []),
        ],
        choices: [
            { id: 'seguir', label: 'Seguir peleando', icon: 'fa-hand-fist', text: 'Dejarlo estar', win: '' },
            ...view.chips.map(chip => ({
                id: chip.id, label: chip.label, icon: chip.icon, text: chip.text, check: chip.check, who: chip.who, cost: chip.cost, win: chip.win,
                // Hablar gasta la acción de quien habla; rendirse, no.
                locked: chip.locked || (chip.id !== 'entregarse' && !hasAction ? 'Ya has gastado la acción de este turno.' : ''),
            })),
        ],
        pack: lastPack,
        town: currentLocationName,
        night: storyNight(),
        kind: 'parley',
        onPick: async (id) => {
            if (id === 'seguir') return null;
            const chip = view.chips.find(c => c.id === id);
            if (!chip) return null;
            const done = resolveParley({ way: id, enemies: parleyEnemies(), party, gold: partyPurse(), parley, rollD20, rollDie, speakerId: member?.id ?? null, hero });
            result = done;
            encounter.parleyTried = [...tried, id];
            noteRolls(done.rolls, chip.label);
            const notes = await applyExitEffects(done.effects, { roller: done.speaker, leader: done.leader });
            if (done.judge) judgeDecision(done.judge);
            const outcome = done.lines.slice(done.rolls.length);
            told = outcome.join('\n\n');
            postCombatNarration(`🗣️ [COMBAT] ${chip.label}: ${chip.text}. ${[...done.rolls.map(r => r.said), ...outcome].join(' ')}`);
            const plan = parleyPlan(done);
            // Tanda 22 (D-J60): lo que pasa lo dice quien está allí, si la rama dice quién.
            const who = done.voice ? speakerFor(done.voice.who, `${text(board?.name)}|${id}`) : '';
            const voice = who && done.voice ? { who, text: done.voice.text } : null;
            return {
                said: chip.text,
                rolls: done.rolls.map(r => r.said),
                lines: voice ? outcome.filter(line => line !== voice.text) : outcome,
                say: voice ? [voice] : [],
                notes,
                next: plan.end ? 'Seguir' : 'Volver a la pelea',
            };
        },
    });
    if (!result || !picked) return '';
    const done = /** @type {ReturnType<typeof resolveParley>} */ (result);
    const plan = parleyPlan(done);
    const boardName = currentBoardName;
    if (plan.theyLeave) {
        // Como la tregua: se van, y lo que llevan se lo llevan.
        for (const enemy of getAliveEnemies()) {
            enemy.currentHp = 0;
            /** @type {any} */ (enemy).fled = true;
        }
        saveCombatState();
        noteDeed(`Salisteis de la pelea de ${boardName || currentLocationName} hablando (${PARLEY_WAYS[/** @type {keyof typeof PARLEY_WAYS} */ (done.way)]?.label.toLowerCase() ?? done.way}).`);
    }
    if (plan.end) {
        const passed = plan.passed;
        const said = done.ends === 'captured' ? 'os habéis rendido.'
            : plan.end === 'victory' ? 'se van sin pelear más; el tablero es vuestro, sin botín de los que se van.'
                : 'se van, pero esta pelea no cuenta como ganada.';
        endCombat(plan.end, { said, told });
        if (done.ends === 'captured') {
            noteDeed(`Os entregasteis en ${boardName || currentLocationName}.`);
            if (passed) passBoard('Os entregasteis', { contract: false });
            leaveBoard();
        } else if (plan.end === 'manual') {
            leaveBoard();
        } else {
            // Se van todos sin caer nadie: el botín no entrega el encargo (no hay caídos), así
            // que se entrega aquí, si era el de este tablero.
            deliverTakenContract();
        }
    } else {
        if (plan.spendAction) {
            Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
        }
        if (plan.lull) {
            for (const enemy of getAliveEnemies()) /** @type {any} */ (enemy).parleyLull = 1;
        }
        if (plan.enraged) {
            for (const enemy of getAliveEnemies()) /** @type {any} */ (enemy).profile = 'aggressive';
        }
        saveCombatState();
    }
    savePartyState();
    renderLocationMapsPreview();
    if (isShellOpen()) refreshGameShell();
    if (chat_metadata) saveMetadata();
    return done.ends;
}

/**
 * Para las pruebas y la simulación: las salidas del tablero abierto, como las vería el jugador.
 *
 * @returns {{options: string[], board: string}}
 */
export function avoidOptionsHere() {
    const board = getActiveBoardContext().board;
    if (!board) return { options: [], board: '' };
    const foes = foesOf(lastWaiting.board === currentBoardName ? lastWaiting.placements : (board.enemyPlacements ?? []));
    return { options: avoidFor(board, foes).map(o => `${o.kind}:${o.id}`), board: text(board.name) };
}

/**
 * Lo escrito para hablar en la pelea del tablero abierto, leído (para las pruebas).
 *
 * @returns {ReturnType<typeof readParley>}
 */
export function parleyHere() {
    return readParley(getActiveBoardContext().board?.parley);
}

/**
 * Los que siguen en pie ahora, para las pruebas.
 *
 * @returns {number}
 */
export function standingNow() {
    return standingFoes(parleyEnemies()).length;
}
