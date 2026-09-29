import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, THIRD_CASTER_SLOTS, PACT_SLOTS,
    casterOf, classRowFor, slotsFor, slotsLeft, lowestFreeSlot, spendSlot, recoverSlots,
    spellcastingStats, describeSlots, stepValue,
} from '../public/scripts/game-engine/rules/spell-slots.js';
import {
    cantripsKnown, spellsKnownCount, preparedLimit, spellbookSize, maxSpellLevel,
    cantripMultiplier, scaleCantrip, classSpellList, isCastableBy, castableSpells, ritualSpells,
    checkPreparation, spellChoicesAtLevel, coverageGaps,
} from '../public/scripts/game-engine/rules/spell-prep.js';
import { normalizeSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const classes = read('compendio/clases.json').rows;
const catalogue = read('compendio/conjuros.json').rows;
const cls = (/** @type {string} */ id) => classes.find((/** @type {any} */ r) => r.id === id);
const spell = (/** @type {string} */ id) => normalizeSpell(catalogue.find((/** @type {any} */ r) => r.id === id));

/** Un brujo de mentira: el pacto no lo usa ninguna clase del compendio todavía. */
const brujo = { id: 'brujo', name: 'Brujo', casting: { progression: 'pact', ability: 'charisma', mode: 'known', cantrips: { 1: 2, 4: 3, 10: 4 } } };
/** Y un tercio de lanzador, que saca los conjuros de la lista del mago. */
const caballero = { id: 'caballero', casting: { progression: 'third', ability: 'intelligence', mode: 'known', list: 'mago' } };

describe('los espacios de conjuro (J19.1)', () => {
    test('un mago de nivel 5 tiene 4, 3 y 2 espacios', () => {
        const table = slotsFor(cls('mago'), 5);
        expect(table.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
        expect(table.maxLevel).toBe(3);
        expect(table.progression).toBe('full');
    });

    test('las tablas del SRD: completo, medio y un tercio', () => {
        expect(slotsFor(cls('clerigo'), 1).slots).toEqual({ 1: 2 });
        expect(slotsFor(cls('druida'), 20).slots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
        // El explorador no lanza en el nivel 1, y en el 5 llega al 2.º nivel.
        expect(slotsFor(cls('explorador'), 1).slots).toEqual({});
        expect(slotsFor(cls('explorador'), 2).slots).toEqual({ 1: 2 });
        expect(slotsFor(cls('explorador'), 5).slots).toEqual({ 1: 4, 2: 2 });
        expect(slotsFor(caballero, 2).slots).toEqual({});
        expect(slotsFor(caballero, 3).slots).toEqual({ 1: 2 });
        expect(slotsFor(caballero, 7).slots).toEqual({ 1: 4, 2: 2 });
    });

    test('medio y un tercio son el completo a la mitad y al tercio del nivel, redondeando arriba', () => {
        for (let level = 1; level <= 20; level++) {
            expect(HALF_CASTER_SLOTS[level - 1]).toEqual(level < 2 ? [] : FULL_CASTER_SLOTS[Math.ceil(level / 2) - 1]);
            expect(THIRD_CASTER_SLOTS[level - 1]).toEqual(level < 3 ? [] : FULL_CASTER_SLOTS[Math.ceil(level / 3) - 1]);
        }
        expect(FULL_CASTER_SLOTS).toHaveLength(20);
        expect(PACT_SLOTS).toHaveLength(20);
    });

    test('el pacto: pocos espacios, todos del mismo nivel, y los arcanos', () => {
        expect(slotsFor(brujo, 1).pact).toEqual({ count: 1, level: 1 });
        expect(slotsFor(brujo, 5).pact).toEqual({ count: 2, level: 3 });
        expect(slotsFor(brujo, 11)).toMatchObject({ pact: { count: 3, level: 5 }, arcanum: [6] });
        expect(slotsFor(brujo, 17).arcanum).toEqual([6, 7, 8, 9]);
        expect(slotsFor(brujo, 5).slots).toEqual({});
    });

    test('quien no tiene la columna casting sigue en la capa ligera', () => {
        expect(casterOf(cls('guerrero'))).toBeNull();
        expect(slotsFor(cls('guerrero'), 5)).toMatchObject({ progression: '', slots: {}, maxLevel: 0 });
        expect(spendSlot({ level: 5 }, cls('guerrero'), 1).ok).toBe(false);
        expect(casterOf(cls('mago'))).toMatchObject({ mode: 'spellbook', ability: 'intelligence', list: 'mago', rituals: 'book' });
    });

    test('la clase de alguien por el nombre de su ficha, en femenino y sin acentos', () => {
        expect(classRowFor('Maga', classes)?.id).toBe('mago');
        expect(classRowFor('Clériga', classes)?.id).toBe('clerigo');
        expect(classRowFor('exploradora', classes)?.id).toBe('explorador');
        expect(classRowFor('Bardo', classes)?.id).toBe('bardo');
        expect(classRowFor('Nadie', classes)).toBeNull();
        expect(classRowFor('', classes)).toBeNull();
    });

    test('gastar espacios hasta que no quedan, y por qué no', () => {
        let mago = { level: 5, slotsUsed: {} };
        for (let i = 0; i < 2; i++) {
            const spent = spendSlot(mago, cls('mago'), 3);
            expect(spent).toMatchObject({ ok: true, slotLevel: 3 });
            mago = { ...mago, slotsUsed: spent.slotsUsed };
        }
        const third = spendSlot(mago, cls('mago'), 3);
        expect(third.ok).toBe(false);
        expect(third.reason).toMatch(/descanso largo/);
        expect(spendSlot(mago, cls('mago'), 4).reason).toMatch(/Todavía no/);
        expect(spendSlot(mago, cls('mago'), 0).ok).toBe(false);
        expect(slotsLeft(mago, cls('mago')).slots).toEqual({ 1: 4, 2: 3, 3: 0 });
    });

    test('el más bajo que sirve, para no gastar el gordo en algo pequeño', () => {
        const mago = { level: 5, slotsUsed: { 1: 4 } };
        expect(lowestFreeSlot(mago, cls('mago'), 1)).toBe(2);
        expect(lowestFreeSlot({ level: 5, slotsUsed: { 1: 4, 2: 3, 3: 2 } }, cls('mago'), 1)).toBe(0);
        expect(lowestFreeSlot({ level: 5 }, brujo, 1)).toBe(3);
        expect(lowestFreeSlot({ level: 5 }, brujo, 4)).toBe(0);
    });

    test('el pacto gasta siempre a su nivel y vuelve con el descanso corto', () => {
        let brujoFicha = { level: 5, slotsUsed: {} };
        const first = spendSlot(brujoFicha, brujo, 1);
        expect(first).toMatchObject({ ok: true, slotLevel: 3 });
        brujoFicha = { ...brujoFicha, slotsUsed: first.slotsUsed };
        brujoFicha = { ...brujoFicha, slotsUsed: spendSlot(brujoFicha, brujo, 3).slotsUsed };
        expect(spendSlot(brujoFicha, brujo, 1).reason).toMatch(/descanso corto/);
        expect(spendSlot(brujoFicha, brujo, 4).reason).toMatch(/pacto/);
        expect(recoverSlots({ slotsUsed: { 1: 2, pacto: 2 } }, 'corto')).toEqual({ 1: 2 });
        expect(recoverSlots({ slotsUsed: { 1: 2, pacto: 2 } }, 'largo')).toEqual({});
        expect(recoverSlots({ slotsUsed: { 3: 1 } }, 'long')).toEqual({});
    });

    test('la CD y el bono de ataque de conjuro', () => {
        expect(spellcastingStats({ level: 5, intelligence: 16 }, cls('mago'))).toEqual({
            ability: 'intelligence', modifier: 3, proficiency: 3, saveDc: 14, attackBonus: 6,
        });
        expect(spellcastingStats({ level: 1, wisdom: 8 }, cls('clerigo')).saveDc).toBe(9);
    });

    test('los espacios en una línea para la ficha', () => {
        expect(describeSlots({ level: 3, slotsUsed: { 1: 1 } }, cls('mago'))).toBe('Espacios: 1.º 3/4 · 2.º 2/2');
        expect(describeSlots({ level: 5, slotsUsed: { pacto: 1 } }, brujo)).toBe('Espacios de pacto (3.º): 1/2');
        expect(describeSlots({ level: 1 }, cls('explorador'))).toBe('');
        expect(stepValue({ 1: 2, 4: 3, 10: 4 }, 9)).toBe(3);
        expect(stepValue(null, 9)).toBe(0);
    });
});

describe('conocidos y preparados (J19.2)', () => {
    test('cuántos trucos, cuántos conocidos y cuántos preparados', () => {
        expect([1, 4, 10].map(level => cantripsKnown(cls('mago'), level))).toEqual([3, 4, 5]);
        expect([1, 4, 10].map(level => cantripsKnown(cls('druida'), level))).toEqual([2, 3, 4]);
        expect(cantripsKnown(cls('explorador'), 5)).toBe(0);
        expect([1, 5, 10, 20].map(level => spellsKnownCount(cls('bardo'), level))).toEqual([4, 8, 14, 22]);
        expect([1, 2, 5].map(level => spellsKnownCount(cls('explorador'), level))).toEqual([0, 2, 4]);
        expect(spellsKnownCount(cls('mago'), 5)).toBe(0);
        // Un lanzador «known» sin tabla usa la del SRD más parecida.
        expect(spellsKnownCount(caballero, 3)).toBe(3);
        // Modificador + nivel, y nunca menos de uno.
        expect(preparedLimit(cls('clerigo'), { level: 3, wisdom: 16 })).toBe(6);
        expect(preparedLimit(cls('mago'), { level: 1, intelligence: 6 })).toBe(1);
        expect(preparedLimit(cls('bardo'), { level: 5, charisma: 18 })).toBe(0);
        expect([1, 5].map(level => spellbookSize(cls('mago'), level))).toEqual([6, 14]);
        expect(maxSpellLevel(cls('explorador'), 5)).toBe(2);
    });

    test('los trucos pegan más a los niveles 5, 11 y 17', () => {
        expect([1, 4, 5, 11, 17, 20].map(cantripMultiplier)).toEqual([1, 1, 2, 3, 4, 4]);
        expect(scaleCantrip('1d10', 4)).toBe('1d10');
        expect(scaleCantrip('1d10', 5)).toBe('2d10');
        expect(scaleCantrip('1d8', 11)).toBe('3d8');
        expect(scaleCantrip('1d4+1', 17)).toBe('4d4+1');
    });

    test('el mago prepara de su libro; el clérigo, de toda su lista; el bardo se los sabe', () => {
        const bola = spell('mag-bola-fuego');
        const mago = { level: 5, spellbook: ['mag-bola-fuego'], prepared: ['mag-bola-fuego'] };
        expect(isCastableBy(mago, cls('mago'), bola)).toBe(true);
        expect(isCastableBy({ ...mago, level: 4 }, cls('mago'), bola)).toBe(false);
        expect(isCastableBy({ ...mago, spellbook: [] }, cls('mago'), bola)).toBe(false);
        expect(isCastableBy({ ...mago, prepared: [] }, cls('mago'), bola)).toBe(false);

        const clerigo = { level: 1, prepared: ['hab-curar'], cantrips: ['conj-llama-sagrada'] };
        expect(isCastableBy(clerigo, cls('clerigo'), spell('hab-curar'))).toBe(true);
        expect(isCastableBy(clerigo, cls('clerigo'), spell('conj-llama-sagrada'))).toBe(true);
        // Una bola de fuego no es de su lista, la prepare quien la prepare.
        expect(isCastableBy({ ...clerigo, level: 5, prepared: ['mag-bola-fuego'] }, cls('clerigo'), bola)).toBe(false);

        const bardo = { level: 1, spellsKnown: ['hab-sueno'], cantrips: ['conj-burla-danina'] };
        const castable = castableSpells(bardo, cls('bardo'), catalogue);
        expect(castable.cantrips.map(s => s.id)).toEqual(['conj-burla-danina']);
        expect(castable.spells.map(s => s.id)).toEqual(['hab-sueno']);
        // Los alias viejos también valen: quien sabía «curar_heridas» sabe Curar heridas.
        expect(isCastableBy({ level: 1, prepared: ['curar_heridas'] }, cls('clerigo'), spell('hab-curar'))).toBe(true);
        expect(classSpellList(cls('guerrero'), catalogue)).toEqual([]);
    });

    test('los rituales: el mago, de su libro aunque no los tenga preparados', () => {
        const mago = { level: 1, spellbook: ['conj-detectar-magia', 'conj-identificar'], prepared: [] };
        expect(ritualSpells(mago, cls('mago'), catalogue).map(s => s.id)).toEqual(['conj-detectar-magia', 'conj-identificar']);
        const clerigo = { level: 1, prepared: ['conj-purificar'] };
        expect(ritualSpells(clerigo, cls('clerigo'), catalogue).map(s => s.id)).toEqual(['conj-purificar']);
        expect(ritualSpells({ level: 5, spellsKnown: ['conj-alarma'] }, cls('explorador'), catalogue)).toEqual([]);
    });

    test('preparar: cuántos caben, de dónde y de qué nivel', () => {
        const mago = { level: 1, intelligence: 16, spellbook: ['conj-proyectil-magico', 'hab-escudo-arcano', 'hab-sueno'] };
        expect(checkPreparation({ member: mago, classRow: cls('mago'), catalogue, chosen: ['conj-proyectil-magico', 'hab-escudo-arcano'] }))
            .toMatchObject({ ok: true, limit: 4, prepared: ['conj-proyectil-magico', 'hab-escudo-arcano'] });
        const wrong = checkPreparation({
            member: mago, classRow: cls('mago'), catalogue,
            chosen: ['conj-manos-ardientes', 'hab-rayo-fuego', 'mag-bola-fuego', 'hab-curar'],
        });
        expect(wrong.ok).toBe(false);
        expect(wrong.errors.join(' ')).toMatch(/no está en su libro/);
        expect(wrong.errors.join(' ')).toMatch(/trucos no se preparan/);
        expect(wrong.errors.join(' ')).toMatch(/3\.er nivel/);
        expect(wrong.errors.join(' ')).toMatch(/no es de la lista/);
        expect(checkPreparation({ member: { level: 1, wisdom: 10 }, classRow: cls('clerigo'), catalogue, chosen: ['hab-curar', 'hab-bendicion'] }).errors)
            .toEqual(['Caben 1 y se han elegido 2.']);
        expect(checkPreparation({ member: {}, classRow: cls('bardo'), catalogue, chosen: [] }).ok).toBe(false);
    });

    test('lo que se elige al subir de nivel', () => {
        const bardo2 = spellChoicesAtLevel({ classRow: cls('bardo'), level: 2, catalogue, member: { spellsKnown: ['hab-sueno'] } });
        expect(bardo2).toMatchObject({ newSpells: 1, canSwap: true, newCantrips: 0, newSpellLevel: false });
        expect(bardo2.spellOptions.map(s => s.id)).not.toContain('hab-sueno');
        expect(bardo2.spellOptions.every(s => s.level === 1)).toBe(true);

        const mago3 = spellChoicesAtLevel({ classRow: cls('mago'), level: 3, catalogue, member: { intelligence: 16 } });
        expect(mago3).toMatchObject({ newSpellLevel: true, maxSpellLevel: 2, newSpells: 2, preparedLimit: 6 });
        expect(mago3.lines).toEqual(['Ya lanza conjuros de 2.º nivel.', 'Copia 2 conjuros en su libro.', 'Prepara 6 cada mañana.']);

        const clerigo4 = spellChoicesAtLevel({ classRow: cls('clerigo'), level: 4, catalogue, member: { cantrips: ['conj-llama-sagrada'] } });
        expect(clerigo4.newCantrips).toBe(1);
        expect(clerigo4.cantripOptions.map(s => s.id)).not.toContain('conj-llama-sagrada');

        const explorador2 = spellChoicesAtLevel({ classRow: cls('explorador'), level: 2, catalogue });
        expect(explorador2).toMatchObject({ newSpells: 2, newSpellLevel: true, maxSpellLevel: 1 });

        const mago1 = spellChoicesAtLevel({ classRow: cls('mago'), level: 1, catalogue });
        expect(mago1).toMatchObject({ newCantrips: 3, newSpells: 6 });

        expect(spellChoicesAtLevel({ classRow: cls('guerrero'), level: 3, catalogue })).toMatchObject({ newSpells: 0, lines: [] });
    });

    test('la comprobación del compendio ve una clase que no tiene qué lanzar', () => {
        expect(coverageGaps({ classRows: classes, catalogue })).toEqual([]);
        const hueca = { id: 'hueca', name: 'Hueca', casting: { progression: 'full', mode: 'prepared', cantrips: { 1: 2 } } };
        const gaps = coverageGaps({ classRows: [hueca], catalogue, levels: [3] });
        expect(gaps).toEqual([
            'Hueca, nivel 3: no tiene conjuros de 1.er nivel.',
            'Hueca, nivel 3: no tiene conjuros de 2.º nivel.',
            'Hueca, nivel 3: sabe 2 trucos y su lista tiene 0.',
        ]);
        // Quien solo lanza rituales, con que tenga alguno a su alcance le basta.
        const sinRituales = { id: 'sorda', name: 'Sorda', casting: { progression: 'full', mode: 'spellbook', ritualsOnly: true, list: 'guerrero' } };
        expect(coverageGaps({ classRows: [sinRituales], catalogue, levels: [1] })).toEqual(['Sorda, nivel 1: no tiene ningún ritual a su alcance.']);
    });
});

describe('el erudito: solo rituales, sin espacios (D-J27)', () => {
    const erudito = cls('erudito');
    const tomas = { level: 3, intelligence: 16, spellbook: ['conj-detectar-magia', 'conj-comprender-idiomas', 'conj-identificar'] };

    test('lanza de 5e, con la lista del mago, pero sin un solo espacio ni truco', () => {
        expect(casterOf(erudito)).toMatchObject({ mode: 'spellbook', list: 'mago', rituals: 'book', ritualsOnly: true, focus: 'Arcane' });
        expect(slotsFor(erudito, 3)).toMatchObject({ slots: {}, maxLevel: 2 });
        expect(slotsLeft(tomas, erudito).slots).toEqual({});
        expect(lowestFreeSlot(tomas, erudito, 1)).toBe(0);
        expect(spendSlot(tomas, erudito, 1)).toMatchObject({ ok: false, reason: 'Solo lanza rituales: no tiene espacios de conjuro.' });
        expect(describeSlots(tomas, erudito)).toBe('Solo rituales, sin espacios: hasta los de 2.º nivel');
        expect(cantripsKnown(erudito, 5)).toBe(0);
        expect(preparedLimit(erudito, tomas)).toBe(0);
    });

    test('su lista son los rituales del mago; y los lanza de su libro', () => {
        const list = classSpellList(erudito, catalogue);
        expect(list.length).toBeGreaterThan(0);
        expect(list.every(s => s.ritual && s.classes.includes('mago'))).toBe(true);
        expect(list.map(s => s.id)).toEqual(expect.arrayContaining(['conj-detectar-magia', 'conj-identificar', 'conj-alarma']));
        expect(list.some(s => s.id === 'mag-bola-fuego')).toBe(false);
        expect(ritualSpells(tomas, erudito, catalogue).map(s => s.id).sort()).toEqual(['conj-comprender-idiomas', 'conj-detectar-magia', 'conj-identificar']);
        // Nada se lanza con espacio, y no prepara.
        expect(isCastableBy(tomas, erudito, spell('conj-detectar-magia'))).toBe(false);
        expect(castableSpells(tomas, erudito, catalogue)).toEqual({ cantrips: [], spells: [] });
        expect(checkPreparation({ member: tomas, classRow: erudito, catalogue, chosen: ['conj-detectar-magia'] }).errors)
            .toEqual(['Esta clase no prepara: lanza sus rituales del libro, sin espacios.']);
    });

    test('al subir de nivel copia rituales en su libro, y se dice así', () => {
        const first = spellChoicesAtLevel({ classRow: erudito, level: 1, catalogue });
        expect(first).toMatchObject({ newCantrips: 0, newSpells: 2, preparedLimit: 0 });
        expect(first.spellOptions.every(s => s.ritual)).toBe(true);
        expect(first.lines).toEqual(['Ya lanza rituales de 1.er nivel.', 'Copia 2 rituales en su libro.']);
        const second = spellChoicesAtLevel({ classRow: erudito, level: 2, catalogue, member: { spellbook: ['conj-detectar-magia', 'conj-alarma'] } });
        expect(second.lines).toEqual(['Copia un ritual en su libro.']);
    });
});
