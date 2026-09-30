import { describe, test, expect } from '@jest/globals';
import { HALL_CHIPS, HALL_SECTIONS, hallDetail, hallSections, hallHeader } from '../public/scripts/game-engine/campaign/guild-hall.js';

/** Las fichas del gremio acabada la prueba, como las da `hubChips` (party/hub.js). */
const afterTrial = [
    { id: 'hub-board', label: 'Tablón de campañas', icon: 'fa-scroll' },
    { id: 'hub-hire', label: 'Contratar mercenarios', icon: 'fa-coins' },
    ...HALL_CHIPS,
    { id: 'hub-memory', label: 'Memoria del gremio', icon: 'fa-book-skull' },
    { id: 'hub-sleep', label: 'Dormir en el gremio', icon: 'fa-bed' },
];

describe('J3.1: la sala del gremio por partes', () => {
    test('el tablón, tu gente, la casa, la memoria y, la última, la salida', () => {
        const sections = hallSections({ chips: afterTrial, town: 'Puerto Alba' });
        expect(sections.map(s => s.id)).toEqual(['tablon', 'gente', 'casa', 'memoria', 'salida']);
        expect(sections.at(-1)?.acts.at(-1)).toMatchObject({ id: 'hub-exit', label: 'Salir a la plaza de Puerto Alba', exit: true });
    });

    test('J3.3: la cama va en «La casa», con el cofre, el patio y los edificios, y dice que guarda', () => {
        const casa = hallSections({ chips: afterTrial }).find(s => s.id === 'casa');
        expect(casa?.acts.map(a => a.id)).toEqual(['hub-chest', 'hub-train', 'hub-house', 'hub-sleep']);
        expect(hallDetail('hub-sleep', {})).toMatch(/se guarda la partida/);
        expect(HALL_SECTIONS.flatMap(s => s.chips)).toContain('hub-sleep');
    });

    test('D-J28: en la prueba solo está saltarla; ni el tablón, ni los mercenarios, ni la cama', () => {
        const sections = hallSections({ chips: [{ id: 'hub-skip', label: 'Saltar la prueba', icon: 'fa-forward' }] });
        expect(sections.map(s => s.id)).toEqual(['tablon', 'salida']);
        expect(sections.flatMap(s => s.acts.map(a => a.id))).toEqual(['hub-skip', 'hub-exit']);
    });

    test('J3.7: el tablón dice las por empezar y las cerradas por el rango', () => {
        const hall = { campaigns: { open: 2, locked: 1, inProgress: [{ id: 'strahd', name: 'La Maldición de Strahd' }] } };
        expect(hallDetail('hub-board', hall)).toBe('En curso: La Maldición de Strahd · 2 por empezar · 1 cerrada hasta subir de rango');
        const exit = hallSections({ chips: afterTrial, hall }).find(s => s.id === 'salida');
        expect(exit?.acts[0]).toMatchObject({ id: 'hub-continue:strahd', campaign: 'strahd' });
    });

    test('la cabecera: el rango y, si ha subido, la noticia', () => {
        const header = hallHeader({ rank: { id: 'C', label: 'Compañía conocida', line: 'Rango C · Compañía conocida' }, news: { line: 'El gremio sube a rango C.' } });
        expect(header).toEqual({ rank: 'C', line: 'Rango C · Compañía conocida', news: 'El gremio sube a rango C.' });
        expect(hallHeader({})).toEqual({ rank: '', line: '', news: '' });
    });
});
