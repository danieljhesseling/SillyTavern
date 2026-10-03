/**
 * El modo guiado del juego sin conexión (D-J62 de wiki/ROADMAP_SIN_CONEXION.md, 2026-10-03).
 *
 * Sin la capa de IA y sin el mundo semiabierto, dejar hacer cualquier cosa en cualquier sitio da
 * más libertad de la que el juego sabe llevar («da mucha libertad como para que sea controlable»,
 * Daniel). Con el modo guiado se esconden, sin borrar nada:
 *
 * - **La fila de acciones libres** del pie del pueblo y de la novela: el tablón de campañas,
 *   contratar, los encargos, tus personajes (todo eso ya está dentro de la Casa del Gremio), mirar,
 *   los rumores, «+N más» y la «Tirada» suelta. Lo de mirar y los rumores pasa al sitio al que
 *   pertenece (los rumores, a la taberna; los avisos de la lonja, al mercado), o lo ofrece quien
 *   está allí.
 * - **«Tableros de aquí»**: a un tablero no se entra porque sí. Se entra con una opción de la
 *   conversación («Bajo a la bodega»), con el paso de un encargo aceptado, o al llegar adonde la
 *   historia lo pide: entonces la pelea empieza sola (J12.16).
 * - **«Viajar» a cualquier sitio**: se va adonde manda la historia o un encargo aceptado, con una
 *   acción clara («Ir a La Granja Quemada», y debajo quién lo pide).
 *
 * Todo lo escondido se apunta en wiki/LO_OCULTO.md. El interruptor es `GUIDED_MODE.on`: apagado, el
 * juego sin conexión vuelve a ser el de antes. Con conexión (con el modelo) no cambia nada.
 *
 * Puro: decide qué se enseña y qué pide la historia. Dibujarlo y hacerlo lo hacen quienes llaman
 * (`party/guided.js`, `ui/shell/game-shell.js` y `ui/shell/town-scene.js`).
 */

import { SKILLS } from '../rules/checks.js';

/**
 * El interruptor del modo guiado (D-J62). Encendido: el juego sin conexión esconde la fila de
 * acciones libres, «Tableros de aquí» y «Viajar» a cualquier sitio, y se va adonde manda la
 * historia. Apagado (`on: false`): todo vuelve a salir como antes. Lo que esconde, en
 * wiki/LO_OCULTO.md.
 */
export const GUIDED_MODE = { on: true };

/**
 * Si el modo guiado manda ahora: encendido y en una partida sin conexión.
 *
 * @param {boolean} offline
 * @returns {boolean}
 */
export function guidedOn(offline) {
    return Boolean(GUIDED_MODE.on) && Boolean(offline);
}

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value : []);

// ---------------------------------------------------------------------------------------
// La fila de fichas.

/**
 * Lo que se queda en la fila con el modo guiado: lo del tablero (puertas, trampas, la escalera,
 * salir), la conversación en marcha, los prisioneros, la magia que sirve aquí y volver al gremio
 * desde una campaña. Lo demás es «hacer lo que quieras» y se esconde.
 */
const KEPT_PREFIXES = ['reply-', 'door:', 'trap-', 'prisoner:', 'offer:', 'check-request:', 'story:'];
// E7.1: «Explorar hacia delante» (`ahead`) también es del tablero.
const KEPT_IDS = new Set(['ahead', 'stairs', 'leave', 'field-heal', 'field-magic', 'hub-home', 'hub-ending']);

/** Cuántas fichas caben en la fila guiada: son pocas, y sin «+N más». */
export const GUIDED_ROW_MAX = 6;

/**
 * Si una ficha de la fila se queda con el modo guiado.
 *
 * @param {{id?: string}|null|undefined} chip
 * @returns {boolean}
 */
export function keptInGuided(chip) {
    const id = text(chip?.id);
    if (!id) return false;
    return KEPT_IDS.has(id) || KEPT_PREFIXES.some(prefix => id.startsWith(prefix));
}

/**
 * La fila de fichas con el modo guiado: solo lo que se queda, sin «+N más».
 *
 * @template {{id?: string}} T
 * @param {T[]} chips Todas las fichas (`getChips(Infinity)`).
 * @param {number} [max]
 * @returns {T[]}
 */
export function guidedRow(chips, max = GUIDED_ROW_MAX) {
    return list(chips).filter(keptInGuided).slice(0, Math.max(0, max));
}

// ---------------------------------------------------------------------------------------
// Lo de mirar, en su sitio.

/**
 * A qué sitio del pueblo pertenece algo que mirar, por lo que dice. En orden: lo del puerto al
 * muelle, lo de la lonja y el mercado a la tienda, los avisos al tablón, lo de la barra a la
 * taberna, la forja a la herrería, las velas a la capilla y lo de la sala al gremio.
 */
const SIGHT_HOMES = /** @type {Array<[string, RegExp]>} */ ([
    ['muelle', /muelle|barca|pescador|redes|\bfaro\b|embarcadero|marea|puerto|amarr/],
    ['tienda', /lonja|mercado|tienda|puesto|mostrador|estante|mercader/],
    ['tablon', /tablon|aviso|bando|edicto|cartel|pasquin/],
    ['tienda', /aviso|cartel/],
    ['posada', /taberna|posada|barra|jarra|parroquian|mesas/],
    ['herreria', /forja|fragua|herrer|yunque/],
    ['templo', /capilla|templo|iglesia|altar|vela|tablilla|santuario|ermita/],
    ['gremio', /gremio|viga|chimenea|libro de|salon/],
    ['plaza', /plaza|fuente|pozo|gente/],
]);

/**
 * El sitio del pueblo al que va algo que mirar que el paquete no ata a ninguno («leer los avisos
 * clavados en la lonja» → la tienda). Sin pista, la plaza, la taberna o el primero que haya.
 *
 * @param {string} said Lo que se mira, como se lee («los avisos clavados en la lonja»).
 * @param {string[]} kinds Las clases de sitio que tiene el pueblo (`tienda`, `posada`, `muelle`…).
 * @returns {string} La clase del sitio, o vacío si el pueblo no tiene ninguno.
 */
export function sightHome(said, kinds) {
    const have = list(kinds).map(text).filter(Boolean);
    if (have.length === 0) return '';
    const what = fold(said);
    for (const [kind, pattern] of SIGHT_HOMES) {
        if (have.includes(kind) && pattern.test(what)) return kind;
    }
    for (const kind of ['plaza', 'posada', 'tienda']) if (have.includes(kind)) return kind;
    return have[0];
}

/**
 * Lo que se puede mirar suelto en el pueblo, repartido por sus sitios (`sightHome`).
 *
 * @template {{label?: string}} T
 * @param {T[]} looks
 * @param {string[]} kinds
 * @returns {Record<string, T[]>}
 */
export function spreadLooks(looks, kinds) {
    /** @type {Record<string, T[]>} */
    const out = {};
    for (const look of list(looks)) {
        const home = sightHome(text(look?.label), kinds);
        if (home) (out[home] ??= []).push(look);
    }
    return out;
}

// ---------------------------------------------------------------------------------------
// Lo que pide la historia, y adónde se va.

/**
 * @typedef {Object} StoryStep Un paso que la historia (o un encargo aceptado) pide ahora.
 * @property {string} id `story:go:<sitio>`, `story:board:<tablero>`, `story:talk:<persona>` o `story:check:<habilidad>`.
 * @property {'go'|'board'|'talk'|'check'} kind `go`: viajar; `board`: ir al tablero donde espera la pelea;
 *   `talk`: hablar con quien pide la historia, que está aquí; `check`: intentar lo que pide (convencer,
 *   buscar una pista).
 * @property {string} label Lo que se lee en el botón: «Ir a El Peaje Norte».
 * @property {string} detail Quién lo pide, debajo: «Lo pide la historia: La vanguardia de Keller».
 * @property {boolean} enabled Si se puede ahora (un camino cerrado se enseña con su motivo).
 * @property {string} [place] `go`: el sitio al que se viaja ahora (el vecino, si queda lejos).
 * @property {string} [target] `go`: adonde se quiere llegar.
 * @property {string} [board] `board`, y `go` si al llegar espera una pelea: el tablero.
 * @property {string} [npc] `talk`: con quién, por su nombre.
 * @property {string} [skill] `check`: la habilidad.
 * @property {boolean} [secret] Un secreto del hilo (idea 111) que está aquí mismo: no lo pide nadie,
 *   y al llegar no se entra solo en su pelea.
 */

/**
 * @typedef {Object} StoryWant Lo que pide un hito o un encargo, antes de decir cómo se llega.
 * @property {'fight'|'arrive'|'talk'|'check'} kind
 * @property {string} place
 * @property {string} [board]
 * @property {string} [skill]
 * @property {string} [npc]
 * @property {boolean} [clue]
 * @property {boolean} [contract]
 * @property {boolean} [secret]
 * @property {string} why
 */

/** Lo que se lee debajo de un secreto del hilo que está aquí: sin decir de qué va. */
export const SECRET_WHY = 'Nadie os lo ha pedido: es cosa vuestra';

/** Lo que se lee debajo de «Ir a…» un sitio del que habla un rumor oído. */
export const RUMOR_WHY = 'Lo dice un rumor que oísteis';

/**
 * Los tableros de una localización del mundo, con los nombres de quienes esperan en ellos.
 *
 * @param {any} location
 * @returns {Array<{name: string, place: string, enemies: string[]}>}
 */
function boardsAt(location) {
    const place = text(location?.name);
    return list(location?.boards).filter(Boolean).map((/** @type {any} */ b) => ({
        name: text(b?.name),
        place,
        enemies: list(b?.enemyPlacements ?? b?.enemies).map((/** @type {any} */ e) => text(e?.name ?? e)).filter(Boolean),
    })).filter(b => b.name);
}

/**
 * Qué pide un hito, con dónde. Un `any` pide cualquiera de sus formas; unas pistas, cada una que
 * falta.
 *
 * @param {any} milestone
 * @param {any} asks
 * @param {{boards: Array<{name: string, place: string, enemies: string[]}>, places: Set<string>, where: Record<string, string>, found: number[], won: (place: string, board: string) => boolean}} ctx
 * @returns {StoryWant[]}
 */
function wantsOf(milestone, asks, ctx) {
    const why = `Lo pide la historia: ${text(milestone?.title) || 'lo que tienes entre manos'}`;
    const kind = text(asks?.kind);
    const place = text(asks?.place);
    switch (kind) {
        case 'any':
            return list(asks?.options).flatMap(option => wantsOf(milestone, option, ctx));
        case 'win': {
            const name = text(asks?.board);
            const named = name ? ctx.boards.find(b => fold(b.name) === fold(name) && (!place || fold(b.place) === fold(place))) : null;
            // Ganar en un sitio, sin decir en qué tablero: el primero de allí que queda por ganar.
            const board = named ?? (place && !name ? ctx.boards.find(b => fold(b.place) === fold(place) && b.enemies.length > 0 && !ctx.won(b.place, b.name)) : null);
            if (!board) return place ? [{ kind: 'arrive', place, why }] : [];
            return [{ kind: 'fight', place: place || board.place, board: board.name, why }];
        }
        case 'defeat': {
            const enemy = fold(asks?.enemy);
            if (!enemy) return [];
            const holds = ctx.boards.filter(b => b.enemies.some(e => fold(e).startsWith(enemy)) && (!place || fold(b.place) === fold(place)));
            const board = holds.find(b => !ctx.won(b.place, b.name)) ?? null;
            if (!board) return place ? [{ kind: 'arrive', place, why }] : [];
            return [{ kind: 'fight', place: board.place, board: board.name, why }];
        }
        case 'arrive':
            return place ? [{ kind: 'arrive', place, why }] : [];
        case 'talk': {
            const npc = text(asks?.npc);
            const at = place || text(ctx.where[fold(npc)]);
            return at ? [{ kind: 'talk', place: at, npc, why }] : [];
        }
        case 'check': {
            // Sin sitio escrito, donde pasa su escena si es una localización («Castillo de Vane»).
            const backdrop = text(milestone?.backdrop);
            const at = place || (ctx.places.has(fold(backdrop)) ? backdrop : '');
            return text(asks?.skill) ? [{ kind: 'check', place: at, skill: text(asks.skill), why }] : [];
        }
        case 'clues':
            return list(asks?.clues)
                .map((clue, index) => ({ clue, index }))
                .filter(({ index }) => !ctx.found.includes(index))
                .filter(({ clue }) => text(clue?.place) && text(clue?.skill))
                .map(({ clue }) => ({ kind: /** @type {'check'} */ ('check'), place: text(clue.place), skill: text(clue.skill), clue: true, why }));
        default:
            return [];
    }
}

/**
 * Lo que pide el encargo aceptado: ir a su sitio y, allí, su tablero; o, si se resuelve sin
 * pelear, intentarlo hablando.
 *
 * @param {any} taken
 * @param {Array<{name: string, place: string, enemies: string[]}>} boards
 * @returns {StoryWant[]}
 */
function contractWants(taken, boards) {
    const place = text(taken?.locationName);
    if (!place) return [];
    const why = `El encargo de ${text(taken?.patron) || 'alguien'}: ${text(taken?.title) || 'lo aceptado'}`;
    if (taken?.noFight) return [{ kind: 'check', place, skill: 'persuasion', contract: true, why }];
    const written = text(taken?.boardName);
    const made = `${text(taken?.title)} (encargo)`;
    const board = boards.find(b => fold(b.place) === fold(place) && (written ? fold(b.name) === fold(written) : fold(b.name) === fold(made)))
        ?? (written ? { name: written, place, enemies: [] } : null);
    return board ? [{ kind: 'fight', place, board: board.name, contract: true, why }] : [{ kind: 'arrive', place, contract: true, why }];
}

/**
 * @param {number} days
 * @returns {string}
 */
const daysText = (days) => (Number(days) === 1 ? '1 día de viaje' : `${Math.max(1, Math.round(Number(days) || 1))} días de viaje`);

/**
 * Lo que pide ahora la historia y el encargo aceptado, como pasos claros: viajar adonde mandan,
 * ir al tablero donde espera la pelea (si se está ya en su sitio) o intentar lo que piden.
 *
 * - **Viajar** solo a lo que pide algo: el sitio de un hito abierto (o donde está la persona con
 *   quien hay que hablar, o el tablero donde espera a quien hay que vencer), o el del encargo. Si
 *   queda lejos, al primer sitio del camino («Ir a El Pueblo de Barro», «De camino a…»).
 * - **El tablero de aquí** que pide la historia, salvo el abierto, uno ya ganado o uno al que ya
 *   lleva una conversación escrita (`talked`: la de Brunilda lleva a la bodega). Al que se llega
 *   viajando se entra solo al llegar (`party/guided.js`).
 * - **Hablar** con quien pide la historia, si está aquí («Hablar con Tomás»): sin la fila de abajo,
 *   era lo que no se veía de un vistazo.
 * - **Intentarlo**: lo que pide un hito de tirada o una pista que falta, estando en su sitio; y un
 *   encargo que se resuelve sin pelear. Sin la «Tirada» suelta, es por donde se intenta.
 *
 * Lo oculto (los secretos) no se dice. Un sitio que aún no sale en el mapa tampoco.
 *
 * @param {Object} input
 * @param {any[]} [input.milestones] Los hitos del hilo (`readPlot`).
 * @param {{open?: string[], clues?: Record<string, number[]>}} [input.state] El estado del hilo.
 * @param {string} [input.here] Donde está el grupo.
 * @param {string} [input.board] El tablero abierto, si lo hay.
 * @param {any[]} [input.locations] Las localizaciones del mundo, con sus tableros.
 * @param {Record<string, {reach: string, days: number, via?: string, reason?: string}>} [input.reach]
 *   Cómo se llega desde aquí a cada sitio (`reachFrom`).
 * @param {(place: string, board: string) => boolean} [input.won] Si un tablero ya está ganado.
 * @param {any} [input.taken] El encargo aceptado.
 * @param {Record<string, string>} [input.where] Dónde está cada persona, por su nombre.
 * @param {string[]} [input.talked] Los tableros a los que ya lleva una conversación escrita.
 * @param {(name: string) => string} [input.called] Cómo se llama a alguien en pantalla (J13.7: «el
 *   posadero» hasta que se presenta). Sin él, por su nombre.
 * @param {string} [input.home] El pueblo de donde se sale (el del gremio, o donde empieza la campaña):
 *   fuera de él, siempre se puede volver, para no quedarse sin salida al acabar un encargo.
 * @param {Record<string, string>} [input.unfinished] Los tableros ganados con la misión a medias (Tanda 16:
 *   no queda nadie en pie, pero falta salir por la ventana), con lo que falta: se vuelve a ellos a
 *   terminarla. Sin esto, con el modo guiado no habría por dónde volver.
 * @param {string[]} [input.leads] Los sitios adonde lleva un rumor oído y donde aún no se ha estado
 *   («hay una torre en el lago»): alguien os ha dicho dónde, así que se puede ir. Es por donde se da
 *   con los secretos del hilo. Van detrás de lo que pide la historia.
 * @returns {StoryStep[]}
 */
export function storySteps({
    milestones = [], state = {}, here = '', board = '', locations = [], reach = {}, won = () => false, taken = null, where = {}, talked = [],
    called = (name) => name, home = '', unfinished = {}, leads = [],
} = {}) {
    const boards = list(locations).flatMap(boardsAt);
    const places = new Set(list(locations).map((/** @type {any} */ l) => fold(l?.name)).filter(Boolean));
    /** @type {Record<string, string>} */
    const people = {};
    for (const [name, at] of Object.entries(where ?? {})) people[fold(name)] = text(at);
    const open = new Set(list(state?.open).map(text));
    const clues = state?.clues && typeof state.clues === 'object' ? state.clues : {};
    const atHere = (/** @type {string} */ place) => !place || fold(place) === fold(here);
    /** @type {StoryWant[]} */
    const wants = [...contractWants(taken, boards)];
    /** @type {StoryWant[]} */
    const secrets = [];
    for (const milestone of list(milestones)) {
        if (!milestone || !open.has(text(milestone.id))) continue;
        const found = wantsOf(milestone, milestone.asks, { boards, places, where: people, found: list(clues[text(milestone.id)]), won });
        if (!milestone.hidden) {
            wants.push(...found);
            continue;
        }
        // Un secreto (idea 111) no se dice ni manda a ninguna parte. Pero estando ya en su sitio,
        // su pelea o su pista sí se ven, como antes en «Tableros de aquí»: si no, con el modo
        // guiado no habría forma de dar con él. Van detrás de lo que pide la historia.
        secrets.push(...found
            .filter(want => (want.kind === 'fight' || want.kind === 'check') && text(want.place) && atHere(want.place))
            .map(want => ({ ...want, secret: true, why: SECRET_WHY })));
    }
    wants.push(...secrets);

    const ways = /** @type {Record<string, {reach: string, days: number, via?: string, reason?: string}>} */ ({});
    for (const [name, way] of Object.entries(reach ?? {})) ways[fold(name)] = way;
    const spoken = new Set(list(talked).map(fold));
    /** @type {Record<string, string>} */
    const halfDone = {};
    for (const [name, left] of Object.entries(unfinished ?? {})) halfDone[fold(name)] = text(left);

    /** @type {StoryStep[]} */
    const steps = [];
    /** @param {StoryStep} step */
    const add = (step) => {
        const same = steps.find(s => s.id === step.id);
        if (!same) steps.push(step);
        // Lo que ya pide la historia no se vuelve a decir como secreto.
        else if (step.secret) return;
        // El mismo sitio por dos motivos: los dos, y al llegar, el tablero del primero.
        else if (!same.detail.includes(step.detail)) same.detail = `${same.detail} · ${step.detail}`;
    };
    for (const want of wants) {
        if (!atHere(want.place)) {
            const way = ways[fold(want.place)];
            // Un sitio que no sale en el mapa (aún escondido) no se dice: sería contarlo.
            if (!way) continue;
            const far = way.reach === 'far' && text(way.via);
            const shut = way.reach === 'shut' || way.reach === 'none';
            const hop = far ? text(way.via) : want.place;
            add({
                id: `story:go:${hop}`,
                kind: 'go',
                label: `Ir a ${hop}`,
                detail: shut ? `${want.why}. ${text(way.reason) || 'El camino está cerrado.'}`
                    : far ? `${want.why}. De camino a ${want.place}`
                        : `${want.why} · ${daysText(way.days)}`,
                enabled: !shut,
                place: hop,
                target: want.place,
                ...(want.board && !far ? { board: want.board } : {}),
            });
            continue;
        }
        if (want.kind === 'fight' && want.board) {
            // Ganado con la misión a medias: se vuelve a terminarla, aunque se gane ya sin pelea.
            const left = fold(want.board) in halfDone;
            if (fold(want.board) === fold(board) || (won(here, want.board) && !left) || (spoken.has(fold(want.board)) && !left)) continue;
            const detail = left ? `${want.why} · Falta: ${halfDone[fold(want.board)] || 'terminar lo de allí'}` : want.why;
            add({
                id: `story:board:${want.board}`, kind: 'board', label: `Ir a ${want.board}`, detail, enabled: true, board: want.board,
                ...(want.secret ? { secret: true } : {}),
            });
            continue;
        }
        // Hablar con quien pide la historia, que está aquí. En un tablero, no: allí se pelea.
        if (want.kind === 'talk' && want.npc && !text(board)) {
            add({ id: `story:talk:${want.npc}`, kind: 'talk', label: `Hablar con ${called(want.npc) || want.npc}`, detail: want.why, enabled: true, npc: want.npc });
            continue;
        }
        // Lo que se intenta, fuera de los tableros: en un tablero se pelea.
        if (want.kind === 'check' && want.skill && !text(board)) {
            const skill = /** @type {keyof typeof SKILLS} */ (want.skill);
            const name = SKILLS[skill]?.label ?? want.skill;
            add({
                id: `story:check:${want.skill}`,
                kind: 'check',
                label: want.contract ? `Resolverlo hablando (${name})` : want.clue ? `Buscar una pista (${name})` : `Intentarlo (${name})`,
                detail: want.why,
                enabled: true,
                skill: want.skill,
                ...(want.secret ? { secret: true } : {}),
            });
        }
    }
    // Adonde lleva un rumor oído: alguien os ha dicho dónde. Fuera de los tableros, y sin repetir
    // un sitio al que ya manda la historia.
    for (const place of text(board) ? [] : list(leads).map(text).filter(Boolean)) {
        const way = atHere(place) ? null : ways[fold(place)];
        if (!way || way.reach === 'shut' || way.reach === 'none') continue;
        const far = way.reach === 'far' && text(way.via);
        const hop = far ? text(way.via) : place;
        if (steps.some(step => step.id === `story:go:${hop}`)) continue;
        add({
            id: `story:go:${hop}`,
            kind: 'go',
            label: `Ir a ${hop}`,
            detail: far ? `${RUMOR_WHY}. De camino a ${place}` : `${RUMOR_WHY} · ${daysText(way.days)}`,
            enabled: true,
            place: hop,
            target: place,
        });
    }
    // Volver al pueblo de donde se sale: al acabar un encargo lejos, lo demás (el tablón, la
    // posada, la tienda) está allí. Va el último, y fuera de los tableros.
    const homeWay = text(home) && !atHere(home) && !text(board) ? ways[fold(home)] : null;
    if (homeWay && homeWay.reach !== 'shut' && homeWay.reach !== 'none') {
        const far = homeWay.reach === 'far' && text(homeWay.via);
        const hop = far ? text(homeWay.via) : text(home);
        // Si la historia ya manda allí, ese botón basta (y dice por qué).
        if (!steps.some(step => step.id === `story:go:${hop}`)) add({
            id: `story:go:${hop}`,
            kind: 'go',
            label: far ? `Ir a ${hop}` : `Volver a ${hop}`,
            detail: far ? `De vuelta a ${text(home)}` : `De vuelta al pueblo · ${daysText(homeWay.days)}`,
            enabled: true,
            place: hop,
            target: text(home),
        });
    }
    return steps;
}

/**
 * Al llegar a un sitio, el tablero donde la historia o el encargo esperan una pelea: el que se
 * buscaba al salir (`wanted`) si sigue valiendo; si no, el primero que pidan. Vacío si no hay.
 * Un secreto que está allí no: a ese se entra si se quiere.
 *
 * @param {Parameters<typeof storySteps>[0] & {wanted?: string}} input
 * @returns {string}
 */
export function boardOnArrival(input) {
    const wanted = text(input?.wanted);
    // Al llegar no cuenta lo que lleva una conversación: se ha venido a eso.
    const steps = storySteps({ ...input, talked: [] })
        .filter(step => step.kind === 'board' && step.board && (!step.secret || fold(step.board) === fold(wanted)));
    const chosen = (wanted && steps.find(step => fold(step.board) === fold(wanted))) || steps[0];
    return chosen?.board ?? '';
}

// ---------------------------------------------------------------------------------------
// Que a cada tablero se llegue: la comprobación de los paquetes.

/**
 * Los tableros a los que lleva una opción de conversación (`{"board": "…"}` en sus efectos):
 * las charlas y las escenas de los hitos, en cualquier rama (también las de una tirada).
 *
 * @param {any} value Un paquete, una charla, un hito o una lista de ellos.
 * @returns {string[]}
 */
export function boardsByTalk(value) {
    /** @type {Set<string>} */
    const out = new Set();
    /** @param {any} node @param {number} depth */
    const walk = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 40) return;
        if (Array.isArray(node)) {
            for (const item of node) walk(item, depth + 1);
            return;
        }
        if (Array.isArray(node.effects)) {
            for (const effect of node.effects) if (effect && typeof effect === 'object' && text(effect.board)) out.add(text(effect.board));
        }
        for (const [key, child] of Object.entries(node)) if (key !== 'effects' && child && typeof child === 'object') walk(child, depth + 1);
    };
    walk(value, 0);
    return [...out];
}

/**
 * @typedef {Object} BoardLink Cómo se llega a un tablero de un paquete con el modo guiado.
 * @property {string} board
 * @property {string} place
 * @property {string[]} by `hito:<id>`, `charla:<id>`, `escena:<id>` o `encargo:<id>`.
 * @property {boolean} empty Si no espera nadie en él (un mapa para pasear, sin pelea).
 */

/**
 * Por dónde se llega a cada tablero de un paquete con el modo guiado: un hito que lo pide (ganar
 * en él, o en su sitio, o vencer a quien espera en él), una opción de conversación que lleva a él
 * o un encargo que se juega en él. Lo que no tiene nada no se puede jugar con el modo guiado.
 *
 * @param {any} pack Un paquete de campaña, tal cual (`public/mundos/*.pack.json`).
 * @returns {BoardLink[]}
 */
export function boardLinks(pack) {
    const boards = list(pack?.boards).map((/** @type {any} */ b) => ({
        id: text(b?.id),
        board: text(b?.name),
        place: text(b?.locationName ?? b?.location),
        enemies: list(b?.enemies ?? b?.enemyPlacements).map((/** @type {any} */ e) => text(e?.name ?? e)).filter(Boolean),
    })).filter(b => b.board);
    /** @type {Map<string, Set<string>>} */
    const by = new Map(boards.map(b => [fold(b.board), new Set()]));
    const mark = (/** @type {string} */ name, /** @type {string} */ why) => by.get(fold(name))?.add(why);

    /** @param {any} asks @param {string} why */
    const fromAsks = (asks, why) => {
        const kind = text(asks?.kind);
        const place = fold(asks?.place);
        if (kind === 'any') for (const option of list(asks?.options)) fromAsks(option, why);
        if (kind === 'win') {
            if (text(asks?.board)) mark(asks.board, why);
            else if (place) for (const b of boards.filter(x => fold(x.place) === place)) mark(b.board, why);
        }
        if (kind === 'defeat' && text(asks?.enemy)) {
            const enemy = fold(asks.enemy);
            for (const b of boards.filter(x => x.enemies.some(e => fold(e).startsWith(enemy)) && (!place || fold(x.place) === place))) mark(b.board, why);
        }
    };
    for (const milestone of list(pack?.plot?.milestones)) {
        // Un secreto (idea 111) no manda a su tablero: se da con él si se pasa por allí.
        fromAsks(milestone?.asks, `${milestone?.hidden ? 'secreto' : 'hito'}:${text(milestone?.id)}`);
        for (const name of boardsByTalk(milestone?.beats ?? [])) mark(name, `escena:${text(milestone?.id)}`);
        for (const name of boardsByTalk(milestone?.dialogue ?? null)) mark(name, `escena:${text(milestone?.id)}`);
    }
    for (const dialogue of list(pack?.dialogues)) {
        for (const name of boardsByTalk(dialogue)) mark(name, `charla:${text(dialogue?.id)}`);
    }
    for (const contract of list(pack?.contracts)) {
        const target = text(contract?.boardName) || boards.find(b => b.id && b.id === text(contract?.boardId))?.board || '';
        if (target) mark(target, `encargo:${text(contract?.id)}`);
    }
    return boards.map(b => ({ board: b.board, place: b.place, by: [...(by.get(fold(b.board)) ?? [])], empty: b.enemies.length === 0 }));
}

/**
 * Los tableros de un paquete a los que no se llega con el modo guiado. Los que no tienen a nadie
 * esperando (un mapa para pasear) van aparte: no hay pelea que perderse. Y aparte también los que
 * solo pide un secreto (`secret`): a esos se llega pasando por su sitio, si la historia pasa por él.
 *
 * @param {any} pack
 * @returns {{fights: string[], empty: string[], secret: string[]}}
 */
export function unreachableBoards(pack) {
    const links = boardLinks(pack);
    const loose = links.filter(link => link.by.length === 0);
    return {
        fights: loose.filter(l => !l.empty).map(l => l.board),
        empty: loose.filter(l => l.empty).map(l => l.board),
        secret: links.filter(l => l.by.length > 0 && l.by.every(why => why.startsWith('secreto:'))).map(l => l.board),
    };
}
