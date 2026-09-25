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

/**
 * Las frases de las opiniones, por lo que mueve a cada uno y por caso. Seis por caso, para
 * que un compañero no diga lo mismo en el tercer encargo.
 */
export const OPINIONS = {
    coin: {
        rich: ['Eso paga bien. Me apunto.', 'Con eso comemos un mes. Vamos.', 'Ahora sí hablamos el mismo idioma.',
            'Buena bolsa. Que no se nos escape.', 'Por ese dinero, hasta madrugo.', 'Me gusta cómo suena esa cifra.'],
        poor: ['¿Por esta miseria? Ya hablaremos del reparto.', 'Eso no paga ni las botas que vamos a gastar.',
            'Trabajar gratis tiene otro nombre.', 'Alguien se está riendo de nosotros con ese precio.',
            'Luego no me pidáis que invite a la ronda.', 'Si vamos a pasar hambre, que sea por algo.'],
    },
    glory: {
        fight: ['¡Esto lo cantarán en la posada!', 'Por fin algo digno de contarse.', 'Que se sepa quién lo hizo.',
            'Así se gana un nombre.', 'Me tiemblan las manos, y no es de miedo.', 'Esto sí es un encargo.'],
        errand: ['¿Recados? Vaya gloria.', 'Nadie escribe canciones sobre esto.', 'Para esto me quedaba en casa.',
            'Lo haré, pero que no se entere nadie.', 'Qué hazaña. Qué emoción.', 'Me estoy oxidando, que lo sepáis.'],
    },
    blood: {
        fight: ['Por fin algo con dientes.', 'Bien. Tenía ganas de romper algo.', 'Que vengan cuantos quieran.',
            'Esto ya me gusta más.', 'Afilad el acero, que hay faena.', 'Hoy no me voy a dormir con hambre.'],
        errand: ['¿Y a quién le parto la cara en esto?', 'Mucho paseo y poca pelea.', 'Despertadme cuando haya sangre.',
            'Esto es de mensajeros, no de gente como yo.', 'Me aburro solo de oírlo.', 'Si hay que pegar a alguien, avisad.'],
    },
    quiet: {
        calm: ['Sin sangre. Así da gusto.', 'Esto sí que me gusta: nadie tiene por qué morir.', 'Por una vez, algo tranquilo.',
            'Hablar antes que pelear. Bien.', 'Así se hacen las cosas.', 'Un día sin enterrar a nadie. Me vale.'],
        dirty: ['Esto no me gusta nada. Nada.', 'No es la clase de gente que quiero ser.', 'Lo haré, pero que conste que no.',
            'Esto nos va a perseguir, ya veréis.', 'Hay trabajos que no se lavan.', '¿De verdad hemos llegado a esto?'],
        slaughter: ['Otra carnicería...', 'Siempre acabamos igual: con las manos rojas.', '¿No hay otra forma?',
            'Contad conmigo, pero no me pidáis que me guste.', 'Esto se va a torcer. Siempre se tuerce.', 'Qué cansancio de sangre.'],
    },
    knowledge: {
        curious: ['Quiero ver qué hay ahí. De verdad.', 'Esto huele a algo que nadie ha escrito todavía.', 'Por fin una pregunta interesante.',
            'Llevaré papel. Mucho papel.', 'Hay algo detrás de esto, estoy segura.', 'Me pica la curiosidad. Vamos.'],
    },
};

/**
 * Lo que opina cada uno de un encargo, al aceptarlo (idea 27).
 *
 * Tampoco cuesta tokens. Quien va por el oro mira la paga; quien busca gloria, si hay
 * pelea; quien quiere tranquilidad, si no la hay. Lo que no le importa no lo comenta: un
 * compañero que opina de todo deja de decir nada. Y no repite la frase que acaba de decir.
 *
 * @param {string} wants
 * @param {{kind?: string, noFight?: boolean, reward?: number, difficulty?: number}} contract
 * @param {{random?: () => number, last?: string}} [options]
 * @returns {{mood: 'like'|'dislike', line: string}|null}
 */
export function opinionOf(wants, contract, { random = Math.random, last = '' } = {}) {
    const kind = text(contract?.kind);
    const reward = Number(contract?.reward) || 0;
    const fight = !contract?.noFight && Number(contract?.difficulty ?? 1) > 0;
    const dirty = kind === 'steal' || kind === 'silence';

    /** @param {'like'|'dislike'} mood @param {string[]} lines */
    const pick = (mood, lines) => {
        const pool = lines.filter(line => line !== last);
        const from = pool.length > 0 ? pool : lines;
        return { mood, line: from[Math.floor(random() * from.length) % from.length] };
    };

    switch (text(wants)) {
        case 'coin':
            if (reward >= 40) return pick('like', OPINIONS.coin.rich);
            if (reward > 0 && reward < 15) return pick('dislike', OPINIONS.coin.poor);
            return null;
        case 'glory':
            if (fight && (kind === 'hunt' || kind === 'hold')) return pick('like', OPINIONS.glory.fight);
            if (!fight) return pick('dislike', OPINIONS.glory.errand);
            return null;
        case 'blood':
            if (fight) return pick('like', OPINIONS.blood.fight);
            return pick('dislike', OPINIONS.blood.errand);
        case 'quiet':
            if (dirty) return pick('dislike', OPINIONS.quiet.dirty);
            if (!fight) return pick('like', OPINIONS.quiet.calm);
            if (kind === 'cull') return pick('dislike', OPINIONS.quiet.slaughter);
            return null;
        case 'knowledge':
            if (kind === 'recover' || !fight) return pick('like', OPINIONS.knowledge.curious);
            return null;
        default:
            return null;
    }
}

/**
 * Lo que mueve a un confidente, cuando su ficha no lo dice.
 *
 * Quien va por el oro, oro. Quien va por el vinculo, lo que pide su oficio: el soldado,
 * gloria; la picara, sangre; la exploradora y el clerigo, tranquilidad; el mago, saber.
 * Sin esto todos contaban como «oro» y solo opinaban de la paga.
 *
 * @param {{motive?: string, className?: string, wants?: string}} who
 * @returns {string}
 */
export function wantsOf(who) {
    const said = text(who?.wants);
    if (['coin', 'glory', 'blood', 'quiet', 'knowledge'].includes(said)) return said;
    if (text(who?.motive) === 'coin') return 'coin';
    const kind = text(who?.className).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/guerr|soldad|paladin|caballer/.test(kind)) return 'glory';
    if (/picar|ladron|asesin|barbar/.test(kind)) return 'blood';
    if (/explor|druid|cleri|sacerd|monj/.test(kind)) return 'quiet';
    if (/mago|maga|brujo|bruja|hechicer|erudit|alquim/.test(kind)) return 'knowledge';
    return 'glory';
}

/** Cuándo habla un enemigo, por suceso (idea 190). Menos que los tuyos: el ruido cansa. */
export const ENEMY_CHANCE = { hit: 0.25, hurt: 0.35, ally_down: 0.5, surrender: 1 };

/** Lo que gritan los enemigos, por cómo pelean. Sin llamar al modelo. */
export const ENEMY_BARKS = {
    aggressive: {
        hit: ['¡Otra más!', '¡Sangra, perro!', '¡Eso por venir aquí!'],
        hurt: ['¡Me las pagarás!', 'Eso... no ha dolido.', '¡Tenedlo quieto!'],
        ally_down: ['¡Han matado a uno! ¡A por ellos!', '¡Vengadle!'],
        surrender: ['¡Basta! ¡Me rindo!', '¡Vale, vale! ¡No más!'],
    },
    guardian: {
        hit: ['No pasaréis de aquí.', 'Atrás.', 'Aquí se acaba vuestro camino.'],
        hurt: ['Aguanto.', 'Todavía estoy en pie.', 'Cerrad filas.'],
        ally_down: ['¡Cerrad el hueco!', '¡Mantened la línea!'],
        surrender: ['Bajo el arma. Se acabó.', 'No vale la pena morir por esto.'],
    },
    skirmisher: {
        hit: ['¡Demasiado lento!', '¡Por aquí!', '¡Ja! ¿Y ahora?'],
        hurt: ['¡Me ha dado!', '¡Separaos!', '¡Cuidado con ese!'],
        ally_down: ['¡Esto se tuerce!', '¡Dispersaos!'],
        surrender: ['¡Me rindo, me rindo!', '¡No disparéis!'],
    },
    coward: {
        hit: ['¡Toma! ¡Toma!', '¿L-le he dado?'],
        hurt: ['¡No, no, no!', '¡Que alguien me ayude!', '¡Yo no quería esto!'],
        ally_down: ['¡Lo han matado! ¡Nos van a matar a todos!', '¡Corred!'],
        surrender: ['¡Piedad! ¡Tengo familia!', '¡Me rindo! ¡Por favor!'],
    },
    boss: {
        hit: ['¿Esto es todo lo que traéis?', 'Arrodillaos.', 'Os lo advertí.'],
        hurt: ['Interesante. Sangráis bien para ser tan pocos.', '¡Ahora me habéis enfadado!', 'No será suficiente.'],
        ally_down: ['Inútiles. Tendré que hacerlo yo.', 'Uno menos a quien pagar.'],
        surrender: ['...'],
    },
};

/**
 * Si un enemigo grita algo, y qué.
 *
 * @param {Object} input
 * @param {string} input.event Uno de los de `ENEMY_CHANCE`.
 * @param {string} [input.profile] Cómo pelea (aggressive, guardian, skirmisher, coward).
 * @param {boolean} [input.boss]
 * @param {string} [input.last]
 * @param {() => number} input.random
 * @returns {string}
 */
export function chooseEnemyBark({ event, profile = '', boss = false, last = '', random }) {
    const chance = ENEMY_CHANCE[/** @type {keyof typeof ENEMY_CHANCE} */ (event)];
    if (chance === undefined || random() >= chance) return '';
    const key = boss ? 'boss' : (text(profile) in ENEMY_BARKS ? text(profile) : 'aggressive');
    const set = ENEMY_BARKS[/** @type {keyof typeof ENEMY_BARKS} */ (key)];
    const lines = (set[/** @type {keyof typeof set} */ (event)] ?? []).filter(line => line !== last);
    if (lines.length === 0) return '';
    return lines[Math.floor(random() * lines.length) % lines.length];
}
