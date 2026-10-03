/**
 * Scenario objectives and quest state.
 *
 * A Gloomhaven scenario is not "fight until the board is empty". It has a stated goal, and
 * the goal is what makes two fights on the same map play differently: escorting somebody
 * across it is a different problem from killing everything on it.
 *
 * Objectives are evaluated by the engine against the actual board state, never by asking
 * the model whether the players won. That keeps victory reproducible and, incidentally,
 * free.
 *
 * Pure module.
 *
 * See wiki/ROADMAP.md, Fase E (E1, E4).
 */

export const SCENARIO_SCHEMA_VERSION = 1;

/** @typedef {'pending'|'complete'|'failed'} ObjectiveStatus */
/** @typedef {'not_started'|'active'|'complete'|'failed'} QuestStatus */

/**
 * The objective kinds the engine knows how to judge.
 *
 * Data rather than a switch, so Fase C can lift it into a rule pack and a campaign can add
 * its own — each entry names the fields it needs and the engine does the rest.
 */
export const OBJECTIVE_TYPES = {
    eliminate: {
        label: 'Eliminar',
        description: 'Derrota a los objetivos indicados.',
        fields: ['targetIds'],
    },
    eliminate_all: {
        label: 'Limpiar el tablero',
        description: 'Derrota a todos los enemigos.',
        fields: [],
    },
    survive_rounds: {
        label: 'Sobrevivir',
        description: 'Aguanta un número de rondas.',
        fields: ['rounds'],
    },
    reach_cell: {
        label: 'Alcanzar',
        description: 'Lleva a alguien del grupo a una casilla.',
        fields: ['cell'],
    },
    escort: {
        label: 'Escoltar',
        description: 'Lleva a un aliado concreto a una casilla, vivo.',
        fields: ['allyId', 'cell'],
    },
    protect: {
        label: 'Proteger',
        description: 'Que un aliado siga en pie al terminar. Es una condición: si cae, se pierde; si no, se gana con lo demás.',
        fields: ['allyId'],
    },
    loot: {
        label: 'Saquear',
        description: 'Recoge los tesoros marcados.',
        fields: ['treasureIds'],
    },
    // E1.1 de wiki/ROADMAP_ENTRETENIDO.md: otras formas de ganar un tablero.
    escape: {
        label: 'Escapar',
        description: 'Que salgan por las salidas del tablero todos los que siguen en pie.',
        fields: [],
    },
    hold: {
        label: 'Defender',
        description: 'Que ningún enemigo pise las casillas marcadas durante unas rondas.',
        fields: ['cells', 'rounds'],
    },
    unseen: {
        label: 'Sin despertar a nadie',
        description: 'Que los que duermen en el tablero sigan dormidos. Es una condición, como proteger.',
        fields: [],
    },
};

/**
 * E1.1: los objetivos que son una condición y no una meta: mientras se cumplen no fallan, pero
 * no ganan solos. Se gana cuando está hecho lo demás.
 */
export const CONDITION_TYPES = new Set(['protect', 'unseen']);

/**
 * E1.1: los que no tienen sentido con un plazo: ya son de rondas, o son una condición.
 */
const NO_DEADLINE = new Set(['survive_rounds', 'hold', 'protect', 'unseen']);

/**
 * @typedef {Object} Objective
 * @property {string} id
 * @property {string} type
 * @property {string} [label]
 * @property {boolean} [optional]
 * @property {string[]} [targetIds]
 * @property {number} [rounds]
 * @property {{x: number, y: number}} [cell]
 * @property {string} [allyId]
 * @property {string} [allyName] E1.1: quien se protege o se escolta, por su nombre (un invitado del tablero).
 * @property {string[]} [treasureIds]
 * @property {Array<{x: number, y: number}>} [cells] E1.1: las casillas que se defienden (`hold`).
 * @property {number} [beforeRound] E1.1: el plazo: si al empezar esa ronda no está hecho, se pierde.
 */

/**
 * @typedef {Object} BoardState
 * @property {number} round
 * @property {Array<{id: string, templateId?: string, currentHp: number, gridX: number, gridY: number}>} enemies
 * @property {Array<{id: string, currentHp: number, gridX: number, gridY: number, name?: string, uid?: string}>} allies
 * @property {string[]} [collectedTreasures]
 * @property {string[]} [left] E1.1: quién ha salido ya por una salida del tablero.
 * @property {boolean} [awakened] E1.1: si se ha despertado alguien de los que dormían.
 */

/**
 * @param {any} raw
 * @returns {Objective[]}
 */
export function normalizeObjectives(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(o => o && typeof o === 'object' && OBJECTIVE_TYPES[o.type])
        .map((o, index) => ({
            id: String(o.id || `obj_${index}`),
            type: String(o.type),
            label: String(o.label || OBJECTIVE_TYPES[o.type].label),
            optional: Boolean(o.optional),
            targetIds: Array.isArray(o.targetIds) ? o.targetIds.map(String) : undefined,
            rounds: Number.isFinite(Number(o.rounds)) ? Number(o.rounds) : undefined,
            cell: o.cell && Number.isFinite(Number(o.cell.x)) ? { x: Number(o.cell.x), y: Number(o.cell.y) } : undefined,
            allyId: o.allyId != null ? String(o.allyId) : undefined,
            treasureIds: Array.isArray(o.treasureIds) ? o.treasureIds.map(String) : undefined,
            // E1.1: el nombre de a quién se protege, las casillas que se defienden y el plazo.
            ...(o.allyName ? { allyName: String(o.allyName) } : {}),
            ...heldCells(o),
            ...(Number(o.beforeRound) >= 2 && !NO_DEADLINE.has(String(o.type)) ? { beforeRound: Math.floor(Number(o.beforeRound)) } : {}),
        }));
}

/**
 * E1.1: las casillas de un objetivo: `cells`, o la `cell` de uno de defender.
 *
 * @param {any} o
 * @returns {{cells?: Array<{x: number, y: number}>}}
 */
function heldCells(o) {
    const cells = readCells(o.cells ?? (o.type === 'hold' && o.cell ? [o.cell] : null));
    return cells.length > 0 ? { cells } : {};
}

/**
 * @param {any} raw
 * @returns {Array<{x: number, y: number}>}
 */
function readCells(raw) {
    return (Array.isArray(raw) ? raw : [])
        .filter(c => c && Number.isFinite(Number(c.x)) && Number.isFinite(Number(c.y)))
        .map(c => ({ x: Math.trunc(Number(c.x)), y: Math.trunc(Number(c.y)) }));
}

/**
 * E1.1: a quién se refiere un objetivo de proteger o escoltar: por su id, por su entrada del
 * mundo o por su nombre. Antes solo por id, y la id de la entrada del mundo (Ireena) no es la
 * de su ficha en el grupo: «que Ireena sobreviva» no fallaba nunca.
 *
 * @param {Objective} objective
 * @param {BoardState['allies']} allies
 */
function wardOf(objective, allies) {
    const id = objective.allyId;
    const name = String(objective.allyName ?? '').trim().toLowerCase();
    return allies.find(a => id !== undefined && (a.id === id || (a.uid !== undefined && a.uid === id)))
        ?? (name ? allies.find(a => String(a.name ?? '').trim().toLowerCase() === name) : undefined);
}

/**
 * E1.1: el texto del plazo de un objetivo, para la cabecera y el resumen.
 *
 * @param {Objective} objective
 * @returns {string} « (antes de la ronda 5)», o vacío.
 */
export function deadlineText(objective) {
    return objective?.beforeRound ? ` (antes de la ronda ${objective.beforeRound})` : '';
}

/** @param {{currentHp?: number}} c */
const alive = (c) => (Number(c?.currentHp) || 0) > 0;

/**
 * @param {{gridX: number, gridY: number}} who
 * @param {{x: number, y: number}} cell
 */
const standingOn = (who, cell) => who.gridX === cell.x && who.gridY === cell.y;

/**
 * Judges one objective against the board.
 *
 * @param {Objective} objective
 * @param {BoardState} board
 * @returns {ObjectiveStatus}
 */
export function evaluateObjective(objective, board) {
    const status = judgeObjective(objective, board);
    // E1.1: con plazo, lo que al empezar esa ronda sigue sin hacerse se ha perdido (salir antes
    // de la ronda 5, romper los cristales antes de que el nigromante acabe).
    if (status === 'pending' && objective.beforeRound && (Number(board?.round) || 0) >= objective.beforeRound) return 'failed';
    return status;
}

/**
 * Lo que dice un objetivo del tablero, sin mirar su plazo.
 *
 * @param {Objective} objective
 * @param {BoardState} board
 * @returns {ObjectiveStatus}
 */
function judgeObjective(objective, board) {
    const enemies = Array.isArray(board?.enemies) ? board.enemies : [];
    const allies = Array.isArray(board?.allies) ? board.allies : [];

    switch (objective.type) {
        case 'eliminate': {
            const ids = objective.targetIds ?? [];
            if (ids.length === 0) return 'pending';
            // El objetivo nombra al bicho por su ficha (`templateId`), y la pelea lleva
            // instancias («Revenant 1»). Antes solo se miraba la instancia: nunca coincidía,
            // no quedaba ninguno «vivo» y «Derrotar al Revenant» se cumplía en la primera
            // ronda. Y si no está en esta pelea, aquí no se cumple.
            const targets = enemies.filter(e => ids.includes(e.id) || (e.templateId !== undefined && ids.includes(e.templateId)));
            if (targets.length === 0) return 'pending';
            return targets.some(alive) ? 'pending' : 'complete';
        }

        case 'eliminate_all':
            return enemies.some(alive) ? 'pending' : 'complete';

        case 'survive_rounds': {
            const target = objective.rounds ?? 0;
            // Losing everyone fails it: surviving is the point.
            if (!allies.some(alive)) return 'failed';
            return (Number(board?.round) || 0) >= target ? 'complete' : 'pending';
        }

        case 'reach_cell': {
            if (!objective.cell) return 'pending';
            return allies.some(a => alive(a) && standingOn(a, objective.cell)) ? 'complete' : 'pending';
        }

        case 'escort': {
            if (!objective.cell || (!objective.allyId && !objective.allyName)) return 'pending';
            const ward = wardOf(objective, allies);
            if (!ward) return 'pending';
            if (!alive(ward)) return 'failed';
            return standingOn(ward, objective.cell) ? 'complete' : 'pending';
        }

        case 'protect': {
            const ward = wardOf(objective, allies);
            if (!ward) return 'pending';
            return alive(ward) ? 'pending' : 'failed';
        }

        case 'escape': {
            // E1.1: salen los que siguen en pie. Con todos dentro y en el suelo, se ha perdido;
            // sin nadie de quien huir, ya no hace falta correr.
            const out = new Set((Array.isArray(board?.left) ? board.left : []).map(String));
            const standing = allies.filter(a => alive(a) && !out.has(String(a.id)));
            if (standing.length === 0) return out.size > 0 ? 'complete' : 'failed';
            if (!enemies.some(alive)) return 'complete';
            return 'pending';
        }

        case 'hold': {
            // E1.1: si un enemigo pisa lo que se defiende, se ha perdido; si se aguanta hasta la
            // ronda que dice, se ha ganado. Sin nadie del grupo en pie, también se pierde.
            const cells = objective.cells ?? [];
            if (enemies.some(e => alive(e) && cells.some(c => standingOn(e, c)))) return 'failed';
            if (!allies.some(alive)) return 'failed';
            return (Number(board?.round) || 0) >= (objective.rounds ?? 0) ? 'complete' : 'pending';
        }

        case 'unseen':
            return board?.awakened ? 'failed' : 'pending';

        case 'loot': {
            const ids = objective.treasureIds ?? [];
            if (ids.length === 0) return 'pending';
            const collected = new Set(board?.collectedTreasures ?? []);
            return ids.every(id => collected.has(id)) ? 'complete' : 'pending';
        }

        default:
            return 'pending';
    }
}

/**
 * Judges the whole scenario.
 *
 * Optional objectives count towards the reward but never towards victory or defeat, which
 * is what makes them optional rather than hidden requirements.
 *
 * @param {Objective[]} objectives
 * @param {BoardState} board
 * @returns {{status: QuestStatus, results: Array<{id: string, type: string, status: ObjectiveStatus, optional: boolean}>, bonusEarned: number}}
 */
export function evaluateScenario(objectives, board) {
    const list = normalizeObjectives(objectives);
    const results = list.map(o => ({
        id: o.id,
        type: o.type,
        status: evaluateObjective(o, board),
        optional: Boolean(o.optional),
    }));

    const required = results.filter(r => !r.optional);
    const bonusEarned = results.filter(r => r.optional && r.status === 'complete').length;

    if (required.some(r => r.status === 'failed')) {
        return { status: 'failed', results, bonusEarned };
    }
    // «Proteger» es una condición, no una meta: mientras siga en pie no falla, pero tampoco
    // se «cumple» nunca por sí solo. Se gana cuando está hecho **lo demás**. Antes contaba
    // como meta pendiente para siempre y una misión con «que Ireena sobreviva» no se podía
    // ganar.
    // E1.1: y lo mismo con «sin despertar a nadie».
    const goals = required.filter(r => !CONDITION_TYPES.has(r.type));
    if (goals.length > 0 && goals.every(r => r.status === 'complete')) {
        return { status: 'complete', results, bonusEarned };
    }

    return { status: 'active', results, bonusEarned };
}

/**
 * Lo que guarda un cofre de un tablero con un objetivo «saquear»: el primer tesoro que la
 * misión pide y aún no se ha recogido. Vacío si no pide ninguno, y el cofre da lo de
 * siempre.
 *
 * Sin esto, «Encontrar la reliquia» no se podía cumplir: nada del tablero daba los tesoros
 * que la misión nombraba.
 *
 * @param {any[]} objectives
 * @param {string[]} [collected]
 * @returns {string}
 */
export function treasureInChest(objectives, collected = []) {
    const have = new Set((Array.isArray(collected) ? collected : []).map(String));
    for (const objective of normalizeObjectives(objectives)) {
        if (objective.type !== 'loot') continue;
        const missing = (objective.treasureIds ?? []).find(id => !have.has(String(id)));
        if (missing) return String(missing);
    }
    return '';
}

/**
 * A one-line summary for the combat log and for the epilogue prompt.
 * @param {Objective[]} objectives
 * @param {BoardState} board
 * @returns {string}
 */
export function describeObjectives(objectives, board) {
    const list = normalizeObjectives(objectives);
    if (list.length === 0) return 'Sin objetivos definidos.';

    const icon = { complete: '✅', failed: '❌', pending: '⬜' };
    return list
        .map(o => `${icon[evaluateObjective(o, board)]} ${o.label}${deadlineText(o)}${o.optional ? ' (opcional)' : ''}`)
        .join(' · ');
}

/**
 * @typedef {Object} QuestState
 * @property {number} version
 * @property {Record<string, {status: QuestStatus, startedDay: number|null, completedDay: number|null}>} quests
 */

/** @returns {QuestState} */
export function createQuestState() {
    return { version: SCENARIO_SCHEMA_VERSION, quests: {} };
}

/**
 * @param {any} raw
 * @returns {QuestState}
 */
export function normalizeQuestState(raw) {
    if (!raw || typeof raw !== 'object') return createQuestState();

    const source = raw.quests && typeof raw.quests === 'object' ? raw.quests : {};
    /** @type {QuestState['quests']} */
    const quests = {};
    const valid = ['not_started', 'active', 'complete', 'failed'];

    for (const [id, value] of Object.entries(source)) {
        if (!id || !value || typeof value !== 'object') continue;
        quests[id] = {
            status: valid.includes(value.status) ? value.status : 'not_started',
            startedDay: Number.isInteger(value.startedDay) ? value.startedDay : null,
            completedDay: Number.isInteger(value.completedDay) ? value.completedDay : null,
        };
    }

    return { version: SCENARIO_SCHEMA_VERSION, quests };
}

/**
 * @param {QuestState} state
 * @param {string} questId
 * @returns {QuestStatus}
 */
export function getQuestStatus(state, questId) {
    return normalizeQuestState(state).quests[questId]?.status ?? 'not_started';
}

/**
 * Moves a quest along, stamping the day so the log can say when.
 * @param {QuestState} state
 * @param {string} questId
 * @param {QuestStatus} status
 * @param {number} day
 * @returns {QuestState}
 */
export function setQuestStatus(state, questId, status, day) {
    const current = normalizeQuestState(state);
    const id = String(questId || '').trim();
    if (!id) return current;

    const before = current.quests[id] ?? { status: 'not_started', startedDay: null, completedDay: null };

    return {
        version: SCENARIO_SCHEMA_VERSION,
        quests: {
            ...current.quests,
            [id]: {
                status,
                startedDay: status === 'active' && before.startedDay == null ? day : before.startedDay,
                completedDay: (status === 'complete' || status === 'failed') ? day : before.completedDay,
            },
        },
    };
}

/**
 * The quests currently worth injecting into the prompt. Only the active ones: a finished
 * quest in the context is tokens spent on something nobody can act on.
 * @param {QuestState} state
 * @returns {string[]}
 */
export function getActiveQuestIds(state) {
    const current = normalizeQuestState(state);
    return Object.entries(current.quests)
        .filter(([, q]) => q.status === 'active')
        .map(([id]) => id);
}
