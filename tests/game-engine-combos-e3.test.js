/**
 * E3 de wiki/ROADMAP_ENTRETENIDO.md: que las reglas encadenen solas (E3.1) y que el vínculo se
 * note en la pelea (E3.4).
 */
import { describe, test, expect } from '@jest/globals';
import {
    isRogue, sneakDiceCount, isSneakWeapon, planSneakAttack, sneakLine, sneakBadge, sneakKey,
} from '../public/scripts/game-engine/rules/sneak-attack.js';
import { attackEdge, recordManeuver, startTurn } from '../public/scripts/game-engine/combat/maneuvers.js';
import {
    noteSneak, sneakSpent, noteBondMove, bondMoveUsed, readTactics, noteVex, hasVex, combineEdge, toppled, markTurn,
} from '../public/scripts/game-engine/rules/weapon-mastery.js';
import {
    PAIR_MOVE_RANK, pairMoveOf, ultimateOf, personalWeaponOf, perkLine, perkBanner, pairMoveOptions, relayOrder, stillToAct,
    bondSheetRows, bondSheetLine, PAIR_STYLES,
} from '../public/scripts/game-engine/combat/bond-moves.js';
import { planBatonPass, planUltimate, buildPersonalWeapon } from '../public/scripts/game-engine/combat/bond-perks.js';
import { BOND_PERKS, createBondState, getRank, recordBondEvent } from '../public/scripts/game-engine/campaign/bonds.js';
import { planAllyTurn } from '../public/scripts/game-engine/combat/ally-ai.js';

const dagger = { name: 'Daga', damageDice: '1d4' };
const bow = { name: 'Arco corto', category: 'distancia', rangeFeet: 80 };
const mace = { name: 'Maza', damageDice: '1d6' };
const rogue = { name: 'Iria', class: 'Pícara', level: 3 };

/** @param {string} id @param {number} rank */
function bondsAt(id, rank) {
    let state = createBondState();
    for (let i = 0; i < 80 && getRank(state, id) < rank; i++) state = recordBondEvent(state, id, 'saved_their_life').state;
    return state;
}

describe('E3.1 · el furtivo del pícaro (2024)', () => {
    test('quién es pícaro, y cuántos dados mete por nivel', () => {
        expect(isRogue(rogue)).toBe(true);
        expect(isRogue({ class: 'Rogue' })).toBe(true);
        expect(isRogue({ class: 'Guerrero' })).toBe(false);
        expect([1, 2, 3, 5, 11, 19, 20].map(sneakDiceCount)).toEqual([1, 1, 2, 3, 6, 10, 10]);
    });

    test('solo con un arma sutil o a distancia', () => {
        expect(isSneakWeapon(dagger)).toBe(true);
        expect(isSneakWeapon(bow)).toBe(true);
        expect(isSneakWeapon({ name: 'Estoque' })).toBe(true);
        expect(isSneakWeapon({ name: 'Espada', tags: ['sutil'] })).toBe(true);
        expect(isSneakWeapon(mace)).toBe(false);
        expect(isSneakWeapon(null)).toBe(false);
    });

    test('con ventaja, mete el furtivo y dice por qué (la primera razón de la ventaja)', () => {
        const plan = planSneakAttack({ member: rogue, weapon: dagger, mode: 'advantage', reasons: ['está en el suelo'] });
        expect(plan).toMatchObject({ ok: true, dice: '2d6', why: 'está en el suelo' });
        expect(sneakLine({ dice: plan.dice, total: 7, why: plan.why })).toBe('🗡️ Furtivo: +2d6 (7), está en el suelo.');
        expect(sneakBadge(plan)).toBe('Furtivo +2d6');
    });

    test('sin ventaja, con un aliado pegado al objetivo que puede actuar', () => {
        const allies = [{ name: 'Gerd', hp: 10, conditions: [] }];
        expect(planSneakAttack({ member: rogue, weapon: dagger, mode: 'normal', alliesBeside: allies }))
            .toMatchObject({ ok: true, why: 'Gerd está a su lado' });
        // Un aliado inconsciente no distrae a nadie.
        expect(planSneakAttack({ member: rogue, weapon: dagger, mode: 'normal', alliesBeside: [{ name: 'Gerd', hp: 0 }] }).ok).toBe(false);
        expect(planSneakAttack({ member: rogue, weapon: dagger, mode: 'normal', alliesBeside: [{ name: 'Gerd', hp: 5, conditions: ['Stunned'] }] }).ok).toBe(false);
    });

    test('con desventaja no hay furtivo, aunque haya un aliado al lado', () => {
        const plan = planSneakAttack({ member: rogue, weapon: dagger, mode: 'disadvantage', alliesBeside: [{ name: 'Gerd', hp: 10 }] });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toMatch(/desventaja/);
    });

    test('una vez por turno; en el turno de otro, otra vez', () => {
        expect(planSneakAttack({ member: rogue, weapon: dagger, mode: 'advantage', used: true }).ok).toBe(false);
        let tactics = noteSneak(null, sneakKey('iria', 'iria', 2));
        expect(sneakSpent(tactics, sneakKey('iria', 'iria', 2))).toBe(true);
        expect(sneakSpent(tactics, sneakKey('iria', 'heroe', 2))).toBe(false);
        expect(sneakSpent(tactics, sneakKey('iria', 'iria', 3))).toBe(false);
        // Lo demás del turno (Molestar, las armas ligeras) sigue ahí.
        tactics = markTurn(tactics, 'iria', 2, { lightWeapon: 'd1' });
        expect(readTactics(tactics).sneak).toEqual(['iria@iria@2']);
    });

    test('ni un guerrero ni un pícaro con maza', () => {
        expect(planSneakAttack({ member: { class: 'Guerrero', level: 5 }, weapon: dagger, mode: 'advantage' }).ok).toBe(false);
        expect(planSneakAttack({ member: rogue, weapon: mace, mode: 'advantage' }).ok).toBe(false);
    });
});

describe('E3.1 · las reglas que encadenan', () => {
    const base = { targetId: 'g', distanceFeet: 5, byParty: true };

    test('derribado: de cerca con ventaja, de lejos con desventaja', () => {
        expect(attackEdge({ ...base, targetConditions: ['Prone'] })).toMatchObject({ mode: 'advantage', reasons: ['está en el suelo'] });
        expect(attackEdge({ ...base, distanceFeet: 30, targetConditions: ['Prone'] }).mode).toBe('disadvantage');
    });

    test('Derribar (la maestría) tumba si falla la salvación, y eso da ventaja al siguiente', () => {
        expect(toppled({ dc: 13, saveTotal: 12 })).toBe(true);
        expect(toppled({ dc: 13, saveTotal: 13 })).toBe(false);
    });

    test('Molestar da ventaja al siguiente golpe de quien molestó', () => {
        const tactics = noteVex(null, { by: '1', target: 'g', round: 2 });
        expect(hasVex(tactics, { by: '1', target: 'g', round: 3 })).toBe(true);
        expect(combineEdge(attackEdge(base), ['le tienes molestado']).mode).toBe('advantage');
    });

    test('Ayudar abre la guardia para el siguiente de los tuyos, y no para un enemigo', () => {
        const helped = recordManeuver(null, 'ayudar', '1', 'g');
        expect(attackEdge({ ...base, maneuvers: helped })).toMatchObject({ mode: 'advantage', usesHelp: true });
        expect(attackEdge({ ...base, maneuvers: helped, byParty: false }).mode).toBe('normal');
    });

    test('el flanqueo (regla opcional de la guía del máster) da ventaja de cerca', () => {
        expect(attackEdge({ ...base, flanked: true })).toMatchObject({ mode: 'advantage', reasons: ['lo tenéis flanqueado'] });
        expect(attackEdge({ ...base, distanceFeet: 30, flanked: true }).mode).toBe('normal');
    });

    test('agarrado (2024): pega con desventaja a quien no le agarra; a quien le agarra, normal', () => {
        expect(attackEdge({ ...base, attackerConditions: ['Grappled'], grappledBy: 'otro' }))
            .toMatchObject({ mode: 'disadvantage', reasons: ['le tienen agarrado'] });
        expect(attackEdge({ ...base, attackerConditions: ['Grappled'], grappledBy: 'g' }).mode).toBe('normal');
        // A quien está agarrado no se le pega con ventaja por eso (5e).
        expect(attackEdge({ ...base, targetConditions: ['Grappled'] }).mode).toBe('normal');
    });

    test('derribado y furtivo: el pícaro que llega tras el guerrero mete su furtivo', () => {
        const edge = attackEdge({ ...base, targetConditions: ['Prone'] });
        expect(planSneakAttack({ member: rogue, weapon: dagger, mode: edge.mode, reasons: edge.reasons }))
            .toMatchObject({ ok: true, why: 'está en el suelo' });
    });

    test('la guardia de un compañero: le pegan con desventaja hasta su próximo turno', () => {
        let state = recordManeuver(null, 'cubrir', 'osric', 'heroe');
        expect(attackEdge({ targetId: 'heroe', distanceFeet: 5, maneuvers: state })).toMatchObject({ mode: 'disadvantage', reasons: ['un compañero le cubre'] });
        state = startTurn(state, 'heroe');
        expect(attackEdge({ targetId: 'heroe', distanceFeet: 5, maneuvers: state }).mode).toBe('normal');
    });
});

describe('E3.1 · el compañero que va solo busca la ventaja', () => {
    const terrain = {};
    test('a mi lado: entre dos a su alcance, va a por el que está en el suelo', () => {
        const plan = planAllyTurn({
            actor: { id: 'a', gridX: 2, gridY: 2, currentHp: 10, maxHp: 10, speedFeet: 0, attackRangeFeet: 5 },
            leader: { gridX: 2, gridY: 3 },
            enemies: [
                { id: 'g1', gridX: 3, gridY: 2, currentHp: 3, maxHp: 10 },
                { id: 'g2', gridX: 1, gridY: 2, currentHp: 9, maxHp: 10, prone: true },
            ],
            stance: 'cerca', terrain, gridWidth: 8, gridHeight: 8,
        });
        expect(plan).toMatchObject({ action: 'attack', targetId: 'g2' });
    });

    test('un pícaro prefiere a quien tiene un aliado al lado (su furtivo)', () => {
        const plan = planAllyTurn({
            actor: { id: 'a', gridX: 2, gridY: 2, currentHp: 10, maxHp: 10, speedFeet: 0, attackRangeFeet: 5, sneak: true },
            leader: { gridX: 2, gridY: 3 },
            enemies: [
                { id: 'g1', gridX: 3, gridY: 2, currentHp: 3, maxHp: 10 },
                { id: 'g2', gridX: 1, gridY: 2, currentHp: 9, maxHp: 10 },
            ],
            allies: [{ id: 'b', gridX: 0, gridY: 2 }],
            stance: 'cerca', terrain, gridWidth: 8, gridHeight: 8,
        });
        expect(plan).toMatchObject({ action: 'attack', targetId: 'g2' });
    });

    test('sin nada de eso, la preferencia de siempre (el más débil)', () => {
        const plan = planAllyTurn({
            actor: { id: 'a', gridX: 2, gridY: 2, currentHp: 10, maxHp: 10, speedFeet: 0, attackRangeFeet: 5 },
            leader: { gridX: 2, gridY: 3 },
            enemies: [
                { id: 'g1', gridX: 3, gridY: 2, currentHp: 3, maxHp: 10 },
                { id: 'g2', gridX: 1, gridY: 2, currentHp: 9, maxHp: 10 },
            ],
            stance: 'cerca', terrain, gridWidth: 8, gridHeight: 8,
        });
        expect(plan).toMatchObject({ action: 'attack', targetId: 'g1' });
    });
});

describe('E3.4 · el vínculo, a la vista', () => {
    const gerd = { name: 'Gerd el Mellado', class: 'guerrero' };
    const nella = { name: 'Nella Tresflechas', class: 'explorador' };
    const osric = { name: 'Osric Mediapaga', class: 'guerrero' };

    test('el rango 7 ya no está vacío: es una ventaja de las de siempre', () => {
        expect(BOND_PERKS.map(p => p.rank)).toEqual([3, 5, 7, 8, 10]);
        expect(PAIR_MOVE_RANK).toBe(7);
    });

    test('cada uno del gremio tiene su jugada con nombre, y su golpe definitivo', () => {
        expect(pairMoveOf(gerd)).toMatchObject({ name: 'Yunque y martillo', style: 'derribo' });
        expect(pairMoveOf(nella)).toMatchObject({ name: 'Flecha y filo', style: 'tiro' });
        expect(pairMoveOf(osric)).toMatchObject({ name: 'Escudo y espada', style: 'guardia' });
        expect(pairMoveOf({ name: 'Gerd' }).name).toBe('Yunque y martillo');
        for (const m of [gerd, nella, osric]) {
            expect(ultimateOf(m).name).not.toBe('Golpe definitivo');
            expect(ultimateOf(m).say.length).toBeGreaterThan(5);
        }
    });

    test('quien no tiene nada escrito, lo de su oficio', () => {
        expect(pairMoveOf({ name: 'Ismark', class: 'Guerrero' })).toMatchObject({ style: 'derribo', name: 'Al suelo con él' });
        expect(pairMoveOf({ name: 'Ezmerelda', class: 'Explorador' }).style).toBe('tiro');
        expect(pairMoveOf({ name: 'Van Richten', class: 'Clérigo' }).style).toBe('guardia');
        const archer = { name: 'Bran', class: 'Guerrero', items: [{ id: 'b', name: 'Arco largo', category: 'distancia' }], equippedItems: { weapon: 'b' } };
        expect(pairMoveOf(archer).style).toBe('tiro');
        expect(ultimateOf({ name: 'Ismark' }).name).toBe('Golpe definitivo');
    });

    test('las armas personales: el arco de Nella es un arco', () => {
        expect(buildPersonalWeapon(nella)).toMatchObject({ name: 'Arco de Nella', category: 'distancia', rangeFeet: 150 });
        expect(buildPersonalWeapon(gerd).name).toBe('Martillo de Gerd');
        expect(buildPersonalWeapon({ name: 'Ismark' }).name).toBe('Arma personal de Ismark');
        expect(personalWeaponOf({ name: 'Ismark' })).toBeNull();
    });

    test('cada ventaja tiene su frase, dicha por él, y su rótulo', () => {
        for (const perk of /** @type {const} */ (['follow_up', 'pair', 'baton_pass', 'endure', 'pair_move', 'ultimate'])) {
            expect(perkLine(gerd, perk, () => 0).length).toBeGreaterThan(3);
            expect(perkBanner(gerd, perk)).toMatch(/^Vínculo \d+ · /);
        }
        expect(perkBanner(gerd, 'pair_move')).toBe('Vínculo 7 · Yunque y martillo');
        expect(perkLine(gerd, 'pair_move')).toBe('¡Lo tengo en el suelo! ¡Dale ahora!');
    });

    test('el golpe definitivo dice su nombre', () => {
        const bonds = bondsAt('2', 10);
        const party = [{ id: 1, name: 'Iria', hp: 10 }, { id: 2, name: 'Gerd el Mellado', hp: 10, level: 3 }];
        expect(planUltimate({ bonds, party, actorId: '2', targetId: 'g' })?.reason).toMatch(/«La carga del Mellado»/);
    });

    test('la jugada del rango 7: con quién, contra quién y de cerca o de lejos', () => {
        const hero = { id: 'h', name: 'Iria', x: 2, y: 2, hp: 10, rank: 1, reachFeet: 5 };
        const gerdF = { id: 'g', name: 'Gerd', x: 3, y: 3, hp: 10, rank: 7, reachFeet: 5, style: /** @type {const} */ ('derribo') };
        const nellaF = { id: 'n', name: 'Nella', x: 8, y: 2, hp: 10, rank: 7, reachFeet: 80, style: /** @type {const} */ ('tiro') };
        const low = { id: 'o', name: 'Osric', x: 3, y: 1, hp: 10, rank: 6, reachFeet: 5, style: /** @type {const} */ ('guardia') };
        const enemies = [{ id: 'e', name: 'Orco', x: 3, y: 2, hp: 15 }];
        const options = pairMoveOptions({ actor: hero, heroId: 'h', party: [hero, gerdF, nellaF, low], enemies });
        expect(options.map(o => o.companionId).sort()).toEqual(['g', 'n']);
        // Una por combate, y con su reacción libre.
        expect(pairMoveOptions({ actor: hero, heroId: 'h', party: [hero, { ...gerdF, moveUsed: true }], enemies })).toEqual([]);
        expect(pairMoveOptions({ actor: hero, heroId: 'h', party: [hero, { ...gerdF, reactionUsed: true }], enemies })).toEqual([]);
        // En su turno, Gerd la hace con el héroe.
        expect(pairMoveOptions({ actor: gerdF, heroId: 'h', party: [hero, gerdF], enemies })).toEqual([
            { partnerId: 'h', partnerName: 'Iria', companionId: 'g', enemyId: 'e', enemyName: 'Orco' },
        ]);
        expect(Object.keys(PAIR_STYLES)).toEqual(['derribo', 'tiro', 'guardia']);
    });

    test('el Relevo: quien lo recibe juega justo después, y nadie juega dos veces', () => {
        const order = [{ id: 'h' }, { id: 'e1', isEnemy: true }, { id: 'g' }, { id: 'e2', isEnemy: true }, { id: 'n' }];
        expect(relayOrder(order, 2, 'n')?.map(e => e.id)).toEqual(['h', 'e1', 'g', 'n', 'e2']);
        expect(relayOrder(order, 2, 'h')).toBeNull();
        expect(stillToAct(order, 2)).toEqual(['n']);
        const bonds = bondsAt('g', 5);
        const party = [{ id: 'h', name: 'Iria', hp: 9 }, { id: 'g', name: 'Gerd', hp: 9 }, { id: 'n', name: 'Nella', hp: 9 }];
        expect(planBatonPass({ bonds, party, actorId: 'g', remainingFeet: 10, waiting: ['n'] })).toEqual([{ id: 'n', name: 'Nella' }]);
    });

    test('la ficha dice lo abierto y lo siguiente', () => {
        const rows = bondSheetRows({ name: 'Gerd el Mellado' }, 5);
        expect(rows.filter(r => r.unlocked).map(r => r.label)).toEqual(['Ataque de seguimiento', 'A una', 'Relevo', 'Lo muevo yo']);
        const next = rows.filter(r => r.next);
        expect(next.map(bondSheetLine)).toEqual(['Con vínculo 7: Yunque y martillo (lo siguiente)']);
        expect(bondSheetLine(rows[2])).toBe('Con vínculo 5: Relevo');
        expect(bondSheetRows({ name: 'Gerd' }, 10).every(r => r.unlocked && !r.next)).toBe(true);
    });

    test('la jugada se apunta una vez por combate', () => {
        const tactics = noteBondMove(null, 'g');
        expect(bondMoveUsed(tactics, 'g')).toBe(true);
        expect(bondMoveUsed(tactics, 'n')).toBe(false);
    });
});
