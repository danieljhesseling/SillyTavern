import { describe, test, expect } from '@jest/globals';
import {
    createCheckpoint, normalizeCheckpoints, addCheckpoint, findCheckpoint,
    removeCheckpoint, describeCheckpoint, MAX_CHECKPOINTS, CHECKPOINT_VERSION,
} from '../public/scripts/game-engine/campaign/checkpoint.js';

const state = () => ({ party: [{ name: 'Lyra', hp: 12 }], calendar: { day: 3 } });
const at = (iso) => () => iso;

describe('tomar la foto', () => {
    test('guarda el estado y por que se guardo', () => {
        const cp = createCheckpoint({ label: 'Antes del Guardian', state: state(), now: at('2026-09-22T10:00:00Z') });
        expect(cp.label).toBe('Antes del Guardian');
        expect(cp.savedAt).toBe('2026-09-22T10:00:00Z');
        expect(cp.version).toBe(CHECKPOINT_VERSION);
        expect(cp.state.calendar.day).toBe(3);
    });

    test('la foto es una copia: tocar la partida despues no la cambia', () => {
        const live = state();
        const cp = createCheckpoint({ label: 'x', state: live });
        live.party[0].hp = 1;
        expect(cp.state.party[0].hp).toBe(12);
    });

    test('sin nombre, se le pone uno', () => {
        expect(createCheckpoint({ label: '   ', state: {} }).label).toBe('Sin nombre');
    });

    test('dos seguidos no comparten identificador', () => {
        const a = createCheckpoint({ label: 'a', state: {} });
        const b = createCheckpoint({ label: 'b', state: {} });
        expect(a.id).not.toBe(b.id);
    });
});

describe('la lista', () => {
    test('lo que no se sostiene se cae al leerla', () => {
        expect(normalizeCheckpoints([null, { id: 'x' }, { state: {} }])).toEqual([]);
        expect(normalizeCheckpoints('nada')).toEqual([]);
    });

    test('el ultimo va primero', () => {
        const uno = createCheckpoint({ label: 'uno', state: {} });
        const dos = createCheckpoint({ label: 'dos', state: {} });
        expect(addCheckpoint([uno], dos)[0].label).toBe('dos');
    });

    test('no pasa de su tamano', () => {
        let list = [];
        for (let i = 0; i < MAX_CHECKPOINTS + 3; i++) {
            list = addCheckpoint(list, createCheckpoint({ label: `n${i}`, state: {}, automatic: true }));
        }
        expect(list).toHaveLength(MAX_CHECKPOINTS);
    });

    test('y el automatico no se lleva por delante el que guardaste tu', () => {
        const mio = createCheckpoint({ label: 'mio', state: {} });
        let list = [mio];
        for (let i = 0; i < MAX_CHECKPOINTS + 2; i++) {
            list = addCheckpoint(list, createCheckpoint({ label: `auto${i}`, state: {}, automatic: true }));
        }
        expect(list.some(cp => cp.label === 'mio')).toBe(true);
    });

    test('se busca y se quita por id', () => {
        const cp = createCheckpoint({ label: 'uno', state: state() });
        const list = addCheckpoint([], cp);
        expect(findCheckpoint(list, cp.id).label).toBe('uno');
        expect(findCheckpoint(list, 'otro')).toBeNull();
        expect(removeCheckpoint(list, cp.id)).toEqual([]);
    });
});

describe('como se lee', () => {
    test('dice que es y cuando', () => {
        const cp = createCheckpoint({ label: 'Antes del Guardian', state: {}, now: at('2026-09-22T10:30:00Z') });
        expect(describeCheckpoint(cp)).toBe('Antes del Guardian · 2026-09-22 10:30');
    });

    test('y si lo puso el juego, lo dice', () => {
        const cp = createCheckpoint({ label: 'Antes del jefe', state: {}, automatic: true, now: at('2026-09-22T10:30:00Z') });
        expect(describeCheckpoint(cp)).toMatch(/automático$/);
    });
});
