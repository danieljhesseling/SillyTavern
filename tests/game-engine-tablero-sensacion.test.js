/**
 * Tanda 17, «el tablero se mueve y se lee» (Daniel, 2026-10-02): las fichas andan casilla a
 * casilla en vez de aparecer en otra, el nombre corto debajo de cada ficha, el cartel de quién
 * tiene el turno y la cámara que acompaña a quien anda. Lo que es cuenta; lo que se ve lo prueba
 * el navegador.
 */

import { describe, test, expect } from '@jest/globals';
import {
    MAX_SLIDE_MS, MAX_SLIDE_STEPS, STEP_MS, cellsAhead, planSlide, sameCell, slideDuration, slideFrames, slideLeft, slidePath, stepLine,
} from '../public/scripts/game-engine/ui/combat-vtt/token-slide.js';
import { tokenLabel } from '../public/scripts/game-engine/ui/combat-vtt/token-label.js';
import { shouldAnnounce, turnBannerText } from '../public/scripts/game-engine/ui/combat-vtt/turn-banner.js';
import { isPointShown, panToShow } from '../public/scripts/game-engine/ui/combat-vtt/camera.js';

describe('las fichas andan casilla a casilla', () => {
    test('el camino recto pasa por cada casilla, también en diagonal', () => {
        expect(stepLine({ x: 1, y: 1 }, { x: 4, y: 1 })).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }]);
        expect(stepLine({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]);
        expect(stepLine({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }]);
    });

    test('se anda el camino del juego si sirve; si no, el recto', () => {
        const around = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 0 }];
        expect(slidePath({ x: 0, y: 0 }, { x: 2, y: 0 }, around)).toEqual(around);
        // Un camino que no empieza donde estaba, o que salta casillas, no vale.
        expect(slidePath({ x: 0, y: 0 }, { x: 2, y: 0 }, [{ x: 0, y: 0 }, { x: 2, y: 0 }])).toEqual(stepLine({ x: 0, y: 0 }, { x: 2, y: 0 }));
        expect(slidePath({ x: 0, y: 0 }, { x: 2, y: 0 }, null)).toHaveLength(3);
        expect(slidePath({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
    });

    test('más lejos que un paseo es aparecer en otro sitio: no se anda', () => {
        expect(slidePath({ x: 0, y: 0 }, { x: MAX_SLIDE_STEPS + 1, y: 0 })).toEqual([]);
        expect(slidePath({ x: 0, y: 0 }, { x: MAX_SLIDE_STEPS, y: 0 })).toHaveLength(MAX_SLIDE_STEPS + 1);
    });

    test('deprisa pero a la vista: un paso son 110 ms, un camino largo no pasa de 1,1 s, y sin animaciones, nada', () => {
        expect(slideDuration(6)).toBe(6 * STEP_MS);
        expect(slideDuration(30)).toBeLessThanOrEqual(MAX_SLIDE_MS + 1);
        expect(slideDuration(6, 0.5)).toBe(3 * STEP_MS);
        expect(slideDuration(6, 0)).toBe(0);
        expect(slideDuration(0)).toBe(0);
    });

    test('al redibujar: la primera vez nada; si ha cambiado de casilla, anda desde la de antes', () => {
        expect(planSlide({ before: null, moving: null, to: { x: 3, y: 3 }, now: 0 })).toBeNull();
        expect(planSlide({ before: { x: 3, y: 3 }, moving: null, to: { x: 3, y: 3 }, now: 0 })).toBeNull();
        const slide = planSlide({ before: { x: 1, y: 3 }, moving: null, to: { x: 4, y: 3 }, now: 1000 });
        expect(slide?.cells).toEqual(stepLine({ x: 1, y: 3 }, { x: 4, y: 3 }));
        expect(slide?.start).toBe(1000);
        expect(slide?.duration).toBe(3 * STEP_MS);
        // Con «reducir movimiento», aparece donde va.
        expect(planSlide({ before: { x: 1, y: 3 }, moving: null, to: { x: 4, y: 3 }, now: 0, scale: 0 })).toBeNull();
    });

    test('redibujado a medio camino: sigue por donde iba; si ahora va a otra casilla, sigue desde la que pisa', () => {
        const slide = /** @type {any} */ (planSlide({ before: { x: 0, y: 0 }, moving: null, to: { x: 4, y: 0 }, now: 0 }));
        expect(planSlide({ before: { x: 4, y: 0 }, moving: slide, to: { x: 4, y: 0 }, now: 200 })).toBe(slide);
        expect(slideLeft(slide, 200)).toBe(slide.duration - 200);
        expect(cellsAhead(slide, 0.5 * slide.duration)).toEqual([{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }]);
        const more = planSlide({ before: { x: 4, y: 0 }, moving: slide, to: { x: 4, y: 2 }, now: 0.5 * slide.duration });
        expect(more?.cells).toEqual([{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }]);
        // Acabado, es como si estuviera quieto.
        expect(planSlide({ before: { x: 4, y: 0 }, moving: slide, to: { x: 4, y: 0 }, now: slide.duration + 1 })).toBeNull();
    });

    test('el camino se pide al juego; si falla, el recto', () => {
        const route = () => { throw new Error('sin terreno'); };
        expect(planSlide({ before: { x: 0, y: 0 }, moving: null, to: { x: 2, y: 0 }, now: 0, route })?.cells).toHaveLength(3);
    });

    test('los fotogramas son el centro de cada casilla', () => {
        expect(slideFrames([{ x: 0, y: 0 }, { x: 1, y: 2 }], 44, 44)).toEqual([{ left: '22px', top: '22px' }, { left: '66px', top: '110px' }]);
        expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
        expect(sameCell(null, { x: 1, y: 2 })).toBe(false);
    });
});

describe('el nombre corto debajo de la ficha', () => {
    test('lo que se dice en la mesa: lo que es, con su número; de un título y un nombre, el nombre', () => {
        expect(tokenLabel('Ratero del muelle')).toBe('Ratero');
        expect(tokenLabel('Ratero del muelle 2')).toBe('Ratero 2');
        expect(tokenLabel('Capitana Keller')).toBe('Keller');
        expect(tokenLabel('Alguacil Torres')).toBe('Torres');
        expect(tokenLabel('Laedor')).toBe('Laedor');
        expect(tokenLabel('Mirela (herida)')).toBe('Mirela');
        expect(tokenLabel('')).toBe('');
    });

    test('dos fichas distintas que se quedarían con el mismo nombre corto llevan el entero', () => {
        expect(tokenLabel('Lobo gris', ['Lobo gris', 'Lobo famélico'])).toBe('Lobo gris');
        // La misma cosa dos veces sí se queda corta: «Ratero» y «Ratero 2».
        expect(tokenLabel('Ratero del muelle', ['Ratero del muelle', 'Ratero del muelle 2'])).toBe('Ratero');
        expect(tokenLabel('Ratero del muelle 2', ['Ratero del muelle', 'Ratero del muelle 2'])).toBe('Ratero 2');
    });
});

describe('el cartel de quién tiene el turno', () => {
    test('«Tu turno, Laedor»; el de un enemigo, con su artículo', () => {
        expect(turnBannerText({ name: 'Laedor', side: 'yours' })).toBe('Tu turno, Laedor');
        expect(turnBannerText({ name: 'Ratero del muelle', side: 'enemy' })).toBe('Turno del ratero del muelle');
        expect(turnBannerText({ name: 'Bruja del pantano', side: 'enemy' })).toBe('Turno de la bruja del pantano');
        // Con un nombre propio dentro se queda como está, como en el resto del juego (`withArticle`).
        expect(turnBannerText({ name: 'Guardia de Montesclaros', side: 'enemy' })).toBe('Turno de Guardia de Montesclaros');
        expect(turnBannerText({ name: 'Alguacil Torres', side: 'enemy' })).toBe('Turno de Alguacil Torres');
        expect(turnBannerText({ name: 'Mirela', side: 'ally' })).toBe('Turno de Mirela');
        expect(turnBannerText({ name: '', side: 'yours' })).toBe('Tu turno');
    });

    test('se anuncia una vez por turno', () => {
        expect(shouldAnnounce('1:7', '')).toBe(true);
        expect(shouldAnnounce('1:7', '1:7')).toBe(false);
        expect(shouldAnnounce('', '1:7')).toBe(false);
        expect(shouldAnnounce('2:7', '1:7')).toBe(true);
    });
});

describe('la cámara acompaña a quien anda', () => {
    const rect = { left: 0, top: 0, right: 800, bottom: 600 };
    const view = { scale: 1, offsetX: 0, offsetY: 0 };

    test('si se ve con holgura, no se mueve', () => {
        expect(panToShow(view, { x: 400, y: 300 }, rect, 100)).toEqual(view);
    });

    test('cerca del borde, se mueve lo justo para dejar el margen', () => {
        const moved = panToShow(view, { x: 790, y: 300 }, rect, 100);
        expect(moved).toEqual({ scale: 1, offsetX: -90, offsetY: 0 });
        expect(isPointShown(moved, { x: 790, y: 300 }, rect, 100)).toBe(true);
        expect(panToShow({ scale: 2, offsetX: 0, offsetY: 0 }, { x: 10, y: 10 }, rect, 50)).toEqual({ scale: 2, offsetX: 30, offsetY: 30 });
    });

    test('en una vista sin sitio para el margen, al centro', () => {
        expect(panToShow(view, { x: 0, y: 0 }, { left: 0, top: 0, right: 100, bottom: 100 }, 80)).toEqual({ scale: 1, offsetX: 50, offsetY: 50 });
    });
});
