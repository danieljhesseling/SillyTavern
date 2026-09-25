/**
 * El banquillo del gremio: más compañeros que huecos, y rotar quién sale (idea 42).
 *
 * El grupo es de cinco como mucho. Hasta ahora, lleno el grupo, no se podía contratar a
 * nadie más, y quien entraba se quedaba para siempre. Ahora hay **casa**: quien no sale se
 * queda en el gremio, y se le llama cuando hace falta.
 *
 * - **Dejar en casa**: cualquiera menos tú. Se lleva lo suyo y deja el hueco.
 * - **Llamar**: si hay hueco. Tarda un día en llegar, salvo que estéis en casa.
 * - **Contratar con el grupo lleno**: el nuevo se va derecho a casa.
 *
 * En casa ni come del grupo ni gana experiencia: descansa, y vuelve entero.
 *
 * Puro: mueve fichas entre dos listas y dice qué ha pasado. Quien llama guarda.
 */

import { MAX_PARTY } from './recruit.js';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * @param {any} raw
 * @returns {any[]}
 */
export function readBench(raw) {
    return (Array.isArray(raw) ? raw : []).filter(m => m && typeof m === 'object' && text(m.name));
}

/**
 * Dejar a alguien en casa.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any} input.bench
 * @param {string} input.id
 * @returns {{ok: boolean, party: any[], bench: any[], line: string}}
 */
export function benchMember({ party, bench, id }) {
    const list = Array.isArray(party) ? party : [];
    const home = readBench(bench);
    const index = list.findIndex(m => String(m?.id) === String(id));
    if (index < 0) return { ok: false, party: list, bench: home, line: 'No está en el grupo.' };
    if (index === 0) return { ok: false, party: list, bench: home, line: 'Tú no te quedas en casa: la historia es tuya.' };
    const member = list[index];
    if (member?.dead) return { ok: false, party: list, bench: home, line: `${text(member.name)} ya no vuelve a casa.` };
    return {
        ok: true,
        party: list.filter((_, i) => i !== index),
        bench: [...home, member],
        line: `${text(member.name)} se queda en casa, en el gremio. Se le puede llamar cuando haga falta.`,
    };
}

/**
 * Llamar a alguien de casa.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any} input.bench
 * @param {string} input.id
 * @param {boolean} [input.atHome] Si el grupo está donde está la casa: llega al momento.
 * @returns {{ok: boolean, party: any[], bench: any[], days: number, line: string}}
 */
export function callFromBench({ party, bench, id, atHome = false }) {
    const list = Array.isArray(party) ? party : [];
    const home = readBench(bench);
    const member = home.find(m => String(m?.id) === String(id));
    if (!member) return { ok: false, party: list, bench: home, days: 0, line: 'No está en casa.' };
    if (list.filter(m => !m?.dead).length >= MAX_PARTY) {
        return { ok: false, party: list, bench: home, days: 0, line: `El grupo ya es de ${MAX_PARTY}: deja antes a alguien en casa.` };
    }
    const days = atHome ? 0 : 1;
    return {
        ok: true,
        party: [...list, member],
        bench: home.filter(m => m !== member),
        days,
        line: days > 0 ? `Mandáis recado a casa: ${text(member.name)} llega al día siguiente.` : `${text(member.name)} sale de casa y se une al grupo.`,
    };
}

/**
 * Si un recién contratado cabe en el grupo o se va a casa.
 *
 * @param {any[]} party
 * @returns {'party'|'bench'}
 */
export function whereHired(party) {
    return (Array.isArray(party) ? party : []).filter(m => !m?.dead).length >= MAX_PARTY ? 'bench' : 'party';
}

/**
 * Quién está en casa, en una línea.
 *
 * @param {any} bench
 * @returns {string}
 */
export function describeBench(bench) {
    const names = readBench(bench).map(m => text(m.name));
    return names.length > 0 ? `En casa: ${names.join(', ')}.` : 'En casa no hay nadie.';
}
