/**
 * J20.6 y J20.7 de ROADMAP_SIN_CONEXION: el móvil como una app.
 *
 * - El manifiesto (`app-mode.js` y `tools/app-movil.mjs`): lo escrito es lo que sale, con sus
 *   iconos y enlazado desde `index.html`. Y cuándo la página se ha abierto desde el icono.
 * - Las animaciones (`motion.js`): cortas en un teléfono, ninguna con «reducir movimiento».
 * - El tablero ligero (`draw-light.js`): la niebla en rectángulos y lo que cabe en pantalla.
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    APP_INFO, ART_ICONS, FALLBACK_ICONS, APPLE_ICON, MANIFEST_FILE, appStartUrl, buildWebManifest, launchedAsApp, markAppMode,
} from '../public/scripts/game-engine/ui/app-mode.js';
import {
    MOTION_CHOICES, readMotionChoice, motionLevel, motionMs, applyMotion, motionOptionRow,
} from '../public/scripts/game-engine/ui/motion.js';
import {
    mergeCellRects, fogRects, cellRectsHtml, visibleWindow, inWindow, windowCovers,
} from '../public/scripts/game-engine/board/draw-light.js';
import { checkApp, manifestText, decodePng, encodePng, composeIcon } from '../tools/app-movil.mjs';

const read = (/** @type {string} */ path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

describe('J20.7: el manifiesto de la app', () => {
    const manifest = buildWebManifest();

    test('con el nombre del juego (D-J9), entra directo en el juego y a pantalla entera', () => {
        expect(manifest.name).toBe('SillyTavern RPG');
        expect(manifest.short_name.length).toBeLessThanOrEqual(12);
        expect(manifest.start_url).toBe('./?juego');
        expect(manifest.id).toBe(manifest.start_url);
        expect(manifest.scope).toBe('./');
        expect(manifest.display).toBe('fullscreen');
        expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
        expect(manifest.orientation).toBe('any');
        expect(manifest.lang).toBe('es');
        expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
        expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/);
    });

    test('con los iconos que pide Android: 192, 512 y uno con margen para recortar', () => {
        expect(manifest.icons.map((/** @type {any} */ i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
        expect(manifest.icons.every((/** @type {any} */ i) => i.type === 'image/png')).toBe(true);
        expect(manifest.icons[0].src).toBe(ART_ICONS[0].src);
        expect(buildWebManifest(APP_INFO, FALLBACK_ICONS).icons[2].src).toBe('img/game-engine/app/icono-mascara-512.png');
    });

    test('la entrada sale del parámetro: cambiarlo cambia las dos', () => {
        const other = { ...APP_INFO, startParam: 'jugar', display: /** @type {const} */ ('standalone') };
        expect(appStartUrl(other)).toBe('./?jugar');
        expect(buildWebManifest(other).display_override).toEqual(['standalone']);
    });

    test('lo escrito en disco es lo que sale, los iconos están y miden lo que dicen, e index.html los enlaza', async () => {
        expect(read(`public/${MANIFEST_FILE}`).replace(/\r\n/g, '\n')).toBe(await manifestText());
        expect(await checkApp()).toEqual([]);
        const html = read('public/index.html');
        expect(html).toContain(`<link rel="manifest" crossorigin="use-credentials" href="${MANIFEST_FILE}">`);
        expect(html).toContain(`href="${APPLE_ICON.src}"`);
        expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
    });
});

describe('J20.7: abrir desde el icono', () => {
    const never = () => ({ matches: false });

    test('desde el icono de Android (la dirección lleva ?juego)', () => {
        expect(launchedAsApp({ search: '?juego', matchMedia: never })).toBe(true);
        expect(launchedAsApp({ search: '?x=1&juego', matchMedia: never })).toBe(true);
        expect(launchedAsApp({ search: '', matchMedia: never })).toBe(false);
        expect(launchedAsApp({ search: '?jugador=1', matchMedia: never })).toBe(false);
    });

    test('desde el icono del iPhone (standalone), aunque abra otra dirección', () => {
        expect(launchedAsApp({ search: '', standalone: true, matchMedia: never })).toBe(true);
        expect(launchedAsApp({ search: '', matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) })).toBe(true);
    });

    test('un ordenador a pantalla entera (F11) no es una app', () => {
        expect(launchedAsApp({ search: '', matchMedia: (q) => ({ matches: q === '(display-mode: fullscreen)' }) })).toBe(false);
        expect(launchedAsApp({ search: '', matchMedia: () => { throw new Error('no lo entiende'); } })).toBe(false);
        expect(launchedAsApp({ search: '', matchMedia: null })).toBe(false);
    });

    test('marca la página y pinta la barra del teléfono del color del juego', () => {
        const classes = new Set();
        const meta = { content: '#333', setAttribute(/** @type {string} */ k, /** @type {string} */ v) { if (k === 'content') this.content = v; } };
        const doc = /** @type {any} */ ({
            documentElement: { classList: { toggle: (/** @type {string} */ c, /** @type {boolean} */ on) => (on ? classes.add(c) : classes.delete(c)) } },
            querySelector: () => meta,
        });
        expect(markAppMode(doc, { search: '?juego', matchMedia: never })).toBe(true);
        expect(classes.has('gs-app')).toBe(true);
        expect(meta.content).toBe(APP_INFO.theme);
        expect(markAppMode(doc, { search: '', matchMedia: never })).toBe(false);
        expect(classes.has('gs-app')).toBe(false);
        expect(markAppMode(null, { search: '?juego' })).toBe(true);
    });
});

describe('J20.7: los iconos, píxel a píxel', () => {
    test('un PNG se escribe y se vuelve a leer igual', () => {
        const image = { width: 3, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]) };
        const back = decodePng(encodePng(image));
        expect(back.width).toBe(3);
        expect(back.height).toBe(2);
        expect([...back.data]).toEqual([...image.data]);
    });

    test('un dibujo pequeño se amplía sin suavizar: cada píxel, un cuadrado', () => {
        const art = { width: 2, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]) };
        const icon = composeIcon(art, { size: 12, fill: 0.5, background: '#101010' });
        const at = (/** @type {number} */ x, /** @type {number} */ y) => [...icon.data.subarray((y * 12 + x) * 4, (y * 12 + x) * 4 + 4)];
        // 12 × 0,5 = 6: el dibujo de 2 se amplía a 6 (× 3), en el centro (de 3 a 8).
        expect(at(3, 3)).toEqual([255, 0, 0, 255]);
        expect(at(5, 5)).toEqual([255, 0, 0, 255]);
        expect(at(6, 3)).toEqual([0, 255, 0, 255]);
        expect(at(3, 6)).toEqual([0, 0, 255, 255]);
        // Lo transparente deja ver el fondo, y fuera del dibujo está el fondo.
        expect(at(7, 7)).toEqual([16, 16, 16, 255]);
        expect(at(0, 0)).toEqual([16, 16, 16, 255]);
    });

    test('el icono del iPhone no tiene transparencias', () => {
        const apple = decodePng(readFileSync(fileURLToPath(new URL(`../public/${APPLE_ICON.src}`, import.meta.url))));
        expect(apple.width).toBe(180);
        let transparent = 0;
        for (let i = 3; i < apple.data.length; i += 4) if (apple.data[i] < 255) transparent++;
        expect(transparent).toBe(0);
    });
});

describe('J20.6: las animaciones', () => {
    test('según el aparato: ninguna si se pide reducir movimiento, cortas en un teléfono, normales en un ordenador', () => {
        expect(motionLevel({ stored: '', reduced: true, touch: true })).toBe('none');
        expect(motionLevel({ stored: '', reduced: false, touch: true })).toBe('short');
        expect(motionLevel({ stored: '', reduced: false, touch: false })).toBe('normal');
        expect(motionLevel({ stored: 'lo-que-sea', reduced: false, touch: true })).toBe('short');
    });

    test('lo elegido en las opciones manda', () => {
        expect(motionLevel({ stored: 'normales', reduced: true, touch: true })).toBe('normal');
        expect(motionLevel({ stored: 'ninguna', reduced: false, touch: false })).toBe('none');
        expect(motionLevel({ stored: 'cortas', reduced: false, touch: false })).toBe('short');
        expect(readMotionChoice('nada').id).toBe('auto');
        expect(MOTION_CHOICES.map(c => c.id)).toEqual(['auto', 'normales', 'cortas', 'ninguna']);
    });

    test('lo que dura desde el código: la mitad, o nada', () => {
        expect(motionMs(820, 'normal')).toBe(820);
        expect(motionMs(820, 'short')).toBe(410);
        expect(motionMs(820, 'none')).toBe(0);
        expect(motionMs(-5, 'normal')).toBe(0);
        expect(motionMs(Number.NaN, 'short')).toBe(0);
    });

    test('se pone en la página, para la hoja movil-app.css', () => {
        const props = new Map();
        const target = /** @type {any} */ ({ dataset: {}, style: { setProperty: (/** @type {string} */ k, /** @type {string} */ v) => props.set(k, v) } });
        expect(applyMotion(target, { stored: '', reduced: false, touch: true })).toBe('short');
        expect(target.dataset.gsMotion).toBe('short');
        expect(props.get('--gs-motion-scale')).toBe('0.5');
        expect(applyMotion(null, { stored: 'ninguna' })).toBe('none');
    });

    test('la fila de las opciones dice lo que hay, en palabras', () => {
        expect(motionOptionRow({ stored: '', reduced: false, touch: true })).toMatchObject({ id: 'motion', label: 'Animaciones', value: 'Según el aparato: cortas' });
        expect(motionOptionRow({ stored: '', reduced: true, touch: false }).value).toBe('Según el aparato: ninguna');
        expect(motionOptionRow({ stored: 'normales', reduced: true, touch: true }).value).toBe('Normales');
    });

    test('la hoja está enlazada y respeta «reducir movimiento» con y sin el código', () => {
        expect(read('public/style.css')).toContain('@import url(css/movil-app.css);');
        const css = read('public/css/movil-app.css');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain(':root[data-gs-motion="none"] body.game-shell-on *');
        expect(css).toContain(':root[data-gs-motion="short"] .tr-transition');
        expect(css).toContain('@media (pointer: coarse) and (prefers-reduced-motion: no-preference)');
        expect(css).toContain('@media (display-mode: standalone), (display-mode: fullscreen)');
        expect(css).toContain('env(safe-area-inset-top, 0px)');
    });
});

describe('J20.6: el tablero ligero', () => {
    test('un tablero a oscuras es un solo rectángulo, no una caja por casilla', () => {
        const rects = mergeCellRects(50, 50, () => 'unknown');
        expect(rects).toEqual([{ x: 0, y: 0, w: 50, h: 50, kind: 'unknown' }]);
    });

    test('una sala iluminada en medio: la niebla la rodea con pocos rectángulos, y cubre lo mismo', () => {
        const lit = new Set();
        for (let y = 10; y < 20; y++) for (let x = 5; x < 15; x++) lit.add(`${x},${y}`);
        const explored = {};
        for (let x = 15; x < 25; x++) explored[`${x},12`] = true;
        const rects = fogRects({ version: 1, explored }, lit, 40, 30);
        expect(rects.length).toBeLessThan(12);
        // Cada casilla sin ver está en un rectángulo de su tipo, y solo en uno.
        const covered = new Map();
        for (const r of rects) {
            for (let y = r.y; y < r.y + r.h; y++) {
                for (let x = r.x; x < r.x + r.w; x++) {
                    expect(covered.has(`${x},${y}`)).toBe(false);
                    covered.set(`${x},${y}`, r.kind);
                }
            }
        }
        expect(covered.size).toBe(40 * 30 - 100);
        expect(covered.get('20,12')).toBe('explored');
        expect(covered.get('20,13')).toBe('unknown');
        expect(covered.has('7,15')).toBe(false);
    });

    test('un tablero a cuadros no se puede juntar: una caja por casilla, como antes', () => {
        const rects = mergeCellRects(4, 4, (x, y) => ((x + y) % 2 ? 'a' : null));
        expect(rects).toHaveLength(8);
    });

    test('solo una parte del tablero', () => {
        const rects = mergeCellRects(50, 50, () => 'unknown', { x0: 10, y0: 5, x1: 19, y1: 9 });
        expect(rects).toEqual([{ x: 10, y: 5, w: 10, h: 5, kind: 'unknown' }]);
    });

    test('en HTML, de una vez, sin dejar colar nada en la clase', () => {
        const html = cellRectsHtml([{ x: 1, y: 2, w: 3, h: 1, kind: 'unknown' }, { x: 0, y: 0, w: 1, h: 1, kind: 'x" onclick="y' }], { cellWidth: 44, cellHeight: 44, className: 'wm-fog-cell', kindPrefix: 'wm-fog-' });
        expect(html).toContain('<div class="wm-fog-cell wm-fog-unknown" style="left:44px;top:88px;width:132px;height:44px"></div>');
        expect(html).not.toContain('onclick="');
    });

    test('lo que cabe en la pantalla, con margen', () => {
        const view = { viewWidth: 390, viewHeight: 420, scale: 1, offsetX: 0, offsetY: 0, cellWidth: 44, cellHeight: 44, gridWidth: 30, gridHeight: 30, margin: 2 };
        expect(visibleWindow(view)).toEqual({ x0: 0, y0: 0, x1: 10, y1: 11 });
        // Movida la vista 440 px a la izquierda (10 casillas) y con el doble de zoom.
        expect(visibleWindow({ ...view, offsetX: -880, scale: 2 })).toEqual({ x0: 8, y0: 0, x1: 16, y1: 6 });
        // Fuera del todo.
        expect(visibleWindow({ ...view, offsetX: 5000 })).toBeNull();
        expect(visibleWindow({ ...view, gridWidth: 0 })).toBeNull();
    });

    test('mover la vista dentro del margen no obliga a redibujar', () => {
        const drawn = { x0: 0, y0: 0, x1: 12, y1: 12 };
        expect(windowCovers(drawn, { x0: 1, y0: 1, x1: 11, y1: 12 })).toBe(true);
        expect(windowCovers(drawn, { x0: 1, y0: 1, x1: 13, y1: 12 })).toBe(false);
        expect(windowCovers(null, drawn)).toBe(false);
        expect(windowCovers(drawn, null)).toBe(true);
        expect(inWindow(drawn, 12, 0)).toBe(true);
        expect(inWindow(drawn, 13, 0)).toBe(false);
        expect(inWindow(null, 99, 99)).toBe(true);
    });
});
