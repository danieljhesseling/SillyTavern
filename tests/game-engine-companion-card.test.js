import { describe, test, expect } from '@jest/globals';
import {
    buildCompanionCard, judgeGift,
} from '../public/scripts/game-engine/ui/shell/companion-card.js';

const lyra = (over = {}) => ({ id: 7, name: 'Lyra', hp: 12, maxHp: 20, level: 3, ...over });

describe('lo que le parece un regalo', () => {
    test('sin gustos declarados, nada da puntos', () => {
        const verdict = judgeGift({ member: lyra(), item: { name: 'Espada corta' } });
        expect(verdict.event).toBeNull();
        expect(verdict.points).toBe(0);
        expect(verdict.line).toBe('Lyra guarda Espada corta y da las gracias.');
    });

    test('lo que le gusta suma, y se nota en la frase', () => {
        const verdict = judgeGift({
            member: lyra({ likes: ['libros'] }),
            item: { name: 'Libros de la torre' },
        });
        expect(verdict.event).toBe('gift_liked');
        expect(verdict.points).toBe(4);
        expect(verdict.line).toMatch(/se le ilumina/);
    });

    test('los gustos valen tambien por categoria', () => {
        const verdict = judgeGift({
            member: lyra({ likes: 'magia' }),
            item: { name: 'Vara torcida', category: 'magia' },
        });
        expect(verdict.event).toBe('gift_liked');
    });

    test('lo que le disgusta resta, y manda sobre lo que le gusta', () => {
        const verdict = judgeGift({
            member: lyra({ likes: ['espada'], dislikes: ['sangre'] }),
            item: { name: 'Espada con sangre seca' },
        });
        expect(verdict.event).toBe('gift_disliked');
        expect(verdict.points).toBe(-2);
    });
});

describe('la ficha del companero', () => {
    test('trae su nombre y su rango', () => {
        const card = buildCompanionCard({ member: lyra() });
        expect(card.name).toBe('Lyra');
        expect(card.rankLabel).toMatch(/Rango/);
    });

    test('ofrece pasar tiempo y regalar, ademas de lo de siempre', () => {
        const card = buildCompanionCard({ member: lyra(), giverItems: [{ name: 'Manzana' }] });
        const ids = card.actions.map(a => a.id);
        expect(ids[0]).toBe('downtime');
        expect(ids[1]).toBe('gift');
        expect(ids.some(id => id.startsWith('event:'))).toBe(true);
    });

    test('pasar tiempo dice lo que cuesta', () => {
        const card = buildCompanionCard({ member: lyra() });
        expect(card.actions[0].why).toBe('Gasta un bloque del día y suma 2 al vínculo');
    });

    test('sin nada que dar, regalar esta apagado y lo explica', () => {
        const card = buildCompanionCard({ member: lyra(), giverItems: [] });
        expect(card.actions[1].enabled).toBe(false);
        expect(card.actions[1].why).toBe('No llevas nada que dar.');
    });

    test('peleando no se pasa el rato ni se regala', () => {
        const card = buildCompanionCard({
            member: lyra(), fighting: true, giverItems: [{ name: 'Manzana' }],
        });
        expect(card.actions[0].enabled).toBe(false);
        expect(card.actions[1].enabled).toBe(false);
        expect(card.actions[0].why).toBe('No mientras peleas.');
    });

    test('cada regalo trae ya juzgado lo que va a pasar', () => {
        const card = buildCompanionCard({
            member: lyra({ likes: ['manzana'] }),
            giverItems: [{ name: 'Manzana' }, { name: 'Piedra' }],
        });
        expect(card.gifts.map(g => g.verdict.points)).toEqual([4, 0]);
    });

    test('anotar lo que ha pasado sigue estando, con sus puntos', () => {
        const card = buildCompanionCard({ member: lyra() });
        const events = card.actions.filter(a => a.id.startsWith('event:'));
        expect(events.length).toBeGreaterThan(0);
        expect(events.every(e => typeof e.points === 'number')).toBe(true);
        expect(events[0].why).toMatch(/al vínculo/);
    });
});

describe('subir de nivel desde su ficha', () => {
    test('cuando toca, va primero: es lo unico que cambia los numeros de la pelea', () => {
        const card = buildCompanionCard({ member: lyra(), canLevel: true });
        expect(card.actions[0].id).toBe('level');
        expect(card.actions[0].label).toBe('Subir de nivel');
    });

    test('y cuando no toca, no aparece', () => {
        const card = buildCompanionCard({ member: lyra() });
        expect(card.actions.map(a => a.id)).not.toContain('level');
    });
});
