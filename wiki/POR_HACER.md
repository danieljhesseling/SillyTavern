---
title: Por Hacer — Estado Real y Pendientes
tags: [todo, pendientes, estado, roadmap, deuda]
created: 2026-09-20
author: DanielJHesseling / Claude Opus 5
---

# 📋 Por Hacer

Lista viva de lo que falta, ordenada por lo que desbloquea. El plan y el porqué están en [[ROADMAP]]; esto es solo el marcador.

> [!IMPORTANT]
> **El patrón a vigilar**: hay mucho motor construido y testeado, y menos interfaz conectada. Las tareas marcadas 🖥️ son las que convierten trabajo hecho en trabajo jugable.
>
> **Y una advertencia sobre el coste**: el combate nunca gastó tokens — los mensajes de sistema se filtran del prompt. Las Fases A y B entregan jugabilidad, no ahorro. Dónde está el gasto real sigue **sin medir**; ver [[ROADMAP]] §1.

---

## 🔴 Prioridad alta — convierten lo hecho en jugable

| # | Tarea | Por qué ahora |
| :--- | :--- | :--- |
| 1 | 🖥️ **Generar el mundo con IA desde el asistente** (Fase F) | El asistente de campaña ya funciona con plantillas, sin clave y sin gastar nada. Falta el botón *"Generar con IA"* dentro del mismo paso 1, que produzca **la misma estructura** que las plantillas y la valide igual. El camino de entrada no debe depender de que el proveedor responda. |
| 2 | 🖥️ **Montar el registro de combate en el tablero real** | Hoy solo vive en `/sandbox`. El módulo y el marco están hechos y comprobados; falta añadirlo al panel del tablero. |
| 3 | **Medir el gasto real** (T3 + T4) | Vista previa del prompt compilado y contador reconciliado. **Nadie sabe todavía de dónde sale la factura**, y una suposición razonable ya resultó estar equivocada una vez. |
| 4 | **Cobertura en el cálculo de ataque** | `getCoverBonus` existe y nadie lo consulta, así que las casillas de cobertura son decorativas. |
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
| 11b | **La verificación de extremo a extremo no está en el repositorio** | Se hizo con Playwright + Edge sobre un servidor y datos aislados (dos guiones: instalación limpia, y el mundo huérfano sembrado). Es lo único que cazó los fallos del asistente, que los tests unitarios no veían; conviene dejarlo como herramienta que levante su propio servidor. |
| 12 | **Código muerto** | `rollDice` y `nextTurn` están definidas y no se llaman desde ningún punto del proyecto. |
| 13 | **`npm audit`: 47 vulnerabilidades** (1 crítica) | En el árbol de dependencias tras el merge. Merece una revisión aparte. |
| 14 | **15 errores de ESLint preexistentes en `party.js`** | Comillas, comas finales, indentación, variables sin usar. Ninguno introducido por el trabajo reciente. |
| 15 | **`party/html.js` duplica `escapeHtml`** | A propósito y con un test que ancla el contrato, porque importar `utils.js` arrastra código que exige `window`. Si algún día `utils.js` expone un módulo hoja, esto se elimina. |
| 16 | **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge. |
| 17 | **`MAINT-03`: el motor RPG sigue sin cobertura completa** | 953 tests, pero `dynamic-context-manager.js`, `campaigns.js` y `world-content-browser.js` siguen a cero. |

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
| Interfaz | Capas de terreno y niebla, paleta de pintura, registro de combate con marco pixel art, banco de pruebas `/sandbox` |
| Onboarding | Botón **Nueva campaña** en la bienvenida y asistente de 3 pasos con 4 plantillas (mazmorra, bosque, taberna, vacío). Crea el mundo, el chat vinculado, el grupo con posiciones y te deja en el primer tablero con el panel abierto. Propone siempre un nombre libre. Los mundos jugables **sin chat** aparecen como tarjeta con **Iniciar**, para que World Info y Campaigns no discrepen. **Verificado de extremo a extremo** en una instalación limpia y con una copia del mundo huérfano real |
| Combate integrado | IA táctica con A* en el combate real, rondas contadas, alcance por criatura, resumen al terminar |
| Contenido como datos | 25 tablas fuera del código, validación, migración, exportación diferencial · 36 tests |
| Bucle de campaña | Calendario, vínculos 1-10 por eventos registrados, perks, objetivos de escenario, salas y puertas, tablero de campaña · 62 tests |

**Verificación**: `953 tests en 37 suites` · `0 errores de tipos en 32 archivos del fork`

```bash
npm run test:unit --prefix tests
node tools/check-fork-types.mjs
```

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[PROBLEMAS_TECNICOS]]: auditoría original.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
