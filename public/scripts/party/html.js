/**
 * HTML escaping for the party submodules.
 *
 * This duplicates utils.js's escapeHtml on purpose. Importing anything from utils.js drags
 * in its whole module graph, which reaches browser-only code (lib.js -> svg-inject) and
 * makes any consumer impossible to load in a Node test. Keeping a zero-dependency leaf here
 * is what lets the party submodules stay unit-testable.
 *
 * The behaviour must stay identical to utils.js: the same five entities, same output.
 * tests/party-item-forms.test.js asserts that contract so the two cannot drift apart.
 *
 * See wiki/ROADMAP.md, Bateria 2.
 */

/**
 * Escapes text for safe HTML rendering.
 * @param {any} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
