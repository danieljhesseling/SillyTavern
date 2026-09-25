/**
 * Lo que se lanza en combate: un frasco de aceite que arde y una red (idea 122).
 *
 * Hasta ahora, en combate se pegaba, se usaba una habilidad o se hacía una maniobra. Lo que
 * se compra no cambiaba nada del tablero. Estos dos sí:
 *
 * - **El aceite**: si le das, 2d4 de fuego. Y aunque falles, el frasco se rompe a sus pies y
 *   la casilla arde: el primero que la pise, 1d4. Sirve para cerrar un pasillo.
 * - **La red**: si le das, queda sujeto dos rondas. No se mueve, pegarle va con ventaja y él
 *   pega con desventaja (`attackEdge`, con `Restrained`).
 *
 * Gasta la acción y el objeto. Se lanza como un ataque a distancia improvisado: d20 más la
 * Destreza, contra la CA.
 *
 * Y lo que hay en el tablero (idea 8): una caja, un barril o una silla de al lado —la media
 * cobertura— se coge y se tira. Con la Fuerza, 1d6 más la Fuerza si le da, y la caja se
 * rompe al caer: quien se cubría detrás, ya no.
 *
 * Puro: dice qué se puede lanzar, a quién y qué deja en el tablero. Quien llama tira, pega y
 * guarda.
 */

/**
 * @typedef {Object} Throwable
 * @property {string} name     Como se llama en la mochila (y en la tienda).
 * @property {string} label    El botón.
 * @property {string} icon
 * @property {number} rangeFeet
 * @property {string} detail
 * @property {string} [damageDice]
 * @property {string} [condition]
 * @property {number} [rounds]
 */

/** @type {Record<string, Throwable>} */
export const THROWABLES = {
    aceite: {
        name: 'Frasco de aceite',
        label: 'Lanzar aceite',
        icon: 'fa-fire',
        rangeFeet: 20,
        detail: 'Si le das, 2d4 de fuego. Aunque falles, la casilla arde: el primero que la pise, 1d4.',
        damageDice: '2d4',
    },
    red: {
        name: 'Red',
        label: 'Lanzar la red',
        icon: 'fa-table-cells',
        rangeFeet: 15,
        detail: 'Si le das, queda sujeto dos rondas: no se mueve, y pegarle va con ventaja.',
        condition: 'Restrained',
        rounds: 2,
    },
};

/** Lo que se coge del tablero para tirarlo (idea 8). */
export const SCENERY = {
    label: 'Lanzar lo que hay a mano',
    icon: 'fa-box',
    rangeFeet: 20,
    damageDice: '1d6',
    detail: 'Una caja, un barril o una silla de al lado: con la Fuerza, 1d6 más la Fuerza si le da. Se rompe al caer.',
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Lo que hay a mano: las casillas de al lado con cajas o barriles (la media cobertura).
 *
 * @param {any} terrain
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Array<{x: number, y: number}>}
 */
export function sceneryNear(terrain, x, y, width, height) {
    /** @type {Array<{x: number, y: number}>} */
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const cx = Math.floor(Number(x) || 0) + dx;
            const cy = Math.floor(Number(y) || 0) + dy;
            if ((dx === 0 && dy === 0) || cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            if (terrain?.cells?.[`${cx},${cy}`]?.type === 'cover_half') out.push({ x: cx, y: cy });
        }
    }
    return out;
}

/**
 * El botón de lanzar lo que hay a mano, con la forma de las maniobras; o nada si no hay.
 *
 * @param {Object} input
 * @param {Array<{x: number, y: number}>} input.near
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @returns {{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}|null}
 */
export function judgeSceneryThrow({ near, hasAction, enemies }) {
    if (!Array.isArray(near) || near.length === 0) return null;
    const targets = (enemies || [])
        .filter(e => Number(e.distanceFeet) <= SCENERY.rangeFeet)
        .map(e => ({ id: String(e.id), name: String(e.name) }));
    const reason = !hasAction ? 'La acción de este turno ya está gastada.'
        : targets.length === 0 ? `No hay nadie a menos de ${SCENERY.rangeFeet} pies.`
            : '';
    return {
        id: 'lanzar:objeto',
        label: SCENERY.label,
        icon: SCENERY.icon,
        detail: reason || SCENERY.detail,
        enabled: !reason,
        needsTarget: true,
        targets,
    };
}

/**
 * Qué lleva alguien que se pueda lanzar, y cuántos.
 *
 * @param {any} member
 * @returns {Array<{kind: string, itemId: string, count: number}>}
 */
export function throwablesOf(member) {
    const items = Array.isArray(member?.items) ? member.items : [];
    return Object.entries(THROWABLES).flatMap(([kind, spec]) => {
        const mine = items.filter((/** @type {any} */ item) => text(item?.name).toLowerCase() === spec.name.toLowerCase());
        if (mine.length === 0) return [];
        const count = mine.reduce((/** @type {number} */ sum, /** @type {any} */ item) => sum + Math.max(1, Math.floor(Number(item?.uses ?? item?.quantity) || 1)), 0);
        return [{ kind, itemId: text(mine[0].id), count }];
    });
}

/**
 * Los botones de lanzar, ya juzgados, con la misma forma que las maniobras.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {boolean} input.hasAction
 * @param {Array<{id: string, name: string, distanceFeet: number}>} input.enemies
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean, needsTarget: boolean, targets: Array<{id: string, name: string}>}>}
 */
export function judgeThrows({ member, hasAction, enemies }) {
    return throwablesOf(member).map(({ kind, count }) => {
        const spec = THROWABLES[kind];
        const targets = (enemies || [])
            .filter(e => Number(e.distanceFeet) <= spec.rangeFeet)
            .map(e => ({ id: String(e.id), name: String(e.name) }));
        const reason = !hasAction ? 'La acción de este turno ya está gastada.'
            : targets.length === 0 ? `No hay nadie a menos de ${spec.rangeFeet} pies.`
                : '';
        return {
            id: `lanzar:${kind}`,
            label: `${spec.label} (${count})`,
            icon: spec.icon,
            detail: reason || spec.detail,
            enabled: !reason,
            needsTarget: true,
            targets,
        };
    });
}

/**
 * El charco que deja el aceite: una casilla que arde para el primero que la pise.
 *
 * Con la forma de `hazards.js`, que ya sabe dispararla, dibujarla y contarla.
 *
 * @param {{x: number, y: number, round: number}} at
 * @returns {any}
 */
export function burningPuddle({ x, y, round }) {
    return {
        id: `aceite-${x}-${y}-${Math.max(1, Math.floor(Number(round) || 1))}`,
        name: 'Aceite ardiendo',
        kind: 'fuego',
        trigger: 'enter',
        x,
        y,
        tell: 'Un charco de aceite en llamas.',
        effect: 'damage',
        damageDice: '1d4',
        cause: 'fuego',
        seen: true,
        armed: true,
        once: true,
    };
}
