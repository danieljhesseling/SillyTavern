import { describe, test, expect } from '@jest/globals';
import {
    normalizeAudioSettings, chooseTrack, describeAudio, AUDIO_SCENES,
} from '../public/scripts/game-engine/ui/shell/scene-audio.js';

describe('los ajustes de sonido', () => {
    test('por defecto está encendido y a media voz', () => {
        const config = normalizeAudioSettings(null);
        expect(config.enabled).toBe(true);
        expect(config.volume).toBe(0.4);
        expect(config.tracks).toEqual({});
    });

    test('el volumen se queda entre 0 y 1, venga como venga', () => {
        expect(normalizeAudioSettings({ volume: 5 }).volume).toBe(1);
        expect(normalizeAudioSettings({ volume: -2 }).volume).toBe(0);
        expect(normalizeAudioSettings({ volume: 'alto' }).volume).toBe(0.4);
    });

    test('una pista vacía es no tener pista', () => {
        const config = normalizeAudioSettings({ tracks: { combat: '   ', dialogue: 'taberna.mp3' } });
        expect(config.tracks.combat).toBeUndefined();
        expect(config.tracks.dialogue).toBe('taberna.mp3');
    });

    test('una escena que no existe no se cuela', () => {
        expect(normalizeAudioSettings({ tracks: { cocina: 'x.mp3' } }).tracks).toEqual({});
    });

    test('las cuatro escenas tienen nombre para los ajustes', () => {
        expect(AUDIO_SCENES.map(s => s.id)).toEqual(['title', 'dialogue', 'exploration', 'town', 'combat']);
        expect(AUDIO_SCENES.every(s => s.label.length > 0)).toBe(true);
    });
});

describe('qué suena en cada escena', () => {
    const settings = { tracks: { combat: 'guerra.mp3', dialogue: 'taberna.mp3' } };

    test('la pista de esa escena, si la has puesto', () => {
        expect(chooseTrack('combat', settings)).toBe('guerra.mp3');
        expect(chooseTrack('dialogue', settings)).toBe('taberna.mp3');
    });

    test('una escena sin pista no hereda la de otra: calla', () => {
        expect(chooseTrack('exploration', settings)).toBeNull();
    });

    test('apagado no suena nada, aunque haya pistas', () => {
        expect(chooseTrack('combat', { ...settings, enabled: false })).toBeNull();
    });

    test('sin ajustes tampoco', () => {
        expect(chooseTrack('combat', null)).toBeNull();
    });
});

describe('contado en una línea', () => {
    test('dice dónde suena y a qué volumen', () => {
        expect(describeAudio({ volume: 0.5, tracks: { combat: 'g.mp3', title: 't.mp3' } }))
            .toBe('Suena en: Menú principal, Combate · volumen 50%.');
    });

    test('sin pistas, lo dice en vez de fingir', () => {
        expect(describeAudio({})).toBe('No has puesto ninguna pista todavía.');
    });

    test('y apagado, también', () => {
        expect(describeAudio({ enabled: false, tracks: { combat: 'g.mp3' } })).toBe('El sonido está apagado.');
    });
});

describe('idea 187: la música del pueblo', () => {
    test('en el pueblo suena su pista; sin ella, la del viaje; y nada si no hay ninguna', () => {
        expect(chooseTrack('town', { enabled: true, tracks: { town: 'plaza.mp3', exploration: 'camino.mp3' } })).toBe('plaza.mp3');
        expect(chooseTrack('town', { enabled: true, tracks: { exploration: 'camino.mp3' } })).toBe('camino.mp3');
        expect(chooseTrack('town', { enabled: true, tracks: {} })).toBeNull();
    });
});
