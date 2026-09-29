/**
 * El género gramatical del texto del motor: «cansado» o «cansada» (J1.4 y J13.3 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Al crear el personaje se dice cómo se presenta (`GENDERS` en `hero.js`), y hasta ahora
 * eso no cambiaba ni una letra: una heroína subía de la bodega «entero» y llegaba a los
 * sitios «empapado». Aquí se arregla sin barras ni arrobas a la vista: quien escribe las
 * frases pone las dos formas entre llaves y el motor elige la que toca.
 *
 * Cómo se escribe (en `frases.json`, en los sucesos, en el guion de una campaña):
 *
 * - `{cansado|cansada}`: concuerda con tu héroe.
 * - En plural, `{empapados|empapadas}`: con el grupo. Si son todas mujeres, la segunda; si
 *   no, la primera, como se dice en castellano. Se nota en que las dos formas acaban en -s.
 * - Una tercera forma, si se quiere, para quien es no binario o no dice su género:
 *   `{cansado|cansada|sin fuerzas}`. Sin ella sale la primera.
 * - Para que concuerde con otra persona de la frase, su hueco delante:
 *   `{quien:seguro|segura}`, `{companero:callado|callada}`. Y `heroe:` o `grupo:` para decirlo
 *   a mano cuando el plural engaña: `{heroe:de los nuestros|de las nuestras}`.
 *
 * Nunca se ve una llave: sin saber el género sale la primera forma (o la tercera, si la hay).
 * Los huecos de siempre (`{sitio}`) no llevan barra y no se tocan.
 *
 * Puro: de un texto y de quién juega, a un texto.
 */

/** Los géneros que distingue el texto. Vacío: no se sabe. */
export const GENDER = { F: 'f', M: 'm', N: 'n' };

/**
 * Una marca: `{forma|forma}` o `{forma|forma|forma}`, con un hueco delante si concuerda con
 * otra persona (`{quien:forma|forma}`). Las formas no llevan llaves ni barras.
 */
const MARK = /\{(?:([a-z_]+):)?([^{}|]*)\|([^{}|]*)(?:\|([^{}|]*))?\}/g;

/** Lo que queda de una marca mal escrita: llaves con una barra dentro, o sin cerrar. */
const LEFTOVER = /\{[^{}]*\|[^{}]*(?:\}|$)/g;

/**
 * Los apaños de siempre, que no deben quedar en ningún texto: «cansado/a», «todos/as»,
 * «cansado(a)», «tod@s», «todxs», «todes».
 */
const HACKS = [
    /[a-záéíóúñ](?:o|os|e|es)\/(?:a|as)\b/giu,
    /[a-záéíóúñ]\((?:a|as|o|os|e|es)\)/giu,
    /[a-záéíóúñ]@(?=s\b|\s|$|[.,;:!?»)])/giu,
    /\b(?:tod|nosotr|vosotr|otr|amig|compañer|chic|niñ)(?:x|xs|e|es)\b/giu,
    /\{(?:o|a)\/(?:o|a)\}/giu,
];

/**
 * @param {any} value
 * @returns {string}
 */
function plain(value) {
    return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * El género de alguien, o de lo que se eligió al crearlo: «Mujer» es `f`, «Hombre» es `m`,
 * «No binario» es `n`. «Sin especificar», vacío o algo que no se entiende: vacío.
 *
 * Vale el texto libre de siempre (`femenino`, `ella`, `f`…) y también una ficha con `gender`.
 *
 * @param {any} value
 * @returns {string}
 */
export function genderOf(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return genderOf(value.gender ?? value.genero);
    const said = plain(value);
    if (/^(f|fem|femenin[oa]|mujer|chica|ella|dama|hembra)$/.test(said)) return GENDER.F;
    if (/^(m|masc|masculin[oa]|hombre|chico|el|varon|macho)$/.test(said)) return GENDER.M;
    if (/^(n|nb|neutr[oae]|no[ -]?binari[oae]|elle)$/.test(said)) return GENDER.N;
    return '';
}

/**
 * El género de un grupo, para el plural. Todas mujeres: `f`. Con algún hombre: `m`, que es
 * como concuerda el castellano. Todos no binarios: `n`. Lo demás (con alguien de quien no
 * se sabe): vacío, y sale la forma de siempre.
 *
 * @param {any} list Géneros o fichas.
 * @returns {string}
 */
export function groupGender(list) {
    const all = (Array.isArray(list) ? list : [list]).map(genderOf);
    if (all.length === 0) return '';
    if (all.every(g => g === GENDER.F)) return GENDER.F;
    if (all.some(g => g === GENDER.M)) return GENDER.M;
    if (all.every(g => g === GENDER.N)) return GENDER.N;
    return '';
}

/**
 * La forma que toca. Sin género (o no binario) y sin tercera forma, la primera.
 *
 * @param {string} gender
 * @param {string} masc
 * @param {string} fem
 * @param {string} [other]
 * @returns {string}
 */
function formFor(gender, masc, fem, other) {
    if (gender === GENDER.F) return fem;
    if (gender === GENDER.M) return masc;
    return other ?? masc;
}

/**
 * La palabra de alguien, desde el código: `gendered(member, 'herido', 'herida')`.
 *
 * @param {any} person Una ficha o un género.
 * @param {string} masc
 * @param {string} fem
 * @param {string} [other] Para quien es no binario o no lo dice.
 * @returns {string}
 */
export function gendered(person, masc, fem, other) {
    return formFor(genderOf(person), masc, fem, other);
}

/**
 * @typedef {Object} Who Quién juega, para concordar.
 * @property {any} [heroe] Tu héroe (su género o su ficha).
 * @property {any[]} [grupo] El grupo: sus géneros o sus fichas. Sin él, el héroe solo.
 */

/**
 * El grupo de `who`, o el héroe solo si no se dice.
 *
 * @param {Who & Record<string, any>} who
 * @returns {string}
 */
function groupOf(who) {
    const list = who?.grupo == null || (Array.isArray(who.grupo) && who.grupo.length === 0) ? [who?.heroe] : [who.grupo].flat();
    return groupGender(list);
}

/**
 * Cambiar cada marca por la forma que toca.
 *
 * @param {any} text
 * @param {Who & Record<string, any>} [who] Tu héroe, el grupo y, por el nombre de su hueco
 *   (`quien`, `companero`…), las demás personas de la frase.
 * @returns {string}
 */
export function resolveGender(text, who = {}) {
    const said = String(text ?? '');
    if (!said.includes('|')) return said;
    return said.replace(MARK, (all, key, masc, fem, other) => {
        const plural = /s$/i.test(masc.trim()) && /s$/i.test(fem.trim());
        const gender = key === 'grupo' ? groupOf(who)
            : key ? genderOf(who?.[key])
                : plural ? groupOf(who) : genderOf(who?.heroe);
        return formFor(gender, masc, fem, other);
    });
}

/**
 * Lo mismo por dentro de un objeto (el hilo de una campaña, con sus escenas y pistas): una
 * copia con cada texto resuelto.
 *
 * @template T
 * @param {T} value
 * @param {Who & Record<string, any>} [who]
 * @returns {T}
 */
export function resolveGenderDeep(value, who = {}) {
    if (typeof value === 'string') return /** @type {any} */ (resolveGender(value, who));
    if (Array.isArray(value)) return /** @type {any} */ (value.map(item => resolveGenderDeep(item, who)));
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return /** @type {any} */ (Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveGenderDeep(item, who)])));
    }
    return value;
}

/**
 * Las marcas mal escritas de un texto: lo que quedaría a la vista después de resolverlo
 * (cuatro formas, una llave sin cerrar, llaves dentro de llaves…). Vacío si está bien.
 *
 * @param {any} text
 * @returns {string[]}
 */
export function leftoverMarkers(text) {
    return [...resolveGender(text, {}).matchAll(LEFTOVER)].map(m => m[0]);
}

/**
 * Los apaños de género de un texto («cansado/a», «tod@s»…), para no dejar ninguno.
 *
 * @param {any} text
 * @returns {string[]}
 */
export function genderHacks(text) {
    const said = String(text ?? '');
    return HACKS.flatMap(pattern => [...said.matchAll(pattern)].map(m => m[0]));
}
