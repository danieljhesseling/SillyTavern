/**
 * Brujo y Hechicero (wiki/gemini/ROADMAP_CONTENIDO_DND.md): sus filas, su magia y sus rasgos de
 * nivel 1 a 3 que el motor juega.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { slotsFor, recoverSlots, spellcastingStats, describeSlots } from '../public/scripts/game-engine/rules/spell-slots.js';
import { classSpellList } from '../public/scripts/game-engine/rules/spell-prep.js';
import { normalizeSpell, validateSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { spellToAbility, canCastSpell } from '../public/scripts/game-engine/rules/spell-cast.js';
import { startingSpells } from '../public/scripts/game-engine/rules/spell-picks.js';
import { normalizeAbility, usesLeft, spendAbilityUse, canUseAbility, planAbilityUse, restoreAbilityUses } from '../public/scripts/game-engine/rules/abilities.js';
import { sorceryMax, sorceryLeft, withMetamagic, afterMetamagic, carefulVictims, QUICKENED, CAREFUL, INNATE_SORCERY, SORCERY_POOL } from '../public/scripts/game-engine/rules/sorcery.js';
import { asAbility, abilitiesFor, validateAbility } from '../public/scripts/game-engine/compendio/skills.js';
import { classIdOf } from '../public/scripts/game-engine/ui/pixel-art.js';
import { roleOf } from '../public/scripts/game-engine/rules/level-advice.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const classes = read('compendio/clases.json').rows;
const catalogue = read('compendio/conjuros.json').rows;
const abilityRows = read('compendio/habilidades.json').rows;
const cls = (/** @type {string} */ id) => classes.find((/** @type {any} */ r) => r.id === id);
const spell = (/** @type {string} */ id) => normalizeSpell(catalogue.find((/** @type {any} */ r) => r.id === id));
const habilidad = (/** @type {string} */ id) => normalizeAbility(asAbility(abilityRows.find((/** @type {any} */ r) => r.id === id)));
const fakeCompendium = { has: () => true, find: () => abilityRows };

describe('las filas de clases.json', () => {
    test('el brujo: d8, magia de pacto con Carisma, se sabe sus conjuros', () => {
        const row = cls('brujo');
        expect(row.hitDie).toBe('1d8');
        expect(row.casting).toMatchObject({ progression: 'pact', ability: 'charisma', mode: 'known', focus: 'Arcane' });
        expect(slotsFor(row, 1).pact).toEqual({ count: 1, level: 1 });
        expect(slotsFor(row, 5).pact).toEqual({ count: 2, level: 3 });
    });
    test('el hechicero: d6, lanzador completo con Carisma', () => {
        const row = cls('hechicero');
        expect(row.hitDie).toBe('1d6');
        expect(row.casting).toMatchObject({ progression: 'full', ability: 'charisma', mode: 'known' });
        expect(slotsFor(row, 3).slots).toEqual({ 1: 4, 2: 2 });
    });
    test('los espacios de pacto vuelven con el descanso corto', () => {
        expect(recoverSlots({ slotsUsed: { pacto: 2 } }, 'corto')).toEqual({});
    });
    test('tienen lista de conjuros, y todos sus conjuros pasan el validador', () => {
        const classIds = classes.map((/** @type {any} */ r) => r.id);
        for (const id of ['brujo', 'hechicero']) {
            const list = classSpellList(cls(id), catalogue);
            expect(list.filter(s => s.level === 0).length).toBeGreaterThanOrEqual(4);
            expect(list.filter(s => s.level === 1).length).toBeGreaterThanOrEqual(4);
        }
        for (const id of ['conj-descarga-sobrenatural', 'conj-brazos-hadar']) {
            expect(validateSpell(catalogue.find((/** @type {any} */ r) => r.id === id), { classIds })).toEqual([]);
        }
    });
    test('el brujo empieza sabiéndose la Descarga sobrenatural', () => {
        const picks = startingSpells({ member: { class: 'Brujo', level: 1, charisma: 16 }, classRow: cls('brujo'), catalogue });
        expect(picks?.cantrips).toContain('conj-descarga-sobrenatural');
    });
    test('el nombre de la clase lleva a su retrato y a su papel', () => {
        expect(classIdOf('Bruja')).toBe('brujo');
        expect(classIdOf('Hechicera')).toBe('hechicero');
        expect(roleOf({ class: 'Brujo' })).toBe('magia');
    });
});

describe('la Descarga sobrenatural', () => {
    const eb = spell('conj-descarga-sobrenatural');
    test('sube en rayos, no en dados: 1, 2, 3 y 4', () => {
        expect([1, 5, 11, 17].map(casterLevel => spellToAbility(eb, { casterLevel }).rays)).toEqual([1, 2, 3, 4]);
        expect(spellToAbility(eb, { casterLevel: 17 }).damage.startsWith('1d10')).toBe(true);
    });
    test('la Descarga agonizante: suma el Carisma desde el nivel 2', () => {
        expect(spellToAbility(eb, { casterLevel: 1, modifier: 3 }).damage).toBe('1d10');
        expect(spellToAbility(eb, { casterLevel: 2, modifier: 3 }).damage).toBe('1d10+3');
    });
    test('los demás trucos siguen subiendo en dados', () => {
        expect(spellToAbility(spell('hab-rayo-fuego'), { casterLevel: 5 }).damage).toBe('2d10');
    });
});

describe('el hechicero', () => {
    const sorcerer = (/** @type {any} */ extra = {}) => ({ name: 'Ilse', class: 'Hechicera', level: 3, charisma: 16, ...extra });

    test('sus rasgos salen por clase y nivel, y pasan el validador', () => {
        const ids = (/** @type {number} */ level) => abilitiesFor({ compendium: fakeCompendium, className: 'hechicero', level }).map(a => a.id);
        expect(ids(1)).toContain('hab-magia-innata');
        expect(ids(1)).not.toContain('hab-conjuro-rapido');
        expect(ids(2)).toEqual(expect.arrayContaining(['hab-conjuro-rapido', 'hab-conjuro-cuidadoso']));
        expect(abilitiesFor({ compendium: fakeCompendium, className: 'brujo', level: 3 }).map(a => a.id)).toContain('hab-luz-sanadora');
        for (const id of ['hab-magia-innata', 'hab-conjuro-rapido', 'hab-conjuro-cuidadoso', 'hab-luz-sanadora']) {
            expect(validateAbility(abilityRows.find((/** @type {any} */ r) => r.id === id))).toEqual([]);
        }
    });
    test('puntos de hechicería: su nivel desde el 2, se gastan en Metamagia y vuelven con el largo', () => {
        expect(sorceryMax(sorcerer({ level: 1 }))).toBe(0);
        expect(sorceryMax(sorcerer())).toBe(3);
        expect(sorceryMax({ class: 'Mago', level: 5 })).toBe(0);
        const quick = habilidad('hab-conjuro-rapido');
        const member = sorcerer();
        expect(usesLeft(member, quick)).toBe(1);
        member.abilityUses = spendAbilityUse(member, quick);
        expect(member.abilityUses[SORCERY_POOL]).toBe(2);
        expect(sorceryLeft(member)).toBe(1);
        expect(canUseAbility({ member, ability: quick }).ok).toBe(false);
        expect(usesLeft(member, habilidad('hab-conjuro-cuidadoso'))).toBe(1);
        expect(restoreAbilityUses(member, 'corto', abilityRows)[SORCERY_POOL]).toBe(2);
        expect(restoreAbilityUses(member, 'largo', abilityRows)).toEqual({});
        expect(describeSlots(member, cls('hechicero'))).toContain('Puntos de hechicería: 1/3');
    });
    test('Conjuro rápido: lo de una acción va con la adicional, y se gasta al lanzar', () => {
        const member = sorcerer({ activeConditions: [QUICKENED] });
        const bolt = spellToAbility(spell('hab-rayo-fuego'), { casterLevel: 3 });
        const quick = withMetamagic(bolt, member);
        expect(quick.cost).toBe('bonus');
        expect(withMetamagic(bolt, sorcerer()).cost).toBe('action');
        const verdict = canCastSpell({ member, classRow: cls('hechicero'), spell: spell('hab-rayo-fuego'), hasAction: false, hasBonus: true, carried: ['Bolsa de componentes'], cantrips: ['hab-rayo-fuego'] });
        expect(verdict.reason).not.toBe('La acción de este turno ya está gastada.');
        expect(afterMetamagic(member, quick)).toEqual([]);
    });
    test('Conjuro cuidadoso: el área no toca a los suyos', () => {
        const member = sorcerer({ activeConditions: [CAREFUL] });
        const burst = spellToAbility(spell('mag-bola-fuego'), { casterLevel: 5 });
        const victims = [{ kind: 'party', ref: {} }, { kind: 'enemy', ref: {} }];
        expect(carefulVictims(member, 'party', burst, victims)).toEqual([victims[1]]);
        expect(carefulVictims(sorcerer(), 'party', burst, victims)).toEqual(victims);
        expect(afterMetamagic(member, burst)).toEqual([]);
    });
    test('Magia innata: +1 a la CD y ventaja al atacar con sus conjuros', () => {
        const member = sorcerer({ activeConditions: [INNATE_SORCERY] });
        expect(spellcastingStats(member, cls('hechicero')).saveDc).toBe(spellcastingStats(sorcerer(), cls('hechicero')).saveDc + 1);
        const bolt = normalizeAbility(spellToAbility(spell('hab-rayo-fuego'), { casterLevel: 3 }));
        const rolls = [3, 18, 6];
        const plan = planAbilityUse({ actor: member, target: { name: 'Orco' }, ability: bolt, attackModifier: 5, targetAc: 15, roll: () => ({ total: rolls.shift() ?? 1, natural: 0 }) });
        expect(plan.hit).toBe(true);
        expect(plan.lines.join(' ')).toContain('con ventaja');
    });
});
