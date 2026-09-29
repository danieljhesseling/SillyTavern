import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    addDice, upcastSteps, upcastSpell, spellToAbility, hasFocus, componentsCheck, ritualCheck,
    canCastSpell, describeSpell5e, hpPoolTargets,
} from '../public/scripts/game-engine/rules/spell-cast.js';
import {
    concentrationDc, constitutionSave, startConcentration, concentrationCheck, concentrationAfterConditions,
    expireConcentration, endConcentration, linkedTo, describeConcentration, readConcentration,
} from '../public/scripts/game-engine/rules/concentration.js';
import {
    reactionSpells, reactionOptions, beatsSpell, resolveReaction,
} from '../public/scripts/game-engine/rules/spell-reactions.js';
import { normalizeSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { planAbilityUse } from '../public/scripts/game-engine/rules/abilities.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const classes = read('compendio/clases.json').rows;
const catalogue = read('compendio/conjuros.json').rows;
const cls = (/** @type {string} */ id) => classes.find((/** @type {any} */ r) => r.id === id);
const spell = (/** @type {string} */ id) => normalizeSpell(catalogue.find((/** @type {any} */ r) => r.id === id));
const spells = catalogue.map(normalizeSpell);

/** Una tirada fija: saca lo que se le diga, en orden. */
const fixedRoll = (/** @type {number[]} */ values) => {
    const queue = [...values];
    return (/** @type {string} */ formula) => {
        const total = queue.length > 0 ? /** @type {number} */ (queue.shift()) : 0;
        return { total, natural: total, rolls: [total], formula };
    };
};

describe('lanzar a más nivel (J19.3)', () => {
    test('sumar dados a una fórmula', () => {
        expect(addDice('8d6', '1d6', 2)).toBe('10d6');
        expect(addDice('3d4+3', '1d4+1')).toBe('4d4+4');
        expect(addDice('1d8', '1d8', 0)).toBe('1d8');
        expect(addDice('', '1d6', 0)).toBe('');
        expect(addDice('2d6', '1d4')).toBe('2d6+1d4');
        expect(addDice('1d8', '3')).toBe('1d8+3');
        expect(addDice('1d8', '-1')).toBe('1d8-1');
    });

    test('más dados de daño, más rayos, más objetivos y más radio', () => {
        expect(upcastSpell(spell('mag-bola-fuego'), 5).damage).toBe('10d6');
        expect(upcastSpell(spell('mag-bola-fuego'), 3)).toMatchObject({ damage: '8d6', steps: 0, slotLevel: 3 });
        expect(upcastSpell(spell('conj-proyectil-magico'), 3).rays).toBe(5);
        expect(upcastSpell(spell('hab-bendicion'), 2).targets).toBe(4);
        expect(upcastSpell(spell('conj-nube-niebla'), 2).area).toEqual({ shape: 'radius', size: 40 });
        expect(upcastSpell(spell('hab-sueno'), 2).hpPool).toBe('7d8');
        expect(upcastSpell(spell('hab-curar'), 3).healing).toBe('3d8');
        expect(upcastSpell(spell('conj-ayuda'), 4).maxHpBonus).toBe(15);
    });

    test('lo que sube cada dos niveles, y las invocaciones que se multiplican', () => {
        expect(upcastSteps(spell('conj-arma-espiritual'), 3)).toBe(0);
        expect(upcastSpell(spell('conj-arma-espiritual'), 4).damage).toBe('2d8');
        expect([3, 5, 7, 9].map(level => upcastSpell(spell('conj-conjurar-animales'), level).count)).toEqual([2, 4, 6, 8]);
        expect(upcastSpell(spell('conj-animar-muertos'), 5).count).toBe(5);
        // Un truco no sube con espacio.
        expect(upcastSteps(spell('hab-rayo-fuego'), 9)).toBe(0);
    });

    test('el conjuro como habilidad de la capa ligera, con los números de quien lo lanza', () => {
        const curar = spellToAbility(spell('hab-curar'), { slotLevel: 2, modifier: 3 });
        expect(curar).toMatchObject({ cost: 'action', resource: 'at_will', target: 'ally', healing: '2d8+3', slotLevel: 2, spellLevel: 1 });
        expect(curar.circle).toBeUndefined();
        expect(spellToAbility(spell('hab-rayo-fuego'), { casterLevel: 5 }).damage).toBe('2d10');
        expect(spellToAbility(spell('conj-saeta-guia'), { attackBonus: 5 })).toMatchObject({ resolution: 'attack', attackBonus: 5 });
        expect(spellToAbility(spell('mag-bola-fuego'), { saveDc: 15 })).toMatchObject({ target: 'enemy', point: true, resolution: 'save', saveAbility: 'dexterity', saveDc: 15 });
        expect(spellToAbility(spell('hab-escudo-arcano')).cost).toBe('free');
        expect(spellToAbility(spell('conj-palabra-curacion')).cost).toBe('bonus');
        expect(spellToAbility(spell('mag-toque-vampirico')).drain).toBe(true);
        expect(spellToAbility(spell('conj-detectar-magia')).combat).toBe(false);
    });

    test('y planAbilityUse lo resuelve como siempre: la bola de fuego, a la mitad si salva', () => {
        const ability = spellToAbility(spell('mag-bola-fuego'), { slotLevel: 3, saveDc: 14 });
        const saved = planAbilityUse({ actor: { name: 'Lyra' }, target: { name: 'Orco' }, ability, roll: fixedRoll([12, 28]), saveModifier: 2 });
        expect(saved).toMatchObject({ saved: true, damage: 14 });
        const failed = planAbilityUse({ actor: { name: 'Lyra' }, target: { name: 'Orco' }, ability, roll: fixedRoll([3, 28]), saveModifier: 2 });
        expect(failed).toMatchObject({ saved: false, damage: 28 });
    });

    test('Dormir va por puntos de vida: de menos a más, hasta gastar los dados', () => {
        const inside = [{ id: 'ogro', currentHp: 30 }, { id: 'rata', currentHp: 4 }, { id: 'trasgo', currentHp: 7 }, { id: 'caido', currentHp: 0 }, { id: 'lobo', currentHp: 11 }];
        expect(hpPoolTargets(inside, 22).map(c => c.id)).toEqual(['rata', 'trasgo', 'lobo']);
        expect(hpPoolTargets(inside, 10).map(c => c.id)).toEqual(['rata']);
        expect(hpPoolTargets(inside, 3)).toEqual([]);
    });

    test('la descripción en una línea', () => {
        expect(describeSpell5e(spell('mag-bola-fuego'))).toBe('Bola de fuego · 3.er nivel, evocación · acción · 150 ft · radio de 20 ft · salva Destreza · 8d6 fuego');
        expect(describeSpell5e(spell('mag-bola-fuego'), 4)).toMatch(/4\.º nivel.*9d6 fuego/);
        expect(describeSpell5e(spell('conj-proyectil-magico'))).toMatch(/3 × 1d4\+1 fuerza/);
        expect(describeSpell5e(spell('conj-identificar'))).toMatch(/ritual · perla de 100 mo$/);
        expect(describeSpell5e(spell('mag-volver-orilla'))).toMatch(/diamante de 300 mo, se gasta/);
        expect(describeSpell5e(spell('hab-bendicion'))).toMatch(/hasta 3 · concentración/);
    });
});

describe('componentes y rituales (J19.8)', () => {
    test('un foco, por su nombre o por su ficha, o la bolsa de componentes', () => {
        expect(hasFocus(['Bastón de roble'], 'Arcane')).toBe(true);
        expect(hasFocus(['Daga'], 'Arcane')).toBe(false);
        expect(hasFocus(['Bolsa de componentes'], 'Divine')).toBe(true);
        expect(hasFocus([{ name: 'Cristal raro', focusType: 'Arcane' }], 'Arcane')).toBe(true);
        expect(hasFocus([{ name: 'Talismán', subcategory: 'magic_focus' }], 'Divine')).toBe(true);
        expect(hasFocus(['Escudo'], 'Divine')).toBe(true);
    });

    test('en un silencio no se dicen palabras; lo caro hay que llevarlo; lo que se gasta, se gasta', () => {
        expect(componentsCheck(spell('mag-bola-fuego'), { silenced: true }).reason).toMatch(/no se oye nada/);
        expect(componentsCheck(spell('conj-contraconjuro'), { silenced: true }).ok).toBe(true);
        expect(componentsCheck(spell('conj-identificar'), { carried: ['Bastón'] }).reason)
            .toBe('Para Identificar hace falta: perla (100 de oro). Se compra en las tiendas.');
        expect(componentsCheck(spell('conj-identificar'), { carried: ['Perla'] })).toMatchObject({ ok: true, consumes: [] });
        expect(componentsCheck(spell('conj-encontrar-familiar'), { carried: ['Incienso y hierbas'] }).consumes).toEqual(['Incienso y hierbas']);
        expect(componentsCheck(spell('conj-proteccion-mal-bien'), { carried: [] }).reason)
            .toBe('Para Protección contra el mal y el bien hace falta: agua bendita, que se gasta al lanzarlo. Se compra en las tiendas.');
        expect(componentsCheck(spell('mag-volver-orilla'), { carried: ['Amuleto'] }).reason)
            .toBe('Para Revivir hace falta: diamante (300 de oro), que se gasta al lanzarlo. Se compra en las tiendas.');
    });

    // D-J25: ya se venden la bolsa y el laúd, así que el foco se exige si no se dice otra cosa.
    test('sin foco ni bolsa no se lanza, y se dice qué falta; con el modo suave, se lanza con aviso', () => {
        const strict = componentsCheck(spell('mag-bola-fuego'), { carried: ['Daga'], focus: 'Arcane' });
        expect(strict).toMatchObject({ ok: false, reason: 'Para Bola de fuego hace falta un foco (un bastón, una varita o un orbe) o una bolsa de componentes. Se compran en las tiendas.' });
        expect(componentsCheck(spell('mag-bola-fuego'), { carried: ['Bastón'], focus: 'Arcane' }).ok).toBe(true);
        expect(componentsCheck(spell('mag-bola-fuego'), { carried: ['Bolsa de componentes'], focus: 'Arcane' }).ok).toBe(true);
        const lenient = componentsCheck(spell('mag-bola-fuego'), { carried: ['Daga'], focus: 'Arcane', strict: false });
        expect(lenient.ok).toBe(true);
        expect(lenient.warnings[0]).toMatch(/a pulso/);
        // El laúd le sirve de foco al bardo.
        expect(hasFocus(['Laúd'], 'Instrument')).toBe(true);
    });

    test('un ritual: sin espacio, diez minutos más y nunca peleando', () => {
        const mago = { level: 1, spellbook: ['conj-detectar-magia', 'conj-identificar'], prepared: [] };
        expect(ritualCheck({ member: mago, classRow: cls('mago'), spell: spell('conj-detectar-magia') })).toEqual({ ok: true, reason: '', minutes: 10 });
        expect(ritualCheck({ member: mago, classRow: cls('mago'), spell: spell('conj-identificar') }).minutes).toBe(11);
        expect(ritualCheck({ member: mago, classRow: cls('mago'), spell: spell('conj-detectar-magia'), inCombat: true }).reason).toMatch(/peleando/);
        expect(ritualCheck({ member: { level: 1, prepared: [] }, classRow: cls('clerigo'), spell: spell('conj-detectar-magia') }).reason).toMatch(/preparado/);
        expect(ritualCheck({ member: { level: 5, spellsKnown: ['conj-alarma'] }, classRow: cls('explorador'), spell: spell('conj-alarma') }).reason).toMatch(/no lanza rituales/);
        expect(ritualCheck({ member: mago, classRow: cls('mago'), spell: spell('mag-bola-fuego') }).reason).toMatch(/no es un ritual/);
    });
});

describe('si se puede lanzar ahora', () => {
    const mago = { level: 5, intelligence: 16, spellbook: ['mag-bola-fuego', 'conj-detectar-magia'], prepared: ['mag-bola-fuego'], cantrips: ['hab-rayo-fuego'], items: [] };

    test('con el espacio más bajo que sirva, o con el que se elija', () => {
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('mag-bola-fuego'), carried: ['Bastón'] })).toMatchObject({ ok: true, slotLevel: 3 });
        // D-J25: sin su bastón (ni bolsa), no.
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('mag-bola-fuego') }).reason).toMatch(/hace falta un foco/);
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('mag-bola-fuego'), slotLevel: 2 }).reason).toMatch(/no cabe en un espacio menor/);
        expect(canCastSpell({ member: { ...mago, slotsUsed: { 3: 2 } }, classRow: cls('mago'), spell: spell('mag-bola-fuego') }).reason).toMatch(/Sin espacios de 3\.er nivel/);
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('hab-rayo-fuego') })).toMatchObject({ ok: true, slotLevel: 0 });
    });

    test('lo que no tiene preparado, lo que tarda y la acción gastada', () => {
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('conj-detectar-magia') }).reason).toMatch(/preparado/);
        expect(canCastSpell({ member: { level: 1, spellsKnown: [] }, classRow: cls('bardo'), spell: spell('hab-sueno') }).reason).toBe('No se sabe Dormir.');
        const clerigo = { level: 3, wisdom: 14, prepared: ['mag-oracion', 'conj-palabra-curacion'] };
        expect(canCastSpell({ member: clerigo, classRow: cls('clerigo'), spell: spell('mag-oracion') }).reason).toMatch(/10 minutos/);
        expect(canCastSpell({ member: clerigo, classRow: cls('clerigo'), spell: spell('mag-oracion'), inCombat: false })).toMatchObject({ ok: true, minutes: 10, slotLevel: 2 });
        expect(canCastSpell({ member: clerigo, classRow: cls('clerigo'), spell: spell('conj-palabra-curacion'), hasBonus: false }).reason).toMatch(/adicional/);
        expect(canCastSpell({ member: clerigo, classRow: cls('clerigo'), spell: spell('conj-palabra-curacion'), hasAction: false }).ok).toBe(true);
        expect(canCastSpell({ member: mago, classRow: cls('guerrero'), spell: spell('mag-bola-fuego') }).ok).toBe(false);
    });

    test('D-J27: el erudito solo lanza rituales, de su libro y sin espacios', () => {
        const erudito = { level: 3, intelligence: 16, spellbook: ['conj-detectar-magia', 'conj-identificar'] };
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('conj-detectar-magia'), asRitual: true, inCombat: false }))
            .toMatchObject({ ok: true, slotLevel: 0, ritual: true, minutes: 10 });
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('conj-detectar-magia'), inCombat: false }).reason)
            .toBe('Solo lanza rituales, sin espacios: Detectar magia se lanza como ritual (diez minutos más, y no peleando).');
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('mag-bola-fuego') }).reason)
            .toBe('Solo lanza rituales, sin espacios: Bola de fuego no es un ritual.');
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('conj-detectar-magia'), asRitual: true, inCombat: true }).reason).toMatch(/peleando/);
        // Identificar pide su perla, como a cualquiera.
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('conj-identificar'), asRitual: true, inCombat: false }).reason).toMatch(/perla/);
        expect(canCastSpell({ member: erudito, classRow: cls('erudito'), spell: spell('conj-identificar'), asRitual: true, inCombat: false, carried: ['Perla'] }).ok).toBe(true);
    });

    test('como ritual no gasta espacio; en silencio no se lanza lo que pide palabras', () => {
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('conj-detectar-magia'), asRitual: true, inCombat: false }))
            .toMatchObject({ ok: true, slotLevel: 0, ritual: true, minutes: 10 });
        expect(canCastSpell({ member: mago, classRow: cls('mago'), spell: spell('mag-bola-fuego'), silenced: true }).reason).toMatch(/no se oye/);
    });
});

describe('la concentración (J19.4)', () => {
    test('la CD es la mitad del daño, y nunca menos de 10', () => {
        expect([1, 5, 21, 22, 30].map(concentrationDc)).toEqual([10, 10, 10, 11, 15]);
        expect(constitutionSave({ constitution: 14, level: 5 })).toBe(2);
        expect(constitutionSave({ constitution: 14, level: 5, saveProficiencies: ['constitution'] })).toBe(5);
    });

    test('un solo conjuro así a la vez: el nuevo acaba el viejo', () => {
        const first = startConcentration({ current: null, spell: spell('hab-bendicion'), casterId: 'lyra', round: 2 });
        expect(first.concentration).toEqual({ spellId: 'hab-bendicion', name: 'Bendición', casterId: 'lyra', since: 2, until: 12 });
        expect(first.ended).toBeNull();
        const second = startConcentration({ current: first.concentration, spell: spell('conj-escudo-fe'), casterId: 'lyra', round: 3 });
        expect(second.ended?.spellId).toBe('hab-bendicion');
        expect(second.lines[0]).toMatch(/Deja de concentrarse en Bendición/);
    });

    test('un golpe pide una salvación de Constitución; si falla, se acaba', () => {
        const { concentration } = startConcentration({ current: null, spell: spell('conj-telarana'), casterId: 'lyra', round: 1 });
        const lost = concentrationCheck({ concentration, damage: 12, roll: fixedRoll([5]), saveModifier: 2, name: 'Lyra' });
        expect(lost).toMatchObject({ kept: false, dc: 10, total: 7, concentration: null });
        expect(lost.ended?.spellId).toBe('conj-telarana');
        expect(lost.lines[1]).toMatch(/La pierde/);
        const kept = concentrationCheck({ concentration, damage: 30, roll: fixedRoll([14]), saveModifier: 1 });
        expect(kept).toMatchObject({ kept: true, dc: 15, total: 15 });
        expect(concentrationCheck({ concentration, damage: 0, roll: fixedRoll([1]) })).toMatchObject({ kept: true, lines: [] });
        expect(concentrationCheck({ concentration: null, damage: 10, roll: fixedRoll([1]) }).kept).toBe(true);
    });

    test('quedar incapacitado la rompe; el tiempo la acaba; y lo que dependía de ella se va', () => {
        const concentration = readConcentration({ spellId: 'conj-telarana', name: 'Telaraña', casterId: 'lyra', since: 1, until: 11 });
        expect(concentrationAfterConditions(concentration, ['Unconscious']).broken).toBe(true);
        expect(concentrationAfterConditions(concentration, ['Prone']).broken).toBe(false);
        expect(expireConcentration(concentration, 10).expired).toBe(false);
        expect(expireConcentration(concentration, 11).expired).toBe(true);
        expect(endConcentration(concentration, 'cae al suelo').lines[0]).toBe('🧠 Se acaba Telaraña: cae al suelo.');
        const things = [
            { id: 'z1', casterId: 'lyra', spellId: 'conj-telarana' },
            { id: 'z2', casterId: 'lyra', spellId: 'conj-nube-niebla' },
            { id: 'z3', casterId: 'orco', spellId: 'conj-telarana' },
        ];
        const { linked, rest } = linkedTo(concentration, things);
        expect(linked.map(t => t.id)).toEqual(['z1']);
        expect(rest.map(t => t.id)).toEqual(['z2', 'z3']);
        expect(describeConcentration(concentration, 9)).toBe('🧠 Concentración: Telaraña (quedan 2 rondas)');
        expect(describeConcentration(null)).toBe('');
    });
});

describe('las reacciones mágicas (J19.7)', () => {
    test('qué conjuros responden a qué', () => {
        expect(reactionSpells(spells, 'hit').map(s => s.id)).toEqual(['hab-escudo-arcano']);
        expect(reactionSpells(spells, 'spell').map(s => s.id)).toEqual(['conj-contraconjuro']);
        expect(reactionSpells(spells, 'fall').map(s => s.id)).toEqual(['conj-caida-pluma']);
    });

    test('una reacción por ronda, con espacio y a su alcance', () => {
        const castable = [spell('hab-escudo-arcano'), spell('conj-contraconjuro')];
        expect(reactionOptions({ spells: castable, trigger: 'hit', reactionUsed: true, slotFor: () => 1 }).reason).toMatch(/ya está gastada/);
        expect(reactionOptions({ spells: castable, trigger: 'hit', reactionUsed: false, slotFor: () => 1 }).options[0]).toMatchObject({ slotLevel: 1 });
        expect(reactionOptions({ spells: castable, trigger: 'spell', reactionUsed: false, slotFor: () => 0 }).options).toEqual([]);
        expect(reactionOptions({ spells: castable, trigger: 'spell', reactionUsed: false, slotFor: () => 3, distanceFeet: 90 }).options).toEqual([]);
        expect(reactionOptions({ spells: castable, trigger: 'spell', reactionUsed: false, slotFor: () => 3, distanceFeet: 40 }).options).toHaveLength(1);
    });

    test('Escudo: +5 a la CA hasta su turno, y los proyectiles se deshacen', () => {
        const escudo = spell('hab-escudo-arcano');
        expect(resolveReaction({ spell: escudo, slotLevel: 1, context: { attackTotal: 16, targetAc: 14 } })).toMatchObject({ hitNow: false, acBonus: 5 });
        expect(resolveReaction({ spell: escudo, slotLevel: 1, context: { attackTotal: 20, targetAc: 14 } }).hitNow).toBe(true);
        expect(resolveReaction({ spell: escudo, slotLevel: 1, context: { magicMissile: true, targetAc: 14 } })).toMatchObject({ hitNow: false, negatesMissiles: true });
    });

    test('Contraconjuro: solo si el espacio llega; si no, una prueba contra 10 + su nivel', () => {
        const contra = spell('conj-contraconjuro');
        expect(resolveReaction({ spell: contra, slotLevel: 3, context: { spellName: 'Bola de fuego', spellLevel: 3 } }).countered).toBe(true);
        expect(resolveReaction({ spell: contra, slotLevel: 3, context: { spellName: 'Muro de fuego', spellLevel: 5, modifier: 3 }, roll: fixedRoll([12]) }).countered).toBe(true);
        expect(resolveReaction({ spell: contra, slotLevel: 3, context: { spellName: 'Muro de fuego', spellLevel: 5, modifier: 3 }, roll: fixedRoll([11]) }).countered).toBe(false);
        expect(beatsSpell({ slotLevel: 4, spellLevel: 4, roll: fixedRoll([1]) })).toMatchObject({ success: true, auto: true });
        expect(beatsSpell({ slotLevel: 3, spellLevel: 6, roll: fixedRoll([10]), modifier: 4 })).toMatchObject({ success: false, dc: 16, total: 14 });
    });

    test('Caída de pluma: hasta cinco caen sin hacerse daño', () => {
        const result = resolveReaction({ spell: spell('conj-caida-pluma'), slotLevel: 1, context: { falling: ['A', 'B', 'C', 'D', 'E', 'F'] } });
        expect(result.safe).toEqual(['A', 'B', 'C', 'D', 'E']);
        expect(result.lines[1]).toMatch(/como una pluma/);
    });
});
