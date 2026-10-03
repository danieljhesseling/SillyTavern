# Las tierras del ocaso — ronda 1: la biblia, el mundo y los sitios

> Escrita por Claude (tanda 20, 2026-10-03) como la escribiría el Gem guionista: prosa para entenderla y bloques YAML para el conversor (`node tools/guion-a-paquete.mjs wiki/guiones/ocaso`). Lo que el conversor no tiene con nombre propio va en `paquete:`, con la forma del paquete (wiki/GEM_CREAR_CAMPANA_ANEXO.md).

## La premisa y el tono

El reino no se cae de golpe: se cae porque nadie repara los puentes. El rey ha muerto sin heredero, el consejo no se pone de acuerdo y el invierno llega un mes antes de tiempo. Tres casas grandes corren hacia el mismo sitio: la Atalaya de la Grulla, la fortaleza enana que cierra el único paso de la montaña.

Una carta vieja, la **Carta del Paso**, dice que quien encienda el fanal de la Atalaya con su bandera colgada manda en el paso hasta el deshielo. Por ese paso sube y baja el grano de medio reino. Quien manda en el paso decide quién come este invierno, y nadie vota en primavera contra quien le ha dado de comer.

El tono es de fantasía épica que pesa por la política: tratos, deudas, lealtades compradas y caminos largos. El ambiente lo dice quien lleva las cuentas, seco y preciso: la posadera que cobra cada cama, la señora que sabe lo que debe a la última moneda, la refugiera que mide el tiempo en nevadas.

## Lo que este mundo no tiene

- No hay un señor oscuro ni un dragón: el enemigo es el invierno y la ambición de la gente.
- La magia existe, pero es rara y cara. Los magos son gente de oficio (una constructora de puentes, un chamán trasgo), no ejércitos.
- No hay dioses que bajen a ayudar. Hay ermitaños que guardan libros y tumbas.
- Nada se mueve solo: las casas no conquistan sitios por su cuenta (D-J58). Lo que cuenta es cómo te miran, y eso lo cambian tus decisiones.

## El conflicto

- **Casa Brezo** (las tierras altas, Torre Brezo): Doña Ilduara de Brezo, viuda, lleva las cuentas ella misma. Debe dinero a todo el mundo. Si tiene el paso, las tierras altas comerán, y las bajas pagarán el grano a precio de hambre.
- **Casa Oramar** (el río, Vadoancho): Don Tristán Oramar compra lo que haga falta, también las deudas de Brezo. Si tiene el paso, pasará quien pague, y pagará todo el mundo.
- **Casa Hondaroca** (los enanos de Las Forjas): construyeron la Atalaya y la perdieron hace sesenta años. La thane Dagna quiere oro, no piedras viejas; su sobrina Gudrun quiere volver a cerrar la puerta de su abuelo, igual para todos.
- **La Compañía del Cierzo**: mercenarios de capa gris que cobran de las tres casas a la vez. Su capitán, Bermudo Lanzagrís, quiere encender el fanal con su propia bandera y ser la cuarta casa.

## La gente principal

- **Rufino Albarda**, notario del rey: lleva la Carta y el Sello de la Grulla, el anillo que abre la puerta de la Atalaya.
- **Ilvana Hojarrubia**, elfa, guía de las Sendas Viejas: alguien ha vendido el mapa de esas sendas, y ella sabe que fue su hermano.
- **Ruy Zarzal**, semiorco, desertor de Brezo: no quiso quemar una aldea con la gente dentro.
- **Gudrun Hondaroca**, enana, clériga: nieta del último thane de la Atalaya.
- **Pía Rueda**, gnoma, maga y constructora del puente de Tres Mojones.
- **Telmo Avellano**, mediano, contrabandista del paso durante veinte inviernos.

## La mecha

Llegas a Tres Mojones el día en que se parte el puente. El carro del notario del rey se queda colgando sobre el río, y unos hombres de capa gris saltan a por el cofre que lleva. Dentro van la Carta del Paso y el Sello de la Grulla. Alguien ha serrado el puente para que ese carro no llegue nunca a la Atalaya.

mundo:
  id: ocaso
  nombre: Las tierras del ocaso
  genero: Fantasía épica
  inicio: tres-mojones
  estacion: otono
  sinopsis: >
    El reino no se cae de golpe: se cae porque nadie repara los puentes. El rey ha muerto sin
    heredero, el invierno llega un mes antes y las tres casas grandes —Brezo, Oramar y Hondaroca—
    corren hacia el mismo sitio: la Atalaya de la Grulla, la fortaleza enana que cierra el único
    paso de la montaña. Una carta vieja dice que quien encienda allí el fanal manda en el paso
    hasta el deshielo, y quien manda en el paso decide quién come este invierno. Llegas a Tres
    Mojones el día en que se parte el puente, con el notario del rey encima.
  presagio:
    - frase: Las tres casas te ofrecerán algo por el sello. Al final tendrás que elegir una bandera.
      se_cumple: m-consejo
    - frase: Los de capa gris cobran de todos y no sirven a nadie.
      se_cumple: m-libro
  paquete:
    world:
      levels: [1, 5]
      journey:
        days: 5
        how: Subís hacia las tierras altas por calzadas viejas y puentes que ya nadie repara.
    plot:
      chapters:
        - act: 1
          title: El puente roto
          summary: En Tres Mojones se ha caído el puente con el notario del rey encima. Alguien lo ha serrado, y lo que llevaba el notario lo quieren las tres casas.
        - act: 2
          title: Las tres casas
          summary: Oramar compra, Brezo debe y Hondaroca duda. Antes de subir al paso tienes que saber quién paga a los de capa gris.
        - act: 3
          title: La subida
          summary: El invierno se adelanta. Los del Cierzo tienen un mapa de las Sendas Viejas y quieren llegar los primeros a la Atalaya.
        - act: 4
          title: El fanal
          summary: Quien encienda el fanal de la Atalaya manda en el paso todo el invierno. Tú llevas el sello, y tú eliges la bandera.

## Las casas (solo reputación, D-J58)

Lo que cuenta de cada casa es cómo te mira. La mueven los hitos del hilo (ganar la cámara de Fullero, defender la puerta de las Forjas, la bandera que eliges) y decide el final: el fanal se enciende con la bandera de la casa que mejor te mire. Un camino también la mira: los guardias de Hondaroca no dejan bajar a sus minas a quien no es amigo del clan.

faccion:
  id: casa-brezo
  nombre: Casa Brezo
  sede: torre-brezo
  controla: [torre-brezo]
  enemigos: [casa-oramar]
  meta: { tipo: conquistar, objetivo: la-atalaya, ritmo_dias: 21 }
  si_la_cumple: Brezo cierra el paso a las tierras bajas y les vende el grano a precio de hambre.
  reputacion_inicial: 0
  magia: tolera

faccion:
  id: casa-oramar
  nombre: Casa Oramar
  sede: vadoancho
  controla: [vadoancho]
  enemigos: [casa-brezo]
  meta: { tipo: conquistar, objetivo: la-atalaya, ritmo_dias: 21 }
  si_la_cumple: Oramar abre el paso a quien pague, y pone precio a la sal y al grano de todo el reino.
  reputacion_inicial: 0
  magia: comercia

faccion:
  id: casa-hondaroca
  nombre: Casa Hondaroca
  sede: forjas-de-hondaroca
  controla: [forjas-de-hondaroca]
  enemigos: []
  meta: { tipo: recuperar, objetivo: la-atalaya, ritmo_dias: 28 }
  si_la_cumple: Los enanos vuelven a la Atalaya y la guardan igual para todas las casas, como dice la Carta.
  reputacion_inicial: 0
  magia: tolera

## Las localizaciones

Trece. Diez se ven al empezar; tres se descubren: el campamento del Cierzo (por el libro de Fullero o por lo que se oye en la calzada y en Torre Brezo), la mina de la Boca del Grajo (al defender las Forjas, o por lo que cuenta el archivero) y las Sendas Viejas (si la guardiana de las Hayas confía en ti). En cada una hay alguien con quien hablar, algo que mirar y algo que se oye. Lo que se ve al mirar lo dice alguien de allí.

localidad:
  id: tres-mojones
  nombre: Tres Mojones
  tipo: village
  bioma: valle
  faccion: casa-oramar
  descripcion: Un cruce de caminos donde se tocan las tierras de las tres casas, con una posada, una herrería y un puente de madera sobre el río. Desde hoy, medio puente.
  caminos:
    - { a: los-sauces, dias: 1 }
    - { a: la-calzada-rota, dias: 1 }
    - { a: torre-brezo, dias: 2 }
  servicios: [posada, herreria, tienda, tablon]
  paquete:
    places:
      - { kind: posada, name: La Posada de los Mojones, keeper: Brígida Cantueso }
      - { kind: herreria, name: La herrería de Ottar, keeper: Ottar Brasa }
      - { kind: muelle, name: La barca, keeper: Anselmo Rejas }
      - { kind: tablon }
      - { kind: plaza, name: El cruce }
    sights:
      - verbo: examinar
        text: los pilares del puente caído
        skill: investigation
        found: "La constructora se agacha a tu lado y señala los cortes: «Mira. Liso por debajo, astillado por arriba. Lo serraron desde una barca.»"
      - verbo: mirar
        text: la barca del barquero
        skill: perception
        place: muelle
        found: "El barquero se pone delante, pero ya lo has visto: hay serrín entre las redes. «Será de las vigas, que flotan», dice sin mirarte."
      - verbo: leer
        text: la pizarra de cuentas de la posada
        skill: investigation
        place: posada
        found: "La posadera da dos golpes en la pizarra: «Tres camas pagadas con monedas nuevas de Vadoancho. Recién acuñadas. Aquí nadie tiene monedas nuevas.»"

localidad:
  id: los-sauces
  nombre: Los Sauces
  tipo: village
  bioma: rio
  faccion: casa-brezo
  descripcion: Una aldea de molineros entre sauces, con más sacos de grano que casas. Las tres casas cuentan sus sacos, y ninguna los paga.
  caminos:
    - { a: vadoancho, dias: 1 }
  servicios: [posada, tienda]
  paquete:
    places:
      - { kind: tienda, name: El molino, keeper: Pascual Trigo }
      - { kind: posada, name: La era }
      - { kind: plaza, name: La plaza de los sacos }
    sights:
      - verbo: mirar
        text: las huellas de carro junto al río
        skill: perception
        found: "La alcaldesa se agacha contigo: «Carro pesado, cuatro mulas, de noche. Y mira lo que se les cayó.» Es una sierra de dos manos con el mango pintado de gris."
      - verbo: examinar
        text: los sacos del molino
        skill: investigation
        place: tienda
        found: "El molinero se pone nervioso: «Esos sacos son... son de semilla. Bueno, no. Son para el invierno. No se lo digáis a nadie, por favor.»"

localidad:
  id: la-calzada-rota
  nombre: La Calzada Rota
  tipo: wilderness
  bioma: valle
  descripcion: La calzada vieja del rey, empedrada hace doscientos años. En un tramo se ha hundido el terraplén y el camino va pegado al barranco.
  caminos:
    - { a: vadoancho, dias: 1 }
  paquete:
    sights:
      - verbo: examinar
        text: los mojones caídos de la calzada
        skill: investigation
        found: "El caminero pasa la mano por la piedra: «Este marca seis leguas a Vadoancho. Lo puso el abuelo del rey. Desde entonces nadie lo ha vuelto a poner en pie.»"
      - verbo: mirar
        text: el terraplén hundido
        skill: survival
        found: "El caminero no levanta la vista: «Se hundió con las lluvias. Pedí piedra a las tres casas. Me mandaron una carta cada una. Las cartas no sostienen nada.»"

localidad:
  id: vadoancho
  nombre: Vadoancho
  tipo: city
  bioma: rio
  faccion: casa-oramar
  descripcion: La ciudad del río y de la sal, sede de Casa Oramar. Muelles llenos de barcos que no salen, y una casa de préstamos con la puerta más gruesa que la del templo.
  caminos:
    - { a: torre-brezo, dias: 2 }
  servicios: [posada, herreria, tienda, templo, tablon]
  paquete:
    places:
      - { kind: muelle, name: El muelle de la sal, keeper: Lupe Garbanzo }
      - { kind: tienda, name: La casa de préstamos, keeper: Marcos Fullero }
      - { kind: templo, name: El templo de la Ribera, keeper: Madre Orosia }
      - { kind: posada, name: El Sollo }
      - { kind: plaza, name: La plaza de Oramar }
    sights:
      - verbo: mirar
        text: los barcos amarrados en el muelle
        skill: perception
        place: muelle
        found: "La mercader de sal cuenta en voz alta: «Seis barcos de Oramar cargados de grano, y ninguno sale. Esperan a ver quién gana el paso para poner el precio.»"
      - verbo: examinar
        text: la puerta del canal de la casa de préstamos
        skill: investigation
        found: "Un mediano con ganzúas al cuello te susurra al pasar: «Cerradura de las caras, bisagra de las baratas. Siempre pasa.»"
      - verbo: leer
        text: la lista de huérfanos en la puerta del templo
        skill: investigation
        place: templo
        found: "La sacerdotisa te enseña la lista: «Cuarenta y dos nombres. Los de abajo son de la última guerra de las casas. Los de arriba, de este otoño.»"

localidad:
  id: torre-brezo
  nombre: Torre Brezo
  tipo: outpost
  bioma: montaña
  faccion: casa-brezo
  descripcion: Una torre cuadrada sobre un brezal morado, con el granero medio vacío y la mitad de los soldados que tenía el año pasado.
  caminos:
    - { a: las-hayas-rojas, dias: 1 }
    - { a: forjas-de-hondaroca, dias: 2 }
  servicios: [posada, herreria, tablon]
  paquete:
    places:
      - { kind: posada, name: La cocina de la torre, keeper: Ordoño Galindo }
      - { kind: plaza, name: El patio de armas }
      - { kind: tablon }
    sights:
      - verbo: leer
        text: el libro de raciones de la torre
        skill: investigation
        place: posada
        found: "El castellano suspira: «Media ración desde agosto. Si el invierno es largo, a cuarto. Y luego, a nada.»"
      - verbo: mirar
        text: el nombre picado en la puerta del cuartel
        skill: perception
        found: "La pastora grita desde el patio: «¡Ahí ponía «sargento Zarzal»! ¡Lo picaron cuando no quiso quemar Los Brezales!»"

localidad:
  id: las-hayas-rojas
  nombre: Las Hayas Rojas
  tipo: sanctuary
  bioma: bosque
  descripcion: Un hayedo élfico en la ladera. Las hojas se han puesto rojas un mes antes de tiempo, y los elfos lo miran preocupados.
  caminos:
    - { a: forjas-de-hondaroca, dias: 2 }
    - { a: las-sendas-viejas, dias: 1 }
  servicios: [templo]
  paquete:
    sights:
      - verbo: examinar
        text: las marcas talladas en las hayas
        skill: survival
        found: "La guardiana pasa los dedos por las marcas: «Cada marca, un camino. Esta la tallé yo. Para mí fue ayer; para tu abuela, antes de nacer.»"
      - verbo: mirar
        text: las huellas de botas herradas en el musgo
        skill: perception
        found: "La guardiana frunce el ceño: «Botas de soldado. Aquí nadie camina con botas de soldado. Han estado buscando el comienzo de las Sendas.»"

localidad:
  id: forjas-de-hondaroca
  nombre: Las Forjas de Hondaroca
  tipo: city
  bioma: montaña
  faccion: casa-hondaroca
  descripcion: La ciudad enana excavada en el flanco de la montaña, con una puerta grande de hierro y forjas que no se apagan nunca. Hace sesenta años que su clan no pisa la Atalaya.
  caminos:
    - a: boca-del-grajo
      dias: 1
      paquete:
        opensWith: [{ standing: casa-hondaroca, min: 1 }]
        gateNote: Los guardias enanos no dejan bajar a las minas a quien no es amigo del clan.
    - { a: ermita-del-collado, dias: 1 }
  servicios: [posada, herreria, tienda, templo]
  paquete:
    places:
      - { kind: herreria, name: La forja grande }
      - { kind: templo, name: El santuario del yunque }
      - { kind: posada, name: La cervecería de la puerta }
      - { kind: plaza, name: La sala del consejo }
    sights:
      - verbo: leer
        text: la placa de la puerta grande
        skill: investigation
        found: "El archivero lee en voz alta, encantado: «Aquí no se cierra la puerta a quien llega con hambre». Luego baja la voz: «Lo grabó mi tatarabuela. Hace años que no se cumple.»"
      - verbo: examinar
        text: las marcas de garras en la puerta grande
        skill: survival
        found: "La thane escupe al suelo: «Trasgos. Y estas otras, de botas. Los trasgos no llevan botas. Alguien viene con ellos.»"

localidad:
  id: boca-del-grajo
  nombre: La Boca del Grajo
  tipo: dungeon
  bioma: cueva
  escondida: true
  descripcion: La mina vieja del clan Hondaroca, abandonada desde que se agotó la veta. Ahora huele a trasgo y las paredes están cubiertas de un hielo que no es de la montaña.
  caminos:
    - { a: ermita-del-collado, dias: 1 }
  paquete:
    sights:
      - verbo: examinar
        text: las paredes heladas del túnel
        skill: investigation
        found: "La minera da un golpe con el nudillo: «Este hielo no es de la montaña. Es de conjuro. Alguien lo está haciendo crecer.»"
      - verbo: mirar
        text: el pozo viejo del fondo
        skill: perception
        found: "La minera te sujeta del brazo: «Cuarenta varas hasta el agua. Lo sé porque se me cayó el casco una vez, y todavía lo estoy esperando.»"

localidad:
  id: ermita-del-collado
  nombre: La Ermita del Collado
  tipo: sanctuary
  bioma: montaña
  descripcion: Una ermita de piedra en el collado, con un cementerio enano detrás. Durante siglos, sus frailes apuntaron lo que pagaba cada carro que subía al paso.
  caminos:
    - { a: campamento-del-cierzo, dias: 1 }
    - { a: refugio-de-la-cabra, dias: 1 }
  servicios: [templo]
  paquete:
    places:
      - { kind: templo, name: La ermita, keeper: Fray Odón }
      - { kind: plaza, name: El cementerio enano }
    sights:
      - verbo: examinar
        text: las tumbas enanas del cementerio
        skill: investigation
        place: plaza
        found: "El ermitaño te sigue entre las lápidas: «Esta es la del último thane de la Atalaya. La tierra está removida. Alguien ha cavado de noche, que la piedra se lo perdone.»"
      - verbo: leer
        text: los libros de peaje de la ermita
        skill: investigation
        place: templo
        found: "El ermitaño abre un libro gordo: «Aquí apuntaban mis hermanos lo que pagaba cada carro. Brezo, Oramar, los enanos... todos lo mismo. Hace sesenta años.»"

localidad:
  id: campamento-del-cierzo
  nombre: El Campamento del Cierzo
  tipo: camp
  bioma: bosque
  escondida: true
  descripcion: Una empalizada de troncos bajo el collado, con tiendas grises y el humo de veinte hogueras. Aquí espera la Compañía del Cierzo antes de subir al paso.
  caminos:
    - { a: refugio-de-la-cabra, dias: 1 }
  paquete:
    sights:
      - verbo: examinar
        text: las tiendas de los oficiales
        skill: investigation
        found: "Un mercenario borracho te confunde con uno de los suyos: «La de la sargento es la de la derecha. Allí guarda lo que no quiere que vea el capitán.»"
      - verbo: mirar
        text: la empalizada del lado del arroyo
        skill: perception
        found: "Un centinela se queja a otro: «La brecha del arroyo la tenía que tapar alguien. Yo no, desde luego.»"

localidad:
  id: refugio-de-la-cabra
  nombre: El Refugio de la Cabra
  tipo: outpost
  bioma: nieve
  descripcion: "El último techo antes del paso: una casa de piedra con corral, leña para un mes y una campana para las ventiscas. Alrededor acampan las vanguardias de las tres casas."
  caminos:
    - { a: la-atalaya, dias: 1, cerrado_hasta: m-consejo }
  servicios: [posada, herreria, tablon]
  paquete:
    places:
      - { kind: posada, name: El refugio, keeper: Nieves Albar }
      - { kind: plaza, name: Los campamentos de las casas }
    sights:
      - verbo: mirar
        text: el cielo sobre el paso
        skill: survival
        found: "La refugiera mira contigo: «Nubes de panza gris. Esta noche, nieve hasta la rodilla. Mañana, hasta la cintura.»"
      - verbo: examinar
        text: el corral vacío de las mulas
        skill: investigation
        found: "El arriero escupe: «Doce mulas. Me dejaron un pagaré del Cierzo. Un pagaré. ¿Para qué quiero yo un papel en la montaña?»"

localidad:
  id: la-atalaya
  nombre: La Atalaya de la Grulla
  tipo: ruins
  bioma: nieve
  descripcion: La fortaleza enana que cierra el paso, con su puerta de hierro, su patio helado y, en lo alto, el fanal que se ve desde todo el valle. Desde hace un día, la bandera gris del Cierzo ondea en la muralla.
  paquete:
    sights:
      - verbo: examinar
        text: la puerta enana de la torre
        skill: investigation
        found: "Desde la muralla, el capitán del Cierzo te saluda con la mano: «Sin el sello, esa puerta no se abre ni a golpes. Lo he probado. Con mucho cariño.»"
      - verbo: mirar
        text: el fanal apagado en lo alto
        skill: perception
        found: "El capitán se ríe desde arriba: «Leña seca para tres noches. La subí yo. Si quieres encenderlo, tendrás que subir a pedírmela.»"

localidad:
  id: las-sendas-viejas
  nombre: Las Sendas Viejas
  tipo: wilderness
  bioma: bosque
  escondida: true
  descripcion: Los caminos que los elfos trazaron hace tres siglos por la ladera, marcados con piedras que señalan la siguiente. Suben al paso en la mitad de días que la calzada.
  caminos:
    - { a: refugio-de-la-cabra, dias: 1 }
  paquete:
    sights:
      - verbo: examinar
        text: las piedras-guía del sendero
        skill: survival
        found: "Un elfo flaco que vigila el sendero te ve mirar: «Cada piedra señala la siguiente. Si sabes leerlas, llegas al paso en dos días. Si no, te mueres en uno.»"
      - verbo: mirar
        text: el campamento abandonado entre las rocas
        skill: perception
        found: "El elfo se encoge de hombros: «Lo dejó el Cierzo. Comieron, durmieron y pagaron. A mí. Alguien tenía que cobrar.»"
