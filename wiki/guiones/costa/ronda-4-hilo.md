# La costa que no duerme — ronda 4: el hilo, hablado

Diecisiete hitos en cuatro actos, más uno escondido. Cada escena es una conversación entre gente con
retrato (D-J60): no hay narrador. Nadie se nombra antes de presentarse (J13.7). Las decisiones que
pesan vuelven después: en la escena siguiente (un `alt` con `chose`) o días más tarde (`later`).

- Los hitos que piden **llegar** a un sitio cuentan su escena al llegar.
- Los demás la cuentan al abrirse, donde esté el grupo: por eso alguien viene a buscarte.
- Los tres finales se abren a la vez, en la pared del Bajo, y cada uno lo dice quien lo defiende.

```yaml
hito:
  id: la-nina-del-muelle
  acto: 1
  titulo: La niña del muelle
  abre: al_empezar
  pide: 'hablar_con: maite'
  cambia:
    abre_hito: lo-que-no-se-cuenta
  pista: 'Ve a El Remo Seco, la posada: la posadera lleva la lista de la Vela.'
  escena: 'Llegas a Mareaviva al caer la tarde. En el muelle, la maestra que escribió al gremio te enseña a una niña en camisón que camina dormida hacia el agua y se mete en el mar sin que nadie corra a por ella. La niña sale sola, empapada, y dice con una voz que no es la suya que falta uno.'
  paquete:
    backdrop: muelle
    beats:
      - who: Begoña Larrea
        mood: triste
        text: '¿Vienes del gremio? Soy Begoña, la maestra. Fui yo quien escribió la carta. Has llegado justo a tiempo, por desgracia.'
      - who: Begoña Larrea
        mood: enfadado
        text: 'Mira al final del muelle. Esa niña en camisón es Uxue, alumna mía. Va dormida, y va derecha al agua.'
        presenta: uxue
        options:
          - id: muelle-tirarse
            text: 'Corro y me tiro al agua a por ella.'
            check:
              skill: athletics
              dc: 12
              success:
                reply:
                  who: Uxue Lasarte
                  mood: triste
                  text: 'Suéltame. No me ahogo. Aquí no se ahoga nadie.'
              failure:
                reply:
                  who: Begoña Larrea
                  mood: triste
                  text: '¡Cuidado, que está helada! …Mira. Ya sale ella sola. Siempre sale sola.'
          - id: muelle-mirar
            text: 'Me quedo {quieto|quieta} y miro qué hace la gente del muelle.'
            check:
              skill: insight
              dc: 11
              success:
                effects:
                  - clue: 'En el muelle nadie se ha movido para ayudar a la niña. Los pescadores miraban a otro lado, como quien ve llover.'
                reply:
                  who: Ciriaco Etxanobe
                  text: 'No te apures, {forastero|forastera}. Aquí no se ahoga nadie. Hace treinta años que no.'
              failure:
                reply:
                  who: Begoña Larrea
                  mood: enfadado
                  text: '¿Lo ves? Ni uno se ha movido. Ni uno.'
          - id: muelle-rezar
            text: 'Rezo en voz alta por la niña.'
            if: { class: Clérigo }
            reply:
              who: Ciriaco Etxanobe
              mood: triste
              text: 'Reza si quieres. La iglesia lleva cinco años vacía, y lo que se la lleva no te va a oír.'
      - who: Uxue Lasarte
        mood: triste
        text: 'Falta uno. Os lo dijimos. Falta uno, y nos lo debéis.'
      - who: Ciriaco Etxanobe
        text: 'No le hagáis caso. Habla dormida. Mañana no se acordará de nada.'
      - who: Begoña Larrea
        mood: enfadado
        text: 'Es la cuarta noche esta semana, y ya van cuatro niños. Aquí todo el mundo lo ve y nadie hace nada.'
      - who: Begoña Larrea
        text: 'Ve a El Remo Seco, la posada. La posadera, Maite, lleva la lista de quién vela cada noche. A mí no me la cuenta.'
        presenta: maite

hito:
  id: lo-que-no-se-cuenta
  acto: 1
  titulo: Lo que no se cuenta
  abre: 'tras_hito: la-nina-del-muelle'
  pide: 'hablar_con: ciriaco'
  cambia:
    abre_hito: la-vela
  pista: 'Ve al Embarcadero Viejo y habla con el pescador viejo que vela casi todas las noches. Por el camino, mira lo que el pueblo calla: el libro de la iglesia, los niños del muelle, las huellas de la playa.'
  escena: 'En la posada, la posadera te habla de la Vela: cada noche alguien se sienta en el embarcadero viejo y habla hasta que amanece. El patrón mayor de la Cofradía te ofrece el carro de mañana para que te vayas. Si quieres entender qué pasa, tendrás que preguntarle al pescador viejo que vela en el embarcadero.'
  paquete:
    backdrop: posada
    beats:
      - who: Maite Ugarte
        text: 'Siéntate, criatura, que de pie se piensa peor. Soy Maite. ¿Te manda la maestra? Ya me lo imaginaba.'
      - who: Maite Ugarte
        mood: triste
        text: '¿Ves esa lista de la pared? Es la Vela. Cada noche, un nombre. Alguien se sienta en el embarcadero viejo y habla hasta que amanece.'
        alt:
          - if: { background: marinero }
            mood: triste
            text: '¿Ves esa lista de la pared? Es la Vela. Tú tienes manos de pescar, así que lo entenderás: cada noche alguien se sienta en el embarcadero viejo y le habla al mar hasta que amanece.'
      - who: Jacinto Larrañaga
        mood: enfadado
        text: 'Maite. A la gente de fuera no se le cuentan las cosas de casa.'
      - who: Jacinto Larrañaga
        text: 'Jacinto Larrañaga, patrón mayor de la Cofradía. La maestra te ha llamado sin preguntar a nadie. Mañana sale el carro de la sal hacia la ciudad, y hay sitio.'
        alt:
          - if: { chose: muelle-tirarse }
            text: 'Jacinto Larrañaga, patrón mayor de la Cofradía. Ya me han dicho que te has tirado al agua por la niña. No hacía falta: aquí no se ahoga nadie. Mañana sale el carro de la sal hacia la ciudad, y hay sitio.'
        options:
          - id: posada-quedarse
            text: 'Me iré cuando sepa por qué una niña se mete en el mar dormida.'
            effects:
              - attitude: -1
            reply:
              who: Jacinto Larrañaga
              mood: enfadado
              text: 'Entonces no te irás nunca. Nosotros no hablamos de eso. Nosotros pescamos.'
          - id: posada-cobrar
            text: '¿Cuánto paga la Cofradía por que me vaya?'
            effects:
              - gold: 15
              - attitude: -1
                who: Maite Ugarte
            reply:
              who: Jacinto Larrañaga
              text: 'Quince monedas, y el carro de mañana. Ni una pregunta más.'
            later:
              days: 2
              on: siempre
              name: Las quince monedas
              text: 'Jacinto Larrañaga te corta el paso en la plaza: «Te pagamos para que te fueras, y sigues aquí.»'
              who: "Jacinto Larrañaga"
              options:
                - label: 'Devolverle las quince monedas'
                  cost: { oro: 15 }
                  effects: ['faccion:+1']
                  then: "Al menos eres {honrado|honrada}."
                - label: 'Quedártelas y seguir a lo tuyo'
                  effects: ['fama:-1']
                  then: "Pues que lo sepa todo el pueblo."
          - id: posada-preguntar
            text: 'Le pregunto a Maite, en voz baja, a quién le toca velar esta noche.'
            effects:
              - rumor: r-la-lista-de-la-vela
            reply:
              who: Maite Ugarte
              mood: triste
              text: 'A Ciriaco, el del embarcadero. Otra vez. Tiene ochenta años y fiebre, y no hay nadie más.'
              presenta: ciriaco
      - who: Maite Ugarte
        text: 'Si quieres saber lo que aquí no se cuenta, mira el libro de la iglesia, o a los críos que saltan desde el muelle. Y luego baja al embarcadero viejo y pregúntale a Ciriaco. Lleva treinta años velando.'
        presenta: ciriaco

hito:
  id: la-vela
  acto: 1
  titulo: La Vela
  abre: 'tras_hito: lo-que-no-se-cuenta'
  pide: 'ganar_tablero: enc-la-vela'
  cambia:
    abre_hito: la-tumba-de-mateo
    reputacion: { rezadoras: 1 }
  pista: 'Pasa la noche en la Vela, en el embarcadero viejo, hasta que amanezca.'
  escena: 'El pescador viejo que vela casi todas las noches está con fiebre. Te pide que te sientes tú en la última tabla del embarcadero viejo y que les hables a los que suben, hasta que cante el gallo.'
  paquete:
    backdrop: El Embarcadero Viejo
    beats:
      - who: Ciriaco Etxanobe
        mood: triste
        text: '¿Te manda Maite? Ciriaco me llamo. Treinta años velando. Diez mil noches. Y esta noche no me tengo en pie.'
      - who: Ciriaco Etxanobe
        text: 'Te sientas en la última tabla del embarcadero viejo. Les hablas. Del tiempo, de las redes, de lo que sea. Si te callas, suben.'
        options:
          - id: vela-farol
            text: 'Me llevo un farol y el arma, por si acaso.'
            effects:
              - give: Farol de la Vela
              - board: La Vela
            reply:
              who: Ciriaco Etxanobe
              text: 'El farol, bien. El arma no les hace nada que dure. Los tiras al agua y vuelven con la marea.'
          - id: vela-hablar
            text: 'Les hablaré, como haces tú.'
            effects:
              - attitude: 1
              - board: La Vela
            reply:
              who: Ciriaco Etxanobe
              mood: alegre
              text: 'Así me gusta. Si sube una mujer pequeña con un pañuelo azul, háblale del tiempo. Le gustaba saber si iba a llover.'
          - id: vela-quienes
            text: '¿Quiénes son los que suben?'
            effects:
              - board: La Vela
            reply:
              who: Ciriaco Etxanobe
              mood: triste
              text: 'Vecinos. Gente de aquí. No preguntes más esta noche: los vas a ver tú.'
      - who: Ciriaco Etxanobe
        text: 'Hasta que cante el gallo. Ni un minuto menos.'
        alt:
          - if: { chose: posada-cobrar }
            text: 'Hasta que cante el gallo. Y no te pago yo, que a ti ya te ha pagado la Cofradía.'

hito:
  id: la-tumba-de-mateo
  acto: 1
  titulo: Una tumba recién cavada
  abre: 'tras_hito: la-vela'
  pide: 'llegar: el-cementerio'
  cambia:
    abre_hito: la-marea-que-no-baja
  pista: 'Sube al Cementerio Viejo: Ciriaco dice que allí hay una tumba nueva, la primera en treinta años.'
  escena: 'En el cementerio viejo, el hermano que cuida la iglesia te cuenta que las cajas están llenas de piedras: aquí no se entierra a nadie desde la galerna. Junto a la capilla hay una tumba recién cavada, y un hombre de luto la guarda con un bichero.'
  paquete:
    backdrop: El Cementerio Viejo
    beats:
      - who: Hermano Julián
        mood: triste
        text: 'Perdona, perdona. No esperaba a nadie. Soy el hermano Julián; cuido la iglesia desde que murió Don Fermín. Aunque no venga nadie.'
      - who: Hermano Julián
        mood: triste
        text: '¿Ves las cruces? Debajo de cada una hay una caja llena de piedras. Sesenta y una. Las conté al bajarlas. A los muertos de verdad se los lleva el agua.'
      - who: Ciriaco Etxanobe
        mood: triste
        text: 'Anoche, en la Vela, la tercera que subió por el poste era Remedios. Mi mujer. Ahora ya lo sabes tú también.'
      - who: Lucio Iturbe
        mood: enfadado
        text: '¡Fuera de la tumba de mi padre! Aquí no se acerca nadie.'
      - who: Hermano Julián
        text: 'Es Lucio Iturbe, el hijo de Mateo. Enterró a su padre aquí hace nueve días, en tierra. El primero en treinta años.'
        presenta: lucio
      - who: Lucio Iturbe
        mood: enfadado
        text: 'Mi padre quería tierra, y se la he dado. Desde entonces la marea no baja y los críos se meten en el mar. Que el mar se las arregle.'
        options:
          - id: tumba-dejarle
            text: 'Te dejo velar a tu padre. No he venido a quitarte nada.'
            effects:
              - attitude: 1
            reply:
              who: Lucio Iturbe
              mood: triste
              text: '…Gracias. Eres {el primero|la primera} que me lo dice. Por mi padre.'
          - id: tumba-convencer
            text: 'Por esta tumba hay niños metiéndose en el mar. Ayúdame a entender por qué.'
            check:
              skill: persuasion
              dc: 13
              success:
                effects:
                  - clue: 'Mateo Iturbe remó hace treinta años la barca que llevó a alguien al Bajo. Lucio lo tiene apuntado en los papeles de su padre.'
                reply:
                  who: Lucio Iturbe
                  mood: triste
                  text: 'Mi padre remó una noche hasta el Bajo, hace treinta años. Llevaba gente. Nunca dijo quién. Algo dejó apuntado en sus papeles.'
              failure:
                effects:
                  - attitude: -1
                reply:
                  who: Lucio Iturbe
                  mood: enfadado
                  text: '¿Ahora la culpa es de mi padre? Largo de aquí.'
          - id: tumba-amenazar
            text: 'O lo devuelves al mar, o se lo cuento a la Cofradía.'
            irreversible: true
            effects:
              - attitude: -1
            reply:
              who: Lucio Iturbe
              mood: enfadado
              text: 'Cuéntaselo. Que vengan. Por mi padre que esta caja no sale de la tierra.'
            later:
              days: 3
              on: siempre
              name: El arpón de Lucio
              text: 'El herrero te para en la calle: «Lucio me ha hecho afilar un arpón de ballenero. Dice que ya sabe para quién es.»'
              options:
                - label: 'Ir a hablar con Lucio antes de que haga una tontería'
                  cost: { horas: 2 }
                  effects: ['pista']
                  who: "Lucio Iturbe"
                  then: "¡Ya no hablo con nadie que me mande la Cofradía! ¡Fuera de mi puerta!"
                - label: 'Avisar a Jacinto'
                  effects: ['faccion:+1']
                  who: "Jacinto Larrañaga"
                  then: "Nosotros nos ocupamos."

hito:
  id: la-marea-que-no-baja
  acto: 2
  titulo: La marea que no baja
  abre: 'tras_hito: la-tumba-de-mateo'
  pide: 'ganar_tablero: enc-la-marea'
  cambia:
    abre_hito: la-senora-arrieta
    reputacion: { cofradia: 1 }
  pista: 'Baja a la Playa de las Redes y aguanta con los niños hasta que sus padres se los lleven a casa.'
  escena: 'Llega corriendo el hermano pequeño de Lucio: la marea lleva dos días sin bajar y esta noche seis niños han salido de sus casas hacia el agua. En la playa, los que suben del mar los esperan.'
  paquete:
    backdrop: El Cementerio Viejo
    beats:
      - who: Gorka Iturbe
        mood: enfadado
        text: '¡Lucio! ¡Lucio, deja la pala! …Ah. Hola. Soy Gorka, el hermano. Perdona los gritos.'
      - who: Gorka Iturbe
        mood: triste
        text: 'La marea lleva dos días sin bajar. Y esta noche seis críos han salido de sus casas, en camisón, hacia la Playa de las Redes.'
      - who: Lucio Iturbe
        mood: enfadado
        text: 'Que vaya la Cofradía. Yo de aquí no me muevo.'
        alt:
          - if: { chose: tumba-dejarle }
            mood: triste
            text: 'Ve tú, que a ti te escuchan. Yo no puedo dejarle solo. Hoy no.'
      - who: Gorka Iturbe
        mood: enfadado
        text: 'En la playa están saliendo ellos del agua. Muchos. Yo no me ahogo, pero solo no puedo con todos. ¿Vienes?'
        options:
          - id: playa-voy
            text: 'Voy contigo. Vamos.'
            effects:
              - bond: 1
                who: Gorka Iturbe
            reply:
              who: Gorka Iturbe
              mood: alegre
              text: '¡Eso! Corre, que la arena está blanda y ellos no se cansan.'
          - id: playa-lucio
            text: 'Lucio, son niños. Ven con nosotros.'
            check:
              skill: persuasion
              dc: 14
              success:
                effects:
                  - attitude: 1
                    who: Lucio Iturbe
                reply:
                  who: Lucio Iturbe
                  mood: triste
                  text: '…Hasta la playa. No más. Por los críos, no por vosotros.'
              failure:
                reply:
                  who: Lucio Iturbe
                  mood: enfadado
                  text: 'Los críos de la Cofradía. Que los salve la Cofradía.'
          - id: playa-por-que
            text: '¿Por qué salen solo los niños?'
            reply:
              who: Gorka Iturbe
              mood: triste
              text: 'Porque son de los nuestros, de los que no se ahogan. Algo los llama. A mí de pequeño también me llamaba.'

hito:
  id: la-senora-arrieta
  acto: 2
  titulo: La dueña de la Salazón
  abre: 'tras_hito: la-marea-que-no-baja'
  pide: 'hablar_con: rosalia'
  cambia:
    abre_hito: las-viudas-de-la-galerna
  pista: 'La señora Arrieta quiere verte. Ve a hablar con ella a la Salazón.'
  escena: 'Al amanecer, con los niños ya en sus camas, el capataz de la Salazón te espera en la playa. La señora Arrieta, la dueña, quiere hablar contigo.'
  paquete:
    backdrop: La Playa de las Redes
    beats:
      - who: Juana Lekuona
        mood: alegre
        text: '¡Seis críos en casa y ninguno mojado de más! Soy Juana, la de las redes. Esta noche te has ganado un caldo.'
      - who: Antón Iriarte
        text: 'Buenos días. La señora Arrieta quiere verte. Cuando quieras. Ahora.'
      - who: Juana Lekuona
        mood: triste
        text: 'Es Antón, el capataz de la Salazón. Cuando la señora llama, no se la hace esperar.'
        presenta: anton
      - who: Antón Iriarte
        text: 'La señora no muerde. Paga. Que es mejor.'
        options:
          - id: arrieta-voy
            text: 'Dile a tu señora que voy.'
            reply:
              who: Antón Iriarte
              text: 'Te espera con café. No lo dejes enfriar.'
          - id: arrieta-que-quiere
            text: '¿Qué quiere de mí la señora Arrieta?'
            reply:
              who: Antón Iriarte
              text: 'Lo que quiere todo el pueblo: que esto se acabe. La señora sabe cómo. Ella te lo dirá.'
          - id: arrieta-cofradia
            text: '¿Y por qué no ha venido nadie de la Cofradía a por los niños?'
            reply:
              who: Juana Lekuona
              mood: enfadado
              text: 'Porque la Cofradía duerme, criatura. La Cofradía siempre duerme.'

hito:
  id: las-viudas-de-la-galerna
  acto: 2
  titulo: Las viudas de la galerna
  abre: 'tras_hito: la-senora-arrieta'
  pide: 'hablar_con: engracia'
  cambia:
    abre_hito: la-caja-de-don-fermin
    revela: [la-cala]
  pista: 'Sube a la Ermita de los Ahogados y habla con la rezadora mayor: ella vivió la galerna.'
  escena: 'Al salir del despacho de la señora Arrieta, una saladora te para en el patio. Si quieres saber lo que pasó hace treinta años, no preguntes en la Salazón: pregunta a las Rezadoras, en la ermita.'
  paquete:
    backdrop: La Salazón de los Arrieta
    beats:
      - who: Josune Aramburu
        text: 'Psst. Aquí, detrás de los barriles. Yo no he dicho nada, ¿eh? Soy Josune. Trabajo en las pilas de sal.'
      - who: Josune Aramburu
        text: 'La señora te habrá ofrecido dinero. A todos les ofrece dinero. Pero lo de hace treinta años no te lo va a contar.'
      - who: Josune Aramburu
        mood: triste
        text: 'Sube a la ermita. Las Rezadoras son las viudas de la galerna. La rezadora mayor, Engracia, se acuerda de todo, aunque no lo diga.'
        presenta: engracia
        options:
          - id: josune-pagar
            text: 'Toma una moneda por el consejo.'
            effects:
              - gold: -1
              - attitude: 1
              - clue: 'Josune dice que el capataz de la Salazón saca sacos de sal de noche por la compuerta.'
            reply:
              who: Josune Aramburu
              mood: alegre
              text: 'Ay, gracias. Otra cosa gratis: el capataz saca sacos de sal de noche por la compuerta. Adónde, no lo sé.'
          - id: josune-por-que
            text: '¿Por qué me ayudas?'
            reply:
              who: Josune Aramburu
              mood: triste
              text: 'Porque tengo un primo de nueve años que esta semana se ha despertado dos veces con los pies en el agua.'

hito:
  id: la-caja-de-don-fermin
  acto: 2
  titulo: La caja de Don Fermín
  abre: 'tras_hito: las-viudas-de-la-galerna'
  pide: 'ganar_tablero: enc-la-cala'
  cambia:
    abre_hito: el-diario-del-cura
    reputacion: { rezadoras: 1 }
  pista: 'Recupera la caja de Don Fermín en la Cala del Contrabando, al sur de la Playa de las Redes.'
  escena: 'En la ermita aparece un contrabandista de Arenales vendiendo velas de estraperlo. Conoce la cala y sabe quién tiene la caja del cura: el jefe de los contrabandistas, al que llaman el Gallo.'
  paquete:
    backdrop: La Ermita de los Ahogados
    beats:
      - who: Pilar Azkue
        mood: enfadado
        text: '¡Otra vez tú por aquí! Las velas de contrabando, fuera de la ermita.'
      - who: Txomin Etxeberria
        mood: alegre
        text: 'Paz, paz, rezadora. Txomin Etxeberria, de Arenales, para servir a quien pague. Velas de cera buena a mitad de precio, camarada.'
      - who: Txomin Etxeberria
        text: '¿La caja del cura? Claro que la conozco. La tiene el Gallo, el jefe de la cala. La usa para sacarle una bolsa a la señora Arrieta cada mes.'
      - who: Pilar Azkue
        mood: triste
        text: 'Soy Pilar. Mi marido sube cada noche por los postes del embarcadero. Si en esa caja pone por qué, tráela.'
        options:
          - id: cala-pagar-txomin
            text: 'Txomin, te pago diez monedas si me enseñas la entrada de la cala.'
            if: { gold: 10 }
            effects:
              - gold: -10
              - rumor: r-la-cala
            reply:
              who: Txomin Etxeberria
              mood: alegre
              text: 'Diez monedas bien gastadas. Al sur de la playa, donde las rocas hacen un arco. Yo te enseño la entrada; dentro, cada uno se apaña.'
          - id: cala-sola
            text: 'Ya la encontraré por mi cuenta.'
            effects:
              - rumor: r-la-cala
            reply:
              who: Txomin Etxeberria
              text: 'Al sur de la playa, donde las rocas hacen un arco. Gratis, por esta vez. Cuidado con el Gallo: canta antes de pelear.'
          - id: cala-pilar
            text: 'Pilar, ¿por qué firmaste que tu marido fuera al agua?'
            reply:
              who: Pilar Azkue
              mood: triste
              text: 'Porque firmamos todas. Porque si no, los niños. Eso nos dijeron. Ya no sé quién lo dijo primero.'

hito:
  id: el-diario-del-cura
  acto: 3
  titulo: El diario del cura
  abre: 'tras_hito: la-caja-de-don-fermin'
  pide: 'hablar_con: engracia'
  cambia:
    abre_hito: [la-tercera-mano, la-carta-de-marear]
  pista: 'Lleva la caja de Don Fermín a la ermita: Engracia fue su sacristana y entiende su letra.'
  escena: 'Con la caja en las manos, el vigía de la cala te cuenta que dentro hay un diario que el Gallo nunca supo leer. La letra de Don Fermín solo la entiende Engracia, la rezadora mayor, que fue su sacristana.'
  paquete:
    backdrop: La Cala del Contrabando
    beats:
      - who: Rufino Goñi
        text: 'Fiuuu. Tranquilidad, que yo no peleo. Rufino, el vigía. Ahí tienes la caja.'
      - who: Rufino Goñi
        text: 'El Gallo la usaba para cobrarle a la señora Arrieta. Cada mes, una bolsa. Nunca supo lo que ponía dentro: no sabe leer. Yo tampoco.'
      - who: Rufino Goñi
        mood: triste
        text: 'La letra del cura es de araña. La única que la entendía era su sacristana, la vieja Engracia, la de la ermita.'
        options:
          - id: rufino-soltar
            text: 'Vete, Rufino. Y no vuelvas a esta cala.'
            effects:
              - attitude: 1
            reply:
              who: Rufino Goñi
              mood: alegre
              text: 'Me voy a otra costa. Una con menos muertos. Fiuuu.'
          - id: rufino-preguntar
            text: '¿Qué más sabe el Gallo de la señora Arrieta?'
            effects:
              - rumor: r-anton-vende-sal
            reply:
              who: Rufino Goñi
              text: 'Que su capataz nos trae sal de noche a cambio de silencio. Y que la señora tiene miedo de algo que va a pasar en la bajamar grande.'

hito:
  id: la-tercera-mano
  acto: 3
  titulo: La tercera mano
  abre: 'tras_hito: el-diario-del-cura'
  pide: 'llegar: el-faro'
  cambia:
    abre_hito: la-puerta-del-faro
  pista: 'Ve al Faro de la Punta. La niña que firmó hace treinta años es hoy la farera.'
  escena: 'En el faro te recibe la farera. Tiene la palma de la mano derecha blanca como el papel desde los ocho años. No recuerda bien lo que pasó aquella noche: solo sueña con una pared llena de manos.'
  paquete:
    backdrop: El Faro de la Punta
    beats:
      - who: Ane Goikoa
        text: 'Ciento cuarenta y dos escalones, y vienes a interrumpirme en el ciento diez. Soy Ane, la farera. ¿Qué quieres?'
        alt:
          - if: { species: Marcado }
            text: 'Ciento cuarenta y dos escalones… Espera. Enséñame el brazo. Tú también llevas la marca. Soy Ane, la farera. Pasa.'
      - who: Ane Goikoa
        mood: triste
        text: '¿Mi mano? Blanca desde los ocho años. Mi padre decía que me la quemé con lejía. Yo no me acuerdo de ninguna lejía.'
      - who: Ane Goikoa
        mood: triste
        text: 'De lo que me acuerdo es de un sueño. Todas las noches. Una pared llena de manos, el agua hasta las rodillas y alguien llorando abajo.'
      - who: Nicasio Ibarra
        mood: triste
        text: 'Cuéntaselo ya, {forastero|forastera}. Lo traes escrito en la cara.'
        options:
          - id: faro-todo
            text: 'Le cuento todo: que firmó de niña, y que el trato dura lo que viva su mano.'
            irreversible: true
            effects:
              - bond: 1
                who: Ane Goikoa
            reply:
              - who: Ane Goikoa
                mood: triste
                text: 'Ocho años. Tenía ocho años. …Entonces la pared es de verdad.'
              - who: Ane Goikoa
                mood: enfadado
                text: 'Y si el trato dura lo que viva yo, habrá quien me quiera muerta. Gracias por decírmelo a la cara.'
          - id: faro-parte
            text: 'Le digo que su padre la llevó al Bajo de niña, y nada más.'
            reply:
              who: Ane Goikoa
              mood: triste
              text: 'Mi padre. Claro. Mi padre lo sabía todo y no me contó nada. Como siempre.'
          - id: faro-nada
            text: 'No le digo nada todavía.'
            reply:
              who: Ane Goikoa
              mood: enfadado
              text: 'Pues no me hagas perder el tiempo. Me quedan treinta y dos escalones.'
      - who: Ane Goikoa
        text: 'Mi padre lo apuntaba todo en un cuaderno: cada barca, cada marea. Si alguien sabe qué pone en esa pared, es él.'

hito:
  id: la-puerta-del-faro
  acto: 3
  titulo: La puerta del faro
  abre: 'tras_hito: la-tercera-mano'
  pide: 'ganar_tablero: enc-la-puerta-del-faro'
  cambia:
    abre_hito: el-cuaderno-del-farero
    revela: [el-pecio]
    reputacion: { cofradia: 1 }
  pista: 'Lucio sube al faro con sus hombres para matar a Ane. Defiende la puerta hasta que se cansen, o convéncelos de que se vayan.'
  escena: 'Alguien ha leído lo mismo que tú. Lucio sube por el camino del faro con seis hombres y un arpón de ballenero: ha averiguado de quién es la mano más joven.'
  paquete:
    backdrop: El Faro de la Punta
    beats:
      - who: Gorka Iturbe
        mood: enfadado
        text: '¡Ane! ¡Cierra la puerta! Mi hermano sube por el camino con seis hombres y el arpón de Eusebio.'
        alt:
          - if: { chose: tumba-amenazar }
            mood: enfadado
            text: '¡Ane! ¡Cierra la puerta! Mi hermano sube con seis hombres. Desde que le amenazaste con la Cofradía no ha parado de buscar a quién echarle la culpa.'
      - who: Gorka Iturbe
        mood: triste
        text: 'Ha leído los papeles de mi padre. Sabe que el trato dura lo que viva la mano más joven. Y alguien le ha dicho que es la de Ane.'
      - who: Ane Goikoa
        mood: enfadado
        text: 'Que suba. Ciento cuarenta y dos escalones. Se le van a hacer largos.'
        alt:
          - if: { chose: faro-nada }
            mood: enfadado
            text: '¿A por mi mano? ¿Vienen a por mí, y tú lo sabías y no me lo has dicho?'
      - who: Lucio Iturbe
        mood: enfadado
        text: '¡Ane Goikoa! ¡Sal! No tengo nada contra ti. Pero mientras vivas, mi padre no descansa.'
        options:
          - id: faro-gorka
            text: 'Gorka, habla tú con tu hermano.'
            effects:
              - board: La puerta del faro
            reply:
              who: Gorka Iturbe
              mood: triste
              text: 'Lo he intentado toda la mañana. Ahora no escucha a nadie. A ti igual sí, si le dices algo que no sepa.'
          - id: faro-diario
            text: 'Lucio, si la matas, el agua se lleva a los niños. Lo dice el diario del cura.'
            effects:
              - board: La puerta del faro
            reply:
              who: Lucio Iturbe
              mood: enfadado
              text: '¡Mentira! Eso lo dice la vieja Arrieta para que nadie toque su trato.'

hito:
  id: el-cuaderno-del-farero
  acto: 3
  titulo: El cuaderno del farero
  abre: 'tras_hito: la-puerta-del-faro'
  pide: 'ganar_tablero: enc-el-pecio'
  cambia:
    abre_hito: la-bajamar
    revela: [la-boca]
  pista: 'Baja al Pecio de la Esperanza con la marea baja y saca el cuaderno de Martín Goikoa del camarote antes de que vuelva el agua.'
  escena: 'Con Lucio vencido o convencido, la farera te cuenta dónde escribía su padre: en el camarote del pecio de la Esperanza, el barco de su madre, que solo asoma con la marea baja.'
  paquete:
    backdrop: El Faro de la Punta
    beats:
      - who: Ane Goikoa
        mood: triste
        text: 'Mi padre bajaba al pecio de la Esperanza con cada bajamar. Era el barco de mi madre. Se sentaba en el camarote y escribía.'
      - who: Nicasio Ibarra
        text: 'Desde aquí se ve, entre las rocas de la punta. La marea baja dura lo que una comida. Luego se lo traga el mar.'
      - who: Ane Goikoa
        text: 'Si las palabras de la pared están escritas en algún sitio, están en ese cuaderno. Ve tú. Yo nunca he podido bajar.'
        alt:
          - if: { chose: faro-todo }
            text: 'Me dijiste la verdad a la cara. Ahora te toca encontrar el resto. Ve al pecio; yo nunca he podido bajar.'
        options:
          - id: pecio-acompanar
            text: 'Ven conmigo, Ane. No tienes que bajar sola.'
            effects:
              - bond: 1
                who: Ane Goikoa
            reply:
              who: Ane Goikoa
              mood: triste
              text: '…Hasta las rocas. Del boquete para dentro, entras tú.'
          - id: pecio-solo
            text: 'Voy yo. Tú vigila el camino, por si vuelve Lucio.'
            reply:
              who: Ane Goikoa
              text: 'Vigilar es lo que mejor se me da. Ciento cuarenta y dos escalones de ventaja.'

hito:
  id: la-bajamar
  acto: 4
  titulo: La bajamar grande
  abre: 'tras_hito: el-cuaderno-del-farero'
  pide: 'ganar_tablero: enc-la-bajamar'
  cambia:
    abre_hito: la-pared-de-las-manos
    revela: [la-pared]
    reputacion: { rezadoras: 1, cofradia: -1 }
  pista: 'Corre a la Boca del Bajo: la señora Arrieta va a hacer firmar a Uxue. Apaga las dos velas de la llamada antes de que la Vecina conteste.'
  escena: 'El raquero del pecio sabe leer y lee en voz alta las palabras de la pared que copió el farero, y la forma de deshacer el trato. Desde el pecio se ven luces en el Bajo: es la bajamar grande, y los de la Salazón llevan a una niña dormida hacia la Boca.'
  paquete:
    backdrop: El Pecio de la Esperanza
    beats:
      - who: Sebastián Mendia
        text: 'Je. Ese cuaderno lo guardaba yo bajo la tabla, para que no se lo comiera el agua. Sebastián, raquero. El farero me enseñó a leer aquí dentro, con la marea baja.'
      - who: Sebastián Mendia
        mood: triste
        text: 'Mira lo que copió de la pared. «Uno: ningún vivo de la bahía morirá en el agua. Dos: los muertos de Mareaviva serán del agua, y le harán compañía.»'
      - who: Sebastián Mendia
        mood: triste
        text: '«Tres: el trato dura lo que dure la mano más joven que lo firmó. Cuatro: si falta un muerto, la Vecina vendrá a buscar compañía entre los vivos.»'
      - who: Sebastián Mendia
        text: 'Y debajo, con otra tinta: «La mano que firmó puede volver a la pared y quitarse, por su voluntad, en la bajamar grande. Ella no pidió muertos: pidió compañía. Lo de los muertos lo ofreció Rosalía.»'
      - who: Sebastián Mendia
        mood: enfadado
        text: 'Mira allí, en el Bajo. Luces. Hoy es la bajamar grande, y esos son los de la Salazón. Llevan a una niña en brazos.'
        options:
          - id: bajamar-correr
            text: 'Vamos. Hoy no firma ninguna niña.'
            reply:
              who: Sebastián Mendia
              mood: enfadado
              text: 'Por las rocas se llega antes. Corre, que el mar no espera a nadie.'
          - id: bajamar-entender
            text: 'Entonces la Vecina no quería muertos. Quería compañía.'
            effects:
              - clue: 'Según el cuaderno del farero, la Vecina pidió compañía, no muertos. Lo de los muertos lo ofreció Rosalía Arrieta.'
            reply:
              who: Sebastián Mendia
              mood: triste
              text: 'Y le dieron muertos. Y los muertos no hablan. Así cualquiera llora.'

hito:
  id: la-pared-de-las-manos
  acto: 4
  titulo: La pared de las manos
  abre: 'tras_hito: la-bajamar'
  pide: 'llegar: la-pared'
  cambia:
    abre_hito: [fin-la-costa-duerme, fin-un-trato-nuevo, fin-el-trato-sigue]
  pista: 'Entra hasta la cueva del fondo del Bajo, donde están las manos, antes de que vuelva a subir la marea.'
  escena: 'Al fondo del Bajo hay una pared llena de manos pintadas, de muchos siglos. Tres son más nuevas. En la poza más honda algo pálido y enorme se mueve, y habla. La señora Arrieta, vencida, espera de rodillas en el agua.'
  paquete:
    backdrop: La Pared de las Manos
    beats:
      - who: La Vecina
        mood: triste
        text: 'Habéis venido. Hace treinta años que nadie vivo baja a esta pared.'
        presenta: true
      - who: La Vecina
        mood: triste
        text: 'Pedí compañía. Me dieron muertos. Los muertos no hablan: solo suben, y lloran, y no duermen. Y ahora falta uno.'
      - who: Rosalía Arrieta
        mood: triste
        text: 'Era lo único que podíamos dar, {hijo|hija}. ¿Qué querías, que se quedara un vivo aquí abajo para siempre? Devolvedle a Mateo y todo seguirá como siempre.'
      - who: Ane Goikoa
        mood: triste
        text: 'Y yo puedo quitar mi mano. Lo dice el cuaderno de mi padre. Se acaba el trato. Se acaba todo: la suerte, la Vela y los muertos despiertos.'
      - who: Pilar Azkue
        mood: triste
        text: 'O le damos lo que de verdad pidió: compañía. Las Rezadoras llevamos treinta años velando a los muertos. Podemos velar para ella, si suelta a nuestros hombres.'
      - who: La Vecina
        text: 'Decidme qué trato queréis. Lo que se firma por las buenas, por las buenas se cambia.'
        options:
          - id: pared-quitar
            text: 'Que Ane quite su mano. Que se acabe el trato.'
            irreversible: true
            effects:
              - board: Hasta la pared
            reply:
              who: Ane Goikoa
              mood: triste
              text: 'Vale. Pero bajas conmigo hasta la pared. Los muertos no nos van a dejar llegar tan fácil.'
          - id: pared-compania
            text: 'Le daremos compañía de vivos: la Vela, para siempre, por turnos.'
            irreversible: true
            reply:
              who: Pilar Azkue
              mood: alegre
              text: 'Esta noche, en el embarcadero viejo, la primera Vela de todas. Si los muertos se dejan ir, será que ha aceptado.'
          - id: pared-mateo
            text: 'Devolveremos a Mateo al agua. Que todo siga como estaba.'
            irreversible: true
            reply:
              who: Rosalía Arrieta
              mood: alegre
              text: 'Gracias, {hijo|hija}. Lucio no lo va a soltar por las buenas. Te espera en el cementerio con los suyos.'

hito:
  id: fin-la-costa-duerme
  acto: 4
  titulo: Hasta la pared
  abre: 'tras_hito: la-pared-de-las-manos'
  pide: 'ganar_tablero: enc-la-pared'
  cambia:
    final: la-costa-duerme
    cierra: [fin-un-trato-nuevo, fin-el-trato-sigue]
    reputacion: { arenales: 2, cofradia: -2 }
  pista: 'Si quieres acabar con el trato: lleva a Ane hasta su mano en la pared, entre los muertos que suben.'
  escena: 'Si Ane quita su mano de la pared, el trato se acaba. Los muertos no quieren que llegue.'
  paquete:
    pov: Ane Goikoa
    backdrop: La Pared de las Manos
    beats:
      - who: Ane Goikoa
        mood: triste
        text: 'Si es la pared, bajo yo contigo. Ahora, antes de que suba la marea.'
      - who: Ane Goikoa
        mood: enfadado
        text: 'Los muertos no van a querer dormir. Tú abre camino; la mano la pongo yo.'

hito:
  id: fin-un-trato-nuevo
  acto: 4
  titulo: La primera Vela de todos
  abre: 'tras_hito: la-pared-de-las-manos'
  pide: 'ganar_tablero: enc-la-primera-vela'
  cambia:
    final: un-trato-nuevo
    cierra: [fin-la-costa-duerme, fin-el-trato-sigue]
    reputacion: { rezadoras: 2, cofradia: 1 }
  pista: 'Si quieres un trato nuevo: vela con las Rezadoras en el embarcadero viejo hasta que amanezca y los muertos se dejen ir.'
  escena: 'Si queréis darle compañía de vivos, esta noche os sentáis todos en el embarcadero viejo. Si los muertos se dejan ir, será que ha aceptado.'
  paquete:
    pov: Pilar Azkue
    backdrop: El Embarcadero Viejo
    beats:
      - who: Pilar Azkue
        mood: triste
        text: 'Si es la Vela, os espero esta noche en el embarcadero viejo. Vendrán las Rezadoras, y medio pueblo si se lo pido.'
      - who: Pilar Azkue
        mood: triste
        text: 'Los más viejos no querrán soltar el poste. Si al amanecer se dejan ir, habrá aceptado.'

hito:
  id: fin-el-trato-sigue
  acto: 4
  titulo: La tumba de Mateo
  abre: 'tras_hito: la-pared-de-las-manos'
  pide: 'ganar_tablero: enc-la-tumba'
  cambia:
    final: el-trato-sigue
    cierra: [fin-la-costa-duerme, fin-un-trato-nuevo]
    reputacion: { cofradia: 2, arenales: -1 }
  pista: 'Si quieres que todo siga como estaba: saca la caja de Mateo de la tierra y échala al mar desde el acantilado del cementerio.'
  escena: 'Si queréis que todo siga como siempre, la caja de Mateo tiene que volver al agua. Lucio la guarda en el cementerio con los suyos.'
  paquete:
    pov: Rosalía Arrieta
    backdrop: El Cementerio Viejo
    beats:
      - who: Rosalía Arrieta
        mood: neutral
        text: 'Si es la caja de Mateo, Lucio os espera en el cementerio con los suyos, {hijo|hija}.'
      - who: Rosalía Arrieta
        mood: triste
        text: 'Echadla al mar desde el borde, donde el acantilado. Y todo volverá a ser como siempre.'

hito:
  id: la-carta-de-marear
  acto: 3
  titulo: La carta de marear del farero
  oculto: true
  abre: 'tras_hito: el-diario-del-cura'
  pide: 'hablar_con: nicasio'
  cambia:
    revela: [el-pecio]
  pista: 'El carpintero del faro guarda el arcón del farero viejo.'
  escena: 'El carpintero de ribera abre por fin el arcón del farero viejo y te da su carta de marear: el camino entre las rocas hasta el pecio de la Esperanza.'
  paquete:
    backdrop: El Faro de la Punta
    beats:
      - who: Nicasio Ibarra
        text: 'Nicasio, carpintero. Ya iba siendo hora de que alguien abriera este arcón. Martín me lo dejó hace doce años, la noche que se metió en el mar.'
      - who: Nicasio Ibarra
        mood: triste
        text: 'Le vi irse. No le paré. Madera vieja: cuando se parte, se parte.'
      - who: Nicasio Ibarra
        text: 'Toma. Su carta de marear. Ahí está pintado el camino entre las rocas hasta la Esperanza. Con eso no te perderás en la bajamar.'
        options:
          - id: nicasio-gracias
            text: 'Gracias, Nicasio.'
            reply:
              who: Nicasio Ibarra
              text: 'No me las des. Dáselas a él, si le ves subir por algún poste.'
          - id: nicasio-por-que
            text: '¿Por qué no se la diste a la farera?'
            reply:
              who: Nicasio Ibarra
              mood: triste
              text: 'Porque me la pidió él. «A quien venga preguntando por la pared», me dijo. Ane nunca preguntó.'
```

## Los finales

Cada final tiene su escena y sus epílogos: los cinco compañeros, la gente que pesó y las facciones.

```yaml
final:
  id: la-costa-duerme
  titulo: La costa duerme
  escena: "Pongo la mano en la pared… y la aparto. Mira: la tinta se borra. Esta noche nadie subirá por los postes del embarcadero viejo, y en Mareaviva se dormirá de un tirón por primera vez en treinta años. ¿Tengo el pelo blanco? Da igual. La bahía ya es un mar como todos: desde hoy, aquí también se puede uno ahogar."
  paquete:
    who: "Ane Goikoa"
  epilogos:
    - quien: ane
      texto: 'Ane Goikoa sigue subiendo los ciento cuarenta y dos escalones cada noche, con el pelo blanco. Ya no cuenta las barcas: las espera.'
    - quien: gorka
      texto: 'Gorka Iturbe aprende a tenerle miedo al mar a los veintitrés años. Dice que es lo mejor que le ha pasado.'
    - quien: rosalia
      texto: 'Rosalía Arrieta cierra la Salazón un mes de luto por los sesenta y un muertos que dio al agua. Después la abre otra vez: el mar sigue dando pescado, aunque menos.'
    - quien: lucio
      texto: 'Lucio Iturbe pone una cruz con nombre en la tumba de su padre. La primera de verdad en treinta años.'
    - quien: arenales
      texto: 'Los de Arenales vuelven a pescar en la bahía sin que nadie les eche. Ahora los dos pueblos entierran a sus muertos igual.'

final:
  id: un-trato-nuevo
  titulo: Un trato nuevo
  escena: "Esta noche nos sentamos en el embarcadero viejo y le hablamos al agua hasta el amanecer. Mira: uno a uno, los muertos sueltan los postes y se hunden despacio. Por fin duermen. La Vecina acepta: compañía de vivos, una noche cada uno, por turnos, para siempre. En Mareaviva seguirá sin ahogarse nadie, pero ahora todo el pueblo sabe por qué, y lo paga despierto."
  paquete:
    who: "Engracia Sarasola"
  epilogos:
    - quien: ane
      texto: 'Ane Goikoa conserva su mano blanca. La primera noche de cada mes le toca la Vela, y le cuenta a la Vecina las barcas que han entrado.'
    - quien: julian
      texto: 'El hermano Julián reza en la última tabla una noche a la semana. Ya no llena cajas de piedras: los muertos se entierran en tierra, con su nombre.'
    - quien: rosalia
      texto: 'Rosalía Arrieta hace la Vela todas las noches que le quedan. Dice que es lo menos que debe.'
    - quien: uxue
      texto: 'Uxue Lasarte duerme de un tirón. Los domingos va con su madre a la Vela y le canta a la Vecina.'
    - quien: rezadoras
      texto: 'Las Rezadoras escriben la lista nueva de la Vela, con todos los nombres del pueblo. Nadie la discute.'

final:
  id: el-trato-sigue
  titulo: El trato sigue
  escena: "La caja de Mateo, atada a una piedra, y el mar se cierra sobre el último que faltaba. Esta noche baja la marea, los críos dormirán en sus camas y en la bahía no se ahogará nadie. Todo sigue como estaba: la suerte, la Vela y los muertos despiertos bajo el embarcadero. Hasta el día en que se muera Ane Goikoa."
  paquete:
    who: "Jacinto Larrañaga"
  epilogos:
    - quien: ane
      texto: 'Ane Goikoa sigue contando barcas. Ahora sabe que cada noche que vive es una noche más de trato, y duerme todavía peor.'
    - quien: gorka
      texto: 'Gorka Iturbe se va con la milicia de costa y no vuelve a Mareaviva. Escribe a su hermano cada mes; Lucio no contesta.'
    - quien: rosalia
      texto: 'Rosalía Arrieta busca otra mano joven para la próxima bajamar grande. Tiene tiempo.'
    - quien: lucio
      texto: 'Lucio Iturbe se marcha de Mareaviva con lo puesto. Dicen que en Arenales enterró una caja vacía con el nombre de su padre.'
    - quien: cofradia
      texto: 'La Cofradía de Mareaviva vuelve a pescar más que nadie y a no hablar de nada. La lista de la Vela sigue en la pared de la posada.'
```
