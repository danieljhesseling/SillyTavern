# Ronda 10 · La altura y las salidas (Claude)

Esta ronda no cambia la historia. Dos tableros pedían en su `mecanica_pendiente` justo lo que el motor sabe jugar desde B1 y B2 de [Lo que falta](../../LO_QUE_FALTA.md): **salir por una ventana** (la casilla `x`) y **disparar desde lo alto** (la casilla `^`). Aquí se les pone, y su `mecanica_pendiente` se vacía. El guionista puede reescribirla entera.

- **El cuarto de la posada**: la puerta de abajo era, según la ronda 8, «la ventana que da al callejón». Ahora es una salida: quien la pisa puede irse de la pelea, y si salen todos, se acaba en huida.
- **Las torres del peaje**: la fila de las almenas de las dos torres está en alto. Quien dispara desde ahí contra el patio, dispara con ventaja; subir cuesta el doble. El desfiladero del este ya funcionaba (`v`).

Los otros dos que hablaban de altura (la empalizada del peaje y la escalinata de Vane) se quedan como estaban: por el mapa no se sabe qué casillas son las altas, y eso lo decide quien escribe.

tablero:
  id: habitacion-de-la-posada
  mapa:
    - "################"
    - "#...c..........#"
    - "#######o########"
    - "#c....c....C...#"
    - "#..............#"
    - "#.....c........#"
    - "#......~....c..#"
    - "#C.............#"
    - "#######x########"
    - "#......~.......#"
    - "################"
  mecanica_pendiente: ""

tablero:
  id: el-peaje-norte
  mapa:
    - "##################"
    - "#....#......#....#"
    - "#.c..D......D..c.#"
    - "#^^^^#......#^^^^#"
    - "###.##......##.###"
    - "#......~~~~.....v#"
    - "#...c..~~~~..c..v#"
    - "#...............v#"
    - "#.......C.......v#"
    - "##################"
  mecanica_pendiente: ""
