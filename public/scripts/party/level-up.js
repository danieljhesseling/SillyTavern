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
import { partyMembers } from './state.js';
import { savePartyState, renderPartyMembers, postCombatNarration, payFromParty } from './main.js';
import { renderLocationMapsPreview } from './board-view.js';
import { campaign } from './time.js';

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

    const root = $('<div class="lu-card"></div>');
    root.append($('<div class="lu-title"></div>').text(`${member.name}: nivel ${plan.from} → ${plan.to}`));
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

    const actions = $('<div class="lu-actions"></div>');
    const confirm = $('<button class="menu_button lu-btn lu-confirm" type="button"></button>').text('Subir de nivel');

    function refresh() {
        const picked = validateAbilityPicks(picks, plan, member);
        const verdict = picked.ok && offered.length > 0 && !chosenPerk
            ? { ok: false, error: 'Falta elegir una mejora.' }
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
    const popup = new Popup(root, POPUP_TYPE.TEXT, null, { okButton: 'Ahora no' });

    confirm.on('click', () => {
        if (!validateAbilityPicks(picks, plan, member).ok) return;
        if (offered.length > 0 && !chosenPerk) return;
        Object.assign(member, buildLevelUpPatch(member, plan, picks));
        // Idea 46: lo elegido, que se nota jugando.
        const perkPatch = chosenPerk ? takePerk(member, chosenPerk) : null;
        if (perkPatch) Object.assign(member, perkPatch);
        // R4: quien hace magia aprende los conjuros de su clase del círculo que se le abre.
        const before = new Set((Array.isArray(member.abilities) ? member.abilities : []).map(String));
        const learned = spellsForClass({ className: String(member.class ?? ''), level: Number(member.level) || 1 }).filter(id => !before.has(id));
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
