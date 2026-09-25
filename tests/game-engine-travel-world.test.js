import { describe, test, expect } from '@jest/globals';
import { paceDays, paceEvents, readPace, isSetback, resolveSetback, setbackChoice, FORCE_DC } from '../public/scripts/game-engine/world/travel-choices.js';
import { shiftFortune, fortuneOf, fortuneLine, FORTUNE_LIMIT } from '../public/scripts/game-engine/world/fortune.js';
import { queueNews, deliverNews, NEWS_MAX_AGE } from '../public/scripts/game-engine/world/news.js';

describe('travel-choices', () => {
    test('el ritmo cambia los días, nunca por debajo de uno', () => {
        expect(paceDays(4, 'rapido')).toBe(3);
        expect(paceDays(4, 'normal')).toBe(4);
        expect(paceDays(4, 'cauteloso')).toBe(5);
        expect(paceDays(1, 'rapido')).toBe(1);
        expect(readPace('volando')).toBe('normal');
    });

    test('con cuidado se esquiva la mitad de los contratiempos, no los atajos', () => {
        const events = [
            { name: 'Puente caído', days: 1, note: '' },
            { name: 'Crecida', days: 2, note: '' },
            { name: 'Atajo', days: -1, note: '' },
        ];
        const dice = [0.1, 0.9];
        const out = paceEvents(events, 'cauteloso', () => /** @type {number} */ (dice.shift()));
        expect(out.avoided).toEqual(['Puente caído']);
        expect(out.events.map(e => e.name)).toEqual(['Crecida', 'Atajo']);
        expect(paceEvents(events, 'rapido', () => 0).events).toHaveLength(3);
    });

    test('un contratiempo: rodear cuesta, forzar puede salir o doler', () => {
        const event = { name: 'Crecida', days: 2, note: 'El río va crecido.' };
        expect(isSetback(event)).toBe(true);
        expect(setbackChoice(event).force).toContain(`CD ${FORCE_DC}`);
        expect(resolveSetback(event, 'detour')).toEqual({ days: 2, note: 'El río va crecido. Dais un rodeo.', hurt: 0 });
        expect(resolveSetback(event, 'force', { success: true, who: 'Bruna', hurt: 0 }).days).toBe(0);
        const bad = resolveSetback(event, 'force', { success: false, who: 'Bruna', hurt: 4 });
        expect(bad).toMatchObject({ days: 2, hurt: 4 });
        expect(bad.note).toMatch(/Bruna intenta forzar el paso, no sale y se lleva 4 de daño/);
    });
});

describe('fortune', () => {
    const village = { name: 'El Pueblo de Barro', locationType: 'village' };
    const services = ['posada', 'herreria', 'tablon'];

    test('dos encargos cumplidos abren algo, una sola vez', () => {
        let step = shiftFortune(village, 1, services);
        expect(step.change).toBe('');
        step = shiftFortune(step.location, 1, services);
        expect(step.change).toMatch(/han abierto una tienda/);
        expect(step.location.services).toContain('tienda');
        const again = shiftFortune(step.location, 1, step.location.services);
        expect(again.change).toBe('');
    });

    test('dos plazos perdidos cierran algo, y el tablón es lo último', () => {
        let step = shiftFortune(village, -1, services);
        step = shiftFortune(step.location, -1, services);
        expect(step.change).toMatch(/ha cerrado una herrería/);
        expect(step.location.services).toEqual(['posada', 'tablon']);
    });

    test('tiene tope, y una línea para la exploración', () => {
        let loc = village;
        for (let i = 0; i < 10; i++) loc = shiftFortune(loc, 1, []).location;
        expect(fortuneOf(loc)).toBe(FORTUNE_LIMIT);
        expect(fortuneLine(loc)).toMatch(/Os deben mucho/);
        expect(fortuneLine(village)).toBe('');
    });
});

describe('news', () => {
    const events = [
        { kind: 'avanza', faction: 'vane', target: 'El Molino', note: 'Vane toma el molino.' },
        { kind: 'quieto', faction: 'x', target: '', note: 'Nada.' },
        { kind: 'avanza', faction: 'vane', target: 'Aquí', note: 'Ya se oyó.' },
    ];

    test('se guarda lo que no se oyó, sin lo quieto ni lo ya contado', () => {
        const pending = queueNews(null, events, ['Ya se oyó.'], 3);
        expect(pending.map(n => n.note)).toEqual(['Vane toma el molino.']);
    });

    test('al llegar se cuenta lo que se oye desde allí, y sale de la lista', () => {
        const pending = queueNews(null, events, [], 3);
        const out = deliverNews(pending, list => list.filter(n => n.target === 'El Molino').map(n => n.note), 5);
        expect(out.told).toEqual(['Hace 2 día(s): Vane toma el molino.']);
        expect(out.pending.map(n => n.note)).toEqual(['Ya se oyó.']);
    });

    test('lo viejo ya no es noticia', () => {
        const pending = queueNews(null, events, [], 1);
        expect(deliverNews(pending, list => list.map(n => n.note), 2 + NEWS_MAX_AGE).told).toEqual([]);
    });
});
