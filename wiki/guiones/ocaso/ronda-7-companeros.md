# Las tierras del ocaso — ronda 7: los compañeros

> Escrita por Claude (tanda 20, 2026-10-03). Cinco compañeros, cada uno con sus cinco escenas de vínculo (rangos 2, 4, 6, 8 y 10) como conversación, y lo que dice al llegar a sus sitios. Todo lo dice él o ella (D-J60): no hay notas ni narrador.
>
> Cómo habla cada uno:
>
> - **Ilvana Hojarrubia**, elfa exploradora: pocas palabras, exactas. Lo mide todo en pasos y en piedras. «Cada piedra señala la siguiente.»
> - **Ruy Zarzal**, semiorco bárbaro: despacio y bajito, como quien no quiere asustar. Empieza muchas frases con «Mira».
> - **Gudrun Hondaroca**, enana clériga: firme y cálida. Habla de puertas, de su abuelo y de la forja.
> - **Pía Rueda**, gnoma maga: deprisa, con números. Todo lo mide en carros: lo que aguanta, lo que pesa.
> - **Telmo Avellano**, mediano pícaro: con guasa, y todo tiene precio. «Eso, en el paso, vale…»
>
> El rango 4 de Ilvana, Ruy y Gudrun abre su misión personal (ronda 8). Su romance llega en el rango 9, con su punto de inflexión (D-J63).

confidente:
  id: ilvana
  al_llegar:
    las-hayas-rojas: "Sesenta años sin pisar este musgo. Huele igual. Yo no."
    las-sendas-viejas: "Cada piedra señala la siguiente. No te separes de mí, que aquí uno se pierde en tres pasos."
    la-atalaya: "Desde aquí arriba se ven todas las sendas. Las de mi gente y las de los ejércitos."
  paquete:
    scenes:
      - rank: 2
        title: Las piedras que señalan
        where: plaza
        beats:
          - say: "Cada piedra de una senda señala la siguiente. Mi gente las puso hace tres siglos. Yo me las aprendí a los ocho años."
          - say: "¿Y tú? ¿Cómo aprendiste a no perderte?"
            replies:
              - { text: "Le hablas de las estrellas que te enseñaron en tu infancia.", bond: 1, then: "Las estrellas también señalan la siguiente. Me gusta eso.", mood: alegre }
              - { text: "Le confiesas que te pierdes hasta en una plaza.", bond: 0, then: "Entonces no te separes de mí. Diez pasos, como mucho." }
              - { text: "Le dices que eso de las piedras es cosa de elfos viejos.", bond: -1, then: "Lo es. Y los elfos viejos no se pierden.", mood: enfadado }
      - rank: 4
        title: El hermano
        where: posada
        beats:
          - say: "Tengo un hermano. Caelan. Juega a los dados como otros respiran."
            mood: triste
          - say: "Debe dinero a un prestamista de Vadoancho. Y alguien ha vendido al Cierzo el mapa de las Sendas Viejas."
            mood: triste
          - say: "No quiero saber si fue él. Ya lo sé."
            replies:
              - { text: "Le dices que iréis a buscarle juntos.", bond: 1, then: "Está en las Sendas Viejas. Cobra a los del Cierzo por guiarles. Iremos cuando digas.", mood: alegre }
              - { text: "Le preguntas qué quiere hacer ella.", bond: 1, then: "Quiero mirarle a la cara. Lo que haga después, no lo sé todavía." }
              - { text: "Le dices que eso es cosa suya.", bond: 0, then: "Lo es. Por eso te lo cuento a ti y no a él.", mood: triste }
      - rank: 6
        title: La firma
        where: plaza
        beats:
          - say: "Hace sesenta años que no vuelvo a las Hayas Rojas. Para un elfo, sesenta años no es nada. Para mí, sí."
          - say: "Me fui el día que Caelan perdió a los dados la casa de nuestros padres. La deuda la firmé yo, para que no lo encerraran."
            mood: triste
          - say: "Nunca se lo he dicho a nadie. Ni a él."
            replies:
              - { text: "Le dices que firmar por un hermano no es un error.", bond: 1, then: "No. El error fue firmar dos veces.", mood: triste }
              - { text: "Le coges la mano un momento, sin decir nada.", bond: 1, then: "...Gracias. Eso no lo dice ninguna piedra.", mood: alegre }
              - { text: "Le dices que Caelan tiene que pagar lo suyo.", bond: 0, then: "Lo pagará. Pero no con mi casa otra vez." }
      - rank: 8
        title: Un sitio donde quedarse
        where: posada
        beats:
          - say: "Quiero que las Sendas vuelvan a ser un camino. No un atajo para ejércitos."
          - say: "Y quiero un sitio donde quedarme más de una estación. Llevo un siglo durmiendo bajo árboles que no son míos."
            replies:
              - { text: "Le dices que, acabe como acabe esto, tendrá un sitio contigo.", bond: 1, then: "No digas eso si no lo piensas. Los elfos nos acordamos de todo.", mood: alegre }
              - { text: "Le preguntas qué sitio sería.", bond: 1, then: "Uno con una ventana al este. Y con alguien que no se vaya." }
              - { text: "Le dices que los caminos son para andarlos, no para quedarse.", bond: 0, then: "Eso pensaba yo hace un siglo." }
      - rank: 10
        title: La piedra tallada
        where: plaza
        beats:
          - say: "Te he tallado una piedra. Tiene una marca que solo leemos tú y yo."
            mood: alegre
          - say: "Señala adonde estés tú. Donde vayas, la seguiré. Es lo que hacen las piedras de una senda."
            replies:
              - { text: "Te la guardas en el bolsillo del pecho.", bond: 1, then: "Ahí no se pierde. Ahí la llevo yo también.", mood: alegre }
              - { text: "Le dices que tallarás otra para ella.", bond: 1, then: "Hazla torcida. Así sabré que es tuya.", mood: alegre }

confidente:
  id: ruy
  al_llegar:
    torre-brezo: "Ahí ponía mi nombre. Lo picaron con un cincel. Mira, hicieron bien: ya no soy de aquí."
    los-sauces: "Aquí venían los de Los Brezales cuando les faltaba pan. Ahora les falta todo."
    refugio-de-la-cabra: "Treinta lanzas de Brezo. Conozco a la mitad. La otra mitad me conoce por la espalda."
  paquete:
    scenes:
      - rank: 2
        title: El hacha de leñador
        where: plaza
        beats:
          - say: "Mira, esta hacha no es de guerra. Es de leñador. Con ella corté la leña de Los Brezales tres inviernos."
          - say: "La gente se aparta cuando me ve con ella. Por la cara, supongo. No por el hacha."
            replies:
              - { text: "Le dices que tú no te apartas.", bond: 1, then: "Ya lo veo. Eso es raro. Raro bueno.", mood: alegre }
              - { text: "Le preguntas qué se siente al cortar leña.", bond: 1, then: "Silencio. El árbol cae y ya está. Nadie grita." }
              - { text: "Le dices que con esa cara normal que se aparten.", bond: -1, then: "Mira, eso ya lo sé. No hacía falta.", mood: triste }
      - rank: 4
        title: Los Brezales
        where: posada
        beats:
          - say: "Mira. Te lo cuento una vez. Me mandaron quemar una aldea con la gente dentro. Escondía a deudores de la casa."
            mood: triste
          - say: "Dije que no. Prendieron fuego igual. Saqué a los que pude por la parte del río."
            mood: triste
          - say: "Mi escuadra se fue al monte conmigo. Ahora roban ovejas para comer. Por mi culpa. Quiero ir a buscarlos."
            replies:
              - { text: "Le dices que irás con él.", bond: 1, then: "Están en el robledal de Torre Brezo. Si me ven contigo, a lo mejor no me tiran piedras.", mood: alegre }
              - { text: "Le dices que no fue culpa suya.", bond: 1, then: "Mira, eso me lo digo yo cada noche. Contigo suena mejor." }
              - { text: "Le dices que eso le puede costar la cabeza en Brezo.", bond: 0, then: "Mi cabeza ya tiene precio. Lo que no tiene precio es esa escuadra." }
      - rank: 6
        title: El chico de la espada de palo
        where: plaza
        beats:
          - say: "Mira, no te lo he dicho. Sancho de Brezo, el heredero, aprendió a coger una espada conmigo. Una de palo. Tenía ocho años."
          - say: "Ahora su madre ha puesto precio a mi cabeza, y él lo pagaría. Y yo... yo todavía le quiero como a un sobrino."
            mood: triste
            replies:
              - { text: "Le dices que quizá Sancho no sabe lo que pasó en Los Brezales.", bond: 1, then: "No lo sabe. Su madre se lo ha callado. Y yo no sé si quiero que se entere.", mood: triste }
              - { text: "Le dices que un chico que aprendió contigo no puede ser tan malo.", bond: 1, then: "Aprendió a coger la espada. Lo de cuándo no usarla, todavía no.", mood: alegre }
              - { text: "Le dices que se olvide de Sancho.", bond: -1, then: "Mira, eso no se olvida. Ni se debe." }
      - rank: 8
        title: Una casa y un hacha
        where: posada
        beats:
          - say: "Quiero volver a cortar leña. Una casa, un hacha, y que nadie me pida quemar nada nunca más."
          - say: "Lo digo y suena a poco. Pero mira, para mí es todo."
            replies:
              - { text: "Le dices que no es poco: es lo que quiere casi todo el mundo.", bond: 1, then: "Entonces casi todo el mundo y yo tenemos algo en común. Eso es nuevo.", mood: alegre }
              - { text: "Le dices que le ayudarás a levantar esa casa.", bond: 1, then: "Tú pones las vigas, yo la leña. Y el tejado, a medias.", mood: alegre }
              - { text: "Le dices que con su fuerza podría ser capitán de cualquier casa.", bond: 0, then: "Ya fui sargento de una. Con una vez basta." }
      - rank: 10
        title: El primero que diga que no
        where: plaza
        beats:
          - say: "Mira, he pensado mucho. Si alguien te pide que quemes algo, iré yo delante a decirle que no."
            mood: alegre
          - say: "Y si no escucha, el hacha ya sabe lo que hacer. Pero primero, que no. Siempre primero que no."
            replies:
              - { text: "Le dices que contigo no tendrá que decirlo.", bond: 1, then: "Ya lo sé. Por eso lo digo: porque contigo no hará falta.", mood: alegre }
              - { text: "Le das la mano, como se cierra un trato.", bond: 1, then: "Trato. De los que no se escriben.", mood: alegre }

confidente:
  id: gudrun
  al_llegar:
    forjas-de-hondaroca: "Las forjas no se apagan nunca. Mi abuelo decía que el día que se apagaran, se apagaría el clan."
    ermita-del-collado: "Aquí duerme mi abuelo. Pisa despacio, que a los muertos enanos no les gusta el ruido."
    la-atalaya: "La puerta de mi abuelo. Sesenta años cerrada para nosotros. Hoy no."
  paquete:
    scenes:
      - rank: 2
        title: La puerta del abuelo
        where: posada
        beats:
          - say: "Mi abuelo cerraba la puerta de la Atalaya cada noche y la abría cada mañana. A quien llegara. Eso era ser thane, para él."
          - say: "¿En tu casa había alguien así? ¿Alguien que abría la puerta?"
            replies:
              - { text: "Le hablas de la persona que te abría la puerta en tu infancia.", bond: 1, then: "Pues esa persona y mi abuelo se habrían entendido. Que la forja la guarde.", mood: alegre }
              - { text: "Le dices que en tu casa las puertas siempre estaban cerradas.", bond: 0, then: "Entonces te debo una puerta abierta. Te la daré.", mood: triste }
              - { text: "Le dices que una puerta abierta a todos es una puerta sin guardia.", bond: -1, then: "Una puerta abierta a todos es la más guardada que hay. Ya lo entenderás.", mood: enfadado }
      - rank: 4
        title: El papel de la thane
        where: plaza
        beats:
          - say: "Mi tía ha vendido a Oramar el derecho del clan sobre la Atalaya. Firmado y sellado. El papel lo guarda el prestamista de Vadoancho."
            mood: enfadado
          - say: "Si Oramar enciende el fanal con ese papel en la mano, Hondaroca no podrá decir nunca nada. Ni en cien años."
            mood: triste
          - say: "Quiero recuperar ese papel. Comprado o robado, me da igual. Pero no sola."
            replies:
              - { text: "Le dices que iréis a Vadoancho a por ese papel.", bond: 1, then: "Pues en marcha. Y si hay que romper una cerradura, que sea de las caras.", mood: alegre }
              - { text: "Le preguntas si su tía lo sabrá.", bond: 1, then: "Lo sabrá. Y golpeará la mesa. Y después, quizá, me dará las gracias." }
              - { text: "Le dices que robarle a Oramar es buscar una guerra.", bond: 0, then: "La guerra ya está buscada. Yo solo quiero que no la paguemos nosotros." }
      - rank: 6
        title: La luz
        where: posada
        beats:
          - say: "Te voy a contar una cosa que no sabe nadie del clan. Le tengo miedo a la oscuridad. Una enana. Imagínate."
            mood: triste
          - say: "Por eso aprendí la luz antes que ninguna otra bendición. En la mina del Grajo iba rezando para que no se me apagara."
            replies:
              - { text: "Le dices que bajó a la mina igual, con miedo, y eso vale el doble.", bond: 1, then: "Eso decía mi abuelo de los valientes. Gracias.", mood: alegre }
              - { text: "Le prometes que, si se le apaga la luz, tú estarás al lado.", bond: 1, then: "Entonces la apagaré alguna vez, a ver si es verdad.", mood: alegre }
              - { text: "Le dices que una enana con miedo a la oscuridad es un chiste.", bond: -1, then: "Lo es. Por eso no se lo cuento a nadie.", mood: enfadado }
      - rank: 8
        title: Guardiana, no thane
        where: plaza
        beats:
          - say: "No quiero ser thane. Mi tía cree que sí, y me vigila. No quiero mandar en nadie."
          - say: "Quiero ser la guardiana de la puerta de la Atalaya. Abrir cada mañana y cerrar cada noche. Como él."
            replies:
              - { text: "Le dices que no se le ocurre nadie mejor para esa puerta.", bond: 1, then: "Ni a mí. Pero es la primera vez que lo dice alguien más.", mood: alegre }
              - { text: "Le dices que una guardiana también manda: en la puerta.", bond: 1, then: "En la puerta sí. Ahí no me importa mandar." }
              - { text: "Le dices que el clan necesitará una thane después de su tía.", bond: 0, then: "El clan necesitará muchas cosas. Que las haga otra." }
      - rank: 10
        title: La puerta para ti
        where: posada
        beats:
          - say: "Pase lo que pase en el paso, mi puerta se abrirá siempre para ti. Aunque llegues de noche, aunque llegues con medio reino detrás."
            mood: alegre
          - say: "Te lo juro por la forja. Y una enana no jura por la forja en vano."
            replies:
              - { text: "Le dices que tu puerta también se abrirá siempre para ella.", bond: 1, then: "Entonces tenemos dos puertas. Eso es más de lo que tenía mi abuelo.", mood: alegre }
              - { text: "Le pides que te enseñe a cerrar una puerta enana.", bond: 1, then: "Primero se cierra con la mano. Luego, con el nombre. Mañana te enseño.", mood: alegre }

confidente:
  id: pia
  al_llegar:
    tres-mojones: "Mi puente. Medio puente. Aguantaba seis carros, y lo han tirado con una sierra. Ya lo arreglaré."
    vadoancho: "Aquí está el dinero que no me dieron para el puente. Todo junto, en una casa con la puerta más gorda que un templo."
    la-calzada-rota: "Este terraplén lo hizo alguien que no sabía de agua. Se nota a diez carros de distancia."
  paquete:
    scenes:
      - rank: 2
        title: Seis carros
        where: plaza
        beats:
          - say: "Seis carros. Eso aguantaba mi puente. Lo calculé tres veces, con tres reglas distintas. Las tengo aquí."
            mood: alegre
          - say: "¿Tú haces las cosas una vez o tres?"
            replies:
              - { text: "Le dices que tú, una, y rápido.", bond: 0, then: "Así se caen los puentes. Bueno, así y con una sierra." }
              - { text: "Le dices que tres, como ella.", bond: 1, then: "¡Por fin alguien con sentido! Te enseñaré a medir con hilo.", mood: alegre }
              - { text: "Le preguntas para qué tres reglas.", bond: 1, then: "Una miente, otra se equivoca y la tercera desempata. Como en un consejo." }
      - rank: 4
        title: Diez años pidiendo
        where: posada
        beats:
          - say: "Llevaba diez años pidiendo dinero para reforzar el puente. Diez. Brezo me mandaba a Oramar, Oramar me mandaba a los enanos y los enanos, a Brezo."
            mood: enfadado
          - say: "Al final no hizo falta reforzarlo. Lo serraron. Eso no lo calculé."
            mood: triste
            replies:
              - { text: "Le dices que nadie calcula una sierra.", bond: 1, then: "Pues el próximo lo calculo con sierra incluida. Doce carros y una sierra.", mood: alegre }
              - { text: "Le dices que cuando acabe esto, el puente se hará con el dinero de las tres casas.", bond: 1, then: "Eso lo apuntas tú. Que a mí ya no me creen." }
              - { text: "Le dices que deje el puente y se busque otro oficio.", bond: -1, then: "¿Otro oficio? Antes me hago puente yo.", mood: enfadado }
      - rank: 6
        title: El primer puente
        where: plaza
        beats:
          - say: "Mi primer puente se cayó. Hace veinte años. Era de madera verde, y yo no sabía que la madera verde se encoge."
            mood: triste
          - say: "Iban dos personas encima. Una salió. Por eso lo calculo todo tres veces."
            replies:
              - { text: "Le dices que aquel error salvó a mucha gente después.", bond: 1, then: "Eso me digo. Hay días que me lo creo.", mood: triste }
              - { text: "Te quedas a su lado mirando el río, sin decir nada.", bond: 1, then: "Gracias por no decir nada. Es lo que mejor se dice." }
              - { text: "Le dices que eso no fue culpa suya.", bond: 0, then: "Sí lo fue. Pero se puede vivir con eso. Despacio." }
      - rank: 8
        title: Un puente que no se sierra
        where: posada
        beats:
          - say: "Quiero hacer un puente de piedra en Tres Mojones. Que no se pueda serrar. Para las tres casas y para quien no tenga casa."
            mood: alegre
          - say: "Doce carros. Arcos dobles. Ya tengo el dibujo. ¿Quieres verlo?"
            replies:
              - { text: "Le dices que sí, y que lo quieres ver construido.", bond: 1, then: "Pues tendrás que venir a la inauguración. Te pongo en primera fila.", mood: alegre }
              - { text: "Le preguntas quién lo pagará.", bond: 0, then: "Quien gane el paso. Se lo pienso cobrar con intereses." }
      - rank: 10
        title: Un puente para ti
        where: plaza
        beats:
          - say: "Te he dibujado un puente. A donde tú quieras. Dime un río y lo construyo."
            mood: alegre
          - say: "No es una forma de hablar. Es un dibujo de verdad, con medidas. Tres veces calculado."
            replies:
              - { text: "Le dices que el río da igual, que lo quieres porque es suyo.", bond: 1, then: "Entonces lo pongo encima de la puerta de tu casa. Que lo vea todo el mundo.", mood: alegre }
              - { text: "Le pides un puente sobre el río de Tres Mojones.", bond: 1, then: "Ese ya lo tenía pensado. Ahora lleva tu nombre en el primer arco.", mood: alegre }

confidente:
  id: telmo
  al_llegar:
    refugio-de-la-cabra: "Veinte inviernos subiendo sal por aquí. Nieves todavía me debe una cena. O yo a ella, no me acuerdo."
    vadoancho: "La esclusa. Mejor no me mires mientras pasamos. Ni me nombres."
    campamento-del-cierzo: "Conozco a la cocinera. Mencía. Me debe dos cazos de los buenos."
  paquete:
    scenes:
      - rank: 2
        title: Veinte inviernos
        where: posada
        beats:
          - say: "Veinte inviernos subiendo sal por el paso sin pagar peaje. Eso, en el paso, vale una fortuna. A mí me ha dado para un abrigo con remiendos."
            mood: alegre
          - say: "¿Tú por qué viajas? Y no me digas que por gusto, que eso no lo paga nadie."
            replies:
              - { text: "Le dices que por un anillo que vale una guerra.", bond: 1, then: "Eso sí que es un buen motivo. Mal pagado, pero bueno.", mood: alegre }
              - { text: "Le dices que por dinero, como él.", bond: 1, then: "¡Por fin alguien sincero! Te invito a algo. Pagas tú, claro.", mood: alegre }
              - { text: "Le dices que eso no es asunto suyo.", bond: 0, then: "Todo es asunto mío hasta que me pagan por olvidarlo." }
      - rank: 4
        title: Lo que cobra un guardia
        where: plaza
        beats:
          - say: "Tenía un socio. Benito. Subíamos juntos. Un invierno, un guardia de Brezo pidió más de lo de siempre y Benito no quiso pagar."
            mood: triste
          - say: "Lo dejaron en la nieve. Desde entonces pago siempre. Lo que pidan. Eso, en el paso, vale la vida."
            replies:
              - { text: "Le dices que lo siente por Benito.", bond: 1, then: "Gracias. Benito habría regateado hasta eso.", mood: triste }
              - { text: "Le preguntas si se acuerda del guardia.", bond: 1, then: "De su cara, cada noche. De su nombre, por suerte, no." }
              - { text: "Le dices que en ese oficio se sabe lo que hay.", bond: 0, then: "Se sabe. Eso no lo hace más barato." }
      - rank: 6
        title: La niña de Los Sauces
        where: posada
        beats:
          - say: "No se lo digas a nadie. Tengo una hija en Los Sauces. Se llama Avellana, como yo. Bueno, como mi apellido."
            mood: alegre
          - say: "Todo lo que gano se lo mando. Por eso cobro tanto. No soy codicioso: soy padre."
            replies:
              - { text: "Le dices que su secreto está a salvo.", bond: 1, then: "Eso, en el paso, vale más que la sal. Gracias.", mood: alegre }
              - { text: "Le dices que la próxima vez que paséis por Los Sauces, la visitará.", bond: 1, then: "La visitaré. Y le llevaré algo. Pagado, por una vez.", mood: alegre }
              - { text: "Le dices que entonces le cobrarás menos tú a él.", bond: 0, then: "Ah, no. Eso no. Los negocios son los negocios." }
      - rank: 8
        title: Una taberna en el paso
        where: plaza
        beats:
          - say: "Quiero retirarme honrado. Abrir una taberna en el paso, al lado del refugio. Que Nieves me odie por la competencia."
            mood: alegre
          - say: "Sal con peaje, vino con factura y una cama para quien llegue con nieve. ¿A que suena raro en mi boca?"
            replies:
              - { text: "Le dices que suena bien, aunque raro.", bond: 1, then: "Raro y bien. Como yo.", mood: alegre }
              - { text: "Le dices que serás su primer cliente.", bond: 1, then: "Y el primero en pagar. Te lo apunto ya." }
              - { text: "Le dices que no durará ni un mes sin contrabandear.", bond: 0, then: "Un mes y medio. Te apuesto lo que quieras." }
      - rank: 10
        title: Gratis
        where: posada
        beats:
          - say: "Esta vez no te cobro. Bueno, un poco. No: nada. Nada de nada."
            mood: alegre
          - say: "Lo que necesites, te lo consigo. Ganzúas, un camino, una cena. Gratis. Me duele decirlo, pero es verdad."
            replies:
              - { text: "Le das las gracias de corazón.", bond: 1, then: "No me las des, que me acostumbro y vuelvo a cobrar.", mood: alegre }
              - { text: "Le dejas una moneda igual, por costumbre.", bond: 1, then: "...La guardo para Avellana. Gracias, socio.", mood: alegre }
