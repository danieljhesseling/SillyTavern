# Las tierras del ocaso — ronda 5: el hilo, hablado, y los finales

> Escrita por Claude (tanda 20, 2026-10-03). Dieciséis hitos en cuatro actos y dos secretos. Cada escena la dice la gente que está allí (D-J60: no hay narrador). Nadie tiene nombre hasta que se presenta (J13.7).
>
> **Cómo se juega el hilo.** La escena de un hito sale al abrirse, salvo la de un «llegar a», que sale al llegar. Por eso cada escena la dice quien está donde estás tú cuando sale: la de la pelea de la calzada la cuenta la alcaldesa de Los Sauces antes de salir; la de la cámara de Fullero, el caminero, al acabar la pelea de la calzada.
>
> **La bandera.** Al llegar al refugio, la refugiera pregunta con qué bandera subes. Es la decisión que no tiene vuelta atrás: cada respuesta cumple su hito de bandera (`bandera-brezo`, `bandera-oramar` o `bandera-hondaroca`), que cierra los otros dos y pone a esa casa muy a favor y a las otras dos muy en contra. El fanal, al final, se enciende con la bandera de la casa que mejor te mira (`final_segun`).
>
> **El nivel no sube por los hitos** (D-J59): sale de pelear, de los encargos y de las misiones de los compañeros. La Atalaya es para nivel 5 y es dura.

## Acto 1: El puente roto

hito:
  id: m-puente
  acto: 1
  titulo: El puente de Tres Mojones
  abre: al_empezar
  pide: "ganar_tablero: enc-puente"
  cambia:
    abre_hito: [m-notario]
  pista: "Aguanta junto al carro del notario hasta que lleguen las barcas de la posada."
  escena: "En Tres Mojones se parte el puente con el carro del notario del rey encima. Unos mercenarios de capa gris saltan a por el cofre que lleva, y hay que aguantar junto al carro hasta que lleguen las barcas."
  paquete:
    backdrop: muelle
    beats:
      - who: Brígida Cantueso
        mood: enfadado
        text: "¡El puente! ¡Se ha partido con el carro del notario encima!"
      - who: Pía Rueda
        mood: enfadado
        text: "¡Mi puente no se cae solo! Soy Pía Rueda, y lo construí para aguantar seis carros. Alguien lo ha tocado."
      - who: Rufino Albarda
        mood: triste
        text: "¡Primero, sacadme de aquí! ¡Segundo, el cofre! ¡Tercero, ay, mi pierna!"
      - who: Brígida Cantueso
        mood: enfadado
        text: "Y por la orilla vienen unos de capa gris, con espadas. Esos no vienen a ayudar, {forastero|forastera}."
        options:
          - id: al-carro
            text: "Corro al carro a sacar al viejo."
            effects: [{ attitude: 1, who: Rufino Albarda }, { board: El puente caído }]
            reply: { who: Rufino Albarda, mood: alegre, text: "¡Gracias! Primero, gracias. Segundo, el cofre: que no se lo lleven." }
          - id: al-cofre
            text: "Agarro el cofre antes de que se lo lleven."
            effects: [{ attitude: -1, who: Rufino Albarda }, { board: El puente caído }]
            reply: { who: Rufino Albarda, mood: enfadado, text: "¡El cofre después! ¡Primero, yo, que me hundo!" }
          - id: a-la-orilla
            text: "Me planto en la orilla, delante de los de capa gris."
            check:
              skill: intimidation
              dc: 12
              success:
                effects: [{ board: El puente caído }]
                reply: { who: Brígida Cantueso, mood: alegre, text: "¡Eso! Mira cómo frenan. Ahora se lo piensan dos veces." }
              failure:
                effects: [{ board: El puente caído }]
                reply: { who: Brígida Cantueso, mood: triste, text: "Ni te miran. Ahí vienen, y son cuatro." }

hito:
  id: m-notario
  acto: 1
  titulo: El notario del rey
  abre: "tras_hito: m-puente"
  pide: "hablar_con: rufino"
  cambia:
    abre_hito: [m-sierra]
  pista: "Habla con el notario del rey en la posada de Tres Mojones: dice que lo que llevaba en el cofre lo quieren todos."
  escena: "Las barcas sacan del río al notario del rey. En la posada cuenta lo que llevaba: la Carta del Paso, que da el paso de la montaña a quien encienda el fanal de la Atalaya con su bandera, y el Sello de la Grulla, el anillo que abre su puerta. Con la pierna rota, te pide que lo lleves tú."
  paquete:
    backdrop: posada
    beats:
      - who: Brígida Cantueso
        text: "Ya está fuera. Soy Brígida, llevo la posada. Al viejo lo tienes en la mesa del fondo, y la sopa son dos sueldos."
      - who: Rufino Albarda
        mood: alegre
        text: "Primero, gracias. Segundo, me presento: Rufino Albarda, notario del rey. Tercero, gracias otra vez."
        alt:
          - if: { chose: al-cofre }
            mood: enfadado
            text: "Primero, salvaste el cofre antes que a mí. Segundo, me presento igual: Rufino Albarda, notario del rey."
      - who: Rufino Albarda
        text: "Llevo dos cosas a la Atalaya de la Grulla. La Carta del Paso, y este anillo de hierro: el Sello de la Grulla."
      - who: Rufino Albarda
        text: "La Carta dice que quien encienda el fanal de la Atalaya con su bandera manda en el paso hasta el deshielo. Y el sello es lo único que abre su puerta."
      - who: Pía Rueda
        mood: enfadado
        text: "Y alguien ha serrado mi puente para que no llegues. Los cortes son limpios, de sierra grande, hechos desde una barca."
      - who: Rufino Albarda
        mood: triste
        text: "Con esta pierna no subo ni a la posada. Llévalo tú. Las tres casas te ofrecerán de todo por él. Primero, no lo vendas. Segundo, elige bien la bandera."
        options:
          - id: llevarlo
            text: "Lo llevaré a la Atalaya. Tienes mi palabra."
            effects: [{ attitude: 1 }]
            reply: { who: Rufino Albarda, mood: alegre, text: "Cláusula tres: «en mano de persona de palabra». Ya la tengo." }
          - id: cobrar
            text: "Lo llevo, pero el camino es largo. ¿Cuánto pagas?"
            effects: [{ gold: 20 }, { attitude: -1 }]
            reply: { who: Rufino Albarda, mood: enfadado, text: "Veinte sueldos, que es lo que llevo. Primero me salvas y luego me cobras. Muy del reino, eso." }
          - id: quien
            text: "¿Quién quiere que no llegues?"
            effects: [{ clue: "Las tres casas y los mercenarios de capa gris quieren el sello del notario." }]
            reply: { who: Rufino Albarda, text: "Primero, Brezo. Segundo, Oramar. Tercero, los enanos. Cuarto, los de capa gris. Es más corto decir quién no." }
          - id: cancion
            text: "Te prometo una canción sobre tu pierna si me cuentas la Carta entera."
            if: { class: Bardo }
            effects: [{ attitude: 1 }]
            reply: { who: Rufino Albarda, mood: alegre, text: "La cláusula siete rima, fíjate. Las demás no, pero te las cuento igual." }
      - who: Pía Rueda
        text: "Yo me quedo a mirar los pilares. Si quieres saber quién compró esa sierra, empieza por Los Sauces: allí se venden las grandes."

hito:
  id: m-sierra
  acto: 1
  titulo: Las sierras grandes
  abre: "tras_hito: m-notario"
  pide: "llegar: los-sauces"
  cambia:
    abre_hito: [m-calzada]
  pista: "Ve a Los Sauces, la aldea de los molinos, a un día de Tres Mojones: allí se compraron las sierras grandes."
  escena: "En Los Sauces, la alcaldesa enseña la sierra de mango gris que alguien perdió junto al río. El molinero vio a los de capa gris comprar todas las sierras de la aldea y bajar luego por la calzada vieja."
  paquete:
    backdrop: plaza
    beats:
      - who: Herminia Sauce
        mood: enfadado
        text: "¿Vienes a contar sacos? Este mes ya han venido tres. Soy Herminia, la alcaldesa, y aquí los sacos los cuento yo."
      - who: Herminia Sauce
        text: "¿Una sierra grande, dices? Mira lo que se dejaron junto al río la noche que cayó el puente. El mango, pintado de gris."
      - who: Herminia Sauce
        text: "Pascual, el molinero, ha visto más que yo. Pascual, cuéntale lo que me contaste."
        presenta: pascual
      - who: Pascual Trigo
        mood: triste
        text: "Yo no he visto nada. Bueno, un poco. Unos de capa gris compraron todas las sierras de la aldea. Pero poco."
        options:
          - id: calma
            text: "Cuéntamelo todo, Pascual. Nadie te va a hacer nada."
            check:
              skill: persuasion
              dc: 12
              success:
                effects: [{ clue: "Los de capa gris eran seis y bajaron por la calzada vieja, hacia Vadoancho. Pagaron con monedas nuevas." }]
                reply: { who: Pascual Trigo, text: "Eran seis. Bajaron por la calzada vieja, hacia Vadoancho. Y pagaron con monedas nuevas, como las de la posada." }
              failure:
                reply: { who: Pascual Trigo, mood: enfadado, text: "¡Ya he dicho bastante! Bueno, casi. Preguntad al caminero de la calzada." }
          - id: amenazar
            text: "O hablas, o le cuento a Brezo lo de los sacos tapados con paja."
            effects: [{ attitude: -1, who: Herminia Sauce }, { clue: "Los de capa gris bajaron por la calzada vieja; el caminero los vio pasar." }]
            reply:
              - { who: Pascual Trigo, mood: triste, text: "¡No, no! Bajaron por la calzada vieja. El caminero los vio. ¡Pero lo de los sacos no!" }
              - { who: Herminia Sauce, mood: enfadado, text: "En mi aldea no se amenaza a la gente, {forastero|forastera}. Que no se repita." }
          - id: semiorco
            text: "Me miras como si fuera a comerte. No muerdo."
            if: { species: Semiorco }
            effects: [{ attitude: 1 }]
            reply: { who: Pascual Trigo, mood: alegre, text: "Perdón, perdón. Es que el último semiorco que vi era el sargento Zarzal, y era buena gente. Bajaron por la calzada, eso es todo." }
      - who: Herminia Sauce
        text: "La calzada vieja está a un día. Si vuelves por aquí, el molino tiene ladrones y yo tengo trabajo que pagar."

hito:
  id: m-calzada
  acto: 1
  titulo: La emboscada de la calzada
  abre: "tras_hito: m-sierra"
  pide: "ganar_tablero: enc-calzada"
  cambia:
    abre_hito: [m-fullero]
  pista: "Sigue a los de capa gris por la calzada vieja: te esperan en el tramo roto, junto al barranco."
  escena: "Los de capa gris saben que los sigues. En el tramo roto de la calzada, donde el camino va pegado al barranco, un cabo del Cierzo y los suyos esperan para quitarte el sello."
  paquete:
    backdrop: plaza
    beats:
      - who: Pascual Trigo
        mood: triste
        text: "Una cosa más. Uno de ellos llevaba un silbato de hueso colgado del cuello. Los otros le obedecían."
      - who: Herminia Sauce
        text: "Un cabo, entonces. El tramo roto de la calzada está a un día. Allí el camino va pegado al barranco, y si te esperan, será allí."
      - who: Herminia Sauce
        mood: enfadado
        text: "¿Cómo piensas pasar?"
        options:
          - id: de-frente
            text: "Por el camino, de frente. Que me vean llegar."
            reply: { who: Herminia Sauce, mood: alegre, text: "Valiente, o {tonto|tonta}. En la calzada se sabrá cuál de las dos." }
          - id: por-la-cuneta
            text: "Por la cuneta, entre las zarzas."
            effects: [{ clue: "En el tramo roto de la calzada, la cuneta tiene zarzas para esconderse, pero da al barranco." }]
            reply: { who: Herminia Sauce, text: "Cuidado con el barranco. Las zarzas no avisan de dónde se acaba el suelo." }
          - id: un-saco
            text: "Dejo dos sueldos para los huérfanos del molino."
            effects: [{ gold: -2 }, { attitude: 1 }]
            reply: { who: Herminia Sauce, mood: alegre, text: "Dos sueldos son dos sueldos. Te debo una, {forastero|forastera}." }

## Acto 2: Las tres casas

hito:
  id: m-fullero
  acto: 2
  titulo: La casa de préstamos
  abre: "tras_hito: m-calzada"
  pide: "ganar_tablero: enc-camara"
  cambia:
    abre_hito: [m-libro]
  pista: "En Vadoancho, entra en la casa de préstamos, coge el libro de pagos de su cámara y sal por la puerta del canal."
  escena: "El cabo del Cierzo llevaba un recibo de la casa de préstamos de Vadoancho. El prestamista apunta en un libro quién paga a los de capa gris, y lo guarda en su cámara."
  paquete:
    backdrop: La Calzada Rota
    beats:
      - who: Dámaso Losa
        text: "Cinco de capa gris menos en mi calzada. Me llamo Dámaso, y cuido de estas piedras desde antes de que nacieras."
      - who: Dámaso Losa
        text: "El cabo llevaba esto en la bolsa. Es un recibo: «Pagado en la casa de préstamos de Marcos Fullero, Vadoancho»."
      - who: Dámaso Losa
        mood: triste
        text: "Fullero presta a las tres casas. Quien paga al Cierzo, lo paga por su mano, y él lo apunta todo en un libro. Lo guarda en la cámara."
        options:
          - id: leer-libro
            text: "Entonces habrá que leer ese libro."
            effects: [{ clue: "La casa de préstamos de Fullero tiene una puerta al canal con bisagras baratas." }]
            reply: { who: Dámaso Losa, mood: alegre, text: "La cerradura de la cámara es de las caras. La bisagra de la puerta del canal, de las baratas. Eso dice la gente del río." }
          - id: capa-gris
            text: "¿Quiénes son los de capa gris?"
            effects: [{ rumor: r-campamento }]
            reply: { who: Dámaso Losa, mood: enfadado, text: "La Compañía del Cierzo. Mercenarios. Cobran de las tres casas y suben carros de noche hacia el collado." }
          - id: terraplen
            text: "Cuando acabe todo esto, te ayudo con el terraplén."
            effects: [{ attitude: 1 }]
            reply: { who: Dámaso Losa, mood: alegre, text: "Eso me dijeron las tres casas. Pero tú tienes cara de cumplirlo." }
      - who: Dámaso Losa
        text: "Vadoancho está a un día, río abajo. Este mojón dice seis leguas. Miente: son siete."

hito:
  id: m-libro
  acto: 2
  titulo: Hagamos un trato
  abre: "tras_hito: m-fullero"
  pide: "hablar_con: tristan"
  cambia:
    abre_hito: [m-torre]
    revela: [campamento-del-cierzo]
    reputacion: { casa-oramar: -1 }
  pista: "Habla con el señor de Oramar, que te espera a la salida del canal de Vadoancho."
  escena: "El libro de pagos dice que las tres casas pagan al Cierzo, y Oramar más que nadie. Don Tristán Oramar te espera a la salida del canal: no llama a la guardia, te ofrece un trato por el sello. La sacerdotisa de la Ribera lee contigo dónde acampa el Cierzo: bajo el collado de la ermita."
  paquete:
    backdrop: plaza
    beats:
      - who: Tristán Oramar
        mood: alegre
        text: "Qué manera tan elegante de salir por un canal. Tristán Oramar. Esta ciudad es mía, y ese libro es de mi prestamista."
      - who: Tristán Oramar
        text: "No te preocupes, no llamo a la guardia. Hagamos un trato: tú me escuchas y yo te invito a cenar."
      - who: Tristán Oramar
        text: "Lo que vas a leer ahí es esto: las tres casas pagan al Cierzo. Yo también. Les pagué para que retrasaran a Brezo, y ahora su capitán trabaja para sí mismo."
      - who: Tristán Oramar
        mood: alegre
        text: "Dame el sello y la bandera de Oramar sube al fanal. Pasará quien pague, y pagará todo el mundo. No hay nada más justo que un precio."
        alt:
          - if: { chose: cobrar }
            text: "Me han dicho que cobras por llevar el sello. Mejor: quien cobra entiende los tratos. Dámelo, y pon tú el precio."
        options:
          - id: cenar
            text: "Ceno contigo. Pero el sello se queda conmigo."
            effects: [{ attitude: 1 }]
            reply: { who: Tristán Oramar, mood: alegre, text: "Me basta con la cena. Por ahora." }
          - id: nunca
            text: "El paso no es una tienda. No."
            effects: [{ attitude: -1 }]
            reply: { who: Tristán Oramar, mood: enfadado, text: "Todo es una tienda. Lo que pasa es que unos ponen el precio y otros lo pagan." }
          - id: mecenas
            text: "Tu sello de barco saldrá en mi próxima canción. ¿De héroe o de pirata?"
            if: { class: Bardo }
            effects: [{ attitude: 1 }]
            reply: { who: Tristán Oramar, mood: alegre, text: "De mecenas. Paga mejor que las otras dos." }
      - who: Madre Orosia
        text: "{Hijo|Hija}, soy la madre Orosia, del templo de la Ribera. Si ese libro dice lo que creo, ven a leerlo conmigo."
      - who: Madre Orosia
        mood: triste
        text: "Mira esta hoja. Cuarenta sueldos al mes de Brezo, cuarenta de Oramar, treinta de Hondaroca. Y abajo: «entregar en el campamento bajo el collado de la ermita»."
        options:
          - id: a-brezo
            text: "Brezo tiene que saber que Oramar paga al Cierzo contra ella."
            effects: [{ clue: "El libro de Fullero: las tres casas pagan al Cierzo, y el Cierzo acampa bajo el collado de la ermita." }]
            reply: { who: Madre Orosia, text: "Pues Torre Brezo está a dos días. Lleva el libro, y lleva también pan, que allí comen media ración." }
          - id: guardarlo
            text: "Lo guardo yo. Nadie más tiene que leerlo todavía."
            effects: [{ attitude: 1 }]
            reply: { who: Madre Orosia, mood: alegre, text: "Prudente. Que la Ribera te lo pague, {hijo|hija}, que yo no puedo." }

hito:
  id: m-torre
  acto: 2
  titulo: La torre del brezal
  abre: "tras_hito: m-libro"
  pide: "llegar: torre-brezo"
  cambia:
    abre_hito: [m-puerta]
  pista: "Ve a Torre Brezo, a dos días de Vadoancho: la señora de Brezo también paga al Cierzo, y quiere el sello."
  escena: "En Torre Brezo comen media ración desde agosto. Doña Ilduara de Brezo lleva las cuentas ella misma y debe a Oramar hasta las rejas de la torre. Quiere el paso para que las tierras altas coman este invierno."
  paquete:
    backdrop: posada
    beats:
      - who: Ordoño Galindo
        mood: triste
        text: "Media ración, desde agosto. Si vienes a comer, llegas tarde. Ordoño Galindo, castellano de esta torre."
      - who: Ilduara de Brezo
        text: "Doce sueldos el saco, catorce si lo pide Oramar. Y tú traes en el dedo algo que vale más que todo mi granero."
        alt:
          - if: { chose: nunca }
            text: "Me han contado que le dijiste que no a Oramar en su propia ciudad. Eso lo apunto a tu favor."
      - who: Ilduara de Brezo
        text: "Ilduara de Brezo. Debo cuatro mil sueldos a Oramar, al último sueldo. Si tengo el paso, las tierras altas comen este invierno."
      - who: Ilduara de Brezo
        mood: enfadado
        text: "Si lo tiene Oramar, mi gente paga el grano a precio de hambre. Eso no es política. Es aritmética."
        options:
          - id: tambien-pagas
            text: "El libro de Fullero dice que tú también pagas al Cierzo."
            effects: [{ attitude: -1 }]
            reply: { who: Ilduara de Brezo, mood: enfadado, text: "Cuarenta sueldos al mes, para que despejaran el camino. No lo han despejado. También eso está en mis cuentas." }
          - id: brezales
            text: "¿Y Los Brezales? ¿También fue aritmética?"
            check:
              skill: insight
              dc: 13
              success:
                effects: [{ clue: "Doña Ilduara ordenó quemar Los Brezales porque escondía a deudores de la casa." }]
                reply: { who: Ilduara de Brezo, mood: triste, text: "Escondía a gente que me debía. Di la orden. No la repetiría. Esa cuenta no la cierro nunca." }
              failure:
                reply: { who: Ilduara de Brezo, mood: enfadado, text: "Fue un rayo. Y en mi torre no se vuelve a preguntar." }
          - id: escuchar
            text: "Si tu gente pasa hambre, te escucharé cuando llegue la hora."
            effects: [{ attitude: 1 }]
            reply: { who: Ilduara de Brezo, text: "No pido más. Lo apunto." }

## Acto 3: La subida

hito:
  id: m-puerta
  acto: 3
  titulo: La puerta de las Forjas
  abre: "tras_hito: m-torre"
  pide: "ganar_tablero: enc-puerta"
  cambia:
    abre_hito: [m-grajo]
    revela: [boca-del-grajo]
    reputacion: { casa-hondaroca: 2 }
  pista: "Ve a las Forjas de Hondaroca, a dos días de Torre Brezo, y aguanta en la puerta grande hasta que bajen las rejas."
  escena: "Un jinete de Hondaroca llega a Torre Brezo reventado: los trasgos golpean la puerta grande de las Forjas, y alguien con botas de soldado los empuja. No pide ayuda la thane: la pide la nieta del último thane de la Atalaya."
  paquete:
    backdrop: plaza
    beats:
      - who: Ordoño Galindo
        mood: enfadado
        text: "¡Mi señora! Ha llegado un jinete de Hondaroca, reventado. Trasgos en la puerta grande de las Forjas."
      - who: Ilduara de Brezo
        text: "Los trasgos no suben solos a una puerta enana. Alguien los empuja. Alguien que no quiere a los enanos en el paso este invierno."
      - who: Ordoño Galindo
        mood: triste
        text: "Dice el jinete que la thane no pide ayuda. Que la pide la nieta del viejo thane, una clériga. Y que la puerta no aguanta otra noche."
      - who: Ilduara de Brezo
        text: "Las Forjas están a dos días. Brezo no tiene un soldado de sobra. Tú tienes piernas."
        options:
          - id: voy-forjas
            text: "Voy a las Forjas."
            effects: [{ attitude: 1 }]
            reply: { who: Ilduara de Brezo, text: "Bien. Un clan enano agradecido vale más que un granero lleno. Y yo no tengo ninguna de las dos cosas." }
          - id: un-soldado
            text: "Préstame un soldado y voy."
            check:
              skill: persuasion
              dc: 14
              success:
                effects: [{ give: Capa de lana de Brezo }]
                reply: { who: Ilduara de Brezo, text: "Un soldado no. Una capa de la guardia, que en la montaña abriga más que un soldado y come menos." }
              failure:
                reply: { who: Ilduara de Brezo, mood: enfadado, text: "Ni uno. Aquí contamos hasta a los que duermen." }

hito:
  id: m-grajo
  acto: 3
  titulo: El hielo de la mina
  abre: "tras_hito: m-puerta"
  pide: "ganar_tablero: enc-grajo"
  cambia:
    abre_hito: [m-campamento]
  pista: "Baja a la Boca del Grajo, la mina vieja de Hondaroca, a un día de las Forjas, y rompe los dos tótems de hielo del chamán."
  escena: "Han bajado las rejas de las Forjas. Los trasgos salen de la Boca del Grajo, la mina vieja del clan, donde un chamán hace crecer en las paredes un hielo que no es de la montaña. Si sigue, tirará la nieve de la ladera sobre el camino del paso."
  paquete:
    backdrop: plaza
    beats:
      - who: Gudrun Hondaroca
        mood: alegre
        text: "¡Han bajado las rejas! Soy Gudrun Hondaroca. Fui yo quien pidió ayuda, porque mi tía no la pide nunca."
      - who: Dagna Hondaroca
        mood: enfadado
        text: "No. Y no. Dagna Hondaroca, thane de este clan. No pedí ayuda y no la necesitaba. Gracias igual."
      - who: Dagna Hondaroca
        text: "Los trasgos salen de la Boca del Grajo, nuestra mina vieja. Y las paredes de allí se cubren de un hielo que no es de la montaña."
      - who: Gudrun Hondaroca
        mood: triste
        text: "Es un chamán. Si deja crecer ese hielo, tirará la nieve de la ladera sobre el camino del paso. Este invierno no subiría nadie."
      - who: Dagna Hondaroca
        mood: enfadado
        text: "Hondaroca no baja a esa mina por cuatro piedras viejas. Ni por la Atalaya."
      - who: Gudrun Hondaroca
        mood: enfadado
        text: "Yo sí bajo. Era la puerta de mi abuelo, tía."
        options:
          - id: con-gudrun
            text: "Bajo contigo, Gudrun."
            effects: [{ attitude: 1, who: Gudrun Hondaroca }]
            reply: { who: Gudrun Hondaroca, mood: alegre, text: "Lleva lámpara. Y no pises donde el hielo brille." }
          - id: oro-de-oramar
            text: "Thane, si el paso se cierra, el oro de Oramar no sube ni baja."
            check:
              skill: persuasion
              dc: 14
              success:
                effects: [{ attitude: 1, who: Dagna Hondaroca }, { give: Lámpara de minero }]
                reply: { who: Dagna Hondaroca, text: "...Toma una lámpara de las buenas. Y si encuentras viva a la minera que se llevaron los trasgos, tráemela." }
              failure:
                reply: { who: Dagna Hondaroca, mood: enfadado, text: "Mi oro es cosa mía. Y esta mesa también." }
          - id: piedras-muertos
            text: "Thane, esas piedras viejas son las de nuestros muertos."
            if: { species: Enano }
            effects: [{ attitude: 1, who: Dagna Hondaroca }]
            reply: { who: Dagna Hondaroca, mood: triste, text: "...Lo sé. Por eso no bajo yo. Baja tú." }

hito:
  id: m-campamento
  acto: 3
  titulo: El mapa de la sargento
  abre: "tras_hito: m-grajo"
  pide: "ganar_tablero: enc-fuga"
  cambia:
    abre_hito: [m-consejo]
    revela: [las-sendas-viejas]
  pista: "Entra en el campamento del Cierzo, bajo el collado de la ermita, y sal por la brecha del arroyo con el mapa de las Sendas Viejas."
  escena: "En la mina, una minera enana que los trasgos tenían atada cuenta que la sargento del Cierzo les pagaba en sal y lleva al cinto un mapa de las Sendas Viejas: con él, el Cierzo sube al paso en dos días. Su campamento está bajo el collado de la ermita."
  paquete:
    backdrop: La Boca del Grajo
    beats:
      - who: Berta Cascajo
        mood: triste
        text: "Cuarenta varas de pozo, y ni una escalera. Gracias por bajar. Berta Cascajo, minera."
      - who: Berta Cascajo
        mood: enfadado
        text: "Los trasgos cobraban del Cierzo, en sal. La sargento del Cierzo bajó dos veces a pagarles."
      - who: Berta Cascajo
        text: "Una tuerta, con dos cuchillos largos. Lleva al cinto un mapa de las Sendas Viejas, los caminos de los elfos. Con él suben al paso en dos días."
      - who: Berta Cascajo
        mood: enfadado
        text: "Su campamento está bajo el collado, pasada la ermita. Si les quitas el mapa, las casas llegan al paso a la vez que ellos."
        options:
          - id: de-noche
            text: "Entraré de noche y saldré con el mapa."
            effects: [{ clue: "La empalizada del Cierzo tiene una brecha sin tapar junto al arroyo." }]
            reply: { who: Berta Cascajo, mood: alegre, text: "Por la brecha del arroyo. Ningún centinela quiere taparla, porque nadie le paga por eso." }
          - id: llevarla
            text: "Primero te acompaño a las Forjas."
            effects: [{ attitude: 1 }]
            reply: { who: Berta Cascajo, mood: alegre, text: "Sé llegar sola, que la mina es mía. Tú ve a por esa tuerta." }

## Acto 4: El fanal

hito:
  id: m-consejo
  acto: 4
  titulo: El consejo del refugio
  abre: "tras_hito: m-campamento"
  pide: "llegar: refugio-de-la-cabra"
  cambia:
    abre_hito: [bandera-brezo, bandera-oramar, bandera-hondaroca]
  pista: "Ve al Refugio de la Cabra, el último techo antes del paso. Allí esperan las vanguardias de las tres casas."
  escena: "En el Refugio de la Cabra acampan las vanguardias de las tres casas: el heredero de Brezo, la capitana de Oramar y el capitán de Hondaroca. En la Atalaya ondea desde ayer la bandera gris del Cierzo. Para encender el fanal hace falta el sello y una bandera, y la refugiera te pregunta con cuál subes."
  paquete:
    backdrop: posada
    beats:
      - who: Nieves Albar
        text: "Dos nevadas más y no sube ni una cabra. Pasa, que se escapa el calor. Nieves Albar, refugiera."
      - who: Sancho de Brezo
        mood: enfadado
        text: "¡Por el honor de mi casa! Y de mi madre. Soy Sancho de Brezo. Tú llevas el sello: Brezo sube primero."
      - who: Bea Ladera
        text: "Bea Ladera, capitana de Oramar. Me pagan hasta el viernes; el sábado, ya veremos. Don Tristán paga el doble que Brezo por esa bandera."
      - who: Brokk Pedernal
        text: "Brokk Pedernal. Firmes. La puerta de la Atalaya la hizo mi clan. Con la grulla de Hondaroca pasa todo el mundo, como dice la Carta. Hondaroca."
      - who: Nieves Albar
        mood: triste
        text: "Arriba, en la Atalaya, ondea la bandera gris del Cierzo desde ayer. Para encender el fanal te hacen falta el sello y una bandera. ¿Con cuál subes?"
        options:
          - id: con-brezo
            text: "Con la de Brezo. Que las tierras altas coman este invierno."
            irreversible: true
            effects: [{ milestone: bandera-brezo }]
            reply: { who: Sancho de Brezo, mood: alegre, text: "¡Por mi madre! ¡Brezo sube!" }
          - id: con-oramar
            text: "Con la de Oramar. Que pase quien pague, pero que pase."
            irreversible: true
            effects: [{ milestone: bandera-oramar }]
            reply: { who: Bea Ladera, mood: alegre, text: "Contrato firmado. Don Tristán estará contento, y yo cobro el sábado." }
          - id: con-hondaroca
            text: "Con la grulla de Hondaroca. Que el paso sea de todos."
            irreversible: true
            effects: [{ milestone: bandera-hondaroca }]
            reply: { who: Brokk Pedernal, mood: alegre, text: "Firmes. ¡Hondaroca!" }

hito:
  id: bandera-brezo
  acto: 4
  titulo: La bandera de Brezo
  abre: "tras_hito: m-consejo"
  pide: "llegar: la-atalaya"
  cambia:
    cierra: [bandera-oramar, bandera-hondaroca]
    abre_hito: [m-cornisa]
    reputacion: { casa-brezo: 6, casa-oramar: -6, casa-hondaroca: -6 }
  pista: "Sube a la Atalaya con la bandera de Brezo."
  escena: "Subes al paso con la bandera morada de Brezo. Si el fanal arde con ella, las tierras altas comerán este invierno, y las bajas pagarán el grano a su precio."
  paquete:
    backdrop: posada
    beats:
      - who: Sancho de Brezo
        mood: alegre
        text: "¡Lo sabía! Mi madre dirá que fue idea suya. Que lo diga."
      - who: Bea Ladera
        mood: enfadado
        text: "Don Tristán no va a estar contento. Y yo, sin bandera, no cobro el sábado."
      - who: Brokk Pedernal
        mood: triste
        text: "Brezo cerrará el paso a los de abajo. Lo hemos visto antes. Hondaroca."
      - who: Sancho de Brezo
        text: "Mis treinta lanzas suben por el camino grande, a llamar la atención. Tú sube por donde puedas. Nos vemos en la puerta."

hito:
  id: bandera-oramar
  acto: 4
  titulo: La bandera de Oramar
  abre: "tras_hito: m-consejo"
  pide: "llegar: la-atalaya"
  cambia:
    cierra: [bandera-brezo, bandera-hondaroca]
    abre_hito: [m-cornisa]
    reputacion: { casa-oramar: 6, casa-brezo: -6, casa-hondaroca: -6 }
  pista: "Sube a la Atalaya con la bandera de Oramar."
  escena: "Subes al paso con el barco azul de Oramar. Si el fanal arde con él, pasará quien pague, y Oramar pondrá precio a la sal y al grano de todo el reino."
  paquete:
    backdrop: posada
    beats:
      - who: Bea Ladera
        mood: alegre
        text: "Contrato firmado. Mis ballesteros suben por el camino grande y te cubren la espalda desde abajo."
      - who: Sancho de Brezo
        mood: enfadado
        text: "¡Has vendido el paso a un prestamista! ¡Mi madre tenía razón contigo!"
      - who: Brokk Pedernal
        mood: triste
        text: "Pasará quien pague. Como en tiempos de los peajes dobles. Hondaroca."
      - who: Bea Ladera
        text: "Ballesteros por el camino, y tú por donde no te vean. Así se hacen los contratos que se cobran."

hito:
  id: bandera-hondaroca
  acto: 4
  titulo: La grulla de Hondaroca
  abre: "tras_hito: m-consejo"
  pide: "llegar: la-atalaya"
  cambia:
    cierra: [bandera-brezo, bandera-oramar]
    abre_hito: [m-cornisa]
    reputacion: { casa-hondaroca: 6, casa-brezo: -6, casa-oramar: -6 }
  pista: "Sube a la Atalaya con la grulla blanca de Hondaroca."
  escena: "Subes al paso con la grulla blanca de Hondaroca, la de hace sesenta años. Si el fanal arde con ella, los enanos guardarán el paso igual para todas las casas, como dice la Carta."
  paquete:
    backdrop: posada
    beats:
      - who: Brokk Pedernal
        mood: alegre
        text: "Firmes. Mi clan vuelve a la Atalaya después de sesenta años. Hondaroca."
      - who: Sancho de Brezo
        mood: enfadado
        text: "¿Los enanos? ¿Y quién da de comer a mi gente en enero?"
      - who: Brokk Pedernal
        text: "Por un paso abierto suben carros de todas las casas, Brezo. También los vuestros. Hondaroca."
      - who: Bea Ladera
        mood: triste
        text: "Pues yo me quedo sin cobrar. Lo de siempre. Por lo menos, el paso se queda abierto."

hito:
  id: m-cornisa
  acto: 4
  titulo: La cornisa de las grullas
  abre: "tras_hito: bandera-brezo"
  pide: "ganar_tablero: enc-cornisa"
  cambia:
    abre_hito: [m-fanal]
  pista: "Sube a la Atalaya por la cornisa de las grullas, el paso de cabras que llega por detrás. La guardan los huargos del Cierzo."
  escena: "El camino grande a la Atalaya está lleno de ballestas del Cierzo. El arriero conoce un paso de cabras, la cornisa de las grullas, que llega por detrás. La guardan los huargos del Cierzo, y a un lado no hay nada más que aire."
  paquete:
    backdrop: posada
    beats:
      - who: Ramiro Cuesta
        text: "A burro viejo, cuesta arriba. Ramiro Cuesta, arriero sin mulas, para servirte."
      - who: Ramiro Cuesta
        mood: enfadado
        text: "El camino grande está lleno de ballestas del Cierzo. Por la cornisa de las grullas se llega a la Atalaya por detrás."
      - who: Nieves Albar
        mood: triste
        text: "La cornisa la guardan sus huargos, y a un lado solo hay aire. Esta noche nieva hasta la rodilla."
        options:
          - id: subo-cornisa
            text: "Subo por la cornisa."
            reply: { who: Ramiro Cuesta, mood: alegre, text: "Quien no se arriesga no pasa la mar. Ni la cornisa." }
          - id: otro-camino
            text: "¿No hay otro camino?"
            reply: { who: Nieves Albar, mood: enfadado, text: "Lo hay: esperar al deshielo. Para entonces, el fanal ya habrá ardido con otra bandera." }
          - id: huellas
            text: "Leo el viento antes de subir, para que los huargos no me huelan."
            if: { class: Explorador }
            effects: [{ clue: "En la cornisa, el viento sopla de la montaña al valle: subiendo de noche, los huargos no os huelen." }]
            reply: { who: Nieves Albar, mood: alegre, text: "Por fin alguien que mira el cielo antes que la espada. Sube de noche: el viento baja." }

hito:
  id: m-fanal
  acto: 4
  titulo: El fanal de la Atalaya
  abre: "tras_hito: m-cornisa"
  pide: "ganar_tablero: enc-atalaya"
  cambia:
    final: paso-abierto
    final_segun: { casa-brezo: paso-brezo, casa-oramar: paso-oramar, casa-hondaroca: paso-abierto }
  pista: "En el patio de la Atalaya espera el capitán del Cierzo, con su guardián de hierro. Derrótale y enciende el fanal. Es para nivel 5, y duro."
  escena: "Desde la muralla de la Atalaya te saluda el capitán del Cierzo. A cada casa le ha prometido venderle el paso en primavera. Entre él y el fanal están sus ballesteros y el guardián de hierro de la puerta."
  paquete:
    backdrop: La Atalaya de la Grulla
    beats:
      - who: Bermudo Lanzagrís
        mood: alegre
        text: "Qué gusto, alguien con modales en esta montaña. Bermudo Lanzagrís, capitán del Cierzo. Y desde ayer, señor de esta Atalaya."
      - who: Bermudo Lanzagrís
        text: "Las tres casas me pagaron por lo mismo: llegar antes que las otras dos. He llegado antes que las tres."
      - who: Bermudo Lanzagrís
        mood: alegre
        text: "En primavera le vendo el paso a quien más pague. A cada casa le he prometido que será ella. Una acertará."
        alt:
          - if: { chose: con-brezo }
            text: "¿Brezo? Doña Ilduara me debe tres meses. Qué bandera tan cara traes."
          - if: { chose: con-oramar }
            text: "¿Oramar? Tristán me pagó para retrasar a Brezo. Ahora me pagará para retrasarte a ti."
          - if: { chose: con-hondaroca }
            text: "¿La grulla? Vuestra thane le vendió esta piedra a Oramar hace un mes. Sin leer la letra pequeña, claro."
      - who: Bermudo Lanzagrís
        text: "Sin el sello, esa puerta no se abre. Con él, despierta el guardián de hierro si no le gustas. Sube a por mí, si puedes."
        options:
          - id: subo
            text: "Subo."
            reply: { who: Bermudo Lanzagrís, mood: alegre, text: "Así me gusta. Sin discursos." }
          - id: sello-en-alto
            text: "Levanto el sello para que lo vean tus hombres."
            check:
              skill: intimidation
              dc: 14
              success:
                effects: [{ clue: "Los ballesteros del Cierzo dudan al ver el Sello de la Grulla." }]
                reply: { who: Bermudo Lanzagrís, mood: enfadado, text: "¡Quietos! ¡He dicho quietos! Es solo un anillo, por los dioses." }
              failure:
                reply: { who: Bermudo Lanzagrís, mood: alegre, text: "Muy bonito. Ahora, si no te importa, peleamos." }
          - id: la-tuerta
            text: "Tu sargento te ha dejado. ¿Quién te queda?"
            effects: [{ attitude: -1 }]
            reply: { who: Bermudo Lanzagrís, mood: enfadado, text: "Me quedan los que cobran. Que son todos los que importan." }

## Los secretos

Dos cosas escondidas que se encuentran sin que lo pida la historia: el cuerno del último thane, mirando bien en la ermita, y lo que vio la pastora de Torre Brezo la noche que ardió Los Brezales, hablando con ella.

hito:
  id: s-cuerno
  acto: 1
  titulo: El cuerno escondido
  oculto: true
  abre: al_empezar
  pide: "pistas: 1"
  pistas:
    - { donde: ermita-del-collado, tirada: investigación }
  pista: "En la ermita del collado hay más de lo que dicen los libros."
  escena: "Bajo una losa suelta detrás del altar de la ermita está el cuerno de guerra del último thane de la Atalaya. Lo sacó de la tumba el ermitaño, para que no lo vendieran."
  paquete:
    backdrop: templo
    beats:
      - who: Fray Odón
        mood: triste
        text: "Pisa con cuidado, que debajo duerme alguien. Ay. Lo has encontrado."
      - who: Fray Odón
        text: "Fray Odón me llamo, y no soy ladrón: soy guardián. Saqué el cuerno de la tumba antes de que lo vendieran, y que la piedra me perdone."
      - who: Fray Odón
        text: "Cuando suena, los enanos de Hondaroca lo oyen desde las Forjas. Por eso lo quieren los de capa gris."
        options:
          - id: llevar-cuerno
            text: "Déjamelo. Sonará en la Atalaya, y para bien."
            effects: [{ give: Cuerno de la Atalaya }, { attitude: 1 }]
            reply: { who: Fray Odón, mood: alegre, text: "Llévalo. Que suene una vez más, y luego devuélvelo a su dueño. Su dueño está aquí debajo." }
          - id: dejar-cuerno
            text: "Guárdalo tú. Aquí está más seguro."
            effects: [{ attitude: 1 }]
            reply: { who: Fray Odón, text: "Gracias. La piedra te lo agradece. Y yo también." }

hito:
  id: s-brezales
  acto: 2
  titulo: Lo que vio la pastora
  oculto: true
  abre: al_empezar
  pide: "hablar_con: elvira"
  pista: "En Torre Brezo hay alguien que vio arder Los Brezales desde el monte."
  escena: "La pastora de Torre Brezo vio arder Los Brezales desde el monte: las antorchas bajaron de la torre. El sargento Zarzal se negó a prender la primera casa, y por eso picaron su nombre en la puerta del cuartel."
  paquete:
    backdrop: plaza
    beats:
      - who: Elvira Breña
        mood: enfadado
        text: "¡Eh, tú! ¡Sí, tú! Elvira Breña, pastora. ¿Preguntas por Los Brezales? Pues pregúntamelo a mí, que lo vi."
      - who: Elvira Breña
        mood: triste
        text: "Desde el monte se veían las antorchas. Bajaban de la torre, en fila. Un rayo no baja en fila."
      - who: Elvira Breña
        mood: enfadado
        text: "El sargento Zarzal dijo que no a la primera casa. Lo oí gritar desde arriba. Por eso picaron su nombre en la puerta del cuartel."
        options:
          - id: callar
            text: "Esto no se lo cuentes a nadie más. Te pueden hacer daño."
            effects: [{ attitude: 1 }, { clue: "La pastora vio las antorchas de Torre Brezo quemar Los Brezales. El sargento Zarzal se negó a prender la primera casa." }]
            reply: { who: Elvira Breña, mood: triste, text: "Llevo un año callando. Un día más no me mata." }
          - id: contarlo
            text: "Esto lo tiene que saber el heredero de Brezo."
            effects: [{ clue: "La pastora vio las antorchas de Torre Brezo quemar Los Brezales. El sargento Zarzal se negó a prender la primera casa." }]
            reply: { who: Elvira Breña, mood: enfadado, text: "¿El chico? Pues que se entere. Que sepa de quién es hijo." }

## Los finales

El fanal se enciende con la bandera de la casa que mejor te mira, que es la que llevaste: Brezo, Oramar o la grulla de Hondaroca. Cada final dice qué fue de la gente que pesó.

final:
  id: paso-brezo
  titulo: El paso de Brezo
  escena: "El fanal de la Atalaya arde con la bandera morada de Brezo, y se ve desde todo el valle. Este invierno las tierras altas comen. Las bajas pagan el grano a precio de Brezo, y en Vadoancho los barcos siguen amarrados."
  epilogos:
    - { quien: ilduara, texto: "Doña Ilduara salda la deuda con Oramar a cambio del grano de las tierras bajas. Lo apunta todo, al último sueldo, y no perdona ni uno." }
    - { quien: sancho, texto: "Sancho de Brezo manda la guardia del paso. Aprende a contar raciones antes que lanzas." }
    - { quien: herminia, texto: "Herminia Sauce esconde otra vez un tercio de la cosecha. Esta vez, para pagar el grano de Brezo en primavera." }
    - { quien: casa-oramar, texto: "Casa Oramar compra en silencio las deudas de los pueblos de abajo. Espera al deshielo." }
    - { quien: rufino, texto: "Rufino Albarda sella la Carta con la bandera de Brezo y escribe, al margen, que la cláusula catorce no se cumplió." }

final:
  id: paso-oramar
  titulo: El paso de Oramar
  escena: "El fanal de la Atalaya arde con el barco azul de Oramar. Por el paso sube y baja quien paga, y paga todo el mundo. Los seis barcos de Vadoancho zarpan al día siguiente, con el precio ya puesto."
  epilogos:
    - { quien: tristan, texto: "Don Tristán Oramar pone precio a la sal y al grano de medio reino. A ti te invita a cenar cada vez que pasas por Vadoancho." }
    - { quien: lupe, texto: "Lupe Garbanzo sube la sal al paso antes que la nieve, con peaje y con factura. Gana menos y duerme más." }
    - { quien: orosia, texto: "Madre Orosia apunta cuarenta y tres nombres nuevos en la lista de la Ribera. El pan llega, pero llega caro." }
    - { quien: ilduara, texto: "Doña Ilduara entrega Torre Brezo a Oramar en primavera, por las deudas. Se queda con el libro de cuentas." }
    - { quien: bea, texto: "Bea Ladera cobra el sábado, por fin, y vuelve a casa entera." }

final:
  id: paso-abierto
  titulo: El paso abierto
  escena: "El fanal de la Atalaya arde con la grulla blanca de Hondaroca, la de hace sesenta años. Los enanos vuelven a la puerta de la Atalaya y la guardan igual para todos, como dice la Carta. Por el paso suben carros de las tres casas, y nadie paga más que nadie."
  epilogos:
    - { quien: gudrun, texto: "Gudrun Hondaroca cierra cada noche la puerta de su abuelo y la abre cada mañana, a quien llegue." }
    - { quien: dagna, texto: "Dagna Hondaroca devuelve el oro de Oramar. Golpea la mesa al hacerlo, pero lo devuelve." }
    - { quien: brokk, texto: "Brokk Pedernal manda la guardia de la Atalaya. Firmes. Hondaroca." }
    - { quien: ulfo, texto: "Ulfo Piedrafría cuelga la cláusula catorce en la puerta de la Atalaya, en letras grandes. Estante uno, legajo uno." }
    - { quien: rufino, texto: "Rufino Albarda sube al paso en primavera, con la pierna ya curada, a sellar la Carta. Cita la cláusula catorce de memoria." }
