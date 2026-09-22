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
 * Puro: no borra nada. Devuelve el plan y las palabras; quien llama es el que ejecuta.
 *
 * Ver wiki/POR_HACER.md.
 */

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
            : `Se borran **${total} sesión(es) jugadas** y el mundo entero: sus localidades, `
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
 * Lo que de verdad ha pasado, para decirlo después en vez de suponerlo.
 *
 * Se cuenta lo hecho y no lo intentado: un borrado a medias —el mundo fuera y una sesión
 * que se resistió— tiene que poder decirse, porque es lo que el disco va a tener.
 *
 * @param {{world: boolean, chats: number, failed: number}} done
 * @returns {string}
 */
export function describeDeletion(done) {
    const parts = [];
    parts.push(done.world ? 'Mundo borrado' : 'El mundo no se pudo borrar');
    if (done.chats > 0) parts.push(`${done.chats} sesión(es) borradas`);
    if (done.failed > 0) parts.push(`${done.failed} sin borrar`);
    return parts.join(' · ');
}
