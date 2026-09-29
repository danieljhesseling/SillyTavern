import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    checkWorldDensity, placeDensity, secretsOf, PLACE_NEEDS, SECRET_WAYS, QUOTA,
} from '../public/scripts/game-engine/campaign/world-density.js';
import {
    readSights, sightsOf, pickLooks, findLook, lookLabel, lookFound, DEFAULT_SIGHT_SKILL,
} from '../public/scripts/game-engine/campaign/sights.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { buildPackFromWorld } from '../public/scripts/game-engine/campaign/campaign-export.js';
import { mapRows } from '../public/scripts/game-engine/campaign/text-map.js';
import { readPlot, startPlot, plotEvent } from '../public/scripts/game-engine/campaign/plot.js';

const load = (/** @type {string} */ file) => JSON.parse(readFileSync(new URL(`../public/mundos/${file}`, import.meta.url), 'utf8'));

/** Un mundo pequeño con un sitio de cada: completo, a medias y escondido. */
const small = () => ({
    world: { name: 'Pequeño', factions: [] },
    locations: [
        {
            name: 'El Pueblo', type: 'village', services: ['posada'],
            sights: [{ text: 'el pozo', skill: 'perception', found: 'Hay una cuerda atada bajo el agua.' }],
            routes: [{ to: 'El Bosque', days: 1 }, { to: 'La Cueva', days: 1 }, { to: 'El Claro', days: 1 }],
        },
        { name: 'El Bosque', type: 'wilderness', services: [], routes: [{ to: 'El Pueblo', days: 1 }] },
        { name: 'La Cueva', type: 'dungeon', hidden: true, services: [], sights: [{ text: 'las paredes' }], routes: [{ to: 'El Pueblo', days: 1 }] },
        { name: 'El Claro', type: 'wilderness', hidden: true, services: [], routes: [{ to: 'El Pueblo', days: 1 }] },
    ],
    npcs: [
        { name: 'Ada', where: 'El Pueblo', wants: 'x', knows: 'y', secret: 'Esconde algo.' },
        { name: 'Bruno', where: 'La Cueva', wants: 'x', knows: 'y' },
    ],
    rumors: [
        { id: 'r1', by: 'Ada', where: 'El Pueblo', text: 'Hay una cueva al norte.', leadsTo: 'La Cueva' },
        { id: 'r2', by: 'Bruno', where: '', text: 'Hay un claro que nadie conoce.', leadsTo: 'El Claro' },
        { id: 'r3', by: 'Bruno', where: 'La Cueva', text: 'Aquí hace frío.', leadsTo: '' },
    ],
    boards: [],
    items: [{ name: 'Mapa viejo', boundTo: { kind: 'milestone', id: 'm-mapa' } }],
    plot: {
        milestones: [
            { id: 'm-pozo', title: 'Lo del pozo', hidden: true, opens: { kind: 'start' }, asks: { kind: 'clues', need: 1, clues: [{ place: 'El Bosque', skill: 'investigation' }] } },
            { id: 'm-mapa', title: 'El mapa', hidden: true, opens: { kind: 'contract', id: 'c1' }, asks: { kind: 'none' }, changes: { reveal: ['El Claro'] } },
        ],
    },
});

describe('J10.2: cada sitio con algo que hacer', () => {
    test('cada sitio dice lo que tiene y lo que le falta', () => {
        const rows = placeDensity(small());
        const by = Object.fromEntries(rows.map(r => [r.name, r]));
        expect(by['El Pueblo'].ok).toBe(true);
        expect(by['El Pueblo'].has).toEqual({ who: true, look: true, event: true, secret: true, board: false });
        expect(by['El Pueblo'].needsBoard).toBe(false);
        // El Bosque: nadie vive, no hay servicios ni nada que mirar escrito, pero la pista de un
        // hito se busca allí (eso es algo que mirar, un hito y un secreto).
        expect(by['El Bosque'].has).toMatchObject({ who: false, look: true, event: true, secret: true });
        expect(by['El Bosque'].missing).toEqual([PLACE_NEEDS.who]);
        // Una mazmorra sin tablero se queda corta aunque tenga todo lo demás.
        expect(by['La Cueva'].needsBoard).toBe(true);
        expect(by['La Cueva'].missing).toEqual([PLACE_NEEDS.board]);
        expect(by['El Claro'].missing).toEqual([PLACE_NEEDS.who, PLACE_NEEDS.look, PLACE_NEEDS.event]);
    });

    test('un encargo con pelea pide tablero en su sitio; uno sin pelea, no', () => {
        const pack = { ...small(), contracts: [{ id: 'c1', where: 'El Bosque', noFight: true }, { id: 'c2', where: 'El Pueblo', noFight: false, boardId: 'b' }] };
        const by = Object.fromEntries(placeDensity(pack).map(r => [r.name, r]));
        expect(by['El Bosque'].needsBoard).toBe(false);
        expect(by['El Pueblo'].needsBoard).toBe(true);
        expect(by['El Pueblo'].missing).toEqual([PLACE_NEEDS.board]);
        const drawn = { ...pack, boards: [{ id: 'b', name: 'La plaza', locationName: 'El Pueblo', map: [], enemies: [] }] };
        expect(placeDensity(drawn).find(r => r.name === 'El Pueblo')?.ok).toBe(true);
    });

    test('el informe cuenta los sitios y dice cuál se queda corto', () => {
        const report = checkWorldDensity(small());
        expect(report.counts).toContain('✗ Localizaciones con algo que hacer: 1 de 4 (todas)');
        expect(report.errors).toEqual(expect.arrayContaining([
            '«El Bosque» se queda corta: le falta gente o servicios',
            '«El Claro» se queda corta: le falta gente o servicios, algo que mirar y un rumor o un hito',
        ]));
        expect(report.places).toHaveLength(4);
        // Lo de siempre sigue ahí: el listón del mundo entero.
        expect(report.counts[0]).toMatch(/^✗ Hitos del hilo: 2/);
    });
});

describe('J10.4: los secretos y cómo se descubren', () => {
    test('un rumor, una persona, una tirada o un mapa; lo del hilo no es un secreto', () => {
        const secrets = secretsOf(small());
        expect(secrets).toEqual([
            { what: 'La Cueva', kind: 'sitio', ways: ['rumor'], where: ['El Pueblo'] },
            { what: 'El Claro', kind: 'sitio', ways: ['persona', 'objeto'], where: ['La Cueva'] },
            { what: 'Lo del pozo', kind: 'cosa', ways: ['tirada'], where: ['El Bosque'] },
        ]);
        const story = { ...small(), rumors: [], items: [], plot: { milestones: [{ id: 'h', title: 'Capítulo', opens: { kind: 'start' }, asks: { kind: 'none' }, changes: { reveal: ['El Claro', 'La Cueva'] } }] } };
        expect(secretsOf(story)).toEqual([]);
    });

    test('un rumor que solo se oye en el sitio al que lleva no descubre nada', () => {
        const pack = { ...small(), rumors: [{ id: 'x', where: 'La Cueva', text: 'Aquí.', leadsTo: 'La Cueva' }], plot: { milestones: [] }, items: [] };
        expect(secretsOf(pack)).toEqual([]);
    });

    test('el listón pide tres secretos y tres formas de descubrirlos', () => {
        expect(QUOTA.secrets).toBe(3);
        expect(QUOTA.secretWays).toBe(3);
        const report = checkWorldDensity(small());
        expect(report.counts).toContain('✓ Secretos: 3 (mínimo 3)');
        expect(report.counts).toContain(`✓ Formas de descubrir un secreto: ${['rumor', 'persona', 'objeto', 'tirada'].map(w => SECRET_WAYS[/** @type {keyof typeof SECRET_WAYS} */ (w)]).join(', ')} (mínimo 3)`);
        const poor = checkWorldDensity({ ...small(), rumors: [], plot: { milestones: [] } });
        expect(poor.errors).toEqual(expect.arrayContaining(['Secretos: 0, y el listón pide 3']));
    });

    test('la tirada de examinar en su sitio encuentra el secreto escondido con una pista', () => {
        const plot = /** @type {any} */ (readPlot({ milestones: [
            { id: 'a', title: 'La mecha', opens: { kind: 'start' }, asks: { kind: 'arrive', place: 'Lejos' } },
            ...small().plot.milestones,
        ] }));
        const start = startPlot(plot);
        const elsewhere = plotEvent(plot, start.state, { kind: 'check', skill: 'investigation', success: true, place: 'El Pueblo' });
        expect(elsewhere.done).toEqual([]);
        const found = plotEvent(plot, start.state, { kind: 'check', skill: DEFAULT_SIGHT_SKILL, success: true, place: 'El Bosque' });
        expect(found.done.map((/** @type {any} */ m) => m.id)).toEqual(['m-pozo']);
    });
});

describe('J10.2: lo que se puede mirar (sights.js)', () => {
    test('se leen limpias, con la tirada de examinar si la suya no existe', () => {
        const rows = readSights([
            { text: 'el pozo', skill: 'perception', found: 'Una cuerda.' },
            { verbo: 'leer', text: 'el cartel', skill: 'volar' },
            { skill: 'perception' },
            'la puerta',
        ], 'El Pueblo de Barro');
        expect(rows).toEqual([
            { id: 'sitio-el-pueblo-de-barro-1', kind: 'mirar', verbo: 'examinar', text: 'el pozo', skill: 'perception', found: 'Una cuerda.', own: true },
            { id: 'sitio-el-pueblo-de-barro-2', kind: 'mirar', verbo: 'leer', text: 'el cartel', skill: DEFAULT_SIGHT_SKILL, found: '', own: true },
            { id: 'sitio-el-pueblo-de-barro-4', kind: 'mirar', verbo: 'examinar', text: 'la puerta', skill: DEFAULT_SIGHT_SKILL, found: '', own: true },
        ]);
        expect(readSights(null)).toEqual([]);
        expect(sightsOf({ name: 'Ñandú', sights: [{ id: 'mio', text: 'x' }] })[0].id).toBe('mio');
    });

    test('se ofrecen antes que las del compendio, y lo examinado hoy no vuelve', () => {
        const sights = readSights([{ text: 'el pozo' }, { text: 'la puerta' }], 'A');
        const rows = [{ id: 'mirar-callejones', verbo: 'mirar', text: 'los callejones' }];
        const first = () => 0.5;
        expect(pickLooks({ sights, rows, random: first, here: 'A' }).map(r => r.id)).toEqual(['sitio-a-1', 'sitio-a-2']);
        expect(pickLooks({ sights, rows, random: first, here: 'A', looked: ['A|sitio-a-1'] }).map(r => r.id)).toEqual(['sitio-a-2']);
        expect(pickLooks({ sights: [], rows, random: first, here: 'A' }).map(r => r.id)).toEqual(['mirar-callejones']);
        expect(findLook('sitio-a-2', { sights, rows })?.text).toBe('la puerta');
        expect(findLook('mirar-callejones', { sights, rows })?.text).toBe('los callejones');
        expect(findLook('nada', { sights, rows })).toBeNull();
        expect(lookLabel(sights[0])).toBe('Examinar el pozo');
        expect(lookFound({ found: 'Una cuerda.' }, true)).toBe('Una cuerda.');
        expect(lookFound({ found: 'Una cuerda.' }, false)).toBe('');
    });

    test('el validador avisa de lo mal escrito, el importador lo lleva al mundo y el exportador lo devuelve', () => {
        const pack = load('1387.pack.json');
        const broken = { ...pack, locations: [{ ...pack.locations[0], sights: [{ skill: 'perception' }, { text: 'x', skill: 'volar' }] }, ...pack.locations.slice(1)] };
        const paths = validatePack(broken).warnings.map(w => w.path);
        expect(paths).toEqual(expect.arrayContaining(['locations[0].sights[0]', 'locations[0].sights[1].skill']));

        const plan = buildImportPlan(pack);
        const town = plan.metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'El Pueblo de Barro');
        expect(town.sights.length).toBeGreaterThanOrEqual(2);
        expect(town.sights[0]).toMatchObject({ id: 'sitio-el-pueblo-de-barro-1', verbo: 'examinar', skill: 'investigation' });
        const hidden = plan.metadata.hiddenLocations.find((/** @type {any} */ l) => l.name === 'La Choza de Brígida');
        expect(hidden.sights).toHaveLength(2);

        const back = buildPackFromWorld({ worldName: 'x', metadata: plan.metadata, entries: {} });
        expect(back.locations.find((/** @type {any} */ l) => l.name === 'El Pueblo de Barro').sights).toEqual(town.sights);
    });

    test('el mapa en texto no enseña caminos a sitios que todavía están escondidos', () => {
        const plan = buildImportPlan(load('1387.pack.json'));
        const rows = mapRows({ locations: plan.metadata.locationMaps, here: 'El Camino Viejo' });
        const road = rows.find(r => r.name === 'El Camino Viejo');
        expect(road?.routes.map(r => r.to)).toEqual(['El Pueblo de Barro']);
    });
});

describe('las dos campañas escritas pasan el medidor ampliado', () => {
    for (const file of ['1387.pack.json', 'strahd.pack.json']) {
        test(`${file}: cada sitio pasa, con tres razones para ir, y hay secretos por tres vías`, () => {
            const report = checkWorldDensity(load(file));
            expect(report.errors).toEqual([]);
            expect(report.places.filter(p => !p.ok).map(p => p.name)).toEqual([]);
            // J10: al menos tres razones distintas para ir a cada sitio.
            expect(report.places.every(p => p.reasons >= 3)).toBe(true);
            // J10.4: tres secretos nuevos por lo menos, cada uno por una vía distinta.
            const ways = new Set(report.secrets.flatMap(s => s.ways));
            expect(['rumor', 'persona', 'tirada'].every(w => ways.has(w))).toBe(true);
        });
    }

    test('1387: los cuatro secretos de J10.4, cada uno por su vía', () => {
        const secrets = secretsOf(load('1387.pack.json'));
        const way = (/** @type {string} */ what) => secrets.find(s => s.what === what)?.ways;
        expect(way('El Roble de los Recados')).toEqual(['rumor']);
        expect(way('La Choza de Brígida')).toEqual(['persona']);
        expect(way('Lo que esconde el hielo')).toEqual(['tirada']);
        expect(way('Los Baños Viejos')).toEqual(['objeto']);
    });

    test('Strahd: los tres secretos de J10.4, cada uno por su vía', () => {
        const secrets = secretsOf(load('strahd.pack.json'));
        const way = (/** @type {string} */ what) => secrets.find(s => s.what === what)?.ways;
        expect(way('La Cascada del Tser')).toEqual(['rumor']);
        expect(way('El Nido de la Pluma')).toEqual(['persona']);
        expect(way('La puerta sin pomo')).toEqual(['tirada']);
    });
});
