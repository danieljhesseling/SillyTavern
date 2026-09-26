import { describe, test, expect } from '@jest/globals';
import { buildHowToPlay, howToPlayText } from '../public/scripts/game-engine/campaign/how-to-play.js';
import { MODES, survivalFor } from '../public/scripts/game-engine/rules/modes.js';
import { CATEGORIES } from '../public/scripts/game-engine/campaign/chronicle.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

describe('H2: «Cómo se juega», armado con lo que el motor sabe', () => {
    const relaxed = survivalFor(MODES.relajado.letters);
    const hard = survivalFor(MODES.supervivencia.letters);

    test('dice el modo de esta partida y qué letras están encendidas', () => {
        const [, mode] = buildHowToPlay({ survival: relaxed });
        expect(mode.title).toBe(`Tu modo: ${MODES.relajado.label}`);
        expect(mode.lines.filter(l => l.startsWith('✓'))).toHaveLength(3);
        expect(mode.lines.some(l => l.startsWith('· De hierro'))).toBe(true);
        const [, hardMode] = buildHowToPlay({ survival: hard });
        expect(hardMode.lines.filter(l => l.startsWith('✓'))).toHaveLength(6);
    });

    test('lo que está apagado no se explica como si estuviera', () => {
        const noBill = { ...relaxed, upkeep: false, world: false };
        const week = buildHowToPlay({ survival: noBill }).find(s => s.id === 'semana');
        expect(week?.lines).toContain('En este modo no hay cuenta semanal.');
        expect(week?.lines).toContain('En este modo el mundo espera a que vuelvas.');
    });

    test('la leyenda del tablero sale del esquema, con las casillas nuevas', () => {
        const board = buildHowToPlay({ survival: relaxed, legend: getMapLegend() }).find(s => s.id === 'tablero');
        expect(board?.lines.some(l => l.startsWith('`^`'))).toBe(true);
        expect(board?.lines.some(l => l.startsWith('`x`'))).toBe(true);
        expect(board?.lines.some(l => l.startsWith('`.`'))).toBe(false);
    });

    test('la magia y la mascota solo salen si las hay', () => {
        expect(buildHowToPlay({ survival: relaxed }).some(s => s.id === 'lo-tuyo')).toBe(false);
        const mine = buildHowToPlay({ survival: relaxed, magic: true, pet: true }).find(s => s.id === 'lo-tuyo');
        expect(mine?.lines).toHaveLength(2);
    });

    test('la crónica cuenta sus categorías de verdad, y todo cabe en texto', () => {
        const chronicle = buildHowToPlay({ survival: relaxed }).find(s => s.id === 'cronica');
        expect(chronicle?.lines[0]).toContain(`en ${Object.keys(CATEGORIES).length} categorías`);
        const text = howToPlayText(buildHowToPlay({ survival: hard, legend: getMapLegend() }));
        expect(text).toMatch(/^## Quién manda aquí/);
        expect(text).toContain('`/ayuda`: esta página.');
    });
});
