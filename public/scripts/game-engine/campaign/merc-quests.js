/**
 * E4.3 de wiki/ROADMAP_ENTRETENIDO.md: misiones personales para los mercenarios contratados.
 *
 * Gerd, Nella y Osric tienen su misión escrita (`compendio/personales.json`, J14.9), y se juega
 * paso a paso: el camino, una escena, una pelea y uno de sus finales. Un mercenario del gremio,
 * al llegar al vínculo 3, solo ponía un encargo suelto en el tablón. Ahora pide lo suyo con la
 * misma forma que las escritas, hecha para él (parte de G2.1 de ROADMAP_AUTOMATIZAR):
 *
 * - **Una herencia** (quien busca oro o saber): su tío le dejó la casa y un primo se la ha quedado.
 * - **Una venganza** (sangre o gloria): quien mató a su hermano vive escondido en una aldea.
 * - **Un rescate** (tranquilidad): su hermana pequeña paga en una cantera una deuda ya pagada.
 *
 * Tres pasos y un final: el camino (2 o 3 días), la escena con una decisión (una tirada, pagar o
 * pelear) y la pelea, si se llega a ella. Cada una con dos o tres finales. Todo lo dice la gente
 * que está allí (D-J60): él, su familia y quien le quitó lo suyo.
 *
 * Puro: con la semilla, la misión de cada uno, siempre la misma. Quien llama la guarda y la juega
 * con lo de las escritas (`companion-quests.js`).
 */

import { gendered } from './grammar.js';
import { keyOf } from './social.js';
import { waitsForVeteran } from './weekly-mercenaries.js';

/** En la metadata del chat: las misiones hechas para los mercenarios (filas e información). */
export const MERC_QUESTS_KEY = 'misionesMercenarios';

/** El vínculo con el que pide lo suyo. */
export const MERC_QUEST_RANK = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** Nombres para la gente de la misión. */
const NAMES = {
    m: ['Anselmo', 'Baltasar', 'Crispín', 'Damián', 'Eusebio', 'Fermín', 'Gaspar', 'Hilario', 'Leandro', 'Marcial', 'Nicasio', 'Rufino', 'Tadeo', 'Valerio'],
    f: ['Adela', 'Brígida', 'Casilda', 'Dorotea', 'Elvira', 'Felisa', 'Genoveva', 'Inés', 'Leocadia', 'Remedios', 'Sabina', 'Tomasa'],
};

/** Las aldeas lejanas adonde se va: están a días de Puerto Alba. */
const VILLAGES = ['Peñaseca', 'Fuentefría', 'Valdehoz', 'Torrealba', 'Villacierzo', 'Los Molinos', 'Navalcuervo', 'Robledillo'];

/** Los motes de quien hizo el daño. */
const EPITHETS = ['el Tuerto', 'el Rojo', 'Barbanegra', 'el Manco', 'Cuchillo'];

/** Los tableros, uno por clase: el mapa, dónde empieza el grupo y dónde los suyos. */
const BOARDS = {
    patio: {
        map: ['##############', '#T....c.....T#', '#..c.....c...#', '#......T.....#', '#.c.......c..#', '#............#', '#T....x.....T#', '##############'],
        partyStart: [{ x: 4, y: 6 }, { x: 5, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }],
        spots: [{ x: 4, y: 1 }, { x: 8, y: 2 }, { x: 10, y: 1 }, { x: 6, y: 1 }],
    },
    posada: {
        map: ['##############', '#..c...#....##', '#......D....##', '#..c...#..c..#', '####.#####.###', '#b..........b#', '#bb.......x.b#', '##############'],
        partyStart: [{ x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
        spots: [{ x: 9, y: 2 }, { x: 2, y: 2 }, { x: 5, y: 1 }, { x: 10, y: 3 }],
    },
    cantera: {
        map: ['##############', '#bb..^^...bbb#', '#b....^.....b#', '#.....c......#', '#..c.......c.#', '#............#', '#b....x.....b#', '##############'],
        partyStart: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }],
        spots: [{ x: 4, y: 1 }, { x: 8, y: 1 }, { x: 11, y: 2 }, { x: 2, y: 3 }],
    },
};

/** La clase de misión, por lo que busca. */
const KIND_BY_WANT = { coin: 'herencia', knowledge: 'herencia', blood: 'venganza', glory: 'venganza', quiet: 'rescate' };

/**
 * @typedef {Object} MercQuestInfo Lo que diría `quedadas.json` de una misión escrita.
 * @property {string} id
 * @property {string} title
 * @property {string} where
 * @property {string} pitch De qué va, para su ficha.
 * @property {string} ask Lo mismo, dicho por él, para cuando te lo pide.
 * @property {number} rank
 * @property {string} who
 * @property {Array<{id: string, title: string, summary: string}>} endings
 */

/**
 * @typedef {Object} MercQuest
 * @property {any} row La misión, con la forma de `personales.json` (`readQuestRows`).
 * @property {MercQuestInfo} info
 */

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T}
 */
const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

/**
 * Los enemigos de la pelea en sus sitios del tablero: uno por cada uno del grupo (de 2 a 4).
 *
 * @param {keyof typeof BOARDS} board
 * @param {string[]} names
 * @returns {Array<{name: string, x: number, y: number}>}
 */
function placed(board, names) {
    return names.map((name, i) => ({ name, ...BOARDS[board].spots[i % BOARDS[board].spots.length] }));
}

/**
 * Un tablero con la forma del paquete: su mapa, dónde empieza el grupo y los enemigos.
 *
 * @param {keyof typeof BOARDS} board
 * @param {string} id
 * @param {string} name
 * @param {string[]} enemies
 * @returns {any}
 */
function boardOf(board, id, name, enemies) {
    const { map, partyStart } = BOARDS[board];
    return { id, name, map: [...map], partyStart: partyStart.map(p => ({ ...p })), enemies: placed(board, enemies) };
}

/**
 * La misión personal de un mercenario. Con la misma semilla, la misma.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.wants Lo que busca.
 * @param {() => number} input.random
 * @param {string} [input.heroName]
 * @param {number} [input.size] Cuántos van en el grupo (para la pelea).
 * @returns {MercQuest}
 */
export function mercQuestFor({ member, wants, random, heroName = '', size = 3 }) {
    const kind = KIND_BY_WANT[/** @type {keyof typeof KIND_BY_WANT} */ (text(wants))] ?? 'herencia';
    const name = text(member?.name) || 'Tu mercenario';
    const short = name.split(' ')[0];
    const key = keyOf(name);
    const id = `merc-${key}`;
    const village = pick(VILLAGES, random);
    const days = 2 + (random() < 0.5 ? 0 : 1);
    const hero = text(heroName) || 'jefe';
    const g = (/** @type {string} */ masc, /** @type {string} */ fem) => gendered(member, masc, fem);
    const foes = Math.max(2, Math.min(4, Math.floor(Number(size) || 3)));
    const relFemale = random() < 0.5;
    const relName = pick(relFemale ? NAMES.f : NAMES.m, random);
    const otherFemale = random() < 0.5;
    const otherName = pick(otherFemale ? NAMES.f : NAMES.m, random);
    const where = `${village}, a ${days} días de camino`;
    const back = days;
    const ida = (/** @type {string} */ say) => ({ id: 'ida', kind: 'viaje', to: village, days, who: name, text: say, next: 'escena' });

    if (kind === 'venganza') {
        const villain = `${pick(NAMES.m, random)} ${pick(EPITHETS, random)}`;
        const thug = `Matón de ${villain.split(' ')[0]}`;
        const sibling = relFemale ? 'hermana' : 'hermano';
        const info = {
            id, title: `Quien mató a ${relName}`, where, rank: MERC_QUEST_RANK, who: name,
            pitch: `Hace dos inviernos, ${villain} y su banda mataron a ${relName}, ${relFemale ? 'la hermana' : 'el hermano'} de ${short}, por una bolsa de cobre. Ahora ${villain} vive escondido en ${village}.`,
            ask: `Hace dos inviernos, ${villain} y los suyos mataron a mi ${sibling} ${relName} por una bolsa de cobre. Sé dónde se esconde: en ${village}. No pienso ir ${g('solo', 'sola')}.`,
            endings: [
                { id: 'vengado', title: 'Cuentas saldadas', summary: `${villain} no volverá a robar a nadie. ${short} deja una piedra en la tumba de ${relName} y, por primera vez en dos años, duerme la noche entera.` },
                { id: 'juzgado', title: 'Ante el alguacil', summary: `Entregáis a ${villain} al alguacil de ${village}, y lo juzgarán. ${short} no está del todo ${g('contento', 'contenta')}, pero dice que ${relName} lo habría querido así.` },
                { id: 'escapa', title: 'Se escapa', summary: `${villain} huye por la puerta de atrás. ${short} se queda mirando el camino un buen rato: «Otra vez será».` },
            ],
        };
        const steps = [
            ida(`A ${village}. Ahí se esconde ${villain}, el que mató a mi ${sibling}. No pienso volver sin verle la cara.`),
            {
                id: 'escena', kind: 'escena', title: `La posada de ${village}`, backdrop: 'posada',
                beats: [
                    { who: name, text: `Ese de la mesa del fondo es ${villain}. Ha engordado. Mi ${sibling} no tuvo esa suerte.` },
                    { who: villain, text: '¿Me buscas a mí? No me acuerdo de todas las caras.' },
                    { who: name, mood: 'enfadado', text: `Pues de esta te vas a acordar. ${relName}. El camino de ${village}, hace dos inviernos.` },
                    { who: villain, text: 'Ah, aquel. No quiso soltar la bolsa.' },
                    {
                        who: name, mood: 'enfadado', text: `${hero}, esto es cosa mía, pero vienes conmigo. ¿Qué hacemos con él?`,
                        options: [
                            { id: 'pelear', text: 'Que salga a la calle y pague lo que hizo.', reply: { who: villain, mood: 'enfadado', text: '¡A ellos, muchachos!' } },
                            {
                                id: 'alguacil', text: 'Lo atamos y se lo llevamos al alguacil.',
                                check: {
                                    skill: 'intimidation', dc: 13,
                                    success: { reply: { who: villain, mood: 'triste', text: 'Vale, vale. Sin prisas. Iré con el alguacil.' } },
                                    failure: { reply: { who: villain, mood: 'enfadado', text: '¿Atarme a mí? ¡Muchachos!' } },
                                },
                            },
                        ],
                    },
                ],
                routes: { pelear: 'pelea', alguacil: { bien: 'fin-juzgado', mal: 'pelea' } },
            },
            {
                id: 'pelea', kind: 'tablero', who: name, text: 'Ahí salen los suyos. A ese me lo dejáis a mí.',
                board: boardOf('posada', `posada_${key}`, `La posada de ${village}`, [villain, ...Array(foes - 1).fill(thug)]),
                bestiary: [
                    { name: villain, hp: 22, armorClass: 13, cr: 0.5, profile: 'aggressive', attackRangeFeet: 5, description: `Un salteador ya mayor, con una cicatriz en la cara y un cuchillo largo. Mató a ${relName} por una bolsa de cobre.` },
                    { name: thug, hp: 11, armorClass: 12, cr: 0.125, profile: 'aggressive', attackRangeFeet: 5, description: `Uno de la banda de ${villain}, con un garrote y pocas ganas de pensar.` },
                ],
                win: 'fin-vengado', lose: 'fin-escapa', flee: 'fin-escapa',
            },
            { id: 'fin-vengado', kind: 'final', ending: 'vengado', back, effects: { gold: 0, bonds: 2, fame: 1, memory: `Fuiste con ${name} a ${village} y ${villain} pagó por lo de ${relName}.` } },
            { id: 'fin-juzgado', kind: 'final', ending: 'juzgado', back, effects: { gold: 0, bonds: 2, fame: 1, memory: `Fuiste con ${name} a ${village} y entregasteis a ${villain} al alguacil.` } },
            { id: 'fin-escapa', kind: 'final', ending: 'escapa', back, effects: { gold: 0, bonds: 1, fame: 0, memory: `Fuiste con ${name} a ${village} a buscar a ${villain}, y se os escapó.` } },
        ];
        return { row: { id, kind: 'mision', who: name, quest: id, start: 'ida', steps }, info };
    }

    if (kind === 'rescate') {
        const villain = pick(NAMES.m, random);
        const guard = 'Guarda de la cantera';
        const sibling = relFemale ? 'hermana pequeña' : 'hermano pequeño';
        const it = relFemale ? 'la' : 'lo';
        const info = {
            id, title: `Sacar a ${relName} de la cantera`, where, rank: MERC_QUEST_RANK, who: name,
            pitch: `${relName}, ${relFemale ? 'la hermana pequeña' : 'el hermano pequeño'} de ${short}, pica piedra en la cantera de ${village} por una deuda de su padre. El prestamista, ${villain}, no ${it} deja irse aunque la deuda está pagada de sobra.`,
            ask: `Mi ${sibling}, ${relName}, lleva un año picando piedra en la cantera de ${village} por una deuda de mi padre. Ya está pagada, pero el prestamista no ${it} suelta. Quiero traer${it} a casa.`,
            endings: [
                { id: 'libre', title: 'Libre', summary: `${relName} vuelve con ${short} a Puerto Alba. Al principio no habla con nadie; al mes ya ayuda en la cocina del gremio.` },
                { id: 'comprada', title: 'Comprar la deuda', summary: `Pagáis lo que pide ${villain}, que es más de lo justo. ${relName} sale de la cantera, y ${short} no olvidará quién puso el oro.` },
            ],
        };
        const steps = [
            ida(`A ${village}. Mi ${sibling}, ${relName}, lleva un año picando piedra por una deuda que ya está pagada. Me ${it} llevo a casa.`),
            {
                id: 'escena', kind: 'escena', title: `La cantera de ${village}`, backdrop: 'plaza',
                beats: [
                    { who: name, text: `Ahí, ${relFemale ? 'la' : 'el'} de la cuerda en la cintura. Es ${relName}. Está en los huesos.` },
                    { who: relName, mood: 'triste', text: `¿${short}? ¿Eres tú? No puedo irme. Dice que aún debemos treinta monedas.` },
                    { who: villain, text: 'Cuarenta, con lo de este mes. Las deudas crecen, como los críos. O se paga, o se queda.' },
                    {
                        who: name, mood: 'enfadado', text: `${hero}, yo no tengo cuarenta monedas. ¿Qué hacemos?`,
                        options: [
                            { id: 'pagar', text: 'Le pagamos y nos vamos.', if: { gold: 40 }, reply: { who: villain, text: 'Un placer hacer negocios. Llevaos a quien queráis.' } },
                            {
                                id: 'cuentas', text: 'Enséñame tus cuentas. Esa deuda está pagada.',
                                check: {
                                    skill: 'investigation', dc: 12,
                                    success: { reply: { who: villain, mood: 'enfadado', text: '…Bueno. Puede que haya un error. Llevaos a quien queráis, y no volváis.' } },
                                    failure: { reply: { who: villain, mood: 'enfadado', text: 'Las cuentas son mías, y dicen lo que yo digo. ¡Guardias!' } },
                                },
                            },
                            { id: 'llevarla', text: `Nos ${it} llevamos, y que intente impedirlo.`, reply: { who: villain, mood: 'enfadado', text: '¡Guardias! ¡Que no salgan!' } },
                        ],
                    },
                ],
                routes: { pagar: 'fin-comprada', cuentas: { bien: 'fin-libre', mal: 'pelea' }, llevarla: 'pelea' },
            },
            {
                id: 'pelea', kind: 'tablero', who: name, text: `Ahí vienen sus guardias. Que nadie toque a ${relName}.`,
                board: boardOf('cantera', `cantera_${key}`, `La cantera de ${village}`, Array(foes).fill(guard)),
                bestiary: [
                    { name: guard, hp: 11, armorClass: 12, cr: 0.125, profile: 'aggressive', attackRangeFeet: 5, description: `Un guarda de ${villain}, con un pico al hombro y un látigo en el cinto.` },
                ],
                win: 'fin-libre', lose: 'fin-comprada', flee: 'fin-comprada',
            },
            { id: 'fin-libre', kind: 'final', ending: 'libre', back, effects: { gold: 0, bonds: 2, fame: 1, memory: `Fuiste con ${name} a ${village} y sacasteis a ${relName} de la cantera.` } },
            { id: 'fin-comprada', kind: 'final', ending: 'comprada', back, effects: { gold: -40, bonds: 2, fame: 0, memory: `Fuiste con ${name} a ${village} y pagasteis la deuda de ${relName}.` } },
        ];
        return { row: { id, kind: 'mision', who: name, quest: id, start: 'ida', steps }, info };
    }

    // La herencia.
    // «de la tía Elvira», «mi tío Anselmo», «Mi tío Anselmo», «su tío Anselmo».
    const ofUncle = relFemale ? `de la tía ${relName}` : `del tío ${relName}`;
    const myUncle = relFemale ? `mi tía ${relName}` : `mi tío ${relName}`;
    const MyUncle = `M${myUncle.slice(1)}`;
    const hisUncle = `s${myUncle.slice(1).replace(/^i/, 'u')}`;
    const cousin = otherFemale ? `prima ${otherName}` : `primo ${otherName}`;
    const friend = `Amigo de ${otherName}`;
    const info = {
        id, title: `La herencia ${ofUncle}`,
        where, rank: MERC_QUEST_RANK, who: name,
        pitch: `${relName}, ${relFemale ? 'la tía' : 'el tío'} de ${short}, murió en ${village} y le dejó su casa y sus ahorros. Su ${cousin} se ha metido dentro y dice que el testamento es falso.`,
        ask: `${MyUncle} murió en ${village} y me lo dejó todo: la casa y sus ahorros. Mi ${cousin} se ha metido dentro y dice que el testamento es falso.`,
        endings: [
            { id: 'recuperada', title: 'La casa es suya', summary: `${short} recupera la casa de ${relName}. La vende ese mismo día, y con lo que saca invita a cenar a todo el gremio.` },
            { id: 'repartida', title: 'A medias', summary: `La herencia se parte en dos: la mitad para ${short} y la mitad para ${otherName}. No es lo justo, pero nadie ha acabado en una zanja.` },
        ],
    };
    const steps = [
        ida(`A ${village}. ${MyUncle} me lo dejó todo, y mi ${cousin} se lo ha quedado. Voy a por lo que es mío.`),
        {
            id: 'escena', kind: 'escena', title: village, backdrop: 'plaza',
            beats: [
                { who: name, text: `Ahí está la casa de ${myUncle}. Y ${otherFemale ? 'esa' : 'ese'} de la puerta, con cara de ${otherFemale ? 'dueña' : 'dueño'}, es mi ${cousin}.` },
                { who: otherName, mood: 'enfadado', text: `¿${short}? Aquí no hay nada tuyo. ${relFemale ? 'La vieja' : 'El viejo'} me lo dejó todo a mí.` },
                { who: name, mood: 'enfadado', text: 'Tengo la carta del notario, con su firma. La casa es mía.' },
                { who: otherName, text: 'Papeles. Aquí manda quien está dentro. Y dentro estoy yo, con mis amigos.' },
                {
                    who: name, text: `Tú dirás, ${hero}. ¿Cómo lo hacemos?`,
                    options: [
                        {
                            id: 'notario', text: 'Vamos al notario con la carta, y que lo diga él.',
                            check: {
                                skill: 'persuasion', dc: 12,
                                success: { reply: { who: name, mood: 'alegre', text: `El notario lo ha dicho bien claro: la casa es mía. A ver qué dice ahora mi ${cousin}.` } },
                                failure: { reply: { who: otherName, mood: 'enfadado', text: 'El notario no se mete en líos. ¡Muchachos, fuera esta gente!' } },
                            },
                        },
                        { id: 'repartir', text: 'Ofrécele la mitad, y en paz.', reply: { who: otherName, text: 'La mitad… Trato hecho. Y no vuelvas por aquí.' } },
                        { id: 'echarle', text: `${otherFemale ? 'La' : 'Lo'} sacamos de ahí a la fuerza.`, reply: { who: otherName, mood: 'enfadado', text: '¡Muchachos! ¡Fuera esta gente!' } },
                    ],
                },
            ],
            routes: { notario: { bien: 'fin-suya', mal: 'pelea' }, repartir: 'fin-mitad', echarle: 'pelea' },
        },
        {
            id: 'pelea', kind: 'tablero', who: name, text: 'Ahí salen sus amigos, con garrotes. Al patio: esto se arregla ahí.',
            board: boardOf('patio', `patio_${key}`, `La casa ${ofUncle}`, Array(foes).fill(friend)),
            bestiary: [
                { name: friend, hp: 11, armorClass: 12, cr: 0.125, profile: 'aggressive', attackRangeFeet: 5, description: `Un mozo de ${village}, ancho de hombros, con un garrote. Defiende a ${otherName} porque le paga la bebida.` },
            ],
            win: 'fin-suya', lose: 'fin-mitad', flee: 'fin-mitad',
        },
        { id: 'fin-suya', kind: 'final', ending: 'recuperada', back, effects: { gold: 30, bonds: 2, fame: 1, memory: `Fuiste con ${name} a ${village} y recuperasteis la herencia de ${hisUncle}.` } },
        { id: 'fin-mitad', kind: 'final', ending: 'repartida', back, effects: { gold: 0, bonds: 1, fame: 0, memory: `Fuiste con ${name} a ${village}, y la herencia de ${hisUncle} se partió en dos.` } },
    ];
    return { row: { id, kind: 'mision', who: name, quest: id, start: 'ida', steps }, info };
}

/**
 * @typedef {Object} MercQuestStore
 * @property {any[]} rows Las misiones, con la forma de `personales.json`.
 * @property {Record<string, MercQuestInfo>} infos Por id de misión.
 * @property {string[]} told Las que ya te ha pedido él, junto al fuego.
 */

/**
 * @param {any} raw
 * @returns {MercQuestStore}
 */
export function readMercQuests(raw) {
    const rows = (Array.isArray(raw?.rows) ? raw.rows : []).filter((/** @type {any} */ r) => r && text(r.id) && text(r.who));
    const source = raw?.infos && typeof raw.infos === 'object' ? raw.infos : {};
    /** @type {Record<string, MercQuestInfo>} */
    const infos = {};
    for (const row of rows) {
        const info = source[text(row.id)];
        if (info && typeof info === 'object') infos[text(row.id)] = info;
    }
    const told = (Array.isArray(raw?.told) ? raw.told : []).map(text).filter(Boolean);
    return { rows: rows.filter((/** @type {any} */ r) => infos[text(r.id)]), infos, told };
}

/**
 * Guardar la misión de alguien (si ya tenía una, se queda la que tenía).
 *
 * @param {any} raw
 * @param {MercQuest} quest
 * @returns {MercQuestStore}
 */
export function addMercQuest(raw, quest) {
    const store = readMercQuests(raw);
    if (store.rows.some(r => text(r.id) === text(quest.row.id))) return store;
    return { rows: [...store.rows, quest.row], infos: { ...store.infos, [text(quest.row.id)]: quest.info }, told: store.told };
}

/**
 * Apuntar que ya te la ha pedido él.
 *
 * @param {any} raw
 * @param {string} id
 * @returns {MercQuestStore}
 */
export function markTold(raw, id) {
    const store = readMercQuests(raw);
    return store.told.includes(text(id)) ? store : { ...store, told: [...store.told, text(id)] };
}

/**
 * Los mercenarios del grupo que ya piden lo suyo y aún no tienen misión.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {(member: any) => number} input.rankOf
 * @param {any} input.store `readMercQuests`.
 * @param {Set<string>|string[]} [input.written] Las claves de quien ya tiene misión escrita.
 * @returns {any[]}
 */
export function dueMercQuests({ party, rankOf, store, written = [] }) {
    const have = new Set([...readMercQuests(store).rows.map(r => keyOf(r.who)), ...written]);
    return (Array.isArray(party) ? party : []).slice(1)
        // E8.4: el de paso no pide nada suyo hasta que es veterano (E8.6).
        .filter(m => m && !m.dead && m.guest?.kind === 'mercenary' && !waitsForVeteran(m) && rankOf(m) >= MERC_QUEST_RANK && !have.has(keyOf(m.name)));
}

/**
 * La charla en la que te lo pide, junto al fuego: él lo cuenta y tú contestas. Como fila de
 * `cast-scenes.js` (`a` es él).
 *
 * @param {MercQuestInfo} info
 * @returns {any}
 */
export function mercAskScene(info) {
    return {
        id: `pide-${text(info?.id)}`,
        title: text(info?.title),
        beats: [
            { who: 'a', mood: 'triste', say: 'Oye. Hay una cosa que no te he contado.' },
            { who: 'a', say: text(info?.ask) },
            {
                who: 'a',
                say: '¿Me echas una mano? Cuando estemos en el gremio, salimos.',
                replies: [
                    { text: 'Cuenta conmigo.', who: 'a', mood: 'alegre', bonds: { a: 1 }, then: 'Sabía que podía contar contigo. Cuando quieras, me lo dices.' },
                    { text: 'Ahora no puedo, pero no me olvido.', who: 'a', then: 'Lo entiendo. Pero no tardes mucho.' },
                ],
            },
        ],
    };
}
