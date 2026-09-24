/**
 * Lo que dicen los compañeros en combate, sin llamar al modelo (C7).
 *
 * Un compañero que pega en silencio parece un autómata. Un bocadillo sobre su ficha —«¡Eso
 * te enseñará!», «¡Lyra, aguanta!»— le da personalidad al momento, como en Fire Emblem o
 * Darkest Dungeon, y **no cuesta ni un token**: son frases escritas, elegidas por el motor.
 *
 * Cada compañero habla según lo que le mueve (`wants`: oro, gloria, sangre, tranquilidad o
 * saber), y cada suceso tiene sus frases. Para que no canse:
 *
 * - no habla siempre: un golpe normal, a veces; un crítico o alguien que cae, casi siempre;
 * - no repite la frase que acaba de decir.
 *
 * Puro: elige una frase y dice si toca. Quien llama la pinta.
 */

/** Cuándo habla, por suceso: la probabilidad. */
export const CHANCE = { hit: 0.35, crit: 0.9, kill: 0.6, ally_down: 1, hurt: 0.5, victory: 0.8 };

/**
 * Las frases, por lo que mueve a cada uno y por suceso. `{name}` es el nombre de quien cae
 * (en `ally_down`).
 */
export const BARKS = {
    coin: {
        hit: ['Esto se cobra aparte.', '¡A cuenta!', 'Otro que me debe.'],
        crit: ['¡Eso vale el doble!', '¡Pagado y bien pagado!'],
        kill: ['Uno menos que repartir.', 'Y ese no cobra más.'],
        ally_down: ['¡{name}! ¡Que alguien la levante, que aún no ha pagado su ronda!', '¡{name}, no te me mueras con deudas!'],
        hurt: ['Esto no entraba en el precio.', 'Por esta miseria no me dejo matar.'],
        victory: ['¿Cuánto llevaban encima?', 'A ver qué dejan.'],
    },
    glory: {
        hit: ['¡Por la compañía!', '¡Aquí estoy!', '¡Otra vez!'],
        crit: ['¡Que lo canten en la posada!', '¡Eso es un golpe!'],
        kill: ['¡Que venga el siguiente!', '¡Uno más para la cuenta!'],
        ally_down: ['¡{name}, aguanta!', '¡A mí, que {name} ha caído!'],
        hurt: ['¡Eso es todo lo que tenéis?', 'He sangrado por menos.'],
        victory: ['¡Eso contadlo bien!', '¡Victoria!'],
    },
    blood: {
        hit: ['Sangra.', '¡Más!', 'Te tengo.'],
        crit: ['¡Ahí está!', '¡Mira cómo corre!'],
        kill: ['Quieto ya.', 'Uno menos.'],
        ally_down: ['¡{name}! Me las vais a pagar.', '¡Quien ha tocado a {name}!'],
        hurt: ['Eso me ha gustado.', 'Ahora sí.'],
        victory: ['¿Ya está?', 'Se acabó pronto.'],
    },
    quiet: {
        hit: ['Perdona.', 'Quieto…', 'Lo siento.'],
        crit: ['No quería hacerlo tan fuerte.', 'Ya está, ya está.'],
        kill: ['Descansa.', 'Que la tierra te sea leve.'],
        ally_down: ['¡{name}, no! ¡Resiste!', '¡{name}! Que alguien me ayude con {name}.'],
        hurt: ['Duele… sigo.', 'No pasa nada, no pasa nada.'],
        victory: ['Se acabó. Menos mal.', 'Respirad.'],
    },
    knowledge: {
        hit: ['Por el costado, como pensaba.', 'Ahí, en la juntura.'],
        crit: ['Exactamente donde tenía que ser.', 'Precioso.'],
        kill: ['Interesante.', 'Ya no.'],
        ally_down: ['¡{name}! Presión en la herida, ¡ya!', '¡{name} ha caído, cubridla!'],
        hurt: ['Anotado.', 'Eso no estaba en los libros.'],
        victory: ['Habrá que estudiar esto.', 'Lo apunto.'],
    },
};

/** @param {any} value */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Si dice algo, y qué.
 *
 * @param {Object} input
 * @param {string} input.event   Uno de los de `CHANCE`.
 * @param {string} [input.wants] Lo que le mueve. Sin decir, gloria.
 * @param {string} [input.about] De quién habla (el que cae).
 * @param {string} [input.last]  Lo último que dijo, para no repetirlo.
 * @param {() => number} input.random
 * @returns {string} La frase, o vacío si no toca.
 */
export function chooseBark({ event, wants = '', about = '', last = '', random }) {
    const chance = CHANCE[/** @type {keyof typeof CHANCE} */ (event)];
    if (chance === undefined || random() >= chance) return '';
    const set = BARKS[/** @type {keyof typeof BARKS} */ (text(wants))] ?? BARKS.glory;
    const lines = (set[/** @type {keyof typeof set} */ (event)] ?? []).filter(line => line !== last);
    if (lines.length === 0) return '';
    const line = lines[Math.floor(random() * lines.length) % lines.length];
    return line.replaceAll('{name}', text(about) || 'compañero');
}
