/**
 * D-J33: las historias de los tres mercenarios del gremio (Gerd, Nella y Osric), revisadas.
 * Cada uno tiene un arco de rango 1 a 4 que acaba en su misión personal; lo que se siembra en
 * una escena se paga en otra, y nada de lo que cuentan contradice al juego ni a sus charlas.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { readMeetupRows, scenesFor, unlocksAt, renderScene, personOf } from '../public/scripts/game-engine/campaign/meetups.js';
import { readTalkRows } from '../public/scripts/game-engine/campaign/small-talk.js';
import { HIRELINGS, MERCENARY_FEE } from '../public/scripts/game-engine/campaign/guests.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const data = readMeetupRows(read('compendio/quedadas.json'));
const talkRows = readTalkRows(read('compendio/charlas.json'));
const HERO = { name: 'Tessa', gender: 'Mujer' };

/** De dónde es la misión de cada uno, y lo que se siembra antes y se paga después. */
const STORIES = {
    'Gerd el Mellado': { place: 'Robledo', seeds: [[2, /No sé leer/], [3, /ESTOY BIEN MADRE/], [4, /Ahora que sé leer/]] },
    'Nella Tresflechas': { place: 'Hoz', seeds: [[1, /El de antes era peor/], [2, /Tobías/], [3, /la Ratera/], [4, /Tobías/]] },
    'Osric Mediapaga': { place: 'Valdés', seeds: [[1, /me pagaron la mitad/], [2, /«Gaviota»/], [3, /Media paga/], [3, /anillo/], [4, /«Gaviota»/]] },
};

/**
 * Las escenas de alguien, resueltas para una heroína, con todo su texto junto.
 *
 * @param {string} name
 * @returns {Array<{rank: number, title: string, text: string}>}
 */
function scenesOf(name) {
    return scenesFor({ person: { name }, data }).map(scene => {
        const shown = renderScene(scene, { hero: HERO, party: [HERO] });
        const text = shown.beats.flatMap((/** @type {any} */ b) => [b.note, b.say, ...b.replies.flatMap((/** @type {any} */ r) => [r.text, r.then])]).join(' ');
        return { rank: scene.rank, title: scene.title, text };
    });
}

/**
 * Las frases sueltas de las charlas de alguien (las suyas y tus respuestas).
 *
 * @param {string} name
 * @returns {string[]}
 */
function talkOf(name) {
    return talkRows.filter(r => r.who === name).flatMap(r => [...r.lines, ...r.replies.flatMap(p => [p.text, p.then])]);
}

/**
 * Lo que cuenta un final de la misión personal de alguien.
 *
 * @param {string} name
 * @param {string} id
 * @returns {string}
 */
function ending(name, id) {
    const [mission] = unlocksAt(data, name, 4).filter(u => u.type === 'mision');
    return String(mission?.quest?.endings.find((/** @type {any} */ e) => e.id === id)?.summary);
}

/** Frases de un texto, para compararlas una a una. */
const sentences = (/** @type {string} */ text) => text.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);

describe('D-J33: las historias de los mercenarios', () => {
    test('son los tres del gremio, con su oficio y su género en todas partes', () => {
        expect(Object.keys(STORIES).sort()).toEqual(HIRELINGS.map(h => h.name).sort());
        for (const hireling of HIRELINGS) {
            const person = personOf(data, hireling.name);
            expect([hireling.name, person?.gender, person?.className]).toEqual([hireling.name, hireling.gender, hireling.className]);
        }
        expect(HIRELINGS.map(h => [h.name, h.gender])).toEqual([['Gerd el Mellado', 'Hombre'], ['Nella Tresflechas', 'Mujer'], ['Osric Mediapaga', 'Hombre']]);
    });

    test('cada arco acaba en su misión: la escena de rango 4 la plantea, en el sitio de la misión, con dos finales que cuestan algo distinto', () => {
        for (const [name, { place }] of Object.entries(STORIES)) {
            const [mission] = unlocksAt(data, name, 4).filter(u => u.type === 'mision');
            const four = scenesOf(name).find(s => s.rank === 4);
            expect([name, mission?.quest?.where.includes(place)]).toEqual([name, true]);
            expect([name, four?.text.includes(place)]).toEqual([name, true]);
            const endings = mission.quest.endings;
            expect(endings).toHaveLength(2);
            expect(new Set(endings.map((/** @type {any} */ e) => e.summary)).size).toBe(2);
            for (const e of endings) expect([name, e.id, e.summary.length > 60]).toEqual([name, e.id, true]);
        }
    });

    test('lo que se siembra en una escena se paga en otra', () => {
        for (const [name, { seeds }] of Object.entries(STORIES)) {
            const scenes = scenesOf(name);
            for (const [rank, pattern] of seeds) {
                const scene = scenes.find(s => s.rank === rank);
                expect([name, rank, String(pattern), pattern.test(String(scene?.text))]).toEqual([name, rank, String(pattern), true]);
            }
        }
        // Y los finales recogen lo sembrado: el cartel de Nella, la guardia y la vela de Osric.
        expect(ending('Nella Tresflechas', 'carcel')).toMatch(/cartel/);
        expect(ending('Osric Mediapaga', 'verdad')).toMatch(/guardia/);
        expect(ending('Osric Mediapaga', 'mentira')).toMatch(/vela/);
        expect(ending('Gerd el Mellado', 'plantar-cara')).toMatch(/recibos/);
        // La flecha que Nella te deja en el rango 4 vuelve en los dos finales, y la barca de Osric
        // depende de cómo acabe lo del anillo.
        expect(scenesOf('Nella Tresflechas').find(s => s.rank === 4)?.text).toMatch(/plumas rojas/);
        for (const id of ['multa', 'carcel']) expect(ending('Nella Tresflechas', id)).toMatch(/flecha de plumas rojas/);
        expect(ending('Osric Mediapaga', 'verdad')).toMatch(/compra la «Gaviota»/);
        expect(ending('Osric Mediapaga', 'mentira')).toMatch(/«Gaviota» sigue en venta/);
    });

    test('las cuentas cuadran con el juego: la barca vale más que un encargo, y Gerd paga la renta al señor', () => {
        // Un mercenario cobra MERCENARY_FEE por encargo (y nivel): una barca de treinta monedas se
        // compraría con un solo encargo, y no haría falta ahorrar.
        const osric = scenesOf('Osric Mediapaga').map(s => s.text).join(' ');
        const price = /(\S+) monedas de oro y es mía/.exec(osric)?.[1];
        expect(price).toBe('Trescientas');
        expect(300).toBeGreaterThan(MERCENARY_FEE * 3);
        // Lo que Gerd manda a Robledo es la renta, que lleva un mensajero al señor: si fuera dinero
        // para su madre, ella habría notado en tres años que no llegaba.
        const gerd = [...talkOf('Gerd el Mellado'), ...scenesOf('Gerd el Mellado').map(s => s.text)].join(' ');
        expect(gerd).not.toMatch(/mando la mitad a Robledo, a mi madre|Le mando dinero/);
        expect(gerd).toMatch(/renta de la casa/);
        // Nadie sabe que Osric se durmió: el mayordomo le echó porque volvió entero y su señor no.
        expect(osric).toMatch(/Todos creen que no pude con los bandidos/);
    });

    test('nada promete una segunda paga: al mercenario se le paga una vez, al contratarlo', () => {
        const everyone = [...Object.keys(STORIES), 'Brunilda'];
        const said = everyone.flatMap(name => [...talkOf(name), ...scenesOf(name).map(s => s.text)]).join(' ');
        expect(said).not.toMatch(/la otra mitad,? cuando|mitad por adelantado|la mitad antes y la mitad después/i);
    });

    test('Osric hace siempre la guardia: ninguna frase suya la rehúye', () => {
        const said = [...talkOf('Osric Mediapaga'), ...scenesOf('Osric Mediapaga').map(s => s.text)].join(' ');
        expect(said).not.toMatch(/la haga otro|no me llevo bien/);
        expect(said).toMatch(/la guardia la hago yo/);
    });

    test('cada uno se presenta a su manera, y una charla no destripa la gracia de una escena', () => {
        const openers = Object.keys(STORIES).map(name => sentences(scenesOf(name).find(s => s.rank === 1)?.text ?? '').slice(0, 3).join(' '));
        expect(openers.filter(o => /¿Sabes por qué me llaman/.test(o)).length).toBeLessThanOrEqual(1);
        for (const name of Object.keys(STORIES)) {
            const scene = new Set(scenesOf(name).flatMap(s => sentences(s.text)).filter(s => s.length > 25));
            const repeated = talkOf(name).flatMap(sentences).filter(s => scene.has(s));
            expect([name, repeated]).toEqual([name, []]);
        }
        // El escudo en la boca es el remate de «Los dientes»: la charla de después de una pelea solo lo anuncia.
        expect(talkOf('Gerd el Mellado').join(' ')).not.toMatch(/escudo en toda la boca/);
    });
});
