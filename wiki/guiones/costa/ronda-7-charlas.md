# La costa que no duerme — ronda 7: las charlas

Nueve charlas con ramas, para la gente que importa. Cada una empieza con quien habla diciendo quién es,
porque se puede llegar a ella antes de que nadie le presente. Lo que depende de quién eres lleva su
condición (`class`, `background`, `species`), y lo que se cuenta deja algo: una pista, un rumor, cómo
os mira.

```yaml
charla:
  id: maite-la-lista
  speaker: maite
  title: La lista de la Vela
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: 'Soy Maite, la del Remo Seco. Siéntate, criatura, que de pie se piensa peor. ¿Cena, cama o preguntas? Las preguntas son lo más caro.'
      again:
        - 'Tú otra vez. Siéntate, que el caldo aún está caliente.'
        - '¿Vienes a cenar o a mirar la lista? Las dos cosas no, que me pones nerviosa.'
      more: ['¿Algo más, criatura?', 'Dime, que la olla no se vigila sola.']
      options:
        - id: lista
          text: '¿Qué es esa lista de nombres de la pared?'
          next: la-vela
        - id: noche-mateo
          text: '¿A quién le tocaba velar la noche que murió Mateo Iturbe?'
          if: { milestone: { id: la-tumba-de-mateo, is: done } }
          next: noche
        - id: marinero
          text: 'He pasado muchas noches de guardia en un barco. Puedo velar una.'
          if: { background: marinero }
          tag: Marinero
          effects: [{ attitude: 1 }]
          next: guardia
        - id: cama
          text: 'Una cama para esta noche.'
          reply: { text: 'La del fondo, la que da al mar. Si oyes algo, no te asomes.', mood: triste }
        - id: adios
          text: 'Nada más, Maite.'
          end: true
          repeat: true
    - id: la-vela
      mood: triste
      line: 'Es la Vela. Un nombre cada noche, desde hace treinta años. El que le toca se sienta en el embarcadero viejo y habla hasta que amanece.'
      journal: 'Maite lleva la lista de la Vela: cada noche, alguien se sienta en el embarcadero viejo y habla hasta que amanece.'
      effects: [{ rumor: r-la-lista-de-la-vela }]
      options:
        - id: para-que
          text: '¿Y para qué se habla toda la noche?'
          reply: { text: 'Para que no suban. Eso dicen los viejos. Yo no lo he visto nunca, y no quiero verlo.', mood: triste }
          next: inicio
        - id: volver
          text: 'Entiendo.'
          next: inicio
    - id: noche
      mood: triste
      line: '…A mí. Me tocaba a mí. Me quedé dormida en la silla, criatura. Me desperté con el sol y nadie había subido. Pensé que había tenido suerte.'
      journal: 'La noche que murió Mateo le tocaba velar a Maite, y se quedó dormida. Cree que todo es culpa suya.'
      options:
        - id: no-culpa
          text: 'No es culpa tuya, Maite. Lo de Mateo pasó en tierra.'
          effects: [{ attitude: 1 }]
          reply: { text: 'Ojalá. Ojalá tengas razón. Toma, un caldo. No me lo pagues.', mood: triste }
          next: inicio
        - id: callar
          text: 'No digo nada.'
          next: inicio
    - id: guardia
      mood: alegre
      line: 'Mira tú. Pues aquí la guardia es de muertos, no de piratas. Si de verdad quieres, apunto tu nombre al lado del de Ciriaco. Se va a echar a llorar.'
      journal: 'Maite apunta tu nombre en la lista de la Vela.'
      options:
        - id: apunta
          text: 'Apúntalo.'
          reply: { text: 'Hecho. El primer forastero de la lista en treinta años.', mood: alegre }
          next: inicio

charla:
  id: jacinto-la-cofradia
  speaker: jacinto
  title: La Cofradía
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: 'Jacinto Larrañaga, patrón mayor de la Cofradía. Nosotros no hablamos de las cosas de casa con gente de fuera. Pero pregunta, ya que estás.'
      again:
        - 'Otra vez tú. Nosotros seguimos pescando, si es lo que quieres saber.'
        - 'Si vienes a preguntar por el agua, la respuesta es la misma que ayer.'
      more: ['¿Algo más?', 'Pregunta, pero rápido. La marea no espera.']
      options:
        - id: suerte
          text: '¿Por qué en Mareaviva no se ahoga nadie?'
          next: suerte
        - id: costumbre
          text: '¿Por qué echáis a vuestros muertos al mar?'
          next: costumbre
        - id: barca
          text: 'Sé que hace treinta años remaste una barca hasta el Bajo.'
          if: { milestone: { id: el-diario-del-cura, is: done } }
          next: barca
        - id: clerigo
          text: 'Soy de Iglesia. Esos muertos merecen tierra y una oración.'
          if: { class: Clérigo }
          next: oracion
        - id: adios
          text: 'Eso es todo.'
          end: true
          repeat: true
    - id: suerte
      mood: neutral
      line: 'Nosotros tenemos suerte. El mar es generoso con quien lo respeta. Arenales no lo respeta, y así le va.'
      options:
        - id: arenales
          text: 'En Arenales dicen que esa suerte la pagan ellos.'
          reply: { text: 'En Arenales dicen muchas cosas. Pescan poco y hablan mucho.', mood: enfadado }
          next: inicio
        - id: vale
          text: 'Ya.'
          next: inicio
    - id: costumbre
      mood: enfadado
      line: 'Porque es la costumbre. Los de Mareaviva van al agua. Siempre ha sido así, y así tiene que seguir.'
      options:
        - id: siempre
          text: '¿Siempre? En el cementerio hay cruces de antes de la galerna.'
          check:
            skill: insight
            dc: 13
            success:
              next: grieta
            failure:
              next: cierra
        - id: vale2
          text: 'Entendido.'
          next: inicio
    - id: cierra
      mood: enfadado
      line: 'Antes era antes. Ahora es ahora. Nosotros no hablamos de eso.'
      options:
        - id: vale3
          text: 'Como quiera.'
          next: inicio
    - id: grieta
      mood: triste
      line: 'Desde la galerna, ¿vale? Desde la galerna. Nos fue muy mal, y luego nos fue bien. No preguntes cómo. Yo tampoco lo pregunté nunca.'
      journal: 'Jacinto admite que la costumbre de echar los muertos al mar empezó después de la galerna.'
      effects: [{ clue: 'La costumbre de dar los muertos al agua empezó después de la galerna, no antes. Jacinto lo sabe y no quiere hablar de ello.' }]
      options:
        - id: gracias
          text: 'Gracias, Jacinto.'
          next: inicio
    - id: barca
      mood: triste
      line: 'Mateo y yo. Remamos. Esperamos en la barca con la niebla hasta las rodillas. Salieron cuatro y una niña dormida. Nunca más hemos hablado de eso. Ni entre nosotros.'
      journal: 'Jacinto y Mateo Iturbe remaron la barca que llevó a los que firmaron al Bajo.'
      effects: [{ attitude: 1 }]
      options:
        - id: quienes
          text: '¿Quién salió con la niña en brazos?'
          reply: { text: 'Don Fermín la llevaba. Rosalía iba delante, sin mirar atrás. Ya está. Ya lo he dicho.', mood: triste }
          next: inicio
    - id: oracion
      mood: triste
      line: 'Aquí ya no se reza en la iglesia. Pero si quieres rezar por ellos, hazlo en el embarcadero viejo. Allí se te oye mejor.'
      options:
        - id: lo-hare
          text: 'Lo haré.'
          effects: [{ attitude: 1 }]
          next: inicio

charla:
  id: rosalia-el-cafe
  speaker: rosalia
  title: Café en la Salazón
  start: inicio
  when: [{ milestone: { id: la-senora-arrieta, is: open } }, { milestone: { id: la-senora-arrieta, is: done } }]
  nodes:
    - id: inicio
      mood: alegre
      line: 'Pasa, pasa. Soy Rosalía Arrieta, la dueña de todo esto. Siéntate, {hijo|hija}, que el café se enfría. Aquí nadie tiene prisa.'
      again: ['Otra taza, {hijo|hija}? La Salazón siempre tiene café para quien me ayuda.']
      more: ['¿Algo más, {hijo|hija}?']
      options:
        - id: que-quiere
          text: '¿Para qué me ha hecho llamar?'
          next: oferta
        - id: guante
          text: '¿Por qué lleva siempre la mano derecha enguantada?'
          check:
            skill: insight
            dc: 14
            success:
              next: guante
            failure:
              next: frio
        - id: uxue
          text: '¿Por qué pregunta tanto por la edad de Uxue Lasarte?'
          if: { milestone: { id: la-marea-que-no-baja, is: done } }
          reply: { text: '¿Yo? Me gustan los niños. Los niños de Mareaviva son los más sanos de la costa. Gracias a todos nosotros.', mood: neutral }
          effects: [{ rumor: r-uxue-firma }]
          next: inicio
        - id: adios
          text: 'Gracias por el café.'
          end: true
          repeat: true
    - id: oferta
      mood: neutral
      line: 'Quiero que esto se acabe. Lucio enterró a su padre donde no debía. Si consigues que la caja de Mateo vuelva al agua, te pago cincuenta monedas. Y todo vuelve a ser como siempre.'
      journal: 'Rosalía Arrieta te ofrece cincuenta monedas por devolver la caja de Mateo Iturbe al agua.'
      options:
        - id: acepto
          text: 'Lo pensaré.'
          reply: { text: 'Piénsalo con calma. Pero no mucha: la bajamar grande llega pronto.', mood: alegre }
          next: inicio
        - id: por-que-agua
          text: '¿Y qué pasa si no vuelve al agua?'
          reply: { text: 'Que el mar se cobra lo suyo. Siempre. Ya lo has visto en la playa.', mood: triste }
          next: inicio
        - id: no
          text: 'No pienso sacar a un muerto de su tumba.'
          effects: [{ attitude: -1 }]
          reply: { text: 'Qué lástima. Eres {el primero|la primera} que me dice que no en esta casa.', mood: enfadado }
          next: inicio
    - id: guante
      mood: triste
      line: 'Eres más {listo|lista} de lo que pareces. Debajo hay una mancha negra, como de tinta. No se quita. Treinta años frotando, y no se quita.'
      journal: 'Rosalía Arrieta tiene una mancha negra, como de tinta, en la palma de la mano derecha.'
      effects: [{ clue: 'Rosalía Arrieta tiene la palma de la mano derecha manchada de negro, como de tinta, desde hace treinta años.' }]
      options:
        - id: tinta
          text: '¿Tinta de qué?'
          reply: { text: 'Más café, {hijo|hija}. Ya está bien de preguntas.', mood: enfadado }
          next: inicio
    - id: frio
      mood: neutral
      line: 'Frío, {hijo|hija}. A mi edad, todo es frío. ¿Más café?'
      options:
        - id: mas-cafe
          text: 'Un poco más, gracias.'
          next: inicio

charla:
  id: engracia-los-nombres
  speaker: engracia
  title: Los treinta y siete
  start: inicio
  nodes:
    - id: inicio
      mood: triste
      line: 'Engracia Sarasola, rezadora mayor. Mi Tomás salió con la galerna. Lo nombro cada noche, para que no se le olvide a nadie. ¿A qué vienes a la ermita?'
      again: ['Vuelves. Siéntate en el banco, que te nombro a los míos mientras tanto.']
      more: ['¿Algo más?', 'Dime, que el agua no espera.']
      options:
        - id: galerna
          text: 'Cuénteme lo de la galerna.'
          next: galerna
        - id: tres
          text: '¿Quién bajó al Bajo la primavera siguiente?'
          check:
            skill: persuasion
            dc: 15
            success:
              next: tres
            failure:
              next: no-cuento
        - id: velar
          text: 'He velado en el embarcadero. Les he hablado.'
          if: { milestone: { id: la-vela, is: done } }
          next: rosario
        - id: adios
          text: 'Que descansen.'
          end: true
          repeat: true
    - id: galerna
      mood: triste
      line: 'Veintidós barcas salieron. Volvieron siete. Treinta y siete hombres, y ninguno en tierra. Al año siguiente, el mar dejó de llevarse a nadie. Como si tuviera bastante.'
      journal: 'En la galerna salieron veintidós barcas y volvieron siete: treinta y siete muertos.'
      effects: [{ rumor: r-la-galerna }]
      options:
        - id: vale
          text: 'Lo siento mucho.'
          reply: { text: 'Treinta años. Ya no se siente: se lleva.', mood: triste }
          next: inicio
    - id: tres
      mood: triste
      line: 'Tres. Rosalía, que habló. Don Fermín, que bendijo. Y la niña del farero, que conocía el camino. Remaron Jacinto y Mateo. Yo los vi salir desde aquí arriba.'
      journal: 'Engracia vio bajar al Bajo a Rosalía, a Don Fermín y a la niña del farero, con Jacinto y Mateo a los remos.'
      effects: [{ clue: 'Engracia vio bajar al Bajo a Rosalía Arrieta, a Don Fermín y a la hija pequeña del farero. Remaron Jacinto y Mateo.' }, { attitude: 1 }]
      options:
        - id: gracias
          text: 'Gracias, Engracia.'
          next: inicio
    - id: no-cuento
      mood: triste
      line: 'Eso no lo cuento. Rosalía tiene oídos en todas las paredes. Hasta en estas.'
      options:
        - id: entiendo
          text: 'Lo entiendo.'
          next: inicio
    - id: rosario
      mood: alegre
      line: 'Les has hablado. A los míos. Toma: el rosario de conchas. Lo tallaron las viudas. Es para quien vela por ellos.'
      journal: 'Engracia te da su rosario de conchas por velar por los muertos.'
      effects: [{ give: Rosario de conchas }, { attitude: 1 }]
      options:
        - id: gracias2
          text: 'Lo llevaré.'
          next: inicio

charla:
  id: lazaro-las-cajas
  speaker: lazaro
  title: Sesenta y una cajas
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: 'Lázaro, el enterrador. Je. Enterrador de piedras, mejor dicho. Treinta años cavando para enterrar piedras. ¿Qué se te ofrece?'
      again: ['¿Otra vez por aquí? Los muertos no se mueven. Bueno. Casi nunca.']
      more: ['¿Algo más? Que la pala me espera.']
      options:
        - id: piedras
          text: '¿Por qué piedras?'
          next: piedras
        - id: mateo
          text: '¿Ayudaste tú a Lucio a enterrar a su padre?'
          check:
            skill: insight
            dc: 12
            success:
              next: mateo
            failure:
              next: duermo
        - id: adios
          text: 'Hasta otra, Lázaro.'
          end: true
          repeat: true
    - id: piedras
      mood: triste
      line: 'Porque a los muertos de verdad se los lleva el mar. Aquí se baja una caja con piedras, para que la familia tenga dónde llorar. Sesenta y una he bajado.'
      journal: 'En el cementerio viejo hay sesenta y una cajas llenas de piedras.'
      effects: [{ rumor: r-cajas-de-piedras }]
      options:
        - id: vale
          text: 'Qué triste.'
          reply: { text: 'Triste es enterrar piedras. Un muerto de verdad, al menos, se lo merece.', mood: triste }
          next: inicio
    - id: mateo
      mood: alegre
      line: 'Pues sí. Por cinco monedas. Y lo haría gratis otra vez. Hacía treinta años que no enterraba a nadie de verdad. Mateo pesaba como un hombre, no como un saco de piedras.'
      journal: 'Lázaro ayudó a Lucio a enterrar a Mateo Iturbe en tierra, y lo haría otra vez.'
      effects: [{ attitude: 1 }]
      options:
        - id: no-digo
          text: 'No se lo diré a nadie.'
          reply: { text: 'Me da igual que lo digas. Ya soy viejo para tener miedo de Jacinto.', mood: alegre }
          next: inicio
    - id: duermo
      mood: alegre
      line: 'Yo duermo de noche, como los vivos. Je. Los que no duermen están en el agua.'
      options:
        - id: ya
          text: 'Ya.'
          next: inicio

charla:
  id: martina-nueve-cruces
  speaker: martina
  title: Nueve cruces
  start: inicio
  nodes:
    - id: inicio
      mood: enfadado
      line: 'Martina Olazabal, patrona de Arenales. Si vienes de Mareaviva, ya puedes darte la vuelta. Si no, habla.'
      again:
        - if: { attitude: 1 }
          text: 'Tú. Siéntate, que hoy hay sardinas y no muerden.'
        - '¿Otra vez de Mareaviva? Habla rápido.'
      more: ['¿Algo más?', 'Sigue.']
      options:
        - id: muertos
          text: '¿Cuántos ha perdido Arenales en el mar?'
          next: nueve
        - id: trato
          text: 'Creo que Mareaviva tiene un trato con lo que vive en el agua.'
          if: { milestone: { id: el-diario-del-cura, is: done } }
          next: trato
        - id: forastero
          text: 'No soy de ningún pueblo de esta costa.'
          if: { background: forastero }
          tag: Forastero
          effects: [{ attitude: 1 }]
          reply: { text: 'Mejor para ti. Aquí ser de un sitio pesa como una piedra al cuello.', mood: neutral }
          next: inicio
        - id: adios
          text: 'Me voy.'
          end: true
          repeat: true
    - id: nueve
      mood: triste
      line: 'Nueve. Uno por uno: Andoni, Patxi, Kepa, los dos Uribe, Iker, que tenía quince años, Joxe, Mikel y mi primo Gaizka. Y al otro lado del cabo, ni uno.'
      journal: 'Arenales ha perdido nueve pescadores en treinta años. Mareaviva, ninguno.'
      effects: [{ rumor: r-arenales-ahogados }]
      options:
        - id: lo-siento
          text: 'Lo siento.'
          next: inicio
    - id: trato
      mood: enfadado
      line: 'Lo sabía. Mi abuela lo decía: en el Bajo se puede firmar. Y si ellos firmaron, que paguen ellos. O que firmemos nosotros también.'
      journal: 'Martina Olazabal sabe que en el Bajo se puede firmar un trato, y ha pensado en ir.'
      effects: [{ attitude: 1 }]
      options:
        - id: no-firmes
          text: 'No firmes nada, Martina. Ese trato se paga con los muertos.'
          check:
            skill: persuasion
            dc: 14
            success:
              effects: [{ attitude: 1 }]
              next: para-todos
            failure:
              next: que-mas-da
    - id: para-todos
      mood: triste
      line: '…Con los muertos. Entonces que se acabe para todos, no que lo tengamos también nosotros.'
      journal: 'Martina no irá a firmar al Bajo: prefiere que el trato se acabe para todos.'
      options:
        - id: bien
          text: 'Es lo justo.'
          next: inicio
    - id: que-mas-da
      mood: enfadado
      line: 'Mis muertos ya los paga el mar. Qué más da cómo.'
      options:
        - id: bien2
          text: 'Piénsalo, Martina.'
          next: inicio

charla:
  id: bartolo-mareas
  speaker: bartolo
  title: Mareas y percebes
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: 'Bartolo, mariscador. Marea baja, marea alta. Lo demás son cuentos. ¿Quieres percebes? Son los mejores de la costa.'
      again: ['¿Más percebes? Hoy están gordos.']
      more: ['¿Algo más? Que sube el agua.']
      options:
        - id: bajamar
          text: '¿Cuándo es la bajamar grande?'
          next: bajamar
        - id: cinco
          text: 'Usted vio entrar a alguien en el Bajo hace treinta años.'
          check:
            skill: insight
            dc: 13
            success:
              next: cinco
            failure:
              next: percebe
        - id: comprar
          text: 'Deme una cesta de percebes.'
          if: { gold: 3 }
          effects: [{ gold: -3 }, { give: Cesta de percebes }]
          reply: { text: 'Tres monedas. Cocidos con agua de mar, ni sal ni nada.', mood: alegre }
        - id: adios
          text: 'Buena pesca, Bartolo.'
          end: true
          repeat: true
    - id: bajamar
      mood: neutral
      line: 'Esta. La de ahora. Baja más que ninguna en treinta años. Se entra en el Bajo hasta el fondo, lo que dura una comida. Luego, ni una gota de suerte.'
      journal: 'Bartolo dice que esta bajamar grande deja entrar en el Bajo hasta el fondo, lo que dura una comida.'
      effects: [{ rumor: r-bajamar-grande }, { give: Tabla de mareas de Bartolo }]
      options:
        - id: vale
          text: 'Gracias.'
          next: inicio
    - id: cinco
      mood: triste
      line: '…Cinco. Entraron cinco con la bajamar grande. Salieron cuatro y una niña dormida en brazos. Mira este percebe. Mira qué gordo.'
      journal: 'Bartolo vio entrar a cinco personas en el Bajo hace treinta años, y salir a cuatro y una niña dormida.'
      effects: [{ rumor: r-tres-al-bajo }]
      options:
        - id: vale2
          text: 'Es un buen percebe, Bartolo.'
          next: inicio
    - id: percebe
      mood: alegre
      line: 'Yo veo percebes. Mira este: gordo como un pulgar. De lo demás no sé nada.'
      options:
        - id: vale3
          text: 'Gordo, sí.'
          next: inicio

charla:
  id: ramiro-preguntas
  speaker: ramiro
  title: Las preguntas del maestro
  start: inicio
  nodes:
    - id: inicio
      mood: neutral
      line: 'Ramiro Agirre, para servirle. Antiguo maestro de Mareaviva, hoy maestro de nada. Siéntese, que le explico. Hip. Perdón.'
      again: ['Ah, mi alumno favorito. Siéntese. La lección de hoy es la misma de ayer.']
      more: ['¿Alguna pregunta más? Las preguntas son buenas. Casi siempre.']
      options:
        - id: ninos
          text: '¿Qué averiguó en Mareaviva?'
          next: ninos
        - id: paliza
          text: '¿Por qué se fue del pueblo?'
          reply: { text: 'Hice preguntas. Las preguntas tienen precio. Lo pagué con dos costillas y me dieron una bolsa por las molestias.', mood: triste }
          effects: [{ rumor: r-ramiro-paliza }]
          next: inicio
        - id: erudito
          text: 'Yo también he estudiado registros. ¿Me deja ver sus notas?'
          if: [{ class: Erudito }, { background: erudito }]
          tag: Erudito
          next: notas
        - id: adios
          text: 'Gracias, maestro.'
          end: true
          repeat: true
    - id: ninos
      mood: triste
      line: 'Los registros de nacimientos. Desde la galerna, ningún niño de Mareaviva ha muerto. De nada. Ni de fiebre, ni de tos, ni de caerse de un tejado. Ninguno. En ningún pueblo del mundo pasa eso.'
      journal: 'Desde la galerna, ningún niño de Mareaviva ha muerto de nada, según los registros de Ramiro.'
      effects: [{ clue: 'Según los registros del antiguo maestro, desde la galerna no ha muerto ningún niño de Mareaviva, de nada.' }]
      options:
        - id: sigue
          text: 'Siga.'
          next: inicio
    - id: notas
      mood: alegre
      line: '¡Un colega! Tome. Mis notas. Están manchadas de vino, pero se leen. Termine lo que yo no me atreví a terminar.'
      journal: 'Ramiro te da sus notas sobre Mareaviva.'
      effects: [{ attitude: 1 }, { clue: 'Las notas de Ramiro: los nacidos en Mareaviva después de la galerna nadan como peces y nunca se ahogan. Los de antes, sí se podían ahogar.' }]
      options:
        - id: gracias
          text: 'Lo terminaré.'
          next: inicio

charla:
  id: eusebio-argollas
  speaker: eusebio
  title: Las argollas
  start: inicio
  nodes:
    - id: inicio
      mood: alegre
      line: '¡Eusebio, herrero! ¡Pum! Perdona. Es que pienso mejor golpeando. ¿Qué necesitas? ¡Que no sea un anzuelo, por favor!'
      again: ['¡Hombre! ¡Pum! ¿Otra vez por aquí?']
      more: ['¿Qué más? ¡Habla alto, que estoy medio sordo!']
      options:
        - id: encargos
          text: '¿Qué te han encargado últimamente?'
          next: argollas
        - id: arpon
          text: '¿Para quién has afilado un arpón de ballenero?'
          if: { milestone: { id: la-tumba-de-mateo, is: done } }
          check:
            skill: intimidation
            dc: 12
            success:
              effects: [{ clue: 'Eusebio le ha afilado a Lucio Iturbe un arpón de ballenero, y sabe que no es para pescar.' }]
              next: para-lucio
            failure:
              next: no-pregunto
        - id: soldado
          text: 'Necesito que me arregles el arma. He visto lo que sube del agua.'
          if: { class: Soldado }
          tag: Soldado
          reply: { text: '¡Eso es un encargo! ¡Pum! Contra lo que sube, mejor un bichero que una espada: lo apartas sin acercarte.', mood: alegre }
          next: inicio
        - id: adios
          text: 'Adiós, Eusebio.'
          end: true
          repeat: true
    - id: argollas
      mood: neutral
      line: 'Argollas. ¡Pum! De hierro, para clavar en roca. Iguales que unas que hice hace treinta años para el Bajo. Me las pagó el capataz de la Salazón. Por adelantado.'
      journal: 'Eusebio ha forjado argollas para clavar en el Bajo, como hace treinta años. Las pagó el capataz de la Salazón.'
      effects: [{ rumor: r-argollas-nuevas }]
      options:
        - id: vale
          text: 'Interesante.'
          next: inicio
    - id: para-lucio
      mood: triste
      line: 'Para Lucio. ¡Pum! Y no es para pescar. Ya lo sé. Ya lo sé.'
      journal: 'Eusebio le ha afilado a Lucio un arpón de ballenero.'
      options:
        - id: vale4
          text: 'Gracias por decírmelo.'
          next: inicio
    - id: no-pregunto
      mood: enfadado
      line: '¡Yo afilo, no pregunto! ¡Pum!'
      options:
        - id: vale5
          text: 'Vale, vale.'
          next: inicio

charla:
  id: ciriaco-la-silla
  speaker: ciriaco
  title: La silla de enea
  start: inicio
  nodes:
    - id: inicio
      mood: triste
      line: 'Ciriaco. Treinta años. Diez mil noches. Y esta, otra. ¿Vienes a mirar el agua, o a preguntar lo que nadie pregunta?'
      again:
        - 'Otra vez tú. Siéntate en el poste, que la silla es del que vela.'
        - 'Hoy el agua está quieta. Mala señal. O buena. Ya no sé.'
      more: ['¿Algo más?', 'Pregunta. El mar no tiene prisa.']
      options:
        - id: quienes
          text: '¿Qué sube por los postes?'
          next: suben
        - id: silla
          text: '¿Por qué velas tú casi todas las noches?'
          next: remedios
        - id: marcado
          text: 'Yo también los oigo. Desde niño los oigo llamar.'
          if: { species: Marcado }
          tag: Marcado
          effects: [{ attitude: 1 }]
          next: marcado
        - id: adios
          text: 'Te dejo con el agua.'
          end: true
          repeat: true
    - id: suben
      mood: triste
      line: 'Vecinos. Los nuestros. Los que se dieron al agua. Suben despacio, chorreando, y si les hablas se quedan quietos a escuchar. Si te callas, siguen subiendo.'
      journal: 'Ciriaco dice que los que suben por los postes son los muertos del pueblo, y que si les hablas se paran.'
      effects: [{ rumor: r-remedios }]
      options:
        - id: vale
          text: 'Entiendo.'
          next: inicio
    - id: remedios
      mood: triste
      line: 'Porque mi Remedios sube la tercera, con su pañuelo azul. Murió hace tres años y se la di al agua, como manda la Cofradía. Vengo a hablar con ella. Del tiempo, sobre todo. Le gustaba saber si iba a llover.'
      journal: 'Ciriaco vela casi todas las noches para hablar con su mujer, Remedios, que sube por los postes.'
      options:
        - id: lo-siento
          text: 'Lo siento, Ciriaco.'
          effects: [{ attitude: 1 }]
          reply: { text: 'No lo sientas. Mañana va a llover. Se lo diré esta noche.', mood: triste }
          next: inicio
    - id: marcado
      mood: triste
      line: 'Lo sé. Lo llevas en el brazo. A los marcados os llaman más fuerte. No les contestes nunca con la boca cerrada: háblales en voz alta, que os oigan.'
      options:
        - id: gracias
          text: 'Gracias por el consejo.'
          next: inicio
```
