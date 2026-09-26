/**
 * El compendio, leido del disco y guardado en memoria.
 *
 * `compendio.js` no sabe donde vive la biblioteca: se le pasa un `read`. Aqui esta el
 * unico que sabe que son archivos servidos en `/compendio/`, y por eso es el unico de la
 * carpeta que no se puede probar en Node.
 *
 * Se carga **una vez**. Son unos kilobytes y se consultan en cada generacion: volver a
 * pedirlos en cada tirada seria pagar una peticion por nombre.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md.
 */

import { loadCompendium, createCompendium, DOMAINS } from './compendio.js';

/** @type {{compendium: any, errors: string[], loaded: string[], batteries: any}|null} */
let cached = null;
/** @type {Promise<any>|null} */
let loading = null;

/**
 * Lee una bateria de `/compendio/`. Lo que no este, no esta.
 *
 * Un 404 es una bateria sin escribir, no un fallo: devuelve null y el juego sigue como
 * antes. Es lo que permite ir una bateria por tarde.
 *
 * @param {string} domain
 * @returns {Promise<any|null>}
 */
async function readBattery(domain) {
    const response = await fetch(`/compendio/${domain}.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    return await response.json();
}

/**
 * La biblioteca, cargada una sola vez.
 *
 * Nunca lanza: si el disco falla entero, devuelve una biblioteca vacia y el juego se
 * comporta como el dia antes de que existiera el compendio.
 *
 * @returns {Promise<{compendium: any, errors: string[], loaded: string[], batteries: any}>}
 */
export async function getCompendium() {
    if (cached) return cached;
    // Dos llamadas a la vez comparten la misma carga; si no, la primera partida pide cada
    // archivo dos veces.
    if (!loading) {
        loading = loadCompendium({
            read: readBattery,
            domains: DOMAINS,
            warn: (message) => console.warn(`[compendio] ${message}`),
        }).then((result) => {
            cached = result;
            loading = null;
            if (result.loaded.length > 0) {
                console.log(`[compendio] ${result.loaded.length} baterías: ${result.loaded.join(', ')}`);
            }
            return result;
        }).catch((error) => {
            console.error('[compendio] no se pudo cargar', error);
            cached = {
                compendium: createCompendium({}),
                errors: [String(error?.message || error)], loaded: [], batteries: {},
            };
            loading = null;
            return cached;
        });
    }
    return await loading;
}

/**
 * Una biblioteca recién abierta, con los mismos archivos pero sin memoria.
 *
 * La compartida recuerda lo último que salió, para no repetirlo mientras se juega. Eso está
 * bien para la variedad, pero rompe lo que promete una semilla: generar un mundo con la
 * compartida daba otro mundo según lo que se hubiera generado antes en la pestaña, y un
 * código de mundo (idea 180) no salía igual en casa de otro. Lo que se genera **desde la
 * semilla del mundo** usa esta.
 *
 * @returns {Promise<any>}
 */
export async function freshCompendium() {
    const { batteries } = await getCompendium();
    return createCompendium(batteries ?? {});
}

/** Vuelve a leerlo del disco. Para cuando edites un archivo sin recargar la página. */
export function forgetCompendium() {
    cached = null;
    loading = null;
}
