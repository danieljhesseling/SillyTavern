/**
 * El tiempo de la campaña: el reloj y los vínculos (`campaign-state.js`), lo que pasa cada día
 * y cada semana, descansar, curarse, comer, la cuenta de la semana, las deudas y la mesa de la
 * semana.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat, chat_metadata, saveMetadata } from '../../script.js';
import { getCurrentWorldLocationMaps, loadWorldInfo, METADATA_KEY } from '../world-info.js';
import { saysWith } from '../game-engine/campaign/factions.js';
import { applyMarket, describeMarket } from '../game-engine/campaign/economy.js';
import { rollDiceDetailed } from './combat-rules.js';
import { createCampaignState } from './campaign-state.js';
import { noteGone } from '../game-engine/campaign/companion-arcs.js';
import { feedPerWeek } from '../game-engine/world/mounts.js';
import { describeSeason } from '../game-engine/world/seasons.js';
import { coolDown, readWanted } from '../game-engine/campaign/crime.js';
import { healInjuries, readInjuries, setInjury } from '../game-engine/rules/injuries.js';
import { tickNeeds, exhaustionInjury, describeNeeds, LETHAL_EXHAUSTION } from '../game-engine/rules/needs.js';
import { describeSurvival } from '../game-engine/rules/mortality.js';
import { stagesFor, keepOn, hasLetter, describeMode as describeGameMode } from '../game-engine/rules/modes.js';
import { weeklyBill, settleWeek, describeBill } from '../game-engine/rules/upkeep.js';
import { readDebt, offerPatronage, debtDue, describeDebt } from '../game-engine/campaign/patronage.js';
import { DAY_STAGES, WEEK_STAGES, runStages, weeksDue } from '../game-engine/campaign/time-stages.js';
import { upcoming, describeUpcoming, whenText } from '../game-engine/campaign/upcoming.js';
import { affairsOf, standingsOf, weekSummary } from '../game-engine/campaign/week-table.js';
import { canDispatch } from '../game-engine/campaign/dispatch.js';
import { readCases } from '../game-engine/campaign/cases.js';
import { chronicleOf } from '../game-engine/campaign/chronicle.js';
import { withJob } from '../game-engine/campaign/company.js';
import { addScar } from '../game-engine/campaign/feats.js';
import { upkeepWithBuildings, settleLoyalty, trainingFor } from '../game-engine/campaign/guild.js';
import { describeMode } from '../game-engine/rules/companions.js';
import { getBondProgress } from '../game-engine/campaign/bonds.js';
import { renderCampaignPanel } from '../game-engine/ui/campaign-panel.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    ATTITUDES_KEY, BILL_DUE_KEY, BOARD_KEY, CASES_KEY, CLIMATE_KEY, DEBT_KEY, DISPATCHES_KEY, FAME_KEY, GONE_KEY,
    HINTS_KEY, MOUNTS_KEY, PLOT_STATE_KEY, TAKEN_KEY, TIPS_SEEN_KEY, WANTED_KEY, WEEK_TABLE_AUTO_KEY,
    WEEK_TABLE_KEY, localFlag,
} from './keys.js';
import {
    combatEncounter, currentBoardName, currentLocationName, currentWorldFactions, factionDaysDue, partyMembers,
    setFactionDaysDue, setPartyMembers,
} from './state.js';
import { getAbilityCatalogue } from './magic.js';
import { expireBoard, getGuild, openDispatch, returnDispatches, rivalsMove } from './contracts.js';
import { openCaseBoard, startCase } from './cases.js';
import { applyFall } from './combat-flow.js';
import { lastWorldSeason, weatherHere } from './world.js';
import {
    describeWorldFactions, getCurrentWorldFactions, scheduleFactionTick, shiftFactionStanding,
} from './factions.js';
import {
    savePartyState, renderPartyMembers, postCombatNarration, playSucesos, tellMoment, favorsHere, welcomeBack,
    postForModel, currentSurvival, survivalNow, currentMarket, leavingMembers, showTip, writeLetters,
    worldFestivals, tellFestival, tellBondScene, weighDepartures, checkNickname, offerPersonalQuests, partyPurse,
    payFromParty,
} from './main.js';
import { getPlot, notePlot, openMilestones, giveDueHints } from './plot.js';
import { noteDeed, driftPeople } from './world-growth.js';

/**
 * El estado de campana -reloj, vinculos, descansos y mapa- vive en su propio modulo.
 *
 * Aqui solo queda decirle donde estan las cosas de la aplicacion. Ese es el corte: el
 * modulo dice que necesita, y nada de lo que hay dentro busca variables globales.
 */
export const campaign = createCampaignState({
    metadata: () => chat_metadata,
    saveMetadata: () => saveMetadata(),
    party: () => partyMembers,
    saveParty: () => savePartyState(),
    renderParty: () => renderPartyMembers(),
    renderCampaign: () => renderCampaignTab(),
    narrate: (text) => postCombatNarration(text),
    // Z1 de ROADMAP_SIN_TOKENS: el descanso, contado por el narrador del motor.
    tellRest: (kind) => tellMoment('descanso', {
        largo: kind === 'largo' ? 'sí' : 'no',
        dia: Math.max(1, Number(getCampaignCalendar()?.day) || 1) + (kind === 'largo' ? 1 : 0),
        tiempo: weatherHere(),
    }),
    // Cada rango tiene su escena escrita, si el compañero la trae (idea 26).
    rankedUp: (member, rank) => tellBondScene(member, rank),
    isFighting: () => Boolean(combatEncounter.active),
    worldName: () => String(chat_metadata?.[METADATA_KEY] || ''),
    loadWorld: (name) => loadWorldInfo(name),
    // Para devolver los usos de habilidad al descansar: el catalogo vive en las reglas.
    abilities: () => getAbilityCatalogue(),
    // Lo que el tiempo le hace al grupo: curar heridas y pasar la cuenta.
    timePasses: (days, calendar) => onTimePassed(days, calendar),
});

/**
 * Los precios de la semana, con los edificios del gremio descontados.
 *
 * Un solo sitio donde se juntan las dos capas: la campana pone los precios y el gremio los
 * abarata. Preguntarlo en dos sitios distintos seria acabar cobrando dos cosas distintas.
 *
 * @returns {any}
 */
export function currentUpkeepRules() {
    // Tres capas, y en este orden: la campana pone los precios, el gremio los abarata con
    // lo que haya construido, y el mundo de fuera los sube. Preguntarlo en dos sitios
    // distintos seria acabar cobrando dos cosas distintas.
    return applyMarket(
        upkeepWithBuildings(getActiveRuleset()?.upkeep ?? null, getGuild()),
        currentMarket(),
    );
}

/**
 * Curar y cobrar: lo que pasa por el hecho de que pase el tiempo.
 *
 * Es la mitad que le faltaba al reloj. Hasta ahora el dia solo avanzaba si tu lo movias y
 * no costaba nada, asi que ganar por los pelos y ganar de sobra eran lo mismo al dia
 * siguiente. Ahora cada dia cura un poco y cada semana hay que pagar.
 *
 * @param {number} days
 * @param {any} calendar
 */
function onTimePassed(days, calendar) {
    const today = Math.max(1, Math.floor(Number(calendar?.day) || 1));
    if (!chat_metadata) {
        notePlot({ kind: 'day', day: Math.floor(Number(calendar?.day) || 0) });
        return;
    }
    // U3 del pegamento: un solo paso del tiempo, en el orden de `time-stages.js`. Si una
    // etapa falla, las demás pasan igual (antes, un error en los rivales dejaba la cuenta
    // sin cobrar).
    // R1: lo que el modo apaga no pasa (sin el cuerpo no hay hambre; sin el mundo, las
    // facciones no avanzan solas).
    const result = runStages(stagesFor(DAY_STAGES, survivalNow()), DAY_HANDLERS, { days, today, calendar }, reportLateStage);
    for (const failed of result.failed) console.error(`[party] la etapa «${failed.id}» del paso del tiempo falló:`, failed.error);
}

/** @param {string} id @param {string} error */
function reportLateStage(id, error) {
    console.error(`[party] la etapa «${id}» del paso del tiempo falló después:`, error);
}

/**
 * U3 del pegamento: lo que hace cada etapa del día. El orden no está aquí: está en
 * `DAY_STAGES`, escrito una vez y probado.
 *
 * @type {Record<string, (context: {days: number, today: number, calendar: any}) => any>}
 */
const DAY_HANDLERS = {
    hilo: ({ calendar }) => notePlot({ kind: 'day', day: Math.floor(Number(calendar?.day) || 0) }),
    // Idea 103: si el hilo lleva dias quieto, llega una pista.
    pistas: () => giveDueHints(),
    // Ideas 113 y 89: las cartas que se escriben hoy, y la fiesta de hoy.
    cartas: () => writeLetters(),
    fiesta: () => tellFestival(),
    curar: ({ days }) => healByDays(days),
    // Comer, beber, dormir y aguantar el clima. Hasta ahora la comida se pagaba y no pasaba
    // nada si no comias: un aviso y a seguir.
    necesidades: ({ days }) => passNeeds(days),
    // El mismo dia que cura y da de comer acerca a los otros a lo que quieren. Antes se
    // contaba aparte, midiendo el calendario alrededor de cada forma de pasar el dia.
    facciones: ({ days }) => {
        setFactionDaysDue(factionDaysDue + Math.max(0, Math.floor(Number(days) || 0)));
        scheduleFactionTick();
    },
    // U8 del pegamento: vuelven los que mandasteis.
    despachos: ({ today }) => returnDispatches(today),
    // Antes solo vencian al abrir el gremio: no abrirlo salia gratis.
    tablon: ({ today }) => expireBoard(today),
    semana: ({ today }) => settleWeeks(today),
};

/**
 * U3 del pegamento: lo de cada semana. Cobrar, lo último.
 *
 * @type {Record<string, () => any>}
 */
const WEEK_HANDLERS = {
    // Primero cobran lo que se debe: el viernes es el viernes para todos.
    deuda: () => settleDueDebt(),
    // Idea 87: y de vez en cuando, sin guerra de por medio, alguien se muda.
    gente: () => driftPeople(),
    // Idea 29: quien está harto avisa, y si ya avisó, se va (si está puesto).
    hartos: () => {
        weighDepartures();
        // R8: y quien se fue, a veces vuelve.
        welcomeBack();
    },
    // Idea 94: los rivales se llevan uno del tablón.
    rivales: () => rivalsMove(),
    // Idea 96: lo que os buscan se va olvidando.
    buscados: () => {
        if (chat_metadata) chat_metadata[WANTED_KEY] = coolDown(chat_metadata[WANTED_KEY]);
    },
    cuenta: () => chargeBill(),
    // U8 del pegamento: a veces, un caso.
    caso: () => { void startCase(false); },
    // U5 del pegamento: la mesa de la semana que empieza.
    mesa: () => startWeekTable(),
};

/**
 * Empieza una semana: se apunta lo que pasó en la anterior (de la crónica, sin llamar al
 * modelo) y la mesa se abre sola la primera vez —como un consejo— o si así se quiere; si
 * no, se avisa y está en su botón.
 */
function startWeekTable() {
    if (!chat_metadata) return;
    const state = chat_metadata[WEEK_TABLE_KEY] ?? {};
    const week = weekNumber(campaignDay());
    const summary = weekSummary(chronicleOf(chat), Number(state.since) || 0);
    chat_metadata[WEEK_TABLE_KEY] = { week, since: chat.length, summary };
    saveMetadata();
    const seen = localFlag.get(TIPS_SEEN_KEY).split(',').filter(Boolean);
    if (chat_metadata[WEEK_TABLE_AUTO_KEY] || !seen.includes('mesa')) {
        if (!seen.includes('mesa')) localFlag.set(TIPS_SEEN_KEY, [...seen, 'mesa'].join(','));
        setTimeout(() => { void openWeekTable(); }, 300);
        return;
    }
    const weekTold = tellMoment('semana', { semana: week, cuenta: 'La mesa, con lo que no cabe entero, está en su botón.' });
    postCombatNarration(`📋 [PARTIDA] ${weekTold || `Empieza la semana ${week}: la mesa, con lo que no cabe entero, está en su botón.`}`);
    // Z4: la semana también trae lo suyo.
    playSucesos('semana');
}

/**
 * La semana del calendario en la que cae un día: la 1 es la de los primeros días.
 *
 * @param {number} day
 * @returns {number}
 */
function weekNumber(day) {
    const length = Math.max(1, Number(currentUpkeepRules().weekLength) || 7);
    return Math.floor((Math.max(1, Math.floor(Number(day) || 1)) - 1) / length) + 1;
}

/** U5 del pegamento: la mesa de la semana. */
export async function openWeekTable() {
    if (!chat_metadata) return;
    const today = Math.max(1, campaignDay());
    const state = chat_metadata[WEEK_TABLE_KEY] ?? {};
    const bill = partyMembers.length > 0 ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null;
    const due = Number(chat_metadata[BILL_DUE_KEY]) || 0;
    const body = $('<div class="wt-root gs-panel"></div>');
    body.append($('<h3 class="gs-popup-title"></h3>').text(`Semana ${weekNumber(today)} · ${describeSeason(today, lastWorldSeason || undefined)}`));
    if (bill && due > 0 && hasLetter(survivalNow(), 'b')) {
        const short = bill.purse < bill.total;
        body.append($('<p class="wt-bill"></p>').toggleClass('wt-short', short)
            .text(`La cuenta ${whenText(Math.max(0, due - today))}: debéis ${bill.total}, tenéis ${bill.purse}.`));
    }
    const section = (/** @type {string} */ title) => body.append($('<div class="wt-title"></div>').text(title));
    const past = Array.isArray(state.summary) ? state.summary : [];
    if (past.length > 0) {
        section('La semana que pasó');
        for (const line of past) body.append($('<div class="wt-line"></div>').text(line));
    }
    const bonds = getCampaignBonds();
    const affairs = keepOn(affairsOf({
        today,
        factions: currentWorldFactions,
        taken: chat_metadata[TAKEN_KEY] ?? null,
        board: Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [],
        plot: getPlot(),
        plotState: chat_metadata[PLOT_STATE_KEY],
        debt: chat_metadata[DEBT_KEY] ?? null,
        party: partyMembers,
        rivals: hasLetter(survivalNow(), 'c'),
        mystery: readCases(chat_metadata[CASES_KEY]),
        // T7: el harto, en la mesa.
        leaving: leavingMembers().map(m => ({ id: m.id, name: String(m.name) })),
        weekDue: Number(chat_metadata[BILL_DUE_KEY]) || 0,
    }), survivalNow());
    section('Los asuntos: no caben todos');
    if (affairs.length === 0) body.append($('<div class="wt-line"></div>').text('Nada aprieta esta semana. Buen momento para el gremio, la posada o el camino.'));
    for (const affair of affairs) {
        const card = $('<div class="wt-affair"></div>').attr('data-kind', affair.kind);
        card.append($('<div class="wt-affair-title"></div>').text(affair.title));
        if (affair.detail) card.append($('<div class="wt-affair-detail"></div>').text(affair.detail));
        card.append($('<div class="wt-affair-when"></div>').text(affair.in === null ? 'Sin plazo' : `Plazo: ${whenText(affair.in)}`));
        card.append($('<div class="wt-ignored"></div>').text(`Si no vais: ${affair.ifIgnored}.`));
        // U8: lo menor del tablón se puede despachar.
        if (affair.kind === 'tablon') {
            const contract = (Array.isArray(chat_metadata[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : [])
                .find((/** @type {any} */ c) => `tablon:${String(c?.id)}` === affair.id);
            if (contract && canDispatch(contract).ok) {
                const send = $('<button type="button" class="menu_button wt-dispatch"></button>').text('Mandar a alguien');
                send.on('click', async () => {
                    if (await openDispatch(contract)) send.replaceWith($('<div class="wt-sent"></div>').text('Mandados.'));
                });
                card.append(send);
            }
        }
        // U8: el caso, con su tablero.
        if (affair.kind === 'caso') {
            const look = $('<button type="button" class="menu_button wt-case"></button>').text('Ver el caso');
            look.on('click', () => { void openCaseBoard(); });
            card.append(look);
        }
        body.append(card);
    }
    const standings = standingsOf({
        guild: getGuild(),
        factions: currentWorldFactions,
        fame: chat_metadata[FAME_KEY],
        places: getCurrentWorldLocationMaps(),
        wanted: chat_metadata[WANTED_KEY],
        attitudes: chat_metadata[ATTITUDES_KEY],
        companions: partyMembers.slice(1).map(m => ({ name: String(m.name), rank: getBondProgress(bonds, String(m.id)).rank })),
    });
    // R8: lo que os hace la gente de aquí que os aprecia.
    const favors = favorsHere();
    if (favors.length > 0) {
        section('Quién os echa una mano aquí');
        for (const favor of favors) body.append($('<div class="wt-line wt-favor"></div>').text(`${favor.name}: ${favor.favor}.`));
    }
    if (standings.length > 0) {
        section('Cómo os ven');
        for (const group of standings) {
            body.append($('<div class="wt-sub"></div>').text(group.title));
            for (const item of group.items) body.append($('<div class="wt-line"></div>').text(item));
        }
    }
    const coming = describeUpcoming(whatComes(today), 6);
    if (coming.length > 0) {
        section('Lo que viene');
        for (const line of coming) body.append($('<div class="wt-line"></div>').text(line));
    }
    await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
}

/**
 * Cobrar, cuando toca. El dia de vencimiento vive en la partida, no en la sesion.
 *
 * @param {number} today
 */
function settleWeeks(today) {
    if (!chat_metadata) return;
    const week = Math.max(1, Number(currentUpkeepRules().weekLength) || 7);
    const { weeks, nextDue } = weeksDue(today, Number(chat_metadata[BILL_DUE_KEY]), week);
    for (let i = 0; i < weeks; i++) chargeWeek();
    chat_metadata[BILL_DUE_KEY] = nextDue;
    saveMetadata();
}

/**
 * Curar. Lo permanente se queda; lo demas cuenta los dias.
 *
 * @param {number} days
 */
function healByDays(days) {
    /** @type {string[]} */
    const mended = [];
    for (const member of partyMembers) {
        if (readInjuries(member).length === 0) continue;

        const patch = healInjuries(member, days);
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);
        for (const injury of patch.healed) {
            mended.push(`${member.name}: ${injury.label.toLowerCase()}, curado.`);
            // Idea 56: la herida se va, la marca se queda. E impone.
            member.scars = addScar(member, injury.label);
            mended.push('Le queda una cicatriz (+1 a Intimidación, hasta +2).');
            checkNickname(member);
        }
    }
    if (mended.length > 0) {
        postCombatNarration(`🩹 [CAMPAÑA] ${mended.join(' ')}`);
        savePartyState();
    }
}

/**
 * Lo que unas horas mas le hacen al grupo: hambre, sed, sueno y frio.
 *
 * El agotamiento se aplica **como una herida**, por el mismo sitio que una pierna rota:
 * asi hay un solo mecanismo que empeora a alguien y un solo dueno de `baseStats`.
 *
 * @param {number} days
 */
function passNeeds(days) {
    const hours = Math.max(0, Math.floor(Number(days) || 0)) * 24;
    if (hours <= 0) return;

    const climate = String(chat_metadata?.[CLIMATE_KEY] || 'mild');
    // Dentro de un tablero se esta a la intemperie; en la localidad, bajo techo. Es una
    // aproximacion honesta y se puede afinar cuando las localidades digan si cobijan.
    const sheltered = !currentBoardName;

    /** @type {string[]} */
    const said = [];

    for (const member of partyMembers) {
        if (member.dead) continue;

        // Un mundo puede decidir que aqui no se pasa hambre, o que el clima no mata.
        const rules = currentSurvival();
        if (!rules.needs) continue;
        const tick = tickNeeds(member, {
            hours, climate: rules.exposure ? climate : 'templado', sheltered,
        });
        member.needs = tick.needs;
        said.push(...tick.lines);

        if (tick.damage > 0) member.hp = Math.max(0, (Number(member.hp) || 0) - tick.damage);

        const patch = setInjury(member, tick.exhaustion > 0 ? exhaustionInjury(tick.exhaustion) : null, 'exhaustion');
        member.injuries = patch.injuries;
        member.baseStats = patch.baseStats;
        Object.assign(member, patch.stats);

        // Quien llega al final cae a cero: de ahi en adelante deciden las reglas de la
        // campana, igual que si lo hubiera tumbado una espada. Una sola puerta a la muerte.
        if (tick.collapsed || tick.exhaustion >= LETHAL_EXHAUSTION) {
            member.hp = 0;
            // Quien cae por el clima cae por el clima: el frio se lleva dedos, no brazos.
            applyFall(member, climate === 'frio' ? 'frio' : '');
        }
    }

    if (said.length > 0) {
        postCombatNarration(`🥖 [CAMPAÑA] ${said.join(' ')}`);
        savePartyState();
    }
}

/**
 * La cuenta de una semana, pasada de verdad.
 *
 * Se cobra de lo que hay entre todos y se dice entero. Cuando no llega no se mata de
 * hambre a nadie de golpe: quien vino por dinero deja de cobrar y la lealtad baja, que es
 * lo que se nota en la partida siguiente.
 */
function chargeWeek() {
    // U3 del pegamento: las etapas de la semana, en el orden de `WEEK_STAGES`.
    const result = runStages(stagesFor(WEEK_STAGES, survivalNow()), WEEK_HANDLERS, {}, reportLateStage);
    for (const failed of result.failed) console.error(`[party] la etapa «${failed.id}» de la semana falló:`, failed.error);
}

/** La cuenta de la semana: comida, sueldos, posada y tasas. */
function chargeBill() {
    // H1: la primera cuenta dice qué es (solo llega en los modos que la tienen).
    showTip('bill');
    let bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });
    // Si no llega, alguien pone lo que falta. Una vez: es para romper la espiral, no para
    // que la cuenta deje de importar.
    if (bill.total > bill.purse && takePatronage(bill.total - bill.purse)) {
        bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });
    }
    const week = settleWeek(partyMembers, bill);

    // Se cobra por cabeza, empezando por quien mas lleva: el oro es del grupo.
    let owed = Math.min(bill.total, bill.purse);
    for (const member of [...partyMembers].sort((a, b) => (Number(b.gold) || 0) - (Number(a.gold) || 0))) {
        if (owed <= 0) break;
        const has = Math.max(0, Number(member.gold) || 0);
        const taken = Math.min(has, owed);
        member.gold = has - taken;
        owed -= taken;
    }

    for (const name of week.unpaid) {
        const member = partyMembers.find(m => m.name === name);
        if (member) member.unpaidWeeks = (Number(member.unpaidWeeks) || 0) + 1;
    }

    // Y la lealtad, que es lo que convierte no pagar en una consecuencia y no en un
    // numero rojo. Quien llega al fondo se va: es la decision que tomaste con la cuenta
    // delante, no un castigo por jugar mal.
    // Y que la gente se vaya cuando no cobra: se puede apagar, y entonces se quedan.
    const loyalty = currentSurvival().loyalty
        ? settleLoyalty(partyMembers, week.unpaid)
        : { leaving: [], lines: [] };
    if (loyalty.leaving.length > 0) {
        // R8: quien se va sin cobrar también puede volver.
        for (const gone of partyMembers.filter(m => loyalty.leaving.includes(String(m.name)))) {
            if (chat_metadata) chat_metadata[GONE_KEY] = noteGone(chat_metadata[GONE_KEY], gone, campaignDay(), 'sin cobrar');
        }
        setPartyMembers(partyMembers.filter(m => !loyalty.leaving.includes(String(m.name))));
        renderPartyMembers();
    }
    for (const line of loyalty.lines) postCombatNarration(`🤝 [GREMIO] ${line}`);

    // Idea 129: lo que comen las monturas.
    const feed = feedPerWeek(chat_metadata?.[MOUNTS_KEY]);
    if (feed > 0) {
        payFromParty(Math.min(feed, partyPurse()));
        postCombatNarration(`🐴 [CAMPAÑA] El pienso de las monturas: ${feed} de oro.`);
    }

    // Idea 37: el maestro de armas enseña a los que van por detrás.
    const lessons = trainingFor(getGuild(), partyMembers);
    for (const lesson of lessons) {
        const member = partyMembers.find(m => String(m.id) === lesson.id);
        if (member) member.xp = (Number(member.xp) || 0) + lesson.xp;
    }
    if (lessons.length > 0) {
        postCombatNarration(`🗡️ [GREMIO] El maestro de armas os entrena: ${lessons.map(l => l.name).join(', ')} ganan ${lessons[0].xp} de experiencia.`);
    }

    savePartyState();
    postCombatNarration(`💰 [CAMPAÑA] ${week.lines.join(' ')}`);
    if (!week.paid) toastr.warning(week.lines.join('\n'), 'La cuenta no sale', { timeOut: 15000 });
}

/**
 * U3 del pegamento: lo que viene, de todos los relojes a la vez.
 *
 * @param {number} today
 * @returns {import('../game-engine/campaign/upcoming.js').Upcoming[]}
 */
export function whatComes(today) {
    const bill = partyMembers.length > 0 ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null;
    // R1: lo apagado no sale.
    return keepOn(upcoming({
        today,
        factions: currentWorldFactions,
        billDue: Number(chat_metadata?.[BILL_DUE_KEY]) || 0,
        bill: Number(bill?.total) || 0,
        purse: partyPurse(),
        debt: chat_metadata?.[DEBT_KEY] ?? null,
        taken: chat_metadata?.[TAKEN_KEY] ?? null,
        plot: getPlot(),
        plotState: chat_metadata?.[PLOT_STATE_KEY],
        party: partyMembers,
        festivals: worldFestivals(),
        dispatches: Array.isArray(chat_metadata?.[DISPATCHES_KEY]) ? chat_metadata[DISPATCHES_KEY] : [],
        seasonStart: lastWorldSeason || undefined,
        // T7: los relojes que no decían su plazo.
        leaving: leavingMembers().map(m => String(m.name)),
        rivals: (Array.isArray(chat_metadata?.[BOARD_KEY]) ? chat_metadata[BOARD_KEY] : []).length > 0,
        wanted: readWanted(chat_metadata?.[WANTED_KEY]),
        hints: {
            open: openMilestones().map((/** @type {any} */ m) => ({ id: String(m.id), title: String(m.title ?? m.id) })),
            openedDay: chat_metadata?.[HINTS_KEY]?.openedDay ?? {},
            given: chat_metadata?.[HINTS_KEY]?.given ?? {},
            early: withJob(partyMembers, 'erudito') ? 1 : 0,
        },
    }), survivalNow());
}

/** @returns {import('../game-engine/campaign/patronage.js').Debt|null} */
export function getDebt() {
    return readDebt(chat_metadata?.[DEBT_KEY]);
}

/**
 * Alguien paga lo que falta de la semana, a cambio de un favor.
 *
 * @param {number} shortfall
 * @returns {boolean} Si ha pagado alguien.
 */
function takePatronage(shortfall) {
    if (!chat_metadata || getDebt()) return false;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const offer = offerPatronage({
        shortfall, factions: getCurrentWorldFactions(), here: currentLocationName, today,
    });
    if (!offer) return false;

    const holder = partyMembers.find(m => (Number(m.hp) || 0) > 0) ?? partyMembers[0];
    if (!holder) return false;
    holder.gold = (Number(holder.gold) || 0) + offer.debt.amount;

    chat_metadata[DEBT_KEY] = offer.debt;
    if (offer.contract) chat_metadata[BOARD_KEY] = [offer.contract, ...(chat_metadata[BOARD_KEY] ?? [])];
    saveMetadata();
    savePartyState();

    noteDeed(`${offer.debt.patronName} ${saysWith(offer.debt.patronName, 'pagó', 'pagaron')} vuestra cuenta de la semana.`);
    void postForModel(`🤝 [CAMPAÑA] ${offer.line}`);
    toastr.info(offer.line, 'Alguien paga por vosotros', { timeOut: 15000 });
    return true;
}

/**
 * Llega el dia y la deuda sigue ahi: vienen a cobrar.
 */
function settleDueDebt() {
    const debt = getDebt();
    if (!debt) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = debtDue({ debt, today, purse: partyPurse() });
    if (!due.due) return;

    payFromParty(due.take);
    if (due.debt) chat_metadata[DEBT_KEY] = due.debt;
    else delete chat_metadata[DEBT_KEY];
    // El favor sin hacer ya no esta en el tablon: ahora quieren oro.
    if (debt.contractId) {
        chat_metadata[BOARD_KEY] = (chat_metadata[BOARD_KEY] ?? [])
            .filter((/** @type {any} */ c) => String(c?.id) !== debt.contractId);
    }
    saveMetadata();
    savePartyState();

    if (due.standing && debt.patron) void shiftFactionStanding(debt.patron, due.standing);
    if (debt.contractId) noteDeed(`Dejasteis sin hacer el favor que debíais a ${debt.patronName}.`);
    void postForModel(`💸 [CAMPAÑA] ${due.line}`);
    toastr.warning(due.line, 'Vienen a cobrar', { timeOut: 15000 });
}

/** @returns {any} */
export function getCampaignCalendar() {
    return campaign.getCalendar();
}
/** @returns {any} */
export function getCampaignBonds() {
    return campaign.getBonds();
}
/** @param {any} calendar @param {any} bonds */
export function saveCampaignState(calendar, bonds) {
    return campaign.save(calendar, bonds);
}
// El reloj del Modo Juego lee lo mismo que la pestana de Campana, asi que pasar el
// tiempo tiene que redibujarlo: sin esto el dia cambiaba y la cabecera no se enteraba.
export function advanceCampaignSlot() {
    const result = campaign.advanceSlot();
    if (isShellOpen()) refreshGameShell();
    return result;
}

/** @returns {number} */
export function campaignDay() {
    return Math.max(0, Math.floor(Number(getCampaignCalendar()?.day) || 0));
}

export function advanceCampaignDay() {
    const result = campaign.advanceDay();
    if (isShellOpen()) refreshGameShell();
    return result;
}

/** @param {string} characterId @param {string} eventType */
export function recordCampaignBondEvent(characterId, eventType) {
    const result = campaign.recordBond(characterId, eventType);
    // Idea 30: quien llega a vínculo 3 te pide lo suyo.
    offerPersonalQuests();
    if (isShellOpen()) refreshGameShell();
    return result;
}

export function getCurrentSlotLabel() {
    return campaign.getSlotLabel();
}
/** @param {'corto'|'largo'} kind @returns {Promise<string>} */
export async function takeRest(kind) {
    const result = await campaign.rest(kind);
    // Z4: de noche pasan cosas.
    if (kind === 'largo') playSucesos('descanso');
    // Idea 41: con un sanador en el grupo, un descanso corto cura algo mas.
    const healer = kind === 'corto' ? withJob(partyMembers, 'sanador') : null;
    if (healer) {
        for (const member of partyMembers.filter(m => (Number(m.hp) || 0) > 0)) {
            member.hp = Math.min(Number(member.maxHp) || 1, (Number(member.hp) || 0) + rollDiceDetailed('1d6', 6).total);
        }
        savePartyState();
        postCombatNarration(`🩹 [CAMPAÑA] ${healer.name} cura heridas mientras descansáis.`);
    }
    if (isShellOpen()) refreshGameShell();
    return result;
}
export function getCampaignMap() {
    return campaign.getMap();
}
/** @param {string} locationName */
export function markLocationComplete(locationName) {
    return campaign.markLocationComplete(locationName);
}

/** Draws the campaign tab, if it is the one on screen. */
export function renderCampaignTab() {
    const container = $('#campaign_panel_row');
    if (container.length === 0) return;

    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = Number(chat_metadata?.[BILL_DUE_KEY]);

    renderCampaignPanel(container, {
        calendar: getCampaignCalendar(),
        bonds: getCampaignBonds(),
        party: partyMembers,
        // Sin nadie en el grupo no hay cuenta que pasar, y un panel de ceros estorba.
        // R1: sin la cuenta (letra b) no hay cuenta que enseñar.
        bill: partyMembers.length > 0 && hasLetter(survivalNow(), 'b') ? weeklyBill(partyMembers, { rules: currentUpkeepRules() }) : null,
        daysToBill: Number.isFinite(due) ? Math.max(0, due - today) : 0,
        // Una cuenta que sube sin decir por que es un impuesto; una que dice «han cerrado
        // el paso del norte» es una razon para ir a abrirlo.
        market: describeMarket(currentMarket()),
        // Como esta cada uno: solo aparece quien tiene algo que contar.
        needs: hasLetter(survivalNow(), 'd') ? partyMembers
            .map(member => ({ name: member.name, said: describeNeeds(member) }))
            .filter(entry => entry.said) : [],
        // Lo que se mueve ahi fuera sin ti. Sin facciones escritas, la lista sale vacia
        // y el panel queda como estaba.
        world: hasLetter(survivalNow(), 'c') ? describeWorldFactions() : [],
        onAdvanceSlot: advanceCampaignSlot,
        onAdvanceDay: advanceCampaignDay,
        onShortRest: () => { void takeRest('corto'); },
        onLongRest: () => { void takeRest('largo'); },
        onRecordEvent: recordCampaignBondEvent,
    });
}

/**
 * La cuenta de la semana, dicha antes de que venza.
 *
 * Es la mitad del valor de todo esto: una factura que te sorprende es un impuesto, y una
 * que ves venir es una decision. Por eso se puede preguntar cuando quieras y no aparece
 * solo el dia del cobro.
 *
 * @returns {string}
 */
export function showWeeklyBill() {
    const rules = getActiveRuleset();
    // R1: en un modo sin la cuenta (letra b) no hay nada que pagar, y se dice.
    if (!hasLetter(rules?.survival ?? null, 'b')) {
        const said = `En este modo no hay cuenta semanal: ni sueldos, ni posada, ni comida que pagar. ${describeGameMode(rules?.survival ?? null)}.`;
        postCombatNarration(`📒 [CAMPAÑA] ${said}`);
        toastr.info(said, 'La cuenta');
        return said;
    }
    // Los mismos precios que se cobran el viernes: con el gremio y el mercado encima. Leer
    // los de la campana a pelo ensenaba una cuenta y cobraba otra.
    const bill = weeklyBill(partyMembers, { rules: currentUpkeepRules() });

    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const due = Number(chat_metadata?.[BILL_DUE_KEY]);
    const daysLeft = Number.isFinite(due) ? Math.max(0, due - today) : 0;

    const lines = describeBill(bill, daysLeft);
    const debt = describeDebt(getDebt(), today);
    if (debt) lines.push(debt);
    lines.push(describeSurvival(rules?.survival ?? null));
    lines.push(describeGameMode(rules?.survival ?? null));
    lines.push(describeMode(rules?.companions ?? null));

    postCombatNarration(`📒 [CAMPAÑA] ${lines.join('\n')}`);
    if (bill.covered) toastr.info(lines.join('\n'), 'La cuenta', { timeOut: 12000 });
    else toastr.warning(lines.join('\n'), 'La cuenta no sale', { timeOut: 15000 });

    return lines.join('\n');
}
