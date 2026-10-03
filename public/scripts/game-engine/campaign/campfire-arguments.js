/**
 * E4.2 de wiki/ROADMAP_ENTRETENIDO.md: discusiones junto al fuego.
 *
 * Las charlas de pareja (`pair-talks.js`) son de buen rollo: una apuesta, unos ronquidos. Faltaba
 * la noche en la que dos de los tuyos no se ponen de acuerdo y te toca decir quién tiene razón.
 * Sale sola, junto al fuego o en la posada, antes de dormir:
 *
 * - **Por lo que decidisteis hoy**: si una decisión le gustó a uno y no a otro que busca otra
 *   cosa (el roce de `approval.js`), esa noche lo hablan. Cada uno lo defiende con lo que busca:
 *   el del oro, con el dinero; el de la tranquilidad, con no acabar en una zanja.
 * - **Tras una incursión dura** (alguien muy tocado, varios a media vida o alguien muerto hoy):
 *   uno quiere seguir mañana, más adentro; otro, volver y curarse.
 *
 * Tú decides: das la razón a uno (te acercas a él y te alejas del otro, y cuenta para su disgusto,
 * E4.1) o les pides que lo dejen (hacen las paces). Todo lo dicen ellos (D-J60).
 *
 * Puro: elige quién discute y de qué, y monta la escena (`cast-scenes.js`). Quien llama la enseña
 * con la ventana de las quedadas y aplica lo elegido.
 */

import { bindCast } from './cast-scenes.js';
import { shortOf, wantsFor } from './companion-cards.js';
import { WANTS } from '../rules/companions.js';

/** Lo que pesa una discusión tras una pelea dura: no más de una cada tantos días. */
export const HARD_EVERY = 2;

/** Quien quiere seguir y quien quiere volver, por lo que busca. */
export const PUSH = ['glory', 'blood', 'coin'];
export const CAREFUL = ['quiet', 'knowledge', 'coin'];

/** Lo que dice quien defiende lo de hoy, por lo que busca. */
const PRO = {
    coin: 'Eso deja dinero, y de algo hay que comer.',
    glory: 'Así se gana un nombre: dando la cara.',
    blood: 'Al que te busca, se le da. Así no vuelve.',
    quiet: 'Nadie ha salido herido. Eso es lo que cuenta.',
    knowledge: 'Hemos sacado algo en claro. Eso vale más que una bolsa.',
};

/** Lo que dice quien no lo aguanta, por lo que busca. */
const CON = {
    coin: 'Eso nos ha costado dinero, y no nos sobra.',
    glory: 'Eso no es de valientes. ¿Qué van a decir de nosotros?',
    blood: 'Así se nos escapan. Y luego vuelven.',
    quiet: 'Así vamos a acabar todos en una zanja.',
    knowledge: 'No hemos sacado nada en claro. Ni una cosa.',
};

/** Tras una pelea dura: quien quiere seguir. */
const PUSH_LINES = {
    glory: 'Hoy los teníamos en la mano. Mañana, más adentro, y que se acuerden de nosotros.',
    blood: 'Hoy les hemos hecho daño. Mañana volvemos y acabamos con los que queden.',
    coin: 'Lo bueno está más adentro. Si paramos ahora, otro se lleva lo que es nuestro.',
};

/** Tras una pelea dura: quien quiere volver (`{herido}` es cómo está el más tocado). */
const CAREFUL_LINES = {
    quiet: '¿Más adentro? {herido} Así no volvemos todos.',
    knowledge: '{herido} Y no sabemos qué hay más adentro. Primero hay que saber; luego, entrar.',
    coin: '{herido} Y muertos no cobramos. Yo digo de volver, curarnos y entrar con calma.',
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} m @returns {boolean} */
const standing = (m) => Boolean(m) && !m.dead && (Number(m.hp ?? 1) || 0) > 0 && m.guest?.kind !== 'ward';

/** @param {any} m @returns {number} */
const ratio = (m) => (Number(m?.hp) || 0) / Math.max(1, Number(m?.maxHp) || 1);

/**
 * Si hoy ha sido duro: alguien ha muerto, alguien está en las últimas (un cuarto de vida o
 * menos, o caído) o dos o más van a media vida.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {number} [input.deadToday] Los que han muerto hoy.
 * @returns {boolean}
 */
export function hardDay({ party, deadToday = 0 }) {
    if ((Number(deadToday) || 0) > 0) return true;
    const alive = (Array.isArray(party) ? party : []).filter(m => m && !m.dead);
    if (alive.some(m => ratio(m) <= 0.25)) return true;
    return alive.filter(m => ratio(m) < 0.5).length >= 2;
}

/**
 * Cómo está el más tocado, dicho por quien quiere volver (`b`).
 *
 * @param {any[]} party
 * @param {any} a
 * @param {any} b
 * @param {(m: any) => string} shortOfMember
 * @returns {string}
 */
function hurtLine(party, a, b, shortOfMember) {
    const worst = (Array.isArray(party) ? party : []).filter(m => m && !m.dead).sort((x, y) => ratio(x) - ratio(y))[0];
    if (!worst || ratio(worst) >= 0.5) return 'Mira cómo estamos.';
    if (worst === b) return 'Mírame: apenas me tengo en pie.';
    if (worst === a) return 'Mírate: apenas te tienes en pie.';
    return `Mira cómo está ${shortOfMember(worst)}.`;
}

/**
 * Lo que se hizo, dicho por uno del grupo: «pagar para que nos dejen pasar».
 *
 * @param {string} line La línea del roce («Gerd y Nella chocan por pagar…: uno busca…»).
 * @returns {string}
 */
export function topicOf(line) {
    const found = /chocan por (.+?):/.exec(text(line));
    return text(found?.[1]).replace(/\bos\b/g, 'nos');
}

/**
 * Lo que busca cada uno según el roce («uno busca gloria y el otro tranquilidad»): lo que les hizo
 * chocar. Vacío si la línea no lo dice.
 *
 * @param {string} line
 * @returns {[string, string]}
 */
export function frictionWants(line) {
    const found = /uno busca (.+?) y el otro (.+?)\.?$/.exec(text(line));
    const byLabel = (/** @type {string} */ label) => Object.entries(WANTS).find(([, w]) => w.label === text(label))?.[0] ?? '';
    return found ? [byLabel(found[1]), byLabel(found[2])] : ['', ''];
}

/**
 * @typedef {Object} Argument
 * @property {import('./cast-scenes.js').CastScene} scene
 * @property {'decision'|'dura'} kind
 * @property {any} a Quien defiende (o quiere seguir).
 * @property {any} b Quien no (o quiere volver).
 */

/**
 * La discusión de esta noche, si la hay: primero la de un roce de hoy; si no, tras un día duro.
 *
 * @param {Object} input
 * @param {any[]} input.party El grupo, con el héroe primero.
 * @param {Array<{a: string, b: string, line: string}>} [input.frictions] Los roces de hoy (`a` aprobó, `b` no).
 * @param {boolean} [input.hard] Si hoy ha sido duro (`hardDay`).
 * @param {number} input.day
 * @param {number} [input.lastArgued] El último día con discusión.
 * @param {() => number} input.random
 * @param {import('./companion-cards.js').CompanionCard[]} [input.cards]
 * @param {(member: any) => string} [input.wantsOf]
 * @returns {Argument|null}
 */
export function argumentFor({ party, frictions = [], hard = false, day, lastArgued = 0, random, cards = [], wantsOf = undefined }) {
    const today = Math.max(1, Math.floor(Number(day) || 1));
    if (lastArgued === today) return null;
    const members = (Array.isArray(party) ? party : []).slice(1).filter(standing);
    if (members.length < 2) return null;
    const hero = Array.isArray(party) ? party[0] : null;
    const want = (/** @type {any} */ m) => (wantsOf ? text(wantsOf(m)) : '') || wantsFor(cards, m);
    const byId = (/** @type {string} */ id) => members.find(m => String(m.id) === String(id));

    for (const friction of [...(Array.isArray(frictions) ? frictions : [])].reverse()) {
        const a = byId(friction?.a);
        const b = byId(friction?.b);
        const what = topicOf(friction?.line);
        if (!a || !b || a === b || !what) continue;
        // Lo que les hizo chocar manda; si la línea no lo dice, lo que busca cada uno.
        const [fa, fb] = frictionWants(friction?.line);
        const wa = /** @type {keyof typeof PRO} */ (fa || want(a));
        const wb = /** @type {keyof typeof CON} */ (fb || want(b));
        const row = {
            id: 'discusion-decision',
            title: 'Una discusión',
            beats: [
                { who: 'b', mood: 'enfadado', say: `{a}, ¿de verdad te pareció bien ${what}? ${CON[wb] ?? CON.quiet}` },
                { who: 'a', say: `Me pareció bien, sí. ${PRO[wa] ?? PRO.glory}` },
                {
                    who: 'b',
                    mood: 'enfadado',
                    say: '{heroe}, dilo tú. ¿Quién tiene razón?',
                    replies: [
                        { text: 'Tiene razón {a}.', bonds: { a: 1, b: -1 }, who: 'b', mood: 'enfadado', then: 'Ya. Ya veo de qué lado estás.' },
                        { text: 'Tiene razón {b}.', bonds: { a: -1, b: 1 }, who: 'a', mood: 'enfadado', then: 'Bah. Ya me daréis la razón cuando sea tarde.' },
                        { text: 'Basta los dos. Mañana hay que seguir juntos.', who: 'a', then: 'Vale. Por esta noche, lo dejamos.' },
                    ],
                },
            ],
        };
        return { scene: bindCast({ row, kind: 'pareja', slots: { a, b }, hero, party, cards }), kind: 'decision', a, b };
    }

    if (!hard || (lastArgued > 0 && today - lastArgued < HARD_EVERY)) return null;
    // Uno que quiera seguir y otro que quiera volver, que no busquen lo mismo. Al azar entre los que encajan.
    /** @type {Array<[any, any]>} */
    const pairs = [];
    for (const a of members) for (const b of members) {
        if (a === b || want(a) === want(b)) continue;
        if (PUSH.includes(want(a)) && CAREFUL.includes(want(b))) pairs.push([a, b]);
    }
    if (pairs.length === 0) return null;
    const [a, b] = pairs[Math.floor(random() * pairs.length) % pairs.length];
    const shortOfMember = (/** @type {any} */ m) => shortOf(cards, m);
    const herido = hurtLine(party, a, b, shortOfMember);
    const row = {
        id: 'discusion-dura',
        title: 'Tras un día duro',
        beats: [
            { who: 'a', say: PUSH_LINES[/** @type {keyof typeof PUSH_LINES} */ (want(a))] ?? PUSH_LINES.glory },
            { who: 'b', mood: 'enfadado', say: (CAREFUL_LINES[/** @type {keyof typeof CAREFUL_LINES} */ (want(b))] ?? CAREFUL_LINES.quiet).replace('{herido}', herido) },
            { who: 'a', mood: 'enfadado', say: 'Si paramos ahora, perdemos lo ganado. Ellos también se curan.' },
            {
                who: 'b',
                say: '{heroe}, tú mandas. ¿Seguimos mañana o volvemos?',
                replies: [
                    { text: 'Mañana seguimos. Tiene razón {a}.', bonds: { a: 1, b: -1 }, who: 'b', mood: 'triste', then: 'Como quieras. Pero luego no digas que no avisé.' },
                    { text: 'Primero nos curamos. Tiene razón {b}.', bonds: { a: -1, b: 1 }, who: 'a', mood: 'enfadado', then: 'Bah. Mientras descansamos, ellos también.' },
                    { text: 'Lo decidimos mañana, con la cabeza fría.', who: 'a', then: 'Vale. Pero mañana hay que decidir.' },
                ],
            },
        ],
    };
    return { scene: bindCast({ row, kind: 'pareja', slots: { a, b }, hero, party, cards }), kind: 'dura', a, b };
}

/**
 * A quién se dio la razón: `a`, `b`, `paz` (que lo dejen) o vacío si se cerró sin contestar.
 *
 * @param {import('./cast-scenes.js').CastScene} scene
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {'a'|'b'|'paz'|''}
 */
export function argumentChoice(scene, choices) {
    const asked = (scene?.beats ?? []).findIndex(b => (b.replies ?? []).length > 0);
    const last = [...(Array.isArray(choices) ? choices : [])].reverse().find(c => c && c.beat === asked);
    if (!last) return '';
    return /** @type {Array<'a'|'b'|'paz'>} */ (['a', 'b', 'paz'])[last.reply] ?? '';
}

/**
 * Lo que cuenta para el disgusto (E4.1): a quien das la razón se le pasa algo; al otro, le
 * pesa. Pedir que lo dejen no cuenta para ninguno.
 *
 * @param {'a'|'b'|'paz'|''} choice
 * @param {any} a
 * @param {any} b
 * @returns {Array<{id: string, name: string, want: string, mood: 1|-1, what: string}>}
 */
export function argumentVerdicts(choice, a, b) {
    if (choice !== 'a' && choice !== 'b') return [];
    const [won, lost] = choice === 'a' ? [a, b] : [b, a];
    return [
        { id: String(won?.id ?? ''), name: text(won?.name), want: '', mood: 1, what: 'le diste la razón' },
        { id: String(lost?.id ?? ''), name: text(lost?.name), want: '', mood: -1, what: 'no le diste la razón' },
    ];
}
