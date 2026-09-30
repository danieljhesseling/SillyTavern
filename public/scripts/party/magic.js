/**
 * Habilidades y conjuros: el catálogo, usarlas (en el tablero, a uno o en área), sus
 * componentes y su precio, los estados con fecha, pergaminos y varitas, el grimorio y aprender
 * con quien enseña.
 *
 * Salió de `party.js` en J15.1 (wiki/ROADMAP_SIN_CONEXION.md). La fachada `party.js` sigue
 * exportando lo de siempre; lo que escriben varios módulos vive en `state.js`, y las claves
 * de lo guardado, en `keys.js`.
 */

import { POPUP_TYPE, Popup } from '../popup.js';
import { chat_metadata, saveMetadata } from '../../script.js';
import { loadWorldInfo, saveWorldInfo, METADATA_KEY } from '../world-info.js';
import { getAbilityModifier, removeItemFromInventory, addItemToInventory, createItem } from '../dnd-system.js';
import { asAbility } from '../game-engine/compendio/skills.js';
import { rollDiceDetailed, getDistanceInFeet, getPlayerAttackModifier } from './combat-rules.js';
import { setCell as setTerrainCell, getCell, TERRAIN_TYPES } from '../game-engine/board/terrain.js';
import { areaCells, creaturesIn, isArea, describeArea } from '../game-engine/rules/area.js';
import { elementOf, reactTerrain, comboFor, ELEMENT_ICONS } from '../game-engine/rules/tags.js';
import { MAGIC_ITEMS, afterUse, canLearnScroll } from '../game-engine/rules/magic-items.js';
import {
    grimoireAbilities, spellById, spellAbility, spendCharge, magicInData, knownSpells, describeSpell,
    describeCharges, SCHOOLS, SPELLS, CIRCLE_LABELS,
} from '../game-engine/rules/grimoire.js';
import { describeLesson, LESSON } from '../game-engine/campaign/masters.js';
import { isIndoors, isNight } from '../game-engine/world/visibility.js';
import { fireAt } from '../game-engine/board/living-terrain.js';
import { WATCH, readWanted, magicIsCrime } from '../game-engine/campaign/crime.js';
import { noteDealt } from '../game-engine/combat/tally.js';
import { hasAction, useAction } from '../game-engine/combat/turn-machine.js';
import { getActiveRuleset } from '../game-engine/rules/ruleset.js';
import { normalizeAbilities, canUseAbility, planAbilityUse, spendAbilityUse, knownAbilities } from '../game-engine/rules/abilities.js';
import { addConditionTimer, expireConditions, clearTimersFor } from '../game-engine/combat/condition-timers.js';
import { clearDeathSaves } from '../game-engine/rules/death-saves.js';
import {
    casterOf, classRowFor, spendSlot, spellcastingStats, describeSlots, SLOT_LABELS,
} from '../game-engine/rules/spell-slots.js';
import { castableSpells, checkPreparation, classSpellList, preparedLimit, maxSpellLevel, ritualSpells } from '../game-engine/rules/spell-prep.js';
import {
    canCastSpell, componentsCheck, spellToAbility, upcastSpell, hpPoolTargets, describeSpell5e, focusGift, supplyHolder,
} from '../game-engine/rules/spell-cast.js';
import { describeLootItem } from '../game-engine/combat/loot-items.js';
import { normalizeSpell, findSpell } from '../game-engine/rules/spell-catalogue.js';
import { startingSpells, hasSpellLists } from '../game-engine/rules/spell-picks.js';
import { startConcentration, readConcentration, linkedTo, describeConcentration, endConcentration } from '../game-engine/rules/concentration.js';
import { zoneFromSpell, placeZone, zoneFlagsAt, resolveZoneEffect, clearZones, endZones, kindOf, ZONE_KINDS } from '../game-engine/board/spell-zones.js';
import { planSummon, dismissSummons } from '../game-engine/rules/summons.js';
import { itemSpellSpec, spendItemCharges, itemWorks, scrollCheck, setAttunement, ATTUNEMENT_MAX, attunedItems } from '../game-engine/rules/magic-items.js';
import { firstArt, loadPixelManifest, boardBiome } from '../game-engine/ui/pixel-art.js';
import { fieldChoices, castField, darkHere, lightActive, lightLookBonus, roadHeal, arrivalHealAsk } from '../game-engine/rules/field-magic.js';
import { openFieldMagic } from '../game-engine/ui/field-magic-panel.js';
import { readCases } from '../game-engine/campaign/cases.js';
import { templeWork } from '../game-engine/campaign/item-lore.js';
import { petName } from '../game-engine/campaign/pet.js';
import { alarmActive } from '../game-engine/rules/rituals.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { currentTownPlace } from '../game-engine/ui/shell/town-scene.js';
import { CASES_KEY, FIELD_LIGHT_KEY, SPOKEN_DEAD_KEY, WANTED_KEY } from './keys.js';
import { combatEncounter, currentBoardName, currentLocationName, partyMembers } from './state.js';
import {
    saveCombatState, getCurrentTurnState, getEnemyByInstanceId, getAliveEnemies, getCurrentActingMember,
    getTargetArmorClass, enemyTokenId, boardCellOf,
} from './combat-state.js';
import { floatOnToken } from './combat-log.js';
import { damagePartyMember } from './enemy-turn.js';
import { shieldAgainst } from './spell-turn.js';
import { judgeCurrentScenario, checkScenarioOutcome, endCombat } from './combat-flow.js';
import { persistBoardTerrain, getActiveBoardContext, explodeBarrels, boardVisibility } from './board.js';
import { renderLocationMapsPreview } from './board-view.js';
import { applyCampaignRuleset, lastWorldRows, hereLocation, lastCompendium, getLocationBoards, leaveMark, lastPack } from './world.js';
import { nudgeRuler } from './factions.js';
import { advanceCampaignDay, getCampaignCalendar, getCurrentSlotLabel } from './time.js';
import { currentPet } from './pet.js';
import { noteDeed, worldWrite } from './world-growth.js';
import { postCombatNarration, postForModel, showTip, narratorMode } from './narration.js';
import { savePartyState, renderPartyMembers } from './roster.js';
import { judgeDecision, recordFeat } from './companions.js';

/**
 * R4: usar un pergamino o una varita: el conjuro sale del objeto, sin gastar cargas del
 * círculo ni componentes de quien lo usa. El pergamino se gasta; la varita pierde una carga.
 *
 * @param {string} itemId
 * @param {string} targetId
 * @returns {string}
 */
export function useMagicItem(itemId, targetId) {
    const member = getCurrentActingMember();
    if (!member || !combatEncounter.active) return '';
    const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i.id) === String(itemId));
    const legacy = item ? MAGIC_ITEMS[String(item.name)] : null;
    // J19.9: o un objeto de 5e, con su conjuro en la ficha (`linkedSpell`), sus cargas y su CD.
    const spec = item && !legacy ? itemSpellSpec(item) : null;
    const spell = spec ? spellFor(spec.spell) : null;
    const ability = legacy ? getAbilityCatalogue().find(a => a.id === legacy.spell)
        : spell && spec ? normalizeAbilities([spellToAbility(spell, {
            slotLevel: spec.slotLevel || spell.level,
            casterLevel: Number(member.level) || 1,
            saveDc: spec.saveDc || 13,
            attackBonus: spec.attackBonus || 5,
        })])[0] : null;
    if (!item || !ability || !hasAction(combatEncounter, 'action')) return '';
    if (!itemWorks(item)) {
        toastr.warning(`${item.name} pide sintonía: sintonízate en la ficha, fuera de combate.`, 'Sintonía');
        return '';
    }
    const subject = ability.target === 'self' ? member
        : ability.target === 'ally' ? partyMembers.find(m => String(m.id) === String(targetId))
            : getEnemyByInstanceId(String(targetId));
    if (!subject) return '';
    // J19.9: un pergamino de 5e lo lee quien lanza de esa lista; si es de un nivel que aún no
    // lanza, con una prueba, y si la falla se pierde.
    /** @type {string[]} */
    const tried = [];
    let lost = false;
    if (spell && spec?.kind === 'scroll') {
        const classRow = classRowOf(member);
        const casting = casterOf(classRow);
        const check = casting ? scrollCheck({
            spell, classList: casting.list, maxLevel: maxSpellLevel(classRow, member.level),
            roll: (formula) => rollDiceDetailed(formula, 20), modifier: spellcastingStats(member, classRow).modifier,
        }) : { ok: false, reason: `${item.name} solo lo sabe leer quien lanza conjuros.`, success: false, lines: [] };
        if (!check.ok) {
            toastr.warning(check.reason, 'Pergamino');
            return '';
        }
        tried.push(...check.lines);
        lost = !check.success;
    }
    Object.assign(combatEncounter, useAction(combatEncounter, 'action'));
    const lines = [`📜 ${member.name} usa ${item.name}.`, ...tried, ...(lost ? [] : resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject }))];
    if (legacy) {
        const after = afterUse(item);
        if (after.remove) removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        else /** @type {any} */ (item).charges = after.charges;
        lines.push(after.line);
    } else if (spec?.kind === 'scroll') {
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        lines.push(`${item.name} se deshace en ceniza.`);
    } else {
        const spent = spendItemCharges(item, 1);
        if (spent.remove) removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        else /** @type {any} */ (item).uses = spent.uses;
        lines.push(spent.line);
    }
    lines.push(...magicConsequences(ability));
    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }
    return item.name;
}

/**
 * R4: aprender el conjuro de un pergamino, si se ha estudiado (el mago y el erudito). El
 * pergamino se gasta.
 *
 * @param {string} name Del pergamino, o vacío para el primero que haya.
 * @returns {string}
 */
export function learnFromScroll(name) {
    for (const member of partyMembers.filter(m => !m.dead)) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => MAGIC_ITEMS[String(i.name)]?.kind === 'scroll'
            && (!name || String(i.name).toLowerCase().includes(String(name).toLowerCase())));
        if (!item) continue;
        const verdict = canLearnScroll(member, item);
        if (!verdict.ok) continue;
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), verdict.spell])];
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        savePartyState();
        renderPartyMembers();
        const line = `${member.name} estudia ${item.name} hasta sabérselo: ya sabe ${spellById(verdict.spell)?.name ?? verdict.spell}.`;
        postCombatNarration(`📜 [APRENDIZAJE] ${line}`);
        noteDeed(line);
        return line;
    }
    toastr.info('Nadie del grupo puede aprender de un pergamino ahora: hace falta haber estudiado (el mago o el erudito), y no sabérselo ya.', 'Pergaminos');
    return '';
}

/**
 * R4: el grimorio del grupo, en un cuadro. Solo lee.
 */
export async function openGrimoire(all = false) {
    const body = $('<div class="jr-root gr-root"></div>');
    body.append($('<h3></h3>').text(all ? 'Toda la magia que existe' : 'El grimorio'));
    // Los dibujos de los conjuros y de las clases necesitan el índice del arte en pixel.
    await loadPixelManifest();
    /**
     * Una fila del grimorio de siempre, con el dibujo del conjuro si lo tiene.
     *
     * @param {any} spell
     * @param {string} said
     */
    const lightRow = (spell, said) => {
        const row = $('<div class="jr-item gr-spell"></div>').attr('data-spell', spell.id).attr('title', spell.note);
        const icon = firstArt('ability', { id: spell.id, name: spell.name });
        if (icon) row.append($('<img alt="" class="gr-spell-art pixel-art">').attr('src', icon));
        return row.append($('<span></span>').text(said));
    };
    // R10: la lista entera, por círculos: no se crea, se consulta.
    if (all) {
        for (const circle of [0, 1, 2, 3]) {
            body.append($('<div class="jr-title"></div>').text(CIRCLE_LABELS[/** @type {0|1|2|3} */ (circle)].replace(/^./, c => c.toUpperCase())));
            for (const spell of SPELLS.filter(s => s.circle === circle)) {
                body.append(lightRow(spell, `${describeSpell(spell)} · ${spell.id}`));
            }
        }
        await new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true }).show();
        return;
    }
    // J19: quien lanza con espacios, primero: sus espacios, lo que prepara y lo que sabe,
    // con sus botones de preparar y de elegir.
    const fifth = partyMembers.filter(m => !m.dead && castsLikeFifth(m));
    /** @type {null|(() => Promise<any>)} */
    let next = null;
    /** @type {any} */
    let popup = null;
    // J19.10: la magia fuera de combate (curar, luz, detectar, los rituales), con un botón y no
    // solo con `/magia`. En plena pelea, no: se lanza en tu turno.
    if (fifth.length > 0 && !combatEncounter.active) {
        body.append($('<button type="button" class="menu_button gr-field"></button>')
            .append('<i class="fa-solid fa-wand-sparkles"></i>')
            .append($('<span></span>').text(' Lanzar fuera de combate: curar, luz, rituales…'))
            .on('click', () => {
                next = openFieldMagicModal;
                void popup?.completeAffirmative();
            }));
    }
    for (const member of fifth) {
        if (ensureSpellsOf(member)) savePartyState();
        body.append(grimoireSection(member, (action) => {
            next = action;
            void popup?.completeAffirmative();
        }));
    }
    const casters = partyMembers.filter(m => !m.dead && !castsLikeFifth(m) && knownSpells(m).length > 0);
    if (casters.length === 0 && fifth.length === 0) {
        body.append($('<div class="jr-item"></div>').text('Nadie del grupo hace magia. En este mundo, la única que existe es la del grimorio.'));
    }
    const carried = carriedNames().map(n => n.toLowerCase());
    for (const member of casters) {
        body.append($('<div class="jr-title"></div>').text(`${member.name}${describeCharges(member) ? ` · ${describeCharges(member)}` : ''}`));
        for (const spell of knownSpells(member)) {
            const missing = spell.component && !carried.includes(spell.component.toLowerCase()) ? ` (falta ${spell.component.toLowerCase()})` : '';
            body.append(lightRow(spell, `${describeSpell(spell)}${missing}`));
        }
    }
    if (casters.length > 0) {
        const schools = Object.values(SCHOOLS).map(s => `${s.label}: ${s.note}`).join(' · ');
        body.append($('<div class="jr-item gr-schools"></div>').text(schools));
    }
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: 'Cerrar', allowVerticalScrolling: true, leftAlign: true, wide: true });
    await popup.show();
    // Lo que se pidió desde dentro (preparar, elegir) se abre ya cerrado el grimorio: dos
    // cuadros uno encima de otro no se dejan pulsar bien.
    if (next) await /** @type {() => Promise<any>} */ (next)();
}

/**
 * J19.10: si aquí no se ve sin luz: en un tablero de piedra, una cueva o una cripta (el mismo
 * bioma con el que se dibuja el tablero), o en una localización de mazmorra; y de noche al raso.
 * D-J51: bajo techo con luz (la posada, la tienda, el templo, la herrería, el gremio, o un tablero
 * de madera) no está oscuro, ni de noche: ahí la Luz no se ofrece.
 *
 * @param {boolean} night
 * @returns {boolean}
 */
function darkNow(night) {
    const place = hereLocation();
    const type = String(place?.locationType ?? place?.type ?? '');
    // Solo el nombre y el bioma del tablero: sin armar su terreno, que esto se mira cada vez que
    // se dibuja la fila de la escena.
    const board = currentBoardName ? getLocationBoards(place).find((/** @type {any} */ b) => b?.name === currentBoardName) ?? null : null;
    const biome = board ? boardBiome({ biome: String(board.biome ?? ''), name: String(board.name ?? ''), type }) : String(place?.biome ?? '');
    // El sitio del pueblo en el que se ha entrado; en un tablero manda el tablero.
    const inside = board ? '' : currentTownPlace();
    return darkHere({ night, biome, type, place: inside });
}

/**
 * J19.10: lo que la magia fuera de combate necesita saber de aquí y ahora: si es de noche o
 * está oscuro, la Luz que ya arde, el caso abierto, lo que lleváis sin identificar, la alarma
 * de esta noche, la mascota y el grupo. Sin esto, Luz, Identificar y Hablar con los muertos
 * decían siempre que no.
 *
 * @returns {import('../game-engine/rules/field-magic.js').FieldContext}
 */
export function fieldContext() {
    const calendar = getCampaignCalendar();
    const night = isNight(getCurrentSlotLabel());
    const pet = currentPet();
    return {
        night,
        dark: darkNow(night),
        calendar,
        light: chat_metadata?.[FIELD_LIGHT_KEY] ?? null,
        cases: readCases(chat_metadata?.[CASES_KEY]),
        // D-J50: a qué muerto se le preguntó, y qué día.
        spokenDead: chat_metadata?.[SPOKEN_DEAD_KEY] ?? {},
        unknownItems: templeWork(partyMembers).unknown.length,
        alarmSet: partyMembers.some(m => !m.dead && alarmActive(/** @type {any} */ (m).ritualAlarm, calendar)),
        pet: pet ? petName(pet) : '',
        party: partyMembers,
    };
}

/**
 * J19.10: quién del grupo lanza conjuros de 5e y lo que puede hacer ahora sin pelear, con sus
 * espacios en una línea.
 *
 * @returns {import('../game-engine/ui/field-magic-panel.js').FieldCaster[]}
 */
export function fieldCasters() {
    if (spellRows().length === 0) return [];
    const casters = partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0 && castsLikeFifth(m));
    if (casters.length === 0) return [];
    const context = fieldContext();
    return casters.map(member => {
        const classRow = classRowOf(member);
        return {
            member,
            slots: describeSlots(member, classRow).replace(/(\d)\.º (\d+)\/(\d+)/g, 'de nivel $1: $2 de $3'),
            choices: fieldChoices({
                member,
                classRow,
                catalogue: spellRows(),
                carried: Array.isArray(member.items) ? member.items : [],
                context: { ...context, others: othersOf(member) },
            }),
        };
    }).filter(c => c.choices.length > 0);
}

/**
 * D-J49: si alguien del grupo lanza conjuros de 5e fuera de combate (con los conjuros del
 * compendio a mano). Con él, tu ficha lleva el botón «Magia fuera de combate», lances tú o no.
 *
 * @returns {boolean}
 */
export function partyCastsOutside() {
    return spellRows().length > 0 && partyMembers.some(m => !m.dead && castsLikeFifth(m));
}

/** Lo que, si se puede y sirve de algo aquí, saca la ficha «Magia» a la fila de la escena. */
const FIELD_CHIP_KINDS = ['luz', 'identify', 'muertos'];

/**
 * J19.10: los conjuros que ahora sirven de algo aquí, para la ficha «Magia» de la escena: una
 * Luz a oscuras, Identificar con algo sin identificar, preguntarle al muerto de un caso y, de
 * noche, la Alarma. Curar va en su propia ficha (`fieldHealNow`). Detectar magia y lo demás no
 * la sacan: sirven siempre, y están en la ficha y en el grimorio.
 *
 * @returns {string[]} Sus nombres, sin repetir.
 */
export function fieldMagicNow() {
    if (combatEncounter.active || !chat_metadata) return [];
    const night = isNight(getCurrentSlotLabel());
    const casters = fieldCasters();
    // D-J49: la ficha «Magia» de la escena sale solo cuando sirve; lo demás está en la ficha. La
    // primera vez que el grupo tiene a alguien que lanza, un consejo dice dónde.
    if (casters.length > 0 && narratorMode() === 'motor') showTip('fieldMagic');
    const useful = casters.flatMap(c => c.choices)
        .filter(choice => choice.ok && (FIELD_CHIP_KINDS.includes(choice.kind) || (choice.kind === 'alarm' && night)));
    return [...new Set(useful.map(choice => choice.name))];
}

/**
 * J19.10, «curar en el viaje»: si alguien está herido y alguien puede curarle con magia, lo
 * más barato que haya (`roadHeal`: un truco antes que un espacio, el espacio más bajo).
 *
 * @returns {{member: any, choice: import('../game-engine/rules/field-magic.js').FieldChoice}|null}
 */
export function fieldHealNow() {
    if (combatEncounter.active || !chat_metadata) return null;
    if (!partyMembers.some(m => !m.dead && (Number(m.hp) || 0) > 0 && (Number(m.hp) || 0) < (Number(m.maxHp) || 0))) return null;
    return roadHeal(fieldCasters());
}

/**
 * J19.10: curar a los heridos con magia, de un toque (la ficha «Curar con magia»).
 *
 * @returns {Promise<string>} Lo que se ha contado.
 */
export async function healWithMagic() {
    const pick = fieldHealNow();
    if (!pick) {
        toastr.info('Nadie puede curar con magia ahora, o nadie está herido.', 'Magia');
        return '';
    }
    const lines = await castFieldChoice(pick.member, pick.choice);
    const said = lines.join(' ');
    if (said) toastr.success(said, pick.choice.name);
    return said;
}

/**
 * D-J53: esperar a que no haya ninguna ventana abierta (un suceso del camino, la noche, una
 * charla): la pregunta de al llegar sale detrás, no encima. Da un respiro al principio, para
 * que lo que se acaba de poner en cola se abra antes.
 *
 * @param {number} [limit] Cuánto esperar como mucho, en milisegundos.
 * @returns {Promise<boolean>} Si se quedó libre a tiempo.
 */
async function untilNoWindow(limit = 120000) {
    const wait = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));
    await wait(900);
    const until = Date.now() + limit;
    let calm = 0;
    while (Date.now() < until) {
        calm = document.querySelector('dialog[open]') ? 0 : calm + 1;
        // Dos veces seguidas sin nada: lo que venía detrás ya habría salido.
        if (calm >= 2) return true;
        await wait(350);
    }
    return false;
}

/**
 * D-J53: al llegar de un viaje, si alguien está herido y alguien puede curarle con magia, se
 * pregunta en la novela: «¿Curar a Bran con magia? (gasta un espacio de nivel 1)», con Sí y No.
 * La ficha «Curar con magia» de la escena sigue ahí, para quien diga que no y cambie de idea.
 * Solo sin conexión, cuando cuenta el motor (D-J44).
 *
 * @returns {Promise<boolean>} Si se curó.
 */
export async function askHealOnArrival() {
    if (narratorMode() !== 'motor' || combatEncounter.active || !chat_metadata) return false;
    const owner = chat_metadata;
    const place = currentLocationName;
    if (!fieldHealNow()) return false;
    if (!(await untilNoWindow())) return false;
    // Mientras se esperaba, se puede haber cambiado de partida, de sitio o empezado una pelea.
    if (chat_metadata !== owner || currentLocationName !== place || combatEncounter.active) return false;
    const pick = fieldHealNow();
    const ask = arrivalHealAsk(pick, partyMembers);
    if (!pick || !ask) return false;
    const { askInScene } = await import('../game-engine/ui/vn-question.js');
    const yes = await askInScene({
        title: `Al llegar a ${place}`,
        who: pick.member,
        notes: ask.notes,
        question: ask.question,
        kind: 'curar',
        pack: lastPack,
        town: place,
        night: isNight(getCurrentSlotLabel()),
    });
    if (!yes) return false;
    const lines = await castFieldChoice(pick.member, pick.choice);
    const said = lines.join(' ');
    if (said) toastr.success(said, pick.choice.name);
    return true;
}

/**
 * J19.10: si la Luz lanzada fuera de combate sigue encendida (dura esta parte del día).
 *
 * @returns {boolean}
 */
export function fieldLightOn() {
    return lightActive(chat_metadata?.[FIELD_LIGHT_KEY], getCampaignCalendar());
}

/**
 * J19.10: lo que suma la Luz a examinar (Investigación y Percepción) aquí, si está encendida y
 * aquí está oscuro. Lo mira `rollSkillCheck` (`party/talk.js`).
 *
 * @param {string} skill
 * @returns {number}
 */
export function fieldLookBonus(skill) {
    if (!['investigation', 'perception'].includes(String(skill))) return 0;
    const night = isNight(getCurrentSlotLabel());
    return lightLookBonus(chat_metadata?.[FIELD_LIGHT_KEY], getCampaignCalendar(), darkNow(night));
}

/**
 * J19.10: lanzar una de las cosas de la magia fuera de combate y aplicarla. Los rituales los
 * lanza `rituals.js` (como el botón del grimorio); los trucos y lo que gasta espacio,
 * `castField`, y aquí se aplica lo que devuelve: el espacio gastado, lo curado, lo
 * identificado, la Luz, la pista del muerto, la alarma y el material.
 *
 * @param {any} member
 * @param {import('../game-engine/rules/field-magic.js').FieldChoice} choice
 * @returns {Promise<string[]>} Lo que se cuenta.
 */
export async function castFieldChoice(member, choice) {
    if (combatEncounter.active) return ['En plena pelea, la magia se lanza en tu turno.'];
    if (choice.how === 'ritual') {
        const said = (await import('./rituals.js')).castRitual(member, choice.id, { quiet: true });
        return said ? [said] : [];
    }
    const spell = spellRows().find((/** @type {any} */ row) => String(row?.id) === String(choice.id));
    const context = fieldContext();
    const res = castField({
        member,
        classRow: classRowOf(member),
        spell,
        carried: Array.isArray(member.items) ? member.items : [],
        context: { ...context, others: othersOf(member) },
        rollDice: (formula) => rollDiceDetailed(formula, 8).total,
    });
    if (!res.ok) return [res.reason];
    if (res.slotsUsed) member.slotsUsed = res.slotsUsed;
    for (const healed of res.effects.heal ?? []) {
        const who = partyMembers.find(m => String(m.id) === healed.memberId);
        if (who) who.hp = healed.hp;
    }
    for (const change of res.effects.identify ?? []) {
        const owner = partyMembers.find(m => String(m.id) === change.memberId);
        const items = Array.isArray(owner?.items) ? owner.items : [];
        const index = items.findIndex((/** @type {any} */ i) => String(i?.id) === change.itemId);
        if (index >= 0) items[index] = change.item;
    }
    if (res.effects.alarm) /** @type {any} */ (member).ritualAlarm = res.effects.alarm;
    // La Luz se guarda en la partida: la miran el tablero (se ve más lejos), la noche en el
    // campamento (cuenta como un fuego) y examinar aquí (+2 si está oscuro).
    if (res.effects.light && chat_metadata) {
        chat_metadata[FIELD_LIGHT_KEY] = res.effects.light;
        saveMetadata();
    }
    // D-J50: el día en que contestó este muerto; hasta siete días después no vuelve a hacerlo.
    if (res.effects.spokeDead?.key && chat_metadata) {
        chat_metadata[SPOKEN_DEAD_KEY] = { ...(chat_metadata[SPOKEN_DEAD_KEY] ?? {}), [res.effects.spokeDead.key]: res.effects.spokeDead.day };
        saveMetadata();
    }
    const lines = [...res.lines];
    for (const name of res.consumes) {
        const item = (Array.isArray(member.items) ? member.items : [])
            .find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === String(name).trim().toLowerCase());
        if (!item) continue;
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        lines.push(`Se gasta ${String(name).toLowerCase()}.`);
    }
    savePartyState();
    renderPartyMembers();
    postCombatNarration(`✨ [MAGIA] ${lines.join(' ')}`);
    // Hablar con los muertos: la pista entra en el caso, como las demás (`revealClue`).
    if (res.effects.clue) {
        const { revealClue } = await import('./cases.js');
        revealClue(res.effects.clue);
        lines.push(`Pista: ${String(res.effects.clue.fact ?? '')}`);
    }
    if (isShellOpen()) refreshGameShell();
    return lines;
}

/**
 * J19.10: Abrir la ventana de magia fuera de combate: quién lanza, lo que puede ahora y por
 * qué no, y lanzar una cosa detrás de otra (`castFieldChoice`).
 *
 * @returns {Promise<string>}
 */
export async function openFieldMagicModal() {
    if (combatEncounter.active) {
        toastr.warning('En plena pelea, la magia se lanza en tu turno.', 'Magia');
        return '';
    }
    await openFieldMagic({
        getCasters: () => fieldCasters(),
        onCast: (member, choice) => castFieldChoice(member, choice),
    });
    return '';
}

/**
 * J19: un lanzador de 5e en el grimorio: sus espacios, su concentración, sus trucos y lo
 * que tiene preparado (o sabe), con su dibujo; y sus botones.
 *
 * @param {any} member
 * @param {(action: () => Promise<any>) => void} go Cierra el grimorio y hace eso.
 * @returns {JQuery}
 */
function grimoireSection(member, go) {
    const classRow = classRowOf(member);
    const casting = casterOf(classRow);
    const box = $('<div class="gr-fifth"></div>').attr('data-member', String(member.id));
    const art = firstArt('class', { name: String(member.class ?? '') });
    const title = $('<div class="jr-title gr-who"></div>');
    if (art) title.append($('<img alt="" class="gr-class-art pixel-art">').attr('src', art));
    title.append($('<span></span>').text(`${member.name} · nivel ${Number(member.level) || 1}`));
    box.append(title);
    for (const line of magicSummaryOf(member)?.lines ?? []) box.append($('<div class="jr-item gr-line"></div>').text(line));

    const rows = spellRows();
    const list = classSpellList(classRow, rows);
    const has = (/** @type {any} */ value, /** @type {any} */ spell) => (Array.isArray(value) ? value : []).map(String).some(id => id === spell.id || spell.aliases.includes(id));
    const groups = [
        { label: 'Trucos (a voluntad)', spells: list.filter(s => s.level === 0 && has(member.cantrips, s)) },
        casting?.mode === 'known'
            ? { label: 'Los que se sabe', spells: list.filter(s => s.level > 0 && has(member.spellsKnown, s)) }
            : { label: 'Preparados hoy', spells: list.filter(s => s.level > 0 && has(member.prepared, s)) },
        ...(casting?.mode === 'spellbook' ? [{ label: 'En su libro', spells: list.filter(s => has(member.spellbook, s) && !has(member.prepared, s)) }] : []),
        ...(casting?.rituals ? [{ label: 'Rituales (sin espacio, diez minutos, no peleando)', spells: ritualSpells(member, classRow, rows) }] : []),
    ];
    for (const group of groups) {
        if (group.spells.length === 0) continue;
        box.append($('<div class="gr-group"></div>').text(group.label));
        const grid = $('<div class="gr-spells"></div>');
        for (const spell of group.spells) {
            const row = $('<div class="gr-spell gr-spell5e"></div>').attr('data-spell', spell.id).attr('title', spell.note);
            const icon = firstArt('spell', { id: spell.id, name: spell.name });
            if (icon) row.append($('<img alt="" class="gr-spell-art pixel-art">').attr('src', icon));
            row.append($('<span class="gr-spell-text"></span>').text(describeSpell5e(spell)));
            grid.append(row);
        }
        box.append(grid);
    }

    const buttons = $('<div class="gr-actions"></div>');
    if (casting && casting.mode !== 'known' && !casting.ritualsOnly) {
        const may = mayPrepare(member);
        const prepare = $('<button type="button" class="menu_button gr-prepare"></button>')
            .text('Preparar conjuros').prop('disabled', !may)
            .attr('title', may ? 'Elegir los que tendrá a mano hasta el próximo descanso largo.' : 'Se preparan al despertar, después de un descanso largo.');
        prepare.on('click', () => go(() => openSpellPreparation(member)));
        buttons.append(prepare);
    }
    // Lo de empezar lo eligió el juego: se puede cambiar una vez, hasta que se elija a mano.
    if (member.spellsChosenBy === 'juego') {
        const start = $('<button type="button" class="menu_button gr-start"></button>').text('Elegir mis conjuros de inicio');
        start.attr('title', 'El juego te dio unos para empezar; puedes cambiarlos por los que quieras de tu lista.');
        start.on('click', () => go(() => openStartingSpells(member)));
        buttons.append(start);
    }
    // J19.8 y D-J27: los rituales se lanzan de aquí, fuera de combate (`party/rituals.js`).
    if (casting?.rituals && ritualSpells(member, classRow, rows).length > 0) {
        const ritual = $('<button type="button" class="menu_button gr-ritual"></button>').text('Lanzar un ritual')
            .prop('disabled', Boolean(combatEncounter.active))
            .attr('title', combatEncounter.active ? 'Un ritual lleva diez minutos: peleando no hay tiempo.' : 'Sin gastar espacio: diez minutos más, fuera de combate.');
        ritual.on('click', () => go(async () => (await import('./rituals.js')).openRituals(member)));
        buttons.append(ritual);
    }
    if (buttons.children().length > 0) box.append(buttons);
    return box;
}

/**
 * J19: su magia en frases, para la ficha y el grimorio. `null` si no lanza con espacios.
 *
 * @param {any} member
 * @returns {{lines: string[]}|null}
 */
export function magicSummaryOf(member) {
    const classRow = classRowOf(member);
    const casting = casterOf(classRow);
    if (!casting) return null;
    if (ensureSpellsOf(member)) savePartyState();
    const stats = spellcastingStats(member, classRow);
    /** @type {string[]} */
    const lines = [];
    const slots = describeSlots(member, classRow);
    if (slots) lines.push(slots.replace(/(\d)\.º (\d+)\/(\d+)/g, 'de nivel $1: $2 de $3'));
    else if (!casting.ritualsOnly) lines.push('Todavía no tiene espacios de conjuro: llegan al subir de nivel.');
    if (casting.mode === 'known') lines.push(`Se sabe ${(member.spellsKnown ?? []).length} conjuros y ${(member.cantrips ?? []).length} trucos.`);
    else if (!casting.ritualsOnly) lines.push(`Tiene ${(member.prepared ?? []).length} de ${preparedLimit(classRow, member)} conjuros preparados y ${(member.cantrips ?? []).length} trucos.`);
    lines.push(`CD de sus conjuros: ${stats.saveDc} · ataque de conjuro: ${stats.attackBonus >= 0 ? '+' : ''}${stats.attackBonus}.`);
    const focus = describeConcentration(member.concentration, Number(combatEncounter.round) || 0);
    if (focus) lines.push(focus);
    return { lines };
}

/**
 * J19.2: si puede preparar ahora: al despertar de un descanso largo, o si nunca ha
 * preparado nada. Lo de siempre en la mesa: se prepara por la mañana.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function mayPrepare(member) {
    return !combatEncounter.active && (Boolean(member?.mayPrepare) || !Array.isArray(member?.prepared) || member.prepared.length === 0);
}

/**
 * J19.2: preparar conjuros, en su cuadro: del libro (mago) o de toda su lista (clérigo,
 * druida), de los niveles que ya lanza, hasta lo que le cabe.
 *
 * @param {any} member
 * @returns {Promise<boolean>}
 */
export async function openSpellPreparation(member) {
    const classRow = classRowOf(member);
    const casting = casterOf(classRow);
    if (!casting || casting.mode === 'known' || casting.ritualsOnly) return false;
    if (!mayPrepare(member)) {
        toastr.info('Los conjuros se preparan al despertar, después de un descanso largo.', 'Preparar');
        return false;
    }
    await loadPixelManifest();
    const rows = spellRows();
    const max = maxSpellLevel(classRow, member.level);
    const book = (Array.isArray(member.spellbook) ? member.spellbook : []).map(String);
    const options = classSpellList(classRow, rows).filter(spell => spell.level > 0 && spell.level <= max
        && (casting.mode !== 'spellbook' || book.includes(spell.id) || spell.aliases.some(a => book.includes(a))));
    const limit = preparedLimit(classRow, member);
    const { openPreparePanel } = await import('../game-engine/ui/spell-picker.js');
    const chosen = await openPreparePanel({
        who: String(member.name),
        options,
        limit,
        chosen: (Array.isArray(member.prepared) ? member.prepared : []).map(String),
        note: casting.mode === 'spellbook'
            ? `Del libro, los ${limit} que tendrá a mano hasta el próximo descanso largo. Los trucos no cuentan.`
            : `De toda la lista de su clase, los ${limit} que tendrá a mano hasta el próximo descanso largo. Los trucos no cuentan.`,
        check: (ids) => checkPreparation({ member, classRow, catalogue: rows, chosen: ids }),
        Popup,
        POPUP_TYPE,
    });
    if (!chosen) return false;
    member.prepared = chosen;
    member.mayPrepare = false;
    savePartyState();
    renderPartyMembers();
    const names = chosen.map(id => spellFor(id)?.name ?? id);
    const line = `${member.name} prepara: ${names.join(', ')}.`;
    postCombatNarration(`📖 [MAGIA] ${line}`);
    toastr.success(line, 'Conjuros preparados');
    return true;
}

/**
 * J19.2: cambiar los conjuros que el juego dio al empezar por los que uno quiera, con la
 * misma tarjeta que al subir de nivel (de nada a su nivel).
 *
 * @param {any} member
 * @returns {Promise<boolean>}
 */
export async function openStartingSpells(member) {
    const { openSpellChoiceCard } = await import('./level-up.js');
    const classRow = classRowOf(member);
    if (!casterOf(classRow)) return false;
    const blank = { ...member, cantrips: [], spellsKnown: [], spellbook: [], prepared: [] };
    const patch = await openSpellChoiceCard({ member: blank, classRow, from: 0, to: Number(member.level) || 1, title: `${member.name}: tus conjuros de inicio` });
    if (!patch) return false;
    for (const key of ['cantrips', 'spellsKnown', 'spellbook', 'prepared']) {
        if (Array.isArray(patch[key])) member[key] = patch[key];
    }
    member.spellsChosenBy = 'jugador';
    // Con el libro nuevo, se prepara de él ya: no hay que dormir para empezar.
    member.mayPrepare = true;
    savePartyState();
    renderPartyMembers();
    toastr.success(`${member.name} ya tiene los conjuros que has elegido.`, 'Conjuros');
    return true;
}

/**
 * J19.9: sintonizarse con un objeto, o dejarlo. Tres como mucho, y fuera de combate.
 *
 * @param {any} member
 * @param {string} itemId
 * @param {boolean} on
 * @returns {boolean}
 */
export function attuneItem(member, itemId, on) {
    const done = setAttunement(member, itemId, on, { inCombat: Boolean(combatEncounter.active) });
    if (!done.ok) {
        toastr.warning(done.reason, 'Sintonía');
        return false;
    }
    member.items = done.items;
    savePartyState();
    renderPartyMembers();
    const item = done.items.find((/** @type {any} */ i) => String(i?.id) === String(itemId));
    const line = on
        ? `${member.name} pasa una hora tranquila con ${item?.name ?? 'el objeto'}: ya funciona en sus manos.`
        : `${member.name} deja la sintonía con ${item?.name ?? 'el objeto'}.`;
    toastr.success(line, 'Sintonía');
    if (on) postCombatNarration(`✨ [MAGIA] ${line}`);
    return true;
}

/**
 * J19.9: cuántos objetos lleva alguien en sintonía, de cuántos.
 *
 * @param {any} member
 * @returns {string}
 */
export function attuneNoteOf(member) {
    return `En sintonía: ${attunedItems(member).length} de ${ATTUNEMENT_MAX}. Se hace fuera de combate, y solo funciona lo sintonizado.`;
}

/** Para no hacerlo dos veces si el descanso llama dos veces seguidas. */
let lastRestMagic = { kind: '', at: 0 };

/**
 * J19.1, J19.2 y J19.9: lo que devuelve un descanso a la magia, además de los espacios y las
 * cargas de los objetos (eso lo hace `takeRest`, en `party/time.js`, antes de llamar aquí).
 * Con el largo se acaba lo que duraba horas (la concentración, la Armadura de mago, la vida
 * de Ayuda) y se puede volver a preparar. Si tu personaje prepara, se le abre el cuadro al
 * despertar.
 *
 * Lo llama `takeRest` (`party/time.js`).
 *
 * @param {'corto'|'largo'} kind
 * @returns {string[]} Lo que se dice.
 */
export function afterRestMagic(kind) {
    const now = Date.now();
    if (lastRestMagic.kind === kind && now - lastRestMagic.at < 1500) return [];
    lastRestMagic = { kind, at: now };
    /** @type {string[]} */
    const lines = [];
    if (kind !== 'largo') return lines;
    for (const member of partyMembers.filter(m => !m.dead)) {
        member.concentration = null;
        delete member.spellAc;
        if (member.spellHp) {
            const bonus = Math.max(0, Number(member.spellHp.bonus) || 0);
            member.maxHp = Math.max(1, (Number(member.maxHp) || 1) - bonus);
            member.hp = Math.min(Number(member.hp) || 0, member.maxHp);
            delete member.spellHp;
        }
        const casting = casterOf(classRowOf(member));
        if (casting && casting.mode !== 'known' && !casting.ritualsOnly) member.mayPrepare = true;
    }
    savePartyState();
    const hero = partyMembers.find(m => !m.dead && !m.guest) ?? null;
    const heroCasting = hero ? casterOf(classRowOf(hero)) : null;
    if (kind === 'largo' && hero && heroCasting && heroCasting.mode !== 'known' && !heroCasting.ritualsOnly) {
        // Al despertar, después de lo que cuenta el descanso.
        setTimeout(() => { void openSpellPreparation(hero); }, 600);
    }
    return lines;
}

/**
 * Abre el panel de habilidades y guarda lo que salga.
 *
 * El catalogo viaja dentro del paquete de reglas del mundo, como las armas y las
 * condiciones; lo que cada personaje se sabe vive en su ficha.
 *
 * @returns {Promise<string>}
 */
export async function openAbilitiesEditor() {
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    if (!worldName) {
        toastr.warning('Abre una campana antes de escribir sus habilidades.');
        return '';
    }

    try {
        const data = await loadWorldInfo(worldName);
        if (!data) {
            toastr.warning(`No se pudo leer el mundo "${worldName}".`);
            return '';
        }

        const { openAbilitiesPanel } = await import('../game-engine/ui/abilities-panel.js');
        const edited = await openAbilitiesPanel({
            abilities: getPackAbilities(),
            party: partyMembers,
            conditions: getActiveRuleset()?.character?.conditions ?? [],
            Popup,
            POPUP_TYPE,
        });
        if (!edited) return '';

        // El paquete del mundo manda: si no tiene uno propio, se parte del activo para no
        // perder el resto de secciones al guardar solo las habilidades.
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = edited.abilities;
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
        await applyCampaignRuleset(worldName);

        // Y lo que cada uno se sabe, en su ficha. Una habilidad borrada deja de saberse
        // sola, porque el panel ya la quito de las listas.
        const live = new Set(edited.abilities.map((/** @type {any} */ a) => a.id));
        for (const member of partyMembers) {
            const mine = edited.known[String(member.id)] ?? [];
            member.abilities = mine.filter((/** @type {string} */ id) => live.has(id));
        }
        savePartyState();
        renderPartyMembers();
        renderLocationMapsPreview();

        const total = edited.abilities.length;
        toastr.success(`${total} habilidad(es) guardadas con las reglas de "${worldName}".`);
        return `${total} habilidades`;
    } catch (error) {
        console.error('[party] abilities editor failed', error);
        toastr.error(String(error?.message || error), 'No se pudieron guardar las habilidades');
        return '';
    }
}

/** El catalogo de habilidades del paquete de reglas activo. */
/**
 * Lo que se puede saber hacer: el paquete del mundo, y debajo las filas del compendio.
 *
 * R3: las habilidades de clase del héroe salían del compendio y se escribían en su ficha,
 * pero el catálogo solo leía el paquete, así que en combate no aparecía ninguna. Ahora el
 * compendio entra debajo; si el paquete trae una con el mismo id, manda la del paquete.
 *
 * @returns {import('../game-engine/rules/abilities.js').Ability[]}
 */
export function getAbilityCatalogue() {
    // R4: un conjuro del paquete (por su id, o el viejo de fila de datos) solo ajusta los
    // números del grimorio; lo que parezca magia y no esté en el grimorio no entra (DR3).
    /** @type {Map<string, Record<string, any>>} */
    const tuned = new Map();
    /** @type {any[]} */
    const plain = [];
    for (const row of Array.isArray(getActiveRuleset()?.abilities) ? getActiveRuleset().abilities : []) {
        const spell = spellById(String(row?.id ?? ''));
        if (spell) {
            tuned.set(spell.id, Object.fromEntries(['damage', 'healing', 'rangeFeet', 'saveDc', 'conditionRounds']
                .filter(key => row?.[key] !== undefined && row?.[key] !== '').map(key => [key, row[key]])));
            continue;
        }
        if (magicInData(row)) continue;
        plain.push(row);
    }
    const pack = normalizeAbilities(plain);
    const have = new Set(pack.map(ability => ability.id));
    // Las del mundo primero: una habilidad retocada en el taller tapa a la de serie.
    const own = (Array.isArray(lastWorldRows?.habilidades) ? lastWorldRows.habilidades : [])
        .filter((/** @type {any} */ row) => String(row?.kind || 'habilidad') === 'habilidad')
        .map(asAbility).filter((/** @type {any} */ a) => !have.has(String(a.id)) && !magicInData(a));
    for (const ability of own) have.add(String(ability.id));
    const rows = [...own, ...(lastCompendium?.has?.('habilidades')
        ? lastCompendium.find('habilidades', { kind: 'habilidad' }).map(asAbility)
            .filter((/** @type {any} */ a) => !have.has(String(a.id)) && !magicInData(a))
        : [])];
    const magic = grimoireAbilities().map(ability => ({ ...ability, ...(tuned.get(ability.id) ?? {}), aliases: spellById(ability.id)?.aliases ?? [] }));
    // J19: y debajo, los conjuros de 5e que el grimorio no tiene, con los números de serie
    // (los de cada lanzador salen en `spellAbilitiesOf`). Los piden los objetos que llevan
    // un conjuro dentro y los enemigos que lanzan.
    const grimoire = new Set(magic.map(ability => ability.id));
    const fifth = spellCatalogue().filter(spell => !grimoire.has(spell.id) && !have.has(spell.id)).map(spell => spellToAbility(spell));
    return [...pack, ...normalizeAbilities(rows), ...normalizeAbilities(magic), ...normalizeAbilities(fifth)];
}

// --- J19: la magia de 5e en juego ---------------------------------------------------------
//
// Quien es de una clase con la columna `casting` (clases.json) lanza con espacios, prepara y
// se concentra; los demás siguen con la capa ligera de siempre. Lo que sabe vive en su ficha:
// `cantrips`, `spellsKnown`, `spellbook`, `prepared`, `slotsUsed` y `concentration`.

/** @type {{from: any, rows: any[], spells: import('../game-engine/rules/spell-catalogue.js').Spell[]}} */
const spellCache = { from: null, rows: [], spells: [] };

/**
 * Las filas de `conjuros.json`, tal cual, y ya normalizadas. Se leen una vez por compendio.
 *
 * @returns {any[]}
 */
export function spellRows() {
    if (spellCache.from !== lastCompendium) {
        const rows = lastCompendium?.has?.('conjuros') ? lastCompendium.find('conjuros') : [];
        spellCache.from = rows.length > 0 ? lastCompendium : null;
        spellCache.rows = rows;
        spellCache.spells = rows.map(normalizeSpell);
    }
    return spellCache.rows;
}

/** @returns {import('../game-engine/rules/spell-catalogue.js').Spell[]} */
export function spellCatalogue() {
    spellRows();
    return spellCache.spells;
}

/**
 * Un conjuro de 5e por su id o un alias.
 *
 * @param {string} id
 * @returns {import('../game-engine/rules/spell-catalogue.js').Spell|null}
 */
export function spellFor(id) {
    return findSpell(spellCatalogue(), String(id ?? ''));
}

/**
 * La fila de clase de alguien («Maga» es la de `mago`).
 *
 * @param {any} member
 * @returns {any|null}
 */
export function classRowOf(member) {
    const rows = lastCompendium?.has?.('clases') ? lastCompendium.find('clases') : [];
    return classRowFor(String(member?.class ?? member?.charClass ?? ''), rows);
}

/**
 * Si hace magia de 5e (su clase trae `casting`).
 *
 * @param {any} member
 * @returns {boolean}
 */
export function castsLikeFifth(member) {
    return Boolean(casterOf(classRowOf(member)));
}

/**
 * Lo de empezar, para quien hace magia de 5e y aún no tiene ninguna lista: lo de su nivel,
 * lo que ya sabía primero. Se puede cambiar en el grimorio.
 *
 * @param {any} member
 * @returns {boolean} Si ha cambiado algo.
 */
export function ensureSpellsOf(member) {
    if (!member || hasSpellLists(member) || spellRows().length === 0) return false;
    const classRow = classRowOf(member);
    const patch = startingSpells({ member, classRow, catalogue: spellRows() });
    if (!patch) return false;
    Object.assign(member, patch);
    member.spellsChosenBy = 'juego';
    // Recién llegada a la magia: puede preparar ya lo suyo, sin esperar a dormir.
    member.mayPrepare = true;
    return true;
}

/**
 * D-J25: el compañero que lanza y llegó sin foco (los de un paquete llegan sin nada encima)
 * trae el suyo, una vez (`focusGift`). Tu héroe no: lo suyo lo compra.
 *
 * @param {any} member
 * @returns {boolean} Si se le ha dado.
 */
export function ensureFocusOf(member) {
    if (!member || spellRows().length === 0) return false;
    const name = focusGift({ member, classRow: classRowOf(member), isHero: member === partyMembers[0] || member.isHero === true });
    if (!name) return false;
    member.items = Array.isArray(member.items) ? member.items : [];
    addItemToInventory(member, createItem(/** @type {any} */ (describeLootItem(name))));
    member.focusGiven = true;
    return true;
}

/**
 * D-J25: los demás del grupo, para que lo que le falta a alguien diga quién lo lleva.
 *
 * @param {any} member
 * @returns {Array<{name: string, carried: any[], focus: string}>}
 */
export function othersOf(member) {
    return partyMembers.filter(m => m !== member && !m.dead).map(m => ({
        name: String(m.name ?? ''),
        carried: Array.isArray(m.items) ? m.items : [],
        focus: casterOf(classRowOf(m))?.focus ?? '',
    }));
}

/**
 * D-J25: a quién darle, al comprarlo, algo de lo que piden los conjuros (`supplyHolder`): el
 * laúd o la bolsa a quien lanza sin foco; la perla o el incienso a quien sabe el conjuro que
 * lo pide.
 *
 * @param {string} name
 * @returns {any|null} La ficha, o nulo si no le hace falta a nadie.
 */
export function supplyTakerFor(name) {
    const casters = partyMembers.filter(m => !m.dead && m.guest?.kind !== 'ward').flatMap(m => {
        const casting = casterOf(classRowOf(m));
        if (!casting) return [];
        const ids = ['cantrips', 'spellsKnown', 'spellbook', 'prepared'].flatMap(key => (Array.isArray(m[key]) ? m[key] : []).map(String));
        const needs = [...new Set(ids)].map(id => spellFor(id)?.material)
            .filter(material => material && (material.costGp > 0 || material.consumed))
            .map(material => String(material?.name ?? ''));
        return [{ id: m.id, name: String(m.name ?? ''), focus: casting.focus, carried: Array.isArray(m.items) ? m.items : [], needs }];
    });
    const who = supplyHolder({ name, casters });
    return who ? partyMembers.find(m => m.id === who.id) ?? null : null;
}

/**
 * Si está dentro de un silencio (J19.6): no puede decir las palabras.
 *
 * @param {any} member
 * @returns {boolean}
 */
function silencedHere(member) {
    if (!combatEncounter.active || !Array.isArray(combatEncounter.spellZones)) return false;
    return zoneFlagsAt(combatEncounter.spellZones, boardCellOf(member)).silence;
}

/**
 * Los conjuros que alguien puede lanzar ahora, como habilidades con sus números (su CD, su
 * ataque, su nivel para los trucos) y el espacio más bajo que le sirve. Lo que no puede, con
 * el porqué en `blocked`. Las reacciones no: saltan solas.
 *
 * @param {any} member
 * @returns {Array<Record<string, any>>}
 */
export function spellAbilitiesOf(member) {
    const classRow = classRowOf(member);
    if (!casterOf(classRow)) return [];
    // D-J25: el compañero que llegó sin foco trae el suyo.
    const gotFocus = ensureFocusOf(member);
    if (ensureSpellsOf(member) || gotFocus) savePartyState();
    const { cantrips, spells } = castableSpells(member, classRow, spellRows());
    const stats = spellcastingStats(member, classRow);
    const silenced = silencedHere(member);
    const others = othersOf(member);
    return [...cantrips, ...spells].filter(spell => spell.castingTime !== 'reaction').map(spell => {
        const verdict = canCastSpell({ member, classRow, spell, inCombat: true, carried: Array.isArray(member.items) ? member.items : [], silenced, others });
        const ability = spellToAbility(spell, {
            slotLevel: verdict.ok && verdict.slotLevel > 0 ? verdict.slotLevel : spell.level,
            casterLevel: Number(member.level) || 1,
            modifier: stats.modifier,
            saveDc: stats.saveDc,
            attackBonus: stats.attackBonus,
        });
        if (!verdict.ok) ability.blocked = verdict.reason;
        return ability;
    });
}

/**
 * Lo que alguien sabe usar: sus conjuros de 5e (si los hace) y sus habilidades de siempre.
 * A quien lanza con espacios no le salen además los del grimorio de la capa ligera: los
 * mismos conjuros, contados dos veces.
 *
 * @param {any} member
 * @returns {import('../game-engine/rules/abilities.js').Ability[]}
 */
export function knownAbilitiesOf(member) {
    const spells = normalizeAbilities(spellAbilitiesOf(member));
    const fifth = spells.length > 0 || castsLikeFifth(member);
    const own = new Set(spells.map(ability => ability.id));
    const rest = knownAbilities(member, getAbilityCatalogue())
        .filter(ability => !own.has(ability.id) && !(fifth && (typeof ability.circle === 'number' || typeof ability.spellLevel === 'number')));
    return [...spells, ...rest];
}

/**
 * Una habilidad de alguien por su id: la suya (con sus números) o, si no, la del catálogo.
 *
 * @param {any} member
 * @param {string} id
 * @returns {import('../game-engine/rules/abilities.js').Ability|null}
 */
export function abilityOf(member, id) {
    return knownAbilitiesOf(member).find(ability => ability.id === id)
        ?? getAbilityCatalogue().find(ability => ability.id === id) ?? null;
}

/**
 * El id con el que el encuentro conoce a alguien.
 *
 * @param {any} creature
 * @returns {string}
 */
function combatIdOf(creature) {
    return partyMembers.includes(creature) ? String(creature?.id ?? '') : String(creature?.instanceId ?? creature?.id ?? '');
}

/**
 * Lo que dependía de una concentración que se acaba: sus zonas, sus invocaciones, la
 * armadura que daba y los estados que había puesto.
 *
 * @param {any} ended
 * @returns {string[]}
 */
function endLinked(ended) {
    const current = readConcentration(ended);
    if (!current) return [];
    /** @type {string[]} */
    const lines = [];
    const zones = endZones(combatEncounter.spellZones ?? [], { casterId: current.casterId, spellId: current.spellId });
    if (zones.gone.length > 0) {
        combatEncounter.spellZones = zones.kept;
        lines.push(...zones.lines);
    }
    const summons = dismissSummons(combatEncounter.summons ?? [], { casterId: current.casterId, spellId: current.spellId });
    if (summons.gone.length > 0) {
        combatEncounter.summons = summons.kept;
        lines.push(...summons.lines);
    }
    for (const creature of [...partyMembers, ...(combatEncounter.enemies ?? [])]) {
        if (creature?.spellAc && String(creature.spellAc.casterId) === current.casterId && String(creature.spellAc.spellId) === current.spellId) {
            delete creature.spellAc;
            lines.push(`🛡️ A ${creature.name} se le acaba ${current.name}.`);
        }
        const marks = Array.isArray(creature?.spellMarks) ? creature.spellMarks : [];
        const { linked, rest } = linkedTo(current, marks);
        if (linked.length === 0) continue;
        creature.spellMarks = rest;
        const gone = new Set(linked.map((/** @type {any} */ m) => String(m.condition)));
        creature.activeConditions = (Array.isArray(creature.activeConditions) ? creature.activeConditions : []).filter((/** @type {string} */ c) => !gone.has(c));
        combatEncounter.conditionTimers = (combatEncounter.conditionTimers ?? []).filter((/** @type {any} */ t) => !(String(t.who) === combatIdOf(creature) && gone.has(String(t.condition))));
        lines.push(`✨ ${creature.name} se libra de ${[...gone].join(', ')}.`);
    }
    return lines;
}

/**
 * J19.4: dejar de concentrarse (a propósito, al caer o al perder la salvación), con todo
 * lo que dependía de ello.
 *
 * @param {any} creature
 * @param {string} [why]
 * @returns {string[]}
 */
export function dropConcentration(creature, why = '') {
    const ended = endConcentration(creature?.concentration, why);
    if (!ended.ended) return [];
    creature.concentration = null;
    return [...ended.lines, ...endLinked(ended.ended)];
}

/**
 * Pagar un conjuro de 5e: el espacio y el material que se gasta.
 *
 * @param {any} caster
 * @param {any} ability Con `spellLevel` y `slotLevel`.
 * @returns {string[]}
 */
function paySpellSlot(caster, ability) {
    /** @type {string[]} */
    const said = [];
    const spell = spellFor(ability.id);
    const classRow = classRowOf(caster);
    if (!spell || !casterOf(classRow)) return said;
    if (spell.level > 0) {
        const spent = spendSlot(caster, classRow, Math.max(spell.level, Number(ability.slotLevel) || spell.level));
        if (spent.ok) {
            caster.slotsUsed = spent.slotsUsed;
            said.push(`🔮 ${caster.name} gasta un espacio de ${SLOT_LABELS[/** @type {1} */ (spent.slotLevel)]}.`);
        }
    }
    const parts = componentsCheck(spell, { carried: Array.isArray(caster.items) ? caster.items : [], focus: casterOf(classRow)?.focus ?? '' });
    for (const name of parts.consumes) {
        if (consumeComponent(name)) said.push(`🧪 Se gasta ${String(name).toLowerCase()}.`);
    }
    if (partyMembers.includes(caster)) showTip('spell');
    return said;
}

/**
 * R4: lo que lleva encima el grupo, por nombre, para los componentes de los conjuros.
 *
 * @returns {string[]}
 */
export function carriedNames() {
    return partyMembers.filter(m => !m.dead).flatMap(m => (Array.isArray(m.items) ? m.items : []).map((/** @type {any} */ item) => String(item?.name ?? '')));
}

/**
 * R4: lo que gastan los conjuros que el grupo sabe, para que la botica lo tenga.
 *
 * @returns {string[]}
 */
export function neededComponents() {
    return [...new Set(partyMembers.filter(m => !m.dead).flatMap(m => knownSpells(m)).map(s => String(s.component ?? '')).filter(Boolean))];
}

/**
 * R4: gastar un componente, de quien lo lleve.
 *
 * @param {string} name
 * @returns {boolean}
 */
function consumeComponent(name) {
    const wanted = String(name).trim().toLowerCase();
    for (const member of partyMembers) {
        const item = (Array.isArray(member.items) ? member.items : []).find((/** @type {any} */ i) => String(i?.name ?? '').trim().toLowerCase() === wanted);
        if (!item) continue;
        removeItemFromInventory(/** @type {any} */ (member), String(item.id));
        return true;
    }
    return false;
}

/**
 * R4: pagar un conjuro: la carga de su círculo y lo que gaste.
 *
 * @param {any} caster
 * @param {any} ability
 * @returns {string[]} Lo que se dice.
 */
export function payForSpell(caster, ability) {
    /** @type {string[]} */
    const said = [];
    // J19: un conjuro de 5e gasta su espacio y su material, no las cargas del círculo.
    if (typeof ability?.spellLevel === 'number') return paySpellSlot(caster, ability);
    if (typeof ability?.circle !== 'number') return said;
    if (ability.circle > 0) caster.spellCharges = spendCharge(caster, ability.circle);
    // H1: el primer conjuro del grupo dice cómo va lo de las cargas.
    if (partyMembers.includes(caster)) showTip('spell');
    if (ability.component && partyMembers.includes(caster) && consumeComponent(ability.component)) {
        said.push(`🧪 Se gasta ${String(ability.component).toLowerCase()}.`);
    }
    return said;
}

/**
 * R4: la nigromancia que daña o levanta muertos (D-J26), en un sitio con gente, es un crimen; y a los tuyos les parece lo que
 * les parece (a quien busca tranquilidad, mal).
 *
 * @param {any} ability
 * @returns {string[]}
 */
export function magicConsequences(ability) {
    /** @type {string[]} */
    const said = [];
    // D-J26: solo la que daña o levanta muertos. Revivir o Hablar con los muertos, no.
    if (!magicIsCrime(ability)) return said;
    judgeDecision('nigromancia', { quiet: true });
    const here = hereLocation();
    const type = String(here?.locationType ?? here?.type ?? '').toLowerCase();
    if (chat_metadata && currentLocationName && Object.hasOwn(WATCH, type)) {
        const wanted = readWanted(chat_metadata[WANTED_KEY]);
        const level = (wanted[currentLocationName] ?? 0) + 1;
        chat_metadata[WANTED_KEY] = { ...wanted, [currentLocationName]: level };
        saveMetadata();
        said.push(`👁️ [GUARDIAS] Alguien os ha visto usar nigromancia en ${currentLocationName}: ahora os buscan (buscados: ${level}).`);
        // J11.3: y el pueblo se acuerda (en la capilla, más).
        leaveMark('nigromancia');
        // R9: y quien manda aquí lo nota.
        void nudgeRuler(currentLocationName, 'nigromancia');
    }
    return said;
}

/** Solo las del paquete del mundo: lo que el editor de habilidades escribe. */
function getPackAbilities() {
    return normalizeAbilities(getActiveRuleset()?.abilities);
}

/**
 * El modificador de una caracteristica, que es la misma cuenta de siempre.
 *
 * @param {any} creature
 * @param {string} ability
 */
function abilityModifier(creature, ability) {
    return Math.floor(((Number(creature?.[ability]) || 10) - 10) / 2);
}

/**
 * Pone una condicion, con fecha de caducidad si la habilidad la trae.
 *
 * Lo puesto a mano con `/condition` no lleva apunte y se quita a mano; lo que pone una
 * habilidad se va solo al pasar las rondas que dijo. Un "una ronda" que dura para siempre
 * seria un numero decorativo.
 *
 * @param {any} creature
 * @param {string} who El id con el que el encuentro lo conoce.
 * @param {string} condition
 * @param {number} rounds
 */
export function applyTimedCondition(creature, who, condition, rounds) {
    creature.activeConditions = Array.isArray(creature.activeConditions) ? creature.activeConditions : [];
    if (!creature.activeConditions.includes(condition)) creature.activeConditions.push(condition);

    combatEncounter.conditionTimers = addConditionTimer(combatEncounter.conditionTimers, {
        who, condition, round: Number(combatEncounter.round) || 1, rounds,
    });
}

/**
 * Quita lo que ya ha caducado al empezar una ronda.
 *
 * @returns {string[]} Lo que se ha ido, ya escrito.
 */
export function expireTimedConditions() {
    const { timers, expired } = expireConditions(combatEncounter.conditionTimers, Number(combatEncounter.round) || 1);
    combatEncounter.conditionTimers = timers;
    if (expired.length === 0) return [];

    const lines = [];
    for (const gone of expired) {
        const enemy = combatEncounter.enemies.find(e => String(e.instanceId) === gone.who);
        const member = partyMembers.find(m => String(m.id) === gone.who);
        const creature = enemy || member;
        if (!creature) continue;

        creature.activeConditions = (Array.isArray(creature.activeConditions) ? creature.activeConditions : [])
            .filter((/** @type {string} */ c) => c !== gone.condition);
        lines.push(`✨ [COMBAT] A ${creature.name} se le pasa: ${gone.condition}.`);
    }
    return lines;
}

/**
 * Usa una habilidad sobre alguien, o sobre uno mismo.
 *
 * Resuelve y aplica: la decision de si se puede y de que pasa esta en `rules/abilities.js`,
 * y aqui solo se escribe en las fichas y se cuenta.
 *
 * @param {any} member Quien la usa.
 * @param {any} ability
 * @param {any} target El enemigo o el companero, o null para uno mismo.
 * @returns {string}
 */
export function useAbility(member, ability, target) {
    const turnState = getCurrentTurnState();
    if (!combatEncounter.active || !turnState) {
        toastr.warning('No hay un turno de jugador activo.');
        return '';
    }
    // J19: un conjuro de 5e, con los números de quien lo lanza (su CD, su ataque, su espacio),
    // aunque el botón lo haya buscado en el catálogo de serie.
    // Y un id que el grimorio también tiene (Curar heridas) es el suyo de 5e, no el de círculos.
    if (castsLikeFifth(member)) ability = knownAbilitiesOf(member).find(a => a.id === ability.id) ?? ability;

    const isSelf = ability.target === 'self';
    const subject = isSelf ? member : target;
    if (!subject) {
        toastr.warning('Esa habilidad necesita un objetivo.');
        return '';
    }

    const origin = member.mapPosition || { gridX: 0, gridY: 0 };
    const at = subject.mapPosition || { gridX: subject.gridX ?? 0, gridY: subject.gridY ?? 0 };
    const distanceFeet = isSelf ? 0 : getDistanceInFeet(
        origin.gridX || 0, origin.gridY || 0,
        at.gridX ?? at.x ?? 0, at.gridY ?? at.y ?? 0,
    );

    const alive = ability.target === 'enemy'
        ? (Number(subject.currentHp) || 0) > 0
        : (Number(subject.hp) || 0) > 0 || isSelf;

    const verdict = canUseAbility({
        member,
        ability,
        distanceFeet,
        hasAction: hasAction(combatEncounter, 'action'),
        hasBonus: hasAction(combatEncounter, 'bonus'),
        targetAlive: alive,
        // R4: los componentes de los conjuros.
        carried: carriedNames(),
    });
    if (!verdict.ok) {
        toastr.warning(verdict.reason);
        return '';
    }
    // J19: y lo suyo de 5e con la acción de verdad: preparado, espacio, foco, silencio.
    const spell = typeof ability.spellLevel === 'number' ? spellFor(ability.id) : null;
    if (spell && castsLikeFifth(member)) {
        const cast = canCastSpell({
            member, classRow: classRowOf(member), spell,
            slotLevel: Number(ability.slotLevel) > 0 ? Number(ability.slotLevel) : undefined,
            inCombat: true,
            hasAction: hasAction(combatEncounter, 'action'),
            hasBonus: hasAction(combatEncounter, 'bonus'),
            carried: Array.isArray(member.items) ? member.items : [],
            silenced: silencedHere(member),
            others: othersOf(member),
        });
        if (!cast.ok) {
            toastr.warning(cast.reason);
            return '';
        }
    }

    // El coste se paga aunque falle: lanzar y errar tambien gasta el turno.
    if (ability.cost !== 'free') {
        Object.assign(combatEncounter, useAction(combatEncounter, ability.cost === 'bonus' ? 'bonus' : 'action'));
    }
    member.abilityUses = spendAbilityUse(member, ability);
    // R4: un conjuro gasta una carga de su círculo y lo que pida.
    const paid = payForSpell(member, ability);

    // R3: a uno o en área, por el mismo camino que los enemigos.
    const lines = [...resolveAbilityOnBoard({ actor: member, side: 'party', ability, subject }), ...paid, ...magicConsequences(ability)];

    saveCombatState();
    savePartyState();
    postCombatNarration(lines.join('\n'));
    renderPartyMembers();
    renderLocationMapsPreview();
    if (!checkScenarioOutcome() && getAliveEnemies().length === 0 && !judgeCurrentScenario()) {
        postCombatNarration('🏆 [COMBAT] Todos los enemigos han sido derrotados.');
        endCombat('victory');
    }

    return `${member.name} usa ${ability.name}`;
}

/**
 * R3: a quién alcanzaría una habilidad apuntada a una casilla. El área no distingue bandos;
 * las que van sobre aliados solo tocan a los del bando de quien la lanza (una canción no
 * cura al enemigo), y quien la lanza nunca se da a sí mismo con lo que hace daño.
 *
 * @param {any} actor
 * @param {'party'|'enemy'} side
 * @param {any} ability
 * @param {any} subject
 * @returns {{cells: Array<{x: number, y: number}>, victims: Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>}}
 */
export function abilityVictims(actor, side, ability, subject) {
    const aim = boardCellOf(subject);
    if (!isArea(ability.area)) {
        /** @type {'party'|'enemy'} */
        const kind = partyMembers.includes(subject) ? 'party' : 'enemy';
        /** @type {Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>} */
        const victims = [{ kind, ref: subject, ...aim }];
        // J19: un conjuro para varios (Bendición, Ayuda, Inmovilizar a más nivel): los más
        // cercanos al elegido, del mismo bando y a su alcance.
        const more = Math.max(1, Math.floor(Number(ability.targets) || 1)) - 1;
        if (more > 0) {
            const from = boardCellOf(actor);
            const same = kind === 'party'
                ? partyMembers.filter(m => m !== subject && !m.dead && (Number(m.hp) || 0) > 0)
                : getAliveEnemies().filter(e => e !== subject);
            const near = same
                .map(ref => ({ ref, ...boardCellOf(ref) }))
                .filter(c => getDistanceInFeet(from.x, from.y, c.x, c.y) <= Math.max(5, Number(ability.rangeFeet) || 5))
                .sort((a, b) => getDistanceInFeet(aim.x, aim.y, a.x, a.y) - getDistanceInFeet(aim.x, aim.y, b.x, b.y))
                .slice(0, more);
            victims.push(...near.map(c => ({ kind, ref: c.ref, x: c.x, y: c.y })));
        }
        return { cells: [aim], victims };
    }
    const context = getActiveBoardContext();
    const cells = areaCells({
        area: ability.area, origin: boardCellOf(actor), aim,
        terrain: context.terrain, width: context.gridWidth, height: context.gridHeight,
    });
    /** @type {Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>} */
    const creatures = [
        ...getAliveEnemies().map(e => ({ kind: /** @type {'enemy'} */ ('enemy'), ref: e, ...boardCellOf(e) })),
        ...partyMembers.filter(m => !m.dead && (Number(m.hp) || 0) > 0).map(m => ({ kind: /** @type {'party'} */ ('party'), ref: m, ...boardCellOf(m) })),
    ];
    const friendly = ability.target === 'ally';
    const victims = creaturesIn(cells, creatures).filter(v => (friendly ? v.kind === side : v.ref !== actor));
    return { cells, victims };
}

/**
 * R3 del roadmap de profundidad: una habilidad sobre el tablero, a uno o en área, para los
 * dos bandos. Decide a quién toca (`rules/area.js`), tira por cada uno con
 * `planAbilityUse`, aplica, y deja su huella en el terreno (`rules/tags.js`): un rayo de
 * fuego prende las cajas, un cono de escarcha hiela el charco.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {any} input.ability
 * @param {any} input.subject El objetivo elegido, o quien la lanza si es sobre sí mismo.
 * @returns {string[]}
 */
export function resolveAbilityOnBoard({ actor, side, ability, subject }) {
    const area = isArea(ability.area);
    const { cells, victims } = abilityVictims(actor, side, ability, subject);
    const friendly = ability.target === 'ally';
    /** @type {string[]} */
    const lines = [];
    if (area) {
        lines.push(`✨ ${actor.name} usa ${ability.name} (${describeArea(ability.area)}).`);
        if (victims.length === 0) lines.push('No alcanza a nadie.');
        const own = friendly ? [] : victims.filter(v => v.kind === side);
        if (own.length > 0) lines.push(`⚠️ También alcanza a ${own.map(v => v.ref.name).join(', ')}, de los suyos.`);
    }

    const context = getActiveBoardContext();
    const element = elementOf(ability);
    const outdoors = context.board ? !isIndoors(context.board, hereLocation()) : true;
    const wet = Boolean(boardVisibility().wet);
    // J19: lo de 5e que va antes de tirar (la concentración, la zona, las invocaciones, lo
    // que duerme por puntos de vida). Si eso ya ha hecho lo suyo, no se tira uno a uno.
    const spell = typeof ability.spellLevel === 'number' ? spellFor(ability.id) : null;
    const fifth = spell ? castSpellExtras({ actor, side, ability, spell, cells, victims, aim: boardCellOf(subject) }) : null;
    if (fifth) lines.push(...fifth.lines);
    // J19: los rayos separados (Proyectil mágico, Rayo abrasador), todos al elegido.
    const rays = spell && !area ? Math.max(1, Math.floor(Number(ability.rays) || 1)) : 1;
    // R4: lo que se quita con un conjuro que roba vida.
    let drained = 0;
    for (const victim of fifth?.done ? [] : victims) {
        const target = victim.ref;
        /** @type {any} */
        let last = null;
        for (let ray = 0; ray < rays; ray++) {
            if (ray > 0 && (Number(target.currentHp ?? target.hp) || 0) <= 0) break;
            const plan = planAbilityUse({
                actor,
                target,
                ability,
                roll: (/** @type {string} */ formula) => rollDiceDetailed(formula, 8),
                // J19: un conjuro de 5e ataca con su bono de conjuro, no con el del arma.
                attackModifier: spell && typeof ability.attackBonus === 'number' && side === 'party'
                    ? ability.attackBonus
                    : side === 'party'
                        ? getPlayerAttackModifier(actor, ability.rangeFeet)
                        : Math.max(getAbilityModifier(actor.strength || 10), getAbilityModifier(actor.dexterity || 10)),
                targetAc: friendly || target === actor ? 10 : getTargetArmorClass(target, actor).ac,
                saveModifier: abilityModifier(target, ability.saveAbility),
            });
            // J19.7: a quien del grupo le acierta el conjuro de ataque de un enemigo, Escudo, si
            // lo sabe y con él ya no entra (un crítico entra igual).
            if (side === 'enemy' && victim.kind === 'party' && ability.resolution === 'attack' && plan.hit && !plan.crit) {
                const shield = shieldAgainst(target, { attackTotal: plan.attackTotal, targetAc: getTargetArmorClass(target, actor).ac });
                if (shield.blocked) Object.assign(plan, { hit: false, damage: 0, condition: '', conditionRounds: 0, lines: [...plan.lines.slice(0, 2), ...shield.lines, '❌ Falla.'] });
            }
            if (area || ray > 0) {
                lines.push(rays > 1 ? `➤ Rayo ${ray + 1}:` : `➤ ${target.name}:`);
                lines.push(...plan.lines.slice(1));
            } else {
                lines.push(...plan.lines);
            }
            lines.push(...applyAbilityPlan({ actor, side, victim, plan }));
            if (ability.drain && victim.kind !== side) drained += plan.damage;
            if (spell) lines.push(...spellAfterEffects({ actor, side, spell, ability, victim, plan }));
            last = plan;
        }
        const plan = last ?? { hit: false, saved: true };

        // El elemento y dónde está, o cómo está: en el agua, el frío hiela.
        if (element && plan.hit && !plan.saved && (Number(target.currentHp ?? target.hp) || 0) > 0) {
            const standingOn = context.terrain ? getCell(context.terrain, victim.x, victim.y).type : 'floor';
            const conditions = [...(Array.isArray(target.activeConditions) ? target.activeConditions : []), ...(wet && outdoors ? ['Mojado'] : [])];
            const combo = comboFor({ element, standingOn, conditions });
            if (combo) {
                if (combo.remove) {
                    target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : []).filter((/** @type {string} */ c) => c !== combo.remove);
                }
                if (combo.add) applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), combo.add, combo.rounds);
                lines.push(`${ELEMENT_ICONS[/** @type {keyof typeof ELEMENT_ICONS} */ (element)] ?? '✨'} ${target.name}: ${combo.line}.`);
            }
        }
    }

    // R4: lo que se roba, se queda.
    if (drained > 0) {
        const back = Math.floor(drained / 2);
        if (side === 'party') actor.hp = Math.min(Number(actor.maxHp) || 0, (Number(actor.hp) || 0) + back);
        else actor.currentHp = Math.min(Number(actor.maxHp) || 0, (Number(actor.currentHp) || 0) + back);
        if (back > 0) lines.push(`🩸 ${actor.name} se queda con ${back} PG de lo que quita.`);
    }

    // La huella en el tablero: lo que prende, lo que se hiela, lo que queda en el suelo.
    const board = context.board;
    if (board && context.terrain && (element || ability.leaves)) {
        let terrain = context.terrain;
        let hazards = Array.isArray(board.hazards) ? board.hazards : [];
        /** @type {string[]} */
        const said = [];
        if (element) {
            const out = reactTerrain({ element, cells, terrain, hazards, round: Number(combatEncounter.round) || 1, outdoors, wet });
            terrain = out.terrain;
            hazards = out.hazards;
            said.push(...out.lines);
            // R6: los barriles que ha tocado el fuego revientan.
            said.push(...explodeBarrels(out.changed.filter(c => c.from === 'barrel')));
        }
        // R4: un muro de fuego deja cada casilla ardiendo, sea de lo que sea (salvo la lluvia).
        if (ability.leaves === 'fuego' && !wet) {
            let lit = 0;
            for (const cell of cells) {
                if (hazards.some((/** @type {any} */ h) => h.kind === 'fuego' && h.armed !== false && Number(h.x) === cell.x && Number(h.y) === cell.y)) continue;
                hazards = [...hazards, fireAt({ x: cell.x, y: cell.y, round: Number(combatEncounter.round) || 1, what: 'Muro de fuego' })];
                lit++;
            }
            if (lit > 0) said.push(`🔥 Arden ${lit} casilla(s) durante tres rondas.`);
        }
        if (ability.leaves && Object.hasOwn(TERRAIN_TYPES, ability.leaves)) {
            let left = 0;
            for (const cell of cells) {
                if (getCell(terrain, cell.x, cell.y).type !== 'floor') continue;
                terrain = setTerrainCell(terrain, cell.x, cell.y, ability.leaves);
                left++;
            }
            if (left > 0) said.push(`🪤 El suelo queda ${ability.leaves === 'difficult' ? 'difícil de pisar' : 'cambiado'} en ${left} casilla(s).`);
        }
        if (said.length > 0) {
            board.terrain = terrain;
            board.hazards = hazards;
            persistBoardTerrain(board);
            lines.push(...said);
        }
    }
    return lines;
}

/**
 * R3: aplicar a una víctima lo que decidió `planAbilityUse`. El daño cae sobre quien sea,
 * del bando que sea: un área no pregunta.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {{kind: 'party'|'enemy', ref: any}} input.victim
 * @param {any} input.plan
 * @returns {string[]}
 */
function applyAbilityPlan({ actor, side, victim, plan }) {
    /** @type {string[]} */
    const lines = [];
    const target = victim.ref;
    if (plan.damage > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.max(0, (Number(target.currentHp) || 0) - plan.damage);
            if (side === 'party') {
                combatEncounter.tally = noteDealt(combatEncounter.tally, actor.id, plan.damage, target.currentHp === 0);
                if (target.currentHp === 0) recordFeat(actor, 'kill', String(target.name));
            }
            floatOnToken(enemyTokenId(target), `-${plan.damage}`, 'damage');
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
            if (target.currentHp === 0) {
                lines.push(`☠️ ${target.name} cae derrotado.`);
                combatEncounter.conditionTimers = clearTimersFor(combatEncounter.conditionTimers, String(target.instanceId));
            }
        } else {
            lines.push(...damagePartyMember(target, plan.damage, plan.crit));
        }
    }
    if (plan.healing > 0) {
        if (victim.kind === 'enemy') {
            target.currentHp = Math.min(Number(target.maxHp) || 0, (Number(target.currentHp) || 0) + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.currentHp}/${target.maxHp}`);
        } else {
            const before = Number(target.hp) || 0;
            target.hp = Math.min(Number(target.maxHp) || before, before + plan.healing);
            lines.push(`❤️ Estado de ${target.name}: ${target.hp}/${target.maxHp}`);
            // Curar a quien estaba en el suelo lo levanta y borra la cuenta: es para lo que
            // sirve una curacion en mitad de un combate.
            if (before <= 0 && target.hp > 0) {
                target.deathSaves = clearDeathSaves();
                target.activeConditions = (Array.isArray(target.activeConditions) ? target.activeConditions : [])
                    .filter((/** @type {string} */ c) => c !== 'Unconscious');
                lines.push(`🙌 ${target.name} vuelve en si.`);
            }
        }
    }
    if (plan.condition) {
        applyTimedCondition(target, victim.kind === 'enemy' ? String(target.instanceId) : String(target.id), plan.condition, plan.conditionRounds);
    }
    return lines;
}

/** Las casillas por las que un empujón puede arrastrar a alguien. */
const PUSHABLE = ['floor', 'difficult', 'water', 'ice', 'brush', 'stairs', 'exit', 'cover_half'];

/**
 * J19: empujar a alguien lejos de quien lanza (Ola de trueno), casilla a casilla, hasta
 * donde deje el tablero: un muro, una puerta cerrada u otro cuerpo paran el empujón.
 *
 * @param {any} actor
 * @param {{ref: any}} victim
 * @param {number} feet
 * @returns {string}
 */
function pushAway(actor, victim, feet) {
    const from = boardCellOf(actor);
    const context = getActiveBoardContext();
    let { x, y } = boardCellOf(victim.ref);
    const dx = Math.sign(x - from.x);
    const dy = Math.sign(y - from.y);
    if (dx === 0 && dy === 0) return '';
    const taken = new Set([
        ...partyMembers.filter(m => !m.dead && m !== victim.ref),
        ...getAliveEnemies().filter(e => e !== victim.ref),
    ].map(c => `${boardCellOf(c).x},${boardCellOf(c).y}`));
    let moved = 0;
    for (let step = 0; step < Math.floor(Number(feet) / 5); step++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= context.gridWidth || ny >= context.gridHeight) break;
        const cell = context.terrain ? getCell(context.terrain, nx, ny) : { type: 'floor' };
        const open = PUSHABLE.includes(String(cell.type)) || (cell.type === 'door' && /** @type {any} */ (cell).open);
        if (!open || taken.has(`${nx},${ny}`)) break;
        x = nx;
        y = ny;
        moved++;
    }
    if (moved === 0) return '';
    if (victim.ref.mapPosition) Object.assign(victim.ref.mapPosition, { gridX: x, gridY: y });
    else Object.assign(victim.ref, { gridX: x, gridY: y });
    return `💨 ${victim.ref.name} sale despedido ${moved * 5} pies.`;
}

/**
 * J19: lo que hace un conjuro de 5e antes de tirar por nadie, y si con eso ya está hecho:
 *
 * - la concentración (J19.4): la de antes se acaba, con lo que dependía de ella;
 * - lo que deshace zonas (la luz del día, Disipar magia);
 * - la zona (J19.6), que se queda en `combatEncounter.spellZones`, y lo que le hace ya a
 *   quien está dentro al aparecer (el resto de turnos, al entrar o al empezar, lo lleva el
 *   combate);
 * - las invocaciones (J19.5), que van a `combatEncounter.summons`;
 * - lo que duerme por puntos de vida (Dormir), de menos vida a más.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {any} input.ability
 * @param {import('../game-engine/rules/spell-catalogue.js').Spell} input.spell
 * @param {Array<{x: number, y: number}>} input.cells
 * @param {Array<{kind: 'party'|'enemy', ref: any, x: number, y: number}>} input.victims
 * @param {{x: number, y: number}} input.aim
 * @returns {{lines: string[], done: boolean}}
 */
function castSpellExtras({ actor, side, ability, spell, cells, victims, aim }) {
    /** @type {string[]} */
    const lines = [];
    const round = Number(combatEncounter.round) || 1;
    const casterId = combatIdOf(actor);
    const up = upcastSpell(spell, Number(ability.slotLevel) || spell.level);
    const roll = (/** @type {string} */ formula) => rollDiceDetailed(formula, 8);
    let done = false;

    if (spell.concentration) {
        const started = startConcentration({ current: actor.concentration, spell, casterId, round });
        lines.push(...started.lines);
        if (started.ended) lines.push(...endLinked(started.ended));
        actor.concentration = started.concentration;
        lines.push(`🧠 ${actor.name} se concentra en ${spell.name}: si le hieren, puede perderlo.`);
    }

    if (spell.clearsZones.length > 0 || spell.dispels) {
        const cleared = clearZones({ zones: combatEncounter.spellZones ?? [], kinds: spell.dispels ? Object.keys(ZONE_KINDS) : spell.clearsZones, cells });
        combatEncounter.spellZones = cleared.zones;
        lines.push(...cleared.lines);
    }
    if (spell.dispels) {
        for (const victim of victims) {
            if (victim.ref.concentration) lines.push(...dropConcentration(victim.ref, 'se la deshace la magia'));
            if (victim.ref.spellAc) {
                delete victim.ref.spellAc;
                lines.push(`✨ A ${victim.ref.name} se le deshace la magia que le protegía.`);
            }
        }
        done = !spell.damage;
    }

    if (spell.zone) {
        const zone = zoneFromSpell({ spell, cells, center: aim, casterId, round, saveDc: Number(ability.saveDc) || 13, damage: up.damage });
        if (zone) {
            const placed = placeZone(combatEncounter.spellZones ?? [], zone);
            combatEncounter.spellZones = placed.zones;
            const kind = kindOf(zone.kind);
            const lasts = zone.until ? ` durante ${zone.until - round} ronda(s)` : '';
            lines.push(`${kind.icon} ${zone.name} cubre ${zone.cells.length} casilla(s)${lasts}. ${kind.tell}`.trim(), ...placed.lines);
            if (zone.effect && zone.triggers.length > 0) {
                // Lo que va con quien lo lanza (los espíritus) no toca a los suyos.
                for (const victim of victims.filter(v => !(kind.follows && v.kind === side))) {
                    const target = victim.ref;
                    const hit = resolveZoneEffect({ effect: { ...zone.effect, name: zone.name }, roll, saveModifier: abilityModifier(target, zone.effect.save), targetName: target.name });
                    lines.push(...hit.lines);
                    lines.push(...applyAbilityPlan({ actor, side, victim, plan: { damage: hit.damage, healing: 0, crit: false, condition: hit.condition, conditionRounds: hit.conditionRounds } }));
                    if (hit.condition && spell.concentration) {
                        target.spellMarks = [...(Array.isArray(target.spellMarks) ? target.spellMarks : []), { casterId, spellId: spell.id, condition: hit.condition }];
                    }
                }
            }
            done = true;
        }
    }

    if (spell.summon) {
        const context = getActiveBoardContext();
        const occupied = [
            ...partyMembers.filter(m => !m.dead).map(m => boardCellOf(m)),
            ...getAliveEnemies().map(e => boardCellOf(e)),
            ...(Array.isArray(combatEncounter.summons) ? combatEncounter.summons : []).map((/** @type {any} */ t) => ({ x: Number(t.x) || 0, y: Number(t.y) || 0 })),
        ];
        const summoned = planSummon({
            spell,
            caster: { id: casterId, name: String(actor.name ?? ''), ...boardCellOf(actor) },
            round,
            count: up.count,
            bestiary: lastCompendium?.has?.('bestiario') ? lastCompendium.find('bestiario') : [],
            occupied,
            terrain: context.terrain,
            width: context.gridWidth,
            height: context.gridHeight,
        });
        combatEncounter.summons = [...(Array.isArray(combatEncounter.summons) ? combatEncounter.summons : []), ...summoned.tokens];
        lines.push(...summoned.lines);
        done = true;
    }

    if (spell.hpPool) {
        const pool = Math.max(0, Number(roll(up.hpPool).total) || 0);
        const fallen = hpPoolTargets(victims.map(v => v.ref), pool);
        lines.push(`🎲 ${spell.name}: ${up.hpPool} = ${pool} puntos de vida que tumbar.`);
        const condition = spell.condition || 'Unconscious';
        for (const victim of victims.filter(v => fallen.includes(v.ref))) {
            applyTimedCondition(victim.ref, combatIdOf(victim.ref), condition, spell.conditionRounds);
            lines.push(`💤 ${victim.ref.name} cae redondo.`);
        }
        if (fallen.length === 0) lines.push('Nadie cae: aguantan más de lo que da.');
        done = true;
    }
    return { lines, done };
}

/**
 * J19: lo que deja un conjuro de 5e en quien alcanza, después de la tirada: quitar estados,
 * estabilizar, devolver a la vida, más vida máxima, armadura, empujar; y apuntar el estado
 * que depende de una concentración, para quitarlo cuando se acabe.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {'party'|'enemy'} input.side
 * @param {import('../game-engine/rules/spell-catalogue.js').Spell} input.spell
 * @param {any} input.ability
 * @param {{kind: 'party'|'enemy', ref: any}} input.victim
 * @param {any} input.plan
 * @returns {string[]}
 */
function spellAfterEffects({ actor, side, spell, ability, victim, plan }) {
    /** @type {string[]} */
    const lines = [];
    const target = victim.ref;
    const casterId = combatIdOf(actor);
    if (spell.concentration && plan.condition) {
        target.spellMarks = [...(Array.isArray(target.spellMarks) ? target.spellMarks : []), { casterId, spellId: spell.id, condition: plan.condition }];
    }
    if (!plan.hit || plan.saved) return lines;
    if (spell.removes.length > 0) {
        const had = Array.isArray(target.activeConditions) ? target.activeConditions : [];
        const gone = had.filter((/** @type {string} */ c) => spell.removes.includes(c));
        if (gone.length > 0) {
            target.activeConditions = had.filter((/** @type {string} */ c) => !gone.includes(c));
            combatEncounter.conditionTimers = (combatEncounter.conditionTimers ?? []).filter((/** @type {any} */ t) => !(String(t.who) === combatIdOf(target) && gone.includes(String(t.condition))));
            lines.push(`✨ A ${target.name} se le pasa: ${gone.join(', ')}.`);
        }
    }
    if (spell.stabilizes && victim.kind === 'party' && (Number(target.hp) || 0) <= 0 && !target.dead) {
        target.deathSaves = { ...clearDeathSaves(), stable: true };
        lines.push(`🩹 ${target.name} deja de desangrarse: estabilizado.`);
    }
    if (spell.revives && victim.kind === 'party' && (target.dead || target.deathSaves?.dead)) {
        target.dead = false;
        target.hp = Math.max(1, spell.revives.hp);
        target.deathSaves = clearDeathSaves();
        lines.push(`🕯️ ${target.name} vuelve de la orilla con ${target.hp} PG.`);
    }
    const bonus = upcastSpell(spell, Number(ability.slotLevel) || spell.level).maxHpBonus;
    if (bonus > 0 && victim.kind === 'party' && !target.spellHp) {
        target.spellHp = { bonus, spellId: spell.id, name: spell.name };
        target.maxHp = (Number(target.maxHp) || 0) + bonus;
        target.hp = (Number(target.hp) || 0) + bonus;
        lines.push(`💪 ${target.name} tiene ${bonus} PG más, también de máximo (${spell.name}).`);
    }
    if (spell.ac) {
        const before = getTargetArmorClass(target).ac;
        target.spellAc = { ...spell.ac, spellId: spell.id, casterId, name: spell.name };
        const after = getTargetArmorClass(target).ac;
        lines.push(`🛡️ ${target.name}: ${spell.name}, CA ${before} → ${after}.`);
    }
    if (spell.pushFeet > 0 && victim.kind !== side) {
        const pushed = pushAway(actor, victim, spell.pushFeet);
        if (pushed) lines.push(pushed);
    }
    return lines;
}

/**
 * Idea 54: aprender con quien enseña. Se paga (ya pagado al pulsar), pasan los días, y la
 * habilidad entra en el catálogo del mundo si no estaba y en la ficha de quien aprende.
 *
 * @param {string} memberId
 * @param {string} abilityId
 * @returns {Promise<void>}
 */
export async function learnAbility(memberId, abilityId) {
    const member = partyMembers.find(m => String(m.id) === String(memberId));
    const worldName = String(chat_metadata?.[METADATA_KEY] || '');
    // R4: un conjuro no se escribe en el paquete: vive en el grimorio. Se aprende y ya.
    const spell = spellById(String(abilityId));
    if (member && spell) {
        member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), spell.id])];
        for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
        savePartyState();
        const line = describeLesson(String(member.name), spellAbility(spell), currentLocationName);
        noteDeed(line);
        toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
        return;
    }
    if (!member || !worldName || !lastCompendium?.has?.('habilidades')) return;
    const ability = lastCompendium.find('habilidades', { kind: 'habilidad' })
        .filter((/** @type {any} */ row) => String(row.id) === String(abilityId))
        .map(asAbility)[0];
    if (!ability) return;
    await worldWrite(async () => {
        const data = await loadWorldInfo(worldName);
        if (!data) return;
        const pack = structuredClone(data.metadata?.rulesetPack ?? getActiveRuleset());
        pack.abilities = Array.isArray(pack.abilities) ? pack.abilities : [];
        if (!pack.abilities.some((/** @type {any} */ a) => String(a?.id) === ability.id)) pack.abilities.push(ability);
        data.metadata = data.metadata ?? {};
        data.metadata.rulesetPack = pack;
        await saveWorldInfo(worldName, data, true);
    });
    await applyCampaignRuleset(worldName);
    member.abilities = [...new Set([...(Array.isArray(member.abilities) ? member.abilities.map(String) : []), ability.id])];
    for (let day = 0; day < LESSON.days; day++) advanceCampaignDay();
    savePartyState();
    const line = describeLesson(String(member.name), ability, currentLocationName);
    noteDeed(line);
    toastr.success(line, '📜 Aprendido', { timeOut: 10000 });
    await postForModel(`[APRENDIZAJE] ${line} Cuéntalo en dos frases. No inventes nada más.`);
}
