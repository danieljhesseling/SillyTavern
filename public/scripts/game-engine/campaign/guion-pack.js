/**
 * El guion de un mundo, convertido en su paquete de campaña (J5.9 de ROADMAP_SIN_CONEXION).
 *
 * El Gem guionista (wiki/GEM_GUIONISTA.md) escribe la biblia de un mundo por rondas, en
 * Markdown con bloques YAML: hitos, localidades, gente, encargos, tableros… Esto los lee en
 * orden y construye el paquete que el juego importa (el mismo formato que valida
 * `/esquema-campana`), con los nombres ya resueltos: el guion se refiere a todo por su id,
 * y el juego enlaza por nombres.
 *
 * Vivía dentro de `tools/guion-a-paquete.mjs`, solo para la consola. Ahora es del motor, para
 * que el taller de campañas del gremio convierta las rondas en el navegador con **el mismo
 * código**: la herramienta lee la carpeta y llama aquí; el taller, los archivos subidos.
 *
 * **Un bloque posterior con el mismo id corrige al anterior**, campo a campo. Así las
 * correcciones van en su propia ronda (`ronda-8-claude.md`, por ejemplo) y lo que escribió
 * el guionista se queda como lo escribió.
 *
 * D-J18: un `final` puede traer `epilogos`, qué fue de cada uno: `{quien: <id>, texto: …}`,
 * con `quien` el id de alguien del guion o de una facción. Van al paquete como `epilogues`.
 *
 * Puro: no lee archivos ni sabe de YAML. Quien llama da el texto de cada ronda y con qué se
 * lee el YAML (`parseYaml`): la herramienta, `js-yaml`; el navegador, `yaml` de `lib.js`. Las
 * dos dan lo mismo con las rondas de 1387 (lo comprueba su prueba).
 *
 * Ver wiki/archivo/ROADMAP_MUNDOS_VIVOS.md, fase M.
 */

import { explainYamlError, locateIssue, describeIssue } from './guion-errors.js';
import { validatePack } from './campaign-pack.js';
import { asAbility } from '../compendio/skills.js';
import { DEFAULT_RULESET } from '../rules/default-ruleset.js';
import { spellById, magicInData } from '../rules/grimoire.js';

/** Lo que se puede escribir en un guion. */
export const GUION_KINDS = ['mundo', 'hito', 'final', 'localidad', 'faccion', 'pnj', 'confidente', 'encargo',
    'tablero', 'encuentro', 'bicho', 'objeto', 'rumor', 'habilidad', 'heroe'];

/** Las habilidades de las tiradas, en castellano, a su id del motor. */
const SKILLS = {
    persuasion: 'persuasion', 'persuasión': 'persuasion', 'engaño': 'deception', engano: 'deception',
    'intimidación': 'intimidation', intimidacion: 'intimidation', perspicacia: 'insight',
    'percepción': 'perception', percepcion: 'perception', 'investigación': 'investigation',
    investigacion: 'investigation', sigilo: 'stealth', atletismo: 'athletics',
    'juego de manos': 'sleight', supervivencia: 'survival',
};

/** Las metas del guion a las del motor. «Aguantar» es controlar lo que ya se tiene. */
const GOALS = { aguantar: 'controlar', encontrar: 'encontrar', conquistar: 'conquistar', recuperar: 'recuperar', destruir: 'destruir', controlar: 'controlar' };

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/** Una lista escrita como lista o como «invierno, otono». @param {any} value @returns {string[]} */
const listOf = (value) => (Array.isArray(value) ? value : text(value).split(',')).map(text).filter(Boolean);

/** @param {any} v */
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * @typedef {(source: string) => any} YamlParser Lee un trozo de YAML; lanza si no se entiende.
 */

/**
 * @typedef {Object} GuionFile
 * @property {string} name El nombre del archivo: `ronda-3.md`.
 * @property {string} text Lo que lleva.
 */

/**
 * @typedef {Object} GuionProblem Un bloque que no se ha podido leer.
 * @property {string} file
 * @property {number} line La línea del fallo, desde 1.
 * @property {string} kind El tipo del bloque: `hito`, `pnj`…
 * @property {number} start La línea donde empieza el bloque.
 * @property {string} why Qué pasa, en castellano.
 * @property {string} said La línea tal cual, recortada.
 * @property {string} fix Cómo se arregla.
 * @property {string} message Todo junto, como lo imprime la herramienta.
 */

/**
 * U7 del pegamento: lo que se lee de cada bloque, para avisar de lo que no.
 *
 * Un campo que el conversor no conoce se ignoraba en silencio: `cerrado_hasta` se escribía,
 * el juego no se enteraba y nadie lo sabía. Cada bloque pasa por un `Proxy` que apunta qué
 * campos se leen; al final, lo escrito y no leído se dice, campo a campo. No hace falta una
 * lista de campos permitidos que mantener: la verdad es lo que el conversor lee de verdad.
 *
 * @param {WeakMap<object, Set<string>>} readKeys Dónde se apunta lo leído (uno por conversión).
 * @param {any} value
 * @returns {any}
 */
function tracked(readKeys, value) {
    if (!value || typeof value !== 'object') return value;
    return new Proxy(value, {
        get(target, key, receiver) {
            if (typeof key === 'string') {
                if (!readKeys.has(target)) readKeys.set(target, new Set());
                readKeys.get(target)?.add(key);
            }
            const result = Reflect.get(target, key, receiver);
            return typeof key === 'string' && result && typeof result === 'object' ? tracked(readKeys, result) : result;
        },
    });
}

/**
 * Los campos escritos que nadie ha leído, con dónde están.
 *
 * @param {WeakMap<object, Set<string>>} readKeys
 * @param {any} value
 * @param {string} path
 * @param {string[]} out
 */
function unreadFields(readKeys, value, path, out) {
    if (Array.isArray(value)) {
        value.forEach((item, i) => unreadFields(readKeys, item, `${path}[${i}]`, out));
        return;
    }
    if (!isObject(value)) return;
    const seen = readKeys.get(value) ?? new Set();
    for (const [key, inner] of Object.entries(value)) {
        if (key === 'id' || key === 'borrar') continue;
        if (!seen.has(key)) out.push(`${path}.${key}`);
        else unreadFields(readKeys, inner, `${path}.${key}`, out);
    }
}

/**
 * Un bloque encima de otro: campo a campo; las listas se sustituyen enteras.
 *
 * @param {any} base
 * @param {any} patch
 * @returns {any}
 */
export function mergeGuionBlock(base, patch) {
    // Las escenas de un confidente se corrigen de una en una, por su rango: corregir la del
    // rango 10 no puede borrar las otras cuatro.
    const byRank = (/** @type {any} */ list) => Array.isArray(list) && list.length > 0 && list.every(item => isObject(item) && 'rango' in item);
    if (byRank(base) && byRank(patch)) {
        const out = new Map(base.map((/** @type {any} */ item) => [Number(item.rango), item]));
        for (const item of patch) out.set(Number(item.rango), mergeGuionBlock(out.get(Number(item.rango)) ?? {}, item));
        return [...out.values()].sort((a, b) => Number(a.rango) - Number(b.rango));
    }
    if (!isObject(base) || !isObject(patch)) return patch;
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) out[key] = key in base ? mergeGuionBlock(base[key], value) : value;
    return out;
}

/**
 * Si un archivo es una ronda del guion: `ronda-<número>….md`.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isRoundFile(name) {
    return /^ronda-\d+.*\.md$/.test(text(name).split(/[\\/]/).pop() ?? '');
}

/**
 * Las rondas, en orden: por su número y, a igual número, por el nombre.
 *
 * @template {{name: string}} T
 * @param {T[]} files
 * @returns {T[]}
 */
export function sortRoundFiles(files) {
    const number = (/** @type {string} */ name) => Number(name.match(/\d+/)?.[0] ?? 0);
    return [...files].sort((a, b) => number(a.name) - number(b.name) || a.name.localeCompare(b.name));
}

/**
 * Los bloques de un archivo de guion.
 *
 * Un bloque empieza en una línea que es solo `<tipo>:` y sigue mientras las líneas estén
 * sangradas o en blanco. Así da igual la prosa de alrededor y da igual que varios bloques
 * del mismo tipo vayan seguidos sin separar.
 *
 * @param {string} source
 * @param {string} file
 * @param {YamlParser} parseYaml
 * @returns {{blocks: {kind: string, data: any, where: string, line: number}[], problems: GuionProblem[]}}
 */
export function guionBlocks(source, file, parseYaml) {
    const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    /** @type {GuionProblem[]} */
    const problems = [];
    const start = new RegExp(`^(${GUION_KINDS.join('|')}):\\s*$`);
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(start);
        if (!match) continue;
        const body = [lines[i]];
        let j = i + 1;
        while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) body.push(lines[j++]);
        try {
            const parsed = parseYaml(body.join('\n'));
            blocks.push({ kind: match[1], data: parsed?.[match[1]] ?? {}, where: `${file}:${i + 1}`, line: i + 1 });
        } catch (error) {
            const said = explainYamlError(error, i + 1, lines);
            problems.push({
                file, line: said.line, kind: match[1], start: i + 1, why: said.why, said: said.text, fix: said.fix,
                message: [
                    `ERROR  ${file}:${said.line} — el bloque «${match[1]}» (empieza en la línea ${i + 1}) no se puede leer.`,
                    `       ${said.why}`,
                    said.text ? `       Línea: ${said.text}` : '',
                    `       Arreglo: ${said.fix}`,
                ].filter(Boolean).join('\n'),
            });
        }
        i = j - 1;
    }
    return { blocks, problems };
}

/**
 * Todo lo del guion, por tipo e id, con las correcciones aplicadas.
 *
 * @param {GuionFile[]} files Las rondas, ya en orden (`sortRoundFiles`).
 * @param {YamlParser} parseYaml
 */
export function readGuion(files, parseYaml) {
    /** @type {Record<string, Map<string, any>>} */
    const byKind = Object.fromEntries(GUION_KINDS.map(kind => [kind, new Map()]));
    /** De id o nombre a donde se escribio por ultima vez, para señalar los fallos del paquete. */
    /** @type {Map<string, string>} */
    const index = new Map();
    /** @type {GuionProblem[]} */
    const problems = [];
    for (const file of files) {
        const read = guionBlocks(file.text, file.name, parseYaml);
        problems.push(...read.problems);
        for (const block of read.blocks) {
            const id = block.kind === 'mundo' ? 'mundo' : text(block.data?.id);
            if (!id) {
                const [where, line] = [block.where.slice(0, block.where.lastIndexOf(':')), block.line];
                problems.push({
                    file: where, line, kind: block.kind, start: line, why: `Un bloque «${block.kind}» sin id.`, said: '',
                    fix: 'Añade «id: algo-corto» como primera línea del bloque.',
                    message: `ERROR  ${block.where} — un bloque «${block.kind}» sin id.\n       Arreglo: añade «id: algo-corto» como primera línea del bloque.`,
                });
                continue;
            }
            for (const key of [id, block.data?.nombre, block.data?.titulo, block.data?.name]) {
                if (text(key)) index.set(text(key).toLowerCase(), block.where);
            }
            const map = byKind[block.kind];
            // `borrar: true` quita lo que el guion traía: para lo que sobra, no para lo que falta.
            if (block.data?.borrar === true) {
                map.delete(id);
                continue;
            }
            map.set(id, map.has(id) ? mergeGuionBlock(map.get(id), block.data) : block.data);
        }
    }
    return { files: files.map(f => f.name), byKind, index, problems };
}

/** Una casilla del guion, `[x, y]`, a la del paquete. */
const cell = (/** @type {any} */ c) => ({ x: Number(c?.[0]) || 0, y: Number(c?.[1]) || 0 });

/** Un número de la recompensa escrita: «15 monedas de plata» → 15. */
const firstNumber = (/** @type {any} */ value) => Number(String(value ?? '').match(/\d+/)?.[0] ?? 0);

/**
 * @typedef {Object} GuionCatalogue
 * @property {any[]} abilityRows Las filas de `compendio/habilidades.json`.
 * @property {any[]} [defaults] Las habilidades de siempre (las del reglamento por defecto).
 */

/**
 * El paquete de un guion.
 *
 * @param {ReturnType<typeof readGuion>['byKind']} g
 * @param {GuionCatalogue} catalogue
 * @returns {{pack: any, notes: string[]}}
 */
export function buildGuionPack(g, catalogue) {
    /** @type {string[]} */
    const notes = [];
    const world = g.mundo.get('mundo') ?? {};
    const all = (/** @type {string} */ kind) => [...g[kind].values()];

    const nameOf = (/** @type {string} */ kind, /** @type {any} */ id) => {
        const found = g[kind].get(text(id));
        if (!found) {
            if (text(id)) notes.push(`${kind} «${id}» no existe`);
            return text(id);
        }
        return text(found.nombre) || text(found.id);
    };
    const placeName = (/** @type {any} */ id) => nameOf('localidad', id);
    const npcName = (/** @type {any} */ id) => (g.pnj.has(text(id)) ? nameOf('pnj', id) : (g.confidente.has(text(id)) ? nameOf('confidente', id) : nameOf('pnj', id)));
    const npcAlias = (/** @type {any} */ id) => text(g.pnj.get(text(id))?.se_le_llama) || npcName(id);
    const creatureName = (/** @type {any} */ id) => nameOf('bicho', id);

    // --- Los tableros: uno por encuentro, con su mapa. Los mapas sin encuentro, tal cual.
    const maps = new Map(all('tablero').map(t => [text(t.id), t]));
    const encounters = all('encuentro');
    const boardOfEncounter = new Map();
    /** @type {any[]} */
    const boards = [];
    /** @type {any[]} */
    const quests = [];
    const usedMaps = new Set();
    for (const enc of encounters) {
        const map = maps.get(text(enc.tablero));
        if (!map) {
            notes.push(`encuentro «${enc.id}» usa un tablero que no existe: ${enc.tablero}`);
            continue;
        }
        usedMaps.add(text(map.id));
        const name = text(enc.nombre) || `${text(map.nombre)} (${text(enc.id)})`;
        boardOfEncounter.set(text(enc.id), name);
        boards.push({
            id: text(enc.id),
            name,
            mapId: text(map.id),
            locationName: placeName(map.localidad),
            map: (map.mapa ?? []).map(String),
            partyStart: (map.inicio_grupo ?? []).map(cell),
            enemies: (enc.enemigos ?? []).flatMap((/** @type {any} */ group) =>
                (group.en ?? []).slice(0, Math.max(1, Number(group.cuantos) || 1))
                    .map((/** @type {any} */ c) => ({ name: creatureName(group.bicho), ...cell(c) }))),
        });
        const goal = enc.objetivo ?? { tipo: 'eliminate_all' };
        /** @type {any} */
        const objective = { type: text(goal.tipo) || 'eliminate_all', label: text(enc.meta) || text(enc.nota).split('.')[0] };
        if (objective.type === 'eliminate') objective.target = creatureName(goal.bicho);
        if (objective.type === 'survive_rounds') objective.rounds = Number(goal.rondas) || 3;
        if (objective.type === 'reach_cell') objective.cell = cell(goal.casilla);
        quests.push({ id: `q-${enc.id}`, name, act: Number(enc.acto) || 1, description: text(enc.nota), boardId: text(enc.id), objectives: [objective] });
    }
    for (const map of maps.values()) {
        if (usedMaps.has(text(map.id))) continue;
        boards.push({
            id: text(map.id), name: text(map.nombre), mapId: text(map.id), locationName: placeName(map.localidad),
            map: (map.mapa ?? []).map(String), partyStart: (map.inicio_grupo ?? []).map(cell), enemies: [],
        });
    }
    const boardName = (/** @type {any} */ id) => boardOfEncounter.get(text(id)) ?? text(maps.get(text(id))?.nombre) ?? text(id);

    // --- Las localidades, con la de salida primero.
    const places = all('localidad');
    const start = text(world.inicio) || text(places[0]?.id);
    places.sort((a, b) => Number(text(b.id) === start) - Number(text(a.id) === start));
    const locations = places.map(l => ({
        name: text(l.nombre),
        type: text(l.tipo),
        description: text(l.descripcion),
        hidden: Boolean(l.escondida),
        biome: text(l.bioma),
        services: (l.servicios ?? []).map(text),
        factionName: l.faccion ? nameOf('faccion', l.faccion) : '',
        routes: (l.caminos ?? []).map((/** @type {any} */ r) => ({
            to: placeName(r.a),
            days: Number(r.dias) || 1,
            // Idea 74: «estaciones: [invierno]» es un camino que solo se pasa entonces.
            ...(listOf(r.estaciones).length > 0 ? { seasons: listOf(r.estaciones) } : {}),
            // Idea 130: «barco: true» es un pasaje por mar.
            ...(r.barco ? { sea: true } : {}),
            // U7 del pegamento: «cerrado_hasta: <hito>» es un camino que se abre al cumplirse
            // ese hito. Antes se ignoraba en silencio.
            ...(text(r.cerrado_hasta) ? { closedUntil: text(r.cerrado_hasta) } : {}),
        })),
    }));

    // --- Las facciones, vivas.
    const factions = all('faccion').map(f => ({
        id: text(f.id),
        name: text(f.nombre),
        goals: text(f.si_la_cumple),
        onSuccess: text(f.si_la_cumple),
        reputation: Number(f.reputacion_inicial) || 0,
        // T4: cómo ve la magia (persigue, tolera, comercia).
        ...(f.magia !== undefined && f.magia !== null ? { magia: text(f.magia) } : {}),
        seat: placeName(f.sede),
        holds: (f.controla ?? []).map(placeName),
        enemies: (f.enemigos ?? []).map(text),
        goal: {
            kind: GOALS[/** @type {keyof typeof GOALS} */ (text(f.meta?.tipo))] ?? 'controlar',
            target: g.localidad.has(text(f.meta?.objetivo)) ? placeName(f.meta.objetivo) : text(f.meta?.objetivo),
            pace: Number(f.meta?.ritmo_dias) || 7,
        },
    }));

    // --- La gente y los confidentes.
    const npcs = all('pnj').map(p => ({
        id: text(p.id), name: text(p.nombre), trade: text(p.oficio), where: placeName(p.donde),
        wants: text(p.quiere), knows: text(p.sabe), secret: text(p.secreto), voice: text(p.voz), service: text(p.servicio ?? ''),
        // Idea 59: la lengua que habla, si no es la común.
        ...(text(p.idioma ?? '') ? { language: text(p.idioma) } : {}),
    }));
    // R4/R10: los conjuros que sabe alguien se nombran por su id del grimorio; uno que no
    // existe se avisa y se deja fuera (la magia solo existe en el código).
    /** @param {any} list @param {string} who @returns {string[]} */
    const spellsOf = (list, who) => listOf(list).filter(id => {
        if (spellById(id)) return true;
        notes.push(`${who}: el conjuro «${id}» no está en el grimorio (la magia solo existe en el código; /grimorio dice cuáles hay)`);
        return false;
    });
    const confidants = all('confidente').map(c => ({
        ...(listOf(c.conjuros).length > 0 ? { spells: spellsOf(c.conjuros, `confidente «${c.id}»`) } : {}),
        name: text(c.nombre),
        description: text(c.descripcion) || text(c.escenas?.[0]?.escena),
        className: text(c.clase),
        motive: text(c.motivo) === 'dinero' ? 'coin' : 'bond',
        arcana: text(c.arcana),
        scenes: (c.escenas ?? []).map((/** @type {any} */ s) => ({ rank: Number(s.rango) || 1, title: text(s.titulo), scene: text(s.escena) })),
        // Idea 45: lo que dice al llegar a un sitio, por id de localidad.
        ...(c.al_llegar && typeof c.al_llegar === 'object' ? {
            arrivals: Object.entries(c.al_llegar).flatMap(([place, line]) => {
                if (!g.localidad.has(text(place))) {
                    notes.push(`confidente «${c.id}»: al_llegar a «${place}», que no es una localidad`);
                    return [];
                }
                return text(line) ? [{ place: placeName(place), line: text(line) }] : [];
            }),
        } : {}),
    }));

    // --- El bestiario y el catálogo de habilidades que usa.
    const bestiary = all('bicho').map(b => ({
        name: text(b.nombre), hp: Number(b.pg) || 10, armorClass: Number(b.ca) || 10, cr: Number(b.desafio) || 0.25,
        profile: text(b.perfil) || 'aggressive', attackRangeFeet: Number(b.alcance) || 5,
        abilities: (b.habilidades ?? []).map(text), description: text(b.descripcion), weakness: text(b.debilidad),
        boss: Boolean(b.jefe),
        // Idea 97: los que migran, con sus estaciones.
        ...(listOf(b.estaciones).length > 0 ? { seasons: listOf(b.estaciones) } : {}),
        // T6: si una cría suya se doma, y en qué mascota.
        ...(b.domable !== undefined && b.domable !== null ? { domable: text(b.domable) } : {}),
    }));
    const wanted = new Set(bestiary.flatMap(b => b.abilities));
    const fromLibrary = (catalogue.abilityRows ?? []).filter(row => wanted.has(text(row.id))).map(asAbility);
    // R4 (DR3): una habilidad escrita que es magia no entra; la magia solo existe en el grimorio.
    const written = all('habilidad').map(h => ({ ...h, id: text(h.id) })).filter(h => {
        const magic = magicInData({ ...h, name: text(h.name ?? h.nombre) });
        if (magic) notes.push(`habilidad «${h.id}»: ${magic}`);
        return !magic;
    });
    const abilities = [...(catalogue.defaults ?? DEFAULT_RULESET.abilities ?? []), ...fromLibrary, ...written];
    const known = new Set(abilities.map(a => text(a.id)));
    for (const id of wanted) if (!known.has(id) && !spellById(id)) notes.push(`habilidad «${id}» no está en ningún catálogo ni en el grimorio`);

    // --- R1/R10: los héroes hechos, para entrar sin crear a nadie. Como mucho tres.
    const heroes = all('heroe').slice(0, 3).map(h => ({
        name: text(h.nombre), race: text(h.raza), className: text(h.clase), gender: text(h.genero),
        background: text(h.pasado), about: text(h.quien), pitch: text(h.gancho),
        ...(listOf(h.conjuros).length > 0 ? { spells: spellsOf(h.conjuros, `héroe «${h.id}»`) } : {}),
        // T5: la mascota con la que llega.
        ...(h.mascota && typeof h.mascota === 'object' ? { pet: { name: text(h.mascota.nombre), species: text(h.mascota.especie), character: text(h.mascota.caracter) || 'leal' } } : {}),
    }));
    if (all('heroe').length > 3) notes.push(`${all('heroe').length} héroes hechos: solo entran los tres primeros`);

    // --- Los objetos y los rumores.
    // Idea 132: un objeto ligado a un hito o a un encargo es una reliquia: llega con él.
    /** @param {any} o */
    const boundOf = (o) => {
        const id = text(o.ligado_a);
        if (!id || id === 'null') return {};
        if (g.hito.has(id)) return { boundTo: { kind: 'milestone', id } };
        if (g.encargo.has(id)) return { boundTo: { kind: 'contract', id } };
        notes.push(`objeto «${o.id}»: ligado_a «${id}», que no es ni un hito ni un encargo`);
        return {};
    };
    const items = all('objeto').map(o => ({
        name: text(o.nombre),
        type: ['weapon', 'armor'].includes(text(o.tipo)) ? text(o.tipo) : 'gear',
        rarity: text(o.rareza) || 'Common',
        description: text(o.historia),
        ...(o.dados ? { damageDice: text(o.dados) } : {}),
        ...boundOf(o),
    }));
    const rumors = all('rumor').map(r => ({
        id: text(r.id),
        by: text(r.dicho_por) === 'cualquiera' || !text(r.dicho_por) ? '' : npcName(r.dicho_por),
        where: placeName(r.donde),
        text: text(r.texto),
        truth: text(r.verdad),
        // Solo lleva a algo que el juego sabe revelar: un sitio.
        leadsTo: g.localidad.has(text(r.lleva_a)) ? placeName(r.lleva_a) : '',
    }));

    // --- Los encargos del tablón.
    const contracts = all('encargo').map(e => {
        const boardId = text(e.encuentro);
        const board = boards.find(b => b.id === boardId);
        return {
            id: text(e.id), title: text(e.titulo), verb: text(e.verbo),
            chain: e.cadena ? { id: text(e.cadena.id), part: Number(e.cadena.parte) || 1, of: Number(e.cadena.de) || 1 } : null,
            patron: npcName(e.lo_pide),
            faction: e.faccion ? { id: text(e.faccion.id), against: Boolean(e.faccion.en_contra) } : null,
            // Donde se pelea manda sobre donde se pide: se va a donde está el tablero.
            where: board ? board.locationName : placeName(e.donde),
            act: Number(e.acto) || 1,
            noFight: Boolean(e.sin_pelear) && !boardId,
            reward: firstNumber(e.recompensa),
            rewardText: text(e.recompensa),
            twist: text(e.giro),
            boardId,
        };
    });

    // --- El hilo.
    /** @param {any} raw */
    const opensOf = (raw) => {
        const [kind, value] = String(raw ?? 'al_empezar').split(':').map(s => s.trim());
        if (kind === 'al_empezar') return { kind: 'start' };
        if (kind === 'tras_hito') return { kind: 'after', milestone: value };
        if (kind === 'llegar') return { kind: 'arrive', place: placeName(value) };
        if (kind === 'tras_encargo') return { kind: 'contract', id: value };
        if (kind === 'dias') return { kind: 'day', day: Number(value) || 0 };
        if (kind === 'reloj_lleno') return { kind: 'clock', faction: value };
        notes.push(`hito: «abre: ${raw}» no se entiende`);
        return { kind: 'after' };
    };
    /**
     * @param {any} raw
     * @param {any} [h] El hito entero, para las pistas de una investigación.
     * @returns {any}
     */
    const asksOf = (raw, h = null) => {
        // Idea 101: varias formas de cumplirlo, en una lista.
        if (Array.isArray(raw)) {
            const options = raw.map(r => asksOf(r, h)).filter(o => o.kind !== 'none' && o.kind !== 'any' && o.kind !== 'clues');
            return options.length > 0 ? { kind: 'any', options } : { kind: 'none' };
        }
        if (!raw || raw === 'nada') return { kind: 'none' };
        const [kind, value] = String(raw).split(':').map(s => s.trim());
        if (kind === 'llegar') return { kind: 'arrive', place: placeName(value) };
        if (kind === 'ganar_tablero') return { kind: 'win', board: boardName(value) };
        if (kind === 'hablar_con') return { kind: 'talk', npc: npcAlias(value) };
        if (kind === 'tirada') return { kind: 'check', skill: SKILLS[/** @type {keyof typeof SKILLS} */ (value.toLowerCase())] ?? value };
        if (kind === 'derrotar') return { kind: 'defeat', enemy: creatureName(value) };
        if (kind === 'encargo') return { kind: 'contract', id: value };
        // Idea 107: una investigación, «pistas: 3», con sus pistas en `pistas:`.
        if (kind === 'pistas') {
            const clues = (h?.pistas ?? []).map((/** @type {any} */ p) => ({
                place: placeName(p?.donde),
                skill: SKILLS[/** @type {keyof typeof SKILLS} */ (text(p?.tirada).toLowerCase())] ?? text(p?.tirada),
            })).filter((/** @type {any} */ c) => c.place && c.skill);
            if (clues.length === 0) notes.push(`hito «${h?.id}»: pide pistas y no dice dónde están (pistas:)`);
            return { kind: 'clues', need: Number(value) || clues.length, clues };
        }
        notes.push(`hito: «pide: ${raw}» no lo sabe mirar el motor`);
        return { kind: 'none' };
    };
    const milestones = all('hito').map(h => ({
        id: text(h.id),
        act: Number(h.acto) || 1,
        title: text(h.titulo),
        hint: text(h.pista),
        scene: text(h.escena),
        opens: opensOf(h.abre),
        asks: asksOf(h.pide, h),
        changes: {
            reveal: (h.cambia?.revela ?? []).map(placeName),
            open: [h.cambia?.abre_hito].flat().filter(Boolean).map(text),
            standing: h.cambia?.reputacion ?? {},
            ending: text(h.cambia?.final),
            endingBy: h.cambia?.final_segun ?? {},
            // Idea 102: los caminos que cierra al cumplirse.
            ...(h.cambia?.cierra ? { close: [h.cambia.cierra].flat().filter(Boolean).map(text) } : {}),
        },
        // Idea 111: no se ve hasta que se cumple.
        ...(h.oculto ? { hidden: true } : {}),
        // Idea 184: solo para ciertos trasfondos.
        ...(listOf(h.trasfondo).length > 0 ? { backgrounds: listOf(h.trasfondo) } : {}),
        // Idea 106: N días desde que se abre; si no, pasa lo de `si_no`.
        ...(h.plazo ? {
            within: Number(h.plazo.dias) || 0,
            late: {
                reveal: (h.plazo.si_no?.revela ?? []).map(placeName),
                open: [h.plazo.si_no?.abre_hito].flat().filter(Boolean).map(text),
                standing: h.plazo.si_no?.reputacion ?? {},
            },
        } : {}),
    }));
    // Idea 114: el presagio, tres frases que se cumplen con sus hitos.
    const omens = (world.presagio ?? []).flatMap((/** @type {any} */ p) => {
        if (!g.hito.has(text(p?.se_cumple))) {
            notes.push(`presagio «${text(p?.frase).slice(0, 40)}…»: se_cumple «${text(p?.se_cumple)}», que no es un hito`);
            return [];
        }
        return [{ text: text(p.frase), milestone: text(p.se_cumple) }];
    });
    // D-J18: qué fue de cada uno con este final. `quien` es el id de alguien del guion o de
    // una facción; la línea, `texto`. Una frase suelta también vale.
    /** @param {any} id @param {string} ending */
    const whoOf = (id, ending) => {
        const key = text(id);
        if (!key) return '';
        if (g.pnj.has(key) || g.confidente.has(key)) return npcName(key);
        if (g.faccion.has(key)) return nameOf('faccion', key);
        notes.push(`final «${ending}»: el epílogo de «${key}», que no es nadie del guion ni una facción`);
        return key;
    };
    const endings = Object.fromEntries(all('final').map(f => {
        const epilogues = (Array.isArray(f.epilogos) ? f.epilogos : [])
            .map((/** @type {any} */ e) => (typeof e === 'string' ? { who: '', text: text(e) } : { who: whoOf(e?.quien, text(f.id)), text: text(e?.texto) }))
            .filter((/** @type {{text: string}} */ e) => e.text);
        return [text(f.id), { title: text(f.titulo), scene: text(f.escena), ...(epilogues.length > 0 ? { epilogues } : {}) }];
    }));

    const pack = {
        version: 1,
        world: {
            name: text(world.nombre),
            genre: text(world.genero),
            synopsis: text(world.sinopsis),
            // Idea 74: la estación en la que empieza.
            ...(text(world.estacion ?? '') ? { season: text(world.estacion) } : {}),
            factions,
            loreEntries: [],
        },
        locations,
        confidants,
        npcs,
        bestiary,
        items,
        boards,
        quests,
        contracts,
        rumors,
        abilities,
        ...(heroes.length > 0 ? { heroes } : {}),
        plot: {
            title: text(world.nombre), milestones, endings, ...(omens.length > 0 ? { omens } : {}),
            // Idea 115: el villano y cuándo asoma.
            ...(world.villano?.nombre ? {
                villain: {
                    name: text(world.villano.nombre),
                    appears: (world.villano.asoma ?? []).map((/** @type {any} */ a) => ({ act: Number(a.acto) || 0, milestone: text(a.hito ?? ''), scene: text(a.escena) })),
                },
            } : {}),
        },
        mix: world.mezcla ?? undefined,
    };
    return { pack, notes };
}

/**
 * @typedef {Object} GuionIssue Un fallo o aviso del paquete, con dónde está en el guion.
 * @property {'ERROR'|'AVISO'} level
 * @property {string} where `ronda-8-claude.md:519 (el-gran-salon)`, o vacío si no se encuentra.
 * @property {string} message
 * @property {string} path Dónde está en el paquete.
 * @property {string} line La línea entera, como la imprime la herramienta.
 */

/**
 * @typedef {Object} GuionResult
 * @property {'leido'|'sin-mundo'|'hecho'} stage Hasta dónde se ha llegado: con bloques sin
 *   leer se para (`leido`); sin bloque «mundo:», también (`sin-mundo`).
 * @property {boolean} ok Si el paquete ha salido y el validador no ve fallos.
 * @property {string[]} files Las rondas leídas, en orden.
 * @property {Array<[string, number]>} counts Cuántos bloques de cada tipo.
 * @property {GuionProblem[]} problems Los bloques que no se han podido leer.
 * @property {string} worldId
 * @property {any} pack El paquete (JSON llano), o null si no se ha llegado.
 * @property {string[]} notes Los avisos del conversor.
 * @property {string[]} ignored Los campos escritos que el conversor no lee.
 * @property {Array<[string, string[]]>} ignoredByField Lo mismo, por campo.
 * @property {GuionIssue[]} issues Lo que dice el validador del paquete, con su sitio.
 * @property {Map<string, string>} index De id o nombre a `archivo:línea`.
 */

/**
 * Convertir un guion entero: leer las rondas, juntar las correcciones, hacer el paquete y
 * validarlo, con cada fallo en su archivo y su línea.
 *
 * @param {GuionFile[]} files Las rondas (se ordenan aquí).
 * @param {Object} options
 * @param {YamlParser} options.parseYaml
 * @param {any[]} [options.abilityRows] Las filas de `compendio/habilidades.json`.
 * @returns {GuionResult}
 */
export function convertGuion(files, { parseYaml, abilityRows = [] }) {
    const ordered = sortRoundFiles(files);
    const { byKind, index, problems } = readGuion(ordered, parseYaml);
    const counts = /** @type {Array<[string, number]>} */ (GUION_KINDS.filter(kind => byKind[kind].size > 0).map(kind => [kind, byKind[kind].size]));
    /** @type {GuionResult} */
    const base = {
        stage: 'leido', ok: false, files: ordered.map(f => f.name), counts, problems, worldId: '', pack: null,
        notes: [], ignored: [], ignoredByField: [], issues: [], index,
    };
    if (problems.length > 0) return base;
    const world = byKind.mundo.get('mundo');
    if (!world?.id) return { ...base, stage: 'sin-mundo' };

    /** @type {WeakMap<object, Set<string>>} */
    const readKeys = new WeakMap();
    /** @type {typeof byKind} */
    const watched = Object.fromEntries(Object.entries(byKind).map(([kind, map]) => [kind, new Map([...map].map(([id, data]) => [id, tracked(readKeys, data)]))]));
    const { pack, notes } = buildGuionPack(watched, { abilityRows, defaults: DEFAULT_RULESET.abilities ?? [] });
    const found = validatePack(pack);
    // Lo que pasó entero al paquete (una tabla de reputaciones, por ejemplo) se lee al escribirlo:
    // se recorre antes de contar lo que nadie leyó. Y así sale en JSON llano, sin los vigilantes.
    const plain = JSON.parse(JSON.stringify(pack));
    /** @type {string[]} */
    const ignored = [];
    for (const [kind, map] of Object.entries(byKind)) {
        for (const [id, data] of map) unreadFields(readKeys, data, `${kind} «${id}»`, ignored);
    }
    // Agrupados por campo: «voz» en 27 personas es un aviso, no veintisiete.
    /** @type {Map<string, string[]>} */
    const byField = new Map();
    for (const path of ignored) {
        const field = path.replace(/^.*?» ?/, '').replace(/\[\d+\]/g, '[]');
        if (!byField.has(field)) byField.set(field, []);
        byField.get(field)?.push(path);
    }
    /** @param {'ERROR'|'AVISO'} level @param {{path: string, message: string}} issue @returns {GuionIssue} */
    const issueOf = (level, issue) => {
        const where = locateIssue(issue.path, plain, index);
        return { level, where, message: issue.message, path: issue.path, line: describeIssue(level, issue, where) };
    };
    return {
        ...base,
        stage: 'hecho',
        ok: found.ok && notes.length === 0,
        worldId: text(world.id),
        pack: plain,
        notes,
        ignored,
        ignoredByField: [...byField],
        issues: [...found.warnings.map(w => issueOf('AVISO', w)), ...found.errors.map(e => issueOf('ERROR', e))],
    };
}

/**
 * Dónde está en el guion lo que nombra un aviso del conversor: el primer «id» que se
 * encuentre en las rondas. Vacío si no nombra nada conocido.
 *
 * @param {string} note `encuentro «enc-x» usa un tablero que no existe: …`
 * @param {Map<string, string>} index
 * @returns {string}
 */
export function locateNote(note, index) {
    for (const [, name] of String(note ?? '').matchAll(/«([^»]+)»/g)) {
        const found = index.get(text(name).toLowerCase());
        if (found) return found;
    }
    return '';
}

/**
 * Lo que la herramienta imprime de una conversión, línea a línea (sin la parte de escribir).
 *
 * @param {GuionResult} result
 * @returns {string[]}
 */
export function guionReportLines(result) {
    if (result.stage === 'leido') {
        return [
            ...result.problems.map(p => p.message),
            `\n${result.problems.length} bloque(s) sin leer. Arréglalos y vuelve a pasar el conversor: lo demás no se comprueba hasta entonces.`,
        ];
    }
    if (result.stage === 'sin-mundo') return ['Falta el bloque «mundo:» con su id (va en la ronda de correcciones).'];
    const lines = [`Leídas ${result.files.length} rondas: ${result.files.join(', ')}`];
    for (const [kind, size] of result.counts) lines.push(`  ${kind}: ${size}`);
    for (const note of result.notes) lines.push(`AVISO  ${note}`);
    if (result.ignored.length > 0) {
        lines.push(`\nAVISO  ${result.ignored.length} campo(s) escritos que el conversor no lee: el juego no se entera de ellos.`);
        for (const [field, paths] of result.ignoredByField) {
            lines.push(`       ${field} (${paths.length}): ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? '…' : ''}`);
        }
        lines.push('       Si es una errata, corrígela en una ronda nueva; si es un campo nuevo, hay que enseñárselo al conversor.');
    }
    for (const issue of result.issues) lines.push(issue.line);
    const errors = result.issues.filter(i => i.level === 'ERROR').length;
    if (errors > 0) {
        lines.push(`\n${errors} error(es). Cada uno dice en qué ronda y línea está; `
            + 'el arreglo puede ir ahí mismo o en una ronda nueva con el mismo id (se mezcla encima).');
    }
    return lines;
}
