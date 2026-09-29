/**
 * El narrador del motor: cada momento del juego contado en prosa, sin gastar un token
 * (Z1 de wiki/ROADMAP_SIN_TOKENS.md).
 *
 * El motor sabe qué pasa en cada momento —a qué sitio llegáis, con qué tiempo, quién hay,
 * cómo acabó una pelea— y hasta ahora solo lo decía en avisos y líneas técnicas: la prosa se
 * la dejaba al modelo, que sin proveedor no llega. Aquí se cuenta con frases escritas como
 * datos (`public/compendio/frases.json`), con huecos que se rellenan con los hechos.
 *
 * Cada momento se compone por partes, en orden: una llegada es cómo llegáis, cómo es el sitio,
 * quién hay y qué os espera. Cada parte es una frase del banco que:
 *
 * - vale para los hechos (su `when`: de noche, con lluvia, la primera vez, la voz de quien
 *   narra…; quien no dice nada, vale);
 * - tiene todos sus huecos rellenos (una frase que pide `{gente}` no sale si no hay nadie);
 * - no ha salido todavía, mientras haya otra; y si ya salieron todas, es de las que salieron
 *   hace más (J13.2: ninguna frase repetida en diez llegadas; lo mide
 *   `tools/variedad-frases.mjs`).
 *
 * Una parte sin frase que valga se salta: un momento sin nada que decir dice menos, no falla.
 *
 * J1.4: las palabras que cambian con el género van con sus dos formas, `{empapados|empapadas}`,
 * y se eligen con `facts.generos` (quién juega: ver `grammar.js`). Sin él, la primera.
 *
 * Puro: el banco y el azar se inyectan.
 */

import { matches, pickWeighted } from '../compendio/compendio.js';
import { resolveGender } from './grammar.js';

/** Las partes de cada momento, en el orden en que se cuentan. */
export const MOMENTS = {
    viaje: ['viaje', 'viaje-sucesos'],
    llegada: ['llegada', 'llegada-descripcion', 'llegada-gente', 'llegada-gancho'],
    tablero: ['tablero', 'tablero-enemigos'],
    'fin-combate': ['fin-combate', 'fin-combate-heridos', 'fin-combate-botin'],
    descanso: ['descanso'],
    muerte: ['muerte'],
    semana: ['semana'],
    acto: ['acto'],
    // Z2: la charla, un momento por respuesta.
    'charla-hilo': ['charla-hilo'],
    'charla-sabe': ['charla-sabe'],
    'charla-no': ['charla-no'],
    'charla-quiere': ['charla-quiere'],
    'charla-vosotros': ['charla-vosotros'],
    'charla-ronda': ['charla-ronda'],
    'charla-ronda-no': ['charla-ronda-no'],
    'charla-amenaza-bien': ['charla-amenaza-bien'],
    'charla-amenaza-mal': ['charla-amenaza-mal'],
    // Z3: lo que pasa tras una tirada, y al entrar en un edificio.
    'tirada-bien': ['tirada-bien'],
    'tirada-medias': ['tirada-medias'],
    'tirada-mal': ['tirada-mal'],
    servicio: ['servicio'],
};

/**
 * Cuántas frases recientes se recuerdan para no repetirlas, cada una una vez. Diez llegadas
 * con su viaje ya son sesenta, y entre medias hay tiradas, charlas y descansos: con dieciséis,
 * la llegada de hace tres viajes ya se había olvidado.
 */
export const RECENT = 200;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Rellenar los huecos de una frase. Si alguno no tiene hecho, la frase no vale: null.
 *
 * Y el género (J1.4): cada `{cansado|cansada}` con la forma de quien juega, que viene en
 * `facts.generos`. Después de rellenar, para que valga también dentro de lo que se rellena.
 *
 * @param {string} template
 * @param {Record<string, any>} facts
 * @returns {string|null}
 */
export function fill(template, facts) {
    let missing = false;
    const out = String(template ?? '').replace(/\{([a-z_]+)\}/g, (all, key) => {
        const value = text(facts?.[key]);
        if (!value) missing = true;
        return value;
    });
    if (missing) return null;
    const clean = resolveGender(out, facts?.generos ?? {}).replace(/\s+/g, ' ').trim();
    return clean ? clean[0].toLocaleUpperCase('es') + clean.slice(1) : null;
}

/**
 * Contar un momento.
 *
 * @param {Object} input
 * @param {any[]} input.rows El banco de frases (las filas de `frases`).
 * @param {string} input.moment Uno de `MOMENTS`.
 * @param {Record<string, any>} input.facts Los hechos: los huecos y las condiciones.
 * @param {() => number} [input.random]
 * @param {string[]} [input.recent] Las frases que acaban de salir.
 * @returns {{text: string, used: string[]}}
 */
export function narrate({ rows, moment, facts, random = Math.random, recent = [] }) {
    const parts = MOMENTS[/** @type {keyof typeof MOMENTS} */ (moment)] ?? [];
    // Cuándo salió cada frase por última vez: cuanto más atrás, mejor.
    /** @type {Map<string, number>} */
    const seen = new Map();
    (Array.isArray(recent) ? recent : []).forEach((id, at) => seen.set(text(id), at));
    /** @type {string[]} */
    const said = [];
    /** @type {string[]} */
    const used = [];
    for (const part of parts) {
        const usable = (Array.isArray(rows) ? rows : [])
            .filter(row => text(row?.kind) === part && matches(row, { ...facts, kind: part }))
            .map(row => ({ row, line: fill(row.text, facts) }))
            .filter(option => option.line !== null);
        if (usable.length === 0) continue;
        const fresh = usable.filter(option => !seen.has(text(option.row.id)));
        const pool = (fresh.length > 0 ? fresh : oldestHalf(usable, seen)).map(option => ({ ...option.row, weight: Math.max(0, Number(option.row.weight ?? 1)), line: option.line }));
        const chosen = pickWeighted(pool, random);
        if (!chosen) continue;
        said.push(chosen.line);
        used.push(text(chosen.id));
    }
    return { text: said.join(' '), used };
}

/**
 * Cuando ya salieron todas las que valen: la mitad que salió hace más. Así la que acaba de
 * salir no vuelve enseguida, y el orden no se repite siempre igual.
 *
 * @template {{row: any}} T
 * @param {T[]} options
 * @param {Map<string, number>} seen
 * @returns {T[]}
 */
function oldestHalf(options, seen) {
    const byAge = [...options].sort((a, b) => (seen.get(text(a.row.id)) ?? -1) - (seen.get(text(b.row.id)) ?? -1));
    return byAge.slice(0, Math.max(1, Math.ceil(byAge.length / 2)));
}

/**
 * Las frases recientes, con las que acaban de salir y sin pasarse de la memoria. Cada una
 * una vez, en el sitio de la última vez que salió.
 *
 * @param {any} before
 * @param {string[]} used
 * @returns {string[]}
 */
export function rememberUsed(before, used) {
    const list = [...(Array.isArray(before) ? before.map(text) : []), ...(used ?? []).map(text)].filter(Boolean);
    const last = new Map(list.map((id, at) => [id, at]));
    return list.filter((id, at) => last.get(id) === at).slice(-RECENT);
}

/**
 * «Giles, Marta y Karl», para el hueco {gente}.
 *
 * @param {string[]} names
 * @returns {string}
 */
export function listNames(names) {
    const list = (names ?? []).map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * «Un día», «Tres días», para el hueco {dias_texto}.
 *
 * @param {number} days
 * @returns {string}
 */
export function daysText(days) {
    const n = Math.max(1, Math.floor(Number(days) || 1));
    const words = ['', 'Un día', 'Dos días', 'Tres días', 'Cuatro días', 'Cinco días', 'Seis días', 'Siete días'];
    return words[n] ?? `${n} días`;
}
