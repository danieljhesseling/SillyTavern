import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { convertGuion, isRoundFile } from '../public/scripts/game-engine/campaign/guion-pack.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { checkWorldDensity } from '../public/scripts/game-engine/campaign/world-density.js';
import { unreachableBoards } from '../public/scripts/game-engine/campaign/guided-mode.js';
import { checkCompanionStories } from '../public/scripts/game-engine/campaign/companion-stories.js';
import { readPlot, startPlot, plotEvent, readPlotState, chooseEnding } from '../public/scripts/game-engine/campaign/plot.js';
import { changeStanding, readFactions } from '../public/scripts/game-engine/campaign/factions.js';

// «Las tierras del ocaso» (tanda 20): las rondas de wiki/guiones/ocaso son la fuente, y
// public/mundos/ocaso.pack.json es lo que sale de ellas con el conversor.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const jsyaml = require('js-yaml');
const abilityRows = JSON.parse(readFileSync(join(ROOT, 'public/compendio/habilidades.json'), 'utf8')).rows ?? [];
const DIR = join(ROOT, 'wiki/guiones/ocaso');
const rounds = readdirSync(DIR).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));
const pack = JSON.parse(readFileSync(join(ROOT, 'public/mundos/ocaso.pack.json'), 'utf8'));

/** @param {any} value @returns {any[]} */
const list = (value) => (Array.isArray(value) ? value : []);

describe('Las tierras del ocaso: el guion y su paquete', () => {
    test('las rondas se convierten sin avisos y dan el paquete escrito en public/mundos', () => {
        const result = convertGuion(rounds, { parseYaml: jsyaml.load, abilityRows });
        expect(result.stage).toBe('hecho');
        expect(result.notes).toEqual([]);
        expect(result.issues.filter(i => i.level === 'ERROR')).toEqual([]);
        expect(result.ok).toBe(true);
        // El paquete del juego es el de las rondas: si se cambia una, se vuelve a pasar el conversor.
        expect(result.pack).toEqual(pack);
    });

    test('el paquete valida y llega al listón de densidad', () => {
        expect(validatePack(pack).errors).toEqual([]);
        const density = checkWorldDensity(pack);
        expect(density.errors).toEqual([]);
        expect(pack.plot.milestones.length).toBeGreaterThanOrEqual(12);
        expect(pack.plot.milestones.length).toBeLessThanOrEqual(18);
        expect(pack.locations.length).toBeGreaterThanOrEqual(10);
        expect(pack.locations.length).toBeLessThanOrEqual(14);
        expect(pack.contracts.length).toBeGreaterThanOrEqual(10);
        expect(Object.keys(pack.plot.endings)).toHaveLength(3);
    });

    test('con el modo guiado se llega a todos los tableros con pelea (D-J62)', () => {
        expect(unreachableBoards(pack).fights).toEqual([]);
    });

    test('no hay narrador en las escenas del hilo ni en las de las misiones (D-J60)', () => {
        const beats = [
            ...list(pack.plot.milestones).flatMap(m => list(m.beats)),
            ...list(pack.confidants).flatMap(c => list(c.misionPersonal?.steps).flatMap(s => list(s.beats))),
        ];
        expect(beats.length).toBeGreaterThan(80);
        expect(beats.filter(b => !String(b.who ?? '').trim())).toEqual([]);
        // Las escenas de vínculo y de romance las dice el compañero: sin `note`.
        const scenes = list(pack.confidants).flatMap(c => [...list(c.scenes), ...list(c.romance?.escenas)]);
        expect(scenes.flatMap(s => list(s.beats)).filter(b => 'note' in b)).toEqual([]);
        // Cinco escenas de vínculo por compañero, y cada una es una conversación.
        for (const c of pack.confidants) {
            expect(list(c.scenes).map(s => s.rank)).toEqual([2, 4, 6, 8, 10]);
            for (const s of c.scenes) expect(list(s.beats).length).toBeGreaterThan(0);
        }
    });

    test('tres compañeros con romance (punto de inflexión en el 9) y misión personal de dos finales', () => {
        expect(checkCompanionStories(pack)).toEqual([]);
        const full = pack.confidants.filter((/** @type {any} */ c) => c.romance && c.misionPersonal);
        expect(full.map((/** @type {any} */ c) => c.name)).toEqual(['Ilvana Hojarrubia', 'Ruy Zarzal', 'Gudrun Hondaroca']);
        for (const c of full) {
            const senal = c.romance.escenas.find((/** @type {any} */ e) => e.kind === 'senal');
            const replies = list(senal?.beats).flatMap(b => list(b.replies));
            // D-J63: una respuesta íntima abre la pareja; una de apoyo, la amistad sin castigo.
            expect(replies.map(r => r.romance)).toEqual(expect.arrayContaining(['avanza', 'amigos']));
            expect(c.romance.escenas.filter((/** @type {any} */ e) => e.kind === 'cita').map((/** @type {any} */ e) => e.step)).toEqual([1, 2, 3]);
            expect(list(c.romance.escenas.find((/** @type {any} */ e) => e.kind === 'final')?.beats).flatMap(b => list(b.replies)).some(r => r.fade)).toBe(true);
            expect(c.misionPersonal.endings).toHaveLength(2);
        }
    });

    test('el hilo se juega entero: la bandera elegida cierra las otras dos y decide el final', () => {
        const plot = readPlot(pack.plot);
        let state = startPlot(plot).state;
        /** @param {any} event */
        const go = (event) => {
            const step = plotEvent(plot, state, event);
            state = step.state;
            return step;
        };
        go({ kind: 'win', board: 'El puente caído', place: 'Tres Mojones' });
        go({ kind: 'talk', npc: 'Rufino Albarda', place: 'Tres Mojones' });
        go({ kind: 'arrive', place: 'Los Sauces' });
        go({ kind: 'win', board: 'Emboscada en la calzada', place: 'La Calzada Rota' });
        go({ kind: 'win', board: 'La cámara de Fullero', place: 'Vadoancho' });
        go({ kind: 'talk', npc: 'Tristán Oramar', place: 'Vadoancho' });
        go({ kind: 'arrive', place: 'Torre Brezo' });
        go({ kind: 'win', board: 'La puerta de las Forjas', place: 'Las Forjas de Hondaroca' });
        go({ kind: 'win', board: 'Los tótems de la mina', place: 'La Boca del Grajo' });
        go({ kind: 'win', board: 'La fuga del campamento', place: 'El Campamento del Cierzo' });
        go({ kind: 'arrive', place: 'El Refugio de la Cabra' });
        expect(readPlotState(state).open).toEqual(expect.arrayContaining(['bandera-brezo', 'bandera-oramar', 'bandera-hondaroca']));
        // La respuesta «Con la de Oramar» de la escena del refugio cumple su hito.
        const chosen = go({ kind: 'milestone', id: 'bandera-oramar' });
        // La bandera pesa, pero no lo decide todo: +4 a la casa elegida y −2 a las otras dos.
        expect(chosen.changes.standing).toEqual({ 'casa-oramar': 4, 'casa-brezo': -2, 'casa-hondaroca': -2 });
        expect(readPlotState(state).closed).toEqual(expect.arrayContaining(['bandera-brezo', 'bandera-hondaroca']));
        go({ kind: 'win', board: 'La cornisa de las grullas', place: 'La Atalaya de la Grulla' });
        const last = go({ kind: 'win', board: 'El fanal de la Atalaya', place: 'La Atalaya de la Grulla' });
        expect(readPlotState(state).done).toContain('m-fanal');
        const factions = [
            { id: 'casa-brezo', name: 'Casa Brezo', reputation: -5 },
            { id: 'casa-oramar', name: 'Casa Oramar', reputation: 5 },
            { id: 'casa-hondaroca', name: 'Casa Hondaroca', reputation: -4 },
        ];
        expect(chooseEnding(last.changes, factions)).toBe('paso-oramar');
    });

    test('lo hecho antes de la bandera aún puede cambiar el final', () => {
        const plot = readPlot(pack.plot);
        const milestone = (/** @type {string} */ id) => plot.milestones.find(m => m.id === id);
        const fanal = milestone('m-fanal');
        /** Lo que pensaban antes, y luego la bandera, movida como la mueve el juego (`shiftFactionStanding`). */
        const ending = (/** @type {Record<string, number>} */ before, /** @type {string} */ banner) => {
            let factions = readFactions(pack.world.factions.map((/** @type {any} */ f) => ({ ...f, reputation: before[f.id] ?? 0 })));
            for (const [id, amount] of Object.entries(milestone(banner)?.changes.standing ?? {})) factions = changeStanding(factions, id, amount);
            return chooseEnding(fanal?.changes ?? { ending: '', endingBy: {} }, factions);
        };
        // Sin nada antes, manda la bandera.
        expect(ending({}, 'bandera-brezo')).toBe('paso-brezo');
        expect(ending({}, 'bandera-oramar')).toBe('paso-oramar');
        expect(ending({}, 'bandera-hondaroca')).toBe('paso-abierto');
        // Con Brezo muy a favor (encargos, tratos, pueblos), la grulla sola no basta.
        expect(ending({ 'casa-brezo': 5, 'casa-oramar': -5 }, 'bandera-hondaroca')).toBe('paso-brezo');
        // Y quien se ganó a Hondaroca y fue contra Oramar acaba con el paso abierto aunque suba con Oramar.
        expect(ending({ 'casa-hondaroca': 5, 'casa-brezo': 5, 'casa-oramar': -5 }, 'bandera-oramar')).toBe('paso-abierto');
    });

    test('la moneda es la del juego: monedas, no sueldos', () => {
        expect(JSON.stringify(pack)).not.toMatch(/sueldos/);
        expect(JSON.stringify(pack)).toMatch(/monedas/);
    });
});
