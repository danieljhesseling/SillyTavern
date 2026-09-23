/**
 * Las tiradas de habilidad fuera de combate: las tira el motor, el narrador lee el resultado.
 *
 * Sin esto, la mitad de la ficha de 5e no hacía nada. Si el éxito de convencer a un guardia
 * dependía solo de lo bien que escribieras, el Carisma 18 del bardo era un número de
 * adorno, y la build del personaje solo importaba para pegar espadazos.
 *
 * D6 decidió que el narrador **no pida** tiradas: le cuesta tokens en cada turno y hay que
 * fiarse de que obedezca. Esto le da la vuelta sin ninguno de los dos problemas: **quien
 * juega** elige intentarlo, el dado se tira aquí, en el navegador, y al modelo solo le
 * llega una línea con el resultado ya decidido, dentro del propio mensaje. Cuesta unos
 * quince tokens y solo en los turnos en que se tira.
 *
 * Una tirada por mensaje: tirar, no gustarte el resultado y volver a tirar sería elegir el
 * resultado con más pasos.
 *
 * Puro: tira con el dado que le den y no toca nada.
 */

/**
 * Las habilidades que se pueden intentar, con su característica.
 *
 * No están las dieciocho: solo las que tienen sentido pulsando un botón en mitad de una
 * escena. Las de saber (Historia, Arcanos…) son preguntas al narrador, no intentos.
 */
export const SKILLS = {
    persuasion: { label: 'Persuasión', ability: 'charisma', verb: 'Intento convencer', icon: 'fa-handshake' },
    deception: { label: 'Engaño', ability: 'charisma', verb: 'Intento engañar', icon: 'fa-mask' },
    intimidation: { label: 'Intimidación', ability: 'charisma', verb: 'Intento intimidar', icon: 'fa-hand-fist' },
    insight: { label: 'Perspicacia', ability: 'wisdom', verb: 'Intento calar', icon: 'fa-eye' },
    perception: { label: 'Percepción', ability: 'wisdom', verb: 'Miro con atención', icon: 'fa-binoculars' },
    investigation: { label: 'Investigación', ability: 'intelligence', verb: 'Registro con cuidado', icon: 'fa-magnifying-glass' },
    stealth: { label: 'Sigilo', ability: 'dexterity', verb: 'Intento pasar sin que me vean', icon: 'fa-user-ninja' },
    athletics: { label: 'Atletismo', ability: 'strength', verb: 'Intento a pulso', icon: 'fa-dumbbell' },
};

/**
 * En qué es competente cada clase.
 *
 * Una lista corta y fija, de las que da el manual a elegir. No es la ficha completa de
 * 5e —el motor no guarda qué competencias eligió cada uno—, pero es la diferencia entre
 * que un pícaro y un guerrero intenten engañar igual o no.
 */
const CLASS_SKILLS = {
    rogue: ['deception', 'stealth', 'perception', 'investigation', 'insight'],
    bard: ['persuasion', 'deception', 'insight', 'perception'],
    paladin: ['persuasion', 'intimidation', 'athletics'],
    fighter: ['athletics', 'intimidation', 'perception'],
    barbarian: ['athletics', 'intimidation', 'perception'],
    ranger: ['stealth', 'perception', 'athletics'],
    cleric: ['insight', 'persuasion'],
    wizard: ['investigation', 'insight'],
    warlock: ['deception', 'intimidation'],
    sorcerer: ['persuasion', 'deception'],
    druid: ['perception', 'insight'],
    monk: ['athletics', 'stealth', 'insight'],
};

/** Cómo se llama cada clase, en las dos lenguas que puede traer una ficha. */
const CLASS_NAMES = {
    rogue: ['rogue', 'picaro', 'pícaro', 'ladron', 'ladrón'],
    bard: ['bard', 'bardo'],
    paladin: ['paladin', 'paladín'],
    fighter: ['fighter', 'guerrero', 'guerrera'],
    barbarian: ['barbarian', 'barbaro', 'bárbaro', 'barbara', 'bárbara'],
    ranger: ['ranger', 'explorador', 'exploradora', 'montaraz'],
    cleric: ['cleric', 'clerigo', 'clérigo', 'clériga', 'sacerdote', 'sacerdotisa'],
    wizard: ['wizard', 'mago', 'maga'],
    warlock: ['warlock', 'brujo', 'bruja'],
    sorcerer: ['sorcerer', 'hechicero', 'hechicera'],
    druid: ['druid', 'druida'],
    monk: ['monk', 'monje', 'monja'],
};

/** Lo difícil de un intento normal: ni fácil (10) ni difícil (15). */
export const DEFAULT_DC = 12;

/**
 * @param {string} className
 * @returns {string} La clave de la clase, o vacío.
 */
function classKey(className) {
    const name = String(className ?? '').trim().toLowerCase();
    for (const [key, names] of Object.entries(CLASS_NAMES)) {
        if (names.some(n => name === n || name.startsWith(`${n} `))) return key;
    }
    return '';
}

/** @param {number} level */
export function proficiencyBonus(level) {
    return 2 + Math.floor((Math.max(1, Math.floor(Number(level) || 1)) - 1) / 4);
}

/**
 * Lo que suma alguien a una habilidad: su característica, y su competencia si la tiene.
 *
 * @param {any} member
 * @param {string} skill
 * @returns {{modifier: number, proficient: boolean}}
 */
export function skillModifier(member, skill) {
    const def = SKILLS[/** @type {keyof typeof SKILLS} */ (skill)];
    if (!def) return { modifier: 0, proficient: false };
    const score = Number(member?.[def.ability]) || 10;
    const ability = Math.floor((score - 10) / 2);
    const key = classKey(member?.class);
    const proficient = Boolean(key && CLASS_SKILLS[/** @type {keyof typeof CLASS_SKILLS} */ (key)].includes(skill));
    return { modifier: ability + (proficient ? proficiencyBonus(member?.level) : 0), proficient };
}

/**
 * La lista para el botón de tiradas, con lo que suma cada una a la vista.
 *
 * @param {any} member
 * @param {{locked?: boolean}} [state] Si ya hay una tirada esperando a que se envíe.
 * @returns {Array<{id: string, label: string, icon: string, detail: string, enabled: boolean}>}
 */
export function checkOptions(member, { locked = false } = {}) {
    if (!member) return [];
    return Object.entries(SKILLS).map(([id, def]) => {
        const { modifier, proficient } = skillModifier(member, id);
        const sign = modifier >= 0 ? '+' : '';
        return {
            id,
            label: `${def.label} ${sign}${modifier}`,
            icon: def.icon,
            detail: locked
                ? 'Ya has tirado: envía el mensaje antes de intentar otra cosa.'
                : `${proficient ? 'Se le da bien. ' : ''}d20 ${sign}${modifier} contra CD ${DEFAULT_DC}.`,
            enabled: !locked,
        };
    });
}

/**
 * La tirada.
 *
 * El 20 natural siempre sale y el 1 siempre falla: no es la regla estricta de 5e para
 * habilidades, pero es la que se juega en casi todas las mesas y la que el jugador espera
 * ver cuando le sale un 20.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.skill
 * @param {() => number} input.rollD20
 * @param {number} [input.dc]
 * @returns {{skill: string, label: string, natural: number, modifier: number, total: number, dc: number, success: boolean, line: string, draft: string}|null}
 */
export function rollCheck({ member, skill, rollD20, dc = DEFAULT_DC }) {
    const def = SKILLS[/** @type {keyof typeof SKILLS} */ (skill)];
    if (!def || !member) return null;
    const { modifier } = skillModifier(member, skill);
    const natural = Math.max(1, Math.min(20, Math.floor(Number(rollD20()) || 1)));
    const total = natural + modifier;
    const success = natural === 20 || (natural !== 1 && total >= dc);
    const sign = modifier >= 0 ? '+' : '';
    const verdict = natural === 20 ? 'Éxito rotundo' : natural === 1 ? 'Fallo rotundo' : (success ? 'Éxito' : 'Fallo');
    const name = String(member?.name || 'Alguien');

    // Lo lee el modelo: tiene que ser corto, sin ambigüedad, y decir que no se discute.
    const line = `[TIRADA ${def.label} de ${name}: d20 ${natural} ${sign}${modifier} = ${total} contra CD ${dc} → ${verdict}. `
        + 'El dado ya está tirado: narra la consecuencia, no lo cambies.]';

    return {
        skill,
        label: def.label,
        natural,
        modifier,
        total,
        dc,
        success,
        line,
        draft: `${line}\n${def.verb} `,
    };
}
