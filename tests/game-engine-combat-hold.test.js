import { describe, test, expect } from '@jest/globals';
import {
    holdDuringCombat, HELD_ACTIONS,
} from '../public/scripts/game-engine/combat/combat-hold.js';
import {
    isSceneAvailable, describeScene, labelFor, SCENE,
} from '../public/scripts/game-engine/ui/shell/scene-director.js';

describe('lo que un combate retiene', () => {
    const fighting = { active: true };

    test('sin combate no retiene nada', () => {
        for (const action of HELD_ACTIONS) {
            expect(holdDuringCombat({ active: false }, action)).toBe('');
            expect(holdDuringCombat(null, action)).toBe('');
            expect(holdDuringCombat(undefined, action)).toBe('');
            expect(holdDuringCombat({}, action)).toBe('');
        }
    });

    test('con combate retiene las cuatro puertas, y cada una dice por que', () => {
        for (const action of HELD_ACTIONS) {
            const reason = holdDuringCombat(fighting, action);
            expect(reason.length).toBeGreaterThan(10);
        }
    });

    test('y lo que dice es distinto en cada puerta: salir no es repintar', () => {
        const said = HELD_ACTIONS.map(action => holdDuringCombat(fighting, action));
        expect(new Set(said).size).toBe(HELD_ACTIONS.length);
    });

    test('una accion que no conoce no se la inventa', () => {
        expect(holdDuringCombat(fighting, /** @type {any} */ ('bailar'))).toBe('');
    });

    // Abandonar es una decisión, no una fuga: si esto se retuviera, un combate mal
    // empezado dejaría la partida encerrada.
    test('nunca retiene abandonar, porque abandonar tiene su propio boton', () => {
        expect(HELD_ACTIONS).not.toContain('abandon');
        expect(holdDuringCombat(fighting, /** @type {any} */ ('abandon'))).toBe('');
    });

    // `active` llega de `chatMetadata`, o sea de un JSON guardado: un 1 o un "true" no
    // son un combate en marcha, y tratarlos como tal cerraría puertas sin pelea.
    test('solo un combate de verdad retiene: nada de valores parecidos', () => {
        expect(holdDuringCombat(/** @type {any} */ ({ active: 1 }), 'travel')).toBe('');
        expect(holdDuringCombat(/** @type {any} */ ({ active: 'true' }), 'travel')).toBe('');
    });
});

describe('la barra de escenas, mientras se pelea', () => {
    const board = { hasChat: true, boardName: 'El sótano', locationName: 'El molino', hasWorldMap: true };

    test('explorar se apaga: el mapa es la puerta por la que se huia sin querer', () => {
        expect(isSceneAvailable(SCENE.EXPLORATION, board)).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { ...board, combatActive: true })).toBe(false);
    });

    test('y dice que hay un combate, no que no haya nada que ver', () => {
        const said = describeScene(SCENE.EXPLORATION, { ...board, combatActive: true });
        expect(said).toMatch(/combate/i);
        expect(said).not.toMatch(/nada que mostrar/);
    });

    test('el tablero y el dialogo siguen abiertos: se mira y se narra mientras se pelea', () => {
        const fighting = { ...board, combatActive: true };
        expect(isSceneAvailable(SCENE.COMBAT, fighting)).toBe(true);
        expect(isSceneAvailable(SCENE.DIALOGUE, fighting)).toBe(true);
    });
});

describe('cómo se llama cada escena, ahora mismo', () => {
    // Una pestana fija que pone «Combate» sin combate promete algo que no existe, y
    // pulsarla parece invocarlo.
    test('sin pelea, esa pantalla es el tablero', () => {
        expect(labelFor(SCENE.COMBAT, { boardName: 'El sótano' })).toBe('Tablero');
    });

    test('y con pelea, el combate', () => {
        expect(labelFor(SCENE.COMBAT, { boardName: 'El sótano', combatActive: true })).toBe('Combate');
    });

    test('las demás se llaman siempre igual', () => {
        expect(labelFor(SCENE.DIALOGUE, {})).toBe('Dialogo');
        expect(labelFor(SCENE.EXPLORATION, {})).toBe('Exploracion');
    });
});
