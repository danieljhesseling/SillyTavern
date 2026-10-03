---
title: El mundo tras la pantalla — ronda 9, los compañeros
tags: [pantalla, guion, companeros, vinculos, romances, misiones]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 9: los compañeros

> Las escenas de vínculo de los cinco (rangos 2, 4, 6, 8 y 10), como conversación: todo lo dice él o ella (D-J60), y tú eliges qué contestas. Cada rango cuenta algo nuevo: quién es, lo que le duele, lo que esconde, lo que quiere y lo que hará por ti.
>
> - **Romances (D-J63):** Candela y Yoli. El punto de inflexión llega en el rango 9 (`senal`): una respuesta íntima abre las tres citas y la noche (fundido a negro); una de apoyo os deja en amigos para siempre, sin castigo. Arel dice que no, con cariño. Nieves y Celso, sin romance.
> - **Misiones personales:** Candela («La canción de Alma»), Yoli («La radio del prado») y Arel («El nudo sin nombre»). Las pide cada uno al llegar al vínculo 4. Las tres tienen dos finales, y a los dos se llega sin depender solo de ganar una pelea.
>
> **Comprobación:** cada rango cuenta algo nuevo; cada romance trae señal, tres citas, la noche, frases de pareja y epílogo; cada misión llega a sus dos finales desde el primer paso. ✔

## Candela Rima

confidente:
  id: candela
  paquete:
    scenes:
      - rank: 2
        title: La canción de los nombres
        where: posada
        scene: "Candela te enseña su cuaderno de canciones: cada verso es el nombre de alguien que se apagó. Te pregunta si tienes un nombre que no quieras perder."
        beats:
          - say: "Mira mi cuaderno. Cada verso es un nombre: gente que se apagó y que ya no tiene a nadie que lo diga."
            mood: triste
          - say: "Si lo canto, alguien lo oye. Y si alguien lo oye, no se pierde del todo. ¿Tú tienes un nombre que no quieras perder?"
            replies:
              - { text: "Le dices el nombre de alguien a quien echas de menos.", bond: 1, then: "Pues ya está en mi cuaderno. Esta noche lo canto, en la segunda estrofa.", mood: alegre }
              - { text: "Le dices que prefieres no cantarle a nadie.", bond: 0, then: "Vale. Pero si un día cambias de idea, la canción te espera." }
      - rank: 4
        title: Alma
        where: posada
        scene: "En su canción más vieja hay un nombre que Candela no reconoce: Alma. Lo escribió ella, con su letra, hace nueve años. Quiere saber quién era."
        beats:
          - say: "Esta es mi canción más vieja. La escribí hace nueve años. Y hay un nombre en ella que no reconozco: Alma."
            mood: triste
          - say: "Es mi letra y es mi canción, y no sé quién es. ¿Me ayudarás a buscarla?"
            replies:
              - { text: "Le prometes que la buscaréis juntos.", bond: 1, then: "Arel tiene una cuerda con un nudo por cada nombre olvidado. Quizá ella esté en uno.", mood: alegre }
              - { text: "Le dices que a lo mejor es solo un nombre bonito.", bond: -1, then: "No. Yo no escribo nombres bonitos. Escribo nombres de gente.", mood: enfadado }
      - rank: 6
        title: La canción de la lonja
        where: posada
        scene: "Candela confiesa que, antes de saber lo que pasaba, compuso por dinero la canción que la lonja de Cifra usa para atraer a los huéspedes."
        beats:
          - say: "Tengo que contarte una cosa fea. ¿Conoces la canción de la lonja? «Sube, sube, que el nivel te espera…»"
            mood: triste
          - say: "La escribí yo. Me la pagaron bien, antes de saber lo que pasaba. Cada vez que la oigo, alguien firma un pagaré."
            replies:
              - { text: "Le dices que entonces no lo sabía.", bond: 1, then: "No. Pero ahora sí. Y ahora la canto al revés en la plaza, para que se entienda.", mood: alegre }
              - { text: "Le dices que la lonja nunca dejará de cantarla.", bond: 0, then: "Ya lo sé. Por eso canto más alto que ellos.", mood: enfadado }
      - rank: 8
        title: Una canción para alguien vivo
        where: plaza
        scene: "Candela quiere escribir, por fin, una canción sin nombres perdidos: una para alguien que todavía está. Te pide permiso para que sea la tuya."
        beats:
          - say: "Quiero escribir una canción sin nombres perdidos. Una para alguien que todavía está aquí."
            mood: alegre
          - say: "Me gustaría que fuera la tuya. ¿Me dejas?"
            replies:
              - { text: "Le dices que sí, que es un honor.", bond: 1, then: "Pues siéntate y no te muevas. Tienes cara de estribillo.", mood: alegre }
              - { text: "Le dices que no sabes si te la mereces.", bond: 0, then: "Eso lo decido yo, que soy la que canta." }
      - rank: 10
        title: El estribillo
        where: posada
        scene: "Candela pone tu nombre en el estribillo de todas sus canciones: mientras alguien las cante, en la comarca nadie te olvidará."
        beats:
          - say: "Ya está. Tu nombre va en el estribillo de todas mis canciones. De todas."
            mood: alegre
          - say: "Mientras alguien las cante, en esta comarca nadie te olvidará. Ni la torre."
            replies:
              - { text: "La abrazas.", bond: 1, then: "¡Cuidado, que se me desafina el laúd!", mood: alegre }
              - { text: "Le das las gracias.", bond: 1, then: "No me las des. Cántala tú también, que la letra es fácil.", mood: alegre }
    romance:
      with: todos
      no: "Eres mi canción favorita, de verdad. Pero no de esa manera. Entre nosotros, todo sigue igual."
      escenas:
        - kind: senal
          title: El último verso
          where: posada
          beats:
            - say: "Llevo toda la noche intentando terminar tu canción, y no me sale el último verso."
              mood: triste
            - say: "Creo que no me sale porque no sé qué somos tú y yo."
              replies:
                - { text: "Le dices que el último verso lo escribiréis juntos.", bond: 1, romance: avanza, then: "Juntos. Me gusta cómo rima eso.", mood: alegre }
                - { text: "Le dices que lo vuestro es amistad, de la buena.", bond: 1, romance: amigos, then: "Amistad. Eso también rima, ¿sabes? Con todo.", mood: alegre }
        - kind: cita
          step: 1
          title: Tres acordes
          where: posada
          beats:
            - say: "Te enseño tres acordes. Con tres acordes se canta casi todo, hasta la pena."
              mood: alegre
              replies:
                - { text: "Coges el laúd y lo intentas.", bond: 1, romance: avanza, then: "Fatal. Fatal y precioso. Otra vez.", mood: alegre }
                - { text: "Le dices que prefieres escucharla.", bond: 0, then: "Otro día te pongo el laúd en las manos, quieras o no." }
        - kind: cita
          step: 2
          title: La Pared de los Nombres
          where: plaza
          beats:
            - say: "Ven. Vamos a escribir nuestros nombres en la pared, uno al lado del otro. A mano."
              mood: alegre
              replies:
                - { text: "Escribes tu nombre junto al suyo.", bond: 1, romance: avanza, then: "Así, pegaditos. Que el que lea uno, lea el otro.", mood: alegre }
                - { text: "Le dices que tu letra es muy fea.", bond: 0, then: "La mía también. Por eso canto." }
        - kind: cita
          step: 3
          title: El tejado de la posada
          where: posada
          beats:
            - say: "Desde el tejado se ve el bosque y, al fondo, la luz de la Torre Siete. Aquí vengo cuando no puedo dormir. Nunca había traído a nadie."
              mood: alegre
              replies:
                - { text: "Le coges la mano.", bond: 1, romance: avanza, then: "No me la sueltes hasta que se apague esa luz.", mood: alegre }
                - { text: "Le dices que la quieres como amiga.", bond: 0, romance: amigos, then: "Ya. Lo sospechaba. Amistad, entonces. De la de verdad.", mood: triste }
        - kind: final
          title: La canción entera
          where: posada
          beats:
            - say: "La canción ya tiene final. Solo la he cantado una vez, y bajito. Quédate esta noche y te la canto entera."
              mood: alegre
              replies:
                - { text: "Te quedas.", bond: 1, romance: avanza, then: "Apaga la vela. Esta canción se canta a oscuras.", fade: true }
                - { text: "Le das un beso en la frente y te vas a dormir.", bond: 0, then: "Otra noche, entonces. La canción espera." }
        - kind: pareja
          lines:
            - "He cambiado una palabra del estribillo. Ahora rima con tu nombre."
            - "Esta noche canto en la posada. La primera es para ti, como siempre."
            - "Te he guardado sitio junto al laúd."
        - kind: epilogo
          home: "Candela vuelve contigo al gremio después de «{ending}». Canta en la sala grande, y la canción que más le piden lleva tu nombre."
          away: "Candela se queda contigo en Brasa después de «{ending}». Cada noche, en la posada, la última canción es la vuestra."
          hall: "{heroe} y Candela Rima: pareja desde el día {day}. Su canción todavía se canta en Brasa."
    misionPersonal:
      id: la-cancion-de-alma
      title: La canción de Alma
      where: "La Hondonada Gris, a dos días de Brasa"
      pitch: "En la canción más vieja de Candela hay un nombre que no reconoce: Alma. Lo escribió ella, con su letra, hace nueve años. En la cuerda de Arel hay un nudo con ese nombre."
      rank: 4
      endings:
        - id: cantarle
          title: Cantarle cada jueves
          summary: "Alma no recuerda a Candela, pero sonríe al oír su canción. Candela va a la Hondonada cada jueves a cantársela."
        - id: llevarla
          title: Llevarla a casa
          summary: "Candela se lleva a Alma a la Posada del Despertar. Alma no sabe quién es, pero tiene una litera, un nombre en un libro y alguien que se lo dice cada mañana."
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: La Hondonada Gris
          days: 2
          next: nudo
        - id: nudo
          kind: escena
          title: El nudo de Alma
          backdrop: La Hondonada Gris
          beats:
            - { who: Candela Rima, mood: triste, text: "Arel dice que aquí vive una Alma. Que tiene un nudo para ella, el tercero de su cuerda." }
            - { who: Arel Pinoviejo, text: "La de la manta de cuadros, junto al fuego pequeño. Lleva aquí nueve años. A veces canta, sin letra." }
            - who: Candela Rima
              mood: triste
              text: "Tiene mis ojos. Tiene mi forma de mover las manos. Es mi hermana. Y no me conoce."
              options:
                - id: cantarle
                  text: "Cántale tu canción, Candela."
                  reply: { who: Candela Rima, mood: alegre, text: "…Está sonriendo. No sabe por qué, pero sonríe." }
                - id: llevarla
                  text: "Llévatela a Brasa. Remedios le dará una litera."
                  check:
                    skill: persuasion
                    dc: 12
                    success: { reply: { who: Abuela Ceniza, mood: alegre, text: "Llévatela, niña. Aquí ya no le hace falta nadie más que tú." } }
                    failure: { reply: { who: Abuela Ceniza, mood: enfadado, text: "¿Y quién la cuida cuando tú te vayas a cantar por ahí? Aquí se queda." } }
          routes:
            cantarle: fin-cantarle
            llevarla: { bien: camino, mal: fin-cantarle }
          next: fin-cantarle
        - id: camino
          kind: tablero
          board:
            id: camino-de-alma
            name: El camino de vuelta de Alma
            locationName: El Bosque Copiado
            map:
              - "############"
              - "#..b...C...#"
              - "#.....b....#"
              - "#..C.....b.#"
              - "#....b.....#"
              - "#.b....C...#"
              - "#..........#"
              - "############"
            partyStart: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }]
            enemies: [{ name: Copia que sigue a Alma, x: 9, y: 1 }, { name: Copia que sigue a Alma, x: 10, y: 3 }]
          bestiary:
            - { name: Copia que sigue a Alma, hp: 12, armorClass: 12, cr: 0.25, profile: skirmisher, attackRangeFeet: 5, description: "Una copia sin cara con una manta de cuadros igual que la de Alma." }
          win: fin-llevarla
          lose: fin-cantarle
          flee: fin-llevarla
        - id: fin-cantarle
          kind: final
          ending: cantarle
          back: 2
          effects:
            bonds: 1
            memory: "Acompañaste a Candela a la Hondonada Gris. Allí encontró a su hermana Alma, y ahora le canta cada jueves."
        - id: fin-llevarla
          kind: final
          ending: llevarla
          back: 2
          effects:
            bonds: 2
            flags: [alma-en-brasa]
            memory: "Ayudaste a Candela a llevarse a su hermana Alma a la Posada del Despertar."

## Yolanda Ferrán, «Yoli»

confidente:
  id: yoli
  paquete:
    scenes:
      - rank: 2
        title: Turno de noche
        where: posada
        scene: "Yoli te cuenta cómo era su trabajo en la ambulancia. Aquí, por lo menos, sabe cuánta vida le queda a cada uno sin tomarle el pulso."
        beats:
          - say: "En mi mundo conducía una ambulancia. Turno de noche, doce horas, sirena y café malo."
          - say: "Aquí, por lo menos, sé cuánta vida le queda a cada uno sin tomarle el pulso. Es lo único bueno de las barras."
            replies:
              - { text: "Le preguntas qué echa de menos.", bond: 1, then: "El café malo. Y que alguien me dijera «buen turno» al acabar.", mood: triste }
              - { text: "Le dices que las barras te dan miedo.", bond: 0, then: "A mí también. Por eso las miro tanto." }
      - rank: 4
        title: La radio del prado
        where: posada
        scene: "Yoli despertó junto a su ambulancia, en un prado del bosque. La radio todavía suena algunas noches, y cree oír a su compañera decir su nombre."
        beats:
          - say: "Desperté junto a mi ambulancia, en un prado del bosque. Sigue allí."
            mood: triste
          - say: "Algunas noches la radio suena. Y juraría que es mi compañera, diciendo mi nombre. ¿Me acompañas a escucharla?"
            replies:
              - { text: "Le dices que irás con ella.", bond: 1, then: "Gracias. No quería ir sola. Llevo tres meses sin atreverme.", mood: alegre }
              - { text: "Le dices que a lo mejor es mejor no escuchar.", bond: 0, then: "A lo mejor. Pero tengo que saberlo." }
      - rank: 6
        title: Un punto de vida
        where: posada
        scene: "La noche que un lobo la dejó a un punto de vida, Iker pagó su cura con un pagaré de la lonja. Yoli encontró el recibo en su litera y no se lo ha contado a nadie."
        beats:
          - say: "La noche que un lobo me dejó a un punto de vida, alguien pagó mi cura."
            mood: triste
          - say: "Encontré el recibo en la litera de Iker. Un pagaré de la lonja. Me curé con sus niveles, y no se lo he contado a nadie."
            replies:
              - { text: "Le dices que Iker lo hizo porque quiso.", bond: 1, then: "Ya. Por eso duele.", mood: triste }
              - { text: "Le dices que tiene que decírselo a Iker.", bond: 1, then: "Se lo digo cada día. No se acuerda. Y yo sí." }
      - rank: 8
        title: Dejar de contar
        where: plaza
        scene: "Yoli quiere dejar de mirar su barra cada cinco minutos y tener una casa aquí. Te pregunta qué harías tú si pudieras volver."
        beats:
          - say: "Quiero dejar de mirar mi barra cada cinco minutos. Quiero una casa aquí. Con ventanas."
          - say: "¿Y tú? Si pudieras volver a tu sitio, ¿volverías?"
            replies:
              - { text: "Le dices que te quedarías aquí, con ella.", bond: 1, then: "Eso no es una respuesta. Pero me vale.", mood: alegre }
              - { text: "Le dices que no lo sabes.", bond: 0, then: "Ya. Yo tampoco lo sabía hasta hace poco." }
      - rank: 10
        title: La sirena
        where: posada
        scene: "Yoli te hace una promesa: si un día tu barra baja a uno, ella llega. Siempre llega."
        beats:
          - say: "Te voy a hacer una promesa, y yo las promesas las cumplo."
          - say: "Si un día tu barra baja a uno, yo llego. Siempre llego. Es lo que hago."
            replies:
              - { text: "Le prometes lo mismo.", bond: 1, then: "Pues ya somos dos ambulancias.", mood: alegre }
              - { text: "Le das un abrazo.", bond: 1, then: "Vale, vale. Sin llorar, que tengo fama de dura.", mood: alegre }
    romance:
      with: todos
      no: "Eres mi mejor compañía de turno, y eso no lo cambio por nada. Pero no de esa manera, ¿vale?"
      escenas:
        - kind: senal
          title: Contar la barra equivocada
          where: posada
          beats:
            - say: "Oye. Llevo un rato contando tu barra en vez de la mía. En mi trabajo eso tenía un nombre."
              mood: alegre
            - say: "No sé si me preocupo por ti como compañera… o como otra cosa. Y odio no saber."
              replies:
                - { text: "Le dices que a ti te pasa lo mismo.", bond: 1, romance: avanza, then: "Vale. Vale. Respira, Ferrán. Esto no es una urgencia.", mood: alegre }
                - { text: "Le dices que sois el mejor equipo que hay, y que con eso basta.", bond: 1, romance: amigos, then: "El mejor equipo. Sí. Eso es verdad, y es mucho.", mood: alegre }
        - kind: cita
          step: 1
          title: Café malo
          where: posada
          beats:
            - say: "He conseguido algo parecido al café. Sabe a castañas quemadas. Es perfecto. ¿Un turno de noche conmigo?"
              mood: alegre
              replies:
                - { text: "Te sientas con ella hasta el amanecer.", bond: 1, romance: avanza, then: "Buen turno. Hacía tres meses que nadie me lo decía.", mood: alegre }
                - { text: "Le dices que tienes sueño.", bond: 0, then: "Ve, ve. Yo hago guardia." }
        - kind: cita
          step: 2
          title: La sirena arreglada
          where: plaza
          beats:
            - say: "He arreglado la sirena de la ambulancia con piezas de la herrera. Suena fatal. ¿Damos una vuelta por el prado con ella puesta?"
              mood: alegre
              replies:
                - { text: "Te subes al asiento de al lado.", bond: 1, romance: avanza, then: "¡Sujétate! Bueno, no vamos a ningún sitio: no hay gasolina. Pero suena.", mood: alegre }
                - { text: "Le dices que va a asustar a todo el pueblo.", bond: 0, then: "Esa es la idea." }
        - kind: cita
          step: 3
          title: La casa con ventanas
          where: plaza
          beats:
            - say: "He encontrado una casa en Brasa. Pequeña. Tiene ventanas, muchas. No quería enseñársela a nadie más que a ti."
              mood: alegre
              replies:
                - { text: "Le dices que es perfecta.", bond: 1, romance: avanza, then: "Perfecta no. Le falta alguien.", mood: alegre }
                - { text: "Le dices que la quieres como amiga.", bond: 0, romance: amigos, then: "Entendido. Nos queda la amistad, que no es poco. Y la casa de al lado está libre.", mood: triste }
        - kind: final
          title: Fin del turno
          where: posada
          beats:
            - say: "Se me ha acabado el turno. Y no quiero que te vayas. Quédate esta noche."
              mood: alegre
              replies:
                - { text: "Te quedas.", bond: 1, romance: avanza, then: "Ven aquí. Y deja de mirarme la barra.", fade: true }
                - { text: "Le das un beso en la mejilla y te vas.", bond: 0, then: "Vale. Otra noche. Te guardo el turno." }
        - kind: pareja
          lines:
            - "Hoy no he mirado mi barra ni una vez. He mirado la tuya, pero eso no cuenta."
            - "Buen turno, pareja."
            - "Te he guardado la mitad del café malo."
        - kind: epilogo
          home: "Yoli vuelve contigo al gremio después de «{ending}». Monta una enfermería en la planta baja, y la llama «urgencias»."
          away: "Yoli se queda contigo en Brasa después de «{ending}», en la casa de las ventanas. Ya no miráis las barras."
          hall: "{heroe} y Yolanda Ferrán: pareja desde el día {day}. Siempre llegan."
    misionPersonal:
      id: la-radio-del-prado
      title: La radio del prado
      where: "El prado de la ambulancia, en el Bosque Copiado, a un día de Brasa"
      pitch: "Yoli despertó junto a su ambulancia, en un prado del Bosque Copiado. La radio todavía suena algunas noches, y cree oír a su compañera decir su nombre. Quiere ir a escucharla."
      rank: 4
      endings:
        - id: apagar
          title: Apagar la radio
          summary: "Yoli escucha la voz una última vez y apaga la radio. Se queda en este mundo, y lo dice en voz alta: se queda."
        - id: escuchar
          title: Seguir escuchando
          summary: "Yoli se lleva la radio a la posada. Algunas noches suena, y ella contesta. Nadie sabe si alguien la oye."
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: El Bosque Copiado
          days: 1
          next: prado
        - id: prado
          kind: escena
          title: La ambulancia
          backdrop: El Bosque Copiado
          beats:
            - { who: Yolanda Ferrán, mood: triste, text: "Ahí está. Blanca y naranja, con la sirena rota. Aquí nadie sabe qué es, y la tocan como si fuera un altar." }
            - { who: Yolanda Ferrán, text: "Escucha. ¿Lo oyes? Ruido… y a veces una voz: «Ferrán, ¿me copias?». Es mi compañera de turno." }
            - who: Yolanda Ferrán
              mood: triste
              text: "Cuando suena, vienen las copias sin cara. Como si la buscaran también. ¿Qué hago?"
              options:
                - id: contestar
                  text: "Contéstale. Dile dónde estás."
                  reply: { who: Yolanda Ferrán, mood: triste, text: "«Aquí Ferrán. Estoy bien. Estoy… en otro sitio.» Ya vienen. ¡Ya vienen!" }
                - id: llevar-radio
                  text: "Llévate la radio a la posada. Allí la escuchas tranquila."
                  reply: { who: Yolanda Ferrán, mood: alegre, text: "A la posada. Sí. Que suene donde yo pueda dormir al lado." }
                - id: apagarla
                  text: "Apágala, Yoli. Tu vida está aquí ahora."
                  reply: { who: Yolanda Ferrán, mood: triste, text: "…Vale. Vale. Dame un minuto." }
          routes:
            contestar: copias
            llevar-radio: fin-escuchar
            apagarla: fin-apagar
          next: fin-apagar
        - id: copias
          kind: tablero
          board:
            id: prado-de-la-ambulancia
            name: El prado de la ambulancia
            locationName: El Bosque Copiado
            map:
              - "##############"
              - "#....bb......#"
              - "#..........c.#"
              - "#..CC........#"
              - "#..CC....b...#"
              - "#............#"
              - "#.b......b...#"
              - "#............#"
              - "##############"
            partyStart: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }]
            enemies: [{ name: Copia del prado, x: 11, y: 1 }, { name: Copia del prado, x: 12, y: 3 }, { name: Copia del prado, x: 10, y: 5 }]
          bestiary:
            - { name: Copia del prado, hp: 12, armorClass: 12, cr: 0.25, profile: skirmisher, attackRangeFeet: 5, description: "Una copia sin cara que se acerca cuando suena la radio, con la cabeza ladeada, escuchando." }
          win: fin-escuchar
          lose: fin-apagar
          flee: fin-apagar
        - id: fin-apagar
          kind: final
          ending: apagar
          back: 1
          effects:
            bonds: 2
            memory: "Acompañaste a Yoli al prado de su ambulancia. Escuchó la radio una última vez y la apagó: se queda en este mundo."
        - id: fin-escuchar
          kind: final
          ending: escuchar
          back: 1
          effects:
            bonds: 1
            flags: [radio-en-la-posada]
            memory: "Ayudaste a Yoli a llevarse la radio de su ambulancia a la Posada del Despertar. Algunas noches suena."

## Arel Pinoviejo

confidente:
  id: arel
  paquete:
    scenes:
      - rank: 2
        title: La cuerda
        where: plaza
        scene: "Arel te enseña su cuerda: cuatrocientos doce nudos, cada uno con un nombre. Te dice que no ata nudos por los vivos."
        beats:
          - say: "Esta es mi cuerda. Cuatrocientos doce nudos. Cada uno es alguien a quien los demás han olvidado."
          - say: "No ato nudos por los vivos. Los vivos tienen quien se acuerde de ellos."
            replies:
              - { text: "Le preguntas si pesa.", bond: 1, then: "Mucho. Por eso la llevo yo: soy elfo y tengo tiempo." }
              - { text: "Le dices que es muy triste.", bond: 0, then: "Triste es no tenerla.", mood: triste }
      - rank: 4
        title: El nudo sin nombre
        where: plaza
        scene: "Hay un nudo en la cuerda de Arel que no sabe de quién es. Es la primera vez que olvida a alguien, y quiere saber a quién."
        beats:
          - say: "Hay un nudo aquí que no sé de quién es. Está entre dos de Los Molinos."
            mood: triste
          - say: "Es la primera vez que olvido a alguien. Los elfos no olvidamos. ¿Me ayudas a saber quién es?"
            replies:
              - { text: "Le dices que iréis a Los Molinos.", bond: 1, then: "Gracias. Hay que ir despacio: allí todos deben algo." }
              - { text: "Le dices que no pasa nada por olvidar.", bond: -1, then: "A ti no. A mí sí.", mood: enfadado }
      - rank: 6
        title: Lo que la torre empieza a contar
        where: plaza
        scene: "Arel confiesa que la semana pasada vio un número en su propia barra, por primera vez. Tiene miedo de que la torre empiece a contar a los elfos."
        beats:
          - say: "La semana pasada vi un número en mi barra. Por primera vez."
            mood: triste
          - say: "Un dos. La torre ha aprendido a contarnos. Si me apago, ¿quién lleva la cuerda?"
            replies:
              - { text: "Le dices que la llevarás tú.", bond: 1, then: "Pesa. Te lo aviso.", mood: alegre }
              - { text: "Le dices que eso no va a pasar.", bond: 0, then: "No prometas lo que cuenta una torre." }
      - rank: 8
        title: Una cuerda nueva
        where: plaza
        scene: "Arel empieza una cuerda nueva, para los vivos. El primer nudo es para alguien que todavía está a su lado."
        beats:
          - say: "He empezado una cuerda nueva. Para los vivos. Para no esperar a que se apaguen."
            mood: alegre
          - say: "El primer nudo es para alguien que está a mi lado."
            replies:
              - { text: "Le preguntas si es para ti.", bond: 1, then: "Es para ti. No pongas esa cara.", mood: alegre }
              - { text: "Le dices que es bonito.", bond: 1, then: "Es práctico. Bonito también." }
      - rank: 10
        title: El primer nudo
        where: plaza
        scene: "Arel te da el extremo de su cuerda: si un día se apaga, ahí están todos sus nombres, y el tuyo el primero."
        beats:
          - say: "Toma el extremo de mi cuerda. Si un día me apago, ahí están todos mis nombres."
          - say: "Y el tuyo, el primero."
            replies:
              - { text: "Lo coges con las dos manos.", bond: 1, then: "Así. Sin soltar.", mood: alegre }
              - { text: "Le dices que no se va a apagar.", bond: 1, then: "Por si acaso. Los elfos somos prudentes." }
    romance:
      with: nadie
      no: "Estás en mi cuerda nueva, en el primer nudo. Para un elfo, eso es más que cualquier otra cosa. Pero no de esa manera."
    misionPersonal:
      id: el-nudo-sin-nombre
      title: El nudo sin nombre
      where: "Los Molinos y el Archivo Hundido de Cifra"
      pitch: "Hay un nudo en la cuerda de Arel que no sabe de quién es: la primera vez que un elfo olvida a alguien. Está entre dos nudos de Los Molinos, y quiere preguntar allí."
      rank: 4
      endings:
        - id: nombre
          title: El nombre del nudo
          summary: "En las copias del archivero aparece de quién era el nudo: la molinera, la mujer de Severino. Arel vuelve a atarlo, y se lo dice a Severino cada vez que pasa por el molino."
        - id: soltar
          title: Soltar el nudo
          summary: "Arel deshace el nudo sin nombre y se lo guarda en el bolsillo. Dice que, cuando caiga la torre, se acordará."
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: Los Molinos
          days: 1
          next: molino
        - id: molino
          kind: escena
          title: El molino de Severino
          backdrop: Los Molinos
          beats:
            - { who: Arel Pinoviejo, mood: triste, text: "El nudo está entre dos de Los Molinos. Alguien de aquí. Y no sé quién." }
            - { who: Severino Muela, mood: enfadado, text: "¿Un nudo? ¿Para quién? Aquí se apaga uno cada mes, elfo. Medio saco de nombres tengo yo olvidados." }
            - who: Arel Pinoviejo
              text: "Severino, ¿quién cosía antes los sacos de tu molino?"
              options:
                - id: preguntar
                  text: "Pregúntale con calma, sin prisa."
                  check:
                    skill: insight
                    dc: 13
                    success: { reply: { who: Severino Muela, mood: triste, text: "…Nadie. Los cosía yo. Pero en un cajón tengo agujas de mujer, y no sé de quién son." } }
                    failure: { reply: { who: Severino Muela, mood: enfadado, text: "¡Los cosía yo! Y fuera de mi molino, los dos." } }
                - id: soltar
                  text: "Déjalo, Arel. Quizá es mejor no saberlo."
                  reply: { who: Arel Pinoviejo, mood: triste, text: "Quizá. Es la primera vez que un nudo me pesa." }
          routes:
            preguntar: { bien: archivo, mal: fin-soltar }
            soltar: fin-soltar
          next: fin-soltar
        - id: archivo
          kind: viaje
          to: Cifra
          days: 1
          next: copias
        - id: copias
          kind: escena
          title: Las copias del archivero
          backdrop: El Archivo Hundido
          beats:
            - { who: Teodoro Polilla, text: "Teodoro Polilla, archivero. Perdón, perdón. ¿Los Molinos? Hace seis años… Aquí: «La molinera de Los Molinos, mujer de Severino Muela. Siete niveles.» Perdón." }
            - who: Arel Pinoviejo
              mood: alegre
              text: "La molinera. La que cosía los sacos. Ya me acuerdo. Ya me acuerdo de su risa."
              options:
                - id: decirselo
                  text: "Hay que decírselo a Severino."
                  reply: { who: Arel Pinoviejo, text: "Se lo diré yo. Cada vez que pase por el molino, si hace falta." }
                - id: atarlo
                  text: "Vuelve a atarlo, Arel."
                  reply: { who: Arel Pinoviejo, mood: alegre, text: "Atado. Y bien apretado." }
          routes:
            decirselo: fin-nombre
            atarlo: fin-nombre
          next: fin-nombre
        - id: fin-nombre
          kind: final
          ending: nombre
          back: 2
          effects:
            bonds: 2
            flags: [nudo-de-la-molinera]
            memory: "Ayudaste a Arel a saber de quién era su nudo sin nombre: la molinera de Los Molinos, la mujer de Severino."
        - id: fin-soltar
          kind: final
          ending: soltar
          back: 1
          effects:
            bonds: 1
            memory: "Acompañaste a Arel a Los Molinos. No supo de quién era su nudo, y lo soltó."

## Nieves Aguja

confidente:
  id: nieves
  paquete:
    scenes:
      - rank: 2
        title: Precio por número
        where: plaza
        scene: "Nieves te explica su oficio: cada número pintado tiene su precio, y cada cliente su mentira favorita."
        beats:
          - say: "Un dos que parece un cuatro: cinco monedas. Un uno que parece un seis: diez. El doce dorado del Contador no lo pinto yo: ese es comprado."
            mood: alegre
          - say: "Cada cliente tiene su mentira favorita. ¿Cuál es la tuya, Borrón?"
            replies:
              - { text: "Le dices que no necesitas mentiras.", bond: 1, then: "Eso dicen todos antes de su primera mentira. Me caes bien.", mood: alegre }
              - { text: "Le preguntas por qué te llama Borrón.", bond: 0, then: "Porque llegaste con la barra recién pintada por la torre, y aún no se ha secado." }
      - rank: 4
        title: El maestro
        where: plaza
        scene: "Entre los pinceles de Nieves hay una nota con su letra: «Galán, mi maestro». No se acuerda de él. Lo apagaron por pintar sellos de «pagado» a los deudores."
        beats:
          - say: "Mira esta nota. Es mi letra: «Galán, mi maestro». No sé quién es."
            mood: triste
          - say: "Dicen que pintaba sellos de «pagado» a los deudores, y que lo apagaron por eso. Y yo sigo pintando para ellos."
            replies:
              - { text: "Le dices que lo buscaréis en el libro de los descuentos.", bond: 1, then: "Si sale en ese libro, le pinto la cara de memoria. Aunque no me acuerde de ella." }
              - { text: "Le dices que deje de pintar para la Contaduría.", bond: 0, then: "¿Y de qué como, Borrón? ¿De nombres?", mood: enfadado }
      - rank: 6
        title: La barra de Nieves
        where: plaza
        scene: "Nieves te enseña su secreto: su propia barra está pintada. Debajo de la pintura es un nivel uno."
        beats:
          - say: "Te voy a enseñar un secreto. Si lo cuentas, te pinto un uno en la frente."
          - say: "Mi barra está pintada. Debajo soy un nivel uno. Siempre lo he sido."
            mood: triste
            replies:
              - { text: "Le dices que a ti te da igual el número.", bond: 1, then: "Ya lo sé. Por eso te lo enseño a ti.", mood: alegre }
              - { text: "Le dices que ya lo sospechabas.", bond: 0, then: "Mentira. No se nota nada. Lo pinto muy bien.", mood: enfadado }
      - rank: 8
        title: Pintar de verdad
        where: plaza
        scene: "Nieves quiere pintar algo que no sea mentira: caras, no números. Te pide que poses."
        beats:
          - say: "Quiero pintar algo que no sea mentira. Caras. No números."
            mood: alegre
          - say: "Siéntate ahí, a la luz. Te voy a pintar a ti. Y quieto."
            replies:
              - { text: "Posas sin moverte.", bond: 1, then: "Así. Tienes cara de alguien que no se rinde. Eso no se pinta: sale solo.", mood: alegre }
              - { text: "Le haces una mueca.", bond: 0, then: "Muy bien. Te pinto la mueca. Para siempre." }
      - rank: 10
        title: Sin pintura
        where: plaza
        scene: "Nieves se lava la barra delante de ti. Contigo no le hace falta parecer más de lo que es."
        beats:
          - say: "Mira, Borrón: agua y jabón."
            mood: alegre
          - say: "Contigo no me hace falta parecer más de lo que soy. Nivel uno, y a mucha honra."
            replies:
              - { text: "Le dices que es la mejor pintora del mundo.", bond: 1, then: "Nivel uno en el mundo, nivel diez contigo. Eso no lo pinta nadie.", mood: alegre }
              - { text: "Le das la mano.", bond: 1, then: "Mancha, ¿eh? Todavía me queda azul en los dedos.", mood: alegre }

## Celso Ruda

confidente:
  id: celso
  paquete:
    scenes:
      - rank: 2
        title: Los latidos
        where: templo
        scene: "Celso te toma el pulso sin pedir permiso y te dice cuántos latidos llevas. Así aprendió a curar antes de mirar barras."
        beats:
          - say: "P-perdona. Dame la muñeca. Así. …Setenta y dos latidos. Estás bien."
          - say: "Antes de las barras, las Cuidadoras curaban así: contando latidos, no niveles."
            replies:
              - { text: "Le pides que te enseñe.", bond: 1, then: "Pon dos dedos aquí. Cuenta conmigo. Uno, dos…", mood: alegre }
              - { text: "Le dices que la barra es más rápida.", bond: 0, then: "Más rápida, sí. P-pero no siempre dice la verdad." }
      - rank: 4
        title: Los de Los Molinos
        where: templo
        scene: "La madre y el hermano de Celso viven en Los Molinos y deben dinero a la Contaduría. Cada siete días pasa el cobrador."
        beats:
          - say: "Mi madre y mi hermano viven en Los Molinos. Deben dinero a la Contaduría."
            mood: triste
          - say: "Cada siete días pasa el cobrador. Y cada siete días, yo no duermo."
            replies:
              - { text: "Le dices que iréis a ver a su familia.", bond: 1, then: "¿De v-verdad? Gracias. Mi madre hace un pan que cura más que yo.", mood: alegre }
              - { text: "Le dices que en Los Molinos debe todo el mundo.", bond: 0, then: "Ya. Pero esta es la mía.", mood: triste }
      - rank: 6
        title: Las listas
        where: templo
        scene: "Celso confiesa, tartamudeando, que manda a la Contaduría los niveles de los enfermos de la Ermita. Si no lo hace, descuentan a su familia."
        beats:
          - say: "T-tengo que contarte algo. Y no me mires así mientras lo cuento."
            mood: triste
          - say: "Mando a Cifra los niveles de los enfermos de la Ermita. Si no lo hago, descuentan a mi familia."
            replies:
              - { text: "Le dices que lo entiendes.", bond: 1, then: "No lo entiendas. Ayúdame a dejar de hacerlo." }
              - { text: "Le dices que eso es traicionar a los enfermos.", bond: -1, then: "Ya lo sé. Por eso no duermo.", mood: enfadado }
      - rank: 8
        title: Curar sin mirar
        where: templo
        scene: "Celso quiere curar como las Cuidadoras antiguas: sin mirar números, mirando a la gente."
        beats:
          - say: "Quiero curar como las Cuidadoras antiguas. Sin mirar números. Mirando a la gente."
            mood: alegre
          - say: "¿Me ayudas? Tápale la barra al herido con la mano. Yo cuento."
            replies:
              - { text: "Le tapas la barra al herido.", bond: 1, then: "Ochenta latidos. Fiebre. Tila y reposo. ¡Lo he hecho sin mirar!", mood: alegre }
              - { text: "Le dices que mejor se fíe de la barra.", bond: 0, then: "Hoy sí. Mañana, ya veremos." }
      - rank: 10
        title: La luz de las manos
        where: templo
        scene: "Celso te promete que, si la torre intenta descontarte, se pondrá delante. Que le cuenten a él primero."
        beats:
          - say: "Si la torre intenta descontarte, me pondré delante. Que me cuenten a mí primero."
          - say: "No tartamudeo. ¿Te has dado cuenta? Cuando lo digo en serio, no tartamudeo."
            mood: alegre
            replies:
              - { text: "Le dices que no hará falta.", bond: 1, then: "Por si acaso. Ya me sé tus latidos de memoria." }
              - { text: "Le das las gracias.", bond: 1, then: "No me las des. Algún día cuéntame tú los latidos a mí.", mood: alegre }
