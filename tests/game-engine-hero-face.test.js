/**
 * J1.7 y J1.8: la ficha dice en qué campañas has estado, y tu cara sin arte son tus iniciales
 * en tu color (ui/hero-face.js).
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import { faceOf, initialsColors } from '../public/scripts/game-engine/ui/hero-face.js';
import { setPixelManifest } from '../public/scripts/game-engine/ui/pixel-art.js';
import { campaignRows } from '../public/scripts/game-engine/ui/shell/character-sheet.js';

afterEach(() => setPixelManifest(null));

describe('tu cara sin arte (J1.8)', () => {
    test('la tuya, si la subiste', () => {
        expect(faceOf({ name: 'Lía', avatar: 'user-avatars/lia.png', className: 'Mago' })).toMatchObject({ kind: 'own', src: 'user-avatars/lia.png' });
    });

    test('sin cara subida, tu retrato en pixel si tu clase lo tiene', () => {
        setPixelManifest({ files: ['retratos/heroes/mago-mujer.png'] });
        const face = faceOf({ name: 'Lía', avatar: 'img/user-default.png', className: 'Mago', gender: 'Mujer' });
        expect(face.kind).toBe('pixel');
        expect(face.src).toMatch(/retratos\/heroes\/mago-mujer\.png$/);
    });

    test('sin ninguno (una clase del taller), tus iniciales, siempre en el mismo color', () => {
        setPixelManifest({ files: ['retratos/heroes/mago-mujer.png'] });
        const face = faceOf({ name: 'Gerd el Mellado', avatar: '', className: 'Viajero' });
        expect(face).toMatchObject({ kind: 'initials', src: '', initials: 'GM' });
        expect(faceOf({ name: 'Gerd el Mellado' }).hue).toBe(face.hue);
        expect(faceOf({ name: 'Nella' }).hue).not.toBe(face.hue);
    });

    test('los colores, del mismo tono: fondo oscuro y borde claro', () => {
        expect(initialsColors(200)).toEqual({ background: 'hsl(200, 42%, 26%)', border: 'hsl(200, 55%, 58%)' });
        expect(initialsColors(999).background).toBe('hsl(359, 42%, 26%)');
    });
});

describe('en qué campañas has estado (J1.7)', () => {
    const hall = [
        { kind: 'campaign', name: 'La Maldición de Strahd', world: 'strahd-lia', ending: 'Barovia, libre', party: ['Lía', 'Gerd'] },
        { kind: 'campaign', name: '1387', world: '1387-otro', ending: 'La corona', party: ['Osric'] },
        { name: 'Tessa', world: 'strahd-lia', day: 12, epitaph: 'Cayó en la cripta.' },
    ];

    test('sin nada, nada', () => {
        expect(campaignRows({ name: 'Lía' })).toEqual([]);
    });

    test('la de ahora primero; las apuntadas, terminadas o a medias; y las del salón en que fue', () => {
        const rows = campaignRows({
            name: 'Lía',
            now: { name: '1387', world: '1387-lia' },
            seen: [{ name: 'La Maldición de Strahd', world: 'strahd-lia' }, { name: 'El bosque', world: 'bosque-lia' }, { name: '1387', world: '1387-lia' }],
            hall,
        });
        expect(rows.map(r => r.line)).toEqual([
            '1387: ahora mismo',
            'La Maldición de Strahd: terminada, con «Barovia, libre»',
            'El bosque: a medias',
        ]);
    });

    test('una terminada que no tenía apuntada (partidas de antes) sale igual; la de otro, no', () => {
        const rows = campaignRows({ name: 'Gerd', hall });
        expect(rows.map(r => r.line)).toEqual(['La Maldición de Strahd: terminada, con «Barovia, libre»']);
    });
});
