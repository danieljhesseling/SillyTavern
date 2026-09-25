/**
 * El trasfondo del personaje, con efecto en las reglas (idea 49).
 *
 * Lo que escribes en «Quien eres» ya llegaba al narrador. Pero un militar jubilado tiraba
 * Intimidacion igual que un escriba. Ahora el pasado cuenta: cada trasfondo da competencia
 * en dos habilidades (las tiradas lo notan) y un contacto que el narrador puede usar.
 *
 * Se propone solo, leyendo lo que escribiste («militar jubilado» → Soldado veterano), y se
 * puede cambiar. Puro: la tabla, la propuesta y la linea para el narrador.
 */

/**
 * @typedef {Object} Background
 * @property {string} label
 * @property {string[]} skills  Ids de `SKILLS` en `rules/checks.js`.
 * @property {string} contact  Lo que el narrador puede usar: a quien conoce, que sabe.
 * @property {RegExp} words    Lo que, dicho en «Quien eres», lo delata.
 */

/** @type {Record<string, Background>} */
export const BACKGROUNDS = {
    soldado: {
        label: 'Soldado veterano',
        skills: ['athletics', 'intimidation'],
        contact: 'Sirvió en armas: gente de la guardia y viejos compañeros pueden reconocerle.',
        words: /\b(soldad|militar|veteran|jubilad|guerra|ej[eé]rcito|guardia|sargent|capit[aá]n|mercenari)/i,
    },
    criminal: {
        label: 'Criminal',
        skills: ['stealth', 'deception'],
        contact: 'Conoce los bajos fondos: sabe a quién preguntar y quién compra lo robado.',
        words: /\b(ladr|robar|rob[oó]|calle|carterist|contrabandist|asesin|banda|c[aá]rcel|preso)/i,
    },
    erudito: {
        label: 'Erudito',
        skills: ['investigation', 'insight'],
        contact: 'Sabe leer y dónde buscar: bibliotecas, archivos y quien los guarda.',
        words: /\b(libro|estudi|escrib|sabio|biblioteca|maestr|erudit|archiv|alquimist)/i,
    },
    acolito: {
        label: 'Acólito',
        skills: ['insight', 'persuasion'],
        contact: 'Sirvió en un templo: el clero le abre puertas que a otros no.',
        words: /\b(sacerdot|templo|monj|acólit|acolit|fe\b|dios|diosa|orden|convento|clérig|clerig)/i,
    },
    forastero: {
        label: 'Forastero',
        skills: ['perception', 'athletics'],
        contact: 'Creció lejos de los caminos: lee el monte, el tiempo y los rastros.',
        words: /\b(bosque|monte|cazador|caz[oó]|trampero|explorador|salvaj|tribu|pastor|campo)/i,
    },
    artesano: {
        label: 'Artesano',
        skills: ['investigation', 'persuasion'],
        contact: 'Tiene un oficio: sabe lo que vale cada cosa y conoce a los del gremio.',
        words: /\b(herrer|carpinter|oficio|taller|artesan|aprendiz|zapater|tejedor|curtidor|gremio)/i,
    },
    noble: {
        label: 'Noble venido a menos',
        skills: ['persuasion', 'intimidation'],
        contact: 'Tiene apellido: en las casas nobles aún le reciben, aunque sea por la puerta de atrás.',
        words: /\b(noble|señor|senor|heredero|herede|castillo|linaje|apellido|corte|dama|conde|bar[oó]n)/i,
    },
    marinero: {
        label: 'Marinero',
        skills: ['athletics', 'perception'],
        contact: 'Ha navegado: en cualquier puerto hay alguien que le debe una ronda.',
        words: /\b(mar\b|barco|puerto|marin|pescador|pirat|naveg|muelle|capit[aá]n de barco)/i,
    },
    charlatan: {
        label: 'Charlatán',
        skills: ['deception', 'persuasion'],
        contact: 'Vive de su labia: sabe venderse, y sabe cuándo le están vendiendo a él.',
        words: /\b(timad|estaf|mentir|mentiros|charlat|feriante|vendedor|juglar|actor|jugador)/i,
    },
    ermitano: {
        label: 'Ermitaño',
        skills: ['insight', 'perception'],
        contact: 'Vivió apartado: sabe estar callado, y ve lo que otros no miran.',
        words: /\b(ermita|solo\b|sola\b|retir|aislad|cueva|soledad|apartad)/i,
    },
};

/**
 * El trasfondo que sugiere lo escrito, o vacio si no se nota ninguno.
 *
 * @param {string} about
 * @returns {string}
 */
export function guessBackground(about) {
    const said = String(about ?? '');
    if (!said.trim()) return '';
    for (const [id, background] of Object.entries(BACKGROUNDS)) {
        if (background.words.test(said)) return id;
    }
    return '';
}

/**
 * @param {string} id
 * @returns {Background|null}
 */
export function backgroundOf(id) {
    return BACKGROUNDS[String(id ?? '')] ?? null;
}

/**
 * Si el trasfondo da competencia en una habilidad.
 *
 * @param {string} id
 * @param {string} skill
 * @returns {boolean}
 */
export function backgroundGives(id, skill) {
    return Boolean(backgroundOf(id)?.skills.includes(String(skill)));
}

/**
 * Lo que el narrador sabe del pasado del personaje.
 *
 * @param {string} id
 * @param {(skill: string) => string} [skillLabel]
 * @returns {string}
 */
export function describeBackground(id, skillLabel = s => s) {
    const background = backgroundOf(id);
    if (!background) return '';
    return `Trasfondo: ${background.label} (se le da bien: ${background.skills.map(skillLabel).join(' y ')}). ${background.contact}`;
}
