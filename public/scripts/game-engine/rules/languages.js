/**
 * Los idiomas, que ahora importan (idea 59).
 *
 * Todo el mundo hablaba con todo el mundo. Ahora cada persona del mundo puede hablar su
 * lengua (`language` en su ficha; la del guion es `idioma`), y cada cual sabe las de su
 * raza, más las que diga su ficha:
 *
 * - Si quien tira la habla, nada cambia.
 * - Si no, pero alguien del grupo sí, **traduce**: la tirada va normal, y se dice quién.
 * - Si no la habla nadie, las tiradas de trato (convencer, engañar, intimidar, calar) van
 *   **con desventaja**.
 *
 * La lengua común la habla todo el mundo: quien no dice la suya habla esa.
 *
 * Puro: dice quién habla qué y cómo va la tirada. Quien llama tira.
 */

/** La que habla todo el mundo. */
export const COMMON = 'común';

/** Lo que habla cada raza, además de la común. */
export const RACE_LANGUAGES = /** @type {Record<string, string[]>} */ ({
    humano: [],
    elfo: ['élfico'],
    semielfo: ['élfico'],
    enano: ['enano'],
    mediano: ['mediano'],
    gnomo: ['gnómico'],
    semiorco: ['orco'],
    orco: ['orco'],
    tiflin: ['infernal'],
    tiefling: ['infernal'],
    draconido: ['dracónico'],
});

/** Las tiradas en las que la lengua pesa. */
export const SOCIAL_SKILLS = ['persuasion', 'deception', 'intimidation', 'insight'];

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {string} */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Una lengua escrita a mano, para comparar: sin mayúsculas ni tildes, y «comun» es la común.
 *
 * @param {any} value
 * @returns {string}
 */
export function readLanguage(value) {
    const id = plain(value);
    return !id || id === 'comun' || id === 'common' ? plain(COMMON) : id;
}

/**
 * Lo que habla alguien: la común, la de su raza y la que diga su ficha.
 *
 * @param {any} member
 * @returns {string[]} Como se escriben, para enseñarlas.
 */
export function languagesOf(member) {
    const race = plain(member?.race).split(/\s+/)[0] ?? '';
    const fromRace = RACE_LANGUAGES[race] ?? [];
    const written = Array.isArray(member?.languages) ? member.languages : text(member?.languages).split(',');
    /** @type {Map<string, string>} */
    const out = new Map([[plain(COMMON), COMMON]]);
    for (const name of [...fromRace, ...written].map(text).filter(Boolean)) out.set(readLanguage(name), name);
    return [...out.values()];
}

/**
 * Si alguien habla una lengua.
 *
 * @param {any} member
 * @param {string} language
 * @returns {boolean}
 */
export function speaks(member, language) {
    const wanted = readLanguage(language);
    return languagesOf(member).some(l => readLanguage(l) === wanted);
}

/**
 * Si alguien entiende cualquier lengua ahora: el ritual Comprender idiomas (`tongues` en su
 * ficha: el día y la parte del día en que se lanzó) dura hasta que acaba esa parte del día.
 * Entender no es hablar: solo sirve para calar a alguien, no para convencerle.
 *
 * @param {any} member
 * @param {any} now El calendario de la campaña (`day` y `slotIndex`).
 * @returns {boolean}
 */
export function understandsAll(member, now) {
    const spell = member?.tongues;
    if (!spell || !now) return false;
    return Math.floor(Number(spell.day) || 0) === Math.floor(Number(now.day) || 0)
        && Math.floor(Number(spell.slotIndex) || 0) === Math.floor(Number(now.slotIndex) || 0);
}

/**
 * Cómo va una tirada de trato con alguien que habla otra lengua.
 *
 * @param {Object} input
 * @param {any} input.speaker Quien tira.
 * @param {any[]} input.party
 * @param {string} input.language La de la persona con la que se habla.
 * @param {string} input.skill
 * @param {string} [input.listener] Cómo se llama esa persona.
 * @param {any} [input.now] El calendario, para Comprender idiomas (`understandsAll`).
 * @returns {{edge: ''|'disadvantage', by: string, note: string}}
 */
export function languageBarrier({ speaker, party, language, skill, listener = '', now = null }) {
    const lang = readLanguage(language);
    // Para calar basta con entender lo que dice; para lo demás, hay que hablarla.
    const gets = (/** @type {any} */ m) => speaks(m, language) || (text(skill) === 'insight' && understandsAll(m, now));
    if (!SOCIAL_SKILLS.includes(text(skill)) || lang === readLanguage(COMMON) || gets(speaker)) {
        return { edge: '', by: '', note: '' };
    }
    const who = text(listener) || 'Esa persona';
    const helper = (Array.isArray(party) ? party : [])
        .find(m => m && m !== speaker && !m.dead && (Number(m.hp) || 0) > 0 && gets(m));
    if (helper) {
        return { edge: '', by: text(helper.name), note: `${who} habla ${text(language)}: ${text(helper.name)} traduce.` };
    }
    return { edge: 'disadvantage', by: '', note: `${who} habla ${text(language)} y nadie del grupo lo entiende: con desventaja.` };
}
