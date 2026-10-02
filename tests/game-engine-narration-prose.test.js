import { readFileSync } from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { matches } from '../public/scripts/game-engine/compendio/compendio.js';
import { noteProse } from '../public/scripts/game-engine/campaign/narration-prose.js';
import {
    countedName, goldWords, listWords, mealProse, needsProse, pluralName, rollProse, sucesoProse,
} from '../public/scripts/game-engine/campaign/narration-notes.js';
import { readTaggedLine } from '../public/scripts/game-engine/campaign/chronicle.js';
import { stripEngineTags } from '../public/scripts/game-engine/ui/shell/engine-tags.js';

/** Lo que se lee en la caja: la nota contada, sin la etiqueta. */
const read = (/** @type {string} */ note) => stripEngineTags(noteProse(note));

/** Lo que no puede leerse sin modelo (J18.10): etiquetas, casillas, cifras de registro, siglas. */
const LOG = /\[[\p{Lu} ]+\]|\(\s*\d+\s*,\s*\d+\s*\)|\d+\s*\/\s*\d+|\d\s*→\s*\d|\(d20|\b\d+\s*(?:PG|PX|ft)\b|\b(?:CA|CD)\s*\d|\/combat/u;

// J13.1 de ROADMAP_SIN_CONEXION: cada nota del motor, contada como la diría un narrador.
describe('noteProse: the fight', () => {
    test('the turn, the round and the start read as sentences', () => {
        expect(read('🛡️ [COMBAT] Turno de Irene (Jugador)')).toBe('Le toca a Irene.');
        expect(read('⚔️ [COMBAT] Turno de Rata de bodega 2 (Enemigo)')).toBe('Le toca a Rata de bodega 2.');
        expect(read('⏳ [COMBAT] Ronda 2')).toBe('Empieza la segunda ronda.');
        expect(read('⏳ [COMBAT] Ronda 14')).toBe('Empieza la ronda 14.');
        expect(read('[COMBAT] Empieza el combate del tablero: Rata de bodega x2.')).toBe('Empieza la pelea contra dos ratas de bodega.');
        expect(read('⚔️ [COMBAT] ¡Encuentro iniciado!\n\nOrden de iniciativa:\n1. Rata de bodega 2 (13) ⚔️\n2. Irene (11)\n3. Rata de bodega (11) ⚔️'))
            .toBe('¡Empieza la pelea! Actúa primero Rata de bodega 2; después, Irene y Rata de bodega.');
    });

    test('«elige accion» loses its slash commands and keeps the feet and the targets', () => {
        const note = '💬 [COMBAT] Irene, elige accion. Usa /combat-attack <objetivo>, /combat-move <x> <y> y /combat-end. Movimiento restante: 30 ft. Rango actual: 5 ft. Objetivos en rango: ';
        expect(read(`${note}Rata de bodega 2.`)).toBe('Irene puede moverse 30 pies y tiene a su alcance a Rata de bodega 2.');
        expect(read(`${note}ningun enemigo en rango.`)).toBe('Irene puede moverse 30 pies; no tiene a nadie a su alcance.');
    });

    test('a blow-by-blow block reads as one paragraph, without squares, dice breakdowns or emoji', () => {
        const turn = '🚶 Rata de bodega 2 avanza a (7, 6). Acorta la distancia y ataca. (20 ft)\n👹 Rata de bodega 2 ataca a Irene.\n'
            + '🎲 Ataque de Rata de bodega 2 a Irene: 10 contra CA 16 ✗ (d20 10 +0)\n❌ Resultado: fallo.';
        expect(read(turn)).toBe('Rata de bodega 2 avanza 20 pies. Acorta la distancia y ataca. Rata de bodega 2 ataca a Irene. Saca un 10 contra una defensa de 16. Falla.');
        const blow = '🎲 Ataque de Irene a Rata: 18 contra CA 12 ✓ (d20 15 +3)\n✅ Resultado: impacto critico.\n💥 Daño: 9 (1d8 5 crítico +2 +2)\n❤️ Estado de Rata: 2/6';
        expect(read(blow)).toBe('Irene ataca a Rata: saca un 18 contra una defensa de 12. ¡Golpe crítico! El golpe hace 9 de daño. A Rata le quedan 2 de sus 6 puntos de vida.');
        expect(read('🩸 Irene cae a 0 PG y empieza a jugarsela: tres exitos para estabilizarse, tres fallos y se acabo.')).not.toMatch(LOG);
        expect(read('🛡️ Gerd se interpone: Irene aguanta con 1 HP.')).toBe('Gerd se interpone, y Irene aguanta con un punto de vida.');
    });

    test('the objectives, the summary and the loot keep their numbers in the sentence', () => {
        expect(read('🎯 [COMBAT] ✅ Parar al ratero')).toBe('Cumplido: parar al ratero.');
        expect(read('🎯 [COMBAT] ✅ Parar al ratero · ⬜ Salir vivos (opcional)')).toBe('Cumplido: parar al ratero. Queda por hacer: salir vivos, que era opcional.');
        const summary = '📋 [COMBAT] Resumen final\nResultado: victoria del grupo.\nEnemigos derrotados: 2/2\nAliados en pie: 2/3\n'
            + 'HP aliados: Irene 20/34 | Gerd 0/22 | Nella 18/18\nHP enemigos: Rata 0/6 | Rata 2 0/6';
        expect(read(summary)).toBe('La pelea acaba en victoria. No queda ningún enemigo en pie. Nella sigue sin un rasguño. A Irene le quedan 20 de sus 34 puntos de vida. Gerd está en el suelo.');
        expect(read('💰 [COMBAT] Botín: 31 de oro y 25 PX (31 y 25 para cada superviviente).')).toBe('Botín: 31 monedas de oro y 25 puntos de experiencia.');
        expect(read('💰 [COMBAT] Botín: 112 de oro y 50 PX (56 y 25 para cada superviviente).'))
            .toBe('Botín: 112 monedas de oro y 50 puntos de experiencia. A cada superviviente le tocan 56 de oro y 25 de experiencia.');
    });
});

describe('noteProse: the town, the clock and the body', () => {
    test('the meal, the shop and the stable say what it costs in coins', () => {
        const meal = read('🍲 [POSADA] Comida caliente para todos (1 de oro).');
        expect(meal).toMatch(/una moneda de oro/);
        expect(meal).not.toMatch(LOG);
        expect(read('🛒 [TIENDA] Irene compra Frasco de aceite por 9 de oro.')).toBe('Irene compra Frasco de aceite por nueve monedas de oro.');
        expect(read('🪙 [TIENDA] Vendéis Daga oxidada, Cuerda: 7 de oro.')).toBe('Vendéis Daga oxidada y Cuerda por siete monedas de oro.');
        expect(read('🐴 [CAMPAÑA] El pienso de las monturas: 3 de oro.')).toBe('El pienso de las monturas cuesta tres monedas de oro.');
    });

    test('the clock, the rest and the needs', () => {
        expect(read('🕐 [CAMPAÑA] Día 1 · Tarde.')).toMatch(/por la tarde/);
        expect(read('🕐 [CAMPAÑA] Día 1 · Tarde.')).toMatch(/día 1|Día 1/);
        expect(read('[DESCANSO] Descanso largo.\nIrene: 34 → 34 PG.')).toBe('Descanso largo. Irene no tenía heridas que curar.');
        expect(read('[DESCANSO] Descanso corto.\nIrene: 20 → 27 PG, 1 dado de golpe (7).\nGerd: 22 → 22 PG.'))
            .toBe('Descanso corto. Irene gasta un dado de golpe y pasa de 20 a 27 puntos de vida. Gerd no tenía heridas que curar.');
        expect(read('[DESCANSO] Descanso largo.\nIrene: 12 → 34 PG, recupera 1 dado de golpe.\nGerd: 22 → 22 PG.\nNella: 18 → 18 PG.'))
            .toBe('Descanso largo. Irene pasa de 12 a 34 puntos de vida y recupera un dado de golpe. Gerd y Nella no tenían heridas que curar.');
        expect(read('🥖 [CAMPAÑA] Irene empieza a acusar sed. Irene empieza a acusar sueño.')).toBe('Irene empieza a tener sed y sueño.');
    });

    test('the same note is told with different words further down the chat', () => {
        const told = new Set(['1', '2', '3', '4', '5', '6', '7', '8'].map(key => noteProse('🍲 [POSADA] Comida caliente para todos (1 de oro).', { key })));
        expect(told.size).toBeGreaterThan(1);
    });
});

describe('noteProse: rolls, boards, cases and levels', () => {
    test('a roll reads as who tried what and how it went', () => {
        expect(read('🎲 [TIRADA] Perspicacia de Irene: 14 contra CD 13 ✓ Éxito (d20 12 +2). Le caláis: lo que busca es dinero.'))
            .toBe('Irene prueba con Perspicacia: saca un 14, y le hacía falta un 13. Sale bien. Le caláis: lo que busca es dinero.');
        expect(read('🎲 Juego de manos de Irene: 8 contra CD 15 ✗ Fallo (d20 5 +3)')).toBe('Irene prueba con Juego de manos: saca un 8, y le hacía falta un 15. No sale.');
        expect(read('🎲 Guardia de Gerd: 12 contra 10 ✓')).toMatch(/^Gerd hace la guardia: saca un 12/);
    });

    // Tanda 16: e2e-magia fallaba en «examinar a la luz»: la tirada sumaba +2, pero al contarla se
    // perdía con el desglose del dado.
    test('what helps a roll is still said: «+2 por la Luz» (D-J51), but not the die breakdown', () => {
        expect(read('🎲 [TIRADA] Investigación de Lía: 23 contra CD 12 ✓ Éxito (d20 19 +4 · +2 por la Luz). Lía da con un detalle.'))
            .toBe('Lía prueba con Investigación: saca un 23 (+2 por la Luz), y le hacía falta un 12. Sale bien. Lía da con un detalle.');
        expect(read('🎲 Persuasión de Irene: 9 contra CD 12 ✗ Fallo (d20 7 +2 · desventaja: 7 y 15, no habla su lengua)'))
            .toBe('Irene prueba con Persuasión: saca un 9 (desventaja: 7 y 15, no habla su lengua), y le hacía falta un 12. No sale.');
    });

    test('doors, locks, chests, cases and levels lose their squares, commands and abbreviations', () => {
        expect(read('[BOARD] La puerta de (3, 4) queda abierta: da a la cocina.')).toBe('La puerta queda abierta: da a la cocina.');
        expect(read('🗝️ [BOARD] Irene saca la ganzúa: la cerradura baja de CD 15 a 13.')).not.toMatch(LOG);
        expect(read('🔍 [TABLERO] Irene busca trampas alrededor (Percepción: 14). No hay nada raro.')).toBe('Irene busca trampas alrededor: saca un 14 en Percepción. No hay nada raro.');
        expect(read('🧰 [TABLERO] Irene abre el cofre: 12 de oro y Poción de curación.')).toBe('Irene abre el cofre, y dentro hay 12 monedas de oro y Poción de curación.');
        expect(read('🔎 [CASO] El robo: pasó en Puerto Alba, el día 3. Está en la mesa y en /caso.')).toBe('El robo: pasó en Puerto Alba, el día 3.');
        expect(read('⚖️ [CASO] Aciertan: fue el panadero. (20 de oro)')).toBe('Aciertan: fue el panadero. Os pagan 20 monedas de oro.');
        expect(read('⭐ [NIVEL] Irene sube al nivel 2 · +8 PG · +1 dado(s) de golpe. Mejora: Golpe firme.'))
            .toBe('Irene sube al nivel 2: gana ocho puntos de vida y un dado de golpe. Mejora: Golpe firme.');
    });

    test('guild jobs, save points and the tavern dice lose their brackets, dates and sums', () => {
        expect(read('📄 [GREMIO] Aceptado: [B] El faro apagado — 50 de oro · 3 día(s) · Brunilda'))
            .toBe('Aceptáis el encargo «El faro apagado», de Brunilda. Paga 50 monedas de oro. Quedan tres días de plazo.');
        expect(read('🗺️ [GREMIO] El sitio ya existe: Puerto Alba — La cala del norte.')).toBe('La cala del norte ya está en el mapa, en Puerto Alba.');
        expect(read('📄 [GREMIO] Se paso el plazo: El faro.')).toBe('Se os ha pasado el plazo de «El faro».');
        expect(read('💾 [PARTIDA] Punto de retorno: Antes de la bodega · 2026-10-01 05:30 · automático.')).toBe('Queda guardado un punto de retorno: Antes de la bodega.');
        expect(read('⏪ [PARTIDA] Vuelta a: Antes de la bodega · 2026-10-01 05:30. El mundo también vuelve a como estaba.'))
            .toBe('Volvéis atrás, al punto de retorno «Antes de la bodega». El mundo también vuelve a como estaba.');
        expect(read('🎲 [TABERNA] Irene juega a veintiuno. Tú: 7 + 9 = 16 · La casa: 10 + 8 = 18 · Pierdes 5.'))
            .toBe('Irene juega a veintiuno. Tus dados suman 16; los de la casa, 18. Pierdes cinco monedas de oro.');
        expect(read('🎲 [TABERNA] Irene juega a veintiuno. Tú: 7 + 9 + 8 = 24 · Te pasas: pierdes 5.'))
            .toBe('Irene juega a veintiuno. Tus dados suman 24. Te pasas: pierdes cinco monedas de oro.');
    });
});

describe('noteProse: spells and abilities', () => {
    test('an area spell names its area in feet, and each target\'s save and damage in Spanish', () => {
        const cone = '✨ Ulrich usa Cono de escarcha (cono de 15 ft).\n➤ Guardia:\n🎲 Salvación de Guardia: d20(13) +0 = 13 vs CD 14\n'
            + '💥 Daño cold: 3d6 = 7\n❤️ Estado de Guardia: 92/99\n❄️ Guardia: se queda helado.\n❄️ El agua se hiela.';
        expect(read(cone)).toBe('Ulrich usa Cono de escarcha, que alcanza un cono de 15 pies. Guardia intenta librarse: saca un 13, y le hacía falta un 14. '
            + 'No lo consigue. Le hace 7 de daño de frío. A Guardia le quedan 92 de sus 99 puntos de vida. Guardia se queda helado. El agua se hiela.');
        const fire = '✨ Ulrich usa Frasco de lumbre (radio de 5 ft).\n➤ Guardia:\n🎲 Salvación de Guardia: d20(15) +0 = 15 vs CD 13\n'
            + '💥 Daño fire: 1d6 a la mitad (salva) = 3\n💥 Revienta un barril en (5, 7): 7 de fuego a Guardia, Ulrich.';
        expect(read(fire)).toBe('Ulrich usa Frasco de lumbre, que alcanza un radio de 5 pies. Guardia intenta librarse: saca un 15, y le hacía falta un 13. Lo consigue. '
            + 'Le hace 3 de daño de fuego: la mitad, porque aguanta en parte. Revienta un barril, y la llamarada hace 7 de daño de fuego a Guardia y Ulrich.');
    });

    test('rays, crits, misses and conditions read without «d20(…)», «vs» or English', () => {
        const rays = '✨ Nella usa Proyectil mágico sobre Rata.\n🎲 Ataque: d20(12) +5 = 17 vs CA 13\n💥 Daño Force: 1d4+1 x2 (crítico) = 8\n'
            + '➤ Rayo 2:\n🎲 Ataque: d20(3) +5 = 8 vs CA 13\n❌ Falla.';
        expect(read(rays)).toBe('Nella usa Proyectil mágico sobre Rata. Saca un 17 contra una defensa de 13. ¡Crítico! Le hace 8 de daño de fuerza. '
            + 'El segundo rayo: saca un 8 contra una defensa de 13. Falla.');
        expect(read('🎲 Salvación de Bandido: d20(4) +1 = 5 vs CD 13\n🌀 Bandido queda Charmed (2 ronda(s)).'))
            .toBe('Bandido intenta librarse: saca un 5, y le hacía falta un 13. No lo consigue. Bandido queda encantado durante dos rondas.');
        expect(read('🌀 Bandido aguanta y no queda Frightened.')).toBe('Bandido aguanta y no queda asustado.');
        expect(read('🧠 Nella aguanta la concentración en Bendición: d20(11) +2 = 13 vs CD 10.\n✔️ La mantiene.'))
            .toBe('Nella intenta no perder la concentración en Bendición: saca un 13, y le hacía falta un 10. La mantiene.');
        expect(read('🎲 Nella salva contra Nube apestosa: d20(9) +1 = 10 vs CD 13.')).toBe('Nella intenta librarse de Nube apestosa: saca un 10, y le hacía falta un 13. No se libra.');
        expect(read('👑 [COMBAT] Guardia se acorrala: +2 a la CA, y ya no se mueve de ahí.')).toBe('Guardia se acorrala y se cubre mejor: dos puntos más de defensa, y ya no se mueve de ahí.');
        for (const line of [rays, '🎲 Prueba: d20(9) +3 = 12 vs CD 15: no puede con él.']) {
            expect(read(line)).not.toMatch(/d20\(|\bvs\b|\b(?:fire|cold|force|Charmed|Frightened)\b/u);
        }
        // «X: 3/6.» a media línea, y «✅ … de daño.» no es un objetivo cumplido.
        expect(read('🪶 Rozar: el filo le alcanza igual, 3 de daño. Rata: 3/6.')).toBe('Rozar: el filo le alcanza igual, 3 de daño. A Rata le quedan 3 de sus 6 puntos de vida.');
        expect(read('✅ 6 de daño, sin tu modificador. Rata 2: 0/6.')).toBe('6 de daño, sin tu modificador. Rata 2 se queda sin puntos de vida.');
        expect(read('⚒️ [HERRERÍA] El herrero mejora el arma de Irene: ahora es Espada +1 (30 de oro, Lingote de hierro).'))
            .toBe('El herrero mejora el arma de Irene: ahora es Espada +1, por 30 monedas de oro; se gasta Lingote de hierro.');
        // Sin icono, «Hecho: se …» no es un elemento.
        expect(noteProse('[HILO] Hecho: se abre la puerta del sótano.')).toBe('[HILO] Hecho: se abre la puerta del sótano.');
    });
});

describe('noteProse: notes written for the model, read without one', () => {
    test('orders to the narrator that slip through are dropped', () => {
        expect(read('[HARTO] Gerd está harto de dormir al raso. Que lo diga con sus palabras, en una frase.')).toBe('Gerd está harto de dormir al raso.');
        expect(read('[ENCARGO PERSONAL] Gerd ve cumplido lo suyo: «Vengar a su hermano». Que lo agradezca a su manera, en una o dos frases.'))
            .toBe('Gerd ve cumplido lo suyo: «Vengar a su hermano».');
    });

    test('a hint, the temple, meeting someone and someone joining read as scenes', () => {
        expect(read('[PISTA] El grupo lleva días sin avanzar. Que les llegue esto por boca de alguien del lugar, con naturalidad y sin nombrar reglas: el molinero vio a alguien salir del pozo.'))
            .toMatch(/: «El molinero vio a alguien salir del pozo\.»$/u);
        expect(read('[TEMPLO] En el templo de Vallaki os cosen y os vendan (10 de oro). Las heridas que se curan con tiempo quedan cerradas.'))
            .toBe('En el templo de Vallaki os cosen y os vendan, por diez monedas de oro. Las heridas que se curan con tiempo quedan cerradas.');
        expect(read('[CONOCÉIS A GERD] En la posada. Un mercenario con la nariz rota. Presenta a Gerd con esta escena, en su voz. Que deje claro que trabaja por dinero (40 de oro por adelantado).'))
            .toBe('En la posada conocéis a Gerd. Un mercenario con la nariz rota. Trabaja por dinero: 40 monedas de oro por adelantado.');
        expect(read('[SE UNE AL GRUPO] Gerd, guerrero, viene con vosotros (cobra 40 de oro).')).toBe('Gerd, guerrero, se une al grupo. Cobra 40 monedas de oro.');
        expect(read('[SE UNE AL GRUPO] Nella, viene con vosotros.')).toBe('Nella se une al grupo.');
    });

    test('a word duel reads round by round, without the dice sums', () => {
        const duel = '[DUELO] Una conversación con Brunilda (orgulloso) para que os deje pasar. Así fue:\n'
            + '- Ronda 1: Convencer: 14 contra 12 ✓ — le pesa más (orgulloso). Brunilda: «Eso ya lo veremos.»\n'
            + '- Ronda 2: Intimidar: 8 contra 12 ✗ — y le endurece (orgulloso).\n- Ronda 3: Que hable Gerd — recuperáis aplomo (+1).\nAl final cede a medias, con un precio.';
        expect(read(duel)).toBe('Habláis con Brunilda para que os deje pasar. Primera ronda: convencer, y sale bien; le hace mella. Brunilda responde: «Eso ya lo veremos.» '
            + 'Segunda ronda: intimidar, y no sale; eso le endurece. Tercera ronda: que hable Gerd; recuperáis el aplomo. Al final cede a medias, con un precio.');
    });
});

describe('noteProse keeps what the chronicle and the box need', () => {
    test('the tag stays at the start, so the Diario still files the line', () => {
        for (const note of ['🍲 [POSADA] Comida caliente para todos (1 de oro).', '[DESCANSO] Descanso largo.\nIrene: 34 → 34 PG.', '📋 [COMBAT] Resumen final\nResultado: victoria del grupo.']) {
            expect(readTaggedLine(noteProse(note))?.tag).toBe(readTaggedLine(note)?.tag);
        }
    });

    test('prose is left alone, and a thread note keeps its «Hecho:» line apart', () => {
        expect(noteProse('[VIAJE] Salís de Puerto Alba hacia 1387. Cuatro días de camino.')).toBe('[VIAJE] Salís de Puerto Alba hacia 1387. Cuatro días de camino.');
        const thread = '[HILO] Hecho: El ratero del muelle.\nEl ratero suelta la bolsa.';
        expect(noteProse(thread)).toBe(thread);
        expect(stripEngineTags(noteProse(thread))).toBe('El ratero suelta la bolsa.');
        const trip = 'Un día de camino.\n\nLlegáis a Vane.';
        expect(noteProse(trip)).toBe(trip);
        expect(noteProse('')).toBe('');
    });

    test('telling it twice changes nothing', () => {
        for (const note of ['🛡️ [COMBAT] Turno de Irene (Jugador)', '🍲 [POSADA] Comida caliente para todos (1 de oro).', '[DESCANSO] Descanso corto.\nIrene: 20 → 27 PG, 1 dado de golpe (7).']) {
            const once = noteProse(note, { key: '3' });
            expect(noteProse(once, { key: '3' })).toBe(once);
        }
    });
});

describe('narration-notes: the words', () => {
    test('counts, coins and names in plural', () => {
        expect(goldWords(1)).toBe('una moneda de oro');
        expect(goldWords(12)).toBe('12 monedas de oro');
        expect(pluralName('Rata de bodega')).toBe('ratas de bodega');
        expect(pluralName('Bruja Baroviana')).toBe('Brujas Barovianas');
        expect(countedName('Rata de bodega', 2)).toBe('dos ratas de bodega');
        expect(countedName('Ratero del muelle', 1)).toBe('Ratero del muelle');
    });

    test('a list says «e» before «i»', () => {
        expect(listWords(['Gerd', 'Irene'])).toBe('Gerd e Irene');
        expect(listWords(['Gerd', 'Nella', 'Hilda'])).toBe('Gerd, Nella y Hilda');
        expect(listWords(['Irene'])).toBe('Irene');
    });

    test('meal, needs, a roll and a suceso', () => {
        expect(mealProse(0, 'x')).not.toMatch(/\d/);
        expect(needsProse(['Irene empieza a acusar sed.', 'Gerd empieza a acusar sed.'])).toBe('Irene y Gerd empiezan a tener sed.');
        expect(rollProse('🎲 Perspicacia de Irene: 14 contra CD 13 ✓ Éxito (d20 12 +2)')).toBe('Irene prueba con Perspicacia: saca un 14, y le hacía falta un 13. Sale bien.');
        expect(sucesoProse({ then: 'Comen allí mismo', effects: ['−2 de oro', 'Irene −3 de vida'] })).toBe('Comen allí mismo. Pagáis dos monedas de oro. Irene pierde tres puntos de vida.');
    });
});

describe('the rest phrases know where you sleep', () => {
    const rows = JSON.parse(readFileSync(new URL('../public/compendio/frases.json', import.meta.url), 'utf8')).rows;
    const told = (/** @type {string} */ under) => rows.filter((/** @type {any} */ r) => r.kind === 'descanso' && matches(r, { kind: 'descanso', largo: 'sí', bajo: under }));

    test('under a roof (the inn, the guild) there are no watches, embers, dew or leaves on the blankets', () => {
        const inside = told('techo').map((/** @type {any} */ r) => r.text).join(' ');
        expect(told('techo').length).toBeGreaterThan(5);
        expect(inside).not.toMatch(/guardias por turnos|brasas|rocío|hojas secas|llena de estrellas|para no helaros/u);
    });

    test('in the open, the camp phrases are still there', () => {
        expect(told('cielo').some((/** @type {any} */ r) => /guardias por turnos/u.test(r.text))).toBe(true);
    });

    // A solas (el prólogo, la prueba de la bodega) no hay «unos a otros» ni guardias por turnos.
    test('alone, no phrase needs several people, and every moment still has something to say', () => {
        const GROUP = /unos a otros|unas a otras|por turnos|turnándoos|quién sigue en pie|uno tras otro|cada uno|cada una|Alguien ronca|Nadie tiene ganas/u;
        const alone = rows.filter((/** @type {any} */ r) => matches(r, { solo: 'sí' }) && /^(?:viaje|tablero|fin-combate|descanso)$/u.test(r.kind));
        expect(alone.filter((/** @type {any} */ r) => GROUP.test(r.text)).map((/** @type {any} */ r) => r.id)).toEqual([]);
        for (const [kind, when] of /** @type {Array<[string, any]>} */ ([
            ['fin-combate', { ganado: 'sí' }], ['fin-combate', { ganado: 'no' }], ['fin-combate', { ganado: 'huida' }],
            ['descanso', { largo: 'sí', bajo: 'cielo' }], ['descanso', { largo: 'no' }], ['tablero', {}], ['viaje', { dias: 1 }], ['viaje', { dias: 3 }],
        ])) {
            expect(rows.filter((/** @type {any} */ r) => r.kind === kind && matches(r, { solo: 'sí', ...when })).length).toBeGreaterThan(3);
        }
        // Con compañía, siguen saliendo.
        expect(rows.some((/** @type {any} */ r) => r.id === 'fin-combate-gana-todos' && matches(r, { solo: 'no', ganado: 'sí' }))).toBe(true);
    });
});
