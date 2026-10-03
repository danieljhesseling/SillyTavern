/**
 * E7.2 (wiki/ROADMAP_ENTRETENIDO.md): la pelea que se resuelve rápido se juega con el motor de
 * siempre, pero sin enseñarla: todos los del grupo en manos del juego (`actsOnItsOwn`), sin la
 * secuencia de golpes (`fxOn`) y sin las ventanas de los dados (`combat-log.js`). Lo leen esos
 * tres, y la pantalla de victoria para decir que se ha resuelto rápido.
 *
 * Aparte, y sin importar nada, para que lo puedan leer los módulos del combate sin dar vueltas.
 */

/** Si se está resolviendo una pelea rápido ahora mismo. */
let quiet = false;

/** @returns {boolean} Si la pelea de ahora se resuelve sin enseñarla. */
export function quietFight() {
    return quiet;
}

/** @param {boolean} on */
export function setQuietFight(on) {
    quiet = Boolean(on);
}
