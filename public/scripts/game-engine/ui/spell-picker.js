/**
 * Elegir conjuros, con el dedo (J19.2 del roadmap sin conexión): una rejilla de tarjetas
 * con su dibujo, su nombre, su nivel y lo que hacen, y un tope de cuántos.
 *
 * La usan la tarjeta de subir de nivel (los trucos y conjuros nuevos, el cambio), el
 * grimorio (preparar tras un descanso largo) y la elección de los de empezar. Aquí solo se
 * dibuja y se cuenta; lo que vale lo dicen `spell-picks.js` y `spell-prep.js`.
 */

import { firstArt } from './pixel-art.js';
import { describeSpell5e } from '../rules/spell-cast.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Cómo se dice el nivel de un conjuro en su tarjeta.
 *
 * @param {{level: number}} spell
 * @returns {string}
 */
export function spellLevelLabel(spell) {
    return spell.level === 0 ? 'Truco' : `Nivel ${spell.level}`;
}

/**
 * Una rejilla de conjuros para elegir hasta `count`.
 *
 * @param {Object} input
 * @param {string} input.name Para las pruebas y el CSS (`data-picker`).
 * @param {string} input.title
 * @param {import('../rules/spell-catalogue.js').Spell[]} input.options
 * @param {number} input.count Cuántos se eligen como mucho.
 * @param {string[]} [input.chosen] Los que salen ya marcados.
 * @param {string} [input.hint]
 * @param {() => void} [input.onChange]
 * @returns {{root: JQuery, value: () => string[], full: () => boolean}}
 */
export function buildSpellPicker({ name, title, options, count, chosen = [], hint = '', onChange = () => {} }) {
    const root = $('<div class="sp-picker"></div>').attr('data-picker', name);
    const head = $('<div class="sp-head"></div>');
    head.append($('<span class="sp-title"></span>').text(title));
    const counter = $('<span class="sp-count"></span>');
    head.append(counter);
    root.append(head);
    if (hint) root.append($('<div class="sp-hint"></div>').text(hint));
    const grid = $('<div class="sp-grid"></div>');
    const picked = new Set(chosen.filter(id => options.some(s => s.id === id)).slice(0, Math.max(0, count)));
    const need = Math.min(Math.max(0, count), options.length);

    const paint = () => {
        counter.text(`${picked.size} de ${need}`);
        counter.toggleClass('is-full', picked.size === need);
        grid.find('.sp-option').each((_, el) => {
            const on = picked.has(String($(el).attr('data-spell')));
            $(el).toggleClass('chosen', on).attr('aria-pressed', on ? 'true' : 'false');
            $(el).prop('disabled', !on && picked.size >= need);
        });
    };

    for (const spell of options) {
        const card = $('<button type="button" class="sp-option"></button>').attr('data-spell', spell.id).attr('title', spell.note);
        const art = firstArt('spell', { id: spell.id, name: spell.name });
        if (art) card.append($('<img alt="" class="sp-art pixel-art">').attr('src', art));
        else card.append('<i class="fa-solid fa-wand-sparkles sp-art-icon"></i>');
        const body = $('<span class="sp-body"></span>');
        body.append($('<span class="sp-name"></span>').text(spell.name));
        body.append($('<span class="sp-level"></span>').text(spellLevelLabel(spell)));
        body.append($('<span class="sp-desc"></span>').text(describeSpell5e(spell).split(' · ').slice(2).join(' · ')));
        card.append(body);
        card.on('click', () => {
            if (picked.has(spell.id)) picked.delete(spell.id);
            else if (picked.size < need) picked.add(spell.id);
            paint();
            onChange();
        });
        grid.append(card);
    }
    if (options.length === 0) grid.append($('<div class="sp-empty"></div>').text('No queda nada nuevo que elegir de su lista.'));
    root.append(grid);
    paint();
    return { root, value: () => [...picked], full: () => picked.size === need };
}

/**
 * Cambiar uno que sabía por otro (los que se saben sus conjuros, al subir): dos listas.
 *
 * @param {Object} input
 * @param {import('../rules/spell-catalogue.js').Spell[]} input.known
 * @param {import('../rules/spell-catalogue.js').Spell[]} input.options
 * @param {() => void} [input.onChange]
 * @returns {{root: JQuery, value: () => ({out: string, in: string}|null)}}
 */
export function buildSpellSwap({ known, options, onChange = () => {} }) {
    const root = $('<div class="sp-swap"></div>');
    root.append($('<div class="sp-title"></div>').text('Cambiar uno que sabía (si quieres)'));
    const out = $('<select class="sp-swap-out"></select>').append($('<option value=""></option>').text('No cambiar nada'));
    for (const spell of known) out.append($('<option></option>').attr('value', spell.id).text(`${spell.name} (${spellLevelLabel(spell)})`));
    const into = $('<select class="sp-swap-in"></select>').append($('<option value=""></option>').text('…por este otro'));
    for (const spell of options) into.append($('<option></option>').attr('value', spell.id).text(`${spell.name} (${spellLevelLabel(spell)})`));
    out.on('change', onChange);
    into.on('change', onChange);
    root.append(out, $('<span class="sp-swap-arrow">→</span>'), into);
    return {
        root,
        value: () => (text(out.val()) && text(into.val()) ? { out: text(out.val()), in: text(into.val()) } : null),
    };
}

/**
 * Preparar conjuros: la rejilla, con el tope de lo que cabe, en un cuadro.
 *
 * @param {Object} input
 * @param {string} input.who
 * @param {import('../rules/spell-catalogue.js').Spell[]} input.options
 * @param {number} input.limit
 * @param {string[]} input.chosen
 * @param {string} [input.note]
 * @param {string} [input.advice] Lo que dice que ya viene marcado lo de su papel.
 * @param {(ids: string[]) => {ok: boolean, errors: string[]}} input.check
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<string[]|null>} Lo elegido, o null si se deja.
 */
export async function openPreparePanel({ who, options, limit, chosen, note = '', advice = '', check, Popup, POPUP_TYPE }) {
    const root = $('<div class="sp-root sp-prepare"></div>');
    root.append($('<h3></h3>').text(`${who}: preparar conjuros`));
    root.append($('<p class="sp-lead"></p>').text(note || `Elige los ${limit} que tendrá a mano hasta el próximo descanso largo. Los trucos no cuentan: se saben siempre.`));
    // E7.4 (decisión de Daniel): ya viene marcado lo de su papel, y se dice.
    if (advice) root.append($('<p class="sp-advice lu-advice"></p>').text(advice));
    const errors = $('<div class="sp-errors"></div>');
    const picker = buildSpellPicker({
        name: 'preparar', title: 'Preparados', options, count: limit, chosen,
        onChange: () => errors.text(''),
    });
    root.append(picker.root, errors);
    const popup = new Popup(root[0], POPUP_TYPE.CONFIRM, '', {
        okButton: 'Preparar', cancelButton: 'Dejarlo como está', wide: true, allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (!p.result) return true;
            const verdict = check(picker.value());
            if (verdict.ok) return true;
            errors.text(verdict.errors.join(' '));
            return false;
        },
    });
    const ok = await popup.show();
    return ok ? picker.value() : null;
}
