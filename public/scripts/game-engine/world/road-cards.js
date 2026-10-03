/**
 * E6.1 de wiki/ROADMAP_ENTRETENIDO.md: el viaje con decisiones.
 *
 * Un viaje largo (a Barovia son nueve días) era casi un salto: corrían los días y, como mucho,
 * salía un contratiempo. Ahora, en un viaje de tres días o más, cada dos o tres días alguien del
 * grupo para la marcha y pregunta algo que hay que decidir:
 *
 * - **Un puente caído**: dar un rodeo (dos días más) o cruzar por las piedras con Atletismo, y
 *   si sale mal, se os moja la comida (se pierden raciones).
 * - **La ventisca** (en invierno; el resto del año, un temporal): acampar hasta que pase (un día
 *   más y una ración cada uno) o apretar el paso y llegar reventados (sin dormir).
 * - **Un mercader** con algo raro y un mapa de estos caminos: el mapa ahorra un día.
 *
 * Lo pregunta alguien que va con vosotros (D-J60: no hay narrador), con su cara; y lo que pasa
 * lo dice quien lo hizo. D&D: viajes y encuentros de camino (Guía del Dungeon Master).
 *
 * Puro: elige los días y las tarjetas, dice qué se pregunta y qué cuesta cada respuesta. Quien
 * llama pregunta, tira los dados, gasta las raciones y cobra.
 */

/** Desde cuántos días de camino hay tarjetas. Los viajes cortos siguen como estaban. */
export const MIN_TRIP_DAYS = 3;

/** La prueba de cruzar por las piedras. */
export const CROSS_DC = 12;

/** Lo que duele caerse al río cuando ya no queda comida que perder. */
export const CROSS_HURT = '1d6';

/** Lo que cuesta el rodeo del puente, en días. */
export const DETOUR_DAYS = 2;

/** Lo que vale el mapa del mercader, y lo que ahorra. */
export const MAP_PRICE = 15;
export const MAP_SAVES = 1;

/** Las horas de sueño que se deben al apretar el paso (las mismas que el paso rápido). */
export const PUSH_REST_HOURS = 24;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @typedef {Object} RoadCard
 * @property {string} id
 * @property {string} title Lo que sale arriba de la caja.
 * @property {'guia'|'portavoz'} asker Quién del grupo pregunta: el guía, o quien habla.
 */

/** Las tarjetas. @type {{puente: RoadCard, ventisca: RoadCard, mercader: RoadCard}} */
export const ROAD_CARDS = {
    puente: { id: 'puente', title: 'Un puente caído', asker: 'guia' },
    ventisca: { id: 'ventisca', title: 'La ventisca', asker: 'guia' },
    mercader: { id: 'mercader', title: 'Un mercader', asker: 'portavoz' },
};

/**
 * Los días del viaje en que alguien para la marcha: el primero, el segundo o el tercero de
 * camino; luego, cada dos o tres días. Nunca el día de llegar.
 *
 * @param {Object} input
 * @param {number} input.days Los días del viaje.
 * @param {() => number} input.random
 * @returns {number[]}
 */
export function cardDays({ days, random }) {
    const total = Math.max(0, Math.floor(Number(days) || 0));
    if (total < MIN_TRIP_DAYS) return [];
    /** @type {number[]} */
    const out = [];
    const step = () => 2 + (random() < 0.5 ? 0 : 1);
    for (let day = Math.min(step(), total - 1); day < total; day += step()) out.push(day);
    return out;
}

/**
 * Qué tarjeta toca cada día: sin repetir en el mismo viaje, y solo las que pegan. El mercader,
 * solo si llega el oro para algo (una tarjeta que no deja hacer nada es un estorbo).
 *
 * @param {Object} input
 * @param {number[]} input.days Los de `cardDays`.
 * @param {() => number} input.random
 * @param {number} [input.purse] El oro del grupo.
 * @param {number} [input.cheapest] Lo más barato que trae el mercader (el mapa, si no hay nada).
 * @param {number[]} [input.busy] Los días que ya traen su contratiempo: esos, sin tarjeta.
 * @returns {Array<{day: number, card: RoadCard}>}
 */
export function pickCards({ days, random, purse = 0, cheapest = MAP_PRICE, busy = [] }) {
    const taken = new Set((Array.isArray(busy) ? busy : []).map(Number));
    const pool = Object.values(ROAD_CARDS)
        .filter(card => card.id !== 'mercader' || Number(purse) >= Math.min(MAP_PRICE, Number(cheapest) || MAP_PRICE));
    /** @type {Array<{day: number, card: RoadCard}>} */
    const out = [];
    for (const day of Array.isArray(days) ? days : []) {
        if (taken.has(day) || pool.length === 0) continue;
        const at = Math.floor(random() * pool.length) % pool.length;
        out.push({ day, card: pool.splice(at, 1)[0] });
    }
    return out;
}

/**
 * Si es ventisca o temporal: en invierno, o con nieve ese día, ventisca.
 *
 * @param {{season?: string, weather?: string}} input
 * @returns {boolean}
 */
export function isBlizzard({ season = '', weather = '' } = {}) {
    return text(season).toLowerCase() === 'invierno' || /niev/i.test(text(weather));
}

/**
 * @typedef {Object} CardAsk
 * @property {string} title
 * @property {string[]} notes Lo que se ve fuera de la caja (el día, las raciones…).
 * @property {string} question Lo que dice quien pregunta.
 * @property {string} yes La primera respuesta (tecla 1).
 * @property {string} no La segunda (tecla 2).
 * @property {string} other La tercera, si la hay (tecla 3).
 * @property {{yes: string, no: string, other: string}} answers Qué es cada respuesta.
 */

/**
 * Lo que se pregunta en cada tarjeta y lo que se puede contestar.
 *
 * @param {RoadCard} card
 * @param {Object} context
 * @param {number} context.day El día del viaje.
 * @param {number} context.total Los días del viaje.
 * @param {string} [context.to] A dónde se va.
 * @param {number} [context.rations] Las raciones del grupo.
 * @param {number} [context.mouths] Cuántos comen.
 * @param {number} [context.purse]
 * @param {string} [context.season]
 * @param {string} [context.weather]
 * @param {{item: string, price: number}|null} [context.offer] Lo raro que trae el mercader.
 * @returns {CardAsk}
 */
export function askFor(card, { day, total, to = '', rations = 0, mouths = 1, purse = 0, season = '', weather = '', offer = null }) {
    const notes = [`Día ${day} de ${total}${text(to) ? `, camino de ${text(to)}` : ''}.`];
    const food = `Raciones: ${Math.max(0, Number(rations) || 0)} para ${Math.max(1, Number(mouths) || 1)}.`;
    if (card.id === 'puente') {
        return {
            title: card.title,
            notes: [...notes, food],
            question: 'El puente se ha venido abajo. Río arriba hay un vado, pero son dos días más. O cruzamos por las piedras: si alguien resbala, se nos moja la comida.',
            // Lo arriesgado, la 1; lo seguro, la 2 (Escape es la 2: cerrar no tira a nadie al río).
            yes: `Cruzar por las piedras (Atletismo, CD ${CROSS_DC})`,
            no: `Dar el rodeo (${DETOUR_DAYS} días más)`,
            other: '',
            answers: { yes: 'cruzar', no: 'rodeo', other: '' },
        };
    }
    if (card.id === 'ventisca') {
        const snow = isBlizzard({ season, weather });
        return {
            title: snow ? 'La ventisca' : 'Un temporal',
            notes: [...notes, food],
            question: snow
                ? 'Se nos echa encima una ventisca. O montamos el refugio y esperamos a que pase, o apretamos el paso y llegamos reventados.'
                : 'Viene un temporal de agua y viento. O montamos el refugio y esperamos a que pase, o apretamos el paso y llegamos reventados.',
            yes: 'Apretar el paso (llegáis sin haber dormido)',
            no: 'Acampar hasta que pase (1 día más y 1 ración cada uno)',
            other: '',
            answers: { yes: 'apretar', no: 'acampar', other: '' },
        };
    }
    // El mercader: el mapa, y lo raro si lo hay y llega el oro.
    const coins = Math.max(0, Number(purse) || 0);
    const rare = offer && text(offer.item) && coins >= Number(offer.price) ? offer : null;
    const canMap = coins >= MAP_PRICE;
    const wares = [rare ? `${text(rare.item)} por ${Number(rare.price)} de oro` : '', `un mapa de estos caminos con un atajo por ${MAP_PRICE}`]
        .filter(Boolean).join(', y ');
    return {
        title: card.title,
        notes: [...notes, `Oro: ${coins}.`],
        question: `Ese de la mula es un mercader. Dice que trae ${wares}. ¿Le compramos algo?`,
        yes: canMap ? `Comprar el mapa (${MAP_PRICE} de oro, un día menos)` : 'Seguir el camino',
        no: canMap ? 'Seguir el camino' : 'No, gracias',
        other: rare ? `Comprar ${text(rare.item)} (${Number(rare.price)} de oro)` : '',
        answers: { yes: canMap ? 'mapa' : 'pasar', no: 'pasar', other: rare ? 'raro' : '' },
    };
}

/**
 * @typedef {Object} CardResult
 * @property {number} days Días de más (o de menos, negativo).
 * @property {number} rationsLost Raciones que se pierden (sin comer).
 * @property {number} rationsEaten Raciones que se comen (una por cabeza).
 * @property {boolean} hungry Si no llegó la comida y se pasa hambre.
 * @property {boolean} tired Si se llega sin dormir.
 * @property {string} hurt Lo que duele, en dados, a quien lo intentó (vacío: nada).
 * @property {number} gold Lo que se paga.
 * @property {string} item Lo que se compra.
 * @property {string} said Lo que dice quien lo hizo, con sus palabras.
 * @property {string} note Para el diario y los avisos.
 */

/**
 * Lo que pasa con la respuesta.
 *
 * @param {RoadCard} card
 * @param {string} answer Una de `answers` de `askFor` (`rodeo`, `cruzar`, `acampar`, `apretar`, `mapa`, `raro`, `pasar`).
 * @param {Object} [context]
 * @param {boolean} [context.success] Si salió la tirada (al cruzar).
 * @param {string} [context.who] Quien lo intentó.
 * @param {number} [context.rations] Las raciones del grupo.
 * @param {number} [context.mouths] Cuántos comen.
 * @param {{item: string, price: number}|null} [context.offer]
 * @returns {CardResult}
 */
export function resolveCard(card, answer, { success = false, who = '', rations = 0, mouths = 1, offer = null } = {}) {
    /** @type {CardResult} */
    const out = { days: 0, rationsLost: 0, rationsEaten: 0, hungry: false, tired: false, hurt: '', gold: 0, item: '', said: '', note: '' };
    const name = text(who) || 'Alguien';
    const have = Math.max(0, Math.floor(Number(rations) || 0));
    const heads = Math.max(1, Math.floor(Number(mouths) || 1));
    if (card.id === 'puente') {
        if (answer === 'cruzar' && success) {
            return { ...out, said: 'Ya está: todos al otro lado y la comida seca.', note: `${name} encuentra por dónde cruzar el río: no se pierde nada.` };
        }
        if (answer === 'cruzar') {
            const lost = Math.min(have, heads);
            if (lost > 0) {
                return {
                    ...out, rationsLost: lost,
                    said: `¡Se me ha ido una bolsa al agua! Hemos perdido ${lost === 1 ? 'una ración' : `${lost} raciones`}.`,
                    note: `${name} resbala al cruzar el río y se pierden ${lost} ${lost === 1 ? 'ración' : 'raciones'}.`,
                };
            }
            return {
                ...out, hurt: CROSS_HURT,
                said: 'Me he dado contra las piedras. Duele, pero hemos pasado.',
                note: `${name} resbala al cruzar el río y se hace daño.`,
            };
        }
        return { ...out, days: DETOUR_DAYS, said: 'Río arriba, pues. Dos días más, pero llegamos secos.', note: `Rodeo por el vado: ${DETOUR_DAYS} días más.` };
    }
    if (card.id === 'ventisca') {
        if (answer === 'apretar') {
            return { ...out, tired: true, said: 'Seguimos. Mañana nos dolerá todo, pero no perdemos el día.', note: 'Apretáis el paso con el mal tiempo: se llega sin haber dormido.' };
        }
        const enough = have >= heads;
        return {
            ...out, days: 1, rationsEaten: Math.min(have, heads), hungry: !enough,
            said: enough
                ? 'Refugio montado. Un día perdido, pero comidos y enteros.'
                : 'No llega la comida para todos. Hoy alguno se acuesta con hambre.',
            note: enough
                ? `Acampáis hasta que pasa: un día más y ${heads} ${heads === 1 ? 'ración' : 'raciones'} menos.`
                : `Acampáis hasta que pasa: un día más, y no hay raciones para todos (${have} de ${heads}).`,
        };
    }
    if (answer === 'mapa') {
        return { ...out, days: -MAP_SAVES, gold: MAP_PRICE, said: 'Con este mapa nos ahorramos un día. Buena compra.', note: `Al mercader le comprasteis un mapa por ${MAP_PRICE} de oro: un día menos de camino.` };
    }
    if (answer === 'raro' && offer && text(offer.item)) {
        return {
            ...out, gold: Math.max(0, Number(offer.price) || 0), item: text(offer.item),
            said: `${text(offer.item)}. Esto no se ve todos los días.`,
            note: `Al mercader le comprasteis ${text(offer.item)} por ${Number(offer.price)} de oro.`,
        };
    }
    return { ...out, said: 'Otra vez será.', note: 'Un mercader os ofreció sus cosas, y seguisteis de largo.' };
}
