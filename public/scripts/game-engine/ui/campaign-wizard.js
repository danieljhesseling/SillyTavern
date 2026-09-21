/**
 * The campaign wizard: one button, three questions, and you are playing.
 *
 * Before this, starting a campaign meant knowing to create a Lorebook, then finding the
 * content browser hidden between the rename and delete buttons of a world, then authoring
 * locations and boards, then selecting a character, then Start new chat — at which point a
 * world picker finally appeared. Seven steps across four panels, none of them announcing
 * the next. And with no worlds at all, showWorldPickerForNewChat returned null in silence,
 * so the button simply did nothing.
 *
 * The questions here are asked in the order a person thinks of them: what kind of place,
 * what is it called, who is going. Everything else is filled in from a template.
 *
 * Dependencies are injected so this module can be reasoned about on its own.
 *
 * See wiki/ROADMAP.md.
 */

import {
    STARTER_TEMPLATES, getTemplate, buildWorldMetadata, buildWorldEntries,
    buildEncounterRules,
} from '../campaign/starter-templates.js';
import { uniqueWorldName } from '../campaign/campaign-worlds.js';

/**
 * @typedef {Object} WizardResult
 * @property {string} worldName
 * @property {string[]} party          Names, as the world picker returns them.
 * @property {any[]} partyEntries      The saved Characters entries, which is what builds the party.
 * @property {string} locationName
 * @property {string} boardName
 */

/**
 * Collects the answers. Resolves with the choices, or null if cancelled.
 *
 * @param {{ Popup: any, POPUP_TYPE: any, existingWorldNames: string[] }} deps
 * @returns {Promise<{templateId: string, worldName: string, genre: string, description: string, party: string[]}|null>}
 */
export async function askWizard({ Popup, POPUP_TYPE, existingWorldNames = [] }) {
    const root = $('<div class="cw-root"></div>');

    root.append(`
        <div class="cw-head">
            <div class="cw-title"><i class="fa-solid fa-dungeon"></i> Nueva campaña</div>
            <div class="cw-sub">Tres pasos y estarás jugando. Todo se puede cambiar después.</div>
        </div>
    `);

    // ---- 1. template -------------------------------------------------------
    const step1 = $('<div class="cw-step"></div>');
    step1.append('<div class="cw-step-title"><span class="cw-num">1</span> ¿Qué tipo de sitio?</div>');
    const grid = $('<div class="cw-template-grid"></div>');

    let templateId = STARTER_TEMPLATES[0].id;

    for (const template of STARTER_TEMPLATES) {
        const card = $('<div class="cw-template-card"></div>')
            .toggleClass('selected', template.id === templateId);
        card.append($('<div class="cw-template-name"></div>').text(template.name));
        card.append($('<div class="cw-template-desc"></div>').text(template.description));
        card.on('click', () => {
            templateId = template.id;
            grid.find('.cw-template-card').removeClass('selected');
            card.addClass('selected');
            // The world name field follows the template until the user types their own.
            if (!nameTouched) nameInput.val(uniqueWorldName(template.name, existingWorldNames));
        });
        grid.append(card);
    }
    step1.append(grid);

    // ---- 2. the world ------------------------------------------------------
    const step2 = $('<div class="cw-step"></div>');
    step2.append('<div class="cw-step-title"><span class="cw-num">2</span> ¿Cómo se llama el mundo?</div>');

    // A free name, not the bare template name: on a second attempt that one belongs to the
    // world the first attempt made, and being refused for a name nobody typed is a dead end.
    const nameInput = $('<input type="text" class="text_pole cw-input" maxlength="60">')
        .val(uniqueWorldName(STARTER_TEMPLATES[0].name, existingWorldNames));
    let nameTouched = false;
    nameInput.on('input', () => { nameTouched = true; });

    const genreInput = $('<input type="text" class="text_pole cw-input" maxlength="40" placeholder="Fantasía, terror, cyberpunk…">');
    const descInput = $('<textarea class="text_pole cw-input" rows="2" maxlength="300" placeholder="Una frase sobre el mundo (opcional)"></textarea>');

    step2.append($('<label class="cw-label"></label>').text('Nombre').append(nameInput));
    step2.append($('<label class="cw-label"></label>').text('Género').append(genreInput));
    step2.append($('<label class="cw-label"></label>').text('Descripción').append(descInput));

    const nameWarning = $('<div class="cw-warning"></div>').hide();
    step2.append(nameWarning);

    // ---- 3. the party ------------------------------------------------------
    const step3 = $('<div class="cw-step"></div>');
    step3.append('<div class="cw-step-title"><span class="cw-num">3</span> ¿Quién va?</div>');
    step3.append('<div class="cw-hint">Un nombre por línea. Se crean como personajes del mundo y podrás editarlos luego.</div>');
    const partyInput = $('<textarea class="text_pole cw-input" rows="4" placeholder="Lyra\nBrand"></textarea>')
        .val('Lyra\nBrand');
    step3.append(partyInput);

    root.append(step1, step2, step3);

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Crear campaña',
        cancelButton: 'Cancelar',
        wide: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true; // cancelled: nothing to check

            const chosen = String(nameInput.val() || '').trim();
            if (!chosen) {
                nameWarning.text('Ponle un nombre al mundo.').show();
                return false;
            }
            if (existingWorldNames.some(w => w.toLowerCase() === chosen.toLowerCase())) {
                nameWarning.text(
                    `Ya existe un mundo llamado "${chosen}". Elige otro nombre, o inícialo desde la sección Campaigns.`,
                ).show();
                return false;
            }
            return true;
        },
    });

    const result = await popup.show();
    if (result !== 1) return null;

    const party = String(partyInput.val() || '')
        .split('\n')
        .map(n => n.trim())
        .filter(Boolean);

    return {
        templateId,
        worldName: String(nameInput.val() || '').trim(),
        genre: String(genreInput.val() || '').trim(),
        description: String(descInput.val() || '').trim(),
        party: party.length > 0 ? party : ['Aventurero'],
    };
}

/**
 * Creates the world a campaign is played in: the Lorebook, its metadata (one location, one
 * board with terrain already painted) and an entry for each party member and monster.
 *
 * It deliberately stops there. Turning a world into a campaign means creating a *chat*
 * bound to it, and that belongs to the same path the world picker already uses
 * (doNewChat), which creates the chat file first and only then binds world and party,
 * because getChat() resets the chat metadata. The first version of this wizard bound the
 * world to whatever chat happened to be open in memory instead, so nothing was ever saved
 * as a campaign and it never showed up in the list.
 *
 * The writes are injected rather than imported so the order of operations can be read, and
 * tested, in one place.
 *
 * @param {Object} input
 * @param {{templateId: string, worldName: string, genre: string, description: string, party: string[]}} input.answers
 * @param {(name: string) => Promise<any>} input.createWorld  Resolves false when the name is refused.
 * @param {(name: string) => Promise<any>} input.loadWorld
 * @param {(name: string, data: any) => Promise<any>} input.saveWorld
 * @param {(worldName: string, data: any) => any} input.createEntry
 * @returns {Promise<WizardResult>}
 */
export async function createCampaign({
    answers, createWorld, loadWorld, saveWorld, createEntry,
}) {
    const template = getTemplate(answers.templateId) ?? STARTER_TEMPLATES[0];

    // createNewWorldInfo refuses a name that collides once sanitised ("Mi: mundo" against
    // "Mi mundo"). Carrying on anyway would load the world that already exists and
    // overwrite its metadata, so a refusal has to stop everything here.
    const created = await createWorld(answers.worldName);
    if (created === false) {
        throw new Error(`No se pudo crear el mundo "${answers.worldName}". Puede que ya exista uno con un nombre casi idéntico.`);
    }

    const data = await loadWorld(answers.worldName);
    if (!data) throw new Error(`No se pudo cargar el mundo "${answers.worldName}".`);

    data.metadata = Object.assign(data.metadata ?? {}, buildWorldMetadata(template, {
        displayName: answers.worldName,
        genre: answers.genre,
        description: answers.description,
    }));

    /** @type {any[]} */
    const partyEntries = [];
    /** @type {Record<string, string>} */
    const monsterIds = {};

    for (const spec of buildWorldEntries(template, answers.party)) {
        const entry = createEntry(answers.worldName, data);
        if (!entry) continue;
        entry.comment = spec.title;
        entry.key = spec.keys;
        entry.content = spec.content;
        entry.group = spec.group;
        entry.dndData = spec.dndData;

        if (spec.group === 'Characters') partyEntries.push(entry);
        if (spec.group === 'Monsters') monsterIds[spec.title] = String(entry.uid);
    }

    // Only now are the monster ids known, so the board's encounter rules are written
    // here rather than in buildWorldMetadata. Without this, /fight finds no enemies.
    const board = data.metadata?.locationMaps?.[0]?.boards?.[0];
    if (board) board.encounterRules = buildEncounterRules(template, monsterIds);

    await saveWorld(answers.worldName, data);

    return {
        worldName: answers.worldName,
        party: partyEntries.map(entry => entry.comment),
        partyEntries,
        locationName: template.locationName,
        boardName: template.boardName,
    };
}

/**
 * Markup for the empty state of the Campaigns section, with the button that starts all of
 * this. Replaces the bare "No campaigns yet" text, which was an instruction disguised as
 * a placeholder.
 *
 * @param {boolean} hasCampaigns
 * @returns {string}
 */
export function buildNewCampaignCta(hasCampaigns) {
    if (hasCampaigns) {
        return '<button id="cw-new-campaign" class="menu_button cw-cta-inline">'
            + '<i class="fa-solid fa-plus"></i> Nueva campaña</button>';
    }

    return `
        <div class="campaigns-empty">
            <i class="fa-solid fa-dungeon fa-3x"></i>
            <p>Todavía no hay campañas. Crea una en tres pasos y empieza a jugar.</p>
            <button id="cw-new-campaign" class="menu_button cw-cta">
                <i class="fa-solid fa-plus"></i> Nueva campaña
            </button>
        </div>`;
}
