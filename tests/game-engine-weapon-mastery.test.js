/**
 * Tanda 10: las maestrías de armas de D&D 2024, el impacto sin armas y las acciones nuevas
 * (wiki/maquetas/ENCARGO_COMBATE_VTT.md).
 */

import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import {
    MASTERIES, MASTERY_IDS, FORM_MASTERY, masteryOf, isLightWeapon, isRangedWeapon, hasWeaponMastery, masteryDC,
    masteryFires, grazeDamage, toppled, pushPath, cleaveTarget, combineEdge, readTactics, turnFlags, markTurn,
    noteVex, takeVex, hasVex, noteStudied, isWeaponItem,
} from '../public/scripts/game-engine/rules/weapon-mastery.js';
import {
    unarmedDamage, unarmedDC, escapeSave, freeHand, saveFails, saveLine, UNARMED_MODES,
} from '../public/scripts/game-engine/rules/unarmed.js';
import {
    ACTIONS_2024, HIDE_DC, canHide2024, studyDC, studyFacts, newFacts, healingPotionOf, potionsOf, standCost, canStand,
    crawlCost, offHandWeaponOf, judgeOffHand,
} from '../public/scripts/game-engine/rules/actions-2024.js';

const armas = JSON.parse(fs.readFileSync(new URL('../public/compendio/armas.json', import.meta.url), 'utf8'));

describe('las maestrías', () => {
    test('las ocho de 2024, con su nombre en castellano y sin «ft»', () => {
        expect(MASTERY_IDS.sort()).toEqual(['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex']);
        expect(MASTERIES.vex.label).toBe('Molestar');
        expect(MASTERIES.topple.label).toBe('Derribar');
        for (const m of Object.values(MASTERIES)) expect(m.short).not.toMatch(/\bft\b/);
    });

    test('cada arma del compendio dice la suya, y la tabla del motor dice lo mismo', () => {
        for (const row of armas.rows) {
            expect(MASTERY_IDS).toContain(row.mastery);
            expect(FORM_MASTERY[row.id]).toBe(row.mastery);
        }
    });

    test('las de 2024: espada corta molesta, hacha derriba, espada larga debilita, arco largo ralentiza', () => {
        expect(masteryOf({ name: 'Espada corta de hierro', from: { forma: 'forma-espada-corta' } })).toBe('vex');
        expect(masteryOf({ name: 'Hacha', kitForm: 'forma-hacha' })).toBe('topple');
        expect(masteryOf({ name: 'Longsword' })).toBe('sap');
        expect(masteryOf({ name: 'Arco largo de tejo' })).toBe('slow');
        expect(masteryOf({ name: 'Hacha de mano' })).toBe('vex');
        expect(masteryOf({ name: 'Hacha a dos manos' })).toBe('cleave');
        expect(masteryOf({ name: 'Daga' })).toBe('nick');
        expect(masteryOf({ name: 'Espadón' })).toBe('graze');
        expect(masteryOf({ name: 'Martillo de guerra' })).toBe('push');
        expect(masteryOf({ name: 'Farol' })).toBe('');
        // La que trae el objeto manda.
        expect(masteryOf({ name: 'Daga', mastery: 'vex' })).toBe('vex');
    });

    test('ligeras, de distancia y armas', () => {
        expect(isLightWeapon({ name: 'Daga de plata' })).toBe(true);
        expect(isLightWeapon({ name: 'Espada larga', from: { forma: 'forma-espada-larga' } })).toBe(false);
        expect(isLightWeapon({ name: 'Cosa', from: { forma: 'forma-cimitarra' } })).toBe(true);
        expect(isRangedWeapon({ name: 'Arco corto', rangeFeet: 80 })).toBe(true);
        expect(isRangedWeapon({ name: 'Daga', rangeFeet: 20 })).toBe(false);
        expect(isWeaponItem({ name: 'Daga', type: 'weapon' })).toBe(true);
        expect(isWeaponItem({ name: 'Poción', type: 'gear' })).toBe(false);
    });

    test('solo las clases marciales le sacan el truco', () => {
        expect(hasWeaponMastery({ class: 'Guerrero' })).toBe(true);
        expect(hasWeaponMastery({ class: 'Pícaro' })).toBe(true);
        expect(hasWeaponMastery({ class: 'Explorador' })).toBe(true);
        expect(hasWeaponMastery({ class: 'Soldado' })).toBe(true);
        expect(hasWeaponMastery({ class: 'Mago' })).toBe(false);
        expect(hasWeaponMastery({ class: 'Clérigo' })).toBe(false);
    });

    test('la CD: 8 + modificador + competencia', () => {
        expect(masteryDC(3, 1)).toBe(13);
        expect(masteryDC(4, 5)).toBe(15);
    });

    test('cuándo salta cada una', () => {
        expect(masteryFires('vex', { hit: true, damage: 4 })).toBe(true);
        expect(masteryFires('vex', { hit: true, damage: 0 })).toBe(false);
        expect(masteryFires('topple', { hit: true })).toBe(true);
        expect(masteryFires('topple', { hit: false })).toBe(false);
        expect(masteryFires('graze', { hit: false })).toBe(true);
        expect(masteryFires('graze', { hit: true, damage: 5 })).toBe(false);
        expect(masteryFires('nick', { hit: true, damage: 5 })).toBe(false);
        expect(masteryFires('', { hit: true, damage: 5 })).toBe(false);
    });

    test('Rozar hace el modificador, nunca negativo; Derribar: el empate salva', () => {
        expect(grazeDamage(3)).toBe(3);
        expect(grazeDamage(-1)).toBe(0);
        expect(toppled({ dc: 13, saveTotal: 12 })).toBe(true);
        expect(toppled({ dc: 13, saveTotal: 13 })).toBe(false);
    });

    test('Empujar aparta hasta 10 pies en línea recta, se para ante un muro y cae al vacío', () => {
        const free = (/** @type {number} */ x) => x < 5;
        expect(pushPath({ from: { x: 0, y: 0 }, target: { x: 1, y: 0 }, cells: 2, isFree: (x) => free(x) })).toEqual({ to: { x: 3, y: 0 }, moved: 2, falls: false });
        expect(pushPath({ from: { x: 2, y: 0 }, target: { x: 3, y: 0 }, cells: 2, isFree: (x) => free(x) })).toEqual({ to: { x: 4, y: 0 }, moved: 1, falls: false });
        expect(pushPath({ from: { x: 0, y: 0 }, target: { x: 1, y: 1 }, cells: 2, isFree: () => true, isChasm: (x) => x === 3 }))
            .toEqual({ to: { x: 3, y: 3 }, moved: 2, falls: true });
    });

    test('Hender busca al más herido pegado al primero y a tu alcance', () => {
        const id = cleaveTarget({
            first: { id: 'a', x: 1, y: 0 },
            attacker: { x: 0, y: 0 },
            reachFeet: 5,
            others: [
                { id: 'a', x: 1, y: 0, hp: 5 },
                { id: 'b', x: 1, y: 1, hp: 9 },
                { id: 'c', x: 0, y: 1, hp: 3 },
                { id: 'd', x: 3, y: 0, hp: 1 },
            ],
        });
        expect(id).toBe('c');
        expect(cleaveTarget({ first: { id: 'a', x: 1, y: 0 }, attacker: { x: 0, y: 0 }, reachFeet: 5, others: [] })).toBe('');
    });

    test('la ventaja de 2024 se junta con la del motor como en 5e', () => {
        expect(combineEdge({ mode: 'normal', reasons: [] }, ['le molestaste']).mode).toBe('advantage');
        expect(combineEdge({ mode: 'disadvantage', reasons: ['ataca desde el suelo'] }, ['le molestaste']).mode).toBe('normal');
        expect(combineEdge({ mode: 'normal', reasons: ['a', 'b'] }, ['c']).mode).toBe('normal');
        expect(combineEdge({ mode: 'advantage', reasons: ['a'] }, [], ['b']).mode).toBe('normal');
        expect(combineEdge({ mode: 'advantage', reasons: ['a'] }).mode).toBe('advantage');
    });
});

describe('lo que recuerda el turno', () => {
    test('un turno nuevo empieza en blanco sin que nadie lo borre', () => {
        let raw = markTurn(null, '7', 2, { swapped: true, lightWeapon: 'd1' });
        expect(turnFlags(raw, '7', 2)).toMatchObject({ swapped: true, lightWeapon: 'd1' });
        expect(turnFlags(raw, '7', 3).swapped).toBe(false);
        expect(turnFlags(raw, '8', 2).swapped).toBe(false);
        raw = JSON.parse(JSON.stringify(raw));
        expect(readTactics(raw).turn?.lightWeapon).toBe('d1');
    });

    test('Molestar: ventaja en el siguiente ataque contra él, se gasta y caduca', () => {
        let raw = noteVex(null, { by: '1', target: 'e1', round: 3 });
        expect(hasVex(raw, { by: '1', target: 'e1', round: 4 })).toBe(true);
        expect(hasVex(raw, { by: '1', target: 'e2', round: 4 })).toBe(false);
        expect(hasVex(raw, { by: '2', target: 'e1', round: 4 })).toBe(false);
        expect(hasVex(raw, { by: '1', target: 'e1', round: 5 })).toBe(false);
        const taken = takeVex(raw, { by: '1', target: 'e1', round: 3 });
        expect(taken.vex).toBe(true);
        raw = taken.state;
        expect(hasVex(raw, { by: '1', target: 'e1', round: 3 })).toBe(false);
    });

    test('Estudiar recuerda lo que ya se sabe', () => {
        let raw = noteStudied(null, 'e1', ['debil']);
        raw = noteStudied(raw, 'e1', ['perfil', 'debil']);
        expect(readTactics(raw).studied.e1.sort()).toEqual(['debil', 'perfil']);
    });
});

describe('el impacto sin armas', () => {
    test('el golpe: 1 + Fuerza, nunca menos de 1', () => {
        expect(unarmedDamage({ strength: 16 })).toMatchObject({ damage: 4, modifier: 3, damageType: 'contundente' });
        expect(unarmedDamage({ strength: 6 }).damage).toBe(1);
    });

    test('la CD de agarrar y empujar: 8 + Fuerza + competencia', () => {
        expect(unarmedDC({ strength: 16, level: 1 })).toBe(13);
        expect(unarmedDC({ strength: 10, level: 9 })).toBe(12);
    });

    test('salva con la mejor de Fuerza y Destreza; el empate aguanta', () => {
        expect(escapeSave({ strength: 8, dexterity: 14 })).toEqual({ modifier: 2, ability: 'dexterity', label: 'Destreza' });
        expect(escapeSave({ strength: 14, dexterity: 14 }).ability).toBe('strength');
        expect(saveFails({ dc: 13, saveTotal: 12 })).toBe(true);
        expect(saveFails({ dc: 13, saveTotal: 13 })).toBe(false);
        expect(saveLine({ who: 'Ratero', label: 'Fuerza', natural: 9, modifier: 1, dc: 13 })).toMatch(/10 contra CD 13 · falla/);
    });

    test('agarrar pide una mano libre', () => {
        expect(freeHand({ weapon: { name: 'Espada larga', hands: 1 }, shield: null }).ok).toBe(true);
        expect(freeHand({ weapon: { name: 'Espadón', hands: 2 }, shield: null }).ok).toBe(false);
        expect(freeHand({ weapon: { name: 'Espada larga', hands: 1 }, shield: { name: 'Escudo' } }).reason).toMatch(/escudo/);
        expect(UNARMED_MODES.agarrar.label).toBe('Agarrar');
    });
});

describe('las acciones de 2024', () => {
    test('las siete y Preparar, en castellano, sin «ft»', () => {
        for (const id of ['correr', 'destrabarse', 'esquivar', 'ayudar', 'ocultarse', 'estudiar', 'utilizar', 'preparar']) {
            expect(ACTIONS_2024[id].label).toBeTruthy();
            expect(ACTIONS_2024[id].short).not.toMatch(/\bft\b/);
        }
        expect(HIDE_DC).toBe(15);
    });

    test('Ocultarse: con poca luz siempre; si no, hace falta algo que tape', () => {
        expect(canHide2024({ covered: { ok: false, reason: 'te ve' }, dim: true }).ok).toBe(true);
        expect(canHide2024({ covered: { ok: true, reason: '' }, dim: false }).ok).toBe(true);
        expect(canHide2024({ covered: { ok: false, reason: 'Ratero te ve de lleno' }, dim: false })).toEqual({ ok: false, reason: 'Ratero te ve de lleno' });
    });

    test('Estudiar: la CD sube con el desafío y lo averiguado no se repite', () => {
        expect(studyDC(0.125)).toBe(10);
        expect(studyDC(3)).toBe(13);
        expect(studyDC(30)).toBe(20);
        const facts = studyFacts({ weakness: 'El fuego lo hace dudar', profile: 'skirmisher', resistances: ['cold'], boss: true });
        expect(facts.map(f => f.key)).toEqual(['debil', 'resiste', 'perfil', 'jefe']);
        expect(facts[0].text).toBe('Su punto débil: El fuego lo hace dudar.');
        expect(facts[1].text).toMatch(/frío/);
        expect(newFacts(facts, ['debil'], 1).map(f => f.key)).toEqual(['resiste']);
        expect(studyFacts({}).map(f => f.key)).toEqual(['nada']);
        expect(studyFacts({ name: 'Lobo' }, { weakness: 'Le asusta el fuego.', quirk: 'Caza en manada.' }).map(f => f.key)).toEqual(['debil', 'manias']);
    });

    test('las pociones de curar, por nombre o por lo que dicen, juntas', () => {
        expect(healingPotionOf({ name: 'Poción de curación', subcategory: 'potion' })).toBe('2d4+2');
        expect(healingPotionOf({ name: 'Poción de curación mayor' })).toBe('4d4+4');
        expect(healingPotionOf({ name: 'Elixir raro', description: 'Recupera 3d4 + 3 puntos de vida.' })).toBe('3d4+3');
        expect(healingPotionOf({ name: 'Poción de aliento de fuego' })).toBe('');
        expect(healingPotionOf({ name: 'Espada' })).toBe('');
        const potions = potionsOf({ items: [
            { id: 'a', name: 'Poción de curación' }, { id: 'b', name: 'Poción de curación' }, { id: 'c', name: 'Pan' },
        ] });
        expect(potions).toEqual([{ itemId: 'a', name: 'Poción de curación', heal: '2d4+2', count: 2 }]);
    });

    test('tirarse es gratis; levantarse cuesta la mitad; arrastrarse, el doble', () => {
        expect(standCost(30)).toBe(15);
        expect(canStand({ left: 30, speed: 30 })).toEqual({ ok: true, reason: '', cost: 15 });
        expect(canStand({ left: 10, speed: 30 }).ok).toBe(false);
        expect(canStand({ left: 10, speed: 30 }).reason).toMatch(/15 pies/);
        expect(crawlCost(10, true)).toBe(20);
        expect(crawlCost(10, false)).toBe(10);
    });

    test('la otra mano: dos ligeras, sin escudo, y después de atacar con la primera', () => {
        const main = { id: 'm', name: 'Espada corta', type: 'weapon' };
        const daga = { id: 'd', name: 'Daga', type: 'weapon' };
        expect(offHandWeaponOf({ items: [main, daga], main, shield: null })).toBe(daga);
        expect(offHandWeaponOf({ items: [main, daga], main, shield: { name: 'Escudo' } })).toBe(null);
        expect(offHandWeaponOf({ items: [{ id: 'x', name: 'Espada larga', type: 'weapon' }, daga], main: { id: 'x', name: 'Espada larga', type: 'weapon' }, shield: null })).toBe(null);
        expect(judgeOffHand({ offHand: daga, attackedWith: '', used: false, hasBonus: true, nick: false }).ok).toBe(false);
        expect(judgeOffHand({ offHand: daga, attackedWith: 'm', used: false, hasBonus: true, nick: false })).toEqual({ ok: true, reason: '', free: false });
        expect(judgeOffHand({ offHand: daga, attackedWith: 'm', used: false, hasBonus: false, nick: true })).toEqual({ ok: true, reason: '', free: true });
        expect(judgeOffHand({ offHand: daga, attackedWith: 'm', used: false, hasBonus: false, nick: false }).ok).toBe(false);
    });
});
