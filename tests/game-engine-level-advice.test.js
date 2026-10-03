import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    roleOf, keyAbilities, recommendAbilityPicks, recommendPerk, recommendSpells, preparedByRole, describeAdvice, spellWorth, heroPreparation,
} from '../public/scripts/game-engine/rules/level-advice.js';
import { PERKS } from '../public/scripts/game-engine/rules/level-perks.js';
import { normalizeSpell } from '../public/scripts/game-engine/rules/spell-catalogue.js';

const read = (/** @type {string} */ file) => JSON.parse(fs.readFileSync(new URL(`../public/compendio/${file}`, import.meta.url), 'utf8'));
const classes = read('clases.json').rows;
const catalogue = read('conjuros.json').rows;
const cleric = classes.find((/** @type {any} */ c) => c.id === 'clerigo');
const perk = (/** @type {string} */ id) => PERKS.find(p => p.id === id);

describe('E7.4: subir de nivel recomendado y preparar según el papel', () => {
    test('el papel sale de la formación y si no de la clase', () => {
        expect(roleOf({ id: 'a', class: 'Clériga' })).toBe('sanador');
        expect(roleOf({ id: 'a', class: 'Guerrero' })).toBe('frente');
        expect(roleOf({ id: 'a', class: 'Pícara' })).toBe('dano');
        expect(roleOf({ id: 'a', class: 'Mago' })).toBe('magia');
        expect(roleOf({ id: 'a', class: 'Bardo' })).toBe('apoyo');
        // Quien cura en la formación cura, sea lo que sea.
        expect(roleOf({ id: 'a', class: 'Paladín' }, { duties: { cura: 'a' } })).toBe('sanador');
        // Una clase del taller: por su mejor característica.
        expect(roleOf({ id: 'a', class: 'Cazarrecompensas', dexterity: 17, strength: 10 })).toBe('dano');
    });

    test('los puntos a la característica principal hasta 20, y lo que sobra a la siguiente', () => {
        expect(keyAbilities({ class: 'Clérigo' })[0]).toBe('wisdom');
        expect(recommendAbilityPicks({ class: 'Clérigo', wisdom: 16 }, 2)).toEqual({ wisdom: 2 });
        expect(recommendAbilityPicks({ class: 'Clérigo', wisdom: 19, constitution: 14 }, 2)).toEqual({ wisdom: 1, constitution: 1 });
        // El guerrero ágil sube Destreza.
        expect(recommendAbilityPicks({ class: 'Guerrero', strength: 10, dexterity: 16 }, 2)).toEqual({ dexterity: 2 });
    });

    test('la mejora que más le sirve a su papel', () => {
        const offered = [perk('labia'), perk('piel-dura'), perk('mano-firme')];
        expect(recommendPerk(offered, 'frente')).toBe('piel-dura');
        expect(recommendPerk(offered, 'dano')).toBe('mano-firme');
        expect(recommendPerk(offered, 'apoyo')).toBe('labia');
        expect(recommendPerk([], 'frente')).toBe('');
    });

    test('quien cura elige curas; quien ataca, daño', () => {
        const spells = catalogue.filter((/** @type {any} */ s) => (s.classes ?? []).includes('clerigo') && s.level === 1).map(normalizeSpell);
        const healer = recommendSpells(spells, 2, 'sanador');
        expect(healer.every(id => spells.find((/** @type {any} */ s) => s.id === id)?.healing)).toBe(true);
        const striker = recommendSpells(spells, 1, 'magia');
        expect(spells.find((/** @type {any} */ s) => s.id === striker[0])?.damage).toBeTruthy();
        // Lo lento (un ritual de diez minutos) va al final.
        expect(spellWorth({ healing: '1d8', castingTime: '10min' }, 'sanador')).toBeLessThan(spellWorth({ healing: '1d8' }, 'sanador'));
    });

    test('tras el descanso largo, la clériga prepara curas primero, hasta lo que le cabe', () => {
        const member = { id: 'c', class: 'Clériga', level: 3, wisdom: 16 };
        const prepared = preparedByRole({ member, classRow: cleric, catalogue, role: 'sanador' });
        expect(prepared).toHaveLength(3 + 3);
        const first = catalogue.find((/** @type {any} */ s) => s.id === prepared?.[0]);
        expect(first.healing).toBeTruthy();
        expect(prepared?.slice(0, 2)).toEqual(['hab-curar', 'conj-palabra-curacion']);
        // El de ataque prepara al revés: el daño primero.
        const striker = preparedByRole({ member, classRow: cleric, catalogue, role: 'dano' });
        expect(catalogue.find((/** @type {any} */ s) => s.id === striker?.[0]).damage).toBeTruthy();
        // Quien no prepara (sin magia de 5e), nada.
        expect(preparedByRole({ member, classRow: { id: 'guerrero' }, catalogue, role: 'frente' })).toBeNull();
    });

    test('el cuadro del héroe sale ya marcado con lo de su papel, y lo dice', () => {
        const member = { id: 'h', class: 'Clériga', level: 3, wisdom: 16, prepared: ['conj-bendecir'] };
        const start = heroPreparation({ member, classRow: cleric, catalogue, role: 'sanador' });
        expect(start?.chosen).toEqual(preparedByRole({ member, classRow: cleric, catalogue, role: 'sanador' }));
        expect(start?.chosen.slice(0, 2)).toEqual(['hab-curar', 'conj-palabra-curacion']);
        expect(start?.line).toBe('Marcado lo de su papel: curar. Cámbialo si quieres.');
        // Quien no prepara: nada que marcar (el cuadro queda como estaba).
        expect(heroPreparation({ member, classRow: { id: 'guerrero' }, catalogue, role: 'frente' })).toBeNull();
    });

    test('lo recomendado, dicho en una frase', () => {
        expect(describeAdvice({ role: 'sanador', picks: { wisdom: 2 }, perk: 'Aguante', spells: ['Curar heridas'] }))
            .toBe('Su papel: curar. Lo recomendado: +2 a Sabiduría; Aguante; Curar heridas.');
    });
});
