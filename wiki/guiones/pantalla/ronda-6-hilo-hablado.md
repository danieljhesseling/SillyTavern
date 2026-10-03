---
title: El mundo tras la pantalla — ronda 6, el hilo hablado
tags: [pantalla, guion, hilo, escenas, conversaciones]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 6: el hilo, hablado

> Las escenas de los dieciocho hitos, como conversación (D-J54, D-J60): cada línea la dice alguien que está allí, con su cara. No hay narrador. Cada uno se presenta antes de que nadie le nombre (J13.7): dice su nombre, o lo dice otro en voz alta (`presenta`).
>
> **Cuándo sale cada escena.** La de un hito sale al abrirse, donde esté el grupo; la de uno que pide llegar a un sitio, al llegar. Por eso habla quien está allí en ese momento: en Brasa, la posadera y la cantora; en Cifra, la escribana, la pintora y la capitana; en la torre, quien sube con vosotros. Los compañeros solo hablan en el hilo en su casa (Candela en la posada, Arel en la Hondonada, Nieves en Cifra), donde están aunque no vayan en el grupo.
>
> **Cómo se llega a cada pelea del hilo** (D-J62): la conversación dice adónde se va y por qué («Entramos a medianoche», «Subimos por la izquierda»). Cuando el tablero está lejos, la respuesta lleva al sitio (`{go: …}`) y la pelea empieza sola al llegar; cuando está aquí, lo ofrece «Lo que pide la historia». Las escenas del hilo no llevan `{board: …}`: un tablero al que lleva una conversación deja de salir en «Lo que pide la historia», y si se sale de él sin pelear (un suceso, la noche) no queda botón para volver (los dos atascos de las vueltas 1 y 2). A la pelea de la loba sí se entra hablando, con Florián, que lo puede repetir.
>
> **Comprobación:** ninguna línea sin `who`; cada persona se presenta en su primera línea o la presentan; las dos decisiones grandes (el libro, la oferta) son irreversibles y la escena de después se acuerda de ellas (`alt` con `chose`). ✔

## El mundo: niveles, viaje y capítulos

mundo:
  paquete:
    world:
      levels: [1, 4]
      journey:
        days: 2
        how: "Cruzáis el Bosque Copiado, donde los árboles se repiten, y salís a Brasa con una barra encima de la cabeza."
    plot:
      chapters:
        - act: 1
          title: El despertar
          summary: "Te despiertas en Brasa con una barra encima de la cabeza. Un huésped de la posada lleva tres días sin volver, y ya casi nadie recuerda su cara."
        - act: 2
          title: La lonja de niveles
          summary: "En Cifra se compran niveles a plazos. Alguien los paga, y hay un libro que dice quién."
        - act: 3
          title: Las torres caídas
          summary: "Las torres no las levantó la Contaduría. En las ruinas de la Torre Tres hay alguien que sabe cómo se cae una."
        - act: 4
          title: La Torre Siete
          summary: "La última torre en pie. Subes a pararla, o defiendes su puerta."

## Acto 1: El despertar

hito:
  id: despertar
  paquete:
    backdrop: posada
    beats:
      - who: Candela Rima
        mood: alegre
        text: "¡Mira, ya abre los ojos! {Bienvenido|Bienvenida} a Brasa. Soy Candela, canto aquí por las noches."
      - who: Candela Rima
        text: "¿Ves eso que tienes encima de la cabeza? Es tu barra: tu vida, tu nivel y, cuando lo digas, tu nombre. Aquí la tenemos todos."
      - who: Remedios Lumbre
        text: "Deja respirar a la criatura, Candela. Soy Remedios, llevo la Posada del Despertar. Aquí despiertan todos los que salen del bosque."
      - who: Remedios Lumbre
        mood: triste
        text: "Y ahora lo que importa. Uno de mis huéspedes, Iker, lleva tres días sin volver a su litera."
        presenta: iker
      - who: Remedios Lumbre
        mood: triste
        text: "Lo tengo apuntado en mi libro, con mi letra. Pero ya no me acuerdo de su cara. Una, dos, tres noches… y se me borra."
        options:
          - id: buscar-iker
            text: "Yo lo busco. ¿Por dónde iba?"
            effects: [{ attitude: 1 }]
            reply: { who: Remedios Lumbre, mood: alegre, text: "Eso, criatura. Iba al Bosque Copiado cada mañana, a por setas para mi cocina." }
          - id: como-se-borra
            text: "¿Cómo se le borra a alguien una cara de la cabeza?"
            effects: [{ clue: "Si a alguien le quitan todos los niveles, se apaga: su barra se vuelve gris y, en tres días, nadie se acuerda de quién era." }]
            reply:
              - { who: Candela Rima, mood: triste, text: "Le quitan los niveles. Todos. Y se apaga: la barra se le vuelve gris y, a los tres días, nadie sabe quién era." }
              - { who: Candela Rima, mood: triste, text: "Eso no lo dice nadie en voz alta. Yo lo canto." }
          - id: huesped-tambien
            text: "Yo también acabo de llegar. Si me pasa a mí, ¿quién se acuerda?"
            if: { species: Huésped }
            effects: [{ attitude: 1 }]
            reply: { who: Remedios Lumbre, mood: alegre, text: "Yo, criatura. Te apunto ahora mismo, con letra grande." }
      - who: Remedios Lumbre
        text: "Escribe tu nombre en mi libro antes de irte. Lo escrito a mano es lo único que la torre no borra."

hito:
  id: los-lobos-repetidos
  paquete:
    backdrop: posada
    beats:
      - who: Yolanda Ferrán
        mood: enfadado
        text: "¡Remedios! ¿Es verdad que alguien va a buscar a Iker? Soy Yolanda Ferrán, Yoli. Duermo en la litera de encima de la suya."
      - who: Yolanda Ferrán
        mood: triste
        text: "Iba al bosque cada mañana, por la vereda de los lobos. Volvía con setas y cantando. Hace tres días no volvió."
      - who: Remedios Lumbre
        text: "Esos lobos no son normales, criatura. Parpadean. Donde ves uno, a veces hay dos."
      - who: Yolanda Ferrán
        text: "En el claro hay un barranco. Empújalos: las copias no saben trepar."
        options:
          - id: lobos-ya
            text: "Vamos ahora mismo, antes de que se borre del todo."
            effects: [{ go: El Bosque Copiado }]
            reply: { who: Yolanda Ferrán, mood: alegre, text: "Eso quería oír. Coge lo que te haga falta y vamos." }
          - id: lobos-luego
            text: "Primero me preparo. Nos vemos en el bosque."
            reply: { who: Yolanda Ferrán, mood: triste, text: "Vale. Pero no tardes: cada día me acuerdo menos de su cara." }

hito:
  id: la-hondonada-gris
  paquete:
    backdrop: La Hondonada Gris
    beats:
      - who: Arel Pinoviejo
        text: "Despacio. Aquí la gente se asusta con los pasos rápidos. Soy Arel, Arel Pinoviejo. Vivo con ellos."
      - who: Abuela Ceniza
        mood: alegre
        text: "Pasa, {niño|niña}, que hay sopa para uno más. Aquí me llaman Abuela Ceniza. Mi nombre de antes no lo sabe nadie."
      - who: Iker Mendaña
        mood: triste
        text: "¿Me buscabas a mí? Un poco de sal, un poco de… No me acuerdo de cómo me llamo."
      - who: Arel Pinoviejo
        mood: triste
        text: "Llegó hace tres noches. Sus niveles se los quitaron en la torre. Llevaba esto en el bolsillo."
        options:
          - id: decirle-su-nombre
            text: "Te llamas Iker. Iker Mendaña. Cocinas en la Posada del Despertar."
            effects: [{ attitude: 1, who: Iker Mendaña }, { attitude: 1 }]
            reply:
              - { who: Iker Mendaña, mood: alegre, text: "Iker… Suena a alguien que cocina bien. Dímelo otra vez mañana, que se me va." }
              - { who: Arel Pinoviejo, text: "Así se hace. Aquí lo único que sirve es decirles su nombre cada día." }
          - id: ver-pagare
            text: "Déjame ver ese papel."
            effects: [{ clue: "Iker firmó un pagaré en la lonja de Cifra: doscientas monedas que, si no se pagan, se cobran en niveles." }]
            reply: { who: Arel Pinoviejo, mood: enfadado, text: "Un pagaré de la lonja de Cifra. Doscientas monedas. Si no hay monedas, se cobran en niveles. Ya ves cómo acabó." }
      - who: Arel Pinoviejo
        mood: enfadado
        text: "Si quieres saber quién se los quitó, tendrás que ir a Cifra, a la lonja de niveles. Yo me quedo: alguien tiene que decirles su nombre."

hito:
  id: el-plano-de-la-primera
  paquete:
    backdrop: templo
    beats:
      - who: Madre Olvido
        text: "¿Qué buscas en mi biblioteca, {hijo|hija}? Soy la Madre Olvido. Tómate antes una infusión, que estás {pálido|pálida} como {un apagado|una apagada}."
      - who: Madre Olvido
        mood: triste
        text: "Ah. Ese plano. Lo copié hace cuarenta años, antes de vender el bueno a la Contaduría para que no nos cerraran la Ermita."
      - who: Madre Olvido
        text: "Marca una cuarta torre que no sale en ningún mapa. Allí guardó la Primera Cuidadora su cuaderno."
        options:
          - id: vendiste-planos
            text: "¿Vendiste los planos de las torres?"
            effects: [{ attitude: -1 }]
            reply: { who: Madre Olvido, mood: triste, text: "Para que no echaran a cuarenta enfermos a la calle. De los enfermos no me arrepiento. Del resto, sí." }
          - id: gracias-madre
            text: "Gracias, Madre."
            effects: [{ attitude: 1 }]
            reply: { who: Madre Olvido, mood: alegre, text: "Bébete la infusión. Y no le digas a nadie dónde está esa torre." }

## Acto 2: La lonja de niveles

hito:
  id: la-lonja
  paquete:
    backdrop: Cifra
    beats:
      - who: Fermina Lacre
        text: "Ventanilla tres. Fermina Lacre, escribana de la lonja. ¿Compra, venta o pagaré?"
      - who: Fermina Lacre
        text: "Niveles a plazos, artículo doce: se pagan en monedas o, si no hay monedas, en niveles. Firme aquí, aquí y aquí."
      - who: Fermina Lacre
        mood: enfadado
        text: "Y nada de colarse. La capitana Valeria Cerrojo vigila la cola."
        presenta: valeria
      - who: Valeria Cerrojo
        mood: enfadado
        text: "Circulen."
      - who: Nieves Aguja
        mood: alegre
        text: "No firmes nada todavía. Soy Nieves, pinto barras. Por diez monedas, tu nivel parece un seis y nadie en Cifra te mira por encima del hombro."
        options:
          - id: pintar-barra
            text: "Píntamela. Quiero ver qué se siente."
            if: { gold: 10 }
            effects: [{ gold: -10 }, { attitude: 1 }]
            reply: { who: Nieves Aguja, mood: alegre, text: "¡Hecho! Ahora pareces un seis. Por dentro sigues igual: eso no lo pinto." }
          - id: preguntar-iker
            text: "Busco a quien le prestó dinero a Iker Mendaña."
            effects: [{ attitude: -1, who: Fermina Lacre }]
            reply:
              - { who: Fermina Lacre, mood: enfadado, text: "Información reservada, artículo cuarenta. Siguiente." }
              - { who: Nieves Aguja, text: "Ven aparte. Eso no se pregunta en la ventanilla." }
          - id: maga-numeros
            text: "Esa pintura no engañaría a nadie que sepa leer números."
            if: { class: Mago }
            effects: [{ attitude: 1 }]
            reply: { who: Nieves Aguja, mood: alegre, text: "A ti no. A un celador cansado, a las doce de la noche, sí. Me caes bien." }

hito:
  id: el-tasador
  paquete:
    backdrop: Cifra
    beats:
      - who: Nieves Aguja
        text: "¿Ves al de las gafas verdes, el de la cinta de medir al cuello? Es el tasador. Pone precio a los huéspedes antes de que la lonja les preste."
      - who: Nieves Aguja
        mood: triste
        text: "Si a tu amigo le prestaron, él lo tasó. Y últimamente tiene mala cara: no duerme, no come y tasa mal."
        options:
          - id: voy-al-tasador
            text: "Voy a hablar con él."
            reply: { who: Nieves Aguja, text: "Habla bajo. La capitana tiene buen oído." }
          - id: por-que-ayudas
            text: "¿Por qué me ayudas?"
            effects: [{ attitude: 1 }]
            reply: { who: Nieves Aguja, mood: triste, text: "Porque yo también pinto para ellos. Y algunas noches tampoco duermo." }

hito:
  id: el-registro
  paquete:
    backdrop: Cifra
    beats:
      - who: Pelayo Ojeda
        mood: triste
        text: "Fui yo quien dijo que a Iker se le podía prestar. Nivel tres, botas de nivel uno: le puse precio como a un saco. Lo siento."
      - who: Pelayo Ojeda
        text: "El libro de los descuentos está en el cofre del archivo, arriba a la izquierda. La guardia cambia a medianoche."
      - who: Nieves Aguja
        mood: alegre
        text: "Y la ventana de la cocina da al callejón. Le quité el cerrojo la última vez que le pinté la barra a un celador."
      - who: Pelayo Ojeda
        text: "Tomad mi llave de la puerta de atrás. Si os cogen, no me conocéis."
        options:
          - id: registro-medianoche
            text: "Entramos a medianoche, con el cambio de guardia."
            reply: { who: Pelayo Ojeda, text: "Medianoche. Ni un minuto antes, que los de la tarde llevan ballesta." }
          - id: registro-ya
            text: "Entramos ya, antes de que te lo pienses mejor."
            effects: [{ attitude: -1 }]
            reply: { who: Pelayo Ojeda, mood: enfadado, text: "¿Ahora? ¡Con la guardia de la tarde! Si sale mal, yo no he dicho nada." }

hito:
  id: los-nombres-del-libro
  paquete:
    backdrop: posada
    beats:
      - who: Remedios Lumbre
        mood: alegre
        text: "¡Criatura, has vuelto! Pasa a la cocina, que aquí no nos oye nadie."
      - who: Jonás Pradera
        text: "Jonás Pradera, de la Acogida. Remedios me ha dicho lo que traes. Ábrelo. ¡Vamos!"
      - who: Remedios Lumbre
        mood: triste
        text: "Cuatrocientos nombres, con su fecha y los niveles que les quitaron. Iker Mendaña: cinco niveles. Y aquí, en una página vieja, Abel Lumbre."
      - who: Remedios Lumbre
        mood: triste
        text: "Lleva mi apellido. Y en mi libro, hace doce años, con mi letra: «Abel, mi hijo». No me acuerdo de él, criatura. No me acuerdo."
      - who: Basilio Manos
        text: "Basilio Manos, enfermero de la Ermita. Venía a curarle la tos a Remedios y me encuentro esto. Las Cuidadoras sabríamos devolver estos nombres casa por casa, sin que nadie salga herido."
      - who: Jonás Pradera
        mood: enfadado
        text: "¿Sin ruido? ¡Esto se lee en la plaza, hoy, delante de todos! Que se sepa quién cobra y a quién."
        options:
          - id: dar-ermita
            text: "El libro, para las Cuidadoras. Que devuelvan los nombres sin que nadie salga herido."
            irreversible: true
            effects: [{ milestone: el-libro-a-la-ermita }, { attitude: 1, who: Basilio Manos }]
            reply: { who: Basilio Manos, mood: alegre, text: "Lo llevo a la Ermita esta misma noche. Madre Olvido sabrá qué hacer." }
          - id: dar-plaza
            text: "El libro, para la Acogida. Que se lea en voz alta."
            irreversible: true
            effects: [{ milestone: el-libro-a-la-plaza }, { attitude: 1 }]
            reply: { who: Jonás Pradera, mood: alegre, text: "¡Eso es! Que saquen la mesa a la plaza. ¡Vamos, vamos!" }

hito:
  id: el-libro-a-la-ermita
  paquete:
    backdrop: posada
    beats:
      - who: Basilio Manos
        text: "Lo envuelvo en este paño. Que no lo vea ningún celador por el camino."
      - who: Remedios Lumbre
        mood: triste
        text: "Basilio. Cuando devolváis los nombres… ¿me devolveréis también el de Abel?"
      - who: Basilio Manos
        text: "En la Ermita escribimos cada día el nombre de un apagado. Así se olvida más despacio. Empezaremos por el suyo."
      - who: Jonás Pradera
        mood: enfadado
        text: "Sin ruido, sin ruido… Y mientras tanto, la lonja sigue abierta."
        options:
          - id: ermita-razon
            text: "Así nadie paga por lo que leímos en voz alta."
            effects: [{ attitude: -1 }]
            reply: { who: Jonás Pradera, mood: triste, text: "Ya. Ya lo sé. Pero alguien tendrá que gritar algún día." }
          - id: ermita-gritar
            text: "Tienes razón, Jonás. Gritaremos cuando toque."
            effects: [{ attitude: 1 }]
            reply: { who: Jonás Pradera, mood: alegre, text: "Te tomo la palabra. ¡Vamos!" }

hito:
  id: el-libro-a-la-plaza
  paquete:
    backdrop: plaza
    beats:
      - who: Benita Plumas
        text: "Benita Plumas, escribiente del concejo. La mesa ya está en la plaza. Leed despacio, que lo apunto todo en la pared, letra por letra."
      - who: Jonás Pradera
        mood: alegre
        text: "¡Escuchad! Estos son los nombres que la Contaduría se ha cobrado. Uno por uno, sin saltarnos ninguno."
      - who: Jonás Pradera
        mood: triste
        text: "Iker Mendaña, huésped, cinco niveles. Abel Lumbre, de Brasa, siete niveles…"
      - who: Remedios Lumbre
        mood: triste
        text: "Abel. A-B-E-L. Lo he oído en voz alta y algo me duele aquí, criatura. No sé el qué."
      - who: Benita Plumas
        mood: enfadado
        text: "Mañana vendrán los celadores a por esta mesa. Que vengan: ya está todo escrito en la pared."
        options:
          - id: plaza-que-vengan
            text: "Que vengan. Aquí estaremos."
            effects: [{ attitude: 1, who: Jonás Pradera }]
            reply: { who: Jonás Pradera, mood: alegre, text: "¡Así se habla! Esta noche nadie duerme solo en Brasa." }
          - id: plaza-cuidado
            text: "Cuidado, Benita. Esto tiene precio."
            reply: { who: Benita Plumas, text: "Todo tiene precio en esta comarca. Por lo menos este lo elijo yo. P-R-E-C-I-O." }

## Acto 3: Las torres caídas

hito:
  id: las-ruinas
  paquete:
    backdrop: Las Ruinas de la Torre Tres
    beats:
      - who: Sabina Torrera
        mood: alegre
        text: "«La piedra que cae no olvida, la torre que sube no da.» ¡Hola! Sabina Torrera, la última torrera. Cuidado con el foso, que muerde."
      - who: Sabina Torrera
        text: "Las torres las levantaron las Cuidadoras para ver de lejos quién sangraba. Los niveles y los precios se los pusieron después, en Cifra."
      - who: Sabina Torrera
        mood: triste
        text: "Hace cincuenta años rompí el corazón de esta. Trescientas personas se acordaron de golpe de alguien. Mi madre lloró tres días."
      - who: Sabina Torrera
        mood: enfadado
        text: "Y ahora mirad arriba: dos escribanos de la Contaduría copian lo que queda del corazón en dos cristales. Quieren otra torre."
        alt:
          - if: { chose: dar-plaza }
            mood: enfadado
            text: "Desde que leísteis aquel libro en Brasa, la Contaduría tiene prisa. Mirad arriba: dos escribanos copian el corazón en dos cristales. Quieren otra torre."
        options:
          - id: como-cae
            text: "¿Cómo se cae una torre?"
            effects: [{ clue: "Una torre cae si se rompe su corazón, los cristales que la sujetan. Al caer, los nombres que se comió vuelven a la memoria de todos." }]
            reply: { who: Sabina Torrera, text: "Rompiendo su corazón, que son cristales. Lo que la torre se comió, vuelve. «Cristal que cae, nombre que sale.»" }
          - id: mas-torres
            text: "¿Hay más torres caídas por aquí?"
            effects: [{ rumor: r-torre-cuatro }]
            reply: { who: Sabina Torrera, text: "Hay una cuarta que no sale en ningún mapa, a un día de aquí. Mi abuela decía que allí guardó la Primera Cuidadora su cuaderno." }

hito:
  id: los-cristales
  paquete:
    backdrop: Las Ruinas de la Torre Tres
    beats:
      - who: Sabina Torrera
        mood: enfadado
        text: "Si acaban la copia, la Contaduría tendrá dos torres en vez de una. Rompedles los cristales antes."
      - who: Sabina Torrera
        mood: triste
        text: "Y ojo con el guardián de piedra. Despierta cuando alguien toca el corazón. Pesa tanto que, si cae al foso, ya no sube."
      - who: Sabina Torrera
        text: "«Al foso el que pesa, al viento el que vuela.» ¿Subís?"
        options:
          - id: cristales-muro
            text: "Subimos por la izquierda, pegados al muro."
            effects: [{ attitude: 1 }]
            reply: { who: Sabina Torrera, mood: alegre, text: "¡Así se sube una torre! Despacito y con la piedra a la espalda." }
          - id: cristales-frente
            text: "Subimos de frente. Que nos vean venir."
            reply: { who: Sabina Torrera, text: "Valientes o tontos, que en copla rima igual." }

hito:
  id: la-oferta
  paquete:
    backdrop: Cifra
    beats:
      - who: Valeria Cerrojo
        text: "Alto. No vengo a detenerte. Alguien quiere hablar contigo."
      - who: Leandro Tallada
        text: "Leandro Tallada, Contador Mayor. Has roto dos cristales que me costaron diez años. Por cuenta de la torre, eso es mucho dinero."
        alt:
          - if: { chose: dar-plaza }
            text: "Leandro Tallada, Contador Mayor. Has roto dos cristales que me costaron diez años, y has leído mi libro en voz alta en Brasa. Por cuenta de la torre, eso es mucho dinero."
          - if: { chose: dar-ermita }
            text: "Leandro Tallada, Contador Mayor. Has roto dos cristales que me costaron diez años, y mi libro está en la Ermita, con esas mujeres de las infusiones. Por cuenta de la torre, eso es mucho dinero."
      - who: Leandro Tallada
        mood: alegre
        text: "Pero no vengo a cobrarte. Vengo a ofrecerte algo: ningún huésped más con descuento. Ni uno. Y para ti, un nivel alto, de los buenos."
      - who: Leandro Tallada
        text: "A cambio, me das la mano y dejas la torre en paz. Y si alguien sube a por ella, la defiendes tú."
        options:
          - id: rechazar
            text: "No. La torre deja de quitarle niveles a la gente, o se apaga."
            irreversible: true
            effects: [{ milestone: rechazar-la-oferta }]
            reply: { who: Leandro Tallada, mood: enfadado, text: "Qué lástima. Por cuenta de la torre, claro." }
          - id: aceptar
            text: "Trato hecho. Ni un huésped más."
            irreversible: true
            effects: [{ milestone: aceptar-la-oferta }]
            reply: { who: Leandro Tallada, mood: alegre, text: "Sabía que eras de los que entienden los números." }

hito:
  id: rechazar-la-oferta
  paquete:
    backdrop: Cifra
    beats:
      - who: Leandro Tallada
        mood: enfadado
        text: "Capitana, acompañe a esta gente a la puerta. Mañana revisaremos su cuenta."
      - who: Valeria Cerrojo
        text: "Andando."
      - who: Valeria Cerrojo
        mood: triste
        text: "Toma. La llave de la escalera de la torre. No me mires. Llevo en el bolsillo una nota con mi letra: «visitar al de la manta azul los jueves». Y no sé quién es."
      - who: Valeria Cerrojo
        mood: enfadado
        text: "La Acogida se está juntando en Brasa. Si subís, subid de noche. Yo cambio la guardia a medianoche."
        options:
          - id: gracias-valeria
            text: "Gracias, Valeria."
            effects: [{ attitude: 1 }]
            reply: { who: Valeria Cerrojo, text: "No me las des. Haz que se acabe." }
          - id: ven-valeria
            text: "Ven con nosotros."
            reply: { who: Valeria Cerrojo, mood: triste, text: "No. Yo abro la puerta de abajo. Lo de arriba es vuestro." }

hito:
  id: aceptar-la-oferta
  paquete:
    backdrop: Cifra
    beats:
      - who: Leandro Tallada
        mood: alegre
        text: "Por cuenta de la torre. Mañana tu barra dirá un nivel que no has tenido que sudar."
      - who: Valeria Cerrojo
        text: "Enhorabuena. Ya eres de los nuestros."
      - who: Nieves Aguja
        mood: triste
        text: "Ya no te hace falta que te pinte la barra. Ahora te la pintan ellos."
      - who: Leandro Tallada
        text: "Tu primer trabajo: la Acogida subirá a por la torre. Cuando llegue, tú estarás en la puerta."
        options:
          - id: alli-estare
            text: "Allí estaré."
            effects: [{ attitude: 1 }]
            reply: { who: Leandro Tallada, mood: alegre, text: "Así me gusta. Las cuentas claras." }
          - id: y-si-no
            text: "¿Y si no quiero pelear contra ellos?"
            effects: [{ attitude: -1 }]
            reply: { who: Leandro Tallada, mood: enfadado, text: "Entonces tu cuenta se abre otra vez. Y yo nunca me equivoco con una cuenta." }

## Acto 4: La Torre Siete

hito:
  id: la-escalera
  paquete:
    backdrop: Cifra
    beats:
      - who: Valeria Cerrojo
        text: "A medianoche, al pie de la torre. La Acogida llega con cuarenta personas, con palas y con sartenes."
      - who: Valeria Cerrojo
        mood: enfadado
        text: "En la escalera hay un rellano. Arriba, los peldaños dan ventaja. Aguantad ahí hasta que pasen todos."
      - who: Valeria Cerrojo
        text: "Y cuidado con el huésped a sueldo: nivel nueve, y siempre pega al más débil."
        options:
          - id: escalera-alli
            text: "Allí estaremos."
            effects: [{ go: La Torre Siete }]
            reply: { who: Valeria Cerrojo, text: "Medianoche. Ni un minuto más." }
          - id: escalera-preparar
            text: "Antes tengo que prepararme."
            reply: { who: Valeria Cerrojo, mood: enfadado, text: "Pues prepárate deprisa. Mañana revisan tu cuenta." }

hito:
  id: la-cumbre
  paquete:
    backdrop: La Torre Siete
    beats:
      - who: Jonás Pradera
        mood: alegre
        text: "¡Han pasado todos! ¡Cuarenta! ¡Vamos, vamos!"
        alt:
          - if: { chose: dar-ermita }
            mood: alegre
            text: "¡Han pasado todos! Y las Cuidadoras suben detrás, con Madre Olvido y su tetera. ¡Vamos, vamos!"
      - who: Cornelio Sumas
        mood: triste
        text: "Cornelio Sumas, vigilante… Ciento doce, ciento trece… Perdón. Cuento los niveles que entran. La torre se queda la mitad, ¿lo sabíais?"
      - who: Cornelio Sumas
        text: "Arriba está el Contador Mayor, con dos cristales que sujetan el corazón. Y la cumbre no tiene barandilla."
      - who: Jonás Pradera
        text: "Esto es el final. Si sale mal, no hay vuelta atrás. ¿Subes?"
        options:
          - id: cumbre-subo
            text: "Subo. Que se acabe hoy."
            reply: { who: Jonás Pradera, mood: alegre, text: "¡Vamos! ¡Que suene la campanilla!" }
          - id: cumbre-trampilla
            text: "Subo. Cornelio, abre la trampilla."
            effects: [{ attitude: 1, who: Cornelio Sumas }]
            reply: { who: Cornelio Sumas, text: "Ciento catorce… Sí. Sí. Abro. Que no se me olvide cerrarla." }

hito:
  id: la-puerta
  paquete:
    backdrop: Cifra
    beats:
      - who: Leandro Tallada
        text: "Mañana sube la Acogida, con palas y sartenes. Gente que conoces."
      - who: Leandro Tallada
        text: "Tú estarás en la puerta de la torre. Aguanta hasta que se cansen: seis rondas, más o menos."
      - who: Valeria Cerrojo
        mood: triste
        text: "Son vecinos de Brasa. Pelean mal, pero no se rinden."
        options:
          - id: puerta-ire
            text: "Iré a la puerta."
            effects: [{ go: La Torre Siete }]
            reply: { who: Leandro Tallada, mood: alegre, text: "Por cuenta de la torre." }
          - id: puerta-dia
            text: "Necesito un día."
            reply: { who: Leandro Tallada, text: "Un día. Ni uno más." }
