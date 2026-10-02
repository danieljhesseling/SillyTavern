/**
 * J15.5 de ROADMAP_SIN_CONEXION: el juego sin conexión, con el teclado solo.
 *
 * Lo que es cálculo: a qué opción lleva cada flecha en una lista o una rejilla
 * (`pickNeighbour`), cómo se reconoce un botón después de redibujarlo (`focusKeyFrom`), el
 * nombre de un botón que es solo un icono (`iconButtonLabel`), el contraste de dos colores
 * (`contrastRatio`), y el tablero con un cursor (`board-keys.js`): a qué casilla lleva cada
 * flecha, qué hace Intro en una casilla y lo que se dice de ella.
 *
 * Lo que toca la página (el foco que vuelve, Tab en círculo, Esc) lo prueba
 * `tools/e2e-teclado.mjs`, jugando de la portada a una pelea con el teclado solo. Aquí, con una
 * página de mentira, solo a dónde va el foco cuando se pierde o vuelve (`rescueFocus`, `returnFocus`).
 */

/* global globalThis */

import { describe, test, expect, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
    ARROW_KEYS, ICON_NAMES, PRIMARY_TARGETS, blend, contrastRatio, focusKeyFrom, iconButtonLabel, parseColor, pickNeighbour,
    rescueFocus, returnFocus,
} from '../public/scripts/game-engine/ui/keyboard-nav.js';
import {
    BOARD_HINT, BOARD_KEYS, cellAction, cursorLine, nextToken, showCursor, stepCell, tokenAt, tokenLine,
} from '../public/scripts/game-engine/ui/board-keys.js';
import { withMotionRow } from '../public/scripts/game-engine/ui/game-options.js';

/** Una rejilla de `cols` columnas de cajas de 100×50, con 10 de hueco. */
function grid(count, cols) {
    return Array.from({ length: count }, (_, i) => ({ x: (i % cols) * 110, y: Math.floor(i / cols) * 60, w: 100, h: 50 }));
}

describe('pickNeighbour: las flechas en una lista', () => {
    test('en una fila, derecha e izquierda pasan a la de al lado y dan la vuelta', () => {
        const row = grid(4, 4);
        expect(pickNeighbour(row, 0, 'ArrowRight')).toBe(1);
        expect(pickNeighbour(row, 3, 'ArrowRight')).toBe(0);
        expect(pickNeighbour(row, 0, 'ArrowLeft')).toBe(3);
        expect(pickNeighbour(row, 2, 'ArrowLeft')).toBe(1);
    });

    test('en una columna, abajo y arriba', () => {
        const column = grid(3, 1);
        expect(pickNeighbour(column, 0, 'ArrowDown')).toBe(1);
        expect(pickNeighbour(column, 2, 'ArrowDown')).toBe(0);
        expect(pickNeighbour(column, 0, 'ArrowUp')).toBe(2);
    });

    test('en una rejilla, abajo va a la de debajo y no a la siguiente', () => {
        // 0 1
        // 2 3
        // 4
        const cards = grid(5, 2);
        expect(pickNeighbour(cards, 0, 'ArrowDown')).toBe(2);
        expect(pickNeighbour(cards, 1, 'ArrowDown')).toBe(3);
        expect(pickNeighbour(cards, 3, 'ArrowUp')).toBe(1);
        // De lado, solo en la misma fila: desde la última de una fila se sigue por el orden.
        expect(pickNeighbour(cards, 2, 'ArrowRight')).toBe(3);
        expect(pickNeighbour(cards, 1, 'ArrowRight')).toBe(2);
    });

    test('Inicio y Fin, a la primera y a la última; sin lista, no se mueve', () => {
        const row = grid(5, 5);
        expect(pickNeighbour(row, 3, 'Home')).toBe(0);
        expect(pickNeighbour(row, 1, 'End')).toBe(4);
        expect(pickNeighbour([], 0, 'ArrowDown')).toBe(0);
        expect(pickNeighbour(row, -1, 'ArrowDown')).toBe(-1);
        expect(ARROW_KEYS).toEqual(expect.arrayContaining(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']));
    });
});

describe('focusKeyFrom: el mismo botón después de redibujar', () => {
    test('lo que dice qué es manda: el id, y si no, sus data-*', () => {
        expect(focusKeyFrom({ tag: 'button', id: 'gs-go', text: 'Ir' })).toBe('button#gs-go');
        const before = focusKeyFrom({ tag: 'button', data: { chip: 'continue' }, classes: ['gs-chip', 'is-on'], text: 'Continuar' });
        const after = focusKeyFrom({ tag: 'button', data: { chip: 'continue' }, classes: ['gs-chip'], text: 'Continuar (2)' });
        expect(before).toBe(after);
    });

    test('sin marcas, sus clases (sin las de estado) y su texto', () => {
        const a = focusKeyFrom({ tag: 'button', classes: ['fc-kind', 'is-on'], text: 'Icono' });
        const b = focusKeyFrom({ tag: 'button', classes: ['fc-kind'], text: 'Icono' });
        const c = focusKeyFrom({ tag: 'button', classes: ['fc-kind'], text: 'Emoji' });
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });
});

describe('iconButtonLabel: el nombre de un botón que es solo un icono', () => {
    test('por su title, sin la tecla entre paréntesis', () => {
        expect(iconButtonLabel({ title: 'Salir del Modo Juego (Esc)', icons: ['fa-solid', 'fa-xmark'] })).toBe('Salir del Modo Juego');
    });

    test('sin title, por su icono', () => {
        expect(iconButtonLabel({ icons: ['fa-solid', 'fa-xmark'] })).toBe('Cerrar');
        expect(iconButtonLabel({ icons: ['fa-solid', 'fa-dice-d20'] })).toBe(ICON_NAMES['fa-dice-d20']);
    });

    test('un número no es un nombre: «Avisos: 4»', () => {
        expect(iconButtonLabel({ text: '4', icons: ['fa-solid', 'fa-bell'] })).toBe('Avisos: 4');
    });

    test('lo que ya se llama de algo, o no se sabe cómo, se deja', () => {
        expect(iconButtonLabel({ text: 'Atacar', icons: ['fa-hand-fist'] })).toBe('');
        expect(iconButtonLabel({ label: 'Pausa', icons: ['fa-bars'] })).toBe('');
        expect(iconButtonLabel({ labelledby: 'x', icons: ['fa-bars'] })).toBe('');
        expect(iconButtonLabel({ icons: ['fa-solid', 'fa-otra-cosa'] })).toBe('');
    });
});

describe('el contraste del texto', () => {
    test('negro y blanco, 21; iguales, 1', () => {
        expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
        expect(contrastRatio([90, 90, 90], [90, 90, 90])).toBeCloseTo(1, 5);
    });

    test('los colores de CSS se leen, con su opacidad', () => {
        expect(parseColor('#fff')).toEqual({ rgb: [255, 255, 255], alpha: 1 });
        expect(parseColor('#ffd978')).toEqual({ rgb: [255, 217, 120], alpha: 1 });
        expect(parseColor('rgba(10, 8, 6, 0.92)')).toEqual({ rgb: [10, 8, 6], alpha: 0.92 });
        expect(parseColor('rgb(1 2 3 / 0.5)')).toEqual({ rgb: [1, 2, 3], alpha: 0.5 });
        expect(parseColor('transparente')).toBeNull();
        expect(blend([255, 255, 255], 0.5, [0, 0, 0])).toEqual([128, 128, 128]);
    });

    test('el anillo del foco se ve sobre el fondo oscuro del juego y su filo oscuro sobre el dorado', () => {
        const ring = /** @type {[number, number, number]} */ ([255, 217, 120]);
        expect(contrastRatio(ring, [16, 14, 12])).toBeGreaterThanOrEqual(3);
        expect(contrastRatio([10, 8, 6], [214, 180, 106])).toBeGreaterThanOrEqual(3);
    });

    test('lo que se arregló: el número de avisos (blanco sobre rojo) y la tecla «Esc» de la pausa', () => {
        expect(contrastRatio([255, 255, 255], [165, 83, 79])).toBeGreaterThanOrEqual(4.5);
        // Antes: gris al 55 % sobre la cajita clara (3,06). Ahora al 85 %.
        const before = blend([51, 51, 51], 0.55, [235, 234, 234]);
        const after = blend([51, 51, 51], 0.85, [235, 234, 234]);
        expect(contrastRatio(before, [235, 234, 234])).toBeLessThan(4.5);
        expect(contrastRatio(after, [235, 234, 234])).toBeGreaterThanOrEqual(4.5);
    });
});

describe('board-keys: el tablero con un cursor', () => {
    const tokens = [
        { id: 1, name: 'Nerea', gridX: 5, gridY: 6, hp: 34, maxHp: 34 },
        { id: 2, name: 'Ratero del muelle', gridX: 4, gridY: 5, isEnemy: true, hp: 3, maxHp: 5 },
        { id: 3, name: 'Ogro', gridX: 0, gridY: 0, isEnemy: true, sizeCells: 2 },
    ];

    test('las flechas mueven una casilla sin salirse', () => {
        const size = { width: 8, height: 6 };
        expect(stepCell({ x: 3, y: 3 }, 'ArrowRight', size)).toEqual({ x: 4, y: 3 });
        expect(stepCell({ x: 3, y: 3 }, 'ArrowUp', size)).toEqual({ x: 3, y: 2 });
        expect(stepCell({ x: 0, y: 0 }, 'ArrowLeft', size)).toEqual({ x: 0, y: 0 });
        expect(stepCell({ x: 7, y: 5 }, 'ArrowDown', size)).toEqual({ x: 7, y: 5 });
    });

    test('una criatura grande ocupa varias casillas', () => {
        expect(tokenAt(tokens, { x: 1, y: 1 })?.name).toBe('Ogro');
        expect(tokenAt(tokens, { x: 2, y: 1 })).toBeNull();
        expect(tokenAt(tokens, { x: 5, y: 6 })?.name).toBe('Nerea');
    });

    test('Intro hace lo que haría un clic: la casilla encendida manda, si no la ficha', () => {
        const lit = [{ x: 4, y: 5, kind: /** @type {const} */ ('attack') }, { x: 5, y: 5, kind: /** @type {const} */ ('move') }];
        expect(cellAction({ x: 4, y: 5 }, lit, tokens)).toMatchObject({ kind: 'attack', token: { name: 'Ratero del muelle' } });
        expect(cellAction({ x: 5, y: 5 }, lit, tokens)).toEqual({ kind: 'move', token: null });
        expect(cellAction({ x: 5, y: 6 }, lit, tokens)).toMatchObject({ kind: 'token', token: { name: 'Nerea' } });
        expect(cellAction({ x: 7, y: 2 }, lit, tokens)).toEqual({ kind: 'none', token: null });
    });

    test('Av Pág: de tu ficha al enemigo, y la vuelta', () => {
        expect(nextToken(tokens, { x: 5, y: 6 }, 1)?.name).toBe('Ratero del muelle');
        expect(nextToken(tokens, { x: 0, y: 0 }, 1)?.name).toBe('Nerea');
        expect(nextToken(tokens, { x: 5, y: 6 }, -1)?.name).toBe('Ogro');
        expect(nextToken([], { x: 0, y: 0 }, 1)).toBeNull();
    });

    test('lo que se dice de la casilla, en palabras', () => {
        expect(tokenLine(tokens[1])).toBe('Ratero del muelle (enemigo, 3 de 5)');
        expect(tokenLine({ id: 9, name: 'Lobo', gridX: 0, gridY: 0, isSummon: true })).toBe('Lobo (invocación)');
        const attack = cursorLine({ x: 4, y: 5 }, { kind: 'attack', token: tokens[1] }, 'Casilla (5, 6) · Suelo');
        expect(attack).toBe('Casilla (5, 6) · Suelo · Ratero del muelle (enemigo, 3 de 5) · Intro: atacar');
        expect(cursorLine({ x: 0, y: 2 }, { kind: 'none', token: null })).toBe('Casilla (1, 3) · Aquí no se puede ir');
        expect(cursorLine({ x: 1, y: 1 }, { kind: 'move', token: null }, 'Agua')).toBe('Casilla (2, 2) · Agua · Intro: ir aquí');
    });

    test('el cursor solo con el teclado: se pone y se quita su marca', () => {
        /** @type {Record<string, boolean>} */
        const classes = {};
        const container = /** @type {any} */ ({ classList: { toggle: (/** @type {string} */ name, /** @type {boolean} */ on) => { classes[name] = on; } } });
        showCursor(container, true);
        expect(classes['gs-board-typing']).toBe(true);
        showCursor(container, false);
        expect(classes['gs-board-typing']).toBe(false);
    });

    test('la pista dice las teclas, y son las que escucha', () => {
        for (const key of ['ArrowUp', 'Home', 'PageDown', 'Enter']) expect(BOARD_KEYS).toContain(key);
        expect(BOARD_HINT).toMatch(/Flechas/);
        expect(BOARD_HINT).toMatch(/Intro/);
        expect(BOARD_HINT).toMatch(/Tab/);
    });
});

describe('las opciones: «Animaciones» detrás de la velocidad del texto', () => {
    const row = { id: 'motion', label: 'Animaciones', value: 'Normales' };
    test('se pone justo detrás de «speed», o al final', () => {
        const list = withMotionRow([{ id: 'size', label: 'a', value: '' }, { id: 'speed', label: 'b', value: '' }, { id: 'audio', label: 'c', value: '' }], row);
        expect(list.map(r => r.id)).toEqual(['size', 'speed', 'motion', 'audio']);
        expect(withMotionRow([{ id: 'x', label: '', value: '' }], row).map(r => r.id)).toEqual(['x', 'motion']);
    });

    test('si ya la trae quien abre la ventana, no se repite', () => {
        const list = [{ id: 'motion', label: 'Animaciones', value: 'Cortas' }];
        expect(withMotionRow(list, row)).toBe(list);
    });
});

describe('la hoja del teclado', () => {
    const css = readFileSync(new URL('../public/css/teclado.css', import.meta.url), 'utf8');
    const style = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');

    test('se carga con el resto del juego', () => {
        expect(style).toContain('@import url(css/teclado.css);');
    });

    test('el foco del teclado se ve, solo con el juego abierto y no con el ratón', () => {
        expect(css).toMatch(/body\.game-shell-on [^{]*:focus-visible\s*\{[^}]*outline: 3px solid/);
        expect(css).toContain('.gs-board-cursor');
    });

    test('el cursor del tablero y su pista no se ven sin el teclado (un clic no los enciende)', () => {
        expect(css).toMatch(/\.wm-container\.gs-board-keys:not\(\.gs-board-typing\) \.gs-board-cursor\s*\{[^}]*display: none/);
    });
});

/**
 * Una página de mentira, lo justo para `returnFocus` y `rescueFocus`: cada botón dice a qué
 * selectores (escritos tal cual) responde, y la página devuelve los que respondan.
 */
function fakePage() {
    class FakeElement {
        /** @param {string} name @param {string[]} selectors */
        constructor(name, selectors) {
            this.name = name;
            this.selectors = new Set(selectors);
            this.isConnected = true;
            this.tabIndex = 0;
            this.ownerDocument = doc;
            this.dataset = {};
        }
        matches(/** @type {string} */ selector) { return this.selectors.has(selector); }
        closest() { return null; }
        getBoundingClientRect() { return { width: 40, height: 20 }; }
        focus() { doc.activeElement = this; }
        scrollIntoView() {}
    }
    const body = { name: 'body' };
    /** @type {any} */
    const doc = {
        body,
        documentElement: { name: 'html' },
        activeElement: body,
        /** @type {FakeElement[]} */
        all: [],
        querySelectorAll(/** @type {string} */ selector) { return this.all.filter((/** @type {FakeElement} */ node) => node.isConnected && node.selectors.has(selector)); },
        querySelector(/** @type {string} */ selector) { return this.querySelectorAll(selector)[0] ?? null; },
    };
    const add = (/** @type {string} */ name, /** @type {string[]} */ selectors) => {
        const node = new FakeElement(name, selectors);
        doc.all.push(node);
        return node;
    };
    globalThis.HTMLElement = /** @type {any} */ (FakeElement);
    globalThis.getComputedStyle = /** @type {any} */ (() => ({ visibility: 'visible', display: 'block' }));
    return { doc, add };
}

describe('el foco que vuelve (con una página de mentira)', () => {
    const BOARD = '.gs-root[data-scene="combat"] .gs-scene-map .wm-container.gs-board-keys';
    const saved = { element: globalThis.HTMLElement, style: globalThis.getComputedStyle };
    afterAll(() => {
        globalThis.HTMLElement = saved.element;
        globalThis.getComputedStyle = saved.style;
    });

    test('al cerrarse los dados, el foco vuelve a lo que los abrió', () => {
        const { doc, add } = fakePage();
        const attack = add('Atacar', ['.gs-root .gs-actions .gs-btn-attack', '.gs-root button']);
        add('tablero', [BOARD]);
        returnFocus(/** @type {any} */ (attack), doc);
        expect(doc.activeElement.name).toBe('Atacar');
    });

    test('pero no a «Fin de turno»: ese turno ya pasó, y el foco va al tablero', () => {
        const { doc, add } = fakePage();
        const end = add('Fin de turno', ['.gs-btn-end', '.gs-root .gs-actions button', '.gs-root button']);
        add('tablero', [BOARD]);
        returnFocus(/** @type {any} */ (end), doc);
        expect(doc.activeElement.name).toBe('tablero');
    });

    test('si el foco ya está en algo, no se le quita', () => {
        const { doc, add } = fakePage();
        const end = add('Fin de turno', ['.gs-btn-end']);
        const other = add('Grupo', ['.gs-root button']);
        doc.activeElement = other;
        returnFocus(/** @type {any} */ (end), doc);
        expect(doc.activeElement.name).toBe('Grupo');
    });

    test('colocando al grupo antes de la pelea, lo principal es «Empezar» (antes que el tablero o «Continuar»)', () => {
        const { doc, add } = fakePage();
        add('Continuar', ['.gs-root .gs-vn-box .gs-chip-continue', '.gs-root button']);
        add('tablero', [BOARD]);
        add('Empezar', ['.cv-place .cv-place-start']);
        expect(rescueFocus(doc)).toBe(true);
        expect(doc.activeElement.name).toBe('Empezar');
        expect(PRIMARY_TARGETS.indexOf('.cv-place .cv-place-start')).toBeLessThan(PRIMARY_TARGETS.indexOf(BOARD));
    });

    test('sin colocar, tras una escena del hilo: «Continuar»', () => {
        const { doc, add } = fakePage();
        add('Diario', ['.gs-root button']);
        add('Continuar', ['.gs-root .gs-vn-box .gs-chip-continue', '.gs-root button']);
        rescueFocus(doc);
        expect(doc.activeElement.name).toBe('Continuar');
    });
});
