/**
 * Avisar de lo importante, sin destripar (J11.1 de wiki/ROADMAP_SIN_CONEXION.md).
 *
 * Hay decisiones que no se deshacen: la que cierra el camino de una facción, la que acaba la
 * campaña, la que un guionista marca porque de ahí no se vuelve. Hasta ahora se elegían igual
 * que «¿Qué se cuenta por el puerto?», y quien juega se enteraba después. Aquí se avisa antes,
 * con una línea que no cuenta nada de lo que se pierde: «Esto no tiene vuelta atrás».
 *
 * De dónde sale el aviso:
 *
 * - **Escrito**: una opción (de una charla, de una escena del hilo o de un suceso) o un hito
 *   con `irreversible: true`. Con un texto en vez de `true`, ese texto (corto: se lee en la
 *   ficha, y no debe contar lo que se pierde).
 * - **Sacado del hilo**: un hito que cierra otros caminos (`changes.close`) o que lleva a un
 *   final (`changes.ending`, `changes.endingBy`) pesa aunque nadie lo marque. Una opción que lo
 *   cumple (`{"milestone": id}`) y una acción que lo cumple (ganar ese tablero, entregar ese
 *   encargo, llegar a ese sitio) avisan igual.
 *
 * Para saber si una acción cumple un hito que pesa, se prueba el suceso contra el hilo sin
 * guardar nada (`plotEvent` es puro): lo que diría el hilo si pasara.
 *
 * Puro: dice si hay que avisar y con qué. Quien llama lo enseña y pide que se confirme.
 */

import { plotEvent } from './plot.js';

/** Lo que se dice. Ni qué se pierde ni por qué: solo que no se deshace. */
export const NO_RETURN = 'Esto no tiene vuelta atrás.';

/** Lo más largo que puede ser un aviso escrito: se lee en la ficha de la opción. */
export const NO_RETURN_MAX = 80;

/** Cómo se pide que se confirme una acción que pesa, fuera de una charla. */
export const NO_RETURN_CONFIRM = { title: 'Esto no tiene vuelta atrás', ok: 'Seguir', cancel: 'Todavía no' };

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} value @returns {boolean} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * El aviso de algo escrito (una opción, un hito): `irreversible: true` es el de siempre; con
 * texto, ese texto, con su punto. `sinVuelta` vale igual, para quien lo escribe en castellano.
 *
 * @param {any} raw
 * @returns {string} Vacío si no se marca.
 */
export function readNoReturn(raw) {
    if (!isObject(raw)) return '';
    const said = raw.irreversible ?? raw.sinVuelta;
    if (said === true) return NO_RETURN;
    if (typeof said !== 'string' || !text(said)) return '';
    const clean = text(said).replace(/\s+/g, ' ');
    return /[.!?…»]$/.test(clean) ? clean : `${clean}.`;
}

/**
 * Los hitos que pesan, con su aviso: los marcados, los que cierran caminos y los que llevan a
 * un final. Vale con el hilo leído (`readPlot`) o tal como viene en el paquete.
 *
 * @param {any} plot
 * @returns {Record<string, string>} Por id de hito.
 */
export function weightyMilestones(plot) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const milestone of Array.isArray(plot?.milestones) ? plot.milestones : []) {
        const id = text(milestone?.id);
        if (!id) continue;
        const changes = isObject(milestone.changes) ? milestone.changes : {};
        const closes = Array.isArray(changes.close) && changes.close.some((/** @type {any} */ c) => text(c));
        const ends = Boolean(text(changes.ending)) || (isObject(changes.endingBy) && Object.keys(changes.endingBy).length > 0);
        const written = readNoReturn(milestone);
        if (written || closes || ends) out[id] = written || NO_RETURN;
    }
    return out;
}

/**
 * Los hitos que cumple una opción, se escriba como se escriba: `{"milestone": id}` en el
 * paquete, o `{kind: 'milestone', id}` ya leído (`dialogues.js`). También en las ramas de su
 * tirada: si sale bien (o mal) y eso cumple un hito que pesa, se avisa antes de tirar.
 *
 * @param {any} option
 * @returns {string[]}
 */
function milestonesOf(option) {
    const check = isObject(option?.check) ? option.check : null;
    const lists = [
        option?.effects,
        ...(check ? ['success', 'partial', 'failure'].map(k => (isObject(check[k]) ? check[k].effects : undefined)) : []),
    ];
    return lists.flatMap(list => (Array.isArray(list) ? list : list == null ? [] : [list]))
        .map(effect => (isObject(effect) ? (effect.kind === 'milestone' ? text(effect.id) : text(effect.milestone)) : ''))
        .filter(Boolean);
}

/**
 * El aviso de una opción: el suyo, si lo trae escrito (`irreversible`, o `noReturn` si ya se
 * leyó), o el del hito que pesa y que ella cumple.
 *
 * @param {any} option Una opción de charla, de escena o de suceso, leída o sin leer.
 * @param {Object} [input]
 * @param {Record<string, string>} [input.weighty] Los hitos que pesan (`weightyMilestones`).
 * @returns {string} Vacío si no hay que avisar.
 */
export function optionNoReturn(option, { weighty = {} } = {}) {
    if (!isObject(option)) return '';
    const written = text(option.noReturn) || readNoReturn(option);
    if (written) return written;
    const table = isObject(weighty) ? weighty : {};
    for (const id of milestonesOf(option)) {
        if (text(table[id])) return text(table[id]);
    }
    return '';
}

/**
 * El aviso de una acción fuera de una charla: entrar a pelear en un tablero, entregar un
 * encargo, ir a un sitio. Se prueba contra el hilo sin guardar nada: si cumpliría un hito que
 * pesa, o si cerraría un camino, se avisa.
 *
 * @param {Object} input
 * @param {any} input.plot El hilo leído (`readPlot`).
 * @param {any} input.state Por dónde va (`readPlotState`).
 * @param {any} input.event El suceso que mandaría la acción: `{kind: 'win', place, board}`,
 *   `{kind: 'contract', id, faction}`, `{kind: 'arrive', place}`…
 * @param {number} [input.today]
 * @returns {string} Vacío si no hay que avisar.
 */
export function actionNoReturn({ plot, state, event, today = 0 }) {
    if (!plot || !Array.isArray(plot.milestones) || !isObject(event)) return '';
    const weighty = weightyMilestones(plot);
    const step = plotEvent(plot, state, event, today);
    const hit = step.done.find(m => text(weighty[m.id]));
    if (hit) return text(weighty[hit.id]);
    return step.closed.length > 0 || text(step.changes.ending) ? NO_RETURN : '';
}

/**
 * Lo que se enseña al pedir que se confirme una acción que pesa: el título de siempre, lo que
 * se va a hacer y el aviso. Sin decir qué se pierde.
 *
 * @param {Object} input
 * @param {string} input.warning El de `actionNoReturn`.
 * @param {string} [input.what] Lo que se va a hacer, dicho corto: «Entrar en El salón del trono».
 * @returns {{title: string, text: string, ok: string, cancel: string}}
 */
export function noReturnConfirm({ warning, what = '' }) {
    const said = text(warning) || NO_RETURN;
    const doing = text(what).replace(/[.\s]+$/, '');
    return {
        ...NO_RETURN_CONFIRM,
        text: [doing ? `${doing}.` : '', said === NO_RETURN ? 'Lo que pase después no se puede deshacer.' : said].filter(Boolean).join(' '),
    };
}

/**
 * @typedef {Object} NoReturnIssue
 * @property {string} path
 * @property {string} message
 */

/**
 * Lo que está mal escrito en los avisos de un paquete: un `irreversible` que no es ni `true` ni
 * un texto (error), y un aviso demasiado largo o que dice qué se pierde (aviso: lo que se lee
 * antes de elegir no debe destripar nada).
 *
 * @param {any} pack
 * @returns {{errors: NoReturnIssue[], warnings: NoReturnIssue[]}}
 */
export function checkNoReturn(pack) {
    /** @type {NoReturnIssue[]} */
    const errors = [];
    /** @type {NoReturnIssue[]} */
    const warnings = [];
    /** @param {any} raw @param {string} path */
    const look = (raw, path) => {
        if (!isObject(raw)) return;
        for (const key of ['irreversible', 'sinVuelta']) {
            const said = raw[key];
            if (said === undefined || said === false) continue;
            if (said !== true && (typeof said !== 'string' || !text(said))) {
                errors.push({ path: `${path}.${key}`, message: `\`${key}\` es true, o un aviso corto en texto.` });
                continue;
            }
            const warning = readNoReturn({ [key]: said });
            if (warning.length > NO_RETURN_MAX) {
                warnings.push({ path: `${path}.${key}`, message: `El aviso es largo (${warning.length} letras): se lee en la ficha. Con \`true\` sale «${NO_RETURN}»` });
            }
            if (/\b(muere|morir[aá]|pierdes|perder[aá]s|cierra|se cierra|traici)/i.test(warning)) {
                warnings.push({ path: `${path}.${key}`, message: 'El aviso cuenta lo que pasa: mejor que solo diga que no se deshace.' });
            }
        }
    };
    const milestones = Array.isArray(pack?.plot?.milestones) ? pack.plot.milestones : [];
    milestones.forEach((/** @type {any} */ milestone, m) => {
        const path = `plot.milestones[${m}]`;
        look(milestone, path);
        (Array.isArray(milestone?.beats) ? milestone.beats : []).forEach((/** @type {any} */ beat, b) => {
            (Array.isArray(beat?.options) ? beat.options : []).forEach((/** @type {any} */ option, o) => look(option, `${path}.beats[${b}].options[${o}]`));
        });
    });
    (Array.isArray(pack?.dialogues) ? pack.dialogues : []).forEach((/** @type {any} */ dialogue, d) => {
        (Array.isArray(dialogue?.nodes) ? dialogue.nodes : []).forEach((/** @type {any} */ node, n) => {
            (Array.isArray(node?.options) ? node.options : []).forEach((/** @type {any} */ option, o) => look(option, `dialogues[${d}].nodes[${n}].options[${o}]`));
        });
    });
    return { errors, warnings };
}
