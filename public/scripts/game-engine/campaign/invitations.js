/**
 * Pulsar a alguien de tu gente (D-J63 de wiki/ROADMAP_SIN_CONEXION.md): como en *Persona*.
 *
 * «Veo muy brusco que cuando le doy a hablar con alguien que ni conozco salga directamente
 * (romance)… el romance no debería ser un menú, sino una consecuencia natural de pasar tiempo
 * juntos» (Daniel, 2026-10-03). Así que en el pueblo no hay botones de «Charlar», «Quedar con X»
 * ni «Romance», ni corazones al principio. Pulsas a la persona y te saluda ella, con sus
 * palabras (D-J60: no hay narrador):
 *
 * - **El saludo, en contexto** (`invitationFor`): si aún no os conocéis, primero se presenta
 *   (J13.7); luego la hora, dónde está, lo que habéis hecho hace poco (una pelea, un viaje, el
 *   último rato juntos, la fiesta de hoy) y la pregunta, a su manera (lo que busca).
 * - **Dos respuestas** (`inviteOptions`): «Pasar el rato con Gerd», que gasta esta parte del día
 *   (D-J31 sigue: comprar no gasta), y «Hablamos en otro momento», que cierra sin gastar nada.
 * - **La pista** (`rankUpHint`): si lo que suma la quedada basta para subir de rango, una línea
 *   discreta fuera de la caja: «Sientes que tu relación con Gerd se profundizará hoy».
 *
 * Los botones de antes no se borran: `DIRECT_SOCIAL_BUTTONS` los vuelve a sacar (wiki/LO_OCULTO.md).
 *
 * Puro: dice qué se dice y qué se ofrece. La ventana es `openInvitation` de `ui/meetup-scene.js`
 * y quien la abre, `inviteFrom` de `party/social.js`.
 */

import { BOND_EVENTS, MAX_RANK, getRankForPoints } from './bonds.js';
import { resolveGender } from './grammar.js';
import { MEETUP_EVENTS } from './meetups.js';

/**
 * El interruptor de lo escondido (wiki/LO_OCULTO.md): `true` vuelve a poner en el pueblo los
 * botones directos «Quedar con X» y «Charlar con X», «Quedar con alguien» en la fila de abajo y
 * los corazones de «quiere quedar contigo». Apagado (D-J63), a la gente se la pulsa.
 */
export const DIRECT_SOCIAL_BUTTONS = false;

/** Las dos respuestas de la invitación, por su id. */
export const INVITE_CHOICES = Object.freeze({ quedar: 'quedar', luego: 'luego' });

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} name @returns {string} El primer nombre: «Gerd», no «Gerd el Mellado». */
const firstName = (name) => text(name).split(' ')[0] || text(name);

/** El saludo de cada hora. */
const HELLO = { morning: 'Buenos días.', afternoon: 'Buenas tardes.', night: 'Buenas noches.' };

/**
 * Dónde está, dicho por quien está allí. `{en}` y `{a}` llevan el nombre del sitio en este pueblo
 * («en la taberna», «a la capilla», «al mercado»); sin nombre, el de siempre.
 */
const HERE = {
    posada: ['Aquí, {en}, con algo caliente delante.', 'la posada'],
    herreria: ['Aquí, {en}, que hoy no para el martillo.', 'la herrería'],
    tienda: ['He venido {a} a por cuatro cosas.', 'la tienda'],
    templo: ['Me he acercado {a} a estar un rato en calma.', 'el templo'],
    tablon: ['Estaba mirando el tablón, a ver qué hay.', ''],
    plaza: ['Estaba dando una vuelta por la plaza.', ''],
    muelle: ['Estaba {en}, viendo entrar las barcas.', 'el muelle'],
    gremio: ['Aquí, {en}, sin mucho que hacer.', 'la sala del gremio'],
    camino: ['Estaba estirando las piernas.', ''],
};

/**
 * El nombre del sitio dentro de una frase: el artículo en minúscula («La taberna» → «la taberna»),
 * lo demás tal cual («la Casa del Gremio»). Sin artículo («Taberna Sangre de la Enredadera») no
 * se sabe cuál ponerle: vacío, y se dice el de siempre.
 *
 * @param {string} name
 * @returns {string}
 */
const inSentence = (name) => (/^(El|La|Los|Las)\s/.test(text(name)) ? text(name).replace(/^\S+/, (article) => article.toLowerCase()) : '');

/**
 * La frase de dónde está, con el nombre del sitio en este pueblo si lo tiene.
 *
 * @param {string} place La clase de sitio (`posada`, `muelle`…).
 * @param {string} [name] Cómo se llama aquí («La taberna»).
 * @returns {string}
 */
function hereLine(place, name = '') {
    const row = /** @type {Record<string, string[]>} */ (HERE)[text(place)];
    if (!row) return '';
    const [line, usual] = row;
    const site = inSentence(name) || usual;
    // «a el» no se dice: «al».
    return line.replace('{en}', `en ${site}`).replace('{a}', `a ${site}`).replace(/\ba el\b/g, 'al');
}

/** Lo que habéis hecho hace poco, dicho por quien te saluda. */
const LATELY = {
    pelea: 'Lo de antes, la pelea, estuvo cerca. Me alegro de verte {entero|entera}.',
    llegada: '¿Ya de vuelta del camino? Tendrás los pies molidos.',
    quedada: 'Lo del otro día estuvo bien, ¿eh?',
};

/** La pregunta, a su manera: por lo que busca. */
const ASK = {
    coin: '¿Tienes un rato? Te cuento un negocio que me ronda la cabeza.',
    glory: '¿Tienes un rato? Me apetece contarte alguna batallita.',
    blood: '¿Tienes un rato, o vas con prisa?',
    quiet: '¿Tienes un rato? Sin prisa, solo por estar.',
    knowledge: '¿Tienes un rato? He leído algo que te quiero contar.',
};

/** La pregunta de siempre. */
const ASK_PLAIN = '¿Tienes un rato?';

/** Cuando tiene algo que contarte (su escena del rango, por jugar). */
const ASK_SCENE = 'Oye, ¿tienes un rato? Hay algo que quiero contarte.';

/** Ya en la ruta de pareja: una cita, o la noche. */
const ASK_DATE = { cita: 'Te estaba esperando. ¿Nos vamos ya, tú y yo?', final: 'Esta noche quiero verte. ¿Vienes conmigo?' };

/**
 * Las dos respuestas de la invitación.
 *
 * @param {string} short Cómo se le llama (su primer nombre, o lo que es si no se ha presentado).
 * @returns {Array<{id: string, label: string}>}
 */
export function inviteOptions(short) {
    return [
        { id: INVITE_CHOICES.quedar, label: `Pasar el rato con ${text(short) || 'alguien'}` },
        { id: INVITE_CHOICES.luego, label: 'Hablamos en otro momento' },
    ];
}

/**
 * Hasta dónde llega el vínculo con una quedada, por lo que suma ella sola (su escena o un rato),
 * sin contar las respuestas: lo seguro.
 *
 * @param {{points: number, scene?: boolean}} input `scene`: si toca su escena del rango.
 * @returns {{rank: number, reaches: number, rankingUp: boolean, base: number}}
 */
export function hangoutReach({ points, scene = false }) {
    const now = Math.max(0, Number(points) || 0);
    const event = scene ? MEETUP_EVENTS.escena : MEETUP_EVENTS.rato;
    const base = /** @type {Record<string, {points: number}>} */ (BOND_EVENTS)[event]?.points ?? 0;
    const rank = getRankForPoints(now);
    const reaches = getRankForPoints(now + base);
    return { rank, reaches, rankingUp: rank < MAX_RANK && reaches > rank, base };
}

/**
 * La pista discreta de la invitación: si quedar hoy sube el rango. Vacía si no, si aún no os
 * conocéis o si con esta persona no se queda.
 *
 * @param {{name: string, points: number, scene?: boolean, known?: boolean, canMeet?: boolean}} input
 * @returns {string}
 */
export function rankUpHint({ name, points, scene = false, known = true, canMeet = true }) {
    if (!known || !canMeet || !text(name)) return '';
    return hangoutReach({ points, scene }).rankingUp ? `Sientes que tu relación con ${firstName(name)} se profundizará hoy.` : '';
}

/**
 * @typedef {Object} Invitation
 * @property {string[]} lines Lo que dice al verte (en la caja, con su placa): la presentación, el saludo y lo de hace poco.
 * @property {string} ask La pregunta, lo último que dice.
 * @property {boolean} intro Si se ha presentado ahora (aún no os conocíais).
 * @property {Array<{id: string, label: string}>} options
 */

/**
 * Lo que dice quien pulsas, en contexto y con su voz.
 *
 * @param {Object} input
 * @param {string} input.name Su nombre entero.
 * @param {boolean} [input.known] J13.7: si ya se ha presentado.
 * @param {string} [input.intro] Cómo se presenta, si lo trae el mundo («Soy Ramiro, el herrero.»).
 * @param {string} [input.place] Dónde está (`posada`, `muelle`…).
 * @param {string} [input.placeName] Cómo se llama ese sitio en este pueblo («La taberna»), si lo tiene.
 * @param {string} [input.slot] La franja (`morning`, `afternoon`, `night`).
 * @param {string} [input.lately] Lo de hace poco: `pelea`, `llegada` o `quedada`.
 * @param {string} [input.festival] La fiesta de hoy aquí, si la hay.
 * @param {string} [input.wants] Lo que busca (`coin`, `glory`, `blood`, `quiet`, `knowledge`).
 * @param {boolean} [input.scene] Si tiene su escena del rango por contarte.
 * @param {''|'cita'|'final'} [input.date] Ya en la ruta de pareja: si os toca una cita, o la noche.
 * @param {any} [input.hero] Para concordar con tu héroe.
 * @returns {Invitation}
 */
export function invitationFor({
    name, known = true, intro = '', place = '', placeName = '', slot = '', lately = '', festival = '', wants = '', scene = false, date = '', hero = null,
}) {
    const short = firstName(name);
    /** @type {string[]} */
    const lines = [];
    if (!known) lines.push(text(intro) || `Creo que no nos conocemos. Soy ${short}.`);
    const hello = /** @type {Record<string, string>} */ (HELLO)[text(slot)] ?? 'Hola.';
    const here = hereLine(place, placeName);
    lines.push([hello, here].filter(Boolean).join(' '));
    if (text(festival)) lines.push(`Hoy es ${text(festival)}. Todo el pueblo está en la calle.`);
    else if (known && /** @type {Record<string, string>} */ (LATELY)[text(lately)]) lines.push(/** @type {Record<string, string>} */ (LATELY)[text(lately)]);
    const ask = (date && /** @type {Record<string, string>} */ (ASK_DATE)[date])
        || (scene && known ? ASK_SCENE : '')
        || /** @type {Record<string, string>} */ (ASK)[text(wants)]
        || ASK_PLAIN;
    const said = (/** @type {string} */ line) => resolveGender(line, { heroe: hero });
    return {
        lines: lines.map(said),
        ask: said(ask),
        intro: !known,
        // Quien aún no se conocía ya se ha presentado: las respuestas le llaman por su nombre.
        options: inviteOptions(short),
    };
}
