# Ronda 8 · Correcciones de Claude

Esta ronda no reescribe el guion: lo **corrige** para que el motor lo pueda jugar. El conversor (`tools/guion-a-paquete.mjs`) lee las rondas en orden, y un bloque de aquí con el mismo `id` que uno anterior lo cambia campo a campo. Lo que no se toca aquí se queda como lo escribió el guionista.

## Qué se ha cambiado, y por qué

**Cosas que no se podían jugar:**

- **Un hito imposible.** *El paso de los contrabandistas* pedía llegar a la mina, pero la mina solo se revelaba al cumplir ese mismo hito. Ahora la revela *La vanguardia de Keller*, junto con el campamento Keller.
- **Pedir lo que el motor no sabe mirar.** «Entregar el cáliz» pasa a ser **llegar al castillo con él**, y *El ultimátum* es una escena (se cumple al abrirse) en vez de «hablar con Lord Vane», que no tiene sentido si vas a aliarte con Keller.
- **El final elegido.** El motor no pregunta de qué lado estás: lo mira. *La última paga* se parte en dos. Una se juega en las puertas del castillo, y su final lo decide **quién os mira mejor**: Keller da *El yugo de hierro*, los Lobos *La anarquía del barro*. La otra se juega en la tienda de Keller y da *El status quo de sangre*. Y si no haces nada, **los relojes también terminan la partida**: si los Lobos o Keller cumplen su meta antes, llega su final.
- **Un encargo de la cadena del acero** mandaba al acto 1 a la mina, que no se descubre hasta el acto 2. La emboscada por el hierro pasa al bosque del Camino Viejo.
- **Objetivos que el motor no tiene**: recoger un tesoro pasa a ser llegar a su casilla; escoltar al monje y proteger a Giles pasan a ser aguantar unas rondas.

**Los tableros, redibujados.** El motor pide que el borde de cada mapa sea muro, y la mayoría eran exteriores abiertos con puertas en el borde. Están todos redibujados con la misma idea de cada uno, y hay cuatro nuevos que las localidades citaban y no existían: **las torres del peaje** (donde se juega la vanguardia, que no tenía combate), **el gran salón**, **el patio de la ermita** y **el fuego del campamento**.

**Nombres que se pisaban:** dos Elaras (la capitana y la exploradora), dos Silas (el monje y el boticario), y la capitana con el mismo nombre como persona y como bicho. La exploradora pasa a llamarse **Aldara** y el boticario **Maese Ambrosio**. Los bichos que también son gente llevan un nombre distinto del de la persona: *Capitana Keller*, *Lord Vane*, *Sombra, el espía*, *Ambrosio el Envenenador*.

**Fuera del mundo:** Grimm era bárbaro, y en 1387 no hay bárbaros: es **soldado**.

**Lo que faltaba:** el **lobo alfa** (un encuentro lo usaba y no existía), la última escena de Grimm (estaba cortada), las **cuatro habilidades nuevas** escritas en la forma del motor, los **tres finales** y los **dados** de las armas.

**Promesas que el motor no cumple:** las escenas de rango 10 prometían reglas nuevas («curará el doble», «estabiliza siempre»), y los rangos 8 hablaban de que el motivo cambia. Las escenas se quedan; las promesas, fuera.

**Relojes:** los ritmos originales (21, 14 y 28 días por segmento) hacían que ninguna facción llegara a nada en veinte horas. Ahora son 10, 6 y 8: se nota que el tiempo corre.

---

mundo:
  id: "1387"
  nombre: El valle de Vane
  genero: Histórico
  inicio: el-pueblo-de-barro
  sinopsis: >
    Un mercenario atrapado en el Valle de Vane, un rincón fronterizo olvidado, con los pasos del sur
    cerrados por una nevada que se adelantó. Sin magia, sin razas fantásticas y sin heroísmo gratis:
    cada día cuesta una ración, cada herida se infecta y la posada cobra los viernes. Tres facciones
    se despedazan por el valle —el señor de Montesclaros en su castillo, los Lobos del Bosque en la
    espesura y la Casa Keller bajando del norte— y todas necesitan una espada que se pueda comprar.

## El hilo

hito:
  id: el-caliz-ensangrentado
  pide: "ganar_tablero: enc-huida-posada"
  pista: "Te han colado el botín del asesinato. Sal vivo del cuarto: la ventana da al callejón."
  escena: >
    Viernes por la mañana, en el cuarto más barato de la posada de El Pueblo de Barro. Hoy toca pagar
    la semana y no tienes un duro. Al calzarte notas algo en el petate: un cáliz de oro macizo cubierto
    de sangre seca. No es tuyo. Abajo, gritos. El alguacil Torres y sus guardias revientan la puerta
    buscando al forastero que ha matado esta noche al recaudador de Montesclaros. Te miran a ti, miran
    el cáliz. No hay tiempo para juicios: o la ventana, o te abres paso.
  cambia:
    revela: []

hito:
  id: la-pista-en-el-barro
  cambia:
    revela: []

hito:
  id: el-invierno-cierra-el-paso
  pide: "llegar: castillo-de-vane"
  cambia:
    revela: []
  pista: "Llevar el cáliz al castillo de Vane puede comprarte el perdón y una cama caliente."

hito:
  id: la-oferta-del-castillo
  cambia:
    revela: []

hito:
  id: la-vanguardia-de-keller
  pide: "ganar_tablero: enc-vanguardia-peaje"
  cambia:
    revela: [campamento-keller, la-mina-abandonada]

hito:
  id: el-paso-de-los-contrabandistas
  cambia:
    revela: []

hito:
  id: el-asalto-al-peaje
  pide: "ganar_tablero: enc-asalto-peaje"

hito:
  id: el-ultimatum
  pide: nada
  pista: "Emisarios de los tres bandos te buscan. Elige a quién le vendes la espada."

hito:
  id: la-ultima-paga
  titulo: "La última paga: las puertas del castillo"
  pide: "ganar_tablero: enc-defensa-vane"
  pista: "Con Keller o con los Lobos, se acaba en las puertas del castillo."
  cambia:
    final: anarquia-del-barro
    final_segun:
      la-casa-keller: yugo-de-hierro
      los-lobos-del-bosque: anarquia-del-barro

hito:
  id: la-ultima-paga-norte
  acto: 3
  titulo: "La última paga: la tienda de Keller"
  abre: "tras_hito: el-ultimatum"
  pide: "ganar_tablero: enc-asalto-keller"
  pista: "Con Vane, se acaba en la tienda de mando de la Capitana."
  escena: >
    Lord Vane te da la última bolsa de plata que le queda, y no es suya. Si la Capitana Keller cae,
    el norte se retira hasta la primavera. Su tienda de mando está al otro lado del peaje.
  cambia:
    final: status-quo-de-sangre

hito:
  id: el-valle-arde
  acto: 3
  titulo: El valle arde
  abre: "reloj_lleno: los-lobos-del-bosque"
  pide: nada
  escena: >
    No ha hecho falta nadie. Los Lobos del Bosque han bajado de noche, han abierto las puertas desde
    dentro y han colgado a Lord Vane de su propio rastrillo.
  cambia:
    final: anarquia-del-barro

hito:
  id: el-yugo-llega
  acto: 3
  titulo: El yugo llega del norte
  abre: "reloj_lleno: la-casa-keller"
  pide: nada
  escena: >
    La Casa Keller no ha esperado a nadie. Sus estandartes negros ya ondean sobre El Pueblo de Barro,
    y los que no juran lealtad cuelgan de los árboles del camino.
  cambia:
    final: yugo-de-hierro

final:
  id: yugo-de-hierro
  titulo: El yugo de hierro
  escena: >
    La bandera negra ondea sobre las ruinas humeantes del castillo de Vane. La Capitana Keller te tira
    una bolsa pesada a los pies: hay más oro del que has visto en tu vida. A tu alrededor, los soldados
    de Vane cuelgan de las almenas y los campesinos reconstruyen el peaje a latigazos. Eres rico.
    Sobreviviste al invierno. Pero al salir del valle, la gente aparta la mirada: eres el mercenario que
    vendió su hogar.

final:
  id: status-quo-de-sangre
  titulo: El status quo de sangre
  escena: >
    Lord Vane tose sangre sobre sus alfombras, pero respira. Los Keller han vuelto a las montañas y los
    Lobos han caído en el bosque. Tu paga llega en un cofre de plata fina. El valle sigue siendo de los
    Montesclaros, aunque los campos estén yermos y apenas quede quien los trabaje. Has cumplido como un
    profesional. Te marchas por el paso del sur dejando atrás un cementerio gobernado por un noble
    endeudado.

final:
  id: anarquia-del-barro
  titulo: La anarquía del barro
  escena: >
    No hay reyes en el valle de Vane. Karl el Sordo y los suyos han pasado a cuchillo a los nobles y han
    echado a los invasores. El castillo es una ruina saqueada donde los campesinos se reparten el grano
    de los señores. No hay bolsa de oro para ti: un abrazo tosco, una buena armadura arrancada a un
    oficial de Keller y un caballo para cruzar el paso. Dejas atrás un lugar sin ley, libre pero
    hambriento, y una leyenda sobre el lobo solitario que destrozó una corona.

## Las facciones: relojes para veinte horas

faccion:
  id: leales-de-montesclaros
  meta: { tipo: aguantar, objetivo: el-pueblo-de-barro, ritmo_dias: 10 }

faccion:
  id: los-lobos-del-bosque
  meta: { tipo: destruir, objetivo: castillo-de-vane, ritmo_dias: 6 }

faccion:
  id: la-casa-keller
  meta: { tipo: conquistar, objetivo: el-pueblo-de-barro, ritmo_dias: 8 }

## La gente: nombres que no se pisan

pnj:
  id: lord-vane
  se_le_llama: Vane

pnj:
  id: capitana-keller
  nombre: Elara Keller
  se_le_llama: Keller

pnj:
  id: el-boticario
  nombre: Maese Ambrosio

pnj:
  id: karl-el-sordo
  se_le_llama: Karl

confidente:
  id: elara-escarcha
  nombre: Aldara

confidente:
  id: doc-silas-joven
  nombre: Arthur «Doc»

confidente:
  id: grimm-el-mudo
  clase: soldado
  escenas:
    - rango: 2
      titulo: La bolsa al sur
      escena: "Grimm es una montaña de músculos que habla con gruñidos. En la posada le ves entregar toda su semana de sueldo a un mensajero. Te mira, señala un dibujo arrugado de una mujer y tres niños, y asiente."
    - rango: 4
      titulo: La provocación
      escena: "Unos mercenarios borrachos se burlan de Grimm en la taberna y escupen sobre el dibujo de su familia. Él aprieta los puños y no hace nada, por miedo a acabar preso y no poder mandar dinero. Tú decides si pelear en su lugar o sacarlo de allí."
    - rango: 6
      titulo: El hachazo salvador
      escena: "En una emboscada, alguien va a matarte por la espalda. Grimm se interpone, se lleva el tajo en el hombro y tumba al atacante. Esa semana te cobra el doble por la herida, pero el respeto se le nota en la cara."
    - rango: 8
      titulo: La primera palabra
      escena: "Al calor de la lumbre le coses la herida del hombro y le pasas la bota de vino. Grimm bebe, te mira y, con una voz profunda como una cueva, dice: «Gracias, jefe». Es la primera vez que le oyes hablar."
    - rango: 10
      titulo: El muro de hierro
      escena: "Grimm te enseña una carta: su familia está a salvo en la capital. Ya no necesita tu plata para ellos. La dobla, se la guarda en el pecho y se pone a tu lado en la fila. «Hasta el paso», dice. Es la frase más larga que le has oído."

confidente:
  id: bran-el-viejo
  escenas:
    - rango: 8
      titulo: Una jarra por los caídos
      escena: "En la taberna de Giles, Bran gasta su paga en comprarte la mejor cerveza aguada que hay. Te jura que, aunque una semana no le pagues, su acero cubrirá tu espalda."
    - rango: 10
      titulo: La última trinchera
      escena: "Antes de la batalla final, Bran afila la espada de su hijo por última vez. Te mira a los ojos: «Hacía años que no luchaba por algo que no fuera oro. Gracias por devolverme la honra»."

confidente:
  id: elara-escarcha
  escenas:
    - rango: 10
      titulo: La guía del norte
      escena: "Con el deshielo, Aldara te entrega un mapa hecho a mano de unos pasos secretos hacia el sur. «Nadie me había seguido el ritmo nunca», dice. Es lo más parecido a un abrazo que vas a sacarle."

confidente:
  id: doc-silas-joven
  escenas:
    - rango: 10
      titulo: El juramento renovado
      escena: "Arthur tira su botella de licor al fuego de la posada. Se ajusta las gafas y jura mantenerte con vida hasta que acabe este maldito invierno. Esta vez le crees."

confidente:
  id: isolda-vane
  escenas:
    - rango: 10
      titulo: El nombre propio
      escena: "Isolda tira al río un colgante con el blasón de los Montesclaros. Renuncia al apellido y a la herencia. «Solo Isolda. Y soy de tu compañía»."

## Habilidades de trinchera, en la forma del motor

habilidad:
  id: lanzar_tierra
  name: Lanzar tierra
  description: Fango o nieve a los ojos. Sucio, pero funciona.
  cost: action
  resource: at_will
  rangeFeet: 5
  target: enemy
  resolution: save
  saveAbility: dexterity
  saveDc: 12
  condition: Blinded
  conditionRounds: 1

habilidad:
  id: romper_rodilla
  name: Romper rodilla
  description: Un golpe bajo a la articulación. Quien lo recibe acaba en el suelo.
  cost: action
  resource: short_rest
  usesPerRest: 1
  rangeFeet: 5
  target: enemy
  resolution: attack
  damage: 1d6
  damageType: Bludgeoning
  condition: Prone
  conditionRounds: 1

habilidad:
  id: grito_de_filas
  name: Grito de filas
  description: El sargento pega un grito y a un compañero se le pasa el temblor de piernas.
  cost: bonus
  resource: short_rest
  usesPerRest: 1
  rangeFeet: 30
  target: ally
  resolution: auto
  healing: 1d6+1

habilidad:
  id: trampa_de_cuerda
  name: Trampa de cuerda
  description: Un lazo escondido en la nieve. Quien lo pisa se queda enganchado.
  cost: action
  resource: short_rest
  usesPerRest: 1
  rangeFeet: 10
  target: enemy
  resolution: save
  saveAbility: dexterity
  saveDc: 12
  condition: Restrained
  conditionRounds: 1

## Bichos: el que faltaba, y nombres distintos de las personas

bicho:
  id: lobo-alfa
  nombre: Lobo alfa
  pg: 22
  ca: 13
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [romper_rodilla]
  jefe: false
  descripcion: "Más grande que los otros, con el hocico lleno de cicatrices. Los demás no comen hasta que él come."
  debilidad: "Si cae, la manada se desbanda."

bicho:
  id: capitana-keller
  nombre: Capitana Keller

bicho:
  id: lord-vane
  nombre: Lord Vane

bicho:
  id: el-espia-de-keller
  nombre: Sombra, el espía

bicho:
  id: el-boticario
  nombre: Ambrosio el Envenenador

## Los tableros, redibujados

El borde siempre es muro (roca, árboles o empalizada: lo que el sitio sea). Las mecánicas pendientes del guion se conservan.

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
    - "#######o########"
    - "#......~.......#"
    - "################"
  inicio_grupo: [[3, 5], [4, 5], [3, 6]]
  mecanica_pendiente: "La puerta de arriba está reventada; la de abajo es la ventana que da al callejón."

tablero:
  id: callejon-del-barro
  mapa:
    - "#################"
    - "#~c~~....~C...~.#"
    - "#~~......~~~~...#"
    - "#.......c...~~..#"
    - "#...C......~c~..#"
    - "#.......~~......#"
    - "#################"
  inicio_grupo: [[1, 3], [2, 3], [1, 4]]

tablero:
  id: emboscada-en-el-bosque
  mapa:
    - "#################"
    - "#.##~~~~......C.#"
    - "#.#..~c~...~..#.#"
    - "#.....~....~c.#.#"
    - "#c~...C.......~.#"
    - "#.~~.....c....~c#"
    - "#.C..~~~~.......#"
    - "#.#..~~~~~c..C..#"
    - "#.#.........~...#"
    - "#################"
  inicio_grupo: [[1, 5], [1, 6], [1, 7], [1, 4]]

tablero:
  id: los-campos-yermos
  mapa:
    - "####################"
    - "#..................#"
    - "#..~~~c......c~~~..#"
    - "#.~~C~~......~~C~~.#"
    - "#.~~~..........~~~.#"
    - "#......c....c......#"
    - "#......#D##D#......#"
    - "#......#....#......#"
    - "#......######......#"
    - "####################"
  inicio_grupo: [[8, 7], [9, 7], [10, 7], [11, 7]]

tablero:
  id: el-hielo-quebradisimo
  mapa:
    - "####################"
    - "#......~~~~~~......#"
    - "#..~~~........~~~..#"
    - "#.~~..c......c..~~.#"
    - "#~~..............~~#"
    - "#~....C..~~..C....~#"
    - "#~~.....~~~~.....~~#"
    - "#.~~~..~~~~~~..~~~.#"
    - "#.....~~~~~~~~.....#"
    - "####################"
  inicio_grupo: [[3, 4], [4, 4], [3, 5]]

tablero:
  id: galeria-de-contrabando
  mapa:
    - "##################"
    - "#..C..~~....c....#"
    - "#.....~C.........#"
    - "#...c.~~C...C....#"
    - "#C....~~....c....#"
    - "#.......~~.......#"
    - "##################"
  inicio_grupo: [[1, 2], [1, 3], [2, 3]]

tablero:
  id: barricadas-del-norte
  mapa:
    - "###################"
    - "#..c....~C~....c..#"
    - "#C..~..~~C~~..~..C#"
    - "#.C...~~..c..~~.C.#"
    - "##C.............C##"
    - "###D###########D###"
    - "#.................#"
    - "#..c.....C.....c..#"
    - "#.................#"
    - "###################"
  inicio_grupo: [[8, 8], [9, 8], [10, 8]]

tablero:
  id: el-barrizal-final
  mapa:
    - "###################"
    - "#~~~~~....c..~~~~~#"
    - "#~~~........c.~~~~#"
    - "#~~...C..~......~~#"
    - "#.....~~.~~.......#"
    - "#......~~~C.......#"
    - "#~~....c~~......~~#"
    - "#~~~~........C.~~~#"
    - "#~~~~~....c..~~~~~#"
    - "###################"
  inicio_grupo: [[8, 3], [8, 4], [11, 4]]

tablero:
  id: tienda-de-mando-keller
  mapa:
    - "#################"
    - "#C..c.......c..C#"
    - "#...............#"
    - "#...c..C.C..c...#"
    - "#...............#"
    - "##o###########o##"
    - "#.~...........~.#"
    - "#.~~.........~~.#"
    - "#...............#"
    - "#################"
  inicio_grupo: [[7, 8], [8, 8], [9, 8]]

tablero:
  id: las-puertas-del-castillo
  mapa:
    - "####################"
    - "#C.c............c.C#"
    - "##.......C.C......##"
    - "###~~~~.......~~~~##"
    - "###~~~~..c.c..~~~~##"
    - "#.......~~~~~......#"
    - "#c..C...~~~~~...C.c#"
    - "#..................#"
    - "####################"
  inicio_grupo: [[9, 7], [10, 7], [11, 7]]

tablero:
  id: el-peaje-norte
  nombre: Las torres del peaje
  localidad: el-peaje-norte
  mapa:
    - "##################"
    - "#....#......#....#"
    - "#.c..D......D..c.#"
    - "#....#......#....#"
    - "###.##......##.###"
    - "#......~~~~.....v#"
    - "#...c..~~~~..c..v#"
    - "#...............v#"
    - "#.......C.......v#"
    - "##################"
  inicio_grupo: [[6, 8], [7, 8], [9, 8]]
  mecanica_pendiente: "Desde lo alto de las torres se debería disparar con ventaja (altura). El lado este ya cae al desfiladero (v): a quien empujan allí, se acabó."

tablero:
  id: el-gran-salon
  nombre: El gran salón de Vane
  localidad: castillo-de-vane
  mapa:
    - "##################"
    - "#C..............C#"
    - "#................#"
    - "#..c..........c..#"
    - "#....cccccccc....#"
    - "#....cccccccc....#"
    - "#..c..........c..#"
    - "#................#"
    - "#C..............C#"
    - "##################"
  inicio_grupo: [[8, 7], [9, 7]]

tablero:
  id: el-patio-de-la-ermita
  nombre: El patio de la ermita
  localidad: la-ermita-derruida
  mapa:
    - "################"
    - "#C....#..#....C#"
    - "#.....#..#.....#"
    - "#..c........c..#"
    - "#......~~......#"
    - "#..c........c..#"
    - "#.....#..#.....#"
    - "#.....#..#.....#"
    - "################"
  inicio_grupo: [[7, 3], [8, 3]]

tablero:
  id: el-fuego-del-campamento
  nombre: El fuego del campamento
  localidad: campamento-furtivo
  mapa:
    - "##################"
    - "#~~c....~~....c~~#"
    - "#~..............~#"
    - "#..C...c..c...C..#"
    - "#......~~~~......#"
    - "#......~~~~......#"
    - "#..C...c..c...C..#"
    - "#~..............~#"
    - "#~~c....~~....c~~#"
    - "##################"
  inicio_grupo: [[8, 2], [9, 2]]

## Los encuentros: nombres de tablero, sitios y objetivos que el motor sabe mirar

encuentro:
  id: enc-huida-posada
  nombre: El cuarto de la posada
  acto: 1
  enemigos:
    - { bicho: guardia-desnutrido, cuantos: 2, en: [[6, 3], [8, 3]] }
    - { bicho: alguacil-torres, cuantos: 1, en: [[7, 3]] }
  objetivo: { tipo: reach_cell, casilla: [7, 9] }
  meta: Salir por la ventana

encuentro:
  id: enc-emboscada-bosque
  nombre: Los claros del Camino Viejo
  acto: 1
  enemigos:
    - { bicho: furtivo-veterano, cuantos: 2, en: [[3, 2], [13, 2]] }
    - { bicho: campesino-desesperado, cuantos: 3, en: [[6, 5], [8, 5], [10, 5]] }

encuentro:
  id: enc-los-falsos-desertores
  nombre: La granja quemada
  acto: 1

encuentro:
  id: enc-emboscada-por-el-hierro
  nombre: El hierro en el bosque
  tablero: emboscada-en-el-bosque
  acto: 1
  enemigos:
    - { bicho: furtivo-veterano, cuantos: 2, en: [[3, 2], [13, 2]] }
    - { bicho: lobo-hambriento, cuantos: 2, en: [[6, 6], [10, 6]] }
  objetivo: { tipo: reach_cell, casilla: [14, 8] }
  meta: Llegar a la carga de lingotes
  nota: "Acto 1 (encargo). La carga robada está al fondo del claro: llegar a ella con los Lobos encima."

encuentro:
  id: enc-pelea-callejon
  nombre: El callejón inundado
  acto: 2

encuentro:
  id: enc-asedio-a-la-granja
  nombre: El asedio de la granja
  acto: 2

encuentro:
  id: enc-escolta-quebradiza
  nombre: El monje sobre el hielo
  acto: 2
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Cubrir al monje mientras cruza
  nota: "Acto 2 (encargo). El hielo cruje y los lobos rodean al monje: aguantar cuatro rondas mientras cruza."

encuentro:
  id: enc-patrullas-en-la-nieve
  nombre: Las empalizadas del peaje
  acto: 2
  enemigos:
    - { bicho: furtivo-veterano, cuantos: 3, en: [[1, 3], [9, 3], [17, 3]] }

encuentro:
  id: enc-carreta-en-el-hielo
  nombre: La carreta hundida
  acto: 2
  objetivo: { tipo: reach_cell, casilla: [10, 5] }
  meta: Llegar a la carreta de las hierbas

encuentro:
  id: enc-espia-mina
  nombre: Los túneles de la mina
  acto: 2

encuentro:
  id: enc-vanguardia-peaje
  nombre: La vanguardia en el peaje
  tablero: el-peaje-norte
  acto: 2
  enemigos:
    - { bicho: recluta-keller, cuantos: 3, en: [[3, 1], [14, 1], [8, 2]] }
    - { bicho: infanteria-pesada-keller, cuantos: 1, en: [[9, 3]] }
  objetivo: { tipo: eliminate_all }
  meta: Recuperar el peaje
  nota: "Acto 2 (hilo). La vanguardia de Keller ha tomado las torres. Son profesionales y te superan en número."

encuentro:
  id: enc-asalto-peaje
  nombre: El asalto de las empalizadas
  acto: 2

encuentro:
  id: enc-frenar-la-carreta
  nombre: El cruce inundado
  acto: 3

encuentro:
  id: enc-asalto-keller
  nombre: La tienda de mando
  acto: 3

encuentro:
  id: enc-defensa-vane
  nombre: Las puertas del castillo
  acto: 3

encuentro:
  id: enc-emboscada-lobos-alfa
  nombre: Lobos en el pueblo
  acto: 3
  objetivo: { tipo: survive_rounds, rondas: 4 }
  meta: Aguantar hasta que llegue la guardia
  nota: "Acto 3 (libre). El hambre mete a los lobos en el pueblo. Hay que aguantar en el callejón, con Giles detrás."

## Los encargos: la cadena del acero, en el bosque

encargo:
  id: e-acero-robado-2
  donde: el-camino-viejo

## Los dados de las armas

objeto:
  id: espada-forjada-a-medida
  dados: 1d8

objeto:
  id: el-arpon-de-finn
  dados: 1d6

objeto:
  id: espada-mellada
  dados: 1d6

objeto:
  id: hacha-de-lenador
  dados: 1d8

objeto:
  id: daga-de-parada
  dados: 1d4
