/**
 * Cómo sale cada persona en pantalla ahora (J13.7 de wiki/ROADMAP_SIN_CONEXION.md): su nombre
 * si se ha presentado, y si no, lo que es («Posadero», «el posadero»).
 *
 * Las ventanas (la escena del hilo, la charla, la quedada, el pueblo, el Diario) no saben de la
 * partida: piden aquí el nombre que enseñan y cuentan aquí lo que se ha leído. Quien juega
 * (`party/known-people.js`) pone la fuente al arrancar: da, en cada momento, quien lleva la
 * cuenta (`createNamer` de `campaign/known-people.js`) con lo sabido de la partida abierta.
 *
 * Sin fuente (las pruebas, una ventana suelta), cada uno sale con su nombre, como siempre. Si
 * la fuente falla, también: un nombre de más es mejor que una pantalla rota.
 */

/** @typedef {import('../campaign/known-people.js').Namer} Namer */

/** @type {(() => Namer|null)|null} */
let source = null;

/**
 * Poner (o quitar, con null) de dónde sale quien lleva la cuenta.
 *
 * @param {(() => Namer|null)|null} next
 */
export function setNamesSource(next) {
    source = typeof next === 'function' ? next : null;
}

/** @returns {Namer|null} */
function namer() {
    if (!source) return null;
    try {
        return source() ?? null;
    } catch (error) {
        console.error('[nombres] no se pudo saber a quién conoces', error);
        return null;
    }
}

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Cómo sale alguien: en la placa («Posadero»), dentro de una frase («el posadero») o al
 * empezarla («El posadero»).
 *
 * @param {any} who
 * @param {'placa'|'el'|'El'|'un'} [form]
 * @returns {string}
 */
export function shownName(who, form = 'placa') {
    const said = text(who);
    if (!said) return said;
    try {
        return namer()?.name(said, form) || said;
    } catch {
        return said;
    }
}

/**
 * Un texto escrito para enseñarse: sus `{npc:…}` resueltos y, si se pide (`mask`), los nombres
 * que aún no se saben cambiados por lo que es cada uno.
 *
 * @param {any} said
 * @param {{mask?: boolean}} [input]
 * @returns {string}
 */
export function shownText(said, { mask = false } = {}) {
    const source = String(said ?? '');
    const now = namer();
    // Sin partida, el id escrito como nombre: `{npc:tomas}` es «Tomas».
    if (!now) {
        return source.replace(/\{(?:npc|persona):([^{}|:]+?)(?::[a-z]+)?\}/g, (_, ref) => String(ref).trim().split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
    }
    try {
        const resolved = now.text(source);
        return mask ? now.mask(resolved) : resolved;
    } catch {
        return source;
    }
}

/**
 * Lo escrito dentro de algo ya dibujado (el libro del Diario, la crónica), con cada nombre que
 * aún no se sabe cambiado por lo que es. Solo cambia el texto que se lee: los datos no se tocan.
 *
 * @param {Node|null} root
 */
export function maskShown(root) {
    const now = namer();
    if (!now || !root || typeof document === 'undefined') return;
    try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        /** @type {Text[]} */
        const nodes = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(/** @type {Text} */ (node));
        for (const node of nodes) {
            const before = node.nodeValue ?? '';
            if (!before.trim()) continue;
            const after = now.mask(now.text(before));
            if (after !== before) node.nodeValue = after;
        }
    } catch (error) {
        console.error('[nombres] no se pudo repasar lo escrito', error);
    }
}

/**
 * Lo que se acaba de leer en pantalla: quien se presenta, a quién nombran. Lo que dice quien
 * juega no se pasa aquí.
 *
 * @param {import('../campaign/known-people.js').HeardLine} line
 * @returns {Array<{name: string, how: string}>} A quién se acaba de conocer.
 */
export function hearLine(line) {
    try {
        return namer()?.hear(line) ?? [];
    } catch {
        return [];
    }
}

/**
 * Apuntar a mano que ya se sabe cómo se llama alguien: después de una charla de verdad
 * (`charla`), o porque se ha leído en un cartel (`escrito`).
 *
 * @param {any} who
 * @param {string} [how]
 * @returns {boolean} Si no se sabía.
 */
export function meetPerson(who, how = 'charla') {
    try {
        return namer()?.meet(who, how) ?? false;
    } catch {
        return false;
    }
}

/**
 * La línea con la que se presenta alguien que aún no se conoce, al hablar con él la primera vez:
 * «Soy Ramiro, el herrero.». Vacío si ya se le conoce, o si no es de la gente del mundo.
 *
 * @param {any} who
 * @returns {string}
 */
export function introFor(who) {
    try {
        return namer()?.intro(who) ?? '';
    } catch {
        return '';
    }
}

/**
 * Si ya se sabe cómo se llama alguien (quien no es de la gente del mundo, sí).
 *
 * @param {any} who
 * @returns {boolean}
 */
export function knowsName(who) {
    try {
        return namer()?.knows(who) ?? true;
    } catch {
        return true;
    }
}
