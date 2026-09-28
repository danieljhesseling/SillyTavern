import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    PACK_EDIT_STEPS, packItems, placeNames, packNote, packForm, applyPackField, newPackRow,
    packProblem, packStepProblem, applyPackEdits,
} from '../public/scripts/game-engine/campaign/pack-edits.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { draftOf, paintCell } from '../public/scripts/game-engine/campaign/board-draft.js';
import {
    startTaller, writePackRow, dropPackRow, packEditsOf, blocksNext, stepSlice, toAnswers,
} from '../public/scripts/game-engine/campaign/taller.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';

const mil = () => JSON.parse(readFileSync(new URL('../public/mundos/1387.pack.json', import.meta.url), 'utf8'));

describe('lo que trae un mundo escrito, para retocarlo', () => {
    test('las cuatro pestañas, con claves que no cambian al renombrar', () => {
        const pack = mil();
        expect(PACK_EDIT_STEPS).toEqual(['localidades', 'tableros', 'facciones', 'personajes']);
        const places = packItems(pack, {}, 'localidades');
        expect(places).toHaveLength(pack.locations.length);
        expect(places[0].key).toBe('loc:0');
        // La gente: los compañeros y los vecinos, cada uno con lo suyo.
        const people = packItems(pack, {}, 'personajes');
        expect(people.filter(p => p.kind === 'companero')).toHaveLength(pack.confidants.length);
        expect(people.filter(p => p.kind === 'vecino')).toHaveLength(pack.npcs.length);
    });

    test('lo retocado va encima, y lo nuevo al final', () => {
        const pack = mil();
        const edits = {
            localidades: { 'loc:0': { ...pack.locations[0], name: 'Barrizal' }, 'mio:1': newPackRow('localidades', { places: ['Castillo de Vane'], n: 1 }).row },
        };
        const items = packItems(pack, edits, 'localidades');
        expect(items[0].row.name).toBe('Barrizal');
        expect(items[0].changed).toBe(true);
        expect(items.at(-1).mine).toBe(true);
        expect(packNote(items[0])).toMatch(/^Retocado/);
        expect(packNote(items.at(-1))).toMatch(/^Tuyo/);
        expect(placeNames(pack, edits)).toContain('Barrizal');
    });
});

describe('la ficha', () => {
    test('un sitio nuevo pregunta desde dónde se llega; uno del mundo enseña sus caminos', () => {
        const pack = mil();
        const [stock] = packItems(pack, {}, 'localidades');
        expect(packForm(stock).map(f => f.key)).not.toContain('link');
        expect(packForm(stock)[0].hint).toMatch(/Caminos: /);
        const mine = { key: 'mio:1', kind: 'sitio', mine: true, changed: false, row: newPackRow('localidades', { n: 1 }).row };
        expect(packForm(mine).map(f => f.key)).toEqual(expect.arrayContaining(['link', 'days']));
    });

    test('escribir un campo cambia solo ese', () => {
        const item = { key: 'mio:1', kind: 'sitio', mine: true, changed: false, row: newPackRow('localidades', { places: ['A'], n: 1 }).row };
        expect(applyPackField(item, 'days', '3').routes).toEqual([{ to: 'A', days: 3 }]);
        expect(applyPackField(item, 'hidden', 'si').hidden).toBe(true);
        expect(applyPackField(item, 'name', 'La Poza').name).toBe('La Poza');
    });

    test('sin nombre, repetido o sin camino no vale', () => {
        const pack = mil();
        const all = packItems(pack, { localidades: { 'mio:1': { kind: 'sitio', name: pack.locations[1].name, routes: [{ to: 'X' }] } } }, 'localidades');
        expect(packProblem(all.at(-1), all)).toMatch(/dos que se llaman/);
        const lost = { key: 'mio:2', kind: 'sitio', mine: true, changed: false, row: { name: 'Nadie', routes: [{ to: '' }] } };
        expect(packProblem(lost, [lost])).toMatch(/desde dónde/);
        const blank = { key: 'loc:0', kind: 'sitio', mine: false, changed: true, row: { name: '' } };
        expect(packProblem(blank, [blank])).toMatch(/sin nombre/);
        // Lo que no se ha tocado no se mira: ya lo comprobó quien lo escribió.
        expect(packStepProblem(pack, {}, 'localidades')).toBe('');
    });
});

describe('al crear, el paquete con lo tocado encima', () => {
    test('sin tocar nada, el mismo paquete', () => {
        const pack = mil();
        expect(applyPackEdits(pack, {})).toBe(pack);
        expect(applyPackEdits(pack, { localidades: {} })).toBe(pack);
    });

    // El mundo empareja por nombre: renombrar sin arrastrar deja caminos a ninguna parte.
    test('renombrar un sitio lo cambia en los caminos, los tableros, las facciones y la gente', () => {
        const pack = mil();
        const old = pack.locations[0].name;
        const out = applyPackEdits(pack, { localidades: { 'loc:0': { ...pack.locations[0], name: 'Barrizal' } } });
        const json = JSON.stringify(out);
        expect(json).not.toContain(`"${old}"`);
        expect(out.locations[0].name).toBe('Barrizal');
        expect(out.locations.some(l => l.routes.some(r => r.to === 'Barrizal'))).toBe(true);
        expect(out.boards.some(b => b.locationName === 'Barrizal')).toBe(true);
        // Y el de serie no se toca.
        expect(pack.locations[0].name).toBe(old);
        expect(validatePack(out).ok).toBe(true);
    });

    test('un sitio nuevo se une en los dos sentidos', () => {
        const pack = mil();
        const row = { ...newPackRow('localidades', { places: ['Castillo de Vane'], n: 1 }).row, name: 'La Poza', routes: [{ to: 'Castillo de Vane', days: 2 }] };
        const out = applyPackEdits(pack, { localidades: { 'mio:1': row } });
        const poza = out.locations.find(l => l.name === 'La Poza');
        expect(poza.routes).toEqual([{ to: 'Castillo de Vane', days: 2 }]);
        expect(poza.kind).toBeUndefined();
        expect(out.locations.find(l => l.name === 'Castillo de Vane').routes).toContainEqual({ to: 'La Poza', days: 2 });
        expect(validatePack(out).ok).toBe(true);
    });

    test('un tablero nuevo se dibuja con la semilla, y el mismo mundo da el mismo', () => {
        const pack = mil();
        const row = { ...newPackRow('tableros', { places: ['El Pueblo de Barro'], n: 1 }).row, name: 'La bodega', shape: 'cave', size: 'small' };
        const one = applyPackEdits(pack, { tableros: { 'mio:1': row } }, { seed: 'uno-dos-tres' });
        const two = applyPackEdits(pack, { tableros: { 'mio:1': row } }, { seed: 'uno-dos-tres' });
        const board = one.boards.at(-1);
        expect(board.id).toBe('la-bodega');
        expect(board.locationName).toBe('El Pueblo de Barro');
        expect(board.map.length).toBeGreaterThan(0);
        expect(board.partyStart.length).toBeGreaterThan(0);
        expect(board.shape).toBeUndefined();
        expect(two.boards.at(-1).map).toEqual(board.map);
        expect(validatePack(one).ok).toBe(true);
    });

    // Lo que se ve en la ficha es lo que se juega.
    test('un tablero nuevo es el mismo que se vio en la ficha', () => {
        const pack = mil();
        const row = { ...newPackRow('tableros', { places: ['El Pueblo de Barro'], n: 1 }).row, shape: 'cave', size: 'small' };
        const seen = draftOf({ ...row, id: 'mio:1' }, 'uno-dos-tres');
        const out = applyPackEdits(pack, { tableros: { 'mio:1': { ...row, name: 'Otro nombre' } } }, { seed: 'uno-dos-tres' });
        // Renombrarlo no lo vuelve a dibujar: la clave es la del taller, no el nombre.
        expect(out.boards.at(-1).map).toEqual(seen.map);
    });

    test('un tablero del mundo retocado a mano se crea con lo pintado', () => {
        const pack = mil();
        const [stock] = packItems(pack, {}, 'tableros');
        const painted = paintCell({ map: stock.row.map, partyStart: stock.row.partyStart }, 1, 1, 'w');
        const out = applyPackEdits(pack, { tableros: { [stock.key]: { ...stock.row, ...painted } } });
        expect(out.boards[0].map).toEqual(painted.map);
        expect(out.boards[0].enemies).toEqual(stock.row.enemies);
        expect(validatePack(out).ok).toBe(true);
    });

    // Los enemigos no se enseñan en el taller: pintar encima de ellos no para nada, y al crear
    // se recolocan donde se puede estar y llegar. El paquete sale válido igual.
    test('pintar un muro encima de los enemigos escritos: al crear se recolocan y el mundo sigue valiendo', () => {
        const pack = mil();
        const [stock] = packItems(pack, {}, 'tableros');
        let draft = { map: stock.row.map, partyStart: stock.row.partyStart };
        for (const foe of stock.row.enemies) draft = paintCell(draft, foe.x, foe.y, '#');
        const item = { ...stock, changed: true, row: { ...stock.row, ...draft } };
        expect(packProblem(item, [item])).toBe('');
        const out = applyPackEdits(pack, { tableros: { [stock.key]: item.row } });
        for (const foe of out.boards[0].enemies) expect(out.boards[0].map[foe.y][foe.x]).not.toBe('#');
        expect(out.boards[0].enemies.map(e => e.name)).toEqual(stock.row.enemies.map(e => e.name));
        expect(validatePack(out).ok).toBe(true);
    });

    test('una facción y una persona nuevas entran con id propio', () => {
        const pack = mil();
        const out = applyPackEdits(pack, {
            facciones: { 'mio:1': { ...newPackRow('facciones', { places: ['Castillo de Vane'], n: 1 }).row, name: 'Los del Molino', goals: 'El molino.' } },
            personajes: { 'mio:1': { ...newPackRow('personajes', { places: ['El Pueblo de Barro'], n: 1 }).row, name: 'Tomasa', trade: 'Molinera' } },
        });
        const faction = out.world.factions.at(-1);
        expect(faction).toMatchObject({ id: 'los-del-molino', name: 'Los del Molino', seat: 'Castillo de Vane', holds: ['Castillo de Vane'] });
        expect(out.npcs.at(-1)).toMatchObject({ id: 'tomasa', name: 'Tomasa', where: 'El Pueblo de Barro' });
        expect(validatePack(out).ok).toBe(true);
    });
});

describe('en el taller', () => {
    const conPaquete = () => ({
        ...startTaller({ path: 'mundo', random: createSeededRandom('1387') }),
        fields: { worldName: '1387', seed: 'uno-dos-tres' },
        source: { pack: mil(), templateId: 'imported', metadata: {} },
    });

    test('guardar y volver al del mundo', () => {
        let state = writePackRow(conPaquete(), 'localidades', 'loc:0', { name: 'Barrizal' });
        expect(packEditsOf(state).localidades['loc:0'].name).toBe('Barrizal');
        state = dropPackRow(state, 'localidades', 'loc:0');
        expect(packEditsOf(state).localidades).toEqual({});
    });

    test('lo que no cuadra para el taller en su pestaña', () => {
        const state = writePackRow(conPaquete(), 'localidades', 'mio:1', { kind: 'sitio', name: 'Sin camino', routes: [] });
        expect(blocksNext(state, 'localidades')).toMatch(/desde dónde/);
        expect(blocksNext(conPaquete(), 'localidades')).toBe('');
    });

    test('tocar marca la pestaña como cambiada', () => {
        expect(stepSlice(writePackRow(conPaquete(), 'tableros', 'mio:1', { name: 'X' }), 'tableros'))
            .not.toBe(stepSlice(conPaquete(), 'tableros'));
    });

    test('y lo tocado viaja con el paquete al crear', () => {
        const state = writePackRow(conPaquete(), 'facciones', 'mio:1', { kind: 'faccion', name: 'Los del Molino', seat: '' });
        expect(toAnswers(state).importedPack.world.factions.at(-1).name).toBe('Los del Molino');
    });
});
