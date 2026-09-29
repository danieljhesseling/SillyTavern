import { describe, test, expect } from '@jest/globals';
import {
    planCampaignDeletion, planGuildDeletion, describeDeletion,
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

    test('D-J23: un gremio son varios mundos, y se cuentan', () => {
        expect(describeDeletion({ worlds: 3, worldsFailed: 0, chats: 8, failed: 0 }))
            .toBe('3 mundos borrados · 8 sesión(es) borradas');
        expect(describeDeletion({ worlds: 1, worldsFailed: 1, chats: 2, failed: 1 }))
            .toBe('1 mundo borrado · 1 mundo no se pudo borrar · 2 sesión(es) borradas · 1 sin borrar');
    });

    test('y si ya no quedaba nada, se dice en vez de un aviso vacío', () => {
        expect(describeDeletion({ worlds: 0, worldsFailed: 0, chats: 0, failed: 0 }))
            .toBe('No quedaba nada que borrar');
    });
});

/** Un gremio con dos campañas del tablón, como lo junta deleteGuild. */
const guild = () => ({
    name: 'El Gremio',
    displayName: 'El Gremio',
    chats: [
        { avatar: 'posadero.png', file_name: 'Gremio - 1.jsonl' },
        { avatar: 'posadero.png', file_name: 'Gremio - 2.jsonl' },
        { avatar: 'posadero.png', file_name: 'Gremio - 3.jsonl' },
    ],
});
const guildCampaigns = () => [
    {
        name: 'La Maldición de Strahd · Tessa',
        chats: [
            { avatar: 'strahd.png', file_name: 'Strahd - 1.jsonl' },
            { avatar: 'strahd.png', file_name: 'Strahd - 2.jsonl' },
            { avatar: 'strahd.png', file_name: 'Strahd - 3.jsonl' },
            { avatar: 'strahd.png', file_name: 'Strahd - 4.jsonl' },
        ],
    },
    { name: '1387 · Tessa', displayName: '1387 · Tessa', chats: [{ avatar: 'keller.png', file_name: '1387 - 1.jsonl' }] },
];

describe('D-J23: qué se va con un gremio', () => {
    test('el mundo del gremio primero, luego el de cada campaña, y las sesiones de todos', () => {
        const plan = planGuildDeletion(guild(), guildCampaigns());
        expect(plan.worlds).toEqual(['El Gremio', 'La Maldición de Strahd · Tessa', '1387 · Tessa']);
        expect(plan.chats).toHaveLength(8);
        expect(plan.chats).toContainEqual({ avatar: 'keller.png', file: '1387 - 1' });
        expect(plan.sessions).toBe(8);
        expect(plan.orphans).toEqual([]);
    });

    test('cada campaña, con el nombre de «Cargar partida» y sus sesiones', () => {
        expect(planGuildDeletion(guild(), guildCampaigns()).campaigns).toEqual([
            { worldName: 'La Maldición de Strahd · Tessa', displayName: 'La Maldición de Strahd', sessions: 4 },
            { worldName: '1387 · Tessa', displayName: '1387', sessions: 1 },
        ]);
    });

    test('el aviso lo nombra todo, parte por parte', () => {
        const plan = planGuildDeletion(guild(), guildCampaigns());
        expect(plan.title).toBe('¿Borrar el gremio "El Gremio"?');
        expect(plan.lines).toEqual([
            'Se borra el gremio entero, con todo lo que tiene:',
            '• **El gremio**: su pueblo, su gente, su tablón y 3 sesiones.',
            '• **Tus héroes**: los del grupo y los que esperan en el gremio.',
            '• La campaña **La Maldición de Strahd**: su mundo y 4 sesiones.',
            '• La campaña **1387**: su mundo y 1 sesión.',
            'En total, **8 sesiones jugadas**.',
            'El salón de la fama se queda: no es de ninguna partida.',
            'Esto no se puede deshacer.',
        ]);
    });

    test('un gremio sin campañas no habla de ellas ni de totales', () => {
        const lines = planGuildDeletion(guild(), []).lines.join(' ');
        expect(lines).not.toMatch(/La campaña/);
        expect(lines).not.toMatch(/En total/);
        expect(lines).toMatch(/no se puede deshacer/);
    });

    test('una campaña sin jugar se nombra igual: su mundo también se va', () => {
        const plan = planGuildDeletion(guild(), [{ name: 'Vado · Tessa', chats: [] }]);
        expect(plan.worlds).toContain('Vado · Tessa');
        expect(plan.lines).toContain('• La campaña **Vado**: su mundo, sin sesiones jugadas.');
    });

    test('un mundo repetido, o el gremio entre sus campañas, se cuenta una vez', () => {
        const campaigns = [...guildCampaigns(), guildCampaigns()[1], guild()];
        const plan = planGuildDeletion(guild(), campaigns);
        expect(plan.worlds).toEqual(['El Gremio', 'La Maldición de Strahd · Tessa', '1387 · Tessa']);
        expect(plan.sessions).toBe(8);
    });
});

describe('D-J23: la partida abierta, si es del gremio', () => {
    test('el gremio abierto se cierra antes', () => {
        const plan = planGuildDeletion(guild(), guildCampaigns(), { openWorldName: 'El Gremio' });
        expect(plan.closesOpenCampaign).toBe(true);
        expect(plan.lines.join(' ')).toMatch(/se cerrará antes/);
    });

    test('y una de sus campañas abierta, también', () => {
        const plan = planGuildDeletion(guild(), guildCampaigns(), { openWorldName: '1387 · Tessa' });
        expect(plan.closesOpenCampaign).toBe(true);
    });

    test('otra partida abierta no se cierra', () => {
        const plan = planGuildDeletion(guild(), guildCampaigns(), { openWorldName: 'Mazmorra clásica' });
        expect(plan.closesOpenCampaign).toBe(false);
        expect(plan.lines.join(' ')).not.toMatch(/se cerrará/);
        expect(planGuildDeletion(guild(), guildCampaigns(), { openWorldName: '' }).closesOpenCampaign).toBe(false);
    });
});

describe('D-J23: lo que se queda de un gremio', () => {
    test('las sesiones de un personaje que ya no existe se quedan, y se dice', () => {
        const campaigns = guildCampaigns();
        campaigns[1].chats.push({ avatar: 'borrado.png', file_name: '1387 - viejo.jsonl' });
        const plan = planGuildDeletion(guild(), campaigns, {
            knownAvatars: ['posadero.png', 'strahd.png', 'keller.png'],
        });
        expect(plan.orphans).toEqual(['1387 - viejo']);
        expect(plan.chats).toHaveLength(8);
        // Se cuentan entre lo que se pierde: el aviso no miente por omisión.
        expect(plan.campaigns[1].sessions).toBe(2);
        expect(plan.lines.join(' ')).toMatch(/9 sesiones jugadas/);
        expect(plan.lines.join(' ')).toMatch(/1 sesión se quedará en el disco/);
    });

    test('el salón de la fama se queda siempre, y se dice', () => {
        expect(planGuildDeletion(guild(), []).lines.join(' ')).toMatch(/salón de la fama se queda/);
    });
});
