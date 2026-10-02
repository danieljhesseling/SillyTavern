---
title: Roadmap — Jugar sin conexión
tags: [roadmap, sin-conexion, sin-ia, gremio, campanas, multijugador, personaje, historia]
created: 2026-09-28
updated: 2026-09-28
author: DanielJHesseling / Claude Opus 5.5
---

# 🏰 Jugar sin conexión: tu gremio, tus campañas, tus amigos

> **Qué es esto.** El plan para que el juego se juegue **entero sin IA**, contado por ti el 2026-09-28:
>
> 1. **Creas una partida y tu personaje**: nombre, especie y clase, lo normal de un juego de D&D.
> 2. **La historia empieza a contarse** un poco, para darle hilo.
> 3. **El gremio es la base.** Desde él se empiezan **campañas**: una historia con sus misiones, que llega en un JSON (por ejemplo, *Curse of Strahd*; me lo pasarás tú).
> 4. **El grupo va de una campaña a otra.** Lo que ganas se queda: niveles, equipo, oro, fama.
> 5. **Se juega con amigos**, en un servidor privado.
> 6. **La IA, después**, cuando el juego ya divierta.
>
> **De dónde sale.** De un repaso del código hecho el 2026-09-28, en tres partes:
> - el arranque y el contenido;
> - lo que ya funciona sin modelo;
> - los tableros, el mundo y el grupo.
>
> Lo que es un hecho del código lleva su archivo. Lo que es opinión, lo digo como opinión.
>
> **Las reglas que respeto.**
> - El motor decide.
> - Sin IA y sin tokens.
> - Nada de arte: CSS, iconos de Font Awesome y emoji.
> - La magia, solo en el código.
> - El contenido son datos que se editan sin programar.
> - El texto se entiende a la primera.
> - Después de cambios de pantalla, no toco [[GEM_DIRECTOR_UX]]: se lo enseñas tú con capturas.
>
> **Las campañas las traes tú.** El juego aprende a leer tu JSON, pero el texto de una campaña publicada no lo escribo yo. Es para jugar en privado entre amigos.
>
> **Cómo leer las tablas.**
> - **Quién**: **A** lo hago yo sin preguntar; **D** lo decides tú; **P** es una propuesta, opcional.
> - **Esf.** (esfuerzo): **S** cabe en una sesión; **M** son dos o tres; **L**, más.

---

## 📍 Cómo va (2026-10-02)

**Avance, sobre 149 filas activas** (sin lo aparcado ni las decisiones):
- **87 % jugable** (129 filas).
- **91 % construido** (136 filas).

Esto cuenta como hecho lo que está terminado y probado aunque aún no tenga commit: la partida es el gremio (J4.2), trabajos y ratos libres (J14.11) y las campañas del Gem (J5.2 a J5.6 y J12.5). Contando solo lo que tiene commit, es un 82 %.

| Hito | Jugable | Construido |
| :--- | :---: | :---: |
| M1 · Entrar y crear el personaje | 96 % | 100 % |
| M2 · El gremio y la primera campaña | 100 % | 100 % |
| M3 · El pueblo y su gente | 100 % | 100 % |
| M4 · Strahd con mapas y magia | 96 % | 100 % |
| M5 · Una campaña bien contada | 81 % | 91 % |
| M6 · Los compañeros a fondo | 80 % | 100 % |
| M7 · En el móvil | 78 % | 100 % |

**En marcha ahora (2026-10-02): modo cerrar, siete agentes.** Lo pediste así: «céntrate en acabar cosas». Cada agente solo hace los pasos que le quedan:
- solo sabes el nombre de quien se ha presentado, y el narrador sin placa (J13.7);
- textos y reacciones más humanos (J13.8), que además arregla las dos pruebas del prólogo;
- Strahd de punta a punta (M4);
- historias en tres actos para las campañas sin hilo escrito (J10.7);
- el contenido que falta: salidas habladas, cosas que mirar y trampas;
- el calabozo (D-J47), con «Continuar» de vuelta al sitio cuando el tablero está vacío;
- la pelea que empieza sola y el movimiento (J12.16, J12.17): el mar no se cruza, el camino va recto y las diagonales cuestan 5, 10, 5.

Después: revisar que lo escrito vaya en conversaciones y no en el narrador (D-J54), hacer el commit y recontar.

**En pausa, con su avance guardado en su `progreso.md`**, para retomarlos en grupos pequeños:
1. **El tablero nuevo:**
   - el lienzo y la cámara (J12.14);
   - la barra de acciones de 2024 (J12.15), que llevaba 5 de 14 pasos.
2. **El romance (J14.10):** 24 de 36.
3. **El teclado (J15.5):** 21 de 37.
4. **Las notas del juego (J13.1, J18.10):** con D-J54 las dirá la gente en vez del narrador.
5. **Peleas de taberna y duelos (J12.7).**
6. **1387 de punta a punta y las vueltas automáticas (J9.1, J16).**
7. **El arte nuevo.**
8. **Más adelante:**
   - el móvil ligero y su guía (J20.6, J20.8), que esperan al tablero nuevo;
   - lanzar a más nivel (J19.3);
   - el APK.

**Cuando esto termine:** [[ROADMAP_AUTOMATIZAR]] reúne lo que hoy se hace a mano y se podría hacer con código: contar el avance, comprobar con una sola orden, encontrar lo construido sin enchufar, revisar los textos, pedir el arte que falta, vueltas de noche y el APK.

**Jugar con amigos (J6) está aparcado** hasta nueva orden (lo dijiste el 2026-09-28). Tampoco hay más personajes que los mercenarios sencillos del gremio.

Cómo está hecho, en corto (el detalle, en [[EMPEZAR_UNA_CAMPANA]], «Jugar sin conexión»):
- **El gremio es un mundo pequeño** (`public/mundos/gremio.pack.json`) con su chat. Cada campaña del tablón es su propio mundo y su propio chat, como siempre. Lo que las une es **el grupo**: viaja entero de un chat a otro (`campaign/hub.js`).
- **Las partidas del gremio las cuenta el motor**, aunque haya un proveedor conectado.
- **Tu JSON de Strahd** está en `wiki/campanas/strahd/original.json`, tal cual. Lo que escribí del libro va en `libro.json`, lo que le puse para jugarlo en `mejoras.json`, y `tools/campana-a-paquete.mjs strahd` junta los tres.

| Fase | Estado | En una línea |
| :--- | :---: | :--- |
| **J0** · La puerta | ✅ | El botón en la portada, el modo motor, sin la ventana del nombre (J0.2), el narrador sin ficha (J0.3), las opciones del juego (J0.4), «Continuar» (J0.5), «Cargar partida» con partidas (J0.6), y arrancar con doble clic, `Jugar.bat`, con la guía del servidor privado, `wiki/SERVIDOR_PRIVADO.md` (J0.9) |
| **J1** · Tu personaje | ✅ | Tarjetas (J1.1), atributos (J1.2), equipo por clase (J1.3), el género del texto (J1.4), el personaje dura (J1.5), varios personajes (J1.6), la ficha legible (J1.7) y tu cara sin arte: iniciales con color, icono o emoji (J1.8, D-J52) |
| **J2** · El prólogo | ✅ | El prólogo entero, como paquete (J2.1, J2.4): llegas al muelle de Puerto Alba, un ratero, una pelea pequeña, la charla con Tomás, Brunilda y la prueba de la bodega. Los consejos de la primera vez, uno a uno (J2.2), y saltarlo entero (J2.3; falta un enganche para que el salto no deje la pelea del muelle a la vista) |
| **J3** · El pueblo y el gremio, tu base | ✅ | Puerto Alba con su pantalla del pueblo (J3.11) y la sala del gremio por salas (J3.1). El tablón (J3.2), dormir y guardar (J3.3), el cofre (J3.4), entrenar y subir de nivel (J3.5), forja, biblioteca, dormitorios y establo (J3.6), rango y renombre (J3.7), encargos (J3.8) y el Salón de la fama (J3.9) |
| **J4** · Las campañas | ✅ | Empezar desde el tablón (J4.3), volver y retomar (J4.4), terminar con epílogos (J4.5), nivel recomendado y enemigos ajustados (J4.6), 1387 (J4.7), varias a la vez (J4.8), el viaje contado (J4.9). La partida es el gremio: el mismo gremio en todas las campañas, y las partidas de antes siguen cargando (J4.2, sin commit) |
| **J5** · Tu JSON de campañas | ✅ | El conversor (J5.1) e importar desde el gremio (J5.4). Sin commit: el contrato ampliado, con trampas (J5.2), los huecos que rellena el motor (J5.3), los dos formatos del Gem (J5.5) y el informe antes de jugar (J5.6) |
| **J6** · Jugar con amigos | ⏸️ | Aparcado |
| **J7** · El grupo | ✅ | Tu grupo (J7.1), compañeros que se quedan en el gremio (J7.2), «Lo muevo yo» con vínculo 5 (J7.3), formación y papeles (J7.4) y opiniones a la vista en lo importante (J7.5, D-J48) |
| **J8** · Hablar sin IA | ✅ | Diálogos con ramas al pulsar «Hablar» (J8.1 a J8.4, J8.6, D-J36) y salir de una pelea hablando (J8.5) |
| **J9** · La historia de cada campaña | 🟡 | Escenas del hilo (J9.2), capítulos (J9.3), finales (J9.4) y el Diario como un libro (J9.6). Los plazos están hechos pero apagados (J9.5, D-J46). En pausa: 1387 entero sin conexión (J9.1) |
| **J10** · El mundo de cada campaña | 🟢 | Caminos por reputación y llaves (J10.1), cada sitio con algo que hacer (J10.2), sucesos por facción (J10.3), secretos (J10.4), el mapa dibujado (J10.5) y gente con horario (J10.6). Cerrándose: historias en tres actos para las campañas sin hilo escrito (J10.7) |
| **J11** · Decisiones que pesan | ✅ | Avisar de lo que no tiene vuelta atrás (J11.1), consecuencias días después (J11.2), el mundo se acuerda (J11.3; el calabozo, D-J47, cerrándose), de una campaña a otra (J11.4) y la crónica (J11.5) |
| **J12** · Tableros y peleas | 🟡 | Turnos (J12.1), salidas sin pelear (J12.2), trampas (J12.3), el grupo junto (J12.4), tableros del JSON (J12.5, sin commit), encuentros ajustados (J12.6), un mapa en imagen jugado con alturas y salas (J12.8 a J12.12) y tableros grandes (J12.13). El tablero como un VTT (J12.14 a J12.17): cerrándose la pelea que empieza sola y el movimiento; en pausa el lienzo y la barra de 2024. En pausa: peleas de taberna y duelos (J12.7) |
| **J13** · El texto del motor | 🟡 | El género (J13.3), frases medidas y variadas (J13.2, J13.4), frases de compañeros (J13.5) y la guía de estilo (J13.6). Cerrándose: solo sabes el nombre de quien se ha presentado (J13.7) y textos más humanos (J13.8). En pausa: las notas del juego (J13.1), que con D-J54 dirá la gente en vez del narrador |
| **J14** · La gente: charlas y quedadas | 🟢 | Charla corta, el día por partes, quedar, quién está libre, confidentes y compañeros de cada campaña (J14.1 a J14.6). Las noches y las charlas de pareja (J14.7, J14.8), las misiones personales (J14.9) y trabajos y ratos libres (J14.11, sin commit). En pausa: el romance (J14.10) |
| **J15** · Sentirse un juego | 🟢 | `party.js` partido (J15.1), guardar como un juego (J15.2), el registro (J15.3), comandos a botones (J15.4) y exportar e importar (J15.6). En pausa: teclado y accesibilidad (J15.5) |
| **J16** · Medir la diversión | ⬜ | En pausa: las vueltas automáticas (J16.1, J16.2, J16.4). La de dos jugadores (J16.3) va con J6, aparcado |
| **J17** · Después: la IA como capa | ⏸️ | Aparcado (lo dijiste el 2026-09-29) |
| **J19** · La magia de D&D | 🟢 | En juego: espacios, conocidos y preparados, concentración, invocaciones, zonas, reacciones, rituales, objetos mágicos, magia fuera de combate y enemigos que lanzan. Falta: lanzar a más nivel (J19.3), con la barra nueva |
| **J20** · Jugar desde el móvil | 🟢 | La pantalla en el móvil (J20.1), el tablero a toques (J20.2), botones de dedo (J20.3), sin teclado (J20.4), ventanas que caben (J20.5), el icono y el nombre «DnD Coin» (J20.7) y la prueba del móvil (J20.9). Esperan al tablero nuevo: ligero en el móvil (J20.6) y la guía (J20.8). Más adelante: el APK |
| **J18** · La cara del juego | 🟢 | Elegir personaje y crearlo, y la novela visual con su registro (J18.1 a J18.6). Sin chat, escenas por acciones, descansar como acción de sitio (J18.7 a J18.9). En pausa: sin etiquetas del motor en la caja (J18.10) |

---

## 🎲 0. El juego, en una página

### 0.1 Cómo se juega (tu descripción, 2026-09-29)

1. **Empiezas creando un personaje o eligiendo uno que ya tienes** (J18.1, J18.2).
2. **Empieza una historia estilo novela visual**: quien habla, grande y con su nombre; el texto en una caja ancha abajo, y lo que puedes hacer dentro de la caja (J2, J18).
3. **La pantalla principal es el pueblo** (aldea, ciudad o puerto). Te mueves por él con **un selector de sitios, como el de localizaciones**: la herrería, la taberna, la tienda, el templo y **el gremio, donde están las misiones** y el tablón de campañas. En cada sitio, quien lo atiende y lo que se puede hacer (J3.11).
4. **Aceptas una campaña y empieza la campaña.** Tiene **su propia historia**, también como novela visual, que es el hilo conductor entre sus arcos y sus luchas de tablero (J4, J9).
5. **Mientras estás en una campaña, es un mundo propio**, con su propia taberna y todo lo demás, igual que el pueblo principal y con la misma pantalla (J3.11). Es la **«b con sensación de a»** de D-J3: un mundo aparte, pero se nota que viajas a él desde tu pueblo y que vuelves (J4.9).
6. **Hablar con la gente es parte del juego.** Con los compañeros hay charla corta (*small talk*) al cruzarte con ellos, y **dedicas una parte del día a quedar** con alguien. Es un evento, como en *Persona*: una escena que os acerca (J14).
7. **Terminas la campaña** con uno de sus finales, y lo ganado vuelve contigo al pueblo: niveles, objetos, oro, fama y lo que el gremio recuerda (J4.5). Luego, otra campaña.

### 0.2 Tres capas

| Capa | Qué es | Qué hay ya |
| :--- | :--- | :--- |
| **El gremio** | La base que no cambia entre campañas. Vuestro hogar | Edificios, empleados, entrenamiento, rangos con renombre, lealtad y retiro (`campaign/guild.js`, `/gremio`). Posada, tienda, herrería y templo (`services.js`). La Mesa de la semana |
| **Las campañas** | Cada una, una historia con su tierra. Se empieza desde el gremio | Hoy **cada campaña es un mundo aparte** (su lorebook y su chat). El paquete de campaña (contrato v1), su importador y 1387 escrito entero (`campaign-pack.js`, `campaign-importer.js`) |
| **Los tableros** | Donde las cosas se resuelven: una pelea, una huida, una palanca | Combate táctico completo: 17 terrenos, cuatro perfiles de IA, jefes con fases, tregua, rendición y refuerzos (`combat/`, `board/`) |

### 0.3 Lo que cambia respecto a hoy

- **Hoy, cada campaña es una partida.** Crearla hace un mundo nuevo, con un chat nuevo y un personaje nuevo.
- **Con este plan, la partida es el gremio.** Las campañas se cargan dentro; tu personaje y el gremio duran de una a otra.
- Es **el cambio de fondo** de este plan, y es la fase J4.

### 0.4 La sensación que se busca (no el juego)

| De | Lo que se toma |
| :--- | :--- |
| **Una mesa de D&D con amigos** | Cada uno con su personaje; un grupo que dura campaña tras campaña; decidir entre todos |
| **Etrian Odyssey** | La base a la que se vuelve, que crece con lo que traéis. El gremio como vuestro grupo |
| **Baldur's Gate** | Compañeros con opinión; decisiones con consecuencia; una historia con varios finales |

---

## 🔍 1. Lo que hay hoy (mirado el 2026-09-28)

### 1.1 El arranque

| Qué | Cómo está |
| :--- | :--- |
| **¿Hace falta clave o conexión?** | **No.** Sin conexión, el narrador pasa solo a «Motor» (`narratorMode`, `party.js`). La vuelta sin modelo lo comprueba. Hace falta el servidor local (`server.js`): guarda los mundos, los chats y las fichas |
| **La portada** | `renderTitleMenu` (`ui/shell/game-shell.js:303`) ofrece: Partida nueva, Cargar partida, Compendio, Salón de la fama, Opciones y «Salir al SillyTavern de siempre». La cabecera dice «SillyTavern RPG» |
| **Lo de SillyTavern que se ve** | La primera vez, la ventana del nombre (`doOnboarding`, `script.js:8021`). El narrador es una ficha de personaje (`createNarratorCharacter`, `campaigns.js:697`). Las partidas son chats (la lista sale de `/api/chats/recent`). «Opciones» abre el panel de la API |
| **«Jugar sin conexión»** | No existe. Sin conexión se juega, pero nada lo dice |

### 1.2 Tu personaje

| Qué | Cómo está |
| :--- | :--- |
| **El creador** | `ui/hero-creator.js`. Solo el nombre es obligatorio. Especie y clase se escriben, con sugerencias del mundo (12 especies y 10 clases en el compendio). Trasfondo con efecto en las reglas (`backgrounds.js`) |
| **Héroes hechos** | Tres por mundo (`campaign/premade-heroes.js`) |
| **Crecer** | Subir de nivel con tarjetas: uno de tres dones, árboles de 3×3 por clase (`rules/level-perks.js`, `class-trees.js`). Forja, objetos con historia, heridas que quedan |
| **Entre campañas** | Hay una idea: **traer a un veterano** de otra partida (idea 179). Se ofrece al crear una campaña. Es el germen de «tu personaje dura» |

### 1.3 El gremio y los servicios

| Qué | Cómo está |
| :--- | :--- |
| **El gremio** | `campaign/guild.js`: edificios que abaratan el mantenimiento, empleados, entrenamiento con experiencia, rangos con renombre, lealtad de quien viene por dinero y retiro. Es opcional: se enciende con `/gremio` |
| **Servicios de un sitio** | Posada, herrería, tienda, templo y tablón, según el tipo de sitio y con su horario (`services.js`, `hours.js`). Tienda con existencias por semana, maestros que enseñan, mercenarios |
| **La semana** | La Mesa: cuentas, noticias y quién os busca (`week-table.js`, `economy.js`) |

### 1.4 Las campañas

| Qué | Cómo está |
| :--- | :--- |
| **El formato** | El paquete de campaña, contrato v1 (`campaign-pack-schema.js`): mundo, localizaciones, tableros, gente, confidentes, bestiario, objetos, misiones, encargos, rumores, habilidades y el hilo (hitos, finales y presagios). Se valida (`campaign-pack.js`) y se importa (`campaign-importer.js`) |
| **Cómo llega** | Por «Importar un libro» (pegar el JSON), o como «Un mundo hecho» que apunta a su paquete. El taller deja retocarlo antes de crear |
| **1387** | Escrito entero: 11 localizaciones, 22 personas, 5 confidentes, 19 tableros, 16 misiones, 15 encargos, 26 rumores y 18 hitos con 3 finales |
| **Sin modelo** | La vuelta llega del hito 1 al 4 de 1387 sin un silencio. **Del 5 al 18, sin probar** |
| **Dentro de una partida** | No se puede: cada campaña crea su propio mundo. **No hay forma de tener dos campañas en la misma partida** |

### 1.5 Jugar con otros

| Qué | Cómo está |
| :--- | :--- |
| **El servidor** | SillyTavern se puede abrir a la red (`listen` en `config.yaml`), con lista blanca de direcciones o contraseña (`whitelistMode`, `basicAuthMode`) |
| **Cuentas** | Tiene cuentas de usuario (`enableUserAccounts`, `src/users.js`), pero **cada cuenta tiene sus propios datos**: no comparten partida |
| **En vivo** | **No hay nada** para que varios vean la misma partida: ni conexión en vivo ni estado compartido |
| **La partida** | Todo el estado vive **en el navegador de quien juega** (unas 90 claves en el chat, `state-registry.js`) y se guarda en su chat. Para jugar varios, tiene que poder repartirse |

### 1.6 El texto sin modelo

| Qué | Cómo está |
| :--- | :--- |
| **El narrador del motor** | `engine-narrator.js`, con 133 filas en `compendio/frases.json`. No repite las 16 últimas frases |
| **Sucesos** | 23 tarjetas con decisiones (`compendio/sucesos.json`) |
| **La charla** | Temas que se ganan con relación o con una tirada; convencer, sonsacar, amenazar y la ronda (`talk.js`) |
| **La caja** | `read-box.js` entiende ir, entrar, hablar, preguntar, convencer, comprar, vender, descansar y verbos de habilidad |
| **Lo que se queda en «dato»** | De las 55 notas que escribe el juego (`postForModel`), solo unas pocas traen su versión en prosa |

### 1.7 Lo que falta, en una lista

1. Un botón y un camino que digan «sin conexión», sin nada de SillyTavern a la vista.
2. Un prólogo que lleve al gremio.
3. **La partida como gremio**, con campañas dentro (hoy, cada campaña es un mundo aparte).
4. **Leer tu JSON de campaña**, sea cual sea su forma.
5. **Varios jugadores en la misma partida**, cada uno desde su PC.
6. Diálogos con ramas escritos, y decisiones de grupo.
7. 1387 probado sin conexión del hito 5 al 18.
8. Las 55 notas del juego, en prosa.
9. Trampas y búsqueda fuera de combate: `searchCell` y `disarmHazard` (`board/hazards.js`) existen y nada los usa.
10. Guardar como un juego, con ranuras propias.
11. Una primera partida que enseñe (H1 de [[LO_QUE_FALTA]]).

---

## 🟠 2. Decisiones para ti

Van antes que nada: cada una cambia lo que se construye. Con cada una, lo que te recomiendo.

| # | Decisión | Opciones | Recomiendo |
| :---: | :--- | :--- | :--- |
| **D-J1** | **Cómo se juega con amigos** | (a) En el mismo PC, por turnos. (b) Cada uno desde su PC, **a la vez**: una partida que abre uno (el anfitrión) y a la que los demás se unen. (c) Cada uno desde su PC, **a su ritmo**, como por correo | **(b)**, y construido **por pasos** (J6): primero en el mismo PC, luego viendo la partida de otro y luego jugando cada uno la suya. Ver la sección 3, J6 |
| **D-J2** ✅ | **Quién decide** cuando el grupo tiene que elegir (una respuesta, adónde ir) | (a) Un líder, que puede cambiar. (b) Votación, con desempate del líder. (c) Lo que elija el primero | **Decidido: (b), el 2026-09-29.** En combate, cada uno su turno. Fuera, se propone y se vota; si no hay mayoría en un rato, decide el líder |
| **D-J3** ✅ | **La campaña y el gremio: ¿dónde están?** | (a) Cada campaña es una tierra a la que se viaja desde el gremio, y se vuelve. (b) Cada campaña es un mundo aparte al que se «entra» por una puerta del gremio | **Decidido: (b) con la sensación de (a), el 2026-09-29.** El tablón dice «Barovia, a nueve días», el viaje se cuenta, y al terminar volvéis. Técnicamente, la campaña no se mezcla con las otras (J4.9) |
| **D-J4** ✅ | **Qué dura entre campañas** | Personaje (nivel, dones, heridas), equipo, oro, fama del gremio, compañeros, lo que el gremio recuerda | **Decidido: todo dura, el 2026-09-29.** Personaje, equipo, oro, fama del gremio, compañeros y lo que el gremio recuerda. Si el juego se vuelve demasiado fácil, se verá entonces qué se hace |
| **D-J5** ✅ | **¿Se puede dejar una campaña a medias?** | (a) No: hasta que termine. (b) Sí: se vuelve al gremio y se retoma luego, donde estaba | **Decidido: sí (b), el 2026-09-29.** Se vuelve al gremio y se retoma donde estaba (ya funciona, J4.4) |
| **D-J6** ✅ | **El formato de las campañas** | (a) Tu JSON tal cual, con su propio lector. (b) Tu JSON convertido al paquete que el juego ya entiende | **Decidido: (b), el 2026-09-29.** Un conversor por formato; por dentro, un solo formato |
| **D-J7** ✅ | **Qué pasa con 1387** | (a) Se queda como mundo aparte. (b) Es la primera campaña del tablón | **Decidido: (b), el 2026-09-29.** 1387 es de las primeras campañas del tablón (ya lo está) |
| **D-J8** ✅ | **El prólogo** | (a) Uno fijo, escrito una vez. (b) Uno por especie o clase. (c) Nada: se empieza en el gremio | **Decidido: (a) para empezar, el 2026-09-29.** Uno fijo, corto y jugable: la prueba de la bodega del gremio |
| **D-J9** ✅ | **El nombre del juego** | La cabecera decía «SillyTavern RPG» | **«DnD Coin»**, por ahora (lo dijiste el 2026-09-30) |
| **D-J10** ✅ | **La vida en el gremio** (romance, charlas de compañeros) | (a) Parte del plan. (b) Después, opcional | **Decidido: (b), el 2026-09-29.** Primero, que sea jugable; lo social, en J14. **Matizado el mismo día**: charlar y quedar con los compañeros es parte del juego (M3); lo que va después y es opcional son los romances y las capas de encima (M6) |


### 2.1 Decididas el 2026-09-29 por la tarde

Tus respuestas a D-J11…D-J38. «⏳» significa que está por hacer.

| # | Qué | Lo que decidiste | |
| :---: | :--- | :--- | :---: |
| **D-J11** | Oro de cada personaje nuevo del gremio | 10 de oro a partir del segundo | ⏳ |
| **D-J12** | Los personajes que descansan en el gremio | Se curan con el paso de los días | ⏳ |
| **D-J13** | Varios personajes tuyos en la misma campaña | Uno por ahora; varios más adelante, con J7 | ✅ |
| **D-J14** | Dos personajes con el mismo nombre | No se puede: se avisa al crear el personaje | ⏳ |
| **D-J15** | Personajes no binarios en el texto | Como en D&D, el género no cambia ninguna regla. Lo que eliges es cómo te habla el texto: en masculino o en femenino. Se quitan las terceras formas | ⏳ |
| **D-J16** | Género de los mercenarios | Gerd y Osric, hombre; Nella, mujer | ✅ |
| **D-J17** | Frases en masculino de 1387 y Strahd | Que concuerden con el género de a quien se dirigen (`{…\|…}`), también en la sinopsis, las fichas, los rumores y las misiones | ⏳ |
| **D-J18** | Epílogos en el formato de tu Gem | Sí: un campo `epilogos` | ⏳ |
| **D-J19** | Nombre de la campaña en el Salón de la fama | El mismo que en el tablón | ⏳ |
| **D-J20** | Saltar la prueba | Da el botín y la experiencia, como si la hubieras ganado | ✅ |
| **D-J21** | Enemigos ajustados por nivel | Tope ×1,35, y no se duplican enemigos de CA 15 o más | ⏳ |
| **D-J22** | El nivel recomendado | Por acto, y que se vea bien el nivel recomendado de cada campaña: las hay que empiezan en el 10 y no son para gente sin experiencia | ⏳ |
| **D-J23** | Borrar un gremio desde «Cargar partida» | Sí, con una confirmación que diga todo lo que se borra | ⏳ |
| **D-J24** | El panel derecho vacío en la pausa | Esconderlo | ⏳ |
| **D-J25** | Materiales de conjuro | Venderlos en las tiendas y, después, exigirlos | ⏳ |
| **D-J26** | Nigromancia como delito | Solo las que dañan o levantan muertos | ⏳ |
| **D-J27** | El erudito | Lanza solo rituales, sin espacios | ⏳ |
| **D-J28** | Tablón y mercenarios en el prólogo | Escondidos hasta que acabe la prueba | ⏳ |
| **D-J29** | Horario de las tiendas | Las tiendas tienen horario, y cierran algunos días (fiestas, el día de descanso) | ⏳ |
| **D-J30** | Orden de los sitios de Puerto Alba | El gremio, primero | ⏳ |
| **D-J31** | ¿Comprar gasta una parte del día? | No, como en *Persona*: comprar dos pociones no te quita la tarde | ⏳ |
| **D-J32** | Mover a un compañero frente al modo «grupo» | El vínculo 5 manda en los dos modos | ⏳ |
| **D-J33** | Historias inventadas de los mercenarios | Las revisa un agente que sepa del tema | ⏳ |
| **D-J34** | Quedadas con la gente del pueblo | Más adelante, con J14.7 | ✅ |
| **D-J35** | Campañas importadas | En todos tus gremios; también pegando el texto; y un botón para quitarlas | ⏳ |
| **D-J36** | «Hablar» con alguien que tiene diálogo escrito | La ventana de ramas directamente, con «Otras cosas» para sonsacar, convencer y amenazar | ⏳ |
| **D-J37** | La fuente de 1387 | El paquete | ✅ |
| **D-J38** | La cabecera en el móvil | Que se vea bien | ⏳ |
| **D-J39** | ¿Una escena del hilo cumple su propio hito? | Sí, cuando la escena ya es esa charla (como la de Karl) | ⏳ |
| **D-J40** | ¿Todos los hitos se abren en la ventana de escena? | Sí: también los que solo traen texto, como una escena corta del narrador | ⏳ |
| **D-J41** | ¿La descripción de un sitio cuenta como «algo que mirar»? | No: cada sitio tiene algo concreto que examinar | ✅ |
| **D-J42** | Sucesos propios de cada campaña | Más adelante, con J10.3 | ✅ |
| **D-J43** | La actitud más alta («os mira de forma…») | «leal» | ✅ |
| **D-J44** | ¿Las partidas con conexión cambian como las de sin conexión (sin caja de texto ni pestañas)? | No: nada nuevo para el modo con conexión; es para el futuro y aún no está claro cómo será | ✅ |
| **D-J45** | Tras ganar una pelea en un tablero, ¿adónde lleva «Continuar»? | Depende de la situación: sigue el hilo, como en el juego normal. Si hay un suceso o una escena, a eso; en una campaña, a lo que toque en ella; si no, al tablero o al sitio donde estabas | ✅ |
| **D-J46** | Plazos a la vista (J9.5) | Desactivados por ahora; se activarán más adelante | ⏳ |
| **D-J47** | Robar dos veces en la misma tienda | Cuatro semanas sin venderte era mucho. En su lugar, la guardia te lleva: un par de días en el calabozo y lo robado requisado. Después la tienda vuelve a venderte, algo más cara unos días | ⏳ |
| **D-J48** | ¿Cuándo cuentan las opiniones de los compañeros? | Solo en las charlas importantes: las escenas del hilo y las decisiones con consecuencia | ⏳ |
| **D-J49** | La ficha «Magia» en la escena | Lo recomendado: sale cuando un conjuro sirve ahí mismo, y todos están en la ficha del personaje | ✅ |
| **D-J50** | Hablar con los muertos | Una vez cada 7 días por cadáver | ⏳ |
| **D-J51** | Luz bajo techo | No se ofrece donde ya hay luz (taberna, tienda, gremio…) | ⏳ |
| **D-J52** | Tu cara sin arte | Se puede elegir: iniciales con un color, un icono o un emoji | ⏳ |
| **D-J53** | Curar con magia al llegar de un viaje | El viaje pregunta si curas a quien está herido | ⏳ |
| **D-J54** | ¿Cuánto habla el narrador? | Casi nada. La historia se cuenta con conversaciones de novela visual entre la gente, con sus retratos, como en *Etrian Odyssey*. El narrador queda para una línea corta de ambiente o de paso del tiempo, y sin placa. Vale para las escenas, los sucesos, el calabozo y los hilos de las campañas sin historia escrita (J10.7) | ⏳ |

---

## 🧭 3. Las fases

### J0 · La puerta: «Jugar sin conexión»

**Para qué.** Que abrir la página sea abrir un juego. Hoy se juega sin conexión, pero para llegar hay que atravesar cosas de SillyTavern que no son el juego.

**Qué hay ya.**
- El Modo Juego arranca solo y tiene portada (`game-shell.js:303`).
- Sin conexión, el narrador pasa a «Motor» y los botones de IA se apagan (`campaigns.js:962`, `985`).
- Los héroes hechos permiten entrar en un minuto.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J0.1 | **El botón «Jugar sin conexión»**. Apunta un modo sin conexión que se recuerda: fuerza «Motor» aunque haya proveedor y esconde todo lo que pide modelo (lapicitos, «Otra vez», «Más corto», generar mundo, la varita) | A | S | e2e: con un proveedor configurado, el botón deja el juego en «Motor» y no aparece ningún botón de IA |
| J0.2 | **Sin la ventana del nombre de SillyTavern** la primera vez: tu nombre es el de tu personaje | A | S | e2e con datos nuevos: de la portada al personaje sin ninguna ventana de SillyTavern |
| J0.3 | **El narrador sin ficha a la vista.** La ficha sigue por debajo, pero nunca se enseña, ni sale el aviso de «no hay personaje» (`campaigns.js:797`) | A | M | e2e: ninguna tarjeta de personaje de SillyTavern a la vista |
| J0.4 | **Opciones del juego, no de SillyTavern**: modo de juego, sucesos, tamaño y velocidad del texto, daltonismo y sonido. Sin panel de API cuando no hay conexión | A | M | La pausa y la portada abren las opciones del juego |
| J0.5 | **«Continuar»** en la portada: la última partida, de un clic | A | S | e2e: cerrar y abrir la página, y «Continuar» vuelve donde estabas |
| J0.6 | **La lista de partidas propia**, con la tarjeta de guardado (`save-card.js`: día, sitio, lo que tienes entre manos) | A | M | «Cargar partida» enseña partidas, no chats |
| J0.7 | **«Unirse a una partida»** en la portada, para cuando exista J6 | A | S | Llega con J6 |
| J0.8 | **El nombre del juego** (D-J9) | D | S | — |
| J0.9 | **Arrancar con un doble clic**, y una guía de una página para el servidor privado: abrirlo a tus amigos con contraseña (`listen`, `basicAuthMode`) | A | S | La guía, probada en otra máquina de tu red |

**Hecho cuando** alguien que nunca ha usado SillyTavern pulsa «Jugar sin conexión», crea su personaje y está jugando **sin ver nada que no sea el juego**.

---

### J1 · Tu personaje

**Para qué.** Lo normal de D&D: nombre, especie y clase, que se note en las reglas y en lo que te pasa. Y que tu personaje **dure** de campaña en campaña.

**Qué hay ya.**
- El creador (`ui/hero-creator.js`), con el trasfondo con efecto.
- 12 especies y 10 clases en el compendio, cada una con lo que da y lo que quita. El taller deja inventar las tuyas desde el 2026-09-28.
- Subir de nivel con dones y árboles.
- Traer a un veterano (idea 179).

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J1.1 | **Nombre, especie y clase**, elegidas de tarjetas (con lo que da cada una) en vez de escritas. Todo lo demás, opcional. **La pantalla es J18.2** | A | M | e2e: crear uno eligiendo tarjetas; un héroe hecho sigue entrando de un clic |
| J1.2 | **Las características de D&D** a la vista: Fuerza, Destreza, Constitución, Inteligencia, Sabiduría y Carisma, con la especie y la clase ya sumadas. Repartir unos puntos, o tirar, a elegir | A | M | Pruebas: la misma especie y clase dan lo mismo; tirar da algo distinto con la semilla |
| J1.3 | **El equipo inicial por clase**: el guerrero, su espada y su armadura; el mago, su grimorio | A | S | Pruebas por clase |
| J1.4 | **Opcional: trasfondo y cómo te llaman** (el género gramatical del texto: «cansado» o «cansada») | A | M | Pruebas: la misma frase con los dos géneros; ni un `{o/a}` a la vista |
| J1.5 | **Tu personaje dura**: guardado en el gremio y no en la campaña (D-J4). Al empezar una campaña, se lleva; al terminar, vuelve con lo ganado | A | L | e2e: terminar 1387 y empezar otra con el mismo personaje, con su nivel y su equipo |
| J1.6 | **Varios personajes por jugador**: una plantilla del gremio con los tuyos, para elegir con quién vas a cada campaña | A | M | Pruebas |
| J1.7 | **La ficha legible**: quién eres, qué sabes hacer, qué llevas y en qué campañas has estado | A | M | Captura para el Gem de UX |
| J1.8 | **Tu cara sin arte**: iniciales con tu color, un icono, un emoji o una imagen tuya | A | S | La ficha y el tablero enseñan tu cara |

**Hecho cuando** creas un personaje en un minuto eligiendo tarjetas, juegas con él una campaña y lo sacas en la siguiente con lo que ganó.

---

### J2 · El prólogo

**Para qué.** Que la historia empiece a contarse (lo pides tú), que se aprenda a jugar jugando y que se llegue al gremio sabiendo para qué sirve.

**Qué hay ya.**
- El motor de hitos (`plot.js`), las escenas de apertura y el paquete de campaña.
- Los consejos de la primera vez (idea 155).

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J2.1 | **Un prólogo corto y jugable** (D-J8), de 15 a 20 minutos: llegas a un pueblo, algo pasa, una pelea sencilla, una charla, y alguien te lleva al gremio | A | L | La vuelta sin modelo lo juega entero |
| J2.2 | **Enseña jugando**: cada cosa nueva (moverse, pelear, hablar, una tirada, el Diario), con su ayuda, una vez, cuando toca (H1) | A | M | La vuelta ve cada ayuda una vez |
| J2.3 | **Se puede saltar**, para quien ya sabe jugar o para el segundo personaje | A | S | Pruebas |
| J2.4 | **Escrito como una campaña pequeña** (el mismo formato), para que se pueda cambiar sin programar | A | S | El prólogo es un paquete más |

**Hecho cuando** un jugador nuevo termina el prólogo sabiendo moverse, pelear, hablar y qué es el gremio, sin haber leído nada fuera del juego.

---

### J3 · El gremio, tu base

**Para qué.** El sitio al que se vuelve, que dura entre campañas y que crece con lo que traéis. Es donde se elige qué jugar.

**Qué hay ya.**
- `campaign/guild.js`: edificios, empleados, entrenamiento, rangos con renombre, lealtad y retiro.
- Servicios: posada, tienda, herrería y templo.
- La Mesa de la semana y el tablón de encargos.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J3.1 | **La sala del gremio**, uno de los sitios del pueblo (J3.11): el tablón de campañas, el grupo, el cofre, el entrenamiento y la salida | A | L | Captura para el Gem de UX; e2e: entrar y ver cada parte |
| J3.2 | **El tablón de campañas**: cada campaña con su tarjeta. Nombre, de qué va en dos líneas, nivel recomendado, cuántos jugadores, lejos o cerca y si ya la jugasteis (y cómo acabó) | A | M | e2e: 1387 aparece en el tablón |
| J3.3 | **Descansar y guardar** en el gremio: dormir recupera y guarda (J15.2) | A | M | e2e: dormir, cerrar y cargar |
| J3.4 | **El cofre del gremio**: lo que no lleváis encima se queda. Compartido por el grupo | A | M | Pruebas; con dos jugadores, los dos lo ven |
| J3.5 | **Subir de nivel y entrenar** en el gremio (hoy se sube donde sea): las tarjetas de nivel y el entrenamiento de `guild.js` | A | M | Pruebas |
| J3.6 | **El gremio crece**: edificios (hoy abaratan el mantenimiento) que abren cosas. Una forja mejor, una biblioteca que enseña conjuros, un establo, más camas | A | L | Pruebas de cada edificio |
| J3.7 | **Rango y renombre del gremio**: terminar campañas lo sube, y abre campañas más difíciles en el tablón | A | M | Terminar 1387 sube el rango y abre una campaña nueva |
| J3.8 | **Encargos cortos** en el tablón, entre campaña y campaña (los encargos de hoy, `contracts.js`) | A | S | Pruebas |
| J3.10 | **La base es un pueblo** (2026-09-29): el gremio está en una aldea, ciudad o puerto con su mercado, su herrería, su posada y su templo, cada uno con quien lo atiende. Ahí se compra el material. El mundo semiabierto alrededor, más adelante | A | M | e2e: comprar en la tienda del pueblo y equiparlo antes de la primera campaña |
| J3.11 | **La pantalla del pueblo** (tu descripción del 2026-09-29): la pantalla principal cuando no hay pelea. Un **selector de sitios, como el de localizaciones**: la herrería, la taberna, la tienda, el templo y el gremio (el tablón de campañas y los encargos). Cada sitio abre su escena de novela visual con quien lo atiende (Ramiro en la herrería, Tomás en la posada) y sus acciones. Se ve quién de tu gente está en cada sitio a esta hora (J14). **La misma pantalla vale para los pueblos de cada campaña** (Vallaki, Krezk…), con sus propios sitios. Hoy Puerto Alba es una sola localización con sus servicios en tarjetas | A | L | e2e: del gremio a la herrería y a la taberna con el selector, comprar y volver; lo mismo en Vallaki. Captura para el Gem de UX |
| J3.9 | **El Salón de la fama**: las campañas terminadas, los caídos y lo que hicieron (ya existe; que lo alimente cada campaña) | A | S | Tras terminar 1387, sale en el salón |

**Hecho cuando** el gremio es el sitio al que volvéis entre campaña y campaña, y se nota lo que habéis hecho.

---

### J4 · Las campañas

**Para qué.** **El cambio de fondo del plan.** Hoy cada campaña es una partida aparte; aquí pasa a ser algo que **se empieza desde el gremio, se juega y se termina**, con los personajes del gremio.

**Qué hay ya.**
- El paquete de campaña (contrato v1), su validación y su importador. 1387 entero.
- El taller, que deja retocar una campaña antes de jugarla.
- Traer a un veterano de otra partida (idea 179).

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J4.1 | **El diseño** (D-J3, D-J4, D-J5): qué es de la partida (el gremio, los personajes, el cofre, la fama) y qué es de cada campaña (su mundo, su gente, su hilo). Escrito aquí antes de tocar código | D | S | Esta sección, aprobada |
| J4.2 | **La partida es el gremio**: guardar el gremio y los personajes aparte de las campañas. Hoy todo va en el chat de un mundo; habrá que partir el estado (`state-registry.js` ya dice qué es de la partida y qué del mundo) | A | L | Pruebas; e2e: dos campañas en la misma partida, y el gremio igual en las dos |
| J4.3 | **Empezar una campaña desde el tablón**: crea su mundo (como hoy), lleva a vuestros personajes y cuenta la llegada. Sin taller por medio, salvo que quieras retocarla | A | L | e2e: del tablón a jugar 1387 con el personaje del gremio |
| J4.4 | **Volver al gremio y retomar** (D-J5): salir a mitad, con su progreso guardado, y volver donde estabais | A | M | e2e: salir de 1387 en el hito 3, volver y seguir en el 3 |
| J4.5 | **Terminar una campaña**: el final, los epílogos, lo que se lleva cada uno y el regreso al gremio con su escena | A | M | e2e: terminar 1387 y estar en el gremio con lo ganado |
| J4.9 | **El viaje se cuenta** (D-J3): cada campaña del tablón dice a cuántos días está («Barovia, a nueve días»); al salir, una escena corta del camino; al volver, otra. Por dentro, cada campaña sigue siendo su mundo | A | S | e2e: la tarjeta dice los días; al entrar y al volver sale la escena del viaje |
| J4.6 | **Nivel recomendado y ajuste**: la campaña dice para qué nivel es. Si vais más bajos o más altos, los enemigos se ajustan (hoy ya hay presupuesto de amenaza, `board-intent.js`) | A | M | Pruebas: el mismo tablero con nivel 1 y nivel 5 |
| J4.7 | **1387, la primera campaña del tablón** (D-J7) | A | S | e2e |
| J4.8 | **Varias campañas guardadas a la vez**: una terminada, una a medias, otra sin empezar | A | M | Pruebas |

**Hecho cuando** en la misma partida se juega 1387, se vuelve al gremio, se empieza otra campaña con los mismos personajes y se nota lo ganado.

---

### J5 · Tu JSON de campañas

**Para qué.** Que puedas meter las campañas que quieras (*Curse of Strahd* y las que vengan) **sin que yo tenga que escribirlas**: me pasas el JSON y el juego lo lee.

**Qué hay ya.**
- El paquete de campaña, con historia (hitos, finales y presagios), misiones, sitios, gente y bestiario.
- `tools/guion-a-paquete.mjs`, que convierte los guiones del Gem.
- «Importar un libro», que valida y explica lo que falla.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J5.1 | **Leer tu JSON**: cuando me lo pases, un conversor de su formato al paquete del juego (D-J6), que dice qué ha entendido y qué no | A | M | Tu JSON de *Curse of Strahd*, convertido; el informe dice qué campos no se leen |
| J5.2 | **Lo que el paquete no tenga, se añade**: si tu JSON trae cosas que el paquete no sabe guardar (capítulos, encuentros por sala, tesoros por sitio, puntos de vista), se amplía el contrato | A | M | `node tools/gem-instructions.mjs --check` sigue en verde |
| J5.3 | **Los huecos se rellenan con el motor**: si la campaña no trae tableros para un sitio, se generan con la semilla; si no trae bichos, del bestiario; si no trae frases, las del narrador del motor | A | M | Una campaña con solo historia y misiones se juega entera |
| J5.4 | **Importar desde el gremio**: pegar o subir el JSON, y que aparezca en el tablón | A | S | e2e |
| J5.5 | **El Gem puede escribir campañas en tu formato o en el del juego**, y [[GEM_CREAR_CAMPANA]] explica ambos | A | S | — |
| J5.6 | **Comprobar una campaña antes de jugarla**: el medidor de densidad (`tools/check-world-density.mjs`) le dice si le falta algo (sitios sin nada, hitos sin salida, misiones sin tablero) | A | S | La herramienta, con tu JSON |

**Hecho cuando** me pasas un JSON, lo conviertes con un comando (o lo subes al gremio) y la campaña aparece en el tablón y se juega.

**Lo que necesito de ti:** el JSON (o una parte) de *Curse of Strahd*, para ver su forma.

---

### J6 · Jugar con amigos

**Para qué.** Que varios jugadores estén en la misma partida, **cada uno con su personaje y desde su PC**, en tu servidor privado.

**El problema de fondo.** Hoy el juego entero corre en el navegador de quien juega: el estado vive en su chat, y el motor (`party.js`) hace todo ahí. SillyTavern no trae nada para compartir una partida en vivo.

**La forma más corta, en mi opinión: el anfitrión manda.**
- **El anfitrión** es quien abre la partida. Su navegador **sigue siendo el que hace el juego**, como hoy.
- **Los demás** ven lo mismo que él (el tablero, el texto, el grupo) y **envían lo que quieren hacer**: mover su ficha, elegir una respuesta, votar.
- **El servidor solo hace de mensajero** entre ellos: una sala por partida, con una conexión que avisa de los cambios.

Así no hay que reescribir el motor para el servidor. El riesgo: si el anfitrión se va, la partida se para, pero se guarda y se retoma.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J6.1 | **El diseño**, aprobado (D-J1, D-J2): quién manda, qué ve cada uno y qué puede hacer | D | S | Esta sección |
| J6.2 | **Paso 1, en el mismo PC**: cada personaje del grupo tiene dueño (un jugador). En combate, el turno dice de quién es; fuera, se decide por turnos. Sin red todavía | A | M | e2e: dos jugadores, dos personajes y turnos por dueño |
| J6.3 | **Paso 2, la sala**: en el servidor, una sala por partida, con una conexión en vivo que avisa de los cambios (sin librerías nuevas). Unirse con un código | A | L | Pruebas del servidor; dos navegadores en la misma sala |
| J6.4 | **Paso 3, ver la partida de otro**: los demás ven el tablero, el texto y el grupo del anfitrión, en vivo, sin poder tocar | A | L | e2e con dos navegadores: lo que pasa en uno se ve en el otro en menos de un segundo |
| J6.5 | **Paso 4, jugar cada uno lo suyo**: mover tu ficha, atacar, usar lo tuyo y elegir en tu turno. Lo que envías, lo hace el anfitrión | A | L | e2e con dos navegadores: cada uno juega su turno en combate |
| J6.6 | **Decisiones del grupo** (D-J2): una respuesta, adónde ir, aceptar una campaña. Se propone, se vota, y decide el líder si no hay mayoría | A | M | e2e: dos votan distinto y decide el líder |
| J6.7 | **Hablar entre jugadores**: una charla aparte, que no es del juego (como en la mesa) | A | S | Pruebas |
| J6.8 | **Entrar y salir**: quien se une a mitad trae su personaje del gremio; quien se va, su personaje pasa a llevarlo el juego (la IA de aliados, `combat/ally-ai.js`) o se queda en el gremio | A | M | e2e: uno se va a mitad de pelea y la pelea sigue |
| J6.9 | **Cada jugador, su cuenta**: con las cuentas de SillyTavern (`enableUserAccounts`) o con un nombre y el código de la sala. Lo más sencillo primero | D | M | — |
| J6.10 | **La partida se guarda en el anfitrión**, y cualquiera puede ser anfitrión otro día si tiene el guardado (exportar e importar la partida entera) | A | M | Pruebas |

**Hecho cuando** tú y un amigo, cada uno en su PC, jugáis una tarde de 1387: cada uno mueve su personaje en las peleas, votáis las decisiones y os veis el uno al otro en vivo.

---

### J7 · El grupo

**Para qué.** **De momento es de un solo jugador** (lo dijiste el 2026-09-29): tu personaje y sus compañeros. A cada compañero lo mueve la máquina del juego (su IA táctica, sin modelo) **hasta que os hacéis amigos** (vínculo 5); desde entonces, lo mueves tú si quieres. Jugar con amigos vuelve con J6.

**Qué hay ya.**
- Compañeros reclutables (`recruit.js`, hasta 5 en el grupo), con vínculo, aprobación, arcos y despedidas.
- Aliados que juega la máquina (`combat/ally-ai.js`), con la postura que les pones en su ficha, y la mascota.
- «Que actúe solo» en la barra de combate: el turno de quien toque lo juega la máquina.
- Los mercenarios del gremio y tus personajes guardados (J1.6).

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J7.1 | **Tu grupo**: tu personaje y, para llenar, compañeros del gremio (mercenarios, tus otros personajes) o de la campaña | A | M | e2e: un jugador con tres compañeros |
| J7.2 | **Compañeros del gremio que duran**: los que se unen en una campaña pueden quedarse en el gremio para las siguientes | A | M | Pruebas |
| J7.3 | **Quién mueve a cada uno: tú o el juego, cuando os hacéis amigos** (lo decidiste el 2026-09-29). Al principio, cada compañero lo mueve el juego (su IA táctica). **Cuando su vínculo contigo llega al rango 5** (el de «amigo», el mismo que abre el Relevo), se desbloquea «Lo muevo yo» en su ficha y en la barra de combate, y desde entonces eliges tú. Se puede volver a dejárselo al juego cuando quieras. Tu personaje, siempre tú; tus invocaciones (J19.5) también, porque son tuyas | A | M | e2e: con vínculo 4 no aparece el botón; con vínculo 5 sí, y moverlo a mano funciona |
| J7.4 | **Formación y papeles**: quién va delante, quién cura, quién vigila en el viaje (los papeles de viaje ya existen) | A | S | Pruebas |
| J7.5 | **Opiniones de los compañeros a la vista** al decidir (hoy se apuntan): «A Bran le gusta esto» | A | M | Pruebas |

**Hecho cuando** una campaña se juega bien con un jugador y tres compañeros, tanto moviéndolos tú como dejándoselos al juego.

---

### J8 · Hablar sin IA

**Para qué.** Que hablar sea tan jugable como pelear: opciones con sentido, tiradas con consecuencia y conversaciones que os dejan distintos. Con amigos, decidido entre todos.

**Qué hay ya.**
- La charla con temas que se ganan (el 2026-09-28): sonsacar, convencer (el Duelo de Palabras), amenazar y la ronda.
- Respuestas sugeridas; en un enfrentamiento, las de enfrentamiento.
- La caja entiende frases.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J8.1 | **Diálogos con ramas escritos**: un bloque del paquete con nudos, condiciones (actitud, hito, un objeto, la especie, la clase) y efectos (actitud, pista, hito u objeto). Tu JSON puede traerlos (J5) | A | L | Una charla de 1387 escrita en ramas, jugable entera |
| J8.2 | **Opciones según quién eres**: «[Enano] …», «[Clérigo] …», «[Soldado] Reconozco a un veterano». Con varios jugadores, cada uno ve las suyas | A | M | Con dos personajes distintos, salen opciones distintas |
| J8.3 | **Tiradas en la charla**, con bien, a medias y mal (`consequences.js`) | A | M | Pruebas de los tres resultados |
| J8.4 | **La conversación en su ventana**: la cara de quien habla, su línea y las opciones. Con amigos, se ve quién ha votado qué | A | M | Captura para el Gem de UX |
| J8.5 | **Salir de una pelea hablando**: entregarse, sobornar, convencer o engañar, cada salida con su consecuencia | A | M | En la posada de 1387, las cuatro salidas funcionan |
| J8.6 | **Lo que ya os contó no se repite**, y queda en el Diario | A | S | Pruebas |

**Hecho cuando** una charla importante se juega con opciones y tiradas, y salen cosas distintas según quién habla.

---

### J9 · La historia de cada campaña

**Para qué.** Que cada campaña se juegue de principio a fin sin conexión, y se lea como una historia, no como avisos.

**Qué hay ya.**
- El hilo (`plot.js`): hitos que se abren y se cumplen de nueve formas, plazos, caminos que se cierran, presagios y finales.
- Casos, el Diario y los resúmenes de cada acto.
- Sin modelo, la vuelta llega al hito 4 de 1387.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J9.1 | **1387 entero sin conexión**: la vuelta sin modelo hasta el final, arreglando cada sitio donde el juego se calle o se atasque | A | L | La vuelta llega a uno de los tres finales con 0 silencios |
| J9.2 | **Escenas del hilo, jugadas**: cada hito importante, una escena con su texto y una o dos decisiones, en vez de una nota «[HILO]» | A | L | Los hitos 1 a 5 de 1387, como escenas |
| J9.3 | **Capítulos**: si tu JSON trae capítulos o actos, el Diario los sigue, y el tablón del gremio dice por cuál vais | A | M | Con tu JSON |
| J9.4 | **Los finales**, alcanzables y distintos, con el epílogo de cada personaje | A | M | La vuelta, una vez por final |
| J9.5 | **Plazos a la vista**: los hitos con reloj dicen cuánto queda | A | S | Pruebas |
| J9.6 | **El Diario como un libro**: capítulos, lo que decidisteis y lo que pasó por ello | A | M | Captura para el Gem de UX |

**Hecho cuando** 1387 se juega de principio a fin sin conexión y lo que se lee en el Diario es una historia.

---

### J10 · El mundo de cada campaña

**Para qué.** Que dentro de una campaña salir sea una elección con sentido: sitios con cosas que hacer, caminos que se abren y un mundo que sigue.

**Qué hay ya.**
- Viajar de vecino en vecino, con días, clima y estaciones, y caminos cerrados hasta un hito.
- Sucesos de viaje con decisiones.
- Descubrir sitios, facciones con reloj y fama por sitio.
- El medidor de densidad.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J10.1 | **Caminos que se abren** por la historia (ya existe), y también **por reputación y por llaves** (un salvoconducto, una barca, un guía) | A | M | Pruebas |
| J10.2 | **Cada sitio con algo que hacer**: servicios, gente, algo que mirar, un suceso, un secreto y, si toca, un tablero. El medidor de densidad lo comprueba | A | M | Los 11 sitios de 1387 pasan el medidor ampliado |
| J10.3 | **Sucesos con disparador de facción y de reputación** (lo que queda de Z4 de [[ROADMAP_SIN_TOKENS]]) | A | M | Pruebas |
| J10.4 | **Secretos**: sitios y cosas escondidas que se descubren por un rumor, un mapa, una tirada o una persona | A | M | Tres secretos en 1387 |
| J10.5 | **El mapa de la campaña, dibujado**: sitios y caminos con CSS (sin arte), con lo visitado y tus notas | A | M | Captura para el Gem de UX |
| J10.6 | **Gente con horario** (T9): cada persona, en un sitio según la hora | A | M | Pruebas |
| J10.7 | **Hilos con fondo para campañas sin escribir** (Z5): una gramática de actos para las campañas que generes con la semilla | A | L | Una campaña generada tiene tres actos que se juegan |

**Hecho cuando** dentro de 1387 hay al menos tres razones distintas para ir a cada sitio.

---

### J11 · Decisiones que pesan

**Para qué.** Que lo que elegís importe: dentro de la campaña, y a veces en la siguiente.

**Qué hay ya.**
- Aprobación, actitudes, fama, crimen y rumores de lo que hicisteis.
- La crónica, hitos que cierran caminos y sucesos con continuación.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J11.1 | **Avisar de lo importante, sin destripar**: «Esto no tiene vuelta atrás» | A | S | Pruebas |
| J11.2 | **Consecuencias diferidas**: más continuaciones de sucesos y de decisiones del hilo | A | M | 15 continuaciones nuevas |
| J11.3 | **El mundo se acuerda**: lo que hicisteis cambia precios, trato, saludos y rumores | A | M | Tras robar en la tienda, los precios y el saludo cambian |
| J11.4 | **De una campaña a otra**: lo que el gremio recuerda (salvasteis Barovia, arrasasteis el valle) cambia cómo os reciben, qué campañas se ofrecen y quién os busca | A | M | Tras terminar 1387 de una forma, el gremio lo dice |
| J11.5 | **La crónica consultable**: qué decidisteis y qué salió de ello, por campaña | A | S | Pruebas |

**Hecho cuando** dos partidas de 1387 con decisiones distintas acaban en sitios que se notan, y el gremio lo recuerda.

---

### J12 · Tableros y peleas

**Para qué.** El combate ya es muy completo. Ahora, que cada jugador mueva lo suyo, que las peleas vengan de la historia y que a veces se puedan evitar.

**Qué hay ya.**
- Combate táctico completo; enemigos a la vista antes de pelear (el 2026-09-28).
- Hablar en un enfrentamiento; tregua y rendición.
- Cofres, palancas, barricadas y salidas.
- El editor de tableros en el taller (el 2026-09-28).
- Las localizaciones y los tableros ya aceptan una imagen (`url`, con subida en el editor de localizaciones), pero solo como ilustración: el tablero se juega sobre su propio dibujo de casillas.
- Alturas (`board/heights.js`), puertas, escaleras entre niveles y terreno difícil.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J12.1 | **Cada jugador, su turno** (con J6): en su turno mueve y ataca él; el resto ve. Con un tiempo de espera, para que nadie se quede colgado | A | M | e2e con dos navegadores |
| J12.2 | **Toda pelea escrita tiene otra salida**: hablar, pagar, huir o esconderse (una tirada) | A | M | En 1387, cada pelea escrita tiene al menos una salida sin pelear |
| J12.3 | **Trampas y búsqueda fuera de combate**: conectar `searchCell` y `disarmHazard` (`board/hazards.js`, hoy sin usar), y que las trampas salten también andando (hoy solo en combate) | A | M | e2e: buscar descubre una trampa; pisarla fuera de combate hace daño |
| J12.4 | **Moverse fuera de combate con un clic**, y el grupo junto (hoy se arrastra ficha a ficha) | A | M | e2e |
| J12.5 | **Tableros de tu JSON**: si la campaña trae mapas de sus sitios, se leen; si no, se generan con la semilla (J5.3) | A | M | Con tu JSON |
| J12.6 | **Encuentros ajustados al grupo**: más jugadores, más enemigos (hoy ya se reparte un presupuesto de amenaza) | A | S | Pruebas: el mismo tablero con uno y con cuatro |
| J12.7 | **Peleas de taberna y duelos**: no letales, por honor o por apuesta | A | M | Pruebas |
| J12.8 | **Un tablero a partir de un mapa en imagen** (lo pediste el 2026-09-29). Subes un mapa de D&D en cuadrícula, como los de mazmorra con sus salas B1 a B9, y se juega **encima del dibujo**. Se ajusta la cuadrícula: el tamaño de la casilla y dónde empieza, marcando una casilla del dibujo o diciendo cuántas casillas tiene de ancho | A | M | Con los mapas de ejemplo: la cuadrícula del juego cae sobre la del dibujo, casilla a casilla |
| J12.9 | **Muros y suelo leídos de la imagen**, sin IA: el juego mira los píxeles de cada casilla. La trama rayada es roca (muro), la cuadrícula clara es suelo, las piedras sueltas son terreno difícil. Lo que falle se retoca con el pincel del editor | A | L | En el mapa de ejemplo, las salas y los pasillos salen como suelo y la roca como muro, con menos de una casilla de cada veinte por corregir |
| J12.10 | **Puertas, escaleras, puentes y alturas**: las puertas en los huecos entre salas; los puentes y las escaleras; las cotas del dibujo («+60 ft», «+30 ft», «+0 ft») como alturas (`board/heights.js`), con los acantilados como bordes que no se cruzan andando. Se proponen solos donde se pueda, y se marcan con el pincel | A | M | En el mapa de ejemplo, el risco de A tiene tres alturas y sus dos puentes se cruzan |
| J12.11 | **Las salas con nombre**: las etiquetas del mapa (B1, B2… A, C) pasan a ser zonas del tablero, con lo que hay en cada una: quién espera, qué se encuentra, el texto de la sala. Se trabaja sobre el mapa **con** etiquetas y se juega sobre el **limpio**, como las dos versiones que me pasaste | A | M | Los dos mapas de ejemplo: con etiquetas para quien lo crea, sin ellas para quien juega |
| J12.12 | **En el JSON de campaña y en el conversor**: el tablero lleva su imagen y su cuadrícula (`image`, `grid`), y `campana-a-paquete` los acepta. Así los tableros de Strahd pueden usar mapas de verdad | A | S | Un tablero de Strahd con su mapa en imagen, jugado en la simulación |
| J12.13 | **Tableros grandes**: un mapa entero (el de ejemplo son unas 40 × 28 casillas) se juega por partes, con la cámara siguiendo al grupo y la niebla de guerra (`board/fog-of-war.js`) tapando lo que aún no se ha visto | A | M | e2e: cruzar el mapa de ejemplo de C a B1 |
| J12.14 | **El tablero a pantalla completa, como un VTT** (lo pediste el 2026-10-01, con el encargo de tu Gem de UX: [[maquetas/ENCARGO_COMBATE_VTT]] y la maqueta `wiki/maquetas/combate-vtt-v3.html`). El mapa ocupa toda la pantalla y el HUD flota encima:<br>• mover el mapa arrastrando y hacer zoom con la rueda o con dos dedos;<br>• un minimapa;<br>• avisos en el borde para los enemigos que no se ven;<br>• la iniciativa con caras y, debajo, el resumen del combate, que se pliega;<br>• Espacio centra en quien tiene el turno;<br>• al pasar por tu ficha se ilumina hasta dónde llegas | A | L | Capturas a 1280×720, 1920×1080 y 390×844, y las pruebas de combate en verde |
| J12.15 | **La barra de acciones de D&D 2024**:<br>• el presupuesto del turno: Acción, Adicional, Reacción y el movimiento;<br>• «Cuerpo a tierra»;<br>• menús en tarjetas: Atacar (con las maestrías de las armas, el impacto sin armas para golpear, agarrar o empujar, y el cambio de arma), Magia (con las gemas de los espacios), Acciones (Correr, Destrabarse, Esquivar, Ayudar, Ocultarse, Estudiar, Utilizar) y Adicional (beber una poción, la mano torpe).<br>«Hablar», «Mascota» y «Maniobras» salen de la barra | A | L | Pruebas de cada regla nueva y una pelea jugada con la barra nueva |
| J12.16 | **La pelea empieza sola**: al entrar en un tablero con enemigos, primero se deciden las salidas, si las hay (Pelear, Hablar, Pagar, Huir, Esconderse). Luego colocas a los tuyos y sale la iniciativa. Sin «Iniciar combate» ni «Evitar la pelea» sueltos, y sin fichas del pueblo en el tablero | A | M | e2e en el muelle del prólogo |
| J12.17 | **Moverse bien**: el mar y los ríos hondos no se cruzan andando, el camino va recto si puede, y las diagonales cuestan 5, 10, 5… (la regla opcional de 5e, con un interruptor) | A | M | Pruebas y el muelle del prólogo: nada de andar sobre el agua |

**Hecho cuando** subes un mapa de D&D en imagen y en unos minutos lo juegas como tablero, con sus muros, puertas y alturas; y una pelea escrita se puede resolver hablando. (Lo de cada jugador en su turno, J12.1, vuelve con J6.)

---

### J13 · El texto del motor

**Para qué.** Sin IA, todo lo que se lee lo escribe el motor. Tiene que leerse bien, con voz y sin repetirse.

**Qué hay ya.**
- El narrador del motor, con 133 filas.
- 23 sucesos; frases de compañeros y enemigos en combate.
- Las órdenes al narrador no se ven.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J13.1 | **Las 55 notas del juego, en prosa**: cada una trae su versión para leer sin modelo | A | L | La vuelta no enseña ninguna línea de «hechos» en crudo |
| J13.2 | **Variedad medida**: ninguna frase repetida en diez llegadas; una herramienta que lo cuente | A | S | En el marcador |
| J13.3 | **El género gramatical** en todas las frases (J1.4) | A | M | La vuelta, con un personaje de cada género |
| J13.4 | **Más frases**: de 133 a unas 400. Cada momento con al menos ocho variantes | A | L | El marcador |
| J13.5 | **Frases de compañeros fuera de combate**: en el viaje, al llegar y ante vuestras decisiones | A | M | La vuelta oye al menos cinco distintas |
| J13.6 | **Guía de estilo**: texto que se entiende a la primera, sin acertijos y sin adornos que no dicen nada. Para el Gem y para mí | A | S | La guía, en [[GEM_GUIONISTA]] |
| J13.7 | **Solo sabes el nombre de quien se ha presentado** (lo pediste el 2026-09-30: al principio le contestabas al posadero por su nombre sin que se hubiera presentado). Hasta que alguien dice su nombre, o te lo dice otro, sale por su oficio: «el posadero», «la maestra del gremio». Eso vale en la placa de la novela, en las fichas, en el pueblo y en el Diario. Las opciones escritas no nombran a quien aún no conoces | A | M | e2e en el prólogo: antes de presentarse, la placa dice «Posadero» y ninguna opción le nombra; después, «Tomás» |
| J13.8 | **Textos y reacciones más humanos** (lo pediste el 2026-09-30). Cada persona suena a sí misma, según su «voz» del paquete. Reacciona a lo que acabas de decir o hacer, y a quién eres. Te saluda distinto si es la primera vez o si ya te conoce. Nada de frases de formulario. Los criterios quedan en [[GEM_GUIONISTA]] para las campañas nuevas | A | M | Una vuelta por el prólogo y una quedada, con diez ejemplos de antes y después |

**Hecho cuando** una hora de juego sin conexión no enseña ni una línea en crudo, ni una frase repetida, ni una orden al narrador.

---

### J14 · La gente: charlas y quedadas, estilo *Persona*

**Para qué.** Tu descripción del 2026-09-29: el juego necesita un sitio para hablar con la gente. **Charla corta con los compañeros** al cruzarte con ellos, y **dedicar una parte del día a quedar** con alguien: un evento que os acerca, como en *Persona*. Vale en el pueblo principal y en los pueblos de cada campaña.

**Qué hay ya.**
- **El día ya tiene partes** (mañana, tarde y noche: `campaign/calendar.js`, `hours.js`), y viajar ya gasta tiempo.
- **Vínculos de diez rangos**, aprobación, arcos y despedidas (`bonds.js`, `companion-arcs.js`).
- **Confidentes con escenas escritas**: cinco por persona en 1387 y en Strahd, que hoy se cuentan al subir el vínculo pero no se juegan.
- Charlas de pareja (`camp-talk.js`, que hoy necesita modelo), y rondas y veintiuno en la posada.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J14.1 | **Charla corta**: al cruzarte con un compañero (en el pueblo, en el viaje o tras una pelea), una o dos líneas suyas y una respuesta tuya de tres. No gasta tiempo; mueve un poco la aprobación. Escritas por compañero y momento, sin modelo | A | M | La vuelta oye al menos diez distintas, sin repetir |
| J14.2 | **El día por partes**: mañana, tarde y noche. Cada parte libre se gasta en algo: quedar con alguien, entrenar, trabajar, comprar o descansar. Viajar, pelear y las misiones también gastan partes. Se ve en la cabecera | A | M | Pruebas; e2e: quedar gasta la tarde y pasa a la noche |
| J14.3 | **Quedar con alguien** (el evento): eliges a quién y dónde (la taberna, la herrería, el muelle…). Sale su escena, con respuestas que suben el vínculo; si toca, **sube de rango**. Cada rango abre algo: una habilidad de apoyo en combate, un descuento o su misión personal | A | L | e2e: quedar tres veces con Gerd y subir un rango; se ve lo que abre |
| J14.4 | **Quién está libre y dónde**: la pantalla del pueblo (J3.11) enseña quién de tu gente está en cada sitio a esta hora, y quién quiere quedar contigo (un icono) | A | M | Captura para el Gem de UX |
| J14.5 | **Las escenas de confidente, jugadas**: las cinco de cada uno dejan de contarse y se juegan como eventos de quedada, con respuestas que cambian el vínculo | A | L | La escena de rango 2 de un confidente de Strahd, jugada entera |
| J14.6 | **Los compañeros de cada campaña**: los de la campaña (los confidentes de Strahd) quedan contigo en su pueblo; los del gremio, en Puerto Alba | A | M | Pruebas |
| J14.7 | **La noche**: una escena por noche, si toca. Alguien que llega, una ronda, una charla entre dos compañeros | A | M | La vuelta pasa cinco noches y ve tres cosas distintas |
| J14.8 | **Charlas de pareja sin modelo**, escritas o de plantilla | A | L | Sin conexión, una charla de pareja se lee entera |
| J14.9 | **Misiones personales** de los compañeros, con dos finales. Se abren con el vínculo (J14.3) | A | L | Los dos finales de una, jugables |
| J14.10 | **Romance, opcional**: con los compañeros que lo permitan (un campo en el paquete), con señales, citas (quedadas), escenas escritas y el epílogo. Tono: fundido a negro | A | L | Un romance completo, sin conexión |
| J14.11 | **Trabajos y ratos libres**: servir mesas, jugar a las cartas, echar una mano en la forja. Son otras formas de gastar una parte del día | A | M | Pruebas |

**Hecho cuando** en una semana de juego hablas con tus compañeros al cruzarte, quedas con dos de ellos en tardes distintas, uno sube de rango y se nota en la siguiente pelea.

---

### J15 · Sentirse un juego

**Para qué.** Los detalles de un juego terminado: guardar sin miedo, menús que son del juego y un código que aguante lo que viene.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J15.1 | **Partir `party.js`** (K1 de [[LO_QUE_FALTA]]), antes de J4 y J6: con unas 20.000 líneas, esas dos fases lo tocan entero | A | L | Las mismas pruebas, en verde, con el archivo partido |
| J15.2 | **Guardar como un juego**: dormir en el gremio guarda; ranuras con la tarjeta de guardado; guardado automático al cambiar de día. Los puntos de hoy, por debajo | A | L | e2e: guardar, cerrar, cargar otra ranura y volver |
| J15.3 | **El registro propio**: el texto del juego en su columna, sin el chat de SillyTavern a la vista; la caja solo para escribir | A | L | Captura para el Gem de UX |
| J15.4 | **Comandos a botones**: de los 55 comandos, los que no tienen botón (H3) | A | M | Una tabla en [[LO_QUE_FALTA]], a cero |
| J15.5 | **Teclado y accesibilidad**: atajos para lo de siempre, tamaño de letra y contraste | A | M | Pruebas |
| J15.6 | **Exportar e importar la partida entera** (el gremio, los personajes y las campañas), para cambiar de anfitrión (J6.10) | A | M | Pruebas |

**Hecho cuando** alguien juega su primera hora sin preguntarte nada.

---

### J16 · Medir la diversión

**Para qué.** Que «es divertido» no sea una impresión: que haya vueltas que jueguen de verdad y números que avisen cuando algo empeora.

**Qué hay ya.**
- `tools/e2e-todo.mjs` lo lanza todo a la vez en unos 15 minutos (el 2026-09-28).
- La vuelta sin modelo (hitos 1 a 4) y el e2e rápido.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J16.1 | **La vuelta sin conexión, hasta el final de 1387** (J9.1) | A | L | En `e2e-todo.mjs` |
| J16.2 | **La vuelta del gremio**: prólogo, gremio, 1387, vuelta al gremio y otra campaña con el mismo personaje | A | M | En `e2e-todo.mjs` |
| J16.3 | **La vuelta de dos jugadores**: dos navegadores en la misma sala, una pelea y una votación | A | M | En `e2e-todo.mjs` |
| J16.4 | **Los números que importan** (sección 6), al final de cada vuelta | A | S | Salen en el registro |
| J16.5 | **Vuestras pruebas**: una plantilla corta para apuntar qué aburre, qué confunde y qué engancha. Vuestra opinión manda sobre los números | D | S | — |

---

### J17 · Después: la IA como capa

**⏸️ Aparcado** (lo dijiste el 2026-09-29). No es para ahora. Queda escrito para que lo de antes no le cierre la puerta:

- **Un narrador de IA en los momentos que importan**: la escena del hito, el final o la llegada a una tierra nueva, sobre los hechos que ya decidió el motor.
- **Hablar libre** con cualquiera, con su voz.
- **Campañas nuevas en vivo**: la IA propone una campaña corta con el formato del juego, que pasa la misma comprobación que tu JSON.
- **El tope de gasto** y el contador, antes de nada de lo anterior.

La regla no cambia: **el motor decide y la IA cuenta**.

---

### J18 · La cara del juego: elegir personaje, crearlo y una novela visual

**Para qué.** Que al jugar no se vea un chat, se vea un juego. **La interfaz cambia bastante**: el personaje se hace en una pantalla suya, y la historia se cuenta como una novela visual, con quien habla en grande y el texto en una caja ancha abajo.

**El recorrido nuevo** (lo describiste el 2026-09-29):
1. **Inicias el juego y eliges**: un personaje que ya tienes, o «Nuevo personaje».
2. **Crear personaje**, en su pantalla. A la izquierda, lo de las reglas: tres tarjetas grandes (Clase, Especie, Trasfondo) que abren un selector, y debajo los atributos, que se llenan al elegir. A la derecha, quién eres: el retrato, el nombre con sugerencias y «Quién eres», con la varita dentro del campo. «Entrar al mundo» no se enciende hasta que haya nombre y clase.
3. **La historia, como una novela visual.** El tablero no se ve si no hay pelea. Quien habla sale grande a la izquierda (su imagen, o una silueta con icono si no hay arte) y su nombre en una placa encima de la caja. El texto va en una caja ancha abajo, con letra de libro. Lo que puedes hacer (las fichas) va dentro de la caja, debajo del texto. Debajo cuelgan «Registro» y «Ocultar UI».
4. **Tres momentos**: habla alguien (retrato y nombre), cuenta el juego (sin retrato: la placa dice «Motor», o nada si es una nota como la de la mascota) y empieza una pelea (la etiqueta de combate y la ficha «Iniciar combate», que abre el tablero).

**Las maquetas de tu Gem** están en `wiki/maquetas/`: `crear-personaje.html` entera, y `novela-visual.html` hasta donde llegó (el mensaje se cortó a mitad del código que cambia de momento).

**Qué hay ya.**
- La portada propia y la escena de diálogo del juego (`ui/shell/game-shell.js`): hoy es una columna de chat con un retrato pequeño y las fichas debajo.
- El creador de personaje (`ui/hero-creator.js`), con clase, especie, trasfondo y la varita. La lógica no cambia: nombre, clase, especie, trasfondo y «Quién eres», que va al Lorebook.
- Las fichas de la fila (`ui/shell/action-chips.js`), el retrato de los PNJ y la etiqueta de la mascota.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J18.1 | **Elegir personaje al entrar**: tus personajes guardados en tarjetas, y «Nuevo personaje» (con J1.6) | A | M | e2e: entrar con uno guardado y con uno nuevo |
| J18.2 | **La pantalla de crear personaje** (maqueta `crear-personaje.html`, clases `hc-`): dos columnas, tarjetas que abren un selector encima de todo, atributos que se llenan al elegir, retrato de no más de 380 px a 1280×720 sin barra horizontal, nombre con sugerencias y dado, y la varita dentro de «Quién eres» sin tapar lo escrito. «Entrar al mundo», apagado hasta tener nombre y clase | A | L | e2e a 1280×720: crear uno sin barra horizontal; las tarjetas vacías se leen («Elegir clase», en gris); captura para el Gem de UX |
| J18.3 | **La caja de novela visual** (maqueta `novela-visual.html`, clases `gs-vn-`): ancha, abajo, con la placa del nombre, el texto en letra de libro y las fichas dentro. Sin tablero a la vista mientras no haya pelea | A | L | e2e: la escena del prólogo sale en la caja, con sus fichas; captura para el Gem de UX |
| J18.4 | **Quién habla**: el retrato grande del PNJ, o una silueta con icono si no tiene imagen; el juego cuenta sin retrato; las notas (la mascota) con su etiqueta y en cursiva | A | M | Pruebas: el mismo mensaje sale con retrato si lo dice un PNJ y sin él si lo cuenta el juego |
| J18.5 | **De la caja al tablero y vuelta**: la pelea se anuncia en la caja («Iniciar combate»), entra el tablero y, al acabar, vuelve la novela | A | M | e2e: la bodega del gremio, de la caja al tablero y de vuelta |
| J18.6 | **Registro y Ocultar UI**: lo dicho hasta ahora en un panel aparte (con J15.3), y ver la escena sin la caja | A | S | e2e: abrir el registro y volver; ocultar y enseñar la caja |
| J18.7 | **Sin chat en el juego sin conexión** (lo pediste el 2026-09-29): la caja de escribir desaparece, y con ella lo que pide un modelo («Al narrador»). Todo se hace con botones y fichas. El registro de lo dicho sigue a mano | A | M | e2e: de la portada al final de una campaña sin escribir nada; la caja no aparece |
| J18.8 | **Las escenas cambian por lo que haces**, no con pestañas: nada de saltar a Exploración o al Tablero en mitad de un texto o de una pelea. Al acabar de leer, «Continuar» lleva al pueblo; entrar en un tablero lleva al tablero; acabar la pelea vuelve. Sin la X de la cabecera: se sale desde la pausa | A | M | e2e: la vuelta del gremio sin pulsar ninguna pestaña de escena |
| J18.9 | **Descansar y pasar el tiempo, como acciones de sitio**: «Dormir» en la posada, acampar fuera, «Pasar el rato» donde toque (J14.2). Fuera de la cabecera de la novela visual | A | M | e2e: dormir en la taberna de Puerto Alba pasa la noche |
| J18.10 | **Nada de etiquetas del motor en la caja**: «[HILO] Hecho:», «[DUELO]», «[GREMIO]» no se leen; sale solo la prosa (con J13.1) | A | S | e2e: ninguna línea de la caja empieza por «[» |

**Sin arte**: todo con CSS, iconos y emoji, como siempre; si un PNJ o tu personaje tiene imagen, se usa.

**Riesgos.** El selector de clase tiene que quedar encima de todo lo de SillyTavern. Y la escena de diálogo de hoy la usan las pruebas de punta a punta: hay que cambiarlas a la vez.

**Hecho cuando** entras, eliges o haces tu personaje en su pantalla y el prólogo del gremio se lee como una novela visual hasta que empieza la pelea de la bodega.

---

### J19 · La magia de D&D: conjuros, invocaciones y toda esa pesca

**Para qué.** Que un mago, un clérigo o un druida se jueguen como en la mesa: con sus espacios de conjuro, lo que prepara cada día, la concentración, las invocaciones y los conjuros que cambian el tablero. Lo pediste el 2026-09-29.

**Qué hay ya.**
- **La capa ligera** (D5 de [[POR_HACER]], `rules/abilities.js`): cada habilidad es una fila de datos con qué cuesta, cuántas veces, a quién alcanza y qué hace. Hay 30 en `compendio/habilidades.json`, entre conjuros y técnicas.
- Un grimorio con círculos y cargas (`rules/grimoire.js`), aprender de pergaminos y usar objetos mágicos.
- Áreas en radio, línea y cono (`rules/area.js`), elementos que le hacen cosas al tablero (el fuego revienta barriles, el frío hiela el agua) y terreno que se queda donde cae.
- Componentes que se gastan, y jefes que llaman a otros a mitad de pelea.

**La idea.** La capa ligera no se tira: **las reglas de 5e van encima**. Cada conjuro sigue siendo una fila de datos, ahora con más columnas: nivel, escuela, tiempo de lanzamiento, alcance, duración, si pide concentración, área, salvación y daño por nivel. Añadir un conjuro sigue sin tocar código.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J19.1 | **Espacios de conjuro de 5e**: del nivel 1 al 9, según la clase y el nivel (las tablas del SRD). Se recuperan con el descanso largo; el brujo, con el corto | A | M | Pruebas: un mago de nivel 5 tiene 4, 3 y 2 espacios |
| J19.2 | **Conocidos y preparados**: el mago prepara del grimorio, el clérigo y el druida de toda su lista, el bardo y el hechicero los conocen. Trucos a voluntad. Al subir de nivel se eligen los nuevos, en las tarjetas de nivel | A | M | e2e: preparar tras un descanso largo y lanzar uno preparado |
| J19.3 | **Lanzar a más nivel**: el mismo conjuro con un espacio mayor hace más (más daño, más objetivos) | A | S | Pruebas |
| J19.4 | **Concentración**: un solo conjuro así a la vez; recibir daño pide una salvación de Constitución; se ve en la ficha y en el tablero | A | M | Pruebas; e2e: un golpe rompe la concentración |
| J19.5 | **Invocaciones**: invocar criaturas (un familiar, animales, elementales, no muertos para el nigromante), que salen como fichas del grupo con sus números del bestiario. Las mueves tú o el juego (J7.3), y duran lo que el conjuro o la concentración | A | L | e2e: invocar un lobo, que pelee y que se vaya al acabar el conjuro |
| J19.6 | **Zonas de conjuro en el tablero**: niebla, telaraña, oscuridad, muro de fuego, silencio. Casillas con su efecto que duran unas rondas | A | M | e2e: una telaraña deja atrapado a quien la cruza |
| J19.7 | **Reacciones mágicas**: Escudo, Contraconjuro, Retirada expeditiva… con la reacción de cada turno | A | M | Pruebas |
| J19.8 | **Componentes y rituales**: el foco o la bolsa de componentes; los componentes caros, que se gastan; los rituales, que no gastan espacio pero piden diez minutos fuera de combate | A | S | Pruebas |
| J19.9 | **Objetos mágicos**: pergaminos, varitas y bastones con cargas, pociones, y la sintonización (tres como mucho) | A | M | Pruebas |
| J19.10 | **Magia fuera de combate**: Detectar magia, Luz, curar en el viaje, Identificar, Hablar con los muertos para las pistas de un caso… cada una enchufada a lo que ya existe | A | M | La vuelta usa tres fuera de combate |
| J19.11 | **Los conjuros, como datos**: un lote inicial del SRD, en mis palabras, de unos 60 a 80 conjuros de nivel 0 a 3, repartidos por clase. Se añaden más con una fila, sin código | A | L | La comprobación del compendio: cada clase lanzadora tiene conjuros de cada nivel que alcanza |
| J19.12 | **Enemigos que lanzan**: los del bestiario con conjuros (la bruja, Strahd) usan los mismos, con su máquina de decidir | A | M | En la simulación, Strahd lanza y se concentra |

**Riesgos.** Es la fase que más toca el combate. Va con la simulación de campaña (`tools/sim-campana.mjs`) para que ningún tablero se vuelva imposible, ni demasiado fácil, con un mago de nivel alto en el grupo.

**Hecho cuando** un mago de nivel 5 prepara sus conjuros al despertar, invoca, se concentra, pierde la concentración con un golpe y recupera sus espacios al descansar, todo sin tocar código para añadir un conjuro.

---

### J20 · Jugar desde el móvil: pantallas pequeñas y táctiles

**Para qué.** Que se pueda jugar desde el móvil, con el dedo, contra tu servidor de casa. Lo pediste el 2026-09-29.

**Qué hay ya.**
- SillyTavern ya se abre en el móvil: tiene la etiqueta `viewport` y un `manifest.json` para instalarlo como app, aunque con su nombre y su icono.
- El juego tiene algunos ajustes para pantallas de menos de 900 px (`game-shell.css`, `campaigns.css`). En la novela visual, el retrato se esconde y la caja se estrecha.
- **El tablero no tiene nada táctil**: las fichas se arrastran con el ratón, y las tarjetas y avisos se abren al pasar el ratón por encima. Es lo que más trabajo lleva.

| ID | Qué | Quién | Esf. | Cómo se comprueba |
| :--- | :--- | :---: | :---: | :--- |
| J20.1 | **La pantalla del juego en el móvil**, en vertical y en horizontal. La novela visual a pantalla entera, con la caja abajo. Las fichas de acción en una fila que se desliza con el dedo. La cabecera, compacta. Los menús, como hojas que suben desde abajo | A | L | Capturas a 390 × 844 y a 844 × 390 para el Gem de UX; nada se sale por los lados |
| J20.2 | **El tablero a toques**. Tocar una ficha la elige; tocar una casilla enseña el camino y lo que cuesta, y un segundo toque la mueve. Con dos dedos se amplía y se mueve la cámara. Nada depende de pasar el ratón: las tarjetas de enemigo y las ayudas se abren tocando | A | L | e2e en tamaño móvil y con toques: moverse y atacar en la bodega sin ratón |
| J20.3 | **Botones de dedo**: 44 × 44 px como poco, con sitio entre ellos. Las fichas de acción, la barra de combate, las casillas del tablero (con zoom automático si no llegan) y los cierres de las ventanas | A | M | Una prueba que mide cada botón visible en tamaño móvil |
| J20.4 | **Sin teclado**: todo lo que hoy va con teclas (Esc para la pausa; 1, 2 y 3 para las escenas) tiene su botón. Cuando sale el teclado del móvil para escribir, no tapa la escena | A | S | e2e en tamaño móvil sin pulsar ninguna tecla |
| J20.5 | **Las ventanas caben**: crear personaje en una columna, el selector de clase a pantalla entera, el tablón de campañas, la ficha, la tienda y el final de campaña, con su scroll | A | M | Capturas de cada ventana a 390 × 844 |
| J20.6 | **Ligero en el móvil**: el tablero dibuja solo lo que se ve, las animaciones son cortas y se respeta «reducir movimiento». Que no caliente el teléfono en una hora de juego | A | M | El tiempo de cada turno, medido con la CPU del móvil simulada |
| J20.7 | **Como una app**: añadirla a la pantalla de inicio, a pantalla entera, con el nombre y el icono del juego (D-J9), y entrar directo en la portada del juego | A | S | Instalada en un Android y en un iPhone |
| J20.8 | **Desde el móvil, contra tu servidor de casa**: la guía de J0.9 con el paso del móvil (la misma wifi, o fuera de casa con contraseña) | A | S | La guía, probada con tu móvil |
| J20.9 | **La prueba de punta a punta en el móvil**: un `tools/e2e-movil.mjs` con el tamaño y los toques de un teléfono. Crea el personaje, gana la bodega a toques, elige campaña en el tablón y vuelve | A | M | En la batería de siempre (`e2e-todo.mjs`) |

**Riesgos.** El tablero y los menús se van a seguir cambiando (J12.8, la magia, J15.3). Lo que es solo CSS (J20.1, J20.3 y J20.5) se puede hacer ya; el tablero táctil (J20.2) conviene hacerlo con `party.js` ya partido (J15.1), porque toca su dibujo del tablero.

**Hecho cuando** juegas una tarde entera desde el móvil, contra tu servidor, sin echar de menos el ratón ni el teclado.

---

## 🗺️ 4. El orden, y los hitos

Te recomiendo este orden. Cada hito se puede jugar, y puedes pararlo ahí y probarlo.

| Hito | Qué se puede hacer al llegar | Fases |
| :--- | :--- | :--- |
| **M1 · Se entra y se crea el personaje** | «Jugar sin conexión», elegir o crear un personaje en su pantalla, y jugar el prólogo contado como una novela visual | J0, J1 (J1.1 a J1.4), J2, J18 |
| **M2 · El gremio y la primera campaña** | Llegar al gremio, elegir una campaña en el tablón, jugarla un rato con tus compañeros (moviéndolos tú o el juego), volver y retomarla | J15.1 (partir `party.js`), J3, J4, J7 |
| **M3 · El pueblo y su gente** | Moverse por el pueblo con el selector de sitios (herrería, taberna, gremio…), también en los pueblos de cada campaña; charlar con los compañeros y quedar con ellos en una parte del día | J3.11, J14.1 a J14.6, J8.1 y J8.4 |
| **M4 · Tu campaña, con mapas y magia** | *Curse of Strahd* jugable de principio a fin, con tableros hechos de mapas de verdad y la magia de D&D | J5, J12.5, J12.8 a J12.13, J19 |
| **M5 · Una campaña entera, bien contada** | Una campaña de principio a fin sin conexión, con escenas jugadas, charlas con ramas y decisiones que pesan | J8, J9, J10, J11, J13 |
| **M6 · Los compañeros a fondo** | Las noches, las charlas de pareja, las misiones personales y, si queréis, romances | J14.7 a J14.11 |
| **M7 · En el móvil** | Jugar una tarde entera desde el teléfono, con el dedo, contra tu servidor de casa | J20 (J20.1, J20.3 y J20.5 se pueden adelantar: son solo CSS) |
| **Aparcado · Dos amigos en la misma partida** | Tú y un amigo, cada uno en su PC, con turnos en las peleas y votando las decisiones | J6, J12.1 |

**J13 (el texto) y J16 (medir) van siempre**: cada fase añade sus frases y su vuelta.

**Por qué este orden.**
- **M2 va primero** porque todo lo demás cuelga de que la partida sea el gremio y las campañas vayan dentro. Y partir `party.js` (J15.1) antes hace que lo demás no se eternice.
- **M3 (el pueblo y su gente) sube** desde el final, por tu descripción del 2026-09-29: hablar y quedar es parte del juego, no un extra. Lo que queda para M6 son las capas de encima (romances, charlas de pareja).
- **M4 y M5 pueden cambiar de orden.** Los mapas y la magia (M4) hacen falta para que Strahd se juegue bien; la historia bien contada (M5) es sobre todo texto.
- **Jugar con amigos sigue aparcado**, y cuando vuelva irá detrás de M2 por la misma razón de siempre.

---

## ⚠️ 5. Riesgos, dichos claro

- **`party.js` tiene unas 20.000 líneas**, y J4 y J6 lo tocan entero. Partirlo (J15.1) antes de M2 es lo que hace que lo demás no se eternice.
- **Jugar con amigos es lo más difícil del plan.** Lo de «el anfitrión manda» (J6) lo abarata mucho, pero sigue siendo trabajo de varias semanas, y por pasos.
- **Partir la partida en gremio y campañas** (J4.2) cambia cómo se guarda todo. Se hace una vez y con cuidado, con la vuelta completa en verde antes y después.
- **Tu JSON puede traer cosas que el juego no sabe hacer** (reglas propias, mecánicas de un módulo publicado). El conversor dice qué no ha entendido; lo que importe, se añade al motor.
- **El contenido es lo que más cuesta.** Las campañas las traes tú; el prólogo, las charlas y las escenas del gremio hay que escribirlos (J12 de antes, ahora J13 y J14, con el Gem).
- **No perder lo que funciona.** Cada fase pasa `e2e-todo.mjs` antes de darse por hecha.

---

## 📊 6. El marcador

Los números que hay que mirar al cerrar cada fase. Los de hoy, medidos el 2026-09-28.

| Qué | Hoy | Meta |
| :--- | :---: | :---: |
| Campañas en una misma partida | varias, con el mismo gremio (desde el 2026-09-28) | varias, con el mismo gremio |
| Campañas en el tablón | 2: 1387 y La Maldición de Strahd | 1387 y la tuya |
| Jugadores en una partida | 1 | 2 a 4, cada uno en su PC |
| Hitos de 1387 jugados sin conexión en la vuelta | 4 de 18 | 18 de 18, y los tres finales |
| Silencios en la vuelta sin modelo | 0 | 0 |
| Notas del juego con su versión en prosa | unas pocas de 55 | 55 de 55 |
| Filas del narrador (`frases.json`) | 133 | ~400 |
| Sucesos con decisión (`sucesos.json`) | 23 | ~80 |
| Charlas con ramas escritas | 0 | las 5 personas clave de 1387 |
| Tiempo de «Jugar sin conexión» a la primera decisión | sin medir | menos de 3 minutos |
| Todas las pruebas a la vez (`e2e-todo.mjs`) | unos 15 min | por debajo de 20 min |

---

## 🚫 7. Lo que no entra

- **Mazmorras de casillas** al estilo *Etrian Odyssey*: no es lo que buscas.
- **Arte**: ni retratos dibujados ni mapas pintados. CSS, iconos y emoji. Vuestras imágenes, si las subís.
- **Jugar por internet abierto**: solo tu servidor privado, con contraseña o lista blanca.
- **Escribir yo el texto de campañas publicadas**: lo traes tú en tu JSON.
- **La IA**, hasta J17.

---

## 🔗 Enlaces

- [[ROADMAP_SIN_TOKENS]]: lo que ya funciona sin modelo, y lo que queda de Z4 a Z7 (aquí, en J9, J10, J13 y J5).
- [[ROADMAP_MAESTRO]]: el porqué, y la pregunta de «¿por qué jugar mañana?».
- [[ROADMAP_PROFUNDIDAD]]: modos, taller, habilidades, magia, compañeros con arco y el mundo que responde.
- [[LO_QUE_FALTA]]: H1, H3, T7, T9 y K1, citados aquí.
- [[POR_HACER]]: lo pendiente del día a día.
- [[EMPEZAR_UNA_CAMPANA]]: cómo se juega hoy.
- [[GEM_CREAR_CAMPANA]] y [[GEM_GUIONISTA]]: cómo se escriben campañas hoy.
