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
 * Los días fuera (de camino o acampando) no se pagan comida ni posada: por el camino se come
 * de las raciones o de lo que se caza (E6.1) y se duerme al raso. Antes se cobraban igual, y
 * una semana de viaje pagaba la cena dos veces (la ración y el oro) y dejaba el bolsillo en 0.
 *
 * @param {any[]} party
 * @param {any} [rules]
 * @param {number} [away] Días de la semana fuera, de camino o acampando.
 * @returns {Array<{name: string, food: number, lodging: number, tax: number, wage: number, total: number, paid: boolean}>}
 */
export function upkeepPerHead(party, rules = null, away = 0) {
    const prices = readUpkeepRules(rules);
    const people = Array.isArray(party) ? party : [];
    const home = prices.weekLength - awayDays(away, prices.weekLength);

    return people.map((member) => {
        const paid = motiveOf(member) === 'coin';
        const food = prices.foodPerDay * home;
        const lodging = Math.round(prices.lodgingPerWeek * home / prices.weekLength);
        // E4.1: lo que se le subió el sueldo cuando pidió más paga.
        const wage = paid ? prices.wagePerWeek + Math.max(0, Math.floor(Number(member?.wageRaise) || 0)) : 0;

        return {
            name: String(member?.name ?? 'Alguien'),
            food,
            lodging,
            tax: prices.taxPerWeek,
            wage,
            total: food + lodging + prices.taxPerWeek + wage,
            paid,
        };
    });
}

/**
 * Los días fuera que cuentan esta semana: enteros, y nunca más que la semana.
 *
 * @param {any} away
 * @param {number} weekLength
 * @returns {number}
 */
function awayDays(away, weekLength) {
    return Math.min(weekLength, Math.max(0, Math.floor(number(away))));
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
 * @property {Array<{name: string, wage: number}>} payroll Quién cobra sueldo, y cuánto.
 * @property {number} away      Días de la semana fuera (sin comida ni posada que pagar).
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
 * @param {number} [options.away] Días de la semana fuera, de camino o acampando.
 * @returns {UpkeepBill}
 */
export function weeklyBill(party, options = {}) {
    const prices = readUpkeepRules(options.rules);
    const away = awayDays(options.away, prices.weekLength);
    const heads = upkeepPerHead(party, options.rules, away);
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
        payroll: heads.filter(head => head.paid).map(head => ({ name: head.name, wage: head.wage })),
        away,
    };
}

/**
 * Qué pasa cuando no llega.
 *
 * No se cobra por la fuerza ni se mata de hambre a nadie de golpe: lo que pasa es que
 * quien vino por dinero **empieza a irse**, y quien no ha comido pega peor. Las dos cosas
 * se notan en la partida siguiente, que es donde tienen que notarse.
 *
 * Se paga en orden y solo lo que llega: la comida, la posada y las tasas, y después los
 * sueldos enteros, uno a uno. A quien no le llega el suyo no cobra nada, y ese oro se queda en
 * el bolsillo. Antes se vaciaba el bolsillo entero y además los mercenarios contaban como sin
 * cobrar: se perdía el oro y la lealtad a la vez.
 *
 * @param {any[]} party
 * @param {UpkeepBill} bill
 * @returns {{paid: boolean, unpaid: string[], hungry: string[], lines: string[], taken: number}}
 *   `taken`: lo que hay que quitar del bolsillo.
 */
export function settleWeek(party, bill) {
    const people = Array.isArray(party) ? party : [];
    if (bill.covered) {
        return { paid: true, unpaid: [], hungry: [], lines: [`Pagado: ${bill.total} de oro.`], taken: bill.total };
    }

    // Se paga lo que se puede, y primero la comida: nadie discute la cena.
    let left = Math.max(0, number(bill.purse));
    const food = Math.min(left, bill.food);
    left -= food;
    const hungry = food < bill.food ? people.map(m => String(m?.name ?? 'Alguien')) : [];
    const keep = Math.min(left, bill.lodging + bill.tax);
    left -= keep;

    // Los sueldos, enteros: medio sueldo no es cobrar.
    const payroll = Array.isArray(bill.payroll)
        ? bill.payroll
        : people.filter(member => motiveOf(member) === 'coin').map(member => ({ name: String(member?.name ?? 'Alguien'), wage: Infinity }));
    /** @type {string[]} */
    const unpaid = [];
    let wages = 0;
    for (const head of payroll) {
        const wage = Math.max(0, number(head.wage, Infinity));
        if (wage <= left) {
            left -= wage;
            wages += wage;
        } else {
            unpaid.push(String(head.name));
        }
    }

    const lines = [`Faltan ${bill.missing} de oro.`];
    if (hungry.length > 0) lines.push('No ha comido nadie: todos empiezan la semana cansados.');
    if (unpaid.length > 0) lines.push(`Sin cobrar: ${unpaid.join(', ')}. La lealtad baja.`);

    return { paid: false, unpaid, hungry, lines, taken: food + keep + wages };
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
