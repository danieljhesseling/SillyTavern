---
title: Por Hacer — Estado Real y Pendientes
tags: [todo, pendientes, estado, roadmap, deuda]
created: 2026-09-20
updated: 2026-09-21
author: DanielJHesseling / Claude Opus 5
---

# 📋 Por Hacer

Lista viva de lo que falta, ordenada por lo que desbloquea. El plan y el porqué están en [[ROADMAP]]; esto es solo el marcador.

> [!IMPORTANT]
> **El patrón a vigilar**: hay mucho motor construido y testeado, y menos motor **conectado**. Las tareas marcadas 🖥️ son las que convierten trabajo hecho en trabajo jugable, y un módulo que solo ejecutan los tests no cuenta como hecho. Ahora hay una orden que lo comprueba en vez de suponerlo:
>
> ```bash
> node tools/check-engine-wiring.mjs   # 19 módulos, 14 conectados, 5 sin cargar (1.383 líneas)
> ```
>
> **Y una advertencia sobre el coste**: el combate nunca gastó tokens — los mensajes de sistema se filtran del prompt. Las Fases A y B entregan jugabilidad, no ahorro. Dónde está el gasto real sigue **sin medir**; ver [[ROADMAP]] §1.

---

## 🔴 Prioridad alta — lo que desbloquea el resto

| # | Tarea | Por qué ahora |
| :--- | :--- | :--- |
| 1 | 🖥️ **Generar el mundo con IA desde el asistente** (Fase F) | El asistente ya funciona con plantillas, sin clave y sin gastar nada. Falta el botón *Generar con IA* en el paso 1, que produzca **la misma estructura** que las plantillas y la valide igual. Una llamada por mundo. El camino de entrada no debe depender de que el proveedor responda. |
| 2 | **Medir el gasto real** (T3 + T4) | Vista previa del prompt compilado y contador reconciliado. **Nadie sabe todavía de dónde sale la factura**, y una suposición razonable ya resultó estar equivocada una vez. Antes de construir nada: probar `claude.cachingAtDepth` (solo si usas Claude) y la extensión *Summarize*. Vienen con upstream y cuestan configuración, no código. |
| 3 | 🖥️ **Editor visual de reglas** (C3) | El paquete de reglas ya es data y se valida, pero para editarlo hoy hay que escribir JSON a mano. Es exactamente el requisito que pediste. Va de la mano del #4: sin cargar el paquete de la campaña, lo que edites no se usa. |
| 4 | **Cargar el paquete de reglas de la campaña** al abrir un chat, con aviso si el paquete falla. Hoy `setActiveRuleset` existe y **nada lo llama**: el juego siempre usa el paquete por defecto. `dnd-system.js` fija sus exports al cargar, así que cambiar de paquete exige recargar. | C1/C4 |

---

## 🟠 Prioridad media — completan las fases abiertas

| # | Tarea | Fase |
| :--- | :--- | :--- |
| 5 | **Botín algorítmico por CR**, con tablas leídas del paquete de reglas | B5 |
| 6 | 🖥️ **Rastreador de iniciativa en pantalla**, marcadores de estado sobre tokens, escalado por tamaño D&D | B8 |
| 7 | **Decidir el destino de la máquina de turnos**: conectarla a `party.js` o retirarla. Hoy hay dos implementaciones de los turnos y solo una la usa el juego. Conectarla da economía de acciones real; retirarla evita mantener 308 líneas y 40 tests de algo sin uso. **Es una decisión, no una tarea** | B1/B3 |
| 8 | **Importar / exportar paquetes de reglas** desde la interfaz (`toPortablePack` ya está) | C5 |
| 9 | 🖥️ **Interfaz de calendario y vínculos** (lógica lista con 62 tests) | D6 |
| 10 | 🖥️ **Interfaz de escenarios y tablero de campaña** (lógica lista) | E5 |
| 11 | **Descanso corto y largo** con dados de golpe | D5 |
| 12 | **Aplicar las perks de vínculo en el combate.** `bonds.js` decide cuándo se desbloquean, pero nada en `party.js` las aplica | D3 |
| 13 | **Reglas de encuentro editables desde la interfaz.** El asistente ya las escribe (1–2 enemigos por plantilla); cambiarlas exige World Info | B/C |
| 14 | **Cobertura por línea de tiro, no por casilla.** Hoy cuenta la cobertura de la celda del objetivo, que es la simplificación que `getCoverBonus` documenta. D&D 5e la calcula sobre la línea entre atacante y objetivo | A/B |

---

## 🟡 Deuda conocida

| # | Tema | Detalle |
| :--- | :--- | :--- |
| 15 | **`npm audit`: 47 vulnerabilidades** (1 crítica) | En el árbol de dependencias tras el merge. Merece una revisión aparte. |
| 16 | **`party.js` vuelve a crecer** | 4.810 líneas: la integración del motor se hizo dentro. Extraer lo nuevo a `party/` por la costura que cubren los tests, antes de que vuelva a ser un monolito. |
| 17 | **`party/html.js` duplica `escapeHtml`** | A propósito y con un test que ancla el contrato, porque importar `utils.js` arrastra código que exige `window`. Si algún día `utils.js` expone un módulo hoja, esto se elimina. |
| 18 | **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge. |
| 19 | **`MAINT-03`: el motor RPG sigue sin cobertura completa** | 983 tests, pero `dynamic-context-manager.js` (1.911 líneas), `campaigns.js` (905) y `world-content-browser.js` siguen a cero. |
| 20 | **SEC-01, SEC-04 y SEC-05 sin tocar** | CSP desactivada, claves de API en texto plano y jQuery 3.5.1. Viven en código de upstream y arreglarlas cuesta merge. En uso local monousuario el riesgo es menor; si algún día expones el servidor (`npm run start:global`) pasan a ser prioritarias. Estado detallado en [[PROBLEMAS_TECNICOS]]. |
| 21 | **Las plantillas del asistente son código** | Están en `starter-templates.js`. Añadir una hoy exige editar JavaScript, justo lo que el editor debe evitar (`N-12`). |
| 22 | **El registro de combate no sobrevive a una recarga** | Es estado de sesión a propósito: guardar 300 entradas en el world info abultaría la campaña para algo que nadie relee. Las líneas siguen en el chat. Si alguna vez molesta, el sitio es el encuentro, no el mundo. |
| 23 | **El guardián de tiradas solo mira afirmaciones estructuradas** | `1d20+5 = 23` sí; «saca un 18» no. Reescribir prosa exige entender la frase, y equivocarse es peor que no tocarla. El prompt debe pedir la forma estructurada. |
| 24 | **El e2e no cubre los vínculos ni los escenarios** | Porque no están conectados. Cuando lo estén, el recorrido debería crecer con ellos. |

---

## 🔵 Transversales de coste — aún sin empezar

Ninguna de estas está hecha, y son las que evitan que el gasto **crezca con la duración de la campaña**.

| # | Tarea | Palanca |
| :--- | :--- | :--- |
| 25 | **Caché de prompt**: estático delante, volátil detrás. Probar antes `claude.cachingAtDepth` (ya en upstream, desactivado por defecto) | T1 — la palanca #2 de coste |
| 26 | **Enrutado por tarea**: modelo barato o local para lo mecánico | T2 |
| 27 | **Vista previa del prompt compilado** con color por origen | T3 |
| 28 | **Reconciliar el contador de tokens** con el del proveedor, y mostrar el gasto por sesión | T4 / N-03 |
| 29 | **Snapshot del prompt compilado en CI** | T5 / N-02 |
| 30 | **Repetición determinista de turno** (mismo contexto, misma semilla) | T6 / N-05 |
| 31 | **Registro de contradicciones** narración vs estado | T7 / N-06 |
| 32 | **Resumen periódico del historial** cada N turnos. Evaluar antes la extensión *Summarize*, que ya trae upstream | T8 |

> [!WARNING]
> **El 25 y el 32 son los que impiden que la partida 200 cueste mucho más que la partida 1** aunque hagas lo mismo, porque el historial arrastra. Sin ellos, el coste crece con la duración de la campaña aunque el combate sea gratis.

---

## ⬜ Fases sin abrir

- **Fase F — Lienzo blanco**: generación de contenido validada contra el esquema de la Fase C, agnóstica de proveedor. El primer paso es el #1.

---

## 🧪 Probarlo a mano (dos minutos)

1. `npm start` y abre <http://localhost:8000>. Si el servidor llevaba abierto desde antes de los últimos cambios, reinícialo y recarga con `Ctrl+F5`.
2. En la bienvenida, **Nueva campaña** → *Mazmorra clásica* → un nombre → `Lyra` y `Brand` → **Crear campaña**. Debes acabar en *Sala de entrada* (*Cripta olvidada*) con dos fichas.
3. **Haz clic en la puerta** (la casilla marrón del muro central): se abre y queda dibujada con trazo discontinuo.
4. Escribe `/fight Esqueleto 1`. Aparece el **registro de combate** bajo el tablero, con el desglose de cada tirada.
5. Escribe `/combat-stop` para abandonar el combate. En el chat aparece un mensaje de **narrador** con el resumen: ese es el único que lee el modelo.
6. Bajo el tablero, **Terreno**: pinta unos muros y recarga la página; siguen ahí.
7. `/sandbox` abre el banco de pruebas de combate, sin tocar tu campaña.
8. Cierra el chat: la campaña sale en la bienvenida con **Continue**. Un mundo que existe pero nunca se jugó sale con **Iniciar**.

Y sin tocar nada, el recorrido completo en un navegador de verdad:

```bash
node tools/e2e-campaign.mjs            # servidor y datos propios; no toca los tuyos
node tools/e2e-campaign.mjs --headed   # para verlo
```

Lo que **no** se puede probar todavía: la carga de reglas por campaña (#4) y todo lo de calendario, vínculos y escenarios (#9, #10, #12).

---

## ✅ Hecho, para no rehacerlo

### Cerrado el 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| **El epílogo de combate llega al modelo** | Se publica como mensaje de **narrador**, no de sistema. El nuevo `game-engine/ui/chat-channel.js` obliga a nombrar el público (`CHANNEL.PLAYER` o `CHANNEL.MODEL`) y deriva de ahí el `is_system`, con tests que comprueban lo que importa — si el modelo lo lee — en vez de la bandera. Verificado en navegador: `is_system=false`. No dispara ninguna llamada: entra en el prompt de tu siguiente mensaje |
| **La cobertura cuenta en el ataque** | `getCoverBonus` se aplica a la CA del objetivo en los dos puntos de ataque, y el registro dice *«incluye +2 por cobertura media»*. Un tablero sin terreno se comporta igual que antes |
| **El guardián de tiradas está conectado** | Corre sobre cada mensaje del modelo. Por defecto solo corrige lo **imposible** (un `1d20+5` no puede dar 30), porque esa corrección nunca es opinable; `/rollguard estricto` hace que el motor tire por todas, y `/rollguard off` lo desactiva. Cada corrección se anuncia |
| **Las puertas se abren con un clic** | En el tablero real. Se redibuja la niebla al abrirlas, y queda anotado en el registro |
| **El registro de combate está en el tablero real** | Ya no solo en `/sandbox`. Se alimenta de las líneas de combate y del desglose de cada tirada |
| **Se puede abandonar un combate** | `/combat-stop`. Antes solo se salía ganando o muriendo, y el epílogo era inalcanzable sin cadáveres. El resumen distingue abandono de derrota |
| **El asistente crea campañas con combate** | Las plantillas escribían `encounterRules: []`, así que `/fight` contestaba *«enemigo no encontrado»* en toda campaña recién creada. Las reglas se escriben ahora al conocer el id de cada monstruo |
| **El recorrido en navegador está en el repositorio** | `tools/e2e-campaign.mjs` levanta su propio servidor con datos temporales, recorre el juego y limpia. 17 comprobaciones |
| **Hay un detector de módulos sin conectar** | `tools/check-engine-wiring.mjs`. Convierte «hecho y probado» en algo que se comprueba |
| **Código muerto y ESLint** | `nextTurn` eliminada (nadie la llamaba); `rollDice` dejó de estar muerta al usarla el guardián. Los 22 errores de ESLint preexistentes están a **cero** |
| **`Mapa-Codigo-Archivos` al día** | Ya recoge `game-engine/`, `party/` y `tools/`, con qué está conectado y qué no |

### De antes

| Área | Estado |
| :--- | :--- |
| Higiene del fork | Remote `upstream` sin push · 194 commits integrados · formateo desactivado en archivos de upstream · regla escrita |
| Red de seguridad | Gate de tipos acotado al fork · CI propio en `push` (`fork-checks.yml`) · sin `@ts-nocheck` |
| Seguridad | XSS del renderizador (4 puntos, y uno más en la cabecera del tablero) · XSS vivo en `world-content-browser.js` · 11 copias de `escapeHtml` unificadas · límites Unicode · doble persistencia del grupo |
| Motor de tablero | Terreno, línea de visión (simétrica), niebla de 3 estados, A* · 104 tests · **conectado** |
| Motor de combate | Perfiles tácticos, guardián de tiradas, máquina de turnos · 99 tests · conectados los perfiles y el guardián; la máquina no (#7) |
| Interfaz | Capas de terreno y niebla, paleta de pintura, registro de combate con marco pixel art, puertas, banco de pruebas `/sandbox` |
| Onboarding | Botón **Nueva campaña** y asistente de 3 pasos con 4 plantillas. Crea el mundo, el chat vinculado, el grupo con posiciones, las reglas de encuentro, y te deja en el primer tablero. Propone siempre un nombre libre. Los mundos jugables **sin chat** aparecen como tarjeta con **Iniciar** |
| Contenido como datos | 25 tablas fuera del código, validación, migración, exportación diferencial · 36 tests · el juego lee el paquete por defecto (#4 pendiente) |
| Bucle de campaña | Calendario, vínculos 1-10, perks, objetivos de escenario, salas y puertas, tablero de campaña · 62 tests · **sin conectar** (#9, #10, #12) |

**Verificación** (medida el 2026-09-21):

```bash
npm run test:unit --prefix tests     # 983 tests, 38 suites
node tools/check-fork-types.mjs      # 0 errores en 33 archivos del fork
node tools/check-engine-wiring.mjs   # 14 de 19 módulos conectados
node tools/e2e-campaign.mjs          # 17 comprobaciones en un navegador real
ESLINT_USE_FLAT_CONFIG=false npx eslint public/scripts/game-engine public/scripts/party public/scripts/party.js public/scripts/campaigns.js public/scripts/world-map-renderer.js
```

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[PROBLEMAS_TECNICOS]]: auditoría original, con el estado de cada hallazgo.
- [[PROPUESTAS_MEJORA]]: catálogo de 200 con el estado de cada propuesta.
- [[Mapa-Codigo-Archivos]]: qué archivo hace qué, y cuál está conectado.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
