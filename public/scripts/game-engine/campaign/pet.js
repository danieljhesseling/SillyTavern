/**
 * La mascota: alguien pequeño que acompaña al héroe, comenta lo que pasa y ayuda sin pelear
 * (R5 del roadmap de profundidad).
 *
 * No ocupa plaza en el grupo, no cobra y no se va por hartazgo: es **del héroe**. Tres cosas
 * la hacen parte del juego y no decorado:
 *
 * 1. **Comenta la historia, gratis.** Reacciona a la crónica (U4): cuando pasa algo del hilo,
 *    del grupo o del mundo, a veces dice algo, de bancos escritos según su carácter. Cero
 *    tokens. Como mucho una frase cada rato, y nunca la misma dos veces seguidas.
 * 2. **Si habla, es la ayuda del juego con cara** (DR5: solo algunas hablan: el cuervo, el
 *    loro, el familiar y el espíritu). Se le pregunta y contesta con lo que el motor sabe: lo
 *    que viene, lo que más aprieta, la pista que falta. Las que no hablan, lo dicen con gestos.
 * 3. **Ayuda sin hacer daño** (DR6): distrae, rastrea o avisa. Y fuera del combate, cada una
 *    a lo suyo: el perro olfatea pistas, el halcón explora, el cuervo roba la atención en una
 *    conversación, y todas hacen guardia.
 *
 * Crece con el vínculo: al rango 2 aprende su segunda forma de ayudar; al 4, la tercera.
 *
 * Puro: datos y decisiones. Quien llama guarda, pinta y cuenta.
 *
 * Ver wiki/ROADMAP_PROFUNDIDAD.md, R5.
 */

/**
 * Las especies. `talks`: si habla (DR5). `sense`: con qué encuentra lo que busca. `support`:
 * sus formas de ayudar en combate, en el orden en que las aprende. `field`: lo que hace fuera
 * del combate.
 */
export const SPECIES = {
    perro: { label: 'perro', talks: false, support: ['avisar', 'distraer', 'rastrear'], field: ['olfato', 'guardia'], note: 'Olfatea lo que se esconde y no duerme de noche.' },
    gato: { label: 'gato', talks: false, support: ['distraer', 'avisar', 'rastrear'], field: ['guardia'], note: 'Ve en la oscuridad y se mete por donde nadie.' },
    zorro: { label: 'zorro', talks: false, support: ['rastrear', 'distraer', 'avisar'], field: ['olfato'], note: 'Encuentra el rastro y el atajo.' },
    halcon: { label: 'halcón', talks: false, support: ['avisar', 'rastrear', 'distraer'], field: ['explora'], note: 'Ve el camino desde arriba: esquiva un contratiempo del viaje.' },
    cuervo: { label: 'cuervo', talks: true, support: ['distraer', 'avisar', 'rastrear'], field: ['labia', 'guardia'], note: 'Grazna frases, y en una conversación roba la atención.' },
    loro: { label: 'loro', talks: true, support: ['distraer', 'avisar', 'rastrear'], field: ['labia'], note: 'Repite lo que oye, a veces en el peor momento.' },
    familiar: { label: 'familiar', talks: true, support: ['rastrear', 'avisar', 'distraer'], field: ['guardia', 'olfato'], note: 'Un espíritu atado a quien sabe magia. Sabe más de lo que dice.' },
    espiritu: { label: 'espíritu', talks: true, support: ['avisar', 'rastrear', 'distraer'], field: ['guardia'], note: 'Un resto de alguien que ya no está. Habla bajito.' },
};

/** Los caracteres, con cómo se dicen. */
export const CHARACTERS = {
    cinica: 'cínica',
    leal: 'leal',
    curiosa: 'curiosa',
    miedosa: 'miedosa',
    orgullosa: 'orgullosa',
};

/** Las formas de ayudar en combate. Ninguna hace daño (DR6). */
export const SUPPORT = {
    avisar: { label: 'Avisar', note: 'Señala a un enemigo: el siguiente golpe del grupo contra él va con ventaja.' },
    distraer: { label: 'Distraer', note: 'Se le mete entre las piernas: su próximo golpe va con desventaja.' },
    rastrear: { label: 'Rastrear', note: 'Olfatea o busca: saca a quien se esconde y las trampas de alrededor.' },
};

/** El vínculo más alto, y cuándo aprende cada forma de ayudar. */
export const PET_MAX_BOND = 5;
export const SUPPORT_AT = [0, 2, 4];

/** La probabilidad de que comente algo, por clase de suceso. Lo que mueve la historia, más. */
export const COMMENT_CHANCE = { hilo: 0.6, grupo: 0.5, mundo: 0.35, gremio: 0.35, partida: 0.5, combate: 0.2, viaje: 0.3, campamento: 0.4, comercio: 0.2 };

/** Los mundos precreados, y qué mascotas les pegan. */
export const PET_CHOICES = {
    terror: ['cuervo', 'gato', 'perro'],
    historico: ['perro', 'halcon', 'cuervo'],
    fantasia: ['familiar', 'zorro', 'perro'],
    isekai: ['espiritu', 'gato', 'loro'],
    otro: ['perro', 'cuervo', 'gato'],
};

/**
 * @typedef {Object} Pet
 * @property {string} name
 * @property {keyof typeof SPECIES} species
 * @property {keyof typeof CHARACTERS} character
 * @property {number} bond 0 a 5.
 * @property {number} together Sucesos vividos juntos, para subir el vínculo.
 * @property {string} lastLine La última frase, para no repetirla.
 * @property {number} lastAt Cuándo habló por última vez (el largo del chat).
 * @property {string[]} met T3: a quién del mundo ha visto ya.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Una mascota leída con tolerancia, o null si no hay.
 *
 * @param {any} raw
 * @returns {Pet|null}
 */
export function readPet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const species = /** @type {keyof typeof SPECIES} */ (Object.hasOwn(SPECIES, plain(raw.species)) ? plain(raw.species) : '');
    const name = text(raw.name);
    if (!species || !name) return null;
    const character = /** @type {keyof typeof CHARACTERS} */ (Object.hasOwn(CHARACTERS, plain(raw.character)) ? plain(raw.character) : 'leal');
    return {
        name,
        species,
        character,
        bond: Math.max(0, Math.min(PET_MAX_BOND, Math.floor(Number(raw.bond) || 0))),
        together: Math.max(0, Math.floor(Number(raw.together) || 0)),
        lastLine: text(raw.lastLine),
        lastAt: Math.floor(Number(raw.lastAt) || -99),
        // T3: a quién del mundo ha visto ya (cada uno reacciona una vez).
        met: Array.isArray(raw.met) ? [...new Set(raw.met.map(text).filter(Boolean))].slice(-80) : [],
    };
}

/**
 * Una mascota nueva.
 *
 * @param {{name: string, species: string, character?: string}} input
 * @returns {Pet|null}
 */
export function createPet({ name, species, character = 'leal' }) {
    return readPet({ name, species, character, bond: 0, together: 0 });
}

/**
 * Cómo se llama, con lo que es: «Graznido, el cuervo».
 *
 * @param {Pet} pet
 * @returns {string}
 */
export function petName(pet) {
    return `${pet.name}, ${articleOf(pet.species)} ${SPECIES[pet.species].label}`;
}

/**
 * @param {string} species
 * @returns {string}
 */
function articleOf(species) {
    return ['familiar', 'espiritu'].includes(species) ? 'su' : 'el';
}

/** Lo que dice, por carácter y por clase de suceso. Cortas: es un comentario, no una escena. */
const SPEECH = {
    cinica: {
        hilo: ['Otra pista. Qué emoción. ¿Nos pagan por esto?', 'Ya decía yo que esto no se iba a arreglar solo.', 'Seguro que no es una trampa. Seguro.'],
        grupo: ['Qué bonito. Me va a dar algo.', 'Ya se os pasará. O no.', 'Yo ya lo sabía, pero nadie me pregunta.'],
        mundo: ['El mundo se mueve y tú aquí, mirando.', 'Mientras tanto, otros hacen el trabajo.', 'Noticias. Ninguna buena, como siempre.'],
        gremio: ['Otra semana sin cobrar, y tú tan tranquilo.', 'Trabajo. Qué sorpresa.', 'El oro no se gana solo, ¿sabes?'],
        partida: ['Ya empezamos.', 'A ver cuánto dura esta vez.'],
        combate: ['Bien. Nadie ha muerto. Todavía.', 'Podría haber sido peor. No mucho.'],
        viaje: ['Más camino. Mis patas lo agradecen.', 'Si llegamos vivos, ya es algo.'],
        campamento: ['Duerme, yo vigilo. Como siempre.', 'Fuego, estrellas y tus ronquidos.'],
        comercio: ['Te han timado. Pero con estilo.', 'Eso no vale lo que has pagado.'],
    },
    leal: {
        hilo: ['Estoy contigo. Pase lo que pase.', 'Lo encontraremos. Juntos.', 'Esto me da mala espina, pero voy donde vayas.'],
        grupo: ['Me alegro por ti.', 'Cuida de los tuyos. Yo cuido de ti.', 'Son buena gente. La mayoría.'],
        mundo: ['Las cosas cambian ahí fuera. Ten cuidado.', 'Lo que pasa lejos acaba llegando.'],
        gremio: ['Un trabajo más. Lo haremos bien.', 'Confían en ti. Yo también.'],
        partida: ['Aquí estoy.', 'Donde vayas, voy.'],
        combate: ['¿Estás bien? Dime que estás bien.', 'Lo hemos conseguido.'],
        viaje: ['El camino es largo, pero no voy a ninguna parte.', 'Paso a paso.'],
        campamento: ['Duerme tranquilo. Estoy aquí.', 'Buena noche para descansar.'],
        comercio: ['¿Necesitabas eso? Si tú lo dices.'],
    },
    curiosa: {
        hilo: ['¡Una pista! ¿Qué significa? ¿Qué significa?', '¿Y si miramos detrás? Siempre hay algo detrás.', 'Esto huele a secreto.'],
        grupo: ['¿Por qué se miran así esos dos?', 'Me encanta cuando pasan cosas.'],
        mundo: ['¿Has oído eso? ¿Qué crees que pasará?', 'Quiero ir a ver. ¿Vamos a ver?'],
        gremio: ['¿Qué hay en el tablón? Léemelo todo.', '¿Y ese encargo de ahí?'],
        partida: ['¿Adónde vamos primero?', '¡Por fin algo nuevo!'],
        combate: ['¿Has visto cómo ha caído? ¿Lo has visto?', '¿Qué llevaba encima? Mira, mira.'],
        viaje: ['¿Qué hay detrás de esa colina?', 'Nunca había estado aquí. ¡Nunca!'],
        campamento: ['¿Qué es esa luz de allí? No, en serio, ¿qué es?', 'Cuéntame algo antes de dormir.'],
        comercio: ['¿Qué es eso brillante? ¿Nos lo llevamos?', '¿Para qué sirve esto?'],
    },
    miedosa: {
        hilo: ['No me gusta esto. No me gusta nada.', '¿Seguro que hay que ir? ¿Seguro?', 'Esto acaba mal. Lo sé.'],
        grupo: ['No os peleéis, por favor.', 'Me pongo nervioso cuando gritáis.'],
        mundo: ['Si hay guerra, ¿nos escondemos? Di que nos escondemos.', 'Malas noticias. Siempre son malas.'],
        gremio: ['¿Ese trabajo es peligroso? Parece peligroso.', 'Algo más tranquilo, ¿no?'],
        partida: ['¿Tenemos que salir? Se está bien aquí.'],
        combate: ['¿Ya ha pasado? ¿Seguro?', 'He cerrado los ojos todo el rato.'],
        viaje: ['He oído algo entre los árboles.', 'Vayamos por el camino, no por el bosque.'],
        campamento: ['No apagues el fuego. Por favor.', '¿Eso ha sido un lobo?'],
        comercio: ['Vámonos ya. Esa gente me mira raro.'],
    },
    orgullosa: {
        hilo: ['Evidente. Yo lo habría visto antes.', 'Por fin prestas atención.', 'Sígueme el paso, si puedes.'],
        grupo: ['No estaría mal que me dieran las gracias a mí.', 'Sin mí no habríais llegado ni a la puerta.'],
        mundo: ['El mundo necesita a alguien como yo. Y como tú, supongo.'],
        gremio: ['Un trabajo digno de nosotros. Por fin.', 'Eso es poca cosa para mí.'],
        partida: ['Que sepan quién llega.'],
        combate: ['¿Has visto? Ha sido gracias a mí.', 'Demasiado fácil.'],
        viaje: ['Ningún camino es largo si voy delante.'],
        campamento: ['Yo hago la primera guardia. Y la mejor.'],
        comercio: ['Lo mejor de la tienda, por supuesto.'],
    },
};

/** Lo que hacen las que no hablan, por clase de suceso. `{n}` es su nombre. */
const GESTURES = {
    hilo: ['{n} levanta la cabeza y mira hacia donde nadie mira.', '{n} se queda quieto, atento, como si supiera algo.'],
    grupo: ['{n} va de uno a otro, como poniendo paz.', '{n} se acurruca a tus pies.'],
    mundo: ['{n} olisquea el aire y se inquieta.', '{n} mira hacia el horizonte un buen rato.'],
    gremio: ['{n} bosteza delante del tablón.', '{n} se sienta a esperar, que es lo suyo.'],
    partida: ['{n} da una vuelta a tu alrededor, listo para salir.'],
    combate: ['{n} sale de su escondite y te lame la mano.', '{n} se sacude, todavía con el pelo de punta.'],
    viaje: ['{n} va delante, y vuelve, y va delante otra vez.', '{n} se para en seco y luego sigue.'],
    campamento: ['{n} se tumba junto al fuego, con una oreja despierta.', '{n} da vueltas antes de echarse, mirando la oscuridad.'],
    comercio: ['{n} se queda en la puerta, sin fiarse del tendero.'],
};

/**
 * Si ahora toca que diga algo, por la clase de suceso y lo que hace que habló.
 *
 * @param {Object} input
 * @param {Pet} input.pet
 * @param {string} input.category La de la crónica (U4).
 * @param {number} input.now Dónde va el chat (su largo).
 * @param {() => number} input.random
 * @param {number} [input.gap] Cuántos mensajes como mínimo entre dos comentarios.
 * @returns {boolean}
 */
export function shouldComment({ pet, category, now, random, gap = 6 }) {
    if (now - pet.lastAt < gap) return false;
    const chance = /** @type {Record<string, number>} */ (COMMENT_CHANCE)[category] ?? 0;
    return random() < chance;
}

/**
 * Lo que dice (o hace) ante un suceso. Nunca la misma frase dos veces seguidas.
 *
 * @param {Object} input
 * @param {Pet} input.pet
 * @param {string} input.category
 * @param {() => number} input.random
 * @returns {string} La línea entera, lista para la crónica; vacía si no tiene nada.
 */
export function petComment({ pet, category, random }) {
    const talks = SPECIES[pet.species].talks;
    const bank = talks
        ? /** @type {Record<string, string[]>} */ (SPEECH[pet.character])[category] ?? []
        : GESTURES[/** @type {keyof typeof GESTURES} */ (category)] ?? [];
    const options = bank.filter(line => line !== pet.lastLine);
    if (options.length === 0) return '';
    const line = options[Math.floor(random() * options.length) % options.length];
    return talks ? `🐾 [MASCOTA] ${petName(pet)}: «${line}»` : `🐾 [MASCOTA] ${line.replace('{n}', pet.name)}`;
}

/**
 * Lo que queda anotado después de hablar.
 *
 * @param {Pet} pet
 * @param {string} said La línea entera.
 * @param {number} now
 * @returns {Pet}
 */
export function afterComment(pet, said, now) {
    const quoted = /«(.+)»$/.exec(said)?.[1] ?? said.replace(/^🐾 \[MASCOTA\] /u, '');
    return { ...pet, lastLine: quoted, lastAt: now };
}

/**
 * Preguntarle: con lo que el motor sabe, dicho con su voz. Las que no hablan contestan con
 * un gesto que señala lo mismo.
 *
 * @param {Object} input
 * @param {Pet} input.pet
 * @param {{in: number, text: string}|null} [input.next] Lo que viene antes (U3).
 * @param {{title: string, in: number|null}|null} [input.urgent] Lo que más aprieta de la mesa (U5).
 * @param {string} [input.clue] Por dónde seguir con el caso (U8).
 * @returns {string}
 */
export function petAdvice({ pet, next = null, urgent = null, clue = '' }) {
    const when = (/** @type {number|null} */ days) => (days === null ? 'sin plazo' : days <= 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`);
    /** @type {string[]} */
    const bits = [];
    if (urgent) bits.push(`lo que más aprieta es «${urgent.title}», ${when(urgent.in)}`);
    if (next) bits.push(`${when(next.in)}: ${next.text}`);
    if (clue) bits.push(`del caso, ${clue}`);
    if (!SPECIES[pet.species].talks) {
        if (bits.length === 0) return `🐾 [MASCOTA] ${pet.name} te mira, bosteza y se tumba. Nada aprieta.`;
        return `🐾 [MASCOTA] ${pet.name} tira de ti hacia el tablón, inquieto: algo aprieta (${bits[0]}).`;
    }
    if (bits.length === 0) return `🐾 [MASCOTA] ${petName(pet)}: «Nada aprieta. Disfrútalo, que dura poco.»`;
    const opening = {
        cinica: 'Por si te interesa', leal: 'Escucha', curiosa: '¿Sabes qué?', miedosa: 'Me preocupa una cosa', orgullosa: 'Como siempre, lo he visto yo',
    }[pet.character];
    return `🐾 [MASCOTA] ${petName(pet)}: «${opening}: ${bits.join('; ')}.»`;
}

/**
 * Las formas de ayudar que ya sabe, por su vínculo.
 *
 * @param {Pet} pet
 * @returns {Array<{id: string, label: string, note: string}>}
 */
export function supportActions(pet) {
    return SPECIES[pet.species].support
        .filter((_, i) => pet.bond >= SUPPORT_AT[i])
        .map(id => ({ id, ...SUPPORT[/** @type {keyof typeof SUPPORT} */ (id)] }));
}

/**
 * Un suceso vivido juntos. Cada cinco, un punto de vínculo; y al subir, si aprende algo, se dice.
 *
 * @param {Pet} pet
 * @returns {{pet: Pet, line: string}}
 */
export function liveTogether(pet) {
    const together = pet.together + 1;
    if (together < 5 || pet.bond >= PET_MAX_BOND) return { pet: { ...pet, together }, line: '' };
    const bond = pet.bond + 1;
    const before = supportActions(pet).length;
    const grown = { ...pet, bond, together: 0 };
    const learned = supportActions(grown).slice(before).map(a => a.label.toLowerCase());
    return {
        pet: grown,
        line: `🐾 [MASCOTA] ${pet.name} se fía un poco más de ti (vínculo ${bond})${learned.length > 0 ? `: ya sabe ${learned.join(' y ')}` : ''}.`,
    };
}

/**
 * Lo que hace fuera del combate.
 *
 * @param {Pet|null} pet
 * @param {'olfato'|'guardia'|'explora'|'labia'} what
 * @returns {boolean}
 */
export function petDoes(pet, what) {
    return Boolean(pet) && SPECIES[/** @type {Pet} */ (pet).species].field.includes(what);
}

/**
 * Qué mascotas se ofrecen en un mundo, por su género.
 *
 * @param {string} genre
 * @returns {string[]}
 */
export function petChoicesFor(genre) {
    const g = plain(genre);
    const key = /terror|horror/.test(g) ? 'terror' : /histor/.test(g) ? 'historico' : /fantas|epic/.test(g) ? 'fantasia' : /isekai|pantalla|sistema/.test(g) ? 'isekai' : 'otro';
    return PET_CHOICES[key];
}

/**
 * Si una bestia vencida se puede domar, y en qué se queda.
 *
 * Manda el dato (T6 de wiki/LO_QUE_FALTA.md): `domable: "perro"` en la fila del bestiario
 * o en el enemigo del paquete dice en qué se queda; `domable: ""` o `"no"`, que no se doma.
 * Solo quien no lo dice cae al nombre, para que los mundos escritos antes sigan igual.
 *
 * @param {string|{name?: any, domable?: any}} beast Su nombre, o su ficha.
 * @returns {keyof typeof SPECIES|''}
 */
export function tamableAs(beast) {
    if (beast && typeof beast === 'object' && beast.domable !== undefined && beast.domable !== null) {
        const said = plain(beast.domable);
        return Object.prototype.hasOwnProperty.call(SPECIES, said) ? /** @type {keyof typeof SPECIES} */ (said) : '';
    }
    const name = plain(typeof beast === 'string' ? beast : beast?.name);
    if (/lobo|perro|mastin|chucho/.test(name)) return 'perro';
    if (/cuervo|grajo|corneja/.test(name)) return 'cuervo';
    if (/zorr/.test(name)) return 'zorro';
    if (/halcon|aguila|azor/.test(name)) return 'halcon';
    if (/gato|lince/.test(name)) return 'gato';
    return '';
}

/**
 * La ficha en una línea: «Graznido, el cuervo · cínica · vínculo 2 · avisar, distraer».
 *
 * @param {Pet} pet
 * @returns {string}
 */
export function describePet(pet) {
    return [
        petName(pet),
        CHARACTERS[pet.character],
        `vínculo ${pet.bond}`,
        SPECIES[pet.species].talks ? 'habla' : 'no habla',
        supportActions(pet).map(a => a.label.toLowerCase()).join(', '),
    ].filter(Boolean).join(' · ');
}
