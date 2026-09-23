/**
 * Lo que se puede hacer con una herida que no cura.
 *
 * Las cuatro peores heridas son para siempre, y caen justo sobre quien te sigue por un
 * vínculo, porque es a quien la campaña no mata. Sin salida, el juego pone a quien juega
 * ante un dilema perverso: o dejas en la taberna a la persona que más quieres para no
 * perder el combate, o la llevas y te hunde el encuentro. Encariñarse con alguien se
 * convierte en un castigo, y eso es lo contrario de lo que quieren los vínculos.
 *
 * Aquí hay dos salidas, y las dos cuestan algo de verdad:
 *
 * - **Un remedio**: oro a cambio de cambiar la herida por otra más llevadera. La pierna
 *   perdida se queda perdida, pero la de palo enana deja andar. Sigue siendo permanente,
 *   y sigue contando la historia.
 * - **Un puesto en el gremio** (`campaign/guild.js`): deja de salir contigo, pero no
 *   desaparece. Se queda en casa haciendo algo que se nota en la cuenta de cada semana.
 *
 * Puro: devuelve parches y no toca ninguna ficha.
 */

import { readInjuries, setInjury, applyInjury } from './injuries.js';

/**
 * @typedef {Object} Remedy
 * @property {string} label Lo que se compra.
 * @property {string} description
 * @property {number} cost En oro.
 * @property {any|null} becomes La herida que queda en su lugar, o null si se va del todo.
 */

/**
 * Los remedios de serie, por la herida que arreglan.
 *
 * Viven aquí, en el código: el paquete de reglas todavía no tiene una sección para
 * ellos, así que no se editan desde `/rules`. `readRemedies` ya acepta una tabla propia
 * para cuando la tenga.
 *
 * @type {Record<string, Remedy>}
 */
export const DEFAULT_REMEDIES = {
    lost_leg: {
        label: 'Pierna de palo enana',
        description: 'Madera de roble y bisagras de enano. Cojea, pero anda.',
        cost: 150,
        becomes: {
            id: 'wooden_leg', label: 'Pierna de palo', description: 'Hecha por un enano: se oye llegar.',
            modifiers: { speed: -5 }, days: 0,
        },
    },
    lost_hand: {
        label: 'Garfio de herrero',
        description: 'No coge una copa, pero sujeta un escudo como nadie.',
        cost: 90,
        becomes: {
            id: 'hook_hand', label: 'Garfio', description: 'Sujeta el escudo; lo fino, ya no.',
            modifiers: { dexterity: -1 }, days: 0,
        },
    },
    lost_eye: {
        label: 'Lente de cristal tallado',
        description: 'Un monóculo de vidriero que devuelve casi toda la distancia.',
        cost: 120,
        becomes: {
            id: 'glass_eye', label: 'Lente de cristal', description: 'Calcula bien; de lado, no tanto.',
            modifiers: { dexterity: -1 }, days: 0,
        },
    },
    gut_wound: {
        label: 'Bendición del templo',
        description: 'Tres días de rezos y un sacerdote que sabe lo que hace. Se cierra del todo.',
        cost: 200,
        becomes: null,
    },
};

/**
 * Los remedios de la campaña: los de serie con los del mundo encima.
 *
 * @param {any} [rules] Una tabla propia, con la misma forma que `DEFAULT_REMEDIES`.
 * @returns {Record<string, Remedy>}
 */
export function readRemedies(rules = null) {
    /** @type {Record<string, Remedy>} */
    const out = { ...DEFAULT_REMEDIES };
    if (!rules || typeof rules !== 'object') return out;
    for (const [id, raw] of Object.entries(rules)) {
        if (!raw || typeof raw !== 'object') continue;
        const cost = Math.max(0, Math.floor(Number(/** @type {any} */ (raw).cost) || 0));
        out[id] = {
            label: String(/** @type {any} */ (raw).label || 'Remedio'),
            description: String(/** @type {any} */ (raw).description || ''),
            cost,
            becomes: /** @type {any} */ (raw).becomes ?? null,
        };
    }
    return out;
}

/**
 * Qué remedios tiene alguien a mano, y si le llega el oro.
 *
 * Solo para lo que no cura: lo que se cura con días no necesita que se pague por ello
 * (para eso ya está la enfermería).
 *
 * @param {any} member
 * @param {number} purse El oro del grupo.
 * @param {Record<string, Remedy>} [table]
 * @returns {Array<{injuryId: string, injuryLabel: string, remedy: Remedy, affordable: boolean}>}
 */
export function remediesFor(member, purse, table = DEFAULT_REMEDIES) {
    return readInjuries(member)
        .filter(injury => injury.permanent && table[injury.id])
        .map(injury => ({
            injuryId: injury.id,
            injuryLabel: injury.label,
            remedy: table[injury.id],
            affordable: Number(purse) >= table[injury.id].cost,
        }));
}

/**
 * El parche de aplicar un remedio: la herida se va y, si toca, deja otra en su lugar.
 *
 * Pasa por `setInjury` y `applyInjury`, las mismas puertas de siempre, para que
 * `baseStats` siga teniendo un solo dueño.
 *
 * @param {any} member
 * @param {string} injuryId
 * @param {Record<string, Remedy>} [table]
 * @returns {{injuries: any[], baseStats: Record<string, number>, stats: Record<string, number>}|null}
 */
export function applyRemedy(member, injuryId, table = DEFAULT_REMEDIES) {
    const remedy = table[injuryId];
    if (!remedy || !readInjuries(member).some(i => i.id === injuryId && i.permanent)) return null;

    const without = setInjury(member, null, injuryId);
    if (!remedy.becomes) return without;
    return applyInjury({ ...member, injuries: without.injuries, baseStats: without.baseStats }, remedy.becomes);
}

/**
 * Si alguien está como para seguir saliendo.
 *
 * Dos heridas permanentes, o una que le quite más de un tercio de lo que era: a partir de
 * ahí se le ofrece el puesto. Ofrecer, no obligar: hay quien quiere seguir con Bruna
 * aunque cojee, y es su partida.
 *
 * @param {any} member
 * @returns {boolean}
 */
export function shouldOfferRetirement(member) {
    const lasting = readInjuries(member).filter(i => i.permanent);
    if (lasting.length >= 2) return true;
    const speed = Number(member?.baseStats?.speed) || 0;
    const now = Number(member?.speed) || 0;
    return speed > 0 && now <= speed * 2 / 3;
}
