/**
 * Tanda 17, «que el combate se sienta» (Daniel, 2026-10-02): la secuencia de cada golpe
 * (combat-vtt/fx.js), lo que dice el d20 (combat-vtt/dice.js) y lo que el motor deja en ella
 * (party/combat-fx.js). Sin navegador: las cuentas, el orden y lo que espera a que acabe.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import { damageSentence, edgeSentence, rollSentence, rollVerdict } from '../public/scripts/game-engine/ui/combat-vtt/dice.js';
import {
    FX_MS, STILL_READ_MS, afterFx, blowGoesBefore, fxBusy, fxLength, fxMs, holdRedraw, pushFx, setFxLevel, skipFx,
} from '../public/scripts/game-engine/ui/combat-vtt/fx.js';
import { tokenIdOf, whoIsToken } from '../public/scripts/party/combat-fx.js';
import { combatEncounter, partyMembers, setCombatEncounter, setPartyMembers } from '../public/scripts/party/state.js';

/** Hasta que la secuencia acabe (sin navegador, cada paso no espera nada). */
async function settle() {
    for (let i = 0; i < 50 && fxBusy(); i++) await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(async () => {
    skipFx();
    await settle();
    setFxLevel(null);
});

describe('lo que dice el d20 (dice.js)', () => {
    test('la cuenta de un golpe, como en la mesa', () => {
        expect(rollSentence({ natural: 14, total: 19, dc: 13, against: 'CA' })).toBe('14 + 5 = 19 contra CA 13: impacta');
        expect(rollSentence({ natural: 9, total: 12, dc: 13, against: 'CA' })).toBe('9 + 3 = 12 contra CA 13: falla');
    });

    test('sin modificador, el número solo; con uno que resta, «−»', () => {
        expect(rollSentence({ natural: 14, total: 14, dc: 13, against: 'CA' })).toBe('14 contra CA 13: impacta');
        expect(rollSentence({ natural: 12, total: 11, dc: 13, against: 'CA' })).toBe('12 − 1 = 11 contra CA 13: falla');
    });

    test('un 20 natural es crítico y un 1 natural es pifia', () => {
        expect(rollSentence({ natural: 20, total: 24, dc: 11, against: 'CA', hit: true })).toBe('20 + 4 = 24 contra CA 11: ¡crítico!');
        expect(rollSentence({ natural: 1, total: 5, dc: 12, against: 'CA', hit: false })).toBe('1 + 4 = 5 contra CA 12: pifia: falla');
        expect(rollVerdict({ natural: 20, total: 24, dc: 11, against: 'CA', hit: true })).toMatchObject({ crit: true, good: true });
        expect(rollVerdict({ natural: 1, total: 5, dc: 12, against: 'CA', hit: false })).toMatchObject({ fumble: true, good: false });
    });

    test('lo que decide el motor manda: un golpe que la cuenta daba por bueno y para un Escudo', () => {
        expect(rollSentence({ natural: 15, total: 17, dc: 16, against: 'CA', hit: false })).toBe('15 + 2 = 17 contra CA 16: lo paran');
    });

    test('una prueba contra una CD: «lo supera» o «no lo supera»', () => {
        expect(rollSentence({ natural: 11, total: 14, dc: 15, against: 'CD' })).toBe('11 + 3 = 14 contra CD 15: no lo supera');
        expect(rollSentence({ natural: 12, total: 12, dc: 10, against: 'CD', hit: true })).toBe('12 contra CD 10: lo supera');
    });

    test('sin nada contra lo que tirar, solo la suma', () => {
        expect(rollSentence({ natural: 7, total: 9, dc: null })).toBe('7 + 2 = 9');
        expect(rollVerdict({ natural: 7, total: 9, dc: null }).word).toBe('');
    });

    test('con ventaja o desventaja, los dos dados y el que se queda', () => {
        expect(edgeSentence({ natural: 14, total: 17, rolls: [7, 14], edge: 'advantage' })).toBe('con ventaja: 7 y 14, se queda el 14');
        expect(edgeSentence({ natural: 3, total: 6, rolls: [3, 18], edge: 'disadvantage' })).toBe('con desventaja: 3 y 18, se queda el 3');
        expect(edgeSentence({ natural: 3, total: 6, rolls: [3], edge: 'normal' })).toBe('');
    });

    test('el daño, dicho llano', () => {
        expect(damageSentence({ total: 7, dice: '1d8', modifier: 2 })).toBe('Daño: 7 (1d8 + 2)');
        expect(damageSentence({ total: 5, dice: '1d6', modifier: 0 })).toBe('Daño: 5 (1d6)');
        expect(damageSentence({ total: 20, dice: '1d8 + 1d8', modifier: 4, crit: true })).toBe('Daño: 20 (1d8 + 1d8 + 4, crítico)');
        expect(damageSentence({ total: 1, dice: '1d4', modifier: -1 })).toBe('Daño: 1 (1d4 − 1)');
    });
});

describe('la secuencia (fx.js)', () => {
    test('con «Animaciones: ninguna» nada se mueve, pero lo que hay que leer se deja ver un momento', () => {
        setFxLevel('none');
        pushFx({ kind: 'call', fn: () => {} });
        expect(fxMs(FX_MS.lunge)).toBe(0);
        expect(fxMs(FX_MS.read, { read: true })).toBe(STILL_READ_MS);
    });

    test('mientras suena, el tablero no se redibuja: se apunta una vez y se hace al acabar', async () => {
        /** @type {string[]} */
        const said = [];
        const redraw = () => said.push('redibujado');
        expect(holdRedraw(redraw)).toBe(false);
        pushFx({ kind: 'call', fn: () => said.push('paso 1') });
        pushFx({ kind: 'call', fn: () => said.push('paso 2') });
        expect(fxBusy()).toBe(true);
        expect(holdRedraw(redraw)).toBe(true);
        expect(holdRedraw(redraw)).toBe(true);
        afterFx(() => said.push('panel de victoria'));
        expect(said).toEqual([]);
        await settle();
        expect(said).toEqual(['paso 1', 'paso 2', 'redibujado', 'panel de victoria']);
        expect(fxBusy()).toBe(false);
    });

    test('sin secuencia, lo que espera se hace ya', () => {
        /** @type {string[]} */
        const said = [];
        afterFx(() => said.push('ya'));
        expect(said).toEqual(['ya']);
    });

    test('un paso metido en una marca va antes de lo que vino después (andar antes de quemarse)', async () => {
        /** @type {string[]} */
        const said = [];
        pushFx({ kind: 'call', fn: () => said.push('turno') });
        const mark = fxLength();
        pushFx({ kind: 'call', fn: () => said.push('la zona quema') });
        pushFx({ kind: 'call', fn: () => said.push('anda') }, mark);
        await settle();
        expect(said).toEqual(['turno', 'anda', 'la zona quema']);
    });

    test('un paso que falla no para la secuencia', async () => {
        /** @type {string[]} */
        const said = [];
        pushFx({ kind: 'call', fn: () => { throw new Error('roto'); } });
        pushFx({ kind: 'call', fn: () => said.push('sigue') });
        const warn = console.warn;
        console.warn = () => {};
        try {
            await settle();
        } finally {
            console.warn = warn;
        }
        expect(said).toEqual(['sigue']);
    });

    test('«Pasar» deja cada paso en su resultado sin esperar', async () => {
        setFxLevel('normal');
        pushFx({ kind: 'roll', title: 'Nerea ataca', natural: 14, total: 19, dc: 13 });
        skipFx();
        expect(fxMs(FX_MS.tumble)).toBe(0);
        await settle();
        expect(fxBusy()).toBe(false);
    });

    test('tanda 21: quien ataca se lanza una sola vez, al llegar el golpe, no con el dado', () => {
        // El primer dado rueda con quien ataca quieto; la línea del daño se lee en la tarjeta.
        expect(blowGoesBefore('roll', false)).toBe(false);
        expect(blowGoesBefore('damage', true)).toBe(false);
        expect(blowGoesBefore('bark', true)).toBe(false);
        // Sale antes del impacto o del «Falla» (o de lo siguiente, si nada lo recibe).
        expect(blowGoesBefore('impact', true)).toBe(true);
        expect(blowGoesBefore('miss', true)).toBe(true);
        expect(blowGoesBefore('roll', true)).toBe(true);
        expect(blowGoesBefore('attack', true)).toBe(true);
        expect(blowGoesBefore('turn', false)).toBe(true);
        // Un conjuro desde la barra: sin dado, el golpe y en seguida el impacto.
        expect(blowGoesBefore('impact', false)).toBe(true);
    });

    test('tanda 21: un golpe anunciado que nadie recibe no deja la secuencia colgada', async () => {
        /** @type {string[]} */
        const said = [];
        pushFx({ kind: 'attack', from: 1, to: -1, style: 'melee' });
        pushFx({ kind: 'roll', title: 'Nerea agarra', natural: 12, total: 15, dc: 13 });
        afterFx(() => said.push('fin'));
        await settle();
        expect(fxBusy()).toBe(false);
        expect(said).toEqual(['fin']);
    });

    test('en el teléfono, la mitad', () => {
        setFxLevel('short');
        pushFx({ kind: 'call', fn: () => {} });
        expect(fxMs(FX_MS.tumble)).toBe(Math.round(FX_MS.tumble / 2));
    });
});

describe('lo que el motor deja en la secuencia (party/combat-fx.js)', () => {
    const before = { encounter: combatEncounter, party: partyMembers };

    afterEach(() => {
        setCombatEncounter(before.encounter);
        setPartyMembers(before.party);
    });

    test('las fichas: un enemigo por su sitio en la lista (-1, -2…), los del grupo por su id', () => {
        const rat = { instanceId: 'e1', name: 'Rata', currentHp: 3, maxHp: 5 };
        const wolf = { instanceId: 'e2', name: 'Lobo', currentHp: 11, maxHp: 11 };
        const hero = { id: 7, name: 'Nerea', hp: 30, maxHp: 34 };
        setCombatEncounter({ ...combatEncounter, active: true, enemies: [rat, wolf], turnOrder: [] });
        setPartyMembers([hero]);
        expect(tokenIdOf(rat)).toBe(-1);
        expect(tokenIdOf(wolf)).toBe(-2);
        expect(tokenIdOf(hero)).toBe(7);
        expect(tokenIdOf(null)).toBeNull();
    });

    test('quién hay detrás de una ficha, con la vida que le queda', () => {
        const wolf = { instanceId: 'e2', name: 'Lobo', currentHp: 4, maxHp: 11 };
        setCombatEncounter({ ...combatEncounter, active: true, enemies: [{ instanceId: 'e1', currentHp: 0, maxHp: 5 }, wolf], turnOrder: [] });
        setPartyMembers([{ id: 7, name: 'Nerea', hp: 22, maxHp: 34 }]);
        // J12.19: y su nombre y su lado, para decir quién cae.
        expect(whoIsToken(-2)).toEqual({ entryId: 'e2', hp: 4, max: 11, name: 'Lobo', team: 'enemy' });
        expect(whoIsToken(7)).toEqual({ entryId: '7', hp: 22, max: 34, name: 'Nerea', team: 'party' });
        expect(whoIsToken(-9)).toBeNull();
    });
});
