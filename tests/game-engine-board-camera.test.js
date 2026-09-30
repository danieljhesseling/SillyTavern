import { describe, test, expect } from '@jest/globals';
import {
    READABLE_CELL_PX, isLargeBoard, fogOnFor, readableScale, centerOn, isInView,
} from '../public/scripts/game-engine/board/board-camera.js';

describe('J12.13: qué tablero es grande', () => {
    test('los de los paquetes de hoy no; un mapa de mazmorra entero, sí', () => {
        expect(isLargeBoard(22, 13)).toBe(false);
        expect(isLargeBoard(20, 12)).toBe(false);
        expect(isLargeBoard(36, 25)).toBe(true);
        expect(isLargeBoard(40, 28)).toBe(true);
        expect(isLargeBoard(25, 20)).toBe(true);
    });

    test('la niebla: lo que diga el tablero; sin decirlo, en los grandes', () => {
        expect(fogOnFor({}, 40, 28)).toBe(true);
        expect(fogOnFor({}, 16, 9)).toBe(false);
        expect(fogOnFor({ fogEnabled: false }, 40, 28)).toBe(false);
        expect(fogOnFor({ fogEnabled: true }, 16, 9)).toBe(true);
        expect(fogOnFor(null, 40, 28)).toBe(true);
    });
});

describe('J12.13: el acercamiento con el que se juega', () => {
    test('si encuadrado entero las casillas se leen, se ve entero', () => {
        expect(readableScale({ fitScale: 1, cellPx: 44 })).toEqual({ scale: 1, partial: false });
    });

    test('si no, se acerca hasta que una casilla mide lo legible, y se ve por partes', () => {
        const got = readableScale({ fitScale: 0.34, cellPx: 44 });
        expect(got.partial).toBe(true);
        expect(got.scale * 44).toBeCloseTo(READABLE_CELL_PX);
    });

    test('sin pasarse del acercamiento máximo', () => {
        expect(readableScale({ fitScale: 0.1, cellPx: 2, maxScale: 6 }).scale).toBe(6);
    });
});

describe('J12.13: la cámara sigue al grupo', () => {
    // Un tablero de 40 × 28 casillas de 44 px, visto a 0,64 en una vista de 700 × 420.
    const view = { cellW: 44, cellH: 44, scale: 0.64, viewW: 700, viewH: 420, boardW: 40 * 44, boardH: 28 * 44 };

    test('centrar en una casilla del medio la deja en el centro', () => {
        const at = centerOn({ ...view, cell: { x: 20, y: 14 } });
        expect(at.offsetX + 20.5 * 44 * 0.64).toBeCloseTo(350);
        expect(at.offsetY + 14.5 * 44 * 0.64).toBeCloseTo(210);
    });

    test('junto al borde no enseña lo de fuera del tablero', () => {
        const corner = centerOn({ ...view, cell: { x: 0, y: 0 } });
        expect(corner).toEqual({ offsetX: 0, offsetY: 0 });
        const far = centerOn({ ...view, cell: { x: 39, y: 27 } });
        expect(far.offsetX).toBeCloseTo(700 - 40 * 44 * 0.64);
        expect(far.offsetY).toBeCloseTo(420 - 28 * 44 * 0.64);
    });

    test('un tablero más pequeño que la vista se queda centrado', () => {
        const small = centerOn({ ...view, boardW: 10 * 44, boardH: 5 * 44, cell: { x: 9, y: 4 } });
        expect(small.offsetX).toBeCloseTo((700 - 440 * 0.64) / 2);
    });

    test('una casilla cerca del borde de la vista ya no «se ve bien»; en el centro, sí', () => {
        const at = centerOn({ ...view, cell: { x: 20, y: 14 } });
        expect(isInView({ ...view, ...at, cell: { x: 20, y: 14 } })).toBe(true);
        expect(isInView({ ...view, ...at, cell: { x: 32, y: 14 } })).toBe(false);
        expect(isInView({ ...view, ...at, cell: { x: 20, y: 22 } })).toBe(false);
    });
});
