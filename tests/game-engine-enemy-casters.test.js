import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { buildPackEntries } from '../public/scripts/game-engine/campaign/campaign-importer.js';
import { normalizePack } from '../public/scripts/game-engine/campaign/campaign-pack.js';
import { readCasterBlock, validateCasterBlock, enemySpellAbilities } from '../public/scripts/game-engine/combat/enemy-spells.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const catalogue = read('compendio/conjuros.json').rows;

/** La ficha del Lorebook que sale de un enemigo del paquete. */
const entryOf = (/** @type {any} */ enemy) => buildPackEntries(normalizePack({ bestiary: [enemy] }).pack)
    .find((/** @type {any} */ e) => e.group === 'Monsters');

describe('J19.12: el enemigo que lanza, de la ficha del paquete a la pelea', () => {
    const block = { ability: 'intelligence', saveDc: 12, attackBonus: 4, casterLevel: 3, slots: { 1: 2 }, spells: ['mag-escarcha', 'conj-proyectil-magico'] };

    test('el importador deja su bloque `spellcasting` en la ficha del Lorebook, tal cual', () => {
        const entry = entryOf({ name: 'Bruja', hp: 10, armorClass: 11, cr: 1, profile: 'caster', spellcasting: block });
        expect(entry?.dndData?.spellcasting).toEqual(block);
    });

    test('sin bloque, o con uno que no es un objeto, no se inventa nada', () => {
        expect(entryOf({ name: 'Lobo', hp: 10, armorClass: 11, cr: 1 })?.dndData).not.toHaveProperty('spellcasting');
        expect(entryOf({ name: 'Otro', hp: 10, armorClass: 11, cr: 1, spellcasting: ['mag-escarcha'] })?.dndData).not.toHaveProperty('spellcasting');
    });

    test('la Bruja Baroviana de Strahd lanza: su bloque vale, con conjuros del catálogo y un espacio de 1.er nivel', () => {
        const pack = read('mundos/strahd.pack.json');
        const witch = pack.bestiary.find((/** @type {any} */ e) => e.name === 'Bruja Baroviana');
        expect(validateCasterBlock(witch?.spellcasting, catalogue, witch?.name)).toEqual([]);
        const read5e = readCasterBlock(witch.spellcasting);
        expect(read5e?.slots).toEqual({ 1: 1 });
        const spells = enemySpellAbilities({ enemy: { name: witch.name }, block: /** @type {any} */ (read5e), catalogue });
        expect(spells.map(s => s.id).sort()).toEqual(['conj-proyectil-magico', 'mag-escarcha']);
        // Gastado su espacio, le queda el truco.
        const spent = enemySpellAbilities({ enemy: { name: witch.name, slotsUsed: { 1: 1 } }, block: /** @type {any} */ (read5e), catalogue });
        expect(spent.map(s => s.id)).toEqual(['mag-escarcha']);
    });

    test('Strahd lanza y se concentra: Toque vampírico pide concentración, y concentrado no lo suelta por otro', () => {
        const pack = read('mundos/strahd.pack.json');
        const strahd = pack.bestiary.find((/** @type {any} */ e) => e.name === 'Strahd von Zarovich');
        expect(validateCasterBlock(strahd?.spellcasting, catalogue, strahd?.name)).toEqual([]);
        const block = /** @type {any} */ (readCasterBlock(strahd.spellcasting));
        const fresh = enemySpellAbilities({ enemy: { name: strahd.name }, block, catalogue });
        expect(fresh.map(s => s.id).sort()).toEqual(['mag-escarcha', 'mag-toque-vampirico']);
        expect(fresh.filter(s => s.concentration).map(s => s.id)).toEqual(['mag-toque-vampirico']);
        const holding = enemySpellAbilities({ enemy: { name: strahd.name }, block, catalogue, concentrating: true });
        expect(holding.map(s => s.id)).toEqual(['mag-escarcha']);
    });
});
