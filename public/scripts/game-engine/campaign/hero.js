/**
 * Quién eres tú: el personaje con el que empiezas a jugar.
 *
 * El asistente pedía **una lista de nombres**, uno por línea, y de cada uno nacía una
 * ficha con clase *Adventurer*, diez en todo y treinta puntos de vida. Un nombre no es un
 * personaje: era el paso que menos se parecía a empezar una partida de rol.
 *
 * Así que se crea **al entrar**, no al rellenar el formulario del mundo, y se pregunta lo
 * que uno decide cuando se hace un personaje: cómo te llamas, qué eres y de dónde vienes.
 * Lo que sale de aquí es **exactamente** la misma ficha de Lorebook que escribía el
 * asistente —`entityType: 'character'` con su `mapPosition`— porque de ahí cuelga todo lo
 * demás: el grupo, las heridas, el hambre, la cuenta semanal y el gremio.
 *
 * Y los números salen de la clase cuando el mundo la tiene descrita. Eso es lo que hace
 * que elegir «Pícara» signifique algo en vez de ser una palabra en la cabecera.
 *
 * Puro: arma la ficha. No la escribe, no crea nada y no abre ningún chat.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 1.
 */

import { applyKin } from '../compendio/kin.js';

/** Lo que se ofrece cuando el mundo no trae razas propias. */
export const DEFAULT_RACES = [
    'Humano', 'Elfo', 'Enano', 'Mediano', 'Semiorco', 'Tiflin', 'Gnomo', 'Draconido',
];

/** Y lo mismo con las clases. */
export const DEFAULT_CLASSES = [
    'Guerrero', 'Pícara', 'Clérigo', 'Mago', 'Explorador', 'Bárbaro', 'Bardo', 'Druida',
];

/** Cómo se presenta alguien. Texto libre también vale: es su personaje. */
export const GENDERS = ['Mujer', 'Hombre', 'No binario', 'Sin especificar'];

/**
 * @typedef {Object} HeroAnswers
 * @property {string} name
 * @property {string} gender
 * @property {string} race
 * @property {string} className
 * @property {string} about   Una línea sobre quién es. Es lo que lee el modelo.
 * @property {string} image
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Lo que impide empezar con este personaje.
 *
 * Solo el nombre es obligatorio. Lo demás se puede dejar en blanco y decidirse jugando —
 * pedir doce campos antes de la primera frase es la mejor forma de que nadie llegue a la
 * primera frase.
 *
 * @param {Partial<HeroAnswers>} answers
 * @returns {string[]}
 */
export function validateHero(answers) {
    /** @type {string[]} */
    const errors = [];
    const name = text(answers?.name);

    if (!name) errors.push('Ponle un nombre: es como te va a llamar todo el mundo.');
    else if (name.length > 60) errors.push('Ese nombre no cabe en la cabecera de un mensaje.');

    return errors;
}

/**
 * Lo que el modelo lee cuando alguien te nombra.
 *
 * @param {Partial<HeroAnswers>} answers
 * @returns {string}
 */
export function heroContent(answers) {
    const name = text(answers?.name);
    const what = [text(answers?.gender), text(answers?.race), text(answers?.className)]
        .filter(Boolean).join(' · ');

    return [
        what ? `${name}: ${what}.` : `${name} forma parte del grupo.`,
        text(answers?.about),
    ].filter(Boolean).join('\n\n');
}

/**
 * La ficha de Lorebook de tu personaje, lista para escribirla.
 *
 * @param {Partial<HeroAnswers>} answers
 * @param {Object} [where]
 * @param {string} [where.locationName] Dónde empieza.
 * @param {{x: number, y: number}} [where.cell] Y en qué casilla.
 * @param {any} [where.preset] Los números de su clase, si el mundo los describe.
 * @param {any} [where.raceRow] La fila de la raza: lo que suma y lo que quita.
 * @param {any} [where.classRow] Y la de la clase.
 * @returns {{group: string, title: string, content: string, keys: string[], dndData: any}}
 */
export function buildHeroEntry(answers, where = {}) {
    const name = text(answers?.name);
    const preset = (where.preset && typeof where.preset === 'object') ? where.preset : {};
    const cell = where.cell ?? { x: 1, y: 1 };

    /** @param {any} value @param {number} fallback */
    const num = (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    // De donde parte: lo que diga la clase del mundo, y si no, los diez de siempre.
    const base = {
        strength: num(preset.strength, 10),
        dexterity: num(preset.dexterity, 10),
        constitution: num(preset.constitution, 10),
        intelligence: num(preset.intelligence, 10),
        wisdom: num(preset.wisdom, 10),
        charisma: num(preset.charisma, 10),
        armorClass: num(preset.armorClass, 10),
        speed: num(preset.speed, 30),
        // Treinta cuando la clase no dice otra cosa, que es lo que el motor le da a
        // cualquiera del grupo. Diez parecia mas de manual, pero dejaba al personaje con
        // la mitad de vida de la que tienen medidos los enemigos de las plantillas.
        maxHp: num(preset.maxHp ?? preset.hp, 30),
    };

    // Y lo que la raza y la clase le suman y le quitan. Hasta que existieron las baterias,
    // elegir «enano» era escribir una palabra en la ficha: ni un punto de mas ni uno de
    // menos. Sin ellas esto no hace nada y la ficha sale como salia.
    const { stats } = applyKin({ sheet: base, race: where.raceRow, kind: where.classRow });

    return {
        group: 'Characters',
        title: name,
        content: heroContent(answers),
        keys: [name],
        dndData: {
            entityType: 'character',
            name,
            charClass: text(answers?.className),
            race: text(answers?.race),
            gender: text(answers?.gender),
            level: 1,
            image: text(answers?.image),
            str: stats.strength,
            dex: stats.dexterity,
            con: stats.constitution,
            int: stats.intelligence,
            wis: stats.wisdom,
            cha: stats.charisma,
            ac: stats.armorClass,
            speed: stats.speed,
            maxHp: stats.maxHp,
            mapPosition: {
                locationName: text(where.locationName),
                gridX: num(cell.x, 1),
                gridY: num(cell.y, 1),
            },
        },
    };
}

/**
 * Lo que se le pide al modelo cuando pulsas la varita.
 *
 * La gracia está en que lo escrito **no es un texto a mejorar, es un encargo**: «algo
 * triste sobre lo pobre que es» no hay que pulirlo, hay que cumplirlo. Por eso se le pasa
 * como instrucción y no como borrador — pedirle «mejora esto» a media frase suelta
 * devuelve la misma media frase con más adjetivos.
 *
 * Y se le ata corto en largo: esto acaba en el Lorebook y se inyecta en el prompt **cada
 * vez que alguien te nombra**, así que un párrafo de novela aquí se paga en todos los
 * turnos de la partida.
 *
 * @param {Partial<HeroAnswers>} answers
 * @param {{worldName?: string, genre?: string, premise?: string}} [world]
 * @returns {{systemPrompt: string, prompt: string}}
 */
export function buildHeroPrompt(answers, world = {}) {
    const who = [text(answers?.gender), text(answers?.race), text(answers?.className)]
        .filter(Boolean).join(', ');

    const systemPrompt = [
        'Escribes la ficha de un personaje jugador para una partida de rol.',
        'Devuelves **solo** el texto de la ficha: sin comillas, sin titulo y sin comentarios.',
        'Entre dos y cuatro frases. Ni una mas.',
        'En tercera persona y en español.',
        'Cuentas de donde viene, que se le da bien y que calla. Nada de estadisticas ni de numeros.',
    ].join(' ');

    const prompt = [
        text(answers?.name) ? `Se llama ${text(answers.name)}.` : '',
        who ? `Es ${who}.` : '',
        text(world.worldName) ? `La partida ocurre en "${text(world.worldName)}".` : '',
        text(world.genre) ? `El tono es ${text(world.genre).toLowerCase()}.` : '',
        // Como empieza la partida: su pasado tiene que poder llegar ahi. Un militar retirado
        // no puede ser, a la vez, un chaval que roba en las calles.
        text(world.premise) ? `Así empieza la partida: ${text(world.premise)} Su pasado tiene que encajar con eso.` : '',
        '',
        text(answers?.about)
            ? `Lo que quiere quien juega: ${text(answers.about)}`
            : 'Invéntale un pasado breve que encaje con lo anterior.',
    ].filter(line => line !== '').join('\n');

    return { systemPrompt, prompt };
}

/**
 * Limpia lo que devuelva el modelo.
 *
 * Los modelos entrecomillan, encabezan y se despiden. Nada de eso va en una ficha, y
 * dejarlo entrar significa verlo en el prompt de cada turno.
 *
 * @param {string} answer
 * @returns {string}
 */
export function cleanHeroAbout(answer) {
    return text(answer)
        .replace(/^[`"“‘']+|[`"”’']+$/g, '')
        .replace(/^\s*(ficha|personaje|pasado)\s*:\s*/i, '')
        .trim();
}

/**
 * Tu personaje en una línea, para el aviso de después.
 *
 * @param {Partial<HeroAnswers>} answers
 * @returns {string}
 */
export function describeHero(answers) {
    const parts = [text(answers?.name)];
    const what = [text(answers?.race), text(answers?.className)].filter(Boolean).join(' ');
    if (what) parts.push(what);
    return parts.filter(Boolean).join(' · ');
}
