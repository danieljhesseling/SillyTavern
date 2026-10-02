/**
 * Los Gems al día (2026-10-02): los romances y las misiones personales que trae una campaña, el
 * aspecto de cada persona, y las reglas y muestras que se le enseñan al Gem.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    storyRowsOf, companionStoryRows, readCompanionStories, withCampaignRows, checkCompanionStories, hasStories, STORIES_KEY,
} from '../public/scripts/game-engine/campaign/companion-stories.js';
import { readRomanceCards, readRomanceRows, romanceCardOf, canRomance, hasWrittenRomance } from '../public/scripts/game-engine/campaign/romance.js';
import { readQuestRows, questInfo, checkQuest } from '../public/scripts/game-engine/campaign/companion-quests.js';
import { readMeetupRows, unlockedFor, scenesFor } from '../public/scripts/game-engine/campaign/meetups.js';
import { buildImportPlan, buildPackEntries } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { normalizePack, validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { getSectionSchema, getPackRules, buildGemInstructions } from '../public/scripts/game-engine/campaign/campaign-pack-schema.js';
import { readCampaignText } from '../public/scripts/game-engine/campaign/campaign-import.js';
import { learnFromLine, knowsName } from '../public/scripts/game-engine/campaign/known-people.js';
import {
    WRITING_RULES, writingRulesText, buildConversationSamplePack, buildCompanionSample,
} from '../public/scripts/game-engine/campaign/gem-guide.js';

const json = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const lia = () => buildCompanionSample();
const fullSample = () => ({ ...buildConversationSamplePack(), confidants: [lia()] });

describe('el romance de un compañero de campaña', () => {
    test('sale con la forma de compendio/companeros.json y romances.json', () => {
        const rows = storyRowsOf(lia());
        expect(rows.companeros).toEqual([{ who: 'Lía Remos', short: 'Lía', romance: { with: 'todos', no: expect.any(String) } }]);
        expect(rows.romances.map(r => `${r.kind}${r.step ?? ''}`)).toEqual(['cita1', 'cita2', 'cita3', 'final', 'pareja', 'epilogo']);
        expect(rows.romances.every(r => r.who === 'Lía Remos')).toBe(true);
    });

    test('el lector de siempre lo lee junto al del compendio, y se puede jugar', () => {
        const own = companionStoryRows({ confidants: [lia()] });
        const compendioCards = json('public/compendio/companeros.json');
        const compendioScenes = json('public/compendio/romances.json');
        const cards = readRomanceCards(withCampaignRows(compendioCards, own.companeros));
        const data = readRomanceRows(withCampaignRows(compendioScenes, own.romances));
        const card = romanceCardOf(cards, 'Lía Remos');
        expect(card?.with).toEqual(['todos']);
        expect(hasWrittenRomance(data, 'Lía Remos')).toBe(true);
        expect(canRomance(card, data, { gender: 'Hombre' })).toBe(true);
        // Lo del compendio sigue ahí: Nella y la señal común.
        expect(romanceCardOf(cards, 'Nella Tresflechas')).not.toBeNull();
        expect(data.scenes.some(s => s.key === '*' && s.stage === 'senal')).toBe(true);
        expect(data.epilogues['lia-remos'].away).toMatch(/Punta Gris/);
    });

    test('«nadie» o un romance a medias: avisa al comprobar el paquete', () => {
        const broken = lia();
        broken.romance.escenas = broken.romance.escenas.filter((/** @type {any} */ s) => !(s.kind === 'cita' && s.step === 3));
        const warnings = checkCompanionStories({ confidants: [broken] });
        expect(warnings.map(w => w.message).join(' ')).toMatch(/no saldrá: le falta la cita 3/);
        const nobody = { name: 'Ezequiel', romance: { with: 'nadie', no: 'No.' } };
        expect(checkCompanionStories({ confidants: [nobody] })).toEqual([]);
    });
});

describe('la misión personal de un compañero de campaña', () => {
    test('sale con la forma de personales.json, y lo que abre su rango con la de quedadas.json', () => {
        const rows = storyRowsOf(lia());
        const [row] = readQuestRows(rows.personales);
        expect(row).toMatchObject({ who: 'Lía Remos', key: 'lia-remos', start: 'ida' });
        const meet = readMeetupRows(withCampaignRows(json('public/compendio/quedadas.json'), rows.quedadas));
        const info = questInfo(meet, row.quest);
        expect(info?.title).toBe('La barca de mi tío');
        expect(info?.rank).toBe(4);
        expect(info?.endings.map(e => e.id)).toEqual(['perdonar', 'recuperar']);
        expect(unlockedFor(meet, 'Lía Remos', 3).some(u => u.type === 'mision')).toBe(false);
        expect(unlockedFor(meet, 'Lía Remos', 4).some(u => u.type === 'mision')).toBe(true);
        expect(checkQuest(row, info)).toEqual([]);
    });

    test('una sin finales, o con un paso que no lleva a nada, avisa', () => {
        const broken = lia();
        broken.misionPersonal.endings = [];
        expect(checkCompanionStories({ confidants: [broken] }).map(w => w.message).join(' ')).toMatch(/no dice sus finales/);
        const lost = lia();
        lost.misionPersonal.steps[0].next = 'a-ninguna-parte';
        expect(checkCompanionStories({ confidants: [lost] }).map(w => w.message).join(' ')).toMatch(/a-ninguna-parte/);
    });

    // Lo arreglado de paso: `checkQuest` sacaba de la cola uno por cada paso mirado, y ninguna
    // misión llegaba a sus finales.
    test('las del compendio llegan a sus dos finales', () => {
        const meet = readMeetupRows(json('public/compendio/quedadas.json'));
        for (const row of readQuestRows(json('public/compendio/personales.json'))) {
            expect(checkQuest(row, questInfo(meet, row.quest))).toEqual([]);
        }
    });
});

describe('las escenas de vínculo escritas como conversación', () => {
    test('se juegan como las de quedadas.json, y mandan sobre la prosa de su rango', () => {
        const rows = storyRowsOf(lia());
        const meet = readMeetupRows(rows.quedadas);
        const scene = meet.scenes.find(s => s.key === 'lia-remos' && s.rank === 2);
        expect(scene?.beats.length).toBe(2);
        expect(scene?.beats[1].replies.map(r => r.bond)).toEqual([1, 0]);
        const both = scenesFor({ person: { name: 'Lía Remos', scenes: [{ rank: 2, title: 'Prosa', scene: 'Lía mira el mar.' }] }, data: meet, campaign: 'tuya-la-luz-de-punta-gris' });
        expect(both.filter(s => s.rank === 2).map(s => s.title)).toEqual(['Las rocas de la punta']);
    });
});

describe('un compañero de campaña que dice su nombre de pila', () => {
    // Está dos veces en la gente del mundo (en el lorebook y entre los confidentes): «Lía» no
    // parecía solo suya, y «Me llamo Lía» no la presentaba.
    test('se presenta aunque venga en las dos listas', () => {
        const people = [{ name: 'Lía Remos', gender: 'Mujer', id: 'lia' }, { name: 'Lía Remos', className: 'Pícaro' }];
        const heard = learnFromLine(null, { who: 'Lía Remos', text: 'Me llamo Lía. Conozco cada roca de la punta.' }, { people });
        expect(heard.learned.map(l => l.name)).toEqual(['Lía Remos']);
        expect(knowsName('Lía Remos', { state: heard.state, people })).toBe(true);
    });
});

describe('lo que se guarda en el mundo', () => {
    test('el importador guarda los romances y las misiones, y el aspecto de cada uno', () => {
        const plan = buildImportPlan(fullSample());
        const stories = readCompanionStories(plan.metadata[STORIES_KEY]);
        expect(hasStories(stories)).toBe(true);
        expect(stories.romances.length).toBe(6);
        expect(stories.personales.length).toBe(1);
        const entries = buildPackEntries(normalizePack(fullSample()).pack);
        const byName = Object.fromEntries(entries.map(e => [e.title, e.dndData]));
        expect(byName['Lía Remos'].aspecto).toMatch(/pelo corto/);
        expect(byName['Marta Salmuera'].aspecto).toMatch(/delantal/);
    });

    test('sin romances ni misiones, no se guarda nada', () => {
        expect(buildImportPlan(buildConversationSamplePack()).metadata[STORIES_KEY]).toBeUndefined();
    });

    test('lo guardado se lee con forma aunque llegue roto, y lo de la campaña va delante', () => {
        expect(readCompanionStories('nada')).toEqual({ companeros: [], romances: [], personales: [], quedadas: [] });
        expect(withCampaignRows({ rows: [{ id: 'a' }] }, [{ id: 'b' }]).map(r => r.id)).toEqual(['b', 'a']);
        expect(withCampaignRows([{ id: 'a' }], []).map(r => r.id)).toEqual(['a']);
    });
});

describe('el contrato y lo que se le enseña al Gem', () => {
    test('las personas traen su aspecto, y los compañeros su romance y su misión', () => {
        const confidant = getSectionSchema('confidants').items.properties;
        expect(Object.keys(confidant)).toEqual(expect.arrayContaining(['aspecto', 'romance', 'misionPersonal', 'gender', 'id']));
        expect(getSectionSchema('npcs').items.properties.aspecto.type).toBe('string');
        expect(getSectionSchema('heroes').items.properties.aspecto.type).toBe('string');
        const rules = getPackRules().join(' ');
        expect(rules).toMatch(/aspecto/);
        expect(rules).toMatch(/D-J54/);
        expect(buildGemInstructions()).toContain('"misionPersonal"');
    });

    test('las escenas se escriben como conversaciones: alt, reply, more y chose', () => {
        const plot = JSON.stringify(getSectionSchema('plot'));
        expect(plot).toMatch(/"alt"/);
        const talks = JSON.stringify(getSectionSchema('dialogues'));
        for (const field of ['"reply"', '"more"', '"chose"']) expect(talks).toContain(field);
    });

    test('las reglas de cómo se escribe cubren cada decisión, con su ejemplo bueno y malo', () => {
        const why = WRITING_RULES.map(r => r.why);
        for (const decision of ['D-J54', 'J13.7', 'D-J56', 'D-J58', 'D-J46']) expect(why).toContain(decision);
        for (const rule of WRITING_RULES) {
            expect(rule.good.length).toBeGreaterThan(10);
            expect(rule.bad.length).toBeGreaterThan(10);
        }
        expect(writingRulesText()).toMatch(/Así no/);
    });

    test('la muestra corta entra entera por «Añadir una campaña»', () => {
        const report = readCampaignText(JSON.stringify(buildConversationSamplePack()));
        expect(report.ok).toBe(true);
        expect(report.check?.verdict).toBe('lista');
        const full = readCampaignText(JSON.stringify(fullSample()));
        expect(full.ok).toBe(true);
        expect(validatePack(full.pack).warnings.filter(w => /^confidants/.test(w.path))).toEqual([]);
    });

    test('la muestra cuenta la historia hablando, con aspecto y presentaciones', () => {
        const pack = buildConversationSamplePack();
        for (const person of [...pack.npcs, ...pack.confidants]) expect(person.aspecto).toBeTruthy();
        for (const milestone of pack.plot.milestones) {
            const beats = milestone.beats;
            const narrator = beats.filter((/** @type {any} */ b) => !b.who);
            expect(narrator.length).toBeLessThanOrEqual(1);
            expect(beats.length - narrator.length).toBeGreaterThan(narrator.length);
        }
        // El farero habla antes de que le presenten, y le presenta otro en voz alta.
        const first = pack.plot.milestones[0].beats;
        const spoke = first.findIndex((/** @type {any} */ b) => b.who === 'Ezequiel Rocamar');
        const told = first.findIndex((/** @type {any} */ b) => b.presenta === 'ezequiel');
        expect(spoke).toBeGreaterThan(-1);
        expect(told).toBeGreaterThan(spoke);
        // Nadie le nombra antes.
        expect(first.slice(0, told).some((/** @type {any} */ b) => /Ezequiel/.test(b.text))).toBe(false);
    });
});
