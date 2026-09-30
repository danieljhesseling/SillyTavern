import { describe, test, expect } from '@jest/globals';
import {
    SCENE, SWITCHABLE_SCENES, SCENE_INFO,
    chooseScene, isSceneAvailable, sceneForShortcut, describeScene, sceneTransition,
    detectSceneEvent, directScene, continueScene,
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

    // Estar en un sitio no es explorar: con una sola localidad y sin mapa, esa pestana
    // abria un mapa de un punto. Explorar pide **a donde ir**.
    test('exploration needs somewhere to go, not just somewhere to be', () => {
        expect(isSceneAvailable(SCENE.EXPLORATION, { locationName: 'Cripta' })).toBe(false);
        expect(isSceneAvailable(SCENE.EXPLORATION, { locationName: 'Cripta', placeCount: 3 })).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { hasWorldMap: true })).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { hasChat: true })).toBe(false);
    });

    // J3.11: en el gremio, de una sola localización, la herrería y la posada son a donde ir.
    test('the town places count as somewhere to go', () => {
        expect(isSceneAvailable(SCENE.EXPLORATION, { locationName: 'Puerto Alba', placeCount: 1, townPlaces: 5 })).toBe(true);
        expect(isSceneAvailable(SCENE.EXPLORATION, { locationName: 'Puerto Alba', placeCount: 1, townPlaces: 0 })).toBe(false);
        expect(isSceneAvailable(SCENE.EXPLORATION, { combatActive: true, townPlaces: 5 })).toBe(false);
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

describe('detectSceneEvent', () => {
    const board = { hasChat: true, locationName: 'Cripta', boardName: 'Sala' };

    test('a fight starting and a fight ending are both events', () => {
        expect(detectSceneEvent(board, { ...board, combatActive: true })).toBe('combat_started');
        expect(detectSceneEvent({ ...board, combatActive: true }, board)).toBe('combat_ended');
    });

    test('opening and leaving a board are events', () => {
        expect(detectSceneEvent(playing, { ...playing, boardName: 'Sala' })).toBe('board_opened');
        expect(detectSceneEvent({ ...playing, boardName: 'Sala' }, playing)).toBe('board_closed');
    });

    // Walking into a room and being ambushed in the same step is one thing, not two.
    test('a fight starting outranks the board that opened underneath it', () => {
        expect(detectSceneEvent(playing, { ...playing, boardName: 'Sala', combatActive: true }))
            .toBe('combat_started');
    });

    test('nothing changing is not an event', () => {
        expect(detectSceneEvent(board, { ...board })).toBeNull();
        expect(detectSceneEvent(board, { ...board, locationName: 'Otra' })).toBeNull();
    });

    test('with nothing to compare against there is no event', () => {
        expect(detectSceneEvent(null, board)).toBeNull();
    });

    // Abrir una partida, nueva o cargada, empieza en la conversación aunque haya un tablero
    // abierto: el narrador es quien te sitúa. Cerrarla no es un suceso dentro de ella.
    test('opening the campaign is an event; closing it is not', () => {
        expect(detectSceneEvent({ hasChat: false }, board)).toBe('game_opened');
        expect(detectSceneEvent({ hasChat: false }, { hasChat: true })).toBe('game_opened');
        expect(detectSceneEvent(board, { hasChat: false })).toBeNull();
    });
});

describe('directScene', () => {
    const board = { hasChat: true, locationName: 'Cripta', boardName: 'Sala' };
    const fight = { ...board, combatActive: true };

    test('a fight starting takes the screen even from a manual pick', () => {
        const choice = directScene(board, fight, SCENE.DIALOGUE);
        expect(choice.scene).toBe(SCENE.COMBAT);
        expect(choice.event).toBe('combat_started');
        expect(choice.reason).toBe('empieza un combate');
    });

    // The reason the event has to become the standing pick: the board is still open, so
    // the next redraw would drag the screen back to the table mid-epilogue.
    test('a fight ending goes to the conversation, and stays there', () => {
        const ended = directScene(fight, board, null);
        expect(ended.scene).toBe(SCENE.DIALOGUE);
        expect(ended.override).toBe(SCENE.DIALOGUE);
        expect(directScene(board, board, ended.override).scene).toBe(SCENE.DIALOGUE);
    });

    test('leaving the board goes back to the map', () => {
        expect(directScene(board, playing, null).scene).toBe(SCENE.EXPLORATION);
    });

    test('and to the conversation when there is no map to go back to', () => {
        expect(directScene({ hasChat: true, boardName: 'Sala' }, { hasChat: true }, null).scene)
            .toBe(SCENE.DIALOGUE);
    });

    test('with nothing happening, the player keeps the last word', () => {
        const choice = directScene(fight, fight, SCENE.DIALOGUE);
        expect(choice.scene).toBe(SCENE.DIALOGUE);
        expect(choice.override).toBe(SCENE.DIALOGUE);
        expect(choice.event).toBeNull();
    });

    test('and a pick that stopped being available is forgotten', () => {
        const choice = directScene(playing, playing, SCENE.COMBAT);
        expect(choice.scene).toBe(SCENE.EXPLORATION);
        expect(choice.override).toBeNull();
    });

    test('being placed on the starting board, just after opening, keeps the conversation', () => {
        const opened = directScene({ hasChat: false }, { hasChat: true }, null);
        const placed = { hasChat: true, locationName: 'El Pueblo de Barro', boardName: 'El cuarto de la posada' };
        expect(detectSceneEvent({ hasChat: true }, placed)).toBeNull();
        expect(directScene({ hasChat: true }, placed, opened.override).scene).toBe(SCENE.DIALOGUE);
        // Entrar en un tablero estando ya en un sitio sí lo abre.
        expect(detectSceneEvent({ hasChat: true, locationName: 'El Pueblo de Barro' }, placed)).toBe('board_opened');
    });

    test('a campaign that opens on a board starts in the conversation, and the board is one key away', () => {
        const opened = directScene({ hasChat: false }, board, null);
        expect(opened.scene).toBe(SCENE.DIALOGUE);
        expect(opened.event).toBe('game_opened');
        // Lo que decide pasa a ser la elección en pie: el siguiente redibujado no vuelve al tablero.
        expect(directScene(board, board, opened.override).scene).toBe(SCENE.DIALOGUE);
        // Y la tecla 3 sigue llevando al tablero.
        expect(directScene(board, board, SCENE.COMBAT).scene).toBe(SCENE.COMBAT);
    });

    test('closing the campaign shows the title screen', () => {
        expect(directScene(board, { hasChat: false }, SCENE.COMBAT).scene).toBe(SCENE.TITLE);
    });
});

// J18.8 de ROADMAP_SIN_CONEXION: sin conexión no hay pestañas; la escena cambia por lo que pasa.
describe('offline: scenes change by actions', () => {
    const town = { hasChat: true, offline: true, chatId: 'gremio', locationName: 'Puerto Alba', townPlaces: 5, story: '3:Llegáis' };
    const pier = { ...town, boardName: 'El muelle' };

    test('new story text goes to the conversation, from the town or from a board', () => {
        const told = directScene(town, { ...town, story: '4:Brunilda' }, SCENE.EXPLORATION);
        expect(told.event).toBe('story_told');
        expect(told.scene).toBe(SCENE.DIALOGUE);
        expect(told.override).toBe(SCENE.DIALOGUE);
        expect(directScene(pier, { ...pier, story: '4:La bodega' }, SCENE.COMBAT).scene).toBe(SCENE.DIALOGUE);
    });

    test('but not in the middle of a fight', () => {
        const fight = { ...pier, combatActive: true };
        expect(detectSceneEvent(fight, { ...fight, story: '9:Tessa golpea' })).toBeNull();
        expect(directScene(fight, { ...fight, story: '9:Tessa golpea' }, SCENE.COMBAT).scene).toBe(SCENE.COMBAT);
    });

    test('text read on entering a board comes first; with nothing to read, the board', () => {
        expect(detectSceneEvent(town, { ...pier, story: '4:El muelle' })).toBe('story_told');
        expect(detectSceneEvent(town, pier)).toBe('board_opened');
    });

    test('with a connection, text does not move the screen: the old rules hold', () => {
        const classic = { hasChat: true, locationName: 'Cripta', hasWorldMap: true, story: '1:a' };
        expect(detectSceneEvent(classic, { ...classic, story: '2:b' })).toBeNull();
    });

    test('another chat, offline, is opening a game: from the guild to a campaign', () => {
        const strahd = { ...pier, chatId: 'strahd', locationName: 'Aldea de Barovia', boardName: 'Taberna' };
        expect(detectSceneEvent(town, strahd)).toBe('game_opened');
        expect(directScene(town, strahd, SCENE.EXPLORATION).scene).toBe(SCENE.DIALOGUE);
        expect(detectSceneEvent({ ...town, offline: false }, { ...strahd, offline: false })).toBe('board_opened');
    });

    test('«Continuar» goes to where you are: the board, or the town, or nowhere', () => {
        expect(continueScene(pier)).toBe(SCENE.COMBAT);
        expect(continueScene({ ...pier, boardName: '', combatActive: true })).toBe(SCENE.COMBAT);
        expect(continueScene(town)).toBe(SCENE.EXPLORATION);
        expect(continueScene({ hasChat: true, offline: true })).toBeNull();
        expect(continueScene({ hasChat: false })).toBeNull();
        // Y lo que decide se queda: el siguiente redibujo no vuelve a la novela.
        expect(directScene(town, town, continueScene(town)).scene).toBe(SCENE.EXPLORATION);
    });

    test('D-J45: after a won fight «Continuar» follows the thread', () => {
        const won = { ...pier, hasWorldMap: true };
        // Una escena o un suceso: se queda en la novela, que es donde salen.
        expect(continueScene({ ...won, afterFight: { kind: 'story', title: '' } })).toBe(SCENE.DIALOGUE);
        // Lo siguiente de la campaña, o el sitio: fuera del tablero, si hay a donde ir.
        expect(continueScene({ ...won, afterFight: { kind: 'next', title: '' } })).toBe(SCENE.EXPLORATION);
        expect(continueScene({ ...won, afterFight: { kind: 'place', title: '' } })).toBe(SCENE.EXPLORATION);
        // Sin a donde ir, el tablero sigue siendo donde se está.
        expect(continueScene({ hasChat: true, offline: true, boardName: 'Bodega', afterFight: { kind: 'place', title: '' } })).toBe(SCENE.COMBAT);
        // Al tablero, al tablero.
        expect(continueScene({ ...won, afterFight: { kind: 'board', title: '' } })).toBe(SCENE.COMBAT);
        // Nada ganado: lo de siempre.
        expect(continueScene({ ...won, afterFight: null })).toBe(SCENE.COMBAT);
    });
});
