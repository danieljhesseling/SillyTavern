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
import { firstArt, loadPixelManifest } from './pixel-art.js';
import { faceElement } from './hero-face.js';
import { describePrep } from '../campaign/guild-perks.js';

/**
 * Un icono en pixel, o nada: quien llama pone el suyo de siempre si no hay dibujo.
 *
 * @param {string} url
 * @param {string} className
 * @returns {JQuery|null}
 */
function pixel(url, className) {
    if (!url) return null;
    return $('<img alt="" class="pixel-art">').addClass(className).attr('src', url);
}

/**
 * Lo que dice una habilidad de lo que le queda: sus usos, «a voluntad», o, si es un
 * conjuro de 5e, su nivel.
 *
 * @param {{left: number|null, spellLevel?: number|null}} ability
 * @returns {string}
 */
function abilityLeft(ability) {
    if (typeof ability.spellLevel === 'number') return ability.spellLevel === 0 ? 'truco' : `${ability.spellLevel}.º nivel`;
    return ability.left === null ? 'a voluntad' : `${ability.left} uso(s)`;
}

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
 * @param {import('../combat/bond-moves.js').BondSheetRow[]} [input.bondPerks] E3.4: lo que da su
 *   vínculo contigo en combate (`bondSheetRows`): lo abierto y lo siguiente.
 * @param {(() => void)|null} [input.onEdit] Abrir el editor de siempre.
 * @param {string[]} [input.languages] Idea 59: lo que habla.
 * @param {Array<{name: string}>} [input.sets] Idea 62: sus juegos de equipo.
 * @param {Array<{id: string, name: string, avatar?: string, className?: string, gender?: string, race?: string, mercenary?: boolean}>} [input.mates]
 *   Idea 163: a quién se le puede dar algo, con su cara (J1.8).
 * @param {string[]|null} [input.campaigns] J1.7: en qué campañas ha estado, en frases. Nulo fuera del
 *   juego del gremio (un mundo suelto no sale de ningún tablón).
 * @param {((itemId: string, toId: string) => boolean)|null} [input.onGive]
 * @param {((name: string) => boolean)|null} [input.onSaveSet]
 * @param {((name: string) => boolean)|null} [input.onApplySet]
 * @param {any[]|null} [input.known] J19: lo que sabe, con sus conjuros de 5e ya puestos.
 * @param {{lines: string[]}|null} [input.magic] J19: sus espacios y su concentración, en frases.
 * @param {(() => void)|null} [input.onGrimoire] J19: abrir su grimorio (preparar, elegir).
 * @param {(() => void)|null} [input.onFieldMagic] J19.10: la magia fuera de combate (curar, luz, rituales…).
 * @param {(() => void)|null} [input.onLevelUp] Subir de nivel: solo se pasa cuando toca.
 * @param {((itemId: string, on: boolean) => boolean)|null} [input.onAttune] J19.9: sintonizarse o dejarlo.
 * @param {string} [input.attuneNote] J19.9: cuántos lleva en sintonía, de cuántos.
 * @param {(() => void)|null} [input.onFace] D-J52: cambiar su cara sin arte (iniciales, icono o emoji).
 * @param {(() => boolean)|null} [input.onEquipBest] E7.3: ponerse lo mejor de lo que tiene a mano.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<string>} `changed` si se ha tocado algo, para volver a abrirla al día.
 */
export async function openCharacterPanel({
    member, slotInfo = {}, abilities = [], xpTable = null, bondRank = 0, bondPerks = [],
    onEdit = null, languages = [], sets = [], mates = [], campaigns = null, onGive = null, onSaveSet = null, onApplySet = null,
    known = null, magic = null, onGrimoire = null, onFieldMagic = null, onLevelUp = null, onAttune = null, attuneNote = '',
    onFace = null, onEquipBest = null, Popup, POPUP_TYPE,
}) {
    // Los iconos en pixel necesitan el índice; sin él, cada fila sale con su icono de siempre.
    await loadPixelManifest();
    const sheet = buildCharacterSheet({ member, slotInfo, abilities, xpTable, bondRank, known });
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
    // Sin cara subida, el retrato en pixel de su clase (el mismo que en la tira del grupo), y no
    // la silueta de SillyTavern. J1.8: sin ninguno (una clase del taller, o la imagen subida ya
    // no está), sus iniciales en su color; nunca una imagen rota.
    head.append(faceElement({
        name: sheet.name, avatar: sheet.avatar, className: String(member?.class ?? ''),
        gender: String(member?.gender ?? ''), race: String(member?.race ?? ''), mercenary: member?.guest?.kind === 'mercenary',
        // D-J52: la cara sin arte que eligió.
        face: member?.face ?? null,
    }, { imageClass: 'ch-avatar', badgeClass: 'ch-avatar ch-avatar-initials' }));

    const who = $('<div class="ch-who"></div>');
    who.append($('<div class="ch-name"></div>').text(sheet.name));
    // J1.7: el icono de su clase delante de lo que es, como en el grimorio y la tarjeta de nivel.
    const title = $('<div class="ch-title"></div>');
    const classArt = pixel(firstArt('class', { name: String(member?.class ?? '') }), 'ch-class-art');
    if (classArt) title.append(classArt);
    title.append($('<span></span>').text(sheet.title));
    who.append(title);
    if (sheet.bondRank > 0) {
        who.append($('<div class="ch-bond"></div>').text(`Vínculo ${sheet.bondRank}`));
    }
    // D-J52: cambiar cómo se ve tu cara sin arte.
    if (onFace) {
        const change = $('<button class="menu_button ch-face-change" type="button"></button>')
            .append('<i class="fa-solid fa-palette"></i>')
            .append($('<span></span>').text(' Cambiar cara'))
            .attr('title', 'Tus iniciales en un color, un icono o un emoji');
        change.on('click', () => {
            popup.completeAffirmative();
            onFace();
        });
        who.append(change);
    }
    head.append(who);
    root.append(head);
    // Idea 59: lo que habla, que ahora importa.
    if (languages.length > 0) root.append($('<div class="ch-langs"></div>').text(`Habla: ${languages.join(', ')}`));

    // E3.4: lo que da vuestro vínculo en combate: lo abierto («Con vínculo 5: Relevo») y lo siguiente.
    const shownPerks = (Array.isArray(bondPerks) ? bondPerks : []).filter(row => row.unlocked || row.next);
    if (shownPerks.length > 0) {
        const perks = $('<div class="ch-bond-perks"></div>');
        perks.append($('<div class="ch-bond-perks-title"></div>').text('Vuestro vínculo, en combate'));
        for (const row of shownPerks) {
            const line = $('<div class="ch-bond-perk"></div>')
                .toggleClass('ch-bond-perk-next', row.next)
                .attr('data-rank', String(row.rank));
            line.append($('<span class="ch-bond-perk-name"></span>').text(`Con vínculo ${row.rank}: ${row.label}${row.next ? ' (lo siguiente)' : ''}`));
            line.append($('<span class="ch-bond-perk-what"></span>').text(row.describe));
            perks.append(line);
        }
        root.append(perks);
    }

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
        ...(sheet.needs ? [sheet.needs] : []),
        ...sheet.conditions,
    ];
    if (wrong.length > 0 || sheet.injuryRows.length > 0) {
        const list = $('<div class="ch-wrong"></div>');
        // Las heridas y las enfermedades, con su dibujo (`estados/`), que se reconocen antes
        // que la frase.
        for (const injury of sheet.injuryRows) {
            const tag = $('<span class="ch-tag ch-injury"></span>').attr('data-injury', injury.id);
            const art = pixel(firstArt('condition', { id: injury.id, name: injury.label }), 'ch-tag-art');
            if (art) tag.append(art);
            tag.append($('<span></span>').text(injury.text));
            list.append(tag);
        }
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
    // E5.1: lo preparado en casa para esta salida (el temple suma a la CA en la pelea).
    const prepared = describePrep(member);
    if (prepared.length > 0) {
        const prep = $('<div class="ch-prep"></div>');
        prep.append($('<div class="ch-prep-title"></div>').text('Preparado en el gremio'));
        for (const line of prepared) prep.append($('<div></div>').text(line));
        root.append(prep);
    }

    // ---- Lo que lleva puesto ----------------------------------------------
    root.append($('<div class="ch-title-row"></div>').text('Equipo'));
    const worn = $('<div class="ch-gear"></div>');
    for (const slot of sheet.equipment) {
        const row = $('<div class="ch-slot"></div>').toggleClass('empty', slot.empty).attr('data-slot', slot.slot);
        row.append(`<i class="fa-solid ${slot.icon}"></i>`);
        row.append($('<span class="ch-slot-label"></span>').text(slot.label));
        const art = slot.empty ? null : pixel(firstArt('item', { name: slot.item }), 'ch-item-art');
        if (art) row.append(art);
        row.append($('<span class="ch-slot-item"></span>').text(slot.empty ? '—' : slot.item));
        worn.append(row);
    }
    root.append(worn);
    // E3.3: el arma imbuida, bajo lo que lleva puesto.
    if (sheet.spellWeapon) root.append($('<div class="ch-imbue"></div>').text(sheet.spellWeapon));
    // E7.3: ponerse lo mejor de lo que hay a mano, con un toque (y dice por qué).
    if (onEquipBest) {
        const best = $('<button class="menu_button ch-equip-best" type="button"></button>')
            .append('<i class="fa-solid fa-shirt"></i>')
            .append($('<span></span>').text(' Equipar lo mejor'))
            .attr('title', 'El mejor arma y la mejor armadura que tiene a mano, según su clase y lo que domina.');
        best.on('click', () => after(Boolean(onEquipBest())));
        root.append(best);
    }

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

    // ---- J19: su magia, si lanza con espacios -----------------------------
    // D-J49: y aunque no lance, si alguien del grupo lo hace: la magia fuera de combate está aquí.
    if (magic || onGrimoire || onFieldMagic) {
        root.append($('<div class="ch-title-row"></div>').text('Magia'));
        const box = $('<div class="ch-magic"></div>');
        for (const line of magic?.lines ?? []) box.append($('<div class="ch-magic-line"></div>').text(line));
        if (onGrimoire) {
            const open = $('<button class="menu_button ch-grimoire" type="button"></button>')
                .append('<i class="fa-solid fa-book-open"></i>')
                .append($('<span></span>').text(' Grimorio: preparar y elegir conjuros'));
            open.on('click', () => {
                popup.completeAffirmative();
                onGrimoire();
            });
            box.append(open);
        }
        // J19.10: lo que se lanza sin pelear, a un toque desde la ficha.
        if (onFieldMagic) {
            const field = $('<button class="menu_button ch-field-magic" type="button"></button>')
                .append('<i class="fa-solid fa-wand-sparkles"></i>')
                // Sin prometer lo que no tiene: un erudito no cura ni alumbra (D-J27).
                .append($('<span></span>').text(' Magia fuera de combate'))
                .attr('title', 'Lo que el grupo puede lanzar ahora sin pelear: rituales, curar, luz…');
            field.on('click', () => {
                popup.completeAffirmative();
                onFieldMagic();
            });
            box.append(field);
        }
        root.append(box);
    }

    // ---- Lo que sabe hacer -------------------------------------------------
    if (sheet.abilities.length > 0) {
        root.append($('<div class="ch-title-row"></div>').text('Habilidades'));
        const list = $('<div class="ch-abilities"></div>');
        for (const ability of sheet.abilities) {
            const row = $('<div class="ch-ability"></div>').toggleClass('spent', ability.spent).attr('data-ability', ability.id);
            if (ability.blocked) row.attr('title', ability.blocked);
            const art = pixel(firstArt('ability', { id: ability.id, name: ability.name }), 'ch-ability-art');
            if (art) row.append(art);
            row.append($('<span class="ch-ability-name"></span>').text(ability.name));
            row.append($('<span class="ch-ability-left"></span>').text(abilityLeft(ability)));
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
            // J1.8: su cara, su retrato en pixel o sus iniciales, como en la tira del grupo.
            face.append(faceElement(mate, { imageClass: 'ch-mate-face', badgeClass: 'ch-mate-face' }));
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
    // J19.9: lo que pide sintonía, y cuántos se pueden llevar así.
    if (onAttune && sheet.inventory.some(item => item.attunement)) {
        root.append($('<div class="ch-attune-note"></div>').text(attuneNote || 'Sintonía: tres objetos como mucho, y se hace fuera de combate.'));
    }
    for (const item of sheet.inventory) {
        const row = $('<div class="ch-item"></div>').attr('data-item', item.id);
        const art = pixel(firstArt('item', { name: item.name }), 'ch-item-art');
        if (art) row.append(art);
        row.append($('<span class="ch-item-name"></span>').text(item.name));
        if (item.weight > 0) row.append($('<span class="ch-item-weight"></span>').text(`${item.weight} kg`));
        if (onAttune && item.attunement && item.id) {
            const tune = $('<button class="menu_button ch-attune" type="button"></button>')
                .attr('data-item', item.id)
                .toggleClass('is-on', item.attuned)
                .text(item.attuned ? 'Dejar la sintonía' : 'Sintonizar');
            tune.attr('title', item.attuned ? 'Deja de funcionar hasta que vuelvas a sintonizarte.' : 'Una hora tranquila con él: después funciona.');
            tune.on('click', () => after(Boolean(onAttune(item.id, !item.attuned))));
            row.append(tune);
        }
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
    // Subir de nivel, desde tu ficha: antes solo se llegaba por el editor a fondo. Quien
    // llama solo lo pasa cuando toca.
    if (onLevelUp) {
        const up = $('<button class="menu_button ch-levelup" type="button"></button>')
            .append('<i class="fa-solid fa-star"></i>')
            .append($('<span></span>').text(' Subir de nivel'));
        up.on('click', () => {
            popup.completeAffirmative();
            onLevelUp();
        });
        progress.append(up);
    }

    // ---- J1.7: en qué campañas ha estado (en el juego del gremio) -----------
    if (Array.isArray(campaigns)) {
        root.append($('<div class="ch-title-row"></div>').text('Campañas'));
        const tales = $('<div class="ch-campaigns"></div>');
        const told = campaigns.map(line => String(line ?? '').trim()).filter(Boolean);
        if (told.length === 0) tales.append($('<div class="ch-empty"></div>').text('Todavía no ha salido a ninguna campaña.'));
        for (const line of told) tales.append($('<div class="ch-campaign"></div>').text(line));
        root.append(tales);
    }

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
