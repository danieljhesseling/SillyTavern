/**
 * ProbarCampañas (J16.6 de wiki/ROADMAP_SIN_CONEXION.md): lee el registro de una vuelta del bot
 * (`tools/vuelta-*.mjs`) y dice qué tal ha ido, en tres montones:
 *
 * - **Bien**: llega a un final sin silencios, sin atascos y sin errores en la página.
 * - **Regular**: llega a un final, pero con silencios, atascos rescatados, turnos jugados con el
 *   gancho, clics lentos o alguna comprobación que no pasa.
 * - **Mal**: se queda antes de un final, la vuelta se rompe o hay errores en la página.
 *
 * Las vueltas escriben líneas con su marca al principio (`PASS`, `FAIL`, `NUM`, `MUDO`,
 * `ATASCO`, `RARO`, `GANCHO`) y, al final, sus listas («--- los silencios ---»…). Aquí se leen
 * esas líneas y nada más: si una vuelta cambia lo que escribe, se toca aquí.
 *
 * Puro: sin archivos ni procesos. Lo usan `servidor.mjs` y su prueba
 * (`tests/probar-campanas.test.js`).
 */

/** Las listas del final de una vuelta, por su cabecera. */
const SECTIONS = [
    [/^--- los silencios/, 'silences'],
    [/^--- los atascos/, 'blocks'],
    [/^--- lo que se ve mal/, 'oddities'],
    [/^--- el grupo ha caído/, 'falls'],
    [/^--- los clics lentos/, 'slow'],
    [/^--- lo que se eligió/, 'choices'],
    [/^--- los hitos que no se cumplieron/, 'missing'],
    [/^--- los números/, 'numbers'],
];

/** La comprobación de los errores de la página: su fallo es «Mal» por sí solo. */
export const PAGE_ERRORS_CHECK = /sin errores en la página/i;

/** Un sitio, como lo dice el bot: «1387 · Castillo de Vane · día 4» (el día siempre al final). */
const WHERE_AND_WHAT = /^#(\d+) (.*? · día \d+) · (.*)$/;

/**
 * El registro de una vuelta, leído.
 *
 * @param {string} text Todo lo que ha escrito la vuelta.
 * @returns {{
 *   checks: Array<{ok: boolean, name: string, detail: string}>,
 *   numbers: Array<{key: string, value: string}>,
 *   silences: Array<{n: number, where: string, what: string, sees: string, module: string}>,
 *   blocks: Array<{n: number, where: string, what: string, sees: string, rescue: string}>,
 *   oddities: Array<{n: number, where: string, kind: string, text: string}>,
 *   falls: Array<{n: number, where: string, text: string, ways: string}>,
 *   slow: Array<{ms: number, text: string}>,
 *   missing: string[],
 *   hooks: string[],
 *   threw: string,
 *   lastWhere: string,
 *   lastStep: string,
 *   steps: number,
 *   milestones: number,
 *   oneLine: string,
 *   live: {silences: number, blocks: number, oddities: number},
 *   said: number,
 * }}
 */
export function readLog(text) {
    const lines = String(text ?? '').replace(/\r/g, '').split('\n');
    /** @type {ReturnType<typeof readLog>} */
    const out = {
        checks: [], numbers: [], silences: [], blocks: [], oddities: [], falls: [], slow: [], missing: [], hooks: [],
        threw: '', lastWhere: '', lastStep: '', steps: 0, milestones: 0, oneLine: '', live: { silences: 0, blocks: 0, oddities: 0 }, said: 0,
    };
    /** @type {string} */
    let section = '';
    /** @type {any} */
    let last = null;
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        const trimmed = line.trim();
        // Una línea sin sangría empieza otra cosa: lo de debajo ya no es de la anterior.
        if (/^\S/.test(line)) last = null;
        // Lo que dice la vuelta mientras juega (no la primera línea, la de qué campaña es).
        if (trimmed && !/^La campaña/.test(trimmed)) out.said++;
        // Las cabeceras de las listas del final.
        if (/^--- /.test(trimmed)) {
            section = SECTIONS.find(([re]) => /** @type {RegExp} */ (re).test(trimmed))?.[1] ?? 'other';
            last = null;
            continue;
        }
        // Una comprobación, con su detalle en las líneas de debajo («        -> …»).
        const check = /^(PASS|FAIL) {2}(.*)$/.exec(line);
        if (check) {
            last = { ok: check[1] === 'PASS', name: check[2].trim(), detail: '' };
            out.checks.push(last);
            const threw = /^the run threw: (.*)$/.exec(last.name);
            if (!last.ok && threw) out.threw = threw[1];
            section = '';
            continue;
        }
        if (last && 'detail' in last && /^ {8}/.test(line) && !section) {
            last.detail = `${last.detail}${last.detail ? '\n' : ''}${trimmed.replace(/^-> /, '')}`;
            continue;
        }
        const number = /^NUM {3}(.*?): (.*)$/.exec(line);
        if (number) {
            out.numbers.push({ key: number[1].trim(), value: number[2].trim() });
            continue;
        }
        if (/^MUDO /.test(line)) { out.live.silences++; continue; }
        if (/^ATASCO /.test(line)) { out.live.blocks++; continue; }
        if (/^RARO /.test(line)) { out.live.oddities++; continue; }
        if (/^GANCHO /.test(line)) { out.hooks.push(trimmed.replace(/^GANCHO\s+/, '')); continue; }
        if (/^EN UNA FRASE: /.test(line)) { out.oneLine = trimmed.replace(/^EN UNA FRASE: /, ''); continue; }
        // El avance: «  hito: x (5 hechos) · sitio · paso 120» y «  · paso 40: qué · sitio».
        const milestone = /^ {2}hito: .*?\((\d+) hechos\) · (.*) · paso (\d+)$/.exec(line);
        if (milestone) {
            out.milestones = Number(milestone[1]);
            out.lastWhere = milestone[2];
            out.steps = Math.max(out.steps, Number(milestone[3]));
            continue;
        }
        const step = /^ {2}· (?:paso )?(\d+):? (.*)$/.exec(line);
        if (step && !section) {
            out.steps = Math.max(out.steps, Number(step[1]));
            const at = / · ([^·]+ · [^·]+(?: · [^·]+)? · día \d+)(?: · .*)?$/.exec(step[2]);
            if (at) out.lastWhere = at[1];
            out.lastStep = step[2].replace(/ · [^·]+ · [^·]+(?: · [^·]+)? · día \d+(?: · .*)?$/, '').slice(0, 200);
            continue;
        }
        if (!section || section === 'other' || section === 'choices') continue;
        if (/^\((ninguno|nada|nunca)\)$/.test(trimmed)) continue;
        // Las listas del final: una entrada por «  #n …», con sus líneas de debajo.
        if (section === 'numbers') continue;
        if (section === 'missing') {
            if (/^ {2}\S/.test(line)) out.missing.push(trimmed);
            continue;
        }
        if (section === 'slow') {
            const slow = /^(\d+) ms · (.*)$/.exec(trimmed);
            if (slow) out.slow.push({ ms: Number(slow[1]), text: slow[2] });
            continue;
        }
        const head = /^ {2}#/.test(line) ? WHERE_AND_WHAT.exec(trimmed) : null;
        if (head) {
            const n = Number(head[1]);
            if (section === 'silences') { last = { n, where: head[2], what: head[3], sees: '', module: '' }; out.silences.push(last); }
            if (section === 'blocks') { last = { n, where: head[2], what: head[3], sees: '', rescue: '' }; out.blocks.push(last); }
            if (section === 'oddities') {
                const kind = /^([^:]+): (.*)$/.exec(head[3]);
                last = { n, where: head[2], kind: kind ? kind[1] : '', text: kind ? kind[2] : head[3] };
                out.oddities.push(last);
            }
            if (section === 'falls') { last = { n, where: head[2], text: head[3], ways: '' }; out.falls.push(last); }
            continue;
        }
        const more = /^ {6}(se ve|módulo|rescate|salidas): (.*)$/.exec(line);
        if (more && last) {
            const key = { 'se ve': 'sees', módulo: 'module', rescate: 'rescue', salidas: 'ways' }[more[1]];
            if (key && key in last) last[key] = more[2];
        }
    }
    return out;
}

/**
 * Un número de la sección 6, por el principio de su nombre («Silencios», «El final»…).
 *
 * @param {Array<{key: string, value: string}>} numbers
 * @param {RegExp} key
 * @returns {string}
 */
export function numberOf(numbers, key) {
    return numbers.find(n => key.test(n.key))?.value ?? '';
}

/** Lo primero que es un número entero en un texto («3 (el peor, 2100 ms)» → 3). */
const firstInt = (/** @type {string} */ value) => Number(/\d+/.exec(String(value ?? ''))?.[0] ?? 0) || 0;

/**
 * El final de una vuelta, leído de su comprobación: el JSON que deja en el detalle
 * (`{ending, gaveUp, where, sees}`), si lo hay.
 *
 * @param {string} detail
 * @returns {{gaveUp: string, where: string, sees: string}}
 */
function endingDetail(detail) {
    try {
        const at = String(detail ?? '').indexOf('{');
        const data = at >= 0 ? JSON.parse(String(detail).slice(at)) : null;
        return { gaveUp: String(data?.gaveUp ?? ''), where: String(data?.where ?? ''), sees: String(data?.sees ?? '') };
    } catch {
        return { gaveUp: '', where: '', sees: '' };
    }
}

/**
 * Qué tal ha ido una vuelta: Bien, Regular o Mal, con sus razones dichas en llano.
 *
 * @param {ReturnType<typeof readLog>} log
 * @param {object} how
 * @param {RegExp|null} how.endCheck La comprobación de llegar al final; `null`: todas las
 *   comprobaciones son el camino (la vuelta del gremio: el prólogo, contratar, 1387, Strahd…).
 * @param {number|null} [how.exitCode] Con qué acabó el proceso (`null`: lo cortó una señal).
 * @param {boolean} [how.stopped] Si la paró quien la miraba («Parar»).
 * @param {boolean} [how.timedOut] Si se cortó por tardar demasiado.
 * @returns {{verdict: 'bien'|'regular'|'mal'|'parada', reasons: string[], reached: boolean, where: string, sees: string, ending: string,
 *   counts: {silences: number, blocks: number, hooked: number, slow: number, oddities: number, pageErrors: number}, failed: Array<{name: string, detail: string}>}}
 */
export function classify(log, { endCheck, exitCode = 0, stopped = false, timedOut = false }) {
    const pageCheck = log.checks.find(c => PAGE_ERRORS_CHECK.test(c.name));
    const pageErrors = pageCheck && !pageCheck.ok ? pageCheck.detail.split('\n').filter(Boolean) : [];
    const threwCheck = log.checks.find(c => !c.ok && /^the run threw:/.test(c.name));
    const journey = log.checks.filter(c => c !== pageCheck && c !== threwCheck && (endCheck ? endCheck.test(c.name) : true));
    const reached = journey.length > 0 && journey.every(c => c.ok);
    const endFail = journey.find(c => !c.ok);
    const failed = log.checks.filter(c => !c.ok && c !== pageCheck && c !== threwCheck && !journey.includes(c)).map(c => ({ name: c.name, detail: c.detail }));
    const num = (/** @type {RegExp} */ key) => numberOf(log.numbers, key);
    // Los números de la vuelta; si no llegó a escribirlos (se rompió antes), lo visto en vivo.
    const counts = {
        silences: num(/^Silencios/) !== '' ? firstInt(num(/^Silencios/)) : Math.max(log.silences.length, log.live.silences),
        blocks: num(/^Atascos/) !== '' ? firstInt(num(/^Atascos/)) : Math.max(log.blocks.length, log.live.blocks),
        hooked: firstInt(num(/^Turnos del grupo jugados con el gancho/)),
        slow: num(/^Clics lentos/) !== '' ? firstInt(num(/^Clics lentos/)) : log.slow.length,
        oddities: log.oddities.filter(o => o.kind !== 'gancho').length,
        pageErrors: pageErrors.length,
    };
    const fromEnd = endingDetail(endFail?.detail ?? '');
    const where = fromEnd.where || log.blocks[log.blocks.length - 1]?.where || log.lastWhere;
    const sees = fromEnd.sees || log.blocks[log.blocks.length - 1]?.sees || '';
    const ending = num(/^El final/);

    if (stopped) return { verdict: 'parada', reasons: ['La paraste tú con «Parar».'], reached, where, sees, ending, counts, failed };

    /** @type {string[]} */
    const bad = [];
    if (timedOut) bad.push('No ha terminado a tiempo: se ha cortado.');
    if (log.threw) bad.push(`La vuelta se ha roto: ${log.threw}`);
    if (!log.threw && !timedOut && log.checks.length === 0) bad.push(`La vuelta se ha cortado sin decir nada (código ${exitCode ?? 'señal'}).`);
    if (!reached && endFail) bad.push(`Se queda antes de llegar al final: no pasa «${endFail.name}»${fromEnd.gaveUp ? ` (${fromEnd.gaveUp})` : ''}.`);
    else if (!reached && !log.threw && !timedOut && log.checks.length > 0) bad.push('No llega a un final.');
    // Lo que falla antes suele ser la causa: se dice también.
    const first = log.checks.find(c => !c.ok && c !== threwCheck && c !== pageCheck);
    if (!reached && first && first !== endFail) bad.push(`Lo primero que falla: «${first.name}»${first.detail ? ` (${first.detail.split('\n')[0].slice(0, 200)})` : ''}.`);
    if (pageErrors.length > 0) bad.push(`${pageErrors.length} error(es) en la página: ${pageErrors[0].slice(0, 200)}`);
    if (bad.length > 0) return { verdict: 'mal', reasons: bad, reached, where, sees, ending, counts, failed };

    /** @type {string[]} */
    const meh = [];
    if (counts.silences > 0) meh.push(`${counts.silences} silencio(s): un clic tras el que no cambia nada que se vea.`);
    if (counts.blocks > 0) meh.push(`${counts.blocks} atasco(s): lo que pedía la historia no estaba a la vista y hubo que rescatarla con un comando.`);
    if (counts.hooked > 0) meh.push(`${counts.hooked} turno(s) del grupo jugados con el gancho: la barra de combate no respondía.`);
    if (counts.slow > 0) meh.push(`${counts.slow} clic(s) lento(s), de más de 1,5 s.`);
    for (const f of failed) meh.push(`No pasa: ${f.name}.`);
    if (meh.length > 0) return { verdict: 'regular', reasons: meh, reached, where, sees, ending, counts, failed };
    return { verdict: 'bien', reasons: ['Llega a un final sin silencios, sin atascos y sin errores en la página.'], reached, where, sees, ending, counts, failed };
}

/**
 * El avance de una vuelta mientras se juega, para la barra: lo que dicen sus líneas hasta ahora.
 *
 * @param {ReturnType<typeof readLog>} log
 * @returns {{steps: number, milestones: number, where: string, step: string, silences: number, blocks: number, oddities: number, phase: string}}
 */
export function progressOf(log) {
    // La vuelta no escribe nada mientras enciende su juego: en cuanto escribe algo, ya juega.
    const started = log.checks.length > 0 || log.steps > 0 || log.said > 0;
    const counting = log.numbers.length > 0;
    return {
        steps: log.steps,
        milestones: log.milestones,
        where: log.lastWhere,
        step: log.lastStep,
        silences: log.live.silences,
        blocks: log.live.blocks,
        oddities: log.live.oddities,
        phase: counting ? 'Haciendo el recuento' : started ? 'Jugando' : 'Arrancando el juego (tarda un par de minutos)',
    };
}
