---
title: Roadmap — El pegamento
tags: [roadmap, unificar, estado, tiempo, cronica, narrador, mesa, duelo, casos]
created: 2026-09-25
updated: 2026-09-25
author: DanielJHesseling / Claude Opus 5.5
---

# 🧩 El pegamento: un juego, no doscientos

> **Qué es esto.** El plan para que todo lo construido funcione como **un solo juego**: las 200 ideas de *IDEAS_200*, y también lo que vino antes y quedó suelto (los niveles del [[ROADMAP_MAESTRO]], las fases de [[ROADMAP_MUNDOS_VIVOS]], lo que queda en [[POR_HACER]]). Termina en las tres propuestas de [[PROPUESTAS_BUCLE_DE_JUEGO]], porque las tres necesitan este pegamento debajo.
>
> **La regla de este plan: juntar antes que añadir.** Ninguna fase trae un sistema nuevo suelto. Cada una **junta** cosas que hoy van por separado, **retira** algo que sobra, y **acaba con algo que se ve jugando**. Si una fase solo refactoriza sin que cambie nada en pantalla, está mal cortada.
>
> **Cómo leerlo.** Primero, lo que encontré al auditar, con números comprobados en el código. Luego el orden, las fases, lo que decides tú (**D**) y lo que se queda fuera. Al final, un marcador de números que tienen que bajar.

---

## 📍 Cómo va (2026-09-25)

Hecho en una tanda larga, con tus decisiones en lo recomendado. **Comprobado en el navegador** quiere decir un paso del recorrido que lo hace como lo haría quien juega (`tools/e2e-campaign.mjs`); lo que solo tiene pruebas, se dice.

| Fase | Qué quedó | Comprobado | Lo que falta |
| :--- | :--- | :--- | :--- |
| **U0** · La casa en orden | [[POR_HACER]] cuadrado con el código; «Tu sesión» en la pausa (minutos por escena, mensajes, llamadas, botones) | Paso 60 | **Tu semana de prueba**: eso solo lo puedes hacer tú |
| **U1** · Un solo narrador | Fuera las 8 herramientas viejas, la instrucción en inglés de cada turno, las etiquetas del narrador y la escena adivinada por la prosa. Las banderas son ahora `proponer_hecho`: el motor apunta uno al día, sin repetir | Paso 60 | — |
| **U2** · Un solo estado | El registro del estado (`state-registry.js`) y su comprobador (`check-state-keys.mjs`); el punto de retorno guarda **todo** lo de juego y **el mundo** (en un archivo aparte, para no cargar el chat); `/estado` y el panel desde «Tu sesión» | Paso 61, y el 34 de siempre | — |
| **U3** · Un solo reloj | Un solo paso del tiempo, en etapas ordenadas que no se paran si una falla; las facciones ya no se cuentan aparte; el tablón caduca al pasar el día, no al abrir el gremio; «Lo que viene» abre el diario | Paso 62 | Los horarios de PNJ (P19): ver **DU6** |
| **U4** · Una sola crónica | Las etiquetas del chat, en 10 categorías; la crónica del diario con filtro; el chat pliega lo menor en «y N más»; el resumen de cada acto sale de la crónica; la música del pueblo (187) | Paso 63 (el resumen y la música, solo con pruebas) | Que la memoria del narrador y las estadísticas lean también de la crónica |
| **U5** · La Mesa | La mesa de la semana: asuntos de todos los relojes con lo que pasa si no se atienden, «Cómo os ven» con las siete formas de opinión, la semana que pasó; el mapa en texto con niebla y notas (69 y 70) | Pasos 64 y 66 | — |
| **U6** · Decidir en escena | El Duelo de Palabras: el regateo es un duelo con el tendero, y con cualquier persona del mundo, «Convencer a…» (si cede, os mira mejor; el narrador lo cuenta una vez) | Pasos 55 y 66 | El componente común de tarjetas para las ventanas viejas; más duelos (interrogar, reclutar); P14 |
| **U7** · Una forma de mundo | El conversor del guion avisa de cada campo que no lee (en 1387, 69); `cerrado_hasta` funciona: el camino se abre al cumplirse el hito | Solo pruebas | Las plantillas (**DU7**), los terrenos como datos (P23), un solo contrato de autor |
| **U8** · Despachos y casos | Mandar compañeros sin el héroe desde la mesa; los casos con verdad: se generan con la gente del mundo, las pistas se encuentran preguntando y buscando, hay tablero y se acusa una vez. El narrador nunca sabe quién fue | Pasos 65 y 67; mil casos generados pasan el comprobador | Casos escritos en el guion (`caso:`) para el Gem |

**Dos avisos de lo que salió por el camino:**

- **Los 69 campos de 1387 que el juego no recibía.** Los más importantes: `cambia.aparece` en 13 hitos, `mecanica_pendiente` en 11 tableros (lo que el Gem pidió y el motor no tiene) y el destino de las escoltas (`objetivo.a`, `objetivo.pnj`). Algunos son inofensivos (listas repetidas en la localidad, nombres de tablero que se sustituyen por el del encuentro). Salen al pasar el conversor.
- **Un error 500 al guardar el chat** aparece en la consola del recorrido desde antes de este plan. No lo he causado yo, pero sigue ahí.

---

## 🔍 Lo que encontré al auditar

Todo esto está comprobado en el código a 2026-09-25, no estimado.

| Qué | Cuántos | Dónde se nota |
| :--- | :---: | :--- |
| **Claves sueltas en la partida** (`chat_metadata`), cada una con su dueño implícito | **62** | Nadie sabe cuáles son todas. Por eso pasa lo de la fila siguiente |
| **Lo que guarda un punto de retorno** (`/punto`) | **7 cosas** | Guarda el grupo, el combate, el calendario, los vínculos, el mapa y dónde estáis (sitio y tablero). **Ni el hilo, ni el tablón, ni la aprobación, las actitudes, lo que os buscan o el almacén.** Volver a un punto deja el mundo a medias |
| **Etiquetas de mensaje** en el chat: `[GREMIO]`, `[POSADA]`, `[RIVALES]`, `[HILO]`… | **43** | El chat es un río de avisos de muchos sistemas, sin categorías ni filtro |
| **Relojes**: facciones, plazos del tablón, plazos de hitos, pistas que escalan, deuda, la cuenta del viernes, rivales, hartos, buscados, estaciones, fiestas, heridas, banquillo, aprendizaje, cartas, pienso, surtido de la tienda, necesidades | **18** | Cada uno avisa por su cuenta; **no hay un sitio que diga «lo que viene»** |
| **Caminos por los que pasa el tiempo** | **3 o más** | El día (`onTimePassed`), la semana (`chargeWeek`, con sus ganchos en fila) y las facciones con su propio contador aparte (`factionDaysDue`); los plazos del tablón caducan en otro sitio |
| **Formas de que el mundo os mire bien o mal** | **7** | Reputación del gremio, postura de cada facción, fama por sitio, fortuna del sitio, lo que os buscan, actitud de cada PNJ, y vínculo más aprobación de cada compañero. Cada una se ve en una pantalla distinta |
| **Registros de lo que pasó** | **10 o más** | Hazañas, recuerdos, hechos del mundo, resúmenes por acto, estadísticas, dados, diario, noticias pendientes, rumores oídos, cartas, tumbas… Cada uno apunta a su manera |
| **Sistemas de misiones** | **2** | El del motor (hilo, tablón, encargos personales) y **uno antiguo que lleva el narrador**: `dnd_manage_quest` apunta misiones en `activeQuests` y entran al prompt como `[SYSTEM: ACTIVE QUESTS]`. Choca con la regla de que el narrador no crea estado |
| **Familias de herramientas del narrador** | **2** | Las antiguas (8, en `dynamic-context-manager.js`: misiones, banderas, estado de escena, sitio) escriben estado por su cuenta; las nuevas (4, en `party.js`: dar un objeto, cambiar una actitud, pedir una tirada, proponer un sitio) proponen y **el motor decide** |
| **Quién decide la escena** | **2** | El director de escenas del motor, y la máquina de estados antigua, que lee la prosa del modelo. El director ya no la escucha, a propósito, pero sigue cargada |
| **Formas de definir un mundo** | **2** | Las plantillas de inicio son **código** (`starter-templates.js`, ahora seis). Los mundos precreados son **paquetes** (datos) |
| **Lo que el guion dice y el conversor no lee** | **?** | `cerrado_hasta` se ignora en silencio. Y nada avisa de los demás campos que se ignoran, así que no se sabe cuántos hay |
| **Comandos** | **46** | Solo en `party.js`. La mayoría ya tienen botón; algunos son la única puerta a algo |
| **[[POR_HACER]] desfasado** | **6 o más** | A14 (servicios) sigue «en diseño», y D7 (posturas) y D8 (bancarrota) siguen abiertas, pero están hechas; P16, P18 y P24 también. A13, P6 y P25 están, al menos, a medias |

**Lo que no está roto:** el comprobador de conexiones dice 205 de 206 módulos cargados; el que falta, `guion-errors.js`, solo lo usan las pruebas. **No faltan piezas: falta que se hablen entre ellas.**

---

## 🧭 El orden

| Orden | Fase | Qué junta | Esf. | Qué se ve al terminar |
| :---: | :--- | :--- | :---: | :--- |
| 0 | **U0** · La casa en orden | Documentos con la realidad, y medir antes de tocar | S | [[POR_HACER]] dice la verdad; un diario de sesión |
| 1 | **U1** · Un solo narrador | Las dos familias de herramientas y los dos sistemas de misiones | M | El narrador ya no apunta misiones por su cuenta; un bloque menos en el prompt |
| 2 | **U2** · Un solo estado | Las 62 claves, en un registro | M–L | El punto de retorno devuelve **todo**; un panel con lo que el motor da por cierto |
| 3 | **U3** · Un solo reloj | Los 18 relojes y los 3 caminos del tiempo | M | «Lo que viene»: una lista de plazos con fecha |
| 4 | **U4** · Una sola crónica | Las 43 etiquetas y los 10 registros | L | Un diario con categorías y filtro; el chat con menos ruido |
| 5 | **U5** · La Mesa de la Semana | Los relojes, las opiniones y las decisiones repartidas | L | La semana en una mesa, con lo que dejas caer y su crónica |
| 6 | **U6** · Una sola forma de decidir en escena | Las ventanas sueltas, en un componente de tarjetas; y lo social, en el Duelo | L | El Duelo de Palabras, empezando por regatear |
| 7 | **U7** · Una sola forma de mundo | Plantillas y paquetes; el guion y lo que se ignora | M | Las plantillas son datos; el conversor avisa de todo lo que no lee |
| 8 | **U8** · Los despachos y los casos | Todo lo anterior, usado a la vez | L+ | Mandar compañeros sin el héroe; misterios con una verdad fija |

**Por qué este orden:**

- **U1 primero** porque es barato, arregla una regla que hoy se incumple y ahorra tokens desde el primer día.
- **U2, U3 y U4 son los cimientos.** La Mesa necesita saber qué hay (estado), qué viene (reloj) y qué pasó (crónica). Hacer la Mesa sin ellos sería un **adaptador número 19** encima de 18 sistemas.
- **La U7 puede ir en cualquier momento**: no depende de nadie. Tiene que estar antes de la U8, porque los casos se escriben en el guion.

Esfuerzo: **S**, una sesión · **M**, varias · **L**, una fase entera · **L+**, más de una. En total, varios meses a nuestro ritmo; **el orden importa más que la fecha**.

---

## 🧹 U0 · La casa en orden · `S`

> **El problema.** [[POR_HACER]] dice «en diseño» de cosas que están hechas, y hay tres documentos que se llaman plan. Y lo más importante: **no sabemos todavía dónde se aburre quien juega**, solo dónde creo yo que se aburre.

**Qué se hace**

1. **Cuadrar [[POR_HACER]] con el código.** Cerrar A14, D7 y D8, y marcar las P hechas (P16, P18, P24), cada una con el módulo que la hace. Revisar A13, P6 y P25, que están a medias. Lo que no se pueda comprobar, se queda abierto con una nota.
2. **Una sola cabecera de planes.** [[ROADMAP_MAESTRO]] se queda como **el porqué** (los cuatro relojes). Este documento pasa a ser **el plan**. [[ROADMAP_MUNDOS_VIVOS]] se queda como **el acta** de lo construido.
3. **El diario de sesión**, local y a 0 tokens: minutos por actividad (combate, viaje, pueblo, chat), llamadas al modelo y **cuántas veces se escribió en el chat sin que hubiera un botón para eso**. El medidor de prompt ya sabe lo que cuesta un turno; esto suma la sesión.
4. **Tu semana de prueba.** Una semana entera del juego, apuntando dónde te aburres, dónde no sabes qué hacer y dónde escribes porque no había otra forma. **Puede reordenar todo lo que sigue.**

**Se ve al terminar:** en la pausa, «Tu sesión», con minutos y llamadas.
**Hecho cuando:** [[POR_HACER]] no dice nada que el código desmienta; el diario de sesión se ve en el navegador.

---

## 🎙️ U1 · Un solo narrador · `M`

> **El problema.** La regla de la casa es *el motor decide, el modelo cuenta*. Pero siguen cargadas las herramientas antiguas con las que el narrador **apunta misiones, pone banderas, cambia la escena y el sitio** sin que el motor se entere. Su lista de misiones entra en cada prompt como `[SYSTEM: ACTIVE QUESTS]`, a la vez que el motor manda la suya en el bloque de memoria. **Dos verdades sobre lo que tenéis entre manos**, y una la escribe quien no debe.

**Qué se hace**

1. **Un solo catálogo de herramientas del narrador**, todas con la forma de las nuevas: el narrador **propone**, el motor comprueba y decide, con límites. `cambiar_actitud` (140) es el modelo a seguir: un paso, uno por persona y día.
2. **Retirar o convertir** las antiguas (ver **DU1**):
   - **`dnd_manage_quest`** se retira. Lo que tenéis entre manos ya lo dice el motor (el foco del hilo y el encargo aceptado).
   - **`dnd_set_flag`** se retira, o se convierte en «proponer un hecho», que pasaría a los hechos del mundo con límites.
   - **`dnd_update_state`** se retira. La escena la decide el director del motor, que ya no escucha a esta.
   - **`dnd_set_location`** se retira. Para moverse ya está `proponer_sitio`, o el viaje.
   - **`dnd_get_campaign_status`** se deja solo para leer, o se retira si el prompt ya lo lleva todo.
3. **El bloque `quests` del prompt** pasa a salir del motor. Si ya va en el de memoria, se quita.
4. **La máquina de estados antigua** (la que adivina «combate / exploración / social» por la prosa) se apaga donde el director del motor ya decide.

**Tokens.** Un bloque menos en cada prompt, y menos definiciones de herramienta. Si el proveedor tiene las herramientas activadas, **sus definiciones viajan en cada llamada**, se usen o no.

**Se ve al terminar:** en `/prompt`, un bloque menos y menos herramientas. En partida, el narrador ya no crea misiones que el diario no conoce.
**Hecho cuando:** `check-prompt-shape` registra la forma nueva (a propósito, con `--update`), y el recorrido del navegador sigue en verde.

---

## 🗃️ U2 · Un solo estado de partida · `M–L`

> **El problema.** Sesenta y dos claves, cada una declarada donde hizo falta. Nadie tiene la lista entera, y eso se nota en el primer sitio que la necesita: **el punto de retorno guarda 7 cosas de las muchas que forman una partida**. Pasará lo mismo en cada cosa nueva que necesite «todo»: veteranos, la Mesa, un panel de depuración.

**Qué se hace**

1. **Un registro del estado** (`campaign/state-registry.js`, puro). Cada clave, declarada una vez, con:
   - quién es su dueño (qué módulo la lee y la escribe);
   - dónde vive: la partida, el mundo o solo este navegador;
   - si entra en el punto de retorno;
   - si viaja con un veterano (179);
   - su versión, para migrar sin romper partidas viejas.
2. **Un comprobador**, como el de conexiones: `tools/check-state-keys.mjs` falla si alguien escribe en `chat_metadata` una clave que no está en el registro. Es lo que impide que vuelva a pasar.
3. **El punto de retorno lee el registro** y guarda todo lo marcado. Lo que vive en el mundo (facciones, fortuna, gente) lo decides tú en **DU2**.
4. **El panel del estado** (era la P5): una vista, sacada del registro, con todo lo que el motor da por cierto. Es el complemento de `/prompt`: uno enseña lo que se manda al modelo, el otro lo que el juego cree.

**Se ve al terminar:** guardas un punto, aceptas un encargo, cambias una actitud, vuelves al punto, **y todo está como estaba**.
**Hecho cuando:** el comprobador pasa con las 62 claves registradas, y un paso nuevo del recorrido guarda, cambia cinco cosas de sistemas distintos, vuelve y comprueba las cinco.

---

## ⏳ U3 · Un solo reloj · `M`

> **El problema.** Dieciocho relojes y al menos tres caminos por los que pasa el tiempo. Los ganchos de la semana van en fila, dentro de una función, en el orden en que se fueron añadiendo. Las facciones tienen su propio contador aparte. **Ninguno puede decir qué viene**, porque ninguno sabe de los demás.

**Qué se hace**

1. **Un solo paso del tiempo**: una lista ordenada de etapas (curar, comer, facciones, plazos, hilo, cartas, fiestas… y las de la semana: cobrar, deuda, gente, hartos, rivales, buscados). Cada etapa se declara una vez y **devuelve sucesos**, no líneas de chat. El orden se escribe una vez y se prueba.
2. **Cada reloj dice su próximo plazo.** Una función común, «¿cuándo te toca y qué pasa entonces?», implementada por cada dueño. De ahí sale **«lo que viene»**.
3. **Determinismo comprobado**: misma semilla y mismos días, mismos sucesos. Es una prueba sola, y protege todo lo demás.
4. **Horarios de PNJ (P19)**, casi gratis encima de esto: el herrero en la fragua por la mañana y en la taberna por la noche. Son datos más una etapa.

**Se ve al terminar:** en el diario y en el reloj de pantalla, **«Lo que viene»**: «El molino cae en 5 días · El viernes debéis 140 · El favor vence el jueves · Invierno en 12 días».
**Hecho cuando:** los tres caminos son uno, «lo que viene» se ve en el navegador, y la prueba de determinismo pasa.

---

## 📜 U4 · Una sola crónica · `L`

> **El problema.** Cuarenta y tres etiquetas en el chat y diez registros distintos de lo que pasó. El diario, la memoria del narrador, el resumen por acto y las estadísticas **leen cada uno de un sitio distinto**. Y el chat, con tanto aviso, se vuelve ruido: lo importante se pierde entre lo pequeño.

**Qué se hace**

1. **Un suceso con forma común**: día, franja, categoría, quién, dónde, el texto, y si lo lee el modelo o no. Las 43 etiquetas se quedan en **unas ocho categorías**: combate, grupo, mundo, hilo, gremio, comercio, viaje y campamento.
2. **Todo sale de la crónica**: la línea del chat (el mismo texto que hoy), el diario (100), el bloque de memoria, el resumen por acto (143), las estadísticas (200), las noticias (82). Se migra **sistema a sistema**, no de golpe: lo nuevo entra ya por aquí, y lo viejo se pasa cuando se toca.
3. **El chat con menos ruido** (ver **DU3**): lo importante, en su línea; lo menor, plegado en «y 6 cosas más» que se abre con un clic. Todo sigue en el diario.
4. **Música por contexto (187, aparcada)**: si los sucesos tienen categoría, la música puede escucharla. Pasa de idea aparcada a unas líneas.

**Se ve al terminar:** el diario con pestañas por categoría y un filtro; el chat, con avisos plegados.
**Hecho cuando:** diario, memoria y resumen por acto leen de la crónica, y el recorrido sigue en verde. Lo busca por etiqueta, así que el texto de las líneas no puede cambiar.

---

## 🗺️ U5 · La Mesa de la Semana · `L`

> **El problema.** Las decisiones están en ocho sitios, y la semana se paga pero no se decide. Es la Propuesta 1 de [[PROPUESTAS_BUCLE_DE_JUEGO]], y ahora ya tiene cimientos: el estado (U2) dice qué hay, el reloj (U3) dice qué viene y la crónica (U4) cuenta lo que pasó.

**Qué se hace**

1. **Los asuntos**, sacados de «lo que viene» (U3): cuatro o cinco, cada uno con qué, dónde, días de camino, premio, reloj y qué pasa si no se atiende. Son sus fases F1 y F2: la vista, y lo que dejas caer, **dicho con su motivo**.
2. **«Cómo os ven»**, en una sección de la mesa: las **siete formas de opinión** juntas, cada una en su escala y con una línea que diga qué cambia. Es el pegamento de la reputación: no se funden (cada una mide otra cosa), pero se ven en un solo sitio.
3. **La crónica de la semana** (su F4), escrita desde la crónica (U4) a 0 tokens, y **lo que viene** como gancho. Si quieres, el narrador la cuenta en una llamada.
4. **El mapa como texto** (69 y 70, aparcadas): la vista previa del mundo (175) ya pinta los sitios y sus caminos. Sitios sin visitar en gris y notas propias en cada uno **ya no necesitan un mapa dibujado**.

**Se ve al terminar:** cada semana abre con la mesa y cierra con su crónica.
**Hecho cuando:** un paso del recorrido juega dos semanas: atiende un asunto, deja caer otro y comprueba que la consecuencia se ve con su motivo.

---

## 🃏 U6 · Una sola forma de decidir en escena · `L`

> **El problema.** Cada ventana del juego se hizo en su momento, con su estilo y su prefijo de clases: el tablón, las maniobras, los servicios, la ronda con tema, el campamento, rehacerse en el templo, compartir el mundo, los veteranos, el editor de hitos… **Funcionan, pero no parecen el mismo juego**. Y lo social sigue siendo una tirada suelta.

**Qué se hace**

1. **Un componente de tarjetas de decisión**, en texto, sin arte. Cada tarjeta lleva el título, el detalle, el coste (en oro o en días), el porqué si está apagada, y a quién va si hay que elegir. Las ventanas existentes pasan a usarlo **una a una**, empezando por las que más se abren.
2. **El Duelo de Palabras**, la Propuesta 3, construido sobre ese componente, **empezando por el regateo** de la tienda.
3. **Los verbos sociales se juntan en el duelo**:
   - la ficha que ofrece una tirada al leer lo que escribes (137) es una carta;
   - sonsacar (110) es una jugada;
   - el cambio de actitud (140) es un resultado;
   - el soborno es una carta de oro.

   Hoy son cuatro puertas; pasan a ser una.
4. **Confidentes que no van contigo (P14)**: con actitud y duelos, la tabernera o el herrero pueden tener su propio vínculo sin pelear a tu lado.

**Se ve al terminar:** regatear es un duelo de tres rondas; las ventanas principales se parecen entre sí.
**Hecho cuando:** el regateo como duelo se juega en el navegador, y **una conversación importante cuesta una llamada** en lugar de varias (lo mide el diario de sesión de la U0).

---

## 🌍 U7 · Una sola forma de mundo · `M`

> **El problema.** Un mundo se define de dos formas: las plantillas de inicio son código y los mundos precreados son paquetes. Y el camino de tu guion al juego pierde cosas sin decirlo, como `cerrado_hasta`.

**Qué se hace**

1. **Las plantillas pasan a ser paquetes**, el mismo formato que 1387. Resuelve la D4 de [[POR_HACER]] juntando las dos cosas en lugar de elegir entre ellas, y cumple tu *«sin tocar código»* también al empezar partida.
2. **El conversor del guion avisa de todo lo que no lee**, campo a campo, en lugar de ignorarlo. Y se arregla `cerrado_hasta`.
3. **Los tipos de terreno como datos (P23)**, en el paquete de reglas: el último sitio donde añadir algo exige tocar código.
4. **Un solo contrato de autor**: las instrucciones de los dos Gems ([[GEM_GUIONISTA]] y [[GEM_CREAR_CAMPANA]]) salen del mismo esquema, y lo que se añada en la U8 (casos y duelos escritos) entra por ahí.

**Se ve al terminar:** «Nueva partida» ofrece las plantillas leídas de archivos; pegar un guion con un campo que no existe da un aviso con su nombre.
**Hecho cuando:** `starter-templates.js` ya no tiene mundos dentro, y una prueba convierte un guion con un campo inventado y comprueba que lo avisa.

---

## 🔎 U8 · Los despachos y los casos · `L+`

> Es el final del bucle: las propuestas 1 (su F3) y 2 de [[PROPUESTAS_BUCLE_DE_JUEGO]], que ahora **no piden pegamento propio** porque todo lo que tocan ya está unido.

**Qué se hace**

1. **Los despachos**: mandar compañeros sin el héroe a un asunto de la mesa. Usan cinco cosas que ya están unidas en las fases anteriores:
   - el banquillo (42);
   - la mortalidad;
   - el vínculo y la aprobación;
   - la crónica, donde se cuenta el resultado;
   - el reloj, que dice cuándo vuelven.
2. **Casos con verdad**: el generador de la verdad, las pistas como hechos y el comprobador de que se pueden resolver, sobre cinco piezas ya unidas:
   - el estado (U2), que guarda el caso;
   - el reloj (U3), para el culpable que huye;
   - la crónica (U4), para las pistas halladas;
   - la mesa (U5), donde aparece como asunto;
   - el duelo (U6), para interrogar.

   Más `caso:` en el guion (U7).

**Se ve al terminar:** mandas a Bran y a Kael a escoltar mientras vas a la cueva; un molinero aparece ahogado y lo que encuentras apunta a alguien.
**Hecho cuando:** está en las fases de cada propuesta, con su recorrido en el navegador.

---

## 🟠 D — Lo que decides tú

> ✅ **Decididas las cinco el 2026-09-25: lo recomendado** («hazlo recomendado»). La columna de la derecha es ya lo que se hace.

| ID | La pregunta | Opciones | Decidido |
| :--- | :--- | :--- | :--- |
| **DU1** | Las herramientas antiguas del narrador (misiones, banderas, escena, sitio) | **A**: quitarlas · **B**: convertirlas en propuestas que el motor valida | **A**, salvo `dnd_set_flag`, que pasaría a **B** como «proponer un hecho». Todo lo demás ya lo hace el motor, y mejor |
| **DU2** | ¿Volver a un punto devuelve también el mundo (facciones, fortuna, gente)? | **A**: sí, todo · **B**: solo la partida; el mundo sigue su curso | **A**. Si no, vuelves a antes de que Vane tomara el molino y el molino sigue siendo de Vane. Cuesta guardar una copia del mundo por punto, y hay como mucho 5 |
| **DU3** | El chat, con la crónica: ¿todos los avisos o solo los importantes? | **A**: todos, como hoy · **B**: lo importante en su línea y lo menor plegado · **C**: lo menor solo en el diario | **B**. Nada se pierde y el chat se lee |
| **DU4** | La Mesa, ¿obliga o invita? | **A**: sale sola y hay que cerrarla · **B**: un aviso en la barra y se abre si quieres | **A la primera semana y B después**, con un interruptor en la pausa |
| **DU5** | ¿Seguimos con baterías de ideas sueltas mientras se hace esto? | **A**: no, hasta la U5 · **B**: sí, pequeñas | **A**. Cada idea suelta es un sistema más que habría que pegar después |
| **DU6** | Los horarios de los PNJ (P19): ¿deciden cuándo se puede hablar con alguien? | **A**: sí, de noche el herrero no está en la fragua · **B**: solo informan de dónde está cada uno | **Pendiente, recomiendo B.** Con A, jugar de noche puede dejarte sin nadie con quien hablar, y eso se nota como un fallo, no como un mundo vivo |
| **DU7** | ¿Las seis plantillas de inicio pasan a ser paquetes? | **A**: sí, las seis a archivos · **B**: se quedan en código; lo nuevo, en paquetes | **Pendiente, recomiendo B.** Un mundo nuevo ya se añade como paquete sin tocar código; convertir las seis es mucho cambio para lo que da |

---

## 🗂️ Lo que se queda fuera del pegamento

No es pegamento; es profundidad. Se hace **después**, o cuando una fase lo pida:

| Qué | De dónde viene | Por qué espera |
| :--- | :--- | :--- |
| **Oleadas de refuerzos** y **fases de jefe** | P21 y P22 | El combate es lo más fuerte del juego; no es donde falta pegamento |
| **Interactuables en el tablero** (palancas, cofres, barricadas) | P20 | Igual; y con los tipos de terreno como datos (U7) se hacen sin tocar código |
| **El extractor** del Nivel 1: que el tablero siga a la conversación | [[ROADMAP_MAESTRO]] | Tras la U1 queda claro qué propone el narrador y qué no. Puede que las herramientas nuevas lo cubran y no haga falta |
| **Generar escenarios y enemigos con IA** | P1 y P3 | Cuestan llamadas; mejor cuando la U0 diga cuánto se gasta de verdad |
| **Paquetes de reglas de ejemplo** | P4 | Contenido, no pegamento |
| **Temporadas con legado** | [[PROPUESTAS_BUCLE_DE_JUEGO]] | Se parece a la 112, que quitaste |

---

## 📊 El marcador del pegamento

Números que tienen que bajar, o llegar a un sitio. Se actualizan al cerrar cada fase.

| Qué | Antes | Ahora | Meta | Fase |
| :--- | :---: | :---: | :---: | :---: |
| Sistemas de misiones | 2 | **1** | 1 | U1 ✅ |
| Familias de herramientas del narrador | 2 | **1** | 1 | U1 ✅ |
| Claves de la partida registradas | 0 de 62 | **78 de 78** | todas | U2 ✅ |
| Lo que devuelve un punto de retorno | 7 cosas | **todo lo de juego, y el mundo** | todo lo registrado | U2 ✅ |
| Caminos por los que pasa el tiempo | 3 o más | **1** | 1 | U3 ✅ |
| Relojes que dicen su próximo plazo | 0 de 18 | **9** | 18 | U3 🟡 |
| Etiquetas de mensaje | 43 | **10 categorías** | unas 8 categorías | U4 ✅ |
| Registros que leen de la crónica | 0 | **3** (diario, mesa, resumen del acto) | todos | U4 🟡 |
| Sitios donde se decide la semana | unos 8 | **1, la mesa** | 1 | U5 ✅ |
| Formas de definir un mundo | 2 | 2 | 1 | U7 · DU7 |
| Campos del guion ignorados en silencio | ? | **0** (se avisan: 69 en 1387) | 0 | U7 ✅ |
| Llamadas por conversación importante | varias | **1** (el regateo, 0) | 1 | U6 ✅ |

---

## 🔗 Enlaces

- [[ROADMAP_PROFUNDIDAD]]: lo que vino después (hecho): modos, el taller en pestañas, la magia desde el código, la mascota y tableros con intención.
- [[LO_QUE_FALTA]]: lo que queda, incluidos U3 y U4 de aquí (T7 y T8).
- [[PROPUESTAS_BUCLE_DE_JUEGO]] (archivo): el análisis del bucle y las tres propuestas que este plan prepara.
- [[ROADMAP_MAESTRO]]: los cuatro relojes y por qué querrías jugar mañana. Se queda como el porqué.
- [[ROADMAP_MUNDOS_VIVOS]] (archivo): el acta de lo construido, batería a batería, con las 200 ideas hechas.
- [[POR_HACER]]: el marcador de tareas sueltas, que la U0 pone al día.
