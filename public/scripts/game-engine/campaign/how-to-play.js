/**
 * «Cómo se juega»: la página de ayuda de la pausa y de `/ayuda` (H2 de wiki/LO_QUE_FALTA.md).
 *
 * El juego tiene modos con seis letras, un tablero con catorce clases de casilla, una crónica
 * en diez categorías y más de cincuenta comandos, y no explicaba ninguno. Esta página no se
 * escribe a mano: se arma con lo que el motor sabe (el modo de esta partida, la leyenda del
 * tablero, las categorías de la crónica), así que no se queda vieja cuando algo cambia.
 *
 * Puro: devuelve secciones con sus líneas. Quién las pinta lo decide quien llama.
 */

import { LETTERS, modeOf, modeLabel, hasLetter } from '../rules/modes.js';
import { CATEGORIES } from './chronicle.js';
import { factionWorldOn } from './factions.js';

/**
 * @typedef {Object} HelpSection
 * @property {string} id
 * @property {string} title
 * @property {string[]} lines
 */

/** Lo que no es casilla: el suelo se da por sabido, y las puertas se explican aparte. */
const SKIP_LEGEND = new Set(['.']);

/**
 * La página entera.
 *
 * @param {Object} input
 * @param {any} input.survival Los interruptores de la partida (`rulesetPack.survival`).
 * @param {Record<string, string>} [input.legend] La leyenda del tablero (`getMapLegend()`).
 * @param {boolean} [input.pet] Si hay mascota en esta partida.
 * @param {boolean} [input.magic] Si alguien del grupo lanza conjuros.
 * @param {boolean} [input.offline] J15.4 y J18.7: jugando sin conexión no hay caja de escribir:
 *   cada cosa se dice con el botón que la hace, no con su comando.
 * @returns {HelpSection[]}
 */
export function buildHowToPlay({ survival, legend = {}, pet = false, magic = false, offline = false }) {
    const on = (/** @type {string} */ letter) => hasLetter(survival, letter);
    /** Lo que se dice con su comando o, sin conexión, con su botón. */
    const say = (/** @type {string} */ typed, /** @type {string} */ pressed) => (offline ? pressed : typed);
    /** @type {HelpSection[]} */
    const out = [];

    out.push({
        id: 'reparto',
        title: 'Quién manda aquí',
        lines: offline ? [
            'El juego decide y lo cuenta. La vida, las tiradas, el día, el dinero y quién está dónde los lleva el motor.',
            'Todo se hace con botones: la fila de abajo, los sitios del pueblo, la barra del tablero y la pausa (arriba a la derecha). Si algo pide tirada, sale su botón.',
        ] : [
            'El juego decide y el narrador cuenta. La vida, las tiradas, el día, el dinero y quién está dónde los lleva el motor, y no cuestan nada.',
            'El narrador escribe lo que pasa con eso. Si dice algo que el motor no confirma, manda el motor (`/contradicciones` lo enseña).',
            'Lo que escribes en el chat es lo que tu personaje dice o intenta. Si pide tirada, el juego te la ofrece.',
        ],
    });

    out.push({
        id: 'modo',
        title: `Tu modo: ${modeLabel(modeOf(survival))}`,
        lines: [
            ...LETTERS.map(letter => `${on(letter.id) ? '✓' : '·'} ${letter.title}: ${letter.note}`),
            say('Se cambia con `/modo` cuando quieras, y queda escrito en la crónica.', 'Se cambia en la pausa («Modo») cuando quieras, y queda escrito en la crónica.'),
        ],
    });

    out.push({
        id: 'pelear',
        title: 'Moverse y pelear',
        lines: [
            'Pulsa tu ficha y luego una casilla encendida: el camino dice lo que cuesta, y en rojo si no llegas.',
            'Pulsa a un enemigo: su tarjeta dice lo que pasaría si atacas (la probabilidad, el daño) y lo que puedes usar contra él.',
            'Tu turno tiene movimiento, una acción y, a veces, una acción extra. «Acabar turno» avisa si te queda algo por hacer.',
            say('Huir se puede siempre (con su precio). Si hay una salida en el tablero, quien la pisa se va sin pagar los golpes: `/salir`.',
                'Huir se puede siempre («Abandonar», con su precio). Si hay una salida en el tablero, quien la pisa se va sin pagar los golpes: sale «Salir por aquí».'),
        ],
    });

    const board = Object.entries(legend)
        .filter(([char]) => !SKIP_LEGEND.has(char))
        .map(([char, said]) => `\`${char}\` ${said}`);
    if (board.length > 0) {
        out.push({ id: 'tablero', title: 'Lo que hay en el tablero', lines: board });
    }

    out.push({
        id: 'semana',
        title: 'El día y la semana',
        lines: [
            'El tiempo pasa al viajar, descansar y hacer cosas. Cada día se come y se cura lo que cura.',
            on('b')
                ? say('Cada semana llega la cuenta: sueldos, posada y comida. `/cuenta` la dice antes de que venza.',
                    'Cada semana llega la cuenta: sueldos, posada y comida. La «Mesa», arriba, la dice antes de que venza, parte a parte.')
                : 'En este modo no hay cuenta semanal.',
            `La mesa (${say('`/mesa`', 'el botón «Mesa», arriba')}) junta lo que pide atención esta semana, con su plazo y lo que pasa si no se atiende. No cabe todo: elegir es el juego.`,
            on('c')
                // D-J58: las facciones, solo con su mundo vivo encendido.
                ? `El mundo se mueve aunque no mires: ${factionWorldOn() ? 'facciones, rivales, casos' : 'rivales y casos'}. «Lo que viene» dice lo próximo.`
                : 'En este modo el mundo espera a que vuelvas.',
        ],
    });

    /** @type {string[]} */
    const extra = [];
    if (magic) extra.push(`Los conjuros salen del grimorio (${say('`/grimorio`', 'en la ficha de cada uno: pulsa su retrato')}): tres cargas de primer círculo, dos de segundo y una de tercero, que vuelven con el descanso largo. Los gordos gastan un componente.`);
    if (pet) extra.push(`Tu mascota comenta lo que pasa y ayuda en el tablero sin pelear en serio: avisar, distraer, rastrear. ${say('`/mascota` para verla.', 'En la pausa, «Mascota», para verla.')}`);
    if (extra.length > 0) out.push({ id: 'lo-tuyo', title: 'Lo que tienes', lines: extra });

    out.push({
        id: 'cronica',
        title: 'La crónica',
        lines: [
            `Todo lo que pasa se apunta con su etiqueta, en ${Object.keys(CATEGORIES).length} categorías: ${Object.values(CATEGORIES).join(', ')}.`,
            'El diario (tecla D) la enseña con filtro. El narrador recuerda lo mismo que el diario.',
        ],
    });

    out.push({
        id: 'perdido',
        title: 'Si te pierdes',
        lines: offline ? [
            '«¿Qué hago?» (tecla H) dice lo que se puede hacer aquí; el glosario (tecla L), qué significa cada palabra.',
            '«Mapa», arriba: los sitios, los caminos y tus notas.',
            '«Guardar y cargar», en la pausa: tus ranuras, las que se llenan solas (al dormir en el gremio y al empezar el día) y los puntos de retorno de hoy. Desde ahí también se exporta la partida entera.',
            '«Tu sesión», en la pausa: en qué se te ha ido el rato.',
            '«Cómo se juega», en la pausa: esta página.',
        ] : [
            '«¿Qué hago?» (tecla H) dice lo que se puede hacer aquí; el glosario (tecla L), qué significa cada palabra.',
            '`/estado`: todo lo que el juego da por cierto ahora mismo.',
            '`/mapa`: los sitios, los caminos y tus notas.',
            '`/punto`: los puntos de retorno, para volver atrás si el modo lo deja.',
            '«Guardar y cargar», en la pausa: tus ranuras y los puntos de retorno de hoy.',
            '«Tu sesión», en la pausa: en qué se te ha ido el rato y cuántas llamadas al narrador llevas.',
            '`/ayuda`: esta página.',
        ],
    });

    return out;
}

/**
 * La página en texto plano, para el chat o para una prueba.
 *
 * @param {HelpSection[]} sections
 * @returns {string}
 */
export function howToPlayText(sections) {
    return sections.map(section => [`## ${section.title}`, ...section.lines.map(line => `- ${line}`)].join('\n')).join('\n\n');
}
