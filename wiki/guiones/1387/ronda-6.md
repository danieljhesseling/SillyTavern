Habilidades Mundanas (Nuevas)
(Sin magia, pura pelea de taberna y trinchera)

lanzar_tierra: Acción. A voluntad. Alcance 5 pies (enemigo). Tiras fango o nieve a los ojos. El objetivo sufre Blinded durante 1 ronda.

grito_de_filas: Acción adicional. Recarga con descanso corto. Alcance 30 pies (aliados). El sargento pega un grito y hasta 2 aliados pueden moverse 10 pies inmediatamente sin provocar ataques de oportunidad.

romper_rodilla: Acción. Recarga con descanso corto. Alcance 5 pies (enemigo). Daño contundente y el objetivo queda Prone (Derribado).

trampa_de_cuerda: Acción. 1 uso por combate. Alcance 5 pies (suelo). Deja una trampa invisible. El primero que pise sufre Restrained hasta que use una acción para soltarse.

El Bestiario de la Nieve (16 perfiles)
YAML
bicho:
  id: campesino-desesperado
  nombre: Campesino desesperado
  pg: 8
  ca: 10
  desafio: 0.125
  perfil: coward
  alcance: 5
  habilidades: [hab-empujon]
  jefe: false
  descripcion: "Ojos hundidos, empuña una horca oxidada y tiembla de frío."
  debilidad: "Huyen en cuanto ven a uno de los suyos caer o si los intiman de verdad."

bicho:
  id: furtivo-veterano
  nombre: Furtivo de los Lobos
  pg: 16
  ca: 13
  desafio: 0.5
  perfil: skirmisher
  alcance: 30
  habilidades: [hab-esfumarse, trampa_de_cuerda]
  jefe: false
  descripcion: "Lleva pieles sobre cuero endurecido. Dispara y retrocede hacia los árboles."
  debilidad: "Dependen del terreno difícil; en campo abierto o cuerpo a cuerpo caen rápido."

bicho:
  id: mercenario-amotinado
  nombre: Perro del Cuervo
  pg: 22
  ca: 14
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate, lanzar_tierra]
  jefe: false
  descripcion: "Ex-compañero tuyo con cota de mallas abollada y mirada inyectada en sangre."
  debilidad: "Atacan al que más daño hace, descuidando su propia defensa."

bicho:
  id: garth-el-sanguinario
  nombre: Garth el Sanguinario
  pg: 35
  ca: 15
  desafio: 2
  perfil: aggressive
  alcance: 5
  habilidades: [hab-furia, romper_rodilla]
  jefe: false
  descripcion: "El sargento que lideró el motín. Le falta media oreja y lleva un hacha de dos manos afiladísima."
  debilidad: "Si fallas su ataque principal por esquivar, pierde el equilibrio."

bicho:
  id: guardia-desnutrido
  nombre: Guardia de Montesclaros
  pg: 12
  ca: 12
  desafio: 0.25
  perfil: guardian
  alcance: 10
  habilidades: [hab-cubrirse]
  jefe: false
  descripcion: "Lleva los colores de Vane, pero la armadura le viene grande porque ha perdido peso."
  debilidad: "Luchan en bloque. Si separas la formación, entran en pánico."

bicho:
  id: alabardero-vane
  nombre: Alabardero del Castillo
  pg: 26
  ca: 15
  desafio: 1
  perfil: guardian
  alcance: 10
  habilidades: [hab-empujon]
  jefe: false
  descripcion: "Veteranos leales que cobran de la reserva privada de Vane. Disciplinados y letales."
  debilidad: "Lentos de maniobra. Flanquearlos anula su ventaja de alcance."

bicho:
  id: recluta-keller
  nombre: Infantería de Keller
  pg: 18
  ca: 14
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate]
  jefe: false
  descripcion: "Jóvenes del norte, fanatizados y envueltos en tabardos negros."
  debilidad: "Avanzan en línea recta sin importar las trampas o el barro."

bicho:
  id: infanteria-pesada-keller
  nombre: Rompehielos de Keller
  pg: 40
  ca: 16
  desafio: 2
  perfil: guardian
  alcance: 5
  habilidades: [hab-empujon, grito_de_filas]
  jefe: false
  descripcion: "Acero de la cabeza a los pies. Cada paso que dan hace temblar la nieve."
  debilidad: "Vulnerables a ser empujados contra el barro o el agua; su armadura pesa demasiado."

bicho:
  id: el-espia-de-keller
  nombre: '"Sombra" (Hermano de Elara)'
  pg: 30
  ca: 15
  desafio: 2
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-ataque-furtivo, hab-esfumarse, lanzar_tierra]
  jefe: false
  descripcion: "Viste de blanco grisáceo para fundirse con la nieve. Usa dagas untadas en estiércol."
  debilidad: "Su tos lo delata si intentas usar Percepción mientras está escondido."

bicho:
  id: lobo-hambriento
  nombre: Lobo famélico
  pg: 11
  ca: 13
  desafio: 0.25
  perfil: aggressive
  alcance: 5
  habilidades: [hab-rastrear]
  jefe: false
  descripcion: "Pellejo y huesos. Desesperados por la carne fresca."
  debilidad: "El fuego. Una antorcha los mantiene a raya mejor que una espada."

bicho:
  id: el-boticario
  nombre: Maese Silas (El Envenenador)
  pg: 22
  ca: 11
  desafio: 1
  perfil: coward
  alcance: 20
  habilidades: [hab-primeros-auxilios] # (Y viales de ácido que cuentan como ataques a distancia)
  jefe: false
  descripcion: "Se esconde detrás de sus matones, arrojando frascos que queman los ojos."
  debilidad: "No tiene armas cuerpo a cuerpo. Si le acorralas, se rinde."

bicho:
  id: alguacil-torres
  nombre: Alguacil Torres
  pg: 45
  ca: 14
  desafio: 3
  perfil: aggressive
  alcance: 5
  habilidades: [romper_rodilla, hab-burla]
  jefe: true
  descripcion: "Jefe del Acto 1. Sudoroso, acorralado y dispuesto a matarte para ocultar que él dejó entrar al asesino."
  debilidad: "Es cobarde en el fondo. Si matas a sus guardias primero, sus ataques pierden precisión."

bicho:
  id: capitana-keller
  nombre: Capitana Elara Keller
  pg: 80
  ca: 17
  desafio: 5
  perfil: skirmisher
  alcance: 10
  habilidades: [grito_de_filas, hab-embate, hab-segundo-aliento]
  jefe: true
  descripcion: "Jefe del Acto 2. Fría como el hielo que pisa, armada con una pica de acero negro."
  debilidad: "Su orgullo. Si la provocas con Persuasión/Engaño en combate, cometerá errores para atacarte a ti."

bicho:
  id: lord-vane
  nombre: Lord Edmund Vane
  pg: 60
  ca: 16
  desafio: 5
  perfil: guardian
  alcance: 5
  habilidades: [hab-cubrirse, hab-ataque-furtivo]
  jefe: true
  descripcion: "Jefe del Acto 3. Lucha con espada ropera y daga de parada. Tose sangre pero pelea con la gracia de un duelista desesperado."
  debilidad: "Su enfermedad. Cada tres rondas sufre un ataque de tos que le impide usar reacciones."
Los Tableros (10 Mapas, máximo 2 usos por mapa)
(.: Suelo | #: Muro | D: Puerta cerrada | o: Puerta abierta | ~: Barro/Nieve honda | c: Cobertura media | C: Cobertura total/alta)

YAML
tablero:
  id: habitacion-de-la-posada
  nombre: Cuarto de la Posada
  localidad: el-pueblo-de-barro
  mapa:
    - "########D#######"
    - "#c....c....C...#"
    - "#..............#"
    - "#..............#"
    - "#.....c........#"
    - "#......~....c..#"
    - "#C.............#"
    - "################"
  inicio_grupo: [[2,3], [3,3]]
  mecanica_pendiente: "Saltar por la ventana (casilla de muro sur) para escapar debería terminar el combate."

tablero:
  id: callejon-del-barro
  nombre: Callejón inundado
  localidad: el-pueblo-de-barro
  mapa:
    - "#################"
    - "#~c~~....~C...~.#"
    - "#~~......~~~~...#"
    - "o......c...~~...#"
    - "#...C......~c~..#"
    - "#################"
  inicio_grupo: [[1,3], [2,3], [1,4]]
  mecanica_pendiente: "El lodo (`~`) mancha las armas, reduciendo alcance si caes en él."

tablero:
  id: emboscada-en-el-bosque
  nombre: Claros del Camino Viejo
  localidad: el-camino-viejo
  mapa:
    - "..##~~~~......C.#"
    - "..#..~c~...~..###"
    - "......~....~c.###"
    - "c~...C.......~..."
    - ".~~.....c....~c~."
    - ".C..~~~~.......#."
    - ".#..~~~~~c..C..#."
    - "###.........~..#."
  inicio_grupo: [[1,4], [2,4], [1,5], [2,5]]
  mecanica_pendiente: "Incendiar los árboles con coberturas `C` para obligar a los enemigos a salir."

tablero:
  id: los-campos-yermos
  nombre: La Granja Quemada
  localidad: la-granja-quemada
  mapa:
    - "...................."
    - "...~~~c......c~~~..."
    - "..~~C~~......~~C~~.."
    - "..~~~..........~~~.."
    - ".......c....c......."
    - ".......#D##D#......."
    - ".......#....#......."
    - ".......######......."
  inicio_grupo: [[9,6], [10,6], [11,6]]
  mecanica_pendiente: "Las puertas de la granja `D` pueden recibir daño y romperse."

tablero:
  id: el-hielo-quebradisimo
  nombre: El Lago Helado
  localidad: el-lago-helado
  mapa:
    - "......~~~~~~~~......"
    - "...~~~........~~~..."
    - "..~~..c......c..~~.."
    - ".~~..............~~."
    - ".~....C..~~..C....~."
    - ".~~.....~~~~.....~~."
    - "..~~~..~~~~~~..~~~.."
    - ".....~~~~~~~~~~....."
  inicio_grupo: [[2,4], [3,4], [2,5]]
  mecanica_pendiente: "Si hay 3 o más personajes juntos en casillas contiguas, el hielo cede."

tablero:
  id: galeria-de-contrabando
  nombre: Túneles de la Mina
  localidad: la-mina-abandonada
  mapa:
    - "################"
    - "#..C..~~....c..#"
    - "#.....~C.......o"
    - "#...c.~~C...C..#"
    - "#C....~~....c..#"
    - "################"
  inicio_grupo: [[1,3], [1,4], [2,3]]
  mecanica_pendiente: "Los muros de carbón pueden explotar si alguien falla un ataque con fuego."

tablero:
  id: barricadas-del-norte
  nombre: Empalizadas del Peaje
  localidad: el-peaje-norte
  mapa:
    - "...c....~C~....c..."
    - "C...~..~~C~~..~...C"
    - "#C...~~..c..~~...C#"
    - "##C.............C##"
    - "###D###########D###"
    - "#.................#"
    - "#..c.....C.....c..#"
    - "###################"
  inicio_grupo: [[9,6], [10,6], [8,6]]
  mecanica_pendiente: "Los defensores tras la empalizada `C` tienen ventaja en ataque a distancia."

tablero:
  id: el-barrizal-final
  nombre: El Cruce Inundado
  localidad: el-cruce-de-caminos
  mapa:
    - "~~~~~~....c..~~~~~~"
    - "~~~~........c.~~~~~"
    - "~~~...C..~......~~~"
    - "......~~.~~........"
    - ".......~~~C........"
    - "~~~....c~~......~~~"
    - "~~~~........C.~~~~~"
    - "~~~~~~....c..~~~~~~"
  inicio_grupo: [[9,3], [10,3], [9,4], [10,4]]
  mecanica_pendiente: "Cargar cruzando el centro lodoso `~~~` te deja apresado un turno."

tablero:
  id: tienda-de-mando-keller
  nombre: Campamento Keller (Interior)
  localidad: campamento-keller
  mapa:
    - "#################"
    - "#C..c.......c..C#"
    - "#...............#"
    - "#...c..C C..c...#"
    - "#...............#"
    - "##o###########o##"
    - "..~...........~.."
    - "..~~.........~~.."
  inicio_grupo: [[7,6], [8,6], [9,6]]
  mecanica_pendiente: "Si rompes las columnas de la tienda `C`, la lona cae y ciega a todos en área."

tablero:
  id: las-puertas-del-castillo
  nombre: Escalinata de Vane
  localidad: castillo-de-vane
  mapa:
    - "####################"
    - "#C.c............c.C#"
    - "##.......C C......##"
    - "###~~~~.......~~~~##"
    - "o##~~~~..c c..~~~~##"
    - "........~~~~~......."
    - "c...C...~~~~~...C..c"
    - "........~~~~~......."
  inicio_grupo: [[9,7], [10,7], [11,7]]
  mecanica_pendiente: "Pelear en escalones da ventaja por altura."
Los Encuentros (15 batallas de trinchera)
(Recuento de tableros usados: habitacion: 1, callejon: 2, emboscada: 2, granja: 2, lago: 2, mina: 2, barricadas: 1, cruce: 1, keller: 1, castillo: 1. ¡Regla cumplida!)

YAML
encuentro:
  id: enc-huida-posada
  tablero: habitacion-de-la-posada
  enemigos: 
    - { bicho: guardia-desnutrido, cuantos: 2, en: [[1,1],[2,1]] }
    - { bicho: alguacil-torres, cuantos: 1, en: [[14,1]] }
  objetivo: { tipo: reach_cell, casilla: [14,7] }
  nota: "Acto 1. Tienes el cáliz, solo tienes que llegar a la ventana y huir de Torres, no matarlo hoy."

encuentro:
  id: enc-emboscada-bosque
  tablero: emboscada-en-el-bosque
  enemigos: 
    - { bicho: furtivo-veterano, cuantos: 2, en: [[2,2],[14,2]] }
    - { bicho: campesino-desesperado, cuantos: 3, en: [[6,5],[8,5],[10,5]] }
  objetivo: { tipo: eliminate_all }
  nota: "Acto 1. El primer choque con los Lobos del Bosque."

encuentro:
  id: enc-los-falsos-desertores
  tablero: los-campos-yermos
  enemigos: 
    - { bicho: campesino-desesperado, cuantos: 4, en: [[8,3],[9,3],[10,3],[11,3]] }
  objetivo: { tipo: eliminate_all }
  nota: "Acto 1 (Encargo). Son granjeros defendiendo leña. Si matas a 2, el resto huye y ganas."

encuentro:
  id: enc-emboscada-por-el-hierro
  tablero: galeria-de-contrabando
  enemigos: 
    - { bicho: furtivo-veterano, cuantos: 2, en: [[2,1],[13,1]] }
    - { bicho: lobo-hambriento, cuantos: 2, en: [[6,3],[9,3]] }
  objetivo: { tipo: loot, casilla: [8,1] }
  nota: "Acto 1 (Encargo). Tienes que llegar a la caja de lingotes, cogerla y salir vivo."

encuentro:
  id: enc-pelea-callejon
  tablero: callejon-del-barro
  enemigos: 
    - { bicho: mercenario-amotinado, cuantos: 2, en: [[12,2],[14,4]] }
    - { bicho: garth-el-sanguinario, cuantos: 1, en: [[12,3]] }
  objetivo: { tipo: eliminate, bicho: garth-el-sanguinario }
  nota: "Acto 2 (Encargo/Libre). Garth te acorrala para cobrar deudas viejas."

encuentro:
  id: enc-asedio-a-la-granja
  tablero: los-campos-yermos
  enemigos: 
    - { bicho: recluta-keller, cuantos: 4, en: [[3,1],[8,1],[12,1],[16,1]] }
    - { bicho: infanteria-pesada-keller, cuantos: 1, en: [[10,2]] }
  objetivo: { tipo: survive_rounds, rondas: 5 }
  nota: "Acto 2 (Encargo). Tienes que aguantar dentro de la granja (abajo) hasta que se queden sin antorchas y huyan."

encuentro:
  id: enc-escolta-quebradiza
  tablero: el-hielo-quebradisimo
  enemigos: 
    - { bicho: lobo-hambriento, cuantos: 5, en: [[2,1],[6,2],[12,2],[16,1],[10,1]] }
  objetivo: { tipo: escort, pnj: el-monje-cirujano, a: [10,7] }
  nota: "Acto 2 (Encargo). Los lobos rodean al monje. Él no sabe pelear, solo avanza si le abres hueco."

encuentro:
  id: enc-patrullas-en-la-nieve
  tablero: barricadas-del-norte
  enemigos: 
    - { bicho: furtivo-veterano, cuantos: 3, en: [[2,3],[9,3],[16,3]] }
  objetivo: { tipo: eliminate_all }
  nota: "Acto 2 (Encargo). Limpiar las empalizadas desde fuera hacia dentro."

encuentro:
  id: enc-carreta-en-el-hielo
  tablero: el-hielo-quebradisimo
  enemigos: 
    - { bicho: mercenario-amotinado, cuantos: 3, en: [[5,4],[10,4],[15,4]] }
  objetivo: { tipo: loot, casilla: [10,4] }
  nota: "Acto 2 (Encargo). Hay que coger las hierbas congeladas del centro del lago antes de que los mercenarios te tiren al agua helada."

encuentro:
  id: enc-espia-mina
  tablero: galeria-de-contrabando
  enemigos: 
    - { bicho: el-espia-de-keller, cuantos: 1, en: [[8,1]] }
    - { bicho: mercenario-amotinado, cuantos: 2, en: [[4,2],[12,2]] }
  objetivo: { tipo: eliminate, bicho: el-espia-de-keller }
  nota: "Acto 2 (Hilo). Sombra intenta huir. Si él muere, sus matones escapan."

encuentro:
  id: enc-asalto-peaje
  tablero: barricadas-del-norte
  enemigos: 
    - { bicho: recluta-keller, cuantos: 3, en: [[4,2],[10,2],[14,2]] }
    - { bicho: infanteria-pesada-keller, cuantos: 2, en: [[8,4],[12,4]] }
  objetivo: { tipo: eliminate_all }
  nota: "Acto 2 (Hilo). El contraataque desesperado de la Casa Montesclaros para recuperar el norte."

encuentro:
  id: enc-frenar-la-carreta
  tablero: el-barrizal-final
  enemigos: 
    - { bicho: furtivo-veterano, cuantos: 4, en: [[2,1],[6,1],[12,1],[16,1]] }
  objetivo: { tipo: survive_rounds, rondas: 6 } # (En 1387 adaptamos destruir la carreta aguantando la posición frente a los 4 portadores de pólvora durante 6 rondas)
  nota: "Acto 3 (Encargo). Los furtivos intentan cruzar. Mantenlos a raya en el fango 6 rondas."

encuentro:
  id: enc-asalto-keller
  tablero: tienda-de-mando-keller
  enemigos: 
    - { bicho: capitana-keller, cuantos: 1, en: [[8,2]] }
    - { bicho: infanteria-pesada-keller, cuantos: 2, en: [[4,4],[12,4]] }
  objetivo: { tipo: eliminate, bicho: capitana-keller }
  nota: "Acto 3 (Hilo - Final B/C). Sangre en la tienda de mando. La Capitana y su escolta pesada contra ti."

encuentro:
  id: enc-defensa-vane
  tablero: las-puertas-del-castillo
  enemigos: 
    - { bicho: lord-vane, cuantos: 1, en: [[10,2]] }
    - { bicho: alabardero-vane, cuantos: 4, en: [[6,4],[8,4],[12,4],[14,4]] }
  objetivo: { tipo: eliminate, bicho: lord-vane }
  nota: "Acto 3 (Hilo - Final A/C). Atacas las puertas del castillo. El viejo tose, pero sus alabarderos formarán un muro infranqueable a menos que los rompas."

encuentro:
  id: enc-emboscada-lobos-alfa
  tablero: callejon-del-barro
  enemigos: 
    - { bicho: lobo-alfa, cuantos: 2, en: [[1,1],[15,1]] }
    - { bicho: lobo-hambriento, cuantos: 3, en: [[4,2],[8,2],[12,2]] }
  objetivo: { tipo: protect, pnj: el-tabernero-giles }
  nota: "Acto 3 (Libre). El invierno aprieta tanto que las bestias entran en el pueblo por comida fresca. Defiende a Giles en el callejón."

LOS TABLEROS LOS PUEDES MEJORAR LIBREMENT ;) 