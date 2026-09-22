/**
 * Habilidades: conjuros, técnicas y recursos de clase, con las mismas piezas.
 *
 * La decisión que hay detrás (D5 de wiki/POR_HACER.md) fue **la capa ligera**: en vez de
 * las ranuras de conjuro de 5e — nivel 1 a 9, conjuros preparados, concentración, áreas de
 * efecto — una habilidad es una entrada de datos con cuatro preguntas: qué cuesta, cuántas
 * veces, a quién alcanza y qué hace. Con eso salen la *Furia* de un bárbaro, el *Tomar
 * aliento* de un guerrero y un *Rayo de fuego* sin escribir tres sistemas.
 *
 * Y sobre todo: **el catálogo vive en el paquete de reglas**, así que añadir un conjuro es
 * añadir una fila, no tocar código. Es la misma regla que las armas y las condiciones.
 *
 * Puro y determinista: decide, no aplica. Las tiradas entran como función, así que una
 * prueba puede fijarlas y el registro puede enseñarlas.
 *
 * Si algún día hacen falta las ranuras de verdad, se añaden encima de esto; al revés no.
 */

/** Qué parte del turno gasta. */
export const ABILITY_COSTS = ['action', 'bonus', 'free'];

/** Cada cuánto se recupera. */
export const ABILITY_RESOURCES = ['at_will', 'short_rest', 'long_rest'];

/** A quién se le puede lanzar. */
export const ABILITY_TARGETS = ['enemy', 'ally', 'self'];

/** Cómo se decide si surte efecto. */
export const ABILITY_RESOLUTIONS = ['auto', 'attack', 'save'];

/** Lo que se lee en la interfaz, para no repetir el diccionario en cada panel. */
export const ABILITY_LABELS = {
    costs: { action: 'Acción', bonus: 'Acción adicional', free: 'Gratis' },
    resources: { at_will: 'A voluntad', short_rest: 'Por descanso corto', long_rest: 'Por descanso largo' },
    targets: { enemy: 'Un enemigo', ally: 'Un aliado', self: 'Uno mismo' },
    resolutions: { auto: 'Siempre surte efecto', attack: 'Tirada de ataque', save: 'Tirada de salvación' },
};

/**
 * @typedef {Object} Ability
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {'action'|'bonus'|'free'} cost
 * @property {'at_will'|'short_rest'|'long_rest'} resource
 * @property {number} usesPerRest Cuántas veces entre descansos. Se ignora si es a voluntad.
 * @property {number} rangeFeet 0 para uno mismo.
 * @property {'enemy'|'ally'|'self'} target
 * @property {'auto'|'attack'|'save'} resolution
 * @property {string} saveAbility La característica que salva, cuando toca salvación.
 * @property {number} saveDc
 * @property {string} damage Fórmula, o vacío.
 * @property {string} damageType
 * @property {string} healing Fórmula, o vacío.
 * @property {string} condition Condición que aplica, o vacío.
 * @property {number} conditionRounds
 */

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {string[]} allowed
 * @param {string} fallback
 * @returns {string}
 */
function oneOf(value, allowed, fallback) {
    const clean = text(value).toLowerCase();
    return allowed.includes(clean) ? clean : fallback;
}

/**
 * Un identificador a partir del nombre, para la fila que no traiga uno.
 *
 * @param {string} name
 * @param {number} index
 * @returns {string}
 */
function slug(name, index) {
    const base = text(name).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return base || `habilidad_${index + 1}`;
}

/**
 * Deja una habilidad en la forma que el resto del motor espera.
 *
 * Lo que venga mal escrito se corrige a un valor con sentido en vez de romper: el catálogo
 * lo edita una persona, y una fila a medias no debería dejar la partida sin habilidades.
 *
 * @param {any} raw
 * @param {number} [index]
 * @returns {Ability}
 */
export function normalizeAbility(raw, index = 0) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const name = text(source.name);
    const target = /** @type {any} */ (oneOf(source.target, ABILITY_TARGETS, 'enemy'));
    const resolution = /** @type {any} */ (oneOf(source.resolution, ABILITY_RESOLUTIONS, 'auto'));

    return {
        id: text(source.id) || slug(name, index),
        name: name || text(source.id) || `Habilidad ${index + 1}`,
        description: text(source.description),
        cost: /** @type {any} */ (oneOf(source.cost, ABILITY_COSTS, 'action')),
        resource: /** @type {any} */ (oneOf(source.resource, ABILITY_RESOURCES, 'at_will')),
        usesPerRest: Math.max(1, Math.floor(Number(source.usesPerRest) || 1)),
        // Sobre uno mismo el alcance no significa nada, y dejarlo a 30 solo confunde.
        rangeFeet: target === 'self' ? 0 : Math.max(0, Math.floor(Number(source.rangeFeet) || 5)),
        target,
        resolution,
        saveAbility: text(source.saveAbility) || 'dexterity',
        saveDc: Math.max(1, Math.floor(Number(source.saveDc) || 13)),
        damage: text(source.damage),
        damageType: text(source.damageType),
        healing: text(source.healing),
        condition: text(source.condition),
        conditionRounds: Math.max(1, Math.floor(Number(source.conditionRounds) || 1)),
    };
}

/**
 * El catálogo entero, sin identificadores repetidos.
 *
 * @param {any} raw
 * @returns {Ability[]}
 */
export function normalizeAbilities(raw) {
    const list = Array.isArray(raw) ? raw : [];
    /** @type {Map<string, Ability>} */
    const byId = new Map();
    list.forEach((entry, index) => {
        const ability = normalizeAbility(entry, index);
        if (!byId.has(ability.id)) byId.set(ability.id, ability);
    });
    return [...byId.values()];
}

/**
 * Las que un personaje se sabe, en el orden del catálogo.
 *
 * @param {any} member
 * @param {any} catalogue
 * @returns {Ability[]}
 */
export function knownAbilities(member, catalogue) {
    const known = new Set((Array.isArray(member?.abilities) ? member.abilities : []).map(id => text(id)));
    return normalizeAbilities(catalogue).filter(ability => known.has(ability.id));
}

/**
 * Cuántos usos le quedan. `Infinity` para las que son a voluntad.
 *
 * @param {any} member
 * @param {Ability} ability
 * @returns {number}
 */
export function usesLeft(member, ability) {
    if (ability.resource === 'at_will') return Infinity;
    const spent = Math.max(0, Math.floor(Number(member?.abilityUses?.[ability.id]) || 0));
    return Math.max(0, ability.usesPerRest - spent);
}

/**
 * Si se puede usar ahora mismo, y si no, por qué.
 *
 * El «por qué» no es cortesía: un botón que no responde y no explica nada es el fallo que
 * este proyecto lleva arrastrando desde el principio.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {Ability} input.ability
 * @param {number} [input.distanceFeet]
 * @param {boolean} [input.hasAction]
 * @param {boolean} [input.hasBonus]
 * @param {boolean} [input.targetAlive]
 * @returns {{ok: boolean, reason: string}}
 */
export function canUseAbility({
    member, ability, distanceFeet = 0, hasAction = true, hasBonus = true, targetAlive = true,
}) {
    if (!targetAlive) return { ok: false, reason: 'Ese objetivo ya está fuera de combate.' };

    if (usesLeft(member, ability) <= 0) {
        const when = ability.resource === 'short_rest' ? 'un descanso corto' : 'un descanso largo';
        return { ok: false, reason: `Sin usos: vuelve con ${when}.` };
    }

    if (ability.cost === 'action' && !hasAction) {
        return { ok: false, reason: 'La acción de este turno ya está gastada.' };
    }
    if (ability.cost === 'bonus' && !hasBonus) {
        return { ok: false, reason: 'La acción adicional de este turno ya está gastada.' };
    }

    if (ability.target !== 'self' && distanceFeet > ability.rangeFeet) {
        return { ok: false, reason: `Fuera de alcance: ${distanceFeet} ft de ${ability.rangeFeet} ft.` };
    }

    return { ok: true, reason: '' };
}

/**
 * Qué pasa al usarla.
 *
 * Decide y cuenta; no toca a nadie. El daño a la mitad por salvación superada y el crítico
 * que dobla los dados son de 5e, y están aquí porque son aritmética, no interfaz.
 *
 * @param {Object} input
 * @param {any} input.actor
 * @param {any} [input.target]
 * @param {Ability} input.ability
 * @param {(formula: string) => {total: number, natural?: number, rolls?: number[]}} input.roll
 * @param {number} [input.attackModifier]
 * @param {number} [input.targetAc]
 * @param {number} [input.saveModifier]
 * @returns {{
 *   ok: boolean, hit: boolean, saved: boolean, crit: boolean,
 *   damage: number, healing: number, condition: string, conditionRounds: number,
 *   lines: string[],
 * }}
 */
export function planAbilityUse({
    actor, target = null, ability, roll, attackModifier = 0, targetAc = 10, saveModifier = 0,
}) {
    const actorName = text(actor?.name) || 'Alguien';
    const targetName = ability.target === 'self' ? actorName : (text(target?.name) || 'el objetivo');
    const lines = [`✨ ${actorName} usa ${ability.name}${ability.target === 'self' ? '' : ` sobre ${targetName}`}.`];

    let hit = true;
    let saved = false;
    let crit = false;

    if (ability.resolution === 'attack') {
        const attack = roll('1d20');
        const total = (Number(attack.total) || 0) + attackModifier;
        crit = attack.natural === 20;
        hit = crit || total >= targetAc;
        lines.push(`🎲 Ataque: d20(${attack.total}) ${attackModifier >= 0 ? '+' : ''}${attackModifier} = ${total} vs CA ${targetAc}`);
        if (!hit) {
            lines.push('❌ Falla.');
            return { ok: true, hit, saved, crit, damage: 0, healing: 0, condition: '', conditionRounds: 0, lines };
        }
    } else if (ability.resolution === 'save') {
        const save = roll('1d20');
        const total = (Number(save.total) || 0) + saveModifier;
        saved = total >= ability.saveDc;
        lines.push(`🎲 Salvación de ${targetName}: d20(${save.total}) ${saveModifier >= 0 ? '+' : ''}${saveModifier} = ${total} vs CD ${ability.saveDc}`);
    }

    let damage = 0;
    if (ability.damage) {
        const first = roll(ability.damage);
        const extra = crit ? roll(ability.damage) : null;
        damage = Math.max(0, (Number(first.total) || 0) + (Number(extra?.total) || 0));
        // Una salvación superada no anula el golpe, lo parte por la mitad: es lo que hace
        // que tirar valga la pena aunque el otro acierte.
        if (saved) damage = Math.floor(damage / 2);
        if (damage > 0) {
            lines.push(`💥 Daño${ability.damageType ? ` ${ability.damageType.toLowerCase()}` : ''}: `
                + `${ability.damage}${crit ? ' x2 (crítico)' : ''}${saved ? ' a la mitad (salva)' : ''} = ${damage}`);
        }
    }

    let healing = 0;
    if (ability.healing) {
        healing = Math.max(0, Number(roll(ability.healing).total) || 0);
        if (healing > 0) lines.push(`💚 Cura ${healing} PG a ${targetName}.`);
    }

    const applies = ability.condition && !saved;
    if (ability.condition) {
        lines.push(applies
            ? `🌀 ${targetName} queda ${ability.condition} (${ability.conditionRounds} ronda(s)).`
            : `🌀 ${targetName} aguanta y no queda ${ability.condition}.`);
    }

    return {
        ok: true,
        hit,
        saved,
        crit,
        damage,
        healing,
        condition: applies ? ability.condition : '',
        conditionRounds: applies ? ability.conditionRounds : 0,
        lines,
    };
}

/**
 * El uso gastado, como parche para la ficha.
 *
 * @param {any} member
 * @param {Ability} ability
 * @returns {Record<string, number>}
 */
export function spendAbilityUse(member, ability) {
    if (ability.resource === 'at_will') return { ...(member?.abilityUses ?? {}) };
    const uses = { ...(member?.abilityUses ?? {}) };
    uses[ability.id] = Math.min(ability.usesPerRest, (Number(uses[ability.id]) || 0) + 1);
    return uses;
}

/**
 * Lo que devuelve un descanso.
 *
 * Uno corto devuelve lo de descanso corto; uno largo, todo. Es la misma regla que los
 * dados de golpe, y por eso se engancha donde ya se descansa.
 *
 * @param {any} member
 * @param {'corto'|'largo'} kind
 * @param {any} catalogue
 * @returns {Record<string, number>}
 */
export function restoreAbilityUses(member, kind, catalogue) {
    if (kind === 'largo') return {};

    const byId = new Map(normalizeAbilities(catalogue).map(a => [a.id, a]));
    const uses = { ...(member?.abilityUses ?? {}) };
    for (const id of Object.keys(uses)) {
        if (byId.get(id)?.resource === 'short_rest') delete uses[id];
    }
    return uses;
}

/**
 * La habilidad en una línea, para la lista y para el `title` de su botón.
 *
 * @param {Ability} ability
 * @returns {string}
 */
export function describeAbility(ability) {
    const parts = [ABILITY_LABELS.costs[ability.cost]];

    if (ability.resource === 'at_will') parts.push('a voluntad');
    else parts.push(`${ability.usesPerRest}x por descanso ${ability.resource === 'short_rest' ? 'corto' : 'largo'}`);

    parts.push(ability.target === 'self' ? 'sobre ti' : `${ability.rangeFeet} ft`);

    if (ability.damage) parts.push(`${ability.damage} de daño`);
    if (ability.healing) parts.push(`cura ${ability.healing}`);
    if (ability.condition) parts.push(ability.condition);
    if (ability.resolution === 'save') parts.push(`salvación CD ${ability.saveDc}`);

    return parts.join(' · ');
}
