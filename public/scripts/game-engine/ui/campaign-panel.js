/**
 * The campaign panel: the day, the bonds, and what they unlock.
 *
 * This is the door that the calendar and the bonds never had. Both have been complete and
 * tested since the Fase D work and neither was reachable from the game, which made them
 * the clearest case of the pattern this project keeps tripping over: written, proved, and
 * not connected to anything.
 *
 * Draws only. Every action is a callback the caller provides, so advancing time and
 * recording a bond event stay where the state lives.
 *
 * See wiki/ROADMAP.md, Fase D (D6).
 */

import { buildCampaignView, getRecordableEvents } from '../campaign/campaign-view.js';

/**
 * Renders the panel into a container.
 *
 * @param {JQuery} container
 * @param {Object} input
 * @param {any} input.calendar
 * @param {any} input.bonds
 * @param {Array<any>} input.party
 * @param {() => void} input.onAdvanceSlot
 * @param {() => void} input.onAdvanceDay
 * @param {() => void} [input.onShortRest]
 * @param {() => void} [input.onLongRest]
 * @param {(characterId: string, eventType: string) => void} input.onRecordEvent
 * @param {any} [input.bill] La cuenta de la semana, si hay grupo al que pasarsela.
 * @param {number} [input.daysToBill] Cuantos dias faltan para que venza.
 * @param {Array<{name: string, said: string}>} [input.needs] Quien pasa hambre, sed o frio.
 * @param {string[]} [input.world] Lo que se mueve ahi fuera sin ti: facciones y sus relojes.
 */
export function renderCampaignPanel(container, {
    calendar, bonds, party, onAdvanceSlot, onAdvanceDay, onRecordEvent,
    onShortRest = null, onLongRest = null, bill = null, daysToBill = 0, needs = [],
    world = [],
}) {
    const view = buildCampaignView({ calendar, bonds, party });
    container.empty();

    // ---- The day ---------------------------------------------------------
    const clock = $('<div class="cp-clock"></div>');
    clock.append($('<div class="cp-day"></div>').text(`Día ${view.day}`));

    const slotRow = $('<div class="cp-slots"></div>');
    for (const slot of view.slots) {
        slotRow.append(
            $('<span class="cp-slot"></span>')
                .toggleClass('current', slot.current)
                .text(slot.label),
        );
    }
    clock.append(slotRow);

    const clockActions = $('<div class="cp-clock-actions"></div>');
    clockActions.append(
        $('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-forward"></i>')
            .append($('<span></span>').text(' Pasar el rato'))
            .attr('title', 'Avanza al siguiente bloque del día')
            .on('click', () => onAdvanceSlot()),
    );
    clockActions.append(
        $('<button class="menu_button"></button>')
            .append('<i class="fa-solid fa-bed"></i>')
            .append($('<span></span>').text(' Dormir'))
            .attr('title', 'Salta al día siguiente')
            .on('click', () => onAdvanceDay()),
    );
    if (onShortRest) {
        clockActions.append(
            $('<button class="menu_button"></button>')
                .append('<i class="fa-solid fa-campground"></i>')
                .append($('<span></span>').text(' Descanso corto'))
                .attr('title', 'Gasta dados de golpe para curarse, y un bloque del día')
                .on('click', () => onShortRest()),
        );
    }
    if (onLongRest) {
        clockActions.append(
            $('<button class="menu_button"></button>')
                .append('<i class="fa-solid fa-moon"></i>')
                .append($('<span></span>').text(' Descanso largo'))
                .attr('title', 'Cura del todo, devuelve la mitad de los dados de golpe y amanece')
                .on('click', () => onLongRest()),
        );
    }

    clock.append(clockActions);

    container.append(clock);

    // ---- La cuenta -------------------------------------------------------
    // Antes de que venza, no el dia del cobro: una factura que te sorprende es un
    // impuesto, y una que ves venir es una decision. Es media razon de que quieras
    // aceptar el encargo de manana.
    if (bill) container.append(renderBill(bill, daysToBill));

    // Y como esta cada uno. Debajo de la cuenta porque es la misma pregunta con otra
    // moneda: la cuenta dice si llegas a fin de semana, esto si llegan ellos.
    for (const entry of (Array.isArray(needs) ? needs : [])) {
        container.append($('<div class="cp-need"></div>')
            .append($('<span class="cp-need-who"></span>').text(entry.name))
            .append($('<span class="cp-need-what"></span>').text(entry.said)));
    }

    // Y lo que pasa ahi fuera mientras tanto. Va con el reloj porque es la misma cosa:
    // los dias que curan a los tuyos tambien acercan a los otros a lo que quieren.
    if (Array.isArray(world) && world.length > 0) {
        container.append($('<div class="cp-world-title"></div>').text('Ahí fuera'));
        for (const line of world) {
            container.append($('<div class="cp-world"></div>').text(line));
        }
    }

    if (view.characters.length === 0) {
        container.append($('<div class="cp-empty"></div>').text(
            'No hay nadie en el grupo todavía. Los vínculos aparecen aquí cuando lo haya.',
        ));
        return;
    }

    // ---- The bonds -------------------------------------------------------
    const events = getRecordableEvents();
    const list = $('<div class="cp-bonds"></div>');

    for (const character of view.characters) {
        const card = $('<div class="cp-bond"></div>');

        const head = $('<div class="cp-bond-head"></div>');
        if (character.avatar) {
            head.append($('<img class="cp-bond-avatar">').attr('src', character.avatar).attr('alt', ''));
        }
        head.append($('<span class="cp-bond-name"></span>').text(character.name));
        head.append(
            $('<span class="cp-bond-rank"></span>')
                .toggleClass('maxed', character.maxed)
                .text(character.maxed ? 'Rango máximo' : `Rango ${character.rank}`),
        );
        card.append(head);

        // Progress towards the next rank. The thresholds grow, so the later ranks are
        // earned rather than accumulated, and the bar is what makes that visible.
        const bar = $('<div class="cp-bond-bar"></div>');
        bar.append($('<div class="cp-bond-fill"></div>').css('width', `${Math.round(character.progress * 100)}%`));
        card.append(bar);
        card.append($('<div class="cp-bond-points"></div>').text(
            character.maxed
                ? `${character.points} puntos`
                : `${character.points} / ${character.nextAt} para el rango ${character.rank + 1}`,
        ));

        // Every perk, earned or not: seeing what rank 8 gives is the reason to keep
        // spending evenings with somebody.
        const perks = $('<div class="cp-perks"></div>');
        for (const perk of character.perks) {
            const row = $('<div class="cp-perk"></div>')
                .toggleClass('unlocked', perk.unlocked)
                .toggleClass('spent', perk.unlocked && perk.spentToday)
                .attr('title', perk.description);
            row.append($('<span class="cp-perk-rank"></span>').text(String(perk.rank)));
            row.append($('<span class="cp-perk-label"></span>').text(perk.label));
            if (perk.unlocked && perk.spentToday) {
                row.append($('<span class="cp-perk-note"></span>').text('usado hoy'));
            }
            perks.append(row);
        }
        card.append(perks);

        const actions = $('<div class="cp-bond-actions"></div>');
        const picker = $('<select class="text_pole cp-event"></select>');
        for (const event of events) {
            picker.append(
                $('<option></option>')
                    .attr('value', event.type)
                    .text(`${event.label} (${event.points > 0 ? '+' : ''}${event.points})`),
            );
        }
        actions.append(picker);
        actions.append(
            $('<button class="menu_button"></button>')
                .append('<i class="fa-solid fa-plus"></i>')
                .append($('<span></span>').text(' Registrar'))
                .on('click', () => onRecordEvent(character.id, String(picker.val() || ''))),
        );
        card.append(actions);

        list.append(card);
    }

    container.append(list);

    container.append($('<div class="cp-note"></div>').text(
        'Los vínculos suben por hechos registrados, no por lo que diga la narración: '
        + 'el combate superado y la misión completada los cuenta el motor.',
    ));
}

/**
 * La cuenta de la semana, con lo que debes y lo que tienes.
 *
 * Las curas van aparte del total a proposito: pagar la cena no es opcional y curar a
 * Bruna si. Juntarlas esconderia la unica decision que hay aqui.
 *
 * @param {any} bill
 * @param {number} daysLeft
 * @returns {JQuery}
 */
function renderBill(bill, daysLeft) {
    const panel = $('<div class="cp-bill"></div>').toggleClass('short', !bill.covered);

    const head = $('<div class="cp-bill-head"></div>');
    head.append($('<span class="cp-bill-when"></span>').text(
        daysLeft > 0 ? `Vence en ${daysLeft} dia(s)` : 'Vence hoy'));
    head.append($('<span class="cp-bill-sum"></span>').text(`${bill.total} / ${bill.purse}`));
    panel.append(head);

    const parts = $('<div class="cp-bill-parts"></div>');
    for (const [label, amount] of [
        ['Comida', bill.food], ['Posada', bill.lodging], ['Tasas', bill.tax], ['Sueldos', bill.wages],
    ]) {
        if (amount <= 0) continue;
        parts.append($('<span class="cp-bill-part"></span>').text(`${label} ${amount}`));
    }
    panel.append(parts);

    if (!bill.covered) {
        panel.append($('<div class="cp-bill-short"></div>').text(`Faltan ${bill.missing} de oro.`));
    }

    for (const wound of bill.wounded) {
        panel.append($('<div class="cp-bill-wound"></div>').text(
            wound.gold > 0
                ? `${wound.name}: curarse cuesta ${wound.gold} y ${wound.days} dia(s).`
                : `${wound.name}: lo suyo no se cura con dinero.`,
        ));
    }

    return panel;
}

