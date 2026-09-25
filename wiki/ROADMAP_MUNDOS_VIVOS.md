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

### Batería 7 de [IDEAS_200](IDEAS_200.md) — 2026-09-24

VERIFICACION7_PENDIENTE

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **8** Lanzar lo que hay a mano | Con una caja, un barril o una silla al lado (la media cobertura), «Lanzar lo que hay a mano» sale en las maniobras: con la Fuerza, 1d6 si le da, y la caja se rompe al caer | `combat/throwables.js` (`SCENERY`) |
| **23** Terreno que cambia | Al empezar cada ronda, el fuego prende en lo que arde de al lado (cajas, puertas de madera y, a cielo abierto, maleza), lo deja en nada y se apaga a las tres rondas; con lluvia, se apaga. Una puerta que arde o que se abre a golpes queda rota: ya no se cierra | `board/living-terrain.js`, `terrain.js` (`breakDoor`) |
| **28** Aprobación visible | Pagar o plantar cara, soltar o entregar a un prisionero, huir, cómo se cumple un hito y los encargos: a cada compañero le parece bien o mal según lo que busca (👍/👎), suma o resta un punto de vínculo, y su ficha dice lo último que le ha parecido | `campaign/approval.js` |
| **30** Encargo personal | Al llegar a vínculo 3, cada compañero pide lo suyo (una deuda, una venganza, poner a salvo a alguien…). Va al tablón con su nombre, y cumplirlo cuenta el doble para el vínculo | `campaign/personal-quests.js` |
| **32** Roces | Si a uno le parece bien y a otro mal, chocan: se dice, el narrador lo cuenta, y ese día pesa en la moral del grupo | `approval.js` (`frictionOf`), `company.js` |
| **42** Banquillo | En el gremio se deja a alguien en casa y se le llama (tarda un día). Con el grupo lleno, el nuevo que se contrata se va a casa | `campaign/bench.js` |
| **58** Rehacerse | En el templo se vuelven a elegir las mejoras de nivel, las que se quieran, a 30 de oro cada una | `rules/respec.js` |
| **59** Idiomas | Cada uno habla lo de su raza (la ficha lo dice). Con alguien que habla otra lengua (`idioma` en el guion), si nadie la entiende, las tiradas de trato van con desventaja; si alguien sí, traduce | `rules/languages.js` |
| **62** Juegos de equipo | En la ficha se guarda lo que se lleva con un nombre («Combate») y se vuelve a ello de un clic. Lo maldito se queda | `rules/equipment-sets.js` |
| **67** El campamento | Donde no hay posada, «Acampar aquí»: fuego (abriga y deja cocinar, pero se ve), quién hace guardia, con quién se charla y buscar qué cenar. De noche puede acercarse algo: quien vigila tira Percepción, y si no lo ve, roba oro | `campaign/camp.js` |
| **74** Estaciones | Cuatro de 56 días, en el reloj. Un camino puede pasarse solo en su estación (`estaciones` en el guion), y el tiempo cambia con ella | `world/seasons.js`, `travel.js` |
| **87** La gente se muda o muere | Cuando una facción toma un sitio (o cae), alguno de los de allí muere y otro se va al de al lado; y de vez en cuando alguien se muda. Nunca quien necesita el hilo | `world/people-fate.js` |
| **97** Bichos que migran | Los que dicen sus estaciones (`estaciones` en el guion) solo salen en ellas, en los encargos y en lo que se descubre | `seasons.js`, `bestiary.js` |
| **116** Encargos que te nombran | Uno del tablón te busca a ti, por tu trasfondo: al soldado, un viejo compañero de armas; al noble, su familia | `campaign/named-contracts.js` |
| **120** Mejorar armas | En la herrería, algo duro (un colmillo, una garra) y 80 de oro dejan el arma a +1. Y el «+1» de un arma por fin suma al ataque y al daño | `campaign/trophies.js`, `equipment.js` (`weaponBonus`) |
| **121** Materiales de caza | Las bestias dejan pieles, colmillos, garras… Con dos pieles, el herrero hace una capa que abriga (se duerme en la nieve sin fuego) | `trophies.js` |
| **139** El narrador ofrece objetos | `dar_objeto`: lo que el narrador pone a mano sale en la fila como «Coger: …». Entra lo que el juego conoce; lo mágico o desconocido, como una curiosidad que no hace nada | `campaign/item-offers.js` |
| **142** Tono por escena | En la pausa: automático (en combate, tenso), tenso, cómico, sombrío o épico. Es una frase al final del prompt | `campaign/scene-tone.js` |
| **145** Retrato en línea | Cuando habla alguien del mundo o del grupo («—dice Giles»), su párrafo lleva su cara o sus iniciales | `ui/shell/speakers.js` |
| **163** Repartir | En la ficha, arrastrar un objeto a la cara de otro, o «Dar a…» | `rules/give-item.js` |
| **180** Semilla compartible | En la pausa, «Compartir este mundo»: `semilla@origen`. Pegado en la semilla del taller, pone la semilla y elige el mundo de partida | `campaign/share-code.js` |
| **186** Sonidos por acción | Golpe, crítico, fallo, puerta, monedas y subir de nivel, hechos al momento (sin archivos). Se apagan en «Sonido» | `ui/shell/action-sounds.js` |

### Batería 6 de [IDEAS_200](IDEAS_200.md) — 2026-09-24

Comprobada en el navegador en el paso 57 del recorrido (18 comprobaciones; la 46 en el paso 31, al subir de nivel), salvo tres cosas que van por pruebas: la caída al precipicio que se ve (189, es una animación), la noche (90: en el navegador se ha probado la niebla, que es el mismo mecanismo) y la desventaja al atacar lejos con niebla o viento (73: se ve el aviso al empezar el combate).

Y tres arreglos que salieron por el camino: **la barra de SillyTavern en la pausa** (venía de antes: al pausar, sus iconos quedaban en columna por el centro de la pantalla, encima del menú, y «Opciones» no se podía pulsar), **las respuestas sugeridas salen al momento** (no aparecían hasta que pasaba otra cosa) y **una pista suelta cuenta** (una tirada que solo sumaba una pista no se guardaba, y la investigación no avanzaba nunca).

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **101** Varias formas de cumplir un hito | `pide` como lista: luchar, hablar o colarse; cualquiera lo cumple, y se apunta cuál («Cumplido (con maña)») | `plot.js` (`any`) |
| **102** Bifurcaciones | `cambia: { cierra: [...] }`: cumplir uno cierra otros, que ya no se abren. El diario los apunta en «Caminos cerrados» | `plot.js` (`close`) |
| **107** Investigaciones | `pide: "pistas: N"` y `pistas:` con sitio y tirada. Cada tirada buena en su sitio es una pista; el diario dice cuántas van y cuáles faltan | `plot.js` (`clues`), `cluesOf` |
| **109** Epílogo por compañero | Al final, qué fue de cada uno: por su vínculo, si venía por el oro y si llegó vivo (el caído, con su epitafio) | `campaign/epilogues.js` |
| **110** Secretos que se destapan | Sonsacar (Perspicacia, una vez al día): el secreto pasa a la ficha que lee el narrador y al diario. `/sonsacar Giles` | `campaign/npc-secrets.js` |
| **144** Respuestas sugeridas | Al hablar con alguien del sitio, la fila ofrece «¿Qué se cuenta?», «¿Qué necesitas?» y sonsacarle | `ui/shell/replies.js` |
| **4** Preparar golpe | Maniobra nueva: el primer enemigo que se te acerque antes de tu turno se lleva un golpe antes de actuar | `combat/readied.js` |
| **24** Reacción de jefe | Un jefe contesta en el acto al que le pega, una vez por ronda. Y los jefes del guion ya son jefes en el tablero (antes se perdía la marca al importar) | `combat/boss-reaction.js` |
| **73** El tiempo en combate | Niebla o tormenta: más allá de 30 pies, con desventaja; nieve, 60; viento, lo que se tira se desvía; lluvia, el aceite no prende. Se dice al empezar el combate | `world/visibility.js` |
| **90** Noche en los tableros | De noche y a cielo abierto, más allá de 30 pies no se ve (60 con antorcha o farol); la niebla de guerra se cierra igual | `visibility.js` |
| **46** Subir de nivel como momento | Además de los números, una mejora a elegir entre tres: reflejos, mano firme, piel dura, labia… Cada una se nota donde toca | `rules/level-perks.js` |
| **54** Maestros | En pueblos y ciudades, alguien enseña un par de habilidades de tu oficio: 50 de oro y dos días | `campaign/masters.js` |
| **65** Papeles de viaje | Guía (Supervivencia: un día menos), vigía (Percepción: se esquiva un contratiempo) y cazador (comida para todos), cada uno con su tirada. Supervivencia es habilidad nueva | `world/travel-roles.js` |
| **129** Monturas | Mula o caballo en el establo de la posada; con montura para todos se llega antes. Comen: pienso cada semana | `world/mounts.js` |
| **128** Dados en la taberna | A veintiuno: se apuesta, se piden dados, se planta; y se puede hacer trampa (Juego de manos). Tres partidas al día | `campaign/tavern-dice.js` |
| **160** Cargar partida de un vistazo | Cada partida dice el día, el sitio, lo que hay entre manos y quién va (con sus caras) | `campaign/save-card.js` |
| **181** ¿Llega al listón? | El comprobador de densidad, desde la pausa, con el encargo para el Gem listo para copiar. La herramienta usa el mismo módulo | `campaign/world-density.js` |
| **189** Caída al precipicio | Quien cae al vacío se ve caer | CSS |
| **192** Transiciones | El viaje se ve pasar: el sitio y los días, en una franja que se va sola | CSS |
| **195** Letra del narrador | En la pausa: de libro, a pluma o de máquina. Es de la campaña | CSS |

### Batería 5 de [IDEAS_200](IDEAS_200.md) — 2026-09-24

Comprobada en el navegador en el paso 56 del recorrido (24 comprobaciones), salvo tres cosas que van por pruebas: que esconderse dé de verdad la ventaja en el golpe siguiente (11; en el navegador se ve el botón y por qué no se puede), la historia del botín (119, que sale con lo que caiga) y lo que hace un objeto maldito al ponérselo (135: resta y no se suelta; el templo sí se ha probado).

Y tres arreglos que salieron por el camino, porque el recorrido los tapaba: **la muerte ya es para siempre** (un descanso largo levantaba a los muertos y seguían en la iniciativa), **por el camino se duerme y se bebe** (un viaje de cuatro días mataba de sed o de sueño aunque se saliera comido; el paso rápido sigue debiendo el sueño) y **lo ya visto del tablero se dibuja** (trampas descubiertas, el aceite que arde).

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **5** Caras en la iniciativa | Cada fila de la barra de iniciativa lleva la cara de quien actúa, o su inicial | `buildTracker` (`avatar`) |
| **11** Esconderse | Maniobra nueva: con cobertura media o más frente a **cada** enemigo, Sigilo contra su mejor Percepción pasiva. Si sale, el próximo ataque va con ventaja y a quien se esconde se le pega con desventaja; dura hasta que ataca o hasta el final de su turno siguiente | `maneuvers.js` (`canHide`, `hideDC`) |
| **20** Filtros del registro | Todo · Tiradas · Daño, y de quién. «Mis tiradas» es Tiradas más tu nombre | `filterLog` |
| **122** Aceite y red | Se lanzan desde las maniobras (o `/maniobra lanzar red Goblin`). El aceite: 2d4 de fuego y la casilla arde para el primero que la pise, aunque falle; **el charco se ve en el tablero** (y con él, cualquier trampa ya descubierta, que antes no se dibujaba). La red: sujeto dos rondas. Siempre en la tienda. Y ahora **sujeto** da ventaja contra él y desventaja a sus golpes, como en 5e | `combat/throwables.js` |
| **146** Un formato para las tiradas | «🎲 Persuasión de Bran: 15 contra CD 12 ✓ Éxito (d20 12 +3)»; ataques, daño, agarrar y empujar igual. Se acabó el «vs AC» | `rules/roll-line.js` |
| **36** Muertes con peso | Epitafio con lo que hizo; tumba donde cayó (se ve al volver y el narrador lo sabe); lo mejor que llevaba pasa a quien más le quería. Y **la muerte ya es para siempre**: antes, un descanso largo levantaba a 1 PG a quien estaba a 0, muertos incluidos, y el muerto seguía tirando iniciativa. Ahora no descansa, no pelea, no sale en el tablero ni en las fichas de hablar | `campaign/legacy.js`, `rest.js` |
| **199** Salón de la fama | Los caídos de todas las partidas, en el menú principal. Se guarda en los ajustes de SillyTavern, no en una campaña | `legacy.js` |
| **37** El retirado entrena | Puesto nuevo en el gremio, **maestro de armas**: cada semana, quien va por detrás del mejor del grupo gana 150 de experiencia | `trainingFor` |
| **45** Frase al llegar | El guion escribe una frase por confidente y sitio (`al_llegar`); se dice una vez, si va en el grupo, sin llamar al modelo | `arrivalLines` |
| **52** Fama por pueblo | Entregar un encargo, ganar un tablero o cumplir un hito en un sitio da fama allí: «os conocen» (−5 % en la tienda), «sois alguien» (−10 %), «sois los héroes del sitio» (−15 %). El narrador lo sabe y el diario lo dice | `campaign/fame.js` |
| **71** Paradas del camino | Un pozo, un santuario, una venta o un refugio: la sed, la vida, el hambre o el sueño. Con el azar del viaje | `roadStop` |
| **84** El acero con la guerra | Con una facción conquistando o destruyendo, armas y armaduras +20 %; +35 % donde manda ella | `warPressure` |
| **106** Plazos | Un hito puede tener días para cumplirse desde que se abre. Se dice en el diario; si pasa, se pierde y ocurre lo de `si_no` | `plot.js` (`within`, `late`) |
| **111** Hitos ocultos | No salen en pantalla ni en el diario hasta que se cumplen; el diario cuenta «Secretos de la historia (1 de 2)» y el final también | `visibleOpen`, `secretsOf` |
| **114** El presagio | Tres frases al empezar, al narrador y en el chat. Cada una se cumple con su hito, y se dice | `omensOf` |
| **132** Reliquias | Un objeto `ligado_a` un hito o un encargo ya no cae como botín: llega al cumplirlo, una vez, con su historia. 1387 tiene diez | `campaign/relics.js` |
| **119** Botín con historia | Lo que cae de poco común para arriba dice de quién fue: «Fue de Brunilda, que lo perdió a los dados en El Peaje Norte» | `campaign/item-lore.js` |
| **135** Objetos malditos | Lo equipable que cae puede estar maldito, y cae sin identificar. Maldito y puesto: −2 a una característica (como una herida) y no se suelta. El templo lo mira (5 de oro) y lo quita (40) | `item-lore.js` |
| **125** Prestamista | En la tienda: pedir 50 o 100 de oro (+25 % en 14 días) y devolverlo antes de que vengan a cobrar | `borrow`, `repay` |
| **141** El muerto que habla | Si el narrador hace hablar a alguien que ha muerto, sale un aviso (y se puede regenerar) | `contradiction-log.js` |

**Para el Gem**: los campos nuevos (`oculto`, `plazo`, `presagio`, `al_llegar` y lo que significa `ligado_a`) están en [GEM_GUIONISTA](GEM_GUIONISTA.md). La [ronda 9 de 1387](guiones/1387/ronda-9-claude.md) los usa: la escribí yo para que se vean, y el Gem la puede reescribir entera.

### Batería 4 de [IDEAS_200](IDEAS_200.md), con la tienda (L5) — 2026-09-24

Comprobada en el navegador en el paso 55 del recorrido (y la 198 en el 49), salvo: la soltura con un arma (55), «llegasteis tarde» por grados (117), decir el coste en las facciones rivales (104) y las fichas agrupadas (169), que van por pruebas; y «rellena los huecos» (182), que es de la herramienta.

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **L5** La tienda | En los sitios con tienda: comprar, vender y regatear. El precio sale del objeto, de lo caro que esté el sitio y de lo que os aprecie quien manda | `campaign/shop.js` |
| **134** Género de la semana | Cada semana, lo que traiga el carro (con la semilla); quien os aprecia saca algo de la trastienda | `weeklyStock` |
| **127** Precios que dicen por qué | «+15 %: han cerrado el paso · −10 %: Vane os aprecia · −15 %: habéis regateado» | `priceToday` |
| **118** Vender la chatarra | Todo lo común que no lleva nadie puesto, de un clic. Lo puesto y las llaves no se venden | `junkOf` |
| **126** Regatear | Persuasión CD 12, una vez al día en cada tienda: −15 % ese día | `haggle` |
| **89** Fiestas | Cada pueblo tiene su día de fiesta al mes: comida gratis en la posada, −10 % en la tienda; la lista de viaje avisa si se acerca | `world/festivals.js` |
| **113** Cartas | Quien os aprecia (+3) ofrece trabajo; quien os odia (−3) amenaza; el prestamista avisa antes del vencimiento. Se recogen en la posada | `campaign/letters.js` |
| **117** Llegasteis tarde, por grados | A la mitad y a tres cuartos de la meta de una facción, una noticia | `clockWarnings` |
| **104** Cadenas con coste | Lo que se gana con unos se pierde con sus enemigos, y ahora se dice | `settleFactionStake` |
| **55** Soltura con un arma | 15 golpes con la misma arma: +1 al daño con ella | `feats.js` |
| **61** El arma en la ficha | En el grupo de un vistazo y en la ficha del tablero | glance, `buildTokens` |
| **137** Leer la intención | Mientras escribes «intento convencer…», sale «🎲 Persuasión»; la tirada va delante sin borrar lo escrito | `campaign/intents.js` |
| **148** Modo ahorro | En el menú de pausa: fuera el estado del grupo, memoria del mundo a lo justo | `worldMemoryBlock` (`compact`) |
| **149** Largo de la narración | En el menú de pausa: breve, normal o extenso, sobre lo de la ficha del narrador | `campaign/narration.js` |
| **155** Ayuda la primera vez | Un consejo la primera vez en cada escena, al viajar y con el primer prisionero | `ui/shell/tips.js` |
| **156** Glosario | CA, CD, ventaja, iniciativa… en llano. Tecla L o desde «¿Qué hago?» | `tips.js` |
| **169** Fichas agrupadas | Si no caben, la última dice «+N más» y las abre todas | `action-chips.js` |
| **172** Daltonismo | Azul y naranja en vez de verde y rojo, y bordes discontinuos en los enemigos | CSS |
| **182** Rellena los huecos | `node tools/check-world-density.mjs <paquete> --gem` escribe el encargo para el Gem | herramienta |
| **198** Dificultades con nombre | Historia, Veterana y De hierro en el taller, que afinan los interruptores | `DIFFICULTIES` |
| **200** La partida en números | En el diario siempre, y al final de la partida | `campaign/stats.js` |

### Batería 3 de [IDEAS_200](IDEAS_200.md) — 2026-09-24

Comprobada en el navegador en el paso 54 del recorrido, salvo: empujar a lo peligroso (9), la jugada combinada (17) y el duelo (43), que dependen de dados o de una muerte y van por pruebas; y «que actúe solo» (18), que solo sale en el modo en que llevas a todo el grupo.

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **7** Prisioneros | Quien se rinde queda con el grupo: interrogarle da un rumor; entregarle donde hay tablón o templo, 10 de oro y buena fama; soltarle, nada | `campaign/prisoners.js`, `/prisionero` |
| **9** Empujar a lo peligroso | Si detrás hay una trampa o fuego, lo pisa el empujado | `shovedInto` |
| **10** Agarrar | Quinta maniobra: Atletismo enfrentado; el agarrado no se mueve hasta tu próximo turno | `maneuvers.js`, `heldInPlace` |
| **17** Jugada combinada | Rematar a quien otro de los tuyos tiró al suelo esta ronda: +1d4 | `noteKnockdown`, `takeCombo` |
| **18** Que actúe solo | En el modo en que los llevas a todos, el turno de un compañero lo juega la máquina con su postura | barra de combate |
| **21** Estados explicados | «Agarrado: no se puede mover hasta que le suelten», en la ficha del tablero | `STATUS_ICONS` |
| **35** Va primero a… | En la ficha del compañero: al más débil, al más cercano, a los tiradores o al jefe | `byPreference` |
| **39** Moral del grupo | Vínculos altos y enteros, +1 a la iniciativa; hambre, heridas o luto, −1 | `campaign/company.js` |
| **41** Oficios de campamento | Rastreador (forrajea con ventaja), sanador (cura tras descanso corto), centinela (+1 iniciativa), buscavidas (descuento del mercader), erudito (pistas un día antes) | `company.js` |
| **43** Duelo | Si muere alguien, quien busca calma o estaba muy unido pide un día; pesa en la moral | `company.js` |
| **57** Historia de cada uno | Desde el grupo de un vistazo: lo que ha hecho y le ha pasado, por fecha | `heroStory` |
| **72** Atajos | A veces, al oír un rumor, alguien menciona un camino de pastores: un día menos, para siempre | `world/road.js` |
| **77** Llaves | Puertas cerradas con llave (`L` en los mapas): con llave, con maña (Juego de manos) o a golpes; el que manda en el tablero suelta la llave | `terrain.js`, `tryUnlock` |
| **88** Cazarrecompensas | Con una facción a −3 o menos, en el camino: pagar o plantar cara (Intimidación) | `roadEncounter` |
| **92** Mercader ambulante | Género raro en el camino, se compra o no | `roadEncounter` |
| **95** Crónica | El diario trae lo que ha pasado, lo último arriba; las noticias también quedan | `buildJournal` |
| **150** Rehacer la respuesta | Bajo quien habla: «otra vez», «más corto», «más intenso» | `retryLastReply` |
| **151** Hablar con… | La gente del sitio, no solo los tuyos, en la fila de fichas | `action-chips.js` |
| **152** Atajos de teclado | D diario, G grupo, H ayuda, B avisos, T dados, ? chuleta | `ui/shell/shortcuts.js` |
| **168** Historial de dados | Media, veintes, unos y cuántas salieron, con veredicto | `campaign/dice-log.js` |

**Nuevo en los mapas del Gem**: `L`, puerta cerrada con llave. Y una habilidad más, **Juego de manos**.

### Batería 2 de [IDEAS_200](IDEAS_200.md) — 2026-09-24

Comprobada en el navegador en el paso 53 del recorrido; el flanqueo (3), los críticos con efecto (15), los rasgos (47), los apodos (44), comparar objetos (63) y las trampas a la vista (78), por pruebas (dependen de dados o de muchos combates).

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **1** Golpes al moverse | La ruta que te saca del alcance de un enemigo sale en rojo: «25 ft · te golpea Lobo» | `previewMovement`, renderizador |
| **3** Flanqueo | Un aliado pegado al objetivo por el lado contrario da ventaja cuerpo a cuerpo. Vale para los dos bandos, y la vista previa lo cuenta | `combat/crits.js` (`isFlanked`), `attackEdge` |
| **6** Moral | Quien no es jefe, malherido y con su bando por la mitad, puede rendirse (el cobarde antes). Si no queda nadie, se gana | `breaksMorale` |
| **13** Rol en el icono | Bruto, tirador, guardián, escaramuzador, cobarde, lanzador o jefe, en la esquina de la ficha | `roleOf` |
| **15** Críticos con efecto | Contundente derriba, cortante sangra (+1d6), perforante deja clavado | `critEffect` |
| **190** Gritos de enemigos | Según cómo pelean (y el jefe, a su manera), sin tokens | `chooseEnemyBark` |
| **188** Números flotantes | El daño sale de la ficha; el crítico, más grande | `floatOnToken` |
| **164** Detalle de casilla | Bajo el ratón: «Casilla (2, 2) · Terreno difícil: cada casilla cuesta el doble» | `describeCell` |
| **153** ¿Acabar el turno? | Si aún puedes atacar a alguien, pregunta antes | `confirmEndTurn` |
| **38** Qué quiere ahora | Una línea en la ficha del compañero, primero el cuerpo y luego lo que le mueve | `campaign/feats.js` |
| **44** Apodos | «Tres Vidas», «el Escudo», «Mano de Hierro», «Siegavidas», «Mil Cicatrices». El primero que se gana se queda | `feats.js` |
| **47** Rasgos | Cinco tumbados de lo mismo: +1 al atacarles | `feats.js` |
| **56** Cicatrices | Una herida curada deja marca: +1 a Intimidación, hasta +2 | `feats.js`, `skillModifier` |
| **63** Comparar | La pantalla de victoria dice a quién le viene mejor lo que habéis sacado | `compareItem`, `bestFor` |
| **68** Cazar y forrajear | Fuera de los pueblos: gasta un rato, tira Percepción (más fácil en el bosque) y da de comer | `campaign/forage.js`, `/forrajear` |
| **78** Trampas a la vista | Al pasar al lado de una, la Percepción pasiva la descubre | `passiveSpot` |
| **81** Pendientes por sitio | La lista de viaje dice «Pendiente: tu encargo · 2 encargos · 11 rumores» | `pendingByPlace` |
| **86** Saludos con memoria | El narrador sabe qué se recuerda de vosotros en el sitio donde estáis | `worldMemoryBlock` (`here`) |
| **91** Rumores que se enfrían | El diario dice cuándo se oyó cada uno; pasados 14 días, «ya frío» | `buildJournal` |
| **108** Anteriormente… | Al abrir una partida jugada, una tarjeta con lo justo para retomar. No tapa nada | `buildRecap` |

**Y la 27, ampliada**: seis frases por caso, sin repetir la última, y cada confidente con su carácter (oro si va por dinero; si va por el vínculo, según su oficio).

### Las 20 primeras de [IDEAS_200](IDEAS_200.md) — 2026-09-24

Todas con pruebas propias y comprobadas en el navegador en el paso 52 del recorrido (la 49, también en el 49; la 174 es de la herramienta y se comprueba en consola).

| Idea | Qué hace | Módulo |
| :--- | :--- | :--- |
| **2** Vista previa del golpe | La tarjeta del enemigo dice «62 % de acertar, con ventaja (está en el suelo) · 4–11 de daño · puede tumbarlo», con las mismas cuentas que la tirada | `combat/forecast.js` |
| **14** Intenciones | La barra de combate dice a por quién va cada enemigo, y su tarjeta también. Es el mismo plan que ejecuta su turno | `forecast.js`, `planFor` |
| **22** Huir con precio | «Abandonar» dice antes lo que cuesta: cada enemigo pegado da un golpe al darse la vuelta (destrabarse lo evita), se deja el botín y queda en la memoria | `combat/retreat.js` |
| **191** Pantalla de victoria | Quién hizo cuánto, quién tumbó a quién, el botín y quién cayó. No tapa: se cierra sola | `combat/tally.js` |
| **26** Reclutar confidentes | En la posada: «Conocer a…» (el narrador cuenta su escena) y luego «Contratar» (25 de oro si va por dinero) o «Pedir que venga». Sus escenas de vínculo por fin se cuentan al subir de rango | `campaign/recruit.js` |
| **27** Opinan | Al aceptar un encargo, hasta dos compañeros dicen lo que les parece según lo que quieren. Lo que no les importa no lo comentan | `opinionOf` en `barks.js` |
| **34** Recuerdos compartidos | Rescates, caídas y fichajes quedan como recuerdos; el narrador lee los tres últimos y salen en las rondas de la posada | `campaign/memories.js` |
| **49** Trasfondo | En el creador, se propone solo con lo que escribes («militar jubilado» → Soldado veterano), da competencia en dos tiradas y un contacto que el narrador conoce | `campaign/backgrounds.js` |
| **64** Ritmo de viaje | Rápido (menos días, se llega sin dormir), normal o con cuidado (más días, la mitad de los contratiempos se esquivan) | `world/travel-choices.js` |
| **66** Contratiempos con elección | Cada suceso que retrasa pregunta: rodear, o forzar el paso con Atletismo (si falla, daño y el tiempo igual). El `/go` escrito no pregunta | `travel-choices.js` |
| **82** Noticias al llegar | Lo que hacen las facciones lejos se guarda y se cuenta al llegar a donde se oye | `world/news.js` |
| **85** Consecuencias | Cada sitio tiene fortuna: cumplir allí abre un servicio al segundo; dejar caducar, lo cierra. Se ve en la exploración | `world/fortune.js` |
| **100** Diario | Botón «Diario»: el hilo, las pistas dadas, el encargo, lo oído (con quién y adónde lleva) y lo que se recuerda | `campaign/guidance.js` |
| **103** Pistas que escalan | A los 3 días sin avanzar, una pista que apunta; a los 6, una que dice qué hacer. Llega por boca de alguien | `guidance.js` |
| **136** «¿Qué hago?» | Todo lo que se puede hacer ahora, junto y pulsable | `guidance.js` |
| **138** El narrador pide tiradas | Herramienta `pedir_tirada`: sale una ficha «Tirar Persuasión (convencer a Giles) · CD 14», y el dado lo tira quien juega | `campaign/check-requests.js` |
| **147** Tokens a la vista | Arriba, «≈3.2k por turno · sesión 41k» (y el precio si lo has puesto), en rojo si un turno pasa de 6000 | `describeMeter` |
| **159** Bandeja de avisos | Los avisos se guardan (los repetidos juntos) y nunca hay más de tres en pantalla. Campanita con los sin ver | `ui/shell/notices.js` |
| **162** El grupo de un vistazo | Vida, heridas, hambre y sed, estados, vínculo y oro de todos en una ventana | `notices.js` |
| **174** Errores del guion | El conversor junta todos los errores, dice ronda, línea, causa y arreglo en castellano, y sitúa los fallos del paquete en su ronda | `campaign/guion-errors.js` |

**Arreglos de paso**: el héroe no llevaba el trasfondo al grupo (salía de otra función); los relojes de las facciones también guardan el mundo en fila.

### G, M7, T1, L1–L3, C1 y C7 — 2026-09-23

| Pieza | Qué hace | Lógica · pruebas | En el navegador |
| :--- | :--- | :--- | :--- |
| **G1–G2, G4** | Ficha «Explorar los alrededores» (`/explorar`): gasta un bloque del día y descubre un sitio con camino, tablero y bichos de su bioma. Tope de 18 sitios | `world/growth.js` | Paso 50 ✅ |
| **G3** | Al llegar a un sitio con poca gente se escribe la que falta, y se cuenta al narrador | `peopleWanted` | Paso 50 ✅ (en un sitio descubierto) |
| **G5** | El botín de rango alto saca objetos de la forja | `awardEncounterLoot` | Solo por pruebas |
| **G6** | La herramienta `proponer_sitio`: el narrador propone, no crea. Sale una ficha para ir a buscarlo | `addProposal`, `takeProposal` | Paso 50 ✅ |
| **M7** | La curva 80/60/40/10 decide escrito, semilla o chat en el tablón y en la gente | `campaign/mix.js` | Paso 49 ✅ (tablón) |
| **T1** | Precipicio (`v` en los mapas): empujar a alguien dentro lo saca del combate | `terrain.js`, `resolveShove` | Se dibuja: paso 51 ✅. El empujón al vacío, solo por pruebas |
| **L1–L3** | Servicios por tipo de sitio, tarjetas en la exploración; la posada: sala común, habitación, comida, rumores y hablar con quien atiende | `campaign/services.js` | Paso 51 ✅ |
| **L4 (DL1)** | Los remedios solo se compran donde hay herrería; la ficha dice dónde hay una | `smithHere` | Paso 46 ✅ |
| **C1** | «Cómo está el grupo» al final del prompt, cada turno | `campaign/body.js` | Paso 51 ✅ |
| **C7** | Frases de compañeros en combate según lo que quiere cada uno, sin llamar al modelo | `combat/barks.js` | Solo por pruebas |

**Arreglos de la misma tanda:**

- **El personaje encaja con el mundo.** El creador solo ofrece las razas y clases que el mundo eligió, y enseña «Así empieza tu historia» con la primera escena del hilo. El narrador recibe quién es el personaje junto con la mecha, y la orden de no contradecir su pasado. Paso 49 ✅.
- **La copia de un narrador sale con su cara.** Elegir un narrador de otra campaña no copiaba la imagen, y la cara subida en «Su cara» no se guardaba. Paso 49 ✅.
- **Las escrituras del mundo van en fila.** Al llegar a un sitio, el hilo, la gente y la reputación guardaban el archivo del mundo a la vez, y el último borraba lo de los demás (la cueva revelada no salía). Paso 48 ✅.

### M1 y M6 — 1387, escrito entero — 2026-09-23

El guion del Gem (`wiki/guiones/1387/ronda-1…7`) más una ronda de correcciones (`ronda-8-claude.md`, con el porqué de cada cambio) se convierten con **`tools/guion-a-paquete.mjs`** en `public/mundos/1387.pack.json`, y `mundos.json` apunta a él. El mismo conversor sirve para la costa, el ocaso y la pantalla.

| Pieza | Qué hace | Pruebas |
| :--- | :--- | :--- |
| **El paquete aprende** | Facciones vivas (sede, dominios, enemigos, meta con ritmo), caminos con días, bioma y servicios, PNJ (quiere, sabe, voz; el secreto no va al narrador), rumores, encargos escritos, habilidades nuevas y finales | `game-engine-world-1387` · 8 |
| **Encargos escritos** | Salen en el tablón por acto y por cadena, mezclados con los generados según la curva (80/60/40/10 %). Los de combate se entregan al ganar su tablero; los que no tienen pelea, con una tirada buena en su sitio. Su giro se cuenta al cumplirlos | `written-contracts.js` · 6 |
| **Rumores** | Ficha «Escuchar rumores» en cada sitio con algo que oír (`/rumor`). Uno cada vez, sin repetir, sin decir si es verdad; el que lleva a un sitio escondido lo pone en el mapa | `rumors.js` · 2 |
| **Finales según el bando** | Un hito puede acabar la partida con un final que decide la facción que mejor os mira, y se narra su escena | `plot.js` · 3 |
| **M6** | `tools/check-world-density.mjs`: cuenta contra el listón y busca huecos (referencias rotas, sitios inalcanzables, hitos que no se abren, lugares sin nada que hacer, tres encargos seguidos del mismo verbo) | 1387: **llega al listón** |

**1387 hoy**: 16 hitos y 3 finales, 15 encargos (8 sin pelear, 3 cadenas), 7 sitios + 4 que se descubren, 22 PNJ, 5 confidentes con 5 escenas cada uno, 14 tableros y 16 combates, 15 bichos con 3 jefes, 3 facciones, 23 objetos y 26 rumores.

**Lo que no está, dicho claro:**

- **Reclutar a los confidentes.** Existen en el mundo como gente con sus escenas escritas, pero todavía no hay forma de que se unan al grupo (la *plantilla*, pendiente desde A11). Sin eso, sus escenas de vínculo no se disparan.
- **La mezcla (M7) solo toca el tablón.** La gente, los encuentros y el botín todavía no se mezclan con lo generado: eso llega con la fase G.
- **Los servicios se guardan pero no tienen botón** (fase L), y las `mecanica_pendiente` de los tableros esperan a la fase T.

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
