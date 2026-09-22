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

1. En el chat, `/esquema-campana`. Se abre el contrato: el esquema, las reglas que un esquema no puede expresar y un ejemplo de salida correcta.
2. **Copia las instrucciones** y pégaselas a tu Gem de Gemini (o al modelo que uses para esto, fuera del juego, con tu propia suscripción).
3. Dale el libro de campaña y pídele el paquete, sección por sección si es largo.
4. Vuelve aquí: **Nueva campaña → Importar un libro**, pega el JSON y pulsa **Comprobar**.

El informe sale **antes de crear nada** y dice tres cosas por separado:

- **Lo que impide importar**: una misión que apunta a un tablero que no existe, un enemigo colocado que no está en el bestiario, dos compañeros con el mismo nombre, un mapa cuyas filas no miden lo mismo, el grupo empezando dentro de una pared.
- **Avisos**: cosas raras que se pueden jugar igual, como un tablero al que ninguna misión te lleva.
- **Lo reparado**: lo que se arregló al leerlo, listado y nunca en silencio.

Si pasa, créala y ya estás dentro.

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

---

## 5. Los comandos, por para qué sirven

Todo esto se puede seguir escribiendo, y el recorrido de pruebas entra por aquí. Si un botón y su comando hacen cosas distintas, eso es un fallo.

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
| Añadir un tipo de daño, una condición, una rareza | `/rules` → editas la sección → **Aplicar** → **Guardar reglas** |
| Que este tablero sea *sobre* algo | `/objetivos editar` — y **Proponer con IA** si quieres que te las escriba |
| Cambiar qué enemigos salen aquí, y cuántos | `/enemigos` |
| Pintar muros, cobertura, puertas | Botón **Terreno**, bajo el tablero |
| Probar un combate sin tocar tu campaña | `/sandbox` |

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

## 8. Lo que todavía **no** hace

Para que nadie lo descubra a mitad de una sesión:

- **La magia no está implementada.** Una clase puede decir que lanza conjuros, pero no hay lista de hechizos, ni espacios, ni forma de lanzarlos. Los conjuros son narración.
- **Subir de nivel sube el número y poco más.** El botón de la ficha gasta la experiencia y sube el nivel; **no sube los puntos de vida ni concede nada**. Lo que cambie de verdad, lo cambias tú a mano en la ficha.
- **Las reglas de encuentro no colocan a nadie por su cuenta** salvo en los tableros importados, que traen sus posiciones dibujadas. En los demás, `/fight` los pone en una casilla libre.
- **La generación con IA no escribe misiones al crear el mundo.** Se piden aparte, con `/objetivos editar` → *Proponer con IA*.

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
