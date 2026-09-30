/**
 * J19.10: la magia fuera de combate (rules/field-magic.js), la ficha «Magia» de la fila y lo
 * que la Luz suma a examinar.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    fieldKind, darkHere, lightActive, lightLookBonus, fieldChoices, castField, roadHeal, describeCost, LIGHT_LOOK_BONUS,
} from '../public/scripts/game-engine/rules/field-magic.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';
import { rollCheck } from '../public/scripts/game-engine/rules/checks.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const classes = read('compendio/clases.json').rows;
const catalogue = read('compendio/conjuros.json').rows;
const cls = (/** @type {string} */ id) => classes.find((/** @type {any} */ r) => r.id === id);
const row = (/** @type {string} */ id) => catalogue.find((/** @type {any} */ r) => r.id === id);

/** Una clériga de nivel 5 con su símbolo: Luz, Curar heridas, Detectar magia y Hablar con los muertos. */
const cleric = (/** @type {any} */ extra = {}) => ({
    id: 'c1', name: 'Irena', class: 'Clérigo', level: 5, wisdom: 16, hp: 30, maxHp: 30,
    cantrips: ['mag-luz'], prepared: ['hab-curar', 'mag-oracion', 'conj-detectar-magia', 'mag-hablar-muertos'],
    slotsUsed: {}, items: [{ id: 'f1', name: 'Símbolo sagrado' }, { id: 'f2', name: 'Polvo de hueso' }],
    ...extra,
});
const murder = {
    active: {
        kind: 'asesinato', victim: 'Vasili',
        clues: [
            { id: 'k1', fact: 'Olía a ajo.', misleading: true },
            { id: 'k2', fact: 'Vio a alguien con una capa roja.', misleading: false },
        ],
    },
    found: [],
};
const choicesOf = (/** @type {any} */ member, /** @type {any} */ context = {}, classId = 'clerigo') =>
    fieldChoices({ member, classRow: cls(classId), catalogue, carried: member.items, context });
const pick = (/** @type {any[]} */ list, /** @type {string} */ id) => list.find(c => c.id === id);

describe('qué hace cada conjuro fuera de combate (J19.10)', () => {
    test('se deduce de sus columnas, y Hablar con los muertos por su id', () => {
        expect(fieldKind(row('mag-luz'))).toBe('luz');
        expect(fieldKind(row('hab-curar'))).toBe('curar');
        expect(fieldKind(row('mag-hablar-muertos'))).toBe('muertos');
        expect(fieldKind(row('conj-identificar'))).toBe('identify');
        expect(fieldKind(row('conj-proyectil-magico'))).toBe('');
    });

    test('a oscuras: de noche, en una cripta o en una mazmorra; de día en la calle, no', () => {
        expect(darkHere({ night: true })).toBe(true);
        expect(darkHere({ biome: 'cripta' })).toBe(true);
        expect(darkHere({ type: 'dungeon' })).toBe(true);
        expect(darkHere({ night: false, biome: 'calle' })).toBe(false);
    });

    test('cómo se dice lo que cuesta', () => {
        expect(describeCost('truco', 0)).toBe('Truco: no gasta nada');
        expect(describeCost('ritual', 0)).toBe('Ritual: diez minutos, sin espacio');
        expect(describeCost('espacio', 1)).toMatch(/^Un espacio de 1/);
    });
});

describe('lo que se puede lanzar ahora, y por qué no', () => {
    test('de día, sano y sin caso: Luz, Curar y el muerto dicen por qué no; Detectar magia va como ritual', () => {
        const list = choicesOf(cleric(), { night: false, party: [cleric()], cases: { active: null, found: [] } });
        expect(pick(list, 'mag-luz')).toMatchObject({ ok: false, reason: 'Aquí se ve bien: ahora no hace falta.', how: 'truco' });
        expect(pick(list, 'hab-curar')).toMatchObject({ ok: false, reason: 'Nadie está herido.' });
        expect(pick(list, 'mag-hablar-muertos')).toMatchObject({ ok: false, reason: 'No hay ningún muerto a quien preguntar.' });
        expect(pick(list, 'conj-detectar-magia')).toMatchObject({ ok: true, how: 'ritual', slotLevel: 0 });
    });

    test('de noche, la Luz se puede: alumbra el campamento', () => {
        const light = pick(choicesOf(cleric(), { night: true, party: [cleric()] }), 'mag-luz');
        expect(light).toMatchObject({ ok: true, how: 'truco', cost: 'Truco: no gasta nada' });
        expect(light.does).toMatch(/\+2 a examinar/);
        expect(light.does).toMatch(/acampáis/);
    });

    test('un conjuro que se sabe como ritual sale una vez, como ritual, aunque ahora no se pueda', () => {
        const wizard = { id: 'm1', name: 'Lía', class: 'Mago', level: 2, intelligence: 16, hp: 20, maxHp: 20,
            cantrips: ['mag-luz'], spellbook: ['conj-identificar', 'conj-detectar-magia', 'conj-proyectil-magico'],
            prepared: ['conj-identificar'], items: [{ id: 'b', name: 'Bolsa de componentes' }, { id: 'p', name: 'Perla' }] };
        const list = choicesOf(wizard, { party: [wizard], unknownItems: 0 }, 'mago');
        const ids = list.filter(c => c.id === 'conj-identificar');
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatchObject({ how: 'ritual', ok: false, reason: 'No lleváis nada sin identificar.' });
        expect(pick(choicesOf(wizard, { party: [wizard], unknownItems: 2 }, 'mago'), 'conj-identificar')).toMatchObject({ how: 'ritual', ok: true });
    });

    test('con un herido, Curar heridas cura al que más lo necesita', () => {
        const hurt = { id: 'g1', name: 'Gerd', hp: 4, maxHp: 20 };
        const me = cleric();
        const cure = pick(choicesOf(me, { party: [me, hurt] }), 'hab-curar');
        expect(cure).toMatchObject({ ok: true, how: 'espacio', slotLevel: 1 });
        expect(cure.does).toMatch(/Gerd/);
    });

    test('con un asesinato abierto, el muerto contesta', () => {
        const dead = pick(choicesOf(cleric(), { party: [cleric()], cases: murder }), 'mag-hablar-muertos');
        expect(dead).toMatchObject({ ok: true, how: 'espacio', slotLevel: 3 });
        expect(dead.does).toMatch(/Vasili/);
    });

    test('D-J27: el erudito solo tiene rituales, sin espacios', () => {
        const scholar = { id: 'e1', name: 'Olmo', class: 'Erudito', level: 3, intelligence: 14, hp: 20, maxHp: 20,
            spellbook: ['conj-detectar-magia', 'conj-identificar', 'conj-proyectil-magico'], items: [{ id: 'b', name: 'Bolsa de componentes' }] };
        const list = choicesOf(scholar, { party: [scholar] }, 'erudito');
        expect(list.length).toBeGreaterThan(0);
        expect(list.every(c => c.how === 'ritual' && c.slotLevel === 0)).toBe(true);
        expect(pick(list, 'conj-proyectil-magico')).toBeUndefined();
    });
});

describe('lanzarlo, y lo que cambia', () => {
    test('Luz: se enciende el día y la parte del día; dura esa parte, y a oscuras suma a examinar', () => {
        const calendar = { day: 3, slotIndex: 2 };
        const done = castField({ member: cleric(), classRow: cls('clerigo'), spell: row('mag-luz'), carried: cleric().items, context: { night: true, calendar, party: [cleric()] } });
        expect(done.ok).toBe(true);
        expect(done.slotsUsed).toBeNull();
        expect(done.effects.light).toEqual({ day: 3, slotIndex: 2, by: 'Irena' });
        expect(done.lines[0]).toMatch(/queda alumbrado/);
        expect(done.lines[0]).toMatch(/cuenta como un fuego/);
        expect(lightActive(done.effects.light, calendar)).toBe(true);
        expect(lightActive(done.effects.light, { day: 3, slotIndex: 3 })).toBe(false);
        expect(lightLookBonus(done.effects.light, calendar, true)).toBe(LIGHT_LOOK_BONUS);
        expect(lightLookBonus(done.effects.light, calendar, false)).toBe(0);
        // Ya encendida, no se vuelve a lanzar.
        const again = pick(choicesOf(cleric(), { night: true, calendar, light: done.effects.light, party: [cleric()] }), 'mag-luz');
        expect(again).toMatchObject({ ok: false, reason: 'Ya hay una Luz encendida.' });
    });

    test('Curar heridas gasta un espacio de 1.er nivel y sube la vida del herido', () => {
        const hurt = { id: 'g1', name: 'Gerd', hp: 4, maxHp: 20 };
        const done = castField({
            member: cleric(), classRow: cls('clerigo'), spell: row('hab-curar'), carried: cleric().items,
            context: { party: [cleric(), hurt] }, rollDice: () => 5,
        });
        expect(done.ok).toBe(true);
        expect(done.slotsUsed).toEqual({ 1: 1 });
        expect(done.effects.heal).toEqual([{ memberId: 'g1', name: 'Gerd', amount: 8, hp: 12 }]);
    });

    test('Hablar con los muertos da la pista buena, no la que despista', () => {
        const done = castField({ member: cleric(), classRow: cls('clerigo'), spell: row('mag-hablar-muertos'), carried: cleric().items, context: { party: [cleric()], cases: murder } });
        expect(done.ok).toBe(true);
        expect(done.slotLevel).toBe(3);
        expect(done.effects.clue?.id).toBe('k2');
    });

    test('«curar en el viaje»: lo más barato del grupo', () => {
        const hurt = { id: 'g1', name: 'Gerd', hp: 4, maxHp: 20 };
        const me = cleric();
        const pickHeal = roadHeal([{ member: me, choices: choicesOf(me, { party: [me, hurt] }) }]);
        expect(pickHeal?.choice.id).toBe('hab-curar');
        expect(roadHeal([{ member: me, choices: choicesOf(me, { party: [me] }) }])).toBeNull();
    });
});

describe('la fila de la escena y la tirada', () => {
    test('«Curar con magia» y «Magia: …» solo cuando sirven, y nunca en combate', () => {
        expect(buildActionChips({}).some(c => /^field-/.test(c.id))).toBe(false);
        const chips = buildActionChips({ magic: ['Luz', 'Identificar', 'Alarma'], heal: 'Curar heridas' });
        expect(chips.find(c => c.id === 'field-heal')?.label).toBe('Curar con magia (Curar heridas)');
        expect(chips.find(c => c.id === 'field-magic')?.label).toBe('Magia: Luz, Identificar');
        expect(chips.every(c => !c.command || !/^field-/.test(c.id))).toBe(true);
        expect(buildActionChips({ fighting: true, magic: ['Luz'], heal: 'Curar heridas' })).toEqual([]);
    });

    test('la Luz suma a examinar, y la tirada lo dice', () => {
        const member = { name: 'Irena', intelligence: 10 };
        const plain = rollCheck({ member, skill: 'investigation', rollD20: () => 9, dc: 12 });
        const lit = rollCheck({ member, skill: 'investigation', rollD20: () => 9, dc: 12, bonus: 2, bonusWhy: 'la Luz' });
        expect(lit?.total).toBe(Number(plain?.total) + 2);
        expect(lit?.modifier).toBe(Number(plain?.modifier) + 2);
        expect(lit?.said).toMatch(/\+2 por la Luz/);
        expect(plain?.said).not.toMatch(/Luz/);
    });
});
