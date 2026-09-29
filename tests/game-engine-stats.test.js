import { describe, test, expect } from '@jest/globals';
import { bump, counted, describeStats } from '../public/scripts/game-engine/campaign/stats.js';

describe('la partida en números (idea 200): singular, plural y cuentas que cuadran', () => {
    test('un número con su palabra, en singular si es uno', () => {
        expect(counted(1, 'día', 'días')).toBe('1 día');
        expect(counted(0, 'día', 'días')).toBe('0 días');
        expect(counted(12, 'día', 'días')).toBe('12 días');
    });

    test('un día, un sitio, un combate ganado: todo en singular', () => {
        let stats = bump(null, 'fights');
        stats = bump(stats, 'wins');
        stats = bump(stats, 'trips');
        stats = bump(stats, 'rumors');
        stats = bump(stats, 'contracts');
        const lines = describeStats(stats, { days: 1, places: 1 });
        expect(lines[0]).toBe('1 día de campaña · 1 sitio en el mapa');
        expect(lines[1]).toBe('1 combate: 1 ganado');
        expect(lines[2]).toBe('1 encargo cumplido · 0 de oro ganado');
        expect(lines[3]).toBe('1 viaje · 1 rumor oído');
    });

    test('en plural, con las huidas', () => {
        let stats = bump(null, 'fights', 4);
        stats = bump(stats, 'wins', 2);
        stats = bump(stats, 'fled', 2);
        stats = bump(stats, 'deaths', 2);
        const lines = describeStats(stats, { days: 12, places: 9 });
        expect(lines[0]).toBe('12 días de campaña · 9 sitios en el mapa');
        expect(lines[1]).toBe('4 combates: 2 ganados, 2 huidas');
        expect(lines.at(-1)).toBe('2 muertes en el grupo');
    });

    test('nunca más ganados que combates: una cuenta vieja sin combates se corrige', () => {
        // La bodega se ganó, pero la pelea empezó desde el tablero y no se contaba.
        const lines = describeStats(bump(null, 'wins'), { days: 1, places: 3 });
        expect(lines[1]).toBe('1 combate: 1 ganado');
        const fled = describeStats(bump(bump(null, 'wins'), 'fled'), { days: 2, places: 3 });
        expect(fled[1]).toBe('2 combates: 1 ganado, 1 huida');
    });

    test('sin ninguna pelea, se dice así', () => {
        expect(describeStats(null, { days: 0, places: 0 })).toEqual([
            '1 día de campaña · 0 sitios en el mapa',
            'Ningún combate',
            '0 encargos cumplidos · 0 de oro ganado',
            '0 viajes · 0 rumores oídos',
            'Nadie del grupo ha muerto',
        ]);
    });
});
