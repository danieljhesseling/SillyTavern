/**
 * Crear personaje, en su propia pantalla (J18.2 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * La maqueta del Gem director de UX (`wiki/maquetas/crear-personaje.html`): dos columnas.
 * A la izquierda, lo de las reglas: tres tarjetas grandes (clase, especie y trasfondo) que
 * abren un selector, y debajo los atributos, que se llenan al elegir. A la derecha, quién
 * eres: el retrato, el nombre con sugerencias, cómo te presentas y «Quién eres», con la
 * varita dentro del campo.
 *
 * Antes era una ventana de campos de texto con listas: la clase se escribía. Elegir de
 * tarjetas que dicen lo que da cada cosa es lo que se espera de un juego de rol, y escribir
 * «guerero» ya no deja a nadie sin clase.
 *
 * «Entrar al mundo» no se enciende hasta que hay nombre y clase.
 *
 * Dibuja y recoge. Las reglas están en `campaign/hero.js`; los números los calcula quien
 * llama (`preview`), que es quien tiene el compendio.
 */

import {
    DEFAULT_RACES, DEFAULT_CLASSES, GENDERS, validateHero, describeHero, buildHeroPrompt, cleanHeroAbout, classIcon,
    STAT_KEYS, SPREAD_POINTS, SPREAD_MAX, readStatBonus, spreadLeft, rollStatBonus,
} from '../campaign/hero.js';
import { BACKGROUNDS, guessBackground } from '../campaign/backgrounds.js';
import { resolveGender } from '../campaign/grammar.js';
import { SKILLS } from '../rules/checks.js';

/** @param {any} value */
const text = (value) => String(value ?? '').trim();

/** Las seis, en el orden de la ficha de D&D. */
const STATS = [
    ['strength', 'FUE'], ['dexterity', 'DES'], ['constitution', 'CON'],
    ['intelligence', 'INT'], ['wisdom', 'SAB'], ['charisma', 'CAR'],
];

/** Un icono por trasfondo. Sin arte: Font Awesome. */
const BACKGROUND_ICONS = {
    soldado: 'fa-shield', criminal: 'fa-mask', erudito: 'fa-book', acolito: 'fa-hands-praying',
    forastero: 'fa-compass', artesano: 'fa-hammer', noble: 'fa-crown', marinero: 'fa-anchor',
    charlatan: 'fa-masks-theater', ermitano: 'fa-leaf',
};

/**
 * El icono de una especie. Sin arte: Font Awesome.
 *
 * @param {string} name
 * @returns {string}
 */
function raceIcon(name) {
    const kind = text(name).toLowerCase();
    if (/elf/.test(kind)) return 'fa-leaf';
    if (/enan/.test(kind)) return 'fa-hammer';
    if (/median|halfl/.test(kind)) return 'fa-seedling';
    if (/gnom/.test(kind)) return 'fa-gears';
    if (/orc|orco/.test(kind)) return 'fa-hand-fist';
    if (/tiefl|tifl/.test(kind)) return 'fa-fire';
    if (/drac/.test(kind)) return 'fa-dragon';
    if (/sangre|nobl/.test(kind)) return 'fa-crown';
    return 'fa-user';
}

/**
 * @typedef {Object} PickOption
 * @property {string} name
 * @property {string} [what] Lo que da, en una línea: «+2 Fuerza, +4 Vida».
 * @property {string} [note] Una frase de qué es.
 * @property {string} [kit]  Con qué empieza, si es una clase.
 * @property {string} [icon]
 */

/**
 * Lo que llega del mundo, en una forma sola. Las listas de antes eran «Nombre — efectos»;
 * las de ahora, filas con cada cosa en su sitio. Valen las dos.
 *
 * @param {any} value
 * @returns {PickOption}
 */
function readOption(value) {
    if (typeof value === 'string') {
        const [name, what = ''] = value.split(' — ');
        return { name: text(name), what: text(what) };
    }
    return { name: text(value?.name), what: text(value?.what), note: text(value?.note), kit: text(value?.kit), icon: text(value?.icon) };
}

/**
 * Abre la creación de personaje. Devuelve lo respondido, o null si se vuelve atrás.
 *
 * @param {Object} input
 * @param {string} [input.worldName]
 * @param {Array<string|PickOption>} [input.races]   Las del mundo, si las tiene.
 * @param {Array<string|PickOption>} [input.classes]
 * @param {string} [input.premise] Cómo empieza la partida: el pasado tiene que encajar.
 * @param {string} [input.genre]
 * @param {((params: any) => Promise<string>)|null} [input.generate] La llamada al modelo,
 *        inyectada. Sin ella no hay varita: ni apagada, ni a la vista.
 * @param {((file: File) => Promise<string>)|null} [input.uploadFace] Sube una imagen y
 *        devuelve la ruta con la que el juego la puede pintar.
 * @param {(() => string)|null} [input.rollName] Un nombre del compendio. Sin batería de
 *        nombres no hay dado ni sugerencias.
 * @param {((answers: any) => ({stats: Record<string, number>, maxHp: number, armorClass: number, kit?: string}|null))|null} [input.preview]
 *        Los números que saldrían con lo elegido. Sin esto, los atributos no se enseñan.
 * @param {() => number} [input.random] Para los dados de las tarjetas.
 * @param {(() => Record<string, number>)|null} [input.rollStats] Tirar los atributos, con la
 *        semilla de la partida (J1.2). Sin esto se tira con `random`.
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any|null>}
 */
export async function openHeroCreator({
    worldName = '', races = [], classes = [], genre = '', premise = '',
    generate = null, uploadFace = null, rollName = null, preview = null, random = Math.random, rollStats = null,
    Popup, POPUP_TYPE,
}) {
    const raceOptions = (races.length > 0 ? races : DEFAULT_RACES).map(readOption).filter(o => o.name)
        .map(o => ({ ...o, icon: o.icon || raceIcon(o.name) }));
    const classOptions = (classes.length > 0 ? classes : DEFAULT_CLASSES).map(readOption).filter(o => o.name)
        .map(o => ({ ...o, icon: o.icon || classIcon(o.name) }));
    const skillLabel = (/** @type {string} */ skill) => SKILLS[/** @type {keyof typeof SKILLS} */ (skill)]?.label ?? skill;
    const backgroundOptions = Object.entries(BACKGROUNDS).map(([id, b]) => ({
        id,
        name: b.label,
        what: `Se le da bien: ${b.skills.map(skillLabel).join(' y ')}.`,
        note: b.contact,
        icon: /** @type {any} */ (BACKGROUND_ICONS)[id] ?? 'fa-scroll',
    }));

    const state = { name: '', gender: '', race: '', className: '', background: '', about: '', image: '' };
    // J1.2: repartir unos puntos o tirar, a elegir. Lo que se suma a la base.
    /** @type {Record<string, number>} */
    let statBonus = readStatBonus({});
    let statMode = 'spread';
    let rollsLeft = 0;
    const ROLLS = 3;
    let backgroundTouched = false;
    /** @type {any} */
    let popup = null;

    const root = $('<div class="hc-root"></div>');

    // Arriba: qué es esto y las dos salidas.
    const back = $('<button type="button" class="menu_button hc-back"></button>')
        .append('<i class="fa-solid fa-arrow-left"></i>').append($('<span></span>').text('Volver'));
    const enter = $('<button type="button" class="menu_button hc-enter"></button>')
        .append('<i class="fa-solid fa-check"></i>').append($('<span></span>').text('Entrar al mundo'));
    root.append($('<div class="hc-head"></div>')
        .append($('<div class="hc-heading"></div>')
            .append($('<p class="hc-kicker"></p>').text(worldName ? `Para entrar en ${worldName}` : 'Preparativos de campaña'))
            .append($('<h2 class="hc-title"></h2>').text('Crear personaje')))
        .append($('<div class="hc-head-actions"></div>').append(back, enter)));

    const layout = $('<div class="hc-layout"></div>');
    const left = $('<div class="hc-left"></div>');
    const right = $('<div class="hc-right"></div>');
    layout.append(left, right);
    root.append(layout);

    const warning = $('<div class="hc-warning"></div>').hide();

    // --- Las tres tarjetas ---------------------------------------------------------
    const cards = $('<div class="hc-cards"></div>');
    left.append(cards);

    /**
     * Una tarjeta de elección. Vacía dice «Elegir…» en gris; elegida, lo elegido y lo que da.
     *
     * @param {string} pick
     * @param {string} label
     * @param {string} empty
     * @param {() => Array<PickOption & {id?: string}>} options
     * @param {(option: (PickOption & {id?: string})|null) => void} onPick
     */
    const selectorCard = (pick, label, empty, options, onPick) => {
        const card = $('<div class="hc-card hc-card-empty"></div>').attr('data-pick', pick).attr('data-value', '');
        const value = $('<h3 class="hc-card-value"></h3>').text(empty);
        const what = $('<div class="hc-card-what"></div>');
        const choose = $('<button type="button" class="menu_button hc-pick"></button>')
            .append('<i class="fa-solid fa-list-ul"></i>').append($('<span></span>').text('Elegir'));
        const roll = $('<button type="button" class="menu_button hc-roll" title="Al azar"></button>').append('<i class="fa-solid fa-dice"></i>');
        card.append($('<span class="hc-card-label"></span>').text(label), value, what,
            $('<div class="hc-card-actions"></div>').append(choose, roll));

        const show = (/** @type {(PickOption & {id?: string})|null} */ option) => {
            card.toggleClass('hc-card-empty', !option).toggleClass('hc-card-filled', Boolean(option));
            card.attr('data-value', option ? (option.id ?? option.name) : '');
            value.text(option ? option.name : empty);
            // Lo que da. Con qué empieza ya sale debajo de los atributos.
            what.text(option ? text(option.what) : '');
            choose.find('span').text(option ? 'Cambiar' : 'Elegir');
            onPick(option);
        };
        choose.on('click', async () => {
            const picked = await openPicker({ title: label, options: options(), current: String(card.attr('data-value') || ''), Popup, POPUP_TYPE });
            if (picked) show(picked);
        });
        roll.on('click', () => {
            const list = options();
            if (list.length > 0) show(list[Math.floor(random() * list.length) % list.length]);
        });
        cards.append(card);
        return { show };
    };

    selectorCard('class', 'Clase', 'Elegir clase', () => classOptions, (o) => {
        state.className = o?.name ?? '';
        refresh();
    });
    selectorCard('race', 'Especie', 'Elegir especie', () => raceOptions, (o) => {
        state.race = o?.name ?? '';
        refresh();
    });
    const backgroundCard = selectorCard('background', 'Trasfondo', 'Elegir trasfondo', () => backgroundOptions, (o) => {
        state.background = o?.id ?? '';
        backgroundTouched = true;
        refresh();
    });

    // --- Los atributos --------------------------------------------------------------
    const stats = $('<div class="hc-stats hc-stats-waiting"></div>');
    stats.append($('<h4 class="hc-section-title"></h4>').text('Atributos'));
    // Repartir o tirar (J1.2). Lo de la clase y la especie ya va sumado.
    const spreadMode = $('<button type="button" class="hc-mode is-on" data-mode="spread"></button>').text(`Repartir ${SPREAD_POINTS} puntos`);
    const rollMode = $('<button type="button" class="hc-mode" data-mode="roll"></button>')
        .append('<i class="fa-solid fa-dice"></i>').append($('<span></span>').text('Tirar los dados'));
    const modeNote = $('<span class="hc-mode-note"></span>');
    const reroll = $('<button type="button" class="hc-mode hc-reroll"></button>').hide();
    stats.append($('<div class="hc-stat-modes"></div>').append(spreadMode, rollMode, modeNote, reroll));
    const grid = $('<div class="hc-stat-grid"></div>');
    for (const [key, short] of STATS) {
        const minus = $('<button type="button" class="hc-adjust" data-step="-1" aria-label="Quitar un punto"></button>').text('−');
        const plus = $('<button type="button" class="hc-adjust" data-step="1" aria-label="Poner un punto"></button>').text('+');
        grid.append($('<div class="hc-stat"></div>').attr('data-stat', key)
            .append($('<span class="hc-stat-name"></span>').text(short))
            .append($('<span class="hc-stat-val"></span>').text('10'))
            .append($('<span class="hc-stat-mod hc-mod-zero"></span>').text('+0'))
            .append($('<span class="hc-stat-adjust"></span>').append(minus, plus)));
    }
    stats.append(grid);
    const totals = $('<div class="hc-totals"></div>');
    const hpBox = $('<div class="hc-total" data-total="hp"></div>').append($('<span class="hc-total-name"></span>').text('Vida'), $('<strong></strong>').text('—'));
    const acBox = $('<div class="hc-total" data-total="ac"></div>').append($('<span class="hc-total-name"></span>').text('Armadura'), $('<strong></strong>').text('—'));
    totals.append(hpBox, acBox);
    const kitLine = $('<div class="hc-kit"></div>');
    const statsHint = $('<p class="hc-stats-hint"></p>').text('Elige clase y especie para ver tus números.');
    stats.append(totals, kitLine, statsHint);
    left.append(stats);

    // J1.4: el guion puede traer «si subes {entero|entera}»; se lee con lo que elijas abajo.
    const premiseText = $('<div class="hc-premise-text"></div>');
    const showPremise = () => premiseText.text(resolveGender(text(premise), { heroe: state.gender }));
    if (text(premise)) {
        showPremise();
        left.append($('<div class="hc-premise"></div>')
            .append($('<span class="hc-card-label"></span>').text('Así empieza tu historia'))
            .append(premiseText));
    }

    // --- Quién eres ------------------------------------------------------------------
    const portrait = $('<div class="hc-portrait"></div>');
    const face = $('<img class="hc-face-preview" alt="" />').hide();
    const placeholder = $('<i class="fa-solid fa-user hc-portrait-placeholder"></i>');
    const faceFile = $('<input type="file" class="hc-face-file" accept="image/*" />');
    const faceValue = $('<input type="hidden" class="hc-face" />');
    const faceButton = $('<button type="button" class="menu_button hc-face-btn" title="Buscar una imagen en el disco"></button>')
        .append('<i class="fa-solid fa-folder-open"></i>');
    portrait.append(face, placeholder, $('<div class="hc-portrait-controls"></div>').append(faceButton), faceFile, faceValue);
    if (!uploadFace) faceButton.hide();
    right.append(portrait);

    const idBox = $('<div class="hc-idbox"></div>');
    right.append(idBox);

    const nameInput = $('<input type="text" class="text_pole hc-input hc-name" maxlength="60" />')
        .attr('placeholder', 'Lyra, Brand, la que no dice su nombre…');
    idBox.append($('<label class="hc-group"></label>')
        .append($('<span class="hc-card-label"></span>').text('Nombre'))
        .append(nameInput));

    // Sugerencias: dos nombres del compendio y un dado que trae otros dos. Quedarse en
    // blanco delante del primer campo es donde mucha gente cierra la ventana.
    if (rollName) {
        const chips = $('<div class="hc-suggestions"></div>');
        const fill = () => {
            chips.find('.hc-suggested').remove();
            for (let i = 0; i < 2; i++) {
                const rolled = text(rollName());
                if (!rolled) continue;
                chips.append($('<button type="button" class="hc-suggestion hc-suggested"></button>').text(rolled)
                    .on('click', () => { nameInput.val(rolled).trigger('input'); }));
            }
        };
        const dice = $('<button type="button" class="hc-suggestion hc-dice" title="Otros dos nombres"></button>')
            .append('<i class="fa-solid fa-dice"></i>')
            .on('click', fill);
        chips.append(dice);
        idBox.append($('<div class="hc-group"></div>')
            .append($('<span class="hc-card-label"></span>').text('Sugerencias'))
            .append(chips));
        fill();
    }

    // Cómo te presentas: decide si el texto dice «cansado» o «cansada».
    const genders = $('<div class="hc-genders"></div>');
    for (const gender of GENDERS) {
        genders.append($('<button type="button" class="hc-gender"></button>').attr('data-value', gender).text(gender)
            .on('click', function () {
                const again = state.gender === gender;
                state.gender = again ? '' : gender;
                genders.find('.hc-gender').removeClass('is-on');
                if (!again) $(this).addClass('is-on');
                showPremise();
            }));
    }
    idBox.append($('<div class="hc-group"></div>')
        .append($('<span class="hc-card-label"></span>').text('Cómo te presentas'))
        .append(genders));

    const aboutInput = $('<textarea class="text_pole hc-input hc-about" rows="4" maxlength="600"></textarea>')
        .attr('placeholder', 'De dónde vienes, qué se te da bien, qué callas.');
    const aboutGroup = $('<label class="hc-group hc-about-group"></label>')
        .append($('<span class="hc-card-label"></span>').text('Quién eres'))
        .append(aboutInput);
    // La varita, dentro del campo. Lo escrito no es un borrador que pulir, es un encargo:
    // «algo triste sobre su pobreza» y te devuelve la ficha escrita. Sin modelo, no está.
    const wand = generate
        ? $('<button type="button" class="hc-wand" title="Escribe qué quieres —«algo triste sobre su pobreza»— y lo redacta"></button>')
            .append('<i class="fa-solid fa-wand-magic-sparkles"></i>')
        : null;
    if (wand) {
        aboutGroup.addClass('hc-has-wand').append(wand);
        aboutInput.attr('placeholder', 'De dónde vienes, qué se te da bien, qué callas. O pídeselo a la varita: «algo triste sobre su pobreza».');
    }
    idBox.append(aboutGroup, warning);

    // --- Lo que se mueve al elegir ---------------------------------------------------
    function answers() {
        return {
            name: text(nameInput.val()),
            gender: state.gender,
            race: state.race,
            className: state.className,
            about: text(aboutInput.val()),
            image: state.image,
            background: state.background,
            statBonus: { ...statBonus },
        };
    }

    /** Lo de repartir o tirar, dicho y con sus botones como tocan. */
    function showModes() {
        spreadMode.toggleClass('is-on', statMode === 'spread');
        rollMode.toggleClass('is-on', statMode === 'roll');
        grid.toggleClass('hc-spreading', statMode === 'spread');
        if (statMode === 'spread') {
            const left = spreadLeft(statBonus);
            modeNote.text(left > 0 ? `Te ${left === 1 ? 'queda 1' : `quedan ${left}`}` : 'Repartidos');
            reroll.hide();
            for (const key of STAT_KEYS) {
                const box = grid.find(`[data-stat="${key}"]`);
                box.find('[data-step="1"]').prop('disabled', left === 0 || statBonus[key] >= SPREAD_MAX);
                box.find('[data-step="-1"]').prop('disabled', statBonus[key] <= 0);
            }
        } else {
            modeNote.text('');
            reroll.text(rollsLeft > 0 ? `Tirar otra vez (${rollsLeft})` : 'Sin más tiradas').prop('disabled', rollsLeft === 0).show();
        }
        for (const key of STAT_KEYS) {
            grid.find(`[data-stat="${key}"]`).toggleClass('hc-stat-up', statBonus[key] > 0).toggleClass('hc-stat-down', statBonus[key] < 0);
        }
    }

    const roll = () => {
        statBonus = readStatBonus(rollStats ? rollStats() : rollStatBonus(random));
        rollsLeft = Math.max(0, rollsLeft - 1);
    };
    spreadMode.on('click', () => {
        if (statMode === 'spread') return;
        statMode = 'spread';
        statBonus = readStatBonus({});
        refresh();
    });
    rollMode.on('click', () => {
        if (statMode === 'roll') return;
        statMode = 'roll';
        rollsLeft = ROLLS;
        roll();
        refresh();
    });
    reroll.on('click', () => {
        if (rollsLeft <= 0) return;
        roll();
        refresh();
    });
    grid.on('click', '.hc-adjust', function () {
        if (statMode !== 'spread') return;
        const key = String($(this).closest('.hc-stat').attr('data-stat'));
        const step = Number($(this).attr('data-step'));
        const next = { ...statBonus, [key]: statBonus[key] + step };
        if (step > 0 && (spreadLeft(statBonus) === 0 || next[key] > SPREAD_MAX)) return;
        if (step < 0 && next[key] < 0) return;
        statBonus = readStatBonus(next);
        refresh();
    });

    function refresh() {
        const now = answers();
        enter.prop('disabled', !(now.name && now.className));
        placeholder.attr('class', `fa-solid ${now.className ? classIcon(now.className) : 'fa-user'} hc-portrait-placeholder`);

        const numbers = (now.className || now.race) && preview ? preview(now) : null;
        stats.toggleClass('hc-stats-waiting', !numbers);
        statsHint.toggle(!numbers);
        showModes();
        if (!numbers) return;
        for (const [key] of STATS) {
            const value = Math.round(Number(numbers.stats?.[key]) || 10);
            const mod = Math.floor((value - 10) / 2);
            const box = grid.find(`[data-stat="${key}"]`);
            box.find('.hc-stat-val').text(String(value));
            box.find('.hc-stat-mod').text(`${mod >= 0 ? '+' : ''}${mod}`)
                .toggleClass('hc-mod-zero', mod === 0).toggleClass('hc-mod-down', mod < 0);
        }
        hpBox.find('strong').text(`${Math.round(Number(numbers.maxHp) || 0)} PG`);
        acBox.find('strong').text(`${Math.round(Number(numbers.armorClass) || 10)} CA`);
        kitLine.text(text(numbers.kit));
    }

    nameInput.on('input change', refresh);
    aboutInput.on('input change', () => {
        if (backgroundTouched) return;
        const guess = guessBackground(text(aboutInput.val()));
        const option = backgroundOptions.find(o => o.id === guess);
        if (option && option.id !== state.background) {
            backgroundCard.show(option);
            // Propuesto, no elegido: lo que escribas después lo puede cambiar.
            backgroundTouched = false;
        }
    });

    faceButton.on('click', () => faceFile.trigger('click'));
    // Se sube al elegirla y no al guardar: si falla, te enteras mientras puedes cambiarla.
    faceFile.on('change', async () => {
        const file = /** @type {any} */ (faceFile[0])?.files?.[0];
        if (!file || !uploadFace) return;
        try {
            const path = await uploadFace(file);
            state.image = path;
            faceValue.val(path);
            face.attr('src', path).show();
            placeholder.hide();
        } catch (error) {
            console.error('[hero] could not upload the face', error);
            warning.text('No se pudo guardar esa imagen. Puedes seguir sin cara.').show();
        }
    });

    wand?.on('click', async () => {
        if (!generate) return;
        wand.prop('disabled', true).addClass('is-busy');
        try {
            const { systemPrompt, prompt } = buildHeroPrompt({ ...answers(), about: text(aboutInput.val()) },
                { worldName, genre, premise: resolveGender(premise, { heroe: state.gender }) });
            const answer = await generate({ prompt, systemPrompt, responseLength: 300 });
            const written = cleanHeroAbout(String(answer ?? ''));
            if (written) aboutInput.val(written).trigger('change');
            else warning.text('El modelo no devolvió nada. Prueba a decirle algo más concreto.').show();
        } catch (error) {
            console.error('[hero] the wand failed', error);
            warning.text('No se pudo escribir: mira que haya un proveedor conectado.').show();
        } finally {
            wand.prop('disabled', false).removeClass('is-busy');
        }
    });

    /** @type {number} */
    let result = 0;
    back.on('click', () => { void popup?.completeCancelled(); });
    enter.on('click', () => {
        const problems = validateHero(answers());
        if (!state.className) problems.push('Elige una clase: es lo que sabes hacer.');
        if (problems.length > 0) {
            warning.text(problems.join(' ')).show();
            return;
        }
        result = 1;
        void popup?.completeCancelled();
    });

    refresh();
    popup = new Popup(root[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, large: true, allowVerticalScrolling: true });
    await popup.show();
    if (result !== 1) return null;

    const hero = answers();
    console.log('[hero] created', describeHero(hero));
    return hero;
}

/**
 * El selector de una tarjeta: una rejilla de opciones que dicen lo que dan. Devuelve la
 * elegida, o null si se cierra.
 *
 * Es una ventana encima de la de crear personaje: queda por encima de todo lo demás.
 *
 * @param {Object} input
 * @param {string} input.title
 * @param {Array<PickOption & {id?: string}>} input.options
 * @param {string} input.current
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<(PickOption & {id?: string})|null>}
 */
async function openPicker({ title, options, current, Popup, POPUP_TYPE }) {
    const body = $('<div class="hc-picker"></div>');
    body.append($('<h3 class="hc-picker-title"></h3>').text(`Elegir ${title.toLowerCase()}`));
    const grid = $('<div class="hc-options"></div>');
    /** @type {any} */
    let popup = null;
    /** @type {(PickOption & {id?: string})|null} */
    let chosen = null;
    for (const option of options) {
        const value = option.id ?? option.name;
        const tile = $('<button type="button" class="hc-option"></button>')
            .attr('data-value', value)
            .attr('aria-label', [option.name, option.what, option.note].filter(Boolean).join('. '))
            .toggleClass('is-current', value === current)
            .append($('<i class="fa-solid hc-option-icon"></i>').addClass(option.icon || 'fa-user'))
            .append($('<div class="hc-option-name"></div>').text(option.name));
        if (option.what) tile.append($('<div class="hc-option-what"></div>').text(option.what));
        if (option.note) tile.append($('<div class="hc-option-note"></div>').text(option.note));
        if (option.kit) tile.append($('<div class="hc-option-kit"></div>').text(option.kit));
        tile.on('click', () => {
            chosen = option;
            void popup?.completeCancelled();
        });
        grid.append(tile);
    }
    body.append(grid);
    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: 'Cerrar', wide: true, allowVerticalScrolling: true });
    await popup.show();
    return chosen;
}
