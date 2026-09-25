/**
 * La gente se muda o muere por lo que pasa en el mundo (idea 87).
 *
 * Las facciones ya tomaban sitios y acababan unas con otras, pero la gente de esos sitios
 * seguía detrás del mostrador como si nada. Ahora no:
 *
 * - Cuando una facción **toma** un sitio, a alguno de los de allí le cuesta la vida y otro
 *   se marcha al sitio de al lado.
 * - Cuando una facción **cae**, lo mismo con la gente de su casa.
 * - Y de vez en cuando, sin guerra de por medio, alguien se va a vivir a otro sitio.
 *
 * Nunca a quien el hilo necesita: una historia que se queda sin su testigo porque el azar
 * lo mudó no es un mundo vivo, es un hilo roto.
 *
 * Puro: con la semilla del mundo, dice quién se va y quién muere. Quien llama lo apunta en
 * el mundo y lo cuenta como noticia.
 */

/** Lo que puede pasarle a cada uno. `scale` lo multiplica todo. */
export const FATE_CHANCE = { die: 0.25, move: 0.35, drift: 0.1, scale: 1 };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {{name: string, kind: 'muere'|'se-muda', from: string, to: string, why: string}} Fate
 */

/**
 * Los sitios de al lado de cada sitio, por sus rutas, en las dos direcciones.
 *
 * @param {any[]} locations
 * @returns {Record<string, string[]>}
 */
export function neighboursOf(locations) {
    /** @type {Record<string, Set<string>>} */
    const map = {};
    for (const location of Array.isArray(locations) ? locations : []) {
        const from = text(location?.name);
        if (!from) continue;
        for (const route of Array.isArray(location?.routes) ? location.routes : []) {
            const to = text(route?.to);
            if (!to || route?.closed) continue;
            (map[from] ??= new Set()).add(to);
            (map[to] ??= new Set()).add(from);
        }
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]));
}

/**
 * @param {() => number} random
 * @param {string[]} list
 * @returns {string}
 */
function pick(random, list) {
    return list.length > 0 ? list[Math.floor(random() * list.length) % list.length] : '';
}

/**
 * Lo que le pasa a la gente de un sitio cuando lo toman o cae su facción.
 *
 * @param {Object} input
 * @param {Array<{name: string, where: string}>} input.npcs
 * @param {string} input.place Donde ha pasado.
 * @param {string} input.cause Lo que ha pasado, para contarlo: «cuando La Casa Keller tomó El Peaje».
 * @param {Record<string, string[]>} input.neighbours
 * @param {string[]} [input.keep] Los que el hilo necesita.
 * @param {() => number} input.random
 * @returns {Fate[]}
 */
export function fateAt({ npcs, place, cause, neighbours, keep = [], random }) {
    const here = text(place);
    const spared = new Set((keep || []).map(n => text(n).toLowerCase()));
    const scale = Math.max(0, Number(FATE_CHANCE.scale) || 0);
    /** @type {Fate[]} */
    const out = [];
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        if (text(npc?.where) !== here || spared.has(text(npc?.name).toLowerCase())) continue;
        const roll = random();
        if (roll < FATE_CHANCE.die * scale) {
            out.push({ name: text(npc.name), kind: 'muere', from: here, to: '', why: text(cause) });
            continue;
        }
        if (roll < (FATE_CHANCE.die + FATE_CHANCE.move) * scale) {
            const to = pick(random, neighbours[here] ?? []);
            if (to) out.push({ name: text(npc.name), kind: 'se-muda', from: here, to, why: text(cause) });
        }
    }
    return out;
}

/**
 * Sin guerra de por medio: de vez en cuando alguien se va a vivir a otro sitio. Uno como
 * mucho cada vez.
 *
 * @param {Object} input
 * @param {Array<{name: string, where: string}>} input.npcs
 * @param {Record<string, string[]>} input.neighbours
 * @param {string[]} [input.keep]
 * @param {() => number} input.random
 * @returns {Fate|null}
 */
export function driftOf({ npcs, neighbours, keep = [], random }) {
    if (!(random() < FATE_CHANCE.drift * Math.max(0, Number(FATE_CHANCE.scale) || 0))) return null;
    const spared = new Set((keep || []).map(n => text(n).toLowerCase()));
    const movable = (Array.isArray(npcs) ? npcs : [])
        .filter(n => text(n?.where) && !spared.has(text(n?.name).toLowerCase()) && (neighbours[text(n.where)] ?? []).length > 0);
    const npc = movable.length > 0 ? movable[Math.floor(random() * movable.length) % movable.length] : null;
    if (!npc) return null;
    const to = pick(random, neighbours[text(npc.where)] ?? []);
    return to ? { name: text(npc.name), kind: 'se-muda', from: text(npc.where), to, why: '' } : null;
}

/**
 * La noticia, como la cuenta la gente.
 *
 * @param {Fate} fate
 * @returns {string}
 */
export function describeFate(fate) {
    const why = fate.why ? ` ${fate.why}` : '';
    return fate.kind === 'muere'
        ? `Dicen que ${fate.name} murió en ${fate.from}${why}.`
        : `${fate.name} se ha ido de ${fate.from}${why}: ahora vive en ${fate.to}.`;
}
