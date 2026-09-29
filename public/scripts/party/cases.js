/**
 * Los casos con verdad (U8) y los duelos de palabras (U6).
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldLocationMaps, loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { readFactions } from '../game-engine/campaign/factions.js';
import { rollDiceDetailed } from './combat-rules.js';
import { duelTricks, whoCan } from '../game-engine/rules/field-uses.js';
import { petDoes } from '../game-engine/campaign/pet.js';
import { spellById, spendCharge, COMPONENTS } from '../game-engine/rules/grimoire.js';
import { readAttitudes } from '../game-engine/campaign/attitudes.js';
import { hasLetter } from '../game-engine/rules/modes.js';
import { rollCheck, skillModifier } from '../game-engine/rules/checks.js';
import {
    STANCES as DUEL_STANCES, handFrom, startDuel, playArgument, duelOutcome, duelPrompt,
} from '../game-engine/campaign/word-duel.js';
import {
    CASE_CHANCE, generateCase, checkCase, accuse, caseForNarrator, readCases, cluesHere,
} from '../game-engine/campaign/cases.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { ATTITUDES_KEY, CASES_KEY, DUELS_KEY } from './keys.js';
import { currentLocationName, currentWorldFactions, partyMembers } from './state.js';
import { currentPet, petTricks } from './pet.js';
import { carriedNames, getAbilityCatalogue, magicConsequences, payForSpell } from './magic.js';
import { savePartyState, raiseFame, shiftPlaceFortune, changeAttitude, partyPurse, payFromParty } from './main.js';
import { lastWorldNpcs } from './world.js';
import { nudgeRuler } from './factions.js';
import { getCampaignBonds, advanceCampaignSlot, campaignDay } from './time.js';
import { noteDeed, worldWrite, plotPeople, applyFate } from './world-growth.js';
import { survivalNow } from './modes.js';
import { postCombatNarration, postForModel } from './narration.js';

/**
 * U8: empezar un caso con la gente y los sitios del mundo. Cada semana, a veces; o cuando
 * se pide. Solo si sale uno que se pueda resolver.
 *
 * @param {boolean} force
 * @returns {Promise<boolean>}
 */
export async function startCase(force) {
    if (!chat_metadata) return false;
    // R1: los casos son del mundo que se mueve (letra c).
    if (!hasLetter(survivalNow(), 'c')) {
        if (force) toastr.info('En este modo el mundo no se mueve solo: no hay casos. Se enciende con «El mundo se mueve» en /modo.', 'El caso');
        return false;
    }
    const state = readCases(chat_metadata[CASES_KEY]);
    if (state.active) return false;
    const seed = String(chat_metadata?.[METADATA_KEY] || '');
    const random = createSeededRandom(derive(seed, 'caso', String(campaignDay()), String(state.closed.length)));
    if (!force && random() >= CASE_CHANCE.weekly) return false;
    const people = lastWorldNpcs.filter(n => !n.dead && n.name).map(n => ({ name: n.name, place: n.where }));
    const places = getCurrentWorldLocationMaps().map(l => String(l?.name ?? '')).filter(Boolean);
    // Nunca muere quien necesita el hilo ni quien atiende un servicio (idea 87).
    const protectedNames = [...plotPeople(), ...lastWorldNpcs.filter(n => n.service).map(n => n.name)];
    const mystery = generateCase({ people, places, random, day: Math.max(1, campaignDay()), protectedNames });
    if (!mystery || !checkCase(mystery).ok) {
        if (force) toastr.info('Este mundo aún no tiene gente suficiente para un caso: hacen falta seis personas.', 'El caso');
        return false;
    }
    chat_metadata[CASES_KEY] = { ...state, active: mystery, found: [] };
    saveMetadata();
    // Un asesinato deja a alguien menos en el mundo: el narrador tiene que saberlo.
    if (mystery.kind === 'asesinato') {
        await worldWrite(async () => {
            const worldName = String(chat_metadata?.[METADATA_KEY] || '');
            const data = await loadWorldInfo(worldName);
            if (!data) return;
            applyFate(data, { name: mystery.victim, kind: 'muere', from: mystery.place, to: '', why: 'a manos de alguien' });
            await saveWorldInfo(worldName, data, true);
        });
    }
    postCombatNarration(`🔎 [CASO] ${mystery.title}: pasó en ${mystery.place}, el día ${mystery.day}. Está en la mesa y en /caso.`);
    void postForModel(`[CASO] En ${mystery.place} ha pasado algo: ${mystery.title.toLowerCase()}. Nadie sabe todavía quién fue. `
        + 'Cuéntalo en dos frases, como se comenta en el pueblo. No sabes quién fue: no lo insinúes ni inventes pistas.');
    if (isShellOpen()) refreshGameShell();
    return true;
}

/**
 * U8: una tirada del mejor del grupo para esto, contra 12.
 *
 * @param {string} skill
 * @returns {boolean}
 */
function caseRoll(skill) {
    const who = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0)
        .reduce((/** @type {any} */ best, m) => (!best || skillModifier(m, skill).modifier > skillModifier(best, skill).modifier ? m : best), null);
    if (!who) return false;
    const roll = rollCheck({ member: who, skill, rollD20: () => rollDiceDetailed('1d20', 20).total, dc: 12 });
    if (roll) postCombatNarration(roll.said);
    return Boolean(roll?.success);
}

/**
 * U8: una pista encontrada: al diario del caso y al chat, a 0 tokens.
 *
 * @param {import('../game-engine/campaign/cases.js').CaseClue} clue
 */
export function revealClue(clue) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || state.found.includes(clue.id)) return;
    chat_metadata[CASES_KEY] = { ...state, found: [...state.found, clue.id] };
    saveMetadata();
    postCombatNarration(`🔎 [PISTA] ${clue.fact}`);
}

/**
 * U8: preguntarle a alguien por el caso. Lo que sabe a la vista se cuenta; lo que esconde,
 * se sonsaca (Perspicacia).
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function askAboutCase(name) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const clues = cluesHere(state, { person: String(name ?? '').trim() });
    if (!state.active || clues.length === 0) {
        toastr.info(`${name} no sabe nada más de eso.`, 'El caso');
        return '';
    }
    let got = 0;
    for (const clue of clues) {
        if (clue.how === 'sonsacar' && !caseRoll('insight')) continue;
        revealClue(clue);
        got++;
    }
    if (got === 0) postCombatNarration(`🔎 [PISTA] ${name} se calla lo que sabe. Otro día.`);
    if (isShellOpen()) refreshGameShell();
    return '';
}

/**
 * R4: Hablar con los muertos. En un asesinato, la víctima contesta una pregunta: una pista
 * de las que señalan de verdad (no las que despistan). Gasta la carga y el polvo de hueso.
 *
 * @returns {string}
 */
export function askTheDead() {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || state.active.kind !== 'asesinato') {
        toastr.info('No hay ningún muerto a quien preguntar.', 'Hablar con los muertos');
        return '';
    }
    const caster = whoCan(partyMembers, 'deadTalk');
    const ability = caster ? getAbilityCatalogue().find(a => a.id === caster.id) : null;
    if (!caster || !ability) {
        toastr.info('Nadie del grupo sabe Hablar con los muertos, o no le quedan cargas.', 'Hablar con los muertos');
        return '';
    }
    if (ability.component && !carriedNames().map(n => n.toLowerCase()).includes(String(ability.component).toLowerCase())) {
        toastr.info(`Hace falta ${ability.component} (${COMPONENTS[/** @type {keyof typeof COMPONENTS} */ (ability.component)]?.from ?? 'se compra'}).`, 'Hablar con los muertos');
        return '';
    }
    const clue = state.active.clues.find(c => !c.misleading && !state.found.includes(c.id));
    const paid = payForSpell(caster.who, ability);
    postCombatNarration(`💀 [CASO] ${caster.who.name} le pregunta a ${state.active.victim}.${paid.length > 0 ? ` ${paid.join(' ')}` : ''}`);
    if (clue) revealClue(clue);
    else postCombatNarration(`💀 [CASO] ${state.active.victim} no tiene nada más que decir.`);
    for (const line of magicConsequences(ability)) postCombatNarration(line);
    savePartyState();
    if (isShellOpen()) refreshGameShell();
    return '';
}

/** U8: buscar pistas aquí. Cuesta un rato del día; lo que se registra pide Investigación. */
export async function searchCaseHere() {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const clues = cluesHere(state, { place: currentLocationName });
    advanceCampaignSlot();
    let got = 0;
    for (const clue of clues) {
        // R5: el perro olfatea lo que otro tendría que registrar.
        const sniffed = clue.how === 'registrar' && petDoes(currentPet(), 'olfato');
        if (sniffed) postCombatNarration(`🐾 [MASCOTA] ${currentPet()?.name} olfatea algo y no se mueve de ahí.`);
        if (clue.how === 'registrar' && !sniffed && !caseRoll('investigation')) continue;
        revealClue(clue);
        got++;
    }
    if (got === 0) postCombatNarration(`🔎 [PISTA] Buscáis en ${currentLocationName}, pero hoy no sale nada.`);
    if (isShellOpen()) refreshGameShell();
}

/**
 * U8: acusar. Una vez: equivocarse cuenta.
 *
 * @param {{culprit: string, motive: string, method: string}} accusation
 * @returns {Promise<{verdict: string, line: string, reward: number}|null>}
 */
async function accuseCase(accusation) {
    const state = readCases(chat_metadata?.[CASES_KEY]);
    if (!state.active || !chat_metadata) return null;
    const mystery = state.active;
    const verdict = accuse(mystery, accusation);
    const reward = verdict.verdict === 'acierto' ? 60 : verdict.verdict === 'a-medias' ? 25 : 0;
    if (reward > 0) {
        const holder = partyMembers.find(m => (m.hp || 0) > 0) ?? partyMembers[0];
        if (holder) holder.gold = (Number(holder.gold) || 0) + reward;
        savePartyState();
        raiseFame(mystery.place);
    } else {
        void shiftPlaceFortune(mystery.place, -1);
    }
    // R9: quien manda donde pasó lo nota.
    void nudgeRuler(mystery.place, verdict.verdict === 'error' ? 'caso-fallo' : 'caso-acierto');
    chat_metadata[CASES_KEY] = { active: null, found: [], closed: [...state.closed, { id: mystery.id, title: mystery.title, verdict: verdict.verdict }] };
    saveMetadata();
    const told = verdict.verdict === 'error' ? `Acusasteis a ${accusation.culprit}, y no fue: quien lo hizo sigue suelto.` : verdict.line;
    noteDeed(`${mystery.title}: ${told}`);
    postCombatNarration(`⚖️ [CASO] ${verdict.line}${reward > 0 ? ` (${reward} de oro)` : ''}`);
    void postForModel(`${caseForNarrator(mystery, state.found)}
[CASO] El grupo acusa a ${accusation.culprit}. `
        + `${verdict.verdict === 'error' ? 'Se equivocan: no fue.' : verdict.verdict === 'a-medias' ? 'Fue, aunque no todo encaja.' : 'Aciertan.'} Cuéntalo en tres o cuatro frases.`);
    if (isShellOpen()) refreshGameShell();
    return { ...verdict, reward };
}

/** U8: el tablero del caso. */
export async function openCaseBoard() {
    const { buildCaseBoard } = await import('../game-engine/ui/case-board.js');
    const state = readCases(chat_metadata?.[CASES_KEY]);
    const board = buildCaseBoard({
        state,
        onAccuse: (accusation) => {
            void accuseCase(accusation).then(result => {
                if (!result) return;
                const verdict = document.createElement('div');
                verdict.className = 'cb-verdict';
                verdict.dataset.verdict = result.verdict;
                verdict.textContent = `${result.line}${result.reward > 0 ? ` (${result.reward} de oro)` : ''}`;
                board.replaceChildren(verdict);
            });
        },
    });
    await new Popup(board, POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', wide: true, allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * U6: si hoy aún se puede tener un duelo de palabras con alguien.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function canDuel(name) {
    return Number(chat_metadata?.[DUELS_KEY]?.[name]) !== Math.max(1, campaignDay());
}

/**
 * U6: convencer a alguien del mundo, en un duelo de palabras. Su postura sale de la semilla
 * (siempre la misma para la misma persona); su paciencia, de cómo os mira. Si cede, os mira
 * mejor. El narrador lo cuenta una vez.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function duelWith(name) {
    const npc = lastWorldNpcs.find(n => !n.dead && n.name.toLowerCase() === String(name ?? '').trim().toLowerCase());
    if (!npc || !chat_metadata) {
        toastr.info('No hay nadie así aquí.', 'Convencer');
        return '';
    }
    if (!canDuel(npc.name)) {
        toastr.info(`Con ${npc.name} ya hablasteis hoy: mañana.`, 'Convencer');
        return '';
    }
    const who = partyMembers.filter(m => (Number(m.hp) || 0) > 0 && !m.dead)
        .reduce((/** @type {any} */ top, m) => (!top || skillModifier(m, 'persuasion').modifier > skillModifier(top, 'persuasion').modifier ? m : top), null);
    if (!who) return '';
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'postura', npc.name));
    const stances = Object.keys(DUEL_STANCES);
    const stance = stances[Math.floor(random() * stances.length) % stances.length];
    const value = Number(readAttitudes(chat_metadata?.[ATTITUDES_KEY]).values[npc.name]) || 0;
    const mystery = readCases(chat_metadata?.[CASES_KEY]);
    const bonds = getCampaignBonds();
    const hand = handFrom({
        modifiers: {
            persuasion: skillModifier(who, 'persuasion').modifier,
            deception: skillModifier(who, 'deception').modifier,
            intimidation: skillModifier(who, 'intimidation').modifier,
        },
        evidence: mystery.active ? mystery.active.clues.filter(c => mystery.found.includes(c.id)).map(c => c.fact) : [],
        favors: readFactions(currentWorldFactions).filter(f => Number(f.reputation) >= 2).map(f => f.name),
        purse: partyPurse(),
        companions: partyMembers.filter(m => m !== who && !m.dead).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
        // R3: una burla o una palabra de ánimo, si quien habla las sabe. R5: y la mascota con labia.
        tricks: [...duelTricks(who), ...petTricks()],
    });
    const what = `que ${npc.name} os mire mejor`;
    const final = await playDuel({ npc: { name: npc.name, stance }, patience: Math.max(3, Math.min(11, 7 - 2 * value)), hand, rounds: 3, speaker: String(who.name), what });
    chat_metadata[DUELS_KEY] = { ...(chat_metadata[DUELS_KEY] ?? {}), [npc.name]: Math.max(1, campaignDay()) };
    if (final.spent > 0) payFromParty(Math.min(final.spent, partyPurse()));
    const outcome = duelOutcome(final) ?? 'no-cede';
    if (outcome === 'cede') changeAttitude(npc.name, 1, 'le convencisteis');
    saveMetadata();
    postCombatNarration(`🗣️ [DUELO] ${who.name} habla con ${npc.name}: ${outcome === 'cede' ? 'cede' : outcome === 'a-medias' ? 'cede a medias' : 'no cede'}.`);
    void postForModel(duelPrompt(final, what));
    if (isShellOpen()) refreshGameShell();
    return '';
}

/** Lo que dice el duelo al acabar. */
const DUEL_OUTCOMES = { 'cede': 'Cede.', 'a-medias': 'Cede a medias.', 'no-cede': 'No cede.' };

/**
 * U6 del pegamento: jugar un duelo de palabras en un cuadro, ronda a ronda.
 *
 * @param {Object} input
 * @param {{name: string, stance: string}} input.npc
 * @param {number} input.patience
 * @param {import('../game-engine/campaign/word-duel.js').Argument[]} input.hand
 * @param {number} input.rounds
 * @param {string} input.speaker
 * @param {string} input.what
 * @returns {Promise<import('../game-engine/campaign/word-duel.js').DuelState>}
 */
export function playDuel({ npc, patience, hand, rounds, speaker, what }) {
    let state = startDuel({ npc, patience, hand, rounds });
    const body = $('<div class="wd-root"></div>');
    const render = () => {
        body.empty();
        const stance = DUEL_STANCES[state.npc.stance];
        body.append($('<h3></h3>').text(`${speaker} habla con ${state.npc.name}`));
        body.append($('<p class="wd-goal"></p>').text(`Para ${what}.`));
        body.append($('<p class="wd-stance"></p>').text(`Está ${stance.label}: ${stance.note}`));
        body.append($('<div class="wd-meters"></div>').text(`Su paciencia: ${state.patience} · Tu compostura: ${state.composure} · Ronda ${state.round} de ${state.rounds}`));
        for (const line of state.log) body.append($('<div class="wd-log"></div>').text(line));
        const outcome = duelOutcome(state);
        if (outcome) {
            body.append($('<div class="wd-outcome"></div>').attr('data-outcome', outcome).text(DUEL_OUTCOMES[outcome]));
            return;
        }
        const cards = $('<div class="wd-cards"></div>');
        for (const argument of state.hand) {
            const signed = (/** @type {number} */ n) => `${n >= 0 ? '+' : ''}${n}`;
            const card = $('<button type="button" class="menu_button wd-card"></button>')
                .attr('data-id', argument.id)
                .prop('disabled', state.used.includes(argument.id))
                .text(argument.skill ? `${argument.label} (${signed(Number(argument.modifier) || 0)})` : argument.label);
            card.on('click', () => {
                state = playArgument(state, argument.id, () => rollDiceDetailed('1d20', 20).total).state;
                // R4: una carta de conjuro gasta la carga de quien habla.
                const spell = argument.spell ? spellById(String(argument.spell)) : null;
                const caster = spell ? partyMembers.find(m => String(m.name) === speaker) : null;
                if (spell && caster) {
                    caster.spellCharges = spendCharge(caster, spell.circle);
                    savePartyState();
                }
                render();
            });
            cards.append(card);
        }
        body.append(cards);
    };
    render();
    return new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Hecho', allowVerticalScrolling: true }).show().then(() => {
        // R4: un Encanto que no sale bien se nota: os tiene ganas.
        const risky = state.hand.some(a => a.risky && state.used.includes(a.id));
        if (risky && duelOutcome(state) !== 'cede') changeAttitude(state.npc.name, -1, 'se ha dado cuenta del encanto');
        return state;
    });
}
