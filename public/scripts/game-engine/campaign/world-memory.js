/**
 * Que el mundo se acuerde de lo que hacéis.
 *
 * Sin esto, el bucle del tablón es un vestíbulo con mazmorras: aceptas un encargo, limpias
 * la sala, cobras… y al volver al pueblo el posadero no sabe nada, las facciones a las que
 * has fastidiado no te buscan y lo que piensan de ti no cambia lo que te dicen. La
 * reputación ya tocaba los precios del mercado y los pasos cerrados; lo que faltaba era
 * **eco**: que se note al hablar y al viajar.
 *
 * Tres piezas, las tres baratas:
 *
 * 1. **Lo que habéis hecho**: una lista corta de hechos que el motor ha visto (encargos
 *    entregados, favores cumplidos, quién se quedó en casa), con su día.
 * 2. **Un bloque para el narrador** con lo último hecho, lo que piensa de vosotros cada
 *    facción que no os es indiferente, y lo que debéis. Pocas líneas, y solo si hay algo:
 *    un bloque vacío no se manda.
 * 3. **Quien os tiene ganas sale al camino**: viajar por lo de una facción que os odia
 *    tiene peaje. No es un combate —el viaje no los tiene—: cuesta oro, o un día de rodeo.
 *
 * Puro: no guarda ni manda nada.
 */

import { readFactions, describeStanding, speaksPlural } from './factions.js';
import { describeDebt } from './patronage.js';

/** Cuántos hechos se recuerdan. Más, y el bloque del narrador deja de ser barato. */
export const MAX_DEEDS = 8;

/** Cuántos van al narrador. */
export const DEEDS_TOLD = 3;

/** A partir de aquí, os cortan el paso. */
export const HOSTILE_AT = -2;

/**
 * @typedef {{day: number, text: string}} Deed
 */

/**
 * @param {any} raw
 * @returns {Deed[]}
 */
export function readDeeds(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(d => d && String(d.text ?? '').trim())
        .map(d => ({ day: Math.max(1, Math.floor(Number(d.day) || 1)), text: String(d.text).trim() }))
        .slice(-MAX_DEEDS);
}

/**
 * Apuntar un hecho. Los más viejos se olvidan.
 *
 * @param {any} deeds
 * @param {number} day
 * @param {string} text
 * @returns {Deed[]}
 */
export function recordDeed(deeds, day, text) {
    const clean = String(text ?? '').trim();
    const list = readDeeds(deeds);
    if (!clean) return list;
    return [...list, { day: Math.max(1, Math.floor(Number(day) || 1)), text: clean }].slice(-MAX_DEEDS);
}

/**
 * El bloque para el narrador.
 *
 * Escrito para que el modelo lo use sin tener que interpretar escalas: «os tienen ganas»,
 * no «-4». Y con una orden al final, porque un dato que el modelo no sabe para qué es
 * acaba ignorado o, peor, exagerado.
 *
 * @param {Object} input
 * @param {any} [input.deeds]
 * @param {any[]} [input.factions]
 * @param {any} [input.debt]
 * @param {string} [input.focus] Lo que el grupo tiene entre manos (el hito abierto del hilo).
 * @param {string[]} [input.memories] Lo que el grupo recuerda haber vivido junto, ya escrito.
 * @param {{place: string, lines: string[]}|null} [input.here] Lo que se recuerda del grupo en
 *   este sitio: con eso la gente de aqui saluda sabiendo quienes sois (idea 86).
 * @param {boolean} [input.compact] Modo ahorro (idea 148): lo justo, menos lineas.
 * @param {number} input.today
 * @returns {string} Vacío si no hay nada que contar.
 */
export function worldMemoryBlock({ deeds = [], factions = [], debt = null, focus = '', today, memories = [], here = null, compact = false }) {
    /** @type {string[]} */
    const lines = [];

    // Primero lo que tienen entre manos: es hacia donde el narrador tiene que empujar.
    if (String(focus).trim()) lines.push(`- Lo que tienen entre manos: ${String(focus).trim()}`);

    const recent = readDeeds(deeds).slice(compact ? -1 : -DEEDS_TOLD);
    for (const deed of recent) {
        const ago = Math.max(0, Math.floor(Number(today) || 0) - deed.day);
        lines.push(`- ${ago === 0 ? 'Hoy' : `Hace ${ago} día(s)`}: ${deed.text}`);
    }

    for (const faction of readFactions(factions)) {
        // En modo ahorro solo cuenta quien os tiene de verdad en cuenta, para bien o para mal.
        if (faction.reputation === 0 || (compact && Math.abs(faction.reputation) < 2)) continue;
        lines.push(`- ${faction.name}: ${describeStanding(faction.reputation)}.`);
    }

    const owed = describeDebt(debt, today);
    if (owed) lines.push(`- ${owed}`);

    // Lo que aqui se sabe de vosotros: la gente de este sitio saluda con eso.
    const local = (here?.lines ?? []).filter(l => String(l).trim()).slice(0, compact ? 1 : 3);
    if (here?.place && local.length > 0) lines.push(`- En ${here.place} se acuerdan: ${local.join(' ')}`);

    // Lo que vivieron juntos: los compañeros lo sacan, y el narrador puede citarlo.
    for (const memory of memories.filter(m => String(m).trim()).slice(compact ? -1 : 0)) lines.push(`- Recuerdan: ${String(memory).trim()}`);

    if (lines.length === 0) return '';
    return [
        '[LO QUE EL MUNDO SABE DEL GRUPO]',
        ...lines,
        'La gente de por aquí se ha enterado: que se note en cómo os hablan, sin inventar hechos nuevos.',
    ].join('\n');
}

/**
 * Si alguien os corta el paso en el camino, y qué cuesta.
 *
 * Una facción que os tiene ganas y manda en algún sitio por el que pasáis os para. Quiere
 * oro; si no hay, dais un rodeo y se pierde un día. Una sola vez por viaje: la peor.
 *
 * @param {Object} input
 * @param {any[]} input.factions
 * @param {string[]} input.places Por donde se pasa, llegada incluida.
 * @param {number} input.purse
 * @returns {{faction: string, name: string, note: string, toll: number, days: number}|null}
 */
export function roadTrouble({ factions, places, purse }) {
    const route = new Set((places || []).map(p => String(p).toLowerCase()));
    const worst = readFactions(factions)
        .filter(f => f.reputation <= HOSTILE_AT)
        .filter(f => [f.seat, ...f.holds].some(p => route.has(String(p).toLowerCase())))
        .sort((a, b) => a.reputation - b.reputation || a.id.localeCompare(b.id))[0];
    if (!worst) return null;

    // Cuanto más os odian, más caro: diez de oro por escalón por debajo de cero.
    const toll = Math.abs(worst.reputation) * 10;
    const pays = Number(purse) >= toll;
    return {
        faction: worst.id,
        // «Los de Los Cuervos» no lo dice nadie: un nombre en plural va solo.
        name: `${speaksPlural(worst.name) ? worst.name : `Los de ${worst.name}`} os cortan el paso`,
        note: pays
            ? `Se acuerdan de vosotros. Pagáis ${toll} de oro por pasar.`
            : `Se acuerdan de vosotros, y no lleváis los ${toll} de oro que piden: rodeo por el monte, un día más.`,
        toll: pays ? toll : 0,
        days: pays ? 0 : 1,
    };
}
