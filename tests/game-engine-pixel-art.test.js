import { describe, test, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    slugify, classIdOf, genderFileOf, readManifest, artFor, firstArt, isPlainFace, buildPixelManifest, packOfWorld,
    setPixelManifest, loadPixelManifest, pixelManifest, PIXEL_BASE, boardBiome, terrainTile, hazardTile, enemyArt,
    pastimePlace, bridgeTiles, cliffFace, CLIFF_FACE,
    PORTRAIT_MOODS,
} from '../public/scripts/game-engine/ui/pixel-art.js';
import { terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';
import { pixelManifestText } from '../tools/pixel-manifest.mjs';
import { jailScene, guardOf } from '../public/scripts/game-engine/campaign/jail.js';

/** Un índice pequeño, con lo justo para cada tipo. */
const small = readManifest({
    files: [
        'clases/guerrero.png', 'clases/picaro.png',
        'especies/raza-humano.png', 'especies/raza-tiefling.png',
        'retratos/heroes/guerrero-hombre.png', 'retratos/heroes/guerrero-mujer.png', 'retratos/heroes/picaro-hombre.png',
        'retratos/heroes/raza-humano-guerrero-mujer.png', 'objetos/strahd/icono-de-ravenloft.png',
        'retratos/gremio/brunilda.png', 'retratos/gremio/brunilda--enfadado.png', 'retratos/1387/el-tabernero-giles.png', 'retratos/strahd/ireena-kolyana.png',
        'retratos/mercenarios/gerd-el-mellado.png',
        'bestias/bestia-lobo.png', 'bestias/rata-de-bodega.png', 'bestias/lobo-gris.png', 'bestias/plantilla-viejo.png',
        'armas/forma-espada-larga.png', 'armas/forma-espada-corta.png', 'armaduras/forma-cota-malla.png',
        'habilidades/hab-embate.png', 'conjuros/hab-curar.png', 'estados/hoja-corte.png',
        'escenarios/gremio/puerto-alba.png', 'escenarios/gremio/puerto-alba-noche.png', 'escenarios/strahd/aldea-de-barovia.png',
        'sitios/taberna.png', 'sitios/taberna-noche.png', 'sitios/plaza.png',
    ],
    aliases: {
        especies: { humano: 'raza-humano', tiflin: 'raza-tiefling' },
        'retratos/1387': { giles: 'el-tabernero-giles' },
        bestias: { lobo: 'bestia-lobo' },
        armas: { 'espada-larga': 'forma-espada-larga', 'espada-corta': 'forma-espada-corta' },
        armaduras: { 'cota-de-malla': 'forma-cota-malla' },
        habilidades: { embate: 'hab-embate' },
        conjuros: { curar: 'hab-curar' },
        estados: { 'corte-limpio': 'hoja-corte' },
    },
});

const url = (/** @type {string} */ path) => `${PIXEL_BASE}${path}`;

const PIXEL_DIR = fileURLToPath(new URL('../public/img/game-engine/pixel/', import.meta.url));

/**
 * Los PNG de una carpeta y de las de dentro, relativos y con `/`.
 *
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function pngsIn(dir, prefix = '') {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return pngsIn(join(dir, entry.name), path);
        return entry.name.endsWith('.png') ? [path] : [];
    });
}

/**
 * La gente de un paquete que tiene retrato en la carpeta y no se encuentra por su nombre.
 *
 * @param {import('../public/scripts/game-engine/ui/pixel-art.js').PixelManifest} manifest
 * @param {string} pack
 * @returns {string[]}
 */
function lostPortraits(manifest, pack) {
    const data = JSON.parse(readFileSync(new URL(`../public/mundos/${pack}.pack.json`, import.meta.url), 'utf8'));
    const people = [...(data.npcs ?? []), ...(data.confidants ?? [])];
    const drawn = (/** @type {any} */ p) => manifest.files.has(`retratos/${pack}/${slugify(p.id)}.png`) || manifest.files.has(`retratos/${pack}/${slugify(p.name)}.png`);
    return people.filter(p => drawn(p) && !firstArt('portrait', { name: p.name, pack }, manifest)).map(p => `${pack}: ${p.name}`);
}

/**
 * La gente de un paquete con retrato a la que le falta un gesto (o no se le encuentra por su nombre).
 *
 * @param {import('../public/scripts/game-engine/ui/pixel-art.js').PixelManifest} manifest
 * @param {string} pack
 * @returns {string[]}
 */
function missingMoods(manifest, pack) {
    const data = JSON.parse(readFileSync(new URL(`../public/mundos/${pack}.pack.json`, import.meta.url), 'utf8'));
    const people = [...(data.npcs ?? []), ...(data.confidants ?? [])];
    return people.flatMap(p => {
        const base = [slugify(p.id), slugify(p.name)].find(b => b && manifest.files.has(`retratos/${pack}/${b}.png`));
        if (!base) return [];
        return ['alegre', 'enfadado', 'triste']
            .filter(mood => firstArt('portrait', { name: p.name, pack, mood }, manifest) !== `${PIXEL_BASE}retratos/${pack}/${base}--${mood}.png`)
            .map(mood => `${pack}: ${p.name} (${mood})`);
    });
}

/**
 * Las carpetas de retratos que son de un paquete del juego (`public/mundos/`). Las de tus campañas
 * (`tuya-…`, los Gems al día) tienen su paquete entre tus archivos, no aquí.
 *
 * @param {import('../public/scripts/game-engine/ui/pixel-art.js').PixelManifest} manifest
 * @returns {string[]}
 */
function gamePacks(manifest) {
    return manifest.packs.filter(pack => existsSync(new URL(`../public/mundos/${pack}.pack.json`, import.meta.url)));
}

afterEach(() => setPixelManifest(null));

// Los gestos están apagados en el juego (2026-10-03: todos neutros por ahora). Estas pruebas
// miran que el arte de los gestos sigue ahí y se encuentra, así que los encienden.
beforeAll(() => { PORTRAIT_MOODS.on = true; });
afterAll(() => { PORTRAIT_MOODS.on = false; });

describe('los gestos, apagados por ahora', () => {
    test('con el interruptor apagado, pedir un gesto da el retrato neutro', () => {
        const manifest = readManifest({ version: 1, files: ['retratos/gremio/brunilda.png', 'retratos/gremio/brunilda--enfadado.png'] });
        PORTRAIT_MOODS.on = false;
        try {
            expect(firstArt('portrait', { name: 'Brunilda', pack: 'gremio', mood: 'enfadado' }, manifest)).toMatch(/brunilda\.png$/);
        } finally {
            PORTRAIT_MOODS.on = true;
        }
        expect(firstArt('portrait', { name: 'Brunilda', pack: 'gremio', mood: 'enfadado' }, manifest)).toMatch(/brunilda--enfadado\.png$/);
    });
});

describe('el nombre de un archivo', () => {
    test('minúsculas ASCII, sin tildes, la ñ es n, y guiones entre palabras', () => {
        expect(slugify('Madre Elvira')).toBe('madre-elvira');
        expect(slugify('el-intendente-norteño')).toBe('el-intendente-norteno');
        expect(slugify('Arthur «Doc»')).toBe('arthur-doc');
        expect(slugify('Ezmerelda d’Avenir')).toBe('ezmerelda-d-avenir');
        expect(slugify('  Sombra, el espía  ')).toBe('sombra-el-espia');
        expect(slugify('Bodega El Mago de los Vinos')).toBe('bodega-el-mago-de-los-vinos');
        expect(slugify(null)).toBe('');
    });

    test('la clase, en masculino o en femenino', () => {
        expect(classIdOf('Guerrero')).toBe('guerrero');
        expect(classIdOf('Pícara')).toBe('picaro');
        expect(classIdOf('Maga')).toBe('mago');
        expect(classIdOf('Clériga')).toBe('clerigo');
        expect(classIdOf('Exploradora')).toBe('explorador');
        expect(classIdOf('guerrero')).toBe('guerrero');
        expect(classIdOf('Magistrado')).toBe('');
        expect(classIdOf('')).toBe('');
    });

    test('hombre o mujer: lo que se dijo, y si no, el nombre', () => {
        expect(genderFileOf('Mujer', 'Bram')).toBe('mujer');
        expect(genderFileOf('Hombre', 'Tessa')).toBe('hombre');
        expect(genderFileOf('No binario', 'Tessa')).toBe('mujer');
        expect(genderFileOf('', 'Bram')).toBe('hombre');
    });

    test('la cara por defecto de SillyTavern es no tener cara', () => {
        expect(isPlainFace('img/user-default.png')).toBe(true);
        expect(isPlainFace('')).toBe(true);
        expect(isPlainFace('/user/images/tessa.png')).toBe(false);
    });
});

describe('qué imagen le toca a cada cosa', () => {
    test('sin índice no se pide nada', () => {
        expect(artFor('class', { name: 'Guerrero' })).toEqual([]);
        expect(firstArt('class', { name: 'Guerrero' })).toBe('');
    });

    test('solo archivos que existen', () => {
        expect(artFor('class', { name: 'Pícara' }, small)).toEqual([url('clases/picaro.png')]);
        expect(artFor('class', { name: 'Mago' }, small)).toEqual([]);
        expect(artFor('class', { id: 'guerrero', name: 'Guerrera' }, small)).toEqual([url('clases/guerrero.png')]);
    });

    test('la especie, por su id, por su nombre o en femenino', () => {
        expect(firstArt('race', { id: 'raza-humano' }, small)).toBe(url('especies/raza-humano.png'));
        expect(firstArt('race', { name: 'Tiflin' }, small)).toBe(url('especies/raza-tiefling.png'));
        expect(firstArt('race', { name: 'Humana' }, small)).toBe(url('especies/raza-humano.png'));
        expect(firstArt('race', { name: 'Dracónido' }, small)).toBe('');
    });

    test('el héroe sin cara: su clase y cómo se presenta, y si no, la otra', () => {
        expect(artFor('hero', { className: 'Guerrero', gender: 'Mujer' }, small))
            .toEqual([url('retratos/heroes/guerrero-mujer.png'), url('retratos/heroes/guerrero-hombre.png')]);
        expect(firstArt('hero', { classId: 'picaro', gender: 'Mujer' }, small)).toBe(url('retratos/heroes/picaro-hombre.png'));
        // Con su especie, si hay retrato de esa especie.
        expect(firstArt('hero', { className: 'Guerrero', gender: 'Mujer', race: 'Humana' }, small)).toBe(url('retratos/heroes/raza-humano-guerrero-mujer.png'));
        expect(firstArt('hero', { className: 'Guerrero', gender: 'Mujer', race: 'Tiflin' }, small)).toBe(url('retratos/heroes/guerrero-mujer.png'));
        expect(firstArt('hero', { className: 'Viajero' }, small)).toBe('');
    });

    test('la gente de un paquete, por su nombre, y en ese paquete', () => {
        expect(firstArt('portrait', { name: 'Brunilda', pack: 'gremio' }, small)).toBe(url('retratos/gremio/brunilda.png'));
        // Con su gesto si lo tiene dibujado; si no, el de siempre.
        expect(firstArt('portrait', { name: 'Brunilda', pack: 'gremio', mood: 'enfadado' }, small)).toBe(url('retratos/gremio/brunilda--enfadado.png'));
        expect(firstArt('portrait', { name: 'Brunilda', pack: 'gremio', mood: 'triste' }, small)).toBe(url('retratos/gremio/brunilda.png'));
        expect(firstArt('portrait', { name: 'Giles', pack: '1387' }, small)).toBe(url('retratos/1387/el-tabernero-giles.png'));
        expect(firstArt('portrait', { name: 'Giles', pack: 'strahd' }, small)).toBe('');
        // Sin saber el paquete, se busca en todos.
        expect(firstArt('portrait', { name: 'Ireena Kolyana' }, small)).toBe(url('retratos/strahd/ireena-kolyana.png'));
        // Los mercenarios, en cualquier paquete.
        expect(firstArt('portrait', { name: 'Gerd el Mellado', pack: 'strahd' }, small)).toBe(url('retratos/mercenarios/gerd-el-mellado.png'));
    });

    test('un bicho: por su nombre, sin el número, o por el arquetipo que se lee en él', () => {
        expect(firstArt('creature', { name: 'Rata de bodega' }, small)).toBe(url('bestias/rata-de-bodega.png'));
        expect(firstArt('creature', { name: 'Rata de bodega 2' }, small)).toBe(url('bestias/rata-de-bodega.png'));
        expect(firstArt('creature', { name: 'Lobo gris' }, small)).toBe(url('bestias/lobo-gris.png'));
        expect(firstArt('creature', { name: 'Lobo viejo' }, small)).toBe(url('bestias/bestia-lobo.png'));
        expect(firstArt('creature', { name: 'Cosa rara', archetype: 'bestia-lobo' }, small)).toBe(url('bestias/bestia-lobo.png'));
        expect(firstArt('creature', { name: 'Lobezno' }, small)).toBe('');
        expect(firstArt('template', { id: 'plantilla-viejo' }, small)).toBe(url('bestias/plantilla-viejo.png'));
    });

    test('un objeto: por su id o por la forma que se lee en su nombre, la más larga', () => {
        expect(firstArt('item', { id: 'forma-cota-malla' }, small)).toBe(url('armaduras/forma-cota-malla.png'));
        expect(firstArt('item', { name: 'Espada larga de acero afilada' }, small)).toBe(url('armas/forma-espada-larga.png'));
        expect(firstArt('item', { name: 'Cota de malla' }, small)).toBe(url('armaduras/forma-cota-malla.png'));
        expect(firstArt('item', { name: 'Poción de curación' }, small)).toBe('');
        // Los de un paquete, por su nombre.
        expect(firstArt('item', { name: 'Icono de Ravenloft' }, small)).toBe(url('objetos/strahd/icono-de-ravenloft.png'));
        expect(firstArt('item', { name: 'Icono de Ravenloft', pack: '1387' }, small)).toBe('');
    });

    test('habilidades, conjuros y estados, por id o por nombre', () => {
        expect(firstArt('ability', { name: 'Embate' }, small)).toBe(url('habilidades/hab-embate.png'));
        expect(firstArt('ability', { id: 'hab-curar' }, small)).toBe(url('conjuros/hab-curar.png'));
        expect(firstArt('spell', { name: 'Curar' }, small)).toBe(url('conjuros/hab-curar.png'));
        expect(firstArt('condition', { name: 'Corte limpio' }, small)).toBe(url('estados/hoja-corte.png'));
    });

    test('los escenarios y los sitios, de noche si la hay', () => {
        expect(artFor('scene', { name: 'Puerto Alba', pack: 'gremio', night: true }, small))
            .toEqual([url('escenarios/gremio/puerto-alba-noche.png'), url('escenarios/gremio/puerto-alba.png')]);
        expect(firstArt('scene', { name: 'Puerto Alba', pack: 'gremio' }, small)).toBe(url('escenarios/gremio/puerto-alba.png'));
        expect(firstArt('scene', { name: 'Aldea de Barovia' }, small)).toBe(url('escenarios/strahd/aldea-de-barovia.png'));
        expect(firstArt('scene', { name: 'Aldea de Barovia', pack: 'gremio' }, small)).toBe('');
        expect(firstArt('place', { id: 'taberna', night: true }, small)).toBe(url('sitios/taberna-noche.png'));
        expect(firstArt('place', { id: 'plaza', night: true }, small)).toBe(url('sitios/plaza.png'));
        // Un servicio lleva a su sitio: la posada es la taberna.
        expect(firstArt('place', { id: 'posada' }, small)).toBe(url('sitios/taberna.png'));
    });

    test('una fila del compendio, por su batería', () => {
        expect(firstArt('compendium', { domain: 'razas', id: 'raza-tiefling', name: 'Tiflin' }, small)).toBe(url('especies/raza-tiefling.png'));
        expect(firstArt('compendium', { domain: 'bestiario', id: 'bestia-lobo' }, small)).toBe(url('bestias/bestia-lobo.png'));
        expect(firstArt('compendium', { domain: 'personas', id: 'rasgo-terco' }, small)).toBe('');
    });

    test('el índice se lee una vez, y si no se puede, queda vacío', async () => {
        let calls = 0;
        const fetcher = async () => {
            calls++;
            return { ok: true, json: async () => ({ files: ['clases/guerrero.png'] }) };
        };
        await loadPixelManifest(fetcher);
        await loadPixelManifest(fetcher);
        expect(calls).toBe(1);
        expect(firstArt('class', { name: 'Guerrero' })).toBe(url('clases/guerrero.png'));

        setPixelManifest(null);
        const broken = await loadPixelManifest(async () => { throw new Error('sin red'); });
        expect(broken.files.size).toBe(0);
        expect(pixelManifest()).toBe(broken);
    });
});

describe('el índice', () => {
    test('los alias: solo a archivos que existen, sin repetir el nombre y sin las plantillas', () => {
        const built = buildPixelManifest({
            files: ['especies/raza-tiefling.png', 'bestias/bestia-lobo.png', 'bestias/plantilla-viejo.png', 'retratos/1387/el-intendente-norteno.png', 'retratos/gremio/brunilda.png'],
            domains: {
                razas: [{ id: 'raza-tiefling', name: 'Tiflin' }, { id: 'raza-draconido', name: 'Dracónido' }],
                bestiario: [{ id: 'bestia-lobo', name: 'Lobo', kind: 'arquetipo' }, { id: 'plantilla-viejo', name: 'viejo', kind: 'plantilla' }],
            },
            packs: {
                1387: { npcs: [{ id: 'el-intendente-norteño', name: 'Ulric' }] },
                gremio: { npcs: [{ id: 'brunilda', name: 'Brunilda' }] },
            },
        });
        expect(built.files).toEqual([...built.files].sort());
        expect(built.aliases).toEqual({
            bestias: { lobo: 'bestia-lobo' },
            especies: { tiflin: 'raza-tiefling' },
            'retratos/1387': { ulric: 'el-intendente-norteno' },
        });
    });

    test('el escrito está al día con la carpeta (si no: node tools/pixel-manifest.mjs)', async () => {
        const written = readFileSync(new URL('../public/img/game-engine/pixel/manifest.json', import.meta.url), 'utf8');
        expect(written).toBe(await pixelManifestText());
    });

    test('lista cada PNG de la carpeta', () => {
        const manifest = JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8'));
        expect(manifest.files).toEqual(pngsIn(PIXEL_DIR).sort());
    });

    test('cada persona de los paquetes con retrato se encuentra por su nombre', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        expect(gamePacks(manifest).flatMap(pack => lostPortraits(manifest, pack))).toEqual([]);
    });

    test('quien tiene retrato en un paquete tiene también sus tres gestos, y se encuentran por su nombre', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        expect(gamePacks(manifest).flatMap(pack => missingMoods(manifest, pack))).toEqual([]);
    });

    test('la gente nueva de 1387 y Strahd ya tiene cara, con su gesto', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        expect(firstArt('portrait', { name: 'Brígida', pack: '1387', mood: 'enfadado' }, manifest)).toBe(url('retratos/1387/brigida--enfadado.png'));
        expect(firstArt('portrait', { name: 'El ermitaño de la cascada', pack: 'strahd' }, manifest)).toBe(url('retratos/strahd/ermitano-cascada.png'));
        expect(firstArt('portrait', { name: 'Dragomir', mood: 'triste' }, manifest)).toBe(url('retratos/strahd/dragomir-nido--triste.png'));
    });

    test('el icono de la app está en su sitio, en los tres tamaños y el «maskable»', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        for (const size of ['192', '400', '512', 'maskable-512']) expect(manifest.files.has(`app/icono-${size}.png`)).toBe(true);
    });
});

describe('el arte de lo nuevo: nada sale con ☠ ni sin fondo', () => {
    const PACKS = ['1387', 'strahd', 'gremio'];
    const pack = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));
    const real = () => readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));

    test('cada bicho de los paquetes y de las misiones personales tiene su dibujo en el tablero', () => {
        const manifest = real();
        const personal = JSON.parse(readFileSync(new URL('../public/compendio/personales.json', import.meta.url), 'utf8'));
        const names = [
            ...PACKS.flatMap(id => {
                const data = pack(id);
                return [...(data.bestiary ?? []).map((/** @type {any} */ b) => b.name),
                    ...(data.boards ?? []).flatMap((/** @type {any} */ b) => (b.enemies ?? []).map((/** @type {any} */ e) => e.name))];
            }),
            ...personal.rows.flatMap((/** @type {any} */ r) => (r.steps ?? []).flatMap((/** @type {any} */ s) => [
                ...(s.bestiary ?? []).map((/** @type {any} */ b) => b.name), ...(s.board?.enemies ?? []).map((/** @type {any} */ e) => e.name)])),
        ];
        expect([...new Set(names)].filter(name => !firstArt('creature', { name }, manifest))).toEqual([]);
        // Los que salían con ☠ (las misiones de Gerd y Nella) y los del gremio, con el suyo y no el genérico.
        expect(firstArt('creature', { name: 'Cuñado de Lope 2' }, manifest)).toBe(url('bestias/cunado-de-lope.png'));
        expect(firstArt('creature', { name: 'Guarda del barón' }, manifest)).toBe(url('bestias/guarda-del-baron.png'));
        expect(firstArt('creature', { name: 'Zombi ahogado 3' }, manifest)).toBe(url('bestias/zombi-ahogado.png'));
        expect(firstArt('creature', { name: 'Lobo de las salinas' }, manifest)).toBe(url('bestias/lobo-de-las-salinas.png'));
    });

    test('cada localización de los paquetes tiene su escenario, con o sin el paquete dicho', () => {
        const manifest = real();
        const lost = PACKS.flatMap(id => (pack(id).locations ?? [])
            .filter((/** @type {any} */ l) => !firstArt('scene', { name: l.name, pack: id }, manifest))
            .map((/** @type {any} */ l) => `${id}: ${l.name}`));
        expect(lost).toEqual([]);
        expect(firstArt('scene', { name: 'Los Baños Viejos', pack: '1387' }, manifest)).toBe(url('escenarios/1387/los-banos-viejos.png'));
        expect(firstArt('scene', { name: 'El Nido de la Pluma' }, manifest)).toBe(url('escenarios/strahd/el-nido-de-la-pluma.png'));
        // De noche, el de día: las de alrededor de Puerto Alba tienen uno solo.
        expect(firstArt('scene', { name: 'El faro viejo', pack: 'gremio', night: true }, manifest)).toBe(url('escenarios/gremio/el-faro-viejo.png'));
    });

    test('el calabozo (D-J47): la celda detrás, y la guardia sin nombre con cara en los tres paquetes', () => {
        const manifest = real();
        const hero = { id: 'h1', name: 'Ana', gender: 'Mujer' };
        const scene = jailScene({
            town: 'Puerto Alba', guard: guardOf({ npcs: pack('gremio').npcs, town: 'Puerto Alba' }), thief: hero, hero,
            days: 2, fine: 5, paid: true, taken: ['una daga'], releaseDay: 4,
        });
        expect(scene.backdrop.place).toBe('calabozo');
        expect(firstArt('place', { id: scene.backdrop.place, night: true }, manifest)).toBe(url('sitios/calabozo.png'));
        expect(scene.beats[1].who).toBe('Un guardia');
        for (const id of PACKS) expect(firstArt('portrait', { name: 'Un guardia', pack: id, mood: 'enfadado' }, manifest)).toBe(url(`retratos/${id}/un-guardia.png`));
    });

    test('cada villano de las historias en tres actos tiene su propio dibujo, de jefe en el tablero y en sus escenas', () => {
        const manifest = real();
        const actos = JSON.parse(readFileSync(new URL('../public/compendio/actos.json', import.meta.url), 'utf8'));
        const villains = actos.rows.filter((/** @type {any} */ r) => r.kind === 'trama').flatMap((/** @type {any} */ r) => r.villanos ?? []);
        expect(villains.length).toBeGreaterThan(20);
        // Como lo nombra `act-grammar.js`: con mayúscula delante («El Hombre del Farol»).
        const own = (/** @type {string} */ name) => firstArt('creature', { name: name.charAt(0).toUpperCase() + name.slice(1) }, manifest);
        expect(villains.filter((/** @type {string} */ v) => !own(v).endsWith(`bestias/${slugify(v)}.png`) && v !== 'el Gran Lobo Gris')).toEqual([]);
        // El Zorro de Ceniza es un ladrón, no el zorro del bestiario.
        expect(own('el Zorro de Ceniza')).toBe(url('bestias/el-zorro-de-ceniza.png'));
        expect(own('el Gran Lobo Gris')).toBe(url('bestias/bestia-lobo.png'));
    });

    test('el rival de un duelo que es alguien del paquete sale con su retrato, no con el bandido de su arquetipo', () => {
        const manifest = real();
        const peleas = JSON.parse(readFileSync(new URL('../public/compendio/peleas.json', import.meta.url), 'utf8'));
        const PACK_OF = { 'Izek Strazni': 'strahd', 'Szoldar Szoldarovich': 'strahd', Luvash: 'strahd', Garret: '1387', Darek: '1387', Hilda: '1387', Ramiro: 'gremio' };
        for (const row of peleas.rows.filter((/** @type {any} */ r) => r.kind === 'retador')) {
            const pack = /** @type {Record<string, string>} */ (PACK_OF)[row.name];
            expect([row.name, enemyArt({ name: row.name, archetype: 'bestia-bandido', pack }, manifest)]).toEqual([row.name, expect.stringContaining(`retratos/${pack}/`)]);
        }
        // Sin paquete abierto, el del arquetipo; y quien tiene su bicho propio, el bicho.
        expect(enemyArt({ name: 'Ramiro', archetype: 'bestia-bandido' }, manifest)).toBe(url('bestias/bestia-bandido.png'));
        expect(enemyArt({ name: 'Guarda del barón', pack: '1387' }, manifest)).toBe(url('bestias/guarda-del-baron.png'));
        // Uno sin dibujo ni arquetipo (el jefe propio de una campaña tuya): la sombra, no la calavera.
        expect(enemyArt({ name: 'El Guardián de la cripta' }, manifest)).toBe(url('bestias/enemigo-sin-dibujo.png'));
        expect(enemyArt({ name: 'El Guardián de la cripta' }, small)).toBe('');
        // Ningún enemigo de los paquetes cambia de dibujo por esto.
        const changed = PACKS.flatMap(id => [...(pack(id).bestiary ?? []), ...(pack(id).boards ?? []).flatMap((/** @type {any} */ b) => b.enemies ?? [])]
            .map((/** @type {any} */ e) => ({ id, name: typeof e === 'string' ? e : e.name, archetype: e?.archetype ?? '' }))
            .filter(e => enemyArt({ name: e.name, archetype: e.archetype, pack: e.id }, manifest) !== firstArt('creature', { name: e.name, archetype: e.archetype }, manifest)));
        expect(changed).toEqual([]);
    });

    test('los ratos libres (J14.11): la biblioteca del gremio y el patio, con su sitio dibujado', () => {
        const manifest = real();
        const place = (/** @type {string} */ id, night = false) => firstArt('place', { id, night }, manifest);
        expect(place(pastimePlace('patio', 'gremio', {}, manifest))).toBe(url('sitios/patio.png'));
        expect(place(pastimePlace('leer', 'gremio', { library: 1 }, manifest), true)).toBe(url('sitios/biblioteca.png'));
        // Sin biblioteca se lee en la sala; los trabajos y las cartas, en su sitio de siempre.
        expect(pastimePlace('leer', 'gremio', { library: 0 }, manifest)).toBe('gremio');
        expect(pastimePlace('cartas', 'taberna', { library: 2 }, manifest)).toBe('taberna');
        expect(pastimePlace('forja', 'herreria', {}, manifest)).toBe('herreria');
        // Sin el dibujo del patio, la sala del gremio.
        expect(pastimePlace('patio', 'gremio', {}, small)).toBe('gremio');
        // Cada trabajo y rato tiene detrás un sitio dibujado, de día y de noche.
        for (const art of ['taberna', 'herreria', 'gremio', 'muelle']) {
            expect(place(art)).toBe(url(`sitios/${art}.png`));
            expect(place(art, true)).toBe(url(`sitios/${art}-noche.png`));
        }
    });
});

describe('las casillas del tablero', () => {
    test('el bioma: el dicho, el que se lee en el nombre, el del tipo, o mazmorra', () => {
        expect(boardBiome({ biome: 'cueva', name: 'Taberna' })).toBe('cueva');
        expect(boardBiome({ name: 'Taberna Sangre de la Enredadera' })).toBe('madera');
        expect(boardBiome({ name: 'El hierro en el bosque' })).toBe('exterior');
        expect(boardBiome({ name: 'Guarida de los Hombres Lobo' })).toBe('cueva');
        expect(boardBiome({ name: 'Sala sin nombre', type: 'wilderness' })).toBe('exterior');
        expect(boardBiome({ name: 'La bodega del gremio' })).toBe('mazmorra');
        expect(boardBiome()).toBe('mazmorra');
    });

    test('cada casilla con su dibujo; el suelo, ninguno', () => {
        expect(terrainTile({ type: 'wall' }, { biome: 'madera' })).toBe('muro-madera');
        expect(terrainTile({ type: 'floor' })).toBe('');
        expect(terrainTile({ type: 'door' })).toBe('puerta-cerrada');
        expect(terrainTile({ type: 'door', locked: true })).toBe('puerta-cerrojo');
        expect(terrainTile({ type: 'door', open: true })).toBe('puerta-abierta');
        expect(terrainTile({ type: 'door', open: true, broken: true })).toBe('puerta-rota');
        expect(terrainTile({ type: 'high' })).toBe('alto');
        expect(terrainTile({ type: 'high' }, { edge: true })).toBe('alto-borde');
        expect(terrainTile({ type: 'cover_three_quarters' })).toBe('cobertura-tres-cuartos');
        expect(terrainTile({ type: 'lava' })).toBe('');
    });

    test('un bioma sin su suelo dibujado usa el de la mazmorra', () => {
        const tiles = readManifest({ files: ['tablero/suelo-mazmorra.png', 'tablero/muro-madera.png'] });
        expect(firstArt('tile', { id: 'suelo-madera' }, tiles)).toBe(url('tablero/suelo-mazmorra.png'));
        expect(firstArt('tile', { id: 'muro-madera' }, tiles)).toBe(url('tablero/muro-madera.png'));
        expect(firstArt('tile', { id: 'agua' }, tiles)).toBe('');
    });

    test('lo ya visto en el suelo: la trampa descubierta y el fuego, cada uno con su dibujo de verdad', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        expect(hazardTile({ kind: 'trampa' })).toBe('trampa');
        expect(hazardTile({ kind: 'fuego' })).toBe('fuego');
        // Una sin tipo es una trampa, como en `readHazard`.
        expect(hazardTile({})).toBe('trampa');
        expect(hazardTile(null)).toBe('trampa');
        expect(firstArt('tile', { id: hazardTile({ kind: 'trampa' }) }, manifest)).toBe(url('tablero/trampa.png'));
        expect(firstArt('tile', { id: hazardTile({ kind: 'fuego' }) }, manifest)).toBe(url('tablero/fuego.png'));
    });

    // Tanda 12: el arte del tablero.
    test('el muelle es de tablas y la playa de arena; lo que está fuera ya no sale de mazmorra', () => {
        expect(boardBiome({ name: 'El muelle de Puerto Alba', type: 'city' })).toBe('muelle');
        expect(boardBiome({ name: 'La playa de la cala', type: 'wilderness' })).toBe('playa');
        expect(boardBiome({ name: 'Las salinas', type: 'outpost' })).toBe('playa');
        expect(boardBiome({ name: 'El asalto de las empalizadas', type: 'outpost' })).toBe('exterior');
        expect(boardBiome({ name: 'El islote de la torre', type: 'ruins' })).toBe('exterior');
        expect(boardBiome({ name: 'Viñedo de la Bodega', type: 'outpost' })).toBe('exterior');
        expect(boardBiome({ name: 'Puertas de Krezk', type: 'village' })).toBe('exterior');
        expect(boardBiome({ name: 'La choza de Baba Lysaga', type: 'ruins' })).toBe('pantano');
        expect(boardBiome({ name: 'El taller del ataudero', type: 'city' })).toBe('madera');
        // Lo de antes sigue igual: la bodega es piedra; el camino de la bodega, fuera.
        expect(boardBiome({ name: 'La bodega del gremio', type: 'city' })).toBe('mazmorra');
        expect(boardBiome({ name: 'El camino de la bodega', type: 'outpost' })).toBe('exterior');
        expect(boardBiome({ biome: 'muelle', name: 'Sala' })).toBe('muelle');
    });

    test('el agua honda tiene su dibujo, y sin él, el de la poco honda', () => {
        expect(terrainTile({ type: 'deep_water' })).toBe('agua-honda');
        expect(terrainTile({ type: 'water' })).toBe('agua');
        const both = readManifest({ files: ['tablero/agua.png', 'tablero/agua-honda.png'] });
        expect(firstArt('tile', { id: 'agua-honda' }, both)).toBe(url('tablero/agua-honda.png'));
        const shallowOnly = readManifest({ files: ['tablero/agua.png'] });
        expect(firstArt('tile', { id: 'agua-honda' }, shallowOnly)).toBe(url('tablero/agua.png'));
    });

    test('el terreno difícil y las coberturas cambian con el bioma, y sin su dibujo vuelven al de siempre', () => {
        // En la mazmorra (y sin decir bioma), el de siempre: escombros, la caja, la columna.
        expect(terrainTile({ type: 'difficult' })).toBe('dificil');
        expect(terrainTile({ type: 'difficult' }, { biome: 'mazmorra' })).toBe('dificil');
        expect(terrainTile({ type: 'difficult' }, { biome: 'exterior' })).toBe('dificil-exterior');
        expect(terrainTile({ type: 'cover_half' }, { biome: 'nieve' })).toBe('cobertura-media-nieve');
        expect(terrainTile({ type: 'cover_three_quarters' }, { biome: 'cueva' })).toBe('cobertura-tres-cuartos-cueva');
        // Un bioma que no existe no inventa archivos; los muros y las puertas no cambian así.
        expect(terrainTile({ type: 'difficult' }, { biome: 'lava' })).toBe('dificil');
        expect(terrainTile({ type: 'door' }, { biome: 'exterior' })).toBe('puerta-cerrada');
        expect(terrainTile({ type: 'barrel' }, { biome: 'exterior' })).toBe('barril');

        const tiles = readManifest({ files: ['tablero/dificil.png', 'tablero/dificil-exterior.png', 'tablero/barro.png',
            'tablero/cobertura-media.png', 'tablero/cobertura-media-exterior.png'] });
        expect(firstArt('tile', { id: 'dificil-exterior' }, tiles)).toBe(url('tablero/dificil-exterior.png'));
        // La nieve sin su montón dibujado: los escombros de siempre.
        expect(firstArt('tile', { id: 'dificil-nieve' }, tiles)).toBe(url('tablero/dificil.png'));
        // El pantano: barro; la playa: lo del exterior.
        expect(firstArt('tile', { id: 'dificil-pantano' }, tiles)).toBe(url('tablero/barro.png'));
        expect(firstArt('tile', { id: 'dificil-playa' }, tiles)).toBe(url('tablero/dificil-exterior.png'));
        expect(firstArt('tile', { id: 'cobertura-media-playa' }, tiles)).toBe(url('tablero/cobertura-media-exterior.png'));
        expect(firstArt('tile', { id: 'cobertura-media-calle' }, tiles)).toBe(url('tablero/cobertura-media.png'));
    });

    test('cada bioma tiene su suelo y su muro dibujados, y los dibujos nuevos del tablero existen', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        for (const biome of ['mazmorra', 'madera', 'exterior', 'cueva', 'calle', 'nieve', 'pantano', 'cripta', 'muelle', 'playa']) {
            expect(boardBiome({ biome })).toBe(biome);
            expect(firstArt('tile', { id: `suelo-${biome}` }, manifest)).toBe(url(`tablero/suelo-${biome}.png`));
            expect(firstArt('tile', { id: `muro-${biome}` }, manifest)).toBe(url(`tablero/muro-${biome}.png`));
        }
        for (const [cell, biome, file] of /** @type {Array<[any, string, string]>} */ ([
            [{ type: 'deep_water' }, 'muelle', 'agua-honda'],
            [{ type: 'difficult' }, 'exterior', 'dificil-exterior'],
            [{ type: 'cover_half' }, 'exterior', 'cobertura-media-exterior'],
            [{ type: 'cover_three_quarters' }, 'exterior', 'cobertura-tres-cuartos-exterior'],
            [{ type: 'difficult' }, 'nieve', 'dificil-nieve'],
            [{ type: 'cover_half' }, 'nieve', 'cobertura-media-nieve'],
            [{ type: 'cover_three_quarters' }, 'nieve', 'cobertura-tres-cuartos-nieve'],
            [{ type: 'cover_three_quarters' }, 'cueva', 'cobertura-tres-cuartos-cueva'],
            [{ type: 'cover_half' }, 'cripta', 'cobertura-media-cripta'],
            [{ type: 'cover_half' }, 'playa', 'cobertura-media-exterior'],
            [{ type: 'difficult' }, 'pantano', 'barro'],
        ])) {
            expect(firstArt('tile', { id: terrainTile(cell, { biome }) }, manifest)).toBe(url(`tablero/${file}.png`));
        }
        // Lo que pone el CSS (los marcos de las fichas y las casillas de salida) también está.
        for (const file of ['marco-aliado', 'marco-enemigo', 'marco-jefe', 'marco-invocacion', 'marco-gente', 'casilla-salida']) {
            expect(manifest.files.has(`tablero/${file}.png`)).toBe(true);
        }
    });

    test('el familiar (una invocación que no es del bestiario) tiene su dibujo, no «???»', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        expect(firstArt('creature', { name: 'Familiar', archetype: '' }, manifest)).toBe(url('bestias/familiar.png'));
    });

    test('ningún enemigo de los tableros de las tres campañas se queda sin dibujo', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        const enemies = boardEnemies();
        expect(enemies.length).toBeGreaterThan(30);
        const undrawn = enemies
            .map(({ pack, board, enemy }) => ({ board, name: enemy.name, art: enemyArt({ name: enemy.name, archetype: String(enemy.archetype || ''), pack }, manifest) }))
            .filter(found => !found.art || found.art.includes('enemigo-sin-dibujo'));
        expect(undrawn).toEqual([]);
    });

    test('un puente es suelo que cruza el agua o el abismo y llega a tierra por las dos puntas, con su baranda en los bordes', () => {
        // Un río de agua honda, un puente de una casilla (x 2) y otro de dos (x 5 y 6).
        const river = terrainFromAsciiMap([
            '........',
            'WW.WW..W',
            'WW.WW..W',
            '........',
        ]);
        const found = bridgeTiles(river, 8, 4);
        expect(found.map(b => `${b.x},${b.y}`)).toEqual(['2,1', '5,1', '6,1', '2,2', '5,2', '6,2']);
        expect(found.find(b => b.x === 2 && b.y === 1)?.layers).toEqual(['puente-baranda-oeste', 'puente-baranda-este', 'puente-ns']);
        expect(found.find(b => b.x === 5 && b.y === 1)?.layers).toEqual(['puente-baranda-oeste', 'puente-ns']);
        expect(found.find(b => b.x === 6 && b.y === 1)?.layers).toEqual(['puente-baranda-este', 'puente-ns']);
        // De este a oeste sobre un abismo: las barandas, al norte y al sur.
        const across = bridgeTiles(terrainFromAsciiMap(['.vv.', '....', '.vv.']), 4, 3);
        expect(across).toEqual([
            { x: 1, y: 1, along: 'eo', layers: ['puente-baranda-norte', 'puente-baranda-sur', 'puente-eo'] },
            { x: 2, y: 1, along: 'eo', layers: ['puente-baranda-norte', 'puente-baranda-sur', 'puente-eo'] },
        ]);
    });

    test('ni un embarcadero que acaba en el agua, ni una isla, ni una calzada ancha son puentes', () => {
        // El embarcadero: suelo que entra en el agua y acaba en ella.
        expect(bridgeTiles(terrainFromAsciiMap(['....', 'W.WW', 'W.WW', 'WWWW']), 4, 4)).toEqual([]);
        // La isla: agua por los cuatro lados.
        expect(bridgeTiles(terrainFromAsciiMap(['WWW', 'W.W', 'WWW']), 3, 3)).toEqual([]);
        // Cuatro de ancho ya no es un puente.
        expect(bridgeTiles(terrainFromAsciiMap(['......', 'W....W', '......']), 6, 3)).toEqual([]);
        // Al borde del tablero no hay tierra.
        expect(bridgeTiles(terrainFromAsciiMap(['W.W', 'W.W']), 3, 2)).toEqual([]);
        expect(bridgeTiles(null, 3, 3)).toEqual([]);
    });

    test('con cotas, un paso alto entre dos mesetas sobre un barranco es un puente; un escalón de 5 pies, no', () => {
        // Dos mesetas a 30 pies (x 0-1 y x 4-5) y el paso (x 2-3, fila 1) a su altura, sobre el suelo a 0.
        const elevation = {};
        for (let y = 0; y < 3; y++) for (const x of [0, 1, 4, 5]) elevation[`${x},${y}`] = 30;
        elevation['2,1'] = 30;
        elevation['3,1'] = 30;
        const open = terrainFromAsciiMap(['......', '......', '......']);
        expect(bridgeTiles(open, 6, 3, elevation).map(b => `${b.x},${b.y}:${b.along}`)).toEqual(['2,1:eo', '3,1:eo']);
        const low = Object.fromEntries(Object.entries(elevation).map(([key]) => [key, 5]));
        expect(bridgeTiles(open, 6, 3, low)).toEqual([]);
    });

    test('la cara de un acantilado va en la casilla de abajo, pegada al borde, y se llama por hacia dónde se cae', () => {
        expect(cliffFace({ x: 2, y: 3, side: 'down', drop: 20 })).toEqual({ id: 'acantilado-sur', x: 2, y: 4, width: 1, height: CLIFF_FACE });
        expect(cliffFace({ x: 2, y: 3, side: 'down', drop: -20 })).toEqual({ id: 'acantilado-norte', x: 2, y: 4 - CLIFF_FACE, width: 1, height: CLIFF_FACE });
        expect(cliffFace({ x: 2, y: 3, side: 'right', drop: 10 })).toEqual({ id: 'acantilado-este', x: 3, y: 3, width: CLIFF_FACE, height: 1 });
        expect(cliffFace({ x: 2, y: 3, side: 'right', drop: -10 })).toEqual({ id: 'acantilado-oeste', x: 3 - CLIFF_FACE, y: 3, width: CLIFF_FACE, height: 1 });
    });

    test('los puentes y los acantilados tienen su dibujo, del tamaño que pide el tablero', () => {
        const manifest = readManifest(JSON.parse(readFileSync(join(PIXEL_DIR, 'manifest.json'), 'utf8')));
        const size = (/** @type {string} */ file) => {
            const png = readFileSync(join(PIXEL_DIR, 'tablero', `${file}.png`));
            return [png.readUInt32BE(16), png.readUInt32BE(20)];
        };
        for (const file of ['puente-ns', 'puente-eo', 'puente-baranda-oeste', 'puente-baranda-este', 'puente-baranda-norte', 'puente-baranda-sur']) {
            expect(firstArt('tile', { id: file }, manifest)).toBe(url(`tablero/${file}.png`));
            expect(size(file)).toEqual([48, 48]);
        }
        for (const [file, wide] of /** @type {Array<[string, boolean]>} */ ([['acantilado-sur', true], ['acantilado-norte', true], ['acantilado-este', false], ['acantilado-oeste', false]])) {
            expect(firstArt('tile', { id: file }, manifest)).toBe(url(`tablero/${file}.png`));
            expect(size(file)).toEqual(wide ? [48, 16] : [16, 48]);
        }
    });

    test('el puente sobre el abismo de Ravenloft se dibuja como puente', () => {
        const data = JSON.parse(readFileSync(fileURLToPath(new URL('../public/mundos/strahd.pack.json', import.meta.url)), 'utf8'));
        const board = data.boards.find((/** @type {any} */ b) => b.name === 'Entrada a Ravenloft');
        const found = bridgeTiles(terrainFromAsciiMap(board.map), board.map[0].length, board.map.length);
        expect(found.length).toBeGreaterThanOrEqual(4);
        expect(found.every(b => b.along === 'ns')).toBe(true);
    });
});

/**
 * Los enemigos de los tableros de las tres campañas, con su paquete y su tablero.
 *
 * @returns {Array<{pack: string, board: string, enemy: any}>}
 */
function boardEnemies() {
    return ['gremio', '1387', 'strahd'].flatMap(pack => {
        const data = JSON.parse(readFileSync(fileURLToPath(new URL(`../public/mundos/${pack}.pack.json`, import.meta.url)), 'utf8'));
        return (data.boards || []).flatMap((/** @type {any} */ board) => (board.enemies || []).map((/** @type {any} */ enemy) => ({ pack, board: String(board.name), enemy })));
    });
}

describe('de qué paquete es un mundo', () => {
    test('una campaña del tablón lo dice; el gremio es el gremio; lo demás, ninguno', () => {
        expect(packOfWorld({ hubCampaign: 'strahd', hubHome: 'El Gremio' })).toBe('strahd');
        expect(packOfWorld({ hubCampaign: '1387' })).toBe('1387');
        expect(packOfWorld({ hub: { campaigns: {} } })).toBe('gremio');
        expect(packOfWorld({ origin: 'imported' })).toBe('');
        expect(packOfWorld(null)).toBe('');
    });
});
