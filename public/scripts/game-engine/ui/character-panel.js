/**
 * La ficha, dibujada: lo que se mira, no lo que se edita.
 *
 * Todo aquí es de solo lectura a propósito. El editor de siempre sigue existiendo y se
 * abre desde el botón de abajo, que es donde tiene que estar: a un paso y no en el camino.
 * Mirarse la ficha en mitad de una partida y encontrarse un formulario con desplegables es
 * lo que hace que el juego parezca una hoja de cálculo.
 *
 * Dibuja y ya. Lo que decide qué se enseña está en `shell/character-sheet.js`.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 1.
 */

import { buildCharacterSheet, describeSheet } from './shell/character-sheet.js';

/**
 * @param {string} label
 * @param {string|number} value
 * @param {string} [hint]
 * @returns {JQuery}
 */
function box(label, value, hint = '') {
    const cell = $('<div class="ch-box"></div>');
    cell.append($('<div class="ch-box-label"></div>').text(label));
    cell.append($('<div class="ch-box-value"></div>').text(String(value)));
    if (hint) cell.append($('<div class="ch-box-hint"></div>').text(hint));
    return cell;
}

/**
 * Abre la ficha de alguien.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {any} [input.slotInfo]
 * @param {any[]} [input.abilities]
 * @param {any} [input.xpTable]
 * @param {number} [input.bondRank]
 * @param {(() => void)|null} [input.onEdit] Abrir el editor de siempre.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<void>}
 */
export async function openCharacterPanel({
    member, slotInfo = {}, abilities = [], xpTable = null, bondRank = 0,
    onEdit = null, Popup, POPUP_TYPE,
}) {
    const sheet = buildCharacterSheet({ member, slotInfo, abilities, xpTable, bondRank });
    const root = $('<div class="ch-root"></div>');

    // ---- Quién es, y cómo está -------------------------------------------
    const head = $('<div class="ch-head"></div>');
    if (sheet.avatar) head.append($('<img class="ch-avatar">').attr('src', sheet.avatar).attr('alt', ''));

    const who = $('<div class="ch-who"></div>');
    who.append($('<div class="ch-name"></div>').text(sheet.name));
    who.append($('<div class="ch-title"></div>').text(sheet.title));
    if (sheet.bondRank > 0) {
        who.append($('<div class="ch-bond"></div>').text(`Vínculo de rango ${sheet.bondRank}`));
    }
    head.append(who);
    root.append(head);

    // La vida, primero y grande: es lo que se viene a mirar.
    const health = $('<div class="ch-health"></div>')
        .toggleClass('hurt', sheet.health.hurt)
        .toggleClass('down', sheet.health.down);
    health.append($('<div class="ch-health-num"></div>').text(`${sheet.health.hp} / ${sheet.health.maxHp}`));
    const bar = $('<div class="ch-health-bar"></div>');
    bar.append($('<div class="ch-health-fill"></div>').css('width', `${Math.round(sheet.health.fraction * 100)}%`));
    health.append(bar);
    root.append(health);

    if (sheet.deathSaves) {
        root.append($('<div class="ch-dying"></div>').text(
            `Salvaciones de muerte: ${sheet.deathSaves.successes} a favor, ${sheet.deathSaves.failures} en contra.`,
        ));
    }

    // ---- Lo que le pasa ahora mismo ---------------------------------------
    // Antes que las estadísticas: si cojeas, eso pesa más que tu carisma.
    const wrong = [
        ...sheet.injuries,
        ...(sheet.needs ? [sheet.needs] : []),
        ...sheet.conditions,
    ];
    if (wrong.length > 0) {
        const list = $('<div class="ch-wrong"></div>');
        for (const line of wrong) list.append($('<span class="ch-tag"></span>').text(line));
        root.append(list);
    }

    // ---- Las seis, y lo que defiende --------------------------------------
    const stats = $('<div class="ch-stats"></div>');
    for (const stat of sheet.stats) {
        stats.append(box(stat.label, stat.score, `${stat.modifier >= 0 ? '+' : ''}${stat.modifier}`));
    }
    root.append(stats);

    const defence = $('<div class="ch-stats ch-defence"></div>');
    defence.append(box('CA', sheet.defence.armorClass));
    defence.append(box('Velocidad', `${sheet.defence.speed} pies`));
    defence.append(box('Iniciativa', `${sheet.defence.initiative >= 0 ? '+' : ''}${sheet.defence.initiative}`));
    defence.append(box('Oro', sheet.gold));
    root.append(defence);

    // ---- Lo que lleva puesto ----------------------------------------------
    root.append($('<div class="ch-title-row"></div>').text('Equipo'));
    const worn = $('<div class="ch-gear"></div>');
    for (const slot of sheet.equipment) {
        const row = $('<div class="ch-slot"></div>').toggleClass('empty', slot.empty);
        row.append(`<i class="fa-solid ${slot.icon}"></i>`);
        row.append($('<span class="ch-slot-label"></span>').text(slot.label));
        row.append($('<span class="ch-slot-item"></span>').text(slot.empty ? '—' : slot.item));
        worn.append(row);
    }
    root.append(worn);

    // ---- Lo que sabe hacer -------------------------------------------------
    if (sheet.abilities.length > 0) {
        root.append($('<div class="ch-title-row"></div>').text('Habilidades'));
        const list = $('<div class="ch-abilities"></div>');
        for (const ability of sheet.abilities) {
            const row = $('<div class="ch-ability"></div>').toggleClass('spent', ability.spent);
            row.append($('<span class="ch-ability-name"></span>').text(ability.name));
            row.append($('<span class="ch-ability-left"></span>').text(
                ability.left === null ? 'a voluntad' : `${ability.left} uso(s)`));
            list.append(row);
        }
        root.append(list);
    }

    // ---- Lo que carga ------------------------------------------------------
    root.append($('<div class="ch-title-row"></div>').text('Inventario'));
    const bag = $('<div class="ch-bag"></div>');
    if (sheet.inventory.length === 0) {
        bag.append($('<div class="ch-empty"></div>').text('No lleva nada encima.'));
    }
    for (const item of sheet.inventory) {
        const row = $('<div class="ch-item"></div>');
        row.append($('<span class="ch-item-name"></span>').text(item.name));
        if (item.weight > 0) row.append($('<span class="ch-item-weight"></span>').text(`${item.weight} kg`));
        bag.append(row);
    }
    root.append(bag);

    // ---- El progreso -------------------------------------------------------
    const progress = $('<div class="ch-progress"></div>');
    progress.append($('<span></span>').text(
        sheet.progress.xpNext > 0
            ? `Nivel ${sheet.progress.level} · ${sheet.progress.xp} / ${sheet.progress.xpNext} de experiencia`
            : `Nivel ${sheet.progress.level} · ${sheet.progress.xp} de experiencia`,
    ));
    root.append(progress);

    root.append($('<div class="ch-note"></div>').text(describeSheet(sheet)));

    // El editor, a un paso: aquí no se toca nada, pero cambiar a fondo sigue existiendo.
    if (onEdit) {
        const edit = $('<button class="menu_button ch-edit" type="button"></button>')
            .append('<i class="fa-solid fa-pen-to-square"></i>')
            .append($('<span></span>').text(' Editar a fondo'));
        edit.on('click', () => {
            popup.completeAffirmative();
            onEdit();
        });
        root.append(edit);
    }

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
    });

    await popup.show();
}
