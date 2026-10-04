/**
 * D-J60 (Daniel, 2026-10-02): «la figura del narrador en un juego sin conexión no la quiero».
 * En la caja de la novela todo lo dice alguien que está allí; lo demás va en un aviso pequeño
 * fuera de la caja. Aquí se guarda que los paquetes no vuelvan a traer líneas del narrador y que
 * las ventanas repartan bien lo que va a la caja y lo que va al aviso.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { checkPlotScenes } from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { WRITING_RULES, buildConversationSamplePack } from '../public/scripts/game-engine/campaign/gem-guide.js';
import { getPackRules } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { isAsideKind, splitLines, ASIDE_KINDS } from '../public/scripts/game-engine/ui/vn-aside.js';
import { foldNarration } from '../public/scripts/game-engine/ui/plot-scene.js';
import { voiceNote } from '../public/scripts/game-engine/campaign/narration-voices.js';
import { journeyLine } from '../public/scripts/game-engine/campaign/hub.js';
import { homecomingScene } from '../public/scripts/game-engine/campaign/campaign-end.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const PACKS = ['gremio', '1387', 'strahd'];

/**
 * Cada línea de las escenas de un hilo que no dice nadie: las líneas (`beats`), sus otras
 * versiones y lo que se oye al elegir (`reply`, también el de cada tirada). Una línea escrita
 * como texto suelto es del narrador.
 *
 * @param {any} plot
 * @returns {string[]} Dónde está cada una.
 */
function narratorLines(plot) {
    /** @type {string[]} */
    const found = [];
    /** @param {any} raw @param {string} path */
    const line = (raw, path) => {
        if (raw == null) return;
        if (Array.isArray(raw)) {
            raw.forEach((one, i) => line(one, `${path}[${i}]`));
            return;
        }
        if (typeof raw === 'string') {
            if (raw.trim()) found.push(path);
            return;
        }
        if (typeof raw === 'object' && String(raw.text ?? '').trim() && !String(raw.who ?? '').trim()) found.push(path);
    };
    (plot?.milestones ?? []).forEach((/** @type {any} */ m, i) => {
        (m?.beats ?? []).forEach((/** @type {any} */ beat, b) => {
            const at = `${m.id}.beats[${b}]`;
            line(beat, at);
            for (const option of beat?.options ?? []) {
                line(option.reply, `${at}.${option.id}.reply`);
                for (const outcome of ['success', 'partial', 'failure']) {
                    const branch = option.check?.[outcome];
                    if (typeof branch === 'string') line(branch, `${at}.${option.id}.${outcome}`);
                    else line(branch?.reply, `${at}.${option.id}.${outcome}.reply`);
                }
            }
        });
        if (!m?.id) found.push(`milestones[${i}] sin id`);
    });
    return found;
}

describe('D-J60: los paquetes no traen ni una línea del narrador', () => {
    for (const id of PACKS) {
        test(`${id}: cada línea de cada escena, y cada respuesta, la dice alguien`, () => {
            const pack = read(`../public/mundos/${id}.pack.json`);
            expect(narratorLines(pack.plot)).toEqual([]);
        });
    }

    test('las plantillas de los actos (las campañas sin hilo escrito), tampoco', () => {
        const rows = read('../public/compendio/actos.json').rows;
        const parts = rows.flatMap((/** @type {any} */ row) => Object.entries(row)
            .filter(([, value]) => value && typeof value === 'object' && Array.isArray(/** @type {any} */ (value).beats))
            .map(([key, value]) => ({ id: `${row.id}.${key}`, beats: /** @type {any} */ (value).beats })));
        expect(parts.length).toBeGreaterThan(10);
        expect(narratorLines({ milestones: parts })).toEqual([]);
    });

    test('la guarda encuentra las líneas del narrador: un texto suelto, una línea sin who y una respuesta sin who', () => {
        const plot = {
            milestones: [{
                id: 'a',
                beats: [
                    'Cae la noche.',
                    { text: 'Llegáis al puerto.' },
                    { who: 'Tomás', text: '¿Me ayudas?', options: [{ id: 'si', text: 'Sí.', reply: { text: 'Te lo agradece.' } }, { id: 'tirar', text: 'Tiro.', check: { success: { reply: { who: 'Tomás', text: 'Bien.' } }, failure: 'Nada.' } }] },
                ],
            }],
        };
        expect(narratorLines(plot)).toEqual(['a.beats[0]', 'a.beats[1]', 'a.beats[2].si.reply', 'a.beats[2].tirar.failure']);
    });

    test('al comprobar un paquete, cada línea sin who sale como aviso, diciendo que no hay narrador', () => {
        const found = checkPlotScenes({
            milestones: [{ id: 'a', title: 'A', scene: 'Texto.', beats: ['Cae la noche.', { text: 'Llegáis.' }, { who: 'Tomás', text: 'Hola.', options: [{ text: 'Hola.', reply: { text: 'Sonríe.' } }] }] }],
        }, { people: ['Tomás'] });
        const said = found.warnings.filter(w => /D-J60/.test(w.message)).map(w => w.path);
        expect(said).toEqual([
            'plot.milestones[0].beats[0]',
            'plot.milestones[0].beats[1].who',
            'plot.milestones[0].beats[2].options[0].reply.who',
        ]);
        expect(found.errors).toEqual([]);
    });
});

describe('D-J60: lo que se le enseña al Gem', () => {
    test('la regla de las conversaciones ya no deja ninguna línea al narrador', () => {
        const rule = WRITING_RULES.find(r => r.id === 'conversaciones');
        expect(rule?.why).toBe('D-J60');
        expect(rule?.rule).toMatch(/No hay narrador/);
        expect(rule?.rule).not.toMatch(/casi desaparece|línea sin `who`, corta/);
        expect(rule?.good).toMatch(/"who"/);
        const rules = getPackRules().join(' ');
        expect(rules).toMatch(/D-J60/);
        expect(rules).not.toMatch(/Una línea sin `who` es del narrador/);
    });

    test('la muestra corta: todas las líneas de sus escenas las dice alguien', () => {
        expect(narratorLines(buildConversationSamplePack().plot)).toEqual([]);
    });
});

describe('D-J60: en la caja, solo lo que dice alguien', () => {
    test('lo que no dice nadie va al aviso de fuera de la caja; lo que se dice, a la caja, en orden', () => {
        expect(ASIDE_KINDS).toEqual(expect.arrayContaining(['narration', 'note', 'roll', 'summary', 'refused']));
        for (const kind of ['say', 'you', 'then']) expect(isAsideKind(kind)).toBe(false);
        const lines = [
            { kind: 'narration', text: 'Cae la noche.' },
            { kind: 'you', text: 'Yo me encargo.' },
            { kind: 'roll', text: '🎲 Persuasión 15 contra 12: sale.' },
            { kind: 'say', text: '¡Gracias!' },
            { kind: 'note', text: 'Tomás os mira mejor.' },
            { kind: 'say', text: '   ' },
        ];
        expect(splitLines(lines)).toEqual({
            box: [{ kind: 'you', text: 'Yo me encargo.' }, { kind: 'say', text: '¡Gracias!' }],
            aside: [{ kind: 'narration', text: 'Cae la noche.' }, { kind: 'roll', text: '🎲 Persuasión 15 contra 12: sale.' }, { kind: 'note', text: 'Tomás os mira mejor.' }],
        });
        expect(splitLines(/** @type {any} */ (null))).toEqual({ box: [], aside: [] });
    });

    test('una pantalla en la que no habla nadie se junta con la siguiente (o con la anterior, si es la última)', () => {
        const frame = (/** @type {number} */ beat, /** @type {string} */ who, /** @type {string} */ kind, /** @type {any} */ extra = {}) => ({
            beat, who, mood: 'neutral', lines: [{ kind: /** @type {any} */ (kind), text: `línea ${beat}` }], ask: false, ...extra,
        });
        const folded = foldNarration([
            frame(0, '', 'narration', { presenta: 'tomas' }),
            frame(1, 'Tomás', 'say'),
            frame(2, '', 'narration', { ask: true }),
            frame(3, 'Tomás', 'say'),
            frame(4, '', 'narration'),
        ]);
        expect(folded.map(f => [f.beat, f.who, f.lines.map(l => l.kind)])).toEqual([
            [1, 'Tomás', ['narration', 'say']],
            // Una decisión se queda en su pantalla: hay que elegir en ella.
            [2, '', ['narration']],
            [3, 'Tomás', ['say', 'narration']],
        ]);
        // J13.7: quien se presentaba en la línea juntada sigue presentándose.
        expect(folded[0].presenta).toBe('tomas');
        // Una escena solo de narrador (un paquete de antes): una pantalla, con la caja vacía.
        expect(foldNarration([frame(0, '', 'narration'), frame(1, '', 'narration')]).map(f => f.lines.length)).toEqual([2]);
        expect(foldNarration([])).toEqual([]);
    });
});

describe('D-J60: el viaje a una campaña y el presagio, sin narrador (el bug de Strahd)', () => {
    const bank = read('../public/compendio/frases.json').rows;
    const strahd = (read('../public/mundos/mundos.json').worlds ?? read('../public/mundos/mundos.json')).find((/** @type {any} */ w) => w.id === 'strahd');
    const omens = '🔮 [HILO] El presagio: «Una adivina os echará las cartas.» «El conde os invitará a cenar.»';
    const gerd = { name: 'Gerd el Mellado', gender: 'm' };
    const voice = (/** @type {string} */ note, /** @type {any} */ scene) => voiceNote(note, { told: note, scene, rows: bank, seed: 'prueba', who: { heroe: 'f', grupo: ['f'] } });
    /** La prosa del narrador que salía: «Salís de…», «Vais en carro…», «volvéis…». */
    const PROSE = /\b(Salís|Vais|volvéis)\b|niebla se cierra/u;

    test('de Puerto Alba a Barovia: lo dice uno de los tuyos; a solas, un dato corto, sin la prosa', () => {
        const there = `[VIAJE] ${journeyLine({ world: strahd, home: 'Puerto Alba' })}`;
        expect(there).toMatch(/^\[VIAJE\] Salís de Puerto Alba hacia Barovia\. .+ Nueve días de camino\.$/u);
        const said = voice(there, { companions: [gerd], party: [gerd] });
        expect(said).toMatchObject({ mode: 'line', who: 'Gerd el Mellado', kind: 'voz-viaje-ida' });
        expect(said.text).toMatch(/Barovia/);
        expect(said.text).toMatch(/nueve días/i);
        expect(said.text).not.toMatch(PROSE);
        expect(voice(there, {})).toEqual({ mode: 'notice', fact: true, text: 'De Puerto Alba a Barovia: nueve días de camino.' });
    });

    test('la vuelta, igual: «por fin en casa» o el dato', () => {
        const back = `[VIAJE] ${journeyLine({ world: strahd, home: 'Puerto Alba', back: true })}`;
        const said = voice(back, { companions: [gerd], party: [gerd] });
        expect(said).toMatchObject({ mode: 'line', who: 'Gerd el Mellado', kind: 'voz-viaje-vuelta' });
        expect(said.text).not.toMatch(PROSE);
        expect(voice(back, {})).toEqual({ mode: 'notice', fact: true, text: 'De vuelta en Puerto Alba, tras nueve días de camino.' });
        const guild = `[VIAJE] ${journeyLine({ world: strahd, home: 'el gremio', back: true })}`;
        expect(voice(guild, {}).text).toBe('De vuelta en el gremio, tras nueve días de camino.');
        expect(voice(`[VIAJE] ${journeyLine({ world: strahd, home: 'el gremio' })}`, {}).text).toBe('Del gremio a Barovia: nueve días de camino.');
    });

    test('el presagio lo dice el posadero de aquí; si no, uno de los tuyos; si no, alguien del sitio; y sin nadie, al aviso', () => {
        const arik = { name: 'Arik Lorensk', gender: 'm' };
        const donavich = { name: 'Donavich', gender: 'm' };
        const inn = voice(omens, { keepers: { posada: arik }, companions: [gerd], locals: [donavich, arik] });
        expect(inn).toMatchObject({ mode: 'line', who: 'Arik Lorensk', kind: 'voz-presagio-gente' });
        expect(inn.text).toContain('«Una adivina os echará las cartas.» «El conde os invitará a cenar.»');
        expect(voice(omens, { companions: [gerd], locals: [donavich] })).toMatchObject({ mode: 'line', who: 'Gerd el Mellado', kind: 'voz-presagio-companero' });
        expect(voice(omens, { locals: [donavich] })).toMatchObject({ mode: 'line', who: 'Donavich', kind: 'voz-presagio-gente' });
        const alone = voice(omens, {});
        expect(alone).toMatchObject({ mode: 'notice', fact: true });
        expect(alone.text).toMatch(/^Lo que se cuenta que va a pasar \(lo tienes en el Diario\): «Una adivina/u);
        expect(alone.text).not.toMatch(/^El presagio:/u);
    });

    test('la vuelta al gremio tras el final: la noticia la da quien lleva el gremio, con el brindis y la fama', () => {
        const scene = `[GREMIO] ${homecomingScene({ campaign: 'La Maldición de Strahd', ending: 'La caravana se va', home: 'Puerto Alba', fallen: ['Gerd el Mellado'] })} `
            + 'Desde hoy, en Puerto Alba os conocen como quienes echaron a Strahd.';
        const said = voice(scene, { keepers: { gremio: { name: 'Brunilda', gender: 'f' } }, companions: [gerd] });
        expect(said).toMatchObject({ mode: 'line', who: 'Brunilda', kind: 'voz-gremio-final' });
        expect(said.text).toContain('La Maldición de Strahd');
        expect(said.text).toContain('«La caravana se va»');
        expect(said.text).toContain('Gerd el Mellado');
        expect(said.text).toContain('quienes echaron a Strahd');
        expect(said.text).not.toMatch(/Os reciben|ya se sabe cómo acabó La Maldición de Strahd: La/u);
        expect(voice(scene, {})).toEqual({
            mode: 'notice', fact: true,
            text: 'La Maldición de Strahd, terminada: «La caravana se va». Se brinda por Gerd el Mellado. Desde hoy os conocen como quienes echaron a Strahd.',
        });
    });

    test('un rumor lo dice quien lo cuenta, y una pista alguien del lugar; el atajo es un dato', () => {
        const rumor = voice('[RUMOR] el viejo vistani cuenta: «Nadie encontró el cuerpo del mago.»', {});
        expect(rumor).toMatchObject({ mode: 'line', who: 'El viejo vistani', text: 'Nadie encontró el cuerpo del mago.' });
        const hint = voice('[PISTA] El grupo lleva días sin avanzar. Que les llegue esto por boca de alguien del lugar, con naturalidad y sin nombrar reglas: La adivina vive junto al estanque.', {});
        expect(hint.mode).toBe('line');
        expect(['Una vecina', 'Un vecino', 'Un viejo del lugar']).toContain(hint.who);
        expect(hint.text).toBe('La adivina vive junto al estanque.');
        const shortcut = voiceNote('[ATAJO] De paso, alguien menciona esto: Un camino de pastores acorta el viaje entre A y B: 1 día(s).', {
            told: '[ATAJO] De paso, alguien menciona esto: un camino de pastores acorta el viaje entre A y B: un día.', scene: {}, rows: bank, seed: 'prueba',
        });
        expect(shortcut).toEqual({ mode: 'notice', fact: true, text: 'Un camino de pastores acorta el viaje entre A y B: un día.' });
    });
});
