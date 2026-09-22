# 🎲 Empezar una campaña

*De no tener nada a estar jugando, en unos minutos. Esta guía es para sentarse a jugar; si lo que buscas es el estado del proyecto, eso está en [[ROADMAP]], y lo pendiente en [[POR_HACER]].*

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

## 2. Crear la campaña

En la pantalla de bienvenida, **Nueva campaña**. Hay tres caminos y ninguno es mejor que otro; son para tres situaciones distintas.

### a) Una plantilla — *para jugar ya*

*Mazmorra clásica*, *Bosque*, *Taberna* o *Lienzo en blanco*. Escribes un nombre, pones quién va (un nombre por línea) y creas. Acabas **en el tablero, con el grupo colocado**, sin más pasos.

Es el camino corto y el que conviene la primera vez: te deja algo jugable en treinta segundos y todo lo demás se puede cambiar después.

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
| `2` | **Exploración** — el mapa con el panel de viaje | Al salir de un tablero |
| `3` | **Combate** — el tablero grande, el rastreador, el registro y la barra de acciones | Al empezar un combate, o al entrar en un tablero |
| `Esc` | **Pausa** | Cuando tú quieras |

El director escucha **al motor**, no al narrador: si el modelo escribe *«todos a la iniciativa»* pero no hay encuentro, la pantalla no se mueve.

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
| Bajo el chat | Las fichas de acción | Abrir la puerta de tal casilla, hablar con alguien, descansar, entrar en un tablero, viajar |
| Una cara del grupo | Clic | Su ficha: vínculo, *Pasar tiempo* (gasta un bloque del día) y *Regalar* |

Dos avisos que salen solos: el cartel de **¡INICIATIVA!** cuando algo despierta, y el botón de **Relevo** sobre los compañeros válidos cuando derrotas a alguien y te sobra movimiento.

Si el tablero tiene enemigos dibujados y nadie pelea, aparece **Iniciar combate** al lado: empieza el encuentro con esos enemigos, en sus casillas.

Las fichas de acción de *hablar* **no envían nada**: dejan la frase empezada en el chat para que la termines tú.

**Lo que un combate retiene mientras dura.** No desaparece: se queda a la vista, apagado y diciendo por qué.

| Retenido | Por qué |
| :--- | :--- |
| Viajar, salir del tablero, el mapa del mundo, la pestaña *Exploración* — y también `/go`, `/enter` y `/leave` | Irse sin decidirlo dejaba el encuentro vivo sobre un tablero que ya no estabas mirando |
| El botón **Terreno** | Mover un muro a mitad de un turno cambia quién ve a quién, por dónde se pasa y cuánto cuesta llegar |

**Abandonar** nunca se retiene: salir de una pelea es una decisión tuya y tiene su propio botón. El **diálogo** y el **tablero** siguen abiertos, porque se narra y se mira mientras se pelea.

### Lanzar algo

Las habilidades de tu campaña se escriben en **`/habilidades`**: un panel con un campo por cosa — qué cuesta, cuántas veces, a quién alcanza y qué hace — y, al lado, **quién se sabe cada una**. Vienen cinco de serie para que se vea cómo se escriben las demás.

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
| `/habilidades` | Escribe conjuros y técnicas, y reparte quién se sabe cada uno |

**Moverse por el mundo**

| Comando | Qué hace |
| :--- | :--- |
| `/go <sitio>` | Viajar a una localización |
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

- **Al crear la campaña**: el asistente termina con dos botones — **Crear y jugar** y **Crear y escribir el mundo**. El segundo te deja en la partida *con el editor delante*; cerrarlo te deja jugando.
- **Menú de pausa** → *Editar la campaña*, en cualquier momento.
- `/campana` en el chat, si prefieres escribirlo.

### `/campana`: el mundo repartido por categorías

Siete pestañas, y cada una escribe en el mismo sitio donde escribe un libro importado — así que una campaña hecha a mano se puede exportar y mandar igual que cualquier otra.

| Pestaña | Para qué |
| :--- | :--- |
| **Mundo** | Nombre, género y sinopsis. La sinopsis viaja con la campaña |
| **Localidades** | Sitios nuevos, con su tipo y su región; dentro, sus tableros con el tamaño, dónde empieza el grupo y qué enemigos hay puestos |
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

---

## 8. Lo que todavía **no** hace

Para que nadie lo descubra a mitad de una sesión:

- **La magia es la capa ligera, no las ranuras de 5e.** Hay conjuros, técnicas y recursos de clase, con sus usos y sus tiradas; no hay ranuras de nivel 1 a 9, conjuros preparados, concentración ni áreas de efecto. **Los enemigos todavía no lanzan nada.**
- **Subir de nivel no da subclases ni dotes.** Sí da puntos de golpe, dados de golpe y mejora de característica cada cuatro niveles; el arquetipo de nivel 3 y las dotes, no.
- **El sonido no trae ni una pista.** Las pones tú en `/sonido`: aquí no hay música con licencia de nadie.
- **Las reglas de encuentro no colocan a nadie por su cuenta** salvo en los tableros importados, que traen sus posiciones dibujadas. En los demás, `/fight` los pone en una casilla libre.
- **La generación con IA no escribe misiones al crear el mundo.** Se piden aparte, con `/objetivos editar` → *Proponer con IA*.
- **En `/campana` no se elige la casilla concreta de un personaje del mundo**, solo en qué localidad está; quien entra al grupo empieza donde empieza el grupo. Y un objeto solo se le puede dar a alguien de tu grupo: un PNJ todavía no tiene mochila que mirar.

---

## Si algo se rompe

El juego entero se puede recorrer en un navegador de verdad, con su propio servidor y sus propios datos, sin tocar los tuyos:

```bash
node tools/e2e-campaign.mjs            # unas 200 comprobaciones
node tools/e2e-campaign.mjs --headed   # para verlo pasar
```

Si eso pasa y lo tuyo no, la diferencia está en tus datos o en tu configuración, no en el código. Y si falla, el paso donde falla te dice dónde mirar.

---

## Enlaces

- [[POR_HACER]] — lo pendiente, y una lista de comprobación manual de cinco minutos.
- [[ROADMAP]] — qué hay construido, qué está conectado y qué se puede tocar desde la interfaz.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] — el contrato entre tu Gem y el motor, en detalle.
- [[PROPUESTA_FRONTEND_MODO_JUEGO]] — cómo están hechas las tres pantallas.
