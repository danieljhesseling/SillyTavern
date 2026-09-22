---
title: Por Hacer — Estado Real y Pendientes
tags: [todo, pendientes, estado, roadmap, deuda]
created: 2026-09-20
updated: 2026-09-22
author: DanielJHesseling / Claude Opus 5
---

# 📋 Por Hacer

Lo que falta, dividido por **quién tiene que actuar**:

| Bloque                                     | Qué es                                                              | Quién decide                  |
| :----------------------------------------- | :------------------------------------------------------------------ | :---------------------------- |
| **[A](#-a--se-puede-hacer-sin-preguntar)** | Trabajo con el camino claro: qué hay que construir ya está decidido | Nadie. Se hace                |
| **[D](#-d--necesita-una-decisión)**        | Cruces de camino: hay dos salidas razonables y elegir mal cuesta    | **Tú**                        |
| **[P](#-p--propuestas)**                   | Ideas que no están en ningún plan todavía                           | **Tú**, si alguna te convence |

El plan y el porqué están en [[ROADMAP]]; esto es el marcador.

> [!IMPORTANT]
> **El patrón a vigilar**: había mucho motor construido y testeado, y menos motor **conectado**. Desde el 2026-09-21 **la orden responde que no falta ninguno, y ya sin salvedades**. Las tareas marcadas 🖥️ son las que convierten trabajo hecho en trabajo jugable, y un módulo que solo ejecutan los tests no cuenta como hecho:
>
> ```bash
> node tools/check-engine-wiring.mjs   # 54 módulos, los 54 conectados
> ```

---

## 🟢 A — Se puede hacer sin preguntar

Ordenado por lo que desbloquea. Cada una tiene el camino decidido: si aparece una bifurcación de verdad, sube al bloque D en vez de resolverse por mi cuenta.

> [!IMPORTANT]
> **Las tres direcciones grandes están hechas.** El **Modo Videojuego** ([[PROPUESTA_FRONTEND_MODO_JUEGO]], H1–H5), la **ingesta de libros** ([[ROADMAP_INGESTA_CAMPANAS_LIBROS]], G1–G4) y el **juego por clics** ([[ROADMAP_JUEGO_SIN_COMANDOS]], K0–K4b). Se puede pegar lo que da tu Gem, comprobarlo, y jugarlo entero con el ratón a pantalla completa.
>
> Lo que queda en este bloque es **profundidad de juego**: que subir de nivel cambie algo, que la campaña se pueda compartir, y que suene a algo. Los números A se reciclan en cada ronda; los de las rondas anteriores están fechados más abajo, en *Hecho*.

Lo que entra ahora sale de **[[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]**, repasado el 2026-09-22. De sus seis piezas, dos ya estaban hechas (descansos e ingesta) y media tercera (las opciones rápidas). Estas tres tienen el camino decidido; las dos que no, están abajo en **D**.

> [!TIP]
> **Las tres hechas el 2026-09-22.** Lo que sigue se queda como estaba escrito, con el resultado debajo de cada una.

### A1 · Que subir de nivel signifique algo 🖥️ ✅

Hoy ganas XP, el número de nivel sube **y no pasa nada más**: ni PG, ni una sola elección. Es el único bucle del juego que está a medias y se nota jugando — matar cosas no te hace más fuerte.

Alcance decidido, corto a propósito:

- **Umbrales de XP y dado de golpe por nivel en el paquete de reglas**, no en código. Es tu requisito de *«sin tocar código»* aplicado a la progresión: una campaña más lenta o más rápida se edita desde `/rules`.
- Al cruzar el umbral, **PG nuevos** (tirada o media fija, como en 5e) y **+1 dado de golpe**.
- Cada cuatro niveles, **mejora de característica**: +2 a una o +1 a dos.
- Un aviso en la ficha y en la tira del grupo, con su botón. No hay nada que teclear.

Lo que **no** entra: subclases, dotes y conjuros aprendidos. Las subclases piden un catálogo por clase y los conjuros no existen todavía (ver **D5**). Determinista y gratis: no toca al modelo.

**Hecho.** `rules/level-up.js` (29 tests): la tabla de 5e vive en el paquete de reglas y se edita desde `/rules`, se suben **todos** los niveles que la experiencia dé de una vez, los PG salen del dado de la clase más Constitución (media fija, o tirada si se pide) y nunca son menos de 1. La tarjeta dice lo que va a pasar **antes** de pulsar y no deja confirmar hasta repartir los puntos; ninguna característica pasa de 20. Se llega por tres sitios: la ficha del personaje, la ficha de compañero del Modo Juego, y una estrella en su cara de la tira del grupo.

> **Un fallo que solo salió en el navegador**: la tarjeta se abría **detrás** de la ficha del personaje. La ficha es un `<dialog>` nativo y un `<dialog>` pinta en la capa de arriba, por encima de cualquier `z-index`, así que una capa propia abierta desde dentro no se podía ni ver ni pulsar. Ahora la tarjeta es un popup como los demás.

### A2 · El botón de exportar la campaña 🖥️ ✅

Era **P9**, y sube aquí porque es la mitad que falta de *«sin marketplace»*: hoy puedes **importar** el libro de un amigo pero no **mandarle** el tuyo. El importador ya define la forma del paquete y el validador ya sabe comprobarla, así que exportar es serializar lo que hay contra un esquema que existe.

Mundo, tableros, bestiario, misiones, mapa de campaña y reglas en un archivo. Sin plataforma de por medio: lo pasas por donde pasas cualquier otro archivo.

**Hecho.** `campaign/campaign-export.js` (17 tests) y `/exportar-campana`, también en el menú de pausa. Sale **exactamente** el formato que valida el importador — el mapa vuelve a ser texto con sus muros y sus puertas, y los objetivos vuelven a ser **nombres** en vez de identificadores de tu partida, que en otra instalación no significan nada. La prueba que importa es la ida y vuelta: exportar → validar → importar → el mismo tablero con los mismos enemigos en las mismas casillas.

> Dos cosas no vuelven, y se dicen en voz alta: la **estructura de misiones** del libro (un tablero guarda los objetivos de todas las suyas, así que sale una misión por tablero) y **lo jugado** — vida, posiciones, vínculos y día son tu partida, no la campaña.

### A3 · Sonido por escena ✅

`audio-player.js` ya existe en SillyTavern y el director de escenas ya sabe si estás en combate, en diálogo o explorando: es enchufar uno a otro. Combate, taberna, cripta — **con tus propios archivos**, que es lo único que hace falta que pongas tú.

Es la pieza que menos código lleva y la que más cambia cómo se siente. Si alguna vez el juego tiene que *parecer* un juego delante de alguien, es esta.

**Hecho**, aunque no como decía la nota: `audio-player.js` de upstream es el reproductor **con controles** de los mensajes de audio, no un sistema de música de fondo, así que no servía. En su lugar hay `shell/scene-audio.js` (12 tests) y un panel en `/sonido`, también en la pausa: una casilla por escena donde pegas una dirección, un volumen, y un botón para probar cada pista.

**Las pistas las pones tú.** No trae ni un archivo — aquí no hay música con licencia de nadie — y una escena sin pista **calla** en vez de heredar la de al lado. Al apagar el Modo Juego se calla también: la música es del juego, no de la aplicación.

### A4 · Un pueblo tranquilo tiene que poder existir 🖥️ ✅

Sale de leer [[DISENO_GENERADOR_MUNDOS_PROFUNDO]], y es su idea más valiosa: **una localidad puede tener 0, 1 o N tableros**. Hoy puede tener 1 o N. **Cero, no.**

El paquete de campaña no tiene lista de localidades: el importador las **deduce** de los tableros (`board.locationName`), así que un sitio sin tablero no llega a existir. Consecuencia: una aldea donde solo se compra, se habla y se sube un vínculo — o sea, **la mitad del bucle de Persona** — no se puede escribir en un libro ni importar.

El camino está decidido:

- Una lista `locations[]` **opcional** en el paquete: `id`, `name`, `type`, `description`, y a qué facción pertenece.
- El importador las crea aunque no tengan tablero; las que solo aparezcan en `board.locationName` se siguen deduciendo igual, para que los paquetes de hoy sigan entrando.
- El exportador las escribe de vuelta, y el validador avisa de la localidad que nadie visita y del tablero que apunta a una localidad que no existe.

Lo que **no** entra: tiendas, posadas y templos. Eso es **P15**, y necesita mecanicas nuevas; esto es solo poder decir que el sitio existe.

**Hecho el 2026-09-22.** `locations[]` es una sección más del contrato — con `type`, `region` y la facción que manda — y sale en el esquema que `/esquema-campana` le entrega a tu Gem, con dos reglas nuevas escritas. El importador crea las declaradas **antes** de mirar los tableros, y sigue deduciendo las que solo aparezcan nombradas por uno: **un paquete de ayer entra hoy igual**. El exportador se las lleva de vuelta, el validador avisa del tablero que apunta a un sitio no declarado y de la facción que no existe, y el informe del asistente cuenta ahora las localidades.

El **ejemplo que publica el contrato** trae ya una aldea sin tableros — *Vado de la Rueda* — a propósito: es la forma más corta de enseñarle a un autor que puede hacerlo. Y el panel de localización, en vez de quedarse en blanco, dice *«aquí no hay ningún tablero: es un sitio para hablar y pasar el rato, no para pelear»*.

> Un detalle que salió al montarlo: la vista de una localidad medía lo que su tablero más grande. Una sin tableros no tiene de dónde sacar ese tamaño, así que toma el de una campaña nueva — y las que sí tienen siguen creciendo con el suyo, exactamente como antes.

### A5 · Las cinco del catálogo V2 ✅

De [[PROPUESTAS_MEJORA_V2]], las que más dan por lo que cuestan. Hechas el **2026-09-22**.

**PROP2-039 · ¿Se puede llegar?** (`board/reachability.js`, 13 tests) Una inundación desde donde empieza el grupo, al validar un libro: una sala amurallada con su cofre y sus dos goblins **validaba perfectamente** — mapa rectangular, borde de muro, enemigos sobre suelo — y no se notaba hasta estar dentro buscando la puerta que no existe. Las puertas cerradas no cortan la inundación (se abren); los muros sí. Un enemigo inalcanzable es **error**; una sala vacía incomunicada, aviso. Y si el tablero ya tenía otro fallo, no se sermonea dos veces: una causa, un mensaje.

**PROP2-053 · Ataques de oportunidad** (`combat/opportunity.js`, 12 tests) Salir del alcance de quien te tenía pegado cuesta un golpe gratis. Sin esto **alejarse era gratis**, y si alejarse es gratis la cobertura, los cuellos de botella y el guardián que se interpone no significan nada. Una reacción por ronda cada uno, así que un solo enemigo no cobra peaje a todo el grupo. Lo resuelve **el mismo código** que cualquier otro ataque enemigo — hubo que extraerlo del turno enemigo para eso, porque dos copias de esa aritmética discreparon seguro.

**PROP2-059 · Salvaciones de muerte** (`rules/death-saves.js`, 20 tests) Caer a 0 PG era quedarse *Unconscious* y ahí se acababa: ni se moría uno, ni se recuperaba. Ahora son los tres éxitos contra los tres fallos de 5e, con el 20 natural que levanta con 1 PG, el 1 que cuenta doble, y el golpe sobre un cuerpo caído como fallo automático. La cuenta se ve **en la cara de la tira del grupo**, que es donde se mira quién está cayendo. Curar a quien está en el suelo lo levanta y borra la cuenta.

> Se tira **una vez por ronda** y no al empezar su turno: la máquina de turnos salta a quien no puede actuar, así que el turno de un caído no llega nunca. Es lo mismo y no pide reescribirla.

**PROP2-005 · La ruta antes de pulsar** Al pasar por encima de una casilla encendida se dibuja el camino y **lo que cuesta llegar**, en verde si te llega el movimiento y en rojo si no. La calcula el mismo A* que usa la IA enemiga: una línea dibujada a ojo diría una cosa y el movimiento haría otra, que es peor que no dibujar nada.

**PROP2-163 · Puntos de retorno** (`campaign/checkpoint.js`, 11 tests) `/punto guardar <nombre>`, `/punto` para verlos y `/punto volver <número>`. Y uno **automático antes de cada jefe** (CR 2+ o 40+ PG), que es lo que convierte un combate duro en algo que se intenta en vez de algo que se evita. Guarda el estado del juego — grupo, combate, calendario, vínculos, mapa — y **no la conversación**: el chat es de SillyTavern y tiene su propio historial. El automático nunca desplaza al que guardaste tú.

### A6 · El juego se abre por su pantalla de título ✅

Hecho el **2026-09-22**. `npm start` ya no te deja en la bandeja de chats de SillyTavern: abre el Modo Juego en su **menú principal**, con tres cosas y una puerta.

```
        ⚔  SillyTavern RPG

        ▸  Partida nueva        Una plantilla, un mundo generado o un libro
        ▸  Cargar partida       3 campañas guardadas
        ▸  Opciones             Los ajustes de SillyTavern, donde siempre

        · Salir al SillyTavern de siempre ·
```

- **La lista de partidas espera detrás**, no delante: empezar en la rejilla era empezar en medio.
- **Opciones** no es una pantalla nueva: pulsa el icono de SillyTavern y sus paneles se abren donde siempre. Cero mantenimiento.
- **No decide la pantalla**: eso es del director. Sin campaña abierta cae en el título; con una a medias te deja donde lo dejaste, que es lo que uno espera de un juego al que vuelve.
- **Se apaga desde la pausa** (*No abrir el juego al arrancar*), y apagado la aplicación arranca **exactamente** como la de siempre. Un juego que no te deja no jugarlo estorba.

> **Nada de esto toca la pantalla de bienvenida de upstream.** Se pone encima; debajo sigue SillyTavern entero. Es la misma regla que ha hecho barato todo lo demás.

**Dos fallos que cazó el recorrido**, y los dos eran de verdad: con el menú delante, el botón de *Nueva campaña* y la lista de campañas quedaban **ocultos** — el recorrido entraba por ahí y se quedó seco. Y la rejilla del título tenía dos filas para tres hijos, así que la cabecera de la bienvenida se comía el botón de *Volver*: no era un problema del test, no se podía pulsar.

### A7 · Crear una campaña a mano ✅ **Hecho el 2026-09-22 — las seis fases**

Se abre desde el propio asistente al crear —el paso final ofrece **Crear y jugar** o **Crear y escribir el mundo**—, desde el menú de pausa (*Editar la campaña*) o con `/campana`. Que hubiera que saberse el comando era justo lo contrario de [[ROADMAP_JUEGO_SIN_COMANDOS]]. Siete pestañas, una por categoría, y lo que escriben es **exactamente** lo que escribe el importador de libros: un destino, dos puertas.

| Pestaña | Qué escribe |
| :--- | :--- |
| **Mundo** | Nombre visible, género, sinopsis |
| **Localidades** | Sitios con su tipo y su región; tableros con su tamaño, dónde empieza el grupo y qué enemigos hay puestos. **Cero tableros es válido** y lo dice |
| **Personajes** | Dos listas — *en tu grupo* y *en el mundo* — con clase, nivel, raza, las seis características, PG, CA, dónde está, pasado, personalidad, arcano, cara y las palabras que lo despiertan en el chat |
| **Bestiario** | PG, CA, desafío, velocidad, alcance y **perfil táctico** de los cuatro que el motor juega. Avisa antes de borrar un bicho que algún tablero coloca |
| **Facciones** | Metas y reputación inicial — diciendo que la reputación **todavía no hace nada** |
| **Objetos** | El catálogo del mundo, y **de ahí sale el botín**: la rareza decide el peldaño |
| **Misiones** | Nombre, acto y el tablero donde se juega |

El agujero que cierra, dicho en corto: `dndData` — lo que convierte una ficha del Lorebook en un monstruo con CA o en un confidente con arcana — **se leía en veinte sitios y no se escribía en ninguno**.

**Las tres cosas que lo hacen de verdad y no una pantalla bonita:**

- **Reclutar** mueve a alguien del mundo al grupo, ahí mismo, y le da casilla donde plantarse. Era el puente que no existía.
- **Guardar no rehace el grupo.** Rehacerlo habría devuelto a todos la vida llena, cero de oro y la mochila vacía; lo que se copia encima es solo lo que la ficha dice.
- **El botín sale del catálogo**: un objeto escrito aquí cae de verdad, y cae como el arma que se escribió — con sus dados y su ranura — en vez de como un trasto genérico.

`items[]` viaja ya en el contrato del paquete, en el exportador y en el importador, con su prueba de ida y vuelta; y las misiones se guardan como misiones, así que el exportador ha dejado de inventarse una por tablero.

**Lo que queda dicho en claro y no hecho**: la reputación no cambia precios (P17), encadenar misiones no se puede escribir todavía, la casilla concreta de un PNJ no se elige, y un objeto solo se le puede dar a alguien del grupo.

---

## 🟠 D — Necesita una decisión

Cada una es una bifurcación real: las dos salidas son defendibles y la elección cuesta después. Llevan mi recomendación, pero la decisión no es mía.

### D1 · `npm audit`: 47 vulnerabilidades, una crítica

Están en el árbol de dependencias tras el merge. Actualizarlas puede romper cosas de upstream que no controlamos.

**Recomiendo mirar solo la crítica** y dejar el resto hasta el próximo merge con upstream, que probablemente las arrastre.

### D2 · Reconciliar los tokens con el proveedor ❌ **Decidido: no, el 2026-09-22**

`/prompt` mide lo que la aplicación envía, no lo que factura la API, porque SillyTavern no devuelve el `usage` a la página. Conseguirlo exige interceptar las respuestas (y con streaming llegan troceadas), que es meter mano en terreno de upstream.

**Recomiendo no hacerlo.** Para decidir qué recortar basta con comparar turnos entre sí, y eso ya funciona.

### D3 · ¿El registro de combate debe sobrevivir a una recarga? ❌ **Decidido: dejarlo como está, el 2026-09-22**

Hoy es estado de sesión: al recargar empieza vacío, aunque las líneas siguen en el chat. Persistirlo significa guardar hasta 300 entradas por combate en el mundo.

**Recomiendo dejarlo como está** salvo que al jugar lo eches en falta. Es el tipo de cosa que solo tú puedes saber.

### D4 · Las plantillas del asistente siguen siendo código

Añadir una a mano exige editar `starter-templates.js`. Convertirlas en datos (`N-12`) era tu requisito de *«sin tocar código»* aplicado al inicio de partida — pero ahora la generación con IA cubre el caso práctico.

**Recomiendo aplazarlo** hasta que quieras una plantilla fija concreta que la IA no te dé.

### D5 · La magia: ¿cuánta, y cuándo? ✅ **Decidido: la ligera, el 2026-09-22**

**No hay magia.** Ninguna: ni trucos, ni espacios de conjuro, ni recursos de clase. El combate resuelve armas. Un D&D sin conjuros deja fuera a la mitad de las clases — el mago, el clérigo, el brujo y el druida no son jugables como tales — y eso ninguna narración lo tapa: puedes *contar* que lanzas una bola de fuego, pero el motor no la tira, no la resuelve y no la cuenta.

No cuesta tokens — la resolvería el motor, como el resto del combate — pero **es la pieza más cara de todo lo que queda**, y por eso es una decisión y no una tarea:

| Salida                           | Qué es                                                                                                                                                      | Qué cuesta                                                                                                                                                    |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Magia completa 5e**            | Ranuras de nivel 1–9, conjuros preparados, áreas de efecto, concentración, componentes                                                                      | Tres o cuatro baterías. Las áreas (*línea de 30 pies*, *esfera de 20*) son geometría nueva en el tablero, y la concentración es una máquina de estados propia |
| **Recursos de clase, ligero** 💡 | Una reserva de usos por personaje («ranuras» sin nivel) y una lista de **efectos** editables desde `/rules`: daño a distancia, curación, condición, empujón | Una batería. Cubre *Furia*, *Tomar Aliento*, *Imposición de Manos* y un *Rayo de Fuego* con las mismas piezas                                                 |

**Recomiendo la ligera**, y por la misma razón que funcionó el paquete de reglas: un conjuro pasa a ser **datos que editas tú** en vez de una tabla cerrada que hay que escribir clase a clase. Si más adelante quieres las ranuras de 5e de verdad, se añaden encima; al revés no.

[[DISENO_GENERADOR_MUNDOS_PROFUNDO]] ya trae **la forma de los datos** para esto, y es buena: un catálogo único (`spellsAndAbilities`) que referencian por id tanto los personajes como los enemigos, con coste de acción, alcance, área, recurso que gasta, tirada o salvación, daño o curación, y condiciones que aplica. Un catálogo compartido es justo lo que hace que la misma pieza sirva para la *Furia* de un bárbaro y para el aliento de un dragon. Lo caro no es el catálogo: son las **áreas de efecto** (una línea de 30 pies es geometría nueva en el tablero) y la **concentración**.

**Hecho el 2026-09-22, y la ligera.** `rules/abilities.js` (26 tests): una habilidad son cuatro preguntas — qué cuesta, cuántas veces, a quién alcanza y qué hace — y con eso salen la *Furia*, el *Tomar aliento* y el *Rayo de fuego* con las mismas piezas.

- **El catálogo vive en el paquete de reglas**, así que un conjuro nuevo es una fila. Hay un panel propio, **`/habilidades`**, con un campo por cosa en vez del JSON del editor de reglas, y ahí mismo se reparte **quién se sabe cada una**.
- **Tres formas de resolverse**: sale siempre, tirada de ataque contra la CA (con crítico que dobla dados) o tirada de salvación contra una CD (superarla parte el daño por la mitad y evita la condición).
- **Los usos se gastan y los descansos los devuelven**: el corto devuelve lo de descanso corto, el largo lo devuelve todo. Va enganchado donde ya se descansa.
- **Las de enemigo salen en su tarjeta** — cada una con su alcance, así que un conjuro de 120 ft no está *«fuera de alcance»* porque la espada llegue a 5 — y **las de uno mismo o de aliado, en un botón nuevo de la barra de combate**, que pregunta a quién cuando hace falta.
- **Las condiciones con duración se van solas** (`combat/condition-timers.js`, 10 tests). Un *«derribado una ronda»* que dejara al goblin en el suelo para siempre habría sido un número decorativo; lo puesto a mano con `/condition` sigue quitándose a mano.

> **Lo que no entra, y se dice**: no hay ranuras de nivel 1 a 9, ni conjuros preparados, ni concentración, ni áreas de efecto — una línea de 30 pies es geometría nueva en el tablero, y eso es otra batería. **Los enemigos todavía no las usan**: el catálogo es compartido y su IA no sabe lanzarlas. Si algún día hacen falta las ranuras de verdad, se añaden encima de esto; al revés no.

### D6 · ¿Que el DM pida tiradas? ❌ **Decidido: no, el 2026-09-22**

La Pieza 1 de [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]: que el narrador escriba `[CHECK: Percepción | CD 13 | Actor: Lyra]`, el motor tire el d20 con su modificador y el resultado decida lo que pasa. Es lo que hace que un DM de IA se sienta un DM y no un narrador.

La costura ya existe y es la buena: `roll-guard.js` intercepta las tiradas que el modelo se inventa y las sustituye por las del motor. Esto es el mismo mecanismo al revés — el modelo **pide**, el motor **tira**. Y si el modelo no escribe el bloque, no se rompe nada: se sigue jugando como hoy.

**Por qué lo decides tú**: de las seis piezas es **la única que cuesta tokens en cada turno**, porque hay que explicarle el protocolo al modelo. Con tu tope de 5 € eso no es un detalle. Si se hace, el bloque va en el prefijo estable (el tier `rules`) o se carga la caché en cada mensaje, y habría que **medir si el modelo obedece**: un protocolo que falla la mitad de las veces es peor que no tenerlo.

**Decidido que no, por ahora.** Cuesta en todos los turnos y depende de que el modelo obedezca; el motor ya tira, ya audita y ya corrige lo que el narrador se invente. Si algún día apetece, la costura (`roll-guard.js`) sigue ahí.

---

## ✅ Decisiones tomadas — 2026-09-21

| ID | Qué se decidió | Consecuencia |
| :--- | :--- | :--- |
| **D1** | **Conectar la máquina de turnos** | Hecho. El combate real la usa: una sola definición de turno, con acción, acción adicional y reacción. Desbloquea las perks de vínculo |
| **D2** | Proveedor principal: **Gemini** | La caché de upstream (`claude.cachingAtDepth`) no sirve aquí, pero **la parte que importa sí es agnóstica**: los tres grandes cachean por *prefijo* — OpenAI automáticamente, Gemini de forma implícita en los 2.5, Claude con marcas. Lo que hay que hacer es que **el principio del prompt no cambie entre turnos**, y eso vale para todos |
| **D3** | **Evaluar *Summarize* de upstream** antes de escribir nada propio | Sin empezar. Solo importa cuando una campaña se alargue |
| **D4** | **Solo juego local** | Los tres agujeros de upstream (CSP, secretos en texto plano, jQuery 3.5.1) se quedan como están, a propósito. Si algún día abres el servidor a la red, pasan a ser lo primero |

---

## 🔵 P — Propuestas

Ideas que no están en ningún plan. Ninguna es necesaria; algunas son buenas. Marco con 💡 las que haría yo.

### Que la IA haga más, por la tubería que ya existe

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P1** 💡 | **Generar escenarios con IA** | La Fase F genera mundos. Generar *misiones* — objetivos, salas, enemigos dormidos — es la misma tubería contra el esquema de `scenarios.js`, y es lo que convierte una mazmorra en una campaña. Hoy una mazmorra importada ya tiene salas; falta que el generador las proponga |
| **P2** | **Generar confidentes con IA** | Personajes con su arco, su vínculo y su perk de combate, validados contra `bonds.js`. Depende del importador, que ya existe |
| **P3** | **Generar un enemigo suelto** desde el tablero | *«Añade un chamán goblin a este encuentro»* sin salir de la partida. Una llamada corta, mismo esquema que los enemigos del mundo |
| **P4** | **Paquetes de reglas de ejemplo** | Variantes listas para importar desde `/rules`: *más letal*, *sin magia*, *armas históricas*. Enseñan para qué sirve el editor mejor que cualquier explicación |

### Ver lo que el motor sabe

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P5** 💡 | **Panel del estado canónico** | Una vista con todo lo que el motor da por cierto: HP, posiciones, vínculos, misiones, día, banderas. Hoy ese estado existe repartido y solo se ve de refilón. Sería el complemento de `/prompt`: uno muestra lo que se envía, el otro lo que el juego cree |
| **P6** | **Chequeo de campaña sana** | Una orden que revise si un mundo se puede jugar: enemigos con reglas de encuentro, posiciones de inicio transitables, tableros con terreno. **Cada uno de esos tres ha sido un fallo real** — el chequeo los habría cazado a todos |
| **P7** | **Deshacer en el tablero** | Pintar terreno y mover fichas no tiene vuelta atrás. Una pila de deshacer por tablero |

### Que el juego aguante una campaña larga

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P8** 💡 | **Punto de guardado de la partida** | Un *checkpoint* del estado canónico al que volver. Es lo que hace seguro experimentar: probar un combate difícil, o una decisión que no sabes si te va a gustar |
| **P9** | **Exportar la campaña entera** (`.tavernworld`) | ⬆️ Subida al bloque **A2**: es la mitad que falta de *«sin marketplace»* |
| **P10** | **Turnos transaccionales** (`N-04`) | Si un turno se corta a la mitad, ¿se aplicó el daño? Hoy cada acción se aplica al instante y el motor es determinista, así que el riesgo es bajo. Importaría si el modelo llegara a escribir estado |
| **P11** | **Presupuesto de merge como métrica** (`N-08`) | Un script que falle si un commit toca un archivo de upstream sin justificarlo. Convierte la disciplina del fork en algo verificado en vez de recordado |

### Del plan Friends & Fables y de la propuesta original

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P14** | **Confidentes que no están en tu grupo** | Hoy los vínculos solo existen para miembros del grupo. En Persona la mitad de los confidentes son gente del pueblo: la tabernera, el herrero. La lógica de `bonds.js` no distingue — lo que falta es que un NPC del mundo pueda tener rango sin ir contigo a pelear |
| **P15** | **Que el día sirva para algo más que descansar** | La tabla de bloques de tiempo de [[PROPUESTA_JUEGO_DND_GLOOMHAVEN_PERSONA]] promete *entrenar*, *estudiar* y *comprar en el mercado*. Hoy un bloque del día solo se gasta descansando o pasando el rato con alguien. Es media mecánica de Persona sin construir |
| **P16** | **Encuentros nocturnos al acampar** | Un descanso largo en territorio hostil es hoy igual de seguro que en una posada. Con las reglas de encuentro que ya existen, montar guardia pasaría a significar algo |

### Del generador de mundos profundo

De [[DISENO_GENERADOR_MUNDOS_PROFUNDO]]. Ordenadas por lo que dan a cambio de lo que cuestan; ninguna hace falta para jugar hoy.

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P17** 💡 | **Que la reputación de facción haga algo** | El importador **ya guarda** la reputación de cada facción, y **nada la lee**: es un número decorativo. La escala del documento (−100 a +100, con hostilidad, recargo, descuento y acceso) coincide con el rango que ya usa el paquete de reglas. Es la pieza con más juego por menos código de toda la lista |
| **P18** 💡 | **Rutas de viaje con tiempo y peligro** | Hoy `/go` te teletransporta gratis. Un grafo de rutas con `distanceDays`, `dangerLevel` y peaje conecta el mapa con **el calendario que ya existe**: viajar gastaría bloques del día, y el día ya significa algo desde los descansos |
| **P19** | **Horarios de PNJ por franja del día** | Que el herrero esté en la fragua por la mañana y en la taberna por la noche. Con el calendario y las localidades puestas, es casi solo datos |
| **P20** | **Interactuables en el tablero** | Cofres con CD de forzado, palancas que abren puertas, barricadas con PG. El tablero ya sabe de puertas y salas: esto es la misma idea con otro nombre |
| **P21** | **Oleadas de refuerzos** | *«En la ronda 3 entran dos arqueros por la casilla (12,0)»*. El despertar de salas ya existe; esto es lo mismo disparado por ronda o por evento |
| **P22** | **Fases de jefe** | Al 50% de PG cambia de perfil táctico o sube la CA. Barato: el perfil ya es un campo, y cambiarlo a mitad de combate es una línea |
| **P23** | **Terreno nuevo: agua, lava, trampas, elevación** | El documento propone `W`, `L`, `T`, `^`. **Prerrequisito**: hoy los tipos de terreno son **código** (`board/terrain.js`), no datos. Sacarlos al paquete de reglas es la mitad del trabajo, y de paso cumple tu requisito de *«sin tocar código»* en un sitio donde aún no se cumple |

### Sobre el propio desarrollo

| ID | Propuesta | Por qué |
| :--- | :--- | :--- |
| **P12** | **Commits por bloque de trabajo** | Ya lo estás haciendo. Merece quedarse escrito por qué importa: dos veces ha habido que recuperar un archivo con `git checkout --`, y solo se pudo porque estaba en git |
| **P13** | **Un `CHANGELOG.md` del fork** | Qué cambió y por qué, en la lengua del juego y no en la del código. La wiki cuenta el plan; esto contaría la historia |

---

## 🟡 Deuda conocida

No es trabajo pendiente, es información: cosas que están así **a propósito**, con su motivo, para que nadie las «arregle» sin saberlo.

| Tema | Por qué está así |
| :--- | :--- |
| **`party/html.js` duplica `escapeHtml`** | Importar `utils.js` arrastra código que exige `window` y rompería los tests en Node. Hay un test que ancla el contrato. Si algún día `utils.js` expone un módulo hoja, esto se elimina |
| **`escapeHtmlText` sigue en `world-info.js`** | Es correcta y está en un archivo de upstream. Consolidarla no aporta seguridad y sí coste de merge |
| **El guardián de tiradas solo mira afirmaciones estructuradas** | `1d20+5 = 23` sí; «saca un 18» no. Reescribir prosa exige entender la frase, y equivocarse es peor que no tocarla. El prompt debe pedir la forma estructurada |
| **La cobertura cuenta por casilla, no por línea de tiro** | Simplificación declarada de D&D 5e. Arreglarla es A5 |
| **`dynamic-context-manager.js`, `campaigns.js` y `world-content-browser.js` sin tests** | 1.232 tests cubren el motor nuevo; estos tres (unas 3.000 líneas) siguen a cero. `MAINT-03` |
| **La generación con IA no se ha probado con un proveedor real** | El recorrido de navegador usa un generador simulado: ejercita todo menos la llamada. Falta ver si un modelo concreto respeta el esquema del mapa |

---

## 🧪 Probarlo a mano (cinco minutos)

*Esta lista es para comprobar que todo sigue en pie. Para **jugar**, la guía es [[EMPEZAR_UNA_CAMPANA]].*

1. `npm start` y abre <http://localhost:8000>. Si el servidor llevaba abierto desde antes de los últimos cambios, reinícialo y recarga con `Ctrl+F5`.
2. En la bienvenida, **Nueva campaña**. Tienes dos caminos:
   - *Mazmorra clásica* (o cualquier plantilla) → un nombre → `Lyra` y `Brand`.
   - **Generar con IA** → describe el mundo (*«una cripta inundada bajo una iglesia en ruinas»*) → **Generar**. Verás el mapa antes de crear nada, con los arreglos que haya hecho falta. Si no te convence, genera otra vez o elige una plantilla. *(Solo aparece si tienes un proveedor conectado.)*
3. **Crear campaña**. Acabas en el tablero, con el grupo colocado.
4. **Haz clic en una puerta**: se abre y queda dibujada con trazo discontinuo.
5. `/fight <enemigo> 1` — el nombre lo puso la plantilla o la IA. Aparece el **registro de combate** bajo el tablero, con el desglose de cada tirada.
6. `/combat-stop` para abandonarlo. En el chat aparece un mensaje de **narrador** con el resumen: ese es el único que lee el modelo.
7. `/rules` → *Tipos de daño* → **Añadir** → `void` / `Vacío` → **Aplicar sección** → **Guardar reglas**. Te ofrece recargar; al hacerlo, ese tipo de daño está en las fichas.
8. `/prompt` (después de haber enviado algún mensaje) → qué ocupa cada bloque del turno y cuánto llevas de sesión.
9. Bajo el tablero, **Terreno**: pinta muros y recarga; siguen ahí.
10. `/sandbox` abre el banco de pruebas de combate sin tocar tu campaña.
11. Cierra el chat: la campaña sale con **Continue**. Un mundo que existe pero nunca se jugó sale con **Iniciar**.
12. Con un combate en marcha, `/modojuego`: el tablero a pantalla completa. **Atacar** lista a quien tengas al alcance.
13. Dentro del Modo Juego, tecla `1`: la escena de diálogo, con el chat movido debajo del retrato. Escribe algo y envíalo. `3` vuelve al tablero; `Esc` sale de la caja de texto y otro `Esc` apaga el Modo Juego.
14. Desde la escena de diálogo, `/fight <enemigo> 1`: **la pantalla salta sola al tablero**. `/combat-stop` y vuelve sola a la conversación, con el epílogo. Pasa el ratón por la cabecera y te dice por qué cambió.
15. Tecla `2`: el mapa con el panel de viaje. Pulsa un tablero y la pantalla cambia sola; gana su misión y la localización queda marcada como superada.
16. `Esc`: el menú de pausa. **Opciones** abre los paneles de SillyTavern donde siempre; **Salir al menú principal** te deja en el título, con tus campañas, sin salir del juego.
17. **Nueva campaña → Importar un libro**: pega lo que te dé tu Gem (o el ejemplo de `/esquema-campana`) y pulsa **Comprobar**. Si pasa, créala y juega en ella.
18. En el libro importado, `/enter El sótano` y **haz clic en la puerta**: se revela la sala y despierta lo que dormía detrás, en su casilla.
19. `/descanso corto` y `/descanso largo`, o los botones de la pestaña **Campaña**. Mira cómo cambian los PG y el día.
20. `/objetivos editar`: cambia lo que hay, añade uno, o pulsa **Proponer con IA** si tienes proveedor. Guarda y `/objetivos` lo lee.
21. `/enemigos`: cambia quién puede salir en este tablero y cuántos. `/fight` lo nota.
22. Gana un combate y mira el inventario: el botín está como objetos, no como texto.
23. `/semilla molino`, juega un combate, y repite: sale igual. `/semilla` sola vuelve al azar.
24. `/contradicciones`: lo que la narración ha dicho y el motor no confirma.

Y sin tocar nada, el recorrido completo en un navegador de verdad:

```bash
node tools/e2e-campaign.mjs            # servidor y datos propios; no toca los tuyos
node tools/e2e-campaign.mjs --headed   # para verlo
```

Lo que **no** se puede probar todavía: calendario, vínculos y escenarios (#6, #7, #8), y la generación con IA contra un proveedor real (#25).

---

## ✅ Hecho, para no rehacerlo

### La última batería: infraestructura — 2026-09-21

Cinco, y con ellas **el bloque A queda vacío**.

**El pegamento, fuera de `party.js`.** El reloj, los vínculos, los descansos y el mapa de campaña se van a `party/campaign-state.js`, con sus dependencias **pasadas, no buscadas**: el módulo dice arriba qué necesita y nada dentro alcanza una variable global. Salen 188 líneas y, con ellas, doce imports que ya no hacían falta. Ese es el corte que separa un archivo que crece de uno que se puede leer.

**El registro de contradicciones** (`ui/contradiction-log.js`, 21 tests). Tras cada turno compara lo que el modelo contó con lo que el motor sabe: a quién da por muerto y sigue en pie, qué puntos de vida dice que quedan, un combate que no ha empezado, una hora que el calendario no confirma. **No corrige nada, a propósito**: una narración que contradice el estado es un problema de prompt, y lo que arregla un problema de prompt es un prompt mejor, no reescribir en silencio lo que escribió el modelo. `/contradicciones` las agrupa por tipo, porque una es un accidente y veinte iguales son una línea que falta en el prompt.

**Los dados, repetibles** (`combat/seeded-random.js`, 15 tests). `/semilla molino` y la partida rueda igual dos veces; `/semilla` sola vuelve al azar. Sin esto, cada pregunta sobre si un cambio mejoró algo chocaba con la misma pared: el combate fue distinto, así que quién sabe. La semilla se guarda con la partida, no con la sesión.

**El snapshot del prompt** (`tools/check-prompt-shape.mjs`). Falla si la forma del prompt cambia sin que nadie lo diga. Comprueba **la forma** —qué bloques hay, en qué orden, de qué nivel— y nunca el texto, que debe cambiar en cada turno. Mover un bloque hacia delante invalida la caché de todo lo que venga detrás, y eso ya no puede pasar en silencio.

**Y el recorrido ya cubría las salas**: los pasos 23 y 24 importan un libro, abren una puerta y pelean con lo que había detrás.

**Un fallo mío que cazaron los tests**: al hacer los dados sustituibles capturé `Math.random` al cargar el módulo, así que sustituirlo después dejaba de tener efecto — y eso rompía cinco tests que lo hacen. Ahora se consulta en cada tirada.

### Seis del bloque A, de una vez — 2026-09-21

**El vínculo de rango 10 ya es algo.** Llevaba meses siendo una etiqueta, porque *«desbloquea su habilidad definitiva y su arma personal»* es una frase, no una regla. Ahora son dos cosas: un **arma personal** de verdad —un objeto en la ficha, con su nombre, que se equipa como cualquier otro— y un **golpe definitivo** (`/definitivo`) que impacta sin tirar y hace el máximo del arma más el nivel, una vez al día. Conceder un impacto automático es mucho: por eso cuesta un día entero y diez rangos de un vínculo que solo suben los hechos registrados.

**El botín ya son objetos.** Lo que soltaban los enemigos se añadía como texto al inventario: una poción que no se puede beber y una espada que no se puede equipar son ambientación con pasos de más. `combat/loot-items.js` declara qué es cada cosa —tipo, peso, dado de daño, ranura— y hay un test que falla si un paquete de reglas añade botín que nadie declaró.

**Los enemigos de un tablero, editables** (`/enemigos`). Los escribe el asistente y los escribe el importador; cambiarlos obligaba a abrir World Info y editar una lista de uids a mano, que es justo lo que este proyecto promete que no hace falta.

**La cobertura, por línea de tiro.** Hasta ahora contaba la casilla del objetivo, con una consecuencia rara: un pilar te protegía solo si estabas **dentro** de él, nunca si estabas detrás. De qué lado viene el disparo es la idea entera de la cobertura.

**Un cambio de reglas avisa de lo que rompe** (`rules/rule-impact.js`). Quitar un tipo de daño que una espada usa la dejaba apuntando a algo que ya no existe, y solo se notaba tres sesiones después. No se impide el cambio —es tu campaña— pero ahora se decide con la factura delante.

**Y las generaciones con IA se guardan y se editan.** Cada intento queda como un botón al que volver, y el mapa se puede corregir en la propia previsualización: el modelo acierta con la sala y falla con una pared, y abrir el editor de terreno después de crear la campaña para mover un muro era el camino largo.

### Descansos, prefijo estable del prompt y objetivos editables — 2026-09-21

Tres del bloque A, de una vez.

**Los descansos** (`rules/rest.js`, 20 tests). `/descanso corto` gasta dados de golpe —cada uno cura su tirada más el modificador de Constitución— y cuesta un bloque del día. `/descanso largo` cura del todo, devuelve **la mitad** de los dados gastados, redondeando hacia abajo y nunca menos de uno, y amanece. Esa asimetría es toda la economía: puedes remendarte en una tarde, pero solo dormir rellena el depósito, y ni siquiera del todo.

Quien está a cero no se levanta con un respiro —eso pide un conjuro o que alguien te estabilice— y despierta de un descanso largo **con un punto de vida**, no entero: despertar sano de una noche en el suelo haría que caer no costara nada. El dado sale del `hitDie` que ya declaraba la entrada de clase del mundo, así que no hay una segunda tabla que se quede vieja.

**El prefijo estable** (`cost/prompt-order.js`, 24 tests). Los proveedores cachean **por prefijo**: reutilizan los tokens que sean idénticos desde el primer carácter y tiran todo lo que venga tras el primer cambio. SillyTavern une los bloques inyectados por `Object.keys().sort()`, o sea alfabéticamente — determinista, y arbitrario.

**Lo que había era el peor caso posible**: de las cuatro claves fijas, `DYN_BOARD` —las posiciones del tablero, que cambian en cada turno— ordenaba **la primera**. Todo lo demás, incluidas las reglas del juego, se recalculaba cada vez que alguien daba un paso. Ahora cada bloque lleva una clave que ordena por cada cuánto cambia: reglas, mundo, personajes, misiones, sitio, ficha del grupo, combate. Y `/prompt` dice cuánto del turno anterior se ha podido reutilizar, que es lo único que demuestra si sirvió.

La clave lleva también **quién** la inyectó, y no es decoración: cada inyector limpia sus claves huérfanas por prefijo, y sin eso el contexto dinámico habría borrado los bloques que las instrucciones activas acababan de escribir.

**Los objetivos editables** (`campaign/objective-editor.js`, 34 tests). `/objetivos editar` abre las misiones del tablero como filas, cada una pidiendo exactamente los campos de su tipo, y **la IA puede proponerlas** contra el mismo esquema que el motor juzga — así que lo que propone se puede editar, no es magia. Un objetivo que nombra a quien no existe **no se guarda**, y dice por qué: ese error ya costó una funcionalidad entera en este proyecto.

El editor habla de **nombres** y el motor juzga por **ids**, la misma traducción que hace el importador de paquetes. A propósito: un objetivo escrito a mano, importado de un libro o propuesto por el modelo tiene que ser el mismo objeto cuando el motor lo lee.

### Salas, puertas y enemigos dormidos — 2026-09-21

Abres una puerta, se revela la sala que guardaba, y lo que dormía dentro despierta **en la casilla donde lo dibujó el libro**. Es el ritmo de una mazmorra de Gloomhaven: el siguiente combate llega cuando tú decides abrir, no cuando se carga el mapa.

**Las salas no se escriben: se deducen del propio mapa.** Un libro dibuja sus salas, no las describe, y el ASCII ya lo tiene todo — los muros encierran, las puertas separan. Así que `deriveRooms` las saca del terreno y **al Gem no hay que pedirle nada nuevo**: el contrato no crece ni una línea. Un tablero viejo gana salas en cuanto la función pasa por encima.

Lo que estaba escrito y sin usar de `campaign-map.js` ya se usa: `openDoor` revela y despierta, `getRoomBehindDoor` elige la sala, `getRevealedCells` dice qué se puede saber.

**Tres cosas que salieron al conectarlo**, y que estaban mal desde antes:

- `getRoomBehindDoor` devolvía **la primera** sala que tocaba la puerta. Estando en la sala A y abriendo hacia la B, devolvía A —ya revelada— y no se revelaba nada. Ahora prefiere la que no has visto.
- `persistBoardTerrain` solo miraba la lista global de tableros, que es la forma antigua. Para un tablero colgado de su localización **no guardaba nada, en silencio**: pintar terreno o abrir una puerta se perdía al recargar.
- El ejemplo del contrato tenía un sótano **sin una sola puerta**, con una cámara interior que no guardaba nada. Ahora enseña lo que el motor hace: dos salas, una puerta, y el guardián detrás.

Y el despertar tuvo que traerse su propia pieza: `startCombat` daba turno solo a los enemigos nuevos, así que los despertados existían en el encuentro y **no actuaban nunca**. `beginEncounterWith` tira iniciativa por todos los que están en el tablero.

Con esto, de `campaign-map.js` ya no queda nada sin usar.

### La ingesta de libros, entera · G2 · G3 · G4 — 2026-09-21

Se pega el JSON que te da tu Gem en la cuarta tarjeta del asistente, se comprueba, y sale una campaña jugable. El recorrido lo hace de punta a punta en el paso 23.

**El validador** (`campaign/campaign-pack.js`, 34 tests) comprueba **lo que un JSON Schema no puede ver**, que es donde falla de verdad un paquete generado: una misión que apunta a un tablero que no existe, un enemigo colocado que no está en el bestiario, dos compañeros con el mismo nombre —el Lorebook indexa por nombre y el segundo borraría al primero—, un mapa cuyas filas no miden lo mismo, un grupo que empieza dentro de una pared.

Tres clases de hallazgo, porque piden tres reacciones distintas: **errores** que impiden importar, **avisos** que no —un tablero al que ninguna misión te lleva se puede jugar igual— y **reparaciones**, lo que ya se arregló al leerlo. Las reparaciones se listan, nunca se hacen en silencio: un paquete reescrito a escondidas es un paquete cuyo autor no aprende nada.

Y cuando un nombre está en la lista equivocada, lo dice: *«"Mira" no está en el bestiario: está en `confidants`»*.

**El compilador** (`campaign/campaign-importer.js`, 24 tests) convierte el paquete en mundo, entradas, tableros y misiones. Todo él está construido alrededor de un orden: **los nombres se resuelven a ids después de crear las entradas**, nunca antes. Ese orden no es un detalle — es exactamente el error que ya costó una funcionalidad entera, cuando el asistente escribía las reglas de encuentro con ids que todavía no existían y `/fight` no encontraba enemigos en ninguna campaña nueva. Aquí el módulo nace con esa forma, y un nombre que no se resuelve **se informa** en vez de dejar un hueco.

**La cuarta tarjeta** del asistente enseña el informe antes de crear nada: qué trae el paquete, qué está mal y qué se ha reparado.

**Y un añadido que el bloque destapó**: los enemigos aparecían en una casilla **al azar** de la esquina 10×10, muros incluidos. Con un libro eso importa — un libro dibuja a sus monstruos donde quiere, y ese dibujo es la mitad del encuentro. `combat/spawn.js` (10 tests) usa las casillas del tablero cuando las hay, busca sitio libre cuando no, y **nunca coloca a nadie dentro de un muro**.

Con esto, `check-engine-wiring.mjs` dice **40 de 40 módulos conectados**.

### H5 · Pantalla de título y menú de pausa — 2026-09-21. **La Fase H queda cerrada**

`Esc` pausa el juego en vez de apagarlo, y salir de la partida ya no es salir del juego.

**La pantalla de título no se construyó: ya existía.** La bienvenida con las tarjetas de campaña se dibuja dentro de `#chat`, y `#chat` viaja dentro de `#sheld`, que el Shell ya movía desde H2. Así que el título es la misma sección del diálogo con otro rótulo y sin el ruido de una conversación: sin retrato, sin franja de grupo, sin conmutador y sin caja de escribir. Desde ahí se continúa una campaña y vuelves a la partida **sin salir del Modo Juego**.

**«Opciones abre los paneles de SillyTavern tal cual»** resultó ser gratis: su barra está en la capa 3005 y sus cajones en la 4005, por encima de esta capa (3000). En pausa basta con dejar de esconderla, y todo se abre donde siempre. El botón pulsa el mismo icono de siempre.

El menú tiene **Continuar**, **Opciones**, **Compendio y reglas** (el editor de `/rules`, ahora extraído para que el comando y la pausa abran exactamente lo mismo), **Salir al menú principal** y **Salir del Modo Juego**.

**Lo que encontró el navegador**: los controles de zoom del mapa (capa 25) y la capa de los dados (99999) se comían el clic del menú de pausa; el clic se quedaba reintentando para siempre. El menú está ahora por encima de todo lo prestado, y por debajo de la barra de SillyTavern a propósito — si no, sus paneles no se podrían pulsar en pausa.

**Esta es la primera parte sin módulo puro nuevo**: es presentación, y lo que la sostiene es el recorrido de navegador, no los tests.

**Y una orden de verificación que no verificaba**: `eslint … tools` decía *0 errores* sin mirar nada — ESLint solo lee `.js` de un directorio, y en `tools/` todo es `.mjs`. Con `--ext .js,.mjs` aparecieron 146 errores reales en el recorrido (`window` y `document` dentro de `page.evaluate`, que son del navegador, no de Node). Declarados arriba del archivo, la orden ya da cero **de verdad**.

### H4 · La escena de exploración, y el mapa de campaña cargado — 2026-09-21

Tecla `2`: el mapa a pantalla completa con un panel de viaje al lado — dónde estás, qué tableros hay aquí, y todos los sitios del mundo con su estado.

**El tablero y el mapa son el mismo panel.** Lo que cambia entre la escena de combate y la de exploración no es el panel, es lo que lo rodea: el propio panel ya sabe dibujar el tablero cuando hay uno abierto y el mapa cuando no. Dos secciones habrían sido dos cosas que mantener en sintonía.

**Un sitio cerrado se ve y dice qué le falta.** Esconderlo haría la campaña más pequeña de lo que es y no dejaría nada a lo que apuntar; enseñarlo con su motivo convierte una negativa en un objetivo. Eso es `explainLock`, que llevaba escrito y probado desde la Fase E sin que nadie lo llamara.

**Y el mapa se mueve.** Cumplir la misión de un tablero marca la localización como superada, que es lo que abre las siguientes. Ganar es lo único que abre puertas.

**Los sitios salen del mundo, no del mapa guardado**: una campaña que nunca declaró un mapa de campaña tiene todas sus localizaciones abiertas, que es como están todas las de hoy. Y un sitio guardado que el mundo no tiene se descarta — ofrecer un sitio al que no se puede ir es peor que no ofrecerlo.

**Con esto, `check-engine-wiring.mjs` dice por primera vez que el juego carga los 37 módulos del motor.** Con una salvedad honesta: de `campaign-map.js` se usa la mitad del mapa de campaña; la de salas y puertas (`normalizeRooms`, `openDoor`, `getRoomAt`) sigue esperando a su tarea, que es **A5**.

Por el camino, `/go` y `/enter` se quedaron sin lógica propia: viajar y entrar en un tablero son ahora `travelTo` y `enterBoard`, que usan tanto los comandos como el Modo Juego. Dos formas de ir al mismo sitio son dos sitios donde se puede olvidar guardar el estado.

### H3 · El director automático — 2026-09-21

La pantalla sigue a la partida. Empieza un combate y salta al tablero; termina y vuelve a la conversación, que es donde va el epílogo; se abre un tablero y cambia; se sale de él y vuelve al mapa.

**Escucha al motor, no al modelo.** Es la corrección que el plan original necesitaba: el estado del `dynamic-context-manager` lo fija el modelo por heurística sobre su propia prosa, así que una frase de ambiente que dijera *«todos a la iniciativa»* habría saltado a la pantalla de combate sin combate. El director mira si hay encuentro, si hay tablero y si hay localización.

**Las transiciones están nombradas una a una, no deducidas.** Un combate que termina con el tablero todavía abierto deja al selector automático en el tablero, y aun así la pantalla tiene que volver al diálogo. `detectSceneEvent` distingue los cuatro sucesos que mueven la pantalla; el resto de las veces manda la situación, o tu elección.

**Y lo que decide el director se queda puesto.** Si no, el epílogo duraría un parpadeo: el tablero abierto tiraría de la pantalla de vuelta a la mesa en el siguiente redibujado. Tu tecla vuelve a mandar en cuanto la pulsas, hasta que pase algo nuevo.

**Lo que encontró el navegador**: el epílogo llega como mensaje, el mensaje provoca un redibujado, y ese redibujado reescribía *«termina el combate»* por *«elegida a mano»* — que no es lo que había pasado. La explicación ahora dura hasta que algo la cambie de verdad.

**Y el Shell enseña la escena más parecida que exista.** Salir de un tablero manda la partida al mapa, que es H4: hasta entonces se ve la conversación, y no una pantalla cuyo único contenido sea la noticia de que aún no existe.

### H2 · La escena de diálogo, con el chat movido — 2026-09-21

Tecla `1` dentro del Modo Juego: retrato grande de quien habla, su rango de vínculo, el chat debajo y la franja del grupo al pie, con vida y estados.

**El paso con riesgo, y salió bien.** `#sheld` lleva dentro `#chat` y `#form_sheld` con su streaming, sus swipes y sus manejadores: **se mueve entero**, no se replica. El recorrido lo comprueba de las dos maneras — que dentro de la escena el chat conserva todos sus mensajes y su caja de escribir, y que al apagar vuelve al mismo padre, al mismo sitio y con `position: absolute`, la suya de siempre. Hay un `/send` desde dentro de la escena que aparece en el chat: el que está montado ahí es el vivo, no una foto.

**Dos escenas montadas, ninguna se mueve al conmutar.** Cambiar de pantalla enseña una y esconde la otra. Mover el chat cada vez habría sido una ocasión de perder el desplazamiento o el foco en cada pulsación.

**Lo que encontró el navegador**: al escribir, el foco se queda en la caja, y entonces `Esc` y `1`/`2`/`3` son del mensaje, no del juego — pinchar en el chat era **una puerta de ida**, y solo el ratón te sacaba. Ahora `Esc` sale primero de la caja y el segundo apaga el Modo Juego, como en cualquier editor.

Quién habla lo decide `ui/shell/dialogue-scene.js`, puro y con 17 tests: el último mensaje que no es tuyo **y no es de sistema** —la salida de un comando de barra no debe adueñarse del retrato— mientras que el narrador sí cuenta, porque a propósito no es un mensaje de sistema. Quien no está en el grupo también tiene retrato, pero sin rango: no hay vínculo del que leerlo.

### H1 · El Modo Juego: el tablero a pantalla completa — 2026-09-21

`/modojuego` levanta una capa a pantalla completa con el tablero en grande, el rastreador de iniciativa, el registro de combate y una barra de acciones. Se apaga con el mismo comando o con `Esc`.

**No hay una segunda interfaz.** El Shell **mueve** el panel del tablero al escenario y lo devuelve al cerrarse: el recorrido de navegador comprueba que solo existe una copia, que vuelve al mismo padre y al mismo sitio, y que se sigue dibujando ahí. Una copia habría sido otra cosa más que mantener al día.

**Quién decide la pantalla**: `ui/shell/scene-director.js`, puro y con 24 tests. Lee lo que sabe el motor — hay encuentro, hay tablero, hay localización — y **nunca** el estado del `dynamic-context-manager`, que lo fija el modelo: una frase de ambiente que dijera *«todos a la iniciativa»* habría saltado a la pantalla de combate sin que hubiera combate.

La barra de acciones no pide teclear: **Atacar** despliega los enemigos que están de verdad a tu alcance, con distancia, PG y CA; y cuando no puede atacar dice por qué — no es tu turno, la acción ya está gastada, no hay nadie cerca.

**Se puede apagar, y eso es parte del diseño**: es la primera capa que es presentación pura, la que peor aguantaría un merge con upstream. Con el Shell apagado la aplicación es exactamente la de antes, incluido el panel plegado si lo estaba.

**Lo encontró el navegador, no los tests**: `setLocationMapsVisibility(hidden)` decía *visibility* y recibía *hidden*, así que el Shell «abría» el panel plegándolo y enseñaba una pantalla completa vacía. Ahora se llama `setLocationMapsHidden`.

### G1 · El contrato del paquete, exportable — 2026-09-21

`/esquema-campana` abre lo que hay que pegar en tu Gem: ocho vistas — las instrucciones completas, el esquema a secas, un ejemplo de salida correcta, y una por cada sección del paquete, porque un libro no cabe en una sola respuesta y tendrá que producirlo por partes.

**Lo importante no es el panel, es de dónde sale.** El esquema se **genera** desde el propio motor:

| Lo que declara | De dónde sale |
| :--- | :--- |
| Los siete tipos de objetivo | `campaign/scenarios.js` |
| Los cuatro perfiles tácticos | `combat/enemy-ai.js` |
| Los caracteres del mapa | `board/terrain.js` |

Si el motor cambia, cambia lo que pegas. Una copia guardada a mano se queda vieja sin avisar, y el fallo aparecería un libro entero más tarde.

**La decisión que lo ordena todo**: el autor escribe **nombres** —`"target": "Guardián del grano"`— y el importador los resuelve a ids al crear las entradas. Un libro no puede conocer un `uid` de World Info, porque ese uid no existe hasta importar. Es exactamente el fallo que ya costó una función entera: el asistente escribía sus tableros con la lista de encuentros vacía porque los ids aún no existían, y `/fight` no encontraba enemigos en ninguna campaña nueva.

Hay tests que lo fijan: el esquema **no pide** `targetIds`, `allyId` ni `treasureIds`, y **no acepta** `required` — el motor razona en objetivos opcionales.

Y publica las **diez reglas que un JSON Schema no puede expresar**, que es donde un paquete generado falla de verdad: que el tablero que cita una misión exista, que el enemigo colocado esté en el bestiario, que ningún nombre se repita —el Lorebook indexa por nombre—, que el borde del mapa esté sellado y que el grupo empiece sobre suelo. Las dos últimas ya fallaron una vez, con dos personajes dentro de un muro.

El ejemplo que acompaña al contrato no es el caso fácil: dos tableros, una misión que referencia a otro, un objetivo opcional y uno de proteger a un compañero. Un ejemplo que solo cubre lo fácil enseña lo fácil.

### Los escenarios, conectados — 2026-09-21

`campaign/scenarios.js` sabía juzgar siete tipos de objetivo desde la Fase E, y nadie se lo preguntaba nunca: **todos los combates de este juego eran «mata a todo el mundo»**, que es justo el escenario para el que un motor táctico menos falta hace.

| Qué | Cómo quedó |
| :--- | :--- |
| **Un tablero puede llevar una misión** | Si define objetivos, son ellos los que deciden el combate. Un tablero sin objetivos se comporta exactamente como siempre: limpias y ganas |
| **Se ven donde está la pelea** | Encima del rastreador de iniciativa, porque *para qué* es el combate manda sobre *a quién le toca*. Tachados al cumplirse, en rojo al fallarse, y los opcionales marcados como tales |
| **Ganar sin matar a nadie** | *Aguantar 3 rondas* se gana con todos los enemigos en pie. Antes no había forma de expresar eso |
| **Perder sin morir** | *Proteger a X* se falla si X cae, aunque el grupo siga entero |
| **La mazmorra inicial trae misión** | Limpiar la sala, y aguantar 3 rondas como objetivo **opcional**. Así una campaña nueva enseña para qué sirve un escenario sin que nadie tenga que escribir uno a mano |
| **`/objetivos`** | Los muestra en cualquier momento |

`combat/scenario-board.js` traduce el combate en curso al estado que el evaluador espera y devuelve el veredicto; 18 tests. Decidir y aplicar siguen separados, como en la IA de enemigos y en las perks.

> [!NOTE]
> **Dos pruebas más que dependían de los dados.** El paso del botín daba por hecho que el grupo ganaría, y perdía una vez de cada tres: ahora comprueba la **regla** — una victoria paga, cualquier otra cosa no — en lugar de un desenlace concreto. Y el de la máquina de turnos intentaba empezar un combate con el grupo en el suelo tras el anterior. Tres pasadas seguidas, 79 comprobaciones, mismo resultado.

### Las perks de vínculo, en el combate — 2026-09-21

El argumento del propio documento de diseño para el bucle Persona era que los vínculos tenían que ser mecánicos: *«un vínculo que no cambia cómo va un combate es solo un número en pantalla»*. Hasta ahora eran exactamente eso — ganados, listados y sin efecto.

| Perk | Rango | Qué hace ahora |
| :--- | :---: | :--- |
| **Ataque de seguimiento** | 3 | Cuando asestas un crítico, un compañero **que ya pueda alcanzar al objetivo** tiene un 50% de atacar gratis. Se resuelve como un ataque de verdad: tira, puede fallar y sale en el registro. Un golpe gratis que siempre acierta no es una perk, es una trampa |
| **Relevo** | 5 | Al derrotar a un enemigo, puedes ceder el movimiento que te quede con `/relevo <nombre>`. Es una oferta, no un automatismo: regalar tu movimiento es una decisión, y que el motor la tomara por ti quitaría la única parte interesante |
| **Aguantar** | 8 | Si un golpe fuese a dejarte a 0, un compañero se interpone y te deja a 1 HP. **Una vez al día**, solo cuando el golpe de verdad te habría tumbado, y nunca para salvarse a sí mismo: una perk que salta con cada rasguño haría el combate imposible de perder en vez de tenso |
| **Vínculo máximo** | 10 | Sigue siendo contenido — arma y habilidad propias — no una regla. Se muestra en el panel como lo que es |

Lo que decide cada una vive en `combat/bond-perks.js`, puro y con 21 tests; aplicarlas es cosa de `party.js`. Esa separación es lo que permite probar de forma exhaustiva un efecto que nadie supervisa.

> [!NOTE]
> **Tres pruebas que no probaban nada.** El recorrido de navegador daba por hecho que el personaje ya estaría junto al enemigo, y un `/combat-move` a la casilla de al lado se rechaza si la distancia supera el movimiento del turno. Fallaba una vez de cada dos sin que cambiara el código. Ahora hay un único ayudante que juega un turno como lo jugaría una persona — acercarse un paso, y atacar cuando llega — y lo usan las tres comprobaciones. Tres pasadas seguidas, 74 comprobaciones, mismo resultado.
>
> Y la de *Aguantar* comprueba la **decisión** con los vínculos que la partida tiene guardados, no que el golpe letal caiga: que caiga dentro de una ejecución es cuestión de dados, y una prueba que depende de los dados es una prueba que se aprende a ignorar.

### El calendario, los vínculos y la máquina de turnos — 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| 🖥️ **Panel de campaña** (D6) | Pestaña nueva, **Campaña**, junto a Party y Location. Muestra el día, en qué parte del día estás, y una ficha por compañero con su rango, su progreso al siguiente y **las cuatro perks: las que tiene y las que le faltan**. Ver qué da el rango 8 es la razón para seguir pasando tardes con alguien |
| **El tiempo corre** | *Pasar el rato* avanza un bloque; *Dormir* salta al día siguiente y devuelve las perks de una vez al día. También con `/time next` y `/time sleep` |
| **Los vínculos suben por hechos** | Desde el panel se registra un regalo, una escena de confidente o tiempo libre compartido. Un combate ganado juntos lo registra **el motor solo**, que es la decisión de diseño entera: la narración no decide cuándo sube un vínculo. También con `/bond Lyra confidant_scene` |
| **Subir de rango se anuncia** | Con las perks que desbloquea, porque ese es el momento en que el modelo debería escribir una escena — sobre un hecho que el motor ya decidió |
| **Sin tocar `index.html`** | La pestaña y su panel se crean desde `party.js`. Ese archivo es de upstream y cada línea que el fork le añade se paga en cada merge |
| **Máquina de turnos conectada** (D1, B1/B3) | El combate real la usa: **una sola definición de turno**, con acción, acción adicional y reacción. Antes había dos implementaciones y el juego usaba la suya, más pobre. Los encuentros guardados cargan igual y ganan los dos campos que les faltaban |
| **La acción se gasta de verdad** | Atacar consume la acción del turno, y un segundo ataque en el mismo turno se rechaza. Es lo que hace falta para que las perks de vínculo (A1) tengan dónde colgarse |

> [!NOTE]
> **Una prueba inestable es peor que ninguna.** El paso del botín pasó una vez y falló a la siguiente sin que cambiara el código: dependía de a quién le tocara la iniciativa y de dónde cayera el enemigo, las dos cosas tiradas al azar. Ahora el recorrido cierra la distancia y espera su turno como haría un jugador, y se ha ejecutado tres veces seguidas con el mismo resultado.

### A1 y A2, cerrados el 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| **Rastreador de iniciativa** (B8) | Sustituye a la lista numerada de nombres que había. Ahora cada fila dice **quién actúa**, **quién va después** —saltando a los caídos y dando la vuelta al final de la ronda—, la vida de cada uno con barra, y quién está por debajo de la mitad. La ronda se lee arriba en vez de contarse de memoria |
| **Marcadores de estado** (PROP-088) | Las condiciones se dibujan como iconos en el rastreador **y sobre la ficha en el tablero**, para no tener que apartar la vista del mapa para saber que a quien vas a mover está apresado. Cada condición del paquete de reglas tiene su icono; una que no esté en la tabla se dibuja igual, con su nombre |
| **`/condition`** | Poner y quitar condiciones desde el chat: `/condition Lyra Poisoned` alterna, `/condition Lyra` lista, `/condition Lyra clear` limpia. Antes solo se podían tocar abriendo la ficha, o las ponía el propio combate al caer alguien a 0 |
| **Escalado por tamaño** (PROP-099) | Una criatura Grande ocupa 2×2 casillas, Enorme 3×3, Gargantuesca 4×4. Un ogro dibujado del tamaño de un goblin engaña sobre el alcance y sobre lo que cabe por una puerta, y el motor ya calculaba bien las dos cosas |
| **Botín por CR** (B5) | Ganar da **oro, experiencia y a veces un objeto**, repartido entre los que siguen en pie. Las cantidades salen de una tabla de datos, así que un paquete de reglas puede hacer una campaña más pobre o más rápida de subir de nivel sin tocar código |
| **Subir de nivel se avisa, no se hace solo** | Cuando alguien acumula experiencia suficiente se dice en el registro. Decidir cuándo subir es cosa del jugador; el botón ya estaba en la ficha |

> [!NOTE]
> **Lo que el recorrido de navegador volvió a cazar.** La primera versión del paso de prueba ponía las condiciones escribiendo en `chat_metadata.party`, y no aparecía ningún marcador: ese metadato es una copia, no el grupo que el juego tiene en memoria. El fallo estaba en la prueba, pero señaló un hueco real — no había **ninguna** forma de poner una condición a mano — y de ahí salió `/condition`.
>
> El botín se comprueba ganando un combate de verdad, atacando hasta que el enemigo cae, no editando el estado: el reparto tiene que venir por el mismo camino que una victoria real.

### El bloque de prioridad alta, cerrado el 2026-09-21

| Qué | Cómo quedó |
| :--- | :--- |
| **Fase F · Generar el mundo con IA** | Tarjeta *Generar con IA* en el paso 1 del asistente. Describes el mundo en una frase y lo construye: mapa, enemigos, lugar y tablero. **Lo que devuelve es una plantilla como las otras** y pasa por los mismos constructores, así que un mundo generado no llega al tablero por un camino propio. Agnóstico de proveedor (`generateRaw` + esquema JSON): funciona con el conector que tengas, y si no hay ninguno la tarjeta ni aparece. **Una llamada por mundo** |
| **El modelo devuelve basura y aun así juegas** | Filas de distinto largo, un símbolo inventado, un borde abierto por donde salirse del tablero, un perfil táctico que no existe, dos enemigos con el mismo nombre: todo eso se repara y **se te dice qué se reparó**. Lo que no tiene arreglo — un mapa sin una sola casilla libre — se rechaza con su motivo. Nada se crea antes de que veas el mapa |
| **C3 · Editor visual de reglas** | `/rules` abre las **25 secciones** del paquete: tipos de daño, propiedades de armas y armaduras, condiciones, rarezas… Tablas con añadir y quitar; las secciones con estructura propia se editan como JSON. Marca con un punto las que has cambiado, y *Restablecer sección* deshace. Es tu requisito literal: **añadir un tipo de daño sin tocar JavaScript** |
| **C5 · Importar y exportar paquetes** | Desde el mismo editor. La exportación es diferencial: el archivo dice qué cambias, no repite D&D entero |
| **Cargar el paquete de reglas de cada campaña** | Se guarda en el mundo, así que viaja con él y dos campañas pueden no estar de acuerdo sobre qué es un arma. `dnd-system.js` fija sus tablas al cargar, y eso no se podía esquivar: ahora el paquete se **recuerda antes** de que ese módulo se evalúe, y se te avisa una vez con el botón de recargar. Un paquete roto no se instala: se queda el de por defecto y se dice por qué |
| **T3 · Ver qué se envía en cada turno** | `/prompt` desglosa el último turno en bloques con nombre — prompt de sistema, contexto dinámico, ficha del grupo, lorebook, conversación — ordenados por tamaño, con barra y con el principio de cada uno. Y la cifra que decide si una campaña se encarece: **cuánto del turno es contexto que se reenvía siempre** |
| **T4 · Lo que lleva la sesión** | Turnos, tokens enviados, el turno más caro y qué bloque lo hizo grande. Pones el precio por millón de tu proveedor y te dice el gasto. **Con una advertencia que no se esconde**: son la medida propia de la aplicación, no la factura. SillyTavern no devuelve a la página el recuento real de la API, así que la reconciliación con el proveedor sigue pendiente (#28) |

> [!NOTE]
> **Lo que encontró el navegador y los tests no.** El editor de reglas no se podía cerrar: el paquete recibía su `id` y su `nombre` al guardar, después de la comprobación que los exige, así que la validación fallaba siempre y el diálogo se quedaba abierto. Con 26 tests del modelo en verde. Lo cazó `tools/e2e-campaign.mjs` a la primera.
>
> Y dos que cazaron los tests antes de llegar al navegador: el editor **borraba** los campos de un flag que ninguna columna muestra (a qué tipos de objeto se aplica), y **perdía** la opción vacía con la que empiezan varias listas. Ambos habrían roto el paquete al guardarlo sin tocar nada.

### Antes, el mismo día

| Qué | Cómo quedó |
| :--- | :--- |
| **El epílogo de combate llega al modelo** | Se publica como mensaje de **narrador**, no de sistema. El nuevo `game-engine/ui/chat-channel.js` obliga a nombrar el público (`CHANNEL.PLAYER` o `CHANNEL.MODEL`) y deriva de ahí el `is_system`, con tests que comprueban lo que importa — si el modelo lo lee — en vez de la bandera. Verificado en navegador: `is_system=false`. No dispara ninguna llamada: entra en el prompt de tu siguiente mensaje |
| **La cobertura cuenta en el ataque** | `getCoverBonus` se aplica a la CA del objetivo en los dos puntos de ataque, y el registro dice *«incluye +2 por cobertura media»*. Un tablero sin terreno se comporta igual que antes |
| **El guardián de tiradas está conectado** | Corre sobre cada mensaje del modelo. Por defecto solo corrige lo **imposible** (un `1d20+5` no puede dar 30), porque esa corrección nunca es opinable; `/rollguard estricto` hace que el motor tire por todas, y `/rollguard off` lo desactiva. Cada corrección se anuncia |
| **Las puertas se abren con un clic** | En el tablero real. Se redibuja la niebla al abrirlas, y queda anotado en el registro |
| **El registro de combate está en el tablero real** | Ya no solo en `/sandbox`. Se alimenta de las líneas de combate y del desglose de cada tirada |
| **Se puede abandonar un combate** | `/combat-stop`. Antes solo se salía ganando o muriendo, y el epílogo era inalcanzable sin cadáveres. El resumen distingue abandono de derrota |
| **El asistente crea campañas con combate** | Las plantillas escribían `encounterRules: []`, así que `/fight` contestaba *«enemigo no encontrado»* en toda campaña recién creada. Las reglas se escriben ahora al conocer el id de cada monstruo |
| **El recorrido en navegador está en el repositorio** | `tools/e2e-campaign.mjs` levanta su propio servidor con datos temporales, recorre el juego y limpia. 87 comprobaciones |
| **Hay un detector de módulos sin conectar** | `tools/check-engine-wiring.mjs`. Convierte «hecho y probado» en algo que se comprueba |
| **Código muerto y ESLint** | `nextTurn` eliminada (nadie la llamaba); `rollDice` dejó de estar muerta al usarla el guardián. Los 22 errores de ESLint preexistentes están a **cero** |
| **`Mapa-Codigo-Archivos` al día** | Ya recoge `game-engine/`, `party/` y `tools/`, con qué está conectado y qué no |

### De antes

| Área | Estado |
| :--- | :--- |
| Higiene del fork | Remote `upstream` sin push · 194 commits integrados · formateo desactivado en archivos de upstream · regla escrita |
| Red de seguridad | Gate de tipos acotado al fork · CI propio en `push` (`fork-checks.yml`) · sin `@ts-nocheck` |
| Seguridad | XSS del renderizador (4 puntos, y uno más en la cabecera del tablero) · XSS vivo en `world-content-browser.js` · 11 copias de `escapeHtml` unificadas · límites Unicode · doble persistencia del grupo |
| Motor de tablero | Terreno, línea de visión (simétrica), niebla de 3 estados, A* · 104 tests · **conectado** |
| Motor de combate | Perfiles tácticos, guardián de tiradas, máquina de turnos · 99 tests · conectados los perfiles y el guardián; la máquina no (#7) |
| Interfaz | Capas de terreno y niebla, paleta de pintura, registro de combate con marco pixel art, puertas, banco de pruebas `/sandbox` |
| Onboarding | Botón **Nueva campaña** y asistente de 3 pasos con 4 plantillas. Crea el mundo, el chat vinculado, el grupo con posiciones, las reglas de encuentro, y te deja en el primer tablero. Propone siempre un nombre libre. Los mundos jugables **sin chat** aparecen como tarjeta con **Iniciar** |
| Contenido como datos | 25 tablas fuera del código, validación, migración, exportación diferencial · 36 tests · el juego lee el paquete por defecto (#4 pendiente) |
| Bucle de campaña | Calendario, vínculos 1-10, perks, objetivos de escenario, salas y puertas, tablero de campaña · 62 tests · **sin conectar** (#9, #10, #12) |

**Verificación** (medida el 2026-09-21, tras el bloque de prioridad alta, A1–A2 y la máquina de turnos):

```bash
npm run test:unit --prefix tests     # 1.232 tests, 47 suites
node tools/check-fork-types.mjs      # 0 errores en 46 archivos del fork
node tools/check-engine-wiring.mjs   # 29 de 30 módulos conectados
node tools/e2e-campaign.mjs          # 87 comprobaciones en un navegador real
ESLINT_USE_FLAT_CONFIG=false npx eslint public/scripts/game-engine public/scripts/party public/scripts/party.js public/scripts/campaigns.js public/scripts/world-map-renderer.js tools
```

> [!NOTE]
> Las cuatro primeras responden preguntas distintas: los tests, si un módulo hace lo que promete; el gate de tipos, si encaja; el detector de cableado, si el juego llega a cargarlo; el recorrido en navegador, si un jugador puede provocarlo. Todo lo que este proyecto dio por hecho equivocadamente cayó entre la primera y las dos últimas.

---

## 🔗 Enlaces

- [[ROADMAP]]: el plan, el porqué y el orden.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]]: la Fase G — meter un libro de campaña y jugarlo.
- [[PROBLEMAS_TECNICOS]]: auditoría original, con el estado de cada hallazgo.
- [[PROPUESTAS_MEJORA]]: catálogo de 200 con el estado de cada propuesta.
- [[Mapa-Codigo-Archivos]]: qué archivo hace qué, y cuál está conectado.
- [[Guia-Desarrollo-Flujo]]: la disciplina de fork.
