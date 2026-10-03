/**
 * Los retoques de la gente (tanda 22 de wiki/ROADMAP_SIN_CONEXION.md, «Retoques que he decidido»):
 * lo que queda del narrador dicho por alguien (D-J60), Grimm con gruñidos, el aspecto de los
 * enemigos que hablan, «Rango» y los días del gremio al volver de una campaña (H16).
 */

import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import { readHub, withHubCampaign, hubDay, homecomingDays } from '../public/scripts/game-engine/campaign/hub.js';
import { silentUntil, isSilent, silentRow, gruntFor } from '../public/scripts/game-engine/campaign/mute.js';
import { voiceNote } from '../public/scripts/game-engine/campaign/narration-voices.js';
import { readManifest } from '../public/scripts/game-engine/ui/pixel-art.js';
import { guestPortrait } from '../public/scripts/game-engine/ui/meetup-scene.js';
import { buildScript, COMPENDIO_DOCS, COMPANION, ON_CARD, NARRATOR } from '../public/scripts/game-engine/campaign/script-doc.js';
import { readAvoid, resolveAvoid, readBranch } from '../public/scripts/game-engine/combat/avoid-fight.js';
import { resolveParley, readParley } from '../public/scripts/game-engine/combat/parley.js';
import { resolveOption } from '../public/scripts/game-engine/campaign/sucesos.js';
import { readLater, laterRows } from '../public/scripts/game-engine/campaign/aftermath.js';
import { readLegacy, rememberCampaign, visitorRows } from '../public/scripts/game-engine/campaign/guild-memory.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import { readSights } from '../public/scripts/game-engine/campaign/sights.js';
import { getSectionSchema } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';

const read = (/** @type {string} */ path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('D-J60: lo que queda del narrador lo dice alguien que está allí', () => {
    const compendio = Object.fromEntries(COMPENDIO_DOCS.map(doc => [doc, read(`../public/compendio/${doc}.json`)]));

    test('el guion en Word de las seis campañas, sin ninguna línea «Narrador»', () => {
        for (const id of ['gremio', '1387', 'strahd', 'ocaso', 'costa', 'pantalla']) {
            const pack = read(`../public/mundos/${id}.pack.json`);
            const script = buildScript(pack, { campaign: ['gremio', '1387', 'strahd'].includes(id) ? id : '', compendio });
            const left = script.blocks.filter(b => b.kind === 'narrador').map(b => `${id} ${b.id}: ${b.text.slice(0, 50)}`);
            expect(left).toEqual([]);
        }
    });

    test('el guion pone quién: uno de los tuyos al mirar y ante una trampa, la tarjeta en pantalla, la rama con su who', () => {
        const pack = {
            world: { name: 'Prueba' },
            locations: [{ name: 'Aldea', sights: [{ text: 'el pozo', found: 'El agua huele a almendra.' }, { text: 'la puerta', found: 'Está abierta.', who: 'Giles' }] }],
            npcs: [{ id: 'giles', name: 'Giles', where: 'Aldea' }],
            boards: [{
                id: 'b', name: 'El patio', traps: [{ name: 'Losa', tell: 'Una losa está más baja.' }],
                avoid: [
                    { kind: 'esconderse', text: 'Pasar sin ruido', success: { who: '{companero}', text: 'Ni una rama.' }, failure: 'Os ven.' },
                    { kind: 'hablar', text: 'Hablar', success: { who: '{leader}', text: 'Pasad.' } },
                ],
                parley: { leader: 'Torres', sobornar: { text: 'Pagar', success: { who: 'Torres', text: 'Por la ventana.' } } },
            }],
            sucesos: [{ id: 's', name: 'Finn', who: 'Finn', text: 'Finn recoge los sedales.', when: { sitio: 'Aldea' }, options: [{ label: 'Pagarle', then: 'Venid a buscarme.' }] }],
            plot: { milestones: [{ id: 'h', title: 'Hito', scene: 'Algo pasa.', pov: 'Giles' }], endings: { fin: { title: 'Fin', scene: 'Se acabó.', who: 'Giles' } } },
        };
        const blocks = buildScript(pack, {}).blocks.filter(b => b.id);
        const label = (/** @type {string} */ id) => blocks.find(b => b.id === id)?.label;
        expect(label('L:aldea/mirar1/visto')).toBe(COMPANION);
        expect(label('L:aldea/mirar2/visto')).toMatch(/^Giles/);
        expect(label('P:b/trampa1')).toBe(COMPANION);
        expect(label('P:b/evitar1/bien')).toBe(COMPANION);
        expect(label('P:b/evitar1/mal')).toBe(NARRATOR);
        expect(label('P:b/evitar2/bien')).toMatch(/^Torres/);
        expect(label('P:b/sobornar/bien')).toMatch(/^Torres/);
        expect(label('S:s')).toBe(ON_CARD);
        expect(label('S:s/1/r')).toMatch(/^Finn/);
        expect(label('F:fin/escena')).toMatch(/^Giles/);
    });

    test('el motor lee quién lo dice: las salidas de una pelea, los sucesos, lo que vuelve, las visitas, los finales y lo que se mira', () => {
        expect(readBranch({ who: 'Torres', text: 'Por la ventana.' })).toEqual({ text: 'Por la ventana.', effects: [], who: 'Torres' });
        const [talk] = readAvoid([{ kind: 'hablar', text: 'Hablar', dc: 5, success: { who: '{leader}', text: 'Pasad, {leader} lo manda.' } }], [{ name: 'Guardia', cr: 1 }]);
        const party = [{ id: 1, name: 'Irene', hp: 10, charisma: 18, skills: {} }];
        const done = resolveAvoid({ option: talk, party, rollD20: () => 20, leader: 'Torres' });
        expect(done.voice).toEqual({ who: 'Torres', text: 'Pasad, Torres lo manda.' });
        const parley = readParley({ leader: 'Torres', sobornar: { text: 'Pagar', gold: 1, success: { who: 'Torres', text: 'Por la ventana.' } } });
        const bribe = resolveParley({ way: 'sobornar', enemies: [{ name: 'Torres', cr: 1, currentHp: 10, maxHp: 10 }], party, gold: 10, parley, rollD20: () => 20 });
        expect(bribe.voice).toEqual({ who: 'Torres', text: 'Por la ventana.' });
        // Lo de siempre (sin escribir) no lo dice nadie.
        const plain = resolveParley({ way: 'convencer', enemies: [{ name: 'Torres', cr: 1, currentHp: 10, maxHp: 10 }], party, gold: 10, parley, rollD20: () => 20 });
        expect(plain.voice).toBeNull();

        expect(resolveOption({ label: 'A', then: 'Toma.', who: 'Finn' }).who).toBe('Finn');
        expect(resolveOption({ label: 'A', check: { skill: 'insight', dc: 10 }, success: { then: 'Sí.', who: 'Garret' } }, { success: true }).who).toBe('Garret');
        expect(resolveOption({ label: 'A', then: 'Nada.' })).not.toHaveProperty('who');

        const option = { id: 'o', text: 'Toma', later: { days: 2, name: 'Garret vuelve', who: 'Garret', text: 'Garret te espera.', options: [{ label: 'Escuchar', then: 'Te cuento.' }, { label: 'No', then: 'Bah.' }] } };
        expect(readLater(option)?.who).toBe('Garret');
        const rows = laterRows({ milestones: [{ id: 'h', beats: [{ who: 'Garret', text: 'Hola', options: [option] }] }] });
        expect(rows[0]).toMatchObject({ who: 'Garret', name: 'Garret vuelve' });

        const legacy = { title: 'X', visitor: { days: 3, name: 'Una carta', who: 'Ismark Kolyanovich', text: 'Llega una carta.', options: [{ label: 'Leerla', then: 'Gracias.' }] } };
        expect(readLegacy(legacy)?.visitor?.who).toBe('Ismark Kolyanovich');
        const memory = rememberCampaign(null, { id: 'strahd', endingTitle: 'Libre', legacy, day: 3 });
        expect(visitorRows(memory)[0]).toMatchObject({ who: 'Ismark Kolyanovich' });

        const plot = readPlot({ milestones: [{ id: 'a', title: 'A', opens: { kind: 'start' }, asks: { kind: 'none' } }], endings: { fin: { title: 'Fin', scene: 'Se acabó.', who: 'Ireena Kolyana' } } });
        expect(plot?.endings.fin).toMatchObject({ who: 'Ireena Kolyana', scene: 'Se acabó.' });

        expect(readSights([{ text: 'el pozo', found: 'Huele raro.', who: 'Giles' }], 'Aldea')[0]).toMatchObject({ who: 'Giles' });
        expect(readSights([{ text: 'el pozo', found: 'Huele raro.' }], 'Aldea')[0]).not.toHaveProperty('who');
    });

    test('el contrato del Gem: who en las salidas, las cosas que mirar, lo que vuelve y los finales; aspecto en el bestiario', () => {
        const boards = /** @type {any} */ (getSectionSchema('boards'));
        const avoid = boards.items.properties.avoid.items.properties;
        expect(avoid.success.oneOf[1].properties).toHaveProperty('who');
        expect(boards.items.properties.parley.properties.sobornar.properties.failure.oneOf[1].properties).toHaveProperty('who');
        const locations = /** @type {any} */ (getSectionSchema('locations'));
        expect(locations.items.properties.sights.items.properties).toHaveProperty('who');
        const bestiary = /** @type {any} */ (getSectionSchema('bestiary'));
        expect(bestiary.items.properties.aspecto.description).toMatch(/Solo si habla/);
        const plot = /** @type {any} */ (getSectionSchema('plot'));
        expect(plot.properties.endings.additionalProperties.properties).toHaveProperty('who');
    });
});

describe('quien habla en una quedada sin ser de los tuyos, con la cara de la misma persona', () => {
    const manifest = readManifest(read('../public/img/game-engine/pixel/manifest.json'));
    const base = 'img/game-engine/pixel/';

    test('el tabernero de 1387 es Giles; el de la posada de aquí, quien la lleva; un bandido, el del bestiario', () => {
        // «El tabernero» en la posada de 1387: el retrato de «El tabernero Giles».
        expect(guestPortrait('El tabernero', { pack: '1387' }, manifest)).toBe(`${base}retratos/1387/el-tabernero-giles.png`);
        // En el gremio, la noche de la posada: quien la lleva aquí (Tomás).
        expect(guestPortrait('El tabernero', { pack: 'gremio', standIns: { 'el tabernero': 'Tomás' } }, manifest)).toBe(`${base}retratos/gremio/tomas.png`);
        expect(guestPortrait('Un bandido', { pack: '1387' }, manifest)).toMatch(/^img\/game-engine\/pixel\/bestias\/.*bandido.*\.png$/);
        // Quien tiene el suyo, el suyo; sin nada, la silueta (y a PIXELLAB_PENDIENTE.md).
        expect(guestPortrait('Brunilda', { pack: 'gremio' }, manifest)).toBe(`${base}retratos/gremio/brunilda.png`);
        expect(guestPortrait('Un mercenario borracho', { pack: '1387' }, manifest)).toBe('');
    });

    test('los que siguen sin cara están apuntados en PIXELLAB_PENDIENTE.md', () => {
        const pending = fs.readFileSync(new URL('../wiki/PIXELLAB_PENDIENTE.md', import.meta.url), 'utf8');
        for (const name of ['Un mercenario borracho', 'Un vistani', 'El buhonero', 'Rosalía', 'La cómica', 'El chico del recado', 'El viajero', 'La madre']) {
            expect(pending).toContain(name);
        }
    });
});

describe('Grimm no habla hasta el rango 8: contesta con gruñidos', () => {
    const companeros = read('../public/compendio/companeros.json').rows;
    const grimm = companeros.find((/** @type {any} */ r) => r.who === 'Grimm');

    test('su ficha dice hasta cuándo calla, y el juego le pone un gruñido', () => {
        expect(silentUntil(grimm)).toBe(8);
        expect(isSilent(grimm, 7)).toBe(true);
        expect(isSilent(grimm, 8)).toBe(false);
        expect(silentRow('grimm', companeros)).toBe(grimm);
        expect(silentRow('Gerd el Mellado', companeros)).toBeNull();
        expect(gruntFor('crit')).toBe('¡Mm!');
        expect(gruntFor('lo que sea')).toBe('Mm.');
    });

    test('sus escenas y charlas, sin acotaciones: lo suyo antes del rango 8 son gruñidos', () => {
        const grunt = /^[¡¿]?(?:Mm|Hm|Hmf)[.!?…,]*(?:\s*(?:[¡¿…]*(?:Mm|Hm|Hmf)[.!?…]*))*$/u;
        // Lo que dice él (no el tabernero) antes del rango 8; desde el 8 ya habla («Gracias, jefe»).
        const said = [
            ...read('../public/compendio/quedadas.json').rows
                .filter((/** @type {any} */ r) => r.who === 'Grimm' && r.kind === 'escena' && r.rank < 8)
                .flatMap((/** @type {any} */ row) => row.beats.filter((/** @type {any} */ beat) => !beat.who))
                .flatMap((/** @type {any} */ beat) => [beat.say, ...(beat.replies ?? []).map((/** @type {any} */ r) => r.then)]),
            ...read('../public/compendio/charlas.json').rows
                .filter((/** @type {any} */ r) => r.who === 'Grimm')
                .flatMap((/** @type {any} */ row) => [...(row.lines ?? []), ...(row.replies ?? []).map((/** @type {any} */ r) => r.then)]),
        ];
        expect(said.length).toBeGreaterThan(30);
        expect(said.filter(line => !grunt.test(String(line)))).toEqual([]);
        // Ni una acotación entre paréntesis en nada de lo suyo, tampoco desde el rango 8.
        const all = JSON.stringify([read('../public/compendio/quedadas.json').rows.filter((/** @type {any} */ r) => r.who === 'Grimm'), grimm]);
        expect(all).not.toMatch(/"\(/);
    });

    test('al apuntarse a un encargo, quien calla gruñe; los demás lo dicen con palabras', () => {
        const scene = { party: [{ name: 'Irene' }, { name: 'Grimm' }, { name: 'Bran' }], hero: { name: 'Irene' }, companions: [{ name: 'Bran' }], silent: ['Grimm'] };
        const grimmSays = voiceNote('📜 [GREMIO] Grimm se apunta: le parece bien pagado.', { scene });
        expect(grimmSays).toMatchObject({ mode: 'line', who: 'Grimm', text: '¡Mm!' });
        const bran = voiceNote('📜 [GREMIO] Bran se queda: no le dice nada.', { scene });
        expect(bran.mode).toBe('line');
        expect(bran.text).not.toMatch(/^Mm/);
    });
});

describe('H16: al volver al gremio pasan en él los días de fuera', () => {
    test('lo vivido allí y el viaje de ida y vuelta; la segunda vuelta, solo lo nuevo', () => {
        let hub = readHub({ campaigns: { strahd: { worldName: 'Strahd' } } });
        // Doce días en Strahd (del 1 al 12) y nueve de camino por cada lado.
        const first = homecomingDays({ hub, id: 'strahd', day: 12, journey: 9 });
        expect(first).toEqual({ lived: 11, travel: 18, total: 29, synced: 11 });
        hub = withHubCampaign(hub, 'strahd', { day: 12, synced: first.synced });
        expect(readHub(hub).campaigns.strahd.synced).toBe(11);
        // Se vuelve a Strahd y se juega hasta el día 15: solo cuentan los tres nuevos.
        expect(homecomingDays({ hub, id: 'strahd', day: 15, journey: 9 })).toEqual({ lived: 3, travel: 18, total: 21, synced: 14 });
        // Sin decir lo lejos que queda, solo lo vivido.
        expect(homecomingDays({ hub: null, id: 'x', day: 4 }).total).toBe(3);
    });

    test('hubDay no cuenta dos veces lo que ya pasó en el reloj del gremio', () => {
        // D-J12: antes de volver, el gremio sumaba los once días de Strahd a su día 3.
        const before = readHub({ campaigns: { strahd: { worldName: 'Strahd', day: 12 } } });
        expect(hubDay({ hub: before, day: 3 })).toBe(14);
        // H16: al volver, el reloj del gremio salta esos once (y el viaje): ya no se suman.
        const after = withHubCampaign(before, 'strahd', { synced: 11 });
        expect(hubDay({ hub: after, day: 3 + 11 + 18 })).toBe(32);
        // Una partida de antes (sin `synced`) sigue como estaba.
        expect(readHub({ campaigns: { x: { worldName: 'X', synced: 'no' } } }).campaigns.x).not.toHaveProperty('synced');
    });
});
