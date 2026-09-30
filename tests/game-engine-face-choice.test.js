/**
 * D-J52: elegir tu cara sin arte (campaign/face-choice.js), y que se guarda en el héroe.
 */

import { describe, test, expect } from '@jest/globals';
import {
    FACE_COLORS, FACE_ICONS, FACE_EMOJIS, readFaceChoice, faceHue, describeFaceChoice,
} from '../public/scripts/game-engine/campaign/face-choice.js';
import { buildHeroEntry } from '../public/scripts/game-engine/campaign/hero.js';

describe('D-J52: la cara sin arte que eliges', () => {
    test('pocas opciones, que se distinguen: ocho colores, dieciséis iconos, dieciséis emojis', () => {
        expect(FACE_COLORS).toHaveLength(8);
        expect(new Set(FACE_COLORS.map(c => c.hue)).size).toBe(8);
        expect(FACE_ICONS).toHaveLength(16);
        expect(FACE_ICONS.every(i => /^fa-[a-z0-9-]+$/.test(i.id) && i.label)).toBe(true);
        expect(FACE_EMOJIS).toHaveLength(16);
        expect(new Set(FACE_EMOJIS).size).toBe(16);
    });

    test('se lee solo lo que está en las listas; lo demás es no haber elegido', () => {
        expect(readFaceChoice({ kind: 'initials', color: 'azul' })).toEqual({ kind: 'initials', color: 'azul' });
        expect(readFaceChoice({ kind: 'initials', color: 'fucsia' })).toEqual({ kind: 'initials' });
        expect(readFaceChoice({ kind: 'icon', icon: 'fa-dragon', color: 'rojo' })).toEqual({ kind: 'icon', icon: 'fa-dragon', color: 'rojo' });
        expect(readFaceChoice({ kind: 'icon', icon: 'fa-inventado' })).toBeNull();
        expect(readFaceChoice({ kind: 'emoji', emoji: '🐉' })).toEqual({ kind: 'emoji', emoji: '🐉' });
        expect(readFaceChoice({ kind: 'emoji', emoji: '🍕' })).toBeNull();
        expect(readFaceChoice(null)).toBeNull();
        expect(readFaceChoice('iniciales')).toBeNull();
    });

    test('el color elegido da su tono; sin elegir, ninguno (sale el del nombre)', () => {
        expect(faceHue('azul')).toBe(215);
        expect(faceHue('')).toBeNull();
    });

    test('se dice en llano', () => {
        expect(describeFaceChoice(null)).toBe('Retrato de tu clase');
        expect(describeFaceChoice({ kind: 'initials', color: 'verde' })).toBe('Iniciales en verde');
        expect(describeFaceChoice({ kind: 'icon', icon: 'fa-dragon', color: 'rojo' })).toBe('Icono: Dragón, en rojo');
        expect(describeFaceChoice({ kind: 'emoji', emoji: '🦊' })).toBe('Emoji 🦊');
    });

    test('lo elegido al crear el personaje se guarda en su ficha del mundo; sin elegir, nada', () => {
        const base = { name: 'Lía', gender: 'Mujer', race: 'Humano', className: 'Guerrero', about: '', image: '' };
        expect(buildHeroEntry({ ...base, face: { kind: 'emoji', emoji: '🐺' } }).dndData.face).toEqual({ kind: 'emoji', emoji: '🐺' });
        expect(buildHeroEntry(base).dndData).not.toHaveProperty('face');
        expect(buildHeroEntry({ ...base, face: { kind: 'raro' } }).dndData).not.toHaveProperty('face');
    });
});
