/**
 * Paladín y Monje (wiki/gemini/ROADMAP_CONTENIDO_DND.md): se eligen, empiezan con lo suyo y sus
 * rasgos se notan jugando.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { abilitiesFor } from '../public/scripts/game-engine/compendio/skills.js';
import { kitFor, startingGear, STARTING_TORCHES } from '../public/scripts/game-engine/campaign/starting-kit.js';
import { armourClassOf } from '../public/scripts/game-engine/rules/equipment.js';
import { unarmedDamage, unarmedAbilityMod } from '../public/scripts/game-engine/rules/unarmed.js';
import { classLevelPatch, martialArtsDie, unarmoredMovement } from '../public/scripts/game-engine/rules/class-features.js';
import { perkBonus } from '../public/scripts/game-engine/rules/level-perks.js';
import { familyOf, nextTreeSteps } from '../public/scripts/game-engine/rules/class-trees.js';
import { casterOf, slotsFor, classRowFor } from '../public/scripts/game-engine/rules/spell-slots.js';
import { classSpellList } from '../public/scripts/game-engine/rules/spell-prep.js';
import { classKey } from '../public/scripts/game-engine/rules/checks.js';
import { roleOf } from '../public/scripts/game-engine/rules/level-advice.js';
import { weeklyMercenaries } from '../public/scripts/game-engine/campaign/weekly-mercenaries.js';
import { classIdOf } from '../public/scripts/game-engine/ui/pixel-art.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8'));
const classes = read('clases').rows;
const habilidades = read('habilidades').rows;
const conjuros = read('conjuros').rows;
const forms = ['armas', 'armaduras', 'trastos'].flatMap(domain => read(domain).rows);
const compendium = createCompendium({ habilidades });
const row = (id) => classes.find(c => c.id === id);
const ids = (className, level) => abilitiesFor({ compendium, className, level }).map(a => a.id);

describe('las filas de clases.json', () => {
    test('paladín: d10, medio lanzador de Carisma que prepara, con cota, espada, escudo y antorchas', () => {
        const paladin = row('paladin');
        expect(paladin.name).toBe('Paladín');
        expect(paladin.hitDie).toBe('1d10');
        expect(casterOf(paladin)).toMatchObject({ progression: 'half', ability: 'charisma', mode: 'prepared', focus: 'Divine' });
        const gear = startingGear({ classRow: paladin, forms });
        expect(gear.map(p => p.kitForm)).toEqual(expect.arrayContaining(['forma-cota-malla', 'forma-espada-larga', 'forma-escudo', 'forma-antorcha']));
        expect(gear.find(p => p.kitForm === 'forma-antorcha').quantity).toBe(STARTING_TORCHES);
        // Medio lanzador como el explorador: espacios desde el nivel 2.
        expect(slotsFor(paladin, 2).slots[1]).toBe(2);
    });

    test('monje: d8, sin armadura ni magia', () => {
        const monje = row('monje');
        expect(monje.hitDie).toBe('1d8');
        expect(casterOf(monje)).toBeNull();
        expect(kitFor({ classRow: monje, forms }).some(p => p.type === 'armor')).toBe(false);
    });

    test('el motor los reconoce por su nombre, también en femenino', () => {
        expect(classKey('Paladín')).toBe('paladin');
        expect(classKey('paladina')).toBe('paladin');
        expect(classKey('Monja')).toBe('monk');
        expect(classRowFor('Paladina', classes)?.id).toBe('paladin');
        expect(classRowFor('Monja', classes)?.id).toBe('monje');
        expect(roleOf({ class: 'Paladín' })).toBe('frente');
        expect(roleOf({ class: 'Monje' })).toBe('dano');
    });
});

describe('lo que saben hacer', () => {
    test('nivel 1: el paladín impone las manos y el monje pega con Artes marciales; con tilde también', () => {
        expect(ids('Paladín', 1)).toContain('hab-imposicion-manos');
        expect(ids('Paladín', 1)).not.toContain('hab-castigo-paladin');
        expect(ids('Monje', 1)).toContain('hab-artes-marciales');
        expect(ids('Monja', 1)).toContain('hab-artes-marciales');
        // Lo que antes fallaba por la tilde: una pícara o un bárbaro sin lo suyo.
        expect(ids('Pícara', 1)).toContain('hab-ataque-furtivo');
        expect(ids('Bárbaro', 1)).toContain('hab-furia');
    });

    test('nivel 2: el Castigo del paladín y la Ráfaga, la Defensa paciente y el Paso del viento del monje', () => {
        expect(ids('Paladín', 2)).toContain('hab-castigo-paladin');
        expect(ids('Monje', 2)).toEqual(expect.arrayContaining(['hab-rafaga-golpes', 'hab-defensa-paciente', 'hab-paso-viento']));
        // Lo del árbol no se aprende subiendo.
        expect(ids('Monje', 3)).not.toContain('tec-mano-abierta');
    });

    test('el paladín tiene su lista de conjuros, con Castigo divino y Arma elemental', () => {
        const list = classSpellList(row('paladin'), conjuros).map(s => s.id);
        expect(list).toEqual(expect.arrayContaining(['conj-castigo-divino', 'hab-curar', 'hab-bendicion', 'conj-arma-elemental']));
        // Medio lanzador: sin trucos y sin nada de más del 5.
        expect(list.every(id => {
            const spell = conjuros.find(s => s.id === id);
            return spell.level >= 1 && spell.level <= 5;
        })).toBe(true);
    });
});

describe('los rasgos que se notan solos', () => {
    test('Defensa sin armadura del monje: 10 + Destreza + Sabiduría, y con escudo no', () => {
        const monk = { class: 'Monje', wisdom: 16, items: [], equippedItems: {} };
        expect(armourClassOf({ member: monk, dexModifier: 3 })).toMatchObject({ armorClass: 16, worn: true });
        const shielded = { ...monk, items: [{ id: 's', name: 'Escudo', armorClass: 2 }], equippedItems: { shield: 's' } };
        expect(armourClassOf({ member: shielded, dexModifier: 3 }).armorClass).toBe(15);
        // Quien no es monje ni bárbaro, como siempre.
        expect(armourClassOf({ member: { class: 'Mago', wisdom: 18, items: [], equippedItems: {} }, dexModifier: 2 })).toMatchObject({ armorClass: 12, worn: false });
    });

    test('Artes marciales: el dado del monje con la mejor entre Fuerza y Destreza', () => {
        const monk = { class: 'Monje', level: 1, strength: 10, dexterity: 16 };
        expect(unarmedAbilityMod(monk)).toBe(3);
        expect(unarmedDamage(monk, () => 6)).toMatchObject({ damage: 9, formula: '1d6+3' });
        expect(unarmedDamage(monk).damage).toBe(6);
        expect(martialArtsDie(5)).toBe('1d8');
        expect(martialArtsDie(17)).toBe('1d12');
        // Los demás, 1 más la Fuerza.
        expect(unarmedDamage({ class: 'Guerrero', strength: 16, dexterity: 18 }).damage).toBe(4);
    });

    test('Movimiento sin armadura: +10 pies al llegar al 2, +5 más en el 6', () => {
        expect(unarmoredMovement(1)).toBe(0);
        expect(classLevelPatch({ class: 'Monje', speed: 30 }, 1, 2)).toEqual({ speed: 40 });
        expect(classLevelPatch({ class: 'Monje', speed: 40 }, 5, 6)).toEqual({ speed: 45 });
        expect(classLevelPatch({ class: 'Monje', speed: 40 }, 2, 3)).toEqual({});
        expect(classLevelPatch({ class: 'Paladín', speed: 30 }, 1, 2)).toEqual({});
    });

    test('Estilo de combate del paladín: +1 a la CA desde el nivel 2', () => {
        expect(perkBonus({ class: 'Paladín', level: 1 }, 'armorClass')).toBe(0);
        expect(perkBonus({ class: 'Paladín', level: 2 }, 'armorClass')).toBe(1);
        expect(perkBonus({ class: 'Paladín', level: 2 }, 'attack')).toBe(0);
    });

    test('sus árboles: juramentos y tradiciones, con habilidades que existen', () => {
        expect(familyOf({ class: 'Paladín' })).toBe('juramento');
        expect(familyOf({ class: 'Monja' })).toBe('disciplina');
        for (const cls of ['Paladín', 'Monje']) {
            const steps = nextTreeSteps({ class: cls, perks: [] });
            expect(steps).toHaveLength(3);
        }
        const tree = habilidades.filter(r => r.when?.tree && r.when.class.some(c => c === 'paladin' || c === 'monje'));
        expect(tree.map(r => r.id).sort()).toEqual(['tec-arma-sagrada', 'tec-golpe-inspirador', 'tec-mano-abierta', 'tec-mano-sana', 'tec-paso-sombra', 'tec-voto-enemistad']);
    });
});

describe('los mercenarios de paso', () => {
    test('pueden traer paladines y monjes, con su clase reconocida', () => {
        const seen = new Set();
        for (let week = 1; week <= 40; week++) {
            let seed = week * 7919;
            const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            for (const merc of weeklyMercenaries({ random, week, level: 3 })) seen.add(merc.classId);
        }
        expect(seen.has('paladin')).toBe(true);
        expect(seen.has('monje')).toBe(true);
        expect(classIdOf('Paladina')).toBe('paladin');
        expect(classIdOf('Monja')).toBe('monje');
    });
});
