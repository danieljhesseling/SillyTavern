/**
 * Lo que pasa después de una tirada, sin modelo (Z3 de wiki/ROADMAP_SIN_TOKENS.md).
 *
 * Con modelo, la tirada se le deja escrita y él cuenta la consecuencia. Sin él, se quedaba
 * en «éxito» o «fallo» y ya está. Aquí cada resultado **hace algo** en lo que ya existe:
 * una pista del caso, un rumor, unas monedas, algo de comer, un rato perdido, una herida,
 * cómo os mira alguien, lo que sabe o lo que busca.
 *
 * Tres resultados, como en los juegos de rol de ahora:
 *
 * - **bien**: sale;
 * - **a medias**: sale, pero se paga (se falla por tres o menos, sin sacar un 1);
 * - **mal**: no sale, y a veces también se paga.
 *
 * Una tirada a medias **no cuenta** como buena para el hilo ni para los encargos: lo que
 * da es lo de la tabla, no el hito.
 *
 * Lo que se gana con suerte (oro, comida) se gana una vez por sitio, día y habilidad:
 * tirar veinte veces no da veinte bolsas. Eso lo decide quien llama, con `can`.
 *
 * Puro: de la tirada y de lo que hay aquí, a la lista de efectos. Los aplica quien llama.
 */

/** Cuánto se puede fallar y que salga a medias. */
export const PARTIAL_MARGIN = 3;

/**
 * Bien, a medias o mal.
 *
 * @param {{success: boolean, total: number, dc: number, natural: number}} roll
 * @returns {'bien'|'medias'|'mal'}
 */
export function outcomeOf(roll) {
    if (roll?.success) return 'bien';
    if (Number(roll?.natural) === 1) return 'mal';
    return Number(roll?.total) >= Number(roll?.dc) - PARTIAL_MARGIN ? 'medias' : 'mal';
}

/**
 * Qué hace cada resultado de cada habilidad. Cada entrada es un efecto; con `|`, el
 * primero que se pueda (si no hay pista que encontrar, un rumor; si no, unas monedas).
 *
 * Los efectos:
 * - `pista`: una pista del caso de aquí;
 * - `rumor`: algo que se cuenta aquí;
 * - `oro:1d4`: unas monedas;
 * - `comida`: se pasa el hambre;
 * - `hora`: se va un rato del día;
 * - `herida:1d4`: se hace daño quien lo intenta (nunca por debajo de 1);
 * - `mirada:+1` / `mirada:-1`: cómo os mira con quien se habla;
 * - `sabe`: lo que sabe con quien se habla;
 * - `busca`: lo que de verdad busca con quien se habla.
 *
 * @type {Record<string, {bien: string[], medias: string[], mal: string[]}>}
 */
export const CONSEQUENCES = {
    perception: { bien: ['pista|rumor|oro:1d4'], medias: ['pista|rumor|oro:1d2', 'hora'], mal: ['hora'] },
    investigation: { bien: ['pista|oro:1d6|rumor'], medias: ['pista|oro:1d3', 'hora'], mal: ['hora'] },
    survival: { bien: ['pista|comida'], medias: ['comida', 'hora'], mal: ['hora'] },
    athletics: { bien: ['pista|oro:1d4'], medias: ['pista|oro:1d2', 'herida:1'], mal: ['herida:1d4'] },
    sleight: { bien: ['oro:1d6'], medias: ['oro:1d3', 'mirada:-1'], mal: ['mirada:-1|hora'] },
    stealth: { bien: ['pista|rumor'], medias: ['hora'], mal: ['mirada:-1|herida:1d4'] },
    insight: { bien: ['busca|pista'], medias: ['hora'], mal: ['mirada:-1'] },
    persuasion: { bien: ['mirada:+1'], medias: ['hora'], mal: ['mirada:-1'] },
    deception: { bien: ['sabe|rumor'], medias: ['hora'], mal: ['mirada:-1'] },
    intimidation: { bien: ['sabe', 'mirada:-1'], medias: ['mirada:-1'], mal: ['mirada:-1'] },
};

/**
 * @typedef {Object} Effect
 * @property {string} kind `pista`, `rumor`, `oro`, `comida`, `hora`, `herida`, `mirada`, `sabe` o `busca`.
 * @property {string} [amount] La fórmula (`1d4`) o el cambio (`+1`).
 */

/**
 * Los efectos de una tirada.
 *
 * @param {Object} input
 * @param {string} input.skill
 * @param {'bien'|'medias'|'mal'} input.outcome
 * @param {Record<string, boolean>} [input.can] Lo que se puede aquí: `pista`, `rumor`, `oro`, `comida`,
 *   `mirada` (hay con quien se habla), `sabe` y `busca`. Lo que no se dice, se puede; salvo
 *   `mirada`, `sabe` y `busca`, que piden a alguien delante.
 * @returns {Effect[]}
 */
export function consequence({ skill, outcome, can = {} }) {
    const row = CONSEQUENCES[skill];
    if (!row) return [];
    const needsSomeone = ['mirada', 'sabe', 'busca'];
    const allowed = (/** @type {string} */ kind) => (needsSomeone.includes(kind) ? can[kind] === true : can[kind] !== false);
    /** @type {Effect[]} */
    const out = [];
    for (const slot of row[outcome] ?? []) {
        const pick = slot.split('|').map(option => {
            const [kind, amount] = option.split(':');
            return { kind, ...(amount ? { amount } : {}) };
        }).find(option => allowed(option.kind));
        if (pick) out.push(pick);
    }
    return out;
}
