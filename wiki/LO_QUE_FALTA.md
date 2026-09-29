---
title: Lo que le falta al juego — lo que queda fuera del plan
tags: [analisis, pendientes, jugabilidad, tablero, contenido, deuda, roadmap]
created: 2026-09-26
updated: 2026-09-29
author: DanielJHesseling / Claude Opus 5.5
---

# 🔭 Lo que le falta al juego

> [!NOTE]
> **Qué es esto.** Lo que le falta al juego **fuera del plan de ahora**, [[ROADMAP_SIN_CONEXION]]. Empezó como un análisis del proyecto entero el 2026-09-26. El 2026-09-29 se puso al día con el código y recogió lo que quedaba en los seis roadmaps que se archivaron ese día (la sección 10 dice adónde fue cada cosa).
>
> Aquí solo está **lo que falta**. Lo hecho desde el análisis va al final, en una lista corta.
>
> **Qué no es.** No es el plan ([[ROADMAP_SIN_CONEXION]]) ni el marcador del día a día ([[POR_HACER]]). Tampoco repite lo que ya descartaste (sección 13). Si algo de aquí ya está en el plan, lleva su fase: «→ J2.2».

**Cómo leerlo**

- **Quién**: **A**, se puede hacer sin preguntar · **D**, lo decides tú · **P**, propuesta: solo si te convence. Es la división de [[POR_HACER]].
- **Esf.** (esfuerzo): **S**, una sesión · **M**, varias · **L**, una fase entera.
- **Tokens**: todo cuesta **0 tokens** salvo que ponga *llamada*. Lo decide el motor, como el resto.
- 💡 marca lo que haría yo primero. 🟡 es que está empezado, y se dice qué falta.

---

## 📊 1. La radiografía

Números sacados del código el 2026-09-29.

| Qué | Cuánto | Lo que dice |
| :--- | ---: | :--- |
| Módulos del motor (`game-engine/`) | **255** · 56.090 líneas | El juego carga 253. `guion-errors.js` solo lo usan las herramientas, y `hours.js` (T9) solo las pruebas |
| `party.js`, el cableado | **21.268 líneas** | Todo lo que el jugador toca pasa por un solo archivo. Partirlo es J15.1 del plan |
| Pruebas unitarias | **3.468** en 155 archivos | Todas en verde |
| Vueltas en el navegador | **4**, unos 15 minutos a la vez | La completa (en dos mitades), la rápida, la sin modelo y la del gremio: `node tools/e2e-todo.mjs` |
| Comandos | **63** | Muchos sin botón todavía (H3) |
| Claves de la partida | **87**, todas registradas | El estado está ordenado |
| Mundos para elegir | **5**, con tres héroes hechos cada uno | **Dos escritos enteros**: 1387 (doce rondas) y La Maldición de Strahd. Costa, ocaso y la pantalla son una plantilla y una semilla. Aparte, el gremio (`gremio.pack.json`) |
| Compendio | 18 archivos | Bestiario 41 · habilidades 30 · misiones 57 · personas 76 · sitios 34 · facciones 29 · estados 39 · frases 133 · sucesos 23 · razas 12 · clases 10 |
| Grimorio | **25 conjuros**, siete escuelas | En código, como decidiste (DR3) |
| Documentos de la wiki | **9** en la raíz y 19 en carpetas; 15 archivados | El 2026-09-29 se archivaron seis roadmaps (sección 11) |

---

## ✅ 2. Lo que ya es fuerte

Para saber qué no hay que tocar:

- **La regla de oro se cumple**: el motor decide y el modelo narra. Los mensajes de sistema no llegan al modelo; lo que el modelo lee va por un solo canal. El prompt tiene forma fija (9 bloques) y un comprobador que avisa si cambia.
- **Todo cuesta 0 tokens salvo narrar, y sin modelo narra el motor.** Combate, tiempo, economía, casos, magia, mascota y tableros los resuelve el motor.
- **Se juega sin conexión de punta a punta**: el personaje en su pantalla, la prueba del gremio, los mercenarios, dos campañas en el tablón, volver al gremio y seguir. Lo comprueba `tools/e2e-gremio.mjs` en el navegador (pasa entera el 2026-09-29).
- **Se comprueba en un navegador de verdad**, con servidor y datos propios. Esas vueltas cazan fallos que las pruebas no ven.
- **El contenido es datos**: el compendio, los paquetes, el guion del Gem y sus conversores. La magia es la excepción que elegiste.
- **Los modos** (R1) dejan jugar lo mismo en relajado o en supervivencia, apagando sistemas en vez de maquillarlos.

---

## 🔴 3. El diagnóstico en cinco frases

1. **El tablero todavía no juega todo lo que pide el guion.** La altura, las salidas, las palancas y las barricadas están desde el 2026-09-26, pero 11 tableros de 1387 siguen con su `mecanica_pendiente` (sección 5).
2. **Hay dos mundos escritos**, 1387 y Strahd. Los otros tres se juegan con lo que el generador improvisa.
3. **La primera hora no enseña nada.** 87 claves, 18 relojes y 63 comandos, y el juego no explica ninguno. Ya está en el plan: J2.2 (enseñar jugando) y J15.4 (comandos a botones).
4. **La generación de mundos con IA nunca se ha probado con un proveedor real** (I1). Es la única tubería que no se ha visto funcionar.
5. **Cada cambio cuesta más que el anterior**, por `party.js` (21.268 líneas; partirlo es J15.1). Las pruebas ya no son el freno: las cuatro vueltas tardan unos 15 minutos a la vez.

---

## 🧩 4. Terminar lo empezado

Lo que quedó a medias. Todo es **A**: el camino está decidido.

| ID | Qué | De dónde | Esf. | Qué falta |
| :--- | :--- | :--- | :---: | :--- |
| **T1** 🟡 | **La cuerda** que cruza un precipicio | R6 | S | Las palancas `P` y las barricadas `=` están desde el 2026-09-26. Falta la cuerda |
| **T5** 🟡 | **Los bloques `pieza:` y `caso:` del guion** | R10 · U8 | M | La mascota del héroe hecho ya está (`mascota:`). Faltan las piezas (salas propias de un mundo) y los casos escritos: hoy los casos solo se generan |
| **T7** 🟡 | **Relojes que dicen su próximo plazo**: 13 de 18 | U3 | M | «Lo que viene» (`campaign/upcoming.js`) no dice nada de las cartas, el surtido de la tienda, las necesidades, el aprendizaje ni el banquillo, que no tienen un día fijo |
| **T8** | **Registros que leen de la crónica** | U4 | M | Leen de ella el diario, la mesa, el resumen del acto y, desde R9, la memoria del narrador. Las hazañas, los recuerdos (`memories.js`), las estadísticas (`stats.js`) y las tumbas siguen apuntando cada uno a su manera. Leerlos de la crónica es lo que hace que el narrador recuerde lo mismo que el diario |
| **T9** 🟡 | **Los horarios** · la gente con horario es J10.6 del plan | P19 · DU6 | M | `campaign/hours.js` ya dice qué abre a cada hora (la tienda y la herrería cierran de noche, y quien las lleva está en la posada), con sus pruebas, **pero el juego no lo carga**. Conectarlo cambia cómo se juega (de noche no se compra), por eso espera a tu decisión D11 de [[POR_HACER]] |
| **T10** | **Oficios de campamento** para quien ya no puede pelear | P25 | S | La pierna de palo existe (`rules/remedies.js`). Falta que el compañero amputado sirva de cocinero, vigía o curandero en vez de ir al banquillo |
| **T11** | **Los remedios, editables en `/rules`** | Deuda | S | `readRemedies` ya acepta una tabla propia. Falta su sección, su editor y que viaje al exportar |
| **T13** | **Más duelos de palabras**: interrogar y reclutar | U6 | M | El Duelo de Palabras es hoy el regateo y «Convencer a…». Encaja con J8 del plan (hablar sin IA) |

---

## 🧱 5. El tablero que pide el guion

El guion de 1387 trae **11 tableros con `mecanica_pendiente`**: cosas que el Gem escribió y el motor no sabe jugar. Lo dice `node tools/guion-a-paquete.mjs wiki/guiones/1387 --check`. La altura (B1) y las salidas (B2) se hicieron el 2026-09-26; esto es lo que queda.

| ID | Qué | Lo pide el guion | Esf. | Cómo |
| :--- | :--- | :--- | :---: | :--- |
| **B3** 🟡 | **Lo que se rompe**: la columna | 2: puertas de granja con daño, columnas de la tienda | S | La barricada `=` está: corta el paso, cubre, tiene 15 de vida y, rota, deja escombros. **Falta:** la columna que al romperse ciega en un área |
| **B4** | **Terreno que atrapa** | 3: lodo que apresa al cargar, lodo que mancha las armas, hielo que cede con tres encima | S | El lodo como terreno (`m`): cargar a través de él deja *apresado* un turno. El hielo de R3 que se rompe si pisan tres casillas contiguas, y cae quien esté encima |
| **B5** | **Coberturas que arden** | 2: árboles con cobertura, muros de carbón que explotan | S | Hoy arden las cajas, las puertas y la maleza (`board/living-terrain.js`). Falta que una cobertura pueda arder según el sitio: en un bosque, la `C` es un árbol |
| **B6** 💡 | **Que `mecanica_pendiente` deje de existir** | Las 11 | M | Un vocabulario corto de reglas de tablero en datos (`reglas: [{ casilla: "C", arde: true }]`) que el Gem pueda usar y el conversor valide. Con B3–B5 dentro, el guionista escribe la regla y el motor la juega, sin pasar por ti |

> [!TIP]
> **B6 es la mejor inversión de esta lista.** Sale de lo que el guion ya pide, y hace que la próxima campaña no acumule otra docena de pendientes.

---

## 🧠 6. La IA

La IA va **después**, en J17 del plan, cuando el juego ya divierta. Esto es lo que habrá que tener para entonces.

| ID | Qué | Quién | Esf. | Tokens | Por qué |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **I1** 💡 | **Probar la generación de mundos con un proveedor real** | **D** | S | llamadas | Es la única tubería sin ver funcionar. El recorrido usa un generador simulado que ejercita todo menos la llamada. Una prueba con tu clave y un tope (dos o tres mundos) diría si el modelo respeta el esquema del mapa. Cuesta céntimos, pero son tuyos: por eso es D |
| **I2** | **Un tope de gasto por sesión** · → J17 | **A** | S | 0 | «Tu sesión» ya cuenta las llamadas. Con la estimación de tokens que ya existe, el juego avisa al acercarse a una cifra que tú pones y, al pasarla, pasa solo a «Motor» y lo dice. No es reconciliar con el proveedor (eso lo descartaste en D2): es un freno con la estimación de siempre. Estaba en la Z6 |
| **I3** | **Proponer escenarios con IA** | **P** | M | llamada | Era P1 💡: la misma tubería que genera mundos, contra el esquema de los escenarios. Con los tableros con propósito de R6, el modelo solo tendría que proponer el *qué*; el *dónde* lo pone el generador |
| **I4** | **El resto de «Mixto»** · → J17 | **A** | M | llamadas | Lo que quedó de la Z6. Que «Mixto» llame al modelo por su cuenta en los momentos que importan (el arranque, una muerte, el final de un combate difícil, el cambio de acto o de semana): hoy solo contesta lo que escribes. Elegir el narrador también en el taller, no solo en la pausa. El contador completo, con las respuestas y los lapicitos, y el coste de una hora en cada modo. Y **gastar una vez**: al crear un mundo con proveedor, una llamada escribe sus frases, charlas y sucesos, que se guardan en el paquete |

---

## 🌍 7. El contenido

Todo esto son **datos**: se hace con el Gem, los conversores y el taller, sin tocar código.

| ID | Qué | Esf. | Por qué |
| :--- | :--- | :---: | :--- |
| **C2** 🟡 | **El papel de cada bicho, escrito** | S | El bestiario tiene 41 criaturas, 8 con habilidades y 5 domables. **Falta** el `papel` (tanque, tirador, sanador o líder) escrito en la fila: hoy lo deduce `combat/enemy-roles.js` |
| **C4** | **Los 69 campos de 1387 que el juego no lee** | M | El conversor los avisa. Los más útiles son `cambia.aparece` en 13 hitos y el destino de las escoltas (`objetivo.a`, `objetivo.pnj`). B6 se come los 11 de `mecanica_pendiente` |
| **C6** | **La pantalla del compendio: editar y quitar un libro entero** | M | Lo único que le quedó al compendio ([[ROADMAP_COMPENDIO]]). Cambiar un peso o una etiqueta ahí mismo, y quitar de una vez todo lo que vino de un libro (`source`). Pide una ruta en el servidor para escribir en el disco; por eso no se hizo |

---

## 🎓 8. La primera hora

No hay tutorial dentro del juego. H1 y H3 ya están en el plan; H4 y H5, no.

| ID | Qué | Esf. | Por qué |
| :--- | :--- | :---: | :--- |
| **H1** 💡 | **Una primera partida que enseña** · → J2.2 | M | Líneas del motor (0 tokens) que presentan **un sistema cada vez**, justo cuando aparece: la mesa el primer lunes, la cuenta el primer viernes, la mascota al primer rastro. En el plan, lo hace el prólogo del gremio |
| **H3** | **Menos comandos a la vista** · → J15.4 | M | 63 comandos. Algunos son la única puerta a algo. Cada uno debería tener su botón o no estar |
| **H4** | **El componente común de tarjetas** para las ventanas viejas | M | Lo dejó pendiente U6. Las ventanas nuevas (mesa, grimorio, mascota) se parecen entre sí; las viejas, cada una a su manera. Con J18 (la cara del juego) conviene decidir el estilo una vez |
| **H5** | **Deshacer al pintar el tablero** | S | Era P7. Pintar terreno (en el tablero y en el editor del taller) y mover fichas no tiene vuelta atrás |

---

## 🔧 9. Lo técnico

| ID | Qué | Quién | Esf. | Por qué |
| :--- | :--- | :---: | :---: | :--- |
| **K1** 💡 | **Partir `party.js` por dominios** · → J15.1 | A | L | 21.268 líneas. La magia, la mascota, los encargos, el turno enemigo y los tableros con propósito pueden vivir en `party/`, como ya viven `html.js` o `campaign-state.js`. El plan lo pone antes de partir la partida (J4.2) y de jugar con amigos (J6) |
| **K3** 🟡 | **Los pasos que fallan a veces** | A | S | Tres arreglados el 2026-09-26 (el 68, el 190 y el 53). **Queda** el 24 (el contador del jefe), con su diagnóstico puesto |
| **K4** 🟡 | **Errores de las vueltas** | A | S | El error 500 al guardar el chat, que el pegamento dejó apuntado, sigue sin mirar. Y si una vuelta sigue viva (cortada, o de otra sesión), la siguiente en el mismo puerto no arranca: se cierra a mano o se usa `--port` |
| **K5** | **Tres archivos grandes sin pruebas** | A | M | `campaigns.js` (2.245 líneas), `dynamic-context-manager.js` (1.000) y `world-content-browser.js` (674). Solo los tocan las vueltas en el navegador |
| **K7** | **`npm audit`**: 47 vulnerabilidades, una crítica | D | S | Es D1 de [[POR_HACER]]. Mirar solo la crítica, y el resto con el próximo merge de upstream |
| **K8** | **Dos formas de definir un mundo** | D | M | Las plantillas de inicio son código (`starter-templates.js`) y los mundos son paquetes. Es D4 de [[POR_HACER]] (y era la DU7): aplazado hasta que quieras una plantilla fija que la IA no dé |
| **K9** | **Un solo contrato de autor** | A | M | Lo que quedó de U7. [[GEM_CREAR_CAMPANA]] se genera del esquema del motor, pero [[GEM_GUIONISTA]] se escribe a mano, así que cada campo nuevo hay que contarlo dos veces. Que las dos instrucciones salgan del mismo esquema. Toca también J5.5 del plan (el Gem escribe en tu formato o en el del juego) |

**Lo que se queda así a propósito** (de la auditoría técnica del 2026-09-21, ya borrada): la CSP desactivada, jQuery 3.5.1, los secretos en texto plano y el `index.html` de 10.839 líneas son **de upstream**. Tocarlos cuesta un merge en cada actualización, y en uso local de una persona no compensa. Si abres el servidor a tus amigos (J0.9 y J6 del plan), esto se vuelve a mirar. La virtualización del chat y del tablero pediría un rediseño.

---

## 🗄️ 10. Lo que quedaba en los roadmaps archivados

El 2026-09-29 se archivaron seis roadmaps en `wiki/archivo/`. A ninguno le quedaba nada que no esté aquí, en el plan o en [[POR_HACER]]:

| Roadmap | Lo que quedaba | Dónde está ahora |
| :--- | :--- | :--- |
| [[ROADMAP]] (fases A–H) | Nada. Los descansos y los objetivos en el tablero, que su tabla daba a medias, se hicieron después | — |
| [[ROADMAP_MAESTRO]] (el porqué) | Del nivel 1, el extractor, los dos perfiles de conexión y elegir el grupo en vez de escribirlo. Del nivel 6, ver el bucle entero | En el plan: J17 (la IA), J1.6 · J7 · J18.1 (el grupo) y J16 (medir) |
| [[ROADMAP_PEGAMENTO]] (U0–U8) | Los relojes con plazo, los registros de la crónica, los horarios, más duelos, las tarjetas comunes, las plantillas, un solo contrato de autor, los casos escritos, el error 500 y tu semana de prueba | Aquí: T7, T8, T9, T13, H4, K8, K9, T5 y K4. La decisión DU6 es la D11 de [[POR_HACER]]. La semana de prueba, J16.5 del plan |
| [[ROADMAP_PROFUNDIDAD]] (R1–R10) | La cuerda, y las piezas y los casos escritos. R7 y R9 decían 🟡, pero en el código tienen todo lo que pedían | Aquí: T1 y T5 |
| [[ROADMAP_SIN_TOKENS]] (Z0–Z8) | Z4 (sucesos por facción y reputación), Z5 (hilos con fondo), el resto de Z6, Z7 (el Gem escribe frases, charlas y sucesos), las frases sin repetir y 1387 entero sin modelo | En el plan: J10.3, J10.7, J5.5, J8.1, J13, J13.2 y J9.1. Aquí: I2 e I4 |
| [[ROADMAP_COMPENDIO]] (las doce baterías) | Que la pantalla edite y quite un libro entero | Aquí: C6 |

Siguen en `wiki/archivo/` porque el código los cita en sus comentarios (unas 150 veces) y el plan enlaza a varios: explican el porqué de lo que existe. Los comentarios todavía los citan como `wiki/<nombre>.md`; ahora están en `wiki/archivo/<nombre>.md`, con el mismo nombre.

---

## 📚 11. La wiki, puesta en orden

- **2026-09-29.** Seis roadmaps, a `wiki/archivo/`: [[ROADMAP]], [[ROADMAP_MAESTRO]], [[ROADMAP_PEGAMENTO]], [[ROADMAP_PROFUNDIDAD]], [[ROADMAP_SIN_TOKENS]] y [[ROADMAP_COMPENDIO]]. Lo que les quedaba está en la sección 10.
- **2026-09-26.** Siete documentos borrados porque ya estaban minados: el `HOME.md` de la raíz, *IDEAS_200*, *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES*, *PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES*, *DISENO_GENERADOR_MUNDOS_PROFUNDO*, *PROBLEMAS_TECNICOS* y *PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA*. Están en git: `git checkout d9dc871e3 -- <ruta>`. Y nueve planes cerrados, a `wiki/archivo/`: *Mundos vivos*, *Creación*, *Ingesta*, *Juego sin comandos*, *Frontend modo juego*, *Propuestas de mejora* (las dos), *Bucle de juego* y *Plan crear campaña*.

**La regla**: un marcador ([[POR_HACER]]), un plan vivo (hoy [[ROADMAP_SIN_CONEXION]]) y este documento para lo que falta fuera del plan. Un plan que se cierra se archiva el mismo día, y lo que le quede pasa aquí.

---

## 🧭 12. El orden que recomiendo

El orden grande es el del plan, con sus hitos M1–M6. De lo que hay aquí, fuera del plan, haría esto:

| # | Qué | Por qué en este orden |
| :---: | :--- | :--- |
| 1 | **K3 + K4**: el paso 24 y el error 500 | Baratos, y sin ellos no te puedes fiar de una vuelta en rojo |
| 2 | **D11 y luego T9**: los horarios | `hours.js` está escrito y probado; solo falta que decidas y conectarlo |
| 3 | **B6**: el vocabulario de reglas de tablero | Para que tu próxima campaña no acumule pendientes |
| 4 | **T8 + T7**: la crónica y los relojes | Que el narrador del motor recuerde lo mismo que el diario, y que «Lo que viene» lo diga todo |
| 5 | **K9**: un solo contrato de autor | Antes de que el Gem aprenda más bloques (T5, B6) |
| 6 | **I1**: probar la generación real | Tu decisión, y cuesta céntimos. Puede esperar a J17 |

---

## 🚫 13. Lo que no se propone

Decidido por ti. Está aquí para que nadie lo vuelva a proponer sin saberlo.

**Quitadas de las 200 ideas (2026-09-24):** 50 (defecto opcional), 51 (meta personal), 112 (nueva partida+), 133 (desgaste ligero), 154 (punto de guardado), 157 (tamaño de letra y alto contraste), 161 (saltar a sucesos), 165 (medir distancias), 167 (confirmar lo irreversible), 170 (modo foto), 171 (la partida como relato), 196 (logros por mundo), 197 (reto semanal).

**Quitadas en la segunda criba (2026-09-24):** 12 (ruido), 16 (pifia leve), 19 (modo rápido), 60 (carga y mochila), 76 (paredes falsas), 79 (entrar sin ser visto), 80 (descanso corto), 83 (territorio en el mapa), 98 (te ganan el sitio), 99 (cambios de acto), 158 (tablero táctil), 177 (probar un tablero), 194 (paleta por mundo).

**Decisiones de POR_HACER:** D2, no reconciliar los tokens con el proveedor. D3, el registro de combate no sobrevive a una recarga. D5, la magia ligera, que R4 hizo desde el código.

**Decisiones del pegamento (2026-09-25):** DU1–DU5, en lo recomendado. Fuera las herramientas viejas del narrador (salvo «proponer un hecho»); volver a un punto devuelve también el mundo; lo menor, plegado en el chat; la mesa sale sola la primera semana y después avisa; nada de baterías de ideas sueltas. La DU6 sigue abierta (D11 de [[POR_HACER]]) y la DU7 es K8.

**Decisiones de la profundidad (2026-09-26):** DR1–DR7, todas en la opción A. Entre ellas: la magia solo desde el código, cargas por círculo, la mascota apoya sin pelear en serio y el terreno nuevo en código.

**Decisiones sin tokens (2026-09-27):** DZ1–DZ6, con la recomendación. La caja entiende una lista corta de verbos; una voz neutra primero; con proveedor, «Mixto» por defecto; las charlas salen de lo que el motor sabe; sucesos escritos y también generados; un hito de hablar se cumple al empezar a hablar.

**Lo que no haría** (de los roadmaps archivados): conjuros que invente el modelo; las ranuras completas de 5e; una mascota que sea un compañero más; más de cuatro modos con nombre; que el modelo genere tableros, diálogos para guardarlos o lo que revela un personaje; un modelo local para jugar sin conexión; un parser de aventura de texto completo.

---

## ✅ 14. Hecho desde el análisis

Lo que este documento pedía el 2026-09-26 y ya está. Cada cosa, con su módulo, para no rehacerla.

- **T2** · Pedir tregua y llamar refuerzos (2026-09-26): `combat/morale-options.js`, `/tregua sí|no`. Quien huye puede volver con ayuda, por la salida si la hay.
- **T3** · El mundo reacciona a la mascota (2026-09-26): `campaign/pet-reception.js`. Cada oficio tiene sus gustos, y una de cada cinco personas piensa lo contrario.
- **T4** · Precios con la estación, y componentes que escasean donde persiguen la magia (2026-09-26): `campaign/season-market.js`. La facción dice `magia: persigue | tolera | comercia`.
- **T6** · Domar por dato (2026-09-26): manda el campo `domable` del bestiario, del paquete y del guion.
- **T12** · Más enemigos que lanzan conjuros (2026-09-26): el chamán, el nigromante y el aprendiz de mago, sin código.
- **B1** · La altura (2026-09-26): la casilla `^` (`board/heights.js`). Desde arriba se ataca con ventaja.
- **B2** · Las salidas (2026-09-26): la casilla `x` (`board/exits.js`) y `/salir`. Si salen todos, la pelea acaba en huida.
- **C1** · Un segundo mundo escrito, en otra forma (2026-09-29): *La Maldición de Strahd*, desde tu JSON (`wiki/campanas/strahd/`). Costa, ocaso y la pantalla siguen siendo plantilla y semilla; las campañas nuevas entran ahora por el tablón del gremio (J5 del plan).
- **C3** · Siete salas, una por propósito (2026-09-26): el cuartel, el puente y el despacho se sumaron a la cámara, la guarida, el altar y la atalaya.
- **C5** · El paquete de 1387, al día con su guion (2026-09-28, con la ronda 12): los 7 caminos con `cerrado_hasta` se abren al cumplirse su hito.
- **H2** · «Cómo se juega» en la pausa y con `/ayuda` (2026-09-26): `campaign/how-to-play.js`, armado con el modo de la partida.
- **K2** · Las vueltas en tandas (2026-09-28): de 70 minutos a unos 15, sin quitar comprobaciones. `tools/e2e-todo.mjs` lo lanza todo a la vez.
- **K6** · `guion-errors.js` no era código muerto (2026-09-26): lo usa el conversor del guion, y el comprobador de cableado lo dice aparte.

---

## 🔗 Enlaces

- [[ROADMAP_SIN_CONEXION]]: el plan de ahora.
- [[POR_HACER]]: el marcador del día a día.
- Los roadmaps archivados, en `wiki/archivo/`: la sección 10 dice qué les quedaba.
- [[GEM_GUIONISTA]] y [[GEM_CREAR_CAMPANA]]: con lo que se escribe un mundo.
- [[HOME]]: el índice.
