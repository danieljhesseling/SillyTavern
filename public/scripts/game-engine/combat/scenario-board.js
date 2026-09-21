/**
 * The bridge between a fight in progress and the scenario rules.
 *
 * `campaign/scenarios.js` has known how to judge seven kinds of objective since the Fase E
 * work, and nothing ever asked it: every combat in this game was "kill everything", which
 * is the one scenario a tactical engine least needs help with. This turns the live
 * encounter into the board state the evaluator expects, and turns its verdict back into
 * something the panel can draw.
 *
 * Pure. See wiki/ROADMAP.md, Fase E (E5).
 */

import {
    OBJECTIVE_TYPES, normalizeObjectives, evaluateScenario, describeObjectives,
} from '../campaign/scenarios.js';

/**
 * Describes the fight the way the scenario rules expect to read it.
 *
 * The party are "allies" and the enemies are "enemies", which sounds obvious until you
 * notice that an escort mission's ally is a party member and a protect objective's ally
 * might be an NPC standing on the board. Both arrive here the same way.
 *
 * @param {Object} input
 * @param {number} input.round
 * @param {Array<any>} input.enemies
 * @param {Array<any>} input.party
 * @param {string[]} [input.collectedTreasures]
 * @returns {import('../campaign/scenarios.js').BoardState}
 */
export function buildBoardState({ round, enemies, party, collectedTreasures = [] }) {
    return {
        round: Number(round) || 1,
        enemies: (Array.isArray(enemies) ? enemies : []).map(e => ({
            id: String(e?.instanceId ?? e?.id ?? ''),
            currentHp: Number(e?.currentHp) || 0,
            gridX: Number(e?.gridX) || 0,
            gridY: Number(e?.gridY) || 0,
        })),
        allies: (Array.isArray(party) ? party : []).map(m => ({
            id: String(m?.id ?? ''),
            currentHp: Number(m?.hp ?? m?.currentHp) || 0,
            gridX: Number(m?.mapPosition?.gridX ?? m?.gridX) || 0,
            gridY: Number(m?.mapPosition?.gridY ?? m?.gridY) || 0,
        })),
        collectedTreasures: Array.isArray(collectedTreasures) ? collectedTreasures : [],
    };
}

/**
 * Judges the scenario and says what the game should do about it.
 *
 * Returns the verdict *and* the reason, because "you won" and "you won because the shaman
 * is dead and the hostage is out" are different messages, and only the second one tells a
 * player what the fight was about.
 *
 * @param {Array<any>} objectives
 * @param {import('../campaign/scenarios.js').BoardState} board
 * @returns {{status: import('../campaign/scenarios.js').QuestStatus|'none', outcome: 'victory'|'defeat'|null, summary: string, rows: Array<{id: string, label: string, status: string, optional: boolean}>, bonusEarned: number}}
 */
export function judgeScenario(objectives, board) {
    const list = normalizeObjectives(objectives);
    if (list.length === 0) {
        return { status: 'none', outcome: null, summary: '', rows: [], bonusEarned: 0 };
    }

    const { status, results, bonusEarned } = evaluateScenario(list, board);
    const byId = new Map(list.map(o => [o.id, o]));

    const rows = results.map(result => {
        const objective = byId.get(result.id);
        return {
            id: result.id,
            label: String(objective?.label || OBJECTIVE_TYPES[objective?.type]?.label || result.id),
            status: result.status,
            optional: Boolean(result.optional),
        };
    });

    return {
        status,
        // A scenario decides the fight: it is what makes "survive six rounds" a win
        // rather than a stalemate nobody can call.
        outcome: status === 'complete' ? 'victory' : status === 'failed' ? 'defeat' : null,
        summary: describeObjectives(list, board),
        rows,
        bonusEarned,
    };
}

/**
 * Whether a board carries a scenario at all.
 *
 * Most boards do not, and a board with no objectives has to keep behaving exactly as it
 * did before: clear the enemies and you win.
 *
 * @param {any} board
 * @returns {boolean}
 */
export function hasScenario(board) {
    return normalizeObjectives(board?.objectives).length > 0;
}
