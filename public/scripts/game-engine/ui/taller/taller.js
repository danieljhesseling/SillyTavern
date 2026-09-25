/**
 * El taller de campanas: la puerta de tres caminos y los pasos.
 *
 * Sustituye al asistente de siempre **sin tocar nada de lo que hay debajo**: devuelve el
 * mismo objeto de respuestas que `createCampaign` ya sabe comerse, asi que crear la campana
 * sigue pasando por donde pasaba. Mientras el taller crece de dos pasos a trece, lo de abajo
 * no cambia ni una linea.
 *
 * Aqui solo esta lo que **hay que saber de esta pantalla**: como se abre, que datos se leen y
 * en que orden. Lo que decide si se puede pasar de paso esta en `campaign/taller.js`, y como
 * se dibuja un paso, en `paso.js`. Tres archivos y cada uno una cosa.
 *
 * Ver wiki/ROADMAP_CREACION.md, T1.
 */

import {
    startTaller, walkableSteps, progressOf, goNext, goBack, writeField, reroll,
    pickCard, pickedIn, isPicked, blocksNext, toAnswers,
    addLocation, editLocation, removeLocation, locationsOf, proposeLocations,
    addBoard, editBoard, removeBoard,
    addFaction, editFaction, removeFaction, factionsOf,
    addPerson, editPerson, removePerson, peopleOf,
    addQuest, editQuest, removeQuest, questsOf, boardRulesOf, setBoardRules,
    PACK_STEPS, packContents,
} from '../../campaign/taller.js';
import { drawStep } from './paso.js';
import { getTemplateOptions } from '../../campaign/starter-templates.js';
import { uniqueWorldName } from '../../campaign/campaign-worlds.js';
import { VERBOSITY, DEFAULT_VERBOSITY } from '../../campaign/narrator.js';
import { MORTALITY, SAVES, DEFAULT_SURVIVAL, DIFFICULTIES, difficultyOf } from '../../rules/mortality.js';
import { GOALS, describeStanding, STANDING } from '../../campaign/factions.js';
import { racesOf, kindsOf, describeKin } from '../../compendio/kin.js';
import { rollFactions } from '../../campaign/factions.js';
import { writeVillage } from '../../compendio/people.js';
import { createSeededRandom } from '../../combat/seeded-random.js';
import { derive } from '../../campaign/seed.js';
import { isShareCode, readShareCode } from '../../campaign/share-code.js';
import { nameAndAbility, asAbility } from '../../compendio/skills.js';

/** Como se llama cada forma de tablero, para no ensenar `rooms` a quien juega. */
const SHAPE_LABELS = {
    rooms: 'Salas y pasillos',
    cave: 'Cueva',
    camp: 'Campo abierto',
    temple: 'Templo',
};

/** Para que existe una faccion, dicho para quien juega y no para el motor. */
const GOAL_LABELS = {
    '': 'Nada por ahora',
    encontrar: 'Encontrar algo',
    conquistar: 'Quedarse con un sitio',
    recuperar: 'Recuperar lo que fue suyo',
    destruir: 'Acabar con otra facción',
    controlar: 'Controlar un camino',
};

/** Y lo que ocupa. */
const SIZE_LABELS = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' };

/** Donde viven los mundos y los narradores hechos. Datos, no codigo. */
const MUNDOS = '/mundos/mundos.json';
const NARRADORES = '/mundos/narradores.json';

/**
 * @param {any} value
 * @returns {string}
 */
function text(value) {
    return String(value ?? '').trim();
}

/**
 * Leer un archivo de datos, sin que un fallo cierre la pantalla.
 *
 * @param {string} url
 * @returns {Promise<any>}
 */
async function read(url) {
    try {
        const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`[taller] no se pudo leer ${url}`, error);
        return null;
    }
}

/**
 * La puerta: por donde se empieza.
 *
 * Tres tarjetas grandes y nada mas. La pregunta que contesta —«¿escribo yo o juego ya?»— es
 * la unica que hay que hacer antes de saber nada del mundo.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<string>} El camino, o '' si se cierra.
 */
export async function askPath({ Popup, POPUP_TYPE }) {
    /** @type {string} */
    let chosen = '';

    const root = $('<div class="tl-door"></div>');
    root.append($('<div class="tl-door-title"></div>').text('Una campaña nueva'));
    root.append($('<div class="tl-door-hint"></div>').text(
        'Los tres llevan al mismo sitio. Lo que cambia es cuánto viene escrito ya.',
    ));

    const doors = [
        {
            id: 'cero', icon: 'fa-pen-nib', title: 'Crea tu mundo desde cero',
            note: 'Lo escribes tú, paso a paso. Lo que no escribas lo decide la semilla.',
        },
        {
            id: 'mundo', icon: 'fa-earth-europe', title: 'Mundos precreados',
            note: 'Cuatro mundos hechos. Eliges uno y ya estás jugando; luego cambias lo que quieras.',
        },
        {
            id: 'libro', icon: 'fa-book-open', title: 'Importa un libro',
            note: 'Pega el JSON que te ha dado tu Gem. Se comprueba antes de crear nada.',
        },
    ];

    const grid = $('<div class="tl-door-grid"></div>');
    for (const door of doors) {
        const card = $('<button type="button" class="tl-door-card"></button>')
            .append(`<i class="fa-solid ${door.icon}"></i>`)
            .append($('<div class="tl-door-card-title"></div>').text(door.title))
            .append($('<div class="tl-door-card-note"></div>').text(door.note));
        card.on('click', () => {
            chosen = door.id;
            popup.completeAffirmative();
        });
        grid.append(card);
    }
    root.append(grid);

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', { okButton: 'Cancelar', wide: true });
    await popup.show();
    return chosen;
}

/**
 * Pedir el paquete de un libro, y comprobarlo antes de seguir.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @returns {Promise<any>} El paquete, o null.
 */
async function askPack({ Popup, POPUP_TYPE }) {
    const root = $('<div class="tl-pack"></div>');
    root.append($('<div class="tl-step-hint"></div>').text(
        'Pega aquí el JSON que te ha dado tu Gem. Se comprueba antes de crear nada: si algo '
        + 'está mal, se dice qué y dónde.',
    ));
    const box = $('<textarea class="text_pole tl-pack-box cw-import-text" rows="12" '
        + 'placeholder="{ &quot;version&quot;: 1, ... }"></textarea>');
    const check = $('<button type="button" class="menu_button cw-import-check"></button>')
        .append('<i class="fa-solid fa-circle-check"></i>')
        .append($('<span></span>').text(' Comprobar el paquete'));
    const report = $('<div class="tl-pack-report cw-import-report"></div>').hide();
    root.append(box).append(check).append(report);

    /** @type {any} */
    let parsed = null;

    /**
     * Lo que trae y lo que le pasa. Decir «JSON invalido» y callarse es lo que hace que
     * alguien tenga que adivinar; esto dice el sitio y el motivo, uno por linea.
     *
     * @param {any} found
     * @param {string} [parseError]
     */
    function show(found, parseError) {
        report.empty().show();

        if (parseError) {
            report.append($('<div class="cw-import-bad"></div>')
                .text(`Eso no es JSON válido: ${parseError}`));
            return;
        }
        if (!found) return;

        const c = found.counts;
        report.append($('<div class="cw-import-counts"></div>').text(
            `${c.world || 'Sin nombre'} - ${c.locations} localidades, ${c.boards} tableros, `
            + `${c.enemies} enemigos, ${c.confidants} companeros, ${c.quests} misiones, `
            + `${c.objectives} objetivos.`));

        /**
         * @param {string} cls
         * @param {string} title
         * @param {any[]} issues
         */
        const listOf = (cls, title, issues) => {
            if (!Array.isArray(issues) || issues.length === 0) return;
            const block = $(`<div class="cw-import-list ${cls}"></div>`);
            block.append($('<div class="cw-import-list-title"></div>').text(`${title} (${issues.length})`));
            const list = $('<ul></ul>');
            // Bastantes para actuar, no tantas que la primera util se vaya de la pantalla.
            for (const issue of issues.slice(0, 12)) {
                list.append($('<li></li>')
                    .append($('<code></code>').text(text(issue.path)))
                    .append(document.createTextNode(` ${text(issue.message)}`)));
            }
            if (issues.length > 12) list.append($('<li></li>').text(`… y ${issues.length - 12} más.`));
            block.append(list);
            report.append(block);
        };

        listOf('cw-import-bad', 'Hay que arreglarlo antes de importar', found.errors);
        listOf('cw-import-warn', 'Avisos', found.warnings);
        listOf('cw-import-fixed', 'Reparado al leerlo', found.repairs);

        report.append($('<div class="cw-import-verdict"></div>')
            .toggleClass('ok', Boolean(found.ok))
            .text(found.ok
                ? 'El paquete se puede importar.'
                : 'El paquete no se puede importar todavia.'));
    }

    check.on('click', async () => {
        parsed = null;
        const raw = String(box.val() ?? '').trim();
        if (!raw) {
            show(null, 'está vacío');
            return;
        }

        /** @type {any} */
        let candidate = null;
        try {
            candidate = JSON.parse(raw);
        } catch (error) {
            show(null, String(error?.message || error));
            return;
        }

        const { validatePack } = await import('../../campaign/campaign-pack.js');
        const found = validatePack(candidate);
        show(found);
        if (found.ok) parsed = candidate;
    });

    const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Usar este libro', cancelButton: 'Cancelar', wide: true, large: true,
        allowVerticalScrolling: true,
    });

    const ok = await popup.show();
    // Sin comprobar no se importa: el boton de aceptar no puede saltarse la comprobacion.
    return ok && parsed ? parsed : null;
}

/**
 * El taller entero.
 *
 * @param {Object} input
 * @param {any} input.Popup
 * @param {any} input.POPUP_TYPE
 * @param {string[]} [input.existingWorldNames]
 * @param {((key: string, state: any) => Promise<string>)|null} [input.write] El lapicito.
 * @param {((idea: string, partySize: number) => Promise<any>)|null} [input.makeWorld] Que lo
 *        escriba el modelo. Sin proveedor no se pasa, y la tarjeta no aparece.
 * @param {any[]} [input.narrators] Los que ya tienes escritos de otras campanas.
 * @param {((file: any) => Promise<string>)|null} [input.uploadFace] Guardar una imagen.
 * @returns {Promise<any>} Las respuestas que `createCampaign` espera, o null.
 */
export async function askTaller({
    Popup, POPUP_TYPE, existingWorldNames = [], write = null, makeWorld = null,
    narrators = [], uploadFace = null,
}) {
    const path = await askPath({ Popup, POPUP_TYPE });
    if (!path) return null;

    /** @type {any} */
    let source = null;
    if (path === 'libro') {
        const pack = await askPack({ Popup, POPUP_TYPE });
        if (!pack) return null;
        // El nombre del mundo sigue al paquete, igual que sigue a una plantilla. Sin esto
        // el paso 1 llegaba en blanco y no dejaba pasar.
        source = {
            pack,
            metadata: pack?.metadata ?? {},
            templateId: 'imported',
            displayName: uniqueWorldName(
                String(pack?.world?.name ?? pack?.metadata?.displayName ?? '').trim(),
                existingWorldNames,
            ),
            genre: String(pack?.world?.genre ?? '').trim(),
            description: String(pack?.world?.synopsis ?? pack?.world?.description ?? '').trim(),
        };
    }

    const [mundos, narradores] = await Promise.all([read(MUNDOS), read(NARRADORES)]);
    const worlds = Array.isArray(mundos?.worlds) ? mundos.worlds : [];
    const voices = Array.isArray(narradores?.narrators) ? narradores.narrators : [];
    // Los que ya tienes escritos: un narrador de otra campana sirve para esta.
    const mine = (Array.isArray(narrators) ? narrators : []).filter(v => text(v?.name));

    let state = startTaller({ path, source });

    const root = $('<div class="tl-root"></div>');
    const bar = $('<div class="tl-bar"></div>');
    const body = $('<div class="tl-body"></div>');
    const foot = $('<div class="tl-foot"></div>');
    const said = $('<div class="tl-said"></div>');

    const back = $('<button type="button" class="menu_button tl-back"></button>').text('Atrás');
    const skip = $('<button type="button" class="menu_button tl-skip"></button>').text('Saltar');
    const next = $('<button type="button" class="menu_button tl-next"></button>').text('Siguiente');
    // La segunda salida, como en el asistente de siempre: crear y caer con el editor
    // delante. Solo en el ultimo paso, porque antes de eso no hay nada que crear.
    const write2 = $('<button type="button" class="menu_button tl-write"></button>')
        .append('<i class="fa-solid fa-feather"></i>')
        .append($('<span></span>').text(' Crear y escribir el mundo'));
    foot.append(back).append(said).append(skip).append(write2).append(next);
    root.append(bar).append(body).append(foot);

    /** El narrador elegido de la lista, para poder volver a enseñarlo. */
    let voice = null;

    /** El mundo que ha escrito el modelo, si se ha pedido. */
    /** @type {any} */
    let made = null;

    /** La biblioteca, para lo que se reparte mas tarde. */
    /** @type {any} */
    let library = null;

    /** Que tarjeta esta abierta en cada paso. Es de la pantalla, no del mundo. */
    const editing = {
        localidades: '', tableros: '', facciones: '',
        habilidades: '', razas: '', clases: '', personajes: '', misiones: '',
    };

    /** Las filas de cada paso que se elige de una lista. */
    const catalogues = { habilidades: [], razas: [], clases: [], objetos: [], bestiario: [] };

    /** Los tipos de sitio del compendio, para el desplegable del paso 3. */
    let placeTypes = [];

    /**
     * Como se llama un tipo, para no ensenar `tipo-aldea` a quien juega.
     *
     * @param {string} id
     * @returns {string}
     */
    const typeName = (id) => text(placeTypes.find(t => text(t.id) === text(id))?.name);

    /**
     * Con que forma nace un tablero de ese sitio: lo dice el tipo, que para eso lo trae.
     *
     * @param {any} place
     * @returns {string}
     */
    const shapeFor = (place) =>
        text(placeTypes.find(t => text(t.id) === text(place?.type))?.shape) || 'rooms';

    /**
     * Una fila de texto suelta, para los formularios que no pasan por `drawStep`.
     *
     * @param {string} label
     * @param {string} value
     * @param {(value: string) => void} onWrite
     * @param {() => void} [onDone]
     * @returns {JQuery}
     */
    function fieldRow(label, value, onWrite, onDone) {
        const row = $('<div class="tl-field"></div>');
        row.append($('<div class="tl-field-head"></div>')
            .append($('<label class="tl-label"></label>').text(label)));
        const input = $('<input type="text" class="text_pole tl-input">').val(value);
        input.on('input', () => onWrite(String(input.val() ?? '')));
        input.on('change', () => { if (onDone) onDone(); });
        return row.append(input);
    }

    /**
     * Un desplegable suelto.
     *
     * @param {string} label
     * @param {string} value
     * @param {Record<string, string>} options
     * @param {(value: string) => void} onWrite
     * @returns {JQuery}
     */
    function choiceRow(label, value, options, onWrite) {
        const row = $('<div class="tl-field"></div>');
        row.append($('<div class="tl-field-head"></div>')
            .append($('<label class="tl-label"></label>').text(label)));
        const select = $('<select class="text_pole tl-input"></select>');
        for (const [id, said] of Object.entries(options)) {
            select.append($('<option></option>').attr('value', id).text(said));
        }
        select.val(value);
        select.on('change', () => onWrite(String(select.val() ?? '')));
        return row.append(select);
    }

    /** Crear ya, cayendo con el editor del mundo delante. */
    const finishWriting = () => {
        const stuck = blocksNext(state, progressOf(state).step.id);
        if (stuck) {
            said.text(stuck).addClass('bad');
            return;
        }
        state = { ...state, writeWorld: true };
        popup.completeAffirmative();
    };

    const advance = () => {
        const moved = goNext(state);
        if (moved.reason) {
            said.text(moved.reason).addClass('bad');
            return;
        }
        said.text('').removeClass('bad');
        if (moved.done) {
            popup.completeAffirmative();
            return;
        }
        state = moved.state;
        draw();
    };

    function draw() {
        const { at, of, step } = progressOf(state);

        bar.empty();
        bar.append($('<div class="tl-bar-said"></div>').text(`Paso ${at} de ${of} · ${step.title}`));
        const fill = $('<div class="tl-bar-track"></div>');
        fill.append($('<div class="tl-bar-fill"></div>').css('width', `${Math.round((at / of) * 100)}%`));
        bar.append(fill);

        if (state.path === 'mundo' && state.source?.pack && PACK_STEPS.includes(step.id)) drawCarried(step);
        else if (step.id === 'mundo') drawWorld();
        else if (step.id === 'narrador') drawNarrator();
        else if (step.id === 'localidades') drawPlaces();
        else if (step.id === 'tableros') drawBoards();
        else if (step.id === 'facciones') drawFactions();
        else if (step.id === 'habilidades') drawPicks('habilidades');
        else if (step.id === 'razas') drawPicks('razas');
        else if (step.id === 'clases') drawPicks('clases');
        else if (step.id === 'objetos') drawPicks('objetos');
        else if (step.id === 'bestiario') drawPicks('bestiario');
        else if (step.id === 'personajes') drawPeople();
        else if (step.id === 'misiones') drawQuests();
        else drawPlay();

        back.prop('disabled', state.at === 0);
        skip.toggle(Boolean(step.optional));
        // Escribir el mundo se ofrece en cuanto **hay mundo que escribir**: con el paso 1
        // resuelto. Quien ya sabe lo que quiere no tiene que pasar por los trece.
        write2.toggle(blocksNext(state, 'mundo') === '');
        next.text(state.at >= walkableSteps().length - 1 ? 'Crear y jugar' : 'Siguiente');
    }

    /**
     * El sitio de partida se llama como el mundo, hasta que alguien lo cambie.
     *
     * Sin esto se quedaba con su nombre de relleno, y las facciones acababan llamandose
     * «Los de El primer sitio», que no lo escribe nadie.
     *
     * @returns {void}
     */
    function followWorldName() {
        const first = locationsOf(state)[0];
        if (!first?.fixed || first.touched) return;
        state = {
            ...state,
            locations: locationsOf(state).map(place => (place.id === first.id
                ? { ...place, name: text(state.fields.worldName) || place.name }
                : place)),
        };
    }

    /**
     * Pedirle al modelo que escriba el sitio de partida.
     *
     * Lo que devuelve **se ensena antes de crear nada**: el mapa, lo que ha reparado al
     * leerlo y lo que le falta. Un mundo generado que aparece ya hecho es un mundo que no
     * se puede corregir.
     *
     * @returns {Promise<void>}
     */
    async function askGenerated() {
        const root = $('<div class="tl-gen"></div>');
        root.append($('<div class="tl-step-hint"></div>').text(
            'Describe el mundo que quieres. Lo que salga se ensena antes de crear nada.',
        ));
        const idea = $('<textarea class="text_pole tl-input" rows="3" '
            + 'placeholder="una cripta inundada con cultistas"></textarea>');
        const go = $('<button type="button" class="menu_button tl-gen-go"></button>')
            .append('<i class="fa-solid fa-wand-magic-sparkles"></i>')
            .append($('<span></span>').text(' Construirlo'));
        const out = $('<div class="tl-gen-out"></div>').hide();
        root.append(idea).append(go).append(out);

        /** @type {any} */
        let built = null;

        go.on('click', async () => {
            const said = text(idea.val());
            if (!said) return;
            go.prop('disabled', true);
            out.empty().show().append($('<div class="tl-hint"></div>').text('Escribiendo…'));

            const result = await makeWorld(said, 2);
            go.prop('disabled', false);
            out.empty();

            for (const bad of (result?.errors ?? [])) {
                out.append($('<div class="tl-gen-bad"></div>').text(bad));
            }
            for (const warn of (result?.warnings ?? [])) {
                out.append($('<div class="tl-gen-warn"></div>').text(warn));
            }
            if (!result?.template) return;

            built = result.template;
            out.append($('<div class="tl-hint"></div>').text(
                `${text(built.name)} — ${text(built.locationName)}, ${text(built.boardName)}`,
            ));
            out.append($('<textarea class="text_pole tl-gen-map" rows="10" readonly></textarea>')
                .val((built.map ?? []).join('\n')));
        });

        const popup = new Popup(root, POPUP_TYPE.CONFIRM, '', {
            okButton: 'Usar este mundo', cancelButton: 'Cancelar', wide: true, large: true,
        });
        const ok = await popup.show();
        if (!ok || !built) return;

        made = built;
        state = pickCard(state, 'mundo', 'generated', true);
        if (!state.pinned?.worldName) {
            state.fields.worldName = uniqueWorldName(text(built.name), existingWorldNames);
        }
        draw();
    }

    /**
     * Lo que un mundo precreado marca en los demas pasos.
     *
     * Un mundo **no es un archivo de contenido aparte**: es una seleccion sobre las mismas
     * baterias. El de terror quita los elfos, y eso es lo que lo hace el de terror.
     *
     * Las habilidades salen solas de las clases marcadas: escribirlas otra vez en el
     * archivo del mundo seria escribir dos veces lo mismo, y es asi como dos listas acaban
     * diciendo cosas distintas.
     *
     * @param {any} world
     * @returns {void}
     */
    /**
     * Cargar el paquete de un mundo precreado, si lo trae, y comprobarlo.
     *
     * Un paquete roto no se lleva: el mundo se crea como siempre, desde su plantilla, y se
     * dice por que. Elegir otro mundo sin paquete suelta el anterior.
     *
     * @param {any} world
     * @returns {Promise<void>}
     */
    async function carryPack(world) {
        const url = text(world?.pack);
        if (!url) {
            if (state.source?.pack) state = { ...state, source: null };
            return;
        }

        said.text('Cargando el mundo…').removeClass('bad');
        const pack = await read(url);
        const { validatePack } = await import('../../campaign/campaign-pack.js');
        const found = pack ? validatePack(pack) : null;
        // Mientras cargaba, se ha podido elegir otro: entonces este ya no toca.
        if (!isPicked(state, 'mundo', text(world.id))) return;

        if (!found?.ok) {
            state = { ...state, source: null };
            const why = found?.errors?.[0]?.message ?? 'no se pudo leer';
            said.text(`El mundo escrito no se ha podido cargar (${why}): se crea desde su plantilla.`).addClass('bad');
            console.error('[taller] paquete del mundo', url, found?.errors ?? 'sin leer');
            draw();
            return;
        }

        state = { ...state, source: { pack, templateId: 'imported', metadata: pack.metadata ?? {} } };
        said.text('').removeClass('bad');
        draw();
    }

    /**
     * Un paso cuyo contenido trae el mundo escrito: se ensena lo que trae, no un formulario.
     *
     * @param {any} step
     */
    function drawCarried(step) {
        const names = packContents(state.source?.pack, step.id);
        drawStep(body, {
            title: step.title,
            hint: names.length > 0
                ? 'Este mundo los trae escritos. Se cambian después en /campana.'
                : 'Este mundo no trae ninguno escrito: saldrán jugando.',
            cardsTitle: `Lo que trae (${names.length})`,
            cardsOpen: true,
            cards: names.map((name, index) => ({
                id: `carried_${index}`, title: name, note: '', icon: 'fa-feather', picked: true,
            })),
            fields: [],
            onPick: () => {},
            onWrite: () => {},
        });
    }

    function applyWorld(world) {
        const picks = world?.picks ?? {};

        for (const which of ['razas', 'clases']) {
            const wanted = (Array.isArray(picks[which]) ? picks[which] : []).map(text);
            if (wanted.length === 0) continue;
            // Se reemplaza, no se suma: elegir otro mundo tiene que cambiar el mundo.
            state = { ...state, picked: { ...state.picked, [which]: wanted } };
        }

        const classes = new Set(pickedIn(state, 'clases'));
        if (classes.size > 0) {
            state = {
                ...state,
                picked: {
                    ...state.picked,
                    habilidades: (catalogues.habilidades ?? [])
                        .filter((/** @type {any} */ row) => {
                            const suyas = (row.when?.class ?? []).map(text);
                            // Lo que sabe cualquiera entra siempre: vendar, cubrirse, dar la voz.
                            return suyas.length === 0 || suyas.includes('*')
                                || suyas.some((/** @type {string} */ name) => classes.has(name));
                        })
                        .map((/** @type {any} */ row) => text(row.id)),
                },
            };
        }

        // Quien lo narra, cuanto duele perder y de que tira su tablon.
        const voz = voices.find(v => text(v.id) === text(world?.narrator));
        if (voz && !state.narrator) {
            state = pickCard(state, 'narrador', text(voz.id), true);
            state.narrator = {
                name: text(voz.name), personality: text(voz.personality),
                description: text(voz.description), greeting: text(voz.greeting),
                verbosity: text(voz.verbosity) || DEFAULT_VERBOSITY,
                image: text(voz.image),
            };
        }
        if (world?.survival && !state.survival) state.survival = { ...world.survival };
        if (world?.board) state = setBoardRules(state, world.board);
    }

    /** Paso 1: la ficha del mundo, y de donde sale. */
    function drawWorld() {
        /** @type {any[]} */
        let cards = [];
        if (state.path === 'cero') {
            cards = getTemplateOptions().map(option => ({
                id: option.id, title: option.name, note: option.description,
                icon: 'fa-map', picked: isPicked(state, 'mundo', option.id),
            }));
            // Y que lo escriba el modelo, si hay proveedor. Un boton que solo puede fallar
            // es peor que ningun boton.
            if (makeWorld) {
                cards.push({
                    id: 'generated',
                    title: made ? `Generado: ${text(made.name)}` : 'Generar con IA',
                    note: made
                        ? 'Lo que ha escrito el modelo. Pulsa otra vez para pedir otro.'
                        : 'Describe el mundo que quieres y lo construye.',
                    icon: 'fa-wand-magic-sparkles',
                    picked: isPicked(state, 'mundo', 'generated'),
                });
            }
        } else if (state.path === 'mundo') {
            cards = worlds.map(world => ({
                id: text(world.id), title: text(world.name), note: text(world.note),
                icon: text(world.icon) || 'fa-earth-europe', traits: world.traits,
                picked: isPicked(state, 'mundo', text(world.id)),
            }));
        } else {
            cards = [{
                id: 'libro', title: text(state.fields.worldName) || 'El libro que has pegado',
                note: 'Lo que traía el JSON. Puedes cambiarlo antes de crear nada.',
                icon: 'fa-book-open', picked: true,
            }];
        }

        // Idea 180: pegar un código de mundo en la semilla elige también de dónde parte.
        /** @type {(id: string) => void} */
        let pickWorld = () => {};
        drawStep(body, {
            title: 'El mundo',
            hint: 'Lo que el mundo es antes de que nadie entre en él.',
            cardsTitle: state.path === 'mundo' ? 'Los cuatro mundos' : 'Con qué sitio empieza',
            formTitle: 'La ficha',
            formOpen: pickedIn(state, 'mundo').length > 0,
            cards,
            fields: [
                {
                    key: 'worldName', label: 'Nombre', value: state.fields.worldName,
                    placeholder: 'Cómo se llama el mundo',
                    hint: existingWorldNames.includes(text(state.fields.worldName))
                        ? 'Ya tienes una campaña con ese nombre.' : '',
                },
                { key: 'genre', label: 'Género', value: state.fields.genre, placeholder: 'Terror, fantasía oscura…' },
                {
                    key: 'description', label: 'Sinopsis', value: state.fields.description, kind: 'area',
                    placeholder: 'Lo que es este sitio antes de que llegue nadie.',
                    hint: 'Viaja con la campaña: es lo que lee quien la importe.',
                    wand: true,
                },
                {
                    key: 'seed', label: 'Semilla', value: state.fields.seed, mono: true,
                    hint: state.path === 'mundo'
                        ? 'La de este mundo. Cámbiala si quieres otra versión del mismo sitio.'
                        : 'Lo que no escribas lo decide ella. Escribe la de alguien para jugar su mundo exacto.',
                },
            ],
            onPick: pickWorld = (id) => {
                if (id === 'generated') {
                    void askGenerated();
                    return;
                }
                state = pickCard(state, 'mundo', id, true);
                if (!isPicked(state, 'mundo', id)) { draw(); return; }

                // Elegir rellena la ficha, pero **nunca pisa lo que hayas escrito tú**: lo
                // que tocas se queda. Y propone un nombre libre, porque pedirlo en blanco
                // es pedir que te inventes uno antes de saber de qué va la cosa.
                const world = worlds.find(w => text(w.id) === id);
                const plantilla = getTemplateOptions().find(o => o.id === id);
                const traido = world
                    ? [['worldName', text(world.name)], ['genre', text(world.genre)],
                        ['description', text(world.synopsis)], ['seed', text(world.seed)]]
                    : [['worldName', text(plantilla?.name)]];

                for (const [key, value] of traido) {
                    if (!state.pinned?.[key] && text(value)) {
                        state.fields[key] = key === 'worldName'
                            ? uniqueWorldName(value, existingWorldNames)
                            : value;
                    }
                }
                if (world) applyWorld(world);
                // Elegir tambien pone nombre al mundo, asi que el sitio de partida lo sigue.
                followWorldName();
                draw();
                // Y si el mundo esta escrito entero, su paquete. Se carga despues de dibujar:
                // elegir no puede esperar a la red.
                void carryPack(world);
            },
            onWrite: (key, value) => {
                // Idea 180: «semilla@origen» pone la semilla y elige el mundo o la plantilla.
                if (key === 'seed' && isShareCode(value)) {
                    const code = readShareCode(value);
                    state = writeField(state, 'seed', code.seed);
                    if (cards.some(card => text(card.id) === code.origin) && !isPicked(state, 'mundo', code.origin)) pickWorld(code.origin);
                    else draw();
                    return;
                }
                state = writeField(state, key, value);
                if (key !== 'worldName') return;
                followWorldName();
                draw();
            },
            onWand: write ? (key) => write(key, state) : null,
        });

        // Volver a tirar: seguro, porque no puede borrar nada escrito a mano.
        const again = $('<button type="button" class="menu_button tl-reroll"></button>')
            .append('<i class="fa-solid fa-dice"></i>')
            .append($('<span></span>').text(' Volver a tirar la semilla'));
        again.on('click', () => { state = reroll(state); draw(); });
        body.append(again);
    }

    /** Paso 2: quien lo cuenta. */
    function drawNarrator() {
        const chosen = pickedIn(state, 'narrador')[0] ?? '';
        const cards = [
            { id: 'nuevo', title: 'Escribe el tuyo', note: 'Un narrador a tu medida.', add: true, picked: chosen === 'nuevo' },
            ...voices.map(v => ({
                id: text(v.id), title: text(v.name), note: text(v.note),
                icon: text(v.icon) || 'fa-comment', image: text(v.image),
                picked: chosen === text(v.id),
            })),
            // Y los que ya tienes: un narrador escrito para otra campana sirve para esta,
            // y volver a escribirlo seria escribirlo dos veces.
            ...mine.map(v => ({
                id: text(v.id), title: text(v.name), note: text(v.note) || 'De otra campaña.',
                icon: 'fa-user-pen', image: text(v.image),
                picked: chosen === text(v.id),
            })),
        ];

        const current = state.narrator ?? {};
        drawStep(body, {
            title: 'Quién lo cuenta',
            hint: 'Lo que escribas aquí llega al modelo en cada turno: es donde se decide el tono. '
                + 'Los números los sigue decidiendo el juego.',
            cardsTitle: 'Elige quién narra',
            cardsOpen: true,
            formTitle: 'Su ficha',
            formOpen: Boolean(chosen),
            cards,
            fields: chosen ? [
                { key: 'nName', label: 'Nombre', value: text(current.name), placeholder: 'Narrador' },
                {
                    key: 'nFace', label: 'Su cara', value: text(current.image), kind: 'file',
                    hint: 'Se busca en el disco. Es lo que se ve en cada mensaje suyo.',
                },
                {
                    key: 'nPersonality', label: 'Tono', value: text(current.personality), kind: 'area',
                    placeholder: 'Seco y preciso. No adorna.', wand: true,
                },
                {
                    key: 'nDescription', label: 'Qué sabe', value: text(current.description), kind: 'area',
                    placeholder: 'Opcional.', wand: true,
                },
                {
                    key: 'nGreeting', label: 'Con qué abre', value: text(current.greeting), kind: 'area',
                    placeholder: 'La primera frase de la campaña.', wand: true,
                },
                {
                    key: 'nVerbosity', label: 'Cuánto se extiende',
                    // Lo que no este en el vocabulario del motor cae en el de siempre: un
                    // desplegable en blanco no dice nada y no se puede arreglar mirandolo.
                    value: VERBOSITY[text(current.verbosity)] ? text(current.verbosity) : DEFAULT_VERBOSITY,
                    kind: 'choice',
                    options: Object.entries(VERBOSITY).map(([id, v]) => ({
                        id, label: text(/** @type {any} */ (v)?.label) || id,
                    })),
                },
            ] : [],
            onPick: (id) => {
                state = pickCard(state, 'narrador', id, true);
                const picked = pickedIn(state, 'narrador')[0] ?? '';
                if (!picked) {
                    state.narrator = null;
                } else {
                    voice = [...voices, ...mine].find(v => text(v.id) === picked) ?? null;
                    state.narrator = voice
                        ? {
                            name: text(voice.name), personality: text(voice.personality),
                            description: text(voice.description), greeting: text(voice.greeting),
                            verbosity: text(voice.verbosity) || DEFAULT_VERBOSITY,
                            // Con su cara: sin ella, la copia salia con la interrogacion.
                            image: text(voice.image),
                        }
                        : { name: '', personality: '', description: '', greeting: '', verbosity: DEFAULT_VERBOSITY };
                }
                draw();
            },
            onWrite: (key, value) => {
                state.narrator = state.narrator ?? {
                    name: '', personality: '', description: '', greeting: '', verbosity: DEFAULT_VERBOSITY,
                };
                const map = {
                    nName: 'name', nPersonality: 'personality', nDescription: 'description',
                    nGreeting: 'greeting', nVerbosity: 'verbosity', nFace: 'image',
                };
                const field = map[key];
                if (field) state.narrator[field] = text(value);
            },
            onWand: write ? (key) => write(key, state) : null,
            onFile: uploadFace,
        });
    }

    /**
     * Paso 3: los sitios a los que se puede ir.
     *
     * Llega con el de partida y con los que la semilla iba a poner sola al crear el mundo.
     * Ensenarlos **antes** es lo unico que permite cambiarlos: hasta ahora aparecian ya
     * hechos y no habia donde tocarlos.
     */
    function drawPlaces() {
        const places = locationsOf(state);
        const open = editing.localidades;

        const cards = [
            { id: 'nuevo', title: 'Otro sitio', note: 'Uno que te inventes tu.', add: true },
            ...places.map(place => ({
                id: text(place.id),
                title: text(place.name) || '(sin nombre)',
                note: [typeName(place.type), text(place.biome)].filter(Boolean).join(' - '),
                icon: place.fixed ? 'fa-flag' : 'fa-location-dot',
                picked: isPicked(state, 'localidades', text(place.id)),
            })),
        ];

        const place = places.find(p => text(p.id) === open) ?? null;

        drawStep(body, {
            title: 'Localidades',
            hint: 'Los sitios a los que se puede ir. La distancia se declara en dias: el mundo '
                + 'es una lista, no un tablero.',
            cardsTitle: 'Los sitios del mundo',
            // Aqui las tarjetas son el contenido: llegar y no verlas seria llegar a un
            // paso en blanco.
            cardsOpen: true,
            formTitle: place ? `El sitio: ${text(place.name) || 'sin nombre'}` : 'Pulsa un sitio para cambiarlo',
            formOpen: Boolean(place),
            cards,
            fields: place ? [
                { key: 'lName', label: 'Nombre', value: text(place.name), placeholder: 'Como se llama' },
                {
                    key: 'lType', label: 'Que clase de sitio es', value: text(place.type), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...placeTypes.map(t => ({
                        id: text(t.id), label: text(t.name),
                    }))],
                    hint: 'De aqui sale como se genera por dentro y que tiempo puede hacer.',
                },
                {
                    key: 'lBiome', label: 'Donde esta', value: text(place.biome),
                    placeholder: 'camino, montana, pantano...',
                },
                {
                    key: 'lNote', label: 'Que es', value: text(place.note), kind: 'area',
                    placeholder: 'Una frase.', wand: true,
                },
            ] : [],
            onPick: (id) => {
                if (id === 'nuevo') {
                    const made = addLocation(state, { name: '', touched: true });
                    state = made.state;
                    editing.localidades = made.id;
                    draw();
                    return;
                }
                // Pulsar el que ya estas mirando lo saca del mundo; pulsar otro lo abre.
                if (editing.localidades === id) state = pickCard(state, 'localidades', id);
                else editing.localidades = id;
                draw();
            },
            onWrite: (key, value) => {
                if (!place) return;
                const map = { lName: 'name', lType: 'type', lBiome: 'biome', lNote: 'note' };
                const field = map[key];
                if (!field) return;
                state = editLocation(state, place.id, { [field]: value });
                if (key !== 'lNote') draw();
            },
            onWand: write ? (key) => write(key, state) : null,
        });

        if (place && !place.fixed) {
            const drop = $('<button type="button" class="menu_button tl-drop"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .append($('<span></span>').text(' Quitar este sitio'));
            drop.on('click', () => {
                state = removeLocation(state, place.id);
                editing.localidades = '';
                draw();
            });
            body.append(drop);
        }
    }

    /**
     * Paso 4: los tableros, uno por sitio.
     *
     * Un acordeon por localidad, que es lo que hace que se entienda a que sitio pertenece
     * cada tablero sin tener que leerlo en el nombre.
     */
    function drawBoards() {
        body.empty();
        body.append($('<div class="tl-step-head"></div>')
            .append($('<div class="tl-step-title"></div>').text('Tableros'))
            .append($('<div class="tl-step-hint"></div>').text(
                'Donde se pelea. Cada uno pertenece a un sitio, y se genera con tu semilla '
                + 'al crear la campana.',
            )));

        const places = locationsOf(state)
            .filter(place => isPicked(state, 'localidades', text(place.id)));

        if (places.length === 0) {
            body.append($('<div class="tl-empty"></div>').text(
                'No hay ningun sitio en el mundo todavia. Vuelve al paso anterior.',
            ));
            return;
        }

        for (const place of places) {
            const fold = $('<div class="tl-fold open tl-place"></div>');
            const head = $('<button type="button" class="tl-fold-head"></button>')
                .append('<i class="fa-solid fa-chevron-down tl-fold-arrow"></i>')
                .append($('<span></span>').text(`${text(place.name) || '(sin nombre)'} - `
                    + `${place.boards.length} tablero(s)`));
            head.on('click', () => fold.toggleClass('open'));

            const inner = $('<div class="tl-fold-body"></div>');
            const grid = $('<div class="tl-cards"></div>');

            const add = $('<button type="button" class="tl-card add"></button>')
                .append('<div class="tl-card-face"><i class="fa-solid fa-plus"></i></div>')
                .append($('<div class="tl-card-title"></div>').text('Otro tablero'));
            add.on('click', () => {
                const made = addBoard(state, place.id, {
                    name: `Tablero ${place.boards.length + 1}`, shape: shapeFor(place),
                });
                state = made.state;
                editing.tableros = made.id;
                draw();
            });
            grid.append(add);

            for (const board of place.boards) {
                const card = $('<button type="button" class="tl-card picked"></button>')
                    .append('<div class="tl-card-face"><i class="fa-solid fa-chess-board"></i></div>')
                    .append($('<div class="tl-card-title"></div>').text(text(board.name) || '(sin nombre)'))
                    .append($('<div class="tl-card-note"></div>').text(
                        [SHAPE_LABELS[text(board.shape)] ?? text(board.shape),
                            SIZE_LABELS[text(board.size)] ?? ''].filter(Boolean).join(' - '),
                    ));
                card.on('click', () => {
                    editing.tableros = editing.tableros === board.id ? '' : board.id;
                    draw();
                });
                grid.append(card);
            }
            inner.append(grid);

            const open = place.boards.find((/** @type {any} */ b) => b.id === editing.tableros);
            if (open) {
                const form = $('<div class="tl-form"></div>');
                form.append(fieldRow('Nombre', text(open.name), (value) => {
                    state = editBoard(state, place.id, open.id, { name: value });
                }, () => draw()));
                form.append(choiceRow('Como es por dentro', text(open.shape), SHAPE_LABELS, (value) => {
                    state = editBoard(state, place.id, open.id, { shape: value });
                    draw();
                }));
                form.append(choiceRow('Cuanto ocupa', text(open.size), SIZE_LABELS, (value) => {
                    state = editBoard(state, place.id, open.id, { size: value });
                    draw();
                }));

                const drop = $('<button type="button" class="menu_button tl-drop"></button>')
                    .append('<i class="fa-solid fa-trash"></i>')
                    .append($('<span></span>').text(' Quitar este tablero'));
                drop.on('click', () => {
                    state = removeBoard(state, place.id, open.id);
                    editing.tableros = '';
                    draw();
                });
                form.append(drop);
                inner.append(form);
            }

            body.append(fold.append(head).append(inner));
        }
    }

    /**
     * Paso 9: quien quiere que, y contra quien.
     *
     * Llega con las que la semilla iba a repartir por el mundo. Y son **las de verdad**:
     * las que tienen meta, reloj y reputacion, no la lista vieja del Lorebook que tenia un
     * numero que no cambiaba ninguna regla.
     */
    function drawFactions() {
        // La primera vez que se llega, las que el mundo repartiria solo — ya con los
        // nombres definitivos de los sitios.
        if (library && factionsOf(state).length === 0 && !state.path.includes('libro')) {
            const dentro = locationsOf(state)
                .filter(place => isPicked(state, 'localidades', text(place.id)))
                .map(place => ({ name: text(place.name) }));

            const repartidas = rollFactions({
                compendium: library,
                locations: dentro,
                random: createSeededRandom(derive(state.fields.seed, 'facciones')),
            });
            for (const faction of repartidas) state = addFaction(state, faction).state;

            // Y las que podrian haber salido, sin marcar: quitar una y poner otra es lo
            // que hace que este mundo sea el tuyo.
            const otras = rollFactions({
                compendium: library,
                locations: dentro,
                random: createSeededRandom(derive(state.fields.seed, 'facciones', 'mas')),
                count: 4,
            });
            const puestas = new Set(factionsOf(state).map(f => text(f.name).toLowerCase()));
            for (const faction of otras) {
                if (puestas.has(text(faction.name).toLowerCase())) continue;
                puestas.add(text(faction.name).toLowerCase());
                const made = addFaction(state, faction);
                state = pickCard(made.state, 'facciones', made.id);
            }
        }

        const all = factionsOf(state);
        const open = editing.facciones;
        const places = locationsOf(state)
            .filter(place => isPicked(state, 'localidades', text(place.id)))
            .map(place => text(place.name))
            .filter(Boolean);

        const cards = [
            { id: 'nueva', title: 'Otra facción', note: 'Una que te inventes tú.', add: true },
            ...all.map(faction => ({
                id: text(faction.id),
                title: text(faction.name) || '(sin nombre)',
                note: [text(faction.seat), GOAL_LABELS[text(faction.goal?.kind)] ?? ''].filter(Boolean).join(' - '),
                icon: 'fa-flag',
                picked: isPicked(state, 'facciones', text(faction.id)),
            })),
        ];

        const faction = all.find(f => text(f.id) === open) ?? null;

        drawStep(body, {
            title: 'Facciones',
            hint: 'Lo unico del mundo que tiene planes propios: avanzan solas, cierran caminos '
                + 'y lo que hagan se paga el viernes.',
            cardsTitle: 'Quien manda ahi fuera',
            cardsOpen: true,
            formTitle: faction ? `La faccion: ${text(faction.name) || 'sin nombre'}` : 'Pulsa una para cambiarla',
            formOpen: Boolean(faction),
            cards,
            fields: faction ? [
                { key: 'fName', label: 'Nombre', value: text(faction.name), placeholder: 'Los del Molino' },
                {
                    key: 'fSeat', label: 'Donde mandan', value: text(faction.seat), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...places.map(name => ({ id: name, label: name }))],
                },
                {
                    key: 'fGoal', label: 'Que quieren', value: text(faction.goal?.kind), kind: 'choice',
                    options: ['', ...GOALS].map(id => ({ id, label: GOAL_LABELS[id] ?? id })),
                },
                {
                    key: 'fTarget', label: 'De donde, o de quien', value: text(faction.goal?.target),
                    kind: 'choice',
                    options: [
                        { id: '', label: '-' },
                        ...places.map(name => ({ id: name, label: name })),
                        ...all.filter(f => f.id !== faction.id)
                            .map(f => ({ id: text(f.id), label: text(f.name) || text(f.id) })),
                    ],
                    hint: 'Acabar con alguien apunta a una faccion; lo demas, a un sitio.',
                },
                {
                    key: 'fNote', label: 'Por que lo quieren', value: text(faction.note), kind: 'area',
                    placeholder: 'Necesitan mas tierra de la que tienen.', wand: true,
                },
                {
                    key: 'fRep', label: 'Que piensan de ti al empezar',
                    value: String(Number(faction.reputation) || 0), kind: 'choice',
                    options: Array.from({ length: (STANDING * 2) + 1 }, (unused, i) => {
                        const at = i - STANDING;
                        return { id: String(at), label: describeStanding(at) };
                    }),
                },
            ] : [],
            onPick: (id) => {
                if (id === 'nueva') {
                    const made = addFaction(state, { name: '', goal: { kind: 'conquistar' } });
                    state = made.state;
                    editing.facciones = made.id;
                    draw();
                    return;
                }
                if (editing.facciones === id) state = pickCard(state, 'facciones', id);
                else editing.facciones = id;
                draw();
            },
            onWrite: (key, value) => {
                if (!faction) return;
                if (key === 'fGoal') state = editFaction(state, faction.id, { goal: { kind: value } });
                else if (key === 'fTarget') state = editFaction(state, faction.id, { goal: { target: value } });
                else if (key === 'fRep') {
                    state = editFaction(state, faction.id, { reputation: Number(value) || 0 });
                } else {
                    const map = { fName: 'name', fSeat: 'seat', fNote: 'note' };
                    const field = map[key];
                    if (!field) return;
                    state = editFaction(state, faction.id, { [field]: value });
                }
                if (key !== 'fNote') draw();
            },
            onWand: write ? (key) => write(key, state) : null,
        });

        if (faction) {
            const drop = $('<button type="button" class="menu_button tl-drop"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .append($('<span></span>').text(' Quitar esta faccion'));
            drop.on('click', () => {
                state = removeFaction(state, faction.id);
                editing.facciones = '';
                draw();
            });
            body.append(drop);
        }
    }

    /**
     * Los pasos que son **elegir de una lista**: habilidades, razas y clases.
     *
     * Los tres son la misma pantalla con otras filas. Lo que cambia son datos, que es justo
     * lo que el componente venia a permitir.
     *
     * Y todas entran marcadas: un mundo empieza con todo lo que hay escrito, y quitar es
     * lo que lo hace **ese** mundo. El de terror quita los elfos; no hace falta que nadie
     * marque doce razas para jugar.
     *
     * @param {string} which
     */
    function drawPicks(which) {
        const rows = catalogues[which] ?? [];
        const said = {
            habilidades: {
                title: 'Habilidades',
                hint: 'Lo que sabe hacer la gente. Cada una dice de que clase es, asi que elegir '
                    + 'clase ya trae las suyas.',
                cards: 'Lo que se puede aprender',
                line: (/** @type {any} */ row) => nameAndAbility(asAbility(row)),
            },
            razas: {
                title: 'Razas',
                hint: 'De que esta hecha la gente. Cada una da algo y **quita** algo: una que solo '
                    + 'sumara se elegiria siempre.',
                cards: 'Quien puede vivir aqui',
                line: describeKin,
            },
            clases: {
                title: 'Clases',
                hint: 'A que se dedica. El dado de golpe es lo que aguanta, y lo demas se suma a '
                    + 'sus caracteristicas al crear el personaje.',
                cards: 'A que se puede dedicar',
                line: describeKin,
            },
            objetos: {
                title: 'Objetos',
                hint: 'De que formas hay armas, armaduras y trastos. El material lo pone otra '
                    + 'bateria: forma x material = objeto, asi que quitar una forma quita '
                    + 'dieciseis objetos.',
                cards: 'Lo que puede existir aqui',
                line: (/** @type {any} */ row) => [
                    row.damageDice ? `${row.damageDice} ${text(row.damageType)}` : '',
                    row.armorClass ? `CA ${row.armorClass}` : '',
                    Number(row.hands) >= 2 ? 'a dos manos' : '',
                    row.rangeFeet ? `${row.rangeFeet} ft` : '',
                    `${row.kg} kg`,
                ].filter(Boolean).join(' - '),
            },
            bestiario: {
                title: 'Bestiario',
                hint: 'Lo que hay ahi fuera. Los arquetipos son el bicho y las plantillas se les '
                    + 'apilan encima: quitar una plantilla quita una familia entera.',
                cards: 'Lo que puede salirte al paso',
                line: (/** @type {any} */ row) => [
                    text(row.kind) === 'plantilla' ? 'Plantilla' : '',
                    row.cr !== undefined ? `CR ${row.cr}` : '',
                    text(row.profile),
                ].filter(Boolean).join(' - ') || text(row.note),
            },
        }[which];

        const open = editing[which];
        const cards = rows.map((/** @type {any} */ row) => ({
            id: text(row.id),
            title: text(row.name),
            note: said.line(row),
            icon: {
                razas: 'fa-user-group', clases: 'fa-shield-halved', habilidades: 'fa-hand-sparkles',
                objetos: 'fa-gem', bestiario: 'fa-dragon',
            }[which] ?? 'fa-circle',
            picked: isPicked(state, which, text(row.id)),
        }));

        const row = rows.find((/** @type {any} */ r) => text(r.id) === open) ?? null;

        drawStep(body, {
            title: said.title,
            hint: said.hint,
            cardsTitle: said.cards,
            cardsOpen: true,
            formTitle: row ? text(row.name) : 'Pulsa una para leerla',
            formOpen: Boolean(row),
            cards,
            fields: row ? [
                { key: 'x', label: 'Que hace', value: said.line(row), hint: text(row.note) },
            ] : [],
            onPick: (id) => {
                // Aqui no se escribe: se elige. Pulsar la abre, y volver a pulsarla la quita
                // del mundo.
                if (editing[which] === id) state = pickCard(state, which, id);
                else editing[which] = id;
                draw();
            },
            onWrite: () => {},
        });

        const marked = pickedIn(state, which).length;
        body.append($('<div class="tl-said"></div>').text(
            `${marked} de ${rows.length} entran en el mundo.`,
        ));
    }

    /**
     * Paso 11: quien vive aqui.
     *
     * Va el penultimo porque se rellena con todo lo de arriba: su raza y su clase salen de
     * los pasos 6 y 7, donde vive del 3, y de quien es del 9. Escribirlo antes seria
     * escribirlo dos veces.
     */
    function drawPeople() {
        // Y los vecinos, con la bandera de quien mande donde viven: es lo que le da a uno
        // un motivo que no es suyo.
        if (library && peopleOf(state).length === 0) {
            const home = locationsOf(state)
                .filter(place => isPicked(state, 'localidades', text(place.id)))[0];
            const suyos = factionsOf(state).find(f => text(f.seat) === text(home?.name));
            const vecinos = writeVillage({
                compendium: library,
                howMany: 8,
                locationName: text(home?.name),
                banner: suyos ? { name: text(suyos.name), wants: '', note: text(suyos.note) } : null,
                random: createSeededRandom(derive(state.fields.seed, 'vecindario')),
            });
            // Los tres primeros entran; los demas se ensenan para poder elegirlos. Un paso
            // que solo ofrece lo que ya esta dentro no es una eleccion.
            (Array.isArray(vecinos) ? vecinos : []).forEach((person, i) => {
                const made = addPerson(state, person);
                state = i < 3 ? made.state : pickCard(made.state, 'personajes', made.id);
            });
        }

        const all = peopleOf(state);
        const open = editing.personajes;
        const places = locationsOf(state)
            .filter(place => isPicked(state, 'localidades', text(place.id)))
            .map(place => text(place.name)).filter(Boolean);

        const cards = [
            { id: 'nueva', title: 'Otra persona', note: 'Una que te inventes tu.', add: true },
            ...all.map(person => ({
                id: text(person.id),
                title: text(person.name) || '(sin nombre)',
                note: [text(person.title), text(person.locationName)].filter(Boolean).join(' - '),
                icon: 'fa-user',
                picked: isPicked(state, 'personajes', text(person.id)),
            })),
        ];

        const person = all.find(p => text(p.id) === open) ?? null;

        drawStep(body, {
            title: 'Personajes',
            hint: 'Quien vive aqui. Salen del compendio con tu semilla, y cada uno lleva lo que '
                + 'quiere y lo que teme: de ahi salen todas sus decisiones.',
            cardsTitle: 'La gente del mundo',
            cardsOpen: true,
            formTitle: person ? text(person.name) || 'Sin nombre' : 'Pulsa a alguien para cambiarlo',
            formOpen: Boolean(person),
            cards,
            fields: person ? [
                { key: 'pName', label: 'Nombre', value: text(person.name) },
                { key: 'pTitle', label: 'Como le llama la gente', value: text(person.title) },
                {
                    key: 'pWhere', label: 'Donde vive', value: text(person.locationName), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...places.map(name => ({ id: name, label: name }))],
                },
                {
                    key: 'pRace', label: 'Raza', value: text(person.race), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...(catalogues.razas ?? []).map((/** @type {any} */ r) => ({
                        id: text(r.name), label: text(r.name),
                    }))],
                },
                {
                    key: 'pClass', label: 'Clase', value: text(person.className), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...(catalogues.clases ?? []).map((/** @type {any} */ c) => ({
                        id: text(c.name), label: text(c.name),
                    }))],
                },
                {
                    key: 'pStory', label: 'Quien es', value: text(person.backstory), kind: 'area',
                    hint: 'Esto y lo de abajo es lo unico que lee el modelo.', wand: true,
                },
                { key: 'pMood', label: 'Como es', value: text(person.personality), kind: 'area', wand: true },
            ] : [],
            onPick: (id) => {
                if (id === 'nueva') {
                    const made = addPerson(state, { name: '', locationName: places[0] ?? '' });
                    state = made.state;
                    editing.personajes = made.id;
                    draw();
                    return;
                }
                if (editing.personajes === id) state = pickCard(state, 'personajes', id);
                else editing.personajes = id;
                draw();
            },
            onWrite: (key, value) => {
                if (!person) return;
                const map = {
                    pName: 'name', pTitle: 'title', pWhere: 'locationName', pRace: 'race',
                    pClass: 'className', pStory: 'backstory', pMood: 'personality',
                };
                const field = map[key];
                if (!field) return;
                state = editPerson(state, person.id, { [field]: value });
                if (key === 'pName' || key === 'pTitle' || key === 'pWhere') draw();
            },
            onWand: write ? (key) => write(key, state) : null,
        });

        if (person) {
            const drop = $('<button type="button" class="menu_button tl-drop"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .append($('<span></span>').text(' Quitar a esta persona'));
            drop.on('click', () => {
                state = removePerson(state, person.id);
                editing.personajes = '';
                draw();
            });
            body.append(drop);
        }
    }

    /**
     * Paso 12: las misiones.
     *
     * **No es escribir un tablon.** Las misiones las hace el motor mientras juegas: el
     * tablon se rellena solo cuando algo vence y uno de cada tres encargos sale de lo que
     * una faccion quiere esa semana. Aqui solo estan las pocas que dan el tono y los
     * mandos de como salen las demas.
     */
    function drawQuests() {
        const all = questsOf(state);
        const open = editing.misiones;
        const rules = boardRulesOf(state);
        const places = locationsOf(state)
            .filter(place => isPicked(state, 'localidades', text(place.id)))
            .map(place => text(place.name)).filter(Boolean);

        const cards = [
            { id: 'nueva', title: 'Otra mision', note: 'De las que dan el tono.', add: true },
            ...all.map(quest => ({
                id: text(quest.id),
                title: text(quest.title) || '(sin titulo)',
                note: [text(quest.where), quest.atStart ? 'desde el principio' : 'mezclada'].filter(Boolean).join(' - '),
                icon: 'fa-scroll',
                picked: isPicked(state, 'misiones', text(quest.id)),
            })),
        ];

        const quest = all.find(q => text(q.id) === open) ?? null;

        drawStep(body, {
            title: 'Misiones',
            hint: 'Las que trae el mundo escritas, y como salen las demas. El tablon se rellena '
                + 'solo: lo que vence deja hueco, y uno de cada tres sale de lo que una faccion '
                + 'quiere esa semana.',
            cardsTitle: 'Las que trae el mundo',
            cardsOpen: true,
            formTitle: quest ? text(quest.title) || 'Sin titulo' : 'Los mandos del tablon',
            formOpen: true,
            cards,
            fields: quest ? [
                { key: 'qTitle', label: 'Titulo', value: text(quest.title), placeholder: 'Sacar lo que hay en el pozo' },
                { key: 'qNote', label: 'De que va', value: text(quest.note), kind: 'area', wand: true },
                {
                    key: 'qWhere', label: 'Donde', value: text(quest.where), kind: 'choice',
                    options: [{ id: '', label: '-' }, ...places.map(name => ({ id: name, label: name }))],
                },
                { key: 'qReward', label: 'Lo que paga', value: String(quest.reward || 0) },
                {
                    key: 'qStart', label: 'Sale desde el principio', kind: 'check',
                    value: quest.atStart ? 'si' : '',
                    hint: 'Apagado, aparece mezclada con lo que el tablon vaya generando.',
                },
            ] : [
                {
                    key: 'bShare', label: 'Cuantos encargos salen de las facciones',
                    value: String(rules.factionShare), kind: 'choice',
                    options: [
                        { id: '2', label: 'Uno de cada dos' },
                        { id: '3', label: 'Uno de cada tres' },
                        { id: '5', label: 'Uno de cada cinco' },
                        { id: '99', label: 'Ninguno: solo trabajo suelto' },
                    ],
                    hint: 'Un tablon que solo habla de facciones deja de ofrecer trabajo y pasa a '
                        + 'ser una guerra.',
                },
                {
                    key: 'bTheme', label: 'De que tira el gremio', value: text(rules.theme),
                    placeholder: 'general, ladrones, cazadores...',
                    hint: 'La tematica pesa sobre la misma tabla: un gremio de ladrones ve mas '
                        + 'robos y menos escoltas.',
                },
            ],
            onPick: (id) => {
                if (id === 'nueva') {
                    const made = addQuest(state, { title: '', where: places[0] ?? '' });
                    state = made.state;
                    editing.misiones = made.id;
                    draw();
                    return;
                }
                if (editing.misiones === id) state = pickCard(state, 'misiones', id);
                else editing.misiones = id;
                draw();
            },
            onWrite: (key, value) => {
                if (key === 'bShare') {
                    state = setBoardRules(state, { factionShare: Number(value) || 3 });
                    return;
                }
                if (key === 'bTheme') {
                    state = setBoardRules(state, { theme: value });
                    return;
                }
                if (!quest) return;
                if (key === 'qStart') {
                    state = editQuest(state, quest.id, { atStart: value === 'si' });
                    draw();
                    return;
                }
                const map = { qTitle: 'title', qNote: 'note', qWhere: 'where' };
                if (key === 'qReward') {
                    state = editQuest(state, quest.id, { reward: Math.max(0, Number(value) || 0) });
                    return;
                }
                const field = map[key];
                if (!field) return;
                state = editQuest(state, quest.id, { [field]: value });
                if (key !== 'qNote') draw();
            },
            onWand: write ? (key) => write(key, state) : null,
        });

        if (quest) {
            const drop = $('<button type="button" class="menu_button tl-drop"></button>')
                .append('<i class="fa-solid fa-trash"></i>')
                .append($('<span></span>').text(' Quitar esta mision'));
            drop.on('click', () => {
                state = removeQuest(state, quest.id);
                editing.misiones = '';
                draw();
            });
            body.append(drop);
        }
    }

    /** Paso 13: cuanto duele perder. */
    function drawPlay() {
        const survival = state.survival ?? { ...DEFAULT_SURVIVAL };
        drawStep(body, {
            title: 'Jugabilidad',
            hint: 'Todo esto se puede cambiar luego en /rules, y viaja con la campaña si la '
                + 'exportas. Cada interruptor apaga algo que de verdad corre.',
            formTitle: 'Cuánto duele perder',
            // Idea 198: tres puntos de partida con nombre; los interruptores de abajo afinan.
            cardsTitle: 'Dificultad',
            cardsOpen: true,
            cards: Object.entries(DIFFICULTIES).map(([id, preset]) => ({
                id, title: preset.label, note: preset.note, picked: difficultyOf(survival) === id,
            })),
            fields: [
                {
                    key: 'mortality', label: 'Puede morir cualquiera, también los tuyos', kind: 'check',
                    value: survival.mortality === MORTALITY.EVERYONE ? 'si' : '',
                    hint: 'Apagado, solo muere quien te sigue por dinero: los tuyos quedan marcados '
                        + '— pierden un brazo, cojean, no vuelven a ver bien de un ojo.',
                },
                {
                    key: 'saves', label: 'Solo se guarda en el refugio', kind: 'check',
                    value: survival.saves === SAVES.SHELTER ? 'si' : '',
                    hint: 'Apagado, guardas cuando quieras — y entonces lo de arriba pesa menos, '
                        + 'porque siempre puedes volver atrás.',
                },
                {
                    key: 'needs', label: 'Se pasa hambre y sed', kind: 'check',
                    value: survival.needs === false ? '' : 'si',
                    hint: 'Comer y beber cuesta dinero todas las semanas, y quien no lo hace se '
                        + 'va apagando. Apagado, el viaje solo cuesta días.',
                },
                {
                    key: 'exposure', label: 'El frío y el calor hacen daño', kind: 'check',
                    value: survival.exposure === false ? '' : 'si',
                    hint: 'Dormir a la intemperie en un sitio helador se paga en vida. Apagado, '
                        + 'el clima solo se cuenta.',
                },
                {
                    key: 'injuries', label: 'Las heridas se quedan', kind: 'check',
                    value: survival.injuries === false ? '' : 'si',
                    hint: 'Caer a cero deja algo encima el resto de la campaña. Apagado, te '
                        + 'levantas entero.',
                },
                {
                    key: 'loyalty', label: 'La gente se va si no cobra', kind: 'check',
                    value: survival.loyalty === false ? '' : 'si',
                    hint: 'Quien vino por dinero se marcha cuando el viernes no sale. Apagado, '
                        + 'se quedan pase lo que pase.',
                },
            ],
            onPick: (id) => {
                const preset = DIFFICULTIES[/** @type {keyof typeof DIFFICULTIES} */ (id)];
                if (!preset) return;
                state.survival = { ...preset.survival };
                draw();
            },
            onWrite: (key, value) => {
                const on = text(value) === 'si';
                const before = state.survival ?? { ...DEFAULT_SURVIVAL };

                if (key === 'mortality') {
                    state.survival = {
                        ...before,
                        mortality: on ? MORTALITY.EVERYONE : DEFAULT_SURVIVAL.mortality,
                    };
                    return;
                }
                if (key === 'saves') {
                    state.survival = { ...before, saves: on ? SAVES.SHELTER : DEFAULT_SURVIVAL.saves };
                    return;
                }
                // Los demas son si o no, y lo que no se dice sigue encendido.
                state.survival = { ...before, [key]: on };
            },
        });
    }

    back.on('click', () => { state = goBack(state); said.text('').removeClass('bad'); draw(); });
    write2.on('click', finishWriting);
    skip.on('click', advance);
    next.on('click', advance);

    // Lo que el juego iba a poner solo al crear el mundo: el sitio de partida y los
    // vecinos que salen de la semilla. Ensenarlos antes es lo unico que permite tocarlos.
    //
    // Un libro no: trae sus propias localidades y su propio importador las coloca. Poner
    // aqui unas cuantas mas seria ofrecer cambiar algo que luego no se usa.
    try {
        if (path === 'libro') throw new Error('un libro trae sus sitios');

        const [{ getCompendium }, { rollNeighbours }] = await Promise.all([
            import('../../compendio/browser.js'),
            import('../../world/neighbours.js'),
        ]);
        const { compendium } = await getCompendium();
        placeTypes = compendium.has('sitios') ? compendium.find('sitios', { kind: 'tipo' }) : [];

        // Lo que se puede elegir en los pasos 5, 6 y 7. Todo entra marcado: un mundo
        // empieza con lo que hay escrito, y quitar es lo que lo hace **ese** mundo.
        catalogues.habilidades = compendium.has('habilidades')
            ? compendium.find('habilidades', { kind: 'habilidad' }) : [];
        catalogues.razas = racesOf(compendium);
        catalogues.clases = kindsOf(compendium);
        // Las formas de las tres baterias juntas: quien elige no tiene por que saber en
        // que archivo estaba cada una.
        catalogues.objetos = ['armas', 'armaduras', 'trastos']
            .filter(domain => compendium.has(domain))
            .flatMap(domain => compendium.find(domain, { kind: 'forma' }));
        catalogues.bestiario = compendium.has('bestiario')
            ? compendium.find('bestiario', {}) : [];
        for (const [which, rows] of Object.entries(catalogues)) {
            for (const row of rows) state = pickCard(state, which, text(row.id));
        }

        const start = path === 'mundo'
            ? (worlds.find(w => text(w.id) === pickedIn(state, 'mundo')[0])?.name ?? '')
            : '';
        state = addLocation(state, {
            name: text(start) || text(state.fields.worldName) || 'El primer sitio',
            fixed: true,
        }).state;

        // Los vecinos que el mundo iba a poner: esos entran marcados.
        const vecinos = rollNeighbours({
            compendium,
            locations: [{ name: locationsOf(state)[0].name, gridWidth: 20, gridHeight: 15 }],
            random: createSeededRandom(derive(state.fields.seed, 'vecinos')),
        });
        state = proposeLocations(state, vecinos);

        // Y unos cuantos mas, **sin marcar**: se ensena lo que podria haber, no solo lo
        // que hay. Elegir entre lo que existe es elegir; mirar tres tarjetas ya puestas,
        // no.
        const otros = rollNeighbours({
            compendium,
            locations: [{ name: locationsOf(state)[0].name, gridWidth: 20, gridHeight: 15 }],
            random: createSeededRandom(derive(state.fields.seed, 'vecinos', 'mas')),
            howMany: 6,
        });
        const yaEstan = new Set(locationsOf(state).map(place => text(place.name).toLowerCase()));
        for (const place of otros) {
            if (yaEstan.has(text(place.name).toLowerCase())) continue;
            yaEstan.add(text(place.name).toLowerCase());
            const made = addLocation(state, place);
            // Se anaden **fuera** del mundo: estan para poder elegirlas.
            state = pickCard(made.state, 'localidades', made.id);
        }

        // Las facciones y la gente se reparten **al llegar a su paso**, no aqui: al abrir,
        // el sitio de partida todavia no tiene su nombre, y «Los de El primer sitio» no lo
        // escribe nadie.
        library = compendium;
    } catch (error) {
        console.error('[taller] no se pudieron proponer sitios', error);
    }

    draw();

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        okButton: 'Cancelar', wide: true, large: true, allowVerticalScrolling: true,
    });
    const finished = await popup.show();

    // El boton de abajo es el que crea; el del popup es cancelar. Si se cierra por ahi, no
    // se ha hecho nada — que es lo que espera quien pulsa «Cancelar».
    if (!finished) return null;
    const stuck = blocksNext(state, progressOf(state).step.id);
    if (stuck) return null;

    const answers = toAnswers(state);
    // El mundo escrito por el modelo viaja como plantilla, que es lo que `createCampaign`
    // ya sabia comerse.
    if (made && answers.templateId === 'generated') answers.generatedTemplate = made;
    return answers;
}
