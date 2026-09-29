/**
 * «Cargar partida» enseña partidas, no chats (J0.6 de ROADMAP_SIN_CONEXION), y «Continuar»
 * sigue la última de un clic (J0.5).
 *
 * Por debajo, una partida son chats de SillyTavern: uno por campaña, y en un gremio uno más
 * por cada campaña del tablón. La lista de antes enseñaba eso, los chats, con el nombre del
 * archivo y el del personaje que narra. Aquí se juntan en lo que el jugador llama partida:
 * una campaña suelta es una partida, y un gremio **con todas sus campañas** es otra. Cada
 * una dice lo que hace falta para elegir sin abrirla: dónde se quedó, quién va y a qué
 * nivel, y cuándo se jugó.
 *
 * Puro: recibe los chats (en el orden en que los da el servidor, el último tocado primero) y
 * lo que se sabe de cada mundo; devuelve las partidas y sus tarjetas. Quien llama abre.
 */

import { saveSummary, describeSave } from './save-card.js';
import { hubPartyLine } from './hub.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que se sabe de un mundo, leído de sus metadatos.
 *
 * @typedef {Object} WorldLite
 * @property {string} name
 * @property {string} [displayName]
 * @property {boolean} [hub]  Un gremio.
 * @property {string} [home]  El gremio del que sale, si es una campaña de su tablón.
 */

/**
 * Una partida: un gremio con sus campañas, o una campaña suelta.
 *
 * @typedef {Object} SavedGame
 * @property {string} id         El mundo que la nombra: el del gremio, o el de la campaña.
 * @property {'gremio'|'campaña'} kind
 * @property {string} title
 * @property {boolean} unstarted Un mundo hecho para jugar que nadie ha empezado.
 * @property {any|null} chat     El chat donde se quedó: el más reciente de la partida.
 * @property {string} chatWorld  El mundo de ese chat. En un gremio, puede ser una campaña suya.
 * @property {string} where      En un gremio que se quedó en una campaña, cuál.
 * @property {string[]} campaigns Las campañas del gremio que se han empezado.
 * @property {string[]} finished Las que ya acabaron.
 */

/**
 * Lo que enseña una tarjeta de «Cargar partida», ya en palabras.
 *
 * @typedef {Object} GameCard
 * @property {string} id
 * @property {'gremio'|'campaña'} kind
 * @property {string} title
 * @property {string} icon      Un icono de FontAwesome.
 * @property {string} badge     «Gremio», «Sin empezar», «Terminada» o nada.
 * @property {string} hero      Quién va y a qué nivel: «Tessa (Guerrero, nivel 2), con Gerd».
 * @property {string} line      Día, sitio y lo que tenéis entre manos.
 * @property {string} where     En un gremio, la campaña en la que se quedó.
 * @property {string} campaigns En un gremio, las campañas empezadas (menos aquella en la que está).
 * @property {string} when      Cuándo se jugó por última vez, o nada si no se sabe.
 * @property {string} resume    Lo que dice «Continuar» cuando es la última.
 * @property {boolean} unstarted
 * @property {boolean} canDelete
 */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Cuándo se tocó un chat por última vez, en milisegundos, o 0.
 *
 * @param {any} chat
 * @returns {number}
 */
export function playedAt(chat) {
    const raw = chat?.last_mes;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    const parsed = Date.parse(text(raw));
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Cuándo, dicho como se dice: «hace 5 minutos», «ayer», «el 3 de marzo».
 *
 * @param {number} then
 * @param {number} now
 * @returns {string}
 */
export function describeWhen(then, now) {
    if (!Number.isFinite(then) || then <= 0) return '';
    const minutes = Math.floor(Math.max(0, now - then) / 60000);
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days} días`;
    const date = new Date(then);
    const year = date.getFullYear() !== new Date(now).getFullYear() ? ` de ${date.getFullYear()}` : '';
    return `el ${date.getDate()} de ${MONTHS[date.getMonth()]}${year}`;
}

/**
 * El nombre de una campaña del tablón sin el de quien la empezó: su mundo se llama
 * «La Maldición de Strahd · Tessa» para que dos gremios no se pisen. El aviso de borrar un
 * gremio (campaign-delete.js) las nombra igual que esta lista.
 *
 * @param {string} name
 * @returns {string}
 */
export function campaignTitle(name) {
    const at = name.lastIndexOf(' · ');
    return at > 0 ? name.slice(0, at) : name;
}

/**
 * Las partidas guardadas, la última jugada primero y las que nadie ha empezado al final.
 *
 * @param {Object} input
 * @param {any[]} input.chats Los chats con sus metadatos, el último tocado primero.
 * @param {Record<string, WorldLite>} [input.worlds] Lo que se sabe de cada mundo, por nombre.
 * @param {WorldLite[]} [input.unstarted] Mundos hechos para jugar que ningún chat usa.
 * @returns {SavedGame[]}
 */
export function listSavedGames({ chats, worlds = {}, unstarted = [] }) {
    /** @type {Map<string, SavedGame>} */
    const games = new Map();
    for (const chat of Array.isArray(chats) ? chats : []) {
        const worldName = text(chat?.chat_metadata?.world_info);
        if (!worldName) continue;
        const world = worlds[worldName] ?? { name: worldName };
        const home = text(world.home);
        // Una campaña del tablón es del gremio del que sale: se juega desde él.
        const id = world.hub ? worldName : home || worldName;
        let game = games.get(id);
        if (!game) {
            const named = worlds[id] ?? { name: id };
            game = {
                id,
                kind: world.hub || home ? 'gremio' : 'campaña',
                title: text(named.displayName) || id,
                unstarted: false,
                // Los chats llegan del último al primero: el primero de cada partida es donde se quedó.
                chat,
                chatWorld: worldName,
                where: home ? campaignTitle(text(world.displayName) || worldName) : '',
                campaigns: [],
                finished: [],
            };
            games.set(id, game);
        }
        const campaign = home ? campaignTitle(text(world.displayName) || worldName) : '';
        if (campaign && !game.campaigns.includes(campaign)) {
            game.campaigns.push(campaign);
            // Su chat más reciente dice si ya tiene final.
            if (text(chat?.chat_metadata?.plotEnding)) game.finished.push(campaign);
        }
    }

    const listed = [...games.values()];
    for (const world of Array.isArray(unstarted) ? unstarted : []) {
        const name = text(world?.name);
        if (!name || games.has(name)) continue;
        listed.push({
            id: name, kind: 'campaña', title: text(world.displayName) || name, unstarted: true,
            chat: null, chatWorld: name, where: '', campaigns: [], finished: [],
        });
    }
    return listed;
}

/**
 * La tarjeta de una partida.
 *
 * @param {SavedGame} game
 * @param {number} now
 * @returns {GameCard}
 */
export function gameCard(game, now) {
    const meta = game.chat?.chat_metadata ?? {};
    const summary = saveSummary(meta);
    const hero = game.unstarted ? '' : hubPartyLine(meta.party);
    const guild = game.kind === 'gremio';
    const badge = game.unstarted ? 'Sin empezar' : guild ? 'Gremio' : summary.ended ? 'Terminada' : '';
    const others = game.campaigns.filter(name => name !== game.where)
        .map(name => (game.finished.includes(name) ? `${name} (terminada)` : name));
    // «Continuar» dice qué se sigue: dónde, con quién y qué día.
    const place = game.where ? `${game.where}, desde ${game.title}` : game.title;
    return {
        id: game.id,
        kind: game.kind,
        title: game.title,
        icon: guild ? 'fa-shield-halved' : game.unstarted ? 'fa-scroll' : 'fa-map',
        badge,
        hero,
        line: game.unstarted ? 'Nadie la ha empezado todavía.' : describeSave(summary),
        where: game.where ? `Ahora en ${game.where}` : '',
        campaigns: others.length === 0 ? '' : `${game.where ? 'Otras campañas' : 'Campañas'}: ${others.join(', ')}`,
        when: game.unstarted ? '' : describeWhen(playedAt(game.chat), now),
        resume: [place, hero, game.unstarted ? '' : `Día ${summary.day}`].filter(Boolean).join(' · '),
        unstarted: game.unstarted,
        // D-J23: un gremio también se borra, entero: su mundo, sus campañas y todas sus
        // sesiones. El aviso de antes dice todo lo que se va (campaigns.js, deleteGuild).
        canDelete: true,
    };
}
