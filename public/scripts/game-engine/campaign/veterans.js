/**
 * Héroes veteranos: traer tu personaje de otra campaña (idea 179).
 *
 * Al empezar una partida, además de hacer un héroe nuevo, se puede traer a uno que ya jugó:
 * los héroes de las otras campañas guardadas. Vienen con su nombre, su oficio, su raza, su
 * trasfondo, sus números y sus mejoras; y con **algo** de lo que llevaban (su arma y lo que
 * lleva puesto), no con toda la mochila. El nivel se queda como máximo en el 5: un veterano
 * de nivel 12 en un mundo nuevo rompería el mundo, no la partida.
 *
 * Los muertos no vuelven.
 *
 * Puro: lista los que hay y deja la ficha lista para entrar.
 */

/** El nivel más alto con el que entra un veterano. */
export const VETERAN_MAX_LEVEL = 5;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los héroes de otras partidas: el primero de cada grupo guardado, vivo.
 *
 * @param {Array<{world: string, meta: any}>} chats
 * @param {string} [skipWorld] La campaña de ahora.
 * @returns {Array<{world: string, hero: any, line: string}>}
 */
export function listVeterans(chats, skipWorld = '') {
    /** @type {Map<string, {world: string, hero: any, line: string}>} */
    const seen = new Map();
    for (const chat of Array.isArray(chats) ? chats : []) {
        const hero = Array.isArray(chat?.meta?.party) ? chat.meta.party[0] : null;
        const world = text(chat?.world);
        if (!hero || hero.dead || !text(hero.name) || world === text(skipWorld)) continue;
        const key = `${world}|${text(hero.name)}`;
        if (seen.has(key)) continue;
        const cls = text(hero.class ?? hero.charClass);
        seen.set(key, { world, hero, line: `${text(hero.name)}${cls ? `, ${cls}` : ''} de nivel ${Math.max(1, Number(hero.level) || 1)} (de ${world})` });
    }
    return [...seen.values()];
}

/**
 * La ficha del veterano, lista para una partida nueva.
 *
 * @param {any} hero
 * @param {number} newId
 * @returns {any}
 */
export function veteranHero(hero, newId) {
    const worn = new Set(Object.values(hero?.equippedItems ?? {}).map(text).filter(Boolean));
    const items = (Array.isArray(hero?.items) ? hero.items : []).filter((/** @type {any} */ i) => worn.has(text(i?.id)));
    const level = Math.min(VETERAN_MAX_LEVEL, Math.max(1, Math.floor(Number(hero?.level) || 1)));
    return {
        ...JSON.parse(JSON.stringify(hero ?? {})),
        id: newId,
        wiUid: null,
        level,
        xp: 0,
        hp: Number(hero?.maxHp) || Number(hero?.hp) || 10,
        items,
        equippedItems: Object.fromEntries(Object.entries(hero?.equippedItems ?? {}).filter(([, id]) => items.some((/** @type {any} */ i) => text(i.id) === text(id)))),
        injuries: [],
        activeConditions: [],
        needs: {},
        gold: Math.min(50, Math.max(0, Number(hero?.gold) || 0)),
        mapPosition: { locationName: '', gridX: 0, gridY: 0 },
        veteranOf: text(hero?.worldName ?? ''),
    };
}
