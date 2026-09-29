import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import {
    genderOf, groupGender, gendered, resolveGender, resolveGenderDeep, leftoverMarkers, genderHacks, GENDER,
} from '../public/scripts/game-engine/campaign/grammar.js';
import { GENDERS, buildHeroEntry } from '../public/scripts/game-engine/campaign/hero.js';
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
    test('cada opción del creador de personajes dice algo: mujer, hombre, no binario o sin decir', () => {
        expect(GENDERS.map(genderOf)).toEqual([GENDER.F, GENDER.M, GENDER.N, '']);
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

    test('la tercera forma, para quien no dice su género o es no binario', () => {
        const line = 'Estás {cansado|cansada|sin fuerzas}.';
        expect(resolveGender(line, { heroe: 'No binario' })).toBe('Estás sin fuerzas.');
        expect(resolveGender(line, { heroe: '' })).toBe('Estás sin fuerzas.');
        expect(resolveGender(line, { heroe: 'Mujer' })).toBe('Estás cansada.');
        expect(resolveGender('Estás {cansado|cansada}.', { heroe: 'No binario' })).toBe('Estás cansado.');
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
    pack: [
        /^\.plot\.milestones\[\d+\]\.(scene|hint)$/,
        /^\.plot\.endings\.[^.]+\.scene$/,
        /^\.confidants\[\d+\]\.scenes\[\d+\]\.scene$/,
        // J8.1: las charlas con ramas (`dialogues.js` las resuelve con tu héroe antes de enseñarlas).
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.(line|again|journal)$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.options\[\d+\]\.(text|tag|journal)$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\]\.options\[\d+\]\.check\.(success|partial|failure)\.journal$/,
        /^\.dialogues\[\d+\]\.nodes\[\d+\](\.options\[\d+\](\.check\.(success|partial|failure))?)?\.effects\[\d+\]\.clue$/,
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
        // Una marca en el tablón de una campaña (que no pasa por el motor) no vale; en el hilo, sí.
        const mark = /** @type {any} */ ({ quests: [{ description: 'Si subes {entero|entera}' }], plot: { milestones: [{ scene: 'Sal {vivo|viva}' }] } });
        const paths = stringsOf(mark).filter(s => s.text.match(MARK)).map(s => s.path);
        expect(paths.filter(path => !RESOLVED.pack.some(pattern => pattern.test(path)))).toEqual(['.quests[0].description']);
    });

    test('las frases de los compañeros también se leen enteras', () => {
        const lines = [...Object.values(BARKS), ...Object.values(OPINIONS)].flatMap(set => Object.values(set).flat());
        expect(lines.flatMap(line => leftoverMarkers(line))).toEqual([]);
        expect(lines.flatMap(line => genderHacks(line))).toEqual([]);
    });
});
