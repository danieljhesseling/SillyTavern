import { describe, test, expect } from '@jest/globals';
import { basePrice, weeklyStock, priceToday, sellPrice, canSell, junkOf, SELL_SHARE } from '../public/scripts/game-engine/campaign/shop.js';
import { festivalsOf, festivalToday, daysUntil, MONTH_DAYS } from '../public/scripts/game-engine/world/festivals.js';
import { newLetters, readLetters } from '../public/scripts/game-engine/campaign/letters.js';
import { bump, describeStats, readStats } from '../public/scripts/game-engine/campaign/stats.js';
import { intentSkills } from '../public/scripts/game-engine/campaign/intents.js';
import { tipFor, GLOSSARY, TIPS } from '../public/scripts/game-engine/ui/shell/tips.js';
import { lengthNote, nextLength, LENGTHS } from '../public/scripts/game-engine/campaign/narration.js';
import { clockWarnings } from '../public/scripts/game-engine/world/news.js';
import { noteFeat, knackBonus, knacksOf, KNACK_AT } from '../public/scripts/game-engine/campaign/feats.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';
import { DIFFICULTIES, difficultyOf, DEFAULT_SURVIVAL, readSurvival } from '../public/scripts/game-engine/rules/mortality.js';
import { worldMemoryBlock } from '../public/scripts/game-engine/campaign/world-memory.js';
import { actionForKey } from '../public/scripts/game-engine/ui/shell/shortcuts.js';

describe('la tienda', () => {
    test('134: el género de la semana sale de la semilla, y la trastienda es para quien os aprecia', () => {
        const describe = (/** @type {string} */ n) => ({ category: n.startsWith('M') ? 'magic' : 'gear' });
        const names = ['A', 'B', 'C', 'D', 'E', 'M1', 'M2'];
        const seq = [0.1, 0.5, 0.9, 0.3, 0.2, 0.7];
        const next = () => { let i = 0; return () => seq[i++ % seq.length]; };
        const plain = weeklyStock({ names, describe, random: next() });
        expect(plain).toHaveLength(5);
        expect(plain.filter(n => n.startsWith('M'))).toHaveLength(1);
        expect(weeklyStock({ names, describe, random: next() })).toEqual(plain);
        expect(weeklyStock({ names, describe, random: next(), reputation: 2 }).filter(n => n.startsWith('M'))).toHaveLength(2);
    });

    test('127: el precio de hoy, parte a parte', () => {
        const today = priceToday({ base: 100, market: 1.15, marketReasons: ['Han cerrado el paso.'], standing: 0.9, ruler: 'Vane', haggled: true, festival: true });
        expect(today.reasons).toEqual(['+15 %: Han cerrado el paso.', '−10 %: Vane os aprecia', '−10 %: es día de fiesta', '−15 %: habéis regateado']);
        expect(today.price).toBe(Math.round(100 * 1.15 * 0.9 * 0.9 * 0.85));
        expect(priceToday({ base: 30 })).toEqual({ price: 30, reasons: [] });
    });

    test('118: se vende la chatarra, no lo puesto ni las llaves', () => {
        const dagger = { id: 'd', name: 'Daga', category: 'weapon', subcategory: 'simple_melee' };
        const sword = { id: 's', name: 'Espada', category: 'weapon', subcategory: 'martial_melee' };
        const key = { id: 'k', name: 'Llave del peaje', category: 'gear', subcategory: 'tool' };
        const ring = { id: 'r', name: 'Anillo', category: 'magic', subcategory: 'ring' };
        const member = { id: 1, items: [dagger, sword, key, ring], equippedItems: { weapon: 's' } };
        expect(canSell(sword, member)).toBe(false);
        expect(canSell(key, member)).toBe(false);
        expect(junkOf([member]).map(j => j.name)).toEqual(['Daga']);
        expect(sellPrice(dagger)).toBe(Math.floor(basePrice(dagger) * SELL_SHARE));
        expect(basePrice(ring)).toBeGreaterThan(basePrice(dagger));
    });
});

describe('el mundo', () => {
    test('89: cada pueblo tiene su fiesta, el mismo día cada mes', () => {
        const festivals = festivalsOf([
            { name: 'Pueblo', locationType: 'village' }, { name: 'Cueva', locationType: 'dungeon' },
        ], () => () => 0.1);
        expect(Object.keys(festivals)).toEqual(['Pueblo']);
        const { day } = festivals.Pueblo;
        expect(festivalToday(festivals, 'Pueblo', day)?.name).toBeTruthy();
        expect(festivalToday(festivals, 'Pueblo', day + MONTH_DAYS)).not.toBeNull();
        expect(festivalToday(festivals, 'Pueblo', day + 1)).toBeNull();
        expect(daysUntil(festivals.Pueblo, day - 2 > 0 ? day - 2 : day + MONTH_DAYS - 2)).toBe(2);
    });

    test('113: cartas de quien os aprecia, de quien os odia y de quien os prestó, una por semana', () => {
        const factions = [{ id: 'a', name: 'Vane', reputation: 3 }, { id: 'b', name: 'Keller', reputation: -4 }, { id: 'c', name: 'Nadie', reputation: 0 }];
        const letters = newLetters({ factions, debt: { amount: 30, due: 9, creditor: 'Maese Orl' }, today: 7 });
        expect(letters.map(l => l.kind)).toEqual(['favor', 'threat', 'debt']);
        expect(newLetters({ factions, today: 7, sent: letters.map(l => l.id) })).toEqual([]);
        expect(readLetters(letters)).toHaveLength(3);
    });

    test('117: la meta de una facción avisa a la mitad y a tres cuartos', () => {
        const at = (/** @type {number} */ n) => [{ id: 'k', name: 'Keller', goal: { at: n, of: 4, target: 'el molino' } }];
        expect(clockWarnings(at(1), at(2))[0].note).toMatch(/va por la mitad.*el molino/);
        expect(clockWarnings(at(2), at(3))[0].note).toMatch(/a punto de salirse con la suya/);
        expect(clockWarnings(at(3), at(4))).toEqual([]);
        expect(clockWarnings(at(0), at(1))).toEqual([]);
    });
});

describe('el personaje y el grupo', () => {
    test('55: a fuerza de pegar con un arma, se le coge el tranquillo', () => {
        let member = {};
        for (let i = 0; i < KNACK_AT; i++) member = { feats: noteFeat(member, 'hit', 'Garrote') };
        expect(knackBonus(member, 'Garrote')).toBe(1);
        expect(knackBonus(member, 'Hacha')).toBe(0);
        expect(knacksOf(member)).toEqual(['Soltura con Garrote: +1 al daño']);
    });

    test('200: la partida en números', () => {
        let stats = bump(null, 'fights', 3);
        stats = bump(stats, 'wins', 2);
        stats = bump(stats, 'gold', 40);
        expect(readStats(stats)).toMatchObject({ fights: 3, wins: 2, gold: 40, deaths: 0 });
        const lines = describeStats(stats, { days: 12, places: 9 });
        expect(lines[0]).toBe('12 días de campaña · 9 sitios en el mapa');
        expect(lines[1]).toBe('3 combates: 2 ganados');
        expect(lines.at(-1)).toBe('Nadie del grupo ha muerto');
    });

    test('198: tres dificultades con nombre, y se reconoce cuál es cada supervivencia', () => {
        expect(Object.keys(DIFFICULTIES)).toEqual(['historia', 'veterana', 'hierro']);
        expect(difficultyOf(DEFAULT_SURVIVAL)).toBe('veterana');
        expect(difficultyOf(DIFFICULTIES.hierro.survival)).toBe('hierro');
        expect(difficultyOf({ ...DEFAULT_SURVIVAL, exposure: false })).toBe('');
        expect(readSurvival(DIFFICULTIES.historia.survival).needs).toBe(false);
    });
});

describe('el chat y el narrador', () => {
    test('137: lo que escribes pide una tirada', () => {
        expect(intentSkills('Intento convencer al guardia de que nos deje pasar')).toEqual(['persuasion']);
        expect(intentSkills('Me escondo detrás del carro y miro alrededor')).toEqual(['stealth', 'perception']);
        expect(intentSkills('Hola')).toEqual([]);
        expect(intentSkills('Le cuento lo que pasó')).toEqual([]);
    });

    test('149: el largo de la narración, dando la vuelta', () => {
        expect(lengthNote('ficha')).toBe('');
        expect(lengthNote('breve')).toMatch(/un párrafo corto/);
        expect(nextLength('ficha')).toBe('breve');
        expect(nextLength('extenso')).toBe('ficha');
        expect(Object.keys(LENGTHS)).toHaveLength(4);
    });

    test('148: en modo ahorro, el bloque de memoria se queda en lo justo', () => {
        const input = {
            today: 5,
            deeds: [{ day: 1, text: 'Uno.' }, { day: 2, text: 'Dos.' }, { day: 3, text: 'Tres.' }],
            factions: [{ id: 'a', name: 'Vane', reputation: 1 }, { id: 'b', name: 'Keller', reputation: -3 }],
            memories: ['Hoy: A.', 'Hoy: B.'],
        };
        const full = worldMemoryBlock(input);
        const lean = worldMemoryBlock({ ...input, compact: true });
        expect(lean.length).toBeLessThan(full.length);
        expect(lean).not.toMatch(/Uno\.|Dos\.|Vane|Hoy: A\./);
        expect(lean).toMatch(/Tres\.[\s\S]*Keller[\s\S]*Hoy: B\./);
    });
});

describe('comodidad', () => {
    test('169: si no caben, la última dice cuántas quedan', () => {
        const places = Array.from({ length: 9 }, (_, i) => ({ name: `Sitio ${i}` }));
        const chips = buildActionChips({ companions: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], people: [{ name: 'X' }, { name: 'Y' }], rumors: 2, places, hitDice: 2, hurt: true });
        expect(chips).toHaveLength(7);
        expect(chips.at(-1)).toMatchObject({ id: 'more', label: expect.stringMatching(/^\+\d+ más$/) });
        expect(buildActionChips({ companions: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], people: [{ name: 'X' }, { name: 'Y' }], rumors: 2, places, hitDice: 2, hurt: true, limit: Infinity }).some(c => c.id === 'more')).toBe(false);
    });

    test('137: lo que escribes sale como ficha, la primera', () => {
        const chips = buildActionChips({ typed: [{ skill: 'persuasion', label: 'Persuasión' }], rumors: 1 });
        expect(chips[0]).toMatchObject({ id: 'typed:persuasion', label: '🎲 Persuasión (por lo que escribes)' });
    });

    test('155 y 156: un consejo una vez, y el glosario completo', () => {
        expect(tipFor('combat', [])?.text).toBe(TIPS.combat);
        expect(tipFor('combat', ['combat'])).toBeNull();
        expect(tipFor('nada', [])).toBeNull();
        expect(GLOSSARY.length).toBeGreaterThanOrEqual(12);
        expect(GLOSSARY.every(g => g.term && g.means)).toBe(true);
        expect(actionForKey({ key: 'l' })).toBe('glossary');
    });
});
