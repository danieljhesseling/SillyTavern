# Encargo: el tablero de combate como un VTT (D&D 2024)

Lo pidió Daniel el 2026-10-01, con el encargo de su Gem de UX y la maqueta aprobada [combate-vtt-v3.html](combate-vtt-v3.html). Ábrela en el navegador: es la referencia visual y de comportamiento. La maqueta carga jQuery y avatares de dicebear desde internet; el juego no debe cargar nada de fuera.

## Lo que Daniel vio jugando (capturas del 2026-10-01)

1. **El narrador sobra.** En la caja de la novela, la placa «Narrador» no aporta nada. Cuando habla el narrador, no hay placa: solo el texto.
   - En la misma captura salía una etiqueta «LA POSADERA» encima de la primera línea, mientras el texto hablaba de «el posadero». El oficio tiene que ir con el género de la persona.
2. **Fuera de combate se andaban 120 pies de una vez.** El rótulo decía «Anda hasta 120 pies de una vez».
3. **Se andaba sobre el agua del muelle, «puro Jesucristo».** El agua profunda (el mar, un río hondo) no se cruza andando. La poco profunda es terreno difícil.
4. **El camino se desvía.** Para ir recto hacia el ratero, la ruta hacía eses. Ante dos caminos iguales, el elegido debe ser el más recto: menos giros, lo más cerca posible de la línea directa.
5. **No debería hacer falta pulsar «Iniciar combate».** Al entrar en un tablero con enemigos, la pelea empieza sola: primero colocas a los tuyos en las casillas de salida, y después la iniciativa.
   - «Evitar la pelea» como ficha suelta no tiene sentido. Si una pelea escrita tiene otras salidas, se ofrecen antes, como una decisión de la novela: Pelear, Hablar, Pagar, Huir o Esconderse.
   - Mientras estás en un tablero, no salen fichas que no son de ahí: «Saltar la prueba», «Hablar con la maestra del gremio», «Hablar con el posadero», «Escuchar rumores», «Tirada»…
6. **El movimiento parecía demasiado.** En combate son 30 pies (6 casillas), y ya era así. Para que se note, se usa la regla opcional de las diagonales: la primera cuesta 5 pies, la segunda 10, la tercera 5… Va en un solo interruptor, por si Daniel prefiere la de siempre (todas a 5).

## El encargo del Director de UX (resumen fiel)

### Diagnóstico de la pantalla de antes

- **El tablero va encajonado.** Lo aprietan una franja de registro abajo, que se come cerca de un cuarto del alto, y una columna fija a la derecha. En D&D los alcances son grandes (un conjuro, 120 pies; un arco largo, 600), así que hace falta ver el mapa entero o moverse por él.
- **Para decidir un ataque, la vista salta de un sitio a otro:** la ficha en el mapa, la vida y la CA en la esquina, los botones abajo.
- **En combate salen botones que no son de combate:** «Hablar», «Mascota», «Objetivos» repetido. En combate solo: moverse, atacar, defenderse y gastar recursos.
- **No refleja la economía de turno de 2024:**
  - el presupuesto de acción, acción adicional y reacción;
  - las maestrías de armas;
  - el impacto sin armas reglado: daño, agarrar o empujar;
  - la postura: cuerpo a tierra o derribado.
- **La iniciativa es una lista de texto sin caras.** Tampoco se ve hasta dónde llegas sin pulsar antes.

### La pantalla nueva: un HUD flotante sobre un lienzo a pantalla completa (como Foundry u Owlbear)

- **El mapa ocupa toda la pantalla de juego.**
  - Se arrastra con el ratón (o con el dedo) para moverlo.
  - La rueda hace zoom hacia donde apunta el cursor, de 0,45× a 2,2×; con dos dedos en el móvil.
- **Encima va una capa de HUD que no estorba al mapa:** solo las islas del HUD reciben clics.
- **Columna de arriba a la derecha:**
  - la iniciativa, con la cara de cada uno en un círculo de 26 px, su vida en una barra y el turno marcado;
  - debajo, el resumen del combate, que se pliega (sustituye a la franja de registro de abajo).
- **Minimapa abajo a la izquierda:** enseña lo que se ve ahora; pulsarlo lleva la cámara a ese punto. Encima, los botones de la cámara: acercar, alejar y centrar.
- **Marcadores de borde:** si un enemigo queda fuera de la vista, sale en el borde un aviso con su nombre y su distancia (por ejemplo, «Tirador furtivo · 90 pies»). Pulsarlo centra la cámara en él.
- **Centrar:** la tecla Espacio centra en quien tiene el turno. Pulsar una fila de la iniciativa centra en esa persona.
- **Alcance:** al pasar el ratón por tu ficha se iluminan las casillas a las que llegas, sin tener que pulsar antes. En el móvil vale el primer toque.
- **Barra de acciones abajo, en el centro:**
  - El estado del turno: las píldoras de Acción, Adicional y Reacción (listas o gastadas), el movimiento («15/30 pies») y el botón «Cuerpo a tierra». Tirarse es gratis; levantarse cuesta la mitad del movimiento.
  - Los botones: Atacar, Magia, Acciones, Adicional, Fin de turno y Abandonar.
- **Los menús se abren hacia arriba como un grimorio.** Cada opción es una tarjeta con su icono, su texto y sus etiquetas (daño, alcance, coste). Ninguno pasa de 440 px de alto ni se corta por arriba.
  - **Atacar:**
    - tus armas, con su maestría (por ejemplo, Vex: «al impactar, tienes ventaja en tu siguiente ataque contra él»);
    - el impacto sin armas: daño, agarrar (salvación con CD) o empujar (5 pies o derribado);
    - cambiar de arma, gratis al atacar.
  - **Magia:** las gemas de los espacios de conjuro que quedan, y filtros: Todos, Trucos, Nivel 1, Objetos.
  - **Acciones (2024):** Correr, Destrabarse, Esquivar, Ayudar, Ocultarse (CD 15 de Sigilo; si sale, quedas Invisible), Estudiar y Utilizar.
  - **Adicional:** beber una poción tú mismo (en 2024 es acción adicional; dársela a otro es Utilizar) y el ataque con la mano torpe si atacaste con un arma ligera.
- **Fuera de la barra de combate:** «Hablar», «Mascota», «Maniobras» y las listas de texto planas.

### Lo que no cambia

- Las cuentas del motor: tiradas, vida y distancias. Los menús nuevos llaman a lo que ya existe. Lo que falte de 2024 se añade al motor como reglas nuevas, con sus pruebas.
- Los tipos de terreno del motor.
- La cabecera del juego (`.gs-head`).

### Criterios de aceptación

- **El mapa llena la pantalla de juego sin barras de desplazamiento,** a 1280×720 y a 1920×1080. En el móvil también; ahí el HUD se compacta.
- **Espacio** centra en quien tiene el turno.
- **Alejarse de un enemigo lejano** hace salir su marcador de borde, y pulsarlo lleva la cámara hasta él.
- **Pasar el ratón por tu ficha** enseña tu alcance en azul.
- **Atacar** enseña el impacto sin armas reglado (daño, agarrar con CD, empujar con CD) y el cambio de arma. **Magia** enseña las gemas de los espacios que quedan.
- **El contraste** de botones y tarjetas cumple WCAG AA (4,5:1 sobre el fondo oscuro).

### Riesgos

- **Clics fantasma:** pulsar un botón del HUD no debe contar como un clic en una casilla del mapa.
- **La cabecera:** el HUD deja libre el hueco de la cabecera del juego.
