import { describe, test, expect } from '@jest/globals';
import {
    SKILLS, DEFAULT_DC, proficiencyBonus, skillModifier, checkOptions, rollCheck,
} from '../public/scripts/game-engine/rules/checks.js';

const bardo = { name: 'Lyra', class: 'Bardo', level: 5, charisma: 18, wisdom: 12, dexterity: 14, strength: 8 };
const guerrero = { name: 'Brand', class: 'Guerrero', level: 1, charisma: 8, strength: 16 };

describe('lo que suma cada uno', () => {
    test('la competencia sube con el nivel, como en 5e', () => {
        expect(proficiencyBonus(1)).toBe(2);
        expect(proficiencyBonus(5)).toBe(3);
        expect(proficiencyBonus(17)).toBe(6);
    });

    test('el bardo persuade con su Carisma y su competencia', () => {
        expect(skillModifier(bardo, 'persuasion')).toEqual({ modifier: 4 + 3, proficient: true });
    });

    test('el guerrero persuade con su Carisma, y ya', () => {
        expect(skillModifier(guerrero, 'persuasion')).toEqual({ modifier: -1, proficient: false });
        expect(skillModifier(guerrero, 'athletics')).toEqual({ modifier: 3 + 2, proficient: true });
    });

    test('la clase se entiende en inglés y en castellano', () => {
        expect(skillModifier({ class: 'Rogue', dexterity: 10 }, 'stealth').proficient).toBe(true);
        expect(skillModifier({ class: 'pícaro', dexterity: 10 }, 'stealth').proficient).toBe(true);
    });

    test('una habilidad que no existe no suma nada', () => {
        expect(skillModifier(bardo, 'bailar')).toEqual({ modifier: 0, proficient: false });
    });
});

describe('checkOptions', () => {
    test('una por habilidad, con lo que suma a la vista', () => {
        const list = checkOptions(bardo);
        expect(list.map(o => o.id)).toEqual(Object.keys(SKILLS));
        expect(list.find(o => o.id === 'persuasion')?.label).toBe('Persuasión +7');
        expect(list.every(o => o.enabled)).toBe(true);
    });

    test('con una tirada pendiente, todas cerradas y se dice por qué', () => {
        const list = checkOptions(bardo, { locked: true });
        expect(list.every(o => !o.enabled)).toBe(true);
        expect(list[0].detail).toMatch(/envía el mensaje/);
    });

    test('sin nadie, nada', () => {
        expect(checkOptions(null)).toEqual([]);
    });
});

describe('rollCheck', () => {
    test('sale si llega a la CD', () => {
        const result = rollCheck({ member: bardo, skill: 'persuasion', rollD20: () => 5 });
        expect(result).toMatchObject({ natural: 5, modifier: 7, total: 12, dc: DEFAULT_DC, success: true });
    });

    test('no sale si no llega', () => {
        expect(rollCheck({ member: guerrero, skill: 'persuasion', rollD20: () => 12 })?.success).toBe(false);
    });

    test('el 20 siempre sale y el 1 siempre falla', () => {
        expect(rollCheck({ member: guerrero, skill: 'persuasion', rollD20: () => 20, dc: 30 })?.success).toBe(true);
        expect(rollCheck({ member: bardo, skill: 'persuasion', rollD20: () => 1, dc: 2 })?.success).toBe(false);
    });

    test('la línea para el modelo lo dice todo y pide no cambiarlo', () => {
        const result = rollCheck({ member: bardo, skill: 'deception', rollD20: () => 15 });
        expect(result?.line).toBe('[TIRADA Engaño de Lyra: d20 15 +7 = 22 contra CD 12 → Éxito. '
            + 'El dado ya está tirado: narra la consecuencia, no lo cambies.]');
        expect(result?.draft).toMatch(/\nIntento engañar $/);
    });

    test('una habilidad que no existe no tira', () => {
        expect(rollCheck({ member: bardo, skill: 'bailar', rollD20: () => 10 })).toBeNull();
    });
});
