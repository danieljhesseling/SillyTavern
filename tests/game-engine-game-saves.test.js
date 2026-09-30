import { describe, test, expect } from '@jest/globals';
import {
    readSlots, slotCards, slotFileName, autosaveNeeded, todayPoints, olderPoints, dayTurned, withGameSlots, slotsOfGame,
    overwriteQuestion, loadQuestion, slotEntry, savedNotice, withSlot, withoutSlot, slotFiles, describeSize, SLOT_ORDER,
    SLOT_SLEEP, SLOT_AUTO,
} from '../public/scripts/game-engine/campaign/save-slots.js';
import {
    gameIdOf, gameMembers, buildArchive, readArchive, planImport, planRestore, withAvatars, archiveSummary, archiveFileName,
    renameInChat, ARCHIVE_FORMAT, ARCHIVE_VERSION,
} from '../public/scripts/game-engine/campaign/game-archive.js';
import {
    saveToSlot, loadSlot, saveOnSleep, autosave, exportGame, importGame, forgetSlots, collectArchive, openGameId,
} from '../public/scripts/game-engine/campaign/game-saves.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Que salió bien, y para los tipos lo que trae dentro.
 *
 * @template T
 * @param {T} result
 * @returns {asserts result is Extract<T, {ok: true}>}
 */
function assertOk(result) {
    expect(/** @type {any} */ (result)?.ok).toBe(true);
    if (!(/** @type {any} */ (result)?.ok)) throw new Error(JSON.stringify(result));
}

const NOW = Date.parse('2026-09-30T18:00:00Z');

/** @param {number} day @param {any} [extra] */
const guildMeta = (day, extra = {}) => ({
    world_info: 'El Gremio',
    calendar: { day, slotIndex: 0 },
    currentLocation: 'Puerto Alba',
    party: [{ id: 1, name: 'Tessa', class: 'Guerrera', level: 2 }, { id: 2, name: 'Gerd', guest: { kind: 'mercenary' } }],
    ...extra,
});

/** @param {string} world @param {any} meta @param {string[]} [said] */
const chatLines = (world, meta, said = ['Hola']) => [
    { user_name: 'Tú', character_name: 'Posadero', create_date: '2026-09-29', chat_metadata: { world_info: world, integrity: 'abc', ...meta } },
    ...said.map(mes => ({ name: 'Posadero', mes })),
];

/** Un disco de mentira con un gremio y una campaña de su tablón, y el chat del gremio abierto. */
function fakeHost({ withCampaign = true } = {}) {
    /** @type {Record<string, any>} */
    const worlds = {
        'El Gremio': {
            entries: { 0: { uid: 0, comment: 'Tessa' } },
            metadata: {
                displayName: 'El Gremio', narratorAvatar: 'Posadero.png',
                hub: {
                    chat: { file: 'Posadero - gremio', avatar: 'Posadero.png' },
                    campaigns: withCampaign ? { strahd: { worldName: 'La Maldición de Strahd · Tessa', chat: { file: 'Narrador - strahd', avatar: 'Narrador.png' }, finished: false, ending: '' } } : {},
                },
            },
        },
        'Otro mundo': { entries: {}, metadata: { displayName: 'Otro mundo' } },
    };
    /** @type {Record<string, any[]>} */
    const chats = {
        'Posadero.png/Posadero - gremio': chatLines('El Gremio', guildMeta(3, {
            checkpoints: [{ version: 2, id: 'cp_a', label: 'Antes de la bodega', savedAt: '2026-09-30T17:00:00Z', automatic: false, state: { calendar: { day: 3 } }, worldFile: 'user/files/punto-cp_a.json' }],
        })),
        'Posadero.png/Posadero - otro': chatLines('Otro mundo', { calendar: { day: 9 } }),
    };
    if (withCampaign) {
        worlds['La Maldición de Strahd · Tessa'] = { entries: {}, metadata: { displayName: 'La Maldición de Strahd · Tessa', hubHome: 'El Gremio', hubCampaign: 'strahd' } };
        chats['Narrador.png/Narrador - strahd'] = chatLines('La Maldición de Strahd · Tessa', { calendar: { day: 2 }, currentLocation: 'Barovia', party: [{ id: 1, name: 'Tessa', class: 'Guerrera', level: 2 }] });
    }
    /** @type {Record<string, string>} */
    const files = { 'user/files/punto-cp_a.json': '{"metadata":{},"people":{}}' };
    const avatars = new Set(['Posadero.png', 'Narrador.png']);
    /** @type {Record<string, any>} */
    const settings = {};
    let hall = [{ name: 'Strahd', world: 'La Maldición de Strahd · Tessa', kind: 'campaign', ending: 'Libre', day: 30 }, { name: 'Otro', world: 'Otro mundo', day: 2 }];
    let imported = [];
    /** @type {{avatar: string, file: string}|null} */
    let open = { avatar: 'Posadero.png', file: 'Posadero - gremio' };
    let now = NOW;
    const log = { flushed: 0, closed: 0, opened: /** @type {any[]} */ ([]), created: /** @type {any[]} */ ([]) };
    const clone = (/** @type {any} */ v) => structuredClone(v);

    /** @type {import('../public/scripts/game-engine/campaign/game-saves.js').GameSavesAdapter} */
    const adapter = {
        openWorld: () => (open ? chats[`${open.avatar}/${open.file}`]?.[0]?.chat_metadata?.world_info ?? '' : ''),
        openChat: () => (open ? { ...open } : null),
        flush: async () => { log.flushed++; },
        listChats: async () => Object.entries(chats).map(([key, lines]) => ({
            avatar: key.split('/')[0], file_name: `${key.split('/').slice(1).join('/')}.jsonl`, chat_metadata: clone(lines[0].chat_metadata),
        })),
        listWorlds: () => Object.keys(worlds),
        readWorld: async (name) => (worlds[name] ? clone(worlds[name]) : null),
        writeWorld: async (name, data) => { worlds[name] = clone(data); },
        deleteWorld: async (name) => { const had = name in worlds; delete worlds[name]; return had; },
        readChat: async (avatar, file) => clone(chats[`${avatar}/${file}`] ?? []),
        writeChat: async (avatar, file, lines) => {
            if (!avatars.has(avatar)) throw new Error('sin ficha');
            chats[`${avatar}/${file}`] = clone(lines);
        },
        deleteChat: async (avatar, file) => { const key = `${avatar}/${file}`; const had = key in chats; delete chats[key]; return had; },
        avatars: () => [...avatars],
        readNarrator: async (avatar, withImage) => (avatars.has(avatar) ? { avatar, name: avatar.replace('.png', ''), card: { ch_name: avatar.replace('.png', '') }, ...(withImage ? { image: 'iVBOR' } : {}) } : null),
        createNarrator: async (narrator) => { log.created.push(narrator); avatars.add(narrator.avatar); return narrator.avatar; },
        readText: async (url) => files[url] ?? null,
        writeText: async (name, content) => { files[`user/files/${name}`] = content; return `user/files/${name}`; },
        deleteFile: async (url) => { delete files[url]; },
        fileUrl: (name) => `user/files/${name}`,
        filesExist: async (urls) => Object.fromEntries(urls.map(u => [u, u in files])),
        readImported: async () => clone(imported),
        writeImported: async (rows) => { imported = clone(rows); },
        readHall: () => clone(hall),
        writeHall: (entries) => { hall = clone(entries); },
        getSlots: (gameId) => slotsOfGame(settings.gameSlots, gameId),
        setSlots: (gameId, slots) => { settings.gameSlots = withGameSlots(settings.gameSlots, gameId, slots); },
        closeChat: async () => { log.closed++; open = null; return true; },
        openChatFile: async (chat) => {
            if (!chats[`${chat.avatar}/${chat.file}`]) return false;
            open = { ...chat };
            log.opened.push({ ...chat });
            return true;
        },
        now: () => now,
    };
    return {
        adapter, worlds, chats, files, avatars, settings, log,
        get hall() { return hall; },
        get imported() { return imported; },
        set imported(rows) { imported = rows; },
        tick: (/** @type {number} */ ms) => { now += ms; },
        openAt: (/** @type {any} */ chat) => { open = chat; },
        guildDay: () => chats['Posadero.png/Posadero - gremio'][0].chat_metadata.calendar.day,
    };
}

describe('las ranuras (J15.2)', () => {
    const entry = slotEntry({ id: '2', file: 'user/files/x.json', meta: guildMeta(4), savedAt: new Date(NOW - 5 * 60000).toISOString(), bytes: 2048 });

    test('la tarjeta sale de lo que dice el chat: día, sitio y quién va', () => {
        expect(entry).toMatchObject({ id: '2', day: 4, place: 'Puerto Alba', hero: 'Tessa (Guerrera, nivel 2), con Gerd', bytes: 2048 });
        expect(savedNotice(entry)).toEqual({ title: 'Guardada en la ranura 2', line: 'Día 4 · Puerto Alba' });
        expect(describeSize(2048)).toBe('2 KB');
        expect(describeSize(3.5 * 1024 * 1024)).toBe('3,5 MB');
    });

    test('las cinco, en su orden y también las vacías; las que se llenan solas no se guardan a mano', () => {
        const cards = slotCards(withSlot({}, entry), { now: NOW });
        expect(cards.map(c => c.id)).toEqual([...SLOT_ORDER]);
        const [sleep, auto, one, two] = cards;
        expect(sleep).toMatchObject({ label: 'Al dormir en el gremio', icon: 'fa-bed', empty: true, canSave: false, canLoad: false, line: 'Todavía no se ha guardado.' });
        expect(auto).toMatchObject({ label: 'Al empezar el día', canSave: false });
        expect(one).toMatchObject({ label: 'Ranura 1', empty: true, canSave: true, canLoad: false, line: 'Vacía.' });
        expect(two).toMatchObject({ empty: false, canLoad: true, line: 'Día 4 · Puerto Alba', when: 'Guardada hace 5 minutos' });
    });

    test('en combate (o fuera del refugio) no se guarda, y dice por qué; desde el título solo se carga', () => {
        const blocked = slotCards({}, { saving: { allowed: false, reason: 'En mitad de un combate no se guarda.' } });
        expect(blocked[2]).toMatchObject({ canSave: false, saveWhy: 'En mitad de un combate no se guarda.' });
        const title = slotCards(withSlot({}, entry), { inGame: false });
        expect(title.every(c => !c.canSave)).toBe(true);
        expect(title[3].canLoad).toBe(true);
    });

    test('lo roto se cae; una ranura que no existe no entra', () => {
        expect(readSlots({ 1: { file: '' }, 7: { file: 'a' }, auto: { file: 'b', day: 'x' } })).toEqual({
            auto: expect.objectContaining({ id: 'auto', file: 'b', day: 1 }),
        });
        expect(withoutSlot(withSlot({}, entry), '2')).toEqual({});
        expect(slotFiles({ 1: { file: 'a' }, 2: { file: 'a' }, 3: { file: 'b' } })).toEqual(['a', 'b']);
    });

    test('las ranuras de cada partida, en los ajustes: una partida sin ranuras sale de la lista', () => {
        let all = withGameSlots({}, 'El Gremio', withSlot({}, entry));
        all = withGameSlots(all, 'Otro', withSlot({}, { ...entry, id: '1' }));
        expect(Object.keys(all)).toEqual(['El Gremio', 'Otro']);
        expect(slotsOfGame(all, 'El Gremio')['2'].day).toBe(4);
        expect(Object.keys(withGameSlots(all, 'Otro', {}))).toEqual(['El Gremio']);
    });

    test('el nombre del archivo solo lleva lo que acepta el servidor, y dos nombres casi iguales no chocan', () => {
        const a = slotFileName('La Maldición de Strahd · Tessa', '1');
        expect(a).toMatch(/^[a-zA-Z0-9_\-.]+$/);
        expect(a).toMatch(/^partida-la-maldicion-de-strahd-tessa-[a-z0-9]+-ranura-1\.json$/);
        expect(slotFileName('El Gremio', '1')).not.toBe(slotFileName('El gremio', '1'));
        expect(slotFileName('El Gremio', 'auto')).not.toBe(slotFileName('El Gremio', 'dormir'));
    });

    test('el automático: al cambiar el día, y no si ya está o si acabáis de dormir en el gremio', () => {
        expect(dayTurned({ day: 3 }, { day: 4 })).toBe(true);
        expect(dayTurned({ day: 3 }, { day: 3 })).toBe(false);
        expect(dayTurned(null, { day: 4 })).toBe(false);
        const slept = withSlot({}, { ...entry, id: SLOT_SLEEP, day: 5, savedAt: new Date(NOW - 60000).toISOString() });
        expect(autosaveNeeded(slept, { day: 5, now: NOW })).toBe(false);
        expect(autosaveNeeded(slept, { day: 6, now: NOW })).toBe(true);
        expect(autosaveNeeded(slept, { day: 5, now: NOW + DAY_MS })).toBe(true);
        const auto = withSlot({}, { ...entry, id: SLOT_AUTO, day: 5, savedAt: new Date(NOW).toISOString() });
        expect(autosaveNeeded(auto, { day: 5, now: NOW + 1000 })).toBe(false);
    });

    test('los puntos de hoy, por debajo: los de este día de la partida, el último primero', () => {
        const points = [
            { id: 'b', label: 'Antes de El Guardián', savedAt: '2026-09-30T18:03:00Z', automatic: true, state: { calendar: { day: 4 } } },
            { id: 'a', label: 'A mano', savedAt: '2026-09-30T17:00:00Z', automatic: false, state: { calendar: { day: 4 } } },
            { id: 'z', label: 'De ayer', savedAt: '2026-09-29T10:00:00Z', automatic: false, state: { calendar: { day: 3 } } },
        ];
        expect(todayPoints(points, 4)).toEqual([
            { id: 'b', label: 'Antes de El Guardián', time: '18:03', automatic: true },
            { id: 'a', label: 'A mano', time: '17:00', automatic: false },
        ]);
        expect(olderPoints(points, 4)).toBe(1);
    });

    test('lo que se pregunta antes de pisar una ranura y antes de cargar, en llano', () => {
        expect(overwriteQuestion(null)).toBe('');
        expect(overwriteQuestion(entry)).toBe('La ranura 2 ya tiene una partida: Día 4 · Puerto Alba. Se cambia por la de ahora. ¿Seguro?');
        expect(loadQuestion(entry, { now: NOW })).toBe('Vuelves al día 4, en Puerto Alba, guardado hace 5 minutos. Lo que hayas jugado desde entonces y no hayas guardado se pierde. ¿Cargar?');
        expect(loadQuestion({ ...entry, where: 'Strahd' }, { now: NOW, inGame: false })).toBe('Vuelves al día 4, en Puerto Alba (Strahd), guardado hace 5 minutos. ¿Cargar?');
    });
});

describe('la partida en un archivo (J15.6)', () => {
    test('de quién es cada mundo: el gremio, sus campañas y las sueltas', () => {
        expect(gameIdOf('El Gremio', { hub: {} })).toBe('El Gremio');
        expect(gameIdOf('Strahd · Tessa', { hubHome: 'El Gremio' })).toBe('El Gremio');
        expect(gameIdOf('Suelta', {})).toBe('Suelta');
    });

    test('los mundos y chats de una partida: los suyos y ninguno más', () => {
        const members = gameMembers({
            gameId: 'El Gremio',
            worlds: {
                'El Gremio': { hub: { campaigns: { a: { worldName: 'A · Tessa' }, b: { worldName: 'Borrada' } } } },
                'A · Tessa': { hubHome: 'El Gremio' },
                'B · Tessa': { hubHome: 'El Gremio' },
                'Ajena': { hubHome: 'Otro Gremio' },
            },
            chats: [
                { avatar: 'N.png', file_name: 'a.jsonl', chat_metadata: { world_info: 'A · Tessa' } },
                { avatar: 'P.png', file_name: 'g.jsonl', chat_metadata: { world_info: 'El Gremio' } },
                { avatar: 'P.png', file_name: 'x.jsonl', chat_metadata: { world_info: 'Ajena' } },
            ],
        });
        expect(members.worlds).toEqual(['El Gremio', 'A · Tessa', 'B · Tessa']);
        expect(members.chats).toEqual([{ avatar: 'N.png', file: 'a', world: 'A · Tessa' }, { avatar: 'P.png', file: 'g', world: 'El Gremio' }]);
    });

    test('se exporta y se vuelve a leer igual', () => {
        const archive = buildArchive({
            game: { id: 'El Gremio' },
            where: { world: 'El Gremio', avatar: 'P.png', file: 'g.jsonl' },
            worlds: [{ name: 'El Gremio', data: { entries: {}, metadata: { displayName: 'Mi Gremio', hub: {} } } }],
            chats: [{ avatar: 'P.png', file: 'g', world: 'El Gremio', lines: chatLines('El Gremio', guildMeta(7)) }],
            now: () => '2026-09-30T10:00:00.000Z',
        });
        expect(archive).toMatchObject({ format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, game: { id: 'El Gremio', title: 'Mi Gremio', kind: 'gremio' }, where: { file: 'g' } });
        const read = readArchive(JSON.stringify(archive));
        expect(read.problems).toEqual([]);
        expect(read.archive).toEqual(archive);
        expect(archiveSummary(archive)).toMatchObject({ title: 'Mi Gremio', line: 'Día 7 · Puerto Alba', hero: 'Tessa (Guerrera, nivel 2), con Gerd', sessions: 1, campaigns: [] });
        expect(archiveFileName('La Maldición de Strahd', new Date(2026, 8, 30))).toBe('partida-la-maldicion-de-strahd-2026-09-30.partida.json');
    });

    test('lo que no es una partida se dice en español, sin tecnicismos', () => {
        expect(readArchive('esto no').problems[0]).toMatch(/no se puede leer/);
        expect(readArchive({ format: 'otra cosa' }).problems[0]).toMatch(/no es una partida del juego/);
        expect(readArchive({ format: ARCHIVE_FORMAT, version: 99, game: { id: 'G' }, worlds: [{ name: 'G', data: { entries: {} } }] }).problems)
            .toContain('La partida es de una versión más nueva del juego. Pon el juego al día y vuelve a probar.');
        const broken = readArchive({
            format: ARCHIVE_FORMAT, version: 1, game: { id: 'G' },
            worlds: [{ name: 'H', data: {} }],
            chats: [{ avatar: 'a', file: 'b', lines: [{}] }],
        });
        expect(broken.archive).toBeNull();
        expect(broken.problems).toEqual([
            'El mundo «H» está roto: le faltan sus fichas.',
            'Falta el mundo de la partida, «G».',
            'El chat «b» está roto: le falta su cabecera.',
        ]);
    });

    test('importar al lado de la misma: todo se renombra y lo que se nombraba, también', () => {
        const host = fakeHost();
        return collectArchive(host.adapter, { gameId: 'El Gremio' }).then(archive => {
            const plan = planImport(archive, {
                worldNames: Object.keys(host.worlds),
                chatFiles: { 'Posadero.png': ['Posadero - gremio', 'Posadero - otro'], 'Narrador.png': ['Narrador - strahd'] },
                avatars: ['Posadero.png', 'Narrador.png'],
                fileNames: ['punto-cp_a.json'],
                stamp: 'k1',
            });
            expect(plan.gameId).toBe('El Gremio (2)');
            expect(plan.title).toBe('El Gremio (copia)');
            expect(plan.renamed).toEqual({ 'El Gremio': 'El Gremio (2)', 'La Maldición de Strahd · Tessa': 'La Maldición de Strahd · Tessa (2)' });
            const guild = plan.worlds.find(w => w.name === 'El Gremio (2)')?.data.metadata;
            expect(guild.hub.chat).toEqual({ file: 'Posadero - gremio (importada)', avatar: 'Posadero.png' });
            expect(guild.hub.campaigns.strahd).toMatchObject({ worldName: 'La Maldición de Strahd · Tessa (2)', chat: { file: 'Narrador - strahd (importada)' } });
            const campaign = plan.worlds.find(w => w.name === 'La Maldición de Strahd · Tessa (2)')?.data.metadata;
            expect(campaign.hubHome).toBe('El Gremio (2)');
            const guildChat = plan.chats.find(c => c.file === 'Posadero - gremio (importada)');
            expect(guildChat?.lines[0].chat_metadata.world_info).toBe('El Gremio (2)');
            expect(guildChat?.lines[0].chat_metadata.integrity).toBeUndefined();
            expect(guildChat?.lines[0].chat_metadata.checkpoints[0].worldFile).toBe('user/files/punto-cp_a-k1.json');
            expect(plan.files.map(f => f.name)).toEqual(['punto-cp_a-k1.json']);
            expect(plan.narrators.every(n => !n.create)).toBe(true);
            expect(plan.where).toEqual({ world: 'El Gremio (2)', avatar: 'Posadero.png', file: 'Posadero - gremio (importada)' });
        });
    });

    test('si al crear un narrador el servidor le da otro nombre, los chats y el gremio lo siguen', () => {
        const plan = planImport(buildArchive({
            game: { id: 'G' }, where: { world: 'G', avatar: 'P.png', file: 'g' },
            worlds: [{ name: 'G', data: { entries: {}, metadata: { narratorAvatar: 'P.png', hub: { chat: { file: 'g', avatar: 'P.png' }, campaigns: {} } } } }],
            chats: [{ avatar: 'P.png', file: 'g', world: 'G', lines: chatLines('G', {}) }],
            narrators: [{ avatar: 'P.png', name: 'P', card: {} }],
        }), { worldNames: [] });
        expect(plan.narrators[0].create).toBe(true);
        withAvatars(plan, { 'P.png': 'P1.png' });
        expect(plan.chats[0].avatar).toBe('P1.png');
        expect(plan.worlds[0].data.metadata).toMatchObject({ narratorAvatar: 'P1.png', hub: { chat: { avatar: 'P1.png', file: 'g' } } });
        expect(plan.where.avatar).toBe('P1.png');
    });

    test('cargar encima: lo empezado después de guardar se quita', () => {
        const archive = buildArchive({
            game: { id: 'G' }, where: { world: 'G', avatar: 'P.png', file: 'g' },
            worlds: [{ name: 'G', data: { entries: {}, metadata: {} } }],
            chats: [{ avatar: 'P.png', file: 'g', world: 'G', lines: chatLines('G', {}) }],
            files: [{ name: 'punto-x.json', kind: 'punto', text: '{}' }],
        });
        const plan = planRestore(archive, {
            worlds: ['G', 'Nueva · Tessa'],
            chats: [{ avatar: 'P.png', file: 'g' }, { avatar: 'N.png', file: 'nueva.jsonl' }],
            fileNames: ['punto-x.json'],
        });
        expect(plan.dropWorlds).toEqual(['Nueva · Tessa']);
        expect(plan.dropChats).toEqual([{ avatar: 'N.png', file: 'nueva' }]);
        expect(plan.files).toEqual([]);
        expect(plan.worlds.map(w => w.name)).toEqual(['G']);
    });

    test('un punto cuyo mundo guardado no viaja pierde solo esa parte', () => {
        const lines = chatLines('G', { checkpoints: [{ id: 'a', state: {}, worldFile: 'user/files/no-esta.json' }] });
        renameInChat(lines, { files: {} });
        expect(lines[0].chat_metadata.checkpoints[0]).toEqual({ id: 'a', state: {} });
    });
});

describe('guardar, cerrar, cargar otra ranura y volver (J15.2)', () => {
    test('dos ranuras, y cada una devuelve su día', async () => {
        const host = fakeHost();
        expect(await openGameId(host.adapter)).toBe('El Gremio');
        const first = await saveToSlot(host.adapter, { slotId: '1' });
        expect(first.ok).toBe(true);
        expect(host.log.flushed).toBeGreaterThan(0);
        assertOk(first);
        expect(first.entry).toMatchObject({ id: '1', day: 3, place: 'Puerto Alba', where: '' });
        expect(first.notice.title).toBe('Guardada en la ranura 1');
        expect(host.files[first.entry.file]).toContain('"format":"sillytavern-rpg-partida"');

        // Se juega: pasa el día, y se empieza otra campaña después de guardar.
        host.chats['Posadero.png/Posadero - gremio'][0].chat_metadata.calendar.day = 5;
        host.worlds['Nueva · Tessa'] = { entries: {}, metadata: { hubHome: 'El Gremio' } };
        host.chats['Narrador.png/Narrador - nueva'] = chatLines('Nueva · Tessa', { calendar: { day: 1 } });
        host.tick(60000);
        const second = await saveToSlot(host.adapter, { slotId: '2' });
        expect(second.ok && second.entry.day).toBe(5);

        // Se cierra, y se carga la primera: el día 3, sin la campaña nueva.
        host.openAt(null);
        const back = await loadSlot(host.adapter, { gameId: 'El Gremio', slotId: '1' });
        expect(back).toEqual({ ok: true, where: { avatar: 'Posadero.png', file: 'Posadero - gremio', world: 'El Gremio' }, failed: 0 });
        expect(host.guildDay()).toBe(3);
        expect(host.worlds['Nueva · Tessa']).toBeUndefined();
        expect(host.chats['Narrador.png/Narrador - nueva']).toBeUndefined();
        expect(host.worlds['Otro mundo']).toBeDefined();
        expect(host.chats['Posadero.png/Posadero - otro']).toBeDefined();

        // Y se vuelve a la segunda: el día 5 y la campaña nueva otra vez.
        const again = await loadSlot(host.adapter, { gameId: 'El Gremio', slotId: '2' });
        expect(again.ok).toBe(true);
        expect(host.log.closed).toBe(1);
        expect(host.guildDay()).toBe(5);
        expect(host.worlds['Nueva · Tessa']).toBeDefined();
        expect(host.chats['Narrador.png/Narrador - nueva']).toBeDefined();
    });

    test('guardada desde una campaña, la ranura lo dice y se abre allí', async () => {
        const host = fakeHost();
        host.openAt({ avatar: 'Narrador.png', file: 'Narrador - strahd' });
        const saved = await saveToSlot(host.adapter, { slotId: '3' });
        expect(saved.ok && saved.entry).toMatchObject({ day: 2, place: 'Barovia', where: 'La Maldición de Strahd' });
        host.openAt(null);
        const back = await loadSlot(host.adapter, { gameId: 'El Gremio', slotId: '3' });
        expect(back.ok && back.where.file).toBe('Narrador - strahd');
    });

    test('una ranura vacía, un archivo que ya no está o de otra partida: no se toca nada', async () => {
        const host = fakeHost();
        expect(await loadSlot(host.adapter, { gameId: 'El Gremio', slotId: '1' })).toEqual({ ok: false, reason: 'Esa ranura está vacía.' });
        const saved = await saveToSlot(host.adapter, { slotId: '1' });
        assertOk(saved);
        delete host.files[saved.entry.file];
        const gone = await loadSlot(host.adapter, { gameId: 'El Gremio', slotId: '1' });
        expect(gone.ok).toBe(false);
        expect(host.log.closed).toBe(0);
        expect(await saveToSlot(host.adapter, { slotId: '9' })).toEqual({ ok: false, reason: 'No hay una ranura «9».' });
    });

    test('J3.3: dormir en el gremio guarda; en una campaña, no', async () => {
        const host = fakeHost();
        const slept = await saveOnSleep(host.adapter);
        expect(slept?.ok && slept.entry.id).toBe(SLOT_SLEEP);
        expect(slept?.ok && slept.notice.title).toBe('Dormís en el gremio. Partida guardada');
        host.openAt({ avatar: 'Narrador.png', file: 'Narrador - strahd' });
        expect(await saveOnSleep(host.adapter)).toBeNull();
    });

    test('el automático al cambiar el día, y no dos veces seguidas tras dormir', async () => {
        const host = fakeHost();
        await saveOnSleep(host.adapter);
        expect(await autosave(host.adapter, { day: 3 })).toBeNull();
        const next = await autosave(host.adapter, { day: 4 });
        expect(next?.ok && next.entry.id).toBe(SLOT_AUTO);
        expect(Object.keys(host.settings.gameSlots['El Gremio']).sort()).toEqual(['auto', 'dormir']);
    });

    test('borrar las ranuras de una partida se lleva sus archivos', async () => {
        const host = fakeHost();
        const saved = await saveToSlot(host.adapter, { slotId: '1' });
        await saveToSlot(host.adapter, { slotId: '2' });
        expect(await forgetSlots(host.adapter, 'El Gremio', '1')).toBe(1);
        expect(saved.ok && host.files[saved.entry.file]).toBeUndefined();
        expect(Object.keys(host.settings.gameSlots['El Gremio'])).toEqual(['2']);
        expect(await forgetSlots(host.adapter, 'El Gremio')).toBe(1);
        expect(host.settings.gameSlots['El Gremio']).toBeUndefined();
    });
});

describe('exportar e importar la partida entera (J15.6)', () => {
    test('a otro ordenador: entra igual, con su narrador, sus campañas tuyas y el salón', async () => {
        const home = fakeHost();
        home.worlds['El Gremio'].metadata.hub.campaigns['tuya-cripta'] = { worldName: 'La Maldición de Strahd · Tessa', chat: null, finished: false, ending: '' };
        home.imported = [{ id: 'tuya-cripta', name: 'La cripta', pack: 'user/files/campana-tuya-cripta.pack.json' }, { id: 'tuya-otra', name: 'Otra' }];
        home.files['user/files/campana-tuya-cripta.pack.json'] = '{"version":1}';
        const exported = await exportGame(home.adapter);
        expect(exported.ok).toBe(true);
        assertOk(exported);
        expect(exported.name).toMatch(/^partida-el-gremio-\d{4}-\d{2}-\d{2}\.partida\.json$/);
        expect(exported.summary).toMatchObject({ title: 'El Gremio', sessions: 2, campaigns: ['La Maldición de Strahd'] });

        // Un ordenador vacío: sin mundos, sin chats y sin narradores.
        const away = fakeHost({ withCampaign: false });
        for (const key of Object.keys(away.worlds)) delete away.worlds[key];
        for (const key of Object.keys(away.chats)) delete away.chats[key];
        for (const key of Object.keys(away.files)) delete away.files[key];
        away.avatars.clear();
        away.openAt(null);
        away.adapter.writeHall([]);

        const done = await importGame(away.adapter, exported.content);
        expect(done.ok).toBe(true);
        assertOk(done);
        expect(done).toMatchObject({ gameId: 'El Gremio', title: 'El Gremio', where: { world: 'El Gremio', avatar: 'Posadero.png', file: 'Posadero - gremio' } });
        expect(done.lines[0]).toBe('Entra «El Gremio»: el gremio y 1 campaña, con 2 sesiones.');
        expect(Object.keys(away.worlds).sort()).toEqual(['El Gremio', 'La Maldición de Strahd · Tessa']);
        expect(away.log.created.map(n => n.avatar).sort()).toEqual(['Narrador.png', 'Posadero.png']);
        expect(away.log.created[0].image).toBe('iVBOR');
        expect(away.chats['Posadero.png/Posadero - gremio'][0].chat_metadata.calendar.day).toBe(3);
        expect(away.files['user/files/punto-cp_a.json']).toBe('{"metadata":{},"people":{}}');
        expect(away.files['user/files/campana-tuya-cripta.pack.json']).toBe('{"version":1}');
        expect(away.imported.map(r => r.id)).toEqual(['tuya-cripta']);
        expect(away.hall.map(e => e.world)).toEqual(['La Maldición de Strahd · Tessa']);
    });

    test('al mismo ordenador: una copia al lado, sin pisar la de antes', async () => {
        const host = fakeHost();
        const exported = await exportGame(host.adapter);
        assertOk(exported);
        const done = await importGame(host.adapter, exported.content);
        expect(done.ok).toBe(true);
        assertOk(done);
        expect(done.gameId).toBe('El Gremio (2)');
        expect(done.lines).toContain('Ya tenías una partida con ese nombre: la nueva es «El Gremio (copia)», y sus mundos llevan un número detrás.');
        expect(host.chats['Posadero.png/Posadero - gremio (importada)'][0].chat_metadata.world_info).toBe('El Gremio (2)');
        expect(host.chats['Posadero.png/Posadero - gremio'][0].chat_metadata.world_info).toBe('El Gremio');
        expect(host.worlds['El Gremio'].metadata.displayName).toBe('El Gremio');
        expect(host.log.created).toEqual([]);
        // El salón no apunta dos veces lo mismo… salvo que ahora es otra partida (otro mundo).
        expect(host.hall.filter(e => e.kind === 'campaign').map(e => e.world)).toEqual(['La Maldición de Strahd · Tessa (2)', 'La Maldición de Strahd · Tessa']);
    });

    test('un archivo que no es una partida no escribe nada', async () => {
        const host = fakeHost();
        const before = JSON.stringify(host.worlds);
        const done = await importGame(host.adapter, '{"hola": 1}');
        expect(done).toEqual({ ok: false, problems: ['Este archivo no es una partida del juego. Una partida exportada termina en «.partida.json».'] });
        expect(JSON.stringify(host.worlds)).toBe(before);
    });
});
