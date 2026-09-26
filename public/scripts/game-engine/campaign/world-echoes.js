/**
 * El mundo que responde: lo que hacéis deja huella (R9 del roadmap de profundidad).
 *
 * Todo lo anterior pasa, y el mundo tiene que notarlo:
 *
 * - **Los rumores cuentan lo que hicisteis.** Hasta ahora los rumores eran los del guion.
 *   Ahora, un caso resuelto, una némesis que vuelve, un despacho que sale mal o un jefe que
 *   cae se cuentan en las tabernas, con la voz de quien lo ha oído de segunda mano.
 * - **La memoria del narrador lee de la crónica** (lo que quedó de U4): lo último que pasó
 *   de verdad, contado por el motor, en vez de hechos sueltos. Tres líneas, y en modo ahorro
 *   ninguna.
 * - **Las facciones reaccionan**: resolver un caso en su tierra les gusta; un crimen o la
 *   nigromancia, no. (Cuánto lo dice `reactionTo`; lo mueve `changeStanding`.)
 *
 * Puro: de la crónica a rumores, memoria y reputación. Quien llama guarda.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R9.
 */

/**
 * Qué se cuenta de cada clase de suceso. `{t}` es el texto de la crónica, recortado; `{s}`,
 * su primera frase, en minúscula, para decirla de segunda mano.
 * Lo que no está aquí no se cuenta: una tirada o una compra no son noticia.
 */
export const ECHOES = [
    { tag: 'CASO', match: /^Fue /, say: 'Dicen que unos forasteros han resuelto un caso: {s}' },
    { tag: 'CASO', match: /no era|equivoc/i, say: 'Se comenta que acusaron a quien no era. {t}' },
    { tag: 'MUERTE', match: /./, say: 'Se habla de una muerte: {t}' },
    { tag: 'GUARDIAS', match: /nigromancia/i, say: 'Andan diciendo que unos forasteros usan artes de muertos.' },
    { tag: 'GUARDIAS', match: /./, say: 'La guardia busca a unos forasteros. {t}' },
    { tag: 'VILLANO', match: /./, say: 'Corre la voz: {t}' },
    { tag: 'NEMESIS', match: /./, say: 'Hay alguien con una cicatriz que pregunta por vosotros.' },
    { tag: 'MUNDO', match: /./, say: 'Se oye por los caminos: {t}' },
];

/** Cuánto sube o baja la reputación con quien manda donde pasa algo. */
export const REACTIONS = {
    'caso-acierto': 1,
    'caso-fallo': -1,
    crimen: -1,
    nigromancia: -1,
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Recortar a una frase corta, sin romper palabras.
 *
 * @param {string} said
 * @param {number} [max]
 * @returns {string}
 */
function trim(said, max = 90) {
    const clean = text(said).replace(/\s+/g, ' ').replace(/\.$/, '');
    return clean.length > max ? `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : clean;
}

/**
 * Los rumores que nacen de la partida, de la crónica (lo más reciente primero, sin repetir).
 *
 * @param {Array<{tag: string, text: string, index?: number}>} chronicle
 * @param {Object} [options]
 * @param {number} [options.max]
 * @param {string[]} [options.told] Los que ya se contaron, para no repetirlos.
 * @returns {Array<{id: string, text: string}>}
 */
export function rumorsFromPlay(chronicle, { max = 3, told = [] } = {}) {
    const seen = new Set((Array.isArray(told) ? told : []).map(String));
    /** @type {Array<{id: string, text: string}>} */
    const out = [];
    for (const entry of [...(Array.isArray(chronicle) ? chronicle : [])].reverse()) {
        if (out.length >= max) break;
        const echo = ECHOES.find(e => e.tag === entry.tag && e.match.test(entry.text));
        if (!echo) continue;
        const first = trim(text(entry.text).split(/(?<=\.)\s/)[0]).replace(/^./, c => c.toLowerCase());
        const said = echo.say.replace('{t}', trim(entry.text)).replace('{s}', first);
        const id = `eco:${entry.tag}:${said.slice(0, 40)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ id, text: said.endsWith('.') || said.endsWith('…') ? said : `${said}.` });
    }
    return out;
}

/**
 * Lo último que pasó de verdad, para la memoria del narrador: tres líneas de lo que mueve
 * la historia (el hilo, el grupo, el mundo), no de lo menor.
 *
 * @param {Array<{category: string, text: string}>} chronicle
 * @param {number} [max]
 * @returns {string} Vacío si no hay nada.
 */
export function chronicleMemory(chronicle, max = 3) {
    const major = (Array.isArray(chronicle) ? chronicle : []).filter(e => ['hilo', 'grupo', 'mundo'].includes(e.category));
    const last = major.slice(-max).map(e => trim(e.text, 140));
    return last.length > 0 ? `Lo último que pasó: ${last.join(' · ')}.` : '';
}

/**
 * Cuánto cambia la reputación con quien manda donde pasa algo. Lo aplica `changeStanding`
 * (`factions.js`), el mismo que usan los encargos: una sola forma de mover lo que piensan.
 *
 * @param {string} what Una clave de `REACTIONS`.
 * @returns {number}
 */
export function reactionTo(what) {
    return /** @type {Record<string, number>} */ (REACTIONS)[String(what)] ?? 0;
}
