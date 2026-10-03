/**
 * J4.2: la partida es el gremio. Un almacén en el mundo del gremio con lo que es de la partida
 * entera (el gremio, su almacén, el banquillo y la mascota), y cada chat con su copia al día.
 */

import { describe, test, expect } from '@jest/globals';
import {
    HUB_STATE_REV_KEY, readGameState, pickGameKeys, mergeGameKeys, mergeGuilds, planGameSync, pullGameKeys,
} from '../public/scripts/game-engine/campaign/game-state.js';
import { gameScopeKeys, captureKeys, restoreKeys, entryOf } from '../public/scripts/game-engine/campaign/state-registry.js';

/**
 * Una partida de mentira: el mundo del gremio con su almacén y un chat por sitio. `open` hace lo
 * que hace `party/game-state.js` al abrir un chat (o antes de salir de él).
 */
function fakeGame() {
    /** @type {{store: any}} */
    const world = { store: undefined };
    /** @type {Record<string, any>} */
    const chats = {};
    const open = (/** @type {string} */ id, restore = false) => {
        chats[id] = chats[id] ?? {};
        const plan = planGameSync({ store: world.store, chatId: id, meta: chats[id], restore });
        if (plan.pull) pullGameKeys(chats[id], plan.store);
        else chats[id][HUB_STATE_REV_KEY] = plan.store.rev;
        if (plan.storeChanged) world.store = JSON.parse(JSON.stringify(plan.store));
        return plan.action;
    };
    return { world, chats, open };
}

describe('J4.2: qué es de la partida entera', () => {
    test('el gremio, su almacén, el banquillo y la mascota; el grupo y el hilo, de cada chat', () => {
        // E8.3: y los maestros del gremio (los héroes retirados), que son de la partida entera.
        expect(gameScopeKeys().sort()).toEqual(['bench', 'guild', 'guildStorage', 'mentors', 'pet']);
        expect(entryOf('party')?.scope).toBeUndefined();
        expect(entryOf('plotState')?.scope).toBeUndefined();
        // La versión que tiene cada chat vuelve con un punto de retorno (ver la prueba de abajo).
        expect(entryOf(HUB_STATE_REV_KEY)?.kind).toBe('juego');
    });

    test('lo guardado se lee con forma, y lo que no es de la partida no entra', () => {
        expect(readGameState(null)).toBeNull();
        expect(readGameState([1])).toBeNull();
        const read = readGameState({ rev: '3', keys: { guild: { renown: 2 }, plot: { title: 'no' }, pet: null }, folded: ['a', 'a', '', 7] });
        expect(read).toEqual({ version: 1, rev: 3, keys: { guild: { renown: 2 } }, folded: ['a', '7'], by: '', from: 0 });
        // Quién escribió el último y desde qué versión; un `from` por encima de la versión no vale.
        expect(readGameState({ rev: 4, by: 'strahd', from: 9 })).toMatchObject({ by: 'strahd', from: 4 });
        expect(pickGameKeys({ guild: { renown: 1 }, party: [1], bench: [] })).toEqual({ guild: { renown: 1 }, bench: [] });
    });
});

describe('J4.2: abrir un chat de la partida', () => {
    test('sin almacén, se crea con lo del chat abierto', () => {
        const plan = planGameSync({ store: undefined, chatId: 'gremio', meta: { guild: { renown: 2 }, party: [{ id: 1 }] } });
        expect(plan).toEqual({
            action: 'crear', storeChanged: true, pull: false,
            store: { version: 1, rev: 1, keys: { guild: { renown: 2 } }, folded: ['gremio'], by: 'gremio', from: 1 },
        });
    });

    test('un chat por detrás trae lo del almacén: lo que el almacén no tiene, se quita', () => {
        const store = { version: 1, rev: 4, keys: { guild: { renown: 7 } }, folded: ['gremio'] };
        const meta = { [HUB_STATE_REV_KEY]: 2, guild: { renown: 1 }, pet: { name: 'Tizón' }, party: [{ id: 1 }] };
        const plan = planGameSync({ store, chatId: 'gremio', meta });
        expect(plan.action).toBe('traer');
        expect(plan.storeChanged).toBe(false);
        expect(pullGameKeys(meta, plan.store).sort()).toEqual(['guild', 'pet']);
        expect(meta).toEqual({ [HUB_STATE_REV_KEY]: 4, guild: { renown: 7 }, party: [{ id: 1 }] });
        // Una copia: cambiar la del chat no cambia el almacén.
        meta.guild.renown = 9;
        expect(store.keys.guild.renown).toBe(7);
    });

    test('el último que escribió sube lo suyo, con versión nueva; si no cambió nada, nada', () => {
        const store = { version: 1, rev: 4, keys: { guild: { renown: 7 } }, folded: [] };
        const up = planGameSync({ store, chatId: 'strahd', meta: { [HUB_STATE_REV_KEY]: 4, guild: { renown: 9 } } });
        expect(up).toMatchObject({ action: 'subir', storeChanged: true, pull: false, store: { rev: 5, keys: { guild: { renown: 9 } }, by: 'strahd', from: 4 } });
        // Si ya era el último en escribir, sigue su tramo: el `from` no se mueve.
        const again = planGameSync({ store: up.store, chatId: 'strahd', meta: { [HUB_STATE_REV_KEY]: 5, guild: { renown: 10 } } });
        expect(again.store).toMatchObject({ rev: 6, by: 'strahd', from: 4 });
        const same = planGameSync({ store, chatId: 'strahd', meta: { [HUB_STATE_REV_KEY]: 4, guild: { renown: 7 } } });
        expect(same).toMatchObject({ action: 'nada', storeChanged: false, pull: false, store: { rev: 4 } });
        // Un chat que va por delante (el mundo no llegó a guardarse): el almacén se pone a su altura.
        const ahead = planGameSync({ store, chatId: 'strahd', meta: { [HUB_STATE_REV_KEY]: 6, guild: { renown: 7 } } });
        expect(ahead).toMatchObject({ action: 'nada', storeChanged: true, store: { rev: 6 } });
    });
});

describe('J4.2: las partidas de antes, con un gremio por chat', () => {
    test('dos gremios en uno: se suma lo ganado, los edificios al más alto y nadie dos veces', () => {
        const merged = mergeGuilds(
            { name: 'Los Salitre', renown: 5, gold: 20, buildings: { forge: 1, kitchen: 2 }, staff: [{ name: 'Oria', role: 'maestro' }], rankSeen: 'D' },
            { renown: 3, gold: 4, buildings: { forge: 2, stable: 1 }, staff: [{ name: 'oria', role: 'maestro' }, { name: 'Bram', role: 'curandero' }], rankSeen: 'C' },
        );
        expect(merged).toEqual({
            name: 'Los Salitre', theme: 'general', renown: 8, gold: 24, rankSeen: 'C',
            buildings: { forge: 2, kitchen: 2, stable: 1 },
            staff: [{ name: 'Oria', role: 'maestro' }, { name: 'Bram', role: 'curandero' }],
        });
        expect(mergeGuilds(undefined, { renown: 2 })).toEqual({ renown: 2 });
        expect(mergeGuilds({ renown: 2 }, null)).toEqual({ renown: 2 });
    });

    test('el almacén se junta entero; el banquillo, sin repetir a nadie; la mascota, la que ya tenía la partida', () => {
        const keys = mergeGameKeys(
            { guildStorage: [{ id: 'a', name: 'Poción' }], bench: [{ id: 1, name: 'Gerd' }], pet: { name: 'Tizón' } },
            { guildStorage: [{ id: 'a', name: 'Poción' }, { id: 'b', name: 'Farol' }], bench: [{ id: 1, name: 'Gerd' }, { name: 'Nella' }], pet: { name: 'Otra' } },
        );
        // El almacén de cada chat nunca viajó: dos pociones iguales son dos pociones.
        expect(keys.guildStorage.map((/** @type {any} */ i) => i.id)).toEqual(['a', 'a', 'b']);
        expect(keys.bench.map((/** @type {any} */ m) => m.name)).toEqual(['Gerd', 'Nella']);
        expect(keys.pet).toEqual({ name: 'Tizón' });
    });

    test('un chat de antes funde su gremio una vez, y trae el de todos', () => {
        const store = { version: 1, rev: 2, keys: { guild: { renown: 4, buildings: { kitchen: 1 } } }, folded: ['gremio'] };
        const strahd = { guild: { renown: 3 }, party: [{ id: 1 }] };
        const plan = planGameSync({ store, chatId: 'strahd', meta: strahd });
        expect(plan).toMatchObject({ action: 'fundir', storeChanged: true, pull: true, store: { rev: 3, folded: ['gremio', 'strahd'] } });
        pullGameKeys(strahd, plan.store);
        expect(strahd.guild).toMatchObject({ renown: 7, buildings: { kitchen: 1 } });
        // Sin versión otra vez (un punto de retorno de antes se la quitó): no se suma dos veces.
        const again = planGameSync({ store: plan.store, chatId: 'strahd', meta: { guild: { renown: 3 } } });
        expect(again.action).toBe('traer');
        expect(again.store.keys.guild.renown).toBe(7);
    });

    test('un chat recién creado no tiene nada que fundir: el almacén no cambia de versión', () => {
        const store = { version: 1, rev: 5, keys: { guild: { renown: 4 } }, folded: ['gremio'] };
        const plan = planGameSync({ store, chatId: '1387', meta: { party: [] } });
        expect(plan).toMatchObject({ action: 'fundir', pull: true, store: { rev: 5, keys: { guild: { renown: 4 } }, folded: ['gremio', '1387'] } });
    });
});

describe('J4.2: dos campañas en la misma partida, el mismo gremio', () => {
    test('lo que se hace en el gremio y en cada campaña se ve en todas', () => {
        const game = fakeGame();
        // Una partida nueva: el gremio, con su cocina.
        expect(game.open('gremio')).toBe('crear');
        game.chats.gremio.guild = { renown: 0, buildings: { kitchen: 1 } };
        // Al tablón: se sube antes de salir y la campaña lo trae al llegar.
        expect(game.open('gremio')).toBe('subir');
        expect(game.open('1387')).toBe('fundir');
        expect(game.chats['1387'].guild).toEqual({ renown: 0, buildings: { kitchen: 1 } });
        // En 1387, un encargo cumplido y algo en el almacén.
        game.chats['1387'].guild.renown = 2;
        game.chats['1387'].guildStorage = [{ id: 'x', name: 'Farol' }];
        // De vuelta al gremio.
        expect(game.open('1387')).toBe('subir');
        expect(game.open('gremio')).toBe('traer');
        expect(game.chats.gremio.guild.renown).toBe(2);
        expect(game.chats.gremio.guildStorage).toEqual([{ id: 'x', name: 'Farol' }]);
        // A Strahd: el mismo gremio.
        expect(game.open('gremio')).toBe('nada');
        expect(game.open('strahd')).toBe('fundir');
        expect(game.chats.strahd.guild).toEqual(game.chats.gremio.guild);
        expect(game.chats.strahd.guildStorage).toEqual(game.chats.gremio.guildStorage);
        // En Strahd se saca el farol y se gana más renombre; al volver a 1387, se nota allí.
        game.chats.strahd.guild.renown = 5;
        game.chats.strahd.guildStorage = [];
        game.open('strahd');
        game.open('gremio');
        game.open('gremio');
        expect(game.open('1387')).toBe('traer');
        expect(game.chats['1387'].guild).toEqual({ renown: 5, buildings: { kitchen: 1 } });
        expect(game.chats['1387'].guildStorage).toEqual([]);
    });

    test('una partida de antes (un gremio en cada chat) se abre sin perder nada', () => {
        const game = fakeGame();
        game.chats.strahd = { guild: { renown: 3 }, party: [{ id: 1 }] };
        game.chats.gremio = { guild: { renown: 1, gold: 30, buildings: { stable: 1 } }, bench: [{ id: 2, name: 'Nella' }] };
        // Se sigue donde se dejó (Strahd), y luego se vuelve al gremio.
        expect(game.open('strahd')).toBe('crear');
        expect(game.open('strahd')).toBe('nada');
        expect(game.open('gremio')).toBe('fundir');
        expect(game.chats.gremio.guild).toMatchObject({ renown: 4, gold: 30, buildings: { stable: 1 } });
        expect(game.chats.gremio.bench).toEqual([{ id: 2, name: 'Nella' }]);
        game.open('gremio');
        expect(game.open('strahd')).toBe('traer');
        expect(game.chats.strahd.guild).toEqual(game.chats.gremio.guild);
    });
});

describe('J4.2: los puntos de retorno y el gremio compartido', () => {
    test('un punto del mismo tramo devuelve el gremio; uno de antes del último viaje, no', () => {
        const game = fakeGame();
        game.open('gremio');
        game.chats.gremio.guild = { renown: 1 };
        game.open('gremio');
        game.open('1387');
        // Un punto en 1387, con renombre 1. Luego se gana uno más allí mismo.
        const early = captureKeys(game.chats['1387']);
        game.chats['1387'].guild.renown = 2;
        // Volver a él en el mismo tramo: el gremio vuelve, y el almacén se queda con lo devuelto.
        restoreKeys(game.chats['1387'], early);
        expect(game.open('1387')).toBe('nada');
        expect(game.chats['1387'].guild.renown).toBe(1);

        // Otra vez 2, y se va al gremio, que levanta una cocina, y se vuelve a 1387.
        game.chats['1387'].guild.renown = 2;
        game.open('1387');
        game.open('gremio');
        game.chats.gremio.guild.buildings = { kitchen: 1 };
        game.open('gremio');
        game.open('1387');
        // Volver al punto de antes del viaje: el grupo vuelve, pero la cocina del gremio no se deshace.
        restoreKeys(game.chats['1387'], early);
        expect(game.open('1387', true)).toBe('traer');
        expect(game.chats['1387'].guild).toEqual({ renown: 2, buildings: { kitchen: 1 } });
    });

    test('un punto del mismo tramo devuelve el gremio aunque se haya guardado entre medias', () => {
        const game = fakeGame();
        game.open('gremio');
        game.chats.gremio.guild = { renown: 1 };
        game.open('gremio');
        game.open('1387');
        const early = captureKeys(game.chats['1387']);
        // Un encargo cumplido (+2) y se recarga la página: lo de 1387 sube al almacén.
        game.chats['1387'].guild.renown = 3;
        expect(game.open('1387')).toBe('subir');
        game.chats['1387'].guild.renown = 4;
        expect(game.open('1387')).toBe('subir');
        // Se vuelve al punto de antes del encargo: el renombre del encargo deshecho no se queda.
        restoreKeys(game.chats['1387'], early);
        expect(game.open('1387', true)).toBe('devolver');
        expect(game.chats['1387'].guild.renown).toBe(1);
        expect(game.world.store.keys.guild.renown).toBe(1);
        // Y el gremio lo ve así al volver.
        expect(game.open('gremio')).toBe('traer');
        expect(game.chats.gremio.guild.renown).toBe(1);
    });

    test('si otro chat escribió después del punto, lo suyo no se deshace', () => {
        const game = fakeGame();
        game.open('gremio');
        game.open('strahd');
        const early = captureKeys(game.chats.strahd);
        game.chats.strahd.guild = { renown: 2 };
        game.open('strahd');
        // Al gremio, que levanta una cocina, y de vuelta a Strahd, que gana otro poco.
        game.open('gremio');
        game.chats.gremio.guild = { ...game.chats.gremio.guild, buildings: { kitchen: 1 } };
        game.open('gremio');
        game.open('strahd');
        game.chats.strahd.guild.renown = 3;
        game.open('strahd');
        // El punto es de antes del viaje: la cocina del gremio se queda (y con ella lo de Strahd de después).
        restoreKeys(game.chats.strahd, early);
        expect(game.open('strahd', true)).toBe('traer');
        expect(game.chats.strahd.guild).toEqual({ renown: 3, buildings: { kitchen: 1 } });
    });

    test('un chat que se quedó atrás sin volver a ningún punto trae lo suyo, no lo deshace', () => {
        // El chat no llegó a guardarse pero el mundo sí: al abrirlo, trae lo último, aunque lo escribiera él.
        const store = { version: 1, rev: 6, keys: { guild: { renown: 5 } }, folded: [], by: 'strahd', from: 3 };
        const plan = planGameSync({ store, chatId: 'strahd', meta: { [HUB_STATE_REV_KEY]: 5, guild: { renown: 4 } } });
        expect(plan.action).toBe('traer');
    });
});
