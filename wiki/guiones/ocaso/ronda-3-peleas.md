# Las tierras del ocaso — ronda 3: el bestiario, los objetos y las peleas

Dieciséis peleas en catorce tableros, pensadas para un grupo de cuatro (D-J56), cada una con su nivel recomendado. El nivel no sube por los hitos (D-J59): sale de pelear, de los encargos y de las misiones de los compañeros. La Atalaya, al final, es para nivel 5 y es dura.

Lo que pide cada pelea no es siempre «matar a todos» (E1.1):

- **Defender**: el carro del notario en el puente (4 rondas), la puerta grande de las Forjas (5 rondas), el refugio de noche (4 rondas).
- **Romper**: los dos tótems de hielo del chamán trasgo, antes de que tire la ladera.
- **Robar y salir**: el libro de pagos de la cámara de Fullero, y fuera por la puerta del canal.
- **Escapar**: del campamento del Cierzo, por la brecha del arroyo (con el mapa de las Sendas, si se puede).
- **Llegar**: al fanal de la Atalaya, con el capitán del Cierzo derrotado.

Y empujar importa (E1.2): los lados abiertos del puente, el barranco de la calzada, el foso vacío de la esclusa, el pozo de la mina, la cornisa de las grullas y los bordes del patio de la Atalaya. Las personas se pueden convencer a mitad de pelea (`parley`); a las bestias, se las espanta.

## El bestiario

bicho:
  id: mercenario
  nombre: Mercenario del Cierzo
  pg: 16
  ca: 14
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate]
  descripcion: Capa gris, cota de malla y una espada corta. Cobra de quien pague.
  debilidad: Si cae su cabo, la mitad se lo piensa.
  paquete:
    aspecto: "Hombre de unos treinta, con barba corta y la cara curtida por el viento. Capa gris con capucha, cota de malla y una espada corta al cinto."

bicho:
  id: ballestero
  nombre: Ballestero del Cierzo
  pg: 13
  ca: 13
  desafio: 0.5
  perfil: skirmisher
  alcance: 80
  habilidades: [hab-disparo-certero]
  descripcion: Una ballesta pesada y un pavés a la espalda. De lejos no falla; de cerca, no sabe qué hacer.

bicho:
  id: cabo
  nombre: Cabo del Cierzo
  pg: 27
  ca: 15
  desafio: 1
  perfil: guardian
  alcance: 5
  habilidades: [tec-cerrar-filas, hab-gritar]
  descripcion: Un veterano con un silbato de hueso. Los suyos le obedecen mientras pague.
  paquete:
    aspecto: "Hombre de unos cincuenta, canoso y de bigote espeso, con un silbato de hueso colgado al cuello. Capa gris sobre cota de malla y una insignia de latón en el hombro."

bicho:
  id: tamborilero
  nombre: Tamborilero del Cierzo
  pg: 9
  ca: 12
  desafio: 0.25
  perfil: coward
  alcance: 5
  habilidades: [tec-cancion-marcha]
  descripcion: Un chaval con un tambor. Mientras suena, los del Cierzo pelean con más ganas.

bicho:
  id: tuerta
  nombre: La Tuerta, sargento del Cierzo
  pg: 45
  ca: 15
  desafio: 2
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-ataque-furtivo, tec-barrido, hab-esfumarse]
  jefe: true
  descripcion: Un parche de cuero en el ojo izquierdo y dos cuchillos largos. Lleva al cinto el mapa de las Sendas Viejas.
  debilidad: Odia a su capitán. Si se lo recuerdas, duda.
  paquete:
    aspecto: "Mujer de unos cuarenta, flaca y dura, con el pelo negro rapado a los lados y un parche de cuero en el ojo izquierdo. Capa gris, coraza de cuero y dos cuchillos largos al cinto."

bicho:
  id: capitan
  nombre: El capitán del Cierzo
  pg: 90
  ca: 17
  desafio: 5
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate, tec-embestida, hab-segundo-aliento, hab-gritar]
  jefe: true
  descripcion: Armadura negra, capa gris y una espada de mano y media. Pelea como habla, con elegancia y sin prisa.
  paquete:
    aspecto: "Hombre de unos cuarenta y cinco, alto y elegante, con el pelo negro peinado hacia atrás y una barba fina. Armadura negra, capa gris larga y una espada de mano y media."

bicho:
  id: guardian
  nombre: Guardián de hierro
  pg: 68
  ca: 17
  desafio: 3
  perfil: guardian
  alcance: 5
  habilidades: [tec-embestida, tec-pisoton, hab-empujon]
  jefe: true
  descripcion: Una armadura enana hueca, movida por runas, que guarda la puerta de la Atalaya desde hace dos siglos. Despierta si alguien entra sin el sello.
  debilidad: Lento. Quien lo esquiva lo deja atrás.

bicho:
  id: huargo
  nombre: Huargo
  pg: 22
  ca: 13
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [tec-pisoton]
  domable: perro
  descripcion: Un lobo grande como un poni, con el pelo blanco de escarcha.

bicho:
  id: loba
  nombre: Loba blanca
  pg: 45
  ca: 14
  desafio: 2
  perfil: aggressive
  alcance: 5
  habilidades: [tec-pisoton, hab-empujon]
  jefe: true
  domable: perro
  descripcion: La madre de la manada, blanca como la nieve, con una cicatriz en el hocico.

bicho:
  id: trasgo
  nombre: Trasgo de la mina
  pg: 7
  ca: 13
  desafio: 0.25
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-esfumarse, tec-polvo-ojos]
  descripcion: Pequeño, verde y rápido, con un pico de minero robado.

bicho:
  id: chaman
  nombre: Chamán trasgo
  pg: 22
  ca: 12
  desafio: 1
  perfil: coward
  alcance: 30
  habilidades: [mag-escarcha, hab-animo]
  jefe: true
  descripcion: Un trasgo viejo cubierto de pieles y huesos. Hace crecer el hielo de las paredes.
  paquete:
    aspecto: "Trasgo viejo y arrugado, de piel verde grisácea y orejas largas, con escarcha en las cejas. Cubierto de pieles y collares de huesos, con un bastón coronado por un cráneo."

bicho:
  id: totem
  nombre: Tótem de hielo
  pg: 14
  ca: 10
  desafio: 0.25
  perfil: guardian
  alcance: 5
  descripcion: Un poste de huesos y hielo que escupe escarcha a quien se acerca. Si caen los dos, el chamán no puede tirar la ladera.
  domable: ""

bicho:
  id: oso
  nombre: Oso de las Sendas
  pg: 34
  ca: 11
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [hab-empujon]
  domable: ""
  descripcion: Un oso pardo enorme, flaco antes de tiempo porque el invierno se le ha adelantado.

bicho:
  id: maton
  nombre: Matón de Fullero
  pg: 13
  ca: 12
  desafio: 0.25
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate]
  descripcion: Grande, con un garrote y sin ganas de preguntar.
  paquete:
    aspecto: "Hombre de unos treinta y cinco, grande como un armario, con la cabeza rapada y la nariz rota. Chaleco de cuero sin mangas y un garrote al hombro."

bicho:
  id: contrabandista
  nombre: Contrabandista de la esclusa
  pg: 11
  ca: 12
  desafio: 0.25
  perfil: skirmisher
  alcance: 30
  habilidades: [tec-bomba-humo]
  descripcion: Sacos de sal a la espalda y una honda en la mano.

bicho:
  id: patron
  nombre: Patrón de la esclusa
  pg: 30
  ca: 13
  desafio: 1
  perfil: guardian
  alcance: 5
  habilidades: [tec-frasco-lumbre, hab-cubrirse]
  descripcion: El jefe de los contrabandistas, con un garfio en lugar de mano izquierda.
  paquete:
    aspecto: "Hombre de unos cincuenta, fornido y tostado por el sol, con barba blanca corta y un aro de oro en la oreja. Chaquetón de barquero y un garfio de hierro en lugar de la mano izquierda."

bicho:
  id: saqueador
  nombre: Saqueador de tumbas
  pg: 11
  ca: 12
  desafio: 0.25
  perfil: coward
  alcance: 5
  habilidades: [tec-abrojos]
  descripcion: Pala, saco y ninguna vergüenza.

bicho:
  id: cabecilla
  nombre: Cabecilla de saqueadores
  pg: 27
  ca: 13
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [hab-ataque-furtivo, tec-polvo-ojos]
  descripcion: Busca el cuerno de guerra del último thane de la Atalaya, para vendérselo a quien pague más.
  paquete:
    aspecto: "Hombre de unos cuarenta, flaco y de ojos inquietos, con la barba rala y un sombrero de ala ancha. Capa de viaje embarrada y una pala de cavar a la espalda."

bicho:
  id: desertor
  nombre: Desertor de Brezo
  pg: 16
  ca: 14
  desafio: 0.5
  perfil: guardian
  alcance: 5
  habilidades: [hab-aguantar]
  descripcion: Soldado de Brezo sin paga ni bandera. Roba a los pastores para comer.
  paquete:
    aspecto: "Hombre joven, flaco y sin afeitar, con ojeras profundas. Jubón morado de Brezo desteñido y sin la insignia, y una lanza vieja."

bicho:
  id: ladron
  nombre: Ladrón de grano
  pg: 11
  ca: 12
  desafio: 0.25
  perfil: coward
  alcance: 5
  habilidades: [hab-esfumarse]
  descripcion: Un campesino de otra aldea, con un saco vacío y mucha hambre.

## Los objetos

objeto:
  id: sello
  nombre: Sello de la Grulla
  tipo: gear
  rareza: Very Rare
  historia: Un anillo de hierro enano, grueso como un dedo, con una grulla grabada. Abre la puerta de la Atalaya.
  ligado_a: m-notario

objeto:
  id: carta
  nombre: Copia de la Carta del Paso
  tipo: gear
  rareza: Rare
  historia: Una copia en limpio de la Carta del Paso, con el sello del notario del rey. La cláusula catorce está subrayada.

objeto:
  id: libro-fullero
  nombre: Libro de pagos de Fullero
  tipo: gear
  rareza: Rare
  historia: Un libro de cuentas forrado de piel negra. Cuarenta monedas al mes de Brezo, cuarenta de Oramar y treinta de Hondaroca, todas para el Cierzo.

objeto:
  id: mapa-sendas
  nombre: Mapa de las Sendas Viejas
  tipo: gear
  rareza: Rare
  historia: Una copia del mapa élfico de las Sendas Viejas, dibujada a pluma sobre piel fina. Quien la tiene sube al paso en dos días.

objeto:
  id: cuerno
  nombre: Cuerno de la Atalaya
  tipo: gear
  rareza: Very Rare
  historia: El cuerno de guerra del último thane de la Atalaya. Cuando suena, los enanos de Hondaroca lo oyen desde las Forjas.

objeto:
  id: hacha-brezo
  nombre: Hacha de leñador de Brezo
  tipo: weapon
  rareza: Uncommon
  dados: 1d12
  historia: Un hacha de mango largo con el brezo morado quemado en la madera.
  paquete: { damageType: cortante, slot: weapon, weight: 3.5 }

objeto:
  id: arco-hayas
  nombre: Arco de haya roja
  tipo: weapon
  rareza: Uncommon
  dados: 1d8
  historia: Un arco largo de madera clara, tallado por los elfos de las Hayas Rojas.
  paquete: { damageType: perforante, slot: weapon, weight: 1 }

objeto:
  id: martillo-hondaroca
  nombre: Martillo de la guardia de Hondaroca
  tipo: weapon
  rareza: Rare
  dados: 1d8
  historia: Un martillo de guerra con el yunque del clan grabado en la cabeza. Pesa menos de lo que parece.
  paquete: { damageType: contundente, slot: weapon, weight: 2 }

objeto:
  id: espada-fluvial
  nombre: Espada corta de la guardia fluvial
  tipo: weapon
  rareza: Common
  dados: 1d6
  historia: La espada de la guardia del río de Vadoancho, con un barco azul en la empuñadura.
  paquete: { damageType: perforante, slot: weapon, weight: 1 }

objeto:
  id: ballesta-cierzo
  nombre: Ballesta del Cierzo
  tipo: weapon
  rareza: Common
  dados: 1d8
  historia: Una ballesta pesada, gris y bien engrasada.
  paquete: { damageType: perforante, slot: weapon, weight: 2.5 }

objeto:
  id: cota-cierzo
  nombre: Cota de malla del Cierzo
  tipo: armor
  rareza: Uncommon
  historia: Una cota de malla de buena forja, con una capa gris cosida encima.
  paquete: { slot: armor, weight: 9 }

objeto:
  id: capa-brezo
  nombre: Capa de lana de Brezo
  tipo: armor
  rareza: Common
  historia: Lana morada de las tierras altas, gruesa como una manta. Abriga hasta en la cornisa.
  paquete: { slot: armor, weight: 1.5 }

objeto:
  id: escudo-roble
  nombre: Escudo de roble rojo
  tipo: armor
  rareza: Uncommon
  historia: Un escudo élfico de madera de roble, ligero y duro.
  paquete: { slot: shield, weight: 2.5 }

objeto:
  id: botas-nieve
  nombre: Botas de nieve enanas
  tipo: gear
  rareza: Uncommon
  historia: Botas forradas de piel con clavos en la suela. Con ellas, el hielo no resbala.

objeto:
  id: lampara
  nombre: Lámpara de minero
  tipo: gear
  rareza: Common
  historia: Una lámpara de latón con una rejilla, para que el viento de la mina no la apague.

objeto:
  id: cuerda
  nombre: Cuerda de crin
  tipo: gear
  rareza: Common
  historia: Quince varas de cuerda de crin trenzada. Aguanta a una persona y a su miedo.

objeto:
  id: ganzuas
  nombre: Ganzúas de Telmo
  tipo: gear
  rareza: Uncommon
  historia: Un manojo de ganzúas finas, cada una con una muesca distinta. Telmo jura que abren cualquier cerradura de las tres casas.

objeto:
  id: sal
  nombre: Saco de sal de roca
  tipo: gear
  rareza: Common
  historia: Sal de las minas de abajo. En el paso, en invierno, vale su peso en plata.

objeto:
  id: hierbas
  nombre: Hierbas de la ermita
  tipo: gear
  rareza: Common
  historia: Un manojo de hierbas secas de Fray Odón. En infusión, quitan el frío del cuerpo.

objeto:
  id: pagares
  nombre: Pagarés de Casa Brezo
  tipo: gear
  rareza: Rare
  historia: Las deudas de Casa Brezo, firmadas por Doña Ilduara. Quien las tiene puede reclamar la torre en primavera.

objeto:
  id: estandarte
  nombre: Estandarte viejo de la Atalaya
  tipo: gear
  rareza: Rare
  historia: La bandera de la grulla blanca sobre campo gris que ondeaba en la Atalaya hace sesenta años. Huele a humo y a polvo.

objeto:
  id: piedra-afilar
  nombre: Piedra de afilar enana
  tipo: gear
  rareza: Common
  historia: Una piedra gris, lisa como un huevo. Ottar dice que con ella se afila hasta la paciencia.

objeto:
  id: lingote
  nombre: Lingote de hierro de Hondaroca
  tipo: gear
  rareza: Uncommon
  historia: Un lingote con el yunque del clan. Cualquier herrero lo acepta como pago.

objeto:
  id: talisman
  nombre: Talismán de haya
  tipo: gear
  rareza: Uncommon
  historia: Una hoja de haya roja metida en resina. Los elfos se lo dan a quien ha ayudado a las Hayas.

## Los tableros

Las letras de los mapas: `.` suelo, `#` muro, `D` puerta, `v` precipicio (quien cae, cae), `W` agua honda, `w` agua poco honda, `~` barro, `b` maleza, `c` y `C` cobertura, `T` barril, `k` cofre, `^` en alto, `x` salida, `=` barricada, `o` puerta abierta, `i` hielo.

tablero:
  id: t-puente
  nombre: El puente de Tres Mojones
  localidad: tres-mojones
  mapa:
    - "##################"
    - "#WWWWWWvvvvvWWWWW#"
    - "#WWWWWWv...vWWWWW#"
    - "#WWWWWWv.C.vWWWWW#"
    - "#WWWWWWv...vWWWWW#"
    - "#WWWWWWv...vWWWWW#"
    - "#~~~bb.......bb~~#"
    - "#..c....T.....c..#"
    - "#.....c.....c....#"
    - "#..............cc#"
    - "##################"
  inicio_grupo: [[8,3], [10,3], [8,4], [10,4]]

tablero:
  id: t-calzada
  nombre: El tramo roto de la calzada
  localidad: la-calzada-rota
  mapa:
    - "####################"
    - "#vvvvvvvvvvvvvvvvvv#"
    - "#..v...vvv.....vv..#"
    - "#..................#"
    - "#...c......c.......#"
    - "#..................#"
    - "#bb..bbb..c...bb...#"
    - "#b.bb..b...bbb..b.b#"
    - "#..c...bb..b...c...#"
    - "#.......b......bb..#"
    - "#..C...........C...#"
    - "####################"
  inicio_grupo: [[1,3], [2,3], [1,4], [2,4]]

tablero:
  id: t-camara
  nombre: La casa de préstamos
  localidad: vadoancho
  mapa:
    - "################"
    - "#......#...#...#"
    - "#..c...D...L.k.#"
    - "#......#...#...#"
    - "###D####...#####"
    - "#......#.......#"
    - "#.T....D...c...#"
    - "#......#......x#"
    - "################"
  inicio_grupo: [[1,1], [2,1], [1,3], [2,3]]

tablero:
  id: t-puerta
  nombre: La puerta grande de las Forjas
  localidad: forjas-de-hondaroca
  mapa:
    - "##################"
    - "#......^^^^......#"
    - "#.c....^..^....c.#"
    - "#......^..^......#"
    - "####=###oo###=####"
    - "#................#"
    - "#..b..c....c..b..#"
    - "#.b.............b#"
    - "#................#"
    - "##################"
  inicio_grupo: [[8,2], [9,2], [8,3], [9,3]]

tablero:
  id: t-grajo
  nombre: La mina vieja
  localidad: boca-del-grajo
  mapa:
    - "####################"
    - "#...#......#.......#"
    - "#...D..ii..#..vv...#"
    - "#...#..ii..D..vv...#"
    - "#...#......#.......#"
    - "##.###.##.###..#####"
    - "#......#.......#...#"
    - "#.vv...#..i....D...#"
    - "#.vv...o..i....#.k.#"
    - "#......#.......#...#"
    - "####################"
  inicio_grupo: [[1,1], [2,1], [1,2], [2,2]]
  paquete:
    zones:
      - name: La galería del chamán
        rect: { x: 12, y: 1, width: 7, height: 4 }
        note: El chamán y su tótem, junto a un pozo sin barandilla.
      - name: El almacén de los trasgos
        rect: { x: 16, y: 6, width: 3, height: 4 }
        note: Lo que los trasgos han robado a los enanos.

tablero:
  id: t-campamento
  nombre: La empalizada del Cierzo
  localidad: campamento-del-cierzo
  mapa:
    - "######################"
    - "#....#..........#....#"
    - "#.C..#..C....C..#..k.#"
    - "#....D..........D....#"
    - "#....#....TT....#....#"
    - "###.###........###.###"
    - "#........c..c........#"
    - "#..C....b....b....C..#"
    - "#........c..c.......x#"
    - "#....^^^^....^^^^....#"
    - "######################"
  inicio_grupo: [[1,1], [2,1], [3,1], [1,3]]

tablero:
  id: t-cornisa
  nombre: La cornisa de las grullas
  localidad: la-atalaya
  mapa:
    - "######################"
    - "#vvvvvvvvvvvvvvvvvvvv#"
    - "#vvv.....vvvv.....vvv#"
    - "#.......c......c.....#"
    - "#..........##........#"
    - "#..^^......##....^^..#"
    - "#..^^....b....b..^^..#"
    - "#####.....###.....####"
    - "#....................#"
    - "######################"
  inicio_grupo: [[1,3], [2,3], [1,4], [2,4]]

tablero:
  id: t-atalaya
  nombre: El patio de la Atalaya
  localidad: la-atalaya
  mapa:
    - "######################"
    - "#vvvvv^^^^^^^^^^vvvvv#"
    - "#vvvvv^........^vvvvv#"
    - "#vvvvv^...^^...^vvvvv#"
    - "#vvvvv####DD####vvvvv#"
    - "#v..................v#"
    - "#v..c....T..T....c..v#"
    - "#v.....##....##.....v#"
    - "#v..C..##....##..C..v#"
    - "#v..................v#"
    - "#v......~~~~~~......v#"
    - "#v..................v#"
    - "######################"
  inicio_grupo: [[9,11], [10,11], [11,11], [12,11]]
  paquete:
    zones:
      - name: El patio helado
        rect: { x: 2, y: 5, width: 18, height: 7 }
        note: El patio de armas, con barriles de brea y la nieve pisada por cien botas.
      - name: La plataforma del fanal
        rect: { x: 7, y: 2, width: 8, height: 2 }
        note: El fanal de la Atalaya, con leña seca para tres noches.

tablero:
  id: t-molino
  nombre: El molino de Los Sauces
  localidad: los-sauces
  mapa:
    - "##################"
    - "#WWWWWWWWWWWWWWWW#"
    - "#WWWW....WWWWWWWW#"
    - "#......c.........#"
    - "#..####D####.....#"
    - "#..#.T....k#..b..#"
    - "#..#..T....#..b..#"
    - "#..###D#####.....#"
    - "#................#"
    - "##################"
  inicio_grupo: [[1,8], [2,8], [1,7], [2,7]]

tablero:
  id: t-esclusa
  nombre: La esclusa de Vadoancho
  localidad: vadoancho
  mapa:
    - "####################"
    - "#WWWWWWWWWWWWWWWWWW#"
    - "#WWW..........WWWWW#"
    - "#...=vvvvvvvv=.....#"
    - "#...vvvvvvvvvv..c..#"
    - "#..c............T..#"
    - "#...vvvvvvvvvv.....#"
    - "#...=vvvvvvvv=..C..#"
    - "#..................#"
    - "#.T....c.....T.....#"
    - "####################"
  inicio_grupo: [[1,8], [2,8], [1,9], [3,8]]

tablero:
  id: t-robledal
  nombre: El robledal de Brezo
  localidad: torre-brezo
  mapa:
    - "####################"
    - "#..b...##...bb.....#"
    - "#.bb...##....b..C..#"
    - "#..................#"
    - "#..C.......bb...#..#"
    - "#.....ww.......##..#"
    - "#..b..ww..c........#"
    - "#......w.....bb....#"
    - "#.##.......C.....b.#"
    - "#.##..b............#"
    - "#......bb.....##...#"
    - "####################"
  inicio_grupo: [[1,3], [2,3], [1,4], [2,4]]

tablero:
  id: t-sendas
  nombre: El barranco de las Sendas
  localidad: las-sendas-viejas
  mapa:
    - "##################"
    - "#...bb....vvv....#"
    - "#..b....c.vvv.b..#"
    - "#.........vv.....#"
    - "#..C.............#"
    - "#......bb....C...#"
    - "#.vv.........bb..#"
    - "#.vv....c........#"
    - "#.......b........#"
    - "##################"
  inicio_grupo: [[1,4], [2,4], [1,5], [2,5]]

tablero:
  id: t-refugio
  nombre: El corral del refugio
  localidad: refugio-de-la-cabra
  mapa:
    - "##################"
    - "#................#"
    - "#..b..........b..#"
    - "#....########....#"
    - "#....#..T...#....#"
    - "#....D......D....#"
    - "#....#..c...#....#"
    - "#....###DD###....#"
    - "#.b............b.#"
    - "##################"
  inicio_grupo: [[7,5], [8,5], [9,5], [10,5]]

tablero:
  id: t-cementerio
  nombre: El cementerio enano
  localidad: ermita-del-collado
  mapa:
    - "##################"
    - "#..C..C..C..C....#"
    - "#................#"
    - "#..C..C..C..C..b.#"
    - "#...........######"
    - "#..b....c...D..k.#"
    - "#...........######"
    - "#.C..C..C........#"
    - "#................#"
    - "##################"
  inicio_grupo: [[1,8], [2,8], [3,8], [1,7]]

## Las peleas del hilo

encuentro:
  id: enc-puente
  tablero: t-puente
  nombre: El puente caído
  acto: 1
  enemigos:
    - { bicho: mercenario, cuantos: 3, en: [[6,7], [12,7], [3,8]] }
    - { bicho: ballestero, cuantos: 1, en: [[14,9]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar junto al carro cuatro rondas, hasta que lleguen las barcas
  nota: "Acto 1. Los del Cierzo quieren el cofre del notario. El puente tiene los lados abiertos: quien cae, cae al río."
  mision:
    levels: [1, 1]
    objectives:
      - { type: survive_rounds, label: "Aguantar junto al carro cuatro rondas, hasta que lleguen las barcas", rounds: 4 }
      - { type: eliminate_all, label: Echar al río a los de capa gris, optional: true }
  paquete:
    avoid:
      - kind: hablar
        text: Gritarles que el cofre ya se ha hundido en el río
        skill: deception
        dc: 13
        success:
          who: "Mercenario del Cierzo"
          text: "¿Hundido? Si se ha hundido, que lo saque su madre. Vámonos por la orilla."
        failure:
          who: "Mercenario del Cierzo"
          text: "Pues lo sacamos nosotros, y a ti con él."
      - kind: pagar
        text: Ofrecerles veinte monedas para que se vayan sin el cofre
        gold: 20
        success:
          who: "Mercenario del Cierzo"
          text: "Por veinte nos mojamos menos. ¡Andando, que hoy cobramos sin mojarnos!"
    parley:
      leader: Mercenario del Cierzo
      convencer:
        text: Les gritas que las barcas ya vienen, con todos los hombres de la posada.
        dc: 13
        success:
          who: "Mercenario del Cierzo"
          text: "¡Las barcas! ¿Con todos los de la posada? ¡Por la orilla, corred!"
        failure:
          who: "Mercenario del Cierzo"
          text: "Mientes peor que mi suegra."
      sobornar:
        text: Les ofreces veinticinco monedas por dejar el carro en paz.
        gold: 25
        success:
          who: "Mercenario del Cierzo"
          text: "Trato. Ese cofre no pesa tanto como para morir por él."
        failure:
          who: "Mercenario del Cierzo"
          text: "¿Eso es todo? Por eso no me mojo ni los pies."
      no: [entregarse]

encuentro:
  id: enc-calzada
  tablero: t-calzada
  nombre: Emboscada en la calzada
  acto: 1
  enemigos:
    - { bicho: cabo, cuantos: 1, en: [[14,4]] }
    - { bicho: mercenario, cuantos: 2, en: [[12,6], [16,8]] }
    - { bicho: ballestero, cuantos: 2, en: [[9,9], [15,10]] }
  objetivo: { tipo: eliminate_all }
  meta: Romper la emboscada del Cierzo
  nota: "Acto 1. El camino va pegado al barranco: un buen empujón vale por dos golpes."
  mision:
    levels: [1, 2]
    objectives:
      - { type: eliminate_all, label: Romper la emboscada del Cierzo }
      - { type: eliminate, label: Derribar al cabo, target: Cabo del Cierzo, optional: true }
  paquete:
    avoid:
      - kind: hablar
        text: Enseñarle el sello al cabo y decirle que las tres casas ya saben quién lo lleva
        skill: intimidation
        dc: 14
        success:
          who: "Cabo del Cierzo"
          text: "Si las tres casas saben que lo llevas, ya no vale lo mismo. ¡Atrás, por el barranco!"
        failure:
          who: "Cabo del Cierzo"
          text: "Las casas están lejos. Nosotros, aquí."
      - kind: esconderse
        text: Bajar por la cuneta, entre las zarzas, hasta pasar el tramo roto
        dc: 13
        success:
          who: "{companero}"
          text: "Agachados entre las zarzas… Ya está, pasamos. Mira al cabo: bostezando, no se ha enterado de nada."
    parley:
      leader: Cabo del Cierzo
      sobornar:
        text: Le ofreces treinta monedas por el camino libre.
        gold: 30
        success:
          who: "Cabo del Cierzo"
          text: "Treinta… El capitán me paga veinte por esperarte. Haz tú las cuentas. ¡Nos retiramos!"
        failure:
          who: "Cabo del Cierzo"
          text: "El capitán paga más. Y pega más."
      convencer:
        text: Le dices que el Cierzo cobra de las tres casas, y que cuando no le sirva le dejarán colgado igual.
        dc: 14
        success:
          who: "Cabo del Cierzo"
          text: "Eso ya lo sé. Por eso no pienso morir aquí. ¡Vámonos!"
        failure:
          who: "Cabo del Cierzo"
          text: "Mientras pague, me da igual quién cuelgue."
      engañar:
        text: Le gritas que la guardia de Oramar viene detrás de ti.
        dc: 13
        success:
          who: "Cabo del Cierzo"
          text: "¿Oramar? ¡Atrás, atrás!"
        failure:
          who: "Cabo del Cierzo"
          text: "Oramar no saca la guardia de Vadoancho ni para un incendio."
      no: [entregarse]

encuentro:
  id: enc-camara
  tablero: t-camara
  nombre: La cámara de Fullero
  acto: 2
  enemigos:
    - { bicho: maton, cuantos: 3, en: [[9,2], [10,6], [12,5]] }
  objetivo: { tipo: reach_cell, casilla: [14,7] }
  meta: Coger el libro de pagos y salir por la puerta del canal
  nota: "Acto 2. El libro está en el cofre de la cámara cerrada. Fuera, la puerta del canal da al río."
  mision:
    levels: [2, 2]
    objectives:
      - { type: loot, label: Coger el libro de pagos de Fullero, treasures: [Libro de pagos de Fullero] }
      - { type: reach_cell, label: Salir por la puerta del canal, cell: { x: 14, y: 7 } }
  paquete:
    traps:
      - name: Dardos en la cerradura
        x: 10
        y: 2
        tell: Hay agujeros pequeños en el marco de la puerta de la cámara.
        damage: 1d6
        condition: poisoned
        spotDC: 12
        disarmDC: 13
        once: true
      - name: Losa hundida
        x: 9
        y: 4
        tell: Una losa del pasillo está más baja que las demás.
        damage: 1d4
        condition: prone
        spotDC: 11
    avoid:
      - kind: esconderse
        text: Entrar de noche por la puerta del canal y salir por el mismo sitio
        dc: 14
        success:
          who: "{companero}"
          text: "Siguen con sus dados en la entrada. Ya tengo el libro de la cámara: fuera por el canal, sin ruido."
          effects: [{ give: Libro de pagos de Fullero }]
      - kind: pagar
        text: Pagar a uno de los matones para que mire a otro lado
        gold: 25
        success:
          who: "Matón de Fullero"
          text: "Veinticinco y no he visto nada. Ahí tienes la cámara abierta. Yo me voy a por vino."
          effects: [{ give: Libro de pagos de Fullero }]
    parley:
      leader: Matón de Fullero
      sobornar:
        text: Les ofreces veinte monedas por volver a sus dados.
        gold: 20
        success:
          who: "Matón de Fullero"
          text: "Fullero paga quince. Tú, veinte. Las cuentas son las cuentas. ¡A los dados!"
        failure:
          who: "Matón de Fullero"
          text: "Fullero se entera de todo. Y luego nos cobra a nosotros."
      engañar:
        text: Les dices que Fullero ha mandado vaciar la cámara antes de que llegue la guardia.
        dc: 13
        success:
          who: "Matón de Fullero"
          text: "¿Otra vez? Pues vacíala tú, que yo no cargo."
        failure:
          who: "Matón de Fullero"
          text: "Fullero no manda a nadie que no conozcamos."
      no: [entregarse]

encuentro:
  id: enc-puerta
  tablero: t-puerta
  nombre: La puerta de las Forjas
  acto: 3
  enemigos:
    - { bicho: trasgo, cuantos: 4, en: [[3,7], [14,7], [6,8], [11,8]] }
    - { bicho: mercenario, cuantos: 2, en: [[8,8], [9,8]] }
  objetivo: { tipo: survive_rounds, rondas: 5 }
  meta: Aguantar en la puerta cinco rondas, hasta que bajen las rejas
  nota: "Acto 3. Los trasgos golpean la puerta grande, y dos del Cierzo los empujan. Arriba, en las plataformas, se ve mejor."
  mision:
    levels: [3, 3]
    objectives:
      - { type: survive_rounds, label: "Aguantar en la puerta cinco rondas, hasta que bajen las rejas", rounds: 5 }
      - { type: eliminate_all, label: Que no quede un trasgo en la puerta, optional: true }
  paquete:
    avoid:
      - kind: hablar
        text: Gritar desde la muralla que la thane paga diez monedas por cada oreja de trasgo
        skill: intimidation
        dc: 14
        success:
          who: "Mercenario del Cierzo"
          text: "Mira los trasgos: se tocan las orejas y salen corriendo monte arriba. Solos no nos quedamos. ¡Atrás!"
        failure:
          who: "Mercenario del Cierzo"
          text: "Los trasgos se ríen. Nosotros, no. ¡Adelante!"
    parley:
      leader: Mercenario del Cierzo
      sobornar:
        text: Les ofreces treinta monedas por irse y dejar a los trasgos solos.
        gold: 30
        success:
          who: "Mercenario del Cierzo"
          text: "Los trasgos no cobran. Nosotros, sí. Hasta otra."
        failure:
          who: "Mercenario del Cierzo"
          text: "Con treinta no se paga ni la subida."
      convencer:
        text: Les gritas que la reja va a bajar y los va a dejar dentro con cien enanos.
        dc: 15
        success:
          who: "Mercenario del Cierzo"
          text: "¿Cien enanos? A mí me dijeron que eran diez. ¡Fuera de aquí!"
        failure:
          who: "Mercenario del Cierzo"
          text: "¡Que baje! Así no salís vosotros."
      no: [entregarse]

encuentro:
  id: enc-grajo
  tablero: t-grajo
  nombre: La Boca del Grajo
  acto: 3
  enemigos:
    - { bicho: totem, cuantos: 2, en: [[9,1], [17,2]] }
    - { bicho: chaman, cuantos: 1, en: [[16,3]] }
    - { bicho: trasgo, cuantos: 3, en: [[12,1], [4,7], [13,7]] }
  objetivo: { tipo: eliminate, bicho: totem }
  meta: Romper los dos tótems de hielo
  nota: "Acto 3. Si caen los dos tótems, el chamán no puede tirar la nieve de la ladera. Ojo con los pozos: no tienen barandilla."
  mision:
    levels: [3, 4]
    objectives:
      - { type: eliminate, label: Romper los dos tótems de hielo, target: Tótem de hielo }
      - { type: eliminate, label: Acabar con el chamán, target: Chamán trasgo, optional: true }
  paquete:
    traps:
      - name: Cepo de trasgo
        x: 6
        y: 3
        tell: Entre las piedras del suelo asoman unos dientes de hierro oxidados.
        damage: 1d6
        condition: restrained
        spotDC: 12
      - name: Viga podrida
        x: 3
        y: 6
        tell: Una viga del techo cruje cuando pasas por debajo.
        damage: 2d4
        condition: prone
        spotDC: 13
        once: true
    avoid:
      - kind: hablar
        text: Dar un grito de guerra enano que retumbe en toda la mina
        skill: intimidation
        dc: 15
        success:
          who: "Chamán trasgo"
          text: "¡Enanos! ¡Muchos enanos! ¡Corred, corred! ¡Los tótems se quedan!"
        failure:
          who: "Chamán trasgo"
          text: "¡Ji, ji! ¡Eco nada más! ¡Sacad los picos!"
    parley:
      leader: Chamán trasgo
      sobornar:
        text: Le tiras una bolsa de sal. Los trasgos cobran en sal.
        gold: 15
        success:
          who: "Chamán trasgo"
          text: "¡Sal! ¡Sal rica! ¡Nos vamos, nos vamos!"
        failure:
          who: "Chamán trasgo"
          text: "¡Cierzo paga más sal!"
      engañar:
        text: Le dices que el Cierzo se ha ido del valle sin pagarle.
        dc: 13
        success:
          who: "Chamán trasgo"
          text: "¡Cierzo mentiroso! ¡Tótems tontos! ¡Rotos, todos rotos!"
        failure:
          who: "Chamán trasgo"
          text: "¡Tú mentiroso!"
      no: [entregarse]

encuentro:
  id: enc-fuga
  tablero: t-campamento
  nombre: La fuga del campamento
  acto: 3
  enemigos:
    - { bicho: tuerta, cuantos: 1, en: [[10,3]] }
    - { bicho: tamborilero, cuantos: 2, en: [[9,4], [12,4]] }
    - { bicho: mercenario, cuantos: 2, en: [[8,7], [14,6]] }
    - { bicho: ballestero, cuantos: 2, en: [[6,9], [15,9]] }
  objetivo: { tipo: reach_cell, casilla: [20,8] }
  meta: Salir por la brecha del arroyo
  nota: "Acto 3. Os han visto dentro. No hace falta pelear con todos: hay que salir por la brecha de la empalizada. El mapa de las Sendas está en el cofre de la tienda de la sargento."
  mision:
    levels: [4, 4]
    objectives:
      - { type: reach_cell, label: Salir por la brecha del arroyo, cell: { x: 20, y: 8 } }
      - { type: eliminate, label: Callar los tambores, target: Tamborilero del Cierzo, optional: true }
      - { type: loot, label: Llevarse el mapa de las Sendas Viejas, treasures: [Mapa de las Sendas Viejas], optional: true }
  paquete:
    avoid:
      - kind: esconderse
        text: Entrar de noche por la brecha del arroyo, coger el mapa y salir por el mismo sitio
        dc: 15
        success:
          who: "{companero}"
          text: "Por la brecha, agachados… Ahí está el mapa, encima de la mesa de la sargento. Lo tengo. Salimos como entramos."
          effects: [{ give: Mapa de las Sendas Viejas }]
      - kind: hablar
        text: Entrar con capas grises robadas, como si fuerais de los suyos
        skill: deception
        dc: 14
        success:
          who: "La Tuerta, sargento del Cierzo"
          text: "¿Llegáis tarde al reparto? Pasad, pasad, que no queda nada."
          effects: [{ give: Mapa de las Sendas Viejas }]
        failure:
          who: "La Tuerta, sargento del Cierzo"
          text: "Esa capa la llevaba Lucio. ¿Dónde está Lucio? ¡Tambores!"
    parley:
      leader: La Tuerta, sargento del Cierzo
      convencer:
        text: Le dices que el capitán ya la dejó atrás una vez, y que lo volverá a hacer.
        dc: 15
        success:
          who: "La Tuerta, sargento del Cierzo"
          text: "Eso no hacía falta que me lo dijeras. Largaos. Y llevaos el mapa, que a mí no me paga por guardarlo."
          effects: [{ give: Mapa de las Sendas Viejas }]
        failure:
          who: "La Tuerta, sargento del Cierzo"
          text: "Me deja atrás, pero me paga. Tú ni eso."
      sobornar:
        text: Le ofreces cuarenta monedas por mirar hacia otro lado.
        gold: 40
        success:
          who: "La Tuerta, sargento del Cierzo"
          text: "Cuarenta. Por ese dinero, hoy no os he visto."
        failure:
          who: "La Tuerta, sargento del Cierzo"
          text: "Con eso no me compro ni un parche nuevo."
      no: [entregarse]

encuentro:
  id: enc-cornisa
  tablero: t-cornisa
  nombre: La cornisa de las grullas
  acto: 4
  enemigos:
    - { bicho: huargo, cuantos: 2, en: [[9,3], [13,2]] }
    - { bicho: ballestero, cuantos: 2, en: [[17,5], [18,6]] }
    - { bicho: mercenario, cuantos: 2, en: [[16,3], [14,4]] }
  objetivo: { tipo: eliminate_all }
  meta: Despejar la cornisa
  nota: "Acto 4. A un lado, el abismo. Empujar a un huargo al vacío ahorra muchos golpes."
  mision:
    levels: [4, 5]
    objectives:
      - { type: eliminate_all, label: Despejar la cornisa }
  paquete:
    avoid:
      - kind: hablar
        text: Espantar a los huargos con antorchas y gritos
        skill: intimidation
        dc: 14
        success:
          who: "Mercenario del Cierzo"
          text: "¡Los huargos huyen ladera abajo! Sin perros no bajo a esa cornisa. Que pasen."
        failure:
          who: "Mercenario del Cierzo"
          text: "Los huargos no se asustan con tan poco. ¡Cargad las ballestas!"
      - kind: esconderse
        text: Subir de noche pegados a la roca, sin despertar a los huargos
        dc: 15
        success:
          who: "{companero}"
          text: "El viento sopla a nuestro favor: los huargos no nos huelen, y los ballesteros miran al camino grande. Seguimos."
    parley:
      leader: Mercenario del Cierzo
      convencer:
        text: Les gritas que el capitán los ha dejado aquí fuera para que se mueran de frío.
        dc: 14
        success:
          who: "Mercenario del Cierzo"
          text: "En eso tiene razón. Bajad las armas: nos vamos al refugio."
        failure:
          who: "Mercenario del Cierzo"
          text: "Frío pasamos todos. Paga, que es lo que importa."
      sobornar:
        text: Les ofreces treinta monedas y una cama en el refugio.
        gold: 30
        success:
          who: "Mercenario del Cierzo"
          text: "¿Con cama? Trato hecho."
        failure:
          who: "Mercenario del Cierzo"
          text: "Arriba nos espera más que eso."
      no: [entregarse]

encuentro:
  id: enc-atalaya
  tablero: t-atalaya
  nombre: La Atalaya de la Grulla
  acto: 4
  enemigos:
    - { bicho: capitan, cuantos: 1, en: [[12,2]] }
    - { bicho: guardian, cuantos: 1, en: [[10,5]] }
    - { bicho: mercenario, cuantos: 2, en: [[3,5], [18,5]] }
    - { bicho: ballestero, cuantos: 2, en: [[8,2], [14,2]] }
  objetivo: { tipo: eliminate, bicho: capitan }
  meta: Derrotar al capitán del Cierzo y encender el fanal
  nota: "Acto 4, el final. Para nivel 5, y duro. El guardián de hierro no deja pasar a la plataforma; el capitán espera junto al fanal. Los bordes del patio dan al vacío."
  mision:
    levels: [5, 5]
    objectives:
      - { type: eliminate, label: Derrotar al capitán del Cierzo, target: El capitán del Cierzo }
      - { type: reach_cell, label: Encender el fanal, cell: { x: 10, y: 3 } }
  paquete:
    traps:
      - name: Losa enana
        x: 10
        y: 6
        tell: En el centro del patio hay una losa con una runa medio borrada.
        damage: 2d6
        condition: prone
        spotDC: 14
        disarmDC: 15
      - name: Saetera baja
        x: 11
        y: 9
        tell: En la pared del patio hay una saetera a la altura de la rodilla.
        damage: 2d4
        spotDC: 13
        once: true
    avoid:
      - kind: huir
        text: Bajar al refugio a curaros y volver mañana
        skill: athletics
        dc: 10
        success:
          who: "El capitán del Cierzo"
          text: "Id, id a curaros. No os persigo. Sé que volveréis."
    parley:
      leader: El capitán del Cierzo
      convencer:
        text: Le dices que ninguna casa reconocerá nunca a un capitán de mercenarios como señor del paso.
        dc: 18
        success:
          who: "El capitán del Cierzo"
          text: "Ja… Las casas solo reconocen a quien ya ha ganado. Enciende tu fanal. Yo me voy al sur, donde todavía pagan."
        failure:
          who: "El capitán del Cierzo"
          text: "Entonces me reconocerán a la fuerza. Como hicieron con sus abuelos."
      sobornar:
        text: Le ofreces doscientas monedas por irse con los suyos.
        gold: 200
        success:
          who: "El capitán del Cierzo"
          text: "Doscientos. Es lo que me pagó cada casa. Contigo, cuatro. Me voy contento."
        failure:
          who: "El capitán del Cierzo"
          text: "No es el dinero. Bueno, también. Pero sobre todo, no."
      no: [entregarse, engañar]

## Las peleas de los encargos

encuentro:
  id: enc-molino
  tablero: t-molino
  nombre: Los ladrones del molino
  acto: 1
  enemigos:
    - { bicho: ladron, cuantos: 3, en: [[8,3], [13,5], [14,8]] }
    - { bicho: desertor, cuantos: 1, en: [[5,6]] }
  objetivo: { tipo: eliminate_all }
  meta: Echar a los ladrones del molino
  nota: Encargo de Herminia Sauce. Gente con hambre de otra aldea, y un desertor que los manda.
  mision:
    levels: [1, 2]
    objectives:
      - { type: eliminate_all, label: Echar a los ladrones del molino }
  paquete:
    avoid:
      - kind: pagar
        text: Darles dos sacos de harina para que se vayan
        gold: 8
        success:
          who: "Desertor de Brezo"
          text: "Dos sacos son dos sacos. Cogedlos entre cuatro. No volveremos."
      - kind: hablar
        text: Decirles que la alcaldesa da trabajo a quien ayude a moler
        skill: persuasion
        dc: 12
        success:
          who: "Desertor de Brezo"
          text: "¿Trabajo, de verdad? …Dejad los sacos en el suelo. Mañana vendremos a moler, no a robar."
        failure:
          who: "Desertor de Brezo"
          text: "Trabajo. Eso decían en Brezo antes de quemarnos la aldea."
    parley:
      leader: Desertor de Brezo
      convencer:
        text: Les dices que el grano robado se les pudrirá sin molino.
        dc: 11
        success:
          who: "Desertor de Brezo"
          text: "¿Y qué hacemos, entonces? …Ya no tengo fuerzas para pelear."
        failure:
          who: "Desertor de Brezo"
          text: "Mejor podrido que en las tripas de un recaudador."
      no: [entregarse]

encuentro:
  id: enc-calzada-sal
  tablero: t-calzada
  nombre: Los carros de Los Sauces
  acto: 2
  enemigos:
    - { bicho: ladron, cuantos: 3, en: [[12,6], [16,8], [9,9]] }
    - { bicho: desertor, cuantos: 1, en: [[15,10]] }
  objetivo: { tipo: eliminate_all }
  meta: Que el grano de Los Sauces llegue a Vadoancho
  nota: Encargo de Herminia Sauce. Los carros de grano bajan por la calzada, y en el tramo roto los esperan.
  mision:
    levels: [2, 2]
    objectives:
      - { type: eliminate_all, label: Que el grano de Los Sauces llegue a Vadoancho }
  paquete:
    avoid:
      - kind: pagar
        text: Darles un saco del carro para que dejen pasar los demás
        gold: 10
        success:
          who: "Desertor de Brezo"
          text: "Un saco es un saco. Que siga el carro."
      - kind: hablar
        text: Decirles que en el templo de la Ribera dan pan a quien llega
        skill: persuasion
        dc: 12
        success:
          who: "Desertor de Brezo"
          text: "¿Pan? ¿Gratis? …Vamos a Vadoancho, chicos. Delante del carro."
    parley:
      leader: Desertor de Brezo
      convencer:
        text: Le dices que la alcaldesa necesita brazos para la molienda.
        dc: 12
        success:
          who: "Desertor de Brezo"
          text: "Brazos tenemos. Lo que no tenemos es pan. …Está bien, bajo la lanza."
        failure:
          who: "Desertor de Brezo"
          text: "Eso dicen todos los que tienen grano."
      no: [entregarse]

encuentro:
  id: enc-esclusa
  tablero: t-esclusa
  nombre: Los contrabandistas de la esclusa
  acto: 2
  enemigos:
    - { bicho: patron, cuantos: 1, en: [[17,5]] }
    - { bicho: contrabandista, cuantos: 3, en: [[8,5], [10,2], [15,8]] }
  objetivo: { tipo: eliminate, bicho: patron }
  meta: Atrapar al patrón de la esclusa
  nota: "Encargo de Lupe Garbanzo. La esclusa está vacía: entre los muelles hay un foso de tres varas."
  mision:
    levels: [2, 3]
    objectives:
      - { type: eliminate, label: Atrapar al patrón de la esclusa, target: Patrón de la esclusa }
  paquete:
    avoid:
      - kind: hablar
        text: Decirle al patrón que la capitana de Oramar ya sabe su nombre
        skill: intimidation
        dc: 14
        success:
          who: "Patrón de la esclusa"
          text: "¿La capitana de Oramar? Esa mujer cuelga a la gente de los mástiles… Me entrego. Me entrego yo solo."
        failure:
          who: "Patrón de la esclusa"
          text: "Que venga. Aquí la espero."
      - kind: pagar
        text: Comprarle a buen precio la sal de esta noche
        gold: 15
        success:
          who: "Patrón de la esclusa"
          text: "Buen precio. La sal es tuya. Esta noche no pasa nada por la esclusa, palabra."
    parley:
      leader: Patrón de la esclusa
      convencer:
        text: Le dices que Lupe pagará el doble por sal con peaje que él sin peaje.
        dc: 13
        success:
          who: "Patrón de la esclusa"
          text: "¿El doble? Esa mediana no paga el doble ni a su madre. …Pero bajo el garfio."
        failure:
          who: "Patrón de la esclusa"
          text: "Lupe me debe tres barcos. Que pague eso primero."
      sobornar:
        text: Le ofreces veinte monedas por irse río abajo.
        gold: 20
        success:
          who: "Patrón de la esclusa"
          text: "Río abajo hay menos guardia. Trato."
        failure:
          who: "Patrón de la esclusa"
          text: "Veinte es lo que gano en una noche."
      no: [entregarse]

encuentro:
  id: enc-huargos
  tablero: t-robledal
  nombre: Los huargos del robledal
  acto: 2
  enemigos:
    - { bicho: loba, cuantos: 1, en: [[17,9]] }
    - { bicho: huargo, cuantos: 3, en: [[14,3], [16,6], [12,9]] }
  objetivo: { tipo: eliminate_all }
  meta: Acabar con los huargos del robledal
  nota: Encargo de Elvira Breña. La manada baja porque alguien le deja carne en el robledal.
  mision:
    levels: [2, 3]
    objectives:
      - { type: eliminate_all, label: Acabar con los huargos del robledal }
  paquete:
    avoid:
      - kind: hablar
        text: Espantar a la manada con fuego y gritos
        skill: intimidation
        dc: 14
        success:
          who: "{companero}"
          text: "La loba blanca te mira… y da media vuelta. La manada la sigue monte arriba. Este invierno no bajarán."
        failure:
          who: "{companero}"
          text: "¡La loba aúlla! ¡Nos están rodeando!"
      - kind: esconderse
        text: Rodear el robledal con el viento de cara, para que no os huelan
        dc: 13
        success:
          who: "{companero}"
          text: "Ni han levantado la cabeza. Pasamos… pero mañana habrá que volver."
        resolves: false

encuentro:
  id: enc-desertores
  tablero: t-robledal
  nombre: Los desertores del robledal
  acto: 2
  enemigos:
    - { bicho: desertor, cuantos: 4, en: [[15,2], [12,5], [17,7], [13,10]] }
  objetivo: { tipo: eliminate_all }
  meta: Que los desertores dejen de robar a los pastores
  nota: Encargo del castellano de Torre Brezo. Soldados de Brezo sin paga, escondidos en el robledal.
  mision:
    levels: [2, 3]
    objectives:
      - { type: eliminate_all, label: Que los desertores dejen de robar a los pastores }
  paquete:
    avoid:
      - kind: hablar
        text: Decirles que el sargento Zarzal está vivo y no quemó Los Brezales
        skill: persuasion
        dc: 13
        success:
          who: "Desertor de Brezo"
          text: "¿El sargento Zarzal? ¿Vivo? …Bajad las armas. Dile que le debemos una. Nos vamos al llano, sin robar a nadie más."
        failure:
          who: "Desertor de Brezo"
          text: "Zarzal está muerto, o lo estará pronto. Como nosotros."
      - kind: pagar
        text: Darles comida y veinte monedas para que bajen al llano
        gold: 20
        success:
          who: "Desertor de Brezo"
          text: "Comida… y dinero. Gracias. Nos vamos al llano."
    parley:
      leader: Desertor de Brezo
      convencer:
        text: Les ofreces trabajo en Los Sauces, donde faltan brazos.
        dc: 12
        success:
          who: "Desertor de Brezo"
          text: "¿Trabajo de verdad? ¿Con paga? …Bajad las lanzas."
        failure:
          who: "Desertor de Brezo"
          text: "La última vez que nos ofrecieron trabajo, fue quemar una aldea."
      no: [entregarse]

encuentro:
  id: enc-oso
  tablero: t-sendas
  nombre: El oso de las Sendas
  acto: 3
  enemigos:
    - { bicho: oso, cuantos: 1, en: [[14,3]] }
    - { bicho: huargo, cuantos: 2, en: [[12,7], [15,8]] }
  objetivo: { tipo: eliminate_all }
  meta: Despejar la senda
  nota: Encargo de Maelis Cortezaroja. El oso y dos huargos se pelean por la senda, junto al barranco.
  mision:
    levels: [3, 4]
    objectives:
      - { type: eliminate_all, label: Despejar la senda }
  paquete:
    avoid:
      - kind: hablar
        text: Golpear los escudos y gritar hasta que el oso se vaya
        skill: intimidation
        dc: 13
        success:
          who: "{companero}"
          text: "¡Se levanta, ruge… y se va entre las hayas! Los huargos lo siguen de lejos."
        failure:
          who: "{companero}"
          text: "No se asusta. Tiene demasiada hambre."
      - kind: esconderse
        text: Pasar por encima del barranco sin que os oigan
        dc: 12
        success:
          who: "{companero}"
          text: "Ya hemos cruzado el barranco, y el oso sigue con lo suyo."
        resolves: false

encuentro:
  id: enc-refugio
  tablero: t-refugio
  nombre: Una noche en el refugio
  acto: 3
  enemigos:
    - { bicho: huargo, cuantos: 4, en: [[2,1], [15,1], [2,8], [15,8]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar en el refugio hasta el alba
  nota: Encargo de Nieves Albar. Los huargos del Cierzo rondan el refugio de noche. Hay que aguantar dentro hasta que salga el sol.
  mision:
    levels: [4, 4]
    objectives:
      - { type: survive_rounds, label: Aguantar en el refugio hasta el alba, rounds: 4 }
  paquete:
    avoid:
      - kind: hablar
        text: Encender todas las antorchas y hacer sonar la campana
        skill: intimidation
        dc: 13
        success:
          who: "{companero}"
          text: "¡Cómo retumba la campana! Los huargos aúllan… y se pierden en la nieve."
        failure:
          who: "{companero}"
          text: "La campana suena, pero tienen más hambre que miedo."

encuentro:
  id: enc-ermita
  tablero: t-cementerio
  nombre: Los saqueadores del cementerio
  acto: 3
  enemigos:
    - { bicho: cabecilla, cuantos: 1, en: [[13,5]] }
    - { bicho: saqueador, cuantos: 3, en: [[5,2], [10,1], [14,2]] }
  objetivo: { tipo: eliminate, bicho: cabecilla }
  meta: Atrapar al cabecilla de los saqueadores
  nota: Encargo de Fray Odón. Buscan la tumba del último thane, y a su cabecilla le espera un comprador.
  mision:
    levels: [3, 4]
    objectives:
      - { type: eliminate, label: Atrapar al cabecilla de los saqueadores, target: Cabecilla de saqueadores }
  paquete:
    traps:
      - name: Cepo entre las tumbas
        x: 11
        y: 5
        tell: Delante de la puerta de la cripta hay tierra recién removida.
        damage: 1d6
        condition: restrained
        spotDC: 12
    avoid:
      - kind: hablar
        text: Gritarles que el fraile ha llamado a los enanos de Hondaroca
        skill: intimidation
        dc: 13
        success:
          who: "Cabecilla de saqueadores"
          text: "¿Los enanos? ¡Tirad las palas, corred! …¡Eh, no me dejéis aquí dentro! ¿Quién ha echado el cerrojo?"
        failure:
          who: "Cabecilla de saqueadores"
          text: "Los enanos no salen de sus forjas ni para enterrar a los suyos."
    parley:
      leader: Cabecilla de saqueadores
      sobornar:
        text: Le ofreces veinticinco monedas por irse sin nada.
        gold: 25
        success:
          who: "Cabecilla de saqueadores"
          text: "Veinticinco y sin cavar. No está mal."
        failure:
          who: "Cabecilla de saqueadores"
          text: "Por ese cuerno me pagan diez veces más."
      convencer:
        text: Le dices que Oramar no paga por cuernos robados. Cuelga a quien los trae.
        dc: 13
        success:
          who: "Cabecilla de saqueadores"
          text: "¿Cuelga? A mí me dijeron que pagaba. …Tirad las palas."
        failure:
          who: "Cabecilla de saqueadores"
          text: "Ya veremos quién cuelga a quién."
      no: [entregarse]
