import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    GUILD_RANKS, campaignRenown, hubRenown, guildRank, campaignRequirement, lockCampaignCards, lockLine, rankNews, rankIndex,
} from '../public/scripts/game-engine/campaign/guild-rank.js';
import { RANKS } from '../public/scripts/game-engine/campaign/contracts.js';
import { hubCampaignCards, withHubCampaign } from '../public/scripts/game-engine/campaign/hub.js';

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const worlds = read('../public/mundos/mundos.json').worlds;
const r1387 = worlds.find((/** @type {any} */ w) => w.id === '1387');
const strahd = worlds.find((/** @type {any} */ w) => w.id === 'strahd');
/** Una campaña de las que empiezan en el 10 (D-J22). */
const veterana = { id: 'tuya-la-torre', name: 'La torre del nigromante', pack: '/user/files/torre.json', levels: [10, 14], imported: true };

describe('J3.7: el rango del gremio', () => {
    test('los umbrales son los del tablón de encargos: el mismo renombre abre las dos cosas', () => {
        expect(GUILD_RANKS.map(r => [r.id, r.min])).toEqual(RANKS.map(r => [r.id, r.minRenown]));
        expect(GUILD_RANKS.every(r => r.label.length > 0)).toBe(true);
    });

    test('sin renombre, recién llegados; y dice cuánto falta para el siguiente', () => {
        const rank = guildRank(0);
        expect(rank).toMatchObject({ id: 'D', label: 'Recién llegados', toNext: 3 });
        expect(rank.line).toBe('Rango D · Recién llegados · 0 de renombre. Para el rango C os faltan 3.');
        expect(guildRank(7).line).toBe('Rango C · Compañía conocida · 7 de renombre. Para el rango B os falta 1.');
        expect(guildRank(99)).toMatchObject({ id: 'S', next: null, toNext: 0 });
        expect(guildRank(99).line).toMatch(/Más arriba no hay nada/);
    });

    test('terminar una campaña da tres y la mitad de su nivel más alto', () => {
        expect(campaignRenown(r1387)).toBe(5);
        expect(campaignRenown(strahd)).toBe(7);
        expect(campaignRenown(veterana)).toBe(10);
        // Sin niveles escritos, como una corta.
        expect(campaignRenown({ id: 'x' })).toBe(4);
    });

    test('el renombre sale de los encargos y de las campañas terminadas, sin apuntar nada más', () => {
        let hub = withHubCampaign(null, '1387', { worldName: '1387 · Tessa', finished: true, ending: 'El valle, libre' });
        hub = withHubCampaign(hub, 'strahd', { worldName: 'Strahd · Tessa', finished: false });
        const got = hubRenown({ guild: { renown: 2 }, hub, worlds });
        expect(got.fromContracts).toBe(2);
        expect(got.fromCampaigns).toEqual([{ id: '1387', name: '1387', renown: 5 }]);
        expect(got.renown).toBe(7);
        // Una que ya no está en el tablón (la quitaste) cuenta igual, con su nombre guardado.
        const gone = withHubCampaign(null, 'tuya-vieja', { worldName: 'Vieja · Tessa', finished: true, name: 'La vieja' });
        expect(hubRenown({ guild: null, hub: gone, worlds }).fromCampaigns).toEqual([{ id: 'tuya-vieja', name: 'La vieja', renown: 4 }]);
    });
});

describe('J3.7: las campañas difíciles se abren con el rango', () => {
    test('lo pide su nivel de entrada, o lo que diga su fila', () => {
        expect(campaignRequirement(r1387)).toBe('D');
        expect(campaignRequirement(strahd)).toBe('D');
        expect(campaignRequirement({ levels: [5, 8] })).toBe('C');
        expect(campaignRequirement(veterana)).toBe('B');
        expect(campaignRequirement({ levels: [17, 20] })).toBe('S');
        expect(campaignRequirement({ levels: [1, 3], rank: 'c' })).toBe('C');
        expect(campaignRequirement({ rank: 'Z', levels: [1, 3] })).toBe('D');
    });

    test('una cerrada sale en el tablón, con lo que falta para abrirla; empezar 1387 no espera a nada', () => {
        const all = [...worlds, veterana];
        const cards = hubCampaignCards({ worlds: all, level: 1 });
        const locked = lockCampaignCards(cards, { renown: 0, worlds: all });
        expect(locked.find(c => c.id === '1387')).toMatchObject({ locked: false, lock: '' });
        const torre = locked.find(c => c.id === 'tuya-la-torre');
        expect(torre).toMatchObject({ locked: true, requires: 'B' });
        expect(torre?.lock).toBe(lockLine('B', 0));
        expect(torre?.lock).toMatch(/Se abre con el rango B del gremio \(Compañía de fiar\)\. Os faltan 8 de renombre/);
    });

    test('terminar 1387 sube el rango, y con Strahd también, se abre la del nivel 10', () => {
        const all = [...worlds, veterana];
        let hub = withHubCampaign(null, '1387', { worldName: 'a', finished: true });
        let renown = hubRenown({ guild: null, hub, worlds: all }).renown;
        expect(guildRank(renown).id).toBe('C');
        expect(lockCampaignCards(hubCampaignCards({ worlds: all, hub }), { renown, worlds: all }).find(c => c.id === 'tuya-la-torre')?.locked).toBe(true);
        hub = withHubCampaign(hub, 'strahd', { worldName: 'b', finished: true });
        renown = hubRenown({ guild: null, hub, worlds: all }).renown;
        expect(guildRank(renown).id).toBe('B');
        expect(lockCampaignCards(hubCampaignCards({ worlds: all, hub }), { renown, worlds: all }).find(c => c.id === 'tuya-la-torre')?.locked).toBe(false);
    });

    test('una que ya empezaste no se cierra nunca', () => {
        const hub = withHubCampaign(null, 'tuya-la-torre', { worldName: 'Torre · Tessa' });
        const cards = hubCampaignCards({ worlds: [veterana], hub });
        expect(lockCampaignCards(cards, { renown: 0, worlds: [veterana] })[0].locked).toBe(false);
    });
});

describe('J3.7: la noticia de subir de rango, una vez', () => {
    test('al subir se cuenta, con las campañas que se abren; y no se repite', () => {
        const all = [...worlds, { ...veterana, levels: [5, 8] }];
        const news = rankNews({ guild: { renown: 0 }, renown: 5, worlds: all });
        expect(news?.rank).toBe('C');
        expect(news?.line).toBe('El gremio sube a rango C: Compañía conocida. En el tablón de campañas se abre una nueva: La torre del nigromante.');
        expect(rankNews({ guild: { rankSeen: 'C' }, renown: 7, worlds: all })).toBeNull();
        expect(rankNews({ guild: {}, renown: 2, worlds: all })).toBeNull();
    });

    test('sin campañas nuevas, dice lo que abre en el tablón de encargos', () => {
        const news = rankNews({ guild: { rankSeen: 'C' }, renown: 9, worlds });
        expect(news?.line).toBe('El gremio sube a rango B: Compañía de fiar. El tablón de encargos ya ofrece trabajos de rango B.');
        expect(rankIndex('b')).toBe(2);
    });
});
