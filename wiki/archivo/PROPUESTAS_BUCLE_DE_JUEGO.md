---
title: El bucle de juego — análisis y tres propuestas grandes
tags: [bucle, diseno, propuestas, tokens, semana, social, misterio]
created: 2026-09-25
updated: 2026-09-25
author: DanielJHesseling / Claude Opus 5.5
---

# 🎲 El bucle de juego: por qué volver mañana, y tres apuestas grandes

> **Qué es esto.** Un análisis del juego tal como queda tras las ocho baterías de *IDEAS_200*, con una sola pregunta: **¿qué haría que quisieras jugar otra hora, y otra más?** Y tres propuestas grandes, de meses, para contestarla sin gastar tokens de más y sin dibujar nada.
>
> **De dónde sale.** Del código y del recorrido de pruebas (59 pasos en el navegador), no de haber jugado veinte horas. Donde algo es intuición y no un hecho, lo digo. Lo que de verdad decide es que juegues una semana entera y apuntes dónde te aburres (ver [consejo 8](#8-mide-antes-de-decidir)).
>
> **Las reglas que respeto.** El motor decide, el modelo cuenta ([[ROADMAP_MAESTRO]]). Un tope de unos 5 € de tokens. Nada de arte: todo es texto, botones, tarjetas y números.

---

## 📍 1. Dónde estamos: los cuatro relojes, hoy

El [[ROADMAP_MAESTRO]] ordenó el juego en cuatro relojes y dijo que **el de la semana era la clave de bóveda**. Tres días y ocho baterías después, así están:

| Reloj | Qué pasa | El 22-09 | Hoy |
| :--- | :--- | :---: | :--- |
| **Minutos — el turno** | Ves el tablero, decides, actúas | ✅ | ✅ **Lo mejor del juego.** Terreno que arde, maniobras, golpe preparado, jefes que contestan, lanzar lo que hay a mano |
| **Una sesión — el trabajo** | Encargo, viaje, tablero, **vuelves distinto** | 🟡 | ✅ Ahora sí se vuelve distinto: heridas, vínculo, aprobación, trofeos, recuerdos, mejoras |
| **Una semana — la cuenta** | Comer, cobrar, curarse, pagar el viernes | ❌ | 🟡 **Existe, pero como factura, no como decisión** |
| **Una campaña — la amenaza** | Algo avanza hagas lo que hagas | ❌ | 🟡 Existe (relojes de facción, hilo por actos, villano, rivales), **pero te llega como una lista de avisos** |

Y hay un quinto que el Maestro no tenía y que ahora se ve: **la escena de cinco minutos**. Si es un combate, es un juego. Si es una conversación, es chat y una tirada.

---

## 🔬 2. Diagnóstico: seis cosas que veo

### 2.1 El verbo que más se repite es el único que cuesta

**Cada mensaje que escribes es una llamada con el prompt entero**: reglas, vínculos, misiones, memoria del mundo, tablero y estado del grupo. Lo dice el medidor (`cost/prompt-meter.js`): lo caro no es lo que el modelo escribe, sino lo que se reenvía cada vez. Todo lo que hace el motor cuesta **cero**: combate, viaje, tienda, semana, facciones.

Eso deja la economía del juego al revés de lo que interesa: **cuanto más te engancha una conversación, más cara sale**, y en la conversación el motor apenas ofrece juego propio. Lo que se sigue de aquí no es comprimir el prompt (eso ya está hecho: el orden fijo para la caché, el modo ahorro). Es **mover las decisiones interesantes de la escena social al motor**, y dejar al modelo para lo que solo él sabe hacer: contarlo bien al final.

### 2.2 Mucha anchura, poco eje

Doscientas ideas, y cada una añade un efecto pequeño en un sitio. Las decisiones están repartidas por el tablón, el diario, el gremio, la ficha, la posada, el viaje, el panel de la campaña y la pausa. **Cada pieza funciona; ninguna te dice cuál importa ahora.**

Es un problema de **legibilidad** más que de contenido: muchos sistemas que el jugador no llega a notar. Mi consejo más importante de todo el documento está aquí: **durante un tiempo, no más baterías de ideas sueltas.** El siguiente paso grande es **juntar**: un sitio donde las decisiones se encuentren.

### 2.3 La semana se paga, pero no se decide

La cuenta del viernes da apetito, y el Maestro acertó en eso. Pero la decisión que plantea es «**¿me llega?**», no «**¿qué dejo caer?**».

Los relojes de facción avanzan un segmento cada 7 días, sobre 6 segmentos. Son lentos a propósito, para no caer en el ruido de Bannerlord, y eso está bien. Lo que falta es **el momento en que dos fuegos compiten por tu única semana**. XCOM, *King of Dragon Pass* o *Frostpunk* enseñan lo mismo: la decisión que más se recuerda en un juego de estrategia es **lo que dejaste caer**.

### 2.4 Lo social no es un juego todavía

El combate tiene casi de todo. Hablar tiene esto:

- la ficha que ofrece una tirada al leer lo que escribes (137);
- sonsacar un secreto (110);
- la actitud que sube o baja un paso (140);
- regatear en la tienda.

Es una tirada, sale o no sale, y vuelta al chat. El punto 7 de *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES* («la ficha dormida») está resuelto a medias: las habilidades se tiran, pero entre tirada y tirada no hay juego. Y resulta que **la mitad de un juego de rol es hablar**, que aquí es la mitad más cara y la menos táctica.

### 2.5 La curiosidad depende de lo que escribas tú

Lo que tira de una partida larga es **querer saber**. Hoy eso sale de los hilos escritos, como el de 1387 o los que escribe el Gem. Son buenos, pero se acaban y te cuestan tu tiempo.

Lo generado, los encargos del tablón, cambia de números y de sitios, pero **no de pregunta**: matar, escoltar, traer. Nada generado tiene una verdad escondida que descubrir.

### 2.6 La sesión no tiene forma

«Anteriormente…» (108) abre bien una sesión, pero nada la cierra: no hay un punto natural de parada con gancho. Los juegos que enganchan tienen una unidad del tamaño de una sesión: el mes de XCOM, la expedición de *Darkest Dungeon*, el año de *King of Dragon Pass*. **Aquí la unidad natural es la semana**, porque ya existe y ya se paga.

---

## 🧭 3. Consejos para el bucle

Ninguno de estos pide un sistema nuevo. Son reglas para decidir qué se hace y cómo.

### 1. Lo que más se repite, gratis; lo que menos, caro y bonito

El modelo tiene que estar en **los signos de puntuación** del juego:

- el final de una escena;
- el final de la semana;
- una muerte;
- un cambio de acto.

No debería estar en cada paso intermedio. Como objetivo de diseño: que una hora de juego necesite **pocas llamadas**, y que lo que se haga entre ellas sea juego del motor. Mídelo con el consejo 8.

### 2. El tiempo es la moneda

Toda decisión buena debería costar días: viajar, descansar, aprender, llamar a alguien del banquillo. Ya pasa en muchos sitios, así que lo que queda es **que se vea en el botón**: «Ir a la cueva (2 días)».

### 3. Lo que no eliges tiene que doler, y verse

Ignorar algo tiene que tener una consecuencia que se vea en el mapa o en la lista, y **con el motivo dicho**: «El molino es de Vane: nadie fue a defenderlo». Si la consecuencia llega sin motivo, el jugador no la vive como una decisión suya.

### 4. Enseña lo que viene

La anticipación engancha más que la sorpresa en todo lo que sea planear. «El molino cae en 5 días» dice más que «Vane avanza». Los relojes existen; **sácalos a la vista con su fecha**.

### 5. Una sesión, una semana

Cierra cada semana con una tarjeta: lo que se ganó, lo que se perdió y **lo que viene**. Es el punto natural para dejar de jugar, y el gancho para volver.

### 6. Juntar antes que añadir

Antes de un sistema nuevo, **un sitio que junte los que hay**. Y una prueba honesta: de las 200 ideas, ¿cuáles notas mientras juegas? Las que no notas, o salen a la vista en ese sitio común, o se aceptan como condimento y no se les dedica más trabajo.

### 7. Fallar abre caminos

Esto ya es un punto fuerte:

- la deuda que se vuelve un favor (`patronage.js`);
- la red de seguridad (25);
- la herencia de quien muere (36).

Tiene que seguir siendo regla para todo lo nuevo: **perder abre una historia, no una recarga**.

### 8. Mide antes de decidir

El medidor dice lo que cuesta **un turno**; falta lo que cuesta **una sesión** y en qué se fue. Una pieza pequeña, a 0 tokens, lo resolvería: **un diario de sesión** local que apunte los minutos por actividad (combate, viaje, pueblo, chat), las llamadas al modelo y **cuántas veces escribiste en el chat porque no había un botón para lo que querías**.

Y un protocolo para ti, de una tarde: juega **una semana entera** del juego y apunta tres cosas, cada vez que pasen:

1. Me he aburrido aquí.
2. No sabía qué hacer aquí.
3. He escrito en el chat porque no había otra forma.

Esas tres listas valen más que este documento.

---

## 🚀 4. Las tres propuestas

Cada una ataca un reloj flojo:

| Propuesta | Qué arregla | Tamaño aproximado |
| :--- | :--- | :--- |
| 🗺️ **La Mesa de la Semana** | La semana como decisión, y un eje que junte las 200 ideas | 2–3 meses |
| 🔎 **Casos con verdad** | La curiosidad, con contenido que no se acaba y que no escribes tú | 3–5 meses |
| 🗣️ **El Duelo de Palabras** | La escena social como juego, y el mayor ahorro de tokens | 2–3 meses |

Los tamaños son una estimación gruesa, en el ritmo que llevamos. Cada propuesta se puede hacer sola; juntas cierran el bucle (ver [sección 5](#-5-cómo-encajan)).

---

### 🗺️ Propuesta 1 · La Mesa de la Semana

**En una frase.** Cada semana empieza en una mesa con cuatro o cinco asuntos que no caben todos. Eliges a cuál vas tú, a cuál mandas a otros y cuál dejas caer; y lo que dejas caer, avanza.

**Por qué engancha.**

- **XCOM**, el geoscape: tres avisos y un solo avión.
- ***King of Dragon Pass*** y ***Six Ages***: un año entero de decisiones de clan, casi todo texto. Es la prueba de que esto funciona sin arte.
- ***Darkest Dungeon***, el pueblo entre expediciones: a quién mandas, quién descansa, quién ya no está para ir.
- ***Blades in the Dark***: los relojes a la vista y el tiempo entre golpe y golpe.

Lo que engancha es siempre lo mismo: **coste de oportunidad, anticipación y consecuencias que son tuyas**.

**Cómo se juega**, con 1387:

> **Semana 7 · Otoño · el viernes debéis 140, tenéis 95.**
>
> 1. 🔥 **Vane quiere el molino.** Reloj 4 de 6: cae en 6 días. Si cae, el paso norte cobra peaje. *(Facción)*
> 2. 📜 **La cueva bajo la hiedra.** El hito del hilo, a 2 días de camino. *(Hilo)*
> 3. 💰 **Escoltar a Tomás.** 70 de oro, rango C, caduca en 5 días. Los Perros de Hierro también lo quieren. *(Tablón y rivales)*
> 4. 🤝 **Lyra quiere poner a salvo a los suyos.** Vínculo 3. *(Encargo personal)*
> 5. ⚖️ **El favor que debéis a los Leales** vence el jueves. *(Deuda)*
>
> Vas tú a la cueva. Mandas a Bran y a Kael a escoltar a Tomás: **70 % de que salga bien, vuelven en 4 días**. El molino lo dejas caer.
>
> **Al cerrar la semana:** Bran vuelve con los 70 de oro y una costilla rota. El molino es de Vane, *porque nadie fue*, y el paso norte cuesta 10 por cabeza. Lyra no dice nada, pero su aprobación baja.

**Lo que ya existe y se aprovecha.** La primera versión de la mesa es **sobre todo una vista**: casi todo lo que enseña ya se calcula.

| Pieza que ya existe | En la mesa es… |
| :--- | :--- |
| Relojes de facción (`factions.js`) | Un asunto con plazo y lo que pasa si llega a su fin |
| El hilo y las pistas que escalan (`plot.js`, `guidance.js`) | El hito abierto, con los días que lleva |
| Tablón y rivales (94) | Un encargo con competencia: si no vas, se lo llevan |
| Encargo personal (30) y aprobación (28) | El asunto de un compañero, que se acuerda de si fuiste |
| La deuda con un patrón (`patronage.js`) | Un asunto con vencimiento |
| Banquillo (42) y heridas | Quién está libre para ir |
| Fortuna de los sitios (85) y noticias (82) | Cómo se cuenta lo que dejaste caer |
| Resumen por acto (143) | Cómo se escribe la crónica sin llamar al modelo |
| La cuenta del viernes | La cabecera de la mesa |

**Lo que hay que construir.**

1. **El asunto**, una forma común: qué, dónde, días de camino, premio, reloj y qué pasa si no se atiende. Hace falta un adaptador por sistema, y es puro y fácil de probar.
2. **La mesa**, una pantalla de tarjetas como la del gremio. Sale al empezar la semana; se puede cerrar e ir a jugar sin decidir nada.
3. **Los despachos: mandar compañeros sin el héroe** a un asunto menor. El motor lo resuelve con:
   - el nivel de cada uno;
   - si su oficio encaja con el asunto;
   - sus heridas;
   - su vínculo.

   La probabilidad se ve antes de mandarlos. Vuelven días después con el resultado, botín, una herida o, si la campaña lo permite, no vuelven. Cada uno lo cuenta con una línea de plantillas según su carácter, como las frases de combate. Esto convierte un grupo grande en una ventaja, y el banquillo en algo que se usa.
4. **Lo que dejas caer.** Al cerrar la semana, cada asunto sin atender avanza su reloj y **se dice por qué**. Hay que revisar que cada fuente tenga una consecuencia que se vea; las que no la tengan, no entran en la mesa.
5. **La crónica de la semana**, una tarjeta de cierre: lo ganado, lo perdido y **lo que viene**, con un asunto nuevo que ya se ve asomar. La escribe el motor; el narrador la cuenta solo si quieres.

**Tokens.**

- La mesa y los despachos no cuestan nada.
- La crónica tampoco si sale de plantillas, o **una llamada por semana** si quieres que la cuente el narrador.
- De rebote, con un sitio donde decidir sin escribir, se escribe menos «¿y ahora qué hacemos?» en el chat.

**Riesgos, y cómo se evitan.**

| Riesgo | Cómo se evita |
| :--- | :--- |
| Que se vuelva un juego de menús | Cinco asuntos como mucho, dos líneas por tarjeta, un clic por decisión. Y la mesa no bloquea: se puede ignorar |
| Que los despachos vacíen el tablero («lo mando todo») | Solo se despachan asuntos menores. El hilo y los de rango alto piden al héroe. Y despachar arriesga a los que quieres |
| Relojes tan lentos que nunca chocan | Los asuntos de la mesa llevan plazos cortos (3 a 7 días), para que compitan de verdad |

**Por fases.**

| Fase | Qué | Esf. | Al terminarla… |
| :--- | :--- | :---: | :--- |
| F1 | El asunto común, los adaptadores y la pantalla, sin mecánica nueva | M | Ves la semana entera en un sitio |
| F2 | Lo que dejas caer: consecuencias con motivo al cerrar la semana | M | Ignorar duele, y se ve |
| F3 | Los despachos | L | El grupo grande sirve; decides quién va |
| F4 | La crónica y el gancho | S–M | Cada semana cierra con ganas de la siguiente |
| F5 | Equilibrio: plazos, premios y riesgos | — | Continuo |

**El primer paso:** la F1 con solo tres fuentes (facciones, tablón e hilo). Es poco código, porque todo se calcula ya, y enseña enseguida si ver la semana junta cambia cómo juegas.

---

### 🔎 Propuesta 2 · Casos con verdad

**En una frase.** El motor genera un crimen o un misterio con **una verdad fija** (quién, por qué, cómo, dónde y cuándo) y reparte pistas por el mundo. Tú las juntas, deduces y acusas. **El narrador solo ve las pistas que ya has encontrado.**

**Por qué engancha.** Por curiosidad, que es lo que más dura.

- ***Sherlock Holmes: Detective Asesor***, el juego de mesa: direcciones, párrafos que se leen y deducción. Puro texto, y la prueba de que no hace falta arte.
- ***Return of the Obra Dinn*** y ***Her Story***: el clic de encajar lo que sabes.
- ***Shadows of Doubt***: misterios generados sobre una ciudad simulada.

Lo esencial es que **la verdad está fija**, así que te puedes equivocar, y equivocarte cuenta.

**Por qué encaja con el tope de tokens.**

- **El narrador no puede destripar lo que no sabe.** Es el mismo principio que los secretos que se sonsacan (110).
- El prompt solo crece con lo que encuentras, unas pocas líneas.
- Buscar, cruzar y acusar es juego del motor, así que no cuesta nada.

**Cómo se juega:**

> **Caso: el molinero ahogado.** Soto del Roble, día 12.
>
> **La verdad, que solo sabe el motor:** lo mató **Oria, la barquera**, porque el molinero iba a contarle a Vane que ella pasaba contrabando para los Leales. Con un remo, en el muelle, la noche del martes.
>
> **Las pistas:**
> - El remo roto en el cobertizo: registrar, Investigación CD 12.
> - La viuda oyó discutir de dinero: hablar con ella, si os mira con actitud 0 o más.
> - El libro del molinero, con pagos de los Leales: sonsacar al aprendiz.
> - En la posada: «la barquera tiene oro nuevo».
> - El carretero vio una capa verde en el muelle. El hijo del alcalde también lleva una capa verde: es una **pista falsa**, y él tiene su propio secreto, que es verdad pero no es este.
>
> En el tablero del caso, con los sospechosos, los móviles y el martes por franjas, acusas a Oria con el remo y el libro. **Aciertas:** los Leales os miran peor, Vane mejor, 90 de oro, y el molino vuelve a moler. **Si acusas al hijo del alcalde:** lo encierran, Oria huye en dos días, y cuando se sepa el pueblo os mirará peor.

**Lo que ya existe y se aprovecha.**

| Pieza que ya existe | En un caso es… |
| :--- | :--- |
| Investigaciones con pistas (107) | El molde de «hacen falta N pistas» |
| Secretos que se sonsacan (110) | Mentirosos creíbles y pistas falsas que son verdad de otra cosa |
| Actitudes con límites (140) | Quién te habla y quién no |
| Rumores (`rumors.js`) | Pistas que se oyen en la posada |
| El calendario por franjas | La línea de tiempo del caso |
| Crimen y guardias (96) | Lo que pasa al acusar, bien o mal |
| Facciones y lo que busca cada uno | Los móviles |
| La gente del mundo, con oficio y sitio | Los sospechosos |
| Relojes | El culpable que huye o vuelve a actuar |
| El diario (100) | Donde quedan las pistas encontradas |
| El guion y el Gem | Casos escritos a mano |

**Lo que hay que construir.**

1. **El generador de la verdad.** Plantillas de caso (asesinato, robo, desaparición, sabotaje, traición) con huecos que se llenan con la gente, los sitios y los motivos de tu partida: deudas, facciones, celos, secretos. Puro, y con semilla.
2. **Las pistas como hechos.** Cada pista es un hecho atómico con su fuente (una persona, un sitio, un objeto, un cuerpo o un documento) y su forma de conseguirla: hablar, sonsacar, registrar, pagar, deber un favor o llegar a tiempo.
3. **El comprobador de que se puede resolver.** Cada hecho clave tiene que tener al menos dos caminos, y ninguna pista falsa puede dejar a un inocente sin salida. Es un pequeño resolvedor que se prueba con tests: miles de casos generados en la suite. **Es la pieza más difícil, y la que decide si esto funciona.**
4. **El tablero del caso.** Una pantalla de texto, hecha de listas y selectores, sin arte:
   - los hechos conocidos;
   - los sospechosos, con lo que se sabe de cada uno;
   - la línea de tiempo por franjas;
   - **acusar**: quién, por qué y con qué pruebas.
5. **Las consecuencias**, con lo que ya existe: facciones, fortuna, guardias, rumores y el culpable que se escapa.
6. **`caso:` en el guion**, con el mismo formato, para que el Gem escriba un caso redondo cuando quieras uno a mano.

**Tokens.**

- Generar y resolver un caso no cuesta nada.
- Cada pista, al encontrarla, cuesta **cero** si sale de una plantilla («La viuda dice que…»). Si no, es **una frase** en el siguiente mensaje del narrador: «Cuéntalo en boca de la viuda: <hecho>. Una frase».
- **La verdad nunca va al prompt.**

**Riesgos, y cómo se evitan.**

| Riesgo | Cómo se evita |
| :--- | :--- |
| Casos que se notan generados, de rellenar huecos | Pocas plantillas muy trabajadas (8 a 10), con motivos sacados de lo que ha pasado en tu partida; y casos escritos a mano para los grandes momentos |
| Casos imposibles, o triviales | El resolvedor, y un dial de dificultad: cuántos caminos por hecho y cuántas pistas falsas |
| El narrador se inventa pistas | Lo de siempre: lo que narra no crea estado. Solo el tablero del caso decide. Y una línea en la instrucción: «no inventes pistas» |

**Por fases.**

| Fase | Qué | Esf. | Al terminarla… |
| :--- | :--- | :---: | :--- |
| F1 | Verdad, pistas y resolvedor: puro y probado | L | Nada visible aún; miles de casos pasan los tests |
| F2 | Las pistas conectadas a los verbos que ya hay: hablar, sonsacar, registrar, rumores | M–L | Se encuentran pistas jugando |
| F3 | El tablero del caso y acusar | M | El primer caso completo jugable |
| F4 | Consecuencias, y el culpable con reloj | M | Equivocarse duele |
| F5 | `caso:` en el guion y en el Gem | S–M | Casos escritos a mano |

**El primer paso:** **un solo caso escrito a mano** para 1387, con las pistas de la 107 y un tablero que sea una lista. Así se ve si engancha antes de meterse con el generador, que es lo caro.

---

### 🗣️ Propuesta 3 · El Duelo de Palabras

**En una frase.** Las conversaciones que importan se juegan en unas pocas rondas, con argumentos que salen de lo que tienes, contra alguien con paciencia, deseos y miedos. Son las de convencer, regatear, interrogar, calmar a alguien o reclutar. **El narrador lo cuenta una vez, al final.**

**Por qué engancha.**

- ***Griftlands***: la negociación es un combate de cartas y pesa tanto como las peleas.
- ***Disco Elysium***: las habilidades hablan, y hay tiradas que se pueden repetir y tiradas que no.
- La negociación con demonios de ***Shin Megami Tensei*** y ***Persona***.

Esto da a la mitad social del rol la misma profundidad que al tablero, y a las 18 habilidades una razón para existir.

**Cómo se juega:**

> **Convencer al capitán de la guardia de El Peaje Norte** para que os deje pasar sin pagar.
>
> El capitán tiene **paciencia 10**, quiere **orden**, teme **a Vane** y está en postura **desconfiada**: lo que suene a truco cuenta la mitad.
>
> **Tu mano**, que sale de lo que tienes:
> - *Persuasión*: una tirada.
> - *Enseñar el sello de los Leales*: un favor. Suma 3 fijos, pero si el capitán es de Vane, resta 2.
> - *Enseñar la carta del molinero*: una pista del caso. Suma 4 si toca lo que teme.
> - *Que hable Bran*: vínculo 4. No tira, suma 2, y si sale bien sube su aprobación.
> - *10 de oro*: un soborno. Suma fijo, pero si se sabe, los Leales os miran peor.
>
> **Ronda 1:** la carta del molinero toca lo que teme; su paciencia baja de 10 a 4. Él replica: «¿Y quién me dice que no la habéis escrito vosotros?», y tu compostura baja 2.
> **Ronda 2:** habla Bran; paciencia 2.
> **Ronda 3:** Persuasión, 14 contra 12; paciencia 0. **Cede.**
>
> Al final, **una llamada**: el narrador recibe las tres rondas en cuatro líneas y lo cuenta.

**Lo que ya existe y se aprovecha.**

- Las tiradas de habilidad y la ficha que las ofrece al leer lo que escribes (137).
- Las actitudes con límites (140).
- Lo que busca cada compañero y cada facción, y la aprobación (28).
- Los secretos (110) y las pistas (107).
- El regateo de la tienda.
- Los vínculos y las escenas de confidente.
- Las frases por carácter, como las de combate.

**Lo que hay que construir.**

1. **El motor del duelo.** Tiene cuatro piezas:
   - la paciencia del otro y tu compostura;
   - las posturas: desconfiado, orgulloso, asustado, codicioso, leal…;
   - las réplicas del PNJ;
   - tres resultados: lo consigues, lo consigues a medias y con un precio, o fracasas con consecuencia.

   Es puro y se prueba con tests.
2. **La mano**, sacada de lo que ya hay:
   - habilidades, que se tiran;
   - pruebas, que son las pistas y los secretos conocidos;
   - favores, que salen de la reputación;
   - dinero y objetos;
   - compañeros, según su vínculo y lo que buscan.

   **Si mientes y luego se descubre, se paga.**
3. **La pantalla**: tarjetas de texto y botones, como las maniobras. Sin arte.
4. **Las frases de cada ronda**, sacadas de bancos de plantillas por postura. No cuestan nada.
5. **El resumen al narrador**: una llamada al final, con las rondas en pocas líneas.
6. **En el guion**: quién tiene duelo, con qué postura, qué quiere y qué teme. Y el Gem lo escribe.

**Tokens.** **Es el mayor ahorro de las tres.** Hoy una conversación importante son varios mensajes, y cada uno es una llamada con el prompt entero. Con el duelo, **es una llamada al final**. El chat libre sigue ahí para quien quiera hablar sin más, pero lo que mueve el juego (un precio, una actitud, una información) sale del duelo.

**Riesgos, y cómo se evitan.**

| Riesgo | Cómo se evita |
| :--- | :--- |
| Que parezca un minijuego pegado, fuera de la historia | Los argumentos se llaman por lo que son en la historia («Enseñar la carta del molinero»), no «Carta +4». Y el narrador lo cose todo al final |
| Que se vuelva repetitivo | Cada postura cambia qué funciona. Y los PNJ importantes llevan réplicas propias, escritas en el guion |
| Que mate el rol libre | Solo para conversaciones con algo en juego. Para charlar, el chat de siempre |

**Por fases.**

| Fase | Qué | Esf. | Al terminarla… |
| :--- | :--- | :---: | :--- |
| F1 | El motor puro: paciencia, posturas, argumentos y resultados | M–L | Tests |
| F2 | La mano, sacada de lo que ya existe | M | Tu partida decide lo que puedes decir |
| F3 | La pantalla y las frases por postura | M | El primer duelo jugable |
| F4 | Duelos en el guion y en el Gem | S–M | PNJ con carácter propio |
| F5 | Equilibrio | — | Continuo |

**El primer paso:** convertir **el regateo de la tienda** en un duelo de tres rondas. Es pequeño, se usa mucho y enseña si la forma funciona antes de llevarla a todo lo demás.

---

## 🔗 5. Cómo encajan

```
 SEMANA ── La Mesa: 4-5 asuntos, no caben todos
             │
             ├── vas tú ──────────► ESCENA: tablero (combate) · caso (pistas) · duelo (palabras)
             ├── mandas a otros ──► despacho (lo resuelve el motor)
             └── lo dejas caer ───► su reloj avanza
             │
 CIERRE ─── Crónica: lo ganado, lo perdido, lo que viene ──► la semana siguiente
```

**Las tres se alimentan entre sí:**

- Un caso es un asunto de la mesa.
- Interrogar a un sospechoso es un duelo.
- Una pista es un argumento.
- Mandar a alguien a vigilar el muelle es un despacho que puede traer una pista.

**Dónde habla el modelo en ese bucle:**

| Momento | Llamadas |
| :--- | :--- |
| Al final de un combate (el epílogo, que ya existe) | 1, en el siguiente mensaje |
| Al final de un duelo | 1 |
| La crónica de la semana | 0 con plantillas, 1 si la quieres contada |
| El cambio de acto (143, que ya existe) | 0 |
| El chat libre | Las que quieras, pero ya no lo necesitas para avanzar |

---

## 🧭 6. En qué orden, y qué no haría

**El orden que recomiendo:**

1. **Primero, una tarde:** el diario de sesión (consejo 8) y jugar una semana entera apuntando. Puede cambiar todo lo que viene después.
2. **La Mesa, fases 1 y 2.** Es el eje: junta lo que ya existe y arregla el «no sé qué hacer» sin contenido nuevo.
3. **El Duelo, fases 1 a 3**, empezando por el regateo. Es el mayor ahorro de tokens, y su pantalla de tarjetas de texto la reutilizan las otras dos.
4. **La Mesa, fases 3 y 4**: los despachos y la crónica.
5. **Los Casos.** Son lo más grande y lo que más dura, y cuando lleguen ya estarán la mesa (donde aparecen) y el duelo (para interrogar).

**Qué no haría:**

- **Más baterías de ideas sueltas, por ahora.** El juego tiene anchura de sobra; le falta eje. Cada idea suelta nueva es un sistema más que no se ve.
- **PNJ que piensan con el modelo**, uno por llamada. Multiplica el gasto; el motor, con metas y relojes, da casi todo lo que se nota por cero.
- **Arte**: mapa dibujado, retratos. Nada de lo de aquí lo necesita.

---

## 🗑️ Lo que pensé y dejé fuera

| Idea | Por qué no, ahora |
| :--- | :--- |
| **Temporadas con legado**: campañas cortas encadenadas en las que el gremio sobrevive, al estilo roguelite | Engancha mucho, pero se parece a la 112 (Nueva partida+), que quitaste. Si algún día la quieres, se apoya en el salón de la fama (199) y los veteranos (179), que ya están |
| **Varios grupos a la vez**: el gremio como juego de gestión | Es la Mesa llevada al extremo. Los despachos dan lo mismo con mucho menos |
| **Un mundo simulado a lo Dwarf Fortress** | Las facciones ya lo hacen a la escala que se nota. Más simulación es ruido que se lee en un menú: la trampa de Bannerlord que `factions.js` evita a propósito |

---

## 🔗 Enlaces

- [[ROADMAP_PEGAMENTO]]: **el plan por fases** que prepara estas tres propuestas y junta lo que hoy va suelto.
- [[ROADMAP_MAESTRO]]: los cuatro relojes y «¿por qué querrías jugar mañana?», de donde parte este análisis.
- *IDEAS_200*: las 200 ideas, ya hechas, sobre las que se apoyan las tres propuestas.
- *ANALISIS_FALLAS_JUGABLES_Y_SOLUCIONES*: «la ficha dormida» (punto 7), que el Duelo de Palabras termina de resolver.
- [[ROADMAP_MUNDOS_VIVOS]]: el detalle de lo construido.
