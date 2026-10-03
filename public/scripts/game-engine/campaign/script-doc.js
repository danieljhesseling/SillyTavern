/**
 * El guion de una campaña, para leerlo y corregirlo fuera del juego (J5.7 y J5.8 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Daniel, el 2026-10-02: «que te pueda pedir todo el texto que se dice en x campaña, y que salga
 * quien lo dice para que sea una guía del lector; yo paso el Word al juego, y el motor
 * automáticamente ajusta los textos».
 *
 * Esto recorre un paquete de campaña (y, si se le dan, las filas del compendio que son de esa
 * campaña: charlas, quedadas, noches, romances, misiones personales y las frases propias de su
 * gente) y lo deja en **bloques en orden de lectura**: los capítulos y sus hitos con su escena
 * línea a línea (quién, con qué cara, qué dice; tus opciones y lo que sigue a cada una), las
 * charlas con sus ramas, las peleas con sus salidas habladas, lo que se mira en cada sitio, los
 * rumores, los saludos, los compañeros (vínculo, romance y misión) y los finales.
 *
 * Cada línea que se puede corregir lleva un **id estable**, sacado de su sitio en el paquete
 * («E:el-muelle/4/yo-me-encargo», «D:brunilda-la-casa/inicio»), y de dónde sale (`src`: el
 * archivo y la ruta dentro de él). En el Word va detrás de la línea, en gris y pequeño, con una
 * **huella** del texto al exportarlo: `[#E:el-muelle/2~7c1f]`. Al volver (`reviewScript`), la
 * huella dice quién cambió la línea: si el texto del juego sigue siendo el exportado, el cambio
 * es tuyo; si no, el juego cambió después y no se pisa.
 *
 * Quien habla sale por su nombre, y con lo que es mientras quien juega aún no lo conoce (J13.7):
 * «Tomás (el posadero)». Las marcas de género `{el nuevo|la nueva}` y los huecos (`{hola}`,
 * `{npc:tomas}`) se ven tal cual, para corregirlos sin romperlos; `checkEdit` avisa si se rompen.
 *
 * Una línea sin nadie que la diga sale como «Narrador»: en el juego sin conexión no debería quedar
 * ninguna (D-J60), y así se encuentran.
 *
 * Puro: de un paquete a bloques, y de unos párrafos a lo que cambia. Escribir el Word
 * (`script-docx.js`) y guardar en los archivos (`tools/guion-word.mjs`) va aparte.
 */

import { packPeople, findPerson, roleOf, learnFromLine, knowsName, meetPerson, namesIn } from './known-people.js';
import { leftoverMarkers, thirdForms, genderHacks } from './grammar.js';

/** La etiqueta de una línea que no dice nadie. */
export const NARRATOR = 'Narrador';

/** La etiqueta de lo que dices tú. */
export const HERO = 'Tú';

/** El formato de la marca de cada línea: `[#id~huella]`. */
export const MARK = /\s*\[#([^\]~]+)~([0-9a-z]{1,8})\]\s*$/;

/** Las clases de fila del compendio que se leen, por su archivo. */
export const COMPENDIO_DOCS = ['companeros', 'charlas', 'quedadas', 'noches', 'romances', 'personales', 'frases'];

/**
 * @typedef {Object} ScriptSource De dónde sale un texto.
 * @property {string} doc `pack`, o el nombre de un archivo del compendio (`charlas`…).
 * @property {Array<string|number>} path La ruta dentro de ese archivo.
 */

/**
 * @typedef {Object} ScriptBlock Un párrafo del guion.
 * @property {'titulo'|'subtitulo'|'parte'|'capitulo'|'seccion'|'apartado'|'nota'|'linea'} type
 * @property {string} [pre]   Lo de antes, en cursiva: «Si sale bien», «[Enano]», «Otro día».
 * @property {string} [label] Quién o qué: «Tomás (el posadero)», «Tú», «En pantalla».
 * @property {string} [mood]  La cara, si no es la de siempre: alegre, enfadado o triste.
 * @property {string} [text]  Lo que se dice: lo único que se corrige.
 * @property {string} [id]    Solo en lo que se puede corregir.
 * @property {string} [hash]  La huella del texto, para la marca.
 * @property {number} [depth] La sangría: 0 a 3.
 * @property {boolean} [bullet] Con viñeta (tus opciones y lo que sigue).
 * @property {'linea'|'tu'|'narrador'|'pantalla'} [kind] Para contar.
 * @property {ScriptSource} [src]
 */

/**
 * @typedef {Object} Script
 * @property {string} title
 * @property {ScriptBlock[]} blocks
 * @property {{lines: number, said: number, choices: number, narrator: number}} counts
 * @property {any[]} [people] La gente del paquete, para mirar los nombres de lo que se cambia.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {any} value @returns {any[]} */
const listOf = (value) => (Array.isArray(value) ? value : []);

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Un nombre hecho id: en minúsculas, sin tildes y con guiones. «Puerto Alba» es `puerto-alba`.
 *
 * @param {any} value
 * @returns {string}
 */
export function slug(value) {
    return fold(value).replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * El texto en limpio para comparar: sin espacios de más (Word pone duros y dobles) ni al final de
 * cada renglón. Los saltos de línea se quedan.
 *
 * @param {any} value
 * @returns {string}
 */
export function normalizeText(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u00a0\u2007\u202f\t]/g, ' ')
        .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
        .split('\n').map(row => row.replace(/ {2,}/g, ' ').trim()).join('\n')
        .trim();
}

/**
 * La huella de un texto: cuatro letras que cambian si cambia el texto (FNV-1a).
 *
 * @param {any} value
 * @returns {string}
 */
export function textHash(value) {
    let hash = 0x811c9dc5;
    for (const char of normalizeText(value)) {
        hash ^= char.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (hash % 1679616).toString(36).padStart(4, '0');
}

/**
 * La marca que va detrás de una línea en el Word.
 *
 * @param {ScriptBlock} block
 * @returns {string}
 */
export function markOf(block) {
    return block.id ? `[#${block.id}~${block.hash ?? textHash(block.text)}]` : '';
}

/** Lo que va antes de los dos puntos no puede llevar «: » (se cortaría ahí) ni una marca. */
const safeLabel = (/** @type {any} */ value) => text(value).replace(/:\s/g, ' · ').replace(/:$/, '').replace(/\[#/g, '[ #');

/** Un texto largo, cortado para nombrarlo: «Quiero entrar en el gremio.» */
const short = (/** @type {any} */ value) => {
    const said = text(value).replace(/:\s/g, ' · ');
    return said.length > 48 ? `${said.slice(0, 46).trimEnd()}…` : said;
};

/** La cara, si no es la de siempre. */
const shownMood = (/** @type {any} */ value) => (['alegre', 'enfadado', 'triste'].includes(fold(value)) ? fold(value) : '');

/**
 * Los trozos de un párrafo, con su estilo: así lo escriben igual el Word y el texto plano.
 *
 * @param {ScriptBlock} block
 * @returns {Array<{text: string, style: 'pre'|'label'|'mood'|'text'|'mark'|'plain'}>}
 */
export function blockParts(block) {
    /** @type {Array<{text: string, style: 'pre'|'label'|'mood'|'text'|'mark'|'plain'}>} */
    const parts = [];
    const pre = safeLabel(block.pre);
    const label = safeLabel(block.label);
    const mood = shownMood(block.mood);
    if (!block.id && !label) {
        parts.push({ text: String(block.text ?? ''), style: 'plain' });
        return parts;
    }
    if (pre) parts.push({ text: `${pre} · `, style: 'pre' });
    if (label) parts.push({ text: label, style: 'label' });
    if (mood) parts.push({ text: ` (${mood})`, style: 'mood' });
    parts.push({ text: ': ', style: 'label' });
    parts.push({ text: String(block.text ?? ''), style: 'text' });
    if (block.id) parts.push({ text: ` ${markOf(block)}`, style: 'mark' });
    return parts;
}

/**
 * Un párrafo en texto plano, como se lee en el Word.
 *
 * @param {ScriptBlock} block
 * @returns {string}
 */
export function blockText(block) {
    return blockParts(block).map(part => part.text).join('');
}

// ---------------------------------------------------------------------------------------------
// Las condiciones, dichas
// ---------------------------------------------------------------------------------------------

/** @param {any} value @returns {string[]} */
const namesOf = (value) => (Array.isArray(value) ? value.map(text) : [text(value)]).filter(Boolean);

/**
 * La etiqueta de una opción con condición: «[Enano]», «[Clérigo]», «[con el cáliz]».
 *
 * @param {any} option
 * @returns {string}
 */
function optionTag(option) {
    if (text(option?.tag)) return `[${text(option.tag)}]`;
    const conditions = Array.isArray(option?.if) ? option.if : isObject(option?.if) ? [option.if] : [];
    /** @type {string[]} */
    const said = [];
    for (const condition of conditions.filter(isObject)) {
        for (const key of ['species', 'class', 'background']) said.push(...namesOf(condition[key]));
        if (text(condition.gender)) said.push(fold(condition.gender) === 'mujer' ? 'mujer' : 'hombre');
        if (text(condition.item)) said.push(`con ${text(condition.item)}`);
        if (condition.gold != null) said.push(`con ${condition.gold} de oro`);
    }
    return said.length > 0 ? `[${[...new Set(said)].join(', ')}]` : '';
}

/**
 * Cuándo vale otra versión de una línea (`alt`): «Si eres Pícaro», «Si dijiste «¿Y cuánto me das…»».
 *
 * @param {any} condition
 * @param {Map<string, string>} [chosen] Lo que dice cada opción de las escenas, por su id.
 * @returns {string}
 */
function altCondition(condition, chosen = new Map()) {
    if (!isObject(condition)) return 'Otra versión';
    /** @type {string[]} */
    const said = [];
    const picks = namesOf(condition.chose).map(id => (chosen.has(id) ? short(chosen.get(id)) : id));
    if (picks.length > 0) said.push(`si dijiste «${picks.join('» o «')}»`);
    for (const key of ['class', 'species', 'background']) {
        if (namesOf(condition[key]).length > 0) said.push(`si eres ${namesOf(condition[key]).join(' o ')}`);
    }
    if (text(condition.gender)) said.push(fold(condition.gender) === 'mujer' ? 'si eres mujer' : 'si eres hombre');
    const out = said.join(' y ') || 'otra versión';
    return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Cómo sale una tirada, por la clave de su rama. */
const OUTCOMES = [['success', 'bien', 'Si sale bien'], ['partial', 'medias', 'A medias'], ['failure', 'mal', 'Si sale mal']];

/** Las salidas de un tablero, dichas. */
const PARLEY_WAYS = { sobornar: 'Sobornar', convencer: 'Convencer', 'engañar': 'Engañar', enganar: 'Engañar', entregarse: 'Entregarse', intimidar: 'Intimidar' };

/** Lo que abre un hito, dicho. */
function opensText(/** @type {any} */ opens, /** @type {Map<string, any>} */ byId) {
    const kind = text(opens?.kind);
    if (kind === 'start') return 'Se abre al empezar';
    if (kind === 'after') return `Se abre tras «${text(byId.get(text(opens.milestone))?.title) || text(opens.milestone)}»`;
    if (kind === 'arrive') return `Se abre al llegar a ${text(opens.place)}`;
    if (kind === 'contract') return 'Se abre al entregar un encargo';
    if (kind === 'day') return `Se abre el día ${text(opens.day)}`;
    if (kind === 'clock') return 'Se abre con el reloj de una facción';
    return '';
}

/** Lo que pide un hito, dicho. */
function asksText(/** @type {any} */ asks) {
    const kind = text(asks?.kind);
    if (kind === 'win') return `pide ganar la pelea «${text(asks.board)}»`;
    if (kind === 'arrive') return `pide llegar a ${text(asks.place)}`;
    if (kind === 'defeat') return `pide derrotar a ${text(asks.enemy)}`;
    if (kind === 'talk') return `pide hablar con ${text(asks.npc)}`;
    if (kind === 'check') return 'pide una tirada';
    if (kind === 'contract') return 'pide entregar un encargo';
    if (kind === 'clues') return 'pide encontrar pistas';
    if (kind === 'any') return 'pide una de varias cosas';
    if (kind === 'none') return 'no pide nada';
    return '';
}

/** Las clases de frase del compendio, dichas: «Saludo», «Al cobrar la comida». */
const PHRASE_KINDS = {
    saludo: 'Saludo',
    'charla-sigue': 'Si sigues hablando',
    'mirada-mejor': 'Cuando le caes mejor',
    'mirada-peor': 'Cuando le caes peor',
    'voz-tienda-compra': 'Al venderte algo',
    'voz-tienda-venta': 'Al comprarte algo',
    'voz-tienda-regateo-si': 'Si el regateo sale',
    'voz-tienda-regateo-medias': 'Si el regateo sale a medias',
    'voz-tienda-regateo-no': 'Si el regateo no sale',
    'voz-posada-comida': 'Al servir la comida',
    'voz-posada-comida-gratis': 'Al servir la comida en fiesta',
    'voz-posada-establo': 'Al guardar la montura',
    'voz-posada-despertar': 'Al despertar',
    'voz-templo-cura': 'Al curar',
    'voz-templo-maldicion': 'Al quitar una maldición',
    'voz-gremio-encargo': 'Al apuntar un encargo',
    'voz-gremio-encargo-mapa': 'Al marcar un encargo en el mapa',
};

// ---------------------------------------------------------------------------------------------
// El que escribe
// ---------------------------------------------------------------------------------------------

/**
 * Lo que va apuntando los bloques, los ids y a quién se conoce ya.
 *
 * @param {any} pack
 */
function createWriter(pack) {
    const people = packPeople(pack);
    // Los sitios y las facciones no son gente: «el castillo de Vane» no presenta a Lord Vane.
    const skip = [
        ...listOf(pack?.locations).map(place => text(place?.name)),
        ...listOf(pack?.world?.factions).map(faction => text(faction?.name)),
    ].filter(Boolean);
    /** @type {ScriptBlock[]} */
    const blocks = [];
    /** @type {Map<string, number>} */
    const used = new Map();
    /** @type {any} */
    let known = null;
    // Lo que dice cada opción de las escenas del hilo, por su id: «si dijiste…» en las versiones.
    /** @type {Map<string, string>} */
    const chosen = new Map();
    for (const milestone of listOf(pack?.plot?.milestones)) {
        for (const beat of listOf(milestone?.beats)) {
            for (const option of listOf(beat?.options)) if (text(option?.id) && text(option?.text)) chosen.set(text(option.id), text(option.text));
        }
    }

    /**
     * Cómo sale quien habla: su nombre y, si aún no se le conoce, lo que es.
     *
     * @param {any} who
     * @returns {string}
     */
    const speaker = (who) => {
        const name = text(who);
        if (!name) return NARRATOR;
        const person = findPerson(name, people);
        if (!person) return name;
        if (knowsName(person.name, { state: known, people })) return person.name;
        const role = roleOf(person, 'el');
        return role ? `${person.name} (${role})` : person.name;
    };

    /**
     * Lo que se aprende al oír una línea (quien se presenta, a quien nombran).
     *
     * @param {any} who
     * @param {any} said
     * @param {any} [presenta]
     */
    const hear = (who, said, presenta) => {
        known = learnFromLine(known, { who: text(who), text: text(said), ...(presenta != null ? { presenta } : {}) }, { people, skip }).state;
    };

    /**
     * Un id que no se repite: el segundo igual lleva «+2».
     *
     * @param {string} id
     * @returns {string}
     */
    const unique = (id) => {
        const seen = used.get(id) ?? 0;
        used.set(id, seen + 1);
        return seen === 0 ? id : `${id}+${seen + 1}`;
    };

    /**
     * Un párrafo sin nada que corregir.
     *
     * @param {ScriptBlock['type']} type
     * @param {string} said
     * @param {Partial<ScriptBlock>} [extra]
     */
    const plain = (type, said, extra = {}) => {
        if (text(said)) blocks.push({ type, text: text(said), ...extra });
    };

    /**
     * Una línea que se puede corregir. Sin texto, no sale.
     *
     * @param {Object} input
     * @param {string} input.id
     * @param {any} input.value El texto, tal cual está en el archivo.
     * @param {ScriptSource} input.src
     * @param {string} [input.label]
     * @param {string} [input.pre]
     * @param {any} [input.mood]
     * @param {number} [input.depth]
     * @param {boolean} [input.bullet]
     * @param {ScriptBlock['kind']} [input.kind]
     * @param {ScriptBlock['type']} [input.type]
     * @returns {ScriptBlock|null}
     */
    const line = ({ id, value, src, label = '', pre = '', mood = '', depth = 0, bullet = false, kind, type = 'linea' }) => {
        if (typeof value !== 'string' || !value.trim()) return null;
        const said = value;
        const shown = label || NARRATOR;
        /** @type {ScriptBlock} */
        const block = {
            type,
            id: unique(id),
            label: shown,
            text: said,
            hash: textHash(said),
            src,
            ...(pre ? { pre } : {}),
            ...(shownMood(mood) ? { mood: shownMood(mood) } : {}),
            ...(depth ? { depth: Math.min(3, depth) } : {}),
            ...(bullet ? { bullet: true } : {}),
            kind: kind ?? (shown === NARRATOR ? 'narrador' : shown === HERO ? 'tu' : 'linea'),
        };
        blocks.push(block);
        return block;
    };

    /**
     * Quien va contigo ya se conoce: sus escenas no le llaman por lo que es.
     *
     * @param {string} name
     */
    const know = (name) => {
        known = meetPerson(known, name, 'charla', { people });
    };

    return { blocks, people, chosen, speaker, hear, know, line, plain, unique };
}

/** @typedef {ReturnType<typeof createWriter>} Writer */

/**
 * La ruta de un texto en el paquete.
 *
 * @param {Array<string|number>} path
 * @param {string} [doc]
 * @returns {ScriptSource}
 */
const at = (path, doc = 'pack') => ({ doc, path });

// ---------------------------------------------------------------------------------------------
// Las piezas que se repiten
// ---------------------------------------------------------------------------------------------

/**
 * Lo que se oye: una línea suelta, un objeto con quién y cara, o una lista de ellos.
 *
 * @param {Writer} w
 * @param {any} reply
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 * @param {any} input.who Quien la dice si no lo pone (en una escena, nadie: el narrador).
 * @param {number} input.depth
 * @param {string} [input.pre]
 */
function replies(w, reply, { id, path, doc, who, depth, pre = '' }) {
    const one = (/** @type {any} */ entry, /** @type {string} */ entryId, /** @type {Array<string|number>} */ entryPath) => {
        if (typeof entry === 'string') {
            w.line({ id: entryId, value: entry, src: at(entryPath, doc), label: w.speaker(who), pre, depth, bullet: true });
            w.hear(who, entry);
        } else if (isObject(entry)) {
            const speaker = text(entry.who) || who;
            w.line({ id: entryId, value: entry.text, src: at([...entryPath, 'text'], doc), label: w.speaker(speaker), mood: entry.mood, pre, depth, bullet: true });
            w.hear(speaker, entry.text, entry.presenta);
        }
    };
    if (Array.isArray(reply)) reply.forEach((entry, k) => one(entry, `${id}${k + 1}`, [...path, k]));
    else one(reply, id, path);
}

/**
 * Una tarjeta de suceso, o la que vuelve días después de una decisión (`later`): su título, lo
 * que pasa y sus opciones con lo que sigue.
 *
 * @param {Writer} w
 * @param {any} card
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 * @param {number} input.depth
 * @param {string} [input.title] Cómo se llama esta clase de tarjeta: «Días después», «Suceso».
 */
function walkCard(w, card, { id, path, doc, depth, title = 'Días después' }) {
    if (!isObject(card)) return;
    w.line({ id: `${id}/titulo`, value: card.name, src: at([...path, 'name'], doc), label: title, depth, kind: 'pantalla' });
    w.line({ id, value: card.text, src: at([...path, 'text'], doc), label: NARRATOR, depth });
    listOf(card.options).forEach((option, k) => {
        if (!isObject(option)) return;
        const oid = `${id}/${k + 1}`;
        const base = [...path, 'options', k];
        w.line({ id: oid, value: option.label, src: at([...base, 'label'], doc), label: HERO, depth: depth + 1, bullet: true });
        w.line({ id: `${oid}/r`, value: option.then, src: at([...base, 'then'], doc), label: NARRATOR, depth: depth + 2, bullet: true });
        for (const [key, word, said] of [['success', 'bien', 'Si sale bien'], ['fail', 'mal', 'Si sale mal']]) {
            w.line({ id: `${oid}/${word}`, value: option[key]?.then, src: at([...base, key, 'then'], doc), label: NARRATOR, pre: said, depth: depth + 2, bullet: true });
        }
    });
}

/**
 * Las opciones de una línea de escena (las del hilo y las de las misiones personales): lo que
 * dices, lo que se oye, lo que se apunta y lo que vuelve días después.
 *
 * @param {Writer} w
 * @param {any[]} options
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 * @param {number} input.depth
 */
function sceneOptions(w, options, { id, path, doc, depth }) {
    listOf(options).forEach((option, k) => {
        if (!isObject(option)) return;
        const oid = `${id}/${slug(option.id) || `o${k + 1}`}`;
        const base = [...path, k];
        w.line({ id: oid, value: option.text, src: at([...base, 'text'], doc), label: HERO, pre: optionTag(option), depth, bullet: true });
        // Una respuesta sin quién, en una escena, es del narrador.
        replies(w, option.reply, { id: `${oid}/r`, path: [...base, 'reply'], doc, who: '', depth: depth + 1 });
        w.line({ id: `${oid}/diario`, value: option.journal, src: at([...base, 'journal'], doc), label: 'Diario', depth: depth + 1, bullet: true, kind: 'pantalla' });
        for (const [key, word, said] of OUTCOMES) {
            const branch = option.check?.[key];
            if (typeof branch === 'string') {
                w.line({ id: `${oid}/${word}`, value: branch, src: at([...base, 'check', key], doc), label: NARRATOR, pre: said, depth: depth + 1, bullet: true });
            } else if (isObject(branch)) {
                replies(w, branch.reply, { id: `${oid}/${word}/r`, path: [...base, 'check', key, 'reply'], doc, who: '', depth: depth + 1, pre: said });
                w.line({ id: `${oid}/${word}/diario`, value: branch.journal, src: at([...base, 'check', key, 'journal'], doc), label: 'Diario', pre: said, depth: depth + 1, bullet: true, kind: 'pantalla' });
            }
        }
        walkCard(w, option.later, { id: `${oid}/luego`, path: [...base, 'later'], doc, depth: depth + 1 });
    });
}

/**
 * Las líneas de una escena del hilo (o de un paso de misión personal): quién, cara y texto, sus
 * otras versiones y sus decisiones.
 *
 * @param {Writer} w
 * @param {any[]} beats
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} [input.doc]
 * @param {number} [input.depth]
 */
function sceneBeats(w, beats, { id, path, doc = 'pack', depth = 0 }) {
    listOf(beats).forEach((beat, i) => {
        if (!isObject(beat)) return;
        const bid = `${id}/${i + 1}`;
        const base = [...path, i];
        w.line({ id: bid, value: beat.text, src: at([...base, 'text'], doc), label: w.speaker(beat.who), mood: beat.mood, depth });
        listOf(beat.alt).forEach((alt, k) => {
            if (!isObject(alt)) return;
            w.line({
                id: `${bid}/otra${k + 1}`, value: alt.text, src: at([...base, 'alt', k, 'text'], doc),
                label: w.speaker(text(alt.who) || beat.who), mood: alt.mood ?? beat.mood, pre: altCondition(alt.if, w.chosen), depth: depth + 1, bullet: true,
            });
        });
        w.hear(beat.who, beat.text, beat.presenta);
        sceneOptions(w, beat.options, { id: bid, path: [...base, 'options'], doc, depth: depth + 1 });
    });
}

/**
 * Las líneas de una quedada, un romance o una noche: lo que se ve (`note`), lo que dice (`say`)
 * y tus respuestas con lo que contesta (`replies`: `text` y `then`).
 *
 * @param {Writer} w
 * @param {any[]} beats
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 * @param {any} input.who Quien habla si la línea no lo dice.
 * @param {number} [input.depth]
 */
function talkBeats(w, beats, { id, path, doc, who, depth = 0 }) {
    listOf(beats).forEach((beat, i) => {
        if (!isObject(beat)) return;
        const bid = `${id}/${i + 1}`;
        const base = [...path, i];
        const speaker = text(beat.who) || who;
        w.line({ id: `${bid}/nota`, value: beat.note, src: at([...base, 'note'], doc), label: NARRATOR, depth });
        w.line({ id: bid, value: beat.say, src: at([...base, 'say'], doc), label: w.speaker(speaker), mood: beat.mood, depth });
        listOf(beat.replies).forEach((reply, k) => {
            if (!isObject(reply)) return;
            const rid = `${bid}/${k + 1}`;
            w.line({ id: rid, value: reply.text, src: at([...base, 'replies', k, 'text'], doc), label: HERO, depth: depth + 1, bullet: true });
            const answer = text(reply.who) || speaker;
            w.line({ id: `${rid}/r`, value: reply.then, src: at([...base, 'replies', k, 'then'], doc), label: w.speaker(answer), mood: reply.mood, depth: depth + 2, bullet: true });
        });
    });
}

/**
 * Una misión personal (la del paquete o la de `personales.json`): el título, de qué va, sus dos
 * finales y sus pasos (viaje, escena con su conversación, final).
 *
 * @param {Writer} w
 * @param {any} quest
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 */
function walkPersonalQuest(w, quest, { id, path, doc }) {
    if (!isObject(quest)) return;
    w.line({ id: `${id}/titulo`, value: quest.title, src: at([...path, 'title'], doc), label: 'Misión personal', type: 'apartado', kind: 'pantalla' });
    w.line({ id: `${id}/donde`, value: quest.where, src: at([...path, 'where'], doc), label: 'Dónde', kind: 'pantalla' });
    w.line({ id: `${id}/de-que-va`, value: quest.pitch, src: at([...path, 'pitch'], doc), label: 'De qué va', kind: 'pantalla' });
    listOf(quest.endings).forEach((ending, k) => {
        if (!isObject(ending)) return;
        const eid = `${id}/final-${slug(ending.id) || k + 1}`;
        w.line({ id: eid, value: ending.title, src: at([...path, 'endings', k, 'title'], doc), label: 'Final', depth: 1, bullet: true, kind: 'pantalla' });
        w.line({ id: `${eid}/resumen`, value: ending.summary, src: at([...path, 'endings', k, 'summary'], doc), label: 'Resumen', depth: 2, bullet: true, kind: 'pantalla' });
    });
    listOf(quest.steps).forEach((step, k) => {
        if (!isObject(step)) return;
        const sid = `${id}/${slug(step.id) || k + 1}`;
        const base = [...path, 'steps', k];
        w.line({ id: `${sid}/titulo`, value: step.title, src: at([...base, 'title'], doc), label: 'Paso', kind: 'pantalla' });
        w.line({ id: sid, value: step.text, src: at([...base, 'text'], doc), label: NARRATOR });
        sceneBeats(w, step.beats, { id: sid, path: [...base, 'beats'], doc });
        w.line({ id: `${sid}/recuerdo`, value: step.effects?.memory, src: at([...base, 'effects', 'memory'], doc), label: 'Diario', kind: 'pantalla' });
    });
}

/**
 * Las escenas de un romance (las del paquete o las de `romances.json`): la señal, las citas, la
 * noche, las frases de pareja y el epílogo.
 *
 * @param {Writer} w
 * @param {any} scene
 * @param {Object} input
 * @param {string} input.id
 * @param {Array<string|number>} input.path
 * @param {string} input.doc
 * @param {string} input.who
 */
function walkRomanceScene(w, scene, { id, path, doc, who }) {
    if (!isObject(scene)) return;
    const kinds = { senal: 'La señal', cita: `Cita ${text(scene.step)}`.trim(), final: 'La noche', pareja: 'En pareja', epilogo: 'Epílogo' };
    const kind = kinds[/** @type {keyof typeof kinds} */ (text(scene.kind))] ?? 'Escena';
    w.plain('nota', `Romance · ${kind}`);
    w.line({ id: `${id}/titulo`, value: scene.title, src: at([...path, 'title'], doc), label: 'Título', kind: 'pantalla' });
    talkBeats(w, scene.beats, { id, path: [...path, 'beats'], doc, who });
    listOf(scene.lines).forEach((said, k) => w.line({ id: `${id}/frase${k + 1}`, value: said, src: at([...path, 'lines', k], doc), label: w.speaker(who) }));
    // J13.9: el epílogo no lo dice nadie en la caja: se lee escrito, en «Qué fue de cada uno» al
    // acabar la campaña y en la placa del Salón de la fama (como los epílogos de los finales).
    for (const [key, said, label] of [['home', 'Si volvéis al gremio', 'Qué fue de'], ['away', 'Si os quedáis', 'Qué fue de'], ['hall', '', 'En el Salón de la fama']]) {
        w.line({ id: `${id}/${key}`, value: scene[key], src: at([...path, key], doc), label, pre: said, kind: 'pantalla' });
    }
}

// ---------------------------------------------------------------------------------------------
// Las partes del paquete
// ---------------------------------------------------------------------------------------------

/**
 * Los hitos en el orden en que se juegan: cada uno detrás del que lo abre; lo demás, como está.
 *
 * @param {any[]} milestones
 * @returns {number[]} Los índices.
 */
function playOrder(milestones) {
    const ids = new Set(milestones.map(m => text(m?.id)));
    /** @type {number[]} */
    const out = [];
    const placed = new Set();
    let guard = milestones.length + 1;
    while (out.length < milestones.length && guard-- > 0) {
        milestones.forEach((m, index) => {
            if (placed.has(index)) return;
            const after = m?.opens?.kind === 'after' ? text(m.opens.milestone) : '';
            const ready = !after || !ids.has(after) || out.some(i => text(milestones[i]?.id) === after);
            if (!ready) return;
            out.push(index);
            placed.add(index);
        });
    }
    milestones.forEach((_, index) => { if (!placed.has(index)) out.push(index); });
    return out;
}

/**
 * Una charla con ramas: sus nudos en orden de lectura (desde el primero, siguiendo las opciones)
 * y, en cada uno, lo que dice, lo que dice otro día, tus opciones y lo que contesta.
 *
 * @param {Writer} w
 * @param {any} dialogue
 * @param {number} index
 * @param {Set<number>} placed
 */
function walkDialogue(w, dialogue, index, placed) {
    if (!isObject(dialogue) || placed.has(index)) return;
    placed.add(index);
    const did = slug(dialogue.id) || `charla${index + 1}`;
    const base = ['dialogues', index];
    const who = text(dialogue.speaker);
    w.line({ id: `D:${did}/titulo`, value: dialogue.title, src: at([...base, 'title']), label: 'Conversación', type: 'apartado', kind: 'pantalla' })
        ?? w.plain('apartado', `Conversación con ${who}`);
    const nodes = listOf(dialogue.nodes);
    const byId = new Map(nodes.map((node, i) => [text(node?.id), i]));
    // Desde el primero, siguiendo adónde lleva cada opción: así se lee como se juega.
    /** @type {number[]} */
    const order = [];
    // A qué opción contesta cada nudo: la primera que lleva a él.
    /** @type {Map<number, string>} */
    const reachedBy = new Map();
    const start = byId.get(text(dialogue.start)) ?? 0;
    const queue = [start];
    while (queue.length > 0) {
        const i = /** @type {number} */ (queue.shift());
        if (i == null || order.includes(i) || !nodes[i]) continue;
        order.push(i);
        for (const option of listOf(nodes[i].options)) {
            const outcomes = [['', option?.next], ['bien', option?.check?.success?.next], ['a medias', option?.check?.partial?.next], ['mal', option?.check?.failure?.next]];
            for (const [how, next] of outcomes) {
                const to = byId.get(text(next));
                if (to == null) continue;
                if (!reachedBy.has(to) && to !== i && to !== start) reachedBy.set(to, `Tras «${short(option?.text)}»${how ? `, si sale ${how}` : ''}`);
                queue.push(to);
            }
        }
    }
    nodes.forEach((_, i) => { if (!order.includes(i)) order.push(i); });

    for (const i of order) {
        const node = nodes[i];
        if (!isObject(node)) continue;
        const nid = `D:${did}/${slug(node.id) || `n${i + 1}`}`;
        const path = [...base, 'nodes', i];
        w.line({ id: nid, value: node.line, src: at([...path, 'line']), label: w.speaker(who), mood: node.mood, pre: reachedBy.get(i) ?? '' });
        w.hear(who, node.line, node.presenta);
        if (typeof node.again === 'string') {
            w.line({ id: `${nid}/otro-dia`, value: node.again, src: at([...path, 'again']), label: w.speaker(who), pre: 'Otro día', depth: 1 });
        } else {
            listOf(node.again).forEach((again, k) => {
                if (typeof again === 'string') {
                    w.line({ id: `${nid}/otro-dia${k + 1}`, value: again, src: at([...path, 'again', k]), label: w.speaker(who), pre: 'Otro día', depth: 1 });
                } else if (isObject(again)) {
                    w.line({ id: `${nid}/otro-dia${k + 1}`, value: again.text, src: at([...path, 'again', k, 'text']), label: w.speaker(who), pre: 'Otro día, con condición', depth: 1 });
                }
            });
        }
        listOf(node.more).forEach((more, k) => w.line({ id: `${nid}/mas${k + 1}`, value: more, src: at([...path, 'more', k]), label: w.speaker(who), pre: 'Si vuelves a preguntar', depth: 1 }));
        w.line({ id: `${nid}/diario`, value: node.journal, src: at([...path, 'journal']), label: 'Diario', depth: 1, kind: 'pantalla' });
        listOf(node.options).forEach((option, k) => {
            if (!isObject(option)) return;
            const oid = `${nid}/${slug(option.id) || `o${k + 1}`}`;
            const opath = [...path, 'options', k];
            w.line({ id: oid, value: option.text, src: at([...opath, 'text']), label: HERO, pre: optionTag(option), depth: 1, bullet: true });
            if (typeof option.reply === 'string') {
                w.line({ id: `${oid}/r`, value: option.reply, src: at([...opath, 'reply']), label: w.speaker(who), depth: 2, bullet: true });
            } else if (isObject(option.reply)) {
                w.line({ id: `${oid}/r`, value: option.reply.text, src: at([...opath, 'reply', 'text']), label: w.speaker(who), mood: option.reply.mood, depth: 2, bullet: true });
            }
            w.line({ id: `${oid}/diario`, value: option.journal, src: at([...opath, 'journal']), label: 'Diario', depth: 2, bullet: true, kind: 'pantalla' });
            for (const [key, word, said] of OUTCOMES) {
                w.line({ id: `${oid}/${word}/diario`, value: option.check?.[key]?.journal, src: at([...opath, 'check', key, 'journal']), label: 'Diario', pre: said, depth: 2, bullet: true, kind: 'pantalla' });
            }
            walkCard(w, option.later, { id: `${oid}/luego`, path: [...opath, 'later'], doc: 'pack', depth: 2 });
        });
    }
}

/**
 * Una pelea: cómo evitarla, cómo salir hablando y lo que se nota de sus trampas, con la misión
 * que la usa.
 *
 * @param {Writer} w
 * @param {any} pack
 * @param {number} index
 * @param {Set<number>} placed
 * @param {Set<number>} questsPlaced
 */
function walkBoard(w, pack, index, placed, questsPlaced) {
    const board = listOf(pack.boards)[index];
    if (!isObject(board) || placed.has(index)) return;
    placed.add(index);
    const bid = `P:${slug(board.id) || slug(board.name) || index + 1}`;
    const base = ['boards', index];
    w.plain('apartado', `Pelea: ${text(board.name) || text(board.id)}`);
    listOf(pack.quests).forEach((quest, q) => {
        if (!isObject(quest) || questsPlaced.has(q) || text(quest.boardId) !== text(board.id)) return;
        questsPlaced.add(q);
        walkQuest(w, quest, q);
    });
    listOf(board.avoid).forEach((way, k) => {
        if (!isObject(way)) return;
        const aid = `${bid}/evitar${k + 1}`;
        const path = [...base, 'avoid', k];
        w.line({ id: aid, value: way.text, src: at([...path, 'text']), label: HERO, pre: 'Para no pelear', bullet: true });
        for (const [key, word, said] of OUTCOMES) {
            const branch = way[key];
            if (typeof branch === 'string') w.line({ id: `${aid}/${word}`, value: branch, src: at([...path, key]), label: NARRATOR, pre: said, depth: 1, bullet: true });
            else if (isObject(branch)) w.line({ id: `${aid}/${word}`, value: branch.text, src: at([...path, key, 'text']), label: NARRATOR, pre: said, depth: 1, bullet: true });
        }
    });
    if (isObject(board.parley)) {
        for (const [key, way] of Object.entries(board.parley)) {
            if (!isObject(way)) continue;
            const pid = `${bid}/${slug(key)}`;
            const path = [...base, 'parley', key];
            const name = PARLEY_WAYS[/** @type {keyof typeof PARLEY_WAYS} */ (key)] ?? key;
            w.line({ id: pid, value: way.text, src: at([...path, 'text']), label: HERO, pre: `En plena pelea · ${name}`, bullet: true });
            for (const [branchKey, word, said] of OUTCOMES) {
                const branch = way[branchKey];
                if (typeof branch === 'string') w.line({ id: `${pid}/${word}`, value: branch, src: at([...path, branchKey]), label: NARRATOR, pre: said, depth: 1, bullet: true });
                else if (isObject(branch)) w.line({ id: `${pid}/${word}`, value: branch.text, src: at([...path, branchKey, 'text']), label: NARRATOR, pre: said, depth: 1, bullet: true });
            }
        }
    }
    listOf(board.traps).forEach((trap, k) => {
        if (!isObject(trap)) return;
        w.line({ id: `${bid}/trampa${k + 1}`, value: trap.tell, src: at([...base, 'traps', k, 'tell']), label: NARRATOR, pre: `Trampa «${text(trap.name)}»`, kind: 'narrador' });
    });
}

/**
 * Una misión del paquete: su nombre, lo que dice y sus objetivos (lo que se lee en pantalla).
 *
 * @param {Writer} w
 * @param {any} quest
 * @param {number} q
 */
function walkQuest(w, quest, q) {
    const qid = `Q:${slug(quest.id) || q + 1}`;
    const base = ['quests', q];
    w.line({ id: `${qid}/nombre`, value: quest.name, src: at([...base, 'name']), label: 'Misión', kind: 'pantalla' });
    w.line({ id: qid, value: quest.description, src: at([...base, 'description']), label: 'En pantalla', kind: 'pantalla' });
    listOf(quest.objectives).forEach((objective, k) => {
        w.line({ id: `${qid}/objetivo${k + 1}`, value: objective?.label, src: at([...base, 'objectives', k, 'label']), label: 'Objetivo', depth: 1, bullet: true, kind: 'pantalla' });
    });
}

/**
 * El hilo: los capítulos (o los actos) y sus hitos en el orden en que se juegan, cada uno con su
 * escena, la charla que abre, la pelea que pide y las charlas que se ofrecen con él.
 *
 * @param {Writer} w
 * @param {any} pack
 * @param {{dialogues: Set<number>, boards: Set<number>, quests: Set<number>}} placed
 */
function walkPlot(w, pack, placed) {
    const plot = isObject(pack.plot) ? pack.plot : null;
    const milestones = listOf(plot?.milestones);
    if (!plot || milestones.length === 0) return;
    w.plain('parte', 'La historia');
    const byId = new Map(milestones.map(m => [text(m?.id), m]));
    const chapters = listOf(plot.chapters);
    const order = playOrder(milestones);
    const acts = [...new Set(order.map(i => Number(milestones[i]?.act) || 1))].sort((a, b) => a - b);
    const dialogues = listOf(pack.dialogues);
    const boards = listOf(pack.boards);
    const quests = listOf(pack.quests);

    for (const act of acts) {
        const c = chapters.findIndex(chapter => Number(chapter?.act) === act);
        if (c >= 0) {
            const chapter = chapters[c];
            w.line({ id: `C:${act}/titulo`, value: chapter.title, src: at(['plot', 'chapters', c, 'title']), label: `Capítulo ${act}`, type: 'capitulo', kind: 'pantalla' })
                ?? w.plain('capitulo', `Capítulo ${act}`);
            w.line({ id: `C:${act}/resumen`, value: chapter.summary, src: at(['plot', 'chapters', c, 'summary']), label: 'De qué va', kind: 'pantalla' });
        } else if (acts.length > 1) {
            w.plain('capitulo', `Acto ${act}`);
        }
        const chapterPov = c >= 0 ? text(chapters[c]?.pov) : '';
        for (const index of order.filter(i => (Number(milestones[i]?.act) || 1) === act)) {
            const m = milestones[index];
            if (!isObject(m)) continue;
            const mid = slug(m.id) || `hito${index + 1}`;
            const base = ['plot', 'milestones', index];
            // La forma corta: el título y la escena salen de su misión.
            const q = text(m.quest) ? quests.findIndex(quest => text(quest?.id) === text(m.quest)) : -1;
            const titleAt = typeof m.title === 'string' || q < 0 ? at([...base, 'title']) : at(['quests', q, 'name']);
            const sceneAt = typeof m.scene === 'string' || q < 0 ? at([...base, 'scene']) : at(['quests', q, 'description']);
            w.line({ id: `H:${mid}/titulo`, value: m.title ?? quests[q]?.name, src: titleAt, label: 'Hito', type: 'seccion', kind: 'pantalla' })
                ?? w.plain('seccion', `Hito: ${mid}`);
            const notes = [opensText(m.opens, byId), asksText(m.asks), m.prologue ? 'del prólogo' : '', m.hidden ? 'secreto' : ''].filter(Boolean);
            if (notes.length > 0) w.plain('nota', `${notes.join(' · ')}.`);
            w.line({ id: `H:${mid}/pista`, value: m.hint, src: at([...base, 'hint']), label: 'En pantalla', kind: 'pantalla' });
            const beats = listOf(m.beats);
            const pov = text(m.pov) || chapterPov;
            const scene = m.scene ?? quests[q]?.description;
            if (beats.length > 0) {
                w.line({ id: `H:${mid}/escena`, value: scene, src: sceneAt, label: 'Resumen', kind: 'pantalla' });
                sceneBeats(w, beats, { id: `E:${mid}`, path: [...base, 'beats'] });
            } else {
                w.line({ id: `H:${mid}/escena`, value: scene, src: sceneAt, label: w.speaker(pov) });
                w.hear(pov, scene, m.presenta);
            }
            const wanted = text(m.sceneDialogue);
            if (wanted) {
                const d = dialogues.findIndex(dialogue => text(dialogue?.id) === wanted);
                if (d >= 0) walkDialogue(w, dialogues[d], d, placed.dialogues);
            }
            dialogues.forEach((dialogue, d) => {
                const when = Array.isArray(dialogue?.when) ? dialogue.when : [dialogue?.when];
                const opensHere = when.some(condition => isObject(condition)
                    && (text(condition.milestone) === text(m.id) || text(condition.milestone?.id) === text(m.id)));
                if (opensHere) walkDialogue(w, dialogue, d, placed.dialogues);
            });
            // Un hito que pide hablar con alguien: su charla va aquí.
            if (text(m.asks?.kind) === 'talk') {
                const d = dialogues.findIndex((dialogue, k) => !placed.dialogues.has(k) && fold(dialogue?.speaker) === fold(m.asks.npc));
                if (d >= 0) walkDialogue(w, dialogues[d], d, placed.dialogues);
            }
            if (text(m.asks?.kind) === 'win') {
                const b = boards.findIndex(board => fold(board?.name) === fold(m.asks.board));
                if (b >= 0) walkBoard(w, pack, b, placed.boards, placed.quests);
            }
        }
    }
}

/**
 * Los finales: el presagio, y cada final con su escena, qué fue de cada uno y lo que deja en el
 * gremio (el saludo de la vuelta, el rumor, la visita y lo que se ofrece después).
 *
 * @param {Writer} w
 * @param {any} pack
 */
function walkEndings(w, pack) {
    const plot = isObject(pack.plot) ? pack.plot : null;
    const omens = listOf(plot?.omens);
    const endings = isObject(plot?.endings) ? Object.entries(plot.endings) : [];
    if (omens.length === 0 && endings.length === 0) return;
    w.plain('parte', 'Los finales');
    omens.forEach((omen, k) => w.line({ id: `F:presagio${k + 1}`, value: omen?.text, src: at(['plot', 'omens', k, 'text']), label: 'Presagio' }));
    for (const [key, ending] of endings) {
        if (!isObject(ending)) continue;
        const fid = `F:${slug(key)}`;
        const base = ['plot', 'endings', key];
        w.line({ id: `${fid}/titulo`, value: ending.title, src: at([...base, 'title']), label: 'Final', type: 'seccion', kind: 'pantalla' })
            ?? w.plain('seccion', `Final: ${key}`);
        w.line({ id: `${fid}/escena`, value: ending.scene, src: at([...base, 'scene']), label: NARRATOR });
        listOf(ending.epilogues).forEach((epilogue, k) => {
            w.line({ id: `${fid}/epilogo${k + 1}`, value: epilogue?.text, src: at([...base, 'epilogues', k, 'text']), label: 'Qué fue de', pre: text(epilogue?.who), kind: 'pantalla' });
        });
        const legacy = isObject(ending.legacy) ? ending.legacy : null;
        if (!legacy) continue;
        const lid = `${fid}/legado`;
        const lpath = [...base, 'legacy'];
        w.plain('nota', 'Al volver al gremio');
        w.line({ id: `${lid}/titulo`, value: legacy.title, src: at([...lpath, 'title']), label: 'En el Salón de la fama', kind: 'pantalla' });
        w.line({ id: `${lid}/saludo`, value: legacy.greeting, src: at([...lpath, 'greeting']), label: 'Quien lleva el gremio', pre: 'Saludo' });
        w.line({ id: `${lid}/rumor`, value: legacy.rumor, src: at([...lpath, 'rumor']), label: 'Rumor en el puerto' });
        walkCard(w, legacy.visitor, { id: `${lid}/visita`, path: [...lpath, 'visitor'], doc: 'pack', depth: 0, title: 'Visita' });
        listOf(legacy.offers).forEach((offer, k) => {
            w.line({ id: `${lid}/oferta${k + 1}`, value: offer?.line, src: at([...lpath, 'offers', k, 'line']), label: 'Lo que te ofrecen', pre: text(offer?.campaign) });
        });
    }
}

/**
 * Las frases propias de alguien en `frases.json` (`when.persona`): sus saludos y lo que dice al
 * atenderte.
 *
 * @param {Writer} w
 * @param {any} compendio
 * @param {string} name
 * @param {Set<number>} placed
 */
function walkPhrases(w, compendio, name, placed) {
    listOf(compendio?.frases?.rows).forEach((row, r) => {
        if (placed.has(r) || !isObject(row) || fold(row.when?.persona) !== fold(name)) return;
        placed.add(r);
        const kind = text(row.kind);
        const said = PHRASE_KINDS[/** @type {keyof typeof PHRASE_KINDS} */ (kind)] ?? kind;
        const first = row.when?.primera === 'si' ? ' (la primera vez)' : row.when?.primera === 'no' ? ' (si ya te conoce)' : '';
        w.line({ id: `M:${text(row.id) || `${slug(name)}-${r + 1}`}`, value: row.text, src: at(['rows', r, 'text'], 'frases'), label: w.speaker(name), pre: `${said}${first}`, depth: 1 });
    });
}

/**
 * Las charlas cortas de `charlas.json` de alguien: lo que te dice al cruzaros y lo que contesta.
 *
 * @param {Writer} w
 * @param {any} row
 * @param {number} r
 * @param {string} who
 */
function walkSmallTalk(w, row, r, who) {
    const cid = `CH:${text(row.id) || r + 1}`;
    const base = ['rows', r];
    w.plain('nota', text(row.name) || cid);
    listOf(row.lines).forEach((said, k) => w.line({ id: `${cid}/${k + 1}`, value: said, src: at([...base, 'lines', k], 'charlas'), label: w.speaker(who || 'Cualquiera'), mood: row.mood }));
    listOf(row.replies).forEach((reply, k) => {
        if (!isObject(reply)) return;
        w.line({ id: `${cid}/r${k + 1}`, value: reply.text, src: at([...base, 'replies', k, 'text'], 'charlas'), label: HERO, depth: 1, bullet: true });
        w.line({ id: `${cid}/r${k + 1}/dice`, value: reply.then, src: at([...base, 'replies', k, 'then'], 'charlas'), label: w.speaker(who || 'Cualquiera'), depth: 2, bullet: true });
    });
}

/**
 * Por el mundo: cada localización con lo que se ve, lo que se puede mirar, su gente (sus
 * saludos, lo que sabe y lo que quiere), sus rumores, sus sucesos y sus encargos.
 *
 * @param {Writer} w
 * @param {any} pack
 * @param {any} compendio
 * @param {string} campaign
 * @param {Set<number>} phrasesPlaced
 */
function walkWorld(w, pack, compendio, campaign, phrasesPlaced) {
    const locations = listOf(pack.locations);
    const npcs = listOf(pack.npcs);
    const rumors = listOf(pack.rumors);
    const sucesos = listOf(pack.sucesos);
    const contracts = listOf(pack.contracts);
    const charlas = listOf(compendio?.charlas?.rows);
    const npcsPlaced = new Set();
    const rumorsPlaced = new Set();
    const sucesosPlaced = new Set();
    const contractsPlaced = new Set();
    const charlasPlaced = new Set();
    if (locations.length + npcs.length + rumors.length + sucesos.length + contracts.length === 0) return;
    w.plain('parte', 'Por el mundo');

    const rumor = (/** @type {any} */ row, /** @type {number} */ r) => {
        rumorsPlaced.add(r);
        w.line({ id: `R:${slug(row.id) || r + 1}`, value: row.text, src: at(['rumors', r, 'text']), label: w.speaker(row.by || 'Alguien'), pre: 'Rumor', depth: 1 });
    };
    const person = (/** @type {any} */ npc, /** @type {number} */ n) => {
        npcsPlaced.add(n);
        const nid = `G:${slug(npc.id) || slug(npc.name) || n + 1}`;
        const role = roleOf(findPerson(npc.name, w.people) ?? npc, 'el');
        w.plain('apartado', `${text(npc.name)}${role ? ` (${role})` : ''}`);
        walkPhrases(w, compendio, npc.name, phrasesPlaced);
        w.line({ id: `${nid}/sabe`, value: npc.knows, src: at(['npcs', n, 'knows']), label: 'Lo que sabe', depth: 1, kind: 'pantalla' });
        w.line({ id: `${nid}/quiere`, value: npc.wants, src: at(['npcs', n, 'wants']), label: 'Lo que quiere', depth: 1, kind: 'pantalla' });
        w.line({ id: `${nid}/calla`, value: npc.secret, src: at(['npcs', n, 'secret']), label: 'Lo que calla', depth: 1, kind: 'pantalla' });
        rumors.forEach((row, r) => { if (!rumorsPlaced.has(r) && isObject(row) && fold(row.by) === fold(npc.name)) rumor(row, r); });
        charlas.forEach((row, r) => {
            if (charlasPlaced.has(r) || !isObject(row) || fold(row.who) !== fold(npc.name)) return;
            if (campaign && text(row.campaign) && text(row.campaign) !== campaign) return;
            charlasPlaced.add(r);
            walkSmallTalk(w, row, r, npc.name);
        });
    };
    const suceso = (/** @type {any} */ row, /** @type {number} */ s) => {
        sucesosPlaced.add(s);
        walkCard(w, row, { id: `S:${slug(row.id) || s + 1}`, path: ['sucesos', s], doc: 'pack', depth: 0, title: 'Suceso' });
    };
    const contract = (/** @type {any} */ row, /** @type {number} */ c) => {
        contractsPlaced.add(c);
        const kid = `X:${slug(row.id) || c + 1}`;
        w.line({ id: `${kid}/titulo`, value: row.title, src: at(['contracts', c, 'title']), label: 'Encargo', pre: text(row.patron), kind: 'pantalla' });
        w.line({ id: `${kid}/paga`, value: row.rewardText, src: at(['contracts', c, 'rewardText']), label: 'Paga', depth: 1, kind: 'pantalla' });
        w.line({ id: `${kid}/giro`, value: row.twist, src: at(['contracts', c, 'twist']), label: 'Lo que de verdad pasa', depth: 1, kind: 'pantalla' });
    };
    const sitesOf = (/** @type {any} */ row) => namesOf(row?.when?.sitio).map(fold);

    locations.forEach((place, l) => {
        if (!isObject(place)) return;
        const lid = `L:${slug(place.name) || l + 1}`;
        const base = ['locations', l];
        w.plain('seccion', `Localización: ${text(place.name)}`);
        w.line({ id: `${lid}/descripcion`, value: place.description, src: at([...base, 'description']), label: 'Cómo es', kind: 'pantalla' });
        listOf(place.sights).forEach((sight, k) => {
            if (!isObject(sight)) return;
            const sid = `${lid}/mirar${k + 1}`;
            const verb = text(sight.verbo) || 'mirar';
            w.line({ id: sid, value: sight.text, src: at([...base, 'sights', k, 'text']), label: HERO, pre: verb.charAt(0).toUpperCase() + verb.slice(1), bullet: true });
            w.line({ id: `${sid}/visto`, value: sight.found, src: at([...base, 'sights', k, 'found']), label: NARRATOR, pre: 'Lo que ves', depth: 1, bullet: true });
        });
        listOf(place.routes).forEach((route, k) => {
            w.line({ id: `${lid}/camino-${slug(route?.to) || k + 1}`, value: route?.gateNote, src: at([...base, 'routes', k, 'gateNote']), label: 'En pantalla', pre: `Camino a ${text(route?.to)}`, kind: 'pantalla' });
        });
        npcs.forEach((npc, n) => { if (!npcsPlaced.has(n) && isObject(npc) && fold(npc.where) === fold(place.name)) person(npc, n); });
        rumors.forEach((row, r) => { if (!rumorsPlaced.has(r) && isObject(row) && fold(row.where) === fold(place.name)) rumor(row, r); });
        sucesos.forEach((row, s) => { if (!sucesosPlaced.has(s) && isObject(row) && sitesOf(row).includes(fold(place.name))) suceso(row, s); });
        contracts.forEach((row, c) => { if (!contractsPlaced.has(c) && isObject(row) && fold(row.where) === fold(place.name)) contract(row, c); });
    });

    const leftNpcs = npcs.map((npc, n) => n).filter(n => !npcsPlaced.has(n) && isObject(npcs[n]));
    const leftRumors = rumors.map((_, r) => r).filter(r => !rumorsPlaced.has(r) && isObject(rumors[r]));
    const leftSucesos = sucesos.map((_, s) => s).filter(s => !sucesosPlaced.has(s) && isObject(sucesos[s]));
    const leftContracts = contracts.map((_, c) => c).filter(c => !contractsPlaced.has(c) && isObject(contracts[c]));
    if (leftNpcs.length + leftRumors.length + leftSucesos.length + leftContracts.length > 0) {
        w.plain('seccion', 'En cualquier sitio');
        leftNpcs.forEach(n => person(npcs[n], n));
        leftRumors.forEach(r => rumor(rumors[r], r));
        leftSucesos.forEach(s => suceso(sucesos[s], s));
        leftContracts.forEach(c => contract(contracts[c], c));
    }
    return charlasPlaced;
}

/**
 * Los compañeros: los del paquete y, si se da el compendio, los de esta campaña. Quién es, lo que
 * dice al llegar a cada sitio, sus escenas de vínculo, su romance y su misión personal, y sus
 * charlas y quedadas del compendio.
 *
 * @param {Writer} w
 * @param {any} pack
 * @param {any} compendio
 * @param {string} campaign
 * @param {Set<number>} charlasPlaced
 */
function walkCompanions(w, pack, compendio, campaign, charlasPlaced) {
    const confidants = listOf(pack.confidants);
    const rowsOf = (/** @type {string} */ doc) => listOf(compendio?.[doc]?.rows);
    // Los del compendio de esta campaña, por su ficha en companeros.json (la gente del pueblo de
    // quedadas.json no va contigo: sale en su localización).
    const names = [...new Set([
        ...confidants.map(c => text(c?.name)),
        ...(campaign ? rowsOf('companeros').filter(r => text(r?.campaign) === campaign).map(r => text(r.who)) : []),
    ].filter(Boolean))];
    if (names.length === 0) return;
    w.plain('parte', 'Los compañeros');
    const mine = (/** @type {any} */ row, /** @type {string} */ name) => fold(row?.who) === fold(name);

    for (const name of names) {
        const c = confidants.findIndex(conf => fold(conf?.name) === fold(name));
        const conf = c >= 0 ? confidants[c] : null;
        const kid = `K:${slug(name)}`;
        w.plain('seccion', `Compañero: ${name}`);
        w.know(name);
        if (conf) {
            const base = ['confidants', c];
            w.line({ id: `${kid}/quien-es`, value: conf.description, src: at([...base, 'description']), label: 'Quién es', kind: 'pantalla' });
            listOf(conf.arrivals).forEach((arrival, k) => {
                w.line({ id: `${kid}/llegada-${slug(arrival?.place) || k + 1}`, value: arrival?.line, src: at([...base, 'arrivals', k, 'line']), label: w.speaker(name), pre: `Al llegar a ${text(arrival?.place)}` });
            });
            listOf(conf.scenes).forEach((scene, k) => {
                if (!isObject(scene)) return;
                const sid = `${kid}/vinculo${text(scene.rank) || k + 1}`;
                w.plain('nota', `Vínculo ${text(scene.rank)}`);
                w.line({ id: `${sid}/titulo`, value: scene.title, src: at([...base, 'scenes', k, 'title']), label: 'Título', kind: 'pantalla' });
                // J13.9: con su conversación escrita (aquí, en `beats`, o como quedada en quedadas.json),
                // la escena en prosa es solo su resumen: sin conexión se juega la conversación, y la
                // prosa no la lee nadie. Sin conversación, sí la cuenta el narrador.
                const talked = listOf(scene.beats).length > 0 || rowsOf('quedadas')
                    .some(row => text(row?.kind) === 'escena' && mine(row, name) && Number(row?.rank) === Number(scene.rank));
                w.line({ id: sid, value: scene.scene, src: at([...base, 'scenes', k, 'scene']), ...(talked ? { label: 'Resumen', kind: 'pantalla' } : { label: NARRATOR }) });
                talkBeats(w, scene.beats, { id: sid, path: [...base, 'scenes', k, 'beats'], doc: 'pack', who: name });
            });
            if (isObject(conf.romance)) {
                w.line({ id: `${kid}/romance/no`, value: conf.romance.no, src: at([...base, 'romance', 'no']), label: w.speaker(name), pre: 'Si contigo no puede ser' });
                listOf(conf.romance.escenas).forEach((scene, k) => {
                    walkRomanceScene(w, scene, { id: `${kid}/romance/${slug(scene?.kind) || 'escena'}${text(scene?.step)}${k + 1}`, path: [...base, 'romance', 'escenas', k], doc: 'pack', who: name });
                });
            }
            walkPersonalQuest(w, conf.misionPersonal, { id: `${kid}/mision`, path: [...base, 'misionPersonal'], doc: 'pack' });
        }
        // Lo del compendio: su ficha, sus charlas, sus quedadas, su romance y su misión.
        rowsOf('companeros').forEach((row, r) => {
            if (!mine(row, name)) return;
            const cid = `CO:${text(row.id) || r + 1}`;
            w.line({ id: `${cid}/romance-no`, value: row.romance?.no, src: at(['rows', r, 'romance', 'no'], 'companeros'), label: w.speaker(name), pre: 'Si contigo no puede ser' });
            for (const [key, said] of [['yes', 'Si le pides que entre en el gremio y dice que sí'], ['no', 'Si dice que no'], ['never', 'Si no entrará nunca']]) {
                w.line({ id: `${cid}/gremio-${key}`, value: row.guild?.[key], src: at(['rows', r, 'guild', key], 'companeros'), label: w.speaker(name), pre: said });
            }
        });
        rowsOf('quedadas').forEach((row, r) => {
            if (!mine(row, name) || !isObject(row)) return;
            const qid = `QD:${text(row.id) || r + 1}`;
            if (row.kind === 'escena') {
                w.line({ id: `${qid}/titulo`, value: row.title, src: at(['rows', r, 'title'], 'quedadas'), label: 'Quedada', type: 'apartado', kind: 'pantalla' });
                talkBeats(w, row.beats, { id: qid, path: ['rows', r, 'beats'], doc: 'quedadas', who: name });
            } else if (row.kind === 'rango' && isObject(row.unlock)) {
                const base = ['rows', r, 'unlock'];
                w.line({ id: `${qid}/nombre`, value: row.unlock.label, src: at([...base, 'label'], 'quedadas'), label: 'Lo que abre el vínculo', kind: 'pantalla' });
                w.line({ id: `${qid}/describe`, value: row.unlock.describe, src: at([...base, 'describe'], 'quedadas'), label: 'En pantalla', depth: 1, kind: 'pantalla' });
                if (isObject(row.unlock.quest)) walkPersonalQuest(w, row.unlock.quest, { id: `${qid}/mision`, path: [...base, 'quest'], doc: 'quedadas' });
            }
        });
        rowsOf('charlas').forEach((row, r) => {
            if (charlasPlaced.has(r) || !mine(row, name)) return;
            charlasPlaced.add(r);
            walkSmallTalk(w, row, r, name);
        });
        rowsOf('romances').forEach((row, r) => {
            if (!mine(row, name)) return;
            walkRomanceScene(w, row, { id: `RO:${text(row.id) || r + 1}`, path: ['rows', r], doc: 'romances', who: name });
        });
        rowsOf('personales').forEach((row, r) => {
            if (!mine(row, name)) return;
            walkPersonalQuest(w, row, { id: `PM:${text(row.id) || r + 1}`, path: ['rows', r], doc: 'personales' });
        });
    }
}

/**
 * Las noches en la posada y las charlas cortas de esta campaña que no son de nadie en concreto.
 *
 * @param {Writer} w
 * @param {any} compendio
 * @param {string} campaign
 * @param {Set<number>} charlasPlaced
 */
function walkTavern(w, compendio, campaign, charlasPlaced) {
    if (!campaign) return;
    const nights = listOf(compendio?.noches?.rows).map((row, r) => ({ row, r })).filter(e => isObject(e.row) && text(e.row.campaign) === campaign);
    const talks = listOf(compendio?.charlas?.rows).map((row, r) => ({ row, r }))
        .filter(e => isObject(e.row) && !charlasPlaced.has(e.r) && text(e.row.campaign) === campaign);
    if (nights.length + talks.length === 0) return;
    w.plain('parte', 'En la posada y por la calle');
    for (const { row, r } of nights) {
        const nid = `N:${text(row.id) || r + 1}`;
        w.line({ id: `${nid}/titulo`, value: row.title, src: at(['rows', r, 'title'], 'noches'), label: 'Noche', type: 'apartado', kind: 'pantalla' });
        talkBeats(w, row.beats, { id: nid, path: ['rows', r, 'beats'], doc: 'noches', who: '' });
    }
    if (talks.length > 0) w.plain('seccion', 'Charlas cortas');
    for (const { row, r } of talks) {
        charlasPlaced.add(r);
        walkSmallTalk(w, row, r, text(row.who));
    }
}

// ---------------------------------------------------------------------------------------------
// El guion entero
// ---------------------------------------------------------------------------------------------

/** Lo que se le dice a quien corrige, al principio del Word. */
export const HOW_TO_EDIT = [
    'Cambia solo lo que va detrás de los dos puntos. Lo de delante (quién lo dice y su cara) es para leer.',
    'No toques las marcas grises del final de cada línea, como [#E:el-muelle/2~7c1f]: así el juego sabe qué línea es.',
    'Las marcas como {el nuevo|la nueva} cambian con el género de tu héroe: deja las llaves y la barra, y cambia las palabras si quieres.',
    'Los huecos como {hola} o {npc:tomas} los rellena el juego: déjalos como están.',
    'Una línea nueva, sin marca, no entra en el juego: sale como nota para el Gem guionista. Para añadir escenas o ramas, pídeselo al Gem.',
    'No borres líneas: una línea borrada se queda en el juego como estaba.',
    'Cuando acabes, guarda el Word y pide que lo importen. Primero se enseña qué cambia; solo se guarda si dices que sí.',
];

/** Cómo leer las etiquetas. */
export const LEGEND = [
    'Tú: lo que eliges decir o hacer.',
    'Narrador: una línea que no dice nadie. En el juego sin conexión no debería quedar ninguna (D-J60).',
    'En pantalla, Diario, Misión: texto que se lee escrito, no dicho.',
    'Entre paréntesis, detrás del nombre: lo que es esa persona, mientras aún no se ha presentado. Detrás, la cara: (alegre), (enfadado), (triste).',
];

/**
 * El guion de una campaña, en bloques y en orden de lectura.
 *
 * @param {any} pack El paquete, tal como está en su archivo (sin leer ni rellenar: las rutas son las del archivo).
 * @param {Object} [input]
 * @param {string} [input.campaign] Su id en el compendio (`gremio`, `1387`, `strahd`): las filas con ese `campaign`.
 * @param {Record<string, any>} [input.compendio] Los archivos del compendio ya leídos, por nombre (`charlas`…).
 * @param {string} [input.date] La fecha que sale en la portada.
 * @returns {Script}
 */
export function buildScript(pack, { campaign = '', compendio = {}, date = '' } = {}) {
    const source = isObject(pack) ? pack : {};
    const w = createWriter(source);
    const title = text(source.world?.name) || text(source.plot?.title) || text(campaign) || 'Campaña';
    w.plain('titulo', `${title}: el guion`);
    w.plain('subtitulo', ['Guion de lectura', date].filter(Boolean).join(' · '));
    w.line({ id: 'T:sinopsis', value: source.world?.synopsis, src: at(['world', 'synopsis']), label: 'De qué va', kind: 'pantalla' });
    const counted = w.blocks.length;
    w.plain('seccion', 'Cómo corregir');
    for (const said of HOW_TO_EDIT) w.plain('nota', said, { bullet: true });
    w.plain('seccion', 'Cómo leerlo');
    for (const said of LEGEND) w.plain('nota', said, { bullet: true });

    const placed = { dialogues: new Set(), boards: new Set(), quests: new Set() };
    walkPlot(w, source, placed);
    walkEndings(w, source);
    const dialogues = listOf(source.dialogues);
    if (dialogues.some((_, d) => !placed.dialogues.has(d))) {
        w.plain('parte', 'Más conversaciones');
        dialogues.forEach((dialogue, d) => walkDialogue(w, dialogue, d, placed.dialogues));
    }
    const phrasesPlaced = new Set();
    const charlasPlaced = walkWorld(w, source, compendio, text(campaign), phrasesPlaced) ?? new Set();
    walkCompanions(w, source, compendio, text(campaign), charlasPlaced);
    walkTavern(w, compendio, text(campaign), charlasPlaced);
    const boards = listOf(source.boards);
    const quests = listOf(source.quests);
    if (boards.some((_, b) => !placed.boards.has(b)) || quests.some((_, q) => !placed.quests.has(q))) {
        w.plain('parte', 'Más peleas y misiones');
        boards.forEach((_, b) => walkBoard(w, source, b, placed.boards, placed.quests));
        quests.forEach((quest, q) => {
            if (placed.quests.has(q) || !isObject(quest)) return;
            placed.quests.add(q);
            walkQuest(w, quest, q);
        });
    }

    const lines = w.blocks.filter(b => b.id);
    const counts = {
        lines: lines.length,
        said: lines.filter(b => b.kind === 'linea').length,
        choices: lines.filter(b => b.kind === 'tu').length,
        narrator: lines.filter(b => b.kind === 'narrador').length,
    };
    // La cuenta, debajo del título.
    w.blocks.splice(counted, 0, {
        type: 'nota',
        text: `${counts.lines} líneas: ${counts.said} dichas por alguien, ${counts.choices} tuyas, `
            + `${counts.lines - counts.said - counts.choices - counts.narrator} escritas en pantalla y ${counts.narrator} sin nadie que las diga (Narrador).`,
    });
    return { title, blocks: w.blocks, counts, people: w.people };
}

// ---------------------------------------------------------------------------------------------
// La vuelta: del Word a lo que cambia
// ---------------------------------------------------------------------------------------------

/**
 * Un párrafo del Word leído: su marca (id y huella) y su texto, lo de detrás de los dos puntos.
 *
 * @param {string} paragraph
 * @returns {{id: string, hash: string, text: string, label: string, broken: boolean}|null} Null sin marca.
 */
export function readParagraph(paragraph) {
    const said = String(paragraph ?? '');
    const mark = MARK.exec(said);
    if (!mark) return null;
    const body = said.slice(0, mark.index);
    const cut = body.indexOf(': ');
    if (cut < 0) return { id: mark[1].trim(), hash: mark[2], text: normalizeText(body), label: '', broken: true };
    return { id: mark[1].trim(), hash: mark[2], text: normalizeText(body.slice(cut + 2)), label: body.slice(0, cut).trim(), broken: false };
}

/** Los huecos de un texto que no son marcas de género: `{hola}`, `{npc:tomas}`. */
const tokensOf = (/** @type {string} */ said) => [...String(said ?? '').matchAll(/\{([^{}|]*)\}/g)].map(m => m[0]);

/**
 * Lo que se ha roto en una línea al corregirla: errores (no se guarda) y avisos (se guarda).
 *
 * @param {string} before
 * @param {string} after
 * @param {{people?: any[]}} [input]
 * @returns {{errors: string[], warnings: string[]}}
 */
export function checkEdit(before, after, { people = [] } = {}) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];
    const now = String(after ?? '');
    if (!now.trim()) {
        errors.push('la línea se ha quedado vacía (desde el Word no se borra nada)');
        return { errors, warnings };
    }
    const opens = (now.match(/\{/g) ?? []).length;
    const closes = (now.match(/\}/g) ?? []).length;
    if (opens !== closes) errors.push(`hay ${opens} llaves «{» y ${closes} «}»: alguna marca se ha quedado sin cerrar`);
    for (const left of leftoverMarkers(now)) errors.push(`marca de género rota: ${left}`);
    const thirdBefore = new Set(thirdForms(before));
    for (const third of thirdForms(now)) if (!thirdBefore.has(third)) warnings.push(`marca con tres formas (ya no se usan): ${third}`);
    for (const hack of genderHacks(now)) warnings.push(`apaño de género: «${hack}»; mejor una marca como {cansado|cansada}`);
    const had = tokensOf(before);
    const has = tokensOf(now);
    for (const token of has.filter(t => !had.includes(t))) {
        const ref = /^\{(?:npc|persona):([^{}:]+)/.exec(token);
        if (ref && findPerson(ref[1], people)) continue;
        // Con espacios dentro, es una marca de género a la que le falta la barra.
        if (/\s/.test(token)) errors.push(`marca de género rota: ${token} (le falta la barra | entre las dos formas)`);
        else errors.push(`hueco nuevo ${token}: el juego no sabrá qué poner ahí`);
    }
    for (const token of had.filter(t => !has.includes(t))) warnings.push(`ya no lleva el hueco ${token}`);
    const marks = (/** @type {string} */ said) => (said.match(/\{[^{}]*\|[^{}]*\}/g) ?? []).length;
    if (marks(String(before ?? '')) > 0 && marks(now) === 0) warnings.push('ya no cambia con el género de tu héroe');
    if (people.length > 0) {
        const named = (/** @type {string} */ said) => new Set(namesIn(said, people).map(hit => hit.person.name));
        const was = named(String(before ?? ''));
        const is = named(now);
        for (const name of was) if (!is.has(name)) warnings.push(`ya no nombra a ${name}`);
        for (const name of is) if (!was.has(name)) warnings.push(`ahora nombra a ${name}: ¿quien juega ya sabe cómo se llama?`);
    }
    return { errors, warnings };
}

/**
 * @typedef {Object} ScriptChange
 * @property {string} id
 * @property {ScriptBlock} block La línea, como está ahora en el juego.
 * @property {string} before
 * @property {string} after
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} ScriptReview Lo que trae un Word corregido.
 * @property {ScriptChange[]} changed Lo que cambiaste (los que traen errores no se guardan).
 * @property {string[]} unknown Ids del Word que el juego ya no tiene.
 * @property {Array<{id: string, now: string, word: string}>} newer Líneas que el juego cambió después de exportar y tú no: se queda lo del juego.
 * @property {Array<{id: string, now: string, word: string}>} conflicts Las cambiasteis los dos: no se toca.
 * @property {Array<{text: string, after: string}>} notes Texto sin marca: notas para el Gem guionista.
 * @property {string[]} broken Ids cuya línea ha perdido los dos puntos.
 * @property {string[]} missing Ids del juego que no están en el Word (borradas o no exportadas).
 * @property {number} same Las que siguen igual.
 */

/**
 * Los estilos de párrafo que no son líneas del guion: títulos, la portada y las notas. Sin marca,
 * no son texto nuevo (un título que cambió de nombre en el juego no es una nota tuya).
 */
export const NOT_LINES = /^(Title|Subtitle|Heading\d?|GuionNota|T[ií]tulo\s?\d?)$/i;

/**
 * Comparar el Word con el guion de ahora: qué líneas cambiaste, cuáles no se encuentran, cuáles
 * cambió el juego mientras tanto y qué texto nuevo trae sin marca.
 *
 * @param {Script} script El guion del juego, tal como está ahora.
 * @param {Array<string|{text: string, style?: string}>} paragraphs Los párrafos del Word, en texto
 *   plano, con su estilo si se sabe.
 * @returns {ScriptReview}
 */
export function reviewScript(script, paragraphs) {
    /** @type {Map<string, ScriptBlock>} */
    const byId = new Map();
    for (const block of script.blocks) if (block.id) byId.set(block.id, block);
    // Lo que el guion escribe sin marca (títulos, notas, la portada): no son notas tuyas.
    const fixed = new Set(script.blocks.filter(b => !b.id).map(b => normalizeText(blockText(b))));
    /** @type {ScriptReview} */
    const review = { changed: [], unknown: [], newer: [], conflicts: [], notes: [], broken: [], missing: [], same: 0 };
    const seen = new Set();
    let after = '';
    const people = listOf(script.people);
    for (const raw of listOf(paragraphs)) {
        const paragraph = normalizeText(isObject(raw) ? raw.text : raw);
        const style = isObject(raw) ? text(raw.style) : '';
        if (!paragraph) continue;
        const read = readParagraph(paragraph);
        if (!read) {
            // Lo que escribe el guion (títulos, notas, la portada) no es una línea nueva.
            if (!fixed.has(paragraph) && !NOT_LINES.test(style)) review.notes.push({ text: paragraph, after });
            continue;
        }
        after = read.id;
        if (read.broken) {
            review.broken.push(read.id);
            continue;
        }
        let block = byId.get(read.id);
        // Si en su sitio ya no está lo que se exportó (alguien quitó o puso una línea antes en la
        // escena), se busca por su huella en la misma escena o charla.
        if (!block || textHash(block.text) !== read.hash) block = moved(byId, read.id, read.hash, seen) ?? block;
        if (!block) {
            review.unknown.push(read.id);
            continue;
        }
        const id = /** @type {string} */ (block.id);
        if (seen.has(id)) continue;
        seen.add(id);
        const now = normalizeText(block.text);
        if (read.text === now) {
            review.same++;
            continue;
        }
        if (textHash(now) === read.hash) {
            const { errors, warnings } = checkEdit(now, read.text, { people });
            review.changed.push({ id, block, before: now, after: read.text, errors, warnings });
        } else if (textHash(read.text) === read.hash) {
            review.newer.push({ id, now, word: read.text });
        } else {
            review.conflicts.push({ id, now, word: read.text });
        }
    }
    review.missing = [...byId.keys()].filter(id => !seen.has(id));
    return review;
}

/**
 * La línea que se exportó con un id que ya no es suyo: la única de la misma escena o charla (lo
 * de antes de la primera barra: `E:el-muelle`) cuyo texto de ahora tiene esa huella.
 *
 * @param {Map<string, ScriptBlock>} byId
 * @param {string} id
 * @param {string} hash
 * @param {Set<string>} seen
 * @returns {ScriptBlock|null}
 */
function moved(byId, id, hash, seen) {
    const anchor = id.split('/')[0];
    const found = [...byId.values()].filter(block => block.id && block.id.split('/')[0] === anchor && !seen.has(block.id) && textHash(block.text) === hash);
    return found.length === 1 ? found[0] : null;
}

