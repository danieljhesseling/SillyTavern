/**
 * El mundo abierto, leído: sus datos (facciones, gente, rumores, tablón) guardados una vez por
 * mundo, sus tableros, su compendio y sus reglas, la estación y el tiempo de hoy, y dónde está
 * el grupo.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import {
    getCurrentWorldLocationMaps, getCurrentWorldBoards, getCurrentWorldEnemies, loadWorldInfo, METADATA_KEY,
} from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { getCompendium } from '../game-engine/compendio/browser.js';
import { derive } from '../game-engine/campaign/seed.js';
import { rollWeather } from '../game-engine/world/travel.js';
import { causesOf } from '../game-engine/compendio/ailments.js';
import { createCompendium, onlyPicked } from '../game-engine/compendio/compendio.js';
import { mergeWorldRows } from '../game-engine/campaign/world-rows.js';
import { readFactions } from '../game-engine/campaign/factions.js';
import { levelPlanOf } from '../game-engine/combat/level-adjust.js';
import { seasonOf, seasonClimates, openInSeason, readSeason } from '../game-engine/world/seasons.js';
import { readHub, isHubWorld, hubHomeOf, hubDay, HUB_CAMPAIGN_KEY, HUB_LEVELS_KEY } from '../game-engine/campaign/hub.js';
import { markVisited } from '../game-engine/campaign/text-map.js';
import { readWrittenContracts } from '../game-engine/campaign/written-contracts.js';
import { readRumors } from '../game-engine/campaign/rumors.js';
import { readDialogues } from '../game-engine/campaign/dialogues.js';
import {
    GUILD_MEMORY_KEY, guildGreeting, guildRumors, readGuildMemory, visitorRows,
} from '../game-engine/campaign/guild-memory.js';
import {
    WORLD_MARKS_KEY, addMark, markRumors, reactionsAt, refusal, rememberedGreeting, rememberedPrice,
} from '../game-engine/campaign/world-marks.js';
import { packOfWorld } from '../game-engine/ui/pixel-art.js';
import {
    planRulesetChange, readRememberedRuleset, rememberRuleset, setActiveRuleset, needsReload,
} from '../game-engine/rules/ruleset.js';
import { VISITED_KEY, WEATHER_TODAY_KEY } from './keys.js';
import {
    currentBoardName, currentLocationName, currentWorldFactions, setCurrentBoardName, setCurrentLocationName,
    setCurrentWorldFactions, setWorldItemCatalogue,
} from './state.js';
import { campaignDay } from './time.js';

export function saveCurrentLocation() {
    if (chat_metadata) {
        chat_metadata['currentLocation'] = currentLocationName;
        // Idea 69: el mapa sabe dónde habéis estado.
        if (currentLocationName) chat_metadata[VISITED_KEY] = markVisited(chat_metadata[VISITED_KEY], currentLocationName);
        saveMetadata();
    }
}

export function saveCurrentBoard() {
    if (chat_metadata) {
        chat_metadata['currentBoard'] = currentBoardName;
        saveMetadata();
    }
}

export function loadCurrentLocation() {
    setCurrentLocationName((chat_metadata && chat_metadata['currentLocation']) || '');
    setCurrentBoardName((chat_metadata && chat_metadata['currentBoard']) || '');
    // Y quien se mueve ahi fuera, que el panel de campana dibuja sin poder esperar.
    void reloadWorldFactions();
}

/** De que mundo son los datos leidos. */
export let loadedWorldName = '';

/**
 * Releer los datos del mundo si el abierto ya no es el que se leyo.
 *
 * Al crear una campana, el chat cambia **antes** de saber cual es su mundo: la lectura de
 * ese momento no encuentra nada, y nadie volvia a leer. Sin esto, un mundo escrito entero
 * se jugaba sin sus encargos, sin sus rumores y sin sus facciones hasta recargar.
 *
 * @returns {Promise<void>}
 */
export async function ensureWorldData() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (worldName && worldName !== loadedWorldName) await reloadWorldFactions();
}

/** Idea 74: la estación en la que empezó el mundo; vacía es la de siempre (otoño). */
export let lastWorldSeason = '';

/** R5: el género del mundo, para ofrecer la mascota que le pega. */
export let lastWorldGenre = '';

/**
 * J4 de ROADMAP_SIN_CONEXION: si este mundo es un gremio, lo guardado de él; si es una campaña
 * empezada desde uno, de cuál. Las dos cosas hacen que la partida sea sin conexión.
 *
 * @type {import('../game-engine/campaign/hub.js').Hub|null}
 */
export let lastHub = null;

/** @type {string} */
export let lastHubHome = '';

/**
 * J4.6: para qué nivel es la campaña del tablón y en qué acto va cada tablero. Nulo fuera
 * de una campaña del tablón, o si su fila no dice para qué nivel es.
 *
 * @type {import('../game-engine/combat/level-adjust.js').LevelPlan|null}
 */
export let lastLevelPlan = null;

/**
 * J4.6: las filas del tablón (`mundos.json`), leídas una vez por sesión. De ahí sale el
 * tramo de niveles de cada campaña: escrito en un solo sitio, el mismo que lee su tarjeta.
 *
 * @type {Promise<any[]>|null}
 */
let boardCampaignRows = null;

/**
 * @param {string} id La campaña, de `mundos.json`.
 * @returns {Promise<any>} Su tramo de niveles, tal cual; nada si no lo dice.
 */
async function campaignLevelsOf(id) {
    if (!id) return null;
    boardCampaignRows = boardCampaignRows ?? fetch('/mundos/mundos.json')
        .then(response => response.json())
        .then(json => (Array.isArray(json?.worlds) ? json.worlds : []))
        .catch(() => {
            // Sin tablón no se ajusta nada; la próxima vez se vuelve a probar.
            boardCampaignRows = null;
            return [];
        });
    return (await boardCampaignRows).find(w => String(w?.id) === id)?.levels ?? null;
}

/**
 * Idea 74: la estación de hoy.
 *
 * @returns {string}
 */
export function currentSeason() {
    return seasonOf(Math.max(1, campaignDay()), lastWorldSeason || undefined);
}

/**
 * Idea 97: los bichos del mundo que andan por aquí en esta estación.
 *
 * @returns {any[]}
 */
export function enemiesInSeason() {
    const season = currentSeason();
    return getCurrentWorldEnemies().filter((/** @type {any} */ e) => openInSeason(e?.seasons, season));
}

/** @returns {Promise<any[]>} */
export async function reloadWorldFactions() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        setCurrentWorldFactions([]);
        lastHub = null;
        lastHubHome = '';
        lastGuildMemory = null;
        lastLevelPlan = null;
        lastDialogues = [];
        lastPack = '';
        return currentWorldFactions;
    }
    try {
        const data = await loadWorldInfo(worldName);
        loadedWorldName = worldName;
        // J4: el gremio y sus campañas.
        lastHub = isHubWorld(data?.metadata) ? readHub(data.metadata.hub) : null;
        lastHubHome = hubHomeOf(data?.metadata);
        // J11.4: y lo que el gremio recuerda, para cómo os recibe.
        lastGuildMemory = lastHub ? (data?.metadata?.[GUILD_MEMORY_KEY] ?? null) : null;
        setCurrentWorldFactions(readFactions(data?.metadata?.factions));
        // Y los mandos del tablon, que se leen en el mismo sitio y para lo mismo.
        lastBoardRules = data?.metadata?.boardRules ?? null;
        lastWrittenQuests = Array.isArray(data?.metadata?.writtenQuests)
            ? data.metadata.writtenQuests : [];
        // Lo que trae un mundo escrito entero: sus encargos, sus rumores y su mezcla.
        lastWrittenContracts = readWrittenContracts(data?.metadata?.writtenContracts);
        lastRumors = readRumors(data?.metadata?.rumors);
        // J8 y J9.2: las charlas con ramas que trae el paquete, y de qué paquete es (para las caras).
        lastDialogues = readDialogues(data?.metadata?.dialogues);
        lastPack = packOfWorld(data?.metadata);
        lastWorldSeason = readSeason(data?.metadata?.season);
        lastWorldGenre = String(data?.metadata?.genre ?? '');
        lastWorldNpcs = Object.values(data?.entries ?? {})
            .filter((/** @type {any} */ e) => e?.dndData?.entityType === 'npc')
            .map((/** @type {any} */ e) => ({
                name: String(e.dndData?.name || e.comment || ''),
                where: String(e.dndData?.mapPosition?.locationName || ''),
                service: String(e.dndData?.service || ''),
                // Z2 de ROADMAP_SIN_TOKENS: de qué se puede hablar con él sin modelo.
                trade: String(e.dndData?.trade || e.dndData?.title || ''),
                wants: String(e.dndData?.wants || ''),
                knows: String(e.dndData?.knows || ''),
                voice: String(e.dndData?.voice || ''),
                // Idea 110: lo que esconde. No va al narrador hasta que se sonsaca.
                secret: String(e.dndData?.secret || ''),
                // Idea 59: la lengua que habla; vacío es la común.
                language: String(e.dndData?.language || ''),
                // Idea 87: quien ha muerto sigue en el mundo, pero ya no atiende.
                dead: Boolean(e.dndData?.dead),
            }));
        lastMix = data?.metadata?.mix ?? null;
        // Los confidentes, para reclutarlos en la posada (idea 26).
        lastConfidantEntries = Object.fromEntries(Object.entries(data?.entries ?? {})
            .filter(([, e]) => /** @type {any} */ (e)?.dndData?.confidant));
        // Y lo que este mundo dejo entrar de cada bateria.
        lastPicks = (data?.metadata?.picks && typeof data.metadata.picks === 'object')
            ? data.metadata.picks : null;
        // Y lo que escribio o retoco en el taller: su raza, su arma, su bicho.
        lastWorldRows = (data?.metadata?.worldRows && typeof data.metadata.worldRows === 'object')
            ? data.metadata.worldRows : null;
        // J4.6: para qué nivel es, si es una campaña del tablón. Lo último, porque espera a
        // leer el tablón: lo de arriba ya está puesto.
        // D-J22: una añadida por ti lo lleva apuntado en su mundo (J5.4); las del juego, en el tablón.
        lastLevelPlan = levelPlanOf(data?.metadata, data?.metadata?.[HUB_LEVELS_KEY]
            ?? await campaignLevelsOf(String(data?.metadata?.[HUB_CAMPAIGN_KEY] ?? '')));
    } catch (error) {
        console.error('[party] no se pudieron leer las facciones', error);
        setCurrentWorldFactions([]);
        lastLevelPlan = null;
    }
    return currentWorldFactions;
}

/**
 * Helper: resolve boards for a location, including legacy boardName fallback.
 * @param {any} loc
 */
export function getLocationBoards(loc) {
    if (!loc) return [];
    if (Array.isArray(loc.boards) && loc.boards.length) {
        return loc.boards;
    }
    if (loc.boardName) {
        const globalBoards = getCurrentWorldBoards();
        const found = globalBoards.filter(b => b.name === loc.boardName);
        if (found.length) {
            console.log('[party] getLocationBoards fallback to loc.boardName', { locName: loc.name, boardName: loc.boardName, found });
            return found;
        }
    }
    return [];
}

/**
 * Installs the rule pack the open campaign asks for.
 *
 * `dnd-system.js` binds its tables the moment it loads, so a pack that arrives later
 * cannot take effect until the page reloads. Rather than pretend otherwise, the pack is
 * remembered now — `ruleset.js` reads it back on the next load, before dnd-system runs —
 * and the player is told once, with the button that does it. Saying nothing would leave
 * someone editing weapons that the game is quietly ignoring.
 *
 * @param {string} worldName
 */
export async function applyCampaignRuleset(worldName) {
    if (!worldName) return;

    let worldPack = null;
    try {
        const data = await loadWorldInfo(worldName);
        worldPack = data?.metadata?.rulesetPack ?? null;
        setWorldItemCatalogue(Array.isArray(data?.metadata?.itemCatalogue) ? data.metadata.itemCatalogue : []);
    } catch (error) {
        console.error('[party] could not read the campaign rule pack', error);
        return;
    }

    const plan = planRulesetChange(worldPack, readRememberedRuleset());
    if (plan.action === 'none') return;

    if (plan.action === 'reject') {
        console.warn('[party] invalid campaign rule pack', plan.errors);
        toastr.error(plan.reason, 'Reglas de campaña', { timeOut: 12000 });
        return;
    }

    if (!rememberRuleset(plan.action === 'install' ? worldPack : null)) {
        toastr.warning(
            'No se pudieron guardar las reglas de esta campaña: el navegador bloquea el almacenamiento local.',
            'Reglas de campaña',
        );
        return;
    }

    // Applied now so anything reading the ruleset directly is already correct; the reload
    // is for the tables dnd-system froze at load.
    setActiveRuleset(plan.action === 'install' ? worldPack : null);
    // Si lo que cambia se lee al usarse (las habilidades de una campaña), no hay nada que
    // recargar: ir y volver del gremio no puede pedir recargar cada vez.
    if (!needsReload(plan.action === 'install' ? worldPack : null)) return;

    const toast = toastr.info(
        `${plan.reason} Recarga la página para aplicarlas.`,
        'Reglas de campaña',
        { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false },
    );
    $(toast).find('.toast-message').append(
        $('<button class="menu_button" style="margin-top:6px;"></button>')
            .text('Recargar ahora')
            .on('click', () => window.location.reload()),
    );
}

/**
 * La biblioteca de **esta** campana.
 *
 * La misma de siempre, menos lo que el mundo dejo fuera. Un mundo sin nada elegido la
 * recibe entera, que es como estaba antes de que el taller existiera.
 *
 * @returns {Promise<any>}
 */
export async function campaignCompendium() {
    const { compendium, batteries } = await getCompendium();
    if ((!lastPicks && !lastWorldRows) || !batteries) return compendium;
    const own = mergeWorldRows(batteries, lastWorldRows);
    return createCompendium(lastPicks ? onlyPicked(own, lastPicks) : own);
}

/** @type {any} */
export let lastBoardRules = null;
/** Lo que este mundo dejo entrar de cada bateria, o null si no eligio. */
/** @type {any} */
let lastPicks = null;
/** Las filas que este mundo escribio o retoco en el taller, por dominio, o null. */
/** @type {Record<string, any[]>|null} */
export let lastWorldRows = null;
/** @type {any[]} */
export let lastWrittenQuests = [];
/** @type {import('../game-engine/campaign/written-contracts.js').WrittenContract[]} */
export let lastWrittenContracts = [];
/** @type {import('../game-engine/campaign/rumors.js').Rumor[]} */
export let lastRumors = [];
/** J8: las charlas con ramas del mundo abierto, ya leídas (`readDialogues`). */
/** @type {import('../game-engine/campaign/dialogues.js').Dialogue[]} */
export let lastDialogues = [];
/** El paquete del mundo abierto (`gremio`, `1387`…), para los retratos y los escenarios; vacío si no es de ninguno. */
export let lastPack = '';
/** @type {any} */
export let lastMix = null;
/** J11.4: lo que el gremio recuerda de las campañas terminadas, si el mundo abierto es un gremio. */
/** @type {any} */
export let lastGuildMemory = null;
/** La gente del mundo: quien es, donde vive y que servicio atiende. */
/** @type {Array<{name: string, where: string, service: string, secret?: string, language?: string, dead?: boolean}>} */
export let lastWorldNpcs = [];
/** Las fichas de los confidentes del mundo, por uid. */
/** @type {Record<string, any>} */
export let lastConfidantEntries = {};

/** @returns {any|null} La localidad donde esta el grupo. */
export function hereLocation() {
    return getCurrentWorldLocationMaps().find((/** @type {any} */ l) => l?.name === currentLocationName) ?? null;
}

/**
 * Ideas 73 y 90: el tiempo de hoy aquí. Si se ha llegado hoy de viaje, el del último día del
 * camino; si no, el que toca con la semilla del mundo, del sitio y del día.
 *
 * @returns {string}
 */
export function weatherHere() {
    const today = Math.max(1, campaignDay());
    const known = chat_metadata?.[WEATHER_TODAY_KEY];
    if (known && Number(known.day) === today && String(known.place) === String(currentLocationName)) return String(known.weather || '');
    if (!lastCompendium?.has?.('mundo')) return '';
    const biome = String(hereLocation()?.biome || '');
    const climates = seasonClimates(lastCompendium.find('mundo', { kind: 'bioma', biome })[0]?.climates ?? [], currentSeason());
    const random = createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'tiempo', String(currentLocationName), String(today)));
    return String(rollWeather({ days: 1, table: lastCompendium.find('mundo', { kind: 'clima' }), climates, random })[0] ?? '');
}

/**
 * La gente del mundo por su nombre.
 *
 * @param {string} name
 * @returns {any|null}
 */
export function worldNpc(name) {
    const who = String(name ?? '').trim().toLowerCase();
    return lastWorldNpcs.find(n => n.name.toLowerCase() === who) ?? null;
}

/**
 * El compendio ya cargado, para lo que no puede esperar a una promesa.
 *
 * `applyFall` se llama desde dentro de una tirada de combate y no puede ser `async`: lo
 * que hay aqui es lo que ya se cargo antes, y si todavia no hay nada se usa la tabla del
 * motor. Aditivo, como todo lo demas.
 *
 * @type {any}
 */
export let lastCompendium = { has: () => false, find: () => [] };

// Se rellena en cuanto alguien pide el compendio por primera vez.
void getCompendium().then(({ compendium }) => {
    lastCompendium = compendium;
    const causes = causesOf(compendium);
    if (causes.length > 0) console.log(`[compendio] heridas por causa: ${causes.join(', ')}`);
});

/**
 * La semilla del mundo abierto, o cadena vacia si es de antes de que existieran.
 *
 * @param {any} metadata
 * @returns {string}
 */
export function seedOfWorld(metadata) {
    return String(metadata?.seed || '');
}

/**
 * El bioma del sitio donde esta el grupo.
 *
 * Es lo que hace que el pantano no de lobos de nieve. Estaba leyendose de
 * `metadata.biome`, que no existe: el bioma es de **cada localidad**, porque un mundo
 * tiene pantano y montana a la vez.
 *
 * @param {any} metadata
 * @returns {string}
 */
export function biomeHere(metadata) {
    const here = (metadata?.locationMaps ?? [])
        .find((/** @type {any} */ l) => String(l?.name || '') === currentLocationName);
    return String(here?.biome || '');
}

// ---------------------------------------------------------------------------------------
// J11.3 y J11.4: el mundo se acuerda de lo que hicisteis, y el gremio de cómo acabó cada campaña.

/**
 * J11.3: cómo reacciona la gente de un pueblo a lo que hicisteis allí (`compendio/ecos.json`).
 *
 * @returns {any[]}
 */
export function echoRows() {
    return lastCompendium?.has?.('ecos') ? lastCompendium.find('ecos', {}) : [];
}

/**
 * J11.3: dejar huella de algo que se ha hecho aquí (robar, huir de la guardia…). Se olvida con
 * el tiempo, como dice su fila de `ecos.json`.
 *
 * @param {string} deed Uno de `DEEDS` (`world-marks.js`).
 * @param {{place?: string, who?: string, town?: string}} [where] El sitio de dentro (`tienda`…), quién
 *   lo vio y el pueblo, si no es este (los guardias os paran al llegar; un caso es de su sitio).
 * @returns {void}
 */
export function leaveMark(deed, { place = '', who = '', town = '' } = {}) {
    const where = String(town || currentLocationName || '').trim();
    if (!chat_metadata || !where) return;
    chat_metadata[WORLD_MARKS_KEY] = addMark(chat_metadata[WORLD_MARKS_KEY], {
        deed, town: where, place, who, day: Math.max(1, campaignDay()),
    });
    saveMetadata();
}

/**
 * J11.3: lo que cambia el precio aquí por lo que se recuerda de vosotros (para `priceToday`).
 *
 * @param {string} place El sitio de dentro: `tienda`, `posada`…
 * @returns {{factor: number, label: string}}
 */
export function markedPrice(place) {
    return rememberedPrice({ marks: chat_metadata?.[WORLD_MARKS_KEY], rows: echoRows(), town: currentLocationName, place, today: Math.max(1, campaignDay()) });
}

/**
 * J11.3: si quien lleva un servicio de aquí no os atiende por lo que hicisteis (a la segunda
 * vez que os pillan robando en la tienda), lo que dice; vacío si os atiende.
 *
 * @param {string} service El servicio (`tienda`, `templo`…).
 * @param {any} [hero] Quien juega, para el género.
 * @returns {string}
 */
export function refusedHere(service, hero = null) {
    const keeper = lastWorldNpcs.find(n => !n.dead && n.where.toLowerCase() === String(currentLocationName).toLowerCase() && n.service === service)?.name ?? '';
    return refusal({
        place: { kind: service, keeper: keeper ? { name: keeper } : null }, town: currentLocationName, marks: chat_metadata?.[WORLD_MARKS_KEY], rows: echoRows(), today: Math.max(1, campaignDay()), hero,
    });
}

/**
 * J11.4: lo que se cuenta en el pueblo del gremio de cómo acabó cada campaña (su `rumor`). Fuera
 * del gremio, nada. Lo ya oído lo quita quien los cuenta, por su id.
 *
 * @returns {Array<{id: string, text: string}>}
 */
export function guildMemoryRumors() {
    return lastHub && lastGuildMemory ? guildRumors(lastGuildMemory) : [];
}

/**
 * J11.4: quienes vienen a buscaros por lo que hicisteis en una campaña (su `visitor`), como
 * tarjetas de suceso que vuelven: solo en el gremio.
 *
 * @returns {any[]}
 */
export function guildVisitorRows() {
    return lastHub && lastGuildMemory ? visitorRows(lastGuildMemory) : [];
}

/**
 * J11.3: lo que se cuenta aquí de lo que hicisteis, como rumores (sin los ya oídos).
 *
 * @param {string[]} [told] Los rumores ya oídos, por id.
 * @returns {Array<{id: string, text: string}>}
 */
export function markedRumors(told = []) {
    return markRumors({ marks: chat_metadata?.[WORLD_MARKS_KEY], rows: echoRows(), town: currentLocationName, today: Math.max(1, campaignDay()), told });
}

/**
 * J11.3 y J11.4: el saludo de quien atiende un sitio del pueblo cuando recuerda algo: en el
 * gremio, cómo acabó la última campaña (las semanas después de volver); en los demás, lo que
 * hicisteis allí. Con la cara que pone (J13: `alegre`, `enfadado`), para su retrato. Texto vacío
 * si no recuerda nada: entonces vale el saludo de siempre.
 *
 * @param {any} place El sitio (`TownPlace`), con su clase (`kind`) y quien lo atiende (`keeper`).
 * @param {{slot?: string, hero?: any}} [facts]
 * @returns {{text: string, mood: string}}
 */
export function rememberedHello(place, { slot = '', hero = null } = {}) {
    const today = Math.max(1, campaignDay());
    // D-J12: en el gremio cuenta su día, con lo vivido en cada campaña.
    const guild = lastGuildMemory && lastHub
        ? guildGreeting({ memory: lastGuildMemory, place, today: hubDay({ hub: lastHub, day: today }), slot, hero }) : '';
    if (guild) {
        const tone = [...readGuildMemory(lastGuildMemory).campaigns].reverse().find(c => c.legacy?.greeting)?.legacy?.tone ?? 'gris';
        return { text: guild, mood: tone === 'luz' ? 'alegre' : tone === 'sombra' ? 'enfadado' : '' };
    }
    const marks = chat_metadata?.[WORLD_MARKS_KEY];
    const text = rememberedGreeting({ place, town: currentLocationName, marks, rows: echoRows(), today, slot, hero });
    if (!text) return { text: '', mood: '' };
    // La misma reacción que da el saludo: si os cobra más o no os atiende, enfadado; si menos, alegre.
    const echo = reactionsAt({ marks, rows: echoRows(), town: currentLocationName, place: place?.kind, today })
        .find(r => r.echo.greetings.length > 0 || r.echo.refuse)?.echo;
    const mood = !echo ? '' : echo.refuse || echo.price > 1 || echo.attitude < 0 ? 'enfadado' : echo.price < 1 || echo.attitude > 0 ? 'alegre' : '';
    return { text, mood };
}
