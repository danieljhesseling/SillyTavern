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

---

## E1 · El tablero que se usa

Que el entorno cuente en la pelea, no solo los golpes.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E1.1 | **Más que «matar a todos».** El motor ya sabe llegar a un sitio, aguantar, proteger a alguien y jugar por rondas, pero ninguno de los 44 tableros escritos lo usa. Ideas para usarlo:<br>• **escapar:** llegar a las casillas de salida antes de la ronda 5;<br>• **interrumpir un ritual:** romper los dos cristales antes de que el nigromante acabe;<br>• **defender:** aguantar 4 turnos en la puerta de la cripta;<br>• escapar o accionar una palanca antes de la ronda 6;<br>• proteger a alguien frente a oleadas de refuerzos;<br>• robar el cofre y llegar a la salida sin despertar a los guardias. | 🟡 | Normal en aventuras | M |
| E1.2 | **Empujar donde duele:** fosos, precipicios, agua honda y trampas en el borde, para que empujar o derribar valga la pena. Empujar ya existe (maestría Empujar y golpe sin armas), y las alturas y el agua honda también; faltan tableros pensados para eso. | 🟡 | Sí: daño de caída 1d6 por cada 10 pies | M |
| E1.3 | **Superficies que reaccionan:** fuego que prende las coberturas de madera (`living-terrain.js`), aceite que arde, hielo y barro que piden una salvación de Destreza o te dejan derribado o frenado. También barriles de pólvora que estallan con fuego y agua que lleva el rayo a quien la pisa. | 🟡 | Sí: Grasa, aceite ardiendo, terreno difícil | M |
| E1.4 | **Cosas que se derrumban:** derribar una columna o una estantería sobre dos casillas, con daño contundente y quizá derribados. | ⬜ | Cosecha propia, como regla de máster | M |
| E1.5 | **Puzles y mecanismos en el tablero:** estatuas donde poner gemas encontradas, baldosas con runas que se pisan en orden, palancas emparejadas en los dos extremos del mapa. | ⬜ | Normal en mazmorras | M |

## E2 · La mazmorra que pesa (riesgo y desgaste)

Que explorar tenga coste, como en *Darkest Dungeon* o *Etrian Odyssey*.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E2.1 | **La luz cuenta.** Hoy la oscuridad solo se dibuja (`draw-light.js`). Con las reglas: en la penumbra, desventaja a Percepción para ver trampas; a oscuras, como cegado; quien tiene visión en la oscuridad ve. Una antorcha ocupa una mano y se gasta. Luz (J19.10) ya ilumina. | 🟡 | Sí: visión, penumbra y oscuridad son reglas de 5e | M |
| E2.2 | **Forzar cerraduras con riesgo:** fallar hace ruido y despierta la sala de al lado, y fallar por mucho rompe las ganzúas. | 🟡 | El ruido sí; romper la herramienta es cosecha propia | S |
| E2.3 | **Acampar en territorio hostil:** posibilidad de emboscada de noche. La guardia (la formación, J7.4) y su Percepción pasiva deciden si os sorprenden. Quien duerme lo hace sin armadura pesada. | 🟡 | Sí: descanso interrumpido y encuentros aleatorios | M |
| E2.4 | **Seguir o volver.** El dilema de *Darkest Dungeon*: curarse y descansar cuesta algo de verdad. El descanso corto gasta tiempo; el largo, en la mazmorra, pide raciones y arriesga emboscada (E2.3); los kits de curandero se acaban. Tras cada sala, una decisión clara: seguir con media vida o volver al gremio perdiendo el día. | 🟡 | Sí: descansos, raciones y kits de curandero | M |

## E3 · El grupo y sus combos

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E3.1 | **Comprobar que las reglas encadenan solas:** si el guerrero derriba a alguien, los ataques cuerpo a cuerpo contra él tienen ventaja; si el pícaro ataca con ventaja, mete su ataque furtivo. Que se vea en el resumen («Furtivo: +2d6, está derribado»). | 🟡 | Sí, son reglas de 5e | S |
| E3.2 | **Combos de vínculo para todos:** `pair-moves.js` (vínculo 3) ya existe; ampliarlo a más parejas y papeles. | 🟡 | Cosecha propia | M |
| E3.3 | **«Imbuir el arma de un aliado»** con un truco de luz o fuego. En 5e no existe como truco; lo más cercano es el conjuro Arma elemental (nivel 3). Propuesta: usar los conjuros que ya hay antes que inventar uno. | ⬜ | Inventado: lo decides tú | S |
| E3.4 | **Que el vínculo se note en la pelea.** Ya da ventajas de combate:<br>• rango 3, ataque de seguimiento y movimientos en pareja;<br>• rango 5, el Relevo y «Lo muevo yo»;<br>• rango 8, Aguantar: se interpone y te deja a 1 PG;<br>• rango 10, su habilidad definitiva.<br>Pero apenas se ven. Hay que:<br>• **anunciarlas cuando saltan**, con una frase del compañero y un efecto;<br>• **ponerlas en su ficha** (por ejemplo «Con vínculo 5: Relevo»);<br>• **comprobar en el navegador** que cada una salta jugando, y que la del rango 10 está hecha;<br>• **llenar el hueco del rango 7** con un movimiento en pareja propio, con nombre y su animación en la barra de combate. | 🟡 | Cosecha propia (como *Persona*) | M |

## E4 · Compañeros con roce

Las relaciones son el foco de D-J58.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E4.1 | **Que desaprobar tenga consecuencias.** `companion-opinions.js` ya cuenta lo que les gusta y lo que no. Con mucha desaprobación, un mercenario pide más paga, no hace ataques en pareja o se va del gremio. | 🟡 | Normal en juegos de grupo | M |
| E4.2 | **Discusiones junto al fuego:** dos compañeros con rasgos opuestos discuten (`pair-talks.js`) y tú decides a quién das la razón, con su efecto en el vínculo. Después de una incursión dura, la hoguera es el momento fuerte del día. Escrito como conversación (D-J60). | 🟡 | — | M |
| E4.3 | **Misiones personales para los mercenarios contratados:** una cadena corta de 2 o 3 pasos al llegar al vínculo 3, como recuperar una herencia o vengar a un familiar. Hoy solo la tienen Gerd, Nella y Osric, y las que traiga cada campaña. Es en parte procedural (G2.1 de [[ROADMAP_AUTOMATIZAR]]), pero sirve ya en las campañas de ahora. | 🟡 | — | M |

## E5 · El gremio que paga

Que la base dé ventajas reales en el campo.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E5.1 | **Lo que dan los edificios:**<br>• la forja templa la armadura (+1 CA en la próxima expedición) o mezcla materiales (`forge.js`);<br>• la cocina prepara raciones con ventaja en una salvación o un dado de golpe más;<br>• la biblioteca vende o estudia libros de monstruos que dicen sus resistencias antes de salir. | 🟡 | Mejoras temporales: cosecha propia moderada | M |
| E5.2 | **El banquillo se usa:** heridas que tardan días en la enfermería (`injuries.js` ya cura por días, D-J12) y cansancio de expedición, para que roten los compañeros. | 🟡 | Sí: agotamiento; el resto, a la manera de *Darkest Dungeon* | M |
| E5.3 | **Mandar compañeros a encargos:** `dispatch.js` manda a gente del banquillo a encargos menores mientras juegas la historia, y vuelven días después con oro, fama o heridas. Comprobar que se puede jugar y que se ve. Al volver, te esperan en el gremio con una tarjeta de informe contada por ellos: lo que ganaron, un mapa o una anécdota. | 🟡 | — | S |

## E6 · El camino entre campañas

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E6.1 | **El viaje con decisiones:** a Barovia son 9 días y hoy es casi un salto. Cada 2 o 3 días, una tarjeta con una decisión:<br>• un puente caído (rodeo de 2 días o Atletismo arriesgando provisiones);<br>• la ventisca (apretar el paso y cansarse, o acampar y gastar raciones);<br>• un mercader con objetos raros o mapas. | 🟡 | Normal: viajes y encuentros de camino | M |
| E6.2 | **Papeles de noche en el campamento:** a la guardia de hoy se suman el cocinero (más vida al comer) y el erudito (identifica objetos y copia conjuros). Y quien examina el botín. La formación (J7.4) ya tiene guardia, guía y cura. | 🟡 | Cosecha propia ligera | S |

## E7 · Sin fricción aburrida

Es la fase G5 de [[ROADMAP_AUTOMATIZAR]], que se puede adelantar.

| ID | Idea | Hoy | D&D | Tamaño |
| :--- | :--- | :---: | :--- | :---: |
| E7.1 | **«Explorar hacia delante»:** el grupo avanza en formación y se para en seco ante una trampa, un cofre, una puerta o un enemigo. | ⬜ | — | M |
| E7.2 | **«Resolver rápido»** las peleas triviales: dos ratas a nivel 5 se resuelven al instante con las reglas de siempre y cuestan un par de PG. `quick-sim.js` ya existe, del taller. | 🟡 | — | S |
| E7.3 | **Equipar lo mejor con un clic** a cada compañero, según su clase y lo que domina. | ⬜ | — | S |
| E7.4 | **Subir de nivel recomendado** y preparar conjuros según el papel (G5.4 y G5.6). | ⬜ | — | S |

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
| E8.1 | **Campañas por tramos de nivel**, como las aventuras oficiales: 1-4, 5-10, 11-16 y 17-20. El tablón ofrece las de tu tramo y el ajuste de D-J56 hace el resto. Las cortas y las largas caben en cualquier tramo. | 🟡 | Sí: los cuatro tramos de juego | S |
| E8.2 | **Después del nivel 20, dones épicos** en vez de niveles: cada «nivel» de experiencia de más da un don (2024 los trae en el nivel 19 y la guía del máster sigue después). El techo no corta el progreso. | ⬜ | Sí: dones épicos | M |
| E8.3 | **Retirarse al gremio en vez de reiniciar.** Un héroe alto se queda como maestro: sube el nivel con el que empiezan los nuevos, enseña una dote, da una ventaja al gremio y va al Salón de la fama. Empiezas otro héroe con ventaja: se juega de nuevo sin perder lo ganado. | ⬜ | Cosecha propia, al estilo *Darkest Dungeon* | M |
| E8.4 | **Dos capas de gente.** Pocos **confidentes** escritos (como *Persona*), que son el corazón. Muchos **mercenarios** generados, baratos y siempre disponibles. | 🟡 | — | — |
| E8.5 | **Por qué llevar mercenarios:**<br>• **riesgo:** a la mazmorra peligrosa no quieres llevar a Nella;<br>• **disponibilidad:** los confidentes tienen su vida, sus horarios, sus heridas, y a veces no quieren ir (desaprobación, E4.1);<br>• **oficio:** un mercenario trae justo lo que falta (trampas, curas);<br>• **coste:** cobran cada semana, los confidentes no. | ⬜ | — | M |
| E8.6 | **Veteranos que se ganan su historia.** Un mercenario que sobrevive varias expediciones gana un apodo, un rasgo, un recuerdo de lo que vivió con el grupo y una misión corta generada (E4.3). El cariño sale de jugar, no de escribir: como los soldados de *XCOM*. | ⬜ | — | M |
| E8.7 | **La muerte cuenta, pero se puede deshacer pagando.** Las salvaciones de muerte de siempre; resucitar en el templo cuesta oro y diamantes y deja una secuela. Los mercenarios mueren de verdad; un confidente caído queda malherido semanas, y solo muere si lo arriesgas en un final. Un **modo duro** opcional con muerte permanente para todos. | 🟡 | Sí: Revivir y Resurrección cuestan componentes caros | M |

## Lo que se descartó o se corrigió del análisis del 2026-10-03

- **El flujo social de *Persona*** (Palanca 1) ya está en marcha como D-J63, en [[ROADMAP_SIN_CONEXION]].
- **«El vínculo no se nota en el combate»:** sí da ventajas (E3.4), pero no se ven. Por eso no se cambian los rangos: se hacen visibles y se rellena el rango 7.
- **Los «estados de ánimo» de los retratos** están apagados por ahora (D-J61, ver [[LO_OCULTO]]).

## Por dónde empezaría

1. **E1.1 (otras victorias) y E1.2 (empujar donde duele):** cambian cada pelea escrita sin reglas nuevas. Además se pueden meter ya al escribir las tres campañas experimentales.
2. **E3.1 (que las reglas encadenen) y E7.2 (resolver rápido):** son pequeños y se notan mucho.
3. **E2.1 (la luz) y E2.3 (acampar con riesgo):** son la base del desgaste en la mazmorra.
4. **Lo demás, en el orden que salga de tus partidas.**
