import { describe, test, expect } from '@jest/globals';
import {
    readPlot, readPlotState, startPlot, plotEvent, focusOf, actOf, describeFocus, hasEnded, plotFromFaction,
} from '../public/scripts/game-engine/campaign/plot.js';

/** La costa, en pequeño: una mecha, una conversación, un sitio escondido y dos finales. */
const costa = readPlot({
    title: 'La costa',
    milestones: [
        {
            id: 'ahogado', act: 1, title: 'El primer ahogado', hint: 'Alguien sabe quién era.',
            scene: 'Al amanecer, un cuerpo en la playa.',
            opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Maren', place: 'Puerto de Gris' },
            changes: { reveal: ['La cala'], standing: { cofradia: -1 } },
        },
        {
            id: 'la-cala', act: 2, title: 'La cala de los votos', hint: 'Solo se entra con marea baja.',
            opens: { kind: 'after', milestone: 'ahogado' }, asks: { kind: 'arrive', place: 'La cala' },
        },
        {
            id: 'la-firma', act: 2, title: 'La firma', hint: 'El libro del muelle.',
            opens: { kind: 'after', milestone: 'la-cala' }, asks: { kind: 'check', skill: 'investigation' },
            changes: { open: ['el-trato'] },
        },
        {
            id: 'el-trato', act: 3, title: 'Romper el trato', hint: 'Bajo el embarcadero.',
            opens: { kind: 'after', milestone: 'nunca' }, asks: { kind: 'win', place: 'Puerto de Gris' },
            changes: { ending: 'roto' },
        },
        {
            id: 'mareas', act: 3, title: 'Las mareas no esperan',
            opens: { kind: 'day', day: 30 }, asks: { kind: 'none' }, changes: { ending: 'ahogados' },
        },
    ],
});

describe('leer el hilo', () => {
    test('un hito sin título se cae y el resto sigue', () => {
        const plot = readPlot({ milestones: [{ id: 'a' }, { id: 'b', title: 'B' }] });
        expect(plot?.milestones.map(m => m.id)).toEqual(['b']);
    });

    test('lo desconocido se corrige a algo con sentido', () => {
        const plot = readPlot({ milestones: [{ title: 'X', act: 9, opens: { kind: 'magia' }, asks: { kind: 'bailar' } }] });
        expect(plot?.milestones[0]).toMatchObject({ id: 'hito_1', act: 3, opens: { kind: 'after' }, asks: { kind: 'none' } });
    });

    test('sin hitos, no hay hilo', () => {
        expect(readPlot({ milestones: [] })).toBeNull();
        expect(readPlot(null)).toBeNull();
    });

    test('el estado se lee sin repetidos', () => {
        expect(readPlotState({ open: ['a', 'a'], done: null })).toEqual({ open: ['a'], done: [] });
    });
});

describe('la mecha y el camino', () => {
    const plot = /** @type {any} */ (costa);

    test('empezar abre la mecha, y eso es lo que tienes entre manos', () => {
        const step = startPlot(plot);
        expect(step.opened.map(m => m.id)).toEqual(['ahogado']);
        expect(focusOf(plot, step.state)).toMatchObject({ title: 'El primer ahogado', act: 1 });
        expect(describeFocus(focusOf(plot, step.state))).toBe('El primer ahogado — Alguien sabe quién era.');
    });

    test('nombrar a alguien donde está cumple el hito, revela el sitio y abre el siguiente', () => {
        const start = startPlot(plot).state;
        const step = plotEvent(plot, start, { kind: 'say', text: 'Le pregunto a Maren por el muerto', place: 'Puerto de Gris' });
        expect(step.done.map(m => m.id)).toEqual(['ahogado']);
        expect(step.changes.reveal).toEqual(['La cala']);
        expect(step.changes.standing).toEqual({ cofradia: -1 });
        expect(step.opened.map(m => m.id)).toEqual(['la-cala']);
        expect(focusOf(plot, step.state)?.id).toBe('la-cala');
    });

    test('nombrarla en otro sitio no cuenta', () => {
        const start = startPlot(plot).state;
        expect(plotEvent(plot, start, { kind: 'say', text: 'Maren', place: 'La atalaya' }).done).toEqual([]);
    });

    test('una tirada fallida no cumple, una buena sí, y abre lo que dice', () => {
        let state = startPlot(plot).state;
        state = plotEvent(plot, state, { kind: 'say', text: 'Maren', place: 'Puerto de Gris' }).state;
        state = plotEvent(plot, state, { kind: 'arrive', place: 'la cala' }).state;
        expect(plotEvent(plot, state, { kind: 'check', skill: 'investigation', success: false }).done).toEqual([]);
        const step = plotEvent(plot, state, { kind: 'check', skill: 'investigation', success: true });
        expect(step.opened.map(m => m.id)).toEqual(['el-trato']);
        expect(actOf(plot, step.state)).toBe(3);
    });

    test('ganar donde toca llega a un final, y después no se abre nada más', () => {
        let state = startPlot(plot).state;
        state = plotEvent(plot, state, { kind: 'say', text: 'Maren', place: 'Puerto de Gris' }).state;
        state = plotEvent(plot, state, { kind: 'arrive', place: 'La cala' }).state;
        state = plotEvent(plot, state, { kind: 'check', skill: 'investigation', success: true }).state;
        const won = plotEvent(plot, state, { kind: 'win', place: 'Puerto de Gris', board: 'El embarcadero' });
        expect(won.changes.ending).toBe('roto');
        expect(hasEnded(plot, won.state)).toBe(true);
        expect(plotEvent(plot, won.state, { kind: 'day', day: 40 }).opened).toEqual([]);
    });

    test('ignorar el hilo también tiene final: los días lo abren y se cumple solo', () => {
        const step = plotEvent(plot, startPlot(plot).state, { kind: 'day', day: 30 });
        expect(step.opened.map(m => m.id)).toEqual(['mareas']);
        expect(step.done.map(m => m.id)).toEqual(['mareas']);
        expect(step.changes.ending).toBe('ahogados');
    });

    test('sin hilo, nada pasa', () => {
        expect(plotEvent(null, {}, { kind: 'arrive', place: 'x' }).done).toEqual([]);
        expect(focusOf(null, {})).toBeNull();
    });
});

describe('el hilo de un mundo sin hilo escrito', () => {
    const factions = [
        { id: 'casa', name: 'La casa del Vado', seat: 'Vado', holds: [], reputation: 0, enemies: [],
            goal: { kind: 'conquistar', target: 'Paso Alto', at: 1, of: 6, pace: 7 } },
        { id: 'cuervos', name: 'Los Cuervos', seat: 'Torre', holds: [], reputation: 0, enemies: [],
            goal: { kind: 'destruir', target: 'el molinero', at: 4, of: 6, pace: 7 } },
    ];

    test('sale de la facción que más cerca está de su meta', () => {
        const plot = plotFromFaction({ factions });
        expect(plot?.source).toBe('faction');
        expect(plot?.title).toBe('Los Cuervos');
    });

    test('la mecha se cumple al abrirse, y lo que queda es ir a verlos', () => {
        const plot = /** @type {any} */ (plotFromFaction({ factions }));
        const step = startPlot(plot);
        expect(step.done.map(m => m.id)).toEqual(['mecha']);
        expect(step.opened[0].scene).toMatch(/Los Cuervos van a por el molinero/);
        expect(focusOf(plot, step.state)).toMatchObject({ id: 'verlo', hint: 'Se les encuentra en Torre.' });
    });

    test('de ahí, tomar partido y pararlos', () => {
        const plot = /** @type {any} */ (plotFromFaction({ factions }));
        let state = startPlot(plot).state;
        state = plotEvent(plot, state, { kind: 'arrive', place: 'Torre' }).state;
        expect(focusOf(plot, state)?.id).toBe('partido');
        state = plotEvent(plot, state, { kind: 'contract', faction: 'cuervos', against: false }).state;
        expect(focusOf(plot, state)?.id).toBe('partido');
        state = plotEvent(plot, state, { kind: 'contract', faction: 'cuervos', against: true }).state;
        const end = plotEvent(plot, state, { kind: 'win', place: 'Torre' });
        expect(end.changes.ending).toBe('parados');
    });

    test('si su reloj se llena antes, llegasteis tarde', () => {
        const plot = /** @type {any} */ (plotFromFaction({ factions }));
        const step = plotEvent(plot, startPlot(plot).state, { kind: 'clock', faction: 'cuervos' });
        expect(step.changes.ending).toBe('tarde');
    });

    test('sin facciones, sin hilo', () => {
        expect(plotFromFaction({ factions: [] })).toBeNull();
    });
});
