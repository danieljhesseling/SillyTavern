/**
 * El mundo se acuerda (J11.3 de wiki/ROADMAP_SIN_CONEXION.md): lo que hicisteis en un pueblo
 * cambia cómo os tratan allí.
 *
 * Robar en la tienda ya subía «buscado» (`crime.js`), y el que manda allí os miraba peor
 * (`world-echoes.js`). Pero Marisa, la de la tienda, os saludaba al día siguiente como si nada,
 * y os cobraba lo mismo. Aquí cada cosa que se hace en un sitio deja una **huella**: qué fue,
 * dónde y cuándo. Y la gente del pueblo reacciona según `compendio/ecos.json`:
 *
 * - **Precios**: la tienda os cobra un 30 % más durante una semana, y dice por qué.
 * - **Trato**: en la capilla no curan a quien levanta muertos. Y quien lo vio os mira peor una
 *   vez (`trato`, con `attitudes.js`).
 * - **El calabozo** (D-J47): a la segunda vez que os pillan robando en la misma tienda, mientras
 *   se acuerdan de la primera, la guardia os lleva un par de días (`calabozo`, con `jailFor`).
 *   Antes, la tienda dejaba de venderos cuatro semanas; era mucho.
 * - **Saludos**: quien atiende os recibe sabiendo lo que hicisteis.
 * - **Rumores**: en la posada se cuenta.
 *
 * Todo se olvida con el tiempo (`dura`, días desde la última vez), como «buscado». Lo que se
 * hace otra vez mientras se acuerdan lo refresca todo; lo de antes de un olvido ya no cuenta.
 *
 * Las huellas se guardan en la partida (`WORLD_MARKS_KEY`): `{deed, town, place, who, day}`.
 * Lo que se hizo (`deed`) es uno de `DEEDS`; dónde, el pueblo (`town`, una localización) y el
 * sitio de dentro (`place`: `tienda`, `posada`…, o vacío).
 *
 * Puro: de las huellas y de las filas, a lo que cambia. Quien llama guarda y enseña.
 */

import { resolveGender } from './grammar.js';

/** En los metadatos de la partida: las huellas. */
export const WORLD_MARKS_KEY = 'worldMarks';

/** Cuántas se recuerdan. Las más viejas se olvidan antes. */
export const MARKS_MAX = 40;

/** Lo que deja huella. */
export const DEEDS = [
    'robo', 'robo-oculto', 'multa', 'huida', 'calabozo', 'nigromancia', 'caso-resuelto', 'caso-fallido',
    // J12.7: las peleas de taberna (armada por ti, o ganada a quien la buscó) y los duelos.
    'pelea', 'pelea-ganada', 'duelo-ganado', 'duelo-perdido', 'reto-rechazado',
];

/** Cuánto dura una reacción que no dice cuánto. */
export const DEFAULT_DURATION = 14;

/** Cómo se saluda a cada hora; lo mismo que `town.js`. */
const HELLO = { morning: 'Buenos días', afternoon: 'Buenas tardes', night: 'Buenas noches', '': 'Hola' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]).map(text).filter(Boolean);

/**
 * @typedef {Object} Mark
 * @property {string} deed
 * @property {string} town
 * @property {string} place
 * @property {string} who Quien lo vio o lo sufrió, si se sabe.
 * @property {number} day
 */

/**
 * Las huellas guardadas, con forma aunque lleguen rotas.
 *
 * @param {any} raw
 * @returns {Mark[]}
 */
export function readMarks(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(m => isObject(m) && DEEDS.includes(text(m.deed)) && text(m.town))
        .map(m => ({
            deed: text(m.deed),
            town: text(m.town),
            place: fold(m.place),
            who: text(m.who),
            day: Math.max(1, Math.floor(Number(m.day) || 1)),
        }))
        .slice(-MARKS_MAX);
}

/**
 * Apuntar una huella.
 *
 * @param {any} raw
 * @param {{deed: string, town: string, place?: string, who?: string, day: number}} mark
 * @returns {Mark[]}
 */
export function addMark(raw, mark) {
    const [clean] = readMarks([mark]);
    const marks = readMarks(raw);
    return clean ? [...marks, clean].slice(-MARKS_MAX) : marks;
}

/**
 * @typedef {Object} Echo Una fila de `ecos.json`, leída.
 * @property {string} id
 * @property {string} name
 * @property {string} deed
 * @property {string} place Quién reacciona: un sitio, o `*`.
 * @property {string} at Dónde se hizo; vacío, en cualquier sitio.
 * @property {number} times
 * @property {number} lasts
 * @property {number} price 1 si no cambia.
 * @property {string} reason
 * @property {string} refuse
 * @property {string[]} greetings
 * @property {string[]} rumors
 * @property {number} attitude
 * @property {number} jail Los días de calabozo al encenderse (D-J47); 0, ninguno.
 */

/**
 * Las filas de `ecos.json`, leídas. Una sin lo que se hizo, o sin nada que cambie, no vale.
 *
 * @param {any} rows
 * @returns {Echo[]}
 */
export function readEchoes(rows) {
    return (Array.isArray(rows) ? rows : [])
        .filter(isObject)
        .map(row => {
            const when = isObject(row.when) ? row.when : {};
            const price = Number(row.precio ?? row.price);
            return {
                id: text(row.id),
                name: text(row.name),
                deed: text(when.hecho ?? row.hecho),
                place: fold(when.sitio ?? row.sitio) || '*',
                at: fold(when.en ?? row.en),
                times: Math.max(1, Math.floor(Number(row.veces) || 1)),
                lasts: Math.max(1, Math.floor(Number(row.dura) || DEFAULT_DURATION)),
                price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 1,
                reason: text(row.motivo),
                refuse: text(row.niega),
                greetings: listOf(row.saludo),
                rumors: listOf(row.rumor),
                attitude: Math.sign(Math.round(Number(row.trato) || 0)),
                jail: Math.max(0, Math.min(7, Math.floor(Number(row.calabozo) || 0))),
            };
        })
        .filter(echo => echo.id && DEEDS.includes(echo.deed)
            && (echo.price !== 1 || echo.refuse || echo.greetings.length > 0 || echo.rumors.length > 0 || echo.attitude !== 0 || echo.jail > 0));
}

/**
 * Las huellas de un pueblo que una fila tiene en cuenta hoy: las de lo que dice, hechas donde
 * dice, desde hace menos de lo que dura.
 *
 * @param {Echo} echo
 * @param {Mark[]} marks
 * @param {{town: string, today: number}} where
 * @returns {Mark[]}
 */
function marksFor(echo, marks, { town, today }) {
    const here = fold(town);
    const same = marks.filter(m => m.deed === echo.deed && fold(m.town) === here && (!echo.at || m.place === echo.at))
        .sort((a, b) => a.day - b.day);
    // Se olvida desde la última vez: robar otra vez, mientras se acuerdan, lo refresca todo.
    if (same.length === 0 || today - same[same.length - 1].day >= echo.lasts) return [];
    // D-J47: lo de antes de un olvido ya no cuenta. Pillados hoy, y la otra vez hace tres meses,
    // es la primera vez otra vez: la cuenta va desde el último hueco más largo de lo que dura.
    let start = same.length - 1;
    while (start > 0 && same[start].day - same[start - 1].day < echo.lasts) start--;
    return same.slice(start);
}

/**
 * @typedef {Object} Reaction Lo que un sitio recuerda de vosotros hoy.
 * @property {Echo} echo La fila que manda.
 * @property {Mark[]} marks Las huellas por las que reacciona.
 * @property {number} daysLeft Cuánto falta para que se olvide.
 */

/**
 * Lo que recuerda un sitio de un pueblo, de más a menos fuerte: lo que pasó más veces, lo que
 * es de este sitio (antes que lo de todo el pueblo), y lo que pasó aquí mismo.
 *
 * @param {Object} input
 * @param {any} input.marks
 * @param {any} input.rows Las filas de `ecos.json`.
 * @param {string} input.town
 * @param {string} [input.place] El sitio: `tienda`, `posada`… Vacío: todo el pueblo.
 * @param {number} input.today
 * @returns {Reaction[]}
 */
export function reactionsAt({ marks, rows, town, place = '', today }) {
    const list = readMarks(marks);
    const now = Math.max(1, Math.floor(Number(today) || 1));
    const kind = fold(place);
    return readEchoes(rows)
        .map((echo, index) => ({ echo, index, marks: marksFor(echo, list, { town, today: now }) }))
        .filter(r => r.marks.length >= r.echo.times && (r.echo.place === '*' || !kind || r.echo.place === kind))
        .sort((a, b) => b.echo.times - a.echo.times
            || Number(b.echo.place !== '*') - Number(a.echo.place !== '*')
            || Number(Boolean(b.echo.at)) - Number(Boolean(a.echo.at))
            || a.index - b.index)
        .map(r => ({ echo: r.echo, marks: r.marks, daysLeft: Math.max(1, r.echo.lasts - (now - Math.max(...r.marks.map(m => m.day)))) }));
}

/**
 * Los huecos de una línea: `{quien}`, `{pueblo}`, `{hola}` y el género de quien juega.
 *
 * @param {string} line
 * @param {{keeper?: string, town?: string, slot?: string, hero?: any}} facts
 * @returns {string}
 */
function voice(line, { keeper = '', town = '', slot = '', hero = null }) {
    const name = text(hero?.name ?? (typeof hero === 'string' ? hero : ''));
    const hello = `${HELLO[/** @type {keyof typeof HELLO} */ (slotOf(slot))]}${name ? `, ${name}` : ''}`;
    const filled = text(line)
        .replace(/\{quien\}/g, text(keeper) || 'Quien atiende')
        .replace(/\{pueblo\}/g, text(town) || 'el pueblo')
        .replace(/\{hola\}/g, hello);
    return resolveGender(filled, { heroe: hero && typeof hero === 'object' ? hero : '' }).replace(/\s+/g, ' ').trim();
}

/**
 * La franja del día, como en `town.js`: «Noche» es `night`.
 *
 * @param {string} label
 * @returns {'morning'|'afternoon'|'night'|''}
 */
function slotOf(label) {
    const said = fold(label);
    if (/noche|night|madrugada/.test(said)) return 'night';
    if (/tarde|afternoon|evening/.test(said)) return 'afternoon';
    if (/manana|morning|alba|amanecer/.test(said)) return 'morning';
    return '';
}

/**
 * Lo que os dice quien atiende un sitio, si recuerda algo; vacío si no (y entonces vale el
 * saludo de siempre, `greetingFor` de `town.js`). Uno por día, siempre el mismo ese día.
 *
 * @param {Object} input
 * @param {any} input.place El sitio (`TownPlace`), con su clase (`kind`) y quien lo lleva (`keeper`).
 * @param {string} input.town
 * @param {any} input.marks
 * @param {any} input.rows
 * @param {number} input.today
 * @param {string} [input.slot] La franja, por su id o por su nombre en el reloj.
 * @param {any} [input.hero] Quien juega: su nombre y su género.
 * @returns {string}
 */
export function rememberedGreeting({ place, town, marks, rows, today, slot = '', hero = null }) {
    const keeper = text(place?.keeper?.name);
    if (!keeper || place?.closed) return '';
    const said = reactionsAt({ marks, rows, town, place: place?.kind, today })
        .find(r => r.echo.greetings.length > 0 || r.echo.refuse);
    if (!said) return '';
    const lines = said.echo.greetings.length > 0 ? said.echo.greetings : [said.echo.refuse];
    const pick = lines[Math.max(0, Math.floor(Number(today) || 1)) % lines.length];
    return voice(pick, { keeper, town, slot, hero });
}

/**
 * Lo que cambia el precio en un sitio: el de la reacción más fuerte que lo cambia, y por qué.
 * Se pasa a `priceToday` (`shop.js`) como `memory`.
 *
 * @param {Object} input
 * @param {any} input.marks
 * @param {any} input.rows
 * @param {string} input.town
 * @param {string} input.place
 * @param {number} input.today
 * @returns {{factor: number, label: string}}
 */
export function rememberedPrice({ marks, rows, town, place, today }) {
    const found = reactionsAt({ marks, rows, town, place, today }).find(r => r.echo.price !== 1);
    return found ? { factor: found.echo.price, label: found.echo.reason || found.echo.name.toLowerCase() } : { factor: 1, label: '' };
}

/**
 * Si quien atiende un sitio no os atiende, lo que dice; vacío si os atiende.
 *
 * @param {Object} input
 * @param {any} input.place El sitio, con `kind` y `keeper`; o solo su clase, en texto.
 * @param {string} input.town
 * @param {any} input.marks
 * @param {any} input.rows
 * @param {number} input.today
 * @param {any} [input.hero]
 * @returns {string}
 */
export function refusal({ place, town, marks, rows, today, hero = null }) {
    const kind = typeof place === 'string' ? place : place?.kind;
    const found = reactionsAt({ marks, rows, town, place: kind, today }).find(r => r.echo.refuse);
    if (!found) return '';
    return voice(found.echo.refuse, { keeper: text(place?.keeper?.name), town, hero });
}

/**
 * Lo que la tarjeta de un servicio lleva si quien lo atiende no os atiende: el mismo cartel que
 * un sitio cerrado (`closed` de `town.js`, D-J29), pero con él dentro.
 *
 * @param {string} line La de `refusal`.
 * @returns {{sign: string, line: string}|null}
 */
export function refusalSign(line) {
    return text(line) ? { sign: 'No os atiende', line: text(line) } : null;
}

/**
 * Cómo os mira quien vio lo que hicisteis: el `trato` de la reacción que se enciende con esta
 * huella, en el sitio donde pasó. Se aplica una vez, al apuntarla (`shiftAttitude`).
 *
 * @param {Object} input
 * @param {any} input.marks Las huellas, ya con la nueva.
 * @param {any} input.rows
 * @param {{deed: string, town: string, place?: string, who?: string, day: number}} input.mark La nueva.
 * @returns {{who: string, delta: number}|null}
 */
export function markAttitude({ marks, rows, mark }) {
    const who = text(mark?.who);
    if (!who) return null;
    const found = reactionsAt({ marks, rows, town: mark.town, place: mark.place ?? '', today: mark.day })
        .find(r => r.echo.deed === text(mark.deed) && r.echo.attitude !== 0);
    return found ? { who, delta: found.echo.attitude } : null;
}

/**
 * D-J47: si lo que se acaba de hacer os lleva al calabozo: la reacción con `calabozo` que se
 * enciende con esta huella (a la segunda vez que os pillan robando en la tienda, mientras se
 * acuerdan de la primera). Nulo si no.
 *
 * @param {Object} input
 * @param {any} input.marks Las huellas, ya con la nueva.
 * @param {any} input.rows
 * @param {{deed: string, town: string, place?: string, day: number}} input.mark La nueva.
 * @returns {{days: number, echo: Echo, times: number}|null} Los días, la fila y cuántas van.
 */
export function jailFor({ marks, rows, mark }) {
    if (!mark || !text(mark.town)) return null;
    const found = reactionsAt({ marks, rows, town: mark.town, place: mark.place ?? '', today: mark.day })
        .find(r => r.echo.deed === text(mark.deed) && r.echo.jail > 0
            && r.marks.some(m => m.day === Math.max(1, Math.floor(Number(mark.day) || 1))));
    return found ? { days: found.echo.jail, echo: found.echo, times: found.marks.length } : null;
}

/**
 * D-J47: si os pillaran ahora haciendo esto aquí, si iríais al calabozo. Para avisarlo antes
 * de intentarlo («Ya os pillaron aquí una vez…»).
 *
 * @param {Object} input
 * @param {any} input.marks Las de ahora, sin la que se haría.
 * @param {any} input.rows
 * @param {{deed: string, town: string, place?: string, day: number}} input.mark La que se haría.
 * @returns {number} Los días de calabozo; 0 si no.
 */
export function jailRisk({ marks, rows, mark }) {
    return jailFor({ marks: addMark(marks, mark), rows, mark })?.days ?? 0;
}

/**
 * Lo que se cuenta en un pueblo de lo que hicisteis allí: una línea por reacción con rumor, sin
 * repetir las ya contadas (`told`, por id).
 *
 * @param {Object} input
 * @param {any} input.marks
 * @param {any} input.rows
 * @param {string} input.town
 * @param {number} input.today
 * @param {string[]} [input.told]
 * @returns {Array<{id: string, text: string}>}
 */
export function markRumors({ marks, rows, town, today, told = [] }) {
    const said = new Set(listOf(told));
    /** @type {Array<{id: string, text: string}>} */
    const out = [];
    for (const reaction of reactionsAt({ marks, rows, town, today })) {
        const last = Math.max(...reaction.marks.map(m => m.day));
        reaction.echo.rumors.forEach((line, i) => {
            const id = `huella:${reaction.echo.id}:${fold(town)}:${last}:${i}`;
            if (said.has(id)) return;
            said.add(id);
            out.push({ id, text: voice(line, { town }) });
        });
    }
    return out;
}

/** Cómo se dice un cambio de precio: «un 30 % más caro». */
function priceWords(/** @type {number} */ factor) {
    const pct = Math.round(Math.abs(factor - 1) * 100);
    return factor > 1 ? `un ${pct} % más caro` : `un ${pct} % más barato`;
}

/** El nombre de un sitio, para decirlo: «la tienda». */
const PLACE_WORDS = /** @type {Record<string, string>} */ ({
    tienda: 'la tienda', posada: 'la posada', herreria: 'la herrería', templo: 'el templo', gremio: 'el gremio', plaza: 'la plaza', muelle: 'el muelle', tablon: 'el tablón',
});

/**
 * Lo que se recuerda de vosotros en un pueblo, dicho en llano: una línea por reacción que se
 * nota (precio, trato), con cuánto falta para que se olvide. Para la ventana de lo que se
 * recuerda y para la Mesa de la semana.
 *
 * @param {Object} input
 * @param {any} input.marks
 * @param {any} input.rows
 * @param {string} input.town
 * @param {number} input.today
 * @returns {Array<{id: string, name: string, where: string, text: string, tone: 'bien'|'mal', daysLeft: number}>}
 */
export function describeMarks({ marks, rows, town, today }) {
    /** @type {Set<string>} */
    const shown = new Set();
    return reactionsAt({ marks, rows, town, today })
        .filter(r => {
            // De cada cosa hecha, lo más fuerte en cada sitio: «no os venden» tapa «os cobran más».
            const key = `${r.echo.deed}:${r.echo.place}`;
            if (shown.has(key)) return false;
            shown.add(key);
            return r.echo.price !== 1 || r.echo.refuse;
        })
        .map(r => {
            const where = r.echo.place === '*' ? `todo ${text(town) || 'el pueblo'}` : (PLACE_WORDS[r.echo.place] ?? r.echo.place);
            const what = r.echo.refuse
                ? `En ${where} no os atienden.`
                : `En ${where}, ${priceWords(r.echo.price)}${r.echo.reason ? `: ${r.echo.reason}` : ''}.`;
            const left = r.daysLeft === 1 ? 'Se olvida mañana.' : `Se olvida en ${r.daysLeft} días.`;
            return {
                id: r.echo.id,
                name: r.echo.name,
                where,
                text: `${what.charAt(0).toUpperCase()}${what.slice(1)} ${left}`,
                tone: /** @type {'bien'|'mal'} */ (r.echo.price < 1 && !r.echo.refuse ? 'bien' : 'mal'),
                daysLeft: r.daysLeft,
            };
        });
}
