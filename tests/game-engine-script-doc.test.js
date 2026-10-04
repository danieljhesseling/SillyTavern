/**
 * J5.7 y J5.8: el guion de una campaña en Word, de ida y vuelta (`campaign/script-doc.js`,
 * `campaign/script-docx.js` y `tools/guion-word.mjs`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect } from '@jest/globals';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import {
    buildScript, blockText, readParagraph, reviewScript, checkEdit, textHash, normalizeText, slug, NARRATOR, HERO,
} from '../public/scripts/game-engine/campaign/script-doc.js';
import { scriptToDocx, docxBlocks, docxParagraphs, xmlText } from '../public/scripts/game-engine/campaign/script-docx.js';

const tool = await import('../tools/guion-word.mjs');

/** Un paquete pequeño con un poco de todo. */
const PACK = {
    version: 1,
    world: { name: 'Villa Prueba', synopsis: 'Un pueblo pequeño con un pozo.' },
    locations: [{
        name: 'Villa Prueba', type: 'village', description: 'Casas de piedra alrededor de un pozo.',
        sights: [{ verbo: 'mirar', text: 'el pozo', skill: 'perception', found: 'La cuerda está cortada.' }],
    }],
    npcs: [
        { id: 'tomas', name: 'Tomás', trade: 'Posadero', where: 'Villa Prueba', knows: 'Todo lo que pasa en el pueblo.', wants: 'Cobrar las deudas.' },
        { id: 'ana', name: 'Ana', trade: 'Herrera', where: 'Villa Prueba' },
    ],
    rumors: [{ id: 'r-pozo', by: 'Tomás', where: 'Villa Prueba', text: 'Dicen que el pozo está maldito.' }],
    boards: [{
        id: 'patio', name: 'El patio', locationName: 'Villa Prueba', map: ['########', '#......#', '#......#', '########'], enemies: [],
        avoid: [{ kind: 'hablar', text: 'Decirles que se vayan', skill: 'persuasion', success: 'Se van refunfuñando.', failure: '«¡Ni hablar!»' }],
        parley: { leader: 'Matón', sobornar: { text: 'Pagarles para que se vayan', success: 'Cogen el oro y se van.', failure: 'Se ríen de ti.' } },
    }],
    quests: [{ id: 'q-patio', name: 'El patio', description: 'Echa a los matones del patio.', boardId: 'patio', objectives: [{ type: 'eliminate_all', label: 'Echarlos' }] }],
    dialogues: [{
        id: 'ana-forja', speaker: 'Ana', title: 'Ana, en la forja', start: 'inicio',
        nodes: [
            {
                id: 'inicio', line: 'Soy Ana. ¿Qué quieres, {forastero|forastera}?', again: 'Otra vez tú.',
                options: [{ id: 'espada', text: 'Quiero una espada.', next: 'espada' }, { id: 'adios', text: 'Nada.', reply: 'Pues fuera.', end: true }],
            },
            { id: 'espada', line: 'Diez monedas, y es tuya.', mood: 'alegre', journal: 'Ana vende espadas.', options: [] },
        ],
    }],
    plot: {
        title: 'La prueba',
        milestones: [
            {
                id: 'segundo', title: 'El patio', hint: 'Gana la pelea del patio.', scene: 'Unos matones ocupan el patio.',
                opens: { kind: 'after', milestone: 'primero' }, asks: { kind: 'win', board: 'El patio' }, changes: {},
            },
            {
                id: 'primero', title: 'La llegada', hint: 'Habla con el posadero.', scene: 'Llegas al pueblo.',
                opens: { kind: 'start' }, asks: { kind: 'talk', npc: 'Tomás' }, changes: { open: ['segundo'] },
                beats: [
                    { text: 'Llegas al pueblo al caer la tarde.' },
                    { who: 'Tomás', mood: 'enfadado', text: '¡Cuidado con el pozo, que no tiene tapa!' },
                    {
                        who: 'Tomás', text: 'Soy Tomás, el de la posada.',
                        options: [
                            { id: 'gracias', text: 'Gracias, Tomás.', reply: { who: 'Tomás', mood: 'alegre', text: 'No hay de qué.' } },
                            {
                                id: 'mirar', text: 'Le miras bien.',
                                check: { skill: 'insight', success: { reply: { text: 'Le tiemblan las manos.' } }, failure: { reply: { who: 'Tomás', text: '¿Qué miras?' } } },
                            },
                        ],
                    },
                    { who: 'Tomás', text: 'Vuelve cuando quieras.', alt: [{ if: { chose: 'gracias' }, text: 'Siempre tan {amable|amable}.' }] },
                ],
            },
        ],
        endings: { bueno: { title: 'Final bueno', scene: 'El pueblo duerme tranquilo.', epilogues: [{ who: 'Tomás', text: 'Tomás pone una tapa al pozo.' }] } },
    },
};

/** Lo que hay en una ruta. */
const valueAt = (value, at) => at.reduce((v, key) => (v == null ? undefined : v[key]), value);

/** Las líneas del guion, por su id. */
const linesOf = (script) => new Map(script.blocks.filter(b => b.id).map(b => [b.id, b]));

/** Todas las cadenas de un objeto, con su ruta. */
function stringsOf(value, at = [], out = new Map()) {
    if (typeof value === 'string') out.set(JSON.stringify(at), value);
    else if (Array.isArray(value)) value.forEach((item, i) => stringsOf(item, [...at, i], out));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) stringsOf(item, [...at, key], out);
    return out;
}

/** Un directorio temporal para escribir sin tocar el repositorio. */
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'guion-word-'));

/** Corregir unas líneas dentro del .docx, como en Word: su texto, delante de su marca. */
function editDocx(file, out, script, edits) {
    const files = unzipSync(fs.readFileSync(file));
    let xml = strFromU8(files['word/document.xml']);
    const lines = linesOf(script);
    for (const [id, change] of Object.entries(edits)) {
        const block = lines.get(id);
        const mark = xml.indexOf(`[#${id}~`);
        const old = xmlText(block.text);
        const start = xml.lastIndexOf(old, mark);
        expect(start).toBeGreaterThan(-1);
        xml = xml.slice(0, start) + xmlText(change(block.text)) + xml.slice(start + old.length);
    }
    files['word/document.xml'] = strToU8(xml);
    fs.writeFileSync(out, zipSync(files));
}

describe('el guion de un paquete', () => {
    const script = buildScript(PACK, { date: '2 de octubre de 2026' });
    const lines = linesOf(script);

    test('los hitos salen en el orden en que se juegan, con su pelea debajo', () => {
        const order = script.blocks.filter(b => b.id?.startsWith('H:') && b.id.endsWith('/titulo')).map(b => b.id);
        expect(order).toEqual(['H:primero/titulo', 'H:segundo/titulo']);
        const ids = script.blocks.map(b => b.id ?? b.text);
        expect(ids.indexOf('Pelea: El patio')).toBeGreaterThan(ids.indexOf('H:segundo/titulo'));
        expect(ids.indexOf('Q:q-patio')).toBeGreaterThan(ids.indexOf('Pelea: El patio'));
    });

    test('quien habla, con lo que es hasta que se presenta; lo que no dice nadie, «Narrador»', () => {
        expect(lines.get('E:primero/1').label).toBe(NARRATOR);
        expect(lines.get('E:primero/2').label).toBe('Tomás (el posadero)');
        expect(lines.get('E:primero/2').mood).toBe('enfadado');
        expect(lines.get('E:primero/3').label).toBe('Tomás (el posadero)');
        // Ya se ha presentado.
        expect(lines.get('E:primero/4').label).toBe('Tomás');
        expect(blockText(lines.get('E:primero/2'))).toMatch(/^Tomás \(el posadero\) \(enfadado\): ¡Cuidado con el pozo, que no tiene tapa! \[#E:primero\/2~[0-9a-z]{4}\]$/);
    });

    test('tus opciones, lo que contestan y lo que sale según la tirada', () => {
        expect(lines.get('E:primero/3/gracias')).toMatchObject({ label: HERO, text: 'Gracias, Tomás.', bullet: true });
        expect(lines.get('E:primero/3/gracias/r')).toMatchObject({ label: 'Tomás', mood: 'alegre', text: 'No hay de qué.' });
        expect(lines.get('E:primero/3/mirar/bien/r')).toMatchObject({ label: NARRATOR, pre: 'Si sale bien', text: 'Le tiemblan las manos.' });
        expect(lines.get('E:primero/3/mirar/mal/r')).toMatchObject({ label: 'Tomás', pre: 'Si sale mal' });
        expect(lines.get('E:primero/4/otra1').pre).toBe('Si dijiste «Gracias, Tomás.»');
    });

    test('las charlas en orden de lectura, con lo que dice otro día y adónde lleva cada opción', () => {
        expect(lines.get('D:ana-forja/inicio')).toMatchObject({ label: 'Ana (la herrera)', text: 'Soy Ana. ¿Qué quieres, {forastero|forastera}?' });
        expect(lines.get('D:ana-forja/inicio/otro-dia')).toMatchObject({ pre: 'Otro día', label: 'Ana' });
        expect(lines.get('D:ana-forja/espada')).toMatchObject({ pre: 'Tras «Quiero una espada.»', mood: 'alegre' });
        expect(lines.get('D:ana-forja/inicio/adios/r')).toMatchObject({ label: 'Ana', text: 'Pues fuera.' });
        expect(lines.get('D:ana-forja/espada/diario').label).toBe('Diario');
    });

    test('el mundo, las peleas y los finales', () => {
        expect(lines.get('L:villa-prueba/mirar1')).toMatchObject({ label: HERO, pre: 'Mirar', text: 'el pozo' });
        expect(lines.get('L:villa-prueba/mirar1/visto').text).toBe('La cuerda está cortada.');
        expect(lines.get('R:r-pozo')).toMatchObject({ pre: 'Rumor', text: 'Dicen que el pozo está maldito.' });
        expect(lines.get('G:tomas/sabe').text).toBe('Todo lo que pasa en el pueblo.');
        expect(lines.get('P:patio/evitar1/bien').text).toBe('Se van refunfuñando.');
        expect(lines.get('P:patio/sobornar')).toMatchObject({ label: HERO, pre: 'En plena pelea · Sobornar' });
        expect(lines.get('F:bueno/epilogo1')).toMatchObject({ pre: 'Tomás', text: 'Tomás pone una tapa al pozo.' });
    });

    test('cada línea apunta a su texto en el paquete, y los ids no se repiten', () => {
        const ids = script.blocks.filter(b => b.id).map(b => b.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const block of script.blocks.filter(b => b.id)) {
            expect(block.src.doc).toBe('pack');
            expect(valueAt(PACK, block.src.path)).toBe(block.text);
            expect(block.hash).toBe(textHash(block.text));
        }
        expect(script.counts.narrator).toBeGreaterThan(0);
        expect(script.counts.lines).toBe(ids.length);
    });

    test('del compendio, solo lo de esta campaña y lo de su gente', () => {
        const compendio = {
            charlas: { rows: [
                { id: 'c1', who: 'Tomás', campaign: 'prueba', lines: ['¿Otra jarra?'], replies: [{ text: 'Venga.', then: 'Marchando.' }] },
                { id: 'c2', who: 'Tomás', campaign: 'otra', lines: ['Esto no sale.'] },
            ] },
            frases: { rows: [{ id: 'saludo-tomas', kind: 'saludo', when: { persona: 'Tomás' }, text: '{hola}. Pasa, que hace frío.' }] },
            companeros: { rows: [{ id: 'gerd', who: 'Gerd', campaign: 'prueba', romance: { no: 'Mejor amigos.' } }] },
        };
        const withRows = linesOf(buildScript(PACK, { campaign: 'prueba', compendio }));
        expect(withRows.get('CH:c1/1')).toMatchObject({ text: '¿Otra jarra?', src: { doc: 'charlas', path: ['rows', 0, 'lines', 0] } });
        expect(withRows.get('CH:c1/r1/dice').text).toBe('Marchando.');
        expect([...withRows.keys()].some(id => id.startsWith('CH:c2'))).toBe(false);
        expect(withRows.get('M:saludo-tomas')).toMatchObject({ pre: 'Saludo', src: { doc: 'frases', path: ['rows', 0, 'text'] } });
        expect(withRows.get('CO:gerd/romance-no').text).toBe('Mejor amigos.');
    });

    test('ids y textos en limpio', () => {
        expect(slug('Puerto Alba')).toBe('puerto-alba');
        expect(slug('Engañar')).toBe('enganar');
        expect(normalizeText('  Hola,  mundo  ')).toBe('Hola, mundo');
        expect(textHash('Hola')).toBe(textHash(' Hola '));
        expect(textHash('Hola')).not.toBe(textHash('Hola.'));
    });
});

describe('el Word, de ida y vuelta', () => {
    const script = buildScript(PACK, { date: 'hoy' });
    const parts = scriptToDocx(script, { when: '2026-10-02T00:00:00Z' });

    test('trae los archivos de un .docx', () => {
        for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels']) {
            expect(parts[name]).toMatch(/^<\?xml/);
        }
        expect(parts['word/styles.xml']).toContain('w:val="es-ES"');
    });

    test('cada párrafo vuelve tal cual, con su estilo', () => {
        const back = docxBlocks(parts['word/document.xml']);
        expect(back.map(p => normalizeText(p.text))).toEqual(script.blocks.map(b => normalizeText(blockText(b))));
        expect(back[0].style).toBe('Title');
        for (const block of script.blocks.filter(b => b.id)) {
            const read = readParagraph(blockText(block));
            expect(read).toMatchObject({ id: block.id, hash: block.hash, text: normalizeText(block.text), broken: false });
        }
    });

    test('con el control de cambios cuenta lo añadido y no lo tachado; las tabulaciones del formato no son texto', () => {
        const xml = '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="GuionLinea"/><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>'
            + '<w:r><w:t>Tomás: Hola</w:t></w:r><w:del><w:r><w:delText> viejo</w:delText></w:r></w:del><w:ins><w:r><w:t xml:space="preserve"> nuevo</w:t></w:r></w:ins>'
            + '<w:r><w:t xml:space="preserve"> &amp; </w:t></w:r><w:r><w:tab/><w:t>fin</w:t></w:r></w:p></w:body></w:document>';
        expect(docxParagraphs(xml)).toEqual(['Tomás: Hola nuevo & \tfin']);
        expect(docxBlocks(xml)[0].style).toBe('GuionLinea');
    });
});

describe('lo que se rompe al corregir', () => {
    test('una marca de género sin barra o sin cerrar no se guarda', () => {
        expect(checkEdit('Dile a {él|ella} que venga.', 'Dile a {él ella} que venga.').errors.join(' ')).toMatch(/marca de género rota/);
        expect(checkEdit('Dile a {él|ella} que venga.', 'Dile a {él|ella que venga.').errors.length).toBeGreaterThan(0);
        expect(checkEdit('Hola.', '').errors.length).toBe(1);
    });

    test('un hueco nuevo es un error; uno quitado, un aviso', () => {
        expect(checkEdit('{hola}, pasa.', '{hola}, pasa a {sitio}.').errors.join(' ')).toMatch(/hueco nuevo \{sitio\}/);
        const gone = checkEdit('{hola}, pasa.', 'Pasa.');
        expect(gone.errors).toEqual([]);
        expect(gone.warnings.join(' ')).toMatch(/\{hola\}/);
        expect(checkEdit('Estás cansado.', 'Estás cansado/a.').warnings.join(' ')).toMatch(/apaño de género/);
    });

    test('avisa si ya no nombra a alguien o si nombra a alguien nuevo', () => {
        const people = [{ name: 'Tomás', trade: 'Posadero' }, { name: 'Ana', trade: 'Herrera' }];
        const said = checkEdit('Pregúntale a Tomás.', 'Pregúntale a Ana.', { people });
        expect(said.warnings.join(' ')).toMatch(/ya no nombra a Tomás/);
        expect(said.warnings.join(' ')).toMatch(/ahora nombra a Ana/);
    });
});

describe('comparar el Word con el juego', () => {
    const script = buildScript(PACK);
    const lines = linesOf(script);
    const paragraph = (id, said) => {
        const block = lines.get(id);
        return blockText({ ...block, text: said ?? block.text });
    };

    test('lo cambiado, lo igual, lo que cambió el juego, lo que cambiasteis los dos y lo que no se encuentra', () => {
        const now = buildScript({ ...PACK, rumors: [{ ...PACK.rumors[0], text: 'Dicen que el pozo está seco.' }] });
        const review = reviewScript(now, [
            paragraph('E:primero/2', '¡Cuidado con el pozo!'),
            paragraph('E:primero/3'),
            paragraph('R:r-pozo'),
            { text: paragraph('G:tomas/sabe', 'Nada de nada.') },
            'Alguien: algo [#X:no-existe/1~abcd]',
            'Tomás sin dos puntos [#E:primero/4~abcd]',
            { text: 'Una línea nueva que escribí yo.', style: 'GuionLinea' },
            { text: 'Un título que cambió', style: 'Heading3' },
            'Cómo corregir',
        ]);
        expect(review.changed.map(c => c.id)).toEqual(['E:primero/2', 'G:tomas/sabe']);
        expect(review.changed[0]).toMatchObject({ before: '¡Cuidado con el pozo, que no tiene tapa!', after: '¡Cuidado con el pozo!' });
        expect(review.same).toBe(1);
        expect(review.newer.map(n => n.id)).toEqual(['R:r-pozo']);
        expect(review.unknown).toEqual(['X:no-existe/1']);
        expect(review.broken).toEqual(['E:primero/4']);
        expect(review.notes).toEqual([{ text: 'Una línea nueva que escribí yo.', after: 'E:primero/4' }]);
        expect(review.missing).toContain('D:ana-forja/inicio');
    });

    test('si se quita una línea de delante, cada corrección encuentra la suya por la huella', () => {
        const shorter = structuredClone(PACK);
        shorter.plot.milestones[1].beats.shift();
        const review = reviewScript(buildScript(shorter), [paragraph('E:primero/2', '¡Ojo con el pozo!'), paragraph('E:primero/3')]);
        expect(review.changed.map(c => c.id)).toEqual(['E:primero/1']);
        expect(review.changed[0].after).toBe('¡Ojo con el pozo!');
        expect(review.same).toBe(1);
        expect(review.conflicts).toEqual([]);
    });

    test('si los dos la cambiasteis, no se toca', () => {
        const now = buildScript({ ...PACK, rumors: [{ ...PACK.rumors[0], text: 'Dicen que el pozo está seco.' }] });
        const review = reviewScript(now, [paragraph('R:r-pozo', 'Dicen que el pozo tiene fondo.')]);
        expect(review.conflicts).toEqual([{ id: 'R:r-pozo', now: 'Dicen que el pozo está seco.', word: 'Dicen que el pozo tiene fondo.' }]);
        expect(review.changed).toEqual([]);
    });
});

describe('tools/guion-word.mjs', () => {
    test('cambiar un trozo de un JSON deja lo demás como estaba', () => {
        const source = '{\n    "a": { "who": "Tomás", "text": "Hola" },\n    "b": [\n        { "id": 1 }\n    ],\n    "c": {\n        "x": "1"\n    }\n}\n';
        const out = tool.editJson(source, [
            { op: 'replace', path: ['a', 'text'], expect: 'Hola', value: 'Hola, «amigo»' },
            { op: 'add', path: ['c'], key: 'y', value: 'propio: 2' },
            { op: 'add', path: ['a'], key: 'mood', value: 'alegre' },
            { op: 'append', path: ['b'], value: { id: 2 } },
        ]);
        expect(out).toBe('{\n    "a": { "who": "Tomás", "text": "Hola, «amigo»", "mood": "alegre" },\n    "b": [\n        { "id": 1 },\n        {\n          "id": 2\n        }\n    ],\n'
            + '    "c": {\n        "x": "1",\n        "y": "propio: 2"\n    }\n}\n');
        expect(() => tool.editJson(source, [{ op: 'replace', path: ['a', 'text'], expect: 'Adiós', value: 'x' }])).toThrow(/ha cambiado/);
    });

    test('exportar, corregir tres líneas y romper una: entran solo esas tres', () => {
        const dir = tempDir();
        const packFile = path.join(dir, 'prueba.json');
        fs.writeFileSync(packFile, `${JSON.stringify(PACK, null, 4)}\n`);
        const { file, script } = tool.exportScript(packFile, { out: path.join(dir, 'prueba.docx'), compendio: false });
        expect(fs.existsSync(file)).toBe(true);
        const edited = path.join(dir, 'prueba-corregido.docx');
        editDocx(file, edited, script, {
            'E:primero/2': () => '¡Ojo con el pozo, que no tiene tapa!',
            'D:ana-forja/inicio/espada': () => 'Quiero una espada buena.',
            'R:r-pozo': () => 'Dicen que en el pozo vive algo.',
            'D:ana-forja/inicio': (said) => said.replace('{forastero|forastera}', '{forastero forastera}'),
        });
        const before = fs.readFileSync(packFile, 'utf8');

        // Sin --aplicar no cambia nada.
        const dry = tool.importScript(edited, packFile, { compendio: false });
        expect(dry.ready.flatMap(entry => entry.changes).map(c => c.id).sort()).toEqual(['D:ana-forja/inicio/espada', 'E:primero/2', 'R:r-pozo']);
        expect(dry.refused.map(r => r.change.id)).toEqual(['D:ana-forja/inicio']);
        expect(dry.refused[0].error).toMatch(/marca de género rota/);
        expect(fs.readFileSync(packFile, 'utf8')).toBe(before);

        const result = tool.importScript(edited, packFile, { apply: true, compendio: false });
        expect(result.undone).toBe(false);
        expect(result.written).toEqual([packFile]);
        const after = JSON.parse(fs.readFileSync(packFile, 'utf8'));
        const was = stringsOf(PACK);
        const is = stringsOf(after);
        const changed = [...is.keys()].filter(key => was.get(key) !== is.get(key));
        expect(changed.sort()).toEqual([
            JSON.stringify(['dialogues', 0, 'nodes', 0, 'options', 0, 'text']),
            JSON.stringify(['plot', 'milestones', 1, 'beats', 1, 'text']),
            JSON.stringify(['rumors', 0, 'text']),
        ].sort());
        expect(after.rumors[0].text).toBe('Dicen que en el pozo vive algo.');
        const report = tool.describeImport(result, { file: edited, which: 'prueba', apply: true });
        expect(report).toMatch(/3 líneas cambiadas/);
        expect(report).toMatch(/marca de género rota/);
        expect(report).toMatch(/Guardado en/);
    });

    test('Strahd: cada cambio a su capa; lo del original, encima y marcado «propio:»', () => {
        const root = tempDir();
        const folder = path.join(root, 'wiki', 'campanas', 'strahd');
        fs.mkdirSync(folder, { recursive: true });
        fs.mkdirSync(path.join(root, 'public', 'mundos'), { recursive: true });
        const layers = {
            original: { world: { name: 'Barovia' }, quests: [{ id: 'q1', name: 'La llegada [cite: 1]', description: 'Llegáis a la aldea. [cite: 2]', objectives: [{ type: 'eliminate_all', label: 'Sobrevivir' }] }] },
            libro: { npcs: [{ id: 'ana', name: 'Ana', where: 'Aldea', knows: 'propio: Sabe dónde está la llave.' }] },
            mejoras: { quests: [{ id: 'q0', name: 'propio: Otra misión' }], plot: { title: 'Barovia', milestones: [{ id: 'h1', quest: 'q1', beats: [{ who: 'Ana', text: 'propio: Hola, viajeros.' }] }] } },
        };
        for (const [name, json] of Object.entries(layers)) fs.writeFileSync(path.join(folder, `${name}.json`), `${JSON.stringify(json, null, 2)}\n`);
        const pack = {
            version: 1, world: { name: 'Barovia' },
            npcs: [{ id: 'ana', name: 'Ana', where: 'Aldea', knows: 'Sabe dónde está la llave.' }],
            quests: [{ id: 'q1', name: 'La llegada', description: 'Llegáis a la aldea.', objectives: [{ type: 'eliminate_all', label: 'Sobrevivir' }] }, { id: 'q0', name: 'Otra misión' }],
            plot: {
                title: 'Barovia', endings: {}, omens: [],
                milestones: [{ id: 'h1', act: 1, title: 'La llegada', hint: 'Sobrevivir.', scene: 'Llegáis a la aldea.', beats: [{ who: 'Ana', text: 'Hola, viajeros.' }], opens: { kind: 'start' }, asks: { kind: 'none' }, changes: {} }],
            },
        };
        const packFile = path.join(root, 'public', 'mundos', 'strahd.pack.json');
        fs.writeFileSync(packFile, `${JSON.stringify(pack, null, 2)}\n`);
        const { file, script } = tool.exportScript('strahd', { out: path.join(root, 'strahd.docx'), root, compendio: false });
        const edited = path.join(root, 'strahd-corregido.docx');
        editDocx(file, edited, script, {
            'E:h1/1': () => 'Hola, viajeros. Pasad.',
            'H:h1/escena': () => 'Llegáis a la aldea con la niebla.',
            'Q:q1/objetivo1': () => 'Salir con vida',
            'G:ana/sabe': () => 'Sabe dónde está la llave de la iglesia.',
            'H:h1/pista': () => 'Sal con vida de la aldea.',
        });
        const original = fs.readFileSync(path.join(folder, 'original.json'), 'utf8');
        const made = [];
        const result = tool.importScript(edited, 'strahd', { apply: true, root, compendio: false, regenerate: (where) => { made.push(where); return { ok: true, output: 'hecho' }; } });
        expect(result.refused).toEqual([]);
        expect(result.undone).toBe(false);
        expect(made).toEqual([root]);
        const mejoras = JSON.parse(fs.readFileSync(path.join(folder, 'mejoras.json'), 'utf8'));
        const libro = JSON.parse(fs.readFileSync(path.join(folder, 'libro.json'), 'utf8'));
        expect(mejoras.plot.milestones[0].beats[0].text).toBe('propio: Hola, viajeros. Pasad.');
        expect(mejoras.plot.milestones[0].hint).toBe('propio: Sal con vida de la aldea.');
        // La escena y el objetivo salen de la misión del original: una fila encima, con los dos.
        const over = mejoras.quests.filter(q => q.id === 'q1');
        expect(over).toHaveLength(1);
        expect(over[0].description).toBe('propio: Llegáis a la aldea con la niebla.');
        expect(over[0].objectives).toEqual([{ type: 'eliminate_all', label: 'propio: Salir con vida' }]);
        expect(libro.npcs[0].knows).toBe('propio: Sabe dónde está la llave de la iglesia.');
        expect(fs.readFileSync(path.join(folder, 'original.json'), 'utf8')).toBe(original);
    });
});

describe('tools/guion-word.mjs por categorías (GuionEnWord.exe)', () => {
    const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

    test('cada línea va a su categoría; por partes sale solo lo pedido, y al volver solo cuenta y se guarda eso', () => {
        expect(tool.parseCategories('todo')).toBeNull();
        expect(tool.parseCategories('')).toBeNull();
        expect(tool.parseCategories('charlas, historia')).toEqual(['historia', 'charlas']);
        expect(() => tool.parseCategories('historia,bichos')).toThrow(/bichos/);

        const dir = tempDir();
        const packFile = path.join(dir, 'prueba.json');
        fs.writeFileSync(packFile, `${JSON.stringify(PACK, null, 4)}\n`);
        const whole = tool.exportScript(packFile, { out: path.join(dir, 'todo.docx'), compendio: false });
        const cats = tool.categoriesIn(whole.script);
        expect(cats.map(c => c.id)).toEqual(['historia', 'conversaciones', 'peleas', 'misiones', 'finales', 'sitios', 'gente', 'rumores', 'mundo']);
        expect(cats.reduce((n, c) => n + c.lines, 0)).toBe(whole.script.counts.lines);

        const part = tool.exportScript(packFile, { out: path.join(dir, 'parte.docx'), compendio: false, categories: ['historia', 'rumores'] });
        const wanted = [...linesOf(whole.script).values()].filter(b => ['historia', 'rumores'].includes(tool.categoryOf(b))).map(b => b.id);
        expect([...linesOf(part.script).keys()]).toEqual(wanted);
        expect(part.script.counts.lines).toBe(wanted.length);
        expect(part.script.blocks.some(b => b.type === 'nota' && /^Este guion trae solo: La historia, Rumores y sucesos\./.test(b.text))).toBe(true);

        // Sin tocar nada: nada cambia, no falta nada de lo que trae y no hay notas para el Gem.
        const same = tool.importScript(part.file, packFile, { compendio: false });
        expect(same.ready).toEqual([]);
        expect(same.review.missing).toEqual([]);
        expect(same.review.notes).toEqual([]);
        expect(same.present).toEqual(['historia', 'rumores']);

        // El Word entero con una línea de cada; se guarda solo la historia, con copia de antes.
        const edited = path.join(dir, 'corregido.docx');
        editDocx(whole.file, edited, whole.script, { 'E:primero/2': () => '¡Ojo con el pozo!', 'R:r-pozo': () => 'Dicen que en el pozo vive algo.' });
        const before = fs.readFileSync(packFile, 'utf8');
        const backup = path.join(dir, 'copia');
        const result = tool.importScript(edited, packFile, { apply: true, compendio: false, categories: ['historia'], backup });
        expect(result.ready.flatMap(e => e.changes).map(c => c.id)).toEqual(['E:primero/2']);
        expect(result.skipped.map(c => c.id)).toEqual(['R:r-pozo']);
        expect(result.byCategory.find(r => r.id === 'rumores')).toMatchObject({ changed: 0, skipped: 1 });
        expect(result.byCategory.find(r => r.id === 'historia')).toMatchObject({ changed: 1 });
        const after = JSON.parse(fs.readFileSync(packFile, 'utf8'));
        expect(after.plot.milestones[1].beats[1].text).toBe('¡Ojo con el pozo!');
        expect(after.rumors[0].text).toBe(PACK.rumors[0].text);
        expect(fs.readFileSync(path.join(backup, 'prueba.json'), 'utf8')).toBe(before);
        const report = tool.describeImport(result, { file: edited, which: 'prueba', apply: true });
        expect(report).toMatch(/Por categorías:/);
        expect(report).toMatch(/de categorías que no has marcado/);
        expect(report).toMatch(/Lo de antes, copiado en/);
    });

    test('una experimental (ocaso): lo corregido va a una ronda nueva y el paquete cambia solo en esas líneas', () => {
        const root = tempDir();
        for (const rel of ['wiki/guiones/ocaso', 'public/mundos/ocaso.pack.json', 'public/compendio/habilidades.json']) {
            fs.cpSync(path.join(ROOT, rel), path.join(root, rel), { recursive: true });
        }
        const { file, script } = tool.exportScript('ocaso', { out: path.join(root, 'ocaso.docx'), root, compendio: false, categories: ['rumores'] });
        const rumor = [...linesOf(script).values()].find(b => /^rumors\.\d+\.text$/.test(b.src.path.join('.')));
        const edited = path.join(root, 'ocaso-corregido.docx');
        editDocx(file, edited, script, { [rumor.id]: () => 'Dicen que la torre se ve desde el río.' });
        const packFile = path.join(root, 'public/mundos/ocaso.pack.json');
        const before = fs.readFileSync(packFile, 'utf8');
        const result = tool.importScript(edited, 'ocaso', { apply: true, root, compendio: false, backup: path.join(root, 'copia') });
        expect(result.undone).toBe(false);
        expect(path.basename(result.round)).toMatch(/^ronda-\d+-correcciones\.md$/);
        expect(fs.readFileSync(result.round, 'utf8')).toMatch(/\nrumor:\n(?: {2}#.*\n)* {2}id: '[^']+'\n {2}texto: 'Dicen que la torre se ve desde el río\.'\n/);
        const after = fs.readFileSync(packFile, 'utf8');
        expect(valueAt(JSON.parse(after), rumor.src.path)).toBe('Dicen que la torre se ve desde el río.');
        const changedRows = after.split('\n').filter((row, i) => row !== before.split('\n')[i]);
        expect(changedRows).toHaveLength(1);
        expect(fs.readFileSync(path.join(root, 'copia/public/mundos/ocaso.pack.json'), 'utf8')).toBe(before);
    });
});
