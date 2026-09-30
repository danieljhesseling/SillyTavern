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

test('lo que tienen entre manos va lo primero, para que el narrador empuje hacia ahí', () => {
    const block = worldMemoryBlock({ focus: 'El primer ahogado — Alguien sabe quién era.', today: 1 });
    expect(block.split('\n')[1]).toBe('- Lo que tienen entre manos: El primer ahogado — Alguien sabe quién era.');
});

test('un nombre en plural corta el paso sin «Los de»', () => {
    const cuervos = { id: 'c', name: 'Los Cuervos', seat: 'Torre', holds: [], reputation: -3, enemies: [] };
    expect(roadTrouble({ factions: [cuervos], places: ['Torre'], purse: 100 })?.name).toBe('Los Cuervos os cortan el paso');
});

test('cada nombre de facción se lee bien al cortar el paso, con artículo o sin él', () => {
    const say = (/** @type {string} */ name) => roadTrouble({
        factions: [{ id: 'x', name, seat: 'Torre', holds: [], reputation: -3, enemies: [] }], places: ['Torre'], purse: 100,
    })?.name;
    // Los de 1387 y los de Strahd, tal como vienen en sus paquetes.
    expect(say('Leales de Montesclaros')).toBe('Los Leales de Montesclaros os cortan el paso');
    expect(say('Los Lobos del Bosque')).toBe('Los Lobos del Bosque os cortan el paso');
    expect(say('La Casa Keller')).toBe('Los de la Casa Keller os cortan el paso');
    expect(say('La Orden del Dragón de Plata')).toBe('Los de la Orden del Dragón de Plata os cortan el paso');
    expect(say('La corte de Strahd')).toBe('Los de la corte de Strahd os cortan el paso');
    expect(say('Los Hijos de la Madre Noche')).toBe('Los Hijos de la Madre Noche os cortan el paso');
    // Y los que podría escribir un Gem.
    expect(say('El Gremio de Mercaderes')).toBe('Los del Gremio de Mercaderes os cortan el paso');
    expect(say('Hermanas de la Luz')).toBe('Las Hermanas de la Luz os cortan el paso');
    expect(say('Casa Vallakovich')).toBe('Los de la Casa Vallakovich os cortan el paso');
    expect(say('Consejo de Vallaki')).toBe('Los del Consejo de Vallaki os cortan el paso');
    expect(say('Vane')).toBe('Los de Vane os cortan el paso');
    expect(say('las Espadas Negras')).toBe('Las Espadas Negras os cortan el paso');
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
