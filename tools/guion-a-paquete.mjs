#!/usr/bin/env node
/**
 * Convierte los guiones de un mundo en su paquete de campaña.
 *
 * El Gem guionista (wiki/GEM_GUIONISTA.md) escribe la biblia de un mundo por rondas, en
 * Markdown con bloques YAML: hitos, localidades, gente, encargos, tableros… Esto los lee en
 * orden y construye el paquete que el juego importa (el mismo formato que valida
 * `/esquema-campana`), con los nombres ya resueltos: el guion se refiere a todo por su id,
 * y el juego enlaza por nombres.
 *
 * **Un bloque posterior con el mismo id corrige al anterior**, campo a campo. Así las
 * correcciones van en su propia ronda (`ronda-8-claude.md`, por ejemplo) y lo que escribió
 * el guionista se queda como lo escribió.
 *
 * Uso:
 *   node tools/guion-a-paquete.mjs wiki/guiones/1387            # escribe public/mundos/1387.pack.json
 *   node tools/guion-a-paquete.mjs wiki/guiones/1387 --check    # solo comprueba
 *
 * Ver wiki/ROADMAP_MUNDOS_VIVOS.md, fase M.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';

const ROOT = new URL('..', import.meta.url);
const engine = (/** @type {string} */ path) => import(new URL(`public/scripts/game-engine/${path}`, ROOT).href);

// Los errores, dichos para quien escribe el guion: archivo, linea, que pasa y como se arregla.
const { explainYamlError, locateIssue, describeIssue } = await engine('campaign/guion-errors.js');

/** Los bloques que no se han podido leer. Se juntan todos: parar en el primero obliga a ir de uno en uno. */
/** @type {string[]} */
const yamlProblems = [];

/** Lo que se puede escribir en un guion. */
const KINDS = ['mundo', 'hito', 'final', 'localidad', 'faccion', 'pnj', 'confidente', 'encargo',
    'tablero', 'encuentro', 'bicho', 'objeto', 'rumor', 'habilidad'];

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
 * Un bloque encima de otro: campo a campo; las listas se sustituyen enteras.
 *
 * @param {any} base
 * @param {any} patch
 * @returns {any}
 */
function merge(base, patch) {
    // Las escenas de un confidente se corrigen de una en una, por su rango: corregir la del
    // rango 10 no puede borrar las otras cuatro.
    const byRank = (/** @type {any} */ list) => Array.isArray(list) && list.length > 0 && list.every(item => isObject(item) && 'rango' in item);
    if (byRank(base) && byRank(patch)) {
        const out = new Map(base.map((/** @type {any} */ item) => [Number(item.rango), item]));
        for (const item of patch) out.set(Number(item.rango), merge(out.get(Number(item.rango)) ?? {}, item));
        return [...out.values()].sort((a, b) => Number(a.rango) - Number(b.rango));
    }
    if (!isObject(base) || !isObject(patch)) return patch;
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) out[key] = key in base ? merge(base[key], value) : value;
    return out;
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
 * @returns {{kind: string, data: any, where: string, line: number}[]}
 */
function blocksOf(source, file) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    const start = new RegExp(`^(${KINDS.join('|')}):\\s*$`);
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(start);
        if (!match) continue;
        const body = [lines[i]];
        let j = i + 1;
        while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) body.push(lines[j++]);
        try {
            const parsed = yaml.load(body.join('\n'));
            out.push({ kind: match[1], data: parsed?.[match[1]] ?? {}, where: `${file}:${i + 1}`, line: i + 1 });
        } catch (error) {
            const said = explainYamlError(error, i + 1, lines);
            yamlProblems.push([
                `ERROR  ${file}:${said.line} — el bloque «${match[1]}» (empieza en la línea ${i + 1}) no se puede leer.`,
                `       ${said.why}`,
                said.text ? `       Línea: ${said.text}` : '',
                `       Arreglo: ${said.fix}`,
            ].filter(Boolean).join('\n'));
        }
        i = j - 1;
    }
    return out;
}

/**
 * Todo lo del guion, por tipo e id, con las correcciones aplicadas.
 *
 * @param {string} dir
 */
function readGuion(dir) {
    const files = readdirSync(dir)
        .filter(name => /^ronda-\d+.*\.md$/.test(name))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]) || a.localeCompare(b));
    /** @type {Record<string, Map<string, any>>} */
    const byKind = Object.fromEntries(KINDS.map(kind => [kind, new Map()]));
    /** De id o nombre a donde se escribio por ultima vez, para señalar los fallos del paquete. */
    /** @type {Map<string, string>} */
    const index = new Map();
    for (const file of files) {
        for (const block of blocksOf(readFileSync(new URL(file, dir), 'utf8'), file)) {
            const id = block.kind === 'mundo' ? 'mundo' : text(block.data?.id);
            if (!id) {
                yamlProblems.push(`ERROR  ${block.where} — un bloque «${block.kind}» sin id.\n       Arreglo: añade «id: algo-corto» como primera línea del bloque.`);
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
            map.set(id, map.has(id) ? merge(map.get(id), block.data) : block.data);
        }
    }
    return { files, byKind, index };
}

/** Una casilla del guion, `[x, y]`, a la del paquete. */
const cell = (/** @type {any} */ c) => ({ x: Number(c?.[0]) || 0, y: Number(c?.[1]) || 0 });

/** Un número de la recompensa escrita: «15 monedas de plata» → 15. */
const firstNumber = (/** @type {any} */ value) => Number(String(value ?? '').match(/\d+/)?.[0] ?? 0);

/**
 * El paquete de un guion.
 *
 * @param {ReturnType<typeof readGuion>['byKind']} g
 * @param {{abilityRows: any[], defaults: any[], asAbility: (row: any) => any}} catalogue
 * @returns {{pack: any, notes: string[]}}
 */
function buildPack(g, catalogue) {
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
        })),
    }));

    // --- Las facciones, vivas.
    const factions = all('faccion').map(f => ({
        id: text(f.id),
        name: text(f.nombre),
        goals: text(f.si_la_cumple),
        onSuccess: text(f.si_la_cumple),
        reputation: Number(f.reputacion_inicial) || 0,
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
    const confidants = all('confidente').map(c => ({
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
    }));
    const wanted = new Set(bestiary.flatMap(b => b.abilities));
    const fromLibrary = catalogue.abilityRows.filter(row => wanted.has(text(row.id))).map(catalogue.asAbility);
    const written = all('habilidad').map(h => ({ ...h, id: text(h.id) }));
    const abilities = [...catalogue.defaults, ...fromLibrary, ...written];
    const known = new Set(abilities.map(a => text(a.id)));
    for (const id of wanted) if (!known.has(id)) notes.push(`habilidad «${id}» no está en ningún catálogo`);

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
    const endings = Object.fromEntries(all('final').map(f => [text(f.id), { title: text(f.titulo), scene: text(f.escena) }]));

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
        plot: { title: text(world.nombre), milestones, endings, ...(omens.length > 0 ? { omens } : {}) },
        mix: world.mezcla ?? undefined,
    };
    return { pack, notes };
}

// ---------------------------------------------------------------- run
const [dirArg, ...flags] = process.argv.slice(2);
if (!dirArg) {
    console.error('Uso: node tools/guion-a-paquete.mjs <carpeta de guiones> [--check]');
    process.exit(2);
}
const dir = new URL(dirArg.replace(/\\/g, '/').replace(/\/?$/, '/'), ROOT);
const { files, byKind, index } = readGuion(dir);
if (yamlProblems.length > 0) {
    for (const problem of yamlProblems) console.log(problem);
    console.log(`\n${yamlProblems.length} bloque(s) sin leer. Arréglalos y vuelve a pasar el conversor: lo demás no se comprueba hasta entonces.`);
    process.exit(1);
}
const world = byKind.mundo.get('mundo');
if (!world?.id) {
    console.error('Falta el bloque «mundo:» con su id (va en la ronda de correcciones).');
    process.exit(2);
}

const [{ asAbility }, { DEFAULT_RULESET }, { validatePack }] = await Promise.all([
    engine('compendio/skills.js'), engine('rules/default-ruleset.js'), engine('campaign/campaign-pack.js'),
]);
const library = JSON.parse(readFileSync(new URL('public/compendio/habilidades.json', ROOT), 'utf8'));
const { pack, notes } = buildPack(byKind, { abilityRows: library.rows ?? [], defaults: DEFAULT_RULESET.abilities ?? [], asAbility });
const found = validatePack(pack);

console.log(`Leídas ${files.length} rondas: ${files.join(', ')}`);
for (const kind of KINDS) if (byKind[kind].size > 0) console.log(`  ${kind}: ${byKind[kind].size}`);
for (const note of notes) console.log(`AVISO  ${note}`);
for (const issue of found.warnings) console.log(describeIssue('AVISO', issue, locateIssue(issue.path, pack, index)));
for (const issue of found.errors) console.log(describeIssue('ERROR', issue, locateIssue(issue.path, pack, index)));
if (found.errors.length > 0) {
    console.log(`\n${found.errors.length} error(es). Cada uno dice en qué ronda y línea está; `
        + 'el arreglo puede ir ahí mismo o en una ronda nueva con el mismo id (se mezcla encima).');
}

if (!flags.includes('--check')) {
    const out = new URL(`public/mundos/${text(world.id)}.pack.json`, ROOT);
    writeFileSync(out, `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`Escrito ${out.pathname}`);
}
process.exit(found.ok && notes.length === 0 ? 0 : 1);
