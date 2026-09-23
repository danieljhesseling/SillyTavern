import { describe, test, expect } from '@jest/globals';
import {
    readDeeds, recordDeed, worldMemoryBlock, roadTrouble, MAX_DEEDS, DEEDS_TOLD, HOSTILE_AT,
} from '../public/scripts/game-engine/campaign/world-memory.js';

const casa = { id: 'casa', name: 'La casa del Vado', seat: 'Vado', holds: ['Molino'], reputation: 3, enemies: [] };
const cuervos = { id: 'cuervos', name: 'Los Cuervos', seat: 'Torre', holds: ['Paso Alto'], reputation: -3, enemies: [] };
const nadie = { id: 'nadie', name: 'Los de Nadie', seat: 'Cueva', holds: [], reputation: 0, enemies: [] };

describe('los hechos', () => {
    test('se apuntan con su día', () => {
        expect(recordDeed([], 4, 'Limpiasteis la cripta.')).toEqual([{ day: 4, text: 'Limpiasteis la cripta.' }]);
    });

    test('los viejos se olvidan', () => {
        let deeds = [];
        for (let i = 1; i <= MAX_DEEDS + 3; i++) deeds = recordDeed(deeds, i, `Hecho ${i}`);
        expect(deeds).toHaveLength(MAX_DEEDS);
        expect(deeds[0].text).toBe('Hecho 4');
    });

    test('lo vacío no se apunta, y lo roto no se lee', () => {
        expect(recordDeed([], 1, '   ')).toEqual([]);
        expect(readDeeds([null, { text: '' }, { day: 'x', text: 'Algo' }])).toEqual([{ day: 1, text: 'Algo' }]);
    });
});

describe('el bloque del narrador', () => {
    test('sin nada que contar, vacío: no cuesta ni un token', () => {
        expect(worldMemoryBlock({ deeds: [], factions: [nadie], today: 3 })).toBe('');
    });

    test('lo último hecho, lo que piensan de vosotros y lo que debéis', () => {
        let deeds = [];
        for (let i = 1; i <= 5; i++) deeds = recordDeed(deeds, i, `Hecho ${i}`);
        const block = worldMemoryBlock({
            deeds,
            factions: [casa, cuervos, nadie],
            debt: { patronName: 'La casa del Vado', amount: 30, owed: 30, day: 1, dueDay: 15, contractId: 'f1' },
            today: 5,
        });
        const lines = block.split('\n');
        expect(lines[0]).toBe('[LO QUE EL MUNDO SABE DEL GRUPO]');
        expect(block).toMatch(/Hace 2 día\(s\): Hecho 3/);
        expect(block).toMatch(/Hoy: Hecho 5/);
        expect(block).not.toMatch(/Hecho 2/);
        expect(lines.filter(l => l.startsWith('- Hace') || l.startsWith('- Hoy'))).toHaveLength(DEEDS_TOLD);
        expect(block).toMatch(/La casa del Vado: os deben más de una|La casa del Vado: os miran bien/);
        expect(block).toMatch(/Los Cuervos: no os quieren cerca/);
        expect(block).not.toMatch(/Los de Nadie/);
        expect(block).toMatch(/favor a La casa del Vado/);
        expect(lines[lines.length - 1]).toMatch(/sin inventar hechos nuevos/);
    });
});

describe('roadTrouble', () => {
    test('quien os tiene ganas y manda por donde pasáis os para', () => {
        const trouble = roadTrouble({ factions: [casa, cuervos], places: ['Paso Alto', 'Vado'], purse: 100 });
        expect(trouble).toMatchObject({ faction: 'cuervos', toll: 30, days: 0 });
        expect(trouble?.note).toMatch(/Pagáis 30/);
    });

    test('sin oro, rodeo de un día', () => {
        const trouble = roadTrouble({ factions: [cuervos], places: ['Paso Alto'], purse: 10 });
        expect(trouble).toMatchObject({ toll: 0, days: 1 });
    });

    test('si no pasáis por lo suyo, nada', () => {
        expect(roadTrouble({ factions: [cuervos], places: ['Vado'], purse: 100 })).toBeNull();
    });

    test('quien solo os ha tomado ojeriza, tampoco', () => {
        const molestos = { ...cuervos, reputation: HOSTILE_AT + 1 };
        expect(roadTrouble({ factions: [molestos], places: ['Torre'], purse: 100 })).toBeNull();
    });
});
