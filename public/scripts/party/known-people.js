/**
 * Solo sabes el nombre de quien se ha presentado (J13.7 de wiki/ROADMAP_SIN_CONEXION.md): lo
 * que sabe la partida abierta, guardado en el chat (`knownPeople`), y la fuente de los nombres
 * que enseñan las ventanas (`game-engine/ui/shown-names.js`).
 *
 * La gente es la del mundo abierto (`lastWorldNpcs` y los confidentes), con lo que el paquete
 * dice de cada uno y el lorebook no guarda (su id, su género, cómo se le llama sin conocerle):
 * eso se lee una vez del paquete, si la partida es de uno. Tu grupo sale siempre con su nombre.
 *
 * Una partida de antes de J13.7 (con escenas ya jugadas) conoce a todos: no se le esconde a
 * quien ya trató. Una nueva empieza sin conocer a nadie, y se guarda así en cuanto se pregunta.
 */

import { chat_metadata } from '../../script.js';
import { saveMetadataDebounced } from '../extensions.js';
import { getCurrentWorldLocationMaps, METADATA_KEY } from '../world-info.js';
import { createNamer, knownPeopleLines, readKnownPeople } from '../game-engine/campaign/known-people.js';
import { HUB_PACK } from '../game-engine/campaign/hub.js';
import { setNamesSource } from '../game-engine/ui/shown-names.js';
import { DIALOGUE_MEMORY_KEY, PLOT_SCENES_PLAYED_KEY, PLOT_STATE_KEY } from './keys.js';
import { currentWorldFactions, partyMembers } from './state.js';
import { lastConfidantEntries, lastPack, lastWorldNpcs } from './world.js';
import { campaignDay } from './time.js';

/** La clave del chat (registrada en `state-registry.js`). */
export const KNOWN_PEOPLE_KEY = 'knownPeople';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------------------------------------------------------------------------------------
// Lo que el paquete sabe de cada uno
// ---------------------------------------------------------------------------------------------

/** Por paquete: la gente tal como la escribe (id, género, `stranger`, `famous`), por nombre. @type {Map<string, Map<string, any>|null>} */
const packPeople = new Map();

/**
 * La ruta del paquete de una partida: el del gremio, o el que dice `mundos.json`.
 *
 * @param {string} pack
 * @returns {Promise<string>}
 */
async function packPath(pack) {
    if (pack === 'gremio') return HUB_PACK;
    const response = await fetch('/mundos/mundos.json', { cache: 'no-cache' });
    if (!response.ok) return '';
    const worlds = (await response.json())?.worlds ?? [];
    return text(worlds.find((/** @type {any} */ w) => fold(w?.id) === fold(pack))?.pack);
}

/**
 * La gente del paquete abierto, por nombre. La primera vez se pide y se devuelve null; cuando
 * llega, la próxima ya la tiene. Sin paquete (una campaña tuya), nada: basta con el lorebook.
 *
 * @returns {Map<string, any>|null}
 */
function packExtras() {
    const pack = text(lastPack);
    if (!pack) return null;
    if (packPeople.has(pack)) return packPeople.get(pack) ?? null;
    packPeople.set(pack, null);
    void packPath(pack)
        .then(path => (path ? fetch(path, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)) : null))
        .then((/** @type {any} */ json) => {
            if (!json) return;
            const rows = [...(Array.isArray(json.npcs) ? json.npcs : []), ...(Array.isArray(json.confidants) ? json.confidants : [])];
            packPeople.set(pack, new Map(rows.filter(r => text(r?.name)).map(r => [fold(r.name), r])));
        })
        .catch(error => console.warn('[nombres] no se pudo leer la gente del paquete', error));
    return null;
}

/** La última lista hecha, para que la misma gente sea la misma lista (se guarda lo leído por lista). */
let lastList = { npcs: /** @type {any} */ (null), confidants: /** @type {any} */ (null), extras: /** @type {any} */ (null), people: /** @type {any[]} */ ([]) };

/**
 * La gente del mundo abierto: la del lorebook, con lo que el paquete dice de cada uno.
 *
 * @returns {any[]}
 */
export function worldPeople() {
    const extras = packExtras();
    if (lastList.npcs === lastWorldNpcs && lastList.confidants === lastConfidantEntries && lastList.extras === extras) return lastList.people;
    const add = (/** @type {any} */ person) => {
        const written = extras?.get(fold(person.name));
        if (!written) return person;
        return {
            ...person,
            id: person.id || text(written.id),
            gender: person.gender || text(written.gender),
            stranger: person.stranger || text(written.stranger),
            famous: person.famous === true || written.famous === true,
        };
    };
    const people = [
        ...lastWorldNpcs.filter(n => text(n?.name)).map(add),
        ...Object.values(lastConfidantEntries ?? {}).map((/** @type {any} */ e) => e?.dndData).filter(d => text(d?.name))
            .map((/** @type {any} */ d) => add({ name: text(d.name), className: text(d.charClass), gender: text(d.gender), id: text(d.id) })),
    ];
    lastList = { npcs: lastWorldNpcs, confidants: lastConfidantEntries, extras, people };
    return people;
}

// ---------------------------------------------------------------------------------------------
// Lo sabido
// ---------------------------------------------------------------------------------------------

/**
 * Si la partida abierta es de antes de J13.7: ya ha jugado escenas o charlas.
 *
 * @returns {boolean}
 */
function playedBefore() {
    const played = chat_metadata?.[PLOT_SCENES_PLAYED_KEY];
    const done = chat_metadata?.[PLOT_STATE_KEY]?.done;
    const talks = chat_metadata?.[DIALOGUE_MEMORY_KEY];
    return (Array.isArray(played) && played.length > 0) || (Array.isArray(done) && done.length > 0)
        || (Boolean(talks) && typeof talks === 'object' && Object.keys(talks).length > 0);
}

/**
 * Lo sabido de la partida abierta. Si no hay nada guardado y hay mundo, se guarda ya (sin
 * conocer a nadie, o a todos si es de antes): si no, jugar la primera escena la haría «de antes».
 *
 * @returns {import('../game-engine/campaign/known-people.js').KnownPeople}
 */
export function knownPeopleNow() {
    const raw = chat_metadata?.[KNOWN_PEOPLE_KEY];
    if (raw && typeof raw === 'object') return readKnownPeople(raw);
    const fresh = readKnownPeople(null, { legacy: playedBefore() });
    if (chat_metadata && text(chat_metadata[METADATA_KEY])) {
        chat_metadata[KNOWN_PEOPLE_KEY] = fresh;
        saveMetadataDebounced();
    }
    return fresh;
}

/** @returns {string[]} Quien se conoce siempre: tu grupo. */
function alwaysKnown() {
    return partyMembers.map(m => text(m?.name)).filter(Boolean);
}

/** @returns {string[]} Los nombres que son de sitios y facciones, no de gente. */
function placeNames() {
    return [
        ...getCurrentWorldLocationMaps().map((/** @type {any} */ l) => text(l?.name)),
        ...(Array.isArray(currentWorldFactions) ? currentWorldFactions : []).map((/** @type {any} */ f) => text(f?.name)),
    ].filter(Boolean);
}

/**
 * Quien lleva la cuenta ahora, con lo sabido de la partida abierta. Lo que aprende se guarda
 * en el chat en el acto.
 *
 * @returns {import('../game-engine/campaign/known-people.js').Namer}
 */
export function currentNamer() {
    return createNamer({
        state: knownPeopleNow(),
        people: worldPeople(),
        always: alwaysKnown(),
        day: campaignDay(),
        skip: placeNames(),
        onLearn: (state) => {
            if (!chat_metadata) return;
            chat_metadata[KNOWN_PEOPLE_KEY] = state;
            saveMetadataDebounced();
        },
    });
}

/**
 * Apuntar que ya se sabe cómo se llama alguien, desde el juego (un cartel, quien se une al grupo).
 *
 * @param {string} name
 * @param {string} [how] Una clave de `MET`.
 * @returns {boolean} Si no se sabía.
 */
export function learnName(name, how = 'charla') {
    if (!chat_metadata || !text(chat_metadata[METADATA_KEY])) return false;
    return currentNamer().meet(name, how);
}

/**
 * Para el Diario: la gente que conoces por su nombre, y cómo lo supiste.
 *
 * @returns {string[]}
 */
export function knownPeopleJournal() {
    if (!chat_metadata || !text(chat_metadata[METADATA_KEY])) return [];
    return knownPeopleLines(knownPeopleNow(), worldPeople());
}

/** Poner la fuente de los nombres de las ventanas. Lo llama `initPartyPanel`. */
export function registerKnownPeople() {
    setNamesSource(() => (chat_metadata && text(chat_metadata[METADATA_KEY]) ? currentNamer() : null));
}
