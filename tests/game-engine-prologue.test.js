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

    test('lo que ya no viene a cuento no sale: la pelea acabó mientras esperaba', () => {
        const fightOver = (/** @type {string} */ id) => !['combat', 'move', 'attack'].includes(id);
        expect(nextQueuedTip(['attack', 'journal', 'move'], [], fightOver)).toEqual({ id: 'journal', queue: ['move'] });
        expect(nextQueuedTip(['attack', 'move'], [], fightOver)).toEqual({ id: '', queue: [] });
        // Y no cuenta como visto: planTip lo vuelve a sacar cuando pasa otra vez.
        expect(planTip({ situation: 'attack', seen: [], queue: [], busy: false }).show?.id).toBe('attack');
    });
});

describe('J2.1: un prólogo corto y jugable', () => {
    const pack = read('../public/mundos/gremio.pack.json');
    const plot = /** @type {any} */ (readPlot(pack.plot));
    const here = { place: 'Puerto Alba' };

    test('empieza en el muelle, con el ratero: el primer tablero del paquete, que es donde se aparece', () => {
        const start = startPlot(plot);
        expect(start.opened.map(m => m.id)).toEqual(['el-muelle']);
        expect(start.opened[0].scene).toMatch(/muelle de Puerto Alba/);
        expect(pack.boards[0].name).toBe('El muelle de Puerto Alba');
        expect(pack.boards[0].enemies.map((/** @type {any} */ e) => e.name)).toEqual(['Ratero del muelle']);
    });

    test('se juega entero: la pelea del muelle, la charla con Tomás, Brunilda y la bodega, cada uno con su escena', () => {
        let state = startPlot(plot).state;
        const walk = [
            [{ kind: 'win', ...here, board: 'El muelle de Puerto Alba' }, 'el-muelle', 'la-charla', /Soy Tomás/],
            [{ kind: 'talk', ...here, npc: 'Tomás' }, 'la-charla', 'el-gremio', /Brunilda, la maestra del gremio/],
            [{ kind: 'talk', ...here, npc: 'Brunilda' }, 'el-gremio', 'la-prueba', /Baja a la bodega/],
            [{ kind: 'win', ...here, board: 'La bodega del gremio' }, 'la-prueba', 'el-tablon', /apunta tu nombre en el libro del gremio/],
        ];
        for (const [event, done, opened, scene] of walk) {
            const step = plotEvent(plot, state, event, 1);
            expect(step.done.map(m => m.id)).toEqual([done]);
            expect(step.opened.map(m => m.id)).toEqual([opened]);
            expect(step.opened[0].scene).toMatch(/** @type {RegExp} */ (scene));
            expect(step.skipped).toEqual([]);
            state = step.state;
        }
    });

    test('cuatro hitos antes del tablón, todos del prólogo; el tablón ya no', () => {
        const ids = plot.milestones.filter((/** @type {any} */ m) => m.prologue).map((/** @type {any} */ m) => m.id);
        expect(ids).toEqual(['el-muelle', 'la-charla', 'el-gremio', 'la-prueba']);
        expect(plot.milestones.find((/** @type {any} */ m) => m.id === 'el-tablon').prologue).toBeUndefined();
    });

    test('el texto es llano: sin «localidad», y el género con sus marcas', () => {
        const all = plot.milestones.map((/** @type {any} */ m) => `${m.title} ${m.hint} ${m.scene}`).join(' ');
        expect(all).not.toMatch(/localidad/i);
        expect(all).toMatch(/\{cansado\|cansada\}/);
        expect(all).toMatch(/\{entero\|entera\}/);
    });

    test('bajar a la bodega por tu cuenta y ganarla cierra el prólogo: nadie se queda atascado', () => {
        let state = startPlot(plot).state;
        state = plotEvent(plot, state, { kind: 'win', ...here, board: 'El muelle de Puerto Alba' }, 1).state;
        const step = plotEvent(plot, state, { kind: 'win', ...here, board: 'La bodega del gremio' }, 1);
        expect(step.skipped.map(m => m.id)).toEqual(['la-charla', 'el-gremio']);
        expect(step.done.map(m => m.id)).toEqual(['la-prueba']);
        expect(step.opened.map(m => m.id)).toEqual(['el-tablon']);
        expect(step.state.done).toEqual(expect.arrayContaining(['el-muelle', 'la-charla', 'el-gremio', 'la-prueba']));
    });

    test('ganar el muelle no toca lo demás, y fuera del prólogo la regla no hace nada', () => {
        const start = startPlot(plot);
        const pier = plotEvent(plot, start.state, { kind: 'win', ...here, board: 'El muelle de Puerto Alba' }, 1);
        expect(pier.skipped).toEqual([]);
        expect(pier.state.done).toEqual(['el-muelle']);
        // Un hilo sin prólogo marcado sigue como siempre: ganar un tablero que no toca, nada.
        const plain = /** @type {any} */ (readPlot({ milestones: [
            { id: 'a', title: 'A', opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'X' } },
            { id: 'b', title: 'B', opens: { kind: 'after', milestone: 'a' }, asks: { kind: 'win', board: 'Y' } },
        ] }));
        const quiet = plotEvent(plain, startPlot(plain).state, { kind: 'win', board: 'Y' }, 1);
        expect(quiet.done).toEqual([]);
        expect(quiet.state.open).toEqual(['a']);
    });
});

describe('J2.3: la prueba del gremio se puede saltar', () => {
    const plot = /** @type {any} */ (readPlot(read('../public/mundos/gremio.pack.json').plot));

    test('recién empezado, la prueba es la bodega, y quedan el muelle y la bodega por ganar', () => {
        const start = startPlot(plot);
        expect(hubTrial(plot, start.state)).toEqual({
            id: 'la-prueba', title: 'La prueba del gremio', board: 'La bodega del gremio', place: '',
            boards: [{ board: 'El muelle de Puerto Alba', place: '' }, { board: 'La bodega del gremio', place: '' }],
        });
    });

    test('saltarla es el mismo suceso que ganarla: salta el prólogo entero, sin contarlo, y abre el tablón', () => {
        const start = startPlot(plot);
        const trial = /** @type {any} */ (hubTrial(plot, start.state));
        const step = plotEvent(plot, start.state, { kind: 'win', place: 'Puerto Alba', board: trial.board }, 1);
        expect(step.done.map(m => m.id)).toEqual(['la-prueba']);
        // Lo de antes queda hecho, pero su escena no se cuenta: no se ha jugado.
        expect(step.skipped.map(m => m.id)).toEqual(['el-muelle', 'la-charla', 'el-gremio']);
        expect(step.state.done).toEqual(expect.arrayContaining(['el-muelle', 'la-charla', 'el-gremio', 'la-prueba']));
        expect(step.opened.map(m => m.id)).toEqual(['el-tablon']);
        expect(step.opened[0].scene).toMatch(/apunta tu nombre en el libro del gremio/);
        // Y ya no hay prueba que saltar.
        expect(hubTrial(plot, step.state)).toBeNull();
    });

    test('se puede saltar a mitad del prólogo, y solo quedan los tableros sin ganar', () => {
        const start = startPlot(plot);
        const pier = plotEvent(plot, start.state, { kind: 'win', place: 'Puerto Alba', board: 'El muelle de Puerto Alba' }, 1);
        expect(hubTrial(plot, pier.state)?.boards).toEqual([{ board: 'La bodega del gremio', place: '' }]);
        const talk = plotEvent(plot, pier.state, { kind: 'talk', place: 'Puerto Alba', npc: 'Tomás' }, 1);
        expect(hubTrial(plot, talk.state)?.id).toBe('la-prueba');
    });

    test('un gremio de antes, sin prólogo marcado: la prueba es el hito con el que empieza', () => {
        const old = /** @type {any} */ (readPlot({ milestones: [
            { id: 'la-prueba', title: 'La prueba del gremio', opens: { kind: 'start' }, asks: { kind: 'win', board: 'La bodega del gremio' } },
        ] }));
        const start = startPlot(old);
        expect(hubTrial(old, start.state)).toEqual({ id: 'la-prueba', title: 'La prueba del gremio', board: 'La bodega del gremio', place: '',
            boards: [{ board: 'La bodega del gremio', place: '' }] });
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
