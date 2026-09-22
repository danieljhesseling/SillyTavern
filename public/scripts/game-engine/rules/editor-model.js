/**
 * The model behind the rules editor: turning a rule pack into something editable, and
 * back, without touching the DOM.
 *
 * The pack is data — that was the whole point of the Fase C extraction — but data shaped
 * for the game, not for a person: tuples, flag objects, nested maps. This module is the
 * translation layer, and it lives apart from the editor so the awkward half can be tested
 * without a browser. The editor above it only draws what this returns.
 *
 * Nothing here writes anything. It returns a new pack and leaves saving to the caller.
 *
 * See wiki/ROADMAP.md, Fase C (C3).
 */

import { getEditableSections } from './ruleset.js';
import { DEFAULT_RULESET } from './default-ruleset.js';

/**
 * What each section is called in the interface, and which ones a player edits first.
 *
 * Data rather than a switch, so adding a section to SECTION_SHAPE and naming it here is
 * the whole job. Anything without a label still appears, under its raw path: an unnamed
 * section is better than a hidden one.
 */
export const SECTION_LABELS = {
    'items.damageTypes': 'Tipos de daño',
    'items.weaponFlags': 'Propiedades de armas',
    'items.armorFlags': 'Propiedades de armaduras',
    'items.gearFlags': 'Propiedades de equipo',
    'items.types': 'Tipos de objeto',
    'items.categories': 'Categorías de objeto',
    'items.categoryOptions': 'Nombres de las categorías',
    'items.rarity': 'Rarezas',
    'items.recharge': 'Recargas',
    'items.magicBonuses': 'Bonos mágicos',
    'items.armorDexModes': 'Uso de Destreza en armaduras',
    'items.armorResistances': 'Resistencias de armadura',
    'items.capacityUnits': 'Unidades de capacidad',
    'items.focusTypes': 'Tipos de foco',
    'items.linkedAbilities': 'Características asociadas',
    'items.subcategoryOptions': 'Subcategorías',
    'items.subcategoryMeta': 'Detalles de subcategoría',
    'character.conditions': 'Estados y condiciones',
    'character.alignments': 'Alineamientos',
    'character.modifiableStats': 'Estadísticas modificables',
    'relationships.categories': 'Categorías de relación',
    'relationships.scoreMin': 'Afinidad mínima',
    'relationships.scoreMax': 'Afinidad máxima',
    'slots': 'Ranuras de equipo',
    'slotInfo': 'Detalle de las ranuras',
    'progression.xpThresholds': 'Experiencia por nivel (nivel → XP)',
    'progression.abilityLevels': 'Niveles con mejora de característica',
};

/** The order the editor offers them in: what you came to change, first. */
const SECTION_ORDER = [
    'items.damageTypes',
    'progression.xpThresholds',
    'items.weaponFlags',
    'items.armorFlags',
    'items.gearFlags',
    'character.conditions',
    'items.rarity',
    'items.types',
    'items.categories',
    'items.categoryOptions',
];

/**
 * Every editable section, named and ordered for a person.
 * @returns {Array<{path: string, kind: string, label: string, group: string}>}
 */
export function listSections() {
    const sections = getEditableSections().map(section => ({
        ...section,
        label: SECTION_LABELS[section.path] || section.path,
        group: section.path.includes('.') ? section.path.split('.')[0] : 'general',
    }));

    return sections.sort((a, b) => {
        const ia = SECTION_ORDER.indexOf(a.path);
        const ib = SECTION_ORDER.indexOf(b.path);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.label.localeCompare(b.label, 'es');
    });
}

/**
 * Reads a value out of a pack by its dotted path.
 * @param {any} pack
 * @param {string} path
 * @returns {any}
 */
export function getSection(pack, path) {
    const value = String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), pack);
    // Null and undefined both mean "not set here"; collapsing them keeps callers from
    // having to check for two kinds of absence.
    return value ?? undefined;
}

/**
 * Returns a copy of the pack with one section replaced.
 *
 * A copy, not a mutation: the editor keeps the saved pack around to compare against and
 * to restore from, and editing in place would quietly destroy both.
 *
 * @param {any} pack
 * @param {string} path
 * @param {any} value
 * @returns {any}
 */
export function setSection(pack, path, value) {
    const keys = String(path).split('.');
    const copy = structuredClone(pack ?? {});

    let node = copy;
    for (const key of keys.slice(0, -1)) {
        if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
    }
    node[keys[keys.length - 1]] = value;

    return copy;
}

/**
 * Turns a section into the rows an editor draws.
 *
 * Every kind becomes the same thing — a list of rows with up to three fields — so the
 * editor has one table to draw instead of five. The shape is carried alongside so it can
 * be rebuilt exactly, which is what stops a round trip through the editor from quietly
 * changing a pack it never touched.
 *
 * @param {any} value
 * @param {string} kind
 * @returns {{rows: Array<{a: string, b: string, c: string, blank?: boolean, extra?: any}>, columns: string[], editable: boolean, raw: string}}
 */
export function toRows(value, kind) {
    switch (kind) {
        case 'string[]':
            return {
                columns: ['Valor'],
                editable: true,
                raw: '',
                // `blank` marks an empty entry that was already there — the "none" option
                // several of these lists begin with. Without it, opening the editor and
                // saving would quietly delete it.
                rows: (Array.isArray(value) ? value : []).map(v => ({
                    a: String(v), b: '', c: '', blank: String(v) === '',
                })),
            };

        case 'pairs':
            return {
                columns: ['Valor interno', 'Nombre visible'],
                editable: true,
                raw: '',
                rows: (Array.isArray(value) ? value : []).map(pair => ({
                    a: String(pair?.[0] ?? ''),
                    b: String(pair?.[1] ?? ''),
                    c: '',
                })),
            };

        case 'flags':
            return {
                columns: ['Clave', 'Nombre visible', 'Descripción'],
                editable: true,
                raw: '',
                // A flag can carry fields this table has no column for, such as the
                // subcategories it applies to. They ride along in `extra` and are put
                // back on save: an editor that drops what it cannot display is worse
                // than no editor.
                rows: (Array.isArray(value) ? value : []).map(flag => {
                    const { key, label, description, ...extra } = (flag && typeof flag === 'object') ? flag : {};
                    return {
                        a: String(key ?? ''),
                        b: String(label ?? ''),
                        c: String(description ?? ''),
                        extra,
                    };
                }),
            };

        case 'number':
            return { columns: ['Número'], editable: true, raw: '', rows: [{ a: String(value ?? 0), b: '', c: '' }] };

        // Nested maps have no honest table form, so they are edited as JSON rather than
        // flattened into something that loses their shape on the way back.
        default:
            return {
                columns: [],
                editable: false,
                raw: JSON.stringify(value ?? {}, null, 2),
                rows: [],
            };
    }
}

/**
 * Rebuilds a section from edited rows.
 *
 * Empty rows are dropped rather than rejected: a table you add a line to before typing in
 * it would otherwise refuse to save while you are still thinking.
 *
 * @param {Array<{a: string, b: string, c: string, blank?: boolean, extra?: any}>} rows
 * @param {string} kind
 * @param {string} [raw]  JSON text, for the kinds edited that way.
 * @returns {{value: any, errors: string[]}}
 */
export function fromRows(rows, kind, raw = '') {
    const clean = (Array.isArray(rows) ? rows : [])
        .map(row => ({
            a: String(row?.a ?? '').trim(),
            b: String(row?.b ?? '').trim(),
            c: String(row?.c ?? '').trim(),
            blank: Boolean(row?.blank),
            extra: (row?.extra && typeof row.extra === 'object') ? row.extra : {},
        }))
        // A row that is empty and was not there before is a line someone started and has
        // not typed into yet; one that was there is the "none" option and stays.
        .filter(row => row.a || row.b || row.c || row.blank);

    switch (kind) {
        case 'string[]': {
            const seen = new Set();
            const errors = [];
            const value = [];
            for (const row of clean) {
                if (!row.a && !row.blank) continue;
                if (seen.has(row.a)) {
                    errors.push(row.a ? `"${row.a}" está repetido.` : 'Solo puede haber una entrada vacía.');
                    continue;
                }
                seen.add(row.a);
                value.push(row.a);
            }
            return { value, errors };
        }

        case 'pairs': {
            // An empty internal value is legitimate here: it is the "none" option every
            // select needs, and the built-in pack ships with one. Only a second empty
            // value is a mistake.
            const errors = [];
            const seen = new Set();
            const value = [];
            for (const row of clean) {
                if (seen.has(row.a)) {
                    errors.push(row.a
                        ? `El valor "${row.a}" está repetido.`
                        : 'Solo puede haber una opción con el valor vacío.');
                    continue;
                }
                seen.add(row.a);
                value.push([row.a, row.b || row.a]);
            }
            return { value, errors };
        }

        case 'flags': {
            const errors = [];
            const seen = new Set();
            const value = [];
            for (const row of clean) {
                if (!row.a) {
                    errors.push(`Falta la clave de "${row.b}".`);
                    continue;
                }
                if (seen.has(row.a)) {
                    errors.push(`La clave "${row.a}" está repetida.`);
                    continue;
                }
                seen.add(row.a);
                const flag = { key: row.a, label: row.b || row.a, ...row.extra };
                if (row.c) flag.description = row.c;
                value.push(flag);
            }
            return { value, errors };
        }

        case 'number': {
            const n = Number(clean[0]?.a);
            if (!Number.isFinite(n)) return { value: 0, errors: ['Tiene que ser un número.'] };
            return { value: n, errors: [] };
        }

        default:
            try {
                const parsed = JSON.parse(raw || '{}');
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    return { value: {}, errors: ['Tiene que ser un objeto JSON.'] };
                }
                return { value: parsed, errors: [] };
            } catch (error) {
                return { value: {}, errors: [`JSON no válido: ${error?.message || error}`] };
            }
    }
}

/**
 * The built-in value of a section, for the "restore" button.
 * @param {string} path
 * @returns {any}
 */
export function defaultSection(path) {
    return structuredClone(getSection(DEFAULT_RULESET, path) ?? null);
}

/**
 * Whether a section differs from the built-in rules, so the editor can mark what you
 * changed. Comparing the values rather than tracking edits means a change made and then
 * undone stops counting, which is what a person means by "changed".
 *
 * @param {any} pack
 * @param {string} path
 * @returns {boolean}
 */
export function isSectionModified(pack, path) {
    return JSON.stringify(getSection(pack, path) ?? null) !== JSON.stringify(defaultSection(path));
}
