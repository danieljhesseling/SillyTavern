/**
 * The blank canvas: a playable world from one sentence.
 *
 * The rule that shapes this module is that the AI produces **exactly what a starter
 * template produces** — same fields, same ASCII map, same enemy shape — and then goes
 * through the same code that has always built worlds. Nothing here writes to the game.
 * A generated world that reached the board by a private path would be a second way for
 * campaigns to exist, and the two would drift.
 *
 * So the AI is a source of template data, not a feature of its own. If it fails, is not
 * configured, or returns nonsense, the wizard still works with the four hand-written
 * templates: the way into the game never depends on a provider answering.
 *
 * Pure module. The caller injects the generator, so this is testable without a model and
 * without a browser.
 *
 * See wiki/ROADMAP.md, Fase F · PROP-124.
 */

import { ASCII_TERRAIN } from '../board/terrain.js';

/** Tactical profiles the combat engine knows. Anything else is corrected to the first. */
const PROFILES = ['aggressive', 'skirmisher', 'guardian', 'coward'];

/** Board limits. Small enough to fit on screen, big enough for a fight to have shape. */
const MIN_WIDTH = 8;
const MAX_WIDTH = 30;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 24;

/** How many characters a party can start with, and how many enemies a board may define. */
const MAX_ENEMIES = 6;
const MAX_PARTY = 6;

/** Characters the map may use. Read from the terrain table so the two cannot drift. */
const MAP_CHARS = Object.keys(ASCII_TERRAIN).join('');

/**
 * The schema the model is asked to fill.
 *
 * Deliberately flat and small. Every field here has to survive validation on the way back,
 * and each one that does not earn its place is another chance for a generation to be
 * rejected over something nobody needed.
 */
export const WORLD_JSON_SCHEMA = {
    name: 'generated_world',
    description: 'A playable starter world for a tactical D&D campaign',
    strict: true,
    value: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'genre', 'description', 'locationName', 'boardName', 'map', 'enemies'],
        properties: {
            name: { type: 'string', description: 'Name of the world' },
            genre: { type: 'string', description: 'One or two words' },
            description: { type: 'string', description: 'One sentence about the world' },
            locationName: { type: 'string', description: 'The first location, e.g. a crypt or a village' },
            boardName: { type: 'string', description: 'The first tactical board inside that location' },
            map: {
                type: 'array',
                description: `Rows of equal length using only these characters: ${MAP_CHARS}. '#' wall, '.' floor, 'D' closed door, 'o' open door, '~' difficult ground, 'c' half cover, 'C' three-quarters cover. The outer edge must be wall.`,
                items: { type: 'string' },
            },
            enemies: {
                type: 'array',
                description: 'Two or three enemy types suited to a first-level party',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'hp', 'armorClass', 'cr', 'profile'],
                    properties: {
                        name: { type: 'string' },
                        hp: { type: 'integer', description: 'Between 4 and 30' },
                        armorClass: { type: 'integer', description: 'Between 8 and 18' },
                        cr: { type: 'number', description: 'Challenge rating, 0 to 3' },
                        profile: { type: 'string', enum: PROFILES },
                        attackRangeFeet: { type: 'integer', description: '5 for melee, 30 to 80 for ranged' },
                    },
                },
            },
        },
    },
};

/**
 * The instruction sent with the schema.
 *
 * Says what the map is for, because a model that does not know the map will be walked on
 * returns a pretty picture with no room to move.
 *
 * @param {string} idea  What the player asked for, in their own words.
 * @param {number} partySize
 * @returns {{systemPrompt: string, prompt: string}}
 */
export function buildWorldPrompt(idea, partySize = 2) {
    const size = Math.max(1, Math.min(MAX_PARTY, Number(partySize) || 2));

    const systemPrompt = [
        'Eres un diseñador de aventuras de rol táctico. Devuelves únicamente JSON válido que cumpla el esquema.',
        'El mapa es un tablero de combate por casillas, no una ilustración: tiene que poder recorrerse.',
        'Reglas del mapa:',
        `- Entre ${MIN_WIDTH} y ${MAX_WIDTH} columnas, y entre ${MIN_HEIGHT} y ${MAX_HEIGHT} filas.`,
        '- Todas las filas con exactamente la misma longitud.',
        '- El borde exterior entero debe ser muro (#).',
        `- Deja al menos ${size + 6} casillas de suelo (.) conectadas entre sí.`,
        '- Usa muros interiores para crear cobertura y rutas, no una sala vacía.',
        `- Solo estos caracteres: ${MAP_CHARS}`,
        'Los enemigos deben ser apropiados para un grupo de nivel 1.',
        'Escribe los nombres y la descripción en español.',
    ].join('\n');

    const clean = String(idea ?? '').trim().slice(0, 600);
    const prompt = clean
        ? `Crea el mundo inicial de una campaña a partir de esta idea: "${clean}"`
        : 'Crea el mundo inicial de una campaña de fantasía oscura, sorpréndeme.';

    return { systemPrompt, prompt };
}

/** Trims a value to a usable string, with a fallback when the model left it empty. */
function text(value, fallback, max = 60) {
    const clean = String(value ?? '').trim().replace(/\s+/g, ' ');
    return (clean || fallback).slice(0, max);
}

/** Clamps a number into range, falling back when it is not a number at all. */
function number(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/**
 * Turns whatever the model returned into a map the board can actually use.
 *
 * Models are good at the idea of a dungeon and careless about the grid: rows of different
 * lengths, a stray letter, an open edge the party can walk off. Each of those is repaired
 * rather than rejected, because throwing away a good layout over one bad character would
 * make generation feel like a lottery. What cannot be repaired — no floor to stand on —
 * is reported instead.
 *
 * @param {unknown} rawMap
 * @returns {{map: string[], warnings: string[]}}
 */
export function normalizeMap(rawMap) {
    const warnings = [];
    const rows = (Array.isArray(rawMap) ? rawMap : [])
        .map(row => String(row ?? '').replace(/\s/g, ''))
        .filter(row => row.length > 0);

    if (rows.length === 0) return { map: [], warnings: ['El mapa venía vacío.'] };

    // One ragged row would offset every cell after it, so all rows are squared off first.
    const width = number(Math.max(...rows.map(r => r.length)), MIN_WIDTH, MAX_WIDTH, MIN_WIDTH);
    const height = number(rows.length, MIN_HEIGHT, MAX_HEIGHT, MIN_HEIGHT);
    if (rows.some(r => r.length !== width)) warnings.push('Las filas no medían lo mismo; se han igualado.');
    if (rows.length !== height) warnings.push('El mapa se ha recortado o ampliado al tamaño permitido.');

    /** @type {string[]} */
    const map = [];
    let unknown = 0;

    for (let y = 0; y < height; y++) {
        const source = rows[y] ?? '';
        let line = '';
        for (let x = 0; x < width; x++) {
            const char = source[x] ?? '#';
            const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            if (edge) {
                // A board you can walk off the side of is not a board.
                line += '#';
                continue;
            }
            if (char === '.' || Object.prototype.hasOwnProperty.call(ASCII_TERRAIN, char)) {
                line += char;
            } else {
                unknown++;
                line += '.';
            }
        }
        map.push(line);
    }

    if (unknown > 0) warnings.push(`${unknown} casilla(s) con un símbolo desconocido se han dejado como suelo.`);
    if (!map.some(row => row.includes('.'))) warnings.push('El mapa no tenía ninguna casilla de suelo.');

    return { map, warnings };
}

/**
 * Finds cells the party can actually stand on.
 *
 * This is the check the first version of the wizard did not have, and it put two
 * characters inside a wall. The engine is happy to do that; the player is not.
 *
 * @param {string[]} map
 * @param {number} count
 * @returns {Array<{x: number, y: number}>}
 */
export function findPartyStart(map, count) {
    const wanted = Math.max(1, Math.min(MAX_PARTY, Number(count) || 1));
    /** @type {Array<{x: number, y: number}>} */
    const cells = [];

    // Scanned from the bottom up: a party entering a dungeon belongs near the near edge,
    // and it keeps them away from whatever the map put in the far corner.
    for (let y = map.length - 2; y >= 1 && cells.length < wanted; y--) {
        const row = map[y] ?? '';
        for (let x = 1; x < row.length - 1 && cells.length < wanted; x++) {
            if (row[x] === '.') cells.push({ x, y });
        }
    }

    return cells;
}

/**
 * Validates and repairs a generated world into a starter template.
 *
 * Returns errors only for what makes a world unplayable; everything else is a warning the
 * player sees next to the preview. The point is that nothing reaches the game unchecked,
 * not that the model be perfect.
 *
 * @param {unknown} raw            Parsed JSON from the model.
 * @param {number} partySize
 * @returns {{template: import('../campaign/starter-templates.js').StarterTemplate|null, warnings: string[], errors: string[]}}
 */
export function normalizeGeneratedWorld(raw, partySize = 2) {
    /** @type {string[]} */
    const warnings = [];
    /** @type {string[]} */
    const errors = [];

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { template: null, warnings, errors: ['La respuesta no era un objeto JSON.'] };
    }

    const source = /** @type {Record<string, any>} */ (raw);
    const { map, warnings: mapWarnings } = normalizeMap(source.map);
    warnings.push(...mapWarnings);

    if (map.length === 0) {
        return { template: null, warnings, errors: ['El mapa generado no se puede usar.'] };
    }

    const partyStart = findPartyStart(map, MAX_PARTY);
    if (partyStart.length === 0) {
        errors.push('El mapa no tiene ninguna casilla libre donde colocar al grupo.');
    }

    const rawEnemies = Array.isArray(source.enemies) ? source.enemies.slice(0, MAX_ENEMIES) : [];
    if (rawEnemies.length === 0) warnings.push('No se generó ningún enemigo: el tablero será pacífico.');

    const enemies = rawEnemies.map((enemy, index) => {
        const e = (enemy && typeof enemy === 'object') ? enemy : {};
        const profile = PROFILES.includes(String(e.profile)) ? String(e.profile) : PROFILES[0];
        if (!PROFILES.includes(String(e.profile))) {
            warnings.push(`El perfil táctico de "${text(e.name, `Enemigo ${index + 1}`, 40)}" no existía; se usa "${profile}".`);
        }
        return {
            name: text(e.name, `Enemigo ${index + 1}`, 40),
            hp: number(e.hp, 4, 60, 10),
            armorClass: number(e.armorClass, 8, 20, 12),
            cr: number(e.cr, 0, 5, 0.25),
            profile,
            attackRangeFeet: number(e.attackRangeFeet, 5, 120, 5),
        };
    });

    // Two enemies with the same name become one entry in the Lorebook, so the second
    // would silently replace the first.
    const seen = new Set();
    for (const enemy of enemies) {
        let name = enemy.name;
        let suffix = 2;
        while (seen.has(name.toLowerCase())) name = `${enemy.name} ${suffix++}`;
        if (name !== enemy.name) warnings.push(`Había dos enemigos llamados "${enemy.name}"; el segundo pasa a "${name}".`);
        enemy.name = name;
        seen.add(name.toLowerCase());
    }

    if (errors.length > 0) return { template: null, warnings, errors };

    return {
        template: {
            id: 'generated',
            name: text(source.name, 'Mundo generado', 60),
            description: text(source.description, 'Un mundo generado con IA.', 300),
            genre: text(source.genre, 'Fantasía', 40),
            locationName: text(source.locationName, 'Lugar sin nombre', 60),
            boardName: text(source.boardName, 'Tablero', 60),
            map,
            enemies,
            partyStart,
        },
        warnings,
        errors,
    };
}

/**
 * Asks the model for a world and hands back something the wizard can show.
 *
 * `generate` is injected — in the app it is SillyTavern's own generateRaw, which works
 * with whichever provider is configured. Tying this to one vendor would throw away the
 * twenty connectors the fork already has, which is its own best asset.
 *
 * @param {Object} input
 * @param {string} input.idea
 * @param {number} [input.partySize]
 * @param {(params: {prompt: string, systemPrompt: string, jsonSchema: object, responseLength: number}) => Promise<string|object>} input.generate
 * @returns {Promise<{template: import('../campaign/starter-templates.js').StarterTemplate|null, warnings: string[], errors: string[]}>}
 */
export async function generateWorld({ idea, partySize = 2, generate }) {
    const { systemPrompt, prompt } = buildWorldPrompt(idea, partySize);

    let answer;
    try {
        answer = await generate({ prompt, systemPrompt, jsonSchema: WORLD_JSON_SCHEMA, responseLength: 2048 });
    } catch (error) {
        return { template: null, warnings: [], errors: [`El proveedor no respondió: ${error?.message || error}`] };
    }

    let parsed = answer;
    if (typeof answer === 'string') {
        try {
            parsed = JSON.parse(answer);
        } catch {
            return { template: null, warnings: [], errors: ['La respuesta no era JSON válido. Prueba otra vez o elige una plantilla.'] };
        }
    }

    return normalizeGeneratedWorld(parsed, partySize);
}
