/**
 * J12.21 (Daniel, 2026-10-03; wiki/maquetas/ENCARGO_COMBATE_MUELLE_Y_RESULTADO.md): la pantalla
 * de victoria o de derrota (game-engine/combat/outcome.js). Sin navegador: lo que dice y los
 * botones que tiene según lo que ha pasado.
 */

import { describe, test, expect } from '@jest/globals';
import {
    RESCUE_FEE_EACH, injuryLine, leftoversLine, lootIcon, lootKind, memberState, outcomeView, rescueFor,
} from '../public/scripts/game-engine/combat/outcome.js';

/** @param {Partial<import('../public/scripts/game-engine/combat/outcome.js').OutcomeMember>} over */
const member = (over = {}) => ({ id: '1', name: 'Nerea', className: 'Guerrero', level: 1, hp: 34, maxHp: 34, ...over });

describe('cómo ha quedado cada uno', () => {
    test('en pie, magullado, malherido, inconsciente y muerto', () => {
        expect(memberState(member()).label).toBe('En pie');
        expect(memberState(member({ hp: 30 })).label).toBe('Magullado');
        expect(memberState(member({ hp: 10, gender: 'f' })).label).toBe('Malherida');
        expect(memberState(member({ hp: 0 })).label).toBe('Inconsciente');
        expect(memberState(member({ dead: true, gender: 'mujer' })).label).toBe('Muerta');
    });

    test('modo de hierro: un confidente muerto lo está para siempre', () => {
        expect(memberState(member({ dead: true, confidant: true }), { hard: true }).label).toBe('Muerto para siempre');
        expect(memberState(member({ dead: true, confidant: true }), { hard: false }).label).toBe('Muerto');
    });

    test('las heridas: las secuelas, para siempre; las demás, con sus días', () => {
        expect(injuryLine({ label: 'Pierna rota', permanent: true })).toEqual({ label: 'Pierna rota (para siempre)', permanent: true });
        expect(injuryLine({ label: 'Tobillo torcido', daysLeft: 3 }).label).toBe('Tobillo torcido (3 días)');
    });
});

describe('el botín', () => {
    test('su tipo: misión, material o su rareza', () => {
        expect(lootKind({ name: 'Llave de la bodega' }).label).toBe('Misión');
        expect(lootKind({ name: 'Piel de lobo', subcategory: 'material' }).label).toBe('Material');
        expect(lootKind({ name: 'Espada', rarity: 'uncommon' }).label).toBe('Poco común');
        expect(lootKind({ name: 'Poción de curación' }).label).toBe('Común');
    });

    test('su icono, si no tiene dibujo', () => {
        expect(lootIcon({ name: 'Llave de la bodega' })).toBe('fa-key');
        expect(lootIcon({ name: 'Poción de curación' })).toBe('fa-flask');
        expect(lootIcon({ name: 'Piel de lobo', subcategory: 'material' })).toBe('fa-scroll');
    });
});

describe('victoria', () => {
    const base = {
        kind: /** @type {'victory'} */ ('victory'), place: 'La bodega', round: 3, time: 'Día 2 · Tarde', here: 'Puerto Alba',
        members: [member({ hp: 8, maxHp: 18, xp: 75, nextLevel: 2, dealt: 20, kills: 1, best: true }), member({ id: '2', name: 'Gerd' })],
        loot: { gold: 18, items: [{ name: 'Llave de la bodega' }, { name: 'Piel de rata', subcategory: 'material' }] },
    };

    test('la cabecera es un dato, no una narración', () => {
        const view = outcomeView({ ...base, step: { kind: 'story', title: 'Sigue la historia' } });
        expect(view.title).toBe('Victoria');
        expect(view.sub).toBe('Encuentro superado en La bodega · ronda 3');
    });

    test('el balance: vida, estado, PX, «Subir a nivel N» y quién sostuvo el combate', () => {
        const [nerea, gerd] = outcomeView({ ...base, step: null }).members;
        expect(nerea).toMatchObject({ hpText: '8/18 PG', xpText: '+75 PX', levelUp: 'Subir a nivel 2', best: true, deeds: '20 de daño · 1 tumbado' });
        expect(nerea.state.label).toBe('Malherido');
        expect(gerd).toMatchObject({ levelUp: '', xpText: '', best: false });
    });

    test('el botín, con su tipo; y la hora del juego abajo', () => {
        const view = outcomeView({ ...base, step: null });
        expect(view.gold).toBe('+18 de oro');
        expect(view.items.map(i => `${i.name}:${i.label}`)).toEqual(['Llave de la bodega:Misión', 'Piel de rata:Material']);
        expect(view.note.text).toBe('Día 2 · Tarde');
    });

    test('D-J45: el botón grande sigue lo que toca (la historia, lo siguiente o volver al sitio)', () => {
        const main = (/** @type {any} */ step) => outcomeView({ ...base, step }).buttons.find(b => b.main);
        expect(main({ kind: 'story', title: 'Sigue la historia' })).toMatchObject({ id: 'continue', label: 'Seguir con la historia' });
        expect(main({ kind: 'next', title: 'Lo siguiente: X', next: 'El asedio' })?.label).toBe('Lo siguiente: El asedio');
        expect(main({ kind: 'place', title: 'Seguir en Puerto Alba' })?.label).toBe('Volver a Puerto Alba');
    });

    test('heridos: un descanso corto; cofres o puertas por abrir: registrar la sala', () => {
        const ids = outcomeView({ ...base, step: { kind: 'next', title: 'x', next: 'y' }, leftovers: { chests: 2, rooms: 1 } }).buttons.map(b => b.id);
        expect(ids).toEqual(['rest', 'search', 'continue']);
        const unhurt = outcomeView({ ...base, members: [member()], step: { kind: 'place', title: 'x' } }).buttons.map(b => b.id);
        expect(unhurt).toEqual(['continue']);
    });

    test('tanda 22: con una escena esperando, el botón grande es seguir con la historia aunque quede algo', () => {
        const view = outcomeView({ ...base, step: { kind: 'story', title: 'Sigue la historia' }, leftovers: { chests: 1 } });
        expect(view.buttons.find(b => b.main)).toMatchObject({ id: 'continue', label: 'Seguir con la historia' });
        expect(view.buttons.find(b => b.id === 'search')).toMatchObject({ tone: 'subtle' });
    });

    test('si lo que toca es volver al tablero y queda algo, el botón grande es registrar la sala', () => {
        const view = outcomeView({ ...base, step: { kind: 'board', title: 'Volver al tablero' }, leftovers: { chests: 1 } });
        expect(view.buttons.find(b => b.main)?.label).toBe('Registrar la sala');
        expect(view.buttons.filter(b => b.id === 'search')).toHaveLength(0);
        expect(view.note.text).toBe('Día 2 · Tarde · Queda un cofre por mirar.');
    });
});

describe('derrota', () => {
    test('el rescate: quién os recoge, lo que cobra (lo que haya) y el tiempo en cama', () => {
        expect(rescueFor({ inHub: true, alive: 2, purse: 100 })).toMatchObject({ who: 'Los del gremio', where: 'la enfermería del gremio', cost: 2 * RESCUE_FEE_EACH, days: 1 });
        expect(rescueFor({ place: 'Puerto Alba', alive: 3, purse: 12 })).toMatchObject({ who: 'La gente de Puerto Alba', where: 'Puerto Alba', cost: 12, wanted: 30 });
    });

    test('cae el grupo: bajas y secuelas, el coste y «Despertar en …»', () => {
        const rescue = rescueFor({ place: 'Puerto Alba', alive: 1, purse: 50 });
        const view = outcomeView({
            kind: 'defeat', place: 'El muelle', round: 2, rescue, checkpoint: true,
            members: [member({ hp: 0, injuries: [{ label: 'Pierna rota', permanent: true }] })],
        });
        expect(view.title).toBe('El grupo ha caído');
        expect(view.rosterTitle).toBe('Bajas y secuelas');
        expect(view.members[0].scars[0].label).toBe('Pierna rota (para siempre)');
        expect(view.cost?.purse).toBe('−10 de oro');
        expect(view.cost?.lines.map(l => l.title)).toEqual(['Quién os recoge', 'Tiempo en cama']);
        expect(view.buttons.map(b => b.id)).toEqual(['back', 'wake']);
        expect(view.buttons.find(b => b.main)?.label).toBe('Despertar en Puerto Alba');
        expect(view.fallen).toBe(false);
    });

    test('sin oro bastante, se dice lo que piden y lo que se quedan', () => {
        const view = outcomeView({ kind: 'defeat', members: [member({ hp: 0 })], rescue: rescueFor({ place: 'X', alive: 3, purse: 12 }) });
        expect(view.cost?.lines.some(l => /Piden 30 de oro y se quedan con lo que lleváis: 12/.test(l.text))).toBe(true);
    });

    test('modo de hierro (D-J64): la pantalla dice claro que quien muere no vuelve', () => {
        const view = outcomeView({ kind: 'defeat', hard: true, members: [member({ dead: true, confidant: true })] });
        expect(view.hardNote).toMatch(/quien muere no vuelve, tampoco un confidente/);
        expect(view.members[0].state.label).toBe('Muerto para siempre');
    });

    test('sin nadie con vida: las salidas de siempre (J9.1), con sus clases', () => {
        const view = outcomeView({ kind: 'defeat', members: [member({ dead: true })], checkpoint: true, saves: true, home: true });
        expect(view.title).toBe('Nerea ha muerto');
        expect(view.fallen).toBe(true);
        expect(view.buttons.map(b => b.className)).toEqual(['pf-back', 'pf-load', 'pf-home']);
        const none = outcomeView({ kind: 'defeat', members: [member({ dead: true })] });
        expect(none.buttons.map(b => b.id)).toEqual(['close']);
        expect(none.note.text).toMatch(/Desde la pausa puedes cargar otra partida/);
    });

    test('la misión perdida con el grupo en pie: lo que dice la misión y «Seguir»', () => {
        const view = outcomeView({ kind: 'defeat', place: 'El muelle', members: [member()], failed: 'El ratero ha escapado' });
        expect(view.title).toBe('La misión ha fracasado');
        expect(view.sub).toBe('El ratero ha escapado · El muelle');
        expect(view.buttons.map(b => b.id)).toEqual(['close']);
    });

    test('lo que queda en el tablero, dicho', () => {
        expect(leftoversLine({ chests: 2, rooms: 1 })).toBe('Quedan dos cofres y una puerta por mirar.');
        expect(leftoversLine({})).toBe('');
    });
});
