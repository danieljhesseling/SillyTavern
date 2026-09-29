import { describe, test, expect, afterEach } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    slugify, classIdOf, genderFileOf, readManifest, artFor, firstArt, isPlainFace, buildPixelManifest, packOfWorld,
    setPixelManifest, loadPixelManifest, pixelManifest, PIXEL_BASE, boardBiome, terrainTile,
} from '../public/scripts/game-engine/ui/pixel-art.js';
import { pixelManifestText } from '../tools/pixel-manifest.mjs';

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

afterEach(() => setPixelManifest(null));

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
        expect(manifest.packs.flatMap(pack => lostPortraits(manifest, pack))).toEqual([]);
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
});

describe('de qué paquete es un mundo', () => {
    test('una campaña del tablón lo dice; el gremio es el gremio; lo demás, ninguno', () => {
        expect(packOfWorld({ hubCampaign: 'strahd', hubHome: 'El Gremio' })).toBe('strahd');
        expect(packOfWorld({ hubCampaign: '1387' })).toBe('1387');
        expect(packOfWorld({ hub: { campaigns: {} } })).toBe('gremio');
        expect(packOfWorld({ origin: 'imported' })).toBe('');
        expect(packOfWorld(null)).toBe('');
    });
});
