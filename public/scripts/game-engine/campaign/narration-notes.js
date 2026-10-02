/**
 * Las notas del juego, en prosa (J13.1 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * El motor deja en el chat una nota por cada cosa que pasa: el descanso, la comida, una
 * tirada, lo que da un suceso, quién hay en un tablero. Con modelo, la nota es para él; sin
 * modelo, es lo único que se lee, y muchas se leían como un registro: «Irene: 34 → 34 PG.»,
 * «Comida caliente para todos (1 de oro).», «No estáis solas: Rata de bodega (2).», «🎲
 * Perspicacia de Irene: 14 contra CD 13 ✓ Éxito (d20 12 +2)».
 *
 * Aquí está cada una como la diría un narrador: corta, en castellano llano y con los mismos
 * datos. Donde una frase sale muchas veces (pasar el rato, comer, dormir), trae variantes;
 * la variante se elige por su clave, sin azar, para que la misma cosa se cuente igual al
 * volver a pintarla.
 *
 * Puro: de datos a frases. Quien llama pone la etiqueta del motor (la crónica la necesita
 * para saber de qué es cada línea; la caja la quita) y lo publica.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Los números pequeños, en letra; del once en adelante, en cifra. */
const WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/**
 * «dos», «tres»…; el uno, «un» o «una» delante de lo que cuenta.
 *
 * @param {number} n
 * @param {'m'|'f'} [gender] Si va delante de un nombre: «un día», «una moneda».
 * @returns {string}
 */
export function countWord(n, gender) {
    const whole = Math.floor(Number(n) || 0);
    if (whole === 1 && gender) return gender === 'f' ? 'una' : 'un';
    return WORDS[whole] ?? String(whole);
}

/**
 * Cuántas monedas: «una moneda de oro», «12 monedas de oro».
 *
 * @param {number} n
 * @returns {string}
 */
export function goldWords(n) {
    const whole = Math.max(0, Math.floor(Number(n) || 0));
    return whole === 1 ? 'una moneda de oro' : `${countWord(whole)} monedas de oro`;
}

/**
 * Cuántos puntos de vida: «un punto de vida», «7 puntos de vida».
 *
 * @param {number} n
 * @returns {string}
 */
export function lifeWords(n) {
    const whole = Math.max(0, Math.floor(Number(n) || 0));
    return whole === 1 ? 'un punto de vida' : `${countWord(whole)} puntos de vida`;
}

/**
 * Una variante de una lista, siempre la misma para la misma clave.
 *
 * @template T
 * @param {T[]} options
 * @param {string} key
 * @returns {T}
 */
export function variant(options, key) {
    let hash = 0;
    for (const char of String(key ?? '')) hash = ((hash * 31) + char.codePointAt(0)) >>> 0;
    return options[hash % options.length];
}

/** «Irene, Gerd y Nella»; delante de «i» o «hi», «e»: «Gerd e Irene». */
/** @param {string[]} names @returns {string} */
export function listWords(names) {
    const list = (names ?? []).map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    const last = list[list.length - 1];
    // «y hielo» se queda: la «hi» de delante de vocal suena a «y».
    const and = /^h?[iíIÍ](?![aeouáéóú])/u.test(last) ? 'e' : 'y';
    return `${list.slice(0, -1).join(', ')} ${and} ${last}`;
}

/** @param {string} line @returns {string} */
function sentence(line) {
    const said = text(line);
    if (!said) return '';
    const upper = said[0].toLocaleUpperCase('es') + said.slice(1);
    return /[.!?…»]$/.test(upper) ? upper : `${upper}.`;
}

/** Las palabras que atan un nombre a lo que sigue: lo de detrás no se pone en plural. */
const LINKS = new Set(['de', 'del', 'con', 'sin', 'en', 'a', 'al', 'que', 'y']);

/**
 * Una palabra en plural, con la regla de siempre: vocal + s, consonante + es, la z en ces, y
 * sin la tilde de «dragón» en «dragones».
 *
 * @param {string} word
 * @returns {string}
 */
function pluralWord(word) {
    if (!word || /\d/.test(word)) return word;
    // «Ciempiés», «tórax»: igual en plural.
    if (/[sx]$/i.test(word)) return word;
    if (/[aeoáéó]$/i.test(word) || /[iu]$/i.test(word)) return `${word}s`;
    if (/[íú]$/i.test(word)) return `${word}es`;
    if (/z$/i.test(word)) return `${word.slice(0, -1)}ces`;
    const stressed = /([áéíóú])(n)$/i.exec(word);
    if (stressed) {
        const plain = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U' }[stressed[1]] ?? stressed[1];
        return `${word.slice(0, -2)}${plain}${stressed[2]}es`;
    }
    return `${word}es`;
}

/**
 * Un nombre en plural: «Rata de bodega» → «ratas de bodega», «Bruja Baroviana» → «Brujas
 * Barovianas». Se pone en plural hasta la primera palabra que ata («de», «con»…). Un nombre
 * común (solo la primera en mayúscula) pasa a minúscula, como se diría en una frase.
 *
 * @param {string} name
 * @returns {string}
 */
export function pluralName(name) {
    const words = text(name).split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const stop = words.findIndex((word, i) => i > 0 && LINKS.has(word.toLowerCase()));
    const head = stop < 0 ? words.length : stop;
    const out = words.map((word, i) => (i < head ? pluralWord(word) : word));
    // «Rata de bodega» es un nombre común; «Bruja Baroviana», uno propio: se deja como está.
    const common = words.slice(1).every(word => word[0] === word[0].toLowerCase());
    if (common) out[0] = out[0][0].toLocaleLowerCase('es') + out[0].slice(1);
    return out.join(' ');
}

/**
 * Cuántos hay de algo: «dos ratas de bodega». Uno solo, con su nombre tal cual.
 *
 * @param {string} name
 * @param {number} n
 * @returns {string}
 */
export function countedName(name, n) {
    const many = Math.floor(Number(n) || 1);
    return many > 1 ? `${countWord(many)} ${pluralName(name)}` : text(name);
}

/**
 * Los enemigos de un tablero, contados: «el ratero del muelle y dos ratas de bodega».
 *
 * @param {Record<string, number>} counts Cuántos hay de cada nombre.
 * @returns {string}
 */
export function foesWords(counts) {
    return listWords(Object.entries(counts ?? {}).map(([name, n]) => countedName(name, n)));
}

/**
 * Una tirada en la forma de siempre (`rollLine`: «🎲 Perspicacia de Irene: 14 contra CD 13 ✓
 * Éxito (d20 12 +2)»), leída por partes.
 *
 * @param {string} said
 * @param {string[]} [labels] Las habilidades que se conocen, para partir «Juego de manos de
 *   Irene» por el «de» que toca.
 * @returns {{what: string, who: string, at: string, total: number, against: number|null, success: boolean|null, verdict: string}|null}
 */
export function readRoll(said, labels = []) {
    const match = /^\s*🎲\s*(.+?):\s*(-?\d+)(?:\s+contra\s+(?:([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+)?(-?\d+))?(?:\s*([✓✗]))?(?:\s+([^()]+?))?\s*(?:\(.*\))?\s*\.?\s*$/u.exec(String(said ?? ''));
    if (!match) return null;
    let head = match[1].trim();
    let at = '';
    const target = / a (?!medias)([^]+)$/u.exec(head);
    if (target && / de /.test(head.slice(0, target.index))) {
        at = target[1].trim();
        head = head.slice(0, target.index);
    }
    const known = labels.find(label => head.startsWith(`${label} de `));
    const cut = known ? known.length : head.indexOf(' de ');
    const what = cut > 0 ? head.slice(0, cut).trim() : head;
    const who = cut > 0 ? head.slice(cut + 4).trim() : '';
    return {
        what, who, at,
        total: Number(match[2]),
        against: match[4] == null ? null : Number(match[4]),
        success: match[5] === '✓' ? true : match[5] === '✗' ? false : null,
        verdict: text(match[6]),
    };
}

/**
 * Una tirada contada: «Irene prueba con Perspicacia: saca un 14, y le hacía falta un 13. Sale
 * bien.» Lo que no es una tirada de la forma de siempre se devuelve vacío.
 *
 * @param {string} said
 * @param {string[]} [labels]
 * @returns {string}
 */
export function rollProse(said, labels = []) {
    const roll = readRoll(said, labels);
    if (!roll) return '';
    const who = roll.who || 'Alguien';
    const tried = roll.at ? `${who} contra ${roll.at}, ${roll.what.toLocaleLowerCase('es')}` : `${who} prueba con ${roll.what}`;
    const need = roll.against == null ? '' : `, y le hacía falta un ${roll.against}`;
    const verdict = /rotundo/i.test(roll.verdict) && roll.success ? 'Sale redondo.'
        : /rotundo/i.test(roll.verdict) ? 'Sale todo al revés.'
            : /medias/i.test(roll.verdict) ? 'Sale a medias.'
                : roll.success === true ? 'Sale bien.' : roll.success === false ? 'No sale.' : '';
    return `${tried}: saca un ${roll.total}${need}.${verdict ? ` ${verdict}` : ''}`;
}

/**
 * El descanso, en prosa: quién se cura y cuánto. Vacío si nadie necesitaba nada.
 *
 * @param {'corto'|'largo'} kind
 * @param {{entries: Array<{name: string, hpBefore: number, hpAfter: number, healed: number, diceSpent: number, diceRegained: number, note?: string}>}} plan
 * @returns {string}
 */
export function restProse(kind, plan) {
    const entries = Array.isArray(plan?.entries) ? plan.entries : [];
    /** @type {string[]} */
    const said = [];
    const dice = (/** @type {number} */ n) => (n === 1 ? 'un dado de golpe' : `${countWord(n)} dados de golpe`);
    if (kind === 'largo') {
        const woke = entries.filter(e => e.note && e.healed <= 1 && e.hpBefore <= 0);
        const whole = entries.filter(e => e.healed > 0 && !woke.includes(e));
        for (const entry of woke) said.push(`${entry.name} despierta en pie, pero con un solo punto de vida.`);
        if (whole.length > 0) {
            const names = listWords(whole.map(e => e.name));
            said.push(`${names} ${whole.length === 1 ? 'se levanta' : 'se levantan'} con todas sus fuerzas.`);
        }
        const back = entries.filter(e => e.diceRegained > 0);
        if (back.length === 1) said.push(`${back[0].name} recupera ${dice(back[0].diceRegained)}.`);
        else if (back.length > 1) said.push(`${listWords(back.map(e => e.name))} recuperan dados de golpe.`);
    } else {
        for (const entry of entries) {
            if (entry.diceSpent > 0) {
                said.push(`${entry.name} se venda las heridas: gasta ${dice(entry.diceSpent)} y recupera ${lifeWords(entry.healed)}.`);
            } else if (entry.note) {
                said.push(`${entry.name}: ${entry.note}`);
            }
        }
    }
    return said.join(' ');
}

/** Cómo se dice cada parte del día: «por la mañana», «por la tarde», «de noche». */
const SLOT_WORDS = { mañana: 'por la mañana', tarde: 'por la tarde', noche: 'de noche', madrugada: 'de madrugada', mediodia: 'mediodía', mediodía: 'mediodía' };

/**
 * La parte del día, dicha: «por la tarde».
 *
 * @param {string} label «Tarde», como la trae el calendario.
 * @returns {string}
 */
export function slotWords(label) {
    const key = text(label).toLocaleLowerCase('es');
    return /** @type {Record<string, string>} */ (SLOT_WORDS)[key] ?? key;
}

/**
 * Pasar el rato: «Se os va la mañana. Ya es por la tarde.»
 *
 * @param {string} label La parte del día en que se está ahora.
 * @param {number} [day]
 * @returns {string}
 */
export function slotProse(label, day = 0) {
    const now = slotWords(label);
    if (!now) return '';
    return variant([
        `Pasa el rato. Ya es ${now}.`,
        `Se os va el tiempo sin daros cuenta: ya es ${now}.`,
        `Las horas pasan despacio. Ya es ${now}.`,
        `El día sigue su curso, y ya es ${now}.`,
    ], `${label}:${day}`);
}

/**
 * Esperar: «Esperáis. Ya es de noche.» Si ya era ese momento, se dice.
 *
 * @param {string} label
 * @param {boolean} [already]
 * @returns {string}
 */
export function waitProse(label, already = false) {
    const now = slotWords(label);
    return already ? `No hace falta esperar: ya es ${now}.` : `Esperáis. Ya es ${now}.`;
}

/**
 * Comer en la posada: «Comida caliente para todos: una moneda de oro.»
 *
 * @param {number} cost
 * @param {string} [key] Para la variante.
 * @returns {string}
 */
export function mealProse(cost, key = '') {
    const paid = Number(cost) > 0 ? goldWords(cost) : '';
    return variant([
        `Os sirven un guiso caliente y pan del día${paid ? `, por ${paid}` : ''}. Se os pasan el hambre y la sed.`,
        `Comida caliente para todos${paid ? ` por ${paid}` : ''}: sopa, pan y algo de beber.`,
        // Sin «sentados»: la nota se cuenta después de poner el género, y no sabe quién come.
        `Coméis y bebéis a una mesa de verdad, con mantel y todo${paid ? `. Cuesta ${paid}` : ''}.`,
    ], `${key}:${cost}`);
}

/**
 * Comprar: «Irene compra un frasco de aceite por 9 monedas de oro.»
 *
 * @param {string} who
 * @param {string} item
 * @param {number} cost
 * @returns {string}
 */
export function buyProse(who, item, cost) {
    const thing = text(item);
    const lower = thing && thing.split(/\s+/).slice(1).every(word => word[0] === word[0].toLowerCase()) ? thing[0].toLocaleLowerCase('es') + thing.slice(1) : thing;
    return `${text(who)} se lleva ${lower} por ${goldWords(cost)}.`;
}

/**
 * Vender: «Vendéis la daga oxidada y la cuerda por 7 monedas de oro.»
 *
 * @param {string[]} items
 * @param {number} total
 * @returns {string}
 */
export function sellProse(items, total) {
    return `Vendéis ${listWords(items)} por ${goldWords(total)}.`;
}

/**
 * Lo que el cuerpo pide, en una frase por persona: «Irene empieza a tener sed y sueño.» Las
 * líneas que no son de esas se quedan como están.
 *
 * @param {string[]} lines Las de `needs.js`: «Irene empieza a acusar sed.»
 * @returns {string}
 */
export function needsProse(lines) {
    /** @type {Map<string, string[]>} */
    const wants = new Map();
    /** @type {string[]} */
    const rest = [];
    for (const line of (lines ?? []).map(text).filter(Boolean)) {
        const found = /^(.+?) empieza a acusar (.+?)\.?$/u.exec(line);
        if (!found) {
            rest.push(line);
            continue;
        }
        wants.set(found[1], [...(wants.get(found[1]) ?? []), found[2]]);
    }
    /** @type {Map<string, string[]>} */
    const byNeed = new Map();
    for (const [name, needs] of wants) {
        const key = listWords(needs);
        byNeed.set(key, [...(byNeed.get(key) ?? []), name]);
    }
    const said = [...byNeed].map(([needs, names]) => `${listWords(names)} ${names.length === 1 ? 'empieza' : 'empiezan'} a tener ${needs}.`);
    return [...said, ...rest].join(' ');
}

/**
 * Lo que hace una opción de un suceso, dicho en frases: «−5 de oro» → «Pagáis 5 monedas de
 * oro.».
 *
 * @param {string} said Uno de los efectos, como los dice `applySucesoEffects`.
 * @returns {string}
 */
export function effectSentence(said) {
    const line = text(said);
    let found;
    if ((found = /^[−-](\d+) de oro$/u.exec(line))) return Number(found[1]) > 0 ? `Pagáis ${goldWords(Number(found[1]))}.` : '';
    if ((found = /^\+(\d+) de oro$/u.exec(line))) return `Ganáis ${goldWords(Number(found[1]))}.`;
    if ((found = /^(.+) [−-](\d+) de vida$/u.exec(line))) return `${found[1]} pierde ${lifeWords(Number(found[2]))}.`;
    if ((found = /^(.+) \+(\d+) de vida$/u.exec(line))) return Number(found[2]) > 0 ? `${found[1]} recupera ${lifeWords(Number(found[2]))}.` : '';
    if ((found = /^más cerca de (.+)$/u.exec(line))) return `${found[1]} y tú quedáis más cerca.`;
    if ((found = /^(.+): os miran (mejor|peor)$/u.exec(line))) return found[2] === 'mejor' ? `Ganáis puntos con ${found[1]}.` : `Perdéis puntos con ${found[1]}.`;
    if ((found = /^conseguís: (.+)$/u.exec(line))) return `Conseguís ${found[1]}.`;
    /** @type {Record<string, string>} */
    const fixed = {
        'se va un rato': 'Se os va un rato.',
        'se pierde un día': 'Se pierde un día.',
        'coméis': 'Coméis algo.',
        'se come': 'Coméis algo.',
        'os enteráis de algo': 'Os enteráis de algo.',
        'una pista': 'Sale una pista.',
    };
    return fixed[line] ?? sentence(line);
}

/**
 * Un suceso decidido, en prosa: lo que pasa y lo que deja.
 *
 * @param {{then?: string, effects?: string[]}} input
 * @returns {string}
 */
export function sucesoProse({ then = '', effects = [] }) {
    return [sentence(then), ...(effects ?? []).map(effectSentence)].filter(Boolean).join(' ');
}

/**
 * Un descanso en la posada o en el templo que se paga: «Os cosen y os vendan en el templo, por
 * 10 monedas de oro. Las heridas que se curan con tiempo quedan cerradas.»
 *
 * @param {string} place
 * @param {number} cost
 * @returns {string}
 */
export function templeProse(place, cost) {
    return `En el templo de ${text(place)} os cosen y os vendan${Number(cost) > 0 ? `, por ${goldWords(cost)}` : ''}. Las heridas que se curan con tiempo quedan cerradas.`;
}

/**
 * Quien se une al grupo: «Gerd, guerrero, viene con vosotros. Cobra 40 monedas de oro.»
 *
 * @param {{name: string, className?: string, cost?: number}} recruit
 * @returns {string}
 */
export function joinProse(recruit) {
    const name = text(recruit?.name);
    const trade = text(recruit?.className).toLocaleLowerCase('es');
    const paid = Number(recruit?.cost) > 0 ? ` Cobra ${goldWords(Number(recruit?.cost))}.` : '';
    return `${name}${trade ? `, ${trade},` : ''} se une al grupo.${paid}`;
}

/**
 * Conocer a alguien: su escena, sin las órdenes al narrador; y si trabaja por dinero, cuánto.
 *
 * @param {{name: string, description?: string, motive?: string, cost?: number}} recruit
 * @param {string} place
 * @returns {string}
 */
export function meetingProse(recruit, place) {
    const name = text(recruit?.name);
    const where = text(place) || 'la posada';
    const about = sentence(recruit?.description);
    const asks = recruit?.motive === 'coin'
        ? ` Trabaja por dinero: ${goldWords(Number(recruit?.cost) || 0)} por adelantado.`
        : '';
    return `En ${where} conocéis a ${name}. ${about}${asks}`.trim();
}

/**
 * Una charla de palabras (el duelo), acabada: quién habla con quién, para qué y cómo acaba.
 *
 * @param {{who?: string, npc: string, what?: string, outcome: string}} input
 * @returns {string}
 */
export function duelProse({ who = '', npc, what = '', outcome }) {
    const goal = text(what) ? ` para conseguir ${text(what)}` : '';
    const end = outcome === 'cede' ? `al final, ${npc} cede.`
        : outcome === 'a-medias' ? `al final, ${npc} cede a medias, y tiene su precio.`
            : `${npc} no cede.`;
    return `${text(who) || 'Habláis'}${text(who) ? ` habla con ${npc}` : ` con ${npc}`}${goal}, y ${end}`;
}

/**
 * Una pista que llega porque el grupo lleva días sin avanzar, de boca de alguien del lugar.
 *
 * @param {string} hint
 * @param {string} [key]
 * @returns {string}
 */
export function hintProse(hint, key = '') {
    // Entre comillas: es lo que dice esa persona, con su mayúscula y su punto.
    const said = `«${sentence(hint).replace(/^«|»$/gu, '')}»`;
    return variant([
        `Alguien del lugar os lo comenta de pasada: ${said}`,
        `Una mujer que pasa a vuestro lado os lo dice sin que preguntéis: ${said}`,
        `En una esquina, un viejo os para un momento: ${said}`,
    ], `${key}:${hint}`);
}
