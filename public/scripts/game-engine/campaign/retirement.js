/**
 * E8.3 de wiki/ROADMAP_ENTRETENIDO.md (D-J64): retirarse al gremio en vez de empezar de cero.
 *
 * Con campañas largas, el héroe acaba arriba del todo. En vez de borrar y volver al nivel 1,
 * un héroe veterano se queda en casa como **maestro** (cosecha propia, al estilo de
 * *Darkest Dungeon*):
 *
 * - **Los nuevos empiezan con ventaja**: con la experiencia de un nivel más alto (hasta el 5,
 *   como los veteranos de otras partidas, `veterans.js`), según el nivel del mejor maestro.
 * - **Enseña una dote**: cada héroe nuevo puede aprender una de las mejoras del maestro
 *   (`level-perks.js`), una sola, al llegar.
 * - **El gremio gana algo** según su oficio: quien peleó recomienda mercenarios más baratos,
 *   quien se movía por los bajos fondos pone una bolsa para los nuevos, y quien rezaba
 *   consigue que el templo cobre menos por devolver la vida.
 * - **Va al Salón de la fama**, con su línea.
 *
 * La despedida es una charla con quien lleva el gremio (D-J60: sin narrador).
 *
 * Puro: decide quién puede, qué deja y cómo se dice. Quien llama lo guarda y lo enseña.
 */

import { PERKS } from '../rules/level-perks.js';
import { xpForLevel } from '../rules/level-up.js';
import { gendered } from './grammar.js';

/** En los metadatos (de la partida entera): los maestros del gremio. */
export const MENTORS_KEY = 'mentors';

/** El nivel desde el que un héroe puede retirarse: el segundo tramo de 5e. */
export const RETIRE_MIN_LEVEL = 5;

/** El nivel más alto con el que empieza un nuevo gracias a un maestro (como un veterano). */
export const MENTOR_MAX_START = 5;

/** Lo que pone la bolsa del maestro para cada héroe nuevo. */
export const MENTOR_PURSE = 50;

/** Lo que rebajan los maestros: los mercenarios y el templo, un cuarto. */
export const MENTOR_DISCOUNT = 0.25;

/**
 * Lo que da al gremio cada oficio.
 *
 * @type {Record<string, {id: string, label: string, describe: string}>}
 */
export const GUILD_PERKS = {
    armas: { id: 'armas', label: 'Espadas recomendadas', describe: 'Los mercenarios del gremio cobran un 25 % menos: los recomienda alguien a quien respetan.' },
    bolsa: { id: 'bolsa', label: 'La bolsa del maestro', describe: `Cada héroe nuevo llega con ${MENTOR_PURSE} de oro más.` },
    templo: { id: 'templo', label: 'Amigos en la capilla', describe: 'El templo cobra un 25 % menos por devolver la vida a los vuestros.' },
};

/** Qué oficio da qué: por la clase, sin tildes. */
const CLASS_PERK = [
    { perk: 'templo', words: /clerig|druid|paladin|sacerdot|monj/ },
    { perk: 'bolsa', words: /picaro|bardo|explorador|ladron|erudit|bruj[oa]|hechicer|mag[oa]/ },
    { perk: 'armas', words: /guerrer|barbar|soldad|luchador/ },
];

/** La dote que enseña quien no eligió ninguna de las sueltas, por su oficio. */
const CLASS_LESSON = [
    { perk: 'piel-dura', words: /guerrer|barbar|soldad|paladin|luchador/ },
    { perk: 'paso-de-gato', words: /picaro|ladron|explorador/ },
    { perk: 'labia', words: /bardo|bruj[oa]|hechicer/ },
    { perk: 'buen-ojo', words: /clerig|druid|monj|sacerdot|erudit|mago/ },
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const fold = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} member @returns {string} */
const classOf = (member) => text(member?.charClass ?? member?.class ?? member?.className);

/**
 * @typedef {Object} Mentor
 * @property {string} name
 * @property {string} className
 * @property {number} level
 * @property {string} gender
 * @property {string[]} lessons Las dotes que enseña (ids de `PERKS`).
 * @property {string} perk Lo que da al gremio (`GUILD_PERKS`).
 * @property {number} day El día en que se retiró.
 * @property {string[]} taught A quién ha enseñado ya.
 */

/**
 * Los maestros, leídos con tolerancia.
 *
 * @param {any} raw
 * @returns {Mentor[]}
 */
export function readMentors(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(m => text(m?.name))
        .map(m => ({
            name: text(m.name),
            className: text(m.className),
            level: Math.max(1, Math.floor(Number(m.level) || 1)),
            gender: text(m.gender),
            lessons: (Array.isArray(m.lessons) ? m.lessons : []).map(text).filter(id => PERKS.some(p => p.id === id)),
            perk: text(m.perk) in GUILD_PERKS ? text(m.perk) : 'bolsa',
            day: Math.max(1, Math.floor(Number(m.day) || 1)),
            taught: (Array.isArray(m.taught) ? m.taught : []).map(text).filter(Boolean),
        }));
}

/**
 * Si este héroe puede retirarse ahora, y si no, por qué.
 *
 * @param {any} member
 * @param {{fighting?: boolean, inGuild?: boolean, others?: number}} [where] `others`: los demás
 *   héroes tuyos que esperan en el gremio (no hace falta ninguno: se puede hacer otro).
 * @returns {{ok: boolean, reason: string}}
 */
export function canRetire(member, { fighting = false, inGuild = true } = {}) {
    const name = text(member?.name) || 'Tu personaje';
    if (!member || member.guest) return { ok: false, reason: 'Solo se retiran tus personajes.' };
    if (member.dead) return { ok: false, reason: `${name} ya no está.` };
    if (fighting) return { ok: false, reason: 'No en mitad de un combate.' };
    if (!inGuild) return { ok: false, reason: 'Retirarse se hace en el gremio, en casa.' };
    const level = Math.max(1, Math.floor(Number(member.level) || 1));
    if (level < RETIRE_MIN_LEVEL) {
        return { ok: false, reason: `${name} es de nivel ${level}: para quedarse de maestro hace falta el nivel ${RETIRE_MIN_LEVEL}.` };
    }
    return { ok: true, reason: '' };
}

/**
 * Lo que da al gremio un maestro de este oficio.
 *
 * @param {string} className
 * @returns {string}
 */
export function guildPerkFor(className) {
    const key = fold(className);
    return CLASS_PERK.find(row => row.words.test(key))?.perk ?? 'bolsa';
}

/**
 * Las dotes que enseña: las sueltas que eligió al subir (las de su oficio y su historia no se
 * enseñan); si no eligió ninguna, la de su oficio.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function lessonsOf(member) {
    const own = (Array.isArray(member?.perks) ? member.perks : []).map(text).filter(id => PERKS.some(p => p.id === id));
    if (own.length > 0) return [...new Set(own)];
    const fallback = CLASS_LESSON.find(row => row.words.test(fold(classOf(member))))?.perk ?? 'aguante';
    return [fallback];
}

/**
 * El nivel con el que empieza un héroe nuevo gracias al mejor maestro: uno más por cada cuatro
 * niveles del maestro, hasta el 5.
 *
 * @param {Mentor[]} mentors
 * @returns {number}
 */
export function mentorStartLevel(mentors) {
    const best = Math.max(0, ...readMentors(mentors).map(m => m.level));
    if (best < RETIRE_MIN_LEVEL) return 1;
    return Math.min(MENTOR_MAX_START, 1 + Math.floor(best / 4));
}

/**
 * Los PX con los que empieza un héroe nuevo (los del nivel que le toca).
 *
 * @param {Mentor[]} mentors
 * @param {any} [table]
 * @returns {number}
 */
export function mentorStartXp(mentors, table) {
    const level = mentorStartLevel(mentors);
    return level > 1 ? Math.max(0, Number(xpForLevel(level, table)) || 0) : 0;
}

/**
 * Lo que dan al gremio los maestros, sin repetir.
 *
 * @param {Mentor[]} mentors
 * @returns {Array<{id: string, label: string, describe: string, who: string}>}
 */
export function guildPerks(mentors) {
    /** @type {Map<string, {id: string, label: string, describe: string, who: string}>} */
    const seen = new Map();
    for (const mentor of readMentors(mentors)) {
        if (seen.has(mentor.perk)) continue;
        seen.set(mentor.perk, { ...GUILD_PERKS[mentor.perk], who: mentor.name });
    }
    return [...seen.values()];
}

/**
 * Si los maestros dan esta ventaja.
 *
 * @param {Mentor[]} mentors
 * @param {'armas'|'bolsa'|'templo'} perk
 * @returns {boolean}
 */
export function hasGuildPerk(mentors, perk) {
    return readMentors(mentors).some(m => m.perk === perk);
}

/**
 * Un precio con la rebaja de los maestros, si la hay.
 *
 * @param {number} price
 * @param {Mentor[]} mentors
 * @param {'armas'|'templo'} perk
 * @returns {number}
 */
export function mentorPrice(price, mentors, perk) {
    const base = Math.max(0, Math.floor(Number(price) || 0));
    return hasGuildPerk(mentors, perk) ? Math.round(base * (1 - MENTOR_DISCOUNT)) : base;
}

/**
 * Retirar a un héroe: el maestro que queda, la línea del Salón de la fama y lo que se dice.
 *
 * @param {any} member
 * @param {{mentors?: any, day?: number, world?: string, guild?: string}} [input]
 * @returns {{mentors: Mentor[], mentor: Mentor, hall: {name: string, world: string, day: number, epitaph: string, when: string, kind: 'retired'}, line: string}}
 */
export function retireHero(member, { mentors = [], day = 1, world = '', guild = '' } = {}) {
    const name = text(member?.name) || 'Tu personaje';
    const className = classOf(member);
    const level = Math.max(1, Math.floor(Number(member?.level) || 1));
    const today = Math.max(1, Math.floor(Number(day) || 1));
    /** @type {Mentor} */
    const mentor = {
        name, className, level, gender: text(member?.gender), lessons: lessonsOf(member),
        perk: guildPerkFor(className), day: today, taught: [],
    };
    const others = readMentors(mentors).filter(m => m.name !== name);
    const nick = text(member?.nickname) ? ` «${text(member.nickname)}»` : '';
    const where = text(guild) ? `al gremio de ${text(guild)}` : 'al gremio';
    const lesson = PERKS.find(p => p.id === mentor.lessons[0]);
    const epitaph = `${name}${nick}${className ? `, ${className.toLowerCase()} de nivel ${level}` : ''}, se retiró ${where} el día ${today}. `
        + `Ahora enseña${lesson ? ` «${lesson.label}»` : ''} a los que empiezan.`;
    const perk = GUILD_PERKS[mentor.perk];
    return {
        mentors: [...others, mentor],
        mentor,
        hall: { name, world: text(world), day: today, epitaph, when: new Date().toISOString(), kind: 'retired' },
        line: `${name} se queda en el gremio de ${gendered(member, 'maestro', 'maestra')}. Los nuevos empezarán en el nivel ${mentorStartLevel([...others, mentor])}. ${perk.label}: ${perk.describe}`,
    };
}

/**
 * Las dotes que un héroe nuevo puede aprender de los maestros: una sola, de cualquiera.
 *
 * @param {Mentor[]} mentors
 * @param {any} hero
 * @returns {Array<{mentor: string, gender: string, perk: {id: string, label: string, describe: string}}>}
 */
export function lessonsFor(mentors, hero) {
    const known = new Set((Array.isArray(hero?.perks) ? hero.perks : []).map(String));
    const learnt = readMentors(mentors).some(m => m.taught.includes(text(hero?.name)));
    if (learnt) return [];
    /** @type {Array<{mentor: string, gender: string, perk: {id: string, label: string, describe: string}}>} */
    const out = [];
    for (const mentor of readMentors(mentors)) {
        for (const id of mentor.lessons) {
            const perk = PERKS.find(p => p.id === id);
            if (!perk || known.has(id) || out.some(o => o.perk.id === id)) continue;
            out.push({ mentor: mentor.name, gender: mentor.gender, perk: { id: perk.id, label: perk.label, describe: perk.describe } });
        }
    }
    return out.slice(0, 3);
}

/**
 * Apuntar que un maestro ya enseñó a este héroe (cada nuevo aprende una vez).
 *
 * @param {Mentor[]} mentors
 * @param {string} mentorName
 * @param {string} heroName
 * @returns {Mentor[]}
 */
export function noteTaught(mentors, mentorName, heroName) {
    return readMentors(mentors).map(m => (m.name === text(mentorName) && !m.taught.includes(text(heroName))
        ? { ...m, taught: [...m.taught, text(heroName)] }
        : m));
}

/**
 * La charla de la despedida, con quien lleva el gremio. Sin narrador (D-J60): habla ella, y
 * el héroe contesta eligiendo.
 *
 * @param {Object} input
 * @param {any} input.hero
 * @param {string} [input.master] Quien lleva el gremio («Brunilda»).
 * @returns {import('./meetups.js').Scene}
 */
export function retirementScene({ hero, master = 'Brunilda' }) {
    const name = text(hero?.name) || 'Tu personaje';
    const level = Math.max(1, Math.floor(Number(hero?.level) || 1));
    const start = Math.min(MENTOR_MAX_START, 1 + Math.floor(level / 4));
    const lesson = PERKS.find(p => p.id === lessonsOf(hero)[0]);
    const perk = GUILD_PERKS[guildPerkFor(classOf(hero))];
    const boss = text(master) || 'Brunilda';
    return {
        id: `retiro-${fold(name).replace(/[^a-z0-9]+/g, '-')}`,
        kind: 'charla',
        who: boss,
        key: fold(boss),
        campaign: '',
        rank: 1,
        title: 'Retirarse al gremio',
        where: 'gremio',
        beats: [
            {
                note: '',
                say: `${name}, llevas el nivel ${level} a la espalda y más caminos de los que puedo contar. `
                    + `Aquí hace falta alguien que enseñe a los que empiezan. ¿Te quedas de ${gendered(hero, 'maestro', 'maestra')}?`,
                mood: 'neutral',
                replies: [
                    {
                        text: 'Sí. Me quedo a enseñar.',
                        bond: 0,
                        mood: 'alegre',
                        gold: 0,
                        then: `Pues esta es tu casa. Los nuevos empezarán en el nivel ${start}`
                            + `${lesson ? ` y podrán aprender de ti «${lesson.label}»` : ''}. Y ${perk.describe.charAt(0).toLowerCase()}${perk.describe.slice(1)}`,
                        // @ts-ignore: lo lee `retireChoice`.
                        choice: 'retira',
                    },
                    {
                        text: 'Todavía no. Me queda camino.',
                        bond: 0,
                        mood: 'neutral',
                        gold: 0,
                        then: 'Como quieras. La puerta sigue abierta, y la silla junto al fuego también.',
                        // @ts-ignore: lo lee `retireChoice`.
                        choice: 'sigue',
                    },
                ],
            },
        ],
    };
}

/**
 * Lo que se eligió en la charla.
 *
 * @param {any} scene
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {'retira'|'sigue'}
 */
export function retireChoice(scene, choices) {
    const choice = (Array.isArray(choices) ? choices : [])[0];
    const reply = choice ? scene?.beats?.[choice.beat]?.replies?.[choice.reply] : null;
    return reply?.choice === 'retira' ? 'retira' : 'sigue';
}

/**
 * La charla con el maestro al llegar un héroe nuevo: qué aprende de él. Una respuesta por dote
 * y una para no aprender nada ahora.
 *
 * @param {Object} input
 * @param {any} input.hero El nuevo.
 * @param {Array<{mentor: string, gender?: string, perk: {id: string, label: string, describe: string}}>} input.lessons
 * @param {number} [input.start] El nivel con el que empieza.
 * @returns {import('./meetups.js').Scene|null}
 */
export function lessonScene({ hero, lessons, start = 1 }) {
    const list = Array.isArray(lessons) ? lessons : [];
    if (list.length === 0) return null;
    const mentor = list[0].mentor;
    const teacher = gendered(list[0].gender ?? '', 'el maestro', 'la maestra');
    const name = text(hero?.name) || 'chaval';
    const ahead = start > 1 ? ` Con lo que te enseñemos aquí, empiezas como si llevaras ya el nivel ${start}.` : '';
    return {
        id: `leccion-${fold(name).replace(/[^a-z0-9]+/g, '-')}`,
        kind: 'charla',
        who: mentor,
        key: fold(mentor),
        campaign: '',
        rank: 1,
        title: `Lo que enseña ${teacher}`,
        where: 'gremio',
        beats: [
            {
                note: '',
                say: `Así que tú eres ${name}. Yo fui como tú, hace no tanto.${ahead} Te enseño una cosa, la que quieras. Elige bien: solo una.`,
                mood: 'alegre',
                replies: [
                    ...list.map(one => ({
                        text: `${one.perk.label}: ${one.perk.describe}`,
                        bond: /** @type {0} */ (0),
                        mood: 'alegre',
                        gold: 0,
                        then: `Bien elegido. ${one.perk.label}: practícalo hasta que te salga sin pensar.`,
                        lesson: one.perk.id,
                        mentor: one.mentor,
                    })),
                    { text: 'Ahora no. Ya vendré.', bond: /** @type {0} */ (0), mood: 'neutral', gold: 0, then: 'Aquí estaré. No tardes, que a mi edad se olvida.', lesson: '', mentor: '' },
                ],
            },
        ],
    };
}

/**
 * La dote elegida en la charla del maestro, si se eligió alguna.
 *
 * @param {any} scene
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {{lesson: string, mentor: string}|null}
 */
export function lessonChoice(scene, choices) {
    const choice = (Array.isArray(choices) ? choices : [])[0];
    const reply = choice ? scene?.beats?.[choice.beat]?.replies?.[choice.reply] : null;
    return reply?.lesson ? { lesson: text(reply.lesson), mentor: text(reply.mentor) } : null;
}
