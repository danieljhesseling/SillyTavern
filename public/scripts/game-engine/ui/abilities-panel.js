/**
 * El panel de habilidades: escribir un conjuro sin tocar código, y repartirlo.
 *
 * El catálogo vive en el paquete de reglas, así que técnicamente se puede editar desde
 * `/rules` — como JSON. Eso no es editar, es escribir JSON. Aquí cada campo es un campo, y
 * al lado está lo que ninguna tabla resolvía: **quién se la sabe**.
 *
 * Dibuja y recoge. Lo que decide qué hace una habilidad está en `rules/abilities.js`, y lo
 * que la guarda, en `party.js`.
 *
 * Ver wiki/POR_HACER.md, D5.
 */

import {
    normalizeAbilities, ABILITY_COSTS, ABILITY_RESOURCES, ABILITY_TARGETS,
    ABILITY_RESOLUTIONS, ABILITY_LABELS, describeAbility,
} from '../rules/abilities.js';

/**
 * Un desplegable con su etiqueta, de los cuatro que se repiten.
 *
 * @param {string} label
 * @param {string[]} options
 * @param {Record<string, string>} labels
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @returns {JQuery}
 */
function pick(label, options, labels, value, onChange) {
    const field = $('<label class="ab-field"></label>');
    field.append($('<span class="ab-label"></span>').text(label));

    const select = $('<select class="text_pole ab-input"></select>');
    for (const option of options) {
        select.append($('<option></option>').attr('value', option).text(labels[option] ?? option));
    }
    select.val(value);
    select.on('change', () => onChange(String(select.val() ?? '')));

    field.append(select);
    return field;
}

/**
 * Una casilla de texto o de número con su etiqueta.
 *
 * @param {string} label
 * @param {string|number} value
 * @param {(value: string) => void} onChange
 * @param {{type?: string, placeholder?: string, cls?: string}} [options]
 * @returns {JQuery}
 */
function box(label, value, onChange, options = {}) {
    const field = $(`<label class="ab-field ${options.cls ?? ''}"></label>`);
    field.append($('<span class="ab-label"></span>').text(label));

    const input = $('<input class="text_pole ab-input" />')
        .attr('type', options.type ?? 'text')
        .attr('placeholder', options.placeholder ?? '')
        .val(String(value ?? ''));
    input.on('input', () => onChange(String(input.val() ?? '')));

    field.append(input);
    return field;
}

/**
 * Abre el panel y devuelve lo editado, o null si se cancela.
 *
 * @param {Object} input
 * @param {any} input.abilities El catálogo actual.
 * @param {Array<any>} input.party
 * @param {Array<string>} input.conditions Las condiciones del paquete de reglas.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<{abilities: any[], known: Record<string, string[]>}|null>}
 */
export async function openAbilitiesPanel({ abilities, party, conditions, Popup, POPUP_TYPE }) {
    /** @type {any[]} */
    let draft = normalizeAbilities(abilities);

    /** Quién se sabe cada una, por id de personaje. */
    /** @type {Record<string, string[]>} */
    const known = {};
    for (const member of party) {
        known[String(member.id)] = [...(Array.isArray(member.abilities) ? member.abilities : [])].map(String);
    }

    const root = $('<div class="ab-root"></div>');
    root.append($('<div class="ab-intro"></div>').text(
        'Cada habilidad es una fila de datos: lo que cuesta, cuántas veces, a quién alcanza '
        + 'y qué hace. Se guardan con las reglas de la campaña.',
    ));

    const list = $('<div class="ab-list"></div>');
    root.append(list);

    function draw() {
        list.empty();

        for (const ability of draft) {
            const card = $('<div class="ab-card"></div>');

            const head = $('<div class="ab-head"></div>');
            const name = $('<input class="text_pole ab-name" />').val(ability.name);
            name.on('input', () => { ability.name = String(name.val() ?? ''); });
            head.append(name);

            const remove = $('<button class="menu_button ab-remove" type="button"></button>')
                .attr('title', 'Quitar esta habilidad')
                .append('<i class="fa-solid fa-trash"></i>');
            remove.on('click', () => {
                draft = draft.filter(a => a !== ability);
                // Nadie puede seguir sabiéndose algo que ya no existe.
                for (const id of Object.keys(known)) known[id] = known[id].filter(x => x !== ability.id);
                draw();
            });
            head.append(remove);
            card.append(head);

            const grid = $('<div class="ab-grid"></div>');
            grid.append(pick('Cuesta', ABILITY_COSTS, ABILITY_LABELS.costs, ability.cost,
                v => { ability.cost = v; redrawSummary(); }));
            grid.append(pick('Se recupera', ABILITY_RESOURCES, ABILITY_LABELS.resources, ability.resource,
                v => { ability.resource = v; redrawSummary(); }));
            grid.append(box('Usos', ability.usesPerRest,
                v => { ability.usesPerRest = Number(v) || 1; redrawSummary(); }, { type: 'number' }));
            grid.append(pick('Sobre', ABILITY_TARGETS, ABILITY_LABELS.targets, ability.target,
                v => { ability.target = v; redrawSummary(); }));
            grid.append(box('Alcance (ft)', ability.rangeFeet,
                v => { ability.rangeFeet = Number(v) || 0; redrawSummary(); }, { type: 'number' }));
            grid.append(pick('Se resuelve con', ABILITY_RESOLUTIONS, ABILITY_LABELS.resolutions, ability.resolution,
                v => { ability.resolution = v; redrawSummary(); }));
            grid.append(box('CD de salvación', ability.saveDc,
                v => { ability.saveDc = Number(v) || 13; redrawSummary(); }, { type: 'number' }));
            grid.append(box('Daño', ability.damage,
                v => { ability.damage = v; redrawSummary(); }, { placeholder: '1d10' }));
            grid.append(box('Tipo de daño', ability.damageType,
                v => { ability.damageType = v; }, { placeholder: 'Fire' }));
            grid.append(box('Curación', ability.healing,
                v => { ability.healing = v; redrawSummary(); }, { placeholder: '1d8+3' }));

            const conditionField = $('<label class="ab-field"></label>');
            conditionField.append($('<span class="ab-label"></span>').text('Condición'));
            const conditionSelect = $('<select class="text_pole ab-input"></select>');
            conditionSelect.append($('<option value=""></option>').text('Ninguna'));
            for (const condition of conditions) {
                conditionSelect.append($('<option></option>').attr('value', condition).text(condition));
            }
            conditionSelect.val(ability.condition);
            conditionSelect.on('change', () => {
                ability.condition = String(conditionSelect.val() ?? '');
                redrawSummary();
            });
            conditionField.append(conditionSelect);
            grid.append(conditionField);

            grid.append(box('Rondas', ability.conditionRounds,
                v => { ability.conditionRounds = Number(v) || 1; redrawSummary(); }, { type: 'number' }));
            card.append(grid);

            card.append(box('Descripción', ability.description,
                v => { ability.description = v; }, { cls: 'ab-wide', placeholder: 'Para el registro y el chat' }));

            // Quién se la sabe: lo que ninguna tabla de reglas podía resolver.
            if (party.length > 0) {
                const who = $('<div class="ab-who"></div>');
                who.append($('<span class="ab-label"></span>').text('Se la saben'));
                for (const member of party) {
                    const id = String(member.id);
                    const wrap = $('<label class="ab-who-one"></label>');
                    const check = $('<input type="checkbox" />').prop('checked', known[id].includes(ability.id));
                    check.on('change', () => {
                        known[id] = check.prop('checked')
                            ? [...new Set([...known[id], ability.id])]
                            : known[id].filter(x => x !== ability.id);
                    });
                    wrap.append(check).append($('<span></span>').text(` ${member.name}`));
                    who.append(wrap);
                }
                card.append(who);
            }

            const summary = $('<div class="ab-summary"></div>').text(describeAbility(ability));
            card.append(summary);
            card.data('summary', summary);

            list.append(card);
        }
    }

    /** Vuelve a escribir la línea de resumen de cada tarjeta. */
    function redrawSummary() {
        list.children('.ab-card').each((index, node) => {
            const summary = $(node).data('summary');
            if (summary && draft[index]) summary.text(describeAbility(draft[index]));
        });
    }

    const add = $('<button class="menu_button ab-add" type="button"></button>')
        .append('<i class="fa-solid fa-plus"></i>')
        .append($('<span></span>').text(' Añadir una habilidad'));
    add.on('click', () => {
        draft.push(normalizeAbilities([{ name: `Habilidad ${draft.length + 1}` }])[0]);
        draw();
    });
    root.append(add);

    draw();

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Guardar habilidades',
        cancelButton: 'Cancelar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
    });

    const result = await popup.show();
    if (!result) return null;

    // Se normaliza al salir: los nombres cambiados pueden haber dejado un id vacío, y dos
    // habilidades con el mismo id serían una sola en cuanto alguien la usara.
    return { abilities: normalizeAbilities(draft), known };
}
