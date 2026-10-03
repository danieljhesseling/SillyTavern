# Las tierras del ocaso — ronda 8: los romances y las misiones personales

> Escrita por Claude (tanda 20, 2026-10-03). Ilvana, Ruy y Gudrun tienen las dos cosas.
>
> - **El romance** (D-J63, como en *Persona*): llega en el **rango 9**, con su punto de inflexión (`senal`). Una respuesta íntima abre la ruta de pareja (`romance: avanza`); una de apoyo, la de amigos inseparables (`romance: amigos`), sin castigo; y se puede dejar pasar, y vuelve otro día. Después, tres citas, la noche (fundido a negro, nada explícito), sus frases de pareja (también en las fiestas y de noche) y su epílogo.
> - **La misión personal**: la piden en el rango 4. Un viaje, una conversación con una decisión, una pelea posible y dos finales. Desde el primer paso se llega a los dos, y ninguno depende solo de ganar la pelea.

confidente:
  id: ilvana
  paquete:
    romance:
      with: todos
      "no": "Eres mi senda favorita. Pero no de esa manera. Entre tú y yo, todo sigue como siempre."
      escenas:
        - kind: senal
          title: La ventana al este
          where: plaza
          beats:
            - say: "He encontrado un sitio con una ventana al este. Es una forma de hablar. El sitio eres tú."
              mood: alegre
            - say: "No sé decirlo mejor. Las piedras no me enseñaron esto."
              replies:
                - { text: "Le dices que tú también lo has pensado. Mucho.", bond: 1, romance: avanza, then: "Entonces ya no hace falta que lo diga mejor.", mood: alegre }
                - { text: "Le dices que es lo más importante que tienes en el camino, y que eso no va a cambiar, sea lo que sea.", bond: 1, romance: amigos, then: "Sea lo que sea. Me vale. Una senda no necesita nombre para ser buena." }
                - { text: "Le dices que necesitas pensarlo.", bond: 0, then: "Piensa. Yo tengo siglos." }
        - kind: cita
          step: 1
          title: Las piedras de la ladera
          where: plaza
          beats:
            - say: "Ven. Te enseño a leer una senda. Pon la mano aquí, en la marca."
              mood: alegre
              replies:
                - { text: "Pones tu mano debajo de la suya, en la piedra.", bond: 1, romance: avanza, then: "Así no se lee. Pero no la quites.", mood: alegre }
                - { text: "Lees la marca sin su ayuda.", bond: 0, then: "Bien. Muy bien. Demasiado bien." }
        - kind: cita
          step: 2
          title: La lluvia en el hayedo
          where: posada
          beats:
            - say: "Llueve. Los elfos decimos que la lluvia de otoño es la única que no tiene prisa."
              replies:
                - { text: "Le dices que hoy tú tampoco tienes prisa.", bond: 1, romance: avanza, then: "Entonces quedémonos hasta que pare. O hasta que no.", mood: alegre }
                - { text: "Le hablas del camino de mañana.", bond: 0, then: "Mañana. Claro." }
        - kind: cita
          step: 3
          title: La marca torcida
          where: plaza
          beats:
            - say: "He tallado tu nombre en una piedra de la senda. Torcido, para que se sepa que fui yo."
              mood: alegre
              replies:
                - { text: "Le besas la mano que lo talló.", bond: 1, romance: avanza, then: "Ahora sí que no se me olvidará nunca tallar.", mood: alegre }
                - { text: "Le dices que la quieres como a una hermana de camino.", bond: 0, romance: amigos, then: "Hermana de camino. Es un buen nombre. Lo tallaré también.", mood: triste }
        - kind: final
          title: La noche de las hayas
          where: posada
          beats:
            - say: "Esta noche las hayas no hacen ruido. Quédate."
              mood: alegre
              replies:
                - { text: "Te quedas.", bond: 1, romance: avanza, then: "Apaga tú la lámpara.", fade: true }
                - { text: "Le das un beso en la frente y te vas a dormir.", bond: 0, then: "Otra noche, entonces. Tengo siglos." }
        - kind: pareja
          lines:
            - "Llevo tu piedra en el bolsillo del pecho, donde dijiste."
            - "Hoy he contado tus pasos hasta la posada. Cuatrocientos doce. Todos míos."
          festival:
            - "Hoy es {fiesta}. Los elfos bailamos despacio. Ven, que te enseño."
          night:
            - "Mira el cielo: esas tres estrellas señalan la cuarta. Como tú y yo."
        - kind: epilogo
          home: "Ilvana vuelve contigo al gremio después de «{ending}». Talla una piedra con una marca torcida en la puerta de vuestro cuarto."
          away: "Ilvana se quedó contigo en las tierras del ocaso después de «{ending}». Cada primavera recorréis las Sendas Viejas reponiendo las piedras."
          hall: "{heroe} e Ilvana Hojarrubia, pareja desde el día {day}."
    misionPersonal:
      id: ilvana-caelan
      title: La deuda de Caelan
      where: Las Sendas Viejas, a un día de las Hayas Rojas
      pitch: "El hermano de Ilvana guía al Cierzo por las Sendas Viejas para pagar una deuda de juego, y mueve las piedras para que los demás se pierdan. Ilvana quiere mirarle a la cara y decidir qué hacer con él."
      endings:
        - { id: vuelve, title: Caelan vuelve a las Hayas, summary: "Caelan deja al Cierzo y vuelve a las Hayas Rojas a poner en su sitio las piedras que movió. Ilvana le acompaña hasta la linde del bosque." }
        - { id: cada-uno, title: Cada uno por su senda, summary: "Ilvana deja a su hermano en las Sendas, con su deuda y sus dados. No le guarda rencor, pero no volverá a firmar por él." }
      start: ida
      steps:
        - { id: ida, kind: viaje, to: Las Sendas Viejas, days: 1, next: senda }
        - id: senda
          kind: escena
          title: La piedra girada
          backdrop: Las Sendas Viejas
          beats:
            - { who: Ilvana Hojarrubia, text: "Esa piedra está girada. Señala al barranco. Caelan está cerca." }
            - { who: Caelan Hojarrubia, mood: enfadado, text: "Alguien tenía que cobrar. Me tocó a mí. Hola, hermana." }
            - { who: Ilvana Hojarrubia, mood: triste, text: "Has girado las piedras de nuestra gente para que el Cierzo no se pierda, y los demás sí." }
            - { who: Caelan Hojarrubia, mood: triste, text: "Debía doscientos sueldos al prestamista de Vadoancho. O el mapa, o la mano. Elegí el mapa." }
            - who: Ilvana Hojarrubia
              mood: triste
              text: "Dime tú qué hago con él. Yo ya no sé."
              options:
                - id: convencer
                  text: "Convencerle de que vuelva a las Hayas a reponer las piedras."
                  check:
                    skill: persuasion
                    dc: 13
                    success: { reply: { who: Caelan Hojarrubia, mood: triste, text: "...Vale. Vuelvo. Alguien tenía que poner las piedras en su sitio. Me toca a mí." } }
                    failure: { reply: { who: Caelan Hojarrubia, mood: enfadado, text: "¿Volver? Mira detrás de ti. Ya vienen los del Cierzo a cobrarme el retraso." } }
                - id: pagar
                  text: "Pagar tú lo que queda de su deuda: cincuenta sueldos."
                  if: { gold: 50 }
                  effects: [{ gold: -50 }]
                  reply: { who: Ilvana Hojarrubia, mood: alegre, text: "Nadie había firmado por él más que yo. Gracias. Ahora no tiene excusa para no volver." }
                - id: dejar
                  text: "Dejarle con su deuda y seguir vuestro camino."
                  reply: { who: Ilvana Hojarrubia, mood: triste, text: "Tienes razón. Ya firmé dos veces. No firmo la tercera." }
          routes:
            convencer: { bien: fin-vuelve, mal: emboscada }
            pagar: fin-vuelve
            dejar: fin-cada-uno
          next: fin-cada-uno
        - id: emboscada
          kind: tablero
          board:
            id: ilvana-barranco
            name: El barranco de la piedra girada
            locationName: Las Sendas Viejas
            map:
              - "##############"
              - "#....b...c...#"
              - "#.c......vv..#"
              - "#....bb..vv..#"
              - "#..........c.#"
              - "#.b...c......#"
              - "#............#"
              - "##############"
            partyStart: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }]
            enemies: [{ name: Batidor del Cierzo, x: 11, y: 1 }, { name: Batidor del Cierzo, x: 12, y: 4 }, { name: Batidor del Cierzo, x: 10, y: 6 }]
          bestiary:
            - { name: Batidor del Cierzo, hp: 13, armorClass: 13, cr: 0.5, profile: skirmisher, attackRangeFeet: 5, description: "Un explorador del Cierzo, ligero y con prisa. Viene a cobrarle a Caelan el retraso." }
          win: fin-vuelve
          lose: fin-cada-uno
          flee: fin-cada-uno
        - { id: fin-vuelve, kind: final, ending: vuelve, back: 1, effects: { bonds: 2, flags: [caelan-vuelve], memory: "Fuiste con Ilvana a las Sendas Viejas y Caelan volvió a las Hayas a reponer las piedras." } }
        - { id: fin-cada-uno, kind: final, ending: cada-uno, back: 1, effects: { bonds: 1, memory: "Fuiste con Ilvana a las Sendas Viejas y la ayudaste a dejar a su hermano con su deuda." } }

confidente:
  id: ruy
  paquete:
    romance:
      with: todos
      "no": "Mira, eres lo mejor que me ha pasado en años. Pero no de esa manera. Todo sigue igual entre tú y yo."
      escenas:
        - kind: senal
          title: Dos sillas
          where: posada
          beats:
            - say: "Mira. He dibujado la casa. La del hacha. Tiene dos sillas junto al fuego."
            - say: "No sé por qué he dibujado dos. Bueno, sí que lo sé."
              mood: alegre
              replies:
                - { text: "Le dices que la segunda silla es tuya.", bond: 1, romance: avanza, then: "Mira... Pues ya tiene dueño. La haré más grande.", mood: alegre }
                - { text: "Le dices que en tu mesa siempre tendrá silla, como el mejor de tus amigos.", bond: 1, romance: amigos, then: "El mejor. Mira, eso también vale una casa entera." }
                - { text: "Le dices que ya hablaréis de eso otro día.", bond: 0, then: "Otro día. La silla espera." }
        - kind: cita
          step: 1
          title: La leña
          where: plaza
          beats:
            - say: "Te enseño a cortar leña. Coge el hacha así. No, así. Mira."
              mood: alegre
              replies:
                - { text: "Le dejas que te coloque las manos en el mango.", bond: 1, romance: avanza, then: "...Así. Así está bien. Muy bien.", mood: alegre }
                - { text: "Cortas la leña a tu manera.", bond: 0, then: "También vale. La leña no se queja." }
        - kind: cita
          step: 2
          title: El vado de Los Brezales
          where: plaza
          beats:
            - say: "Por este vado saqué a los de Los Brezales. Nunca había vuelto. Contigo, sí."
              mood: triste
              replies:
                - { text: "Le coges del brazo para cruzar el vado.", bond: 1, romance: avanza, then: "Mira, el agua está helada y no lo noto.", mood: alegre }
                - { text: "Le preguntas si prefiere volver otro día sin compañía.", bond: 0, then: "No. Hoy está bien así." }
        - kind: cita
          step: 3
          title: El brezo
          where: posada
          beats:
            - say: "He cogido brezo del monte. Morado, como el escudo que me arranqué. Pero este es mío. Para ti."
              mood: alegre
              replies:
                - { text: "Te pones una ramita de brezo en el pelo.", bond: 1, romance: avanza, then: "Mira... Ahora el brezo me gusta otra vez.", mood: alegre }
                - { text: "Le dices que lo guardarás como regalo de tu mejor amigo.", bond: 0, romance: amigos, then: "De tu mejor amigo. Me vale. Mira, me vale mucho." }
        - kind: final
          title: La noche de la leña
          where: posada
          beats:
            - say: "El fuego está alto, y la leña la corté yo. Quédate esta noche."
              mood: alegre
              replies:
                - { text: "Te quedas.", bond: 1, romance: avanza, then: "Mira... No sé qué decir. Apaga tú la vela.", fade: true }
                - { text: "Le das un abrazo largo y te vas a dormir.", bond: 0, then: "Otra noche. La leña aguanta." }
        - kind: pareja
          lines:
            - "Mira, ya he hecho la segunda silla. Más grande, como dije."
            - "Nadie se aparta cuando voy contigo. Es raro. Raro bueno."
          festival:
            - "Hoy es {fiesta}. Mira, yo no bailo. Bueno, contigo, un poco."
          night:
            - "Ya ha anochecido. Mira el fuego. Así quiero acabar todos los días."
        - kind: epilogo
          home: "Ruy vuelve contigo al gremio después de «{ending}». Corta la leña de todo el gremio y no deja que nadie le pague."
          away: "Ruy se quedó contigo en las tierras del ocaso después de «{ending}». La casa del hacha tiene dos sillas junto al fuego."
          hall: "{heroe} y Ruy Zarzal, pareja desde el día {day}."
    misionPersonal:
      id: ruy-escuadra
      title: La escuadra del robledal
      where: El robledal de Torre Brezo, a un día de la torre
      pitch: "La escuadra de Ruy se fue al monte con él la noche que ardió Los Brezales, y ahora roba ovejas para comer. Ruy quiere encontrarlos antes que los soldados de la torre."
      endings:
        - { id: al-llano, title: La escuadra baja al llano, summary: "Los de la escuadra bajan al llano por el monte y se ponen a trabajar en el molino de Los Sauces. Ruy los ve marchar desde la loma." }
        - { id: ante-sancho, title: La verdad, a Sancho, summary: "Sancho de Brezo se entera de lo que pasó en Los Brezales. Toma a la escuadra en su guardia y quita el precio de la cabeza de Ruy." }
      start: ida
      steps:
        - { id: ida, kind: viaje, to: El robledal de Torre Brezo, days: 1, next: robledal }
        - id: robledal
          kind: escena
          title: Los de la escuadra
          backdrop: Torre Brezo
          beats:
            - { who: Ruy Zarzal, mood: triste, text: "Mira. Huellas de botas de Brezo, sin herrar. Son los míos. Comen bellotas, por lo que se ve." }
            - { who: Ruy Zarzal, mood: alegre, text: "¡Eh, los del robledal! ¡Soy yo, Zarzal! Bajad, que no muerdo." }
            - { who: Ruy Zarzal, mood: triste, text: "Ya bajan. Flacos como palos. Y por el camino sube alguien con el brezo pintado en el peto." }
            - { who: Sancho de Brezo, mood: enfadado, text: "¡Zarzal! ¡Por el honor de mi casa, quedas preso, tú y tus desertores!" }
            - who: Ruy Zarzal
              mood: triste
              text: "Es el chico. Le enseñé a coger una espada de palo. ¿Qué hago?"
              options:
                - id: la-verdad
                  text: "Contarle a Sancho lo que pasó en Los Brezales."
                  check:
                    skill: persuasion
                    dc: 14
                    success: { reply: { who: Sancho de Brezo, mood: triste, text: "¿Mi madre? ¿Con la gente dentro? ...Bajad las lanzas. Todos." } }
                    failure: { reply: { who: Sancho de Brezo, mood: enfadado, text: "¡Mentiras de desertor! ¡A ellos!" } }
                - id: la-pastora
                  text: "Decirle a Sancho que la pastora de la torre lo vio todo desde el monte."
                  if: { milestone: s-brezales }
                  reply: { who: Sancho de Brezo, mood: triste, text: "¿Elvira lo vio? Elvira no miente ni para vender una oveja. ...Bajad las lanzas." }
                - id: al-monte
                  text: "Llevarse a la escuadra por el monte antes de que lleguen."
                  check:
                    skill: stealth
                    dc: 12
                    success: { reply: { who: Ruy Zarzal, mood: alegre, text: "Por la loma, en fila. Mira, ni nos han visto." } }
                    failure: { reply: { who: Ruy Zarzal, mood: enfadado, text: "¡Nos han visto! Mira, no quiero hacerles daño. Pero tampoco que se los lleven." } }
          routes:
            la-verdad: { bien: fin-sancho, mal: pelea }
            la-pastora: fin-sancho
            al-monte: { bien: fin-llano, mal: pelea }
          next: fin-llano
        - id: pelea
          kind: tablero
          board:
            id: ruy-robledal
            name: Los soldados del robledal
            locationName: Torre Brezo
            map:
              - "##############"
              - "#..bb....b...#"
              - "#.......ww...#"
              - "#.C.....ww.c.#"
              - "#.....b......#"
              - "#..c......bb.#"
              - "#............#"
              - "##############"
            partyStart: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 1, y: 5 }]
            enemies: [{ name: Soldado de Brezo, x: 11, y: 1 }, { name: Soldado de Brezo, x: 12, y: 3 }, { name: Soldado de Brezo, x: 10, y: 4 }]
          bestiary:
            - { name: Soldado de Brezo, hp: 16, armorClass: 15, cr: 0.5, profile: guardian, attackRangeFeet: 5, description: "Un soldado de la guardia de Torre Brezo, con lanza y capa morada. Cobra media paga desde agosto." }
          win: fin-llano
          lose: fin-llano
          flee: fin-llano
        - { id: fin-llano, kind: final, ending: al-llano, back: 1, effects: { bonds: 1, memory: "Ayudaste a Ruy a bajar a su escuadra al llano, lejos de la torre." } }
        - { id: fin-sancho, kind: final, ending: ante-sancho, back: 1, effects: { bonds: 2, flags: [zarzal-perdonado], memory: "Sancho de Brezo supo lo de Los Brezales por ti, y quitó el precio de la cabeza de Ruy." } }

confidente:
  id: gudrun
  paquete:
    romance:
      with: todos
      "no": "Eres de las pocas personas a las que abriría la puerta de noche. Pero no de esa manera. Todo sigue igual entre tú y yo."
      escenas:
        - kind: senal
          title: La llave de la Atalaya
          where: posada
          beats:
            - say: "Esta es la llave de la Atalaya. La de mi abuelo. Una guardiana solo da una copia de su llave en la vida."
            - say: "Te la doy a ti. Y no es solo por la puerta."
              mood: alegre
              replies:
                - { text: "Le dices que la llevarás siempre, y que la tuya es de ella.", bond: 1, romance: avanza, then: "Entonces tengo dos llaves y una sola puerta. Eso es estar en casa.", mood: alegre }
                - { text: "Le dices que la guardarás como lo más valioso que te ha dado una amiga.", bond: 1, romance: amigos, then: "Una amiga. Con eso, la puerta queda igual de abierta. Me vale." }
                - { text: "Le pides tiempo para pensarlo.", bond: 0, then: "Las puertas enanas saben esperar. Esta también." }
        - kind: cita
          step: 1
          title: La forja
          where: plaza
          beats:
            - say: "Ven a la forja. Te enseño a templar. El hierro se pone rojo, luego naranja, y luego, si sabes mirarlo, del color de tus ojos."
              mood: alegre
              replies:
                - { text: "Le sostienes el hierro mientras golpea.", bond: 1, romance: avanza, then: "Así se hace entre dos. Mejor que sola.", mood: alegre }
                - { text: "Miras desde lejos, por el calor.", bond: 0, then: "El calor se aguanta. Otro día, más cerca." }
        - kind: cita
          step: 2
          title: La luz apagada
          where: posada
          beats:
            - say: "Voy a apagar la luz un momento, como te dije que haría. A ver si es verdad que te quedas al lado."
              mood: triste
              replies:
                - { text: "Le coges la mano en la oscuridad.", bond: 1, romance: avanza, then: "Es verdad. Ya no tengo miedo. Bueno, menos.", mood: alegre }
                - { text: "Le dices que encienda la luz, que no hace falta probar nada.", bond: 0, then: "Tienes razón. Pero quería probarlo." }
        - kind: cita
          step: 3
          title: El nombre en la puerta
          where: plaza
          beats:
            - say: "En la puerta de la Atalaya se graban los nombres de quien la guarda. Quiero grabar dos."
              mood: alegre
              replies:
                - { text: "Le dices que grabe el tuyo al lado del suyo.", bond: 1, romance: avanza, then: "Al lado. Con el mismo martillo. Hondaroca.", mood: alegre }
                - { text: "Le dices que grabe el tuyo debajo, como amigo del clan.", bond: 0, romance: amigos, then: "Amigo del clan. Es un honor que no tiene nadie de fuera. Ya lo tienes." }
        - kind: final
          title: La noche de la puerta
          where: posada
          beats:
            - say: "Esta noche cierro la puerta por dentro. Contigo dentro, si quieres."
              mood: alegre
              replies:
                - { text: "Te quedas.", bond: 1, romance: avanza, then: "Cierro yo. Apaga tú la luz. Esta vez no tengo miedo.", fade: true }
                - { text: "Le das un beso en la mejilla y te vas a dormir.", bond: 0, then: "Otra noche. La puerta no se va a ninguna parte." }
        - kind: pareja
          lines:
            - "Llevo tu llave colgada del cuello, junto a la de mi abuelo."
            - "Hoy he abierto la puerta pensando en ti. Se ha abierto más rápido."
          festival:
            - "Hoy es {fiesta}. Los enanos bailamos golpeando el suelo. Ven, que retumbe."
          night:
            - "Ya es de noche. Cierro la puerta. Tú, dentro."
        - kind: epilogo
          home: "Gudrun vuelve contigo al gremio después de «{ending}». Pone una puerta enana en vuestro cuarto, y la abre cada mañana."
          away: "Gudrun se quedó contigo en las tierras del ocaso después de «{ending}». Vuestros dos nombres están grabados en la misma puerta."
          hall: "{heroe} y Gudrun Hondaroca, pareja desde el día {day}."
    misionPersonal:
      id: gudrun-papel
      title: El papel de la thane
      where: Vadoancho, a dos días de las Forjas
      pitch: "La thane de Hondaroca vendió a Oramar el derecho del clan sobre la Atalaya, y el papel lo guarda el prestamista de Vadoancho. Gudrun quiere recuperarlo antes de que alguien encienda el fanal con él en la mano."
      endings:
        - { id: comprado, title: El papel pagado, summary: "Gudrun paga el papel con los lingotes de su dote. El clan es más pobre, pero el derecho sobre la Atalaya vuelve a Hondaroca." }
        - { id: quemado, title: El papel en la forja, summary: "Gudrun se lleva el papel de noche y lo quema en la forja grande. Oramar no lo olvidará, pero no podrá probar nada." }
      start: ida
      steps:
        - { id: ida, kind: viaje, to: Vadoancho, days: 2, next: casa }
        - id: casa
          kind: escena
          title: La casa de préstamos
          backdrop: tienda
          beats:
            - { who: Marcos Fullero, mood: alegre, text: "Bienvenidas las visitas. Marcos Fullero, para servir. Aquí todo se presta, y todo se devuelve." }
            - { who: Gudrun Hondaroca, mood: enfadado, text: "Vengo a por el papel de mi tía. El del derecho del clan sobre la Atalaya." }
            - { who: Marcos Fullero, text: "Ah, ese. Lo guardo para Don Tristán. Pero amiga, todo tiene precio. Diez lingotes de Hondaroca." }
            - who: Gudrun Hondaroca
              mood: triste
              text: "Diez lingotes es mi dote. ¿Qué hacemos?"
              options:
                - id: pagar
                  text: "Pagar con los lingotes de Gudrun."
                  reply: { who: Marcos Fullero, mood: alegre, text: "Amiga, qué gusto tratar con gente seria. Aquí tienes tu papel. Ni una arruga." }
                - id: regatear
                  text: "Regatear el precio."
                  check:
                    skill: persuasion
                    dc: 15
                    success: { reply: { who: Marcos Fullero, mood: enfadado, text: "Seis lingotes. Seis, y me arruinas. Regateas peor que un recaudador, y eso es mucho decir." } }
                    failure: { reply: { who: Marcos Fullero, text: "Diez lingotes. Diez es diez en todas las casas, por mucho que se regatee." } }
                - id: de-noche
                  text: "Volver de noche, por la puerta del canal."
                  check:
                    skill: stealth
                    dc: 13
                    success: { reply: { who: Gudrun Hondaroca, mood: alegre, text: "Lo tengo. A la forja con él, y que arda bonito." } }
                    failure: { reply: { who: Gudrun Hondaroca, mood: enfadado, text: "¡Los guardias! Cerradura cara, bisagra barata... y tres guardias. Eso nadie lo dijo." } }
          routes:
            pagar: fin-comprado
            regatear: { bien: fin-comprado, mal: fin-comprado }
            de-noche: { bien: fin-quemado, mal: guardias }
          next: fin-comprado
        - id: guardias
          kind: tablero
          board:
            id: gudrun-casa
            name: La casa de préstamos, de noche
            locationName: Vadoancho
            map:
              - "##############"
              - "#.....#......#"
              - "#..T..D...k..#"
              - "#.....#......#"
              - "###D######D###"
              - "#............#"
              - "#.c........x.#"
              - "##############"
            partyStart: [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 6 }, { x: 3, y: 5 }]
            enemies: [{ name: Guardia de Fullero, x: 9, y: 1 }, { name: Guardia de Fullero, x: 4, y: 2 }, { name: Guardia de Fullero, x: 8, y: 6 }]
          bestiary:
            - { name: Guardia de Fullero, hp: 15, armorClass: 13, cr: 0.5, profile: aggressive, attackRangeFeet: 5, description: "Un guardia de noche de la casa de préstamos, con porra y farol. Fullero le paga por no dormirse." }
          win: fin-quemado
          lose: fin-comprado
          flee: fin-comprado
        - { id: fin-comprado, kind: final, ending: comprado, back: 2, effects: { bonds: 1, memory: "Fuiste con Gudrun a Vadoancho y pagasteis el papel de la thane con su dote." } }
        - { id: fin-quemado, kind: final, ending: quemado, back: 2, effects: { bonds: 2, flags: [papel-quemado], memory: "Fuiste con Gudrun a Vadoancho de noche y quemasteis en la forja el papel de la thane." } }
