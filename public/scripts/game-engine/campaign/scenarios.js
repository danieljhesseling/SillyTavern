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
        description: 'Que un aliado siga en pie al terminar.',
        fields: ['allyId'],
    },
    loot: {
        label: 'Saquear',
        description: 'Recoge los tesoros marcados.',
        fields: ['treasureIds'],
    },
};

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
 * @property {string[]} [treasureIds]
 */

/**
 * @typedef {Object} BoardState
 * @property {number} round
 * @property {Array<{id: string, currentHp: number, gridX: number, gridY: number}>} enemies
 * @property {Array<{id: string, currentHp: number, gridX: number, gridY: number}>} allies
 * @property {string[]} [collectedTreasures]
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
        }));
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
    const enemies = Array.isArray(board?.enemies) ? board.enemies : [];
    const allies = Array.isArray(board?.allies) ? board.allies : [];

    switch (objective.type) {
        case 'eliminate': {
            const ids = objective.targetIds ?? [];
            if (ids.length === 0) return 'pending';
            const remaining = enemies.filter(e => ids.includes(e.id) && alive(e));
            return remaining.length === 0 ? 'complete' : 'pending';
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
            if (!objective.cell || !objective.allyId) return 'pending';
            const ward = allies.find(a => a.id === objective.allyId);
            if (!ward) return 'pending';
            if (!alive(ward)) return 'failed';
            return standingOn(ward, objective.cell) ? 'complete' : 'pending';
        }

        case 'protect': {
            const ward = allies.find(a => a.id === objective.allyId);
            if (!ward) return 'pending';
            return alive(ward) ? 'pending' : 'failed';
        }

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
 * @returns {{status: QuestStatus, results: Array<{id: string, status: ObjectiveStatus, optional: boolean}>, bonusEarned: number}}
 */
export function evaluateScenario(objectives, board) {
    const list = normalizeObjectives(objectives);
    const results = list.map(o => ({
        id: o.id,
        status: evaluateObjective(o, board),
        optional: Boolean(o.optional),
    }));

    const required = results.filter(r => !r.optional);
    const bonusEarned = results.filter(r => r.optional && r.status === 'complete').length;

    if (required.some(r => r.status === 'failed')) {
        return { status: 'failed', results, bonusEarned };
    }
    if (required.length > 0 && required.every(r => r.status === 'complete')) {
        return { status: 'complete', results, bonusEarned };
    }

    return { status: 'active', results, bonusEarned };
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
        .map(o => `${icon[evaluateObjective(o, board)]} ${o.label}${o.optional ? ' (opcional)' : ''}`)
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
