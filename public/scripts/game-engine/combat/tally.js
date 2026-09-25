/**
 * La cuenta de un combate: quien hizo cuanto daño, a quien tumbo y cuanto se llevo.
 *
 * Existe para la pantalla de victoria. Un combate largo que termina con una linea de
 * sistema se olvida; uno que termina diciendo «Bruna tumbo a tres y aguanto 22 de daño»
 * se recuerda, y dice quien sostuvo al grupo.
 *
 * Puro: devuelve la cuenta nueva. Quien llama la guarda en el combate.
 */

/**
 * @typedef {Object} Tally
 * @property {Record<string, number>} dealt  Daño hecho, por id del grupo.
 * @property {Record<string, number>} kills  Enemigos tumbados, por id del grupo.
 * @property {Record<string, number>} taken  Daño recibido, por id del grupo.
 * @property {string[]} downed Quien cayo a 0 PG alguna vez.
 */

/**
 * @param {any} raw
 * @returns {Tally}
 */
export function readTally(raw) {
    /** @param {any} value */
    const numbers = (value) => {
        /** @type {Record<string, number>} */
        const out = {};
        if (value && typeof value === 'object') {
            for (const [key, n] of Object.entries(value)) {
                if (Number.isFinite(Number(n)) && Number(n) > 0) out[String(key)] = Number(n);
            }
        }
        return out;
    };
    return {
        dealt: numbers(raw?.dealt),
        kills: numbers(raw?.kills),
        taken: numbers(raw?.taken),
        downed: Array.isArray(raw?.downed) ? [...new Set(raw.downed.map(String))] : [],
    };
}

/**
 * Apuntar un golpe del grupo.
 *
 * @param {any} raw
 * @param {string|number} actorId
 * @param {number} amount
 * @param {boolean} [killed]
 * @returns {Tally}
 */
export function noteDealt(raw, actorId, amount, killed = false) {
    const tally = readTally(raw);
    const id = String(actorId);
    const n = Math.max(0, Math.round(Number(amount) || 0));
    if (n > 0) tally.dealt[id] = (tally.dealt[id] ?? 0) + n;
    if (killed) tally.kills[id] = (tally.kills[id] ?? 0) + 1;
    return tally;
}

/**
 * Apuntar un golpe recibido.
 *
 * @param {any} raw
 * @param {string|number} memberId
 * @param {number} amount
 * @param {boolean} [down] Si con este golpe cayo.
 * @returns {Tally}
 */
export function noteTaken(raw, memberId, amount, down = false) {
    const tally = readTally(raw);
    const id = String(memberId);
    const n = Math.max(0, Math.round(Number(amount) || 0));
    if (n > 0) tally.taken[id] = (tally.taken[id] ?? 0) + n;
    if (down && !tally.downed.includes(id)) tally.downed.push(id);
    return tally;
}

/**
 * @typedef {Object} VictoryReport
 * @property {string} title
 * @property {number} rounds
 * @property {Array<{id: string, name: string, dealt: number, kills: number, taken: number, downed: boolean, best: boolean}>} rows
 * @property {string} best  Una linea sobre quien sostuvo el combate, o vacia.
 * @property {string} loot  Lo que se llevaron, en una linea.
 * @property {string[]} scars Quien cayo, para que se note el precio.
 * @property {string[]} [upgrades] Lo del botin que mejora lo que alguien lleva (idea 63).
 */

/**
 * Lo que dice la pantalla de victoria.
 *
 * El mejor del combate es quien mas daño hizo, contando cada enemigo tumbado como 10 mas:
 * rematar importa. Sin nadie que hiciera nada, no hay mejor.
 *
 * @param {Object} input
 * @param {any} input.tally
 * @param {Array<{id: any, name: string}>} input.party
 * @param {number} input.rounds
 * @param {{gold: number, xp: number, items: Array<any>}|null} [input.loot]
 * @param {number} [input.defeated] Enemigos derrotados.
 * @returns {VictoryReport}
 */
export function buildVictoryReport({ tally, party, rounds, loot = null, defeated = 0 }) {
    const t = readTally(tally);
    const rows = (party || []).map(member => {
        const id = String(member.id);
        return {
            id,
            name: String(member.name),
            dealt: t.dealt[id] ?? 0,
            kills: t.kills[id] ?? 0,
            taken: t.taken[id] ?? 0,
            downed: t.downed.includes(id),
            best: false,
        };
    });

    const score = (/** @type {typeof rows[number]} */ row) => row.dealt + row.kills * 10;
    const top = rows.reduce((/** @type {typeof rows[number]|null} */ best, row) =>
        (score(row) > (best ? score(best) : 0) ? row : best), null);
    if (top) top.best = true;

    const itemNames = (loot?.items ?? []).map(item => String(item?.name ?? item)).filter(Boolean);
    const lootParts = [
        loot?.gold ? `${loot.gold} de oro` : '',
        loot?.xp ? `${loot.xp} PX` : '',
        ...itemNames,
    ].filter(Boolean);

    const n = Math.max(1, Number(rounds) || 1);
    return {
        title: defeated > 0 ? `Victoria en ${n} ${n === 1 ? 'ronda' : 'rondas'}` : 'Victoria',
        rounds: n,
        rows,
        best: top ? `${top.name} sostuvo el combate: ${top.dealt} de daño${top.kills ? `, ${top.kills} ${top.kills === 1 ? 'tumbado' : 'tumbados'}` : ''}.` : '',
        loot: lootParts.length > 0 ? lootParts.join(' · ') : 'Nada que llevarse.',
        scars: rows.filter(row => row.downed).map(row => `${row.name} cayó y se levantó`),
    };
}
