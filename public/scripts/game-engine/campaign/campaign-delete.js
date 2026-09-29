/**
 * Borrar una campaña: qué se va con ella, y qué se dice antes de tocar nada.
 *
 * Una campaña no es un archivo: es un **mundo** (su Lorebook, con las localidades, la
 * gente, el bestiario y los objetos) más **todas sus sesiones**, que son chats repartidos
 * por los directorios de los personajes. Borrar solo una de las dos mitades deja basura
 * con forma de campaña: el mundo sin sesiones reaparece en la lista como «sin empezar», y
 * las sesiones sin mundo abren una partida que ya no sabe dónde ocurre.
 *
 * Así que esto decide las dos cosas a la vez — y, sobre todo, **lo que se dice antes**.
 * Es la única acción del juego que no se puede deshacer, y el aviso es la característica:
 * cuántas sesiones se pierden, si es la partida que tienes abierta y qué quedará atrás si
 * algo no se puede borrar. Un borrado parcial en silencio sería lo peor de los dos mundos.
 *
 * Un gremio (D-J23) es lo mismo en grande: su mundo, el de cada campaña que salió de su
 * tablón y las sesiones de todos. El aviso lo cuenta por partes, para que se vea de un
 * vistazo qué se va y qué se queda.
 *
 * Puro: no borra nada. Devuelve el plan y las palabras; quien llama es el que ejecuta.
 *
 * Ver wiki/POR_HACER.md.
 */

import { campaignTitle } from './saved-games.js';

/**
 * @typedef {Object} DeletionPlan
 * @property {string} worldName      El mundo, por su nombre real de Lorebook.
 * @property {string} displayName    Como lo llama el jugador.
 * @property {Array<{avatar: string, file: string}>} chats Las sesiones que se pueden borrar.
 * @property {string[]} orphans      Sesiones cuyo personaje ya no existe: se quedan.
 * @property {boolean} closesOpenCampaign Hay que cerrar la partida antes de borrarla.
 * @property {string} title          La pregunta, en una linea.
 * @property {string[]} lines        Lo que se pierde, dicho antes de perderlo.
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Qué se borra al borrar esta campaña, y qué hay que avisar.
 *
 * @param {{name: string, displayName?: string, chats?: any[]}} campaign
 * @param {Object} [context]
 * @param {string} [context.openWorldName] El mundo de la partida abierta ahora mismo.
 * @param {string[]} [context.knownAvatars] Los personajes que existen: una sesión de uno
 *        que ya no está no se puede borrar por la puerta normal, y callarlo sería mentir
 *        sobre lo que queda en el disco.
 * @returns {DeletionPlan}
 */
export function planCampaignDeletion(campaign, context = {}) {
    const worldName = text(campaign?.name);
    const displayName = text(campaign?.displayName) || worldName;
    const known = Array.isArray(context.knownAvatars) ? new Set(context.knownAvatars.map(text)) : null;

    /** @type {Array<{avatar: string, file: string}>} */
    const chats = [];
    /** @type {string[]} */
    const orphans = [];

    for (const chat of Array.isArray(campaign?.chats) ? campaign.chats : []) {
        const file = text(chat?.file_name).replace(/\.jsonl$/i, '');
        const avatar = text(chat?.avatar);
        if (!file) continue;
        // Sin `knownAvatars` no se presume nada: se toma por borrable lo que tenga avatar.
        if (!avatar || (known && !known.has(avatar))) orphans.push(file);
        else chats.push({ avatar, file });
    }

    const closesOpenCampaign = Boolean(worldName) && text(context.openWorldName) === worldName;
    const total = chats.length + orphans.length;

    const lines = [
        total === 0
            ? 'No tiene ninguna sesión jugada todavía: se borra el mundo y ya está.'
            : `Se borran **${total} sesión(es) jugadas** y el mundo entero: sus localizaciones, `
                + 'sus tableros, su gente, su bestiario y sus objetos.',
        'Esto no se puede deshacer.',
    ];

    if (closesOpenCampaign) {
        lines.push('Es la campaña que tienes abierta ahora mismo: se cerrará antes de borrarla.');
    }
    if (orphans.length > 0) {
        lines.push(`${orphans.length} sesión(es) se quedarán en el disco: su personaje ya no existe, `
            + 'así que no hay por dónde borrarlas desde aquí.');
    }

    return {
        worldName,
        displayName,
        chats,
        orphans,
        closesOpenCampaign,
        title: `¿Borrar "${displayName}"?`,
        lines,
    };
}

/**
 * @typedef {Object} GuildDeletionPlan
 * @property {string} worldName      El mundo del gremio.
 * @property {string} displayName    Como lo llama el jugador.
 * @property {string[]} worlds       Los mundos que se borran: el del gremio primero, luego
 *           el de cada campaña.
 * @property {Array<{worldName: string, displayName: string, sessions: number}>} campaigns
 *           Sus campañas, con el nombre de «Cargar partida» y cuántas sesiones tiene cada una.
 * @property {number} sessions       Todas: las del gremio y las de sus campañas.
 * @property {Array<{avatar: string, file: string}>} chats Las sesiones que se pueden borrar.
 * @property {string[]} orphans      Sesiones cuyo personaje ya no existe: se quedan.
 * @property {boolean} closesOpenCampaign La partida abierta es el gremio o una de sus campañas.
 * @property {string} title          La pregunta, en una linea.
 * @property {string[]} lines        Lo que se pierde, parte por parte, y lo que se queda.
 */

/**
 * «1 sesión», «3 sesiones».
 *
 * @param {number} count
 * @returns {string}
 */
function sessionsWord(count) {
    return count === 1 ? '1 sesión' : `${count} sesiones`;
}

/**
 * D-J23: qué se borra al borrar un gremio entero, y qué hay que avisar.
 *
 * Cada mundo se reparte como una campaña suelta (`planCampaignDeletion`): lo que cambia es
 * el aviso, que tiene que nombrar cada cosa que se va — el gremio con su pueblo y su gente,
 * los héroes, cada campaña con sus sesiones — y lo que se queda: el salón de la fama, que
 * vive en los ajustes (`extension_settings.partyHall`) y no en ningún mundo.
 *
 * @param {{name: string, displayName?: string, chats?: any[]}} guild El mundo del gremio.
 * @param {Array<{name: string, displayName?: string, chats?: any[]}>} [campaigns] Los mundos
 *        de las campañas que salieron de su tablón, el último jugado primero.
 * @param {Object} [context]
 * @param {string} [context.openWorldName] El mundo de la partida abierta ahora mismo.
 * @param {string[]} [context.knownAvatars] Los personajes que existen (ver planCampaignDeletion).
 * @returns {GuildDeletionPlan}
 */
export function planGuildDeletion(guild, campaigns = [], context = {}) {
    const known = { knownAvatars: context.knownAvatars };
    const home = planCampaignDeletion(guild, known);
    const worldName = home.worldName;

    /** @type {Array<{avatar: string, file: string}>} */
    const chats = [...home.chats];
    /** @type {string[]} */
    const orphans = [...home.orphans];
    const worlds = worldName ? [worldName] : [];
    /** @type {GuildDeletionPlan['campaigns']} */
    const listed = [];

    for (const campaign of Array.isArray(campaigns) ? campaigns : []) {
        const part = planCampaignDeletion(campaign, known);
        // Un mundo dos veces, o el gremio entre sus campañas, se cuenta una vez.
        if (!part.worldName || worlds.includes(part.worldName)) continue;
        worlds.push(part.worldName);
        chats.push(...part.chats);
        orphans.push(...part.orphans);
        listed.push({
            worldName: part.worldName,
            displayName: campaignTitle(part.displayName),
            sessions: part.chats.length + part.orphans.length,
        });
    }

    const guildSessions = home.chats.length + home.orphans.length;
    const sessions = chats.length + orphans.length;
    const open = text(context.openWorldName);
    const closesOpenCampaign = Boolean(open) && worlds.includes(open);

    const lines = [
        'Se borra el gremio entero, con todo lo que tiene:',
        guildSessions === 0
            ? '• **El gremio**: su pueblo, su gente y su tablón.'
            : `• **El gremio**: su pueblo, su gente, su tablón y ${sessionsWord(guildSessions)}.`,
        '• **Tus héroes**: los del grupo y los que esperan en el gremio.',
        ...listed.map(c => (c.sessions === 0
            ? `• La campaña **${c.displayName}**: su mundo, sin sesiones jugadas.`
            : `• La campaña **${c.displayName}**: su mundo y ${sessionsWord(c.sessions)}.`)),
    ];
    if (listed.length > 0 && sessions > 0) {
        lines.push(`En total, **${sessions === 1 ? '1 sesión jugada' : `${sessions} sesiones jugadas`}**.`);
    }
    lines.push(
        'El salón de la fama se queda: no es de ninguna partida.',
        'Esto no se puede deshacer.',
    );

    if (closesOpenCampaign) {
        lines.push('Es la partida que tienes abierta ahora mismo: se cerrará antes de borrarla.');
    }
    if (orphans.length === 1) {
        lines.push('1 sesión se quedará en el disco: su personaje ya no existe, '
            + 'así que no hay por dónde borrarla desde aquí.');
    } else if (orphans.length > 1) {
        lines.push(`${orphans.length} sesiones se quedarán en el disco: su personaje ya no existe, `
            + 'así que no hay por dónde borrarlas desde aquí.');
    }

    return {
        worldName,
        displayName: home.displayName,
        worlds,
        campaigns: listed,
        sessions,
        chats,
        orphans,
        closesOpenCampaign,
        title: `¿Borrar el gremio "${home.displayName}"?`,
        lines,
    };
}

/**
 * Lo que de verdad ha pasado, para decirlo después en vez de suponerlo.
 *
 * Se cuenta lo hecho y no lo intentado: un borrado a medias —el mundo fuera y una sesión
 * que se resistió— tiene que poder decirse, porque es lo que el disco va a tener.
 *
 * Un gremio (D-J23) son varios mundos: con `worlds` se cuentan los borrados, y con
 * `worldsFailed` los que se resistieron, en vez del sí o no de `world`.
 *
 * @param {{world?: boolean, worlds?: number, worldsFailed?: number, chats: number, failed: number}} done
 * @returns {string}
 */
export function describeDeletion(done) {
    const parts = [];
    if (typeof done.worlds === 'number') {
        if (done.worlds > 0) parts.push(done.worlds === 1 ? '1 mundo borrado' : `${done.worlds} mundos borrados`);
        const left = Number(done.worldsFailed) || 0;
        if (left > 0) parts.push(left === 1 ? '1 mundo no se pudo borrar' : `${left} mundos no se pudieron borrar`);
    } else {
        parts.push(done.world ? 'Mundo borrado' : 'El mundo no se pudo borrar');
    }
    if (done.chats > 0) parts.push(`${done.chats} sesión(es) borradas`);
    if (done.failed > 0) parts.push(`${done.failed} sin borrar`);
    // Un gremio cuyos mundos ya no estaban: se dice, en vez de un aviso vacío.
    return parts.join(' · ') || 'No quedaba nada que borrar';
}
