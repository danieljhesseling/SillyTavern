# El compendio, batería a batería

Una biblioteca de contenido en disco —armas, habilidades, bichos, gente, nombres— de la
que tiran los generadores con la semilla. **Un archivo por dominio**, para poder llenar uno
y olvidarte del resto.

Cada batería es una tarde: se añade sola, no rompe nada si falta, y al terminarla **se ve
algo distinto jugando**. Ése es el criterio de que una batería está hecha.

---

## Dónde vamos

| | Qué | Filas | Lo que produce |
| :--- | :--- | ---: | :--- |
| ✅ | **El cargador** (`compendio/compendio.js`) | — | Valida diciendo archivo y fila, tolera lo que falta, sortea con tu semilla |
| ✅ | **La pantalla** (menú principal → *Compendio*) | — | Qué hay, qué falta y qué sale si lo pides |
| ✅ | **B1 nombres** | 7 | ~6.700 nombres de persona, 572 sitios, 288 tabernas |
| ✅ | **B2 materiales** + propiedades | 58 | 240 objetos (forma × material) y 18 propiedades que suman y quitan |
| ✅ | **B5 habilidades** | 25 | 8 clases que saben algo distinto desde el nivel 1 |
| ✅ | **B6 bestiario** | 35 | 2.420 bichos: arquetipo × plantillas |
| ✅ | **B7 personas** | 76 | 14.400 vecinos antes de contar rasgos y voz |
| ✅ | **B8 sitios** | 24 | 10 tipos × 8 salas × 6 estados |
| ✅ | **B9 misiones** | 57 | 36.000 encargos: verbo × objeto × giro × recompensa |
| ✅ | **B11 mundo** | 29 | 7 biomas, clima que se encadena, 15 sucesos de camino |
| ✅ | **B12 estados** | 39 | 33 heridas según la causa y 6 enfermedades con fases |
| ✅ | **B10 facciones** | 29 | 14 moldes × 15 metas, y un mundo que va a lo suyo |
| ⬜ | B3 armas · B4 armaduras y trastos | | La forja ya las haría; falta escribirlas |

**379 filas escritas.** Ésa es la cuenta que importa: lo que se escribe una vez y lo que sale de ello.

> **B10 se escribió la última, y con razón.** Hasta F1 una facción era un campo de texto libre que nadie leía. Primero el sistema —`campaign/factions.js`: metas, relojes y dónde aterrizan—, y con él ya escrito, la batería. Al revés habrían sido 29 filas que nadie mira.

> **Lo que la pantalla todavía no hace:** editar y quitar un libro entero. Las dos necesitan una ruta para escribir en el disco, y eso es código de servidor. Enseñar un campo editable que no guarda sería prometer algo que no pasa.

---

## Antes de la primera batería: lo que comparten todas

Esto sí hay que hacerlo una vez, y son dos archivos. Sin ello cada batería inventaría su
propia forma y acabarías con doce maneras de decir lo mismo.

### Dónde viven

```
public/compendio/armas.json
public/compendio/habilidades.json
public/compendio/...
```

`public/` se sirve en la raíz, así que el navegador los lee con `fetch('/compendio/armas.json')`
y **no hace falta tocar el servidor**. Es carpeta nueva, así que tampoco choca nunca con
SillyTavern al actualizar, igual que el resto de tu motor.

Los editas con el Bloc de notas, les pegas lo que escupa el Gem y los commiteas con el
resto. Son tuyos y viajan con tu fork.

### La forma de una fila

Todas las filas, de la batería que sean, llevan estos cinco campos:

```json
{
  "id": "espada-corta",
  "name": "Espada corta",
  "tags": ["hoja", "ligera", "militar"],
  "weight": 10,
  "when": { "rarity": "Common", "region": ["*"], "level": [1, 20] }
}
```

| Campo | Para qué |
| :--- | :--- |
| `id` | Único y en kebab-case. Es **como se referencian entre baterías**: una misión pide `espada-corta`, un bicho la lleva equipada |
| `name` | Lo que se ve |
| `tags` | Lo que permite cruzar dominios: «dame algo `militar` del `norte`» |
| `weight` | Peso base al sortear. **0 = nunca sale sola**, pero se puede pedir por `id` |
| `when` | Los filtros. Es lo que convierte una lista en un generador |

Y luego **los campos propios del dominio**, con los nombres que el motor ya usa —`rarity`,
`damageDice`, `armorClass`, `charClass`—, para que una fila se copie tal cual a la ficha sin
traducir nada por el camino. Los nombres de archivo van en español porque los abres tú; los
campos en inglés porque los lee el motor.

### El cargador (`game-engine/compendio/compendio.js`)

Un módulo, unas doscientas líneas, que usan las doce baterías:

```js
const c = await loadCompendio();                      // una vez, al arrancar
c.pick('armas', { where: { region: 'norte' }, random });  // una fila, por peso
c.take('armas', 3, { where, random });                    // tres sin repetir (bolsa)
c.byId('armas', 'espada-corta');                          // por referencia
```

Cuatro cosas que tiene que hacer, y ninguna es negociable:

1. **Validar al cargar y decirte dónde.** *«armas.json, fila 412: rareza "Comun" no existe,
   ¿querías "Common"?»* Éste es el trabajo de verdad: el dolor de un compendio no es que sea
   lento, es una errata que hace que no salga nada y no sepas por qué.
2. **Tolerar que falte un archivo.** Sin `armas.json`, el botín funciona como hoy. Eso es lo
   que hace que cada batería sea una tarde suelta y no un salto al vacío.
3. **Sortear por peso con tu semilla**, no con `Math.random`. Sacando sin reposición, que es
   lo que evita cinco espadas cortas seguidas (idea #196).
4. **Recordar lo último.** Una memoria corta por dominio con pesos a cero, para que no salga
   dos veces lo mismo (idea #198).

> **Regla de la casa:** el compendio es **aditivo**. Nada de lo que hay hoy deja de
> funcionar porque falte una batería. Si eso se rompe, se rompió el diseño.

---

## El puente: de un libro a las baterías

Pasas un libro de campañas por el Gem, te devuelve el paquete, y ese paquete **trae armas, bichos, gente y sitios**. Todo eso tiene que poder subir al compendio, o estarás escribiendo a mano lo que ya tienes escrito.

### Por qué no es copiar y pegar

Un paquete y el compendio describen las mismas cosas **con un propósito distinto**:

- El paquete dice *esta* daga, en *esta* sala, en manos de *ese* guardia. Es una partida.
- El compendio dice una daga que **podría** salir en cualquier sitio. Es material.

Así que subir una fila no es copiarla: es **generalizarla**. Se le quita dónde está y quién la lleva, se queda lo que es —`damageDice`, `rarity`, `tags`— y se le añaden los dos campos que el generador necesita, `weight` y `when`.

### Las seis reglas

1. **Generalizar, no copiar.** Fuera `mapPosition`, `locationName` y quién lo llevaba encima.
2. **Un `source` en cada fila** — `"source": "libro-la-cripta"`. Para filtrar, y sobre todo para poder **quitar de golpe** todo lo que entró de un libro que no te convenció.
3. **Sin duplicados, por `id`.** Tres libros traen tres «Espada corta»: la primera entra, las otras dos le suman `tags` y `source` y no crean fila nueva.
4. **Con revisión antes de escribir.** Una lista con casillas: *47 objetos, 12 bichos, 8 personas*. Desmarcas lo que sea demasiado de **ese** libro y solo entra el resto.
5. **Gratis y local.** Ni una llamada al modelo. El Gem ya hizo su trabajo al producir el paquete; subirlo al compendio es mapear campos, y eso lo hace el motor.
6. **No toca la campaña.** Subir copia **hacia** el compendio. La campaña que acabas de importar se queda exactamente igual.

### Qué se llena solo y qué no

El contrato del paquete tiene siete secciones —`world`, `locations`, `confidants`, `bestiary`, `items`, `boards`, `quests`— y encajan casi una a una:

| Batería | ¿La llena un libro? |
| :--- | :--- |
| **B3 armas**, **B4 armaduras y trastos** | **Sí.** Sección `items`, que ya trae `type` y `rarity` |
| **B6 bestiario** | **Sí.** Sección `bestiary`, con su perfil táctico |
| **B7 personas** | **Sí.** Sección `confidants`, con arcano y pasado |
| **B8 sitios** | **Sí.** `locations` + `boards`, con sus mapas |
| **B9 misiones** | **A medias.** `quests` da objetos y giros; los verbos los pones tú |
| B1 nombres, B2 materiales, B5 habilidades, B10 facciones, B11 mundo, B12 estados | **No.** Un libro no habla de eso |

> **Y esto cambia por dónde empezar.** Si vas a pasar libros por el Gem, cuatro baterías y media **se llenan solas**. Tu tiempo de escribir a mano vale más en las seis que ningún libro te va a dar: **nombres, materiales, habilidades, facciones, mundo y estados**. Escribe esas, e importa las otras.

---

## Las doce baterías

Cada una dice qué hay dentro, cuántas filas hacen falta de verdad, qué ideas de las 200
enciende y **qué vas a ver** cuando esté.

### B1 · `nombres.json` — *la primera, y por un motivo*

Sílabas y tablas por cultura: inicios, medios, finales, y listas de topónimos, tabernas y
apodos.

- **Campos propios:** `culture`, `kind` (persona/sitio/taberna/objeto), `parts`
- **Mínimo jugable:** 3 culturas × 20 sílabas. **Rico:** 6 culturas × 60
- **Enciende:** ideas #159–#170
- **Qué ves:** que los nombres de una región **suenan a esa región**. Y como se usa en todas
  partes, la primera batería prueba el cargador entero de punta a punta

### B2 · `materiales.json` — *la más barata, la que más rinde*

Materiales y formas, con su efecto. Alimenta los nombres compuestos y las propiedades de
objeto a la vez.

- **Campos propios:** `kind` (material/forma), `costMultiplier`, `weightMultiplier`,
  `effect` (plata contra no-muertos, hierro frío contra hadas)
- **Mínimo:** 15 materiales, 20 formas. **Rico:** 40 y 60
- **Enciende:** #109, #118, #120
- **Qué ves:** «Daga de hueso del Vado» en vez de «Daga #47», y la plata **haciendo algo**

### B3 · `armas.json`

- **Campos propios:** `damageDice`, `damageType`, `rangeFeet`, `hands`, `budget`, `rarity`
- **Mínimo:** 30. **Rico:** 150
- **Enciende:** #110, #111, #117, #119
- **Qué ves:** botín que no se repite y que **cuesta decidir** — porque cada arma suma algo y
  quita algo

### B4 · `armaduras.json` y `trastos.json`

Van juntas en la misma tarde porque comparten forma con B3.

- **Campos propios:** `armorClass`, `dexMode`, `slot`, `bulk`
- **Mínimo:** 15 y 40. **Rico:** 50 y 150
- **Enciende:** #100, #115, #119
- **Qué ves:** el inventario como un problema de espacio, no como una lista

### B5 · `habilidades.json` — *hecha*

- **Campos propios:** `cost`, `resource`, `target`, `resolution`, `level`, `rangeFeet`,
  `damage` / `healing`, `saveDc`, y `when.class`
- **Escritas:** 25 en 8 clases, más las que sabe cualquiera (`"class": ["*"]`)
- **Enciende:** #70, #79
- **Qué ves:** elegir «Pícara» ya no es una palabra en la cabecera: el héroe nace con lo
  suyo en la ficha, y el aviso te lo dice
- **Ojo:** aquí mandan **cuatro vocabularios cerrados**, no uno. Un valor inventado pasa la
  validación de toda fila y luego no hace lo que dice —`per_long_rest` degrada a `at_will`,
  y algo de una vez al día pasa a poder usarse cada turno—. Por eso `validateAbility` es
  aparte, y lo que caza sale en la pantalla del compendio, no en la consola
- **Y lo que se aprendió:** un campo que el motor escribe y la fila no trae sale impreso
  como `undefined`. Pasó dos veces: sin `rangeFeet` salía «undefined ft», y una `resolution:
  "save"` sin `saveDc` escribía «salvación CD undefined». Las dos son ahora reglas

### B6 · `bestiario.json` — *la que más cambia el juego*

Arquetipos con presupuesto de puntos, no fichas cerradas.

- **Campos propios:** `archetype` (tanque/matón/tirador/estorbo/bruto), `budget`, `profile`
  táctico, `weakness`, `quirk`, `biome`
- **Mínimo:** 20 arquetipos + 15 plantillas apilables. **Rico:** 60 + 40
- **Enciende:** #67–#82
- **Qué ves:** 20 × 15 son **trescientos bichos distintos** escribiendo treinta y cinco filas.
  Ahí es donde el compendio deja de ser una lista y se nota

### B7 · `personas.json`

Rasgos, deseos, miedos, oficios, secretos y muletillas de habla.

- **Campos propios:** `kind` (rasgo/deseo/miedo/oficio/secreto/voz), `arcana`, `conflictsWith`
- **Mínimo:** 60 filas repartidas. **Rico:** 250
- **Enciende:** #121–#134
- **Qué ves:** PNJ que **quieren algo**, y por eso hacen cosas cuando no estás

### B8 · `sitios.json`

Tipos de localidad, plantillas de sala, estados (saqueada, inundada, quemada, habitada).

- **Campos propios:** `locationType`, `roomTemplate` (mapa ASCII), `state`, `biome`
- **Mínimo:** 10 tipos + 20 salas. **Rico:** 30 + 80
- **Enciende:** #19, #20, #40, #41
- **Qué ves:** mazmorras con salas **reconocibles** en vez de rectángulos de un BSP

### B9 · `misiones.json`

La gramática: verbos, objetos, sitios, plazos y **giros**.

- **Campos propios:** `slot` (verbo/objeto/giro/recompensa), `needs` (qué tiene que existir en
  el mundo para que valga)
- **Mínimo:** 12 verbos, 20 objetos, 15 giros. **Rico:** el triple
- **Enciende:** #145–#158
- **Qué ves:** 12 × 20 × 15 son **3.600 misiones** con cuarenta y siete filas. Y el giro es lo
  que separa un recado de una misión

### B10 · `facciones.json` — *hecha*

Dos clases de fila, y ni un campo de más: **moldes** (`kind: "faccion"` — cómo se llaman,
a qué ritmo van, qué clase de metas persiguen) y **metas** (`kind: "meta"` — qué quieren y
por qué).

- **Campos propios:** `patterns` (con `{sitio}`), `goals`, `pace`, `of` · y en las metas,
  `goal` y `note`
- **Escritas:** 14 moldes y 15 metas, tres por cada finalidad
- **Enciende:** #135–#144
- **Qué ves:** que el mundo se mueva **aunque no estés**
- **Ojo:** `goal` es un vocabulario **cerrado** del motor —`encontrar`, `conquistar`,
  `recuperar`, `destruir`, `controlar`— y cada una aterriza en la lista de sitios: un
  camino que se abre, un paso que se cierra, un dueño que cambia, un peaje que suma un día.
  Una meta que al cumplirse no moviera nada de eso sería una barra y nada más, así que
  `validateFactionRows` no deja escribirla
- **Y una regla que parece de estilo y no lo es:** una plantilla de nombre sin `{sitio}`
  hace que todas las facciones de ese molde se llamen igual. También se caza

**El sistema que la lee** es `campaign/factions.js`, escrito *antes* que la batería:

| Lo que pasa | Dónde aterriza |
| :--- | :--- |
| `conquistar` / `recuperar` | El sitio cambia de dueño, y se cierran los caminos a casa de sus enemigos |
| `destruir` | La facción desaparece y lo que había cerrado se reabre |
| `encontrar` | Se abre un camino que no estaba: un atajo de un día |
| `controlar` | Ese camino cuesta un día más — peaje |

**Y lo que tú puedes hacer al respecto** (F2): parte del tablón de encargos sale de lo que
alguien quiere de verdad. Un encargo de facción se ve distinto —dice *en contra* o *a
favor*, y qué se juega el mundo si sale bien— y al entregarlo **mueve su reloj un segmento**.
Cogerlo es tomar partido: lo que frena a unos adelanta a otros, y el tablón ofrece las dos
caras. Sin eso, el mundo se movía y tú mirabas.

Y la gente de un sitio que es de alguien **lleva su bandera**: en la ficha, donde el editor
de personajes ya la leía, y en lo que el modelo lee, con lo que los suyos quieren. Es lo que
le da a un vecino un motivo que no es suyo sin escribírselo a mano.

Tres decisiones que valen más que el código:

1. **No hay azar en el reloj.** Un segmento cada `pace` días y ya. El azar es justo lo que
   hace que las guerras de Bannerlord se sientan ruido: no puedes planear contra ellas. La
   semilla decide **quiénes son y qué quieren**, no cuándo llegan.
2. **El reloj no avanza el día que el grupo está en el sitio que quieren.** Estar presente
   es la primera forma de frenarlos, no cuesta interfaz y da un motivo para viajar.
3. **Solo se cuenta lo que te alcanza.** El motor mueve a todas; el modelo narra lo que
   pasa donde estás o a un camino de aquí. Lo demás se sabrá al llegar — así es un mundo y
   no un menú de noticias.

### B11 · `mundo.json`

Biomas, climas con su matriz de Markov, estaciones, recursos por región, años buenos y malos.

- **Campos propios:** `biome`, `transitions`, `effect`, `exports`
- **Mínimo:** 6 biomas × 5 climas. **Rico:** 12 × 8
- **Enciende:** #57–#66, #53
- **Qué ves:** que el tiempo **cambie decisiones**, no que decore el texto

### B12 · `estados.json`

Heridas por causa, enfermedades con curso, condiciones.

- **Campos propios:** `cause`, `stages`, `modifiers`, `healDays`, `permanent`
- **Mínimo:** 20. **Rico:** 60
- **Enciende:** #182–#188
- **Qué ves:** que una caída y un incendio **dejen marcas distintas**

---

## La pantalla: `Compendio` en el menú principal

No es una batería —no trae contenido— pero es lo que hace que las doce se puedan llevar. Sin ella el compendio es una carpeta de archivos y no sabes qué tienes dentro.

**Dónde va:** cuarto botón del menú principal (`renderTitleMenu`, en `ui/shell/game-shell.js`), entre *Cargar partida* y *Opciones* — el contenido va antes que los ajustes. Hoy ese menú son «tres cosas y una puerta de salida»; pasan a ser cuatro, y hay que actualizar ese comentario al hacerlo.

**No hace falta tener una partida abierta.** El compendio es **tu biblioteca**, no la de una campaña: por eso vive en el menú y no en `/campana`. Un opener, y lo llaman los dos sitios —el menú principal y la pantalla de bienvenida— sin duplicar nada.

### Qué se ve

- **Una pestaña por batería, con su cuenta:** «Armas 34 · Bestiario 20 · Personas 0».
- Las que todavía no existen salen **apagadas, con su motivo** —*«todavía no existe»*—, igual que las escenas apagadas del Modo Juego. Así la pantalla es de paso **la barra de progreso de este roadmap**.
- Dentro, una tabla: nombre, etiquetas, peso, `when` y **de dónde vino** (`source`).
- Filtros arriba: por etiqueta, por rareza, por región y por libro.

### Las tres cosas que la hacen más que una tabla

1. **Los huecos, no solo lo que hay.** *«Armas: 34, pero ninguna* Very Rare *y ninguna del pantano»*. Eso convierte llenar el compendio en una lista de tareas en vez de en un folio en blanco, que es la diferencia entre llenarlo y no llenarlo nunca.
2. **El botón de probar.** *«Dame 10 armas del norte»* y ves las diez, con la semilla que quieras. Es como se ajustan los pesos **sin jugarte una partida entera** para descubrir que la daga sale siempre.
3. **Quitar un libro entero.** Filtras por `source` y borras. Importaste un libro, no te convenció, fuera — sin abrir un solo JSON.

### Edición, pero ligera

Cambiar un peso, una etiqueta o un `when` ahí mismo. Lo gordo —escribir cincuenta filas— sigue siendo el archivo o el Gem; esta pantalla es para **el retoque y para mirar**, que es lo que se hace el 90 % de las veces.

### Cuándo hacerla

Justo después del cargador y de **B1 nombres**. Con una sola batería dentro ya te dice si el cargador funciona, y a partir de ahí **ves aparecer cada batería que añades** — que es la mejor razón que hay para añadir la siguiente.

---

## En qué orden

| Orden | Batería           | Por qué ahí                                                                                 |
| :---- | :---------------- | :------------------------------------------------------------------------------------------ |
| 1.º   | **B1 nombres**    | Diminuta, se ve en todas partes, y prueba el cargador entero                                |
| 2.º   | **La pantalla**   | Con una batería dentro ya enseña si aquello funciona, y a partir de ahí ves crecer el resto |
| 3.º   | **B2 materiales** | Dos tablas, y ya alimentan nombres y objetos a la vez                                       |
| 4.º   | **B6 bestiario**  | La que más cambia el juego por fila escrita                                                 |
| 5.º   | **B3 armas**      | El botín es lo primero que el jugador mira                                                  |
| 6.º   | **B9 misiones**   | Cuarenta y siete filas, miles de misiones                                                   |
| 7.º   | **B7 personas**   | Con esto el mundo deja de estar vacío                                                       |
| —     | El resto          | En el orden que te apetezca: ya son aditivas                                                |

**Nombres y materiales primero** no es por importancia, es porque son las dos más pequeñas y
las que tocan todo lo demás: si el cargador está mal, te enteras el primer día y con dos
archivos de veinte líneas, no con el bestiario a medio escribir.

---

## Cómo se llenan sin programar

Cuatro vías, y las cuatro acaban en el mismo archivo:

1. **Un libro entero.** La que más rinde con diferencia: lo pasas por el Gem, importas el
   paquete y subes al compendio sus armas, bichos, gente y sitios de una vez. Cómo funciona
   está arriba, en **El puente**. Gratis: ni una llamada más al modelo.
2. **A mano.** Abres el `.json`, copias la fila de arriba, cambias lo que quieras. El
   validador te dice si te has colado.
3. **Con el Gem, batería a batería.** Para las seis que ningún libro te va a dar. Le das el
   contrato de **una** y te devuelve cincuenta filas — la misma regla de siempre: un libro no
   cabe en una respuesta, y un bestiario tampoco.
4. **Desde el juego.** Lo que escribas en `/campana` se puede **subir al compendio** con el
   mismo botón: lo que inventaste para una partida queda disponible para todas.

---

## Lo que no voy a hacer y por qué

- **Nada de una base de datos.** Medido en tu máquina: 20.000 filas son 5 MB, 31 ms en
  cargarse y 10 ms en indexarse. Y un `.json` lo abres en el Bloc de notas; un `.db` no, y eso
  rompe la norma de la casa.
- **Nada de un archivo enorme.** Uno por dominio: los diffs siguen siendo legibles, un archivo
  roto te cuesta un dominio y no todo, y el Gem puede producir uno cada vez.
- **Nada de meter el compendio en el Lorebook.** El Lorebook se inyecta en el prompt cuando
  una palabra coincide: dos mil bichos ahí dentro son peso en **cada turno**. El compendio es
  de dónde se **saca**; solo lo que entra en juego se convierte en ficha.

---

## Enlaces

- [[ALGORITMOS_GENERACION]] — las 200 ideas, y qué enciende cada batería
- [[ROADMAP_MAESTRO]] — dónde encaja esto en los seis niveles
- [[GEM_CREAR_CAMPANA]] — la máquina de contratos que ya tienes, apuntando a otra cosa
