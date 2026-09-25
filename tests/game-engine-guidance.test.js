import { describe, test, expect } from '@jest/globals';
import { hintFor, dueHints, buildJournal, buildHelp, STALL_DAYS } from '../public/scripts/game-engine/campaign/guidance.js';
import { addRequest, takeRequest, resolveSkill, readRequests, MAX_REQUESTS, REQUEST_DC } from '../public/scripts/game-engine/campaign/check-requests.js';
import { buildActionChips } from '../public/scripts/game-engine/ui/shell/action-chips.js';

const SKILLS = { persuasion: { label: 'Persuasión' }, athletics: { label: 'Atletismo' } };
const cueva = { id: 'cueva', title: 'La cueva', hint: 'Buscadla.', asks: { kind: 'arrive', place: 'La cueva escondida' } };
const giles = { id: 'giles', title: 'Giles', hint: '', asks: { kind: 'talk', npc: 'Giles', place: 'El Pueblo de Barro' } };

describe('pistas', () => {
    test('la que apunta y la que dice qué hacer', () => {
        expect(hintFor(cueva, 1)).toBe('Lo que buscáis tiene que ver con La cueva escondida.');
        expect(hintFor(cueva, 2)).toBe('Hay que llegar a La cueva escondida.');
        expect(hintFor(giles, 2)).toMatch(/hablar con Giles en El Pueblo de Barro: nombradle/);
        expect(hintFor({ title: '', asks: { kind: 'check', skill: 'athletics', place: 'El Peaje' } }, 2, s => SKILLS[/** @type {'athletics'} */ (s)].label))
            .toBe('Una tirada de Atletismo en El Peaje lo resuelve.');
    });

    test('llegan a los días que tocan, una vez cada una', () => {
        let out = dueHints({ open: [cueva], today: 1 });
        expect(out.hints).toEqual([]);
        out = dueHints({ open: [cueva], openedDay: out.openedDay, given: out.given, today: 1 + STALL_DAYS[0] });
        expect(out.hints.map(h => h.level)).toEqual([1]);
        const again = dueHints({ open: [cueva], openedDay: out.openedDay, given: out.given, today: 2 + STALL_DAYS[0] });
        expect(again.hints).toEqual([]);
        const clear = dueHints({ open: [cueva], openedDay: out.openedDay, given: out.given, today: 1 + STALL_DAYS[1] });
        expect(clear.hints[0]).toMatchObject({ level: 2, text: 'Hay que llegar a La cueva escondida.' });
    });

    test('lo que se cierra deja de contar', () => {
        const out = dueHints({ open: [], openedDay: { cueva: 1 }, today: 20 });
        expect(out.openedDay).toEqual({});
    });
});

describe('diario y ayuda', () => {
    test('el diario junta hilo, pistas, encargo, rumores y recuerdos', () => {
        const sections = buildJournal({
            open: [cueva],
            clues: { cueva: ['Lo que buscáis tiene que ver con La cueva escondida.'] },
            taken: { title: 'El carro', locationName: 'El Peaje', days: 10 },
            today: 4,
            heard: [{ text: 'Hay plata falsa.', by: 'Giles', where: 'El Pueblo de Barro', leadsTo: 'La mina' }],
            memories: ['Hoy: Bruna salvó a Sela.'],
        });
        expect(sections.map(s => s.title)).toEqual(['Entre manos', 'Encargo aceptado', 'Lo que se oye', 'Lo que recordáis']);
        expect(sections[0].items[0]).toMatch(/La cueva — Buscadla\.\n {3}↳ Lo que buscáis/);
        expect(sections[1].items[0]).toBe('El carro — en El Peaje · quedan 6 día(s)');
        expect(sections[2].items[0]).toBe('«Hay plata falsa.» (Giles, El Pueblo de Barro) → lleva a La mina');
    });

    test('la ayuda: solo lo que se puede, y pulsable', () => {
        const sections = buildHelp({
            focus: { title: 'La cueva', hint: 'Buscadla.' },
            services: [{ label: 'La posada', actions: [
                { id: 'inn-meal', label: 'Comer', detail: '3 de oro', enabled: true },
                { id: 'inn-room', label: 'Dormir', detail: 'No llega', enabled: false },
            ] }],
            boards: ['El sótano'],
            chips: [{ id: 'rumor', label: 'Escuchar rumores' }],
            places: 3,
        });
        const keys = sections.flatMap(s => s.items.map(i => i.key)).filter(Boolean);
        expect(keys).toEqual(['journal', 'service:inn-meal', 'board:El sótano', 'chip:rumor', 'glossary']);
        expect(sections.at(-1)?.items.map(i => i.label)).toContain('Viajar (3 sitios)');
    });

    test('en combate, a la barra', () => {
        expect(buildHelp({ fighting: true })[0].title).toBe('En combate');
    });
});

describe('tiradas pedidas', () => {
    test('por id o por nombre, sin tildes; con CD dentro de límites', () => {
        expect(resolveSkill('Persuasion', SKILLS)).toBe('persuasion');
        let out = addRequest(null, { skill: 'persuasión', reason: 'convencer al guardia', dc: 40 }, SKILLS);
        expect(out.requests).toEqual([{ skill: 'persuasion', reason: 'convencer al guardia', dc: REQUEST_DC.max }]);
        out = addRequest(out.requests, { skill: 'persuasion' }, SKILLS);
        expect(out.added).toBe(false);
        expect(addRequest(null, { skill: 'volar' }, SKILLS).reason).toMatch(/no existe/);
    });

    test('no más de dos, y al tirar se gasta', () => {
        let list = addRequest(null, { skill: 'persuasion' }, SKILLS).requests;
        list = addRequest(list, { skill: 'athletics' }, SKILLS).requests;
        expect(list).toHaveLength(MAX_REQUESTS);
        const taken = takeRequest(list, 'athletics', SKILLS);
        expect(taken.request?.dc).toBe(REQUEST_DC.default);
        expect(readRequests(taken.requests, SKILLS).map(r => r.skill)).toEqual(['persuasion']);
    });

    test('sale como la primera ficha, con su comando', () => {
        const chips = buildActionChips({ requests: [{ skill: 'persuasion', label: 'Persuasión', reason: 'convencer al guardia', dc: 14 }], rumors: 2 });
        expect(chips[0]).toMatchObject({ id: 'check-request:persuasion', command: '/tirada persuasion' });
        expect(chips[0].label).toBe('Tirar Persuasión (convencer al guardia) · CD 14');
    });
});
