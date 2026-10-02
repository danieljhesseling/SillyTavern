/**
 * Hilos con fondo para las campañas sin escribir (J10.7 de wiki/ROADMAP_SIN_CONEXION.md, que es
 * la Z5 de wiki/archivo/ROADMAP_SIN_TOKENS.md).
 *
 * Una campaña sin hilo escrito (un mundo hecho con la semilla, o una de tu Gem que solo trae
 * sitios y gente) recibía el hilo de su facción más peligrosa: cuatro hitos de una línea
 * (`plotFromFaction`). Se notaba hecho con plantilla. Aquí se escribe una historia en **tres
 * actos** con lo que ese mundo tiene (sus sitios, sus facciones y su gente) y las plantillas de
 * `compendio/actos.json`:
 *
 * 1. **El gancho**: algo pasa en el sitio donde se empieza (una escena), alguien lo vio (hablar
 *    con él) y hay que reunir pistas repartidas por los sitios (dos de tres, cada una con su
 *    tirada al examinar algo de ese sitio). Las pistas llevan a una guarida escondida.
 * 2. **La complicación**: en la guarida se pelea, y lo que se encuentra lo cambia todo: el
 *    villano no actúa sin ayuda. Una escena con una decisión de verdad: llevar lo encontrado a
 *    quien quiere justicia (el bando A) o venderlo a quien ofrece un trato (el bando B). Se
 *    decide en la escena, o yendo a hablar con uno de los dos; elegir a uno cierra al otro.
 * 3. **El desenlace**: el villano (una persona o una bestia) espera en su refugio, con su
 *    tablero. Derrotarlo acaba la campaña con el final del bando que elegiste. Y si el bando B
 *    llena su reloj antes, llegasteis tarde: un tercer final.
 *
 * Los hitos tienen el formato de `plot.js` (con escenas jugadas, J9.2), los capítulos (J9.3),
 * el presagio (idea 114), el villano que asoma entre actos (idea 115) y rumores que apuntan a
 * las pistas. Lo que la historia necesita y el mundo no tiene se añade: la gente (quien lo vio,
 * los dos contactos y quien estaba en la guarida), los dos sitios escondidos, lo que se examina
 * en cada sitio de pista y el tablero de la guarida. El del refugio, y los bichos, los pone
 * `pack-fill.js` como a cualquier campaña de tu Gem.
 *
 * D-J54: las escenas las dice la gente (novela visual): quien lo vio en el acto 1, los de la
 * guarida y quien tenían allí en el acto 2, y el contacto del bando al abrir el acto 3. El
 * narrador solo dice el sitio en una línea corta cuando no hay nadie que hable (una bestia).
 *
 * Todo con la semilla: la misma campaña da siempre la misma historia, y otra semilla, otra.
 *
 * Puro: recibe el paquete y el compendio, y devuelve el paquete con su hilo.
 */

import { createSeededRandom } from '../combat/seeded-random.js';
import { pickWeighted } from '../compendio/compendio.js';
import { makeName } from '../compendio/names.js';
import { derive, cleanSeed } from './seed.js';

/** Los ids de lo que pone la gramática empiezan así: no chocan con los de un paquete. */
export const ACT_PREFIX = 'actos-';

/** Los ids de los hitos, por su papel. */
export const ACT_IDS = {
    hook: `${ACT_PREFIX}gancho`,
    witness: `${ACT_PREFIX}testigo`,
    clues: `${ACT_PREFIX}pistas`,
    lair: `${ACT_PREFIX}guarida`,
    strike: `${ACT_PREFIX}golpe`,
    crossroads: `${ACT_PREFIX}encrucijada`,
    sideA: `${ACT_PREFIX}bando-a`,
    sideB: `${ACT_PREFIX}bando-b`,
    climaxA: `${ACT_PREFIX}final-a`,
    climaxB: `${ACT_PREFIX}final-b`,
    late: `${ACT_PREFIX}tarde`,
};

/** Los finales, por su id. */
export const ACT_ENDINGS = { a: `${ACT_PREFIX}a`, b: `${ACT_PREFIX}b`, late: `${ACT_PREFIX}tarde` };

/** Cuántas pistas hacen falta de las tres. */
export const CLUES_NEEDED = 2;

/**
 * De dónde son los nombres de la gente nueva si el mundo no lo dice (`world.culture`): los del
 * valle (Calina, Fiorra) suenan más a estas tierras que los del norte o los del bosque.
 */
export const DEFAULT_CULTURE = 'valle';

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value : []);

/** @param {any} value @returns {string} Sin tildes y en minúscula, para comparar. */
const plain = (value) => text(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** @param {any} value @returns {string} */
const slug = (value) => plain(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** @param {string} value @returns {string} */
const capFirst = (value) => (value ? value.charAt(0).toLocaleUpperCase('es') + value.slice(1) : value);

/**
 * El nombre de una facción dentro de una frase: con el artículo en minúscula («la casa de
 * Vado»), que en mitad de una frase no va en mayúscula.
 *
 * @param {string} name
 * @returns {string}
 */
function midName(name) {
    return text(name).replace(/^(El|La|Los|Las|Un|Una) /, (_, article) => `${article.toLowerCase()} `);
}

/**
 * Rellenar los huecos de una plantilla (`{inicio}`, `{villano}`…) y dejarla bien escrita: «a
 * el» y «de el» contraídos, y mayúscula al empezar cada frase. Las marcas del héroe
 * (`{listo|lista}`) se quedan: las resuelve quien juega (`grammar.js`).
 *
 * @param {any} template
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function fillActText(template, vars) {
    const filled = text(template).replace(/\{([a-zA-Z0-9]+)\}/g, (whole, key) => (key in vars ? vars[key] : whole));
    return filled
        .replace(/\b([Aa]) [Ee]l\b/g, (_, a) => (a === 'A' ? 'Al' : 'al'))
        .replace(/\b([Dd]e) [Ee]l\b/g, (_, d) => (d === 'D' ? 'Del' : 'del'))
        .replace(/(^|[.!?»]\s+|«)([a-záéíóúñ])/g, (_, before, letter) => `${before}${letter.toLocaleUpperCase('es')}`);
}

/**
 * Una vista del compendio sin memoria: `pick` elige solo con el azar que se le da. La de
 * siempre recuerda lo último que salió para no repetirlo, y entonces la misma semilla daría
 * nombres distintos según lo que se hubiera sacado antes.
 *
 * @param {any} compendium
 * @returns {any}
 */
export function steadyCompendium(compendium) {
    if (!compendium?.find) return compendium;
    return {
        has: (/** @type {string} */ domain) => Boolean(compendium.has?.(domain)),
        find: (/** @type {string} */ domain, /** @type {any} */ where = {}) => compendium.find(domain, where),
        byId: (/** @type {string} */ domain, /** @type {string} */ id) => compendium.byId?.(domain, id) ?? null,
        count: (/** @type {string} */ domain) => compendium.count?.(domain) ?? 0,
        pick: (/** @type {string} */ domain, /** @type {any} */ options = {}) =>
            pickWeighted(compendium.find(domain, options.where ?? {}), options.random ?? Math.random) ?? null,
    };
}

/**
 * Si una campaña necesita el hilo de la gramática: no trae hitos, y tampoco se le puede sacar
 * uno de sus misiones (con misiones en varios actos, `pack-fill.js` hace el hilo con ellas).
 *
 * @param {any} pack
 * @returns {boolean}
 */
export function needsActThread(pack) {
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return false;
    if (list(pack.plot?.milestones).length > 0) return false;
    const acts = new Set(list(pack.quests).map(q => Number(q?.act) || 1));
    return acts.size <= 1;
}

/**
 * Una de una lista simple (de textos u objetos sin peso), con el azar dado.
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} random
 * @returns {T|undefined}
 */
function anyOf(items, random) {
    const pool = list(items);
    return pool.length === 0 ? undefined : pool[Math.floor(random() * pool.length) % pool.length];
}

/**
 * Barajar, con el azar dado.
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} random
 * @returns {T[]}
 */
function shuffle(items, random) {
    return list(items).map(item => ({ item, at: random() })).sort((a, b) => a.at - b.at).map(({ item }) => item);
}

/**
 * La trama, por el género del mundo: las que le van salen cuatro veces más.
 *
 * @param {any[]} rows
 * @param {string} genre
 * @param {() => number} random
 * @returns {any|null}
 */
function pickPlot(rows, genre, random) {
    const words = plain(genre).split(/[^a-z0-9]+/).filter(Boolean);
    const fits = (/** @type {any} */ row) => list(row?.tags).some((/** @type {any} */ tag) => words.includes(plain(tag)));
    const weighted = rows.map(row => ({ ...row, weight: (Number(row.weight) || 1) * (fits(row) ? 4 : 1) }));
    return pickWeighted(weighted, random) ?? null;
}

/**
 * @typedef {Object} ActThread Lo que la gramática añade a un paquete.
 * @property {any} plot El hilo, en el formato de `plot.js` (sin leer: con sus escenas).
 * @property {any[]} places Los sitios escondidos nuevos: la guarida y el refugio.
 * @property {any[]} npcs La gente nueva: quien lo vio (si no había nadie) y los dos contactos.
 * @property {Array<{place: string, sight: any}>} sights Lo que se examina en cada sitio de pista.
 * @property {any[]} boards El tablero de la guarida.
 * @property {any[]} rumors Lo que se oye en el pueblo, apuntando a las pistas.
 * @property {{trama: string, giro: string, villain: string, kind: string, start: string, lair: string, refuge: string, sides: {a: any, b: any}}} summary
 *   Lo elegido, en limpio, para las pruebas y el informe.
 */

/**
 * Escribir la historia en tres actos de un paquete sin hilo.
 *
 * @param {Object} input
 * @param {any} input.pack El paquete (no se toca).
 * @param {any} input.compendium Con las baterías `actos` y `nombres`.
 * @param {string} [input.seed] Sin ella, la del mundo o su nombre.
 * @returns {ActThread|null} Null si no hay plantillas o el mundo no tiene ningún sitio.
 */
export function buildActThread({ pack, compendium, seed = '' }) {
    if (!pack || typeof pack !== 'object' || !compendium?.find || !compendium.has?.('actos')) return null;
    const world = pack.world && typeof pack.world === 'object' ? pack.world : {};
    const theSeed = cleanSeed(seed) || cleanSeed(world.seed) || cleanSeed(slug(world.name)) || 'campana';
    /** @param {...string} parts */
    const rng = (...parts) => createSeededRandom(derive(theSeed, 'actos', ...parts));
    const steady = steadyCompendium(compendium);
    const rows = (/** @type {string} */ kind) => compendium.find('actos', { kind });

    // La trama: la que pida el mundo (`world.trama`, el id de una fila), o una que le vaya.
    const trama = rows('trama').find((/** @type {any} */ r) => text(world.trama) && r.id === text(world.trama))
        ?? pickPlot(rows('trama'), text(world.genre), rng('trama'));
    if (!trama) return null;
    const kind = text(trama.villano) === 'bestia' ? 'bestia' : 'persona';
    const twists = rows('giro').filter((/** @type {any} */ g) => !text(g.villano) || text(g.villano) === kind);
    const giro = pickWeighted(twists, rng('giro'));
    if (!giro) return null;

    // ------------------------------------------------------------ los sitios
    const locations = list(pack.locations).filter(l => text(l?.name));
    const visible = locations.filter(l => !l.hidden).map(l => text(l.name));
    const fromBoards = [...new Set(list(pack.boards).map(b => text(b?.locationName)).filter(Boolean))];
    const known = visible.length > 0 ? visible : fromBoards.length > 0 ? fromBoards : (text(world.name) ? [text(world.name)] : []);
    if (known.length === 0) return null;
    const start = known[0];
    const taken = new Set([...locations.map(l => plain(l.name)), ...fromBoards.map(plain)]);
    const routed = locations.some(l => list(l?.routes).some(r => text(r?.to)));
    /** @param {any[]} options @param {string} what */
    const newPlace = (options, what) => {
        const random = rng('sitio', what);
        const free = shuffle(list(options), random).find(o => text(o?.name) && !taken.has(plain(o.name)));
        const chosen = free ?? { name: `${text(anyOf(list(options), random)?.name) || capFirst(what)} (${start})`, type: 'ruins' };
        taken.add(plain(chosen.name));
        return { name: text(chosen.name), type: text(chosen.type) || 'ruins' };
    };
    const lairPlace = newPlace(trama.guaridas, 'guarida');
    const refugePlace = newPlace(trama.refugios, 'refugio');

    // Las pistas: en tres sitios distintos si los hay, primero los que no son donde se empieza y
    // los que tienen menos cosas que mirar (se ofrecen dos al día: que la pista salga).
    const sightsAt = (/** @type {string} */ name) => list(locations.find(l => plain(l.name) === plain(name))?.sights).length;
    const others = shuffle(known.filter(name => name !== start), rng('pistas'))
        .sort((a, b) => Math.min(2, sightsAt(a)) - Math.min(2, sightsAt(b)));
    // Con menos de tres sitios, alguno repite: cada pista pide otra tirada, así que no se pisan.
    const pool = [...others, start];
    const cluePlaces = [0, 1, 2].map(i => pool[i % pool.length]);
    const cosas = list(trama.pistas?.cosas).slice(0, 3);
    if (cosas.length === 0) return null;

    // ------------------------------------------------------------ la gente
    const people = list(pack.npcs).concat(list(pack.confidants));
    const takenNames = people.map(p => text(p?.name)).filter(Boolean);
    const nameRandom = rng('nombres');
    const culture = text(world.culture) || DEFAULT_CULTURE;
    const trades = (/** @type {string} */ role) => rows('oficio').find((/** @type {any} */ r) => text(r.papel) === role) ?? null;
    /** @type {any[]} */
    const npcs = [];
    /**
     * Alguien nuevo, con su oficio en la forma que va con su nombre.
     *
     * @param {string} role
     * @param {string} where
     * @param {Record<string, string>} vars
     */
    const newPerson = (role, where, vars) => {
        const row = trades(role);
        const name = makeName({ compendium: steady, kind: 'person', culture, random: nameRandom, taken: takenNames })
            || `${capFirst(text(anyOf(list(row?.formas), nameRandom)?.[0]) || 'Vecino')} de ${where}`;
        takenNames.push(name);
        const pair = anyOf(list(row?.formas), nameRandom) ?? ['Vecino', 'Vecina'];
        // Sin saber de dónde es el nombre, la forma la da cómo acaba: Calina, Pastora; Bornedar, Pastor.
        const trade = text(/a$/i.test(name) ? pair[1] : pair[0]) || text(pair[0]);
        let id = `${ACT_PREFIX}${slug(name) || 'persona'}`;
        for (let n = 2; people.some(p => text(p?.id) === id) || npcs.some(p => p.id === id); n++) id = `${ACT_PREFIX}${slug(name)}-${n}`;
        const person = {
            id, name, trade, where,
            wants: fillActText(row?.quiere, vars), knows: fillActText(row?.sabe, vars), secret: '', voice: text(row?.voz),
        };
        npcs.push(person);
        return person;
    };

    // Las facciones: B, la del trato (y su reloj, el de «llegasteis tarde»); A, una enemiga suya.
    const factions = list(world.factions).filter(f => text(f?.id) && text(f?.name));
    const sideRandom = rng('bandos');
    const factionB = anyOf(factions, sideRandom) ?? null;
    const enemiesOfB = factions.filter(f => f !== factionB && list(factionB?.enemies).map(text).includes(text(f.id)));
    const factionA = anyOf(enemiesOfB.length > 0 ? enemiesOfB : factions.filter(f => f !== factionB), sideRandom) ?? null;
    const seatOf = (/** @type {any} */ f) => (f && known.includes(text(f.seat)) ? text(f.seat) : '');
    const placeA = seatOf(factionA) || anyOf(known.filter(n => n !== start), sideRandom) || start;
    const placeB = seatOf(factionB) && seatOf(factionB) !== placeA ? seatOf(factionB)
        : (anyOf(known.filter(n => n !== placeA && n !== start), sideRandom) || anyOf(known.filter(n => n !== placeA), sideRandom) || start);

    const villainRandom = rng('villano');
    const villainName = text(anyOf(list(trama.villanos), villainRandom)) || (kind === 'bestia' ? 'la Bestia' : 'el Desconocido');
    const villain = capFirst(villainName);

    const vars = /** @type {Record<string, string>} */ ({
        inicio: start, villano: villainName, guarida: lairPlace.name, refugio: refugePlace.name,
        pista1: cluePlaces[0], pista2: cluePlaces[1], pista3: cluePlaces[2], mundo: text(world.name) || start,
    });

    // Quien lo vio: alguien que ya vive donde se empieza y no atiende un servicio (a quien atiende
    // la posada se le habla dentro de ella); si no hay nadie así, uno nuevo.
    const locals = people.filter(p => plain(p?.where) === plain(start) && text(p?.name) && !p?.dead && !text(p?.service));
    const pickedLocal = anyOf(locals, rng('testigo'));
    const witness = pickedLocal ? text(pickedLocal.name) : newPerson('testigo', start, vars).name;
    vars.testigo = witness;
    // Los contactos: el de una facción que ya trae su gente (`faction`), o uno nuevo.
    const contactOf = (/** @type {any} */ faction, /** @type {string} */ role, /** @type {string} */ where) => {
        const own = faction ? people.find(p => text(p?.faction) === text(faction.id) && text(p?.name) && text(p.name) !== witness) : null;
        return own ? { name: text(own.name), where: text(own.where) || where } : { name: newPerson(role, where, vars).name, where };
    };
    const contactA = contactOf(factionA, 'contacto-a', placeA);
    const contactB = contactOf(factionB, 'contacto-b', placeB);
    Object.assign(vars, {
        contactoA: contactA.name, contactoB: contactB.name, sitioA: contactA.where, sitioB: contactB.where,
        bandoA: factionA ? midName(factionA.name) : contactA.name,
        bandoB: factionB ? midName(factionB.name) : contactB.name,
    });
    // Lo que quiere cada contacto habla del villano: se escribe ahora que ya se sabe.
    for (const person of npcs) {
        const role = person.name === contactA.name ? 'contacto-a' : person.name === contactB.name ? 'contacto-b' : '';
        if (!role) continue;
        const row = trades(role);
        person.wants = fillActText(row?.quiere, vars);
        person.knows = fillActText(row?.sabe, vars);
    }
    // D-J54: lo que se encuentra en la guarida lo cuenta alguien a quien tenían allí (o que se
    // escondía). Se queda en la guarida, y se le puede hablar.
    vars.cautivo = newPerson('cautivo', lairPlace.name, vars).name;

    // ------------------------------------------------------------ los textos
    /** @param {any} value */
    const t = (value) => fillActText(value, vars);
    /** @param {any[]} beats */
    const beatsOf = (beats) => list(beats).map(beat => ({
        ...(text(beat?.who) ? { who: t(beat.who) } : {}),
        ...(text(beat?.mood) ? { mood: text(beat.mood) } : {}),
        text: t(beat?.text),
        ...(list(beat?.options).length > 0 ? { options: list(beat.options).map(option => readOption(option, t)) } : {}),
    }));
    /** @param {any[]} beats */
    const sceneOf = (beats) => beats.map(b => (b.who ? `${b.who}: «${b.text}»` : b.text)).join(' ');
    /**
     * La escena de una parte: en líneas si las trae (D-J54), y si no, su texto de siempre.
     *
     * @param {any} part
     * @returns {{scene: string, beats?: any[]}}
     */
    const scenePart = (part) => {
        const beats = beatsOf(part?.beats);
        return beats.length > 0 ? { scene: sceneOf(beats), beats } : { scene: t(part?.scene) };
    };
    /**
     * El acto 3 lo abre el contacto del bando (D-J54): lo que dice al recibir lo encontrado (el
     * giro) y dónde se esconde el villano (el desenlace). No sale al abrirse su «habla con»: con
     * él hablando, la escena ya sería la charla y cumpliría el hito (D-J39).
     *
     * @param {any} side `bando_a` o `bando_b` del giro.
     * @param {any} row El desenlace.
     * @param {string} contact
     * @returns {{scene: string, beats?: any[]}}
     */
    const climaxScene = (side, row, contact) => {
        const beats = [...beatsOf(side?.beats), ...beatsOf(row?.beats)];
        // J13.7: si no se le había hablado (se eligió en la escena), aquí se le conoce.
        const first = beats.find(b => b.who === contact);
        if (first) Object.assign(first, { presenta: true });
        return beats.length > 0 ? { scene: sceneOf(beats), beats } : { scene: t(row?.scene) };
    };

    const hookBeats = beatsOf(trama.gancho?.beats);
    // J13.7: quien lo vio se presenta en el gancho («Soy Amosca»): desde ahí se sabe su nombre.
    const introduces = hookBeats.find(b => b.who === witness);
    if (introduces) Object.assign(introduces, { presenta: true });
    const clueBeats = beatsOf(trama.pistas?.beats);
    const crossBeats = beatsOf(giro.encrucijada?.beats);
    // J13.7: y quien estaba en la guarida, al empezar a hablar («Me llamo…»).
    const freed = crossBeats.find(b => b.who === vars.cautivo);
    if (freed) Object.assign(freed, { presenta: true });
    // La decisión de la escena: la opción a cumple el bando A; la b, el B; pensarlo no cumple nada.
    for (const beat of crossBeats) {
        for (const option of list(beat.options)) {
            if (option.id === 'a') option.effects = [{ milestone: ACT_IDS.sideA }];
            if (option.id === 'b') option.effects = [{ milestone: ACT_IDS.sideB }];
        }
    }
    const standing = (/** @type {any} */ up, /** @type {any} */ down) => {
        /** @type {Record<string, number>} */
        const out = {};
        if (up) out[text(up.id)] = 2;
        if (down) out[text(down.id)] = -1;
        return out;
    };
    const climaxRows = (/** @type {string} */ side) => rows('desenlace').filter((/** @type {any} */ r) => text(r.lado) === side);
    const climaxA = pickWeighted(climaxRows('a'), rng('desenlace', 'a'));
    const climaxB = pickWeighted(climaxRows('b'), rng('desenlace', 'b'));
    const endingRow = (/** @type {string} */ side) => pickWeighted(rows('final').filter((/** @type {any} */ r) => text(r.lado) === side), rng('final', side));
    const late = Boolean(factionB?.goal && text(factionB.goal.kind));
    const fight = { kind: 'any', options: [{ kind: 'defeat', enemy: villain, place: refugePlace.name }, { kind: 'win', place: refugePlace.name }] };
    const boardName = t(trama.golpe?.board) || `La pelea de ${lairPlace.name}`;

    const milestones = [
        {
            id: ACT_IDS.hook, act: 1, title: t(trama.gancho?.title), hint: '',
            scene: sceneOf(hookBeats), beats: hookBeats, backdrop: start,
            opens: { kind: 'start' }, asks: { kind: 'none' }, changes: {},
        },
        {
            // Sin escena al abrirse: «búscame luego» ya lo dice en el gancho (D-J54, D-J39).
            id: ACT_IDS.witness, act: 1, title: t(trama.testigo?.title), hint: t(trama.testigo?.hint),
            scene: t(trama.testigo?.scene),
            opens: { kind: 'after', milestone: ACT_IDS.hook }, asks: { kind: 'talk', npc: witness, place: start }, changes: {},
        },
        {
            id: ACT_IDS.clues, act: 1, title: t(trama.pistas?.title), hint: t(trama.pistas?.hint),
            scene: sceneOf(clueBeats), beats: clueBeats, backdrop: start,
            opens: { kind: 'after', milestone: ACT_IDS.witness },
            asks: { kind: 'clues', need: CLUES_NEEDED, clues: cosas.map((c, i) => ({ place: cluePlaces[i], skill: text(c.skill) })) },
            changes: { reveal: [lairPlace.name] },
        },
        {
            id: ACT_IDS.lair, act: 2, title: t(trama.guarida?.title), hint: t(trama.guarida?.hint),
            ...scenePart(trama.guarida), backdrop: lairPlace.name,
            opens: { kind: 'after', milestone: ACT_IDS.clues }, asks: { kind: 'arrive', place: lairPlace.name }, changes: {},
        },
        {
            id: ACT_IDS.strike, act: 2, title: t(trama.golpe?.title), hint: t(trama.golpe?.hint),
            ...scenePart(trama.golpe), backdrop: lairPlace.name,
            opens: { kind: 'after', milestone: ACT_IDS.lair }, asks: { kind: 'win', board: boardName, place: lairPlace.name }, changes: {},
        },
        {
            id: ACT_IDS.crossroads, act: 2, title: t(giro.encrucijada?.title), hint: '',
            scene: sceneOf(crossBeats), beats: crossBeats, backdrop: lairPlace.name,
            opens: { kind: 'after', milestone: ACT_IDS.strike }, asks: { kind: 'none' }, changes: {},
        },
        {
            id: ACT_IDS.sideA, act: 2, title: t(giro.bando_a?.title), hint: t(giro.bando_a?.hint), scene: t(giro.bando_a?.scene),
            opens: { kind: 'after', milestone: ACT_IDS.crossroads }, asks: { kind: 'talk', npc: contactA.name, place: contactA.where },
            changes: { reveal: [refugePlace.name], standing: standing(factionA, factionB), close: [ACT_IDS.sideB] },
        },
        {
            id: ACT_IDS.sideB, act: 2, title: t(giro.bando_b?.title), hint: t(giro.bando_b?.hint), scene: t(giro.bando_b?.scene),
            opens: { kind: 'after', milestone: ACT_IDS.crossroads }, asks: { kind: 'talk', npc: contactB.name, place: contactB.where },
            changes: { reveal: [refugePlace.name], standing: standing(factionB, factionA), close: [ACT_IDS.sideA] },
        },
        {
            id: ACT_IDS.climaxA, act: 3, title: t(climaxA?.title), hint: t(climaxA?.hint),
            ...climaxScene(giro.bando_a, climaxA, contactA.name), backdrop: contactA.where,
            opens: { kind: 'after', milestone: ACT_IDS.sideA }, asks: fight, changes: { ending: ACT_ENDINGS.a },
        },
        {
            id: ACT_IDS.climaxB, act: 3, title: t(climaxB?.title), hint: t(climaxB?.hint),
            ...climaxScene(giro.bando_b, climaxB, contactB.name), backdrop: contactB.where,
            opens: { kind: 'after', milestone: ACT_IDS.sideB }, asks: fight, changes: { ending: ACT_ENDINGS.b },
        },
        ...(late ? [{
            id: ACT_IDS.late, act: 3, title: t(endingRow('tarde')?.title) || 'Demasiado tarde', hint: '',
            // Lo dice quien lo vio; la escena de la ventana del final sigue siendo `scene`.
            ...scenePart(endingRow('tarde')),
            opens: { kind: 'clock', faction: text(factionB.id) }, asks: { kind: 'none' }, changes: { ending: ACT_ENDINGS.late },
        }] : []),
    ];

    /** @param {any} row */
    const endingOf = (row) => ({
        title: t(row?.title),
        scene: t(row?.scene),
        epilogues: list(row?.epilogos).map(e => ({ who: capFirst(t(e?.who)), text: t(e?.text) })).filter(e => e.who && e.text),
        // J11.4: lo que el gremio recordará de este final (`guild-memory.js`).
        ...(row?.legado && typeof row.legado === 'object' ? {
            legacy: {
                tone: text(row.legado.tono) || 'gris',
                // El título va en minúscula: «Desde entonces os conocen como quienes…».
                title: fillActText(row.legado.titulo, vars).replace(/^./, c => c.toLocaleLowerCase('es')),
                greeting: t(row.legado.saludo),
            },
        } : {}),
    });
    const endings = {
        [ACT_ENDINGS.a]: endingOf(endingRow('a')),
        [ACT_ENDINGS.b]: endingOf(endingRow('b')),
        ...(late ? { [ACT_ENDINGS.late]: endingOf(endingRow('tarde')) } : {}),
    };

    const omens = [['pistas', ACT_IDS.clues], ['golpe', ACT_IDS.strike], ['encrucijada', ACT_IDS.crossroads]]
        .map(([hito, id]) => {
            const row = pickWeighted(rows('presagio').filter((/** @type {any} */ r) => text(r.hito) === hito), rng('presagio', hito));
            return row ? { text: t(row.text), milestone: id } : null;
        })
        .filter(Boolean);
    const chapters = [1, 2, 3].map(act => {
        const row = pickWeighted(rows('capitulo').filter((/** @type {any} */ r) => Number(r.acto) === act), rng('capitulo', String(act)));
        return { act, title: t(row?.title) || `Acto ${act}`, summary: t(row?.summary) };
    });
    const appears = [2, 3].map(act => {
        // D-J54: una persona lo dice (entre comillas); una bestia no habla: la de su clase.
        const fits = (/** @type {any} */ r) => Number(r.acto) === act && (!text(r.villano) || text(r.villano) === kind);
        const row = pickWeighted(rows('asoma').filter(fits), rng('asoma', String(act)));
        return row ? { act, scene: t(row.text) } : null;
    }).filter(Boolean);

    const plot = {
        title: t(trama.gancho?.title) || text(world.name),
        chapters,
        milestones,
        endings,
        omens,
        villain: { name: villain, appears },
    };

    // ------------------------------------------------------------ lo que se añade al mundo
    const places = [
        { ...lairPlace, hidden: true, description: '', ...(routed ? { routes: [{ to: cluePlaces[0], days: 1 }] } : {}) },
        // El refugio lo descubre el bando que elijas: se llega desde la guarida y desde los dos.
        {
            ...refugePlace, hidden: true, description: '',
            ...(routed ? {
                routes: [{ to: lairPlace.name, days: 1 }, ...[...new Set([contactA.where, contactB.where])].map(to => ({ to, days: 2 }))],
            } : {}),
        },
    ];
    // Lo que se examina va detrás de su verbo («Registrar el cobertizo abandonado», «Iria se pone
    // a registrar el cobertizo…»): sin la mayúscula de empezar frase que pone `fillActText`.
    /** @param {any} value */
    const phrase = (value) => {
        const filled = t(value);
        return /^[a-záéíóúñ]/.test(text(value)) ? filled.charAt(0).toLocaleLowerCase('es') + filled.slice(1) : filled;
    };
    const sights = cosas.map((c, i) => ({
        place: cluePlaces[i],
        sight: { id: `${ACT_PREFIX}pista-${i + 1}`, verbo: text(c.verbo) || 'examinar', text: phrase(c.text), skill: text(c.skill), found: t(c.found) },
    }));
    const henchmen = list(trama.secuaces).map(text).filter(Boolean);
    const boards = [{
        id: `${ACT_PREFIX}golpe`, name: boardName, locationName: lairPlace.name,
        description: t(trama.golpe?.scene),
        ...(henchmen.length > 0 ? { enemies: henchmen } : {}),
    }];
    const rumorRandom = rng('rumores');
    const rumors = shuffle(rows('rumor'), rumorRandom).slice(0, 2).map((/** @type {any} */ row, i) => ({
        id: `${ACT_PREFIX}rumor-${i + 1}`, by: witness, where: start, text: t(row.text),
        truth: ['si', 'no', 'medias'].includes(text(row.truth)) ? text(row.truth) : 'si',
        leadsTo: /\{pista2\}/.test(text(row.text)) ? cluePlaces[1] : /\{pista3\}/.test(text(row.text)) ? cluePlaces[2] : /\{pista1\}/.test(text(row.text)) ? cluePlaces[0] : '',
    }));

    return {
        plot, places, npcs, sights, boards, rumors,
        summary: {
            trama: text(trama.id), giro: text(giro.id), villain, kind, start, lair: lairPlace.name, refuge: refugePlace.name,
            sides: {
                a: { faction: text(factionA?.id), contact: contactA.name, where: contactA.where },
                b: { faction: text(factionB?.id), contact: contactB.name, where: contactB.where },
            },
        },
    };
}

/**
 * Una opción de una decisión de escena, con sus textos rellenos.
 *
 * @param {any} option
 * @param {(value: any) => string} t
 * @returns {any}
 */
function readOption(option, t) {
    const reply = option?.reply;
    return {
        id: text(option?.id),
        text: t(option?.text),
        ...(reply && typeof reply === 'object' && !Array.isArray(reply)
            ? { reply: { ...(text(reply.who) ? { who: t(reply.who) } : {}), ...(text(reply.mood) ? { mood: text(reply.mood) } : {}), text: t(reply.text) } }
            : {}),
    };
}

/**
 * El paquete con su historia en tres actos, si no traía hilo (`needsActThread`). Lo demás no
 * se toca: la gente, los sitios y los tableros que la historia necesita se añaden a los que ya
 * había, y lo que se examina en cada sitio de pista va delante de lo que ese sitio ya tuviera.
 *
 * Después hay que pasarlo por `fillPackGaps`: dibuja el tablero de la guarida y el del refugio,
 * y pone los bichos.
 *
 * @param {any} pack
 * @param {{compendium: any, seed?: string}} options
 * @returns {{pack: any, made: boolean, thread: ActThread|null}}
 */
export function withActThread(pack, { compendium, seed = '' }) {
    if (!needsActThread(pack)) return { pack, made: false, thread: null };
    const thread = buildActThread({ pack, compendium, seed });
    if (!thread) return { pack, made: false, thread: null };
    const out = JSON.parse(JSON.stringify(pack));
    const plot = out.plot && typeof out.plot === 'object' && !Array.isArray(out.plot) ? out.plot : {};
    out.plot = { ...plot, ...thread.plot };
    const locations = list(out.locations);
    for (const place of thread.places) locations.push(place);
    for (const { place, sight } of thread.sights) {
        let location = locations.find(l => plain(l?.name) === plain(place));
        if (!location) {
            location = { name: place };
            locations.push(location);
        }
        location.sights = [sight, ...list(location.sights)];
    }
    out.locations = locations;
    out.npcs = [...list(out.npcs), ...thread.npcs];
    out.boards = [...list(out.boards), ...thread.boards];
    out.rumors = [...list(out.rumors), ...thread.rumors];
    return { pack: out, made: true, thread };
}
