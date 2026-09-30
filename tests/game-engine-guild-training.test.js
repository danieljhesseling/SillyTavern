import { describe, test, expect } from '@jest/globals';
import {
    trainingView, trainSession, sessionXp, topLevel, trainees, levelUpAllowed, GUILD_TRAINING_FACTOR, CATCH_UP_FACTOR, LEVEL_UP_RULES,
} from '../public/scripts/game-engine/campaign/guild-training.js';
import { TRAIN_XP_PER_LEVEL } from '../public/scripts/game-engine/campaign/day-parts.js';

const morning = { day: 3, slotIndex: 0 };
const night = { day: 3, slotIndex: 2 };
const tessa = { id: 1, name: 'Tessa', level: 3, xp: 1000 };
const bran = { id: 2, name: 'Bran', level: 1, xp: 250 };
const gerd = { id: 3, name: 'Gerd el Mellado', level: 3, xp: 0, guest: { kind: 'mercenary' } };

describe('J3.5: entrenar en el patio del gremio', () => {
    test('entrena el grupo, no los de alquiler (esos suben con el héroe al salir)', () => {
        expect(trainees([tessa, bran, gerd, { name: 'Caída', dead: true }]).map(m => m.name)).toEqual(['Tessa', 'Bran']);
    });

    test('con quien enseña, el doble que entrenando solo; y quien va por detrás, el doble otra vez', () => {
        expect(sessionXp(tessa, { top: 3 })).toEqual({ xp: TRAIN_XP_PER_LEVEL * 3 * GUILD_TRAINING_FACTOR, catchUp: false });
        expect(sessionXp(bran, { top: 3 })).toEqual({ xp: TRAIN_XP_PER_LEVEL * 1 * GUILD_TRAINING_FACTOR * CATCH_UP_FACTOR, catchUp: true });
        // Un maestro de armas en casa (idea 37) suma otro tanto.
        expect(sessionXp(tessa, { top: 3, masters: 1 }).xp).toBe(TRAIN_XP_PER_LEVEL * 3 * (GUILD_TRAINING_FACTOR + 1));
    });

    test('el más avanzado cuenta también a los tuyos que descansan en el gremio (J1.6)', () => {
        expect(topLevel([bran], [{ name: 'Iria', level: 4 }])).toBe(4);
        const view = trainingView({ party: [bran], resting: [{ name: 'Iria', level: 4 }], calendar: morning });
        expect(view.rows[0]).toMatchObject({ name: 'Bran', catchUp: true, gain: 100, canLevel: false, nextAt: 300, toNext: 50 });
        expect(view.rows[0].note).toBe('Nivel 1. Le faltan 50 de experiencia para el 2. Va por detrás de los tuyos: aprende el doble.');
        expect(view.resting).toEqual([{ name: 'Iria', level: 4, note: 'Descansa en el gremio. Nivel 4.' }]);
    });

    test('quien ya tiene la experiencia sale para subir de nivel aquí', () => {
        const view = trainingView({ party: [{ ...tessa, xp: 2700 }], calendar: morning });
        expect(view.rows[0]).toMatchObject({ canLevel: true, note: 'Ya tiene la experiencia: puede subir de nivel.' });
    });

    test('una sesión: lo que gana cada uno, y quién puede subir después', () => {
        const done = trainSession({ party: [tessa, bran, gerd], calendar: morning, trainer: 'Brunilda' });
        expect(done.ok).toBe(true);
        expect(done.gains).toEqual([{ id: '1', name: 'Tessa', xp: 150 }, { id: '2', name: 'Bran', xp: 100 }]);
        expect(done.ready).toEqual(['Bran']);
        expect(done.line).toBe('Con Brunilda, entrenáis toda la mañana en el patio del gremio: Tessa +150, Bran +100 de experiencia. Bran ya puede subir de nivel.');
    });

    test('de noche no se entrena, ni peleando, y se dice por qué', () => {
        expect(trainSession({ party: [tessa], calendar: night })).toMatchObject({ ok: false, reason: 'No es cosa de la noche.' });
        expect(trainSession({ party: [tessa], calendar: morning, fighting: true }).reason).toBe('No mientras peleáis.');
        expect(trainSession({ party: [gerd], calendar: morning }).reason).toBe('No hay nadie del grupo que pueda entrenar.');
    });
});

describe('J3.5: dónde se sube de nivel (lo decide Daniel)', () => {
    test('en cualquier sitio, como hasta ahora', () => {
        expect(levelUpAllowed({ inGuild: false })).toEqual({ ok: true, why: '' });
        expect(Object.keys(LEVEL_UP_RULES)).toEqual(['anywhere', 'guild']);
    });

    test('o solo en el gremio', () => {
        expect(levelUpAllowed({ rule: 'guild', inGuild: true }).ok).toBe(true);
        expect(levelUpAllowed({ rule: 'guild', inGuild: false })).toEqual({ ok: false, why: 'Se sube de nivel en el gremio: vuelve y entrena en su patio.' });
    });
});
