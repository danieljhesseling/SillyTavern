/**
 * J16.6 de ROADMAP_SIN_CONEXION: ProbarCampañas lee el registro de una vuelta del bot y la pone en
 * su pestaña (`tools/probar-campanas/clasificar.mjs`). Los registros de aquí son recortes de
 * vueltas de verdad (`tools/vuelta-1387.mjs`, `vuelta-strahd.mjs`, `vuelta-gremio.mjs`).
 */

import { describe, test, expect } from '@jest/globals';
import { readLog, classify, progressOf, numberOf } from '../tools/probar-campanas/clasificar.mjs';

/** Los números del final de una vuelta, con los que cambian. */
const numbers = ({ silences = 0, blocks = 0, hooked = 0, slow = '0', ending = 'La anarquía del barro (anarquia-del-barro)' } = {}) => [
    '--- los números (sección 6 del plan) ---',
    'NUM   Hitos de 1387 jugados sin conexión en la vuelta: 18 de 18 (el hilo principal: 14 de 14)',
    `NUM   El final: ${ending}`,
    `NUM   Silencios en la vuelta sin modelo: ${silences}`,
    `NUM   Atascos (rescatados con un comando): ${blocks}`,
    `NUM   Turnos del grupo jugados con el gancho (la barra de combate no respondía): ${hooked}`,
    `NUM   Clics lentos (más de 1,5 s): ${slow}`,
    'NUM   Lo que tarda la vuelta: 12:40',
].join('\n');

const GOOD = [
    'PASS  en el gremio, «Saltar la prueba» deja el prólogo hecho',
    '        -> ["el-muelle","la-charla","la-prueba"]',
    '  hito: la-posada (3 hechos) · 1387 · Castillo de Vane · día 2 · paso 40',
    '  · 41 «Continuar» · 1387 · Castillo de Vane · La posada · día 2 · 30/30 PG',
    'PASS  1387 llega a uno de sus tres finales, con su escena (J9.1)',
    '        -> {"ending":{"id":"anarquia-del-barro"}}',
    'PASS  ninguna orden al narrador a la vista en toda la vuelta',
    '',
    '--- los silencios ---',
    '  (ninguno)',
    '',
    '--- los atascos ---',
    '  (ninguno)',
    '',
    numbers(),
    'PASS  sin errores en la página',
].join('\n');

const SILENT = [
    'MUDO  #12 «Seguir» (1387 · Castillo de Vane · día 3)',
    'PASS  1387 llega a uno de sus tres finales, con su escena (J9.1)',
    '',
    '--- los silencios ---',
    '  #12 1387 · Castillo de Vane · día 3 · «Seguir»',
    '      se ve: escena exploration; caja: «»; fichas: Seguir',
    '      módulo: plot-scene.js',
    '',
    '--- los clics lentos (la página tarda más de 1,5 s en atenderlos) ---',
    '  1535 ms · «Continuar» · 1387 · Castillo de Vane · día 1',
    '',
    numbers({ silences: 1, slow: '1 (el peor, 1535 ms)' }),
    'PASS  sin errores en la página',
].join('\n');

const STUCK = [
    'FAIL  en el gremio, «Saltar la prueba» deja el prólogo hecho',
    '        -> ["el-muelle","la-charla"]',
    'ATASCO #25 el-gremio: no se ve nada que pulsar para lo que pide la historia (El Gremio · Puerto Alba · día 1) → ninguno',
    '        se ve: escena exploration; caja: «»; fichas: ; lo que toca: La Casa del Gremio',
    'FAIL  1387 llega a uno de sus tres finales, con su escena (J9.1)',
    '        -> {"ending":{"id":""},"gaveUp":"el-gremio: no se ve nada que pulsar","where":"El Gremio · Puerto Alba · día 1","sees":"escena exploration; caja: «»"}',
    '',
    '--- los atascos ---',
    '  #25 El Gremio · Puerto Alba · día 1 · el-gremio: no se ve nada que pulsar para lo que pide la historia',
    '      se ve: escena exploration; caja: «»; fichas: ; lo que toca: La Casa del Gremio',
    '      rescate: ninguno',
    '',
    numbers({ blocks: 1, ending: 'ninguno' }),
    'PASS  sin errores en la página',
].join('\n');

describe('readLog: lo que escribe una vuelta', () => {
    test('las comprobaciones, con su detalle debajo', () => {
        const log = readLog(STUCK);
        expect(log.checks.map(c => c.ok)).toEqual([false, false, true]);
        expect(log.checks[0].detail).toBe('["el-muelle","la-charla"]');
        // La línea «se ve» de un ATASCO en vivo no se pega al detalle de la comprobación de antes.
        expect(log.checks[1].detail.startsWith('{')).toBe(true);
    });

    test('los silencios y los atascos del final, con dónde, qué y lo que se veía', () => {
        const silent = readLog(SILENT);
        expect(silent.silences).toEqual([{ n: 12, where: '1387 · Castillo de Vane · día 3', what: '«Seguir»', sees: 'escena exploration; caja: «»; fichas: Seguir', module: 'plot-scene.js' }]);
        expect(silent.slow).toEqual([{ ms: 1535, text: '«Continuar» · 1387 · Castillo de Vane · día 1' }]);
        const stuck = readLog(STUCK);
        expect(stuck.blocks[0]).toMatchObject({ n: 25, where: 'El Gremio · Puerto Alba · día 1', rescue: 'ninguno' });
        expect(stuck.live.blocks).toBe(1);
    });

    test('los números de la sección 6 y el avance', () => {
        const log = readLog(GOOD);
        expect(numberOf(log.numbers, /^El final/)).toBe('La anarquía del barro (anarquia-del-barro)');
        expect(log.milestones).toBe(3);
        expect(log.steps).toBe(41);
        expect(log.lastWhere).toBe('1387 · Castillo de Vane · La posada · día 2');
        expect(progressOf(log).phase).toBe('Haciendo el recuento');
        expect(progressOf(readLog('La campaña del tablón: costa')).phase).toMatch(/^Arrancando/);
    });
});

describe('classify: Bien, Regular o Mal', () => {
    test('llega a un final sin silencios ni atascos ni errores: Bien', () => {
        expect(classify(readLog(GOOD), { endCheck: /finales/ }).verdict).toBe('bien');
    });

    test('llega, pero con un silencio y un clic lento: Regular, y dice los dos', () => {
        const found = classify(readLog(SILENT), { endCheck: /finales/ });
        expect(found.verdict).toBe('regular');
        expect(found.reasons.join(' ')).toMatch(/1 silencio/);
        expect(found.reasons.join(' ')).toMatch(/1 clic\(s\) lento/);
    });

    test('turnos con el gancho o una comprobación que no pasa: Regular', () => {
        const hooked = GOOD.replace('jugados con el gancho (la barra de combate no respondía): 0', 'jugados con el gancho (la barra de combate no respondía): 4');
        expect(classify(readLog(hooked), { endCheck: /finales/ }).reasons[0]).toMatch(/4 turno/);
        const leak = GOOD.replace('PASS  ninguna orden al narrador', 'FAIL  ninguna orden al narrador');
        const found = classify(readLog(leak), { endCheck: /finales/ });
        expect(found.verdict).toBe('regular');
        expect(found.failed.map(f => f.name)).toEqual(['ninguna orden al narrador a la vista en toda la vuelta']);
    });

    test('se queda antes de un final: Mal, con dónde, lo que se veía y lo primero que falla', () => {
        const found = classify(readLog(STUCK), { endCheck: /finales/ });
        expect(found.verdict).toBe('mal');
        expect(found.where).toBe('El Gremio · Puerto Alba · día 1');
        expect(found.sees).toBe('escena exploration; caja: «»');
        expect(found.reasons[0]).toMatch(/Se queda antes de llegar al final/);
        expect(found.reasons[1]).toMatch(/Saltar la prueba/);
    });

    test('errores en la página o la vuelta rota: Mal aunque llegue', () => {
        const errors = GOOD.replace('PASS  sin errores en la página', 'FAIL  sin errores en la página\n        -> PAGEERROR x is not defined');
        expect(classify(readLog(errors), { endCheck: /finales/ })).toMatchObject({ verdict: 'mal', counts: { pageErrors: 1 } });
        const threw = classify(readLog('FAIL  the run threw: the server did not start in 360s'), { endCheck: /finales/, exitCode: 1 });
        expect(threw.verdict).toBe('mal');
        expect(threw.reasons[0]).toMatch(/se ha roto: the server did not start/);
        expect(classify(readLog(''), { endCheck: /finales/, exitCode: null }).verdict).toBe('mal');
    });

    test('la vuelta del gremio: todas sus comprobaciones son el camino', () => {
        const gremio = 'PASS  el prólogo se juega entero a clics\nFAIL  en Strahd, a clics, se gana la Taberna: su primer hito\n        -> {"gaveUp":"x","where":"La Maldición de Strahd · Aldea de Barovia · día 1"}\nPASS  sin errores en la página';
        const found = classify(readLog(gremio), { endCheck: null });
        expect(found).toMatchObject({ verdict: 'mal', reached: false, where: 'La Maldición de Strahd · Aldea de Barovia · día 1' });
        expect(classify(readLog(gremio.replace('FAIL  en Strahd', 'PASS  en Strahd')), { endCheck: null }).verdict).toBe('bien');
    });

    test('parada con «Parar»: ni Bien ni Mal', () => {
        expect(classify(readLog(STUCK), { endCheck: /finales/, stopped: true }).verdict).toBe('parada');
    });
});
