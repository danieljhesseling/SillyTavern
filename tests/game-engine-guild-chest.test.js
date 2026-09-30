import { describe, test, expect } from '@jest/globals';
import {
    chestView, putInChest, takeFromChest, depositGold, withdrawGold, payPlan, spendFromChest, itemKind, itemNote,
} from '../public/scripts/game-engine/campaign/guild-chest.js';
import { STORAGE_SLOTS } from '../public/scripts/game-engine/campaign/storage.js';
import { readGuild } from '../public/scripts/game-engine/campaign/guild.js';

const sword = { id: 'i1', name: 'Espada larga', type: 'weapon', slot: 'weapon', damageDice: '1d8', magicalBonus: 1 };
const mail = { id: 'i2', name: 'Cota de malla', type: 'armor', slot: 'body', armorClass: 16 };
const potion = (/** @type {string} */ id) => ({ id, name: 'Poción de curación', type: 'gear' });
const ring = { id: 'i9', name: 'Anillo negro', type: 'gear', cursed: true };

const tessa = () => ({ id: 1, name: 'Tessa', gold: 40, items: [sword, mail, potion('p1'), ring], equippedItems: { body: 'i2' } });
const gerd = () => ({ id: 2, name: 'Gerd el Mellado', gold: 0, items: [], equippedItems: {}, guest: { kind: 'mercenary' } });

describe('J3.4: el cofre del gremio, a la vista', () => {
    test('lo de dentro, agrupado y en orden: armas, armaduras y lo demás', () => {
        const view = chestView({ storage: [potion('p2'), potion('p3'), mail, sword], party: [], guild: { gold: 120 } });
        expect(view).toMatchObject({ slots: STORAGE_SLOTS, used: 4, gold: 120 });
        expect(view.stored.map(g => [g.name, g.count, g.kind])).toEqual([
            ['Espada larga', 1, 'weapon'], ['Cota de malla', 1, 'armor'], ['Poción de curación', 2, 'gear'],
        ]);
        expect(view.stored[2].ids).toEqual(['p2', 'p3']);
        expect(view.stored[0].note).toBe('+1 · 1d8');
        expect(view.stored[1].note).toBe('CA 16');
    });

    test('lo que lleva cada uno: lo puesto y lo maldito, apagados y con su porqué', () => {
        const view = chestView({ storage: [], party: [tessa(), gerd()], guild: null });
        const mine = view.carried[0];
        expect(mine).toMatchObject({ name: 'Tessa', gold: 40 });
        expect(mine.items.find(i => i.id === 'i2')).toMatchObject({ canStore: false, why: 'Lo lleva puesto: quítatelo antes en la ficha.' });
        expect(mine.items.find(i => i.id === 'i9')).toMatchObject({ canStore: false, why: 'Está maldito: no se suelta.' });
        expect(mine.items.find(i => i.id === 'i1')?.canStore).toBe(true);
        expect(view.carried[1].name).toBe('Gerd el Mellado');
    });

    test('lleno, nada más cabe, y lo dice', () => {
        const full = Array.from({ length: STORAGE_SLOTS }, (_, i) => potion(`x${i}`));
        const view = chestView({ storage: full, party: [tessa()], guild: null });
        expect(view.carried[0].items.find(i => i.id === 'i1')?.why).toBe(`El cofre está lleno (${STORAGE_SLOTS}).`);
        expect(putInChest(tessa(), full, 'i1').ok).toBe(false);
    });
});

describe('J3.4: dejar y sacar, para quien se elija', () => {
    test('se deja, y se saca para otro del grupo: el cofre es de todos', () => {
        const put = putInChest(tessa(), [], 'i1');
        expect(put.ok).toBe(true);
        expect(put.items.map(i => i.id)).not.toContain('i1');
        expect(put.line).toBe('Tessa deja Espada larga en el cofre del gremio.');
        const took = takeFromChest(gerd(), put.storage, 'i1');
        expect(took.ok).toBe(true);
        expect(took.items.map(i => i.id)).toEqual(['i1']);
        expect(took.storage).toEqual([]);
        expect(took.line).toBe('Gerd el Mellado saca Espada larga del cofre del gremio.');
    });

    test('lo puesto no se deja, ni lo maldito, ni lo que no está', () => {
        expect(putInChest(tessa(), [], 'i2').reason).toMatch(/puesto/);
        expect(putInChest(tessa(), [], 'i9').reason).toMatch(/maldito/);
        expect(takeFromChest(tessa(), [], 'nada').ok).toBe(false);
        expect(takeFromChest({ ...tessa(), dead: true }, [sword], 'i1').ok).toBe(false);
    });
});

describe('J3.4: el arca, el oro de todos', () => {
    test('se deja oro y lo saca otro', () => {
        const left = depositGold(tessa(), null, 30);
        expect(left).toMatchObject({ ok: true, gold: 10 });
        expect(readGuild(left.guild).gold).toBe(30);
        expect(left.line).toBe('Tessa deja 30 de oro en el arca del gremio. En el arca hay 30.');
        const out = withdrawGold(gerd(), left.guild, 30);
        expect(out).toMatchObject({ ok: true, gold: 30 });
        expect(readGuild(out.guild).gold).toBeUndefined();
        expect(out.line).toMatch(/El arca se queda vacía/);
    });

    test('no se deja más de lo que se lleva, ni se saca más de lo que hay', () => {
        expect(depositGold(tessa(), null, 50).reason).toBe('Tessa solo lleva 40 de oro.');
        expect(withdrawGold(tessa(), { gold: 5 }, 10).reason).toBe('En el arca solo hay 5 de oro.');
        expect(withdrawGold(tessa(), null, 10).reason).toBe('El arca está vacía.');
        expect(depositGold(tessa(), null, 0).ok).toBe(false);
    });

    test('lo del gremio se paga primero del arca y lo que falte de las bolsas', () => {
        expect(payPlan({ cost: 100, guild: { gold: 60 }, purse: 50 })).toMatchObject({ ok: true, fromChest: 60, fromPurse: 40 });
        expect(payPlan({ cost: 100, guild: { gold: 60 }, purse: 30 })).toMatchObject({ ok: false });
        expect(payPlan({ cost: 100, guild: { gold: 60 }, purse: 30 }).line).toBe('No llega el oro: cuesta 100, y entre el arca y vuestras bolsas hay 90.');
        expect(payPlan({ cost: 40, guild: null, purse: 50 }).line).toBe('Se paga de vuestras bolsas: 40 de oro.');
        expect(readGuild(spendFromChest({ gold: 60 }, 60)).gold).toBeUndefined();
        expect(readGuild(spendFromChest({ gold: 60 }, 20)).gold).toBe(40);
    });

    test('un gremio de antes, sin arca, se lee igual', () => {
        expect(readGuild({ renown: 3 })).toEqual({ name: '', theme: 'general', renown: 3, buildings: {}, staff: [] });
    });
});

describe('qué es cada cosa', () => {
    test('arma, armadura o lo demás', () => {
        expect(itemKind(sword)).toBe('weapon');
        expect(itemKind(mail)).toBe('armor');
        expect(itemKind({ name: 'Escudo', slot: 'shield', armorClass: 2 })).toBe('armor');
        expect(itemKind(potion('p'))).toBe('gear');
        expect(itemNote({ name: 'Escudo', slot: 'shield', armorClass: 2 })).toBe('+2 CA');
        expect(itemNote(ring)).toBe('maldito');
    });
});
