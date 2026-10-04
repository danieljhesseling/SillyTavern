import { describe, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import {
    validateSpell, validateSpells, normalizeSpell, durationRounds, isFormula, spellsOfClass, findSpell,
    SPELL_COLUMNS, SPELL_SCHOOLS,
} from '../public/scripts/game-engine/rules/spell-catalogue.js';
import { coverageGaps, maxSpellLevel } from '../public/scripts/game-engine/rules/spell-prep.js';
import { casterOf } from '../public/scripts/game-engine/rules/spell-slots.js';
import { validateBattery, DOMAINS } from '../public/scripts/game-engine/compendio/compendio.js';
import { validateKin } from '../public/scripts/game-engine/compendio/kin.js';
import { createCompendium } from '../public/scripts/game-engine/compendio/compendio.js';
import { SPELLS as GRIMOIRE, spellById } from '../public/scripts/game-engine/rules/grimoire.js';
import {
    itemSpellSpec, itemCharges, spendItemCharges, rechargeItems, itemWorks, attunedItems, canAttune,
    setAttunement, scrollCheck, ATTUNEMENT_MAX, magicItemsOf, afterUse,
} from '../public/scripts/game-engine/rules/magic-items.js';
import {
    readCasterBlock, validateCasterBlock, enemySlotsLeft, enemySlotFor, spendEnemySlot, enemySpellAbilities,
} from '../public/scripts/game-engine/combat/enemy-spells.js';
import { chooseEnemyAbility } from '../public/scripts/game-engine/combat/enemy-abilities.js';
import { createItem } from '../public/scripts/dnd-system.js';

const read = (/** @type {string} */ path) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const file = read('compendio/conjuros.json');
const catalogue = file.rows;
const classes = read('compendio/clases.json').rows;
const bestiary = read('compendio/bestiario.json').rows;
const context = { classIds: classes.map((/** @type {any} */ r) => r.id), creatureIds: bestiary.map((/** @type {any} */ r) => r.id) };
const spells = catalogue.map(normalizeSpell);
const row = (/** @type {string} */ id) => catalogue.find((/** @type {any} */ r) => r.id === id);

const fixedRoll = (/** @type {number[]} */ values) => {
    const queue = [...values];
    return () => ({ total: queue.length > 0 ? /** @type {number} */ (queue.shift()) : 0 });
};

describe('conjuros.json, la comprobación del compendio (J19.11)', () => {
    test('pasa la validación de toda batería y la de los conjuros', () => {
        expect(validateBattery('conjuros', file)).toEqual([]);
        expect(validateSpells(catalogue, context)).toEqual([]);
        expect(DOMAINS).toContain('conjuros');
    });

    test('un lote del SRD de unos ochenta, de nivel 0 a 3 (y el muro de fuego, que es de 4.º)', () => {
        expect(catalogue.length).toBeGreaterThanOrEqual(60);
        expect(catalogue.length).toBeLessThanOrEqual(85);
        const levels = new Set(spells.map(s => s.level));
        expect([...levels].sort()).toEqual([0, 1, 2, 3, 4]);
        expect(spells.filter(s => s.level === 4).map(s => s.id)).toEqual(['mag-muro-fuego']);
        // Todas las escuelas salen, y cada fila dice algo con palabras propias y cortas.
        expect(new Set(spells.map(s => s.school))).toEqual(new Set(Object.keys(SPELL_SCHOOLS)));
        for (const spell of spells) expect(spell.note.length).toBeLessThanOrEqual(220);
    });

    test('cada clase que lanza tiene conjuros de cada nivel al que llega, del 1 al 5', () => {
        expect(coverageGaps({ classRows: classes, catalogue, levels: [1, 2, 3, 4, 5] })).toEqual([]);
        const casters = classes.filter((/** @type {any} */ c) => casterOf(c));
        expect(casters.map((/** @type {any} */ c) => c.id).sort()).toEqual(['bardo', 'brujo', 'clerigo', 'druida', 'erudito', 'explorador', 'hechicero', 'mago', 'paladin']);
        // D-J27: el erudito solo lanza rituales de la lista del mago; tiene que haber alguno.
        const ritualists = casters.filter((/** @type {any} */ c) => casterOf(c)?.ritualsOnly);
        expect(ritualists.map((/** @type {any} */ c) => c.id)).toEqual(['erudito']);
        expect(spellsOfClass(spells, casterOf(ritualists[0])?.list ?? '').filter(s => s.ritual && s.level === 1).length).toBeGreaterThan(0);
        for (const kind of casters.filter((/** @type {any} */ c) => !casterOf(c)?.ritualsOnly)) {
            for (let level = 1; level <= 5; level++) {
                for (let spellLevel = 1; spellLevel <= maxSpellLevel(kind, level); spellLevel++) {
                    expect(spellsOfClass(spells, kind.id, { level: spellLevel }).length).toBeGreaterThan(0);
                }
            }
        }
    });

    test('las clases siguen pasando su validación con la columna casting', () => {
        const compendium = createCompendium({ clases: classes, razas: read('compendio/razas.json').rows });
        expect(validateKin(compendium)).toEqual([]);
    });

    test('quien sabía un conjuro de la capa ligera lo sigue sabiendo: mismo id', () => {
        const shared = spells.filter(s => spellById(s.id));
        expect(shared.length).toBeGreaterThanOrEqual(15);
        for (const spell of shared) expect(spellById(spell.id)?.id).toBe(spell.id);
        expect(findSpell(spells, 'rayo_de_fuego')?.name).toBe('Rayo de fuego');
        expect(findSpell(spells, 'curar_heridas')?.name).toBe('Curar heridas');
        // Los del grimorio que no son del SRD (Látigo de espinas, Luz severa…) siguen solo en la capa ligera.
        expect(GRIMOIRE.filter(g => !findSpell(spells, g.id)).map(g => g.id)).toContain('mag-latigo-espinas');
    });

    test('el about documenta todas las columnas', () => {
        for (const column of SPELL_COLUMNS.filter(c => !['id', 'name', 'kind', 'tags', 'weight', 'when'].includes(c))) {
            expect(file.about).toContain(column);
        }
    });
});

describe('el validador ve las erratas', () => {
    const good = row('mag-bola-fuego');

    test('una columna que no existe, una duración que no se entiende, salvar y atacar a la vez', () => {
        expect(validateSpell(good, context)).toEqual([]);
        expect(validateSpell({ ...good, damge: '8d6' }).join(' ')).toMatch(/"damge" no existe/);
        expect(validateSpell({ ...good, duration: 'un rato' }).join(' ')).toMatch(/no se entiende/);
        expect(validateSpell({ ...good, attack: 'ranged' }).join(' ')).toMatch(/no las dos/);
        expect(validateSpell({ ...good, damage: 'mucho' }).join(' ')).toMatch(/no es una fórmula/);
        expect(validateSpell({ ...good, damageType: 'Fuego' }).join(' ')).toMatch(/damageType/);
        expect(validateSpell({ ...good, school: 'pirotecnia' }).join(' ')).toMatch(/school/);
        expect(validateSpell({ ...good, classes: ['nigromante'] }, context).join(' ')).toMatch(/no es una clase/);
        expect(validateSpell({ ...good, level: 12 }).join(' ')).toMatch(/de 0/);
        expect(validateSpell({ ...good, note: '' }).join(' ')).toMatch(/falta "note"/);
    });

    test('lo que no casa: subir un truco, una reacción sin reacción, un material sin M', () => {
        expect(validateSpell({ ...row('hab-rayo-fuego'), upcast: { dice: '1d10' } }).join(' ')).toMatch(/un truco no sube/);
        expect(validateSpell({ ...row('hab-escudo-arcano'), castingTime: 'action' }).join(' ')).toMatch(/no se lanza como reacción/);
        expect(validateSpell({ ...good, castingTime: 'reaction' }).join(' ')).toMatch(/no dice cuándo/);
        expect(validateSpell({ ...good, material: { name: 'Azufre' }, components: ['V', 'S'] }).join(' ')).toMatch(/no tiene M/);
        expect(validateSpell({ ...good, upcast: { dados: '1d6' } }).join(' ')).toMatch(/upcast\.dados/);
        expect(validateSpell({ ...good, zone: { kind: 'lava' } }).join(' ')).toMatch(/zone\.kind/);
        expect(validateSpell({ ...row('conj-conjurar-animales'), summon: { creature: 'bestia-dragon', cr: 1 } }, context).join(' ')).toMatch(/no está en el bestiario/);
        expect(validateSpell({ ...good, condition: 'Congelado' }).join(' ')).toMatch(/no conoce/);
        expect(validateSpell({ ...row('hab-curar'), target: 'enemy' }).join(' ')).toMatch(/cura, y apunta a un enemigo/);
        expect(validateSpell({ ...row('conj-orden-imperiosa'), condition: undefined }).join(' ')).toMatch(/se salva de nada/);
        expect(validateSpell({ ...row('conj-detectar-magia'), level: 0, upcast: undefined }).join(' ')).toMatch(/un truco no es un ritual/);
        expect(validateSpell({ ...good, concentration: true }).join(' ')).toMatch(/instantáneo/);
    });

    test('un conjuro nuevo que se llama como uno del grimorio tiene que llevar su id', () => {
        const copy = { ...good, id: 'conj-bola-fuego' };
        expect(validateSpells([copy]).join(' ')).toMatch(/usa su id \(mag-bola-fuego\)/);
        expect(validateSpells([{ ...row('conj-telarana'), id: 'mag-telarana' }]).join(' ')).toMatch(/empieza por "conj-"/);
        expect(validateSpells([good, good]).join(' ')).toMatch(/repetido/);
    });

    test('lo de por defecto: un truco que se salva no hace nada; uno de nivel, la mitad', () => {
        expect(normalizeSpell(row('conj-llama-sagrada')).onSave).toBe('none');
        expect(normalizeSpell(row('mag-bola-fuego')).onSave).toBe('half');
        expect(normalizeSpell(row('conj-inmovilizar-persona')).conditionRounds).toBe(10);
        expect(normalizeSpell(row('conj-orden-imperiosa')).conditionRounds).toBe(1);
        expect(normalizeSpell({}).castingTime).toBe('action');
    });

    test('las duraciones, en castellano o en inglés, y las fórmulas', () => {
        expect(['instantáneo', '1 ronda', '1 minuto', '10 minutos', '1 hora', '8 horas', '24 horas'].map(durationRounds))
            .toEqual([0, 1, 10, 100, 600, 4800, 14400]);
        expect(durationRounds('hasta que se disipe')).toBe(Infinity);
        expect(durationRounds('permanente')).toBe(Infinity);
        expect(durationRounds('1 minute')).toBe(10);
        expect(durationRounds('un rato')).toBeNaN();
        expect(['1d8', '3d4+3', '2d6+1d4', '5'].every(isFormula)).toBe(true);
        expect(['d', '1d', 'dos'].some(isFormula)).toBe(false);
    });
});

describe('los objetos mágicos (J19.9)', () => {
    const staff = createItem({
        name: 'Bastón de fuego', category: 'magic', subcategory: 'ring_wand_staff', linkedSpell: 'mag-bola-fuego',
        spellLevel: 3, saveDC: 15, uses: 10, maxUses: 10, recharge: 'At Dawn', attunement: true,
    });

    test('la ficha de objeto que ya existe trae las cargas, la recarga y la sintonía', () => {
        expect(staff).toMatchObject({ uses: 10, maxUses: 10, recharge: 'At Dawn', attunement: true, linkedSpell: 'mag-bola-fuego' });
        expect(itemSpellSpec(staff)).toMatchObject({ spell: 'mag-bola-fuego', kind: 'staff', slotLevel: 3, saveDc: 15, recharge: 'At Dawn' });
        expect(itemSpellSpec({ name: 'Varita de escarcha' })).toMatchObject({ spell: 'mag-cono-escarcha', kind: 'wand' });
        expect(itemSpellSpec({ name: 'Pergamino raro', subcategory: 'scroll', linkedSpell: 'hab-sueno' })?.kind).toBe('scroll');
        expect(itemSpellSpec({ name: 'Piedra' })).toBeNull();
        // Lo guardado de la capa ligera sigue igual.
        expect(magicItemsOf({ items: [{ id: 'v', name: 'Varita de escarcha', charges: 2 }] })[0].left).toBe(2);
        expect(afterUse({ name: 'Varita de escarcha', charges: 1 }).remove).toBe(true);
    });

    test('las cargas: un bastón gasta varias; sin recarga, se apaga; con recarga, espera', () => {
        expect(itemCharges(staff)).toEqual({ left: 10, max: 10 });
        expect(itemCharges({ name: 'Varita de escarcha' })).toEqual({ left: 3, max: 3 });
        expect(spendItemCharges(staff, 3)).toMatchObject({ ok: true, uses: 7, remove: false });
        expect(spendItemCharges({ ...staff, uses: 2 }, 3).reason).toMatch(/le quedan 2 cargas y hacen falta 3/);
        expect(spendItemCharges({ ...staff, uses: 1 })).toMatchObject({ uses: 0, remove: false });
        expect(spendItemCharges({ name: 'Varita gastada', uses: 1, maxUses: 3 })).toMatchObject({ uses: 0, remove: true });
    });

    test('recargar con el descanso: hasta el máximo, o lo que digan sus dados', () => {
        const empty = { ...staff, uses: 2 };
        expect(rechargeItems([empty], 'corto').items[0].uses).toBe(2);
        const full = rechargeItems([empty], 'largo');
        expect(full.items[0].uses).toBe(10);
        expect(full.lines).toEqual(['🔋 Bastón de fuego recupera cargas: 10/10.']);
        expect(rechargeItems([{ ...empty, rechargeDice: '1d6+1' }], 'largo', fixedRoll([5])).items[0].uses).toBe(7);
        expect(rechargeItems([{ name: 'Anillo', uses: 0, maxUses: 1, recharge: 'Short Rest' }], 'corto').items[0].uses).toBe(1);
    });

    test('la sintonía: tres como mucho, fuera de combate, y sin ella no funciona', () => {
        expect(itemWorks(staff)).toBe(false);
        expect(itemWorks({ ...staff, attuned: true })).toBe(true);
        expect(itemWorks({ name: 'Poción' })).toBe(true);
        const attuned = (/** @type {string} */ id) => ({ id, name: id, attunement: true, attuned: true });
        const member = { items: [attuned('a'), attuned('b'), attuned('c'), { ...staff, id: 's' }, { id: 'p', name: 'Cuerda' }] };
        expect(attunedItems(member)).toHaveLength(ATTUNEMENT_MAX);
        expect(canAttune(member, 's').reason).toMatch(/Ya tiene 3/);
        expect(canAttune(member, 'p').reason).toMatch(/no pide sintonía/);
        expect(canAttune(member, 'a').reason).toMatch(/Ya está en sintonía/);
        expect(canAttune(member, 'x').reason).toMatch(/No lleva/);
        const freed = setAttunement(member, 'a', false);
        expect(canAttune({ items: freed.items }, 's', { inCombat: true }).reason).toMatch(/peleando no/);
        const done = setAttunement({ items: freed.items }, 's', true);
        expect(done.ok).toBe(true);
        expect(attunedItems({ items: done.items }).map(i => i.id)).toEqual(['b', 'c', 's']);
        expect(setAttunement(member, 's', true).ok).toBe(false);
    });

    test('leer un pergamino con las reglas de 5e: de tu lista, y si es de más nivel, una prueba', () => {
        const bola = normalizeSpell(row('mag-bola-fuego'));
        expect(scrollCheck({ spell: bola, classList: 'clerigo', maxLevel: 3, roll: fixedRoll([20]) }).reason).toMatch(/no es de su lista/);
        expect(scrollCheck({ spell: bola, classList: 'mago', maxLevel: 3, roll: fixedRoll([1]) })).toMatchObject({ ok: true, needsCheck: false });
        expect(scrollCheck({ spell: bola, classList: 'mago', maxLevel: 2, roll: fixedRoll([10]), modifier: 3 })).toMatchObject({ needsCheck: true, dc: 13, success: true });
        expect(scrollCheck({ spell: bola, classList: 'mago', maxLevel: 1, roll: fixedRoll([9]), modifier: 3 }).success).toBe(false);
    });
});

describe('enemigos que lanzan (J19.12)', () => {
    /** Una ficha como la de Strahd: mago de nivel 9, CD 18, +10. Solo es una prueba: el paquete no se toca. */
    const strahd = {
        name: 'Strahd von Zarovich', hp: 90, armorClass: 16, cr: 6, profile: 'skirmisher',
        spellcasting: {
            ability: 'intelligence', saveDc: 18, attackBonus: 10, casterLevel: 9,
            spells: ['mag-escarcha', 'hab-mano-lejana', 'conj-nube-niebla', 'hab-sueno', 'conj-paso-brumoso', 'conj-oscuridad', 'conj-animar-muertos', 'mag-bola-fuego'],
        },
    };
    /** Y una bruja de nivel 3, con sus espacios escritos y un conjuro innato. */
    const bruja = {
        name: 'Bruja Baroviana',
        spellcasting: { ability: 'intelligence', saveDc: 11, attackBonus: 3, casterLevel: 3, slots: { 1: 4, 2: 2 }, spells: ['hab-mano-lejana', 'hab-sueno', 'mag-invisibilidad'], perDay: { 1: ['conj-toque-helado'] } },
    };

    test('el bloque se lee; sin espacios escritos, los de un lanzador completo de su nivel', () => {
        const block = /** @type {any} */ (readCasterBlock(strahd.spellcasting));
        expect(block.slots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
        expect(readCasterBlock(bruja.spellcasting)?.slots).toEqual({ 1: 4, 2: 2 });
        expect(readCasterBlock(bruja.spellcasting)?.perDay).toEqual([{ id: 'conj-toque-helado', uses: 1 }]);
        expect(readCasterBlock(null)).toBeNull();
    });

    test('se valida con los mismos conjuros del grupo', () => {
        expect(validateCasterBlock(strahd.spellcasting, catalogue, 'Strahd')).toEqual([]);
        expect(validateCasterBlock(bruja.spellcasting, catalogue, 'Bruja')).toEqual([]);
        const bad = validateCasterBlock({ saveDc: 40, slots: { 1: 2, 10: 1 }, spells: ['mag-bola-fuego', 'conj-deseo'], perDay: { 1: ['nada'] } }, catalogue, 'Bruja');
        expect(bad.join(' ')).toMatch(/saveDc/);
        expect(bad.join(' ')).toMatch(/van del 1 al 9/);
        expect(bad.join(' ')).toMatch(/"conj-deseo" no está en conjuros\.json/);
        expect(bad.join(' ')).toMatch(/Bola de fuego es de 3\.er nivel y no tiene espacios/);
        expect(bad.join(' ')).toMatch(/"nada" \(perDay\)/);
        expect(validateCasterBlock([], catalogue)).toEqual(['Un enemigo: "spellcasting" tiene que ser un objeto.']);
    });

    test('todo bloque de lanzador del bestiario y de los paquetes de campaña se valida', () => {
        const packs = readdirSync(new URL('../public/mundos/', import.meta.url)).filter(f => f.endsWith('.pack.json'));
        const enemies = [
            ...bestiary,
            ...packs.flatMap(f => (read(`mundos/${f}`).bestiary ?? [])),
        ].filter((/** @type {any} */ e) => e?.spellcasting !== undefined);
        expect(enemies.flatMap((/** @type {any} */ e) => validateCasterBlock(e.spellcasting, catalogue, e.name))).toEqual([]);
    });

    test('sus conjuros como habilidades: trucos a voluntad, los de nivel con los espacios que le quedan', () => {
        const block = /** @type {any} */ (readCasterBlock(strahd.spellcasting));
        const abilities = enemySpellAbilities({ enemy: { slotsUsed: { 3: 1 } }, block, catalogue });
        const ids = abilities.map(a => a.id);
        // La mano de mago no sirve peleando; animar muertos tarda un minuto.
        expect(ids).toEqual(['mag-escarcha', 'conj-nube-niebla', 'hab-sueno', 'conj-paso-brumoso', 'conj-oscuridad', 'mag-bola-fuego']);
        expect(abilities[0]).toMatchObject({ resource: 'at_will', damage: '2d8', attackBonus: 10 });
        expect(abilities.find(a => a.id === 'mag-bola-fuego')).toMatchObject({ resource: 'long_rest', usesPerRest: 6, slotLevel: 3, saveDc: 18 });
        // Concentrado ya en algo, no suelta su conjuro por otro.
        expect(enemySpellAbilities({ enemy: {}, block, catalogue, concentrating: true }).map(a => a.id)).not.toContain('conj-oscuridad');
    });

    test('la máquina de decidir de siempre elige su golpe especial', () => {
        const block = /** @type {any} */ (readCasterBlock(strahd.spellcasting));
        const abilities = enemySpellAbilities({ enemy: {}, block, catalogue });
        const choice = chooseEnemyAbility({
            actor: { id: 'strahd', currentHp: 90, maxHp: 90 },
            from: { x: 0, y: 0 },
            abilities: /** @type {any} */ (abilities),
            targets: [{ id: 'lyra', gridX: 6, gridY: 0, currentHp: 20, maxHp: 20 }],
        });
        expect(choice?.ability.id).toBe('mag-bola-fuego');
    });

    test('lo innato cuenta sus usos; los espacios se gastan en el enemigo', () => {
        const block = /** @type {any} */ (readCasterBlock(bruja.spellcasting));
        const abilities = enemySpellAbilities({ enemy: {}, block, catalogue });
        expect(abilities.find(a => a.id === 'conj-toque-helado')).toMatchObject({ innate: true, usesPerRest: 1 });
        expect(enemySlotFor({ slotsUsed: { 1: 4 } }, block, 1)).toBe(2);
        expect(enemySlotFor({ slotsUsed: { 1: 4, 2: 2 } }, block, 1)).toBe(0);
        const used = spendEnemySlot({ slotsUsed: { 1: 3 } }, block, 1);
        expect(used).toEqual({ 1: 4 });
        expect(enemySlotsLeft({ slotsUsed: used }, block)).toEqual({ 1: 0, 2: 2 });
        expect(enemySpellAbilities({ enemy: { slotsUsed: { 1: 4, 2: 2 } }, block, catalogue }).map(a => a.id)).toEqual(['conj-toque-helado']);
    });
});
