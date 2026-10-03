# Encargo: el muelle táctico y la pantalla de victoria o derrota

Lo pidió Daniel el 2026-10-03, jugando. Son tres problemas del combate.

## 1. El personaje se mueve dos veces al atacar

Al pulsar Atacar, la ficha hace la embestida cuando se tira el dado, y la repite al dar el golpe. Debe hacerla **una sola vez, al ejecutar el ataque**. Mientras rueda el dado, la ficha se queda quieta (como mucho, un brillo de «preparándose»).

## 2. El menú de acciones tapa el tablero: el «muelle táctico» a la izquierda

Encargo del Director de UX, resumido.

**El problema.** El menú (`.gs-action-menu`) se abre centrado encima de la barra de abajo y tapa el tercio inferior del tablero. Justo ahí están las fichas en una pelea cuerpo a cuerpo. Además, con el arma, los objetivos y el golpe sin armas pasa de 440 px de alto. De poco sirve que los objetivos brillen en rojo o azul si el menú los tapa. Mientras tanto, la columna izquierda, encima del minimapa, está vacía.

**La solución: tres zonas, sin tapar el centro.**
- **Derecha (información pasiva):** la iniciativa con caras y el resumen plegable, como ahora.
- **Izquierda (decisiones activas):** el menú pasa a ser un **muelle táctico** anclado a la izquierda, encima del minimapa y de los botones de la cámara (`left: 24px; bottom: ~175px`):
  - 360 px de ancho, `max-height: calc(100vh - 250px)`, con su propio scroll (barra de 5 px);
  - por debajo de la cabecera, con al menos 50 px de margen;
  - entra deslizándose desde la izquierda (`translateX(-16px)` → 0).
- **Centro:** limpio siempre. Las fichas, el alcance, el camino y los dados se ven enteros mientras el menú está abierto.
- **Abajo:** la barra de acciones se queda centrada, con las píldoras de 2024, «Cuerpo a tierra» y los atajos 1, 2, 3 y 4.

**Cerrar el muelle:**
- con el aspa ✕ de su cabecera;
- volviendo a pulsar su botón o su tecla (1 Atacar, 2 Magia, 3 Acciones, 4 Adicional);
- pulsando en cualquier sitio vacío del mapa.

**Lo que no cambia:** los datos de las tarjetas (armas, maestrías, objetivos, conjuros), los atajos, la cámara y el minimapa, y las reglas.

**Criterios de aceptación:**
- A 1280×720 y 1920×1080, con cualquier menú abierto, el centro se ve entero: ninguna ficha queda tapada.
- El muelle sale a la izquierda, encima del minimapa, con al menos 170 px por abajo y 50 px por arriba.
- Se cierra de las tres maneras.
- Con muchas opciones, se recorre con su scroll interno sin salirse de la pantalla.

**En el móvil:** el muelle no cabe a la izquierda. Ahí es una hoja que sube desde abajo, con el tablero visible encima; la cámara aparta lo justo para que el objetivo se vea.

## 3. La pelea acaba de golpe: «puum, se acabó»

**El problema.** Al golpear al último enemigo, el juego ya sabe que muere y acaba la pelea antes de que se vea el ataque.

**Lo que se quiere:**
1. Se ve el ataque entero: la embestida, el dado, el golpe, el número y la ficha que cae.
2. Solo al terminar todo ese efecto visual sale una **pantalla de victoria o de derrota**, siguiendo la maqueta [resultado-combate.html](resultado-combate.html). Ábrela en el navegador: arriba tiene un conmutador entre victoria y derrota. Es una maqueta: carga Font Awesome y caras de internet que el juego no debe cargar; usa el arte del juego.

**Victoria:**
- Cabecera dorada con un escudo: «Victoria» y una línea con el sitio y la ronda en que acabó.
- **Balance de la compañía:** cada uno con su cara, nombre, clase y nivel; su vida en barra («8/18 PG»); su estado («En pie», «Magullado», «Inconsciente», con su secuela si la hay); los PX ganados; y «Subir a nivel N» si le toca.
- **Botín:** el oro y los objetos recogidos, cada uno con su icono y su tipo (común, misión, material).
- **Pie de ventana:** la hora del juego, y las acciones que tengan sentido en ese momento.

**Derrota:**
- Cabecera roja con una calavera: «El grupo ha caído».
- **Bajas y secuelas:** quién cayó, sus heridas y las secuelas permanentes.
- **El coste:** quién os rescata (por ejemplo, el gremio) y cuánto cobra, y el tiempo en cama.
- **Botones:** despertar en la enfermería, cargar el punto anterior y, si hace falta, salir al menú.

**Modo duro (D-J64):** la muerte de un confidente es definitiva. En la derrota, la pantalla lo dice claro.

**Los botones de la maqueta son de ejemplo.** Daniel: «obviamente los botones tendrán algún sentido, y no tienen que ser los que salen». Pon los que tengan sentido en el juego:
- **Victoria:** seguir con la historia (D-J45: lo siguiente que toque, o volver al sitio si el tablero se queda vacío), registrar la sala si quedan cofres o puertas, y un descanso corto si hay heridos.
- **Derrota:** despertar donde os recogen y cargar el punto anterior si el modo lo permite.

**Sin narrador (D-J60):** la línea de cabecera no es una narración, es un dato («Encuentro superado en La bodega · ronda 3»). Si quieres una frase, que la diga alguien del grupo.
