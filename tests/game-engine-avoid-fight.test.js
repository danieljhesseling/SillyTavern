import { describe, test, expect } from '@jest/globals';
import {
    AVOID_KINDS, mindOf, leaderOf, foesLine, defaultDc, defaultPrice, readAvoid, defaultAvoid, avoidFor,
    avoidChips, resolveAvoid, describeExitEffect, checkAvoid, readExitEffect, rollFormula, kindOf, fightsWithoutWay,
} from '../public/scripts/game-engine/combat/avoid-fight.js';
import {
    PARLEY_WAYS, readParley, moraleOf, bribePrice, parleyChips, resolveParley, checkParley, wayOf, standingFoes,
} from '../public/scripts/game-engine/combat/parley.js';

const bran = { id: 1, name: 'Bran', class: 'Guerrero', level: 1, hp: 12, maxHp: 12, strength: 16, dexterity: 12, charisma: 8, wisdom: 10 };
const mira = { id: 2, name: 'Mira', class: 'Bardo', level: 1, hp: 8, maxHp: 8, strength: 8, dexterity: 14, charisma: 16, wisdom: 12, gender: 'Mujer' };
const pip = { id: 3, name: 'Pip', class: 'Pícaro', level: 1, hp: 9, maxHp: 9, strength: 10, dexterity: 16, charisma: 10, wisdom: 10 };
const party = [bran, mira, pip];

const guards = [
    { name: 'Guardia de Montesclaros', cr: 0.25, profile: 'guardian' },
    { name: 'Guardia de Montesclaros', cr: 0.25, profile: 'guardian' },
    { name: 'Alguacil Torres', cr: 3, profile: 'aggressive' },
];
const wolves = [{ name: 'Lobo famélico', cr: 0.25 }, { name: 'Lobo famélico', cr: 0.25 }, { name: 'Lobo alfa', cr: 1 }];
const dead = [{ name: 'Zombi de Strahd', cr: 0.5 }, { name: 'Zombi de Strahd', cr: 0.5 }];

/** Un d20 que saca lo que se le dice, en orden. */
const dice = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
};

describe('de qué está hecho quien espera', () => {
    test('la gente, las bestias, los muertos y las cosas', () => {
        expect(mindOf('Alguacil Torres')).toBe('gente');
        expect(mindOf('Lobo famélico')).toBe('bestia');
        expect(mindOf('Lobo gris 2')).toBe('bestia');
        expect(mindOf('Rata de bodega')).toBe('bestia');
        expect(mindOf('Enjambre de murciélagos')).toBe('cosa');
        expect(mindOf('Zombi de Strahd')).toBe('muerto');
        expect(mindOf('Gárgola')).toBe('cosa');
        expect(mindOf('Espantapájaros')).toBe('cosa');
    });

    test('«Perro del Cuervo» es una compañía, no un perro; el hombre lobo habla', () => {
        expect(mindOf('Perro del Cuervo')).toBe('gente');
        expect(mindOf('Hombre Lobo')).toBe('gente');
    });

    test('lo escrito manda', () => {
        expect(mindOf({ name: 'Lobo gris', mind: 'gente' })).toBe('gente');
    });

    test('quien manda y cómo se dice el grupo', () => {
        expect(leaderOf(guards)).toBe('Alguacil Torres');
        expect(leaderOf([{ name: 'Lobo gris 1', cr: 0.25 }, { name: 'Hombre Lobo', cr: 3 }])).toBe('Hombre Lobo');
        expect(foesLine(guards)).toBe('Guardia de Montesclaros ×2, Alguacil Torres');
    });
});

describe('la CD y el precio de siempre', () => {
    test('más difícil con muchos y con alguien de cuidado', () => {
        expect(defaultDc([{ name: 'Ratero', cr: 0.125 }])).toBe(12);
        expect(defaultDc(guards)).toBe(15);
        expect(defaultDc([{ name: 'Strahd', cr: 6, boss: true }])).toBe(16);
    });

    test('el precio crece con lo que valen, y el doble con un jefe', () => {
        expect(defaultPrice(guards)).toBe(3 + 3 + 30);
        expect(defaultPrice([{ name: 'Jefe', cr: 1, boss: true }])).toBe(20);
    });
});

describe('las salidas escritas', () => {
    const written = [
        { kind: 'hablar', text: 'Decir que el cáliz te lo han metido', skill: 'persuasion', dc: 15,
            success: { text: 'Los guardias se miran.', effects: [{ rumor: 'r-traicion' }] }, failure: '¡Mentiroso!' },
        { kind: 'pay', text: 'Darle unas monedas al guardia joven', gold: 5 },
        { kind: 'flee', text: 'Saltar por la ventana', skill: 'Atletismo', dc: 12, resolves: true },
        { kind: 'esconderse', text: 'Apagar el candil' },
        { kind: 'bailar', text: 'No vale' },
        { kind: 'hablar' },
    ];

    test('se leen, con alias y nombres de habilidad', () => {
        const options = readAvoid(written, guards);
        expect(options.map(o => o.kind)).toEqual(['hablar', 'pagar', 'huir', 'esconderse']);
        expect(options[0]).toMatchObject({ skill: 'persuasion', dc: 15, resolves: true });
        expect(options[0].success.effects).toEqual([{ kind: 'rumor', id: 'r-traicion' }]);
        expect(options[0].failure.text).toBe('¡Mentiroso!');
        expect(options[1]).toMatchObject({ skill: '', gold: 5 });
        expect(options[2]).toMatchObject({ skill: 'athletics', resolves: true });
        expect(options[3]).toMatchObject({ skill: 'stealth', group: true, dc: defaultDc(guards) });
    });

    test('kindOf entiende lo que escribiría un Gem', () => {
        expect(kindOf('Sobornar')).toBe('pagar');
        expect(kindOf('engañar')).toBe('hablar');
        expect(kindOf('sneak')).toBe('esconderse');
        expect(kindOf('bailar')).toBe('');
    });

    test('sin nada escrito, las de siempre según quién espera', () => {
        expect(defaultAvoid(guards).map(o => o.kind)).toEqual(['hablar', 'pagar', 'esconderse', 'huir']);
        const beasts = defaultAvoid(wolves);
        expect(beasts.map(o => o.id)).toEqual(['espantar-siempre', 'esconderse-siempre', 'huir-siempre']);
        expect(beasts[0].skill).toBe('intimidation');
        expect(defaultAvoid(dead).map(o => o.kind)).toEqual(['esconderse', 'huir']);
        expect(defaultAvoid([])).toEqual([]);
    });

    test('con un jefe no se paga, y hablar cuesta más', () => {
        const boss = [{ name: 'Strahd von Zarovich', cr: 6, boss: true }];
        const options = defaultAvoid(boss);
        expect(options.some(o => o.kind === 'pagar')).toBe(false);
        expect(options.find(o => o.kind === 'hablar')?.dc).toBe(defaultDc(boss) + 3);
    });

    test('avoidFor: las escritas si las hay, y si no, las de siempre', () => {
        expect(avoidFor({ avoid: written }, guards)).toHaveLength(4);
        expect(avoidFor({}, wolves)[0].id).toBe('espantar-siempre');
    });
});

describe('el panel: quién tira, contra cuánto y lo que cuesta', () => {
    const options = readAvoid([
        { kind: 'hablar', text: 'Hablar', skill: 'persuasion', dc: 13 },
        { kind: 'pagar', text: 'Pagar', gold: 20 },
        { kind: 'huir', text: 'Correr', dc: 11 },
        { kind: 'esconderse', text: 'Agacharse', dc: 12 },
    ], guards);

    test('habla quien mejor lo hace; huye el más lento; se esconde el grupo', () => {
        const chips = avoidChips({ options, party, gold: 25 });
        expect(chips[0]).toMatchObject({ label: 'Hablar', check: 'Persuasión · CD 13', locked: '' });
        expect(chips[0].who).toMatch(/Mira/);
        expect(chips[1]).toMatchObject({ cost: 'Cuesta 20 de oro', locked: '', check: '' });
        expect(chips[2].who).toMatch(/Mira, el más lento/);
        expect(chips[2].win).toMatch(/sin ganar/);
        expect(chips[3].who).toMatch(/todo el grupo/);
    });

    test('quien habla por el grupo (J7.4) tira aunque no sea el mejor', () => {
        const chips = avoidChips({ options, party, gold: 25, speakerId: 1 });
        expect(chips[0].who).toMatch(/Bran/);
    });

    test('sin oro, pagar sale cerrado y dice cuánto falta; lo intentado, también', () => {
        const chips = avoidChips({ options, party, gold: 3, tried: ['hablar-1'] });
        expect(chips[1].locked).toBe('Os faltan 17 de oro.');
        expect(chips[0].locked).toBe('Ya lo habéis intentado.');
    });
});

describe('resolver una salida', () => {
    const [talk, pay, flee, hide] = readAvoid([
        { kind: 'hablar', text: 'Hablar', skill: 'persuasion', dc: 13, success: { text: '{leader} os deja ir.', effects: [{ attitude: 1, who: 'Torres' }] } },
        { kind: 'pagar', text: 'Pagar', gold: 20, skill: 'persuasion', dc: 12 },
        { kind: 'huir', text: 'Correr', dc: 11 },
        { kind: 'esconderse', text: 'Agacharse', dc: 12 },
    ], guards);

    test('hablar bien: no hay pelea, el tablero cuenta y el efecto escrito', () => {
        const result = resolveAvoid({ option: talk, party, rollD20: dice(15), leader: 'Torres' });
        expect(result).toMatchObject({ outcome: 'bien', ends: 'avoided', resolves: true, enemiesFirst: false, roller: 'Mira', judge: 'hito-hablando' });
        expect(result.effects).toEqual([{ kind: 'attitude', amount: 1, who: 'Torres' }]);
        expect(result.lines[0]).toMatch(/Persuasión de Mira: 20 contra CD 13/);
        expect(result.lines[1]).toBe('Torres os deja ir.');
    });

    test('hablar a medias: sale, pero se va un rato', () => {
        const result = resolveAvoid({ option: talk, party, rollD20: dice(6) });
        expect(result.outcome).toBe('medias');
        expect(result.ends).toBe('avoided');
        expect(result.effects.map(e => e.kind)).toEqual(['attitude', 'time']);
    });

    test('hablar mal: empieza la pelea, sin ventaja para nadie', () => {
        const result = resolveAvoid({ option: talk, party, rollD20: dice(1) });
        expect(result).toMatchObject({ outcome: 'mal', ends: 'fight', resolves: false, enemiesFirst: false, judge: 'plantar-cara' });
    });

    test('pagar regateando: bien paga lo dicho, a medias la mitad más', () => {
        expect(resolveAvoid({ option: pay, party, gold: 50, rollD20: dice(15) }).effects[0]).toEqual({ kind: 'gold', amount: -20 });
        expect(resolveAvoid({ option: pay, party, gold: 50, rollD20: dice(5) }).effects[0]).toEqual({ kind: 'gold', amount: -30 });
        expect(resolveAvoid({ option: pay, party, gold: 50, rollD20: dice(1) }).effects).toEqual([]);
    });

    test('pagar sin oro no sale', () => {
        expect(resolveAvoid({ option: pay, party, gold: 5, rollD20: dice(20) }).outcome).toBe('mal');
    });

    test('pagar sin tirada: sale si hay con qué', () => {
        const plain = readAvoid([{ kind: 'pagar', text: 'Pagar', gold: 5 }], guards)[0];
        const result = resolveAvoid({ option: plain, party, gold: 5, rollD20: dice(1) });
        expect(result).toMatchObject({ outcome: 'bien', ends: 'avoided', rolls: [] });
        expect(result.effects).toEqual([{ kind: 'gold', amount: -5 }]);
    });

    test('huir: bien os vais sin ganar; a medias, el más lento se lleva un golpe; mal, atacan primero', () => {
        expect(resolveAvoid({ option: flee, party, rollD20: dice(15) })).toMatchObject({ ends: 'fled', resolves: false, judge: 'retirada' });
        const hurt = resolveAvoid({ option: flee, party, rollD20: dice(9), rollDie: () => 3 });
        expect(hurt.outcome).toBe('medias');
        expect(hurt.effects).toEqual([{ kind: 'hurt', dice: '1d4', amount: 3 }]);
        expect(hurt.roller).toBe('Mira');
        expect(resolveAvoid({ option: flee, party, rollD20: dice(2) })).toMatchObject({ ends: 'fight', enemiesFirst: true });
    });

    test('huir que cuenta (la ventana de la posada) es pasar el tablero', () => {
        const window = readAvoid([{ kind: 'huir', text: 'Saltar por la ventana', dc: 12, resolves: true }], guards)[0];
        expect(resolveAvoid({ option: window, party, rollD20: dice(18) })).toMatchObject({ ends: 'avoided', resolves: true });
    });

    test('esconderse es de grupo: basta la mitad; uno menos, a medias; si no, os ven', () => {
        expect(resolveAvoid({ option: hide, party, rollD20: dice(15, 15, 2) }).outcome).toBe('bien');
        expect(resolveAvoid({ option: hide, party, rollD20: dice(15, 2, 2) }).outcome).toBe('medias');
        const seen = resolveAvoid({ option: hide, party, rollD20: dice(2, 2, 2) });
        expect(seen).toMatchObject({ outcome: 'mal', ends: 'fight', enemiesFirst: true });
        expect(seen.rolls).toHaveLength(3);
    });

    test('lo escrito concuerda con el género de quien juega', () => {
        const gendered = readAvoid([{ kind: 'hablar', text: 'Hablar', dc: 5, success: 'Te dejan ir, {cansado|cansada}.' }], guards)[0];
        expect(resolveAvoid({ option: gendered, party, hero: mira, rollD20: dice(15) }).lines.at(-1)).toBe('Te dejan ir, cansada.');
    });
});

describe('los efectos, en llano', () => {
    test('cada uno se dice', () => {
        expect(describeExitEffect({ kind: 'gold', amount: -20 })).toBe('Pagáis 20 de oro.');
        expect(describeExitEffect({ kind: 'attitude', amount: -1, who: 'Torres' })).toBe('Torres os mira peor.');
        expect(describeExitEffect({ kind: 'hurt', amount: 3, dice: '1d4' }, { roller: 'Mira' })).toBe('Mira se lleva 3 de daño.');
        expect(describeExitEffect({ kind: 'days', amount: 1 })).toBe('Se va un día entero.');
        expect(describeExitEffect({ kind: 'grudge', who: 'Torres' })).toMatch(/Torres os la guardará/);
        expect(describeExitEffect({ kind: 'standing', faction: 'Los Lobos del Bosque', amount: 1 })).toBe('Los Lobos del Bosque os mira mejor.');
    });

    test('se leen como en las charlas, y los de pelea', () => {
        expect(readExitEffect({ standing: 'Leales de Montesclaros' })).toEqual({ kind: 'standing', faction: 'Leales de Montesclaros', amount: -1 });
        expect(readExitEffect({ hurt: '1d6', who: 'todos' })).toEqual({ kind: 'hurt', dice: '1d6', who: 'todos' });
        expect(readExitEffect('time')).toEqual({ kind: 'time' });
        expect(readExitEffect({ bailar: 1 }).kind).toBe('unknown');
    });

    test('los dados de una fórmula', () => {
        expect(rollFormula('2d6+1', () => 4)).toBe(9);
        expect(rollFormula('3', () => 1)).toBe(3);
    });
});

describe('lo escrito, comprobado para el importador', () => {
    test('una lista bien escrita no da nada', () => {
        expect(checkAvoid([{ kind: 'hablar', text: 'Hablar', skill: 'persuasion', dc: 12, success: { text: 'Bien', effects: [{ gold: 2 }] } }])).toEqual({ errors: [], warnings: [] });
        expect(checkAvoid(undefined)).toEqual({ errors: [], warnings: [] });
    });

    test('lo que no se entiende es un error, y lo que cojea, un aviso', () => {
        const found = checkAvoid([
            { kind: 'bailar', text: '' },
            { kind: 'hablar', text: 'x', skill: 'magia', dc: 50, success: { effects: [{ volar: true }, { rumor: 'nada' }] } },
            { kind: 'pagar', text: 'Pagar' },
        ], { path: 'boards[0].avoid', rumors: new Set(['r-uno']) });
        expect(found.errors.map(e => e.path)).toEqual([
            'boards[0].avoid[0].kind', 'boards[0].avoid[0].text', 'boards[0].avoid[1].skill', 'boards[0].avoid[1].success.effects[0]',
        ]);
        expect(found.warnings.map(w => w.path)).toEqual(['boards[0].avoid[1].dc', 'boards[0].avoid[1].success.effects[1]', 'boards[0].avoid[2].gold']);
        expect(checkAvoid({ kind: 'hablar' }).errors).toHaveLength(1);
    });

    test('las peleas sin salida escrita', () => {
        expect(fightsWithoutWay({ boards: [
            { id: 'a', enemies: [{ name: 'X' }] },
            { id: 'b', enemies: [{ name: 'X' }], avoid: [{ kind: 'huir', text: 'Correr' }] },
            { id: 'c', enemies: [] },
        ] })).toEqual(['a']);
    });
});

describe('J8.5: salir de una pelea hablando', () => {
    const fight = () => [
        { name: 'Guardia de Montesclaros 1', currentHp: 11, maxHp: 11, cr: 0.25 },
        { name: 'Guardia de Montesclaros 2', currentHp: 11, maxHp: 11, cr: 0.25 },
        { name: 'Alguacil Torres', currentHp: 40, maxHp: 40, cr: 3 },
    ];

    test('las cuatro formas, con sus nombres', () => {
        expect(Object.keys(PARLEY_WAYS)).toEqual(['entregarse', 'sobornar', 'convencer', 'enganar']);
        expect(wayOf('Engañar')).toBe('enganar');
        expect(wayOf('rendirse')).toBe('entregarse');
    });

    test('la moral: con la mitad caídos y su jefe en el suelo, escuchan mejor', () => {
        const enemies = fight();
        expect(moraleOf({ enemies, party }).shift).toBe(0);
        enemies[0].currentHp = 0;
        enemies[2].currentHp = 0;
        const morale = moraleOf({ enemies, party, leader: 'Alguacil Torres' });
        expect(morale.reasons.map(r => r.text)).toEqual(['La mitad de los suyos ya no pelea', 'Alguacil Torres ha caído']);
        expect(morale.shift).toBe(-5);
        expect(standingFoes(enemies)).toHaveLength(1);
    });

    test('con un jefe en pie cuesta más; os ven flojos si estáis mal', () => {
        const morale = moraleOf({
            enemies: [{ name: 'Strahd', currentHp: 90, maxHp: 90, boss: true }],
            party: [{ ...bran, hp: 2 }, { ...mira, hp: 1 }],
        });
        expect(morale.shift).toBe(4 + 2);
    });

    test('el soborno lo ponen los que quedan en pie', () => {
        const enemies = fight();
        expect(bribePrice(enemies)).toBe(36);
        enemies[2].currentHp = 0;
        expect(bribePrice(enemies)).toBe(6);
    });

    test('el panel: CD con la moral, lo que piden y lo cerrado', () => {
        const { leader, chips } = parleyChips({ enemies: fight(), party, gold: 10 });
        expect(leader).toBe('Alguacil Torres');
        expect(chips.map(c => c.id)).toEqual(['entregarse', 'sobornar', 'convencer', 'enganar']);
        expect(chips[1].locked).toBe('Piden 36 de oro y tenéis 10.');
        expect(chips[2]).toMatchObject({ check: 'Persuasión · CD 15', locked: '' });
        expect(chips[3].check).toBe('Engaño · CD 14');
        expect(chips[2].who).toMatch(/Mira/);
    });

    test('a las bestias no se les habla, y un jefe no quiere presos', () => {
        const beasts = parleyChips({ enemies: [{ name: 'Lobo gris 1', currentHp: 5, maxHp: 5 }], party, gold: 100 });
        expect(beasts.chips.every(c => /bestias/.test(c.locked))).toBe(true);
        const boss = parleyChips({ enemies: [{ name: 'Strahd von Zarovich', currentHp: 90, maxHp: 90, boss: true }], party, gold: 0 });
        expect(boss.chips[0].locked).toBe('Strahd von Zarovich no quiere presos.');
    });

    test('entregarse: se acaba, os llevan la bolsa, un día y la fama', () => {
        const result = resolveParley({ way: 'entregarse', enemies: fight(), party, gold: 12, rollD20: dice(10) });
        expect(result).toMatchObject({ ends: 'captured', resolves: false, costsAction: false, judge: 'retirada' });
        expect(result.effects).toEqual([{ kind: 'gold', amount: -12 }, { kind: 'days', amount: 1 }, { kind: 'fame', amount: -1 }]);
        expect(result.lines[0]).toMatch(/Alguacil Torres acepta/);
    });

    test('sobornar: bien paga, a medias paga más, mal no paga y sigue', () => {
        const enemies = fight();
        enemies[2].currentHp = 0;
        const good = resolveParley({ way: 'sobornar', enemies, party, gold: 50, rollD20: dice(15) });
        expect(good).toMatchObject({ ends: 'ended', resolves: true, costsAction: true, judge: 'pagar' });
        expect(good.effects[0]).toEqual({ kind: 'gold', amount: -6 });
        expect(resolveParley({ way: 'sobornar', enemies, party, gold: 50, rollD20: dice(3) }).effects[0]).toEqual({ kind: 'gold', amount: -9 });
        expect(resolveParley({ way: 'sobornar', enemies, party, gold: 50, rollD20: dice(1) })).toMatchObject({ ends: 'continue', effects: [] });
    });

    test('convencer: bien se van; a medias dudan una ronda; mal, nada', () => {
        expect(resolveParley({ way: 'convencer', enemies: fight(), party, rollD20: dice(15) })).toMatchObject({ outcome: 'bien', ends: 'ended', resolves: true });
        expect(resolveParley({ way: 'convencer', enemies: fight(), party, rollD20: dice(8) })).toMatchObject({ outcome: 'medias', ends: 'lull', resolves: false });
        expect(resolveParley({ way: 'convencer', enemies: fight(), party, rollD20: dice(2) })).toMatchObject({ outcome: 'mal', ends: 'continue' });
    });

    test('engañar: si cuela os la guardan; si no, se enfadan', () => {
        const good = resolveParley({ way: 'engañar', enemies: fight(), party, rollD20: dice(15) });
        expect(good.ends).toBe('ended');
        expect(good.effects).toEqual([{ kind: 'grudge', who: 'Alguacil Torres' }]);
        expect(resolveParley({ way: 'enganar', enemies: fight(), party, rollD20: dice(1) }).ends).toBe('enraged');
    });

    test('lo escrito en el tablero manda: texto, CD, precio y lo que pasa', () => {
        const parley = readParley({
            leader: 'Alguacil Torres',
            entregarse: { text: 'Soltar la espada', resolves: true, success: { text: 'Saltas por la ventana.', effects: [{ take: 'Cáliz' }] } },
            sobornar: { gold: 5, text: 'Unas monedas al guardia joven' },
            convencer: { dc: 12, success: 'Dudan.' },
            no: ['engañar'],
        });
        const view = parleyChips({ enemies: fight(), party, gold: 5, parley });
        expect(view.chips[0].text).toBe('Soltar la espada');
        expect(view.chips[0].win).toMatch(/la historia sigue/);
        expect(view.chips[1]).toMatchObject({ cost: 'Piden 5 de oro', locked: '' });
        expect(view.chips[2].check).toBe('Persuasión · CD 12');
        expect(view.chips[3].locked).toMatch(/no hay trato/);
        const given = resolveParley({ way: 'entregarse', enemies: fight(), party, parley, rollD20: dice(1) });
        expect(given).toMatchObject({ resolves: true, effects: [{ kind: 'take', item: 'Cáliz' }] });
        expect(given.lines).toEqual(['Saltas por la ventana.']);
    });

    test('lo escrito, comprobado', () => {
        expect(checkParley({ convencer: { dc: 12 }, no: ['entregarse'] })).toEqual({ errors: [], warnings: [] });
        expect(checkParley({ gritar: {}, no: ['bailar'], convencer: { skill: 'magia', success: { effects: [{ volar: 1 }] } } }).errors).toHaveLength(4);
        expect(checkParley([]).errors).toHaveLength(1);
    });
});

describe('las cuatro salidas tienen su decisión para el grupo', () => {
    test('cada una dice qué le parece a quién', () => {
        expect(Object.values(AVOID_KINDS).map(k => k.judge)).toEqual(['hito-hablando', 'pagar', 'retirada', 'hito-maña']);
    });
});
