import { describe, test, expect } from '@jest/globals';
import { afterFightStep, whereItAsks } from '../public/scripts/game-engine/combat/after-fight.js';

/** Ganada la pelea de la Taberna, en la Aldea de Barovia. */
const tavern = { place: 'Aldea de Barovia', board: 'Taberna Sangre de la Enredadera' };

describe('whereItAsks', () => {
    test('the place and board a milestone asks for, also inside «any»', () => {
        expect(whereItAsks({ kind: 'win', place: 'Aldea de Barovia', board: 'Mansión del Burgomaestre' }))
            .toEqual({ place: 'Aldea de Barovia', board: 'Mansión del Burgomaestre' });
        expect(whereItAsks({ kind: 'any', options: [{ kind: 'talk', npc: 'Ismark' }, { kind: 'arrive', place: 'Vallaki' }] }))
            .toEqual({ place: 'Vallaki', board: '' });
        expect(whereItAsks({ kind: 'check', skill: 'percepcion' })).toEqual({ place: '', board: '' });
        expect(whereItAsks(null)).toEqual({ place: '', board: '' });
    });
});

describe('afterFightStep (D-J45)', () => {
    test('a scene or an event waiting goes first', () => {
        const step = afterFightStep({ story: true, inCampaign: true, next: { title: 'Asedio', board: 'Mansión' }, here: tavern });
        expect(step.kind).toBe('story');
        expect(step.title).toBe('Sigue la historia');
    });

    test('in a campaign, the next step when it is on another board', () => {
        const step = afterFightStep({
            inCampaign: true,
            next: { title: 'Asedio en la Mansión', place: 'Aldea de Barovia', board: 'Mansión del Burgomaestre' },
            here: tavern,
        });
        expect(step).toEqual({
            kind: 'next',
            title: 'Lo siguiente: Asedio en la Mansión, en Mansión del Burgomaestre (Aldea de Barovia)',
            next: 'Asedio en la Mansión',
        });
    });

    test('in a campaign, the next step in another place, or outside the board here', () => {
        expect(afterFightStep({ inCampaign: true, next: { title: 'Llegar a Vallaki', place: 'Vallaki' }, here: tavern }).kind).toBe('next');
        expect(afterFightStep({ inCampaign: true, next: { title: 'Hablar con Ismark', place: 'Aldea de Barovia' }, here: tavern }).title)
            .toBe('Lo siguiente: Hablar con Ismark, en Aldea de Barovia');
    });

    test('the guild is not a campaign: its thread does not take you off the board', () => {
        const step = afterFightStep({ next: { title: 'Elegir una campaña', place: 'Puerto Alba' }, here: { place: 'Puerto Alba', board: 'La bodega' } });
        expect(step).toEqual({ kind: 'board', title: 'Volver al tablero: La bodega' });
    });

    test('otherwise, back to where you were: the board, or the place', () => {
        // Lo siguiente está en este mismo tablero (sin importar mayúsculas).
        expect(afterFightStep({ inCampaign: true, next: { title: 'Abrir el sótano', board: 'taberna sangre de la enredadera' }, here: tavern }).kind).toBe('board');
        // Un hito sin sitio (una tirada, una pista) no dice a dónde ir.
        expect(afterFightStep({ inCampaign: true, next: { title: 'Encontrar pistas' }, here: tavern }).kind).toBe('board');
        expect(afterFightStep({ inCampaign: true, here: tavern })).toEqual({ kind: 'board', title: 'Volver al tablero: Taberna Sangre de la Enredadera' });
        expect(afterFightStep({ here: { place: 'Aldea de Barovia' } })).toEqual({ kind: 'place', title: 'Seguir en Aldea de Barovia' });
        expect(afterFightStep().kind).toBe('place');
    });
});
