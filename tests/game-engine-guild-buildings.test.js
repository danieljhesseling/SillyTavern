import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    houseView, buildInGuild, buildingOpens, forgeOffers, forgeItem, libraryOffers, learnSpell, stableMount, stableMounts,
    journeyWithStable, guildHirelings, recruitArrival, GUILD_RECRUITS, FORGE_WEAPON, FORGE_ARMOR, LIBRARY_PRICES, BUILDING_ORDER,
} from '../public/scripts/game-engine/campaign/guild-buildings.js';
import { BUILDINGS, readGuild } from '../public/scripts/game-engine/campaign/guild.js';
import { HIRELINGS } from '../public/scripts/game-engine/campaign/guests.js';
import { journeyLine, hubCampaignCards } from '../public/scripts/game-engine/campaign/hub.js';
import { classRowFor } from '../public/scripts/game-engine/rules/spell-slots.js';
import { weaponBonus, armourClassOf } from '../public/scripts/game-engine/rules/equipment.js';

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const classes = read('../public/compendio/clases.json');
const classRows = classes.rows ?? classes;
const spells = read('../public/compendio/conjuros.json');
const catalogue = spells.rows ?? spells;
const classRowOf = (/** @type {any} */ m) => classRowFor(String(m.class ?? ''), classRows);
const strahd = read('../public/mundos/mundos.json').worlds.find((/** @type {any} */ w) => w.id === 'strahd');

const sword = { id: 's1', name: 'Espada larga', type: 'weapon', slot: 'weapon', damageDice: '1d8' };
const mail = { id: 'a1', name: 'Cota de malla', type: 'armor', slot: 'body', armorClass: 16, dexMode: 'none' };
const tessa = () => ({ id: 1, name: 'Tessa', class: 'Guerrera', level: 3, gold: 500, items: [sword, mail], equippedItems: { weapon: 's1', body: 'a1' } });

describe('J3.6: la casa, edificio a edificio', () => {
    test('cada edificio dice lo que abre en cada nivel, uno por nivel', () => {
        for (const key of BUILDING_ORDER) {
            expect(buildingOpens(key)).toHaveLength(BUILDINGS[/** @type {keyof typeof BUILDINGS} */ (key)].cost.length);
        }
        expect(BUILDINGS.stable.cost).toEqual([150, 350]);
    });

    test('sin nada levantado: lo que abriría el primero, lo que cuesta y cómo se pagaría', () => {
        const rows = houseView({ guild: { gold: 100 }, purse: 100 });
        expect(rows.map(r => r.key)).toEqual(BUILDING_ORDER);
        const forge = rows[0];
        expect(forge).toMatchObject({ label: 'Forja', level: 0, max: 3, icon: 'fa-hammer', open: [] });
        expect(forge.next).toMatchObject({ level: 1, cost: 180, ok: true, opens: 'Mejorar un arma a +1: suma al ataque y al daño.' });
        expect(forge.next?.pay).toBe('Se pagan 100 del arca y 80 de vuestras bolsas.');
        expect(houseView({ guild: null, purse: 10 })[0].next?.why).toMatch(/^No llega el oro/);
    });

    test('levantar cobra del arca primero y abre lo suyo', () => {
        const done = buildInGuild({ guild: { gold: 100 }, key: 'stable', purse: 100 });
        expect(done).toMatchObject({ ok: true, cost: 150, fromChest: 100, fromPurse: 50 });
        expect(readGuild(done.guild)).toMatchObject({ buildings: { stable: 1 } });
        expect(readGuild(done.guild).gold).toBeUndefined();
        expect(done.line).toMatch(/^Establo de nivel 1, levantado por 150 de oro\. Mulas para todo el grupo/);
        expect(buildInGuild({ guild: { buildings: { stable: 2 } }, key: 'stable', purse: 999 }).reason).toBe('Establo: ya está al máximo.');
        expect(buildInGuild({ guild: null, key: 'piscina', purse: 999 }).ok).toBe(false);
    });
});

describe('J3.6: la forja mejora armas y armaduras', () => {
    test('sin forja no se ofrece nada, y se dice dónde levantarla', () => {
        expect(forgeOffers({ guild: null, party: [tessa()], purse: 999 })).toMatchObject({ level: 0, offers: [], empty: expect.stringMatching(/La casa/) });
    });

    test('con forja 1: el arma a +1; la armadura espera a la forja 2', () => {
        const { offers } = forgeOffers({ guild: { buildings: { forge: 1 } }, party: [tessa()], purse: 999 });
        expect(offers.map(o => [o.itemName, o.label, o.cost, o.ok])).toEqual([
            ['Espada larga', 'Espada larga: de +0 a +1', FORGE_WEAPON[0].cost, true],
            ['Cota de malla', 'Cota de malla: reforzarla, +1 a la clase de armadura', FORGE_ARMOR.cost, false],
        ]);
        expect(offers[1].why).toBe('Hace falta la forja de nivel 2.');
    });

    test('mejorar el arma se nota en el combate: +1 al ataque y al daño', () => {
        const hero = tessa();
        const done = forgeItem({ member: hero, itemId: 's1', guild: { buildings: { forge: 1 } }, purse: 999 });
        expect(done.ok).toBe(true);
        expect(weaponBonus({ ...hero, items: done.items })).toBe(1);
        expect(done.line).toBe('En la forja del gremio, Tessa deja Espada larga en +1. 150 de oro.');
        // Del +1 al +2 hace falta la forja 2.
        const again = forgeOffers({ guild: { buildings: { forge: 1 } }, party: [{ ...hero, items: done.items }], purse: 999 }).offers[0];
        expect(again).toMatchObject({ label: 'Espada larga: de +1 a +2', ok: false, why: 'Hace falta la forja de nivel 2.' });
    });

    test('reforzar la armadura sube la clase de armadura, una sola vez', () => {
        const hero = tessa();
        const done = forgeItem({ member: hero, itemId: 'a1', guild: { buildings: { forge: 2 } }, purse: 999 });
        expect(done.ok).toBe(true);
        const before = armourClassOf({ member: hero, dexModifier: 0 }).armorClass;
        const after = armourClassOf({ member: { ...hero, items: done.items }, dexModifier: 0 }).armorClass;
        expect(after).toBe(before + 1);
        expect(forgeOffers({ guild: { buildings: { forge: 3 } }, party: [{ ...hero, items: done.items }], purse: 999 }).offers.some(o => o.kind === 'armor')).toBe(false);
    });

    test('sin oro no se mejora, y se dice cuánto hay', () => {
        const done = forgeItem({ member: tessa(), itemId: 's1', guild: { buildings: { forge: 1 } }, purse: 20 });
        expect(done.ok).toBe(false);
        expect(done.reason).toMatch(/^No llega el oro: cuesta 150/);
    });
});

describe('J3.6: la biblioteca enseña conjuros', () => {
    const maga = { id: 5, name: 'Ada', class: 'Maga', level: 3, spellbook: ['conj-proyectil-magico'], cantrips: [] };
    // «Curar heridas» es `hab-curar` en conjuros.json.
    const bardo = { id: 6, name: 'Lio', class: 'Bardo', level: 1, spellsKnown: ['hab-curar'] };
    const clériga = { id: 7, name: 'Sor Ana', class: 'Clériga', level: 3 };

    test('sin biblioteca no hay de dónde aprender', () => {
        expect(libraryOffers({ guild: null, party: [maga], classRowOf, catalogue }).empty).toMatch(/levántala en «La casa»/);
    });

    test('la maga copia a su libro hasta el nivel de la biblioteca, y nunca lo que ya tiene', () => {
        const { readers } = libraryOffers({ guild: { buildings: { library: 1 } }, party: [maga], classRowOf, catalogue });
        expect(readers[0].mode).toBe('copy');
        expect(readers[0].options.every(o => o.level === 1)).toBe(true);
        expect(readers[0].options.some(o => o.id === 'conj-proyectil-magico')).toBe(false);
        expect(readers[0].options[0].cost).toBe(LIBRARY_PRICES.copy);
        // Con la biblioteca 2 llega al nivel 2: una maga de nivel 3 ya los lanza.
        const two = libraryOffers({ guild: { buildings: { library: 2 } }, party: [maga], classRowOf, catalogue }).readers[0];
        expect(two.options.some(o => o.level === 2)).toBe(true);
        expect(two.options.some(o => o.level === 3)).toBe(false);
    });

    test('copiar lo apunta en el libro y cobra por nivel', () => {
        const pick = libraryOffers({ guild: { buildings: { library: 2 } }, party: [maga], classRowOf, catalogue }).readers[0].options.find(o => o.level === 2);
        const done = learnSpell({ member: maga, guild: { buildings: { library: 2 } }, classRowOf, catalogue, spellId: String(pick?.id), purse: 999 });
        expect(done.ok).toBe(true);
        expect(done.patch.spellbook).toEqual(['conj-proyectil-magico', pick?.id]);
        expect(done.cost).toBe(LIBRARY_PRICES.copy * 2);
        expect(done.line).toMatch(/^Ada copia «.+» en su libro, en la biblioteca del gremio\. 100 de oro\.$/);
    });

    test('el bardo cambia uno que sabe por otro', () => {
        const reader = libraryOffers({ guild: { buildings: { library: 1 } }, party: [bardo], classRowOf, catalogue }).readers[0];
        expect(reader.mode).toBe('swap');
        expect(reader.known.map(k => k.id)).toEqual(['hab-curar']);
        const other = reader.options[0];
        const done = learnSpell({ member: bardo, guild: { buildings: { library: 1 } }, classRowOf, catalogue, spellId: other.id, forget: 'hab-curar', purse: 999 });
        expect(done.ok).toBe(true);
        expect(done.patch.spellsKnown).toEqual([other.id]);
        expect(learnSpell({ member: bardo, guild: { buildings: { library: 1 } }, classRowOf, catalogue, spellId: other.id, purse: 999 }).reason).toBe('Di qué conjuro deja de saber.');
    });

    test('la clériga prepara de su lista entera: aquí no tiene nada que aprender; el guerrero no sale', () => {
        const { readers } = libraryOffers({ guild: { buildings: { library: 3 } }, party: [clériga, tessa()], classRowOf, catalogue });
        expect(readers.map(r => [r.name, r.mode])).toEqual([['Sor Ana', 'none']]);
    });
});

describe('J3.6: el establo lleva al grupo montado', () => {
    test('mulas y luego caballos, una por cabeza', () => {
        expect(stableMount(null)).toBe('');
        expect(stableMounts({ buildings: { stable: 1 } }, 3)).toEqual({ mula: 3 });
        expect(stableMounts({ buildings: { stable: 2 } }, 2)).toEqual({ caballo: 2 });
        expect(stableMounts(null, 2)).toEqual({});
    });

    test('el camino a Strahd se acorta, en su tarjeta y en el viaje contado', () => {
        expect(journeyWithStable(strahd, null, 2)).toBe(strahd);
        const mules = journeyWithStable(strahd, { buildings: { stable: 1 } }, 2);
        expect(mules.journey.days).toBe(7);
        const horses = journeyWithStable(strahd, { buildings: { stable: 2 } }, 2);
        expect(horses.journey.days).toBe(5);
        expect(hubCampaignCards({ worlds: [horses] })[0].distance).toBe('A cinco días de camino');
        expect(journeyLine({ world: horses, home: 'Puerto Alba' })).toMatch(/Con los caballos del establo del gremio llegáis cuatro días antes\. Cinco días de camino\.$/);
        expect(journeyLine({ world: mules, home: 'Puerto Alba' })).toMatch(/Con las mulas del establo del gremio llegáis dos días antes/);
    });
});

describe('J3.6: más camas, más espadas de alquiler', () => {
    test('una más por nivel de los dormitorios', () => {
        expect(guildHirelings(null)).toEqual(HIRELINGS);
        expect(guildHirelings({ buildings: { bunks: 1 } }).map(h => h.name)).toEqual([...HIRELINGS.map(h => h.name), 'Iria Salitre']);
        expect(guildHirelings({ buildings: { bunks: 3 } })).toHaveLength(HIRELINGS.length + GUILD_RECRUITS.length);
    });

    test('quien llega se presenta', () => {
        expect(recruitArrival(2)).toMatch(/^Bastián Tresmareas deja su petate en los dormitorios nuevos\..*Ya se puede contratar\.$/);
        expect(recruitArrival(9)).toBe('');
    });
});
