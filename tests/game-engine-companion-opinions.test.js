import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    optionTraits, opinionsOn, opinionBadges, opinionNotes, verdictsOf, findOption, importantOption,
} from '../public/scripts/game-engine/campaign/companion-opinions.js';
import { readCompanionCards } from '../public/scripts/game-engine/campaign/companion-cards.js';
import { readDialogue } from '../public/scripts/game-engine/campaign/dialogues.js';
import { milestoneScene } from '../public/scripts/game-engine/campaign/plot-scenes.js';
import { readPlot } from '../public/scripts/game-engine/campaign/plot.js';
import {
    addMark, readMarks, rememberedGreeting, rememberedPrice, markRumors, reactionsAt,
} from '../public/scripts/game-engine/campaign/world-marks.js';
import { guildGreeting, rememberCampaign, endingLegacy, homecomingLegacyLine } from '../public/scripts/game-engine/campaign/guild-memory.js';
import {
    NO_RETURN, weightyMilestones, optionNoReturn, actionNoReturn, noReturnConfirm,
} from '../public/scripts/game-engine/campaign/weighty.js';

const json = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const cards = readCompanionCards(json('compendio/companeros.json'));
const echoes = json('compendio/ecos.json').rows;

/** Tessa, que juega, con Gerd (le gusta echar una mano y tratar bien) y Nella (no le gusta pagar). */
const party = [
    { id: 'tessa', name: 'Tessa' },
    { id: 'gerd', name: 'Gerd el Mellado', hp: 12, guest: { kind: 'hireling' } },
    { id: 'nella', name: 'Nella Tresflechas', hp: 10, guest: { kind: 'hireling' } },
];

/** Una opción como la lee el motor de charlas. */
const read = (/** @type {any} */ option) => readDialogue({ id: 'x', speaker: 'Tomás', start: 'a', nodes: [{ id: 'a', line: '…', options: [{ text: '…', end: true, ...option }] }] })?.nodes[0].options[0];

describe('J7.5: lo que opinan tus compañeros, a la vista al decidir', () => {
    test('lo que es una opción sale de lo que hace: pagar, tratar bien, la tirada', () => {
        expect(optionTraits(read({ effects: [{ gold: -3 }] }))).toEqual(['pagar']);
        expect(optionTraits(read({ effects: [{ attitude: 1 }] }))).toEqual(['amable']);
        expect(optionTraits(read({ check: { skill: 'intimidation', dc: 12, success: {}, failure: {} } }))).toContain('amenazar');
    });

    test('`decision` escrita en la opción llega leída (dialogues.js) y cuenta', () => {
        const option = read({ decision: 'apostar' });
        expect(option.decision).toEqual(['apostar']);
        expect(optionTraits(option)).toContain('apostar');
        // Sin escribirla, la opción leída no la lleva.
        expect(read({}).decision).toBeUndefined();
    });

    test('tratar bien a quien tienes delante le gusta a Gerd; pagar no le gusta a Nella', () => {
        const kind = opinionsOn({ option: read({ effects: [{ attitude: 1 }] }), party, cards });
        expect(opinionBadges(kind).map(b => b.text)).toEqual(['A Gerd le gusta esto']);
        const pay = opinionsOn({ option: read({ effects: [{ gold: -2 }] }), party, cards });
        // A Gerd, que va por el oro, tampoco: los dos en una etiqueta.
        expect(opinionBadges(pay).find(b => b.mood < 0)?.text).toBe('A Gerd y a Nella no les gusta esto');
    });

    test('quien juega no opina de sí mismo, ni los caídos', () => {
        const alone = opinionsOn({ option: read({ effects: [{ attitude: 1 }] }), party: [party[0]], cards });
        expect(alone).toEqual([]);
        const fallen = opinionsOn({ option: read({ effects: [{ attitude: 1 }] }), party: [party[0], { ...party[1], dead: true }], cards });
        expect(fallen).toEqual([]);
    });

    test('al elegir, se dice en llano, en singular y en plural', () => {
        const kind = opinionsOn({ option: read({ effects: [{ attitude: 1 }] }), party, cards });
        expect(opinionNotes(kind)).toEqual(['A Gerd le ha gustado.']);
        const cold = opinionNotes([
            { id: 'g', name: 'Gerd el Mellado', short: 'Gerd', mood: -1, want: 'coin', trait: 'pagar', what: 'pagar' },
            { id: 'n', name: 'Nella', short: 'Nella', mood: -1, want: 'glory', trait: 'pagar', what: 'pagar' },
        ]);
        expect(cold).toEqual(['A Gerd y a Nella no les ha gustado.']);
        expect(opinionNotes([])).toEqual([]);
    });

    test('y cuenta para el vínculo: cada opinión es una aprobación con el id de su ficha', () => {
        const kind = opinionsOn({ option: read({ effects: [{ attitude: 1 }] }), party, cards });
        expect(verdictsOf(kind)).toEqual([expect.objectContaining({ id: 'gerd', mood: 1 })]);
    });

    test('en la escena del muelle del gremio, «Yo me encargo» le gusta a Gerd y pedir paga no', () => {
        const gremio = json('mundos/gremio.pack.json');
        const plot = readPlot(gremio.plot);
        const milestone = plot?.milestones.find(m => m.id === 'el-muelle');
        const scene = milestoneScene(milestone, { hero: { name: 'Tessa', gender: 'Mujer' }, party });
        const dialogue = scene?.beats.find(b => b.decision)?.decision?.dialogue;
        const mine = findOption(dialogue, 'yo-me-encargo');
        const paid = findOption(dialogue, 'cuanto-pagas');
        expect(opinionBadges(opinionsOn({ option: mine, party, cards })).map(b => b.text)).toContain('A Gerd le gusta esto');
        expect(opinionBadges(opinionsOn({ option: paid, party, cards })).some(b => b.mood < 0)).toBe(true);
    });
});

describe('J11.3: el mundo se acuerda de lo que hicisteis (lo que usa el pueblo)', () => {
    const caught = addMark([], { deed: 'robo', town: 'Puerto Alba', place: 'tienda', day: 4 });

    test('robar y que os pillen deja una huella en el pueblo, en la tienda', () => {
        expect(readMarks(caught)).toEqual([{ deed: 'robo', town: 'Puerto Alba', place: 'tienda', who: '', day: 4 }]);
    });

    test('quien atiende la tienda os saluda sabiendo lo que hicisteis; en otro pueblo, no', () => {
        const place = { kind: 'tienda', keeper: { name: 'Marisa' } };
        const said = rememberedGreeting({ place, town: 'Puerto Alba', marks: caught, rows: echoes, today: 5, slot: 'Tarde', hero: { name: 'Tessa', gender: 'Mujer' } });
        expect(said).toMatch(/Marisa/);
        expect(said).not.toMatch(/[{}]/);
        expect(rememberedGreeting({ place, town: 'Vallaki', marks: caught, rows: echoes, today: 5 })).toBe('');
    });

    test('en la tienda, más caro y con su porqué; y se olvida con el tiempo', () => {
        const price = rememberedPrice({ marks: caught, rows: echoes, town: 'Puerto Alba', place: 'tienda', today: 5 });
        expect(price.factor).toBeGreaterThan(1);
        expect(price.label).toMatch(/robando/);
        expect(rememberedPrice({ marks: caught, rows: echoes, town: 'Puerto Alba', place: 'tienda', today: 60 }).factor).toBe(1);
    });

    test('la reacción que manda es de la tienda, para la cara de quien atiende', () => {
        const echo = reactionsAt({ marks: caught, rows: echoes, town: 'Puerto Alba', place: 'tienda', today: 5 })[0]?.echo;
        expect(echo?.price).toBeGreaterThan(1);
    });

    test('lo que se cuenta en el pueblo sale una vez', () => {
        const told = markRumors({ marks: caught, rows: echoes, town: 'Puerto Alba', today: 5 });
        const again = markRumors({ marks: caught, rows: echoes, town: 'Puerto Alba', today: 5, told: told.map(r => r.id) });
        expect(again).toEqual([]);
    });
});

describe('J11.1: lo que no tiene vuelta atrás, lo que usan las ventanas y el tablero', () => {
    const strahd = readPlot(json('mundos/strahd.pack.json').plot);

    test('el hito que acaba la campaña pesa, y una opción que lo cumple avisa', () => {
        const weighty = weightyMilestones(strahd);
        expect(weighty['el-senor-de-barovia']).toBe(NO_RETURN);
        expect(optionNoReturn(read({ effects: [{ milestone: 'el-senor-de-barovia' }] }), { weighty })).toBe(NO_RETURN);
        expect(optionNoReturn(read({ effects: [{ attitude: 1 }] }), { weighty })).toBe('');
    });

    test('entrar a ganar en la cripta, con su hito abierto, pregunta antes; sin abrir, no', () => {
        const event = { kind: 'win', place: 'Castillo Ravenloft', board: 'La Cripta de Strahd' };
        const open = { open: ['el-senor-de-barovia'], done: [], since: { 'el-senor-de-barovia': 1 } };
        expect(actionNoReturn({ plot: strahd, state: open, event, today: 2 })).toBe(NO_RETURN);
        expect(actionNoReturn({ plot: strahd, state: { open: [], done: [] }, event, today: 2 })).toBe('');
        const ask = noReturnConfirm({ warning: NO_RETURN, what: 'Entrar en La Cripta de Strahd' });
        expect(ask.text).toBe('Entrar en La Cripta de Strahd. Lo que pase después no se puede deshacer.');
    });
});

describe('J11.4: de una campaña a otra, lo que el gremio recuerda', () => {
    const strahd = json('mundos/strahd.pack.json');
    const legacy = endingLegacy(strahd.plot, 'barovia-libre');

    test('el final de Strahd deja un legado con cómo os llaman', () => {
        expect(legacy?.legacy?.title).toMatch(/^quienes /);
        expect(homecomingLegacyLine({ legacy: legacy?.legacy, home: 'Puerto Alba', hero: { name: 'Tessa', gender: 'Mujer' } }))
            .toMatch(/^Desde hoy, en Puerto Alba os conocen como quienes /);
    });

    test('Brunilda os saluda sabiendo cómo acabó, las semanas después de volver', () => {
        const memory = rememberCampaign(null, { id: 'strahd', name: 'La Maldición de Strahd', ending: legacy?.ending, endingTitle: legacy?.endingTitle ?? '', legacy: legacy?.legacy, day: 20 });
        const place = { kind: 'gremio', keeper: { name: 'Brunilda' } };
        expect(guildGreeting({ memory, place, today: 22, slot: 'Mañana', hero: { name: 'Tessa', gender: 'Mujer' } })).toMatch(/^Brunilda deja lo que estaba haciendo al verte: «Buenos días, Tessa\./);
        expect(guildGreeting({ memory, place, today: 60 })).toBe('');
        expect(guildGreeting({ memory, place: { kind: 'tienda', keeper: { name: 'Marisa' } }, today: 22 })).toBe('');
    });
});

describe('D-J48: el grupo solo opina en las charlas importantes', () => {
    const gremio = readDialogue(json('mundos/gremio.pack.json').dialogues[0]);
    const option = (/** @type {string} */ id) => findOption(gremio, id);

    test('toda una escena del hilo es importante', () => {
        expect(importantOption({ text: '¿Qué tal?' }, { scene: true })).toBe(true);
        expect(importantOption(read({ effects: [{ rumor: 'x' }] }), { scene: true })).toBe(true);
    });

    test('lo que marca quien escribe: lo que es, sin vuelta atrás o importante', () => {
        expect(importantOption(read({ decision: 'amenazar' }))).toBe(true);
        expect(importantOption(read({ irreversible: true }))).toBe(true);
        expect(importantOption({ sinVuelta: 'No se deshace' })).toBe(true);
        expect(importantOption({ weighty: true })).toBe(true);
        expect(importantOption({ importante: true })).toBe(true);
    });

    test('lo que cambia cómo os miran, una facción o el hilo, en la opción o en su tirada', () => {
        expect(importantOption(read({ effects: [{ attitude: -1 }] }))).toBe(true);
        expect(importantOption(read({ effects: [{ milestone: 'la-prueba' }] }))).toBe(true);
        expect(importantOption({ effects: [{ standing: { vane: 1 } }] })).toBe(true);
        expect(importantOption(read({ check: { skill: 'persuasion', dc: 12, success: { effects: [{ gold: 5 }] }, failure: { effects: [{ attitude: -1 }] } } }))).toBe(true);
    });

    test('charlar de cualquier cosa no: preguntar, pagar, un rumor, una pista, despedirse', () => {
        expect(importantOption(read({}))).toBe(false);
        expect(importantOption(read({ effects: [{ rumor: 'r' }] }))).toBe(false);
        expect(importantOption(read({ effects: [{ gold: -3 }] }))).toBe(false);
        expect(importantOption(read({ effects: [{ clue: 'Algo' }, { time: true }] }))).toBe(false);
        expect(importantOption(read({ check: { skill: 'insight', dc: 10, success: { effects: [{ clue: 'x' }] }, failure: 'a' } }))).toBe(false);
        expect(importantOption(null)).toBe(false);
    });

    test('con la charla, lo que hace el nudo al que lleva: Brunilda', () => {
        // Llevan a donde se cumple un hito, o cambian cómo os mira: importantes.
        expect(importantOption(option('quiero-entrar'), { dialogue: gremio })).toBe(true);
        expect(importantOption(option('hecho'), { dialogue: gremio })).toBe(true);
        expect(importantOption(option('veterana'), { dialogue: gremio })).toBe(true);
        expect(importantOption(option('adelanto'), { dialogue: gremio })).toBe(true);
        // Preguntar por la bodega, el gremio o despedirse: no.
        for (const id of ['bodega', 'como-funciona', 'recomienda', 'adios', 'consejo-gracias']) {
            expect([id, importantOption(option(id), { dialogue: gremio })]).toEqual([id, false]);
        }
        // Sin la charla no se sabe adónde lleva: «Quiero entrar» por sí sola no cambia nada.
        expect(importantOption(option('quiero-entrar'))).toBe(false);
    });

    test('lo importante lleva opinión; lo demás, nadie opina', () => {
        // A Gerd le gusta tratar bien (amable): la opción con «attitude» es importante y opina.
        const kind = read({ effects: [{ attitude: 1 }] });
        expect(importantOption(kind) && opinionsOn({ option: kind, party, cards }).length > 0).toBe(true);
    });
});
