/**
 * El reloj del Modo Juego: que dia es, que parte del dia, y que se puede hacer con ella.
 *
 * Los cuatro botones existian desde la Fase D, pero vivian en la pestana de Campana del
 * cajon del grupo — es decir, fuera del juego. Descansar obligaba a salir de la partida,
 * abrir un cajon y volver, que es justo lo que el Modo Juego existe para evitar.
 *
 * Decide y no dibuja: aqui solo se calcula que se puede pulsar y por que no. Quien lo
 * pinta es game-shell.js, y quien hace el trabajo sigue siendo party.js.
 *
 * Ver wiki/archivo/ROADMAP_JUEGO_SIN_COMANDOS.md, K3.
 */

import { getHitDice } from '../../rules/rest.js';

/**
 * @typedef {Object} ClockAction
 * @property {'slot'|'day'|'short'|'long'} id
 * @property {string} label
 * @property {string} icon
 * @property {boolean} enabled
 * @property {string} why Por que se puede, o por que no. Va al `title` del boton.
 */

/**
 * @typedef {Object} ClockView
 * @property {number} day
 * @property {string} slot
 * @property {string} label Lo que se lee en la cabecera.
 * @property {ClockAction[]} actions
 */

/** @type {Array<{id: ClockAction['id'], label: string, icon: string, why: string}>} */
const ACTIONS = [
    { id: 'slot', label: 'Pasar el rato', icon: 'fa-forward', why: 'Avanza al siguiente bloque del día' },
    { id: 'day', label: 'Dormir', icon: 'fa-bed', why: 'Salta al día siguiente' },
    { id: 'short', label: 'Descanso corto', icon: 'fa-campground', why: 'Gasta dados de golpe para curarse, y un bloque del día' },
    { id: 'long', label: 'Descanso largo', icon: 'fa-moon', why: 'Cura del todo, devuelve la mitad de los dados de golpe y amanece' },
];

/**
 * Cuantos dados de golpe le quedan al grupo entero.
 *
 * @param {Array<any>} party
 * @param {Record<string, string>} hitDieByClass
 * @returns {number}
 */
export function availableHitDice(party, hitDieByClass = {}) {
    return (Array.isArray(party) ? party : [])
        .filter(Boolean)
        .reduce((total, member) => total + getHitDice(member, hitDieByClass).available, 0);
}

/**
 * Que muestra el reloj y que deja hacer.
 *
 * Un boton que no se puede pulsar se queda a la vista, apagado y con el motivo escrito:
 * esconderlo haria creer que descansar no existe en mitad de un combate, cuando lo que
 * pasa es que ahora no toca.
 *
 * @param {Object} input
 * @param {number} [input.day]
 * @param {string} [input.slotLabel]
 * @param {boolean} [input.fighting]
 * @param {Array<any>} [input.party]
 * @param {Record<string, string>} [input.hitDieByClass]
 * @param {string} [input.season] Idea 74: la estación, dicha.
 * @returns {ClockView}
 */
export function buildClockView({ day = 1, slotLabel = '', fighting = false, party = [], hitDieByClass = {}, season = '' } = {}) {
    const dice = availableHitDice(party, hitDieByClass);

    const actions = ACTIONS.map(action => {
        if (fighting) {
            return { ...action, enabled: false, why: 'No mientras peleas.' };
        }
        if (action.id === 'short' && dice === 0) {
            return { ...action, enabled: false, why: 'Nadie tiene dados de golpe. Hace falta un descanso largo.' };
        }
        return { ...action, enabled: true };
    });

    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const slot = String(slotLabel || '').trim();

    return {
        day: safeDay,
        slot,
        label: [`Día ${safeDay}`, slot, String(season || '').trim()].filter(Boolean).join(' · '),
        actions,
    };
}

/**
 * Una linea de texto con lo mismo, para el registro y para las pruebas.
 *
 * @param {ClockView} view
 * @returns {string}
 */
export function describeClock(view) {
    const open = view.actions.filter(a => a.enabled).map(a => a.label);
    return open.length === 0
        ? `${view.label}. No se puede pasar el tiempo ahora.`
        : `${view.label}. Puedes: ${open.join(', ')}.`;
}
