# La costa que no duerme — ronda 6: los tableros

Trece mapas y diecisiete peleas. Nueve son de la historia y ocho de los encargos. Con el modo guiado
(D-J62) no hay lista de tableros: a cada uno se llega porque lo pide un hito o un encargo aceptado.

Lo que se gana de cada pelea:

| Pelea | Se gana | Lo que importa |
|---|---|---|
| La Vela | aguantando 5 rondas | empujar a los muertos al agua honda; hablarles |
| La marea que no baja | devolviéndolos a todos al agua | hablarles, como en la Vela |
| La cueva del Gallo | llevándose la caja del cura | el borde del acantilado; una trampa; el Gallo se deja comprar |
| La puerta del faro | aguantando 4 rondas | los acantilados a los dos lados; Lucio escucha |
| La Esperanza | sacando el cuaderno del camarote | el agua honda; una tabla podrida |
| La Boca del Bajo | llegando a las velas de la llamada | Antón le tiene pánico al agua |
| La pared de las manos | llegando a la pared | las simas del suelo; la poza |
| La primera Vela de todos | aguantando 6 rondas | empujar a los muertos al agua honda |
| La tumba de Mateo | llevando la caja al borde del acantilado | el acantilado; Lucio escucha |
| Encargos | derrotar a todos, a uno, llegar o llevarse algo | el agua, los acantilados, trampas y salidas habladas |

Los tres finales son duros (D-J59): para un grupo de cuatro de nivel 4 o 5.

Las salidas de una pelea (`avoid`, `parley`) las dice quien manda enfrente, como en el juego: por eso
están escritas como lo que dice, no como lo que pasa.

## Los mapas

```yaml
tablero:
  id: embarcadero
  localidad: embarcadero-viejo
  mapa:
    - '##################'
    - '#WWWWWWWWWWWWWWWW#'
    - '#WWWW.......WWWWW#'
    - '#WWWW..c....WWWWW#'
    - '#WWWWWWW..WWWWWWW#'
    - '#WWWWWWW..WWW...W#'
    - '#WWWWWWW..WWW.c.W#'
    - '#WWW..WW..WW....W#'
    - '#WW............wW#'
    - '#.....~....T.....#'
    - '##################'
  inicio_grupo: [[2, 9], [3, 9], [4, 9], [5, 9]]
  paquete:
    zones:
      - name: La última tabla
        rect: { x: 5, y: 2, width: 7, height: 2 }
        note: 'El final del embarcadero, con la silla de enea del que vela. Desde aquí se oye el agua golpear los postes.'
      - name: La orilla
        rect: { x: 1, y: 8, width: 16, height: 2 }
        note: 'Arena gris y piedras resbaladizas al pie del embarcadero.'

tablero:
  id: playa
  localidad: la-playa
  mapa:
    - '##################'
    - '#WWWWWWWWWWWWWWWW#'
    - '#WWWWWWWWWWWWWWWW#'
    - '#wwwwwwwWWwwwwwww#'
    - '#ww..wwwwwwww..ww#'
    - '#......c.....c...#'
    - '#..C.........~~..#'
    - '#.....b...c......#'
    - '#..c.......T..c..#'
    - '#................#'
    - '##################'
  inicio_grupo: [[7, 9], [8, 9], [9, 9], [10, 9]]

tablero:
  id: cala
  localidad: la-cala
  mapa:
    - '####################'
    - '#....#####......^^x#'
    - '#..k.D...#.....^^vW#'
    - '#....#...c.....^.vW#'
    - '###.##.......c..^vW#'
    - '#.....~~.......T..W#'
    - '#..c.........c....W#'
    - '#wwwww......=.....W#'
    - '#WWWWWwww.........W#'
    - '#WWWWWWWWWw.......W#'
    - '#WWWWWWWWWWw......W#'
    - '####################'
  inicio_grupo: [[13, 9], [14, 9], [15, 9], [16, 9]]
  paquete:
    zones:
      - name: La cueva del alijo
        rect: { x: 1, y: 1, width: 4, height: 3 }
        note: 'Una cueva seca al fondo de la cala, con fardos tapados con lona y el cofre del Gallo.'
      - name: El camino del acantilado
        cells: ['15,1', '16,1', '17,1', '15,2', '16,2', '15,3', '16,4']
        note: 'Un sendero de roca que sube hacia Arenales. A un lado, treinta pies de caída al mar.'

tablero:
  id: faro
  localidad: el-faro
  mapa:
    - '##################'
    - '#Wvv#########vvWW#'
    - '#Wv.#.......#..vW#'
    - '#Wv.#.......#..vW#'
    - '#Wv.####D####..vW#'
    - '#Wv............vW#'
    - '#Wv..c.....c...vW#'
    - '#Wv....T.......vW#'
    - '#Wv..c.....c...vW#'
    - '#Wv............vW#'
    - '#Wvvvvvv...vvvvvW#'
    - '##################'
  inicio_grupo: [[7, 5], [8, 5], [9, 5], [8, 6]]
  paquete:
    zones:
      - name: La torre
        rect: { x: 5, y: 2, width: 7, height: 2 }
        note: 'El pie de la torre del faro, con la escalera de caracol que sube ciento cuarenta y dos escalones.'
      - name: El huerto
        rect: { x: 3, y: 5, width: 12, height: 5 }
        note: 'El huerto de coles de la farera, entre los dos acantilados de la punta.'

tablero:
  id: pecio
  localidad: el-pecio
  mapa:
    - '####################'
    - '#WWWWWWWWWWWWWWWWWW#'
    - '#WW##############WW#'
    - '#WW#..w.#...k#..#WW#'
    - '#WW#....o....o..#WW#'
    - '#WW#ww..#....#.w#WW#'
    - '#WW##.######.##.##W#'
    - '#WWw......ww......W#'
    - '#Ww...c.......c..wW#'
    - '#......wwWWWw....xW#'
    - '####################'
  inicio_grupo: [[14, 9], [15, 9], [16, 9], [15, 8]]
  paquete:
    zones:
      - name: El camarote del patrón
        rect: { x: 9, y: 3, width: 4, height: 3 }
        note: 'El camarote de Itziar Goikoa. Aquí se sentaba el farero a escribir con la marea baja.'
      - name: La bodega inundada
        rect: { x: 3, y: 7, width: 15, height: 3 }
        note: 'El vientre del barco, partido por la mitad, con el agua hasta las rodillas.'

tablero:
  id: boca
  localidad: la-boca
  mapa:
    - '####################'
    - '#WWW....^^^^....WWW#'
    - '#WW...c.^..^.c...WW#'
    - '#W..v.....k.....v.W#'
    - '#W..v...........v.W#'
    - '#W....vv.....vv...W#'
    - '#Ww...............W#'
    - '#ww..c.....~~..c..w#'
    - '#w................w#'
    - '#WWw......x.....wWW#'
    - '####################'
  inicio_grupo: [[8, 8], [9, 8], [10, 8], [11, 8]]
  paquete:
    zones:
      - name: El altar de las velas
        rect: { x: 8, y: 1, width: 4, height: 2 }
        note: 'Una repisa de roca con dos velas negras encendidas. Desde aquí se llama a lo que vive en el agua.'

tablero:
  id: pared
  localidad: la-pared
  mapa:
    - '######################'
    - '#WWWWW^^^^x^^^^WWWWWW#'
    - '#WWW...^^^^^^^...WWWW#'
    - '#WW....v.....v....WWW#'
    - '#W..c..v..~..v..c..WW#'
    - '#W.....vv...vv......W#'
    - '#WW......w...w.....WW#'
    - '#WWW..c....c....c..WW#'
    - '#WWWW..............WW#'
    - '#WWWWWw.........wWWWW#'
    - '######################'
  inicio_grupo: [[9, 8], [10, 8], [11, 8], [12, 8]]
  paquete:
    zones:
      - name: La pared
        rect: { x: 6, y: 1, width: 9, height: 2 }
        note: 'La pared lisa llena de manos pintadas, cientos, de muchos siglos. Tres son nuevas.'
      - name: La poza honda
        cells: ['9,4', '10,4', '11,4', '10,3']
        note: 'Agua negra y verde que no deja ver el fondo. Algo pálido se mueve debajo.'

tablero:
  id: cementerio
  localidad: el-cementerio
  mapa:
    - '####################'
    - '#WWWWWWWWWWWWWWWWWW#'
    - '#vvvvvvvvvvvvvvvvvx#'
    - '#..c..c....c..c....#'
    - '#.....####.........#'
    - '#..c..#..#..c..c...#'
    - '#.....#..D....k....#'
    - '#..c..####..c..c...#'
    - '#..................#'
    - '#~~..c..c....c..~~.#'
    - '#..................#'
    - '####################'
  inicio_grupo: [[8, 10], [9, 10], [10, 10], [11, 10]]
  paquete:
    zones:
      - name: La capilla sin puerta
        rect: { x: 7, y: 5, width: 2, height: 2 }
        note: 'Una capilla vacía con las paredes desconchadas. Aquí guardaba Lázaro las palas.'
      - name: El borde
        rect: { x: 1, y: 3, width: 18, height: 1 }
        note: 'Las últimas cruces antes del acantilado. Abajo, el mar rompe contra las rocas.'

tablero:
  id: salazon
  localidad: la-salazon
  mapa:
    - '##################'
    - '#WWWWW####WWWWWWW#'
    - '#wwwww#..#wwwwwww#'
    - '#w...w#..D......w#'
    - '#w.T.w###.###.T.w#'
    - '#w...w.........ww#'
    - '#wwwww..c..T..www#'
    - '#.......c.......w#'
    - '#..T...........T.#'
    - '#................#'
    - '##################'
  inicio_grupo: [[7, 9], [8, 9], [9, 9], [10, 9]]

tablero:
  id: lonja
  localidad: arenales
  mapa:
    - '####################'
    - '#WWWWWWWWWWWWWWWWWW#'
    - '#WWWWWWWWWWWWWWWWWW#'
    - '#W...T....T....T..W#'
    - '#W..c..........c..W#'
    - '#W......====......W#'
    - '#W..c..........c..W#'
    - '#WWWW...T....T..WWW#'
    - '#WWWW...........WWW#'
    - '#WWWWWW.......WWWWW#'
    - '####################'
  inicio_grupo: [[8, 8], [9, 8], [10, 8], [11, 8]]

tablero:
  id: cripta
  localidad: la-ermita
  mapa:
    - '####################'
    - '#.....#......#.....#'
    - '#..k..D..c...D..T..#'
    - '#.....#......#.....#'
    - '###D######D#####D###'
    - '#..................#'
    - '#..c....C....c.....#'
    - '#..................#'
    - '####################'
  inicio_grupo: [[8, 7], [9, 7], [10, 7], [11, 7]]
  paquete:
    zones:
      - name: El osario
        rect: { x: 1, y: 1, width: 5, height: 3 }
        note: 'El cuarto más hondo de la cripta, donde las Rezadoras guardaban los exvotos que no caben arriba.'

tablero:
  id: acantilado
  localidad: la-cala
  mapa:
    - '####################'
    - '#WWWWWWvvv^^^^^^^^x#'
    - '#WWWWWvvv^^^c^^^^^^#'
    - '#WWWWvvv......^^^^^#'
    - '#WWWvvv...c....b..##'
    - '#WWvvv......c.....##'
    - '#Wvvv..b........####'
    - '#vvv.....c...#######'
    - '#v.........#########'
    - '####################'
  inicio_grupo: [[2, 8], [3, 8], [4, 8], [5, 8]]

tablero:
  id: bodega
  localidad: la-salazon
  mapa:
    - '##################'
    - '#WWWWWWWWWWWWWWWW#'
    - '#wwwwwwwwwwwwwwww#'
    - '#..T..T......T.T.#'
    - '#.......c........#'
    - '#.TT...====..TT..#'
    - '#......c....c....#'
    - '#.k..T.......T...#'
    - '#................#'
    - '##################'
  inicio_grupo: [[7, 8], [8, 8], [9, 8], [10, 8]]
```

## Las peleas de la historia

```yaml
encuentro:
  id: enc-la-vela
  nombre: La Vela
  tablero: embarcadero
  acto: 1
  meta: 'Aguantar en el embarcadero hasta que cante el gallo'
  nota: 'Siéntate en la última tabla y aguanta hasta el amanecer. Los que suben no se matan: si los empujas al agua honda, no vuelven hasta la otra marea.'
  enemigos:
    - { bicho: desvelado, cuantos: 3, en: [[6, 2], [10, 2], [14, 5]] }
  objetivo: { tipo: survive_rounds, rondas: 5 }
  paquete:
    avoid:
      - kind: hablar
        text: 'Sentarte en la silla de enea y hablarles del tiempo y de las redes, como dice Ciriaco'
        skill: persuasion
        dc: 13
        success:
          who: "Desvelado"
          text: "¿Va a llover mañana…? Hace tanto frío aquí abajo… Habla más. Habla hasta que amanezca."
          effects: [{ standing: rezadoras, amount: 1 }]
        partial:
          who: "Desvelado"
          text: "Calla… otra vez calla… ¿Por qué te callas? Subimos un poco más… solo un poco."
          effects: [{ hurt: 1d4 }]
        failure:
          who: "Desvelado"
          text: "No te oímos. No te oímos. ¡Sube, que no nos oye!"
    parley:
      leader: Desvelado
      no: [sobornar, engañar, entregarse]
      convencer:
        text: 'Ponerte a hablarles en voz alta, de lo que sea, sin parar'
        dc: 13
        resolves: true
        success:
          who: "Desvelado"
          text: "Así… así… Cuéntanos más. Ya no subimos. Nos quedamos aquí, escuchando, hasta que salga el sol."
        partial:
          who: "Desvelado"
          text: "Se te quiebra la voz… pero te oímos. Esta ronda nadie sube más."
        failure:
          who: "Desvelado"
          text: "Más alto. ¡Más alto! No te oímos con el agua."

encuentro:
  id: enc-la-marea
  nombre: La marea que no baja
  tablero: playa
  acto: 2
  meta: 'Devolver al agua a todos los que han salido'
  nota: 'Seis niños dormidos caminan hacia el mar por la Playa de las Redes. Devuelve al agua a los que salen a por ellos, hasta que sus padres se los lleven a casa.'
  enemigos:
    - { bicho: desvelado, cuantos: 4, en: [[4, 4], [12, 3], [14, 4], [6, 3]] }
  paquete:
    avoid:
      - kind: hablar
        text: 'Plantarte entre los niños y el agua y hablarles a los muertos, como en la Vela'
        skill: persuasion
        dc: 14
        success:
          who: "Desvelado"
          text: "Los críos no… los críos no hablan… tú sí. Quédate tú, y los críos que se vayan a dormir."
          effects: [{ standing: cofradia, amount: 1 }]
        failure:
          who: "Desvelado"
          text: "Falta uno. Falta uno. ¡Nos lo debéis!"
      - kind: esconderse
        text: 'Coger a los niños en brazos y apartarlos de la orilla sin que os vean'
        skill: stealth
        dc: 14
        resolves: false
        success:
          who: "Desvelado"
          text: "¿Dónde están los niños? ¿Dónde…? Se han ido. Volveremos mañana."
        failure:
          who: "Desvelado"
          text: "¡Ahí! ¡Se los llevan!"
    parley:
      leader: Desvelado
      no: [sobornar, entregarse]
      convencer:
        text: 'Decirles que vas a buscar al que falta, y que dejen a los niños'
        dc: 14
        resolves: true
        success:
          who: "Desvelado"
          text: "¿Lo buscarás? ¿De verdad? Entonces esperamos. Los críos, a casa."
        failure:
          who: "Desvelado"
          text: "Todos dicen que lo buscarán. Nadie baja nunca."
      engañar:
        text: 'Gritarles que Mateo ya ha vuelto al agua'
        dc: 15
        resolves: true
        success:
          who: "Desvelado"
          text: "¿Ha vuelto…? Vamos a verle. Vamos a verle todos."
        failure:
          who: "Desvelado"
          text: "Mentira. Mateo está en tierra. Lo oímos llorar desde aquí."

encuentro:
  id: enc-la-cala
  nombre: La cueva del Gallo
  tablero: cala
  acto: 2
  meta: 'Llevarte la caja de Don Fermín del cofre del Gallo'
  nota: 'La caja del cura está en el cofre de la cueva del fondo. El Gallo y los suyos no la van a soltar: es lo que les da de comer cada mes.'
  enemigos:
    - { bicho: el-gallo, cuantos: 1, en: [[12, 2]] }
    - { bicho: contrabandista, cuantos: 3, en: [[2, 1], [7, 2], [15, 3]] }
  mision:
    objectives:
      - { type: loot, label: 'Llevarte la caja de Don Fermín', treasures: [Caja de Don Fermín] }
  paquete:
    traps:
      - name: Cuerda con cascabeles
        x: 10
        y: 5
        tell: 'Una cuerda fina cruza la arena a la altura del tobillo, con conchas atadas.'
        condition: prone
        spotDC: 12
        disarmDC: 11
        once: true
    avoid:
      - kind: pagar
        text: 'Ofrecerle al Gallo veinte monedas por la caja'
        gold: 20
        success:
          who: "El Gallo"
          text: "¿Veinte? Por una caja de papeles que no sé leer… Trato. Y dile a la vieja Arrieta que ya no le cobro."
          effects: [{ give: Caja de Don Fermín }]
      - kind: hablar
        text: 'Decirle al Gallo que la señora Arrieta ya no le va a pagar: lo sabe todo el pueblo'
        skill: deception
        dc: 15
        success:
          who: "El Gallo"
          text: "Si la vieja ya no paga, esa caja no vale nada. Llévatela, y que te aproveche."
          effects: [{ give: Caja de Don Fermín }]
        failure:
          who: "El Gallo"
          text: "¿Me tomas por tonto? Kikirikí, muchachos. A por ellos."
    parley:
      leader: El Gallo
      sobornar:
        text: 'Ofrecerle quince monedas y que todos salgáis de la cala de pie'
        gold: 15
        resolves: true
        success:
          who: "El Gallo"
          text: "Quince, y la caja es tuya. Nunca me gustó la letra de ese cura."
          effects: [{ give: Caja de Don Fermín }]
        failure:
          who: "El Gallo"
          text: "¿Quince? Eso me lo saco en una noche. Seguid."
      convencer:
        text: 'Decirle que en esa caja está lo que hace subir a los muertos'
        dc: 15
        resolves: true
        success:
          who: "El Gallo"
          text: "Pues que se la lleve otro. Yo vendo aguardiente, no muertos. Toma la caja, y fuera de mi cala."
          effects: [{ give: Caja de Don Fermín }]
        partial:
          who: "El Gallo"
          text: "Quietos, muchachos… Que lo piense. Nadie dispara todavía."
        failure:
          who: "El Gallo"
          text: "Los muertos no pagan. La vieja sí. Seguid."
      engañar:
        text: 'Gritarle que viene la milicia de costa por el acantilado'
        dc: 16
        resolves: false
        success:
          who: "El Gallo"
          text: "¡La milicia! ¡Por el agua, deprisa! ¡Dejad todo!"
        failure:
          who: "El Gallo"
          text: "Aquí no sube la milicia ni borracha."
      entregarse:
        text: 'Soltar las armas y pedir que os dejen ir'
        resolves: false
        success:
          who: "El Gallo"
          text: "Fuera, y sin la caja. Y la bolsa se queda aquí, por las molestias."
          effects: [{ gold: -5 }]

encuentro:
  id: enc-la-puerta-del-faro
  nombre: La puerta del faro
  tablero: faro
  acto: 3
  meta: 'Aguantar en la puerta del faro hasta que se cansen'
  nota: 'Lucio sube con sus hombres para matar a Ane. Defiende la puerta de la torre hasta que se cansen, o convéncelos de que se vayan.'
  enemigos:
    - { bicho: lucio-arpon, cuantos: 1, en: [[8, 9]] }
    - { bicho: hombre-de-lucio, cuantos: 4, en: [[7, 9], [9, 9], [4, 9], [13, 9]] }
  objetivo: { tipo: survive_rounds, rondas: 4 }
  paquete:
    avoid:
      - kind: hablar
        text: 'Leerle a Lucio lo que dice el diario del cura: si muere la mano más joven, el agua se lleva a los niños'
        skill: persuasion
        dc: 15
        success:
          who: "Lucio con el arpón"
          text: "¿Los niños…? ¿Lo pone ahí, de verdad? …Bajad. Bajad todos. Por mi padre que esto no se ha acabado."
          effects: [{ attitude: 1, who: Lucio Iturbe }]
        failure:
          who: "Lucio con el arpón"
          text: "Eso lo escribió el cura de la vieja Arrieta. ¡Apartaos de la puerta!"
      - kind: hablar
        text: 'Decirles a los hombres de Lucio que se vayan a casa con sus hijos'
        skill: intimidation
        dc: 16
        success:
          who: "{companero}"
          text: "¿Has oído? «Lucio, yo me voy: tengo dos críos en casa.» Se van, uno detrás de otro. Lucio se queda solo."
        failure:
          who: "Lucio con el arpón"
          text: "¡Nadie se va! Por mi padre que hoy se acaba."
    parley:
      leader: Lucio con el arpón
      convencer:
        text: 'Hablarle de su padre: Mateo remó la barca, pero no firmó'
        dc: 14
        resolves: true
        success:
          who: "Lucio con el arpón"
          text: "Mi padre remó. Solo remó… y lo he enterrado en tierra para nada. Vámonos. Vámonos, he dicho."
        partial:
          who: "Lucio con el arpón"
          text: "Mi padre… Esperad. Bajad los arpones un momento."
        failure:
          who: "Lucio con el arpón"
          text: "¡No hables de mi padre!"
      entregarse:
        text: 'Abrir la puerta y apartaros'
        resolves: false
        success:
          who: "Lucio con el arpón"
          text: "Apartaos. Y que conste que a vosotros no os quería hacer nada."
          effects: [{ attitude: -1, who: Ane Goikoa }]
      no: [sobornar]

encuentro:
  id: enc-el-pecio
  nombre: La Esperanza con la marea baja
  tablero: pecio
  acto: 3
  meta: 'Sacar el cuaderno del farero del camarote'
  nota: 'Entra en el casco de la Esperanza por el boquete, llega al camarote del patrón y sácale el cuaderno de Martín Goikoa antes de que vuelva a subir el agua.'
  enemigos:
    - { bicho: cangrejo-pecio, cuantos: 2, en: [[11, 3], [5, 3]] }
    - { bicho: anguila-bodega, cuantos: 2, en: [[10, 7], [2, 8]] }
    - { bicho: ahogado-viejo, cuantos: 1, en: [[15, 4]] }
  mision:
    objectives:
      - { type: loot, label: 'Sacar el cuaderno del farero', treasures: [Cuaderno del farero] }
  paquete:
    traps:
      - name: Tabla podrida
        x: 10
        y: 4
        tell: 'Una tabla del suelo del camarote está más negra y más blanda que las demás.'
        damage: 1d6
        condition: restrained
        spotDC: 13
        disarmDC: 12
        once: true
    avoid:
      - kind: esconderse
        text: 'Entrar por el boquete despacio, pisando solo las tablas secas'
        skill: stealth
        dc: 13
        success:
          who: "Ahogado viejo"
          text: "¿Quién anda…? Nadie. El agua. Solo el agua."
          effects: [{ give: Cuaderno del farero }]
        failure:
          who: "Ahogado viejo"
          text: "¿Quién pisa mi barco? ¡Fuera de la Esperanza!"

encuentro:
  id: enc-la-bajamar
  nombre: La Boca del Bajo en la bajamar grande
  tablero: boca
  acto: 4
  meta: 'Llegar al altar y apagar las velas de la llamada'
  nota: 'Los de la Salazón han encendido dos velas negras en el altar de la Boca para llamar a la Vecina, con Uxue dormida a su lado. Llega al altar y apágalas antes de que conteste.'
  enemigos:
    - { bicho: anton-capataz, cuantos: 1, en: [[9, 3]] }
    - { bicho: estibador, cuantos: 3, en: [[8, 1], [11, 1], [5, 2]] }
    - { bicho: desvelado, cuantos: 2, en: [[14, 2], [3, 4]] }
  objetivo: { tipo: reach_cell, casilla: [10, 1] }
  paquete:
    avoid:
      - kind: hablar
        text: 'Gritarle a Antón que la marea ya está subiendo y que él no es de aquí: a él sí lo ahoga'
        skill: intimidation
        dc: 15
        success:
          who: "Antón el capataz"
          text: "¿Sube…? ¡Sube! Que la señora haga lo que quiera. ¡Yo me voy de aquí!"
        failure:
          who: "Antón el capataz"
          text: "La marea sube cuando lo diga la señora. Cogedlos."
    parley:
      leader: Antón el capataz
      engañar:
        text: 'Gritar que el agua ya entra por la Boca'
        dc: 13
        resolves: true
        success:
          who: "Antón el capataz"
          text: "¡El agua! ¡Fuera, fuera todos! ¡La niña, dejad a la niña!"
        failure:
          who: "Antón el capataz"
          text: "El agua aún no ha llegado a las argollas. Seguid."
      sobornar:
        text: 'Ofrecerle cuarenta monedas para que se vaya de Mareaviva esta misma noche'
        gold: 40
        resolves: true
        success:
          who: "Antón el capataz"
          text: "Cuarenta, y no me volvéis a ver. La Salazón, para quien la quiera."
        failure:
          who: "Antón el capataz"
          text: "La señora me deja la Salazón entera. Cuarenta monedas no son nada."
      convencer:
        text: 'Decirle que la señora le va a dejar ahí abajo cuando suba la marea'
        dc: 15
        resolves: true
        success:
          who: "Antón el capataz"
          text: "Es verdad… a mí nunca me dijo cómo se sale de aquí. Me voy."
        partial:
          who: "Antón el capataz"
          text: "¿Dejarme ahí abajo…? Quietos. Dejadme pensar."
        failure:
          who: "Antón el capataz"
          text: "La señora no miente. La señora nunca miente."

encuentro:
  id: enc-la-pared
  nombre: Hasta la pared
  tablero: pared
  acto: 4
  meta: 'Llegar con Ane a la pared de las manos'
  nota: 'Para que el trato se acabe, Ane tiene que poner su mano en la pared y apartarla. Los muertos no quieren dormir, y el brazo de la poza no quiere que nadie se vaya.'
  enemigos:
    - { bicho: brazo-vecina, cuantos: 1, en: [[10, 2]] }
    - { bicho: ahogado-viejo, cuantos: 2, en: [[4, 3], [16, 3]] }
    - { bicho: desvelado, cuantos: 3, en: [[3, 5], [18, 5], [8, 6]] }
  objetivo: { tipo: reach_cell, casilla: [10, 1] }
  mision:
    levels: [4, 5]
  paquete:
    traps:
      - name: Poza honda
        x: 10
        y: 4
        tell: 'En el centro de la cueva, el agua de una poza está tan quieta que parece suelo.'
        damage: 1d8
        condition: restrained
        spotDC: 12
        disarmDC: 30
        once: true
    avoid:
      - kind: hablar
        text: 'Que Ane hable con la Vecina: le dirá que viene a quitarse, por las buenas'
        skill: persuasion
        dc: 18
        success:
          who: "La Vecina"
          text: "Por las buenas… Lo que se dio por las buenas, por las buenas se devuelve. Pasa, niña. Pasa sola."
          effects: [{ standing: arenales, amount: 1 }]
        failure:
          who: "La Vecina"
          text: "Si te quitas, me quedo sola. Otra vez sola. No. No."

encuentro:
  id: enc-la-primera-vela
  nombre: La primera Vela de todos
  tablero: embarcadero
  acto: 4
  meta: 'Velar en el embarcadero viejo hasta el amanecer'
  nota: 'Las Rezadoras y medio pueblo se sientan en el embarcadero viejo y le hablan al agua. Los muertos más viejos no quieren soltar el poste. Aguanta con ellos hasta que salga el sol.'
  enemigos:
    - { bicho: patron-ahogado, cuantos: 1, en: [[9, 2]] }
    - { bicho: ahogado-viejo, cuantos: 2, en: [[6, 2], [11, 3]] }
    - { bicho: desvelado, cuantos: 3, en: [[14, 5], [4, 7], [13, 7]] }
  objetivo: { tipo: survive_rounds, rondas: 6 }
  mision:
    levels: [4, 5]
  paquete:
    avoid:
      - kind: hablar
        text: 'Que todo el pueblo hable a la vez, cada uno con su muerto, por su nombre'
        skill: persuasion
        dc: 18
        success:
          who: "El patrón de la galerna"
          text: "Mis hombres… mis hombres os oyen. Les estáis llamando por su nombre. Podemos dormir, entonces. Podemos dormir."
          effects: [{ standing: rezadoras, amount: 1 }]
        failure:
          who: "El patrón de la galerna"
          text: "¡Treinta años solos en el agua! ¡Ahora nos oís! ¡Ahora!"
    parley:
      leader: El patrón de la galerna
      no: [sobornar, engañar, entregarse]
      convencer:
        text: 'Decirle al patrón que sus hombres ya no se quedan solos: el pueblo vela por ellos'
        dc: 16
        resolves: true
        success:
          who: "El patrón de la galerna"
          text: "Entonces suelto el poste. Que alguien les hable cuando yo me duerma."
        partial:
          who: "El patrón de la galerna"
          text: "Las Rezadoras… ¿nos hablan a nosotros? Quietos, hombres. Escuchad."
        failure:
          who: "El patrón de la galerna"
          text: "Eso dijeron hace treinta años. Y aquí seguimos."

encuentro:
  id: enc-la-tumba
  nombre: La tumba de Mateo
  tablero: cementerio
  acto: 4
  meta: 'Llevar la caja de Mateo al borde del acantilado'
  nota: 'La caja de Mateo Iturbe tiene que volver al agua. Lucio y los suyos la guardan en el cementerio, y no la van a soltar por las buenas.'
  enemigos:
    - { bicho: lucio-arpon, cuantos: 1, en: [[13, 5]] }
    - { bicho: hombre-de-lucio, cuantos: 4, en: [[15, 6], [12, 3], [16, 8], [9, 8]] }
  objetivo: { tipo: reach_cell, casilla: [18, 2] }
  mision:
    levels: [4, 5]
  paquete:
    traps:
      - name: Fosa abierta
        x: 11
        y: 6
        tell: 'Entre dos cruces hay un agujero tapado con ramas: una fosa que nadie llenó.'
        damage: 1d6
        condition: prone
        spotDC: 11
        disarmDC: 10
        once: true
    avoid:
      - kind: hablar
        text: 'Decirle a Lucio que su padre remó para salvar al pueblo, y que el pueblo le enterrará con su nombre en el agua'
        skill: persuasion
        dc: 17
        success:
          who: "Lucio con el arpón"
          text: "Con su nombre… Que lo digan en voz alta, entonces. Mateo Iturbe. Que lo diga todo el pueblo. …Llevaosla."
          effects: [{ attitude: 1, who: Lucio Iturbe }]
        failure:
          who: "Lucio con el arpón"
          text: "Treinta años callados, y ahora queréis decir su nombre. ¡Fuera de aquí!"
    parley:
      leader: Lucio con el arpón
      convencer:
        text: 'Prometerle una cruz con el nombre de su padre en el cementerio'
        dc: 15
        resolves: true
        success:
          who: "Lucio con el arpón"
          text: "Una cruz con su nombre. La primera de verdad. …Vale. Pero la caja la llevo yo hasta el borde."
        partial:
          who: "Lucio con el arpón"
          text: "Una cruz… Quietos. Dejadme pensarlo."
        failure:
          who: "Lucio con el arpón"
          text: "Una cruz encima de una caja vacía. ¡Como todas!"
      no: [sobornar]
```

## Las peleas de los encargos

```yaml
encuentro:
  id: enc-congrios
  nombre: Las pozas de la bajamar
  tablero: playa
  acto: 1
  meta: 'Acabar con el congrio gigante'
  nota: 'Juana dice que el que corta las redes es un congrio enorme que vive en las pozas. Sácalo de su poza y acaba con él.'
  enemigos:
    - { bicho: congrio-gigante, cuantos: 1, en: [[13, 4]] }
    - { bicho: congrio-poza, cuantos: 3, en: [[3, 3], [10, 3], [15, 3]] }
  objetivo: { tipo: eliminate, bicho: congrio-gigante }
  paquete:
    avoid:
      - kind: huir
        text: 'Salir de las pozas antes de que suba el agua'
        dc: 10

encuentro:
  id: enc-salmuera
  nombre: Las pilas de salmuera
  tablero: salazon
  acto: 1
  meta: 'Limpiar las pilas de cangrejos'
  nota: 'Los cangrejos de salmuera se han comido el pescado de una semana. Échalos de las pilas antes de que llegue la sal nueva.'
  enemigos:
    - { bicho: cangrejo-salmuera, cuantos: 5, en: [[2, 3], [4, 5], [13, 3], [15, 5], [12, 7]] }
  paquete:
    avoid:
      - kind: esconderse
        text: 'Cerrar la puerta de las pilas y dejar que se coman unos a otros'
        skill: survival
        dc: 12
        resolves: false

encuentro:
  id: enc-saqueadores
  nombre: Los que cavan de noche
  tablero: cementerio
  acto: 1
  meta: 'Echar a los que cavan en el cementerio'
  nota: 'Unos forasteros cavan de noche en el cementerio viejo, buscando oro en las cajas. Échalos antes de que lo sepa el pueblo.'
  enemigos:
    - { bicho: saqueador, cuantos: 4, en: [[4, 3], [9, 3], [16, 3], [18, 4]] }
  paquete:
    traps:
      - name: Pala clavada
        x: 7
        y: 9
        tell: 'Un mango de pala asoma entre la hierba, con la hoja hacia arriba.'
        damage: 1d4
        spotDC: 10
        disarmDC: 8
        once: true
    avoid:
      - kind: hablar
        text: 'Decirles que en las cajas solo hay piedras, y que el mar se lleva a los que roban a los muertos'
        skill: intimidation
        dc: 12
        success:
          who: "Saqueador de tumbas"
          text: "¿Piedras…? ¿Y lo del mar? Nos vamos. Nos vamos ya, que este pueblo da miedo."
        failure:
          who: "Saqueador de tumbas"
          text: "Eso dicen todos los que quieren el oro para ellos."
      - kind: pagar
        text: 'Darles cinco monedas para el camino'
        gold: 5
        success:
          who: "Saqueador de tumbas"
          text: "Cinco monedas sin cavar más. Trato hecho. Aquí no hemos estado."
    parley:
      leader: Saqueador de tumbas
      entregarse:
        text: 'Dejarles cavar y marcharos'
        resolves: false
        success:
          who: "Saqueador de tumbas"
          text: "Así me gusta. Cada uno a lo suyo."
          effects: [{ standing: rezadoras, amount: -1 }]
      engañar:
        text: 'Gritar que el enterrador viene con la Cofradía'
        dc: 11
        resolves: true
        success:
          who: "Saqueador de tumbas"
          text: "¡La Cofradía! ¡Corred!"
        failure:
          who: "Saqueador de tumbas"
          text: "Ese viejo no sube la cuesta ni con la Cofradía empujando."

encuentro:
  id: enc-gaviotas
  nombre: Las gaviotas del faro
  tablero: faro
  acto: 1
  meta: 'Espantar a las gaviotas del huerto del faro'
  nota: 'Desde que la marea no baja, las gaviotas negras atacan a todo lo que sube a la punta. Nicasio no puede ni salir del cobertizo.'
  enemigos:
    - { bicho: gaviota-negra, cuantos: 5, en: [[3, 7], [14, 6], [12, 9], [4, 9], [13, 3]] }
  paquete:
    avoid:
      - kind: hablar
        text: 'Encender una hoguera de algas y espantarlas con el humo y a gritos'
        skill: intimidation
        dc: 12
        resolves: true

encuentro:
  id: enc-lonja
  nombre: Pelea en la lonja
  tablero: lonja
  acto: 2
  meta: 'Que los de Arenales bajen los puños'
  nota: 'Los pescadores de Arenales han cogido a un chico de Mareaviva en la lonja. Íñigo quiere que se acabe antes de que haya un muerto, y que no sea él quien pague los platos.'
  enemigos:
    - { bicho: pescador-arenales, cuantos: 3, en: [[3, 3], [8, 3], [13, 3]] }
    - { bicho: arponera-arenales, cuantos: 2, en: [[17, 4], [6, 4]] }
  paquete:
    avoid:
      - kind: hablar
        text: 'Darles la razón: en Mareaviva no se ahoga nadie, y eso no es justo'
        skill: persuasion
        dc: 13
        success:
          who: "Arponera de Arenales"
          text: "Por fin alguien de fuera lo dice. Soltad al chico. Que se vaya a contárselo a los suyos."
          effects: [{ standing: arenales, amount: 1 }]
        failure:
          who: "Arponera de Arenales"
          text: "Palabras. De Mareaviva siempre llegan palabras."
      - kind: pagar
        text: 'Pagar la ronda de toda la lonja'
        gold: 8
        success:
          who: "Arponera de Arenales"
          text: "Una ronda de Mareaviva. Ya era hora de que pagaran algo. Soltad al chico."
    parley:
      leader: Arponera de Arenales
      convencer:
        text: 'Decirles que estás aquí para averiguar por qué el mar trata distinto a los dos pueblos'
        dc: 13
        resolves: true
        success:
          who: "Arponera de Arenales"
          text: "Si lo averiguas, vuelve y nos lo cuentas. A nosotras primero."
          effects: [{ standing: arenales, amount: 1 }]
        partial:
          who: "Arponera de Arenales"
          text: "Bajad los arpones, chicas. Que hable."
        failure:
          who: "Arponera de Arenales"
          text: "Eso dijo el maestro hace siete años. Y mira cómo acabó."
      sobornar:
        text: 'Pagar los platos rotos y una ronda'
        gold: 12
        resolves: true
        success:
          who: "Arponera de Arenales"
          text: "Con eso pagamos los platos. Y la ronda nos la bebemos a tu salud."
        failure:
          who: "Arponera de Arenales"
          text: "Esto no se arregla con monedas."

encuentro:
  id: enc-cripta
  nombre: El alijo de la cripta
  tablero: cripta
  acto: 2
  meta: 'Recuperar el exvoto de la Esperanza'
  nota: 'Los contrabandistas usan la cripta de la ermita para esconder el aguardiente, y se han llevado los exvotos del osario. Engracia quiere que le devuelvas el de la Esperanza.'
  enemigos:
    - { bicho: contrabandista, cuantos: 4, en: [[2, 2], [9, 1], [16, 3], [4, 5]] }
    - { bicho: saqueador, cuantos: 1, en: [[15, 6]] }
  mision:
    objectives:
      - { type: loot, label: 'Recuperar el exvoto de la Esperanza', treasures: [Exvoto de la Esperanza] }
  paquete:
    traps:
      - name: Losa suelta
        x: 10
        y: 5
        tell: 'Una losa del pasillo cojea y tiene polvo alrededor, como si la hubieran levantado.'
        damage: 1d6
        condition: prone
        spotDC: 12
        disarmDC: 12
    avoid:
      - kind: esconderse
        text: 'Bajar sin luz y llegar al osario por detrás de los barriles'
        skill: stealth
        dc: 14
        success:
          who: "Contrabandista de la cala"
          text: "¿Has oído algo? Ratas. En esta cripta hay más ratas que muertos."
          effects: [{ give: Exvoto de la Esperanza }]
        failure:
          who: "Contrabandista de la cala"
          text: "¡Alguien ha bajado! ¡Las luces!"
    parley:
      leader: Contrabandista de la cala
      sobornar:
        text: 'Comprarles el exvoto por diez monedas'
        gold: 10
        resolves: true
        success:
          who: "Contrabandista de la cala"
          text: "Diez monedas por una barca de palo. Para ti. Y la cripta, ni la has visto."
          effects: [{ give: Exvoto de la Esperanza }]
        failure:
          who: "Contrabandista de la cala"
          text: "El Gallo nos mata si vendemos algo sin él."
      engañar:
        text: 'Decirles que las Rezadoras han maldecido lo que se sacó del osario'
        dc: 14
        resolves: true
        success:
          who: "Contrabandista de la cala"
          text: "Yo ya decía que esa barca daba mal fario. Toma, toma, quédatela."
          effects: [{ give: Exvoto de la Esperanza }]
        failure:
          who: "Contrabandista de la cala"
          text: "Las viejas maldicen mucho y no pasa nada."

encuentro:
  id: enc-bodega
  nombre: La bodega de la compuerta
  tablero: bodega
  acto: 2
  meta: 'Sacar el libro de cuentas del cofre de la bodega'
  nota: 'En la bodega de la Salazón, junto a la compuerta del mar, el capataz guarda el libro donde apunta la sal que sale de noche. Sácalo sin que te echen al agua.'
  enemigos:
    - { bicho: estibador, cuantos: 3, en: [[2, 4], [9, 3], [14, 4]] }
    - { bicho: contrabandista, cuantos: 1, en: [[12, 2]] }
  mision:
    objectives:
      - { type: loot, label: 'Llevarte el libro de cuentas', treasures: [Libro de cuentas de la Salazón] }
  paquete:
    traps:
      - name: Saco con anzuelos
        x: 5
        y: 6
        tell: 'Un saco de sal está abierto por arriba, y por el borde asoman anzuelos.'
        damage: 1d4
        condition: bleeding
        spotDC: 12
        disarmDC: 11
        once: true
    avoid:
      - kind: esconderse
        text: 'Entrar por la compuerta con la marea y esconderse entre los sacos'
        skill: stealth
        dc: 14
        success:
          who: "Estibador de la Salazón"
          text: "Aquí no hay nadie. Cerrad la compuerta y a dormir."
          effects: [{ give: Libro de cuentas de la Salazón }]
        failure:
          who: "Estibador de la Salazón"
          text: "¡Alguien ha entrado por el agua! ¡Los ganchos!"
      - kind: hablar
        text: 'Decirles que vienes de parte de la señora a revisar las cuentas'
        skill: deception
        dc: 15
        success:
          who: "Estibador de la Salazón"
          text: "Si lo manda la señora… el libro está en el cofre. Pero que conste que nosotros solo cargamos."
          effects: [{ give: Libro de cuentas de la Salazón }]
        failure:
          who: "Estibador de la Salazón"
          text: "La señora no manda a nadie. La señora manda a Antón."
    parley:
      leader: Estibador de la Salazón
      sobornar:
        text: 'Pagarles lo que les paga Antón por una noche'
        gold: 10
        resolves: true
        success:
          who: "Estibador de la Salazón"
          text: "Una noche pagada sin cargar. Coge lo que quieras, que no hemos visto nada."
          effects: [{ give: Libro de cuentas de la Salazón }]
        failure:
          who: "Estibador de la Salazón"
          text: "Antón se entera de todo."
      entregarse:
        text: 'Soltar las armas y dejar que os echen por la compuerta'
        resolves: false
        success:
          who: "Estibador de la Salazón"
          text: "Al agua, y que os lleve la marea. A vosotros sí os puede ahogar."
          effects: [{ hurt: 1d4 }]

encuentro:
  id: enc-acantilado
  nombre: El atajo del acantilado
  tablero: acantilado
  acto: 3
  meta: 'Subir por el atajo hasta lo alto del acantilado'
  nota: 'Martina te espera arriba con los de Arenales. El atajo sube desde la cala por el borde del acantilado, y los hombres del Gallo lo vigilan.'
  enemigos:
    - { bicho: contrabandista, cuantos: 4, en: [[11, 3], [14, 5], [16, 3], [9, 5]] }
  objetivo: { tipo: reach_cell, casilla: [18, 1] }
  paquete:
    traps:
      - name: Piedra suelta
        x: 12
        y: 4
        tell: 'Una piedra grande del sendero está calzada con una cuña de madera.'
        damage: 2d6
        condition: prone
        spotDC: 13
        disarmDC: 12
        once: true
    avoid:
      - kind: esconderse
        text: 'Subir pegados a la roca, por la parte que no se ve desde arriba'
        skill: stealth
        dc: 14
        success:
          who: "Contrabandista de la cala"
          text: "Nada en el atajo. Ni una cabra."
        failure:
          who: "Contrabandista de la cala"
          text: "¡Fiuuu! ¡Gente subiendo por el atajo!"
      - kind: hablar
        text: 'Decirles que el Gallo ya no manda en la cala'
        skill: intimidation
        dc: 15
        success:
          who: "Contrabandista de la cala"
          text: "Si el Gallo ya no paga, yo no vigilo. Sube, sube."
        failure:
          who: "Contrabandista de la cala"
          text: "Eso lo tendrá que decir el Gallo."
    parley:
      leader: Contrabandista de la cala
      sobornar:
        text: 'Pagar el peaje del atajo'
        gold: 8
        resolves: true
        success:
          who: "Contrabandista de la cala"
          text: "El peaje de siempre. Sube, y no mires abajo."
        failure:
          who: "Contrabandista de la cala"
          text: "Hoy el peaje es más caro. Mucho más."
```
