---
title: Lo que le falta al juego — análisis del 2026-09-26
tags: [analisis, pendientes, jugabilidad, tablero, contenido, deuda, roadmap]
created: 2026-09-26
updated: 2026-09-26
author: DanielJHesseling / Claude Opus 5.5
---

# 🔭 Lo que le falta al juego

> [!NOTE]
> **Qué es esto.** Un análisis del proyecto entero hecho el 2026-09-26, justo después de terminar R1–R10 de [[ROADMAP_PROFUNDIDAD]]. Recoge lo que le falta al juego para jugarse mejor, ordenado y con su porqué. Cada cosa se ha mirado en el código, no a ojo.
>
> **Qué no es.** No es el marcador: el día a día sigue en [[POR_HACER]]. Tampoco repite lo que ya descartaste (está al final, en *Lo que no se propone*). Cuando algo de aquí se empiece, pasa a un roadmap y aquí se marca.

**Cómo leerlo**

- **Quién**: **A**, se puede hacer sin preguntar · **D**, lo decides tú · **P**, propuesta: solo si te convence. Es la división de [[POR_HACER]].
- **Esf.** (esfuerzo): **S**, una sesión · **M**, varias · **L**, una fase entera.
- **Tokens**: todo cuesta **0 tokens** salvo que ponga *llamada*. Lo decide el motor, como el resto.
- 💡 marca lo que haría yo primero.

---

## 📊 1. La radiografía

Números sacados del código el 2026-09-26.

| Qué | Cuánto | Lo que dice |
| :--- | ---: | :--- |
| Módulos del motor (`game-engine/`) | **234** · 50.348 líneas | El motor es grande y está partido en piezas puras que se prueban solas |
| `party.js`, el cableado | **19.006 líneas** | Todo lo que el jugador toca pasa por un solo archivo. Crece unas 1.500 líneas por fase |
| Pruebas unitarias | **3.267** en 137 archivos | Todas en verde |
| Recorrido en navegador | **73 pasos** · unos 55 minutos | Más de 700 comprobaciones haciendo lo que haría quien juega |
| Comandos | **55** | Casi todos tienen botón; algunos todavía son la única puerta a algo |
| Claves de la partida | **83**, todas registradas | El estado está ordenado desde U2 |
| Mundos para elegir | **4**, con tres héroes hechos cada uno | **Solo 1387 tiene un paquete escrito** (nueve rondas). Los otros tres son una plantilla y una semilla |
| Compendio | 16 archivos | Bestiario 35 · habilidades 30 · misiones 57 · personas 76 · sitios 30 · facciones 29 · estados 39 |
| Grimorio | **25 conjuros**, siete escuelas | En código, como decidiste (DR3) |
| Mascotas | 8 especies, 5 caracteres | Desde el 2026-09-26 se doma por el dato `domable` del bestiario (T6, hecho) |
| Documentos de la wiki | **31** vivos, 9 guiones de 1387 y 9 archivados | Hoy se borraron 7 y se archivaron 9 (ver la sección 10) |

---

## ✅ 2. Lo que ya es fuerte

Para saber qué no hay que tocar:

- **La regla de oro se cumple**: el motor decide y el modelo narra. Los mensajes de sistema no llegan al modelo; lo que el modelo lee va por un solo canal. El prompt tiene forma fija (9 bloques) y un comprobador que avisa si cambia.
- **Todo cuesta 0 tokens salvo narrar.** Combate, tiempo, economía, casos, magia, mascota y tableros los resuelve el motor.
- **Se comprueba en un navegador de verdad**, con servidor y datos propios. Ese recorrido ha cazado fallos que las pruebas no veían. Solo en R1–R10 fueron seis: «Cancelar» creaba la campaña, las habilidades de clase no llegaban, las reglas nuevas no se aplicaban hasta recargar…
- **El contenido es datos**: el compendio, los paquetes, el guion del Gem y su conversor. La magia es la excepción que elegiste.
- **Los modos** (R1) dejan jugar lo mismo en relajado o en supervivencia, apagando sistemas en vez de maquillarlos.

---

## 🔴 3. El diagnóstico en cinco frases

1. **El tablero no tenía altura, ni salidas, ni cosas que se rompan**, y el guion de 1387 lo pedía doce veces (`mecanica_pendiente`). *La altura y las salidas, hechas el 2026-09-26 (B1 y B2); lo que se rompe sigue en B3.*
2. **Solo hay un mundo escrito.** Los otros tres existen como plantilla: se juegan, pero con lo que el generador improvisa.
3. **La primera hora no enseña nada.** 83 claves, 18 relojes y 55 comandos, y el juego no explica ninguno. El modo relajado quita peso, pero no enseña.
4. **La generación de mundos con IA nunca se ha probado con un proveedor real.** El recorrido usa un generador simulado. Es la única tubería del juego que no se ha visto funcionar.
5. **Cada cambio cuesta más que el anterior.** Un archivo de 19.000 líneas y un recorrido de 55 minutos: cada fase nueva se edita por anclas en `party.js` y se espera una hora para saber si algo se rompió.

---

## 🧩 4. Terminar lo empezado

Lo que quedó a medias en los últimos planes. Todo es **A**: el camino está decidido.

| ID | Qué | De dónde | Esf. | Por qué |
| :--- | :--- | :--- | :---: | :--- |
| **T1** 🟡 | **Palancas, cuerdas y barricadas** · *palancas y barricadas, hechas el 2026-09-26* | R6 | M | La palanca `P` abre las puertas con llave del tablero (la cuarta forma de pasar una reja, y la que obliga a ir a otra sala primero); un robo trae una en otra sala. La barricada `=` es B3. **Falta:** la cuerda que cruza un precipicio |
| **T2** ✅ | **Pedir tregua y llamar refuerzos** · *hecho el 2026-09-26* | R7 | S | `combat/morale-options.js`. Con su líder caído y la mitad fuera, los que quedan (dos o más, ningún jefe) piden tregua una vez: «Dejarles ir» gana el tablero sin su botín, «Sin cuartel» sigue la pelea (`/tregua sí|no`), y los tuyos juzgan las dos cosas. Quien huye puede volver con ayuda dos rondas después, por la salida si la hay (las oleadas de R6); la ayuda que no llega a entrar no espera a la pelea siguiente |
| **T3** ✅ | **Que el mundo reaccione a la mascota** · *hecho el 2026-09-26* | R5 | S | `campaign/pet-reception.js`. Cada oficio tiene sus gustos (al posadero no le hacen gracia los perros; el herrero agradece uno que guarde la puerta; en el templo no quieren cuervos ni espíritus) y una de cada cinco personas piensa lo contrario, siempre la misma. Al llegar a un sitio, quien tiene oficio y aún no la había visto reacciona una vez: una línea sin tokens y un paso de actitud, que mueve precios y tratos |
| **T4** ✅ | **Precios que se mueven con la estación**, y **componentes que escasean** donde persiguen la magia · *hecho el 2026-09-26* | R9 | M | `campaign/season-market.js`. En invierno la comida (+25 %) y el abrigo (+20 %) suben; en otoño hay cosecha (−10 %); en verano las mantas bajan. Donde quien manda persigue la magia, los componentes no se venden; donde comercia con ella, salen un 25 % más baratos. La facción lo dice con `magia: persigue | tolera | comercia` (esquema, importador y guion); sin decirlo, se deduce de sus etiquetas (la fe persigue, lo arcano comercia) |
| **T5** 🟡 | **Los bloques `mascota:`, `pieza:` y `caso:` del guion** · *la mascota, hecha el 2026-09-26* | R10 | M | Un héroe hecho puede llegar con su mascota (`mascota: { nombre, especie, caracter }` en el guion; `pet` en el paquete y en `mundos.json`): al elegirlo, entra con ella. El tercer héroe de cada mundo trae una (el cuervo de Fray Rodrigo, el loro de Tobías…). **Faltan:** las piezas (salas propias de un mundo) y los casos escritos |
| **T6** ✅ | **Domar por dato, no por nombre** · *hecho el 2026-09-26* | Hallado hoy | S | Manda el campo `domable` (`"perro"`, `"cuervo"`…; vacío, no se doma) de la fila del bestiario, del enemigo del paquete y del bicho del guion; viaja por el generador, el importador, el explorador y la lectura del mundo. Solo sin el campo decide el nombre, para no romper los mundos escritos antes. Marcados de serie: el lobo (perro) y el cuervo. El esquema del Gem y [[GEM_GUIONISTA]] lo explican |
| **T7** 🟡 | **Relojes que dicen su próximo plazo**: 13 de 18 · *cuatro más el 2026-09-26* | U3 | M | «Lo que viene» dice ahora también quién está harto y puede irse, cuándo pueden llevarse los rivales un encargo, cuándo os buscan menos en cada sitio y cuándo llega la próxima pista si el hilo sigue quieto (un día antes con un erudito). El harto sale además en la Mesa, con lo que pasa si nadie le atiende. **Faltan:** cartas, surtido de la tienda, necesidades, aprendizaje y banquillo, que no tienen un día fijo |
| **T8** | **Registros que leen de la crónica**: 3 de unos 10 | U4 | M | Hazañas, recuerdos, estadísticas y tumbas siguen apuntando cada uno a su manera. Leerlos de la crónica es lo que hace que el narrador recuerde lo mismo que el diario |
| **T9** | **Horarios de PNJ** por franja del día | P19 · DU3 | M | El herrero en la fragua por la mañana y en la taberna por la noche. Con el calendario y los sitios puestos, es casi solo datos |
| **T10** | **Oficios de campamento** para quien ya no puede pelear | P25 | S | La pierna de palo existe (`rules/remedies.js`). Falta que el compañero amputado sirva de cocinero, vigía o curandero en vez de ir al banquillo |
| **T11** | **Los remedios, editables en `/rules`** | Deuda | S | `readRemedies` ya acepta una tabla propia. Falta su sección, su editor y que viaje al exportar |
| **T12** ✅ | **Más enemigos que lanzan conjuros** · *hecho el 2026-09-26* | R4 | S · datos | Tres filas nuevas en el bestiario, sin código: el chamán (espinas y curar, en bosques y pantanos), el nigromante (toque vampírico y sueño, en criptas) y el aprendiz de mago (rayo de fuego, escarcha y escudo arcano, en ciudades y ruinas). Usan el grimorio por sus ids |

---

## 🧱 5. El tablero que pide el guion

El guion de 1387 trae **12 `mecanica_pendiente`**: cosas que el Gem escribió para un tablero y que el motor no sabe jugar. Son la mejor lista de lo que falta, porque salen de escribir campañas, no de imaginarlas.

| ID | Qué | Lo pide el guion | Esf. | Cómo |
| :--- | :--- | :--- | :---: | :--- |
| **B1** ✅ | **Altura** · *hecho el 2026-09-26* | 4 veces: escalones, torres, empalizada, «ventaja por altura» | M | La casilla `^` (`board/heights.js`): subir cuesta el doble y desde arriba se ataca con ventaja, los dos bandos y con cualquier arma (entra en `attackEdge` como una razón más). El tirador de R7 sube a lo alto si puede sin perder el tiro. Aguantar trae dos puestos altos en la sala de entrada, y hay una sala escrita nueva, *La atalaya*. En 1387, las almenas de las torres del peaje (ronda 10) |
| **B2** ✅ | **Salidas** · *hecho el 2026-09-26* | 2: «saltar por la ventana termina el combate», «la ventana que da al callejón» | S | La casilla `x` (`board/exits.js`). Al pisarla sale un aviso con su botón (o `/salir`): quien sale ya no pelea (nadie le ataca, no tiene turno). Cuando han salido todos los que siguen en pie, se acaba en huida, sin los golpes de la retirada; si los de dentro caen y otros salieron, también es huida. Un robo trae una ventana en la sala del fondo. En 1387, la ventana del cuarto de la posada (ronda 10). El que huye con su líder caído se va por la salida |
| **B3** 🟡 | **Lo que se rompe** · *la barricada, hecha el 2026-09-26* | 2: puertas de granja con daño, columnas de la tienda | M | La barricada `=` corta el paso pero no la vista, cubre a quien está detrás (cuenta en la línea de tiro) y tiene 15 de vida: en combate se golpea con el daño del arma y gasta la acción; fuera, se rompe de una vez. Rota, deja escombros. Aguantar pone barricadas a los lados de las puertas de la sala de entrada. **Falta:** la columna que al romperse ciega en un área |
| **B4** | **Terreno que atrapa** | 3: lodo que apresa al cargar, lodo que mancha las armas, hielo que cede con tres encima | S | El lodo como terreno (`m`): cargar a través de él deja *apresado* un turno. El hielo de R3 que se rompe si pisan tres casillas contiguas y cae quien esté encima |
| **B5** | **Coberturas que arden** | 2: árboles con cobertura, muros de carbón que explotan | S | Hoy arde la maleza (`b`). Que una cobertura pueda ser inflamable según el sitio: en un bosque, la `C` es un árbol |
| **B6** 💡 | **Que `mecanica_pendiente` deje de existir** | Las 12 | M | Un vocabulario corto de reglas de tablero en datos (`reglas: [{ casilla: "C", arde: true }]`) que el Gem pueda usar y el conversor valide. Con B1–B5 dentro, el guionista escribe la regla y el motor la juega, sin pasar por ti |

> [!TIP]
> **B1, B2 y B6 son la mejor inversión de todo el documento.** Cambian cómo se juega cada combate, salen de lo que el guion ya pide, y B6 hace que la próxima campaña no acumule otra docena de pendientes.

---

## 🧠 6. La IA

| ID | Qué | Quién | Esf. | Tokens | Por qué |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **I1** 💡 | **Probar la generación de mundos con un proveedor real** | **D** | S | llamadas | Es la única tubería sin ver funcionar. El recorrido usa un generador simulado que ejercita todo menos la llamada. Una prueba con tu clave y un tope (dos o tres mundos) diría si el modelo respeta el esquema del mapa. Cuesta céntimos, pero son tuyos: por eso es D |
| **I2** | **Un tope de gasto por sesión** | **P** | S | 0 | «Tu sesión» ya cuenta las llamadas. Con la estimación de tokens que ya existe, el juego avisaría al acercarse a una cifra que tú pones, y pararía al pasarla. No es reconciliar con el proveedor (eso lo descartaste en D2): es un freno con la estimación de siempre |
| **I3** | **Proponer escenarios con IA** | **P** | M | llamada | Era P1 💡: la misma tubería que genera mundos, contra el esquema de los escenarios. Con los tableros con propósito de R6, el modelo solo tendría que proponer el *qué*; el *dónde* lo pone el generador |

---

## 🌍 7. El contenido

Todo esto son **datos**: se hace con el Gem, el conversor y `/campana`, sin tocar código.

| ID | Qué | Esf. | Por qué |
| :--- | :--- | :---: | :--- |
| **C1** 💡 | **Escribir un segundo mundo entero** (costa, ocaso o la pantalla) | L · tuyo | 1387 tiene nueve rondas, 15 batallas, casos y héroes. Los otros tres tienen una ficha, tres héroes y lo que improvise el generador. Un segundo mundo escrito es lo que más rejugabilidad da, y el Gem guionista ya sabe de todo lo nuevo (áreas, terreno, grimorio, héroes) |
| **C2** 🟡 | **El bestiario: domables, conjuros y papeles** · *domables y conjuros, el 2026-09-26* | S | 41 criaturas, 8 con habilidades, **5 domables** (lobo, cuervo y, nuevos, zorro, halcón y gato montés). **Falta:** el `papel` escrito (hoy se deduce) |
| **C3** ✅ | **Más salas por propósito** · *hecho el 2026-09-26* | S | Siete salas para siete propósitos: a la cámara, la guarida, el altar y la atalaya se suman el cuartel (limpiar, con un barril en medio), el puente (escoltar: un paso sobre el vacío) y el despacho (silenciar: en alto, detrás de dos barricadas) |
| **C4** | **Los 69 campos de 1387 que el juego no lee** | M | El conversor los avisa desde U7. Los más útiles son `cambia.aparece` en 13 hitos y el destino de las escoltas. B6 se come 12 de ellos |
| **C5** · **D** | **El paquete de 1387 va por detrás de su guion** | S | Hallado el 2026-09-26: regenerar el paquete desde el guion cierra **7 caminos** con `cerrado_hasta` (hasta *el ultimátum*, *la vanguardia de Keller*, *el paso de los contrabandistas*, *el precio del escape*). El conversor aprendió a leerlo en U7, pero el paquete no se volvió a generar, así que hoy esos caminos están abiertos desde el principio. Regenerarlo cambia cómo se viaja en 1387, por eso es tuyo: `node tools/guion-a-paquete.mjs wiki/guiones/1387`. La ronda 10 (ventana y almenas) se aplicó a mano, sin tocar lo demás |

---

## 🎓 8. La primera hora

Nada de esto existe hoy: no hay tutorial ni ayuda dentro del juego. Todo es **P**.

| ID | Qué | Esf. | Por qué |
| :--- | :--- | :---: | :--- |
| **H1** 💡 | **Una primera partida que enseña** | M | El primer encargo de 1387 en modo relajado, con líneas del motor (0 tokens) que presentan **un sistema cada vez**, justo cuando aparece: la mesa el primer lunes, la cuenta el primer viernes, la mascota al primer rastro. Se apaga sola al acabar la primera semana |
| **H2** ✅ | **«Cómo se juega» en la pausa** · *hecho el 2026-09-26* | S | En la pausa y con `/ayuda`. No se escribe a mano: se arma con el modo de la partida (qué letras están encendidas), la leyenda del tablero del esquema, las categorías de la crónica y si hay magia o mascota (`campaign/how-to-play.js`). Lo apagado no se explica como si estuviera |
| **H3** | **Menos comandos a la vista** | M | 55 comandos. Algunos son la única puerta a algo (el pegamento lo dejó apuntado). Cada uno debería tener su botón o no estar |
| **H4** | **El componente común de tarjetas** para las ventanas viejas | M | Lo dejó pendiente U6. Las ventanas nuevas (mesa, grimorio, mascota) se parecen entre sí; las viejas, cada una a su manera |
| **H5** | **Deshacer al pintar el tablero** | S | Era P7. Pintar terreno y mover fichas no tiene vuelta atrás |

---

## 🔧 9. Lo técnico

| ID | Qué | Quién | Esf. | Por qué |
| :--- | :--- | :---: | :---: | :--- |
| **K1** 💡 | **Partir `party.js` por dominios** | A | L | 19.006 líneas. La magia, la mascota, los encargos, el turno enemigo y los tableros con propósito pueden vivir en `party/` como ya viven `html.js` o `campaign-state.js`. No cambia nada de lo que se ve: cambia lo que cuesta cada fase siguiente. Mejor antes de la próxima fase grande |
| **K2** | **Partir el recorrido en tandas** | A | M | 55 minutos para 73 pasos. `e2e-quick.mjs` ya enseña el camino: una tanda por fase que arranca desde un punto guardado, y la vuelta entera solo antes de dar algo por cerrado |
| **K3** 🟡 | **Los pasos que fallan a veces** · *tres arreglados el 2026-09-26* | A | S | El 68 no esperaba al héroe (`waitForFunction` con una función async no espera nada). El 190 (los lobos gritan) dependía de que el golpe tumbase al lobo. El 53 (la ruta del lobo) era de verdad: la ficha del héroe quedaba bajo la cabecera del Modo Juego y no se podía pulsar; ahora el tablero centra la ficha a la que le toca cuando no se ve. **Queda:** el 24 (el contador del jefe), con su diagnóstico puesto |
| **K4** 🟡 | **Errores en la consola del recorrido** | A | S | «[taller] no se pudieron proponer sitios» ✅ *arreglado el 2026-09-26*: era el taller saltándose a propósito los sitios de un libro. Además, una vuelta cortada deja su servidor de pruebas vivo y la siguiente no arranca (puerto 8123): hay que cerrarlo a mano. Queda por mirar el error 500 al guardar el chat que el pegamento dejó apuntado |
| **K5** | **Tres archivos grandes sin pruebas** | A | M | `campaigns.js` (1.723 líneas), `dynamic-context-manager.js` (998) y `world-content-browser.js` (674). Solo el recorrido los toca |
| **K6** ✅ | **`guion-errors.js` solo lo cargan las pruebas** · *resuelto el 2026-09-26* | A | S | No era código muerto: lo usa el conversor del guion (`tools/guion-a-paquete.mjs`). El comprobador de cableado ahora dice aparte lo que solo usan las herramientas |
| **K7** | **`npm audit`**: 47 vulnerabilidades, una crítica | D | S | Era D1. Mirar solo la crítica, y el resto con el próximo merge de upstream |
| **K8** | **Dos formas de definir un mundo** | D | M | Las plantillas de inicio son código (`starter-templates.js`) y los mundos son paquetes. Era D4 / DU7: aplazado hasta que quieras una plantilla fija que la IA no dé |

**Lo que se queda así a propósito** (de la auditoría técnica del 2026-09-21, ya borrada): la CSP desactivada, jQuery 3.5.1, los secretos en texto plano y el `index.html` de 10.839 líneas son **de upstream**. Tocarlos cuesta un merge en cada actualización, y en uso local de una persona no compensa. La virtualización del chat y del tablero pediría un rediseño. Del resto de aquella auditoría, la fuga de escuchadores del tablero está mitigada y la falta de pruebas es K5.

---

## 📚 10. La wiki, puesta en orden hoy

**Borrados** (en git, recuperables con `git checkout d9dc871e3 -- <ruta>`), porque ya estaban minados y lo vivo se había ido a otro sitio:

| Documento | Por qué sobraba |
| :--- | :--- |
| `HOME.md` (en la raíz) | Un portal del 2026-09-20 que repetía, desfasado, el de `wiki/HOME.md` |
| `IDEAS_200` | Las 200 ideas estaban hechas o quitadas. Lo quitado pasa a la sección 12 de aquí; lo hecho está en *Mundos vivos* |
| `ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES` | Sus siete fallas se hicieron el 2026-09-23 (POR_HACER, *Hecho*); lo único que quedó es A13 |
| `PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES` | «Ya minado», decía él mismo. Y aún decía que no había magia ni subida de nivel |
| `DISENO_GENERADOR_MUNDOS_PROFUNDO` | El esquema vive en el código (`campaign-pack-schema.js`) y en [[GEM_CREAR_CAMPANA]], que se genera de él. Lo que proponía y faltaba está en P17–P25 y aquí |
| `PROBLEMAS_TECNICOS` | Seis de quince hallazgos corregidos y cuatro mitigados; los cinco abiertos son de upstream o piden un rediseño, y están en la sección 9 |
| `PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA` | La visión original, construida. El porqué vive en [[ROADMAP_MAESTRO]] |

**Archivados** en `wiki/archivo/`: planes cerrados que el código cita en sus comentarios (`PROP2-039`, `M1 a M6`…). No se borran porque explican el porqué de piezas que existen: *Mundos vivos*, *Creación*, *Ingesta*, *Juego sin comandos*, *Frontend modo juego*, *Propuestas de mejora* (las dos), *Bucle de juego* y *Plan crear campaña*.

**La regla para que no vuelva a pasar**: un marcador ([[POR_HACER]]), un plan vivo (hoy [[ROADMAP_PROFUNDIDAD]]), y este documento para lo que falta. Un plan que se cierra se archiva el mismo día.

---

## 🧭 11. El orden que recomiendo

| # | Qué | Por qué en este orden |
| :---: | :--- | :--- |
| 1 | **K3 + K4**: los pasos inestables y los errores de consola | Baratos, y sin ellos no te puedes fiar de una vuelta en rojo |
| 2 | ✅ **T6**: domar por dato | Hecho el 2026-09-26 |
| 3 | ✅ **B2 + B1**: salidas y altura | Hechos el 2026-09-26 |
| 4 | **B6**: el vocabulario de reglas de tablero | Para que la próxima campaña no acumule pendientes |
| 5 | **H1** + ✅ **H2**: la primera partida y «Cómo se juega» | H2 hecho el 2026-09-26; H1 sigue: todo lo construido solo vale si se descubre |
| 6 | **I1**: probar la generación real | Tu decisión, y cuesta céntimos |
| 7 | ✅ **T1 + T2 + B3**: palancas, tregua, lo que se rompe | Hechos el 2026-09-26, salvo la cuerda y la columna |
| 8 | **K1**: partir `party.js` | Antes de la siguiente fase grande, no durante |
| 9 | **C1**: un segundo mundo escrito | Tuyo y del Gem. Con B6 hecho, sale mejor |
| 10 | 🟡 **T7** + **T8**: relojes y crónica | T7, 13 de 18 el 2026-09-26; T8 sigue |

---

## 🚫 12. Lo que no se propone

Decidido por ti. Está aquí para que nadie lo vuelva a proponer sin saberlo.

**Quitadas de las 200 ideas (2026-09-24):** 50 (defecto opcional), 51 (meta personal), 112 (nueva partida+), 133 (desgaste ligero), 154 (punto de guardado), 157 (tamaño de letra y alto contraste), 161 (saltar a sucesos), 165 (medir distancias), 167 (confirmar lo irreversible), 170 (modo foto), 171 (la partida como relato), 196 (logros por mundo), 197 (reto semanal).

**Quitadas en la segunda criba (2026-09-24):** 12 (ruido), 16 (pifia leve), 19 (modo rápido), 60 (carga y mochila), 76 (paredes falsas), 79 (entrar sin ser visto), 80 (descanso corto), 83 (territorio en el mapa), 98 (te ganan el sitio), 99 (cambios de acto), 158 (tablero táctil), 177 (probar un tablero), 194 (paleta por mundo).

**Decisiones de POR_HACER:** D2, no reconciliar los tokens con el proveedor. D3, el registro de combate no sobrevive a una recarga. D5, la magia ligera, que R4 hizo desde el código.

**Decisiones de la profundidad (2026-09-26):** DR1–DR7, todas en la opción A. Entre ellas: la magia solo desde el código, cargas por círculo, la mascota apoya sin pelear en serio y el terreno nuevo en código.

---

## 🔗 Enlaces

- [[POR_HACER]]: el marcador del día a día.
- [[ROADMAP_PROFUNDIDAD]]: R1–R10, lo último construido, con su tabla «Cómo va».
- [[ROADMAP_PEGAMENTO]]: U0–U8, con los números que tienen que bajar.
- [[ROADMAP_MAESTRO]]: el porqué.
- [[GEM_GUIONISTA]] y [[GEM_CREAR_CAMPANA]]: con lo que se escribe un mundo.
- [[HOME]]: el índice.
