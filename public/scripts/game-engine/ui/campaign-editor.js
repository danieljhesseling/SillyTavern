/**
 * El panel de `/campana`: el mundo repartido por categorías.
 *
 * Una pestaña por cosa, como las reparte el paquete de un libro — que es exactamente la
 * queja de la que sale esto: importando un libro ves el mundo ordenado, y a mano no había
 * forma de escribir ni una localidad.
 *
 * Dibuja y recoge. Lo que decide qué es válido y dónde se escribe está en
 * `campaign/campaign-editor.js`; aquí no hay ni una regla.
 *
 * Ver wiki/archivo/PLAN_CREAR_CAMPANA.md, M1 a M6.
 */

import {
    buildEditorModel, validateModel, describeModel, createLocation, createBoard,
    findEnemyUses, ABILITY_FIELDS,
} from '../campaign/campaign-editor.js';
import { LOCATION_TYPES, BOARD_LIMITS, ITEM_RARITIES } from '../campaign/campaign-pack-schema.js';
import { getProfileOptions, DEFAULT_PROFILE } from '../combat/enemy-ai.js';

/** Cómo se lee cada tipo de sitio. Sabor: el motor no cambia ninguna regla por esto. */
const TYPE_LABELS = {
    '': 'Sin tipo',
    city: 'Ciudad',
    village: 'Aldea',
    outpost: 'Puesto avanzado',
    ruins: 'Ruinas',
    dungeon: 'Mazmorra',
    camp: 'Campamento',
    sanctuary: 'Santuario',
    wilderness: 'Yermo',
};

/**
 * Un campo de texto con su etiqueta.
 *
 * @param {string} label
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @param {{area?: boolean, placeholder?: string, cls?: string, type?: string}} [options]
 * @returns {JQuery}
 */
function field(label, value, onChange, options = {}) {
    const wrap = $(`<label class="ce-field ${options.cls ?? ''}"></label>`);
    wrap.append($('<span class="ce-label"></span>').text(label));

    const input = options.area
        ? $('<textarea class="text_pole ce-input ce-area"></textarea>')
        : $('<input class="text_pole ce-input" />').attr('type', options.type ?? 'text');

    input.attr('placeholder', options.placeholder ?? '').val(String(value ?? ''));
    input.on('input', () => onChange(String(input.val() ?? '')));

    wrap.append(input);
    return wrap;
}

/**
 * Las casillas de un tablero, escritas como las lee un jugador: contando desde 1.
 *
 * @param {Array<{x: number, y: number}>} cells
 * @returns {string}
 */
function cellsToText(cells) {
    return cells.map(cell => `${cell.x + 1},${cell.y + 1}`).join(' ');
}

/**
 * Y de vuelta. Lo que no se entienda se cae, en vez de guardar una casilla inventada.
 *
 * @param {string} raw
 * @returns {Array<{x: number, y: number}>}
 */
function textToCells(raw) {
    return String(raw ?? '')
        .split(/[\s;]+/)
        .map(part => part.split(','))
        .filter(pair => pair.length === 2)
        .map(([x, y]) => ({ x: Math.max(0, (parseInt(x, 10) || 1) - 1), y: Math.max(0, (parseInt(y, 10) || 1) - 1) }));
}

/**
 * Un desplegable con su etiqueta.
 *
 * Lo que el motor de verdad juega se elige de una lista; escribirlo a mano es como se
 * acaba con un perfil "brute" que nadie juega y nadie avisa.
 *
 * @param {string} label
 * @param {string} value
 * @param {Array<[string, string]>} options
 * @param {(value: string) => void} onChange
 * @param {{cls?: string}} [config]
 * @returns {JQuery}
 */
function pick(label, value, options, onChange, config = {}) {
    const wrap = $(`<label class="ce-field ${config.cls ?? ''}"></label>`);
    wrap.append($('<span class="ce-label"></span>').text(label));

    const select = $('<select class="text_pole ce-input ce-select"></select>');
    for (const [id, text] of options) {
        select.append($('<option></option>').attr('value', id).text(text));
    }
    // Lo que guarda la ficha manda sobre la lista: si apunta a algo que ya no existe, se
    // ve que apunta ahi en vez de cambiarse solo al primero de la lista.
    if (!options.some(([id]) => id === value) && String(value ?? '')) {
        select.append($('<option></option>').attr('value', value).text(`${value} (ya no existe)`));
    }
    select.val(String(value ?? ''));
    select.on('change', () => onChange(String(select.val() ?? '')));

    wrap.append(select);
    return wrap;
}

/**
 * Un campo de numero entero.
 *
 * @param {string} label
 * @param {number} value
 * @param {(value: number) => void} onChange
 * @param {{min?: number, step?: string}} [config]
 * @returns {JQuery}
 */
function numberField(label, value, onChange, config = {}) {
    const wrap = field(label, String(value ?? 0), v => onChange(Number(v) || 0), { type: 'number' });
    if (config.min !== undefined) wrap.find('input').attr('min', String(config.min));
    if (config.step) wrap.find('input').attr('step', config.step);
    return wrap;
}

/**
 * Una ficha plegada: el nombre fuera, todo lo demas dentro.
 *
 * Un mundo con veinte personajes no cabe abierto, y una lista donde no se distingue uno
 * de otro no es una lista.
 *
 * @param {string} title
 * @param {string} subtitle
 * @param {() => void} onRemove
 * @param {string} [cls]
 * @returns {{card: JQuery, inner: JQuery}}
 */
function foldedCard(title, subtitle, onRemove, cls = '') {
    const card = $(`<details class="ce-card ${cls}"></details>`);
    const head = $('<summary class="ce-card-head"></summary>');
    head.append($('<span class="ce-card-title"></span>').text(title || 'Sin nombre'));
    if (subtitle) head.append($('<span class="ce-card-sub"></span>').text(subtitle));

    const remove = $('<button class="menu_button ce-remove" type="button"></button>')
        .attr('title', 'Quitar')
        .append('<i class="fa-solid fa-trash"></i>');
    remove.on('click', (/** @type {any} */ event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove();
    });
    head.append(remove);

    const inner = $('<div class="ce-card-body"></div>');
    card.append(head, inner);
    return { card, inner };
}

/**
 * Abre el editor. Devuelve el modelo editado, o null si se cancela.
 *
 * @param {Object} input
 * @param {string[]} [input.biomes] Los biomas que el compendio trae, para poder elegir
 *        uno en vez de teclearlo. Sin batería de mundo, el campo no aparece.
 * @param {((where: string) => any|null)|null} [input.writePerson] Alguien del compendio,
 *        con su oficio, lo que quiere y lo que teme.
 * @param {((boards: string[]) => any|null)|null} [input.writeQuest] Una misión del
 *        compendio, con los tableros que hay para elegir dónde se juega.
 * @param {((cr: number) => any|null)|null} [input.breedMonster] Un bicho del compendio,
 *        del desafío que se le pida. Misma regla: sin batería de bestiario, no hay botón.
 * @param {(() => any|null)|null} [input.forgeItem] Un objeto del compendio, para el
 *        botón de forjar. Sin batería de materiales no hay botón y la ficha se rellena a
 *        mano, como siempre: el compendio es aditivo.
 * @param {any} input.metadata El bloque `metadata` del mundo abierto.
 * @param {any} input.entries Las fichas del Lorebook, por uid.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any|null>}
 */
export async function openCampaignEditor({
    metadata, entries, Popup, POPUP_TYPE,
    forgeItem = null, breedMonster = null, writeQuest = null, writePerson = null, biomes = [],
}) {
    const model = buildEditorModel(metadata, entries);

    // El bestiario sale del propio modelo y no de fuera: asi un bicho escrito hace un
    // momento en su pestaña ya se puede colocar en un tablero sin cerrar nada.
    const bestiaryNames = () => model.bestiary
        .map((/** @type {any} */ e) => String(e.name ?? '').trim()).filter(Boolean);

    /**
     * Las localidades, para los desplegables de "donde esta".
     * @returns {Array<[string, string]>}
     */
    const placeOptions = () => [
        /** @type {[string, string]} */ (['', 'En ningún sitio concreto']),
        ...model.locations.map((/** @type {any} */ l) =>
            /** @type {[string, string]} */ ([String(l.name), String(l.name)])),
    ];

    /** Todos los tableros del mundo, dichos con su localidad delante. */
    const boardOptions = () => {
        /** @type {Array<[string, string]>} */
        const options = [['', 'Ningún tablero']];
        for (const location of model.locations) {
            for (const board of location.boards) {
                options.push([String(board.name), `${location.name} — ${board.name}`]);
            }
        }
        return options;
    };

    const root = $('<div class="ce-root"></div>');
    const head = $('<div class="ce-head"></div>');
    const summary = $('<div class="ce-summary"></div>').text(describeModel(model));
    head.append(summary);
    root.append(head);

    const tabs = $('<div class="ce-tabs"></div>');
    const body = $('<div class="ce-body"></div>');
    root.append(tabs, body);

    const status = $('<div class="ce-status"></div>');
    root.append(status);

    /** @type {'world'|'locations'|'people'|'bestiary'|'factions'|'items'|'quests'} */
    let tab = 'world';

    /** Vuelve a escribir la línea de arriba: cuánto mundo hay. */
    const refreshSummary = () => summary.text(describeModel(model));

    function drawTabs() {
        tabs.empty();
        const pages = [
            ['world', 'Mundo', 'fa-globe'],
            ['locations', 'Localidades', 'fa-location-dot'],
            ['people', 'Personajes', 'fa-user'],
            ['bestiary', 'Bestiario', 'fa-dragon'],
            ['factions', 'Facciones', 'fa-flag'],
            ['items', 'Objetos', 'fa-gem'],
            ['quests', 'Misiones', 'fa-scroll'],
        ];
        for (const [id, label, icon] of pages) {
            const button = $('<button class="menu_button ce-tab" type="button"></button>')
                .toggleClass('active', tab === id)
                .append(`<i class="fa-solid ${icon}"></i>`)
                .append($('<span></span>').text(` ${label}`));
            button.on('click', () => {
                tab = /** @type {any} */ (id);
                draw();
            });
            tabs.append(button);
        }
    }

    /** La ficha del mundo. */
    function drawWorld() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'Lo que el mundo es antes de que nadie entre en él. La sinopsis viaja con la '
            + 'campaña y es lo que lee quien la importe.',
        ));
        body.append(field('Nombre visible', model.world.displayName, v => { model.world.displayName = v; }));
        body.append(field('Género', model.world.genre, v => { model.world.genre = v; },
            { placeholder: 'Fantasía oscura, ciencia ficción…' }));
        body.append(field('Sinopsis', model.world.description, v => { model.world.description = v; },
            { area: true, cls: 'ce-wide' }));

        // La semilla se ensena y no se edita: cambiarsela a una campana empezada haria que
        // lo que se genere a partir de ahora no pegue con lo que ya se genero. Se ve para
        // poder copiarla, que es como se comparte un mundo.
        const worldSeed = String(model.world.seed || '').trim();
        if (worldSeed) {
            const seed = $('<div class="ce-seed"></div>');
            seed.append($('<span class="ce-label"></span>').text('Semilla del mundo'));
            seed.append($('<code class="ce-seed-value"></code>').text(worldSeed));
            seed.append($('<div class="ce-hint"></div>').text(
                'Quien la escriba al crear una campaña tendrá este mismo mundo.',
            ));
            body.append(seed);
        }
    }

    /**
     * Un tablero dentro de su localidad.
     *
     * @param {any} location
     * @param {any} board
     * @returns {JQuery}
     */
    function drawBoard(location, board) {
        const card = $('<div class="ce-board"></div>');

        const row = $('<div class="ce-board-head"></div>');
        const name = $('<input class="text_pole ce-board-name" />').val(board.name);
        name.on('input', () => { board.name = String(name.val() ?? ''); });
        row.append(name);

        const remove = $('<button class="menu_button ce-remove" type="button"></button>')
            .attr('title', 'Quitar este tablero')
            .append('<i class="fa-solid fa-trash"></i>');
        remove.on('click', () => {
            location.boards = location.boards.filter((/** @type {any} */ b) => b !== board);
            refreshSummary();
            draw();
        });
        row.append(remove);
        card.append(row);

        const grid = $('<div class="ce-grid"></div>');
        grid.append(field('Ancho', board.gridWidth, v => { board.gridWidth = Number(v) || 0; }, { type: 'number' }));
        grid.append(field('Alto', board.gridHeight, v => { board.gridHeight = Number(v) || 0; }, { type: 'number' }));
        grid.append(field('Empieza el grupo en', cellsToText(board.partyStart),
            v => { board.partyStart = textToCells(v); },
            { placeholder: '2,8 3,8', cls: 'ce-wide' }));
        card.append(grid);

        // Los enemigos colocados: el nombre sale del bestiario, no se escribe a mano.
        const enemies = $('<div class="ce-enemies"></div>');
        enemies.append($('<span class="ce-label"></span>').text('Enemigos colocados'));

        for (const placement of board.enemyPlacements) {
            const line = $('<div class="ce-enemy"></div>');
            const names = bestiaryNames();
            const chooser = $('<select class="text_pole ce-enemy-name"></select>');
            for (const enemyName of names) {
                chooser.append($('<option></option>').attr('value', enemyName).text(enemyName));
            }
            if (!names.includes(placement.name) && placement.name) {
                chooser.append($('<option></option>').attr('value', placement.name)
                    .text(`${placement.name} (no está en el bestiario)`));
            }
            chooser.val(placement.name);
            chooser.on('change', () => { placement.name = String(chooser.val() ?? ''); });

            const cell = $('<input class="text_pole ce-enemy-cell" />')
                .attr('placeholder', '9,4')
                .val(`${placement.x + 1},${placement.y + 1}`);
            cell.on('input', () => {
                const [one] = textToCells(String(cell.val() ?? ''));
                if (one) { placement.x = one.x; placement.y = one.y; }
            });

            const drop = $('<button class="menu_button ce-remove" type="button"></button>')
                .append('<i class="fa-solid fa-xmark"></i>');
            drop.on('click', () => {
                board.enemyPlacements = board.enemyPlacements.filter((/** @type {any} */ p) => p !== placement);
                draw();
            });

            line.append(chooser, cell, drop);
            enemies.append(line);
        }

        const addEnemy = $('<button class="menu_button ce-add-enemy" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Colocar un enemigo'));
        addEnemy.prop('disabled', bestiaryNames().length === 0);
        addEnemy.attr('title', bestiaryNames().length === 0
            ? 'Este mundo no tiene bestiario todavía: escríbelo en la pestaña Bestiario'
            : 'Elige uno del bestiario y su casilla');
        addEnemy.on('click', () => {
            board.enemyPlacements.push({ name: bestiaryNames()[0] ?? '', x: 1, y: 1 });
            draw();
        });
        enemies.append(addEnemy);
        card.append(enemies);

        card.append($('<div class="ce-board-note"></div>').text(
            'El terreno se pinta en el tablero, con el botón "Terreno". Los objetivos, con /objetivos editar.',
        ));

        return card;
    }

    /** La lista de localidades. */
    function drawLocations() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'Una localidad puede no tener ningún tablero: una aldea donde solo se habla y '
            + 'se comercia es tan válida como una cripta.',
        ));

        for (const location of model.locations) {
            const card = $('<div class="ce-location"></div>');

            const row = $('<div class="ce-location-head"></div>');
            const name = $('<input class="text_pole ce-location-name" />').val(location.name);
            name.on('input', () => {
                location.name = String(name.val() ?? '');
                refreshSummary();
            });
            row.append(name);

            const type = $('<select class="text_pole ce-type"></select>');
            for (const option of ['', ...LOCATION_TYPES]) {
                type.append($('<option></option>').attr('value', option).text(TYPE_LABELS[option] ?? option));
            }
            type.val(location.type);
            type.on('change', () => { location.type = String(type.val() ?? ''); });
            row.append(type);

            const remove = $('<button class="menu_button ce-remove" type="button"></button>')
                .attr('title', 'Quitar esta localidad')
                .append('<i class="fa-solid fa-trash"></i>');
            remove.on('click', () => {
                model.locations = model.locations.filter(l => l !== location);
                refreshSummary();
                draw();
            });
            row.append(remove);
            card.append(row);

            const grid = $('<div class="ce-grid"></div>');
            grid.append(field('Región', location.region, v => { location.region = v; },
                { placeholder: 'La ribera, el norte…' }));
            grid.append(field('Facción que manda', location.factionName, v => { location.factionName = v; }));
            // El bioma sale de la batería del mundo: se elige, no se teclea, porque un
            // bioma mal escrito es un filtro que no encuentra nada y no dice por qué.
            if (biomes.length > 0) {
                grid.append(pick('Qué clase de sitio es', location.biome,
                    /** @type {any} */ ([['', 'Sin decir'], ...biomes.map(b => [b, b])]),
                    v => { location.biome = v; }, { cls: 'ce-biome' }));
            }
            card.append(grid);
            card.append(field('Descripción', location.description, v => { location.description = v; },
                { area: true, cls: 'ce-wide' }));

            const boards = $('<div class="ce-boards"></div>');
            boards.append($('<span class="ce-label"></span>').text(
                location.boards.length === 0 ? 'Sin tableros: aquí no se pelea' : 'Tableros',
            ));
            for (const board of location.boards) boards.append(drawBoard(location, board));

            const addBoard = $('<button class="menu_button ce-add-board" type="button"></button>')
                .append('<i class="fa-solid fa-plus"></i>')
                .append($('<span></span>').text(' Añadir un tablero'));
            addBoard.on('click', () => {
                const created = createBoard(`Tablero ${location.boards.length + 1}`, 14, 10);
                location.boards.push({
                    name: created.name,
                    description: '',
                    gridWidth: created.gridWidth,
                    gridHeight: created.gridHeight,
                    partyStart: created.partyStart,
                    enemyPlacements: [],
                });
                refreshSummary();
                draw();
            });
            boards.append(addBoard);
            card.append(boards);

            body.append(card);
        }

        const addLocation = $('<button class="menu_button ce-add-location" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir una localidad'));
        addLocation.on('click', () => {
            const created = createLocation(`Sitio ${model.locations.length + 1}`);
            model.locations.push({
                name: created.name, type: '', description: '', region: '', biome: '',
                factionName: '', boards: [],
            });
            refreshSummary();
            draw();
        });
        body.append(addLocation);
    }

    /**
     * Una ficha de persona, del grupo o del mundo.
     *
     * @param {any} person
     * @returns {JQuery}
     */
    function drawCharacter(person) {
        const inParty = person.kind === 'character';
        const { card, inner } = foldedCard(
            person.name,
            [person.className, person.locationName].filter(Boolean).join(' · '),
            () => {
                model.characters = model.characters.filter((/** @type {any} */ p) => p !== person);
                refreshSummary();
                draw();
            },
            'ce-person',
        );

        const who = $('<div class="ce-forge-row"></div>');
        who.append(field('Nombre', person.name, v => { person.name = v; }, { cls: 'ce-person-name' }));

        // Escribir: oficio, dos rasgos que no se contradigan, lo que quiere y lo que teme.
        // Esas dos ultimas son las que hacen que haga cosas cuando no estas mirando.
        if (writePerson) {
            const write = $('<button class="menu_button ce-write-person" type="button"></button>')
                .attr('title', 'Sacar a alguien del compendio, con su oficio y lo que quiere')
                .append('<i class="fa-solid fa-feather"></i>')
                .append($('<span></span>').text(' Escribir'));
            write.on('click', () => {
                const made = writePerson(person.locationName);
                if (!made) {
                    write.prop('disabled', true).attr('title', 'La batería de personas está vacía');
                    return;
                }
                Object.assign(person, {
                    name: made.name || person.name,
                    title: made.title,
                    abilities: made.abilities,
                    arcana: made.arcana,
                    // Lo tuyo manda: si ya habias escrito su pasado, no se pisa.
                    backstory: person.backstory || made.backstory,
                    personality: person.personality || made.personality,
                    keys: person.keys.length > 0 ? person.keys : made.keys,
                });
                refreshSummary();
                draw();
            });
            who.append(write);
        }
        who.append(field('Título', person.title, v => { person.title = v; },
            { placeholder: 'el de la guardia, la molinera…' }));
        inner.append(who);

        const what = $('<div class="ce-grid"></div>');
        what.append(field('Clase', person.className, v => { person.className = v; }));
        what.append(numberField('Nivel', person.level, v => { person.level = Math.max(1, v); }, { min: 1 }));
        what.append(field('Raza', person.race, v => { person.race = v; }));
        inner.append(what);

        const stats = $('<div class="ce-grid ce-stats"></div>');
        for (const [key, label] of ABILITY_FIELDS) {
            stats.append(numberField(label, person.abilities[key] ?? 10,
                v => { person.abilities[key] = v; }, { min: 1 }));
        }
        stats.append(numberField('PG máximos', person.maxHp, v => { person.maxHp = Math.max(1, v); }, { min: 1 }));
        stats.append(numberField('CA', person.armorClass, v => { person.armorClass = Math.max(1, v); }, { min: 1 }));
        stats.append(numberField('Velocidad', person.speed, v => { person.speed = Math.max(0, v); }, { min: 0 }));
        inner.append(stats);

        inner.append(pick('Dónde está', person.locationName, placeOptions(),
            v => { person.locationName = v; }, { cls: 'ce-where' }));

        inner.append(field('Pasado', person.backstory, v => { person.backstory = v; },
            { area: true, cls: 'ce-wide' }));
        inner.append(field('Personalidad', person.personality, v => { person.personality = v; },
            { area: true, cls: 'ce-wide' }));

        const bond = $('<div class="ce-grid"></div>');
        bond.append(field('Arcano', person.arcana, v => { person.arcana = v; },
            { placeholder: 'El Ermitaño, La Torre…' }));
        bond.append(numberField('Vínculo inicial', person.initialBondPoints,
            v => { person.initialBondPoints = Math.max(0, v); }, { min: 0 }));
        inner.append(bond);

        inner.append(field('Cara (dirección de imagen)', person.image, v => { person.image = v; },
            { placeholder: 'img/mira.png', cls: 'ce-wide' }));
        inner.append(field('Palabras que lo despiertan', person.keys.join(', '),
            v => { person.keys = v.split(',').map(k => k.trim()).filter(Boolean); },
            { placeholder: 'el Capitán, Valen, el de la guardia', cls: 'ce-wide' }));

        // El puente entre las dos listas, que es lo que antes no existía.
        const move = $('<button class="menu_button ce-recruit" type="button"></button>')
            .append(`<i class="fa-solid ${inParty ? 'fa-door-open' : 'fa-user-plus'}"></i>`)
            .append($('<span></span>').text(inParty ? ' Sacar del grupo' : ' Reclutar'));
        move.attr('title', inParty
            ? 'Deja de jugarse y pasa a ser alguien del mundo'
            : 'Entra en el grupo con la ficha que tiene escrita aquí');
        move.on('click', () => {
            person.kind = inParty ? 'npc' : 'character';
            draw();
        });
        inner.append(move);

        return card;
    }

    /** Personajes: los del grupo y los del mundo, en dos listas. */
    function drawPeople() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'Lo que escribas en Pasado y Personalidad es lo único de esta ficha que lee el '
            + 'modelo cuando alguien lo menciona. Los números son para el motor.',
        ));

        for (const [kind, title, empty] of [
            ['character', 'En tu grupo', 'Todavía no hay nadie en el grupo.'],
            ['npc', 'En el mundo', 'Todavía no vive nadie en este mundo.'],
        ]) {
            const group = $('<div class="ce-people-group"></div>');
            group.append($('<span class="ce-label"></span>').text(title));

            const people = model.characters.filter((/** @type {any} */ p) => p.kind === kind);
            if (people.length === 0) group.append($('<div class="ce-empty"></div>').text(empty));
            for (const person of people) group.append(drawCharacter(person));

            body.append(group);
        }

        const add = $('<button class="menu_button ce-add-person" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir alguien del mundo'));
        add.on('click', () => {
            /** @type {Record<string, number>} */
            const abilities = {};
            for (const [key] of ABILITY_FIELDS) abilities[key] = 10;
            model.characters.push({
                uid: '', kind: 'npc', raw: {}, name: `Alguien ${model.characters.length + 1}`,
                title: '', className: '', level: 1, race: '', maxHp: 10, armorClass: 10, speed: 30,
                abilities, locationName: '', backstory: '', personality: '', arcana: '',
                initialBondPoints: 0, image: '', keys: [],
            });
            refreshSummary();
            draw();
        });
        body.append(add);
    }

    /** Bestiario: los cuatro números que el motor juega y el perfil táctico. */
    function drawBestiary() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'El perfil decide cómo se mueve en combate, y el motor solo juega estos cuatro. '
            + 'El nombre es único: el Lorebook indexa por nombre.',
        ));

        const profiles = getProfileOptions().map(([value, label]) => [String(value), String(label)]);

        for (const enemy of model.bestiary) {
            const { card, inner } = foldedCard(
                enemy.name,
                `${enemy.hp} PG · CA ${enemy.armorClass} · desafío ${enemy.cr}`,
                () => {
                    // Quitar un bicho que un tablero coloca deja una colocación muerta que
                    // solo se descubre al entrar a pelear. Se dice antes.
                    const uses = findEnemyUses(model, enemy.name);
                    if (uses.length > 0) {
                        const note = `"${enemy.name}" está colocado en ${uses.join(', ')}. `
                            + 'Si lo quitas, esos tableros se quedan con un hueco.';
                        if (!confirm(note)) return;
                        for (const location of model.locations) {
                            for (const board of location.boards) {
                                board.enemyPlacements = board.enemyPlacements.filter(
                                    (/** @type {any} */ p) => String(p.name) !== enemy.name);
                            }
                        }
                    }
                    model.bestiary = model.bestiary.filter((/** @type {any} */ e) => e !== enemy);
                    refreshSummary();
                    draw();
                },
                'ce-beast',
            );

            const beastRow = $('<div class="ce-forge-row"></div>');
            beastRow.append(field('Nombre', enemy.name, v => { enemy.name = v; }, { cls: 'ce-beast-name' }));

            // Criar: arquetipo por plantilla. Los números salen de su desafío, así que un
            // bicho de CR 1/4 y uno de CR 3 se escriben con la misma fila.
            if (breedMonster) {
                const breed = $('<button class="menu_button ce-breed" type="button"></button>')
                    .attr('title', 'Sacar un arquetipo y sus plantillas del compendio')
                    .append('<i class="fa-solid fa-paw"></i>')
                    .append($('<span></span>').text(' Criar'));
                breed.on('click', () => {
                    // Con el desafío que ya tenga escrito: quien lo ha puesto a 2 quiere
                    // un bicho de 2, no que se lo cambie el compendio.
                    const made = breedMonster(enemy.cr);
                    if (!made) {
                        breed.prop('disabled', true).attr('title', 'La batería de bestiario está vacía');
                        return;
                    }
                    Object.assign(enemy, {
                        name: made.name, hp: made.hp, armorClass: made.armorClass,
                        cr: made.cr, speed: made.speed, attackRangeFeet: made.attackRangeFeet,
                        profile: made.profile,
                        description: enemy.description || made.description,
                    });
                    refreshSummary();
                    draw();
                });
                beastRow.append(breed);
            }

            inner.append(beastRow);

            const stats = $('<div class="ce-grid"></div>');
            stats.append(numberField('PG', enemy.hp, v => { enemy.hp = Math.max(1, v); }, { min: 1 }));
            stats.append(numberField('CA', enemy.armorClass, v => { enemy.armorClass = Math.max(1, v); }, { min: 1 }));
            stats.append(field('Desafío', String(enemy.cr), v => { enemy.cr = Number(v) || 0; },
                { type: 'number', placeholder: '0.5' }));
            stats.append(numberField('Velocidad', enemy.speed, v => { enemy.speed = Math.max(0, v); }, { min: 0 }));
            stats.append(numberField('Alcance (pies)', enemy.attackRangeFeet,
                v => { enemy.attackRangeFeet = Math.max(5, v); }, { min: 5 }));
            inner.append(stats);

            inner.append(pick('Perfil táctico', enemy.profile, /** @type {any} */ (profiles),
                v => { enemy.profile = v; }, { cls: 'ce-profile' }));
            inner.append(field('Descripción', enemy.description, v => { enemy.description = v; },
                { area: true, cls: 'ce-wide' }));

            body.append(card);
        }

        const add = $('<button class="menu_button ce-add-beast" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir un enemigo'));
        add.on('click', () => {
            model.bestiary.push({
                uid: '', raw: {}, name: `Bicho ${model.bestiary.length + 1}`, description: '',
                hp: 10, armorClass: 12, cr: 0.5, speed: 30, attackRangeFeet: 5, profile: DEFAULT_PROFILE,
            });
            refreshSummary();
            draw();
        });
        body.append(add);
    }

    /** Facciones: nombre, metas y una reputación que todavía no hace nada. */
    function drawFactions() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'La reputación se guarda y viaja con la campaña, pero todavía no cambia ninguna '
            + 'regla: ningún precio ni ninguna puerta dependen de ella hoy.',
        ));

        for (const faction of model.factions) {
            const { card, inner } = foldedCard(
                faction.name,
                `reputación ${faction.reputation}`,
                () => {
                    model.factions = model.factions.filter((/** @type {any} */ f) => f !== faction);
                    draw();
                },
                'ce-faction',
            );

            inner.append(field('Nombre', faction.name, v => { faction.name = v; }, { cls: 'ce-faction-name' }));
            inner.append(field('Qué quiere', faction.goals, v => { faction.goals = v; },
                { area: true, cls: 'ce-wide' }));
            inner.append(numberField('Reputación inicial', faction.reputation,
                v => { faction.reputation = Math.max(-100, Math.min(100, v)); }));

            body.append(card);
        }

        const add = $('<button class="menu_button ce-add-faction" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir una facción'));
        add.on('click', () => {
            model.factions.push({ uid: '', raw: {}, name: `Facción ${model.factions.length + 1}`, goals: '', reputation: 0 });
            draw();
        });
        body.append(add);
    }

    /** Objetos: el catálogo del mundo, de donde sale el botín. */
    function drawItems() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'Lo que existe en este mundo antes de que nadie lo lleve encima. De aquí sale el '
            + 'botín: la rareza decide con qué facilidad cae.',
        ));

        const party = model.characters.filter((/** @type {any} */ p) => p.kind === 'character');
        model.gifts = Array.isArray(model.gifts) ? model.gifts : [];

        for (const item of model.items) {
            const { card, inner } = foldedCard(
                item.name,
                [item.type, item.rarity].filter(Boolean).join(' · '),
                () => {
                    model.items = model.items.filter((/** @type {any} */ i) => i !== item);
                    refreshSummary();
                    draw();
                },
                'ce-item',
            );

            const nameRow = $('<div class="ce-forge-row"></div>');
            nameRow.append(field('Nombre', item.name, v => { item.name = v; }, { cls: 'ce-item-name' }));

            // Forjar: forma por material. Rellena la ficha **entera** y la deja editable,
            // que es lo que separa una ayuda de una caja negra.
            if (forgeItem) {
                const forge = $('<button class="menu_button ce-forge" type="button"></button>')
                    .attr('title', 'Sacar una forma y un material del compendio')
                    .append('<i class="fa-solid fa-hammer"></i>')
                    .append($('<span></span>').text(' Forjar'));
                forge.on('click', () => {
                    const made = forgeItem();
                    if (!made) {
                        forge.prop('disabled', true).attr('title', 'La batería de materiales está vacía');
                        return;
                    }
                    Object.assign(item, {
                        name: made.name, type: made.type, category: made.category,
                        rarity: made.rarity, weight: made.weight, damageDice: made.damageDice,
                        damageType: made.damageType, slot: made.slot,
                        effects: made.effects ?? [],
                        // La descripción no se pisa si ya escribiste algo: lo tuyo manda.
                        description: item.description || made.description,
                    });
                    refreshSummary();
                    draw();
                });
                nameRow.append(forge);
            }

            inner.append(nameRow);

            const what = $('<div class="ce-grid"></div>');
            what.append(pick('Qué es', item.type, [
                ['weapon', 'Arma'], ['armor', 'Armadura'], ['gear', 'Equipo'],
            ], v => { item.type = v; }, { cls: 'ce-item-type' }));
            what.append(pick('Rareza', item.rarity,
                /** @type {any} */ (ITEM_RARITIES.map(r => [r, r])), v => { item.rarity = v; },
                { cls: 'ce-item-rarity' }));
            what.append(field('Peso (kg)', String(item.weight), v => { item.weight = Number(v) || 0; },
                { type: 'number' }));
            inner.append(what);

            const fight = $('<div class="ce-grid"></div>');
            fight.append(field('Dados de daño', item.damageDice, v => { item.damageDice = v; },
                { placeholder: '1d8' }));
            fight.append(field('Tipo de daño', item.damageType, v => { item.damageType = v; },
                { placeholder: 'cortante' }));
            fight.append(field('Ranura', item.slot, v => { item.slot = v; },
                { placeholder: 'weapon, body, feet…' }));
            inner.append(fight);

            inner.append(field('Descripción', item.description, v => { item.description = v; },
                { area: true, cls: 'ce-wide' }));

            // Dárselo a alguien: solo al grupo, que es quien tiene mochila de verdad.
            const give = $('<div class="ce-give"></div>');
            if (party.length === 0) {
                give.append($('<div class="ce-empty"></div>').text(
                    'Cuando haya alguien en el grupo, podrás dárselo desde aquí.'));
            } else {
                const to = $('<select class="text_pole ce-give-to"></select>');
                for (const person of party) {
                    to.append($('<option></option>').attr('value', person.name).text(person.name));
                }
                const button = $('<button class="menu_button ce-give-button" type="button"></button>')
                    .append('<i class="fa-solid fa-hand-holding"></i>')
                    .append($('<span></span>').text(' Dárselo'));
                button.on('click', () => {
                    const who = String(to.val() ?? '');
                    if (!who || !String(item.name ?? '').trim()) return;
                    model.gifts.push({ item: String(item.name).trim(), to: who });
                    button.find('span').text(` Se lo lleva ${who} al guardar`);
                    button.prop('disabled', true);
                });
                give.append($('<span class="ce-label"></span>').text('Dárselo a alguien'), to, button);
            }
            inner.append(give);

            body.append(card);
        }

        const add = $('<button class="menu_button ce-add-item" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir un objeto'));
        add.on('click', () => {
            model.items.push({
                name: `Objeto ${model.items.length + 1}`, type: 'gear', rarity: 'Common',
                weight: 0, damageDice: '', damageType: '', slot: '', description: '',
            });
            refreshSummary();
            draw();
        });
        body.append(add);
    }

    /** Misiones: nombre, acto y en qué tablero se juegan. */
    function drawQuests() {
        body.empty();
        body.append($('<div class="ce-intro"></div>').text(
            'Una misión se juega en un tablero. Sus objetivos se editan en el propio tablero, '
            + 'con /objetivos editar: aquí se dice cuál es la misión y a qué acto pertenece.',
        ));

        const boards = boardOptions();
        if (boards.length === 1) {
            body.append($('<div class="ce-empty"></div>').text(
                'Este mundo no tiene ningún tablero todavía, así que no hay dónde jugar una misión. '
                + 'Añade uno en Localidades.'));
        }

        for (const quest of model.quests) {
            const { card, inner } = foldedCard(
                quest.name,
                [quest.boardName, `acto ${quest.act}`].filter(Boolean).join(' · '),
                () => {
                    model.quests = model.quests.filter((/** @type {any} */ q) => q !== quest);
                    refreshSummary();
                    draw();
                },
                'ce-quest',
            );

            const questRow = $('<div class="ce-forge-row"></div>');
            questRow.append(field('Nombre', quest.name, v => { quest.name = v; }, { cls: 'ce-quest-name' }));

            // Encargar: verbo + objeto + giro. El giro es lo que separa un recado de una
            // mision, y por eso viene puesto en la descripcion y no hay que inventarlo.
            if (writeQuest) {
                const order = $('<button class="menu_button ce-quest-roll" type="button"></button>')
                    .attr('title', 'Sacar un encargo del compendio, con su giro')
                    .append('<i class="fa-solid fa-scroll"></i>')
                    .append($('<span></span>').text(' Encargar'));
                order.on('click', () => {
                    const made = writeQuest(boards.map((/** @type {any} */ b) => String(b[0])).filter(Boolean));
                    if (!made) {
                        order.prop('disabled', true).attr('title', 'La batería de misiones está vacía');
                        return;
                    }
                    Object.assign(quest, {
                        name: made.name,
                        description: quest.description || made.description,
                        // El acto y el tablero son cosa tuya si ya los pusiste.
                        boardName: quest.boardName || made.boardName,
                    });
                    refreshSummary();
                    draw();
                });
                questRow.append(order);
            }

            inner.append(questRow);

            const where = $('<div class="ce-grid"></div>');
            where.append(pick('Dónde se juega', quest.boardName, boards,
                v => { quest.boardName = v; }, { cls: 'ce-quest-board' }));
            where.append(numberField('Acto', quest.act, v => { quest.act = Math.max(1, v); }, { min: 1 }));
            inner.append(where);

            inner.append(field('Descripción', quest.description, v => { quest.description = v; },
                { area: true, cls: 'ce-wide' }));

            body.append(card);
        }

        const add = $('<button class="menu_button ce-add-quest" type="button"></button>')
            .append('<i class="fa-solid fa-plus"></i>')
            .append($('<span></span>').text(' Añadir una misión'));
        add.prop('disabled', boards.length === 1);
        add.on('click', () => {
            model.quests.push({
                name: `Misión ${model.quests.length + 1}`, description: '', act: 1,
                boardName: boards[1]?.[0] ?? '',
            });
            refreshSummary();
            draw();
        });
        body.append(add);
    }

    function draw() {
        drawTabs();
        if (tab === 'world') drawWorld();
        else if (tab === 'locations') drawLocations();
        else if (tab === 'people') drawPeople();
        else if (tab === 'bestiary') drawBestiary();
        else if (tab === 'factions') drawFactions();
        else if (tab === 'items') drawItems();
        else drawQuests();
    }

    draw();

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Guardar campaña',
        cancelButton: 'Cancelar',
        wide: true,
        large: true,
        allowVerticalScrolling: true,
        onClosing: (/** @type {any} */ p) => {
            if (p.result !== 1) return true;

            // Guardar algo que no se puede jugar es peor que no guardar: se dice entero y
            // no de uno en uno, que es como se arregla en una pasada.
            const errors = validateModel(model);
            if (errors.length === 0) return true;

            status.empty();
            for (const message of errors.slice(0, 6)) {
                status.append($('<div class="ce-error"></div>').text(message));
            }
            return false;
        },
    });

    const result = await popup.show();
    return result ? model : null;
}

export { BOARD_LIMITS };
