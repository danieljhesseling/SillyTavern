---
title: Roadmap maestro — el mapa de todos los mapas
tags: [roadmap, maestro, niveles, narracion-viva, generacion, gremio, modos-de-juego]
created: 2026-09-22
updated: 2026-09-22
author: DanielJHesseling / Claude Opus 5
---

# 🗺️ El mapa de todos los mapas

> **Para qué existe este documento.** Había once planes en esta carpeta y ninguno decía cuál venía después de cuál. Las fases **A a H del [[ROADMAP]] están todas cerradas**: ese documento ya no es un plan, es el acta de lo que se construyó. Esto es lo que sigue, partido en niveles, y **cada nivel es un juego jugable**, no un tramo de obra.

> [!NOTE]
> **Desde el 2026-09-25, el plan que sigue fue [[ROADMAP_PEGAMENTO]], y después [[ROADMAP_PROFUNDIDAD]] (hechos los dos). Lo que falta ahora está en [[LO_QUE_FALTA]].** Este documento se queda como **el porqué**: los cuatro relojes y la pregunta de por qué querrías jugar mañana. Sus seis niveles están construidos; lo que falta es que se hablen entre ellos.

> **Cómo leerlo.** Cada nivel dice qué desbloquea, qué parte ya existe, y —lo que más importa— **qué veo posible y qué no**. Donde algo no se puede hacer como se pidió, está dicho y está dicha la forma que sí funciona. Un plan que promete todo no sirve para elegir.

> [!IMPORTANT]
> **Estado (22-09-2026): los seis niveles tienen su motor construido y conectado.** Lo que
> queda no es diseño, es interfaz y verificación — y **el extractor del Nivel 1**, que es la
> única pieza grande que sigue sin escribirse. Cada nivel dice abajo qué le falta.

> **El orden no es por tamaño, es por apetito.** La pregunta que ordena este documento no es *«qué falta»* sino **«por qué querrías jugar mañana»**, y la respuesta resultó no estar donde yo la había puesto: no en el gremio, sino en **la cuenta que hay que pagar el viernes**. Ver [El bucle](#-el-bucle-que-es-lo-que-faltaba).

---

## 📍 Nivel 0 — Dónde estamos, de verdad

Esto ya está construido y verificado en un navegador de verdad, no solo en pruebas:

| Pieza | Estado |
| :--- | :--- |
| **Motor determinista** | 70 módulos puros: dados, combate, terreno, línea de visión, iniciativa, botín, descansos, niveles, muerte, oportunidad, condiciones con duración |
| **Tablero táctico** | Muros, cobertura, puertas, salas, niebla, enemigos dormidos, movimiento por clic con ruta y precio |
| **Campañas** | Plantillas, generador por IA, importador de libros con contrato y validador, exportador con ida y vuelta |
| **Editor de campaña** | `/campana`: mundo, localidades, tableros, personajes, bestiario, facciones, objetos, misiones — todo sin tocar código |
| **Modo Juego** | Pantalla de título, escenas (diálogo, exploración, combate), director automático, menú de pausa |
| **Persona** | Vínculos, calendario, bloques del día, perks de combate |
| **Narrador propio** | Cada campaña tiene su voz, con su tono en el prompt |

**La regla que lo ordena todo, y que no se toca en ningún nivel de abajo:**

> **El motor decide, el modelo cuenta.** Las tiradas, el daño, las posiciones y el botín los calcula código determinista. El modelo narra lo que ya pasó. Nunca al revés.

Esa regla es la razón de que una campaña cueste céntimos y no euros, y de que dos partidas con la misma semilla salgan iguales. **Todo lo que viene abajo tiene que caber dentro de ella o no entra.**

---

## 🔁 El bucle, que es lo que faltaba

Antes de la lista de deseos, la pregunta que la ordena: **¿por qué querrías jugar mañana?**

Hoy no hay respuesta, y el motivo se ve en una línea de código:

```js
// campaign-state.js — el reloj solo se mueve si TÚ lo mueves
if (kind === 'corto') advanceSlotOfDay();
else advanceDay();
```

**El tiempo solo pasa cuando descansas.** Nada en el mundo se mueve solo. De ahí salen las cinco carencias, y todas son la misma:

- **No hay escasez.** El oro entra y nunca sale. La comida no existe.
- **No hay reloj.** Si te quedas parado, no pasa nada. Literalmente.
- **Nadie quiere nada.** Las facciones tienen reputación y **nadie la lee**.
- **El botín no es *para* nada.** Mejor espada, ¿para qué?
- **Las metas te las pones tú.** Y una meta que te asignas tú no tira de ti.

Este proyecto tiene **verbos excelentes y cero apetito**. Todo funciona y nada te espera.

### Los cuatro relojes

| Reloj | Qué pasa | Estado |
| :--- | :--- | :--- |
| **Minutos — el turno** | Ves el tablero, decides, actúas, ves la consecuencia | ✅ **Hecho, y es lo mejor que hay aquí** |
| **Una sesión — el trabajo** | Aceptas un encargo, vas, peleas, **vuelves distinto** | 🟡 Hay misiones y tableros; falta el *vuelves distinto* |
| **Una semana — la cuenta** | Comen, cobran, duermen bajo techo, se curan, se reparan | ❌ **No existe. Es la clave de bóveda** |
| **Una campaña — la amenaza** | Algo avanza hagas lo que hagas | ❌ No existe |

El de arriba ya lo tienes. **El de la semana es el que engancha**, y es el que falta.

### Y el gremio **no es** ese reloj

Lo puse como Nivel 3 y estaba equivocado. El desgaste no es una pantalla de gestión detrás de una característica opcional: **un aventurero solo también come**. Paga posada, paga impuestos, se le rompe la armadura, y si contrata a alguien que solo viene por dinero, ese alguien cobra todas las semanas o se va.

El gremio cambia la **escala** de eso y añade **el tablón con rangos**. Es una capa encima, no el suelo.

Y esto arregla el agujero que mi primera versión no sabía tapar — **por qué aceptas un encargo**: porque el viernes hay que pagar.

---


## 🎯 Lo que has pedido, y qué pienso de cada cosa

Cuatro cosas. Las pongo en orden de *cuánto juego dan por lo que cuestan*, que no es el orden en que las dijiste.

### N1 · Que el tablero siga a la conversación

> *«Si la conversación habla de que se abre una puerta y aparece un enemigo, en el tablero también se debería poder ver.»*

**Lo veo, y es lo más importante de esta lista.** Es lo que convierte dos cosas que hoy conviven —un chat y un tablero— en un solo juego.

**Lo que hay que saber antes.** Hoy la flecha va en **un solo sentido**: el motor decide y la pantalla le sigue (`scene-director.js` cambia de escena cuando empieza un combate). La flecha contraria está **deliberadamente cortada**, y está escrito en el propio código por qué: el modelo ya tiene una máquina de estados que adivina de su propia prosa, y una frase de ambiente —*«todos, tirad iniciativa»*— saltaría a la pantalla de combate sin combate detrás.

Así que lo que pides no es «quitar un candado»: es **construir la flecha que falta**, de forma que no se pueda mentir por ella.

**La forma que funciona**, en tres piezas:

1. **La narración no escribe: propone.** Después de cada mensaje, un modelo barato lee lo que se acaba de narrar y devuelve **JSON contra un esquema estricto**: `{ puerta_abierta: "norte", aparece: ["sabueso"], herido: "Lyra" }`. Nada de prosa.
2. **El motor valida y resuelve.** ¿Existe esa puerta? ¿Ese bicho está en el bestiario? ¿Cabe en el tablero? Lo que no valide, se descarta y **se anota** — igual que hace hoy el validador de paquetes con errores, avisos y reparaciones.
3. **El motor coloca.** El modelo dice *«entra un sabueso por la puerta del norte»*; **nunca** dice `(9,3)`. Las coordenadas las pone `spawn.js`, que ya sabe colocar sin meter a nadie en un muro.

**Por qué esto sí es barato, aunque dijiste que no te importaba gastar.** Dos cosas que ya existen en la casa y que casi nadie usa juntas:

- `generateRaw({ jsonSchema })` — **salida estructurada**: pides JSON con esquema y el proveedor lo cumple.
- `ConnectionManagerRequestService.sendRequest(profileId, …)` — **un perfil de conexión distinto por llamada**.

Es decir: **tu «modelo fuerte para narrar, modelo flojo para el tablero» ya es posible hoy**, con maquinaria de upstream, sin inventar nada. Un extractor de 200 tokens contra un modelo barato por cada turno narrado. Esto no es una investigación: es fontanería.

**Lo que no veo:** que el modelo lleve el tablero *él*. Ni el más caro coloca fichas en una rejilla sin contradecirse a los tres turnos; en cuanto tenga que recordar que el sabueso está en (9,3) y que la puerta de (4,4) quedó abierta, se equivocará, y habrás pagado el modelo caro para obtener un tablero peor que el determinista. La división —él nombra, el motor sitúa— no es una concesión al presupuesto: es la que da mejor resultado.

**Y lo de la foto.** En la escena de diálogo **media pantalla está vacía**. Ahí va el tablero, pequeño, enseñando lo que se está narrando. Es lo primero de este nivel y es media tarde de trabajo.

---

### N2 · Que la conversación cree mundo

> *«La propia conversación puede crear localizaciones, misiones, objetos, personajes, enemigos, facciones… un algoritmo fuerte que haga partidas interactivas sin gastar millones de tokens.»*

**Lo veo**, y está más cerca de lo que parece: el destino ya existe. El editor de campaña escribe **exactamente** lo que escribe el importador de libros, y el exportador lo devuelve entero. Hay dos puertas a la misma forma de datos; esto sería **la tercera: jugar**.

**El algoritmo fuerte, en una frase**: las **tablas deciden la estructura, el modelo pone los nombres**.

Un ejemplo concreto de lo que cuesta cada cosa:

| Qué | Quién lo hace | Tokens |
| :--- | :--- | :--- |
| Cuántas salas tiene la cripta, su forma, dónde van las puertas | Generador con semilla (`seeded-random.js`, ya existe) | **0** |
| Qué bichos, de qué desafío, en qué casillas | Tablas de encuentro + `spawn.js` | **0** |
| Qué hay en el cofre | Tablas de botín, que ya leen el catálogo del mundo | **0** |
| Cómo se llama la sala, a qué huele, qué grabado hay en la puerta | El modelo, **una vez**, en lote | ~300 |

Eso es una mazmorra nueva por el precio de un párrafo. Y lo determinista es **repetible**: misma semilla, misma cripta.

**Lo que sí quiero avisarte.** El peligro de generar mientras juegas no es el gasto: es que **el mundo deje de significar nada**. Si cada puerta lleva a una sala nueva inventada al momento, no hay mapa que aprender ni sitio al que volver. La regla que lo evita: **lo generado se guarda como contenido de primera clase** —una localidad de verdad, en el Lorebook, editable en `/campana`— y no como texto suelto en el chat. Si aparece un herrero en una conversación, al día siguiente sigue estando en la fragua.

**Lo que no veo:** generar *reglas* al vuelo. Un enemigo nuevo, sí. Un tipo de daño nuevo a mitad de combate, no: las reglas son el contrato que hace que las cifras signifiquen algo, y se editan a mano en `/rules`, que para eso está.

---

### N3 · El desgaste, y el gremio encima

> *«Los personajes también necesitan comer, los compañeros que contratas por dinero tienen un salario, alojamiento, tasas, armas, armaduras, se desgastan… La muerte permanente existe, las heridas que tardan en curar también, o heridas que no sanan. Se puede perder un brazo, una pierna.»*

**Lo veo, y es el bucle entero.** Va aquí lo que antes llamaba «el gremio», porque el gremio resultó ser la mitad pequeña.

#### Las heridas son casi gratis, y son lo más dramático que hay

Lo mejor de esta idea es que **el motor ya está preparado y no lo sabe**:

```js
// Esto ya corre en cada paso de cada turno:
spendMovement(combatEncounter, distanceFeet, Number(member.speed) || 30)
```

**Una pierna perdida no es una bandera narrativa: es `speed: 30 → 20`.** Lo mismo un brazo (una mano menos, no hay arma a dos manos), un ojo (estorbo a distancia), una costilla mal curada (menos carga). Son **modificadores sobre campos que el motor ya lee cada turno**: velocidad, CA, características, carga.

No hay que construir un sistema de heridas. Hay que construir **una tabla** y un sitio donde guardar sus modificadores.

Y la muerte **ya tiene su disparador**: el tercer fallo de salvación ya devuelve `outcome: 'dead'`. Lo que falta es qué pasa después.

#### El conflicto que había que resolver, y cómo queda

Dos sistemas se peleaban: **los vínculos premian invertir veinte horas en alguien; la muerte permanente destruye esa inversión al azar.** Y había una trampa: con `/punto` libre, la muerte permanente **ya era opcional de facto** — recargas y Bruna conserva la pierna.

**Decidido: dos casillas al crear la campaña.** No una dificultad global: el tono de *esa* campaña.

| Casilla | Qué elige |
| :--- | :--- |
| **¿Cuándo se guarda?** | *Solo en el refugio* (entre encargos; dentro de la misión, lo que pasa pasa) · o *libre* |
| **¿Quién puede morir?** | *Solo quien viene por dinero* · o *todos, también los tuyos* |

Con la segunda apagada, el reparto sale de algo que ya distingue el juego — **el motivo por el que te siguen**:

| Quién | Qué le pasa al caer |
| :--- | :--- |
| **Quien te sigue por dinero** | **Muere.** Hay que contratar a otro. Su relación contigo *era* el sueldo, y duele donde tiene que doler: en la cartera |
| **Quien te sigue por un vínculo** | **Queda marcado**: pierde el brazo, cojea, no vuelve a ver bien de un ojo. Sobrevive la inversión y la partida cambia para siempre |

Con la casilla encendida, mueren todos, y los vínculos se juegan a cara o cruz. Es una campaña distinta, y por eso se elige al empezarla y no a mitad.

**Dónde vive esa decisión**: en el paquete de reglas de la campaña, donde ya viven las armas y las condiciones — así se elige al crear, se puede cambiar en `/rules`, y **viaja con la campaña** cuando la exportas.

#### La cuenta

| Cada | Qué se paga |
| :--- | :--- |
| **Día** | Comida, por cabeza. Sin ella, penalización visible antes de que sea grave |
| **Semana** | Sueldos, alojamiento, tasas |
| **Al volver** | Curar heridas, reparar equipo |

**La regla que hace que esto sea un juego y no papeleo**: *todo sale del mismo bolsillo.* Reparar la armadura compite con la cena y con pagar a Brand. En cuanto hay monedas separadas para cada cosa, deja de haber decisiones.

Por eso el desgaste del equipo, que es el sistema que más fácil se convierte en deberes, aquí sí vale: no es «pulsa Reparar cuando esté en amarillo», es «¿reparo la cota o le pago a Brand esta semana?».

#### El panel que **es** el apetito

> *Semana 3 · el viernes debes **140**, tienes **90**.*
> *Bruna: pierna rota, −10 pies, 12 días.*
> *Brand lleva 2 semanas sin cobrar. Lealtad −1.*

Determinista, cero tokens, y de golpe hay una razón para coger el encargo de mañana. Con la cuenta a la vista **antes** de que venza: una factura que te sorprende es un impuesto; una que ves venir es una decisión.

#### Y entonces sí, el gremio

Encima de lo anterior, y **opcional**: plantilla a escala, edificios que bajan costes o suben la calidad de los encargos, **tablón con rangos** y temática (generales, ladrones, asesinos, mercenarios) que **filtra lo que el generador produce**.

Un gremio de ladrones recibe encargos de infiltración porque su tabla pesa distinto. Eso es una línea de configuración sobre el generador del Nivel 3, no un sistema aparte.

**Lo que no veo:** el gremio antes que el desgaste. Sin la cuenta semanal, un tablón de encargos es una lista de botones.


### N4 · Los modos de juego

> *«Un modo un jugador donde no controlo a los otros personajes; las partys se forman si hay fines comunes, si hay buena relación. Y un modo grupo donde controlo todo.»*

**Lo veo, y la parte difícil no es la que parece.**

La IA de los compañeros es **la misma máquina que ya juega a los enemigos**: `enemy-ai.js` tiene cuatro perfiles tácticos (agresivo, hostigador, guardián, cobarde) y decide a quién atacar y por dónde moverse. Un compañero autónomo es ese código con otro bando. Eso es casi gratis.

Lo difícil es **la agencia fuera del combate**: que alguien se niegue a ir contigo. Y ahí hay una trampa de diseño que quiero dejar escrita:

> **Un compañero que te dice que no solo es divertido si entiendes por qué.** Si Brand se queda en el gremio y no sabes si fue por el vínculo, por la paga, por el rango de la misión o porque odia a los no-muertos, no has recibido una decisión: has recibido un error.

Así que el modo un jugador necesita, antes que la IA, **que sus razones se puedan leer**: una ficha que diga *«Brand: vínculo 2, quiere oro, odia a los Cuervos, no irá a una misión de rango B»*. Con eso puesto, la decisión se explica sola y el modelo solo tiene que **narrarla**, que es lo suyo.

**Lo que ya empuja hacia aquí**: los vínculos (`bonds.js`), la reputación de facción que el importador **ya guarda y nadie lee** (P17), y los perfiles tácticos.

**Lo que no veo:** un modo un jugador que sea el modo grupo con los botones escondidos. Si lo único que cambia es que no puedes mover a Brand, es el mismo juego con menos manos. El modo un jugador tiene que darte algo a cambio: que Brand haga cosas que tú no habrías hecho, y que a veces te sorprenda.

---

### N5 · Empezar con gente que ya existe

> *«A la hora de empezar una campaña, poder elegir personajes que ya existen, que no sean solo textos.»*

**Lo veo, es barato y media pieza ya está construida.** Hoy el paso 3 del asistente es una caja de texto: escribes *«Lyra»* y nace una ficha genérica — clase *Adventurer*, 10 en todo, 30 PG. Un nombre, no una persona.

**Lo que ya existe**: `showPartyPicker()` en `campaigns.js` dibuja exactamente la rejilla que hace falta —cara, raza, clase y nivel, con selección múltiple— pero solo sabe mirar dentro del mundo que ya está abierto. Falta **de dónde** puede elegir y **enchufarla al asistente**.

**Tres orígenes, y no valen lo mismo:**

| De dónde | Qué trae | Qué falta decidir |
| :--- | :--- | :--- |
| **Fichas de personaje de SillyTavern** | Cara, descripción, personalidad — **lo que pides: que no sea texto** | No traen números. O se les pone clase y nivel al elegirlas, o entran con los de por defecto |
| **Héroes de otra campaña** | Todo: clase, nivel, características, inventario, vínculos y **sus cicatrices** | Si entra un héroe de nivel 7 en una campaña nueva, se la come |
| **Arquetipos listos** (guerrero, pícara, clérigo) | Números coherentes desde el minuto uno | Hay que escribirlos una vez. Es el que más arregla el *«todos empiezan siendo Aventurero»* |

**La decisión que hay que tomar** —y la dejo abierta a propósito— es qué pasa con el héroe que viene de otra campaña: **¿conserva el nivel, o vuelve a 1 quedándose quién es?**

Con el desgaste del Nivel 2 puesto, la respuesta gana interés: un veterano que llega **con la pierna ya rota de otra partida** es una historia entera antes de la primera frase. Mi apuesta sería *conserva las cicatrices, negocia el nivel* — pero es tuya.

**Lo que no veo:** mezclar los tres orígenes en una sola lista revuelta. Una ficha de SillyTavern y un héroe de nivel 7 no son lo mismo y elegirlos del mismo cajón acaba en sorpresas; separados por pestaña, cada uno dice lo que trae.

---


## 🪜 Los niveles

Cada uno es un producto que se puede jugar y enseñar. El orden no es por tamaño: es **por cuánto apetito añaden**.

### Nivel 1 · El tablero vivo 🟡 `el tablero al lado del chat, hecho · el extractor, no`

Que lo que se cuenta se vea. Va primero **por barato**, no por importante.

1. **El tablero en la escena de diálogo** — media pantalla está vacía en la foto. Ahí va.
2. **El extractor** — modelo barato, salida con esquema, después de cada mensaje narrado.
3. **El puente** — lo extraído pasa por el validador y se vuelve eventos del motor: abrir puerta, despertar sala, aparecer enemigo, marcar herido.
4. **Dos perfiles de conexión** — fuerte para narrar, barato para extraer, con `/prompt` enseñando los dos por separado.
5. **El registro de lo que no cuadró** — lo que el modelo propuso y el motor rechazó, a la vista. El patrón ya existe: `/contradicciones`.
6. **Elegir el grupo en vez de escribirlo** — la rejilla de `showPartyPicker()` enchufada al paso 3 del asistente, con dos orígenes para empezar: fichas de SillyTavern y arquetipos. Los héroes de otras campañas, en el Nivel 2, que es donde el nivel y las cicatrices significan algo.

**Hecho cuando**: narras que se abre una puerta y aparece un sabueso, y en el tablero se abre la puerta y aparece el sabueso, en casilla legal, sin tocar nada.

---

### Nivel 2 · El desgaste ✅ `hecho y conectado`

El reloj de la semana. **Sin esto, todo lo demás es una demo bonita.**

1. **Las dos casillas al crear la campaña** — cuándo se guarda, quién puede morir. Guardadas en el paquete de reglas, editables en `/rules`, viajan con la campaña.
2. **La cuenta**: comida al día; sueldos, alojamiento y tasas a la semana; curas y reparaciones al volver. **Todo del mismo bolsillo.**
3. **Fail-Forward ante impago (Bancarrota reactiva)**: Si llega el viernes y falta oro, no hay parálisis ni game-over ciego. Una facción local o prestamista cubre la cuenta a cambio de un contrato forzoso con dilema moral (*ver *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES* §3*).
4. **La tabla de heridas** al caer a 0: temporales con sus días, y permanentes. Modificadores sobre `speed`, CA, características y carga — campos que el motor ya lee.
5. **Prótesis y Roles de Campamento**: Un compañero mutilado no es un lastre condenado a pudrirse: las forjas ofrecen prótesis que transforman la lesión, o el héroe puede pasar a rol pasivo en campamento/gremio (intendente, consejero).
6. **Qué pasa al morir**, según la casilla: el mercenario muere y hay que contratar; el del vínculo queda marcado.
7. **El panel de la cuenta**, con lo que debes **antes** de que venza.
8. **Un tablón de encargos flaco** — sin rangos todavía. Hasta un aventurero solo lee los avisos de la taberna.
9. **La plantilla**: contratar, con su sueldo y su motivo. Aquí entra el tercer origen — **héroes de otras campañas**, con sus cicatrices y con el nivel negociado.

**Hecho cuando**: una semana mala te obliga a elegir entre pagar a Brand o curarle la pierna a Bruna, y esa elección cambia quién sigue contigo o te arroja a una deuda de facción.

---

### Nivel 3 · El mundo que crece ✅ `el generador, hecho`

Que jugar escriba mundo — **para llenar ese tablón**. Generar mundos «porque sí» es una demo; generar el sitio donde se juega el encargo que aceptaste el martes es un juego.

1. **Generadores con semilla** para sala, localidad, PNJ, objeto y encuentro. Deterministas, cero tokens.
2. **Desacoplamiento de tableros**: La geometría del mapa (`terrain.js`) nace limpia de enemigos clavados. Los hostiles o PNJ se instancian dinámicamente según la misión activa, el peligro del bioma y la hora (*ver *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES* §4.1*).
3. **Nodos de Servicios de Localidad**: Cada asentamiento expone botones mecánicos funcionales (`services: ['inn', 'blacksmith', 'apothecary', 'temple', 'board']`) que interactúan directamente con el oro, inventario y heridas del grupo sin depender de prosa libre.
4. **Bautizo en lote** — el modelo pone nombres y una línea de sabor, en una sola llamada.
5. **Lo generado se guarda de verdad** — como localidad, ficha o misión en el Lorebook, editable en `/campana`. La tercera puerta al mismo destino.
6. **Semilla del mundo** — la campaña entera repetible.

**Hecho cuando**: una puerta que la conversación se inventó se puede volver a cruzar mañana, y la sala de detrás sigue siendo la misma, con enemigos que responden a la misión del momento.

---

### Nivel 4 · El gremio ✅ `hecho y conectado`

1. Plantilla a escala, con sus contratos y su lealtad.
2. Edificios: dormitorios, cocina, forja, biblioteca — cada uno baja un coste o sube la calidad de los encargos.
3. **Tablón con rangos**, filtrado por la temática del gremio.
4. Temáticas —generales, ladrones, asesinos, mercenarios— como **pesos sobre el generador del Nivel 3**, no como sistema aparte.

**Hecho cuando**: subir la forja cambia qué encargos te ofrecen, no solo cuánto reparas.

---

### Nivel 5 · Los modos ✅ `hecho y conectado`

1. **Ficha de razones** de cada compañero: qué quiere, a quién odia, qué rango acepta.
2. **Formación de grupo por afinidad**, dicha en una frase que se puede leer.
3. **Posturas tácticas de combate en Modo Solo** (`stances`): El aliado no usa IA de monstruo errática; el jugador elige con 1 clic: *Defensiva* (cobertura cercana), *Agresiva* (carga por flancos), o *Retaguardia* (distancia máxima y conjuros).
4. **Compañeros autónomos en combate**, respetando su postura y sin suicidarse por A* ciego.
5. **Modo grupo**: lo de hoy, explícito y elegible al crear la campaña.

**Hecho cuando**: pides a Brand que vaya a una misión, decide ir, y en combate cubre tu espalda porque su postura es Defensiva, en vez de correr solo contra tres ogros.

---

### Nivel 6 · El bucle cerrado 🟡 `se cierra; falta verlo entero en un navegador`

Nada nuevo: los cinco anteriores hablando entre ellos.

El tablón trae un encargo de rango B → eliges quién va, sabiendo que Bruna aún cojea → el generador construye el sitio → juegas el tablero → la narración lo mueve en vivo → vuelven con botín, con una herida nueva y con una relación distinta → pasa una semana y hay que pagar.

**Ese bucle es el producto final.** Todo lo demás son piezas esperándolo.

---


## 🚫 Lo que no veo, dicho entero

Para que no se quede como una duda:

| Idea | Por qué no |
| :--- | :--- |
| **Que el modelo lleve el estado del juego** | Se contradice a los tres turnos y cuesta diez veces más. La división modelo/motor no es ahorro, es calidad |
| **Coordenadas dichas por el modelo** | `(9,3)` no es lenguaje. El modelo nombra, el motor sitúa |
| **Generar reglas al vuelo** | Las reglas son lo que hace que las cifras signifiquen algo. Se editan a mano, en `/rules` |
| **Multijugador de verdad** | Es otro proyecto: servidor con estado, concurrencia, autoridad. El «modo grupo» es un jugador con varias fichas, y eso sí cabe |
| **Voz y retratos generados** | Tentador y sin fondo. Un retrato por PNJ a precio de imagen no lo paga un tope de 5 € |
| **Un modo un jugador que solo esconde botones** | Si no te sorprende, no es un modo: es una limitación |
| **El gremio antes que el desgaste** | Un tablón de encargos sin cuenta semanal es una lista de botones |
| **Monedas separadas** para reparar, comer y pagar | En cuanto cada gasto tiene su propio bolsillo, no hay ninguna decisión que tomar |
| **Un solo cajón revuelto** para elegir el grupo | Una ficha de SillyTavern y un héroe de nivel 7 no son lo mismo; separados por pestaña, cada uno dice lo que trae |

---

## 🧹 La carpeta, ordenada

Once documentos y ninguno decía cuál venía después de cuál. Así queda:

### Vivos — se siguen leyendo y actualizando

| Documento | Para qué sirve ahora |
| :--- | :--- |
| **[[ROADMAP_MAESTRO]]** *(este)* | El único plan. Todo lo demás cuelga de aquí |
| *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES* | Diagnóstico lúdico y catálogo de soluciones sistémicas (0 tokens) |
| [[POR_HACER]] | El marcador vivo: A hecho, D decidido, P propuesto |
| [[EMPEZAR_UNA_CAMPANA]] | La guía del jugador. La única que no habla de código |
| [[GEM_CREAR_CAMPANA]] | Generado por `tools/gem-instructions.mjs`. No se edita a mano |
| [[PROPUESTAS_MEJORA_V2]] | El catálogo reciente del que salen las tareas sueltas |
| [[PROPUESTAS_MEJORA]] | El catálogo v1: 155 de sus 200 ideas siguen sin mirarse. Cajón de opciones, no plan |
| *PROBLEMAS_TECNICOS* | La auditoría. Sigue viva porque la seguridad depende de una decisión tuya (solo local) |
| *DISENO_GENERADOR_MUNDOS_PROFUNDO* | **La materia prima del Nivel 2.** Sus siete categorías son el esquema que el generador tiene que producir |
| [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] | El contrato del paquete: el destino al que todo escribe |
| [[04-guias-referencia/Mapa-Codigo-Archivos]] | Qué hay en cada archivo |

### Historia — se quedan, pero no son planes

| Documento | Qué fue |
| :--- | :--- |
| [[ROADMAP]] | Las fases A–H, **todas cerradas**. Es el acta de lo construido, y sus secciones *El Principio que Ordena Todo* y *De Dónde Sale el Gasto* siguen siendo la mejor explicación del porqué |
| *PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA* | La visión original. Explica **por qué** el juego es así |
| [[PROPUESTA_FRONTEND_MODO_JUEGO]] | La Fase H, cerrada |
| [[ROADMAP_JUEGO_SIN_COMANDOS]] | El juego por clics, cerrado salvo lo que quedó en [[POR_HACER]] |
| [[PLAN_CREAR_CAMPANA]] | Las seis fases del editor, cerradas |
| *PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES* | El análisis comparativo. Lo valioso ya está en [[POR_HACER]] |

### Retirado

- **`PROPUESTAS_MEJORA.md`** (el catálogo v1, de 2026-09-20). Superado por el v2 y ya minado: lo que seguía vivo está en [[POR_HACER]] como P1–P23. Sigue en el historial de git si hiciera falta.

---

## 🔭 De los planes viejos, lo que sube a este

Lo que merecía sobrevivir, con su nivel asignado:

| De | Qué | Nivel |
| :--- | :--- | :---: |
| P5 | Panel del estado canónico: ver lo que el motor da por cierto | **1** |
| P20 | Interactuables en el tablero: cofres, palancas, barricadas | **1** |
| P21 · P22 | Oleadas de refuerzos y fases de jefe | **1** |
| P15 | Que el día sirva para más que descansar: entrenar, estudiar, mercado | **2** — el día ya cuesta dinero |
| P18 | Rutas de viaje con días y peligro | **2** — viajar gasta comida y días |
| P8 | Punto de guardado | **2** — deja de ser comodidad y pasa a ser una regla de la campaña |
| P1 · P3 | Generar escenarios y enemigos sueltos con IA | **3** |
| P23 | Terreno como **datos** y no como código (agua, lava, trampas) | **3** |
| P14 | Confidentes que no van en tu grupo — la tabernera, el herrero | **4** |
| P19 | Horarios de PNJ por franja del día | **4** |
| P17 | Que la reputación de facción **haga algo** | **5** — es la mitad de «con quién va quién» |
| P7 | Deshacer en el tablero | suelto |
| P13 | Un `CHANGELOG.md` del fork | suelto |

---

## ⚖️ Sobre el gasto, ya que lo mencionaste

Dijiste *«no importa que sea una gastada de tokens»*. Te agradezco el permiso y creo que **no vas a necesitarlo**, y quiero que quede escrito por qué:

El diseño que hace esto barato es **el mismo** que lo hace fiable. Un extractor con esquema contra un modelo flojo no es la versión pobre de «que el modelo lleve el juego»: es la versión **buena**, porque el motor sigue siendo la única autoridad y las partidas siguen siendo repetibles. El modelo caro se reserva para lo único que solo él sabe hacer: **escribir bien**.

Dicho de otro modo: el presupuesto no te está obligando a hacer un juego peor. Te está empujando al diseño correcto.

---

## 🔗 Enlaces

- [[POR_HACER]] — qué se hace mañana.
- [[ROADMAP]] — qué se hizo hasta aquí, y por qué está hecho así.
- *DISENO_GENERADOR_MUNDOS_PROFUNDO* — el esquema que el Nivel 2 tiene que producir.
- *PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA* — de dónde salió todo.
