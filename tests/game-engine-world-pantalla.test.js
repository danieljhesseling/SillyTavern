/**
 * «El mundo tras la pantalla» (tanda 20): la campaña escrita en rondas (`wiki/guiones/pantalla`) y
 * su paquete (`public/mundos/pantalla.pack.json`). Si alguien toca las rondas sin regenerar el
 * paquete, o rompe el hilo, las ramas o las conversaciones, esto lo dice.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { convertGuion, isRoundFile } from '../public/scripts/game-engine/campaign/guion-pack.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { checkWorldDensity } from '../public/scripts/game-engine/campaign/world-density.js';
import { unreachableBoards } from '../public/scripts/game-engine/campaign/guided-mode.js';
import { readPlot, startPlot, plotEvent, hasEnded, chooseEnding } from '../public/scripts/game-engine/campaign/plot.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const jsyaml = require('js-yaml');
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

const pack = readJson('public/mundos/pantalla.pack.json');
const mundos = readJson('public/mundos/mundos.json');
const ROUNDS = join(ROOT, 'wiki/guiones/pantalla');

/** Los pasos de las misiones personales de los compañeros, con sus líneas (vacías si no hablan). */
const QUEST_STEPS = pack.confidants.flatMap((/** @type {any} */ c) => (c.misionPersonal?.steps ?? [])
    .map((/** @type {any} */ s) => ({ ...s, beats: s.beats ?? [] })));

/** @param {string} id */
const milestone = (id) => pack.plot.milestones.find((/** @type {any} */ m) => m.id === id);

/**
 * Las opciones de las escenas de un hito, con su línea.
 *
 * @param {string} id
 * @returns {any[]}
 */
const sceneOptions = (id) => (milestone(id)?.beats ?? []).flatMap((/** @type {any} */ b) => b.options ?? []);

/**
 * Jugar el hilo entero con los sucesos del juego y una elección en cada rama.
 *
 * @param {'el-libro-a-la-ermita'|'el-libro-a-la-plaza'} book
 * @param {'rechazar-la-oferta'|'aceptar-la-oferta'} offer
 */
function playThrough(book, offer) {
    const plot = /** @type {any} */ (readPlot(pack.plot));
    /** @type {Record<string, number>} */
    const standing = {};
    let step = startPlot(plot, 1);
    const send = (/** @type {any} */ event) => {
        step = plotEvent(plot, step.state, event, 2);
        for (const [faction, amount] of Object.entries(step.changes.standing ?? {})) standing[faction] = (standing[faction] ?? 0) + Number(amount);
        return step;
    };
    send({ kind: 'talk', npc: 'Remedios Lumbre', place: 'Brasa' });
    send({ kind: 'win', place: 'El Bosque Copiado', board: 'El claro de los lobos repetidos' });
    send({ kind: 'arrive', place: 'La Hondonada Gris' });
    send({ kind: 'arrive', place: 'Cifra' });
    // La charla del tasador cumple su hito (no basta saludarle).
    send({ kind: 'milestone', id: 'el-tasador' });
    send({ kind: 'win', place: 'Cifra', board: 'La sala del registro' });
    send({ kind: 'arrive', place: 'Brasa' });
    // La decisión de la escena de la cocina: cumple la rama elegida y cierra la otra.
    send({ kind: 'milestone', id: book });
    send({ kind: 'arrive', place: 'Las Ruinas de la Torre Tres' });
    send({ kind: 'win', place: 'Las Ruinas de la Torre Tres', board: 'Los cristales de la Torre Tres' });
    send({ kind: 'arrive', place: 'Cifra' });
    send({ kind: 'milestone', id: offer });
    const end = offer === 'rechazar-la-oferta'
        ? (send({ kind: 'win', place: 'La Torre Siete', board: 'La escalera de la Torre Siete' }),
        send({ kind: 'win', place: 'La Torre Siete', board: 'La cumbre de la Torre Siete' }))
        : send({ kind: 'win', place: 'La Torre Siete', board: 'La puerta de la Torre Siete' });
    const factions = pack.world.factions.map((/** @type {any} */ f) => ({ ...f, reputation: Math.max(-5, Math.min(5, standing[f.id] ?? 0)) }));
    return { plot, end, state: end.state, ending: chooseEnding(end.changes, factions), standing };
}

describe('El mundo tras la pantalla, la campaña escrita', () => {
    test('mundos.json apunta a su paquete, para nivel 1 a 4', () => {
        const row = mundos.worlds.find((/** @type {any} */ w) => w.id === 'pantalla');
        expect(row?.pack).toBe('/mundos/pantalla.pack.json');
        expect(row?.levels).toEqual([1, 4]);
        expect(pack.world.levels).toEqual([1, 4]);
    });

    test('las rondas dan el paquete publicado, tal cual', () => {
        const rounds = readdirSync(ROUNDS).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(ROUNDS, name), 'utf8') }));
        const abilityRows = readJson('public/compendio/habilidades.json').rows;
        const result = convertGuion(rounds, { parseYaml: jsyaml.load, abilityRows });
        expect(result.stage).toBe('hecho');
        expect(JSON.parse(JSON.stringify(result.pack))).toEqual(pack);
    });

    test('pasa el validador y llega al listón de densidad', () => {
        const found = validatePack(pack);
        expect(found.errors).toEqual([]);
        expect(found.warnings).toEqual([]);
        const density = checkWorldDensity(pack);
        expect(density.errors).toEqual([]);
        expect(density.ok).toBe(true);
    });

    test('lo que pide el encargo: 10-14 localizaciones, 12-18 hitos en 4 actos, 20-30 personas, 10-15 encargos, 12-18 tableros, 3 finales', () => {
        expect(pack.locations.length).toBeGreaterThanOrEqual(10);
        expect(pack.locations.length).toBeLessThanOrEqual(14);
        expect(pack.plot.milestones.length).toBeGreaterThanOrEqual(12);
        expect(pack.plot.milestones.length).toBeLessThanOrEqual(18);
        expect(new Set(pack.plot.milestones.map((/** @type {any} */ m) => m.act))).toEqual(new Set([1, 2, 3, 4]));
        expect(pack.plot.chapters).toHaveLength(4);
        expect(pack.npcs.length).toBeGreaterThanOrEqual(20);
        expect(pack.npcs.length).toBeLessThanOrEqual(30);
        expect(pack.contracts.length).toBeGreaterThanOrEqual(10);
        expect(pack.contracts.length).toBeLessThanOrEqual(15);
        expect(pack.boards.length).toBeGreaterThanOrEqual(12);
        expect(pack.boards.length).toBeLessThanOrEqual(18);
        expect(Object.keys(pack.plot.endings)).toHaveLength(3);
        for (const ending of Object.values(pack.plot.endings)) expect(/** @type {any} */ (ending).epilogues.length).toBeGreaterThanOrEqual(3);
    });

    test('con el modo guiado se llega a cada pelea (D-J62): por un hito, una conversación o un encargo', () => {
        const loose = unreachableBoards(pack);
        expect(loose.fights).toEqual([]);
        expect(loose.empty).toEqual([]);
    });

    test('no hay narrador (D-J60): cada línea del hilo, de las misiones y de los compañeros la dice alguien', () => {
        for (const m of pack.plot.milestones) {
            expect(m.beats?.length).toBeGreaterThanOrEqual(2);
            for (const beat of m.beats) expect(beat.who).toBeTruthy();
        }
        for (const c of pack.confidants) {
            expect(c.aspecto).toBeTruthy();
            expect(c.scenes.map((/** @type {any} */ s) => s.rank)).toEqual([2, 4, 6, 8, 10]);
            for (const scene of c.scenes) for (const beat of scene.beats) expect(beat.say).toBeTruthy();
        }
        // Los pasos de las misiones personales: sin línea suelta (`text`) y con quién habla.
        for (const s of QUEST_STEPS) expect(s.text).toBeUndefined();
        for (const beat of QUEST_STEPS.flatMap(s => s.beats)) expect(beat.who).toBeTruthy();
        for (const p of pack.npcs) expect(p.aspecto).toBeTruthy();
    });

    test('las dos decisiones grandes se toman hablando, y cada rama tiene su escena al elegirla', () => {
        for (const [scene, branches] of /** @type {const} */ ([
            ['los-nombres-del-libro', ['el-libro-a-la-ermita', 'el-libro-a-la-plaza']],
            ['la-oferta', ['rechazar-la-oferta', 'aceptar-la-oferta']],
        ])) {
            const options = sceneOptions(scene);
            for (const branch of branches) {
                const option = options.find(o => (o.effects ?? []).some((/** @type {any} */ e) => e.milestone === branch));
                expect(option?.irreversible).toBe(true);
                // Una rama que pide llegar a un sitio juega su escena al cumplirse, no al abrirse:
                // las dos se abren a la vez y solo sale la que se elige.
                expect(milestone(branch).asks.kind).toBe('arrive');
                expect(milestone(branch).changes.close).toHaveLength(1);
            }
        }
    });

    test('tres caminos, tres finales: el libro decide cuál de los buenos, y la oferta si hay bueno', () => {
        const cuida = playThrough('el-libro-a-la-ermita', 'rechazar-la-oferta');
        expect(hasEnded(cuida.plot, cuida.state)).toBe(true);
        expect(cuida.ending).toBe('la-torre-que-cuida');
        const apagada = playThrough('el-libro-a-la-plaza', 'rechazar-la-oferta');
        expect(apagada.ending).toBe('la-torre-apagada');
        const sigue = playThrough('el-libro-a-la-ermita', 'aceptar-la-oferta');
        expect(sigue.ending).toBe('la-cuenta-sigue');
        // La rama que no se tomó queda cerrada.
        expect(cuida.state.closed).toEqual(expect.arrayContaining(['el-libro-a-la-plaza', 'aceptar-la-oferta']));
    });

    test('los compañeros: dos romances con su punto de inflexión, tres misiones con dos finales', () => {
        const romances = pack.confidants.filter((/** @type {any} */ c) => c.romance && c.romance.with !== 'nadie');
        expect(romances.map((/** @type {any} */ c) => c.id)).toEqual(['candela', 'yoli']);
        for (const c of romances) {
            const kinds = c.romance.escenas.map((/** @type {any} */ s) => `${s.kind}${s.step ?? ''}`);
            expect(kinds).toEqual(['senal', 'cita1', 'cita2', 'cita3', 'final', 'pareja', 'epilogo']);
            const turning = c.romance.escenas[0].beats.flatMap((/** @type {any} */ b) => b.replies ?? []).map((/** @type {any} */ r) => r.romance);
            expect(turning).toEqual(['avanza', 'amigos']);
            const night = c.romance.escenas.find((/** @type {any} */ s) => s.kind === 'final');
            expect(night.beats.flatMap((/** @type {any} */ b) => b.replies).some((/** @type {any} */ r) => r.fade)).toBe(true);
        }
        const quests = pack.confidants.filter((/** @type {any} */ c) => c.misionPersonal);
        expect(quests.map((/** @type {any} */ c) => c.id)).toEqual(['candela', 'yoli', 'arel']);
        for (const c of quests) {
            const q = c.misionPersonal;
            expect(q.endings).toHaveLength(2);
            const finals = new Set(q.steps.filter((/** @type {any} */ s) => s.kind === 'final').map((/** @type {any} */ s) => s.ending));
            expect(finals).toEqual(new Set(q.endings.map((/** @type {any} */ e) => e.id)));
        }
    });

    test('las peleas: cuatro victorias que no son «acabar con todos», salidas habladas y trampas', () => {
        const kinds = new Set(pack.quests.flatMap((/** @type {any} */ q) => q.objectives.map((/** @type {any} */ o) => o.type)));
        for (const kind of ['eliminate', 'reach_cell', 'survive_rounds', 'loot']) expect(kinds.has(kind)).toBe(true);
        const fights = pack.boards.filter((/** @type {any} */ b) => b.enemies.length > 0);
        for (const board of fights) expect(board.avoid?.length).toBeGreaterThanOrEqual(1);
        expect(pack.boards.filter((/** @type {any} */ b) => b.parley).length).toBeGreaterThanOrEqual(8);
        expect(pack.boards.flatMap((/** @type {any} */ b) => b.traps ?? []).length).toBeGreaterThanOrEqual(5);
        // Empujar importa: un precipicio en el mapa de al menos tres tableros.
        expect(pack.boards.filter((/** @type {any} */ b) => b.map.some((/** @type {string} */ row) => row.includes('v'))).length).toBeGreaterThanOrEqual(3);
        // Los dos finales son para nivel 4 (D-J59).
        for (const id of ['q-enc-cumbre', 'q-enc-puerta']) expect(pack.quests.find((/** @type {any} */ q) => q.id === id).levels).toEqual([4, 4]);
    });
});
