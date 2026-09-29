---
title: Roadmap — Sin tokens
tags: [roadmap, sin-tokens, motor, narrador, charlas, sucesos, tiradas, profundidad]
created: 2026-09-27
updated: 2026-09-27
author: DanielJHesseling / Claude Opus 5.5
---

# 🎲 Sin tokens: divertido sin modelo, mejor con él

> **Qué es esto.** El plan que sigue a [[ROADMAP_PROFUNDIDAD]]. La meta es tuya, dicha el 2026-09-27: **un juego divertido de jugar sin gastar un solo token, que mejore mucho cuando sí se gastan.** Hoy el motor ya decide casi todo, pero en demasiados momentos **se calla y espera a un narrador** que, sin modelo, no llega. Este plan hace que el motor también cuente, y deja al modelo como lo que debe ser: la mejora, no la llave.
>
> **De dónde sale.** De un repaso del código hecho el 2026-09-27 en tres partes: dónde se gastan tokens, qué hace el motor solo, y qué dicen ya tus planes. Lo que es un hecho del código va con su archivo, y los tres atascos de la sección 1.3 están comprobados a mano. Lo que es opinión, lo digo como opinión.
>
> **Las reglas que respeto.** El motor decide, el modelo cuenta. Tope de unos 5 € de tokens. Nada de arte. La magia, solo en el código. El contenido es datos que se editan sin programar.

---

## 📍 Cómo va (2026-09-27, tarde)

Hecho: Z0, Z8, Z1, Z2 y Z3; Z4 en lo principal y Z6 empezada (el selector). Falta el resto de Z6, Z5 y Z7. La vuelta sin modelo (`node tools/e2e-sin-modelo.mjs`) pasa entera: **31 acciones, 0 silencios**, ninguna orden al narrador a la vista.

| Fase | Estado | Qué hay |
| :--- | :---: | :--- |
| **Z0** · Que nada se atasque sin modelo | ✅ | Hablar cuenta al pulsar, no al enviar; se tira las veces que haga falta; las órdenes al modelo no se ven (`model-note.js`). La vuelta llega al hito 4 de 1387 solo con fichas |
| **Z8** · La vuelta sin modelo | ✅ | `tools/e2e-sin-modelo.mjs`: cuenta silencios y órdenes a la vista. `--ver` enseña lo que dijo el motor; `--estricto` falla con un solo silencio |
| **Z1** · El narrador del motor | ✅ | 74 frases en `compendio/frases.json` para los ocho momentos (viaje, llegada, tablero, fin de combate, descanso, muerte, semana y acto). La vuelta mira el viaje, la llegada, el descanso y la pelea; **no** mide todavía lo de «ninguna frase repetida en diez llegadas» |
| **Z2** · Hablar sin modelo | ✅ | La charla: qué sabe (solo a quien no os mira mal), qué busca, qué se cuenta, el caso y qué piensa de vosotros; y convencer, sonsacar, amenazar e invitar a una ronda. `/hablar`. La vuelta habla con cinco personajes de 1387 |
| **Z3** · Tiradas con consecuencia y una caja que entiende | ✅ | Bien, a medias o mal, y cada resultado hace algo (`consequences.js`). La caja entiende ir, entrar, hablar, preguntar por algo, atacar, buscar, examinar, descansar, esperar, comprar y vender (`read-box.js`); lo que no, lo dice con ejemplos de aquí. Fichas de «qué examinar» por tipo de sitio y `/examinar`. La vuelta escribe doce frases y todas contestan |
| **Z4** · Sucesos con decisiones | 🟡 | 23 tarjetas en `compendio/sucesos.json`: el viaje (una por viaje), la llegada, el descanso y la semana, con continuaciones días después. Efecto en oro, heridas, tiempo, fama, la facción de aquí, los vínculos, rumores y pistas; y al Diario. **Falta:** que salgan también con el reloj de una facción y con un umbral de reputación, y el bloque `suceso:` del Gem (Z7) |
| **Z5** · Hilos generados con fondo | ⬜ | Sin empezar |
| **Z6** · El modelo como mejora | 🟡 | Los tres modos se eligen en la pausa (*Narrador: Motor / Mixto / Modelo*; sin conexión, siempre Motor), y los sucesos se encienden o apagan ahí. En «Mixto», lo que la caja entiende lo hace el juego (0 tokens) y el modelo contesta lo demás y las conversaciones. **Falta:** el selector en el taller, que «Mixto» llame al modelo en los momentos que importan, el tope de gasto por sesión, el contador completo y «gastar una vez» |
| **Z7** · Herramientas para ti | ⬜ | Sin empezar |

**Fuera del plan, hecho el mismo día:**

- **La Exploración, a pantalla entera** (encargo del Gem de UX): sin tablero, con el sitio arriba y tres columnas (*Aquí mismo*, *Tableros de aquí*, *Viajar*).
- **Se viaja de vecino en vecino.** Solo se pulsan los sitios con camino directo; lo demás se ve con por dónde se pasa. `/go` a un sitio lejano va parada a parada, llegando a cada uno.
- **La historia de 1387, reescrita para que se entienda** (2026-09-28). Cinco guionistas y tres revisores rehicieron el texto que se lee jugando (232 de 286 campos) en una ronda aparte, [[ronda-11-claude-claro]], sin cambiar ningún hecho. Los presagios se entienden; las pistas dicen qué hacer; los tableros dicen cómo se ganan (antes, varios decían «Acto 1»). Lo que no cuadra en el original, para decidir: [[DUDAS_1387]]. Y el Gem guionista ya no pide presagios «ambiguos».
- **El grupo viaja entero.** Antes, tras un viaje cada uno seguía «estando» en el sitio de antes y al entrar en un tablero del sitio nuevo no aparecía nadie. Ahora el grupo llega con el viaje, y al entrar en un tablero se pone en sus casillas de inicio.
- **Con modelo, contesta a quien le hablas.** Hablando con alguien, el modelo lee que conteste esa persona con su voz, y la respuesta sale a su nombre, no al del narrador. «Despedirse» acaba la conversación.

---

## 🔍 1. Lo que hay hoy, mirado de cerca

### 1.1 Lo que el motor ya hace solo, a 0 tokens

Mucho, y bien. Hay 242 módulos en `game-engine/` (unas 51.700 líneas) más `party.js` (19.400), y casi todo está conectado al juego. Solo `campaign/hours.js` lo usan las pruebas y nada más.

| Qué | Cómo está sin modelo |
| :--- | :--- |
| **Combate en el tablero** | Completo. IA con cuatro perfiles y cinco papeles, 17 terrenos (altura, salidas, palancas, barricadas, fuego que se extiende), tregua y refuerzos, 25 conjuros, jefes con fases. Frases a 0 tokens: 64 de compañeros, 48 de enemigos y 60 opiniones sobre encargos (`barks.js`). La pantalla de victoria la dibuja el motor |
| **Viajar** | Completo. Rutas y días, clima por estación, 15 sucesos de camino, peajes, ritmos, papeles de viaje, paradas, monturas, barcos, atajos. `/explorar` genera un sitio nuevo con su tablero |
| **Encargos, facciones y dinero** | Completo. Tablón generado con semilla (7 clases, 5 rangos, 57 filas combinables), relojes de facción con noticias, reputación, cartas, préstamos, la cuenta de la semana, tienda con regateo, precios por estación, fiestas |
| **Supervivencia y progreso** | Completo. Hambre y cansancio, 11 heridas con su remedio, descanso, campamento. Subir de nivel con tarjetas (62 dones, 5 árboles), forja, objetos con historia y maldición |
| **El hilo, el Diario y la Mesa** | El motor lleva los hitos (nueve formas de pedir), los plazos, los presagios, los casos y los finales. **El Diario y la Mesa los dibuja entero el motor** |
| **Hablar** | Solo a medias: el Duelo de Palabras (5 posturas, 3 rondas), `/sonsacar` y `/caso preguntar` van sin modelo. **La conversación en sí, no** |

El contenido que hay:

- **El compendio:** 16 archivos, 426 filas. 41 bichos, 30 armas, 57 filas de encargo, 76 de gente (rasgos, deseos, miedos, oficios, secretos, voces), 34 de sitios, 269 trozos de nombre.
- **1387:** 11 sitios, 22 personajes, 5 confidentes, 19 tableros, 16 misiones, 15 encargos, 26 rumores y 18 hitos (unos 54.000 caracteres de texto).
- **Generadores de texto:** nombres, gente, sitios, casos, epílogos, epitafios, rumores de lo que hicisteis, historia de los objetos, noticias y cartas.

### 1.2 Dónde se gastan tokens

**Solo cinco caminos llaman al modelo.** Todo lo demás son notas que se quedan en el chat y que paga la siguiente llamada.

| # | Qué | Cuándo |
| :---: | :--- | :--- |
| 1 | **Escribir en la caja y enviar** (el `Generate` de SillyTavern) | Cada mensaje de texto libre, con el prompt entero. Es **el 95 % del gasto** |
| 2 | **Otra vez / Más corto / Más intenso** (`retryLastReply`, `party.js:6981`) | Al pulsarlos |
| 3 | **El lapicito del taller** (`writeWithModel`, `campaigns.js:863`) | Opcional; solo sale si hay proveedor |
| 4 | **Generar un mundo con IA** (`generateWorld`) | Opcional; solo sale si hay proveedor |
| 5 | **«Escríbelo por mí» del héroe y «Proponer con IA» de los objetivos** | Opcionales; se apagan sin proveedor |

**Las notas para el modelo.** `postForModel` (`party.js:2058`) deja en el chat un mensaje que el modelo lee en su siguiente respuesta. Lo usan 52 sitios:
- automáticos: el hilo, los presagios, las noticias, los viajes, la muerte, el caso, los roces, los rivales, las fiestas;
- por algo que haces: rumores, explorar, cartas, reclutar, la ronda en la taberna, el templo, el campamento, el robo, los encargos, el secreto, el duelo, el aprendizaje.

**Casi todas terminan con una orden al modelo**: «Cuéntalo en uno o dos párrafos», «Dilo tal cual», «Cuenta el viaje…». Sin modelo, **quien juega lee esa orden**.

**Lo que ya existe para gastar menos:**
- el modo ahorro (idea 148);
- el largo de la narración (149);
- el contador de tokens de la cabecera (147), que mide lo que se envía en cada turno de chat. No cuenta la respuesta ni las llamadas de los lapicitos.

**No hay ningún modo «sin modelo»:** solo cada botón se esconde si no hay conexión.

### 1.3 Lo que se atasca sin modelo (comprobado)

1. **La historia de 1387 se para en el hito 2.**
   - Los hitos de hablar (`asks: talk`) solo se cumplen al **enviar un mensaje** que nombra a esa persona (`party.js:19255`, `plot.js:249`).
   - Sin proveedor, `Generate` sale antes de enviar nada (`script.js:4516`), así que el mensaje nunca llega.
   - En 1387 hay tres hitos así, y el segundo es *El precio del escape* («hablar con Giles»). Sin modelo, el único camino que queda es que el reloj de una facción acabe la historia por ti.
2. **Una sola tirada por partida.**
   - `/tirada` guarda la tirada pendiente y no deja hacer otra hasta que se envíe un mensaje (`party.js:14284`); solo se borra al enviarlo (`19298`).
   - Sin modelo, tras la primera tirada ya no hay más, **ni tras recargar**, porque queda guardado en la partida.
   - Con eso caen también las pistas de los casos y los encargos que se resuelven sin pelear.
3. **Las órdenes al modelo, a la vista.**
   - Todas las líneas `[HILO]`, `[ENCARGO]` y `[CAMPAMENTO]`, las del viaje, la del arranque de la partida, etc., terminan con una orden al narrador.
   - Sin modelo, se leen como un error.

Y tres fallos más, estos sí con modelo:

- **Los lapicitos de Localidades, Facciones, Personajes y Misiones no escriben nada.** Salen, se pulsan y no pasa nada. Solo saben cuatro campos: sinopsis, tono, lo que sabe el narrador y su saludo (`campaigns.js:871`).
- **«Otra vez» puede borrar una línea del motor.** El regenerar de SillyTavern borra el último mensaje si no es tuyo (`script.js:4532`), sea lo que sea. Lo he visto en el código, **no lo he reproducido**.
- **Al entrar en un tablero sale «🎲 Entered…» en inglés** (`party.js:18088` y `19391`).

### 1.4 Los diez silencios

Momentos en los que haces algo y, sin modelo, no vuelve nada que merezca la pena:

1. **Hablar con cualquiera.** La ficha deja una frase en la caja, y esa frase no se puede enviar.
2. **«Hablar con Giles» en la posada** (la acción del servicio).
3. **El arranque de la partida.** La escena escrita sale bien, pero seguida de «Quien juega es… Adapta… Cuéntalo…», y después nada.
4. **Entrar en un tablero.** Solo un aviso; el encargo no se presenta.
5. **Descansar.** Solo los números de vida. La cura del templo es solo una orden al modelo.
6. **Invitar a una ronda, charlar en el campamento, conocer a un reclutable.** El vínculo sube en silencio, y lo que sale es una orden al modelo.
7. **Llegar a un sitio que no es parte del hilo.** Avisos, y una orden al modelo. La descripción del sitio existe (está en el panel), pero no se cuenta.
8. **Tras un duelo o un `/sonsacar` con éxito.** El resultado en una línea está bien, pero la escena se deja al modelo.
9. **Toda línea `[HILO]`, `[ENCARGO]` o `[CAMPAMENTO]`**, que se lee como una orden a un narrador ausente.
10. **Lo que se atasca** (sección 1.3).

### 1.5 El diagnóstico, en cinco frases

1. **El juego ya es profundo en lo que decide el motor.** El combate, el viaje, la economía y el hilo funcionan sin modelo.
2. **Pero el motor habla en dos idiomas.** Uno para quien juega (avisos, líneas de sistema, ventanas) y otro para el modelo (órdenes). Sin modelo, el segundo se queda colgando a la vista.
3. **La conversación es el gran hueco.** Es lo más de rol, y hoy es el único sitio donde, sin modelo, **no hay juego**: hay una caja de texto que no envía.
4. **Faltan decisiones fuera del combate** que no sean de gestión. Hay mucho que *mirar* (Diario, Mesa, mapa) y poco que *elegir* entre combate y combate.
5. **El modelo hoy es la llave.** Algunas cosas solo avanzan si habla (los hitos de hablar, las tiradas). Tiene que ser la mejora: con modelo se lee mejor; sin él se juega igual.

---

## 🧭 2. Las reglas de esta fase

1. **Toda acción devuelve algo, sin modelo.** Si pulsas o escribes algo y el motor no sabe qué hacer, lo dice y te ofrece lo que sí se puede hacer. Un silencio es un fallo.
2. **El modelo mejora, nunca desbloquea.** Nada del hilo, de los encargos ni de las tiradas puede depender de que el modelo conteste.
3. **Cada momento, en dos capas.** La línea del motor (siempre, a 0 tokens) y la mejora del modelo (opcional y marcada). El modelo recibe la línea del motor y los hechos, y la cuenta mejor; nunca los cambia.
4. **Gastar una vez antes que gastar cada turno.** Donde los tokens aportan contenido (frases, charlas, sucesos, la biblia de un mundo), se gastan **al crearlo**, no al jugarlo.
5. **El contenido es datos.** Las frases, las charlas y los sucesos se escriben en archivos que el Gem sabe llenar, sin tocar código.
6. **Cada fase acaba jugable sin modelo**, y lo comprueba la vuelta sin modelo (Z8).

---

## 🗺️ 3. El orden

| Orden | Fase | Qué da | Esf. |
| :---: | :--- | :--- | :---: |
| 1 💡 | **Z0** · Que nada se atasque | 1387 se puede jugar entero sin modelo | `S` |
| 2 | **Z8** · La vuelta sin modelo | Una prueba que avisa de cada silencio, desde ya | `S` |
| 3 💡 | **Z1** · El narrador del motor | Cada momento se cuenta con prosa del motor | `L` |
| 4 💡 | **Z2** · Hablar sin modelo | Conversaciones con temas, actitud y consecuencias | `L` |
| 5 | **Z3** · Tiradas y una caja que entiende | Tirar tiene efecto; escribir «voy a la posada» funciona | `M` |
| 6 | **Z4** · Sucesos con decisiones | Elecciones con peso entre combate y combate | `L` |
| 7 | **Z6** · El modelo como mejora | Los modos de narrador y las llamadas en los momentos que importan | `M` |
| 8 | **Z5** · Hilos generados con fondo | Un mundo generado tiene historia que jugar | `M` |
| 9 | **Z7** · Herramientas para ti | El Gem escribe frases, charlas y sucesos | `M` |

**Por qué este orden.**

- **Z0 primero:** hoy 1387 no se puede terminar sin modelo, y eso manda sobre cualquier mejora.
- **Z8 enseguida:** es la prueba que dice cuántos silencios quedan, y cada fase se mide con ella.
- **Z1 antes que Z2, Z3 y Z4:** es el canal por el que todo lo demás habla. Las charlas, las tiradas y los sucesos escriben su resultado con la voz del motor.
- **Z6 cuando ya haya algo que mejorar:** los modos del narrador reparten entre el motor y el modelo, y para eso el motor tiene que saber contar.
- **Z5 y Z7 al final:** son de contenido. Rinden más cuando los formatos de Z1, Z2 y Z4 ya existen.

---

## 🔓 Z0 · Que nada se atasque sin modelo · `S`

> **El problema.** Tres cosas solo avanzan si el modelo contesta: los hitos de hablar, las tiradas y el arranque de la partida. Sin modelo, 1387 se para en el hito 2 y las órdenes al narrador se leen como errores.

**Qué se construye:**

1. **Hablar es elegir hablar.** Pulsar «Hablar con X» (la ficha o el botón de la posada) avisa al hilo de que hablas con X donde estás, igual que hoy lo hace el mensaje enviado. El hito se cumple al empezar la conversación, no al escribir. Con Z2 la conversación tendrá contenido; en Z0 basta con que cuente.
2. **La tirada se cierra sola.** La tirada pendiente se borra cuando su efecto se aplica, no cuando se envía un mensaje. Sin modelo, la consecuencia la dice el motor (en Z0, una línea; en Z3, con efecto).
3. **Las órdenes al modelo, fuera de la vista.**
   - Cada nota para el modelo se separa en dos partes: **lo que pasó**, en frases para quien juega, y **la orden**, solo para el modelo.
   - Sin conexión, se enseña lo primero y la orden no sale.
   - Los 52 sitios casi siempre ya tienen la frase hecha antes de la orden, así que es separar, no reescribir.
4. **Los botones que no hacen nada sin modelo, fuera.** «Otra vez», «Más corto» y «Más intenso» no salen sin conexión. Y con conexión, «Otra vez» solo regenera si lo último es una respuesta del modelo: nunca borra una línea del motor.
5. **Los arreglos sueltos:**
   - los cinco lapicitos del taller que no escriben (con modelo);
   - «Entered…» dicho en castellano.

**Sinergia:** el hilo (los hitos de hablar), los casos (las pistas con tirada), los encargos sin pelea y el taller.

**Se ve al terminar:** con el proveedor apagado, 1387 pasa del hito 2 hablando con Giles; se puede tirar diez veces seguidas; y ninguna línea del chat dice «Cuéntalo…».

**Hecho cuando:** la vuelta sin modelo (Z8) llega al hito 4 de 1387 solo con fichas y botones.

---

## 🧪 Z8 · La vuelta sin modelo · `S`

> **El problema.** Las vueltas de prueba juegan siempre con el proveedor apagado, pero miran que el estado cambie, no que **quien juega vea algo**. Los diez silencios han pasado todas las pruebas.

**Qué se construye:**

1. **`tools/e2e-sin-modelo.mjs`:** una partida de 1387 de unos 20 minutos, solo con fichas, botones y comandos. Cada acción comprueba que aparezca algo nuevo y legible (una línea del motor, una ventana, un aviso) y que **ninguna** línea contenga una orden al modelo.
2. **El recuento de silencios:** al final dice cuántas acciones no devolvieron nada y cuáles. Es el número del marcador que tiene que llegar a 0.
3. **Tu prueba:** una hora de juego con el proveedor apagado, apuntando dónde te aburres. Como la U0 del pegamento, eso solo lo puedes hacer tú.

**Se ve al terminar:** `node tools/e2e-sin-modelo.mjs` dice «diez silencios» hoy, y cada fase lo baja.

**Hecho cuando:** la vuelta corre y da el número de partida.

---

## 🎙️ Z1 · El narrador del motor · `L`

> **El problema.** El motor sabe qué pasa en cada momento, pero solo lo cuenta en avisos y líneas técnicas. La prosa se la deja al modelo. Hay piezas a 0 tokens muy buenas (las frases de combate, las de la mascota, los epitafios, la crónica de la semana), pero **no hay una voz** que cuente la llegada a un sitio, el descanso o el final de una pelea.

**Qué se construye:**

1. **Bancos de frases como datos** (`public/compendio/frases.json`):
   - Por momento y con huecos: `{sitio}`, `{hora}`, `{tiempo}`, `{quien}`, `{lo que pasó}`.
   - Con variantes por estado: de día o de noche, con lluvia, herido, rico o sin blanca, la reputación del sitio.
   - Se eligen con la semilla y sin repetir la misma frase en un rato.
   - Es la regla de [[ALGORITMOS_GENERACION]]: la semilla no es el texto.
2. **Los momentos que se cuentan:**
   - el arranque de la partida (la escena del paquete, limpia);
   - llegar a un sitio: tipo, bioma, clima, hora, estado, quién hay, lo que se dice de él, y un gancho del tablón o de un caso;
   - entrar en un tablero: el encargo y lo que se ve;
   - el final de una pelea: con los hechos del registro de combate (quién cayó, qué se perdió, lo que se ganó);
   - descansar y el campamento;
   - un viaje: los sucesos del camino, contados;
   - la muerte (con el epitafio), el cambio de semana y el cambio de acto.
3. **Una voz por narrador.**
   - Los cuatro de serie (el cronista, la posadera, algo que mira, el juglar) ya tienen tono escrito. El banco de frases puede tener variantes por voz: el cronista, seco; la posadera, cercana.
   - Empezar con una voz neutra y añadir voces como datos (DZ2).
4. **Se ve como el narrador.** Las líneas del motor salen con la cara y el nombre de quien narra, no como avisos de sistema.
5. **Lo que ya había se une aquí:** la línea sin tokens de la mascota, la crónica de la semana, los rumores de lo que hicisteis (`world-echoes.js`), la historia de los objetos, las noticias y las cartas.

**Con tokens:** en los momentos que importan (DZ3), el modelo recibe la línea del motor y los hechos, y la cuenta con su voz. Si no hay conexión o el modo es «Motor», se queda la del motor.

**Sinergia:** el hilo, los viajes, el combate, el campamento, la mascota, la crónica, la reputación, el clima y la estación.

**Se ve al terminar:** llegas a El Pueblo de Barro de noche y con lluvia, y el narrador te lo cuenta en tres frases que dicen quién hay y qué se comenta, sin un solo token. Otra noche sale otra cosa.

**Hecho cuando:** la vuelta sin modelo cuenta los ocho momentos, y ninguno repite frase en diez llegadas seguidas.

---

## 💬 Z2 · Hablar sin modelo · `L`

> **El problema.** Hablar es lo más de rol, y hoy es el único sitio donde, sin modelo, no hay juego. Los 22 personajes de 1387 tienen escrito qué quieren, qué saben y cómo hablan (`wants`, `knows`, `voice`), pero **eso solo lo lee el modelo**. Quien juega nunca lo ve.

**Qué se construye:**

1. **La ventana de charla** (con el marco común `gs-panel`). Arriba, quién es, qué piensa de ti (actitud, reputación, vínculo) y dónde estáis. Debajo, **temas**, sacados de lo que el motor sabe:
   - lo que sabe (`knows`), lo que quiere (`wants`) y lo que teme;
   - los rumores que ha oído;
   - las pistas de un caso que tenga;
   - los encargos que ofrece;
   - lo que vende, enseña o alquila;
   - lo que opina de tus compañeros y de tu mascota.
2. **Las respuestas.**
   - Frases del paquete (`voice`) y de un banco por actitud: el mismo dato, dicho por alguien que te aprecia o por alguien que te desprecia.
   - **Lo que se revela depende de la actitud:** lo que no te dice hoy, te lo dice cuando le caigas bien, o si ganas un duelo o una tirada.
3. **Qué puedes hacer** (cada cosa usa lo que ya existe):
   - Preguntar por un tema.
   - Pedir un favor (los confidentes, R8).
   - Convencer: el Duelo de Palabras, que además de subir la actitud podrá abrir un tema o bajar un precio.
   - Sonsacar (`/sonsacar`).
   - Amenazar: una tirada de intimidación, a costa de la actitud.
   - Invitar a una ronda, que sube el vínculo.
   - Reclutar.
4. **Hablar cuenta.** El hito «hablar con X» se cumple al hablar. Y ciertos temas pueden **pedirse** en un hito («preguntar a Giles por el recaudador»), como forma de pedir nueva (DZ6).
5. **Las charlas escritas** (opcional, en datos): un bloque `charla:` en el guion para quien quiera temas a mano en un personaje, con sus condiciones.

**Con tokens:** el modelo pone la voz. Recibe el personaje, el tema elegido y **lo que el motor deja revelar**, y lo dice con su manera de hablar. Y puedes escribir tu propia pregunta: el modelo contesta sin salirse de lo que el motor permite.

**Sinergia:** el hilo, los casos, los encargos, la reputación, los vínculos, los confidentes, el Duelo de Palabras, la mascota y la tienda.

**Se ve al terminar:** en la posada, «Hablar con Giles» abre su ventana. Te cuenta, de mala gana, que el recaudador pasó por aquí; que si le invitas a una ronda te dirá con quién; y que tu perro le pone nervioso.

**Hecho cuando:** la vuelta sin modelo habla con cinco personajes de 1387, y cada uno da al menos tres temas distintos y cambia según la actitud.

---

## 🎯 Z3 · Tiradas con consecuencia y una caja que entiende · `M`

> **El problema.** La tirada se resuelve en el motor, pero lo que pasa después se deja escrito para el modelo («narra la consecuencia»). Y el texto libre solo lo entiende el modelo. Las frases «ataco a X», «voy a Y» o «paso turno» solo se leen **si el mensaje llega a enviarse** (`party.js:19346`).

**Qué se construye:**

1. **Consecuencias con efecto:**
   - Una tabla por habilidad y por sitio, con éxito, éxito a medias y fallo. Cada resultado hace algo: encontrar una pista, perder tiempo, hacerse una herida, ganar o perder reputación, encontrar un objeto, abrir un camino.
   - Los usos fuera del combate de `rules/field-uses.js` son el punto de partida.
2. **Las fichas que hoy dependen de las herramientas del modelo,** también sin él:
   - «Buscar X»: el motor ofrece qué examinar en el sitio.
   - Una tirada que pide el sitio.
3. **La caja entiende, sin modelo.**
   - Una lista corta de verbos: ir a, hablar con, preguntar a X por, atacar a, buscar, examinar, descansar, comprar, vender, esperar.
   - Lo que entiende, lo hace. Lo que no, lo dice y enseña las fichas de lo que se puede hacer ahí (DZ1).
   - No es un parser de aventura de texto: es un atajo a las fichas.

**Con tokens:** lo que la caja no entiende va al modelo, como hoy. Y con un modelo pequeño se puede mejorar el entendimiento (el extractor que [[ROADMAP_MAESTRO]] nunca llegó a hacer).

**Sinergia:** los casos, el hilo (los hitos de tirada), los encargos sin pelea, las heridas, la reputación y el tiempo.

**Se ve al terminar:** «busco huellas en el barro» → tirada de Supervivencia → éxito a medias: «Encuentras huellas, pero la lluvia ha borrado el final. Pierdes una hora.» Y el caso anota media pista.

**Hecho cuando:** la vuelta sin modelo escribe diez frases distintas en la caja y todas hacen algo o enseñan qué se puede hacer.

---

## 🃏 Z4 · Sucesos con decisiones · `L`

> **El problema.** Entre combate y combate hay mucho que mirar y poco que elegir. Los 15 sucesos de camino son adorno: pasan y ya.

**Qué se construye:**

1. **Sucesos en tarjetas**, en el estilo de *Darkest Dungeon*, *Sunless Sea* o *Oregon Trail*:
   - Una situación, dos o tres opciones y el precio de cada una: una tirada, oro, tiempo, un objeto, un compañero que se ofrece, la mascota.
   - Cada opción lleva a un resultado **con efecto** en lo que ya existe: dinero, heridas, reputación, facciones, vínculos, casos, rumores, objetos o encargos nuevos.
2. **Cuándo salen:**
   - al viajar (cambian los 15 de hoy);
   - al llegar a un sitio;
   - al descansar;
   - al cambiar de semana;
   - cuando avanza el reloj de una facción;
   - al cruzar un umbral de reputación.
3. **De dónde salen:**
   - Escritos en el guion, con un bloque `suceso:` (el Gem sabe hacerlo en Z7).
   - O generados por tablas, para los mundos que no están escritos (DZ5).
4. **Que se note lo que elegiste.** El Diario los apunta, los rumores los cuentan (R9), y algunos vuelven días después como continuación.

**Con tokens:** el modelo cuenta el resultado elegido con su voz. La elección y el efecto siguen siendo del motor.

**Sinergia:** viajar, las facciones, la reputación, los vínculos, la mascota, la economía, los casos, los rumores y el Diario.

**Se ve al terminar:** en el camino a Castillo de Vane, unos desertores piden pan. Puedes dárselo (−2 raciones, +1 con la guardia de Montesclaros si se entera), echarlos (Intimidación) o preguntarles por el paso (Perspicacia: el paso está cerrado). Tres días después, uno de ellos está en la posada.

**Hecho cuando:** un viaje de tres días en 1387 da al menos dos decisiones con efecto que se ven en el Diario.

---

## 🧠 Z6 · El modelo como mejora · `M`

> **El problema.** Hoy el modelo se llama con cada mensaje, con el prompt entero, y sin él hay silencios. Con Z0–Z4, el motor ya cuenta y resuelve. Falta decidir **cuándo** vale la pena gastar.

**Qué se construye:**

1. **Tres modos de narrador**, en la pausa y en la pestaña de Jugabilidad del taller:
   - **Motor:** 0 tokens. Todo lo cuenta el motor.
   - **Mixto** (el que recomiendo por defecto con proveedor): el motor cuenta siempre. El modelo solo entra en los momentos que importan (el arranque, una muerte, el final de un combate difícil, el cambio de acto o de semana) y cuando tú escribes algo que la caja no entiende.
   - **Modelo:** como hoy.
2. **Tope de gasto por sesión** (la I2 de [[LO_QUE_FALTA]]). Con el estimado que ya da el contador; al llegar al tope, pasa solo a «Motor» y lo dice.
3. **El contador, completo.** Cuenta también las respuestas y las llamadas de los lapicitos, y dice el coste de una hora en cada modo.
4. **Gastar una vez.** Al crear un mundo con proveedor, una llamada puede escribir los bancos de frases, las charlas y los sucesos del mundo. Se guardan en el paquete y no se vuelven a pagar al jugar.

**Sinergia:** el modo ahorro, el largo de la narración, el contador, el taller y los modos de juego (R1).

**Se ve al terminar:** una hora de 1387 en «Mixto» cuesta una fracción de lo que cuesta hoy, y se lee mejor que en «Motor». En «Motor» cuesta 0 y se juega entera.

**Hecho cuando:** el contador da el coste de una hora en los tres modos, medido en una partida real.

---

## 🧵 Z5 · Hilos generados con fondo · `M`

> **El problema.** 1387 tiene 18 hitos, tres finales y tres presagios. Un mundo generado recibe cinco hitos de una línea (`plotFromFaction`, `plot.js:672`), y la historia se nota hecha con plantilla.

**Qué se construye:**

1. **Una gramática de actos:**
   - Investigar, que usa los casos y las pistas.
   - Enfrentarse, con un encargo con jefe y némesis.
   - Elegir bando, con finales según la reputación con las facciones.
   - Con las facciones, la gente y los sitios de **ese** mundo.
2. **Los tres tipos de hito que más juego dan sin modelo:** hablar (Z2), tirar (Z3) y elegir (Z4). No solo llegar a un sitio y ganar un tablero.
3. **Presagios y rumores del hilo** generados de los hitos, como en 1387.

**Con tokens:** una sola llamada al crear el mundo puede escribir las escenas de cada hito. Se paga una vez (Z6.4).

**Sinergia:** los casos, las facciones, la némesis, el tablón, los rumores y Z2 a Z4.

**Se ve al terminar:** *La costa que no duerme* tiene tres actos, doce hitos y dos finales, sin un Gem y sin tokens.

**Hecho cuando:** diez semillas de un mundo generado dan hilos distintos y se pueden terminar en la vuelta sin modelo.

---

## 🛠️ Z7 · Herramientas para ti · `M`

> **El problema.** Todo este plan es contenido: frases, charlas, sucesos. Si solo puedo escribirlo yo en código, no escala. Tiene que poder escribirlo el Gem, y editarse sin programar.

**Qué se construye:**

1. **El Gem guionista aprende tres bloques:** `frases:` (por momento y voz), `charla:` (temas de un personaje) y `suceso:` (situación, opciones y efectos). `tools/guion-a-paquete.mjs` los convierte y avisa de lo que no lee.
2. **El comprobador de densidad los cuenta:** cuántos momentos tienen frases, cuántos personajes tienen temas, cuántos sucesos por región. Te dice si el mundo «llega al listón» para jugarse sin modelo.
3. **Para 1387:** una ronda nueva del guion con sus sucesos y las charlas de los cinco confidentes. Es la ronda que el Gem escribe primero.

**Sinergia:** el Gem, el conversor, el comprobador de densidad (181), [[GEM_GUIONISTA]] y el taller.

**Se ve al terminar:** le pides al Gem «la ronda 11 de 1387: sucesos del camino y charlas», la conviertes y está en el juego.

**Hecho cuando:** una ronda escrita por el Gem con los tres bloques entra en 1387 sin tocar código.

---

## 📊 4. El marcador

| Qué | Al empezar | Ahora (2026-09-27) | Meta | Fase |
| :--- | :---: | :---: | :---: | :---: |
| **Hitos de 1387 que se pueden cumplir sin modelo, en orden** | Se para en el 2 de 18 | Del 1 al 4 comprobados; el resto sin probar | 18 de 18 | Z0 |
| **Tiradas por partida, sin modelo** | 1 | Sin límite | Sin límite | Z0 |
| **Sitios que dejan una orden al modelo a la vista, sin modelo** | 52 | 0 en toda la vuelta | 0 | Z0 |
| **Silencios en la vuelta sin modelo** | 10 | 0 de 31 | 0 | Z8, Z1–Z4 |
| **Momentos que el motor cuenta con prosa** | 0 de 8 | 8 de 8 | 8 de 8 | Z1 |
| **Personajes de 1387 con los que se puede hablar sin modelo** | 0 de 22 | Todos (probado con 5) | 22 de 22 | Z2 |
| **Decisiones fuera del combate en un viaje de tres días** | 0 | 3 (una por tramo) | 2 o más | Z4 |
| **Hitos de un mundo generado** | 5, de una línea | Igual (Z5) | 12, en tres actos | Z5 |
| **Tokens para una hora de juego** | Todos los mensajes (se mide en Z6) | 0 en «Motor»; sin medir en «Mixto» | 0 en «Motor»; unas pocas llamadas en «Mixto» | Z6 |

---

## 🔗 5. Cómo se enganchan

| | El hilo | Casos | Encargos | Facciones | Reputación | Vínculos | Mascota | Viajes | Diario | Gem |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Z0** | ● | ● | ● | | | | | | | |
| **Z1** | ● | | ● | | ● | | ● | ● | ● | ● |
| **Z2** | ● | ● | ● | ● | ● | ● | ● | | ● | ● |
| **Z3** | ● | ● | ● | | ● | | | ● | | |
| **Z4** | | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| **Z5** | ● | ● | ● | ● | ● | | | | | |
| **Z6** | ● | | | | | | | | | ● |
| **Z7** | ● | | | | | | | | | ● |

---

## 🟠 6. Lo que decides tú

> **Tomadas el 2026-09-27 con la recomendación** (dijiste «hazlo todo»): DZ1 A, DZ2 B, DZ3 A, DZ4 A, DZ5 A y DZ6 A. Si alguna no te convence, se cambia: dímelo.

| ID | La pregunta | Opciones | Recomiendo |
| :--- | :--- | :--- | :---: |
| **DZ1** | Sin modelo, ¿qué pasa si escribes texto libre? | **A**: el motor lo entiende si puede (una lista corta de verbos) y, si no, te enseña las fichas. · **B**: sin modelo, la caja se oculta y se juega solo con fichas | **A** |
| **DZ2** | ¿Con qué voz cuenta el motor? | **A**: una voz por cada narrador de serie desde el principio. · **B**: una voz neutra primero, y las voces se añaden luego como datos | **B** |
| **DZ3** | Con proveedor, ¿quién cuenta los momentos del motor? | **A**: «Mixto» por defecto: el motor siempre, el modelo en los momentos que importan y cuando escribes algo que la caja no entiende. · **B**: «Modelo» por defecto, como hoy | **A** |
| **DZ4** | ¿De dónde salen los temas de una charla? | **A**: de lo que el motor sabe (lo que quiere y sabe, rumores, casos, encargos), con frases por actitud; el bloque `charla:` es un extra. · **B**: árboles de diálogo escritos a mano para cada personaje | **A** |
| **DZ5** | ¿De dónde salen los sucesos? | **A**: escritos (Gem) y también generados por tablas, para los mundos que no están escritos. · **B**: solo escritos | **A** |
| **DZ6** | ¿Cuándo se cumple un hito de hablar? | **A**: al empezar a hablar con esa persona donde pide el hito; los hitos pueden además pedir un tema concreto. · **B**: solo al preguntar por un tema concreto | **A** |

---

## 🗑️ 7. Lo que no haría

- **Un modelo local para jugar sin conexión** (la PROP2-159 archivada). Pesa, va lento y no hace falta: el motor puede contar.
- **Generar diálogos con el modelo mientras se juega para guardarlos.** Es gastar cada turno lo que se puede escribir una vez.
- **Un parser de aventura de texto completo.** Una lista corta de verbos y las fichas bastan. Lo demás, que lo entienda el modelo si lo hay.
- **Que el modelo decida qué revela un personaje.** Lo decide el motor (actitud, tiradas, duelos). El modelo solo lo dice bonito.
- **Voces o retratos generados, logros:** ya los descartaste.

---

## 🔗 8. Enlaces

- [[ROADMAP_PROFUNDIDAD]]: el plan anterior. Sus 🟡 siguen abiertos: la cuerda (R6), R7, R9 y las piezas y casos escritos (R10).
- [[LO_QUE_FALTA]]: I2 (tope de gasto) pasa aquí, a Z6. H1 (enseñar con líneas del motor) se apoya en Z1.
- [[ROADMAP_PEGAMENTO]]: U3 (horarios de la gente) y U6 (más duelos) se enganchan con Z2.
- [[ROADMAP_MAESTRO]]: el extractor con modelo pequeño que nunca se hizo encaja en Z3.
- [[ALGORITMOS_GENERACION]]: la semilla no es el texto, y la regla de los bancos de frases.
- [[GEM_GUIONISTA]]: aprenderá `frases:`, `charla:` y `suceso:` en Z7.
- [[EMPEZAR_UNA_CAMPANA]]: «Sin proveedor te falta el narrador, no el juego». Este plan hace que tampoco falte el narrador.
