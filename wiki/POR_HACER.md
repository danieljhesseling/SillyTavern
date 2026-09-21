---
title: Por Hacer — Estado Real y Pendientes
tags: [todo, pendientes, estado, roadmap, deuda]
created: 2026-09-20
updated: 2026-09-21
author: DanielJHesseling / Claude Opus 5
---

# 📋 Por Hacer

Lo que falta, dividido por **quién tiene que actuar**:

| Bloque | Qué es | Quién decide |
| :--- | :--- | :--- |
| **[A](#-a--se-puede-hacer-sin-preguntar)** | Trabajo con el camino claro: qué hay que construir ya está decidido | Nadie. Se hace |
| **[D](#-d--necesita-una-decisión)** | Cruces de camino: hay dos salidas razonables y elegir mal cuesta | **Tú** |
| **[P](#-p--propuestas)** | Ideas que no están en ningún plan todavía | **Tú**, si alguna te convence |

El plan y el porqué están en [[ROADMAP]]; esto es el marcador.

> [!IMPORTANT]
> **El patrón a vigilar**: hay mucho motor construido y testeado, y menos motor **conectado**. Las tareas marcadas 🖥️ son las que convierten trabajo hecho en trabajo jugable, y un módulo que solo ejecutan los tests no cuenta como hecho. Hay una orden que lo comprueba en vez de suponerlo:
>
> ```bash
> node tools/check-engine-wiring.mjs   # 24 módulos, 19 conectados, 5 sin cargar (1.383 líneas)
> ```

---

## 🟢 A — Se puede hacer sin preguntar

Ordenado por lo que desbloquea. Cada una tiene el camino decidido: si aparece una bifurcación de verdad, sube al bloque D en vez de resolverse por mi cuenta.

| ID | Tarea | Qué entrega | Fase |
| :--- | :--- | :--- | :--- |
| **A1** | 🖥️ **Rastreador de iniciativa y marcadores de estado** | Un combate que se lee sin contar de memoria: quién va, en qué ronda, y qué le pasa a cada ficha. El registro y las tiradas ya están | B8 |
| **A2** | **Botín algorítmico por CR** | Cierra el bucle del combate: hoy ganar no da nada. Las tablas salen del paquete de reglas, así que se editan desde `/rules` | B5 |
| **A3** | 🖥️ **Interfaz de calendario y vínculos** | Lo que hace que esto sea un juego Persona y no solo táctico. La lógica es la mejor probada del proyecto (62 tests) y nadie puede tocarla | D6 |
| **A4** | 🖥️ **Interfaz de escenarios y tablero de campaña** | Misiones con objetivos y localizaciones que se desbloquean. Misma situación: lógica lista, sin puerta de entrada | E5 |
| **A5** | **Aplicar las perks de vínculo en el combate** | `bonds.js` decide cuándo se desbloquean; nada en `party.js` las aplica, así que son decorativas | D3 |
| **A6** | **Descanso corto y largo** con dados de golpe | El otro lado del calendario: sin descansos, los recursos no significan nada | D5 |
| **A7** | **Reglas de encuentro editables** | El asistente ya las escribe; cambiarlas exige ir a World Info a mano | B/C |
| **A8** | **Editar y comparar lo generado con IA** | Retocar el mapa en la previsualización y volver a una generación anterior sin cerrar el asistente | F |
| **A9** | **Cobertura por línea de tiro** | Hoy cuenta la casilla del objetivo, que es una simplificación declarada. El punto donde arreglarlo ya está aislado en `getTargetArmorClass` | A/B |
| **A10** | **Avisar de lo que un cambio de reglas rompería** | Quitar un tipo de daño que un objeto usa deja ese objeto con una referencia muerta, y hoy se guarda sin protestar | C3 |
| **A11** | **Sacar el pegamento de `party.js`** | 4.954 líneas: la lógica vive fuera, en módulos probados, pero cada enganche nuevo se acumula aquí | — |
| **A12** | **Registro de contradicciones** narración contra estado | Tras cada turno, comparar lo que el modelo contó con lo que el motor sabe. Da datos sobre dónde fallan los prompts en vez de intuiciones | T7 · N-06 |
| **A13** | **Snapshot del prompt compilado en CI** | Que un cambio que altere el prompt en silencio haga fallar la build. Ahora es posible: `/prompt` ya sabe descomponerlo | T5 · N-02 |
| **A14** | **Repetición determinista de turno** | Reejecutar con el mismo contexto y semilla, para saber si un cambio de prompt mejoró algo en vez de suponerlo | T6 · N-05 |
| **A15** | **Ampliar el recorrido de navegador** a vínculos y escenarios | Hoy no los cubre porque no están conectados. En cuanto A3 y A4 estén, debe crecer con ellos | — |

---

## 🟠 D — Necesita una decisión

Cada una es una bifurcación real: las dos salidas son defendibles y la elección cuesta después. Llevan mi recomendación, pero la decisión no es mía.

### D1 · La máquina de turnos: conectarla o retirarla

Hay **dos implementaciones de los turnos**. El combate real cuenta rondas con su propio código en `party.js`; `combat/turn-machine.js` (308 líneas, 40 tests) hace lo mismo mejor y no la usa nadie.

| Opción | A favor | En contra |
| :--- | :--- | :--- |
| **Conectarla** | Economía de acciones de verdad: acción, adicional, reacción, movimiento. Es lo que hace falta para las perks (A5) y para los conjuros | Cirugía en el corazón del combate, que hoy funciona |
| **Retirarla** | 308 líneas y 40 tests menos que mantener | Se tira trabajo probado, y la economía de acciones habría que rehacerla |

**Recomiendo conectarla**, y hacerlo *antes* que A5: las perks de vínculo son reacciones y ataques adicionales, así que sin economía de acciones habría que inventarse dónde colgarlas y luego rehacerlo.

### D2 · Caché de prompt: probar la de upstream o construir la nuestra

Upstream trae `claude.cachingAtDepth` (desactivado por defecto), que solo sirve para Claude y OpenRouter-Claude. Lo nuestro sería reordenar el prompt para que lo estable vaya delante, lo cual vale para cualquier proveedor con caché.

**Recomiendo probar primero la de upstream** si usas Claude: es configuración, no código. Pero **necesito saber qué proveedor usas**, porque la respuesta cambia según eso.

### D3 · Resumen del historial: la extensión de upstream o una propia

*Summarize* (`extensions/memory`) ya viene con SillyTavern y resume cada N mensajes. Lo nuestro podría resumir sabiendo qué es estado del juego y qué es narración, y no tocar lo primero.

**Recomiendo evaluar la de upstream antes de escribir nada**: si sirve, es gratis, y esto solo importa cuando una campaña se alargue.

### D4 · Los tres agujeros de seguridad de upstream

CSP desactivada, claves de API en texto plano y jQuery 3.5.1 con CVEs. Los tres viven en código de upstream, así que arreglarlos cuesta en cada merge, para siempre.

**Recomiendo dejarlos** mientras juegues en local. Si algún día abres el servidor a la red (`npm run start:global`), pasan a ser lo primero. **Dímelo si eso va a pasar.**

### D5 · `npm audit`: 47 vulnerabilidades, una crítica

Están en el árbol de dependencias tras el merge. Actualizarlas puede romper cosas de upstream que no controlamos.

**Recomiendo mirar solo la crítica** y dejar el resto hasta el próximo merge con upstream, que probablemente las arrastre.

### D6 · Reconciliar los tokens con el proveedor

`/prompt` mide lo que la aplicación envía, no lo que factura la API, porque SillyTavern no devuelve el `usage` a la página. Conseguirlo exige interceptar las respuestas (y con streaming llegan troceadas), que es meter mano en terreno de upstream.

**Recomiendo no hacerlo.** Para decidir qué recortar basta con comparar turnos entre sí, y eso ya funciona.

### D7 · ¿El registro de combate debe sobrevivir a una recarga?

Hoy es estado de sesión: al recargar empieza vacío, aunque las líneas siguen en el chat. Persistirlo significa guardar hasta 300 entradas por combate en el mundo.

**Recomiendo dejarlo como está** salvo que al jugar lo eches en falta. Es el tipo de cosa que solo tú puedes saber.

### D8 · Las plantillas del asistente siguen siendo código

Añadir una a mano exige editar `starter-templates.js`. Convertirlas en datos (`N-12`) era tu requisito de *«sin tocar código»* aplicado al inicio de partida — pero ahora la generación con IA cubre el caso práctico.

**Recomiendo aplazarlo** hasta que quieras una plantilla fija concreta que la IA no te dé.

---

## 🔵 P — Propuestas

Ideas que no están en ningún plan. Ninguna es necesaria; algunas son buenas. Marco con 💡 las tres que haría yo.

### Que la IA haga más, por la tubería que ya existe

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P1** 💡 | **Generar escenarios con IA** | La Fase F genera mundos. Generar *misiones* — objetivos, salas, enemigos dormidos — es la misma tubería contra el esquema de `scenarios.js`, y es lo que convierte una mazmorra en una campaña. Depende de A4 |
| **P2** | **Generar confidentes con IA** | Personajes con su arco, su vínculo y su perk de combate, validados contra `bonds.js`. Depende de A3 |
| **P3** | **Generar un enemigo suelto** desde el tablero | *«Añade un chamán goblin a este encuentro»* sin salir de la partida. Una llamada corta, mismo esquema que los enemigos del mundo |
| **P4** | **Paquetes de reglas de ejemplo** | Variantes listas para importar desde `/rules`: *más letal*, *sin magia*, *armas históricas*. Enseñan para qué sirve el editor mejor que cualquier explicación |

### Ver lo que el motor sabe

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P5** 💡 | **Panel del estado canónico** | Una vista con todo lo que el motor da por cierto: HP, posiciones, vínculos, misiones, día, banderas. Hoy ese estado existe repartido y solo se ve de refilón. Sería el complemento de `/prompt`: uno muestra lo que se envía, el otro lo que el juego cree |
| **P6** | **Chequeo de campaña sana** | Una orden que revise si un mundo se puede jugar: enemigos con reglas de encuentro, posiciones de inicio transitables, tableros con terreno. **Cada uno de esos tres ha sido un fallo real** — el chequeo los habría cazado a todos |
| **P7** | **Deshacer en el tablero** | Pintar terreno y mover fichas no tiene vuelta atrás. Una pila de deshacer por tablero |

### Que el juego aguante una campaña larga

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P8** 💡 | **Punto de guardado de la partida** | Un *checkpoint* del estado canónico al que volver. Es lo que hace seguro experimentar: probar un combate difícil, o una decisión que no sabes si te va a gustar |
| **P9** | **Exportar la campaña entera** (`.tavernworld`) | Mundo, mapas, grupo, reglas e historial en un archivo. Las reglas ya viajan dentro del mundo; falta el resto (`PROP-166`) |
| **P10** | **Turnos transaccionales** (`N-04`) | Si un turno se corta a la mitad, ¿se aplicó el daño? Hoy cada acción se aplica al instante y el motor es determinista, así que el riesgo es bajo. Importaría si el modelo llegara a escribir estado |
| **P11** | **Presupuesto de merge como métrica** (`N-08`) | Un script que falle si un commit toca un archivo de upstream sin justificarlo. Convierte la disciplina del fork en algo verificado en vez de recordado |

### Sobre el propio desarrollo

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P12** | **Commits por bloque de trabajo** | Hoy hay ~40 archivos tocados sin un solo commit. Dos veces he tenido que recuperar un archivo con `git checkout --`, y solo pude porque estaba en git. No cuesta nada y el día que haga falta, vale mucho |
| **P13** | **Un `CHANGELOG.md` del fork** | Qué cambió y por qué, en la lengua del juego y no en la del código. La wiki cuenta el plan; esto contaría la historia |

---

## 🟡 Deuda conocida

No es trabajo pendiente, es información: cosas que están así **a propósito**, con su motivo, para que nadie las «arregle» sin saberlo.

| Tema | Por qué está así |
| :--- | :--- |
| **`party/html.js` duplica `escapeHtml`** | Importar `utils.js` arrastra código que exige `window` y rompería los tests en Node. Hay un test que ancla el contrato. Si algún día `utils.js` expone un módulo hoja, esto se elimina |
| **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge |
| **El guardián de tiradas solo mira afirmaciones estructuradas** | `1d20+5 = 23` sí; «saca un 18» no. Reescribir prosa exige entender la frase, y equivocarse es peor que no tocarla. El prompt debe pedir la forma estructurada |
| **La cobertura cuenta por casilla, no por línea de tiro** | Simplificación declarada de D&D 5e. Arreglarla es A9 |
| **`dynamic-context-manager.js`, `campaigns.js` y `world-content-browser.js` sin tests** | 1.085 tests cubren el motor nuevo; estos tres (unas 3.000 líneas) siguen a cero. `MAINT-03` |
| **La generación con IA no se ha probado con un proveedor real** | El recorrido de navegador usa un generador simulado: ejercita todo menos la llamada. Falta ver si un modelo concreto respeta el esquema del mapa |

---

## 🧪 Probarlo a mano (cinco minutos)

1. `npm start` y abre <http://localhost:8000>. Si el servidor llevaba abierto desde antes de los últimos cambios, reinícialo y recarga con `Ctrl+F5`.
2. En la bienvenida, **Nueva campaña**. Tienes dos caminos:
   - *Mazmorra clásica* (o cualquier plantilla) → un nombre → `Lyra` y `Brand`.
   - **Generar con IA** → describe el mundo (*«una cripta inundada bajo una iglesia en ruinas»*) → **Generar**. Verás el mapa antes de crear nada, con los arreglos que haya hecho falta. Si no te convence, genera otra vez o elige una plantilla. *(Solo aparece si tienes un proveedor conectado.)*
3. **Crear campaña**. Acabas en el tablero, con el grupo colocado.
4. **Haz clic en una puerta**: se abre y queda dibujada con trazo discontinuo.
5. `/fight <enemigo> 1` — el nombre lo puso la plantilla o la IA. Aparece el **registro de combate** bajo el tablero, con el desglose de cada tirada.
6. `/combat-stop` para abandonarlo. En el chat aparece un mensaje de **narrador** con el resumen: ese es el único que lee el modelo.
7. `/rules` → *Tipos de daño* → **Añadir** → `void` / `Vacío` → **Aplicar sección** → **Guardar reglas**. Te ofrece recargar; al hacerlo, ese tipo de daño está en las fichas.
8. `/prompt` (después de haber enviado algún mensaje) → qué ocupa cada bloque del turno y cuánto llevas de sesión.
9. Bajo el tablero, **Terreno**: pinta muros y recarga; siguen ahí.
10. `/sandbox` abre el banco de pruebas de combate sin tocar tu campaña.
11. Cierra el chat: la campaña sale con **Continue**. Un mundo que existe pero nunca se jugó sale con **Iniciar**.

Y sin tocar nada, el recorrido completo en un navegador de verdad:

```bash
node tools/e2e-campaign.mjs            # servidor y datos propios; no toca los tuyos
node tools/e2e-campaign.mjs --headed   # para verlo
```

Lo que **no** se puede probar todavía: calendario, vínculos y escenarios (#6, #7, #8), y la generación con IA contra un proveedor real (#25).

---

## ✅ Hecho, para no rehacerlo

### El bloque de prioridad alta, cerrado el 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| **Fase F · Generar el mundo con IA** | Tarjeta *Generar con IA* en el paso 1 del asistente. Describes el mundo en una frase y lo construye: mapa, enemigos, lugar y tablero. **Lo que devuelve es una plantilla como las otras** y pasa por los mismos constructores, así que un mundo generado no llega al tablero por un camino propio. Agnóstico de proveedor (`generateRaw` + esquema JSON): funciona con el conector que tengas, y si no hay ninguno la tarjeta ni aparece. **Una llamada por mundo** |
| **El modelo devuelve basura y aun así juegas** | Filas de distinto largo, un símbolo inventado, un borde abierto por donde salirse del tablero, un perfil táctico que no existe, dos enemigos con el mismo nombre: todo eso se repara y **se te dice qué se reparó**. Lo que no tiene arreglo — un mapa sin una sola casilla libre — se rechaza con su motivo. Nada se crea antes de que veas el mapa |
| **C3 · Editor visual de reglas** | `/rules` abre las **25 secciones** del paquete: tipos de daño, propiedades de armas y armaduras, condiciones, rarezas… Tablas con añadir y quitar; las secciones con estructura propia se editan como JSON. Marca con un punto las que has cambiado, y *Restablecer sección* deshace. Es tu requisito literal: **añadir un tipo de daño sin tocar JavaScript** |
| **C5 · Importar y exportar paquetes** | Desde el mismo editor. La exportación es diferencial: el archivo dice qué cambias, no repite D&D entero |
| **Cargar el paquete de reglas de cada campaña** | Se guarda en el mundo, así que viaja con él y dos campañas pueden no estar de acuerdo sobre qué es un arma. `dnd-system.js` fija sus tablas al cargar, y eso no se podía esquivar: ahora el paquete se **recuerda antes** de que ese módulo se evalúe, y se te avisa una vez con el botón de recargar. Un paquete roto no se instala: se queda el de por defecto y se dice por qué |
| **T3 · Ver qué se envía en cada turno** | `/prompt` desglosa el último turno en bloques con nombre — prompt de sistema, contexto dinámico, ficha del grupo, lorebook, conversación — ordenados por tamaño, con barra y con el principio de cada uno. Y la cifra que decide si una campaña se encarece: **cuánto del turno es contexto que se reenvía siempre** |
| **T4 · Lo que lleva la sesión** | Turnos, tokens enviados, el turno más caro y qué bloque lo hizo grande. Pones el precio por millón de tu proveedor y te dice el gasto. **Con una advertencia que no se esconde**: son la medida propia de la aplicación, no la factura. SillyTavern no devuelve a la página el recuento real de la API, así que la reconciliación con el proveedor sigue pendiente (#28) |

> [!NOTE]
> **Lo que encontró el navegador y los tests no.** El editor de reglas no se podía cerrar: el paquete recibía su `id` y su `nombre` al guardar, después de la comprobación que los exige, así que la validación fallaba siempre y el diálogo se quedaba abierto. Con 26 tests del modelo en verde. Lo cazó `tools/e2e-campaign.mjs` a la primera.
>
> Y dos que cazaron los tests antes de llegar al navegador: el editor **borraba** los campos de un flag que ninguna columna muestra (a qué tipos de objeto se aplica), y **perdía** la opción vacía con la que empiezan varias listas. Ambos habrían roto el paquete al guardarlo sin tocar nada.

### Antes, el mismo día

| Qué | Cómo quedó |
| :--- | :--- |
| **El epílogo de combate llega al modelo** | Se publica como mensaje de **narrador**, no de sistema. El nuevo `game-engine/ui/chat-channel.js` obliga a nombrar el público (`CHANNEL.PLAYER` o `CHANNEL.MODEL`) y deriva de ahí el `is_system`, con tests que comprueban lo que importa — si el modelo lo lee — en vez de la bandera. Verificado en navegador: `is_system=false`. No dispara ninguna llamada: entra en el prompt de tu siguiente mensaje |
| **La cobertura cuenta en el ataque** | `getCoverBonus` se aplica a la CA del objetivo en los dos puntos de ataque, y el registro dice *«incluye +2 por cobertura media»*. Un tablero sin terreno se comporta igual que antes |
| **El guardián de tiradas está conectado** | Corre sobre cada mensaje del modelo. Por defecto solo corrige lo **imposible** (un `1d20+5` no puede dar 30), porque esa corrección nunca es opinable; `/rollguard estricto` hace que el motor tire por todas, y `/rollguard off` lo desactiva. Cada corrección se anuncia |
| **Las puertas se abren con un clic** | En el tablero real. Se redibuja la niebla al abrirlas, y queda anotado en el registro |
| **El registro de combate está en el tablero real** | Ya no solo en `/sandbox`. Se alimenta de las líneas de combate y del desglose de cada tirada |
| **Se puede abandonar un combate** | `/combat-stop`. Antes solo se salía ganando o muriendo, y el epílogo era inalcanzable sin cadáveres. El resumen distingue abandono de derrota |
| **El asistente crea campañas con combate** | Las plantillas escribían `encounterRules: []`, así que `/fight` contestaba *«enemigo no encontrado»* en toda campaña recién creada. Las reglas se escriben ahora al conocer el id de cada monstruo |
| **El recorrido en navegador está en el repositorio** | `tools/e2e-campaign.mjs` levanta su propio servidor con datos temporales, recorre el juego y limpia. 44 comprobaciones |
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

**Verificación** (medida el 2026-09-21, tras el bloque de prioridad alta):

```bash
npm run test:unit --prefix tests     # 1.085 tests, 41 suites
node tools/check-fork-types.mjs      # 0 errores en 38 archivos del fork
node tools/check-engine-wiring.mjs   # 19 de 24 módulos conectados
node tools/e2e-campaign.mjs          # 44 comprobaciones en un navegador real
ESLINT_USE_FLAT_CONFIG=false npx eslint public/scripts/game-engine public/scripts/party public/scripts/party.js public/scripts/campaigns.js public/scripts/world-map-renderer.js tools
```

> [!NOTE]
> Las cuatro primeras responden preguntas distintas: los tests, si un módulo hace lo que promete; el gate de tipos, si encaja; el detector de cableado, si el juego llega a cargarlo; el recorrido en navegador, si un jugador puede provocarlo. Todo lo que este proyecto dio por hecho equivocadamente cayó entre la primera y las dos últimas.

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[PROBLEMAS_TECNICOS]]: auditoría original, con el estado de cada hallazgo.
- [[PROPUESTAS_MEJORA]]: catálogo de 200 con el estado de cada propuesta.
- [[Mapa-Codigo-Archivos]]: qué archivo hace qué, y cuál está conectado.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
