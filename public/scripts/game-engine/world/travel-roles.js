/**
 * Papeles de viaje: quién guía, quién vigila y quién caza (idea 65).
 *
 * En el camino solo jugaba el dado del mundo: pasaba lo que tocaba y el grupo miraba. Aquí
 * cada uno tiene un papel y tira por él, una vez por viaje:
 *
 * - **Guía** (Supervivencia): en un viaje de dos días o más, si sale, uno menos.
 * - **Vigía** (Percepción): si sale, se ve venir un contratiempo y se esquiva.
 * - **Cazador** (Supervivencia): si sale, nadie pasa hambre por el camino.
 *
 * Los papeles se reparten solos, al que mejor lo hace, sin repetir persona mientras haya
 * gente; con menos gente que papeles, alguno se queda sin hacer.
 *
 * Puro: reparte y juzga. Quien llama tira los dados (con la semilla del viaje) y aplica.
 */

/** Los papeles, con su habilidad, su dificultad y lo que da. */
export const ROLES = {
    guia: { label: 'Guía', skill: 'survival', dc: 12, gives: 'un día menos de camino' },
    vigia: { label: 'Vigía', skill: 'perception', dc: 12, gives: 'se esquiva un contratiempo' },
    cazador: { label: 'Cazador', skill: 'survival', dc: 12, gives: 'comida para todos' },
};

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Repartir los papeles: a cada uno, el que mejor lo hace de los que quedan libres.
 *
 * @param {Object} input
 * @param {Array<{id: any, name: string}>} input.party Los que viajan y pueden hacer algo.
 * @param {(member: any, skill: string) => number} input.modifierOf
 * @returns {Array<{role: string, id: string, name: string, modifier: number}>}
 */
export function assignRoles({ party, modifierOf }) {
    const free = [...(Array.isArray(party) ? party : [])];
    /** @type {Array<{role: string, id: string, name: string, modifier: number}>} */
    const out = [];
    for (const [role, spec] of Object.entries(ROLES)) {
        if (free.length === 0) break;
        const best = free
            .map(member => ({ member, modifier: Number(modifierOf(member, spec.skill)) || 0 }))
            .sort((a, b) => b.modifier - a.modifier || text(a.member.name).localeCompare(text(b.member.name)))[0];
        free.splice(free.indexOf(best.member), 1);
        out.push({ role, id: String(best.member.id), name: text(best.member.name), modifier: best.modifier });
    }
    return out;
}

/**
 * Tirar por cada papel y decir qué sale.
 *
 * @param {Object} input
 * @param {Array<{role: string, id: string, name: string, modifier: number}>} input.roles
 * @param {() => number} input.rollD20 Con el azar del viaje.
 * @param {number} input.days Lo que dura el viaje: el guía solo acorta los de dos días o más.
 * @returns {{results: Array<{role: string, name: string, natural: number, total: number, dc: number, success: boolean}>, dayLess: boolean, dodge: boolean, fed: boolean}}
 */
export function rollRoles({ roles, rollD20, days }) {
    const results = (roles || []).map(r => {
        const spec = ROLES[/** @type {keyof typeof ROLES} */ (r.role)];
        const natural = Math.max(1, Math.min(20, Math.floor(Number(rollD20()) || 1)));
        const total = natural + r.modifier;
        return { role: r.role, name: r.name, natural, total, dc: spec.dc, success: natural === 20 || (natural !== 1 && total >= spec.dc) };
    });
    const won = (/** @type {string} */ role) => results.some(r => r.role === role && r.success);
    return {
        results,
        dayLess: won('guia') && Number(days) >= 2,
        dodge: won('vigia'),
        fed: won('cazador'),
    };
}

/**
 * Lo que se cuenta del camino: quién hizo qué, y cómo le fue.
 *
 * @param {Array<{role: string, name: string, total: number, dc: number, success: boolean}>} results
 * @returns {string}
 */
export function describeRoles(results) {
    return (results || []).map(r => {
        const spec = ROLES[/** @type {keyof typeof ROLES} */ (r.role)];
        return `${spec.label}: ${r.name} (${r.total} contra ${r.dc} ${r.success ? '✓' : '✗'})${r.success ? ` — ${spec.gives}` : ''}`;
    }).join(' · ');
}
