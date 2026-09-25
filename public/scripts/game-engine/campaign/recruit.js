/**
 * Los confidentes: gente del mundo que puede unirse al grupo.
 *
 * El paquete de un mundo los trae con su clase, lo que les mueve y cinco escenas de
 * vinculo escritas, una por rango. Hasta ahora estaban en el mundo sin forma de llegar a
 * ellos, y sus escenas no se contaban nunca. Aqui se decide:
 *
 * - **Donde se les encuentra**: en cualquier posada. Es donde se busca compañia.
 * - **Como se unen**: primero se les conoce (el narrador cuenta la escena de su ficha), y
 *   luego se les pide que vengan. Quien va por el oro cobra la entrada; quien va por el
 *   vinculo viene gratis, pero hay que haber hablado antes.
 * - **Que escena toca** al subir cada rango de vinculo.
 *
 * Puro: lee las fichas del mundo y el grupo, y dice que se puede hacer.
 */

/** Lo que cobra quien viene por el oro, por adelantado. */
export const HIRE_COST = 25;

/** El grupo entero, con el heroe. Mas gente no cabe en un tablero sin volverse un lio. */
export const MAX_PARTY = 5;

/**
 * @typedef {Object} Recruit
 * @property {string} uid         La ficha del mundo.
 * @property {string} name
 * @property {string} className
 * @property {'coin'|'bond'} motive
 * @property {string} description La escena con la que se le conoce.
 * @property {boolean} met        Si ya se ha hablado con el o ella.
 * @property {number} cost
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Los confidentes que siguen fuera del grupo.
 *
 * @param {Object} input
 * @param {Record<string, any>|null|undefined} input.entries Las fichas del mundo, por uid.
 * @param {Array<{name: string, wiUid?: any}>} input.party
 * @param {any[]} [input.met] Los uid de los que ya se conoce.
 * @returns {Recruit[]}
 */
export function readRecruits({ entries, party, met = [] }) {
    const inParty = new Set((party || []).map(m => text(m.name).toLowerCase()));
    const inPartyUids = new Set((party || []).filter(m => m.wiUid != null).map(m => String(m.wiUid)));
    const known = new Set((Array.isArray(met) ? met : []).map(String));
    return Object.entries(entries ?? {})
        .filter(([, entry]) => entry?.dndData?.confidant && entry.dndData.entityType === 'npc')
        .map(([uid, entry]) => {
            const d = entry.dndData;
            /** @type {'coin'|'bond'} */
            const motive = d.motive === 'coin' ? 'coin' : 'bond';
            return {
                uid: String(entry.uid ?? uid),
                name: text(d.name) || text(entry.comment),
                className: text(d.charClass),
                motive,
                description: text(entry.content),
                met: known.has(String(entry.uid ?? uid)),
                cost: motive === 'coin' ? HIRE_COST : 0,
            };
        })
        .filter(r => r.name && !inParty.has(r.name.toLowerCase()) && !inPartyUids.has(r.uid));
}

/**
 * Lo que se puede hacer con cada uno en la posada, ya juzgado.
 *
 * @param {Recruit[]} recruits
 * @param {{fighting?: boolean, purse: number, partySize: number, bench?: boolean}} state `bench`:
 *   si hay casa (idea 42), con el grupo lleno se contrata igual y el nuevo se queda en ella.
 * @returns {Array<{id: string, label: string, detail: string, enabled: boolean, cost: number, target: string}>}
 */
export function recruitActions(recruits, { fighting = false, purse, partySize, bench = false }) {
    const full = Number(partySize) >= MAX_PARTY && !bench;
    const home = Number(partySize) >= MAX_PARTY && bench;
    return recruits.slice(0, 4).map(r => {
        const who = r.className ? `${r.name} (${r.className})` : r.name;
        if (!r.met) {
            return {
                id: `inn-meet:${r.uid}`, label: `Conocer a ${who}`,
                detail: fighting ? 'No mientras peleáis.' : 'Está por aquí. Gratis: el narrador os presenta.',
                enabled: !fighting, cost: 0, target: r.uid,
            };
        }
        const why = fighting ? 'No mientras peleáis.'
            : full ? `El grupo ya es de ${MAX_PARTY}: no cabe nadie más.`
                : Number(purse) < r.cost ? `No llega el oro: pide ${r.cost} por adelantado.` : '';
        return {
            id: `inn-hire:${r.uid}`,
            label: `${r.cost > 0 ? `Contratar a ${r.name} (${r.cost} de oro)` : `Pedir a ${r.name} que venga`}${home ? ' · a casa' : ''}`,
            detail: why || (home ? `El grupo ya es de ${MAX_PARTY}: se queda en casa, en el gremio, y se le llama cuando haga falta.`
                : r.motive === 'coin' ? 'Va por el oro: cobra por adelantado.' : 'Va por lo que haya entre vosotros: viene sin cobrar.'),
            enabled: !why, cost: r.cost, target: r.uid,
        };
    });
}

/**
 * La escena escrita para un rango de vinculo, si la hay.
 *
 * @param {any} member
 * @param {number} rank
 * @returns {{title: string, scene: string}|null}
 */
export function bondSceneFor(member, rank) {
    const scenes = Array.isArray(member?.bondScenes) ? member.bondScenes : [];
    const found = scenes.find((/** @type {any} */ s) => Number(s?.rank) === Number(rank) && text(s?.scene));
    return found ? { title: text(found.title), scene: text(found.scene) } : null;
}

/**
 * Lo que lee el narrador al conocer a alguien.
 *
 * @param {Recruit} recruit
 * @param {string} place
 * @returns {string}
 */
export function describeMeeting(recruit, place) {
    return `[CONOCÉIS A ${recruit.name.toUpperCase()}] En ${place || 'la posada'}. ${recruit.description} `
        + `Presenta a ${recruit.name} con esta escena, en su voz. `
        + (recruit.motive === 'coin'
            ? `Que deje claro que trabaja por dinero (${recruit.cost} de oro por adelantado).`
            : 'Que se note qué busca, sin pedir nada todavía.')
        + ' No decidas por el jugador.';
}

/**
 * Lo que lee el narrador cuando se une.
 *
 * @param {Recruit} recruit
 * @returns {string}
 */
export function describeJoin(recruit) {
    return `[SE UNE AL GRUPO] ${recruit.name}${recruit.className ? `, ${recruit.className.toLowerCase()}` : ''}, `
        + `viene con vosotros${recruit.cost > 0 ? ` (cobra ${recruit.cost} de oro)` : ''}. Cuéntalo en una o dos frases.`;
}

/**
 * Lo que dicen los confidentes que van con el grupo al llegar a un sitio (idea 45).
 *
 * El guion puede escribir, para cada confidente, una frase por sitio: lo que Bran dice al ver
 * el peaje donde perdió a su hijo. Se dice una vez por confidente y sitio, sin llamar al
 * modelo: la voz es del guionista.
 *
 * Las frases viajan con quien se une (`member.arrivals`); para quien se unió antes de que
 * existieran, se buscan en su ficha del mundo.
 *
 * @param {Object} input
 * @param {Array<{name: string, wiUid?: any, dead?: boolean, arrivals?: any[]}>} input.party
 * @param {Record<string, any>|null|undefined} input.entries Las fichas del mundo, por uid.
 * @param {string} input.place
 * @param {string[]} [input.heard] Las ya dichas, como `uid:sitio`.
 * @returns {Array<{key: string, name: string, line: string}>}
 */
export function arrivalLines({ party, entries, place, heard = [] }) {
    const here = text(place).toLowerCase();
    if (!here) return [];
    const said = new Set((Array.isArray(heard) ? heard : []).map(String));
    const byUid = new Map(Object.entries(entries ?? {}).map(([uid, entry]) => [String(entry?.uid ?? uid), entry]));
    return (party || [])
        .filter(member => member && !member.dead && (member.wiUid != null || Array.isArray(member.arrivals)))
        .flatMap(member => {
            const own = Array.isArray(member.arrivals) ? member.arrivals : [];
            const entry = member.wiUid != null ? byUid.get(String(member.wiUid)) : null;
            const arrivals = own.length > 0 ? own : (Array.isArray(entry?.dndData?.arrivals) ? entry.dndData.arrivals : []);
            const found = arrivals.find((/** @type {any} */ a) => text(a?.place).toLowerCase() === here && text(a?.line));
            const key = `${String(member.wiUid ?? member.name)}:${here}`;
            return found && !said.has(key) ? [{ key, name: text(member.name), line: text(found.line) }] : [];
        });
}
