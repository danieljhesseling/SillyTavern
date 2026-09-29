/**
 * El mundo que crece mientras se juega: explorar, la gente que falta, los hechos que se
 * apuntan, lo que le pasa a la gente y lo que el mundo sabe del grupo. Y la fila para escribir
 * el archivo del mundo sin pisarse.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import {
    chat, chat_metadata, saveMetadata, setExtensionPrompt, extension_prompt_types, extension_prompt_roles,
} from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldEnemies, loadWorldInfo, saveWorldInfo, createWorldInfoEntry,
    refreshWorldMapGlobals, METADATA_KEY,
} from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { breedBand } from '../game-engine/compendio/bestiary.js';
import { writePerson as writePersonFromCompendium } from '../game-engine/compendio/people.js';
import { nextRandom } from './combat-rules.js';
import { chronicleMemory } from '../game-engine/campaign/world-echoes.js';
import { magicLine } from '../game-engine/rules/grimoire.js';
import { neighboursOf, driftOf, describeFate } from '../game-engine/world/people-fate.js';
import { toneNote } from '../game-engine/campaign/scene-tone.js';
import { describeAttitude, readAttitudes } from '../game-engine/campaign/attitudes.js';
import { readSummaries } from '../game-engine/campaign/act-summary.js';
import { narratorAskNote } from '../game-engine/campaign/talk.js';
import { recordDeed, proposeDeed, worldMemoryBlock } from '../game-engine/campaign/world-memory.js';
import { chronicleOf } from '../game-engine/campaign/chronicle.js';
import { focusOf, describeFocus, actOf, hasEnded } from '../game-engine/campaign/plot.js';
import { chooseSource } from '../game-engine/campaign/mix.js';
import { canExplore, discoverPlace, boardForPlace, peopleWanted, takeProposal } from '../game-engine/world/growth.js';
import { lengthNote } from '../game-engine/campaign/narration.js';
import { memoryLines } from '../game-engine/campaign/memories.js';
import { bodyLine } from '../game-engine/campaign/body.js';
import { promptKey } from '../game-engine/cost/prompt-order.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import {
    ACT_SUMMARIES_KEY, ATTITUDES_KEY, CLIMATE_KEY, DEEDS_KEY, EXPLORED_KEY, LENGTH_KEY, MEMORIES_KEY,
    PLOT_STATE_KEY, PROPOSALS_KEY, TONE_KEY,
} from './keys.js';
import { combatEncounter, currentLocationName, narratorTurn, partyMembers } from './state.js';
import { campaignCompendium, currentSeason, ensureWorldData, lastMix, lastWorldNpcs, seedOfWorld } from './world.js';
import { bannerOf, getCurrentWorldFactions } from './factions.js';
import { advanceCampaignSlot, campaignDay, getCampaignCalendar, getCurrentSlotLabel, getDebt } from './time.js';
import { getPlot } from './plot.js';
import { localMemory } from './main.js';
import { postCombatNarration, postForModel, saverOn } from './narration.js';
import { speakingNote } from './talk.js';

/**
 * Apuntar un hecho, con el dia de hoy.
 *
 * @param {string} text
 */
export function noteDeed(text) {
    if (!chat_metadata) return;
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    chat_metadata[DEEDS_KEY] = recordDeed(chat_metadata[DEEDS_KEY], today, text);
    saveMetadata();
}

/**
 * U1 del pegamento: un hecho que propone el narrador. El motor decide si se apunta: una
 * frase, que no esté ya, y una al día. Sustituye a las banderas que ponía por su cuenta.
 *
 * @param {string} proposal
 * @returns {string} Lo que se le contesta al narrador.
 */
export function proposeFact(proposal) {
    if (!chat_metadata) return 'No hay partida.';
    const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
    const result = proposeDeed(chat_metadata[DEEDS_KEY], today, proposal);
    if (!result.ok) return `No se apunta: ${result.reason}`;
    chat_metadata[DEEDS_KEY] = result.deeds;
    saveMetadata();
    refreshWorldMemoryPrompt();
    postCombatNarration(`📝 [MUNDO] El mundo lo recordará: ${result.deeds[result.deeds.length - 1].text}`);
    return 'Apuntado. Sigue con la escena.';
}

/**
 * De donde sale lo siguiente, segun el acto de la partida (M7).
 *
 * @param {{written?: boolean, chat?: boolean}} have
 * @returns {'written'|'seed'|'chat'}
 */
export function mixSource(have) {
    const plot = getPlot();
    const state = chat_metadata?.[PLOT_STATE_KEY];
    return chooseSource({
        act: actOf(plot, state),
        ended: plot ? hasEnded(plot, state) : false,
        mix: lastMix,
        roll: nextRandom(),
        have,
    });
}

/**
 * Escribir en el Lorebook del mundo la gente que falta en un sitio (G3).
 *
 * @param {any} data El mundo, ya leido: se escribe en el y se guarda fuera.
 * @param {string} worldName
 * @param {any} compendium
 * @param {string} placeName
 * @param {number} howMany
 * @param {() => number} random
 * @returns {any[]} Los que se han escrito.
 */
function writePeopleInto(data, worldName, compendium, placeName, howMany, random) {
    /** @type {any[]} */
    const made = [];
    for (let i = 0; i < howMany; i++) {
        const person = writePersonFromCompendium({
            compendium, random, locationName: placeName, banner: bannerOf(placeName, data?.metadata?.factions),
        });
        if (!person) break;
        const entry = createWorldInfoEntry(worldName, data);
        if (!entry) break;
        entry.comment = person.name;
        entry.key = person.keys;
        entry.content = [person.backstory, person.personality].filter(Boolean).join(' ');
        entry.group = 'Characters';
        entry.dndData = {
            entityType: 'npc',
            name: person.name,
            title: person.title,
            factions: person.factions,
            mapPosition: { locationName: placeName, gridX: 0, gridY: 0 },
            generated: true,
        };
        made.push(person);
    }
    return made;
}

/**
 * Explorar los alrededores: descubrir un sitio nuevo, con su tablero, sus bichos y su gente.
 *
 * Gasta un bloque del dia. Con nombre, va a buscar lo que propuso el narrador (G6).
 *
 * @param {string} [name]
 * @returns {Promise<string>}
 */
export async function exploreHere(name = '') {
    await ensureWorldData();
    if (combatEncounter.active) {
        toastr.warning('No en mitad de un combate.');
        return '';
    }
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    const data = worldName ? await loadWorldInfo(worldName) : null;
    if (!data?.metadata || !currentLocationName) {
        toastr.warning('Primero hay que estar en algún sitio.');
        return '';
    }
    const places = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
    const hidden = Array.isArray(data.metadata.hiddenLocations) ? data.metadata.hiddenLocations : [];
    const { proposal, proposals } = takeProposal(chat_metadata[PROPOSALS_KEY], name);
    if (name && !proposal) {
        toastr.warning(`Nadie ha hablado de «${name}».`);
        return '';
    }
    if (!canExplore(places, hidden)) {
        toastr.info('Por aquí ya no queda nada que no conozcáis.', 'Explorar');
        return '';
    }

    const compendium = await campaignCompendium();
    const count = Math.max(0, Number(chat_metadata[EXPLORED_KEY]) || 0);
    const random = createSeededRandom(derive(seedOfWorld(data.metadata), 'explorar', currentLocationName, proposal?.name || String(count)));
    const place = discoverPlace({
        compendium, locations: [...places, ...hidden], here: currentLocationName, random,
        name: proposal?.name ?? '', note: proposal?.note ?? '', source: proposal ? 'chat' : 'seed',
    });
    if (!place) {
        toastr.info('No encontráis nada que no conozcáis ya.', 'Explorar');
        return '';
    }

    // G4: lo que vive ahi, criado para su bioma y guardado en el bestiario del mundo.
    const bred = compendium.has('bestiario')
        ? breedBand({ compendium, howMany: 2, cr: 0.5, biome: place.biome, random, season: currentSeason() })
        : [];
    for (const monster of bred) {
        const entry = createWorldInfoEntry(worldName, data);
        if (!entry) continue;
        entry.comment = monster.name;
        entry.key = [monster.name];
        entry.content = monster.description || monster.name;
        entry.group = 'Monsters';
        entry.dndData = {
            entityType: 'monster', name: monster.name, hp: monster.hp, maxHp: monster.hp,
            armorClass: monster.armorClass, cr: monster.cr, speed: monster.speed,
            profile: monster.profile, attackRangeFeet: monster.attackRangeFeet, abilities: monster.abilities ?? [],
            ...(monster.domable !== undefined ? { domable: monster.domable } : {}),
            generated: true,
        };
    }
    const bestiaryNames = bred.length > 0
        ? bred.map(m => m.name)
        : getCurrentWorldEnemies().map((/** @type {any} */ e) => String(e?.name || '')).filter(Boolean);

    // G2: su tablero, de su forma.
    place.boards = [boardForPlace({ place, random, bestiary: bestiaryNames, partySize: partyMembers.length })];
    // G3: su gente.
    const people = writePeopleInto(data, worldName, compendium, place.name, 2, random);

    data.metadata.locationMaps = [...places, place];
    await saveWorldInfo(worldName, data, true);
    await refreshWorldMapGlobals(worldName);

    chat_metadata[EXPLORED_KEY] = count + 1;
    chat_metadata[PROPOSALS_KEY] = proposals;
    saveMetadata();
    advanceCampaignSlot();

    noteDeed(`Descubristeis ${place.name}.`);
    const who = people.map(p => `${p.name}${p.title ? `, ${String(p.title).toLowerCase()}` : ''}`).join(' y ');
    await postForModel(`[EXPLORAR] Explorando los alrededores de ${currentLocationName}, el grupo encuentra ${place.name}. `
        + `${place.description}${who ? ` Allí viven ${who}.` : ''} `
        + 'Cuéntalo en un párrafo. No inventes nada que no esté aquí.');
    toastr.success(place.name, 'Un sitio nuevo en el mapa');
    if (isShellOpen()) refreshGameShell();
    return place.name;
}

/**
 * Al llegar a un sitio con poca gente, se escribe la que falta (G3).
 *
 * En un mundo escrito, la mezcla decide si le toca a lo generado: un sitio que ya tiene a
 * alguien escrito solo se completa en la parte que la curva deja a la semilla. Un sitio
 * vacio se completa siempre, porque llegar tiene que ser llegar a alguna parte.
 *
 * @param {string} placeName
 * @returns {Promise<void>}
 */
export function populatePlace(placeName) {
    return worldWrite(() => populatePlaceNow(placeName));
}

/**
 * @param {string} placeName
 * @returns {Promise<void>}
 */
async function populatePlaceNow(placeName) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || !placeName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const here = Object.values(data.entries ?? {}).filter((/** @type {any} */ e) =>
            e?.dndData?.entityType === 'npc'
            && String(e.dndData?.mapPosition?.locationName || '').toLowerCase() === placeName.toLowerCase()).length;
        const wanted = peopleWanted(here);
        if (wanted === 0) return;
        if (here > 0 && mixSource({ written: true }) === 'written') return;

        const compendium = await campaignCompendium();
        const random = createSeededRandom(derive(seedOfWorld(data.metadata), 'gente', placeName));
        const people = writePeopleInto(data, worldName, compendium, placeName, wanted, random);
        if (people.length === 0) return;
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        const who = people.map(p => `${p.name}${p.title ? `, ${String(p.title).toLowerCase()}` : ''}`).join(' y ');
        const plural = people.length > 1;
        await postForModel(`[GENTE] En ${placeName} vive${plural ? 'n' : ''} ${who}. `
            + `Que aparezca${plural ? 'n' : ''} con naturalidad cuando toque: el grupo no ${plural ? 'los' : 'lo'} conoce todavía.`);
    } catch (error) {
        console.error('[party] no se pudo poblar el sitio', error);
    }
}

/** Las escrituras del archivo del mundo, en fila (ver worldWrite). */
let worldWriteQueue = Promise.resolve();

/**
 * Hacer algo con el archivo del mundo sin pisar a otro que lo este haciendo.
 *
 * Llegar a un sitio dispara a la vez el hilo (revela sitios), la gente (G3) y las
 * reputaciones. Cada uno lee el archivo entero, lo cambia y lo guarda: sin fila, el ultimo
 * en guardar borraba lo de los demas, y la cueva que el hito acababa de revelar no salia.
 *
 * @param {() => Promise<void>} task
 * @returns {Promise<void>}
 */
export function worldWrite(task) {
    const run = worldWriteQueue.then(task, task);
    worldWriteQueue = run.catch(() => undefined);
    return run;
}

/**
 * Idea 87: los que el hilo necesita, que ni se mudan ni mueren por azar.
 *
 * @returns {string[]}
 */
export function plotPeople() {
    const plot = getPlot();
    /** @type {string[]} */
    const names = [];
    for (const milestone of plot?.milestones ?? []) {
        const asks = /** @type {any} */ (milestone.asks);
        for (const ask of [asks, ...(Array.isArray(asks?.options) ? asks.options : [])]) {
            if (ask?.npc) names.push(String(ask.npc));
        }
    }
    return names;
}

/**
 * Idea 87: apuntar en el mundo lo que le ha pasado a alguien. Muerto sigue en el mundo
 * (el narrador tiene que saberlo), pero ya no atiende; mudado, vive en otro sitio.
 *
 * @param {any} data
 * @param {import('../game-engine/world/people-fate.js').Fate} fate
 */
export function applyFate(data, fate) {
    const entry = Object.values(data?.entries ?? {})
        .find((/** @type {any} */ e) => e?.dndData?.entityType === 'npc' && String(e.dndData.name || e.comment) === fate.name);
    if (!entry) return;
    const npc = lastWorldNpcs.find(n => n.name === fate.name);
    if (fate.kind === 'muere') {
        entry.dndData.dead = true;
        entry.content = `${String(entry.content || '')}\n(Murió en ${fate.from}${fate.why ? ` ${fate.why}` : ''}.)`.trim();
        if (npc) npc.dead = true;
    } else {
        entry.dndData.mapPosition = { ...(entry.dndData.mapPosition ?? {}), locationName: fate.to };
        if (npc) npc.where = fate.to;
    }
}

/**
 * Idea 87: una mudanza sin guerra, una vez a la semana como mucho.
 *
 * @returns {Promise<void>}
 */
export async function driftPeople() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    const fate = driftOf({
        npcs: lastWorldNpcs.filter(n => !n.dead),
        neighbours: neighboursOf(getCurrentWorldLocationMaps()),
        keep: plotPeople(),
        random: createSeededRandom(derive(worldName, 'mudanza', String(campaignDay()))),
    });
    if (!fate) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        applyFate(data, fate);
        await saveWorldInfo(worldName, data, true);
    });
    const line = describeFate(fate);
    toastr.info(line, 'Se sabe algo', { timeOut: 8000 });
    void postForModel(`[MUNDO] ${line} Cuéntalo como algo que se comenta, en una frase. No inventes nada más.`);
}

/**
 * El bloque de lo que el mundo sabe del grupo, puesto al dia antes de cada turno.
 *
 * Vacio cuando no hay nada que contar: un bloque vacio no cuesta ni un token.
 */
export function refreshWorldMemoryPrompt() {
    const key = promptKey('quest', 'memory', 'ctx');
    const block = chat_metadata ? worldMemoryBlock({
        deeds: chat_metadata[DEEDS_KEY],
        factions: getCurrentWorldFactions(),
        debt: getDebt(),
        focus: describeFocus(focusOf(getPlot(), chat_metadata[PLOT_STATE_KEY], campaignDay())),
        today: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        memories: memoryLines(chat_metadata[MEMORIES_KEY], Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1))),
        here: localMemory(),
        // Idea 148: en modo ahorro, lo justo.
        compact: saverOn(),
    }) : '';
    // Idea 149: el largo elegido en la partida manda sobre el de la ficha.
    setExtensionPrompt(promptKey('rules', 'length', 'ctx'), chat_metadata ? lengthNote(String(chat_metadata[LENGTH_KEY] ?? '')) : '',
        extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
    // Idea 143: lo que pasó en los actos cerrados. Idea 140: cómo os mira la gente de aquí.
    const acts = chat_metadata ? readSummaries(chat_metadata[ACT_SUMMARIES_KEY]).map(s => s.text) : [];
    const moods = chat_metadata ? Object.entries(readAttitudes(chat_metadata[ATTITUDES_KEY]).values)
        .filter(([name]) => lastWorldNpcs.some(n => n.name === name && n.where.toLowerCase() === String(currentLocationName).toLowerCase()))
        .map(([name, value]) => `${name} os mira de forma ${describeAttitude(value)}.`) : [];
    // R4: lo que el grupo sabe lanzar, y que no existe otra magia. Solo si alguien la hace.
    const magic = magicLine(partyMembers);
    // R9: lo último que pasó de verdad, de la crónica. En modo ahorro, no.
    const lately = saverOn() ? '' : chronicleMemory(chronicleOf(Array.isArray(chat) ? chat : []));
    const full = [block, acts.length > 0 ? `Lo que pasó antes: ${acts.join(' ')}` : '', moods.join(' '), lately, magic].filter(Boolean).join('\n');
    setExtensionPrompt(key, full, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);

    // C1: como esta el grupo. Va con lo que cambia en cada turno, al final del prompt. En
    // modo ahorro no va: es lo primero que se puede quitar sin que la historia lo note.
    const body = chat_metadata && !saverOn() ? bodyLine({
        party: partyMembers,
        day: Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1)),
        slot: getCurrentSlotLabel(),
        climate: String(chat_metadata[CLIMATE_KEY] || ''),
        place: currentLocationName,
    }) : '';
    setExtensionPrompt(promptKey('combat', 'body', 'ctx'), body, extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);

    // Idea 142: el tono de la escena, una frase con lo que cambia en cada turno. Vacío si no
    // toca ninguno: un bloque vacío no cuesta nada.
    const tone = chat_metadata ? toneNote({ chosen: String(chat_metadata[TONE_KEY] || ''), fighting: combatEncounter.active }) : '';
    // Y con quién se está hablando: que conteste esa persona, no el narrador. Va con lo que
    // cambia en cada turno, al final.
    setExtensionPrompt(promptKey('combat', 'tone', 'ctx'), [tone, narratorTurn ? narratorAskNote() : speakingNote()].filter(Boolean).join('\n'),
        extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
}
