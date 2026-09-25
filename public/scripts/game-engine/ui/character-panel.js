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
 * @param {string[]} [input.languages] Idea 59: lo que habla.
 * @param {Array<{name: string}>} [input.sets] Idea 62: sus juegos de equipo.
 * @param {Array<{id: string, name: string, avatar?: string}>} [input.mates] Idea 163: a quién se le puede dar algo.
 * @param {((itemId: string, toId: string) => boolean)|null} [input.onGive]
 * @param {((name: string) => boolean)|null} [input.onSaveSet]
 * @param {((name: string) => boolean)|null} [input.onApplySet]
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<string>} `changed` si se ha tocado algo, para volver a abrirla al día.
 */
export async function openCharacterPanel({
    member, slotInfo = {}, abilities = [], xpTable = null, bondRank = 0,
    onEdit = null, languages = [], sets = [], mates = [], onGive = null, onSaveSet = null, onApplySet = null,
    Popup, POPUP_TYPE,
}) {
    const sheet = buildCharacterSheet({ member, slotInfo, abilities, xpTable, bondRank });
    const root = $('<div class="ch-root"></div>');
    let changed = '';
    /** @param {boolean} done */
    const after = (done) => {
        if (!done) return;
        changed = 'changed';
        popup.completeAffirmative();
    };

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
    // Idea 59: lo que habla, que ahora importa.
    if (languages.length > 0) root.append($('<div class="ch-langs"></div>').text(`Habla: ${languages.join(', ')}`));

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
    // Con de donde sale cada punto, si sale de lo que lleva puesto: una CA que no se
    // puede explicar se siente como una trampa del motor.
    defence.append(box('CA', sheet.defence.armorClass, sheet.defence.armourFrom ?? ''));
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

    // ---- Idea 62: los juegos de equipo guardados ---------------------------
    if (onSaveSet || onApplySet) {
        const outfits = $('<div class="ch-sets"></div>');
        for (const set of sets) {
            const wear = $('<button class="menu_button ch-set-apply" type="button"></button>')
                .attr('data-set', set.name).text(`Ponerse «${set.name}»`);
            wear.on('click', () => after(Boolean(onApplySet?.(set.name))));
            outfits.append(wear);
        }
        const name = $('<input type="text" class="text_pole ch-set-name" placeholder="Sigilo, Combate…" maxlength="24" />');
        const keep = $('<button class="menu_button ch-set-save" type="button"></button>').text('Guardar lo que lleva');
        keep.on('click', () => after(Boolean(onSaveSet?.(String(name.val() ?? '').trim()))));
        outfits.append($('<div class="ch-set-new"></div>').append(name).append(keep));
        root.append($('<div class="ch-title-row"></div>').text('Juegos de equipo'));
        root.append(outfits);
    }

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
    // Idea 163: arrastrar a la cara de quien lo va a llevar, o elegirlo en la lista.
    if (onGive && mates.length > 0 && sheet.inventory.length > 0) {
        const faces = $('<div class="ch-mates"></div>');
        faces.append($('<span class="ch-mates-hint"></span>').text('Arrastra algo a quien se lo quieras dar:'));
        for (const mate of mates) {
            const face = $('<div class="ch-mate"></div>').attr('data-member', mate.id).attr('title', mate.name);
            if (mate.avatar) face.append($('<img alt="">').attr('src', mate.avatar));
            face.append($('<span></span>').text(mate.name));
            face.on('dragover', (event) => {
                event.preventDefault();
                face.addClass('over');
            });
            face.on('dragleave', () => face.removeClass('over'));
            face.on('drop', (event) => {
                event.preventDefault();
                face.removeClass('over');
                const id = String(/** @type {DragEvent} */ (event.originalEvent)?.dataTransfer?.getData('text/plain') ?? '');
                if (id) after(Boolean(onGive(id, mate.id)));
            });
            faces.append(face);
        }
        root.append(faces);
    }
    for (const item of sheet.inventory) {
        const row = $('<div class="ch-item"></div>').attr('data-item', item.id);
        row.append($('<span class="ch-item-name"></span>').text(item.name));
        if (item.weight > 0) row.append($('<span class="ch-item-weight"></span>').text(`${item.weight} kg`));
        if (onGive && mates.length > 0 && item.id) {
            row.attr('draggable', 'true');
            row.on('dragstart', (event) => {
                /** @type {DragEvent} */ (event.originalEvent)?.dataTransfer?.setData('text/plain', item.id);
            });
            const give = $('<select class="ch-give"></select>').append($('<option value=""></option>').text('Dar a…'));
            for (const mate of mates) give.append($('<option></option>').attr('value', mate.id).text(mate.name));
            give.on('change', () => {
                const to = String(give.val() ?? '');
                if (to) after(Boolean(onGive(item.id, to)));
            });
            row.append(give);
        }
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
    return changed;
}
