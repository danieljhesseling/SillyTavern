/**
 * Los servicios de una localidad: la posada, la herrería, el templo, el tablón (fase L).
 *
 * Una localidad era texto y una lista de tableros; si no tenía tableros, era un cartel de
 * bienvenida. Pero los números que movería cada servicio ya existían: lo que cuesta dormir
 * y comer (`upkeep.js`), el vínculo (`bonds.js`), lo que cuesta curarse (`injuries.js`), los
 * remedios de las heridas que no curan (`remedies.js`). Esto les pone **un sitio y un
 * botón**.
 *
 * - **L1 · Qué hay en cada sitio**: lo que diga la localidad; si no dice nada, lo propio de
 *   su tipo. Una aldea tiene posada y herrero; unas ruinas, nada.
 * - **L3 · La posada**: dormir (sala común o habitación), comer caliente, invitar a una
 *   ronda, escuchar rumores, hablar con quien atiende.
 * - **La herrería** hace los remedios (DL1: solo se compran allí) y **el templo** cura.
 *
 * Puro: dice qué hay, qué se puede hacer y cuánto cuesta. Quien llama cobra y aplica.
 *
 * Ver wiki/ROADMAP_MUNDOS_VIVOS.md, fase L.
 */

/** Lo que trae cada tipo de localidad cuando la localidad no dice nada. */
export const SERVICES_BY_TYPE = {
    city: ['posada', 'herreria', 'tienda', 'templo', 'tablon'],
    village: ['posada', 'herreria', 'tienda', 'tablon'],
    outpost: ['herreria', 'tablon'],
    sanctuary: ['templo'],
    camp: ['tienda'],
    ruins: [],
    dungeon: [],
    wilderness: [],
};

/** Cómo se llama y cómo se ve cada servicio. */
export const SERVICE_INFO = {
    posada: { label: 'La posada', icon: 'fa-beer-mug-empty' },
    herreria: { label: 'La herrería', icon: 'fa-hammer' },
    tienda: { label: 'La tienda', icon: 'fa-shop' },
    templo: { label: 'El templo', icon: 'fa-hands-praying' },
    tablon: { label: 'El tablón', icon: 'fa-clipboard-list' },
};

/** Lo que cuesta cada cosa de la posada, en oro. */
export const INN_PRICES = { common: 1, room: 4, meal: 1, round: 3 };

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Qué servicios hay en una localidad.
 *
 * @param {any} location
 * @returns {string[]}
 */
export function servicesOf(location) {
    const written = Array.isArray(location?.services) ? location.services.map(text).filter(s => s in SERVICE_INFO) : null;
    if (written && (written.length > 0 || Array.isArray(location?.services))) return [...new Set(written)];
    const type = text(location?.locationType || location?.type);
    return [...(SERVICES_BY_TYPE[/** @type {keyof typeof SERVICES_BY_TYPE} */ (type)] ?? [])];
}

/**
 * @typedef {Object} ServiceAction
 * @property {string} id
 * @property {string} label
 * @property {string} detail  Lo que hace y lo que cuesta, dicho antes de pulsar.
 * @property {boolean} enabled
 * @property {number} cost
 * @property {string} [target] A quién, si la acción es con alguien.
 */

/**
 * Lo que se puede hacer en cada servicio de aquí, ya juzgado.
 *
 * @param {Object} input
 * @param {any} input.location
 * @param {number} input.purse El oro del grupo.
 * @param {number} input.partySize
 * @param {boolean} [input.fighting]
 * @param {Array<{id: string, name: string}>} [input.companions] Con quién se puede ir de ronda.
 * @param {number} [input.rumors] Los que quedan por oír aquí.
 * @param {string} [input.innkeeper] Quien atiende la posada, si tiene nombre.
 * @param {Array<{id: string, name: string, label: string, cost: number}>} [input.remedies] Lo que hace el herrero.
 * @param {{gold: number, days: number}} [input.cure] Lo que cuesta que el templo cure al grupo.
 * @param {{unknown: number, cursed: number, identify: number, lift: number}} [input.relics] Idea 135:
 *   lo que hay que llevar al templo (sin identificar, malditos) y lo que cobra por cada cosa.
 * @returns {Array<{id: string, label: string, icon: string, actions: ServiceAction[]}>}
 */
export function serviceActions({
    location, purse, partySize, fighting = false, companions = [], rumors = 0, innkeeper = '',
    remedies = [], cure = { gold: 0, days: 0 }, relics = { unknown: 0, cursed: 0, identify: 5, lift: 40 },
}) {
    const heads = Math.max(1, Math.floor(Number(partySize) || 1));
    const gold = Math.max(0, Number(purse) || 0);
    const why = (/** @type {number} */ cost) => (fighting ? 'No mientras peleáis.' : (gold < cost ? `No llega el oro: cuesta ${cost}.` : ''));

    /** @param {string} id @param {string} label @param {string} detail @param {number} cost @param {string} [target] */
    const action = (id, label, detail, cost, target) => {
        const blocked = why(cost);
        return { id, label, detail: blocked || detail, enabled: !blocked, cost, ...(target ? { target } : {}) };
    };

    return servicesOf(location).map(service => {
        /** @type {ServiceAction[]} */
        const actions = [];
        if (service === 'posada') {
            actions.push(action('inn-common', 'Dormir en la sala común',
                `Un descanso corto, entre ronquidos. ${INN_PRICES.common * heads} de oro.`, INN_PRICES.common * heads));
            actions.push(action('inn-room', 'Coger habitación',
                `Un descanso largo, con puerta. ${INN_PRICES.room * heads} de oro.`, INN_PRICES.room * heads));
            actions.push(action('inn-meal', 'Comer caliente',
                `Se acaba el hambre y la sed de todos. ${INN_PRICES.meal * heads} de oro.`, INN_PRICES.meal * heads));
            for (const companion of companions.slice(0, 3)) {
                actions.push(action(`inn-round:${companion.id}`, `Invitar a una ronda a ${companion.name}`,
                    `Una tarde con ${companion.name}: gasta un bloque del día y acerca el vínculo. ${INN_PRICES.round} de oro.`,
                    INN_PRICES.round, companion.id));
            }
            if (rumors > 0) actions.push({ id: 'inn-rumor', label: `Escuchar lo que se cuenta (${rumors})`, detail: 'Gratis: basta con estar.', enabled: !fighting, cost: 0 });
            if (innkeeper) actions.push({ id: 'inn-talk', label: `Hablar con ${innkeeper}`, detail: 'Deja la frase empezada en el chat.', enabled: !fighting, cost: 0, target: innkeeper });
        }
        if (service === 'herreria') {
            for (const remedy of remedies) {
                actions.push(action(`smith:${remedy.id}:${remedy.name}`, `${remedy.label} para ${remedy.name}`,
                    `${remedy.cost} de oro.`, remedy.cost, remedy.id));
            }
        }
        if (service === 'templo' && cure.gold > 0) {
            actions.push(action('temple-cure', 'Que os curen',
                `Cierra todas las heridas que se curan con tiempo (${cure.days} día(s) de reposo). ${cure.gold} de oro.`, cure.gold));
        }
        // Idea 135: lo que no se sabe qué es, y lo que muerde.
        if (service === 'templo' && relics.unknown > 0) {
            const cost = relics.unknown * relics.identify;
            actions.push(action('temple-identify', `Que miren lo que traéis (${relics.unknown})`,
                `Se sabe qué es cada cosa, maldición incluida. ${cost} de oro.`, cost));
        }
        if (service === 'templo' && relics.cursed > 0) {
            const cost = relics.cursed * relics.lift;
            actions.push(action('temple-lift', `Quitar la maldición (${relics.cursed})`,
                `Se va lo que resta, y ya se puede soltar. ${cost} de oro.`, cost));
        }
        if (service === 'tablon') {
            actions.push({ id: 'board', label: 'Mirar el tablón', detail: 'Los encargos de aquí.', enabled: !fighting, cost: 0 });
        }
        const info = SERVICE_INFO[/** @type {keyof typeof SERVICE_INFO} */ (service)];
        return { id: service, label: info.label, icon: info.icon, actions };
    }).filter(card => card.actions.length > 0);
}
