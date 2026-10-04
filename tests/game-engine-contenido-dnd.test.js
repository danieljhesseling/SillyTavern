// Razas, equipo y bestiario del SRD (wiki/gemini/ROADMAP_CONTENIDO_DND.md, secciones 3 a 5).
import fs from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { breedMonster } from '../public/scripts/game-engine/compendio/bestiary.js';
import { abilitiesFor, bornWith } from '../public/scripts/game-engine/compendio/skills.js';
import { describeKin } from '../public/scripts/game-engine/compendio/kin.js';
import { traitsOf, feltDamage, regenerationTurn, stopsRegeneration } from '../public/scripts/game-engine/combat/monster-traits.js';
import { bestImbueType } from '../public/scripts/game-engine/rules/elemental-weapon.js';
import { FORM_MASTERY, isLightWeapon } from '../public/scripts/game-engine/rules/weapon-mastery.js';
import { healingPotionOf } from '../public/scripts/game-engine/rules/actions-2024.js';
import { describeLootItem } from '../public/scripts/game-engine/combat/loot-items.js';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/compendio/${name}.json`, import.meta.url), 'utf8'));
const bestiario = read('bestiario');
const habilidades = read('habilidades');
const razas = read('razas');
const armas = read('armas');
const armaduras = read('armaduras');

const seeded = (seed) => {
    let state = seed;
    return () => ((state = (state * 9301 + 49297) % 233280) / 233280);
};

describe('lo que un bicho resiste', () => {
    test('se lee como venga y solo sale si lo trae', () => {
        expect(traitsOf({ resistances: ['fuego', 'Cold'], immunities: 'Poison', regeneration: 10 }))
            .toEqual({ resistances: ['Fire', 'Cold'], immunities: ['Poison'], regeneration: 10 });
        expect(traitsOf({ name: 'Lobo' })).toEqual({});
    });

    test('la mitad, nada o el doble', () => {
        const imp = { immunities: ['Fire'], resistances: ['Cold'], vulnerabilities: ['Thunder'] };
        expect(feltDamage({ damage: 9, type: 'Fire', target: imp }).damage).toBe(0);
        expect(feltDamage({ damage: 9, type: 'Cold', target: imp }).damage).toBe(4);
        expect(feltDamage({ damage: 9, type: 'Thunder', target: imp }).damage).toBe(18);
        expect(feltDamage({ damage: 9, type: 'Slashing', target: imp })).toEqual({ damage: 9, affinity: 'normal', note: '' });
    });

    test('y el dracónido rojo resiste el fuego por su raza', () => {
        const rojo = razas.rows.find(r => r.id === 'raza-draconido-rojo');
        expect(feltDamage({ damage: 10, type: 'Fire', target: { race: 'Dracónido rojo' }, raceRow: rojo }).damage).toBe(5);
    });

    test('Arma elemental ya no elige fuego contra un elemental de fuego', () => {
        const fuego = bestiario.rows.find(r => r.id === 'bestia-elemental-fuego');
        expect(bestImbueType({ types: ['Fire', 'Cold'], enemies: [{ name: fuego.name, ...traitsOf(fuego) }] }).type).not.toBe('Fire');
    });
});

describe('la regeneración del trol', () => {
    const trol = { name: 'Trol', regeneration: 10, currentHp: 40, maxHp: 86 };

    test('recupera al empezar su turno, sin pasarse', () => {
        expect(regenerationTurn(trol).heal).toBe(10);
        expect(regenerationTurn({ ...trol, currentHp: 80 }).heal).toBe(6);
        expect(regenerationTurn({ ...trol, currentHp: 0 }).heal).toBe(0);
    });

    test('salvo si le dio fuego o ácido', () => {
        expect(stopsRegeneration('Fire')).toBe(true);
        expect(stopsRegeneration('ácido')).toBe(true);
        expect(stopsRegeneration('Cold')).toBe(false);
        expect(regenerationTurn({ ...trol, regenBlocked: true })).toMatchObject({ heal: 0, blocked: true });
    });
});

describe('los bichos del SRD en el bestiario', () => {
    const compendium = () => createCompendium({ bestiario: bestiario.rows });
    const srd = bestiario.rows.filter(r => (r.tags ?? []).includes('srd'));

    test('hay entre diez y quince, con su desafío y un tramo en el que salen', () => {
        expect(srd.length).toBeGreaterThanOrEqual(10);
        expect(srd.length).toBeLessThanOrEqual(15);
        for (const row of srd) {
            expect(row.cr).toBeGreaterThan(0);
            expect(row.when.cr[0]).toBeLessThanOrEqual(row.cr);
            expect(row.when.cr[1]).toBeGreaterThanOrEqual(row.cr);
        }
    });

    test('un trol no sale en una pelea de CR 1/2', () => {
        const random = seeded(3);
        for (let i = 0; i < 60; i++) {
            const monster = breedMonster({ compendium: compendium(), cr: 0.5, random, templates: 0 });
            expect(['bestia-trol', 'bestia-dragon-rojo-joven', 'bestia-elemental-fuego']).not.toContain(monster.from.arquetipo);
        }
    });

    test('y en una de CR 5 del pantano sale con su regeneración', () => {
        const random = seeded(11);
        const seen = [];
        for (let i = 0; i < 80; i++) seen.push(breedMonster({ compendium: compendium(), cr: 5, biome: 'pantano', random, templates: 0 }));
        const trol = seen.find(m => m.from.arquetipo === 'bestia-trol');
        expect(trol).toBeTruthy();
        expect(trol.regeneration).toBe(10);
        expect(trol.hp).toBeGreaterThan(80);
    });
});

describe('las razas nuevas', () => {
    test('el dracónido sabe su aliento, y nadie más', () => {
        const compendium = createCompendium({ habilidades: habilidades.rows });
        const ids = (race) => abilitiesFor({ compendium, className: 'guerrero', level: 1, race }).map(a => a.id);
        expect(ids('Dracónido rojo')).toContain('hab-aliento-fuego');
        expect(ids('Dracónido azul')).toContain('hab-aliento-rayo');
        expect(ids('Aasimar')).toContain('hab-manos-curativas');
        expect(ids('Goliat')).toContain('hab-golpe-colinas');
        expect(ids('Humano')).not.toContain('hab-aliento-fuego');
        expect(ids('')).not.toContain('hab-aliento-fuego');
        // Lo de los bichos no lo aprende nadie, ni con maestro.
        expect(ids('Dracónido rojo').some(id => id.startsWith('bicho-'))).toBe(false);
        expect(habilidades.rows.filter(r => r.id.startsWith('bicho-')).every(bornWith)).toBe(true);
    });

    test('y su tarjeta dice lo que resiste', () => {
        expect(describeKin(razas.rows.find(r => r.id === 'raza-aasimar'))).toContain('resiste lo necrótico y lo radiante');
    });
});

describe('el equipo del SRD', () => {
    test('cada arma tiene su maestría de 2024, la misma en la fila y en la tabla', () => {
        for (const row of armas.rows) expect(FORM_MASTERY[row.id]).toBe(row.mastery);
        for (const id of ['forma-hoz', 'forma-latigo', 'forma-lucero-alba', 'forma-dardo', 'forma-ballesta-pesada']) {
            expect(armas.rows.some(r => r.id === id)).toBe(true);
        }
        expect(isLightWeapon({ name: 'Hoz de hierro', from: { forma: 'forma-hoz' } })).toBe(true);
    });

    test('las armaduras con los números de 2024', () => {
        const byId = new Map(armaduras.rows.map(r => [r.id, r]));
        expect(byId.get('forma-cota-escamas')).toMatchObject({ armorClass: 14, dexMode: 'half' });
        expect(byId.get('forma-cota-malla')).toMatchObject({ armorClass: 16, dexMode: 'none' });
        expect(byId.get('forma-camisa-anillas')).toMatchObject({ armorClass: 13, dexMode: 'half' });
    });

    test('las pociones de curación superior y suprema se beben', () => {
        expect(healingPotionOf(describeLootItem('Poción de curación superior'))).toBe('8d4+8');
        expect(healingPotionOf(describeLootItem('Poción de curación suprema'))).toBe('10d4+20');
    });
});
