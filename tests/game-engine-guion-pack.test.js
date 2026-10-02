import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { convertGuion, guionReportLines, isRoundFile, sortRoundFiles, locateNote, guionBlocks } from '../public/scripts/game-engine/campaign/guion-pack.js';
import { explainYamlError } from '../public/scripts/game-engine/campaign/guion-errors.js';
import { workshopUpload, workshopBands, workshopGemText, renamedPack, withMapPatch, simSummary, workshopWord, importWordInto } from '../public/scripts/game-engine/campaign/guion-workshop.js';
import { buildScript } from '../public/scripts/game-engine/campaign/script-doc.js';
import { xmlText } from '../public/scripts/game-engine/campaign/script-docx.js';
import { checkWorldDensity } from '../public/scripts/game-engine/campaign/world-density.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Las dos librerías de YAML: la de la herramienta (js-yaml) y la del navegador (`yaml`, la de lib.js).
const require = createRequire(join(ROOT, 'package.json'));
const jsyaml = require('js-yaml');
const YAML = require('yaml');

const DIR = join(ROOT, 'wiki/guiones/1387');
const rounds = () => readdirSync(DIR).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));
const abilityRows = JSON.parse(readFileSync(join(ROOT, 'public/compendio/habilidades.json'), 'utf8')).rows ?? [];

describe('J5.9: el conversor de guiones, en el motor', () => {
    test('las rondas de 1387 dan el mismo paquete con la librería de la herramienta y con la del navegador', () => {
        const tool = convertGuion(rounds(), { parseYaml: jsyaml.load, abilityRows });
        const browser = convertGuion(rounds(), { parseYaml: (s) => YAML.parse(s), abilityRows });
        expect(tool.stage).toBe('hecho');
        expect(browser.stage).toBe('hecho');
        expect(JSON.stringify(browser.pack)).toBe(JSON.stringify(tool.pack));
        expect(guionReportLines(browser)).toEqual(guionReportLines(tool));
        expect(tool.files[0]).toBe('ronda-1.md');
        expect(tool.files.at(-1)).toBe('ronda-12-claude-decisiones.md');
        expect(tool.pack.world.name).toBeTruthy();
        expect(tool.issues.filter(i => i.level === 'ERROR')).toEqual([]);
        // El paquete sale en JSON llano, sin los vigilantes de lo leído.
        expect(() => structuredClone(tool.pack)).not.toThrow();
    });

    test('las rondas se ordenan por su número, y solo cuentan las que se llaman ronda-N', () => {
        expect(sortRoundFiles([{ name: 'ronda-10-claude.md' }, { name: 'ronda-2.md' }, { name: 'ronda-1.md' }]).map(f => f.name))
            .toEqual(['ronda-1.md', 'ronda-2.md', 'ronda-10-claude.md']);
        expect(isRoundFile('README.md')).toBe(false);
        expect(isRoundFile('1387/ronda-3.md')).toBe(true);
    });

    test('un bloque roto se dice con su archivo, su línea, la línea tal cual y el arreglo, con las dos librerías', () => {
        const source = ['Prosa de alrededor.', '', 'pnj:', '  id: arthur', '  nombre: Arthur: el Doc', '  voz: grave', ''].join('\n');
        for (const parse of [jsyaml.load, (/** @type {string} */ s) => YAML.parse(s)]) {
            const { problems } = guionBlocks(source, 'ronda-3.md', parse);
            expect(problems).toHaveLength(1);
            expect(problems[0]).toMatchObject({ file: 'ronda-3.md', line: 5, kind: 'pnj', start: 3, said: 'nombre: Arthur: el Doc' });
            expect(problems[0].why).toMatch(/dos puntos/);
            expect(problems[0].fix).toMatch(/comillas/);
        }
    });

    test('los fallos de la librería del navegador se dicen en castellano', () => {
        const lines = ['pnj:', '  id: x', '  id: y'];
        let error = null;
        try { YAML.parse(lines.join('\n')); } catch (e) { error = e; }
        const said = explainYamlError(error, 10, ['', '', '', '', '', '', '', '', '', ...lines]);
        expect(said.line).toBe(12);
        expect(said.why).toMatch(/dos veces/);
        const tab = (() => { try { YAML.parse('pnj:\n  id: x\n\tnombre: y'); } catch (e) { return e; } return null; })();
        expect(explainYamlError(tab, 1, ['pnj:', '  id: x', '\tnombre: y']).why).toMatch(/tabulador/);
    });

    test('sin bloque «mundo:» se para y lo dice', () => {
        const result = convertGuion([{ name: 'ronda-1.md', text: 'pnj:\n  id: x\n  nombre: X\n' }], { parseYaml: jsyaml.load });
        expect(result.stage).toBe('sin-mundo');
        expect(guionReportLines(result)[0]).toMatch(/Falta el bloque «mundo:»/);
    });

    test('un aviso del conversor señala la ronda del id que nombra', () => {
        const index = new Map([['enc-x', 'ronda-4.md:12']]);
        expect(locateNote('encuentro «enc-x» usa un tablero que no existe: t', index)).toBe('ronda-4.md:12');
        expect(locateNote('nada que ver', index)).toBe('');
    });
});

describe('J5.9: lo puro del taller', () => {
    test('lo subido: las rondas por su nombre, lo demás aparte', () => {
        const up = workshopUpload([
            { name: '1387/ronda-2.md', text: 'b' }, { name: '1387/ronda-1.md', text: 'a' },
            { name: '1387/README.md', text: 'x' }, { name: 'foto.png' },
        ]);
        expect(up.kind).toBe('guion');
        expect(up.rounds.map(r => r.name)).toEqual(['ronda-2.md', 'ronda-1.md']);
        expect(up.skipped).toEqual(['README.md', 'foto.png']);
        expect(workshopUpload([{ name: 'capitulo-1.md', text: '' }]).rounds).toHaveLength(1);
        expect(workshopUpload([{ name: 'mi.json', text: '{}' }]).kind).toBe('json');
        expect(workshopUpload([{ name: 'guion.docx' }]).kind).toBe('word');
        expect(workshopUpload([{ name: 'foto.png' }]).kind).toBe('');
    });

    test('otro nombre es otra campaña, y el original no se toca', () => {
        const pack = { world: { name: 'A' }, plot: { title: 'A' } };
        const copy = renamedPack(pack, 'B');
        expect(copy.world.name).toBe('B');
        expect(copy.plot.title).toBe('B');
        expect(pack.world.name).toBe('A');
    });

    test('un tablero sobre un mapa en imagen: su dibujo, su mapa leído y sin las casillas del mapa de antes', () => {
        const pack = {
            boards: [{ id: 't', name: 'T', map: ['...'], partyStart: [{ x: 0, y: 0 }], enemies: [{ name: 'Lobo', x: 2, y: 0 }] }],
            quests: [{ id: 'q', name: 'Huir', boardId: 't', objectives: [{ type: 'reach_cell', cell: { x: 7, y: 9 } }] }],
        };
        const terrain = { cells: { '1,0': { type: 'wall' } } };
        const { pack: out, moved } = withMapPatch(pack, 't', { url: '/user/images/tableros/m.png', grid: { cell: 50, offsetX: 0, offsetY: 0 }, gridWidth: 3, gridHeight: 2, terrain, zones: [], elevation: {} });
        const board = out.boards[0];
        expect(board.image).toBe('user/images/tableros/m.png');
        expect(board.grid).toMatchObject({ cell: 50, cols: 3, rows: 2 });
        expect(board.map).toEqual(['.#.', '...']);
        expect(board.partyStart).toEqual([]);
        expect(board.enemies).toEqual([{ name: 'Lobo' }]);
        expect(pack.boards[0].image).toBeUndefined();
        // La salida de la misión caía fuera del dibujo: va a la casilla de suelo más lejana.
        expect(out.quests[0].objectives[0].cell).toEqual({ x: 2, y: 1 });
        expect(moved[0]).toMatch(/«Huir» \(7,9\) no cae en el suelo del dibujo: va ahora en \(2,1\)/);
    });

    test('1387: cada tablero dice para qué nivel es, y la lista para el Gem pide una ronda nueva', () => {
        const result = convertGuion(rounds(), { parseYaml: jsyaml.load, abilityRows });
        const { levels, bandOf } = workshopBands(result.pack);
        expect(levels).not.toBeNull();
        const bands = result.pack.boards.map((/** @type {any} */ b) => bandOf(b));
        expect(bands.every((/** @type {any} */ b) => b.low >= 1 && b.high >= b.low)).toBe(true);
        // Las rondas de 1387 se quedan cortas del listón en algo (por eso se corrigió a mano el paquete).
        const said = workshopGemText({ source: 'guion', name: result.pack.world.name, issues: result.issues, notes: result.notes, density: checkWorldDensity(result.pack) });
        expect(said).toMatch(/ronda nueva del guion/);
        expect(workshopGemText({ source: 'guion', name: 'X', problems: [{ file: 'ronda-2.md', line: 7, why: 'Hay un tabulador.', said: '\tid: x', fix: 'Cambia el tabulador por espacios.' }] }))
            .toMatch(/ronda-2\.md, línea 7: Hay un tabulador/);
    });

    test('J5.7 y J5.8 en el taller: el guion sale en Word, y al volver cambia solo la línea tocada', () => {
        const result = convertGuion(rounds(), { parseYaml: jsyaml.load, abilityRows });
        const word = workshopWord(result.pack, '2026-10-02T12:00:00Z');
        expect(word.title).toBe('El valle de Vane');
        expect(word.lines).toBeGreaterThan(100);
        const xml = word.files['word/document.xml'];
        const script = buildScript(result.pack);
        const line = script.blocks.find(b => b.id && b.src?.doc === 'pack' && String(b.text ?? '').length > 20 && xml.includes(xmlText(String(b.text))));
        expect(line).toBeTruthy();
        const edited = xml.replace(xmlText(String(line?.text)), xmlText('Una línea corregida en Word.'));
        const done = importWordInto(result.pack, edited);
        expect(done.applied).toHaveLength(1);
        expect(done.refused).toEqual([]);
        const valueAt = (/** @type {any} */ root) => (line?.src?.path ?? []).reduce((/** @type {any} */ at, /** @type {any} */ step) => at?.[step], root);
        expect(valueAt(done.pack)).toBe('Una línea corregida en Word.');
        expect(done.said).toMatch(/^1 línea cambiada/);
        // El original no se toca.
        expect(valueAt(result.pack)).toBe(line?.text);
        // Sin tocar nada, nada cambia.
        expect(importWordInto(result.pack, xml).applied).toEqual([]);
    });

    test('el resumen de la simulación cuenta cada clase', () => {
        expect(simSummary([{ verdict: 'justa' }, { verdict: 'justa' }, { verdict: 'muy-dificil' }])).toBe('3 peleas: 2 justas, 1 demasiado difícil.');
        expect(simSummary([])).toMatch(/ningún tablero/);
    });
});
