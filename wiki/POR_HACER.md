---
title: Por Hacer — Estado Real y Pendientes
tags: [todo, pendientes, estado, roadmap, deuda]
created: 2026-09-20
author: DanielJHesseling / Claude Opus 5
---

# 📋 Por Hacer

Lista viva de lo que falta, ordenada por lo que desbloquea. El plan y el porqué están en [[ROADMAP]]; esto es solo el marcador.

> [!IMPORTANT]
> **El patrón a vigilar**: hay mucho motor construido y testeado, y menos interfaz conectada. Un motor sin pantalla no ahorra un euro ni se puede jugar. Las tareas marcadas 🖥️ son las que convierten trabajo hecho en trabajo útil.

---

## 🔴 Prioridad alta — convierten lo hecho en jugable

| # | Tarea | Por qué ahora |
| :--- | :--- | :--- |
| 1 | 🖥️ **Abrir la app y mirar el tablero y el log** | Nada de la interfaz de A6/B4 se ha visto en un navegador. Está verificado a nivel de módulos, tipos, lint y que el servidor sirve cada archivo, pero nadie ha visto los píxeles colocados. El `border-image` con arte recortado es justo lo que puede necesitar un ajuste de 2px. |
| 2 | 🖥️ **Enganchar `buildEpiloguePrompt` al final del combate** (B6) | Está escrito y testeado pero no conectado. **Hasta que lo esté, el ahorro de tokens es potencial, no real.** Es la tarea con mejor relación valor/esfuerzo de toda la lista. |
| 3 | **Conectar `planEnemyTurn` a `resolveEnemyTurnAction`** | La IA táctica nueva existe con 33 tests, pero el combate sigue usando la vieja, la que se mueve en línea recta atravesando muros. |
| 4 | **Conectar la máquina de turnos nueva** a `party.js` | Igual: `turn-machine.js` tiene 40 tests y cuenta rondas; `party.js` sigue con su versión sin contador de rondas. |
| 5 | 🖥️ **Editor visual de reglas** (C3) | El paquete de reglas ya es data y se valida, pero para editarlo hoy hay que escribir JSON a mano. Es exactamente el requisito que pediste. |

---

## 🟠 Prioridad media — completan las fases abiertas

| # | Tarea | Fase |
| :--- | :--- | :--- |
| 6 | **Botín algorítmico por CR**, con tablas leídas del paquete de reglas | B5 |
| 7 | 🖥️ **Rastreador de iniciativa en pantalla**, marcadores de estado sobre tokens, escalado por tamaño D&D | B8 |
| 8 | **Importar / exportar paquetes de reglas** desde la interfaz (`toPortablePack` ya está) | C5 |
| 8b | 🖥️ **Interfaz de calendario y vínculos** (lógica lista con 62 tests) | D6 |
| 8c | 🖥️ **Interfaz de escenarios y tablero de campaña** (lógica lista) | E5 |
| 8d | **Descanso corto y largo** con dados de golpe | D5 |
| 9 | **Cargar el paquete de reglas de la campaña** al abrir un chat, con aviso si el paquete falla | C1/C4 |
| 10 | **Cobertura en el cálculo de ataque**: `getCoverBonus` existe y nadie lo consulta | A/B |
| 11 | **Puertas abribles desde el tablero** (clic para abrir/cerrar; `setDoorOpen` ya está) | A6 |

---

## 🟡 Deuda conocida

| # | Tema | Detalle |
| :--- | :--- | :--- |
| 12 | **Código muerto** | `rollDice` y `nextTurn` están definidas y no se llaman desde ningún punto del proyecto. |
| 13 | **`npm audit`: 47 vulnerabilidades** (1 crítica) | En el árbol de dependencias tras el merge. Merece una revisión aparte. |
| 14 | **15 errores de ESLint preexistentes en `party.js`** | Comillas, comas finales, indentación, variables sin usar. Ninguno introducido por el trabajo reciente. |
| 15 | **`party/html.js` duplica `escapeHtml`** | A propósito y con un test que ancla el contrato, porque importar `utils.js` arrastra código que exige `window`. Si algún día `utils.js` expone un módulo hoja, esto se elimina. |
| 16 | **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge. |
| 17 | **`MAINT-03`: el motor RPG sigue sin cobertura completa** | 856 tests, pero `dynamic-context-manager.js`, `campaigns.js` y `world-content-browser.js` siguen a cero. |

---

## 🔵 Transversales de coste — aún sin empezar

Ninguna de estas está hecha, y son las que evitan que el gasto **crezca con la duración de la campaña**.

| # | Tarea | Palanca |
| :--- | :--- | :--- |
| 18 | **Caché de prompt**: estático delante, volátil detrás | T1 — la palanca #2 de coste |
| 19 | **Enrutado por tarea**: modelo barato o local para lo mecánico | T2 |
| 20 | **Vista previa del prompt compilado** con color por origen | T3 |
| 21 | **Reconciliar el contador de tokens** con el del proveedor, y mostrar el gasto por sesión | T4 / N-03 |
| 22 | **Snapshot del prompt compilado en CI** | T5 / N-02 |
| 23 | **Repetición determinista de turno** (mismo contexto, misma semilla) | T6 / N-05 |
| 24 | **Registro de contradicciones** narración vs estado | T7 / N-06 |
| 25 | **Resumen periódico del historial** cada N turnos | T8 |

> [!WARNING]
> **El 18 y el 25 son los que impiden que la partida 200 cueste mucho más que la partida 1** aunque hagas lo mismo, porque el historial arrastra. Sin ellos, el ahorro del combate se lo come el crecimiento del contexto.

---

## ⬜ Fases sin abrir

- **Fase F — Lienzo blanco**: generación de contenido validada contra el esquema de la Fase C, agnóstica de proveedor.

---

## ✅ Hecho, para no rehacerlo

| Área | Estado |
| :--- | :--- |
| Higiene del fork | Remote `upstream` sin push · 194 commits integrados · formateo desactivado en archivos de upstream · regla escrita |
| Red de seguridad | Gate de tipos acotado al fork · CI propio en `push` · sin `@ts-nocheck` |
| Seguridad | XSS del renderizador (4 puntos) · XSS vivo en `world-content-browser.js` · 11 copias de `escapeHtml` unificadas · límites Unicode · doble persistencia del grupo |
| Motor de tablero | Terreno, línea de visión (simétrica), niebla de 3 estados, A* · 104 tests |
| Motor de combate | Máquina de turnos con rondas, 4 perfiles tácticos, guardián de tiradas · 99 tests |
| Interfaz | Capas de terreno y niebla, paleta de pintura, registro de combate con marco pixel art |
| Contenido como datos | 25 tablas fuera del código, validación, migración, exportación diferencial · 36 tests |
| Bucle de campaña | Calendario, vínculos 1-10 por eventos registrados, perks, objetivos de escenario, salas y puertas, tablero de campaña · 62 tests |

**Verificación**: `856 tests en 32 suites` · `0 errores de tipos en 27 archivos del fork`

```bash
npm run test:unit --prefix tests
node tools/check-fork-types.mjs
```

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[PROBLEMAS_TECNICOS]]: auditoría original.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
