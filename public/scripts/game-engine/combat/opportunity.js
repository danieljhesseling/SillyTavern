/**
 * Ataques de oportunidad: por qué la posición importa.
 *
 * Sin ellos, alejarse de un enemigo es gratis, y si alejarse es gratis media mecánica del
 * tablero sobra — la cobertura, los cuellos de botella, el guardián que se interpone. El
 * combate táctico se convierte en dos filas de gente pegándose sin motivo para estar donde
 * están.
 *
 * La regla de 5e, tal cual: **si sales del alcance de alguien que te tiene a tiro de cuerpo
 * a cuerpo, se lleva un ataque gratis**. Uno por ronda cada uno, porque gasta su reacción.
 * Y no cuenta si te vas *dentro* de su alcance, ni si no llegaba a tocarte para empezar.
 *
 * Puro: dice **quién** ataca y **por qué**. Quien resuelve el golpe es el mismo código que
 * resuelve cualquier otro, porque un ataque de oportunidad no es un ataque distinto.
 *
 * Ver wiki/archivo/PROPUESTAS_MEJORA_V2.md, PROP2-053.
 */

/** Cuerpo a cuerpo, en pies. Un alcance mayor no amenaza casillas adyacentes por arte de magia. */
const MELEE_FEET = 5;

/**
 * La distancia del tablero, en pies: diagonal y recto cuestan lo mismo.
 *
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @returns {number}
 */
function feetBetween(ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) * 5;
}

/**
 * @param {any} creature
 * @returns {{x: number, y: number}}
 */
function cellOf(creature) {
    const position = creature?.mapPosition ?? creature;
    return {
        x: Math.floor(Number(position?.gridX ?? position?.x) || 0),
        y: Math.floor(Number(position?.gridY ?? position?.y) || 0),
    };
}

/**
 * Quién se lleva un ataque gratis porque alguien se le escapa.
 *
 * @param {Object} input
 * @param {any} input.mover Quien se mueve.
 * @param {{x: number, y: number}} input.from
 * @param {{x: number, y: number}} input.to
 * @param {Array<any>} input.threats Los que podrían atacar: enemigos si se mueve un aliado, y al revés.
 * @param {(threat: any) => number} [input.reachOf] El alcance de cada uno, por si no es cuerpo a cuerpo.
 * @param {(threat: any) => boolean} [input.canReact] Si le queda reacción.
 * @param {(threat: any) => boolean} [input.isAlive]
 * @returns {Array<{threat: any, name: string, fromFeet: number, toFeet: number, reason: string}>}
 */
export function findOpportunityAttacks({
    mover, from, to, threats,
    reachOf = () => MELEE_FEET,
    canReact = () => true,
    isAlive = () => true,
}) {
    const moverName = String(mover?.name ?? 'Alguien');
    const start = { x: Math.floor(Number(from?.x) || 0), y: Math.floor(Number(from?.y) || 0) };
    const end = { x: Math.floor(Number(to?.x) || 0), y: Math.floor(Number(to?.y) || 0) };

    // Quedarse donde estabas no es escaparse de nadie.
    if (start.x === end.x && start.y === end.y) return [];

    const results = [];
    for (const threat of (Array.isArray(threats) ? threats : [])) {
        if (!threat || !isAlive(threat) || !canReact(threat)) continue;

        const reach = Math.max(0, Number(reachOf(threat)) || 0);
        // Solo el cuerpo a cuerpo amenaza: un arquero no ataca a quien pasa por delante.
        if (reach > MELEE_FEET) continue;

        const at = cellOf(threat);
        const fromFeet = feetBetween(start.x, start.y, at.x, at.y);
        const toFeet = feetBetween(end.x, end.y, at.x, at.y);

        // Te tenía a tiro y has salido: eso es lo que se castiga. Moverte de una casilla a
        // otra sin salir de su alcance, no.
        if (fromFeet > reach || toFeet <= reach) continue;

        results.push({
            threat,
            name: String(threat?.name ?? 'Alguien'),
            fromFeet,
            toFeet,
            reason: `${moverName} sale del alcance de ${threat?.name ?? 'alguien'} (${fromFeet} ft → ${toFeet} ft).`,
        });
    }

    return results;
}

/**
 * Lo que se anuncia antes de resolverlos.
 *
 * @param {Array<{name: string}>} attacks
 * @param {any} mover
 * @returns {string}
 */
export function describeOpportunity(attacks, mover) {
    if (attacks.length === 0) return '';
    const names = attacks.map(a => a.name).join(', ');
    return `⚔️ ${mover?.name ?? 'Alguien'} se aleja y deja el flanco: ataque de oportunidad de ${names}.`;
}
