# Las tierras del ocaso — ronda 6: las charlas

> Escrita por Claude (tanda 20, 2026-10-03). Seis charlas con ramas para la gente con la que se habla más de una vez: el notario, la posadera de Tres Mojones, la guardiana de las Hayas, el archivero de las Forjas, la refugiera y la cocinera del Cierzo. Lo ya preguntado no vuelve a salir; lo que se aprende va al Diario.

## El encargo de la variedad

encargo:
  id: e-clavos
  verbo: recuperar

## El notario del rey

charla:
  id: rufino-la-carta
  speaker: rufino
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: "Primero, siéntate. Segundo, pregunta. Tercero, no me hagas reír, que me duele la pierna."
      again:
        - if: { milestone: m-fanal }
          text: "Primero, el fanal arde. Segundo, la Carta se cumple. Tercero, ya puedo morirme tranquilo. Pero hoy no."
        - "Primero, buenos días. Segundo, ¿qué cláusula quieres hoy?"
        - "Tú otra vez. Bien: la pierna, mejor; la Carta, igual."
      more: ["¿Alguna cláusula más?", "Siguiente punto."]
      options:
        - id: que-dice
          text: "¿Qué dice exactamente la Carta del Paso?"
          next: carta
        - id: el-sello
          text: "¿Qué hace el sello, además de abrir la puerta?"
          next: sello
        - id: la-catorce
          text: "¿Hay alguna cláusula que nadie lea?"
          next: catorce
        - id: tiembla
          text: "Te tiembla la voz cuando hablas de Oramar."
          check:
            skill: insight
            dc: 13
            success: { next: secreto }
            failure:
              reply: { text: "Primero, me tiembla la pierna. Segundo, la voz no. Tercero, cambia de tema.", mood: enfadado }
        - id: adios
          text: "Me voy al camino."
          end: true
          repeat: true
          reply: { text: "Primero, cuidado. Segundo, más cuidado. Tercero, vuelve con el sello." }
    - id: carta
      line: "Cláusula uno: el paso es del reino. Cláusula dos: quien encienda el fanal con su bandera lo guarda hasta el deshielo. Cláusula tres: el sello va en mano de persona de palabra."
      journal: "La Carta del Paso: quien encienda el fanal de la Atalaya con su bandera guarda el paso hasta el deshielo."
      options:
        - id: entendido
          text: "Entendido."
          next: inicio
          reply: { text: "Primero, bien. Segundo, apúntalo, que luego todo el mundo se acuerda de otra manera." }
    - id: sello
      line: "Es hierro enano, de cuando Hondaroca guardaba la Atalaya. Abre la puerta grande. Y el guardián de hierro de dentro despierta con quien entra sin él."
      journal: "El guardián de hierro de la Atalaya despierta si alguien entra sin el Sello de la Grulla."
      options:
        - id: y-con-el
          text: "¿Y si entro con él?"
          next: inicio
          reply: { text: "Primero, despierta igual, pero más tarde. Segundo, eso dice el libro. Tercero, el libro es muy viejo.", mood: triste }
    - id: catorce
      mood: triste
      line: "Cláusula catorce. Si nadie enciende el fanal antes de la nieve, el paso queda abierto para todos hasta la primavera. Nadie la lee porque a nadie le conviene."
      journal: "Cláusula catorce de la Carta: si nadie enciende el fanal antes de la nieve, el paso queda abierto para todos."
      options:
        - id: a-mi-si
          text: "A mí sí me conviene."
          effects: [{ attitude: 1 }]
          next: inicio
          reply: { text: "Primero, eso dice mucho de ti. Segundo, no se lo digas a ninguna casa.", mood: alegre }
    - id: secreto
      mood: triste
      line: "Primero, sí. Segundo, hace años copié la Carta para Oramar, y me pagaron por dejarme fuera la cláusula catorce. Tercero, no se lo digas a nadie."
      journal: "El notario hizo para Oramar una copia de la Carta sin la cláusula catorce, a cambio de dinero."
      options:
        - id: perdono
          text: "Lo que importa es que ahora la cumplas."
          effects: [{ attitude: 1 }]
          next: inicio
          reply: { text: "Primero, gracias. Segundo, la cumpliré. Tercero, gracias otra vez.", mood: alegre }
        - id: a-brezo
          text: "Eso le interesará mucho a Brezo."
          effects: [{ attitude: -1 }]
          next: inicio
          reply: { text: "Primero, lo sé. Segundo, te pido que no. Tercero, haz lo que quieras: ya lo harás igual.", mood: enfadado }

## La posadera de Tres Mojones

charla:
  id: brigida-cuentas
  speaker: brigida
  start: inicio
  nodes:
    - id: inicio
      line: "La cama, cuatro sueldos la noche. El susto, gratis. Soy Brígida, por si no te acuerdas, y llevo la cuenta de todo lo que pasa en esta posada."
      again:
        - if: { milestone: m-fanal }
          text: "¡Mira quién vuelve! Desde que arde el fanal, entra gente otra vez. Eso son cuatro sueldos... para ti, tres."
        - "Cuatro sueldos la cama, como ayer. ¿Qué te pongo?"
        - "Otra vez por aquí. La cuenta sigue abierta, y la sopa, caliente."
      more: ["¿Algo más? Lo apunto.", "Tú dirás. La tiza está lista."]
      options:
        - id: monedas
          text: "¿Quién ha pagado con monedas raras últimamente?"
          effects: [{ rumor: r-monedas-nuevas }]
          reply: { text: "Tres que durmieron aquí antes de que cayera el puente. Monedas recién hechas en Vadoancho. Las tengo aparte, en un tarro." }
        - id: pajar
          text: "Subes mucha sopa al pajar para no tener huéspedes."
          check:
            skill: insight
            dc: 13
            success: { next: pajar }
            failure:
              reply: { text: "Es para el gato. Come mucho, el gato. Eso son cuatro sueldos por meterte donde no te llaman.", mood: enfadado }
        - id: cama
          text: "Una cama para esta noche."
          if: { gold: 4 }
          effects: [{ gold: -4 }, time]
          reply: { text: "Cuatro sueldos. Sábanas limpias, las del martes. Que descanses.", mood: alegre }
        - id: adios
          text: "Hasta luego, Brígida."
          end: true
          repeat: true
          reply: { text: "Hasta luego. Y paga la próxima vez antes de irte, que me lías las cuentas." }
    - id: pajar
      mood: triste
      line: "Vale. Arriba tengo a uno de capa gris, con una pierna abierta. Me pagó bien por callar. No es mal chico. Solo cobra de quien no debe."
      journal: "La posadera de Tres Mojones esconde en el pajar a un mercenario del Cierzo herido."
      options:
        - id: dejarlo
          text: "Que se cure. Luego, que se vaya lejos."
          effects: [{ attitude: 1 }]
          next: inicio
          reply: { text: "Eso le diré. Y que no vuelva a cobrar de nadie con capa gris.", mood: alegre }
        - id: preguntarle
          text: "Quiero hablar con él."
          check:
            skill: persuasion
            dc: 12
            success:
              effects: [{ clue: "El mercenario del pajar dice que el capitán del Cierzo quiere encender el fanal con su propia bandera y ser la cuarta casa." }]
              next: inicio
              reply: { text: "Ha dicho que el capitán quiere encender el fanal con su bandera gris. Que quiere ser la cuarta casa. Y que ya no le paga ni a él." }
            failure:
              next: inicio
              reply: { text: "No quiere hablar. Dice que si habla, no cobra. Lo de siempre.", mood: triste }

## La guardiana de las Hayas Rojas

charla:
  id: maelis-sendas
  speaker: maelis
  start: inicio
  nodes:
    - id: inicio
      line: "Hace poco, quizá doscientos años, esto era un claro. Soy Maelis Cortezaroja, y guardo las sendas que salen de este bosque."
      again:
        - "Has vuelto pronto. Para mí, todo el mundo vuelve pronto."
        - "Las hojas siguen rojas. Siéntate, si no tienes prisa. Nadie tiene prisa aquí."
      more: ["¿Algo más? El bosque escucha, yo también.", "Pregunta. No me voy a ninguna parte."]
      options:
        - id: hojas
          text: "¿Por qué se han puesto rojas las hayas?"
          effects: [{ rumor: r-hojas-rojas }]
          reply: { text: "El invierno llega un mes antes. La última vez que pasó, nevó hasta mayo y se murieron los ciervos de hambre.", mood: triste }
        - id: sendas
          text: "¿Por dónde empiezan las Sendas Viejas?"
          check:
            skill: persuasion
            dc: 12
            success: { next: sendas }
            failure:
              reply: { text: "Las Sendas no son para la guerra. Vuelve cuando no lleves la guerra en el cinto.", mood: enfadado }
        - id: elfo
          text: "Mi abuela me hablaba de estas hayas."
          if: { species: Elfo }
          effects: [{ attitude: 1 }]
          next: sendas
          reply: { text: "Entonces conoces el camino aunque no lo sepas. Te lo enseño.", mood: alegre }
        - id: el-mapa
          text: "Alguien vendió una copia del mapa de las Sendas. Tú sabes quién."
          if: { attitude: 1 }
          next: mapa
        - id: adios
          text: "Me voy. Gracias por el rato."
          end: true
          repeat: true
          reply: { text: "Vete despacio. Lo rápido se pierde en estos bosques." }
    - id: sendas
      line: "Detrás del barranco hay una piedra con una marca de hoja. Cada piedra señala la siguiente. Si sabes leerlas, llegas al paso en dos días."
      journal: "Las Sendas Viejas empiezan detrás del barranco de las Hayas Rojas: cada piedra señala la siguiente."
      effects: [{ rumor: r-sendas }]
      options:
        - id: gracias-sendas
          text: "Gracias, Maelis."
          next: inicio
          reply: { text: "No me las des. Úsalas bien, que es lo mismo." }
    - id: mapa
      mood: triste
      line: "Lo dibujé yo. Para Caelan, el hermano de Ilvana, que me lo pidió como recuerdo. Él lo vendió. Yo lo dibujé. No sé cuál de los dos pesa más."
      journal: "Maelis dibujó la copia del mapa de las Sendas para Caelan Hojarrubia, que la vendió al Cierzo."
      options:
        - id: no-culpa
          text: "Tú no sabías para qué era."
          effects: [{ attitude: 1 }]
          next: inicio
          reply: { text: "Doscientos años y todavía me sorprende la gente. Eso no me consuela, pero gracias." }
        - id: a-ilvana
          text: "Ilvana tiene que saberlo."
          next: inicio
          reply: { text: "Ilvana ya lo sabe. Por eso no vuelve al bosque.", mood: triste }

## El archivero de las Forjas

charla:
  id: ulfo-archivo
  speaker: ulfo
  start: inicio
  nodes:
    - id: inicio
      mood: alegre
      line: "¡Estante nueve, legajo tres! Ay, perdona. Ulfo Piedrafría, archivero del clan. ¿Vienes a leer? ¡Nadie viene nunca a leer!"
      again:
        - "¡Has vuelto! Te he guardado sitio. Bueno, el sitio es el de siempre: aquí nadie lo ocupa."
        - "Estante doce, legajo uno: las visitas. Te apunto otra vez. ¡Qué maravilla!"
      more: ["¿Otro legajo? Tengo cuatro mil.", "¡Más preguntas! Sigue, sigue."]
      options:
        - id: clausula
          text: "¿Qué sabes de la Carta del Paso?"
          next: clausula
        - id: atalaya
          text: "¿Por qué perdió tu clan la Atalaya?"
          next: atalaya
        - id: oro
          text: "¿De dónde ha sacado la thane tanto oro este otoño?"
          check:
            skill: persuasion
            dc: 14
            success: { next: oro }
            failure:
              reply: { text: "Estante... no. Ese estante no existe. No me preguntes por ese estante.", mood: triste }
        - id: runas
          text: "¿Qué runas mueven al guardián de hierro de la Atalaya?"
          if: { class: Mago }
          effects: [{ clue: "Las runas del guardián de hierro se apagan un momento cada vez que recibe un golpe de trueno." }, { attitude: 1 }]
          reply: { text: "¡Runas de piedra y trueno! Con un golpe de trueno se apagan un instante. Estante treinta, legajo nueve. Nadie lo había preguntado nunca.", mood: alegre }
        - id: adios
          text: "Te dejo con tus libros."
          end: true
          repeat: true
          reply: { text: "Ellos no me dejan a mí. Vuelve cuando quieras." }
    - id: clausula
      line: "La Carta tiene veinte cláusulas, y todo el mundo lee la dos. La que importa es la catorce: si nadie enciende el fanal antes de la nieve, el paso queda abierto para todos."
      journal: "Según el archivero, en los libros de la ermita del collado hay una copia vieja de la Carta con la cláusula catorce entera."
      options:
        - id: copia
          text: "¿Dónde hay una copia entera?"
          next: inicio
          reply: { text: "En los libros de peaje de la ermita del collado. Los frailes copiaban todo. ¡Todo! Hasta lo que no les mandaban." }
    - id: atalaya
      mood: triste
      line: "Hace sesenta años, el último thane murió en la puerta y el clan bajó a las Forjas a llorarlo. Las casas dijeron que la guardarían mientras tanto. El mientras tanto dura todavía."
      journal: "Hondaroca bajó de la Atalaya hace sesenta años, cuando murió su último thane. Las casas no se la devolvieron."
      options:
        - id: lo-siento
          text: "Lo siento."
          next: inicio
          reply: { text: "Gracias. Está en el estante uno. Lo leo cada invierno." }
    - id: oro
      mood: triste
      line: "Oramar le ha pagado a la thane por el derecho del clan sobre la Atalaya. Firmado y sellado. Si Oramar enciende el fanal, Hondaroca no podrá decir nada."
      journal: "La thane de Hondaroca vendió a Oramar el derecho del clan sobre la Atalaya."
      options:
        - id: gudrun-sabe
          text: "¿Lo sabe Gudrun?"
          next: inicio
          reply: { text: "Gudrun lo sabe todo y no dice nada. Es lo que tiene ser nieta de quien fue." }

## La refugiera

charla:
  id: nieves-refugio
  speaker: nieves
  start: inicio
  nodes:
    - id: inicio
      line: "Dos nevadas más y no sube ni una cabra. Nieves Albar, refugiera. Cama, sopa y leña: ocho sueldos."
      again:
        - if: { milestone: m-fanal }
          text: "Ha nevado tres veces desde que arde el fanal, y ya no tengo miedo de que me quemen el refugio. Pasa."
        - "Una nevada menos desde la última vez. Pasa, que se escapa el calor."
      more: ["¿Algo más? Antes de que cierre la puerta.", "Dime, que se enfría la sopa."]
      options:
        - id: nevadas
          text: "¿Cuánto falta para que se cierre el paso?"
          effects: [{ rumor: r-nevadas }]
          reply: { text: "Dos nevadas grandes. La primera, esta semana. La segunda, cuando le dé la gana al monte." }
        - id: casas
          text: "¿Qué hacen aquí las tres casas?"
          reply: { text: "Esperar a que suba otro. Treinta lanzas de Brezo, veinte ballestas de Oramar y diez hachas enanas. Y comen todos de mi leña.", mood: enfadado }
        - id: cornisa
          text: "¿Hay otro camino a la Atalaya?"
          effects: [{ rumor: r-cornisa }]
          reply: { text: "La cornisa de las grullas, por detrás. Pregúntale al arriero: él la ha subido con mulas, cuando tenía mulas." }
        - id: cama
          text: "Me quedo esta noche."
          if: { gold: 8 }
          effects: [{ gold: -8 }, time]
          reply: { text: "Ocho sueldos. Duermes junto a la chimenea, que es donde no entra el viento.", mood: alegre }
        - id: adios
          text: "Me voy, Nieves."
          end: true
          repeat: true
          reply: { text: "Cierra al salir. Y mira el cielo antes de echar a andar." }

## La cocinera del Cierzo

charla:
  id: mencia-perol
  speaker: mencia
  start: inicio
  nodes:
    - id: inicio
      mood: enfadado
      line: "Eso vale dos cazos. ¿Y tú quién eres? A ti no te había visto. Mencía Tostado, la que da de comer a estos desagradecidos."
      again:
        - "¿Otra vez tú? Dos cazos, como siempre. Y no preguntes de qué es la carne."
        - "Al perol le quedan tres raciones y al Cierzo, tres días. Siéntate."
      more: ["¿Algo más? El perol no espera.", "Pregunta rápido, que se me pega."]
      options:
        - id: tuerta
          text: "¿Qué pasa entre la sargento y el capitán?"
          effects: [{ rumor: r-tuerta }]
          reply: { text: "Que no se hablan desde el verano. Él la dejó atrás en una pelea, y le costó el ojo. Ella come aparte, y come mejor." }
        - id: paga
          text: "¿Cuándo cobra el Cierzo?"
          effects: [{ rumor: r-sin-paga }]
          reply: { text: "Tres meses sin cobrar. El capitán dice que en primavera, cuando venda el paso. Yo digo que en primavera me voy.", mood: triste }
        - id: tienda
          text: "¿Dónde guarda la sargento sus cosas?"
          check:
            skill: deception
            dc: 13
            success:
              effects: [{ clue: "La sargento del Cierzo guarda el mapa de las Sendas en el cofre de su tienda, la de la derecha." }]
              reply: { text: "En la tienda de la derecha, en un cofre. Y si te pillan, yo no te he visto. Dos cazos por el silencio." }
            failure:
              reply: { text: "¿Y a ti qué te importa? Come y calla, que eso es gratis.", mood: enfadado }
        - id: carne
          text: "La carne del capitán huele peor que la tuya."
          check:
            skill: insight
            dc: 12
            success: { next: carne }
            failure:
              reply: { text: "Toda la carne huele igual en un campamento. Es la montaña." }
        - id: adios
          text: "Me voy antes de que me pidan la paga a mí."
          end: true
          repeat: true
          reply: { text: "Lista. Más lista que el capitán, eso seguro.", mood: alegre }
    - id: carne
      mood: alegre
      line: "Porque se la echo a perder a propósito. Desde que no me paga. Que coma lo que vale."
      journal: "La cocinera del Cierzo echa a perder la comida del capitán desde que no le paga."
      options:
        - id: me-parece-bien
          text: "Me parece justo."
          effects: [{ attitude: 1 }]
          next: inicio
          reply: { text: "¡Por fin alguien con sentido común en esta montaña!" }
