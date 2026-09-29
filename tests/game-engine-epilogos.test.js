import { describe, test, expect, jest } from '@jest/globals';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEpilogues, epiloguesOf, endingEpilogues } from '../public/scripts/game-engine/campaign/campaign-end.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { getSectionSchema, buildExamplePack, getPackRules } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

// El conversor de guiones corre aparte, y con todas las pruebas a la vez puede tardar.
jest.setTimeout(30000);

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (/** @type {string} */ path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

/**
 * El paquete de ejemplo con un hilo corto: un hito que lleva a un final.
 *
 * @param {any} ending
 * @returns {any}
 */
function withEnding(ending) {
    const pack = buildExamplePack();
    pack.npcs = [{ name: 'Tomás', trade: 'posadero', where: 'Vado de la Rueda' }];
    pack.plot = {
        milestones: [{ id: 'el-final', act: 1, title: 'El final', scene: 'Acaba.', opens: { kind: 'start' }, asks: { kind: 'none' }, changes: { ending: 'bien' } }],
        endings: { bien: ending },
    };
    return pack;
}

describe('D-J18: los epílogos de cada final', () => {
    test('se leen como los escribe el paquete o como los escribe un Gem en castellano', () => {
        expect(readEpilogues([{ quien: 'Maren', texto: 'Maren se queda.' }, 'El faro sigue.']))
            .toEqual([{ who: 'Maren', text: 'Maren se queda.' }, { who: '', text: 'El faro sigue.' }]);
        expect(epiloguesOf({ epilogos: [{ quien: 'Maren', texto: 'Maren se queda.' }] })).toEqual([{ who: 'Maren', text: 'Maren se queda.' }]);
        // Si trae los dos, manda `epilogues`.
        expect(epiloguesOf({ epilogues: ['Uno.'], epilogos: ['Otro.'] })).toEqual([{ who: '', text: 'Uno.' }]);
        expect(epiloguesOf(null)).toEqual([]);
    });

    test('el final los usa cuando los hay; si no, salen de las facciones', () => {
        const factions = [{ name: 'La Cofradía', reputation: 4 }];
        expect(endingEpilogues({ ending: { epilogos: [{ quien: 'Maren', texto: 'Maren se queda.' }] }, factions })).toEqual(['Maren se queda.']);
        expect(endingEpilogues({ ending: { title: 'Fin' }, factions })[0]).toMatch(/^Con La Cofradía quedáis como amigos/);
    });

    test('el hilo los guarda, se llamen como se llamen', () => {
        const plot = readPlot({
            milestones: [{ id: 'a', title: 'A', changes: { ending: 'bien' } }],
            endings: { bien: { title: 'Bien', scene: 'Acaba bien.', epilogos: [{ quien: 'Maren', texto: 'Maren se queda.' }] } },
        });
        expect(plot?.endings.bien.epilogues).toEqual([{ who: 'Maren', text: 'Maren se queda.' }]);
    });

    test('el contrato los pide, con de quién y qué fue de él', () => {
        const ending = getSectionSchema('plot').properties.endings.additionalProperties;
        expect(ending.properties.epilogues.items.required).toEqual(['who', 'text']);
        expect(ending.properties.epilogues.description).toMatch(/una línea por persona o facción/);
        expect(getPackRules().join(' ')).toMatch(/epilogues/);
    });

    test('el validador avisa de lo que no cuadra, sin impedir la importación', () => {
        const good = validatePack(withEnding({
            title: 'Bien', scene: 'Acaba bien.',
            epilogues: [{ who: 'Tomás', text: 'Tomás cierra la posada.' }, { who: 'La Orden de la Pluma', text: 'La Orden vigila.' }, 'Todos contentos.'],
        }));
        expect(good.ok).toBe(true);
        expect(good.warnings.filter(w => w.path.startsWith('plot.'))).toEqual([]);

        const odd = validatePack(withEnding({
            title: 'Bien', scene: 'Acaba bien.',
            epilogos: [{ quien: 'Nadie', texto: 'Se va.' }, { quien: 'Tomás' }],
        }));
        expect(odd.ok).toBe(true);
        expect(odd.warnings.filter(w => w.path.startsWith('plot.')).map(w => w.path)).toEqual([
            'plot.endings.bien.epilogos[0].who',
            'plot.endings.bien.epilogos[1]',
        ]);

        const wrong = validatePack(withEnding({ title: '', scene: '', epilogues: 'Todos contentos.' }));
        expect(wrong.warnings.filter(w => w.path.startsWith('plot.')).map(w => w.path)).toEqual(['plot.endings.bien', 'plot.endings.bien.epilogues']);

        // Un hito que lleva a un final que no existe: la campaña no acabaría.
        const lost = withEnding({ title: 'Bien', scene: 'Acaba bien.' });
        lost.plot.milestones[0].changes.ending = 'mal';
        expect(validatePack(lost).warnings.map(w => w.message).join(' ')).toMatch(/Lleva al final "mal"/);

        const broken = withEnding({ title: 'Bien', scene: 'Acaba bien.' });
        broken.plot.endings = ['bien'];
        expect(validatePack(broken).errors.map(e => e.path)).toContain('plot.endings');
    });

    test('1387, Strahd y el gremio pasan sin avisos de sus finales', () => {
        for (const id of ['1387', 'strahd', 'gremio']) {
            const report = validatePack(read(`public/mundos/${id}.pack.json`));
            expect([id, report.ok]).toEqual([id, true]);
            expect(report.warnings.filter(w => /^plot\.(endings|milestones\[\d+\]\.changes$)/.test(w.path))).toEqual([]);
        }
        const ends = Object.values(readPlot(read('public/mundos/1387.pack.json').plot)?.endings ?? {});
        expect(ends).toHaveLength(3);
        expect(ends.every(e => (e.epilogues ?? []).length >= 3)).toBe(true);
    });
});

/**
 * Pasar el conversor de guiones, como se pasa a mano.
 *
 * @param {string[]} args
 * @returns {{status: number|null, out: string}}
 */
function guion(args) {
    const run = spawnSync(process.execPath, [join(ROOT, 'tools/guion-a-paquete.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' });
    return { status: run.status, out: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/**
 * Deja un archivo como estaba, si algo lo cambió.
 *
 * @param {string} path
 * @param {string} before
 */
function restore(path, before) {
    if (readFileSync(path, 'utf8') !== before) writeFileSync(path, before);
}

describe('tools/guion-a-paquete.mjs', () => {
    test('D-J18: un final del guion trae sus epílogos, con cada uno por su nombre', () => {
        const dir = mkdtempSync(join(tmpdir(), 'guion-epilogos-'));
        try {
            writeFileSync(join(dir, 'ronda-1.md'), [
                'mundo:', '  id: prueba-epilogos', '  nombre: La prueba', '  sinopsis: "Un faro."', '  inicio: el-faro', '',
                'localidad:', '  id: el-faro', '  nombre: El Faro', '  tipo: village', '',
                'pnj:', '  id: maren', '  nombre: Maren', '  donde: el-faro', '',
                'faccion:', '  id: cofradia', '  nombre: La Cofradía', '  sede: el-faro', '',
                'hito:', '  id: empieza', '  titulo: Empieza', '  abre: al_empezar', '  pide: "llegar: el-faro"', '  cambia:', '    final: calma', '',
                'final:', '  id: calma', '  titulo: La calma', '  escena: "Todo se calma."', '  epilogos:',
                '    - { quien: maren, texto: "Maren vuelve a encender la lámpara." }',
                '    - { quien: cofradia, texto: "La Cofradía pierde el muelle." }',
                '    - "El faro sigue en pie."', '',
            ].join('\n'));
            const out = join(dir, 'paquete.json');
            const run = guion([dir, '--salida', out]);
            expect(run.out).toMatch(/el paquete de public\/mundos no se toca/);
            expect(run.out).not.toMatch(/no lee/);
            expect(JSON.parse(readFileSync(out, 'utf8')).plot.endings.calma).toEqual({
                title: 'La calma',
                scene: 'Todo se calma.',
                epilogues: [
                    { who: 'Maren', text: 'Maren vuelve a encender la lámpara.' },
                    { who: 'La Cofradía', text: 'La Cofradía pierde el muelle.' },
                    { who: '', text: 'El faro sigue en pie.' },
                ],
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('D-J37: el paquete de 1387 es la fuente, y no se pisa sin --forzar', () => {
        const path = join(ROOT, 'public/mundos/1387.pack.json');
        const before = readFileSync(path, 'utf8');
        try {
            const run = guion(['wiki/guiones/1387']);
            expect(run.status).not.toBe(0);
            expect(run.out).toMatch(/NO se escribe public\/mundos\/1387\.pack\.json: ya existe/);
            expect(run.out).toMatch(/--forzar/);
            expect(readFileSync(path, 'utf8')).toBe(before);
        } finally {
            // Si algún día deja de negarse, que la prueba no se lleve por delante el paquete.
            restore(path, before);
        }
    });
});
