import { describe, test, expect } from '@jest/globals';
import { beginChatSwitch, endChatSwitch, isChatSwitching, onChatSwitchEnd } from '../public/scripts/game-engine/ui/shell/chat-switch.js';

describe('chat-switch (H10 de las vueltas: sin portada a medio cambiar de chat)', () => {
    test('se está cambiando entre el principio y el final, y al acabar avisa una vez', () => {
        let told = 0;
        const off = onChatSwitchEnd(() => { told += 1; });
        expect(isChatSwitching()).toBe(false);
        beginChatSwitch();
        expect(isChatSwitching()).toBe(true);
        endChatSwitch();
        expect(isChatSwitching()).toBe(false);
        expect(told).toBe(1);
        off();
    });

    test('dos cambios a la vez: el aviso llega con el último', () => {
        let told = 0;
        const off = onChatSwitchEnd(() => { told += 1; });
        beginChatSwitch();
        beginChatSwitch();
        endChatSwitch();
        expect(isChatSwitching()).toBe(true);
        expect(told).toBe(0);
        endChatSwitch();
        expect(isChatSwitching()).toBe(false);
        expect(told).toBe(1);
        off();
    });

    test('un final de más no deja la cuenta en negativo ni avisa', () => {
        let told = 0;
        const off = onChatSwitchEnd(() => { told += 1; });
        endChatSwitch();
        expect(isChatSwitching()).toBe(false);
        expect(told).toBe(0);
        beginChatSwitch();
        expect(isChatSwitching()).toBe(true);
        endChatSwitch();
        off();
    });

    test('un aviso que falla no impide los demás', () => {
        let told = 0;
        const offA = onChatSwitchEnd(() => { throw new Error('roto'); });
        const offB = onChatSwitchEnd(() => { told += 1; });
        const quiet = console.error;
        console.error = () => {};
        try {
            beginChatSwitch();
            endChatSwitch();
        } finally {
            console.error = quiet;
        }
        expect(told).toBe(1);
        offA();
        offB();
    });
});
