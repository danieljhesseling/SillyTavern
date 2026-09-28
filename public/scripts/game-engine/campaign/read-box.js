/**
 * La caja que entiende, sin modelo (Z3 de wiki/ROADMAP_SIN_TOKENS.md).
 *
 * Sin modelo, lo escrito en la caja no llegaba a ningún sitio: SillyTavern no envía nada si
 * no hay con quién hablar, y «voy a la posada» se quedaba ahí. Aquí se lee con una lista
 * corta de verbos —ir a, entrar en, hablar con, preguntar a alguien por algo, atacar,
 * buscar, examinar, descansar, comprar, vender, esperar— y se convierte en lo mismo que
 * haría una ficha.
 *
 * No es un parser de aventura de texto: es un atajo a las fichas. Solo entiende lo que se
 * puede hacer aquí y ahora, con los nombres de aquí. Lo que no entiende, lo dice, y quien
 * llama enseña lo que se puede hacer (DZ1).
 *
 * Puro: de un texto y de lo que hay aquí, a una intención.
 */

import { intentSkills } from './intents.js';

/**
 * @typedef {Object} BoxContext Lo que hay aquí, con los nombres como están escritos.
 * @property {boolean} [fighting]
 * @property {string[]} [foes] A quién se puede atacar.
 * @property {string[]} [places] A dónde se puede ir.
 * @property {string[]} [boards] En qué tableros de aquí se puede entrar.
 * @property {boolean} [onBoard] Si ya se está dentro de un tablero.
 * @property {string[]} [people] Con quién se puede hablar aquí.
 * @property {string[]} [companions] Los tuyos, sin contar a quien juega.
 * @property {string[]} [services] Los servicios de aquí: `posada`, `tienda`, `herreria`, `templo`, `tablon`.
 * @property {string[]} [wares] Lo que vende la tienda de aquí.
 * @property {string[]} [goods] Lo que lleva el grupo y se puede vender.
 */

/**
 * @typedef {Object} BoxIntent
 * @property {string} do Qué hacer: `go`, `enter`, `leave`, `service`, `talk`, `duel`, `pry`, `threaten`,
 *   `round`, `attack`, `move`, `end-turn`, `check`, `rest`, `camp`, `wait`, `buy`, `sell`, `steal`, `rumor`,
 *   `explore`, `forage`, `help`, `journal` o `unknown`.
 * @property {string} [name] A quién o a dónde, con el nombre como está en el mundo.
 * @property {string} [topic] De qué preguntar: `hilo`, `sabe`, `quiere`, `rumor`, `caso`, `vosotros`.
 * @property {string} [skill] Qué tirada.
 * @property {string} [what] Lo que se intenta, en infinitivo: «buscar huellas en el barro».
 * @property {boolean} [long] Si el descanso es largo.
 * @property {string} [until] Hasta cuándo esperar: `morning`, `afternoon` o `night`.
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [verb] Lo que se entendió que se quería hacer, aunque no se pueda (`unknown`).
 * @property {string} [target] Lo que se nombró y no está aquí (`unknown`).
 * @property {boolean} [companion] Si a quien se invita es de los tuyos (`round`).
 */

/** Cómo se dice cada servicio. */
export const SERVICE_WORDS = {
    posada: ['posada', 'taberna', 'meson', 'fonda', 'cantina', 'bar', 'tabernero', 'posadero'],
    tienda: ['tienda', 'mercado', 'mercader', 'tendero', 'comercio', 'colmado', 'puesto'],
    herreria: ['herreria', 'herrero', 'fragua', 'forja'],
    templo: ['templo', 'iglesia', 'capilla', 'santuario', 'sacerdote', 'altar'],
    tablon: ['tablon', 'anuncios', 'encargos', 'carteles'],
};

/** Palabras que no dicen nada de un nombre. */
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'en', 'con', 'por', 'para', 'a', 'al', 'un', 'una']);

/** Lo que va delante de un nombre y no es el nombre. */
const LEADING = /^(?:(?:a|al|el|la|los|las|lo|del|de|un|una|unos|unas|hacia|hasta|para|por|en|con|contra|sobre|rumbo|mi|mis|nuestro|nuestra|este|esta|ese|esa|aquel|aquella|otra vez|de nuevo)\s+)+/;

/** Lo que se dice antes de lo que se quiere hacer: «quiero», «voy a», «intento». */
const MODAL = /^(?:(?:yo|nosotros|pues|vale|bueno|venga|ahora|luego|despues|primero|mejor|entonces)\s+)*(?:voy a|vamos a|quiero|queremos|intento|intentamos|trato de|tratamos de|necesito|necesitamos|me gustaria|nos gustaria|puedo|podemos|debo|debemos|hay que|tengo que|tenemos que)\s+(.+)$/;

/** Lo que se dice antes y sobra: «yo», «pues», «ahora». */
const FILLER = /^(?:(?:yo|nosotros|pues|vale|bueno|venga|ahora|luego|despues|primero|mejor|entonces)\s+)+/;

/**
 * Minúsculas, sin tildes ni signos, con un espacio entre palabras.
 *
 * @param {any} value
 * @returns {string}
 */
export function fold(value) {
    return clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Minúsculas y sin signos, pero con sus tildes: para devolver lo escrito tal cual.
 *
 * @param {any} value
 * @returns {string}
 */
function clean(value) {
    return String(value ?? '').toLocaleLowerCase('es').replace(/[¿?¡!.,;:«»"“”()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Un nombre sin lo que lleva delante: «la posada» es «posada».
 *
 * @param {any} value
 * @returns {string}
 */
function bare(value) {
    return fold(value).replace(LEADING, '').trim();
}

/**
 * El nombre del mundo al que se refiere lo escrito, o nada.
 *
 * Sirve con el nombre entero, con el principio («castillo» es «Castillo de Vane»), con una
 * palabra que lo distinga («vane») o con más de la cuenta («giles el tabernero»).
 *
 * @param {string} said
 * @param {string[]} [names]
 * @returns {string}
 */
export function pickName(said, names = []) {
    const found = scoreName(said, names);
    return found.score >= 60 ? found.name : '';
}

/**
 * El nombre que más se parece, y cuánto: 100 si es el mismo; 60 si solo comparten una
 * palabra que lo distingue.
 *
 * @param {string} said
 * @param {string[]} names
 * @returns {{name: string, score: number}}
 */
function scoreName(said, names) {
    const want = bare(said);
    if (!want) return { name: '', score: 0 };
    const wantWords = new Set(want.split(' ').filter(w => w.length >= 3 && !STOP.has(w)));
    let best = '';
    let bestScore = 0;
    for (const name of names) {
        const have = bare(name);
        if (!have) continue;
        let score = 0;
        if (have === want) score = 100;
        else if (have.startsWith(`${want} `) && want.length >= 3) score = 90;
        else if (want.startsWith(`${have} `)) score = 85;
        else if (` ${want} `.includes(` ${have} `)) score = 80;
        else if (` ${have} `.includes(` ${want} `) && want.length >= 4) score = 75;
        else {
            const hits = have.split(' ').filter(w => w.length >= 3 && !STOP.has(w) && wantWords.has(w)).length;
            if (hits > 0) score = 50 + 10 * hits;
        }
        if (score > bestScore) {
            best = name;
            bestScore = score;
        }
    }
    return { name: best, score: bestScore };
}

/**
 * El servicio al que se refiere lo escrito, de los que hay.
 *
 * @param {string} said
 * @param {string[]} [services]
 * @returns {string}
 */
export function pickService(said, services = []) {
    const words = new Set(bare(said).split(' '));
    for (const [id, names] of Object.entries(SERVICE_WORDS)) {
        if (names.some(n => words.has(n))) return services.includes(id) ? id : `!${id}`;
    }
    return '';
}

/**
 * Qué es lo nombrado: un sitio, un tablero, un servicio, alguien de aquí, uno de los tuyos
 * o un enemigo. Gana lo que más se parece; a igualdad, lo que el verbo pide antes. «La
 * posada» es la posada, aunque haya un tablero que se llame «El cuarto de la posada».
 *
 * @param {string} said
 * @param {BoxContext} context
 * @param {string[]} order
 * @returns {{kind: string, name: string}|null}
 */
function resolve(said, context, order) {
    /** @type {{kind: string, name: string, score: number}|null} */
    let best = null;
    for (const kind of order) {
        /** @type {{name: string, score: number}} */
        let found;
        if (kind === 'service') {
            const service = pickService(said, context.services ?? []);
            // «La posada», a secas, es el edificio; «la posada del cuervo», quizá otra cosa.
            const exact = SERVICE_WORDS[/** @type {keyof typeof SERVICE_WORDS} */ (service)]?.includes(bare(said));
            found = service && !service.startsWith('!') ? { name: service, score: exact ? 95 : 70 } : { name: '', score: 0 };
        } else {
            const list = /** @type {Record<string, string[]|undefined>} */ ({
                place: context.places, board: context.boards, person: context.people, companion: context.companions, foe: context.foes,
            })[kind] ?? [];
            found = scoreName(said, list);
        }
        if (found.score >= 60 && (!best || found.score > best.score)) best = { kind, ...found };
    }
    return best ? { kind: best.kind, name: best.name } : null;
}

/**
 * Un grupo de formas de un verbo, con su infinitivo.
 *
 * @param {Array<[string, string]>} verbs `[infinitivo, 'forma|forma|…']`
 * @returns {{re: string, inf: Record<string, string>}}
 */
function verbSet(verbs) {
    /** @type {Record<string, string>} */
    const inf = {};
    for (const [base, forms] of verbs) for (const form of forms.split('|')) inf[form] = base;
    const re = Object.keys(inf).sort((a, b) => b.length - a.length).join('|');
    return { re, inf };
}

/** Buscar, mirar y lo demás que se intenta con una tirada. */
const LOOK = verbSet([
    ['buscar', 'busco|buscamos|buscar|busca|buscad'],
    ['examinar', 'examino|examinamos|examinar|examina|examinad'],
    ['registrar', 'registro|registramos|registrar|registra|registrad'],
    ['investigar', 'investigo|investigamos|investigar|investiga'],
    ['revisar', 'reviso|revisamos|revisar|revisa'],
    ['inspeccionar', 'inspecciono|inspeccionamos|inspeccionar|inspecciona'],
    ['estudiar', 'estudio|estudiamos|estudiar|estudia'],
    ['leer', 'leo|leemos|leer|lee'],
    ['rebuscar', 'rebusco|rebuscamos|rebuscar|rebusca'],
    ['mirar', 'miro|miramos|mirar|mira|mirad|echo un vistazo a|echamos un vistazo a|echo un vistazo|echamos un vistazo'],
    ['observar', 'observo|observamos|observar|observa'],
    ['vigilar', 'vigilo|vigilamos|vigilar|vigila'],
    ['escuchar', 'escucho|escuchamos|escuchar|escucha|pego la oreja|pegamos la oreja'],
    ['oler', 'huelo|olemos|oler|olfateo|olfateamos|olfatear'],
    ['rastrear', 'rastreo|rastreamos|rastrear|rastrea|sigo el rastro|seguimos el rastro|seguir el rastro|sigo las huellas|seguimos las huellas'],
    ['trepar', 'trepo|trepamos|trepar|escalo|escalamos|escalar'],
    ['saltar', 'salto|saltamos|saltar'],
    ['nadar', 'nado|nadamos|nadar'],
    ['cruzar', 'cruzo|cruzamos|cruzar'],
    ['empujar', 'empujo|empujamos|empujar'],
    ['forzar', 'fuerzo|forzamos|forzar'],
    ['derribar', 'derribo|derribamos|derribar'],
    ['levantar', 'levanto|levantamos|levantar'],
    ['abrir', 'abro|abrimos|abrir'],
    ['esconderse', 'me escondo|nos escondemos|esconderse|esconderme|me oculto|nos ocultamos'],
    ['colarse', 'me cuelo|nos colamos|colarse|colarme|me deslizo|nos deslizamos'],
    ['mentir', 'miento|mentimos|mentir'],
    ['engañar', 'engano|enganamos|enganar|finjo|fingimos|fingir'],
    ['robar', 'robo|robamos|robar|birlo|birlamos|birlar|hurto|hurtamos|hurtar'],
    ['calar', 'calo|calamos|calar'],
]);

/** Qué tirada pide cada verbo si lo que sigue no dice otra cosa. */
const VERB_SKILL = {
    buscar: 'perception', mirar: 'perception', observar: 'perception', vigilar: 'perception', escuchar: 'perception', oler: 'perception',
    examinar: 'investigation', registrar: 'investigation', investigar: 'investigation', revisar: 'investigation',
    inspeccionar: 'investigation', estudiar: 'investigation', leer: 'investigation', rebuscar: 'investigation',
    rastrear: 'survival',
    trepar: 'athletics', saltar: 'athletics', nadar: 'athletics', cruzar: 'athletics', empujar: 'athletics', forzar: 'athletics',
    derribar: 'athletics', levantar: 'athletics', abrir: 'athletics',
    esconderse: 'stealth', colarse: 'stealth',
    mentir: 'deception', 'engañar': 'deception',
    robar: 'sleight',
    calar: 'insight',
};

/** Lo que se busca dice más que el verbo: las huellas son del que sabe de caminos. */
const THING_SKILL = [
    ['sleight', /\b(cerradura|candado|ganzua|bolsillo|monedero|faltriquera)/],
    ['survival', /\b(huella|rastro|pisada|sendero|senda|caza|presa|madriguera|excremento|orientar|el norte|estrellas|camino de vuelta)/],
    ['insight', /\b(miente|mentira|intenciones|nervios|si dice la verdad|que trama|oculta algo)/],
    ['stealth', /\b(sin que (?:me|nos) vean|a hurtadillas|en silencio|sombras)/],
    ['investigation', /\b(pista|documento|carta|papel|libro|mapa|cajon|mesa|baul|cofre|habitacion|cuarto|cadaver|cuerpo|mecanismo|trampa|inscripcion|runa|simbolo|escombro|estanteria)/],
    ['perception', /\b(alrededor|horizonte|ruido|sonido|voces|olor|movimiento|luz|humo|emboscada)/],
];

/** Lo que se ve desde el verbo de ir: a dónde se va primero. */
const GO_ORDER = ['board', 'service', 'place', 'person', 'companion'];

/**
 * Qué quiere hacer quien escribe esto, con lo que hay aquí.
 *
 * @param {string} said
 * @param {BoxContext} [context]
 * @returns {BoxIntent}
 */
export function readBox(said, context = {}) {
    const whole = fold(said).replace(FILLER, '');
    if (!whole) return { do: 'unknown' };
    // «Voy a buscar huellas» es buscar; «voy a la posada», ir. Se prueba primero sin el «voy a».
    const modal = MODAL.exec(whole);
    const inner = modal ? readPlain(modal[1], said, context) : null;
    if (inner && inner.do !== 'unknown') return inner;
    const plain = readPlain(whole, said, context);
    if (plain.do !== 'unknown') return plain;
    // Lo que se entendió pero no se puede, dicho por lo más concreto que se entendió.
    if (inner?.verb && inner.verb !== 'fighting') return inner;
    if (plain.verb) return plain;
    // Lo último: los verbos de idea 137 («intento convencer», «me escondo»), como tirada.
    const skill = intentSkills(whole)[0];
    return skill && !context.fighting ? { do: 'check', skill, what: '' } : { do: 'unknown' };
}

/**
 * Lo escrito, sin tildes pero en el orden de siempre, devuelto con sus tildes: `rest` es el
 * final de `text` (ya plegado), y lo que se quiere es ese mismo final en lo que se escribió.
 *
 * @param {string} rest
 * @param {string} said
 * @returns {string}
 */
function asWritten(rest, said) {
    const written = clean(said);
    const folded = written.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (folded.length !== written.length || !folded.endsWith(rest)) return rest;
    return written.slice(written.length - rest.length);
}

/**
 * @param {string} text Ya plegado.
 * @param {string} said Lo escrito, para devolver lo intentado con sus tildes.
 * @param {BoxContext} context
 * @returns {BoxIntent}
 */
function readPlain(text, said, context) {
    const fighting = Boolean(context.fighting);
    /** @type {RegExpExecArray|null} */
    let m = null;

    if (/^(?:ayuda|que (?:hago|puedo hacer|hacemos|podemos hacer|se puede hacer)|opciones|que hay que hacer)\b/.test(text)) return { do: 'help' };
    if (/^(?:(?:abro|abrir|miro|mirar|leo|leer|consulto) )?(?:el |mi )?diario$/.test(text)) return { do: 'journal' };

    // --- En combate, lo de la barra -------------------------------------------------------
    if (/^(?:paso(?: (?:mi|el))? turno|termino(?: mi)? turno|fin de(?:l)? turno|acabo(?: mi)? turno|paso)$/.test(text)) {
        return fighting ? { do: 'end-turn' } : { do: 'unknown', verb: 'end-turn' };
    }
    m = /^(?:me (?:muevo|desplazo|acerco|pongo)|nos (?:movemos|desplazamos)|muevo|avanzo|voy|camino)(?: (?:a|hasta|hacia|en))?(?: la)?(?: casilla)? (\d+)\s*(?:,|\s|y)\s*(\d+)$/.exec(text);
    if (m) return fighting ? { do: 'move', x: Number(m[1]), y: Number(m[2]) } : { do: 'unknown', verb: 'move' };
    m = /^(?:le |les )?(?:ataco|atacamos|atacar|ataca|atacad|golpeo|golpeamos|golpear|pego|disparo|disparamos|disparar|cargo|cargamos|embisto|apunalo|mato|matar|lucho|luchamos|luchar|peleo|peleamos|pelear)(?: (?:a|al|contra|con))?(?: (.+))?$/.exec(text);
    if (m) {
        const target = m[1] ? pickName(m[1], context.foes ?? []) : (context.foes ?? [])[0] ?? '';
        if (fighting && target) return { do: 'attack', name: target };
        return { do: 'unknown', verb: 'attack', target: m[1] ? asWritten(m[1], said) : '' };
    }
    if (fighting) return { do: 'unknown', verb: 'fighting' };

    // --- Moverse ----------------------------------------------------------------------------
    if (/^(?:salgo|salimos|salir|me voy|nos vamos|abandono|abandonamos|abandonar)(?: (?:del|de la|de) (?:tablero|mazmorra|sitio|lugar|aqui|combate))?$/.test(text)) {
        return context.onBoard ? { do: 'leave' } : { do: 'unknown', verb: 'leave' };
    }
    m = /^(?:me |nos )?(?:voy|vamos|vais|ir|ve|id|vete|idos|irse|irnos|viajo|viajamos|viajar|camino|caminamos|caminar|vuelvo|volvemos|volver|regreso|regresamos|regresar|marcho|marchamos|marchar|parto|partimos|partir|dirijo|dirigimos|dirigirse|dirigirnos|pongo rumbo|ponemos rumbo|llego|llegamos|llegar)(?: (?:a|al|hacia|hasta|para|rumbo a|en direccion a))? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, GO_ORDER);
        if (found) return intentFor(found);
        return { do: 'unknown', verb: 'go', target: asWritten(m[1], said), ...(missingService(m[1], context)) };
    }
    m = /^(?:entro|entramos|entrar|entra|entrad|me meto|nos metemos|meterse|pasamos|paso)(?: (?:en|a|al|dentro de|por))? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, GO_ORDER);
        if (found) return intentFor(found);
        return { do: 'unknown', verb: 'enter', target: asWritten(m[1], said), ...(missingService(m[1], context)) };
    }

    // --- Hablar -----------------------------------------------------------------------------
    if (/^(?:(?:escucho|escuchamos|escuchar|oigo|oimos|oir|pregunto|preguntamos|preguntar) (?:por )?)?(?:los |las )?(?:rumores|noticias|chismes|cotilleos|lo que se cuenta|que se cuenta|lo que se dice|que se dice)\b/.test(text)) {
        return { do: 'rumor' };
    }
    m = /^(?:le |les )?(?:pregunto|preguntamos|preguntar|pregunta|preguntad)(?: a| al)? (.+?)(?: (?:por|sobre|acerca de) (.+))?$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person', 'companion']);
        if (found) return { do: 'talk', name: found.name, ...(m[2] ? { topic: topicOf(m[2]) } : {}) };
        return { do: 'unknown', verb: 'talk', target: asWritten(m[1], said) };
    }
    m = /^(?:le |les )?(?:hablo|hablamos|hablar|habla|hablad|charlo|charlamos|charlar|converso|conversamos|conversar|saludo|saludamos|saludar|me acerco|nos acercamos|acercarme|acercarnos|busco a|buscamos a|llamo a|llamamos a)(?: (?:con|a|al|hacia))? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person', 'companion']);
        if (found) return { do: 'talk', name: found.name };
        return { do: 'unknown', verb: 'talk', target: asWritten(m[1], said) };
    }
    m = /^(?:le |les )?(?:convenzo|convencemos|convencer|persuado|persuadimos|persuadir|negocio con|negociamos con|negociar con)(?: a| al)? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person']);
        return found ? { do: 'duel', name: found.name } : { do: 'check', skill: 'persuasion', what: `convencer ${asWritten(m[1], said)}` };
    }
    m = /^(?:le |les )?(?:sonsaco|sonsacamos|sonsacar|tanteo|tanteamos|tantear|le tiro de la lengua a|tiro de la lengua a)(?: a| al)? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person']);
        return found ? { do: 'pry', name: found.name } : { do: 'unknown', verb: 'talk', target: asWritten(m[1], said) };
    }
    m = /^(?:le |les )?(?:amenazo|amenazamos|amenazar|intimido|intimidamos|intimidar|asusto|asustamos|asustar)(?: a| al)? (.+)$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person']);
        return found ? { do: 'threaten', name: found.name } : { do: 'check', skill: 'intimidation', what: `intimidar ${asWritten(m[1], said)}` };
    }
    m = /^(?:le |les )?(?:invito|invitamos|invitar)(?: a| al)? (.+?)(?: a (?:una|un|otra|otro) (?:ronda|trago|copa|cerveza|vino|jarra))?$/.exec(text);
    if (m) {
        const found = resolve(m[1], context, ['person', 'companion']);
        if (found) return { do: 'round', name: found.name, ...(found.kind === 'companion' ? { companion: true } : {}) };
        return { do: 'unknown', verb: 'talk', target: asWritten(m[1], said) };
    }

    // --- Comprar y vender -------------------------------------------------------------------
    m = /^(?:compro|compramos|comprar|compra|pido|pedimos)(?: (.+))?$/.exec(text);
    if (m) {
        if (!(context.services ?? []).includes('tienda')) return { do: 'unknown', verb: 'buy' };
        const item = m[1] ? pickName(m[1], context.wares ?? []) : '';
        return { do: 'buy', ...(item ? { name: item } : {}) };
    }
    m = /^(?:vendo|vendemos|vender|vende|colocamos|coloco)(?: (.+))?$/.exec(text);
    if (m) {
        if (!(context.services ?? []).includes('tienda')) return { do: 'unknown', verb: 'sell' };
        if (m[1] && /\b(chatarra|trastos|lo que no sirve|lo que sobra|todo)\b/.test(m[1])) return { do: 'sell', name: '*' };
        const item = m[1] ? pickName(m[1], context.goods ?? []) : '';
        return { do: 'sell', ...(item ? { name: item } : {}) };
    }

    // --- Descansar, esperar, el campo -------------------------------------------------------
    if (/^(?:acampo|acampamos|acampar|montamos el campamento|monto el campamento|montar el campamento|hacemos un fuego|hago un fuego|encendemos un fuego|enciendo un fuego)\b/.test(text)) return { do: 'camp' };
    m = /^(?:descanso|descansamos|descansar|descansad|reposo|reposamos|reposar|me echo|nos echamos|duermo|dormimos|dormir|echo una siesta|echamos una siesta|paso la noche|pasamos la noche|hago noche|hacemos noche|me tumbo|nos tumbamos|recupero fuerzas|recuperamos fuerzas)\b(.*)$/.exec(text);
    if (m) return { do: 'rest', long: /\b(noche|duermo|dormimos|dormir|largo|hasta (?:manana|el amanecer)|toda la)\b/.test(text) && !/\b(corto|un rato|siesta)\b/.test(text) };
    m = /^(?:espero|esperamos|esperar|aguardo|aguardamos|aguardar|dejo pasar el tiempo|dejamos pasar el tiempo|hago tiempo|hacemos tiempo|matamos el tiempo|mato el tiempo)\b(.*)$/.exec(text);
    if (m) {
        const until = /\bnoche|anochec/.test(m[1]) ? 'night' : /\btarde\b/.test(m[1]) ? 'afternoon' : /\b(manana|amanecer|alba|dia siguiente)\b/.test(m[1]) ? 'morning' : '';
        return { do: 'wait', ...(until ? { until } : {}) };
    }
    if (/^(?:exploro|exploramos|explorar|explora|recorro|recorremos|recorrer|me doy una vuelta|damos una vuelta|doy una vuelta)\b/.test(text)) return { do: 'explore' };
    if (/^(?:cazo|cazamos|cazar|forrajeo|forrajeamos|forrajear|recolecto|recolectamos|recolectar|pesco|pescamos|pescar|(?:busco|buscamos|buscar) (?:comida|algo de comer|caza|hierbas|bayas|setas|agua|de comer))\b/.test(text)) return { do: 'forage' };

    // --- Robar en la tienda es robar en la tienda -------------------------------------------
    m = /^(?:robo|robamos|robar|birlo|birlamos|hurto|hurtamos)(?: (.+))?$/.exec(text);
    if (m && m[1] && (context.services ?? []).includes('tienda')) {
        const item = pickName(m[1], context.wares ?? []);
        if (item) return { do: 'steal', name: item };
    }

    // --- Intentar algo: una tirada ----------------------------------------------------------
    m = new RegExp(`^(?:le |me |nos )?(${LOOK.re})\\b(?: (.*))?$`).exec(text);
    if (m) {
        const base = LOOK.inf[m[1]];
        const rest = String(m[2] ?? '').trim();
        // «Busco a Giles» es ir a hablar con él; «observo a Torres», calarle.
        if (/^(?:a|al) /.test(rest)) {
            const found = resolve(rest, context, ['person', 'companion']);
            if (found && base === 'buscar') return { do: 'talk', name: found.name };
            if (found && found.kind === 'person') return { do: 'check', skill: 'insight', what: `${base} a ${found.name}`, name: found.name };
        }
        const skill = THING_SKILL.find(([, re]) => /** @type {RegExp} */ (re).test(rest))?.[0]
            ?? VERB_SKILL[/** @type {keyof typeof VERB_SKILL} */ (base)] ?? 'perception';
        const what = rest ? `${base} ${asWritten(rest, said)}` : base;
        return { do: 'check', skill: String(skill), what };
    }

    return { do: 'unknown' };
}

/**
 * @param {{kind: string, name: string}} found
 * @returns {BoxIntent}
 */
function intentFor(found) {
    if (found.kind === 'board') return { do: 'enter', name: found.name };
    if (found.kind === 'service') return { do: 'service', name: found.name };
    if (found.kind === 'place') return { do: 'go', name: found.name };
    return { do: 'talk', name: found.name };
}

/**
 * Si lo nombrado es un servicio que aquí no hay: «Aquí no hay posada».
 *
 * @param {string} said
 * @param {BoxContext} context
 * @returns {{name?: string}}
 */
function missingService(said, context) {
    const service = pickService(said, context.services ?? []);
    return service.startsWith('!') ? { name: service } : {};
}

/**
 * De qué se pregunta: «por lo que sabe», «por rumores», «por el caso».
 *
 * @param {string} about
 * @returns {string}
 */
export function topicOf(about) {
    const text = fold(about);
    if (/\b(rumor|rumores|noticias|se cuenta|se dice|chismes|cotilleos)\b/.test(text)) return 'rumor';
    if (/\b(caso|muerto|muerte|asesin|robo|crimen|culpable|victima)/.test(text)) return 'caso';
    if (/\b(quiere|busca|necesita|favor|trabajo|encargo|ayuda)\b/.test(text)) return 'quiere';
    if (/\b(nosotros|opina|piensa|parecemos|nos ve)\b/.test(text)) return 'vosotros';
    if (/\b(sabe|secreto|visto|oido|noche|quien)\b/.test(text)) return 'sabe';
    return 'hilo';
}

/**
 * Lo que se le enseña a quien escribe algo que la caja no entiende: frases que sí,
 * con los nombres de aquí. Cinco como mucho.
 *
 * @param {BoxContext} context
 * @returns {string[]}
 */
export function boxExamples(context = {}) {
    if (context.fighting) {
        const foe = (context.foes ?? [])[0];
        return [foe ? `ataco a ${foe}` : 'ataco', 'me muevo a 5 4', 'paso turno'];
    }
    /** @type {string[]} */
    const out = [];
    const person = (context.people ?? [])[0];
    if (person) out.push(`hablo con ${person}`);
    if (context.onBoard) out.push('salgo del tablero');
    const board = (context.boards ?? [])[0];
    if (board && !context.onBoard) out.push(`entro en ${board}`);
    const place = (context.places ?? [])[0];
    if (place && !context.onBoard) out.push(`voy a ${place}`);
    const service = (context.services ?? []).find(s => s !== 'tablon');
    if (service && !context.onBoard) out.push(`voy a la ${SERVICE_WORDS[/** @type {keyof typeof SERVICE_WORDS} */ (service)][0]}`);
    out.push('busco huellas', 'descanso', 'espero a la noche');
    return out.slice(0, 5);
}

/**
 * Qué decir cuando la caja no entiende, o entiende algo que aquí no se puede hacer.
 *
 * @param {BoxIntent} intent
 * @param {BoxContext} [context]
 * @returns {string}
 */
export function explainMiss(intent, context = {}) {
    const list = (/** @type {string[]|undefined} */ names) => (names ?? []).slice(0, 4).join(', ');
    const service = String(intent.name ?? '').replace(/^!/, '');
    const serviceWord = SERVICE_WORDS[/** @type {keyof typeof SERVICE_WORDS} */ (service)]?.[0] ?? '';
    switch (intent.verb) {
        case 'go':
        case 'enter':
            if (serviceWord) return `Aquí no hay ${serviceWord}.`;
            if (context.onBoard) return 'Primero hay que salir del tablero.';
            return (context.places ?? []).length > 0
                ? `No conozco ningún sitio que se llame «${intent.target}». Se puede ir a: ${list(context.places)}.`
                : `No conozco ningún sitio que se llame «${intent.target}».`;
        case 'talk':
            return (context.people ?? []).length > 0
                ? `Aquí no hay nadie que se llame «${intent.target}». Aquí están: ${list(context.people)}.`
                : `Aquí no hay nadie que se llame «${intent.target}».`;
        case 'attack':
            if (context.fighting) return `No veo a «${intent.target}» en el tablero. Enemigos: ${list(context.foes)}.`;
            return (context.boards ?? []).length > 0
                ? `Aquí no hay pelea. Para pelear, entra en un tablero: ${list(context.boards)}.`
                : 'Aquí no hay con quién pelear.';
        case 'fighting':
            return 'En combate, la caja entiende «ataco a…», «me muevo a X Y» y «paso turno». Lo demás, en la barra de abajo.';
        case 'end-turn':
        case 'move':
            return 'Eso es para el combate, y ahora no hay ninguno.';
        case 'leave':
            return 'No estáis en ningún tablero.';
        case 'buy':
        case 'sell':
            return 'Aquí no hay tienda.';
        default:
            return '';
    }
}
