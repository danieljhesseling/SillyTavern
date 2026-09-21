/**
 * Which enemies a board can field, as rows you can edit.
 *
 * The wizard writes these when it creates a campaign and the importer writes them from a
 * book. Changing them afterwards meant opening World Info and editing a list of uids by
 * hand — which is the one thing this project keeps promising you will never have to do.
 *
 * Same translation as everywhere else: the player sees **names**, the engine stores
 * **ids**, and a name nobody knows is reported instead of being saved as an empty rule
 * that would make `/fight` find nothing.
 *
 * Pure. See wiki/ROADMAP.md, Fase B y Fase E · wiki/POR_HACER.md.
 */

/**
 * @typedef {Object} EncounterRow
 * @property {string} name
 * @property {number} minCount
 * @property {number} maxCount
 */

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function count(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read a board's rules for editing, turning ids into names.
 *
 * @param {any[]} rules
 * @param {Record<string, string>} [namesById]
 * @returns {EncounterRow[]}
 */
export function toRows(rules, namesById = {}) {
    const names = new Map(Object.entries(namesById ?? {}).map(([id, name]) => [String(id), String(name)]));

    return (Array.isArray(rules) ? rules : []).filter(Boolean).map(rule => {
        const min = count(rule.minCount, 1);
        const max = count(rule.maxCount, min);
        return {
            name: names.get(String(rule.enemyId)) ?? String(rule.enemyId ?? ''),
            minCount: min,
            maxCount: Math.max(min, max),
        };
    });
}

/**
 * Turn the rows back into rules, resolving names to ids.
 *
 * @param {EncounterRow[]} rows
 * @param {Record<string, string>} [idsByName]
 * @returns {{rules: any[], problems: string[]}}
 */
export function fromRows(rows, idsByName = {}) {
    const ids = new Map(Object.entries(idsByName ?? {}).map(([name, id]) => [name.toLowerCase(), String(id)]));
    /** @type {string[]} */
    const problems = [];
    /** @type {any[]} */
    const rules = [];
    const seen = new Set();

    for (const row of (Array.isArray(rows) ? rows : []).filter(Boolean)) {
        const name = String(row.name ?? '').trim();
        if (!name) {
            problems.push('Hay una regla sin enemigo.');
            continue;
        }

        const enemyId = ids.get(name.toLowerCase());
        if (!enemyId) {
            problems.push(`"${name}" no existe en este mundo.`);
            continue;
        }

        // Two rules for the same creature would roll twice and field more than either
        // line says: whoever wrote them meant one range.
        if (seen.has(enemyId)) {
            problems.push(`"${name}" aparece dos veces: junta las dos en un solo rango.`);
            continue;
        }
        seen.add(enemyId);

        const min = count(row.minCount, 1);
        const max = count(row.maxCount, min);
        if (max < min) {
            problems.push(`En "${name}" el máximo (${max}) es menor que el mínimo (${min}).`);
            continue;
        }

        rules.push({ enemyId, minCount: min, maxCount: max });
    }

    return { rules, problems };
}

/**
 * How the rules read, for the panel and for a log line.
 *
 * @param {EncounterRow[]} rows
 * @returns {string}
 */
export function describeEncounters(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return 'Este tablero no tiene enemigos declarados.';

    return list
        .map(row => (row.minCount === row.maxCount
            ? `${row.name} ×${row.minCount}`
            : `${row.name} ×${row.minCount}–${row.maxCount}`))
        .join(', ');
}
