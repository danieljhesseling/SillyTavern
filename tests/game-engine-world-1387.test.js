import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { validatePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { buildImportPlan, resolveNames } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { readPlot, startPlot, focusOf } from '../public/scripts/game-engine/campaign/plot.js';
import { readFactions } from '../public/scripts/game-engine/campaign/factions.js';

// El mundo tal como se publica: si alguien lo rompe al regenerarlo, esto lo dice.
const pack = JSON.parse(readFileSync(new URL('../public/mundos/1387.pack.json', import.meta.url), 'utf8'));
const mundos = JSON.parse(readFileSync(new URL('../public/mundos/mundos.json', import.meta.url), 'utf8'));

describe('1387, el mundo escrito', () => {
    test('mundos.json apunta a su paquete', () => {
        expect(mundos.worlds.find((/** @type {any} */ w) => w.id === '1387')?.pack).toBe('/mundos/1387.pack.json');
    });

    test('el paquete pasa el validador sin errores', () => {
        const found = validatePack(pack);
        expect(found.errors).toEqual([]);
        expect(found.ok).toBe(true);
    });

    test('empieza en El Pueblo de Barro, en el cuarto de la posada', () => {
        expect(pack.locations[0].name).toBe('El Pueblo de Barro');
        const plan = buildImportPlan(pack);
        expect(plan.metadata.locationMaps[0].boards[0].name).toBe('El cuarto de la posada');
    });

    test('las facciones entran vivas: sede, enemigos y reloj', () => {
        const plan = buildImportPlan(pack);
        const factions = readFactions(plan.metadata.factions);
        expect(factions).toHaveLength(3);
        for (const f of factions) {
            expect(f.seat).toBeTruthy();
            expect(f.enemies.length).toBeGreaterThan(0);
            expect(f.goal.kind).toBeTruthy();
        }
    });

    test('los escondidos no están en el mapa, y sus tableros quedan resueltos igual', () => {
        const plan = buildImportPlan(pack);
        const visible = plan.metadata.locationMaps.map((/** @type {any} */ l) => l.name);
        const hidden = plan.metadata.hiddenLocations.map((/** @type {any} */ l) => l.name);
        expect(hidden).toEqual(expect.arrayContaining(['Campamento Furtivo', 'La Mina Abandonada']));
        expect(visible).not.toContain('La Mina Abandonada');

        const ids = Object.fromEntries(plan.entries.map((/** @type {any} */ e, /** @type {number} */ i) => [e.title, `uid${i}`]));
        const { metadata, unresolved } = resolveNames(plan, ids);
        expect(unresolved).toEqual([]);
        const mine = metadata.hiddenLocations.find((/** @type {any} */ l) => l.name === 'La Mina Abandonada');
        expect(mine.boards[0].encounterRules.length).toBeGreaterThan(0);
    });

    test('trae la gente, los rumores, los encargos y las habilidades nuevas', () => {
        const plan = buildImportPlan(pack);
        expect(plan.entries.filter((/** @type {any} */ e) => e.dndData?.entityType === 'npc' && !e.dndData?.confidant)).toHaveLength(22);
        expect(plan.metadata.rumors.length).toBeGreaterThanOrEqual(25);
        expect(plan.metadata.writtenContracts.length).toBeGreaterThanOrEqual(14);
        expect(plan.metadata.writtenContracts.filter((/** @type {any} */ c) => !c.noFight).every((/** @type {any} */ c) => c.boardName)).toBe(true);
        expect(plan.metadata.rulesetPack.abilities.map((/** @type {any} */ a) => a.id)).toEqual(expect.arrayContaining(['lanzar_tierra', 'romper_rodilla']));
    });

    test('el secreto de cada PNJ no va a lo que lee el narrador', () => {
        const plan = buildImportPlan(pack);
        const torres = plan.entries.find((/** @type {any} */ e) => e.title === 'Torres');
        expect(torres.dndData.secret).toMatch(/puerta trasera/);
        expect(torres.content).not.toMatch(/puerta trasera/);
    });

    test('el hilo arranca con la mecha y te dice qué tienes entre manos', () => {
        const plot = /** @type {any} */ (readPlot(pack.plot));
        expect(plot.milestones.length).toBeGreaterThanOrEqual(12);
        const step = startPlot(plot);
        expect(step.opened[0].scene).toMatch(/cáliz/);
        expect(focusOf(plot, step.state)?.title).toBe('El cáliz ensangrentado');
        expect(Object.keys(plot.endings)).toHaveLength(3);
    });
});
