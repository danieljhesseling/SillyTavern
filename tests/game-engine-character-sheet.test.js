import { describe, test, expect } from '@jest/globals';
import {
    SHEET_ABILITIES, modifierOf, equipmentOf, buildCharacterSheet, describeSheet,
} from '../public/scripts/game-engine/ui/shell/character-sheet.js';
import { applyInjury, INJURY_TABLE } from '../public/scripts/game-engine/rules/injuries.js';

const SLOTS = {
    head: { label: 'Cabeza', icon: 'fa-hat-wizard' },
    body: { label: 'Cuerpo', icon: 'fa-shirt' },
    weapon: { label: 'Arma', icon: 'fa-sword' },
};

const CATALOGUE = [
    { id: 'bendecir', name: 'Bendecir', cost: 'action', resource: 'long_rest', usesPerRest: 2, rangeFeet: 30 },
    { id: 'parada', name: 'Parada', cost: 'reaction', resource: 'at_will', usesPerRest: 0, rangeFeet: 5 },
];

const lyra = (extra = {}) => ({
    name: 'Lyra', avatar: 'img/lyra.png', race: 'Media elfa', class: 'Pícara', level: 3,
    hp: 18, maxHp: 24, armorClass: 15, speed: 30,
    strength: 9, dexterity: 17, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14,
    xp: 900, xpNext: 2700, gold: 40,
    abilities: ['bendecir', 'parada'],
    abilityUses: { bendecir: 1 },
    equippedItems: { weapon: { name: 'Daga mellada' } },
    items: [{ name: 'Cuerda de seda', type: 'gear', weight: 2.5 }],
    ...extra,
});

const sheet = (extra = {}) => buildCharacterSheet({
    member: lyra(extra), slotInfo: SLOTS, abilities: CATALOGUE,
});

describe('quién es', () => {
    test('nombre, cara y una línea con raza, nivel y clase', () => {
        const card = sheet();
        expect(card.name).toBe('Lyra');
        expect(card.avatar).toBe('img/lyra.png');
        expect(card.title).toBe('Media elfa · Nivel 3 Pícara');
    });

    test('y sin raza tampoco queda un hueco raro', () => {
        expect(sheet({ race: '' }).title).toBe('Nivel 3 Pícara');
    });
});

describe('la salud', () => {
    test('lo que queda, de cuánto, y en qué proporción', () => {
        const health = sheet().health;
        expect(health.hp).toBe(18);
        expect(health.maxHp).toBe(24);
        expect(health.fraction).toBeCloseTo(0.75);
        expect(health.hurt).toBe(false);
    });

    test('avisa cuando queda poco', () => {
        expect(sheet({ hp: 6 }).health.hurt).toBe(true);
    });

    test('y dice cuando está en el suelo', () => {
        expect(sheet({ hp: 0 }).health.down).toBe(true);
    });

    // El resto del tiempo son tres ceros que no significan nada.
    test('las salvaciones de muerte solo salen si se están jugando', () => {
        expect(sheet().deathSaves).toBeNull();
        const dying = sheet({ hp: 0, deathSaves: { successes: 1, failures: 2, stable: false, dead: false } });
        expect(dying.deathSaves).toMatchObject({ successes: 1, failures: 2 });
    });
});

describe('las características', () => {
    test('las seis, en el orden de una hoja', () => {
        expect(sheet().stats.map(s => s.key)).toEqual(SHEET_ABILITIES.map(([key]) => key));
    });

    // Un 14 no dice nada por si solo; un "+2" dice cuanto mejor eres.
    test('con su modificador, que es lo que de verdad se suma', () => {
        expect(modifierOf(10)).toBe(0);
        expect(modifierOf(17)).toBe(3);
        expect(modifierOf(9)).toBe(-1);
        expect(sheet().stats.find(s => s.key === 'dexterity').modifier).toBe(3);
    });

    test('y lo que defiende: CA, velocidad e iniciativa', () => {
        const defence = sheet().defence;
        expect(defence.armorClass).toBe(15);
        expect(defence.speed).toBe(30);
        expect(defence.initiative).toBe(3);
    });
});

describe('lo que lleva puesto', () => {
    test('ranura por ranura', () => {
        const worn = equipmentOf(lyra(), SLOTS);
        expect(worn.find(s => s.slot === 'weapon').item).toBe('Daga mellada');
    });

    // Un hueco es informacion: es donde puedes mejorar.
    test('incluidas las vacías, que también dicen algo', () => {
        const worn = equipmentOf(lyra(), SLOTS);
        expect(worn).toHaveLength(3);
        expect(worn.find(s => s.slot === 'body').empty).toBe(true);
    });

    test('y aguanta que lo equipado sea solo un nombre', () => {
        const worn = equipmentOf({ equippedItems: { head: 'Capucha' } }, SLOTS);
        expect(worn.find(s => s.slot === 'head').item).toBe('Capucha');
    });

    test('lo que carga, con su peso', () => {
        expect(sheet().inventory).toEqual([
            { name: 'Cuerda de seda', type: 'gear', weight: 2.5, equipped: false },
        ]);
    });
});

describe('lo que sabe hacer', () => {
    test('solo las que se sabe, con lo que le queda', () => {
        const known = sheet().abilities;
        expect(known.map(a => a.id)).toEqual(['bendecir', 'parada']);
        expect(known.find(a => a.id === 'bendecir').left).toBe(1);
    });

    test('las que son a voluntad no cuentan usos', () => {
        expect(sheet().abilities.find(a => a.id === 'parada').left).toBeNull();
    });

    test('y se ve cuál está gastada', () => {
        const spent = buildCharacterSheet({
            member: lyra({ abilityUses: { bendecir: 2 } }), slotInfo: SLOTS, abilities: CATALOGUE,
        });
        expect(spent.abilities.find(a => a.id === 'bendecir').spent).toBe(true);
    });
});

describe('lo que le pasa ahora mismo', () => {
    // Una ficha que no dice que te falta una pierna no es una ficha.
    test('las heridas que arrastra', () => {
        const member = lyra();
        const patch = applyInjury(member, INJURY_TABLE.find(i => i.id === 'broken_leg'));
        Object.assign(member, { injuries: patch.injuries });

        const card = buildCharacterSheet({ member, slotInfo: SLOTS, abilities: CATALOGUE });
        expect(card.injuries.join(' ')).toMatch(/Pierna rota/);
    });

    test('el hambre y la sed', () => {
        expect(sheet({ needs: { thirst: 60 } }).needs).toMatch(/sed/);
    });

    test('y las condiciones', () => {
        expect(sheet({ activeConditions: ['Poisoned'] }).conditions).toEqual(['Poisoned']);
    });

    test('quien está entero no arrastra nada', () => {
        const card = sheet();
        expect(card.injuries).toEqual([]);
        expect(card.needs).toBe('');
        expect(card.conditions).toEqual([]);
    });
});

describe('el progreso', () => {
    test('nivel, experiencia y lo que falta', () => {
        const progress = sheet().progress;
        expect(progress.level).toBe(3);
        expect(progress.xp).toBe(900);
        expect(progress.xpNext).toBe(2700);
    });
});

describe('contado en una línea', () => {
    test('la vida siempre, y lo demás solo si lo hay', () => {
        expect(describeSheet(sheet())).toBe('18/24 PG');
    });

    test('y con algo encima, lo dice', () => {
        const said = describeSheet(sheet({ needs: { thirst: 60 }, activeConditions: ['Poisoned'] }));
        expect(said).toMatch(/18\/24 PG/);
        expect(said).toMatch(/sed/);
        expect(said).toMatch(/Poisoned/);
    });
});
