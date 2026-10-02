/**
 * H10 de las vueltas: pasar de un chat a otro (del gremio a una campaña del tablón, o de vuelta
 * al gremio) deja un momento la partida sin chat abierto, y el Modo Juego enseñaba la portada
 * («DnD Coin», «Jugar sin conexión», «Partida nueva»…) un par de segundos en medio.
 *
 * Quien cambia de chat lo dice aquí al empezar y al acabar; mientras dura, la pantalla se queda
 * como estaba en vez de saltar al menú del principio. Al acabar, avisa a quien se apuntó para
 * redibujar con el chat nuevo ya abierto.
 */

let switching = 0;

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Empieza un cambio de chat. Cada `beginChatSwitch` lleva su `endChatSwitch`.
 */
export function beginChatSwitch() {
    switching += 1;
}

/**
 * Acaba un cambio de chat. Con el último, avisa a quien se apuntó.
 */
export function endChatSwitch() {
    if (switching === 0) return;
    switching -= 1;
    if (switching > 0) return;
    for (const listener of listeners) {
        try {
            listener();
        } catch (error) {
            console.error('[chat-switch]', error);
        }
    }
}

/**
 * Si se está pasando de un chat a otro ahora mismo.
 *
 * @returns {boolean}
 */
export function isChatSwitching() {
    return switching > 0;
}

/**
 * Apunta qué hacer al acabar un cambio de chat.
 *
 * @param {() => void} listener
 * @returns {() => void} Para borrarse.
 */
export function onChatSwitchEnd(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
