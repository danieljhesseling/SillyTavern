import { describe, test, expect } from '@jest/globals';
import { readRecruits, recruitActions, bondSceneFor, describeMeeting, HIRE_COST, MAX_PARTY } from '../public/scripts/game-engine/campaign/recruit.js';
import { addMemory, memoriesOf, memoryLines, lastMemoryWith, MAX_MEMORIES } from '../public/scripts/game-engine/campaign/memories.js';
import { opinionOf, wantsOf, OPINIONS } from '../public/scripts/game-engine/combat/barks.js';
import { worldMemoryBlock } from '../public/scripts/game-engine/campaign/world-memory.js';

const entries = {
    7: { uid: 7, comment: 'Bran', content: 'Bran afila su espada.', dndData: { entityType: 'npc', confidant: true, name: 'Bran', charClass: 'guerrero', motive: 'coin' } },
    8: { uid: 8, comment: 'Isolda', content: 'Isolda se limpia la sangre.', dndData: { entityType: 'npc', confidant: true, name: 'Isolda', charClass: 'picaro', motive: 'bond' } },
    9: { uid: 9, comment: 'Giles', content: 'El posadero.', dndData: { entityType: 'npc', name: 'Giles' } },
    10: { uid: 10, comment: 'Grimm', content: 'Ya es de los tuyos.', dndData: { entityType: 'character', confidant: true, name: 'Grimm' } },
};

describe('recruit', () => {
    test('solo los confidentes que siguen fuera del grupo', () => {
        const list = readRecruits({ entries, party: [{ name: 'Wendel' }], met: [8] });
        expect(list.map(r => [r.name, r.motive, r.met, r.cost])).toEqual([
            ['Bran', 'coin', false, HIRE_COST],
            ['Isolda', 'bond', true, 0],
        ]);
    });

    test('quien ya está en el grupo no sale, por nombre o por ficha', () => {
        expect(readRecruits({ entries, party: [{ name: 'bran' }, { name: 'X', wiUid: 8 }] })).toEqual([]);
    });

    test('primero se conoce, luego se pide; el que va por oro cobra', () => {
        const list = readRecruits({ entries, party: [], met: ['7'] });
        const actions = recruitActions(list, { purse: 10, partySize: 2 });
        expect(actions[0]).toMatchObject({ id: 'inn-hire:7', enabled: false, cost: HIRE_COST });
        expect(actions[0].detail).toMatch(/No llega el oro/);
        expect(actions[1]).toMatchObject({ id: 'inn-meet:8', enabled: true, cost: 0 });
    });

    test('con el grupo lleno no cabe nadie', () => {
        const list = readRecruits({ entries, party: [], met: ['8'] });
        const hire = recruitActions(list, { purse: 100, partySize: MAX_PARTY }).find(a => a.id === 'inn-hire:8');
        expect(hire?.enabled).toBe(false);
        expect(hire?.detail).toMatch(/no cabe/);
    });

    test('la escena del rango que toca', () => {
        const member = { bondScenes: [{ rank: 2, title: 'El peso del acero', scene: 'Bran se sienta.' }] };
        expect(bondSceneFor(member, 2)).toEqual({ title: 'El peso del acero', scene: 'Bran se sienta.' });
        expect(bondSceneFor(member, 3)).toBeNull();
    });

    test('al conocerle, el narrador sabe que cobra', () => {
        const [bran] = readRecruits({ entries, party: [] });
        expect(describeMeeting(bran, 'El Pueblo de Barro')).toMatch(/CONOCÉIS A BRAN.*El Pueblo de Barro.*25 de oro/);
    });
});

describe('memories', () => {
    test('se apuntan sin repetir, y se buscan por quien estaba', () => {
        let list = addMemory(null, { day: 2, text: 'Bruna salvó a Sela en el Peaje.', who: ['Bruna', 'Sela'] });
        list = addMemory(list, { day: 3, text: 'Bruna salvó a Sela en el Peaje.', who: ['Bruna'] });
        list = addMemory(list, { day: 4, text: 'Sela cayó en la cripta y se levantó.', who: ['Sela'] });
        expect(list).toHaveLength(2);
        expect(memoriesOf(list, 'bruna').map(m => m.day)).toEqual([2]);
        expect(lastMemoryWith(list, 'Sela')).toBe('Sela cayó en la cripta y se levantó.');
        expect(memoryLines(list, 4)).toEqual(['Hace 2 día(s): Bruna salvó a Sela en el Peaje.', 'Hoy: Sela cayó en la cripta y se levantó.']);
    });

    test('se guardan los últimos', () => {
        let list = null;
        for (let i = 0; i < MAX_MEMORIES + 5; i++) list = addMemory(list, { day: 1, text: `R${i}`, who: [] });
        expect(list).toHaveLength(MAX_MEMORIES);
        expect(list?.[0].text).toBe('R5');
    });

    test('llegan al narrador en el bloque del mundo', () => {
        expect(worldMemoryBlock({ today: 1, memories: ['Hoy: Bruna salvó a Sela.'] }))
            .toMatch(/- Recuerdan: Hoy: Bruna salvó a Sela\./);
    });
});

describe('opinionOf', () => {
    test('cada uno mira lo suyo', () => {
        expect(opinionOf('coin', { reward: 50 })?.mood).toBe('like');
        expect(opinionOf('coin', { reward: 10 })?.mood).toBe('dislike');
        expect(opinionOf('glory', { kind: 'hunt' })?.mood).toBe('like');
        expect(opinionOf('blood', { noFight: true })?.mood).toBe('dislike');
        expect(OPINIONS.quiet.dirty).toContain(opinionOf('quiet', { kind: 'steal' })?.line);
        expect(opinionOf('knowledge', { kind: 'recover' })?.mood).toBe('like');
    });

    test('seis frases por caso, y no repite la última', () => {
        for (const set of Object.values(OPINIONS)) for (const lines of Object.values(set)) expect(lines).toHaveLength(6);
        const first = opinionOf('coin', { reward: 50 }, { random: () => 0 })?.line;
        const second = opinionOf('coin', { reward: 50 }, { random: () => 0, last: first });
        expect(second?.line).not.toBe(first);
    });

    test('cada confidente, con su carácter', () => {
        expect(wantsOf({ motive: 'coin', className: 'guerrero' })).toBe('coin');
        expect(wantsOf({ motive: 'bond', className: 'pícaro' })).toBe('blood');
        expect(wantsOf({ motive: 'bond', className: 'explorador' })).toBe('quiet');
        expect(wantsOf({ motive: 'bond', className: 'Maga' })).toBe('knowledge');
        expect(wantsOf({ motive: 'bond', className: 'guerrero', wants: 'quiet' })).toBe('quiet');
    });

    test('lo que no le importa no lo comenta', () => {
        expect(opinionOf('coin', { reward: 25 })).toBeNull();
        expect(opinionOf('', { kind: 'hunt' })).toBeNull();
    });
});
