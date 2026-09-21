import { describe, test, expect } from '@jest/globals';
import {
    toRows, fromRows, fieldsFor, objectiveTypeOptions,
    buildObjectiveSchema, buildObjectivePrompt, normalizeGeneratedObjectives,
} from '../public/scripts/game-engine/campaign/objective-editor.js';
import { OBJECTIVE_TYPES } from '../public/scripts/game-engine/campaign/scenarios.js';

const names = { 7: 'Guardián del grano', 9: 'Mira la Molinera' };
const ids = { 'Guardián del grano': '7', 'Mira la Molinera': '9' };

describe('the types on offer', () => {
    test('are the ones the engine can actually judge', () => {
        expect(objectiveTypeOptions().map(o => o.id).sort()).toEqual(Object.keys(OBJECTIVE_TYPES).sort());
    });

    test('each one asks for exactly the fields its type needs', () => {
        expect(fieldsFor('eliminate_all')).toEqual([]);
        expect(fieldsFor('eliminate').map(f => f.writes)).toEqual(['target']);
        expect(fieldsFor('escort').map(f => f.writes)).toEqual(['ally', 'cell']);
        expect(fieldsFor('inventado')).toEqual([]);
    });
});

describe('reading a saved mission back for editing', () => {
    // Showing a Lorebook uid to somebody editing a mission is showing them the plumbing.
    test('ids become the names they belong to', () => {
        const [row] = toRows([{ id: 'o1', type: 'eliminate', label: 'Matar', targetIds: ['7'] }], names);
        expect(row.values.target).toBe('Guardián del grano');
    });

    test('an ally id too', () => {
        const [row] = toRows([{ type: 'protect', label: 'Cuidar', allyId: '9' }], names);
        expect(row.values.ally).toBe('Mira la Molinera');
    });

    test('a cell comes back as a cell', () => {
        const [row] = toRows([{ type: 'reach_cell', label: 'Llegar', cell: { x: 3, y: 4 } }]);
        expect(row.values.cell).toEqual({ x: 3, y: 4 });
    });

    test('an id nobody knows is shown as it is, not as blank', () => {
        const [row] = toRows([{ type: 'eliminate', label: 'Matar', targetIds: ['99'] }], names);
        expect(row.values.target).toBe('99');
    });

    test('an objective with no id or label still becomes a row', () => {
        const [row] = toRows([{ type: 'survive_rounds', rounds: 3 }]);
        expect(row).toMatchObject({ id: 'obj_1', label: 'survive_rounds', optional: false });
        expect(row.values.rounds).toBe(3);
    });

    test('junk is skipped', () => {
        expect(toRows(null)).toEqual([]);
        expect(toRows([null, false])).toEqual([]);
    });
});

describe('saving the rows back', () => {
    test('names become the ids the engine judges by', () => {
        const rows = toRows([{ id: 'o1', type: 'eliminate', label: 'Matar', targetIds: ['7'] }], names);
        const { objectives, problems } = fromRows(rows, ids);
        expect(objectives[0]).toMatchObject({ id: 'o1', type: 'eliminate', targetIds: ['7'] });
        expect(problems).toEqual([]);
    });

    test('a round trip changes nothing', () => {
        const saved = [
            { id: 'a', type: 'eliminate', label: 'Matar', optional: false, targetIds: ['7'] },
            { id: 'b', type: 'protect', label: 'Cuidar', optional: true, allyId: '9' },
            { id: 'c', type: 'survive_rounds', label: 'Aguantar', optional: false, rounds: 4 },
        ];
        expect(fromRows(toRows(saved, names), ids).objectives).toEqual(saved);
    });

    // The mistake this project already made once: a mission pointing at nobody.
    test('a name nobody knows is reported, not saved as empty', () => {
        const { problems } = fromRows([{ type: 'eliminate', label: 'Matar', values: { target: 'Nadie' } }], ids);
        expect(problems[0]).toMatch(/"Nadie" no existe/);
    });

    test('and a missing name is reported too', () => {
        const { problems } = fromRows([{ type: 'protect', label: 'Cuidar', values: { ally: '' } }], ids);
        expect(problems[0]).toMatch(/Falta ally/);
    });

    test('several names in one field all resolve', () => {
        const { objectives } = fromRows(
            [{ type: 'eliminate', label: 'Matar', values: { target: 'Guardián del grano, Mira la Molinera' } }], ids);
        expect(objectives[0].targetIds).toEqual(['7', '9']);
    });

    test('a number that is not one is reported', () => {
        const { problems } = fromRows([{ type: 'survive_rounds', label: 'Aguantar', values: { rounds: 'tres' } }], ids);
        expect(problems[0]).toMatch(/número mayor que cero/);
    });

    test('eliminate_all asks for nothing and saves cleanly', () => {
        const { objectives, problems } = fromRows([{ type: 'eliminate_all', label: 'Despejar' }], ids);
        expect(problems).toEqual([]);
        expect(objectives[0]).toEqual({ id: 'obj_1', type: 'eliminate_all', label: 'Despejar', optional: false });
    });
});

describe('asking a model for a mission', () => {
    test('the schema offers exactly the types the engine judges', () => {
        expect(buildObjectiveSchema().properties.objectives.items.properties.type.enum.sort())
            .toEqual(Object.keys(OBJECTIVE_TYPES).sort());
    });

    test('and asks for names, never for ids', () => {
        const properties = buildObjectiveSchema().properties.objectives.items.properties;
        expect(properties.target).toBeTruthy();
        expect(properties.ally).toBeTruthy();
        expect(properties.targetIds).toBeUndefined();
        expect(properties.allyId).toBeUndefined();
    });

    test('the prompt tells the model which names it may use', () => {
        const { systemPrompt } = buildObjectivePrompt({
            boardName: 'El sótano', enemies: ['Guardián del grano'], allies: ['Mira la Molinera'],
            width: 12, height: 9,
        });
        expect(systemPrompt).toContain('Guardián del grano');
        expect(systemPrompt).toContain('Mira la Molinera');
        expect(systemPrompt).toContain('12 por 9');
    });

    test('and says so when there is nobody to fight', () => {
        expect(buildObjectivePrompt({ boardName: 'Plaza' }).systemPrompt).toContain('No hay enemigos');
    });

    test('an idea goes into the request, a missing one does not break it', () => {
        expect(buildObjectivePrompt({ boardName: 'X', idea: 'una emboscada' }).prompt).toContain('una emboscada');
        expect(buildObjectivePrompt({ boardName: 'X' }).prompt).toContain('"X"');
    });
});

describe('reading back what the model wrote', () => {
    const known = { enemies: ['Guardián del grano'], allies: ['Mira la Molinera'] };

    test('a good answer becomes rows', () => {
        const { rows, warnings } = normalizeGeneratedObjectives({
            objectives: [
                { type: 'eliminate', label: 'Acabar con el guardián', target: 'Guardián del grano' },
                { type: 'survive_rounds', label: 'Aguantar', rounds: 5, optional: true },
            ],
        }, known);
        expect(rows).toHaveLength(2);
        expect(rows[0].values.target).toBe('Guardián del grano');
        expect(rows[1].optional).toBe(true);
        expect(warnings).toEqual([]);
    });

    // A generated mission that cannot be completed is worse than none at all.
    test('a name it invented is dropped, and said out loud', () => {
        const { rows, warnings } = normalizeGeneratedObjectives({
            objectives: [{ type: 'eliminate', label: 'Matar al dragón', target: 'Dragón' }],
        }, known);
        expect(rows).toEqual([]);
        expect(warnings[0]).toMatch(/no está en el tablero/);
    });

    test('a type it invented is dropped too', () => {
        const { rows, warnings } = normalizeGeneratedObjectives({
            objectives: [{ type: 'convencer', label: 'Hablar' }],
        }, known);
        expect(rows).toEqual([]);
        expect(warnings[0]).toMatch(/no sabe juzgar/);
    });

    test('an ally looked for among the enemies is refused', () => {
        const { warnings } = normalizeGeneratedObjectives({
            objectives: [{ type: 'protect', label: 'Cuidar', ally: 'Guardián del grano' }],
        }, known);
        expect(warnings[0]).toMatch(/no está en el tablero/);
    });

    test('a round count that is not a number is refused', () => {
        const { warnings } = normalizeGeneratedObjectives({
            objectives: [{ type: 'survive_rounds', label: 'Aguantar', rounds: 'muchas' }],
        }, known);
        expect(warnings[0]).toMatch(/no es un número usable/);
    });

    test('the good ones survive even when a bad one is dropped', () => {
        const { rows, warnings } = normalizeGeneratedObjectives({
            objectives: [
                { type: 'eliminate', label: 'Matar al dragón', target: 'Dragón' },
                { type: 'eliminate_all', label: 'Despejar' },
            ],
        }, known);
        expect(rows.map(r => r.type)).toEqual(['eliminate_all']);
        expect(warnings).toHaveLength(1);
    });

    test('a bare array works as well as the wrapped shape', () => {
        expect(normalizeGeneratedObjectives([{ type: 'eliminate_all', label: 'X' }], known).rows).toHaveLength(1);
    });

    test('nothing at all is not a crash', () => {
        expect(normalizeGeneratedObjectives(null).rows).toEqual([]);
        expect(normalizeGeneratedObjectives({ objectives: 'no' }).rows).toEqual([]);
    });

    test('what it produces goes straight through the saver', () => {
        const { rows } = normalizeGeneratedObjectives({
            objectives: [{ type: 'eliminate', label: 'Acabar', target: 'Guardián del grano' }],
        }, known);
        const { objectives, problems } = fromRows(rows, ids);
        expect(problems).toEqual([]);
        expect(objectives[0].targetIds).toEqual(['7']);
    });
});

describe('generating a mission against a provider', () => {
    const known = { enemies: ['Guardián del grano'], allies: [] };

    test('a good answer comes back as rows', async () => {
        const { generateObjectives } = await import('../public/scripts/game-engine/campaign/objective-editor.js');
        const result = await generateObjectives({
            boardName: 'El sótano', ...known,
            generate: async () => ({ objectives: [{ type: 'eliminate_all', label: 'Despejar el sótano' }] }),
        });
        expect(result.rows).toHaveLength(1);
        expect(result.errors).toEqual([]);
    });

    test('a JSON string answer is read too', async () => {
        const { generateObjectives } = await import('../public/scripts/game-engine/campaign/objective-editor.js');
        const result = await generateObjectives({
            boardName: 'X', ...known,
            generate: async () => JSON.stringify({ objectives: [{ type: 'eliminate_all', label: 'Y' }] }),
        });
        expect(result.rows).toHaveLength(1);
    });

    test('a provider that fails says so instead of throwing', async () => {
        const { generateObjectives } = await import('../public/scripts/game-engine/campaign/objective-editor.js');
        const result = await generateObjectives({
            boardName: 'X', ...known, generate: async () => { throw new Error('sin conexión'); },
        });
        expect(result.errors[0]).toMatch(/sin conexión/);
        expect(result.rows).toEqual([]);
    });

    test('an answer that is not JSON says so', async () => {
        const { generateObjectives } = await import('../public/scripts/game-engine/campaign/objective-editor.js');
        const result = await generateObjectives({ boardName: 'X', ...known, generate: async () => 'claro, aquí tienes' });
        expect(result.errors[0]).toMatch(/JSON válido/);
    });

    test('an answer with nothing usable in it is reported, not shown empty', async () => {
        const { generateObjectives } = await import('../public/scripts/game-engine/campaign/objective-editor.js');
        const result = await generateObjectives({
            boardName: 'X', ...known,
            generate: async () => ({ objectives: [{ type: 'eliminate', label: 'Matar', target: 'Dragón' }] }),
        });
        expect(result.rows).toEqual([]);
        expect(result.errors[0]).toMatch(/ningún objetivo que el motor pueda juzgar/);
        expect(result.warnings).toHaveLength(1);
    });
});
