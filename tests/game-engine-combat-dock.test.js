/**
 * J12.20 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md): el muelle
 * táctico. Dónde va (`dockPlace`), lo justo que se aparta la cámara para que no tape ninguna ficha
 * (`dockNudge`) y las teclas de sus tarjetas (la del propio menú lo cierra).
 */

import { describe, test, expect } from '@jest/globals';
import { DOCK, dockNudge, dockPlace, overlaps } from '../public/scripts/game-engine/ui/combat-vtt/dock.js';
import { cardKeyAt, cardKeys } from '../public/scripts/game-engine/ui/combat-vtt/action-menus.js';

/** El tablero de 1280 × 720 debajo de una cabecera de 75 px. */
const BOARD_720 = { left: 0, top: 75, right: 1280, bottom: 720 };
const BOARD_1080 = { left: 0, top: 75, right: 1920, bottom: 1080 };

describe('dónde va el muelle (dockPlace)', () => {
    test('a 1280 × 720: a la izquierda, 360 px, 175 px por abajo y 50 por debajo de la cabecera', () => {
        const place = dockPlace({ board: BOARD_720, head: 75, viewportH: 720 });
        expect(place.left).toBe(24);
        expect(place.right - place.left).toBe(DOCK.width);
        expect(BOARD_720.bottom - place.bottom).toBe(175);
        expect(place.top).toBe(125);
        expect(place.maxHeight).toBe(420);
    });

    test('a 1920 × 1080: más alto, pero nunca más que el alto de la ventana menos 250', () => {
        const place = dockPlace({ board: BOARD_1080, head: 75, viewportH: 1080 });
        expect(place.maxHeight).toBe(Math.min(1080 - 250, 905 - 125));
        expect(place.top).toBeGreaterThanOrEqual(125);
        expect(1080 - place.bottom).toBeGreaterThanOrEqual(170);
    });

    test('con la columna de la cámara a su altura, va a su lado: la cámara no se tapa', () => {
        const camera = { left: 12, top: 400, right: 48, bottom: 562 };
        const place = dockPlace({ board: BOARD_720, head: 75, viewportH: 720, camera });
        expect(place.left).toBe(48 + DOCK.cameraGap);
        expect(overlaps(place, camera)).toBe(false);
    });

    test('una cámara que queda por debajo del muelle no lo mueve', () => {
        const camera = { left: 12, top: 600, right: 48, bottom: 700 };
        expect(dockPlace({ board: BOARD_720, head: 75, viewportH: 720, camera }).left).toBe(24);
    });

    test('sin sitio, al menos 160 px de alto', () => {
        expect(dockPlace({ board: { left: 0, top: 75, right: 800, bottom: 400 }, head: 75, viewportH: 400 }).maxHeight).toBe(DOCK.minHeight);
    });
});

describe('la cámara se aparta lo justo (dockNudge)', () => {
    const dock = { left: 58, top: 125, right: 418, bottom: 545 };
    const view = { left: 0, top: 75, right: 960, bottom: 720 };
    const token = (/** @type {number} */ left, /** @type {number} */ top, key = false) => ({ left, top, right: left + 50, bottom: top + 50, key });

    test('sin fichas debajo, no se mueve', () => {
        expect(dockNudge({ dock, view, tokens: [token(500, 300), token(700, 200)] })).toBe(0);
    });

    test('una ficha debajo: el tablero se corre a la derecha hasta dejarla a 12 px del muelle', () => {
        const shift = dockNudge({ dock, view, tokens: [token(278, 280, true), token(482, 212)] });
        expect(shift).toBe(418 + 12 - 278);
    });

    test('si correrlo tanto esconde otra por la derecha, solo lo que piden las que importan', () => {
        // Quien juega bajo el muelle; otra ficha casi en el borde derecho.
        const shift = dockNudge({ dock, view, tokens: [token(380, 280, true), token(880, 300)] });
        // Para todas harían falta 50 px y por la derecha caben 30: se mira a quien importa (y su sitio).
        expect(shift).toBe(50);
    });

    test('las que ya no se ven no cuentan', () => {
        expect(dockNudge({ dock, view, tokens: [token(100, 800)] })).toBe(0);
    });

    test('en el teléfono, la hoja: el tablero sube lo justo para que el objetivo se vea encima', () => {
        const sheet = { left: 4, top: 301, right: 386, bottom: 706 };
        const phone = { left: 0, top: 140, right: 390, bottom: 712 };
        const shift = dockNudge({ dock: sheet, view: phone, tokens: [token(140, 420, true), token(112, 390)], axis: 'y' });
        expect(shift).toBe(-(470 - (301 - 12)));
        expect(dockNudge({ dock: sheet, view: phone, tokens: [token(140, 200)], axis: 'y' })).toBe(0);
    });
});

describe('las teclas del muelle', () => {
    test('la del propio menú lo cierra: sus tarjetas llevan las demás', () => {
        expect(cardKeys('1')).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
        expect(cardKeys('3')).toEqual([1, 2, 4, 5, 6, 7, 8, 9]);
        expect(cardKeyAt(0, '1')).toBe(2);
        expect(cardKeyAt(2, '3')).toBe(4);
        expect(cardKeyAt(8, '1')).toBe(0);
        expect(cardKeyAt(-1, '1')).toBe(0);
        expect(cardKeyAt(0)).toBe(1);
    });
});
