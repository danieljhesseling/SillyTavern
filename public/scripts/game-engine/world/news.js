/**
 * Las noticias que esperan a que llegues (idea 82).
 *
 * Las facciones se mueven cada dia, en todo el mapa. Lo que pasa cerca se oye al momento
 * (`newsFor` en `factions.js`); lo que pasa lejos antes se perdia. Ahora se guarda, y se
 * cuenta al llegar a un sitio desde donde se oye: «En la posada comentan que Vane tomo el
 * molino.» Asi los relojes de las facciones se notan aunque el grupo no estuviera alli.
 *
 * Puro: la lista de pendientes y lo que toca contar.
 */

/** Lo que tiene mas de esto ya no es noticia. */
export const NEWS_MAX_AGE = 30;

/** Las que se cuentan de una vez al llegar. */
export const NEWS_TOLD = 3;

/**
 * @typedef {Object} PendingNews
 * @property {number} day
 * @property {string} faction
 * @property {string} target
 * @property {string} kind
 * @property {string} note
 */

/**
 * @param {any} raw
 * @returns {PendingNews[]}
 */
export function readPendingNews(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(n => n && String(n.note ?? '').trim())
        .map(n => ({
            day: Math.max(1, Math.floor(Number(n.day) || 1)),
            faction: String(n.faction ?? ''),
            target: String(n.target ?? ''),
            kind: String(n.kind ?? ''),
            note: String(n.note).trim(),
        }));
}

/**
 * Guardar lo que no se ha oido todavia.
 *
 * @param {any} raw
 * @param {any[]} events Los sucesos de las facciones de hoy.
 * @param {string[]} heard Las notas que ya se contaron.
 * @param {number} today
 * @returns {PendingNews[]}
 */
export function queueNews(raw, events, heard, today) {
    const told = new Set(heard.map(String));
    const list = readPendingNews(raw).filter(n => today - n.day <= NEWS_MAX_AGE);
    for (const event of Array.isArray(events) ? events : []) {
        const note = String(event?.note ?? '').trim();
        if (!note || event?.kind === 'quieto' || told.has(note) || list.some(n => n.note === note)) continue;
        list.push({ day: today, faction: String(event.faction ?? ''), target: String(event.target ?? ''), kind: String(event.kind ?? ''), note });
    }
    return list;
}

/**
 * Lo que se oye al llegar, y lo que sigue esperando.
 *
 * @param {any} raw
 * @param {(events: any[]) => string[]} hearable Lo que se oye desde aqui (`newsFor` ya
 *   atado al sitio y al mapa).
 * @param {number} today
 * @returns {{told: string[], pending: PendingNews[]}}
 */
export function deliverNews(raw, hearable, today) {
    const list = readPendingNews(raw).filter(n => today - n.day <= NEWS_MAX_AGE);
    const heard = new Set(hearable(list));
    const told = list.filter(n => heard.has(n.note)).slice(0, NEWS_TOLD);
    const toldNotes = new Set(told.map(n => n.note));
    return {
        told: told.map(n => (today - n.day > 0 ? `Hace ${today - n.day} día(s): ${n.note}` : n.note)),
        pending: list.filter(n => !toldNotes.has(n.note)),
    };
}

/**
 * «Llegasteis tarde», por grados (idea 117): lo que avanza la meta de una facción se nota
 * antes de que se cumpla. A la mitad y a tres cuartos, una noticia; no solo al final.
 *
 * @param {Array<{id: string, name: string, goal?: {at?: number, of?: number, kind?: string, target?: string}}>} before
 * @param {Array<{id: string, name: string, goal?: {at?: number, of?: number, kind?: string, target?: string}}>} after
 * @returns {Array<{faction: string, target: string, kind: string, note: string}>}
 */
export function clockWarnings(before, after) {
    /** @type {Array<{faction: string, target: string, kind: string, note: string}>} */
    const out = [];
    for (const now of after || []) {
        const was = (before || []).find(f => f.id === now.id);
        const of = Number(now.goal?.of) || 0;
        if (!was || of <= 0) continue;
        const from = (Number(was.goal?.at) || 0) / of;
        const to = (Number(now.goal?.at) || 0) / of;
        const target = String(now.goal?.target ?? '');
        if (from < 0.75 && to >= 0.75 && to < 1) {
            out.push({ faction: now.id, target, kind: 'avanza', note: `${now.name} está a punto de salirse con la suya${target ? ` en ${target}` : ''}: queda poco para pararles.` });
        } else if (from < 0.5 && to >= 0.5 && to < 0.75) {
            out.push({ faction: now.id, target, kind: 'avanza', note: `${now.name} va por la mitad de lo que quiere${target ? ` en ${target}` : ''}. Todavía se les puede parar.` });
        }
    }
    return out;
}
