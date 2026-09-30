/**
 * Añadir una campaña al tablón del gremio desde un archivo (J5.4 de ROADMAP_SIN_CONEXION).
 *
 * Tus campañas llegan en JSON, de dos formas:
 *
 * - **El paquete del juego**, el que valida `validatePack` (como `public/mundos/strahd.pack.json`).
 * - **Lo que devuelve tu Gem** ([[GEM_CREAR_CAMPANA]]), como `wiki/campanas/strahd/original.json`:
 *   el mismo paquete, pero con la cabecera del esquema (`$schema`, `title`, `description`),
 *   las marcas `[cite: N]` del que resume el libro y las rutas escritas en un solo sentido.
 *
 * Lo segundo se pone en limpio con lo mismo que usa `tools/campana-a-paquete.mjs` (que lo
 * importa de aquí), y después los dos pasan por el mismo validador que el resto del juego. Lo
 * que falla se dice en castellano, con el sitio donde está.
 *
 * La tarjeta del tablón necesita dos cosas que el paquete no trae: para qué nivel es y a
 * cuántos días queda. El paquete puede decirlas (`world.levels: [1, 6]` y `world.journey:
 * {days, how}`); si no, los niveles salen del desafío de sus bichos y el camino es de
 * `DEFAULT_JOURNEY_DAYS` días. Es rellenar un hueco con el motor (J5.3), no inventar la campaña.
 *
 * Puro: lee, pone en limpio, valida y describe. Quien llama guarda el paquete y su fila.
 */

import { validatePack } from './campaign-pack.js';
import { readLevelRange } from '../combat/level-adjust.js';
import { HUB_IMPORTED_PREFIX } from './hub.js';
import { fillPackGaps } from './pack-fill.js';
import { checkCampaign } from './campaign-check.js';
import { readPackMaps } from './pack-maps.js';

/** A cuántos días queda una campaña que no lo dice. */
export const DEFAULT_JOURNEY_DAYS = 5;

/** La cabecera que el Gem copia del esquema y que no es parte del paquete. */
const GEM_HEADER = ['$schema', 'title', 'description'];

/** Cuántos fallos se enseñan: bastantes para arreglar, no tantos que el primero se pierda. */
const MAX_PROBLEMS = 8;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Quita las marcas del resumidor (`[cite: 12]`) y la de «texto propio» (`propio: `), en
 * todo lo que haya dentro.
 *
 * @param {any} value
 * @returns {any}
 */
export function cleanGemText(value) {
    if (typeof value === 'string') {
        return value.replace(/\s*\[cite:[^\]]*\]/g, '').replace(/^propio:\s*/, '').trim();
    }
    if (Array.isArray(value)) return value.map(cleanGemText);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanGemText(v)]));
    }
    return value;
}

/**
 * Dos listas en una, por su clave (sin mayúsculas): lo de encima gana campo a campo.
 *
 * @param {any[]} base
 * @param {any[]} over
 * @param {string} key
 * @returns {any[]}
 */
export function mergeBy(base, over, key) {
    const out = (Array.isArray(base) ? base : []).map(row => ({ ...row }));
    for (const row of Array.isArray(over) ? over : []) {
        const at = out.findIndex(r => String(r?.[key]).toLowerCase() === String(row?.[key]).toLowerCase());
        if (at >= 0) out[at] = { ...out[at], ...row };
        else out.push({ ...row });
    }
    return out;
}

/**
 * Cada ruta, también de vuelta: en tu formato basta con escribir una. Cambia las
 * localizaciones que recibe y las devuelve.
 *
 * @param {any[]} locations
 * @returns {any[]}
 */
export function bothWays(locations) {
    const byName = new Map(locations.map(l => [String(l.name).toLowerCase(), l]));
    for (const place of locations) {
        for (const route of Array.isArray(place.routes) ? place.routes : []) {
            const other = byName.get(String(route.to).toLowerCase());
            if (!other) continue;
            other.routes = Array.isArray(other.routes) ? other.routes : [];
            if (other.routes.some((/** @type {any} */ r) => String(r.to).toLowerCase() === String(place.name).toLowerCase())) continue;
            other.routes.push({ to: place.name, days: route.days, ...(route.closedUntil ? { closedUntil: route.closedUntil } : {}) });
        }
    }
    return locations;
}

/**
 * Si un JSON es lo que devuelve el Gem y no un paquete ya en limpio: trae la cabecera del
 * esquema o las marcas del resumidor.
 *
 * @param {any} raw
 * @returns {boolean}
 */
export function isGemJson(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    return GEM_HEADER.some(key => key in raw) || /\[cite:/.test(JSON.stringify(raw));
}

/**
 * Lo que devuelve el Gem, puesto en limpio como paquete: sin cabecera ni marcas, con su
 * versión y con cada ruta en los dos sentidos.
 *
 * @param {any} raw
 * @returns {any}
 */
export function packFromGemJson(raw) {
    const pack = cleanGemText(raw);
    for (const key of GEM_HEADER) delete pack[key];
    pack.version = pack.version ?? 1;
    if (Array.isArray(pack.locations)) pack.locations = bothWays(pack.locations);
    return pack;
}

/** Un número, `true`, `false` o `null`, justo donde se mira. */
const JSON_LITERAL = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

/**
 * Dónde se rompe un JSON que no se lee. El mensaje del navegador viene en inglés, y cada
 * navegador lo dice a su manera (unos dan la posición, otros un trozo del texto): esto
 * recorre el texto y da el sitio exacto, igual en todos.
 *
 * @param {string} source
 * @returns {number} La posición del primer carácter que sobra o falta; el largo del texto si
 *   se corta antes de acabar.
 */
function jsonErrorAt(source) {
    let i = 0;
    const blank = () => { while (i < source.length && ' \t\n\r'.includes(source[i])) i++; };
    const fail = () => { throw i; };
    const string = () => {
        i++;
        while (i < source.length) {
            if (source[i] === '"') { i++; return; }
            if (source[i] < ' ') fail();
            if (source[i] === '\\' && !'"\\/bfnrtu'.includes(source[i + 1] ?? '"')) { i++; fail(); }
            i += source[i] === '\\' ? 2 : 1;
        }
        fail();
    };
    /** @param {string} close @param {() => void} item */
    const list = (close, item) => {
        i++;
        blank();
        if (source[i] === close) { i++; return; }
        for (;;) {
            item();
            blank();
            if (source[i] === ',') { i++; continue; }
            if (source[i] === close) { i++; return; }
            fail();
        }
    };
    const value = () => {
        blank();
        if (source[i] === '{') {
            list('}', () => {
                blank();
                if (source[i] !== '"') fail();
                string();
                blank();
                if (source[i] !== ':') fail();
                i++;
                value();
            });
        } else if (source[i] === '[') list(']', value);
        else if (source[i] === '"') string();
        else {
            JSON_LITERAL.lastIndex = i;
            const literal = JSON_LITERAL.exec(source);
            if (!literal) fail();
            i += literal[0].length;
        }
    };
    try {
        value();
        blank();
        if (i < source.length) fail();
    } catch (at) {
        if (typeof at === 'number') return Math.min(at, source.length);
    }
    return source.length;
}

/**
 * Por qué no se lee un JSON, en castellano y con la línea y la columna.
 *
 * @param {string} body
 * @returns {string}
 */
function jsonProblem(body) {
    const at = jsonErrorAt(body);
    if (at >= body.length) return 'se corta antes de acabar. Falta el final del archivo, o cerrar unas llaves.';
    const before = body.slice(0, at).split('\n');
    return `algo falla en la línea ${before.length}, columna ${before[before.length - 1].length + 1}. `
        + 'Suele ser una coma de más o de menos, o unas comillas sin cerrar.';
}

/**
 * @typedef {Object} CampaignFileReport
 * @property {boolean} ok Si se puede añadir al tablón.
 * @property {'pack'|'gem'|''} kind Cómo venía: el paquete del juego, o lo que da el Gem.
 * @property {any} pack El paquete en limpio, listo para guardar. Null si no vale.
 * @property {string} headline Lo que pasa, en una frase.
 * @property {Array<{path: string, message: string}>} problems Lo que hay que arreglar.
 * @property {number} more Los fallos que no caben en la lista.
 * @property {string[]} notes Lo que se ha puesto en limpio al leerlo.
 * @property {import('./campaign-check.js').CampaignCheck|null} check J5.6: la campaña,
 *   comprobada antes de jugarla. Null si ni siquiera es una campaña.
 * @property {import('./pack-fill.js').FillNote[]} filled J5.3: lo que ha puesto el motor.
 */

/**
 * @param {string} headline
 * @returns {CampaignFileReport}
 */
const refused = (headline) => ({ ok: false, kind: '', pack: null, headline, problems: [], more: 0, notes: [], check: null, filled: [] });

/**
 * @typedef {Object} ParsedCampaign Un JSON de campaña leído y puesto en limpio, aún sin rellenar.
 * @property {'pack'|'gem'} kind
 * @property {any} clean
 * @property {string[]} notes
 */

/**
 * La primera mitad de leer una campaña: que sea JSON, que sea una campaña y, si viene del Gem,
 * en limpio. Lo que no pasa de aquí vuelve ya como informe.
 *
 * @param {string} content
 * @returns {{refused: CampaignFileReport}|ParsedCampaign}
 */
function parseCampaignText(content) {
    const raw = String(content ?? '').trim();
    const body = (raw.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i)?.[1] ?? raw).trim();
    if (!body) return { refused: refused('El archivo está vacío.') };

    /** @type {any} */
    let parsed = null;
    // D-J35: pegado del chat del Gem, puede traer lo que dice alrededor («Aquí tienes tu
    // campaña:…»). Si tal cual no se lee, se prueba con su bloque ```json o con lo que va de la
    // primera llave a la última.
    let around = false;
    try {
        parsed = JSON.parse(body);
    } catch {
        const block = raw.match(/```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```/i)?.[1]?.trim() ?? '';
        const first = body.indexOf('{');
        const last = body.lastIndexOf('}');
        const inner = block.startsWith('{') ? block : (first >= 0 && last > first ? body.slice(first, last + 1) : '');
        try {
            if (!inner || inner === body) throw new Error('igual');
            parsed = JSON.parse(inner);
            around = true;
        } catch {
            return { refused: refused(`No es un JSON válido: ${jsonProblem(body)}`) };
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { refused: refused('Esto no es una campaña: el archivo tiene que ser un solo objeto JSON, con su mundo y sus tableros.') };
    }
    if (!parsed.world && !parsed.boards) {
        return { refused: refused('Esto no es una campaña: no trae ni el mundo («world») ni los tableros («boards»).') };
    }

    const kind = isGemJson(parsed) ? 'gem' : 'pack';
    const clean = kind === 'gem' ? packFromGemJson(parsed) : parsed;
    /** @type {string[]} */
    const notes = around ? ['Traía texto antes o después de la campaña: se ha quitado.'] : [];
    if (kind === 'gem') {
        const cites = (JSON.stringify(parsed).match(/\[cite:[^\]]*\]/g) ?? []).length;
        const marks = cites === 1 ? 'se ha quitado una marca [cite]' : `se han quitado ${cites} marcas [cite]`;
        notes.push(cites > 0
            ? `Venía de tu Gem: ${marks} y la cabecera del esquema.`
            : 'Venía de tu Gem: se ha quitado la cabecera del esquema.');
    }
    return { kind, clean, notes };
}

/**
 * La segunda mitad: el motor rellena lo que falte (J5.3), se valida y se comprueba (J5.6).
 *
 * @param {ParsedCampaign} parsed
 * @param {Object} options
 * @param {any} [options.compendium]
 * @param {import('./pack-fill.js').FillNote[]} [options.before] Lo ya puesto antes (J12.5: los
 *   mapas leídos de su dibujo).
 * @returns {CampaignFileReport}
 */
function finishCampaignRead({ kind, clean, notes }, { compendium = null, before = [] }) {
    // J5.3: lo que falta, lo pone el motor, con la semilla de la campaña.
    const fill = fillPackGaps(clean, { compendium });
    const pack = fill.pack;
    const filled = [...before, ...fill.filled];
    const boards = new Set(filled.filter(f => f.kind === 'tablero').map(f => f.name)).size;
    const creatures = new Set(filled.filter(f => f.kind === 'criatura').map(f => f.name)).size;
    const drawn = new Set(filled.filter(f => f.kind === 'mapa').map(f => f.name)).size;
    if (drawn > 0) notes.push(`${drawn === 1 ? 'Un tablero traía su dibujo sin su mapa: se ha leído' : `${drawn} tableros traían su dibujo sin su mapa: se han leído`} del dibujo.`);
    if (filled.some(f => f.kind !== 'mapa')) {
        const said = [
            boards > 0 ? `${boards} ${boards === 1 ? 'tablero' : 'tableros'}` : '',
            creatures > 0 ? `${creatures} ${creatures === 1 ? 'criatura' : 'criaturas'}` : '',
        ].filter(Boolean);
        notes.push(said.length > 0
            ? `Lo que faltaba lo ha puesto el juego: ${said.join(' y ')}, y lo demás que se cuenta abajo.`
            : 'Lo que faltaba lo ha puesto el juego: se cuenta abajo.');
    }

    const report = validatePack(pack);
    const check = checkCampaign(pack, { filled, validation: report });
    if (!report.ok) {
        const count = report.errors.length;
        return {
            ok: false,
            kind,
            pack: null,
            headline: `La campaña tiene ${count} ${count === 1 ? 'fallo' : 'fallos'} que arreglar antes de jugarla.`,
            problems: report.errors.slice(0, MAX_PROBLEMS).map(issue => ({ path: text(issue.path), message: text(issue.message) })),
            more: Math.max(0, count - MAX_PROBLEMS),
            notes,
            check,
            filled,
        };
    }
    const c = report.counts;
    return {
        ok: true,
        kind,
        pack,
        headline: `${c.world}: ${c.locations} localizaciones, ${c.boards} tableros, ${c.enemies} enemigos y ${c.quests} misiones.`,
        problems: [],
        more: 0,
        notes,
        check,
        filled,
    };
}

/**
 * Leer el archivo de una campaña: comprobar que es JSON, ponerlo en limpio si viene del Gem y
 * validarlo como el paquete que es.
 *
 * Acepta también el JSON dentro de un bloque ```json, como lo copia quien lo saca del chat
 * del Gem.
 *
 * J5.3: antes de validar, el motor rellena lo que falte (tableros, bichos, textos, el final),
 * y lo dice. J5.6: después, la campaña se comprueba entera (`check`), haya entrado o no.
 *
 * @param {string} content El texto del archivo.
 * @param {Object} [options]
 * @param {any} [options.compendium] El compendio del juego, para sacar de él bichos y frases.
 *   Sin él, los bichos salen con los números de su desafío y los textos se quedan como están.
 * @returns {CampaignFileReport}
 */
export function readCampaignText(content, { compendium = null } = {}) {
    const parsed = parseCampaignText(content);
    return 'refused' in parsed ? parsed.refused : finishCampaignRead(parsed, { compendium });
}

/**
 * Lo mismo que `readCampaignText` y, antes de rellenar, J12.5: el mapa de cada tablero que trae
 * su dibujo (`image`) y no su mapa se lee del dibujo (`pack-maps.js`). Es lo que usa el tablón
 * del gremio, que puede abrir imágenes.
 *
 * @param {string} content
 * @param {Object} [options]
 * @param {any} [options.compendium]
 * @param {((src: string) => Promise<import('../board/map-image.js').MapPixels>)|null} [options.loadPixels]
 *   Abre una imagen y da sus píxeles. Sin él, como `readCampaignText`.
 * @returns {Promise<CampaignFileReport>}
 */
export async function readCampaignFile(content, { compendium = null, loadPixels = null } = {}) {
    const parsed = parseCampaignText(content);
    if ('refused' in parsed) return parsed.refused;
    if (!loadPixels) return finishCampaignRead(parsed, { compendium });
    const drawn = await readPackMaps(parsed.clean, { loadPixels });
    return finishCampaignRead({ ...parsed, clean: drawn.pack }, { compendium, before: drawn.filled });
}

/**
 * Para qué nivel es una campaña: lo que diga (`world.levels`) o, si no, lo que sale del
 * desafío de sus bichos: del más flojo (como poco nivel 1) al más duro, redondeando arriba.
 * Con Strahd sale «1 a 6», que es lo que dice su fila del tablón.
 *
 * @param {any} pack
 * @returns {[number, number]|null} Null si no trae bichos ni lo dice.
 */
export function levelsOfPack(pack) {
    const written = readLevelRange(pack?.world?.levels);
    if (written) return [written.min, written.max];
    const ratings = (Array.isArray(pack?.bestiary) ? pack.bestiary : [])
        .map((/** @type {any} */ b) => Number(b?.cr))
        .filter(n => Number.isFinite(n) && n >= 0);
    if (ratings.length === 0) return null;
    const min = Math.min(20, Math.max(1, Math.floor(Math.min(...ratings))));
    const max = Math.min(20, Math.max(min + 1, Math.ceil(Math.max(...ratings))));
    return [min, max];
}

/**
 * A cuántos días queda del pueblo, y cómo se va: lo que diga (`world.journey`) o el camino
 * de siempre.
 *
 * @param {any} pack
 * @returns {{days: number, how: string}}
 */
export function journeyOfPack(pack) {
    const days = Math.floor(Number(pack?.world?.journey?.days) || 0);
    return { days: days > 0 ? Math.min(days, 60) : DEFAULT_JOURNEY_DAYS, how: text(pack?.world?.journey?.how) };
}

/**
 * El id en el tablón de una campaña añadida: su nombre, sin tildes, con `tuya-` delante para
 * que no pise a las que vienen con el juego. La misma campaña añadida otra vez es la misma.
 *
 * @param {string} name
 * @returns {string}
 */
export function importedCampaignId(name) {
    const slug = text(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
    return `${HUB_IMPORTED_PREFIX}${slug || 'campana'}`;
}

/**
 * El nombre del archivo del paquete entre tus archivos. Solo letras, números y guiones: es lo
 * que admite el servidor al subirlo.
 *
 * @param {string} id
 * @returns {string}
 */
export function importedPackFileName(id) {
    return `campana-${text(id).replace(/[^A-Za-z0-9_-]/g, '-')}.pack.json`;
}

/**
 * La fila del tablón de una campaña añadida, con la misma forma que las de `mundos.json`, para
 * que la tarjeta, el viaje y el empezar la traten igual.
 *
 * @param {any} pack El paquete en limpio.
 * @param {Object} input
 * @param {string} input.id
 * @param {string} input.packUrl Dónde se ha guardado.
 * @returns {any}
 */
export function importedCampaignRow(pack, { id, packUrl }) {
    const levels = levelsOfPack(pack);
    return {
        id: text(id),
        name: text(pack?.world?.name) || text(id),
        genre: text(pack?.world?.genre),
        // D-J35: también se añade pegando el texto: no se dice de dónde vino.
        note: 'Añadida por ti.',
        synopsis: text(pack?.world?.synopsis),
        icon: 'fa-book-open',
        seed: text(id),
        templateId: 'tavern',
        pack: text(packUrl),
        ...(levels ? { levels } : {}),
        journey: journeyOfPack(pack),
        imported: true,
    };
}
