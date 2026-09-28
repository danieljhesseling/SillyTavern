import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    talkTopics, topicAnswer, threatAnswer, attitudeBand, talkNote, talkPromptNote, sceneAddressee, narratorAskNote,
    effectiveAttitude, confronts, keepSpeech,
} from '../public/scripts/game-engine/campaign/talk.js';
import { repliesFor } from '../public/scripts/game-engine/ui/shell/replies.js';
import { narrate } from '../public/scripts/game-engine/campaign/engine-narrator.js';

const rows = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8')).rows;
const giles = {
    name: 'Giles', trade: 'Tabernero',
    wants: 'Que alguien le pague la cuenta del soldado muerto antes del viernes.',
    knows: 'Quién entra y quién sale del pueblo de noche, por el crujido de la madera.',
    voice: 'Lenta, ronca, siempre midiendo si el que le habla tiene dinero para pagar.',
};
/** Contar la respuesta como lo hace el juego. */
const say = (/** @type {any} */ plan) => narrate({ rows, moment: plan.moment, facts: plan.facts, random: () => 0.3 }).text;

describe('hablar sin modelo (Z2 de ROADMAP_SIN_TOKENS)', () => {
    test('los temas salen de lo que se sabe de él, y siempre se puede preguntar qué piensa', () => {
        expect(talkTopics({ npc: giles }).map(t => t.id)).toEqual(['sabe', 'quiere', 'vosotros']);
        expect(talkTopics({ npc: giles, milestone: { hint: 'x' }, hasRumor: true, hasCase: true }).map(t => t.id))
            .toEqual(['hilo', 'sabe', 'quiere', 'rumor', 'caso', 'vosotros']);
        // Alguien de un mundo generado, sin nada escrito: al menos lo que piensa.
        expect(talkTopics({ npc: { name: 'Marta' } }).map(t => t.id)).toEqual(['vosotros']);
    });

    test('lo que sabe solo se lo cuenta a quien no le mira mal', () => {
        const friendly = topicAnswer({ npc: giles, topic: 'sabe', attitude: 1 });
        expect(friendly?.reveals).toBe(true);
        expect(say(friendly)).toMatch(/Sabe quién entra y quién sale del pueblo de noche/);
        const hostile = topicAnswer({ npc: giles, topic: 'sabe', attitude: -1 });
        expect(hostile?.reveals).toBe(false);
        expect(say(hostile)).not.toMatch(/crujido/);
        expect(say(hostile)).toMatch(/Giles/);
    });

    test('el mismo dato, dicho distinto según cómo os mire', () => {
        const neutral = say(topicAnswer({ npc: giles, topic: 'sabe', attitude: 0 }));
        const friendly = say(topicAnswer({ npc: giles, topic: 'sabe', attitude: 2 }));
        expect(neutral).not.toBe(friendly);
        expect(say(topicAnswer({ npc: giles, topic: 'vosotros', attitude: -2, attitudeWord: 'recelosa' }))).toMatch(/recelosa/);
    });

    test('lo que busca se ve siempre, con su frase', () => {
        expect(say(topicAnswer({ npc: giles, topic: 'quiere', attitude: -3 }))).toMatch(/que alguien le pague la cuenta del soldado muerto/);
    });

    test('amenazar: si sale, lo suelta; si no, no', () => {
        expect(say(threatAnswer({ npc: giles, success: true }))).toMatch(/sabe quién entra/);
        expect(say(threatAnswer({ npc: giles, success: false }))).not.toMatch(/crujido/);
    });

    test('la actitud, en tres', () => {
        expect([-3, -1, 0, 1, 3].map(attitudeBand)).toEqual(['mala', 'mala', 'neutra', 'buena', 'buena']);
    });

    test('con modelo, a quien se le habla contesta él, con su voz, y sin soltar lo que sabe', () => {
        const note = talkPromptNote({ name: giles.name, trade: giles.trade, voice: giles.voice, attitudeWord: 'neutral' });
        expect(note).toMatch(/^\[CONVERSACIÓN\] Quien juega le está hablando a Giles \(tabernero\)\. Ahora no narras: contesta Giles, en primera persona/);
        expect(note).toMatch(/Habla así: lenta, ronca/);
        // Corto, en su boca, y sin lo que no sabría (Daniel, 2026-09-28).
        expect(note).toMatch(/una o dos frases de lo que dice/);
        expect(note).toMatch(/Sin párrafos describiendo la escena/);
        expect(note).toMatch(/No menciones presagios ni nada que Giles no sabría/);
        expect(note).not.toMatch(/crujido/);
        expect(talkPromptNote({ name: 'Bran', companion: true })).toMatch(/hablando a Bran, de tu grupo\./);
        expect(talkPromptNote({ name: '' })).toBe('');
    });

    test('al modelo le llegan los hechos y cómo habla; en pantalla, solo lo que dice', () => {
        const note = talkNote(giles, 'Giles se lo piensa, y al final habla.');
        expect(note).toMatch(/^\[GENTE\] Giles se lo piensa/);
        expect(note).toMatch(/Habla así: lenta, ronca/);
    });
});

// Daniel, 2026-09-28: con el alguacil reventando la puerta, «¿qué pasa?» lo contestaba el
// narrador. Lo que se escribe lo contesta quien tienes delante; el narrador, con su botón.
describe('a quién le habla lo que se escribe', () => {
    const people = ['Giles', 'Torres', 'Lord Edmund Vane', 'Fray Anselmo'];
    const waiting = ['Guardia de Montesclaros', 'Guardia de Montesclaros', 'Alguacil Torres'];

    test('a quien nombras, si está aquí; con o sin tildes y mayúsculas', () => {
        expect(sceneAddressee({ said: 'Giles, ¿cuánto te debo?', people })).toBe('Giles');
        expect(sceneAddressee({ said: 'oiga, EDMUND, escúcheme', people })).toBe('Lord Edmund Vane');
        expect(sceneAddressee({ said: '¿Qué hay, Kael?', people, companions: ['Kael'] })).toBe('Kael');
    });

    test('un título suelto no basta para saber de quién se habla', () => {
        expect(sceneAddressee({ said: 'Fray, ven aquí', people })).toBe('');
        expect(sceneAddressee({ said: 'Anselmo, ven aquí', people })).toBe('Fray Anselmo');
    });

    test('sin nombrar a nadie, contesta quien te planta cara en el tablero', () => {
        expect(sceneAddressee({ said: '¿Qué pasa?', people, waiting })).toBe('Torres');
        // Nombrar a otro manda sobre quien tienes delante.
        expect(sceneAddressee({ said: 'Giles, ¿qué pasa?', people, waiting })).toBe('Giles');
    });

    test('sin nadie delante ni nombrado, nadie: contesta el narrador', () => {
        expect(sceneAddressee({ said: '¿Qué pasa?', people })).toBe('');
        expect(sceneAddressee({ said: '¿Qué pasa?', people, waiting: ['Lobo gris'] })).toBe('');
        expect(sceneAddressee({ said: '', people, waiting })).toBe('');
    });

    test('al narrador se le pregunta fuera de la escena, y contesta él', () => {
        expect(narratorAskNote()).toMatch(/^\[AL NARRADOR\] /);
        expect(narratorAskNote()).toMatch(/No hables por nadie de la escena/);
    });
});

// Daniel, 2026-09-28: con el alguacil reventando la puerta, la charla se comportaba como una
// de taberna: «neutral», «¿qué necesitas?», y lo que sabe y busca, a un clic.
describe('una charla que sabe que es un enfrentamiento', () => {
    const waiting = ['Guardia de Montesclaros', 'Alguacil Torres'];

    test('quien está entre los que esperan en el tablero os planta cara', () => {
        expect(confronts('Torres', waiting)).toBe(true);
        expect(confronts('Giles', waiting)).toBe(false);
        expect(confronts('', waiting)).toBe(false);
    });

    test('quien os planta cara no os mira neutral: como mucho, receloso', () => {
        expect(effectiveAttitude(0, true)).toBe(-2);
        expect(effectiveAttitude(-3, true)).toBe(-3);
        expect(effectiveAttitude(2, true)).toBe(-2);
        expect(effectiveAttitude(1, false)).toBe(1);
    });

    test('lo que sabe, busca y piensa sale cerrado, y dice cómo se abre', () => {
        const locked = Object.fromEntries(talkTopics({ npc: giles, attitude: 0 }).map(t => [t.id, t.locked ?? '']));
        expect(locked.sabe).toMatch(/aprecia/);
        expect(locked.quiere).toMatch(/sonsácale/);
        expect(locked.vosotros).toMatch(/sonsácale/);
        // Calado con una tirada: lo que busca y lo que piensa; lo que sabe, no.
        const read = Object.fromEntries(talkTopics({ npc: giles, attitude: 0, read: true }).map(t => [t.id, t.locked ?? '']));
        expect([read.sabe !== '', read.quiere, read.vosotros]).toEqual([true, '', '']);
        // Con relación, todo.
        expect(talkTopics({ npc: giles, attitude: 1 }).every(t => !t.locked)).toBe(true);
    });

    test('quien os planta cara no está para rumores ni para el caso', () => {
        expect(talkTopics({ npc: giles, hasRumor: true, hasCase: true, confronting: true }).map(t => t.id)).toEqual(['sabe', 'quiere', 'vosotros']);
    });

    test('las respuestas sugeridas: a quien os planta cara se le contesta, no se le pregunta qué necesita', () => {
        const calm = repliesFor({ name: 'Torres', rumors: 3 }).map(r => r.label);
        expect(calm).toContain('«¿Qué necesitas, Torres?»');
        const hot = repliesFor({ name: 'Torres', rumors: 3, canPry: true, confronting: true,
            extra: [{ id: 'reply-duel', label: 'Convencer a Torres', icon: 'fa-comments' }] }).map(r => r.label);
        expect(hot).toEqual(['«No he sido yo.»', '«¿De qué se me acusa?»', 'Convencer a Torres', 'Calar a Torres (Perspicacia)']);
    });

    test('con modelo, sabe que viene a por vosotros', () => {
        expect(talkPromptNote({ name: 'Torres', trade: 'Alguacil', confronting: true })).toMatch(/os está plantando cara ahora mismo/);
    });

    test('lo que contesta, sin el párrafo de narración de delante', () => {
        const said = 'La posadera se cruza de brazos junto a la puerta.\n\n—No me cuentes milongas —dice Torres.';
        expect(keepSpeech(said)).toBe('—No me cuentes milongas —dice Torres.');
        // Sin diálogo, se deja como está; y si ya empieza hablando, también.
        expect(keepSpeech('Torres escupe al suelo.')).toBe('Torres escupe al suelo.');
        expect(keepSpeech('—Alto ahí.\n\nY se acerca.')).toBe('—Alto ahí.\n\nY se acerca.');
    });
});
