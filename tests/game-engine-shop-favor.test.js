import { describe, test, expect } from '@jest/globals';
import { priceToday } from '../public/scripts/game-engine/campaign/shop.js';

describe('J14.3: lo que rebaja tu gente en la tienda, dicho con su nombre', () => {
    test('Nella os consigue precio: un 10 % menos, y la razón la nombra a ella, no a quien manda', () => {
        const done = priceToday({ base: 50, ruler: 'El concejo', favor: { discount: 0.1, who: 'Nella Tresflechas' } });
        expect(done.price).toBe(45);
        expect(done.reasons).toEqual(['−10 %: Nella Tresflechas os consigue precio']);
    });

    test('sin favor, el precio de siempre y ninguna razón', () => {
        expect(priceToday({ base: 50 })).toEqual({ price: 50, reasons: [] });
        expect(priceToday({ base: 50, favor: { discount: 0, who: 'Nella' } })).toEqual({ price: 50, reasons: [] });
    });

    test('con quien manda que os aprecia y el favor, las dos razones, cada una la suya', () => {
        const done = priceToday({ base: 100, standing: 0.9, ruler: 'El concejo', favor: { discount: 0.1, who: 'Nella' } });
        expect(done.price).toBe(81);
        expect(done.reasons).toEqual(['−10 %: El concejo os aprecia', '−10 %: Nella os consigue precio']);
    });
});
