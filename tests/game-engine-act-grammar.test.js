/**
 * J10.7 de wiki/ROADMAP_SIN_CONEXION.md: las campañas sin hilo escrito reciben una historia en tres
 * actos (`campaign/act-grammar.js`), y los mundos de semilla de `mundos.json` se juegan desde el
 * tablón con su paquete hecho con la semilla (`campaign/seed-pack.js`).
 */

import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium, validateBattery } from '../public/scripts/game-engine/compendio/compendio.js';
import {
    buildActThread, withActThread, needsActThread, fillActText, ACT_IDS, ACT_ENDINGS, CLUES_NEEDED,
} from '../public/scripts/game-engine/campaign/act-grammar.js';
import { seedCampaignPack, seedWorldPack, isSeedWorld } from '../public/scripts/game-engine/campaign/seed-pack.js';
import { readPlot, startPlot, plotEvent, hasEnded, actOf } from '../public/scripts/game-engine/campaign/plot.js';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { checkCampaign } from '../public/scripts/game-engine/campaign/campaign-check.js';
import { readSights } from '../public/scripts/game-engine/campaign/sights.js';
import { hubCampaignCards } from '../public/scripts/game-engine/campaign/hub.js';
import { SKILLS } from '../public/scripts/game-engine/rules/checks.js';

const read = (/** @type {string} */ path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const battery = (/** @type {string} */ name) => read(`../public/compendio/${name}.json`).rows;
/** El compendio del juego, recién abierto: lo que lee la gramática y lo que rellena el paquete. */
const compendium = () => createCompendium(Object.fromEntries(
    ['actos', 'nombres', 'mundo', 'facciones', 'bestiario', 'frases'].map(d => [d, battery(d)]),
));
const SEED_WORLDS = read('../public/mundos/mundos.json').worlds.filter((/** @type {any} */ w) => !w.pack);
const COSTA = SEED_WORLDS.find((/** @type {any} */ w) => w.id === 'costa');

/**
 * Jugar el hilo con los sucesos que daría el juego, hasta su final.
 *
 * @param {any} pack
 * @param {'a'|'b'} side
 * @param {'escena'|'charla'} how Cómo se elige bando: en la escena, o yendo a hablar.
 */
function playThrough(pack, side, how = 'escena') {
    const plot = /** @type {any} */ (readPlot(pack.plot));
    const byId = new Map(plot.milestones.map((/** @type {any} */ m) => [m.id, m]));
    const opened = [];
    let step = startPlot(plot, 1);
    opened.push(...step.opened.map(m => m.id));
    const send = (/** @type {any} */ event) => {
        step = plotEvent(plot, step.state, event, 2);
        opened.push(...step.opened.map(m => m.id));
        return step;
    };
    const witness = byId.get(ACT_IDS.witness).asks;
    send({ kind: 'talk', npc: witness.npc, place: witness.place });
    const clues = byId.get(ACT_IDS.clues).asks.clues;
    // Una tirada fallida no cuenta; dos buenas, en dos de las tres pistas, sí.
    send({ kind: 'check', skill: clues[0].skill, success: false, place: clues[0].place });
    send({ kind: 'check', skill: clues[0].skill, success: true, place: clues[0].place });
    const afterClues = send({ kind: 'check', skill: clues[2].skill, success: true, place: clues[2].place });
    const lair = byId.get(ACT_IDS.lair).asks.place;
    const revealedLair = afterClues.changes.reveal.includes(lair);
    send({ kind: 'arrive', place: lair });
    const strike = byId.get(ACT_IDS.strike).asks;
    send({ kind: 'win', place: strike.place, board: strike.board });
    const chosen = side === 'a' ? ACT_IDS.sideA : ACT_IDS.sideB;
    const choice = how === 'escena'
        ? send({ kind: 'milestone', id: chosen })
        : send({ kind: 'talk', npc: byId.get(chosen).asks.npc, place: byId.get(chosen).asks.place });
    const climax = byId.get(side === 'a' ? ACT_IDS.climaxA : ACT_IDS.climaxB);
    const enemy = climax.asks.options.find((/** @type {any} */ o) => o.kind === 'defeat').enemy;
    const before = actOf(plot, step.state);
    const end = send({ kind: 'defeat', enemy: `${enemy} 1` });
    return { plot, step, end, opened, choice, revealedLair, actBefore: before };
}

describe('J10.7: las plantillas de los actos', () => {
    const data = read('../public/compendio/actos.json');

    test('la batería se lee sin errores y trae de todo', () => {
        expect(validateBattery('actos', data)).toEqual([]);
        const kinds = new Set(data.rows.map((/** @type {any} */ r) => r.kind));
        for (const kind of ['trama', 'giro', 'desenlace', 'final', 'presagio', 'capitulo', 'asoma', 'rumor', 'oficio']) expect(kinds.has(kind)).toBe(true);
    });

    test('cada trama trae tres pistas con tiradas distintas y que existen, y sitios escondidos', () => {
        for (const row of data.rows.filter((/** @type {any} */ r) => r.kind === 'trama')) {
            const skills = row.pistas.cosas.map((/** @type {any} */ c) => c.skill);
            expect(skills).toHaveLength(3);
            expect(new Set(skills).size).toBe(3);
            for (const skill of skills) expect(skill in SKILLS).toBe(true);
            expect(row.guaridas.length).toBeGreaterThan(0);
            expect(row.refugios.length).toBeGreaterThan(0);
            expect(row.villanos.length).toBeGreaterThan(0);
            // Cada villano tiene al menos un giro que le vale.
            expect(data.rows.some((/** @type {any} */ g) => g.kind === 'giro' && (!g.villano || g.villano === row.villano))).toBe(true);
        }
    });

    test('solo usa huecos que la gramática sabe rellenar, y nunca «localidad»', () => {
        const known = new Set(['inicio', 'testigo', 'villano', 'guarida', 'refugio', 'pista1', 'pista2', 'pista3',
            'contactoA', 'contactoB', 'sitioA', 'sitioB', 'bandoA', 'bandoB', 'mundo']);
        const all = JSON.stringify(data.rows);
        const holes = [...all.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map(m => m[1]);
        expect(holes.filter(h => !known.has(h))).toEqual([]);
        expect(all).not.toMatch(/localidad/i);
    });
});

describe('J10.7: el texto', () => {
    test('rellena los huecos, contrae «a el» y «de el», y pone mayúscula al empezar cada frase', () => {
        const vars = { villano: 'el Barquero', guarida: 'El Molino Hundido' };
        expect(fillActText('{villano} se esconde. Ve a {guarida} y acaba con {villano}.', vars))
            .toBe('El Barquero se esconde. Ve al Molino Hundido y acaba con el Barquero.');
        expect(fillActText('Las pistas salen de {guarida}.', vars)).toBe('Las pistas salen del Molino Hundido.');
        // Las marcas del héroe se quedan para quien juega.
        expect(fillActText('Ve {solo|sola} a {guarida}.', vars)).toBe('Ve {solo|sola} al Molino Hundido.');
        expect(fillActText('Hola, {desconocido}.', vars)).toBe('Hola, {desconocido}.');
    });
});

describe('J10.7: una campaña de semilla tiene tres actos', () => {
    const { pack, made } = seedCampaignPack({ row: COSTA, compendium: compendium() });
    const plot = /** @type {any} */ (readPlot(pack.plot));

    test('los mundos de semilla son los que no traen paquete', () => {
        expect(SEED_WORLDS.map((/** @type {any} */ w) => w.id)).toEqual(['costa', 'ocaso', 'pantalla']);
        expect(SEED_WORLDS.every(isSeedWorld)).toBe(true);
        expect(isSeedWorld({ id: '1387', pack: '/mundos/1387.pack.json', seed: 'x' })).toBe(false);
    });

    test('se le pone la historia, y es un paquete válido que se juega de principio a fin', () => {
        expect(made).toBe(true);
        const found = validatePack(pack);
        expect(found.errors).toEqual([]);
        expect(checkCampaign(pack, { filled: [], validation: found }).verdict).toBe('lista');
    });

    test('tres actos con nombre: el gancho, la complicación y el desenlace', () => {
        expect(plot.chapters.map((/** @type {any} */ c) => c.act)).toEqual([1, 2, 3]);
        for (const c of plot.chapters) expect(c.title).not.toBe('');
        const acts = (/** @type {number} */ act) => plot.milestones.filter((/** @type {any} */ m) => m.act === act).map((/** @type {any} */ m) => m.id);
        expect(acts(1)).toEqual([ACT_IDS.hook, ACT_IDS.witness, ACT_IDS.clues]);
        expect(acts(2)).toEqual([ACT_IDS.lair, ACT_IDS.strike, ACT_IDS.crossroads, ACT_IDS.sideA, ACT_IDS.sideB]);
        expect(acts(3)).toEqual(expect.arrayContaining([ACT_IDS.climaxA, ACT_IDS.climaxB]));
        // Todos con título, y los que piden algo, con lo que hay que hacer.
        expect(plot.milestones.filter((/** @type {any} */ m) => !m.title)).toEqual([]);
        expect(plot.milestones.filter((/** @type {any} */ m) => m.asks.kind !== 'none' && !m.hint)).toEqual([]);
    });

    test('el gancho se juega como escena, y quien lo vio vive donde se empieza', () => {
        const hook = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.hook);
        expect(hook.opens.kind).toBe('start');
        expect(hook.beats.length).toBeGreaterThanOrEqual(2);
        const witness = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.witness).asks;
        expect(witness.place).toBe(pack.locations[0].name);
        expect(pack.npcs.some((/** @type {any} */ n) => n.name === witness.npc && n.where === witness.place && !n.service)).toBe(true);
        // Quien habla en el gancho es alguien de la gente: sale con su nombre.
        expect(hook.beats.some((/** @type {any} */ b) => b.who === witness.npc)).toBe(true);
    });

    test('las pistas están repartidas por tres sitios, cada una con algo que examinar con su tirada', () => {
        const clues = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.clues).asks;
        expect(clues.need).toBe(CLUES_NEEDED);
        expect(new Set(clues.clues.map((/** @type {any} */ c) => c.place)).size).toBe(3);
        for (const clue of clues.clues) {
            const place = pack.locations.find((/** @type {any} */ l) => l.name === clue.place);
            const sights = readSights(place?.sights, clue.place);
            expect(sights.some(s => s.skill === clue.skill && s.found)).toBe(true);
            // Se ofrecen dos cosas al día: la pista no se queda fuera.
            expect(sights.length).toBeLessThanOrEqual(2);
        }
    });

    test('la guarida y el refugio empiezan escondidos, con camino, y los descubre la historia', () => {
        const lair = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.lair).asks.place;
        const refuge = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.climaxA).asks.options[0].place;
        for (const name of [lair, refuge]) {
            const place = pack.locations.find((/** @type {any} */ l) => l.name === name);
            expect(place.hidden).toBe(true);
            expect(place.routes.length).toBeGreaterThan(0);
        }
        expect(plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.clues).changes.reveal).toEqual([lair]);
        expect(plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.sideA).changes.reveal).toEqual([refuge]);
        expect(plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.sideB).changes.reveal).toEqual([refuge]);
    });

    test('hay tablero en la guarida y en el refugio, y en el del refugio espera el villano', () => {
        const strike = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.strike).asks;
        const lairBoard = pack.boards.find((/** @type {any} */ b) => b.name === strike.board);
        expect(lairBoard?.locationName).toBe(strike.place);
        expect(lairBoard.map.length).toBeGreaterThan(0);
        const fight = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.climaxA).asks.options[0];
        const final = pack.boards.find((/** @type {any} */ b) => b.locationName === fight.place);
        expect(final.enemies.some((/** @type {any} */ e) => e.name === fight.enemy)).toBe(true);
        expect(pack.bestiary.some((/** @type {any} */ b) => b.name === fight.enemy)).toBe(true);
        expect(plot.villain.name).toBe(fight.enemy);
        expect(plot.villain.appears.map((/** @type {any} */ a) => a.act)).toEqual([2, 3]);
    });

    test('la decisión de la encrucijada: cada opción cumple su bando, y elegir uno cierra el otro', () => {
        const cross = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.crossroads);
        const options = cross.beats.flatMap((/** @type {any} */ b) => b.options ?? []);
        expect(options.find((/** @type {any} */ o) => o.id === 'a').effects).toEqual([{ milestone: ACT_IDS.sideA }]);
        expect(options.find((/** @type {any} */ o) => o.id === 'b').effects).toEqual([{ milestone: ACT_IDS.sideB }]);
        expect(options.find((/** @type {any} */ o) => o.id === 'pensar').effects).toBeUndefined();
        expect(plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.sideA).changes.close).toEqual([ACT_IDS.sideB]);
        // Con facciones, cada bando mueve la reputación: +2 con los tuyos y -1 con los otros.
        const standing = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.sideA).changes.standing;
        expect(Object.values(standing).sort()).toEqual([-1, 2]);
    });

    test('dos finales según el bando, y un tercero si el bando del trato llena su reloj antes', () => {
        expect(Object.keys(plot.endings).sort()).toEqual([ACT_ENDINGS.a, ACT_ENDINGS.b, ACT_ENDINGS.late].sort());
        for (const ending of Object.values(plot.endings)) {
            expect(/** @type {any} */ (ending).scene).not.toBe('');
            expect(/** @type {any} */ (ending).epilogues.length).toBeGreaterThan(0);
        }
        const late = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.late);
        expect(late.opens.kind).toBe('clock');
        expect(pack.world.factions.some((/** @type {any} */ f) => f.id === late.opens.faction)).toBe(true);
        expect(plot.omens).toHaveLength(3);
    });

    test('se juega entero por el bando A, eligiendo en la escena: acaba en su final', () => {
        const run = playThrough(pack, 'a', 'escena');
        expect(run.revealedLair).toBe(true);
        expect(run.choice.closed.map(m => m.id)).toEqual([ACT_IDS.sideB]);
        expect(run.actBefore).toBe(3);
        expect(run.end.changes.ending).toBe(ACT_ENDINGS.a);
        expect(hasEnded(run.plot, run.step.state)).toBe(true);
        // Se abrieron los tres actos, en orden.
        expect(run.opened.indexOf(ACT_IDS.clues)).toBeLessThan(run.opened.indexOf(ACT_IDS.lair));
        expect(run.opened.indexOf(ACT_IDS.lair)).toBeLessThan(run.opened.indexOf(ACT_IDS.climaxA));
        expect(run.opened).not.toContain(ACT_IDS.climaxB);
    });

    test('se juega entero por el bando B, yendo a hablar con su contacto: acaba en el otro final', () => {
        const run = playThrough(pack, 'b', 'charla');
        expect(run.choice.closed.map(m => m.id)).toEqual([ACT_IDS.sideA]);
        expect(run.end.changes.ending).toBe(ACT_ENDINGS.b);
        expect(run.opened).not.toContain(ACT_IDS.climaxA);
    });

    test('si el reloj del bando B se llena, se llega tarde', () => {
        const late = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.late);
        const step = plotEvent(plot, startPlot(plot, 1).state, { kind: 'clock', faction: late.opens.faction }, 30);
        expect(step.changes.ending).toBe(ACT_ENDINGS.late);
    });
});

describe('J10.7: la misma semilla, la misma historia; otra semilla, otra', () => {
    test('el mismo mundo da el mismo paquete, aunque el compendio ya se haya usado', () => {
        const comp = compendium();
        const first = seedCampaignPack({ row: COSTA, compendium: comp });
        // Un compendio usado recuerda lo último que salió: la historia no puede depender de eso.
        comp.pick('nombres', { where: { kind: 'person' } });
        const second = seedCampaignPack({ row: COSTA, compendium: comp });
        const third = seedCampaignPack({ row: COSTA, compendium: compendium() });
        expect(JSON.stringify(second.pack)).toBe(JSON.stringify(first.pack));
        expect(JSON.stringify(third.pack)).toBe(JSON.stringify(first.pack));
    });

    test('diez semillas dan hilos distintos, y todos se juegan hasta un final', () => {
        const seen = new Set();
        for (let i = 0; i < 10; i++) {
            const row = { ...COSTA, seed: `semilla-de-prueba-${i}` };
            const base = seedWorldPack(row, { compendium: compendium() });
            const thread = buildActThread({ pack: base, compendium: compendium(), seed: row.seed });
            expect(thread).not.toBeNull();
            const t = /** @type {any} */ (thread);
            seen.add(`${t.summary.trama}|${t.summary.giro}|${t.summary.villain}|${t.summary.lair}`);
            const { pack } = seedCampaignPack({ row, compendium: compendium() });
            expect(validatePack(pack).errors).toEqual([]);
            expect(playThrough(pack, i % 2 === 0 ? 'a' : 'b').end.changes.ending).toBe(i % 2 === 0 ? ACT_ENDINGS.a : ACT_ENDINGS.b);
        }
        expect(seen.size).toBeGreaterThanOrEqual(8);
    });

    test('los tres mundos de semilla del tablón se pueden jugar', () => {
        for (const row of SEED_WORLDS) {
            const { pack } = seedCampaignPack({ row, compendium: compendium() });
            const found = validatePack(pack);
            expect(found.errors).toEqual([]);
            expect(checkCampaign(pack, { filled: [], validation: found }).verdict).toBe('lista');
        }
    });
});

describe('J10.7: las campañas de tu Gem sin hilo', () => {
    /** Una campaña corta, sin hilo y sin gente: un sitio con su tesoro y un tablero. */
    const molino = {
        world: { name: 'El Sótano del Molino', synopsis: 'Bajo el molino viejo hay un sótano.', levels: [1, 2] },
        locations: [{ name: 'El molino viejo', type: 'ruins' }],
        boards: [{ id: 'sotano', name: 'El sótano', locationName: 'El molino viejo' }],
    };

    test('recibe su historia en tres actos, aunque solo tenga un sitio y nadie con quien hablar', () => {
        expect(needsActThread(molino)).toBe(true);
        const { pack, made } = seedCampaignPack({ pack: molino, compendium: compendium() });
        expect(made).toBe(true);
        expect(validatePack(pack).errors).toEqual([]);
        const plot = /** @type {any} */ (readPlot(pack.plot));
        expect(new Set(plot.milestones.map((/** @type {any} */ m) => m.act))).toEqual(new Set([1, 2, 3]));
        // Un solo sitio: las tres pistas están allí, cada una con su tirada.
        const clues = plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.clues).asks.clues;
        expect(new Set(clues.map((/** @type {any} */ c) => c.place))).toEqual(new Set(['El molino viejo']));
        expect(new Set(clues.map((/** @type {any} */ c) => c.skill)).size).toBe(3);
        // Sin facciones: los bandos son dos personas, y solo dos finales.
        expect(Object.keys(plot.endings).sort()).toEqual([ACT_ENDINGS.a, ACT_ENDINGS.b]);
        expect(pack.npcs.length).toBeGreaterThanOrEqual(3);
        // Sin caminos escritos, los sitios nuevos tampoco los traen: se va directo, como siempre.
        expect(pack.locations.every((/** @type {any} */ l) => !l.routes || l.routes.length === 0)).toBe(true);
        expect(playThrough(pack, 'a').end.changes.ending).toBe(ACT_ENDINGS.a);
    });

    test('una campaña con hilo, o con misiones en varios actos, se queda como está', () => {
        const strahd = read('../public/mundos/1387.pack.json');
        expect(needsActThread(strahd)).toBe(false);
        expect(withActThread(strahd, { compendium: compendium() }).made).toBe(false);
        const byQuests = { ...molino, quests: [{ name: 'Uno', act: 1 }, { name: 'Dos', act: 2 }] };
        expect(needsActThread(byQuests)).toBe(false);
        const oneAct = { ...molino, quests: [{ name: 'Uno', act: 1 }, { name: 'Dos', act: 1 }] };
        expect(needsActThread(oneAct)).toBe(true);
    });

    test('lo que ya trae se respeta: su gente se queda y la de la historia se añade', () => {
        const withPeople = { ...molino, npcs: [{ name: 'Tobías', trade: 'Molinero', where: 'El molino viejo' }] };
        const { pack } = withActThread(withPeople, { compendium: compendium() });
        expect(pack.npcs[0].name).toBe('Tobías');
        // Tobías vive donde se empieza y no atiende nada: es quien lo vio.
        const witness = pack.plot.milestones.find((/** @type {any} */ m) => m.id === ACT_IDS.witness).asks;
        expect(witness.npc).toBe('Tobías');
        expect(withPeople.npcs).toHaveLength(1);
    });
});

describe('J10.7: el tablón', () => {
    const worlds = [
        { id: 'costa', name: 'La costa', seed: 'sal-niebla-tres' },
        { id: '1387', name: '1387', pack: '/mundos/1387.pack.json', levels: [1, 4] },
        { id: 'sin', name: 'Sin nada' },
    ];

    test('las de semilla salen detrás de las escritas, y dicen que su historia la pone el juego', () => {
        const cards = hubCampaignCards({ worlds });
        expect(cards.map(c => c.id)).toEqual(['1387', 'costa']);
        expect(cards[1].generated).toBe(true);
        expect(cards[1].traits.join(' ')).toMatch(/historia la escribe el juego/);
        expect(cards[0].generated).toBe(false);
    });
});
