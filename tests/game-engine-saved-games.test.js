import { describe, test, expect } from '@jest/globals';
import {
    listSavedGames, gameCard, describeWhen, playedAt,
} from '../public/scripts/game-engine/campaign/saved-games.js';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const minutesAgo = (/** @type {number} */ n) => new Date(NOW - n * 60000).toISOString();

/** Un chat como lo da `/api/chats/recent` con sus metadatos. */
const chat = (/** @type {string} */ world, /** @type {string} */ file, extra = {}) => ({
    file_name: `${file}.jsonl`,
    avatar: `${file}.png`,
    last_mes: minutesAgo(5),
    chat_metadata: { world_info: world, ...extra },
});

const tessa = [
    { name: 'Tessa', class: 'Guerrero', level: 2 },
    { name: 'Gerd el Mellado', class: 'guerrero', level: 1, guest: true },
];

const worlds = {
    'El Gremio': { name: 'El Gremio', displayName: 'El Gremio', hub: true },
    'La Maldición de Strahd · Tessa': { name: 'La Maldición de Strahd · Tessa', home: 'El Gremio' },
    '1387 · Tessa': { name: '1387 · Tessa', displayName: '1387 · Tessa', home: 'El Gremio' },
    'Mazmorra clásica': { name: 'Mazmorra clásica', displayName: 'La mazmorra de siempre' },
};

describe('J0.6: partidas, no chats', () => {
    test('un gremio y sus campañas son una partida; se sigue donde se quedó', () => {
        const games = listSavedGames({
            chats: [
                chat('La Maldición de Strahd · Tessa', 'strahd', { party: tessa, calendar: { day: 4 }, currentLocation: 'Aldea de Barovia' }),
                chat('Mazmorra clásica', 'mazmorra', { party: [{ name: 'Ulrich', class: 'Paladín', level: 3 }] }),
                chat('El Gremio', 'gremio', { party: tessa }),
                chat('1387 · Tessa', 'ano1387'),
                chat('', 'sin-mundo'),
            ],
            worlds,
        });
        expect(games.map(g => [g.id, g.kind])).toEqual([['El Gremio', 'gremio'], ['Mazmorra clásica', 'campaña']]);
        const guild = games[0];
        expect(guild.chat.file_name).toBe('strahd.jsonl');
        expect(guild.where).toBe('La Maldición de Strahd');
        expect(guild.campaigns).toEqual(['La Maldición de Strahd', '1387']);
    });

    test('la tarjeta del gremio dice dónde está, quién va y a qué nivel, y cuándo se jugó', () => {
        const [guild] = listSavedGames({
            chats: [
                chat('La Maldición de Strahd · Tessa', 'strahd', { party: tessa, calendar: { day: 4 }, currentLocation: 'Aldea de Barovia' }),
                chat('1387 · Tessa', 'ano1387'),
            ],
            worlds,
        });
        const card = gameCard(guild, NOW);
        expect(card).toMatchObject({
            title: 'El Gremio', badge: 'Gremio', icon: 'fa-shield-halved',
            hero: 'Tessa (Guerrero, nivel 2), con Gerd el Mellado',
            line: 'Día 4 · Aldea de Barovia',
            where: 'Ahora en La Maldición de Strahd',
            campaigns: 'Otras campañas: 1387',
            when: 'hace 5 minutos',
            canDelete: false,
        });
        expect(card.resume).toBe('La Maldición de Strahd, desde El Gremio · Tessa (Guerrero, nivel 2), con Gerd el Mellado · Día 4');
    });

    test('en el gremio mismo, sin «ahora en», y sus campañas dichas', () => {
        const [guild] = listSavedGames({
            chats: [chat('El Gremio', 'gremio', { party: tessa }), chat('La Maldición de Strahd · Tessa', 'strahd')],
            worlds,
        });
        const card = gameCard(guild, NOW);
        expect(card.where).toBe('');
        expect(card.campaigns).toBe('Campañas: La Maldición de Strahd');
        expect(card.resume.startsWith('El Gremio · Tessa')).toBe(true);
    });

    test('una campaña del gremio que ya tiene final lo dice', () => {
        const [guild] = listSavedGames({
            chats: [chat('El Gremio', 'gremio', { party: tessa }), chat('La Maldición de Strahd · Tessa', 'strahd', { plotEnding: 'barovia-libre' }), chat('1387 · Tessa', 'ano1387')],
            worlds,
        });
        expect(gameCard(guild, NOW).campaigns).toBe('Campañas: La Maldición de Strahd (terminada), 1387');
    });

    test('una campaña suelta se puede borrar; la terminada lo dice', () => {
        const [game] = listSavedGames({
            chats: [chat('Mazmorra clásica', 'mazmorra', { plotEnding: 'huida' })],
            worlds,
        });
        const card = gameCard(game, NOW);
        expect(card).toMatchObject({ title: 'La mazmorra de siempre', badge: 'Terminada', canDelete: true, kind: 'campaña' });
    });

    test('los mundos sin empezar van al final, y no se repiten', () => {
        const games = listSavedGames({
            chats: [chat('Mazmorra clásica', 'mazmorra')],
            worlds,
            unstarted: [{ name: 'Cripta de Sal', displayName: 'La Cripta de Sal' }, { name: 'Mazmorra clásica' }],
        });
        expect(games.map(g => g.id)).toEqual(['Mazmorra clásica', 'Cripta de Sal']);
        const card = gameCard(games[1], NOW);
        expect(card).toMatchObject({ badge: 'Sin empezar', unstarted: true, when: '', hero: '', canDelete: true, resume: 'La Cripta de Sal' });
    });

    test('una campaña del tablón cuyo gremio ya no tiene chat sigue saliendo, bajo su gremio', () => {
        const games = listSavedGames({ chats: [chat('La Maldición de Strahd · Tessa', 'strahd')], worlds: { 'La Maldición de Strahd · Tessa': worlds['La Maldición de Strahd · Tessa'] } });
        expect(games).toHaveLength(1);
        expect(games[0]).toMatchObject({ id: 'El Gremio', kind: 'gremio', title: 'El Gremio', where: 'La Maldición de Strahd' });
    });
});

describe('cuándo se jugó', () => {
    test('dicho como se dice', () => {
        expect(describeWhen(NOW - 20 * 1000, NOW)).toBe('hace un momento');
        expect(describeWhen(NOW - 60 * 1000, NOW)).toBe('hace 1 minuto');
        expect(describeWhen(NOW - 3 * 3600 * 1000, NOW)).toBe('hace 3 horas');
        expect(describeWhen(NOW - 30 * 3600 * 1000, NOW)).toBe('ayer');
        expect(describeWhen(NOW - 5 * 86400 * 1000, NOW)).toBe('hace 5 días');
        expect(describeWhen(Date.parse('2026-03-03T12:00:00Z'), NOW)).toBe('el 3 de marzo');
        expect(describeWhen(Date.parse('2025-03-03T12:00:00Z'), NOW)).toBe('el 3 de marzo de 2025');
        expect(describeWhen(0, NOW)).toBe('');
    });

    test('la fecha del último mensaje, en número o en texto; sin ella, nada', () => {
        expect(playedAt({ last_mes: 1234 })).toBe(1234);
        expect(playedAt({ last_mes: '2026-09-29T12:00:00.000Z' })).toBe(NOW);
        expect(playedAt({ last_mes: 'ayer por la tarde' })).toBe(0);
        expect(playedAt(null)).toBe(0);
    });
});
