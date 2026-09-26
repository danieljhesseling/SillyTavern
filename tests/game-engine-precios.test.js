import { describe, test, expect } from '@jest/globals';
import { seasonalMarket, magicStance, priceKind, SEASON_PRICES, MAGIC_TRADE } from '../public/scripts/game-engine/campaign/season-market.js';
import { readFaction } from '../public/scripts/game-engine/campaign/factions.js';
import { getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

describe('T4: la estación y la magia, en los precios', () => {
    const component = { subcategory: 'component' };

    test('qué clase de cosa es cada objeto', () => {
        expect(priceKind('Raciones de viaje', {})).toBe('comida');
        expect(priceKind('Manta de lana', {})).toBe('abrigo');
        expect(priceKind('Ámbar', component)).toBe('componente');
        expect(priceKind('Espada larga', { category: 'weapon' })).toBe('');
    });

    test('en invierno la comida y el abrigo suben; en otoño hay cosecha; en verano nadie quiere mantas', () => {
        expect(seasonalMarket({ name: 'Raciones de viaje', season: 'invierno' })).toEqual({ factor: SEASON_PRICES.invierno.comida, reasons: ['en invierno la comida escasea'], banned: false });
        expect(seasonalMarket({ name: 'Raciones de viaje', season: 'otono' }).factor).toBe(0.9);
        expect(seasonalMarket({ name: 'Manta de lana', season: 'verano' }).reasons).toEqual(['en verano nadie quiere mantas']);
        expect(seasonalMarket({ name: 'Espada larga', season: 'invierno' })).toEqual({ factor: 1, reasons: [], banned: false });
    });

    test('donde persiguen la magia no se venden componentes; donde es negocio, salen más baratos', () => {
        expect(seasonalMarket({ name: 'Ámbar', spec: component, magic: 'persigue', ruler: 'El Templo' })).toEqual({ factor: 1, reasons: ['aquí El Templo persigue la magia: no se vende'], banned: true });
        expect(seasonalMarket({ name: 'Ámbar', spec: component, magic: 'comercia' }).factor).toBe(MAGIC_TRADE);
        expect(seasonalMarket({ name: 'Ámbar', spec: component, magic: 'tolera' }).factor).toBe(1);
    });

    test('cómo ve la magia una facción: lo que diga; si no, sus etiquetas; si nada, tolera', () => {
        expect(magicStance({ magia: 'comercia', tags: ['fe'] })).toBe('comercia');
        expect(magicStance({ tags: ['fe', 'orden'] })).toBe('persigue');
        expect(magicStance({ tags: ['secreto', 'fe'] })).toBe('tolera');
        expect(magicStance({ tags: ['arcano', 'secreto'] })).toBe('comercia');
        expect(magicStance(null)).toBe('tolera');
    });

    test('la facción guarda cómo ve la magia y sus etiquetas, y el paquete lo puede decir', () => {
        const faction = readFaction({ id: 'templo', name: 'El Templo', magia: 'persigue', tags: ['fe', 'orden'] });
        expect(faction).toMatchObject({ magia: 'persigue', tags: ['fe', 'orden'] });
        expect(readFaction({ id: 'x', magia: 'quemar' }).magia).toBe('');
        const world = /** @type {any} */ (getSectionSchema('world'));
        expect(world.properties.factions.items.properties.magia.enum).toEqual(['persigue', 'tolera', 'comercia']);
    });
});
