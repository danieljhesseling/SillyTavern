/**
 * Como le va a cada sitio por lo que hizo (o no hizo) el grupo (idea 85).
 *
 * Cumplir un encargo en un pueblo le da un empujon; dejar que se pase el plazo de uno lo
 * hunde un poco. Y eso **se ve**: con dos empujones abren algo que no tenian (una tienda,
 * una herreria); con dos hundimientos, algo cierra. El mundo recuerda.
 *
 * Puro: devuelve el sitio nuevo y lo que ha cambiado, para contarlo.
 */

/** De -3 a +3: mas alla no cambia nada que se vea. */
export const FORTUNE_LIMIT = 3;

/** A partir de aqui, se abre o se cierra algo. */
export const FORTUNE_STEP = 2;

/** Lo que abre un sitio al que le va bien, por orden. */
const OPENS = ['tienda', 'herreria', 'templo', 'posada'];
/** Lo que cierra uno al que le va mal, por orden. El tablon es lo ultimo que se va. */
const CLOSES = ['tienda', 'templo', 'herreria', 'posada'];

const LABELS = {
    tienda: 'una tienda', herreria: 'una herrería', templo: 'un templo', posada: 'una posada', tablon: 'el tablón',
};

/**
 * @param {any} location
 * @returns {number}
 */
export function fortuneOf(location) {
    const n = Math.round(Number(location?.fortune) || 0);
    return Math.max(-FORTUNE_LIMIT, Math.min(FORTUNE_LIMIT, n));
}

/**
 * Mover la fortuna de un sitio, y abrir o cerrar lo que toque.
 *
 * @param {any} location
 * @param {number} delta +1 al cumplir un encargo alli, -1 al dejarlo caducar.
 * @param {string[]} services Los servicios que tiene ahora (ya resueltos por su tipo).
 * @returns {{location: any, change: string}}
 */
export function shiftFortune(location, delta, services) {
    const before = fortuneOf(location);
    const after = Math.max(-FORTUNE_LIMIT, Math.min(FORTUNE_LIMIT, before + Math.sign(Number(delta) || 0)));
    const next = { ...location, fortune: after };
    const name = String(location?.name ?? 'El sitio');
    let change = '';

    const have = [...services];
    // Solo al cruzar el umbral, no cada vez: un segundo encargo no abre una segunda tienda.
    if (before < FORTUNE_STEP && after >= FORTUNE_STEP) {
        const opens = OPENS.find(s => !have.includes(s));
        if (opens) {
            next.services = [...have, opens];
            change = `A ${name} le va mejor gracias a vosotros: han abierto ${LABELS[/** @type {keyof typeof LABELS} */ (opens)]}.`;
        }
    } else if (before > -FORTUNE_STEP && after <= -FORTUNE_STEP) {
        const closes = CLOSES.find(s => have.includes(s));
        if (closes) {
            next.services = have.filter(s => s !== closes);
            change = `${name} lo está pasando mal desde que nadie les ayudó: ha cerrado ${LABELS[/** @type {keyof typeof LABELS} */ (closes)]}.`;
        }
    }
    return { location: next, change };
}

/**
 * Una linea para la exploracion: como esta el sitio. Vacia si no ha pasado nada.
 *
 * @param {any} location
 * @returns {string}
 */
export function fortuneLine(location) {
    const n = fortuneOf(location);
    if (n >= FORTUNE_STEP) return 'Os deben mucho aquí: se nota en cómo os miran.';
    if (n > 0) return 'Aquí se acuerdan de lo que hicisteis.';
    if (n <= -FORTUNE_STEP) return 'Aquí se acuerdan de que no vinisteis. Mal.';
    if (n < 0) return 'Hay quien os mira de reojo: un encargo de aquí se quedó sin hacer.';
    return '';
}
