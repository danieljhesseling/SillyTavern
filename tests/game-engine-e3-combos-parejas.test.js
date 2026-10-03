/**
 * E3.2 de wiki/ROADMAP_ENTRETENIDO.md: combos de vínculo para todos. Cualquier pareja del grupo
 * con vínculo 3 va a una, cada uno desde donde llega con su arma, y la jugada tiene nombre, orden
 * y lo que deja según los papeles de los dos.
 */
import { describe, test, expect } from '@jest/globals';
import {
    PAIR_RANK, PAIR_COMBOS, ROLES, ROLE_EFFECT, comboKey, pairCombo, pairOptions, pairRank, roleOf, shootsFar, pairLine,
} from '../public/scripts/game-engine/rules/pair-moves.js';
import { bondSheetRows } from '../public/scripts/game-engine/combat/bond-moves.js';

const bow = { id: 'arco', name: 'Arco largo', category: 'distancia', rangeFeet: 150 };
const sword = { id: 'espada', name: 'Espada larga', subcategory: 'martial_melee' };

describe('E3.2: el papel de cada uno', () => {
    test('por su oficio; el explorador y quien no tiene oficio, por su arma', () => {
        expect(roleOf({ class: 'Guerrero' })).toBe('frente');
        expect(roleOf({ className: 'paladín' })).toBe('frente');
        expect(roleOf({ class: 'Pícara' })).toBe('sombra');
        expect(roleOf({ class: 'Maga' })).toBe('magia');
        expect(roleOf({ class: 'brujo' })).toBe('magia');
        expect(roleOf({ class: 'Clérigo' })).toBe('apoyo');
        expect(roleOf({ class: 'bardo' })).toBe('apoyo');
        expect(roleOf({ class: 'explorador', items: [bow], equippedItems: { weapon: 'arco' } })).toBe('tirador');
        expect(roleOf({ class: 'explorador', items: [sword], equippedItems: { weapon: 'espada' } })).toBe('frente');
        expect(roleOf({ name: 'Cazadora', items: [bow], equippedItems: { weapon: 'arco' } })).toBe('tirador');
        expect(roleOf({ name: 'Matón' })).toBe('frente');
        expect(shootsFar({ items: [{ id: 'b', name: 'Ballesta ligera' }], equippedItems: { weapon: 'b' } })).toBe(true);
    });

    test('cada papel deja algo, y cada pareja de papeles tiene su jugada con nombre y frase', () => {
        const roles = Object.keys(ROLES);
        expect(roles).toHaveLength(5);
        for (const role of roles) expect(ROLE_EFFECT[/** @type {keyof typeof ROLE_EFFECT} */ (role)]).toBeTruthy();
        const keys = new Set();
        for (const a of roles) {
            for (const b of roles) keys.add(comboKey(/** @type {any} */ (a), /** @type {any} */ (b)));
        }
        expect(keys.size).toBe(15);
        for (const key of keys) {
            expect(PAIR_COMBOS[key]?.name).toBeTruthy();
            expect(PAIR_COMBOS[key]?.say).toBeTruthy();
        }
        // Los nombres no se repiten.
        expect(new Set(Object.values(PAIR_COMBOS).map(c => c.name)).size).toBe(15);
        expect(comboKey('tirador', 'frente')).toBe('frente+tirador');
    });
});

describe('E3.2: la jugada de dos según sus papeles', () => {
    test('el que dispara abre y el que va delante se queda cubriéndole', () => {
        const combo = pairCombo({ id: 'g', name: 'Gerd el Mellado', role: 'frente' }, { id: 'n', name: 'Nella Tresflechas', role: 'tirador' });
        expect(combo.name).toBe('Yo lo paro, tú tiras');
        expect(combo.order).toEqual(['n', 'g']);
        expect(combo.effects).toEqual([
            { kind: 'cubrir', by: 'g', on: 'n' },
            { kind: 'vendido', by: 'n', on: '' },
        ]);
        expect(combo.describe).toMatch(/^Pegáis los dos con ventaja: primero Nella, luego Gerd\./);
        expect(combo.describe).toContain('Gerd se queda cubriendo a Nella');
        expect(combo.describe).toContain('Nella le deja vendido');
    });

    test('la sombra remata la última; dos de delante se cubren el uno al otro', () => {
        const sneak = pairCombo({ id: 'p', name: 'Iria', role: 'sombra' }, { id: 'o', name: 'Osric', role: 'frente' });
        expect(sneak.name).toBe('Tú lo entretienes');
        expect(sneak.order).toEqual(['o', 'p']);
        expect(sneak.effects.map(e => e.kind).sort()).toEqual(['cubrir', 'despistar']);

        const wall = pairCombo({ id: 'g', name: 'Gerd', role: 'frente' }, { id: 'o', name: 'Osric', role: 'frente' });
        expect(wall.name).toBe('Muro de escudos');
        expect(wall.order).toEqual(['g', 'o']);
        expect(wall.effects).toEqual([{ kind: 'cubrir', by: 'g', on: 'o' }, { kind: 'cubrir', by: 'o', on: 'g' }]);
    });

    test('dos del mismo papel que dejan algo al enemigo lo dejan una vez; el apoyo bendice a su pareja', () => {
        const archers = pairCombo({ id: 'a', name: 'Ana', role: 'tirador' }, { id: 'b', name: 'Bea', role: 'tirador' });
        expect(archers.effects).toEqual([{ kind: 'vendido', by: 'a', on: '' }]);
        const blessed = pairCombo({ id: 'c', name: 'Cura', role: 'apoyo' }, { id: 'm', name: 'Maga', role: 'magia' });
        expect(blessed.name).toBe('Luz y conjuro');
        expect(blessed.order).toEqual(['m', 'c']);
        expect(blessed.effects).toEqual([{ kind: 'bendecir', by: 'c', on: 'm' }, { kind: 'frenar', by: 'm', on: '' }]);
    });
});

describe('E3.2: cualquier pareja del grupo', () => {
    const hero = { id: 'h', name: 'Iria', x: 5, y: 5, hp: 10, rank: 0, role: /** @type {const} */ ('sombra') };
    const gerd = { id: 'g', name: 'Gerd el Mellado', x: 6, y: 6, hp: 10, rank: 4, role: /** @type {const} */ ('frente') };
    const osric = { id: 'o', name: 'Osric', x: 4, y: 6, hp: 10, rank: 3, role: /** @type {const} */ ('frente') };
    const nella = { id: 'n', name: 'Nella', x: 5, y: 1, hp: 10, rank: 5, reachFeet: 150, role: /** @type {const} */ ('tirador') };
    const tess = { id: 't', name: 'Tess', x: 6, y: 5, hp: 10, rank: 2, role: /** @type {const} */ ('frente') };
    const wolf = { id: 'w', name: 'Lobo', x: 5, y: 6, hp: 7 };

    test('el vínculo de la pareja: el tuyo con él; el de dos compañeros, el del que menos se fía', () => {
        expect(pairRank(hero, gerd, 'h')).toBe(4);
        expect(pairRank(gerd, hero, 'h')).toBe(4);
        expect(pairRank(gerd, osric, 'h')).toBe(3);
        expect(pairRank(gerd, tess, 'h')).toBe(2);
        expect(PAIR_RANK).toBe(3);
    });

    test('dos compañeros van a una entre ellos, y la arquera se suma desde lejos', () => {
        const party = [hero, gerd, osric, nella, tess];
        const fromGerd = pairOptions({ actor: gerd, heroId: 'h', party, enemies: [wolf] });
        expect(fromGerd.map(o => o.partnerId).sort()).toEqual(['h', 'n', 'o']);
        const withOsric = fromGerd.find(o => o.partnerId === 'o');
        expect(withOsric?.combo.name).toBe('Muro de escudos');
        expect(withOsric?.companionId).toBe('o');
        // Contigo, habla él (el del vínculo).
        expect(fromGerd.find(o => o.partnerId === 'h')?.companionId).toBe('g');
        expect(fromGerd.find(o => o.partnerId === 'n')?.combo.name).toBe('Yo lo paro, tú tiras');
        // Tess (vínculo 2) ni empieza ni se suma.
        expect(pairOptions({ actor: tess, heroId: 'h', party, enemies: [wolf] })).toEqual([]);
        expect(fromGerd.some(o => o.partnerId === 't')).toBe(false);
    });

    test('quien no llega con su arma no entra; sin la reacción, tampoco; el juego no gasta la tuya', () => {
        const party = [hero, gerd, { ...nella, reachFeet: 5 }, osric];
        expect(pairOptions({ actor: gerd, heroId: 'h', party, enemies: [wolf] }).some(o => o.partnerId === 'n')).toBe(false);
        const used = [hero, gerd, { ...osric, reactionUsed: true }];
        expect(pairOptions({ actor: gerd, heroId: 'h', party: used, enemies: [wolf] }).map(o => o.partnerId)).toEqual(['h']);
        expect(pairOptions({ actor: gerd, heroId: 'h', party: [hero, gerd, osric], enemies: [wolf], withHero: false }).map(o => o.partnerId)).toEqual(['o']);
        const far = { ...wolf, x: 9, y: 9 };
        expect(pairOptions({ actor: gerd, heroId: 'h', party: [hero, gerd, osric], enemies: [far] })).toEqual([]);
    });

    test('la línea del registro dice el nombre de la jugada', () => {
        expect(pairLine('Gerd', 'Osric', 'Lobo', 'Muro de escudos')).toBe('🤝 Muro de escudos: Gerd y Osric van a una contra Lobo, los dos con ventaja.');
    });
});

describe('E3.2: en la ficha', () => {
    test('la fila del vínculo 3 dice vuestra jugada por los papeles de los dos', () => {
        const rows = bondSheetRows({ name: 'Nella Tresflechas', class: 'explorador', items: [bow], equippedItems: { weapon: 'arco' } }, 3, { name: 'Iria', class: 'guerrero' });
        const three = rows.filter(r => r.rank === 3).map(r => r.label);
        expect(three).toEqual(['Ataque de seguimiento', 'Yo lo paro, tú tiras']);
        expect(rows.find(r => r.label === 'Yo lo paro, tú tiras')?.describe).toMatch(/^En pareja: Pegáis los dos con ventaja: primero Nella, luego Iria\./);
    });
});
