---
title: Roadmap — Lo que se puede automatizar
tags: [roadmap, automatizar, herramientas, pruebas, calidad]
created: 2026-10-02
---

# 🤖 Lo que se puede automatizar

> **Qué es esto:** lo que hoy se hace a mano, por mí, por los agentes o por ti, y que se podría hacer con código.
> **Cuándo:** al terminar el [[ROADMAP_SIN_CONEXION]], cuando allí solo quede lo aparcado.
> **Por qué:** casi todo lo que ha costado tiempo y uso en estas semanas ha sido trabajo repetido:
> - contar el avance fila a fila;
> - volver a probar todo;
> - buscar qué está construido pero sin enchufar;
> - comparar a mano qué personajes no tienen dibujo;
> - descubrir jugando que un texto nombra a alguien que aún no se ha presentado.
>
> Eso lo puede hacer una herramienta, siempre igual y gastando poco.

---

## 1. Lo que ya está automatizado

Para no repetirlo, esto ya existe en `tools/`:

| Herramienta | Qué hace |
| :--- | :--- |
| `check-fork-types.mjs` | Revisa los tipos de los archivos del juego |
| `check-state-keys.mjs` | Comprueba que cada clave de la partida está registrada |
| `check-engine-wiring.mjs` | Encuentra los módulos del motor que el juego nunca carga |
| `check-world-density.mjs` | Dice si cada sitio de una campaña tiene algo que hacer |
| `gem-instructions.mjs --check` | Comprueba que la guía del Gem va al día con el contrato |
| `campana-a-paquete.mjs --check` | Comprueba que el paquete de Strahd va al día con sus fuentes |
| `variedad-frases.mjs --check` | Mide que las frases del narrador no se repitan |
| `pixel-manifest.mjs` | Rehace la lista del arte |
| `app-movil.mjs` | Rehace el icono y el manifiesto de la app |
| `e2e-*.mjs` y `e2e-todo.mjs` | Las pruebas en el navegador, una a una o todas (`--rapido` para lo de cada cambio) |
| `vuelta-*.mjs` y `sim-campana.mjs` | Partidas jugadas solas y la simulación de combates |

La integración continua (`.github/workflows/fork-checks.yml`) solo pasa las pruebas unitarias y los tipos.

---

## 2. Fases

| Fase | Título | Esfuerzo | Para qué sirve |
| :--- | :--- | :---: | :--- |
| **A1** | El estado del roadmap, sin contarlo a mano | S | El porcentaje y la tabla de fases salen solos |
| **A2** | Una sola orden para comprobar | S | Antes de guardar, todo en un minuto y en una línea por prueba |
| **A3** | Que lo construido llegue al jugador | M | Encontrar lo que existe pero nadie usa |
| **A4** | El texto, revisado por código | M | Nombres, narrador, género, etiquetas: lo que hoy se ve jugando |
| **A5** | El arte que falta | S | Saber qué no tiene dibujo y pedirlo a PixelLab en lote |
| **A6** | Jugar solo y medir | M | Vueltas de noche, equilibrio, capturas, accesibilidad, móvil |
| **A7** | Las campañas de tu Gem, de punta a punta | M | Del JSON pegado al informe de cómo se juega, sin tocar nada |
| **A8** | Publicar | M | El APK y lo nuevo de cada versión |

---

## 3. Detalle

### A1 · El estado del roadmap, sin contarlo a mano

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A1.1 | **El avance.** Cada fila del roadmap lleva su estado en una columna: jugable, construido, sin empezar o aparcado. `tools/avance.mjs` cuenta el porcentaje y rehace la tabla por hitos de «Cómo va» | Lo cuento yo fila a fila, varias veces al día, y a veces se queda atrás | S | Lo que da la herramienta coincide con un recuento a mano |
| A1.2 | **La tabla de fases** (Hecho / Falta de cada fase) sale de sus filas | Se reescribe a mano y se quedaba antigua | S | La tabla cambia sola al cambiar una fila |
| A1.3 | **Las decisiones (D-J…).** Cada decisión dice si ya tiene código y pruebas, buscando en el código su marca (`// D-J47`) | La columna ✅/⏳ se pone a mano | S | Una decisión sin marca en el código sale como pendiente |
| A1.4 | **El resumen de los frentes en marcha.** Una herramienta lee todos los `progreso.md` de los agentes y saca una tabla: frente, pasos hechos y última hora | Lo saco yo con búsquedas sueltas | S | Coincide con los archivos de progreso |

### A2 · Una sola orden para comprobar

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A2.1 | **`node tools/comprobar.mjs`** pasa las pruebas unitarias, los tipos, las claves, el cableado, el lint de lo cambiado y el arranque del juego, con una línea por prueba. Con `--rapido`, solo lo de los archivos cambiados | Se lanzan una a una, y se repiten de más | S | Una orden, un resumen |
| A2.2 | **Al hacer commit**, una comprobación rápida: tipos, claves y lint de lo que se guarda. No deja guardar si algo falla | Nada lo impide; a veces entró código que rompía el arranque | S | Un commit con un error de tipos no entra |
| A2.3 | **La integración continua pasa también**: claves, cableado, guía del Gem, paquete de Strahd, variedad de frases, densidad de las campañas y el arranque en el navegador | Solo pasa pruebas unitarias y tipos | S | Rompe si una de esas comprobaciones falla |
| A2.4 | **Puertos para las pruebas en el navegador**, repartidos solos y sin choques | Cada agente elige un puerto a mano | S | Dos pruebas a la vez nunca chocan |
| A2.5 | **Pruebas que de verdad juegan.** Avisa si una prueba del navegador llama a funciones por dentro en vez de pulsar botones. Pasó con la de guardar: estaba en verde y el jugador no llegaba a esa pantalla | Se descubre mirando | S | La lista de pruebas «por dentro», cada una con su porqué |

### A3 · Que lo construido llegue al jugador

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A3.1 | **Funciones exportadas que nadie llama.** El cableado de hoy mira los módulos, no las funciones; por eso un módulo cargado parecía «enchufado» sin que nadie lo usara (las noches, las frases de camino, las opiniones) | Se encontró revisando a mano | M | Lista de funciones exportadas que el juego nunca llama |
| A3.2 | **Órdenes sin botón.** Compara las órdenes registradas con los botones, fichas y menús del juego sin conexión | Lista hecha a mano para J15.4 | S | Cada orden sale como «con botón» o «sin botón», con su porqué |
| A3.3 | **Lo que solo existe con modelo.** Funciones del juego que solo se alcanzan en partidas con conexión | No se mira | M | Lista para decidir qué falta sin conexión |

### A4 · El texto, revisado por código

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A4.1 | **La caja de la novela, limpia.** Al pasar las pruebas del navegador, se lee el texto que sale en la caja y se avisa si trae `[ETIQUETAS]`, ids, palabras en inglés, marcas sin resolver (`{npc:…}`) o «propio:» | Una prueba unitaria mira el contenido escrito, pero no lo que de verdad sale en pantalla | M | Las pruebas fallan con la frase y dónde salió |
| A4.2 | **Nombres que aún no conoces** (J13.7). En los paquetes, avisa de las líneas que nombran a alguien antes de que se haya presentado | Lo viste jugando: le contestabas al posadero por su nombre | M | Una línea así sale con su escena y su paso |
| A4.3 | **El narrador, en su sitio** (D-J54). En cada escena cuenta las líneas del narrador frente a las de la gente, y avisa si el narrador pasa de un límite | Se revisa leyendo | S | Lista de escenas con demasiado narrador |
| A4.4 | **El género, bien.** Cada texto con marcas `{…|…}` y cada oficio («el posadero» / «la posadera») se escribe con los dos géneros y se comprueba la concordancia | Lo viste jugando («LA POSADERA» para un hombre) | M | Lista de concordancias rotas |
| A4.5 | **La voz de cada uno.** Para cada persona, el largo de sus frases y su registro comparados con su «voz» del paquete; avisa de quien habla como un formulario | Se revisa leyendo | M | Informe por persona |

### A5 · El arte que falta

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A5.1 | **La lista de lo que no tiene dibujo**: personas, sitios, enemigos, objetos, iconos de clase y de habilidad | Los agentes comparan a mano el paquete con las carpetas | S | Una lista por campaña, con lo que sale ☠ o con la silueta |
| A5.2 | **Pedirlo en lote a PixelLab** desde esa lista, con la guía de estilo y un presupuesto de créditos; después, la lista del arte se rehace sola | Se pide uno a uno | M | La lista de lo que falta baja a cero |
| A5.3 | **Imágenes ligeras.** Avisa de los archivos que pesan demasiado y los reduce sin perder el pixel art | No se mira | S | Ninguna imagen pasa del límite |

### A6 · Jugar solo y medir

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A6.1 | **Vueltas de noche.** Las partidas automáticas (1387, Strahd, el gremio) se juegan cada noche y dejan un informe: silencios, atascos y tiempo | Se lanzan a mano cuando toca | S | Cada mañana, un informe |
| A6.2 | **El equilibrio de cada campaña.** La simulación saca, por pelea, cuántas veces se gana, cuántas rondas dura y cuánto daño hace, y marca las que son demasiado fáciles o difíciles | Se mira suelto | M | Informe por campaña |
| A6.3 | **Capturas comparadas.** Las pantallas clave se capturan y se comparan con la versión anterior y con las maquetas de `wiki/maquetas/` | Se miran capturas a ojo | M | Avisa cuando una pantalla cambia sin querer |
| A6.4 | **Accesibilidad.** Una revisión automática de contraste, nombres de botones y foco en cada pantalla | A mano (J15.5) | S | Cero errores graves |
| A6.5 | **El móvil, medido.** El tiempo de un turno con la CPU de un móvil tiene un tope, y si se pasa, falla | Se mide a mano (J20.6) | S | La prueba del móvil falla si se pasa |
| A6.6 | **Partidas guardadas de antes.** Unas cuantas partidas reales de versiones anteriores se cargan en las pruebas, para que ningún cambio rompa las de antes | Se prueba a mano tras cada cambio de estado (J4.2) | S | Todas cargan |

### A7 · Las campañas de tu Gem, de punta a punta

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A7.1 | **Del JSON al informe.** Pegas la campaña y, sin hacer nada más, se importa, se mide su densidad y un bot la juega entera. Te devuelve una lista para tu Gem con lo que falta, lo que se atasca y lo que se queda corto | Importar y el informe ya existen; jugarla entera y la lista final no | M | Una campaña de prueba da su informe completo |
| A7.2 | **Mapas en lote.** Una carpeta de mapas de D&D en imagen se convierte en tableros (cuadrícula, muros, salas), y solo se retoca lo que salió mal | Mapa a mapa, en el editor | M | Una carpeta de ejemplo da sus tableros |
| A7.3 | **Strahd siempre al día.** Si cambian sus fuentes (`libro.json`, `mejoras.json`), el paquete se rehace y se comprueba solo | Se rehace a mano | S | En la integración continua |

### A8 · Publicar

| ID | Qué se automatiza | Hoy se hace así | Esfuerzo | Cómo se comprueba |
| :--- | :--- | :--- | :---: | :--- |
| A8.1 | **El APK de Android** con una orden: el juego empaquetado sin servidor, que guarda en el teléfono (ver [[ROADMAP_PWA_SIN_SERVIDOR]]) | No existe | M | El APK se instala y arranca sin conexión |
| A8.2 | **Lo nuevo de cada versión**, para jugadores, sacado de los commits en español llano | No existe | S | Una lista corta por versión |
| A8.3 | **Enlaces del wiki.** Avisa de los enlaces rotos entre documentos (`[[…]]`) y de los archivos que nadie enlaza | No se mira | S | Cero enlaces rotos |

---

## 4. Por dónde empezar

1. **A1.1 y A2.1:** el avance que se cuenta solo y una sola orden para comprobar. Son las dos cosas que más uso han gastado.
2. **A3.1 y A4.2:** encuentran justo los dos fallos que te salieron jugando (funciones sin enchufar y nombres sin presentar).
3. **A6.1:** las vueltas de noche, para enterarse de los atascos sin jugar.
