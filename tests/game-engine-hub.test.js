import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    readHub, isHubWorld, hubHomeOf, withHubChat, withHubCampaign, hubCampaignCards, hubCampaignWorldName,
    carryEntry, entryFromMember, settleCarried, hubRoster, hireOffers, answersForWorld, hubPartyLine, HUB_KEY, HUB_HOME_KEY,
    journeyDays, journeySpan, journeyLine, hubDay, HUB_START_GOLD, HUB_NEXT_HERO_GOLD,
} from '../public/scripts/game-engine/campaign/hub.js';
import { guestMember, HIRELINGS, MERCENARY_FEE } from '../public/scripts/game-engine/campaign/guests.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('el gremio guardado', () => {
    test('lo roto se lee vacío, sin romper', () => {
        expect(readHub(null)).toEqual({ chat: null, campaigns: {} });
        expect(readHub({ campaigns: { x: { worldName: '' }, y: 'no' } })).toEqual({ chat: null, campaigns: {} });
    });

    test('se sabe qué mundo es un gremio y de cuál sale una campaña', () => {
        expect(isHubWorld({ [HUB_KEY]: {} })).toBe(true);
        expect(isHubWorld({})).toBe(false);
        expect(hubHomeOf({ [HUB_HOME_KEY]: 'El Gremio' })).toBe('El Gremio');
        expect(hubHomeOf({})).toBe('');
    });

    test('recuerda su chat y las campañas que empieza', () => {
        let hub = withHubChat({}, { file: 'La posadera - hoy', avatar: 'posadera.png' });
        hub = withHubCampaign(hub, 'strahd', { worldName: 'Strahd · Tessa', chat: { file: 'Algo - hoy', avatar: 'a.png' } });
        hub = withHubCampaign(hub, 'strahd', { finished: true, ending: 'Barovia, libre' });
        expect(hub.chat).toEqual({ file: 'La posadera - hoy', avatar: 'posadera.png' });
        expect(hub.campaigns.strahd).toEqual({
            worldName: 'Strahd · Tessa', chat: { file: 'Algo - hoy', avatar: 'a.png' }, finished: true, ending: 'Barovia, libre',
        });
    });

    test('D-J12: el día del gremio suma lo vivido en sus campañas', () => {
        let hub = withHubCampaign({}, 'strahd', { worldName: 'Strahd · Tessa', day: 12 });
        hub = withHubCampaign(hub, '1387', { worldName: '1387 · Bram', day: 1 });
        expect(hub.campaigns.strahd.day).toBe(12);
        // Ponerla al día sin decir el día no lo borra.
        expect(withHubCampaign(hub, 'strahd', { finished: true }).campaigns.strahd.day).toBe(12);
        // Día 3 en el gremio, 11 en Strahd (del 1 al 12) y ninguno en 1387.
        expect(hubDay({ hub, day: 3 })).toBe(14);
        expect(hubDay({ hub: null, day: 0 })).toBe(1);
        expect(readHub({ campaigns: { x: { worldName: 'X', day: 'no' } } }).campaigns.x).not.toHaveProperty('day');
    });

    test('D-J11: el primero llega con cien de oro; los siguientes, con diez', () => {
        expect(HUB_START_GOLD).toBe(100);
        expect(HUB_NEXT_HERO_GOLD).toBe(10);
    });
});

describe('el tablón de campañas', () => {
    const worlds = [
        { id: 'costa', name: 'La costa' },
        { id: '1387', name: '1387', pack: '/mundos/1387.pack.json', levels: [1, 4] },
        { id: 'strahd', name: 'Strahd', pack: '/mundos/strahd.pack.json', levels: [2, 6] },
    ];

    test('solo salen las que traen su historia escrita', () => {
        expect(hubCampaignCards({ worlds }).map(c => c.id)).toEqual(['1387', 'strahd']);
    });

    test('dice cómo va cada una y qué botón toca', () => {
        const hub = withHubCampaign({}, '1387', { worldName: '1387 · Tessa' });
        const cards = hubCampaignCards({ worlds, hub, level: 1 });
        expect(cards[0]).toMatchObject({ state: 'en-curso', action: 'Seguir', levels: 'Nivel recomendado: 1 a 4', warn: '' });
        expect(cards[1]).toMatchObject({ state: 'nueva', action: 'Empezar' });
        expect(cards[1].warn).toMatch(/nivel 1/);
    });

    test('J4.6: avisa si os viene grande o si vais por encima, y qué hacen los enemigos', () => {
        const [small, big] = hubCampaignCards({ worlds, level: 1 });
        expect(small.warn).toBe('');
        expect(big.warn).toBe('No es para un grupo sin experiencia: empieza en el nivel 2 y tu grupo es de nivel 1. Si vais, los enemigos aflojan un poco, pero no del todo.');
        expect(hubCampaignCards({ worlds, level: 4 }).map(c => c.warn)).toEqual(['', '']);
        expect(hubCampaignCards({ worlds, level: 7 }).map(c => c.warn)).toEqual([
            'Tu grupo es de nivel 7, más de lo que pide: los enemigos aprietan más.',
            'Tu grupo es de nivel 7, más de lo que pide: los enemigos aprietan más.',
        ]);
        // Empezada ya no se avisa: eso se dice en la pelea.
        const hub = withHubCampaign({}, '1387', { worldName: '1387 · Tessa' });
        expect(hubCampaignCards({ worlds, hub, level: 7 })[0].warn).toBe('');
    });

    test('D-J22: el nivel recomendado se ve aparte, y una que empieza en el 10 avisa a un grupo sin experiencia', () => {
        const high = [{ id: 'dragon', name: 'El Dragón', pack: '/mundos/dragon.pack.json', levels: [10, 14] },
            { id: 'solo', name: 'Solo', pack: '/mundos/solo.pack.json', levels: [5] },
            { id: 'sin', name: 'Sin niveles', pack: '/mundos/sin.pack.json' }];
        const [dragon, solo, sin] = hubCampaignCards({ worlds: high, level: 3 });
        expect(dragon).toMatchObject({ levels: 'Nivel recomendado: 10 a 14', minLevel: 10, hard: true });
        expect(dragon.warn).toBe('No es para un grupo sin experiencia: empieza en el nivel 10 y tu grupo es de nivel 3. Si vais, los enemigos aflojan un poco, pero no del todo.');
        expect(solo).toMatchObject({ levels: 'Nivel recomendado: 5', hard: true });
        expect(sin).toMatchObject({ levels: '', minLevel: 0, hard: false, warn: '' });
        // A su nivel, ni aviso ni naranja.
        expect(hubCampaignCards({ worlds: high, level: 10 })[0]).toMatchObject({ hard: false, warn: '' });
        // Empezada, el nivel se sigue viendo; el aviso, no: eso se dice en la pelea.
        const hub = withHubCampaign({}, 'dragon', { worldName: 'El Dragón · Tessa' });
        expect(hubCampaignCards({ worlds: high, hub, level: 3 })[0]).toMatchObject({ levels: 'Nivel recomendado: 10 a 14', hard: true, warn: '' });
    });

    test('el nombre del mundo lleva a quien la juega, y no pisa otro', () => {
        expect(hubCampaignWorldName('Strahd', 'Tessa', [])).toBe('Strahd · Tessa');
        expect(hubCampaignWorldName('Strahd', 'Tessa', ['strahd · tessa'])).toBe('Strahd · Tessa (2)');
    });

    test('las respuestas para crearla sin taller importan su paquete', () => {
        const answers = answersForWorld({ world: worlds[2], pack: { version: 1 }, worldName: 'Strahd · Tessa' });
        expect(answers).toMatchObject({ templateId: 'imported', worldName: 'Strahd · Tessa', party: [], importedPack: { version: 1 } });
    });
});

describe('el viaje se cuenta', () => {
    const strahd = { id: 'strahd', name: 'La Maldición de Strahd', journey: { days: 9, how: 'Vais en carro por el camino del este.' } };

    test('los días van con letra hasta doce', () => {
        expect(journeySpan(1)).toBe('un día');
        expect(journeySpan(9)).toBe('nueve días');
        expect(journeySpan(12)).toBe('doce días');
        expect(journeySpan(15)).toBe('15 días');
        expect(journeySpan(0)).toBe('');
        expect(journeyDays({ journey: { days: '4' } })).toBe(4);
        expect(journeyDays({})).toBe(0);
    });

    test('la ida dice de dónde, adónde, cómo y cuánto', () => {
        expect(journeyLine({ world: strahd, home: 'Puerto Alba' }))
            .toBe('Salís de Puerto Alba hacia La Maldición de Strahd. Vais en carro por el camino del este. Nueve días de camino.');
        // Sin «cómo» se salta esa frase; y «el gremio» se contrae.
        expect(journeyLine({ world: { name: '1387', journey: { days: 1 } } }))
            .toBe('Salís del gremio hacia 1387. Un día de camino.');
    });

    test('la vuelta dice cuánto se tardó y adónde se vuelve', () => {
        expect(journeyLine({ world: strahd, home: 'Puerto Alba', back: true }))
            .toBe('Nueve días de camino después, volvéis a Puerto Alba con lo ganado.');
        expect(journeyLine({ world: strahd, back: true }))
            .toBe('Nueve días de camino después, volvéis al gremio con lo ganado.');
    });

    test('sin días no hay viaje que contar', () => {
        expect(journeyLine({ world: { name: 'X' } })).toBe('');
        expect(journeyLine({ world: { name: 'X', journey: { days: 0, how: 'Algo.' } }, back: true })).toBe('');
    });

    test('la tarjeta del tablón dice lo lejos que queda', () => {
        const cards = hubCampaignCards({ worlds: [
            { ...strahd, pack: '/mundos/strahd.pack.json' },
            { id: 'cerca', name: 'Cerca', pack: '/mundos/cerca.pack.json' },
        ] });
        expect(cards.map(c => c.distance)).toEqual(['A nueve días de camino', '']);
    });
});

describe('llevar al grupo de un chat a otro', () => {
    const hero = { id: 1, name: 'Tessa', wiUid: 4, worldName: 'El Gremio', level: 3, hp: 12, maxHp: 20, gold: 57, items: [{ id: 'i1', name: 'Espada' }], mapPosition: { locationName: 'Puerto Alba', gridX: 2, gridY: 2 } };
    const merc = { id: 2, name: 'Gerd el Mellado', wiUid: null, guest: { kind: 'mercenary', contractId: 'gremio' }, hp: 16, mapPosition: { locationName: 'Puerto Alba', gridX: 3, gridY: 2 } };

    test('llega entero, con la ficha del mundo nuevo, donde estaba el primero', () => {
        const here = [{ ...hero, hp: 20, gold: 0, wiUid: 9, mapPosition: { locationName: 'Aldea de Barovia', gridX: 7, gridY: 9 } }];
        const party = settleCarried({ carried: [hero, merc], here, worldName: 'Strahd · Tessa', uids: { tessa: 9 }, lead: here[0].mapPosition });
        expect(party[0]).toMatchObject({ name: 'Tessa', hp: 12, gold: 57, level: 3, wiUid: 9, worldName: 'Strahd · Tessa' });
        expect(party[0].mapPosition).toEqual({ locationName: 'Aldea de Barovia', gridX: 7, gridY: 9 });
        expect(party[0].items).toEqual([{ id: 'i1', name: 'Espada' }]);
        // El mercenario no tiene ficha en ningún mundo, y aparece al lado.
        expect(party[1]).toMatchObject({ name: 'Gerd el Mellado', wiUid: null, worldName: 'Strahd · Tessa' });
        expect(party[1].mapPosition).toEqual({ locationName: 'Aldea de Barovia', gridX: 8, gridY: 9 });
    });

    test('no toca lo que sale: es una copia', () => {
        const party = settleCarried({ carried: [hero], here: [], worldName: 'X' });
        party[0].items.push({ id: 'i2' });
        expect(hero.items).toHaveLength(1);
    });

    test('la ficha se copia sin arrastrar su uid', () => {
        const copy = carryEntry({ uid: 4, comment: 'Tessa', key: ['Tessa'], content: 'Pícara', group: 'Characters', dndData: { entityType: 'character', level: 3 } });
        expect(copy).toEqual({ comment: 'Tessa', key: ['Tessa'], content: 'Pícara', group: 'Characters', dndData: { entityType: 'character', level: 3 } });
    });

    test('la línea de la portada dice quién va', () => {
        expect(hubPartyLine([{ ...hero, class: 'Pícaro' }, merc])).toBe('Tessa (Pícaro, nivel 3), con Gerd el Mellado');
        expect(hubPartyLine([])).toBe('');
    });
});

describe('los mercenarios del gremio', () => {
    test('están los tres, con el precio del nivel del héroe', () => {
        const offers = hireOffers({ hirelings: HIRELINGS, party: [{ id: 1, name: 'Tessa', level: 2 }], fee: MERCENARY_FEE });
        expect(offers).toHaveLength(3);
        expect(offers.every(o => o.fee === MERCENARY_FEE * 2 && !o.hired)).toBe(true);
    });

    test('el que ya va contigo sale contratado, con su id para despedirle', () => {
        const party = [{ id: 1, name: 'Tessa', level: 1 }, { id: 5, name: 'Nella Tresflechas', guest: { kind: 'mercenary' } }];
        const nella = hireOffers({ hirelings: HIRELINGS, party, fee: MERCENARY_FEE }).find(o => o.name === 'Nella Tresflechas');
        expect(nella).toMatchObject({ hired: true, id: '5' });
    });

    // Antes llegaba con el oro del héroe: el grupo tenía el doble de lo que tenía.
    test('un mercenario llega sin el oro ni las habilidades del héroe', () => {
        const merc = guestMember({ id: 9, name: 'Gerd', kind: 'mercenary', contractId: 'gremio', level: 1, base: { name: 'Tessa', gold: 80, abilities: ['sigilo'], avatar: 'tessa.png' } });
        expect(merc).toMatchObject({ gold: 0, abilities: [], name: 'Gerd' });
        expect(merc.avatar).not.toBe('tessa.png');
    });
});

describe('los paquetes que se juegan desde el gremio', () => {
    test('el gremio es un paquete válido, con su prueba y su hilo', () => {
        const pack = read('../public/mundos/gremio.pack.json');
        const found = validatePack(pack);
        expect(found.errors).toEqual([]);
        expect(found.ok).toBe(true);
        const plot = readPlot(pack.plot);
        expect(plot?.milestones[0].opens.kind).toBe('start');
        expect(pack.locations[0].services).toEqual(expect.arrayContaining(['posada', 'tienda', 'templo']));
    });

    // J3.10: la base es un pueblo, y el gremio está en su plaza.
    test('el gremio está en Puerto Alba, con quien atiende cada servicio', () => {
        const pack = read('../public/mundos/gremio.pack.json');
        const town = pack.locations[0];
        expect(town.name).toBe('Puerto Alba');
        // J3.8: los tableros son de Puerto Alba o de los sitios de sus encargos, que empiezan
        // escondidos y a un día de camino.
        const errandSpots = pack.locations.filter(l => l.hidden).map(l => l.name);
        expect(pack.boards.every(b => b.locationName === town.name || errandSpots.includes(b.locationName))).toBe(true);
        expect(pack.locations.filter(l => l.hidden).every(l => l.routes.some(r => r.to === town.name))).toBe(true);
        expect(pack.npcs.every(n => n.where === town.name)).toBe(true);
        for (const service of town.services) {
            expect(pack.npcs.filter(n => n.service === service)).toHaveLength(1);
        }
        expect(pack.rumors.length).toBeGreaterThanOrEqual(4);
        expect(pack.rumors.every(r => r.where === town.name && ['si', 'no', 'medias'].includes(r.truth))).toBe(true);
        // El prólogo (J2.1) sigue mandando a la bodega: la prueba de e2e-gremio lo busca.
        expect(pack.plot.milestones.find((/** @type {any} */ m) => m.id === 'la-prueba').scene).toMatch(/Baja a la bodega/);
    });

    test('Strahd es válido y su hilo llega a un final', () => {
        const pack = read('../public/mundos/strahd.pack.json');
        expect(validatePack(pack).ok).toBe(true);
        const plot = readPlot(pack.plot);
        const boards = new Set(pack.boards.map(b => b.name));
        const asked = (plot?.milestones ?? []).filter(m => m.asks.kind === 'win').map(m => m.asks.board);
        expect(asked.length).toBeGreaterThan(8);
        expect(asked.filter(name => !boards.has(name))).toEqual([]);
        expect(Object.keys(plot?.endings ?? {})).toContain('barovia-libre');
        // Ni rastro de las marcas del resumidor.
        expect(JSON.stringify(pack)).not.toMatch(/\[cite/);
    });

    test('en el tablón hay al menos 1387 y Strahd', () => {
        const worlds = read('../public/mundos/mundos.json').worlds;
        expect(hubCampaignCards({ worlds }).map(c => c.id)).toEqual(expect.arrayContaining(['1387', 'strahd']));
    });

    // J4.9: cada campaña del tablón dice lo lejos que queda del pueblo.
    test('toda campaña con paquete dice cuántos días de camino hay', () => {
        const worlds = read('../public/mundos/mundos.json').worlds.filter(w => w.pack);
        expect(worlds.length).toBeGreaterThan(0);
        expect(worlds.filter(w => !(Number(w.journey?.days) > 0)).map(w => w.id)).toEqual([]);
        expect(worlds.filter(w => !String(w.journey?.how ?? '').trim()).map(w => w.id)).toEqual([]);
    });
});

describe('la ficha que viaja', () => {
    // Si subió de nivel en la campaña, la ficha del gremio iba por detrás.
    test('lleva los números de ahora, no los de cuando se escribió', () => {
        const entry = { comment: 'Tessa', key: ['Tessa'], content: 'x', group: 'Characters', dndData: { entityType: 'character', level: 1, maxHp: 12, charClass: 'Guerrero', image: 'tessa.png' } };
        const copy = carryEntry(entry, { name: 'Tessa', level: 3, maxHp: 28, class: 'Guerrero', avatar: '' });
        expect(copy.dndData).toMatchObject({ entityType: 'character', level: 3, maxHp: 28, charClass: 'Guerrero', image: 'tessa.png' });
        expect(entry.dndData.level).toBe(1);
    });
});

describe('la ficha que falta', () => {
    // Si la ficha del mundo de salida ya no está, se rehace con lo que se sabe del grupo.
    test('se rehace con el nombre, el oficio y los números', () => {
        const entry = entryFromMember({ name: 'Tessa', race: 'Humana', class: 'Pícaro', level: 2, maxHp: 18, dexterity: 16, avatar: 'tessa.png' });
        expect(entry).toMatchObject({ comment: 'Tessa', key: ['Tessa'], group: 'Characters', content: 'Tessa: Humana, Pícaro.' });
        expect(entry.dndData).toMatchObject({ entityType: 'character', charClass: 'Pícaro', level: 2, maxHp: 18, dex: 16, image: 'tessa.png' });
    });
});

describe('los mercenarios entrenan', () => {
    test('al cambiar de chat suben al nivel del héroe, con su vida', () => {
        const party = hubRoster([
            { id: 1, name: 'Tessa', level: 3 },
            { id: 2, name: 'Gerd', level: 1, maxHp: 16, hp: 10, guest: { kind: 'mercenary' } },
        ]);
        expect(party[1]).toMatchObject({ level: 3, maxHp: 28, hp: 22 });
    });

    test('el que cayó no vuelve; el escoltado no se toca', () => {
        const party = hubRoster([
            { id: 1, name: 'Tessa', level: 2 },
            { id: 2, name: 'Gerd', level: 1, dead: true, guest: { kind: 'mercenary' } },
            { id: 3, name: 'Tomás', level: 1, maxHp: 10, guest: { kind: 'ward' } },
        ]);
        expect(party.map(m => m.name)).toEqual(['Tessa', 'Tomás']);
        expect(party[1].level).toBe(1);
    });
});
