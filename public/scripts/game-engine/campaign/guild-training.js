/**
 * Entrenar y subir de nivel en el gremio (J3.5 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Entrenar ya se podía en cualquier sitio, con una parte del día (`day-parts.js`): el héroe
 * ganaba un poco de experiencia. En el patio del gremio se entrena mejor:
 *
 * - **Entrena todo el grupo**, no solo el héroe: quien va contigo y no es de alquiler (los
 *   mercenarios del gremio ya suben con el héroe al salir, `hubRoster`).
 * - **Con quien enseña**: el doble que entrenando solo, y un maestro de armas en casa (idea
 *   37, `guild.js`) suma otro tanto.
 * - **Los que van por detrás aprenden más**: quien está por debajo del más avanzado de tus
 *   personajes (también de los que descansan en el gremio, J1.6) gana el doble. Así un
 *   personaje nuevo alcanza a los demás sin repetir las campañas.
 * - **Se sube de nivel aquí**: quien ya tiene la experiencia sale con su botón «Subir de
 *   nivel», que abre la tarjeta de siempre (`party/level-up.js`).
 *
 * Gasta la parte del día, como entrenar fuera: por la mañana o por la tarde.
 *
 * Y una regla que decide Daniel (`LEVEL_UP_RULES`): si se sube de nivel en cualquier sitio,
 * como hasta ahora, o solo en el gremio.
 *
 * Puro: dice cuánto se gana y quién puede subir. Quien llama suma la experiencia y pasa el reloj.
 */

import { canDo, TRAIN_XP_PER_LEVEL } from './day-parts.js';
import { normalizeCalendar } from './calendar.js';
import { readGuild } from './guild.js';
import { levelForXp, xpForLevel } from '../rules/level-up.js';

/** Lo que multiplica entrenar en el patio del gremio, con quien enseña. */
export const GUILD_TRAINING_FACTOR = 2;

/** Y lo que multiplica, además, a quien va por detrás del más avanzado de los tuyos. */
export const CATCH_UP_FACTOR = 2;

/**
 * Dónde se sube de nivel. Hoy, en cualquier sitio; la otra, solo en el gremio (o donde lo diga
 * la campaña).
 */
export const LEVEL_UP_RULES = {
    anywhere: { label: 'En cualquier sitio', describe: 'Quien tiene la experiencia sube cuando quiere, esté donde esté.' },
    guild: { label: 'En el gremio', describe: 'Se sube de nivel al volver al gremio, entrenando en su patio.' },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const levelOf = (value) => Math.max(1, Math.floor(Number(value?.level) || 1));

/**
 * Quién entrena: los del grupo que están en pie y no son de alquiler.
 *
 * @param {any[]} party
 * @returns {any[]}
 */
export function trainees(party) {
    return (Array.isArray(party) ? party : []).filter(m => m && text(m.name) && !m.dead && !m.guest);
}

/**
 * El nivel del más avanzado de tus personajes: los del grupo y los que descansan en el gremio.
 *
 * @param {any[]} party
 * @param {any[]} [resting]
 * @returns {number}
 */
export function topLevel(party, resting = []) {
    const all = [...trainees(party), ...(Array.isArray(resting) ? resting : []).filter(h => h && !h.dead)];
    return all.reduce((top, member) => Math.max(top, levelOf(member)), 1);
}

/**
 * Cuántos maestros de armas hay en casa (idea 37).
 *
 * @param {any} guild
 * @returns {number}
 */
function mastersOf(guild) {
    return readGuild(guild).staff.filter(person => person.role === 'maestro').length;
}

/**
 * Lo que gana alguien en una sesión de entrenamiento en el gremio.
 *
 * @param {any} member
 * @param {{top: number, masters?: number}} input
 * @returns {{xp: number, catchUp: boolean}}
 */
export function sessionXp(member, { top, masters = 0 }) {
    const level = levelOf(member);
    const catchUp = level < Math.max(1, Math.floor(Number(top) || 1));
    const factor = (GUILD_TRAINING_FACTOR + Math.max(0, Math.floor(Number(masters) || 0))) * (catchUp ? CATCH_UP_FACTOR : 1);
    return { xp: TRAIN_XP_PER_LEVEL * level * factor, catchUp };
}

/**
 * @typedef {Object} TrainingRow
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {number} xp
 * @property {number|null} nextAt La experiencia del nivel siguiente, o null en el último.
 * @property {number} toNext Lo que le falta (0 si ya puede subir).
 * @property {boolean} canLevel Si ya tiene la experiencia para subir.
 * @property {number} gain Lo que ganaría entrenando ahora.
 * @property {boolean} catchUp Si va por detrás y aprende el doble.
 * @property {string} note En una línea, para su fila.
 */

/**
 * El patio del gremio: quién entrena, cuánto ganaría cada uno, quién puede subir de nivel ya y
 * si ahora se puede entrenar.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any[]} [input.resting] Tus personajes que descansan en el gremio (`hubHeroes`).
 * @param {any} [input.guild]
 * @param {any} input.calendar
 * @param {any} [input.xpTable]
 * @param {boolean} [input.fighting]
 * @returns {{can: {enabled: boolean, why: string}, slot: string, top: number, masters: number,
 *   rows: TrainingRow[], resting: Array<{name: string, level: number, note: string}>}}
 */
export function trainingView({ party, resting = [], guild = null, calendar, xpTable = null, fighting = false }) {
    const top = topLevel(party, resting);
    const masters = mastersOf(guild);
    const c = normalizeCalendar(calendar);
    const can = canDo('entrenar', { calendar: c, fighting });
    const rows = trainees(party).map(member => {
        const level = levelOf(member);
        const xp = Math.max(0, Math.floor(Number(member.xp) || 0));
        const nextAt = xpForLevel(level + 1, xpTable);
        const canLevel = levelForXp(xp, xpTable) > level;
        const { xp: gain, catchUp } = sessionXp(member, { top, masters });
        const toNext = nextAt === null ? 0 : Math.max(0, nextAt - xp);
        const note = canLevel ? 'Ya tiene la experiencia: puede subir de nivel.'
            : nextAt === null ? 'Ya no hay más niveles.'
                : `Nivel ${level}. Le faltan ${toNext} de experiencia para el ${level + 1}.${catchUp ? ' Va por detrás de los tuyos: aprende el doble.' : ''}`;
        return { id: text(member.id), name: text(member.name), level, xp, nextAt, toNext, canLevel, gain, catchUp, note };
    });
    const restingRows = (Array.isArray(resting) ? resting : []).filter(h => h && text(h.name) && !h.dead).map(hero => ({
        name: text(hero.name),
        level: levelOf(hero),
        note: `Descansa en el gremio. Nivel ${levelOf(hero)}.`,
    }));
    return { can, slot: c.slots[c.slotIndex].label, top, masters, rows, resting: restingRows };
}

/**
 * Una sesión de entrenamiento en el patio: lo que gana cada uno y lo que se cuenta.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any[]} [input.resting]
 * @param {any} [input.guild]
 * @param {any} input.calendar
 * @param {any} [input.xpTable]
 * @param {boolean} [input.fighting]
 * @param {string} [input.trainer] Quien enseña, por su nombre: «Brunilda».
 * @returns {{ok: boolean, reason: string, gains: Array<{id: string, name: string, xp: number}>, ready: string[], line: string}}
 */
export function trainSession({ party, resting = [], guild = null, calendar, xpTable = null, fighting = false, trainer = '' }) {
    const view = trainingView({ party, resting, guild, calendar, xpTable, fighting });
    if (!view.can.enabled) return { ok: false, reason: view.can.why, gains: [], ready: [], line: '' };
    if (view.rows.length === 0) return { ok: false, reason: 'No hay nadie del grupo que pueda entrenar.', gains: [], ready: [], line: '' };
    const gains = view.rows.map(row => ({ id: row.id, name: row.name, xp: row.gain }));
    const ready = view.rows.filter(row => row.nextAt !== null && row.xp + row.gain >= row.nextAt && !row.canLevel).map(row => row.name);
    const who = text(trainer);
    const when = text(view.slot).toLowerCase();
    const list = gains.map(g => `${g.name} +${g.xp}`).join(', ');
    const line = [
        `${who ? `Con ${who}, e` : 'E'}ntrenáis toda la ${when || 'mañana'} en el patio del gremio: ${list} de experiencia.`,
        ready.length === 1 ? `${ready[0]} ya puede subir de nivel.` : '',
        ready.length > 1 ? `Ya pueden subir de nivel: ${ready.join(', ')}.` : '',
    ].filter(Boolean).join(' ');
    return { ok: true, reason: '', gains, ready, line };
}

/**
 * Si alguien puede subir de nivel donde está, con la regla elegida.
 *
 * @param {Object} input
 * @param {string} [input.rule] Una de `LEVEL_UP_RULES`; sin ella, en cualquier sitio.
 * @param {boolean} input.inGuild Si está en el gremio.
 * @returns {{ok: boolean, why: string}}
 */
export function levelUpAllowed({ rule = 'anywhere', inGuild }) {
    if (text(rule) !== 'guild' || inGuild) return { ok: true, why: '' };
    return { ok: false, why: 'Se sube de nivel en el gremio: vuelve y entrena en su patio.' };
}
