import { describe, test, expect } from '@jest/globals';
import {
    STRATEGIST_BACKGROUNDS, SUGGESTED_NAMES, SUGGESTED_COMPANIES,
    describeStrategist, validateStrategist, linkBodyguard,
} from '../public/scripts/game-engine/campaign/strategist.js';

describe('Estratega y Fundación de la Compañía (Fase 2)', () => {
    describe('Trasfondos de gestión del Estratega', () => {
        test('define los cuatro trasfondos de mando principales con sus ventajas', () => {
            const keys = Object.keys(STRATEGIST_BACKGROUNDS);
            expect(keys).toEqual(['veterano', 'mercader', 'escriba', 'campesino']);

            for (const key of keys) {
                const bg = STRATEGIST_BACKGROUNDS[key];
                expect(bg.id).toBe(key);
                expect(typeof bg.label).toBe('string');
                expect(typeof bg.perk).toBe('string');
                expect(typeof bg.icon).toBe('string');
                expect(typeof bg.tagline).toBe('string');
            }
        });

        test('el trasfondo veterano otorga iniciativa y temple', () => {
            expect(STRATEGIST_BACKGROUNDS.veterano.perk).toContain('+1 a la iniciativa');
        });

        test('el trasfondo mercader otorga ventajas de oro', () => {
            expect(STRATEGIST_BACKGROUNDS.mercader.perk).toContain('oro');
        });

        test('el trasfondo escriba otorga descuento de mantenimiento', () => {
            expect(STRATEGIST_BACKGROUNDS.escriba.perk).toContain('mantenimiento');
        });

        test('el trasfondo campesino otorga raciones iniciales', () => {
            expect(STRATEGIST_BACKGROUNDS.campesino.perk).toContain('raciones');
        });
    });

    describe('Validación y descripción del Estratega', () => {
        test('valida que el estratega y la compañía tengan nombre', () => {
            expect(validateStrategist({ name: '', companyName: '' })).toHaveLength(2);
            expect(validateStrategist({ name: 'Elías', companyName: '' })).toHaveLength(1);
            expect(validateStrategist({ name: 'Elías', companyName: 'Cuadrilla del Roble' })).toHaveLength(0);
        });

        test('describe al estratega con su trasfondo y compañía', () => {
            const line = describeStrategist({
                name: 'Elías',
                companyName: 'La Cuadrilla del Roble',
                background: 'veterano',
            });
            expect(line).toBe('Elías (Veterano de guerra), al mando de "La Cuadrilla del Roble"');
        });

        test('ofrece nombres y compañías sugeridas por defecto', () => {
            expect(SUGGESTED_NAMES.length).toBeGreaterThanOrEqual(8);
            expect(SUGGESTED_COMPANIES.length).toBeGreaterThanOrEqual(6);
        });
    });

    describe('Vinculación con el Guardaespaldas', () => {
        test('linkBodyguard marca la ficha como guardaespaldas y vincula al comandante', () => {
            const heroData = {
                name: 'Goran',
                charClass: 'Guerrero',
                race: 'Humano',
                level: 1,
            };

            const linked = linkBodyguard(heroData, { name: 'Elías', companyName: 'La Cuadrilla del Roble' });
            expect(linked.isBodyguard).toBe(true);
            expect(linked.commander).toBe('Elías');
        });
    });
});
