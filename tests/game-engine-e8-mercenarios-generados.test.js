/**
 * E8.4 de wiki/ROADMAP_ENTRETENIDO.md: los mercenarios de paso de cada semana.
 */

import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { createSeededRandom } from '../public/scripts/game-engine/combat/seeded-random.js';
import {
    weekOf, weeklyMercenaries, weeklyOffers, recruitPatch, isWeeklyMercenary, waitsForVeteran, recruitLine,
    WEEKLY_MERCENARIES, WEEKLY_MERCENARY_FEE,
} from '../public/scripts/game-engine/campaign/weekly-mercenaries.js';
import { guestMember, HIRELINGS, MERCENARY_FEE } from '../public/scripts/game-engine/campaign/guests.js';
import { hireReasons } from '../public/scripts/game-engine/campaign/mercenary-life.js';
import { dueMercQuests } from '../public/scripts/game-engine/campaign/merc-quests.js';
import { classIdOf } from '../public/scripts/game-engine/ui/pixel-art.js';

const nombres = JSON.parse(fs.readFileSync(new URL('../public/compendio/nombres.json', import.meta.url), 'utf8'));
const compendium = createCompendium({ nombres: nombres.rows });
const roll = (week, level = 3) => weeklyMercenaries({
    random: createSeededRandom(`prueba|mercenarios-de-paso|${week}`), week, level, compendium, taken: HIRELINGS.map(h => h.name),
});

describe('E8.4: los mercenarios de paso', () => {
    test('las semanas del juego van de siete en siete', () => {
        expect(weekOf(1)).toBe(1);
        expect(weekOf(7)).toBe(1);
        expect(weekOf(8)).toBe(2);
        expect(weekOf(0)).toBe(1);
    });

    test('la misma semana, la misma gente; la siguiente, otra', () => {
        const a = roll(2);
        expect(a).toHaveLength(WEEKLY_MERCENARIES);
        expect(roll(2)).toEqual(a);
        expect(roll(3).map(m => m.name)).not.toEqual(a.map(m => m.name));
    });

    test('cada uno con nombre, clase con retrato, nivel cercano, rasgo y presentación', () => {
        for (const week of [1, 2, 3, 4, 5]) {
            const names = new Set();
            for (const merc of roll(week, 4)) {
                expect(merc.name.split(' ').length).toBeGreaterThanOrEqual(2);
                expect(names.has(merc.name)).toBe(false);
                names.add(merc.name);
                expect(HIRELINGS.map(h => h.name)).not.toContain(merc.name);
                // La clase tiene retrato de relleno (`retratos/heroes/<clase>-<género>`).
                expect(classIdOf(merc.className)).not.toBe('');
                expect([3, 4]).toContain(merc.level);
                expect(merc.fee).toBe(WEEKLY_MERCENARY_FEE * merc.level);
                expect(merc.fee).toBeLessThan(MERCENARY_FEE * 4);
                expect(merc.trait.label).not.toBe('');
                expect(merc.pitch).toContain(merc.trait.says);
                expect(['Hombre', 'Mujer']).toContain(merc.gender);
                expect([merc.strength, merc.dexterity, merc.constitution, merc.intelligence, merc.wisdom, merc.charisma].sort((x, y) => y - x))
                    .toEqual([15, 14, 13, 12, 10, 8]);
            }
        }
    });

    test('sin la batería de nombres, los de aquí', () => {
        const list = weeklyMercenaries({ random: createSeededRandom('x'), week: 1, level: 1 });
        expect(list.every(m => m.name.length > 3)).toBe(true);
    });

    test('el contratado sale como contratado, y el de otra semana sigue para despedirle', () => {
        const [first, second] = roll(1);
        const hero = { id: 1, name: 'Ana', level: 3 };
        const merc = { ...guestMember({ id: 2, name: first.name, kind: 'mercenary', contractId: 'gremio', level: first.level, base: hero, stats: first }), ...recruitPatch(first) };
        expect(merc.race).toBe(first.race);
        expect(merc.wisdom).toBe(first.wisdom);
        expect(isWeeklyMercenary(merc)).toBe(true);
        const now = weeklyOffers({ week: roll(1), party: [hero, merc] });
        expect(now.find(o => o.name === first.name)).toMatchObject({ hired: true, id: '2' });
        expect(now.find(o => o.name === second.name)).toMatchObject({ hired: false, id: '' });
        const later = weeklyOffers({ week: roll(2), party: [hero, merc] });
        expect(later.find(o => o.name === first.name)).toMatchObject({ hired: true, weekly: true, pitch: first.pitch });
        expect(recruitLine(first)).toContain(`nivel ${first.level}`);
    });

    test('con las cuatro razones de E8.5', () => {
        const [merc] = roll(1);
        const reasons = hireReasons({ offer: merc, party: [{ name: 'Ana', class: 'guerrero' }] });
        expect(reasons.map(r => r.kind)).toEqual(['riesgo', 'disponible', 'oficio', 'coste']);
        expect(reasons[3].text).toContain(String(merc.fee));
    });

    test('las clases en femenino también dicen su oficio', () => {
        for (const className of ['pícara', 'maga', 'barda', 'clériga']) {
            const [, , oficio] = hireReasons({ offer: { name: 'X', className, fee: 1 }, party: [] });
            expect(oficio.text).not.toContain('pelea como uno más');
        }
    });

    test('sin misión personal hasta que es veterano', () => {
        const [first] = roll(1);
        const hero = { id: 1, name: 'Ana', level: 3 };
        const merc = { ...guestMember({ id: 2, name: first.name, kind: 'mercenary', contractId: 'gremio', level: 3, stats: first }), ...recruitPatch(first) };
        expect(waitsForVeteran(merc)).toBe(true);
        expect(dueMercQuests({ party: [hero, merc], rankOf: () => 5, store: null })).toEqual([]);
        const veteran = { ...merc, veteran: { promoted: true } };
        expect(waitsForVeteran(veteran)).toBe(false);
        expect(dueMercQuests({ party: [hero, veteran], rankOf: () => 5, store: null })).toHaveLength(1);
        // Los escritos no esperan.
        const gerd = guestMember({ id: 3, name: 'Gerd el Mellado', kind: 'mercenary', contractId: 'gremio', level: 3 });
        expect(waitsForVeteran(gerd)).toBe(false);
    });
});
