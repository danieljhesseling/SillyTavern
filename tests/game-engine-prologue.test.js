import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import { tipFor, planTip, nextQueuedTip, TIPS, MOMENT_TIPS } from '../public/scripts/game-engine/ui/shell/tips.js';
import { hubTrial } from '../public/scripts/game-engine/campaign/hub.js';
import { readPlot, startPlot, plotEvent } from '../public/scripts/game-engine/campaign/plot.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('J2.2: enseña jugando', () => {
    test('cada momento tiene su consejo, corto y sin palabras de la API', () => {
        for (const id of MOMENT_TIPS) {
            expect(typeof TIPS[id]).toBe('string');
            expect(TIPS[id].length).toBeLessThanOrEqual(160);
            expect(TIPS[id]).not.toMatch(/localidad|\/combat-/i);
        }
        expect(tipFor('move', [])?.text).toMatch(/^Te toca/);
        expect(tipFor('journal', [])?.text).toMatch(/Diario/);
    });

    test('un consejo visto no vuelve', () => {
        expect(planTip({ situation: 'move', seen: ['move'], queue: [], busy: false })).toEqual({ show: null, queue: [] });
        expect(planTip({ situation: 'nada', seen: [], queue: [], busy: false }).show).toBeNull();
    });

    test('de uno en uno: con otro a la vista, espera detrás, una vez y en orden', () => {
        let queue = /** @type {string[]} */ ([]);
        queue = planTip({ situation: 'roll', seen: ['combat'], queue, busy: true }).queue;
        queue = planTip({ situation: 'move', seen: ['combat'], queue, busy: true }).queue;
        queue = planTip({ situation: 'roll', seen: ['combat'], queue, busy: true }).queue;
        expect(queue).toEqual(['roll', 'move']);

        const now = planTip({ situation: 'combat', seen: [], queue: [], busy: false });
        expect(now.show).toEqual({ id: 'combat', text: TIPS.combat });
    });

    test('lo que espera sale cuando se cierra el de antes; lo que ya se vio mientras, no', () => {
        expect(nextQueuedTip(['roll', 'move'], ['combat'])).toEqual({ id: 'roll', queue: ['move'] });
        expect(nextQueuedTip(['roll', 'move'], ['roll'])).toEqual({ id: 'move', queue: [] });
        expect(nextQueuedTip([], [])).toEqual({ id: '', queue: [] });
        // Enseñarlo ya lo saca de la cola.
        expect(planTip({ situation: 'move', seen: [], queue: ['move', 'talk'], busy: false }).queue).toEqual(['talk']);
    });
});

describe('J2.3: la prueba del gremio se puede saltar', () => {
    const plot = /** @type {any} */ (readPlot(read('../public/mundos/gremio.pack.json').plot));

    test('recién empezado, la prueba es la bodega', () => {
        const start = startPlot(plot);
        expect(hubTrial(plot, start.state)).toEqual({ id: 'la-prueba', title: 'La prueba del gremio', board: 'La bodega del gremio', place: '' });
    });

    test('saltarla es el mismo suceso que ganarla: abre el tablón y cuenta su escena', () => {
        const start = startPlot(plot);
        const trial = /** @type {any} */ (hubTrial(plot, start.state));
        const step = plotEvent(plot, start.state, { kind: 'win', place: 'Puerto Alba', board: trial.board }, 1);
        expect(step.done.map(m => m.id)).toEqual(['la-prueba']);
        expect(step.opened.map(m => m.id)).toEqual(['el-tablon']);
        expect(step.opened[0].scene).toMatch(/apunta tu nombre en el libro del gremio/);
        // Y ya no hay prueba que saltar.
        expect(hubTrial(plot, step.state)).toBeNull();
    });

    test('sin hilo, o con un hito de arranque que no es una pelea, no hay prueba', () => {
        expect(hubTrial(null, null)).toBeNull();
        const talk = { milestones: [{ id: 'a', opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Brunilda' } }] };
        expect(hubTrial(talk, { open: ['a'] })).toBeNull();
        const hidden = { milestones: [{ id: 'a', hidden: true, opens: { kind: 'start' }, asks: { kind: 'win', board: 'X' } }] };
        expect(hubTrial(hidden, { open: ['a'] })).toBeNull();
    });

    test('la fila ofrece pelear, saltar, el tablón y contratar, por ese orden', () => {
        const hub = [
            { id: 'hub-skip', label: 'Saltar la prueba', icon: 'fa-forward', command: '/saltar-prueba' },
            { id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll', command: '/campanas' },
            { id: 'hub-hire', label: 'Contratar mercenarios', icon: 'fa-coins', command: '/contratar' },
        ];
        const chips = buildActionChips({ fight: 'Rata de bodega x2', hub });
        expect(chips.slice(0, 4).map(c => c.label)).toEqual(['Iniciar combate (Rata de bodega x2)', 'Saltar la prueba', 'Tablón de campañas', 'Contratar mercenarios']);
        expect(chips[1].command).toBe('/saltar-prueba');
    });
});
