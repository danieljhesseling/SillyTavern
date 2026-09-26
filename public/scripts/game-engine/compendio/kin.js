/**
 * De que esta hecha la gente y a que se dedica: razas y clases.
 *
 * Hasta aqui las dos eran **texto libre**. La lista que ofrecia la pantalla de personaje se
 * sacaba de los personajes que ya existian, asi que en un mundo nuevo estaba vacia: escribias
 * «enano» y no pasaba nada — ni un punto de mas, ni uno de menos—. Elegir raza era ponerle
 * una etiqueta a la ficha.
 *
 * Aqui no hay mecanismo nuevo: los `effects` son **la misma forma que ya usan los objetos**,
 * `{ stat, modifier }` sobre las caracteristicas del motor. Lo que faltaba no era el
 * mecanismo, era que alguien lo leyera al crear el personaje.
 *
 * Y la regla que las convierte en decisiones:
 *
 * > **Cada una quita algo.** Una raza que solo suma se elige siempre, y entonces no hay nada
 * > que elegir.
 *
 * Puro: recibe el compendio y una ficha, y devuelve numeros y frases.
 *
 * Ver wiki/archivo/ROADMAP_CREACION.md, T4.
 */

/** Lo que una raza o una clase puede tocar. Vocabulario cerrado del motor. */
export const KIN_STATS = [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
    'speed', 'maxHp', 'armorClass',
];

/** Como se llama cada una donde se lee, que no es como se llama en el codigo. */
export const STAT_LABELS = {
    strength: 'Fuerza',
    dexterity: 'Destreza',
    constitution: 'Constitución',
    intelligence: 'Inteligencia',
    wisdom: 'Sabiduría',
    charisma: 'Carisma',
    speed: 'Velocidad',
    maxHp: 'Vida',
    armorClass: 'Defensa',
};

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Los efectos de una fila, ya limpios.
 *
 * @param {any} row
 * @returns {Array<{stat: string, modifier: number}>}
 */
export function effectsOf(row) {
    return (Array.isArray(row?.effects) ? row.effects : [])
        .map((/** @type {any} */ effect) => ({
            stat: text(effect?.stat),
            modifier: Math.round(number(effect?.modifier, 0)),
        }))
        .filter(effect => KIN_STATS.includes(effect.stat) && effect.modifier !== 0);
}

/**
 * Las razas que la bateria trae.
 *
 * @param {any} compendium
 * @returns {any[]}
 */
export function racesOf(compendium) {
    if (!compendium?.has?.('razas')) return [];
    return compendium.find('razas', { kind: 'raza' });
}

/**
 * Las clases que la bateria trae.
 *
 * Se llama asi y no `classesOf` porque ya hay una en `skills.js` que responde otra cosa:
 * alli son las clases que **tienen habilidades escritas**, aqui las que existen. Dos
 * preguntas parecidas con la misma respuesta serian dos sitios donde arreglar lo mismo.
 *
 * @param {any} compendium
 * @returns {any[]}
 */
export function kindsOf(compendium) {
    if (!compendium?.has?.('clases')) return [];
    return compendium.find('clases', { kind: 'clase' });
}

/**
 * Lo que impide usar una fila de raza o de clase.
 *
 * @param {any} compendium
 * @returns {string[]}
 */
export function validateKin(compendium) {
    /** @type {string[]} */
    const errors = [];

    for (const [domain, rows] of [['razas', racesOf(compendium)], ['clases', kindsOf(compendium)]]) {
        for (const row of /** @type {any[]} */ (rows)) {
            const name = text(row?.name) || text(row?.id) || '(sin nombre)';

            // Un nombre de caracteristica mal escrito no da error: se queda en un efecto
            // que nadie aplica, y eso no se ve hasta media campana despues.
            for (const effect of (Array.isArray(row?.effects) ? row.effects : [])) {
                if (!KIN_STATS.includes(text(effect?.stat))) {
                    errors.push(`${name}: "${text(effect?.stat)}" no es una característica. `
                        + `Vale: ${KIN_STATS.join(', ')}.`);
                }
            }

            const all = effectsOf(row);
            if (all.length === 0) {
                errors.push(`${name}: no da nada ni quita nada, así que elegirlo no significa nada.`);
                continue;
            }
            // La regla que las convierte en decisiones.
            if (!all.some(effect => effect.modifier < 0)) {
                errors.push(`${name}: solo suma. Algo tiene que quitar, o se elige siempre.`);
            }
            if (domain === 'clases' && !/^\d+d\d+$/.test(text(row?.hitDie))) {
                errors.push(`${name}: una clase tiene que decir su dado de golpe ("hitDie").`);
            }
        }
    }

    return errors;
}

/**
 * Lo que una raza y una clase le hacen a una ficha.
 *
 * Devuelve las caracteristicas ya sumadas **y de donde sale cada cambio**, porque un numero
 * que aparece en una ficha sin poder explicarlo se siente como un error del juego.
 *
 * @param {Object} input
 * @param {any} input.sheet Lo que ya tiene: fuerza, destreza…
 * @param {any} [input.race]
 * @param {any} [input.kind] La clase.
 * @returns {{stats: Record<string, number>, lines: string[]}}
 */
export function applyKin({ sheet, race = null, kind = null }) {
    /** @type {Record<string, number>} */
    const stats = {};
    for (const stat of KIN_STATS) {
        if (sheet?.[stat] !== undefined) stats[stat] = number(sheet[stat], 0);
    }

    /** @type {string[]} */
    const lines = [];

    for (const row of [race, kind].filter(Boolean)) {
        const said = [];
        for (const effect of effectsOf(row)) {
            // Lo que la ficha no tiene no se inventa: una raza que toque la velocidad de
            // algo que no anda no deberia crear el campo.
            if (stats[effect.stat] === undefined) continue;
            stats[effect.stat] += effect.modifier;
            said.push(`${effect.modifier > 0 ? '+' : ''}${effect.modifier} ${STAT_LABELS[effect.stat]}`);
        }
        if (said.length > 0) lines.push(`${text(row.name)}: ${said.join(', ')}`);
    }

    return { stats, lines };
}

/**
 * Una raza o una clase en una linea, para la tarjeta.
 *
 * @param {any} row
 * @returns {string}
 */
export function describeKin(row) {
    if (!row) return '';
    const said = effectsOf(row)
        .map(effect => `${effect.modifier > 0 ? '+' : ''}${effect.modifier} ${STAT_LABELS[effect.stat]}`);

    return [text(row.hitDie), said.join(', ')].filter(Boolean).join(' · ');
}
