/**
 * El calabozo, en juego (D-J47 de wiki/ROADMAP_SIN_CONEXION.md): a la segunda vez que os pillan
 * robando en la misma tienda, mientras se acuerdan de la primera, la guardia del sitio se lleva
 * a quien robó. Lo que se decide está en `game-engine/campaign/jail.js`; aquí se aplica: lo que
 * se requisa, la multa, lo que os buscaban, la escena y los días en la celda.
 *
 * Lo llama la tienda (`stealItem` de `town.js`) cuando `jailHere` (`world.js`) dice que toca.
 * Vale en Puerto Alba y en cualquier pueblo de una campaña, con la guardia de ese sitio.
 */

import { chat_metadata, saveMetadata } from '../../script.js';
import { removeItemFromInventory } from '../dnd-system.js';
import { settleGuards } from '../game-engine/campaign/crime.js';
import { guardOf, jailFine, jailLine, jailScene, stolenHere } from '../game-engine/campaign/jail.js';
import { openPlotScene } from '../game-engine/ui/plot-scene.js';
import { shownName } from '../game-engine/ui/shown-names.js';
import { closeTownPlace } from '../game-engine/ui/shell/town-scene.js';
import { isShellOpen, refreshGameShell } from '../game-engine/ui/shell/game-shell.js';
import { WANTED_KEY } from './keys.js';
import { currentLocationName, partyMembers } from './state.js';
import { lastPack, lastWorldNpcs, leaveMark } from './world.js';
import { advanceCampaignDay, campaignDay } from './time.js';
import { noteDeed } from './world-growth.js';
import { narratorMode, postCombatNarration, postForModel } from './narration.js';
import { partyPurse, payFromParty, renderPartyMembers, savePartyState } from './roster.js';
import { storyNight } from './plot.js';

/**
 * Al calabozo: la guardia se queda con lo robado aquí (lo de ahora y lo de antes), se paga una
 * multa pequeña si llega el oro, lo que os buscaban en el pueblo queda saldado, se ve la escena
 * (sin conexión, como una novela visual) y pasan los días en la celda. Se sale a la calle, fuera
 * de la tienda.
 *
 * @param {Object} input
 * @param {any} input.thief Quien robó.
 * @param {string} input.attempted Lo que se intentó llevar ahora (no llegó a salir de la tienda).
 * @param {number} input.price Lo que valía.
 * @param {number} input.days Los días de celda (`calabozo` de `ecos.json`).
 * @returns {Promise<string>} Lo que pasó, en una línea.
 */
export async function goToJail({ thief, attempted, price, days }) {
    if (!chat_metadata || !thief) return '';
    const owner = chat_metadata;
    const town = currentLocationName;
    const hero = partyMembers.find(m => !m.guest) ?? partyMembers[0] ?? null;

    // Lo que salió antes de esta tienda sin pagar: la guardia también se lo queda.
    const stolen = stolenHere(partyMembers, town);
    for (const piece of stolen) {
        const member = partyMembers.find(m => String(m.id) === piece.memberId);
        if (member) removeItemFromInventory(/** @type {any} */ (member), piece.itemId);
    }
    const fine = jailFine(price);
    const paid = partyPurse() >= fine && payFromParty(fine);
    // Con los días de celda ya habéis pagado: lo que os buscaban aquí queda saldado.
    chat_metadata[WANTED_KEY] = settleGuards(chat_metadata[WANTED_KEY], town, 'pay');
    leaveMark('calabozo', { who: String(thief.name ?? '') });
    savePartyState();
    saveMetadata();
    renderPartyMembers();

    const facts = {
        town,
        guard: guardOf({ npcs: lastWorldNpcs, town }),
        // J13.7: por lo que es («La tendera del mercado») si aún no se ha presentado.
        keeper: shownName(lastWorldNpcs.find(n => !n.dead && n.service === 'tienda' && n.where.toLowerCase() === String(town).toLowerCase())?.name ?? '', 'El'),
        thief,
        hero,
        // Si la guardia se lleva a quien juega, va a verle alguien de su gente; si se lleva a
        // alguien de su gente, va quien juega.
        visitor: partyMembers.find(m => m !== thief && !m.dead && (Number(m.hp) || 0) > 0) ?? null,
        days,
        fine,
        paid,
        taken: [attempted, ...stolen.map(s => s.name)].filter(Boolean),
        releaseDay: Math.max(1, campaignDay()) + days,
    };
    const line = jailLine(facts);
    postCombatNarration(`🔒 [GUARDIAS] ${line}`);
    noteDeed(line);
    if (narratorMode() === 'motor') {
        await openPlotScene({ scene: jailScene(facts), hero, pack: lastPack, town, night: storyNight() })
            .catch(error => console.error('[calabozo] no se pudo abrir la escena', error));
    } else {
        toastr.warning(line, 'El calabozo', { timeOut: 12000 });
        void postForModel(`[GUARDIAS] ${line} Cuéntalo en dos frases.`);
    }
    // Mientras se leía, se puede haber cambiado de partida: los días no pasan en otra.
    if (chat_metadata !== owner) return line;
    // Los días en la celda: el reloj pasa (con lo que cura, cobra y cuenta cada día).
    for (let day = 0; day < days; day++) advanceCampaignDay();
    // Se sale a la calle: fuera de la tienda.
    closeTownPlace();
    if (isShellOpen()) refreshGameShell();
    return line;
}
