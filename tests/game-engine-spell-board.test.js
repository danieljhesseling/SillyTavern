import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    ZONE_KINDS, createZone, zoneFromSpell, zonesAt, zoneFlagsAt, zoneEffects, resolveZoneEffect,
    expireZones, endZones, moveZone, followCaster, clearZones, burnZones, placeZone, zoneOverlay, kindOf,
} from '../public/scripts/game-engine/board/spell-zones.js';
import {
    normalizeSummon, validateSummon, summonStats, placeNextToCaster, planSummon, expireSummons,
    dismissSummons, setSummonControl,
} from '../public/scripts/game-engine/rules/summons.js';
import { normalizeSpell, durationRounds } from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { upcastSpell } from '../public/scripts/game-engine/rules/spell-cast.js';
import { areaCells } from '../public/scripts/game-engine/rules/area.js';
import { setCell } from '../public/scripts/game-engine/board/terrain.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const catalogue = read('compendio/conjuros.json').rows;
const bestiary = read('compendio/bestiario.json').rows;
const spell = (/** @type {string} */ id) => normalizeSpell(catalogue.find((/** @type {any} */ r) => r.id === id));

const fixedRoll = (/** @type {number[]} */ values) => {
    const queue = [...values];
    return () => ({ total: queue.length > 0 ? /** @type {number} */ (queue.shift()) : 0 });
};

/** Una telaraña de 10 pies de radio en (5,5), lanzada en la ronda 2. */
const web = () => {
    const telarana = spell('conj-telarana');
    const cells = areaCells({ area: telarana.area, origin: { x: 0, y: 0 }, aim: { x: 5, y: 5 }, width: 20, height: 20 });
    return /** @type {any} */ (zoneFromSpell({ spell: telarana, cells, center: { x: 5, y: 5 }, casterId: 'lyra', round: 2, saveDc: 14 }));
};

describe('las zonas de conjuro en el tablero (J19.6)', () => {
    test('una telaraña: casillas, terreno difícil, CD de quien la lanza y una hora de duración', () => {
        const zone = web();
        expect(zone.kind).toBe('telarana');
        expect(zone.cells).toHaveLength(25);
        expect(zone).toMatchObject({ spellId: 'conj-telarana', casterId: 'lyra', since: 2, until: 602, concentration: true, triggers: ['enter', 'start'] });
        expect(zone.effect).toMatchObject({ save: 'dexterity', dc: 14, condition: 'Restrained', damage: '' });
        expect(zoneFlagsAt([zone], { x: 5, y: 5 })).toMatchObject({ difficult: true, blocksSight: false, names: ['Telaraña'] });
        expect(zoneFlagsAt([zone], { x: 9, y: 9 }).difficult).toBe(false);
        expect(zonesAt([zone], { x: 4, y: 6 })).toHaveLength(1);
    });

    test('al entrar salta una vez por turno; al empezar el turno dentro, también', () => {
        const zone = web();
        const first = zoneEffects({ zones: [zone], cell: { x: 5, y: 5 }, trigger: 'enter', who: 'orco' });
        expect(first).toHaveLength(1);
        expect(zoneEffects({ zones: [zone], cell: { x: 5, y: 6 }, trigger: 'enter', who: 'orco', alreadyThisTurn: [first[0].key] })).toEqual([]);
        expect(zoneEffects({ zones: [zone], cell: { x: 5, y: 6 }, trigger: 'start', who: 'orco', alreadyThisTurn: [first[0].key] })).toHaveLength(1);
        expect(zoneEffects({ zones: [zone], cell: { x: 5, y: 6 }, trigger: 'end', who: 'orco' })).toEqual([]);
    });

    test('quien la pisa salva contra la CD; si falla, queda atrapado', () => {
        const [effect] = zoneEffects({ zones: [web()], cell: { x: 5, y: 5 }, trigger: 'enter', who: 'orco' });
        const caught = resolveZoneEffect({ effect, roll: fixedRoll([8]), saveModifier: 1, targetName: 'El orco' });
        expect(caught).toMatchObject({ saved: false, condition: 'Restrained', damage: 0 });
        expect(caught.lines[1]).toBe('🌀 Telaraña atrapa a El orco.');
        expect(resolveZoneEffect({ effect, roll: fixedRoll([13]), saveModifier: 1 })).toMatchObject({ saved: true, condition: '' });
    });

    test('el daño de la zona: las púas sin salvación; el rayo de luna, a la mitad si salva', () => {
        const spikes = spell('conj-crecimiento-espinoso');
        const zone = /** @type {any} */ (zoneFromSpell({ spell: spikes, cells: [{ x: 1, y: 1 }], casterId: 'druida', round: 1 }));
        const [effect] = zoneEffects({ zones: [zone], cell: { x: 1, y: 1 }, trigger: 'enter', who: 'lobo' });
        expect(resolveZoneEffect({ effect, roll: fixedRoll([5]) })).toMatchObject({ saved: false, damage: 5 });

        const moon = spell('conj-rayo-luna');
        const beam = /** @type {any} */ (zoneFromSpell({ spell: moon, cells: [{ x: 3, y: 3 }], casterId: 'druida', round: 1, saveDc: 13, damage: upcastSpell(moon, 3).damage }));
        expect(beam.effect.damage).toBe('3d10');
        const [hit] = zoneEffects({ zones: [beam], cell: { x: 3, y: 3 }, trigger: 'start', who: 'lobo' });
        expect(resolveZoneEffect({ effect: hit, roll: fixedRoll([15, 17]) })).toMatchObject({ saved: true, damage: 8 });
    });

    test('la esfera llameante quema al acabar el turno a su lado, no al entrar', () => {
        const sphere = /** @type {any} */ (zoneFromSpell({ spell: spell('conj-esfera-llameante'), cells: [{ x: 2, y: 2 }], casterId: 'lyra', round: 1 }));
        expect(sphere.triggers).toEqual(['end']);
        expect(zoneEffects({ zones: [sphere], cell: { x: 2, y: 2 }, trigger: 'enter', who: 'x' })).toEqual([]);
        expect(zoneEffects({ zones: [sphere], cell: { x: 2, y: 2 }, trigger: 'end', who: 'x' })).toHaveLength(1);
    });

    test('la niebla y la oscuridad tapan la vista; el silencio no deja lanzar con palabras', () => {
        const fog = createZone({ kind: 'niebla', cells: [{ x: 0, y: 0 }], round: 1, rounds: 600 });
        const hush = createZone({ kind: 'silencio', cells: [{ x: 0, y: 0 }], round: 1, rounds: 100 });
        expect(zoneFlagsAt([fog, hush], { x: 0, y: 0 })).toMatchObject({ blocksSight: true, silence: true, difficult: false });
        // Sin daño ni estado, la zona no salta: solo cambia la casilla.
        expect(fog.effect).toBeNull();
        expect(zoneEffects({ zones: [fog], cell: { x: 0, y: 0 }, trigger: 'enter', who: 'x' })).toEqual([]);
    });

    test('se acaban con el tiempo, o de golpe al perder la concentración', () => {
        const zone = web();
        expect(expireZones([zone], 601).kept).toHaveLength(1);
        const gone = expireZones([zone], 602);
        expect(gone.kept).toEqual([]);
        expect(gone.lines).toEqual(['🕸️ Se acaba Telaraña.']);
        const other = createZone({ kind: 'niebla', cells: [{ x: 9, y: 9 }], round: 1, casterId: 'lyra', spellId: 'conj-nube-niebla' });
        const ended = endZones([zone, other], { casterId: 'lyra', spellId: 'conj-telarana' });
        expect(ended.kept.map(z => z.kind)).toEqual(['niebla']);
        expect(endZones([zone, other], { casterId: 'lyra' }).kept).toEqual([]);
        // Sin duración no se acaba sola.
        expect(createZone({ kind: 'niebla', cells: [], round: 3 }).until).toBeNull();
    });

    test('se mueve con su forma, y los espíritus van con quien los llamó', () => {
        const zone = web();
        const moved = moveZone(zone, { x: 8, y: 5 });
        expect(moved.center).toEqual({ x: 8, y: 5 });
        expect(zonesAt([moved], { x: 10, y: 7 })).toHaveLength(1);
        expect(zonesAt([moved], { x: 3, y: 5 })).toHaveLength(0);
        const guardians = /** @type {any} */ (zoneFromSpell({ spell: spell('conj-espiritus-guardianes'), cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }], center: { x: 1, y: 1 }, casterId: 'sera', round: 1 }));
        const [followed, stayed] = followCaster([guardians, zone], 'sera', { x: 4, y: 4 });
        expect(followed.cells).toEqual([{ x: 4, y: 4 }, { x: 5, y: 4 }]);
        expect(stayed).toBe(zone);
    });

    test('la luz del día deshace la oscuridad; el fuego quema la telaraña', () => {
        const dark = createZone({ kind: 'oscuridad', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }], round: 1, name: 'Oscuridad' });
        const day = createZone({ kind: 'luz', cells: [{ x: 1, y: 0 }], round: 2 });
        const placed = placeZone([dark], day);
        expect(placed.zones.map(z => z.kind)).toEqual(['oscuridad', 'luz']);
        expect(placed.zones[0].cells).toEqual([{ x: 0, y: 0 }]);
        expect(placed.lines).toEqual(['✨ Se deshace Oscuridad donde cae.']);
        expect(clearZones({ zones: [dark], kinds: ['oscuridad'], cells: dark.cells }).zones).toEqual([]);

        const burned = burnZones({ zones: [web()], cells: [{ x: 5, y: 5 }, { x: 6, y: 5 }] });
        expect(burned.burned).toHaveLength(2);
        expect(burned.zones[0].cells).toHaveLength(23);
        expect(burned.lines).toEqual(['🔥 La telaraña arde y se deshace.']);
        expect(burnZones({ zones: [dark], cells: dark.cells }).burned).toEqual([]);
    });

    test('lo que pinta el tablero, y un tipo que no existe', () => {
        const overlay = zoneOverlay([web()]);
        expect(overlay).toHaveLength(25);
        expect(overlay[0]).toMatchObject({ kind: 'telarana', icon: '🕸️', label: 'Telaraña' });
        expect(kindOf('no-existe').label).toBe('no-existe');
        expect(zoneFromSpell({ spell: { ...spell('conj-telarana'), zone: { kind: 'lava' } }, cells: [], casterId: 'x', round: 1 })).toBeNull();
        expect(Object.keys(ZONE_KINDS)).toEqual(expect.arrayContaining(['niebla', 'telarana', 'oscuridad', 'fuego', 'silencio']));
    });
});

describe('las invocaciones (J19.5)', () => {
    test('la columna summon, con lo de por defecto', () => {
        expect(normalizeSummon({ creature: 'bestia-lobo', cr: 1 })).toEqual({
            creature: 'bestia-lobo', cr: 1, stats: null, count: 1, control: 'player', duration: '', attacks: true,
        });
        expect(normalizeSummon({ stats: { name: 'Familiar', hp: 2 }, control: 'engine', attacks: false })).toMatchObject({ control: 'engine', attacks: false, stats: { name: 'Familiar', hp: 2, armorClass: 10 } });
    });

    test('lo que está mal en una invocación', () => {
        const ids = bestiary.map((/** @type {any} */ r) => r.id);
        expect(validateSummon({ creature: 'bestia-lobo', cr: 1, control: 'player' }, { creatureIds: ids })).toEqual([]);
        expect(validateSummon({}, {}).join(' ')).toMatch(/no dice qué sale/);
        expect(validateSummon({ creature: 'bestia-dragon', cr: 1 }, { creatureIds: ids }).join(' ')).toMatch(/no está en el bestiario/);
        expect(validateSummon({ creature: 'bestia-lobo' }).join(' ')).toMatch(/desafío/);
        expect(validateSummon({ stats: { hp: 3 }, control: 'solo' }).join(' ')).toMatch(/Vale: player, engine/);
        expect(validateSummon({ stats: { hp: 3 }, count: 0 }).join(' ')).toMatch(/count/);
    });

    test('los números salen del bestiario a su desafío, o de la propia fila', () => {
        const wolf = summonStats(normalizeSummon({ creature: 'bestia-lobo', cr: 1 }), bestiary);
        expect(wolf).toMatchObject({ name: 'Lobo', hp: 18, armorClass: 12, speed: 40, profile: 'skirmisher', cr: 1 });
        expect(summonStats(normalizeSummon({ stats: { name: 'Familiar', hp: 2, armorClass: 12, speed: 40 } }))).toMatchObject({ name: 'Familiar', hp: 2 });
    });

    test('salen junto a quien invoca, en casillas libres y sin atravesar paredes', () => {
        const terrain = setCell(null, 5, 4, 'wall');
        const cells = placeNextToCaster({ caster: { x: 5, y: 5 }, count: 3, occupied: [{ x: 4, y: 4 }], terrain, width: 10, height: 10 });
        expect(cells).toEqual([{ x: 6, y: 4 }, { x: 4, y: 5 }, { x: 6, y: 5 }]);
        // En una esquina salen como pueden, y siempre en el mismo sitio.
        expect(placeNextToCaster({ caster: { x: 0, y: 0 }, count: 4, width: 10, height: 10 }))
            .toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }]);
    });

    test('Conjurar animales: cuatro lobos con un espacio de 5.º, mientras dure la concentración', () => {
        const conjure = spell('conj-conjurar-animales');
        const { tokens, lines } = planSummon({
            spell: conjure, caster: { id: 'sera', x: 5, y: 5, name: 'Sera' }, round: 3,
            count: upcastSpell(conjure, 5).count, bestiary, width: 20, height: 20,
        });
        expect(tokens).toHaveLength(4);
        expect(tokens[0]).toMatchObject({ name: 'Lobo 1', control: 'player', casterId: 'sera', spellId: 'conj-conjurar-animales', until: 603, concentration: true, attacks: true });
        expect(lines[0]).toBe('🐾 Sera invoca 4 × Lobo.');
    });

    test('el familiar se queda hasta que lo maten, y no ataca', () => {
        const familiar = spell('conj-encontrar-familiar');
        const { tokens } = planSummon({
            spell: familiar, caster: { id: 'lyra', x: 1, y: 1 }, round: 1,
            durationRounds: durationRounds(familiar.summon.duration), width: 10, height: 10,
        });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ name: 'Familiar', until: null, attacks: false, concentration: false });
    });

    test('sin sitio no sale nadie, y se dice', () => {
        const terrain = [[0, 1], [1, 1], [1, 0]].reduce((map, [x, y]) => setCell(map, x, y, 'wall'), /** @type {any} */ (null));
        const { tokens, lines } = planSummon({ spell: spell('conj-conjurar-animales'), caster: { id: 'x', x: 0, y: 0 }, round: 1, terrain, width: 10, height: 10 });
        expect(tokens).toEqual([]);
        expect(lines[0]).toMatch(/no hay sitio/);
    });

    test('se van al acabarse el tiempo, o al perder la concentración', () => {
        const { tokens } = planSummon({ spell: spell('conj-conjurar-animales'), caster: { id: 'sera', x: 5, y: 5 }, round: 1, bestiary, width: 20, height: 20 });
        expect(expireSummons(tokens, 600).kept).toHaveLength(2);
        const gone = expireSummons(tokens, 601);
        expect(gone.kept).toEqual([]);
        expect(gone.lines[0]).toBe('🐾 Lobo 1 se desvanece.');
        const skeleton = { ...tokens[0], id: 'esq', spellId: 'conj-animar-muertos', concentration: false };
        const dismissed = dismissSummons([...tokens, skeleton], { casterId: 'sera', onlyConcentration: true });
        expect(dismissed.kept.map(t => t.id)).toEqual(['esq']);
        expect(dismissSummons(tokens, { casterId: 'otro' }).gone).toEqual([]);
    });

    test('quién la mueve se cambia a mitad de pelea (J7.3)', () => {
        const { tokens } = planSummon({ spell: spell('conj-conjurar-animales'), caster: { id: 'sera', x: 5, y: 5 }, round: 1, bestiary });
        expect(setSummonControl(tokens[0], 'engine').control).toBe('engine');
        expect(setSummonControl(tokens[0], /** @type {any} */ ('nadie')).control).toBe('player');
    });
});
