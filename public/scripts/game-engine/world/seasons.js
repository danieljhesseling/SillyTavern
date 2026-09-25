/**
 * Las estaciones: el calendario cambia el mapa y lo que vive en él (ideas 74 y 97).
 *
 * Hasta ahora el año no existía: el día cincuenta era igual que el primero, salvo por las
 * fiestas. Ahora tiene cuatro estaciones de dos meses (56 días), y cada una cambia tres
 * cosas:
 *
 * - **Los caminos**: una ruta puede decir en qué estaciones se pasa (`seasons`). El lago
 *   helado solo se cruza en invierno; el vado, solo cuando el río no baja crecido.
 * - **El tiempo**: en invierno nieva y en verano aprieta el calor. Se quita lo que no toca
 *   y se añade lo que sí, sobre los climas del bioma.
 * - **Los bichos**: los que migran dicen en qué estaciones andan (`seasons`). Fuera de
 *   ellas no salen en los sitios que se descubren ni en los encargos.
 *
 * Lo que no dice nada vale siempre: una ruta o un bicho sin estaciones es de todo el año.
 *
 * Puro: dice qué estación es y qué cambia. Quien llama lo aplica.
 */

/** Lo que dura una estación: dos meses del calendario de la partida. */
export const SEASON_DAYS = 56;

/** El orden del año. */
export const SEASON_ORDER = ['primavera', 'verano', 'otono', 'invierno'];

/** En la que empieza una partida que no dice nada. */
export const DEFAULT_START = 'otono';

/**
 * Cada estación, con lo que le hace al tiempo: lo que añade si el bioma lo admite y lo que
 * quita.
 */
export const SEASONS = {
    primavera: { label: 'Primavera', adds: ['lluvia'], drops: ['nieve', 'bochorno'] },
    verano: { label: 'Verano', adds: ['bochorno'], drops: ['nieve'] },
    otono: { label: 'Otoño', adds: ['niebla'], drops: ['bochorno'] },
    invierno: { label: 'Invierno', adds: ['nieve'], drops: ['bochorno'] },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Una estación escrita a mano («Otoño», «invierno»), o vacío si no lo es.
 *
 * @param {any} value
 * @returns {string}
 */
export function readSeason(value) {
    const id = plain(value);
    return id in SEASONS ? id : '';
}

/**
 * Las estaciones de una ruta o de un bicho: una lista o «invierno, otoño».
 *
 * @param {any} raw
 * @returns {string[]}
 */
export function readSeasons(raw) {
    const list = Array.isArray(raw) ? raw : text(raw).split(/[,;/]| y /);
    return [...new Set(list.map(readSeason).filter(Boolean))];
}

/**
 * La estación de un día.
 *
 * @param {number} day
 * @param {string} [start] La del primer día de la partida.
 * @returns {string}
 */
export function seasonOf(day, start = DEFAULT_START) {
    const first = SEASON_ORDER.indexOf(readSeason(start) || DEFAULT_START);
    const passed = Math.floor((Math.max(1, Math.floor(Number(day) || 1)) - 1) / SEASON_DAYS);
    return SEASON_ORDER[(first + passed) % SEASON_ORDER.length];
}

/**
 * Los días que le quedan a la estación de hoy, contando hoy.
 *
 * @param {number} day
 * @returns {number}
 */
export function daysLeftInSeason(day) {
    const today = Math.max(1, Math.floor(Number(day) || 1));
    return SEASON_DAYS - ((today - 1) % SEASON_DAYS);
}

/**
 * Si algo que dice sus estaciones vale en esta. Lo que no dice ninguna vale siempre.
 *
 * @param {any} seasons
 * @param {string} season
 * @returns {boolean}
 */
export function openInSeason(seasons, season) {
    const list = readSeasons(seasons);
    return list.length === 0 || list.includes(readSeason(season));
}

/**
 * Los climas de un bioma en esta estación.
 *
 * Se quita lo que no toca y se añade lo típico, salvo que choque con el bioma: no nieva
 * donde hace bochorno ni aprieta el calor donde nieva. Y nunca se queda vacío: un bioma
 * que solo tuviera lo que la estación quita se queda como estaba.
 *
 * @param {string[]} climates
 * @param {string} season
 * @returns {string[]}
 */
export function seasonClimates(climates, season) {
    const list = (Array.isArray(climates) ? climates : []).map(plain).filter(Boolean);
    const spec = SEASONS[/** @type {keyof typeof SEASONS} */ (readSeason(season))];
    if (!spec || list.length === 0) return list;
    const clash = /** @type {Record<string, string>} */ ({ nieve: 'bochorno', bochorno: 'nieve' });
    const added = spec.adds.filter(c => !list.includes(c) && !list.includes(clash[c] ?? ''));
    const kept = list.filter(c => !spec.drops.includes(c));
    const out = [...kept, ...added];
    return out.length > 0 ? out : list;
}

/**
 * Cuándo se pasa, dicho para quien juega: «solo en invierno».
 *
 * @param {any} seasons
 * @returns {string}
 */
export function describeSeasons(seasons) {
    const names = readSeasons(seasons).map(id => SEASONS[/** @type {keyof typeof SEASONS} */ (id)].label.toLowerCase());
    if (names.length === 0) return '';
    const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    return `solo en ${joined}`;
}

/**
 * La estación de hoy, para el reloj: «Otoño · quedan 12 días».
 *
 * @param {number} day
 * @param {string} [start]
 * @returns {string}
 */
export function describeSeason(day, start = DEFAULT_START) {
    const season = SEASONS[/** @type {keyof typeof SEASONS} */ (seasonOf(day, start))];
    const left = daysLeftInSeason(day);
    return `${season.label} · ${left === 1 ? 'último día' : `quedan ${left} días`}`;
}
