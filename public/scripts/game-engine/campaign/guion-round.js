/**
 * Lo corregido en el Word del taller, como una ronda del guion (J5.10 de ROADMAP_SIN_CONEXION).
 *
 * El taller de campañas (J5.9) convierte las rondas del Gem guionista en una campaña, y el Word
 * (J5.8) la corrige línea a línea. Esas correcciones se quedaban en la campaña del taller: si se
 * volvían a subir las rondas, se perdían. Aquí salen también como una ronda más,
 * `ronda-N-correcciones.md`, con bloques YAML que repiten el id de lo que corrigen y traen solo
 * lo que cambia, como `wiki/guiones/1387/ronda-12-claude-decisiones.md`. Se guarda con las otras
 * rondas, que siguen siendo la fuente completa, y el conversor la pone encima.
 *
 * Cada línea del Word dice de dónde sale en el paquete (`src.path`), y el paquete del guion sale
 * de sus bloques en orden (`buildGuionPack` en `guion-pack.js`): cada ruta tiene su bloque y su
 * campo. Lo que no sale de ningún bloque se dice aparte, al final de la ronda, sin YAML.
 *
 * Puro: recibe y devuelve datos.
 */

/** @param {any} value @returns {string} */
const text = (value) => String(value ?? '').trim();

/** @param {any} v */
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** @param {any} v @returns {any} */
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/**
 * @typedef {Object} Correction Una línea cambiada en el Word.
 * @property {Array<string|number>} path Dónde está en el paquete.
 * @property {string} before Lo que decía al exportar el Word.
 * @property {string} after Lo que dice ahora.
 */

/**
 * Las correcciones de varios Word, juntas: de una misma línea cuenta lo último que se escribió,
 * y lo que vuelve a quedar como estaba deja de ser una corrección.
 *
 * @param {Correction[]} previous
 * @param {Correction[]} [changes]
 * @returns {Correction[]}
 */
export function mergeCorrections(previous, changes = []) {
    /** @type {Map<string, Correction>} */
    const out = new Map();
    for (const change of [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(changes) ? changes : [])]) {
        if (!change || !Array.isArray(change.path) || change.path.length === 0) continue;
        const key = JSON.stringify(change.path);
        const first = out.get(key);
        out.set(key, { path: [...change.path], before: first ? first.before : String(change.before ?? ''), after: String(change.after ?? '') });
    }
    return [...out.values()].filter(c => c.after !== c.before);
}

/**
 * El nombre de la ronda nueva: la siguiente a la última, `ronda-13-correcciones.md`.
 *
 * @param {string[]} files Las rondas que hay.
 * @returns {string}
 */
export function nextRoundName(files) {
    const numbers = (Array.isArray(files) ? files : []).map(name => Number((text(name).split(/[\\/]/).pop() ?? '').match(/^ronda-(\d+)/)?.[1] ?? 0));
    return `ronda-${Math.max(0, ...numbers) + 1}-correcciones.md`;
}

/** Lo que se llama distinto en el paquete y en el guion, por tipo de bloque. */
const FIELDS = {
    hito: { title: 'titulo', hint: 'pista', scene: 'escena' },
    final: { title: 'titulo', scene: 'escena' },
    encuentro: { name: 'nombre', description: 'nota' },
    localidad: { description: 'descripcion', name: 'nombre' },
    pnj: { knows: 'sabe', wants: 'quiere', secret: 'secreto', voice: 'voz', trade: 'oficio', name: 'nombre' },
    rumor: { text: 'texto', truth: 'verdad' },
    encargo: { title: 'titulo', rewardText: 'recompensa', twist: 'giro', verb: 'verbo' },
    confidente: { description: 'descripcion', name: 'nombre' },
};

/** Cómo se agrupan los bloques en la ronda, y en qué orden. */
const SECTIONS = [
    ['La historia', ['mundo', 'hito', 'final']],
    ['Las peleas', ['encuentro']],
    ['Los sitios', ['localidad']],
    ['La gente', ['pnj', 'confidente']],
    ['Encargos y rumores', ['encargo', 'rumor']],
];

/**
 * Dónde va una corrección en el guion: su bloque y lo que se escribe en él.
 *
 * `write(data)` pone el cambio en lo que se va a escribir del bloque. Las listas que el
 * conversor sustituye enteras (el presagio, los epílogos) se escriben enteras, con el cambio;
 * las escenas de un confidente, que se corrigen por su rango, de una en una.
 *
 * @param {Correction} change
 * @param {any} pack El paquete tal como salió del guion (sin corregir).
 * @param {Record<string, Map<string, any>>} byKind
 * @returns {{kind: string, id: string, write: (data: any) => boolean}|null}
 */
function routeOf(change, pack, byKind) {
    const path = change.path;
    const shape = path.map(step => (typeof step === 'number' ? '#' : String(step))).join('.');
    const after = change.after;
    const n = Number(path[1]);
    /** Un campo suelto del bloque. @param {string} kind @param {string} id @param {string} field */
    const plain = (kind, id, field) => {
        const key = /** @type {Record<string, string>} */ (FIELDS[/** @type {keyof typeof FIELDS} */ (kind)] ?? {})[field];
        if (!id || !key || !byKind[kind]?.has(id)) return null;
        return { kind, id, write: (/** @type {any} */ data) => { data[key] = after; return true; } };
    };
    const blockOf = (/** @type {string} */ kind, /** @type {string} */ id) => byKind[kind]?.get(id) ?? null;

    if (shape === 'world.synopsis') return { kind: 'mundo', id: 'mundo', write: (data) => { data.sinopsis = after; return true; } };
    if (/^plot\.milestones\.#\.(title|hint|scene)$/.test(shape)) return plain('hito', text(pack?.plot?.milestones?.[Number(path[2])]?.id), String(path[3]));
    if (shape === 'plot.omens.#.text') {
        const omen = pack?.plot?.omens?.[Number(path[2])];
        const world = blockOf('mundo', 'mundo');
        if (!omen || !Array.isArray(world?.presagio)) return null;
        return {
            kind: 'mundo', id: 'mundo', write: (data) => {
                data.presagio = data.presagio ?? clone(world.presagio);
                const at = data.presagio.findIndex((/** @type {any} */ p) => text(p?.se_cumple) === text(omen.milestone) && text(p?.frase) === text(omen.text));
                if (at < 0) return false;
                data.presagio[at].frase = after;
                return true;
            },
        };
    }
    if (path[0] === 'plot' && path[1] === 'endings' && path.length === 4) return plain('final', text(path[2]), String(path[3]));
    if (path[0] === 'plot' && path[1] === 'endings' && path[3] === 'epilogues' && path[5] === 'text') {
        const ending = blockOf('final', text(path[2]));
        if (!Array.isArray(ending?.epilogos)) return null;
        return {
            kind: 'final', id: text(path[2]), write: (data) => {
                data.epilogos = data.epilogos ?? clone(ending.epilogos);
                // El conversor se salta los epílogos vacíos: el número k del paquete es el k-ésimo con texto.
                const said = data.epilogos.map((/** @type {any} */ e, /** @type {number} */ i) => [e, i])
                    .filter((/** @type {any} */ [e]) => text(typeof e === 'string' ? e : e?.texto));
                const hit = said[Number(path[4])];
                if (!hit) return false;
                if (typeof hit[0] === 'string') data.epilogos[hit[1]] = after;
                else data.epilogos[hit[1]].texto = after;
                return true;
            },
        };
    }
    if (/^quests\.#\.(name|description)$/.test(shape)) return plain('encuentro', text(pack?.quests?.[n]?.boardId), String(path[2]));
    if (shape === 'quests.#.objectives.#.label') {
        const id = text(pack?.quests?.[n]?.boardId);
        if (!byKind.encuentro?.has(id)) return null;
        return { kind: 'encuentro', id, write: (data) => { data.meta = after; return true; } };
    }
    if (/^locations\.#\.(description|name)$/.test(shape)) {
        const name = text(pack?.locations?.[n]?.name);
        const id = [...(byKind.localidad ?? new Map())].find(([, l]) => text(l?.nombre) === name)?.[0] ?? '';
        return plain('localidad', id, String(path[2]));
    }
    if (/^npcs\.#\.\w+$/.test(shape)) return plain('pnj', text(pack?.npcs?.[n]?.id), String(path[2]));
    if (/^rumors\.#\.(text|truth)$/.test(shape)) return plain('rumor', text(pack?.rumors?.[n]?.id), String(path[2]));
    if (/^contracts\.#\.\w+$/.test(shape)) return plain('encargo', text(pack?.contracts?.[n]?.id), String(path[2]));
    // Los compañeros no llevan id en el paquete: salen de sus bloques en el mismo orden.
    const confidantId = path[0] === 'confidants' ? text([...(byKind.confidente ?? new Map()).keys()][n]) : '';
    if (/^confidants\.#\.(description|name)$/.test(shape)) return plain('confidente', confidantId, String(path[2]));
    if (/^confidants\.#\.scenes\.#\.(title|scene)$/.test(shape)) {
        const block = blockOf('confidente', confidantId);
        const scene = pack?.confidants?.[n]?.scenes?.[Number(path[3])];
        if (!block || !scene) return null;
        const field = path[4] === 'title' ? 'titulo' : 'escena';
        const written = Array.isArray(block.escenas) ? block.escenas : [];
        // Con su rango, el conversor corrige la escena de ese rango y deja las demás; sin él, la
        // lista entera se sustituye, así que va entera.
        const byRank = written.length > 0 && written.every((/** @type {any} */ s) => isObject(s) && 'rango' in s);
        return {
            kind: 'confidente', id: confidantId, write: (data) => {
                if (byRank) {
                    data.escenas = data.escenas ?? [];
                    let item = data.escenas.find((/** @type {any} */ s) => Number(s.rango) === Number(scene.rank));
                    if (!item) data.escenas.push(item = { rango: Number(scene.rank) });
                    item[field] = after;
                } else {
                    data.escenas = data.escenas ?? clone(written);
                    const item = data.escenas[Number(path[3])];
                    if (!isObject(item)) return false;
                    item[field] = after;
                }
                return true;
            },
        };
    }
    if (shape === 'confidants.#.arrivals.#.line') {
        const arrival = pack?.confidants?.[n]?.arrivals?.[Number(path[3])];
        const place = [...(byKind.localidad ?? new Map())].find(([, l]) => text(l?.nombre) === text(arrival?.place))?.[0] ?? '';
        if (!place || !byKind.confidente?.has(confidantId)) return null;
        return { kind: 'confidente', id: confidantId, write: (data) => { data.al_llegar = { ...(data.al_llegar ?? {}), [place]: after }; return true; } };
    }
    return null;
}

/**
 * Un texto en YAML, como los escriben las rondas: entre comillas simples; con saltos de línea,
 * entre dobles (JSON también es YAML).
 *
 * @param {any} value
 * @returns {string}
 */
function scalar(value) {
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const s = String(value ?? '');
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f]/.test(s)) return JSON.stringify(s);
    return `'${s.replace(/'/g, '\'\'')}'`;
}

/** @param {string} key */
const keyOf = (key) => (/^[a-z0-9_][a-z0-9_-]*$/i.test(key) ? key : JSON.stringify(key));

/**
 * Las líneas YAML de un valor, sangradas.
 *
 * @param {any} value
 * @param {number} indent
 * @returns {string[]}
 */
function yamlLines(value, indent) {
    const pad = ' '.repeat(indent);
    if (Array.isArray(value)) {
        return value.flatMap(item => {
            if (isObject(item) || Array.isArray(item)) {
                const inner = yamlLines(item, indent + 2);
                return inner.length > 0 ? [`${pad}- ${inner[0].trimStart()}`, ...inner.slice(1)] : [`${pad}- {}`];
            }
            return [`${pad}- ${scalar(item)}`];
        });
    }
    if (isObject(value)) {
        return Object.entries(value).flatMap(([key, inner]) => {
            if (Array.isArray(inner) && inner.length === 0) return [`${pad}${keyOf(key)}: []`];
            if (Array.isArray(inner) || isObject(inner)) return [`${pad}${keyOf(key)}:`, ...yamlLines(inner, indent + 2)];
            return [`${pad}${keyOf(key)}: ${scalar(inner)}`];
        });
    }
    return [`${pad}${scalar(value)}`];
}

/** Un texto en una línea y corto, para los comentarios. @param {string} said */
const short = (said) => {
    const flat = text(said).replace(/\s+/g, ' ');
    return flat.length > 90 ? `${flat.slice(0, 89)}…` : flat;
};

/**
 * @typedef {Object} CorrectionsRound
 * @property {string} name El archivo: `ronda-13-correcciones.md`.
 * @property {string} text La ronda entera, en Markdown con bloques YAML.
 * @property {number} placed Las correcciones que van en un bloque.
 * @property {Correction[]} unplaced Las que no salen de ningún bloque del guion.
 * @property {string} said Lo que se dice al descargarla.
 */

/**
 * La ronda con lo corregido en el Word.
 *
 * @param {Object} input
 * @param {Correction[]} input.changes Lo corregido (`mergeCorrections`).
 * @param {any} input.pack El paquete tal como salió del guion, sin corregir (`convertGuion(...).pack`).
 * @param {Record<string, Map<string, any>>} input.byKind Los bloques del guion (`convertGuion(...).byKind`).
 * @param {string[]} [input.files] Las rondas que hay, para el número de la nueva.
 * @param {string} [input.title] El nombre de la campaña.
 * @param {string} [input.date] La fecha, `2026-10-03`.
 * @returns {CorrectionsRound}
 */
export function correctionsRound({ changes, pack, byKind, files = [], title = '', date = '' }) {
    const name = nextRoundName(files);
    const number = Number(name.match(/\d+/)?.[0] ?? 1);
    /** @type {Map<string, {kind: string, id: string, data: any, before: string[]}>} */
    const blocks = new Map();
    /** @type {Correction[]} */
    const unplaced = [];
    let placed = 0;
    for (const change of Array.isArray(changes) ? changes : []) {
        const route = byKind ? routeOf(change, pack, byKind) : null;
        if (!route) {
            unplaced.push(change);
            continue;
        }
        const key = `${route.kind}|${route.id}`;
        const block = blocks.get(key) ?? { kind: route.kind, id: route.id, data: route.kind === 'mundo' ? {} : { id: route.id }, before: [] };
        if (!route.write(block.data)) {
            unplaced.push(change);
            continue;
        }
        block.before.push(short(change.before));
        blocks.set(key, block);
        placed++;
    }

    const lines = [
        `# Ronda ${number}: lo corregido en el Word${text(title) ? ` («${text(title)}»)` : ''}`,
        '',
        `> Correcciones hechas en el Word del guion, desde el taller de campañas del juego${text(date) ? ` (${text(date)})` : ''}.`,
        '> Cada bloque repite el id de lo que corrige y trae solo lo que cambia: el conversor lo pone',
        '> encima de las rondas anteriores. Guárdala con ellas.',
    ];
    for (const [heading, kinds] of SECTIONS) {
        const here = [...blocks.values()].filter(b => kinds.includes(b.kind))
            .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
        if (here.length === 0) continue;
        lines.push('', `## ${heading}`);
        for (const block of here) {
            lines.push('', `${block.kind}:`, ...block.before.map(said => `  # Antes: «${said}»`), ...yamlLines(block.data, 2));
        }
    }
    if (unplaced.length > 0) {
        lines.push('', '## Lo que no sale de ningún bloque del guion', '',
            'Esto lo puso el juego al convertir el guion, no un bloque de las rondas. Si quieres que se quede, escríbelo en una ronda con su bloque.', '',
            ...unplaced.map(c => `- «${short(c.before)}» → «${text(c.after).replace(/\s+/g, ' ')}»`));
    }
    const said = placed === 0 && unplaced.length === 0
        ? 'No hay correcciones del Word que guardar.'
        : `${name}: ${placed} ${placed === 1 ? 'corrección' : 'correcciones'} en ${blocks.size} ${blocks.size === 1 ? 'bloque' : 'bloques'}`
            + `${unplaced.length > 0 ? `; ${unplaced.length} sin bloque en el guion (van al final, sin YAML)` : ''}.`;
    return { name, text: `${lines.join('\n')}\n`, placed, unplaced, said };
}
