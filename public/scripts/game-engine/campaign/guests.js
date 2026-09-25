/**
 * Quien va con el grupo solo un encargo: el que se escolta y el mercenario (ideas 105 y 131).
 *
 * - **Escoltas** (105): un encargo de escoltar ya no es una frase. Quien lo pide va en el
 *   tablero, con el grupo, y hay que llevarlo vivo hasta la salida (la casilla marcada). Si
 *   cae, el encargo se pierde.
 * - **Mercenarios** (131): en la posada se puede pagar a alguien para un solo encargo. Pega
 *   como uno más y, entregado el encargo (o perdido), cobra y se va. Oro contra riesgo.
 *
 * Los dos son **invitados**: van en el grupo con `guest`, no cuentan para el límite de cinco
 * ni tienen vínculo, y se van solos al acabar el encargo.
 *
 * Puro: hace sus fichas y dice quién se va. Quien llama los mete y los saca.
 */

/** Lo que cobra un mercenario por encargo, por su nivel. */
export const MERCENARY_FEE = 40;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Los mercenarios que se ofrecen, con su oficio. */
const HIRELINGS = [
    { name: 'Gerd el Mellado', className: 'guerrero', strength: 15, dexterity: 12 },
    { name: 'Nella Tresflechas', className: 'explorador', strength: 11, dexterity: 16 },
    { name: 'Osric Mediapaga', className: 'guerrero', strength: 16, dexterity: 10 },
];

/**
 * La ficha de un invitado, con lo justo para pelear.
 *
 * @param {Object} input
 * @param {number} input.id
 * @param {string} input.name
 * @param {'ward'|'mercenary'} input.kind
 * @param {string} input.contractId
 * @param {number} input.level
 * @param {any} [input.base] Lo que se toma de base (el héroe), para que encaje.
 * @param {Partial<{className: string, strength: number, dexterity: number}>} [input.stats]
 * @returns {any}
 */
export function guestMember({ id, name, kind, contractId, level, base = {}, stats = {} }) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const ward = kind === 'ward';
    const hp = ward ? 8 + lvl * 2 : 10 + lvl * 6;
    return {
        ...JSON.parse(JSON.stringify(base ?? {})),
        id,
        name: text(name),
        wiUid: null,
        personaId: null,
        dead: false,
        level: lvl,
        hp,
        maxHp: hp,
        class: ward ? 'viajero' : text(stats.className) || 'guerrero',
        strength: Number(stats.strength) || 10,
        dexterity: Number(stats.dexterity) || 10,
        items: [],
        equippedItems: {},
        perks: [],
        injuries: [],
        activeConditions: [],
        needs: {},
        reasons: { wants: ward ? 'quiet' : 'coin', hates: '', profile: ward ? 'coward' : 'aggressive' },
        motive: 'coin',
        guest: { kind, contractId: text(contractId) },
    };
}

/**
 * Los mercenarios que hay hoy en la posada, con su precio.
 *
 * @param {() => number} random
 * @param {number} level
 * @returns {Array<{name: string, className: string, strength: number, dexterity: number, fee: number}>}
 */
export function hirelingsHere(random, level) {
    const pick = HIRELINGS[Math.floor(random() * HIRELINGS.length) % HIRELINGS.length];
    return [{ ...pick, fee: MERCENARY_FEE * Math.max(1, Math.floor(Number(level) || 1)) }];
}

/**
 * Quién se va al acabar un encargo: los invitados de ese encargo.
 *
 * @param {any[]} party
 * @param {string} contractId
 * @returns {{leaving: any[], party: any[]}}
 */
export function guestsLeave(party, contractId) {
    const list = Array.isArray(party) ? party : [];
    const leaving = list.filter(m => m?.guest && text(m.guest.contractId) === text(contractId));
    return { leaving, party: list.filter(m => !leaving.includes(m)) };
}

/**
 * Si el que se escoltaba ha caído: el encargo se pierde.
 *
 * @param {any[]} party
 * @param {string} contractId
 * @returns {any|null}
 */
export function wardLost(party, contractId) {
    return (Array.isArray(party) ? party : [])
        .find(m => m?.guest?.kind === 'ward' && text(m.guest.contractId) === text(contractId) && (m.dead || (Number(m.hp) || 0) <= 0)) ?? null;
}

/**
 * La salida del tablero para una escolta: el suelo libre más lejos de donde se empieza.
 *
 * @param {string[]} rows
 * @param {{x: number, y: number}} from
 * @returns {{x: number, y: number}|null}
 */
export function exitCell(rows, from) {
    let best = null;
    let far = -1;
    (Array.isArray(rows) ? rows : []).forEach((row, y) => [...String(row)].forEach((char, x) => {
        if (char !== '.') return;
        const d = Math.abs(x - (Number(from?.x) || 0)) + Math.abs(y - (Number(from?.y) || 0));
        if (d > far) {
            far = d;
            best = { x, y };
        }
    }));
    return best;
}
