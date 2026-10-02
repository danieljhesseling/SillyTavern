#!/usr/bin/env node
/**
 * ¿Se repite el narrador del motor? La variedad de sus frases, medida (J13.2 de
 * wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Sin modelo, todo lo que se lee lo escribe el motor con las frases de
 * `public/compendio/frases.json`. Esto las elige con el mismo código que el juego —`narrate` y
 * `rememberUsed` de `engine-narrator.js`, con una sola memoria para todos los momentos y el
 * azar sembrado como en `tellMoment`— en partidas simuladas, y cuenta:
 *
 * - cuántas variantes tiene cada parte de cada momento, y cuántas quedan en el peor caso (de
 *   noche y con nieve solo valen las de noche, las de nieve y las que valen siempre);
 * - cuántas veces sale una frase repetida dentro de una ventana de diez de su parte;
 * - qué partes se quedan cortas.
 *
 * Una partida simulada son diez viajes con su llegada, y entre uno y otro lo que pasa en una
 * partida: tiradas, charlas, servicios, descansos, alguna pelea. Una frase que solo es un
 * hueco (`{descripcion}`, `{heridos}`) no cuenta como repetida: lo que se lee es del mundo.
 *
 * Con --check es el marcador: sale con 1 si en diez llegadas se repite alguna frase (J13.2),
 * si alguna parte tiene menos de ocho variantes (J13.4) o si alguna marca llega sin resolver.
 *
 * Uso:
 *   node tools/variedad-frases.mjs                  # el informe
 *   node tools/variedad-frases.mjs --check          # el marcador
 *   node tools/variedad-frases.mjs --partidas 500   # más partidas simuladas (200 por defecto)
 *   node tools/variedad-frases.mjs --ejemplo        # y una partida entera, para leerla
 */

import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const load = (/** @type {string} */ path) => import(new URL(path, ROOT).href);
const { narrate, rememberUsed, MOMENTS, daysText, listNames } = await load('public/scripts/game-engine/campaign/engine-narrator.js');
const { matches } = await load('public/scripts/game-engine/compendio/compendio.js');
const { createSeededRandom } = await load('public/scripts/game-engine/combat/seeded-random.js');
const { derive } = await load('public/scripts/game-engine/campaign/seed.js');

const argAfter = (/** @type {string} */ flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : '');
const CHECK = process.argv.includes('--check');
const SAMPLE = process.argv.includes('--ejemplo');
const GAMES = Math.max(1, Number(argAfter('--partidas')) || 200);

/** Lo que pide el marcador. */
const MIN_VARIANTS = 8;
const WINDOW = 10;
const LEGS = 10;
const GOAL = 400;

const bank = JSON.parse(readFileSync(new URL('public/compendio/frases.json', ROOT), 'utf8'));
const allRows = /** @type {any[]} */ (bank.rows);
// «mirar» es lo que se examina, y «relleno-*» lo que se escribe en una campaña que no lo trae
// (J5.3): ninguna de las dos es una frase del narrador.
const rows = allRows.filter(row => row.kind !== 'mirar' && !String(row.kind).startsWith('relleno-'));
const byId = new Map(rows.map(row => [String(row.id), row]));

/** Una frase con palabras suyas, no solo huecos. */
const ownWords = (/** @type {any} */ row) => /[a-záéíóúñ]/i.test(String(row?.text ?? '').replace(/\{[^{}]*\}/g, ''));

// --- Los hechos, como los da el juego -------------------------------------------------

const TIEMPO = ['despejado', 'lluvia', 'tormenta', 'niebla', 'viento', 'nieve', 'bochorno'];
const HORA = ['mañana', 'tarde', 'noche'];
const HABILIDAD = ['survival', 'perception', 'investigation', 'athletics', 'stealth', 'sleight', 'persuasion', 'deception', 'intimidation', 'insight'];
const SERVICIO = ['posada', 'tienda', 'herreria', 'templo', 'tablon'];
const SITIOS = ['El Pueblo de Barro', 'Castillo de Vane', 'La atalaya del norte', 'Puerto Alba', 'Vallaki', 'El molino quemado', 'La ermita', 'Krezk', 'El paso de las cabras', 'La granja de los Ruiz', 'El vado', 'Aldea de Barovia'];
const DESCRIPCIONES = [
    'Un amasijo de cabañas de madera podrida que se hunden en el fango. Huele a humo de turba y a coles hervidas.',
    'Una mole de piedra gris y mal cuidada, con los estandartes rotos por el viento.',
    'Dos torres de madera que cierran el desfiladero. El viento corta.',
    'Un puerto pequeño, con un muelle de piedra y barcas de pesca.',
];
const GENTE = ['Giles', 'Marta', 'Karl', 'Brunilda', 'Tomás', 'Mencía'];
const HEROES = ['Tessa', 'Bran', 'Gerd el Mellado', 'Nella'];
const QUE = ['buscar huellas en el barro', 'abrir la cerradura', 'convencer al guardia', 'trepar el muro', 'pasar sin que os vean'];
const TABLEROS = ['La bodega del gremio', 'El muelle de Puerto Alba', 'El claro de los lobos', 'La cripta'];
const OBJETIVOS = ['acabar con las ratas', 'salir por la ventana', 'derrótalos a todos', 'que Ireena sobreviva'];
const ENEMIGOS = ['dos ratas de bodega', 'Ratero del muelle', 'tres lobos famélicos y Bandido', 'Bruja Baroviana'];
const ACTITUD_TEXTO = { buena: ['cordial', 'amistosa'], neutra: ['neutral', 'prudente'], mala: ['recelosa', 'fría', 'hostil'] };

/** @param {() => number} r @param {any[]} list */
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

/** @param {() => number} r */
function talker(r, bands = ['buena', 'neutra', 'mala']) {
    const actitud = pick(r, bands);
    return { quien: pick(r, GENTE), actitud, actitud_texto: pick(r, ACTITUD_TEXTO[/** @type {'buena'} */ (actitud)]) };
}

/** Los hechos de cada momento, como los monta `party/main.js` (y `talk.js` para las charlas). */
const FACTS = {
    viaje: (/** @type {() => number} */ r) => {
        const dias = 1 + Math.floor(r() * 5);
        return {
            destino: pick(r, SITIOS), dias, dias_texto: daysText(dias), tiempo: pick(r, TIEMPO),
            sucesos: r() < 0.4 ? 'una rueda se parte y arreglarla lleva media mañana.' : '',
        };
    },
    llegada: (/** @type {() => number} */ r) => {
        const first = r() < 0.5;
        const people = [...GENTE].sort(() => r() - 0.5).slice(0, Math.floor(r() * 4));
        const hooks = [];
        if (r() < 0.25) hooks.push('el hilo pasa por aquí');
        if (r() < 0.15) hooks.push('aquí está vuestro encargo');
        if (r() < 0.4) hooks.push(r() < 0.5 ? 'hay un encargo en el tablón' : 'hay dos encargos en el tablón');
        if (r() < 0.4) hooks.push(r() < 0.5 ? 'alguien tiene algo que contar' : 'se oyen cosas que valdría la pena escuchar');
        return {
            sitio: pick(r, SITIOS), descripcion: first ? pick(r, DESCRIPCIONES) : '', primera: first ? 'sí' : 'no',
            hora: pick(r, HORA), tiempo: pick(r, TIEMPO), gente: listNames(people), gente_n: people.length, gancho: listNames(hooks),
        };
    },
    tablero: (/** @type {() => number} */ r) => ({ tablero: pick(r, TABLEROS), objetivo: r() < 0.7 ? pick(r, OBJETIVOS) : '', enemigos: pick(r, ENEMIGOS) }),
    'fin-combate': (/** @type {() => number} */ r) => {
        const roll = r();
        const ganado = roll < 0.7 ? 'sí' : roll < 0.85 ? 'huida' : 'no';
        return {
            ganado,
            caidos: ganado === 'sí' || r() < 0.3 ? pick(r, ['Rata de bodega', 'Ratero del muelle', 'Lobo famélico y Bandido']) : '',
            heridos: r() < 0.4 ? pick(r, ['Bran sale malherido.', 'Tessa y Gerd el Mellado salen malheridos.']) : '',
            botin: ganado === 'sí' && r() < 0.6 ? 'Daga, Poción de curación y Cuerda' : '',
        };
    },
    descanso: (/** @type {() => number} */ r) => ({ largo: r() < 0.6 ? 'sí' : 'no', dia: 2 + Math.floor(r() * 40), tiempo: pick(r, TIEMPO) }),
    muerte: (/** @type {() => number} */ r) => ({ quien: pick(r, HEROES), epitafio: 'Bran, Guerrero de nivel 3. Cayó en Vane el día 4. Tumbó a 5 enemigos.' }),
    semana: (/** @type {() => number} */ r) => ({ semana: 2 + Math.floor(r() * 10), cuenta: 'La mesa, con lo que no cabe entero, está en su botón.' }),
    acto: (/** @type {() => number} */ r) => ({ acto: 1 + Math.floor(r() * 3), hitos: listNames(['El ratero del muelle', 'La bodega']) }),
    'charla-hilo': (/** @type {() => number} */ r) => ({ ...talker(r), pista: 'Dicen que el ratero duerme en el embarcadero.' }),
    'charla-sabe': (/** @type {() => number} */ r) => ({ ...talker(r, ['buena', 'neutra']), sabe: 'quién entra y quién sale del pueblo de noche.' }),
    'charla-no': (/** @type {() => number} */ r) => talker(r, ['mala']),
    'charla-quiere': (/** @type {() => number} */ r) => ({ ...talker(r), quiere: 'que alguien le pague la cuenta del soldado muerto.' }),
    'charla-vosotros': (/** @type {() => number} */ r) => talker(r),
    'charla-ronda': (/** @type {() => number} */ r) => { const t = talker(r); return { quien: t.quien, actitud_texto: t.actitud_texto }; },
    'charla-ronda-no': (/** @type {() => number} */ r) => { const t = talker(r); return { quien: t.quien, actitud_texto: t.actitud_texto }; },
    'charla-amenaza-bien': (/** @type {() => number} */ r) => ({ quien: pick(r, GENTE), sabe: 'quién entra y quién sale del pueblo de noche.' }),
    'charla-amenaza-mal': (/** @type {() => number} */ r) => ({ quien: pick(r, GENTE) }),
    'tirada-bien': (/** @type {() => number} */ r) => ({ quien: pick(r, HEROES), que: r() < 0.5 ? pick(r, QUE) : '', habilidad: pick(r, HABILIDAD) }),
    'tirada-medias': (/** @type {() => number} */ r) => ({ quien: pick(r, HEROES), que: r() < 0.5 ? pick(r, QUE) : '', habilidad: pick(r, HABILIDAD) }),
    'tirada-mal': (/** @type {() => number} */ r) => ({ quien: pick(r, HEROES), que: r() < 0.5 ? pick(r, QUE) : '', habilidad: pick(r, HABILIDAD) }),
    servicio: (/** @type {() => number} */ r) => ({ servicio: pick(r, SERVICIO) }),
};

/** Lo que pasa entre un viaje y el siguiente, con cuánta frecuencia. */
const BETWEEN = [
    ['tirada-bien', 10], ['tirada-medias', 6], ['tirada-mal', 8], ['servicio', 12], ['descanso', 10],
    ['charla-sabe', 5], ['charla-no', 3], ['charla-quiere', 4], ['charla-vosotros', 5], ['charla-hilo', 2],
    ['charla-ronda', 2], ['charla-ronda-no', 1], ['charla-amenaza-bien', 1], ['charla-amenaza-mal', 1],
    ['pelea', 8], ['semana', 2], ['acto', 1], ['muerte', 1],
];

/** Quién juega: a veces ellas, a veces ellos, a veces sin decir (D-J15: quien es no binario elige la forma). */
const GROUPS = [
    { heroe: 'Mujer', grupo: ['Mujer', 'Mujer'] },
    { heroe: 'Hombre', grupo: ['Hombre', 'Mujer'] },
    { heroe: 'No binario (en femenino)', grupo: ['No binario (en femenino)'] },
    { heroe: '', grupo: [''] },
];

// --- Las variantes, contadas -----------------------------------------------------------

/** Los valores de cada condición: los del mundo si los hay; si no, los que usan las filas. */
const DOMAIN = { tiempo: TIEMPO, hora: HORA, habilidad: HABILIDAD, servicio: SERVICIO };
const parts = [...new Set(Object.values(MOMENTS).flat())];

/**
 * Cuántas frases valen para una parte en cada combinación de condiciones, y la peor.
 *
 * @param {string} part
 * @returns {{total: number, worst: number, where: string}}
 */
function variantsOf(part) {
    const own = rows.filter(row => row.kind === part);
    /** @type {Record<string, any[]>} */
    const values = {};
    for (const row of own) {
        for (const [key, rule] of Object.entries(row.when ?? {})) {
            if (key === 'voz') continue;
            values[key] = values[key] ?? [];
            const list = Array.isArray(rule) && rule.length === 2 && rule.every(v => typeof v === 'number') ? [rule[0]] : [rule].flat();
            values[key].push(...list);
        }
    }
    for (const key of Object.keys(values)) values[key] = /** @type {any} */ (DOMAIN)[key] ?? [...new Set(values[key])];
    /** @type {Array<Record<string, any>>} */
    let combos = [{}];
    for (const [key, list] of Object.entries(values)) combos = combos.flatMap(combo => list.map(value => ({ ...combo, [key]: value })));
    let worst = Infinity;
    let where = '';
    for (const combo of combos) {
        const n = own.filter(row => matches(row, { ...combo, kind: part })).length;
        if (n < worst) {
            worst = n;
            where = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ');
        }
    }
    return { total: own.length, worst: worst === Infinity ? 0 : worst, where };
}

// --- Las partidas simuladas ------------------------------------------------------------

/**
 * Una partida: diez viajes con su llegada, y entre medias lo demás.
 *
 * @param {number} game
 * @returns {{log: Array<{moment: string, part: string, id: string, text: string}>, lines: string[]}}
 */
function playGame(game) {
    const seed = `variedad-${game}`;
    const r = createSeededRandom(derive(seed, 'partida'));
    const who = GROUPS[game % GROUPS.length];
    /** @type {string[]} */
    let recent = [];
    let chatLength = 0;
    /** @type {Array<{moment: string, part: string, id: string, text: string}>} */
    const log = [];
    /** @type {string[]} */
    const lines = [];
    const tell = (/** @type {string} */ moment) => {
        chatLength += 1 + Math.floor(r() * 3);
        const facts = /** @type {any} */ (FACTS)[moment](r);
        // Como `tellMoment`: el azar, de la partida, el momento y el largo del chat.
        const random = createSeededRandom(derive(seed, 'narrador', moment, String(chatLength)));
        const told = narrate({ rows, moment, facts: { ...facts, generos: who }, random, recent });
        recent = rememberUsed(recent, told.used);
        for (const id of told.used) log.push({ moment, part: String(byId.get(id)?.kind ?? ''), id, text: told.text });
        if (told.text) lines.push(`[${moment}] ${told.text}`);
    };
    const total = BETWEEN.reduce((sum, [, weight]) => sum + Number(weight), 0);
    for (let leg = 0; leg < LEGS; leg++) {
        const between = Math.floor(r() * 9);
        for (let i = 0; i < between; i++) {
            let ticket = r() * total;
            const [moment] = BETWEEN.find(([, weight]) => (ticket -= Number(weight)) < 0) ?? BETWEEN[0];
            if (moment === 'pelea') {
                tell('tablero');
                tell('fin-combate');
            } else tell(String(moment));
        }
        tell('viaje');
        tell('llegada');
    }
    return { log, lines };
}

const arrivalParts = new Set([...MOMENTS.viaje, ...MOMENTS.llegada]);
/** @type {Record<string, {uses: number, repeats: number}>} */
const usage = Object.fromEntries(parts.map(part => [part, { uses: 0, repeats: 0 }]));
let gamesWithRepeat = 0;
/** @type {string[]} */
const repeatSamples = [];
/** @type {string[]} */
const leftovers = [];
for (let game = 0; game < GAMES; game++) {
    const { log } = playGame(game);
    /** @type {Record<string, string[]>} */
    const seq = {};
    for (const entry of log) {
        if (/[{}|]/.test(entry.text) && leftovers.length < 5) leftovers.push(entry.text);
        if (!entry.part || !ownWords(byId.get(entry.id))) continue;
        const list = (seq[entry.part] = seq[entry.part] ?? []);
        usage[entry.part].uses += 1;
        if (list.slice(-(WINDOW - 1)).includes(entry.id)) usage[entry.part].repeats += 1;
        list.push(entry.id);
    }
    // J13.2: en las diez llegadas de la partida (con su viaje), ninguna frase dos veces.
    const arrivals = log.filter(entry => arrivalParts.has(entry.part) && ownWords(byId.get(entry.id))).map(entry => entry.id);
    const twice = arrivals.find((id, at) => arrivals.indexOf(id) !== at);
    if (twice) {
        gamesWithRepeat += 1;
        if (repeatSamples.length < 5) repeatSamples.push(`partida ${game}: «${byId.get(twice)?.text}» (${twice})`);
    }
}

// --- El informe ------------------------------------------------------------------------

console.log(`Frases del narrador del motor: ${rows.length} (y ${allRows.length - rows.length} de «mirar» y de relleno;${allRows.length} filas en total, la meta de J13.4 es unas ${GOAL}).`);
console.log(`Partidas simuladas: ${GAMES}, cada una con ${LEGS} viajes y su llegada, y lo de entre medias.\n`);
console.log('Los momentos y sus partes (MOMENTS de engine-narrator.js):');
for (const [moment, list] of Object.entries(MOMENTS)) console.log(`  ${moment}: ${list.join(' → ')}`);
console.log('');

const pad = (/** @type {any} */ v, /** @type {number} */ n) => String(v).padEnd(n);
const padStart = (/** @type {any} */ v, /** @type {number} */ n) => String(v).padStart(n);
console.log(`${pad('parte', 22)}${padStart('filas', 6)}${padStart('peor', 6)}  ${pad('usos', 6)}${pad('repes/10', 10)}estado`);
/** @type {string[]} */
const thin = [];
/** @type {string[]} */
const warnings = [];
for (const part of parts) {
    const v = variantsOf(part);
    const u = usage[part];
    const pct = u.uses > 0 ? `${((100 * u.repeats) / u.uses).toFixed(1)} %` : '—';
    const need = arrivalParts.has(part) ? WINDOW : MIN_VARIANTS;
    let state = 'bien';
    if (v.total < MIN_VARIANTS) {
        state = `CORTA: menos de ${MIN_VARIANTS}`;
        thin.push(`${part} tiene ${v.total} frase(s); pide al menos ${MIN_VARIANTS}`);
    } else if (v.worst < need) {
        state = `aviso: ${v.worst} con ${v.where}`;
        warnings.push(`${part}: con ${v.where} solo valen ${v.worst} (mejor ${need} o más)`);
    }
    console.log(`${pad(part, 22)}${padStart(v.total, 6)}${padStart(v.worst, 6)}  ${pad(u.uses, 6)}${pad(pct, 10)}${state}`);
}
console.log('\n«peor»: las frases que quedan con las condiciones más estrechas. «repes/10»: las veces que una');
console.log('frase vuelve a salir antes de que hayan salido otras nueve de su parte.\n');

for (const line of warnings) console.log(`AVISO  ${line}`);
const errors = [
    ...thin,
    ...(gamesWithRepeat > 0 ? [`en ${gamesWithRepeat} de ${GAMES} partidas se repite una frase en diez llegadas: ${repeatSamples.join('; ')}`] : []),
    ...leftovers.map(line => `marca sin resolver: ${line}`),
];
// --- La gente (J13.8): seguir una charla, cómo te mira y el saludo de quien atiende ------
// No son del narrador: las elige `human-lines.js` por turnos. Se mide lo que pide J13.8: cada
// clase con ocho o más, y quien ya te conoce, a cualquier hora y te mire como te mire, con
// cuatro saludos o más y ninguno repetido antes de tres visitas.
const human = await load('public/scripts/game-engine/campaign/human-lines.js');
human.setPhraseBank(allRows);
console.log('\nLa gente (J13.8):');
for (const kind of human.HUMAN_KINDS) {
    const n = allRows.filter(row => row.kind === kind).length;
    console.log(`  ${pad(kind, 20)}${padStart(n, 6)}`);
    if (n < MIN_VARIANTS) errors.push(`${kind} tiene ${n} frase(s); pide al menos ${MIN_VARIANTS}`);
}
const KEEPERS = [['gremio', 'Brunilda'], ['posada', 'Tomás'], ['herreria', 'Ramiro'], ['tienda', 'Marisa'], ['templo', 'Madre Elvira'],
    ['posada', 'Alguien'], ['herreria', 'Alguien'], ['tienda', 'Alguien'], ['templo', 'Alguien'], ['gremio', 'Alguien']];
let greetWorst = Infinity;
let greetWhere = '';
let greetRepeats = 0;
for (const [kind, keeper] of KEEPERS) {
    for (const slot of HORA) {
        for (const attitude of [2, 0, -2]) {
            const seen = Array.from({ length: 12 }, (_, turn) => human.townGreeting({
                place: { kind, keeper: { name: keeper } }, slot, hero: { name: 'Tessa', gender: 'Mujer', class: 'Guerrero' },
                met: true, attitude, seed: `${kind}${keeper}`, turn,
            }));
            const n = new Set(seen).size;
            if (n < greetWorst) [greetWorst, greetWhere] = [n, `${keeper} (${kind}), ${slot}, actitud ${attitude}`];
            greetRepeats += seen.filter((line, i) => seen.slice(Math.max(0, i - 3), i).includes(line)).length;
        }
    }
}
console.log(`  saludo de quien ya te conoce: peor caso ${greetWorst} frases (${greetWhere}); repetidas antes de tres visitas: ${greetRepeats}.`);
if (greetWorst < 4) errors.push(`el saludo de ${greetWhere} solo tiene ${greetWorst} frase(s); pide al menos 4`);
if (greetRepeats > 0) errors.push(`${greetRepeats} saludo(s) se repiten antes de tres visitas`);

for (const line of errors) console.log(`ERROR  ${line}`);
console.log(`\nDiez llegadas sin repetir frase: ${GAMES - gamesWithRepeat} de ${GAMES} partidas.`);

if (SAMPLE) {
    console.log('\n--- Una partida, para leerla ---\n');
    for (const line of playGame(0).lines) console.log(line);
}

if (CHECK) {
    console.log(errors.length === 0 ? '\nEl marcador, en verde.' : `\n${errors.length} cosa(s) por arreglar.`);
    process.exit(errors.length === 0 ? 0 : 1);
}
