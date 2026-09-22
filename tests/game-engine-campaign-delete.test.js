import { describe, test, expect } from '@jest/globals';
import {
    planCampaignDeletion, describeDeletion,
} from '../public/scripts/game-engine/campaign/campaign-delete.js';

/** Una campaña jugada, como la devuelve la lista de partidas. */
const played = () => ({
    name: 'El Molino',
    displayName: 'El Molino de los Cuervos',
    chats: [
        { avatar: 'dm.png', file_name: 'Molino - 2026-09-20.jsonl' },
        { avatar: 'dm.png', file_name: 'Molino - 2026-09-21.jsonl' },
    ],
});

describe('qué se va con una campaña', () => {
    test('el mundo y todas sus sesiones, no una de las dos mitades', () => {
        const plan = planCampaignDeletion(played());
        expect(plan.worldName).toBe('El Molino');
        expect(plan.chats).toEqual([
            { avatar: 'dm.png', file: 'Molino - 2026-09-20' },
            { avatar: 'dm.png', file: 'Molino - 2026-09-21' },
        ]);
    });

    test('el .jsonl se quita: el borrado lo pide sin extensión', () => {
        expect(planCampaignDeletion(played()).chats.every(c => !c.file.includes('.jsonl'))).toBe(true);
    });

    test('una campaña sin jugar se borra igual, y lo dice sin asustar', () => {
        const plan = planCampaignDeletion({ name: 'Vado', chats: [] });
        expect(plan.chats).toEqual([]);
        expect(plan.lines[0]).toMatch(/ninguna sesión/);
        expect(plan.displayName).toBe('Vado');
    });

    test('siempre avisa de que no hay vuelta atrás', () => {
        for (const campaign of [played(), { name: 'Vado', chats: [] }]) {
            expect(planCampaignDeletion(campaign).lines.join(' ')).toMatch(/no se puede deshacer/);
        }
    });

    test('dice cuántas sesiones se pierden, que es lo que duele', () => {
        expect(planCampaignDeletion(played()).lines.join(' ')).toMatch(/2 sesión\(es\)/);
    });

    test('y pregunta por el nombre que el jugador conoce, no por el del archivo', () => {
        expect(planCampaignDeletion(played()).title).toBe('¿Borrar "El Molino de los Cuervos"?');
    });
});

describe('la campaña que tienes abierta', () => {
    test('se avisa de que va a cerrarse antes', () => {
        const plan = planCampaignDeletion(played(), { openWorldName: 'El Molino' });
        expect(plan.closesOpenCampaign).toBe(true);
        expect(plan.lines.join(' ')).toMatch(/se cerrará antes/);
    });

    test('y otra distinta no cierra nada', () => {
        const plan = planCampaignDeletion(played(), { openWorldName: 'Otro mundo' });
        expect(plan.closesOpenCampaign).toBe(false);
        expect(plan.lines.join(' ')).not.toMatch(/se cerrará/);
    });

    test('sin partida abierta tampoco', () => {
        expect(planCampaignDeletion(played(), { openWorldName: '' }).closesOpenCampaign).toBe(false);
    });
});

describe('lo que no se va a poder borrar', () => {
    test('una sesión de un personaje que ya no existe se queda, y se dice', () => {
        const campaign = played();
        campaign.chats.push({ avatar: 'borrado.png', file_name: 'Molino - viejo.jsonl' });

        const plan = planCampaignDeletion(campaign, { knownAvatars: ['dm.png'] });
        expect(plan.chats).toHaveLength(2);
        expect(plan.orphans).toEqual(['Molino - viejo']);
        expect(plan.lines.join(' ')).toMatch(/se quedarán en el disco/);
    });

    test('pero se cuenta entre lo que se pierde: el aviso no miente por omisión', () => {
        const campaign = played();
        campaign.chats.push({ avatar: 'borrado.png', file_name: 'Molino - viejo.jsonl' });
        expect(planCampaignDeletion(campaign, { knownAvatars: ['dm.png'] }).lines.join(' '))
            .toMatch(/3 sesión\(es\)/);
    });

    test('sin saber qué personajes hay, no se presume que falte ninguno', () => {
        const plan = planCampaignDeletion(played());
        expect(plan.orphans).toEqual([]);
    });

    test('una sesión sin personaje ninguno es huérfana, se pregunte como se pregunte', () => {
        const plan = planCampaignDeletion({ name: 'X', chats: [{ avatar: '', file_name: 'suelta.jsonl' }] });
        expect(plan.orphans).toEqual(['suelta']);
        expect(plan.chats).toEqual([]);
    });
});

describe('lo que se cuenta después', () => {
    test('lo hecho, no lo intentado', () => {
        expect(describeDeletion({ world: true, chats: 2, failed: 0 }))
            .toBe('Mundo borrado · 2 sesión(es) borradas');
    });

    test('un borrado a medias se puede decir, porque es lo que el disco tiene', () => {
        expect(describeDeletion({ world: false, chats: 1, failed: 1 }))
            .toBe('El mundo no se pudo borrar · 1 sesión(es) borradas · 1 sin borrar');
    });
});
