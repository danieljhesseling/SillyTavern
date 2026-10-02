/**
 * Toda pelea escrita tiene otra salida (J12.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Un tablero con enemigos esperando solo se resolvía de una forma: «Iniciar combate». Pero en
 * una mesa de D&D casi nunca es así: se habla con el alguacil, se le paga al ratero, se da
 * media vuelta o se pasa agachado entre los árboles. Aquí está eso, antes de que empiece la
 * pelea, y cada salida con **una tirada** y lo que pasa si sale bien, a medias o mal:
 *
 * - **Hablar**: convencerlos, engañarlos o espantarlos (a las bestias, con fuego y ruido).
 *   Tira quien mejor lo hace. Si sale, la pelea no se juega.
 * - **Pagar**: lo que cuesta, en oro. Con tirada, se regatea; sin ella, se paga y ya.
 * - **Huir**: se da media vuelta. Tira el más lento del grupo, porque se corre a su paso. Si
 *   sale, os vais y el tablero sigue ahí; si sale mal, os cierran el paso y ellos empiezan.
 * - **Esconderse**: pasar sin que os vean. Tira todo el grupo y basta con que salga a la
 *   mitad, como en las pruebas de grupo de D&D. Si sale mal, os ven en mal momento.
 *
 * Lo que se escribe en el paquete, en cada tablero (`avoid`):
 *
 *     "avoid": [
 *       { "kind": "hablar", "text": "Decirle a Torres que el cáliz te lo han metido",
 *         "skill": "persuasion", "dc": 15,
 *         "success": { "text": "Los guardias se miran…", "effects": [{ "rumor": "r-traicion" }] },
 *         "failure": "Torres escupe: «¡Mentiroso!»" },
 *       { "kind": "pagar", "text": "Darle unas monedas al guardia joven", "gold": 5 } ]
 *
 * Sin nada escrito (un tablero generado, un paquete de antes), salen las de siempre según
 * quién espera: a la gente se le habla y se le paga; a las bestias se las espanta; de los
 * muertos solo se huye o se esconde uno.
 *
 * Los efectos son los de las charlas (`campaign/dialogues.js`: `gold`, `attitude`, `rumor`,
 * `clue`, `give`, `take`, `time`, `milestone`) y unos pocos más de pelea: `standing` (cómo os
 * mira una facción), `fame`, `hurt` (una herida a quien lo intentó), `days` y `grudge` (alguien
 * que os la guarda). No se aplican aquí: se devuelven, y los aplica quien llama.
 *
 * Puro, con el dado inyectado: lee, dice qué se ve y resuelve.
 */

import { rollCheck, skillModifier, SKILLS } from '../rules/checks.js';
import { outcomeOf } from '../campaign/consequences.js';
import { resolveGender } from '../campaign/grammar.js';

/**
 * Las cuatro salidas, con su habilidad de siempre, si cuentan como pasar el tablero y lo que
 * le parece al grupo (`campaign/approval.js`).
 */
export const AVOID_KINDS = {
    hablar: { label: 'Hablar', icon: 'fa-comments', skill: 'persuasion', resolves: true, judge: 'hito-hablando' },
    pagar: { label: 'Pagar', icon: 'fa-coins', skill: '', resolves: true, judge: 'pagar' },
    huir: { label: 'Huir', icon: 'fa-person-running', skill: 'athletics', resolves: false, judge: 'retirada' },
    esconderse: { label: 'Esconderse', icon: 'fa-user-ninja', skill: 'stealth', resolves: true, judge: 'hito-maña' },
};

/** Otras formas de escribirlas, como las escribiría un Gem o alguien con prisa. */
const KIND_ALIASES = {
    talk: 'hablar', convencer: 'hablar', persuadir: 'hablar', enganar: 'hablar',
    espantar: 'hablar', asustar: 'hablar', intimidar: 'hablar',
    pay: 'pagar', sobornar: 'pagar', bribe: 'pagar',
    flee: 'huir', run: 'huir', retirarse: 'huir',
    hide: 'esconderse', sneak: 'esconderse', esconder: 'esconderse', escabullirse: 'esconderse', rodear: 'esconderse',
};

/** Lo más fácil y lo más difícil que puede ser una tirada escrita, como en las charlas. */
export const AVOID_DC_LIMITS = { min: 5, max: 30 };

/** Los efectos que se entienden, con la clave con que se escriben. */
export const EXIT_EFFECT_KINDS = ['gold', 'attitude', 'rumor', 'clue', 'give', 'take', 'time', 'milestone', 'standing', 'fame', 'hurt', 'days', 'grudge'];

/** De qué está hecho quien espera: decide si se le puede hablar, pagar o espantar. */
export const MINDS = ['gente', 'bestia', 'muerto', 'cosa'];

/** Las primeras palabras que hacen bestia a alguien: «Lobo gris», «Rata de bodega». */
const BEAST_WORDS = ['lobo', 'loba', 'rata', 'oso', 'osa', 'jabali', 'arana', 'murcielago', 'cuervo', 'serpiente', 'perro', 'gato',
    'zorro', 'halcon', 'lagarto', 'cocodrilo', 'tiburon', 'caballo', 'jauria', 'huargo', 'sabueso', 'buitre', 'escorpion', 'sapo'];

/** Lo que no piensa ni tiene miedo: se le esquiva o se le deja atrás. */
const DEAD_WORDS = ['zombi', 'esqueleto', 'ghoul', 'necrofago', 'momia', 'cadaver', 'engendro hambriento'];
const THING_WORDS = ['gargola', 'golem', 'espantapajaros', 'enjambre', 'plaga', 'cieno', 'limo', 'estatua', 'armadura animada'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** El nombre sin el número que le pone el combate: «Lobo gris 2» → «Lobo gris». */
const bareName = (/** @type {any} */ name) => text(name).replace(/\s+\d+$/, '');

/**
 * @typedef {Object} ExitEffect
 * @property {string} kind Uno de `EXIT_EFFECT_KINDS`, o `unknown`.
 * @property {number} [amount] `gold`, `attitude`, `standing`, `fame`, `days` y `hurt` ya tirado.
 * @property {string} [who] `attitude` y `grudge`: quién; `hurt`: `todos` o vacío (quien lo intentó).
 * @property {string} [id] `rumor` y `milestone`.
 * @property {string} [text] `clue`.
 * @property {string} [item] `give` y `take`.
 * @property {string} [faction] `standing`.
 * @property {string} [dice] `hurt`: los dados («1d4»).
 * @property {any} [raw] `unknown`: lo que venía.
 */

/**
 * @typedef {Object} ExitBranch
 * @property {string} text Lo que pasa, en llano.
 * @property {ExitEffect[]} effects
 */

/**
 * @typedef {Object} AvoidOption
 * @property {string} id
 * @property {'hablar'|'pagar'|'huir'|'esconderse'} kind
 * @property {string} text Lo que se hace, visto desde quien juega.
 * @property {string} skill Con qué se tira; vacío, sin tirada (pagar y ya).
 * @property {number} dc
 * @property {number} gold Lo que cuesta pagar (solo `pagar`).
 * @property {boolean} group Si tira todo el grupo (esconderse).
 * @property {boolean} resolves Si, al salir bien, el tablero cuenta como pasado para la historia.
 * @property {ExitBranch} success
 * @property {ExitBranch|null} partial Sin escribir, a medias sale como bien pagando lo de siempre.
 * @property {ExitBranch} failure
 * @property {boolean} written Si viene del paquete (o es de las de siempre).
 */

/**
 * @typedef {Object} FoeInfo Quien espera en el tablero, como se sabe antes de pelear.
 * @property {string} name
 * @property {number} [cr]
 * @property {boolean} [boss]
 * @property {string} [profile]
 * @property {string} [description]
 * @property {string} [mind] Si se sabe: `gente`, `bestia`, `muerto` o `cosa`.
 */

/**
 * De qué está hecho alguien, por su nombre (y lo que se diga de él).
 *
 * «Perro del Cuervo» es gente (una compañía, por la mayúscula de detrás), y «Lobo gris»,
 * bestia. «Hombre lobo» es gente: habla, aunque muerda.
 *
 * @param {FoeInfo|string} foe
 * @returns {'gente'|'bestia'|'muerto'|'cosa'}
 */
export function mindOf(foe) {
    const info = typeof foe === 'string' ? { name: foe } : (foe ?? { name: '' });
    const said = fold(info.mind);
    if (MINDS.includes(said)) return /** @type {any} */ (said);
    const name = bareName(info.name);
    const folded = fold(name);
    if (DEAD_WORDS.some(word => folded === word || folded.startsWith(`${word} `) || folded.includes(` ${word}`))) return 'muerto';
    if (THING_WORDS.some(word => folded === word || folded.startsWith(`${word} `))) return 'cosa';
    const first = folded.split(/\s+/)[0] ?? '';
    // «Perro del Cuervo», «Lobos de la Madre Noche»: detrás va una compañía con su nombre propio.
    const company = /\s(del?|de los|de las|de la)\s+\p{Lu}/u.test(name);
    if (BEAST_WORDS.includes(first.replace(/s$/, '')) && !company) return 'bestia';
    return 'gente';
}

/**
 * Quien manda de los que esperan: el jefe, o el de más desafío. Para decir «Torres baja el arma».
 *
 * @param {FoeInfo[]} foes
 * @returns {string}
 */
export function leaderOf(foes) {
    const list = Array.isArray(foes) ? foes.filter(f => text(f?.name)) : [];
    if (list.length === 0) return '';
    const boss = list.find(f => f.boss);
    const top = boss ?? [...list].sort((a, b) => (Number(b.cr) || 0) - (Number(a.cr) || 0))[0];
    return bareName(top.name);
}

/**
 * Lo que se dice de un grupo: «Alguacil Torres y dos más», «tres lobos famélicos».
 *
 * @param {FoeInfo[]} foes
 * @returns {string}
 */
export function foesLine(foes) {
    const list = Array.isArray(foes) ? foes : [];
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const foe of list) {
        const name = bareName(foe?.name);
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ');
}

/**
 * Lo difícil que es convencer a quien espera, sin nada escrito: más si son muchos o si entre
 * ellos hay alguien de cuidado.
 *
 * @param {FoeInfo[]} foes
 * @returns {number}
 */
export function defaultDc(foes) {
    const list = Array.isArray(foes) ? foes : [];
    const top = Math.max(0, ...list.map(f => Number(f?.cr) || 0));
    const many = Math.min(3, Math.max(0, list.length - 2));
    const tough = (list.some(f => f?.boss) || top >= 3 ? 2 : 0) + (top >= 5 ? 2 : 0);
    return Math.max(10, Math.min(20, 12 + many + tough));
}

/**
 * Lo que piden por dejaros pasar, sin nada escrito: unas monedas por cabeza, más por quien
 * vale más, y el doble si hay un jefe.
 *
 * @param {FoeInfo[]} foes
 * @returns {number}
 */
export function defaultPrice(foes) {
    const list = Array.isArray(foes) ? foes : [];
    const base = list.reduce((sum, f) => sum + Math.max(2, Math.round((Number(f?.cr) || 0) * 10)), 0);
    return Math.max(2, list.some(f => f?.boss) ? base * 2 : base);
}

/**
 * Un efecto, venga como venga escrito. Las mismas claves que las charlas, y las de pelea.
 *
 * @param {any} raw
 * @returns {ExitEffect}
 */
export function readExitEffect(raw) {
    if (typeof raw === 'string') {
        const said = fold(raw);
        if (said === 'time' || said === 'tiempo') return { kind: 'time' };
        return { kind: 'unknown', raw };
    }
    if (!isObject(raw)) return { kind: 'unknown', raw };
    const who = text(raw.who);
    const amount = (/** @type {any} */ value) => Math.round(Number(value) || 0);
    if ('gold' in raw) return { kind: 'gold', amount: amount(raw.gold) };
    if ('attitude' in raw) return { kind: 'attitude', amount: Math.sign(amount(raw.attitude)), ...(who ? { who } : {}) };
    if ('rumor' in raw) return { kind: 'rumor', id: text(raw.rumor) };
    if ('clue' in raw) return { kind: 'clue', text: text(raw.clue) };
    if ('give' in raw) return { kind: 'give', item: text(raw.give) };
    if ('take' in raw) return { kind: 'take', item: text(raw.take) };
    if ('time' in raw) return { kind: 'time' };
    if ('milestone' in raw) return { kind: 'milestone', id: text(raw.milestone) };
    if ('standing' in raw) return { kind: 'standing', faction: text(raw.standing), amount: amount(raw.amount ?? -1) || -1 };
    if ('fame' in raw) return { kind: 'fame', amount: amount(raw.fame) };
    if ('hurt' in raw) return { kind: 'hurt', dice: text(raw.hurt) || '1d4', ...(who ? { who } : {}) };
    if ('days' in raw) return { kind: 'days', amount: Math.max(1, amount(raw.days)) };
    if ('grudge' in raw) return { kind: 'grudge', who: text(raw.grudge) };
    return { kind: 'unknown', raw };
}

/**
 * @param {any} raw
 * @returns {ExitEffect[]}
 */
export function readExitEffects(raw) {
    return (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map(readExitEffect);
}

/**
 * Una rama: un texto suelto, o `{text, effects}`.
 *
 * @param {any} raw
 * @param {string} fallback
 * @returns {ExitBranch}
 */
export function readBranch(raw, fallback = '') {
    if (typeof raw === 'string') return { text: text(raw) || fallback, effects: [] };
    const source = isObject(raw) ? raw : {};
    return { text: text(source.text) || fallback, effects: readExitEffects(source.effects) };
}

/**
 * La clase de salida, venga como venga escrita.
 *
 * @param {any} raw
 * @returns {'hablar'|'pagar'|'huir'|'esconderse'|''}
 */
export function kindOf(raw) {
    const said = fold(raw);
    if (said in AVOID_KINDS) return /** @type {any} */ (said);
    // Sin tildes: «engañar» llega como «enganar».
    const alias = /** @type {Record<string, string>} */ (KIND_ALIASES)[said];
    return /** @type {any} */ (alias ?? '');
}

/**
 * La habilidad, por su id (`persuasion`) o por su nombre («Persuasión»).
 *
 * @param {any} raw
 * @returns {string} El id, o vacío si no es ninguna.
 */
export function skillOf(raw) {
    const said = fold(raw);
    if (!said) return '';
    if (said in SKILLS) return said;
    const found = Object.entries(SKILLS).find(([, def]) => fold(def.label) === said);
    return found ? found[0] : '';
}

/** Lo que pasa, sin escribir, con cada salida. */
const DEFAULT_LINES = {
    hablar: {
        success: '{leader} baja el arma. Os dejan pasar sin una gota de sangre.',
        partial: 'Os dejan pasar, pero cuesta un buen rato convencerlos.',
        failure: 'No quieren escuchar. ¡A las armas!',
    },
    pagar: {
        success: 'Cogen el oro, lo cuentan y se apartan del camino.',
        partial: 'Regatean hasta sacaros más de lo que ofrecíais, pero se apartan.',
        failure: 'Se ríen del oro: quieren sangre. ¡A las armas!',
    },
    huir: {
        success: 'Dais media vuelta a tiempo. La pelea se queda aquí, esperando.',
        partial: 'Salís, pero a {who} le alcanza un golpe antes de doblar la esquina.',
        failure: 'No os da tiempo: os cierran el paso, y ellos atacan primero.',
    },
    esconderse: {
        success: 'Pasáis sin que nadie levante la cabeza.',
        partial: 'Pasáis, pero dando un rodeo muy largo: se va un buen rato del día.',
        failure: 'Alguien pisa donde no debe. ¡Os han visto, y atacan primero!',
    },
};

/**
 * Las salidas de un tablero, venga como venga escrito `avoid`. Lo que no se entiende, fuera
 * (`checkAvoid` dice por qué).
 *
 * @param {any} raw
 * @param {FoeInfo[]} [foes] Quien espera, para la CD y el precio de lo que no los trae.
 * @returns {AvoidOption[]}
 */
export function readAvoid(raw, foes = []) {
    const list = Array.isArray(raw) ? raw : [];
    /** @type {AvoidOption[]} */
    const out = [];
    const ids = new Set();
    list.forEach((entry, index) => {
        if (!isObject(entry)) return;
        const kind = kindOf(entry.kind);
        if (!kind) return;
        const spec = AVOID_KINDS[kind];
        const said = text(entry.text);
        if (!said) return;
        const check = isObject(entry.check) ? entry.check : {};
        const skill = kind === 'pagar'
            ? skillOf(entry.skill ?? check.skill)
            : skillOf(entry.skill ?? check.skill) || spec.skill;
        const dcRaw = Number(entry.dc ?? check.dc);
        const dc = Number.isFinite(dcRaw) && dcRaw > 0
            ? Math.max(AVOID_DC_LIMITS.min, Math.min(AVOID_DC_LIMITS.max, Math.round(dcRaw)))
            : defaultDc(foes);
        let id = text(entry.id) || `${kind}-${index + 1}`;
        while (ids.has(id)) id = `${id}-b`;
        ids.add(id);
        const lines = DEFAULT_LINES[kind];
        out.push({
            id,
            kind,
            text: said,
            skill,
            dc,
            gold: kind === 'pagar' ? Math.max(0, Math.round(Number(entry.gold) || 0)) || defaultPrice(foes) : 0,
            group: kind === 'esconderse' ? entry.group !== false : entry.group === true,
            resolves: typeof entry.resolves === 'boolean' ? entry.resolves : spec.resolves,
            success: readBranch(entry.success ?? check.success, lines.success),
            partial: entry.partial == null && check.partial == null ? null : readBranch(entry.partial ?? check.partial, lines.partial),
            failure: readBranch(entry.failure ?? check.failure, lines.failure),
            written: true,
        });
    });
    return out;
}

/**
 * Las salidas de siempre, para un tablero que no trae las suyas.
 *
 * @param {FoeInfo[]} foes
 * @returns {AvoidOption[]}
 */
export function defaultAvoid(foes) {
    const list = Array.isArray(foes) ? foes : [];
    if (list.length === 0) return [];
    const minds = new Set(list.map(mindOf));
    const dc = defaultDc(list);
    const bossy = list.some(f => f?.boss);
    /** @type {AvoidOption[]} */
    const out = [];
    const make = (/** @type {'hablar'|'pagar'|'huir'|'esconderse'} */ kind, /** @type {Partial<AvoidOption>} */ extra) => {
        const lines = DEFAULT_LINES[kind];
        out.push({
            id: `${kind}-siempre`,
            kind,
            text: '',
            skill: AVOID_KINDS[kind].skill,
            dc,
            gold: 0,
            group: kind === 'esconderse',
            resolves: AVOID_KINDS[kind].resolves,
            success: { text: lines.success, effects: [] },
            partial: null,
            failure: { text: lines.failure, effects: [] },
            written: false,
            ...extra,
        });
    };
    if (minds.has('gente')) {
        make('hablar', { text: 'Bajar el arma y hablar antes de que corra la sangre', dc: bossy ? dc + 3 : dc });
        if (!bossy) make('pagar', { text: 'Ofrecerles oro para que os dejen en paz', skill: '', gold: defaultPrice(list) });
    } else if (minds.has('bestia')) {
        make('hablar', {
            id: 'espantar-siempre',
            text: 'Espantarlos con ruido y con fuego',
            skill: 'intimidation',
            dc: dc + 1,
            success: { text: 'Retroceden gruñendo y se pierden entre las sombras.', effects: [] },
            failure: { text: 'El fuego no los asusta: tienen demasiada hambre. ¡Atacan!', effects: [] },
        });
    }
    make('esconderse', { text: 'Pasar sin que os vean', dc: Math.max(10, dc - 1) });
    make('huir', { text: 'Dar media vuelta antes de que os vean', dc: 10 + (list.some(f => fold(f?.profile) === 'skirmisher') ? 2 : 0) });
    return out;
}

/**
 * Las salidas de un tablero: las escritas, o las de siempre.
 *
 * @param {any} board Con `avoid`, si lo trae.
 * @param {FoeInfo[]} foes
 * @returns {AvoidOption[]}
 */
export function avoidFor(board, foes) {
    const written = readAvoid(board?.avoid, foes);
    return written.length > 0 ? written : defaultAvoid(foes);
}

/**
 * @typedef {Object} PartyMember
 * @property {any} id
 * @property {string} name
 * @property {number} [hp]
 * @property {boolean} [dead]
 */

/** @param {any[]} party @returns {any[]} */
const ableOf = (party) => (Array.isArray(party) ? party : []).filter(m => m && !m.dead && (Number(m.hp ?? 1) || 0) > 0);

/**
 * Quien tira por el grupo: el que mejor lo hace, o quien habla por todos (J7.4) si sabe.
 *
 * @param {any[]} party
 * @param {string} skill
 * @param {{speakerId?: any, lowest?: boolean}} [options] `lowest`: el que peor lo hace (huir va
 *   al paso del más lento).
 * @returns {{member: any, modifier: number}|null}
 */
export function rollerFor(party, skill, { speakerId = null, lowest = false } = {}) {
    const able = ableOf(party);
    if (able.length === 0 || !skill) return null;
    if (speakerId != null && !lowest) {
        const chosen = able.find(m => String(m.id) === String(speakerId));
        if (chosen) return { member: chosen, modifier: skillModifier(chosen, skill).modifier };
    }
    const rated = able.map(member => ({ member, modifier: skillModifier(member, skill).modifier }))
        .sort((a, b) => (lowest ? a.modifier - b.modifier : b.modifier - a.modifier) || text(a.member.name).localeCompare(text(b.member.name)));
    return rated[0];
}

/**
 * @typedef {Object} AvoidChip Una salida, como se ve en el panel.
 * @property {string} id
 * @property {string} kind
 * @property {string} label «Hablar».
 * @property {string} icon
 * @property {string} text Lo que se hace.
 * @property {string} check «Persuasión · CD 13», o vacío.
 * @property {string} who «Tira Bran (+5)», «Tira todo el grupo».
 * @property {string} cost «Cuesta 20 de oro», o vacío.
 * @property {string} win Lo que se gana si sale: «Si sale, no hay pelea».
 * @property {string} locked Por qué no se puede, o vacío.
 */

/**
 * Las salidas como se ven: qué se hace, quién tira, contra cuánto, lo que cuesta y, si no se
 * puede, por qué.
 *
 * @param {Object} input
 * @param {AvoidOption[]} input.options
 * @param {any[]} input.party
 * @param {number} [input.gold] El oro del grupo.
 * @param {string[]} [input.tried] Las ya intentadas en este tablero.
 * @param {any} [input.speakerId] Quien habla por el grupo (J7.4).
 * @param {any} [input.hero] Para el género de lo escrito.
 * @returns {AvoidChip[]}
 */
export function avoidChips({ options, party, gold = 0, tried = [], speakerId = null, hero = null }) {
    const done = new Set((tried ?? []).map(String));
    const able = ableOf(party);
    // Para el género del texto: el héroe y el grupo. No se llama `who`: ese nombre es el de
    // «Tira Bran (+5)» de cada opción, y lo tapaba.
    const people = { heroe: hero ?? able[0] ?? null, grupo: able };
    return (options ?? []).map(option => {
        const spec = AVOID_KINDS[option.kind];
        const skillLabel = option.skill ? SKILLS[/** @type {keyof typeof SKILLS} */ (option.skill)]?.label ?? option.skill : '';
        let who = '';
        if (option.skill && option.group) who = 'Tira todo el grupo: basta con que salga a la mitad';
        else if (option.skill) {
            const roller = rollerFor(party, option.skill, { speakerId, lowest: option.kind === 'huir' });
            if (roller) {
                const sign = roller.modifier >= 0 ? '+' : '';
                who = option.kind === 'huir'
                    ? `Tira ${roller.member.name}, el más lento (${sign}${roller.modifier})`
                    : `Tira ${roller.member.name} (${sign}${roller.modifier})`;
            }
        }
        let locked = '';
        if (done.has(option.id)) locked = 'Ya lo habéis intentado.';
        else if (able.length === 0) locked = 'No queda nadie en pie para intentarlo.';
        else if (option.kind === 'pagar' && gold < option.gold) locked = `Os faltan ${option.gold - Math.max(0, gold)} de oro.`;
        const win = option.kind === 'huir' && !option.resolves
            ? 'Si sale, os vais sin pelear; el tablero se queda sin ganar'
            : 'Si sale, no hay pelea';
        return {
            id: option.id,
            kind: option.kind,
            label: spec.label,
            icon: spec.icon,
            text: resolveGender(option.text, people),
            check: skillLabel ? `${skillLabel} · CD ${option.dc}` : '',
            who,
            cost: option.kind === 'pagar' ? `Cuesta ${option.gold} de oro` : '',
            win,
            locked,
        };
    });
}

/**
 * Un dado de tantas caras con el azar de la partida, a partir del d20 inyectado si no hay otro.
 *
 * @param {string} formula «1d4», «2d6+1».
 * @param {(sides: number) => number} rollDie
 * @returns {number}
 */
export function rollFormula(formula, rollDie) {
    const match = /^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i.exec(text(formula).replace(/\s+/g, ''));
    if (!match) return Math.max(0, Math.round(Number(formula) || 0));
    const count = Math.max(1, Number(match[1]) || 1);
    const sides = Math.max(1, Number(match[2]) || 1);
    let total = Number(String(match[3] ?? '0').replace(/\s+/g, '')) || 0;
    for (let i = 0; i < count; i++) total += Math.max(1, Math.min(sides, Math.floor(Number(rollDie(sides)) || 1)));
    return Math.max(1, total);
}

/**
 * @typedef {Object} ExitRoll
 * @property {string} who
 * @property {string} said La línea de la tirada, como todas (`rollLine`).
 * @property {number} natural
 * @property {number} total
 * @property {number} dc
 * @property {boolean} success
 */

/**
 * @typedef {Object} AvoidResult
 * @property {string} id
 * @property {string} kind
 * @property {'bien'|'medias'|'mal'} outcome
 * @property {ExitRoll[]} rolls
 * @property {'avoided'|'fled'|'fight'} ends `avoided`: no hay pelea; `fled`: os vais; `fight`: empieza.
 * @property {boolean} resolves Si el tablero cuenta como pasado para la historia (sin botín).
 * @property {boolean} enemiesFirst Si la pelea empieza con ellos atacando primero.
 * @property {ExitEffect[]} effects Lo que pasa, para quien llama.
 * @property {string[]} lines Lo que se cuenta: la tirada y lo que pasa.
 * @property {string} judge La decisión, para lo que opina el grupo (`approval.js`).
 * @property {string} roller Quien tiró (o el primero del grupo).
 */

/**
 * Hacer una salida: tirar y decir lo que pasa.
 *
 * @param {Object} input
 * @param {AvoidOption} input.option
 * @param {any[]} input.party
 * @param {number} [input.gold]
 * @param {() => number} input.rollD20
 * @param {(sides: number) => number} [input.rollDie]
 * @param {any} [input.speakerId]
 * @param {string} [input.leader] Quien manda de los que esperan, para los textos.
 * @param {any} [input.hero] Para el género de lo escrito.
 * @returns {AvoidResult}
 */
export function resolveAvoid({ option, party, gold = 0, rollD20, rollDie, speakerId = null, leader = '', hero = null }) {
    const die = rollDie ?? ((/** @type {number} */ sides) => 1 + Math.floor(Math.random() * sides));
    const who = { heroe: hero ?? ableOf(party)[0] ?? null, grupo: ableOf(party) };
    const say = (/** @type {string} */ line, /** @type {string} */ person = '') => resolveGender(line, who)
        .replace(/\{leader\}/g, leader || 'Quien manda')
        .replace(/\{who\}/g, person || 'alguien');
    /** @type {ExitRoll[]} */
    const rolls = [];
    /** @type {'bien'|'medias'|'mal'} */
    let outcome = 'bien';
    let roller = '';

    if (option.skill && option.group) {
        const able = ableOf(party);
        for (const member of able) {
            const roll = rollCheck({ member, skill: option.skill, rollD20, dc: option.dc });
            if (roll) rolls.push({ who: text(member.name), said: roll.said, natural: roll.natural, total: roll.total, dc: roll.dc, success: roll.success });
        }
        roller = rolls[0]?.who ?? '';
        const need = Math.ceil(rolls.length / 2);
        const got = rolls.filter(r => r.success).length;
        outcome = rolls.length === 0 ? 'mal' : got >= need ? 'bien' : got === need - 1 ? 'medias' : 'mal';
    } else if (option.skill) {
        const picked = rollerFor(party, option.skill, { speakerId, lowest: option.kind === 'huir' });
        const roll = picked ? rollCheck({ member: picked.member, skill: option.skill, rollD20, dc: option.dc }) : null;
        if (roll && picked) {
            roller = text(picked.member.name);
            rolls.push({ who: roller, said: roll.said, natural: roll.natural, total: roll.total, dc: roll.dc, success: roll.success });
            outcome = outcomeOf(roll);
        } else {
            outcome = 'mal';
        }
    } else {
        // Pagar sin regatear: sale si hay con qué.
        outcome = gold >= option.gold ? 'bien' : 'mal';
        roller = text(ableOf(party)[0]?.name);
    }
    if (option.kind === 'pagar' && gold < option.gold) outcome = 'mal';

    /** @type {ExitEffect[]} */
    const effects = [];
    /** @type {string[]} */
    const lines = rolls.map(r => r.said);
    let ends = /** @type {AvoidResult['ends']} */ ('fight');
    let resolves = false;
    let enemiesFirst = false;

    if (outcome === 'mal') {
        effects.push(...option.failure.effects);
        lines.push(say(option.failure.text, roller));
        enemiesFirst = option.kind === 'huir' || option.kind === 'esconderse';
    } else {
        const branch = outcome === 'medias' && option.partial ? option.partial : option.success;
        effects.push(...branch.effects);
        if (option.kind === 'pagar') {
            const price = outcome === 'medias' ? Math.min(Math.max(option.gold, gold), Math.ceil(option.gold * 1.5)) : option.gold;
            effects.unshift({ kind: 'gold', amount: -price });
        }
        if (outcome === 'medias' && !option.partial) {
            // A medias, sin rama escrita: sale, pero se paga lo de siempre.
            if (option.kind === 'huir') effects.push({ kind: 'hurt', dice: '1d4', amount: rollFormula('1d4', die) });
            else if (option.kind !== 'pagar') effects.push({ kind: 'time' });
        }
        const partialLine = DEFAULT_LINES[option.kind].partial;
        lines.push(say(outcome === 'medias' ? (option.partial?.text ?? partialLine) : option.success.text, roller));
        ends = option.kind === 'huir' && !option.resolves ? 'fled' : 'avoided';
        resolves = ends === 'avoided' && option.resolves;
    }

    // Las heridas escritas, ya tiradas: el panel dice cuánto.
    for (const effect of effects) {
        if (effect.kind === 'hurt' && effect.amount == null) effect.amount = rollFormula(effect.dice || '1d4', die);
    }

    return {
        id: option.id,
        kind: option.kind,
        outcome,
        rolls,
        ends,
        resolves,
        enemiesFirst,
        effects,
        lines,
        judge: ends === 'fight' ? 'plantar-cara' : AVOID_KINDS[option.kind].judge,
        roller,
    };
}

/**
 * Un efecto dicho en llano, para la caja del panel y el registro.
 *
 * @param {ExitEffect} effect
 * @param {{roller?: string}} [context]
 * @returns {string}
 */
export function describeExitEffect(effect, { roller = '' } = {}) {
    const n = Number(effect?.amount) || 0;
    switch (effect?.kind) {
        case 'gold': return n < 0 ? `Pagáis ${-n} de oro.` : `Ganáis ${n} de oro.`;
        case 'attitude': return effect.who
            ? `${effect.who} os mira ${n > 0 ? 'mejor' : 'peor'}.`
            : `Os miran ${n > 0 ? 'mejor' : 'peor'}.`;
        case 'rumor': return 'Os enteráis de algo que se cuenta.';
        case 'clue': return `Pista: ${effect.text}`;
        case 'give': return `Os lleváis: ${effect.item}.`;
        case 'take': return `Perdéis: ${effect.item}.`;
        case 'time': return 'Se va un rato del día.';
        case 'milestone': return 'La historia avanza.';
        case 'standing': return `${effect.faction || 'Su gente'} ${n > 0 ? 'os mira mejor' : 'os mira peor'}.`;
        case 'fame': return n > 0 ? 'Se habla bien de vosotros por aquí.' : 'Por aquí se habla mal de vosotros.';
        case 'hurt': {
            const whom = effect.who === 'todos' ? 'Todos' : (roller || 'Alguien');
            return `${whom} ${effect.who === 'todos' ? 'se llevan' : 'se lleva'} ${n || effect.dice} de daño.`;
        }
        case 'days': return n === 1 ? 'Se va un día entero.' : `Se van ${n} días.`;
        case 'grudge': return `${effect.who || 'Alguien'} os la guardará cuando se entere.`;
        default: return '';
    }
}

/**
 * Lo escrito en `avoid`, comprobado para el importador: lo que no se entiende es un error; lo
 * que se entiende pero cojea, un aviso.
 *
 * @param {any} raw
 * @param {Object} [context]
 * @param {string} [context.path]
 * @param {Set<string>} [context.rumors] Los ids de los rumores del paquete.
 * @param {Set<string>} [context.milestones] Los ids de los hitos.
 * @returns {{errors: Array<{path: string, message: string}>, warnings: Array<{path: string, message: string}>}}
 */
export function checkAvoid(raw, { path = 'avoid', rumors = undefined, milestones = undefined } = {}) {
    /** @type {Array<{path: string, message: string}>} */
    const errors = [];
    /** @type {Array<{path: string, message: string}>} */
    const warnings = [];
    if (raw === undefined) return { errors, warnings };
    if (!Array.isArray(raw)) {
        errors.push({ path, message: '`avoid` es una lista de salidas: [{ "kind": "hablar", "text": "…" }].' });
        return { errors, warnings };
    }
    raw.forEach((entry, index) => {
        const at = `${path}[${index}]`;
        if (!isObject(entry)) {
            errors.push({ path: at, message: 'Cada salida es un objeto con `kind` y `text`.' });
            return;
        }
        const kind = kindOf(entry.kind);
        if (!kind) errors.push({ path: `${at}.kind`, message: `«${text(entry.kind)}» no es una salida: hablar, pagar, huir o esconderse.` });
        if (!text(entry.text)) errors.push({ path: `${at}.text`, message: 'Falta `text`: lo que se hace, visto desde quien juega.' });
        const skillRaw = entry.skill ?? entry.check?.skill;
        if (skillRaw !== undefined && !skillOf(skillRaw)) {
            errors.push({ path: `${at}.skill`, message: `«${text(skillRaw)}» no es una habilidad: ${Object.keys(SKILLS).join(', ')}.` });
        }
        const dc = Number(entry.dc ?? entry.check?.dc);
        if ((entry.dc ?? entry.check?.dc) !== undefined && (!Number.isFinite(dc) || dc < AVOID_DC_LIMITS.min || dc > AVOID_DC_LIMITS.max)) {
            warnings.push({ path: `${at}.dc`, message: `La CD va de ${AVOID_DC_LIMITS.min} a ${AVOID_DC_LIMITS.max}; se deja dentro.` });
        }
        if (kind === 'pagar' && !(Number(entry.gold) > 0)) {
            warnings.push({ path: `${at}.gold`, message: 'Pagar sin `gold`: el juego pondrá un precio según quién espera.' });
        }
        for (const branchKey of ['success', 'partial', 'failure']) {
            const branch = entry[branchKey];
            if (branch === undefined || typeof branch === 'string') continue;
            if (!isObject(branch)) {
                errors.push({ path: `${at}.${branchKey}`, message: 'Una rama es un texto o `{ "text": "…", "effects": [...] }`.' });
                continue;
            }
            readExitEffects(branch.effects).forEach((effect, i) => {
                if (effect.kind === 'unknown') {
                    errors.push({ path: `${at}.${branchKey}.effects[${i}]`, message: `No se entiende el efecto. Valen: ${EXIT_EFFECT_KINDS.join(', ')}.` });
                } else if (effect.kind === 'rumor' && rumors && !rumors.has(String(effect.id))) {
                    warnings.push({ path: `${at}.${branchKey}.effects[${i}]`, message: `El rumor «${effect.id}» no está en el paquete.` });
                } else if (effect.kind === 'milestone' && milestones && !milestones.has(String(effect.id))) {
                    warnings.push({ path: `${at}.${branchKey}.effects[${i}]`, message: `El hito «${effect.id}» no está en el hilo.` });
                }
            });
        }
    });
    return { errors, warnings };
}

/** Los números que se dicen con letra, para «Alguacil Torres y dos más». */
const NUMBER_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** Las que acaban en -a y son de él: «el guardia», «el pirata». */
const MASCULINE_A = new Set(['guardia', 'pirata', 'centinela', 'espia', 'contrabandista', 'sectario', 'jefe', 'cabecilla', 'vigia']);

/**
 * Tanda 10: un nombre que es lo que alguien es («Ratero del muelle», «Bruja del pantano»), con
 * su artículo al empezar la frase: «El ratero del muelle», «La bruja del pantano». Un nombre
 * propio («Torres», «Baba Lysaga», «Alguacil Torres») se queda como está.
 *
 * @param {string} name
 * @returns {string}
 */
export function withArticle(name) {
    const said = text(name);
    const words = said.split(/\s+/);
    // Solo la primera en mayúscula, y más de una palabra: es una descripción, no un nombre.
    if (words.length < 2 || words.slice(1).some(w => /^\p{Lu}/u.test(w))) return said;
    const first = fold(words[0]);
    const feminine = first.endsWith('a') && !MASCULINE_A.has(first);
    return `${feminine ? 'La' : 'El'} ${said.charAt(0).toLocaleLowerCase('es')}${said.slice(1)}`;
}

/**
 * La primera línea de la elección, antes de pelear: quién espera y cómo, en llano.
 *
 * - Gente: «Alguacil Torres y dos más os cierran el paso.» «El ratero del muelle os cierra el paso.»
 * - Bestias: «Os han olido: Lobo famélico ×3.»
 * - Muertos o cosas: «Algo se mueve delante: Zombi de Strahd ×3.»
 *
 * @param {FoeInfo[]} foes
 * @returns {string}
 */
export function avoidIntro(foes) {
    const list = (Array.isArray(foes) ? foes : []).filter(f => text(f?.name));
    if (list.length === 0) return '';
    const minds = new Set(list.map(mindOf));
    if (minds.has('gente')) {
        const leader = withArticle(leaderOf(list));
        const others = list.length - 1;
        if (others === 0) return `${leader} os cierra el paso.`;
        return `${leader} y ${NUMBER_WORDS[others] ?? others} más os cierran el paso.`;
    }
    if (minds.has('bestia')) return `Os han olido: ${foesLine(list)}.`;
    return `Algo se mueve delante: ${foesLine(list)}.`;
}

/**
 * @typedef {Object} ExitPlan Lo que hace el juego tras una salida, sin pensarlo dos veces.
 * @property {boolean} fight Si empieza la pelea.
 * @property {boolean} enemiesFirst Si empiezan ellos (os han pillado huyendo o escondidos).
 * @property {boolean} passed Si el tablero queda pasado: ya no espera nadie, y la historia sigue
 *   como si se hubiera ganado (sin botín).
 * @property {boolean} leave Si el grupo sale del tablero y la pelea se queda ahí, esperando.
 */

/**
 * Lo que hay que hacer con lo que salió de una salida (`resolveAvoid`). Una salida que sale
 * bien pero no cuenta como pasar el tablero (`resolves: false`) os saca de él: si no, el hito
 * que pide ganarlo no se podría cumplir nunca.
 *
 * @param {Pick<AvoidResult, 'ends'|'resolves'|'enemiesFirst'>} result
 * @returns {ExitPlan}
 */
export function exitPlan(result) {
    const fight = result?.ends === 'fight';
    const passed = result?.ends === 'avoided' && Boolean(result.resolves);
    return {
        fight,
        enemiesFirst: fight && Boolean(result.enemiesFirst),
        passed,
        leave: !fight && !passed,
    };
}

/**
 * Los tableros con pelea que no traen ninguna salida escrita (J12.2: toda pelea escrita tiene
 * otra salida). Con las de siempre se juega igual, pero lo escrito se lee mejor.
 *
 * @param {any} pack
 * @returns {string[]} Sus ids.
 */
export function fightsWithoutWay(pack) {
    return (Array.isArray(pack?.boards) ? pack.boards : [])
        .filter((/** @type {any} */ b) => Array.isArray(b?.enemies) && b.enemies.length > 0)
        .filter((/** @type {any} */ b) => readAvoid(b.avoid).length === 0)
        .map((/** @type {any} */ b) => text(b.id));
}
