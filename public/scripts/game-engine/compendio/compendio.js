/**
 * La biblioteca de contenido, y de donde sacan los generadores.
 *
 * Un archivo por dominio en `public/compendio/`: armas, habilidades, bichos, gente,
 * nombres. Se cargan una vez, se validan y se indexan, y a partir de ahi sortear una fila
 * es una linea. La alternativa —contenido escrito dentro del codigo— es la razon por la
 * que dos partidas de la misma idea salian identicas.
 *
 * Tres cosas que no son negociables, y las tres estan aqui porque sin ellas el compendio
 * no se puede llevar:
 *
 * 1. **Se valida al cargar y se dice donde.** El dolor de una biblioteca no es que sea
 *    lenta: es una errata que hace que no salga nada y no sepas por que. Los errores
 *    llevan el archivo y el numero de fila, que es lo unico que sirve para arreglarlos.
 * 2. **Falta un archivo y no pasa nada.** Sin `armas.json` el botin funciona como siempre.
 *    Es lo que permite anadir una bateria por tarde en vez de todas de golpe.
 * 3. **Se sortea con la semilla de la campana**, no con `Math.random`. Y sacando sin
 *    reposicion, que es lo que evita cinco espadas cortas seguidas.
 *
 * Puro salvo la lectura, que se inyecta: en el navegador es un `fetch`, en los tests es
 * un objeto. El modulo no sabe donde vive.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md y wiki/ALGORITMOS_GENERACION.md (#196, #198, #199).
 */

/** Las doce baterias, en el orden en que el roadmap las cuenta. */
export const DOMAINS = [
    'nombres', 'materiales', 'propiedades', 'habilidades',
    'bestiario', 'personas', 'sitios', 'misiones', 'facciones', 'mundo', 'estados',
];

/** Cuantas filas recientes se recuerdan por dominio, para no repetir. */
export const RECENT_MEMORY = 4;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Lo que impide que una bateria se pueda usar.
 *
 * Se devuelven **todos** los problemas, no el primero: se arreglan en una pasada, que es
 * como se arregla un archivo de cincuenta filas. Y cada uno lleva el numero de fila,
 * contando desde 1 porque es lo que ensena un editor de texto.
 *
 * @param {string} domain
 * @param {any} data Lo que hubiera en el archivo.
 * @returns {string[]}
 */
export function validateBattery(domain, data) {
    const file = `${domain}.json`;
    /** @type {string[]} */
    const errors = [];

    if (!data || typeof data !== 'object') {
        return [`${file}: no es un objeto JSON.`];
    }
    if (!Array.isArray(data.rows)) {
        return [`${file}: falta la lista "rows".`];
    }
    if (text(data.domain) && text(data.domain) !== domain) {
        errors.push(`${file}: dice ser de "${text(data.domain)}" y esta guardado como "${domain}".`);
    }

    const seen = new Set();
    data.rows.forEach((/** @type {any} */ row, /** @type {number} */ index) => {
        const where = `${file}, fila ${index + 1}`;

        if (!row || typeof row !== 'object') {
            errors.push(`${where}: no es un objeto.`);
            return;
        }

        const id = text(row.id);
        if (!id) errors.push(`${where}: falta "id", que es como se la referencia.`);
        else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
            errors.push(`${where}: el id "${id}" tiene que ir en minusculas y con guiones.`);
        } else if (seen.has(id)) {
            errors.push(`${where}: el id "${id}" ya estaba usado mas arriba.`);
        } else seen.add(id);

        if (!text(row.name)) errors.push(`${where}: falta "name", que es lo que se ve.`);

        if (row.tags !== undefined && !Array.isArray(row.tags)) {
            errors.push(`${where}: "tags" tiene que ser una lista.`);
        }
        if (row.weight !== undefined && !Number.isFinite(Number(row.weight))) {
            errors.push(`${where}: "weight" tiene que ser un numero.`);
        } else if (Number(row.weight) < 0) {
            errors.push(`${where}: "weight" no puede ser negativo. Cero significa "nunca sola".`);
        }
        if (row.when !== undefined && (!row.when || typeof row.when !== 'object' || Array.isArray(row.when))) {
            errors.push(`${where}: "when" tiene que ser un objeto de filtros.`);
        }
    });

    return errors;
}

/**
 * Normaliza una fila para que el resto del modulo no tenga que preguntar.
 *
 * @param {any} row
 * @returns {any}
 */
function readRow(row) {
    return {
        ...row,
        id: text(row?.id),
        name: text(row?.name),
        tags: (Array.isArray(row?.tags) ? row.tags : []).map(text).filter(Boolean),
        weight: Math.max(0, number(row?.weight, 1)),
        when: (row?.when && typeof row.when === 'object' && !Array.isArray(row.when)) ? row.when : {},
    };
}

/**
 * Si una fila sirve para lo que se esta pidiendo.
 *
 * Dos reglas, y las dos existen para que escribir una fila sea corto:
 *
 * - **`when` solo lleva lo que la fila no diga ya.** Una fila con `kind: "person"`
 *   se filtra por eso sin repetirlo dentro de `when`. Escribir dos veces lo mismo es
 *   como se escriben archivos que se contradicen a si mismos.
 * - **Quien no dice nada, vale.** Una fila sin region sale en cualquier region. Lo
 *   contrario obligaria a listar todas las regiones en todas las filas, y entonces
 *   nadie escribiria filas.
 *
 * @param {any} row
 * @param {Record<string, any>} where
 * @returns {boolean}
 */
export function matches(row, where) {
    for (const [key, wanted] of Object.entries(where ?? {})) {
        if (wanted === undefined || wanted === null || wanted === '') continue;

        const rule = row?.when?.[key] ?? row?.[key];
        if (rule === undefined || rule === null) continue;
        if (rule === '*') continue;

        if (Array.isArray(rule)) {
            // Dos numeros son un rango —niveles 1 a 5— y cualquier otra lista es un
            // conjunto. Se distingue por lo que se pregunta, que es lo unico que lo sabe.
            if (typeof wanted === 'number' && rule.length === 2
                && rule.every(v => Number.isFinite(Number(v)))) {
                if (wanted < Number(rule[0]) || wanted > Number(rule[1])) return false;
                continue;
            }
            if (rule.includes('*')) continue;
            if (!rule.map(text).includes(text(wanted))) return false;
            continue;
        }

        if (text(rule) !== text(wanted)) return false;
    }

    return true;
}

/**
 * Saca una fila de una lista, por peso.
 *
 * @param {any[]} rows
 * @param {() => number} random
 * @returns {any|null}
 */
export function pickWeighted(rows, random) {
    const usable = rows.filter(row => row.weight > 0);
    if (usable.length === 0) return null;

    const total = usable.reduce((sum, row) => sum + row.weight, 0);
    let ticket = random() * total;
    for (const row of usable) {
        ticket -= row.weight;
        if (ticket < 0) return row;
    }
    return usable[usable.length - 1];
}

/**
 * La biblioteca ya cargada, con lo que hace falta para sacar cosas de ella.
 *
 * @param {Record<string, any[]>} batteries Filas por dominio. Lo que falte, falta.
 * @param {{memory?: number}} [config]
 */
export function createCompendium(batteries, config = {}) {
    const remembered = Math.max(0, number(config.memory, RECENT_MEMORY));

    /** @type {Map<string, any[]>} */
    const rows = new Map();
    /** @type {Map<string, Map<string, any>>} */
    const index = new Map();
    for (const [domain, list] of Object.entries(batteries ?? {})) {
        const normalised = (Array.isArray(list) ? list : []).map(readRow);
        rows.set(domain, normalised);
        index.set(domain, new Map(normalised.map(row => [row.id, row])));
    }

    /** Lo ultimo que salio de cada dominio, para no repetirlo mientras haya de donde. */
    /** @type {Map<string, string[]>} */
    const recent = new Map();

    /**
     * @param {string} domain
     * @param {string} id
     */
    const remember = (domain, id) => {
        if (remembered === 0 || !id) return;
        const list = recent.get(domain) ?? [];
        list.push(id);
        while (list.length > remembered) list.shift();
        recent.set(domain, list);
    };

    /**
     * Las filas de un dominio que valen para lo que se pide.
     *
     * @param {string} domain
     * @param {Record<string, any>} [where]
     * @returns {any[]}
     */
    const find = (domain, where = {}) =>
        (rows.get(domain) ?? []).filter(row => matches(row, where));

    return {
        /** Si esa bateria llego a cargarse. */
        has: (/** @type {string} */ domain) => rows.has(domain),

        /** Cuantas filas tiene, o cero si no esta. */
        count: (/** @type {string} */ domain) => (rows.get(domain) ?? []).length,

        /** Las baterias que no estan, que es lo que falta por escribir. */
        missing: (/** @type {string[]} */ domains = DOMAINS) => domains.filter(d => !rows.has(d)),

        find,

        byId: (/** @type {string} */ domain, /** @type {string} */ id) =>
            index.get(domain)?.get(text(id)) ?? null,

        /**
         * Una fila, por peso, evitando lo que acaba de salir.
         *
         * Devuelve null cuando no hay nada que sirva, y quien llama **tiene que**
         * aguantarlo: esa es la regla que permite que falte una bateria entera.
         *
         * @param {string} domain
         * @param {{where?: Record<string, any>, random?: () => number}} [options]
         * @returns {any|null}
         */
        pick(domain, options = {}) {
            const random = options.random ?? Math.random;
            const candidates = find(domain, options.where ?? {});
            if (candidates.length === 0) return null;

            // Se apartan las ultimas que salieron. Si con eso no queda ninguna, es que el
            // dominio es mas corto que la memoria: entonces manda tener algo.
            const skip = new Set(recent.get(domain) ?? []);
            const fresh = candidates.filter(row => !skip.has(row.id));
            const chosen = pickWeighted(fresh.length > 0 ? fresh : candidates, random);

            if (chosen) remember(domain, chosen.id);
            return chosen;
        },

        /**
         * Varias, sin repetir ninguna. Una bolsa, no cinco tiradas.
         *
         * @param {string} domain
         * @param {number} howMany
         * @param {{where?: Record<string, any>, random?: () => number}} [options]
         * @returns {any[]}
         */
        take(domain, howMany, options = {}) {
            const random = options.random ?? Math.random;
            const bag = find(domain, options.where ?? {}).filter(row => row.weight > 0);
            /** @type {any[]} */
            const out = [];

            for (let i = 0; i < howMany && bag.length > 0; i++) {
                const chosen = pickWeighted(bag, random);
                if (!chosen) break;
                out.push(chosen);
                bag.splice(bag.indexOf(chosen), 1);
                remember(domain, chosen.id);
            }

            return out;
        },

        /** Olvida lo reciente. Para las pruebas y para el boton de probar de la pantalla. */
        forget: () => recent.clear(),
    };
}

/**
 * Carga las baterias que existan.
 *
 * `read` devuelve lo que haya en un archivo, o null si no esta. En el navegador es un
 * `fetch`; en los tests, un objeto. Lo que no cargue **no es un error**: es una bateria
 * que todavia no has escrito, y el juego tiene que seguir funcionando igual.
 *
 * @param {Object} input
 * @param {(domain: string) => Promise<any|null>} input.read
 * @param {string[]} [input.domains]
 * @param {(message: string) => void} [input.warn] Donde van los problemas de validacion.
 * @returns {Promise<{compendium: ReturnType<typeof createCompendium>, errors: string[], loaded: string[]}>}
 */
export async function loadCompendium({ read, domains = DOMAINS, warn = null }) {
    /** @type {Record<string, any[]>} */
    const batteries = {};
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const loaded = [];

    for (const domain of domains) {
        let data = null;
        try {
            data = await read(domain);
        } catch (error) {
            // Una bateria que no esta no es un fallo; una que esta y revienta, si.
            errors.push(`${domain}.json: no se pudo leer (${String(error?.message || error)}).`);
            continue;
        }
        if (!data) continue;

        const problems = validateBattery(domain, data);
        if (problems.length > 0) {
            errors.push(...problems);
            // Una bateria rota no entra a medias: entrar a medias es como sale un mundo
            // con la mitad de las armas y nadie sabe por que.
            continue;
        }

        batteries[domain] = data.rows;
        loaded.push(domain);
    }

    if (warn) for (const message of errors) warn(message);

    return { compendium: createCompendium(batteries), errors, loaded };
}
