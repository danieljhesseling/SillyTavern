/**
 * Cierre de wiki/ROADMAP_ENTRETENIDO.md (2026-10-04): las caras que salían con silueta y el
 * rótulo del vínculo que se cortaba junto al borde del tablero.
 *
 * - La clase en femenino («picara», «Clériga») encuentra el retrato de relleno de la suya.
 * - En una charla, quien habla y está en un hueco conserva su clase (Iria Salitre, la pícara de
 *   los dormitorios, salía con silueta porque su nombre suelto pisaba su ficha).
 * - La gente de las misiones de los mercenarios (E4.3): el salteador lleva el dibujo del bandido,
 *   y nadie se llama como alguien con retrato.
 * - El rótulo «Vínculo 3 · …» (E3.2) se queda dentro del tablero.
 */

import { describe, test, expect } from '@jest/globals';
import { readManifest, firstArt } from '../public/scripts/game-engine/ui/pixel-art.js';
import { bindCast } from '../public/scripts/game-engine/campaign/cast-scenes.js';
import { mercQuestFor, mercAskScene } from '../public/scripts/game-engine/campaign/merc-quests.js';
import { bondBannerFit } from '../public/scripts/game-engine/ui/combat-vtt/fx.js';

const manifest = readManifest({
    files: ['retratos/heroes/picaro-mujer.png', 'retratos/heroes/clerigo-hombre.png', 'bestias/bandido-del-camino.png'],
});
const url = (/** @type {string} */ file) => `img/game-engine/pixel/${file}`;

/** @param {number} seed */
function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

describe('la clase en femenino busca el retrato de la suya', () => {
    test('por su id o por cómo se escribe', () => {
        expect(firstArt('hero', { classId: 'picara', gender: 'Mujer' }, manifest)).toBe(url('retratos/heroes/picaro-mujer.png'));
        expect(firstArt('hero', { classId: 'Pícara', gender: 'Mujer' }, manifest)).toBe(url('retratos/heroes/picaro-mujer.png'));
        expect(firstArt('hero', { className: 'pícara', gender: 'Mujer' }, manifest)).toBe(url('retratos/heroes/picaro-mujer.png'));
        expect(firstArt('hero', { classId: 'clériga', gender: 'Mujer' }, manifest)).toBe(url('retratos/heroes/clerigo-hombre.png'));
    });

    test('una clase que no es de las diez, como antes', () => {
        expect(firstArt('hero', { classId: 'viajero' }, manifest)).toBe('');
    });
});

describe('quien habla en una charla conserva su ficha', () => {
    test('Iria Salitre, en el hueco y hablando, sigue siendo pícara', () => {
        const iria = { id: 'r1', name: 'Iria Salitre', class: 'pícara', gender: 'Mujer' };
        const hero = { id: 'h', name: 'Aldo' };
        const scene = bindCast({ row: mercAskScene({ id: 'merc-iria-salitre', title: 'Lo suyo', ask: 'Ayúdame.' }), kind: 'pareja', slots: { a: iria }, hero, party: [hero, iria] });
        const cast = scene.cast.find(c => c.name === 'Iria Salitre');
        expect(cast).toMatchObject({ className: 'pícara', gender: 'Mujer' });
        expect(firstArt('hero', { className: cast?.className, gender: cast?.gender, name: cast?.name }, manifest)).toBe(url('retratos/heroes/picaro-mujer.png'));
    });
});

describe('la gente de las misiones de los mercenarios (E4.3)', () => {
    const member = { id: 'm1', name: 'Bruna Piedrahita', gender: 'f', class: 'guerrero' };

    test('el salteador de la venganza lleva el dibujo del bandido del camino', () => {
        const quest = mercQuestFor({ member, wants: 'blood', random: seeded(7) });
        const scene = quest.row.steps.find((/** @type {any} */ s) => s.kind === 'escena');
        const villain = scene.beats[1].who;
        expect(scene.faces).toEqual({ [villain]: 'bandido-del-camino' });
        expect(firstArt('creature', { id: scene.faces[villain] }, manifest)).toBe(url('bestias/bandido-del-camino.png'));
    });

    test('el primo, el prestamista y quien pica piedra dicen qué retrato les toca', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const herencia = mercQuestFor({ member, wants: 'coin', random: seeded(seed) }).row.steps.find((/** @type {any} */ s) => s.kind === 'escena');
            const cousin = herencia.beats[1].who;
            expect(herencia.faces[cousin]).toMatch(/^(el-primo|la-prima)$/);
            const rescate = mercQuestFor({ member, wants: 'quiet', random: seeded(seed) }).row.steps.find((/** @type {any} */ s) => s.kind === 'escena');
            expect(rescate.faces[rescate.beats[2].who]).toBe('el-prestamista');
            expect(Object.keys(rescate.faces)).toContain(rescate.beats[1].who);
            for (const id of Object.values(rescate.faces)) expect(id).toMatch(/^(el-prestamista|la-hermana-de-la-cantera|campesino-desesperado)$/);
        }
    });

    test('nadie se llama como alguien con retrato (Elvira, Brígida)', () => {
        for (let seed = 1; seed <= 300; seed++) {
            for (const wants of ['coin', 'blood', 'quiet']) {
                const quest = mercQuestFor({ member, wants, random: seeded(seed) });
                const said = JSON.stringify(quest);
                expect(said).not.toMatch(/Elvira|Brígida/);
            }
        }
    });
});

describe('el rótulo del vínculo, dentro del tablero (E3.2)', () => {
    const area = { left: 0, top: 0, right: 600, bottom: 400 };
    const box = (/** @type {number} */ x, /** @type {number} */ y) => ({ left: x, top: y, right: x + 50, bottom: y + 50 });

    test('en medio, centrado y debajo de la ficha', () => {
        expect(bondBannerFit({ token: box(275, 150), area, width: 180, height: 20 })).toEqual({ dx: 0, up: false });
    });

    test('pegado a la izquierda o a la derecha, se corre hacia dentro', () => {
        // La ficha en x 0-50: el rótulo de 180 empezaría en -65; con el margen de 4, se corre 69.
        expect(bondBannerFit({ token: box(0, 150), area, width: 180, height: 20 })).toEqual({ dx: 69, up: false });
        expect(bondBannerFit({ token: box(550, 150), area, width: 180, height: 20 })).toEqual({ dx: -69, up: false });
    });

    test('en la fila de abajo, encima de la ficha', () => {
        expect(bondBannerFit({ token: box(275, 350), area, width: 180, height: 20 })).toEqual({ dx: 0, up: true });
    });

    test('con zum, lo que se corre va en los píxeles de la ficha', () => {
        expect(bondBannerFit({ token: box(0, 150), area, width: 180, height: 20, scale: 2 })).toEqual({ dx: 35, up: false });
    });

    test('si no cabe ni encima, se queda debajo', () => {
        expect(bondBannerFit({ token: { left: 275, top: 0, right: 325, bottom: 400 }, area, width: 180, height: 20 }).up).toBe(false);
    });
});
