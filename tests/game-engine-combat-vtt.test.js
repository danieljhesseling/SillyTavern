/**
 * Tanda 10, «el lienzo y la cámara» (wiki/maquetas/ENCARGO_COMBATE_VTT.md): las cuentas de la
 * cámara, los marcadores de borde y el minimapa, y las islas de la iniciativa y del resumen.
 */

/* global globalThis */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
    BASE_CELL_PX, ZOOM_MAX, ZOOM_MIN, cellCenter, centerPoint, clampPan, clampScale, fitBoard, followDecision, isPointShown,
    safeRect, toBoard, toScreen, visibleArea, wheelScale, zoomAt, zoomLabel, zoomLimits, zoomOf,
} from '../public/scripts/game-engine/ui/combat-vtt/camera.js';
import { edgeText, markerBox, placeEdgeMarkers } from '../public/scripts/game-engine/ui/combat-vtt/edge-markers.js';
import { minimapCells, minimapLayout, minimapToBoard, viewOnMinimap } from '../public/scripts/game-engine/ui/combat-vtt/minimap.js';
import { buildInitiative, initialOf, turnLine } from '../public/scripts/game-engine/ui/combat-vtt/initiative.js';
import { SUMMARY_FOLD_KEY, buildSummary, startsFolded } from '../public/scripts/game-engine/ui/combat-vtt/summary.js';

// ---- Un documento de mentira, lo justo para montar las islas sin navegador ----

class FakeNode {
    /** @param {string} tag */
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.className = '';
        /** @type {any[]} */
        this.children = [];
        this._text = '';
        /** @type {Record<string, string>} */
        this.attributes = {};
        /** @type {Record<string, string>} */
        this.dataset = {};
        /** @type {Record<string, string>} */
        this.style = {};
        /** @type {Record<string, Function[]>} */
        this.listeners = {};
        this.parent = null;
        this.title = '';
        const self = this;
        this.classList = {
            add: (/** @type {string[]} */ ...names) => names.forEach(n => { if (!self.classList.contains(n)) self.className = `${self.className} ${n}`.trim(); }),
            remove: (/** @type {string[]} */ ...names) => { self.className = self.className.split(/\s+/).filter(c => c && !names.includes(c)).join(' '); },
            contains: (/** @type {string} */ name) => self.className.split(/\s+/).includes(name),
            toggle: (/** @type {string} */ name, /** @type {boolean} */ on) => {
                const want = on === undefined ? !self.classList.contains(name) : on;
                if (want) self.classList.add(name); else self.classList.remove(name);
                return want;
            },
        };
    }

    get textContent() {
        return this._text + this.children.map(c => c.textContent).join('');
    }

    set textContent(value) {
        this._text = String(value);
        this.children = [];
    }

    /** @param {...any} nodes */
    append(...nodes) {
        for (const node of nodes) this.appendChild(node);
    }

    /** @param {any} node */
    appendChild(node) {
        node.parent = this;
        this.children.push(node);
        return node;
    }

    /** @param {any} node */
    replaceWith(node) {
        if (!this.parent) return;
        const list = this.parent.children;
        list[list.indexOf(this)] = node;
        node.parent = this.parent;
    }

    /** @param {string} name @param {string} value */
    setAttribute(name, value) { this.attributes[name] = String(value); }

    /** @param {string} name */
    getAttribute(name) { return this.attributes[name] ?? null; }

    /** @param {string} type @param {Function} fn */
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }

    /** @param {string} type @param {any} [extra] */
    fire(type, extra = {}) {
        const event = { type, target: extra.target ?? this, key: extra.key, stopPropagation() {}, preventDefault() {} };
        for (const fn of this.listeners[type] ?? []) fn(event);
        return event;
    }

    /** @param {string} selector */
    closest(selector) {
        /** @type {any} */
        let node = this;
        while (node) {
            if (node.matches?.(selector)) return node;
            node = node.parent;
        }
        return null;
    }

    /** Solo `.clase` (o varias separadas por coma). @param {string} selector */
    matches(selector) {
        return selector.split(',').some(s => s.trim().split('.').filter(Boolean).every(c => this.classList.contains(c)));
    }

    /** Descendientes que cumplen `.clase` o `.a .b` (el último paso manda). @param {string} selector */
    querySelectorAll(selector) {
        const last = selector.trim().split(/\s+/).pop() ?? '';
        /** @type {any[]} */
        const found = [];
        const walk = (/** @type {any} */ node) => {
            for (const child of node.children) {
                if (child instanceof FakeNode && child.matches(last)) found.push(child);
                if (child instanceof FakeNode) walk(child);
            }
        };
        walk(this);
        return found;
    }

    /** @param {string} selector */
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

class FakeText {
    /** @param {string} text */
    constructor(text) { this.textContent = String(text); this.parent = null; }
}

/** @type {any} */
const saved = {};
/** @type {Record<string, string>} */
const store = {};

beforeAll(() => {
    saved.document = globalThis.document;
    saved.localStorage = globalThis.localStorage;
    saved.innerWidth = globalThis.innerWidth;
    globalThis.document = /** @type {any} */ ({
        createElement: (/** @type {string} */ tag) => new FakeNode(tag),
        createTextNode: (/** @type {string} */ text) => new FakeText(text),
    });
    globalThis.localStorage = /** @type {any} */ ({
        getItem: (/** @type {string} */ k) => (k in store ? store[k] : null),
        setItem: (/** @type {string} */ k, /** @type {string} */ v) => { store[k] = String(v); },
    });
    globalThis.innerWidth = 1280;
});

afterAll(() => {
    globalThis.document = saved.document;
    globalThis.localStorage = saved.localStorage;
    globalThis.innerWidth = saved.innerWidth;
});

// ---- La cámara ----

describe('la cámara: de 0,45× a 2,2×, contado en casillas', () => {
    test('con casillas de 44 px, la escala del dibujo es el acercamiento', () => {
        expect(zoomLimits(BASE_CELL_PX)).toEqual({ min: ZOOM_MIN, max: ZOOM_MAX });
        expect(zoomOf(1, 44)).toBe(1);
        expect(zoomLabel(1.2, 44)).toBe('1,2×');
    });

    test('un mapa dibujado con casillas de 22 px se acerca el doble para lo mismo', () => {
        const limits = zoomLimits(22);
        expect(limits.min).toBeCloseTo(0.9);
        expect(limits.max).toBeCloseTo(4.4);
        expect(zoomOf(2, 22)).toBeCloseTo(1);
    });

    test('ni más cerca ni más lejos de los límites', () => {
        const limits = zoomLimits(44);
        expect(clampScale(5, limits)).toBe(ZOOM_MAX);
        expect(clampScale(0.1, limits)).toBe(ZOOM_MIN);
        expect(clampScale(1.3, limits)).toBe(1.3);
    });

    test('acercar deja quieto lo que hay bajo el cursor', () => {
        const view = { scale: 1, offsetX: -120, offsetY: 40 };
        const at = { x: 300, y: 200 };
        const before = toBoard(view, at);
        const next = zoomAt(view, 1.5, at, zoomLimits(44));
        expect(next.scale).toBe(1.5);
        const after = toBoard(next, at);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });

    test('acercar más allá del tope se queda en el tope, y el punto sigue quieto', () => {
        const view = { scale: 2, offsetX: 0, offsetY: 0 };
        const next = zoomAt(view, 9, { x: 100, y: 100 }, zoomLimits(44));
        expect(next.scale).toBe(ZOOM_MAX);
        expect(toBoard(next, { x: 100, y: 100 }).x).toBeCloseTo(50);
    });

    test('la rueda hacia arriba acerca y hacia abajo aleja; quieta, nada', () => {
        expect(wheelScale(1, -100)).toBeGreaterThan(1);
        expect(wheelScale(1, 100)).toBeLessThan(1);
        expect(wheelScale(1.3, 0)).toBe(1.3);
    });

    test('lo que se mira es la vista menos el HUD; si el HUD se lo come casi todo, la vista entera', () => {
        expect(safeRect(1280, 600, { right: 330, bottom: 0 })).toEqual({ left: 0, top: 0, right: 950, bottom: 600 });
        expect(safeRect(390, 600, { right: 330 })).toEqual({ left: 0, top: 0, right: 390, bottom: 600 });
    });

    test('centrar pone el punto en el centro de lo que se mira', () => {
        const rect = { left: 0, top: 0, right: 950, bottom: 600 };
        const view = centerPoint({ scale: 2, offsetX: 0, offsetY: 0 }, { x: 100, y: 50 }, rect);
        expect(toScreen(view, { x: 100, y: 50 })).toEqual({ x: 475, y: 300 });
        expect(cellCenter({ x: 2, y: 1 }, 44, 44)).toEqual({ x: 110, y: 66 });
    });

    test('lo que se ve del tablero, y si un punto se ve con holgura', () => {
        const view = { scale: 2, offsetX: -200, offsetY: -100 };
        expect(visibleArea(view, 800, 600)).toEqual({ x: 100, y: 50, width: 400, height: 300 });
        const rect = { left: 0, top: 0, right: 800, bottom: 600 };
        expect(isPointShown(view, { x: 300, y: 200 }, rect, 40)).toBe(true);
        expect(isPointShown(view, { x: 110, y: 200 }, rect, 40)).toBe(false);
    });

    test('arrastrando, el tablero no se pierde: algo suyo queda en la pantalla', () => {
        const board = { width: 1000, height: 600 };
        const screen = { width: 800, height: 500 };
        const far = clampPan({ scale: 1, offsetX: -5000, offsetY: 9000 }, board, screen, 96);
        expect(far.offsetX).toBe(96 - 1000);
        expect(far.offsetY).toBe(500 - 96);
        const near = clampPan({ scale: 1, offsetX: -100, offsetY: 20 }, board, screen, 96);
        expect(near).toEqual({ scale: 1, offsetX: -100, offsetY: 20 });
    });

    test('encuadrar enseña el tablero entero, centrado, sin pasar de los límites', () => {
        const rect = { left: 0, top: 0, right: 900, bottom: 600 };
        const fit = fitBoard({ width: 968, height: 572 }, rect, zoomLimits(44), 2);
        expect(fit.scale).toBeCloseTo(900 / 968);
        expect(toScreen(fit, { x: 484, y: 286 }).x).toBeCloseTo(450);
        // Uno enorme se queda en 0,45× y se recorre arrastrando.
        expect(fitBoard({ width: 8000, height: 6000 }, rect, zoomLimits(44)).scale).toBe(ZOOM_MIN);
        // Uno pequeño no se pone a 2,2×: hasta donde se diga.
        expect(fitBoard({ width: 100, height: 100 }, rect, zoomLimits(44), 2).scale).toBe(2);
    });
});

describe('la cámara busca a quien tiene el turno, sin pelearse con quien juega', () => {
    test('al empezar un turno, si no se le ve, se le busca, y se apunta', () => {
        expect(followDecision({ turnKey: '1:a', followedKey: '', shown: false })).toEqual({ follow: true, mark: true });
    });

    test('si ya se le ve, no se mueve nada, pero el turno queda apuntado', () => {
        expect(followDecision({ turnKey: '1:a', followedKey: '', shown: true })).toEqual({ follow: false, mark: true });
    });

    test('una vez por turno: en el mismo turno, nunca más', () => {
        expect(followDecision({ turnKey: '1:a', followedKey: '1:a', shown: false })).toEqual({ follow: false, mark: false });
    });

    test('si quien juega acaba de mover la cámara, no se la quita', () => {
        expect(followDecision({ turnKey: '1:b', followedKey: '1:a', recentHand: true, shown: false })).toEqual({ follow: false, mark: true });
        expect(followDecision({ turnKey: '1:b', followedKey: '1:a', handKey: '1:b', shown: false })).toEqual({ follow: false, mark: true });
    });

    test('fuera de combate no hay turno que seguir', () => {
        expect(followDecision({ turnKey: '', followedKey: '', shown: false })).toEqual({ follow: false, mark: false });
    });
});

// ---- Los marcadores de borde ----

describe('los marcadores de borde', () => {
    const rect = { left: 0, top: 0, right: 1000, bottom: 600 };

    test('dicen el nombre y los pies', () => {
        expect(edgeText('Tirador furtivo', 90)).toBe('Tirador furtivo · 90 pies');
        expect(edgeText('Tirador furtivo')).toBe('Tirador furtivo');
        expect(edgeText('', 0)).toBe('Alguien');
    });

    test('quien se ve no lleva marcador', () => {
        expect(placeEdgeMarkers({ targets: [{ id: -1, name: 'Ratero', x: 400, y: 300, feet: 15 }], rect })).toEqual([]);
    });

    test('quien está a la derecha, fuera, sale en el borde derecho, a su altura, con la flecha hacia él', () => {
        const [marker] = placeEdgeMarkers({ targets: [{ id: -2, name: 'Tirador', x: 1600, y: 300, feet: 90 }], rect, inset: 20 });
        expect(marker.side).toBe('right');
        expect(marker.left).toBeCloseTo(980);
        expect(marker.top).toBeCloseTo(300);
        expect(marker.angle).toBe(0);
        expect(marker.text).toBe('Tirador · 90 pies');
    });

    test('quien está arriba a la izquierda sale en el borde por el que se cruza antes', () => {
        const [marker] = placeEdgeMarkers({ targets: [{ id: 1, name: 'Lobo', x: -500, y: -2000 }], rect, inset: 20 });
        expect(marker.side).toBe('top');
        expect(marker.top).toBeCloseTo(20);
        expect(marker.angle).toBeLessThan(-90);
    });

    test('dos en el mismo borde no se montan', () => {
        const markers = placeEdgeMarkers({
            targets: [{ id: 1, name: 'A', x: 1500, y: 300 }, { id: 2, name: 'B', x: 1500, y: 305 }], rect, gap: 34,
        });
        expect(markers).toHaveLength(2);
        expect(Math.abs(markers[0].top - markers[1].top)).toBeGreaterThanOrEqual(34);
    });

    test('la caja del marcador va pegada al borde por dentro, sin salirse', () => {
        const marker = { id: 1, name: 'A', text: 'A', left: 980, top: 300, angle: 0, side: /** @type {const} */ ('right') };
        expect(markerBox(marker, 160, 30)).toEqual({ x: 820, y: 285 });
        const corner = { ...marker, side: /** @type {const} */ ('top'), left: 990, top: 20 };
        expect(markerBox(corner, 160, 30, rect)).toEqual({ x: 1000 - 160 - 4, y: 20 });
    });
});

// ---- El minimapa ----

describe('el minimapa', () => {
    test('el tablero entero, sin deformarlo y centrado', () => {
        const layout = minimapLayout({ boardW: 1000, boardH: 500, boxW: 200, boxH: 120 });
        expect(layout.scale).toBeCloseTo(0.2);
        expect(layout.width).toBeCloseTo(200);
        expect(layout.height).toBeCloseTo(100);
        expect(layout.top).toBeCloseTo(10);
    });

    test('el recuadro de lo que se ve, recortado al tablero', () => {
        const layout = minimapLayout({ boardW: 1000, boardH: 500, boxW: 200, boxH: 100 });
        const frame = viewOnMinimap({ scale: 2, offsetX: -400, offsetY: 0 }, 800, 600, layout);
        expect(frame.left).toBeCloseTo(40);
        expect(frame.width).toBeCloseTo(80);
        expect(frame.height).toBeCloseTo(60);
        const outside = viewOnMinimap({ scale: 1, offsetX: 5000, offsetY: 0 }, 800, 600, layout);
        expect(outside.width).toBe(0);
    });

    test('pulsar un punto da el sitio del tablero, sin salirse de él', () => {
        const layout = minimapLayout({ boardW: 1000, boardH: 500, boxW: 200, boxH: 120 });
        expect(minimapToBoard(100, 60, layout, { width: 1000, height: 500 })).toEqual({ x: 500, y: 250 });
        expect(minimapToBoard(-50, 500, layout, { width: 1000, height: 500 })).toEqual({ x: 0, y: 500 });
    });

    test('con niebla no chiva nada: lo no visto, a oscuras; lo visto antes, apagado', () => {
        const terrain = { cells: { '1,0': { type: 'wall' }, '3,0': { type: 'water' }, '0,1': { type: 'door', open: true } } };
        const cells = minimapCells({
            terrain, fog: { explored: { '1,0': true } }, visible: new Set(['0,0', '0,1']), fogEnabled: true, gridW: 4, gridH: 2,
        });
        const at = (/** @type {number} */ x, /** @type {number} */ y) => cells.filter(c => c.x === x && c.y === y).map(c => c.kind);
        expect(at(1, 0)).toEqual(['wall', 'explored']);
        expect(at(3, 0)).toEqual(['unknown']);
        expect(at(0, 0)).toEqual([]);
        // Una puerta abierta es suelo.
        expect(at(0, 1)).toEqual([]);
    });

    test('sin niebla, el terreno tal cual', () => {
        const cells = minimapCells({ terrain: { cells: { '2,1': { type: 'deep_water' } } }, gridW: 4, gridH: 4 });
        expect(cells).toEqual([{ x: 2, y: 1, kind: 'deep_water' }]);
    });
});

// ---- La iniciativa ----

describe('la iniciativa', () => {
    const tracker = {
        round: 2,
        activeName: 'Tessa',
        nextName: 'Ratero del muelle',
        entries: [
            { id: '7', name: 'Tessa', initiative: 16, isEnemy: false, isCurrent: true, isNext: false, hp: 30, maxHp: 34, hpPct: 88, defeated: false, bloodied: false, statuses: [], avatar: '' },
            { id: 'e1', name: 'Ratero del muelle', initiative: 10, isEnemy: true, isCurrent: false, isNext: true, hp: 2, maxHp: 5, hpPct: 40, defeated: false, bloodied: true, statuses: [{ key: 'prone', icon: 'fa-person-falling', label: 'Derribado' }], avatar: '' },
            { id: '8', name: 'Gerd', initiative: 4, isEnemy: false, isCurrent: false, isNext: false, hp: 0, maxHp: 20, hpPct: 0, defeated: true, bloodied: false, statuses: [], avatar: '' },
        ],
    };

    test('la cabecera dice de quién es el turno y quién va después', () => {
        expect(turnLine(tracker)).toBe('Turno de Tessa · después, Ratero del muelle');
        expect(turnLine({ activeName: '', nextName: '' })).toBe('');
        expect(initialOf('  ratero')).toBe('R');
        expect(initialOf('')).toBe('?');
    });

    test('una fila por cada uno, con su cara, su barra de vida y el turno marcado', () => {
        const panel = /** @type {any} */ (buildInitiative({
            tracker,
            faceOf: (entry) => (entry.isEnemy ? 'img/game-engine/pixel/bestias/ratero.png' : ''),
            youId: '7',
        }));
        const rows = panel.querySelectorAll('.wm-init-row');
        expect(rows).toHaveLength(3);
        expect(rows[0].classList.contains('current')).toBe(true);
        expect(rows[1].classList.contains('enemy')).toBe(true);
        expect(rows[1].classList.contains('bloodied')).toBe(true);
        expect(rows[2].classList.contains('defeated')).toBe(true);
        // El ratero, con su dibujo; Tessa, sin cara, con su inicial.
        expect(rows[1].querySelector('.wm-init-face').tagName).toBe('IMG');
        expect(rows[0].querySelector('.wm-init-initial').textContent).toBe('T');
        expect(panel.querySelectorAll('.wm-init-hp-fill')).toHaveLength(3);
        expect(rows[1].querySelector('.wm-init-hp-fill').style.width).toBe('40%');
        expect(rows[0].textContent).toContain('(tú)');
        expect(panel.querySelector('.wm-init-head').textContent).toContain('Ronda 2');
    });

    test('pulsar una fila (o Intro sobre ella) pide ir a esa persona', () => {
        /** @type {string[]} */
        const picked = [];
        const panel = /** @type {any} */ (buildInitiative({ tracker, onPick: (entry) => picked.push(entry.name) }));
        const rows = panel.querySelectorAll('.wm-init-row');
        rows[1].fire('click');
        rows[0].fire('keydown', { key: 'Enter' });
        rows[0].fire('keydown', { key: 'a' });
        expect(picked).toEqual(['Ratero del muelle', 'Tessa']);
    });

    test('quién le mueve va en su fila, con su nombre dentro, y pulsarlo no lleva la cámara', () => {
        /** @type {any[]} */
        const asked = [];
        /** @type {string[]} */
        const picked = [];
        const panel = /** @type {any} */ (buildInitiative({
            tracker,
            controls: [{ id: '8', name: 'Gerd', control: 'player' }, { id: '99', name: 'Lobo', control: 'engine', summon: true }],
            controlLabels: { player: 'Lo muevo yo', engine: 'Que lo lleve el juego' },
            onControl: (id, next) => asked.push([id, next]),
            onPick: (entry) => picked.push(entry.name),
        }));
        const buttons = panel.querySelectorAll('.wm-combat-control-btn');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].dataset.controlId).toBe('8');
        expect(buttons[0].dataset.control).toBe('player');
        expect(buttons[0].textContent).toContain('Gerd');
        expect(buttons[0].textContent).toContain('Lo muevo yo');
        // Quien no tiene fila (el lobo) lleva su botón debajo.
        expect(buttons[1].closest('.vtt-init-controls')).not.toBeNull();
        buttons[0].fire('click');
        expect(asked).toEqual([['8', 'engine']]);
        const gerd = panel.querySelectorAll('.wm-init-row')[2];
        gerd.fire('click', { target: buttons[0] });
        expect(picked).toEqual([]);
    });

    test('los objetivos de la pelea, si los hay, debajo', () => {
        const panel = /** @type {any} */ (buildInitiative({ tracker, objectives: [{ label: 'Parar al ratero', status: 'pending' }] }));
        expect(panel.querySelectorAll('.wm-objective')).toHaveLength(1);
        expect(panel.querySelector('.wm-objectives-title').textContent).toBe('Objetivo');
        expect(panel.textContent).toContain('Parar al ratero');
    });
});

// ---- El resumen del combate ----

describe('el resumen del combate', () => {
    test('sale como lo dejó quien juega; si nunca lo tocó, plegado solo en una pantalla estrecha', () => {
        expect(startsFolded('true', 1280)).toBe(true);
        expect(startsFolded('false', 390)).toBe(false);
        expect(startsFolded(null, 390)).toBe(true);
        expect(startsFolded(null, 1280)).toBe(false);
    });

    test('lleva las piezas del registro, y se pliega y se despliega recordándolo', () => {
        delete store[SUMMARY_FOLD_KEY];
        const panel = /** @type {any} */ (buildSummary());
        expect(panel.classList.contains('collapsed')).toBe(false);
        for (const piece of ['.cl-body', '.cl-filters', '.cl-round-badge', '.vtt-summary-last']) {
            expect(panel.querySelector(piece)).not.toBeNull();
        }
        const toggle = panel.querySelector('.vtt-summary-toggle');
        toggle.fire('click');
        expect(panel.classList.contains('collapsed')).toBe(true);
        expect(store[SUMMARY_FOLD_KEY]).toBe('true');
        expect(toggle.attributes['aria-expanded']).toBe('false');
        toggle.fire('click');
        expect(panel.classList.contains('collapsed')).toBe(false);
        expect(store[SUMMARY_FOLD_KEY]).toBe('false');
    });
});
