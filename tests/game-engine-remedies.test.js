import { describe, test, expect } from '@jest/globals';
import { INJURY_TABLE, applyInjury } from '../public/scripts/game-engine/rules/injuries.js';
import {
    DEFAULT_REMEDIES, readRemedies, remediesFor, applyRemedy, shouldOfferRetirement,
} from '../public/scripts/game-engine/rules/remedies.js';
import {
    STAFF_ROLES, MAX_STAFF, readGuild, retireTo, upkeepWithBuildings, boardSize, describeGuild,
} from '../public/scripts/game-engine/campaign/guild.js';

const injury = (/** @type {string} */ id) => INJURY_TABLE.find(i => i.id === id);

/** Bruna, con lo que le toque encima. */
function bruna(/** @type {string[]} */ ids = []) {
    /** @type {any} */
    let member = { name: 'Bruna', speed: 30, dexterity: 14, strength: 12, constitution: 12, wisdom: 10, maxHp: 20 };
    for (const id of ids) {
        const patch = applyInjury(member, injury(id));
        member = { ...member, injuries: patch.injuries, baseStats: patch.baseStats, ...patch.stats };
    }
    return member;
}

describe('los remedios', () => {
    test('hay uno para cada herida que no cura', () => {
        const permanent = INJURY_TABLE.filter(i => i.days === 0).map(i => i.id).sort();
        expect(Object.keys(DEFAULT_REMEDIES).sort()).toEqual(permanent);
    });

    test('solo se ofrecen para lo que no cura, y dicen si llega el oro', () => {
        const member = bruna(['lost_leg', 'sprain']);
        const list = remediesFor(member, 100);
        expect(list.map(o => o.injuryId)).toEqual(['lost_leg']);
        expect(list[0].affordable).toBe(false);
        expect(remediesFor(member, 150)[0].affordable).toBe(true);
    });

    test('la pierna de palo cambia la herida, no la borra', () => {
        const member = bruna(['lost_leg']);
        expect(member.speed).toBe(15);
        const patch = applyRemedy(member, 'lost_leg');
        expect(patch?.injuries.map(i => i.id)).toEqual(['wooden_leg']);
        expect(patch?.injuries[0].permanent).toBe(true);
        expect(patch?.stats.speed).toBe(25);
        // Y lo que quitaba la pierna perdida vuelve.
        expect(patch?.stats.dexterity).toBe(14);
    });

    test('la bendición cierra del todo', () => {
        const member = bruna(['gut_wound']);
        const patch = applyRemedy(member, 'gut_wound');
        expect(patch?.injuries).toEqual([]);
        expect(patch?.stats.maxHp).toBe(20);
    });

    test('sin esa herida, no hay nada que arreglar', () => {
        expect(applyRemedy(bruna(['sprain']), 'lost_leg')).toBeNull();
        expect(applyRemedy(bruna(['lost_leg']), 'no_existe')).toBeNull();
    });

    test('las demás heridas se quedan como estaban', () => {
        const patch = applyRemedy(bruna(['lost_eye', 'broken_arm']), 'lost_eye');
        expect(patch?.injuries.map(i => i.id).sort()).toEqual(['broken_arm', 'glass_eye']);
    });

    test('una tabla propia se pone encima de la de serie', () => {
        const table = readRemedies({ lost_leg: { label: 'Pata mágica', cost: 999, becomes: null } });
        expect(table.lost_leg.label).toBe('Pata mágica');
        expect(table.lost_eye).toEqual(DEFAULT_REMEDIES.lost_eye);
    });
});

describe('cuándo se ofrece el retiro', () => {
    test('dos heridas para siempre', () => {
        expect(shouldOfferRetirement(bruna(['lost_eye', 'lost_hand']))).toBe(true);
    });

    test('o una que le quite un tercio de las piernas', () => {
        expect(shouldOfferRetirement(bruna(['lost_leg']))).toBe(true);
    });

    test('un ojo solo, no', () => {
        expect(shouldOfferRetirement(bruna(['lost_eye']))).toBe(false);
    });
});

describe('los puestos del gremio', () => {
    test('retirarse deja a alguien en casa', () => {
        const result = retireTo(readGuild({}), 'Bruna', 'consejero');
        expect(result.ok).toBe(true);
        expect(result.guild.staff).toEqual([{ name: 'Bruna', role: 'consejero' }]);
        expect(result.line).toMatch(/Bruna se queda en casa/);
    });

    test('un puesto que no existe, no', () => {
        expect(retireTo(readGuild({}), 'Bruna', 'rey').ok).toBe(false);
    });

    test('la casa tiene un límite', () => {
        const full = readGuild({ staff: Array.from({ length: MAX_STAFF }, (_, i) => ({ name: `P${i}`, role: 'intendente' })) });
        expect(retireTo(full, 'Bruna', 'consejero').ok).toBe(false);
    });

    test('el consejero trae un encargo más al tablón', () => {
        expect(boardSize(readGuild({ staff: [{ name: 'Bruna', role: 'consejero' }] }))).toBe(5);
    });

    test('el intendente abarata la comida como una cocina', () => {
        const prices = upkeepWithBuildings({ foodPerDay: 2 }, readGuild({ staff: [{ name: 'Bruna', role: 'intendente' }] }));
        expect(prices.foodPerDay).toBe(2 + STAFF_ROLES.intendente.effect.foodPerDay);
    });

    test('al leer, se tira lo que no tiene sentido', () => {
        const read = readGuild({ staff: [{ name: '', role: 'consejero' }, { name: 'X', role: 'rey' }, null] });
        expect(read.staff).toEqual([]);
    });

    test('se dice quién está en casa', () => {
        const text = describeGuild(readGuild({ name: 'La Rueda', staff: [{ name: 'Bruna', role: 'curandero' }] }));
        expect(text).toMatch(/en casa: Bruna \(curandero de casa\)/);
    });
});
