/**
 * El grupo como grupo: moral, oficios de campamento y duelo (ideas 39, 41 y 43).
 *
 * - **Moral del grupo**: bien avenidos y bien comidos arrancan antes en combate; hambrientos
 *   y malheridos, tarde. ±1 a la iniciativa: poco, pero se nota y se entiende.
 * - **Oficios de campamento**: cada compañero hace algo fuera del combate según su oficio.
 * - **Duelo**: cuando muere alguien, quien busca calma o quien estaba muy unido al grupo
 *   pide un día, y mientras pesa en la moral.
 *
 * Puro: decide y describe.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * La moral del grupo, y lo que da.
 *
 * @param {{ranks: number[], hungry: number, wounded: number, size: number, mourning?: number, friction?: number}} input
 *   Los rangos de vínculo de los compañeros, y cuántos pasan hambre, están malheridos o de
 *   duelo (idea 43), y los roces de hoy entre ellos (idea 32).
 * @returns {{value: -1|0|1, label: string}}
 */
export function groupMorale({ ranks, hungry, wounded, size, mourning = 0, friction = 0 }) {
    const people = Math.max(1, Number(size) || 1);
    const bond = ranks.length > 0 ? ranks.reduce((sum, r) => sum + (Number(r) || 0), 0) / ranks.length : 0;
    const trouble = (Number(hungry) || 0) + (Number(wounded) || 0) + (Number(mourning) || 0) + (Number(friction) || 0);
    if (Number(mourning) > 0 && trouble >= 1 && bond < 3) return { value: -1, label: 'Baja: están de luto (−1 a la iniciativa)' };
    if (trouble >= Math.ceil(people / 2)) return { value: -1, label: 'Baja: hambre y heridas pesan (−1 a la iniciativa)' };
    if (bond >= 3 && trouble === 0) return { value: 1, label: 'Alta: se conocen y están enteros (+1 a la iniciativa)' };
    return { value: 0, label: 'Normal' };
}

/** Los oficios, con lo que hacen. */
export const CAMP_JOBS = {
    rastreador: { label: 'Rastreador', effect: 'Caza y forrajea él, con ventaja.' },
    sanador: { label: 'Sanador', effect: 'Tras un descanso corto, cura 1d6 más a cada uno.' },
    centinela: { label: 'Centinela', effect: 'Vigila: +1 a la iniciativa de todo el grupo.' },
    buscavidas: { label: 'Buscavidas', effect: 'Regatea: los mercaderes del camino le hacen un 25 % de descuento.' },
    erudito: { label: 'Erudito', effect: 'Ata cabos: las pistas del hilo llegan un día antes.' },
};

/**
 * El oficio de campamento de alguien, por su clase.
 *
 * @param {{class?: string}} member
 * @returns {{id: string, label: string, effect: string}|null}
 */
export function campJobOf(member) {
    const kind = text(member?.class);
    const id = /explor|montaraz|guardabosq|cazad|druid|ranger/.test(kind) ? 'rastreador'
        : /cleri|sacerd|paladin|monj|curand|medic/.test(kind) ? 'sanador'
            : /guerr|soldad|barbar|guard|fighter/.test(kind) ? 'centinela'
                : /picar|ladron|bardo|rogue|bard|contraband/.test(kind) ? 'buscavidas'
                    : /mago|maga|brujo|bruja|hechicer|erudit|alquim|wizard/.test(kind) ? 'erudito'
                        : '';
    return id ? { id, ...CAMP_JOBS[/** @type {keyof typeof CAMP_JOBS} */ (id)] } : null;
}

/**
 * Si alguien del grupo, en pie, tiene ese oficio.
 *
 * @param {any[]} party
 * @param {string} job
 * @returns {any|null} Quién, o nadie.
 */
export function withJob(party, job) {
    return (party || []).find(m => (Number(m?.hp) || 0) > 0 && campJobOf(m)?.id === job) ?? null;
}

/** Los días de duelo tras perder a alguien. */
export const MOURNING_DAYS = 1;

/**
 * Quién guarda duelo cuando muere alguien del grupo (idea 43): quien busca tranquilidad, y
 * quien tenía un vínculo fuerte (rango 3 o más). Pide un día; mientras, pesa en la moral.
 *
 * @param {Object} input
 * @param {Array<{id: any, name: string, hp?: number, wants?: string, bondWithDead?: number}>} input.party Los que siguen
 *   vivos, con su rango de vínculo en `bondWithDead`.
 * @param {string} input.dead
 * @param {number} input.today
 * @returns {Array<{id: string, mourning: {for: string, until: number}}>}
 */
export function whoMourns({ party, dead, today }) {
    return (party || [])
        .filter(m => (Number(m.hp) || 0) > 0 && (text(m.wants) === 'quiet' || (Number(m.bondWithDead) || 0) >= 3))
        .map(m => ({ id: String(m.id), mourning: { for: String(dead), until: Math.floor(Number(today) || 1) + MOURNING_DAYS } }));
}

/**
 * Por quién está de duelo alguien hoy, o vacío.
 *
 * @param {any} member
 * @param {number} today
 * @returns {string}
 */
export function mourningFor(member, today) {
    const m = member?.mourning;
    return m && Number(m.until) >= Math.floor(Number(today) || 1) ? String(m.for ?? '') : '';
}
