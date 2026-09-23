/**
 * Cuando no llega para pagar la semana: alguien paga por ti, y te cobra en favores.
 *
 * Sin esto, la cuenta semanal tiene una espiral de muerte. Sales mal parado de un
 * combate, hay que descansar días, cada día cuesta comida y acerca el viernes, llega el
 * viernes sin oro, los que cobran se van, el grupo queda más flojo… y la partida se acaba
 * en bancarrota. Eso no da tensión, da ganas de recargar.
 *
 * Aquí la deuda **se convierte en trama**. La primera vez que no llega, una facción del
 * mundo —la que mejor os mira— paga lo que falta. A cambio pide un favor: un encargo en el
 * tablón contra sus enemigos, sin paga, con plazo. Cumplirlo salda la deuda y os deja a
 * bien con ellos; dejarlo pasar os pone en su lista.
 *
 * Solo una deuda a la vez: el rescate es para romper la espiral, no para quitarle el
 * sentido a la cuenta. Si ya debes y vuelve a no llegar, pasa lo de siempre.
 *
 * Sin facciones en el mundo, presta un prestamista: sin favor, con intereses.
 *
 * Puro: decide y cuenta. Quien llama cobra, paga y escribe.
 */

import { readFactions } from './factions.js';

/** Los días que hay para devolver el favor. */
export const DEBT_DAYS = 14;

/** Lo que cobra el prestamista encima de lo prestado. */
export const LENDER_INTEREST = 0.5;

/** Lo que baja lo que piensan de ti si no cumples. */
export const BROKEN_FAVOR_STANDING = -2;

/** Quien presta cuando no hay facciones. */
export const LENDER_NAME = 'Un prestamista del puerto';

/**
 * @typedef {Object} Debt
 * @property {string} patron      Id de la facción, o vacío si es el prestamista.
 * @property {string} patronName
 * @property {number} amount      Lo prestado.
 * @property {number} owed        Lo que hay que devolver si no se cumple el favor.
 * @property {number} day         Cuándo se pidió.
 * @property {number} dueDay
 * @property {string} contractId  El favor, si lo hay.
 */

/**
 * @param {any} raw
 * @returns {Debt|null}
 */
export function readDebt(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const amount = Math.max(0, Math.floor(Number(raw.amount) || 0));
    if (amount <= 0) return null;
    return {
        patron: String(raw.patron ?? ''),
        patronName: String(raw.patronName ?? LENDER_NAME),
        amount,
        owed: Math.max(amount, Math.floor(Number(raw.owed) || amount)),
        day: Math.max(1, Math.floor(Number(raw.day) || 1)),
        dueDay: Math.max(1, Math.floor(Number(raw.dueDay) || 1)),
        contractId: String(raw.contractId ?? ''),
    };
}

/**
 * Quién te saca del apuro.
 *
 * La facción que mejor os mira, siempre que no os tenga ganas; a igualdad, la que manda
 * donde estáis. Quien os odia no presta.
 *
 * @param {Object} input
 * @param {any[]} input.factions
 * @param {string} [input.here]
 * @returns {any|null}
 */
export function choosePatron({ factions, here = '' }) {
    const where = String(here).toLowerCase();
    const local = (/** @type {any} */ f) => Number(String(f.seat).toLowerCase() === where
        || f.holds.some((/** @type {string} */ h) => String(h).toLowerCase() === where));
    return readFactions(factions)
        .filter(f => f.reputation > -2)
        .sort((a, b) => b.reputation - a.reputation || local(b) - local(a) || a.id.localeCompare(b.id))[0] ?? null;
}

/**
 * La oferta: quién paga, cuánto, y qué pide a cambio.
 *
 * @param {Object} input
 * @param {number} input.shortfall Lo que falta para la cuenta.
 * @param {any[]} [input.factions]
 * @param {string} [input.here]
 * @param {number} input.today
 * @returns {{debt: Debt, contract: any|null, line: string}|null}
 */
export function offerPatronage({ shortfall, factions = [], here = '', today }) {
    const amount = Math.ceil(Number(shortfall) || 0);
    if (amount <= 0) return null;
    const day = Math.max(1, Math.floor(Number(today) || 1));
    const dueDay = day + DEBT_DAYS;

    const patron = choosePatron({ factions, here });
    if (!patron) {
        const owed = Math.ceil(amount * (1 + LENDER_INTEREST));
        return {
            debt: { patron: '', patronName: LENDER_NAME, amount, owed, day, dueDay, contractId: '' },
            contract: null,
            line: `${LENDER_NAME} pone los ${amount} de oro que faltan. Quiere ${owed} de vuelta antes del día ${dueDay}.`,
        };
    }

    // El favor va contra sus enemigos si los tiene: es lo que lo hace sucio. Sin enemigos,
    // un trabajo para ellos, sin paga.
    const all = readFactions(factions);
    const rival = all.find(f => patron.enemies.includes(f.id)) ?? null;
    const place = rival ? (rival.holds[0] || rival.seat) : (patron.goal.target || patron.seat);
    const contract = {
        id: `favor_${patron.id}_${day}`,
        rank: 'D',
        kind: rival ? 'steal' : 'recover',
        title: rival
            ? `El favor de ${patron.name}: sacar algo de ${place || 'lo de ' + rival.name} sin que ${rival.name} se entere`
            : `El favor de ${patron.name}: recuperar lo suyo en ${place || 'el yermo'}`,
        locationName: String(place || here || ''),
        reward: 0,
        days: dueDay,
        difficulty: 0.25,
        patron: patron.name,
        faction: rival ? rival.id : patron.id,
        against: Boolean(rival),
        segments: 1,
        favor: true,
    };

    return {
        debt: {
            patron: patron.id, patronName: patron.name, amount, owed: amount, day, dueDay, contractId: contract.id,
        },
        contract,
        line: `${patron.name} pone los ${amount} de oro que faltan. No quiere el oro de vuelta: quiere un favor, `
            + `antes del día ${dueDay}. Está en el tablón.`,
    };
}

/**
 * Si un encargo entregado salda la deuda.
 *
 * @param {Debt|null} debt
 * @param {any} contract
 * @returns {boolean}
 */
export function settlesDebt(debt, contract) {
    return Boolean(debt && debt.contractId && String(contract?.id) === debt.contractId);
}

/**
 * Lo que pasa cuando llega el día y la deuda sigue ahí.
 *
 * Con facción: se enfadan, y la deuda se convierte en oro que ahora sí quieren. Con el
 * prestamista: se lleva lo que haya, y lo que falte sigue debiéndose una semana más.
 *
 * @param {Object} input
 * @param {Debt|null} input.debt
 * @param {number} input.today
 * @param {number} input.purse
 * @returns {{due: boolean, take: number, standing: number, debt: Debt|null, line: string}}
 */
export function debtDue({ debt, today, purse }) {
    const none = { due: false, take: 0, standing: 0, debt, line: '' };
    if (!debt || Math.floor(Number(today) || 0) < debt.dueDay) return none;

    const has = Math.max(0, Math.floor(Number(purse) || 0));
    const hadFavor = Boolean(debt.contractId);
    const owed = hadFavor ? debt.amount * 2 : debt.owed;
    const take = Math.min(has, owed);
    const left = owed - take;
    const standing = hadFavor ? BROKEN_FAVOR_STANDING : 0;

    const next = left > 0
        ? { ...debt, owed: left, amount: left, dueDay: debt.dueDay + 7, contractId: '' }
        : null;

    const opening = hadFavor
        ? `El favor de ${debt.patronName} se quedó sin hacer. Ahora quieren oro, y el doble: ${owed}.`
        : `${debt.patronName} viene a cobrar: ${owed} de oro.`;
    const closing = left > 0
        ? ` Se llevan ${take}; faltan ${left}, para dentro de una semana.`
        : ` Se llevan ${take}. Cuenta saldada.`;

    return { due: true, take, standing, debt: next, line: opening + closing };
}

/**
 * La deuda, para el narrador y para el panel.
 *
 * @param {Debt|null} debt
 * @param {number} today
 * @returns {string}
 */
export function describeDebt(debt, today) {
    if (!debt) return '';
    const left = debt.dueDay - Math.floor(Number(today) || 0);
    const when = left > 0 ? `quedan ${left} día(s)` : 'vence hoy';
    return debt.contractId
        ? `Debéis un favor a ${debt.patronName} (pagaron ${debt.amount} de oro por vosotros); ${when}.`
        : `Debéis ${debt.owed} de oro a ${debt.patronName}; ${when}.`;
}
