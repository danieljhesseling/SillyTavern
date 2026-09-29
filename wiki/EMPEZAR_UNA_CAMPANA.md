# 🎲 Empezar una campaña

*De no tener nada a estar jugando, en unos minutos. Esta guía es para sentarse a jugar; si lo que buscas es el estado del proyecto, el plan está en [[ROADMAP_SIN_CONEXION]], lo que falta fuera de él en [[LO_QUE_FALTA]] y lo pendiente del día a día en [[POR_HACER]].*

---

## Lo único que hay que entender antes

El juego está partido en tres capas, y saberlo ahorra la mitad de las sorpresas:

| Capa | Quién manda | Qué cuesta |
| :--- | :--- | :--- |
| **Estado** | El motor. Los puntos de vida, las posiciones, el día, los vínculos. | Nada |
| **Reglas** | El motor. Tiradas, alcance, cobertura, botín, objetivos. | Nada |
| **Narración** | El modelo. Lo que se cuenta de todo lo anterior. | Tokens |

**El modelo lee el estado; no lo escribe.** Si dice que alguien ha muerto y el motor lo tiene en pie, el que tiene razón es el motor — y queda anotado (ver *Cuando algo no cuadra*, más abajo).

Eso también quiere decir que **la parte táctica funciona sin proveedor**: moverse, pelear, abrir puertas, descansar y repartir botín no pasan por ningún modelo. Sin proveedor te falta el narrador, no el juego.

---

## 1. Arrancar

```bash
npm start
```

Y abre <http://localhost:8000>.

Si el servidor llevaba abierto desde antes de un cambio, reinícialo y recarga la página con `Ctrl+F5`: el navegador guarda los scripts y te enseñará la versión de antes.

**Para tener narrador**, configura un proveedor en el panel de API (el icono del enchufe, arriba). Cualquiera vale. Si no lo haces, sáltate este paso y juega igual: lo verás en cuanto escribas algo y no conteste nadie.

---

## 1b. Jugar sin conexión: tu gremio y sus campañas

*Desde el 2026-09-28. El plan entero está en [[ROADMAP_SIN_CONEXION]].*

Es el primer botón de la portada. Lo cuenta todo el juego, sin IA, aunque tengas un proveedor conectado.

1. **«Jugar sin conexión»** crea un gremio nuevo y te pide tu personaje: nombre, especie y clase (lo demás es opcional). Llegas con 100 de oro.
2. **La prueba.** Brunilda, la maestra del gremio, te manda a la bodega a por unas ratas. La ficha «Iniciar combate (Rata de bodega x2)» empieza la pelea. Al ganarla, el hilo te lleva al tablón.
3. **El gremio.** La Casa del Gremio tiene posada, tienda, templo y herrería, como cualquier pueblo. Y dos fichas propias:
   - **«Contratar mercenarios»** (`/contratar`): Gerd, Nella y Osric. Se pagan una vez (40 de oro por nivel) y van contigo de campaña en campaña, hasta que los despidas o caigan. No traen oro ni habilidades y no se llevan parte del botín: pegan y aguantan. Al ir y volver del gremio entrenan hasta el nivel de tu héroe.
   - **«Tablón de campañas»** (`/campanas`): *1387* y *La Maldición de Strahd*, con el nivel para el que son y cómo van (sin empezar, en curso, terminada).
4. **Empezar una campaña** crea su mundo y te lleva a su primer tablero con **el grupo entero**: vida, oro, equipo, nivel y mercenarios.
5. **«Volver al gremio»** (`/volver-gremio`), fuera de combate: vuelves con todo lo ganado, y la campaña se queda donde la dejas. En el tablón sale «En curso»; pulsarla la sigue en el mismo sitio.
6. **Al abrir la página otra vez**, la portada ofrece **«Seguir en el gremio»**, con quién va.

**Qué es cada cosa, por dentro.** El gremio es un mundo pequeño con su chat (`public/mundos/gremio.pack.json`). Cada campaña del tablón es su propio mundo y su propio chat, como las de siempre; en la lista de partidas no salen sueltas, se siguen desde el tablón. Lo que viaja entre chats es el grupo (`campaign/hub.js`).

**Añadir una campaña al tablón.** Basta con una entrada en `public/mundos/mundos.json` con su `pack` (y `levels`, para el aviso de nivel). Si llega en tu formato, como Strahd:

```bash
node tools/campana-a-paquete.mjs strahd          # junta original.json, libro.json y mejoras.json en public/mundos/strahd.pack.json
node tools/campana-a-paquete.mjs strahd --check  # falla si el paquete no es lo que sale de los tres
```

- `wiki/campanas/strahd/original.json` es tu JSON, tal cual; si mandas otra versión, se pisa.
- `wiki/campanas/strahd/libro.json` es lo que escribí yo a partir del libro, con palabras mías: la gente, los rumores, los encargos, las facciones, las escenas de los confidentes, los sitios que se descubren y seis tableros para los encargos.
- `wiki/campanas/strahd/mejoras.json` es lo que le puse encima para jugarla: rutas y servicios, los tableros arreglados y cuatro nuevos, enemigos para niveles bajos, la trama (los hitos salen de tus misiones) y el final. Lo escrito por mí va marcado con «propio:».

**Para probar si una campaña se puede ganar:** `node tools/sim-campana.mjs --campana strahd` juega sola cada tablero del hilo, en orden, con un héroe y dos mercenarios que suben de nivel de verdad, y dice cuáles gana. Con Strahd (2026-09-28): gana los 12 tableros, y a Strahd, a nivel 5, en 16 rondas. Tarda media hora.

---

## 2. Crear la campaña

### Partida nueva: tres puertas y el taller

En la pantalla de título, **Partida nueva**. Primero, tres puertas:

| Puerta | Para qué |
| :--- | :--- |
| **Desde cero** | Lo escribes tú, paso a paso, o se lo pides a la IA. Lo que no escribas lo decide la semilla. Aquí están las plantillas (apartado a) y la generación con IA (b) |
| **Un mundo hecho** | Cuatro mundos ya escritos. *1387* es el único escrito entero: nueve rondas de guion, quince batallas, casos y gente con nombre; *La costa que no duerme*, *Las tierras del ocaso* y *El mundo tras la pantalla* son una ficha y una semilla. Cada uno trae **tres héroes hechos**: al entrar pulsas uno y juegas (el tercero llega con su mascota). Si prefieres el tuyo, *Quién eres* sigue ahí |
| **Importar un libro** | El JSON que te ha dado tu Gem (apartado c) |

Después, el **taller**: las doce pestañas a la izquierda (el mundo, quién lo cuenta, localizaciones, tableros, habilidades, razas, clases, objetos, facciones, bestiario, personajes y jugabilidad), cada una con su marca (✓ cambiada, • como viene, ⚠ algo no cuadra). Entras en las que quieras; **Crear y jugar** funciona desde cualquiera, y **Cancelar** no crea nada. En *Jugabilidad* se elige el modo (apartado 7c).

Cada pestaña es **la lista a la izquierda y la ficha a la derecha**: pulsas una tarjeta y su ficha sale al lado, sin bajar a buscarla. Arriba de la lista, los filtros (por dónde está un sitio, qué quiere una facción, dónde vive alguien, armas o armaduras…) y el botón de añadir (**Nuevo sitio**, **Nueva facción**…), que no se va al bajar. Lo que entra en el mundo lleva una ✓ dorada; la abierta, el borde dorado entero. Al pie de la ficha: **Dejar fuera del mundo** (o **Meter en el mundo**) y, en rojo, **Quitar** lo que te hayas inventado.

**Todo se puede retocar y todo se puede añadir**, también las razas, las clases, las habilidades, los objetos y los bichos:

- **Retocar** una de serie la cambia **solo en este mundo**; el compendio de todos no se toca. Lleva la marca *Retocada*, y **Volver a la de serie** la deja como venía.
- **Añadir** (**Nueva raza**, **Nuevo objeto**…) parte de la que tengas abierta, así hereda lo que el juego necesita. Lleva la marca *Tuya*.
- **Qué da y qué quita** una raza o una clase se escribe como se lee: *+2 Destreza, −1 Carisma*. Si solo suma, o no se entiende, la pestaña avisa (⚠) y lo dice debajo del nombre.
- **Una habilidad nueva «funciona como»** una que ya existe: le pones nombre y de qué clase es, y copia cómo se resuelve. Una mecánica nueva es código, no un dato.
- **Lo tuyo va con el mundo**: el creador de personaje ofrece tus razas y clases, y la partida usa tus objetos, bichos y habilidades.

En **un mundo escrito** (1387) pasa lo mismo con sus **localizaciones, tableros, facciones y personajes**. Antes solo se veían; ahora se retocan o se añaden, y lo tocado se pone encima al crear la campaña. El mundo de serie no cambia para el siguiente que lo elija. Tres cosas que se cuidan solas:

- **Si cambias el nombre de un sitio**, cambia también en los caminos, los tableros, las facciones y la gente.
- **Un sitio nuevo** pregunta *desde dónde se llega* y cuántos días: el camino se pone en los dos sentidos.
- **Un tablero nuevo** se elige por forma y tamaño y se dibuja al crear, con la semilla del mundo.

La gente sale en dos grupos: *Compañeros* (los que se pueden unir al grupo) y *Vecinos*.

**Los tableros se ven y se pintan.** Al pulsar un tablero, su ficha lo enseña entero:

- Eliges un pincel (suelo, muro, puerta, cobertura, cobertura alta, terreno difícil, agua, barril, salida) y pulsas y arrastras.
- Con **Empieza el grupo** pones o quitas, clic a clic, las casillas donde aparece el grupo, en dorado.
- Los enemigos que trae escritos un tablero de 1387 no se enseñan. Si pintas encima de uno, al crear la campaña se coloca solo en la casilla libre más cercana a la que se pueda llegar.
- El borde es muro siempre.
- **Dibujar otro** tira uno nuevo con la semilla. Cambiar la forma o el tamaño también lo vuelve a dibujar, y se pierde lo pintado.
- **Lo que ves es lo que se juega**: al crear la campaña se usa ese mismo mapa.
- Si el grupo se queda sin dónde empezar, la pestaña se pone con ⚠ y te dice el motivo.

> **Misiones ya no es una pestaña** (2026-09-28). Las misiones de un mundo escrito siguen entrando con él; para escribir las tuyas, `/campana` → *Misiones*.

La prisa se resuelve igual: **Un mundo hecho** → 1387 → *Jugabilidad* → **Crear y jugar** → un héroe hecho.

### a) Una plantilla — *para jugar ya*

*Mazmorra clásica*, *Bosque*, *Taberna* o *Lienzo en blanco*. Escribes un nombre y creas. Lo siguiente que ves es **quién eres**: nombre, género, raza, clase y una línea sobre ti. Solo el nombre hace falta; lo demás se puede decidir jugando.

Es el camino corto y el que conviene la primera vez: te deja algo jugable en treinta segundos y todo lo demás se puede cambiar después.

> **La varita.** En *Quién eres* no hace falta que escribas la ficha: escribe **qué quieres** —*«algo triste sobre lo pobre que es»*— y pulsa la varita. Cuesta una llamada al modelo y devuelve dos o cuatro frases, porque eso acaba en el Lorebook y se inyecta cada vez que alguien te nombra. La cara se busca en tu disco, no se teclea una ruta.

**Empiezas solo.** El grupo ya no llega hecho: crece jugando. Para meter a alguien ahora mismo, `/campana` → *Personajes* → **Añadir alguien del mundo** → **Reclutar**. Entra con la ficha que le escribas y en una casilla libre.

### b) Generar con IA — *para una idea concreta*

Describe el mundo que quieres —*«una cripta inundada bajo una iglesia en ruinas»*— y pulsa **Generar**. Cuesta **una llamada** al modelo.

Lo que vuelve se enseña antes de crear nada: el mapa, los enemigos, dónde empiezas. Y se puede tocar:

- **El mapa es editable ahí mismo.** El modelo acierta con la sala y falla con una pared; corrígela en el cuadro y se revisa sola.
- **Cada intento se guarda.** Si generas otra vez y la anterior era mejor, vuelve a ella con un botón. Generar no es una apuesta.

### c) Importar un libro — *para jugar una campaña que ya existe*

El camino largo, y el que más da. Te lleva un rato la primera vez y luego se repite en dos minutos.

1. Monta el Gem con **[[GEM_CREAR_CAMPANA]]**: trae el bloque exacto que va en su caja de instrucciones —quién es, cómo trabaja, el contrato entero y una muestra— y cómo hablarle después. Si prefieres verlo dentro del juego, `/esquema-campana` enseña lo mismo.
2. Dale el libro de campaña y pídele el paquete **sección por sección**: `world`, `locations`, `confidants`, `bestiary`, `items`, `boards`, `quests`. Corrige lo que no te guste antes de pasar a la siguiente.
3. Al final dile **«ensambla»**: te devuelve el paquete completo en un solo bloque, que es lo único que el juego acepta.
4. Vuelve aquí: **Nueva campaña → Importar un libro**, pega el JSON y pulsa **Comprobar**.

El informe sale **antes de crear nada** y dice tres cosas por separado:

- **Lo que impide importar**: una misión que apunta a un tablero que no existe, un enemigo colocado que no está en el bestiario, dos compañeros con el mismo nombre, un mapa cuyas filas no miden lo mismo, el grupo empezando dentro de una pared.
- **Avisos**: cosas raras que se pueden jugar igual, como un tablero al que ninguna misión te lleva.
- **Lo reparado**: lo que se arregló al leerlo, listado y nunca en silencio.

Si pasa, créala y ya estás dentro.

> **Un libro no es solo mazmorras.** Una localidad puede tener **cero tableros**: una aldea donde solo se habla, se pasa el rato y se sube un vínculo es tan válida como una cripta. Se declara en la sección `locations` del paquete — el ejemplo del contrato trae una, *Vado de la Rueda*, precisamente para enseñarlo.

---

## 3. Tu primera sesión, en diez minutos

Estás en el tablero. Prueba esto en orden; cada paso enseña una pieza distinta.

1. **Habla.** Escribe en el chat como en cualquier chat. Eso va al modelo, que narra.
2. **Muévete con el ratón.** Haz clic en tu ficha: se encienden las casillas a las que llegas con el movimiento que te queda. Haz clic en una y vas. (Arrastrarla también sigue funcionando.)
3. **Abre una puerta.** Haz clic en ella. Se revela la sala que guardaba y **despierta lo que dormía dentro**, en la casilla donde lo dibujó el libro. Ese es el ritmo: el siguiente combate llega cuando *tú* decides abrir.
4. **Pelea.** `/fight <enemigo> 1` empieza el combate. A partir de ahí, **haz clic en el enemigo**: se abre su tarjeta con sus PG, su armadura —con la cobertura desglosada— y la distancia.

   La regla de toda la interfaz es una sola: **un clic nunca gasta nada; un botón sí.** Mirar a un enemigo es gratis; atacar es el botón *Atacar* de su tarjeta. Y cuando algo no se puede hacer, la tarjeta dice por qué: *«Fuera de alcance: 30 ft de 5 ft»*.

   Cada tirada queda en el registro desglosada: fórmula, dados, total, contra qué armadura.
5. **Termínalo.** Gánalo, o `/combat-stop` para abandonarlo. En el chat aparece un **mensaje de narrador** con el resumen — y ese es el único del combate que el modelo llega a leer. Todo el intercambio de golpes es gratis.
6. **Descansa.** `/descanso corto` gasta dados de golpe y un bloque del día; `/descanso largo` cura del todo, devuelve la mitad de los dados y amanece.

Y cuando quieras verlo a pantalla completa: **`/modojuego`**.

---

## 4. El Modo Juego

### Al abrirlo

`npm start`, abres el navegador y sale el **menú principal**: *Partida nueva*, *Cargar partida* y *Opciones*. Si tenías una campaña a medias, no ves el menú: entras directamente donde lo dejaste.

*Opciones* abre los ajustes de SillyTavern de siempre, donde siempre. Y abajo hay una línea pequeña, **Salir al SillyTavern de siempre**, que apaga el juego y te deja la aplicación tal cual.

> Si prefieres que **no** se abra solo: `Esc` → *No abrir el juego al arrancar*. Se queda apagado hasta que lo enciendas, y siempre puedes volver con `/modojuego`.

Una capa a pantalla completa con tres pantallas que se alternan **solas** según lo que pase en la partida:

| Tecla | Pantalla | Cuándo aparece sola |
| :---: | :--- | :--- |
| `1` | **Diálogo** — retrato de quien habla, su rango de vínculo, el chat debajo | Al terminar un combate, para el epílogo |
| `2` | **Exploración** — a pantalla entera y sin tablero: arriba el sitio y a qué huele; debajo, tres columnas: *Aquí mismo* (cada edificio con lo que se hace dentro y lo que cuesta), *Tableros de aquí* y *Viajar* | Al salir de un tablero |
| `3` | **Combate** — el tablero grande, el rastreador, el registro y la barra de acciones | Al empezar un combate, o al entrar en un tablero |
| `Esc` | **Pausa** | Cuando tú quieras |

El director escucha **al motor**, no al narrador: si el modelo escribe *«todos a la iniciativa»* pero no hay encuentro, la pantalla no se mueve.

**Se viaja de vecino en vecino.** En *Viajar* solo se pulsan los sitios que tienen un camino directo desde donde estás, con los días que cuesta. Lo que queda más lejos se ve, apagado, con lo que cuesta y **por dónde se pasa** (*«3 días de viaje, pasando por Castillo de Vane»*). Un camino cerrado dice por qué. De la posada no se salta a la otra punta del mapa: se va al pueblo, y del pueblo al santuario. Los caminos son los `caminos:` del guion; un mundo sin caminos escritos sigue dejando ir a cualquier sitio.

En pausa vuelve la barra de SillyTavern, así que **Opciones** abre sus paneles donde siempre. **Salir al menú principal** cierra la partida pero **no el juego**: acabas en el título, con tus campañas, y puedes continuar otra sin salir.

Y se puede apagar: `/modojuego` otra vez, o *Salir del Modo Juego*. Con él apagado, la aplicación es exactamente la de siempre.

### Jugar con el ratón

La regla, y vale para todo: **un clic nunca gasta nada; un botón sí.**

| Dónde | Qué haces | Qué pasa |
| :--- | :--- | :--- |
| Tu ficha en el tablero | Clic | Se encienden las casillas a las que llegas. No gasta nada |
| Una casilla encendida | Clic | Te mueves, descontando los pies |
| Un enemigo | Clic | Abre su tarjeta: PG, CA (con la cobertura aparte) y distancia. **No gasta el turno** |
| La tarjeta | Botón *Atacar* | Ahí sí se resuelve el golpe |
| Una puerta | Clic | Se abre, se revela la sala y despierta lo que dormía dentro |
| La cabecera | Los cuatro botones del reloj | *Pasar el rato*, *Dormir*, *Descanso corto*, *Descanso largo*. Peleando se apagan y dicen por qué |
| Bajo el chat | Las fichas de acción | Abrir la puerta de tal casilla, hablar con alguien, descansar, entrar en un tablero, viajar (a los vecinos) |
| Una cara del grupo | Clic | Su ficha: vínculo, *Pasar tiempo* (gasta un bloque del día) y *Regalar* |

Dos avisos que salen solos: el cartel de **¡INICIATIVA!** cuando algo despierta, y el botón de **Relevo** sobre los compañeros válidos cuando derrotas a alguien y te sobra movimiento.

Si el tablero tiene enemigos dibujados y nadie pelea, aparece **Iniciar combate** al lado: empieza el encuentro con esos enemigos, en sus casillas.

Las fichas de acción de *hablar* **no envían nada**. Abren la charla (lo de abajo); con el narrador en «Modelo», dejan la frase empezada en el chat para que la termines tú.

### Jugar sin gastar tokens

Todo lo de esta sección funciona **sin proveedor** (0 tokens). Con proveedor también, y el modelo pone la voz. Ver [[ROADMAP_SIN_TOKENS]].

| Qué | Cómo va |
| :--- | :--- |
| **El narrador del motor** | Cuenta el viaje, la llegada a un sitio, la entrada en un tablero, el final de un combate, el descanso, una muerte, la semana y el cambio de acto. Las frases están en `compendio/frases.json` y se editan sin programar |
| **Quién hay en el tablero** | Los enemigos que trae escritos un tablero se ven aunque todavía no haya pelea: en rojo, con el borde a trazos, y no se pueden mover. Son los mismos que ofrece *Iniciar combate*. Ganada esa pelea, ya no vuelven. Lo que duerme tras una puerta sin abrir, o bajo la niebla, sigue sin verse |
| **Hablar con alguien** | Una ventana con de qué se puede hablar: lo que te trae, qué sabe, qué busca, qué se cuenta, el caso y qué piensa de vosotros. **Lo que sabe, busca y piensa sale cerrado (🔒) hasta ganárselo**: qué sabe, a quien os aprecia (o amenazándole); qué busca y qué piensa, a quien os aprecia o si le has calado (Sonsacar, Perspicacia). Al pulsar uno cerrado, dice cómo se abre. **Quien os planta cara** (el alguacil que revienta la puerta con sus guardias) os mira receloso aunque antes os mirase neutral, no ofrece rumores ni ronda, y las respuestas sugeridas son contestarle («No he sido yo», «¿De qué se me acusa?», convencerle, calarle). Y *Convencer*, *Sonsacar*, *Amenazar* (sale o no, y siempre te lo tiene en cuenta) e *Invitar a una ronda* (donde hay posada). *Despedirse* acaba la conversación |
| **Escribir en la caja** | Sin modelo, lo lee el juego: «voy a la posada», «vamos al castillo», «entro en el callejón», «hablo con Giles», «le pregunto al alguacil por los rumores», «busco huellas en el barro», «examino el cadáver», «me escondo», «descansamos», «espero a la noche», «compro una antorcha», «vendo la chatarra», «ataco al lobo»… Lo que no entiende te lo dice, con frases que sí valen aquí |
| **Las tiradas** | Salen **bien**, **a medias** (se falla por tres o menos: se consigue, pero se paga) o **mal**, y cada una hace algo: una pista, un rumor, unas monedas, algo de comer, un rato del día, una herida, cómo te mira alguien. Lo que se gana, una vez por sitio y día |
| **Qué examinar** | Cada sitio ofrece dos cosas que mirar, según su tipo (las huellas del barro, las inscripciones del altar…), cada una con su tirada |
| **Los sucesos** | Cada viaje trae una tarjeta con dos o tres opciones y su precio (oro, tiempo o una tirada). A veces también al llegar, al dormir o al empezar la semana. Lo que eliges tiene efecto, queda en el Diario y a veces vuelve días después. Están en `compendio/sucesos.json` |

**El narrador, en tres modos.** «Motor» (0 tokens: lo cuenta todo el juego), «Mixto» (el juego cuenta y resuelve, y lo que la caja entiende lo hace él; el modelo contesta lo demás, lo que le dices a quien hablas y las tiradas que él pide o que van delante de lo que has escrito) y «Modelo» (como antes: las fichas dejan la frase para el modelo). Se elige en la pausa (`Esc`), en la fila de abajo: *Narrador: …* pasa de uno a otro. Sin conexión es siempre «Motor». Ahí mismo, *Sucesos con decisión* los enciende o los apaga.

**Con modelo, contesta a quien le hablas.** Mientras hablas con alguien (la ficha, `/hablar` o escribir «hablo con…»), el modelo contesta como esa persona, con su voz, y el mensaje sale a su nombre. El narrador vuelve cuando te despides.

**Lo que escribes lo contesta quien tienes delante** (2026-09-28). No hace falta decir «hablo con».

- **Si nombras a alguien que está aquí**, de este sitio o de tu grupo, contesta esa persona.
- **Si no nombras a nadie, contesta quien te planta cara.** Por ejemplo, el alguacil Torres cuando revienta la puerta del cuarto con sus guardias. Desde ahí estás hablando con él, con sus respuestas sugeridas y *Despedirse*, hasta que te despides, te vas o empieza la pelea.
- **Si no hay nadie delante**, contesta el narrador contando qué pasa.
- **El narrador cuenta los momentos que importan:** llegar a un sitio, entrar en un tablero, acabar un combate, el hilo de la historia.
- **Para hablarle a él directamente**, pulsa **Al narrador** (junto a *Tirada*). Lo siguiente que escribas va a él, fuera de la escena: «¿qué puedo hacer?», «¿qué sabe mi personaje de esto?». Contesta él y el botón se apaga solo.
- **Sin modelo**, *Al narrador* abre lo mismo que *¿Qué hago?*.

**Lo que un combate retiene mientras dura.** No desaparece: se queda a la vista, apagado y diciendo por qué.

| Retenido | Por qué |
| :--- | :--- |
| Viajar, salir del tablero, el mapa del mundo, la pestaña *Exploración* — y también `/go`, `/enter` y `/leave` | Irse sin decidirlo dejaba el encuentro vivo sobre un tablero que ya no estabas mirando |
| El botón **Terreno** | Mover un muro a mitad de un turno cambia quién ve a quién, por dónde se pasa y cuánto cuesta llegar |

**Abandonar** nunca se retiene: salir de una pelea es una decisión tuya y tiene su propio botón. El **diálogo** y el **tablero** siguen abiertos, porque se narra y se mira mientras se pelea.

### Lanzar algo

Las técnicas de tu campaña se escriben en **`/habilidades`**: un panel con un campo por cosa — qué cuesta, cuántas veces, a quién alcanza y qué hace — y, al lado, **quién se sabe cada una**. Cada clase trae las suyas desde el primer nivel, y el tercer paso de cada rama enseña una nueva.

**Los conjuros son otra cosa**: salen del grimorio, que está en el código, y aquí solo se ajustan sus números. `/grimorio` dice cuáles sabe el grupo, con sus cargas (tres de 1º, dos de 2º, una de 3º, que vuelven con el descanso largo) y el componente que gastan los gordos.

Algunas tienen **área** (un radio, una línea o un cono) y **elemento**: antes de usarla, la tarjeta dice a quién alcanzaría. El fuego prende la maleza y las cajas y revienta los barriles, el frío hiela el agua, el trueno revienta puertas, la naturaleza hace brotar maleza y la luz despeja la oscuridad. Lo que pasa en el tablero se ve en el tablero.

| Dónde | Qué sale |
| :--- | :--- |
| Tarjeta del enemigo | Las que van sobre él, con su propio alcance: un conjuro de 120 ft no está *«fuera de alcance»* porque tu espada llegue a 5 |
| Barra de combate → *Habilidades* | Las de uno mismo y las de aliado. Si necesita aliado, te pregunta a quién |

Entre paréntesis, al lado del nombre, van **los usos que te quedan**. Cuando se acaban, el botón se apaga y dice con qué descanso vuelven: el corto devuelve lo de descanso corto, el largo lo devuelve todo.

Lo que aplica una condición — *derribado*, *aturdido* — la pone **con sus rondas**, y se va sola cuando toca. Lo que pongas tú a mano con `/condition` se queda hasta que lo quites.

> **El catálogo viaja con las reglas de la campaña**, así que se exporta con ella y le llega a quien le pases el paquete.

### Subir de nivel

Cuando alguien tiene experiencia de sobra, **le sale una estrella en la cara** de la tira del grupo. Pulsa su cara → *Subir de nivel*, o ábrele la ficha desde el cajon del grupo.

La tarjeta te dice **antes de pulsar** a qué nivel sube y qué da: puntos de golpe (del dado de su clase más Constitución) y dados de golpe. Si el salto cruza un nivel con **mejora de característica** — el 4, el 8, el 12… — hay dos puntos que repartir, y no te deja confirmar hasta que cuadren. Ninguna característica pasa de 20.

Si te sobra experiencia para varios niveles, sube **todos de una vez**: pulsar cinco veces el mismo botón no es jugar.

> **Lo que cuesta cada nivel se edita en `/rules`**, en *Experiencia por nivel*. Una campaña más rápida, o que pare en el nivel 10, no necesita tocar código.

---

## 5. Los comandos, por para qué sirven

Todo esto se puede seguir escribiendo, y el recorrido de pruebas entra por aquí. Si un botón y su comando hacen cosas distintas, eso es un fallo.

**La partida**

| Comando | Qué hace |
| :--- | :--- |
| `/exportar-campana` | Empaqueta tu campaña en un archivo que otro puede importar. También en el menú de pausa |
| `/sonido` | Qué suena en cada escena. Las pistas las pones tú |
| `/habilidades` | Escribe técnicas y reparte quién se sabe cada una. Los conjuros no se crean aquí: solo se ajustan |

**Moverse por el mundo**

| Comando | Qué hace |
| :--- | :--- |
| `/go <sitio>` | Viajar a una localización. Si no es vecina, el grupo va parada a parada: llega de verdad a cada sitio de en medio, con sus días |
| `/hablar <nombre>` | Hablar con alguien de aquí: abre la charla, sin gastar tokens |
| `/examinar <algo>` | Examinar algo de aquí, con la tirada que toque y su consecuencia |
| `/enter <tablero>` | Entrar en un tablero de donde estés |
| `/leave` | Salir del tablero, y luego de la localización |

**Pelear**

| Comando | Qué hace |
| :--- | :--- |
| `/fight <enemigo> [n]` | Empezar un combate con lo que este tablero puede sacar |
| `/combat-attack <enemigo>` | Atacar a quien tengas al alcance |
| `/combat-move <x> <y>` | Mover al que actúa |
| `/combat-end` | Cerrar tu turno |
| `/combat-stop` | Abandonar el combate, con epílogo |
| `/definitivo <enemigo>` | El golpe del vínculo de rango 10: impacta sin tirar. Una vez al día |
| `/relevo` | Ceder tu movimiento restante a un compañero (perk de rango 5) |

**La semana, la magia y la mascota**

| Comando | Qué hace |
| :--- | :--- |
| `/modo` | En qué modo juegas y qué está encendido. Se puede cambiar a mitad de partida, y queda escrito |
| `/mesa` | La mesa de la semana: los asuntos que no caben todos, con su plazo y lo que pasa si no se atienden |
| `/cuenta` | Lo que debes esta semana y cuánto tienes |
| `/grimorio` · `/grimorio todo` | Lo que el grupo sabe lanzar, con sus cargas y lo que gasta; con `todo`, toda la magia que existe |
| `/pergamino` | Aprender el conjuro de un pergamino, en vez de leerlo (el mago o el erudito) |
| `/mascota` | Tu mascota: tenerla, preguntarle, acariciarla. No ocupa plaza ni cobra |
| `/caso` · `/convencer <quién>` | El caso abierto; convencer a alguien en un duelo de palabras |
| `/mapa` | El mapa en texto, con lo no visitado en gris y tus notas |
| `/punto` · `/estado` | Puntos de retorno; lo que el juego da por cierto |

**La campaña**

| Comando | Qué hace |
| :--- | :--- |
| `/time` | En qué día y momento estás |
| `/descanso corto` · `/descanso largo` | Descansar |
| `/bond <nombre> <evento>` | Registrar algo que pasó con un compañero |
| `/objetivos` | Los objetivos del tablero, y cómo van |
| `/condition <nombre> <estado>` | Poner o quitar una condición |

---

## 6. Cambiar el contenido, sin tocar código

Esto es media razón de ser del proyecto: **nada de lo de abajo pide abrir un archivo.**

| Quiero… | Cómo |
| :--- | :--- |
| **Escribir mi mundo entero**: sitios, gente, bichos, objetos, misiones | `/campana` — o **Editar la campaña** en el menú de pausa |
| **Borrar una campaña entera** | La papelera de su tarjeta, en *Cargar partida*. Se va el mundo **y** sus sesiones, y te dice cuánto pierdes antes de hacerlo |
| **Elegir quién narra, y con qué tono** | Paso 4 del asistente al crear la campaña. Lo que escribas ahí llega al modelo en cada turno |
| **Decidir cuánto duele perder** | Paso 5 del asistente: quién puede morir y cuándo se guarda. Después, en `/rules` |
| **Ver lo que debes esta semana** | `/cuenta`, o la pestaña **Campaña** |
| Añadir un tipo de daño, una condición, una rareza | `/rules` → editas la sección → **Aplicar** → **Guardar reglas** |
| Que este tablero sea *sobre* algo | `/objetivos editar` — y **Proponer con IA** si quieres que te las escriba |
| Cambiar qué enemigos salen aquí, y cuántos | `/enemigos` |
| Pintar muros, cobertura, puertas | Botón **Terreno**, bajo el tablero |
| Probar un combate sin tocar tu campaña | `/sandbox` |

### Dónde se abre

Tres sitios, y ninguno pide teclear nada:

- **Al crear la campaña**: el taller termina con **Crear y jugar**. Para retocar el mundo después, *Editar la campaña* en la pausa (`Esc`), o `/campana`; cerrarlo te deja jugando.
- **Menú de pausa** → *Editar la campaña*, en cualquier momento.
- `/campana` en el chat, si prefieres escribirlo.

### `/campana`: el mundo repartido por categorías

Siete pestañas, y cada una escribe en el mismo sitio donde escribe un libro importado — así que una campaña hecha a mano se puede exportar y mandar igual que cualquier otra.

| Pestaña | Para qué |
| :--- | :--- |
| **Mundo** | Nombre, género y sinopsis. La sinopsis viaja con la campaña |
| **Localizaciones** | Sitios nuevos, con su tipo y su región; dentro, sus tableros con el tamaño, dónde empieza el grupo y qué enemigos hay puestos |
| **Personajes** | Dos listas: los de tu grupo y los del mundo. Clase, nivel, raza, las seis características, PG, CA, dónde está, pasado, personalidad, arcano, cara y los alias por los que el chat lo menciona |
| **Bestiario** | PG, CA, desafío, alcance y **perfil táctico**. Si borras un bicho que un tablero coloca, te lo dice antes |
| **Facciones** | Metas y reputación — que de momento **no cambia nada**, y el panel lo dice |
| **Objetos** | El catálogo de tu mundo. Lo que escribas aquí **cae de verdad** al ganar un combate, con la rareza decidiendo la facilidad |
| **Misiones** | Nombre, acto y en qué tablero se juega. Sus objetivos siguen en `/objetivos editar` |

Tres cosas que conviene saber:

- **Una localidad puede no tener ningún tablero.** Una aldea donde solo se habla y se comercia es tan válida como una cripta, y el panel lo dice en vez de dejarte pensando que falta algo.
- **Reclutar** está en la ficha de cualquiera del mundo: lo mete en tu grupo con la ficha que le hayas escrito, y aparece en la tira del grupo sin recargar nada.
- **Guardar no le vacía la mochila a nadie.** Lo que se escribe encima es la ficha —nombre, clase, características, cara—; la vida, el oro, la experiencia y lo que lleva encima son de la partida y se quedan como estaban.

Dos cosas que conviene saber de `/rules`:

- Las reglas son **de la campaña**, no del programa: cada campaña puede jugar con las suyas.
- Si **quitas** algo que ya se usa —un tipo de daño que lleva una espada— te lo dice antes de guardar, con quién lo usa. No te lo impide; es tu campaña. Pero lo decides con la factura delante.

---

## 7. Cuando algo no cuadra

| Síntoma | Qué mirar |
| :--- | :--- |
| «La narración dijo algo que no es» | `/contradicciones` — lo anotado, agrupado por tipo |
| «Esto me está costando caro» | `/prompt` — qué ocupa cada bloque del turno y cuánto llevas |
| «Cambié algo y no sé si mejoró» | `/semilla <palabra>` y repite la escena: los dados salen iguales |
| «El modelo se inventa tiradas» | `/rollguard` — está puesto por defecto y solo corrige lo imposible |

De `/contradicciones` conviene entender qué es y qué no. **No corrige nada.** Una narración que contradice el estado es un problema de *prompt*, y eso lo arregla un prompt mejor, no reescribir por detrás lo que escribió el modelo. Lo que te da son datos: una contradicción es un accidente, veinte del mismo tipo son una línea que le falta a tu prompt.

---

## 7b. El desgaste: por qué querrías jugar mañana

Tener a esta gente viva cuesta dinero, y el reloj corre solo.

| Cada | Qué pasa |
| :--- | :--- |
| **Día** | Todos comen. Y las heridas curan un poco — las que curan |
| **Semana** | Sueldos, posada y tasas. **Todo del mismo bolsillo**: reparar la cota compite con la cena y con pagarle a Brand |
| **Al caer a 0** | Si fallas la tercera salvación, ya no te quedas tirado para siempre: pasa lo que diga tu campaña |

**Quién muere, quién queda marcado.** Se elige al crear la campaña, en el paso 5, y sale del motivo por el que alguien te sigue: quien viene **por la paga** muere y hay que contratar a otro; quien viene **por un vínculo** se levanta a 1 PG con algo encima — un tobillo torcido, una pierna rota, un ojo perdido. Las cuatro peores **no curan nunca**.

Y no son etiquetas: una pierna rota es **−10 pies de movimiento**, y el tablero lo nota en cada paso.

> **Ojo con los puntos de retorno.** Si eliges *«solo se guarda en el refugio»*, `/punto` deja de funcionar dentro de una misión — y es lo que le da peso a todo lo anterior. Con guardado libre siempre puedes volver atrás, y entonces una cicatriz es una anécdota.

`/cuenta` te dice lo que debes **antes** de que venza. Una factura que te sorprende es un impuesto; una que ves venir es una decisión.

## 7c. Los modos: cuánto quieres que pese

Todo lo de 7b se puede apagar. El modo se elige al empezar (en la pestaña *Jugabilidad* del taller) y se cambia con `/modo` cuando quieras. Son seis piezas, cada una con su letra:

| Letra | Qué enciende |
| :---: | :--- |
| **a** · Heridas | Quien cae se levanta con una herida que tarda días en curar |
| **b** · La cuenta | Cada semana se paga comida, sueldos y posada; quien no cobra acaba yéndose |
| **c** · El mundo se mueve | Las facciones avanzan, los rivales se llevan encargos, la gente se muda y a veces hay un caso |
| **d** · El cuerpo | Hambre, sed y sueño |
| **e** · De hierro | Puede morir cualquiera, también los tuyos, y solo se guarda en el refugio |
| **f** · La intemperie | El frío y el calor pesan, y dormir al raso se paga. Pide la **d** |

| Modo | Letras | Para qué |
| :--- | :---: | :--- |
| **Relajado** | a b c | La historia: nadie de los tuyos muere, nada te mata de hambre ni de frío, guardas cuando quieres. Trae la red de seguridad puesta |
| **Normal** | a b c d f | Lo de siempre: el cuerpo y el camino pesan, muere quien va por dinero, guardas cuando quieres |
| **Supervivencia** | a b c d e f | Todo: cada decisión pesa, puede morir cualquiera y solo se guarda en el refugio |
| **A tu medida** | las que marques | Cualquier mezcla |

Lo apagado **no sale**: sin la cuenta, `/cuenta` dice que no hay y la mesa no la enseña. Cada cambio de modo queda en la crónica, y una partida que acaba entera en *de hierro* lo lleva escrito en el salón de la fama.

---

## 7d. Lo alto y las salidas

- **`^` en alto** (una torre, unos escalones, la empalizada): subir cuesta el doble, y desde arriba se ataca **con ventaja**. Vale para los dos bandos: el arquero enemigo también sube si puede.
- **`x` una salida** (la ventana, la trampilla): al pisarla sale un aviso con el botón «Salir por aquí» (o `/salir`). Quien sale ya no pelea. Cuando habéis salido todos los que seguís en pie, la pelea acaba en huida: sin botín y sin ganar el tablero, pero sin los golpes de la retirada de siempre. Si el objetivo del tablero era llegar a esa casilla, pisarla es ganar.

- **`P` una palanca**: estando al lado, se pulsa y se abren las puertas con llave del tablero. En combate gasta la acción.
- **`=` una barricada**: corta el paso pero no la vista, y cubre a quien está detrás. Se pulsa para golpearla: en combate, con el daño de tu arma (15 de vida); fuera, se rompe de una vez.
- **La tregua**: si el bando enemigo pierde a su líder y a la mitad, los que quedan pueden pedirla. «Dejarles ir» gana el tablero sin su botín; «Sin cuartel», se sigue (`/tregua sí|no`). A los tuyos les parecerá lo que les parezca.
- **La mascota y la gente**: al llegar a un sitio, quien tiene oficio allí reacciona a tu mascota la primera vez (al posadero no suelen gustarle los perros; al herrero, sí). Una línea y un paso de actitud, que se nota en precios y tratos.
- **Los precios cambian**: en invierno la comida y el abrigo suben; en otoño hay cosecha. Y donde quien manda persigue la magia, los componentes no se venden: toca comprarlos en otra parte.

¿Perdido? **«Cómo se juega»** en la pausa, o `/ayuda`, lo explica todo con tu modo de esta partida.

## 8. Lo que todavía **no** hace

Para que nadie lo descubra a mitad de una sesión:

- **La magia es la del grimorio, no las ranuras de 5e.** 25 conjuros en siete escuelas, con cargas por círculo (tres de 1º, dos de 2º, una de 3º, que vuelven con el descanso largo), áreas, componentes que se gastan, pergaminos y varitas. No hay ranuras de nivel 1 a 9, conjuros preparados ni concentración. **Solo existe la magia del código**: un conjuro escrito en los datos se rechaza. Los enemigos lanzan solo si sus datos lo dicen (hoy, el cultista y la plantilla *sagrado*).
- **Domar solo funciona con los bichos que lo dicen.** Lo decide el campo `domable` del bestiario (y del paquete o el guion): de serie, el lobo se queda en perro y el cuervo en cuervo. Un bicho sin el campo se decide por su nombre (lobos, cuervos, zorros, halcones y gatos). Para que otro se pueda domar, se le pone `domable` en su fila, sin tocar código.
- **Subir de nivel no da subclases ni dotes.** Sí da puntos de golpe, dados de golpe y mejora de característica cada cuatro niveles; el arquetipo de nivel 3 y las dotes, no.
- **El sonido no trae ni una pista.** Las pones tú en `/sonido`: aquí no hay música con licencia de nadie.
- **Las reglas de encuentro no colocan a nadie por su cuenta** salvo en los tableros importados, que traen sus posiciones dibujadas. En los demás, `/fight` los pone en una casilla libre.
- **La generación con IA no escribe misiones al crear el mundo.** Se piden aparte, con `/objetivos editar` → *Proponer con IA*.
- **«Mixto» todavía no llama al modelo por su cuenta** en los momentos que importan (una muerte, el cambio de acto): hoy solo contesta lo que escribes. Y no hay tope de gasto por sesión. Es lo que queda de la Z6 (I2 e I4 de [[LO_QUE_FALTA]]), y espera a que llegue la IA (J17 de [[ROADMAP_SIN_CONEXION]]).
- **Los sucesos no salen aún con el reloj de las facciones ni con la reputación**, solo al viajar, llegar, dormir y cambiar de semana. Y el Gem todavía no sabe escribir los suyos (bloque `suceso:`).
- **En `/campana` no se elige la casilla concreta de un personaje del mundo**, solo en qué localidad está; quien entra al grupo empieza donde empieza el grupo. Y un objeto solo se le puede dar a alguien de tu grupo: un PNJ todavía no tiene mochila que mirar.

---

## Si algo se rompe

El juego entero se puede recorrer en un navegador de verdad, con su propio servidor y sus propios datos, sin tocar los tuyos:

```bash
node tools/e2e-todo.mjs --rapido       # tests, empezar en 1387 y una partida sin modelo, a la vez: unos 4 minutos
node tools/e2e-todo.mjs                # lo mismo y además la vuelta entera en dos mitades a la vez: unos 15 minutos
node tools/e2e-campaign.mjs --headed   # la vuelta entera sola, para verla pasar (unos 30 minutos)
```

Cada prueba levanta su propio servidor en su puerto, así que corren a la vez sin pisarse. Al final se dice qué falló y dónde está el registro de cada una.

Si eso pasa y lo tuyo no, la diferencia está en tus datos o en tu configuración, no en el código. Y si falla, el paso donde falla te dice dónde mirar.

---

## Enlaces

- [[POR_HACER]] — lo pendiente, y una lista de comprobación manual de cinco minutos.
- [[ROADMAP_SIN_CONEXION]] — el plan de ahora: el gremio, las campañas y lo que viene.
- [[LO_QUE_FALTA]] — lo que le falta al juego fuera de ese plan.
- [[ROADMAP]] (archivo) — el acta de las fases A–H: qué se construyó primero y por qué.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] — el contrato entre tu Gem y el motor, en detalle.
- [[PROPUESTA_FRONTEND_MODO_JUEGO]] — cómo están hechas las tres pantallas.
