/**
 * Las campañas de tu Gem (J5.2, J5.3, J5.6 y J12.5 de wiki/ROADMAP_SIN_CONEXION.md): lo que el
 * motor rellena (`pack-fill.js`), los mapas leídos de su dibujo (`pack-maps.js`), los cofres con
 * su tesoro (`chests.js`) y el informe de antes de jugarla (`campaign-check.js`).
 */

import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    fillPackGaps, buildShortExamplePack, buildRoomsExampleBoard, describeFill,
} from '../public/scripts/game-engine/campaign/pack-fill.js';
import { readPackMaps, packImageUrl } from '../public/scripts/game-engine/campaign/pack-maps.js';
import { chestItemsAt, readChests } from '../public/scripts/game-engine/campaign/chests.js';
import { checkCampaign, plainLine } from '../public/scripts/game-engine/campaign/campaign-check.js';
import { readCampaignText, readCampaignFile } from '../public/scripts/game-engine/campaign/campaign-import.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { getSectionSchema, SECTION_ORDER } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { zoneCells } from '../public/scripts/game-engine/board/zones.js';

const battery = (/** @type {string} */ name) => JSON.parse(fs.readFileSync(new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8')).rows;

/** El compendio del juego: el bestiario y las frases de relleno del narrador. */
const compendium = () => createCompendium({ bestiario: battery('bestiario'), frases: battery('frases') });

/** Un paquete mínimo alrededor de unos tableros. */
const packWith = (/** @type {any} */ extra) => ({
    version: 1,
    world: { name: 'La cripta de prueba', synopsis: 'Una cripta bajo una ermita.' },
    locations: [{ name: 'La cripta', type: 'dungeon' }],
    ...extra,
});

describe('J5.3: una campaña con solo historia y misiones se juega entera', () => {
    const { pack, filled } = fillPackGaps(buildShortExamplePack(), { compendium: compendium() });

    test('cada misión tiene su tablero, dibujado con la semilla, con quien pide', () => {
        for (const quest of pack.quests) {
            const board = pack.boards.find((/** @type {any} */ b) => b.id === quest.boardId);
            expect(board?.seeded).toBe(true);
            expect(board.locationName).toBe(quest.locationName);
        }
        const crypt = pack.boards.find((/** @type {any} */ b) => b.locationName === 'La cripta de la ermita');
        expect(crypt.enemies.some((/** @type {any} */ e) => e.name === 'La Dama del Pozo')).toBe(true);
    });

    test('los bichos salen del bestiario del juego si se llaman igual, y los textos, del narrador', () => {
        const lobo = pack.bestiary.find((/** @type {any} */ b) => b.name === 'Lobo');
        expect(lobo.profile).toBe('skirmisher');
        expect(filled.some(f => f.kind === 'criatura' && f.name === 'Lobo' && /bestiario del juego/.test(f.detail))).toBe(true);
        expect(pack.locations.find((/** @type {any} */ l) => l.name === 'La ermita').description).not.toBe('');
        expect(pack.plot.endings.final.scene).not.toBe('');
    });

    test('la primera localización, sin tablero, es donde empieza: no se le dibuja uno', () => {
        expect(pack.boards.some((/** @type {any} */ b) => b.locationName === 'Aldea de Brezo')).toBe(false);
        const plan = buildImportPlan(pack, { party: ['Iria'] });
        const hero = plan.entries.find(e => e.title === 'Iria');
        expect(hero?.dndData?.mapPosition?.locationName).toBe('Aldea de Brezo');
        expect(plan.metadata.locationMaps[0].name).toBe('Aldea de Brezo');
    });

    test('el paquete relleno es válido, se puede jugar de principio a fin, y rellenarlo otra vez no pone nada', () => {
        expect(validatePack(pack).ok).toBe(true);
        expect(checkCampaign(pack, { filled }).verdict).toBe('lista');
        const again = fillPackGaps(pack, { compendium: compendium() });
        expect(again.filled).toEqual([]);
        expect(again.pack).toEqual(pack);
    });

    test('lo puesto se cuenta por clases, en pocas líneas', () => {
        const lines = describeFill(filled);
        expect(lines.some(l => /^3 tableros dibujados con la semilla: /.test(l))).toBe(true);
        expect(lines.some(l => /escena contada por quien la vive: Tobías el molinero/.test(l))).toBe(true);
    });
});

describe('J5.3: lo que tu JSON de Strahd no traía', () => {
    /** La corta, sin su hilo: solo las misiones, en tres actos. */
    const missionsOnly = () => {
        const raw = buildShortExamplePack();
        delete raw.plot;
        return raw;
    };

    test('sin hilo y con misiones en varios actos, el hilo sale de ellas: una detrás de otra, y la última lleva al final', () => {
        const raw = missionsOnly();
        // Las del mismo acto van en el orden en que vienen; los actos, de menor a mayor.
        raw.quests = [raw.quests[2], raw.quests[0], raw.quests[1]];
        const { pack, filled } = fillPackGaps(raw, { compendium: compendium() });
        const milestones = pack.plot.milestones;
        expect(milestones.map((/** @type {any} */ m) => m.quest)).toEqual(['lobos', 'velas', 'cripta']);
        expect(milestones[0].opens).toEqual({ kind: 'start' });
        expect(milestones[1].opens).toEqual({ kind: 'after', milestone: 'lobos' });
        expect(milestones[2].asks.kind).toBe('win');
        expect(milestones[2].changes.ending).toBe('final');
        // La cripta empieza escondida: la descubre la misión de antes.
        expect(milestones[1].changes.reveal).toEqual(['La cripta de la ermita']);
        expect(filled.find(f => f.kind === 'historia')?.name).toBe('3 misiones');
        expect(filled.some(f => f.kind === 'hilo')).toBe(false);
        expect(describeFill(filled)).toContain('La historia: no traía hilo, y sale de sus 3 misiones, una detrás de otra, acto a acto.');
        expect(validatePack(pack).ok).toBe(true);
        expect(checkCampaign(pack, { filled }).groups.find(g => g.key === 'huecos')?.items ?? []).toEqual([]);
        expect(fillPackGaps(pack, { compendium: compendium() }).filled).toEqual([]);
    });

    test('con todas las misiones en el mismo acto no hay orden que seguir: sin hilo, como venía', () => {
        const raw = missionsOnly();
        for (const quest of raw.quests) quest.act = 1;
        const { pack, filled } = fillPackGaps(raw, { compendium: compendium() });
        expect(pack.plot).toBeUndefined();
        expect(filled.some(f => f.kind === 'historia')).toBe(false);
    });

    test('una sala cerrada con alguien dentro recibe una puerta en la pared que la separa, la más cerca de quien espera', () => {
        const board = {
            id: 'casa', name: 'La casa', locationName: 'La cripta',
            map: [
                '##########',
                '#...#....#',
                '#...#....#',
                '#...#....#',
                '##########',
            ],
            partyStart: [{ x: 1, y: 2 }],
            enemies: [{ name: 'Esqueleto', x: 7, y: 1 }],
        };
        const bestiary = [{ name: 'Esqueleto', hp: 13, armorClass: 13, cr: 0.25 }];
        expect(validatePack(packWith({ bestiary, boards: [board] })).errors.map(e => e.message)).toEqual([expect.stringMatching(/no se puede llegar/)]);
        const { pack, filled } = fillPackGaps(packWith({ bestiary, boards: [board] }), { compendium: compendium() });
        expect(pack.boards[0].map[1]).toBe('#...D....#');
        expect(filled).toEqual(expect.arrayContaining([{ kind: 'puerta', name: 'La casa', detail: 'para llegar a Esqueleto, en la casilla (5, 2)' }]));
        expect(validatePack(pack).ok).toBe(true);
        expect(fillPackGaps(pack, { compendium: compendium() }).filled).toEqual([]);
    });

    test('una pared de dos casillas de grueso no se abre: lo dice el validador', () => {
        const board = {
            id: 'muro', name: 'El muro', locationName: 'La cripta',
            map: ['###########', '#...##....#', '#...##....#', '###########'],
            partyStart: [{ x: 1, y: 1 }],
            enemies: [{ name: 'Esqueleto', x: 8, y: 1 }],
        };
        const { pack, filled } = fillPackGaps(packWith({ boards: [board] }), { compendium: compendium() });
        expect(filled.some(f => f.kind === 'puerta')).toBe(false);
        expect(validatePack(pack).ok).toBe(false);
    });
});

describe('J5.2: lo que un módulo cuenta sala a sala y sitio a sitio', () => {
    test('el encuentro de cada sala se pone en sus casillas, y su tesoro en un cofre que no corta el paso', () => {
        const board = buildRoomsExampleBoard();
        const { pack, filled } = fillPackGaps(packWith({
            boards: [board],
            quests: [{ id: 'q', name: 'La capilla', boardId: board.id, objectives: [{ type: 'eliminate_all', label: 'Limpiar la capilla' }] }],
        }), { compendium: compendium() });
        const out = pack.boards[0];
        const chapel = new Set(zoneCells(board.zones[1]));
        expect(out.enemies.filter((/** @type {any} */ e) => e.name === 'Esqueleto')).toHaveLength(2);
        expect(out.enemies.every((/** @type {any} */ e) => chapel.has(`${e.x},${e.y}`))).toBe(true);
        expect(readChests(out.chests)).toHaveLength(1);
        const [chest] = out.chests;
        expect(chapel.has(`${chest.x},${chest.y}`)).toBe(true);
        expect(out.map[chest.y][chest.x]).toBe('k');
        expect(chestItemsAt(out, chest.x, chest.y)).toEqual(['Cáliz de plata']);
        expect(pack.items.some((/** @type {any} */ i) => i.name === 'Cáliz de plata')).toBe(true);
        expect(pack.bestiary.some((/** @type {any} */ b) => b.name === 'Esqueleto')).toBe(true);
        expect(filled.map(f => f.kind)).toEqual(expect.arrayContaining(['sala', 'cofre', 'objeto']));
        // A todo se sigue llegando: el validador lo mira casilla a casilla.
        expect(validatePack(pack).ok).toBe(true);
        expect(fillPackGaps(pack, { compendium: compendium() }).filled).toEqual([]);
    });

    test('un encuentro ya puesto en su sala no se repite', () => {
        const board = buildRoomsExampleBoard();
        board.enemies = [{ name: 'Esqueleto', x: 8, y: 2 }];
        const { pack } = fillPackGaps(packWith({ boards: [board] }), { compendium: compendium() });
        expect(pack.boards[0].enemies.filter((/** @type {any} */ e) => e.name === 'Esqueleto')).toHaveLength(2);
    });

    test('el tesoro de un sitio va en un cofre de su tablero; sin tablero, en uno pequeño y sin pelea', () => {
        const { pack } = fillPackGaps(packWith({
            locations: [{ name: 'La aldea', type: 'village' }, { name: 'El pozo viejo', type: 'ruins', treasure: ['Llave de hierro'] }],
            boards: [{ id: 'aldea', name: 'La plaza', locationName: 'La aldea', map: ['########', '#......#', '#......#', '#......#', '########'], partyStart: [{ x: 1, y: 1 }] }],
        }), { compendium: compendium() });
        const well = pack.boards.find((/** @type {any} */ b) => b.locationName === 'El pozo viejo');
        expect(well.enemies).toEqual([]);
        expect(readChests(well.chests)[0].items).toEqual(['Llave de hierro']);
        expect(validatePack(pack).ok).toBe(true);
    });

    test('quien cuenta un hito (pov) lo dice con su retrato; el de un capítulo vale para sus hitos', () => {
        const raw = buildShortExamplePack();
        raw.plot.chapters[1].pov = 'Tobías el molinero';
        raw.plot.milestones.push({ id: 'otro', title: 'Otro', scene: 'Lo cuenta alguien que no existe.', pov: 'Nadie', asks: { kind: 'none' } });
        const { pack } = fillPackGaps(raw, { compendium: compendium() });
        const byId = (/** @type {string} */ id) => pack.plot.milestones.find((/** @type {any} */ m) => m.id === id);
        expect(byId('llegada').beats).toEqual([{ who: 'Tobías el molinero', text: byId('llegada').scene }]);
        // «ermita» es del acto 2: lo cuenta el del capítulo 2.
        expect(byId('ermita').beats?.[0]?.who).toBe('Tobías el molinero');
        expect(byId('otro').beats).toBeUndefined();
        expect(validatePack(pack).warnings.some(w => w.path.endsWith('.pov') && /Nadie/.test(w.message))).toBe(true);
    });

    test('el contrato lo dice: la gente, las salas, los tesoros y el punto de vista', () => {
        expect(SECTION_ORDER.indexOf('npcs')).toBeGreaterThan(SECTION_ORDER.indexOf('confidants'));
        expect(getSectionSchema('npcs').items.required).toEqual(['name', 'where']);
        const zone = getSectionSchema('boards').items.properties.zones.items.properties;
        expect(Object.keys(zone)).toEqual(expect.arrayContaining(['enemies', 'treasure']));
        expect(getSectionSchema('locations').items.properties.treasure).toBeTruthy();
        expect(getSectionSchema('plot').properties.milestones.items.properties.pov).toBeTruthy();
        expect(getSectionSchema('plot').properties.chapters.items.properties.pov).toBeTruthy();
        expect(JSON.stringify(getSectionSchema('locations'))).not.toMatch(/localidad/);
    });
});

/**
 * Un mapa dibujado como los de verdad: la cuadrícula gris en el suelo, la roca rayada y un trazo
 * negro donde la roca toca el suelo (como `drawMap` de las pruebas de `map-image.js`).
 *
 * @param {string[]} rows
 * @returns {{width: number, height: number, data: Uint8ClampedArray}}
 */
function drawMap(rows) {
    const cell = 20;
    const offsetX = 7;
    const offsetY = 5;
    const cols = rows[0].length;
    const width = offsetX + cols * cell + 13;
    const height = offsetY + rows.length * cell + 13;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const put = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ value) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(data[i], value);
    };
    const box = (/** @type {number} */ cx, /** @type {number} */ cy) => ({ x0: offsetX + cx * cell, y0: offsetY + cy * cell });
    for (let cy = 0; cy < rows.length; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            const { x0, y0 } = box(cx, cy);
            if (rows[cy][cx] === '.') {
                for (let t = 0; t < cell; t++) {
                    for (const d of [-1, 0, 1]) {
                        put(x0 + t, y0 + d, 166);
                        put(x0 + t, y0 + cell + d, 166);
                        put(x0 + d, y0 + t, 166);
                        put(x0 + cell + d, y0 + t, 166);
                    }
                }
            } else {
                for (let y = 0; y < cell; y++) {
                    for (let x = 0; x < cell; x++) if ((x + y + cx * cell + cy * cell) % 6 < 2) put(x0 + x, y0 + y, 0);
                }
            }
        }
    }
    const floor = (/** @type {number} */ cx, /** @type {number} */ cy) => rows[cy]?.[cx] === '.';
    for (let cy = 0; cy < rows.length; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (rows[cy][cx] !== '#') continue;
            const { x0, y0 } = box(cx, cy);
            for (let t = -1; t <= cell + 1; t++) {
                for (const d of [-1, 0, 1]) {
                    if (floor(cx + 1, cy)) put(x0 + cell + d, y0 + t, 0);
                    if (floor(cx - 1, cy)) put(x0 + d, y0 + t, 0);
                    if (floor(cx, cy + 1)) put(x0 + t, y0 + cell + d, 0);
                    if (floor(cx, cy - 1)) put(x0 + t, y0 + d, 0);
                }
            }
        }
    }
    return { width, height, data };
}

const DRAWN = [
    '##########',
    '#...#....#',
    '#...#....#',
    '#........#',
    '#...#....#',
    '##########',
];

describe('J12.5: los tableros de tu JSON', () => {
    const drawnBoard = () => ({ id: 'sotano', name: 'El sótano', locationName: 'La cripta', image: 'mundos/prueba/sotano.png', grid: { cell: 20, offsetX: 7, offsetY: 5 } });

    test('un tablero con su dibujo y sin mapa se lee del dibujo, casilla a casilla', async () => {
        /** @type {string[]} */
        const asked = [];
        const { pack, filled } = await readPackMaps(packWith({ boards: [drawnBoard()] }), {
            loadPixels: async (src) => { asked.push(src); return drawMap(DRAWN); },
        });
        expect(asked).toEqual(['/mundos/prueba/sotano.png']);
        expect(pack.boards[0].map).toEqual(DRAWN);
        expect(pack.boards[0].grid).toMatchObject({ cell: 20, cols: 10, rows: 6 });
        expect(pack.boards[0].image).toBe('mundos/prueba/sotano.png');
        expect(filled).toEqual([expect.objectContaining({ kind: 'mapa', name: 'El sótano' })]);
        // Y el motor completa lo demás: dónde empieza el grupo.
        const done = fillPackGaps(pack, { compendium: compendium() }).pack.boards[0];
        expect(done.partyStart.length).toBeGreaterThan(0);
        expect(done.image).toBe('mundos/prueba/sotano.png');
    });

    test('si el dibujo no se abre, se dibuja con la semilla, sin el dibujo, y se dice', async () => {
        const read = await readPackMaps(packWith({ boards: [drawnBoard()] }), { loadPixels: async () => { throw new Error('no está'); } });
        expect(read.filled).toEqual([]);
        const { pack, filled } = fillPackGaps(read.pack, { compendium: compendium() });
        const board = pack.boards[0];
        expect(board.seeded).toBe(true);
        expect(board.image).toBeUndefined();
        expect(board.grid).toBeUndefined();
        expect(filled.some(f => f.kind === 'tablero' && /dibujo no se ha podido leer/.test(f.detail))).toBe(true);
        expect(validatePack(pack).ok).toBe(true);
    });

    test('un tablero con su mapa escrito no se toca, y las rutas se abren desde public/', async () => {
        const board = { ...drawnBoard(), map: DRAWN };
        const read = await readPackMaps(packWith({ boards: [board] }), { loadPixels: async () => drawMap(DRAWN) });
        expect(read.filled).toEqual([]);
        expect(packImageUrl('/mundos/a.png')).toBe('/mundos/a.png');
        expect(packImageUrl('https://x.org/a.png')).toBe('https://x.org/a.png');
    });

    test('al añadir desde el tablón, el dibujo se lee antes de rellenar y se cuenta', async () => {
        const text = JSON.stringify(packWith({ boards: [drawnBoard()] }));
        const report = await readCampaignFile(text, { compendium: compendium(), loadPixels: async () => drawMap(DRAWN) });
        expect(report.ok).toBe(true);
        expect(report.pack.boards[0].map.length).toBe(DRAWN.length);
        expect(report.notes.some(n => /traía su dibujo sin su mapa: se ha leído del dibujo/.test(n))).toBe(true);
        // Sin quien abra imágenes, como siempre: con la semilla.
        const plain = readCampaignText(text, { compendium: compendium() });
        expect(plain.ok).toBe(true);
        expect(plain.pack.boards[0].image).toBeUndefined();
    });
});

describe('J5.6: comprobar una campaña antes de jugarla, dicho en llano', () => {
    test('los hitos y los encargos por su título, «gente» y no «PNJ», y los objetivos en palabras', () => {
        const pack = { plot: { milestones: [{ id: 'fondo', title: 'Lo que duerme debajo' }] }, contracts: [{ id: 'c1', title: 'El carro' }] };
        expect(plainLine('Hito fondo no se abre nunca', pack)).toBe('El hito «Lo que duerme debajo» no se abre nunca');
        expect(plainLine('Encargo c1: tiene pelea pero no tiene tablero', pack)).toBe('El encargo «El carro»: tiene pelea pero no tiene tablero');
        expect(plainLine('El hilo no tiene mecha: ningún hito se abre al empezar', pack)).toBe('La historia no arranca: ningún hito se abre al empezar');
        expect(plainLine('PNJ con nombre: 0, y las del juego tienen 22.', pack)).toBe('Gente con nombre: 0, y las del juego tienen 22.');
        expect(plainLine('Tipos de objetivo en los combates: eliminate_all, eliminate, y las del juego tienen 4.', pack))
            .toBe('Tipos de objetivo en los combates: limpiar el tablero, derrotar a alguien, y las del juego tienen 4.');
    });

    test('el informe de la corta no llama «cosa rara» a lo que puso el juego ni enseña ids', () => {
        const report = readCampaignText(JSON.stringify(buildShortExamplePack()), { compendium: compendium() });
        expect(report.ok).toBe(true);
        expect(report.check?.verdict).toBe('lista');
        const all = JSON.stringify(report.check?.groups ?? []);
        expect(all).not.toMatch(/Ninguna misi[oó]n lleva/);
        expect(all).not.toMatch(/eliminate_all|PNJ/);
        expect(report.check?.groups.find(g => g.key === 'relleno')?.items.length).toBeGreaterThan(3);
    });
});
