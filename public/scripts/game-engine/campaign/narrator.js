/**
 * El narrador de una campaña: quién la cuenta, y con qué voz.
 *
 * Hasta ahora todas las campañas las narraba el mismo ayudante de la pantalla de
 * bienvenida — una ficha vacía, creada sola, sin nombre propio ni tono. Daba igual si
 * jugabas terror en una cripta o una comedia en una taberna: el que hablaba era el mismo,
 * y no sabía que era un narrador.
 *
 * Lo que se escribe aquí **sí llega al modelo**: la descripción y la personalidad de la
 * ficha de personaje son parte del prompt de todos los turnos. Por eso esto no es un campo
 * de sabor. Es el único sitio de la campaña donde el jugador decide *cómo se cuenta*, y por
 * eso la ficha que se construye dice antes que nada **qué oficio tiene**: narrar una mesa,
 * no interpretar a alguien. Un narrador al que solo se le da un nombre bonito acaba
 * hablando como un personaje más, contestando en primera persona y esperando su turno.
 *
 * La otra mitad de esa frontera está en el motor y no aquí: el narrador **no decide nada**
 * que tenga números. Las tiradas, el daño, quién cae y qué se encuentra los decide el
 * motor y el narrador los cuenta. Lo que escribas de personalidad cambia el *cómo*, nunca
 * el *qué*.
 *
 * Puro: devuelve los campos de la ficha. No crea nada, no sube ninguna imagen.
 *
 * Ver wiki/POR_HACER.md · wiki/EMPEZAR_UNA_CAMPANA.md.
 */

/**
 * @typedef {Object} NarratorAnswers
 * @property {string} name        Cómo se llama quien narra.
 * @property {string} personality El tono, con las palabras del jugador.
 * @property {string} description Qué sabe y cómo cuenta. Opcional.
 * @property {string} greeting    Con qué frase abre la campaña. Opcional.
 */

/**
 * @typedef {Object} NarratorCard
 * @property {string} ch_name
 * @property {string} description
 * @property {string} personality
 * @property {string} scenario
 * @property {string} first_mes
 * @property {string} creator_notes
 * @property {string} tags
 * @property {string} talkativeness
 */

/** El nombre de quien narra cuando no se le pone ninguno. */
export const DEFAULT_NARRATOR_NAME = 'Narrador';

/**
 * El oficio, dicho en la propia ficha.
 *
 * Va primero y en segunda persona porque es lo que evita el fallo de siempre: una ficha
 * que solo dice «voz grave y le gusta el vino» produce un personaje con voz grave, no
 * alguien que dirija una partida.
 */
const CRAFT = [
    'Eres quien narra esta partida: describes lo que el grupo ve, oye y encuentra, '
    + 'das voz a los personajes del mundo y cierras cada escena dejando claro qué se puede hacer.',
    'No interpretas a ningún miembro del grupo: esos los lleva quien juega.',
    'Las tiradas, el daño, las distancias y el botín los decide el juego y tú los cuentas; '
    + 'nunca los inventas ni los corriges.',
];

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * La ficha de personaje de un narrador, lista para crearla.
 *
 * @param {Partial<NarratorAnswers>} answers Lo que el jugador escribió.
 * @param {{worldName?: string, genre?: string, synopsis?: string}} [world] La campaña que va a narrar.
 * @returns {NarratorCard}
 */
export function buildNarratorCard(answers, world = {}) {
    const name = text(answers?.name) || DEFAULT_NARRATOR_NAME;
    const worldName = text(world.worldName);
    const genre = text(world.genre);

    // Dónde narra, para que la primera frase no salga de la nada. El género va aquí y no
    // en la personalidad: es del mundo, no de quien lo cuenta.
    const setting = [
        worldName ? `Narras "${worldName}".` : '',
        genre ? `Es ${genre.toLowerCase()}.` : '',
        text(world.synopsis),
    ].filter(Boolean).join(' ');

    const description = [
        ...CRAFT,
        setting,
        text(answers?.description),
    ].filter(Boolean).join('\n\n');

    return {
        ch_name: name,
        description,
        personality: text(answers?.personality),
        scenario: setting,
        first_mes: text(answers?.greeting) || defaultGreeting(name, worldName),
        creator_notes: `Narrador de la campaña${worldName ? ` "${worldName}"` : ''}. `
            + 'Creado desde el asistente; se puede editar como cualquier otra ficha.',
        tags: 'narrador',
        // Un narrador habla siempre que le toca: no es un personaje que a veces calla.
        talkativeness: '1',
    };
}

/**
 * Con qué se abre la campaña cuando el jugador no escribe nada.
 *
 * Una frase corta que no inventa trama: decir de más aquí es decidir por el jugador cómo
 * empieza su historia.
 *
 * @param {string} name
 * @param {string} worldName
 * @returns {string}
 */
function defaultGreeting(name, worldName) {
    return worldName
        ? `Empieza ${worldName}. Decidme qué hacéis.`
        : `${name} espera. Decidme qué hacéis.`;
}

/**
 * Lo que impide crear este narrador, dicho entero.
 *
 * @param {Partial<NarratorAnswers>} answers
 * @returns {string[]}
 */
export function validateNarrator(answers) {
    /** @type {string[]} */
    const errors = [];
    const name = text(answers?.name);

    if (!name) {
        errors.push('Ponle un nombre a quien narra: es el que aparece en cada mensaje.');
    } else if (name.length > 60) {
        errors.push('El nombre es demasiado largo para caber en la cabecera de un mensaje.');
    }

    return errors;
}

/**
 * El narrador en una línea, para el aviso de después.
 *
 * @param {NarratorCard} card
 * @returns {string}
 */
export function describeNarrator(card) {
    const parts = [text(card?.ch_name) || DEFAULT_NARRATOR_NAME];
    if (text(card?.personality)) parts.push(text(card.personality).split('\n')[0].slice(0, 60));
    return parts.join(' · ');
}
