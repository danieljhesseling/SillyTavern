---
title: Roadmap — Lo que el juego podría hacer solo
tags: [roadmap, automatizar, procedural, generación, novela-visual, comodidades]
created: 2026-10-02
---

# 🎲 Lo que el juego podría hacer solo

> **Qué es esto:** lo que hoy hay que escribir a mano en el juego (diálogos, misiones, romances, escenas), o que el jugador hace a mano y le aburre, y que el motor podría hacer solo con código y tablas, sin IA.
> **Cuándo:** al terminar el [[ROADMAP_SIN_CONEXION]], cuando allí solo quede lo aparcado.
> **Por qué:** cada campaña escrita a mano tiene un final. Un motor que genera gente que habla, misiones con sentido y un mundo que se mueve solo da partidas que no se acaban, y tu Gem solo tiene que escribir lo importante.
> **Regla:** todo lo que se genere se cuenta como conversaciones de novela visual entre la gente, con sus retratos, como en *Etrian Odyssey* (D-J54). El narrador casi no habla.

---

## 1. Lo que el juego ya hace solo

Ya existe en el motor, así que lo que viene después se apoya en esto:

| Qué | Dónde |
| :--- | :--- |
| Un mundo entero sale de una **semilla**: sitios, biomas, el tiempo que hace | `campaign/seed.js`, `compendio/mundo.json`, `sitios.json` |
| **Nombres** por trozos y plantillas (cientos por cultura) | `compendio/nombres.json` |
| **Personas** con rasgos, un deseo y un miedo | `compendio/personas.json` |
| **Misiones** con su gramática: verbo + objeto + giro + recompensa | `compendio/misiones.json`, `campaign/contracts.js` (el tablón se llena solo) |
| **Objetos** de forma × material, con propiedades que dan algo y quitan algo | `compendio/forge.js`, `propiedades.json` |
| **Facciones** con metas y ritmo, que mueven los precios | `compendio/facciones.json`, `campaign/economy.js` |
| **La tienda**: el género cambia cada semana y los precios se explican | `campaign/shop.js` |
| **Rumores**, **sucesos** en tarjetas con decisiones y **casos** (asesinatos) generados | `campaign/rumors.js`, `sucesos.js`, `cases.js` |
| **Tableros** generados con presupuesto de amenaza, **trampas** y **tesoro** | `board-intent.js`, `dungeon-generator.js`, `pack-fill.js` |
| **Historias en tres actos** para campañas sin hilo escrito | `campaign/act-grammar.js` (J10.7) |
| **Charla corta**, frases de compañeros, noches y charlas de pareja (de tablas escritas) | `small-talk.js`, `companion-lines.js`, `nights.js`, `pair-talks.js` |
| **Epílogo** de cada compañero, sacado de lo que pasó | `campaign/epilogues.js` |
| **Quién está dónde** a cada hora | `campaign/whereabouts.js` |

**Lo que falta:** la gente habla poco por sí misma. Los diálogos con ramas, las misiones personales y los romances están escritos uno a uno (tres diálogos, tres misiones personales, dos romances). Y el jugador sigue haciendo a mano cosas que el juego podría hacer por él.

---

## 2. Fases

| Fase | Título | Esfuerzo | Qué gana el jugador |
| :--- | :--- | :---: | :--- |
| **G1** | La gente habla sola | L | Cualquier persona del mundo tiene conversación de verdad, no solo las escritas |
| **G2** | Historias que se escriben solas | L | Misiones personales, romances, la historia de tu héroe y epílogos para todos |
| **G3** | El mundo se mueve solo | M | Lo que pasa en el mundo se nota y llega a ti como noticias, encargos y escenas |
| **G4** | Campañas enteras con un botón | M | «Campaña nueva»: eliges tema y duración, y sale una campaña jugable |
| **G5** | El juego hace lo aburrido | M | Explorar, equipar, subir de nivel, preparar conjuros y peleas fáciles, en un toque |
| **G6** | Un director de juego | M | El ritmo y la dificultad se ajustan a cómo juegas |

---

## 3. Detalle

### G1 · La gente habla sola

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G1.1 | **Una conversación para cualquier persona**, con sus ramas, sacada de quién es: sus rasgos, su deseo, su miedo, su oficio y su «voz». Saluda según os conozcáis, cuenta un rumor, pide algo (una misión de la gramática que encaja con su deseo), regatea o se asusta si la amenazas | Solo Brunilda, Giles e Ismark tienen diálogo con ramas; los demás, charla corta | L | Diez personas generadas: cada una suena distinta y pide cosas que van con ella |
| G1.2 | **Los sucesos, contados por la gente.** Cada tarjeta de suceso se convierte en una escena de novela visual con quien está allí: el mendigo habla, un compañero opina y tú decides | Tarjetas con texto del narrador | M | Los sucesos de 1387 salen como conversaciones, con sus mismas decisiones |
| G1.3 | **Charlas de pareja para cualquier pareja**, sacadas de cómo es cada uno y de cómo se llevan (si chocan sus rasgos, discuten; si se aprecian, se cuentan cosas) | Solo las escritas en `noches.json` | M | Dos compañeros cualesquiera tienen al menos tres charlas distintas |
| G1.4 | **El pueblo, poblado solo.** En cada pueblo hay parroquianos, guardias, aprendices y vendedores ambulantes generados, con nombre, cara, horario y algo que decir | La gente de cada pueblo está escrita en el paquete | M | Un pueblo de semilla tiene gente a cada hora |
| G1.5 | **Una cara para todos.** Cada persona generada lleva un retrato elegido por su especie, oficio y edad, con variaciones de paleta para que no se repitan. Nada de siluetas | Si no hay retrato escrito, sale silueta | S | Ninguna silueta en un pueblo de semilla |

### G2 · Historias que se escriben solas

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G2.1 | **Una misión personal para cada compañero**, al llegar al vínculo 4, sacada de su deseo y su miedo: un sitio, una pelea o una escena, y dos finales | Tres escritas (Gerd, Nella, Osric) | M | Cualquier mercenario contratado tiene la suya |
| G2.2 | **Romances para quien lo permita**, con las señales, las citas, la escena con fundido a negro y el epílogo, armados con plantillas y la voz de cada uno | Dos escritos | L | Un compañero generado tiene un romance completo |
| G2.3 | **La historia de tu héroe.** De lo que eliges al crearlo (trasfondo, especie, clase) salen ganchos: alguien de tu pasado aparece en el tablón o en una campaña | El trasfondo no lleva a nada | M | Dos héroes con trasfondos distintos reciben ganchos distintos |
| G2.4 | **Epílogos de todo el mundo.** Al acabar una campaña, una escena por sitio, persona y facción que tocaste, según lo que hiciste (a quién salvaste, a quién robaste, quién ganó) | Epílogos de compañeros y finales escritos | M | Dos finales jugados distinto dan epílogos distintos |
| G2.5 | **Un villano que responde.** El enemigo de la historia en tres actos reacciona a lo que haces: si le quitas aliados, busca otros; si te acercas, te pone trampas o manda un mensaje | El villano sigue su guion | M | Dos partidas con decisiones distintas ven movimientos distintos del villano |

### G3 · El mundo se mueve solo

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G3.1 | **Noticias de verdad.** Lo que hacen las facciones y lo que haces tú llega como rumor a la taberna, como encargo al tablón y como escena con alguien que lo cuenta, en vez de rumores de tabla sueltos | Rumores de tabla y escritos | M | Tras un cambio de facción, en dos días se oye en la taberna y hay un encargo |
| G3.2 | **Lo de cada sitio, generado.** Las cosas que mirar, los secretos y las notas de las salas salen del tipo de sitio para las campañas que no las traen | Escritas en el paquete, o vacías | M | Una campaña de semilla tiene algo que mirar en cada sitio |
| G3.3 | **Mazmorras con vida.** Cada sala generada lleva nombre, una nota, a veces una trampa o un tesoro, y quién la usa (guarida, almacén, santuario) | Salas sin nombre en los tableros generados | M | Un tablero generado se lee como un sitio, no como una cuadrícula |
| G3.4 | **Objetos con historia.** Las reliquias y los objetos raros salen con nombre, quién los tuvo y qué les pasó, de la forja y las facciones | Nombres de forma × material | S | Una reliquia generada tiene su historia y alguien que la reconoce |

### G4 · Campañas enteras con un botón

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G4.1 | **«Campaña nueva» en el tablón:** eliges un tema (terror, intriga, guerra, misterio) y una duración, y el juego junta todo lo anterior: mundo, pueblos, gente, facciones, villano, tres actos y finales. La campaña aparece en el tablón como una más | Las piezas existen sueltas (semilla, actos, gente); falta juntarlas en un botón con tema | M | Tres semillas con tres temas dan tres campañas jugables hasta un final |
| G4.2 | **Temas que se notan:** cada tema cambia el vocabulario, el tiempo que hace, los enemigos, las facciones y el tono de las escenas | — | M | El mismo mundo con dos temas se lee distinto |
| G4.3 | **Tu Gem escribe solo lo importante.** Si una campaña trae el hilo y unos pocos personajes clave, el resto lo pone el motor sin que se note la costura | Lo que falta se rellena (J5.3), pero plano | M | Una campaña de tu Gem con solo diez líneas de historia se juega entera |

### G5 · El juego hace lo aburrido

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G5.1 | **Explorar solo:** el grupo recorre el tablero hasta que encuentra algo (una puerta, un cofre, un enemigo, una trampa vista) y se para a preguntarte | Casilla a casilla | M | Un tablero se explora en dos o tres toques |
| G5.2 | **Viajar sin interrupciones:** el viaje solo se para por lo que importa: un suceso con decisión, una charla, una pelea | Hay pasos que solo piden «Continuar» | S | Un viaje de tres días sin sucesos es un toque |
| G5.3 | **Peleas fáciles, resueltas:** si la pelea es claramente vuestra, «Resolver» la simula con las reglas de siempre y te cuenta cómo fue y qué costó | Se juega turno a turno | M | Una pelea contra tres ratas se resuelve en un toque, con heridas reales |
| G5.4 | **Subir de nivel recomendado:** el juego propone lo mejor para el papel de cada uno, y a los compañeros que lleva el juego los sube solo | Se elige a mano | S | Un mercenario sube solo con elecciones que tienen sentido |
| G5.5 | **Equipar lo mejor:** al conseguir algo mejor, el juego lo propone y viste a los compañeros que lleva él | A mano | S | Una espada mejor acaba en la mano de quien la usa |
| G5.6 | **Conjuros preparados según el papel:** tras el descanso largo, quien cura prepara curas, quien ataca prepara daño. Tú puedes cambiarlos | A mano | S | Un clérigo despierta con curas preparadas |
| G5.7 | **«Hasta…»:** pasar el tiempo hasta que alguien esté libre, hasta que abra la tienda o hasta mañana, con lo que pase por el camino | Parte a parte | S | Un toque te deja a la hora pedida |

### G6 · Un director de juego

| ID | Qué hace el juego solo | Hoy | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| G6.1 | **El ritmo:** si llevas muchas peleas seguidas, ofrece una escena tranquila (una noche, una charla, una quedada); si llevas mucho rato sin tensión, algo pasa | Los sucesos salen por azar | M | En diez horas de vuelta automática, no hay tres peleas seguidas sin respiro |
| G6.2 | **La dificultad según cómo te va:** si ganas todo sin un rasguño, los enemigos se espabilan; si caes a menudo, aflojan, sin que se note | Se ajusta por nivel y número (J4.6, J12.6) | M | Con un grupo que arrasa, la vuelta automática acaba con más peleas reñidas |
| G6.3 | **Qué hacer ahora:** si no sabes por dónde seguir, alguien de tu gente te lo dice con su voz («Brunilda dijo algo del faro, ¿no?»), según el hilo y lo que tienes a medias | El objetivo está en la cabecera | S | Tras un rato sin avanzar, un compañero lo sugiere |

---

## 4. Por dónde empezar

1. **G1.1 y G1.2:** la gente habla sola y los sucesos se cuentan como conversaciones. Es lo que más se nota y va con D-J54.
2. **G5.1, G5.3 y G5.4:** explorar solo, resolver las peleas fáciles y subir de nivel recomendado. Quitan lo más pesado de cada partida.
3. **G4.1:** el botón «Campaña nueva», que junta todo y da partidas sin fin.
