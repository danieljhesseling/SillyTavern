/**
 * J5.10: lo corregido en el Word del taller sale también como una ronda del guion
 * (`campaign/guion-round.js`). La prueba de verdad es la vuelta: las rondas de 1387 más la ronda
 * nueva dan, al convertirlas, la campaña con las correcciones puestas.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { convertGuion, isRoundFile, guionBlocks } from '../public/scripts/game-engine/campaign/guion-pack.js';
import { workshopWord, importWordInto } from '../public/scripts/game-engine/campaign/guion-workshop.js';
import { correctionsRound, mergeCorrections, nextRoundName } from '../public/scripts/game-engine/campaign/guion-round.js';
import { buildScript } from '../public/scripts/game-engine/campaign/script-doc.js';
import { xmlText } from '../public/scripts/game-engine/campaign/script-docx.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const jsyaml = require('js-yaml');
const YAML = require('yaml');

const DIR = join(ROOT, 'wiki/guiones/1387');
const rounds = () => readdirSync(DIR).filter(isRoundFile).map(name => ({ name, text: readFileSync(join(DIR, name), 'utf8') }));
const abilityRows = JSON.parse(readFileSync(join(ROOT, 'public/compendio/habilidades.json'), 'utf8')).rows ?? [];
const convert = (/** @type {any[]} */ files, parseYaml = jsyaml.load) => convertGuion(files, { parseYaml, abilityRows });
const valueAt = (/** @type {any} */ root, /** @type {Array<string|number>} */ path) => path.reduce((/** @type {any} */ at, step) => at?.[step], root);

describe('J5.10: las correcciones del Word, como una ronda del guion', () => {
    test('tres líneas corregidas en el Word del taller salen en ronda-13-correcciones.md, y al convertirla se quedan', () => {
        const result = convert(rounds());
        const word = workshopWord(result.pack, '2026-10-03T12:00:00Z');
        let xml = word.files['word/document.xml'];
        const script = buildScript(result.pack);
        // Una escena de hito, el secreto de alguien y lo que dice un compañero al llegar a un sitio.
        const wanted = [/^plot\.milestones\.\d+\.scene$/, /^npcs\.\d+\.secret$/, /^confidants\.\d+\.arrivals\.\d+\.line$/];
        const lines = wanted.map(shape => script.blocks.find(b => b.src?.doc === 'pack' && shape.test((b.src.path ?? []).join('.'))
            && String(b.text ?? '').length > 20 && xml.includes(xmlText(String(b.text)))));
        expect(lines.every(Boolean)).toBe(true);
        const fixes = ['Torres echa la puerta abajo y te mira el cáliz: «¿Y esto?».', 'Se bebe la cerveza que dice que ha aguado.', 'Aquí perdí a mi chico. No me hables un rato.'];
        lines.forEach((line, i) => { xml = xml.replace(xmlText(String(line?.text)), xmlText(fixes[i])); });

        const done = importWordInto(result.pack, xml);
        expect(done.applied).toHaveLength(3);
        expect(done.changes.map(c => c.after)).toEqual(fixes);
        expect(done.changes.map(c => c.path)).toEqual(lines.map(l => l?.src?.path));

        const round = correctionsRound({ changes: mergeCorrections([], done.changes), pack: result.pack, byKind: result.byKind, files: result.files, title: result.pack.world.name, date: '2026-10-03' });
        expect(round.name).toBe('ronda-13-correcciones.md');
        expect(isRoundFile(round.name)).toBe(true);
        expect(round.placed).toBe(3);
        expect(round.unplaced).toEqual([]);
        expect(round.said).toMatch(/^ronda-13-correcciones\.md: 3 correcciones en 3 bloques\.$/);
        // Como las rondas de Claude: bloques con el id de lo que corrigen y solo lo que cambia.
        expect(round.text).toMatch(/^# Ronda 13: lo corregido en el Word \(«El valle de Vane»\)/);
        expect(round.text).toMatch(/\nhito:\n {2}# Antes: «/);
        expect(round.text).toMatch(/\npnj:\n(?: {2}#.*\n)* {2}id: '[^']+'\n {2}secreto: 'Se bebe la cerveza que dice que ha aguado\.'\n/);
        expect(round.text).toMatch(/\nconfidente:\n(?:.*\n)*? {2}al_llegar:\n {4}[a-z0-9-]+: 'Aquí perdí a mi chico\. No me hables un rato\.'\n/);
        expect(guionBlocks(round.text, round.name, jsyaml.load).blocks.map(b => b.kind).sort()).toEqual(['confidente', 'hito', 'pnj']);

        // La vuelta, con las dos librerías de YAML: la de la herramienta y la del navegador.
        for (const parseYaml of [jsyaml.load, (/** @type {string} */ s) => YAML.parse(s)]) {
            const again = convert([...rounds(), { name: round.name, text: round.text }], parseYaml);
            expect(again.stage).toBe('hecho');
            expect(again.files.at(-1)).toBe('ronda-13-correcciones.md');
            for (const change of done.changes) expect(valueAt(again.pack, change.path)).toBe(change.after);
            expect(JSON.stringify(again.pack)).toBe(JSON.stringify(done.pack));
        }
    });

    test('cada clase de línea del Word va a su bloque, con comillas y marcas de género intactas', () => {
        const result = convert(rounds());
        const script = buildScript(result.pack);
        /** @type {Set<string>} */
        const seen = new Set();
        /** @type {Array<{path: Array<string|number>, before: string, after: string}>} */
        const changes = [];
        for (const block of script.blocks) {
            if (block.src?.doc !== 'pack') continue;
            const shape = (block.src.path ?? []).map(step => (typeof step === 'number' ? '#' : step)).join('.').replace(/endings\.[^.]+/, 'endings.K');
            // El nombre de una pelea también renombra su tablero: va en la prueba de abajo.
            if (seen.has(shape) || shape === 'quests.#.name') continue;
            seen.add(shape);
            changes.push({ path: block.src.path, before: String(block.text), after: `${block.text} Y {el forastero|la forastera} dice: «it's».` });
        }
        expect(changes.length).toBeGreaterThanOrEqual(20);
        const round = correctionsRound({ changes, pack: result.pack, byKind: result.byKind, files: result.files });
        expect(round.unplaced).toEqual([]);
        expect(round.placed).toBe(changes.length);
        const corrected = JSON.parse(JSON.stringify(result.pack));
        for (const change of changes) valueAt(corrected, change.path.slice(0, -1))[change.path.at(-1) ?? ''] = change.after;
        const again = convert([...rounds(), { name: round.name, text: round.text }]);
        expect(again.problems).toEqual([]);
        expect(JSON.stringify(again.pack)).toBe(JSON.stringify(corrected));
    });

    test('el nombre de una pelea corrige el encuentro: cambian la misión, su tablero y el hito que lo pide', () => {
        const result = convert(rounds());
        const at = result.pack.quests.findIndex((/** @type {any} */ q) => result.pack.plot.milestones.some((/** @type {any} */ m) => m.asks?.board === q.name));
        expect(at).toBeGreaterThanOrEqual(0);
        const quest = result.pack.quests[at];
        const round = correctionsRound({ changes: [{ path: ['quests', at, 'name'], before: quest.name, after: 'La ventana del cuarto' }], pack: result.pack, byKind: result.byKind, files: result.files });
        expect(round.text).toContain(`\nencuentro:\n  # Antes: «${quest.name}»\n  id: '${quest.boardId}'\n  nombre: 'La ventana del cuarto'\n`);
        const again = convert([...rounds(), { name: round.name, text: round.text }]);
        expect(again.pack.quests[at].name).toBe('La ventana del cuarto');
        expect(again.pack.boards.find((/** @type {any} */ b) => b.id === quest.boardId).name).toBe('La ventana del cuarto');
        expect(again.pack.plot.milestones.some((/** @type {any} */ m) => m.asks?.board === 'La ventana del cuarto')).toBe(true);
    });

    test('los epílogos y las escenas sin rango se escriben enteros; lo que no sale del guion va aparte', () => {
        const guion = [
            'mundo:',
            '  id: prueba',
            '  nombre: Prueba',
            '  presagio:',
            '    - frase: Caerá la torre.',
            '      se_cumple: la-torre',
            'hito:',
            '  id: la-torre',
            '  titulo: La torre',
            'final:',
            '  id: bueno',
            '  titulo: Bien',
            '  epilogos:',
            '    - Nadie se acuerda.',
            '    - quien: ana',
            '      texto: ""',
            '    - quien: ana',
            '      texto: Ana se queda.',
            'pnj:',
            '  id: ana',
            '  nombre: Ana',
            'confidente:',
            '  id: rufo',
            '  nombre: Rufo',
            '  escenas:',
            '    - escena: Primera.',
            '    - escena: Segunda.',
        ].join('\n');
        const result = convert([{ name: 'ronda-1.md', text: guion }]);
        expect(result.stage).toBe('hecho');
        expect(result.pack.plot.endings.bueno.epilogues.map((/** @type {any} */ e) => e.text)).toEqual(['Nadie se acuerda.', 'Ana se queda.']);
        const changes = [
            { path: ['plot', 'endings', 'bueno', 'epilogues', 1, 'text'], before: 'Ana se queda.', after: 'Ana se marcha al sur.' },
            { path: ['plot', 'endings', 'bueno', 'epilogues', 0, 'text'], before: 'Nadie se acuerda.', after: 'Todos se acuerdan.' },
            { path: ['confidants', 0, 'scenes', 1, 'scene'], before: 'Segunda.', after: 'La segunda, corregida.' },
            { path: ['plot', 'omens', 0, 'text'], before: 'Caerá la torre.', after: 'La torre caerá.' },
            // El tablero que pone el juego no es de ningún bloque.
            { path: ['boards', 0, 'name'], before: 'Algo', after: 'Otra cosa' },
        ];
        const round = correctionsRound({ changes, pack: result.pack, byKind: result.byKind, files: result.files });
        expect(round.name).toBe('ronda-2-correcciones.md');
        expect(round.placed).toBe(4);
        expect(round.unplaced).toEqual([changes[4]]);
        expect(round.text).toContain('## Lo que no sale de ningún bloque del guion');
        expect(round.text).toContain('- «Algo» → «Otra cosa»');
        const again = convert([{ name: 'ronda-1.md', text: guion }, { name: round.name, text: round.text }]);
        expect(again.stage).toBe('hecho');
        expect(again.pack.plot.endings.bueno.epilogues.map((/** @type {any} */ e) => e.text)).toEqual(['Todos se acuerdan.', 'Ana se marcha al sur.']);
        expect(again.pack.confidants[0].scenes.map((/** @type {any} */ s) => s.scene)).toEqual(['Primera.', 'La segunda, corregida.']);
        expect(again.pack.plot.omens[0]).toEqual({ text: 'La torre caerá.', milestone: 'la-torre' });
    });

    test('varios Word seguidos: de cada línea cuenta lo último, y lo que vuelve a estar como estaba se cae', () => {
        const a = { path: ['npcs', 0, 'voice'], before: 'Ronca.', after: 'Muy ronca.' };
        const b = { path: ['npcs', 1, 'voice'], before: 'Suave.', after: 'Muy suave.' };
        expect(mergeCorrections([a], [{ ...a, before: 'Muy ronca.', after: 'Ronquísima.' }, b])).toEqual([{ ...a, after: 'Ronquísima.' }, b]);
        expect(mergeCorrections([a, b], [{ ...b, before: 'Muy suave.', after: 'Suave.' }])).toEqual([a]);
        expect(mergeCorrections(/** @type {any} */ (null), [])).toEqual([]);
        expect(correctionsRound({ changes: [], pack: {}, byKind: {} }).said).toBe('No hay correcciones del Word que guardar.');
    });

    test('la ronda nueva va detrás de la última', () => {
        expect(nextRoundName(['ronda-1.md', 'ronda-12-claude-decisiones.md', 'ronda-9-claude.md'])).toBe('ronda-13-correcciones.md');
        expect(nextRoundName(['capitulo-1.md'])).toBe('ronda-1-correcciones.md');
        expect(nextRoundName([])).toBe('ronda-1-correcciones.md');
    });
});
