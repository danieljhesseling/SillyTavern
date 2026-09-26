/**
 * El registro del estado: todo lo que una partida guarda, declarado una vez (U2 del pegamento).
 *
 * Una partida guardaba más de sesenta claves en los metadatos del chat, cada una declarada
 * donde hizo falta. Nadie tenía la lista entera, y se notaba en el primer sitio que la
 * necesitaba: el punto de retorno guardaba siete cosas y volver a él dejaba el hilo, el
 * tablón o lo que os buscan como estaban. Aquí está la lista, y cada clave dice:
 *
 * - **de quién es**: el módulo que la escribe;
 * - **qué es**, dicho para quien juega (sale en el panel del estado);
 * - **de qué clase**: `juego` (lo que pasa en la partida: vuelve con un punto de retorno),
 *   `ajuste` (cómo quieres jugar: un punto no te lo cambia), `registro` (lo que se apunta
 *   de la sesión, no del mundo), `puntos` (los puntos mismos) o `sistema` (de SillyTavern:
 *   no se toca).
 *
 * `tools/check-state-keys.mjs` falla si el código usa una clave que no está aquí. Es lo que
 * impide que la lista vuelva a quedarse corta.
 *
 * Lo que vive en el **mundo** (sitios, facciones, dónde está cada persona) no está en los
 * metadatos del chat sino en el lorebook; `WORLD_PARTS` dice qué parte cambia jugando.
 *
 * Puro: datos y cuatro funciones. Quien llama guarda y restaura.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U2.
 */

/** @typedef {'juego'|'ajuste'|'registro'|'puntos'|'sistema'} StateKind */

/**
 * @typedef {Object} StateEntry
 * @property {string} key La clave en los metadatos del chat.
 * @property {StateKind} kind
 * @property {string} owner Quién la escribe.
 * @property {string} what Qué es, para quien juega.
 */

/** @type {StateEntry[]} */
export const STATE_KEYS = [
    // --- El grupo y dónde está
    { key: 'party', kind: 'juego', owner: 'party.js', what: 'El grupo: fichas, vida, cosas y dónde está cada uno' },
    { key: 'currentLocation', kind: 'juego', owner: 'party.js', what: 'El sitio donde estáis' },
    { key: 'currentBoard', kind: 'juego', owner: 'party.js', what: 'El tablero en el que estáis' },
    { key: 'combatEncounter', kind: 'juego', owner: 'party.js', what: 'El combate en curso' },
    { key: 'calendar', kind: 'juego', owner: 'party/campaign-state.js', what: 'El día, la franja y el tiempo' },
    { key: 'bonds', kind: 'juego', owner: 'party/campaign-state.js', what: 'Los vínculos con los compañeros' },
    { key: 'campaignMap', kind: 'juego', owner: 'party/campaign-state.js', what: 'El mapa de la campaña y lo explorado' },
    { key: 'mounts', kind: 'juego', owner: 'party.js', what: 'Las monturas del grupo' },
    { key: 'bench', kind: 'juego', owner: 'party.js', what: 'Quién se quedó en el gremio (banquillo)' },
    { key: 'dispatches', kind: 'juego', owner: 'party.js', what: 'Quién está fuera haciendo un encargo sin el héroe' },
    { key: 'cases', kind: 'juego', owner: 'party.js', what: 'El caso abierto, sus pistas encontradas y los ya cerrados' },
    { key: 'duels', kind: 'juego', owner: 'party.js', what: 'Con quién se habló ya hoy (un duelo de palabras por persona y día)' },
    { key: 'visited', kind: 'juego', owner: 'party.js', what: 'Dónde habéis estado' },
    { key: 'pet', kind: 'juego', owner: 'party.js', what: 'La mascota del héroe: quién es, su carácter y su vínculo (R5)' },
    { key: 'nemeses', kind: 'juego', owner: 'party.js', what: 'Los que escaparon y pueden volver: la némesis (R7)' },
    { key: 'gone', kind: 'juego', owner: 'party.js', what: 'Los compañeros que se fueron, con su ficha, por si vuelven (R8)' },
    { key: 'petPetted', kind: 'juego', owner: 'party.js', what: 'El día en que se acarició a la mascota por última vez' },
    { key: 'mapNotes', kind: 'juego', owner: 'party.js', what: 'Tus notas en el mapa' },
    { key: 'prisoners', kind: 'juego', owner: 'party.js', what: 'Los prisioneros' },
    { key: 'graves', kind: 'juego', owner: 'party.js', what: 'Las tumbas de los caídos' },
    { key: 'relicsGiven', kind: 'juego', owner: 'party.js', what: 'Las reliquias ya entregadas' },
    // --- El dinero y el gremio
    { key: 'upkeepDueDay', kind: 'juego', owner: 'party.js', what: 'Cuándo vence la cuenta de la semana' },
    { key: 'debt', kind: 'juego', owner: 'party.js', what: 'La deuda con un patrón' },
    { key: 'guild', kind: 'juego', owner: 'party.js', what: 'El gremio: reputación, edificios y plantilla' },
    { key: 'guildStorage', kind: 'juego', owner: 'party.js', what: 'El almacén del gremio' },
    { key: 'contractBoard', kind: 'juego', owner: 'party.js', what: 'El tablón de encargos' },
    { key: 'contractTaken', kind: 'juego', owner: 'party.js', what: 'El encargo aceptado' },
    { key: 'recruitsMet', kind: 'juego', owner: 'party.js', what: 'A quién se ha conocido para reclutar' },
    { key: 'writtenDone', kind: 'juego', owner: 'party.js', what: 'Los encargos escritos ya cumplidos' },
    { key: 'haggle', kind: 'juego', owner: 'party.js', what: 'Los regateos de hoy' },
    { key: 'tavernDice', kind: 'juego', owner: 'party.js', what: 'Las partidas de dados en cada posada' },
    { key: 'itemOffers', kind: 'juego', owner: 'party.js', what: 'Lo que el narrador ofrece y aún no se ha cogido' },
    // --- El hilo
    { key: 'plot', kind: 'juego', owner: 'party.js', what: 'El hilo de la campaña' },
    { key: 'plotState', kind: 'juego', owner: 'party.js', what: 'Por dónde va el hilo: hitos abiertos y cumplidos' },
    { key: 'plotAnnounced', kind: 'juego', owner: 'party.js', what: 'Si la mecha ya se contó' },
    { key: 'plotEnding', kind: 'juego', owner: 'party.js', what: 'El final alcanzado' },
    { key: 'omensTold', kind: 'juego', owner: 'party.js', what: 'Si el presagio ya se contó' },
    { key: 'threadHints', kind: 'juego', owner: 'party.js', what: 'Las pistas del hilo ya dadas' },
    { key: 'villainSeen', kind: 'juego', owner: 'party.js', what: 'Las veces que el villano se ha dejado ver' },
    { key: 'actSummaries', kind: 'juego', owner: 'party.js', what: 'Los resúmenes de los actos cerrados' },
    { key: 'actStarts', kind: 'juego', owner: 'party.js', what: 'Dónde empezó cada acto en el chat' },
    { key: 'heroFit', kind: 'juego', owner: 'party.js', what: 'Qué hitos son para este héroe' },
    // --- El mundo, visto desde la partida
    { key: 'deeds', kind: 'juego', owner: 'party.js', what: 'Lo que el mundo recuerda que hicisteis' },
    { key: 'sharedMemories', kind: 'juego', owner: 'party.js', what: 'Lo que el grupo recuerda haber vivido junto' },
    { key: 'fame', kind: 'juego', owner: 'party.js', what: 'La fama del grupo, sitio a sitio' },
    { key: 'wanted', kind: 'juego', owner: 'party.js', what: 'Dónde os buscan' },
    { key: 'attitudes', kind: 'juego', owner: 'party.js', what: 'Cómo os mira cada persona' },
    { key: 'npcSecrets', kind: 'juego', owner: 'party.js', what: 'Los secretos ya sonsacados' },
    { key: 'rumorsHeard', kind: 'juego', owner: 'party.js', what: 'Los rumores ya oídos' },
    { key: 'rumorsHeardOn', kind: 'juego', owner: 'party.js', what: 'Qué día se oyó cada rumor' },
    { key: 'newsPending', kind: 'juego', owner: 'party.js', what: 'Las noticias que esperan a que lleguéis' },
    { key: 'arrivalsHeard', kind: 'juego', owner: 'party.js', what: 'Lo que ya se contó al llegar a cada sitio' },
    { key: 'letters', kind: 'juego', owner: 'party.js', what: 'Las cartas que esperan en la posada' },
    { key: 'lettersSent', kind: 'juego', owner: 'party.js', what: 'Las cartas ya escritas' },
    { key: 'festivalTold', kind: 'juego', owner: 'party.js', what: 'Las fiestas ya contadas' },
    { key: 'placeProposals', kind: 'juego', owner: 'party.js', what: 'Los sitios que propuso el narrador' },
    { key: 'explored', kind: 'juego', owner: 'party.js', what: 'Lo que se ha explorado alrededor' },
    { key: 'climate', kind: 'juego', owner: 'party.js', what: 'El clima de estos días' },
    { key: 'weatherToday', kind: 'juego', owner: 'party.js', what: 'El tiempo de hoy' },
    // --- Los compañeros por dentro
    { key: 'approval', kind: 'juego', owner: 'party.js', what: 'Lo que les ha parecido a los compañeros lo que hacéis' },
    { key: 'personalAsked', kind: 'juego', owner: 'party.js', what: 'Quién ha pedido ya su encargo personal' },
    { key: 'departWarned', kind: 'juego', owner: 'party.js', what: 'Quién ha avisado de que está harto' },
    { key: 'safety', kind: 'juego', owner: 'party.js', what: 'Las derrotas seguidas, para la red de seguridad' },
    // --- Tiradas y dados

    { key: 'pendingCheck', kind: 'juego', owner: 'party.js', what: 'La tirada hecha que aún no se ha enviado' },
    { key: 'checkRequests', kind: 'juego', owner: 'party.js', what: 'Las tiradas que pidió el narrador' },
    { key: 'stats', kind: 'juego', owner: 'party.js', what: 'La partida en números' },
    { key: 'weekTable', kind: 'juego', owner: 'party.js', what: 'La mesa de la semana: qué semana es y lo que pasó en la anterior' },
    // --- Ajustes: un punto de retorno no te los cambia
    { key: 'narrationLength', kind: 'ajuste', owner: 'party.js', what: 'El largo de la narración' },
    { key: 'narratorFont', kind: 'ajuste', owner: 'party.js', what: 'La letra del narrador' },
    { key: 'sceneTone', kind: 'ajuste', owner: 'party.js', what: 'El tono de la escena' },
    { key: 'safetyNet', kind: 'ajuste', owner: 'party.js', what: 'Si la red de seguridad está puesta' },
    { key: 'companionsLeave', kind: 'ajuste', owner: 'party.js', what: 'Si los hartos se van' },
    { key: 'weekTableAuto', kind: 'ajuste', owner: 'party.js', what: 'Si la mesa se abre sola cada semana' },
    { key: 'rollGuardMode', kind: 'ajuste', owner: 'party.js', what: 'Qué se hace con las tiradas que se inventa el narrador' },
    { key: 'diceSeed', kind: 'ajuste', owner: 'party.js', what: 'La semilla de los dados, si se fijó con /semilla' },
    { key: 'narrator_name', kind: 'ajuste', owner: 'campaigns.js', what: 'El nombre del narrador' },
    { key: 'dynamicContext', kind: 'ajuste', owner: 'dynamic-context-manager.js', what: 'Tus instrucciones para el narrador' },
    // --- Registros de la sesión
    { key: 'diceLog', kind: 'registro', owner: 'party.js', what: 'El historial de dados' },
    { key: 'contradictions', kind: 'registro', owner: 'party.js', what: 'Lo que el narrador contó y no cuadraba' },
    // No vuelve con un punto de retorno: bajar de modo y volver atrás no la hace de hierro otra vez.
    { key: 'modeHistory', kind: 'registro', owner: 'party.js', what: 'Los cambios de modo, y si la partida sigue siendo de hierro' },
    // --- Los puntos de retorno
    { key: 'checkpoints', kind: 'puntos', owner: 'party.js', what: 'Los puntos de retorno' },
    // --- De SillyTavern
    { key: 'world_info', kind: 'sistema', owner: 'world-info.js', what: 'El mundo de esta partida' },
    { key: 'persona', kind: 'sistema', owner: 'SillyTavern', what: 'La persona fijada al chat' },
];

/**
 * Lo que cambia del mundo jugando, y vuelve con un punto de retorno: las partes de los
 * metadatos del lorebook, y de cada persona, su ficha de juego (dónde vive, si vive).
 */
export const WORLD_PARTS = ['locationMaps', 'hiddenLocations', 'factions'];

/** @param {string} key @returns {StateEntry|null} */
export function entryOf(key) {
    return STATE_KEYS.find(entry => entry.key === key) ?? null;
}

/** @returns {string[]} Las claves que vuelven con un punto de retorno. */
export function checkpointKeys() {
    return STATE_KEYS.filter(entry => entry.kind === 'juego').map(entry => entry.key);
}

/**
 * Lo que se guarda de la partida en un punto: una copia de cada clave de juego que haya.
 *
 * @param {Record<string, any>} metadata
 * @returns {Record<string, any>}
 */
export function captureKeys(metadata) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const key of checkpointKeys()) {
        if (metadata && Object.prototype.hasOwnProperty.call(metadata, key) && metadata[key] !== undefined) {
            out[key] = structuredClone(metadata[key]);
        }
    }
    return out;
}

/**
 * Devolver la partida a un punto: cada clave de juego vuelve a como estaba, y **la que no
 * existía entonces se borra** (si no, lo que pasó después se quedaría). Ajustes, registros
 * y lo de SillyTavern no se tocan.
 *
 * Un punto de antes del registro (`complete: false`) solo guardaba siete cosas: de esos se
 * devuelve lo que traen y no se borra nada, porque su silencio no quiere decir «no existía».
 *
 * @param {Record<string, any>} metadata Se cambia en el sitio: es el objeto del chat.
 * @param {Record<string, any>} saved
 * @param {boolean} [complete] Si el punto guardó todas las claves de juego.
 * @returns {string[]} Las claves que cambiaron.
 */
export function restoreKeys(metadata, saved, complete = true) {
    const changed = [];
    for (const key of checkpointKeys()) {
        const had = Object.prototype.hasOwnProperty.call(saved ?? {}, key);
        if (!had && !complete) continue;
        const before = JSON.stringify(metadata[key]);
        if (had) metadata[key] = structuredClone(saved[key]);
        else delete metadata[key];
        if (JSON.stringify(metadata[key]) !== before) changed.push(key);
    }
    return changed;
}

/**
 * Lo que cambia del mundo jugando, copiado para un punto.
 *
 * @param {any} worldData El lorebook entero (`loadWorldInfo`).
 * @returns {{metadata: Record<string, any>, people: Record<string, any>}}
 */
export function captureWorld(worldData) {
    /** @type {Record<string, any>} */
    const metadata = {};
    for (const part of WORLD_PARTS) {
        if (worldData?.metadata?.[part] !== undefined) metadata[part] = structuredClone(worldData.metadata[part]);
    }
    /** @type {Record<string, any>} */
    const people = {};
    for (const [uid, entry] of Object.entries(worldData?.entries ?? {})) {
        if (/** @type {any} */ (entry)?.dndData) people[uid] = structuredClone(/** @type {any} */ (entry).dndData);
    }
    return { metadata, people };
}

/**
 * Devolver el mundo a un punto. Las fichas que se añadieron después (alguien del modo
 * director, un sitio propuesto) **se quedan**: no se borra lo escrito, solo se devuelve lo
 * que cambió jugando.
 *
 * @param {any} worldData Se cambia en el sitio.
 * @param {{metadata?: Record<string, any>, people?: Record<string, any>}} saved
 * @returns {number} Cuántas cosas volvieron.
 */
export function restoreWorld(worldData, saved) {
    if (!worldData || !saved) return 0;
    let back = 0;
    worldData.metadata = worldData.metadata ?? {};
    for (const part of WORLD_PARTS) {
        if (saved.metadata && Object.prototype.hasOwnProperty.call(saved.metadata, part)) {
            worldData.metadata[part] = structuredClone(saved.metadata[part]);
            back++;
        }
    }
    for (const [uid, dndData] of Object.entries(saved.people ?? {})) {
        const entry = worldData.entries?.[uid];
        if (entry) {
            entry.dndData = structuredClone(dndData);
            back++;
        }
    }
    return back;
}

/**
 * El panel del estado: cada clave con lo que es y cuánto hay, por clases.
 *
 * @param {Record<string, any>} metadata
 * @returns {Array<{kind: StateKind, title: string, rows: Array<{key: string, what: string, size: string}>}>}
 */
export function describeState(metadata) {
    const titles = {
        juego: 'La partida (vuelve con un punto de retorno)',
        ajuste: 'Tus ajustes (un punto no los cambia)',
        registro: 'Lo apuntado de la sesión',
        puntos: 'Los puntos de retorno',
        sistema: 'De SillyTavern',
    };
    /** @param {any} value @returns {string} */
    const sizeOf = (value) => {
        if (value === undefined || value === null) return '—';
        if (Array.isArray(value)) return value.length === 0 ? 'vacío' : `${value.length}`;
        if (typeof value === 'object') {
            const n = Object.keys(value).length;
            return n === 0 ? 'vacío' : `${n} ${n === 1 ? 'dato' : 'datos'}`;
        }
        const text = String(value);
        return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    };
    return /** @type {StateKind[]} */ (['juego', 'ajuste', 'registro', 'puntos', 'sistema']).map(kind => ({
        kind,
        title: titles[kind],
        rows: STATE_KEYS.filter(entry => entry.kind === kind).map(entry => ({ key: entry.key, what: entry.what, size: sizeOf(metadata?.[entry.key]) })),
    }));
}
