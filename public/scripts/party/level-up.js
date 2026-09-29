/**
 * Subir de nivel, con lo que da cada nivel escrito antes de pulsar, y rehacerse en el templo.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, POPUP_RESULT, Popup } from '../popup.js';
import { chat_metadata } from '../../script.js';
import { METADATA_KEY } from '../world-info.js';
import { createSeededRandom } from '../game-engine/combat/seeded-random.js';
import { derive } from '../game-engine/campaign/seed.js';
import { spellById, spellsForClass } from '../game-engine/rules/grimoire.js';
import { perkChoices, takePerk, PERKS, perksOf } from '../game-engine/rules/level-perks.js';
import { respecCost, redoPerks } from '../game-engine/rules/respec.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import {
    planLevelUp, buildLevelUpPatch, describeLevelUp, validateAbilityPicks, ABILITIES, levelForXp,
} from '../game-engine/rules/level-up.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { firstArt, loadPixelManifest } from '../game-engine/ui/pixel-art.js';
import { buildSpellPicker, buildSpellSwap } from '../game-engine/ui/spell-picker.js';
import { choicesBetween, applySpellPicks } from '../game-engine/rules/spell-picks.js';
import { casterOf } from '../game-engine/rules/spell-slots.js';
import { partyMembers } from './state.js';
import { classRowOf, spellRows, spellFor, ensureSpellsOf } from './magic.js';
import { renderLocationMapsPreview } from './board-view.js';
import { campaign } from './time.js';
import { postCombatNarration } from './narration.js';
import { savePartyState, renderPartyMembers, payFromParty } from './roster.js';

/**
 * Idea 58: rehacerse en el templo. Se deshacen las mejoras y se eligen otras tantas, las que
 * se quieran de la lista entera. Se paga al confirmar.
 *
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function respecMember(memberId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    if (!member) return;
    const cost = respecCost(member);
    const had = perksOf(member).map(p => p.id);
    const body = $('<div class="rs-root"></div>');
    body.append($('<h3></h3>').text(`Rehacer a ${member.name}`));
    body.append($('<p></p>').text(`Elige ${had.length}, las que quieras. Cuesta ${cost} de oro.`));
    const list = $('<div class="rs-perks"></div>');
    for (const perk of PERKS) {
        const box = $('<input type="checkbox" class="rs-perk">').attr('value', perk.id).prop('checked', had.includes(perk.id));
        list.append($('<label class="rs-perk-row"></label>').append(box).append($('<span></span>').text(` ${perk.label}: ${perk.describe}`)));
    }
    body.append(list);
    const ok = await new Popup(body[0], POPUP_TYPE.CONFIRM, '', { okButton: 'Rehacer', cancelButton: 'Dejarlo' }).show();
    if (!ok) return;
    const chosen = body.find('.rs-perk:checked').map((_, el) => String($(el).val())).get();
    const redone = redoPerks(member, chosen);
    if (!redone.ok || !redone.patch) {
        toastr.warning(redone.reason, 'Rehacerse');
        return;
    }
    if (!payFromParty(cost)) {
        toastr.warning(`No llega el oro: cuesta ${cost}.`);
        return;
    }
    Object.assign(member, redone.patch);
    savePartyState();
    renderPartyMembers();
    const line = `${member.name} se rehace en el templo: ${perksOf(member).map(p => p.label).join(', ')}.`;
    postCombatNarration(`🕯️ [TEMPLO] ${line}`);
    toastr.success(line, 'Rehacerse');
}

/** Los umbrales de nivel del paquete de reglas activo. */
export function getXpTable() {
    return getActiveRuleset()?.progression?.xpThresholds;
}

/** Los niveles que dan mejora de caracteristica, del mismo paquete. */
export function getAbilityLevels() {
    return getActiveRuleset()?.progression?.abilityLevels;
}

/** @param {any} member */
export function canLevelUp(member) {
    return levelForXp(member?.xp, getXpTable()) > Math.max(1, Math.floor(Number(member?.level) || 1));
}

/** El icono de cada mejora, por lo que mejora: se reconoce antes que la frase. */
const PERK_ICONS = {
    maxHp: 'fa-heart', initiative: 'fa-bolt', speed: 'fa-shoe-prints', attack: 'fa-crosshairs', armorClass: 'fa-shield-halved',
    perception: 'fa-eye', persuasion: 'fa-comments', stealth: 'fa-user-ninja', intimidation: 'fa-face-angry',
    insight: 'fa-magnifying-glass', athletics: 'fa-dumbbell', sleight: 'fa-hand-sparkles',
};

/**
 * El icono de una mejora de `level-perks.js`.
 *
 * @param {{effect?: Record<string, any>}} perk
 * @returns {string}
 */
function perkIcon(perk) {
    const effect = perk?.effect ?? {};
    const key = effect.skill ? String(effect.skill) : Object.keys(effect)[0] ?? '';
    return /** @type {Record<string, string>} */ (PERK_ICONS)[key] ?? 'fa-star';
}

/**
 * J19.2: los conjuros que se eligen al pasar de un nivel a otro, en una sección de tarjeta:
 * las frases de lo que trae, los trucos y conjuros nuevos (con su dibujo) y el cambio. Vacía
 * (`empty`) si su clase no hace magia de 5e o no trae nada que elegir.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} input.classRow
 * @param {number} input.from
 * @param {number} input.to
 * @param {() => void} input.onChange
 * @returns {{root: JQuery, empty: boolean, ready: () => boolean, pick: () => ReturnType<typeof applySpellPicks>}}
 */
function spellChoiceSection({ member, classRow, from, to, onChange }) {
    const catalogue = spellRows();
    const card = choicesBetween({ classRow, from, to, catalogue, member });
    const root = $('<div class="lu-spells"></div>');
    const empty = !casterOf(classRow) || (card.lines.length === 0 && card.newCantrips === 0 && card.newSpells === 0 && !card.canSwap);
    const none = { root, empty: true, ready: () => true, pick: () => applySpellPicks({ member, classRow, catalogue, card }) };
    if (empty) return none;
    root.append($('<div class="lu-subtitle"></div>').text('Conjuros'));
    for (const line of card.lines) root.append($('<div class="lu-spell-line"></div>').text(line));
    const cantrips = card.newCantrips > 0
        ? buildSpellPicker({ name: 'trucos', title: 'Trucos nuevos', options: card.cantripOptions, count: card.newCantrips, onChange })
        : null;
    const spells = card.newSpells > 0
        ? buildSpellPicker({
            name: 'conjuros',
            title: card.mode === 'spellbook' ? 'Al libro' : 'Conjuros nuevos',
            options: card.spellOptions,
            count: card.newSpells,
            hint: card.mode === 'spellbook' ? 'Lo que copies entra en tu libro; cada mañana preparas de ahí.' : '',
            onChange,
        })
        : null;
    const swap = card.canSwap && card.swapOut.length > 0 ? buildSpellSwap({ known: card.swapOut, options: card.spellOptions, onChange }) : null;
    if (cantrips) root.append(cantrips.root);
    if (spells) root.append(spells.root);
    if (swap) root.append(swap.root);
    return {
        root,
        empty: false,
        ready: () => (!cantrips || cantrips.full()) && (!spells || spells.full()),
        pick: () => applySpellPicks({
            member, classRow, catalogue, card,
            cantrips: cantrips?.value() ?? [], spells: spells?.value() ?? [], swap: swap?.value() ?? null,
        }),
    };
}

/**
 * J19.2: elegir conjuros sin subir de nivel (los de empezar, que el juego eligió por ti), con
 * la misma sección que la tarjeta de nivel.
 *
 * @param {Object} input
 * @param {any} input.member Con lo que ya sabe (vacío, para elegir desde cero).
 * @param {any} input.classRow
 * @param {number} input.from
 * @param {number} input.to
 * @param {string} input.title
 * @returns {Promise<Record<string, string[]>|null>} El parche, o null si se deja.
 */
export async function openSpellChoiceCard({ member, classRow, from, to, title }) {
    await loadPixelManifest();
    const root = $('<div class="lu-card lu-spell-card"></div>');
    const art = firstArt('class', { name: String(member.class ?? '') });
    const head = $('<div class="lu-title"></div>');
    if (art) head.append($('<img alt="" class="lu-class-art pixel-art">').attr('src', art));
    head.append($('<span></span>').text(title));
    root.append(head);
    const confirm = $('<button class="menu_button lu-btn lu-confirm" type="button"></button>').text('Quedarme con estos');
    const section = spellChoiceSection({ member, classRow, from, to, onChange: () => confirm.prop('disabled', !section.ready()) });
    if (section.empty) {
        toastr.info('No hay nada que elegir.', String(member.name ?? ''));
        return null;
    }
    root.append(section.root, $('<div class="lu-actions"></div>').append(confirm));
    confirm.prop('disabled', !section.ready());
    /** @type {Record<string, string[]>|null} */
    let patch = null;
    const popup = new Popup(root, POPUP_TYPE.TEXT, null, { okButton: 'Ahora no', wide: true, allowVerticalScrolling: true });
    confirm.on('click', () => {
        const picked = section.pick();
        if (!picked.ok) {
            toastr.warning(picked.errors.join(' '), 'Conjuros');
            return;
        }
        patch = picked.patch;
        void popup.complete(POPUP_RESULT.AFFIRMATIVE);
    });
    await popup.show();
    return patch;
}

/** Como se llaman las seis en la ficha. */
const ABILITY_LABELS = {
    strength: 'Fuerza',
    dexterity: 'Destreza',
    constitution: 'Constitucion',
    intelligence: 'Inteligencia',
    wisdom: 'Sabiduria',
    charisma: 'Carisma',
};

/**
 * Subir de nivel, con lo que da escrito antes de pulsar.
 *
 * Sube todos los niveles que la experiencia de de una vez, y para cuando hay que repartir
 * puntos de caracteristica se para a preguntar: es la unica eleccion de verdad que trae
 * subir de nivel, y decidirla por ti la convertiria en un numero mas.
 *
 * @param {any} member
 */
export async function openLevelUpCard(member) {
    if (!member) return;

    // El dado de golpe sale de la clase, que vive en el Lorebook: por eso esto espera.
    const hitDieByClass = await campaign.getHitDiceByClass();
    const plan = planLevelUp({
        member,
        table: getXpTable(),
        abilityLevels: getAbilityLevels(),
        hitDieByClass,
    });

    if (!plan.canLevel) {
        toastr.info(plan.reason, member.name);
        return;
    }

    await loadPixelManifest();
    const root = $('<div class="lu-card"></div>');
    // El icono de su clase, que dice de un vistazo quién sube.
    const classArt = firstArt('class', { name: String(member.class ?? '') });
    const title = $('<div class="lu-title"></div>');
    if (classArt) title.append($('<img alt="" class="lu-class-art pixel-art">').attr('src', classArt));
    title.append($('<span></span>').text(`${member.name}: nivel ${plan.from} → ${plan.to}`));
    root.append(title);
    root.append($('<div class="lu-gains"></div>').text(
        `+${plan.hpGained} PG · +${plan.hitDiceGained} dado(s) de golpe`));

    /** @type {Record<string, number>} */
    const picks = {};
    const remaining = $('<div class="lu-remaining"></div>');

    if (plan.pointsToSpend > 0) {
        root.append($('<div class="lu-subtitle"></div>').text('Mejora de caracteristica'));
        root.append(remaining);

        const grid = $('<div class="lu-abilities"></div>');
        for (const ability of ABILITIES) {
            const row = $('<div class="lu-ability"></div>');
            row.append($('<span class="lu-ability-name"></span>').text(ABILITY_LABELS[ability]));

            const value = $('<span class="lu-ability-value"></span>');
            const minus = $('<button class="menu_button lu-step" type="button">−</button>');
            const plus = $('<button class="menu_button lu-step" type="button">+</button>');

            const paint = () => {
                const added = picks[ability] || 0;
                const base = Number(member[ability]) || 10;
                value.text(added > 0 ? `${base} → ${base + added}` : String(base));
                row.toggleClass('changed', added > 0);
            };

            minus.on('click', () => {
                picks[ability] = Math.max(0, (picks[ability] || 0) - 1);
                if (picks[ability] === 0) delete picks[ability];
                paint();
                refresh();
            });
            plus.on('click', () => {
                picks[ability] = (picks[ability] || 0) + 1;
                paint();
                refresh();
            });

            row.append(minus, value, plus);
            grid.append(row);
            paint();
        }
        root.append(grid);
    }

    // Idea 46: una mejora a elegir entre tres. Con la semilla de quién sube y a qué nivel.
    const offered = perkChoices({
        member,
        random: createSeededRandom(derive(String(chat_metadata?.[METADATA_KEY] || ''), 'mejora', String(member.id), String(plan.to))),
    });
    let chosenPerk = '';
    if (offered.length > 0) {
        root.append($('<div class="lu-subtitle"></div>').text('Una mejora a elegir'));
        const perksBox = $('<div class="lu-perks"></div>');
        for (const perk of offered) {
            const button = $('<button type="button" class="menu_button lu-perk"></button>').attr('data-perk', perk.id);
            button.append($('<i class="fa-solid lu-perk-icon"></i>').addClass(perkIcon(perk)));
            button.append($('<span class="lu-perk-name"></span>').text(perk.label));
            button.append($('<span class="lu-perk-desc"></span>').text(perk.describe));
            button.on('click', () => {
                chosenPerk = perk.id;
                perksBox.find('.lu-perk').removeClass('chosen');
                button.addClass('chosen');
                refresh();
            });
            perksBox.append(button);
        }
        root.append(perksBox);
    }

    // J19.2: quien lanza con espacios elige aquí sus trucos y conjuros nuevos.
    const classRow = classRowOf(member);
    if (ensureSpellsOf(member)) savePartyState();
    const spellSection = spellChoiceSection({ member, classRow, from: plan.from, to: plan.to, onChange: () => refresh() });
    if (!spellSection.empty) root.append(spellSection.root);

    const actions = $('<div class="lu-actions"></div>');
    const confirm = $('<button class="menu_button lu-btn lu-confirm" type="button"></button>').text('Subir de nivel');

    function refresh() {
        const picked = validateAbilityPicks(picks, plan, member);
        const verdict = picked.ok && offered.length > 0 && !chosenPerk
            ? { ok: false, error: 'Falta elegir una mejora.' }
            : picked.ok && !spellSection.ready()
                ? { ok: false, error: 'Faltan conjuros por elegir.' }
                : picked;
        confirm.prop('disabled', !verdict.ok);
        confirm.attr('title', verdict.ok ? 'Escribe el nivel en la ficha' : verdict.error);
        const spent = Object.values(picks).reduce((total, value) => total + value, 0);
        remaining.text(`Quedan ${Math.max(0, plan.pointsToSpend - spent)} de ${plan.pointsToSpend} punto(s)`);
        remaining.toggleClass('over', spent > plan.pointsToSpend);
    }

    actions.append(confirm);
    root.append(actions);
    refresh();

    // Un popup y no una capa propia: esto se abre desde dentro de la ficha del personaje,
    // que es un `<dialog>` nativo, y un `<dialog>` pinta por encima de cualquier z-index.
    // La tarjeta quedaba detras de la ficha y no se podia pulsar — lo cazó el recorrido.
    const popup = new Popup(root, POPUP_TYPE.TEXT, null, { okButton: 'Ahora no', wide: !spellSection.empty, allowVerticalScrolling: true });

    confirm.on('click', () => {
        if (!validateAbilityPicks(picks, plan, member).ok) return;
        if (offered.length > 0 && !chosenPerk) return;
        // J19.2: los conjuros, comprobados antes de tocar la ficha.
        const spellPick = spellSection.empty ? null : spellSection.pick();
        if (spellPick && !spellPick.ok) {
            toastr.warning(spellPick.errors.join(' '), 'Conjuros');
            return;
        }
        Object.assign(member, buildLevelUpPatch(member, plan, picks));
        // Idea 46: lo elegido, que se nota jugando.
        const perkPatch = chosenPerk ? takePerk(member, chosenPerk) : null;
        if (perkPatch) Object.assign(member, perkPatch);
        if (spellPick) {
            Object.assign(member, spellPick.patch);
            if (spellPick.learned.length > 0) {
                postCombatNarration(`📖 [NIVEL] ${member.name} aprende: ${spellPick.learned.map(id => spellFor(id)?.name ?? id).join(', ')}.`);
            }
        }
        // R4: quien hace magia con la capa ligera aprende los conjuros de su clase del círculo
        // que se le abre. Quien lanza con espacios ya los ha elegido arriba.
        const before = new Set((Array.isArray(member.abilities) ? member.abilities : []).map(String));
        const learned = casterOf(classRow) ? [] : spellsForClass({ className: String(member.class ?? ''), level: Number(member.level) || 1 }).filter(id => !before.has(id));
        if (learned.length > 0) {
            member.abilities = [...before, ...learned];
            postCombatNarration(`📖 [NIVEL] ${member.name} aprende: ${learned.map(id => spellById(id)?.name ?? id).join(', ')}.`);
        }
        savePartyState();
        renderPartyMembers();
        const perkNote = chosenPerk ? ` Mejora: ${offered.find(o => o.id === chosenPerk)?.label ?? chosenPerk}.` : '';
        postCombatNarration(`⭐ [NIVEL] ${describeLevelUp(member, plan)}${perkNote}`);
        void popup.complete(POPUP_RESULT.AFFIRMATIVE);
        renderLocationMapsPreview();
        if (isShellOpen()) refreshGameShell();
    });

    await popup.show();
}
