---
title: El mundo tras la pantalla — ronda 7, las charlas
tags: [pantalla, guion, charlas, dialogos]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 7: las charlas

> Siete charlas con ramas, para la gente con quien se habla más de una vez: Remedios, el tasador, Florián, Sabina, Madre Olvido, Severino y Nuria. Cada una con lo de la primera vez, lo de quien vuelve (`again`), lo de seguir en la misma charla (`more`), lo que va al Diario (`journal`) y una opción solo para quien encaja (una clase o una especie).
>
> **Tres charlas mueven la historia:** la del tasador cumple «El que pone precio»; la de Madre Olvido puede encontrar el plano de la Primera Cuidadora (el secreto); y la de Florián lleva a la pelea de la loba, que no pide ningún hito (D-J62: se entra hablando).
>
> **Comprobación:** cada respuesta corta del héroe tiene su `reply`; cada uno habla con su voz (Remedios dice «criatura» y cuenta; el tasador tasa a ojo; Florián repite lo último; Sabina canta coplas; Madre Olvido receta tilas; Severino lo cuenta en sacos; Nuria lo compara con su mundo). ✔

## Brasa

charla:
  id: remedios-libro
  speaker: remedios
  title: El Libro de Llegadas
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: "Siéntate, criatura, que de pie no se habla. ¿Qué te trae a mi cocina?"
      again:
        - if: { milestone: los-nombres-del-libro }
          text: "Criatura. Cada noche leo «Abel» en mi libro, en voz alta. Por si acaso."
        - "¿Ya de vuelta? Siéntate, que te guardo un plato. Vienes en los huesos."
      more: ["¿Algo más, criatura?", "Dime, dime, que tengo el guiso al fuego."]
      options:
        - id: ver-libro
          text: "Enséñame tu Libro de Llegadas."
          next: libro
        - id: hablame-iker
          text: "Háblame de Iker."
          if: { milestone: { id: la-hondonada-gris, is: not-done } }
          next: iker
        - id: iker-vivo
          text: "He encontrado a Iker. Vive en la Hondonada Gris."
          if: { milestone: la-hondonada-gris }
          effects: [{ attitude: 1 }]
          next: iker-vivo
        - id: abel
          text: "¿Te acuerdas de algo de Abel?"
          if: { milestone: los-nombres-del-libro }
          next: abel
        - id: alguien-volvio
          text: "¿Algún huésped ha vuelto a su mundo?"
          if: { species: Huésped }
          reply: { mood: triste, text: "Ninguno, criatura. Veinte años apuntando llegadas, y ni una salida." }
        - id: adios-remedios
          text: "Me voy, Remedios."
          end: true
          repeat: true
          reply: { text: "Ve con cuidado. Y vuelve a cenar, que cuento contigo: uno más en la mesa." }
    - id: libro
      line: "Veinte años de llegadas. Cada huésped que sale del bosque, con su nombre, su fecha y lo que traía en los bolsillos."
      journal: "Remedios apunta a mano a cada huésped que llega a Brasa. Lo escrito a mano es lo único que la torre no borra."
      options:
        - id: por-que-a-mano
          text: "¿Por qué a mano?"
          next: a-mano
        - id: libro-entendido
          text: "Entendido."
          next: inicio
          reply: { text: "Eso, eso. Tú hazme caso y apunta las cosas." }
    - id: a-mano
      mood: triste
      line: "Porque la torre borra lo que se recuerda, pero no la tinta. Si me olvido de alguien, abro el libro y ahí está. Aunque no sepa quién es."
      options:
        - id: lo-siento-remedios
          text: "Lo siento, Remedios."
          next: inicio
          reply: { text: "No lo sientas, criatura. Apúntalo." }
    - id: iker
      mood: triste
      line: "Cocinaba conmigo. Le echaba demasiada sal a todo y cantaba mientras pelaba patatas. Eso me acuerdo. La cara, ya no."
      journal: "Iker cocinaba en la Posada del Despertar y salía cada mañana al Bosque Copiado a por setas."
      options:
        - id: iker-volver
          text: "Lo encontraré."
          next: inicio
          reply: { mood: alegre, text: "Eso. Y cuando vuelva, le pongo la sal yo." }
    - id: iker-vivo
      mood: alegre
      line: "¿Vivo? ¡Vivo! Uno, dos… Ay, criatura. Mañana le mando una cazuela, aunque no sepa quién se la manda."
      options:
        - id: iker-vivo-volver
          text: "Se la llevaré yo."
          next: inicio
          reply: { mood: alegre, text: "Con poca sal. Que la de antes la ponía él." }
    - id: abel
      mood: triste
      line: "Nada. Ni la voz, ni la cara. Solo que en el desván hay una litera que nunca le doy a nadie, y no sé por qué."
      journal: "Remedios guarda una litera vacía en el desván y no sabe para quién."
      options:
        - id: abel-volver
          text: "Algún día lo sabrás."
          next: inicio
          reply: { mood: triste, text: "Ojalá, criatura. Ojalá." }

## Cifra

charla:
  id: pelayo-tasador
  speaker: pelayo
  title: El que pone precio
  start: inicio
  when: { milestone: la-lonja }
  nodes:
    - id: inicio
      mood: neutral
      line: "Nivel uno… no, dos. Botas de nivel uno, espada de nivel uno. Pelayo Ojeda, tasador. ¿Vienes a que te ponga precio?"
      again:
        - if: { milestone: el-registro }
          text: "¿Lo tenéis? No me lo digas. No quiero saberlo. Bueno, sí: ¿lo tenéis?"
        - "Tú otra vez. Nivel… da igual. ¿Qué quieres?"
      more: ["¿Algo más? Rápido, que nos miran.", "Sigue, sigue. Bajito."]
      options:
        - id: tasaste-iker
          text: "Tú tasaste a Iker Mendaña."
          if: { milestone: { id: el-tasador, is: open } }
          repeat: true
          next: confiesa
        - id: como-tasas
          text: "¿Cómo se le pone precio a una persona?"
          next: como
        - id: cuanto-valgo
          text: "¿Cuánto valgo yo?"
          next: valgo
        - id: tasar-elfo
          text: "¿Y a un elfo cómo lo tasas?"
          if: [{ species: Elfo }, { species: Media elfa }]
          reply: { text: "Mal. La torre no os cuenta bien. Por eso la lonja no os presta: no sabe cómo cobraros." }
        - id: adios-pelayo
          text: "Me voy."
          end: true
          repeat: true
          reply: { text: "Ve con cuidado. Nivel… da igual. Ve con cuidado." }
    - id: confiesa
      mood: triste
      line: "…Sí. Nivel tres, botas de nivel uno. Dije que se le podía prestar. Dije que pagaría. No pagó. Y yo cobré mi parte."
      options:
        - id: ayudame-pelayo
          text: "Pues ayúdame a arreglarlo."
          effects: [{ milestone: el-tasador }, { attitude: 1 }]
          next: ayuda
        - id: amenazar-pelayo
          text: "Me vas a ayudar, quieras o no."
          check:
            skill: intimidation
            dc: 12
            success: { next: ayuda, effects: [{ milestone: el-tasador }] }
            failure: { next: miedo, effects: [{ attitude: -1 }] }
    - id: ayuda
      line: "Hay un libro: el de los descuentos. Dice a quién se le quitó cada nivel y a quién se le vendió. Está en el archivo de la Contaduría."
      journal: "Pelayo sabe dónde guarda la Contaduría el libro de los descuentos, y a qué hora cambia la guardia."
      options:
        - id: ayuda-fin
          text: "Cuéntame cómo entrar."
          end: true
          reply: { text: "Aquí no. Fuera, sin la capitana delante." }
    - id: miedo
      mood: enfadado
      line: "¡No me grites! Aquí todo el mundo mira. Vuelve cuando sepas hablar."
      options:
        - id: miedo-perdon
          text: "Perdona. Empecemos otra vez."
          next: inicio
          reply: { text: "Vale. Vale. Pero bajito." }
    - id: como
      line: "A ojo. Botas, espada, barra, dientes. Luego la torre dice si acerté. Casi siempre acierto. Ojalá no."
      journal: "En la lonja, el tasador pone precio a ojo a cada huésped antes de que le presten."
      options:
        - id: como-volver
          text: "Entiendo."
          next: inicio
          reply: { text: "No, no lo entiendes. Mejor así." }
    - id: valgo
      mood: triste
      line: "Sin deudas y con esas botas, la lonja te prestaría cuarenta monedas. Y te cobraría cuatro niveles. No firmes nada."
      options:
        - id: valgo-gracias
          text: "Gracias por avisar."
          next: inicio
          reply: { text: "No me las des. Es lo primero gratis que digo en diez años." }

## El Bosque Copiado

charla:
  id: florian-el-de-verdad
  speaker: florian
  title: ¿Cuál de los dos?
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: "¿Florián? Sí, Florián. Soy Florián, el leñador. ¿O preguntabas por el otro?"
      again: ["¿Otra vez tú? Otra vez tú. Pasa, pasa.", "Has vuelto. Has vuelto. ¿Eres tú o tu copia? Es broma. Es broma."]
      more: ["¿Algo más? ¿Algo más?", "Dime, dime."]
      options:
        - id: el-otro
          text: "¿Qué otro?"
          next: otro
        - id: de-donde-lobos
          text: "¿De dónde salen los lobos que parpadean?"
          next: loba
        - id: llevame-loba
          text: "Llévame hasta la loba vieja."
          if: { milestone: los-lobos-repetidos }
          effects: [{ board: La loba que se repite }]
          end: true
          repeat: true
          reply: { text: "¿Hasta la loba? Hasta la loba. Seguidme, y no piséis la vereda que os suene." }
        - id: huellas-al-reves
          text: "Las veredas copiadas se notan: las huellas van al revés."
          if: { class: Explorador }
          effects: [{ attitude: 1 }]
          reply: { mood: alegre, text: "¿Al revés? Al revés… ¡Es verdad! Treinta años aquí y nunca lo había visto." }
        - id: adios-florian
          text: "Me voy."
          end: true
          repeat: true
          reply: { text: "¿Te vas? Te vas. Por la vereda de la izquierda, que la de la derecha es copia." }
    - id: otro
      line: "Hay otro Florián. Corta leña mejor que yo. Recuerda lo mismo que yo. Uno de los dos salió del bosque hace un mes, y en el pueblo no saben cuál."
      journal: "En el Bosque Copiado hay dos Florianes iguales. Uno de los dos salió del bosque hace un mes."
      options:
        - id: y-tu-que
          text: "¿Y tú qué crees?"
          next: creo
        - id: otro-volver
          text: "Qué lío."
          next: inicio
          reply: { text: "¿Qué lío? Qué lío. Eso digo yo." }
    - id: creo
      mood: triste
      line: "¿Qué creo? Que da igual. Que si el pueblo prefiere al otro, yo me quedo sin casa. Sin casa."
      options:
        - id: creo-siento
          text: "Lo siento, Florián."
          next: inicio
          reply: { text: "¿Lo sientes? Lo sientes. Gracias. Eso no me lo dice el otro." }
    - id: loba
      line: "De la loba vieja, la de la barra rota. De ella salen todas las copias. Si cae ella, se acaban. Se acaban."
      journal: "Los lobos repetidos salen de una loba vieja con la barra rota: si cae ella, se acaban las copias."
      options:
        - id: loba-volver
          text: "Entendido."
          next: inicio
          reply: { text: "¿Entendido? Entendido. Pero no vayas {solo|sola} la primera vez." }

## Las ruinas de la Torre Tres

charla:
  id: sabina-coplas
  speaker: sabina
  title: Las coplas de la torrera
  start: inicio
  nodes:
    - id: inicio
      mood: alegre
      line: "«Piedra a piedra se sube, nombre a nombre se baja.» ¿Qué quieres saber?"
      again:
        - if: { milestone: los-cristales }
          text: "«Dos cristales rotos, dos cuentas saldadas.» ¡Volvéis! Pasad, pasad."
        - "«El que vuelve a la torre, algo se dejó.» ¿Qué se te olvidó?"
      more: ["«Pregunta, que la copla espera.»", "¿Más? Más, que el día es largo."]
      options:
        - id: quien-torres
          text: "¿Quién levantó las torres?"
          next: torres
        - id: como-rompiste
          text: "¿Cómo rompiste el corazón de esta torre?"
          if: { milestone: las-ruinas }
          next: rompi
        - id: donde-cuarta
          text: "¿Dónde está la cuarta torre?"
          effects: [{ rumor: r-torre-cuatro }]
          next: cuarta
        - id: copla-bardo
          text: "¿Me enseñas una de tus coplas?"
          if: { class: Bardo }
          effects: [{ attitude: 1 }]
          reply: { text: "«La barra que brilla no sabe tu nombre; lo sabe quien te lo canta.» Cántala tú, que tienes voz." }
        - id: adios-sabina
          text: "Me voy."
          end: true
          repeat: true
          reply: { text: "«Quien baja la cuesta, la vuelve a subir.» Hasta pronto." }
    - id: torres
      line: "Las Cuidadoras, hace trescientos años. Siete torres para ver de lejos quién estaba herido y llegar a tiempo. Luego vino un contador con una idea para pagarlas."
      journal: "Las siete torres las levantaron las Cuidadoras para ver de lejos quién estaba herido. La Contaduría les añadió los niveles."
      options:
        - id: torres-volver
          text: "¿Y la idea era buena?"
          next: inicio
          reply: { mood: enfadado, text: "«Idea que se paga sola, a alguien le cobra.» Era malísima." }
    - id: rompi
      mood: triste
      line: "Con un martillo de cantero y mucho miedo. Tres golpes al cristal grande. Al tercero, la torre gritó como un tejado en una tormenta, y trescientas personas lloraron a la vez."
      journal: "Sabina rompió el corazón de la Torre Tres hace cincuenta años: trescientos nombres volvieron a la memoria de la comarca."
      options:
        - id: rompi-volver
          text: "Fuiste muy valiente."
          next: inicio
          reply: { text: "«Valiente es quien tiembla y golpea.» Yo temblé mucho." }
    - id: cuarta
      line: "A un día de aquí, por el camino del norte. Un círculo de piedras y una escalera que baja. Abajo, la Primera Cuidadora dejó su cuaderno."
      journal: "La Torre Cuatro está a un día de las ruinas de la Torre Tres: abajo, la Primera Cuidadora dejó su cuaderno."
      options:
        - id: cuarta-gracias
          text: "Gracias, Sabina."
          next: inicio
          reply: { text: "«Gracias en la torre, piedra en el camino.» Ve con cuidado: las losas cuentan los pasos." }

## La Ermita

charla:
  id: olvido-infusion
  speaker: olvido
  title: La tila de la superiora
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: "Pasa, {hijo|hija}, siéntate. Soy la Madre Olvido, la superiora. ¿Manzanilla o tila? Para la cara que traes, tila."
      again: ["¿Otra vez por aquí, {hijo|hija}? Te pongo la tila de siempre.", "Siéntate, siéntate. Hoy la tila lleva un poco de miel."]
      more: ["¿Algo más, {hijo|hija}?", "Dime, que la tila se enfría."]
      options:
        - id: cuidadoras-torres
          text: "¿Qué tienen que ver las Cuidadoras con las torres?"
          next: torres
        - id: ver-biblioteca
          text: "¿Puedo mirar en vuestra biblioteca?"
          if: { milestone: { id: el-plano-de-la-primera, is: not-done } }
          check:
            skill: investigation
            dc: 12
            success: { next: biblioteca-bien, effects: [{ milestone: el-plano-de-la-primera }] }
            failure: { next: biblioteca-mal }
        - id: curais-sin-nivel
          text: "¿Aquí curáis sin mirar el nivel?"
          next: curar
        - id: ayudar-enfermos
          text: "¿Puedo ayudar con los enfermos?"
          if: { class: Clérigo }
          effects: [{ attitude: 1 }]
          reply: { mood: alegre, text: "Claro que sí. Las manos que curan nunca sobran. Empieza por Basilio, que no duerme." }
        - id: adios-olvido
          text: "Me voy, Madre."
          end: true
          repeat: true
          reply: { text: "Ve con cuidado, {hijo|hija}. Y abrígate, que la torre no cuenta los catarros." }
    - id: torres
      line: "Todo, {hijo|hija}. Las levantaron nuestras abuelas para ver de lejos quién sangraba. La Contaduría les puso los números, los precios y el olvido."
      journal: "Las torres eran de las Cuidadoras. La Contaduría les añadió los niveles, los precios y el olvido."
      options:
        - id: torres-olvido-volver
          text: "¿Y por qué no las recuperáis?"
          next: inicio
          reply: { mood: triste, text: "Porque somos viejas, {hijo|hija}, y ellos tienen celadores. Tómate la tila." }
    - id: biblioteca-bien
      mood: triste
      line: "Ah… Ese no. Bueno, sí. Ese plano te lo tengo que explicar."
      options:
        - id: biblioteca-te-escucho
          text: "Te escucho."
          end: true
    - id: biblioteca-mal
      line: "Ahí solo hay recetas de infusiones, {hijo|hija}. Muy buenas, eso sí. La de romero es mía."
      options:
        - id: biblioteca-mal-volver
          text: "Gracias igualmente."
          next: inicio
          reply: { text: "De nada. Llévate unas hojas de romero." }
    - id: curar
      line: "Aquí se cura sin preguntar. La barra miente a veces; la fiebre, nunca."
      journal: "En la Ermita se cura sin preguntar el nivel."
      options:
        - id: curar-volver
          text: "Así debería ser en todas partes."
          next: inicio
          reply: { mood: alegre, text: "Así era, {hijo|hija}. Así era." }

## Los Molinos

charla:
  id: severino-deuda
  speaker: severino
  title: La deuda del molino
  start: inicio
  nodes:
    - id: inicio
      mood: enfadado
      line: "¿Vienes a cobrar? Pues aquí no hay ni un saco de harina de sobra. Severino Muela, molinero."
      again: ["Tú otra vez. Ni medio saco tengo, te aviso.", "¿Ya estás aquí? Pasa, pero no toques la rueda."]
      more: ["¿Qué más? Que se para la rueda.", "Sigue. Medio saco de preguntas más."]
      options:
        - id: cuanto-debes
          text: "¿Cuánto le debes a la Contaduría?"
          next: deuda
        - id: por-que-rueda
          text: "¿Por qué no dejas que nadie se acerque a la rueda?"
          check:
            skill: insight
            dc: 13
            success: { next: hijo, effects: [{ attitude: 1 }] }
            failure: { next: rueda-no }
        - id: bendecir-molino
          text: "Puedo bendecir el molino."
          if: { class: Clérigo }
          effects: [{ attitude: 1 }]
          reply: { text: "¿Bendecir? Bendice la cuenta, mejor. Bueno, bendice. Mal no hará." }
        - id: adios-severino
          text: "Me voy."
          end: true
          repeat: true
          reply: { text: "Pues hala. Y si ves al cobrador, dile que se ha caído al caz." }
    - id: deuda
      line: "Ochenta monedas, que eran cuarenta. Cada siete días viene el cobrador y la sube, sin enseñar el papel. ¡Ochenta sacos de harina!"
      journal: "La deuda de Severino ha pasado de cuarenta a ochenta monedas: el cobrador la sube cada semana sin enseñar el papel."
      options:
        - id: deuda-volver
          text: "Eso no es legal."
          next: inicio
          reply: { text: "¿Legal? En Cifra lo legal se compra a plazos." }
    - id: hijo
      mood: triste
      line: "…Mi chico está ahí, en el hueco de la rueda. Si no pago, se lo llevan a la torre a descontarle. No se lo digas a nadie."
      journal: "Severino esconde a su hijo en el hueco de la rueda del molino, para que no se lo lleven a la torre."
      options:
        - id: hijo-callar
          text: "No diré nada."
          next: inicio
          effects: [{ attitude: 1 }]
          reply: { text: "Más te vale. Gracias. Un saco de gracias." }
    - id: rueda-no
      mood: enfadado
      line: "Porque está rota, y punto. Medio saco de preguntas por hoy."
      options:
        - id: rueda-no-volver
          text: "Vale, vale."
          next: inicio
          reply: { text: "Vale." }

## El Lago Espejo

charla:
  id: nuria-lago
  speaker: nuria
  title: Lo que enseña el lago
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: "Ni se te ocurra mirar el agua sin avisar. Nuria Calado, pescadora. Allí, de donde vengo, el agua solo enseñaba tu cara."
      again: ["¿Otra vez por el lago? Allí, de donde vengo, a esto lo llamaríamos obsesión.", "Hola. Hoy no pican. Ni los peces, ni los reflejos."]
      more: ["¿Algo más? Que pican.", "Venga, otra."]
      options:
        - id: que-ensena
          text: "¿Qué enseña el lago?"
          next: lago
        - id: alguien-importante
          text: "¿Has visto a alguien importante mirarse aquí?"
          if: { milestone: la-lonja }
          next: contador
        - id: echas-de-menos
          text: "¿Echas de menos tu mundo?"
          if: { species: Huésped }
          effects: [{ attitude: 1 }]
          reply: { mood: triste, text: "Cada día. Allí había helados y duchas calientes. Aquí, peces que te miran con tu cara." }
        - id: adios-nuria
          text: "Me voy."
          end: true
          repeat: true
          reply: { text: "Venga. Y no te mires al pasar, que luego no duermes." }
    - id: lago
      line: "Tu barra de verdad. Sin lo comprado y sin lo pintado. Hay quien llora. Allí, de donde vengo, eso lo hacía la báscula del baño."
      journal: "El Lago Espejo enseña la barra de verdad, sin los niveles comprados ni pintados."
      options:
        - id: lago-volver
          text: "Qué miedo."
          next: inicio
          reply: { text: "Miedo da la lonja. Esto solo dice la verdad." }
    - id: contador
      mood: alegre
      line: "Una noche vino el Contador Mayor. Se miró, puso cara de fantasma y se fue sin la capa. Su reflejo decía nivel dos."
      journal: "Nuria vio en el lago el reflejo del Contador Mayor: debajo de sus doce niveles comprados, es un nivel dos."
      options:
        - id: contador-volver
          text: "¿Y la capa?"
          next: inicio
          reply: { mood: alegre, text: "La uso de manta. Es la mejor tela que he tenido nunca." }
