/**
 * J12.18 (los objetivos dentro del menú, y quién se lleva el golpe: rojo y azul) y J12.19 (golpes y
 * caídas que se notan): lo puro de action-menus.js, aim-glow.js e impact.js.
 */

import { describe, test, expect } from '@jest/globals';
import {
    buildAttackMenu, abilityItem, buildActionsMenu, buildBonusMenu, caughtWords, choicesAim, joinNames, pickable, targetAim, unfolds,
} from '../public/scripts/game-engine/ui/combat-vtt/action-menus.js';
import { AIM_CLASSES, aimClassMap, areaBoxes } from '../public/scripts/game-engine/ui/combat-vtt/aim-glow.js';
import { IMPACT_KINDS, deathPips, downCaption, impactKind, isDownToken } from '../public/scripts/game-engine/ui/combat-vtt/impact.js';
import { ACTIONS_2024, HIDE_DC, studyDC } from '../public/scripts/game-engine/rules/actions-2024.js';

const rat = { id: 'e1', name: 'Ratero del muelle', hp: 3, maxHp: 7, ac: 12, distanceFeet: 5, chance: 65, edge: '', token: -1, side: 'enemy', cover: 0 };
const far = { id: 'e2', name: 'Tirador furtivo', hp: 9, maxHp: 9, ac: 13, distanceFeet: 40, token: -2, side: 'enemy', enabled: false, reason: 'Está a 40 pies; tu espada corta llega a 5.' };
const gerd = { id: '2', name: 'Gerd', hp: 3, maxHp: 20, distanceFeet: 5, token: 2, side: 'ally' };

/** @returns {any} */
function snapshot(over = {}) {
    return {
        active: true, isPlayerTurn: true, turnLabel: 'Turno de Nerea', actorName: 'Nerea',
        ready: { action: true, bonus: true, reaction: true },
        move: { left: 30, speed: 30 },
        posture: { prone: false, standCost: 15, canStand: true, standWhy: '' },
        canAuto: false, canParley: false, hasMastery: true,
        weapon: { id: 'w1', name: 'Espada corta', mastery: 'vex', masteryOn: true, damage: '1d6+3', damageType: 'cortante', reachFeet: 5, light: true, ranged: false, hands: 1, targets: [rat, far] },
        spareWeapons: [{ id: 'w2', name: 'Arco corto', mastery: 'vex', masteryOn: true, damage: '1d6+2', damageType: 'perforante', reachFeet: 80, light: false, ranged: true, hands: 2, targets: [rat, { ...far, enabled: true, reason: '', chance: 40 }] }],
        swap: { ok: true, reason: '' },
        enemies: [rat, { ...far, enabled: undefined, reason: undefined }],
        adjacentAllies: [gerd],
        dying: [],
        unarmed: { damage: 4, dc: 13, freeHand: { ok: true, reason: '' }, targets: [rat] },
        abilities: [],
        slots: [],
        magicItems: [],
        potions: [{ itemId: 'p1', name: 'Poción de curación', heal: '2d4+2', count: 1 }],
        offHand: { weapon: null, ok: false, reason: 'Primero ataca con un arma ligera.', free: false },
        throws: [],
        maneuvers: [],
        hide: { ok: false, reason: '' },
        studied: {},
        actor: { id: '1', token: 1 },
        ...over,
    };
}

describe('J12.18: los objetivos, en el menú', () => {
    test('el arma lleva debajo a quién llegas, con su vida en una barra, la probabilidad y su ficha encendida en rojo', () => {
        const menu = buildAttackMenu(snapshot());
        const items = menu.sections.flatMap(s => s.items);
        const row = items.find(i => i.key === 'attack:e1');
        expect(row?.enabled).toBe(true);
        expect(row?.meter).toEqual({ hp: 3, max: 7 });
        expect(row?.badges?.some(b => b.kind === 'chance' && b.text === '65 %')).toBe(true);
        expect(row?.desc).toMatch(/5 pies/);
        expect(row?.aim).toEqual({ marks: [{ id: 'e1', token: -1, tone: 'harm' }] });
        // El tarjetón del arma enciende solo a quien puede elegir.
        const weapon = items.find(i => i.kind === 'weapon');
        expect(weapon?.aim?.marks.map(m => m.id)).toEqual(['e1']);
    });

    test('quien está lejos sale también, apagado y diciendo por qué; no lleva número', () => {
        const menu = buildAttackMenu(snapshot());
        const items = menu.sections.flatMap(s => s.items);
        const row = items.find(i => i.key === 'attack:e2');
        expect(row?.enabled).toBe(false);
        expect(row?.reason).toMatch(/Está a 40 pies; tu espada corta llega a 5\./);
        expect(pickable(items).some(i => i.key === 'attack:e2')).toBe(false);
    });

    test('nadie a tu alcance: el arma se apaga con el más cercano dicho', () => {
        const menu = buildAttackMenu(snapshot({ weapon: { ...snapshot().weapon, targets: [far] } }));
        const weapon = menu.sections.flatMap(s => s.items).find(i => i.kind === 'weapon');
        expect(weapon?.enabled).toBe(false);
        expect(weapon?.reason).toMatch(/Nadie a tu alcance: el más cercano, Ratero del muelle, a 5 pies/);
    });

    test('otra arma: su lista de a quién se abre debajo (todo objetivos), y enciende a los que alcanza', () => {
        const menu = buildAttackMenu(snapshot());
        const spare = menu.sections.flatMap(s => s.items).find(i => i.key === 'swapattack:w2');
        expect(spare && unfolds(spare)).toBe(true);
        expect(spare?.aim?.marks.map(m => m.id)).toEqual(['e1', 'e2']);
        expect(spare?.next?.items.every(i => i.kind === 'target')).toBe(true);
        // «Empujar» pregunta antes cómo: no se abre debajo, va en su paso.
        const shove = menu.sections.flatMap(s => s.items).find(i => i.key === 'unarmed:empujar');
        expect(shove && unfolds(shove)).toBe(false);
    });

    test('un conjuro de salvación dice su CD y con qué salva; uno de ataque, la probabilidad', () => {
        const save = abilityItem({
            id: 'sacred-flame', name: 'Llama sagrada', desc: '', cost: 'action', target: 'enemy', rangeFeet: 60, spellLevel: 0, slotLevel: 0,
            damage: '1d8', damageType: 'radiant', healing: '', enabled: true, reason: '',
            targets: [{ ...rat, chance: undefined, dc: 13, save: 'Destreza', cover: 2, enabled: true, reason: '' }],
        }, snapshot());
        const row = save.next?.items[0];
        expect(row?.badges?.map(b => b.text)).toContain('CD 13 · Destreza');
        expect(row?.badges?.some(b => b.kind === 'chance')).toBe(false);
        // La cobertura cuenta contra un ataque, no contra una salvación.
        expect(row?.desc).not.toMatch(/cobertura/);

        const bolt = abilityItem({
            id: 'fire-bolt', name: 'Descarga de fuego', desc: '', cost: 'action', target: 'enemy', rangeFeet: 120, spellLevel: 0, slotLevel: 0,
            damage: '1d10', damageType: 'fire', healing: '', enabled: true, reason: '',
            targets: [{ ...far, enabled: false, reason: 'Fuera de alcance.' }, { ...rat, chance: 55, cover: 2, enabled: true, reason: '' }],
        }, snapshot());
        // Los que se pueden elegir, primero.
        expect(bolt.next?.items.map(i => i.key)).toEqual(['ability:fire-bolt:e1', 'ability:fire-bolt:e2']);
        expect(bolt.next?.items[0].badges?.map(b => b.text)).toContain('55 %');
        expect(bolt.next?.items[0].desc).toMatch(/tras cobertura \(\+2 CA\)/);
    });

    test('un área apuntada a alguien: a quién más pilla, sus casillas, y avisa si pilla a los tuyos', () => {
        const ball = abilityItem({
            id: 'fireball', name: 'Bola de fuego', desc: '', cost: 'action', target: 'enemy', rangeFeet: 150, spellLevel: 3, slotLevel: 3,
            damage: '8d6', damageType: 'fire', healing: '', enabled: true, reason: '', area: 'Esfera de 20 pies',
            targets: [{
                ...rat, enabled: true, reason: '', dc: 15, save: 'Destreza',
                caught: [{ id: 'e1', token: -1, name: 'Ratero del muelle', side: 'enemy' }, { id: '2', token: 2, name: 'Gerd', side: 'ally' }],
                cells: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
            }],
        }, snapshot());
        const row = ball.next?.items[0];
        expect(row?.caught).toBe('Pilla a Ratero del muelle y Gerd. Ojo: Gerd es de los tuyos.');
        expect(row?.aim).toEqual({
            marks: [{ id: 'e1', token: -1, tone: 'harm' }, { id: '2', token: 2, tone: 'harm' }],
            cells: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
            cellsTone: 'harm',
        });
    });

    test('lo que ayuda va en azul: una cura a uno de los tuyos, darle la poción, beberla tú', () => {
        const cure = abilityItem({
            id: 'cure', name: 'Curar heridas', desc: '', cost: 'action', target: 'ally', rangeFeet: 5, spellLevel: 1, slotLevel: 1,
            damage: '', damageType: '', healing: '1d8+3', enabled: true, reason: '', targets: [{ ...gerd, enabled: true, reason: '' }],
        }, snapshot());
        expect(cure.aim).toEqual({ marks: [{ id: '2', token: 2, tone: 'help' }] });
        expect(cure.next?.items[0].aim?.marks[0].tone).toBe('help');
        expect(cure.next?.items[0].icon).toBe('fa-user-shield');

        const acts = buildActionsMenu(snapshot(), ACTIONS_2024, { hideDc: HIDE_DC, studyDc: studyDC });
        // Darle la poción va dentro de «Utilizar».
        const all = (/** @type {any[]} */ list) => list.flatMap(i => [i, ...all(i.next?.items ?? [])]);
        const give = all(acts.sections.flatMap(s => s.items)).find(i => i.key === 'give:p1');
        expect(give?.aim?.marks).toEqual([{ id: '2', token: 2, tone: 'help' }]);

        const bonus = buildBonusMenu(snapshot());
        const drink = bonus.sections.flatMap(s => s.items).find(i => i.key === 'drink:p1');
        expect(drink?.aim).toEqual({ marks: [{ id: '1', token: 1, tone: 'help' }] });
    });

    test('las piezas: juntar nombres, a quién pilla, a quién se apunta', () => {
        expect(joinNames(['A'])).toBe('A');
        expect(joinNames(['A', 'B', 'C'])).toBe('A, B y C');
        expect(caughtWords({ id: 'x', name: 'x', distanceFeet: 0, caught: [] }, 'harm')).toBe('Ahí no pilla a nadie.');
        expect(caughtWords({ id: 'x', name: 'x', distanceFeet: 0, caught: [{ id: '2', name: 'Gerd', side: 'ally' }] }, 'help')).toBe('Alcanza a Gerd.');
        expect(targetAim(rat, 'harm')).toEqual({ marks: [{ id: 'e1', token: -1, tone: 'harm' }] });
        expect(choicesAim([far], 'harm')).toBeUndefined();
    });
});

describe('J12.18: lo que se enciende', () => {
    test('rojo y azul por ficha y por fila; si alguien es las dos cosas, gana el rojo', () => {
        const { tokens, rows } = aimClassMap({
            marks: [
                { id: 'e1', token: -1, tone: 'harm' },
                { id: '2', token: 2, tone: 'help' },
                { id: '2', token: 2, tone: 'harm' },
                { id: '3', token: 3, tone: 'help' },
            ],
        });
        expect(tokens.get('-1')).toBe(AIM_CLASSES.harm);
        expect(tokens.get('2')).toBe(AIM_CLASSES.harm);
        expect(tokens.get('3')).toBe(AIM_CLASSES.help);
        expect(rows.get('e1')).toBe(AIM_CLASSES.harm);
        expect(aimClassMap(null).tokens.size).toBe(0);
    });

    test('las casillas de un área, con su borde solo por fuera', () => {
        const boxes = areaBoxes([{ x: 1, y: 1 }, { x: 2, y: 1 }], 40, 40);
        expect(boxes).toEqual([
            { left: 40, top: 40, width: 40, height: 40, edge: 'nsw' },
            { left: 80, top: 40, width: 40, height: 40, edge: 'nes' },
        ]);
    });
});

describe('J12.19: cómo se ve el golpe y quien cae', () => {
    test('el tipo de daño (o el arma, o cómo sale) decide el dibujo', () => {
        expect(impactKind('cortante Espada corta')).toBe('cut');
        expect(impactKind('perforante Daga')).toBe('pierce');
        expect(impactKind('fire Descarga de fuego')).toBe('fire');
        expect(impactKind('Rayo de escarcha')).toBe('cold');
        expect(impactKind('Hacha')).toBe('cut');
        expect(impactKind('', { style: 'ranged' })).toBe('pierce');
        expect(impactKind('', { style: 'spell' })).toBe('force');
        expect(impactKind('')).toBe('cut');
        expect(IMPACT_KINDS).toContain('heal');
    });

    test('lo que se dice de quien cae, y sus salvaciones', () => {
        expect(downCaption({ name: 'Ratero del muelle', side: 'enemy' })).toBe('Cae Ratero del muelle');
        expect(downCaption({ name: 'Nerea', side: 'party' })).toBe('Nerea cae inconsciente');
        expect(downCaption({ name: 'Nerea', side: 'party', dead: true })).toBe('Nerea ha muerto');
        const pips = deathPips({ successes: 1, failures: 2 });
        expect(pips.successes).toEqual([true, false, false]);
        expect(pips.failures).toEqual([true, true, false]);
    });

    test('caído en el tablero: en pelea, a 0 con vida máxima; quien espera y la gente del lugar, nunca', () => {
        expect(isDownToken({ hp: 0, maxHp: 7 }, true)).toBe(true);
        expect(isDownToken({ hp: 3, maxHp: 7 }, true)).toBe(false);
        expect(isDownToken({ hp: 0, maxHp: 7 }, false)).toBe(false);
        expect(isDownToken({ hp: 0, maxHp: 7, idle: true }, true)).toBe(false);
        expect(isDownToken({ hp: 0, maxHp: 0, isNPC: true }, true)).toBe(false);
    });
});
