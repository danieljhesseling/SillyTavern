import { describe, test, expect } from '@jest/globals';
import { MANEUVERS, readManeuvers, noteKnockdown, takeCombo, startTurn } from '../public/scripts/game-engine/combat/maneuvers.js';
import { statusMarkers } from '../public/scripts/game-engine/combat/initiative-tracker.js';
import { byPreference, PREFERENCES } from '../public/scripts/game-engine/combat/ally-ai.js';
import { groupMorale, campJobOf, withJob, whoMourns, mourningFor } from '../public/scripts/game-engine/campaign/company.js';
import { desireLine, heroStory } from '../public/scripts/game-engine/campaign/feats.js';
import { takePrisoners, prisonerChips, dealWith, MAX_PRISONERS } from '../public/scripts/game-engine/campaign/prisoners.js';
import { findShortcut, applyShortcut, roadEncounter } from '../public/scripts/game-engine/world/road.js';
import { addRoll, diceStats, MAX_ROLLS } from '../public/scripts/game-engine/campaign/dice-log.js';
import { actionForKey, SHORTCUTS } from '../public/scripts/game-engine/ui/shell/shortcuts.js';
import { terrainFromAsciiMap, isLocked, unlockDoor, lockedDoors, describeCell, normalizeTerrain } from '../public/scripts/game-engine/board/terrain.js';
import { getMapLegend } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';
import { buildJournal } from '../public/scripts/game-engine/campaign/guidance.js';
import { SKILLS, skillModifier } from '../public/scripts/game-engine/rules/checks.js';
import { asciiFromTerrain } from '../public/scripts/game-engine/campaign/campaign-export.js';

describe('combate', () => {
    test('10: agarrar es una maniobra más, contra alguien pegado', () => {
        expect(MANEUVERS.agarrar).toMatchObject({ needsTarget: true, label: 'Agarrar' });
    });

    test('17: rematar la jugada de otro, en la misma ronda', () => {
        const state = noteKnockdown(null, 'g', '1', 3);
        expect(takeCombo(state, { targetId: 'g', attackerId: '1', round: 3 }).combo).toBe(false);
        expect(takeCombo(state, { targetId: 'g', attackerId: '2', round: 4 }).combo).toBe(false);
        const used = takeCombo(state, { targetId: 'g', attackerId: '2', round: 3 });
        expect(used).toMatchObject({ combo: true, by: '1' });
        expect(used.state.combo).toBeNull();
        expect(startTurn(state, '9').combo).toEqual({ targetId: 'g', by: '1', round: 3 });
        expect(readManeuvers(undefined).combo).toBeNull();
    });

    test('21: cada estado dice qué hace', () => {
        const [prone, unknown] = statusMarkers(['Prone', 'Maldito']);
        expect(prone).toMatchObject({ label: 'Derribado', effect: expect.stringMatching(/ventaja/) });
        expect(unknown).toMatchObject({ label: 'Maldito', effect: '' });
    });

    test('35: a quién va primero', () => {
        const from = { x: 0, y: 0 };
        const enemies = [
            { id: 'a', gridX: 1, gridY: 0, currentHp: 9, maxHp: 10, reachFeet: 5 },
            { id: 'b', gridX: 6, gridY: 0, currentHp: 2, maxHp: 10, reachFeet: 60 },
            { id: 'c', gridX: 4, gridY: 0, currentHp: 30, maxHp: 30, reachFeet: 5, boss: true },
        ];
        expect(byPreference(enemies, 'debil', from)[0].id).toBe('b');
        expect(byPreference(enemies, 'cerca', from)[0].id).toBe('a');
        expect(byPreference(enemies, 'tirador', from)[0].id).toBe('b');
        expect(byPreference(enemies, 'jefe', from)[0].id).toBe('c');
        expect(Object.keys(PREFERENCES)).toEqual(['debil', 'cerca', 'tirador', 'jefe']);
    });
});

describe('el grupo', () => {
    test('39: la moral sube bien avenidos y baja con hambre y heridas', () => {
        expect(groupMorale({ ranks: [4, 3], hungry: 0, wounded: 0, size: 3 }).value).toBe(1);
        expect(groupMorale({ ranks: [1], hungry: 1, wounded: 1, size: 3 }).value).toBe(-1);
        expect(groupMorale({ ranks: [1], hungry: 0, wounded: 0, size: 3 }).value).toBe(0);
    });

    test('41: el oficio sale de la clase', () => {
        expect(campJobOf({ class: 'explorador' })?.id).toBe('rastreador');
        expect(campJobOf({ class: 'Clérigo' })?.id).toBe('sanador');
        expect(campJobOf({ class: 'guerrero' })?.id).toBe('centinela');
        expect(campJobOf({ class: 'pícaro' })?.id).toBe('buscavidas');
        expect(campJobOf({ class: 'mago' })?.id).toBe('erudito');
        expect(campJobOf({ class: 'panadero' })).toBeNull();
        expect(withJob([{ class: 'mago', hp: 0 }, { class: 'mago', hp: 5, name: 'Ela' }], 'erudito')?.name).toBe('Ela');
    });

    test('43: el duelo, un día, y pesa en la moral', () => {
        const mourners = whoMourns({
            party: [{ id: 1, name: 'Aldara', hp: 5, wants: 'quiet' }, { id: 2, name: 'Bran', hp: 5, wants: 'coin', bondWithDead: 1 }],
            dead: 'Grimm', today: 4,
        });
        expect(mourners).toEqual([{ id: '1', mourning: { for: 'Grimm', until: 5 } }]);
        const aldara = { mourning: mourners[0].mourning };
        expect(mourningFor(aldara, 5)).toBe('Grimm');
        expect(mourningFor(aldara, 6)).toBe('');
        expect(desireLine({ wants: 'quiet', hpPct: 100, mourning: 'Grimm' })).toMatch(/duelo por Grimm/);
        expect(groupMorale({ ranks: [1], hungry: 0, wounded: 0, size: 3, mourning: 1 }).value).toBe(-1);
    });

    test('57: la historia de alguien, por orden, de lo apuntado', () => {
        const lines = heroStory({
            member: { name: 'Bran', nickname: 'Tres Vidas', feats: { kills: 2, downed: 3 }, scars: ['Cicatriz de tajo'] },
            deeds: [{ day: 5, text: 'Bran se unió al grupo.' }, { day: 2, text: 'Otra cosa.' }],
            memories: [{ day: 3, text: 'Bran salvó a Sela.', who: ['Bran', 'Sela'] }],
        });
        expect(lines.slice(0, 2)).toEqual(['Día 3: Bran salvó a Sela.', 'Día 5: Bran se unió al grupo.']);
        expect(lines).toContain('Le llaman «Tres Vidas».');
        expect(lines).toContain('Ha caído 3 veces y se ha levantado.');
        expect(lines).toContain('Cicatriz de tajo.');
    });
});

describe('prisioneros', () => {
    test('7: se toman, se interrogan una vez, se entregan donde hay autoridad', () => {
        let list = takePrisoners(null, ['Lobo 1'], { day: 3, place: 'El Pueblo' });
        const id = list[0].id;
        let chips = prisonerChips(list, { authority: false });
        expect(chips.map(c => c.label)).toEqual(['Interrogar a Lobo 1', 'Soltar a Lobo 1']);
        list = dealWith(list, id, 'ask').prisoners;
        chips = prisonerChips(list, { authority: true });
        expect(chips.map(c => c.command)).toEqual([`/prisionero entregar ${id}`, `/prisionero soltar ${id}`]);
        expect(dealWith(list, id, 'give').prisoners).toEqual([]);
        expect(prisonerChips(list, { authority: true, fighting: true })).toEqual([]);
    });

    test('no se arrastran más de cuatro', () => {
        const list = takePrisoners(null, ['a', 'b', 'c', 'd', 'e'], { day: 1, place: '' });
        expect(list).toHaveLength(MAX_PRISONERS);
        expect(list[0].name).toBe('b');
    });
});

describe('el camino', () => {
    const locations = [
        { name: 'A', routes: [{ to: 'B', days: 3 }, { to: 'C', days: 1 }] },
        { name: 'B', routes: [{ to: 'A', days: 3 }] },
        { name: 'C', routes: [{ to: 'A', days: 1 }] },
    ];

    test('72: un atajo acorta el camino más largo, en los dos sentidos', () => {
        const shortcut = findShortcut({ locations, from: 'A', random: () => 0 });
        expect(shortcut).toEqual({ from: 'A', to: 'B', days: 2 });
        const after = applyShortcut(locations, /** @type {any} */ (shortcut));
        expect(after[0].routes[0]).toMatchObject({ to: 'B', days: 2, shortcut: true });
        expect(after[1].routes[0]).toMatchObject({ to: 'A', days: 2, shortcut: true });
        expect(findShortcut({ locations: after, from: 'A', random: () => 0 })).toBeNull();
        expect(findShortcut({ locations, from: 'A', random: () => 0.9 })).toBeNull();
    });

    test('72: si todo está a un día, un camino de pastores nuevo a lo que estaba a dos tramos', () => {
        const near = [
            { name: 'P', routes: [{ to: 'Q', days: 1 }] },
            { name: 'Q', routes: [{ to: 'P', days: 1 }, { to: 'R', days: 2 }] },
            { name: 'R', routes: [{ to: 'Q', days: 2 }] },
        ];
        const shortcut = findShortcut({ locations: near, from: 'P', random: () => 0 });
        expect(shortcut).toEqual({ from: 'P', to: 'R', days: 2 });
        const after = applyShortcut(near, /** @type {any} */ (shortcut));
        expect(after[0].routes).toContainEqual({ to: 'R', days: 2, shortcut: true });
        expect(after[2].routes).toContainEqual({ to: 'P', days: 2, shortcut: true });
    });

    test('88: con una facción que os odia, cazarrecompensas', () => {
        const met = roadEncounter({ factions: [{ id: 'v', name: 'Vane', reputation: -4 }], goods: [], random: () => 0 });
        expect(met).toEqual({ kind: 'bounty', faction: 'Vane', toll: 40, dc: 14 });
        expect(roadEncounter({ factions: [{ id: 'v', name: 'Vane', reputation: -2 }], goods: [], random: () => 0 })).toBeNull();
    });

    test('92: un mercader, con descuento si regatea alguien', () => {
        const met = roadEncounter({ factions: [], goods: ['Capa del vagabundo'], random: () => 0, discount: 0.25 });
        expect(met).toEqual({ kind: 'merchant', item: 'Capa del vagabundo', price: 38 });
    });
});

describe('puertas con llave', () => {
    test('77: la L es una puerta cerrada con llave, que se quita', () => {
        const terrain = terrainFromAsciiMap(['#L#', '#D#']);
        expect(isLocked(terrain, 1, 0)).toBe(true);
        expect(isLocked(terrain, 1, 1)).toBe(false);
        expect(lockedDoors(terrain)).toEqual([{ x: 1, y: 0 }]);
        expect(describeCell(terrain, 1, 0)).toMatch(/cerrada con llave/);
        const opened = unlockDoor(terrain, 1, 0);
        expect(isLocked(opened, 1, 0)).toBe(false);
        expect(normalizeTerrain({ cells: { '0,0': { type: 'door', open: true, locked: true } } }).cells['0,0'].locked).toBeUndefined();
        expect(getMapLegend().L).toMatch(/con llave/);
        expect(asciiFromTerrain(terrainFromAsciiMap(['DLo']), 3, 1)).toEqual(['DLo']);
    });

    test('y se abre con maña: Juego de manos, del pícaro', () => {
        expect(SKILLS.sleight.label).toBe('Juego de manos');
        expect(skillModifier({ class: 'pícaro', level: 1, dexterity: 14 }, 'sleight')).toEqual({ modifier: 4, proficient: true });
    });
});

describe('comodidad', () => {
    test('168: el dado, con sus cuentas', () => {
        let log = null;
        for (let i = 1; i <= 20; i++) log = addRoll(log, { title: 't', natural: i, total: i + 2, dc: 12 });
        const stats = diceStats(log);
        expect(stats).toMatchObject({ count: 20, average: 10.5, twenties: 1, ones: 1, judged: 20, passed: 11 });
        expect(stats.verdict).toMatch(/Lo normal/);
        expect(addRoll(log, { title: 'x', natural: 0, total: 0, dc: null })).toHaveLength(20);
        expect(diceStats(null).verdict).toMatch(/Pocas/);
        expect(MAX_ROLLS).toBeGreaterThan(100);
    });

    test('152: las teclas del juego, sin tocar las del navegador', () => {
        expect(actionForKey({ key: 'd' })).toBe('journal');
        expect(actionForKey({ key: 'G' })).toBe('glance');
        expect(actionForKey({ key: '?' })).toBe('keys');
        expect(actionForKey({ key: 'd', ctrlKey: true })).toBe('');
        expect(actionForKey({ key: '1' })).toBe('');
        expect(SHORTCUTS.every(s => s.label)).toBe(true);
    });

    test('151 y 7: se habla con la gente de aquí, y los prisioneros tienen sus fichas', () => {
        const chips = buildActionChips({
            companions: [{ name: 'Bran' }],
            people: [{ name: 'Giles' }, { name: 'Bran' }],
            prisoners: [{ id: 'prisoner:ask:p1', label: 'Interrogar a Lobo', icon: 'fa-comments', command: '/prisionero interrogar p1' }],
        });
        expect(chips.find(c => c.id === 'talk-local:Giles')?.draft).toBe('Le digo a Giles: ');
        expect(chips.some(c => c.id === 'talk-local:Bran')).toBe(false);
        expect(chips.find(c => c.id === 'prisoner:ask:p1')?.command).toBe('/prisionero interrogar p1');
    });

    test('95: la crónica, lo último arriba', () => {
        const sections = buildJournal({ open: [], deeds: [{ day: 1, text: 'Uno.' }, { day: 4, text: 'Cuatro.' }] });
        expect(sections.find(s => s.title === 'Crónica')?.items).toEqual(['Día 4: Cuatro.', 'Día 1: Uno.']);
    });
});
