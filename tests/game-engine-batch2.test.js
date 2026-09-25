import { describe, test, expect } from '@jest/globals';
import { critEffect, roleOf, breaksMorale, isFlanked } from '../public/scripts/game-engine/combat/crits.js';
import { attackEdge } from '../public/scripts/game-engine/combat/maneuvers.js';
import { chooseEnemyBark, ENEMY_BARKS } from '../public/scripts/game-engine/combat/barks.js';
import { noteFeat, newNickname, traitsOf, traitBonus, addScar, scarBonus, desireLine, TRAIT_AT } from '../public/scripts/game-engine/campaign/feats.js';
import { skillModifier } from '../public/scripts/game-engine/rules/checks.js';
import { forageCheck, forageResult } from '../public/scripts/game-engine/campaign/forage.js';
import { pendingByPlace, buildRecap, buildJournal, RUMOR_COLD_DAYS } from '../public/scripts/game-engine/campaign/guidance.js';
import { compareItem, bestFor } from '../public/scripts/game-engine/rules/equipment.js';
import { describeCell, terrainFromAsciiMap } from '../public/scripts/game-engine/board/terrain.js';
import { passiveSpot } from '../public/scripts/game-engine/board/hazards.js';
import { worldMemoryBlock } from '../public/scripts/game-engine/campaign/world-memory.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';

describe('combate', () => {
    test('15: el crítico hace algo según el arma', () => {
        expect(critEffect('bludgeoning')).toMatchObject({ kind: 'condition', condition: 'Prone' });
        expect(critEffect('slashing')).toMatchObject({ kind: 'damage', dice: '1d6' });
        expect(critEffect('piercing')).toMatchObject({ kind: 'condition', condition: 'Restrained' });
        expect(critEffect('')).toMatchObject({ condition: 'Prone' });
    });

    test('13: el rol, de lo que ya se sabe del bicho', () => {
        expect(roleOf({ boss: true }).id).toBe('jefe');
        expect(roleOf({ attackRangeFeet: 60 }).id).toBe('tirador');
        expect(roleOf({ profile: 'guardian' }).id).toBe('guardian');
        expect(roleOf({ profile: 'coward' }).id).toBe('cobarde');
        expect(roleOf({ abilities: ['rayo'] }).id).toBe('lanzador');
        expect(roleOf({}).id).toBe('bruto');
    });

    test('6: se rinde el malherido de un bando que cae; el jefe nunca', () => {
        const hurt = { currentHp: 3, maxHp: 10 };
        expect(breaksMorale({ enemy: hurt, started: 4, standing: 2, random: () => 0.1 })).toBe(true);
        expect(breaksMorale({ enemy: hurt, started: 4, standing: 2, random: () => 0.9 })).toBe(false);
        expect(breaksMorale({ enemy: hurt, started: 4, standing: 3, random: () => 0 })).toBe(false);
        expect(breaksMorale({ enemy: { ...hurt, boss: true }, started: 4, standing: 1, random: () => 0 })).toBe(false);
        expect(breaksMorale({ enemy: { ...hurt, profile: 'coward' }, started: 4, standing: 4, random: () => 0.5 })).toBe(true);
    });

    test('3: flanquear es tener a un aliado justo enfrente, y da ventaja cuerpo a cuerpo', () => {
        const target = { x: 5, y: 5 };
        expect(isFlanked({ x: 4, y: 5 }, target, [{ x: 6, y: 5 }])).toBe(true);
        expect(isFlanked({ x: 4, y: 4 }, target, [{ x: 6, y: 6 }])).toBe(true);
        expect(isFlanked({ x: 4, y: 5 }, target, [{ x: 6, y: 6 }])).toBe(false);
        expect(isFlanked({ x: 3, y: 5 }, target, [{ x: 6, y: 5 }])).toBe(false);
        const edge = attackEdge({ targetId: 'g', distanceFeet: 5, flanked: true });
        expect(edge).toMatchObject({ mode: 'advantage', reasons: ['lo tenéis flanqueado'] });
        expect(attackEdge({ targetId: 'g', distanceFeet: 30, flanked: true }).mode).toBe('normal');
    });

    test('190: los enemigos gritan según cómo pelean, y el que se rinde siempre lo dice', () => {
        expect(ENEMY_BARKS.coward.surrender).toContain(chooseEnemyBark({ event: 'surrender', profile: 'coward', random: () => 0 }));
        expect(chooseEnemyBark({ event: 'hit', random: () => 0.99 })).toBe('');
        expect(ENEMY_BARKS.boss.hit).toContain(chooseEnemyBark({ event: 'hit', boss: true, random: () => 0 }));
    });
});

describe('lo que se gana', () => {
    test('47: tumbar a cinco de lo mismo enseña a pelear contra ello', () => {
        let member = {};
        for (let i = 0; i < TRAIT_AT; i++) member = { feats: noteFeat(member, 'kill', 'Lobo') };
        expect(traitsOf(member).map(t => t.vs)).toEqual(['Lobo']);
        expect(traitBonus(member, 'lobo')).toBe(1);
        expect(traitBonus(member, 'Orco')).toBe(0);
    });

    test('44: el primer apodo que se gana se queda', () => {
        let member = {};
        for (let i = 0; i < 3; i++) member = { feats: noteFeat(member, 'downed') };
        expect(newNickname(member)).toMatchObject({ name: 'Tres Vidas' });
        expect(newNickname({ ...member, nickname: 'Otro' })).toBeNull();
        expect(newNickname({})).toBeNull();
    });

    test('56: las cicatrices imponen, hasta +2', () => {
        let scars = addScar({}, 'Brazo roto');
        expect(scars).toEqual(['Cicatriz de brazo roto']);
        scars = addScar({ scars }, 'Tajo');
        scars = addScar({ scars }, 'Quemadura');
        expect(scarBonus({ scars })).toBe(2);
        expect(skillModifier({ class: 'mago', charisma: 10, scars }, 'intimidation').modifier).toBe(2);
        expect(skillModifier({ class: 'mago', charisma: 10, scars }, 'persuasion').modifier).toBe(0);
        expect(newNickname({ scars })).toMatchObject({ name: 'Mil Cicatrices' });
    });

    test('38: qué quiere ahora, el cuerpo primero', () => {
        expect(desireLine({ wants: 'coin', hpPct: 20 })).toMatch(/curarse/);
        expect(desireLine({ wants: 'coin', hpPct: 90, hungry: true })).toMatch(/hambre/);
        expect(desireLine({ wants: 'quiet', hpPct: 90 })).toMatch(/sin sangre/);
    });

    test('63: lo nuevo frente a lo que lleva, y a quién le viene mejor', () => {
        const club = { id: 'c', name: 'Garrote', damageDice: '1d4', slot: 'weapon' };
        const axe = { name: 'Hacha', damageDice: '1d8', slot: 'weapon' };
        const bruna = { name: 'Bruna', items: [club], equippedItems: { weapon: 'c' } };
        const sela = { name: 'Sela', items: [], equippedItems: {} };
        expect(compareItem(axe, bruna).line).toBe('+2 de daño frente a Garrote');
        // El garrote (1d4) y los puños están en el mismo peldaño: empatan, y gana el primero.
        expect(bestFor(axe, [bruna, sela])).toBe('Hacha: +2 de daño para Bruna frente a Garrote');
        expect(bestFor(club, [bruna])).toBe('');
        expect(compareItem({ name: 'Anillo' }, bruna).line).toBe('');
    });
});

describe('exploración y mundo', () => {
    test('68: se forrajea fuera del pueblo, más fácil en el bosque', () => {
        expect(forageCheck({ locationType: 'village' }).allowed).toBe(false);
        expect(forageCheck({ locationType: 'wilderness', biome: 'bosque' }).dc).toBe(10);
        expect(forageCheck({ locationType: 'wilderness', biome: 'nieve' }).dc).toBe(15);
        expect(forageResult({ success: false, who: 'Bruna' })).toMatchObject({ ate: false, drank: true });
    });

    test('78: la trampa de al lado se ve con buen ojo, la de debajo no', () => {
        const board = { hazards: [
            { id: 't1', name: 'Cepo', trigger: 'enter', x: 3, y: 2, spotDC: 12, tell: 'hojas removidas' },
            { id: 't2', name: 'Foso', trigger: 'enter', x: 2, y: 2, spotDC: 12 },
            { id: 't3', name: 'Lejos', trigger: 'enter', x: 9, y: 9, spotDC: 5 },
        ] };
        const out = passiveSpot(board, { x: 2, y: 2 }, 13);
        expect(out.spotted.map(h => h.id)).toEqual(['t1']);
        expect(passiveSpot(board, { x: 2, y: 2 }, 11).spotted).toEqual([]);
    });

    test('164: lo que es una casilla, dicho para quien juega', () => {
        const terrain = terrainFromAsciiMap(['#~', 'Dv']);
        expect(describeCell(terrain, 0, 0)).toBe('Casilla (1, 1) · Pared: no se pasa ni se ve a través');
        expect(describeCell(terrain, 1, 0)).toMatch(/Terreno difícil/);
        expect(describeCell(terrain, 0, 1)).toMatch(/Puerta cerrada/);
        expect(describeCell(terrain, 1, 1)).toMatch(/Precipicio/);
    });

    test('81: lo pendiente en cada sitio', () => {
        const out = pendingByPlace({
            places: ['El Pueblo', 'El Peaje', 'La Ermita'],
            board: [{ locationName: 'El Peaje' }, { locationName: 'El Peaje' }],
            taken: { locationName: 'La Ermita' },
            rumors: { 'El Pueblo': 2 },
            thread: ['la ermita'],
        });
        expect(out).toEqual({
            'El Pueblo': 'Pendiente: 2 rumores',
            'El Peaje': 'Pendiente: 2 encargos',
            'La Ermita': 'Pendiente: el hilo · tu encargo',
        });
    });

    test('91: un rumor viejo se marca frío en el diario', () => {
        const heard = [{ text: 'Plata falsa', day: 1 }, { text: 'Humo', day: 10 }];
        const items = buildJournal({ open: [], heard, today: 1 + RUMOR_COLD_DAYS }).find(s => s.title === 'Lo que se oye')?.items ?? [];
        expect(items[0]).toMatch(/ya frío/);
        expect(items[1]).toMatch(/hace 5 día\(s\)/);
    });

    test('108: «Anteriormente…» con lo justo para retomar', () => {
        const recap = buildRecap({
            day: 9, place: 'El Pueblo', focus: { title: 'El cáliz', hint: 'Sal vivo.' },
            deeds: [{ day: 7, text: 'Huisteis del peaje.' }], memory: 'Hoy: Bran se unió.',
        });
        expect(recap?.title).toBe('Anteriormente… (día 9, en El Pueblo)');
        expect(recap?.lines).toEqual(['Entre manos: El cáliz — Sal vivo.', 'Día 7: Huisteis del peaje.', 'Recordáis: Hoy: Bran se unió.']);
        expect(buildRecap({ day: 1, place: '' })).toBeNull();
    });

    test('86: lo que aquí se sabe de vosotros llega al narrador', () => {
        expect(worldMemoryBlock({ today: 1, here: { place: 'El Pueblo', lines: ['Os deben mucho.'] } }))
            .toMatch(/- En El Pueblo se acuerdan: Os deben mucho\./);
    });

    test('68: la ficha de forrajear sale fuera del tablero', () => {
        expect(buildActionChips({ forage: true }).some(c => c.command === '/forrajear')).toBe(true);
        expect(buildActionChips({ forage: true, hasBoard: true }).some(c => c.command === '/forrajear')).toBe(false);
    });
});
