/**
 * J12.7: las peleas de taberna y los duelos, sin muertes. La regla dentro del combate (quien cae
 * queda fuera de combate, puños, sin magia que hiere, el rival que se rinde), el tablero de la
 * taberna, quién busca pelea y quién reta, y lo que se gana o se pierde por honor o por apuesta.
 */

import { afterEach, describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    FURNITURE_PRICE, FIST_REACH_FEET, STAKES, readBrawl, brawlOf, knockOut, knockOutLine, wakeUp, isLethalAbility,
    brawlRefusal, fistsFor, wantsToYield, countFurniture, brokenFurniture, verdictOf, brawlBoard, rowdyCount,
    rivalFighters, isWatching, standingFighters,
} from '../public/scripts/game-engine/combat/brawl.js';
import {
    BRAWLS_KEY, HONOR_FAME, ROUND_PRICE, FED_UP_DAYS, readFightRows, fillLine, fightLine, noteBrawl, fedUpUntil, happened,
    challengedLately, rowdyNow, championOf, rowdyBand, tavernActions, stakesFor, challengerFor, brawlOutcome, refuseHonor,
    dayPartLabel,
} from '../public/scripts/game-engine/campaign/tavern-brawl.js';
import { terrainFromAsciiMap, isPassable } from '../public/scripts/game-engine/board/terrain.js';
import { boardBiome } from '../public/scripts/game-engine/ui/pixel-art.js';
import { DOMAINS, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import { DEEDS, addMark, readEchoes, rememberedGreeting, markRumors } from '../public/scripts/game-engine/campaign/world-marks.js';
import { normalizeEncounter } from '../public/scripts/game-engine/combat/turn-machine.js';
import { STATE_KEYS } from '../public/scripts/game-engine/campaign/state-registry.js';
import { getAttackRangeFeet, getPlayerDamageFormula } from '../public/scripts/party/combat-rules.js';
import { setCombatEncounter } from '../public/scripts/party/state.js';

const json = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const peleas = json('compendio/peleas.json');
const echoes = json('compendio/ecos.json').rows;
const rows = readFightRows(peleas.rows);

/** Un azar fijo: siempre el mismo número. */
const always = (/** @type {number} */ n) => () => n;

const tavern = (/** @type {any} */ extra = {}) => /** @type {import('../public/scripts/game-engine/combat/brawl.js').Brawl} */ (readBrawl({
    kind: 'taberna', started: 'ellos', rival: 'Bruno el Tuerto', town: 'Puerto Alba', tavern: 'La taberna', board: 'Pelea en la taberna',
    furniture: 9, rivals: 3, ...extra,
}));
const duel = (/** @type {any} */ extra = {}) => /** @type {import('../public/scripts/game-engine/combat/brawl.js').Brawl} */ (readBrawl({
    kind: 'duelo', way: 'apuesta', stake: 10, rival: 'Rosa la Remera', town: 'Puerto Alba', tavern: 'La taberna', board: 'Duelo en la taberna',
    furniture: 14, rivals: 1, watching: ['2', '3'], ...extra,
}));

describe('J12.7: la bandera de la pelea', () => {
    test('se lee con sus valores por defecto, y lo que no es una pelea sin muertes no lo es', () => {
        expect(readBrawl(null)).toBeNull();
        expect(readBrawl({ kind: 'a muerte' })).toBeNull();
        expect(readBrawl({ kind: 'taberna' })).toMatchObject({ kind: 'taberna', started: 'ellos', way: '', stake: 0, watching: [], back: '' });
        expect(readBrawl({ kind: 'duelo', watching: [2, '3'] })).toMatchObject({ kind: 'duelo', way: 'apuesta', started: '', watching: ['2', '3'] });
        expect(brawlOf({ active: true, brawl: { kind: 'duelo', way: 'honor' } })?.way).toBe('honor');
        expect(brawlOf({ active: false, brawl: { kind: 'duelo' } })).toBeNull();
        expect(brawlOf({ active: true })).toBeNull();
    });

    test('el combate guardado la conserva al recargar', () => {
        const saved = normalizeEncounter({ active: true, enemies: [], turnOrder: [{ id: '1', name: 'Mara' }], brawl: { kind: 'taberna' } });
        expect(saved.brawl).toEqual({ kind: 'taberna' });
        expect(normalizeEncounter({ active: true, enemies: [], turnOrder: [] })).not.toHaveProperty('brawl');
    });

    test('quien mira un duelo no pelea: no cuenta entre los que siguen en pie', () => {
        const encounter = { active: true, brawl: duel() };
        expect(isWatching(encounter, 2)).toBe(true);
        expect(isWatching(encounter, '1')).toBe(false);
        const party = [{ id: 1, hp: 0 }, { id: 2, hp: 10 }, { id: 3, hp: 8 }, { id: 4, hp: 5, dead: true }];
        expect(standingFighters(party, duel())).toEqual([]);
        expect(standingFighters(party, tavern()).map(m => m.id)).toEqual([2, 3]);
    });
});

describe('J12.7: nadie muere', () => {
    test('caer a 0 es quedar fuera de combate: estable desde el primer momento, sin salvaciones y sin morir', () => {
        const down = knockOut({ hp: 0, activeConditions: ['Prone'] });
        expect(down).toEqual({ hp: 0, deathSaves: { successes: 0, failures: 0, stable: true, dead: false }, activeConditions: ['Prone', 'Unconscious'] });
        expect(knockOut({ hp: 0, activeConditions: ['Unconscious'] }).activeConditions).toEqual(['Unconscious']);
        expect(knockOutLine('Mara')).toMatch(/Mara cae redondo.*fuera de combate\. Aquí nadie muere\./);
    });

    test('al acabar, quien quedó fuera de combate se levanta con 1 PG; quien sigue en pie o está muerto, no cambia', () => {
        expect(wakeUp({ hp: 0, activeConditions: ['Unconscious', 'Prone'] })).toEqual({
            hp: 1, deathSaves: { successes: 0, failures: 0, stable: false, dead: false }, activeConditions: ['Prone'],
        });
        expect(wakeUp({ hp: 4 })).toBeNull();
        expect(wakeUp({ hp: 0, dead: true })).toBeNull();
    });

    test('la magia que hiere no vale; la que cura, protege o duerme, sí', () => {
        const fire = { name: 'Rayo de fuego', target: 'enemy', damage: '1d10' };
        const wave = { name: 'Onda atronadora', target: 'self', damage: '2d8', area: { shape: 'radius' } };
        expect(isLethalAbility(fire)).toBe(true);
        expect(isLethalAbility(wave)).toBe(true);
        expect(isLethalAbility({ name: 'Curar heridas', target: 'ally', healing: '1d8' })).toBe(false);
        expect(isLethalAbility({ name: 'Dormir', target: 'enemy', condition: 'Unconscious' })).toBe(false);
        expect(brawlRefusal(fire, tavern())).toMatch(/^En una pelea de taberna no vale Rayo de fuego: aquí se pega con los puños\./);
        expect(brawlRefusal(fire, duel())).toMatch(/^En un duelo a puñetazos no vale/);
        expect(brawlRefusal(fire, null)).toBe('');
    });

    test('los puños: a la casilla de al lado, y más fuertes con el nivel', () => {
        expect(FIST_REACH_FEET).toBe(5);
        expect([1, 4, 5, 8, 9, 20].map(fistsFor)).toEqual(['1d4', '1d4', '1d6', '1d6', '1d8', '1d8']);
    });

    describe('dentro del combate (combat-rules.js lee la bandera)', () => {
        afterEach(() => setCombatEncounter({ active: false, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 0, turnState: null }));
        const archer = { level: 5, class: 'ranger', equippedItems: { weapon: 'w' }, items: [{ id: 'w', name: 'Longbow' }] };

        test('sin pelea de taberna, el arco del explorador llega lejos', () => {
            expect(getAttackRangeFeet(archer)).toBe(60);
            expect(getPlayerDamageFormula(archer, 60)).not.toBe('1d6');
        });

        test('en una pelea de taberna, el mismo explorador pega con los puños', () => {
            setCombatEncounter(/** @type {any} */ ({ active: true, enemies: [], turnOrder: [], currentTurnIndex: 0, round: 1, turnState: null, brawl: { kind: 'taberna' } }));
            expect(getAttackRangeFeet(archer)).toBe(5);
            expect(getPlayerDamageFormula(archer, 5)).toBe('1d6');
        });
    });

    test('el rival de un duelo se rinde por debajo de un cuarto de su vida, y por honor aguanta más', () => {
        const hurt = { currentHp: 4, maxHp: 20 };
        expect(wantsToYield({ brawl: duel(), enemy: hurt, random: always(0.5) })).toBe(true);
        expect(wantsToYield({ brawl: duel({ way: 'honor' }), enemy: hurt, random: always(0.5) })).toBe(false);
        expect(wantsToYield({ brawl: duel({ way: 'honor' }), enemy: hurt, random: always(0.2) })).toBe(true);
        expect(wantsToYield({ brawl: duel(), enemy: { currentHp: 10, maxHp: 20 }, random: always(0) })).toBe(false);
        expect(wantsToYield({ brawl: duel(), enemy: { currentHp: 0, maxHp: 20 }, random: always(0) })).toBe(false);
        // En la taberna no: allí se rinde el bando, como en cualquier pelea.
        expect(wantsToYield({ brawl: tavern(), enemy: hurt, random: always(0) })).toBe(false);
    });

    test('cómo acaba: ganar, perder, rendirse o tablas', () => {
        expect(['victory', 'defeat', 'fled', 'yield', 'peace', 'manual'].map(verdictOf)).toEqual(['gana', 'pierde', 'rinde', 'rinde', 'tablas', 'tablas']);
    });
});

describe('J12.7: el tablero de la taberna', () => {
    test('la taberna: el grupo junto a la puerta y los camorristas junto a la barra, en suelo; sin barriles que revientan', () => {
        for (const n of [0, 0.99]) {
            const plan = brawlBoard({ kind: 'taberna', town: 'Ciudad de Vallaki', fighters: 4, rivals: 3, random: always(n) });
            const terrain = terrainFromAsciiMap(plan.board.map);
            const w = plan.board.map[0].length;
            const h = plan.board.map.length;
            expect(plan.board.name).toBe('Pelea en la taberna');
            // Suelo y paredes de madera, se llame como se llame el pueblo.
            expect(boardBiome({ name: plan.board.name, type: 'town' })).toBe('madera');
            expect(plan.board.map.join('')).not.toMatch(/T/);
            expect(plan.partyCells).toHaveLength(4);
            expect(plan.rivalCells).toHaveLength(3);
            for (const cell of [...plan.partyCells, ...plan.rivalCells]) expect(isPassable(terrain, cell.x, cell.y, w, h)).toBe(true);
            expect(countFurniture(terrain)).toBeGreaterThan(6);
        }
    });

    test('el duelo: quien juega en el corro, el rival enfrente y los tuyos mirando desde la pared', () => {
        const plan = brawlBoard({ kind: 'duelo', town: 'Puerto Alba', fighters: 3, rivals: 1 });
        expect(plan.board.name).toBe('Duelo en la taberna');
        expect(plan.board.locationName).toBe('Puerto Alba');
        expect(boardBiome({ name: plan.board.name, type: 'town' })).toBe('madera');
        expect(plan.partyCells).toEqual([{ x: 4, y: 4 }, { x: 1, y: 7 }, { x: 4, y: 7 }]);
        expect(plan.rivalCells).toEqual([{ x: 9, y: 4 }]);
    });

    test('lo roto se cuenta: una silla tirada deja un mueble menos', () => {
        const plan = brawlBoard({ kind: 'taberna', town: 'Puerto Alba', fighters: 1, rivals: 2, random: always(0) });
        const terrain = terrainFromAsciiMap(plan.board.map);
        const brawl = tavern({ furniture: countFurniture(terrain) });
        const chair = Object.entries(terrain.cells).find(([, cell]) => /** @type {any} */ (cell).type === 'cover_half')?.[0] ?? '';
        const after = { ...terrain, cells: Object.fromEntries(Object.entries(terrain.cells).filter(([key]) => key !== chair)) };
        expect(brokenFurniture(brawl, terrain)).toBe(0);
        expect(brokenFurniture(brawl, after)).toBe(1);
        expect(brokenFurniture(null, after)).toBe(0);
    });

    test('los de enfrente: uno por cada uno de los tuyos (de dos a cuatro), con los puños', () => {
        expect([1, 2, 3, 4, 6].map(rowdyCount)).toEqual([2, 2, 3, 4, 4]);
        const band = rivalFighters({ kind: 'taberna', level: 3, who: [{ name: 'Bruno el Tuerto', archetype: 'cunado-de-lope' }, { name: 'Un amigo' }, { name: 'Un amigo' }] });
        expect(band.map(e => e.name)).toEqual(['Bruno el Tuerto', 'Un amigo 1', 'Un amigo 2']);
        expect(band[0]).toMatchObject({ attackRangeFeet: 5, brawler: true, archetype: 'cunado-de-lope', maxHp: 14, currentHp: 14 });
        const [rival] = rivalFighters({ kind: 'duelo', way: 'apuesta', level: 3, who: [{ name: 'Rosa la Remera' }] });
        expect(rival.maxHp).toBeGreaterThan(band[0].maxHp);
    });
});

describe('J12.7: lo escrito en peleas.json', () => {
    test('es una batería del compendio, sin errores', () => {
        expect(DOMAINS).toContain('peleas');
        expect(validateBattery('peleas', peleas)).toEqual([]);
    });

    test('trae camorristas, campeones con su taberna, quien reta por honor y una frase para cada momento', () => {
        expect(rows.rowdies.length).toBeGreaterThanOrEqual(6);
        expect(rows.champions.map(c => c.town)).toEqual(expect.arrayContaining(['Puerto Alba', 'El Pueblo de Barro', 'Aldea de Barovia', 'Ciudad de Vallaki', '']));
        expect(rows.challengers.map(c => c.name)).toEqual(expect.arrayContaining(['Izek Strazni', 'Garret', 'Ramiro']));
        for (const moment of ['armar', 'calmar-bien', 'calmar-mal', 'ronda', 'irse', 'gana-taberna', 'pierde-taberna', 'rinde-taberna', 'paz-taberna',
            'gana-apuesta', 'pierde-apuesta', 'rinde-apuesta', 'gana-honor', 'pierde-honor', 'rechaza-honor', 'posadero-cobra', 'posadero-harto']) {
            expect(rows.lines[moment]?.length).toBeGreaterThan(0);
        }
        for (const f of [...rows.rowdies, ...rows.champions, ...rows.challengers]) {
            expect([f.opens, f.says, f.wins, f.loses].every(Boolean)).toBe(true);
        }
    });

    test('sin el archivo, la taberna no se queda sin gente', () => {
        const none = readFightRows([]);
        expect(none.rowdies.length).toBeGreaterThan(0);
        expect(none.champions.length).toBeGreaterThan(0);
        expect(fightLine(none, 'gana-taberna', {}, always(0))).toMatch(/taberna/);
    });

    test('los huecos y el género de quien juega', () => {
        const mara = { name: 'Mara', gender: 'Mujer' };
        expect(fillLine('«¿Y tú qué miras, {forastero|forastera}?» {heroe} en {pueblo}, {oro} de oro.', { heroe: mara, pueblo: 'Puerto Alba', oro: 10 }))
            .toBe('«¿Y tú qué miras, forastera?» Mara en Puerto Alba, 10 de oro.');
        expect(fillLine('{forastero|forastera}', { heroe: { name: 'Bran', gender: 'Hombre' } })).toBe('forastero');
        expect(fightLine(rows, 'gana-honor', { heroe: mara, quien: 'Izek Strazni', pueblo: 'Ciudad de Vallaki' }, always(0)))
            .toBe('Antes de que anochezca, todo Ciudad de Vallaki sabe que Mara tumbó a Izek Strazni en un duelo limpio.');
    });
});

describe('J12.7: quién hay en la taberna', () => {
    const at = { town: 'Puerto Alba', day: 3 };

    test('alguien te busca pelea por la tarde o por la noche, con su suerte; por la mañana, nadie', () => {
        expect(rowdyNow({ rows, random: always(0), ...at, slot: 'morning', log: null })).toBeNull();
        expect(rowdyNow({ rows, random: always(0), ...at, slot: 'night', log: null })?.name).toBe(rows.rowdies[0].name);
        expect(rowdyNow({ rows, random: always(0.9), ...at, slot: 'night', log: null })).toBeNull();
    });

    test('una vez resuelto (peleando, hablando, pagando o yéndote), esa franja ya no vuelve', () => {
        const log = noteBrawl(null, { ...at, slot: 'night', what: 'camorra', who: 'Bruno el Tuerto' });
        expect(rowdyNow({ rows, random: always(0), ...at, slot: 'night', log })).toBeNull();
        expect(rowdyNow({ rows, random: always(0), ...at, slot: 'afternoon', log })).not.toBeNull();
        expect(happened(log, { ...at, what: 'camorra', slot: 'night' })).toBe(true);
        expect(happened(log, { town: 'Puerto Alba', day: 4, what: 'camorra' })).toBe(false);
    });

    test('el campeón: el de su taberna; si no tiene, uno de los de cualquier sitio, siempre el mismo', () => {
        expect(championOf(rows, 'Puerto Alba', always(0))?.name).toBe('Rosa la Remera');
        expect(championOf(rows, 'Ciudad de Vallaki', always(0))?.name).toBe('Boris Mano de Hierro');
        const loose = championOf(rows, 'Aldea de Krezk', always(0.5));
        expect(loose?.town).toBe('');
        expect(championOf(rows, 'Aldea de Krezk', always(0.5))?.name).toBe(loose?.name);
    });

    test('quien busca pelea viene con sus amigos', () => {
        const band = rowdyBand(rows, rows.rowdies[0], 3, always(0));
        expect(band).toHaveLength(3);
        expect(band[0].name).toBe(rows.rowdies[0].name);
        expect(new Set(band.map(b => b.name)).size).toBe(3);
        expect(rowdyBand(readFightRows([{ id: 'solo', kind: 'camorrista', name: 'Solo' }]), { id: 'solo', name: 'Solo', archetype: '' }, 2, always(0))
            .map(b => b.name)).toEqual(['Solo', 'Un amigo de Solo']);
    });

    test('lo que ofrece la taberna, y por qué no se puede cuando no', () => {
        const base = { rowdy: rows.rowdies[0], champion: rows.champions[0], ...at, slot: 'night', log: null, purse: 30, fighting: false, heroUp: true, keeper: 'Tomás' };
        const ids = (/** @type {any[]} */ list) => list.map(a => `${a.id}:${a.enabled ? 'sí' : 'no'}`);
        expect(ids(tavernActions(base))).toEqual(['brawl-rowdy:sí', 'brawl-start:sí', 'brawl-duel:sí']);
        expect(tavernActions(base)[0].label).toBe('Bruno el Tuerto te busca pelea');
        expect(tavernActions(base)[2].label).toBe('Retar a Rosa la Remera a un duelo por dinero');
        // Por la mañana, sin ambiente.
        const morning = tavernActions({ ...base, rowdy: null, slot: 'morning' });
        expect(ids(morning)).toEqual(['brawl-start:no', 'brawl-duel:no']);
        expect(morning[0].detail).toMatch(/casi vacía/);
        // Peleando, o sin tenerse en pie, nada.
        expect(tavernActions({ ...base, fighting: true }).every(a => !a.enabled && a.detail === 'No mientras peleáis.')).toBe(true);
        expect(tavernActions({ ...base, heroUp: false }).every(a => !a.enabled)).toBe(true);
        // Sin oro para la apuesta más pequeña.
        expect(tavernActions({ ...base, purse: 4 })[2]).toMatchObject({ enabled: false, detail: `Hace falta tener al menos ${STAKES[0]} de oro para apostar.` });
        // Un duelo al día en cada taberna.
        const dueled = noteBrawl(null, { ...at, slot: 'afternoon', what: 'duelo', who: 'Rosa la Remera' });
        expect(tavernActions({ ...base, log: dueled })[2]).toMatchObject({ enabled: false, detail: 'Hoy ya has peleado un duelo aquí. Vuelve otro día.' });
        expect(stakesFor(12)).toEqual([5, 10]);
    });

    test('a la segunda pelea que armas en una semana, el posadero se harta hasta pasados unos días', () => {
        let log = noteBrawl(null, { town: 'Puerto Alba', day: 2, slot: 'night', what: 'armada', who: 'Bruno' });
        expect(fedUpUntil(log, 'Puerto Alba', 3)).toBe(0);
        log = noteBrawl(log, { town: 'Puerto Alba', day: 4, slot: 'night', what: 'armada', who: 'Mateo' });
        expect(fedUpUntil(log, 'Puerto Alba', 5)).toBe(4 + FED_UP_DAYS);
        expect(fedUpUntil(log, 'Ciudad de Vallaki', 5)).toBe(0);
        expect(fedUpUntil(log, 'Puerto Alba', 2 + FED_UP_DAYS)).toBe(0);
        const start = tavernActions({ rowdy: null, champion: null, town: 'Puerto Alba', day: 5, slot: 'afternoon', log, purse: 0, fighting: false, heroUp: true, keeper: 'Tomás' })[0];
        expect(start).toMatchObject({ id: 'brawl-start', enabled: false, detail: `Tomás no quiere más peleas aquí hasta el día ${4 + FED_UP_DAYS}.` });
    });
});

describe('J12.7: el reto por honor', () => {
    test('quien tiene su reto escrito te reta; quien es de armas tomar, también; quien no, no', () => {
        expect(challengerFor({ npc: { name: 'Izek Strazni', trade: 'Jefe de la guardia del barón' }, rows })?.says).toMatch(/A mí me amenazas/);
        const guard = challengerFor({ npc: { name: 'Bartolo', trade: 'Guardia del puerto' }, rows });
        expect(guard?.name).toBe('Bartolo');
        expect(fillLine(String(guard?.says), { pueblo: 'Puerto Alba' })).toMatch(/que todo Puerto Alba sepa lo que vales/);
        expect(challengerFor({ npc: { name: 'Tomás', trade: 'Posadero' }, rows })).toBeNull();
        expect(challengerFor({ npc: { name: 'Izek Strazni', dead: true }, rows })).toBeNull();
        expect(challengerFor({ npc: null, rows })).toBeNull();
    });

    test('quien ya te retó no lo repite en una semana', () => {
        const log = noteBrawl(null, { town: 'Ciudad de Vallaki', day: 3, slot: 'morning', what: 'honor', who: 'Izek Strazni' });
        expect(challengedLately(log, 'Izek Strazni', 5)).toBe(true);
        expect(challengedLately(log, 'Izek Strazni', 3 + FED_UP_DAYS)).toBe(false);
        expect(challengedLately(log, 'Szoldar Szoldarovich', 5)).toBe(false);
    });

    test('no aceptar se sabe en el pueblo, y cuesta fama', () => {
        const refused = refuseHonor({ rival: 'Izek Strazni', town: 'Ciudad de Vallaki', rows, random: always(0) });
        expect(refused.fame).toBe(HONOR_FAME.rechaza);
        expect(refused.marks).toEqual(['reto-rechazado']);
        expect(refused.lines[0]).toMatch(/Izek Strazni.*Ciudad de Vallaki/);
    });
});

describe('J12.7: lo que pasa al acabar', () => {
    const facts = { heroe: { name: 'Mara', gender: 'Mujer' }, posadero: 'Tomás' };
    const rival = rows.rowdies[0];

    test('en la taberna, si la empezaron ellos y ganas: fama, el posadero os paga por echarlos y lo roto lo pagan ellos', () => {
        const out = brawlOutcome({ brawl: tavern(), verdict: 'gana', broken: 2, lost: 0, rows, rival, facts, random: always(0) });
        expect(out).toMatchObject({ title: 'Ganas la pelea', fame: 1, gold: 6, bill: 0, marks: ['pelea-ganada'], mood: 'alegre' });
        expect(out.lines).toContain(String(rival.loses));
        expect(out.notes[0]).toBe('Tomás os da 6 de oro por echarlos, y lo roto lo pagan ellos.');
    });

    test('si la armas tú, lo roto lo pagas tú entero y el posadero se enfada, ganes o pierdas', () => {
        const won = brawlOutcome({ brawl: tavern({ started: 'tu' }), verdict: 'gana', broken: 2, lost: 0, rows, facts, random: always(0) });
        expect(won).toMatchObject({ fame: 1, gold: 0, bill: 2 * FURNITURE_PRICE, marks: ['pelea'], mood: 'enfadado' });
        expect(won.lines.join(' ')).toMatch(/Tomás cuenta las sillas rotas con los labios apretados: 2 muebles/);
        const lost = brawlOutcome({ brawl: tavern({ started: 'tu' }), verdict: 'pierde', broken: 1, lost: 4, rows, facts, random: always(0) });
        expect(lost).toMatchObject({ fame: -1, gold: -4, bill: FURNITURE_PRICE, marks: ['pelea'] });
        expect(lost.notes).toEqual(expect.arrayContaining(['Os falta 4 de oro en la bolsa.', `Lo roto (una silla): ${FURNITURE_PRICE} de oro.`]));
    });

    test('si la empezaron ellos y pierdes: os aligeran la bolsa, la mitad de lo roto, y se ríen un poco', () => {
        const out = brawlOutcome({ brawl: tavern(), verdict: 'pierde', broken: 3, lost: 5, rows, rival, facts, random: always(0) });
        expect(out).toMatchObject({ title: 'Pierdes la pelea', fame: -1, gold: -5, bill: Math.ceil(3 * FURNITURE_PRICE / 2), marks: [] });
        expect(out.lines).toContain(fillLine(rival.wins, facts));
        expect(out.lines.join(' ')).toMatch(/a la salud de Mara, que aguanta poco/);
    });

    test('rendirse en la taberna es pagar una ronda; acabarla con una ronda, tablas', () => {
        expect(brawlOutcome({ brawl: tavern(), verdict: 'rinde', broken: 0, lost: 0, rows, facts, random: always(0) }))
            .toMatchObject({ title: 'Te rindes', fame: 0, gold: -ROUND_PRICE, bill: 0, marks: [] });
        expect(brawlOutcome({ brawl: tavern(), verdict: 'tablas', broken: 2, lost: 0, rows, facts, random: always(0) }))
            .toMatchObject({ title: 'Se acaba con una ronda', fame: 0, gold: 0, bill: FURNITURE_PRICE });
    });

    test('el duelo por dinero: quien gana cobra lo apostado; quien pierde o se rinde, lo paga (y lo roto)', () => {
        const champion = rows.champions[0];
        const won = brawlOutcome({ brawl: duel(), verdict: 'gana', broken: 1, lost: 0, rows, rival: champion, facts, random: always(0) });
        expect(won).toMatchObject({ title: 'Ganas el duelo', gold: 10, bill: 0, fame: 0, marks: ['duelo-ganado'] });
        expect(won.notes[0]).toBe('+10 de oro.');
        expect(won.lines.join(' ')).toMatch(/te da los 10 de oro/);
        const lost = brawlOutcome({ brawl: duel({ stake: 25 }), verdict: 'pierde', broken: 1, lost: 0, rows, rival: champion, facts, random: always(0) });
        expect(lost).toMatchObject({ gold: -25, bill: FURNITURE_PRICE, marks: ['duelo-perdido'] });
        expect(brawlOutcome({ brawl: duel({ stake: 5 }), verdict: 'rinde', broken: 0, lost: 0, rows, facts, random: always(0) }))
            .toMatchObject({ title: 'Te rindes', gold: -5 });
        expect(brawlOutcome({ brawl: duel(), verdict: 'tablas', broken: 0, lost: 0, rows, facts, random: always(0) })).toMatchObject({ gold: 0, title: 'Nadie gana' });
    });

    test('el duelo por honor: lo que se juega es la fama en el pueblo, y se sabe', () => {
        const honor = duel({ way: 'honor', stake: 0, rival: 'Izek Strazni', town: 'Ciudad de Vallaki', watching: [] });
        const izek = rows.challengers.find(c => c.name === 'Izek Strazni') ?? null;
        const won = brawlOutcome({ brawl: honor, verdict: 'gana', broken: 0, lost: 0, rows, rival: izek, facts, random: always(0) });
        expect(won).toMatchObject({ fame: HONOR_FAME.gana, gold: 0, marks: ['duelo-ganado'] });
        expect(won.notes).toContain(`En Ciudad de Vallaki se habla bien de vosotros (+${HONOR_FAME.gana} de fama).`);
        expect(brawlOutcome({ brawl: honor, verdict: 'pierde', broken: 0, lost: 0, rows, rival: izek, facts, random: always(0) }))
            .toMatchObject({ fame: HONOR_FAME.pierde, marks: ['duelo-perdido'] });
        expect(brawlOutcome({ brawl: honor, verdict: 'rinde', broken: 0, lost: 0, rows, facts, random: always(0) }).fame).toBe(HONOR_FAME.rinde);
        expect(dayPartLabel(honor)).toBe('Duelo con Izek Strazni');
        expect(dayPartLabel(tavern())).toBe('Pelea en la taberna');
    });
});

describe('J12.7: el pueblo se acuerda (ecos.json)', () => {
    const inn = { kind: 'posada', keeper: { name: 'Tomás' } };
    const hero = { name: 'Mara', gender: 'Mujer' };

    test('las huellas nuevas valen, y cada una tiene su reacción escrita', () => {
        for (const deed of ['pelea', 'pelea-ganada', 'duelo-ganado', 'duelo-perdido', 'reto-rechazado']) {
            expect(DEEDS).toContain(deed);
            expect(readEchoes(echoes).some(e => e.deed === deed)).toBe(true);
        }
    });

    test('quien lleva la taberna se acuerda de la pelea que armaste, y de la que ganaste a los camorristas', () => {
        const angry = addMark([], { deed: 'pelea', town: 'Puerto Alba', place: 'posada', day: 5 });
        expect(rememberedGreeting({ place: inn, town: 'Puerto Alba', marks: angry, rows: echoes, today: 6, hero })).toMatch(/^Tomás .*Aquí se viene a beber|^Tomás .*hazlo en la calle/);
        const twice = addMark(angry, { deed: 'pelea', town: 'Puerto Alba', place: 'posada', day: 6 });
        expect(rememberedGreeting({ place: inn, town: 'Puerto Alba', marks: twice, rows: echoes, today: 6, hero })).toMatch(/si se rompe una silla más, te echo yo mismo/);
        const thanks = addMark([], { deed: 'pelea-ganada', town: 'Puerto Alba', place: 'posada', day: 5 });
        expect(rememberedGreeting({ place: inn, town: 'Puerto Alba', marks: thanks, rows: echoes, today: 6, hero })).toMatch(/Desde que echaste a aquellos/);
    });

    test('lo del duelo se cuenta en el pueblo', () => {
        const won = addMark([], { deed: 'duelo-ganado', town: 'Ciudad de Vallaki', place: 'posada', day: 5 });
        expect(markRumors({ marks: won, rows: echoes, town: 'Ciudad de Vallaki', today: 6 }).map(r => r.text).join(' ')).toMatch(/ganó un duelo a puñetazos/);
    });

    test('lo que se guarda está en el registro del estado', () => {
        expect(BRAWLS_KEY).toBe('tavernBrawls');
        expect(STATE_KEYS.some(k => k.key === BRAWLS_KEY && k.kind === 'juego')).toBe(true);
    });
});
