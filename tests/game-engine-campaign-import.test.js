import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    readCampaignText, isGemJson, packFromGemJson, cleanGemText, bothWays, levelsOfPack, journeyOfPack,
    importedCampaignId, importedPackFileName, importedCampaignRow, DEFAULT_JOURNEY_DAYS,
} from '../public/scripts/game-engine/campaign/campaign-import.js';
import {
    readHub, withHubChat, withHubCampaign, withHubImported, readImportedRows, hubCampaignCards, journeyLine,
    readImportedList, importedListFile, withImportedRow, withoutImportedRow, importedForHub, withoutHubImported, HUB_IMPORTED_LIST,
    HUB_IMPORTED_PREFIX, HUB_KEPT_NOTE,
} from '../public/scripts/game-engine/campaign/hub.js';
import { buildExamplePack } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

/** Lo que devuelve el Gem: el paquete del ejemplo, con la cabecera del esquema y marcas. */
const gemJson = () => {
    const pack = buildExamplePack();
    pack.world.synopsis = `${pack.world.synopsis} [cite: 12]`;
    pack.locations[0].routes = [{ to: pack.locations[1].name, days: 2 }];
    return { $schema: 'http://json-schema.org/draft-07/schema#', title: 'Paquete de campaña', description: 'x', ...pack };
};

describe('leer el archivo de una campaña (J5.4)', () => {
    test('un paquete del juego entra tal cual', () => {
        const pack = buildExamplePack();
        const found = readCampaignText(JSON.stringify(pack));
        expect(found).toMatchObject({ ok: true, kind: 'pack', problems: [], notes: [] });
        expect(found.pack).toEqual(pack);
        expect(found.headline).toMatch(/^El Molino de los Cuervos: 2 localizaciones, 2 tableros/);
    });

    test('lo que da el Gem se pone en limpio: sin cabecera, sin marcas y con las rutas de vuelta', () => {
        const raw = gemJson();
        expect(isGemJson(raw)).toBe(true);
        expect(isGemJson(buildExamplePack())).toBe(false);
        const found = readCampaignText(JSON.stringify(raw, null, 2));
        expect(found.ok).toBe(true);
        expect(found.kind).toBe('gem');
        expect(found.notes).toEqual(['Venía de tu Gem: se ha quitado una marca [cite] y la cabecera del esquema.']);
        expect(Object.keys(found.pack)).not.toContain('$schema');
        expect(Object.keys(found.pack)).not.toContain('title');
        expect(found.pack.world.synopsis).not.toMatch(/cite/);
        const [a, b] = found.pack.locations;
        expect(b.routes).toEqual([{ to: a.name, days: 2 }]);
    });

    test('el JSON de Strahd tal cual llegó se lee como del Gem, y el validador dice qué le falla', () => {
        const found = readCampaignText(read('../wiki/campanas/strahd/original.json'));
        expect(found.kind).toBe('gem');
        expect(found.notes[0]).toMatch(/se han quitado \d+ marcas \[cite\]/);
        // Los zombis de la mansión, en casillas a las que no se llega: lo arregla mejoras.json.
        expect(found.ok).toBe(false);
        expect(found.headline).toBe('La campaña tiene 3 fallos que arreglar antes de jugarla.');
        expect(found.problems[0]).toEqual({ path: 'boards[1].enemies', message: expect.stringMatching(/no se puede llegar/) });
    });

    test('el bloque ```json del chat del Gem se lee igual', () => {
        const fenced = `\`\`\`json\n${JSON.stringify(buildExamplePack())}\n\`\`\``;
        expect(readCampaignText(fenced).ok).toBe(true);
        expect(readCampaignText(fenced).notes).toEqual([]);
    });

    test('D-J35: pegado con lo que dice el Gem alrededor, se queda con la campaña y lo dice', () => {
        const json = JSON.stringify(buildExamplePack(), null, 2);
        const around = 'Aquí tienes tu campaña:';
        for (const pasted of [
            `${around}\n\n\`\`\`json\n${json}\n\`\`\`\n\nSi quieres cambiar algo, dímelo.`,
            `${around}\n${json}\nQue la disfrutes.`,
            `${json}\n\nEspero que te guste.`,
        ]) {
            const found = readCampaignText(pasted);
            expect(found.ok).toBe(true);
            expect(found.notes).toEqual(['Traía texto antes o después de la campaña: se ha quitado.']);
        }
        // Si ni así se lee, el fallo es el de siempre.
        expect(readCampaignText(`${around}\n{"world": {"name": "El valle"`).headline).toMatch(/^No es un JSON válido/);
    });

    test('lo que no es JSON se dice en castellano, con la línea', () => {
        expect(readCampaignText('').headline).toBe('El archivo está vacío.');
        const broken = readCampaignText('{\n  "world": { "name": "X" },\n  "boards": [ }\n}');
        expect(broken.ok).toBe(false);
        expect(broken.headline).toBe('No es un JSON válido: algo falla en la línea 3, columna 15. Suele ser una coma de más o de menos, o unas comillas sin cerrar.');
        // Una coma de más, al final de una lista: donde está lo que no debería.
        expect(readCampaignText('{\n "boards": [1, 2,],\n "world": {}\n}').headline).toMatch(/línea 2, columna 18\./);
        expect(readCampaignText('{"world": {"name": "a\\x"}}').headline).toMatch(/línea 1, columna 23\./);
        // Cortado: lo que pasa cuando el Gem no acaba de escribir.
        expect(readCampaignText('{"world": {"name": "El valle"').headline)
            .toBe('No es un JSON válido: se corta antes de acabar. Falta el final del archivo, o cerrar unas llaves.');
    });

    test('lo que no es una campaña se dice, sin llegar al validador', () => {
        expect(readCampaignText('[1, 2]').headline).toMatch(/^Esto no es una campaña: el archivo tiene que ser un solo objeto/);
        expect(readCampaignText('{"name": "Tessa", "class": "Guerrera"}').headline)
            .toBe('Esto no es una campaña: no trae ni el mundo («world») ni los tableros («boards»).');
    });

    test('un paquete roto trae los fallos del validador, como mucho ocho, y cuántos más hay', () => {
        const pack = buildExamplePack();
        pack.boards = [];
        const found = readCampaignText(JSON.stringify(pack));
        expect(found.ok).toBe(false);
        expect(found.pack).toBeNull();
        expect(found.problems).toContainEqual({ path: 'boards', message: 'Un paquete sin tableros no se puede jugar.' });

        const many = buildExamplePack();
        many.bestiary = Array.from({ length: 12 }, () => ({ name: 'Cuervo', hp: 5, armorClass: 10, cr: 0.25 }));
        const lots = readCampaignText(JSON.stringify(many));
        expect(lots.problems).toHaveLength(8);
        expect(lots.more).toBeGreaterThan(0);
    });
});

describe('lo que el paquete no trae para su tarjeta', () => {
    test('los niveles, de lo que diga o del desafío de sus bichos', () => {
        expect(levelsOfPack({ world: { levels: [3, 7] } })).toEqual([3, 7]);
        expect(levelsOfPack(JSON.parse(read('../public/mundos/strahd.pack.json')))).toEqual([1, 6]);
        expect(levelsOfPack({ bestiary: [{ cr: 0.125 }] })).toEqual([1, 2]);
        expect(levelsOfPack({ bestiary: [{ cr: 9 }, { cr: 30 }] })).toEqual([9, 20]);
        expect(levelsOfPack({ bestiary: [] })).toBeNull();
    });

    test('el camino, lo que diga o el de siempre', () => {
        expect(journeyOfPack({ world: { journey: { days: 3, how: 'En barca' } } })).toEqual({ days: 3, how: 'En barca' });
        expect(journeyOfPack({ world: {} })).toEqual({ days: DEFAULT_JOURNEY_DAYS, how: '' });
    });

    test('el id y el archivo: sin tildes, con su prefijo, y que el servidor los admita', () => {
        expect(importedCampaignId('La Maldición de Strahd')).toBe('tuya-la-maldicion-de-strahd');
        expect(importedCampaignId('¡¡!!')).toBe('tuya-campana');
        expect(importedCampaignId('x'.repeat(200))).toHaveLength(HUB_IMPORTED_PREFIX.length + 48);
        const file = importedPackFileName(importedCampaignId('El Molino de los Cuervos'));
        expect(file).toBe('campana-tuya-el-molino-de-los-cuervos.pack.json');
        // Lo que pide `validateAssetFileName` en src/endpoints/assets.js.
        expect(file).toMatch(/^[a-zA-Z0-9_\-.]+$/);
    });

    test('la fila tiene la forma de las de mundos.json', () => {
        const row = importedCampaignRow(buildExamplePack(), { id: 'tuya-el-molino', packUrl: '/user/files/campana-tuya-el-molino.pack.json' });
        expect(row).toMatchObject({
            id: 'tuya-el-molino', name: 'El Molino de los Cuervos', pack: '/user/files/campana-tuya-el-molino.pack.json',
            levels: [1, 2], journey: { days: DEFAULT_JOURNEY_DAYS, how: '' }, imported: true, icon: 'fa-book-open',
        });
    });
});

describe('las campañas añadidas, en el gremio', () => {
    const row = importedCampaignRow(buildExamplePack(), { id: 'tuya-el-molino', packUrl: '/user/files/campana-tuya-el-molino.pack.json' });
    const worlds = [{ id: 'strahd', name: 'Strahd', pack: '/mundos/strahd.pack.json', levels: [1, 6], journey: { days: 9 } }];

    test('un gremio sin ninguna se lee como siempre', () => {
        expect(readHub(null)).toEqual({ chat: null, campaigns: {} });
    });

    test('se guardan en el gremio y no se pierden al cambiar el chat ni al empezar otra', () => {
        let hub = withHubImported({}, row);
        hub = withHubChat(hub, { file: 'La posadera - hoy', avatar: 'posadera.png' });
        hub = withHubCampaign(hub, 'strahd', { worldName: 'Strahd · Tessa' });
        expect(hub.imported).toEqual([row]);
    });

    test('añadir otra vez la misma la pone al día, sin repetirla', () => {
        const again = withHubImported(withHubImported({}, row), { ...row, name: 'El Molino, corregido' });
        expect(again.imported.map(r => r.name)).toEqual(['El Molino, corregido']);
    });

    test('lo roto o lo que apunta fuera de tus archivos no se lee', () => {
        expect(readImportedRows([
            { ...row, id: 'strahd' },
            { ...row, pack: '/mundos/strahd.pack.json' },
            { ...row, pack: 'https://otro.sitio/campana.json' },
            { ...row, pack: '/user/files/../secrets.json' },
            { ...row, name: '' },
            'no',
        ])).toEqual([]);
    });

    test('salen en el tablón detrás de las del juego, con sus niveles y su distancia', () => {
        const cards = hubCampaignCards({ worlds, hub: withHubImported({}, row), level: 1 });
        expect(cards.map(c => c.id)).toEqual(['strahd', 'tuya-el-molino']);
        expect(cards[1]).toMatchObject({
            name: 'El Molino de los Cuervos', levels: 'Nivel recomendado: 1 a 2', distance: 'A cinco días de camino',
            state: 'nueva', action: 'Empezar', note: 'Añadida por ti.', imported: true,
        });
        expect(cards[0].imported).toBe(false);
        // Y empezada, sigue como las demás.
        const started = withHubCampaign(withHubImported({}, row), 'tuya-el-molino', { worldName: 'El Molino · Tessa' });
        expect(hubCampaignCards({ worlds, hub: started })[1]).toMatchObject({ state: 'en-curso', action: 'Seguir' });
    });

    test('el viaje se cuenta como el de las demás', () => {
        expect(journeyLine({ world: row, home: 'Puerto Alba' }))
            .toBe('Salís de Puerto Alba hacia El Molino de los Cuervos. Cinco días de camino.');
    });
});

describe('D-J35: tus campañas añadidas, en todos tus gremios', () => {
    const molino = importedCampaignRow(buildExamplePack(), { id: 'tuya-el-molino', packUrl: '/user/files/campana-tuya-el-molino.pack.json' });
    const pantano = { ...molino, id: 'tuya-el-pantano', name: 'El Pantano', pack: '/user/files/campana-tuya-el-pantano.pack.json' };
    const worlds = [{ id: 'strahd', name: 'Strahd', pack: '/mundos/strahd.pack.json', levels: [1, 6] }];

    test('la lista se lee de su archivo o suelta, y lo roto no entra', () => {
        expect(readImportedList(null)).toEqual([]);
        expect(readImportedList({ version: 1, campaigns: [molino, { ...molino, id: 'strahd' }] })).toEqual([molino]);
        expect(readImportedList([pantano])).toEqual([pantano]);
        expect(importedListFile([molino, 'no'])).toEqual({ version: 1, campaigns: [molino] });
    });

    test('añadir la pone al final; otra vez, la pone al día en su sitio; quitar, la saca', () => {
        let list = withImportedRow([], molino);
        list = withImportedRow(list, pantano);
        list = withImportedRow(list, { ...molino, name: 'El Molino, corregido' });
        expect(list.map(r => r.name)).toEqual(['El Molino, corregido', 'El Pantano']);
        expect(withImportedRow(list, { id: 'strahd' })).toEqual(list);
        expect(withoutImportedRow(list, 'tuya-el-molino').map(r => r.id)).toEqual(['tuya-el-pantano']);
        expect(withoutImportedRow(list, 'no-esta')).toEqual(list);
    });

    test('un gremio ve tu lista, y detrás lo que guardaba él antes, sin repetir', () => {
        const hub = withHubImported(withHubImported({}, { ...molino, name: 'Vieja' }), pantano);
        expect(importedForHub([molino], hub).map(r => `${r.id}:${r.name}`))
            .toEqual(['tuya-el-molino:El Molino de los Cuervos', 'tuya-el-pantano:El Pantano']);
        expect(importedForHub([], null)).toEqual([]);
    });

    test('dos gremios distintos ven las mismas: la lista no es de ninguno', () => {
        const uno = withHubCampaign({}, 'tuya-el-molino', { worldName: 'El Molino · Tessa' });
        const otro = withHubChat({}, { file: 'Otro gremio', avatar: 'posadera.png' });
        const ids = (/** @type {any} */ hub) => hubCampaignCards({ worlds, hub, imported: [molino, pantano] }).map(c => c.id);
        expect(ids(uno)).toEqual(['strahd', 'tuya-el-molino', 'tuya-el-pantano']);
        expect(ids(otro)).toEqual(ids(uno));
        // Cada gremio sabe cómo va la suya.
        expect(hubCampaignCards({ worlds, hub: uno, imported: [molino] })[1].state).toBe('en-curso');
        expect(hubCampaignCards({ worlds, hub: otro, imported: [molino] })[1].state).toBe('nueva');
    });

    test('quitada del tablón, sigue en el gremio donde se empezó, sin «Quitar»; en los demás, no', () => {
        const uno = withHubCampaign({}, 'tuya-el-molino', { worldName: 'El Molino · Tessa', name: 'El Molino de los Cuervos', finished: true, ending: 'Libre' });
        const cards = hubCampaignCards({ worlds, hub: uno, imported: [pantano] });
        expect(cards.map(c => c.id)).toEqual(['strahd', 'tuya-el-pantano', 'tuya-el-molino']);
        expect(cards[2]).toMatchObject({
            name: 'El Molino de los Cuervos', state: 'terminada', action: 'Volver', ending: 'Libre', imported: false,
            note: HUB_KEPT_NOTE, levels: '', warn: '',
        });
        // Sin nombre apuntado (empezada antes de D-J35), con el de su mundo.
        const viejo = withHubCampaign({}, 'tuya-el-molino', { worldName: 'El Molino · Tessa' });
        expect(hubCampaignCards({ worlds, hub: viejo, imported: [] }).find(c => c.id === 'tuya-el-molino')).toMatchObject({ name: 'El Molino · Tessa', state: 'en-curso' });
        // Las del juego no se quedan así: solo las añadidas por ti.
        const conStrahd = withHubCampaign({}, 'strahd', { worldName: 'Strahd · Tessa' });
        expect(hubCampaignCards({ worlds: [], hub: conStrahd, imported: [] })).toEqual([]);
        // Y el nombre se guarda con el gremio.
        expect(readHub(uno).campaigns['tuya-el-molino'].name).toBe('El Molino de los Cuervos');
    });

    test('las que guardaba el gremio salen de él al pasar a tu lista', () => {
        const hub = withHubCampaign(withHubImported({}, molino), 'strahd', { worldName: 'Strahd · Tessa' });
        const clean = withoutHubImported(hub);
        expect(clean.imported).toBeUndefined();
        expect(clean.campaigns.strahd.worldName).toBe('Strahd · Tessa');
    });

    test('su archivo tiene un nombre que el servidor admite, junto a los paquetes', () => {
        expect(HUB_IMPORTED_LIST).toMatch(/^[a-zA-Z0-9_\-.]+\.json$/);
    });
});

describe('lo que se comparte con tools/campana-a-paquete.mjs', () => {
    test('las marcas se quitan en todo lo que hay dentro', () => {
        expect(cleanGemText({ a: ['uno [cite: 3]', { b: 'propio: dos' }], n: 4 })).toEqual({ a: ['uno', { b: 'dos' }], n: 4 });
    });

    test('una ruta escrita basta: la de vuelta se pone, y no se repite', () => {
        const places = bothWays([{ name: 'A', routes: [{ to: 'B', days: 1, closedUntil: 'h1' }] }, { name: 'B', routes: [{ to: 'A', days: 1 }] }, { name: 'C', routes: [{ to: 'A', days: 3 }] }]);
        expect(places[1].routes).toEqual([{ to: 'A', days: 1 }]);
        expect(places[0].routes).toEqual([{ to: 'B', days: 1, closedUntil: 'h1' }, { to: 'C', days: 3 }]);
    });

    test('la herramienta los usa de aquí, no una copia', () => {
        const tool = read('../tools/campana-a-paquete.mjs');
        expect(tool).toMatch(/campaign-import\.js/);
        expect(tool).not.toMatch(/^function (clean|mergeBy|bothWays)\b/m);
    });

    test('un paquete del Gem sin versión se queda en la 1', () => {
        const raw = gemJson();
        delete raw.version;
        expect(packFromGemJson(raw).version).toBe(1);
    });
});
