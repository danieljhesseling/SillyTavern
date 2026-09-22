/**
 * La cuenta: lo que cuesta tener a esta gente viva una semana más.
 *
 * Es la pieza que faltaba para que este juego tuviera un motivo. Hasta ahora el oro solo
 * entraba —cada combate ganado daba, nada se llevaba— así que el botín no era *para* nada
 * y aceptar un encargo no respondía a ninguna pregunta. Con esto, sí responde a una:
 * **el viernes hay que pagar.**
 *
 * La regla que lo convierte en juego y no en papeleo: **todo sale del mismo bolsillo.**
 * La cena, el sueldo de Brand, la posada, las tasas, reparar la cota y curarle la pierna a
 * Bruna compiten por las mismas monedas. En cuanto cada gasto tiene su propia moneda no
 * hay ninguna decisión que tomar, solo casillas que rellenar.
 *
 * Y se enseña **antes de vencer**, no al cobrar. Una factura que te sorprende es un
 * impuesto; una que ves venir es una decisión.
 *
 * No hace falta ningún gremio para esto: un aventurero solo también come.
 *
 * Puro: calcula y explica. No cobra, no narra, no quita oro a nadie.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 2.
 */

import { treatmentCost, readInjuries } from './injuries.js';
import { motiveOf } from './mortality.js';

/**
 * Los precios de partida, pensados para que una semana tranquila **casi** se pague sola.
 *
 * Si sobra dinero sin hacer nada, no hay presión; si falta siempre, el juego es una
 * cuesta. El punto está en que una semana sin trabajar se note y dos hagan daño.
 */
export const DEFAULT_UPKEEP = {
    /** Por cabeza y día. Come todo el mundo, cobre o no. */
    foodPerDay: 2,
    /** Por cabeza y semana, si se duerme bajo techo. */
    lodgingPerWeek: 7,
    /** Lo que pide el señor del sitio, por semana y por cabeza. */
    taxPerWeek: 3,
    /** Lo que cobra a la semana quien vino por dinero y no por ti. */
    wagePerWeek: 20,
    /** Lo que cobra por día curado quien sabe curar. */
    healingPerDay: 5,
    /** Cada cuántos días vence la cuenta. */
    weekLength: 7,
};

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {any} rules
 * @returns {typeof DEFAULT_UPKEEP}
 */
export function readUpkeepRules(rules) {
    const source = (rules && typeof rules === 'object') ? rules : {};
    /** @type {any} */
    const merged = {};
    for (const [key, fallback] of Object.entries(DEFAULT_UPKEEP)) {
        merged[key] = Math.max(0, number(source[key], fallback));
    }
    merged.weekLength = Math.max(1, merged.weekLength);
    return merged;
}

/**
 * Lo que cuesta cada uno, y por qué.
 *
 * El sueldo depende del motivo, no del puesto: a quien va contigo por un vínculo no se le
 * paga, y eso es exactamente lo que hace que tener amigos salga barato y tener una
 * compañía salga caro.
 *
 * @param {any[]} party
 * @param {any} [rules]
 * @returns {Array<{name: string, food: number, lodging: number, tax: number, wage: number, total: number, paid: boolean}>}
 */
export function upkeepPerHead(party, rules = null) {
    const prices = readUpkeepRules(rules);
    const people = Array.isArray(party) ? party : [];

    return people.map((member) => {
        const paid = motiveOf(member) === 'coin';
        const food = prices.foodPerDay * prices.weekLength;
        const wage = paid ? prices.wagePerWeek : 0;

        return {
            name: String(member?.name ?? 'Alguien'),
            food,
            lodging: prices.lodgingPerWeek,
            tax: prices.taxPerWeek,
            wage,
            total: food + prices.lodgingPerWeek + prices.taxPerWeek + wage,
            paid,
        };
    });
}

/**
 * @typedef {Object} UpkeepBill
 * @property {number} food
 * @property {number} lodging
 * @property {number} tax
 * @property {number} wages
 * @property {number} healing   Lo que costaría curar a todo el que esté herido.
 * @property {number} total     Sin contar las curas: eso lo eliges tú.
 * @property {number} withCare  Con ellas.
 * @property {number} purse     Lo que hay entre todos.
 * @property {boolean} covered  Si llega.
 * @property {number} missing   Cuánto falta.
 * @property {Array<{name: string, days: number, gold: number, permanent: number}>} wounded
 */

/**
 * La cuenta entera de una semana.
 *
 * Las curas van aparte del total a propósito: pagar la cena no es opcional y curar a
 * Bruna sí. Mezclarlas escondería la única decisión que hay aquí.
 *
 * @param {any[]} party
 * @param {Object} [options]
 * @param {any} [options.rules]
 * @param {number} [options.purse] Lo que hay. Si no se dice, se suma el oro del grupo.
 * @returns {UpkeepBill}
 */
export function weeklyBill(party, options = {}) {
    const prices = readUpkeepRules(options.rules);
    const heads = upkeepPerHead(party, options.rules);
    const people = Array.isArray(party) ? party : [];

    const food = heads.reduce((sum, head) => sum + head.food, 0);
    const lodging = heads.reduce((sum, head) => sum + head.lodging, 0);
    const tax = heads.reduce((sum, head) => sum + head.tax, 0);
    const wages = heads.reduce((sum, head) => sum + head.wage, 0);

    // Quien solo arrastra heridas permanentes cuesta 0 y tarda 0 dias, y por filtrar por
    // eso desaparecia del panel — justo a quien mas hay que nombrar. Aparece cualquiera
    // que lleve algo encima, y el precio 0 es la forma de decir que no hay cirujano.
    const wounded = people
        .map((member) => {
            const cost = treatmentCost(member, prices.healingPerDay);
            return {
                name: String(member?.name ?? 'Alguien'),
                days: cost.days,
                gold: cost.gold,
                permanent: cost.permanent.length,
            };
        })
        .filter(entry => entry.gold > 0 || entry.days > 0 || entry.permanent > 0);

    const healing = wounded.reduce((sum, entry) => sum + entry.gold, 0);
    const total = food + lodging + tax + wages;

    const purse = options.purse !== undefined
        ? Math.max(0, number(options.purse))
        : people.reduce((sum, member) => sum + Math.max(0, number(member?.gold)), 0);

    return {
        food,
        lodging,
        tax,
        wages,
        healing,
        total,
        withCare: total + healing,
        purse,
        covered: purse >= total,
        missing: Math.max(0, total - purse),
        wounded,
    };
}

/**
 * Qué pasa cuando no llega.
 *
 * No se cobra por la fuerza ni se mata de hambre a nadie de golpe: lo que pasa es que
 * quien vino por dinero **empieza a irse**, y quien no ha comido pega peor. Las dos cosas
 * se notan en la partida siguiente, que es donde tienen que notarse.
 *
 * @param {any[]} party
 * @param {UpkeepBill} bill
 * @returns {{paid: boolean, unpaid: string[], hungry: string[], lines: string[]}}
 */
export function settleWeek(party, bill) {
    const people = Array.isArray(party) ? party : [];
    if (bill.covered) {
        return { paid: true, unpaid: [], hungry: [], lines: [`Pagado: ${bill.total} de oro.`] };
    }

    // Se paga lo que se puede, y primero la comida: nadie discute la cena.
    const afterFood = bill.purse - bill.food;
    const hungry = afterFood < 0 ? people.map(m => String(m?.name ?? 'Alguien')) : [];
    const unpaid = people
        .filter(member => motiveOf(member) === 'coin')
        .map(member => String(member?.name ?? 'Alguien'));

    const lines = [`Faltan ${bill.missing} de oro.`];
    if (hungry.length > 0) lines.push('No ha comido nadie: todos empiezan la semana cansados.');
    if (unpaid.length > 0) lines.push(`Sin cobrar: ${unpaid.join(', ')}. La lealtad baja.`);

    return { paid: false, unpaid, hungry, lines };
}

/**
 * La cuenta, dicha como se enseña: antes de vencer.
 *
 * @param {UpkeepBill} bill
 * @param {number} [daysLeft]
 * @returns {string[]}
 */
export function describeBill(bill, daysLeft = 0) {
    const when = daysLeft > 0 ? `en ${daysLeft} día(s)` : 'hoy';
    const lines = [
        `Vence ${when}: debes ${bill.total}, tienes ${bill.purse}.`,
        `Comida ${bill.food} · posada ${bill.lodging} · tasas ${bill.tax} · sueldos ${bill.wages}.`,
    ];

    if (!bill.covered) lines.push(`Faltan ${bill.missing}.`);
    for (const wound of bill.wounded) {
        lines.push(wound.gold > 0
            ? `${wound.name}: curarse cuesta ${wound.gold} y ${wound.days} día(s).`
            : `${wound.name}: lo suyo no se cura con dinero.`);
    }

    return lines;
}

/**
 * Quién arrastra heridas, para el panel.
 *
 * @param {any[]} party
 * @returns {Array<{name: string, injuries: string[]}>}
 */
export function woundedOf(party) {
    return (Array.isArray(party) ? party : [])
        .map(member => ({
            name: String(member?.name ?? 'Alguien'),
            injuries: readInjuries(member).map(injury => injury.label),
        }))
        .filter(entry => entry.injuries.length > 0);
}
