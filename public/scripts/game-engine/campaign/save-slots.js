/**
 * Guardar como un juego (J15.2 de wiki/ROADMAP_SIN_CONEXION.md): las ranuras de una partida.
 *
 * Hasta ahora la partida se guardaba sola, mensaje a mensaje, en su chat: no se podía volver
 * a la de ayer, ni probar algo y deshacerlo, ni tener dos caminos a la vez. Un juego tiene
 * ranuras, y aquí están:
 *
 * - **Al dormir**: dormir en el gremio guarda (J3.3). Una, que se pisa cada noche.
 * - **Al empezar el día**: el guardado automático, cada vez que cambia el día.
 * - **Ranura 1, 2 y 3**: las tuyas, cuando quieras.
 *
 * Cada ranura es una copia **entera** de la partida (el gremio, sus campañas y sus chats: ver
 * `game-archive.js`) en un archivo aparte, y aquí solo se lleva la lista: qué ranura tiene
 * qué, con su tarjeta de guardado (`save-card.js`: el día, el sitio, lo que tenéis entre manos
 * y quién va) para elegir sin abrirla. Los puntos de retorno de siempre (`checkpoint.js`)
 * siguen debajo: son los de hoy, dentro de la partida, y una ranura se los lleva con ella.
 *
 * La lista vive en los ajustes (`extension_settings.gameSlots`), por partida, y no en el
 * chat: cargar una ranura cambia el chat entero, y la lista tiene que sobrevivir a eso.
 *
 * Puro: decide y describe. Quien llama lee, escribe y guarda.
 */

import { saveSummary, describeSave } from './save-card.js';
import { hubPartyLine } from './hub.js';
import { describeWhen } from './saved-games.js';
import { normalizeCheckpoints } from './checkpoint.js';

/** En `extension_settings`: `{[partida]: {[ranura]: SlotEntry}}`. */
export const GAME_SLOTS_KEY = 'gameSlots';

/** La ranura de dormir en el gremio. */
export const SLOT_SLEEP = 'dormir';

/** La del guardado automático, al cambiar el día. */
export const SLOT_AUTO = 'auto';

/** Las tuyas. */
export const HAND_SLOTS = Object.freeze(['1', '2', '3']);

/** En el orden en que se enseñan: las que se guardan solas, arriba. */
export const SLOT_ORDER = Object.freeze([SLOT_SLEEP, SLOT_AUTO, ...HAND_SLOTS]);

/**
 * Cuánto se fía el automático de un guardado al dormir del mismo día. Dormir pasa el día, y
 * pasar el día guarda solo: sin esto, cada noche en el gremio se escribiría la partida dos
 * veces seguidas.
 */
export const SLEEP_COVERS_MS = 10 * 60 * 1000;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que se sabe de una ranura guardada.
 *
 * @typedef {Object} SlotEntry
 * @property {string} id       Una de `SLOT_ORDER`.
 * @property {string} file     Dónde está la copia de la partida (un archivo tuyo).
 * @property {string} savedAt  ISO.
 * @property {number} day
 * @property {string} place    El sitio donde se quedó el grupo.
 * @property {string} focus    Lo que tenían entre manos, o el final.
 * @property {string} hero     Quién va: «Tessa (Guerrera, nivel 2), con Gerd».
 * @property {string} where    Si se quedó en una campaña del tablón, cuál.
 * @property {boolean} ended
 * @property {number} bytes    Cuánto ocupa la copia.
 */

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isSlotId(id) {
    return SLOT_ORDER.includes(text(id));
}

/**
 * Si la ranura la llena el juego (dormir, el automático) o tú.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isAutoSlot(id) {
    return text(id) === SLOT_SLEEP || text(id) === SLOT_AUTO;
}

/**
 * Cómo se llama una ranura en pantalla.
 *
 * @param {string} id
 * @returns {string}
 */
export function slotLabel(id) {
    if (text(id) === SLOT_SLEEP) return 'Al dormir en el gremio';
    if (text(id) === SLOT_AUTO) return 'Al empezar el día';
    return `Ranura ${text(id)}`;
}

/**
 * Lo que dice debajo del nombre una ranura que se llena sola.
 *
 * @param {string} id
 * @returns {string}
 */
export function slotHint(id) {
    if (text(id) === SLOT_SLEEP) return 'Se guarda sola cuando dormís en el gremio.';
    if (text(id) === SLOT_AUTO) return 'Se guarda sola cada vez que cambia el día.';
    return '';
}

/**
 * Una ranura, con forma aunque llegue rota; null si no se sostiene.
 *
 * @param {string} id
 * @param {any} raw
 * @returns {SlotEntry|null}
 */
function readEntry(id, raw) {
    const file = text(raw?.file);
    if (!isSlotId(id) || !file) return null;
    return {
        id,
        file,
        savedAt: text(raw?.savedAt),
        day: Math.max(1, Math.floor(Number(raw?.day) || 1)),
        place: text(raw?.place),
        focus: text(raw?.focus),
        hero: text(raw?.hero),
        where: text(raw?.where),
        ended: Boolean(raw?.ended),
        bytes: Math.max(0, Math.floor(Number(raw?.bytes) || 0)),
    };
}

/**
 * Las ranuras de una partida.
 *
 * @param {any} raw
 * @returns {Record<string, SlotEntry>}
 */
export function readSlots(raw) {
    /** @type {Record<string, SlotEntry>} */
    const slots = {};
    for (const id of SLOT_ORDER) {
        const entry = readEntry(id, raw && typeof raw === 'object' ? raw[id] : null);
        if (entry) slots[id] = entry;
    }
    return slots;
}

/**
 * Las ranuras de una partida, de lo que hay en los ajustes.
 *
 * @param {any} all `extension_settings.gameSlots`.
 * @param {string} gameId
 * @returns {Record<string, SlotEntry>}
 */
export function slotsOfGame(all, gameId) {
    const id = text(gameId);
    return id && all && typeof all === 'object' ? readSlots(all[id]) : {};
}

/**
 * Los ajustes con las ranuras de una partida puestas al día. Sin ranuras, la partida sale de
 * la lista.
 *
 * @param {any} all
 * @param {string} gameId
 * @param {Record<string, SlotEntry>} slots
 * @returns {Record<string, Record<string, SlotEntry>>}
 */
export function withGameSlots(all, gameId, slots) {
    /** @type {Record<string, Record<string, SlotEntry>>} */
    const next = {};
    for (const [id, value] of Object.entries(all && typeof all === 'object' ? all : {})) {
        const clean = readSlots(value);
        if (text(id) && Object.keys(clean).length > 0) next[text(id)] = clean;
    }
    const clean = readSlots(slots);
    if (Object.keys(clean).length > 0) next[text(gameId)] = clean;
    else delete next[text(gameId)];
    return next;
}

/**
 * Las ranuras con una puesta o cambiada.
 *
 * @param {any} slots
 * @param {SlotEntry} entry
 * @returns {Record<string, SlotEntry>}
 */
export function withSlot(slots, entry) {
    const clean = readEntry(text(entry?.id), entry);
    const now = readSlots(slots);
    return clean ? { ...now, [clean.id]: clean } : now;
}

/**
 * Las ranuras sin una.
 *
 * @param {any} slots
 * @param {string} id
 * @returns {Record<string, SlotEntry>}
 */
export function withoutSlot(slots, id) {
    const now = readSlots(slots);
    delete now[text(id)];
    return now;
}

/**
 * Los archivos de las ranuras de una partida: para borrarlos con ella.
 *
 * @param {any} slots
 * @returns {string[]}
 */
export function slotFiles(slots) {
    return [...new Set(Object.values(readSlots(slots)).map(s => s.file))];
}

/**
 * Un nombre de archivo para la copia de una ranura. El servidor solo acepta letras sin
 * acento, números, `-`, `_` y `.`; y dos partidas que se escriben casi igual («El Gremio» y
 * «El gremio») no pueden pisarse, así que lleva una huella del nombre entero.
 *
 * @param {string} gameId
 * @param {string} slotId
 * @returns {string}
 */
export function slotFileName(gameId, slotId) {
    return `partida-${fileSlug(gameId)}-${fingerprint(gameId)}-ranura-${fileSlug(slotId) || 'x'}.json`;
}

/**
 * Un nombre para un archivo: sin acentos, en minúsculas y con guiones.
 *
 * @param {string} value
 * @returns {string}
 */
export function fileSlug(value) {
    return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Una huella corta de un texto (djb2), para que dos nombres parecidos no den el mismo archivo.
 *
 * @param {string} value
 * @returns {string}
 */
export function fingerprint(value) {
    let hash = 5381;
    for (const char of text(value)) hash = ((hash * 33) ^ char.codePointAt(0)) >>> 0;
    return hash.toString(36);
}

/**
 * La ranura, hecha con lo que dice el chat donde se quedó la partida.
 *
 * @param {Object} input
 * @param {string} input.id
 * @param {string} input.file
 * @param {any} input.meta Los metadatos de ese chat.
 * @param {string} [input.where] La campaña del tablón en la que estáis, si no es el gremio.
 * @param {number} [input.bytes]
 * @param {string} [input.savedAt]
 * @returns {SlotEntry}
 */
export function slotEntry({ id, file, meta, where = '', bytes = 0, savedAt = new Date().toISOString() }) {
    const summary = saveSummary(meta ?? {});
    return {
        id: text(id),
        file: text(file),
        savedAt: text(savedAt),
        day: summary.day,
        place: summary.place,
        focus: summary.focus,
        hero: hubPartyLine(meta?.party),
        where: text(where),
        ended: summary.ended,
        bytes: Math.max(0, Math.floor(Number(bytes) || 0)),
    };
}

/**
 * La línea de la tarjeta: «Día 4 · Puerto Alba · La prueba de la bodega».
 *
 * @param {SlotEntry} entry
 * @returns {string}
 */
export function slotLine(entry) {
    return describeSave({ day: entry.day, place: entry.place, focus: entry.focus, ended: entry.ended, party: [] });
}

/**
 * Cuánto ocupa, dicho como se dice.
 *
 * @param {number} bytes
 * @returns {string}
 */
export function describeSize(bytes) {
    const n = Math.max(0, Number(bytes) || 0);
    if (n <= 0) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Lo que enseña una ranura en la pantalla de guardar.
 *
 * @typedef {Object} SlotCard
 * @property {string} id
 * @property {string} label
 * @property {string} icon     Un icono de FontAwesome.
 * @property {string} hint     Cómo se llena, si se llena sola.
 * @property {boolean} auto
 * @property {boolean} empty
 * @property {string} line     Día, sitio y lo que tenéis entre manos.
 * @property {string} place    El sitio, solo: para su dibujo.
 * @property {string} where    «En La Maldición de Strahd», o nada.
 * @property {string} hero
 * @property {string} when     «Guardada hace 5 minutos», o nada.
 * @property {boolean} canSave Solo las tuyas, y solo si ahora se puede guardar.
 * @property {string} saveWhy  Por qué no se puede guardar ahora, si no se puede.
 * @property {boolean} canLoad
 */

/**
 * Las ranuras de una partida, en su orden, también las vacías.
 *
 * @param {any} slots
 * @param {Object} [options]
 * @param {number} [options.now]
 * @param {boolean} [options.inGame] Con la partida abierta se guarda; desde el título, solo se carga.
 * @param {{allowed: boolean, reason: string}} [options.saving] Si ahora se puede guardar (`canCheckpoint`).
 * @returns {SlotCard[]}
 */
export function slotCards(slots, { now = Date.now(), inGame = true, saving = { allowed: true, reason: '' } } = {}) {
    const read = readSlots(slots);
    return SLOT_ORDER.map(id => {
        const entry = read[id] ?? null;
        const auto = isAutoSlot(id);
        const when = entry ? describeWhen(Date.parse(entry.savedAt), now) : '';
        const blocked = !inGame ? '' : saving?.allowed === false ? text(saving.reason) : '';
        return {
            id,
            label: slotLabel(id),
            icon: id === SLOT_SLEEP ? 'fa-bed' : id === SLOT_AUTO ? 'fa-sun' : 'fa-floppy-disk',
            hint: slotHint(id),
            auto,
            empty: !entry,
            line: entry ? slotLine(entry) : auto ? 'Todavía no se ha guardado.' : 'Vacía.',
            place: entry?.place ?? '',
            where: entry?.where ? `En ${entry.where}` : '',
            hero: entry?.hero ?? '',
            when: when ? `Guardada ${when}` : '',
            canSave: inGame && !auto && !blocked,
            saveWhy: inGame && !auto ? blocked : '',
            canLoad: Boolean(entry),
        };
    });
}

/**
 * Si ha cambiado el día: lo que dispara el guardado automático.
 *
 * @param {any} before El calendario de antes.
 * @param {any} after  El de ahora.
 * @returns {boolean}
 */
export function dayTurned(before, after) {
    const was = Math.floor(Number(before?.day) || 0);
    const is = Math.floor(Number(after?.day) || 0);
    return was > 0 && is > was;
}

/**
 * Si hace falta el guardado automático de este día. No, si ya está (el mismo día en la
 * ranura automática), ni si acabáis de dormir en el gremio y esa ranura ya lo tiene.
 *
 * @param {any} slots
 * @param {Object} input
 * @param {number} input.day El día que empieza.
 * @param {number} [input.now]
 * @returns {boolean}
 */
export function autosaveNeeded(slots, { day, now = Date.now() }) {
    const read = readSlots(slots);
    const today = Math.floor(Number(day) || 0);
    if (today <= 0) return false;
    if (read[SLOT_AUTO]?.day === today && now - Date.parse(read[SLOT_AUTO].savedAt) < SLEEP_COVERS_MS) return false;
    const slept = read[SLOT_SLEEP];
    if (slept && slept.day === today && now - Date.parse(slept.savedAt) < SLEEP_COVERS_MS) return false;
    return true;
}

/**
 * Un punto de retorno de hoy, como se enseña debajo de las ranuras.
 *
 * @typedef {Object} TodayPoint
 * @property {string} id
 * @property {string} label
 * @property {string} time   «18:03», la hora a la que se dejó.
 * @property {boolean} automatic
 */

/**
 * Los puntos de retorno de hoy (J15.2: «los puntos de hoy, por debajo»): los que se dejaron
 * este mismo día de la partida, el último primero. Los de otros días siguen en `/punto`.
 *
 * @param {any} checkpoints Los del chat.
 * @param {number} day El día de la partida.
 * @returns {TodayPoint[]}
 */
export function todayPoints(checkpoints, day) {
    const today = Math.floor(Number(day) || 0);
    return normalizeCheckpoints(checkpoints)
        .filter(cp => Math.floor(Number(cp.state?.calendar?.day) || 0) === today)
        .map(cp => ({
            id: cp.id,
            label: cp.label,
            time: /T(\d\d:\d\d)/.exec(cp.savedAt)?.[1] ?? '',
            automatic: cp.automatic,
        }));
}

/**
 * Cuántos puntos hay de otros días, para decirlo.
 *
 * @param {any} checkpoints
 * @param {number} day
 * @returns {number}
 */
export function olderPoints(checkpoints, day) {
    return normalizeCheckpoints(checkpoints).length - todayPoints(checkpoints, day).length;
}

/**
 * Los puntos de otros días, plegados debajo de los de hoy: con su día delante.
 *
 * @param {any} checkpoints
 * @param {number} day
 * @returns {TodayPoint[]}
 */
export function earlierPoints(checkpoints, day) {
    const today = Math.floor(Number(day) || 0);
    return normalizeCheckpoints(checkpoints)
        .filter(cp => Math.floor(Number(cp.state?.calendar?.day) || 0) !== today)
        .map(cp => {
            const when = Math.floor(Number(cp.state?.calendar?.day) || 0);
            return {
                id: cp.id,
                label: when > 0 ? `Día ${when} · ${cp.label}` : cp.label,
                time: /T(\d\d:\d\d)/.exec(cp.savedAt)?.[1] ?? '',
                automatic: cp.automatic,
            };
        });
}

/**
 * El aviso de después de guardar: el título y la línea.
 *
 * @param {SlotEntry} entry
 * @returns {{title: string, line: string}}
 */
export function savedNotice(entry) {
    const title = entry.id === SLOT_SLEEP ? 'Dormís en el gremio. Partida guardada'
        : entry.id === SLOT_AUTO ? 'Nuevo día. Partida guardada'
            : `Guardada en la ranura ${entry.id}`;
    return { title, line: [slotLine(entry), entry.where ? `en ${entry.where}` : ''].filter(Boolean).join(', ') };
}

/**
 * Lo que se pregunta antes de pisar una ranura tuya que ya tiene algo.
 *
 * @param {SlotEntry|null|undefined} entry
 * @returns {string} Vacío si está vacía: no hay nada que preguntar.
 */
export function overwriteQuestion(entry) {
    if (!entry) return '';
    return `La ${slotLabel(entry.id).toLowerCase()} ya tiene una partida: ${slotLine(entry)}. `
        + 'Se cambia por la de ahora. ¿Seguro?';
}

/**
 * Lo que se pregunta antes de cargar: adónde se vuelve y qué se pierde.
 *
 * @param {SlotEntry} entry
 * @param {Object} [options]
 * @param {boolean} [options.inGame] Si hay una partida abierta, lo no guardado se pierde.
 * @param {number} [options.now]
 * @returns {string}
 */
export function loadQuestion(entry, { inGame = true, now = Date.now() } = {}) {
    const when = describeWhen(Date.parse(entry.savedAt), now);
    const back = `Vuelves al día ${entry.day}${entry.place ? `, en ${entry.place}` : ''}${entry.where ? ` (${entry.where})` : ''}`
        + `${when ? `, guardado ${when}` : ''}.`;
    return inGame
        ? `${back} Lo que hayas jugado desde entonces y no hayas guardado se pierde. ¿Cargar?`
        : `${back} ¿Cargar?`;
}
