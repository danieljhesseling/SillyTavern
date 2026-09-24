import { describe, test, expect } from '@jest/globals';
import {
    readWrittenContracts, writtenShare, availableWritten, writtenSlots, toBoardContract, settlesNoFight,
    describeWrittenAccept, DEFAULT_MIX,
} from '../public/scripts/game-engine/campaign/written-contracts.js';
import { readRumors, rumorsHere, nextRumor, describeRumor } from '../public/scripts/game-engine/campaign/rumors.js';
import { readPlot, startPlot, plotEvent, chooseEnding, hasEnded } from '../public/scripts/game-engine/campaign/plot.js';

const contracts = readWrittenContracts([
    { id: 'a1', title: 'El carro', verb: 'investigar', act: 1, noFight: true, where: 'Pueblo', chain: { id: 'acero', part: 1, of: 2 } },
    { id: 'a2', title: 'La carga', verb: 'recuperar', act: 1, where: 'Bosque', boardName: 'El hierro', chain: { id: 'acero', part: 2, of: 2 }, reward: 30 },
    { id: 'b1', title: 'Las redes', verb: 'cazar', act: 2, where: 'Lago' },
    { id: '', title: 'Sin id' },
]);

describe('los encargos escritos', () => {
    test('se leen, y lo roto se cae', () => {
        expect(contracts.map(c => c.id)).toEqual(['a1', 'a2', 'b1']);
        expect(contracts[1]).toMatchObject({ act: 1, noFight: false, reward: 30, boardName: 'El hierro' });
    });

    test('la curva de la mezcla: 80, 60, 40 y 10 %', () => {
        expect(writtenShare(1)).toBe(DEFAULT_MIX[1]);
        expect(writtenShare(3)).toBe(0.4);
        expect(writtenShare(2, true)).toBe(0.1);
        expect(writtenShare(1, false, { 1: 0.5 })).toBe(0.5);
    });

    test('se ofrecen los del acto, y la cadena parte a parte', () => {
        expect(availableWritten({ contracts, act: 1 }).map(c => c.id)).toEqual(['a1']);
        expect(availableWritten({ contracts, act: 1, done: ['a1'] }).map(c => c.id)).toEqual(['a2']);
        expect(availableWritten({ contracts, act: 2, done: ['a1'], busy: ['a2'] }).map(c => c.id)).toEqual(['b1']);
    });

    test('cuántos huecos llena lo escrito, sin pasarse de lo que hay', () => {
        expect(writtenSlots({ wanted: 5, onBoard: 0, available: 10, act: 1 })).toBe(4);
        expect(writtenSlots({ wanted: 5, onBoard: 3, available: 10, act: 1 })).toBe(1);
        expect(writtenSlots({ wanted: 5, onBoard: 0, available: 1, act: 1 })).toBe(1);
        expect(writtenSlots({ wanted: 5, onBoard: 0, available: 9, act: 3 })).toBe(2);
    });

    test('en el tablón, con su tablero o sin pelea', () => {
        const board = toBoardContract(contracts[1], 3);
        expect(board).toMatchObject({ id: 'a2', kind: 'recover', written: true, boardName: 'El hierro', days: 24, noFight: false });
        expect(describeWrittenAccept(toBoardContract(contracts[0], 1))).toMatch(/sin pelear/);
    });

    test('uno sin pelea se cumple con una tirada buena en su sitio', () => {
        const taken = toBoardContract(contracts[0], 1);
        expect(settlesNoFight(taken, { place: 'pueblo', success: true })).toBe(true);
        expect(settlesNoFight(taken, { place: 'Bosque', success: true })).toBe(false);
        expect(settlesNoFight(taken, { place: 'Pueblo', success: false })).toBe(false);
        expect(settlesNoFight(toBoardContract(contracts[1], 1), { place: 'Bosque', success: true })).toBe(false);
    });
});

describe('los rumores', () => {
    const rumors = readRumors([
        { id: 'r1', where: 'Pueblo', by: 'Giles', text: 'Luces en la cala', leadsTo: 'La cala' },
        { id: 'r2', where: 'Pueblo', text: 'El herrero forja de noche' },
        { id: 'r3', where: 'Castillo', text: 'Cobre pintado' },
    ]);

    test('se oyen los de aquí, en orden y sin repetir', () => {
        expect(rumorsHere({ rumors, here: 'pueblo' }).map(r => r.id)).toEqual(['r1', 'r2']);
        expect(nextRumor({ rumors, here: 'Pueblo', heard: ['r1'] })?.id).toBe('r2');
        expect(nextRumor({ rumors, here: 'Pueblo', heard: ['r1', 'r2'] })).toBeNull();
    });

    test('se cuenta en boca de quien lo dice, sin decir si es verdad', () => {
        expect(describeRumor(rumors[0])).toMatch(/^Giles cuenta: «Luces en la cala»/);
        expect(describeRumor(rumors[1])).toMatch(/^Alguien del lugar cuenta/);
        expect(describeRumor(rumors[0])).toMatch(/No digas si es verdad/);
    });
});

describe('los finales según con quién te alías', () => {
    const plot = /** @type {any} */ (readPlot({
        milestones: [
            { id: 'ultima', title: 'La última paga', opens: { kind: 'start' }, asks: { kind: 'win', place: 'Castillo' },
                changes: { ending: 'anarquia', endingBy: { keller: 'yugo', lobos: 'anarquia' } } },
        ],
        endings: { yugo: { title: 'El yugo', scene: 'Bandera negra.' }, anarquia: { title: 'La anarquía', scene: 'Sin reyes.' } },
    }));

    test('los finales se leen con su texto', () => {
        expect(plot.endings.yugo).toEqual({ title: 'El yugo', scene: 'Bandera negra.' });
    });

    test('decide la facción que mejor os mira', () => {
        const step = plotEvent(plot, startPlot(plot).state, { kind: 'win', place: 'Castillo' });
        expect(hasEnded(plot, step.state)).toBe(true);
        expect(chooseEnding(step.changes, [{ id: 'keller', reputation: 3 }, { id: 'lobos', reputation: 1 }])).toBe('yugo');
        expect(chooseEnding(step.changes, [{ id: 'keller', reputation: -2 }, { id: 'lobos', reputation: 2 }])).toBe('anarquia');
    });

    test('sin esas facciones, el de reserva', () => {
        expect(chooseEnding({ ending: 'anarquia', endingBy: { keller: 'yugo' } }, [])).toBe('anarquia');
        expect(chooseEnding({ ending: 'solo', endingBy: {} }, [])).toBe('solo');
    });
});
