import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import {
    genderOf, groupGender, gendered, resolveGender, resolveGenderDeep, leftoverMarkers, genderHacks, thirdForms, GENDER, whoOfParty,
} from '../public/scripts/game-engine/campaign/grammar.js';
import {
    GENDERS, TEXT_FORMS, buildHeroEntry, heroGender, needsTextForm, textFormLine, heroContent,
} from '../public/scripts/game-engine/campaign/hero.js';
import { narrate, fill } from '../public/scripts/game-engine/campaign/engine-narrator.js';
import { pickSucesos, sucesoById } from '../public/scripts/game-engine/campaign/sucesos.js';
import { guestMember, HIRELINGS } from '../public/scripts/game-engine/campaign/guests.js';
import { chooseBark, opinionOf, BARKS, OPINIONS } from '../public/scripts/game-engine/combat/barks.js';
import { bodyOf } from '../public/scripts/game-engine/campaign/body.js';
import { describeWarning } from '../public/scripts/game-engine/campaign/departures.js';
import { desireLine } from '../public/scripts/game-engine/campaign/feats.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const frases = read('compendio/frases.json').rows;
const sucesos = read('compendio/sucesos.json').rows;

describe('el género del texto (J1.4 y J13.3)', () => {
    test('cada opción del creador de personajes dice algo: mujer, hombre o no binario', () => {
        expect(GENDERS.map(genderOf)).toEqual([GENDER.F, GENDER.M, GENDER.N]);
        // El texto libre de siempre también vale, y una ficha con su género.
        expect(['femenino', 'Ella', 'f'].map(genderOf)).toEqual(['f', 'f', 'f']);
        expect(['masculino', 'Él', 'm'].map(genderOf)).toEqual(['m', 'm', 'm']);
        expect(genderOf({ gender: 'Mujer' })).toBe('f');
        expect(genderOf('lo que sea')).toBe('');
    });

    test('la misma frase, con los dos géneros', () => {
        const line = 'Si subes {entero|entera}, eres de los nuestros.';
        expect(resolveGender(line, { heroe: 'Mujer' })).toBe('Si subes entera, eres de los nuestros.');
        expect(resolveGender(line, { heroe: 'Hombre' })).toBe('Si subes entero, eres de los nuestros.');
        // Sin decir, la forma de siempre; nunca las llaves.
        expect(resolveGender(line, { heroe: 'Sin especificar' })).toBe('Si subes entero, eres de los nuestros.');
        expect(resolveGender(line)).toBe('Si subes entero, eres de los nuestros.');
    });

    test('D-J15: quien es no binario elige cómo le habla el texto, y se guarda con su género', () => {
        // Como en D&D, el género no cambia ninguna regla: solo si el texto dice «cansado» o «cansada».
        expect(TEXT_FORMS.map(f => f.id)).toEqual(['m', 'f']);
        expect(GENDERS.filter(needsTextForm)).toEqual(['No binario']);
        expect(heroGender('No binario', 'f')).toBe('No binario (en femenino)');
        expect(heroGender('No binario', 'm')).toBe('No binario (en masculino)');
        // Con «Mujer» u «Hombre» no se pregunta; sin elegir forma, se queda como está.
        expect(heroGender('Mujer', 'm')).toBe('Mujer');
        expect(heroGender('No binario', '')).toBe('No binario');
        expect(needsTextForm('No binario (en femenino)')).toBe(false);
        expect(needsTextForm('')).toBe(false);
        const line = 'Estás {cansado|cansada}.';
        expect(resolveGender(line, { heroe: 'No binario (en femenino)' })).toBe('Estás cansada.');
        expect(resolveGender(line, { heroe: 'No binario (en masculino)' })).toBe('Estás cansado.');
        expect(genderOf({ gender: 'No binario (en femenino)' })).toBe('f');
        // Y el grupo: dos no binarias que eligieron femenino, en femenino.
        expect(resolveGender('Llegáis {empapados|empapadas}.', { grupo: ['No binario (en femenino)', 'Mujer'] })).toBe('Llegáis empapadas.');
        // Lo que se le dice al elegir.
        expect(textFormLine('No binario (en femenino)')).toBe('El texto te habla en femenino: «cansada», «lista».');
        expect(textFormLine('Hombre')).toBe('El texto te habla en masculino: «cansado», «listo».');
        expect(textFormLine('')).toBe('Sin elegir, el texto te habla en masculino.');
        // El narrador lo lee en la ficha.
        expect(heroContent({ name: 'Ari', gender: 'No binario (en femenino)', race: 'Humano', className: 'Soldado' }))
            .toBe('Ari: No binario (en femenino) · Humano · Soldado.');
    });

    test('una tercera forma de una partida vieja se sigue leyendo, pero el contenido no la lleva', () => {
        const line = 'Estás {cansado|cansada|sin fuerzas}.';
        expect(resolveGender(line, { heroe: 'No binario' })).toBe('Estás sin fuerzas.');
        expect(resolveGender(line, { heroe: '' })).toBe('Estás sin fuerzas.');
        expect(resolveGender(line, { heroe: 'Mujer' })).toBe('Estás cansada.');
        expect(resolveGender(line, { heroe: 'No binario (en masculino)' })).toBe('Estás cansado.');
        expect(resolveGender('Estás {cansado|cansada}.', { heroe: 'No binario' })).toBe('Estás cansado.');
        expect(thirdForms(line)).toEqual(['{cansado|cansada|sin fuerzas}']);
        expect(thirdForms('Estás {cansado|cansada} en {sitio}.')).toEqual([]);
    });

    test('en plural concuerda con el grupo: todas mujeres, femenino; con algún hombre, masculino', () => {
        const line = 'Llegáis {empapados|empapadas}.';
        expect(resolveGender(line, { heroe: 'Mujer', grupo: ['Mujer', 'Mujer'] })).toBe('Llegáis empapadas.');
        expect(resolveGender(line, { heroe: 'Mujer', grupo: ['Mujer', 'Hombre'] })).toBe('Llegáis empapados.');
        // Sin grupo, el héroe solo.
        expect(resolveGender(line, { heroe: 'Mujer' })).toBe('Llegáis empapadas.');
        expect(groupGender(['Mujer', ''])).toBe('');
        expect(groupGender(['No binario', 'No binario'])).toBe('n');
    });

    test('con otra persona de la frase, por su hueco; y a mano, con heroe: o grupo:', () => {
        const who = { heroe: 'Hombre', grupo: ['Hombre', 'Mujer'], quien: 'Mujer' };
        expect(resolveGender('{quien:seguro|segura} y {entero|entero}', who)).toBe('segura y entero');
        expect(resolveGender('eres {heroe:de los nuestros|de las nuestras}', { heroe: 'Mujer', grupo: ['Hombre'] })).toBe('eres de las nuestras');
        expect(resolveGender('{grupo:solo|sola}', { heroe: 'Hombre', grupo: ['Mujer'] })).toBe('sola');
        // Un hueco del que no se sabe nada (alguien de fuera del grupo): la forma de siempre.
        expect(resolveGender('{companero:callado|callada}', who)).toBe('callado');
        expect(gendered({ gender: 'Mujer' }, 'herido', 'herida')).toBe('herida');
    });

    test('los huecos de siempre no se tocan, y un objeto se resuelve por dentro', () => {
        expect(resolveGender('Llegáis a {sitio}.', { heroe: 'Mujer' })).toBe('Llegáis a {sitio}.');
        const plot = { milestones: [{ scene: 'Sal {vivo|viva}.', act: 1 }], endings: { x: { scene: 'Eres {rico|rica}.' } } };
        expect(resolveGenderDeep(plot, { heroe: 'Mujer' })).toEqual({ milestones: [{ scene: 'Sal viva.', act: 1 }], endings: { x: { scene: 'Eres rica.' } } });
        expect(plot.milestones[0].scene).toBe('Sal {vivo|viva}.');
    });

    test('las marcas mal escritas y los apaños se ven', () => {
        expect(leftoverMarkers('bien {a|b} y {a|b|c}')).toEqual([]);
        expect(leftoverMarkers('mal {a|b|c|d}')).toEqual(['{a|b|c|d}']);
        expect(leftoverMarkers('sin cerrar {a|b')).toEqual(['{a|b']);
        expect(genderHacks('cansado/a, todos/as, cansado(a), tod@s, todxs, {o/a}')).toHaveLength(6);
        expect(genderHacks('Quedan 2 día(s). Blanco/azul. Escribe a dj@correo.es')).toEqual([]);
    });

    test('el narrador del motor: la misma llegada con lluvia, para ellas y para ellos', () => {
        const facts = { sitio: 'Vane', tiempo: 'lluvia', hora: 'tarde' };
        const rain = frases.filter((/** @type {any} */ r) => r.id === 'llegada-lluvia');
        const told = (/** @type {string[]} */ grupo) => narrate({ rows: rain, moment: 'llegada', facts: { ...facts, generos: { heroe: grupo[0], grupo } }, random: () => 0 }).text;
        expect(told(['Mujer', 'Mujer'])).toBe('Llegáis a Vane empapadas, con la lluvia de cara.');
        expect(told(['Mujer', 'Hombre'])).toBe('Llegáis a Vane empapados, con la lluvia de cara.');
        // Sin decir quién juega, como siempre.
        expect(fill('Llegáis a {sitio} {empapados|empapadas}.', { sitio: 'Vane' })).toBe('Llegáis a Vane empapados.');
        // Con {quien}, lo suyo: quien tira no es siempre el héroe.
        const lie = frases.find((/** @type {any} */ r) => r.id === 'tirada-bien-cuela');
        expect(fill(lie.text, { quien: 'Tessa', generos: { heroe: 'Hombre', quien: 'Mujer' } })).toBe('Tessa lo dice tan segura que hasta suena a verdad.');
    });

    test('un suceso junto al fuego, con su compañera', () => {
        const facts = { companero: 'Nella', generos: { heroe: 'Hombre', grupo: ['Hombre', 'Mujer'], companero: 'Mujer' } };
        const card = sucesoById(sucesos, 'hoguera-historia', facts);
        expect(card?.text).toBe('Junto al fuego, Nella se queda callada mucho rato. Parece que quiere contar algo.');
        expect(card?.options.map((/** @type {any} */ o) => o.then)).toEqual([
            'Habla de antes de todo esto. Se le nota más ligera al acabar.',
            'Se duerme la primera.',
        ]);
        // Y el vado, con el grupo: con un hombre, «todos».
        const ford = pickSucesos({ rows: sucesos.filter((/** @type {any} */ r) => r.id === 'puente-roto'), moment: 'viaje', facts, random: () => 0 })[0];
        expect(ford.options[0].success?.then).toBe('El agua llega al pecho, pero pasáis todos.');
    });

    test('lo que dicen y lo que se dice de los compañeros, con el suyo', () => {
        const nella = { name: 'Nella', gender: 'Mujer', hp: 5, maxHp: 20 };
        expect(bodyOf(nella)).toBe('Nella: muy malherida.');
        expect(bodyOf({ ...nella, dead: true })).toBe('Nella: muerta.');
        expect(describeWarning(nella)).toMatch(/^Nella está harta/);
        expect(desireLine({ wants: 'coin', hpPct: 100, tired: true, gender: 'Mujer' })).toBe('Está agotada: pide una noche bajo techo.');
        expect(chooseBark({ event: 'ally_down', wants: 'knowledge', about: 'Nella', aboutGender: 'Mujer', random: () => 0.99 })).toBe('¡Nella ha caído, cubridla!');
        expect(chooseBark({ event: 'ally_down', wants: 'knowledge', about: 'Gerd', aboutGender: 'Hombre', random: () => 0.99 })).toBe('¡Gerd ha caído, cubridlo!');
        const curious = opinionOf('knowledge', { kind: 'recover' }, { random: () => 0.7, gender: 'Hombre' });
        expect(curious?.line).toBe('Hay algo detrás de esto, estoy seguro.');
    });

    test('el género se guarda en la ficha, y el mercenario lleva el suyo, no el del héroe', () => {
        expect(buildHeroEntry({ name: 'Tessa', gender: 'Mujer' }).dndData.gender).toBe('Mujer');
        const hero = { name: 'Tessa', gender: 'Mujer' };
        const gerd = guestMember({ id: 2, name: 'Gerd el Mellado', kind: 'mercenary', contractId: 'x', level: 1, base: hero, stats: HIRELINGS[0] });
        expect(gerd.gender).toBe('Hombre');
        const ward = guestMember({ id: 3, name: 'El viajero', kind: 'ward', contractId: 'x', level: 1, base: hero });
        expect(ward.gender).toBe('');
    });
});

/**
 * Dónde puede ir una marca de género en el contenido: en los textos que el motor resuelve
 * antes de enseñarlos (las frases, los sucesos, y del guion de una campaña, el hilo —que
 * pasa por `getPlot`— y las escenas de vínculo, que van al chat). En cualquier otro sitio
 * llegaría a la pantalla tal cual.
 */
const RESOLVED = {
    'compendio/frases.json': [/^\.rows\[\d+\]\.text$/],
    'compendio/sucesos.json': [/^\.rows\[\d+\]\.text$/, /^\.rows\[\d+\]\.options\[\d+\]\.(label|then|success\.then|fail\.then)$/],
    // J14: las charlas (`small-talk.js`) y las escenas de quedada (`renderScene` de `meetups.js`).
    'compendio/charlas.json': [/^\.rows\[\d+\]\.lines\[\d+\]$/, /^\.rows\[\d+\]\.replies\[\d+\]\.(text|then)$/],
    'compendio/quedadas.json': [/^\.rows\[\d+\]\.beats\[\d+\]\.(note|say)$/, /^\.rows\[\d+\]\.beats\[\d+\]\.replies\[\d+\]\.(text|then)$/],
    // D-J17: la sinopsis de la tarjeta del tablón (`hub-panel.js`, con quien va).
    // Y el camino hasta la campaña (`journeyLine`, que sale por `postForModel`).
    'mundos/mundos.json': [/^\.worlds\[\d+\]\.synopsis$/, /^\.worlds\[\d+\]\.journey\.how$/],
    pack: [
        /^\.plot\.milestones\[\d+\]\.(scene|hint)$/,
        /^\.plot\.endings\.[^.]+\.scene$/,
        /^\.confidants\[\d+\]\.scenes\[\d+\]\.scene$/,
        // D-J17: la sinopsis (el tablón, el creador de personajes y el narrador), la ficha de
        // un confidente (al conocerle, por el narrador), los rumores (al oírlos y en el diario),
        // las misiones (la nota de su tablero en la exploración) y los epílogos (con el hilo).
        /^\.world\.synopsis$/,
        /^\.world\.journey\.how$/,
        /^\.confidants\[\d+\]\.description$/,
        /^\.rumors\[\d+\]\.text$/,
        /^\.quests\[\d+\]\.description$/,
        /^\.plot\.endings\.[^.]+\.epilogues\[\d+\]\.text$/,
        // D-J22: los capítulos del hilo, en el libro de la historia (`story-book.js` los resuelve).
        /^\.plot\.chapters\[\d+\]\.(title|summary)$/,
        // Lo que se descubre al cumplir un encargo escrito: va al chat (`postForModel`).
        /^\.contracts\[\d+\]\.twist$/,
        // J8.1: las charlas con ramas (`dialogues.js` las resuelve con tu héroe antes de enseñarlas).
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.(line|again|journal)$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.options\[\d+\]\.(text|tag|journal)$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.options\[\d+\]\.check\.(success|partial|failure)\.journal$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\](\.options\[\d+\](\.check\.(success|partial|failure))?)?\.effects\[\d+\]\.clue$/,
        // J9.2: las escenas del hilo (`plot-scenes.js` las resuelve con tu héroe y tu grupo).
        /^\.plot\.milestones\[\d+\]\.beats\[\d+\](\.text)?$/,
        /^\.plot\.milestones\[\d+\]\.beats\[\d+\]\.options\[\d+\]\.(text|tag|journal)$/,
        /^\.plot\.milestones\[\d+\]\.beats\[\d+\]\.options\[\d+\](\.check\.(success|partial|failure))?\.reply(\[\d+\])?(\.text)?$/,
        /^\.plot\.milestones\[\d+\]\.beats\[\d+\]\.options\[\d+\](\.check\.(success|partial|failure))?\.(journal|effects\[\d+\]\.clue)$/,
    ],
};

/** Todos los textos de un JSON, con su ruta. */
const stringsOf = (/** @type {any} */ value, path = '') => {
    /** @type {Array<{path: string, text: string}>} */
    const out = [];
    if (typeof value === 'string') out.push({ path, text: value });
    else if (Array.isArray(value)) value.forEach((item, i) => out.push(...stringsOf(item, `${path}[${i}]`)));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) out.push(...stringsOf(item, `${path}.${key}`));
    return out;
};

const MARK = /\{(?:([a-z_]+):)?[^{}|]*\|[^{}]*\}/g;
const files = [
    ...readdirSync(new URL('../public/compendio/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => `compendio/${f}`),
    ...readdirSync(new URL('../public/mundos/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => `mundos/${f}`),
];

/**
 * Lo que está mal en un archivo de contenido: apaños, marcas mal escritas, marcas donde no
 * se resuelven y huecos delante que no están en la frase. Vacío si está bien.
 *
 * @param {string} file
 * @returns {string[]}
 */
function problemsOf(file) {
    const data = read(file);
    const allowed = RESOLVED[/** @type {keyof typeof RESOLVED} */ (file)] ?? (file.endsWith('.pack.json') ? RESOLVED.pack : []);
    /** @type {string[]} */
    const problems = [];
    for (const { path, text } of stringsOf(data)) {
        for (const hack of genderHacks(text)) problems.push(`${file} ${path}: «${hack}» (escríbelo con {forma|forma})`);
        // Las explicaciones para quien escribe (`about`) enseñan la sintaxis: no se pintan.
        if (path === '.about') continue;
        for (const bad of leftoverMarkers(text)) problems.push(`${file} ${path}: «${bad}» no es una marca que se entienda`);
        // D-J15: solo dos formas; quien es no binario elige cuál.
        for (const third of thirdForms(text)) problems.push(`${file} ${path}: «${third}» lleva tercera forma (quítala: el texto habla en masculino o en femenino)`);
        const marks = [...text.matchAll(MARK)];
        if (marks.length === 0) continue;
        if (!allowed.some(pattern => pattern.test(path))) {
            problems.push(`${file} ${path}: aquí una marca de género llegaría tal cual a la pantalla`);
            continue;
        }
        // Un hueco delante tiene que ser alguien de la frase: {quien:…} con {quien} en ella.
        const row = Number(path.match(/^\.rows\[(\d+)\]/)?.[1]);
        const own = Number.isInteger(row) ? JSON.stringify(data.rows?.[row] ?? '') : '';
        for (const [mark, key] of marks) {
            if (key && key !== 'heroe' && key !== 'grupo' && !text.includes(`{${key}}`) && !own.includes(`{${key}}`)) {
                problems.push(`${file} ${path}: «${mark}» concuerda con {${key}}, que no está en la frase`);
            }
        }
    }
    return problems;
}

describe('el contenido, sin marcas a la vista ni apaños (J1.4)', () => {
    test('las frases, los sucesos, el compendio y los guiones de las campañas', () => {
        expect(files.length).toBeGreaterThan(10);
        expect(files.flatMap(problemsOf)).toEqual([]);
    });

    test('y el comprobador ve lo que tiene que ver', () => {
        // Una marca en lo que quiere alguien del pueblo (que no pasa por el motor) no vale; en el
        // hilo, en una misión o en lo que se descubre de un encargo (D-J17), sí.
        const mark = /** @type {any} */ ({
            npcs: [{ wants: 'Que subas {entero|entera}' }],
            contracts: [{ twist: 'Murieron antes que {vosotros|vosotras}' }],
            quests: [{ description: 'De qué estáis {hechos|hechas}' }],
            plot: { milestones: [{ scene: 'Sal {vivo|viva}' }] },
        });
        const paths = stringsOf(mark).filter(s => s.text.match(MARK)).map(s => s.path);
        expect(paths.filter(path => !RESOLVED.pack.some(pattern => pattern.test(path)))).toEqual(['.npcs[0].wants']);
    });

    test('las frases de los compañeros también se leen enteras', () => {
        const lines = [...Object.values(BARKS), ...Object.values(OPINIONS)].flatMap(set => Object.values(set).flat());
        expect(lines.flatMap(line => leftoverMarkers(line))).toEqual([]);
        expect(lines.flatMap(line => genderHacks(line))).toEqual([]);
    });
});

describe('D-J17: 1387 y Strahd hablan a quien juega, también fuera del hilo', () => {
    const p1387 = read('mundos/1387.pack.json');
    const strahd = read('mundos/strahd.pack.json');
    const worlds = read('mundos/mundos.json').worlds;
    const her = { heroe: 'Mujer', grupo: ['Mujer', 'Mujer'] };
    const him = { heroe: 'Hombre', grupo: ['Hombre'] };

    test('la sinopsis, la ficha de Isolda, el rumor del forastero y la misión de la taberna', () => {
        expect(resolveGender(p1387.world.synopsis, her)).toMatch(/^Eres una mercenaria .* te vas a quedar atrapada\./);
        expect(resolveGender(p1387.world.synopsis, him)).toMatch(/^Eres un mercenario .* te vas a quedar atrapado\./);
        const isolda = p1387.confidants.find((/** @type {any} */ c) => c.name === 'Isolda');
        expect(resolveGender(isolda.description, her)).toMatch(/eres la única que no la trata/);
        const rumor = p1387.rumors.find((/** @type {any} */ r) => /forastera/.test(r.text));
        expect(resolveGender(rumor.text, her)).toBe('A la mercenaria forastera le pagaron un cáliz por matar al recaudador. Pobre diabla: la van a colgar igual.');
        expect(resolveGender(rumor.text, him)).toBe('Al mercenario forastero le pagaron un cáliz por matar al recaudador. Pobre diablo: lo van a colgar igual.');
        const tavern = strahd.quests.find((/** @type {any} */ q) => q.id === 'q_taberna');
        expect(resolveGender(tavern.description, her)).toMatch(/de qué estáis hechas\.$/);
        expect(resolveGender(tavern.description, { heroe: 'Mujer', grupo: ['Mujer', 'Hombre'] })).toMatch(/de qué estáis hechos\.$/);
        const card = worlds.find((/** @type {any} */ w) => w.id === '1387');
        expect(resolveGender(card.synopsis, her)).toMatch(/te deja coja/);
    });

    test('las pantallas que los enseñan fuera del chat los resuelven', async () => {
        const { buildExplorationView } = await import('../public/scripts/game-engine/ui/shell/exploration-scene.js');
        const { buildJournal } = await import('../public/scripts/game-engine/campaign/guidance.js');
        const { buildNarratorCard } = await import('../public/scripts/game-engine/campaign/narrator.js');
        // La exploración: la nota de un tablero sale de sus misiones, con el grupo.
        const view = buildExplorationView({
            locationMaps: [{ name: 'Taberna', description: 'Aquí estáis {solos|solas}.', boards: [{ name: 'Sala', description: 'De qué estáis {hechos|hechas}.' }] }],
            currentLocation: 'Taberna',
            party: [{ id: 1, name: 'Tessa', gender: 'Mujer', hp: 10, maxHp: 10 }, { id: 2, name: 'Nella', gender: 'Mujer', hp: 10, maxHp: 10 }],
        });
        expect(view.description).toBe('Aquí estáis solas.');
        expect(view.boards[0].note).toBe('De qué estáis hechas.');
        // El diario: lo oído, con quien juega; sin decirlo, la primera forma y nunca las llaves.
        const heard = [{ text: '{Al mercenario forastero|A la mercenaria forastera} lo sabe.', by: 'Giles' }];
        const told = (/** @type {any} */ who) => buildJournal({ open: [], heard, who }).find(s => s.title === 'Lo que se oye')?.items[0];
        expect(told({ heroe: 'Mujer' })).toBe('«A la mercenaria forastera lo sabe.» (Giles)');
        expect(told(undefined)).toBe('«Al mercenario forastero lo sabe.» (Giles)');
        // El narrador lee la sinopsis sin llaves.
        const narrator = buildNarratorCard({ name: 'Voz' }, { worldName: '1387', synopsis: p1387.world.synopsis, heroGender: 'Mujer' });
        expect(narrator.scenario).toMatch(/Eres una mercenaria/);
        expect(buildNarratorCard({ name: 'Voz' }, { synopsis: p1387.world.synopsis }).scenario).not.toMatch(/[{}|]/);
    });

    test('un rumor oído en una charla o una escena se apunta ya concordado', async () => {
        const { applySceneEffects } = await import('../public/scripts/game-engine/campaign/plot-scenes.js');
        const rumors = p1387.rumors;
        const out = applySceneEffects([{ kind: 'rumor', id: 'r-el-pago-del-asesino' }], { rumors, who: her });
        expect(out.notes[0]).toMatch(/^Apuntado en el Diario: «A la mercenaria forastera /);
        expect(out.heard[0].text).toMatch(/^A la mercenaria forastera /);
        // Sin decir quién juega: la primera forma, nunca las llaves.
        const plain = applySceneEffects([{ kind: 'rumor', id: 'r-el-pago-del-asesino' }], { rumors });
        expect(plain.notes[0]).not.toMatch(/[{}|]/);
    });

    test('Barovia también le habla a quien juega: la sinopsis, en el paquete y en la tarjeta', () => {
        const card = worlds.find((/** @type {any} */ w) => w.id === 'strahd');
        for (const synopsis of [strahd.world.synopsis, card.synopsis]) {
            // En singular, como la de 1387: se lee al crear el personaje y en el tablón, con quien va.
            expect(resolveGender(synopsis, her)).toMatch(/estás atrapada en su dominio\./);
            expect(resolveGender(synopsis, { heroe: 'No binario (en masculino)', grupo: ['Mujer'] })).toMatch(/estás atrapado en su dominio\./);
            // Ya no «Los aventureros han sido arrastrados»: se le habla a quien juega.
            expect(synopsis).not.toMatch(/aventureros/);
        }
        // Lo que no pasa por el motor se escribe sin nada que concuerde con quien juega.
        const krezk = strahd.contracts.find((/** @type {any} */ c) => /Krezk os abre/.test(c.rewardText ?? ''));
        expect(krezk.rewardText).toBe('25 de oro, y Krezk os abre sus puertas');
        expect(strahd.contracts.map((/** @type {any} */ c) => c.rewardText).join(' ')).not.toMatch(/vosotros/);
    });

    test('las pantallas fuera de party.js saben quién juega por el grupo guardado', () => {
        // Como `whoPlays`: tu héroe es el primero que no es invitado; el grupo, los que siguen en pie.
        const party = [
            { name: 'Gerd', gender: 'Hombre', guest: true },
            { name: 'Tessa', gender: 'No binario (en femenino)' },
            { name: 'Nella', gender: 'Mujer' },
            { name: 'Osric', gender: 'Hombre', dead: true },
        ];
        expect(whoOfParty(party)).toEqual({ heroe: 'No binario (en femenino)', grupo: ['Hombre', 'No binario (en femenino)', 'Mujer'] });
        expect(resolveGender('Eres {el único|la única}.', whoOfParty(party))).toBe('Eres la única.');
        // Sin grupo guardado (la ventana de antes de empezar), la primera forma y nunca las llaves.
        expect(whoOfParty(undefined)).toEqual({ heroe: '', grupo: [] });
        expect(resolveGender(strahd.world.synopsis, whoOfParty(null))).toMatch(/estás atrapado/);
        expect(resolveGender(strahd.world.synopsis, whoOfParty(null))).not.toMatch(/[{}|]/);
    });

    test('Ismark saluda al grupo que llega, y el camino a Barovia también concuerda', () => {
        const ismark = strahd.plot.milestones[0].beats.find((/** @type {any} */ b) => /Soy Ismark/.test(b.text ?? ''));
        expect(resolveGender(ismark.text, her)).toMatch(/^Forasteras\./);
        expect(resolveGender(ismark.text, { heroe: 'Mujer', grupo: ['Mujer', 'Hombre'] })).toMatch(/^Forasteros\./);
        const barovia = worlds.find((/** @type {any} */ w) => w.id === 'strahd');
        expect(resolveGender(barovia.journey.how, her)).toMatch(/detrás de vosotras\.$/);
    });

    test('D-J18: los finales de 1387 dicen qué fue de la gente, y concuerdan', () => {
        const endings = Object.values(p1387.plot.endings);
        expect(endings.every((/** @type {any} */ e) => Array.isArray(e.epilogues) && e.epilogues.length >= 3)).toBe(true);
        const eva = strahd.plot.endings['la-caravana-se-va'].epilogues.find((/** @type {any} */ e) => e.who === 'Madam Eva');
        expect(resolveGender(eva.text, her)).toBe('Madam Eva se despide solo de vosotras. De la gente del valle, de nadie.');
    });
});
