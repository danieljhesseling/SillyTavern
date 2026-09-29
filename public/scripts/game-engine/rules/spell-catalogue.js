/**
 * Los conjuros como datos (J19.11 del roadmap sin conexión): `public/compendio/conjuros.json`.
 *
 * R4 escribió la magia en el código (`grimoire.js`) para que nadie —el guion, el Gem, el
 * paquete de reglas— pudiera inventarse un conjuro. J19 la saca a un archivo **del juego**,
 * no de la campaña: añadir un conjuro es añadir una fila, y la valla sigue en pie, porque
 * `habilidades.json`, las filas del mundo y el paquete de reglas siguen sin poder traer
 * escuela ni nivel (`magicInData`). Solo este archivo trae magia.
 *
 * Por qué un archivo aparte y no más columnas en `habilidades.json`:
 * - allí `level` es **el nivel del personaje** desde el que se aprende una habilidad, y aquí
 *   es **el nivel del conjuro**: una Bola de fuego saldría a un personaje de nivel 3;
 * - allí pasa `magicInData`, que rechaza justo lo que un conjuro tiene que traer;
 * - un conjuro no gasta «usos por descanso», gasta espacios: `resource` y `usesPerRest` no
 *   significan nada aquí.
 *
 * Todas las columnas son **vocabularios cerrados o números**, y el validador los comprueba
 * todos, también las columnas que no existen: una errata («damge») no da error en ningún
 * otro sitio, degrada en silencio.
 *
 * Puro: vocabularios, lectura y comprobación.
 *
 * Ver wiki/ROADMAP_SIN_CONEXION.md, J19.11, y el `about` de `conjuros.json`.
 */

import { readArea, AREA_SHAPES } from './area.js';
import { ELEMENTS } from './tags.js';
import { SPELLS as GRIMOIRE, spellById } from './grimoire.js';
import { ZONE_KINDS, ZONE_TRIGGERS } from '../board/spell-zones.js';
import { validateSummon } from './summons.js';
import { REACTION_TRIGGERS, REACTION_EFFECTS } from './spell-reactions.js';

/** Las ocho escuelas de 5e. */
export const SPELL_SCHOOLS = {
    abjuracion: { label: 'Abjuración', note: 'Proteger, cerrar y deshacer magia.' },
    adivinacion: { label: 'Adivinación', note: 'Saber lo que no se ve.' },
    conjuracion: { label: 'Conjuración', note: 'Traer cosas y criaturas, o llevarse a uno de sitio.' },
    encantamiento: { label: 'Encantamiento', note: 'La mente: dormir, obedecer, querer.' },
    evocacion: { label: 'Evocación', note: 'Fuego, rayo, luz y curación: energía a pelo.' },
    ilusion: { label: 'Ilusión', note: 'Engañar a los sentidos.' },
    nigromancia: { label: 'Nigromancia', note: 'La vida y la muerte. En muchos sitios, un crimen.' },
    transmutacion: { label: 'Transmutación', note: 'Cambiar cómo son las cosas.' },
};

/** Cuánto se tarda en lanzar. Lo de un minuto o más no se lanza peleando. */
export const CASTING_TIMES = ['action', 'bonus', 'reaction', 'minute', '10min', 'hour'];

/** Cómo se dice. */
export const CASTING_LABELS = {
    action: 'Acción', bonus: 'Acción adicional', reaction: 'Reacción',
    minute: '1 minuto', '10min': '10 minutos', hour: '1 hora',
};

/** Los minutos de lo que no es una acción. */
export const CASTING_MINUTES = { action: 0, bonus: 0, reaction: 0, minute: 1, '10min': 10, hour: 60 };

/** A quién apunta. `point` es una casilla cualquiera: una niebla no necesita a nadie dentro. */
export const SPELL_TARGETS = ['enemy', 'ally', 'self', 'point'];

/** Las seis características, como las guarda la ficha. */
export const SAVE_ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

/** Cómo se dicen. */
export const ABILITY_NAMES = {
    strength: 'Fuerza', dexterity: 'Destreza', constitution: 'Constitución',
    intelligence: 'Inteligencia', wisdom: 'Sabiduría', charisma: 'Carisma',
};

/** Los trece tipos de daño de 5e, con la forma inglesa que ya usa el motor. */
export const DAMAGE_TYPES = {
    Acid: 'ácido', Bludgeoning: 'contundente', Cold: 'frío', Fire: 'fuego', Force: 'fuerza',
    Lightning: 'rayo', Necrotic: 'necrótico', Piercing: 'perforante', Poison: 'veneno',
    Psychic: 'psíquico', Radiant: 'radiante', Slashing: 'cortante', Thunder: 'trueno',
};

/**
 * Los estados nuevos que traen los conjuros, con lo que hacen. El motor ya pesa los de 5e y
 * los de la capa ligera (Bendecido, Escudado, Distraído); estos los tiene que aprender a
 * pesar donde se enchufe cada conjuro (ver el informe de J19).
 */
export const SPELL_CONDITIONS = {
    Guiado: { label: 'Guiado', effect: 'suma 1d4 a su próxima prueba' },
    Resguardado: { label: 'Resguardado', effect: 'suma 1d4 a su próxima salvación' },
    Protegido: { label: 'Protegido', effect: 'los muertos, los demonios y los espíritus le pegan peor' },
    Perfilado: { label: 'Perfilado', effect: 'brilla: se le acierta mejor y no puede volverse invisible' },
    Ralentizado: { label: 'Ralentizado', effect: 'se mueve 10 pies menos' },
    Acelerado: { label: 'Acelerado', effect: 'el doble de rápido, +2 a la CA y una acción más' },
    'A la carrera': { label: 'A la carrera', effect: 'puede correr con la acción adicional' },
};

/** Todos los estados que un conjuro puede dejar. */
export const KNOWN_CONDITIONS = [
    'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
    'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion',
    'Bendecido', 'Escudado', 'Distraído', 'Mojado',
    ...Object.keys(SPELL_CONDITIONS),
];

/**
 * Lo que puede subir al lanzar con un espacio mayor, por cada nivel de más: fórmulas de
 * dados que se suman, o números que se suman. `every` dice cada cuántos niveles.
 */
export const UPCAST_KEYS = {
    dice: 'formula', healing: 'formula', hpPool: 'formula',
    targets: 'number', rays: 'number', radius: 'number', count: 'number', maxHpBonus: 'number',
    every: 'number',
};

/** Todas las columnas que puede tener una fila. Otra cualquiera es una errata. */
export const SPELL_COLUMNS = [
    'id', 'name', 'kind', 'tags', 'weight', 'when', 'aliases', 'note',
    'level', 'school', 'classes', 'castingTime', 'rangeFeet', 'duration', 'concentration', 'ritual', 'combat',
    'target', 'targets', 'rays', 'area', 'save', 'attack', 'onSave', 'affects',
    'damage', 'damageType', 'addModifier', 'drain', 'healing', 'hpPool', 'maxHpBonus',
    'condition', 'conditionRounds', 'repeatSave', 'removes', 'stabilizes', 'revives',
    'upcast', 'components', 'material',
    'zone', 'summon', 'reaction', 'ac',
    'teleportFeet', 'pushFeet', 'creates', 'again', 'clearsZones', 'dispels',
    'element', 'leaves',
];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Una fórmula de dados del motor: «1d8», «3d4+3», «2d6+1d4», «5». */
const FORMULA = /^(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/i;

/**
 * Si un texto es una fórmula de dados que el motor sabe tirar.
 *
 * @param {any} value
 * @returns {boolean}
 */
export function isFormula(value) {
    return FORMULA.test(text(value).replace(/\s+/g, ''));
}

/**
 * Cuántas rondas dura, de lo que dice la columna `duration`: «instantáneo», «1 ronda»,
 * «1 minuto» (10 rondas), «10 minutos», «1 hora», «8 horas», «24 horas», «hasta que se
 * disipe» o «permanente». También en inglés.
 *
 * @param {any} value
 * @returns {number} 0 si es instantáneo, `Infinity` si no se acaba solo, `NaN` si no se entiende.
 */
export function durationRounds(value) {
    const said = plain(value);
    if (!said || /^(instantaneo|instantanea|instant|instantaneous)$/.test(said)) return 0;
    if (/^(hasta que se disipe|permanente|until dispelled|permanent)$/.test(said)) return Infinity;
    const match = said.match(/^(\d+)\s*(rondas?|rounds?|minutos?|minutes?|horas?|hours?|dias?|days?)$/);
    if (!match) return NaN;
    const amount = Number(match[1]);
    const unit = match[2];
    if (/^(ronda|round)/.test(unit)) return amount;
    if (/^minut/.test(unit)) return amount * 10;
    if (/^(hora|hour)/.test(unit)) return amount * 600;
    return amount * 14400;
}

/**
 * @typedef {Object} Spell
 * @property {string} id
 * @property {string} name
 * @property {number} level 0 es un truco.
 * @property {string} school
 * @property {string[]} classes
 * @property {string} castingTime
 * @property {number} rangeFeet 0 es uno mismo; 5, tocar.
 * @property {string} duration
 * @property {number} durationRounds
 * @property {boolean} concentration
 * @property {boolean} ritual
 * @property {boolean} combat `false` si no sirve peleando.
 * @property {'enemy'|'ally'|'self'|'point'} target
 * @property {number} targets Cuántos como mucho.
 * @property {number} rays Golpes separados (Proyectil mágico, Rayo abrasador); 0 si es uno.
 * @property {import('./area.js').Area} area
 * @property {string} save
 * @property {''|'melee'|'ranged'} attack
 * @property {'half'|'none'} onSave
 * @property {string} affects Solo a quien tenga esta etiqueta (`gente`, `bestia`).
 * @property {string} damage
 * @property {string} damageType
 * @property {boolean} addModifier Suma el modificador de lanzar al daño o a la cura.
 * @property {boolean} drain Quien lo lanza se cura la mitad del daño que hace.
 * @property {string} healing
 * @property {string} hpPool Duerme o ciega por puntos de vida, de menos a más (Dormir).
 * @property {number} maxHpBonus
 * @property {string} condition
 * @property {number} conditionRounds
 * @property {boolean} repeatSave Salva otra vez al acabar cada turno suyo.
 * @property {string[]} removes
 * @property {boolean} stabilizes
 * @property {{hp: number, withinRounds: number}|null} revives
 * @property {Record<string, any>} upcast
 * @property {string[]} components
 * @property {{name: string, costGp: number, consumed: boolean}|null} material
 * @property {{kind: string, triggers?: string[]}|null} zone
 * @property {any} summon
 * @property {{on: string, effect: string, amount?: number}|null} reaction
 * @property {{bonus?: number, min?: number, base?: number, addDex?: boolean}|null} ac
 * @property {number} teleportFeet
 * @property {number} pushFeet
 * @property {{item: string, count: number}|null} creates
 * @property {''|'action'|'bonus'} again Mientras dure, se repite con esa acción.
 * @property {string[]} clearsZones
 * @property {boolean} dispels
 * @property {string} element
 * @property {string} leaves
 * @property {string} note
 * @property {string[]} aliases
 */

/**
 * @param {any} value
 * @returns {string[]}
 */
function list(value) {
    return (Array.isArray(value) ? value : []).map(text).filter(Boolean);
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function whole(value, fallback) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Una fila de `conjuros.json` en la forma que el resto espera, con los valores por defecto
 * de 5e: un truco que se salva no hace nada; un conjuro con nivel, la mitad.
 *
 * @param {any} row
 * @returns {Spell}
 */
export function normalizeSpell(row) {
    const source = (row && typeof row === 'object') ? row : {};
    const level = Math.max(0, Math.min(9, whole(source.level, 0)));
    const rounds = durationRounds(source.duration);
    const save = SAVE_ABILITIES.includes(text(source.save)) ? text(source.save) : '';
    const conditionRounds = whole(source.conditionRounds, 0) > 0 ? whole(source.conditionRounds, 1)
        : (Number.isFinite(rounds) && rounds > 0 ? rounds : 1);
    const material = source.material && typeof source.material === 'object' ? {
        name: text(source.material.name),
        costGp: Math.max(0, Number(source.material.costGp) || 0),
        consumed: Boolean(source.material.consumed),
    } : null;
    return {
        id: text(source.id),
        name: text(source.name),
        level,
        school: text(source.school),
        classes: list(source.classes),
        castingTime: CASTING_TIMES.includes(text(source.castingTime)) ? text(source.castingTime) : 'action',
        rangeFeet: Math.max(0, whole(source.rangeFeet, 0)),
        duration: text(source.duration) || 'instantáneo',
        durationRounds: Number.isNaN(rounds) ? 0 : rounds,
        concentration: Boolean(source.concentration),
        ritual: Boolean(source.ritual),
        combat: source.combat !== false,
        target: /** @type {Spell['target']} */ (SPELL_TARGETS.includes(text(source.target)) ? text(source.target) : 'enemy'),
        targets: Math.max(1, whole(source.targets, 1)),
        rays: Math.max(0, whole(source.rays, 0)),
        area: readArea(source.area),
        save,
        attack: /** @type {Spell['attack']} */ (['melee', 'ranged'].includes(text(source.attack)) ? text(source.attack) : ''),
        onSave: source.onSave === 'none' || source.onSave === 'half' ? source.onSave : (level === 0 ? 'none' : 'half'),
        affects: text(source.affects),
        damage: text(source.damage),
        damageType: text(source.damageType),
        addModifier: Boolean(source.addModifier),
        drain: Boolean(source.drain),
        healing: text(source.healing),
        hpPool: text(source.hpPool),
        maxHpBonus: Math.max(0, whole(source.maxHpBonus, 0)),
        condition: text(source.condition),
        conditionRounds,
        repeatSave: Boolean(source.repeatSave),
        removes: list(source.removes),
        stabilizes: Boolean(source.stabilizes),
        revives: source.revives && typeof source.revives === 'object'
            ? { hp: Math.max(1, whole(source.revives.hp, 1)), withinRounds: Math.max(1, whole(source.revives.withinRounds, 10)) } : null,
        upcast: source.upcast && typeof source.upcast === 'object' ? { ...source.upcast } : {},
        components: list(source.components).map(c => c.toUpperCase()),
        material,
        zone: source.zone && typeof source.zone === 'object' ? { ...source.zone, kind: text(source.zone.kind) } : null,
        summon: source.summon && typeof source.summon === 'object' ? { ...source.summon } : null,
        reaction: source.reaction && typeof source.reaction === 'object'
            ? { on: text(source.reaction.on), effect: text(source.reaction.effect), ...(source.reaction.amount !== undefined ? { amount: Number(source.reaction.amount) || 0 } : {}) } : null,
        ac: source.ac && typeof source.ac === 'object' ? { ...source.ac } : null,
        teleportFeet: Math.max(0, whole(source.teleportFeet, 0)),
        pushFeet: Math.max(0, whole(source.pushFeet, 0)),
        creates: source.creates && typeof source.creates === 'object'
            ? { item: text(source.creates.item), count: Math.max(1, whole(source.creates.count, 1)) } : null,
        again: source.again === 'action' || source.again === 'bonus' ? source.again : '',
        clearsZones: list(source.clearsZones),
        dispels: Boolean(source.dispels),
        element: text(source.element).toLowerCase(),
        leaves: text(source.leaves),
        note: text(source.note),
        aliases: list(source.aliases),
    };
}

/**
 * Lo que impide usar una fila de conjuro. Todos los problemas, no el primero.
 *
 * @param {any} row
 * @param {{classIds?: string[], creatureIds?: string[]}} [context] Las clases y el bestiario, para comprobar las referencias.
 * @returns {string[]}
 */
export function validateSpell(row, context = {}) {
    const name = text(row?.name) || text(row?.id) || '(sin nombre)';
    /** @type {string[]} */
    const errors = [];
    const say = (/** @type {string} */ message) => errors.push(`${name}: ${message}`);
    if (!row || typeof row !== 'object') return [`${name}: no es un objeto.`];

    for (const key of Object.keys(row)) {
        if (!SPELL_COLUMNS.includes(key)) say(`la columna "${key}" no existe. Las que hay están en el "about" del archivo.`);
    }

    const level = Number(row.level);
    if (!Number.isInteger(level) || level < 0 || level > 9) say('"level" tiene que ser un número de 0 (truco) a 9.');
    if (!Object.hasOwn(SPELL_SCHOOLS, text(row.school))) say(`"school" dice "${text(row.school)}". Vale: ${Object.keys(SPELL_SCHOOLS).join(', ')}.`);
    const classes = list(row.classes);
    if (classes.length === 0) say('"classes" tiene que decir qué clases lo aprenden.');
    if (Array.isArray(context.classIds)) {
        for (const id of classes) if (!context.classIds.includes(id)) say(`"classes" dice "${id}", que no es una clase de clases.json.`);
    }
    if (!CASTING_TIMES.includes(text(row.castingTime))) say(`"castingTime" dice "${text(row.castingTime)}". Vale: ${CASTING_TIMES.join(', ')}.`);
    if (!(Number(row.rangeFeet) >= 0)) say('"rangeFeet" tiene que ser un número de pies (0 es uno mismo; 5, tocar).');
    const rounds = durationRounds(row.duration);
    if (Number.isNaN(rounds)) say(`"duration" dice "${text(row.duration)}", que no se entiende. Vale: instantáneo, 1 ronda, 1 minuto, 10 minutos, 1 hora, 8 horas, 24 horas, hasta que se disipe, permanente.`);
    if (row.concentration && rounds === 0) say('pide concentración y es instantáneo: no hay nada que mantener.');
    for (const flag of ['concentration', 'ritual', 'addModifier', 'drain', 'repeatSave', 'stabilizes', 'dispels']) {
        if (row[flag] !== undefined && typeof row[flag] !== 'boolean') say(`"${flag}" es true o false.`);
    }
    if (row.combat !== undefined && row.combat !== false) say('"combat" solo se escribe como false (no sirve peleando).');
    if (row.ritual && level === 0) say('un truco no es un ritual: ya se lanza gratis.');
    if (!text(row.note)) say('falta "note": dos líneas, con tus palabras, de lo que hace.');
    else if (text(row.note).length > 220) say('"note" es larga: que se lea de un vistazo (220 letras como mucho).');

    const target = text(row.target);
    if (!SPELL_TARGETS.includes(target)) say(`"target" dice "${target}". Vale: ${SPELL_TARGETS.join(', ')}.`);
    for (const key of ['targets', 'rays', 'teleportFeet', 'pushFeet', 'maxHpBonus', 'conditionRounds']) {
        if (row[key] !== undefined && !(Number.isInteger(Number(row[key])) && Number(row[key]) >= 0)) say(`"${key}" tiene que ser un número entero.`);
    }
    if (row.area !== undefined && !AREA_SHAPES.includes(text(row.area?.shape))) say(`el área dice "${text(row.area?.shape)}". Vale: ${AREA_SHAPES.join(', ')}.`);

    const save = text(row.save);
    const attack = text(row.attack);
    if (save && !SAVE_ABILITIES.includes(save)) say(`"save" dice "${save}". Vale: ${SAVE_ABILITIES.join(', ')}.`);
    if (attack && !['melee', 'ranged'].includes(attack)) say(`"attack" dice "${attack}". Vale: melee, ranged.`);
    if (save && attack) say('trae "save" y "attack": o se salva o se tira ataque, no las dos.');
    if (row.onSave !== undefined && (!save || !['half', 'none'].includes(text(row.onSave)))) say('"onSave" (half o none) solo va con "save".');

    for (const key of ['damage', 'healing', 'hpPool']) {
        if (row[key] !== undefined && !isFormula(row[key])) say(`"${key}" dice "${text(row[key])}", que no es una fórmula de dados («2d6», «1d4+1»).`);
    }
    if (text(row.damage) && !Object.hasOwn(DAMAGE_TYPES, text(row.damageType))) say(`"damageType" dice "${text(row.damageType)}". Vale: ${Object.keys(DAMAGE_TYPES).join(', ')}.`);
    if (!text(row.damage) && row.damageType !== undefined) say('trae "damageType" y no hace daño.');
    if (row.addModifier && !text(row.damage) && !text(row.healing)) say('"addModifier" suma a un daño o a una cura, y no tiene ninguno.');

    const condition = text(row.condition);
    if (condition && !KNOWN_CONDITIONS.includes(condition)) say(`"condition" dice "${condition}", que el motor no conoce. Vale: ${KNOWN_CONDITIONS.join(', ')}.`);
    for (const removed of list(row.removes)) {
        if (!KNOWN_CONDITIONS.includes(removed)) say(`"removes" dice "${removed}", que el motor no conoce.`);
    }
    // Fuera del combate (una charla, un caso) la salvación decide la escena, no el tablero.
    if (save && !text(row.damage) && !condition && !row.pushFeet && !row.zone && row.combat !== false) {
        say('se salva de nada: ni daño, ni estado, ni empujón, ni zona.');
    }
    if (text(row.healing) && target === 'enemy') say('cura, y apunta a un enemigo.');
    if (text(row.damage) && target === 'ally') say('hace daño, y apunta a un aliado.');

    if (row.upcast !== undefined) {
        if (level === 0) say('un truco no sube con espacio: sube solo, con el nivel del personaje.');
        if (!row.upcast || typeof row.upcast !== 'object' || Array.isArray(row.upcast)) say('"upcast" tiene que ser un objeto.');
        else {
            for (const [key, value] of Object.entries(row.upcast)) {
                const kind = /** @type {Record<string, string>} */ (UPCAST_KEYS)[key];
                if (!kind) say(`"upcast.${key}" no existe. Vale: ${Object.keys(UPCAST_KEYS).join(', ')}.`);
                else if (kind === 'formula' && !isFormula(value)) say(`"upcast.${key}" tiene que ser una fórmula de dados.`);
                else if (kind === 'number' && !(Number.isInteger(Number(value)) && Number(value) > 0)) say(`"upcast.${key}" tiene que ser un número entero, 1 o más.`);
            }
        }
    }

    const components = list(row.components).map(c => c.toUpperCase());
    if (components.length === 0) say('"components" tiene que decir cuáles: V (palabras), S (gestos), M (material).');
    for (const c of components) if (!['V', 'S', 'M'].includes(c)) say(`"components" dice "${c}". Vale: V, S, M.`);
    if (row.material !== undefined) {
        if (!components.includes('M')) say('trae "material" y no tiene M en "components".');
        if (!text(row.material?.name)) say('"material" tiene que decir qué es ("name").');
        if (row.material?.costGp !== undefined && !(Number(row.material.costGp) >= 0)) say('"material.costGp" tiene que ser un número de monedas de oro.');
    }

    const castingTime = text(row.castingTime);
    if (row.reaction !== undefined) {
        if (castingTime !== 'reaction') say('trae "reaction" y no se lanza como reacción ("castingTime": "reaction").');
        if (!REACTION_TRIGGERS.includes(text(row.reaction?.on))) say(`"reaction.on" dice "${text(row.reaction?.on)}". Vale: ${REACTION_TRIGGERS.join(', ')}.`);
        if (!REACTION_EFFECTS.includes(text(row.reaction?.effect))) say(`"reaction.effect" dice "${text(row.reaction?.effect)}". Vale: ${REACTION_EFFECTS.join(', ')}.`);
    } else if (castingTime === 'reaction') {
        say('se lanza como reacción y no dice cuándo ("reaction").');
    }

    if (row.zone !== undefined) {
        if (!Object.hasOwn(ZONE_KINDS, text(row.zone?.kind))) say(`"zone.kind" dice "${text(row.zone?.kind)}". Vale: ${Object.keys(ZONE_KINDS).join(', ')}.`);
        for (const trigger of list(row.zone?.triggers)) {
            if (!ZONE_TRIGGERS.includes(trigger)) say(`"zone.triggers" dice "${trigger}". Vale: ${ZONE_TRIGGERS.join(', ')}.`);
        }
        if (rounds === 0) say('deja una zona y es instantáneo: la zona no duraría nada.');
    }
    if (row.summon !== undefined) {
        for (const problem of validateSummon(row.summon, { creatureIds: context.creatureIds })) say(problem);
        if (row.summon?.duration !== undefined && Number.isNaN(durationRounds(row.summon.duration))) say('"summon.duration" no se entiende.');
    }
    for (const kind of list(row.clearsZones)) {
        if (!Object.hasOwn(ZONE_KINDS, kind)) say(`"clearsZones" dice "${kind}", que no es un tipo de zona.`);
    }
    if (row.ac !== undefined) {
        const ac = row.ac ?? {};
        if (!['bonus', 'min', 'base'].some(key => Number(ac[key]) > 0)) say('"ac" tiene que decir "bonus", "min" o "base".');
    }
    if (row.revives !== undefined && !(Number(row.revives?.hp) >= 1)) say('"revives" tiene que decir con cuántos puntos de vida vuelve ("hp").');
    if (row.creates !== undefined && !text(row.creates?.item)) say('"creates" tiene que decir qué objeto sale ("item").');
    if (row.again !== undefined && !['action', 'bonus'].includes(text(row.again))) say('"again" es action o bonus.');
    if (row.element !== undefined && !Object.hasOwn(ELEMENTS, text(row.element).toLowerCase())) say(`"element" dice "${text(row.element)}". Vale: ${Object.keys(ELEMENTS).join(', ')}.`);
    if (row.aliases !== undefined && !Array.isArray(row.aliases)) say('"aliases" tiene que ser una lista de ids.');

    return errors;
}

/**
 * Lo que impide usar el archivo entero: cada fila, los ids repetidos y la continuidad con
 * el grimorio de la capa ligera. Un conjuro que se llama como uno del grimorio **tiene que
 * llevar su id** (o tenerlo en `aliases`): quien lo sabía con la capa ligera lo sigue
 * sabiendo con la de 5e.
 *
 * @param {any[]} rows
 * @param {{classIds?: string[], creatureIds?: string[]}} [context]
 * @returns {string[]}
 */
export function validateSpells(rows, context = {}) {
    const all = Array.isArray(rows) ? rows : [];
    /** @type {string[]} */
    const errors = [];
    const seen = new Set();
    const byName = new Map(GRIMOIRE.map(spell => [plain(spell.name), spell]));
    for (const row of all) {
        errors.push(...validateSpell(row, context));
        const id = text(row?.id);
        if (seen.has(id)) errors.push(`${text(row?.name) || id}: el id "${id}" está repetido.`);
        seen.add(id);
        const twin = byName.get(plain(row?.name));
        if (twin && twin.id !== id && !list(row?.aliases).includes(twin.id)) {
            errors.push(`${text(row?.name)}: se llama como «${twin.name}» del grimorio; usa su id (${twin.id}) para que quien lo sabía lo siga sabiendo.`);
        }
        // Un id del grimorio con otro nombre sí vale: es la versión de 5e de uno de la capa
        // ligera («Zarzas» es Enredar). Lo que no vale es un id nuevo que empiece como los suyos.
        if (!spellById(id) && /^(hab|mag)-/.test(id)) {
            errors.push(`${text(row?.name)}: los ids "hab-" y "mag-" son del grimorio; uno nuevo empieza por "conj-".`);
        }
    }
    return errors;
}

/**
 * Los conjuros de una clase, en el orden del archivo.
 *
 * @param {Spell[]} spells Normalizados.
 * @param {string} classId El `list` de su `casting` (o su id).
 * @param {{level?: number, maxLevel?: number}} [filter]
 * @returns {Spell[]}
 */
export function spellsOfClass(spells, classId, filter = {}) {
    const wanted = text(classId);
    return (Array.isArray(spells) ? spells : []).filter(spell => spell.classes.includes(wanted)
        && (filter.level === undefined || spell.level === filter.level)
        && (filter.maxLevel === undefined || spell.level <= filter.maxLevel));
}

/**
 * Un conjuro por su id o por uno de sus alias.
 *
 * @param {Spell[]} spells
 * @param {string} id
 * @returns {Spell|null}
 */
export function findSpell(spells, id) {
    const wanted = text(id);
    return (Array.isArray(spells) ? spells : []).find(spell => spell.id === wanted || spell.aliases.includes(wanted)) ?? null;
}
