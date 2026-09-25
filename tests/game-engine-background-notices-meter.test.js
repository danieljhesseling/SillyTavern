import { describe, test, expect } from '@jest/globals';
import { guessBackground, backgroundGives, describeBackground, BACKGROUNDS } from '../public/scripts/game-engine/campaign/backgrounds.js';
import { skillModifier } from '../public/scripts/game-engine/rules/checks.js';
import { buildHeroEntry, heroContent } from '../public/scripts/game-engine/campaign/hero.js';
import { explainYamlError, locateIssue, describeIssue } from '../public/scripts/game-engine/campaign/guion-errors.js';
import { addNotice, unseenCount, glanceRow, MAX_NOTICES } from '../public/scripts/game-engine/ui/shell/notices.js';
import { describeMeter, TURN_WARN_TOKENS } from '../public/scripts/game-engine/cost/prompt-meter.js';

describe('trasfondo', () => {
    test('lo que escribes lo propone', () => {
        expect(guessBackground('Un militar jubilado que ya no duerme bien.')).toBe('soldado');
        expect(guessBackground('Creció robando en las calles del puerto.')).toBe('criminal');
        expect(guessBackground('Le gusta el pan.')).toBe('');
    });

    test('da competencia en las tiradas, aunque la clase no la dé', () => {
        const mago = { class: 'mago', level: 1, strength: 10, charisma: 10 };
        expect(skillModifier(mago, 'intimidation').proficient).toBe(false);
        expect(skillModifier({ ...mago, background: 'soldado' }, 'intimidation')).toEqual({ modifier: 2, proficient: true });
        expect(backgroundGives('soldado', 'stealth')).toBe(false);
    });

    test('queda en la ficha y en lo que lee el narrador', () => {
        const answers = { name: 'Wendel', race: 'Humano', className: 'Guerrero', about: 'Militar jubilado.', background: 'soldado' };
        expect(buildHeroEntry(answers).dndData.background).toBe('soldado');
        expect(heroContent(answers)).toMatch(/Trasfondo: Soldado veterano \(se le da bien: Atletismo y Intimidación\)\. Sirvió en armas/);
        expect(describeBackground('nada')).toBe('');
    });

    test('todos dan dos habilidades que existen', () => {
        for (const background of Object.values(BACKGROUNDS)) {
            expect(background.skills).toHaveLength(2);
            for (const skill of background.skills) expect(skillModifier({ class: 'x' }, skill)).toBeTruthy();
        }
    });
});

describe('errores del guion', () => {
    const lines = ['mundo:', '  id: x', '', 'localidad:', '  id: a', '  nombre: Arthur: el Doc'];

    test('los dos puntos sin comillas, con la línea de verdad', () => {
        const said = explainYamlError({ reason: 'bad indentation of a mapping entry', mark: { line: 2 } }, 4, lines);
        expect(said).toMatchObject({ line: 6, text: 'nombre: Arthur: el Doc' });
        expect(said.why).toMatch(/dos puntos/);
        expect(said.fix).toMatch(/comillas/);
    });

    test('lo que no se conoce se dice igual, con el mensaje original', () => {
        const said = explainYamlError({ message: 'algo raro\nmás' }, 1, ['x: 1']);
        expect(said.why).toBe('El YAML no se entiende (algo raro).');
    });

    test('un fallo del paquete dice en qué ronda y línea está', () => {
        const pack = { locations: [{ name: 'El Molino' }] };
        const index = new Map([['el molino', 'ronda-2.md:14'], ['el-gran-salon', 'ronda-8.md:519']]);
        expect(locateIssue('locations[0].boards[1]', pack, index)).toBe('ronda-2.md:14 (El Molino)');
        expect(locateIssue('boards.el-gran-salon', pack, index)).toBe('ronda-8.md:519 (el-gran-salon)');
        expect(locateIssue('rumors[9]', pack, index)).toBe('');
        expect(describeIssue('ERROR', { path: 'x[0]', message: 'Mal.' }, '')).toBe('ERROR  Mal.  [x[0]]');
    });
});

describe('bandeja y grupo', () => {
    test('los repetidos se juntan, y se guardan los últimos', () => {
        let list = addNotice(null, { kind: 'info', title: 'Día 1', message: '<b>Lluvia</b>', at: 1000 });
        list = addNotice(list, { kind: 'info', title: 'Día 1', message: 'Lluvia', at: 2000 });
        expect(list).toEqual([{ kind: 'info', title: 'Día 1', message: 'Lluvia', at: 2000, count: 2 }]);
        for (let i = 0; i < MAX_NOTICES + 3; i++) list = addNotice(list, { kind: 'info', title: `T${i}`, message: '', at: 3000 + i });
        expect(list).toHaveLength(MAX_NOTICES);
        expect(unseenCount(list, 3000 + MAX_NOTICES)).toBe(2);
    });

    test('una fila del grupo: vida, estado y lo que arrastra', () => {
        const row = glanceRow({ name: 'Bruna', hp: 4, maxHp: 20, gold: 7, activeConditions: ['Prone'] },
            { injuries: ['Pierna rota — speed -10 · 3 día(s)'], needs: 'Acusa hambre (1).', rank: 3 });
        expect(row).toMatchObject({ name: 'Bruna', hp: '4/20', pct: 20, state: 'hurt', gold: 7 });
        expect(row.lines).toEqual(['Heridas: Pierna rota — speed -10 · 3 día(s)', 'Acusa hambre (1).', 'Estado: Prone', 'Vínculo: rango 3']);
        expect(glanceRow({ name: 'X', hp: 0, maxHp: 10 }, { injuries: [], needs: '', rank: 0 }).state).toBe('down');
    });
});

describe('contador de tokens', () => {
    test('sin turnos no dice nada', () => {
        expect(describeMeter(null, { turns: 0, promptTokens: 0 })).toBeNull();
    });

    test('el turno, la sesión, el precio si lo hay, y si es caro', () => {
        const turn = { totalTokens: TURN_WARN_TOKENS + 500, blocks: [{ label: 'Historial', tokens: 4000 }] };
        const meter = describeMeter(turn, { turns: 2, promptTokens: 20000 }, 3);
        expect(meter?.text).toBe('≈6.5k por turno · sesión 20.0k · 0.060 €');
        expect(meter?.high).toBe(true);
        expect(meter?.title).toMatch(/Historial: 4.0k/);
    });
});
