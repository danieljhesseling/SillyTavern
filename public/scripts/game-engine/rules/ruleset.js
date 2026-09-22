/**
 * Rule packs: the content the engine plays with, as data rather than code.
 *
 * Before this existed, adding a damage type or a weapon property meant editing
 * dnd-system.js. Twenty-five tables lived there as constants, which made the editor the
 * user asked for impossible: you cannot offer a form for something that is a `const`.
 *
 * A pack is plain JSON. It can come from the default, from a campaign, or from a file
 * somebody shared. Anything loaded from outside is merged onto the default rather than
 * replacing it, so a pack that only wants to add two damage types does not have to restate
 * the whole of D&D 5e — and a malformed pack degrades to the default instead of leaving the
 * game with no conditions at all.
 *
 * Pure module.
 *
 * See wiki/ROADMAP.md, Fase C (C1, C2, C4).
 */

import { DEFAULT_RULESET, RULESET_SCHEMA_VERSION } from './default-ruleset.js';

export { RULESET_SCHEMA_VERSION };

/**
 * @typedef {Object} Ruleset
 * @property {number} version
 * @property {string} id
 * @property {string} name
 * @property {Record<string, string>} slots
 * @property {Record<string, {label: string, icon: string}>} slotInfo
 * @property {{categories: string[], scoreMin: number, scoreMax: number}} relationships
 * @property {Object} items
 * @property {{alignments: string[], conditions: string[], modifiableStats: string[]}} character
 * @property {{xpThresholds: string[][], abilityLevels: string[]}} [progression] Lo que cuesta cada nivel.
 * @property {any[]} [abilities] Conjuros, tecnicas y recursos de clase.
 */

/**
 * Shape of a valid pack, as a description rather than a schema library.
 *
 * Keeping it as data means the validator, the editor and the documentation all read from
 * the same place, and adding a section is one entry rather than three edits.
 */
const SECTION_SHAPE = {
    'slots': 'object',
    'slotInfo': 'object',
    'relationships.categories': 'string[]',
    'relationships.scoreMin': 'number',
    'relationships.scoreMax': 'number',
    'items.types': 'string[]',
    'items.categories': 'string[]',
    'items.categoryOptions': 'pairs',
    'items.subcategoryOptions': 'object',
    'items.subcategoryMeta': 'object',
    'items.rarity': 'string[]',
    'items.recharge': 'string[]',
    'items.capacityUnits': 'string[]',
    'items.focusTypes': 'string[]',
    'items.armorDexModes': 'pairs',
    'items.damageTypes': 'pairs',
    'items.armorResistances': 'string[]',
    'items.magicBonuses': 'pairs',
    'items.weaponFlags': 'flags',
    'items.armorFlags': 'flags',
    'items.gearFlags': 'flags',
    'items.linkedAbilities': 'pairs',
    'character.alignments': 'string[]',
    'character.conditions': 'string[]',
    'character.modifiableStats': 'string[]',
    'progression.xpThresholds': 'pairs',
    'progression.abilityLevels': 'string[]',
    // Una habilidad tiene demasiados campos para una tabla de dos columnas: en `/rules` se
    // edita como JSON, y en `/habilidades` tiene su propio panel con un campo por cosa.
    'abilities': 'list',
};

/**
 * @param {any} source
 * @param {string} path
 * @returns {any}
 */
function at(source, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), source);
}

/**
 * @param {any} value
 * @param {string} kind
 * @returns {boolean}
 */
function matchesKind(value, kind) {
    switch (kind) {
        case 'object':
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'string[]':
            return Array.isArray(value) && value.every(v => typeof v === 'string');
        case 'pairs':
            // [value, label] tuples, as every select in the UI expects.
            return Array.isArray(value)
                && value.every(v => Array.isArray(v) && v.length >= 2 && typeof v[0] === 'string');
        case 'flags':
            return Array.isArray(value) && value.every(v => v && typeof v === 'object' && typeof v.key === 'string');
        case 'list':
            return Array.isArray(value) && value.every(v => v && typeof v === 'object' && !Array.isArray(v));
        default:
            return false;
    }
}

/**
 * Checks a pack without changing it.
 *
 * Returns every problem rather than the first, because someone fixing a hand-written pack
 * wants the whole list, not one error per attempt.
 *
 * @param {any} pack
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateRuleset(pack) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];

    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
        return { valid: false, errors: ['El paquete de reglas no es un objeto.'], warnings };
    }

    if (typeof pack.id !== 'string' || !pack.id.trim()) errors.push('Falta "id".');
    if (typeof pack.name !== 'string' || !pack.name.trim()) errors.push('Falta "name".');

    if (pack.version != null && !Number.isInteger(pack.version)) {
        errors.push('"version" debe ser un entero.');
    }
    if (Number.isInteger(pack.version) && pack.version > RULESET_SCHEMA_VERSION) {
        warnings.push(`El paquete declara la versión ${pack.version} y el motor entiende hasta la ${RULESET_SCHEMA_VERSION}.`);
    }

    for (const [path, kind] of Object.entries(SECTION_SHAPE)) {
        const value = at(pack, path);
        if (value === undefined) continue; // ausente es legítimo: se hereda del paquete por defecto
        if (!matchesKind(value, kind)) {
            errors.push(`"${path}" debería ser ${kind}.`);
        }
    }

    // Coherencia interna: una subcategoría sin metadatos rompe el formulario de objetos.
    const subOptions = at(pack, 'items.subcategoryOptions');
    const subMeta = at(pack, 'items.subcategoryMeta') ?? DEFAULT_RULESET.items.subcategoryMeta;
    if (matchesKind(subOptions, 'object')) {
        for (const [category, options] of Object.entries(subOptions)) {
            if (!Array.isArray(options)) continue;
            for (const option of options) {
                const key = Array.isArray(option) ? option[0] : null;
                if (key && !(key in subMeta)) {
                    warnings.push(`La subcategoría "${key}" (${category}) no tiene entrada en subcategoryMeta.`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Merges a partial pack onto a base, one section deep.
 *
 * Deliberately shallow per section: a pack that supplies `items.damageTypes` replaces that
 * list outright rather than having its entries interleaved with the default ones. Merging
 * lists element by element produces results nobody asked for and cannot be undone from the
 * editor.
 *
 * @param {Ruleset} base
 * @param {any} overrides
 * @returns {Ruleset}
 */
export function mergeRuleset(base, overrides) {
    if (!overrides || typeof overrides !== 'object') return base;

    /** @type {any} */
    const merged = { ...base };

    for (const key of ['id', 'name', 'version']) {
        if (overrides[key] !== undefined) merged[key] = overrides[key];
    }

    for (const section of ['slots', 'slotInfo', 'relationships', 'items', 'character']) {
        if (overrides[section] === undefined) continue;
        const incoming = overrides[section];
        merged[section] = (incoming && typeof incoming === 'object' && !Array.isArray(incoming))
            ? { ...base[section], ...incoming }
            : incoming;
    }

    return merged;
}

/**
 * Brings an older pack up to the current shape.
 *
 * There is only one version so far, so this is a pass-through — but it exists now so that
 * the first real migration has somewhere to go, and so saved campaigns carry a version
 * number from the start rather than being guessed at later.
 *
 * @param {any} pack
 * @returns {any}
 */
export function migrateRuleset(pack) {
    if (!pack || typeof pack !== 'object') return pack;
    const version = Number.isInteger(pack.version) ? pack.version : 0;

    let migrated = { ...pack };

    // v0 -> v1: packs written before versioning existed.
    if (version < 1) {
        migrated = { ...migrated, version: 1 };
    }

    return migrated;
}

/**
 * Resolves a pack for use: migrate, validate, then merge onto the default.
 *
 * A pack with errors is refused and the default is used, because half a rule pack is worse
 * than none — a missing conditions list would silently empty every character sheet.
 *
 * @param {any} pack
 * @returns {{ruleset: Ruleset, errors: string[], warnings: string[], usedDefault: boolean}}
 */
export function resolveRuleset(pack) {
    if (pack === null || pack === undefined) {
        return { ruleset: DEFAULT_RULESET, errors: [], warnings: [], usedDefault: true };
    }

    const migrated = migrateRuleset(pack);
    const { valid, errors, warnings } = validateRuleset(migrated);

    if (!valid) {
        return { ruleset: DEFAULT_RULESET, errors, warnings, usedDefault: true };
    }

    return { ruleset: mergeRuleset(DEFAULT_RULESET, migrated), errors, warnings, usedDefault: false };
}

/** @type {Ruleset} */
let activeRuleset = DEFAULT_RULESET;

/**
 * The pack currently in force.
 * @returns {Ruleset}
 */
export function getActiveRuleset() {
    return activeRuleset;
}

/**
 * Installs a pack.
 *
 * dnd-system.js binds its exports at load, so a change here only reaches the game after a
 * reload. That is stated rather than worked around: the alternative is turning fifty plain
 * imports into accessor calls, which buys live switching nobody needs in a single-player
 * game.
 *
 * @param {any} pack
 * @returns {{ruleset: Ruleset, errors: string[], warnings: string[], usedDefault: boolean}}
 */
export function setActiveRuleset(pack) {
    const result = resolveRuleset(pack);
    activeRuleset = result.ruleset;
    return result;
}

/** Restores the built-in pack. */
export function resetActiveRuleset() {
    activeRuleset = DEFAULT_RULESET;
    return activeRuleset;
}

/**
 * The sections an editor can offer, with the shape each one expects.
 * @returns {Array<{path: string, kind: string}>}
 */
export function getEditableSections() {
    return Object.entries(SECTION_SHAPE).map(([path, kind]) => ({ path, kind }));
}

/**
 * Serialises a pack for export, dropping anything identical to the default so a shared
 * file says what it changes instead of restating the whole ruleset.
 *
 * @param {Ruleset} pack
 * @returns {any}
 */
export function toPortablePack(pack) {
    /** @type {any} */
    const out = { version: pack.version, id: pack.id, name: pack.name };

    for (const section of ['slots', 'slotInfo', 'relationships', 'items', 'character']) {
        const source = pack[section];
        const base = DEFAULT_RULESET[section];
        if (!source || typeof source !== 'object') continue;

        /** @type {any} */
        const diff = {};
        for (const [key, value] of Object.entries(source)) {
            if (JSON.stringify(value) !== JSON.stringify(base?.[key])) {
                diff[key] = value;
            }
        }
        if (Object.keys(diff).length > 0) out[section] = diff;
    }

    return out;
}

/**
 * Where the pack in force is remembered between page loads.
 *
 * It has to be storage the browser hands back synchronously, and it has to be read while
 * this module is evaluating. `dnd-system.js` binds its exports the moment it loads —
 * `const RULES = getActiveRuleset()` — and it imports this module, so this file runs
 * first and it is the only place a pack can be installed early enough to matter. Reading
 * it any later means a reload, which is what made "load the campaign's rules" impossible
 * before this existed.
 */
export const RULESET_STORAGE_KEY = 'sillytavern_activeRulesetPack';

/**
 * Remembers a pack so the next load starts with it.
 *
 * Silent on failure by design: storage can be unavailable in a private window or with
 * site data blocked, and a game that refuses to run because it could not cache its rules
 * would be trading a working default for nothing.
 *
 * @param {any} pack  Null or undefined clears it back to the built-in rules.
 * @returns {boolean} Whether it was stored.
 */
export function rememberRuleset(pack) {
    try {
        const storage = globalThis.localStorage;
        if (!storage) return false;
        if (!pack) {
            storage.removeItem(RULESET_STORAGE_KEY);
            return true;
        }
        storage.setItem(RULESET_STORAGE_KEY, JSON.stringify(pack));
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads back what rememberRuleset stored, or null.
 * @returns {any}
 */
export function readRememberedRuleset() {
    try {
        const raw = globalThis.localStorage?.getItem(RULESET_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Installs the remembered pack, if there is one and it is still valid.
 *
 * Runs on import, below. A pack that no longer validates — because the schema moved on,
 * or because it was edited by hand into something broken — falls back to the built-in
 * rules rather than leaving the game with half a ruleset.
 *
 * @returns {{restored: boolean, errors: string[], warnings: string[]}}
 */
export function restoreRememberedRuleset() {
    const pack = readRememberedRuleset();
    if (!pack) return { restored: false, errors: [], warnings: [] };

    const result = setActiveRuleset(pack);
    if (result.usedDefault) {
        return { restored: false, errors: result.errors, warnings: result.warnings };
    }
    return { restored: true, errors: result.errors, warnings: result.warnings };
}

/**
 * Decides what opening a campaign should do about its rule pack.
 *
 * Kept apart from the doing because the interesting part is the decision, and a reload
 * prompt is the rudest thing this game can show: it has to appear when the rules really
 * changed and never otherwise. Comparing the packs rather than the world names means
 * switching between two campaigns that share a ruleset is silent, as it should be.
 *
 * @param {any} worldPack        The pack stored in the world, or null for the default rules.
 * @param {any} rememberedPack   What is currently installed, from readRememberedRuleset.
 * @returns {{action: 'none'|'install'|'clear'|'reject', reason: string, errors: string[]}}
 */
export function planRulesetChange(worldPack, rememberedPack) {
    const same = JSON.stringify(worldPack ?? null) === JSON.stringify(rememberedPack ?? null);
    if (same) return { action: 'none', reason: 'Las reglas ya son las de esta campaña.', errors: [] };

    if (!worldPack) {
        return { action: 'clear', reason: 'Esta campaña usa las reglas por defecto.', errors: [] };
    }

    const { errors, usedDefault } = resolveRuleset(worldPack);
    if (usedDefault) {
        // Half a rule pack is worse than none: an empty condition list would quietly
        // blank every character sheet. The default stays in force and the player is told.
        return {
            action: 'reject',
            reason: 'El paquete de reglas de esta campaña no es válido. Se siguen usando las reglas por defecto.',
            errors,
        };
    }

    return { action: 'install', reason: 'Esta campaña trae sus propias reglas.', errors: [] };
}

// Applied at import time, which is the whole point: see RULESET_STORAGE_KEY. In Node
// there is no localStorage, so tests always start from the built-in rules.
restoreRememberedRuleset();
