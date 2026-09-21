import { describe, test, expect } from '@jest/globals';
import {
    CHANNEL, NARRATOR_TYPE, buildGameMessage, reachesModel,
} from '../public/scripts/game-engine/ui/chat-channel.js';

// The defect this module exists for: the combat epilogue was built, posted, shown to the
// player, and filtered out of the prompt. Nothing threw. These tests assert the outcome
// that was missing — whether the model reads it — not the flag that implements it.
describe('who a game message reaches', () => {
    test('a message for the model is not a system message, so the prompt keeps it', () => {
        const message = buildGameMessage({ text: 'El grupo vence a 3 goblins', channel: CHANNEL.MODEL });
        expect(message.is_system).toBe(false);
        expect(reachesModel(message)).toBe(true);
    });

    test('a message for the player only is a system message, so a whole combat stays free', () => {
        const message = buildGameMessage({ text: 'Ronda 3', channel: CHANNEL.PLAYER });
        expect(message.is_system).toBe(true);
        expect(reachesModel(message)).toBe(false);
    });

    // An unknown channel must not silently become the expensive one.
    test('anything that is not the model channel is treated as player-only', () => {
        for (const channel of ['', 'sistema', undefined, null, 'MODEL']) {
            expect(reachesModel(buildGameMessage({ text: 'x', channel }))).toBe(false);
        }
    });
});

describe('the shape SillyTavern renders', () => {
    test('carries the fields the renderer reads, mirroring /sys', () => {
        const message = buildGameMessage({
            text: 'Combate terminado',
            channel: CHANNEL.MODEL,
            name: 'Narrador',
            avatar: 'img/five.png',
            timestamp: '2026-09-21T10:00:00.000Z',
        });

        expect(message).toMatchObject({
            name: 'Narrador',
            is_user: false,
            send_date: '2026-09-21T10:00:00.000Z',
            mes: 'Combate terminado',
            force_avatar: 'img/five.png',
        });
        expect(message.extra.type).toBe(NARRATOR_TYPE);
        expect(message.extra.isSmallSys).toBe(true);
    });

    test('trims the text, because a stray newline shows up as an empty bubble', () => {
        expect(buildGameMessage({ text: '  hola  \n', channel: CHANNEL.MODEL }).mes).toBe('hola');
    });

    test('junk text does not produce a broken message', () => {
        for (const text of [null, undefined, 123]) {
            const message = buildGameMessage({ text, channel: CHANNEL.MODEL });
            expect(typeof message.mes).toBe('string');
        }
    });

    test('defaults are usable when the caller passes only text and channel', () => {
        const message = buildGameMessage({ text: 'x', channel: CHANNEL.MODEL });
        expect(message.name).toBe('Narrador');
        expect(typeof message.send_date).toBe('string');
        expect(typeof message.force_avatar).toBe('string');
    });
});

describe('reachesModel', () => {
    test('reads the same flag the prompt filter reads', () => {
        expect(reachesModel({ is_system: false })).toBe(true);
        expect(reachesModel({ is_system: true })).toBe(false);
    });

    // A message with no flag at all is what an old saved chat can hold.
    test('a message without the flag is not assumed to reach the model', () => {
        expect(reachesModel({})).toBe(false);
        expect(reachesModel(null)).toBe(false);
        expect(reachesModel(undefined)).toBe(false);
    });
});
