import { describe, test, expect } from '@jest/globals';
import { stripEngineTags, tagLength } from '../public/scripts/game-engine/ui/shell/engine-tags.js';

// J18.10 de ROADMAP_SIN_CONEXION: en la caja de la novela, solo la prosa.
describe('stripEngineTags', () => {
    test('the tag at the start of a line goes, with its emoji', () => {
        expect(stripEngineTags('🗣️ [DUELO] Yshriel habla con Madre Elvira: no cede.')).toBe('Yshriel habla con Madre Elvira: no cede.');
        expect(stripEngineTags('[VIAJE] Salís de Puerto Alba hacia el este.')).toBe('Salís de Puerto Alba hacia el este.');
        expect(stripEngineTags('🗡️ [SE UNE AL GRUPO] Gerd va contigo.')).toBe('Gerd va contigo.');
        expect(stripEngineTags('🔮 [HILO] El presagio: «Una adivina os echará las cartas.»')).toBe('El presagio: «Una adivina os echará las cartas.»');
    });

    test('the «Hecho:» note of the thread is the Diario, not the scene', () => {
        const note = '[HILO] Hecho: Una charla con Tomás.\nMientras habláis, llega Brunilda.';
        expect(stripEngineTags(note)).toBe('Mientras habláis, llega Brunilda.');
        expect(stripEngineTags('[HILO] Hecho: El ratero del muelle.')).toBe('');
        expect(stripEngineTags('[HILO] Hecho: A.\nHecho: B.\nLa bodega espera.')).toBe('La bodega espera.');
    });

    test('prose is left alone: brackets in the middle, lowercase, or no tag', () => {
        expect(stripEngineTags('Tessa ataca [con ventaja] a la rata.')).toBe('Tessa ataca [con ventaja] a la rata.');
        expect(stripEngineTags('[nota] esto no es del motor')).toBe('[nota] esto no es del motor');
        expect(stripEngineTags('⚔️ Tessa golpea: 7 de daño.')).toBe('⚔️ Tessa golpea: 7 de daño.');
        expect(stripEngineTags('')).toBe('');
        expect(stripEngineTags(null)).toBe('');
    });

    test('tagLength measures only a tag at the very start', () => {
        expect(tagLength('📜 [HILO] Se cierra el acto 1.')).toBe('📜 [HILO] '.length);
        expect(tagLength('Se cierra [HILO]')).toBe(0);
    });
});
