/**
 * Las facciones: lo que piensan de vosotros, lo que ganan o pierden con cada encargo, quién
 * manda en cada sitio y cómo pasan sus días.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, refreshWorldMapGlobals, METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import {
    readFactions, tickFactions, outcomeOf, applyOutcome, newsFor, describeFaction, pushFaction, speaksPlural,
    namesOf, changeStanding, describeStanding, standingWith,
} from '../game-engine/campaign/factions.js';
import { reactionTo } from '../game-engine/campaign/world-echoes.js';
import { neighboursOf, fateAt, describeFate } from '../game-engine/world/people-fate.js';
import { queueNews, clockWarnings } from '../game-engine/world/news.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { NEWS_KEY } from './keys.js';
import {
    currentLocationName, currentWorldFactions, factionDaysDue, setCurrentWorldFactions, setFactionDaysDue,
} from './state.js';
import { lastWorldNpcs } from './world.js';
import {
    postCombatNarration, postForModel, notePlot, worldWrite, plotPeople, applyFate, getCampaignCalendar,
    campaignDay,
} from './main.js';

/** @returns {any[]} */
export function getCurrentWorldFactions() {
    return currentWorldFactions;
}

/**
 * R9: quien manda en un sitio nota lo que pasa en él: un caso resuelto le gusta; un crimen
 * o la nigromancia, no. Lo mueve `changeStanding`, como los encargos.
 *
 * @param {string} place
 * @param {string} what Una clave de `REACTIONS` (`world-echoes.js`).
 * @returns {Promise<void>}
 */
export async function nudgeRuler(place, what) {
    const ruler = rulerOf(place);
    const delta = reactionTo(what);
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!ruler || delta === 0 || !worldName) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const moved = changeStanding(readFactions(data.metadata?.factions), String(ruler.id), delta);
        data.metadata = data.metadata ?? {};
        data.metadata.factions = moved;
        await saveWorldInfo(worldName, data, true);
        setCurrentWorldFactions(moved);
    });
    postCombatNarration(`🏛️ [MUNDO] ${ruler.name} ${delta > 0 ? 'lo tiene en cuenta: os mira mejor' : 'se entera: os mira peor'}.`);
}

/**
 * Las facciones del mundo, en una linea cada una.
 *
 * Con los nombres delante: lo que quiere una meta `destruir` es otra faccion, y sin la
 * lista el panel decia «van a por fac-4-fac-corte».
 *
 * @returns {string[]}
 */
export function describeWorldFactions() {
    const all = readFactions(getCurrentWorldFactions());
    const names = namesOf(all);
    return all.map(faction => describeFaction(faction, names));
}

/**
 * Las facciones que te dejarian pasar por lo suyo.
 *
 * A partir de que te miran bien: por debajo de eso te conocen, que no es lo mismo que
 * abrirte un paso que cerraron.
 *
 * @returns {string[]}
 */
export function friendlyFactions() {
    return readFactions(getCurrentWorldFactions())
        .filter(faction => standingWith(getCurrentWorldFactions(), faction.id) >= 2)
        .map(faction => faction.name)
        .filter(Boolean);
}

/**
 * De quien es un sitio, en las palabras que lee el modelo.
 *
 * Una faccion manda en lo que tiene (`holds`) y se sienta en su sede. Un vecino de ahi
 * carga con lo que los suyos quieren, y eso es justo lo que le da un motivo propio sin
 * escribirle uno a mano.
 *
 * @param {string} placeName
 * @param {any} rawFactions
 * @returns {{name: string, wants: string, note: string}|null}
 */
export function bannerOf(placeName, rawFactions) {
    const where = String(placeName || '').trim().toLowerCase();
    if (!where) return null;

    const owner = readFactions(rawFactions).find(faction =>
        String(faction.seat).toLowerCase() === where
        || faction.holds.some((/** @type {string} */ held) => String(held).toLowerCase() === where));
    if (!owner) return null;

    // «Es de La casa del Vado, los que quieren…» no lo dice nadie: el nombre manda.
    const many = speaksPlural(owner.name);
    const wants = {
        encontrar: `${many ? 'buscan' : 'busca'} el camino a ${owner.goal.target}`,
        conquistar: `${many ? 'quieren' : 'quiere'} ${owner.goal.target}`,
        recuperar: `${many ? 'quieren' : 'quiere'} recuperar ${owner.goal.target}`,
        destruir: `${many ? 'van' : 'va'} a por alguien`,
        controlar: `${many ? 'quieren' : 'quiere'} el camino a ${owner.goal.target}`,
    }[owner.goal.kind] ?? '';

    return { name: owner.name, wants, note: owner.note };
}

/**
 * Lo que un encargo entregado le hace al reloj de quien lo pedia (o lo sufria).
 *
 * Aqui se cierra la otra mitad del bucle de las facciones: hasta ahora el mundo se movia
 * y tu mirabas. Un encargo en contra les quita una semana de trabajo; uno a favor se la
 * da. Tomar partido es la unica forma de que el reloj de otro dependa de ti.
 *
 * @param {any} contract
 * @returns {Promise<void>}
 */
export function settleFactionStake(contract) {
    return worldWrite(() => settleFactionStakeNow(contract));
}

/**
 * @param {any} contract
 * @returns {Promise<void>}
 */
async function settleFactionStakeNow(contract) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;

    try {
        const data = await loadWorldInfo(worldName);
        const before = readFactions(data?.metadata?.factions);
        if (before.length === 0) return;

        const segments = Math.max(1, Math.floor(Number(contract.segments) || 1));
        const { factions, event } = pushFaction(
            before, String(contract.faction), contract.against ? -segments : segments,
        );

        // Lo que piensan de ti se mueve aunque el reloj no: parar a quien ya estaba a cero
        // sigue siendo haberte puesto en su contra, y ellos se acuerdan.
        const seen = changeStanding(factions, String(contract.faction), contract.against ? -1 : 1);
        const mine = seen.find(f => f.id === String(contract.faction));
        // Idea 104: lo que se gana con unos se pierde con sus enemigos, y se dice.
        const rivals = seen.filter(f => f.id !== String(contract.faction)
            && f.reputation < (factions.find(g => g.id === f.id)?.reputation ?? f.reputation));
        const saidStanding = mine
            ? `${mine.name}: ${describeStanding(mine.reputation)}.`
                + (rivals.length > 0 ? ` ${rivals.map(r => r.name).join(' y ')} no lo olvida${rivals.length > 1 ? 'n' : ''}: os mira${rivals.length > 1 ? 'n' : ''} peor.` : '')
            : '';

        if (!event && !saidStanding) return;

        // Empujar hasta el final cumple la meta igual que cumplirla con el tiempo: una
        // sola forma de que un reloj lleno cambie el mundo.
        let locations = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
        let people = seen;
        /** @type {string[]} */
        const changed = [];
        if (event?.kind === 'cumple') {
            const who = people.find(f => f.id === event.faction);
            if (who) {
                const applied = applyOutcome({ locations, factions: people, outcome: outcomeOf(who) });
                locations = applied.locations;
                people = applied.factions;
                changed.push(...applied.changed);
            }
        }

        data.metadata.factions = people;
        data.metadata.locationMaps = locations;
        setCurrentWorldFactions(people);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();

        const told = [event?.note, saidStanding, ...changed].filter(Boolean);
        toastr.info(told[0], 'Se nota ahí fuera', { timeOut: 9000 });
        postForModel([...told, 'Cuéntalo en una frase. No inventes nada que no esté aquí.']
            .join('\n'))
            .catch(error => console.error('[party] faction stake note failed', error));
    } catch (error) {
        console.error('[party] no se pudo mover el reloj de la facción', error);
    }
}

/**
 * Quien manda en un sitio, si alguien manda.
 *
 * @param {string} place
 * @returns {any|null}
 */
export function rulerOf(place) {
    const at = String(place).toLowerCase();
    return getCurrentWorldFactions().find(f => String(f.seat ?? '').toLowerCase() === at
        || (f.holds ?? []).some((/** @type {string} */ h) => String(h).toLowerCase() === at)) ?? null;
}

/**
 * Mover lo que una faccion piensa de vosotros, y guardarlo en el mundo.
 *
 * @param {string} factionId
 * @param {number} amount
 * @returns {Promise<void>}
 */
export function shiftFactionStanding(factionId, amount) {
    return worldWrite(() => shiftFactionStandingNow(factionId, amount));
}

/**
 * @param {string} factionId
 * @param {number} amount
 * @returns {Promise<void>}
 */
async function shiftFactionStandingNow(factionId, amount) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) return;
    try {
        const data = await loadWorldInfo(worldName);
        if (!data?.metadata) return;
        const moved = changeStanding(readFactions(data.metadata.factions), factionId, amount);
        data.metadata.factions = moved;
        setCurrentWorldFactions(moved);
        await saveWorldInfo(worldName, data, true);
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();
    } catch (error) {
        console.error('[party] no se pudo mover la reputacion', error);
    }
}

/** @type {any} */
let factionTickTimer = null;

export function scheduleFactionTick() {
    if (factionTickTimer) clearTimeout(factionTickTimer);
    factionTickTimer = setTimeout(() => {
        const days = factionDaysDue;
        setFactionDaysDue(0);
        factionTickTimer = null;
        void passFactionDays(days);
    }, 0);
}

/**
 * Los dias de las facciones, con lo que cambien.
 *
 * Aditivo como el compendio: una campana sin facciones no pierde nada, porque sin filas
 * esto no hace nada. Y lo que cambia se guarda en el mundo —no en el chat— porque las
 * rutas cerradas y los duenos de cada sitio **son** el mundo.
 *
 * @param {number} days
 * @returns {Promise<void>}
 */
function passFactionDays(days) {
    return worldWrite(() => passFactionDaysNow(days));
}

/**
 * @param {number} days
 * @returns {Promise<void>}
 */
async function passFactionDaysNow(days) {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName || days <= 0) return;

    try {
        const data = await loadWorldInfo(worldName);
        const before = readFactions(data?.metadata?.factions);
        if (before.length === 0) return;

        const { factions, events } = tickFactions({
            factions: before, days, here: currentLocationName,
        });
        // Idea 117: la meta de una faccion se nota antes de cumplirse.
        events.push(...clockWarnings(before, factions));

        // Lo que se cumple cambia la lista de sitios, que es lo que el viaje ya lee.
        let locations = Array.isArray(data.metadata.locationMaps) ? data.metadata.locationMaps : [];
        let people = factions;
        /** @type {string[]} */
        const changed = [];
        /** @type {Array<import('../game-engine/world/people-fate.js').Fate>} */
        const fates = [];
        for (const event of events.filter(e => e.kind === 'cumple')) {
            notePlot({ kind: 'clock', faction: String(event.faction) });
            const who = people.find(f => f.id === event.faction);
            if (!who) continue;
            const outcome = outcomeOf(who);
            const applied = applyOutcome({ locations, factions: people, outcome });
            // Idea 87: la gente de allí no sigue igual: alguno muere y otro se va.
            const fallen = outcome.kind === 'cae' ? people.find(f => f.id === outcome.other) : null;
            const place = outcome.kind === 'toma' ? String(outcome.place || '') : String(fallen?.seat || '');
            if (place) {
                fates.push(...fateAt({
                    npcs: lastWorldNpcs.filter(n => !n.dead),
                    place,
                    cause: outcome.kind === 'toma' ? `cuando ${who.name} lo tomó` : `cuando cayó ${fallen?.name ?? 'su gente'}`,
                    neighbours: neighboursOf(locations),
                    keep: plotPeople(),
                    random: createSeededRandom(derive(worldName, 'gente', place, String(campaignDay()))),
                }));
            }
            locations = applied.locations;
            people = applied.factions;
            changed.push(...applied.changed);
        }
        for (const fate of fates) {
            applyFate(data, fate);
            changed.push(describeFate(fate));
        }

        data.metadata.factions = people;
        data.metadata.locationMaps = locations;
        setCurrentWorldFactions(people);
        await saveWorldInfo(worldName, data, true);
        // Guardar escribe el archivo; el viaje va con la copia en memoria. Sin esto, un
        // paso que se cierra hoy se seguiria pudiendo andar hasta reabrir la campana.
        await refreshWorldMapGlobals(worldName);
        if (isShellOpen()) refreshGameShell();

        // Y solo se cuenta lo que llega hasta aqui: el motor mueve a todos, pero lo que
        // pasa en la otra punta del mundo se sabra al llegar.
        const news = newsFor({ events, here: currentLocationName, locations, factions: people });
        // Lo que no se oye desde aqui se guarda: se contara al llegar a donde se oiga.
        if (chat_metadata) {
            const today = Math.max(1, Math.floor(Number(getCampaignCalendar()?.day) || 1));
            chat_metadata[NEWS_KEY] = queueNews(chat_metadata[NEWS_KEY], events, news, today);
            saveMetadata();
        }
        if (news.length === 0) return;

        for (const line of news) toastr.info(line, 'Se sabe algo', { timeOut: 8000 });
        const note = [
            ...news,
            ...changed,
            'Cuéntalo como un rumor que llega, en una o dos frases. No inventes nada que no esté aquí.',
        ].join('\n');
        postForModel(note).catch(error => console.error('[party] faction news failed', error));
    } catch (error) {
        // Que el mundo no avance no puede romper la partida: es lo que hay encima, no debajo.
        console.error('[party] faction tick failed', error);
    }
}
