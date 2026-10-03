/**
 * El gremio que paga (E5 de wiki/ROADMAP_ENTRETENIDO.md): que la casa dé ventajas de verdad en
 * el campo, que el banquillo se use y que los que mandas fuera vuelvan a contarlo.
 *
 * - **E5.1, lo que dan los edificios**, para la próxima salida:
 *   - la forja **templa la armadura**: +1 a la clase de armadura hasta volver a casa;
 *   - la cocina prepara **raciones**: el caldo fuerte (la primera salvación de la salida, con
 *     ventaja) o el guiso de camino (un dado de golpe más para los descansos);
 *   - la biblioteca vende **libros de bichos** de una campaña del tablón: lo que aguantan, lo que
 *     les duele y cómo pelean, sabido antes de salir y a la vista en la tarjeta del enemigo.
 *   Lo de la forja y la cocina va en la ficha (`guildPrep`) y se acaba al volver al gremio; los
 *   libros se quedan en la biblioteca (`guildBooks`, de la partida entera).
 * - **E5.2, el banquillo se usa**: quien encadena salidas vuelve **cansado del camino** (una
 *   herida de días, como las demás: se ve en la ficha y cura con el tiempo) y la enfermería
 *   hace que quien se queda en casa cure antes. Así conviene rotar.
 * - **E5.3, mandar gente a encargos**: lo resuelve `dispatch.js`; aquí, la tarjeta de informe
 *   que cuentan ellos al volver (lo que ganaron, un camino nuevo en el mapa o lo que pasó).
 *
 * Cosecha propia moderada (D-J58): el temple, las raciones y el cansancio no son reglas de 5e.
 * El cansancio imita el agotamiento de 5e en lo que el motor ya juega (velocidad y fuerza).
 *
 * Puro: dice qué se ofrece, cómo queda la ficha y qué dice cada uno. Quien llama cobra y guarda.
 */

import { readGuild } from './guild.js';
import { payPlan } from './guild-chest.js';
import { gendered } from './grammar.js';
import { readInjuries } from '../rules/injuries.js';
import { studyFacts } from '../rules/actions-2024.js';

/** En los metadatos: los libros de bichos de la biblioteca (de la partida entera). */
export const GUILD_BOOKS_KEY = 'guildBooks';

/** El temple de la forja: lo que cuesta, la forja que pide y lo que da. */
export const TEMPER = { cost: 40, forge: 1, bonus: 1 };

/** Las raciones de la cocina. Cada uno lleva una por salida. */
export const RATIONS = {
    caldo: { label: 'Caldo fuerte', cost: 15, what: 'la primera salvación de la salida la tira con ventaja' },
    guiso: { label: 'Guiso de camino', cost: 20, what: 'un dado de golpe más para los descansos de la salida' },
};

/** Lo que cuesta un libro de bichos en la biblioteca (baja con el nivel). */
export const BOOK_COST = 60;

/** El cansancio del camino: a partir de cuántas salidas seguidas, cómo se llama y cuánto dura. */
export const FATIGUE_STEPS = [
    { outings: 3, id: 'cansancio', label: 'Molido del camino', fem: 'Molida del camino', description: 'Tres salidas seguidas sin parar en casa.', modifiers: { speed: -10, strength: -2, dexterity: -2 }, days: 9 },
    { outings: 2, id: 'cansancio', label: 'Cansado del camino', fem: 'Cansada del camino', description: 'Dos salidas seguidas sin parar en casa.', modifiers: { speed: -5, strength: -1, dexterity: -1 }, days: 5 },
];

/** Los días seguidos en casa que borran las salidas encadenadas. */
export const HOME_REST_DAYS = 7;

/** Lo que tiene que durar una salida para cansar: volver a por algo no cuenta. */
export const OUTING_MIN_DAYS = 3;

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {number} */
const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));

/** @param {any} guild @param {string} key @returns {number} */
const levelIn = (guild, key) => whole(readGuild(guild).buildings[key]);

/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value : []);

/** @param {any[]} members @returns {any[]} */
const living = (members) => list(members).filter(m => m && !m.dead && text(m.name));

// ---- Los preparativos de la ficha -------------------------------------------------------

/**
 * @typedef {Object} GuildPrep Lo que la casa le ha dado a alguien para la próxima salida.
 * @property {number} temper +CA del temple de la forja.
 * @property {''|'caldo'|'guiso'} ration
 */

/**
 * Lo que lleva alguien preparado en casa.
 *
 * @param {any} member
 * @returns {GuildPrep}
 */
export function prepOf(member) {
    const raw = member?.guildPrep && typeof member.guildPrep === 'object' ? member.guildPrep : {};
    const ration = text(raw.ration);
    return { temper: Math.min(TEMPER.bonus, whole(raw.temper)), ration: ration === 'caldo' || ration === 'guiso' ? ration : '' };
}

/**
 * Lo que suma lo preparado en casa: `armorClass` (el temple) o `hitDice` (el guiso).
 *
 * @param {any} member
 * @param {'armorClass'|'hitDice'} kind
 * @returns {number}
 */
export function prepBonus(member, kind) {
    const prep = prepOf(member);
    if (kind === 'armorClass') return prep.temper;
    if (kind === 'hitDice') return prep.ration === 'guiso' ? 1 : 0;
    return 0;
}

/**
 * El caldo fuerte se gasta en la primera salvación. Dice si lo tenía y cómo queda lo preparado.
 *
 * @param {any} member
 * @returns {{used: boolean, guildPrep: GuildPrep|null, line: string}}
 */
export function takeBroth(member) {
    const prep = prepOf(member);
    if (prep.ration !== 'caldo') return { used: false, guildPrep: member?.guildPrep ?? null, line: '' };
    const next = { ...prep, ration: /** @type {''} */ ('') };
    return {
        used: true,
        guildPrep: next.temper > 0 ? next : null,
        line: `🍲 El caldo de la cocina del gremio: ${text(member?.name) || 'Alguien'} salva con ventaja.`,
    };
}

/**
 * Lo preparado, dicho para la ficha y la ventana de la casa.
 *
 * @param {any} member
 * @returns {string[]}
 */
export function describePrep(member) {
    const prep = prepOf(member);
    return [
        prep.temper > 0 ? `Armadura templada en la forja: +${prep.temper} a la CA hasta volver al gremio.` : '',
        prep.ration ? `${RATIONS[prep.ration].label}: ${RATIONS[prep.ration].what}.` : '',
    ].filter(Boolean);
}

/**
 * Si alguien lleva una armadura o un escudo que templar.
 *
 * @param {any} member
 * @returns {any|null}
 */
function armorOf(member) {
    return list(member?.items).find(item => item && ['body', 'shield'].includes(text(item.slot)) && whole(item.armorClass) > 0) ?? null;
}

/**
 * @typedef {Object} PrepOffer
 * @property {string} memberId
 * @property {string} memberName
 * @property {string} kind `temple`, `caldo` o `guiso`.
 * @property {string} label Lo que se lee.
 * @property {number} cost
 * @property {boolean} ok
 * @property {string} why Por qué no, si no se puede.
 */

/**
 * E5.1: lo que la forja y la cocina pueden preparar a cada uno para la próxima salida.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {any[]} input.party
 * @param {number} input.purse
 * @returns {{forge: number, kitchen: number, temper: PrepOffer[], rations: PrepOffer[]}}
 */
export function prepOffers({ guild, party, purse }) {
    const forge = levelIn(guild, 'forge');
    const kitchen = levelIn(guild, 'kitchen');
    /** @type {PrepOffer[]} */
    const temper = [];
    /** @type {PrepOffer[]} */
    const rations = [];
    const pay = (/** @type {number} */ cost) => payPlan({ cost, guild, purse });
    for (const member of living(party).filter(m => !m.guest)) {
        const base = { memberId: text(member.id), memberName: text(member.name) };
        const prep = prepOf(member);
        if (forge > 0) {
            const armor = armorOf(member);
            const plan = pay(TEMPER.cost);
            const why = !armor ? 'No lleva armadura ni escudo que templar.'
                : prep.temper > 0 ? 'Ya la lleva templada para esta salida.'
                    : plan.ok ? '' : plan.line;
            temper.push({
                ...base, kind: 'temple', cost: TEMPER.cost, ok: !why, why,
                label: armor ? `Templar ${text(armor.name)}: +${TEMPER.bonus} a la CA hasta volver` : 'Templar la armadura',
            });
        }
        if (kitchen > 0) {
            for (const [kind, ration] of Object.entries(RATIONS)) {
                // Cuanto mejor la cocina, más barato: 5 de oro menos por nivel.
                const cost = Math.max(5, ration.cost - 5 * (kitchen - 1));
                const plan = pay(cost);
                const why = prep.ration === kind ? 'Ya lo lleva para esta salida.'
                    : prep.ration ? `Ya lleva ${RATIONS[prep.ration].label.toLowerCase()}: una ración por salida.`
                        : plan.ok ? '' : plan.line;
                rations.push({ ...base, kind, cost, ok: !why, why, label: `${ration.label}: ${ration.what}` });
            }
        }
    }
    return { forge, kitchen, temper, rations };
}

/**
 * Preparar algo a alguien: cómo queda su `guildPrep` y qué se cuenta.
 *
 * @param {Object} input
 * @param {any} input.member
 * @param {string} input.kind `temple`, `caldo` o `guiso`.
 * @param {any} input.guild
 * @param {number} input.purse
 * @returns {{ok: boolean, reason: string, guildPrep: GuildPrep|null, cost: number, line: string}}
 */
export function prepareFor({ member, kind, guild, purse }) {
    const offers = prepOffers({ guild, party: [member], purse });
    const offer = [...offers.temper, ...offers.rations].find(o => o.kind === text(kind));
    const fail = (/** @type {string} */ reason) => ({ ok: false, reason, guildPrep: member?.guildPrep ?? null, cost: 0, line: '' });
    if (!offer) return fail(kind === 'temple' ? 'Sin forja no se templa nada.' : 'Sin cocina no hay raciones.');
    if (!offer.ok) return fail(offer.why);
    const prep = prepOf(member);
    const name = text(member?.name);
    if (kind === 'temple') {
        return {
            ok: true, reason: '', cost: offer.cost,
            guildPrep: { ...prep, temper: TEMPER.bonus },
            line: `En la forja del gremio templan la armadura de ${name}: +${TEMPER.bonus} a la CA hasta volver. ${offer.cost} de oro.`,
        };
    }
    const ration = RATIONS[/** @type {'caldo'|'guiso'} */ (kind)];
    return {
        ok: true, reason: '', cost: offer.cost,
        guildPrep: { ...prep, ration: /** @type {'caldo'|'guiso'} */ (kind) },
        line: `En la cocina del gremio le preparan a ${name} ${ration.label.toLowerCase()}: ${ration.what}. ${offer.cost} de oro.`,
    };
}

// ---- Los libros de bichos -----------------------------------------------------------------

/**
 * @typedef {Object} BeastBook
 * @property {string} id La campaña del tablón.
 * @property {string} title
 * @property {Array<{name: string, facts: string[]}>} creatures
 */

/**
 * Los libros de la biblioteca, leídos.
 *
 * @param {any} raw
 * @returns {BeastBook[]}
 */
export function readBooks(raw) {
    return list(raw).filter(b => b && text(b.id) && Array.isArray(b.creatures)).map(b => ({
        id: text(b.id),
        title: text(b.title) || 'Un libro de bichos',
        creatures: list(b.creatures).filter(c => c && text(c.name)).map(c => ({ name: text(c.name), facts: list(c.facts).map(text).filter(Boolean) })),
    }));
}

/**
 * El libro de bichos de una campaña: lo que se sabe de cada uno de su bestiario.
 *
 * @param {{id: string, name: string, bestiary: any[]}} world
 * @returns {BeastBook}
 */
export function writeBook(world) {
    return {
        id: text(world?.id),
        title: `Bichos de «${text(world?.name) || text(world?.id)}»`,
        creatures: list(world?.bestiary).filter(row => row && text(row.name)).map(row => ({
            name: text(row.name),
            facts: studyFacts(row).filter(f => f.key !== 'nada').map(f => f.text),
        })).filter(c => c.facts.length > 0),
    };
}

/**
 * E5.1: los libros que vende la biblioteca: uno por campaña del tablón que tenga bichos.
 *
 * @param {Object} input
 * @param {any} input.guild
 * @param {Array<{id: string, name: string, bestiary?: any[]}>} input.worlds Las campañas del tablón, con su bestiario.
 * @param {any} input.books Los que ya hay.
 * @param {number} input.purse
 * @returns {{level: number, offers: Array<{id: string, title: string, count: number, cost: number, ok: boolean, why: string, owned: boolean}>, empty: string}}
 */
export function bookOffers({ guild, worlds, books, purse }) {
    const level = levelIn(guild, 'library');
    if (level === 0) return { level, offers: [], empty: 'Sin biblioteca no hay libros de bichos: levántala arriba.' };
    const owned = new Set(readBooks(books).map(b => b.id));
    const cost = Math.max(20, BOOK_COST - 15 * (level - 1));
    const offers = list(worlds).filter(w => w && text(w.id)).map(world => {
        const book = writeBook({ id: text(world.id), name: text(world.name), bestiary: list(world.bestiary) });
        const plan = payPlan({ cost, guild, purse });
        const have = owned.has(book.id);
        const why = have ? 'Ya está en la biblioteca.' : book.creatures.length === 0 ? 'De esa campaña no se sabe nada todavía.' : plan.ok ? '' : plan.line;
        return { id: book.id, title: book.title, count: book.creatures.length, cost, ok: !why, why, owned: have };
    }).filter(o => o.count > 0 || o.owned);
    return { level, offers, empty: offers.length === 0 ? 'No hay campañas en el tablón de las que escribir.' : '' };
}

/**
 * Lo que dicen los libros de un enemigo, por su nombre («Lobo 2» es «Lobo»).
 *
 * @param {any} books
 * @param {string} name
 * @returns {{title: string, facts: string[]}|null}
 */
export function bookFactsFor(books, name) {
    const fold = (/** @type {any} */ v) => text(v).toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+\d+$/, '');
    const wanted = fold(name);
    if (!wanted) return null;
    for (const book of readBooks(books)) {
        const creature = book.creatures.find(c => fold(c.name) === wanted);
        if (creature) return { title: book.title, facts: creature.facts };
    }
    return null;
}

// ---- El cansancio y la enfermería ---------------------------------------------------------

/**
 * Las salidas seguidas sin parar en casa.
 *
 * @param {any} member
 * @returns {number}
 */
export function outingsOf(member) {
    return whole(member?.outings);
}

/**
 * La herida del cansancio para tantas salidas seguidas, o null si aún aguanta.
 *
 * @param {number} outings
 * @param {any} [member] Para decirlo en su género: «Cansada del camino».
 * @returns {any|null}
 */
export function fatigueInjury(outings, member = null) {
    const step = FATIGUE_STEPS.find(s => whole(outings) >= s.outings);
    if (!step) return null;
    const { id, description, modifiers, days } = step;
    const label = member ? gendered(member, step.label, step.fem) : step.label;
    return { id, label, description: `${description} Se le pasa con días de descanso.`, modifiers: { ...modifiers }, days };
}

/**
 * E5.2: lo que cuenta una vuelta a casa para cada uno: los que fueron suman una salida (si la
 * salida fue de verdad), y los que se quedaron, la borran.
 *
 * @param {Object} input
 * @param {any[]} input.went Los que vuelven.
 * @param {any[]} input.stayed Los que esperaban en casa.
 * @param {number} input.days Lo que duró la salida.
 * @returns {{went: Array<{id: string, outings: number, injury: any|null}>, stayed: string[]}}
 */
export function homecomingFatigue({ went, stayed, days }) {
    const counts = whole(days) >= OUTING_MIN_DAYS;
    return {
        went: living(went).map(member => {
            const outings = outingsOf(member) + (counts ? 1 : 0);
            return { id: text(member.id), outings, injury: counts ? fatigueInjury(outings, member) : null };
        }),
        stayed: living(stayed).filter(m => outingsOf(m) > 0).map(m => text(m.id)),
    };
}

/**
 * Los días que cura en casa quien está en la enfermería: uno más por cada nivel.
 *
 * @param {any} guild
 * @param {number} days
 * @returns {number}
 */
export function infirmaryDays(guild, days) {
    return whole(days) * (1 + levelIn(guild, 'infirmary'));
}

// ---- Quién está para salir ----------------------------------------------------------------

/**
 * @typedef {Object} RestRow
 * @property {string} id
 * @property {string} name
 * @property {'grupo'|'casa'|'fuera'} where
 * @property {string} state Una línea llana: «Herida: pierna rota, 6 días».
 * @property {string} says Lo que dice esa persona (vacío si está fuera).
 * @property {'alegre'|'neutral'|'triste'} mood
 * @property {boolean} tired
 * @property {boolean} hurt
 * @property {boolean} hero
 */

/**
 * E5.2: quién está para salir y quién necesita casa, dicho por cada uno.
 *
 * @param {Object} input
 * @param {any[]} input.party
 * @param {any[]} input.bench
 * @param {any[]} [input.away] Los despachos en marcha (`dispatch.js`).
 * @param {any} input.guild
 * @returns {RestRow[]}
 */
export function restRoster({ party, bench, away = [], guild }) {
    const infirmary = levelIn(guild, 'infirmary');
    const heroId = text(living(party)[0]?.id);
    /** @type {RestRow[]} */
    const rows = [];
    const row = (/** @type {any} */ member, /** @type {'grupo'|'casa'} */ where) => {
        const injuries = readInjuries(member).filter(i => !i.permanent && i.daysLeft > 0);
        const tiredBy = injuries.find(i => i.id === 'cansancio');
        const wounds = injuries.filter(i => i.id !== 'cansancio' && i.id !== 'exhaustion');
        const outings = outingsOf(member);
        const ready = gendered(member, 'listo', 'lista');
        const pace = where === 'casa' && infirmary > 0 ? ' En la enfermería curo más deprisa.' : '';
        /** @type {RestRow['mood']} */
        let mood = 'alegre';
        let says = `Estoy ${ready}. Cuando quieras, salimos.`;
        if (wounds.length > 0) {
            const worst = [...wounds].sort((a, b) => b.daysLeft - a.daysLeft)[0];
            mood = 'triste';
            says = `Todavía me duele: ${worst.label.toLowerCase()}. ${worst.daysLeft === 1 ? 'Un día más' : `${worst.daysLeft} días más`} y vuelvo a estar bien.${pace}`;
        } else if (tiredBy) {
            mood = 'triste';
            says = `Llevo ${outings > 1 ? `${outings} salidas` : 'demasiadas salidas'} seguidas. Déjame ${tiredBy.daysLeft === 1 ? 'un día' : `${tiredBy.daysLeft} días`} en casa y vuelvo como nuevo.`;
        } else if (outings >= 1 && where === 'grupo') {
            mood = 'neutral';
            says = 'Aguanto otra salida, pero a la siguiente necesitaré parar en casa.';
        } else if (where === 'casa') {
            says = `Aquí estoy, ${gendered(member, 'descansado', 'descansada')}. Si hace falta, me llamas.`;
        }
        const state = [
            ...wounds.map(w => `${w.label}, ${w.daysLeft === 1 ? '1 día' : `${w.daysLeft} días`}`),
            ...(tiredBy ? [`${tiredBy.label}, ${tiredBy.daysLeft === 1 ? '1 día' : `${tiredBy.daysLeft} días`}`] : []),
            ...(!tiredBy && outings > 0 ? [outings === 1 ? '1 salida seguida' : `${outings} salidas seguidas`] : []),
        ].join(' · ') || 'Entero';
        rows.push({
            id: text(member.id), name: text(member.name), where, state, says, mood,
            tired: Boolean(tiredBy), hurt: wounds.length > 0, hero: text(member.id) === heroId,
        });
    };
    for (const member of living(party)) row(member, 'grupo');
    for (const member of living(bench)) row(member, 'casa');
    for (const dispatch of list(away)) {
        for (const member of living(dispatch?.members)) {
            rows.push({
                id: text(member.id), name: text(member.name), where: 'fuera',
                state: `Fuera, en «${text(dispatch.contract?.title) || 'un encargo'}»: vuelve el día ${whole(dispatch.backOn)}`,
                says: '', mood: 'neutral', tired: false, hurt: false, hero: false,
            });
        }
    }
    return rows;
}

/**
 * La línea de la sala para «Quién está para salir».
 *
 * @param {RestRow[]} rows
 * @param {number} [reports] Los informes que esperan.
 * @returns {string}
 */
export function restDetail(rows, reports = 0) {
    const tired = rows.filter(r => r.tired).length;
    const hurt = rows.filter(r => r.hurt).length;
    const away = rows.filter(r => r.where === 'fuera').length;
    return [
        reports > 0 ? (reports === 1 ? 'Alguien ha vuelto y te espera' : `${reports} informes te esperan`) : '',
        hurt > 0 ? `${hurt} ${hurt === 1 ? 'herido' : 'heridos'}` : '',
        tired > 0 ? `${tired} ${tired === 1 ? 'cansado' : 'cansados'}` : '',
        away > 0 ? `${away} fuera` : '',
    ].filter(Boolean).join(' · ') || 'Todos enteros';
}

// ---- El informe de los que vuelven --------------------------------------------------------

/** Lo que pasó por el camino, por clase de encargo. Lo dice quien vuelve. */
const ANECDOTES = {
    cull: ['Eran más de los que decía el aviso. Al final, el último salió corriendo.', 'Dormimos en un pajar. Las pulgas pelearon mejor que ellos.'],
    hunt: ['Le seguimos el rastro dos días. Estaba más flaco de lo que contaban.', 'Lo encontramos bebiendo en el río. Ni nos oyó llegar.'],
    escort: ['No paró de hablar en todo el camino. Por lo menos invitaba a pan.', 'Una rueda del carro se partió a medio camino. La arreglamos con una rama.'],
    recover: ['Estaba donde decían, debajo de un montón de trastos viejos.', 'Hubo que regatear con quien lo tenía. Al final se lo dejó por poco.'],
    hold: ['Tres noches de guardia y nadie vino. La cuarta, sí.', 'Hacía un frío que no se iba ni con la hoguera.'],
    steal: ['Nadie vio nada. Bueno, un perro. Le di la mitad de mi cena.', 'Entramos por la ventana de la cocina. Olía a cebolla.'],
    silence: ['No hizo falta llegar a las manos: se fue del pueblo esa misma noche.', 'Fue rápido. No quiero hablar mucho de ello.'],
};

/** Lo que pasó cuando sale mal. */
const BAD_DAYS = ['Nos esperaban. Alguien les había avisado.', 'El camino estaba cortado y llegamos tarde.', 'Eran demasiados. Hubo que salir corriendo.'];

/**
 * @typedef {Object} DispatchReport Lo que se guarda de una vuelta, para contarla en el gremio.
 * @property {string} id
 * @property {string} title El encargo.
 * @property {string} kind
 * @property {Array<{id: string, name: string, gender?: string}>} members Los que vuelven (y el que no).
 * @property {boolean} success
 * @property {number} reward
 * @property {{id: string, label: string, days: number}|null} hurt
 * @property {string} dead El nombre del que no vuelve.
 * @property {number} renown Lo que sube el renombre.
 * @property {boolean} map Si por el camino dieron con algo que no salía en el mapa.
 * @property {number} pick Qué anécdota (0..1).
 */

/**
 * Lo que se apunta al resolver un despacho, para la tarjeta de informe.
 *
 * @param {Object} input
 * @param {any} input.dispatch
 * @param {{success: boolean, reward: number, hurt: string, dead: string}} input.result
 * @param {{label: string, days: number}|null} [input.injury] La herida de quien vuelve herido.
 * @param {number} [input.renown]
 * @param {() => number} input.random
 * @returns {DispatchReport}
 */
export function dispatchReport({ dispatch, result, injury = null, renown = 0, random }) {
    const members = living(dispatch?.members).map(m => ({ id: text(m.id), name: text(m.name), gender: text(m.gender) }));
    const hurtMember = members.find(m => m.id === text(result?.hurt));
    const deadMember = members.find(m => m.id === text(result?.dead));
    return {
        id: text(dispatch?.id),
        title: text(dispatch?.contract?.title) || 'el encargo',
        kind: text(dispatch?.contract?.kind),
        members,
        success: Boolean(result?.success),
        reward: whole(result?.reward),
        hurt: hurtMember && injury ? { id: hurtMember.id, label: text(injury.label), days: whole(injury.days) } : null,
        dead: deadMember ? deadMember.name : '',
        renown: whole(renown),
        map: Boolean(result?.success) && random() < 0.35,
        pick: random(),
    };
}

/**
 * La tarjeta de informe: una escena corta que cuentan los que vuelven (D-J60: sin narrador).
 *
 * @param {DispatchReport} report
 * @param {{revealed?: string, messenger?: string}} [extra] El sitio que sale en el mapa, si sale;
 *   quién trae la noticia si no vuelve nadie.
 * @returns {import('./plot-scenes.js').PlotScene}
 */
export function reportScene(report, { revealed = '', messenger = 'Un mensajero del gremio' } = {}) {
    const back = report.members.filter(m => m.name !== report.dead);
    const first = back[0] ?? null;
    const second = back[1] ?? first;
    /** @type {import('./plot-scenes.js').SceneBeat[]} */
    const beats = [];
    const say = (/** @type {string} */ who, /** @type {string} */ mood, /** @type {string} */ line) => {
        beats.push({ who, mood, text: line.replace(/\s+/g, ' ').trim(), decision: null });
    };
    const we = back.length > 1;
    if (!first) {
        // No vuelve nadie: lo trae alguien del gremio.
        say(messenger, 'triste', `Traigo malas noticias de «${report.title}». ${report.dead} no vuelve. Lo siento.`);
    } else if (report.success) {
        say(first.name, 'alegre', `Ya ${we ? 'estamos' : 'estoy'} de vuelta. «${report.title}»: hecho.${report.reward > 0 ? ` Aquí tienes ${report.reward} de oro.` : ''}`);
        if (revealed) {
            say(second.name, 'alegre', `Volviendo dimos con el camino a ${revealed}. Te lo he marcado en el mapa.`);
        } else {
            const pool = /** @type {Record<string, string[]>} */ (ANECDOTES)[report.kind] ?? ANECDOTES.escort;
            say(second.name, 'neutral', pool[Math.floor(report.pick * pool.length) % pool.length]);
        }
        if (report.renown > 0) say(first.name, 'alegre', 'Y en el pueblo ya se habla del gremio. Bien, ¿no?');
    } else {
        say(first.name, 'triste', `${we ? 'Volvemos' : 'Vuelvo'} de «${report.title}» con las manos vacías. ${BAD_DAYS[Math.floor(report.pick * BAD_DAYS.length) % BAD_DAYS.length]}`);
        if (report.dead) say(second.name, 'triste', `${report.dead} no vuelve. No pudimos hacer nada.`);
    }
    if (report.hurt) {
        const hurt = report.members.find(m => m.id === report.hurt?.id);
        if (hurt && hurt.name !== report.dead) {
            say(hurt.name, 'triste', `Me llevé un golpe: ${report.hurt.label.toLowerCase()}. ${report.hurt.days > 0 ? `Unos ${report.hurt.days} días en casa y vuelvo a estar bien.` : 'Esto no se cura del todo.'}`);
        }
    }
    return {
        kind: 'scene',
        id: `informe-${report.id}`,
        title: report.success ? `De vuelta de «${report.title}»` : `Malas noticias de «${report.title}»`,
        text: beats.map(b => `${b.who}: ${b.text}`).join(' '),
        beats,
        dialogue: null,
        backdrop: { place: '', town: '' },
    };
}
