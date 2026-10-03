import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { convertGuion, isRoundFile } from '../public/scripts/game-engine/campaign/guion-pack.js';
import { checkWorldDensity } from '../public/scripts/game-engine/campaign/world-density.js';
import { unreachableBoards } from '../public/scripts/game-engine/campaign/guided-mode.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const jsyaml = require('js-yaml');
const abilityRows = JSON.parse(readFileSync(join(ROOT, 'public/compendio/habilidades.json'), 'utf8')).rows ?? [];

/** @param {string} text */
const round = (text) => ({ name: 'ronda-1.md', text });

const WORLD = [
    'mundo:',
    '  id: prueba',
    '  nombre: La prueba',
    '  sinopsis: Un pueblo pequeño.',
    '  inicio: aldea',
    '  paquete:',
    '    world:',
    '      levels: [1, 4]',
    '    plot:',
    '      chapters:',
    '        - { act: 1, title: El principio }',
    '',
    'localidad:',
    '  id: aldea',
    '  nombre: La aldea',
    '  tipo: village',
    '  paquete:',
    '    region: El valle',
    '',
].join('\n');

describe('El conversor de guiones con `paquete:` y `charla:` (tanda 20, «La costa que no duerme»)', () => {
    test('`paquete:` pasa tal cual encima de lo convertido: la gente, el mundo y una localización', () => {
        const text = [WORLD,
            'pnj:',
            '  id: tomas',
            '  nombre: Tomás',
            '  oficio: Posadero',
            '  donde: aldea',
            '  paquete:',
            '    gender: Hombre',
            '    aspecto: \'Hombre de unos cincuenta, con delantal.\'',
            ''].join('\n');
        const result = convertGuion([round(text)], { parseYaml: jsyaml.load, abilityRows });
        expect(result.stage).toBe('hecho');
        const tomas = result.pack.npcs.find((/** @type {any} */ n) => n.id === 'tomas');
        expect(tomas).toMatchObject({ name: 'Tomás', trade: 'Posadero', where: 'La aldea', gender: 'Hombre', aspecto: 'Hombre de unos cincuenta, con delantal.' });
        // El del mundo va encima del paquete entero, sin pisar lo convertido.
        expect(result.pack.world.levels).toEqual([1, 4]);
        expect(result.pack.world.name).toBe('La prueba');
        expect(result.pack.plot.chapters).toEqual([{ act: 1, title: 'El principio' }]);
        expect(result.pack.locations[0]).toMatchObject({ name: 'La aldea', region: 'El valle' });
    });

    test('en un encuentro, `paquete:` va al tablero y `mision:` a su misión (un botín en vez de «todos»)', () => {
        const text = [WORLD,
            'bicho:',
            '  id: rata',
            '  nombre: Rata',
            '  pg: 4',
            '',
            'tablero:',
            '  id: sotano',
            '  localidad: aldea',
            '  mapa:',
            '    - \'########\'',
            '    - \'#..k...#\'',
            '    - \'#......#\'',
            '    - \'#......#\'',
            '    - \'#......#\'',
            '    - \'########\'',
            '  inicio_grupo: [[1, 4], [2, 4]]',
            '',
            'encuentro:',
            '  id: enc-sotano',
            '  nombre: El sótano',
            '  tablero: sotano',
            '  enemigos:',
            '    - { bicho: rata, cuantos: 1, en: [[5, 2]] }',
            '  mision:',
            '    objectives:',
            '      - { type: loot, label: \'Coger la llave\', treasures: [Llave vieja] }',
            '  paquete:',
            '    avoid:',
            '      - { kind: huir, text: \'Subir la escalera\' }',
            ''].join('\n');
        const result = convertGuion([round(text)], { parseYaml: jsyaml.load, abilityRows });
        const board = result.pack.boards.find((/** @type {any} */ b) => b.id === 'enc-sotano');
        expect(board.avoid).toEqual([{ kind: 'huir', text: 'Subir la escalera' }]);
        expect(board.enemies).toEqual([{ name: 'Rata', x: 5, y: 2 }]);
        const quest = result.pack.quests.find((/** @type {any} */ q) => q.boardId === 'enc-sotano');
        expect(quest.objectives).toEqual([{ type: 'loot', label: 'Coger la llave', treasures: ['Llave vieja'] }]);
    });

    test('una `charla:` sale en `dialogues`, con quien habla por su nombre', () => {
        const text = [WORLD,
            'pnj:',
            '  id: tomas',
            '  nombre: Tomás',
            '  oficio: Posadero',
            '  donde: aldea',
            '',
            'charla:',
            '  id: tomas-hola',
            '  speaker: tomas',
            '  title: Hola',
            '  nodes:',
            '    - { id: inicio, line: \'Soy Tomás. ¿Qué quieres?\' }',
            ''].join('\n');
        const result = convertGuion([round(text)], { parseYaml: jsyaml.load, abilityRows });
        expect(result.pack.dialogues).toEqual([{ id: 'tomas-hola', speaker: 'Tomás', title: 'Hola', nodes: [{ id: 'inicio', line: 'Soy Tomás. ¿Qué quieres?' }] }]);
        // Sin charlas, el paquete no trae la lista.
        const none = convertGuion([round(WORLD)], { parseYaml: jsyaml.load, abilityRows });
        expect(none.pack.dialogues).toBeUndefined();
    });

    test('las rondas de la costa dan el paquete del juego, sin errores, al listón y con todos sus tableros a mano', () => {
        const dir = join(ROOT, 'wiki/guiones/costa');
        const files = readdirSync(dir).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
        const result = convertGuion(files, { parseYaml: jsyaml.load, abilityRows });
        expect(result.stage).toBe('hecho');
        expect(result.notes).toEqual([]);
        expect(result.issues.filter(i => i.level === 'ERROR')).toEqual([]);
        const shipped = JSON.parse(readFileSync(join(ROOT, 'public/mundos/costa.pack.json'), 'utf8'));
        expect(result.pack).toEqual(shipped);
        expect(checkWorldDensity(shipped).errors).toEqual([]);
        // D-J62: a cada tablero se llega por un hito, una conversación o un encargo.
        expect(unreachableBoards(shipped).fights).toEqual([]);
        // La moneda es la del juego: monedas, no sueldos.
        expect(JSON.stringify(shipped)).not.toMatch(/sueldo/);
        expect(JSON.stringify(shipped)).toMatch(/monedas/);
    });
});
