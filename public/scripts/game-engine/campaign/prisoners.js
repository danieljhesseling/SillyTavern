/**
 * Los prisioneros (idea 7): lo que pasa con quien se rinde.
 *
 * Con la moral (idea 6) hay enemigos que tiran el arma. Antes desaparecían; ahora quedan
 * con el grupo hasta que se decide qué hacer con ellos, y cada salida da algo distinto:
 *
 * - **Interrogar**: cuenta un rumor que no se había oído (lo sabe por ser de allí).
 * - **Entregar**: en un sitio con autoridad (tablón o templo), unas monedas y buena fama con
 *   quien manda allí.
 * - **Soltar**: nada a cambio. A quien busca tranquilidad le parece bien.
 *
 * Puro: la lista y lo que da cada salida.
 */

/** Lo que pagan por entregar a alguien. */
export const BOUNTY = 10;

/** Más prisioneros que esto no se arrastran por el camino. */
export const MAX_PRISONERS = 4;

/**
 * @typedef {Object} Prisoner
 * @property {string} id
 * @property {string} name
 * @property {number} day   Cuándo se rindió.
 * @property {string} place Dónde.
 * @property {boolean} questioned Si ya se le ha sacado lo que sabía.
 */

/**
 * @param {any} raw
 * @returns {Prisoner[]}
 */
export function readPrisoners(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(p => p && String(p.name ?? '').trim())
        .map((p, i) => ({
            id: String(p.id ?? `p${i}`),
            name: String(p.name).trim(),
            day: Math.max(1, Math.floor(Number(p.day) || 1)),
            place: String(p.place ?? ''),
            questioned: Boolean(p.questioned),
        }));
}

/**
 * Los que se acaban de rendir, a la lista. Si no caben, el más antiguo se escapa.
 *
 * @param {any} raw
 * @param {string[]} names
 * @param {{day: number, place: string}} when
 * @returns {Prisoner[]}
 */
export function takePrisoners(raw, names, { day, place }) {
    const list = readPrisoners(raw);
    const stamp = Math.max(1, Math.floor(Number(day) || 1));
    names.forEach((name, i) => {
        if (!String(name).trim()) return;
        list.push({ id: `p${stamp}-${list.length}-${i}`, name: String(name).trim(), day: stamp, place: String(place ?? ''), questioned: false });
    });
    return list.slice(-MAX_PRISONERS);
}

/**
 * Qué se puede hacer con cada uno aquí.
 *
 * @param {any} raw
 * @param {{authority: boolean, fighting?: boolean}} here Si aquí hay a quien entregarlo.
 * @returns {Array<{id: string, label: string, icon: string, command: string}>}
 */
export function prisonerChips(raw, { authority, fighting = false }) {
    if (fighting) return [];
    return readPrisoners(raw).slice(0, 2).flatMap(p => [
        ...(p.questioned ? [] : [{ id: `prisoner:ask:${p.id}`, label: `Interrogar a ${p.name}`, icon: 'fa-comments', command: `/prisionero interrogar ${p.id}` }]),
        ...(authority ? [{ id: `prisoner:give:${p.id}`, label: `Entregar a ${p.name} (${BOUNTY} de oro)`, icon: 'fa-scale-balanced', command: `/prisionero entregar ${p.id}` }] : []),
        { id: `prisoner:free:${p.id}`, label: `Soltar a ${p.name}`, icon: 'fa-door-open', command: `/prisionero soltar ${p.id}` },
    ]);
}

/**
 * Sacar a un prisionero de la lista (entregado o suelto), o marcarlo como interrogado.
 *
 * @param {any} raw
 * @param {string} id
 * @param {'ask'|'give'|'free'} what
 * @returns {{prisoner: Prisoner|null, prisoners: Prisoner[]}}
 */
export function dealWith(raw, id, what) {
    const list = readPrisoners(raw);
    const prisoner = list.find(p => p.id === String(id)) ?? null;
    if (!prisoner) return { prisoner: null, prisoners: list };
    if (what === 'ask') return { prisoner, prisoners: list.map(p => (p.id === prisoner.id ? { ...p, questioned: true } : p)) };
    return { prisoner, prisoners: list.filter(p => p.id !== prisoner.id) };
}
