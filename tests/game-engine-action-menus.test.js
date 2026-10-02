/**
 * Tanda 10: la barra de acciones de D&D 2024 y sus menús, como datos (ui/combat-vtt/action-menus.js).
 */

import { describe, test, expect } from '@jest/globals';
import {
    MENUS, buildBar, buildAttackMenu, buildMagicMenu, buildActionsMenu, buildBonusMenu, pickable, reachWords, targetDetail,
    damageWord,
} from '../public/scripts/game-engine/ui/combat-vtt/action-menus.js';
import { ACTIONS_2024, HIDE_DC, studyDC } from '../public/scripts/game-engine/rules/actions-2024.js';

const rat = { id: 'e1', name: 'Ratero del muelle', hp: 5, maxHp: 5, ac: 11, distanceFeet: 5, chance: 65, edge: '', cr: 0.125 };
const archer = { id: 'e2', name: 'Tirador furtivo', hp: 9, maxHp: 9, ac: 13, distanceFeet: 90, cr: 0.5 };

/** @returns {any} */
function snapshot(over = {}) {
    return {
        active: true, isPlayerTurn: true, turnLabel: 'Turno de Daeriel', actorName: 'Daeriel',
        ready: { action: true, bonus: true, reaction: true },
        move: { left: 15, speed: 30 },
        posture: { prone: false, standCost: 15, canStand: true, standWhy: '' },
        canAuto: false, canParley: true, hasMastery: true,
        weapon: { id: 'w1', name: 'Espada corta', mastery: 'vex', masteryOn: true, damage: '1d6+3', damageType: 'perforante', reachFeet: 5, light: true, ranged: false, hands: 1, targets: [rat] },
        spareWeapons: [{ id: 'w2', name: 'Arco largo', mastery: 'slow', masteryOn: true, damage: '1d8+2', damageType: 'perforante', reachFeet: 150, light: false, ranged: true, hands: 2, targets: [rat, archer] }],
        swap: { ok: true, reason: '' },
        enemies: [rat, archer],
        adjacentAllies: [{ id: '2', name: 'Gerd', hp: 3, maxHp: 20, distanceFeet: 5 }],
        unarmed: { damage: 4, dc: 13, freeHand: { ok: true, reason: '' }, targets: [rat] },
        abilities: [
            { id: 'fire-bolt', name: 'Descarga de fuego', desc: 'Rayo de fuego.', cost: 'action', target: 'enemy', rangeFeet: 120, spellLevel: 0, slotLevel: 0, damage: '1d10', damageType: 'fire', healing: '', enabled: true, reason: '', targets: [{ ...rat, enabled: true, reason: '' }, { ...archer, enabled: true, reason: '' }] },
            { id: 'mage-armor', name: 'Armadura de mago', desc: 'CA 13 + Destreza.', cost: 'action', target: 'self', rangeFeet: 0, spellLevel: 1, slotLevel: 1, damage: '', damageType: '', healing: '', enabled: true, reason: '', targets: [] },
            { id: 'misty-step', name: 'Paso brumoso', desc: 'Te teletransportas.', cost: 'bonus', target: 'self', rangeFeet: 0, spellLevel: 2, slotLevel: 2, enabled: false, reason: 'Sin espacios de nivel 2.', targets: [] },
            { id: 'hab-embate', name: 'Embate', desc: 'Un golpe con todo.', cost: 'action', target: 'enemy', rangeFeet: 5, spellLevel: null, enabled: true, reason: '', uses: 'Quedan 1', targets: [{ ...rat, enabled: true, reason: '' }] },
            { id: 'hab-segundo-aliento', name: 'Segundo aliento', desc: 'Te curas.', cost: 'bonus', target: 'self', rangeFeet: 0, spellLevel: null, healing: '1d10+1', enabled: true, reason: '', targets: [] },
            { id: 'hab-gritar', name: 'Dar la voz', desc: 'Avisas.', cost: 'free', target: 'ally', rangeFeet: 30, spellLevel: null, enabled: true, reason: '', targets: [{ id: '2', name: 'Gerd', distanceFeet: 5, enabled: true, reason: '' }] },
        ],
        slots: [{ level: 1, left: 2, max: 3 }, { level: 2, left: 0, max: 2 }],
        magicItems: [{ id: 'leer:p1', label: 'Leer Pergamino de escudo', icon: 'fa-scroll', detail: 'Escudo.', enabled: true, needsTarget: false, targets: [] }],
        potions: [{ itemId: 'p1', name: 'Poción de curación', heal: '2d4+2', count: 2 }],
        offHand: { weapon: null, ok: false, reason: 'Hace falta un arma ligera en cada mano (y sin escudo).', free: false },
        throws: [{ id: 'lanzar:aceite', label: 'Aceite (1)', icon: 'fa-fire', detail: 'Arde.', enabled: true, needsTarget: true, targets: [{ id: 'e1', name: 'Ratero del muelle' }] }],
        maneuvers: [
            { id: 'esquivar', label: 'Esquivar', icon: 'fa-shield', detail: 'x', enabled: true, needsTarget: false, targets: [] },
            { id: 'destrabarse', label: 'Destrabarse', icon: 'fa-person-running', detail: 'x', enabled: true, needsTarget: false, targets: [] },
            { id: 'ayudar', label: 'Ayudar', icon: 'fa-handshake-angle', detail: 'x', enabled: true, needsTarget: true, targets: [{ id: 'e1', name: 'Ratero del muelle' }] },
            { id: 'preparar', label: 'Preparar golpe', icon: 'fa-hourglass-half', detail: 'x', enabled: true, needsTarget: false, targets: [] },
        ],
        hide: { ok: false, reason: 'Ratero del muelle te ve de lleno.' },
        studied: { e1: 1 },
        ...over,
    };
}

const numbers = { hideDc: HIDE_DC, studyDc: studyDC };
/** Todas las opciones de un menú, en orden. */
const items = (/** @type {any} */ menu) => menu.sections.flatMap((/** @type {any} */ s) => s.items);

describe('la barra', () => {
    test('los seis botones, las tres píldoras, los pies y «Cuerpo a tierra»', () => {
        const bar = buildBar(snapshot());
        expect(bar.buttons.map(b => b.label)).toEqual(['Atacar', 'Magia', 'Acciones', 'Adicional', 'Fin de turno', 'Abandonar']);
        expect(bar.pills.map(p => [p.label, p.ready])).toEqual([['Acción', true], ['Adicional', true], ['Reacción', true]]);
        expect(bar.move).toBe('15/30 pies');
        expect(bar.prone).toMatchObject({ on: false, label: 'Cuerpo a tierra', pick: 'prone', enabled: true });
        expect(bar.buttons.filter(b => b.key).map(b => b.key)).toEqual(['1', '2', '3', '4']);
        expect(MENUS.map(m => m.id)).toEqual(['atacar', 'magia', 'acciones', 'adicional']);
    });

    test('en el suelo, «Levantarse», con lo que cuesta; sin pies, apagado y diciendo por qué', () => {
        const down = buildBar(snapshot({ posture: { prone: true, standCost: 15, canStand: true, standWhy: '' } }));
        expect(down.prone).toMatchObject({ on: true, label: 'Levantarse', pick: 'stand', enabled: true });
        expect(down.prone.title).toMatch(/15 pies/);
        const stuck = buildBar(snapshot({ posture: { prone: true, standCost: 15, canStand: false, standWhy: 'Levantarse cuesta 15 pies y te quedan 5.' } }));
        expect(stuck.prone.enabled).toBe(false);
        expect(stuck.prone.title).toMatch(/te quedan 5/);
    });

    test('lo gastado sale gastado; sin magia, «Magia» apagada; no siendo tu turno, todo apagado salvo Abandonar', () => {
        const spent = buildBar(snapshot({ ready: { action: false, bonus: true, reaction: false } }));
        expect(spent.pills.map(p => p.ready)).toEqual([false, true, false]);
        // Sin la acción, Atacar se apaga diciendo por qué; lo demás sigue (hay conjuros de adicional).
        expect(spent.buttons.filter(b => !b.enabled).map(b => b.id)).toEqual(['atacar']);
        expect(spent.buttons.find(b => b.id === 'atacar')?.title).toBe('Ya has gastado la acción de este turno');
        const noMagic = buildBar(snapshot({ abilities: [], magicItems: [] }));
        expect(noMagic.buttons.find(b => b.id === 'magia')?.enabled).toBe(false);
        const light = buildBar(snapshot({ abilities: [], magicItems: [], magicCount: 3 }));
        expect(light.buttons.find(b => b.id === 'magia')?.enabled).toBe(true);
        const theirs = buildBar(snapshot({ isPlayerTurn: false, turnLabel: 'Turno de Ratero' }));
        expect(theirs.buttons.filter(b => b.enabled).map(b => b.id)).toEqual(['flee']);
        expect(theirs.move).toBe('');
    });
});

describe('Atacar', () => {
    test('tu arma con su maestría, y debajo a quién llegas, con lo que tienes de acertar', () => {
        const menu = buildAttackMenu(snapshot());
        const all = items(menu);
        const weapon = all.find(i => i.kind === 'weapon');
        expect(weapon?.name).toBe('Espada corta');
        expect(weapon?.tags?.map(t => t.text)).toEqual(['Molestar']);
        expect(weapon?.desc).toMatch(/ventaja/);
        expect(weapon?.badges?.map(b => b.text)).toEqual(['1d6+3 perforante', '5 pies · ligera', 'Acción']);
        const row = all.find(i => i.kind === 'target' && i.pick === 'attack:e1');
        expect(row?.badges?.[0]?.text).toBe('65 %');
        expect(row?.desc).toBe('5 pies · PG 5/5 · CA 11');
    });

    test('el golpe sin armas, agarrar y empujar con su CD; empujar pregunta cómo', () => {
        const all = items(buildAttackMenu(snapshot()));
        const golpe = all.find(i => i.key === 'unarmed:golpe');
        expect(golpe?.badges?.[0]?.text).toBe('4 contundente');
        expect(golpe?.next?.items.map(i => i.pick)).toEqual(['unarmed:golpe:e1']);
        expect(all.find(i => i.key === 'unarmed:agarrar')?.tags?.[0]).toEqual({ text: 'CD 13', kind: 'dc' });
        const shove = all.find(i => i.key === 'unarmed:empujar');
        expect(shove?.next?.items.map(i => i.key)).toEqual(['unarmed:apartar', 'unarmed:tirar']);
        expect(shove?.next?.items[1].next?.items[0].pick).toBe('unarmed:tirar:e1');
    });

    test('sin nadie pegado, sin armas se apaga; sin mano libre, agarrar dice por qué', () => {
        const far = items(buildAttackMenu(snapshot({ unarmed: { damage: 4, dc: 13, freeHand: { ok: false, reason: 'Llevas arma y escudo.' }, targets: [] } })));
        expect(far.find(i => i.key === 'unarmed:golpe')?.enabled).toBe(false);
        expect(far.find(i => i.key === 'unarmed:golpe')?.reason).toMatch(/pegado/);
        const shield = items(buildAttackMenu(snapshot({ unarmed: { damage: 4, dc: 13, freeHand: { ok: false, reason: 'Llevas arma y escudo.' }, targets: [rat] } })));
        expect(shield.find(i => i.key === 'unarmed:agarrar')?.reason).toBe('Llevas arma y escudo.');
    });

    test('las otras armas: cambiar y atacar; y «Cambiar de arma · gratis», una vez', () => {
        const menu = buildAttackMenu(snapshot());
        const spare = items(menu).find(i => i.key === 'swapattack:w2');
        expect(spare?.next?.items.map(i => i.pick)).toEqual(['swapattack:w2:e1', 'swapattack:w2:e2']);
        expect(spare?.tags?.[0].text).toBe('Ralentizar');
        expect(menu.headAction?.label).toMatch(/Cambiar de arma/);
        expect(menu.headAction?.next.items[0].pick).toBe('swap:w2');
        const used = buildAttackMenu(snapshot({ swap: { ok: false, reason: 'Ya has cambiado de arma este turno.' } }));
        expect(used.headAction?.enabled).toBe(false);
        expect(items(used).find(i => i.key === 'swapattack:w2')?.enabled).toBe(false);
    });

    test('sin acción, todo dice por qué; sin maestría, el arma no la enseña', () => {
        const spent = items(buildAttackMenu(snapshot({ ready: { action: false, bonus: true, reaction: true } })));
        expect(spent.find(i => i.pick === 'attack:e1')?.enabled).toBe(false);
        expect(spent.find(i => i.pick === 'attack:e1')?.reason).toMatch(/acción/);
        const mage = items(buildAttackMenu(snapshot({ weapon: { ...snapshot().weapon, masteryOn: false } })));
        expect(mage.find(i => i.kind === 'weapon')?.tags).toEqual([]);
    });

    test('las técnicas de clase contra un enemigo van en Atacar', () => {
        const menu = buildAttackMenu(snapshot());
        const own = menu.sections.find(s => s.title === 'De tu clase');
        expect(own?.items.map(i => i.name)).toEqual(['Embate']);
        expect(own?.items[0].badges?.map(b => b.text)).toContain('Quedan 1');
    });
});

describe('Magia', () => {
    test('las gemas de lo que queda, los filtros y los conjuros', () => {
        const menu = buildMagicMenu(snapshot());
        expect(menu.gems).toEqual([{ level: 1, left: 2, max: 3 }, { level: 2, left: 0, max: 2 }]);
        expect(menu.filters?.map(f => f.label)).toEqual(['Todos', 'Trucos', 'Nivel 1', 'Nivel 2', 'Objetos']);
        expect(items(menu).map(i => i.name)).toEqual(['Descarga de fuego', 'Armadura de mago', 'Paso brumoso', 'Leer Pergamino de escudo']);
        const bolt = items(menu)[0];
        expect(bolt.badges?.map(b => b.text)).toEqual(['1d10 fuego', '120 pies', 'Truco']);
        expect(bolt.tone).toBe('fire');
        expect(items(menu)[1].pick).toBe('ability:mage-armor');
        expect(items(menu)[2].reason).toMatch(/nivel 2/);
    });

    test('cada filtro deja lo suyo', () => {
        expect(items(buildMagicMenu(snapshot(), 'trucos')).map(i => i.name)).toEqual(['Descarga de fuego']);
        expect(items(buildMagicMenu(snapshot(), 'n1')).map(i => i.name)).toEqual(['Armadura de mago']);
        expect(items(buildMagicMenu(snapshot(), 'objetos')).map(i => i.name)).toEqual(['Leer Pergamino de escudo']);
        expect(buildMagicMenu(snapshot(), 'nada').filters?.find(f => f.active)?.id).toBe('todos');
    });

    test('un conjuro contra alguien pregunta a quién; los tipos de daño, en castellano', () => {
        const bolt = items(buildMagicMenu(snapshot()))[0];
        expect(bolt.next?.items.map(i => i.pick)).toEqual(['ability:fire-bolt:e1', 'ability:fire-bolt:e2']);
        expect(damageWord('cold')).toBe('frío');
        expect(damageWord('cortante')).toBe('cortante');
    });

    test('J19.3: con espacios de más nivel, la tarjeta deja elegir con cuál, y sus números son los de ese nivel', () => {
        const missile = {
            id: 'magic-missile', name: 'Proyectil mágico', desc: 'Dardos que no fallan.', cost: 'action', target: 'enemy', rangeFeet: 120,
            spellLevel: 1, slotLevel: 1, damage: '3 × 1d4+1', damageType: 'force', healing: '', enabled: true, reason: '',
            targets: [{ ...rat, enabled: true, reason: '' }],
            upcasts: [
                { level: 1, left: 2, damage: '3 × 1d4+1', healing: '', targets: 1 },
                { level: 2, left: 1, damage: '4 × 1d4+1', healing: '', targets: 1 },
                { level: 3, left: 0, damage: '5 × 1d4+1', healing: '', targets: 1 },
            ],
        };
        const s = snapshot({ abilities: [missile] });
        const low = items(buildMagicMenu(s))[0];
        expect(low.levels?.options.map(o => [o.label, o.active])).toEqual([['Nivel 1', true], ['Nivel 2', false]]);
        expect(low.levels?.options[1].title).toBe('Con un espacio de nivel 2 · 4 × 1d4+1 fuerza · quedan 1');
        expect(low.badges?.map(b => b.text)).toEqual(['3 × 1d4+1 fuerza', '120 pies', 'Espacio de nivel 1']);
        expect(low.next?.items.map(i => i.pick)).toEqual(['ability:magic-missile:e1']);

        const high = items(buildMagicMenu(s, 'todos', { 'magic-missile': 2 }))[0];
        expect(high.levels?.options.map(o => o.active)).toEqual([false, true]);
        expect(high.badges?.map(b => b.text)).toEqual(['4 × 1d4+1 fuerza', '120 pies', 'Espacio de nivel 2']);
        expect(high.next?.items.map(i => i.pick)).toEqual(['cast:2:magic-missile:e1']);

        // Un nivel sin espacios que quedan no se elige: vuelve al más bajo.
        expect(items(buildMagicMenu(s, 'todos', { 'magic-missile': 3 }))[0].next?.items[0].pick).toBe('ability:magic-missile:e1');
        // Con un solo espacio posible, no hay qué elegir; y sin turno, tampoco.
        const one = snapshot({ abilities: [{ ...missile, upcasts: [missile.upcasts[0]] }] });
        expect(items(buildMagicMenu(one))[0].levels).toBeUndefined();
        expect(items(buildMagicMenu(snapshot({ abilities: [missile], ready: { action: false, bonus: true, reaction: true } })))[0].levels).toBeUndefined();
        // Sobre ti mismo, sin objetivo: «cast:nivel:id».
        const shield = { ...missile, id: 'false-life', name: 'Vida falsa', target: 'self', damage: '', healing: '', targets: [] };
        expect(items(buildMagicMenu(snapshot({ abilities: [shield] }), 'todos', { 'false-life': 2 }))[0].pick).toBe('cast:2:false-life');
    });
});

describe('Acciones', () => {
    test('las de 2024, y parlamentar', () => {
        const menu = buildActionsMenu(snapshot(), ACTIONS_2024, numbers);
        expect(menu.sections[0].items.map(i => i.name)).toEqual(['Correr', 'Destrabarse', 'Esquivar', 'Ayudar', 'Ocultarse', 'Estudiar', 'Utilizar', 'Preparar golpe', 'Parlamentar']);
        const all = items(menu);
        expect(all.find(i => i.name === 'Correr')?.badges?.[0].text).toBe('+30 pies');
        expect(all.find(i => i.name === 'Ocultarse')?.tags?.[0].text).toBe('CD 15 · Sigilo');
        expect(all.find(i => i.name === 'Ocultarse')?.enabled).toBe(false);
        expect(all.find(i => i.name === 'Ocultarse')?.reason).toMatch(/te ve/);
        expect(all.find(i => i.name === 'Ayudar')?.next?.items[0].pick).toBe('act:ayudar:e1');
    });

    test('Estudiar: cualquiera en pie, con su CD y lo que ya sabes', () => {
        const study = items(buildActionsMenu(snapshot(), ACTIONS_2024, numbers)).find(i => i.name === 'Estudiar');
        expect(study?.next?.items.map(i => i.pick)).toEqual(['act:estudiar:e1', 'act:estudiar:e2']);
        expect(study?.next?.items[0].desc).toMatch(/ya sabes 1 cosa/);
        expect(study?.next?.items[0].badges?.[0].text).toBe('CD 10');
    });

    test('Utilizar: darle la poción a quien tienes pegado, y lanzar aceite', () => {
        const use = items(buildActionsMenu(snapshot(), ACTIONS_2024, numbers)).find(i => i.name === 'Utilizar');
        const give = use?.next?.items.find(i => i.key === 'give:p1');
        expect(give?.next?.items[0].pick).toBe('give:p1:2');
        expect(use?.next?.items.find(i => i.key === 'maneuver:lanzar:aceite')?.next?.items[0].pick).toBe('maneuver:lanzar:aceite:e1');
        const empty = items(buildActionsMenu(snapshot({ potions: [], throws: [] }), ACTIONS_2024, numbers)).find(i => i.name === 'Utilizar');
        expect(empty?.enabled).toBe(false);
    });

    test('lo de tu clase que no va contra un enemigo, aparte', () => {
        const menu = buildActionsMenu(snapshot({ abilities: [{ id: 'hab-cubrirse', name: 'Cubrirse', desc: '', cost: 'action', target: 'self', rangeFeet: 0, spellLevel: null, enabled: true, reason: '', targets: [] }] }), ACTIONS_2024, numbers);
        expect(menu.sections[1]).toMatchObject({ title: 'De tu clase' });
        expect(menu.sections[1].items[0].pick).toBe('ability:hab-cubrirse');
    });
});

describe('Adicional', () => {
    test('beber una poción (2024: acción adicional) y lo que cura', () => {
        const all = items(buildBonusMenu(snapshot()));
        const drink = all.find(i => i.pick === 'drink:p1');
        expect(drink?.badges?.map(b => b.text)).toEqual(['Cura 2d4+2', '×2', 'Adicional']);
        expect(drink?.enabled).toBe(true);
        const none = items(buildBonusMenu(snapshot({ potions: [] }))).find(i => i.key === 'drink:none');
        expect(none?.reason).toMatch(/No llevas pociones/);
    });

    test('la otra mano: apagada con su porqué; lista, con Mellar no gasta la adicional', () => {
        const off = items(buildBonusMenu(snapshot())).find(i => i.key === 'offhand');
        expect(off?.enabled).toBe(false);
        expect(off?.reason).toMatch(/ligera/);
        const dagger = { id: 'd', name: 'Daga', mastery: 'nick', masteryOn: true, damage: '1d4', damageType: 'perforante', reachFeet: 20, light: true, ranged: false, hands: 1, targets: [rat] };
        const ready = items(buildBonusMenu(snapshot({ offHand: { weapon: dagger, ok: true, reason: '', free: true } }))).find(i => i.key === 'offhand');
        expect(ready?.enabled).toBe(true);
        expect(ready?.tags?.[0].text).toBe('Mellar');
        expect(ready?.badges?.map(b => b.text)).toEqual(['1d4 perforante', '5 pies', 'Gratis (Mellar)']);
        expect(ready?.next?.items[0].pick).toBe('offhand:e1');
    });

    test('lo de clase y los conjuros de adicional, y lo gratis aparte', () => {
        const menu = buildBonusMenu(snapshot());
        expect(menu.sections.find(s => s.title === 'De tu clase y tu magia')?.items.map(i => i.name)).toEqual(['Paso brumoso', 'Segundo aliento']);
        const free = menu.sections.find(s => s.title === 'Sin gastar nada');
        expect(free?.items[0].next?.items[0].pick).toBe('ability:hab-gritar:2');
    });

    test('sin la adicional, todo lo suyo dice por qué', () => {
        const all = items(buildBonusMenu(snapshot({ ready: { action: true, bonus: false, reaction: true } })));
        expect(all.find(i => i.pick === 'drink:p1')?.reason).toMatch(/adicional/);
        expect(all.find(i => i.name === 'Segundo aliento')?.enabled).toBe(false);
    });
});

describe('las piezas', () => {
    test('los pies, el toque y tú', () => {
        expect(reachWords(120)).toBe('120 pies');
        expect(reachWords(0)).toBe('5 pies');
        expect(reachWords(5, 'ally')).toBe('Toque');
        expect(reachWords(0, 'self')).toBe('Tú');
        expect(targetDetail({ id: 'x', name: 'x', distanceFeet: 10, hp: 3, maxHp: 7, ac: 12, note: 'salva con Fuerza' })).toBe('10 pies · PG 3/7 · CA 12 · salva con Fuerza');
    });

    test('las teclas 1 a 9 van a lo que se puede pulsar, sin la tarjeta del arma', () => {
        const all = items(buildAttackMenu(snapshot()));
        expect(pickable(all)[0].pick).toBe('attack:e1');
        expect(pickable(all).some(i => i.kind === 'weapon')).toBe(false);
    });

    test('ninguna opción dice «ft»', () => {
        const s = snapshot();
        const text = JSON.stringify([buildAttackMenu(s), buildMagicMenu(s), buildActionsMenu(s, ACTIONS_2024, numbers), buildBonusMenu(s), buildBar(s)]);
        expect(text).not.toMatch(/\bft\b/);
    });
});
