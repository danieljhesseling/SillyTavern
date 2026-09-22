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
import { normalizeMap, findPartyStart } from '../world-builder/world-schema.js';

/**
 * @typedef {Object} WizardResult
 * @property {string} worldName
 * @property {string[]} party          Names, as the world picker returns them.
 * @property {any[]} partyEntries      The saved Characters entries, which is what builds the party.
 * @property {string} locationName
 * @property {string} boardName
 * @property {{counts: any, unresolved: string[]}} [imported] Only when a book was imported.
 */

/**
 * Collects the answers. Resolves with the choices, or null if cancelled.
 *
 * @param {Object} deps
 * @param {any} deps.Popup
 * @param {any} deps.POPUP_TYPE
 * @param {string[]} [deps.existingWorldNames]
 * @param {((idea: string, partySize: number) => Promise<{template: any, warnings: string[], errors: string[]}>)|null} [deps.generateWorld]
 *        Injected so this module never imports a provider. Absent means no AI card.
 * @returns {Promise<{templateId: string, worldName: string, genre: string, description: string, party: string[], generatedTemplate: any, importedPack: any, writeWorld: boolean}|null>}
 */
export async function askWizard({ Popup, POPUP_TYPE, existingWorldNames = [], generateWorld = null }) {
    /** El resultado del segundo botón. Los propios empiezan en 2; 0 y 1 ya están cogidos. */
    const WRITE_WORLD = 2;

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
    const descInput = $('<textarea class="text_pole cw-input cw-desc-input" rows="2" maxlength="300" placeholder="Una frase sobre el mundo (opcional)"></textarea>');

    step2.append($('<label class="cw-label"></label>').text('Nombre').append(nameInput));
    step2.append($('<label class="cw-label"></label>').text('Género').append(genreInput));
    step2.append($('<label class="cw-label"></label>').text('Descripción').append(descInput));

    const nameWarning = $('<div class="cw-warning"></div>').hide();
    step2.append(nameWarning);

    // ---- 3. the party ------------------------------------------------------
    const step3 = $('<div class="cw-step"></div>');
    step3.append('<div class="cw-step-title"><span class="cw-num">3</span> ¿Quién va?</div>');
    step3.append('<div class="cw-hint">Un nombre por línea. Se crean como personajes del mundo, y '
        + 'con <b>Crear y escribir el mundo</b> los editas ahí mismo.</div>');
    // Con clase propia: contar las cajas por su posicion se rompio en cuanto aparecio
    // una cuarta tarjeta con la suya.
    const partyInput = $('<textarea class="text_pole cw-input cw-party-input" rows="4" placeholder="Lyra\nBrand"></textarea>')
        .val('Lyra\nBrand');
    step3.append(partyInput);

    // ---- 1b. the blank canvas ----------------------------------------------
    // The AI is offered as one more way to fill step 1, never as the way in: if it is not
    // configured, fails, or returns nonsense, the four hand-written templates are still
    // right there. What it returns becomes an ordinary template and goes through exactly
    // the same builders, so a generated world cannot reach the board by a private path.
    /** @type {import('../campaign/starter-templates.js').StarterTemplate|null} */
    let generatedTemplate = null;

    const aiPanel = $('<div class="cw-ai"></div>').hide();

    if (typeof generateWorld === 'function') {
        const aiCard = $('<div class="cw-template-card cw-template-ai"></div>');
        aiCard.append($('<div class="cw-template-name"></div>')
            .html('<i class="fa-solid fa-wand-magic-sparkles"></i> ')
            .append(document.createTextNode('Generar con IA')));
        aiCard.append($('<div class="cw-template-desc"></div>')
            .text('Describe el mundo que quieres y lo construye. Una llamada al modelo.'));

        aiCard.on('click', () => {
            grid.find('.cw-template-card').removeClass('selected');
            aiCard.addClass('selected');
            aiPanel.show();
            ideaInput.trigger('focus');
            // Nothing is generated yet, so the first template stays the fallback until
            // a generation succeeds and the player accepts it.
            templateId = generatedTemplate ? 'generated' : STARTER_TEMPLATES[0].id;
        });

        grid.append(aiCard);

        const ideaInput = $('<textarea class="text_pole cw-input" rows="2" maxlength="600"></textarea>')
            .attr('placeholder', 'Una cripta inundada bajo una iglesia en ruinas, con cultistas…');

        const goButton = $('<button class="menu_button cw-ai-go" type="button"></button>')
            .append('<i class="fa-solid fa-wand-magic-sparkles"></i>')
            .append($('<span></span>').text(' Generar'));

        const status = $('<div class="cw-ai-status"></div>').hide();
        const preview = $('<div class="cw-ai-preview"></div>').hide();

        // Cada intento se guarda. Generar otra vez ya no borraba el anterior sin mas:
        // el modelo tiene buenas ideas y luego las estropea, y perder la buena por
        // probar una vez mas convertia generar en una apuesta.
        /** @type {Array<{idea: string, template: any}>} */
        const attempts = [];
        const history = $('<div class="cw-ai-history"></div>').hide();

        aiPanel.append($('<div class="cw-hint"></div>').text('¿Qué mundo quieres? Sé todo lo concreto que puedas.'));
        aiPanel.append(ideaInput, goButton, status, history, preview);

        /** Los intentos anteriores, como botones para volver a cualquiera. */
        const drawHistory = () => {
            history.empty();
            if (attempts.length < 2) {
                history.hide();
                return;
            }

            history.append($('<span class="cw-ai-history-title"></span>').text('Generaciones:'));
            attempts.forEach((attempt, index) => {
                const button = $('<button class="menu_button cw-ai-attempt" type="button"></button>')
                    .text(`${index + 1}. ${attempt.template.name}`)
                    .attr('title', attempt.idea || 'Sin idea escrita')
                    .toggleClass('current', attempt.template === generatedTemplate)
                    .on('click', () => {
                        generatedTemplate = attempt.template;
                        templateId = 'generated';
                        showPreview({ template: attempt.template, errors: [], warnings: [] });
                        drawHistory();
                    });
                history.append(button);
            });
            history.show();
        };

        /** Draws what came back, so nothing is injected before you have seen it. */
        const showPreview = (/** @type {any} */ result) => {
            preview.empty();

            for (const message of result.errors) {
                preview.append($('<div class="cw-ai-error"></div>').text(message));
            }

            if (result.template) {
                const t = result.template;
                preview.append($('<div class="cw-ai-name"></div>').text(t.name));
                preview.append($('<div class="cw-ai-desc"></div>').text(t.description));
                // El mapa, editable aqui mismo: el modelo acierta con la sala y falla
                // con una pared, y abrir el editor de terreno despues de crear la
                // campana para mover un muro era el camino largo.
                const mapBox = $('<textarea class="text_pole cw-ai-map" spellcheck="false"></textarea>')
                    .attr('rows', String(Math.min(20, t.map.length + 1)))
                    .val(t.map.join('\n'));

                const mapNote = $('<div class="cw-ai-map-note"></div>').hide();

                mapBox.on('input', () => {
                    const rows = String(mapBox.val() || '').split('\n').filter(row => row.length > 0);
                    const { map, warnings } = normalizeMap(rows);
                    t.map = map;
                    // La casilla de inicio puede haber dejado de ser suelo.
                    t.partyStart = findPartyStart(map, t.partyStart.length || 2);
                    mapNote.text(warnings.length > 0
                        ? warnings.join(' ')
                        : `${map[0]?.length ?? 0} x ${map.length}, revisado.`).show();
                });

                preview.append(mapBox, mapNote);

                const enemies = t.enemies.length
                    ? t.enemies.map(e => `${e.name} (${e.hp} PG, CA ${e.armorClass})`).join(' · ')
                    : 'Sin enemigos.';
                preview.append($('<div class="cw-ai-enemies"></div>').text(enemies));

                preview.append($('<div class="cw-ai-where"></div>')
                    .text(`Empezarás en "${t.boardName}", en "${t.locationName}".`));
            }

            for (const message of result.warnings) {
                preview.append($('<div class="cw-ai-warn"></div>').text(message));
            }

            preview.show();
        };

        let generating = false;
        goButton.on('click', async () => {
            if (generating) return;
            generating = true;
            goButton.prop('disabled', true);
            preview.hide();
            status.text('Generando el mundo…').show();

            try {
                const partySize = String(partyInput.val() || '')
                    .split('\n').map(n => n.trim()).filter(Boolean).length || 2;

                const result = await generateWorld(String(ideaInput.val() || ''), partySize);
                generatedTemplate = result.template;
                if (result.template) {
                    attempts.push({ idea: String(ideaInput.val() || ''), template: result.template });
                    drawHistory();
                }

                if (result.template) {
                    templateId = 'generated';
                    status.text('Listo. Revísalo antes de crear la campaña.').show();
                    // The generated world fills in step 2, as picking a template does.
                    if (!nameTouched) nameInput.val(uniqueWorldName(result.template.name, existingWorldNames));
                    if (!String(genreInput.val() || '').trim()) genreInput.val(result.template.genre);
                    if (!String(descInput.val() || '').trim()) descInput.val(result.template.description);
                } else {
                    templateId = STARTER_TEMPLATES[0].id;
                    status.text('No salió. Prueba otra vez, cambia la idea, o elige una plantilla.').show();
                }

                showPreview(result);
            } catch (error) {
                generatedTemplate = null;
                templateId = STARTER_TEMPLATES[0].id;
                status.text(`No se pudo generar: ${error?.message || error}`).show();
            } finally {
                generating = false;
                goButton.prop('disabled', false);
            }
        });
    }


    // ---- 1c. an imported book ----------------------------------------------
    // The fourth way in, and the one the whole ingestion pipeline exists for: paste what
    // your Gem produced from a campaign book. Nothing is created until it has been
    // checked, and what the check finds is shown before the button does anything, because
    // where a generated pack fails is never in a field you can see by reading it.
    /** @type {any} */
    let importedPack = null;

    const importPanel = $('<div class="cw-import"></div>').hide();

    const importCard = $('<div class="cw-template-card cw-template-import"></div>');
    importCard.append($('<div class="cw-template-name"></div>')
        .html('<i class="fa-solid fa-file-import"></i> ')
        .append(document.createTextNode('Importar un libro')));
    importCard.append($('<div class="cw-template-desc"></div>')
        .text('Pega el paquete JSON que te ha dado tu Gem. Se comprueba antes de crear nada.'));

    importCard.on('click', () => {
        grid.find('.cw-template-card').removeClass('selected');
        importCard.addClass('selected');
        aiPanel.hide();
        importPanel.show();
        packInput.trigger('focus');
        templateId = importedPack ? 'imported' : STARTER_TEMPLATES[0].id;
    });
    grid.append(importCard);

    const packInput = $('<textarea class="text_pole cw-input cw-import-text" rows="6" '
        + 'placeholder="{ &quot;version&quot;: 1, &quot;world&quot;: { … } }"></textarea>');
    const checkButton = $('<button class="menu_button cw-import-check" type="button"></button>')
        .html('<i class="fa-solid fa-circle-check"></i> Comprobar el paquete');
    const importReport = $('<div class="cw-import-report"></div>').hide();

    importPanel.append($('<div class="cw-hint"></div>').text(
        'Usa /esquema-campana para obtener el contrato que hay que pegarle al Gem. Aqui va su respuesta.'));
    importPanel.append(packInput, checkButton, importReport);

    /**
     * Draw what the check found: what the pack brings, what is wrong with it, and what
     * was put right on the way in.
     *
     * @param {import('../campaign/campaign-pack.js').PackReport|null} report
     * @param {string} [parseError]
     */
    function showReport(report, parseError) {
        importReport.empty().show();

        if (parseError) {
            importReport.append($('<div class="cw-import-bad"></div>')
                .text(`Eso no es JSON valido: ${parseError}`));
            return;
        }
        if (!report) return;

        const c = report.counts;
        importReport.append($('<div class="cw-import-counts"></div>').text(
            `${c.world || 'Sin nombre'} - ${c.locations} localidades, ${c.boards} tableros, `
            + `${c.enemies} enemigos, ${c.confidants} companeros, ${c.quests} misiones, `
            + `${c.objectives} objetivos.`));

        /**
         * @param {string} cls
         * @param {string} title
         * @param {import('../campaign/campaign-pack.js').Issue[]} issues
         */
        const listOf = (cls, title, issues) => {
            if (issues.length === 0) return;
            const block = $(`<div class="cw-import-list ${cls}"></div>`);
            block.append($('<div class="cw-import-list-title"></div>').text(`${title} (${issues.length})`));
            const list = $('<ul></ul>');
            // Enough to act on, not so many that the useful first one scrolls away.
            for (const issue of issues.slice(0, 12)) {
                list.append($('<li></li>')
                    .append($('<code></code>').text(issue.path))
                    .append(document.createTextNode(` ${issue.message}`)));
            }
            if (issues.length > 12) {
                list.append($('<li></li>').text(`… y ${issues.length - 12} mas.`));
            }
            block.append(list);
            importReport.append(block);
        };

        listOf('cw-import-bad', 'Hay que arreglarlo antes de importar', report.errors);
        listOf('cw-import-warn', 'Avisos', report.warnings);
        listOf('cw-import-fixed', 'Reparado al leerlo', report.repairs);

        importReport.append($('<div class="cw-import-verdict"></div>')
            .toggleClass('ok', report.ok)
            .text(report.ok
                ? 'El paquete se puede importar.'
                : 'El paquete no se puede importar todavia.'));
    }

    checkButton.on('click', async () => {
        const raw = String(packInput.val() || '').trim();
        importedPack = null;
        templateId = STARTER_TEMPLATES[0].id;

        if (!raw) {
            showReport(null, 'esta vacio');
            return;
        }

        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            showReport(null, String(error?.message || error));
            return;
        }

        const { validatePack } = await import('../campaign/campaign-pack.js');
        const report = validatePack(parsed);
        showReport(report);

        if (report.ok) {
            importedPack = parsed;
            templateId = 'imported';
            // The world name follows the pack, the way it follows a template.
            if (!nameTouched) nameInput.val(uniqueWorldName(report.counts.world, existingWorldNames));
        }
    });

    step1.append(aiPanel, importPanel);

    root.append(step1, step2, step3);

    // Dos salidas, las dos sin escribir un comando: una cae jugando y la otra cae jugando
    // **y** con el editor del mundo delante. Antes la segunda existia y habia que saberse
    // `/campana` para llegar a ella, que es justo lo contrario de lo que persigue el
    // juego por clics.
    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Crear y jugar',
        cancelButton: 'Cancelar',
        customButtons: [{
            text: 'Crear y escribir el mundo',
            result: WRITE_WORLD,
            icon: 'fa-pen-ruler',
            tooltip: 'Crea la campaña y abre el editor: localidades, personajes, bestiario, objetos y misiones',
        }],
        wide: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            // Las dos salidas crean un mundo, asi que las dos pasan por el mismo control:
            // solo cancelar se va sin mirar nada.
            if (p.result !== 1 && p.result !== WRITE_WORLD) return true;

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
    if (result !== 1 && result !== WRITE_WORLD) return null;

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
        generatedTemplate,
        importedPack,
        writeWorld: result === WRITE_WORLD,
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
 * @param {{templateId: string, worldName: string, genre: string, description: string, party: string[], generatedTemplate?: any, importedPack?: any}} input.answers
 * @param {(name: string) => Promise<any>} input.createWorld  Resolves false when the name is refused.
 * @param {(name: string) => Promise<any>} input.loadWorld
 * @param {(name: string, data: any) => Promise<any>} input.saveWorld
 * @param {(worldName: string, data: any) => any} input.createEntry
 * @returns {Promise<WizardResult>}
 */
export async function createCampaign({
    answers, createWorld, loadWorld, saveWorld, createEntry,
}) {
    // An imported book is the one thing that is not a template: it brings several boards,
    // several locations, its own people and its own missions, and it resolves its names
    // to ids after the entries exist. It has its own builder for exactly that reason.
    if (answers.templateId === 'imported' && answers.importedPack) {
        const { importPack } = await import('../campaign/campaign-importer.js');
        const imported = await importPack({
            pack: answers.importedPack,
            worldName: answers.worldName,
            party: answers.party,
            createWorld, loadWorld, saveWorld, createEntry,
        });
        return {
            worldName: imported.worldName,
            party: imported.party,
            partyEntries: imported.partyEntries,
            locationName: imported.locationName,
            boardName: imported.boardName,
            imported: { counts: imported.counts, unresolved: imported.unresolved },
        };
    }

    // A generated world is a template like any other from here on. That is the whole
    // design: one path into the game, whoever wrote the world.
    const template = (answers.templateId === 'generated' && answers.generatedTemplate)
        ? answers.generatedTemplate
        : getTemplate(answers.templateId) ?? STARTER_TEMPLATES[0];

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
