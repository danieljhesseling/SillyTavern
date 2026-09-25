/**
 * What the model said against what the engine knows.
 *
 * The three-layer rule of this project is that the engine owns the state and the model
 * only narrates it. That is enforced in the places it can be — the roll guard corrects
 * arithmetic, the epilogue is generated from facts — but nothing ever checked the prose
 * itself. So "el goblin cae, malherido" could be written about a goblin at full health,
 * and the only person who noticed was the player, three turns later, when it attacked.
 *
 * This reads the narration for claims it can check and writes down the ones that do not
 * match. It **changes nothing**: a narration that contradicts the state is a prompt
 * problem, and the fix for a prompt problem is a better prompt, not a silent rewrite of
 * what the model wrote. What this buys is data about where prompts fail, instead of a
 * feeling that they sometimes do.
 *
 * Pure: it is handed the text and the facts.
 *
 * See wiki/ROADMAP.md, Transversales · wiki/POR_HACER.md.
 */

/**
 * @typedef {Object} Contradiction
 * @property {string} kind What sort of claim it was.
 * @property {string} claim The words the model used.
 * @property {string} fact What the engine has.
 * @property {string} message Ready to read.
 */

/**
 * @typedef {Object} GameFacts
 * @property {Array<{name: string, hp: number, maxHp: number}>} [party]
 * @property {Array<{name: string, currentHp: number, maxHp: number}>} [enemies]
 * @property {number} [day]
 * @property {string} [slotLabel]
 * @property {string} [locationName]
 * @property {boolean} [combatActive]
 * @property {Array<{name: string, day?: number}>} [dead] Quien ha muerto de verdad (idea 141).
 */

/** Ways a text says somebody is dead or down. */
const FALLEN_WORDS = '(?:cae|muere|fallece|se desploma|queda fuera de combate|es derrotad[oa]|perece)';

/** Lo que dice alguien que habla (idea 141). Presente y pasado: «decía» es recordar, no hablar. */
const SPEECH_WORDS = '(?:dice|dijo|responde|respondió|grita|gritó|susurra|susurró|pregunta|preguntó|murmura|murmuró|contesta|contestó|exclama|exclamó)';

/** Lo que convierte hablar de un muerto en recordarlo: no es una contradicción. */
const REMEMBERING = /recuerd|antes de morir|tumba|lápida|fantasma|espíritu|en sueños|sueña|soñ|epitafio/i;

/** Ways a text states a hit-point total. */
const HP_PATTERN = /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ' -]{1,30}?)\s+(?:se queda|queda|está|esta|baja)\s+(?:a|en|con)\s+(\d{1,3})\s*(?:PG|HP|puntos de vida)/gi;

/**
 * @param {string} value
 * @returns {string}
 */
function clean(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Find who a name refers to among the people the engine knows.
 *
 * Loose on purpose: the model writes "el Guardián" for "Guardián del grano", and a check
 * that only matched exact names would report nothing and look like it worked.
 *
 * @param {string} name
 * @param {Array<{name: string}>} pool
 * @returns {any}
 */
function findByName(name, pool) {
    const needle = clean(name).toLowerCase().replace(/^(?:el|la|los|las)\s+/i, '');
    if (!needle) return null;

    return (Array.isArray(pool) ? pool : []).find(entry => {
        const candidate = clean(entry?.name).toLowerCase();
        return candidate === needle || candidate.includes(needle) || needle.includes(candidate);
    }) ?? null;
}

/**
 * Everything in this narration that the engine can say is not so.
 *
 * Only claims it can check. The model saying somebody looks tired is not a contradiction;
 * the model saying somebody is dead who has 14 hit points is.
 *
 * @param {string} text The narration.
 * @param {GameFacts} facts
 * @returns {Contradiction[]}
 */
export function findContradictions(text, facts = {}) {
    const prose = String(text ?? '');
    /** @type {Contradiction[]} */
    const found = [];
    if (!prose.trim()) return found;

    const everyone = [
        ...(facts.party ?? []).map(m => ({ name: m.name, hp: Number(m.hp) || 0, maxHp: Number(m.maxHp) || 0, side: 'grupo' })),
        ...(facts.enemies ?? []).map(e => ({ name: e.name, hp: Number(e.currentHp) || 0, maxHp: Number(e.maxHp) || 0, side: 'enemigo' })),
    ].filter(entry => clean(entry.name));

    // ---- somebody said to have fallen who has not ----
    for (const entry of everyone) {
        // Anclado en la palabra mas larga del nombre, no en el nombre entero: la
        // narracion escribe "el Guardian" por "Guardian del grano", y un patron que
        // pidiera el nombre completo no encontraria nunca nada y pareceria que funciona.
        const anchor = clean(entry.name).split(/\s+/).sort((a, b2) => b2.length - a.length)[0] ?? '';
        if (anchor.length < 3) continue;

        const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escaped}[^.!?\\n]{0,40}?\\b${FALLEN_WORDS}\\b`, 'i');
        const match = prose.match(pattern);
        if (match && entry.hp > 0) {
            found.push({
                kind: 'muerte',
                claim: clean(match[0]),
                fact: `${entry.name} tiene ${entry.hp}/${entry.maxHp} PG`,
                message: `La narración da por caído a ${entry.name}, que sigue con ${entry.hp} PG.`,
            });
        }
    }

    // ---- a hit-point total that is not the one on the sheet ----
    for (const match of prose.matchAll(HP_PATTERN)) {
        const entry = findByName(match[1], everyone);
        if (!entry) continue;
        const claimed = Number(match[2]);
        if (claimed === entry.hp) continue;

        found.push({
            kind: 'puntos de vida',
            claim: clean(match[0]),
            fact: `${entry.name}: ${entry.hp}/${entry.maxHp} PG`,
            message: `La narración deja a ${entry.name} en ${claimed} PG; el motor tiene ${entry.hp}.`,
        });
    }

    // ---- idea 141: somebody dead who speaks ----
    for (const dead of facts.dead ?? []) {
        const anchor = clean(dead.name).split(/\s+/).sort((a, b2) => b2.length - a.length)[0] ?? '';
        if (anchor.length < 3) continue;
        const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp(`\\b${escaped}\\b[^.!?\\n]{0,30}?\\b${SPEECH_WORDS}(?![\\wáéíóúñ])`, 'i'),
            new RegExp(`\\b${SPEECH_WORDS}\\s+${escaped}\\b`, 'i'),
            new RegExp(`\\b${escaped}\\s*:\\s*[«"—]`, 'i'),
        ];
        const match = patterns.map(p => prose.match(p)).find(Boolean);
        if (!match) continue;
        const sentence = prose.slice(Math.max(0, (match.index ?? 0) - 80), (match.index ?? 0) + match[0].length + 40);
        if (REMEMBERING.test(sentence)) continue;
        found.push({
            kind: 'muerto que habla',
            claim: clean(match[0]),
            fact: `${dead.name} murió${dead.day ? ` el día ${dead.day}` : ''}`,
            message: `La narración hace hablar a ${dead.name}, que murió${dead.day ? ` el día ${dead.day}` : ''}.`,
        });
    }

    // ---- a fight that is not happening ----
    if (facts.combatActive === false && /\b(?:tira(?:d)? iniciativa|comienza el combate|empieza el combate|\[COMBAT\])/i.test(prose)) {
        const match = prose.match(/[^.!?\n]*\b(?:tira(?:d)? iniciativa|comienza el combate|empieza el combate)[^.!?\n]*/i);
        found.push({
            kind: 'combate',
            claim: clean(match?.[0] ?? 'combate declarado'),
            fact: 'no hay ningún encuentro activo',
            message: 'La narración declara un combate que el motor no ha empezado.',
        });
    }

    // ---- a time of day the calendar does not agree with ----
    const slot = clean(facts.slotLabel).toLowerCase();
    if (slot) {
        const others = ['mañana', 'tarde', 'noche', 'madrugada'].filter(word => !slot.includes(word));
        for (const word of others) {
            const pattern = new RegExp(`\\b(?:es|era|cae|llega) la ${word}\\b|\\bpor la ${word}\\b`, 'i');
            const match = prose.match(pattern);
            if (!match) continue;
            found.push({
                kind: 'momento del día',
                claim: clean(match[0]),
                fact: `el calendario dice "${facts.slotLabel}"`,
                message: `La narración sitúa la escena en la ${word}; el calendario dice "${facts.slotLabel}".`,
            });
            break;
        }
    }

    return found;
}

/** How many entries the log keeps. Old ones stop being data and start being weight. */
const LOG_LIMIT = 100;

/**
 * Add what was found to the running log.
 *
 * Kept with the chat, like everything else about a campaign, so the record survives a
 * reload and can be read at the end of a session rather than watched in real time.
 *
 * @param {any} log
 * @param {Contradiction[]} found
 * @param {{day?: number, at?: string}} [context]
 * @returns {{entries: any[], total: number}}
 */
export function appendContradictions(log, found, context = {}) {
    const current = {
        entries: Array.isArray(log?.entries) ? log.entries : [],
        total: Number(log?.total) || 0,
    };
    if (!Array.isArray(found) || found.length === 0) return current;

    const stamped = found.map(item => ({
        ...item,
        day: Number(context.day) || 0,
        at: String(context.at ?? new Date().toISOString()),
    }));

    return {
        entries: [...current.entries, ...stamped].slice(-LOG_LIMIT),
        total: current.total + stamped.length,
    };
}

/**
 * What the log says, grouped by the kind of mistake.
 *
 * Grouped because one contradiction is an accident and twenty of the same kind is a
 * prompt that needs a line adding to it — and telling those apart is the whole reason
 * this exists.
 *
 * @param {any} log
 * @returns {{total: number, kept: number, byKind: Array<{kind: string, count: number, last: string}>}}
 */
export function summariseContradictions(log) {
    const entries = Array.isArray(log?.entries) ? log.entries : [];
    /** @type {Map<string, {count: number, last: string}>} */
    const byKind = new Map();

    for (const entry of entries) {
        const kind = String(entry?.kind ?? 'otra');
        const seen = byKind.get(kind) ?? { count: 0, last: '' };
        byKind.set(kind, { count: seen.count + 1, last: String(entry?.message ?? seen.last) });
    }

    return {
        total: Number(log?.total) || entries.length,
        kept: entries.length,
        byKind: [...byKind.entries()]
            .map(([kind, info]) => ({ kind, ...info }))
            .sort((a, b) => b.count - a.count),
    };
}
