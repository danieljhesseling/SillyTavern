import { describe, test, expect } from '@jest/globals';
import {
    SCENE, SWITCHABLE_SCENES, SCENE_INFO,
    chooseScene, isSceneAvailable, sceneForShortcut, describeScene, sceneTransition,
} from '../public/scripts/game-engine/ui/shell/scene-director.js';

/** A campaign open, standing in a location, no fight. */
const playing = { hasChat: true, locationName: 'Cripta olvidada', hasWorldMap: true };

describe('chooseScene', () => {
    test('with no chat open there is only the title screen', () => {
        expect(chooseScene({}).scene).toBe(SCENE.TITLE);
        expect(chooseScene({ hasChat: false, combatActive: true, boardName: 'Sala' }).scene).toBe(SCENE.TITLE);
        expect(chooseScene(null).scene).toBe(SCENE.TITLE);
    });

    test('a running fight is the combat screen', () => {
        expect(chooseScene({ ...playing, combatActive: true, boardName: 'Sala' }).scene).toBe(SCENE.COMBAT);
    });

    test('an open board with no fight is still the tactical screen', () => {
        const choice = chooseScene({ ...playing, boardName: 'Sala de entrada' });
        expect(choice.scene).toBe(SCENE.COMBAT);
        expect(choice.reason).toContain('Sala de entrada');
    });

    test('a location with no board is exploration', () => {
        expect(chooseScene(playing).scene).toBe(SCENE.EXPLORATION);
    });

    test('a world map with nowhere chosen yet is also exploration', () => {
        expect(chooseScene({ hasChat: true, hasWorldMap: true }).scene).toBe(SCENE.EXPLORATION);
    });

    test('with no board and no map, the game is a conversation', () => {
        expect(chooseScene({ hasChat: true }).scene).toBe(SCENE.DIALOGUE);
    });

    // The correction in seccion 0.1: the model can say whatever it likes about the mood,
    // and the screen does not move until the engine has an encounter.
    test('nothing but combatActive moves the screen into combat', () => {
        const calm = { hasChat: true, locationName: 'Taberna' };
        expect(chooseScene(calm).scene).toBe(SCENE.EXPLORATION);
        expect(chooseScene({ ...calm, combatActive: true }).scene).toBe(SCENE.COMBAT);
    });
});

describe('the manual pick', () => {
    test('beats the situation while its scene has something to show', () => {
        const choice = chooseScene({ ...playing, combatActive: true, boardName: 'Sala' }, SCENE.DIALOGUE);
        expect(choice.scene).toBe(SCENE.DIALOGUE);
        expect(choice.source).toBe('manual');
        expect(choice.manualHeld).toBe(true);
    });

    // Picking the board and then closing it used to be a way to end up looking at nothing.
    test('is dropped when its scene runs out of anything to show', () => {
        const choice = chooseScene(playing, SCENE.COMBAT);
        expect(choice.scene).toBe(SCENE.EXPLORATION);
        expect(choice.source).toBe('engine');
        expect(choice.manualHeld).toBe(false);
    });

    test('never overrides the title screen: with no chat there is nothing to pick', () => {
        expect(chooseScene({ hasChat: false }, SCENE.COMBAT).scene).toBe(SCENE.TITLE);
    });

    test('a scene that is not one of the three is ignored', () => {
        expect(chooseScene({ ...playing, combatActive: true }, /** @type {any} */ ('title')).scene).toBe(SCENE.COMBAT);
        expect(chooseScene({ ...playing, combatActive: true }, /** @type {any} */ ('nonsense')).scene).toBe(SCENE.COMBAT);
    });
});

describe('isSceneAvailable', () => {
    test('combat needs a fight or a board', () => {
        expect(isSceneAvailable(SCENE.COMBAT, { combatActive: true })).toBe(true);
        expect(isSceneAvailable(SCENE.COMBAT, { boardName: 'Sala' })).toBe(true);
        expect(isSceneAvailable(SCENE.COMBAT, playing)).toBe(false);
    });

    test('exploration needs a location or a map', () => {
        expect(isSceneAvailable(SCENE.EXPLORATION, { locationName: 'Cripta' })).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { hasWorldMap: true })).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { hasChat: true })).toBe(false);
    });

    test('the conversation is always available', () => {
        expect(isSceneAvailable(SCENE.DIALOGUE, {})).toBe(true);
    });

    test('an unknown scene is not available', () => {
        expect(isSceneAvailable(/** @type {any} */ ('inventory'), playing)).toBe(false);
    });
});

describe('shortcuts and labels', () => {
    test('1, 2 and 3 are the three switchable scenes, in that order', () => {
        expect(SWITCHABLE_SCENES).toEqual([SCENE.DIALOGUE, SCENE.EXPLORATION, SCENE.COMBAT]);
        expect(sceneForShortcut('1')).toBe(SCENE.DIALOGUE);
        expect(sceneForShortcut('2')).toBe(SCENE.EXPLORATION);
        expect(sceneForShortcut('3')).toBe(SCENE.COMBAT);
    });

    test('any other key is nobody scene', () => {
        expect(sceneForShortcut('4')).toBeNull();
        expect(sceneForShortcut('a')).toBeNull();
        expect(sceneForShortcut('')).toBeNull();
    });

    test('every switchable scene has a label, an icon and a key', () => {
        for (const scene of SWITCHABLE_SCENES) {
            expect(SCENE_INFO[scene].label).toBeTruthy();
            expect(SCENE_INFO[scene].icon).toMatch(/^fa-/);
            expect(SCENE_INFO[scene].shortcut).toMatch(/^[123]$/);
        }
    });

    test('the description says when a scene has nothing behind it', () => {
        expect(describeScene(SCENE.COMBAT, { combatActive: true })).toBe('Combate [3]');
        expect(describeScene(SCENE.COMBAT, playing)).toContain('nada que mostrar');
    });
});

describe('sceneTransition', () => {
    test('a fight starting moves the screen', () => {
        expect(sceneTransition(playing, { ...playing, combatActive: true })).toBe(SCENE.COMBAT);
    });

    test('a fight ending with the board still open stays on the board', () => {
        const before = { ...playing, boardName: 'Sala', combatActive: true };
        expect(sceneTransition(before, { ...before, combatActive: false })).toBeNull();
    });

    test('leaving the board goes back to the map', () => {
        const before = { ...playing, boardName: 'Sala' };
        expect(sceneTransition(before, { ...playing })).toBe(SCENE.EXPLORATION);
    });

    test('closing the chat goes back to the title screen', () => {
        expect(sceneTransition(playing, { hasChat: false })).toBe(SCENE.TITLE);
    });

    test('nothing changing moves nothing', () => {
        expect(sceneTransition(playing, { ...playing })).toBeNull();
    });
});
