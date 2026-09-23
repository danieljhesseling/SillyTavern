---
title: Roadmap — Mundos vivos
tags: [roadmap, mundos, localidades, servicios, tableros, chat, narracion]
created: 2026-09-23
updated: 2026-09-23
author: DanielJHesseling / Claude Opus 5.5
---

# 🏘️ Mundos vivos

> **De dónde sale.** Tres propuestas pegadas en la conversación del 2026-09-23: **localidades con servicios** (taberna, herrero, tienda, templo), **mundos precreados de verdad** y **ocho formas de coser el chat al tablero**. Aquí está lo que se queda, lo que se cambia y lo que no. Lo que ya existe se dice, para no construirlo dos veces.
>
> **Lo urgente es la fase M.** Un mundo precreado hoy es **una localidad, un tablero y dos bichos**: la plantilla de inicio (`starter-templates.js`) más una semilla. Los mundos están vacíos porque no hay nada escrito dentro, no porque falte motor.

Mismas reglas que el resto del proyecto: **el contenido es datos, no código**; lo que el modelo narra no crea estado; y cada fase termina con algo jugable, comprobado en el navegador.

---

## 🧭 El orden

| Orden | Fase | Por qué va aquí |
| :--- | :--- | :--- |
| 1 | **M0** — un mundo precreado puede ser un paquete | Es la puerta: sin ella, cada mundo lleno es código. Con ella, es un archivo |
| 2 | **H1–H4** — la mecha y el hilo | **Sin esto, un mundo lleno sigue siendo un sitio bonito donde no sabes qué hacer.** Va antes del piloto porque el piloto se escribe alrededor de su hilo |
| 3 | **M1 + M6** — el piloto, con sus veinte horas, y el comprobador de densidad | Uno entero antes que cuatro a medias: enseña qué falta de verdad |
| 4 | **G1–G6 + M7** — el mundo crece jugando, y la mezcla | Justo detrás del piloto, y sin ella el piloto no está completo: el 20 % generado del acto 1 tiene que salir de algún sitio. Los generadores ya existen; conectarlos es poco código |
| 5 | **T1** — el precipicio | El terreno nuevo que más juego da, porque **empujar** ya existe desde hoy |
| 6 | **L1–L3** — servicios y posada | Lo que hace que llegar a un pueblo sea llegar a algún sitio |
| 7 | **C7, C1** — frases de compañeros y estado físico | Baratos, y se notan en cada combate y en cada turno |
| 8 | **M2–M4** — los otros tres mundos | Con lo aprendido en el piloto |
| 9 | El resto de L, T y C | Por lo que pidan los mundos al escribirse |

---

## 🟠 D — Lo que decides tú

### DM1 · Los mundos ✅ **Decidido el 2026-09-23: los tuyos**

Se quedan los cuatro que ya tienes (**la costa**, **el ocaso**, **la pantalla**, **1387**). Los cuatro mundos del texto pegado no entran.

### DM2 · ¿Qué mundo va primero? ✅ **Decidido el 2026-09-23: 1387**

**Recomiendo 1387.** Es el que más usa lo que ya está construido y probado: el gremio, la cuenta semanal, la lealtad, la deuda con un patrón y los encargos de facción. No tiene magia, así que no depende de nada de la fase T.

### DL1 · ¿El remedio de una herida solo se compra en una herrería? ✅ **Decidido el 2026-09-23: sí, con la ficha diciendo dónde hay una**

Desde hoy se compra desde la ficha del compañero, en cualquier sitio. Con servicios (L4), lo natural es que la pierna de palo la haga **un herrero**, y que eso sea un motivo para viajar. **Recomiendo que sí**, pero con la ficha diciendo dónde hay uno. Si no, el botón desaparece y parece que ya no existe.

---

## 🧨 Fase H — La mecha y el hilo · **antes que nada**

> **El problema, dicho por quien juega (2026-09-23):** *«Empiezo y no sé qué hacer.»* Es cierto, y no se arregla solo con llenar los mundos. Hoy una partida arranca con sitios, facciones cuyos relojes corren y un tablón, pero **nada te dice qué tienes entre manos**. La sinopsis del mundo es texto: nada en el motor la convierte en un «ahora toca esto».

**La respuesta a «¿se hace o está hecho?» es: las dos cosas, y cada una en su sitio.**

| Qué | ¿Escrito o generado? | Por qué |
| :--- | :--- | :--- |
| **La mecha**: lo que pasa en la primera escena | **Escrito** en los mundos precreados; generado en los de cero | Una partida no empieza con «estáis en una taberna»: empieza con *el primer ahogado en treinta años aparece en la playa al amanecer*. Es lo único que no puede fallar |
| **El hilo**: tres actos con sus hitos y su final | **Escrito** | Es lo que hace que la costa sea *la costa* y que dos personas que la jueguen puedan hablar de lo mismo |
| **Lo de alrededor**: encargos, gente, sitios que se descubren | **Generado mientras juegas** | Esto sí se llena jugando: el tablón no se agota, los rumores revelan sitios nuevos y las facciones mueven ficha si no haces nada |
| **La presión**: qué pasa si ignoras el hilo | **Generado** a partir del reloj de una facción | El reloj ya existe y ya cambia el mundo al llenarse. Atarle el hilo es lo que convierte «no hago nada» en una decisión con consecuencias |

### H1 · El hilo como datos

Un arco es una lista corta de **hitos**. Cada uno dice **qué lo abre**, **qué pide** y **qué cambia** al cumplirse, con piezas que el motor ya sabe mirar:

```json
{ "id": "ahogado", "acto": 1,
  "titulo": "El primer ahogado en treinta años",
  "abre": { "al_empezar": true },
  "pide": { "hablar_con": "la viuda Maren" },
  "cambia": { "revela": ["La cala de los votos"], "abre_hito": "la_firma" },
  "pista": "Alguien del pueblo sabe quién era, y no quiere decirlo." }
```

- **Lo que abre un hito**: empezar, llegar a un sitio, entregar un encargo, que pasen N días o que se llene el reloj de una facción.
- **Lo que pide**: llegar a un sitio, ganar un tablero, hablar con alguien, una tirada con éxito (la de hoy) o entregar un objeto.
- **Lo que cambia**: revelar un sitio, poner a alguien en el mundo, abrir un tablero, mover un reloj, mover la reputación o abrir el siguiente hito.

Va dentro del paquete del mundo (M0), en una sección nueva. El Gem podrá escribirla, como escribe el resto.

### H2 · La mecha: la primera escena

Al empezar la partida se abre el primer hito **sin que pulses nada**: el narrador recibe la escena inicial escrita (por el canal que lee, `postForModel`) y la pantalla va a donde pasa. La primera frase de la partida es un problema, no una descripción.

### H3 · «Lo que tienes entre manos», siempre a la vista

Una línea fija en la pantalla con el hito abierto y su pista: *«El primer ahogado en treinta años — Alguien del pueblo sabe quién era.»* Y la misma línea va al narrador, dentro del bloque de memoria del mundo que se hizo hoy, para que empuje hacia ahí sin inventarse la trama.

### H4 · El hilo para los mundos de cero

Un mundo generado no tiene arco escrito, pero sí facciones con meta. **La facción más peligrosa se convierte en el hilo**: su meta es el final (lo que pasa si nadie la para), su reloj es la cuenta atrás, y los hitos salen de sus segmentos. Así la partida arranca con un problema aunque nadie haya escrito nada.

**Hecho cuando**: se empieza la costa desde el menú y, sin escribir nada, el narrador abre con la escena del ahogado, la pantalla dice qué tienes entre manos, y cumplir el primer hito revela un sitio nuevo y abre el segundo. Comprobado en el navegador.

---

## 🌱 Fase G — El mundo crece mientras juegas

> **La pregunta (2026-09-23):** *«Si el mundo tiene 2 localidades y 3 tableros, ¿hay forma de que mientras juego se creen más localidades, tableros, enemigos u objetos?»*

**Lo que ya crece hoy, y lo que no:**

| Qué | ¿Crece jugando? | Cómo, o por qué no |
| :--- | :--- | :--- |
| **Localidades** | 🟡 **Solo con encargos** | Aceptar un encargo del tablón **genera un sitio nuevo con su tablero** (`acceptContract`), y se guarda como una localidad de verdad. Pero los vecinos del mapa solo se crean al empezar (`neighbours.js`), y nada más añade sitios: ni viajar, ni explorar, ni un rumor |
| **Tableros** | 🟡 **Solo con encargos** | El del sitio del encargo, generado con salas y estados del compendio. Llegar a un sitio que no tiene tablero no le crea uno |
| **Enemigos** | ❌ **No** | Los encargos ponen bichos **del bestiario que el mundo ya tiene**. El compendio sabe criar bichos nuevos (`breedMonster`), pero eso solo lo usa el editor de campaña, a mano |
| **Objetos** | 🟡 **Botín, sí; cosas nuevas, no** | Cada combate reparte botín (`loot.js`). La forja de objetos nuevos (`forgeItems`) también es solo del editor |
| **Gente** | ❌ **No** | Igual: el compendio escribe personas (`writePerson`), pero solo en el editor |
| **Desde el chat** | ❌ **No, a propósito** | El modelo no crea estado: si el narrador dice «hay una cueva al norte», la cueva no existe. La herramienta `dnd_set_location` solo cambia el nombre del sitio actual |

**Resumen:** los generadores ya existen, y buenos, con semilla y del compendio. **Solo están conectados al editor y a los encargos**, no a jugar. Esta fase es conectarlos.

| ID | Qué | Se apoya en |
| :--- | :--- | :--- |
| **G1** | **Explorar los alrededores**: un botón en la localidad que gasta un bloque del día y **descubre un sitio nuevo** en el borde del mapa, con su camino, su tipo y su bioma. Con tope: un mapa que no se acaba nunca deja de ser un mapa | `neighbours.js`, `calendar.js` |
| **G2** | **Un tablero al llegar**: si llegas a un sitio sin tablero, se le genera uno de su tipo (una cripta es una cripta, una aldea tiene casas) y se guarda | `dungeon-generator.js`, `sitios.json` |
| **G3** | **Gente en cada sitio**: al entrar en una localidad con menos de 2–3 PNJ, se escriben los que faltan, con su oficio y lo que quieren, y se quedan en el mundo | `writePerson`, `people.js` |
| **G4** | **Bichos nuevos**: los encargos, y los sitios que se descubren, crían enemigos del bioma del sitio, en vez de repetir siempre el bestiario de partida. Se guardan en el bestiario del mundo | `breedMonster`, `breedBand` |
| **G5** | **Objetos nuevos**: el botín de los rangos altos y la tienda (L5) sacan objetos de la forja, no solo de la lista fija | `forgeItems` |
| **G6** | **El chat propone y el motor crea**: el narrador puede **proponer** un sitio («una cueva al norte»), con una herramienta que no crea nada. Aparece como ficha: *«Buscar la cueva»*. Si la pulsas, el motor la genera con G1 y G2, con la semilla del mundo. Así el chat hace crecer el mundo sin que el modelo invente estado | `tool-calling`, `action-chips.js` |

Todo con **la semilla del mundo**: dos personas que exploren lo mismo en el mismo orden encuentran lo mismo.

**Cómo encaja con lo escrito (M) y con el hilo (H):** lo escrito es el esqueleto (los sitios y la gente de la trama); lo generado es la carne alrededor. Un hito puede incluso pedir «descubre un sitio de tipo cripta», y G1 lo cumple.

---

## 🌍 Fase M — Mundos llenos · **urgente**

> **Qué es «lleno».** No es tener más sitios en la lista. Es que **en cada sitio haya algo que hacer**: alguien con quien hablar que quiera algo, un servicio que use tu oro, un rumor que lleve a otro sitio y un tablero donde pase algo. Por eso la tabla de M1 cuenta también lo que va **dentro** de cada localidad.

### M0 · Un mundo precreado puede traer su paquete

Hoy `mundos.json` elige una plantilla (`templateId: "tavern"`). El paquete que produce tu Gem ya lo lee el importador entero —mundo, localidades, tableros, bestiario, misiones, objetos y confidentes— y el taller ya sabe empezar desde uno (`templateId: "imported"`). Lo que falta es un campo:

```json
{ "id": "1387", "pack": "/mundos/1387.pack.json", "seed": "…", "picks": { … } }
```

Con `pack`, el taller carga ese paquete en vez de la plantilla. Sin `pack`, todo sigue igual. **El formato del paquete no cambia**: el mismo que valida `/esquema-campana`, y el mismo en el que el Gem ya sabe escribir. Un mundo lleno se puede **escribir con el Gem**, pasarlo por el comprobador y guardarlo en `public/mundos/`.

### M1 · El listón: veinte horas, **empezando 80 % escrito**

> **Decidido el 2026-09-23.** Un mundo no es «todo escrito» ni «todo generado»: es una **mezcla que cambia mientras juegas**. Empieza **80 % escrito y 20 % generado con la semilla**, y según avanzas pesan cada vez más la semilla y lo que sale del chat. El principio tiene que estar cuidado, porque es cuando decides si el mundo te engancha; el final tiene que estar abierto, porque es cuando ya es *tu* partida.

**La curva**, atada a los actos del hilo (fase H), que es lo único que mide de verdad cuánto has avanzado:

| Momento | Escrito | Semilla | Chat | Qué se nota |
| :--- | :---: | :---: | :---: | :--- |
| **Acto 1** | 80 % | 20 % | — | Casi todo lo que encuentras está pensado a mano: la gente, los encargos, los tableros |
| **Acto 2** | 60 % | 30 % | 10 % | Empiezan a aparecer sitios descubiertos y encargos del tablón generados. El narrador ya puede proponer sitios (G6) |
| **Acto 3** | 40 % | 35 % | 25 % | La trama sigue escrita; lo de alrededor es cada vez más tuyo |
| **Después del final** | 10 % | 50 % | 40 % | El mundo sigue: lo escrito que quede sin usar, y lo que tú y la semilla hagáis crecer |

**Cómo funciona por dentro (M7).** Cada vez que el juego tiene que **llenar un hueco** —el siguiente encargo del tablón, la gente de un sitio nuevo, el encuentro de un tablero, el botín, un rumor, un sitio por descubrir— tira contra la curva del acto en que estás: o saca del **montón escrito**, o **genera con la semilla**, o toma **una propuesta del chat** que hayas aceptado. Tres reglas:

- **El hilo es siempre 100 % escrito.** La curva mezcla lo de alrededor, nunca la trama.
- **Lo escrito no se tira.** Si la curva elige generar, lo escrito se queda en el montón para más adelante. Si el montón se vacía, se genera, sea el porcentaje que sea.
- **Lo generado sale del propio mundo.** La semilla tira de la selección del mundo (sus razas, su bioma, sus facciones, su tono), no del compendio entero. Un bicho generado en la costa tiene que parecer de la costa.

Los porcentajes son datos del mundo (`mix` en su paquete): un mundo de terror puede querer seguir 70 % escrito hasta el final, y uno de exploración abrirse antes.

**Lo que hay que escribir**, entonces. Con la mezcla, de las veinte horas unas **doce o trece salen del montón escrito** y el resto de la semilla y el chat. Las cantidades de abajo son **el montón escrito**. De dónde salen: un combate táctico dura 15–20 minutos y una escena de conversación 5–10, así que veinte horas equilibradas son unos **25 combates y 70 escenas**, de las que el montón cubre la parte escrita de la curva, con margen:

| Pieza | Por mundo | Horas que da, a ojo | Nota |
| :--- | :--- | :--- | :--- |
| **El hilo** (fase H) | 3 actos, **12–15 hitos**, una mecha, 2–3 finales | 6–7 h | El esqueleto. Los finales dependen de con quién te hayas aliado |
| **Encargos escritos** | **14–16**, de ellos **3–4 cadenas** de 2–3 partes | 5–6 h | Cada uno con su gente, su sitio y su giro. **Un tercio se puede resolver sin pelear** (hablando, con tiradas, pagando) |
| **Localidades** | **7–8** al empezar, **2–3** escritas para descubrir | — | De tipos distintos. Ninguna está solo de paso. El resto de lo que se descubre, generado (G1) |
| **Dentro de cada localidad** | 3–4 PNJ con nombre, 3–5 rumores, sus servicios, 1–2 tableros | — | La regla: **llegar a un sitio siempre abre algo** |
| **PNJ con nombre** | **22–28** | — | Cada uno **quiere algo** y **sabe algo**. Casi nadie es solo decorado |
| **Confidentes** | **5–6**, con sus escenas de vínculo escritas (una cada dos rangos) | 3–4 h | Lo de Persona: pasar la tarde con alguien tiene que contar algo nuevo cada vez |
| **Tableros** | **10–12** dibujados a mano | — | Los combates escritos sin que un mapa salga más de dos veces; los generados ponen el resto. Variados de verdad: interior, exterior, pasillo, sala abierta, con altura, con agua |
| **Encuentros escritos** | **15–18**: qué bichos, en qué tablero y con qué objetivo | — | No solo «matar a todos»: aguantar, escoltar, llegar a la salida, que no escape el jefe |
| **Bestiario** | **15–20** escritos, con **3 jefes de acto** y **4–5 enemigos con nombre** | — | Con perfil, alcance y habilidades |
| **Facciones** | **3–4**, con metas, enemigos y un ritmo pensado para veinte horas | — | Que el reloj no llegue al final en la hora 3 ni se quede quieto hasta la 20 |
| **Objetos** | **20–30** escritos, de ellos **8–10 con historia** (ligados a encargos o hitos) | — | Lo que se encuentra tiene que poder contarse |

**Las reglas de la variedad**, que el comprobador (M6) mira solas:

- **Nunca tres encargos seguidos del mismo verbo.** Limpiar, escoltar, investigar, negociar, robar, aguantar…
- **Cada acto cambia de sitio y de tono.** Si el acto 2 pasa en los mismos cuatro lugares que el 1, no es un acto nuevo.
- **Ningún tablero sale más de dos veces** en el hilo y los encargos escritos.
- **Cada tipo de enemigo se enfrenta de al menos dos formas distintas**: en su guarida y fuera de ella, o solo y con apoyo.

**Hecho cuando**: alguien que no conoce el mundo lo juega desde el menú, siempre sabe qué tiene entre manos (H3), nunca se encuentra un sitio donde no hay nada que hacer, y las cifras de la tabla se cumplen. Lo primero se comprueba en el navegador; lo último, con M6.

### M2–M4 · Los otros tres

Lo mismo, uno por uno, con el mismo listón. Cuatro mundos así equivalen a cuatro módulos de campaña publicados: es **la parte más grande de todo el proyecto**, y es contenido, no código.

### M7 · La mezcla

El mecanismo de la curva: una función pura que, dado el acto, el `mix` del mundo y lo que queda en el montón escrito, dice si el próximo hueco se llena **escrito**, **con la semilla** o **del chat**. Con la semilla del mundo, para que dos partidas iguales mezclen igual. Se engancha en cada sitio que llena huecos: el tablón, los sitios que se descubren (G1), la gente (G3), los encuentros (G4) y el botín (G5). **La mezcla necesita las dos mitades**: el montón escrito (M1) y los generadores conectados (G). Por eso van juntas, una detrás de otra.

### M6 · El comprobador de densidad

`tools/check-world-density.mjs`: lee un paquete de mundo y dice si llega al listón. Cuenta las cifras de la tabla y además busca huecos: una localidad sin nadie, un PNJ que no quiere nada, un tablero al que ningún encargo lleva, un rumor que apunta a un sitio que no existe, o un hito imposible de abrir. Es lo que permite escribir veinte horas sin perderse en ellas, y cumple la misma función que `check-engine-wiring.mjs` cumple con el código.

### Lo que el paquete todavía no sabe guardar

Para estas veinte horas el formato del paquete (M0) necesita secciones nuevas: **el hilo** (H1), **los rumores**, **los servicios de cada sitio** (L1), **lo que quiere y sabe cada PNJ**, **las escenas de los confidentes** y **qué encuentro va en qué tablero**. Van en el mismo paquete, y el Gem aprende a escribirlas.

### M5 · Tableros modulares para los encargos

Hoy un encargo **genera** su mazmorra. Con cinco tableros escritos por mundo, el tablón puede **elegir uno de los suyos** que encaje con el tipo de sitio (una cripta para *limpiar*, un vado para *escoltar*) y poner los enemigos del encargo. Los tableros se reutilizan y la partida no se llena de salas de piedra idénticas.

### Lo que no entra de la parte 2, y por qué

- **Púlpito con +2 a distancia, cuerdas que se cortan, vagonetas, balistas, grúas, compuertas.** Cada uno es una mecánica nueva. Los tableros se dibujan igual, y cada mecánica espera su turno en la fase T, si el mundo la pide al jugarse.
- **«Bloquea la línea de visión mágica»**: el motor no distingue magia de flechas en la línea de visión, y no merece la pena hacerlo por un tablero.

---

## 🧱 Fase T — Terreno que hace cosas

**Prerrequisito de todo lo demás en esta fase: P23.** Hoy los tipos de terreno son código (`board/terrain.js`), y cada uno nuevo debería ser una fila de datos.

| ID | Terreno | Qué hace | Por qué en este orden |
| :--- | :--- | :--- | :--- |
| **T1** | **Precipicio** | Quien acaba ahí cae: daño por altura, o sale del combate | **Empujar existe desde hoy**. Con precipicios, el puente colgante y la muralla con escalas se juegan solos |
| **T2** | **Agua con corriente** | Arrastra 5 pies por turno en su dirección | El vado del río, el canal. Es un «empujón» que da el mapa |
| **T3** | **Elevación** | Ventaja atacando desde arriba, cuesta subir | Púlpitos, murallas, plataformas de la cueva |
| **T4** | **Palanca** | Pulsarla abre o cierra puertas lejanas | Rastrillos, compuertas. Las puertas ya existen: es cablear una casilla a otra |
| **T5** | **Fuego** | Daño al entrar o al empezar el turno encima | Chimeneas, brea, antorchas. Las trampas (`board/hazards.js`) ya hacen casi esto |

---

## 🏘️ Fase L — Localidades con servicios

> **Lo que hay hoy.** Una localidad es texto y una lista de tableros. Pero los números que movería cada servicio **ya existen**: la posada y la comida en `upkeep.js`, el vínculo en `bonds.js`, los precios con reputación en `economy.js`, lo que cuesta curarse en `injuries.js` (`treatmentCost`), y los remedios de las heridas permanentes en `remedies.js`, hechos hoy. Esta fase es sobre todo **ponerles un sitio y un botón**.

| ID | Qué | Se apoya en |
| :--- | :--- | :--- |
| **L1** | **Servicios como datos por tipo de sitio.** `sitios.json` ya tiene los tipos (aldea, ciudad, puesto, santuario, campamento, puerto…). Cada tipo dice qué servicios trae, y cada localidad puede quitar o añadir. La tabla del texto (aldea: posada modesta, herrería rural, boticario…) es el punto de partida | `compendio/sitios.json` |
| **L2** | **La escena de localidad**: tarjetas de servicio con icono, encima de la lista de tableros. Pulsar una abre sus acciones | `ui/shell/exploration-scene.js` |
| **L3** | **La posada**: dormir en tres calidades (sala común, habitación, suite), comprar provisiones para el viaje, **invitar a una ronda** a un compañero (el «pasar tiempo» que ya existe, con escena de diálogo), y **escuchar rumores** (revela un sitio o un dato de un encargo) | `upkeep.js`, `bonds.js`, `needs.js` |
| **L4** | **El herrero**: los remedios de hoy pasan aquí (ver DL1), vender chatarra y reparar | `remedies.js`, `equipment.js` |
| **L5** | **La tienda / boticario**: vender botín, comprar consumibles (pociones, antídotos, fuego alquímico). El precio ya lo mueve la reputación; la escala es la del motor (−5 a +5), no la de −100 a +100 del texto | `economy.js`, `loot-items.js` |
| **L6** | **El templo**: donativo que parte por la mitad los días de una herida, quitar estados que no se van solos y **bendición**: +1d4 a la primera salvación del próximo combate (mecánica pequeña y nueva) | `injuries.js`, `abilities.js` |
| **L7** | **Quien atiende**: un PNJ por servicio. Hablar con él abre la escena de diálogo con su retrato y un saludo que depende del sitio y de lo que piensa de vosotros | `dialogue-scene.js`, PNJ del mundo |

**No entra, por ahora**: que la tienda «avise a los guardias» si os odian. No hay guardias como sistema, y un aviso que no lleva a nada es decoración.

---

## 💬 Fase C — El chat y el tablero, cosidos

> **Una corrección al texto:** dice «cero coste extra de tokens» para las ocho. **No es así** en tres: C1 cuesta unas pocas líneas por turno, y C3 y C8 una llamada cada vez. Merecen la pena, pero hay que decirlo.

| ID | Propuesta | Veredicto | Coste |
| :--- | :--- | :--- | :--- |
| **C1** | **El estado físico en el prompt**: quién está herido y cómo, PG del grupo, día, franja y tiempo | ✅ **Sí.** Parte ya va: el bloque de memoria del mundo (hoy) y quién está en el tablero. Falta la línea del cuerpo: *«Bruna cojea (pierna de palo)»*. Va en el nivel volátil, al final, para no romper la caché | ~30 tokens por turno |
| **C2** | **Fichas con tirada** | ✅ **La base se hizo hoy** (el botón *Tirada*). Falta lo contextual: *Sobornar (10 de oro)* delante de alguien concreto, que gasta oro de verdad | 0 (unos 15 tokens en el mensaje) |
| **C3** | **«Narrar este turno»**: botón opcional que manda un prompt cortísimo con lo que acaba de pasar | ✅ **Sí**, siempre opcional | Una llamada corta, solo al pulsar |
| **C4** | **Casillas de interés**: altar, estatua, cofre. Pisarlas o pulsarlas deja *[Examinando el altar]* en el chat | ✅ **Sí**, junto con P20 (interactuables) y los tableros de M1 | 0 hasta que se envía |
| **C5** | **El retrato que reacciona**: marco rojo que late por debajo del 30% de PG, resplandor dorado con vínculo 5+ | ✅ **Sí**, baja prioridad | 0 |
| **C6** | **El tablero en la escena de diálogo** | ✅ **Ya está** (A11, 2026-09-22). Lo que **no** entra: que aparezca un PNJ en el mapa porque el narrador lo cuente. El modelo narra, no crea estado; lo que sí puede aparecer es un PNJ que el motor ya conoce | — |
| **C7** | **Frases de compañeros en combate**: *«¡Lyra, aguanta!»* en un bocadillo sobre la ficha, sin llamar al modelo | ✅ **Sí, de lo mejor de la lista.** Un archivo de frases por carácter (el `wants` de cada compañero ya lo da) y por suceso: golpe, crítico, alguien cae, victoria | 0 |
| **C8** | **Epílogo automático al acabar el combate** | ✅ **Ya existe**: `buildEpiloguePrompt`, que sale por el canal que el modelo lee. Queda revisar que incluya **las heridas nuevas**, y que la pantalla vuelva sola a la escena de diálogo | Ya se paga hoy |

---

## ✅ Hecho, para no rehacerlo

### M0 y H1–H4 — 2026-09-23

| Pieza | Qué hace | Lógica · pruebas | Conectado | En el navegador |
| :--- | :--- | :--- | :--- | :--- |
| **M0** | Un mundo de `mundos.json` con `pack` carga su paquete al elegirlo, lo comprueba, y enseña lo que trae en los pasos de localidades, tableros, facciones, gente y misiones. Conserva su semilla y su tablón (antes el importador los perdía, también en los libros) | `campaign/taller.js` (`carriesPack`, `packContents`) · 4 | `ui/taller/taller.js`, `campaign-wizard.js` | Paso 47 del recorrido ✅ |
| **H1** | El hilo como datos: hitos con qué los abre, qué piden y qué cambian. Un final cierra el resto | `campaign/plot.js` · 16 | Sucesos desde viajar, ganar, derrotar, entregar encargos, tiradas, días, relojes de facción y nombrar a alguien al hablar | Paso 48 ✅ |
| **H2** | La mecha: la primera escena llega al narrador al crear la campaña | — | `beginCampaignPlot` tras crear el personaje | Paso 48 ✅ |
| **H3** | «Lo que tienes entre manos»: línea fija arriba en el Modo Juego y primera línea del bloque del narrador | `world-memory.js` · 1 | `renderFocus`, `refreshWorldMemoryPrompt` | Paso 48 ✅ |
| **H4** | Hilo de la facción más peligrosa para los mundos sin hilo escrito, con «llegasteis tarde» si su reloj se llena | `plotFromFaction` · 5 | Las campañas viejas lo reciben en silencio al abrirse | Por pruebas; en el navegador solo el escrito |

**Sitios escondidos**: el paquete puede marcar una localidad con `hidden: true`. Vive en `hiddenLocations`, fuera del mapa, hasta que un hito la revela.

**Lo que falta del paquete para M1** (no hecho): facciones vivas (sede, enemigos, meta, reloj), caminos con días entre localidades, rumores, servicios, lo que quiere cada PNJ y el hilo dentro del esquema que lee el Gem de campañas.

---

## 🔗 Enlaces

- [[POR_HACER]] — el marcador de tareas
- [[ROADMAP_MAESTRO]] — el mapa de los demás mapas
- [[GEM_CREAR_CAMPANA]] — el formato en el que se escriben los mundos de la fase M
- [[DISENO_GENERADOR_MUNDOS_PROFUNDO]] — de donde salen P20 y P23
