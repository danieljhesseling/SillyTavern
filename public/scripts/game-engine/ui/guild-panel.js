/**
 * El panel del gremio: el tablón, la reputación y lo que hay levantado.
 *
 * Es la pantalla donde se decide **con qué dinero se hace qué**, así que enseña las tres
 * cosas juntas y no en pestañas: lo que tienes, lo que te ofrecen y lo que podrías
 * construir. Separarlas convertiría una decisión en tres consultas.
 *
 * Dibuja y recoge. Lo que decide qué vale un encargo, qué abarata un edificio y cuándo se
 * va alguien está en `campaign/contracts.js` y `campaign/guild.js`; aquí no hay ni una
 * regla.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 4.
 */

import { RANKS, deadlineOf, describeContract } from '../campaign/contracts.js';
import { BUILDINGS, upgradeCost, describeGuild, boardSize } from '../campaign/guild.js';

/** Cómo se lee cada rango, para no enseñar solo una letra. */
const RANK_LABELS = Object.fromEntries(RANKS.map(rank => [rank.id, rank.label]));

/**
 * Abre el gremio. Devuelve lo que hay que hacer, o null si se cierra sin tocar nada.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {any[]} input.board      Los encargos del tablón.
 * @param {number} input.day       Hoy, para los plazos.
 * @param {number} input.purse     Lo que hay entre todos.
 * @param {any[]} input.roster     Quién está en la compañía.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<{accepted: string, built: string}|null>}
 */
export async function openGuildPanel({ guild, board, day, purse, roster, Popup, POPUP_TYPE }) {
    /** Lo único que sale de aquí: qué encargo se acepta y qué se construye. */
    let accepted = '';
    let built = '';

    const root = $('<div class="gd-root"></div>');

    // ---- La cabecera: quién eres y cuánto tienes -------------------------
    const head = $('<div class="gd-head"></div>');
    head.append($('<div class="gd-name"></div>').text(describeGuild(guild)));
    head.append($('<div class="gd-purse"></div>').text(`${purse} de oro`));
    root.append(head);

    // ---- El tablón --------------------------------------------------------
    root.append($('<div class="gd-title"></div>').text('Tablón de encargos'));
    root.append($('<div class="gd-hint"></div>').text(
        `Tu reputación abre los rangos. Hay sitio para ${boardSize(guild)} encargos, y los `
        + 'plazos corren aunque no los mires.',
    ));

    const list = $('<div class="gd-board"></div>');
    if (board.length === 0) {
        list.append($('<div class="gd-empty"></div>').text(
            'El tablón está vacío. Pasa el tiempo y llegará trabajo.'));
    }

    for (const contract of board) {
        const { daysLeft, expired, urgent } = deadlineOf(contract, day);
        const card = $('<div class="gd-contract"></div>')
            .toggleClass('urgent', urgent)
            .toggleClass('expired', expired);

        const top = $('<div class="gd-contract-head"></div>');
        top.append($('<span class="gd-rank"></span>')
            .text(contract.rank)
            .attr('title', RANK_LABELS[contract.rank] ?? ''));
        top.append($('<span class="gd-contract-title"></span>').text(contract.title));
        card.append(top);

        const meta = $('<div class="gd-contract-meta"></div>');
        meta.append($('<span></span>').text(`${contract.reward} de oro`));
        meta.append($('<span></span>').text(expired ? 'vencido' : `${daysLeft} día(s)`));
        meta.append($('<span></span>').text(contract.patron));
        if (contract.locationName) meta.append($('<span></span>').text(contract.locationName));
        card.append(meta);

        const take = $('<button class="menu_button gd-take" type="button"></button>')
            .append('<i class="fa-solid fa-hand-fist"></i>')
            .append($('<span></span>').text(' Aceptar'));
        take.prop('disabled', expired);
        take.attr('title', expired ? 'Se pasó el plazo' : describeContract(contract, day));
        take.on('click', () => {
            accepted = String(contract.id);
            popup.completeAffirmative();
        });
        card.append(take);

        list.append(card);
    }
    root.append(list);

    // ---- Lo que hay levantado --------------------------------------------
    root.append($('<div class="gd-title"></div>').text('La casa'));
    root.append($('<div class="gd-hint"></div>').text(
        'Cada edificio abarata algo que pagas todas las semanas, o trae más trabajo. '
        + 'Sale del mismo oro que la cena.',
    ));

    const houses = $('<div class="gd-buildings"></div>');
    for (const [key, building] of Object.entries(BUILDINGS)) {
        const level = Number(guild.buildings?.[key]) || 0;
        const next = upgradeCost(guild, key);

        const card = $('<div class="gd-building"></div>');
        card.append($('<div class="gd-building-name"></div>')
            .text(level > 0 ? `${building.label} ${level}` : building.label));
        card.append($('<div class="gd-building-what"></div>').text(building.describe));

        const button = $('<button class="menu_button gd-build" type="button"></button>');
        if (next.maxed) {
            button.text('Al máximo').prop('disabled', true);
        } else {
            button.text(`Subir · ${next.cost}`);
            // No se esconde lo que no puedes pagar: saber cuánto falta es media decisión.
            button.prop('disabled', purse < next.cost);
            button.attr('title', purse < next.cost
                ? `Te faltan ${next.cost - purse} de oro`
                : building.describe);
            button.on('click', () => {
                built = key;
                popup.completeAffirmative();
            });
        }
        card.append(button);
        houses.append(card);
    }
    root.append(houses);

    // ---- Quién está --------------------------------------------------------
    root.append($('<div class="gd-title"></div>').text('La compañía'));
    const people = $('<div class="gd-roster"></div>');
    if (roster.length === 0) {
        people.append($('<div class="gd-empty"></div>').text('No hay nadie contratado todavía.'));
    }
    for (const member of roster) {
        const paid = String(member?.motive ?? '').toLowerCase() === 'coin';
        const row = $('<div class="gd-member"></div>');
        row.append($('<span class="gd-member-name"></span>').text(String(member?.name ?? '')));
        row.append($('<span class="gd-member-why"></span>').text(
            paid ? `por dinero · lealtad ${Number(member?.loyalty) || 0}` : 'por un vínculo'));
        people.append(row);
    }
    root.append(people);

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Cerrar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
    });

    await popup.show();
    return (accepted || built) ? { accepted, built } : null;
}
