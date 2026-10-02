/**
 * Las notas del juego, dichas por la gente (J13.1 y J18.10 de wiki/ROADMAP_SIN_CONEXION.md, con
 * la decisión D-J54).
 *
 * Daniel, el 2026-10-02: «el narrador prácticamente desaparece… la historia se cuenta mediante
 * conversaciones en estilo de visual novel, algo como pasa con Etrian Odyssey». Las notas del
 * motor ya se contaban en prosa (`narration-prose.js`); sin modelo, cada una llega ahora a quien
 * juega de una de tres maneras:
 *
 * - **la dice alguien que está allí** (`line`): la tendera al cobrar, el posadero al servir la
 *   comida o al dar los buenos días, la maestra del gremio al apuntar un encargo, un mercenario al
 *   unirse o al irse, un compañero junto al fuego. Sale en la caja con su retrato, su placa y su
 *   cara, con sus palabras;
 * - **un aviso corto** (`notice`), sin placa, cuando no hay a quien le toque decirlo;
 * - **nada** (`quiet`): lo que ya se ve en pantalla (las horas que pasan, la vida tras dormir, el
 *   botín de una pelea, la tirada de la guardia) no se repite en la caja. La nota se queda en el
 *   chat con su etiqueta, para el Diario y el registro.
 *
 * Las frases están en `compendio/frases.json`, en las clases `voz-*`: se cambian sin tocar código.
 * Sin banco, cada clase tiene aquí una frase de reserva, para que nunca falte qué decir.
 *
 * Puro: de una nota y de quién está, a lo que se ve. Quien llama la publica (`party/narration.js`).
 */

import { readTaggedLine } from './chronicle.js';
import { pickPhrase, fillLine, hashOf } from './human-lines.js';
import { countWord } from './narration-notes.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Un emoji (o varios) delante de la nota: «🎲 Guardia de…». */
const EMOJI_HEAD = /^(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{200D}\p{Extended_Pictographic}]*\s*)+/u;

/**
 * Las frases de reserva de cada clase `voz-*`: la primera de las de `frases.json`, por si el banco
 * no llega. Son también la lista de clases que esta capa lee.
 *
 * @type {Record<string, string>}
 */
export const VOICE_FALLBACKS = {
    'voz-tienda-compra': '{objeto}, ¿eh? Son {precio}.',
    'voz-tienda-venta': 'Por todo eso te doy {precio}. Trato hecho.',
    'voz-tienda-regateo-si': 'Está bien, está bien. Un {descuento} menos, pero solo por hoy.',
    'voz-tienda-regateo-medias': 'Algo te dejo: un {descuento} menos. No me pidas más.',
    'voz-tienda-regateo-no': 'No. Hoy, al precio que hay.',
    'voz-posada-comida': 'Guiso caliente y pan del día. Son {precio}.',
    'voz-posada-comida-gratis': 'Hoy invita el pueblo, que es fiesta. Que aproveche.',
    'voz-posada-establo': 'Ya está en el establo, con su pienso.',
    'voz-posada-despertar': 'Buenos días. ¿Qué tal la cama?',
    'voz-fiesta': 'Hoy es {fiesta}: la comida corre a cuenta del pueblo. Eso sí, la tienda y la herrería no abren.',
    'voz-templo-cura': 'Ya está. Las heridas que pedían tiempo, cerradas. Son {precio} para la capilla.',
    'voz-templo-maldicion': 'Hecho: la maldición se ha ido. Ya puedes soltar {objetos}.',
    'voz-gremio-encargo': 'Apuntado: «{encargo}». Lo pide {pide}, en {sitio}. No tardes.',
    'voz-gremio-encargo-mapa': 'Te lo marco en el mapa: {sitio}, a {dias} de camino.',
    'voz-gremio-sin-pelea': 'Y esta vez no hace falta sacar las armas.',
    'voz-encargo-voy': 'Me apunto: {porque}.',
    'voz-encargo-me-quedo': 'Yo me quedo: {porque}.',
    'voz-llegada-gancho': 'Ojo: {gancho}.',
    'voz-mercenario-entra': 'Por {precio}, cuenta conmigo. Voy contigo hasta que me despidas.',
    'voz-mercenario-sale': 'Me quedo en el gremio, entonces. Ya sabes dónde encontrarme.',
    'voz-noche-tranquila': 'Noche tranquila. Ni un ruido.',
    'voz-noche-intruso': 'Anoche se acercó {intruso}, pero {vigia} dio la voz y se fue sin nada.',
    'voz-noche-intruso-tu': 'Anoche se acercó {intruso}, pero diste la voz a tiempo. Bien visto.',
    'voz-noche-intruso-yo': 'Anoche se acercó {intruso}, pero di la voz a tiempo y se fue sin nada.',
    'voz-noche-robo': 'Anoche entró {intruso} y nadie se dio cuenta. Faltan {precio}.',
    'voz-noche-revuelve': 'Anoche entró {intruso} y lo revolvió todo, pero no se llevó nada.',
    'voz-noche-frio': 'Con este tiempo y sin fuego no he pegado ojo.',
    'voz-noche-fuego': 'Menos mal que encendimos fuego, con el frío que hacía.',
    'voz-cena-caliente': 'Y hemos cenado caliente, que no es poco.',
    'voz-cena-fria': 'La cena, fría y poca. Otra vez será.',
    'voz-cena-sin-fuego': 'Sin fuego, cena fría.',
    'voz-charla-anoche': 'Me gustó charlar contigo anoche.',
    'voz-charla-contigo': 'Anoche estuviste de charla con {otro} hasta tarde, ¿eh?',
    'voz-charla-otros': '{a} y {b} estuvieron de charla hasta tarde.',
    'voz-paces-yo': '{otro} y yo hemos hecho las paces.',
    'voz-paces-tu': 'Me alegro de que {otro} y tú lo hayáis arreglado.',
    'voz-paces-otros': '{a} y {b} han hecho las paces. Ya era hora.',
};

/** Las clases de frase de esta capa, en `frases.json`. */
export const VOICE_KINDS = Object.keys(VOICE_FALLBACKS);

/** Quien atiende cada servicio cuando el mundo no dice quién: por lo que es (J13.7). */
const KEEPER_ROLES = { tienda: 'El tendero', posada: 'El posadero', herreria: 'El herrero', templo: 'El sacerdote' };

/**
 * @typedef {Object} VoicePerson
 * @property {string} name
 * @property {string} [gender]
 */

/**
 * @typedef {Object} VoiceScene
 * @property {Record<string, VoicePerson>} [keepers] Quien atiende cada servicio de aquí (`tienda`,
 *   `posada`, `herreria`, `templo`, `gremio`), si el mundo lo dice.
 * @property {string[]} [services] Los servicios que hay aquí: sin persona escrita, lo atiende alguien por lo que es.
 * @property {string} [open] El sitio del pueblo abierto ahora (`posada`, `tienda`…), si lo hay.
 * @property {VoicePerson[]} [companions] Los del grupo que siguen en pie, sin tu héroe (con los mercenarios).
 * @property {VoicePerson[]} [party] Todo el grupo, para reconocer a quien nombra la nota.
 * @property {VoicePerson|null} [hero] Tu héroe: lo suyo no se lo dice nadie.
 * @property {string} [restUnder] Dónde fue el último descanso: `techo`, `cielo` o vacío.
 */

/**
 * @typedef {Object} VoicedNote
 * @property {'line'|'notice'|'quiet'} mode
 * @property {string} text Lo que se lee: la frase de quien habla o el aviso. Vacío si `quiet`.
 * @property {string} [who] Quien lo dice (`line`).
 * @property {string} [mood] Con qué cara (`alegre`, `enfadado`, `triste`), si no es la de siempre.
 * @property {string} [kind] La clase de frase (`voz-tienda-compra`…), para no repetir.
 * @property {string} [before] Un aviso que va antes de la frase: lo de la nota que no le toca decir a quien habla.
 */

/**
 * «una moneda», «nueve monedas», «25 monedas»: el precio como se dice en voz alta.
 *
 * @param {any} n
 * @returns {string}
 */
export function coinWords(n) {
    const whole = Math.max(0, Math.floor(Number(n) || 0));
    return whole === 1 ? 'una moneda' : `${countWord(whole)} monedas`;
}

/**
 * «un lobo famélico», «una rata de bodega»: un bicho con su artículo, por cómo acaba su primera
 * palabra. Un nombre propio («Strahd») se queda como está.
 *
 * @param {string} name
 * @returns {string}
 */
export function someone(name) {
    const said = text(name);
    if (!said) return '';
    const words = said.split(/\s+/);
    // Un nombre propio de varias palabras lleva mayúscula también detrás («Ojo Rojo»).
    if (words.length > 1 && words.slice(1).every(w => /^\p{Lu}/u.test(w))) return said;
    if (words.length === 1 && /^\p{Lu}/u.test(said) && !/[aeo]$/i.test(said)) return said;
    const first = words[0].toLocaleLowerCase('es');
    const lower = [first, ...words.slice(1)].join(' ');
    return `${/(?:a|ión|dad|tud|umbre)$/u.test(first) ? 'una' : 'un'} ${lower}`;
}

/**
 * La primera letra en minúscula, salvo que el resto diga que es un nombre propio.
 *
 * @param {string} value
 * @returns {string}
 */
function lowerFirst(value) {
    const said = text(value);
    const words = said.split(/\s+/);
    if (words.length > 1 && words.slice(1).every(w => /^\p{Lu}/u.test(w))) return said;
    return said ? said[0].toLocaleLowerCase('es') + said.slice(1) : said;
}

/**
 * El motivo de ir o no a un encargo (`rules/companions.js`), dicho por quien lo tiene:
 * «no le dice nada» → «ni me va ni me viene», «odia a los Cuervos» → «odio a los Cuervos».
 *
 * @param {string} reason
 * @returns {string}
 */
function firstPerson(reason) {
    const said = text(reason);
    if (/^no le dice nada$/u.test(said)) return 'ni me va ni me viene';
    if (/^va contigo de todas formas$/u.test(said)) return 'voy contigo de todas formas';
    return said.replace(/^le parece /u, 'me parece ').replace(/^odia a /u, 'odio a ').replace(/^busca /u, 'busco ');
}

/** @param {string} value @returns {string} */
function upperFirst(value) {
    const said = text(value);
    return said ? said[0].toLocaleUpperCase('es') + said.slice(1) : said;
}

/**
 * Las frases de una nota, separadas: «La noche pasa sin sobresaltos. Se cena caliente…».
 *
 * @param {string} said
 * @returns {string[]}
 */
function sentencesOf(said) {
    return text(said).split(/(?<=[.!?…])\s+(?=[\p{Lu}¿¡«])/u).map(text).filter(Boolean);
}

/**
 * Quien atiende un servicio aquí: la persona del mundo, o alguien por lo que es si el sitio lo tiene.
 *
 * @param {VoiceScene} scene
 * @param {string} service
 * @returns {VoicePerson|null}
 */
function keeperOf(scene, service) {
    const written = scene?.keepers?.[service];
    if (written?.name) return written;
    const role = KEEPER_ROLES[/** @type {keyof typeof KEEPER_ROLES} */ (service)];
    return role && (scene?.services ?? []).includes(service) ? { name: role } : null;
}

/**
 * Un compañero que lo diga, siempre el mismo para la misma semilla. Mejor uno que no sea `avoid`.
 *
 * @param {VoiceScene} scene
 * @param {string} seed
 * @returns {VoicePerson|null}
 */
function companionOf(scene, seed) {
    const list = (scene?.companions ?? []).filter(c => text(c?.name));
    if (list.length === 0) return null;
    return list[hashOf(seed) % list.length];
}

/**
 * Lo que dice quien habla, con una frase de su clase.
 *
 * @param {string} kind
 * @param {Record<string, any>} facts
 * @param {VoicePerson} speaker
 * @param {{rows: any[], seed: string, turn: number|((kind: string) => number), who: Record<string, any>}} input
 * @returns {string}
 */
function sayAs(kind, facts, speaker, { rows, seed, turn, who }) {
    const generos = { ...who, voz: speaker?.gender ?? '' };
    const round = typeof turn === 'function' ? turn(kind) : turn;
    // `persona`: las frases propias de alguien (`when.persona`), como las de los saludos.
    return pickPhrase(kind, { persona: text(speaker?.name), ...facts }, { seed: `${seed}|${kind}`, turn: round, who: generos, rows })
        || fillLine(VOICE_FALLBACKS[kind] ?? '', facts, generos)
        || '';
}

/**
 * La noche al raso (`🏕️ [CAMPAMENTO]`), frase a frase, como la cuenta uno del grupo por la
 * mañana. Lo que no sabe decir se queda para el aviso de antes.
 *
 * @param {string} body
 * @param {VoicePerson} speaker
 * @param {(kind: string, facts?: Record<string, any>) => string} say
 * @param {string} [you] Tu héroe: a quien se le habla de tú («diste la voz a tiempo»).
 * @returns {{said: string[], rest: string[]}}
 */
function campSpeech(body, speaker, say, you = '') {
    const me = text(speaker?.name);
    const hero = text(you);
    /** @type {string[]} */
    const said = [];
    /** @type {string[]} */
    const rest = [];
    // Quien entra sin que nadie le vea son dos frases («…: nadie hacía guardia (9 contra 12). Se lleva
    // 17 de oro.»), con un paréntesis en medio: se lee entera antes de partir la noche en frases.
    let night = text(body);
    const theft = night.match(/^(.+?) entra en el campamento de noche: [^.]*\.\s*(?:Se lleva (\d+) de oro\.|Revuelve, pero no encuentra nada que llevarse\.)\s*/u);
    if (theft) {
        said.push(theft[2] ? say('voz-noche-robo', { intruso: someone(theft[1]), precio: coinWords(theft[2]) }) : say('voz-noche-revuelve', { intruso: someone(theft[1]) }));
        night = night.slice(theft[0].length);
    }
    for (const sentence of sentencesOf(night)) {
        /** @type {RegExpMatchArray|null} */
        let m = null;
        if (/^La noche pasa sin sobresaltos\.$/u.test(sentence)) said.push(say('voz-noche-tranquila'));
        else if ((m = sentence.match(/^(.+?) se acerca de noche, pero (.+?) lo ve venir(?: \([^)]*\))?: se va sin nada\.$/u))) {
            const intruso = someone(m[1]);
            said.push(text(m[2]) === me ? say('voz-noche-intruso-yo', { intruso })
                : text(m[2]) === hero ? say('voz-noche-intruso-tu', { intruso })
                    : say('voz-noche-intruso', { intruso, vigia: m[2] }));
        } else if (/^Sin fuego y con este tiempo no duerme nadie de verdad/u.test(sentence)) said.push(say('voz-noche-frio'));
        else if (/^El fuego aguanta el frío: se duerme\.$/u.test(sentence)) said.push(say('voz-noche-fuego'));
        else if (/^Sin fuego no hay cena caliente\.$/u.test(sentence)) said.push(say('voz-cena-sin-fuego'));
        else if (/^No sale nada que echar al fuego: se cena frío, y poco\.$/u.test(sentence)) said.push(say('voz-cena-fria'));
        else if (/^Se cena caliente junto al fuego: nadie pasa hambre\.$/u.test(sentence)) said.push(say('voz-cena-caliente'));
        else if ((m = sentence.match(/^(.+?) y (.+?) hablan hasta tarde(?: junto al fuego)?\.$/u))) {
            const [a, b] = [text(m[1]), text(m[2])];
            // Con quien habla, de tú; si no, quien habló contigo, o los dos por su nombre.
            said.push(a === me || b === me ? say('voz-charla-anoche')
                : a === hero || b === hero ? say('voz-charla-contigo', { otro: a === hero ? b : a })
                    : say('voz-charla-otros', { a, b }));
        } else if ((m = sentence.match(/^(.+?) y (.+?) (?:charlan junto al fuego, y )?hacen las paces\.$/u))) {
            const [a, b] = [text(m[1]), text(m[2])];
            said.push(a === me || b === me ? say('voz-paces-yo', { otro: a === me ? b : a })
                : a === hero || b === hero ? say('voz-paces-tu', { otro: a === hero ? b : a })
                    : say('voz-paces-otros', { a, b }));
        } else rest.push(sentence);
    }
    return { said: said.filter(Boolean), rest };
}

/**
 * Una nota del motor, como llega a quien juega sin modelo: quién la dice y con qué palabras, un
 * aviso corto, o nada.
 *
 * @param {string} note La nota como se guarda, con su etiqueta («🛒 [TIENDA] Irene compra…»).
 * @param {Object} [input]
 * @param {string} [input.told] La nota ya contada (`noteProse`): el aviso, si nadie la dice.
 * @param {VoiceScene} [input.scene] Quién está.
 * @param {any[]} [input.rows] El banco de frases (`frases.json`).
 * @param {string} [input.seed] Para elegir la frase (la partida).
 * @param {number|((kind: string) => number)} [input.turn] Cuántas frases de esa clase se han dicho ya: van por turnos, sin repetir.
 * @param {Record<string, any>} [input.who] Para el género: `{heroe, grupo}`.
 * @returns {VoicedNote}
 */
export function voiceNote(note, { told = '', scene = {}, rows = [], seed = '', turn = 0, who = {} } = {}) {
    const raw = text(note);
    const tagged = readTaggedLine(raw);
    const tag = tagged?.tag ?? '';
    const body = text(tagged ? tagged.text : raw.replace(EMOJI_HEAD, ''));
    /** @type {VoicedNote} */
    const notice = { mode: 'notice', text: text(told) || raw };
    /** @type {VoicedNote} */
    const quiet = { mode: 'quiet', text: '' };
    const solo = (scene?.companions ?? []).length === 0 ? 'sí' : 'no';
    const input = { rows, seed, turn, who };
    /**
     * @param {VoicePerson|null} speaker
     * @param {string} kind
     * @param {Record<string, any>} [facts]
     * @param {string} [mood]
     * @returns {VoicedNote}
     */
    const line = (speaker, kind, facts = {}, mood = '') => {
        if (!speaker?.name) return notice;
        const said = sayAs(kind, { solo, ...facts }, speaker, input);
        return said ? { mode: 'line', who: text(speaker.name), mood, kind, text: said } : notice;
    };
    /** @type {RegExpMatchArray|null} */
    let m = null;

    // --- Lo que ya se ve en pantalla -----------------------------------------------------
    // Las horas que pasan y el día que amanece: el reloj de la cabecera.
    if (tag === 'CAMPAÑA' && (/^Amanece el día \d+\.?$/u.test(body) || /^Día \d+ · /u.test(body))) return quiet;
    // Lo que cura un descanso: el aviso de «Descanso largo» y las barras de vida.
    if (tag === 'DESCANSO' && /^Descanso (?:corto|largo)\b/u.test(body)) return quiet;
    // La tirada de la guardia: la noche ya dice quién vio qué.
    if (!tag && /^Guardia de .+: \d+ contra \d+/u.test(body)) return quiet;
    // La copia de la noche que lee el modelo: la misma noche, otra vez.
    if (tag === 'CAMPAMENTO' && /^Noche en /u.test(body)) return quiet;
    // El final de una pelea: la cuenta y el botín salen en la pantalla de la victoria, y que se
    // acaba se ve al dejar el tablero.
    if (tag === 'COMBAT' && /^(?:Resumen final|Botín:|El combate termina\.$)/u.test(body)) return quiet;
    // El resumen de la pelea para el modelo, si el motor no tiene frase para el final.
    if (!tag && /^El grupo (?:ha ganado el combate|ha sido derrotado|abandona el combate)/u.test(body)) return quiet;

    // --- El descanso -------------------------------------------------------------------------
    if (tag === 'DESCANSO') {
        // En la posada, por la mañana, quien la lleva da los buenos días.
        if (scene?.restUnder === 'techo' && scene?.open === 'posada') {
            const keeper = keeperOf(scene, 'posada');
            if (keeper) return line(keeper, 'voz-posada-despertar');
        }
        // Al raso, la noche la cuenta el campamento (los tuyos, por la mañana).
        if (scene?.restUnder === 'cielo') return quiet;
        return notice;
    }

    // --- La tienda ---------------------------------------------------------------------------
    if (tag === 'TIENDA') {
        const keeper = keeperOf(scene, 'tienda');
        if ((m = body.match(/^(.+?) compra (.+?) por (\d+) de oro\./u))) {
            return line(keeper, 'voz-tienda-compra', { objeto: upperFirst(m[2]), objeto_min: lowerFirst(m[2]), precio: coinWords(m[3]) });
        }
        if ((m = body.match(/^Vendéis (.+): (\d+) de oro\.$/u))) return line(keeper, 'voz-tienda-venta', { precio: coinWords(m[2]) }, 'alegre');
        if ((m = body.match(/^.+? regatea con .+?: (\d+) % menos para hoy(, a medias)?\.$/u))) {
            // «un diez por ciento», «un 15 por ciento»: en letra hasta el diez, como los precios.
            const percent = Number(m[1]);
            return line(keeper, m[2] ? 'voz-tienda-regateo-medias' : 'voz-tienda-regateo-si', { descuento: `${countWord(percent)} por ciento` });
        }
        if (/^.+? regatea con .+?: no cede/u.test(body)) return line(keeper, 'voz-tienda-regateo-no', {}, 'enfadado');
        return notice;
    }

    // --- La posada ---------------------------------------------------------------------------
    if (tag === 'POSADA') {
        const keeper = keeperOf(scene, 'posada');
        if ((m = body.match(/^Comida caliente para todos \((\d+) de oro\)\.$/u))) {
            return Number(m[1]) > 0 ? line(keeper, 'voz-posada-comida', { precio: coinWords(m[1]) }) : line(keeper, 'voz-posada-comida-gratis', {}, 'alegre');
        }
        if (/^En el establo: /u.test(body)) return line(keeper, 'voz-posada-establo');
        return notice;
    }
    if (tag === 'FIESTA' && (m = body.match(/^Hoy es (.+?) en .+?: la comida de la posada corre a cuenta del pueblo/u))) {
        const keeper = scene?.keepers?.posada ?? null;
        return keeper ? line(keeper, 'voz-fiesta', { fiesta: m[1] }, 'alegre') : notice;
    }

    // --- El templo ---------------------------------------------------------------------------
    if (tag === 'TEMPLO') {
        const keeper = keeperOf(scene, 'templo');
        if ((m = body.match(/^En el templo de .+? os cosen y os vendan \((\d+) de oro\)\./u))) return line(keeper, 'voz-templo-cura', { precio: coinWords(m[1]) });
        if ((m = body.match(/^Quitan la maldición: (.+?)\. Ya se puede soltar\.$/u))) return line(keeper, 'voz-templo-maldicion', { objetos: m[1] });
        return notice;
    }

    // --- Un encargo ---------------------------------------------------------------------------
    // La copia que lee el modelo: la misma nota otra vez.
    if (tag === 'ENCARGO' && /^Encargo aceptado: /u.test(body)) return quiet;
    if (tag === 'GREMIO') {
        // Al aceptarlo en el gremio, te lo apunta quien lo lleva: qué es, quién lo pide y dónde.
        if ((m = body.match(/^Encargo aceptado: «(.+?)», lo pide (.+?)\. (?:Se juega en (.+?)(?: \([^)]*\))?|Se resuelve en (.+?), sin pelear[^.]*)\.$/u))) {
            const keeper = keeperOf(scene, 'gremio');
            const said = line(keeper, 'voz-gremio-encargo', { encargo: m[1], pide: m[2], sitio: m[3] || m[4] });
            if (said.mode !== 'line' || !m[4]) return said;
            return { ...said, text: `${said.text} ${sayAs('voz-gremio-sin-pelea', { solo }, /** @type {VoicePerson} */ (keeper), input)}`.trim() };
        }
        // Y te marca en el mapa el sitio, si aún no salía. Lo demás ya lo ha dicho.
        if ((m = body.match(/^Aceptáis «(.+?)»(?:, que pide [^.]+)?\.(?: (.+?) ya sale en el mapa(?:: está a (.+?) de camino)?\.)?(?: Se resuelve allí, sin pelear\.)?$/u))) {
            return m[2] && m[3] ? line(keeperOf(scene, 'gremio'), 'voz-gremio-encargo-mapa', { sitio: m[2], dias: m[3] }) : quiet;
        }
        // Quién va y quién no, con su motivo: cada uno lo dice a su manera. Tu héroe va siempre.
        if ((m = body.match(/^(.+?) se (apunta|queda): (.+)\.$/u))) {
            if (text(m[1]) === text(scene?.hero?.name)) return quiet;
            const member = (scene?.party ?? []).find(p => text(p?.name) === text(m?.[1]));
            if (!member) return notice;
            const reasons = m[3].split(/,\s*/u).map(firstPerson).join(', ');
            return line(member, m[2] === 'apunta' ? 'voz-encargo-voy' : 'voz-encargo-me-quedo', { porque: reasons, porque_mayus: upperFirst(reasons) });
        }
        if ((m = body.match(/^(.+?) \(.+?\) se une al grupo por (\d+) de oro\. Va contigo hasta que le despidas\.$/u))) {
            const merc = (scene?.party ?? []).find(p => text(p?.name) === text(m?.[1])) ?? { name: text(m[1]) };
            return line(merc, 'voz-mercenario-entra', { precio: coinWords(m[2]) }, 'alegre');
        }
        if ((m = body.match(/^(.+?) se despide y se queda en el gremio\.$/u))) return line({ name: text(m[1]) }, 'voz-mercenario-sale');
        return notice;
    }

    // --- La noche al raso --------------------------------------------------------------------
    if (tag === 'CAMPAMENTO') {
        const speaker = companionOf(scene, `${seed}|${body}`);
        if (!speaker) return notice;
        const speech = campSpeech(body, speaker, (kind, facts = {}) => sayAs(kind, { solo, ...facts }, speaker, input), text(scene?.hero?.name));
        if (speech.said.length === 0) return notice;
        return {
            mode: 'line', who: text(speaker.name), mood: '', kind: 'voz-campamento',
            text: speech.said.join(' '),
            ...(speech.rest.length > 0 ? { before: speech.rest.join(' ') } : {}),
        };
    }

    return notice;
}

/**
 * Al llegar a un sitio, lo que conviene saber de él («aquí está vuestro encargo», «alguien tiene
 * algo que contar»): lo dice uno de los tuyos. A solas, un aviso corto, hablándote a ti.
 *
 * @param {string} hook Lo de `llegada-gancho`, ya en una lista: «aquí está vuestro encargo y…».
 * @param {Object} [input]
 * @param {VoiceScene} [input.scene]
 * @param {any[]} [input.rows]
 * @param {string} [input.seed]
 * @param {number|((kind: string) => number)} [input.turn]
 * @param {Record<string, any>} [input.who]
 * @returns {VoicedNote}
 */
export function voiceArrivalHook(hook, { scene = {}, rows = [], seed = '', turn = 0, who = {} } = {}) {
    const said = text(hook).replace(/\.$/u, '');
    if (!said) return { mode: 'quiet', text: '' };
    const speaker = companionOf(scene, `${seed}|${said}`);
    // Quien va contigo dice «nuestro encargo».
    const ours = said.replace(/\bvuestr([oa]s?)\b/gu, 'nuestr$1');
    const line = speaker ? sayAs('voz-llegada-gancho', { solo: 'no', gancho: ours }, speaker, { rows, seed, turn, who }) : '';
    if (speaker && line) return { mode: 'line', who: text(speaker.name), mood: '', kind: 'voz-llegada-gancho', text: line };
    const yours = said.replace(/\bvuestr[oa]s\b/gu, 'tus').replace(/\bvuestr[oa]\b/gu, 'tu');
    return { mode: 'notice', text: `${upperFirst(yours)}.` };
}

/**
 * Las filas de frases de esta capa que trae un banco (para mirar cuántas hay de cada clase).
 *
 * @param {any[]} rows
 * @returns {Record<string, number>}
 */
export function voiceCoverage(rows) {
    /** @type {Record<string, number>} */
    const out = Object.fromEntries(VOICE_KINDS.map(kind => [kind, 0]));
    for (const row of Array.isArray(rows) ? rows : []) {
        const kind = text(row?.kind);
        if (kind in out) out[kind] += 1;
    }
    return out;
}
