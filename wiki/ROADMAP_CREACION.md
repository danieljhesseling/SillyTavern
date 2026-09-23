# Roadmap · El taller de campañas

> Un solo sitio para hacer un mundo, en trece pasos, con tres formas de empezarlo.

Hoy hay **dos pantallas que hacen lo mismo a medias**: el asistente de *Nueva campaña* (cuatro
secciones, te deja jugar en tres minutos) y el editor de `/campana` (siete pestañas, te deja
cambiarlo todo después). Lo que se escribe en una no se ve en la otra, y hay cosas que están
en las dos con nombres distintos.

Esto las funde en **un componente**: los mismos pasos, abiertos de dos maneras —*creando*, que
los recorre en orden, y *editando*, que salta al que quieras—.

---

## La puerta: tres caminos

Al pulsar **Nueva campaña**, antes que nada, tres tarjetas grandes:

| | Para quién | Qué ve en el paso 1 |
| :--- | :--- | :--- |
| **Crea tu mundo desde cero** | Quien quiere escribirlo él | La ficha del mundo **vacía**, con su semilla |
| **Mundos precreados** | Quien quiere jugar ya | Los cuatro mundos en tarjetas; al elegir uno, la ficha **ya rellenada** |
| **Importa un libro** | Quien trae un JSON del Gem | Un cuadro para pegarlo, se comprueba, y la ficha **con lo que traía** |

Los tres caminos entran **al mismo sitio**. Lo único que cambia es con qué llega el paso 1, y
cuántas tarjetas vienen ya marcadas en los pasos siguientes:

- **(a) desde cero** — ninguna tarjeta marcada. Eliges tú lo que entra.
- **(b) precreado** — el mundo trae marcadas las suyas en cada paso. Puedes quitar y añadir.
- **(c) importado** — las tarjetas del JSON ya están, y marcadas.

Esa es toda la diferencia. **Un camino, tres puntos de partida.**

---

## El componente: un paso, trece configuraciones

Trece pantallas distintas serían trece sitios donde arreglar el mismo fallo. Todos los pasos
son **la misma cosa**:

```
┌──────────────────────────────────────────────┐
│  Paso N · Título              [ 3 de 13 ]    │
│  Una frase que dice para qué sirve esto.     │
├──────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│  │  +  │ │ ▓▓▓ │ │     │ │ ▓▓▓ │  ← tarjetas │
│  │Nuevo│ │Elegida│ │    │ │Elegida│           │
│  └─────┘ └─────┘ └─────┘ └─────┘             │
├──────────────────────────────────────────────┤
│  (al pulsar una) el formulario de esa cosa   │
└──────────────────────────────────────────────┘
      [ Atrás ]   [ Saltar ]   [ Siguiente ]
```

- **La tarjeta del `+`** siempre la primera: abre el formulario vacío.
- **Las demás** se pulsan para editarlas, y se marcan para meterlas en el mundo. Lo marcado va
  con **fondo ámbar**, que es lo único que hay que mirar para saber qué entra.
- **Saltar** existe en todos menos el 1. Un mundo sin bestiario se juega; uno a medio hacer que
  no te deja salir, no.
- **El lapicito** ✏️ aparece en todo campo de texto largo donde una frase escrita por el modelo
  tenga sentido: sinopsis, descripción de una localidad, motivo de una facción, historia de un
  personaje. Nunca en un número ni en un desplegable.

Esto es lo que hay que construir **una vez**: `ui/taller/paso.js`. Los trece pasos son datos.

---

## Los trece pasos

| # | Paso | De dónde salen sus tarjetas | Qué lo lee hoy |
| ---: | :--- | :--- | :--- |
| 1 | **El mundo** | La ficha: nombre, género, sinopsis, semilla | `buildWorldMetadata`, `ensureSeed` |
| 2 | **Quién lo cuenta** | Narradores predefinidos, con foto | `campaign/narrator.js` |
| 3 | **Localidades** | `sitios.json` + las que escribas | `world/travel.js`, el mapa |
| 4 | **Tableros** | Un acordeón por localidad del paso 3 | `world-builder/dungeon-generator.js` |
| 5 | **Habilidades** | `habilidades.json` (25) | `rules/abilities.js` |
| 6 | **Razas** | ⚠️ **no hay batería todavía** | Solo un campo de texto en la ficha |
| 7 | **Clases** | Salen de `when.class` en habilidades (8) | `compendio/skills.js` |
| 8 | **Objetos** | `armas` (30) · `armaduras` (16) · `trastos` (18) × `materiales` (16) | `rules/equipment.js`, el combate |
| 9 | **Facciones** | `facciones.json` (29 moldes y metas) | `campaign/factions.js` — relojes, rutas, economía |
| 10 | **Bestiario** | `bestiario.json` (35) | `compendio/bestiary.js`, `/fight` |
| 11 | **Personajes** | `personas.json` (76) | La ficha, el Lorebook, los vínculos |
| 12 | **Misiones** | Las cuatro que el mundo trae escritas + los mandos del tablón | `contracts.js`, `compendio/quests.js` |
| 13 | **Jugabilidad** | Interruptores, no tarjetas | `rules/mortality.js`, `needs.js`, `upkeep.js` |

**Por qué Personajes va el penúltimo y Misiones el último.** Un personaje se rellena con cosas
de los pasos de arriba: su clase, sus habilidades, su facción, dónde vive. Y una misión nombra
*a alguien, algo o un sitio* — `writeQuest` ya reparte por `persona · bestia · cosa · sitio ·
idea`—, así que necesita que todo lo demás exista. Ese orden no es estético: es el orden en el
que unas cosas pueden rellenar a las otras.

### El paso 12 no es escribir misiones

Elegir a mano «escoltar una llave de A a B» en un asistente es papeleo: nadie quiere rellenar
un tablón antes de jugar, y un tablón que se rellena una vez se acaba. **Las misiones las hace
el motor mientras juegas**, y eso ya funciona:

- `misiones.json` no son misiones escritas: son las **piezas** —verbo × objeto × giro ×
  recompensa— con las que se componen. 57 filas dan unas 36.000 combinaciones.
- El tablón **se rellena solo**: lo que vence deja hueco y el hueco se llena
  (`refreshContractBoard`). Un tablón que no vence deja de apretar; uno que se vacía deja de
  tirar de ti.
- Y **uno de cada tres** sale de lo que una facción quiere *esta semana*, con su bando y su
  plazo corto (F2). Ésas no se pueden escribir por adelantado porque dependen de cómo vaya el
  mundo.

Así que el paso 12 tiene tres cosas, y ninguna es un formulario largo:

| | Qué |
| :--- | :--- |
| **Las que el mundo trae** | Un puñado escritas a mano —las de la historia, las que dan el tono—, que son las que un mundo precreado o un JSON ya traen. Tarjetas, como todo lo demás |
| **Los mandos del tablón** | Cuántos encargos caben, de qué temática tira el gremio, cada cuánto vencen, y **cuánto pesa lo de las facciones** frente a lo suelto |
| **La mezcla** | Si las escritas salen todas al empezar o van apareciendo entre las generadas, que es lo que pediste: mezcladas, no una tanda y luego otra |

**Paso 13, lo que ya decides hoy más lo que pediste:** morir de verdad · guardar solo en el
refugio · hambre, sed, frío y calor · heridas que quedan · llevar a uno o al grupo entero · que
los compañeros se vayan según lo que hagas · y **estado de ánimo** —misiones donde muere gente,
decisiones malas, encargos lejos de lo que ellos creen—. Los tres primeros ya tienen motor
(`needs.js`, `injuries.js`, `guild.js` con su lealtad); el ánimo es sistema nuevo.

---

## Las semillas en este flujo

Hoy la regla es: **la semilla no es el texto**, se tira al crear y se guarda con la campaña. Eso
no cambia. Lo que cambia es *qué le queda por decidir*, porque ahora eliges mucho a mano.

La regla que propongo, y que hace que todo lo demás se entienda:

> **La semilla es el dado de lo que no has elegido.**

Y de ahí sale una consecuencia que hay que respetar en el código:

> **Lo que tocas se queda; lo que no, se vuelve a tirar.**

Una tarjeta que has abierto y editado queda **fijada** y la semilla ya no la toca. Todo lo demás
—los vecinos que rodean tu localidad, qué facción sale de cada molde, el clima del camino, el
botín, los sucesos— se vuelve a generar si cambias la semilla. Así el botón de **volver a tirar**
es seguro: no puede borrarte nada escrito.

Y por camino:

| Camino | Qué hace la semilla |
| :--- | :--- |
| **(a) desde cero** | Se tira una y se enseña en el paso 1. Rellena todo lo que no escribas |
| **(b) precreado** | **La que trae el mundo.** Si el mundo A es ese mundo, que se quede ese: dos personas que jueguen «el de Lovecraft» ven lo mismo y pueden hablar de ello. El campo sigue editable, y cambiarla es pedir *otra versión* del mismo mundo |
| **(c) importado** | Si el paquete trae semilla, **se respeta** (importar tiene que ser reproducible). Si no, se tira |

En los tres, el campo sigue siendo **editable**: escribir la de otro sigue siendo la forma de
jugar su mundo exacto, que es lo que ya dice la pantalla de `/campana`.

**Lo que eso implica, dicho claro:** un mundo precreado es *contenido + semilla*, así que dos
partidas suyas empiezan iguales. Es a propósito —es lo que permite que «el de Lovecraft» sea un
sitio del que dos personas hablan—, y el botón de **volver a tirar** está ahí para quien quiera
otra versión. El único cuidado: la semilla del mundo hay que escribirla en su archivo, porque si
se deja vacía cada partida saldrá distinta y dejará de ser *ese* mundo.

---

## Los cuatro mundos

Van en `public/mundos/*.json`, **como datos, no como código**, para que el quinto sea escribir un
archivo. Cada uno es una *selección* sobre las baterías más sus filas propias:

| Mundo | De qué va | Lo que lo hace distinto de verdad |
| :--- | :--- | :--- |
| **La costa que no duerme** | Terror, Lovecraft | Sin razas fantásticas. Cordura en vez de moral. El bestiario no se puede matar a espadazos |
| **Las tierras del ocaso** | Fantasía épica | Razas clásicas, facciones grandes con relojes lentos, viajes largos |
| **El mundo tras la pantalla** | Isekai, romance | Niveles y números a la vista, vínculos que pesan más que el combate |
| **1387** | Histórico realista | Sin magia. Heridas que no se curan solas. La cuenta del viernes aprieta de verdad |

Lo que cada uno declara: qué filas de cada batería entran, qué reglas de jugabilidad trae puestas,
sus narradores, y sus propias filas nuevas (bichos, sitios, facciones que solo existen ahí).

---

## Lo que hay que arreglar antes de empezar

Dos cosas que ya están rotas y que el taller haría más visibles:

### 1. Dos listas llamadas «facciones»

La pestaña del editor guarda entradas del Lorebook con una `reputación` que —lo dice su propio
texto— *no cambia ninguna regla*. El sistema que corre vive en `metadata.factions`, con metas,
relojes, rutas y la cuenta del viernes. **Editar una no toca la otra.** El paso 9 edita la de
verdad, y la vieja se migra: el nombre y los objetivos escritos pasan a ser el `note` y la meta
de la facción real.

**Y la reputación se queda, pero leyéndose** (F4). Lo que ya existe y puede leerla mañana, de
más barato a más caro:

| Lo que la lee | Qué cambia |
| :--- | :--- |
| `economy.js` | Quien manda donde estás te cobra menos si le caes bien, y más si no. El impuesto ya sale de ahí |
| `contracts.js` | Una facción con la que estás bien te ofrece **su** encargo antes, y de mejor rango |
| `travel.js` | Sus caminos cerrados se te abren, o su peaje te sale gratis |
| El narrador | Quién te habla al llegar a un sitio suyo, y en qué tono |

Y sube o baja sola: entregar un encargo **a favor** de alguien sube su reputación y baja la de
su enemigo. Eso ya está medio hecho —`settleFactionStake` sabe de qué lado te pusiste—, así que
F4 es poco código encima de F2.

### 2. Razas y clases no tienen batería

Las clases se deducen hoy de `when.class` en `habilidades.json`; las razas son un campo de texto
libre. **Y las dos tocan las características**: una raza da +2 a algo y −1 a otra cosa, una clase
decide el dado de golpe y en qué se te da bien tirar. Eso no hay que inventarlo — es la misma
forma que ya usan los objetos, `effects: [{ stat, modifier }]` sobre `MODIFIABLE_STATS`, así que
las dos baterías se leen con el mecanismo que ya existe. Hacen falta **B13 razas** y **B14 clases**, y van **comunes con un `when` por mundo**:
una sola lista, y cada mundo dice cuáles trae preseleccionadas. El de Lovecraft marca «humano» y
poco más; si quieres meter elfos, los metes — están ahí, solo que no marcados. Es menos escribir
que una lista por mundo, y es el mismo mecanismo de `when` que ya usan las otras doce.

---

## Orden de construcción

Cada bloque deja el juego **jugable**, y el asistente de hoy sigue funcionando hasta el final.

| | Qué | Por qué primero |
| :--- | :--- | :--- |
| **T1** | La puerta de tres caminos + el componente `paso.js` + pasos 1 y 2 | Es lo que se ve en la primera pantalla, y prueba el contrato de tarjetas con lo más pequeño |
| **T2** | Pasos 3, 4 y 13 (localidades, tableros, jugabilidad) | Con esos tres ya se crea una campaña entera: sustituye al asistente viejo |
| **T3** | Reconciliar las dos facciones + **F4 reputación** + pasos 8, 9, 10 | Lo que ya tiene motor detrás y hoy no se puede tocar bien. F4 es poco código encima de F2 |
| **T4** | B13 razas y B14 clases + pasos 5, 6, 7 | Necesitan datos nuevos antes que pantalla |
| **T5** | Pasos 11 y 12 (personajes y misiones) | Los que se rellenan con todo lo anterior |
| **T6** | Los cuatro mundos, ya con todos los pasos que rellenar | Un mundo precreado solo puede marcar tarjetas que existan |
| **T7** | Retirar el asistente viejo y `/campana` viejo | Solo cuando el nuevo haga todo lo que hacían |

---

## Decidido

1. **La semilla de un mundo precreado es la suya**, escrita en su archivo, y se puede cambiar.
2. **La reputación pasa a significar algo** (F4): precios, qué encargos te ofrecen, qué caminos
   te abren y quién te habla.
3. **Razas y clases, baterías comunes** con un `when` por mundo: cada mundo preselecciona las
   suyas y el resto siguen estando para quien las quiera.
4. **Las misiones las hace el motor mientras juegas.** El paso 12 son las cuatro escritas a mano
   que dan el tono, los mandos del tablón, y cómo se mezclan con las generadas.
