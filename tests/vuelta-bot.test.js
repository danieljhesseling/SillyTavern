/**
 * J16 de ROADMAP_SIN_CONEXION: lo que el jugador automático de las vueltas lee del paquete
 * (`tools/vuelta-bot.mjs`). La vuelta pulsa como quien juega, pero lo que pide cada hito lo
 * saca de aquí: si esto se equivoca, la vuelta se atasca donde el juego no se atasca.
 *
 * - `targetsFromPack`: dónde, qué tablero y con quién, por cada hito.
 * - `boardGoalsFromPack`: lo que pide cada tablero para ganarlo (la casilla de la ventana).
 * - `fixedNumbers` y `proseNotes`: los números fijos de la sección 6 (J16.4).
 * - Que el hilo de 1387, Strahd y el prólogo se pueda seguir: cada tablero, persona y sitio que
 *   pide un hito existe en su paquete (si no, la vuelta no tiene adónde ir).
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { targetsFromPack, boardGoalsFromPack, fixedNumbers, proseNotes, plain, restNeed, exitPick } from '../tools/vuelta-bot.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const readJson = (/** @type {string} */ path) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8'));

describe('J16: lo que pide cada hito, para el jugador automático', () => {
    const pack = {
        boards: [
            { id: 'enc-posada', name: 'El cuarto', locationName: 'El Pueblo', enemies: [{ name: 'Torres' }] },
            { id: 'enc-mina', name: 'La mina', locationName: 'La Mina', enemies: [{ name: 'Sombra' }, { name: 'Perro' }] },
        ],
        npcs: [{ name: 'Giles', where: 'El Pueblo' }],
        quests: [
            { id: 'q-enc-posada', objectives: [{ type: 'eliminate_all' }, { type: 'reach_cell', cell: { x: 7, y: 9 } }] },
            { id: 'q-enc-mina', objectives: [{ type: 'eliminate_all' }] },
        ],
        plot: {
            milestones: [
                { id: 'a', asks: { kind: 'win', board: 'El cuarto' } },
                { id: 'b', asks: { kind: 'talk', npc: 'Giles' } },
                { id: 'c', asks: { kind: 'defeat', enemy: 'Sombra' } },
                { id: 'd', asks: { kind: 'arrive', place: 'La Mina' } },
                { id: 'e', asks: { kind: 'check', skill: 'persuasion' } },
                { id: 'f', asks: { kind: 'clues', clues: [{ place: 'El Lago', skill: 'investigation' }] } },
                { id: 'g', asks: { kind: 'none' } },
            ],
        },
    };

    test('ganar un tablero: el tablero y su sitio; derrotar a alguien: el tablero donde espera', () => {
        const target = targetsFromPack(pack);
        expect(target('a')).toEqual({ id: 'a', kind: 'win', board: 'El cuarto', place: 'El Pueblo' });
        expect(target('c')).toEqual({ id: 'c', kind: 'defeat', enemy: 'Sombra', board: 'La mina', place: 'La Mina' });
    });

    test('hablar: con quién y dónde está; llegar, tirar y las pistas', () => {
        const target = targetsFromPack(pack);
        expect(target('b')).toEqual({ id: 'b', kind: 'talk', npc: 'Giles', place: 'El Pueblo' });
        expect(target('d')).toEqual({ id: 'd', kind: 'arrive', place: 'La Mina' });
        expect(target('e')).toEqual({ id: 'e', kind: 'check', skill: 'persuasion' });
        expect(target('f')).toEqual({ id: 'f', kind: 'clues', place: 'El Lago', skill: 'investigation' });
        expect(target('g')).toEqual({ id: 'g', kind: 'none' });
        expect(target('no-existe')).toEqual({ id: 'no-existe', kind: 'none' });
    });

    test('lo que pide cada tablero: llegar a una casilla va antes que lo demás', () => {
        const goals = boardGoalsFromPack(pack);
        expect(goals.get('El cuarto')).toEqual({ type: 'reach_cell', cell: { x: 7, y: 9 } });
        expect(goals.get('La mina')).toEqual({ type: 'eliminate_all' });
    });

    test('se para a descansar con «Agotamiento 2 de 6» o con menos de media vida, no antes', () => {
        const hero = { hp: 30, maxHp: 34 };
        expect(restNeed({ tired: 0, hero })).toBe('');
        expect(restNeed({ tired: 1, hero })).toBe('');
        expect(restNeed({ tired: 2, hero })).toBe('agotamiento 2 de 6');
        expect(restNeed({ tired: 0, hero: { hp: 16, maxHp: 34 } })).toBe('16 de 34 de vida');
        expect(restNeed({ tired: 3, hero: { hp: 1, maxHp: 19 } })).toBe('agotamiento 3 de 6, 1 de 19 de vida');
        // Sin héroe, o con el héroe muerto, no hay nada que descansar.
        expect(restNeed({ tired: 5, hero: null })).toBe('');
        expect(restNeed({ tired: 5, hero: { hp: 0, maxHp: 34, dead: true } })).toBe('');
    });

    test('los nombres se comparan como los lee una persona: sin tildes ni mayúsculas', () => {
        expect(plain('  Castillo de VANE ')).toBe('castillo de vane');
        expect(plain('La Ermita Derruída')).toBe(plain('la ermita derruida'));
    });

    test('en «otra salida», la vuelta pelea: «Pelear» antes, «Seguir peleando» en mitad', () => {
        const before = [
            { id: 'hablar', text: '1 Hablar Convencerles de que os dejen pasar' },
            { id: 'pelear', text: '2 Pelear Empezar la pelea' },
            { id: 'pagar', text: 'Pagar Cuesta 20 de oro', locked: true },
        ];
        expect(exitPick('avoid', before)?.id).toBe('pelear');
        // Si cambian los ids, por lo que dice.
        expect(exitPick('avoid', [{ id: 'x1', text: 'Hablar' }, { id: 'x2', text: 'Pelear  Empezar la pelea' }])?.id).toBe('x2');
        const during = [{ id: 'rendirse', text: 'Entregarse' }, { id: 'seguir', text: 'Seguir peleando Dejarlo estar' }];
        expect(exitPick('parley', during)?.id).toBe('seguir');
        // Fuera de esa ventana, o sin la opción, no elige: decide `pickOption` como siempre.
        expect(exitPick('', before)).toBeNull();
        expect(exitPick('avoid', [{ id: 'pelear', text: 'Pelear', locked: true }])).toBeNull();
    });

    test('las campañas de un Gem (vuelta-campana): «any», confidentes y «Lobo 2»', () => {
        const gem = {
            boards: [{ name: 'El camino', locationName: 'El monte', enemies: [{ name: 'Lobo 1' }, { name: 'Lobo 2' }] }],
            npcs: [{ name: 'Tobías', where: 'Brezo' }],
            confidants: [{ name: 'Marta', where: 'El puerto' }],
            plot: {
                milestones: [
                    // De varias formas: la primera que se hace a clics (un encargo del tablón, no).
                    { id: 'a', asks: { kind: 'any', options: [{ kind: 'contract', id: 'e-1' }, { kind: 'talk', npc: 'Marta' }] } },
                    { id: 'b', asks: { kind: 'defeat', enemy: 'Lobo' } },
                    { id: 'c', asks: { kind: 'any', options: [] } },
                    { id: 'd', asks: { kind: 'win', board: 'Sin dibujar', place: 'La ermita' } },
                    { id: 'e', asks: { kind: 'contract', id: 'e-1' } },
                ],
            },
        };
        const target = targetsFromPack(gem);
        expect(target('a')).toEqual({ id: 'a', kind: 'talk', npc: 'Marta', place: 'El puerto' });
        expect(target('b')).toEqual({ id: 'b', kind: 'defeat', enemy: 'Lobo', board: 'El camino', place: 'El monte' });
        expect(target('c')).toEqual({ id: 'c', kind: 'none' });
        // El tablero que no está en el paquete: el sitio que dice el hito.
        expect(target('d')).toEqual({ id: 'd', kind: 'win', board: 'Sin dibujar', place: 'La ermita' });
        // Un encargo del tablón no se sigue a clics: la vuelta lo dirá como atasco.
        expect(target('e')).toEqual({ id: 'e', kind: 'contract' });
    });
});

/**
 * Lo que pide un hito y no está en el paquete: un tablero que no existe, un sitio que no está,
 * o ganar, derrotar o hablar sin saber dónde.
 *
 * @param {any} pack
 * @returns {string[]}
 */
function lostTargets(pack) {
    const target = targetsFromPack(pack);
    const boards = new Set((pack.boards ?? []).map((/** @type {any} */ b) => plain(b.name)));
    const places = new Set((pack.locations ?? []).map((/** @type {any} */ l) => plain(l.name)));
    const needsPlace = new Set(['win', 'defeat', 'talk']);
    return (pack.plot?.milestones ?? []).flatMap((/** @type {any} */ m) => {
        const t = target(String(m.id));
        return [
            t.board && !boards.has(plain(t.board)) ? `${m.id}: el tablero «${t.board}»` : '',
            needsPlace.has(t.kind) && !t.place ? `${m.id}: sin sitio (${t.kind})` : '',
            t.place && places.size > 0 && !places.has(plain(t.place)) ? `${m.id}: el sitio «${t.place}»` : '',
        ].filter(Boolean);
    });
}

/**
 * Los finales a los que lleva algún hito (`changes.ending` o `changes.endingBy`).
 *
 * @param {any} pack
 * @returns {Set<string>}
 */
function endingsReached(pack) {
    return new Set((pack.plot?.milestones ?? []).flatMap((/** @type {any} */ m) => [m.changes?.ending, ...Object.values(m.changes?.endingBy ?? {})])
        .filter(Boolean));
}

describe('J16: el hilo de cada campaña se puede seguir con lo que hay en su paquete', () => {
    for (const file of ['1387', 'strahd', 'gremio']) {
        test(`${file}: cada tablero, persona y sitio que pide un hito existe`, () => {
            expect(lostTargets(readJson(`public/mundos/${file}.pack.json`))).toEqual([]);
        });
    }

    test('1387 tiene sus tres finales y cada uno se alcanza desde un hito', () => {
        const pack = readJson('public/mundos/1387.pack.json');
        const endings = Object.keys(pack.plot.endings);
        const reached = endingsReached(pack);
        expect(endings).toHaveLength(3);
        expect(endings.filter(e => !reached.has(e))).toEqual([]);
    });
});

describe('J16.4: los números fijos de la sección 6', () => {
    test('se cuentan del repositorio: frases, sucesos, charlas e hitos', () => {
        const numbers = fixedNumbers(readJson);
        expect(numbers.frases).toBeGreaterThan(100);
        expect(numbers.sucesos).toBeGreaterThan(10);
        expect(numbers.charlas1387).toBeGreaterThan(0);
        // Los hitos del reloj de las facciones no son del hilo.
        expect(numbers.hitos1387).toBe(readJson('public/mundos/1387.pack.json').plot.milestones.filter((/** @type {any} */ m) => m.opens?.kind !== 'clock').length);
    });

    test('las notas del juego con su prosa: unas de todas, y la definición no cuenta', () => {
        const notes = proseNotes(ROOT);
        expect(notes.total).toBeGreaterThan(20);
        expect(notes.prose).toBeGreaterThan(0);
        expect(notes.prose).toBeLessThanOrEqual(notes.total);
    });
});
