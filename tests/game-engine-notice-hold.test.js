import { describe, test, expect } from '@jest/globals';
import {
    noticeWaits, heldTimeout, waitingOptions, centerCardUp, holdNotice, CENTER_CARDS, HELD_CLASS,
} from '../public/scripts/game-engine/ui/shell/notice-hold.js';

describe('H18: los avisos esperan a la tarjeta del centro', () => {
    test('esperan con el Modo Juego y una tarjeta delante; los errores, nunca', () => {
        expect(noticeWaits({ kind: 'success', shellOpen: true, cardUp: true })).toBe(true);
        expect(noticeWaits({ kind: 'info', shellOpen: true, cardUp: true })).toBe(true);
        expect(noticeWaits({ kind: 'error', shellOpen: true, cardUp: true })).toBe(false);
        expect(noticeWaits({ kind: 'info', shellOpen: true, cardUp: false })).toBe(false);
        expect(noticeWaits({ kind: 'info', shellOpen: false, cardUp: true })).toBe(false);
    });

    test('al soltarlo dura lo suyo, lo de toastr o cinco segundos; cero es «hasta cerrarlo»', () => {
        expect(heldTimeout({ timeOut: 15000 }, { timeOut: 4000 })).toBe(15000);
        expect(heldTimeout({}, { timeOut: 4000 })).toBe(4000);
        expect(heldTimeout(undefined, undefined)).toBe(5000);
        expect(heldTimeout({ timeOut: 0 }, { timeOut: 4000 })).toBe(0);
    });

    test('mientras espera no se va solo, y lo demás de la llamada se queda', () => {
        expect(waitingOptions({ timeOut: 8000, onclick: 'x' })).toEqual({ timeOut: 0, extendedTimeOut: 0, onclick: 'x' });
        expect(waitingOptions(undefined)).toEqual({ timeOut: 0, extendedTimeOut: 0 });
    });

    test('las tarjetas del centro: la victoria, el final, el Salón de la fama y el grupo caído', () => {
        expect(CENTER_CARDS).toMatch(/\.vs-card/);
        expect(CENTER_CARDS).toMatch(/\.end-root/);
        expect(CENTER_CARDS).toMatch(/\.hall-root/);
        // Y las conversaciones de novela visual, que son modales: un aviso debajo no se ve.
        expect(CENTER_CARDS).toMatch(/dialog\[open\]\.qd-dialog/);
        /** @type {string[]} */
        const asked = [];
        const up = /** @type {any} */ ({ querySelector: (/** @type {string} */ s) => { asked.push(s); return {}; } });
        const down = /** @type {any} */ ({ querySelector: () => null });
        expect(centerCardUp(up)).toBe(true);
        expect(asked).toEqual([CENTER_CARDS]);
        expect(centerCardUp(down)).toBe(false);
    });

    test('un aviso que espera lleva su clase (escondido); sin aviso, no pasa nada', () => {
        const classes = new Set();
        const el = { addClass: (/** @type {string} */ c) => classes.add(c) };
        holdNotice(el, 5000);
        expect(classes.has(HELD_CLASS)).toBe(true);
        expect(() => holdNotice(undefined, 5000)).not.toThrow();
    });
});
