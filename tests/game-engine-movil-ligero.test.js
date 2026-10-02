/**
 * J20.6 de ROADMAP_SIN_CONEXION: el juego, ligero en el móvil.
 *
 * El registro de combate se pinta a trozos: lo ya pintado se queda, se quitan las filas viejas
 * que suelta y se añaden solo las nuevas (`reusableRows`). El tablero junta la niebla en
 * rectángulos y, si es grande, dibuja solo lo que se ve: eso lo prueba `game-engine-movil-app`
 * (`draw-light.js`), y la vuelta en el móvil lo mide (`tools/e2e-movil.mjs`).
 *
 * El vigilante del teclado de SillyTavern (`keyboard.js`) mira cada cambio una vez, y solo lo de
 * más arriba (`outermostConnected`): antes era lo que más pesaba al redibujar el juego.
 *
 * jQuery recuerda todos los selectores de los toques (`widenSelectorCache`, en `app-mode.js`):
 * con los 50 suyos, cada toque volvía a traducir los ~126 de SillyTavern.
 */

/* global globalThis */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { append, entry, filterLog, MAX_ENTRIES, reusableRows } from '../public/scripts/game-engine/ui/combat-log.js';

/** Un registro de `n` líneas, cada una su propio objeto (como las deja `append`). */
function logOf(n, from = 0) {
    let list = [];
    for (let i = 0; i < n; i++) list = append(list, entry('info', `línea ${from + i}`));
    return list;
}

describe('J20.6: el registro de combate se pinta a trozos', () => {
    test('con líneas nuevas al final, se queda todo lo pintado y se añaden solo ellas', () => {
        const before = logOf(5);
        const next = append(append(before, entry('hit', 'acierta')), entry('damage', '3 de daño'));
        expect(reusableRows(before, next)).toEqual({ drop: 0, keep: 5 });
    });

    test('lo mismo otra vez no añade nada', () => {
        const list = logOf(4);
        expect(reusableRows(list, list)).toEqual({ drop: 0, keep: 4 });
    });

    test('lleno, suelta las más viejas por arriba: se quitan esas filas y el resto se queda', () => {
        const before = logOf(MAX_ENTRIES);
        const next = append(append(before, entry('info', 'otra')), entry('info', 'y otra'));
        expect(next).toHaveLength(MAX_ENTRIES);
        expect(reusableRows(before, next)).toEqual({ drop: 2, keep: MAX_ENTRIES - 2 });
    });

    test('con otro filtro (o otra pelea) no encaja, y se pinta entero', () => {
        const all = [...logOf(3), entry('attack', 'Nerea ataca', { roll: { formula: 'd20', rolls: [12], total: 12, natural: 12, dc: 11 } }), ...logOf(2, 3)];
        const rolls = filterLog(all, { kind: 'rolls' });
        expect(reusableRows(all, rolls)).toBeNull();
        expect(reusableRows(rolls, all)).toBeNull();
        expect(reusableRows(logOf(3), logOf(3))).toBeNull();
    });

    test('sin nada pintado, o sin nada que pintar, se pinta entero', () => {
        expect(reusableRows(undefined, logOf(2))).toBeNull();
        expect(reusableRows([], logOf(2))).toBeNull();
        expect(reusableRows(logOf(2), [])).toBeNull();
    });

    test('si lo pintado no sigue igual en su orden, no se aprovecha', () => {
        const before = logOf(4);
        const swapped = [before[0], before[2], before[1], before[3]];
        expect(reusableRows(before, swapped)).toBeNull();
    });
});

describe('J20.6: el teclado de SillyTavern mira cada cambio una vez', () => {
    /** @type {(changed: Set<any>) => any[]} */
    let outermostConnected;

    beforeAll(async () => {
        // keyboard.js prepara su vigilante al cargarse: aquí basta con que exista.
        const scope = /** @type {any} */ (globalThis);
        scope.CSS ??= { supports: () => false };
        scope.MutationObserver ??= class { observe() {} };
        ({ outermostConnected } = await import('../public/scripts/keyboard.js'));
    });

    /** Un nodo de mentira: solo lo que se mira (si está en la página y quién lo contiene). */
    const node = (name, parentElement = null, isConnected = true) => ({ name, parentElement, isConnected });

    test('lo que cuelga de otro cambiado no se mira aparte: ya lo recorre el de arriba', () => {
        const board = node('tablero');
        const row = node('fila', board);
        const button = node('botón', row);
        const other = node('otro');
        const roots = outermostConnected(new Set([button, board, row, other]));
        expect(roots.map(n => n.name)).toEqual(['tablero', 'otro']);
    });

    test('lo que ya no está en la página se salta', () => {
        const gone = node('quitado', null, false);
        const kept = node('puesto');
        expect(outermostConnected(new Set([gone, kept])).map(n => n.name)).toEqual(['puesto']);
    });
});

describe('J20.6: jQuery recuerda todos los selectores de la página', () => {
    /** @type {typeof import('../public/scripts/game-engine/ui/app-mode.js')} */
    let appMode;

    beforeAll(async () => {
        appMode = await import('../public/scripts/game-engine/ui/app-mode.js');
    });

    /** Lo que se mira de jQuery: su `expr.cacheLength` (Sizzle). */
    const jqWith = (cacheLength) => ({ expr: { cacheLength } });

    test('los 50 de jQuery suben a los del juego, y lo dice', () => {
        const jq = jqWith(50);
        expect(appMode.widenSelectorCache(jq)).toBe(true);
        expect(jq.expr.cacheLength).toBe(appMode.SELECTOR_CACHE_SIZE);
        // Sitio para los ~126 selectores de los clics y los ~121 de escribir, juntos.
        expect(appMode.SELECTOR_CACHE_SIZE).toBeGreaterThanOrEqual(250);
    });

    test('nunca lo baja, y sin jQuery no hace nada', () => {
        const big = jqWith(5000);
        expect(appMode.widenSelectorCache(big)).toBe(false);
        expect(big.expr.cacheLength).toBe(5000);
        expect(appMode.widenSelectorCache(null)).toBe(false);
        expect(appMode.widenSelectorCache({})).toBe(false);
    });

    test('al abrirse la página (markAppMode) se ensancha, con app o sin ella', () => {
        const jq = jqWith(50);
        const doc = { defaultView: { jQuery: jq }, documentElement: { classList: { toggle: () => {} } }, querySelector: () => null };
        appMode.markAppMode(/** @type {any} */ (doc), { search: '' });
        expect(jq.expr.cacheLength).toBe(appMode.SELECTOR_CACHE_SIZE);
    });
});
