/**
 * El gremio: la capa que convierte un grupo en una compañía.
 *
 * Va **encima** del desgaste, no en su lugar. Un aventurero solo ya come, ya paga posada y
 * ya puede quedarse cojo; el gremio no inventa nada de eso, cambia la **escala** — más
 * bocas, más sueldos— y añade dos cosas que solo tienen sentido con gente de sobra: un
 * tablón con rangos y unos edificios que abaratan lo que cuesta mantenerlos.
 *
 * Por eso es opcional y por eso llega la cuarta. Sin la cuenta semanal detrás, un gremio
 * es una pantalla de estadísticas con botones que no deciden nada.
 *
 * La lealtad es el corazón: quien viene **por dinero** se queda mientras cobra, y cada
 * semana sin paga es una grieta. Que se vaya no es un castigo por jugar mal — es la
 * consecuencia de una elección que hiciste con la cuenta delante.
 *
 * Puro: calcula y explica. No contrata a nadie, no cobra y no construye.
 *
 * Ver wiki/ROADMAP_MAESTRO.md, Nivel 4.
 */

/**
 * @typedef {Object} GuildState
 * @property {string} name
 * @property {string} theme      Una de `GUILD_THEMES`.
 * @property {number} renown     Lo que se ha ganado a pulso. Abre rangos del tablón.
 * @property {Record<string, number>} buildings Qué hay construido, y a qué nivel.
 * @property {Array<{name: string, role: string}>} staff Quien se ha quedado en casa, y haciendo qué.
 */

/**
 * Lo que se puede levantar, y qué hace cada cosa.
 *
 * Cada edificio toca **un número que ya existe**: la comida, el sueldo, los días de cura o
 * la calidad del tablón. Un edificio que solo dé puntos sería una barra de progreso con
 * ladrillos.
 */
export const BUILDINGS = {
    bunks: {
        label: 'Dormitorios',
        describe: 'Dormir en casa sale más barato que la posada.',
        cost: [120, 260, 500],
        effect: { lodgingPerWeek: -3 },
    },
    kitchen: {
        label: 'Cocina',
        describe: 'Comprar para muchos cunde más.',
        cost: [90, 200, 380],
        effect: { foodPerDay: -0.5 },
    },
    infirmary: {
        label: 'Enfermería',
        describe: 'Las heridas curan antes y cuestan menos.',
        cost: [150, 320, 600],
        effect: { healingPerDay: -1.5 },
    },
    forge: {
        label: 'Forja',
        describe: 'Reparar en casa. Y el equipo aguanta más.',
        cost: [180, 380, 700],
        effect: {},
    },
    library: {
        label: 'Biblioteca',
        describe: 'Se sabe antes dónde pagan mejor: el tablón trae más trabajo.',
        cost: [200, 420, 800],
        effect: {},
    },
};

/**
 * Los puestos de quien deja de salir.
 *
 * Es la otra salida de una herida que no cura: Bruna ya no corre, pero sabe dónde pagan
 * mejor. Cada puesto toca **un número que ya existe**, igual que un edificio de nivel
 * uno, y por eso se nota en la cuenta de la semana y no en una barra aparte.
 */
export const STAFF_ROLES = {
    consejero: {
        label: 'Consejero del gremio',
        describe: 'Sabe quién paga y quién no: el tablón trae un encargo más.',
        effect: {},
        board: 1,
    },
    intendente: {
        label: 'Intendente',
        describe: 'Lleva la despensa y regatea: la comida sale más barata.',
        effect: { foodPerDay: -0.5 },
        board: 0,
    },
    curandero: {
        label: 'Curandero de casa',
        describe: 'Cose y venda en casa: curar cuesta menos cada día.',
        effect: { healingPerDay: -1.5 },
        board: 0,
    },
    // Idea 37: el retirado entrena. Lo que sabe no se jubila con él.
    maestro: {
        label: 'Maestro de armas',
        describe: 'Entrena a los que salen: cada semana, quien va por detrás del mejor del grupo gana experiencia.',
        effect: {},
        board: 0,
    },
};

/** Lo que enseña un maestro de armas en una semana, a cada uno que va por detrás (idea 37). */
export const TRAINING_XP = 150;

/**
 * Lo que aprende el grupo en una semana con un maestro de armas en casa (idea 37).
 *
 * Solo quien va por detrás del de más nivel: el maestro enseña lo que sabe, y al mejor del
 * grupo ya no le queda nada que enseñarle. Dos maestros enseñan el doble.
 *
 * @param {any} guild
 * @param {Array<{id: any, name: string, level?: number, dead?: boolean}>} party
 * @returns {Array<{id: string, name: string, xp: number}>}
 */
export function trainingFor(guild, party) {
    const masters = (readGuild(guild).staff ?? []).filter(person => person.role === 'maestro');
    const alive = (Array.isArray(party) ? party : []).filter(m => m && !m.dead);
    if (masters.length === 0 || alive.length < 2) return [];
    const top = Math.max(...alive.map(m => Math.max(1, Math.floor(number(m.level, 1)))));
    return alive
        .filter(m => Math.max(1, Math.floor(number(m.level, 1))) < top)
        .map(m => ({ id: String(m.id), name: String(m.name), xp: TRAINING_XP * masters.length }));
}

/** Más gente en casa que esto, y la casa se llena de jubilados. */
export const MAX_STAFF = 3;

/** Cuánta reputación da terminar un encargo de cada rango. */
export const RENOWN_BY_RANK = { D: 1, C: 2, B: 4, A: 7, S: 12 };

/** Lo que cuesta que alguien se quede, y lo que pasa cuando no cobra. */
export const LOYALTY = {
    /** De dónde parte quien firma. */
    start: 3,
    /** Lo que baja por cada semana sin cobrar. */
    lossPerUnpaidWeek: 1,
    /** Por debajo de esto, se va. */
    leaveAt: 0,
    /** Lo que sube por cada encargo terminado con ellos dentro. */
    gainPerContract: 1,
    max: 5,
};

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {any} raw
 * @returns {GuildState}
 */
export function readGuild(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    /** @type {Record<string, number>} */
    const buildings = {};
    for (const key of Object.keys(BUILDINGS)) {
        const level = Math.floor(number(source.buildings?.[key]));
        if (level > 0) buildings[key] = Math.min(BUILDINGS[key].cost.length, level);
    }

    return {
        name: String(source.name ?? '').trim(),
        theme: String(source.theme ?? 'general'),
        renown: Math.max(0, Math.floor(number(source.renown))),
        buildings,
        staff: (Array.isArray(source.staff) ? source.staff : [])
            .filter((/** @type {any} */ s) => s && String(s.role) in STAFF_ROLES && String(s.name ?? '').trim())
            .slice(0, MAX_STAFF)
            .map((/** @type {any} */ s) => ({ name: String(s.name).trim(), role: String(s.role) })),
    };
}

/**
 * Lo que cuesta subir un edificio un nivel, o 0 si ya está al máximo.
 *
 * @param {GuildState} guild
 * @param {string} key
 * @returns {{cost: number, nextLevel: number, maxed: boolean}}
 */
export function upgradeCost(guild, key) {
    const building = BUILDINGS[key];
    if (!building) return { cost: 0, nextLevel: 0, maxed: true };

    const level = Math.floor(number(guild?.buildings?.[key]));
    if (level >= building.cost.length) return { cost: 0, nextLevel: level, maxed: true };

    return { cost: building.cost[level], nextLevel: level + 1, maxed: false };
}

/**
 * Los precios de la semana con los edificios puestos.
 *
 * Nada baja de cero: una cocina muy buena abarata la comida, no hace que te paguen por
 * comer. Se aplica **sobre** los precios de la campaña, así que un mundo caro sigue siendo
 * caro con gremio.
 *
 * @param {any} upkeepRules Los precios base.
 * @param {GuildState} guild
 * @returns {Record<string, number>}
 */
export function upkeepWithBuildings(upkeepRules, guild) {
    /** @type {Record<string, number>} */
    const prices = { ...(upkeepRules && typeof upkeepRules === 'object' ? upkeepRules : {}) };

    for (const [key, level] of Object.entries(guild?.buildings ?? {})) {
        const effect = BUILDINGS[key]?.effect ?? {};
        for (const [field, perLevel] of Object.entries(effect)) {
            const base = number(prices[field]);
            prices[field] = Math.max(0, base + number(perLevel) * Math.max(0, number(level)));
        }
    }

    // Quien se ha quedado en casa cuenta como un edificio de nivel uno.
    for (const person of guild?.staff ?? []) {
        const effect = STAFF_ROLES[/** @type {keyof typeof STAFF_ROLES} */ (person.role)]?.effect ?? {};
        for (const [field, amount] of Object.entries(effect)) {
            prices[field] = Math.max(0, number(prices[field]) + number(amount));
        }
    }

    return prices;
}

/**
 * Cuántos encargos trae el tablón, según la biblioteca.
 *
 * @param {GuildState} guild
 * @returns {number}
 */
export function boardSize(guild) {
    const advisers = (guild?.staff ?? [])
        .reduce((sum, person) => sum + (STAFF_ROLES[/** @type {keyof typeof STAFF_ROLES} */ (person.role)]?.board ?? 0), 0);
    return 4 + Math.max(0, Math.floor(number(guild?.buildings?.library))) + advisers;
}

/**
 * Darle a alguien un puesto en casa.
 *
 * @param {GuildState} guild
 * @param {string} name
 * @param {string} role Uno de `STAFF_ROLES`.
 * @returns {{ok: boolean, guild: GuildState, line: string}}
 */
export function retireTo(guild, name, role) {
    const read = readGuild(guild);
    const job = STAFF_ROLES[/** @type {keyof typeof STAFF_ROLES} */ (role)];
    if (!job) return { ok: false, guild: read, line: 'Ese puesto no existe.' };
    if (read.staff.length >= MAX_STAFF) {
        return { ok: false, guild: read, line: `En casa ya hay ${MAX_STAFF}: no cabe nadie más.` };
    }
    const who = String(name ?? '').trim();
    if (!who) return { ok: false, guild: read, line: 'Falta quién.' };

    return {
        ok: true,
        guild: { ...read, staff: [...read.staff, { name: who, role }] },
        line: `${who} se queda en casa como ${job.label.toLowerCase()}. ${job.describe}`,
    };
}

/**
 * Lo que pasa con la lealtad al cerrar una semana.
 *
 * Solo afecta a quien vino por dinero: a quien te sigue por un vínculo no se le paga, y
 * cobrarle lealtad por una semana mala sería castigar la amistad.
 *
 * @param {any[]} roster
 * @param {string[]} unpaid Los que no cobraron esta semana.
 * @returns {{roster: any[], leaving: string[], lines: string[]}}
 */
export function settleLoyalty(roster, unpaid) {
    const people = Array.isArray(roster) ? roster : [];
    const missed = new Set((Array.isArray(unpaid) ? unpaid : []).map(String));

    /** @type {string[]} */
    const leaving = [];
    /** @type {string[]} */
    const lines = [];

    const next = people.map((member) => {
        if (String(member?.motive ?? '').toLowerCase() !== 'coin') return member;

        const name = String(member?.name ?? 'Alguien');
        const before = number(member?.loyalty, LOYALTY.start);
        if (!missed.has(name)) return { ...member, loyalty: Math.min(LOYALTY.max, before) };

        const after = before - LOYALTY.lossPerUnpaidWeek;
        if (after <= LOYALTY.leaveAt) {
            leaving.push(name);
            lines.push(`${name} se va: lleva demasiado sin cobrar.`);
        } else {
            lines.push(`${name} sigue, pero lo dice con la boca pequeña (lealtad ${after}).`);
        }
        return { ...member, loyalty: after };
    });

    return {
        roster: next.filter(member => !leaving.includes(String(member?.name ?? ''))),
        leaving,
        lines,
    };
}

/**
 * Lo que un encargo terminado deja en el gremio.
 *
 * @param {GuildState} guild
 * @param {{rank: string, reward: number}} contract
 * @returns {{renown: number, gold: number, line: string}}
 */
export function completeContract(guild, contract) {
    const gained = number(RENOWN_BY_RANK[String(contract?.rank ?? '')], 1);
    const renown = Math.max(0, number(guild?.renown)) + gained;
    const gold = Math.max(0, Math.floor(number(contract?.reward)));

    return {
        renown,
        gold,
        line: `Encargo de rango ${contract?.rank ?? '?'} entregado: ${gold} de oro y ${gained} de reputación.`,
    };
}

/**
 * El gremio en una línea.
 *
 * @param {GuildState} guild
 * @returns {string}
 */
export function describeGuild(guild) {
    const parts = [guild.name || 'Sin nombre'];
    parts.push(`reputación ${guild.renown}`);

    const built = Object.entries(guild.buildings ?? {})
        .map(([key, level]) => `${BUILDINGS[key]?.label ?? key} ${level}`);
    parts.push(built.length > 0 ? built.join(', ') : 'sin construir nada');

    const staff = (guild.staff ?? [])
        .map(person => `${person.name} (${STAFF_ROLES[/** @type {keyof typeof STAFF_ROLES} */ (person.role)]?.label.toLowerCase() ?? person.role})`);
    if (staff.length > 0) parts.push(`en casa: ${staff.join(', ')}`);

    return parts.join(' · ');
}
