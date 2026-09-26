/**
 * El diario de sesión: en qué se ha ido esta sesión de juego (U0 del pegamento).
 *
 * El medidor del prompt dice lo que cuesta **un turno**. Para decidir qué construir hace
 * falta saber lo que cuesta **una sesión** y en qué se fue: cuántos minutos en cada escena,
 * cuántos mensajes al narrador y cuántas acciones con botón. Si una hora de juego son
 * treinta mensajes escritos a mano y diez botones, el juego se está jugando en el chat, y
 * eso es lo caro.
 *
 * No manda nada a ningún sitio y no cuesta tokens: vive en este navegador, en esta pestaña.
 *
 * Puro: cuenta y describe. Quien llama guarda y enseña.
 *
 * Ver wiki/ROADMAP_PEGAMENTO.md, U0.
 */

/** Cómo se dice cada escena del juego. Lo que no está aquí es «fuera del juego». */
export const SCENE_LABELS = {
    dialogue: 'hablando',
    exploration: 'en el sitio',
    combat: 'combatiendo',
    title: 'en el menú',
    out: 'fuera del juego',
};

/**
 * @typedef {Object} SessionLog
 * @property {number} startedAt Cuándo empezó, en milisegundos.
 * @property {string} scene La escena de ahora.
 * @property {number} since Desde cuándo se está en ella.
 * @property {Record<string, number>} spent Milisegundos por escena, sin contar la de ahora.
 * @property {number} sent Mensajes mandados al narrador.
 * @property {number} clicks Acciones pulsadas en el juego.
 */

/** @param {any} value @returns {number} */
const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Una sesión que empieza ahora.
 *
 * @param {number} now
 * @param {string} [scene]
 * @returns {SessionLog}
 */
export function startSession(now, scene = 'out') {
    const at = count(now);
    return { startedAt: at, scene: text(scene) || 'out', since: at, spent: {}, sent: 0, clicks: 0 };
}

/** @param {any} value @returns {string} */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Lo que había guardado, o una sesión nueva si no hay nada o no se entiende.
 *
 * @param {any} raw
 * @param {number} now
 * @returns {SessionLog}
 */
export function readSession(raw, now) {
    if (!raw || typeof raw !== 'object' || !(Number(raw.startedAt) > 0)) return startSession(now);
    /** @type {Record<string, number>} */
    const spent = {};
    for (const [scene, ms] of Object.entries(raw.spent && typeof raw.spent === 'object' ? raw.spent : {})) {
        if (count(ms) > 0) spent[scene] = count(ms);
    }
    const startedAt = count(raw.startedAt);
    return {
        startedAt,
        scene: text(raw.scene) || 'out',
        // Un reloj que va hacia atrás (otro equipo, la hora cambiada) no resta minutos.
        since: Math.min(count(now), Math.max(startedAt, count(raw.since))),
        spent,
        sent: count(raw.sent),
        clicks: count(raw.clicks),
    };
}

/**
 * Pasar a otra escena: lo que se estuvo en la anterior se apunta.
 *
 * @param {SessionLog} log
 * @param {string} scene
 * @param {number} now
 * @returns {SessionLog}
 */
export function enterScene(log, scene, now) {
    const next = text(scene) || 'out';
    if (next === log.scene) return log;
    const at = Math.max(count(now), log.since);
    return {
        ...log,
        scene: next,
        since: at,
        spent: { ...log.spent, [log.scene]: (log.spent[log.scene] ?? 0) + (at - log.since) },
    };
}

/**
 * Un mensaje al narrador.
 *
 * @param {SessionLog} log
 * @returns {SessionLog}
 */
export function noteSent(log) {
    return { ...log, sent: log.sent + 1 };
}

/**
 * Una acción pulsada.
 *
 * @param {SessionLog} log
 * @returns {SessionLog}
 */
export function noteClick(log) {
    return { ...log, clicks: log.clicks + 1 };
}

/**
 * Los minutos por escena hasta ahora, contando la de ahora. Los de fuera del juego no.
 *
 * @param {SessionLog} log
 * @param {number} now
 * @returns {Array<{scene: string, label: string, minutes: number}>}
 */
export function minutesByScene(log, now) {
    const spent = { ...log.spent, [log.scene]: (log.spent[log.scene] ?? 0) + Math.max(0, count(now) - log.since) };
    return Object.entries(spent)
        .filter(([scene]) => scene !== 'out')
        .map(([scene, ms]) => ({ scene, label: SCENE_LABELS[/** @type {keyof typeof SCENE_LABELS} */ (scene)] ?? scene, minutes: Math.round(ms / 60000) }))
        .filter(row => row.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
}

/**
 * La sesión en unas líneas, para la pausa.
 *
 * @param {SessionLog} log
 * @param {number} now
 * @param {{turns?: number, promptTokens?: number}|null} [cost] Lo que midió el medidor del prompt.
 * @returns {string[]}
 */
export function describeSession(log, now, cost = null) {
    const rows = minutesByScene(log, now);
    const total = rows.reduce((sum, row) => sum + row.minutes, 0);
    const lines = [];
    lines.push(total > 0
        ? `Llevas ${total} ${total === 1 ? 'minuto' : 'minutos'} jugando: ${rows.map(row => `${row.label} ${row.minutes}`).join(' · ')}.`
        : 'Acabas de empezar: aún no hay minutos que contar.');

    const turns = count(cost?.turns);
    const tokens = count(cost?.promptTokens);
    const k = (/** @type {number} */ n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
    lines.push(`Al narrador: ${log.sent} ${log.sent === 1 ? 'mensaje' : 'mensajes'} · ${turns} ${turns === 1 ? 'llamada' : 'llamadas'}${tokens > 0 ? ` (≈${k(tokens)} tokens enviados)` : ''}.`);
    lines.push(`Con botón: ${log.clicks} ${log.clicks === 1 ? 'acción' : 'acciones'}.`);
    if (turns > 0 && total > 0) {
        const every = total / turns;
        lines.push(every >= 1
            ? `Una llamada cada ${Math.round(every)} ${Math.round(every) === 1 ? 'minuto' : 'minutos'} de juego.`
            : `Más de una llamada por minuto de juego (${turns} en ${total}).`);
    }
    return lines;
}
