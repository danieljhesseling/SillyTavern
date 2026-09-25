/**
 * Lo que cuesta vivir donde vives, que depende de quien mande.
 *
 * Es la tercera pata de las facciones, y la que las hace **imposibles de ignorar**. Un
 * reloj que avanza en el panel se puede mirar de lejos; un paso cerrado que sube el pan un
 * treinta por ciento no, porque el viernes hay que pagar igual.
 *
 * Todo sale de cosas que ya estaban escritas y que ya se movian solas:
 *
 * - **Un camino cerrado** es comida que no llega. Lo cierran las facciones al tomar un
 *   sitio, y el viaje ya lo obedece; aqui ademas se nota en la cuenta.
 * - **Un peaje** lo pone quien controla un camino, y lo paga todo el que pasa — incluido
 *   el carro que te trae la harina.
 * - **Quien manda aqui** cobra. `taxPerWeek` se llamaba desde el principio «lo que pide el
 *   señor del sitio»: hasta ahora no habia ningun señor, solo un numero. Ahora lo hay, y
 *   si esta pagando una guerra, se nota.
 *
 * Y se explica siempre. Una cuenta que sube sin decir por que es un impuesto; una que dice
 * «han cerrado el paso del norte» es una razon para ir a abrirlo. Esa frase es la mitad del
 * valor de todo esto.
 *
 * Puro: recibe el mundo y devuelve numeros y frases. No cobra, no guarda y no viaja.
 *
 * Ver wiki/ROADMAP_COMPENDIO.md, B10 (F3).
 */

import { speaksPlural, priceFactor, describeStanding } from './factions.js';

/** Lo que encarece cada cosa. Poco cada una: lo que pesa es que se juntan. */
const CLOSED_ROAD = 0.15;
const TOLL = 0.1;

/** Lo mas que puede subir el pan, por muy mal que se ponga. */
const CEILING = 2.5;

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {any[]} locations
 * @param {string} here
 * @returns {any}
 */
function placeNamed(locations, here) {
    return (Array.isArray(locations) ? locations : [])
        .find((/** @type {any} */ l) => text(l?.name).toLowerCase() === text(here).toLowerCase())
        ?? null;
}

/**
 * Como esta el mercado donde estas, y por que.
 *
 * Devuelve multiplicadores, no precios: quien llama ya sabe lo que cuesta cada cosa, y asi
 * esto no tiene que saber nada de comida ni de posadas.
 *
 * Sin facciones y sin caminos cerrados devuelve 1 y ninguna razon, y la cuenta sale
 * exactamente como salia. Aditivo, como todo lo demas.
 *
 * @param {Object} input
 * @param {string} input.here
 * @param {any[]} [input.locations]
 * @param {any[]} [input.factions]
 * @returns {{food: number, tax: number, reasons: string[], holder: string, cut: boolean}}
 */
export function marketPressure({ here, locations = [], factions = [] }) {
    const place = placeNamed(locations, here);
    /** @type {string[]} */
    const reasons = [];

    const routes = Array.isArray(place?.routes) ? place.routes : [];
    // Y los caminos que llegan aqui desde fuera, que cuentan igual: el mundo es una lista
    // y un camino vale para los dos sentidos salvo que diga lo contrario.
    const incoming = (Array.isArray(locations) ? locations : [])
        .filter((/** @type {any} */ l) => l !== place)
        .flatMap((/** @type {any} */ l) => (Array.isArray(l?.routes) ? l.routes : [])
            .filter((/** @type {any} */ r) => text(r?.to).toLowerCase() === text(here).toLowerCase()
                && !r?.oneWay));

    const all = [...routes, ...incoming];
    const closed = all.filter((/** @type {any} */ r) => Boolean(r?.closed));
    const tolls = all.filter((/** @type {any} */ r) => !r?.closed && /peaje/i.test(text(r?.note)));

    let food = 1;

    if (closed.length > 0) {
        food += CLOSED_ROAD * closed.length;
        const donde = closed.map((/** @type {any} */ r) => text(r.to)).filter(Boolean);
        reasons.push(closed.length === 1
            ? `El camino a ${donde[0]} está cerrado, y por ahí venía comida.`
            : `Hay ${closed.length} caminos cerrados, y por ahí venía la comida.`);
    }

    if (tolls.length > 0) {
        food += TOLL * tolls.length;
        reasons.push(tolls.length === 1
            ? 'Hay un peaje en el camino, y lo paga también quien trae la harina.'
            : `Hay ${tolls.length} peajes alrededor, y los paga quien trae la harina.`);
    }

    // Quedarse sin ningun camino abierto no es caro: es otra cosa.
    const cut = all.length > 0 && closed.length === all.length;
    if (cut) {
        food = Math.max(food, 2);
        reasons.push('No queda camino abierto: aquí ya no entra nada.');
    }

    // Quien manda aqui cobra. Y si anda metido en algo, cobra mas.
    const owner = (Array.isArray(factions) ? factions : []).find((/** @type {any} */ f) =>
        text(f?.seat).toLowerCase() === text(here).toLowerCase()
        || (Array.isArray(f?.holds) ? f.holds : [])
            .some((/** @type {any} */ h) => text(h).toLowerCase() === text(here).toLowerCase()));

    let tax = 1;
    if (owner) {
        const busy = Boolean(text(owner.goal?.kind)) && !owner.goal?.done
            && number(owner.goal?.at, 0) < number(owner.goal?.of, 1);
        // Y lo que piensan de ti. Quien te debe una no te cobra el maximo; quien te tiene
        // ganas se cobra la ojeriza en el mismo sitio donde se cobra todo: el viernes.
        const standing = number(owner.reputation, 0);
        tax = (busy ? 2 : 1.5) * priceFactor(standing);
        if (standing !== 0) {
            reasons.push(`Y ${describeStanding(standing)}.`);
        }
        // «Los de Ribera del Yunque manda aquí» lo escribe una maquina, no una persona.
        const many = speaksPlural(owner.name);
        reasons.push(busy
            ? `${text(owner.name)} ${many ? 'mandan' : 'manda'} aquí, y ${many ? 'están' : 'está'} `
                + 'pagando lo suyo con tus impuestos.'
            : `${text(owner.name)} ${many ? 'mandan' : 'manda'} aquí, y `
                + `${many ? 'cobran' : 'cobra'} por ello.`);
    }

    return {
        food: Math.min(CEILING, Math.round(food * 100) / 100),
        tax: Math.round(tax * 100) / 100,
        reasons,
        holder: text(owner?.id),
        cut,
    };
}

/** Las metas de facción que son guerra: con ellas en marcha, el acero se paga caro (idea 84). */
export const WAR_GOALS = ['conquistar', 'destruir'];

/** Lo que sube el acero con una guerra en marcha, y lo que sube si la guerra es de quien manda aquí. */
export const WAR_PRICE = { anywhere: 1.2, here: 1.35 };

/**
 * Lo que cuesta el acero con la guerra que haya (idea 84).
 *
 * Una facción que quiere conquistar o destruir algo, y va en camino, compra todas las
 * espadas del valle. Las armas y las armaduras suben en todas partes; más, donde manda ella.
 * Lo que se come ya lo mueven los caminos cerrados (`marketPressure`).
 *
 * @param {Object} input
 * @param {string} input.here
 * @param {any[]} [input.factions]
 * @returns {{steel: number, reasons: string[]}}
 */
export function warPressure({ here, factions = [] }) {
    const where = text(here).toLowerCase();
    const atWar = (Array.isArray(factions) ? factions : []).filter((/** @type {any} */ f) =>
        WAR_GOALS.includes(text(f?.goal?.kind)) && !f?.goal?.done
        && number(f?.goal?.at, 0) < number(f?.goal?.of, 1));
    if (atWar.length === 0) return { steel: 1, reasons: [] };
    const holds = (/** @type {any} */ f) => text(f?.seat).toLowerCase() === where
        || (Array.isArray(f?.holds) ? f.holds : []).some((/** @type {any} */ h) => text(h).toLowerCase() === where);
    const local = atWar.find(holds);
    const who = local ?? atWar[0];
    const many = speaksPlural(who.name);
    return {
        steel: local ? WAR_PRICE.here : WAR_PRICE.anywhere,
        reasons: [local
            ? `${text(who.name)} ${many ? 'están' : 'está'} en guerra y ${many ? 'mandan' : 'manda'} aquí: se ${many ? 'llevan' : 'lleva'} todo el acero.`
            : `${text(who.name)} ${many ? 'están' : 'está'} en guerra: las armas y las armaduras se pagan caras.`],
    };
}

/**
 * Los precios de la semana con el mercado encima.
 *
 * Se tocan tres: lo que se come, lo que cuesta dormir bajo techo y lo que pide el señor del
 * sitio. Los sueldos no —quien va contigo por dinero cobra lo pactado, no lo que valga el
 * pan— y curar tampoco, porque el cirujano cobra por su trabajo.
 *
 * @param {any} prices
 * @param {{food: number, tax: number}} pressure
 * @returns {any}
 */
export function applyMarket(prices, pressure) {
    /** @type {Record<string, number>} */
    const out = { ...(prices && typeof prices === 'object' ? prices : {}) };
    const food = Math.max(0, number(pressure?.food, 1));
    const tax = Math.max(0, number(pressure?.tax, 1));
    if (food === 1 && tax === 1) return out;

    // Redondeado hacia arriba: una cuenta con decimales no la entiende nadie, y quien
    // vende el pan tampoco los usa.
    out.foodPerDay = Math.ceil(number(out.foodPerDay, 0) * food);
    out.lodgingPerWeek = Math.ceil(number(out.lodgingPerWeek, 0) * food);
    out.taxPerWeek = Math.ceil(number(out.taxPerWeek, 0) * tax);

    return out;
}

/**
 * Por que cuesta lo que cuesta, en una linea.
 *
 * Una cuenta que sube sin decir por que es un impuesto; una que dice «han cerrado el paso
 * del norte» es una razon para ir a abrirlo.
 *
 * @param {{food: number, tax: number, reasons: string[]}} pressure
 * @returns {string}
 */
export function describeMarket(pressure) {
    const reasons = Array.isArray(pressure?.reasons) ? pressure.reasons : [];
    if (reasons.length === 0) return '';

    const food = number(pressure?.food, 1);
    const subida = food > 1 ? ` La comida cuesta un ${Math.round((food - 1) * 100)}% más.` : '';
    return `${reasons.join(' ')}${subida}`;
}
