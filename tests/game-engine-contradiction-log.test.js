import { describe, test, expect } from '@jest/globals';
import {
    findContradictions, appendContradictions, summariseContradictions,
} from '../public/scripts/game-engine/ui/contradiction-log.js';

const facts = {
    party: [{ name: 'Lyra', hp: 12, maxHp: 20 }, { name: 'Brand', hp: 0, maxHp: 24 }],
    enemies: [{ name: 'Guardián del grano', currentHp: 9, maxHp: 26 }],
    slotLabel: 'Mañana',
    combatActive: true,
};

describe('somebody said to be down who is not', () => {
    // The failure this exists for: "el goblin cae" written about a goblin at full health.
    test('a death that did not happen is reported', () => {
        const found = findContradictions('El Guardián cae de rodillas, vencido.', facts);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ kind: 'muerte' });
        expect(found[0].message).toMatch(/sigue con 9 PG/);
    });

    // The model writes "el Guardián" for "Guardián del grano": a check that demanded the
    // full name would find nothing and look like it worked.
    test('a shortened name still matches', () => {
        expect(findContradictions('El Guardián perece.', facts)).toHaveLength(1);
    });

    test('a death that did happen is not reported', () => {
        expect(findContradictions('Brand se desploma sin sentido.', facts)).toEqual([]);
    });

    test('somebody merely hurt is not a contradiction', () => {
        expect(findContradictions('Lyra sangra y aprieta los dientes.', facts)).toEqual([]);
    });

    test('a name nobody has is ignored', () => {
        expect(findContradictions('El rey dragón cae fulminado.', facts)).toEqual([]);
    });
});

describe('hit points that do not match the sheet', () => {
    test('a wrong total is reported, with both numbers', () => {
        const found = findContradictions('Lyra queda a 3 PG.', facts);
        expect(found[0]).toMatchObject({ kind: 'puntos de vida' });
        expect(found[0].message).toMatch(/en 3 PG; el motor tiene 12/);
    });

    test('the right total is not', () => {
        expect(findContradictions('Lyra queda a 12 PG.', facts)).toEqual([]);
    });

    test('other ways of saying it are read too', () => {
        expect(findContradictions('Lyra está en 5 puntos de vida.', facts)).toHaveLength(1);
        expect(findContradictions('Lyra baja a 7 HP.', facts)).toHaveLength(1);
    });
});

describe('a fight that is not happening', () => {
    test('declaring combat with no encounter is reported', () => {
        const found = findContradictions('Tirad iniciativa.', { ...facts, combatActive: false });
        expect(found[0]).toMatchObject({ kind: 'combate' });
    });

    test('and declaring it during one is not', () => {
        expect(findContradictions('Tirad iniciativa.', { ...facts, combatActive: true })).toEqual([]);
    });
});

describe('the time of day', () => {
    test('a scene set at the wrong time is reported', () => {
        const found = findContradictions('Por la noche, el molino cruje.', facts);
        expect(found[0]).toMatchObject({ kind: 'momento del día' });
        expect(found[0].message).toMatch(/Mañana/);
    });

    test('the right one is not', () => {
        expect(findContradictions('Es la mañana más fría del año.', facts)).toEqual([]);
    });

    test('and with no calendar there is nothing to contradict', () => {
        expect(findContradictions('Por la noche todo calla.', { ...facts, slotLabel: '' })).toEqual([]);
    });
});

describe('nothing to check', () => {
    test('empty text and empty facts are safe', () => {
        expect(findContradictions('', facts)).toEqual([]);
        expect(findContradictions('   ', facts)).toEqual([]);
        expect(findContradictions('Lyra cae.', {})).toEqual([]);
        expect(findContradictions(null, null)).toEqual([]);
    });
});

describe('the running log', () => {
    const one = [{ kind: 'muerte', claim: 'x cae', fact: 'x tiene 3 PG', message: 'mal' }];

    test('keeps what was found, stamped with the day', () => {
        const log = appendContradictions(null, one, { day: 3, at: '2026-09-21' });
        expect(log.entries).toHaveLength(1);
        expect(log.entries[0]).toMatchObject({ kind: 'muerte', day: 3, at: '2026-09-21' });
        expect(log.total).toBe(1);
    });

    test('finding nothing leaves it alone', () => {
        const log = appendContradictions({ entries: [], total: 5 }, []);
        expect(log).toEqual({ entries: [], total: 5 });
    });

    // Old entries stop being data and start being weight.
    test('it stops growing at a hundred, but keeps counting', () => {
        let log = { entries: [], total: 0 };
        for (let i = 0; i < 120; i++) log = appendContradictions(log, one, { day: i });
        expect(log.entries).toHaveLength(100);
        expect(log.total).toBe(120);
        expect(log.entries[0].day).toBe(20);
    });

    test('junk in the stored log does not throw', () => {
        expect(appendContradictions('roto', one).entries).toHaveLength(1);
        expect(appendContradictions({ entries: 'no' }, one).entries).toHaveLength(1);
    });
});

describe('what the log adds up to', () => {
    // One contradiction is an accident; twenty of the same kind is a prompt that needs a
    // line adding to it.
    test('grouped by kind, biggest first', () => {
        const log = {
            total: 4,
            entries: [
                { kind: 'muerte', message: 'a' },
                { kind: 'muerte', message: 'b' },
                { kind: 'combate', message: 'c' },
                { kind: 'muerte', message: 'd' },
            ],
        };
        const summary = summariseContradictions(log);
        expect(summary.byKind[0]).toEqual({ kind: 'muerte', count: 3, last: 'd' });
        expect(summary.byKind[1].kind).toBe('combate');
        expect(summary).toMatchObject({ total: 4, kept: 4 });
    });

    test('an empty log says nothing happened', () => {
        expect(summariseContradictions(null)).toEqual({ total: 0, kept: 0, byKind: [] });
        expect(summariseContradictions({ entries: [] }).byKind).toEqual([]);
    });

    test('the total survives the entries being trimmed', () => {
        expect(summariseContradictions({ total: 200, entries: [{ kind: 'muerte' }] }))
            .toMatchObject({ total: 200, kept: 1 });
    });
});
