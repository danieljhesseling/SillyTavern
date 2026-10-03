# La costa que no duerme — ronda 8: los compañeros

Cinco compañeros, cinco escenas cada uno (rangos 2, 4, 6, 8 y 10). Todo lo dicen ellos (D-J60): no hay
notas ni narrador. Cada rango cuenta algo nuevo: quién es (2), lo que le duele (4), lo que esconde (6),
lo que quiere de verdad (8) y lo que hará por ti (10).

- **Ane**: escenas, romance y misión personal («Mi madre sube por los postes»).
- **Begoña**: escenas, romance y misión personal («Las cartas que no llegaron»).
- **Gorka**: escenas y misión personal («La barca de Iker»).
- **Julián** y **Txomin**: sus cinco escenas.

El romance llega en el **rango 9** (D-J63): el punto de inflexión es la escena `senal`. Una respuesta
íntima abre la pareja (`romance: avanza`); una de apoyo, la de amigos inseparables (`romance: amigos`).
Después vienen las tres citas y la noche, que acaba en fundido a negro.

## Ane Goikoa

```yaml
confidente:
  id: ane
  paquete:
    scenes:
      - rank: 2
        title: Ciento cuarenta y dos escalones
        where: muelle
        beats:
          - say: 'Treinta años contando barcas. Entran, las apunto. Salen, las apunto. Mi padre lo hacía antes que yo, y su madre antes que él.'
            mood: neutral
          - say: '¿Sabes lo que pasa si una noche sale una menos? Nada. Pero yo lo sabría. ¿Tú tienes algo que hagas así, aunque no sirva?'
            replies:
              - { text: 'Le cuentas una costumbre tuya que nadie entiende.', bond: 1, then: 'Pues ya somos dos raros. Eso une más que la sangre.', mood: alegre }
              - { text: 'Le dices que contar barcas sí sirve: alguien tiene que saber quién falta.', bond: 1, then: 'Nadie me lo había dicho nunca así. Gracias.', mood: alegre }
              - { text: 'Le dices que eso es perder el tiempo.', bond: 0, then: 'Seguramente. Pero es mi tiempo.', mood: enfadado }
      - rank: 4
        title: La Esperanza
        where: muelle
        beats:
          - say: 'Mi madre patroneaba la Esperanza. Salió con la galerna y no volvió. A los ocho meses, mi padre me llevó a algún sitio de noche, y desde entonces tengo esta mano.'
            mood: triste
          - say: 'Y ahora sé que mi madre es de las que suben por los postes. La quiero ver. Una vez. Para decirle adiós como es debido.'
            mood: triste
            replies:
              - { text: 'Le dices que la acompañarás a la Vela cuando quiera.', bond: 1, then: 'Cuando quiera no. Pronto. Antes de que me falte el valor.', mood: triste }
              - { text: 'Le preguntas si de verdad quiere verla así, ahogada.', bond: 0, then: 'No. Pero la quiero ver igual.', mood: triste }
      - rank: 6
        title: La lejía
        where: posada
        beats:
          - say: 'Te voy a contar algo que no sabe nadie. Me acuerdo de la pared. No del todo: de la tinta fría en la mano, y de que alguien lloraba abajo, en el agua.'
            mood: triste
          - say: 'Mi padre me dijo que fue lejía. Durante treinta años he hecho como que me lo creía. ¿Eso me hace mentirosa?'
            replies:
              - { text: 'Le dices que tenía ocho años. Una niña no miente: se protege.', bond: 1, then: 'Se protege. Me gusta cómo suena. Lo voy a usar.', mood: alegre }
              - { text: 'Le dices que todo el pueblo ha hecho lo mismo.', bond: 1, then: 'Eso no me consuela. Pero me acompaña.', mood: triste }
              - { text: 'Le dices que sí, un poco.', bond: -1, then: 'Ya. Gracias por la sinceridad. Duele igual.', mood: enfadado }
      - rank: 8
        title: Lo que quiero
        where: muelle
        beats:
          - say: 'Quiero dormir una noche entera. Sin escalones, sin barcas, sin soñar con la pared. Una noche. Y quiero que sea porque se ha acabado, no porque me he muerto.'
            mood: triste
          - say: 'Si quitar mi mano lo acaba, lo haré. Aunque luego en la bahía se ahogue la gente como en todas partes. ¿Me odiarías por eso?'
            replies:
              - { text: 'Le dices que nadie tiene derecho a pedirle que siga cargando con eso.', bond: 1, then: 'Treinta años. Nadie me lo había dicho. Ni yo.', mood: triste }
              - { text: 'Le dices que lo decidiréis juntos, cuando llegue la bajamar.', bond: 1, then: 'Juntos. Bien. Eso es más de lo que tuve con mi padre.', mood: alegre }
              - { text: 'Le dices que piense en los niños que se ahogarán.', bond: 0, then: 'Pienso en ellos todas las noches. Por eso no he dormido nunca.', mood: enfadado }
      - rank: 10
        title: La luz
        where: muelle
        beats:
          - say: 'Pase lo que pase en el Bajo, esta luz va a seguir girando. Y cada noche, cuando pase por donde estés, te voy a contar como una barca más. La más importante.'
            mood: alegre
          - say: 'Si alguna vez te pierdes en esta costa, sube al faro. Te estaré esperando arriba. Ciento cuarenta y dos escalones, y te los subo yo si hace falta.'
            replies:
              - { text: 'Le dices que los subiréis juntos.', bond: 1, then: 'Juntos. Despacio, que tengo las rodillas de mi padre.', mood: alegre }
              - { text: 'Le das las gracias.', bond: 1, then: 'No me las des. Cuenta conmigo. Yo ya cuento contigo.', mood: alegre }
    romance:
      with: todos
      no: 'Eres la primera persona en treinta años con la que hablo de verdad. No lo estropeemos con eso. Sube al faro cuando quieras, como lo que somos.'
      escenas:
        - kind: senal
          title: Arriba del todo
          where: muelle
          beats:
            - say: 'Ven. Sube. Desde aquí arriba se ve toda la bahía, y esta noche no hay niebla. Mira cómo gira la luz.'
              mood: alegre
            - say: 'Treinta años subiendo sola. Y ahora subo contando tus pasos detrás de los míos. No sé qué hacer con eso. ¿Tú sí?'
              replies:
                - { text: 'Le coges la mano blanca y no la sueltas.', bond: 1, romance: avanza, then: 'Fría, ¿verdad? Pues no la sueltes. Que se caliente.', mood: alegre }
                - { text: 'Le dices que se alegra de no subir sola nunca más.', bond: 1, romance: amigos, then: 'Nunca más. Así me vale. Así me vale de sobra.', mood: alegre }
        - kind: cita
          step: 1
          title: El cuaderno de las barcas
          where: muelle
          beats:
            - say: 'Te he hecho un sitio en el cuaderno. Mira: «Una barca que no es barca. Entró en la bahía y se quedó.» Eres tú.'
              mood: alegre
              replies:
                - { text: 'Le pides que lo apunte con tinta, para que no se borre.', bond: 1, romance: avanza, then: 'Con tinta. Ya sé yo lo que pesa eso. Por ti, lo hago.', mood: alegre }
                - { text: 'Le dices que es un cuaderno de barcos, no de personas.', bond: 0, then: 'Es mi cuaderno. Apunto lo que quiero. Otro día lo entenderás.' }
        - kind: cita
          step: 2
          title: Percebes en la punta
          where: muelle
          beats:
            - say: 'Antes de la galerna, mi padre me traía aquí a coger percebes con la marea baja. Hoy te traigo yo. Cuidado con las rocas, que resbalan.'
              mood: alegre
              replies:
                - { text: 'Resbalas a propósito para que te sujete.', bond: 1, romance: avanza, then: 'Qué mal mientes. Ven aquí, anda.', mood: alegre }
                - { text: 'Te concentras en los percebes.', bond: 0, then: 'Muy bien. Así llenamos la cesta antes.' }
        - kind: cita
          step: 3
          title: La noche sin barcas
          where: muelle
          beats:
            - say: 'Esta noche no ha entrado ni una barca. Es la primera vez en treinta años que el cuaderno se queda en blanco. Y no me importa, porque estás aquí.'
              mood: alegre
              replies:
                - { text: 'Le dices que tú tampoco quieres estar en otro sitio.', bond: 1, romance: avanza, then: 'Entonces no te vayas. Quédate a mirar la luz conmigo.', mood: alegre }
                - { text: 'Le dices que la quieres mucho, pero como amiga.', bond: 0, romance: amigos, then: 'Lo sabía. Lo sabía, y aun así quería oírlo. Amigos, entonces. De los de verdad.', mood: triste }
        - kind: final
          title: La luz que gira
          where: posada
          beats:
            - say: 'Esta noche la luz la enciende Nicasio. Le he pedido el favor. Por una noche, el faro no me necesita. Quédate conmigo.'
              mood: alegre
              replies:
                - { text: 'Te quedas.', bond: 1, romance: avanza, then: 'Apaga tú el candil. Yo ya no tengo miedo a la oscuridad.', fade: true, mood: alegre }
                - { text: 'Le besas la mano blanca y te vas a dormir.', bond: 0, then: 'Otra noche, entonces. Tengo treinta años de noches para darte.' }
        - kind: pareja
          lines:
            - 'Te he apuntado en el cuaderno otra vez. Ya llevas cuarenta y tres entradas.'
            - 'Mira, la mano ya no está tan fría. Será que la cojo mucho.'
            - 'Hoy he subido los escalones de dos en dos. Será la costumbre de bajar a verte.'
        - kind: epilogo
          home: 'Ane deja el faro a Nicasio y se viene contigo al gremio después de «{ending}». Dice que en Puerto Alba hay demasiadas barcas para contarlas, y que por fin no le importa.'
          away: 'Ane y tú os quedáis en el faro de Mareaviva después de «{ending}». Cada noche, al girar la luz, te apunta en su cuaderno.'
          hall: '{heroe} y Ane Goikoa, la farera, {juntos|juntas} desde el día {day}.'
    misionPersonal:
      id: ane-mi-madre
      title: Mi madre sube por los postes
      where: El embarcadero viejo, una noche de Vela
      pitch: 'La madre de Ane, Itziar, se ahogó con la Esperanza en la galerna. Es de las que suben por los postes del embarcadero viejo. Ane quiere verla una vez, y decirle adiós como es debido.'
      endings:
        - id: despedida
          title: El adiós
          summary: 'Ane le dice adiós a su madre en el embarcadero viejo y la deja volver al agua. Esa noche duerme seis horas seguidas.'
        - id: quedarse
          title: La Vela de Ane
          summary: 'Ane no puede soltar a su madre. Desde esa noche hace la Vela siempre que puede, para verla subir.'
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: El Embarcadero Viejo
          days: 1
          next: la-vela-de-ane
        - id: la-vela-de-ane
          kind: escena
          title: La Vela de Ane
          backdrop: El Embarcadero Viejo
          beats:
            - who: Ane Goikoa
              mood: triste
              text: 'Ciriaco me ha dejado la silla. Dice que mi madre sube la cuarta, por el poste de la izquierda. Lleva el chaquetón de patrona.'
            - who: Ciriaco Etxanobe
              mood: triste
              text: 'Ahí está. Itziar. Háblale, niña, que te está mirando.'
            - who: Ane Goikoa
              mood: triste
              text: 'Ama. Soy Ane. Ya no tengo ocho años. ¿Qué hago? ¿Le cojo la mano?'
              options:
                - id: soltar
                  text: 'Dile adiós, Ane. Déjala volver al agua.'
                  check:
                    skill: persuasion
                    dc: 13
                    success:
                      reply:
                        who: Ane Goikoa
                        mood: triste
                        text: 'Agur, ama. Ya cuento yo las barcas. Duerme tú.'
                    failure:
                      reply:
                        who: Ane Goikoa
                        mood: enfadado
                        text: '¡No se va! ¡Sube! ¡Suben todos detrás de ella!'
                - id: coger
                  text: 'Cógele la mano, si es lo que quieres.'
                  reply:
                    who: Ane Goikoa
                    mood: triste
                    text: 'Está fría. Está fría como la mía. Ama, no te vayas todavía.'
          routes:
            soltar: { bien: fin-despedida, mal: los-que-suben }
            coger: fin-quedarse
          next: fin-despedida
        - id: los-que-suben
          kind: tablero
          board:
            id: mision-ane-postes
            name: Los que suben detrás de Itziar
            locationName: El Embarcadero Viejo
            map:
              - '################'
              - '#WWWWWWWWWWWWWW#'
              - '#WWWW......WWWW#'
              - '#WWWW..c...WWWW#'
              - '#WWWWWW..WWWWWW#'
              - '#WWWWWW..WWWWWW#'
              - '#WW..........WW#'
              - '#..............#'
              - '################'
            partyStart: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }]
            enemies:
              - { name: Desvelado, x: 6, y: 2 }
              - { name: Desvelado, x: 9, y: 2 }
              - { name: Desvelado, x: 7, y: 3 }
          win: fin-despedida
          lose: fin-quedarse
          flee: fin-quedarse
        - id: fin-despedida
          kind: final
          ending: despedida
          back: 1
          effects:
            bonds: 2
            flags: [ane-despedida]
            memory: 'Acompañaste a Ane a decirle adiós a su madre en el embarcadero viejo.'
        - id: fin-quedarse
          kind: final
          ending: quedarse
          back: 1
          effects:
            bonds: 1
            memory: 'Ane vio subir a su madre por los postes, y no pudo soltarla.'
```

## Begoña Larrea

```yaml
confidente:
  id: begona
  paquete:
    scenes:
      - rank: 2
        title: Catorce alumnos
        where: plaza
        beats:
          - say: 'Catorce alumnos, y ni uno ha faltado a clase en seis años. Ni un catarro. En la ciudad tenía treinta y siempre faltaban cinco. Esto no es normal, y nadie lo apunta.'
            mood: neutral
          - say: 'Así que lo apunto yo. ¿Te parece una tontería, apuntar lo que nadie quiere ver?'
            replies:
              - { text: 'Le dices que es lo más valiente que se puede hacer en un pueblo así.', bond: 1, then: '¿Valiente? Yo pensaba que era de pesada. Me quedo con lo tuyo.', mood: alegre }
              - { text: 'Le pides que te enseñe el cuaderno.', bond: 1, then: 'Página uno: «Nadie se ahoga». Página dos: «Nadie habla de que nadie se ahoga». Y así ciento veinte.', mood: alegre }
              - { text: 'Le dices que a veces es mejor no saber.', bond: 0, then: 'Eso lo dice todo el pueblo. Por eso estamos así.', mood: enfadado }
      - rank: 4
        title: Las cartas
        where: posada
        beats:
          - say: 'Antes de escribir al gremio, escribí tres cartas a la ciudad. Al obispo, al gobernador y a mi hermana. No contestó nadie. Ni mi hermana, que contesta hasta a las felicitaciones.'
            mood: triste
          - say: 'El correo sale en el carro de la sal, el de la Salazón. Creo que mis cartas no han salido nunca de Mareaviva. Quiero recuperarlas.'
            mood: enfadado
            replies:
              - { text: 'Le dices que vais a buscarlas juntas al carro de la sal.', bond: 1, then: 'Juntas. Me gusta. Mañana sale el carro, y yo sé por dónde pasa.', mood: alegre }
              - { text: 'Le preguntas qué ponía en las cartas.', bond: 0, then: 'La verdad. Que es lo que menos viaja por aquí.', mood: triste }
      - rank: 6
        title: Lo que no le conté al gremio
        where: posada
        beats:
          - say: 'En la carta al gremio no lo puse todo. Mis alumnos dibujan lo mismo desde hace un mes: una pared llena de manos y una señora en el agua. Todos. Sin copiarse.'
            mood: triste
          - say: 'Los quemo al acabar la clase, para que no los vean sus padres. ¿Hago mal?'
            replies:
              - { text: 'Le pides que guarde el próximo, para entenderlo.', bond: 1, then: 'Tienes razón. Los dibujos también son pruebas. Lo guardaré.', mood: neutral }
              - { text: 'Le dices que hace bien: los padres ya tienen bastante miedo.', bond: 1, then: 'Eso pensaba. Gracias por no hacerme sentir una cobarde.', mood: triste }
              - { text: 'Le dices que quemar lo que molesta es lo que hace todo el pueblo.', bond: 0, then: 'Touché. Me lo merezco.', mood: enfadado }
      - rank: 8
        title: Lo que quiero
        where: plaza
        beats:
          - say: 'Quiero que mis alumnos crezcan sabiendo nadar mal. Que tengan miedo al agua, como todo el mundo. Que se resfríen, y falten a clase, y vuelvan con una nota de su madre.'
            mood: alegre
          - say: 'Suena horrible, ¿verdad? Querer que los niños puedan ponerse enfermos. Pero es lo único que quiero.'
            replies:
              - { text: 'Le dices que lo que quiere es que sean libres, no que sufran.', bond: 1, then: 'Libres. Eso es. No sabía decirlo. Tú sí.', mood: alegre }
              - { text: 'Le dices que no suena horrible: suena a maestra.', bond: 1, then: 'A maestra. Mi madre decía que eso era lo peor que se podía ser. Lo decía con orgullo.', mood: alegre }
      - rank: 10
        title: La lección
        where: plaza
        beats:
          - say: 'Pase lo que pase en el Bajo, voy a escribirlo todo. Con tu nombre. Para que dentro de cien años, cuando alguien vuelva a tener la tentación de firmar, lo lea.'
            mood: neutral
          - say: 'Y si me piden que lo cuente en la ciudad, lo cuento. Aunque me llamen loca. Lo haré por ti, que fuiste quien vino cuando escribí.'
            replies:
              - { text: 'Le dices que firmarás tú también lo que escriba.', bond: 1, then: 'Con tinta normal, por favor.', mood: alegre }
              - { text: 'Le das las gracias por haber escrito al gremio.', bond: 1, then: 'Gracias a ti por leerla. Las otras tres no las leyó nadie.', mood: alegre }
    romance:
      with: todos
      no: 'Eres la persona más valiente que conozco, y te quiero cerca. Pero no así. Quédate como mi compañía de los viernes, la de verdad.'
      escenas:
        - kind: senal
          title: Después de clase
          where: plaza
          beats:
            - say: 'Hoy he dado clase pensando en otra cosa. En ti, si te soy sincera. Catorce niños me han pillado y se han reído toda la mañana.'
              mood: alegre
            - say: 'Así que te lo digo antes de que me lo digan ellos: me haces falta. ¿Qué hago con eso?'
              replies:
                - { text: 'Le quitas las gafas y le dices que tú también has pensado en ella.', bond: 1, romance: avanza, then: 'Sin gafas no te veo bien. Acércate, entonces.', mood: alegre }
                - { text: 'Le dices que es la mejor amiga que te has encontrado en esta costa.', bond: 1, romance: amigos, then: 'La mejor amiga. Me lo apunto en la página uno. Subrayado.', mood: alegre }
        - kind: cita
          step: 1
          title: Leer en voz alta
          where: posada
          beats:
            - say: 'Te he traído un libro de la ciudad. Es el único que tengo que no es de clase. ¿Me lees un capítulo? Me gusta cómo suena tu voz.'
              mood: alegre
              replies:
                - { text: 'Le lees despacio, mirándola al pasar cada página.', bond: 1, romance: avanza, then: 'Te has saltado una línea. No me importa. Sigue.', mood: alegre }
                - { text: 'Le dices que leer en voz alta no es lo tuyo.', bond: 0, then: 'Vaya. Pues te leo yo, otro día.' }
        - kind: cita
          step: 2
          title: La lección de nadar
          where: muelle
          beats:
            - say: 'Yo no sé nadar. En la ciudad no hacía falta. Aquí todos nadan como peces, y a mí me da vergüenza preguntar. ¿Me enseñas en la poza de la playa? La que no cubre.'
              mood: alegre
              replies:
                - { text: 'Le sujetas la espalda en el agua y no la sueltas.', bond: 1, romance: avanza, then: 'No me sueltes. Ni aunque aprenda. Sobre todo si aprendo.', mood: alegre }
                - { text: 'Le enseñas a flotar, muy en serio.', bond: 0, then: 'Floto. ¡Floto! Eres mejor maestro que yo.' }
        - kind: cita
          step: 3
          title: El cuaderno nuevo
          where: plaza
          beats:
            - say: 'He empezado un cuaderno nuevo. Este no es sobre Mareaviva. Es sobre {nosotros|nosotras}: sobre tú y yo. Lo tengo en la página dos y ya me he puesto colorada.'
              mood: alegre
              replies:
                - { text: 'Le pides escribir tú la página tres.', bond: 1, romance: avanza, then: 'Con buena letra, que la tuya parece de cura.', mood: alegre }
                - { text: 'Le dices que la quieres mucho, pero solo como amiga.', bond: 0, romance: amigos, then: 'Vale. Arranco la página dos. Pero el cuaderno me lo quedo: la amistad también se apunta.', mood: triste }
        - kind: final
          title: La casa de la maestra
          where: posada
          beats:
            - say: 'Mi casa está al lado de la escuela, y esta noche no hay deberes que corregir. He hecho cena para dos. Quédate.'
              mood: alegre
              replies:
                - { text: 'Te quedas.', bond: 1, romance: avanza, then: 'Cierra la puerta. Mañana es sábado: no hay clase.', fade: true, mood: alegre }
                - { text: 'Cenas con ella y te vas antes de que se haga tarde.', bond: 0, then: 'Otra noche, entonces. La cena estaba buena, ¿eh?' }
        - kind: pareja
          lines:
            - 'Mis alumnos ya saben lo nuestro. Han hecho un dibujo. Salimos las dos con gafas, aunque tú no lleves.'
            - 'He apuntado en el cuaderno lo que me dijiste ayer. Palabra por palabra.'
            - 'Esta noche no corrijo. Esta noche me lees tú.'
        - kind: epilogo
          home: 'Begoña pide el traslado a la escuela de Puerto Alba para estar contigo después de «{ending}». Sus nuevos alumnos faltan a clase, y ella está encantada.'
          away: 'Begoña y tú os quedáis en Mareaviva después de «{ending}». Ella da clase por la mañana, y por las tardes escribís {juntos|juntas} lo que pasó.'
          hall: '{heroe} y Begoña Larrea, la maestra, {juntos|juntas} desde el día {day}.'
    misionPersonal:
      id: begona-cartas
      title: Las cartas que no llegaron
      where: El camino de la sal, un día al este
      pitch: 'Begoña escribió tres cartas a la ciudad antes de escribir al gremio, y ninguna llegó. El correo sale en el carro de la sal de la Salazón. Begoña cree que alguien se las ha quedado, y quiere recuperarlas.'
      endings:
        - id: enviarlas
          title: Las cartas salen
          summary: 'Begoña recupera sus tres cartas y las manda a la ciudad con un arriero de Arenales. Por primera vez, algo sale de Mareaviva sin pasar por la Salazón.'
        - id: guardarlas
          title: Las cartas se quedan
          summary: 'Begoña perdona a Josune y se queda las cartas. Dice que ya no las necesita: ahora tiene quien la escuche.'
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: El camino de la sal
          days: 1
          next: el-carro
        - id: el-carro
          kind: escena
          title: El carro de la sal
          backdrop: La Salazón de los Arrieta
          beats:
            - who: Begoña Larrea
              mood: enfadado
              text: 'Ahí está el carro de la sal. Y mira quién va sentada con el carretero: Josune, la de las pilas.'
            - who: Josune Aramburu
              mood: triste
              text: 'Yo no he dicho nada, ¿eh? …Vale, sí. Las cartas me las daba el capataz para que las tirara al mar. No las tiré. Las tengo en el arcón del carro.'
            - who: Begoña Larrea
              mood: triste
              text: '¿Por qué no las tiraste?'
            - who: Josune Aramburu
              mood: triste
              text: 'Porque las leí. Y tenía razón, señorita. Pero los mozos del capataz vienen detrás del carro, y no me van a dejar dárselas.'
              options:
                - id: perdonar
                  text: 'Josune, dánoslas y vete. Nadie sabrá que fuiste tú.'
                  reply:
                    who: Begoña Larrea
                    mood: triste
                    text: 'Gracias, Josune. Gracias por leerlas. Ya está. Ya me ha leído alguien.'
                - id: enfrentar
                  text: 'Nos llevamos las cartas, y que vengan los mozos del capataz.'
                  check:
                    skill: intimidation
                    dc: 13
                    success:
                      reply:
                        who: Josune Aramburu
                        mood: alegre
                        text: '¡Los mozos se han vuelto a la Salazón! Toma, señorita. Las tres. Mándalas tú.'
                    failure:
                      reply:
                        who: Begoña Larrea
                        mood: enfadado
                        text: 'Ahí vienen. Tres, con ganchos. No pienso soltar mis cartas.'
          routes:
            perdonar: fin-guardarlas
            enfrentar: { bien: fin-enviarlas, mal: los-mozos }
          next: fin-guardarlas
        - id: los-mozos
          kind: tablero
          board:
            id: mision-begona-carro
            name: El carro de la sal
            locationName: El camino de la sal
            map:
              - '################'
              - '#...b.....b....#'
              - '#..............#'
              - '#....T==T......#'
              - '#..............#'
              - '#.b.......c..b.#'
              - '#..............#'
              - '################'
            partyStart: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }]
            enemies:
              - { name: Estibador de la Salazón, x: 11, y: 2 }
              - { name: Estibador de la Salazón, x: 13, y: 4 }
              - { name: Estibador de la Salazón, x: 12, y: 6 }
          win: fin-enviarlas
          lose: fin-guardarlas
          flee: fin-guardarlas
        - id: fin-enviarlas
          kind: final
          ending: enviarlas
          back: 1
          effects:
            bonds: 2
            flags: [cartas-enviadas]
            memory: 'Recuperaste con Begoña sus tres cartas y salieron de Mareaviva.'
        - id: fin-guardarlas
          kind: final
          ending: guardarlas
          back: 1
          effects:
            bonds: 1
            memory: 'Begoña recuperó sus cartas y decidió quedárselas.'
```

## Gorka Iturbe

```yaml
confidente:
  id: gorka
  paquete:
    scenes:
      - rank: 2
        title: El pequeño de los Iturbe
        where: muelle
        beats:
          - say: 'Dos años en la milicia de costa. Me enseñaron a nadar con armadura, y yo me reía: en Mareaviva nadamos así desde que andamos. Luego vi ahogarse a un compañero. No me reí más.'
            mood: triste
          - say: '¿Tú sabes nadar? Pero nadar de verdad, con miedo, como la gente normal.'
            replies:
              - { text: 'Le dices que sí, y que el miedo es lo que te mantiene a flote.', bond: 1, then: 'El miedo. Ojalá yo tuviera un poco. Me haría mejor soldado.', mood: neutral }
              - { text: 'Le dices que no sabes nadar.', bond: 1, then: 'Pues no te separes de mí cerca del agua. A mí no me lleva.', mood: alegre }
      - rank: 4
        title: Iker
        where: posada
        beats:
          - say: 'Hace ocho años salí a pescar con un chico de Arenales. Iker. Era mi amigo. Nos pilló una ola, volcamos, y yo nadé hasta la barca como si nada. Él no. Él se hundió delante de mí.'
            mood: triste
          - say: 'Su madre, Carmen, deja pan en nuestra puerta cada domingo. No sabe por qué lo hace. Yo sí lo sé, y no se lo he dicho nunca. Quiero decírselo.'
            mood: triste
            replies:
              - { text: 'Le dices que irás con él a Arenales.', bond: 1, then: 'Contigo me tiemblan menos las piernas. Gracias.', mood: triste }
              - { text: 'Le preguntas si de verdad cree que ella quiere saberlo.', bond: 0, then: 'No lo sé. Pero yo no puedo seguir comiéndome su pan.', mood: triste }
      - rank: 6
        title: El hermano mayor
        where: muelle
        beats:
          - say: 'Lucio me odia porque me fui. Cuando murió padre, él estaba aquí y yo en un cuartel. Ahora vuelvo, y hago preguntas, y ni siquiera estuve en el entierro.'
            mood: triste
          - say: 'Lo que no sabe es que yo le ayudé a cavar. La segunda pala era la mía. Llegué esa misma noche. ¿Se lo digo?'
            replies:
              - { text: 'Le dices que se lo diga: Lucio necesita saber que no estuvo solo.', bond: 1, then: 'No estuvo solo. Tienes razón. Eso es lo que necesita oír.', mood: alegre }
              - { text: 'Le dices que espere a que pase la bajamar.', bond: 1, then: 'Sí. Si se lo digo ahora, me da con la pala.', mood: neutral }
              - { text: 'Le dices que eso le hace tan culpable como a Lucio.', bond: 0, then: 'Ya lo sé. Por eso no duermo.', mood: enfadado }
      - rank: 8
        title: Lo que quiero
        where: muelle
        beats:
          - say: 'Quiero tenerle miedo al mar. Suena raro, ¿eh? Pero quiero ser como los de Arenales. Que si me caigo de la barca, me pueda pasar algo. Que mi vida valga lo mismo que la de Iker.'
            mood: triste
          - replies:
              - { text: 'Le dices que su vida ya vale lo mismo, con suerte o sin ella.', bond: 1, then: 'Eso lo dirá el mar. Pero me gusta cómo lo dices tú.', mood: alegre }
              - { text: 'Le dices que la suerte también la paga él: con su padre en tierra y los muertos sin dormir.', bond: 1, then: 'Es verdad. Nadie sale gratis de este trato.', mood: triste }
            say: 'Si se acaba el trato, ¿crees que me ahogaré la primera vez que me caiga?'
      - rank: 10
        title: Lo que hará
        where: muelle
        beats:
          - say: 'He decidido una cosa. Pase lo que pase, me quedo en la costa. En la milicia, o en una barca, o en la Vela. Donde haga falta un nadador.'
            mood: alegre
          - say: 'Y si algún día te caes al agua, en esta bahía o en cualquier otra, yo voy detrás. Con miedo o sin miedo. Eso te lo juro por mi padre.'
            replies:
              - { text: 'Le dices que tú harías lo mismo por él.', bond: 1, then: 'Entonces estamos en paz. Y en deuda. Las dos cosas.', mood: alegre }
              - { text: 'Le das un abrazo.', bond: 1, then: 'Cuidado, que estoy mojado. Siempre estoy mojado.', mood: alegre }
    misionPersonal:
      id: gorka-iker
      title: La barca de Iker
      where: Arenales, dos días de costa
      pitch: 'Hace ocho años, Gorka salió a pescar con Iker Urrutia, de Arenales. Volcaron. Gorka nadó como si nada; Iker se hundió. Su madre, Carmen, deja pan cada domingo en la puerta de los Iturbe sin saber por qué. Gorka quiere contárselo.'
      endings:
        - id: contarlo
          title: La verdad
          summary: 'Gorka le cuenta a Carmen cómo murió su hijo. Carmen llora, le coge la cara con las dos manos y le dice que ya no hace falta que vuelva el pan.'
        - id: callar
          title: El pan de los domingos
          summary: 'Gorka no se atreve. Vuelve a Mareaviva sin decir nada, y el domingo el pan sigue en la puerta.'
      start: ida
      steps:
        - id: ida
          kind: viaje
          to: Arenales
          days: 2
          next: la-puerta
        - id: la-puerta
          kind: escena
          title: La puerta de Carmen
          backdrop: Arenales
          beats:
            - who: Gorka Iturbe
              mood: triste
              text: 'Es esa casa, la del chal verde tendido. Llevo ocho años sin pasar por esta calle.'
            - who: Carmen Urrutia
              mood: triste
              text: '¿Tú eres el chico de los Iturbe? El que salió con mi Iker. Pasa. Te he guardado pan.'
            - who: Gorka Iturbe
              mood: triste
              text: 'Carmen, yo… Los primos de Iker están en la puerta, con remos. Saben quién soy. ¿Qué hago?'
              options:
                - id: contar
                  text: 'Cuéntaselo todo, Gorka. Aquí y ahora.'
                  check:
                    skill: persuasion
                    dc: 12
                    success:
                      reply:
                        who: Carmen Urrutia
                        mood: triste
                        text: 'Se hundió delante de ti, y tú no te hundiste. No es culpa tuya, hijo. Es culpa del mar de allí. Que se vayan los primos.'
                    failure:
                      reply:
                        who: Gorka Iturbe
                        mood: enfadado
                        text: '¡Los primos han oído «Mareaviva» y han entrado con los remos! ¡Cuidado!'
                - id: callar
                  text: 'Coge el pan, Gorka. Hoy no es el día.'
                  reply:
                    who: Gorka Iturbe
                    mood: triste
                    text: 'Gracias por el pan, Carmen. Volveré otro domingo.'
          routes:
            contar: { bien: fin-contarlo, mal: los-primos }
            callar: fin-callar
          next: fin-callar
        - id: los-primos
          kind: tablero
          board:
            id: mision-gorka-primos
            name: Los primos de Iker
            locationName: Arenales
            map:
              - '##############'
              - '#....T...T...#'
              - '#............#'
              - '#..c......c..#'
              - '#............#'
              - '#.T........T.#'
              - '#............#'
              - '##############'
            partyStart: [{ x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }]
            enemies:
              - { name: Pescador de Arenales, x: 9, y: 2 }
              - { name: Pescador de Arenales, x: 11, y: 4 }
              - { name: Pescador de Arenales, x: 7, y: 1 }
          win: fin-contarlo
          lose: fin-callar
          flee: fin-callar
        - id: fin-contarlo
          kind: final
          ending: contarlo
          back: 2
          effects:
            bonds: 2
            flags: [gorka-conto-lo-de-iker]
            memory: 'Fuiste con Gorka a Arenales y le contó a Carmen cómo murió su hijo.'
        - id: fin-callar
          kind: final
          ending: callar
          back: 2
          effects:
            bonds: 1
            memory: 'Fuiste con Gorka a Arenales, y al final no se atrevió a decir nada.'
```

## El hermano Julián

```yaml
confidente:
  id: julian
  paquete:
    scenes:
      - rank: 2
        title: Veintitrés llaves
        where: templo
        beats:
          - say: 'Veintitrés llaves. La de la sacristía, la del campanario, la del cepillo de los pobres… Abro todas las puertas cada mañana, aunque no entre nadie. Así Dios sabe que seguimos aquí.'
            mood: neutral
          - say: '¿Tú rezas? No hace falta que sea a Dios. Cada uno reza a lo que tiene.'
            replies:
              - { text: 'Le dices que rezas a tu manera, de vez en cuando.', bond: 1, then: 'De vez en cuando ya es más que todo Mareaviva. Bienvenido seas.', mood: alegre }
              - { text: 'Le dices que no rezas.', bond: 0, then: 'Pues yo rezo por ti, y así no se desperdicia.', mood: alegre }
      - rank: 4
        title: Don Fermín
        where: templo
        beats:
          - say: 'Don Fermín me enseñó todo lo que sé. Y en treinta años no me dejó entrar en su despacho ni una vez. Cuando murió, encontré el cajón vacío y la llave de una caja que no estaba.'
            mood: triste
          - say: 'Ahora sé lo que bendijo en el Bajo. Y no sé si rezar por él o contra él.'
            replies:
              - { text: 'Le dices que rece por él: quien bendice con miedo también necesita perdón.', bond: 1, then: 'Con miedo. Sí. Temblaba, dice la pared. Rezaré por el que temblaba.', mood: triste }
              - { text: 'Le dices que Don Fermín sabía lo que hacía.', bond: 0, then: 'Eso es lo que más me duele.', mood: triste }
      - rank: 6
        title: Las cajas de piedras
        where: templo
        beats:
          - say: 'Yo bendije las sesenta y una cajas de piedras. Una por una. Sabiendo lo que había dentro. Les decía a las viudas que sus hombres descansaban en paz.'
            mood: triste
          - say: 'Les mentí sesenta y una veces. ¿Qué clase de hombre de Iglesia hace eso?'
            replies:
              - { text: 'Le dices que les dio un sitio donde llorar, y eso no es mentira.', bond: 1, then: 'Un sitio donde llorar. Lázaro dice lo mismo. Será verdad, si lo dice el enterrador.', mood: triste }
              - { text: 'Le dices que uno que se arrepiente.', bond: 1, then: 'Que se arrepiente. Eso aún me queda.', mood: triste }
              - { text: 'Le dices que uno cobarde.', bond: -1, then: 'Sí. Eso también.', mood: enfadado }
      - rank: 8
        title: Lo que quiero
        where: templo
        beats:
          - say: 'Quiero enterrar a alguien de verdad. Con su nombre, en tierra, con una misa que se oiga. Y que la iglesia se llene. Aunque sea de gente llorando.'
            mood: alegre
          - say: 'Una iglesia llena de gente llorando es una iglesia viva. ¿Me ayudarás a llenarla?'
            replies:
              - { text: 'Le dices que tocarás tú la campana.', bond: 1, then: 'Es la llave catorce. Te la presto. Toca fuerte.', mood: alegre }
              - { text: 'Le dices que primero hay que acabar con el trato.', bond: 1, then: 'Primero lo primero, sí. Pero la campana te la guardo.', mood: neutral }
      - rank: 10
        title: La llave veinticuatro
        where: templo
        beats:
          - say: 'He mandado hacer una llave nueva. La veinticuatro. Es la de la iglesia, la puerta grande. Es para ti.'
            mood: alegre
          - say: 'Para que entres cuando quieras, de día o de noche. Si alguna vez necesitas un sitio donde no te encuentre nadie, ni lo que sube del agua, aquí lo tienes.'
            replies:
              - { text: 'La aceptas y le das las gracias.', bond: 1, then: 'No me las des. Que Dios te guarde. Y si no puede, te guardo yo.', mood: alegre }
              - { text: 'Le dices que la guardará mejor él.', bond: 1, then: 'Pues la cuelgo con las otras, con tu nombre. Así ya son veinticuatro.', mood: alegre }
```

## Txomin Etxeberria

```yaml
confidente:
  id: txomin
  paquete:
    scenes:
      - rank: 2
        title: Todo tiene precio
        where: posada
        beats:
          - say: '{Patrón|Patrona}, en esta vida todo tiene precio. Un consejo, una moneda. Un buen consejo, dos. Uno que te salve la vida, lo que lleves encima.'
            mood: alegre
          - say: 'Pero contigo hago una excepción. Este es gratis: nunca bebas el aguardiente que no te sirvan delante. ¿Qué me das a cambio?'
            replies:
              - { text: 'Le invitas a un vaso.', bond: 1, then: 'Delante de mí, ¿ves? Así se hace. Aprendes rápido.', mood: alegre }
              - { text: 'Le dices que los consejos gratis no se pagan.', bond: 0, then: 'Pues por eso nadie los sigue.', mood: neutral }
      - rank: 4
        title: El Gallo
        where: posada
        beats:
          - say: 'Doce años trabajé para el Gallo. Le monté la cala, le enseñé los atajos, le presenté a los compradores de la sal. Y un día me quitó mi parte y me echó por el acantilado. Literal. Por el acantilado.'
            mood: enfadado
          - say: 'Sobreviví porque caí en el agua honda. Ni siquiera soy de Mareaviva. Tuve suerte, la de verdad.'
            replies:
              - { text: 'Le dices que el Gallo le debe mucho.', bond: 1, then: 'Doce años de parte. Con intereses. Algún día se los cobro.', mood: enfadado }
              - { text: 'Le preguntas por qué no se fue de la costa.', bond: 1, then: 'Porque esta costa es mía, aunque sea fea. No me echa nadie dos veces.', mood: neutral }
      - rank: 6
        title: Lo que vende
        where: posada
        beats:
          - say: 'Te voy a contar un secreto, {patrón|patrona}. La sal de la Salazón no vale más que otra. Lo que se paga es que viene de Mareaviva. Los de fuera creen que da suerte. Se la echan a los barcos.'
            mood: neutral
          - say: 'Yo la vendía sabiendo que la suerte de verdad la pagan los de Arenales. Y la vendía igual. ¿Qué piensas de mí ahora?'
            replies:
              - { text: 'Le dices que ahora está aquí, ayudando a pagar esa cuenta.', bond: 1, then: 'Ayudando. Hay que ver. Mi madre no se lo creería.', mood: alegre }
              - { text: 'Le dices que todos venden algo que no deberían.', bond: 1, then: 'Eso es filosofía de contrabandista. Me gusta.', mood: alegre }
              - { text: 'Le dices que eso estuvo mal.', bond: 0, then: 'Lo sé. Por eso te lo cuento a ti, y no a un cura.', mood: triste }
      - rank: 8
        title: Lo que quiero
        where: muelle
        beats:
          - say: 'Lo que quiero de verdad, {patrón|patrona}, es una barca. Mía, con papeles. Pescar en la bahía como un pescador honrado, con su suerte o sin ella.'
            mood: alegre
          - say: 'Suena aburrido, ¿eh? Pues es lo que más quiero en el mundo. No se lo digas a nadie, que pierdo fama.'
            replies:
              - { text: 'Le prometes guardarle el secreto.', bond: 1, then: 'Eso vale más que cualquier consejo. Te debo una. Gratis.', mood: alegre }
              - { text: 'Le dices que le ayudarás a comprarla.', bond: 1, then: '¿Tú? ¿Pagar algo sin que te lo cobren? Me vas a hacer llorar.', mood: alegre }
      - rank: 10
        title: La deuda
        where: muelle
        beats:
          - say: 'He hecho cuentas, {patrón|patrona}. Entre lo que me has pagado, lo que me has salvado y lo que te he cobrado de más, te debo exactamente una vida. La mía.'
            mood: neutral
          - say: 'Así que cuando la necesites, está aquí. Sin cobrarte nada. Es la primera vez en mi vida que digo eso, así que apúntalo.'
            replies:
              - { text: 'Le dices que lo apuntas, con fecha y firma.', bond: 1, then: 'Con tinta normal, ¿eh? Que en esta costa las firmas se pagan caras.', mood: alegre }
              - { text: 'Le dices que no le debe nada.', bond: 1, then: 'Eso es lo peor que se le puede decir a un contrabandista. Te debo dos, entonces.', mood: alegre }
```
