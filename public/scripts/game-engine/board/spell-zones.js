/**
 * Las zonas de conjuro en el tablero (J19.6 del roadmap sin conexión): niebla, telaraña,
 * oscuridad, muro de fuego, silencio… casillas con un efecto que dura unas rondas.
 *
 * Es la misma idea que `hazards.js` (algo puesto en unas casillas, con un aviso y un
 * disparador) con tres diferencias que no caben allí:
 *
 * - **Cubre muchas casillas y es una sola cosa**: se lanza, se mueve y se acaba entera.
 * - **Salva quien la pisa**, contra la CD de quien la lanzó: una trampa no tiene CD de
 *   conjuro, y una telaraña sí.
 * - **Dura lo que el conjuro**, y si pide concentración, se acaba con ella.
 *
 * Los tipos están en una tabla, en código (DR7, como las etiquetas de `rules/tags.js`): un
 * tipo nuevo es una fila aquí. Lo que hace daño o deja un estado no viene de la tabla sino
 * del conjuro que la crea (`conjuros.json`): la tabla dice **cómo es** la zona; el conjuro,
 * **cuánto duele**.
 *
 * Tres disparadores: `enter` (al entrar, una vez por turno, como en 5e), `start` (al
 * empezar su turno dentro) y `end` (al acabarlo dentro).
 *
 * Puro: dice qué hay, qué salta y cómo queda la lista. No mueve a nadie ni tira dados que
 * no le pasen.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.6.
 */

/** Cuándo salta el efecto de una zona. */
export const ZONE_TRIGGERS = ['enter', 'start', 'end'];

/**
 * @typedef {Object} ZoneKind
 * @property {string} label
 * @property {string} icon
 * @property {string} tell Lo que ve quien juega, antes de pisarla.
 * @property {boolean} [difficult] Terreno difícil: cuesta el doble moverse.
 * @property {boolean} [blocksSight] No se ve a través: corta la línea de visión.
 * @property {boolean} [dark] Oscuridad mágica: la luz corriente no la despeja.
 * @property {boolean} [silence] No se pueden lanzar conjuros con palabras.
 * @property {boolean} [burns] El fuego la quema.
 * @property {boolean} [follows] Va con quien la lanzó.
 * @property {string[]} [triggers] Cuándo salta su efecto, si el conjuro trae uno.
 * @property {string[]} [clears] Los tipos que deshace al aparecer encima.
 */

/** @type {Record<string, ZoneKind>} */
export const ZONE_KINDS = {
    niebla: { label: 'Niebla', icon: '🌫️', tell: 'Una niebla espesa: dentro no se ve nada.', blocksSight: true },
    oscuridad: { label: 'Oscuridad', icon: '🌑', tell: 'Una negrura que ni las antorchas atraviesan.', blocksSight: true, dark: true },
    telarana: { label: 'Telaraña', icon: '🕸️', tell: 'Hilos pegajosos de pared a pared. Arden.', difficult: true, burns: true, triggers: ['enter', 'start'] },
    enredadera: { label: 'Enredadera', icon: '🌿', tell: 'Raíces y hierba que se agarran a los pies.', difficult: true },
    espinas: { label: 'Púas', icon: '🌵', tell: 'Pinchos escondidos en el suelo: cada paso, un corte.', difficult: true, triggers: ['enter'] },
    fuego: { label: 'Fuego', icon: '🔥', tell: 'Llamas que no se apagan solas: queman a quien entra.', triggers: ['enter', 'end'] },
    silencio: { label: 'Silencio', icon: '🔇', tell: 'Aquí no suena nada: no se pueden decir conjuros.', silence: true },
    luz_de_luna: { label: 'Rayo de luna', icon: '🌙', tell: 'Una columna de luz plateada que quema.', triggers: ['enter', 'start'] },
    espiritus: { label: 'Espíritus', icon: '👻', tell: 'Espíritus que giran alrededor de quien los llamó.', difficult: true, follows: true, triggers: ['enter', 'start'] },
    nube_apestosa: { label: 'Nube apestosa', icon: '🤢', tell: 'Un gas amarillo que revuelve el estómago.', blocksSight: true, triggers: ['start'] },
    luz: { label: 'Luz del día', icon: '☀️', tell: 'Luz de mediodía, aunque sea de noche.', clears: ['oscuridad'] },
};

/**
 * @typedef {Object} ZoneEffect
 * @property {string} save La característica que salva, o vacío si no hay salvación.
 * @property {number} dc
 * @property {string} damage
 * @property {string} damageType
 * @property {'half'|'none'} onSave
 * @property {string} condition
 * @property {number} conditionRounds
 */

/**
 * @typedef {Object} Zone
 * @property {string} id
 * @property {string} kind
 * @property {string} name
 * @property {string} spellId
 * @property {string} casterId
 * @property {{x: number, y: number}} center
 * @property {Array<{x: number, y: number}>} cells
 * @property {number} since La ronda en que apareció.
 * @property {number|null} until La ronda en que se acaba; `null` si no se acaba sola.
 * @property {boolean} concentration
 * @property {string[]} triggers
 * @property {ZoneEffect|null} effect
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {{x: number, y: number}} cell @returns {string} */
const keyOf = (cell) => `${Math.trunc(Number(cell?.x) || 0)},${Math.trunc(Number(cell?.y) || 0)}`;

/**
 * Lo que dice la tabla de un tipo; un tipo que no existe no tiene nada.
 *
 * @param {string} kind
 * @returns {ZoneKind}
 */
export function kindOf(kind) {
    return ZONE_KINDS[text(kind)] ?? { label: text(kind) || 'Zona', icon: '✨', tell: '' };
}

/**
 * Una zona nueva.
 *
 * @param {Object} input
 * @param {string} input.kind Una clave de `ZONE_KINDS`.
 * @param {Array<{x: number, y: number}>} input.cells Las de `areaCells`.
 * @param {{x: number, y: number}} [input.center] El punto elegido; por defecto, la primera casilla.
 * @param {number} input.round
 * @param {number} [input.rounds] Cuánto dura. `Infinity` o sin decir: hasta que se acabe por otra cosa.
 * @param {string} [input.name]
 * @param {string} [input.spellId]
 * @param {string} [input.casterId]
 * @param {boolean} [input.concentration]
 * @param {string[]} [input.triggers] Si el conjuro cambia los de su tipo.
 * @param {Partial<ZoneEffect>|null} [input.effect]
 * @returns {Zone}
 */
export function createZone({
    kind, cells, center, round, rounds = Infinity, name = '', spellId = '', casterId = '',
    concentration = false, triggers, effect = null,
}) {
    const spec = kindOf(kind);
    const now = Math.max(1, Math.floor(Number(round) || 1));
    const list = (Array.isArray(cells) ? cells : []).map(c => ({ x: Math.trunc(Number(c.x) || 0), y: Math.trunc(Number(c.y) || 0) }));
    const unique = [...new Map(list.map(c => [keyOf(c), c])).values()];
    const wanted = (Array.isArray(triggers) ? triggers : spec.triggers ?? []).filter(t => ZONE_TRIGGERS.includes(t));
    const hasEffect = Boolean(effect && (text(effect.damage) || text(effect.condition)));
    return {
        id: `zona-${text(spellId) || text(kind)}-${text(casterId) || 'nadie'}-${now}`,
        kind: text(kind),
        name: text(name) || spec.label,
        spellId: text(spellId),
        casterId: text(casterId),
        center: center ? { x: Math.trunc(center.x), y: Math.trunc(center.y) } : (unique[0] ?? { x: 0, y: 0 }),
        cells: unique,
        since: now,
        until: Number.isFinite(Number(rounds)) && Number(rounds) > 0 ? now + Math.floor(Number(rounds)) : null,
        concentration: Boolean(concentration),
        triggers: hasEffect ? wanted : [],
        effect: hasEffect ? {
            save: text(effect?.save),
            dc: Math.max(1, Math.floor(Number(effect?.dc) || 13)),
            damage: text(effect?.damage),
            damageType: text(effect?.damageType),
            onSave: effect?.onSave === 'none' ? 'none' : 'half',
            condition: text(effect?.condition),
            conditionRounds: Math.max(1, Math.floor(Number(effect?.conditionRounds) || 1)),
        } : null,
    };
}

/**
 * La zona de un conjuro de `conjuros.json`, con su CD y su daño ya subidos de nivel.
 *
 * @param {Object} input
 * @param {any} input.spell Un conjuro normalizado (`normalizeSpell`), con su columna `zone`.
 * @param {Array<{x: number, y: number}>} input.cells
 * @param {{x: number, y: number}} [input.center]
 * @param {string} input.casterId
 * @param {number} input.round
 * @param {number} [input.saveDc]
 * @param {string} [input.damage] El daño después de subirlo de nivel.
 * @returns {Zone|null}
 */
export function zoneFromSpell({ spell, cells, center, casterId, round, saveDc = 13, damage }) {
    const zone = spell?.zone;
    if (!zone || !ZONE_KINDS[text(zone.kind)]) return null;
    return createZone({
        kind: zone.kind,
        cells,
        center,
        round,
        rounds: Number(spell.durationRounds) > 0 ? spell.durationRounds : Infinity,
        name: spell.name,
        spellId: spell.id,
        casterId,
        concentration: Boolean(spell.concentration),
        triggers: Array.isArray(zone.triggers) ? zone.triggers : undefined,
        effect: {
            save: spell.save,
            dc: saveDc,
            damage: damage ?? spell.damage,
            damageType: spell.damageType,
            onSave: spell.onSave,
            condition: spell.condition,
            conditionRounds: spell.conditionRounds,
        },
    });
}

/**
 * Las zonas que cubren una casilla.
 *
 * @param {Zone[]} zones
 * @param {{x: number, y: number}} cell
 * @returns {Zone[]}
 */
export function zonesAt(zones, cell) {
    const key = keyOf(cell);
    return (Array.isArray(zones) ? zones : []).filter(zone => zone.cells.some(c => keyOf(c) === key));
}

/**
 * Cómo está una casilla por las zonas que tiene encima: para moverse, para ver y para
 * lanzar.
 *
 * @param {Zone[]} zones
 * @param {{x: number, y: number}} cell
 * @returns {{difficult: boolean, blocksSight: boolean, dark: boolean, silence: boolean, names: string[]}}
 */
export function zoneFlagsAt(zones, cell) {
    const here = zonesAt(zones, cell);
    const has = (/** @type {keyof ZoneKind} */ flag) => here.some(zone => Boolean(kindOf(zone.kind)[flag]));
    return {
        difficult: has('difficult'),
        blocksSight: has('blocksSight'),
        dark: has('dark'),
        silence: has('silence'),
        names: here.map(zone => zone.name),
    };
}

/**
 * Lo que salta en una casilla. `enter` salta una vez por turno y zona: lo que ya saltó
 * este turno se pasa en `alreadyThisTurn` (las claves `key` que devolvió antes).
 *
 * @param {Object} input
 * @param {Zone[]} input.zones
 * @param {{x: number, y: number}} input.cell
 * @param {'enter'|'start'|'end'} input.trigger
 * @param {string} input.who El id de quien la pisa.
 * @param {string[]} [input.alreadyThisTurn]
 * @returns {Array<ZoneEffect & {zoneId: string, key: string, name: string, kind: string}>}
 */
export function zoneEffects({ zones, cell, trigger, who, alreadyThisTurn = [] }) {
    const done = new Set(alreadyThisTurn);
    return zonesAt(zones, cell)
        .filter(zone => zone.effect && zone.triggers.includes(trigger))
        .map(zone => ({ ...(/** @type {ZoneEffect} */ (zone.effect)), zoneId: zone.id, key: `${zone.id}:${text(who)}`, name: zone.name, kind: zone.kind }))
        .filter(effect => trigger !== 'enter' || !done.has(effect.key));
}

/**
 * Lo que le pasa a alguien por un efecto de zona: tira su salvación y su daño.
 *
 * @param {Object} input
 * @param {ZoneEffect & {name?: string}} input.effect
 * @param {(formula: string) => {total: number}} input.roll
 * @param {number} [input.saveModifier]
 * @param {string} [input.targetName]
 * @returns {{saved: boolean, damage: number, condition: string, conditionRounds: number, lines: string[]}}
 */
export function resolveZoneEffect({ effect, roll, saveModifier = 0, targetName = 'Alguien' }) {
    /** @type {string[]} */
    const lines = [];
    let saved = false;
    if (effect.save) {
        const d20 = Number(roll('1d20').total) || 0;
        const total = d20 + saveModifier;
        saved = total >= effect.dc;
        lines.push(`🎲 ${targetName} salva contra ${effect.name ?? 'la zona'}: d20(${d20}) ${saveModifier >= 0 ? '+' : ''}${saveModifier} = ${total} vs CD ${effect.dc}${saved ? ': aguanta.' : '.'}`);
    }
    let damage = 0;
    if (effect.damage) {
        damage = Math.max(0, Number(roll(effect.damage).total) || 0);
        if (saved) damage = effect.onSave === 'none' ? 0 : Math.floor(damage / 2);
        if (damage > 0) lines.push(`💥 ${targetName} recibe ${damage} de daño.`);
    }
    const condition = effect.condition && !saved ? effect.condition : '';
    if (condition) lines.push(`🌀 ${effect.name ?? 'La zona'} atrapa a ${targetName}.`);
    return { saved, damage, condition, conditionRounds: condition ? effect.conditionRounds : 0, lines };
}

/**
 * Las que se acaban en esta ronda.
 *
 * @param {Zone[]} zones
 * @param {number} round
 * @returns {{kept: Zone[], gone: Zone[], lines: string[]}}
 */
export function expireZones(zones, round) {
    const now = Math.floor(Number(round) || 0);
    const list = Array.isArray(zones) ? zones : [];
    const gone = list.filter(zone => zone.until !== null && zone.until <= now);
    return {
        kept: list.filter(zone => !gone.includes(zone)),
        gone,
        lines: gone.map(zone => `${kindOf(zone.kind).icon} Se acaba ${zone.name}.`),
    };
}

/**
 * Las de un conjuro (o de todos los de alguien), que se acaban de golpe: al perder la
 * concentración o al disiparlas.
 *
 * @param {Zone[]} zones
 * @param {{casterId: string, spellId?: string}} from
 * @returns {{kept: Zone[], gone: Zone[], lines: string[]}}
 */
export function endZones(zones, { casterId, spellId = '' }) {
    const list = Array.isArray(zones) ? zones : [];
    const gone = list.filter(zone => zone.casterId === text(casterId) && (!spellId || zone.spellId === text(spellId)));
    return {
        kept: list.filter(zone => !gone.includes(zone)),
        gone,
        lines: gone.map(zone => `${kindOf(zone.kind).icon} Se deshace ${zone.name}.`),
    };
}

/**
 * La zona llevada a otro sitio, con su forma: la esfera de fuego que se empuja, el rayo de
 * luna que se mueve.
 *
 * @param {Zone} zone
 * @param {{x: number, y: number}} to El nuevo centro.
 * @returns {Zone}
 */
export function moveZone(zone, to) {
    const dx = Math.trunc(to.x) - zone.center.x;
    const dy = Math.trunc(to.y) - zone.center.y;
    return {
        ...zone,
        center: { x: zone.center.x + dx, y: zone.center.y + dy },
        cells: zone.cells.map(c => ({ x: c.x + dx, y: c.y + dy })),
    };
}

/**
 * Las que van con quien las lanzó (los espíritus guardianes), movidas con él.
 *
 * @param {Zone[]} zones
 * @param {string} casterId
 * @param {{x: number, y: number}} to Donde está ahora.
 * @returns {Zone[]}
 */
export function followCaster(zones, casterId, to) {
    return (Array.isArray(zones) ? zones : [])
        .map(zone => (zone.casterId === text(casterId) && kindOf(zone.kind).follows ? moveZone(zone, to) : zone));
}

/**
 * Quitar de unas casillas las zonas de unos tipos: la luz del día deshace la oscuridad; una
 * ráfaga, la niebla. La zona que se queda sin casillas desaparece.
 *
 * @param {Object} input
 * @param {Zone[]} input.zones
 * @param {string[]} input.kinds
 * @param {Array<{x: number, y: number}>} input.cells
 * @returns {{zones: Zone[], cleared: Array<{x: number, y: number}>, lines: string[]}}
 */
export function clearZones({ zones, kinds, cells }) {
    const hit = new Set((Array.isArray(cells) ? cells : []).map(keyOf));
    const wanted = new Set((Array.isArray(kinds) ? kinds : []).map(text));
    /** @type {Array<{x: number, y: number}>} */
    const cleared = [];
    /** @type {Set<string>} */
    const names = new Set();
    const next = (Array.isArray(zones) ? zones : []).flatMap(zone => {
        if (!wanted.has(zone.kind)) return [zone];
        const left = zone.cells.filter(c => !hit.has(keyOf(c)));
        if (left.length === zone.cells.length) return [zone];
        cleared.push(...zone.cells.filter(c => hit.has(keyOf(c))));
        names.add(zone.name);
        return left.length > 0 ? [{ ...zone, cells: left }] : [];
    });
    return { zones: next, cleared, lines: [...names].map(name => `✨ Se deshace ${name} donde cae.`) };
}

/**
 * Lo que arde de las zonas cuando les llega fuego: la telaraña se quema entera en esas
 * casillas, y quien estuviera dentro se lleva el fuego (2d4 en 5e; lo tira quien llama).
 *
 * @param {Object} input
 * @param {Zone[]} input.zones
 * @param {Array<{x: number, y: number}>} input.cells
 * @returns {{zones: Zone[], burned: Array<{x: number, y: number}>, lines: string[]}}
 */
export function burnZones({ zones, cells }) {
    const burnable = Object.entries(ZONE_KINDS).filter(([, spec]) => spec.burns).map(([id]) => id);
    const result = clearZones({ zones, kinds: burnable, cells });
    return {
        zones: result.zones,
        burned: result.cleared,
        lines: result.cleared.length > 0 ? ['🔥 La telaraña arde y se deshace.'] : [],
    };
}

/**
 * Lo que una zona nueva deshace al aparecer (la luz del día sobre la oscuridad).
 *
 * @param {Zone[]} zones Las que había.
 * @param {Zone} added
 * @returns {{zones: Zone[], lines: string[]}}
 */
export function placeZone(zones, added) {
    const clears = kindOf(added.kind).clears ?? [];
    const cleared = clears.length > 0 ? clearZones({ zones, kinds: clears, cells: added.cells }) : { zones: Array.isArray(zones) ? zones : [], lines: [] };
    return { zones: [...cleared.zones, added], lines: cleared.lines };
}

/**
 * Lo que el tablero tiene que pintar: una entrada por casilla y zona, con su icono y su
 * aviso.
 *
 * @param {Zone[]} zones
 * @returns {Array<{x: number, y: number, zoneId: string, kind: string, icon: string, label: string, tell: string}>}
 */
export function zoneOverlay(zones) {
    return (Array.isArray(zones) ? zones : []).flatMap(zone => {
        const spec = kindOf(zone.kind);
        return zone.cells.map(c => ({ x: c.x, y: c.y, zoneId: zone.id, kind: zone.kind, icon: spec.icon, label: zone.name, tell: spec.tell }));
    });
}
