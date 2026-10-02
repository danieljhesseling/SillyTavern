/**
 * J10.7: las campañas del tablón que no traen su historia escrita.
 *
 * Al empezar una campaña desde el gremio (`campaigns.js`, `playHubCampaign`) se lee su paquete. Si
 * la fila del tablón no trae paquete pero sí semilla (las de `mundos.json` como «La costa que no
 * duerme»), el paquete se hace con la semilla; y si el paquete no trae hilo (una campaña de tu Gem
 * añadida antes de J10.7), se le escribe una historia en tres actos. Todo con el compendio recién
 * abierto: la misma semilla da siempre la misma campaña.
 *
 * Solo exporta funciones: importarlo no hace nada.
 */

import { freshCompendium } from '../game-engine/compendio/browser.js';
import { seedCampaignPack } from '../game-engine/campaign/seed-pack.js';
import { needsActThread } from '../game-engine/campaign/act-grammar.js';

// Se reexporta sin pasar por aquí: importar este módulo no lee nada (`party-facade.test.js`).
export { isSeedWorld } from '../game-engine/campaign/seed-pack.js';

/**
 * El paquete con el que se empieza una campaña del tablón: el suyo (o el de su semilla, si no
 * trae), con su historia en tres actos si no la traía.
 *
 * @param {any} world La fila del tablón.
 * @param {any} [pack] Su paquete, ya leído; sin él, se hace con la semilla de la fila.
 * @returns {Promise<any>}
 */
export async function campaignPackWithStory(world, pack = null) {
    if (pack && !needsActThread(pack)) return pack;
    const compendium = await freshCompendium();
    return seedCampaignPack({ row: world, pack, compendium }).pack;
}
