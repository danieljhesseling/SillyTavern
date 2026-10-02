/**
 * El contenido escrito que faltaba (tanda 9): las salidas habladas de cada pelea con gente
 * (J8.5), las cosas que mirar de Puerto Alba y de la sala del gremio (J10.2, J3.11) y las
 * trampas de las mazmorras de 1387 y de Strahd (J12.3). Se lee de los paquetes de verdad.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { mindOf } from '../public/scripts/game-engine/combat/avoid-fight.js';
import { readParley, checkParley, parleyChips, resolveParley, parleyPlan } from '../public/scripts/game-engine/combat/parley.js';
import { readSights, sightsOf, splitSights, pickLooks } from '../public/scripts/game-engine/campaign/sights.js';
import { townPlaces } from '../public/scripts/game-engine/campaign/town.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { trapsFromPack, searchAround } from '../public/scripts/game-engine/board/trap-actions.js';
import { noteProse } from '../public/scripts/game-engine/campaign/narration-prose.js';
import { stripEngineTags } from '../public/scripts/game-engine/ui/shell/engine-tags.js';

const load = (/** @type {string} */ id) => JSON.parse(readFileSync(new URL(`../public/mundos/${id}.pack.json`, import.meta.url), 'utf8'));
const packs = ['gremio', '1387', 'strahd'].map(id => /** @type {[string, any]} */ ([id, load(id)]));
const pack = (/** @type {string} */ id) => packs.find(([name]) => name === id)?.[1];

const bran = { id: 1, name: 'Bran', class: 'Bardo', level: 2, hp: 14, maxHp: 14, strength: 10, dexterity: 14, charisma: 16, wisdom: 12 };

/** Un d20 que saca siempre lo mismo. */
const always = (/** @type {number} */ n) => () => n;

/** Los enemigos de un tablero como los pone el combate. */
function foesOf(/** @type {any} */ p, /** @type {any} */ board) {
    return board.enemies.map((/** @type {any} */ e, /** @type {number} */ i) => {
        const row = p.bestiary.find((/** @type {any} */ b) => b.name === e.name) ?? {};
        return { name: `${e.name} ${i + 1}`, cr: Number(row.cr) || 0, boss: Boolean(row.boss), currentHp: Number(row.hp) || 5, maxHp: Number(row.hp) || 5 };
    });
}

describe('J8.5: cada pelea escrita con gente se puede hablar, con lo suyo', () => {
    test('todo tablero donde espera gente trae su `parley`, y se entiende', () => {
        for (const [id, p] of packs) {
            const people = p.boards.filter((/** @type {any} */ b) => (b.enemies ?? []).some((/** @type {any} */ e) => {
                const row = p.bestiary.find((/** @type {any} */ r) => r.name === e.name) ?? {};
                return mindOf({ name: e.name, description: row.description, mind: row.mind, profile: row.profile }) === 'gente';
            }));
            const missing = people.filter((/** @type {any} */ b) => !b.parley).map((/** @type {any} */ b) => b.id);
            expect([id, missing]).toEqual([id, []]);
            for (const board of people) expect([id, board.id, checkParley(board.parley).errors]).toEqual([id, board.id, []]);
        }
    });

    test('quien manda es alguien del tablero, y lo que cambia apunta a cosas que existen', () => {
        for (const [id, p] of packs) {
            const milestones = new Set((p.plot?.milestones ?? []).map((/** @type {any} */ m) => m.id));
            const rumors = new Set((p.rumors ?? []).map((/** @type {any} */ r) => r.id));
            const items = new Set((p.items ?? []).map((/** @type {any} */ i) => i.name));
            const factions = new Set((p.world?.factions ?? []).map((/** @type {any} */ f) => f.name));
            for (const board of p.boards.filter((/** @type {any} */ b) => b.parley)) {
                const where = `${id}.${board.id}`;
                const leader = board.parley.leader || board.enemies[0].name;
                expect([where, board.enemies.some((/** @type {any} */ e) => e.name === leader)]).toEqual([where, true]);
                const json = JSON.stringify(board.parley);
                for (const [, m] of json.matchAll(/"milestone":"([^"]+)"/g)) expect([where, milestones.has(m)]).toEqual([where, true]);
                for (const [, r] of json.matchAll(/"rumor":"([^"]+)"/g)) expect([where, rumors.has(r)]).toEqual([where, true]);
                for (const [, item] of json.matchAll(/"give":"([^"]+)"/g)) expect([where, items.has(item)]).toEqual([where, true]);
                for (const [, f] of json.matchAll(/"standing":"([^"]+)"/g)) expect([where, factions.has(f)]).toEqual([where, true]);
                // Lo de Strahd se escribe en mejoras.json con «propio:»; en el paquete ya no se ve.
                expect([where, /propio:/.test(json)]).toEqual([where, false]);
            }
        }
    });

    test('en la cala del gremio: convencer gana el tablero sin botín; rendirse lo pierde y cuesta la bolsa', () => {
        const p = pack('gremio');
        const cala = p.boards.find((/** @type {any} */ b) => b.id === 'cala_contrabandistas');
        const parley = readParley(cala.parley);
        const view = parleyChips({ enemies: foesOf(p, cala), party: [bran], gold: 20, parley });
        expect(view.leader).toBe('Bandido contrabandista');
        expect(view.chips.map(c => [c.id, c.locked])).toEqual([['entregarse', ''], ['sobornar', ''], ['convencer', ''], ['enganar', '']]);
        expect(view.chips.find(c => c.id === 'convencer')?.text).toMatch(/la cala ya está vista/);

        const talk = resolveParley({ way: 'convencer', enemies: foesOf(p, cala), party: [bran], gold: 20, parley, rollD20: always(20) });
        expect(parleyPlan(talk)).toMatchObject({ end: 'victory', theyLeave: true, passed: true });
        expect(talk.lines.at(-1)).toMatch(/reman mar adentro/);

        const given = resolveParley({ way: 'entregarse', enemies: foesOf(p, cala), party: [bran], gold: 20, parley, rollD20: always(1) });
        expect(parleyPlan(given)).toMatchObject({ end: 'manual', passed: false });
        expect(given.effects.map(e => e.kind)).toEqual(['gold', 'time', 'fame']);
    });

    test('el ratero del muelle no acepta presos, y en la cripta de Strahd no hay trato', () => {
        const muelle = pack('gremio').boards.find((/** @type {any} */ b) => b.id === 'muelle_puerto_alba');
        const chips = parleyChips({ enemies: foesOf(pack('gremio'), muelle), party: [bran], gold: 20, parley: muelle.parley }).chips;
        expect(chips.find(c => c.id === 'entregarse')?.locked).toMatch(/no hay trato/);
        expect(chips.find(c => c.id === 'sobornar')?.locked).toBe('');

        const crypt = pack('strahd').boards.find((/** @type {any} */ b) => b.id === 'cripta_strahd');
        const all = parleyChips({ enemies: foesOf(pack('strahd'), crypt), party: [bran], gold: 999, parley: crypt.parley }).chips;
        expect(all.every(c => /no hay trato/.test(c.locked))).toBe(true);
    });

    test('en la mina de 1387, convencer a Sombra cumple el hito de la nieve manchada', () => {
        const p = pack('1387');
        const mine = p.boards.find((/** @type {any} */ b) => b.id === 'enc-espia-mina');
        const said = resolveParley({ way: 'convencer', enemies: foesOf(p, mine), party: [bran], gold: 0, parley: mine.parley, rollD20: always(20) });
        expect(said.ends).toBe('ended');
        expect(said.effects).toContainEqual({ kind: 'milestone', id: 'la-nieve-manchada' });
    });
});

describe('J10.2 y J3.11: lo que se puede mirar en Puerto Alba y dentro de sus sitios', () => {
    test('una cosa con `place` es de ese sitio; sin él, o de un sitio que no hay, va a la fila', () => {
        const rows = readSights([
            { text: 'el muelle' },
            { text: 'el tablón viejo', place: 'Gremio' },
            { text: 'la forja', place: 'herreria' },
            'las gaviotas',
        ], 'Puerto');
        expect(rows.map(r => r.place ?? '')).toEqual(['', 'gremio', 'herreria', '']);
        const { loose, byPlace } = splitSights(rows, ['gremio', 'posada']);
        expect(loose.map(r => r.text)).toEqual(['el muelle', 'la forja', 'las gaviotas']);
        expect(Object.keys(byPlace)).toEqual(['gremio']);
        expect(byPlace.gremio.map(r => r.text)).toEqual(['el tablón viejo']);
    });

    test('Puerto Alba: la fila ya no saca las del compendio, y cada sitio del pueblo tiene lo suyo', () => {
        const p = pack('gremio');
        expect(validatePack(p).ok).toBe(true);
        const town = buildImportPlan(p).metadata.locationMaps.find((/** @type {any} */ l) => l.name === 'Puerto Alba');
        // Como `placeKindsOf` de party/talk.js: el gremio cuenta porque Puerto Alba lo escribe en sus sitios.
        const kinds = townPlaces({ location: town, guild: true }).places.map(pl => pl.kind);
        const { loose, byPlace } = splitSights(sightsOf(town), kinds);
        expect(loose.length).toBeGreaterThanOrEqual(2);
        expect(byPlace.gremio.length).toBeGreaterThanOrEqual(2);
        for (const kind of ['posada', 'templo', 'herreria', 'tienda']) expect([kind, (byPlace[kind] ?? []).length > 0]).toEqual([kind, true]);
        // Con dos o más del sitio, las genéricas del compendio no llegan a salir en la fila.
        const generic = [{ id: 'mirar-carteles', kind: 'mirar', verbo: 'leer', text: 'los carteles viejos del muro' }];
        const offered = pickLooks({ sights: loose, rows: generic, random: () => 0.5, here: 'Puerto Alba' });
        expect(offered.every(r => r.own)).toBe(true);
        expect(sightsOf(town).every(r => r.found)).toBe(true);
    });
});

describe('J12.3: las trampas de las mazmorras', () => {
    const expected = {
        1387: ['enc-espia-mina', 'enc-emboscada-por-el-hierro', 'enc-patrullas-en-la-nieve'],
        strahd: ['sotano_iglesia', 'molino_viejo_mascahuesos', 'comedor_ravenloft', 'cripta_strahd'],
    };

    test('cada una en suelo, lejos de donde se empieza y de quien espera, y el paquete se valida', () => {
        for (const [id, boards] of Object.entries(expected)) {
            const p = pack(id);
            expect(validatePack(p).errors.filter((/** @type {any} */ e) => /traps/.test(e.path))).toEqual([]);
            for (const boardId of boards) {
                const board = p.boards.find((/** @type {any} */ b) => b.id === boardId);
                expect([boardId, (board.traps ?? []).length > 0]).toEqual([boardId, true]);
                for (const trap of board.traps) {
                    const where = `${boardId} ${trap.name}`;
                    expect([where, board.map[trap.y][trap.x]]).toEqual([where, '.']);
                    expect([where, board.partyStart.some((/** @type {any} */ c) => c.x === trap.x && c.y === trap.y)]).toEqual([where, false]);
                    expect([where, board.enemies.some((/** @type {any} */ e) => e.x === trap.x && e.y === trap.y)]).toEqual([where, false]);
                    expect([where, Boolean(trap.tell) && /^\d+d\d+$/.test(trap.damage)]).toEqual([where, true]);
                    expect([where, trap.spotDC >= 10 && trap.spotDC <= 16 && trap.disarmDC >= 10 && trap.disarmDC <= 16]).toEqual([where, true]);
                }
            }
        }
    });

    test('buscar al lado de la trampa de la mina con buena tirada la encuentra; con mala, no', () => {
        const mine = pack('1387').boards.find((/** @type {any} */ b) => b.id === 'enc-espia-mina');
        const board = { hazards: trapsFromPack(mine.traps) };
        const size = { cols: mine.map[0].length, rows: mine.map.length };
        const good = searchAround({ board, center: { x: 4, y: 3 }, roll: 20, ...size });
        expect(good.found.map(h => h.name)).toContain('Tablas sobre un pozo');
        const bad = searchAround({ board, center: { x: 4, y: 3 }, roll: 2, ...size });
        expect(bad.found).toEqual([]);
        expect(bad.missed.map(h => h.name)).toContain('Tablas sobre un pozo');
    });

    test('lo que se encuentra se cuenta sin casillas ni un «en» colgando', () => {
        const read = (/** @type {string} */ note) => stripEngineTags(noteProse(note));
        expect(read('🔍 [TABLERO] Bran busca trampas alrededor (Percepción: 21). Encuentra escalón podrido en (11, 4).'))
            .toBe('Bran busca trampas alrededor: saca un 21 en Percepción. Encuentra una trampa: escalón podrido.');
        expect(read('🔍 [TABLERO] Bran busca trampas alrededor (Percepción: 18). Encuentra cepo de lobero en (5, 6) y cepo bajo la nieve en (12, 5).'))
            .toBe('Bran busca trampas alrededor: saca un 18 en Percepción. Encuentra dos trampas: cepo de lobero y cepo bajo la nieve.');
        expect(read('🔍 [TABLERO] Irene busca trampas alrededor (Percepción: 14). No hay nada raro.'))
            .toBe('Irene busca trampas alrededor: saca un 14 en Percepción. No hay nada raro.');
    });
});
