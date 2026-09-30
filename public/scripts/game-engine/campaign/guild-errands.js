/**
 * Los encargos cortos del gremio, entre campaña y campaña (J3.8 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El tablón de encargos ya existía (`contracts.js`, `written-contracts.js`): en cada mundo mezcla
 * los que trae escritos con los que se generan, vencen, pagan y dan renombre. En el gremio no
 * había ninguno escrito y el tablón no se ofrecía. Ahora:
 *
 * - **El gremio trae los suyos** (`gremio.pack.json`, `contracts`): recados de la gente de Puerto
 *   Alba (Marisa, Tomás, Ramiro, Madre Elvira, Brunilda), cada uno con su tablero en un sitio de
 *   los alrededores que empieza escondido: la cala, el faro, el camino de la costa… **Aceptar el
 *   encargo lo revela**: aparece en el mapa, a un día de camino.
 * - **Se ven como tarjetas** en la sala del gremio: quién lo pide, dónde, lo que paga, lo que
 *   queda de plazo y cómo se resuelve (una pelea, o hablando allí mismo).
 * - **Uno a la vez**: el que tenéis entre manos sale arriba, con adónde ir.
 * - **Los gremios de antes** no tienen estos sitios ni estos encargos (se escribieron al crear la
 *   partida). `upgradeHubWorld` los añade sin tocar lo que ya hay.
 *
 * Puro: describe y dice qué añadir. Aceptar, pagar y revelar lo hace quien llama.
 */

import { RANKS, deadlineOf } from './contracts.js';
import { buildImportPlan, buildPackEntries } from './campaign-importer.js';
import { normalizePack } from './campaign-pack.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const key = (value) => text(value).toLowerCase();

/** Cómo se lee cada rango de encargo. */
const RANK_LABELS = Object.fromEntries(RANKS.map(rank => [rank.id, rank.label]));

/** Los días, dichos: «un día», «tres días». */
const DAY_WORDS = ['', 'un día', 'dos días', 'tres días', 'cuatro días', 'cinco días', 'seis días', 'siete días'];

/**
 * @param {number} n
 * @returns {string}
 */
function daysSaid(n) {
    const days = Math.max(0, Math.floor(Number(n) || 0));
    return DAY_WORDS[days] ?? `${days} días`;
}

/**
 * Cuántos días de camino hay desde un sitio a otro, por sus rutas (en cualquiera de los dos
 * sentidos). 0 si no hay ruta escrita entre ellos.
 *
 * @param {any[]} locations
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function routeDays(locations, from, to) {
    const all = Array.isArray(locations) ? locations : [];
    const ways = [
        ...all.filter(l => key(l?.name) === key(from)).flatMap(l => (Array.isArray(l?.routes) ? l.routes : []).filter((/** @type {any} */ r) => key(r?.to) === key(to))),
        ...all.filter(l => key(l?.name) === key(to)).flatMap(l => (Array.isArray(l?.routes) ? l.routes : []).filter((/** @type {any} */ r) => key(r?.to) === key(from) && !r?.oneWay)),
    ];
    return ways.length > 0 ? Math.max(1, Math.min(...ways.map((/** @type {any} */ r) => Math.floor(Number(r?.days) || 1)))) : 0;
}

/**
 * @typedef {Object} ErrandCard
 * @property {string} id
 * @property {string} title
 * @property {string} rank     La letra del rango: D, C, B…
 * @property {string} rankLabel «Recados».
 * @property {string} patron   «Lo pide Marisa».
 * @property {string} where    «En La cala del norte, a un día de camino. Aún no la conocéis: al aceptarlo sale en el mapa».
 * @property {string} how      «Una pelea en La playa de la cala.» / «Se resuelve allí mismo, hablando o con una tirada.»
 * @property {string} pay      «25 de oro».
 * @property {string} due      «Quedan 20 días» / «Vence mañana».
 * @property {boolean} urgent
 * @property {boolean} written Si es de los escritos (de la gente del pueblo).
 * @property {boolean} enabled
 * @property {string} why      Por qué no se puede aceptar, si no se puede.
 */

/**
 * Dónde y cómo se juega un encargo, dicho para su tarjeta.
 *
 * @param {any} contract
 * @param {{here: string, locations: any[], hidden: any[]}} input
 * @returns {{where: string, how: string, secret: boolean}}
 */
function placeOf(contract, { here, locations, hidden }) {
    const place = text(contract?.locationName);
    const secret = Boolean(place) && (Array.isArray(hidden) ? hidden : []).some(l => key(l?.name) === key(place));
    const days = routeDays([...(Array.isArray(locations) ? locations : []), ...(Array.isArray(hidden) ? hidden : [])], here, place);
    const where = !place ? 'En un sitio que se prepara al aceptarlo.'
        : key(place) === key(here) ? `Aquí mismo, en ${place}.`
            : [`En ${place}${days > 0 ? `, a ${daysSaid(days)} de camino` : ''}.`, secret ? 'Aún no lo conocéis: al aceptarlo sale en el mapa.' : ''].filter(Boolean).join(' ');
    const how = contract?.noFight ? 'Se resuelve allí mismo, sin pelear: hablando o con una tirada.'
        : text(contract?.boardName) ? `Una pelea en «${text(contract.boardName)}».`
            : 'Una pelea, en un sitio que se prepara al aceptarlo.';
    return { where, how, secret };
}

/**
 * Los encargos del tablón del gremio como tarjetas, y el que tenéis entre manos.
 *
 * @param {Object} input
 * @param {any[]} input.board Los del tablón (`BOARD_KEY`).
 * @param {any} [input.taken] El aceptado (`TAKEN_KEY`), si lo hay.
 * @param {number} input.day Hoy.
 * @param {string} input.here Dónde está el grupo.
 * @param {any[]} [input.locations] Las localizaciones que se ven.
 * @param {any[]} [input.hidden] Las que aún no (`hiddenLocations`).
 * @param {boolean} [input.fighting]
 * @returns {{offers: ErrandCard[], taken: {id: string, title: string, patron: string, line: string, place: string}|null}}
 */
export function errandCards({ board, taken = null, day, here, locations = [], hidden = [], fighting = false }) {
    const busy = taken && text(taken.id) ? taken : null;
    const offers = (Array.isArray(board) ? board : []).filter(c => c && text(c.id) && text(c.title)).map(contract => {
        const { daysLeft, expired, urgent } = deadlineOf(contract, day);
        const place = placeOf(contract, { here, locations, hidden });
        const why = fighting ? 'No mientras peleáis.'
            : expired ? 'Se pasó el plazo.'
                : busy ? `Ya tenéis un encargo entre manos: «${text(busy.title)}». Terminadlo antes de coger otro.` : '';
        const reward = Math.max(0, Math.floor(Number(contract.reward) || 0));
        return {
            id: text(contract.id),
            title: text(contract.title),
            rank: text(contract.rank) || 'D',
            rankLabel: /** @type {Record<string, string>} */ (RANK_LABELS)[text(contract.rank) || 'D'] ?? '',
            patron: text(contract.patron) ? `Lo pide ${text(contract.patron)}.` : '',
            where: place.where,
            how: place.how,
            pay: text(contract.rewardText) || (reward > 0 ? `${reward} de oro` : 'Sin paga, por hacer un favor'),
            due: expired ? 'Vencido' : daysLeft === 0 ? 'Vence hoy' : daysLeft === 1 ? 'Vence mañana' : `Quedan ${daysLeft} días`,
            urgent,
            written: Boolean(contract.written),
            enabled: !why,
            why,
        };
    });
    if (!busy) return { offers, taken: null };
    const place = text(busy.locationName);
    const line = busy.noFight
        ? `Id a ${place || 'su sitio'} y resolvedlo allí: hablando con quien toque, o con una tirada que salga bien.`
        : text(busy.boardName)
            ? `Id a ${place} y ganad la pelea de «${text(busy.boardName)}». Al ganarla, se cobra.`
            : `Id a ${place || 'su sitio'} y ganad la pelea. Al ganarla, se cobra.`;
    return {
        offers,
        taken: { id: text(busy.id), title: text(busy.title), patron: text(busy.patron), line: `«${text(busy.title)}»: ${line}`, place },
    };
}

/**
 * Qué sitios hay que revelar al aceptar un encargo: el suyo, si aún está escondido.
 *
 * @param {any} contract
 * @param {any[]} hidden `hiddenLocations` del mundo.
 * @returns {string[]}
 */
export function errandReveal(contract, hidden) {
    const place = text(contract?.locationName);
    if (!place) return [];
    const found = (Array.isArray(hidden) ? hidden : []).find(l => key(l?.name) === key(place));
    return found ? [text(found.name)] : [];
}

/**
 * Lo que se cuenta al aceptar un encargo del gremio: quién lo pide, adónde hay que ir y, si el
 * sitio era nuevo, que ya sale en el mapa.
 *
 * @param {any} contract
 * @param {{revealed: string[], here: string, locations?: any[], hidden?: any[]}} input
 * @returns {string}
 */
export function errandAcceptLine(contract, { revealed, here, locations = [], hidden = [] }) {
    const place = text(contract?.locationName);
    const days = routeDays([...locations, ...hidden], here, place);
    return [
        `Aceptáis «${text(contract?.title)}»${text(contract?.patron) ? `, que pide ${text(contract.patron)}` : ''}.`,
        revealed.length > 0 ? `${revealed.join(' y ')} ya sale en el mapa${days > 0 ? `: está a ${daysSaid(days)} de camino` : ''}.` : '',
        contract?.noFight ? 'Se resuelve allí, sin pelear.' : '',
    ].filter(Boolean).join(' ');
}

/**
 * Poner al día el mundo de un gremio de antes de J3.8 con lo que el paquete del gremio trae
 * ahora: los sitios escondidos de los encargos (con sus tableros), los encargos escritos y las
 * bestias que salen en ellos. No toca nada de lo que ya hay: solo añade lo que falta.
 *
 * Cambia `data` (el mundo, con `metadata` y `entries`). Las bestias se crean con `createEntry`,
 * que es como el importador crea cada entrada del Lorebook.
 *
 * @param {Object} input
 * @param {any} input.data El mundo del gremio.
 * @param {any} input.pack El paquete del gremio (`gremio.pack.json`).
 * @param {(data: any) => any} [input.createEntry] Crea una entrada vacía en el mundo y la devuelve.
 * @returns {{changed: boolean, places: string[], contracts: string[], creatures: string[]}}
 */
export function upgradeHubWorld({ data, pack, createEntry = () => null }) {
    const none = { changed: false, places: [], contracts: [], creatures: [] };
    if (!data || typeof data !== 'object' || !pack) return none;
    const meta = data.metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
    const plan = buildImportPlan(pack);
    const shown = Array.isArray(meta.locationMaps) ? meta.locationMaps : [];
    const hidden = Array.isArray(meta.hiddenLocations) ? meta.hiddenLocations : [];
    const known = new Set([...shown, ...hidden].map(l => key(l?.name)));

    /** @type {string[]} */
    const places = [];
    for (const place of plan.metadata.hiddenLocations ?? []) {
        if (known.has(key(place.name))) continue;
        hidden.push(JSON.parse(JSON.stringify(place)));
        places.push(text(place.name));
    }
    if (places.length > 0) meta.hiddenLocations = hidden;

    // Los tableros nuevos de un sitio que ya se ve (los de Puerto Alba), también.
    for (const place of plan.metadata.locationMaps ?? []) {
        const mine = shown.find(l => key(l?.name) === key(place.name));
        if (!mine) continue;
        mine.boards = Array.isArray(mine.boards) ? mine.boards : [];
        for (const board of place.boards ?? []) {
            if (mine.boards.some((/** @type {any} */ b) => key(b?.name) === key(board.name))) continue;
            mine.boards.push(JSON.parse(JSON.stringify(board)));
            places.push(`${text(place.name)} · ${text(board.name)}`);
        }
    }

    /** @type {string[]} */
    const contracts = [];
    const written = Array.isArray(meta.writtenContracts) ? meta.writtenContracts : [];
    const have = new Set(written.map(c => text(c?.id)));
    for (const contract of plan.metadata.writtenContracts ?? []) {
        if (have.has(text(contract.id))) continue;
        written.push(JSON.parse(JSON.stringify(contract)));
        contracts.push(text(contract.id));
    }
    if (contracts.length > 0) meta.writtenContracts = written;

    /** @type {string[]} */
    const creatures = [];
    const entries = data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : [];
    const named = new Set(entries.map((/** @type {any} */ e) => key(e?.dndData?.name || e?.comment)));
    const { pack: clean } = normalizePack(pack);
    for (const spec of buildPackEntries(clean).filter(s => s.group === 'Monsters')) {
        if (named.has(key(spec.title))) continue;
        const entry = createEntry(data);
        if (!entry) continue;
        entry.comment = spec.title;
        entry.key = spec.keys;
        entry.content = spec.content;
        entry.group = spec.group;
        entry.dndData = spec.dndData;
        named.add(key(spec.title));
        creatures.push(text(spec.title));
    }

    return { changed: places.length + contracts.length + creatures.length > 0, places, contracts, creatures };
}
