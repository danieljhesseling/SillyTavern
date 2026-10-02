/**
 * Trabajos y ratos libres (J14.11 de wiki/ROADMAP_SIN_CONEXION.md): otras formas de gastar una
 * parte del día, como en *Persona*.
 *
 * En la pantalla del pueblo, dentro de cada sitio, además de comprar y de quedar con tu gente:
 *
 * - **Servir mesas** en la taberna (tarde y noche): el jornal, y a elegir en la escena entre ir
 *   a por las propinas o escuchar lo que se habla (un rumor). Quien lleva la taberna os aprecia
 *   un poco más.
 * - **Echar una mano en la forja** (mañana y tarde, si está abierta): el jornal en monedas o
 *   «guárdamelo para mi arma». Cada día de forja cuenta; al tercero (`FORGE_STEPS`), el herrero
 *   deja un arma del grupo en +1 sin cobrar. Y os aprecia más: con aprecio, la herrería ya os
 *   hacía un 25 % menos (`HOME_FAVORS` de `companion-arcs.js`).
 * - **Jugar a las cartas** en la taberna (tarde y noche): «Mayor o menor» (`card-game.js`).
 * - **Leer** en la sala del gremio (a cualquier hora): experiencia para quien lea; más si el
 *   gremio tiene biblioteca.
 * - **Pescar** en el muelle (mañana y tarde): pescado para comer y lo que sobre, a la venta.
 * - **Entrenar en el patio** del gremio (mañana y tarde): experiencia para ti y para quien
 *   venga, con las reglas del patio (`guild-training.js`: el doble a quien va por detrás).
 *
 * Cada uno gasta la parte del día (`day-parts.js`; comprar, no: D-J31), tiene su escena corta de
 * novela visual con quien lleva el sitio, y quien de tu gente esté libre puede venir: suma un
 * poco al vínculo (`pastime_together` de `bonds.js`) y, en los trabajos, una moneda más.
 *
 * Qué se ofrece sale de la clase del sitio (`kind` de `town.js`): así vale en Puerto Alba y en
 * cualquier pueblo de campaña que tenga taberna, herrería o muelle.
 *
 * Puro: dice qué se puede hacer, qué escena sale y qué da. Quien llama aplica el oro, la
 * experiencia, el aprecio, el rumor y la mejora, y pasa el reloj.
 */

import { readScene } from './meetups.js';
import { WORK_GOLD_BASE } from './day-parts.js';
import { PLACE_KINDS } from './town.js';
import { CARD_BETS } from './card-game.js';
import { sessionXp } from './guild-training.js';

/** Donde se guarda lo que dura de un día a otro (los días de forja). */
export const PASTIMES_KEY = 'pastimes';

/** Días de forja para que el herrero mejore un arma sin cobrar. */
export const FORGE_STEPS = 3;

/** Lo que se lleva cada compañero que echa una mano en un trabajo. */
export const HELPER_GOLD = 1;

/** Experiencia de leer una parte del día, por nivel; y lo que suma la biblioteca del gremio. */
export const READ_XP_PER_LEVEL = 15;
export const LIBRARY_XP_PER_LEVEL = 10;

/** Lo que dan por cada pez que sobra, y por el grande. */
export const FISH_PRICE = 1;
export const BIG_FISH_GOLD = 3;

/** Lo que paga el herrero si ya no queda arma que mejorar. */
export const FORGE_BONUS_GOLD = 5;

/**
 * Los trabajos y ratos libres. `place`: la clase de sitio; `hours`: cuándo; `keeper`: si hace
 * falta alguien atendiendo; `open`: si el sitio tiene que estar abierto; `label`: lo que se
 * apunta en la cabecera.
 */
export const PASTIMES = {
    mesas: {
        label: 'Servir mesas', short: 'Servir mesas', kind: 'trabajo', place: 'posada', icon: 'fa-utensils',
        hours: ['afternoon', 'night'], keeper: true, open: false,
        late: 'Servir mesas es de tarde o de noche: por la mañana la taberna está vacía.',
    },
    forja: {
        label: 'Echar una mano en la forja', short: 'En la forja', kind: 'trabajo', place: 'herreria', icon: 'fa-hammer',
        hours: ['morning', 'afternoon'], keeper: true, open: true,
        late: 'De noche la fragua está apagada: vuelve por la mañana o por la tarde.',
    },
    cartas: {
        label: 'Jugar a las cartas', short: 'A las cartas', kind: 'rato', place: 'posada', icon: 'fa-diamond',
        hours: ['afternoon', 'night'], keeper: false, open: false,
        late: 'Las cartas salen por la tarde y por la noche.',
    },
    leer: {
        label: 'Leer en el gremio', short: 'Leer', kind: 'rato', place: 'gremio', icon: 'fa-book-open',
        hours: ['morning', 'afternoon', 'night'], keeper: false, open: false,
        late: '',
    },
    pescar: {
        label: 'Pescar en el muelle', short: 'Pescar', kind: 'rato', place: 'muelle', icon: 'fa-fish',
        hours: ['morning', 'afternoon'], keeper: false, open: false,
        late: 'De noche no se pesca: vuelve por la mañana o por la tarde.',
    },
    patio: {
        label: 'Entrenar en el patio', short: 'Entrenar', kind: 'rato', place: 'gremio', icon: 'fa-dumbbell',
        hours: ['morning', 'afternoon'], keeper: false, open: false, yard: true,
        late: 'De noche el patio está a oscuras: se entrena por la mañana o por la tarde.',
    },
};

/** Cómo se dice cada parte del día dentro de una frase. */
const SLOT_WORDS = { morning: 'la mañana', afternoon: 'la tarde', night: 'la noche' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {string} name @returns {string} El primer nombre: «Gerd», no «Gerd el Mellado». */
const firstName = (name) => text(name).split(' ')[0] || text(name);

/** @param {string} slot @returns {string} */
export const slotWords = (slot) => /** @type {Record<string, string>} */ (SLOT_WORDS)[text(slot)] ?? 'esta parte del día';

/**
 * Una lista dicha: «Gerd», «Gerd y Nella», «Gerd, Nella y Osric».
 *
 * @param {string[]} names
 * @returns {string}
 */
export function sayList(names) {
    const list = (Array.isArray(names) ? names : []).map(text).filter(Boolean);
    if (list.length <= 1) return list[0] ?? '';
    return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}

/**
 * Lo guardado, con forma: cuántos días de forja lleva cada herrero.
 *
 * @param {any} raw
 * @returns {{forge: Record<string, number>}}
 */
export function readPastimes(raw) {
    /** @type {Record<string, number>} */
    const forge = {};
    for (const [who, steps] of Object.entries(raw?.forge ?? {})) {
        const n = Math.max(0, Math.min(FORGE_STEPS, Math.floor(Number(steps) || 0)));
        if (text(who) && n > 0) forge[text(who)] = n;
    }
    return { forge };
}

/**
 * @typedef {Object} PastimeOffer
 * @property {keyof typeof PASTIMES} id
 * @property {string} label
 * @property {string} icon
 * @property {string} detail Lo que da y lo que gasta, o por qué no se puede ahora.
 * @property {boolean} enabled
 */

/**
 * Lo que da cada uno, dicho en su botón.
 *
 * @param {keyof typeof PASTIMES} id
 * @param {{keeper: string, slot: string, forgeSteps: number, library: number}} input
 * @returns {string}
 */
function pitch(id, { keeper, slot, forgeSteps, library }) {
    const spend = `Gasta ${slotWords(slot)}.`;
    const who = keeper || 'quien lo lleva';
    switch (id) {
        case 'mesas':
            return `Unas monedas, las propinas o lo que se oye en las mesas, y que ${who} os aprecie más. ${spend}`;
        case 'forja': {
            const count = forgeSteps > 0 ? ` Llevas ${forgeSteps} de ${FORGE_STEPS} días para que te mejore un arma.` : '';
            return `Unas monedas o, poco a poco, un arma mejor; y que ${who} os aprecie más (con aprecio, la herrería os sale más barata).${count} ${spend}`;
        }
        case 'cartas':
            return `A mayor o menor, con apuesta de ${CARD_BETS[0]} a ${CARD_BETS[CARD_BETS.length - 1]} de oro. Ves las probabilidades antes de cada carta. ${spend}`;
        case 'leer':
            return `Libros e informes del gremio: experiencia para quien lea${library > 0 ? ', y más con la biblioteca' : ''}. También de noche. ${spend}`;
        case 'pescar':
            return `Una caña y paciencia: pescado para comer y lo que sobre, a la venta. ${spend}`;
        case 'patio':
            return `Tú y quien venga, con armas de madera: experiencia por vuestro nivel, el doble a quien va por detrás de los tuyos. ${spend}`;
        default:
            return spend;
    }
}

/**
 * Los trabajos y ratos libres de un sitio del pueblo, ya juzgados.
 *
 * @param {Object} input
 * @param {{kind: string, keeper?: {name: string}|null, closed?: string, closedLine?: string}|null} input.place El sitio (`TownPlace`).
 * @param {string} input.slot La parte del día, por su id (`afternoon`).
 * @param {boolean} [input.fighting]
 * @param {number} [input.purse] El oro del grupo.
 * @param {number} [input.forgeSteps] Los días de forja que lleva quien atiende la herrería.
 * @param {number} [input.library] El nivel de la biblioteca del gremio.
 * @param {boolean} [input.yard] Si el sitio tiene patio de entrenamiento (la sala del gremio, en casa).
 * @returns {PastimeOffer[]}
 */
export function pastimeOffers({ place, slot, fighting = false, purse = 0, forgeSteps = 0, library = 0, yard = false }) {
    const kind = text(place?.kind);
    if (!kind) return [];
    const keeper = text(place?.keeper?.name);
    /** @type {PastimeOffer[]} */
    const out = [];
    for (const [id, spec] of /** @type {Array<[keyof typeof PASTIMES, typeof PASTIMES[keyof typeof PASTIMES]]>} */ (Object.entries(PASTIMES))) {
        if (spec.place !== kind) continue;
        if (/** @type {any} */ (spec).yard && !yard) continue;
        const label = id === 'leer' && library > 0 ? 'Leer en la biblioteca' : spec.label;
        let why = '';
        if (fighting) why = 'No mientras peleáis.';
        else if (spec.open && place?.closed) why = text(place.closedLine) || text(place.closed);
        else if (!spec.hours.includes(text(slot))) why = spec.late;
        else if (spec.keeper && !keeper) why = 'Nadie atiende: no hay a quién echar una mano.';
        else if (id === 'cartas' && (Number(purse) || 0) < CARD_BETS[0]) why = `Para sentarte a jugar hace falta llevar al menos ${CARD_BETS[0]} de oro.`;
        out.push({
            id, label, icon: spec.icon, enabled: !why,
            detail: why || pitch(id, { keeper: firstName(keeper), slot: text(slot), forgeSteps: Number(forgeSteps) || 0, library: Number(library) || 0 }),
        });
    }
    return out;
}

/**
 * El muelle de un puerto, como sitio del pueblo, si la localización no lo trae: sin él no había
 * dónde pescar en Puerto Alba (el muelle solo salía como «por el pueblo»).
 *
 * @param {Object} input
 * @param {any} input.location
 * @param {boolean} [input.hub] Si es el pueblo del gremio (Puerto Alba es un puerto).
 * @returns {import('./town.js').TownPlace|null}
 */
export function docksPlace({ location, hub = false }) {
    const name = text(location?.name);
    if (!name) return null;
    const written = Array.isArray(location?.places) ? location.places : [];
    if (written.some((/** @type {any} */ p) => text(p?.kind) === 'muelle')) return null;
    const harbour = hub || /\bpuerto\b|\bmuelle\b/i.test(name) || text(location?.type || location?.locationType) === 'port';
    if (!harbour) return null;
    const kind = PLACE_KINDS.muelle;
    return {
        id: 'muelle', kind: 'muelle', name: kind.label, icon: kind.icon, art: kind.art,
        description: 'Barcas atadas, redes secándose al sol y un pescador viejo que presta cañas a quien las pida.',
        keeper: null, people: [], cards: [],
    };
}

// ---------------------------------------------------------------------------------------
// Las escenas.

/**
 * Las respuestas de la escena que deciden algo, por trabajo: en qué paso están y qué da cada una.
 * El resto de los pasos solo cuentan.
 */
export const CHOICES = {
    mesas: { beat: 1, tags: ['propinas', 'rumor'] },
    forja: { beat: 1, tags: ['monedas', 'arma'] },
    leer: { beat: 1, tags: ['bestiario', 'informes', 'esgrima'] },
    pescar: { beat: 1, tags: ['barcas', 'rocas'] },
    patio: { beat: 0, tags: ['golpes', 'esquivar'] },
    cartas: { beat: -1, tags: [] },
};

/**
 * Lo elegido en la escena, por su etiqueta (`propinas`, `arma`…), o la primera.
 *
 * @param {keyof typeof PASTIMES} id
 * @param {Array<{beat: number, reply: number}>} choices
 * @returns {string}
 */
export function choiceOf(id, choices) {
    const spec = CHOICES[id];
    if (!spec || spec.beat < 0) return '';
    const made = (Array.isArray(choices) ? choices : []).find(c => c.beat === spec.beat);
    return spec.tags[made?.reply ?? 0] ?? spec.tags[0];
}

/**
 * @param {() => number} random
 * @param {any[]} list
 * @returns {any}
 */
const oneOf = (random, list) => list[Math.min(list.length - 1, Math.floor((Number(random()) || 0) * list.length))];

/**
 * La escena corta de un trabajo o un rato, con quien lleva el sitio. Con `{heroe}` y las marcas
 * `{…|…}` por rellenar (`renderScene` de `meetups.js`).
 *
 * @param {keyof typeof PASTIMES} id
 * @param {Object} input
 * @param {string} [input.keeper] Quien lleva el sitio; sin nadie, habla quien toque.
 * @param {string[]} [input.companions] Los nombres de tu gente que viene.
 * @param {string} [input.slot]
 * @param {() => number} [input.random]
 * @returns {import('./meetups.js').Scene}
 */
export function pastimeScene(id, { keeper = '', companions = [], slot = '', random = Math.random }) {
    const who = text(keeper);
    const mates = sayList((companions ?? []).map(firstName));
    const many = (companions ?? []).length > 1;
    const night = text(slot) === 'night';
    /** @type {any[]} */
    let beats = [];
    let speaker = who;
    switch (id) {
        case 'mesas': {
            const open = night
                ? { note: 'Es de noche y no cabe un alma: arrieros, marineros y algún jugador de cartas. Te atas un delantal.', say: '«Hoy no damos abasto. Tú a las mesas; yo, a la barra.»' }
                : oneOf(random, [
                    { note: 'Te atas un delantal y coges la primera bandeja. A media tarde, la taberna empieza a llenarse.', say: '«Las jarras, a la mesa del fondo. Y cobra antes de servir la segunda ronda.»' },
                    { note: 'Llega una caravana y la taberna se llena de golpe. Te dan un delantal y una bandeja.', say: '«Sonríe, sirve y no te dejes engañar con las cuentas.»' },
                ]);
            beats = [
                { ...open, note: mates ? `${open.note} ${mates} ${many ? 'echan' : 'echa'} una mano detrás de la barra.` : open.note },
                {
                    note: 'Al rato vas de mesa en mesa con tres jarras en cada mano.',
                    say: '«¿Cómo lo llevas? Pareces {nacido|nacida} para esto.»',
                    replies: [
                        { text: 'Deprisa, de mesa en mesa: las propinas no se cobran solas.', bond: 0, then: '«Así me gusta. Con esa prisa, hoy te llevas algo más.»', mood: 'alegre' },
                        { text: 'Con calma, y con la oreja puesta en lo que se habla.', bond: 0, then: '«Mientras no se enfríe la sopa, escucha lo que quieras.»' },
                    ],
                },
                { note: `Cuando la taberna se vacía, ${who || 'quien la lleva'} cuenta las monedas y te da tu parte.`, say: '«Buen trabajo. Vuelve cuando quieras.»', mood: 'alegre' },
            ];
            break;
        }
        case 'forja': {
            const open = oneOf(random, [
                { note: `La fragua ya está encendida. ${who} te da unos guantes de cuero y señala el fuelle.`, say: '«Tú dale al fuelle, que yo golpeo. Y no te acerques al yunque sin mirar.»' },
                { note: 'Hay un montón de herraduras por hacer y un par de espadas melladas sobre la mesa.', say: '«Hoy hay trabajo de sobra. Sujeta la pieza con las tenazas y no la sueltes.»' },
            ]);
            beats = [
                { ...open, note: mates ? `${open.note} ${mates} ${many ? 'acarrean' : 'acarrea'} carbón y agua.` : open.note },
                {
                    note: `Al acabar, ${who} se seca el sudor y mira lo que habéis hecho.`,
                    say: '«No está mal para no ser del oficio. ¿Te pago en monedas o te lo guardo para tu arma?»',
                    replies: [
                        { text: 'En monedas, que el camino es largo.', bond: 0, then: '«Monedas, pues. Aquí tienes.»' },
                        { text: 'Guárdamelo para mi arma.', bond: 0, then: '«Hecho. Unos días más como hoy y te la dejo mejor que nueva.»', mood: 'alegre' },
                    ],
                },
            ];
            break;
        }
        case 'cartas': {
            speaker = who || 'Un tahúr';
            beats = [
                {
                    note: `En una mesa del rincón se juega a mayor o menor. ${speaker} baraja y te hace sitio.${mates ? ` ${mates} ${many ? 'se sientan' : 'se sienta'} a mirar.` : ''}`,
                    say: '«Saco una carta. Tú dices si la siguiente es mayor o menor. Si aciertas, el bote crece; si fallas o sale igual, lo pierdes. Tras cada acierto puedes plantarte y cobrar.»',
                },
            ];
            break;
        }
        case 'leer': {
            speaker = who || 'La sala del gremio';
            beats = [
                {
                    note: `${who ? `${who} te abre` : 'Abres'} la sala de los libros: informes de otras compañías, mapas viejos y un bestiario con las esquinas gastadas.${mates ? ` ${mates} ${many ? 'cogen' : 'coge'} un libro también.` : ''}`,
                    say: who ? '«Aquí aprende quien no quiere morir en su primera cueva. Coge lo que quieras y devuélvelo a su sitio.»' : '',
                },
                {
                    note: `Te sientas junto a la ventana. ¿Qué lees ${night ? 'esta noche' : text(slot) === 'morning' ? 'esta mañana' : 'esta tarde'}?`,
                    say: '',
                    replies: [
                        { text: 'El bestiario: qué come cada bicho y dónde le duele.', bond: 0, then: who ? '«Buena elección. Lo que sabes de un bicho es un golpe que no te dan.»' : 'Apuntas lo que no sabías.' },
                        { text: 'Los informes de otras compañías.', bond: 0, then: who ? '«Ahí están los errores de otros. Mejor aprenderlos leyendo.»' : 'Hay errores que ya no cometerás.' },
                        { text: 'Un manual de esgrima con dibujos.', bond: 0, then: who ? '«Los dibujos no pelean por ti, pero algo enseñan.»' : 'Repites los movimientos con la mano.' },
                    ],
                },
            ];
            break;
        }
        case 'pescar': {
            speaker = 'Un pescador viejo';
            beats = [
                {
                    note: `En la punta del muelle, un pescador viejo te presta una caña y un cubo de cebo.${mates ? ` ${mates} ${many ? 'se sientan' : 'se sienta'} a tu lado con otra caña.` : ''}`,
                    say: '«Aquí pica algo casi siempre. Paciencia, y no hagas ruido.»',
                },
                {
                    note: '¿Dónde echas la caña?',
                    say: '',
                    replies: [
                        { text: 'Junto a las barcas, donde es más seguro.', bond: 0, then: '«Ahí sale poco, pero sale siempre.»' },
                        { text: 'En las rocas, a ver si cae uno grande.', bond: 0, then: '«Ahí o te llevas un buen pez o un buen resfriado.»' },
                    ],
                },
            ];
            break;
        }
        case 'patio': {
            speaker = who || 'Quien enseña en el patio';
            beats = [
                {
                    note: `En el patio hay muñecos de paja, espadas de madera y un barril de agua. ${who ? `${who} se arremanga` : 'Alguien del gremio se arremanga'} y te tira un escudo viejo.${mates ? ` ${mates} ${many ? 'cogen' : 'coge'} un arma de madera.` : ''}`,
                    say: '«Aquí nadie se va sin sudar. ¿Qué quieres practicar hoy?»',
                    replies: [
                        { text: 'Golpes contra el muñeco, hasta que salgan solos.', bond: 0, then: '«Otra vez. Y otra. Así se aprende.»' },
                        { text: 'A esquivar: que no me den.', bond: 0, then: '«Bien pensado. El que no recibe, vuelve a casa.»' },
                    ],
                },
                { note: 'Al acabar te duelen los brazos, pero las manos ya saben lo que hacen.', say: `«Mañana, más. ${night ? 'Ahora a dormir' : 'Ahora, a beber agua'}.»`, mood: 'alegre' },
            ];
            break;
        }
        default:
            beats = [{ note: 'Pasas un rato.', say: '' }];
    }
    return /** @type {import('./meetups.js').Scene} */ (readScene({
        id: `rato-${id}`,
        kind: 'rato',
        who: speaker || 'Alguien',
        rank: 1,
        title: PASTIMES[id]?.label ?? 'Un rato',
        where: PASTIMES[id]?.place ?? '',
        beats,
    }));
}

// ---------------------------------------------------------------------------------------
// Lo que da.

/**
 * @typedef {Object} PastimeResult
 * @property {number} gold El oro que entra (las cartas, aparte).
 * @property {Array<{label: string, amount: number}>} goldParts De dónde sale.
 * @property {Array<{id: string, name: string, amount: number, catchUp?: boolean}>} xp Y si va por detrás (el patio).
 * @property {boolean} rumor Si se oye un rumor.
 * @property {boolean} keeperLikes Si quien lleva el sitio os aprecia más.
 * @property {number} forgeSteps Los días de forja que quedan apuntados.
 * @property {boolean} upgrade Si el herrero mejora un arma hoy.
 * @property {number} fish
 * @property {boolean} eat Si el grupo come de lo pescado.
 * @property {boolean} bigFish
 * @property {string[]} hired Leyendo o en el patio: quien vino y es de alquiler (no gana experiencia: sube con tu héroe).
 * @property {string[]} lines Lo que se cuenta, sin el aprecio ni el rumor (eso lo pone quien llama).
 */

/**
 * Lo que da un trabajo o un rato.
 *
 * @param {keyof typeof PASTIMES} id
 * @param {Object} input
 * @param {string} [input.choice] Lo elegido en la escena (`choiceOf`).
 * @param {{id?: any, name?: string, level?: number}} input.hero
 * @param {Array<{id: any, name: string, level?: number}>} [input.companions] Los que vienen.
 * @param {() => number} [input.random]
 * @param {number} [input.forgeSteps] Los que llevaba quien atiende la herrería.
 * @param {boolean} [input.canUpgrade] Si queda un arma del grupo por mejorar.
 * @param {number} [input.library]
 * @param {number} [input.partySize] Cuántos comen.
 * @param {number} [input.top] En el patio: el nivel del más avanzado de los tuyos (`topLevel` de `guild-training.js`).
 * @param {number} [input.masters] En el patio: los maestros de armas que hay en casa.
 * @returns {PastimeResult}
 */
export function pastimeOutcome(id, { choice = '', hero, companions = [], random = Math.random, forgeSteps = 0, canUpgrade = false, library = 0, partySize = 1, top = 1, masters = 0 }) {
    const level = Math.max(1, Math.floor(Number(hero?.level) || 1));
    const mates = Array.isArray(companions) ? companions : [];
    /** @type {PastimeResult} */
    const out = { gold: 0, goldParts: [], xp: [], rumor: false, keeperLikes: false, forgeSteps: Math.max(0, Number(forgeSteps) || 0), upgrade: false, fish: 0, eat: false, bigFish: false, hired: [], lines: [] };
    /** @param {string} label @param {number} amount */
    const earn = (label, amount) => {
        if (!(amount > 0)) return;
        out.gold += amount;
        out.goldParts.push({ label, amount });
    };
    const wage = WORK_GOLD_BASE + level;
    const helpers = () => { if (mates.length > 0) earn(mates.length === 1 ? `lo de ${firstName(mates[0].name)}` : 'lo de tu gente', HELPER_GOLD * mates.length); };
    const d = (/** @type {number} */ sides) => 1 + Math.min(sides - 1, Math.floor((Number(random()) || 0) * sides));
    switch (id) {
        case 'mesas':
            earn('el jornal', wage);
            if (choice === 'rumor') out.rumor = true;
            else earn('las propinas', 1 + d(3));
            helpers();
            out.keeperLikes = true;
            break;
        case 'forja': {
            if (choice === 'arma') out.forgeSteps += 2;
            else {
                earn('el jornal', wage);
                out.forgeSteps += 1;
            }
            helpers();
            out.keeperLikes = true;
            if (out.forgeSteps >= FORGE_STEPS) {
                out.forgeSteps = 0;
                if (canUpgrade) out.upgrade = true;
                else earn('el trabajo bien hecho', FORGE_BONUS_GOLD);
            }
            break;
        }
        case 'leer': {
            const per = READ_XP_PER_LEVEL + (Number(library) > 0 ? LIBRARY_XP_PER_LEVEL : 0);
            for (const member of [hero, ...mates]) {
                if (!member) continue;
                // Los de alquiler suben de nivel con tu héroe al salir del gremio, no leyendo.
                if (/** @type {any} */ (member).guest) {
                    out.hired.push(text(member.name));
                    continue;
                }
                const lv = Math.max(1, Math.floor(Number(member.level) || 1));
                out.xp.push({ id: String(member.id ?? ''), name: text(member.name), amount: per * lv });
            }
            break;
        }
        case 'pescar': {
            const caught = choice === 'rocas' ? d(6) : 2 + d(2);
            out.bigFish = choice === 'rocas' && caught === 6;
            out.fish = caught + mates.length;
            const mouths = Math.max(1, Math.floor(Number(partySize) || 1));
            out.eat = out.fish >= mouths;
            earn('el pescado que sobra', (out.eat ? out.fish - mouths : out.fish) * FISH_PRICE);
            if (out.bigFish) earn('el pez grande', BIG_FISH_GOLD);
            break;
        }
        case 'patio': {
            // Las reglas del patio del gremio: por nivel, con quien enseña, y el doble a quien va
            // por detrás. Los de alquiler suben con el gremio, no entrenando (`trainees`).
            for (const member of [hero, ...mates]) {
                if (!member || !text(member.name)) continue;
                if (/** @type {any} */ (member).guest) {
                    out.hired.push(text(member.name));
                    continue;
                }
                const gain = sessionXp(member, { top, masters });
                out.xp.push({ id: String(member.id ?? ''), name: text(member.name), amount: gain.xp, ...(gain.catchUp ? { catchUp: true } : {}) });
            }
            break;
        }
        default:
            break;
    }
    out.lines = outcomeLines(id, out, mates);
    return out;
}

/**
 * Lo que se cuenta al acabar: el oro, la experiencia, el pescado, la forja.
 *
 * @param {keyof typeof PASTIMES} id
 * @param {PastimeResult} out
 * @param {Array<{name: string}>} companions Los que vinieron.
 * @returns {string[]}
 */
function outcomeLines(id, out, companions) {
    /** @type {string[]} */
    const lines = [];
    if (id === 'pescar') {
        const fish = out.fish === 1 ? 'un pez' : `${out.fish} peces`;
        lines.push(out.bigFish ? `Sacas ${fish}, y uno enorme que hace girar cabezas en el muelle.` : `Sacas ${fish}.`);
        if (out.eat) lines.push('Coméis pescado fresco: nadie pasa hambre hoy.');
        else lines.push('No da para que coma todo el grupo: lo vendes.');
    }
    if (out.gold > 0) {
        const parts = out.goldParts.map(p => `${p.amount} de ${p.label}`).join(', ');
        lines.push(`+${out.gold} de oro (${parts}).`);
    } else if (id === 'forja') {
        lines.push('Hoy no cobras: el herrero lo apunta para tu arma.');
    }
    for (const gain of out.xp) {
        const behind = gain.catchUp ? ' (va por detrás de los tuyos: aprende el doble)' : '';
        lines.push(`${text(gain.name) || 'Tu héroe'}: +${gain.amount} de experiencia${behind}.`);
    }
    for (const name of out.hired) lines.push(`${firstName(name)} es de alquiler: no gana experiencia, sube de nivel contigo.`);
    if (id === 'forja' && !out.upgrade && out.forgeSteps > 0) {
        const left = FORGE_STEPS - out.forgeSteps;
        lines.push(`Llevas ${out.forgeSteps} de ${FORGE_STEPS} días en la forja: ${left === 1 ? 'uno más' : `${left} más`} y te mejora un arma sin cobrar.`);
    }
    if (companions.length > 0) lines.push(`${sayList([...companions.map(m => firstName(m.name)), 'tú'])}, un poco más cerca.`);
    return lines;
}

/**
 * Lo que se apunta en el diario al acabar: una línea.
 *
 * @param {keyof typeof PASTIMES} id
 * @param {{hero: string, slot: string, place: string, gold?: number, net?: number}} input
 * @returns {string}
 */
export function pastimeLog(id, { hero, slot, place, gold = 0, net = 0 }) {
    const name = text(hero) || 'Tu héroe';
    const when = slotWords(slot);
    const coins = gold > 0 ? `: +${gold} de oro` : '';
    switch (id) {
        case 'mesas': return `🍺 [TABERNA] ${name} sirve mesas toda ${when} en ${text(place) || 'la taberna'}${coins}.`;
        case 'forja': return `⚒️ [HERRERÍA] ${name} echa una mano en la forja toda ${when}${coins}.`;
        case 'cartas': return `🃏 [TABERNA] ${name} juega a las cartas ${when === 'la noche' ? 'por la noche' : 'por la tarde'}: ${net > 0 ? `gana ${net} de oro` : net < 0 ? `pierde ${-net} de oro` : 'ni gana ni pierde'}.`;
        case 'leer': return `📖 [GREMIO] ${name} pasa ${when} leyendo en el gremio.`;
        case 'pescar': return `🎣 [MUELLE] ${name} pasa ${when} pescando en el muelle${coins}.`;
        case 'patio': return `🏋️ [GREMIO] ${name} entrena toda ${when} en el patio del gremio.`;
        default: return '';
    }
}
