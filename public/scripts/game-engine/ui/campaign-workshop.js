/**
 * El taller de campañas del gremio (J5.9 de ROADMAP_SIN_CONEXION): lo que se hizo con 1387 a
 * mano, con el chat y la consola, desde el tablón y sin IA.
 *
 * Se abre desde «Taller de campañas», al lado de «Añadir una campaña», y va de arriba abajo:
 *
 * 1. **Subir el guion tal cual**: las rondas en Markdown del Gem guionista (sueltas o en un
 *    .zip) o el paquete .json. Las rondas se convierten aquí, en el navegador, con el mismo
 *    código que `tools/guion-a-paquete.mjs` (`campaign/guion-pack.js`); lo que no se lee sale
 *    con su archivo, su línea y cómo se arregla.
 * 2. **El informe**: si se puede jugar entera, lo que se quedaría a medias y lo que le falta
 *    para durar como las del juego, con «Copiar la lista para tu Gem».
 * 3. **Rellenar los huecos**: lo que el juego pone con la semilla (`pack-fill.js`), y el
 *    paquete ya relleno para guardarlo.
 * 4. **Las peleas, de un vistazo**: cada tablero jugado doscientas veces por un grupo de cuatro
 *    del nivel recomendado (`combat/quick-sim.js`), tablero a tablero sin helar la ventana.
 * 5. **Un tablero sobre un mapa en imagen**: el editor de mapas de siempre
 *    (`map-image-editor.js`), y el tablero elegido pasa a jugarse encima del dibujo.
 * 6. **El guion en Word** (J5.7 y J5.8): «Exportar el guion» da el .docx de la campaña que se
 *    prepara (`campaign/script-doc.js` y `script-docx.js`, lo mismo que `tools/guion-word.mjs`);
 *    «Importar el guion» trae el Word corregido y cambia solo las líneas tocadas. Un .docx subido
 *    en el paso 1 junto con las rondas se aplica igual, al convertirlas. Si la campaña viene de
 *    rondas, lo corregido sale también como una ronda más (J5.10, `campaign/guion-round.js`):
 *    «Descargar la ronda de correcciones (.md)», para guardarla con las del Gem guionista.
 * 7. **Añadir al tablón**, con el nombre que quieras: otro nombre es otra campaña, al lado de
 *    la que ya hay.
 *
 * Escribir la campaña a partir de un libro sigue siendo cosa del Gem o tuya; lo demás lo hace
 * el juego. Dibuja y recoge: lo que decide está en `campaign/guion-workshop.js`.
 */

import { convertGuion, locateNote } from '../campaign/guion-pack.js';
import {
    workshopUpload, workshopBands, workshopGemText, renamedPack, withMapPatch, simSummary, workshopWord, importWordInto, MAX_UPLOAD_BYTES,
} from '../campaign/guion-workshop.js';
import { correctionsRound, mergeCorrections } from '../campaign/guion-round.js';
import { simulateBoards, SIM_VERDICTS, SIM_RUNS } from '../combat/quick-sim.js';
import { readCampaignFile } from '../campaign/campaign-import.js';
import { checkWorldDensity } from '../campaign/world-density.js';
import { describeFill } from '../campaign/pack-fill.js';

/** El tipo de un .docx. */
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** El JSZip del lector de libros (`utils.js`), cargado una vez. @returns {Promise<any>} */
async function jszip() {
    if (!('JSZip' in window)) await import('../../../lib/jszip.min.js');
    return /** @type {any} */ (window).JSZip;
}

/**
 * El `word/document.xml` de un .docx.
 *
 * @param {Blob} file
 * @returns {Promise<string>}
 */
async function documentXmlOf(file) {
    const zip = await (await jszip()).loadAsync(file);
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('no parece un Word: le falta word/document.xml');
    return entry.async('string');
}

/** Un nombre de archivo sin tildes ni espacios: «El valle de Vane» → `el-valle-de-vane`. @param {any} value */
const fileSlug = (value) => text(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campana';

/** Cuántas líneas se enseñan de cada lista; las demás, contadas. */
const SHOWN = 12;

/** @param {string} value @returns {JQuery} */
const div = (value) => $('<div></div>').addClass(value);

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/**
 * Una lista con sus primeras líneas y «… y N más».
 *
 * @param {string[]} lines
 * @param {string} [cls]
 * @returns {JQuery}
 */
function listOf(lines, cls = 'hb-check-list') {
    const list = $('<ul></ul>').addClass(cls);
    for (const line of lines.slice(0, SHOWN)) list.append($('<li></li>').text(line));
    if (lines.length > SHOWN) list.append($('<li></li>').text(`… y ${lines.length - SHOWN} más.`));
    return list;
}

/**
 * Una parte plegable del informe, como las del tablón.
 *
 * @param {string} title
 * @param {string} note
 * @param {JQuery} inner
 * @param {boolean} open
 * @param {string} [key]
 * @returns {JQuery}
 */
function fold(title, note, inner, open, key = '') {
    const part = $('<details class="hb-check-group"></details>').prop('open', open);
    if (key) part.attr('data-group', key);
    part.append($('<summary></summary>').text(title));
    if (note) part.append(div('hb-check-note').text(note));
    return part.append(inner);
}

/**
 * La cabecera de un paso: su número, su título y una línea de qué es.
 *
 * @param {number} n
 * @param {string} title
 * @param {string} hint
 * @returns {JQuery}
 */
function stepHead(n, title, hint) {
    return div('tc-step-head')
        .append($('<span class="tc-step-n"></span>').text(String(n)))
        .append(div('tc-step-title').text(title))
        .append(div('tc-step-hint').text(hint));
}

/**
 * Los archivos elegidos, leídos: el texto de cada uno y, de un .zip, lo que lleva dentro.
 *
 * @param {File[]} files
 * @returns {Promise<{read: Array<{name: string, text?: string, file?: Blob}>, problems: string[]}>}
 */
async function readUploads(files) {
    /** @type {Array<{name: string, text?: string, file?: Blob}>} */
    const read = [];
    /** @type {string[]} */
    const problems = [];
    let bytes = 0;
    for (const file of files) {
        bytes += Number(file.size) || 0;
        if (bytes > MAX_UPLOAD_BYTES) {
            problems.push(`Es demasiado para un guion: más de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. «${file.name}» y lo que va detrás no se leen.`);
            break;
        }
        if (/\.zip$/i.test(file.name)) {
            try {
                const zip = await (await jszip()).loadAsync(file);
                for (const entry of Object.values(zip.files)) {
                    const one = /** @type {any} */ (entry);
                    if (one.dir || /(^|\/)(__MACOSX|\.)/.test(one.name)) continue;
                    if (/\.docx$/i.test(one.name)) read.push({ name: one.name, file: await one.async('blob') });
                    else read.push(/\.(md|markdown|txt|json)$/i.test(one.name) ? { name: one.name, text: await one.async('string') } : { name: one.name });
                }
            } catch (error) {
                problems.push(`«${file.name}» no se puede abrir como .zip (${String(/** @type {any} */ (error)?.message || error)}).`);
            }
            continue;
        }
        read.push(/\.docx$/i.test(file.name) ? { name: file.name, file } : { name: file.name, text: await file.text() });
    }
    return { read, problems };
}

/**
 * Las habilidades del compendio, para el catálogo del conversor (lo mismo que lee la herramienta).
 *
 * @returns {Promise<any[]>}
 */
async function abilityRows() {
    try {
        const response = await fetch('/compendio/habilidades.json', { cache: 'no-cache' });
        return response.ok ? ((await response.json())?.rows ?? []) : [];
    } catch {
        return [];
    }
}

/**
 * Leer un paquete como lo lee el tablón al añadirlo: en limpio, con los mapas de sus dibujos,
 * relleno con el compendio del juego, validado y comprobado.
 *
 * @param {string} content
 * @returns {Promise<import('../campaign/campaign-import.js').CampaignFileReport>}
 */
async function readLikeTheBoard(content) {
    const { freshCompendium } = await import('../compendio/browser.js');
    const compendium = await freshCompendium().catch(() => null);
    const loadPixels = async (/** @type {string} */ src) => (await (await import('./map-image-editor.js')).loadPicture(src)).pixels;
    return readCampaignFile(content, { compendium, loadPixels });
}

/**
 * @typedef {Object} WorkshopInput
 * @property {any} Popup
 * @property {any} POPUP_TYPE
 * @property {(content: string, source: string) => Promise<any>} onAdd Añadir al tablón (lo de
 *   «Añadir una campaña»): guarda el paquete y pone su tarjeta en el tablón. Devuelve lo mismo
 *   que la importación (`{ok, name, …}` o `{ok: false, headline, problems}`).
 */

/**
 * Abrir el taller. Se cierra solo con «Cerrar» (o «Volver al tablón» tras añadir).
 *
 * @param {WorkshopInput} input
 * @returns {Promise<void>}
 */
export async function openCampaignWorkshop({ Popup, POPUP_TYPE, onAdd }) {
    const body = div('vt-root hb-root tc-root');
    body.append(div('vt-head')
        .append($('<h3 class="vt-title"></h3>').text('Taller de campañas'))
        .append($('<p class="vt-sub"></p>').text('Sube el guion que te da tu Gem guionista y el juego lo convierte, lo comprueba, rellena lo que falta y prueba sus peleas. Escribir la historia sigue siendo cosa tuya o de tu Gem; lo demás lo hace el juego, sin conexión.')));

    /** @type {any} */
    let popup = null;
    const state = {
        /** @type {'guion'|'json'|''} */
        source: '',
        /** @type {import('../campaign/guion-pack.js').GuionResult|null} */
        guion: null,
        /** El paquete antes de rellenar (el del guion) o el ya leído (el de un JSON). */
        /** @type {any} */
        base: null,
        /** @type {import('../campaign/campaign-import.js').CampaignFileReport|null} */
        read: null,
        /** @type {any} */
        density: null,
        /** @type {import('../combat/quick-sim.js').BoardSim[]|null} */
        sims: null,
        /** Lo que se dijo del último mapa en imagen (paso 5), y de qué tablero. @type {string[]} */
        mapSaid: [],
        mapBoard: '',
        /** J5.8: lo que dijo el último Word importado, y sus líneas nuevas para el Gem. @type {string[]} */
        wordSaid: [],
        /** @type {string[]} */
        wordNotes: [],
        /** J5.10: todo lo corregido en los Word de esta vez, con su sitio en el paquete. @type {import('../campaign/guion-round.js').Correction[]} */
        corrections: [],
        busy: false,
        added: false,
    };

    // ---- 1. Subir ---------------------------------------------------------------------------
    const picker = $('<input type="file" multiple hidden />').attr('accept', '.md,.markdown,.txt,.zip,.json,.docx');
    const choose = $('<button type="button" class="menu_button tc-choose"></button>')
        .append('<i class="fa-solid fa-folder-open"></i>').append($('<span></span>').text('Elegir los archivos'));
    const drop = div('tc-drop').attr('data-workshop-drop', 'true')
        .append(div('tc-drop-icon').append('<i class="fa-solid fa-scroll"></i>'))
        .append(div('tc-drop-text').text('Las rondas del guion tal cual (todos los .md a la vez, o un .zip con ellos), o el paquete .json de una campaña. También puedes soltarlos aquí.'))
        .append(choose);
    const status = div('tc-status').attr('role', 'status');
    const step1 = div('tc-step').attr('data-step', 'subir')
        .append(stepHead(1, 'Sube el guion', 'Se convierte aquí mismo, con el mismo conversor que se usó con 1387.'), drop, status, picker);

    // ---- 2 a 7: se dibujan al leer --------------------------------------------------------------
    const step2 = div('tc-step').attr('data-step', 'informe').hide();
    const step3 = div('tc-step').attr('data-step', 'huecos').hide();
    const step4 = div('tc-step').attr('data-step', 'peleas').hide();
    const step5 = div('tc-step').attr('data-step', 'mapa').hide();
    const step6 = div('tc-step').attr('data-step', 'word').hide();
    const step7 = div('tc-step').attr('data-step', 'tablon').hide();
    body.append(div('tc-steps').append(step1, step2, step3, step4, step5, step6, step7));
    body.append(div('hb-foot').append($('<button type="button" class="menu_button hb-close tc-close"></button>')
        .text('Cerrar')
        .on('click', () => { void popup?.completeCancelled(); })));

    /** El paquete que se puede jugar (relleno), o null. */
    const playable = () => (state.read?.ok ? state.read.pack : null);

    /**
     * Lo que dice el paso 1 tras leer: las rondas, cuántos bloques de cada tipo y los fallos con
     * su archivo y su línea.
     *
     * @param {string[]} extra Problemas al abrir los archivos.
     * @param {string} said
     */
    const renderStatus = (extra, said) => {
        status.empty().removeClass('is-ok is-bad');
        status.append(div('tc-said').text(said));
        for (const line of extra) status.append(div('tc-bad').text(line));
        const guion = state.guion;
        if (!guion) return;
        const counts = div('tc-counts');
        for (const [kind, n] of guion.counts) counts.append($('<span class="tc-chip"></span>').text(`${kind}: ${n}`));
        status.append(div('tc-files').text(`Leídas ${guion.files.length} rondas: ${guion.files.join(', ')}.`), counts);
        if (guion.stage === 'leido') {
            status.addClass('is-bad');
            status.append(div('tc-bad tc-big').text(`${guion.problems.length} ${guion.problems.length === 1 ? 'bloque no se puede leer' : 'bloques no se pueden leer'}. Arréglalos y vuelve a subir las rondas: lo demás no se comprueba hasta entonces.`));
            const list = $('<ul class="tc-errors"></ul>');
            for (const p of guion.problems.slice(0, SHOWN)) {
                list.append($('<li></li>')
                    .append($('<code class="tc-where"></code>').text(`${p.file}, línea ${p.line}`))
                    .append($('<span></span>').text(` ${p.why}`))
                    .append(p.said ? div('tc-line').text(p.said) : $())
                    .append(div('tc-fix').text(`Arreglo: ${p.fix}`)));
            }
            if (guion.problems.length > SHOWN) list.append($('<li></li>').text(`… y ${guion.problems.length - SHOWN} más.`));
            status.append(list);
            return;
        }
        if (guion.stage === 'sin-mundo') {
            status.addClass('is-bad').append(div('tc-bad tc-big').text('Falta el bloque «mundo:» con su id: es el que dice cómo se llama la campaña y dónde empieza. Va en una ronda (la de correcciones, si la hay).'));
            return;
        }
        status.addClass(guion.issues.some(i => i.level === 'ERROR') ? 'is-bad' : 'is-ok');
        const errors = guion.issues.filter(i => i.level === 'ERROR');
        if (errors.length > 0) {
            const list = $('<ul class="tc-errors"></ul>');
            for (const issue of errors.slice(0, SHOWN)) {
                list.append($('<li></li>').append(issue.where ? $('<code class="tc-where"></code>').text(issue.where) : $())
                    .append($('<span></span>').text(` ${issue.message}`)));
            }
            if (errors.length > SHOWN) list.append($('<li></li>').text(`… y ${errors.length - SHOWN} más.`));
            status.append(div('tc-bad tc-big').text(`${errors.length} ${errors.length === 1 ? 'fallo' : 'fallos'} en el paquete que sale. Cada uno dice en qué ronda y línea está; el arreglo puede ir ahí o en una ronda nueva con el mismo id.`), list);
        } else {
            status.append(div('tc-good').append('<i class="fa-solid fa-circle-check"></i>').append($('<span></span>').text(` Convertido: «${text(guion.pack?.world?.name)}».`)));
        }
        // Lo que no impide nada: plegado.
        const warnings = [
            ...guion.notes.map(note => { const at = locateNote(note, guion.index); return `${note}${at ? ` (${at})` : ''}`; }),
            ...guion.issues.filter(i => i.level === 'AVISO').map(i => `${i.message}${i.where ? ` (${i.where})` : ''}`),
        ];
        if (warnings.length > 0) status.append(fold(`Avisos del conversor (${warnings.length})`, 'No impiden convertirlo, pero casi siempre son una errata.', listOf(warnings), false, 'conversor'));
        if (guion.ignored.length > 0) {
            const fields = guion.ignoredByField.map(([field, paths]) => `${field} (${paths.length}): ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? '…' : ''}`);
            status.append(fold(`Campos que el conversor no lee (${guion.ignored.length})`, 'El juego no se entera de ellos. Si es una errata, corrígela en una ronda nueva; si es un campo nuevo, hay que enseñárselo al conversor.', listOf(fields), false, 'no-leidos'));
        }
    };

    /** El paso 2: el informe y la lista para el Gem. */
    const renderReport = () => {
        step2.empty().show().append(stepHead(2, 'El informe', 'Si se puede jugar entera, lo que se quedaría a medias y lo que le falta para durar como las del juego.'));
        const read = state.read;
        if (!read) return;
        const check = read.check;
        const box = div('hb-check tc-report').attr('data-verdict', check?.verdict ?? 'rota');
        const icon = { lista: 'fa-circle-check', huecos: 'fa-triangle-exclamation', rota: 'fa-circle-xmark' }[check?.verdict ?? 'rota'];
        box.append(div('hb-check-head').append(`<i class="fa-solid ${icon}"></i>`).append($('<span></span>').text(`${check?.headline ?? read.headline}`)));
        if (read.ok) box.append(div('tc-headline').text(read.headline));
        else box.append(div('tc-bad').text(read.headline));
        for (const group of check?.groups ?? []) {
            // Lo que ha puesto el juego va en su paso, el 3.
            if (group.key === 'relleno') continue;
            const lines = group.items.map((/** @type {any} */ item) => `${item.text}${item.where && state.source === 'json' ? `  [${item.where}]` : ''}`);
            box.append(fold(`${group.title} (${group.items.length})`, group.note, listOf(lines, group.key === 'rota' ? 'hb-import-list' : 'hb-check-list'), group.open, group.key));
        }
        if (state.density?.counts?.length) {
            box.append(fold('Lo que trae, contado', 'Con un ✓ lo que llega al listón de las campañas del juego; con un punto, lo que se queda por debajo.', listOf(state.density.counts.map((/** @type {string} */ l) => String(l)), 'hb-check-list tc-density'), false, 'cuenta'));
        }
        const said = workshopGemText({
            source: state.source === 'guion' ? 'guion' : 'json',
            name: text(state.base?.world?.name) || text(check?.name),
            problems: state.guion?.problems ?? [],
            issues: state.guion?.issues ?? [],
            notes: (state.guion?.notes ?? []).map(note => { const at = state.guion ? locateNote(note, state.guion.index) : ''; return `${note}${at ? ` (${at})` : ''}`; }),
            check,
            density: state.density,
            wordNotes: state.wordNotes,
        });
        const copied = $('<textarea class="text_pole hb-check-text tc-gem-text" rows="8" readonly></textarea>').hide();
        const copy = $('<button type="button" class="menu_button hb-check-copy tc-gem-copy"></button>')
            .append('<i class="fa-solid fa-copy"></i>').append($('<span></span>').text('Copiar la lista para tu Gem'))
            .prop('disabled', !said)
            .on('click', async () => {
                copied.val(said).show();
                try {
                    await navigator.clipboard.writeText(said);
                    copy.find('span').text('Copiada: pégasela a tu Gem');
                } catch {
                    // Sin portapapeles, el texto queda a la vista para copiarlo a mano.
                    copied.trigger('focus').trigger('select');
                    copy.find('span').text('Cópiala de aquí debajo');
                }
            });
        if (!said) copy.find('span').text('No hay nada que pedirle a tu Gem');
        step2.append(box, copy, copied);
    };

    /** El paso 3: lo que pone el juego, y el paquete ya relleno. */
    const renderFill = () => {
        step3.empty().show().append(stepHead(3, 'Rellenar los huecos', 'Lo que el guion no trae y el juego pone con la semilla de la campaña: siempre lo mismo para la misma campaña.'));
        const read = state.read;
        if (!read) return;
        const lines = describeFill(read.filled ?? [], 6);
        if (lines.length === 0) step3.append(div('tc-note').text('No le falta nada que el juego sepa poner.'));
        else step3.append(div('tc-note').text(`Al añadirla, el juego pone ${lines.length === 1 ? 'esto' : 'estas cosas'} (si prefieres escribirlo tú, pídeselo a tu Gem):`), listOf(lines, 'hb-check-list tc-fill-list'));
        if (!read.pack) {
            step3.append(div('tc-note').text('Hasta que no se arregle lo que impide jugarla, no se puede rellenar.'));
            return;
        }
        step3.append($('<button type="button" class="menu_button tc-download"></button>')
            .append('<i class="fa-solid fa-download"></i>').append($('<span></span>').text('Descargar la campaña ya rellena (.json)'))
            .on('click', async () => {
                const { download } = await import('../../utils.js');
                const name = text(read.pack?.world?.name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campana';
                download(`${JSON.stringify(read.pack, null, 2)}\n`, `${name}.pack.json`, 'application/json');
            }));
    };

    /** El paso 4: la simulación de las peleas. */
    const renderFights = () => {
        step4.empty().show().append(stepHead(4, 'Las peleas, de un vistazo', `Cada tablero jugado ${SIM_RUNS} veces por un grupo de cuatro (guerrero, clériga, pícara y mago) del nivel para el que es. Es una cuenta rápida, sin mapa: no mira casillas, cobertura ni puertas.`));
        const pack = playable();
        if (!pack) {
            step4.append(div('tc-note').text('Se prueba cuando la campaña se pueda jugar.'));
            return;
        }
        const bands = workshopBands(pack);
        if (bands.levels) step4.append(div('tc-note').text(`Para nivel ${bands.levels[0]} a ${bands.levels[1]}, repartido entre sus actos como en el juego.`));
        const run = $('<button type="button" class="menu_button tc-sim-run"></button>')
            .append('<i class="fa-solid fa-dice-d20"></i>').append($('<span></span>').text(state.sims ? 'Volver a simular' : 'Simular las peleas'));
        const progress = div('tc-progress').hide().append(div('tc-progress-bar'), div('tc-progress-text'));
        const table = div('tc-sims');
        const drawTable = () => {
            table.empty();
            if (!state.sims) return;
            table.append(div('tc-sim-summary').text(simSummary(state.sims)));
            for (const sim of state.sims) {
                table.append(div('tc-sim').attr('data-verdict', sim.verdict).attr('data-board', sim.id)
                    .append(div('tc-sim-name').text(sim.name))
                    .append($('<span class="tc-sim-chip"></span>').text(SIM_VERDICTS[sim.verdict].label))
                    .append(div('tc-sim-foes').text(`${sim.foes} · para nivel ${sim.band && sim.band.high > sim.band.low ? `${sim.band.low}-${sim.band.high}` : sim.level}`))
                    .append(div('tc-sim-said').text(sim.said)));
            }
        };
        run.on('click', async () => {
            if (state.busy) return;
            state.busy = true;
            run.prop('disabled', true);
            progress.show();
            try {
                state.sims = await simulateBoards({
                    pack,
                    bandOf: bands.bandOf,
                    seed: text(pack?.world?.name),
                    onProgress: (done, total, last) => {
                        progress.find('.tc-progress-bar').css('width', `${Math.round((done / Math.max(1, total)) * 100)}%`);
                        progress.find('.tc-progress-text').text(`Tablero ${done} de ${total}${last ? `: ${last.name}` : ''}`);
                    },
                    // Un respiro entre tablero y tablero: la ventana sigue viva mientras cuenta.
                    pause: () => new Promise(resolve => setTimeout(resolve, 0)),
                });
                drawTable();
                run.find('span').text('Volver a simular');
            } finally {
                state.busy = false;
                run.prop('disabled', false);
                progress.hide();
            }
        });
        step4.append(run, progress, table);
        drawTable();
    };

    /** El paso 5: un tablero encima de un mapa en imagen. */
    const renderMap = () => {
        step5.empty().show().append(stepHead(5, 'Un tablero sobre un mapa en imagen', 'Si tienes el mapa de un tablero en imagen (con su cuadrícula), el editor de mapas lo lee y el tablero se juega encima del dibujo.'));
        const boards = (Array.isArray(state.base?.boards) ? state.base.boards : []).filter((/** @type {any} */ b) => text(b?.id));
        if (boards.length === 0) {
            step5.append(div('tc-note').text('El guion no trae ningún tablero todavía.'));
            return;
        }
        const select = $('<select class="text_pole tc-map-board"></select>');
        for (const board of boards) select.append($('<option></option>').attr('value', text(board.id)).text(`${text(board.name) || text(board.id)}${board.image ? ' (ya va sobre un dibujo)' : ''}`));
        if (state.mapSaid.length > 0 && state.mapBoard) select.val(state.mapBoard);
        const image = $('<input type="file" accept="image/*" hidden />');
        const open = $('<button type="button" class="menu_button tc-map-open"></button>')
            .append('<i class="fa-solid fa-map"></i>').append($('<span></span>').text('Elegir el mapa y abrir el editor'));
        // Lo que pasó con el último mapa: se dibuja otra vez con los pasos, así que va en el estado.
        const said = div('tc-note tc-map-said');
        for (const line of state.mapSaid) said.append(div('').text(line));
        open.on('click', () => image.trigger('click'));
        image.on('change', async () => {
            const file = /** @type {HTMLInputElement} */ (image[0]).files?.[0];
            image.val('');
            if (!file) return;
            const boardId = String(select.val() ?? '');
            state.mapBoard = boardId;
            try {
                const [{ openMapImageEditor }, popupModule, { saveBase64AsFile }] = await Promise.all([
                    import('./map-image-editor.js'), import('../../popup.js'), import('../../utils.js'),
                ]);
                const board = boards.find((/** @type {any} */ b) => text(b.id) === boardId) ?? {};
                const patch = await openMapImageEditor({
                    file, board, Popup: popupModule.Popup, POPUP_TYPE: popupModule.POPUP_TYPE, POPUP_RESULT: popupModule.POPUP_RESULT,
                    // El dibujo va a un archivo, no dentro de la campaña: un mapa así pesa un mega.
                    saveImage: (base64, extension, fileName) => saveBase64AsFile(base64, 'tableros', fileName, extension),
                });
                if (!patch) return;
                const done = withMapPatch(state.base, boardId, patch);
                state.base = done.pack;
                said.text(`«${text(board.name) || boardId}» va ahora sobre el dibujo. Comprobando otra vez…`);
                state.mapSaid = [
                    `«${text(board.name) || boardId}» va ahora sobre el dibujo (${patch.gridWidth} × ${patch.gridHeight} casillas). El juego pone dónde empieza el grupo y dónde espera cada enemigo.`,
                    ...done.moved,
                ];
                await recheck();
            } catch (error) {
                console.error('[taller] el mapa en imagen', error);
                state.mapSaid = [`No se ha podido: ${String(/** @type {any} */ (error)?.message || error)}.`];
                said.empty().text(state.mapSaid[0]);
            }
        });
        step5.append(div('tc-row').append(select, open), said, image);
    };

    /**
     * J5.8: un Word corregido, sobre la campaña del taller; luego, comprobarla otra vez.
     *
     * @param {Blob} file
     * @param {string} name
     */
    const importWord = async (file, name) => {
        const done = importWordInto(state.base, await documentXmlOf(file));
        state.base = done.pack;
        state.wordNotes = done.notes;
        state.corrections = mergeCorrections(state.corrections, done.changes);
        state.wordSaid = [`«${name}»: ${done.said}`, ...done.applied.map(line => `Cambiada: ${line}`), ...done.refused.map(line => `Sin cambiar: ${line}`)];
        if (done.notes.length > 0) state.wordSaid.push('Las líneas nuevas (sin marca) no tienen sitio en la campaña: van en «Copiar la lista para tu Gem», en el paso 2.');
        if (state.source === 'guion' && done.applied.length > 0) state.wordSaid.push('Los cambios van a la campaña de este taller, no a tus rondas: descarga la ronda de correcciones y guárdala con las demás, o se pierden al volver a subir las rondas sin el Word.');
        await recheck();
    };

    /** El paso 6: el guion en Word, para leerlo y corregirlo fuera del juego. */
    const renderWord = () => {
        step6.empty().show().append(stepHead(6, 'El guion en Word', 'Todo lo que se dice en la campaña, con quién lo dice, como un guion de lectura. Corrígelo en Word (sin tocar las marcas grises) y vuelve a subirlo: el juego cambia solo las líneas que toques.'));
        if (!state.base) return;
        const out = $('<button type="button" class="menu_button tc-word-export"></button>')
            .append('<i class="fa-solid fa-file-word"></i>').append($('<span></span>').text('Exportar el guion'));
        const back = $('<button type="button" class="menu_button tc-word-import"></button>')
            .append('<i class="fa-solid fa-file-import"></i>').append($('<span></span>').text('Importar el guion'));
        const picker = $('<input type="file" hidden />').attr('accept', `.docx,${DOCX_TYPE}`);
        const said = div('tc-note tc-word-said');
        if (state.wordSaid.length > 0) said.append(div('tc-said').text(state.wordSaid[0]), listOf(state.wordSaid.slice(1), 'hb-check-list tc-word-list'));
        out.on('click', async () => {
            try {
                const word = workshopWord(state.base, new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
                const zip = new (await jszip())();
                for (const [path, xml] of Object.entries(word.files)) zip.file(path, xml);
                const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: DOCX_TYPE });
                const { download } = await import('../../utils.js');
                download(blob, `${fileSlug(word.title)}-guion.docx`, DOCX_TYPE);
                said.empty().append(div('tc-said').text(`Exportado: «${word.title}», ${word.lines} líneas para leer y corregir.`));
            } catch (error) {
                console.error('[taller] exportar el guion', error);
                said.empty().text(`No se ha podido exportar: ${String(/** @type {any} */ (error)?.message || error)}.`);
            }
        });
        back.on('click', () => picker.trigger('click'));
        picker.on('change', async () => {
            const file = /** @type {HTMLInputElement} */ (picker[0]).files?.[0];
            picker.val('');
            if (!file) return;
            try {
                said.text('Leyendo el Word…');
                await importWord(file, file.name);
            } catch (error) {
                console.error('[taller] importar el guion', error);
                said.empty().text(`No se ha podido leer «${file.name}»: ${String(/** @type {any} */ (error)?.message || error)}.`);
            }
        });
        // J5.10: lo corregido, como una ronda más del guion. Solo si la campaña viene de rondas.
        const guion = state.guion;
        const round = state.source === 'guion' && guion?.byKind && state.corrections.length > 0
            ? $('<button type="button" class="menu_button tc-word-round"></button>')
                .append('<i class="fa-solid fa-file-lines"></i>').append($('<span></span>').text('Descargar la ronda de correcciones (.md)'))
                .on('click', async () => {
                    const made = correctionsRound({
                        changes: state.corrections, pack: guion.pack, byKind: guion.byKind, files: guion.files,
                        title: text(guion.pack?.world?.name), date: new Date().toISOString().slice(0, 10),
                    });
                    const { download } = await import('../../utils.js');
                    download(made.text, made.name, 'text/markdown');
                    said.find('.tc-round-said').remove();
                    said.append(div('tc-said tc-round-said').text(`${made.said} Guárdala en la carpeta de tus rondas, con las demás.`));
                })
            : $();
        step6.append(div('tc-row').append(out, back, round), said, picker);
    };

    /** El paso 7: añadirla al tablón, con el nombre que se quiera. */
    const renderAdd = () => {
        step7.empty().show().append(stepHead(7, 'Añadir al tablón', 'Sale en el tablón de todos tus gremios. Con otro nombre es otra campaña, al lado de la que ya hay.'));
        const name = $('<input type="text" class="text_pole tc-name" maxlength="80" />').val(text(state.base?.world?.name));
        const add = $('<button type="button" class="menu_button tc-add"></button>')
            .append('<i class="fa-solid fa-thumbtack"></i>').append($('<span></span>').text('Añadir al tablón'));
        const said = div('tc-add-said').attr('role', 'status');
        if (!state.read?.ok) {
            add.prop('disabled', true);
            said.text('Antes hay que arreglar lo que impide jugarla (paso 2).');
        }
        add.on('click', async () => {
            if (add.prop('disabled')) return;
            const wanted = text(name.val()) || text(state.base?.world?.name);
            add.prop('disabled', true).find('span').text('Añadiendo…');
            try {
                const result = await onAdd(JSON.stringify(renamedPack(state.base, wanted)), `«${wanted}»`);
                said.empty().removeClass('is-ok is-bad').addClass(result?.ok ? 'is-ok' : 'is-bad');
                if (result?.ok) {
                    state.added = true;
                    said.append(div('tc-good').text(result.replaced
                        ? `Puesta al día en el tablón: «${result.name}».`
                        : `Añadida al tablón: «${result.name}». Vuelve al tablón y pulsa su tarjeta para empezarla.`));
                    said.append($('<button type="button" class="menu_button tc-back"></button>')
                        .append('<i class="fa-solid fa-arrow-left"></i>').append($('<span></span>').text('Volver al tablón'))
                        .on('click', () => { void popup?.completeCancelled(); }));
                } else {
                    said.append(div('tc-bad').text(text(result?.headline) || 'No se ha podido añadir.'));
                    if (Array.isArray(result?.problems) && result.problems.length > 0) {
                        said.append(listOf(result.problems.map((/** @type {any} */ p) => `${p.message}  [${p.path}]`), 'hb-import-list'));
                    }
                }
            } finally {
                add.prop('disabled', false).find('span').text('Añadir al tablón');
            }
        });
        step7.append(div('tc-row').append($('<label class="tc-name-label"></label>').text('Nombre en el tablón').append(name), add), said);
    };

    /** Todo lo de debajo del paso 1, otra vez. */
    const renderAll = () => {
        renderReport();
        renderFill();
        renderFights();
        renderMap();
        renderWord();
        renderAdd();
    };

    const hideSteps = () => {
        for (const step of [step2, step3, step4, step5, step6, step7]) step.empty().hide();
    };

    /** Volver a leer el paquete (tras cambiar un tablero) y dibujar los pasos. */
    const recheck = async () => {
        state.read = await readLikeTheBoard(JSON.stringify(state.base));
        state.density = checkWorldDensity(state.read.pack ?? state.base);
        state.sims = null;
        renderAll();
    };

    /**
     * Leer lo elegido: convertir el guion o el paquete, comprobarlo y dibujar los pasos.
     *
     * @param {File[]} files
     */
    const readChosen = async (files) => {
        if (state.busy || files.length === 0) return;
        state.busy = true;
        choose.prop('disabled', true).find('span').text('Leyendo…');
        hideSteps();
        Object.assign(state, { source: '', guion: null, base: null, read: null, density: null, sims: null, mapSaid: [], wordSaid: [], wordNotes: [], corrections: [] });
        try {
            const { read, problems } = await readUploads(files);
            const sorted = workshopUpload(read);
            // J5.8: un Word va con la campaña que corrige; solo, no hay sobre qué ponerlo.
            const words = read.filter(r => /\.docx$/i.test(r.name) && r.file);
            if (sorted.kind === 'word') {
                renderStatus(problems, `${sorted.said} El Word corrige una campaña: sube sus rondas (o su .json) con él, todo junto, o súbelo en el paso 6, «Importar el guion».`);
                status.addClass('is-bad');
                return;
            }
            if (!sorted.kind) {
                renderStatus(problems, sorted.said);
                status.addClass('is-bad');
                return;
            }
            if (sorted.kind === 'guion') {
                const { yaml } = await import('../../../lib.js');
                state.source = 'guion';
                state.guion = convertGuion(sorted.rounds, { parseYaml: (source) => yaml.parse(source), abilityRows: await abilityRows() });
                renderStatus(problems, sorted.said);
                if (state.guion.stage !== 'hecho') return;
                state.base = state.guion.pack;
            } else {
                state.source = 'json';
                renderStatus(problems, sorted.said);
            }
            state.read = await readLikeTheBoard(state.source === 'guion' ? JSON.stringify(state.base) : String(sorted.json?.text ?? ''));
            if (state.source === 'json') {
                state.base = state.read.pack;
                if (!state.read.ok) {
                    status.addClass('is-bad').append(div('tc-bad tc-big').text(state.read.headline));
                    if (state.read.problems.length > 0) status.append(listOf(state.read.problems.map(p => `${p.message}  [${p.path}]`), 'hb-import-list'));
                }
            }
            state.density = checkWorldDensity(state.read.pack ?? state.base ?? {});
            if (state.base && words.length > 0) {
                const word = words[0];
                await importWord(/** @type {Blob} */ (word.file), word.name.split(/[\\/]/).pop() ?? word.name);
                if (words.length > 1) state.wordSaid.push(`Solo se ha leído el primer Word: ${words.slice(1).map(w => w.name).join(', ')} no.`);
                renderWord();
            } else if (state.base) renderAll();
            else renderReport();
        } catch (error) {
            console.error('[taller] no se pudo leer', error);
            status.empty().addClass('is-bad').append(div('tc-bad').text(`No se pudo leer: ${String(/** @type {any} */ (error)?.message || error)}.`));
        } finally {
            state.busy = false;
            choose.prop('disabled', false).find('span').text('Elegir otros archivos');
        }
    };

    choose.on('click', () => picker.trigger('click'));
    picker.on('change', async () => {
        const input = /** @type {HTMLInputElement} */ (picker[0]);
        const files = [...(input.files ?? [])];
        // Vaciado, para que las mismas rondas arregladas se puedan elegir otra vez.
        picker.val('');
        await readChosen(files);
    });
    drop.on('dragover', (event) => {
        event.preventDefault();
        drop.addClass('is-over');
    }).on('dragleave drop', () => drop.removeClass('is-over'))
        .on('drop', async (event) => {
            event.preventDefault();
            const dragged = /** @type {DragEvent|undefined} */ (event.originalEvent);
            const files = [...(dragged?.dataTransfer?.files ?? [])];
            await readChosen(files);
        });

    popup = new Popup(body[0], POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: false, wide: true, large: true, allowVerticalScrolling: true });
    await popup.show();
}
