/**
 * Sandbox: a self-contained board for trying the tactical engine out.
 *
 * Everything the engine can do needs a campaign, a world, a location, a board and a party
 * before any of it appears on screen — which makes checking whether a wall renders
 * correctly a twenty-minute errand. This builds the whole scene from nothing, in memory,
 * so the answer takes twenty seconds instead.
 *
 * It also happens to be the only place the combat log is mounted, which is why the pixel
 * art frame can be looked at here and nowhere else yet.
 *
 * Nothing here is persisted. Closing the popup throws the board away.
 *
 * See wiki/POR_HACER.md.
 */

import { renderLocationView } from '../../world-map-renderer.js';
import {
    createEmptyTerrain, setCell, getTerrainOptions, cellKey,
} from '../board/terrain.js';
import { updateFog, createEmptyFog } from '../board/fog-of-war.js';
import { getReachableCells, findPath, getPathCost } from '../board/pathfinding.js';
import { planEnemyTurn, TACTICAL_PROFILES } from '../combat/enemy-ai.js';
import { rollDiceDetailed } from '../../party/combat-rules.js';
import {
    createCombatLogPanel, renderCombatLog, setRound, entry, rollEntry, append,
} from './combat-log.js';

/** The sandbox board is small on purpose: the whole thing has to be visible at once. */
export const SANDBOX_WIDTH = 16;
export const SANDBOX_HEIGHT = 12;

/**
 * A hand-built dungeon that exercises every terrain type at least once.
 *
 * Laid out as ASCII because a wall you can see in the source is a wall you can check
 * against the screen.
 *
 *   #  wall        D  closed door    o  open door
 *   ~  difficult   c  half cover     C  three-quarter cover
 */
const SANDBOX_MAP = [
    '################',
    '#....#.........#',
    '#....#..~~~....#',
    '#..c.D..~~~..C.#',
    '#....#..~~~....#',
    '#....#.........#',
    '#....####o######',
    '#..............#',
    '#...C....~~....#',
    '#........~~..c.#',
    '#..............#',
    '################',
];

/**
 * @returns {import('../board/terrain.js').BoardTerrain}
 */
export function buildSandboxTerrain() {
    let terrain = createEmptyTerrain();

    SANDBOX_MAP.forEach((row, y) => {
        [...row].forEach((char, x) => {
            switch (char) {
                case '#': terrain = setCell(terrain, x, y, 'wall'); break;
                case 'D': terrain = setCell(terrain, x, y, 'door', { open: false }); break;
                case 'o': terrain = setCell(terrain, x, y, 'door', { open: true }); break;
                case '~': terrain = setCell(terrain, x, y, 'difficult'); break;
                case 'c': terrain = setCell(terrain, x, y, 'cover_half'); break;
                case 'C': terrain = setCell(terrain, x, y, 'cover_three_quarters'); break;
                default: break;
            }
        });
    });

    return terrain;
}

/**
 * Two heroes and three monsters, one per tactical profile that has anything to show.
 * @returns {any[]}
 */
export function buildSandboxTokens() {
    return [
        {
            id: 1, name: 'Lyra', avatar: '', gridX: 2, gridY: 8,
            level: 4, className: 'Ranger', hp: 28, maxHp: 28,
            speedFeet: 30, attackRangeFeet: 60, sightFeet: 40, isEnemy: false,
        },
        {
            id: 2, name: 'Brand', avatar: '', gridX: 3, gridY: 9,
            level: 4, className: 'Fighter', hp: 34, maxHp: 34,
            speedFeet: 30, attackRangeFeet: 5, sightFeet: 30, isEnemy: false,
        },
        {
            id: -1, name: 'Bruto', avatar: '', gridX: 12, gridY: 8,
            level: 2, hp: 15, maxHp: 15,
            speedFeet: 30, attackRangeFeet: 5, profile: 'aggressive', isEnemy: true,
        },
        {
            id: -2, name: 'Arquero', avatar: '', gridX: 13, gridY: 10,
            level: 2, hp: 9, maxHp: 9,
            speedFeet: 30, attackRangeFeet: 60, profile: 'skirmisher', isEnemy: true,
        },
        {
            // Starts under the quarter-health threshold on purpose: the point of having a
            // coward in the sandbox is watching it run.
            id: -3, name: 'Rata', avatar: '', gridX: 2, gridY: 2,
            level: 1, hp: 2, maxHp: 12,
            speedFeet: 30, attackRangeFeet: 5, profile: 'coward', isEnemy: true,
        },
    ];
}

/** Chip colours for the terrain palette, matching the CSS. */
const TERRAIN_CHIPS = {
    floor: '#3a3a46',
    wall: '#2b2b33',
    difficult: '#b47828',
    cover_half: '#5aa0dc',
    cover_three_quarters: '#3a80bc',
    door: '#6b4a24',
};

/**
 * Opens the sandbox.
 *
 * @param {{ Popup: any, POPUP_TYPE: any }} deps Injected so this module stays testable.
 * @returns {Promise<void>}
 */
export async function openSandbox({ Popup, POPUP_TYPE }) {
    let terrain = buildSandboxTerrain();
    let tokens = buildSandboxTokens();
    let fog = createEmptyFog();
    let fogEnabled = false;
    /** @type {string|null} */
    let brush = null;
    /** @type {import('./combat-log.js').LogEntry[]} */
    let log = [entry('system', 'Banco de pruebas abierto. Nada de esto se guarda.')];
    let round = 1;
    /** @type {number|null} */
    let selectedId = 1;

    const root = $('<div class="sandbox-root"></div>');
    const toolbar = $('<div class="sandbox-toolbar"></div>');
    const boardWrap = $('<div class="sandbox-board"></div>');
    const palette = $('<div class="wm-terrain-palette"></div>');
    const logPanel = createCombatLogPanel({ title: 'Registro de combate' });

    const layout = $('<div class="sandbox-layout"></div>');
    layout.append($('<div class="sandbox-main"></div>').append(boardWrap, palette));
    layout.append($('<div class="sandbox-side"></div>').append(logPanel));
    root.append(toolbar, layout);

    /** @param {import('./combat-log.js').LogEntry} item */
    const push = (item) => {
        log = append(log, item);
        renderCombatLog(logPanel, log);
    };

    function draw() {
        const party = tokens.filter(t => !t.isEnemy);
        const fogState = fogEnabled
            ? updateFog(fog, terrain, party, SANDBOX_WIDTH, SANDBOX_HEIGHT)
            : { fog, visible: new Set() };
        fog = fogState.fog;

        const selected = tokens.find(t => t.id === selectedId);
        const occupied = new Set(tokens.filter(t => t.id !== selectedId).map(t => cellKey(t.gridX, t.gridY)));
        const highlightedCells = (selected && !brush)
            ? getReachableCells(
                terrain, selected.gridX, selected.gridY, selected.speedFeet ?? 30,
                SANDBOX_WIDTH, SANDBOX_HEIGHT, { occupied },
            )
            : [];

        renderLocationView(boardWrap, {
            name: 'Banco de pruebas',
            imageUrl: '',
            gridWidth: SANDBOX_WIDTH,
            gridHeight: SANDBOX_HEIGHT,
            viewStateKey: 'sandbox',
            terrain,
            fog,
            visibleCells: fogState.visible,
            fogEnabled,
            paintMode: brush,
            onPaintCell: (gx, gy, type) => {
                terrain = setCell(terrain, gx, gy, type);
                draw();
            },
            tokens,
            selectedTokenId: selectedId,
            highlightedCells,
            overlayLegend: selected
                ? `${selected.name} · ${selected.speedFeet ?? 30} ft de movimiento · alcance ${selected.attackRangeFeet ?? 5} ft`
                : 'Ningún token seleccionado',
            onTokenClick: (id) => {
                selectedId = id;
                draw();
            },
            onTokenMove: (id, gx, gy) => {
                const token = tokens.find(t => t.id === id);
                if (!token) return;

                const path = findPath(terrain, token.gridX, token.gridY, gx, gy, SANDBOX_WIDTH, SANDBOX_HEIGHT);
                if (!path) {
                    push(entry('system', `${token.name} no puede llegar ahí.`));
                    draw();
                    return;
                }

                const feet = getPathCost(terrain, path) * 5;
                token.gridX = gx;
                token.gridY = gy;
                push(entry('move', `avanza ${feet} ft (${path.length - 1} casillas).`, { actor: token.name }));
                draw();
            },
        });

        renderPalette();
        setRound(logPanel, round);
    }

    function renderPalette() {
        palette.empty();

        for (const [value, label] of getTerrainOptions()) {
            const swatch = $('<div class="wm-terrain-swatch"></div>').toggleClass('active', brush === value);
            swatch.append($('<span class="swatch-chip"></span>').css('background', TERRAIN_CHIPS[value] || '#555'));
            swatch.append($('<span></span>').text(label));
            swatch.on('click', () => {
                brush = brush === value ? null : value;
                draw();
            });
            palette.append(swatch);
        }

        const fogSwatch = $('<div class="wm-terrain-swatch"></div>').toggleClass('active', fogEnabled);
        fogSwatch.append('<i class="fa-solid fa-cloud"></i>');
        fogSwatch.append($('<span></span>').text('Niebla'));
        fogSwatch.on('click', () => {
            fogEnabled = !fogEnabled;
            if (!fogEnabled) fog = createEmptyFog();
            push(entry('system', fogEnabled ? 'Niebla activada.' : 'Niebla desactivada.'));
            draw();
        });
        palette.append(fogSwatch);
    }

    // ---- toolbar ------------------------------------------------------------

    /** @param {string} label @param {string} icon @param {() => void} onClick */
    const button = (label, icon, onClick) => {
        const el = $('<button class="menu_button sandbox-btn"></button>');
        el.append(`<i class="fa-solid ${icon}"></i>`);
        el.append($('<span></span>').text(` ${label}`));
        el.on('click', onClick);
        return el;
    };

    toolbar.append(button('Turno enemigo', 'fa-skull', () => {
        const party = tokens.filter(t => !t.isEnemy && t.hp > 0);
        const foes = tokens.filter(t => t.isEnemy && t.hp > 0);

        for (const foe of foes) {
            const plan = planEnemyTurn({
                actor: {
                    id: String(foe.id), gridX: foe.gridX, gridY: foe.gridY,
                    currentHp: foe.hp, maxHp: foe.maxHp,
                    speedFeet: foe.speedFeet, attackRangeFeet: foe.attackRangeFeet,
                    profile: foe.profile,
                },
                targets: party.map(p => ({
                    id: String(p.id), gridX: p.gridX, gridY: p.gridY,
                    currentHp: p.hp, maxHp: p.maxHp,
                })),
                allies: foes.filter(f => f.id !== foe.id).map(f => ({
                    id: String(f.id), gridX: f.gridX, gridY: f.gridY,
                    currentHp: f.hp, maxHp: f.maxHp,
                })),
                terrain,
                gridWidth: SANDBOX_WIDTH,
                gridHeight: SANDBOX_HEIGHT,
            });

            const profileLabel = TACTICAL_PROFILES[foe.profile]?.label ?? 'Aggressive';

            if (plan.movementCostFeet > 0) {
                foe.gridX = plan.destination.x;
                foe.gridY = plan.destination.y;
                push(entry('move', `(${profileLabel}) ${plan.rationale} ${plan.movementCostFeet} ft.`, { actor: foe.name }));
            } else {
                push(entry('info', `(${profileLabel}) ${plan.rationale}`, { actor: foe.name }));
            }

            if (plan.action === 'attack' && plan.targetId) {
                const target = party.find(p => String(p.id) === plan.targetId);
                if (target) {
                    const roll = rollDiceDetailed('1d20+3');
                    push(rollEntry(foe.name, roll, 13, `ataca a ${target.name}`));

                    if (roll.natural === 20 || roll.total >= 13) {
                        const damage = rollDiceDetailed('1d8+2');
                        target.hp = Math.max(0, target.hp - damage.total);
                        push(entry('damage', `${target.name} recibe ${damage.total}. Quedan ${target.hp} HP.`, { actor: foe.name }));
                        if (target.hp === 0) push(entry('down', `${target.name} cae.`, { actor: foe.name }));
                    }
                }
            }
        }

        round += 1;
        push(entry('round', `Ronda ${round}`));
        draw();
    }));

    toolbar.append(button('Tirada de ejemplo', 'fa-dice-d20', () => {
        const roll = rollDiceDetailed('1d20+5');
        push(rollEntry('Lyra', roll, 15, 'ataca al Bruto'));
    }));

    toolbar.append(button('Reiniciar', 'fa-rotate-left', () => {
        terrain = buildSandboxTerrain();
        tokens = buildSandboxTokens();
        fog = createEmptyFog();
        fogEnabled = false;
        brush = null;
        round = 1;
        selectedId = 1;
        log = [entry('system', 'Banco reiniciado.')];
        renderCombatLog(logPanel, log);
        draw();
    }));

    toolbar.append($('<span class="sandbox-hint"></span>').text(
        'Elige un pincel y arrastra para pintar. Arrastra un token para moverlo. Nada se guarda.',
    ));

    draw();
    renderCombatLog(logPanel, log);

    const popup = new Popup(root, POPUP_TYPE.TEXT, '', {
        wide: true,
        wider: true,
        large: true,
        allowVerticalScrolling: true,
        okButton: 'Cerrar',
    });

    await popup.show();
}
