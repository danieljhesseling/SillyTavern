import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import {
    readEpilogues, factionEpilogues, endingEpilogues, partyAtStart, readPartyStart, takeHome, campaignHallEntry, homecomingScene,
} from '../public/scripts/game-engine/campaign/campaign-end.js';
import { addToHall, readHall, describeHallEntry, describeHallCount } from '../public/scripts/game-engine/campaign/legacy.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import { hubCampaignCards, withHubCampaign } from '../public/scripts/game-engine/campaign/hub.js';
import { splitModelNote } from '../public/scripts/game-engine/campaign/model-note.js';
import { companionEpilogues } from '../public/scripts/game-engine/campaign/epilogues.js';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('J4.5: qué fue de la gente al acabar', () => {
    test('los epílogos del paquete se leen con tolerancia: frase suelta o {who, text}', () => {
        expect(readEpilogues(['Ireena duerme tranquila.', { who: 'Ismark', text: 'Ismark manda.' }, { who: 'Nadie' }, 3]))
            .toEqual([{ who: '', text: 'Ireena duerme tranquila.' }, { who: 'Ismark', text: 'Ismark manda.' }]);
        expect(readEpilogues(null)).toEqual([]);
    });

    test('sin epílogos escritos, salen de las facciones que se notan, las más marcadas primero', () => {
        const lines = factionEpilogues([
            { name: 'Los Vistani', reputation: 4 },
            { name: 'La corte de Strahd', reputation: -5 },
            { name: 'Los Guardianes de la Pluma', reputation: 1 },
            { name: 'La Orden del Dragón de Plata', reputation: 0 },
            { name: 'Los Hijos de la Madre Noche', reputation: -1 },
        ]);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Con La corte de Strahd quedáis como enemigos: mejor no volver a cruzaros.');
        expect(lines[1]).toMatch(/^Con Los Vistani quedáis como amigos/);
        expect(lines.join(' ')).not.toMatch(/Dragón de Plata/);
    });

    test('los escritos mandan; si no hay, los de las facciones', () => {
        const factions = [{ name: 'Los Vistani', reputation: 2 }];
        expect(endingEpilogues({ ending: { epilogues: [{ who: 'Eva', text: 'Eva se va.' }] }, factions })).toEqual(['Eva se va.']);
        expect(endingEpilogues({ ending: { title: 'Fin' }, factions })).toEqual(['Con Los Vistani quedáis en buenos términos.']);
        expect(endingEpilogues({ ending: null })).toEqual([]);
    });

    test('el hilo guarda los epílogos de cada final; y los finales sin ellos quedan como estaban', () => {
        const plot = readPlot({
            milestones: [{ id: 'a', title: 'A', changes: { ending: 'bien' } }],
            endings: {
                bien: { title: 'Bien', scene: 'Acaba bien.', epilogues: ['Todos contentos.', { who: 'X', text: '' }] },
                mal: { title: 'Mal', scene: 'Acaba mal.' },
            },
        });
        expect(plot?.endings.bien.epilogues).toEqual([{ who: '', text: 'Todos contentos.' }]);
        expect(plot?.endings.mal).toEqual({ title: 'Mal', scene: 'Acaba mal.' });
    });

    test('Strahd trae epílogos en cada final, y el hilo los lee', () => {
        const pack = read('../public/mundos/strahd.pack.json');
        const endings = Object.entries(readPlot(pack.plot).endings);
        expect(endings).toHaveLength(3);
        expect(endings.map(([id, ending]) => [id, ending.epilogues.length >= 3])).toEqual(endings.map(([id]) => [id, true]));
        // Sin la marca de texto propio: la quita la herramienta al montar el paquete.
        const texts = endings.flatMap(([, ending]) => ending.epilogues.map(e => e.text));
        expect(texts.filter(t => /^propio:/.test(t))).toEqual([]);
    });
});

describe('J4.5: lo que se lleva cada uno', () => {
    const start = partyAtStart([
        { id: 1, name: 'Tessa', level: 1, xp: 100, gold: 60, items: [{ id: 'espada', name: 'Espada larga', rarity: 'Rare' }] },
        { id: 2, name: 'Gerd', level: 1, xp: 0, gold: 0, items: [] },
    ], 3);

    test('cómo empezó se apunta y se relee con tolerancia', () => {
        expect(start).toEqual({
            day: 3,
            party: [
                { id: '1', name: 'Tessa', level: 1, xp: 100, gold: 60, items: ['espada'] },
                { id: '2', name: 'Gerd', level: 1, xp: 0, gold: 0, items: [] },
            ],
        });
        expect(readPartyStart(null)).toBeNull();
        expect(readPartyStart({ party: [{ name: '' }, { name: 'X', level: 'no' }] })?.party).toEqual([
            { id: '', name: 'X', level: 1, xp: 0, gold: 0, items: [] },
        ]);
    });

    test('con cómo empezó: lo ganado aquí, y lo que merece nombrarse, las reliquias primero', () => {
        const party = [
            {
                id: 1, name: 'Tessa', level: 3, xp: 900, gold: 215, items: [
                    { id: 'espada', name: 'Espada larga', rarity: 'Rare' },
                    { id: 'cuerda', name: 'Cuerda', rarity: 'Common' },
                    { id: 'capa', name: 'Capa élfica', rarity: 'Uncommon' },
                    { id: 'sol', name: 'Espada del Sol', rarity: 'Rare', relic: true },
                ],
            },
            { id: 2, name: 'Gerd', level: 3, xp: 800, gold: 0, guest: { kind: 'mercenary' }, items: [] },
            { id: 3, name: 'Bran', level: 2, dead: true, items: [] },
            { id: 4, name: 'La niña', guest: { kind: 'ward' }, items: [] },
        ];
        const take = takeHome({ party, start });
        expect(take.map(t => t.name)).toEqual(['Tessa', 'Gerd']);
        expect(take[0]).toMatchObject({ level: 3, levels: 2, xpGained: 800, goldGained: 155, items: ['Espada del Sol', 'Capa élfica'] });
        expect(take[0].line).toBe('Tessa: nivel 3 (sube 2), 900 de experiencia (+800) y 215 de oro (+155). Se lleva: Espada del Sol, Capa élfica.');
        // Sin oro no se dice nada del oro.
        expect(take[1].line).toBe('Gerd: nivel 3 (sube 2) y 800 de experiencia (+800).');
        // Ni de la experiencia, si no tiene: un mercenario no la gana.
        expect(takeHome({ party: [{ id: 9, name: 'Nella', level: 2, guest: { kind: 'mercenary' } }] })[0].line).toBe('Nella: nivel 2.');
    });

    test('sin cómo empezó (una campaña de antes), lo que tiene; y lo que no cabe va en «y N más»', () => {
        const items = ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({ id: name, name, rarity: 'Very Rare' }));
        const [only] = takeHome({ party: [{ id: 1, name: 'Tessa', level: 2, xp: 300, gold: 10, items }] });
        expect(only.line).toBe('Tessa: nivel 2, 300 de experiencia y 10 de oro. Se lleva: A, B, C, D y 2 más.');
    });
});

describe('J3.9: la campaña terminada, en el salón de la fama', () => {
    const party = [
        { id: 1, name: 'Tessa' },
        { id: 2, name: 'Gerd el Mellado', guest: { kind: 'mercenary' } },
        { id: 3, name: 'Bran', dead: true },
        { id: 4, name: 'La niña', guest: { kind: 'ward' } },
    ];
    const entry = campaignHallEntry({
        campaign: 'La Maldición de Strahd', world: 'La Maldición de Strahd · Tessa', ending: 'Barovia, libre', party,
        graves: [{ name: 'Bran' }, { name: 'Lyra' }], day: 34, when: '2026-09-29T10:00:00Z', mode: 'Clásico',
    });

    test('dice cuál, con qué final, quién fue (y quién no volvió) y cuándo', () => {
        expect(entry).toEqual({
            kind: 'campaign', name: 'La Maldición de Strahd', world: 'La Maldición de Strahd · Tessa', day: 34, epitaph: '',
            when: '2026-09-29T10:00:00Z', ending: 'Barovia, libre',
            party: ['Tessa', 'Gerd el Mellado', 'Bran', 'Lyra'], fallen: ['Bran', 'Lyra'], mode: 'Clásico',
        });
        expect(describeHallEntry(readHall([entry])[0])).toBe(
            'La Maldición de Strahd: terminada con «Barovia, libre». Fueron Tessa, Gerd el Mellado, Bran y Lyra. '
            + 'No volvieron: Bran y Lyra. (2026-09-29 · 34 días)');
    });

    test('entra arriba, una vez por partida y final, y no toca a los caídos', () => {
        let hall = addToHall(null, { name: 'Aldara', world: '1387', day: 20, epitaph: 'Aldara.', when: '' });
        hall = addToHall(hall, entry);
        hall = addToHall(hall, { ...entry, when: '2026-10-01T10:00:00Z', day: 40 });
        expect(hall.map(e => e.name)).toEqual(['La Maldición de Strahd', 'Aldara']);
        expect(hall[0].when).toBe('2026-09-29T10:00:00Z');
        // Otra partida de la misma campaña es otra fila.
        hall = addToHall(hall, { ...entry, world: 'La Maldición de Strahd · Bruna' });
        expect(hall.filter(e => e.kind === 'campaign')).toHaveLength(2);
        // Un caído con el mismo nombre que una campaña no la pisa.
        hall = addToHall(hall, { name: 'La Maldición de Strahd', world: 'La Maldición de Strahd · Tessa', day: 34, epitaph: 'X.', when: '' });
        expect(hall.filter(e => e.kind === 'campaign')).toHaveLength(2);
        expect(describeHallCount(hall)).toBe('2 campañas terminadas · 2 caídos');
        expect(describeHallCount([])).toBe('');
    });
});

describe('J4.5: la vuelta al gremio', () => {
    test('la escena dice cómo acabó, y brinda por quien no vuelve', () => {
        const scene = homecomingScene({ campaign: 'La Maldición de Strahd', ending: 'Barovia, libre', home: 'Puerto Alba', fallen: ['Bran'] });
        expect(scene).toBe('En Puerto Alba ya se sabe cómo acabó La Maldición de Strahd: Barovia, libre. '
            + 'Os reciben con la primera ronda pagada, y en el tablón su papel ya está marcado como terminado. Se brinda también por Bran, que no volvió.');
        // Sin comillas: el chat pinta lo entrecomillado como diálogo.
        expect(scene).not.toMatch(/[«"]/);
        expect(homecomingScene({ campaign: 'X', ending: '' })).toBe('');
        expect(homecomingScene({ campaign: '', ending: 'Fin', home: 'el gremio' })).toMatch(/^En el gremio ya se sabe cómo acabó la campaña: Fin\./);
    });

    test('quien sigue vivo vuelve contigo: su epílogo no dice que se marchó', () => {
        const party = [{ id: 1, name: 'Tessa' }, { id: 2, name: 'Gerd el Mellado', motive: 'coin' }, { id: 3, name: 'Lyra' }, { id: 4, name: 'Bran', dead: true }];
        const away = companionEpilogues({ party, ranks: { 3: 9 }, ending: 'Barovia, libre' });
        const back = companionEpilogues({ party, ranks: { 3: 9 }, ending: 'Barovia, libre', home: true });
        expect(away[0]).toMatch(/^Gerd el Mellado (cobró|contó)/);
        expect(back[0]).toMatch(/^Gerd el Mellado .*vuelve contigo al gremio/);
        expect(back[1]).toMatch(/Lyra.*gremio/);
        // Quien cayó no vuelve, con gremio o sin él.
        expect(back[2]).toBe('Bran no llegó a ver el final.');
    });

    test('en pantalla sale entera: no se confunde con la orden al narrador', () => {
        const scene = homecomingScene({ campaign: 'La Maldición de Strahd', ending: 'Barovia, libre', home: 'Puerto Alba' });
        const { said } = splitModelNote(`[GREMIO] ${scene} Cuéntalo en dos o tres frases, en el tono de la campaña. No inventes nada que no esté aquí.`);
        expect(said).toBe(`[GREMIO] ${scene}`);
    });

    test('en el tablón, una terminada dice su final y se vuelve a ella', () => {
        const worlds = [{ id: 'strahd', name: 'La Maldición de Strahd', pack: '/mundos/strahd.pack.json', levels: [1, 6] }];
        const hub = withHubCampaign({}, 'strahd', { worldName: 'La Maldición de Strahd · Tessa', finished: true, ending: 'Barovia, libre' });
        expect(hubCampaignCards({ worlds, hub })[0]).toMatchObject({ state: 'terminada', action: 'Volver', ending: 'Barovia, libre' });
    });
});
