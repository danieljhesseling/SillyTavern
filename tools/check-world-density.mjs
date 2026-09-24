#!/usr/bin/env node
/**
 * ¿Llega este mundo al listón? El comprobador de densidad (M6).
 *
 * Un mundo precreado tiene que dar unas veinte horas, empezando 80 % escrito
 * (wiki/ROADMAP_MUNDOS_VIVOS.md, M1). Escribir tanto sin perderse es imposible a ojo: esto
 * cuenta lo que hay contra el listón y, sobre todo, **busca huecos** — un sitio al que no se
 * puede llegar, un rumor que apunta a la nada, un hito que nunca se abre, un PNJ que no
 * quiere nada o un encargo cuyo tablero no existe. Es a los mundos lo que
 * `check-engine-wiring.mjs` es al código.
 *
 * Uso:
 *   node tools/check-world-density.mjs public/mundos/1387.pack.json
 *
 * Sale con 1 si hay algún ERROR (falta algo del listón o algo está roto). Los AVISOS son
 * cosas que conviene mirar, pero que pueden estar así a propósito.
 */

import { readFileSync } from 'node:fs';

/** El listón, por mundo. Los mínimos de la tabla de M1 (lo escrito). */
const QUOTA = {
    milestones: 12, endings: 2, contracts: 14, chains: 3, noFightShare: 1 / 3,
    visible: 7, hidden: 2, npcs: 22, confidants: 5, scenesEach: 5, maps: 10,
    encounters: 15, bestiary: 15, bosses: 3, factions: 3, items: 20, rumors: 25,
    objectiveKinds: 4,
};

const file = process.argv[2];
if (!file) {
    console.error('Uso: node tools/check-world-density.mjs <paquete.json>');
    process.exit(2);
}
const pack = JSON.parse(readFileSync(file, 'utf8'));

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];
/** @type {string[]} */
const counts = [];

/** @param {any} v */
const text = (v) => String(v ?? '').trim();
/** @param {any} v */
const low = (v) => text(v).toLowerCase();
/** @param {any} v */
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * Contar contra el listón.
 *
 * @param {string} label
 * @param {number} value
 * @param {number} min
 * @param {string} [shown]
 */
function quota(label, value, min, shown = String(value)) {
    const ok = value >= min;
    counts.push(`${ok ? '✓' : '✗'} ${label}: ${shown} (mínimo ${Number.isInteger(min) ? min : `${Math.round(min * 100)} %`})`);
    if (!ok) errors.push(`${label}: ${shown}, y el listón pide ${Number.isInteger(min) ? min : `${Math.round(min * 100)} %`}`);
}

const locations = list(pack.locations);
const places = new Set(locations.map(l => low(l.name)));
const visible = locations.filter(l => !l.hidden);
const hidden = locations.filter(l => l.hidden);
const boards = list(pack.boards);
const boardNames = new Set(boards.map(b => low(b.name)));
const boardIds = new Set(boards.map(b => text(b.id)));
const npcs = list(pack.npcs);
const confidants = list(pack.confidants);
const people = [...npcs, ...confidants];
const bestiary = list(pack.bestiary);
const creatures = new Set(bestiary.map(b => low(b.name)));
const factions = list(pack.world?.factions);
const factionIds = new Set(factions.map(f => text(f.id)));
const contracts = list(pack.contracts);
const rumors = list(pack.rumors);
const milestones = list(pack.plot?.milestones);
const endings = pack.plot?.endings ?? {};
const quests = list(pack.quests);

// ---------------------------------------------------------------- el listón
quota('Hitos del hilo', milestones.length, QUOTA.milestones);
quota('Finales', Object.keys(endings).length, QUOTA.endings);
quota('Encargos escritos', contracts.length, QUOTA.contracts);
const chains = new Set(contracts.filter(c => c.chain).map(c => text(c.chain.id)));
quota('Cadenas de encargos', chains.size, QUOTA.chains);
const noFight = contracts.filter(c => c.noFight).length;
quota('Encargos sin pelear', contracts.length ? noFight / contracts.length : 0, QUOTA.noFightShare,
    `${noFight} de ${contracts.length}`);
quota('Localidades al empezar', visible.length, QUOTA.visible);
quota('Localidades que se descubren', hidden.length, QUOTA.hidden);
quota('PNJ con nombre', npcs.length, QUOTA.npcs);
quota('Confidentes', confidants.length, QUOTA.confidants);
const maps = new Set(boards.map(b => text(b.mapId) || text(b.id)));
quota('Tableros dibujados', maps.size, QUOTA.maps);
const encounters = boards.filter(b => list(b.enemies).length > 0);
quota('Encuentros', encounters.length, QUOTA.encounters);
quota('Bestiario', bestiary.length, QUOTA.bestiary);
quota('Jefes', bestiary.filter(b => b.boss).length, QUOTA.bosses);
quota('Facciones vivas', factions.filter(f => text(f.seat) && f.goal).length, QUOTA.factions);
quota('Objetos', list(pack.items).length, QUOTA.items);
quota('Rumores', rumors.length, QUOTA.rumors);
const objectiveKinds = new Set(quests.flatMap(q => list(q.objectives).map(o => text(o.type))));
quota('Tipos de objetivo en los combates', objectiveKinds.size, QUOTA.objectiveKinds, [...objectiveKinds].join(', '));

// ---------------------------------------------------------------- referencias
/**
 * @param {string} what
 * @param {any} name
 * @param {Set<string>} set
 */
const mustExist = (what, name, set) => {
    if (text(name) && !set.has(low(name))) errors.push(`${what}: «${name}» no existe`);
};

for (const c of confidants) {
    const scenes = list(c.scenes).length;
    if (scenes < QUOTA.scenesEach) errors.push(`Confidente ${c.name}: ${scenes} escenas de vínculo, el listón pide ${QUOTA.scenesEach}`);
}
for (const p of npcs) {
    mustExist(`PNJ ${p.name} vive en`, p.where, places);
    if (!text(p.wants)) warnings.push(`PNJ ${p.name} no quiere nada: es decorado`);
    if (!text(p.knows)) warnings.push(`PNJ ${p.name} no sabe nada que interese`);
}
for (const r of rumors) {
    mustExist(`Rumor ${r.id} se oye en`, r.where, places);
    mustExist(`Rumor ${r.id} lleva a`, r.leadsTo, places);
}
for (const c of contracts) {
    mustExist(`Encargo ${c.id} se juega en`, c.where, places);
    if (text(c.boardId) && !boardIds.has(text(c.boardId))) errors.push(`Encargo ${c.id}: su tablero «${c.boardId}» no existe`);
    if (!c.noFight && !text(c.boardId)) errors.push(`Encargo ${c.id}: tiene pelea pero no tiene tablero`);
}
for (const f of factions) {
    mustExist(`Facción ${f.name}, sede`, f.seat, places);
    for (const h of list(f.holds)) mustExist(`Facción ${f.name} controla`, h, places);
    for (const e of list(f.enemies)) if (!factionIds.has(text(e))) errors.push(`Facción ${f.name}: su enemigo «${e}» no existe`);
    if (list(f.enemies).length === 0) warnings.push(`Facción ${f.name} no tiene enemigos: sus encargos no toman partido`);
}
for (const l of locations) {
    for (const r of list(l.routes)) mustExist(`Camino desde ${l.name} hacia`, r.to, places);
}
for (const b of boards) mustExist(`Tablero ${b.name} está en`, b.locationName, places);

// ---------------------------------------------------------------- el hilo se puede jugar
const milestoneIds = new Set(milestones.map(m => text(m.id)));
const revealed = new Set([
    ...milestones.flatMap(m => list(m.changes?.reveal).map(low)),
    ...rumors.map(r => low(r.leadsTo)).filter(Boolean),
]);
for (const m of milestones) {
    const a = m.asks ?? {};
    if (a.kind === 'arrive') mustExist(`Hito ${m.id} pide llegar a`, a.place, places);
    if (a.kind === 'win' && a.board) mustExist(`Hito ${m.id} pide ganar en`, a.board, boardNames);
    if (a.kind === 'defeat') mustExist(`Hito ${m.id} pide derrotar a`, a.enemy, creatures);
    if (a.kind === 'talk' && !people.some(p => low(p.name).includes(low(a.npc)))) {
        errors.push(`Hito ${m.id} pide hablar con «${a.npc}», y nadie se llama así`);
    }
    for (const r of list(m.changes?.reveal)) {
        if (!hidden.some(h => low(h.name) === low(r))) warnings.push(`Hito ${m.id} revela «${r}», que ya estaba en el mapa`);
    }
    if (m.opens?.kind === 'after' && !milestoneIds.has(text(m.opens.milestone))) {
        errors.push(`Hito ${m.id} se abre tras «${m.opens.milestone}», que no existe: nunca se abrirá`);
    }
    const ending = text(m.changes?.ending);
    if (ending && !endings[ending]) errors.push(`Hito ${m.id} lleva al final «${ending}», que no está escrito`);
    for (const e of Object.values(m.changes?.endingBy ?? {})) if (!endings[text(e)]) errors.push(`Hito ${m.id}: el final «${e}» no está escrito`);
}
if (!milestones.some(m => m.opens?.kind === 'start')) errors.push('El hilo no tiene mecha: ningún hito se abre al empezar');
for (const h of hidden) if (!revealed.has(low(h.name))) errors.push(`«${h.name}» empieza escondida y nada la revela: nunca se podrá ir`);

// Un sitio escondido no se puede pedir antes de revelarse: se recorre el hilo en orden.
const openable = new Set(milestones.filter(m => m.opens?.kind && m.opens.kind !== 'after').map(m => text(m.id)));
const knownPlaces = new Set(visible.map(l => low(l.name)));
for (let changed = true; changed;) {
    changed = false;
    for (const m of milestones) {
        if (!openable.has(text(m.id))) continue;
        for (const r of list(m.changes?.reveal)) knownPlaces.add(low(r));
        for (const n of milestones) {
            const after = n.opens?.kind === 'after' && text(n.opens.milestone) === text(m.id);
            const named = list(m.changes?.open).includes(text(n.id));
            if ((after || named) && !openable.has(text(n.id))) {
                openable.add(text(n.id));
                changed = true;
            }
        }
    }
}
for (const r of rumors) if (r.leadsTo) knownPlaces.add(low(r.leadsTo));
for (const m of milestones) {
    if (!openable.has(text(m.id))) errors.push(`Hito ${m.id} no se abre nunca`);
    if (m.asks?.kind === 'arrive' && !knownPlaces.has(low(m.asks.place))) {
        errors.push(`Hito ${m.id} pide llegar a «${m.asks.place}», que nada revela`);
    }
}

// ---------------------------------------------------------------- se puede llegar a todo
const start = low(locations[0]?.name);
const graph = new Map(locations.map(l => [low(l.name), new Set()]));
for (const l of locations) {
    for (const r of list(l.routes)) {
        graph.get(low(l.name))?.add(low(r.to));
        graph.get(low(r.to))?.add(low(l.name));
    }
}
const reach = new Set([start]);
const queue = [start];
while (queue.length > 0) {
    for (const next of graph.get(/** @type {string} */ (queue.shift())) ?? []) {
        if (!reach.has(next)) {
            reach.add(next);
            queue.push(next);
        }
    }
}
for (const l of locations) {
    if (!reach.has(low(l.name))) errors.push(`«${l.name}» no tiene camino desde ${locations[0]?.name}`);
}

// ---------------------------------------------------------------- la variedad
const verbs = [...contracts].sort((a, b) => (a.act ?? 1) - (b.act ?? 1)).map(c => low(c.verb));
for (let i = 2; i < verbs.length; i++) {
    if (verbs[i] && verbs[i] === verbs[i - 1] && verbs[i] === verbs[i - 2]) {
        warnings.push(`Tres encargos seguidos de «${verbs[i]}» (regla 1 de la variedad)`);
    }
}
/** @type {Map<string, number>} */
const mapUse = new Map();
for (const b of encounters) mapUse.set(text(b.mapId) || text(b.id), (mapUse.get(text(b.mapId) || text(b.id)) ?? 0) + 1);
for (const [id, n] of mapUse) if (n > 2) warnings.push(`El tablero «${id}» sale en ${n} combates (la regla dice dos como mucho)`);
for (const l of locations) {
    const who = npcs.filter(p => low(p.where) === low(l.name)).length;
    const said = rumors.filter(r => low(r.where) === low(l.name)).length;
    const services = list(l.services).length;
    const hasBoard = boards.some(b => low(b.locationName) === low(l.name));
    if (who + said + services === 0 && !hasBoard) errors.push(`En «${l.name}» no hay nada que hacer: ni gente, ni rumores, ni servicios, ni tablero`);
    else if (who === 0 && said === 0) warnings.push(`«${l.name}»: nadie con quien hablar y nada que oír`);
}

// ---------------------------------------------------------------- el informe
console.log(`Mundo: ${text(pack.world?.name)}\n`);
for (const line of counts) console.log(`  ${line}`);
if (warnings.length) console.log('');
for (const line of warnings) console.log(`AVISO  ${line}`);
if (errors.length) console.log('');
for (const line of errors) console.log(`ERROR  ${line}`);
console.log(`\n${errors.length === 0 ? 'Llega al listón.' : `${errors.length} cosa(s) por arreglar.`}`);
process.exit(errors.length === 0 ? 0 : 1);
