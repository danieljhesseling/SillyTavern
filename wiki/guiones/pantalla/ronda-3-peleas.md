---
title: El mundo tras la pantalla — ronda 3, los tableros y los encargos
tags: [pantalla, guion, tableros, encargos, combate]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 3: los tableros y los encargos

> Catorce mapas y dieciséis peleas, para un grupo de 4 (D-J56). Lo que se pide en cada una, más allá de «acabar con todos» (E1.1 de [[ROADMAP_ENTRETENIDO]]):
>
> - **Escapar**: el fielato de noche (llegar a la salida junto al barranco).
> - **Robar y salir**: la sala del registro (el libro del cofre y la ventana de la cocina).
> - **Romper los objetos del ritual**: los dos cristales de la Torre Tres; los dos de la cumbre.
> - **Aguantar en una puerta**: el patio de la Acogida, el molino, la escalera y la puerta de la torre.
> - **Saquear**: la cripta de la Torre Cuatro y los estantes del Archivo.
>
> **Empujar donde duele** (E1.2): el barranco del claro de los lobos, el del fielato, el foso de la Torre Tres, el agua honda del caz del molino y del lago, y la cumbre sin barandilla de la Torre Siete.
>
> El nivel de cada tablero, las salidas habladas (`avoid`, `parley`), las trampas y los objetivos de más de una línea van en la ronda 8, en piezas: el YAML no los sabe decir.

## Los mapas y las peleas

tablero:
  id: claro-de-los-lobos
  localidad: bosque-copiado
  mapa:
    - "##################"
    - "#..C....b...C.vvv#"
    - "#.....C......vvvv#"
    - "#..b......C...vvv#"
    - "#.......c.....~vv#"
    - "#.C...b.......~vv#"
    - "#.....C...b...~vv#"
    - "#..b.....C....~vv#"
    - "#........c.....vv#"
    - "#.C...b......C.vv#"
    - "#.......b......vv#"
    - "##################"
  inicio_grupo: [[1, 10], [2, 10], [3, 10], [4, 10]]

tablero:
  id: veredas-repetidas
  localidad: bosque-copiado
  mapa:
    - "################"
    - "#..C..C..C..C..#"
    - "#..............#"
    - "#.bb..bb..bb..b#"
    - "#..............#"
    - "#C..C..C..C..C.#"
    - "#..............#"
    - "#.bb..bb..bb...#"
    - "#..............#"
    - "#..C..C..C..C..#"
    - "#..............#"
    - "################"
  inicio_grupo: [[1, 10], [2, 10], [3, 10], [4, 10]]

tablero:
  id: huerto-de-la-ermita
  localidad: ermita
  mapa:
    - "################"
    - "#bbb....bb.....#"
    - "#b..c.......bb.#"
    - "#....bb..c.....#"
    - "#..........bb..#"
    - "#.c..b.........#"
    - "#......bb...c..#"
    - "#..bb......b...#"
    - "#..............#"
    - "################"
  inicio_grupo: [[1, 8], [2, 8], [3, 8], [4, 8]]

tablero:
  id: sala-del-registro
  localidad: cifra
  mapa:
    - "##################"
    - "#..k.#....c..#...#"
    - "#....D.......D.C.#"
    - "#..c.#..T....#...#"
    - "##o###.......#o###"
    - "#................#"
    - "#..c..C....C..c..#"
    - "#................#"
    - "###o#######o######"
    - "#................#"
    - "#.x..............#"
    - "##################"
  inicio_grupo: [[9, 10], [10, 10], [11, 10], [12, 10]]

tablero:
  id: patio-de-la-acogida
  localidad: casa-acogida
  mapa:
    - "##################"
    - "#^^^..........^^^#"
    - "#..T..c....c..T..#"
    - "#................#"
    - "#.=====....=====.#"
    - "#................#"
    - "#..c....C.....c..#"
    - "#................#"
    - "#...b........b...#"
    - "#.......~~.......#"
    - "#................#"
    - "##################"
  inicio_grupo: [[7, 2], [8, 2], [9, 2], [10, 2]]

tablero:
  id: el-fielato
  localidad: fielato
  mapa:
    - "####################"
    - "#...####...........#"
    - "#.c.#..#....^^^....#"
    - "#...D..D....^^^..c.#"
    - "#...####...........#"
    - "#..................#"
    - "#..c...===.===..c..#"
    - "#.................x#"
    - "#..................#"
    - "#vvvvvvvvvvvvvvvvvv#"
    - "####################"
  inicio_grupo: [[1, 5], [1, 6], [2, 7], [1, 8]]

tablero:
  id: molino-de-severino
  localidad: molinos
  mapa:
    - "##################"
    - "#......#.....wWWW#"
    - "#..T...#.....wWWW#"
    - "#......D.....wWWW#"
    - "#......#.....wWWW#"
    - "####D###.....wWWW#"
    - "#............wWWW#"
    - "#..c....c....wWWW#"
    - "#............wWWW#"
    - "#.....c......wWWW#"
    - "#............wWWW#"
    - "##################"
  inicio_grupo: [[5, 3], [6, 3], [4, 4], [5, 4]]

tablero:
  id: orilla-del-lago
  localidad: lago-espejo
  mapa:
    - "##################"
    - "#WWWWWWWWWWWWWWWW#"
    - "#WWWWWWWWWWWWWWWW#"
    - "#WWWwwwWWWWwwwWWW#"
    - "#wwww...www....ww#"
    - "#...............w#"
    - "#..c....b...c....#"
    - "#.......^^.......#"
    - "#..b.........b...#"
    - "#....c.....C.....#"
    - "#................#"
    - "##################"
  inicio_grupo: [[7, 10], [8, 10], [9, 10], [10, 10]]

tablero:
  id: ruinas-de-la-torre-tres
  localidad: ruinas-torre-tres
  mapa:
    - "####################"
    - "#^^^..............^#"
    - "#^^^...##....##...^#"
    - "#......#......#....#"
    - "#..c.....vvvv......#"
    - "#.......vvvvvv..c..#"
    - "#...C...vvvvvv.....#"
    - "#.......vvvvvv..c..#"
    - "#..c.....vvvv......#"
    - "#......#......#....#"
    - "#^^....##....##...^#"
    - "#^^...............^#"
    - "####################"
  inicio_grupo: [[1, 5], [1, 6], [1, 7], [2, 6]]

tablero:
  id: escalera-de-la-torre
  localidad: torre-siete
  mapa:
    - "################"
    - "#..^^^^^^^^^^..#"
    - "#..............#"
    - "#..c........c..#"
    - "#.====....====.#"
    - "#..............#"
    - "#.T..........T.#"
    - "#..............#"
    - "#...c......c...#"
    - "#..............#"
    - "#..~~......~~..#"
    - "################"
  inicio_grupo: [[5, 1], [7, 1], [9, 1], [11, 1]]

tablero:
  id: cumbre-de-la-torre
  localidad: torre-siete
  mapa:
    - "##################"
    - "#vvvvvvvvvvvvvvvv#"
    - "#vv............vv#"
    - "#v..c........c..v#"
    - "#v......^^......v#"
    - "#v.....^^^^.....v#"
    - "#v.....^^^^.....v#"
    - "#v......^^......v#"
    - "#v..c........c..v#"
    - "#vv............vv#"
    - "#vvvvvv....vvvvvv#"
    - "#vvvvvv....vvvvvv#"
    - "##################"
  inicio_grupo: [[7, 11], [8, 11], [9, 11], [10, 11]]

tablero:
  id: puerta-de-la-torre
  localidad: torre-siete
  mapa:
    - "##################"
    - "#^^^^........^^^^#"
    - "#..T....c.....T..#"
    - "#................#"
    - "######o####o######"
    - "#................#"
    - "#..c....b....c...#"
    - "#.......~~.......#"
    - "#..b.........b...#"
    - "#................#"
    - "#.....c.....c....#"
    - "##################"
  inicio_grupo: [[6, 3], [7, 3], [10, 3], [11, 3]]

tablero:
  id: cripta-de-la-torre-cuatro
  localidad: torre-cuatro
  mapa:
    - "################"
    - "#....#.....#...#"
    - "#.k..D.....D...#"
    - "#....#.....#...#"
    - "##o###..c..###o#"
    - "#..............#"
    - "#...C......C...#"
    - "#..............#"
    - "######.##.######"
    - "#..............#"
    - "#..............#"
    - "################"
  inicio_grupo: [[6, 10], [7, 10], [8, 10], [9, 10]]

tablero:
  id: estantes-del-archivo
  localidad: archivo-hundido
  mapa:
    - "##################"
    - "#C.C.C.#...C.C.C.#"
    - "#......D.........#"
    - "#C.C.C.#...C.C.C.#"
    - "#......#.........#"
    - "####D#####D#######"
    - "#ww....ww....ww..#"
    - "#wwc..www..c.www.#"
    - "#ww....ww....ww..#"
    - "#.....wwww.......#"
    - "#..k.......ww....#"
    - "##################"
  inicio_grupo: [[1, 2], [2, 2], [1, 4], [2, 4]]

encuentro:
  id: enc-lobos-repetidos
  nombre: El claro de los lobos repetidos
  tablero: claro-de-los-lobos
  acto: 1
  enemigos:
    - { bicho: lobo-repetido, cuantos: 3, en: [[13, 3], [13, 5], [12, 7]] }
  meta: Acabar con los lobos repetidos
  nota: "Tres lobos que parpadean junto al barranco. Empujarlos abajo vale tanto como herirlos."

encuentro:
  id: enc-la-loba
  nombre: La loba que se repite
  tablero: claro-de-los-lobos
  acto: 2
  enemigos:
    - { bicho: la-loba, cuantos: 1, en: [[13, 4]] }
    - { bicho: lobo-repetido, cuantos: 2, en: [[12, 2], [12, 8]] }
  objetivo: { tipo: eliminate, bicho: la-loba }
  meta: Acabar con la loba de la que salen las copias
  nota: "La loba vieja de la barra rota. Mientras ella siga en pie, salen lobos nuevos del bosque."

encuentro:
  id: enc-copias
  nombre: Las copias sin cara
  tablero: veredas-repetidas
  acto: 1
  enemigos:
    - { bicho: copia-sin-cara, cuantos: 3, en: [[13, 2], [12, 4], [14, 6]] }
  meta: Deshacer las copias
  nota: "Tres figuras con ropa de huésped y la cara lisa, entre árboles que se repiten."

encuentro:
  id: enc-cuervos
  nombre: Los cuervos del huerto
  tablero: huerto-de-la-ermita
  acto: 1
  enemigos:
    - { bicho: cuervo-de-cifras, cuantos: 4, en: [[12, 1], [13, 3], [9, 5], [14, 7]] }
  meta: Espantar a los cuervos de cifras
  nota: "Cuervos que arrancan números de las barras de los enfermos que toman el sol."

encuentro:
  id: enc-registro
  nombre: La sala del registro
  tablero: sala-del-registro
  acto: 2
  enemigos:
    - { bicho: celador, cuantos: 3, en: [[8, 6], [12, 2], [15, 1]] }
  objetivo: { tipo: reach_cell, casilla: [2, 10] }
  meta: Sacar el libro y salir por la ventana
  nota: "De noche, en la Contaduría: se entra por la cocina, el libro está en el archivo de arriba a la izquierda y la ventana de la cocina da al callejón."

encuentro:
  id: enc-redada
  nombre: La redada de la Acogida
  tablero: patio-de-la-acogida
  acto: 2
  enemigos:
    - { bicho: teniente, cuantos: 1, en: [[8, 10]] }
    - { bicho: celador, cuantos: 2, en: [[4, 9], [13, 9]] }
    - { bicho: ballestero, cuantos: 1, en: [[9, 9]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar hasta que los huéspedes salgan por detrás
  nota: "Los celadores vienen a por la lista de Jonás, la de los huéspedes que deben a Cifra. Hay que aguantar en el patio cuatro rondas."

encuentro:
  id: enc-fielato-noche
  nombre: El fielato de noche
  tablero: el-fielato
  acto: 2
  enemigos:
    - { bicho: celador, cuantos: 2, en: [[10, 6], [14, 4]] }
    - { bicho: ballestero, cuantos: 1, en: [[13, 2]] }
  objetivo: { tipo: reach_cell, casilla: [18, 7] }
  meta: Llegar al otro lado del fielato
  nota: "El turno de madrugada no deja pasar a los apagados. Hay que llegar a la salida del camino, junto al barranco."

encuentro:
  id: enc-cobro-camino
  nombre: El cobro del camino
  tablero: el-fielato
  acto: 1
  enemigos:
    - { bicho: bandido, cuantos: 3, en: [[9, 5], [11, 4], [12, 7]] }
    - { bicho: cobrador, cuantos: 1, en: [[14, 8]] }
  meta: Echar a los falsos cobradores
  nota: "Cuatro con barras pintadas que cobran en nombre de la Contaduría. El barranco está detrás de ellos."

encuentro:
  id: enc-molino
  nombre: La puerta del molino
  tablero: molino-de-severino
  acto: 2
  enemigos:
    - { bicho: cobrador, cuantos: 2, en: [[10, 3], [11, 8]] }
    - { bicho: celador, cuantos: 1, en: [[9, 10]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar en el molino
  nota: "Los cobradores de verdad vienen a por el hijo de Severino. Detrás de ellos corre el agua honda del caz."

encuentro:
  id: enc-ahogados
  nombre: Los ahogados del espejo
  tablero: orilla-del-lago
  acto: 2
  enemigos:
    - { bicho: ahogado, cuantos: 4, en: [[2, 4], [6, 4], [9, 4], [14, 4]] }
  meta: Devolver los reflejos al agua
  nota: "Reflejos mojados que salen de la orilla. El agua honda está a su espalda."

encuentro:
  id: enc-torre-tres
  nombre: Los cristales de la Torre Tres
  tablero: ruinas-de-la-torre-tres
  acto: 3
  enemigos:
    - { bicho: cristal, cuantos: 2, en: [[17, 3], [17, 9]] }
    - { bicho: escribano, cuantos: 2, en: [[15, 5], [15, 7]] }
    - { bicho: guardian, cuantos: 1, en: [[12, 3]] }
  objetivo: { tipo: eliminate, bicho: cristal }
  meta: Romper los dos cristales antes de que acaben la copia
  nota: "Dos escribanos copian el corazón de la torre caída en dos cristales. El guardián de piedra despierta al borde del foso."

encuentro:
  id: enc-escalera
  nombre: La escalera de la Torre Siete
  tablero: escalera-de-la-torre
  acto: 4
  enemigos:
    - { bicho: celador, cuantos: 2, en: [[4, 9], [11, 9]] }
    - { bicho: ballestero, cuantos: 1, en: [[8, 10]] }
    - { bicho: huesped-mercenario, cuantos: 1, en: [[7, 10]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar en el rellano mientras la Acogida sube
  nota: "Hay que sostener el rellano cuatro rondas: arriba, los peldaños dan ventaja."

encuentro:
  id: enc-cumbre
  nombre: La cumbre de la Torre Siete
  tablero: cumbre-de-la-torre
  acto: 4
  enemigos:
    - { bicho: contador-mayor, cuantos: 1, en: [[8, 5]] }
    - { bicho: escribano, cuantos: 2, en: [[3, 6], [14, 6]] }
    - { bicho: cristal, cuantos: 2, en: [[5, 3], [12, 3]] }
    - { bicho: huesped-mercenario, cuantos: 1, en: [[8, 9]] }
  objetivo: { tipo: eliminate, bicho: contador-mayor }
  meta: Detener al Contador Mayor
  nota: "El final, para nivel 4. La cumbre no tiene barandilla: lo que cae, no vuelve a subir."

encuentro:
  id: enc-puerta
  nombre: La puerta de la Torre Siete
  tablero: puerta-de-la-torre
  acto: 4
  enemigos:
    - { bicho: acogido, cuantos: 6, en: [[3, 9], [7, 9], [11, 9], [14, 9], [4, 10], [8, 10]] }
  objetivo: { tipo: survive_rounds, rondas: 6 }
  meta: Aguantar en la puerta de la torre
  nota: "La Acogida sube a por la torre. Son gente que conoces."

encuentro:
  id: enc-torre-cuatro
  nombre: La cripta de la Torre Cuatro
  tablero: cripta-de-la-torre-cuatro
  acto: 3
  enemigos:
    - { bicho: sombra, cuantos: 2, en: [[7, 2], [13, 2]] }
    - { bicho: copia-sin-cara, cuantos: 1, en: [[8, 6]] }
  meta: Sacar el cuaderno de la Primera Cuidadora
  nota: "El cofre está en la sala de arriba a la izquierda. Las losas del pasillo cuentan los pasos."

encuentro:
  id: enc-archivo
  nombre: Los estantes del Archivo
  tablero: estantes-del-archivo
  acto: 3
  enemigos:
    - { bicho: sombra, cuantos: 3, en: [[6, 7], [12, 8], [14, 10]] }
  meta: Recuperar el medallón del cofre
  nota: "Niveles que no encontraron dueño se mueven entre los estantes inundados."

## Los encargos

Quince, en tres cadenas y siete sueltos. Seis se resuelven sin pelear. Cada pelea de un encargo tiene su tablero.

### La cadena de Los Molinos (Severino Muela)

encargo:
  id: e-molinos-1
  titulo: Las cuentas del molino
  verbo: investigar
  cadena: { id: c-molinos, parte: 1, de: 3 }
  lo_pide: severino
  faccion: { id: contaduria, en_contra: true }
  donde: molinos
  acto: 1
  sin_pelear: true
  recompensa: "12 monedas y un saco de harina"
  giro: "La deuda no ha crecido sola: el cobrador suma cada semana un interés que no está en ningún papel."

encargo:
  id: e-molinos-2
  titulo: El cobro del camino
  verbo: proteger
  cadena: { id: c-molinos, parte: 2, de: 3 }
  lo_pide: severino
  acto: 1
  recompensa: "25 monedas"
  giro: "Los que paran a Severino en el camino del fielato no son cobradores: llevan la barra pintada y se quedan el dinero."
  encuentro: enc-cobro-camino

encargo:
  id: e-molinos-3
  titulo: La puerta del molino
  verbo: defender
  cadena: { id: c-molinos, parte: 3, de: 3 }
  lo_pide: severino
  faccion: { id: contaduria, en_contra: true }
  acto: 2
  recompensa: "40 monedas y una hoz de molinero"
  giro: "Los cobradores de verdad vienen a por el hijo de Severino: si no se paga, se lo llevan a la Torre Siete a descontarle."
  encuentro: enc-molino

### La cadena de las copias (Florián Leñador)

encargo:
  id: e-copias-1
  titulo: ¿Cuál de los dos?
  verbo: averiguar
  cadena: { id: c-copias, parte: 1, de: 2 }
  lo_pide: florian
  donde: bosque-copiado
  acto: 1
  sin_pelear: true
  recompensa: "10 monedas y leña para una semana"
  giro: "Los dos Florianes recuerdan lo mismo. Uno nació aquí; el otro salió del bosque hace un mes. Ninguno quiere ser el otro."

encargo:
  id: e-copias-2
  titulo: Las copias sin cara
  verbo: limpiar
  cadena: { id: c-copias, parte: 2, de: 2 }
  lo_pide: florian
  acto: 1
  recompensa: "20 monedas y unas botas del bosque"
  giro: "Las copias llevan la ropa de huéspedes que se perdieron en el bosque. Alguien tendrá que decírselo a la Acogida."
  encuentro: enc-copias

### La cadena de los nombres (Benita Plumas)

encargo:
  id: e-nombres-1
  titulo: Los nombres de la pared
  verbo: copiar
  cadena: { id: c-nombres, parte: 1, de: 3 }
  lo_pide: benita
  faccion: { id: acogida }
  donde: brasa
  acto: 1
  sin_pelear: true
  recompensa: "8 monedas y un bote de tinta de nombres"
  giro: "Hay nombres raspados a cuchillo, y en el suelo, un botón gris de celador."

encargo:
  id: e-nombres-2
  titulo: Cartas a la Hondonada
  verbo: entregar
  cadena: { id: c-nombres, parte: 2, de: 3 }
  lo_pide: benita
  faccion: { id: acogida }
  donde: hondonada-gris
  acto: 2
  sin_pelear: true
  recompensa: "15 monedas"
  giro: "Las cartas son para apagados que ya no reconocen su nombre: hay que leérselas en voz alta, una a una."

encargo:
  id: e-nombres-3
  titulo: Las copias del archivero
  verbo: recuperar
  cadena: { id: c-nombres, parte: 3, de: 3 }
  lo_pide: benita
  acto: 3
  recompensa: "30 monedas"
  giro: "El archivero lleva treinta años copiando los nombres que la torre se come. En su cofre está el medallón de la hija del Contador Mayor."
  encuentro: enc-archivo

### Los sueltos

encargo:
  id: e-cuervos
  titulo: Los cuervos del huerto
  verbo: espantar
  lo_pide: olvido
  faccion: { id: cuidadoras }
  acto: 1
  recompensa: "15 monedas y tres pociones de la Ermita"
  giro: "Los cuervos no roban grano: arrancan los números de las barras de los enfermos que toman el sol."
  encuentro: enc-cuervos

encargo:
  id: e-fielato
  titulo: Pasar el fielato
  verbo: escoltar
  lo_pide: ceniza
  faccion: { id: contaduria, en_contra: true }
  acto: 2
  recompensa: "0 monedas: la Abuela no tiene dinero. Una manta azul y su bendición"
  giro: "Los apagados quieren ver en Cifra a quien les quitó los niveles. El sargento de noche deja pasar por una moneda; el de la madrugada, no."
  encuentro: enc-fielato-noche

encargo:
  id: e-redada
  titulo: La redada
  verbo: defender
  lo_pide: jonas
  faccion: { id: acogida }
  acto: 2
  recompensa: "30 monedas de la caja de la Acogida"
  giro: "Los celadores no vienen a por deudores: vienen a por la lista de Jonás, la de los treinta y un huéspedes que deben a Cifra. Sin ella, nadie sabe a quién ayudar."
  encuentro: enc-redada

encargo:
  id: e-red-de-nuria
  titulo: La red de Nuria
  verbo: recuperar
  lo_pide: nuria
  donde: lago-espejo
  acto: 2
  sin_pelear: true
  recompensa: "20 monedas y pescado para una semana"
  giro: "No se la robaron: la red se quedó enganchada en el muelle viejo de los Molinos, y el molinero la usa para tapar la rueda."

encargo:
  id: e-ahogados
  titulo: Los ahogados del espejo
  verbo: limpiar
  lo_pide: nuria
  acto: 2
  recompensa: "30 monedas y un arpón del lago"
  giro: "Los ahogados son los reflejos de los que se miraron demasiado tiempo en el lago buscando su nivel de verdad."
  encuentro: enc-ahogados

encargo:
  id: e-tasacion
  titulo: La tasación honrada
  verbo: tasar
  lo_pide: pelayo
  faccion: { id: contaduria, en_contra: true }
  donde: cifra
  acto: 3
  sin_pelear: true
  recompensa: "25 monedas y unas gafas de tasador"
  giro: "Pelayo quiere volver a tasar a los apagados para demostrar que no valen cero. La escribana tiene que sellarlo, y no quiere."

encargo:
  id: e-torre-cuatro
  titulo: La cripta de la Torre Cuatro
  verbo: recuperar
  lo_pide: sabina
  faccion: { id: cuidadoras }
  acto: 3
  recompensa: "40 monedas"
  giro: "Debajo de la Torre Cuatro está el cuaderno de la Primera Cuidadora: cómo hacer que una torre cuente solo la vida."
  encuentro: enc-torre-cuatro
