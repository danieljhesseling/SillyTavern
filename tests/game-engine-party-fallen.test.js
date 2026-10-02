import { describe, test, expect } from '@jest/globals';
import { partyHasFallen, checkpointToReturn, fallenCard } from '../public/scripts/game-engine/combat/party-fallen.js';

const tessa = { name: 'Tessa', dead: true, hp: 1 };
const gerd = { name: 'Gerd', dead: true, hp: 0 };

describe('partyHasFallen (J9.1)', () => {
    test('only when everyone is dead, and never with no party', () => {
        expect(partyHasFallen([tessa])).toBe(true);
        expect(partyHasFallen([tessa, gerd])).toBe(true);
        expect(partyHasFallen([tessa, { name: 'Nella', hp: 0 }])).toBe(false);
        expect(partyHasFallen([])).toBe(false);
        expect(partyHasFallen(null)).toBe(false);
    });
});

describe('checkpointToReturn', () => {
    test('the newest checkpoint where someone was still alive', () => {
        const late = { id: 'b', label: 'Tarde', state: { party: [{ name: 'Tessa', dead: true }] } };
        const early = { id: 'a', label: 'Antes de Keller', state: { party: [{ name: 'Tessa' }] } };
        expect(checkpointToReturn([late, early])?.id).toBe('a');
        expect(checkpointToReturn([late])).toBeNull();
        expect(checkpointToReturn(undefined)).toBeNull();
    });
});

describe('fallenCard', () => {
    test('one hero, from a guild, with a checkpoint: both ways out', () => {
        const card = fallenCard({
            party: [tessa], place: 'El Peaje Norte', home: true,
            checkpoints: [{ id: 'a', label: 'Antes de Keller', state: { party: [{ name: 'Tessa' }] } }],
        });
        expect(card.title).toBe('Tessa ha muerto');
        expect(card.text).toBe('Tessa ha muerto en El Peaje Norte. Sin nadie en pie, la campaña no puede seguir.');
        expect(card.checkpoint?.id).toBe('a');
        expect(card.home).toBe(true);
        expect(card.ways).toContain('«Antes de Keller»');
        expect(card.ways).toContain('volver al gremio');
    });

    test('a whole group, no checkpoint and no guild: it says where to go', () => {
        const card = fallenCard({ party: [tessa, gerd] });
        expect(card.title).toBe('Ha caído todo el grupo');
        expect(card.text).toBe('Tessa y Gerd han muerto. Sin nadie en pie, la campaña no puede seguir.');
        expect(card.checkpoint).toBeNull();
        expect(card.home).toBe(false);
        expect(card.ways).toBe('Desde la pausa puedes cargar otra partida.');
    });

    test('H7: with saved games, it offers the one of this morning', () => {
        const card = fallenCard({ party: [tessa], home: true, saves: true });
        expect(card.saves).toBe(true);
        expect(card.ways).toContain('Puedes cargar una partida guardada: cada mañana se guarda sola.');
        expect(card.ways).not.toContain('Desde la pausa');
    });
});
