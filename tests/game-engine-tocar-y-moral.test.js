import { describe, test, expect } from '@jest/globals';
import { terrainFromAsciiMap, isPassable, getCoverBonus, describeCell, ASCII_TERRAIN, getCell, normalizeTerrain, isLocked } from '../public/scripts/game-engine/board/terrain.js';
import { interactionAt, nextTo, barricadeHp, hitBarricade, pullLever, BARRICADE_HP } from '../public/scripts/game-engine/board/interactables.js';
import { truceOffered, truceLine, callsForHelp, helpWave, HELP_CHANCE } from '../public/scripts/game-engine/combat/morale-options.js';
import { DECISIONS } from '../public/scripts/game-engine/campaign/approval.js';
import { generateIntended } from '../public/scripts/game-engine/world-builder/board-intent.js';
import { generateBoard } from '../public/scripts/game-engine/world-builder/dungeon-generator.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

describe('T1 y B3: la palanca y la barricada', () => {
    test('«=» es una barricada: corta el paso, no la vista, cubre y se dice su vida', () => {
        const terrain = terrainFromAsciiMap(['.=.']);
        expect(ASCII_TERRAIN['=']).toEqual({ type: 'barricade' });
        expect(isPassable(terrain, 1, 0, 3, 1)).toBe(false);
        expect(getCoverBonus(terrain, 1, 0)).toBe(5);
        expect(describeCell(terrain, 1, 0)).toBe(`Casilla (2, 1) · Barricada: corta el paso, cubre, y a golpes se rompe (${BARRICADE_HP} de vida)`);
        expect(getMapLegend()['=']).toMatch(/barricada/);
    });

    test('a golpes se rompe y deja escombros; la vida se guarda entre golpe y golpe', () => {
        let terrain = terrainFromAsciiMap(['.=.']);
        expect(interactionAt(terrain, 1, 0)).toBe('barricade');
        const first = hitBarricade(terrain, 1, 0, 6);
        expect(first).toMatchObject({ hp: BARRICADE_HP - 6, broken: false });
        terrain = normalizeTerrain(JSON.parse(JSON.stringify(first.terrain)));
        expect(barricadeHp(terrain, 1, 0)).toBe(BARRICADE_HP - 6);
        const second = hitBarricade(terrain, 1, 0, 20);
        expect(second.broken).toBe(true);
        expect(getCell(second.terrain, 1, 0).type).toBe('difficult');
        expect(second.line).toBe('La barricada cede: quedan los escombros.');
    });

    test('«P» es una palanca: no se pisa, y tirar de ella abre las puertas con llave', () => {
        const terrain = terrainFromAsciiMap(['P.L.L']);
        expect(ASCII_TERRAIN.P).toEqual({ type: 'lever' });
        expect(isPassable(terrain, 0, 0, 5, 1)).toBe(false);
        expect(interactionAt(terrain, 0, 0)).toBe('lever');
        expect(describeCell(terrain, 0, 0)).toBe('Casilla (1, 1) · Palanca: estando al lado, se tira de ella y se abren las puertas con llave');
        const pulled = pullLever(terrain);
        expect(pulled.opened).toEqual([{ x: 2, y: 0 }, { x: 4, y: 0 }]);
        expect(isLocked(pulled.terrain, 2, 0)).toBe(false);
        expect(isPassable(pulled.terrain, 4, 0, 5, 1)).toBe(true);
        expect(pulled.line).toBe('Chirrían 2 rejas: las puertas cerradas con llave se abren.');
        expect(pullLever(pulled.terrain).line).toBe('La palanca cruje, pero no abre nada que siga cerrado.');
        expect(nextTo({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
        expect(nextTo({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
    });

    test('un robo trae a veces una palanca que abre la cámara, y aguantar, barricadas', () => {
        const options = [{ name: 'Bandido', threat: 9 }];
        const make = (/** @type {string} */ purpose, /** @type {number} */ i) => generateIntended({
            randomFor: attempt => createSeededRandom(`${purpose}-palanca-${i}-${attempt}`),
            generate: generateBoard, purpose, options, budget: 20, board: { size: 'medium', partySize: 2 },
        });
        let levers = 0;
        let barricades = 0;
        for (let i = 0; i < 30; i++) {
            const steal = make('steal', i);
            expect(steal.issues).toEqual([]);
            if (steal.map.some((/** @type {string} */ row) => row.includes('P'))) levers++;
            const hold = make('hold', i);
            expect(hold.issues).toEqual([]);
            if (hold.map.some((/** @type {string} */ row) => row.includes('='))) barricades++;
        }
        expect(levers).toBeGreaterThan(15);
        expect(barricades).toBeGreaterThan(20);
    });
});

describe('T2: la tregua y los refuerzos', () => {
    const band = (/** @type {Array<[number, number, string?]>} */ rows) => rows.map(([hp, maxHp, role], i) => ({ name: `B${i + 1}`, hp, maxHp, role: role ?? '' }));

    test('con el líder caído y la mitad fuera, los que quedan (dos o más) piden tregua, una vez', () => {
        const enemies = band([[0, 20, 'lider'], [0, 10], [8, 10], [9, 10]]);
        expect(truceOffered({ enemies })).toBe(true);
        expect(truceOffered({ enemies, offered: true })).toBe(false);
        expect(truceLine(['B3', 'B4'])).toBe('🏳️ [COMBAT] B3, B4 bajan las armas y piden tregua: se van si les dejáis.');
    });

    test('sin líder caído, solo si todos los que quedan están malheridos; nunca con un jefe o con uno solo', () => {
        expect(truceOffered({ enemies: band([[0, 10], [0, 10], [8, 10], [9, 10]]) })).toBe(false);
        expect(truceOffered({ enemies: band([[0, 10], [0, 10], [4, 10], [3, 10]]) })).toBe(true);
        expect(truceOffered({ enemies: band([[0, 20, 'lider'], [0, 10], [0, 10], [9, 10]]) })).toBe(false);
        const withBoss = band([[0, 20, 'lider'], [0, 10], [8, 10], [9, 10]]);
        /** @type {any} */ (withBoss[3]).boss = true;
        expect(truceOffered({ enemies: withBoss })).toBe(false);
        expect(truceOffered({ enemies: band([[0, 20, 'lider'], [8, 10], [9, 10]]) })).toBe(false);
    });

    test('quien huye vuelve con ayuda más a menudo si hay salida, y solo una vez por pelea', () => {
        expect(callsForHelp({ random: () => HELP_CHANCE.none - 0.01 })).toBe(true);
        expect(callsForHelp({ random: () => HELP_CHANCE.none + 0.01 })).toBe(false);
        expect(callsForHelp({ random: () => HELP_CHANCE.none + 0.01, hasExit: true })).toBe(true);
        expect(callsForHelp({ random: () => 0, called: true })).toBe(false);
        expect(helpWave({ name: 'Bandido', round: 3, at: { x: 4.6, y: 2 } })).toEqual({
            round: 5, names: ['Bandido', 'Bandido'], x: 4, y: 2, tell: 'Se oyen voces que se acercan: vuelven con ayuda.', help: true,
        });
    });

    test('los tuyos juzgan aceptar la tregua y no darla', () => {
        expect(DECISIONS.tregua.moods).toMatchObject({ quiet: 1, blood: -1 });
        expect(DECISIONS['sin-cuartel'].moods).toMatchObject({ blood: 1, quiet: -1 });
    });
});
