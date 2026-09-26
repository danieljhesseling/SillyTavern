---
title: Roadmap — Profundidad
tags: [roadmap, profundidad, modos, taller, tableros, habilidades, magia, mascota, sinergia]
created: 2026-09-26
updated: 2026-09-26
author: DanielJHesseling / Claude Opus 5.5
---

# 🌳 Profundidad: más hondo, no más ancho

> **Qué es esto.** El plan que sigue a [[ROADMAP_PEGAMENTO]]. El pegamento hizo que lo construido se hablara entre sí; esto le da **fondo**: que cada cosa que ya existe tenga más decisiones dentro, y que lo nuevo (la magia, la mascota, los modos) **se enganche a lo que hay** en vez de colgarse al lado.
>
> **De dónde sale.** De tus ideas del 2026-09-26 —tableros mejor generados, habilidades con más oficio, magia que solo se crea en el código, una mascota que comenta la historia, modos de juego para no ahogarse en parámetros, empezar un mundo ya hecho, y el taller en pestañas en vez de en pasos— y de un repaso del código hecho ese día. Lo que es un hecho del código, lo digo con el archivo; lo que es opinión, lo digo como opinión.
>
> **Las reglas que respeto.** El motor decide, el modelo cuenta. Tope de unos 5 € de tokens. Nada de arte: todo es texto, tarjetas, casillas y números. Y la que pediste para la magia: **solo existe la que está escrita en el código**.

---

## 📍 Cómo va (2026-09-26)

Las siete decisiones están tomadas, todas en la opción A (DR1 a DR7, en la sección 5).

| Fase | Estado | Qué hay |
| :--- | :---: | :--- |
| **R1** · Modos y partida rápida | ✅ | `rules/modes.js` (seis letras, tres modos, «A tu medida»), `/modo` y la pausa, lo apagado no sale (etapas del tiempo, «Lo que viene», la mesa, la cuenta, los casos), el historial de modos y «de hierro» en el salón de la fama, «Partida rápida» en el título y tres héroes hechos por mundo (`campaign/premade-heroes.js`, `heroes` en `mundos.json`) |
| **R2** · El taller en pestañas | ✅ | Trece pestañas con su marca (✓ cambiado · • como viene · ⚠ no cuadra), «Crear y jugar» desde cualquiera, la pestaña de jugabilidad con el selector de modos. Y un fallo viejo arreglado: «Cancelar» creaba la campaña si ya habías elegido mundo |
| **R3** · Habilidades con oficio | ✅ | Áreas (`rules/area.js`), elementos que tocan el tablero (`rules/tags.js`), agua, hielo y maleza, catorce técnicas nuevas, el tercer paso de cada rama enseña algo, usos fuera del combate (`rules/field-uses.js`), jugadas en pareja (`rules/pair-moves.js`) y **estados que pesan** (cegado, asustado, envenenado, invisible, dormido pierde el turno). Y otro fallo viejo: las habilidades de clase del héroe inicial no llegaban nunca a la barra de combate |
| **R4** · La magia desde el código | ✅ | El grimorio (`rules/grimoire.js`, 25 conjuros, siete escuelas, cargas 3/2/1 que vuelven con el descanso largo, componentes que se gastan), `/grimorio`, hablar con los muertos, pergaminos y varitas (`rules/magic-items.js`, `/pergamino`), la magia que se ve (crimen, el que manda en el sitio, la aprobación), la línea de «lo que sabéis» para el narrador, y los datos que intentan colar un conjuro se rechazan |
| **R5** · La mascota | ✅ | `campaign/pet.js`: ocho especies, cinco caracteres, vínculo propio, comentarios a 0 tokens, acariciar y dar de comer, apoyo en el tablero (avisar, distraer, rastrear), trucos al crecer el vínculo, domar bestias marcadas, `/mascota` y la pausa. Y desde el 2026-09-26, la gente con oficio reacciona a ella al verla (T3 de [[LO_QUE_FALTA]]) y un héroe hecho puede llegar con la suya (T5) |
| **R6** · Tableros con intención | 🟡 | `world-builder/board-intent.js`: el propósito manda en la forma (seis clases de encargo), presupuesto de encuentro, adorno por sitio, trampas puestas por el generador, el objetivo en la sala más lejana (con puerta con llave en un robo), oleadas al aguantar, emboscadas al escoltar, barriles que revientan con fuego, cofres que se abren pulsándolos, jefes con fases (`combat/boss-phases.js`), tres salas escritas por propósito y el comprobador de que es divertido (150 semillas por propósito en las pruebas). Desde el 2026-09-26, también la altura (`^`), las salidas (`x`), la palanca (`P`) y la barricada (`=`) (B1, B2, T1 y B3 de [[LO_QUE_FALTA]]). **Falta:** la cuerda |
| **R7** · Enemigos con cabeza | 🟡 | `combat/enemy-roles.js`: tanque, tirador, sanador y líder; tácticas por bando dichas en voz alta; el líder empuja a los suyos; con el líder caído, los malheridos huyen; la némesis (`campaign/nemesis.js`) vuelve más fuerte en un encargo y se acaba cuando cae. Desde el 2026-09-26, la tregua y los refuerzos (T2 de [[LO_QUE_FALTA]]), y el tirador que sube a lo alto (B1) |
| **R8** · Compañeros con arco | ✅ | `campaign/companion-arcs.js`: el encargo personal cumplido da un rasgo único, los confidentes del mundo hacen favores (descuento, noche gratis, aviso), los que se fueron vuelven cambiados, y la magia oscura entra en la aprobación |
| **R9** · El mundo que responde | 🟡 | `campaign/world-echoes.js`: la memoria del narrador lee de la crónica, los rumores cuentan lo que hicisteis, las facciones reaccionan a la magia y al crimen. Desde el 2026-09-26, los precios con la estación y los componentes que no se venden donde persiguen la magia (T4 de [[LO_QUE_FALTA]]) |
| **R10** · Herramientas para ti | 🟡 | El Gem sabe de áreas, elementos, terreno nuevo, el grimorio y los héroes hechos (`heroes` en el paquete y en el conversor), `/grimorio todo` enseña toda la magia que existe, y el comprobador de densidad mira héroes, bestias domables y magia en los datos. Desde el 2026-09-26, la mascota del héroe hecho (T5). **Faltan:** las piezas y los casos escritos |

Dos fallos viejos más, encontrados por el camino: las reglas de una campaña nueva no se aplicaban hasta recargar, y el maestro se quedaba sin nada que enseñar.

---

## 🔍 1. Lo que hay hoy, mirado de cerca

### 1.1 Los tableros

| Qué | Cómo está | Dónde |
| :--- | :--- | :--- |
| **Formas** | Cuatro algoritmos: salas (BSP con pasillos en L), cueva, campamento y templo. Tres tamaños (14×10, 20×14, 26×18) | `world-builder/dungeon-generator.js`, `shapes.js` |
| **Cobertura** | Entre el 8 % y el 15 % de las casillas, en columnas sueltas | `shapes.js` (`COVER_BUDGET`) |
| **Salas escritas** | Hasta dos salas hechas a mano, estampadas dentro | `stampWritten` |
| **Estado del sitio** | Más cobertura o más terreno difícil según cómo esté el sitio (arrasado, abandonado…) | `applyState` |
| **Niveles** | Encargos grandes con dos niveles y escalera | `board/dungeon-levels.js` |
| **Terreno** | Ocho tipos: suelo, muro, difícil, media cobertura, tres cuartos, puerta, precipicio, escalera. Más el fuego que se extiende | `board/terrain.js`, `living-terrain.js` |
| **Trampas** | Existen, con su aviso, su disparador y su efecto | `board/hazards.js` |
| **Enemigos** | **Uno por sala, elegido al azar del bestiario**, en una casilla al azar | `generateBoard` |

**Lo que falta, dicho claro:**

- **El generador no sabe para qué es el tablero.** Una escolta, un robo y una caza salen con la misma forma; solo cambia el objetivo.
- **No pone trampas.** El módulo de trampas existe y lo usan los tableros escritos, pero el generador **no coloca ninguna**.
- **Los enemigos no tienen presupuesto.** Uno por sala, sin contar su dificultad: un tablero puede salir con tres lobos o con tres ogros según el dado. Es la idea 83 de [[ALGORITMOS_GENERACION]], sin hacer.
- **No hay agua, altura, oscuridad ni cosas que tocar** (palancas, cofres, barriles). Todo lo que decide una pelea es muro, cobertura y distancia.
- **No se comprueba que sea divertido**, solo que se pueda recorrer: nada mira si hay dos caminos, un cuello de botella o si el grupo empieza a tiro.

### 1.2 Las habilidades

- **La capa ligera** (la decisión D5 de [[POR_HACER]]): cada habilidad es una fila con coste (acción, adicional, libre), recurso (a voluntad, descanso corto, descanso largo), objetivo (enemigo, aliado, uno mismo), cómo se resuelve (automático, ataque, salvación) y qué hace (daño, cura, estado). En `rules/abilities.js`.
- **Hay 25**, en `public/compendio/habilidades.json`: *Embate*, *Furia*, *Ataque furtivo*, *Curar heridas*, *Rayo de fuego*, *Sueño pesado*, *Zarzas*, *Forma de bestia*… Hay **10 clases** y **39 estados**.
- **Los enemigos también las usan**, con reglas que se pueden leer (curar primero, lo gordo cuando llega). En `combat/enemy-abilities.js`.
- **Se aprenden** subiendo de nivel, con quien enseña en los pueblos (54) y con el árbol por clase (48). Pero **el árbol da números, no habilidades**.

**Lo que falta:**

- **Todo es a un solo objetivo.** No hay áreas, líneas ni conos, aunque el tablero es una cuadrícula que las pide.
- **Nada interactúa con nada.** El *Rayo de fuego* no prende las cajas aunque el fuego ya se extiende solo (23). Las *Zarzas* no son terreno difícil. La lluvia no apaga nada lanzado.
- **Fuera del combate casi no existen.** *Leer el rastro* no ayuda a viajar, *Mano de ganzúa* no abre las cerraduras de la idea 77, y la *Burla que escuece* no es una carta del Duelo de Palabras.
- **Pocas por clase**: dos o tres cada una.

### 1.3 La magia

- **Existe, pero como datos sueltos**: *Rayo de fuego*, *Escudo arcano*, *Curar heridas*, *Bendición*, *Luz severa*, *Sueño pesado*, *Zarzas*… son filas del mismo catálogo que *Embate*.
- **Hoy cualquiera puede crear magia sin código**: el paquete de reglas (`/rules`) y el guion del Gem (bloque `habilidad:`) añaden filas. **Eso choca con lo que pides**: que solo exista la que está en el código.
- **Mago, Clérigo, Druida y Bardo** tienen dos o tres conjuros cada uno, sin escuelas, sin componentes y sin nada que la magia signifique en el mundo.

### 1.4 Los compañeros

Tienen mucho debajo:

- lo que buscan (`wants`: oro, gloria, sangre, tranquilidad o saber);
- vínculo y escenas de confidente;
- aprobación y roces (28 y 32);
- encargo personal (30);
- frases en combate (C7);
- charlas de campamento (31);
- se van si están hartos (29);
- banquillo (42) y despachos (U8).

**No hay nada parecido a una mascota**, ni nada que comente la partida fuera del combate.

### 1.5 La complejidad

Esto es lo que más pesa hoy, y lo dices tú mismo: **hay demasiados interruptores**.

| Dónde | Qué se decide |
| :--- | :--- |
| **Supervivencia** (`rules/mortality.js`) | Seis: quién puede morir, dónde se guarda, hambre y sueño, clima, heridas que quedan, lealtad |
| **Tres dificultades con nombre** (198) | *Historia*, *Veterana* y *De hierro*: ponen esos seis de una vez |
| **La pausa** | Modo ahorro, largo de la narración, daltonismo, letra, tono, red de seguridad, los hartos se van, la mesa |
| **Encendido siempre, sin interruptor** | Rivales, crimen, casos, fortuna de los sitios, noticias, cartas, fiestas… |

Las tres dificultades existen, pero **solo tocan la supervivencia**: los sistemas nuevos (casos, rivales, crimen, despachos) están siempre encendidos, se quiera o no.

### 1.6 Crear un mundo

- **El taller tiene 13 pasos**: el mundo, quién lo cuenta, localidades, tableros, habilidades, razas, clases, objetos, facciones, bestiario, personajes, misiones y jugabilidad (`campaign/taller.js`, `STEPS`).
- **Todos son opcionales menos el primero**, y todo entra marcado por defecto. Aun así, **se recorren en fila**: para cambiar solo el bestiario hay que pasar por los once de delante.
- **Mundos precreados:** 1387 es un paquete completo (`public/mundos/1387.pack.json`). **No hay héroes hechos**: siempre hay que crear uno (o traer un veterano, 179).

---

## 🧭 2. Las reglas de esta fase

1. **Cada fase engancha con dos sistemas que ya existen, como mínimo.** Una mascota que solo ladra es decorado; una que olfatea pistas de los casos, avisa en el campamento y es una carta en el duelo es parte del juego.
2. **Lo complejo, apagado hasta que se pide.** Los modos no son una etiqueta: deciden **qué sistemas existen** en la partida, y lo apagado **no sale en pantalla**. Un botón muerto confunde más que no tenerlo.
3. **La magia vive en el código.** El guion, el Gem y el paquete de reglas pueden **decir quién sabe qué conjuro y dónde hay un pergamino**; no pueden inventar conjuros. El narrador recibe la lista de lo que existe y la regla de que no hay otra.
4. **Lo que cuesta tokens lo dice.** Casi todo aquí es motor, a 0 tokens. Donde algo llama al modelo (una respuesta de la mascota si habla), es opcional y se dice.
5. **Cada fase acaba con algo que se juega y se comprueba en el navegador**, como hasta ahora.

---

## 🗺️ 3. El orden

| Orden | Fase | Qué da | Esf. |
| :---: | :--- | :--- | :---: |
| 1 | **R1** · Modos y partida rápida | Empezar sin pensar, y solo con lo que quieres | M |
| 2 | **R2** · El taller en pestañas | Tocar solo lo que quieres cambiar | M |
| 3 | **R3** · Habilidades con oficio | Áreas, etiquetas que tocan el terreno, usos fuera del combate | L |
| 4 | **R4** · La magia desde el código | Un grimorio cerrado, con escuelas, componentes y consecuencias | L |
| 5 | **R5** · La mascota | Un compañero pequeño que comenta, ayuda y crece | L |
| 6 | **R6** · Tableros con intención | El tablero sabe para qué es: forma, trampas, presupuesto, cosas que tocar | L+ |
| 7 | **R7** · Enemigos con cabeza | Papeles, jefes con fases, refuerzos, una némesis | L |
| 8 | **R8** · Compañeros con arco | Lo personal abre ramas; confidentes que no pelean | M |
| 9 | **R9** · El mundo que responde | Todo lo anterior deja huella: precios, facciones, rumores | M |
| 10 | **R10** · Herramientas para ti | El Gem escribe héroes, mascotas, casos y piezas de tablero | M |

**Por qué este orden:**

- **R1 y R2 primero** porque son lo que pediste para no ahogarte, y porque todo lo que viene detrás necesita saber **en qué modo está la partida** para encenderse o no.
- **R3 antes que R4**: la magia se construye con las piezas nuevas de las habilidades (áreas, etiquetas); hacerla antes sería escribirla dos veces.
- **R5 después de la magia**, porque un familiar arcano es una mascota que la usa.
- **R6** es la más larga y la que más gana con lo anterior: con etiquetas y magia, un tablero con agua, maleza y barriles da jugadas nuevas sin escribir reglas nuevas.

Esfuerzo: **S**, una sesión · **M**, varias · **L**, una fase entera · **L+**, más de una. En total, meses, a nuestro ritmo.

---

## 🎚️ R1 · Modos y partida rápida · `M`

> **El problema.** Seis interruptores de supervivencia, ocho en la pausa, y los sistemas nuevos siempre encendidos. Para jugar una tarde hay que entender demasiado.

**Los modos.** Cuatro, con tus letras:

| Letra | Qué enciende | Qué sistemas son |
| :---: | :--- | :--- |
| **a** | **Heridas que curan** | Las heridas (con días) y la red de seguridad (25) |
| **b** | **La cuenta de la semana** | Comida por día, sueldos, posada y la Mesa (U5) |
| **c** | **El mundo se mueve** | Facciones con reloj, rivales (94), noticias, fortuna de los sitios, casos (U8) |
| **d** | **El cuerpo** | Hambre, sed, sueño y lealtad de quien cobra |
| **e** | **De hierro** | Puede morir cualquiera; solo se guarda en el refugio; heridas que no curan |
| **f** | **La intemperie** | Clima, frío, noches al raso y crimen con guardias |

| Modo | Letras | Para quién |
| :--- | :--- | :--- |
| **Relajado** | a, b, c | Para la historia: nada te mata de hambre ni de frío, y nadie de los tuyos muere |
| **Normal** | a, b, c, d, f | Lo de siempre: el cuerpo y el camino pesan, pero guardas cuando quieres |
| **Supervivencia** | a, b, c, d, e, f | Todo: cada decisión pesa y no hay vuelta atrás |
| **A tu medida** | lo que marques | Las seis letras como casillas, y dentro de cada una sus interruptores finos |

Las tres dificultades de hoy (*Historia*, *Veterana*, *De hierro*) **son casi exactamente** estas tres; se cambian de nombre y se amplían para que toquen también los sistemas nuevos (ver **DR1**).

**Qué se construye:**

1. **Un solo sitio para los modos**: `rules/modes.js`, puro. Cada letra dice qué interruptores pone, incluidos los que hoy no tienen (casos, rivales, crimen). Los interruptores de hoy **siguen siendo la verdad**: el modo solo los pone de una vez.
2. **Lo apagado no sale.** Con *c* apagada, ni rivales en el tablón ni casos en la mesa; con *b* apagada, ni cuenta en la cabecera ni «la cuenta» en «Lo que viene». Cada sistema pregunta al modo antes de pintarse.
3. **«Qué está encendido»** en la pausa: el modo, sus letras y cambiarlo (**DR2**).
4. **Partida rápida**, desde la pantalla de título: **mundo precreado → modo → héroe → jugar**, cuatro clics.
   - El héroe se elige entre **tres ya hechos** para ese mundo, un veterano de otra partida (179) o uno nuevo.
   - Los héroes hechos van en el paquete del mundo (`heroes:` en el guion) y los escribe el Gem (ver R10).

**Sinergia:**

- la red de seguridad (25) y los hartos (29) pasan a depender del modo;
- la Mesa (U5) enseña solo lo encendido;
- el registro del estado (U2) guarda el modo como ajuste;
- «Tu sesión» (U0) dice en qué modo juegas.

**Se ve al terminar:** «Partida rápida» en el título; 1387 en Relajado, en cuatro clics, sin cuenta ni hambre a la vista.
**Hecho cuando:** un paso del recorrido empieza 1387 en Relajado y comprueba que no sale nada de *d*, *e* ni *f*; otro lo cambia a Supervivencia y comprueba que aparece.

---

## 🗂️ R2 · El taller en pestañas · `M`

> **El problema.** Trece pasos en fila, aunque doce son opcionales y todo viene marcado. Para cambiar el bestiario hay que atravesar el mundo, el narrador, las localidades…

**Qué se construye:**

1. **Pestañas en vez de pasos**: las trece, a la vista, en una barra. Se entra en la que se quiere y se sale cuando se quiere. La lógica de hoy (`campaign/taller.js`) no cambia: ya sabe qué hay en cada paso y si está bien; cambia cómo se recorre (`ui/taller/`).
2. **«Empezar» siempre a mano.** Con el mundo elegido, todo lo demás tiene valor por defecto: se puede empezar sin abrir ninguna otra pestaña.
3. **Cada pestaña dice cómo está**: ✓ la has tocado · • por defecto · ⚠ algo no cuadra (un tablero sin salida, una facción sin sitio). El aviso sale del mismo comprobador que hoy decide si se puede pasar de paso.
4. **La pestaña «Jugabilidad» pasa a ser el modo** (R1), con «A tu medida» dentro.
5. **Una pestaña «Lo que sale»**, con la vista previa del mundo (175), para ver el resultado antes de empezar.

**Sinergia:** la vista previa (175), el comprobador de densidad (181) y los modos (R1).

**Se ve al terminar:** el taller abre en «El mundo» con las trece pestañas arriba; cambias solo «Bestiario» y empiezas.
**Hecho cuando:** un paso del recorrido crea un mundo tocando solo una pestaña, y otro comprueba que una pestaña con un error lleva su ⚠.

---

## ⚔️ R3 · Habilidades con oficio · `L`

> **El problema.** Veinticinco habilidades a un solo objetivo, que no tocan el terreno, ni el clima, ni la vida fuera del combate.

**Qué se construye:**

1. **Formas en la cuadrícula**: además de a uno, **línea**, **cono** y **radio**. La cuadrícula ya sabe de distancias y de línea de visión (`board/line-of-sight.js`); la forma dice qué casillas toca. En la barra de combate, al elegir la habilidad, se ven las casillas afectadas antes de usarla, como la ruta de movimiento.
2. **Etiquetas que interactúan**: *fuego*, *frío*, *veneno*, *luz*, *trueno*, *naturaleza*. Una etiqueta no es un número: **hace cosas en el mundo**.
   - **Fuego** prende lo que arde; el fuego ya se extiende solo (23).
   - **Frío** congela el agua (terreno *hielo*, en R6).
   - **Trueno** rompe puertas (`breakDoor` ya existe).
   - **Luz** despeja la oscuridad (R6).
   - **Naturaleza** hace maleza (terreno difícil).
   - **La lluvia** apaga el fuego (el tiempo ya se sabe).

   Las reglas viven en un solo sitio: `rules/tags.js`, una tabla de etiqueta × terreno × clima.
3. **Estados que se combinan**, pocos y claros: *mojado* + frío = *helado* (no se mueve); *aceite* + fuego = arde el doble. El aceite ya se lanza (122); falta que se note.
4. **Usos fuera del combate**, con cada habilidad enganchada a un sistema:

   | Habilidad | Fuera del combate |
   | :--- | :--- |
   | *Leer el rastro* | Guía en el viaje: un día menos, o encuentra el atajo |
   | *Mano de ganzúa* | Abre cerraduras (77) |
   | *Dar la voz* | Guardia en el campamento (67) |
   | *Burla que escuece*, *Palabra de ánimo* | Cartas en el Duelo de Palabras (U6) |
   | *Primeros auxilios* | Estabiliza fuera del combate |

5. **El árbol da habilidades**: el tercer paso de cada rama (48) es una habilidad, no un número. Dos guerreros de nivel 6 se distinguen por lo que **hacen**, no por un +1.
6. **Más por clase**: de dos o tres a cinco o seis cada una. Los datos de técnicas siguen siendo datos (armas, maniobras, trucos de oficio); la magia sale de aquí (R4).
7. **Ataques en pareja**: con vínculo 3 o más y al lado, dos compañeros pueden hacer una jugada juntos. Se apoya en las mejoras de vínculo, que ya existen.

**Sinergia:** el terreno vivo (23), el tiempo (74), las maniobras (122), cerraduras (77), el campamento (67), el viaje, el duelo (U6), el árbol (48) y los vínculos.

**Se ve al terminar:** un *Cono de escarcha* sobre un charco deja hielo; un *Rayo de fuego* junto a una caja la prende; *Leer el rastro* acorta un viaje.
**Hecho cuando:** pruebas de la tabla de etiquetas (cada combinación, una vez), y un paso del recorrido lanza un área y comprueba las casillas y el terreno después.

---

## ✨ R4 · La magia desde el código · `L`

> **Lo que pediste:** magia, sí; locuras, no. **Solo existe la que está escrita en el código.**

**Qué se construye:**

1. **El grimorio**, en el código: `rules/grimoire.js`.
   - Cada conjuro es una entrada **revisada en código**: su efecto está programado con las piezas de R3 (forma, etiquetas, estados), no descrito en una fila que alguien pueda inventarse.
   - **Siete escuelas**: evocación (fuego, frío, trueno), abjuración (protegerse), encantamiento (la mente: sueño, encanto), adivinación (saber), naturaleza (plantas, bestias), divina (curar, luz) y nigromancia (lo que queda de los muertos; en muchos sitios, un crimen).
   - **Tres círculos**: 1º, 2º y 3º. Una treintena de conjuros para empezar.
2. **Nadie más crea magia.**
   - **El guion y el Gem** pueden decir **quién sabe qué conjuro** («Keller conoce *Muro de fuego*») y **dónde hay un pergamino**, por su id.
   - **El importador** rechaza, con aviso, un conjuro que no está en el grimorio.
   - **El paquete de reglas** (`/rules`) puede **ajustar números** (daño, alcance, usos) pero no añadir conjuros.
   - **Los conjuros de hoy**, que son filas de datos (*Rayo de fuego*, *Curar heridas*…), pasan al grimorio (**DR3**).
3. **El recurso: cargas por círculo** (**DR4**). Tres de 1º, dos de 2º y una de 3º, que vuelven con el descanso largo. Es la capa ligera de siempre, con un escalón.
4. **Componentes para lo gordo**: algunos conjuros de 2º y 3º piden algo que se gasta. Polvo de hueso, ámbar, una pluma de grifo… Sale de los trofeos de caza (121), de forrajear y de la tienda. La magia entra así en la economía sin inventar moneda.
5. **La magia en el mundo:**
   - **Facciones con postura**: unos la persiguen, otros la pagan. Usar nigromancia donde está prohibida es un **crimen** (96): suben «buscados» y aparecen guardias.
   - **La aprobación** (28): al compañero que busca tranquilidad no le gusta la nigromancia.
   - **El Duelo de Palabras**: *Encanto* es una carta que pesa mucho… y si se descubre, os tienen ganas.
   - **Los casos**: *Hablar con los muertos* da la pista de la víctima; *Detectar mentiras* da ventaja al sonsacar.
   - **El viaje y el campamento**: *Luz* quita el riesgo de la noche (67); *Paso sin rastro* esquiva a los cazarrecompensas del camino.
6. **Pergaminos y varitas**: un pergamino se lanza una vez, o se aprende con el Erudito; una varita tiene cargas. Son botín con presupuesto (95) y reliquias (132).
7. **El narrador lo sabe, con pocas palabras**: con alguien que hace magia en el grupo, una línea en su bloque con **lo que ese grupo sabe lanzar** y la regla «no existe otra magia». Solo entonces: si nadie hace magia, cero tokens.
8. **Los enemigos**: los que lanzan conjuros usan el mismo grimorio, con las reglas de `enemy-abilities.js`.

**Sinergia:** es la fase que más engancha:

- las habilidades (R3);
- el terreno vivo (23);
- la economía y los trofeos (121);
- el crimen (96);
- la aprobación (28);
- el duelo (U6);
- los casos (U8);
- el campamento (67);
- el viaje;
- el botín;
- las reliquias;
- la IA enemiga.

**Se ve al terminar:** un mago con su grimorio en la ficha (círculos, cargas y componentes); un *Muro de fuego* que prende la maleza; un guardia que os para por nigromancia.
**Hecho cuando:**
- pruebas de cada conjuro;
- una prueba que lee el código y falla si una habilidad de datos lleva escuela de magia (así nadie cuela un conjuro por la puerta de atrás);
- un paso del recorrido lanza un conjuro de área, gasta su carga y su componente, y el narrador recibe la línea de «lo que sabéis».

---

## 🐾 R5 · La mascota · `L`

> **Tu idea:** un acompañante pequeño que comenta la historia, con el que el personaje interactúa. Y si habla, que hable.

**Qué es:** una criatura que va con el héroe:

- de campo: perro, cuervo, gato, zorro, halcón;
- de otro tipo: un familiar arcano, un autómata de latón, un espíritu del bosque.

**No ocupa plaza en el grupo**, no tiene sueldo y no se va por hartazgo: es **del héroe**.

**Qué se construye:**

1. **Su ficha**: especie, nombre y **carácter** (cínica, leal, curiosa, miedosa, orgullosa). Tiene un vínculo propio, pequeño, que crece con lo que se vive juntos. `campaign/pet.js`, puro.
2. **Comenta la historia, a 0 tokens.**
   - Reacciona a la **crónica** (U4): cuando pasa algo del hilo, del mundo o del grupo, a veces dice algo.
   - Las frases vienen de bancos escritos, según su carácter y el suceso, como las de combate (C7): «El cuervo grazna. Otra semana sin cobrar, y tú tan tranquilo».
   - No habla siempre (una frase por escena como mucho) ni repite la última.
3. **Se interactúa con ella:**
   - **Acariciarla o jugar** es una acción del día que sube el ánimo del grupo, un poco.
   - **Preguntarle**: si es de las que hablan (**DR5**: un familiar, un loro, un espíritu), responde con lo que el motor sabe, dicho con su voz: lo que viene (U3), el asunto más urgente de la mesa (U5), la pista que falta del caso (U8). **Es la ayuda del juego con cara**. Es gratis, porque sale del motor.
   - **«Que lo cuente el narrador»**, opcional: una llamada corta con su carácter, para cuando quieres una escena.
4. **Ayuda, sin pelear en serio** (**DR6**). En el tablero es una ficha pequeña con una acción de apoyo:
   - **distraer**: el enemigo de al lado pierde su reacción;
   - **rastrear**: +2 a Percepción de quien tiene al lado;
   - **traer**: coge un objeto suelto;
   - **avisar**: nadie os sorprende.

   Puede caer, pero no muere salvo en *De hierro* (R1, letra *e*).
5. **Sirve en todo lo demás:**

   | Dónde | Qué hace |
   | :--- | :--- |
   | Casos (U8) | El perro olfatea: una pista de «rastro» que solo encuentra él |
   | Campamento (67) | Vigila: cuenta como un vigía más |
   | Viaje | El halcón explora: descubre un sitio o un atajo |
   | Duelo (U6) | El cuervo roba la atención: una carta sin tirada |
   | Diálogo | Hay PNJ a los que les caen bien los perros (actitud +1) |

6. **Cómo se consigue:** al crear el héroe (una más en su ficha) o **domando** una bestia del bestiario marcada como domable. Hace falta comida, Trato con animales y paciencia: unos días.
7. **Aprende trucos** con el vínculo: al subir, una acción nueva de apoyo o un comentario más fino.

**Sinergia:**
- la crónica (U4), que le da de qué hablar;
- la mesa (U5), lo que viene (U3) y los casos (U8), que le dan qué decir;
- el campamento, el viaje y el duelo, donde ayuda;
- el bestiario, de donde sale;
- los vínculos, que la hacen crecer;
- los modos (R1), que deciden si puede morir.

**Se ve al terminar:** empiezas con un cuervo cínico que comenta la cuenta del viernes; en el caso, el perro encuentra el rastro; en el campamento, avisa.
**Hecho cuando:** pruebas de los bancos de frases (que ningún carácter se quede sin frase para ningún suceso) y un paso del recorrido que la pregunta, la usa en el tablero y la oye comentar.

---

## 🧱 R6 · Tableros con intención · `L+`

> **El problema.** El generador sabe hacer sitios, pero no **para qué** son. Y reparte enemigos a ciegas.

**Qué se construye:**

1. **El propósito manda en la forma**: cada clase de encargo pide una estructura.

   | Encargo | Estructura |
   | :--- | :--- |
   | **Escoltar** | Un recorrido largo con la salida lejos, y dos emboscadas en los estrechos |
   | **Aguantar** | Una sala defendible con dos entradas y cobertura dentro |
   | **Robar** | Patrullas y rincones con sombra; la cosa, detrás de una puerta con llave (77) |
   | **Cazar** | Una guarida al fondo, y rastros (casillas con aviso) que llevan a ella |
   | **Recuperar** | El objeto en la sala más lejana, y el camino de vuelta más corto que el de ida |

2. **El sitio manda en el contenido**, sacado de `sitios.json` y del bioma:

   | Sitio | Lo que trae |
   | :--- | :--- |
   | Cripta | Sarcófagos (cobertura) y trampas con aviso en los pasillos |
   | Bosque | Árboles, maleza que arde |
   | Costa | Agua poco profunda y rocas |
   | Mina | Vagonetas y pozos |

3. **Terreno nuevo** (en código, como la magia: **DR7**):

   | Terreno | Qué hace |
   | :--- | :--- |
   | **Agua** poco profunda | Terreno difícil, y te moja |
   | **Agua** profunda | Hay que nadar (Atletismo) |
   | **Altura** (±1) | Ventaja al atacar desde arriba |
   | **Oscuridad** y **luz** | La visión cambia, y las antorchas cuentan |
   | **Hielo** | Resbala: salvación o caer |
   | **Maleza** | Terreno difícil, y arde |

   Los números se ajustan en `/rules`.
4. **Cosas que tocar** (era la P20):
   - palancas que abren puertas;
   - cofres, con el botín por presupuesto (95);
   - barriles de aceite que explotan (fuego, R3);
   - cuerdas para bajar un precipicio;
   - barricadas que se rompen.
5. **Las trampas las pone el generador**, con su aviso, según el sitio: en una cripta sí, en un campamento no. El módulo ya existe (`board/hazards.js`).
6. **Presupuesto de encuentro** (la idea 83): la dificultad total se reparte entre las salas según el nivel del grupo y el modo (R1). Los enemigos salen del bestiario con su valor de desafío, no a ciegas. **La pelea imposible de la tercera sala deja de pasar.**
7. **Refuerzos y jefes con fases** (P21 y P22):
   - «en la ronda 3 entran dos arqueros por la puerta norte», dicho antes con una pista;
   - un jefe que al 50 % cambia de postura, se acorrala o llama a los suyos.
8. **Piezas escritas por propósito**: pequeñas salas temáticas con mecánica (un altar que cura una vez, un puente sobre el precipicio, un pozo con algo dentro). Se estampan como las salas de hoy, pero sabiendo dónde encajan.
9. **El tablero que cuenta la historia:**
   - la escena de un caso (U8) pone sus pistas **en casillas** («Registrar el cobertizo» es ir allí);
   - el hito del hilo pone su objeto;
   - el villano (115), su estandarte.
10. **El comprobador de que es divertido**, no solo de que se puede recorrer. Si sale mal, se vuelve a tirar con la misma semilla más uno. Mira cuatro cosas:
    - al menos dos caminos a lo importante;
    - ningún enemigo a tiro de la casilla de inicio;
    - cobertura en cada sala grande;
    - al menos un cuello de botella.

**Sinergia:**
- los encargos, que dan el propósito;
- los sitios y el bioma, que dan el contenido;
- las cerraduras (77), el botín (95), las trampas y la magia (R4), que dan las cosas que tocar;
- los casos (U8), el hilo y el villano (115), que dan la historia;
- los modos (R1), que dan la dificultad;
- el terreno vivo (23), que da el fuego.

**Se ve al terminar:** un encargo de robo sale con patrullas, sombras y una puerta cerrada; uno de escolta, con un pasillo largo y dos emboscadas; la cripta, con trampas que avisan.
**Hecho cuando:**
- pruebas del generador con mil semillas por propósito, cada una pasando el comprobador;
- un paso del recorrido que juega un encargo de cada clase y comprueba su forma.

---

## 👹 R7 · Enemigos con cabeza · `L`

**Qué se construye:**

1. **Papeles**: tanque, tirador, sanador, líder. El papel decide cómo se mueve y a quién ataca: el tirador busca altura y distancia (R6); el sanador se queda detrás.
2. **Tácticas de bando**: los de Keller forman línea; los lobos rodean; los cultistas protegen al que lanza. Es una tabla por facción o bestia.
3. **Moral**: la rendición (6) ya existe; se amplía a huir, pedir tregua o llamar refuerzos (R6).
4. **La némesis**: un rival (94) o un enemigo que escapa vuelve más adelante, con una cicatriz, rencor y una habilidad nueva, y lo sabe el narrador. Es el «Nemesis» de *Sombras de Mordor*, en pequeño.
5. **El bestiario por región y estación** (97) se nota en los encuentros del camino y en los tableros (R6).

**Sinergia:** la IA de siempre, los rivales (94), los tableros (R6), el grimorio (R4), las estaciones (74) y la crónica (U4), donde la némesis tiene su historia.

**Hecho cuando:** pruebas de cada papel (qué casilla elige y a quién ataca) y un paso del recorrido con una banda mixta.

---

## 🤝 R8 · Compañeros con arco · `M`

**Qué se construye:**

1. **Lo personal abre una rama**: cumplir el encargo personal (30) desbloquea una rama del árbol (48) o un rasgo único de ese compañero. Su historia cambia lo que sabe hacer.
2. **Confidentes que no van contigo** (era la P14): la tabernera, el herrero… tienen vínculo por actitud (140) y escenas, sin pelear. Dan cosas del día: descuentos, avisos, un sitio donde esconderse.
3. **Los que se fueron vuelven** (29): un compañero harto que se marchó puede reaparecer semanas después, cambiado, en una escena de reencuentro.
4. **Opinan de lo nuevo**: la magia y los crímenes entran en la aprobación (28) con sus decisiones.

**Sinergia:** los encargos personales (30), el árbol (48), las actitudes (140), las salidas (29), la aprobación (28) y la magia (R4).

---

## 🌍 R9 · El mundo que responde · `M`

Lo que falta para que todo lo anterior **deje huella**:

1. **La memoria del narrador lee de la crónica** (lo que quedó de U4): lo que pasó, contado por el motor, en vez de hechos sueltos.
2. **Precios que se mueven de verdad**: con la estación, la guerra (84) y la fortuna del sitio (85). Los componentes de la magia (R4) escasean donde manda quien la persigue.
3. **Las facciones reaccionan** a la magia, a los casos resueltos (o mal resueltos) y al crimen, con su postura (−5 a +5).
4. **Los rumores cuentan lo que hicisteis**: un caso resuelto, una némesis, un despacho que salió mal. Hoy los rumores son los que trae el guion; se añaden los que nacen de la partida.

**Sinergia:** es la fase que cose las demás: crónica, economía, facciones, rumores, casos, crimen y magia.

---

## 🛠️ R10 · Herramientas para ti · `M`

1. **El Gem escribe lo nuevo**, con los mismos avisos del conversor (U7):
   - héroes hechos para cada mundo (`heroes:`);
   - mascotas (`mascota:`);
   - piezas de tablero (`pieza:`);
   - casos redondos (`caso:`, lo que quedó de U8);
   - quién sabe qué conjuro (`conjuros: [id]`).
2. **Un visor del grimorio y de las etiquetas** en `/rules`: no para crear, para **ver** qué existe y ajustar sus números.
3. **El comprobador de densidad** (181) mira también lo nuevo: si un mundo tiene héroes hechos, si hay bestias domables y si los tableros escritos pasan el comprobador de R6.

---

## 🔗 4. Cómo se enganchan

Cada fila es una fase y cada columna un sistema que ya existe; ● es que la fase lo toca.

| | Crónica | Mesa | Casos | Duelo | Terreno | Viaje/campamento | Economía | Facciones | Compañeros | Modos |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **R1** Modos | ● | ● | ● | | | ● | ● | ● | ● | ● |
| **R2** Taller | | | | | | | | ● | | ● |
| **R3** Habilidades | | | | ● | ● | ● | | | ● | |
| **R4** Magia | ● | | ● | ● | ● | ● | ● | ● | ● | |
| **R5** Mascota | ● | ● | ● | ● | | ● | | | ● | ● |
| **R6** Tableros | | | ● | | ● | | ● | ● | | ● |
| **R7** Enemigos | ● | | | | ● | ● | | ● | | ● |
| **R8** Compañeros | ● | | | ● | | ● | | ● | ● | |
| **R9** Mundo | ● | ● | ● | | | | ● | ● | | |

---

## 🟠 5. Lo que decides tú

> **Decidido el 2026-09-26:** las siete, en la opción A.

| ID | La pregunta | Opciones | Recomiendo |
| :--- | :--- | :--- | :--- |
| **DR1** | ¿Los modos sustituyen a *Historia*, *Veterana* y *De hierro*? | **A**: sí, con tus nombres (Relajado, Normal, Supervivencia) y ampliados a los sistemas nuevos · **B**: conviven | **A.** Son casi lo mismo; dos juegos de nombres para lo mismo confunden |
| **DR2** | ¿Se puede cambiar de modo a mitad de partida? | **A**: sí, siempre, y queda en la crónica · **B**: solo a uno más fácil · **C**: no | **A.** Es tu partida; que quede escrito basta. En el salón de la fama (199), una partida de hierro que bajó de modo no cuenta como de hierro |
| **DR3** | Los conjuros que hoy son filas de datos (*Rayo de fuego*…) | **A**: pasan al grimorio, y los datos ya no pueden llevar escuela de magia · **B**: conviven | **A.** Es exactamente tu regla: la magia, solo en el código |
| **DR4** | El recurso de la magia | **A**: cargas por círculo (3/2/1 por descanso largo) · **B**: puntos de foco · **C**: ranuras de 5e | **A.** Una línea en la ficha; B y C son otro sistema que aprender |
| **DR5** | ¿Qué mascotas hablan? | **A**: solo algunas (familiar, loro, espíritu); las demás, con gestos · **B**: todas · **C**: ninguna | **A.** Un perro que habla es otro juego; un cuervo que grazna frases, no |
| **DR6** | ¿La mascota pelea? | **A**: apoyo sin daño (distraer, rastrear, avisar) · **B**: como un compañero más · **C**: no está en el tablero | **A.** Como compañero de pelea, sería un quinto miembro sin sueldo; sin tablero, perdería la mitad de la gracia |
| **DR7** | El terreno nuevo (agua, altura, hielo…), ¿en código o en datos? | **A**: en código, con los números ajustables en `/rules`, como la magia · **B**: en datos, como pedía la P23 | **A.** Cada terreno nuevo trae reglas de movimiento y visión; eso es código. Lo que se ajusta (cuánto cuesta cruzarlo) sigue sin tocarlo |

---

## 🗑️ 6. Lo que no haría

| Idea | Por qué no |
| :--- | :--- |
| **Conjuros que invente el modelo** | Es justo lo que pides evitar: el narrador los contaría y el motor no sabría resolverlos |
| **Las ranuras completas de 5e** (nivel 1 a 9, preparados, concentración) | Un sistema entero que aprender, para una magia que ya funciona en capa ligera |
| **Una mascota que sea un compañero más** | Rompe el límite del grupo y el sueldo; lo que la hace distinta es que **acompaña**, no que pelea |
| **Más de cuatro modos con nombre** | Cada modo con nombre es una promesa que mantener; lo demás, «A tu medida» |
| **Generar tableros con el modelo** | La geometría la hace mejor un algoritmo con semilla, y gratis (lo dice el propio generador) |

---

## 🔗 Enlaces

- [[LO_QUE_FALTA]]: lo que queda después de R1–R10, y en qué orden.
- [[ROADMAP_PEGAMENTO]]: lo que se hizo antes: que todo se hablara entre sí.
- [[PROPUESTAS_BUCLE_DE_JUEGO]] (archivo): el análisis del bucle, del que salieron la mesa, los casos y el duelo.
- [[ALGORITMOS_GENERACION]]: las 200 ideas de generación; R6 hace las de tableros (83, 95, 195).
- [[POR_HACER]]: la D5 (la magia ligera) y las P20–P23, que entran en R4 y R6.
- [[ROADMAP_CREACION]] (archivo): el taller, que R2 pasa a pestañas.
