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
> node tools/check-engine-wiring.mjs   # 30 módulos, 29 conectados, 1 sin cargar (275 líneas)
> ```

---

## 🟢 A — Se puede hacer sin preguntar

Ordenado por lo que desbloquea. Cada una tiene el camino decidido: si aparece una bifurcación de verdad, sube al bloque D en vez de resolverse por mi cuenta.

> [!IMPORTANT]
> **Dos direcciones nuevas, y este es el orden.**
>
> **El Modo Videojuego** ([[PROPUESTA_FRONTEND_MODO_JUEGO]]) va primero: tres pantallas completas que se alternan solas según lo que pase en la partida. Es, en su mayor parte, **recolocar lo que ya funciona** — el motor conectado ya produce lo que cada pantalla necesita.
>
> **La ingesta de libros** ([[ROADMAP_INGESTA_CAMPANAS_LIBROS]]) queda en pausa tras el contrato, A4–A6. No está bloqueada: `/esquema-campana` ya entrega lo necesario para montar el Gem y **probarlo con un libro real en paralelo**, y lo que salga de ahí puede cambiar el contrato mientras cambiarlo sigue siendo barato. El GEM que extrae el libro **lo llevas tú, fuera del código**, con tu suscripción de Gemini.

| ID | Tarea | Qué entrega | Fase |
| :--- | :--- | :--- | :--- |
| **A1** | **El director automático** | Escuchando **al motor**, no al estado del DCM: empieza un combate y la pantalla salta; termina y vuelve al diálogo para el epílogo | H3 |
| **A2** | 🖥️ **La escena de exploración** | Y con ella el tablero de campaña, que hoy nadie carga. Es donde encaja A9 | H4 |
| **A3** | 🖥️ **Pantalla de título y menú de pausa** | Lo último: una fachada bonita sobre escenas a medias no sirve de nada. «Opciones» abre los paneles de SillyTavern tal cual | H5 |
| **A4** | **Validador del paquete de campaña** *(Fase G, en pausa)* | Integridad cruzada: que los tableros que citan las misiones existan, que los enemigos colocados estén en el bestiario, que los mapas dejen sitio donde empieza el grupo. El contrato ya publica las diez reglas; falta comprobarlas. **Donde falla un paquete generado no es en un campo suelto** | G2 |
| **A5** | **Compilador de ingesta** *(Fase G)* | Del paquete a mundo, misiones, tableros y confidentes. Aquí se resuelven los nombres a ids, **después** de crear las entradas — el mismo patrón que arregló las reglas de encuentro | G3 |
| **A6** | **Importar campaña desde el asistente** *(Fase G)* | Cuarta tarjeta, con previsualización de lo que trae el paquete y de lo que se ha reparado | G4 |
| **A7** | 🖥️ **Salas, puertas y enemigos dormidos** | `campaign-map.js` es **el último módulo del motor que nadie carga**. Su sitio natural es la escena de exploración (A2), y sin salas una mazmorra de libro es un único combate gigante | E2 · G · H4 |
| **A8** | **Descanso corto y largo** con dados de golpe | El otro lado del calendario, que ya existe: sin descansos, los recursos no significan nada | D5 |
| **A9** | **Prefijo estable del prompt** | La decisión D2: reordenar lo que se envía para que el principio no cambie entre turnos. Lo aprovechan Gemini, OpenAI y Claude por igual, y `/prompt` ya sabe medir si funcionó | T1 |
| **A10** | **Objetivos editables, y generados con IA** | Hoy una misión se escribe a mano en World Info, salvo la de la plantilla. El generador de mundos ya valida contra esquema: pedirle objetivos es la misma tubería | E/F |
| **A11** | **El vínculo de rango 10 sigue sin ser nada** | Las otras tres perks ya cambian el combate; esta es contenido — arma y habilidad propias — y necesita decidir qué es antes de poder construirse | D3 |
| **A12** | **Convertir el botín en objetos de verdad** | Hoy lo que sueltan los enemigos se añade como texto al inventario. Para equiparlo hace falta crearlo como `DndItem`, con las formas que ya existen | B5 |
| **A13** | **Reglas de encuentro editables** | El asistente ya las escribe; cambiarlas exige ir a World Info a mano | B/C |
| **A14** | **Editar y comparar lo generado con IA** | Retocar el mapa en la previsualización y volver a una generación anterior sin cerrar el asistente | F |
| **A15** | **Cobertura por línea de tiro** | Hoy cuenta la casilla del objetivo, que es una simplificación declarada. El punto donde arreglarlo ya está aislado en `getTargetArmorClass` | A/B |
| **A16** | **Avisar de lo que un cambio de reglas rompería** | Quitar un tipo de daño que un objeto usa deja ese objeto con una referencia muerta, y hoy se guarda sin protestar | C3 |
| **A17** | **Sacar el pegamento de `party.js`** | 5.700 líneas: la lógica vive fuera, en módulos probados, pero cada enganche nuevo se acumula aquí | — |
| **A18** | **Registro de contradicciones** narración contra estado | Tras cada turno, comparar lo que el modelo contó con lo que el motor sabe. Da datos sobre dónde fallan los prompts en vez de intuiciones | T7 · N-06 |
| **A19** | **Snapshot del prompt compilado en CI** | Que un cambio que altere el prompt en silencio haga fallar la build. Ahora es posible: `/prompt` ya sabe descomponerlo | T5 · N-02 |
| **A20** | **Repetición determinista de turno** | Reejecutar con el mismo contexto y semilla, para saber si un cambio de prompt mejoró algo en vez de suponerlo | T6 · N-05 |
| **A21** | **Ampliar el recorrido de navegador** a las salas y las puertas | Lo cubrirá cuando A5 esté, y hará falta ampliarlo otra vez con las escenas de A1–A3. El calendario, los vínculos, las perks y los escenarios ya lo están | — |

---

## 🟠 D — Necesita una decisión

Cada una es una bifurcación real: las dos salidas son defendibles y la elección cuesta después. Llevan mi recomendación, pero la decisión no es mía.

### D1 · `npm audit`: 47 vulnerabilidades, una crítica

Están en el árbol de dependencias tras el merge. Actualizarlas puede romper cosas de upstream que no controlamos.

**Recomiendo mirar solo la crítica** y dejar el resto hasta el próximo merge con upstream, que probablemente las arrastre.

### D2 · Reconciliar los tokens con el proveedor

`/prompt` mide lo que la aplicación envía, no lo que factura la API, porque SillyTavern no devuelve el `usage` a la página. Conseguirlo exige interceptar las respuestas (y con streaming llegan troceadas), que es meter mano en terreno de upstream.

**Recomiendo no hacerlo.** Para decidir qué recortar basta con comparar turnos entre sí, y eso ya funciona.

### D3 · ¿El registro de combate debe sobrevivir a una recarga?

Hoy es estado de sesión: al recargar empieza vacío, aunque las líneas siguen en el chat. Persistirlo significa guardar hasta 300 entradas por combate en el mundo.

**Recomiendo dejarlo como está** salvo que al jugar lo eches en falta. Es el tipo de cosa que solo tú puedes saber.

### D4 · Las plantillas del asistente siguen siendo código

Añadir una a mano exige editar `starter-templates.js`. Convertirlas en datos (`N-12`) era tu requisito de *«sin tocar código»* aplicado al inicio de partida — pero ahora la generación con IA cubre el caso práctico.

**Recomiendo aplazarlo** hasta que quieras una plantilla fija concreta que la IA no te dé.

---

## ✅ Decisiones tomadas — 2026-09-21

| ID | Qué se decidió | Consecuencia |
| :--- | :--- | :--- |
| **D1** | **Conectar la máquina de turnos** | Hecho. El combate real la usa: una sola definición de turno, con acción, acción adicional y reacción. Desbloquea las perks de vínculo |
| **D2** | Proveedor principal: **Gemini** | La caché de upstream (`claude.cachingAtDepth`) no sirve aquí, pero **la parte que importa sí es agnóstica**: los tres grandes cachean por *prefijo* — OpenAI automáticamente, Gemini de forma implícita en los 2.5, Claude con marcas. Lo que hay que hacer es que **el principio del prompt no cambie entre turnos**, y eso vale para todos |
| **D3** | **Evaluar *Summarize* de upstream** antes de escribir nada propio | Sin empezar. Solo importa cuando una campaña se alargue |
| **D4** | **Solo juego local** | Los tres agujeros de upstream (CSP, secretos en texto plano, jQuery 3.5.1) se quedan como están, a propósito. Si algún día abres el servidor a la red, pasan a ser lo primero |

---

## 🔵 P — Propuestas

Ideas que no están en ningún plan. Ninguna es necesaria; algunas son buenas. Marco con 💡 las tres que haría yo.

### Que la IA haga más, por la tubería que ya existe

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P1** 💡 | **Generar escenarios con IA** | La Fase F genera mundos. Generar *misiones* — objetivos, salas, enemigos dormidos — es la misma tubería contra el esquema de `scenarios.js`, y es lo que convierte una mazmorra en una campaña. Depende de A7 |
| **P2** | **Generar confidentes con IA** | Personajes con su arco, su vínculo y su perk de combate, validados contra `bonds.js`. Depende del compilador de ingesta (A5) |
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
| **P12** | **Commits por bloque de trabajo** | Ya lo estás haciendo. Merece quedarse escrito por qué importa: dos veces ha habido que recuperar un archivo con `git checkout --`, y solo se pudo porque estaba en git |
| **P13** | **Un `CHANGELOG.md` del fork** | Qué cambió y por qué, en la lengua del juego y no en la del código. La wiki cuenta el plan; esto contaría la historia |

---

## 🟡 Deuda conocida

No es trabajo pendiente, es información: cosas que están así **a propósito**, con su motivo, para que nadie las «arregle» sin saberlo.

| Tema | Por qué está así |
| :--- | :--- |
| **`party/html.js` duplica `escapeHtml`** | Importar `utils.js` arrastra código que exige `window` y rompería los tests en Node. Hay un test que ancla el contrato. Si algún día `utils.js` expone un módulo hoja, esto se elimina |
| **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge |
| **El guardián de tiradas solo mira afirmaciones estructuradas** | `1d20+5 = 23` sí; «saca un 18» no. Reescribir prosa exige entender la frase, y equivocarse es peor que no tocarla. El prompt debe pedir la forma estructurada |
| **La cobertura cuenta por casilla, no por línea de tiro** | Simplificación declarada de D&D 5e. Arreglarla es A15 |
| **`dynamic-context-manager.js`, `campaigns.js` y `world-content-browser.js` sin tests** | 1.232 tests cubren el motor nuevo; estos tres (unas 3.000 líneas) siguen a cero. `MAINT-03` |
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
12. Con un combate en marcha, `/modojuego`: el tablero a pantalla completa. **Atacar** lista a quien tengas al alcance.
13. Dentro del Modo Juego, tecla `1`: la escena de diálogo, con el chat movido debajo del retrato. Escribe algo y envíalo. `3` vuelve al tablero; `Esc` sale de la caja de texto y otro `Esc` apaga el Modo Juego.

Y sin tocar nada, el recorrido completo en un navegador de verdad:

```bash
node tools/e2e-campaign.mjs            # servidor y datos propios; no toca los tuyos
node tools/e2e-campaign.mjs --headed   # para verlo
```

Lo que **no** se puede probar todavía: calendario, vínculos y escenarios (#6, #7, #8), y la generación con IA contra un proveedor real (#25).

---

## ✅ Hecho, para no rehacerlo

### H2 · La escena de diálogo, con el chat movido — 2026-09-21

Tecla `1` dentro del Modo Juego: retrato grande de quien habla, su rango de vínculo, el chat debajo y la franja del grupo al pie, con vida y estados.

**El paso con riesgo, y salió bien.** `#sheld` lleva dentro `#chat` y `#form_sheld` con su streaming, sus swipes y sus manejadores: **se mueve entero**, no se replica. El recorrido lo comprueba de las dos maneras — que dentro de la escena el chat conserva todos sus mensajes y su caja de escribir, y que al apagar vuelve al mismo padre, al mismo sitio y con `position: absolute`, la suya de siempre. Hay un `/send` desde dentro de la escena que aparece en el chat: el que está montado ahí es el vivo, no una foto.

**Dos escenas montadas, ninguna se mueve al conmutar.** Cambiar de pantalla enseña una y esconde la otra. Mover el chat cada vez habría sido una ocasión de perder el desplazamiento o el foco en cada pulsación.

**Lo que encontró el navegador**: al escribir, el foco se queda en la caja, y entonces `Esc` y `1`/`2`/`3` son del mensaje, no del juego — pinchar en el chat era **una puerta de ida**, y solo el ratón te sacaba. Ahora `Esc` sale primero de la caja y el segundo apaga el Modo Juego, como en cualquier editor.

Quién habla lo decide `ui/shell/dialogue-scene.js`, puro y con 17 tests: el último mensaje que no es tuyo **y no es de sistema** —la salida de un comando de barra no debe adueñarse del retrato— mientras que el narrador sí cuenta, porque a propósito no es un mensaje de sistema. Quien no está en el grupo también tiene retrato, pero sin rango: no hay vínculo del que leerlo.

### H1 · El Modo Juego: el tablero a pantalla completa — 2026-09-21

`/modojuego` levanta una capa a pantalla completa con el tablero en grande, el rastreador de iniciativa, el registro de combate y una barra de acciones. Se apaga con el mismo comando o con `Esc`.

**No hay una segunda interfaz.** El Shell **mueve** el panel del tablero al escenario y lo devuelve al cerrarse: el recorrido de navegador comprueba que solo existe una copia, que vuelve al mismo padre y al mismo sitio, y que se sigue dibujando ahí. Una copia habría sido otra cosa más que mantener al día.

**Quién decide la pantalla**: `ui/shell/scene-director.js`, puro y con 24 tests. Lee lo que sabe el motor — hay encuentro, hay tablero, hay localización — y **nunca** el estado del `dynamic-context-manager`, que lo fija el modelo: una frase de ambiente que dijera *«todos a la iniciativa»* habría saltado a la pantalla de combate sin que hubiera combate.

La barra de acciones no pide teclear: **Atacar** despliega los enemigos que están de verdad a tu alcance, con distancia, PG y CA; y cuando no puede atacar dice por qué — no es tu turno, la acción ya está gastada, no hay nadie cerca.

**Se puede apagar, y eso es parte del diseño**: es la primera capa que es presentación pura, la que peor aguantaría un merge con upstream. Con el Shell apagado la aplicación es exactamente la de antes, incluido el panel plegado si lo estaba.

**Lo encontró el navegador, no los tests**: `setLocationMapsVisibility(hidden)` decía *visibility* y recibía *hidden*, así que el Shell «abría» el panel plegándolo y enseñaba una pantalla completa vacía. Ahora se llama `setLocationMapsHidden`.

### G1 · El contrato del paquete, exportable — 2026-09-21

`/esquema-campana` abre lo que hay que pegar en tu Gem: ocho vistas — las instrucciones completas, el esquema a secas, un ejemplo de salida correcta, y una por cada sección del paquete, porque un libro no cabe en una sola respuesta y tendrá que producirlo por partes.

**Lo importante no es el panel, es de dónde sale.** El esquema se **genera** desde el propio motor:

| Lo que declara | De dónde sale |
| :--- | :--- |
| Los siete tipos de objetivo | `campaign/scenarios.js` |
| Los cuatro perfiles tácticos | `combat/enemy-ai.js` |
| Los caracteres del mapa | `board/terrain.js` |

Si el motor cambia, cambia lo que pegas. Una copia guardada a mano se queda vieja sin avisar, y el fallo aparecería un libro entero más tarde.

**La decisión que lo ordena todo**: el autor escribe **nombres** —`"target": "Guardián del grano"`— y el importador los resuelve a ids al crear las entradas. Un libro no puede conocer un `uid` de World Info, porque ese uid no existe hasta importar. Es exactamente el fallo que ya costó una función entera: el asistente escribía sus tableros con la lista de encuentros vacía porque los ids aún no existían, y `/fight` no encontraba enemigos en ninguna campaña nueva.

Hay tests que lo fijan: el esquema **no pide** `targetIds`, `allyId` ni `treasureIds`, y **no acepta** `required` — el motor razona en objetivos opcionales.

Y publica las **diez reglas que un JSON Schema no puede expresar**, que es donde un paquete generado falla de verdad: que el tablero que cita una misión exista, que el enemigo colocado esté en el bestiario, que ningún nombre se repita —el Lorebook indexa por nombre—, que el borde del mapa esté sellado y que el grupo empiece sobre suelo. Las dos últimas ya fallaron una vez, con dos personajes dentro de un muro.

El ejemplo que acompaña al contrato no es el caso fácil: dos tableros, una misión que referencia a otro, un objetivo opcional y uno de proteger a un compañero. Un ejemplo que solo cubre lo fácil enseña lo fácil.

### Los escenarios, conectados — 2026-09-21

`campaign/scenarios.js` sabía juzgar siete tipos de objetivo desde la Fase E, y nadie se lo preguntaba nunca: **todos los combates de este juego eran «mata a todo el mundo»**, que es justo el escenario para el que un motor táctico menos falta hace.

| Qué | Cómo quedó |
| :--- | :--- |
| **Un tablero puede llevar una misión** | Si define objetivos, son ellos los que deciden el combate. Un tablero sin objetivos se comporta exactamente como siempre: limpias y ganas |
| **Se ven donde está la pelea** | Encima del rastreador de iniciativa, porque *para qué* es el combate manda sobre *a quién le toca*. Tachados al cumplirse, en rojo al fallarse, y los opcionales marcados como tales |
| **Ganar sin matar a nadie** | *Aguantar 3 rondas* se gana con todos los enemigos en pie. Antes no había forma de expresar eso |
| **Perder sin morir** | *Proteger a X* se falla si X cae, aunque el grupo siga entero |
| **La mazmorra inicial trae misión** | Limpiar la sala, y aguantar 3 rondas como objetivo **opcional**. Así una campaña nueva enseña para qué sirve un escenario sin que nadie tenga que escribir uno a mano |
| **`/objetivos`** | Los muestra en cualquier momento |

`combat/scenario-board.js` traduce el combate en curso al estado que el evaluador espera y devuelve el veredicto; 18 tests. Decidir y aplicar siguen separados, como en la IA de enemigos y en las perks.

> [!NOTE]
> **Dos pruebas más que dependían de los dados.** El paso del botín daba por hecho que el grupo ganaría, y perdía una vez de cada tres: ahora comprueba la **regla** — una victoria paga, cualquier otra cosa no — en lugar de un desenlace concreto. Y el de la máquina de turnos intentaba empezar un combate con el grupo en el suelo tras el anterior. Tres pasadas seguidas, 79 comprobaciones, mismo resultado.

### Las perks de vínculo, en el combate — 2026-09-21

El argumento del propio documento de diseño para el bucle Persona era que los vínculos tenían que ser mecánicos: *«un vínculo que no cambia cómo va un combate es solo un número en pantalla»*. Hasta ahora eran exactamente eso — ganados, listados y sin efecto.

| Perk | Rango | Qué hace ahora |
| :--- | :---: | :--- |
| **Ataque de seguimiento** | 3 | Cuando asestas un crítico, un compañero **que ya pueda alcanzar al objetivo** tiene un 50% de atacar gratis. Se resuelve como un ataque de verdad: tira, puede fallar y sale en el registro. Un golpe gratis que siempre acierta no es una perk, es una trampa |
| **Relevo** | 5 | Al derrotar a un enemigo, puedes ceder el movimiento que te quede con `/relevo <nombre>`. Es una oferta, no un automatismo: regalar tu movimiento es una decisión, y que el motor la tomara por ti quitaría la única parte interesante |
| **Aguantar** | 8 | Si un golpe fuese a dejarte a 0, un compañero se interpone y te deja a 1 HP. **Una vez al día**, solo cuando el golpe de verdad te habría tumbado, y nunca para salvarse a sí mismo: una perk que salta con cada rasguño haría el combate imposible de perder en vez de tenso |
| **Vínculo máximo** | 10 | Sigue siendo contenido — arma y habilidad propias — no una regla. Se muestra en el panel como lo que es |

Lo que decide cada una vive en `combat/bond-perks.js`, puro y con 21 tests; aplicarlas es cosa de `party.js`. Esa separación es lo que permite probar de forma exhaustiva un efecto que nadie supervisa.

> [!NOTE]
> **Tres pruebas que no probaban nada.** El recorrido de navegador daba por hecho que el personaje ya estaría junto al enemigo, y un `/combat-move` a la casilla de al lado se rechaza si la distancia supera el movimiento del turno. Fallaba una vez de cada dos sin que cambiara el código. Ahora hay un único ayudante que juega un turno como lo jugaría una persona — acercarse un paso, y atacar cuando llega — y lo usan las tres comprobaciones. Tres pasadas seguidas, 74 comprobaciones, mismo resultado.
>
> Y la de *Aguantar* comprueba la **decisión** con los vínculos que la partida tiene guardados, no que el golpe letal caiga: que caiga dentro de una ejecución es cuestión de dados, y una prueba que depende de los dados es una prueba que se aprende a ignorar.

### El calendario, los vínculos y la máquina de turnos — 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| 🖥️ **Panel de campaña** (D6) | Pestaña nueva, **Campaña**, junto a Party y Location. Muestra el día, en qué parte del día estás, y una ficha por compañero con su rango, su progreso al siguiente y **las cuatro perks: las que tiene y las que le faltan**. Ver qué da el rango 8 es la razón para seguir pasando tardes con alguien |
| **El tiempo corre** | *Pasar el rato* avanza un bloque; *Dormir* salta al día siguiente y devuelve las perks de una vez al día. También con `/time next` y `/time sleep` |
| **Los vínculos suben por hechos** | Desde el panel se registra un regalo, una escena de confidente o tiempo libre compartido. Un combate ganado juntos lo registra **el motor solo**, que es la decisión de diseño entera: la narración no decide cuándo sube un vínculo. También con `/bond Lyra confidant_scene` |
| **Subir de rango se anuncia** | Con las perks que desbloquea, porque ese es el momento en que el modelo debería escribir una escena — sobre un hecho que el motor ya decidió |
| **Sin tocar `index.html`** | La pestaña y su panel se crean desde `party.js`. Ese archivo es de upstream y cada línea que el fork le añade se paga en cada merge |
| **Máquina de turnos conectada** (D1, B1/B3) | El combate real la usa: **una sola definición de turno**, con acción, acción adicional y reacción. Antes había dos implementaciones y el juego usaba la suya, más pobre. Los encuentros guardados cargan igual y ganan los dos campos que les faltaban |
| **La acción se gasta de verdad** | Atacar consume la acción del turno, y un segundo ataque en el mismo turno se rechaza. Es lo que hace falta para que las perks de vínculo (A1) tengan dónde colgarse |

> [!NOTE]
> **Una prueba inestable es peor que ninguna.** El paso del botín pasó una vez y falló a la siguiente sin que cambiara el código: dependía de a quién le tocara la iniciativa y de dónde cayera el enemigo, las dos cosas tiradas al azar. Ahora el recorrido cierra la distancia y espera su turno como haría un jugador, y se ha ejecutado tres veces seguidas con el mismo resultado.

### A1 y A2, cerrados el 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| **Rastreador de iniciativa** (B8) | Sustituye a la lista numerada de nombres que había. Ahora cada fila dice **quién actúa**, **quién va después** —saltando a los caídos y dando la vuelta al final de la ronda—, la vida de cada uno con barra, y quién está por debajo de la mitad. La ronda se lee arriba en vez de contarse de memoria |
| **Marcadores de estado** (PROP-088) | Las condiciones se dibujan como iconos en el rastreador **y sobre la ficha en el tablero**, para no tener que apartar la vista del mapa para saber que a quien vas a mover está apresado. Cada condición del paquete de reglas tiene su icono; una que no esté en la tabla se dibuja igual, con su nombre |
| **`/condition`** | Poner y quitar condiciones desde el chat: `/condition Lyra Poisoned` alterna, `/condition Lyra` lista, `/condition Lyra clear` limpia. Antes solo se podían tocar abriendo la ficha, o las ponía el propio combate al caer alguien a 0 |
| **Escalado por tamaño** (PROP-099) | Una criatura Grande ocupa 2×2 casillas, Enorme 3×3, Gargantuesca 4×4. Un ogro dibujado del tamaño de un goblin engaña sobre el alcance y sobre lo que cabe por una puerta, y el motor ya calculaba bien las dos cosas |
| **Botín por CR** (B5) | Ganar da **oro, experiencia y a veces un objeto**, repartido entre los que siguen en pie. Las cantidades salen de una tabla de datos, así que un paquete de reglas puede hacer una campaña más pobre o más rápida de subir de nivel sin tocar código |
| **Subir de nivel se avisa, no se hace solo** | Cuando alguien acumula experiencia suficiente se dice en el registro. Decidir cuándo subir es cosa del jugador; el botón ya estaba en la ficha |

> [!NOTE]
> **Lo que el recorrido de navegador volvió a cazar.** La primera versión del paso de prueba ponía las condiciones escribiendo en `chat_metadata.party`, y no aparecía ningún marcador: ese metadato es una copia, no el grupo que el juego tiene en memoria. El fallo estaba en la prueba, pero señaló un hueco real — no había **ninguna** forma de poner una condición a mano — y de ahí salió `/condition`.
>
> El botín se comprueba ganando un combate de verdad, atacando hasta que el enemigo cae, no editando el estado: el reparto tiene que venir por el mismo camino que una victoria real.

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
| **El recorrido en navegador está en el repositorio** | `tools/e2e-campaign.mjs` levanta su propio servidor con datos temporales, recorre el juego y limpia. 87 comprobaciones |
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

**Verificación** (medida el 2026-09-21, tras el bloque de prioridad alta, A1–A2 y la máquina de turnos):

```bash
npm run test:unit --prefix tests     # 1.232 tests, 47 suites
node tools/check-fork-types.mjs      # 0 errores en 46 archivos del fork
node tools/check-engine-wiring.mjs   # 29 de 30 módulos conectados
node tools/e2e-campaign.mjs          # 87 comprobaciones en un navegador real
ESLINT_USE_FLAT_CONFIG=false npx eslint public/scripts/game-engine public/scripts/party public/scripts/party.js public/scripts/campaigns.js public/scripts/world-map-renderer.js tools
```

> [!NOTE]
> Las cuatro primeras responden preguntas distintas: los tests, si un módulo hace lo que promete; el gate de tipos, si encaja; el detector de cableado, si el juego llega a cargarlo; el recorrido en navegador, si un jugador puede provocarlo. Todo lo que este proyecto dio por hecho equivocadamente cayó entre la primera y las dos últimas.

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]]: la Fase G — meter un libro de campaña y jugarlo.
- [[PROBLEMAS_TECNICOS]]: auditoría original, con el estado de cada hallazgo.
- [[PROPUESTAS_MEJORA]]: catálogo de 200 con el estado de cada propuesta.
- [[Mapa-Codigo-Archivos]]: qué archivo hace qué, y cuál está conectado.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
