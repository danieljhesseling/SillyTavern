---
title: Roadmap — Que el juego entretenga más
tags: [roadmap, diversion, tactica, mazmorra, gremio, compañeros, viaje, comodidades]
created: 2026-10-02
---

# 🎯 Que el juego entretenga más

> **Qué es:** el plan para que jugar sea más divertido, no solo más completo. Viene después de [[ROADMAP_SIN_CONEXION]] y de escribir bien las tres campañas experimentales (ver el orden allí).
> **De dónde sale:**
> - un análisis de ideas que pasaste el 2026-10-02;
> - lo que vimos jugando: el combate que no se notaba, los ataques que fallaban demasiado, el turno poco claro;
> - y, sobre todo, **tus partidas con la plantilla de «Vuestras pruebas» (J16.5)**, que deciden el orden final.
>
> **Principio: nada de «fontanería» a la vista.** Todo se hace hablando con la gente o actuando en el mundo, no pulsando botones que parecen órdenes (D-J62 modo guiado, D-J63 quedar como en *Persona*).
>
> **Criterio:** **D&D puro** (D-J58). Las reglas oficiales de 5e (2024) primero. Lo que sea de cosecha propia va marcado, y lo decides tú.

**Cómo leer la columna «Hoy»:**
- ✅ ya existe en el juego;
- 🟡 existe a medias o sin contenido que lo use;
- ⬜ no existe.

## 📍 Cómo va (2026-10-04, 07:45)

**Avance: ~99 %: terminado.** Las 32 ideas están escritas y probadas en el navegador, y los fallos que salieron al cruzarse los cambios están arreglados. El código de ayer está en tu commit 5344ba2fb («pre beta V2.0»); los arreglos de hoy, en el siguiente. **Solo quedan tus decisiones** (abajo): cifras y reglas de cosecha propia. El arte que falta lo está haciendo el agente de PixelLab ([[PIXELLAB_PENDIENTE]]).

| Bloque | Hecho | Prueba en el navegador |
| :--- | :--- | :--- |
| E1 · El tablero que se usa | Todo: E1.4 la columna que se derriba (Comedor del Conde, mina), E1.5 estatua con gema, runas en orden y palancas dobles (Argynvostholt, ermita, salón de Vane) | ✅ |
| E2 · La mazmorra que pesa | Todo, con tus decisiones: forzar cerraduras pide ganzúas y los héroes empiezan con 5 antorchas (5 de 5) | ✅ |
| E3 · El grupo y sus combos | Todo; E3.2 combos para cualquier pareja con vínculo 3 (13 de 13), E3.3 Arma elemental (11 de 11) | ✅ |
| E4 · Compañeros con roce | Todo: el mercenario molesto no ataca en pareja y pide más paga (o se va), discusiones junto al fuego en las que das la razón, misiones de 2-3 pasos para cualquier mercenario con vínculo 3 (13 de 13). Sus decisiones, en «Por decidir (E4)» | ✅ |
| E5 · El gremio que paga | Todo: temple y raciones para la salida, libros de bichos, «Quién está para salir», cansancio del camino, mandar a alguien a un encargo con su informe (12 de 12) | ✅ |
| E6 · El camino entre campañas | Todo: tarjetas de viaje (puente caído, ventisca, mercader), se come por el camino, papeles de noche al acampar (12 de 12) | ✅ |
| E7 · Sin fricción aburrida | Todo, también el cuadro de preparar del héroe ya marcado | ✅ |
| E8 · La larga vida | Todo | ✅ |

**Hecho hoy (2026-10-04):** la ficha enseña lo preparado en el gremio (temple y ración) y la forja de la Casa del Gremio mezcla materiales (dos pieles: una capa; un colmillo, garra o escama: el arma a +1). Las misiones de mercenarios usan caras que ya había.

**Probado ya en el navegador (2026-10-04)** lo que solo tenía pruebas de código, y va bien sin tocar nada:
- **E3.3:** una exploradora que lleva el juego lanza Arma elemental sola, en una pelea larga, sobre el guerrero de cuerpo a cuerpo que tiene al lado. Gasta su espacio de 3.º, se concentra, y la tarjeta del arma de él enseña «+1d4 fuego» y «+1 de Arma elemental».
- **E8.6:** un mercenario con dos salidas va a Strahd desde el tablón y vuelve con «Volver al gremio». Al llegar es veterano: apodo, rasgo, su charla, la línea en el registro y la insignia en «Contratar».
- **E1.4:** en el Comedor del Conde, tras elegir «Pelear», la ventana se cierra y nada tapa las dos columnas, ni al colocarse ni en la pelea. Con el ratón se tira una sobre un engendro: daño contundente y escombros.

**Fallos que han salido al cruzarse los cambios** (todos arreglados; también en la tabla de bugs de [[ROADMAP_SIN_CONEXION]]):
- ✅ arreglado: en `e2e-magia`, la tarjeta de subir de nivel, el «+2 por la Luz» al examinar de noche, la pregunta de curar al llegar y las iniciales en el tablero. El juego estaba bien; la prueba se había quedado vieja (E7.4, el modo guiado, D-J60) y ya sale entera bien.
- ✅ arreglado: al pasar una semana viajando o acampando, el oro del grupo se quedaba en 0. La cuenta de la semana cobraba en oro la comida y la posada de los días de camino (cuando ya se comía de las raciones y se dormía al raso), y si no llegaba vaciaba el bolsillo entero aunque los mercenarios se quedaran igual sin cobrar. Ahora los días fuera no pagan comida ni posada, y si no llega se paga en orden (comida, posada y tasas, y los sueldos enteros, uno a uno): el sueldo que no llega se queda en el bolsillo. En el navegador, 120 de oro con tres mercenarios: tras 10 días de camino quedan 44 (antes, 0).
- ✅ arreglado: el rótulo «Vínculo 3 · …» se cortaba con la ficha pegada al borde del tablero. Ahora se queda dentro: junto a un lado se corre hacia dentro, y en la fila de abajo sale encima de la ficha (y el bocadillo de la frase, encima de él). El bocadillo tampoco se corta ya por los lados. En el navegador, con la ficha abajo, a la izquierda y a la derecha (`combat-vtt/fx.js`, `combat-vtt.css`).
- ✅ arreglado: Iria Salitre y los demás reclutas de los dormitorios salían con silueta en las charlas y en su misión. No era el femenino («pícara» sí encontraba el retrato de «pícaro»): al montar la charla, el nombre suelto de quien habla pisaba su ficha y se perdía su clase (`cast-scenes.js`). Además, la clase en femenino se busca bien también por su id (`pixel-art.js`).

**Decisiones abiertas para Daniel (de E1, E5 y E6):**
- **La forja (nuevo):** ya había «Mejorar» (el arma a +1 por 150 de oro); ahora también con 80 y un colmillo. ¿Se quedan los dos caminos? Las sedas y plumas aún no tienen receta.
- **La Luz en el pueblo:** con el modo guiado, cosas que se miran al aire libre (los avisos de la lonja) salen dentro de la tienda, donde ya hay luz y la Luz no suma (D-J51). ¿Lo cambiamos?
- **E1:** las reglas de la columna son mías (Atletismo CD 10 para derribarla, 1d10 contundente, Destreza CD 12 para la mitad, deja escombros) y el chispazo de 1d4 de la runa equivocada también. ¿Valen? El camino automático pisa las runas que cruza: ¿que las rodee solo? ¿Hacemos la «palanca con plazo» (abrir el mecanismo antes de la ronda N) con las palancas dobles? El dibujo de columna, estatua, gema, runa y palanca doble está en `PIXELLAB_PENDIENTE.md`.
- **E5 (cosecha propia):** temple 40 de oro; caldo 15 y guiso 20 (5 menos por nivel de cocina); libro de bichos 60 (15 menos por nivel de biblioteca); el cansancio llega desde dos salidas seguidas y una semana en casa lo borra; se puede mandar a un herido (baja la probabilidad). ¿Valen? «Mezclar materiales» en la forja usa las recetas que ya tenía el herrero de los pueblos (dos pieles: una capa que abriga, 10 de oro; algo duro, como un colmillo o una garra: el arma a +1, 80 de oro). Así la casa tiene dos caminos al +1: la forja sola (150 de oro) o con material de caza (80 de oro). ¿Te vale así?
- **E6:** se come una ración por cabeza y día de viaje. Copiar conjuros es gratis (en 2024 cuesta 50 po por nivel y 2 horas): ¿se cobra? ¿Más tarjetas de viaje (vado crecido, viajero herido)? La cena que repone sale de la dote Chef: ¿añadimos su 1d8 en los descansos cortos?

**Decisiones abiertas para Daniel (de E8, la larga vida):**
- Solo mueren de verdad los confidentes (D-J64). Tu héroe y los demás de los tuyos, si caen, quedan malheridos. ¿Quieres que el héroe también pueda morir y volver en el templo?
- «Modo duro» es una opción del juego (como el Romance), no de cada partida. Encendido, quita «Cargar partida» cuando cae todo el grupo. ¿Así, o por partida?
- El templo: los diamantes son del libro (500 para Alzar a los muertos, 1.000 para Resurrección). El donativo (100 o 200), la tabla de secuelas y la debilidad (−4 a cada característica durante 4 días; en el libro, −4 a las tiradas de d20) son cosecha propia. ¿Valen?
- Dones épicos: Fortaleza y Velocidad van como en el libro; los otros cinco, adaptados (Proeza en combate, +2 al ataque). ¿Valen, o solo los exactos?
- Retirarse: desde el nivel 5; el nuevo empieza 1 nivel más por cada 4 del maestro (hasta el 5); ventajas del gremio: mercenarios −25 %, 50 de oro a cada nuevo, templo −25 %. ¿Las cambias?
- Un mercenario se hace veterano a la tercera vuelta al gremio con vida. ¿Cuentan también las peleas ganadas?

**Para que lo mires (de E3.3, Arma elemental):**
- Solo la tiene el explorador (en 2024, paladín y explorador; el juego no tiene paladín), y le llega a nivel 9.
- El tipo de daño lo elige el juego: el que más les duele a los enemigos que quedan (si da igual, fuego). Así no hay otro menú. ¿O prefieres elegirlo tú?
- Hoy ningún enemigo trae resistencias escritas; por eso decide sobre todo su punto débil.

**Decidido por Daniel (E7): el cuadro de preparar del héroe sale ya marcado con lo de su papel (hecho).**
- Tras dormir, los compañeros preparan solos según su papel (la clériga, curas primero). A tu héroe le sale su cuadro de preparar ya marcado igual, con la línea «Marcado lo de su papel: curar. Cámbialo si quieres.», y lo cambia antes de aceptar.

**Decididas por Daniel (2026-10-03), ya hechas:**
- **Forzar cerraduras requiere herramientas de ladrón** (E2.2), como en 5e. Ya no hay vía «con maña»: sin ganzúas el botón no sale y lo dice uno del grupo. El pícaro y el criminal empiezan con ganzúas, y se venden en las tiendas.
- **Los héroes empiezan con 5 antorchas** (también los héroes hechos de una campaña), y se venden en las tiendas (E2.1). Los mercenarios no llevan mochila: tiran de las del grupo. Los tableros escritos aún no usan el campo `light`.

---

## E1 · El tablero que se usa

Que el entorno cuente en la pelea, no solo los golpes.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E1.1 | **Más que «matar a todos».** El motor ya sabe llegar a un sitio, aguantar, proteger a alguien y jugar por rondas, pero ninguno de los 44 tableros escritos lo usa. Ideas para usarlo:<br>• **escapar:** llegar a las casillas de salida antes de la ronda 5;<br>• **interrumpir un ritual:** romper los dos cristales antes de que el nigromante acabe;<br>• **defender:** aguantar 4 turnos en la puerta de la cripta;<br>• escapar o accionar una palanca antes de la ronda 6;<br>• proteger a alguien frente a oleadas de refuerzos;<br>• robar el cofre y llegar a la salida sin despertar a los guardias.<br>**Hecho (2026-10-03):** escapar con plazo (la posada de 1387 antes de la ronda 5, la choza de Baba Lysaga antes de la 8), llegar antes de una ronda (la carreta), romper los tótems antes de la ronda 5 (Yester), proteger a alguien frente a oleadas (Giles, el hermano Silas, Ireena), defender las puertas (la granja, el islote) y robar sin despertar a los dormidos (el campamento de los furtivos, el taller del ataudero). Falta la palanca con plazo. | ✅ | Normal en aventuras | M |
| E1.2 | **Empujar donde duele:** fosos, precipicios, agua honda y trampas en el borde, para que empujar o derribar valga la pena. Empujar ya existe (maestría Empujar y golpe sin armas), y las alturas y el agua honda también; faltan tableros pensados para eso.<br>**Hecho (2026-10-03):** empujar desde lo alto hace 1d6 por cada 10 pies y derriba; al agua honda, cae, sale derribado y anda 10 pies menos; al vacío, se acaba la pelea para él. Tableros con canal, lago, agujeros en el hielo, cornisas y precipicio en las dos campañas. | ✅ | Sí: daño de caída 1d6 por cada 10 pies | M |
| E1.3 | **Superficies que reaccionan:** fuego que prende las coberturas de madera (`living-terrain.js`), aceite que arde, hielo y barro que piden una salvación de Destreza o te dejan derribado o frenado. También barriles de pólvora que estallan con fuego y agua que lleva el rayo a quien la pisa.<br>**Hecho (2026-10-03):** el hielo es terreno difícil y pide Acrobacias CD 10 o al suelo; el barro (`m`) cuesta el doble; el barril revienta con fuego (3d6, salvación de Destreza CD 12 para la mitad); el rayo salta por el agua a quien la pisa. El barro no pide salvación: en 5e solo es terreno difícil. | ✅ | Sí: Grasa, aceite ardiendo, terreno difícil | M |
| E1.4 | **Cosas que se derrumban:** derribar una columna o una estantería sobre dos casillas, con daño contundente y quizá derribados.<br>**Hecho (2026-10-03):** la columna, puntal o estantería (`H` en el mapa) corta el paso y cubre; estando al lado, con la acción y una prueba de Atletismo CD 10, cae hacia el lado contrario sobre las dos casillas de detrás: quien está debajo, salvación de Destreza CD 12 o 1d10 contundente y derribado (con éxito, la mitad y de pie). Donde cae quedan escombros. En el puntal de los túneles de la mina (1387) y las dos columnas del comedor del conde (Strahd). | ✅ | Cosecha propia, como regla de máster | M |
| E1.5 | **Puzles y mecanismos en el tablero:** estatuas donde poner gemas encontradas, baldosas con runas que se pisan en orden, palancas emparejadas en los dos extremos del mapa.<br>**Hecho (2026-10-03):** las tres, y cada una abre las puertas con llave del tablero:<br>• **estatuas y gemas** (`S` y `g`): las gemas se cogen de su pedestal y se ponen en las manos de las estatuas (Patio de Argynvostholt, Strahd);<br>• **runas en orden** (`1` a `5`): se pisan de la 1 en adelante; la que no toca las apaga todas y da un chispazo de 1d4 (El patio de la ermita, 1387);<br>• **palancas dobles** (`p`): en combate, las dos en la misma ronda; fuera, con alguien junto a cada una (El gran salón de Vane, 1387).<br>Lo dice quien lo hace («Sola no baja. Que alguien se ponga en la otra…»). El paquete avisa si un mecanismo no se puede resolver. Falta su dibujo (wiki/PIXELLAB_PENDIENTE.md). | ✅ | Normal en mazmorras | M |

## E2 · La mazmorra que pesa (riesgo y desgaste)

Que explorar tenga coste, como en *Darkest Dungeon* o *Etrian Odyssey*.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E2.1 | **La luz cuenta.** Hoy la oscuridad solo se dibuja (`draw-light.js`). Con las reglas: en la penumbra, desventaja a Percepción para ver trampas; a oscuras, como cegado; quien tiene visión en la oscuridad ve. Una antorcha ocupa una mano y se gasta. Luz (J19.10) ya ilumina. **Los héroes empiezan con 5 antorchas** (Daniel, 2026-10-03), y también se compran en las tiendas. | ✅ | Sí: visión, penumbra y oscuridad son reglas de 5e | M |
| E2.2 | **Forzar cerraduras con riesgo:** hace falta llevar herramientas de ladrón (ganzúas; Daniel, 2026-10-03): sin ellas no se puede, lo dice uno del grupo y quedan la llave, echarla abajo u otro camino. El pícaro y el criminal empiezan con ellas, y se compran en las tiendas. Fallar hace ruido y despierta la sala de al lado, y fallar por mucho rompe las ganzúas. | ✅ | Sí: sin herramientas de ladrón no se fuerza, y el ruido; romper la herramienta es cosecha propia | S |
| E2.3 | **Acampar en territorio hostil:** posibilidad de emboscada de noche. La guardia (la formación, J7.4) y su Percepción pasiva deciden si os sorprenden. Quien duerme lo hace sin armadura pesada. | ✅ | Sí: descanso interrumpido y encuentros aleatorios | M |
| E2.4 | **Seguir o volver.** El dilema de *Darkest Dungeon*: curarse y descansar cuesta algo de verdad. El descanso corto gasta tiempo; el largo, en la mazmorra, pide raciones y arriesga emboscada (E2.3); los kits de curandero se acaban. Tras cada sala, una decisión clara: seguir con media vida o volver al gremio perdiendo el día. | ✅ | Sí: descansos, raciones y kits de curandero | M |

## E3 · El grupo y sus combos

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E3.1 | **Comprobar que las reglas encadenan solas:** si el guerrero derriba a alguien, los ataques cuerpo a cuerpo contra él tienen ventaja; si el pícaro ataca con ventaja, mete su ataque furtivo. Que se vea en el resumen («Furtivo: +2d6, está derribado»). | ✅ | Sí, son reglas de 5e | S |
| E3.2 | **Combos de vínculo para todos:** `pair-moves.js` (vínculo 3) ya existe; ampliarlo a más parejas y papeles.<br>**Hecho (2026-10-03):** cualquier pareja del grupo con vínculo 3 va a una: tú con un compañero, o dos compañeros entre ellos (cuenta el vínculo del que menos se fía de ti). Cada uno pega desde donde llega con su arma (la arquera, desde lejos). Cinco papeles (delante, sombra, tirador, magia, apoyo) y 15 jugadas con nombre: «Muro de escudos», «Tú lo entretienes», «Yo lo paro, tú tiras»… Quien dispara abre y la sombra remata; después, quien va delante cubre a su pareja, la sombra despista al enemigo, el tirador lo deja vendido, la magia lo frena y el apoyo bendice. Sale en la barra («Con tu vínculo»), en la tarjeta del enemigo y en la ficha. Un compañero que lleva el juego la hace con otro compañero, nunca con tu reacción, una vez por ronda. | ✅ | Cosecha propia | M |
| E3.3 | **«Imbuir el arma de un aliado»** con el conjuro **Arma elemental** (nivel 3, explorador como en 2024; el juego no tiene paladín). Se lanza desde «Magia» sobre alguien del grupo con un arma corriente: +1 al ataque y +1d4 del tipo que más les duele a los enemigos (fuego si da igual; +2/2d4 con espacio 5-6, +3/3d4 con 7+), con sus resistencias. Sale en la tarjeta del arma, en la del objetivo y en la ficha; se acaba al perder la concentración. Los compañeros que lo saben lo lanzan solos en peleas largas. | ✅ | Decidido por Daniel el 2026-10-03: con Arma elemental | S |
| E3.4 | **Que el vínculo se note en la pelea.** Ya da ventajas de combate:<br>• rango 3, ataque de seguimiento y movimientos en pareja;<br>• rango 5, el Relevo y «Lo muevo yo»;<br>• rango 8, Aguantar: se interpone y te deja a 1 PG;<br>• rango 10, su habilidad definitiva.<br>Pero apenas se ven. Hay que:<br>• **anunciarlas cuando saltan**, con una frase del compañero y un efecto;<br>• **ponerlas en su ficha** (por ejemplo «Con vínculo 5: Relevo»);<br>• **comprobar en el navegador** que cada una salta jugando, y que la del rango 10 está hecha;<br>• **llenar el hueco del rango 7** con un movimiento en pareja propio, con nombre y su animación en la barra de combate. | ✅ | Cosecha propia (como *Persona*) | M |

## E4 · Compañeros con roce

Las relaciones son el foco de D-J58.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E4.1 | **Que desaprobar tenga consecuencias.** `companion-opinions.js` ya cuenta lo que les gusta y lo que no. Con mucha desaprobación, un mercenario pide más paga, no hace ataques en pareja o se va del gremio.<br>**Hecho (2026-10-03):** cuenta lo de las dos últimas semanas. Con −2, **molesto**: no hace ataques en pareja, ni su jugada ni el ataque de seguimiento, y su ficha lo dice. Con −3, un mercenario **pide más paga** esa noche junto al fuego, con sus palabras. Puedes subirle 10 de oro a la semana (o darle una paga extra si no hay cuenta semanal), convencerle con Persuasión CD 13 o dejarle ir. Si no le convences, **se va del gremio**. Pagarle le quita el enfado. Está en `grudges.js` y `party/roce.js`. | ✅ | Normal en juegos de grupo | M |
| E4.2 | **Discusiones junto al fuego:** dos compañeros con rasgos opuestos discuten (`pair-talks.js`) y tú decides a quién das la razón, con su efecto en el vínculo. Después de una incursión dura, la hoguera es el momento fuerte del día. Escrito como conversación (D-J60).<br>**Hecho (2026-10-03):** antes de dormir, en la posada o en el campamento, va antes que lo demás de la noche. Si hoy hubo un roce, discuten por lo que se hizo, cada uno con lo que busca. Tras un día duro (alguien muerto, alguien en las últimas o dos a media vida), uno quiere seguir y otro volver. Tú das la razón a uno, que se acerca a ti y se le pasa el enfado (E4.1), y el otro se aleja. O les pides que lo dejen y hacen las paces. Está en `campfire-arguments.js`. | ✅ | — | M |
| E4.3 | **Misiones personales para los mercenarios contratados:** una cadena corta de 2 o 3 pasos al llegar al vínculo 3, como recuperar una herencia o vengar a un familiar. Hoy solo la tienen Gerd, Nella y Osric, y las que traiga cada campaña. Es en parte procedural (G2.1 de [[ROADMAP_AUTOMATIZAR]]), pero sirve ya en las campañas de ahora.<br>**Hecho (2026-10-03):** al llegar al vínculo 3, cada mercenario sin misión escrita tiene la suya, hecha para él y siempre la misma. Hay tres clases: **una herencia** (su tío le dejó la casa y un primo se la ha quedado), **una venganza** (quien mató a su hermano se esconde en una aldea) y **un rescate** (su hermana pica piedra por una deuda ya pagada). Cada una tiene un camino de 2 o 3 días, una escena con decisión (tirada, pagar o pelear), su pelea y 2 o 3 finales. Esa noche te la pide él junto al fuego, y se juega desde su ficha como las de Gerd, Nella y Osric. Está en `merc-quests.js`. | ✅ | — | M |

**Por decidir (E4):**
- **Quién se va.** Hoy solo se va del gremio un mercenario que pide más paga y no le convences. Que un compañero harto se vaya sin más sigue tras el interruptor de la pausa («Se van»), y nunca un contratado. ¿Lo dejamos así?
- **Cuánto pide.** Pide 10 de oro más a la semana; sin cuenta semanal, una paga extra de 15 + 5 por nivel. Persuasión CD 13. Molesto con −2 y pide paga con −3, contando las dos últimas semanas. Son de cosecha propia.
- **Las misiones de los veteranos (E8.6)** siguen siendo un encargo suelto del tablón. ¿Les ponemos también una misión de tres pasos?
- **Caras (hecho en parte, 2026-10-04).** En la escena de su misión, el mercenario sale con su retrato (el de relleno de su clase si no tiene uno propio), el salteador de la venganza con el bandido del camino y el hermano de la cantera con el campesino. El primo o la prima, el prestamista y la hermana de la cantera siguen con silueta: están en `PIXELLAB_PENDIENTE.md` y salen solos en cuanto se dibujen. Los nombres de esta gente ya no coinciden con nadie que tenga retrato (Elvira, Brígida).

## E5 · El gremio que paga

Que la base dé ventajas reales en el campo.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E5.1 | **Lo que dan los edificios:**<br>• la forja templa la armadura (+1 CA en la próxima expedición) o mezcla materiales (`forge.js`);<br>• la cocina prepara raciones con ventaja en una salvación o un dado de golpe más;<br>• la biblioteca vende o estudia libros de monstruos que dicen sus resistencias antes de salir. | ✅ | Mejoras temporales: cosecha propia moderada | M |
| E5.2 | **El banquillo se usa:** heridas que tardan días en la enfermería (`injuries.js` ya cura por días, D-J12) y cansancio de expedición, para que roten los compañeros. | ✅ | Sí: agotamiento; el resto, a la manera de *Darkest Dungeon* | M |
| E5.3 | **Mandar compañeros a encargos:** `dispatch.js` manda a gente del banquillo a encargos menores mientras juegas la historia, y vuelven días después con oro, fama o heridas. Comprobar que se puede jugar y que se ve. Al volver, te esperan en el gremio con una tarjeta de informe contada por ellos: lo que ganaron, un mapa o una anécdota. | ✅ | — | S |

> **Hecho (2026-10-03):** en la Casa del Gremio, «Los edificios» ofrece templar la armadura (+1 CA hasta volver), el caldo fuerte (ventaja en la primera salvación) o el guiso de camino (un dado de golpe más) y los libros de bichos de cada campaña del tablón, que salen en la tarjeta del enemigo. En «Tu gente», «Quién está para salir»: cada uno dice cómo está; quien encadena salidas vuelve *cansado del camino* (una herida de días) y la enfermería cura el doble a quien se queda en casa. Desde ahí, o desde «Encargos del tablón», se manda a alguien de casa a un encargo menor; al volver lo cuenta en una escena corta (el oro, un camino nuevo en el mapa o lo que pasó). **Hecho (2026-10-04):** en la casa, «Mezclar materiales en la forja» convierte lo cazado en una capa de pieles o en el arma a +1 (las recetas del herrero de los pueblos, pagadas del arca), y la ficha del héroe y la tarjeta de cada compañero dicen lo preparado en casa (el temple y el caldo o el guiso). Lo decide Daniel: los números del temple, las raciones y el cansancio (cosecha propia).

## E6 · El camino entre campañas

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E6.1 | **El viaje con decisiones:** a Barovia son 9 días y hoy es casi un salto. Cada 2 o 3 días, una tarjeta con una decisión:<br>• un puente caído (rodeo de 2 días o Atletismo arriesgando provisiones);<br>• la ventisca (apretar el paso y cansarse, o acampar y gastar raciones);<br>• un mercader con objetos raros o mapas.<br>**Hecho (2026-10-03):** en viajes de 3 días o más, cada 2 o 3 días uno de los tuyos para la marcha y pregunta en la novela, con su cara (`world/road-cards.js`, `party/road-choices.js`). Lo que pasa lo dice quien lo hizo. Y por el camino ahora se come una ración por cabeza y día (antes un viaje de 9 días mataba de hambre). | ✅ | Normal: viajes y encuentros de camino | M |
| E6.2 | **Papeles de noche en el campamento:** a la guardia de hoy se suman el cocinero (más vida al comer) y el erudito (identifica objetos y copia conjuros). Y quien examina el botín. La formación (J7.4) ya tiene guardia, guía y cura.<br>**Hecho (2026-10-03):** en la ficha de acampar, «Mientras los demás duermen»: quién cocina (Supervivencia; si sale, todos los dados de golpe y un día más de cura para las heridas), quién estudia (Investigación; identifica hasta 3 cosas y copia un pergamino si sabe) y quién examina el botín (Investigación; oro de las peleas ganadas desde la última vez). También se eligen en «Formación y papeles». Lo dice cada uno (`campaign/camp-roles.js`). | ✅ | Cosecha propia ligera | S |

## E7 · Sin fricción aburrida

Es la fase G5 de [[ROADMAP_AUTOMATIZAR]], que se puede adelantar.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E7.1 | **«Explorar hacia delante»:** el grupo avanza en formación y se para en seco ante una trampa, un cofre, una puerta o un enemigo. | ✅ | — | M |
| E7.2 | **«Resolver rápido»** las peleas triviales: dos ratas a nivel 5 se resuelven al instante con las reglas de siempre y cuestan un par de PG. `quick-sim.js` ya existe, del taller. | ✅ | — | S |
| E7.3 | **Equipar lo mejor con un clic** a cada compañero, según su clase y lo que domina. | ✅ | — | S |
| E7.4 | **Subir de nivel recomendado** y preparar conjuros según el papel (G5.4 y G5.6). Al despertar, el cuadro de preparar de tu héroe sale ya marcado con lo de su papel y lo dice; lo puedes cambiar. | ✅ | — | S |

---

## Lo que ya está y no hace falta

- **Los horarios del pueblo** (`hours.js`, D-J29): las tiendas abren y cierran, y quién está dónde depende de la hora.

## E8 · La larga vida: el techo de nivel, el relevo y la gente que se gasta

*Lo planteaste el 2026-10-03. Con campañas largas, el héroe llega al nivel máximo; y la gente escrita como en *Persona* cuesta mucho de hacer, así que no puede haber muchos.*

**Decidido (D-J64):**
- **Retirarse al gremio** (E8.3), no resetear al nivel 1.
- **Los confidentes pueden morir.** Como cualquiera, con las salvaciones de muerte, y se les puede resucitar en el templo pagando, con secuela (E8.7).
- **Modo duro opcional:** la muerte de un confidente es para siempre, sin resurrección.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E8.1 | **Campañas por tramos de nivel**, como las aventuras oficiales: 1-4, 5-10, 11-16 y 17-20. El tablón ofrece las de tu tramo y el ajuste de D-J56 hace el resto. Las cortas y las largas caben en cualquier tramo. | ✅ | Sí: los cuatro tramos de juego | S |
| E8.2 | **Después del nivel 20, dones épicos** en vez de niveles: cada «nivel» de experiencia de más da un don (2024 los trae en el nivel 19 y la guía del máster sigue después). El techo no corta el progreso. | ✅ | Sí: dones épicos | M |
| E8.3 | **Retirarse al gremio en vez de reiniciar.** Un héroe alto se queda como maestro: sube el nivel con el que empiezan los nuevos, enseña una dote, da una ventaja al gremio y va al Salón de la fama. Empiezas otro héroe con ventaja: se juega de nuevo sin perder lo ganado. | ✅ | Cosecha propia, al estilo *Darkest Dungeon* | M |
| E8.4 | **Dos capas de gente.** Pocos **confidentes** escritos (como *Persona*), que son el corazón. Muchos **mercenarios** generados, baratos y siempre disponibles.<br>*Hecho:* cada semana del juego pasan por el gremio tres **mercenarios de paso** (en «Contratar», bajo los de siempre): nombre de la batería de nombres y un mote, clase de 5e con retrato de relleno de su especie, nivel cercano al tuyo, un rasgo y cómo se presentan, dicho por ellos. Cuestan 25 de oro por nivel (los de siempre, 40), con las cuatro razones de E8.5. La misma semana, la misma gente (semilla de la partida); el contratado se guarda en el grupo con lo suyo. Sin misión personal ni romance hasta que son veteranos (E8.6). | ✅ | Cosecha propia | S |
| E8.5 | **Por qué llevar mercenarios:**<br>• **riesgo:** a la mazmorra peligrosa no quieres llevar a Nella;<br>• **disponibilidad:** los confidentes tienen su vida, sus horarios, sus heridas, y a veces no quieren ir (desaprobación, E4.1);<br>• **oficio:** un mercenario trae justo lo que falta (trampas, curas);<br>• **coste:** cobran cada semana, los confidentes no. | ✅ | — | M |
| E8.6 | **Veteranos que se ganan su historia.** Un mercenario que sobrevive varias expediciones gana un apodo, un rasgo, un recuerdo de lo que vivió con el grupo y una misión corta generada (E4.3). El cariño sale de jugar, no de escribir: como los soldados de *XCOM*. | ✅ | — | M |
| E8.7 | **La muerte cuenta, pero se puede deshacer pagando.** Las salvaciones de muerte de siempre; resucitar en el templo cuesta oro y diamantes y deja una secuela. Los mercenarios mueren de verdad; un confidente caído queda malherido semanas, y solo muere si lo arriesgas en un final. Un **modo duro** opcional con muerte permanente para todos. | ✅ | Sí: Revivir y Resurrección cuestan componentes caros | M |

## Lo que se descartó o se corrigió del análisis del 2026-10-03

- **El flujo social de *Persona*** (Palanca 1) ya está en marcha como D-J63, en [[ROADMAP_SIN_CONEXION]].
- **«El vínculo no se nota en el combate»:** sí da ventajas (E3.4), pero no se ven. Por eso no se cambian los rangos: se hacen visibles y se rellena el rango 7.
- **Los «estados de ánimo» de los retratos** están apagados por ahora (D-J61, ver [[LO_OCULTO]]).

## Por dónde empezaría

1. **E1.1 (otras victorias) y E1.2 (empujar donde duele):** cambian cada pelea escrita sin reglas nuevas. Además se pueden meter ya al escribir las tres campañas experimentales.
2. **E3.1 (que las reglas encadenen) y E7.2 (resolver rápido):** son pequeños y se notan mucho.
3. **E2.1 (la luz) y E2.3 (acampar con riesgo):** son la base del desgaste en la mazmorra.
4. **Lo demás, en el orden que salga de tus partidas.**
