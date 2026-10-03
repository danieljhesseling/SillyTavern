---
title: El mundo tras la pantalla — ronda 4, el hilo y los finales
tags: [pantalla, guion, hilo, hitos, finales]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 4: el hilo

> Dieciocho hitos en cuatro actos, con un secreto. Dos veces el hilo se parte en dos y lo eliges tú, sin vuelta atrás: a quién llevas el libro (las Cuidadoras o la Acogida) y qué le dices al Contador Mayor (que no, o que sí). Lo primero decide, más adelante, cuál de los dos finales buenos te toca; lo segundo, si subes a la cumbre o defiendes la puerta.
>
> Lo que se dice en cada escena va en la ronda 6 (`beats`, dentro de `paquete:`). Aquí, qué abre cada hito, qué pide y qué cambia, y el resumen para el Diario.
>
> **Cómo se eligen las ramas.** La escena de un hito sale al abrirse, salvo la de uno que pide llegar a un sitio, que sale al llegar. Por eso las cuatro ramas (el libro a la Ermita o a la plaza; decirle que no o que sí al Contador Mayor) piden llegar a un sitio, y se eligen en la conversación de antes, con una opción que cumple la rama (`{milestone: …}`). Si nadie elige, ir al sitio la cumple igual.
>
> **El nivel no sube por pasar hitos** (D-J59): sale de pelear y de los encargos. El final es para nivel 4, y el aviso lo dice antes de entrar.

## Acto 1: El despertar

hito:
  id: despertar
  acto: 1
  titulo: Una barra encima de la cabeza
  abre: al_empezar
  pide: "hablar_con: remedios"
  cambia:
    abre_hito: [los-lobos-repetidos]
  pista: "Habla con la posadera de la Posada del Despertar, en Brasa: apunta a mano a todos los huéspedes."
  escena: "Te despiertas en Brasa con una barra encima de la cabeza: vida, nivel y, cuando lo dices, tu nombre. Una cantora y la posadera de la Posada del Despertar te explican lo que se ve y lo que no. Un huésped de la posada lleva tres días sin volver a su litera, y la posadera ya casi no recuerda su cara."

hito:
  id: los-lobos-repetidos
  acto: 1
  titulo: Los lobos que se repiten
  abre: "tras_hito: despertar"
  pide: "ganar_tablero: enc-lobos-repetidos"
  cambia:
    revela: [hondonada-gris]
    abre_hito: [la-hondonada-gris]
  pista: "Sigue la vereda de las setas por el Bosque Copiado: Iker iba por ahí cada mañana."
  escena: "Iker iba al Bosque Copiado a por setas, siempre por la vereda de los lobos. En el claro, tres lobos que parpadean guardan su rastro, al borde de un barranco."

hito:
  id: la-hondonada-gris
  acto: 1
  titulo: La barra gris
  abre: "tras_hito: los-lobos-repetidos"
  pide: "llegar: hondonada-gris"
  cambia:
    abre_hito: [la-lonja]
    reputacion: { acogida: 1 }
  pista: "Pasado el claro, el rastro baja a una hondonada al otro lado del bosque."
  escena: "En la Hondonada Gris viven los apagados. Allí está Iker, vivo, con la barra gris y sin acordarse de su nombre. Un elfo que se acuerda de todos te enseña el pagaré que Iker firmó en Cifra."

hito:
  id: el-plano-de-la-primera
  acto: 1
  titulo: El plano de la Primera Cuidadora
  abre: al_empezar
  oculto: true
  pide: "pistas: 1"
  pistas:
    - { donde: ermita, tirada: investigación }
  cambia:
    revela: [torre-cuatro]
  pista: "En la biblioteca de la Ermita hay algo que la Contaduría no debería tener."
  escena: "Entre los libros de la biblioteca de la Ermita aparece un plano viejo de las torres de la comarca. Marca una cuarta torre que no sale en ningún mapa de la Contaduría."

## Acto 2: La lonja de niveles

hito:
  id: la-lonja
  acto: 2
  titulo: La lonja de niveles
  abre: "tras_hito: la-hondonada-gris"
  pide: "llegar: cifra"
  cambia:
    abre_hito: [el-tasador]
  pista: "Ve a Cifra, a la lonja de niveles: allí se firmó el pagaré de Iker."
  escena: "En la plaza de Cifra, la lonja vende niveles a plazos. Una escribana sella pagarés, una capitana vigila la cola y una pintora de barras te ofrece parecer más de lo que eres."

hito:
  id: el-tasador
  acto: 2
  titulo: El que pone precio
  abre: "tras_hito: la-lonja"
  pide: "hablar_con: pelayo"
  cambia:
    abre_hito: [el-registro]
  pista: "Habla con el tasador de la lonja, en Cifra: fue quien le puso precio a Iker."
  escena: "El tasador que valoró a Iker se arrepiente. Sabe dónde guarda la Contaduría el libro de los descuentos y a qué hora cambia la guardia de noche."

hito:
  id: el-registro
  acto: 2
  titulo: El libro de los descuentos
  abre: "tras_hito: el-tasador"
  pide: "ganar_tablero: enc-registro"
  cambia:
    abre_hito: [los-nombres-del-libro]
    reputacion: { contaduria: -1 }
  pista: "Entra de noche en la sala del registro de Cifra, saca el libro del cofre y sal por la ventana de la cocina."
  escena: "De noche, con la llave del tasador, entras en la Contaduría. El libro de los descuentos está en el cofre del archivo, y la ventana de la cocina da al callejón."

hito:
  id: los-nombres-del-libro
  acto: 2
  titulo: Cuatrocientos nombres
  abre: "tras_hito: el-registro"
  pide: "llegar: brasa"
  cambia:
    abre_hito: [el-libro-a-la-ermita, el-libro-a-la-plaza]
  pista: "Lleva el libro de los descuentos a Brasa: en la Posada del Despertar sabrán leerlo."
  escena: "En la cocina de la Posada del Despertar leéis el libro: cuatrocientos nombres, con sus fechas y sus niveles. Los de Iker se los quedó la torre. Y en una página vieja está Abel Lumbre, el hijo de la posadera. Hay que decidir quién se queda el libro: las Cuidadoras o la Acogida."

hito:
  id: el-libro-a-la-ermita
  acto: 2
  titulo: El libro, a la Ermita
  abre: "tras_hito: los-nombres-del-libro"
  pide: "llegar: ermita"
  cambia:
    cierra: [el-libro-a-la-plaza]
    abre_hito: [las-ruinas]
    reputacion: { cuidadoras: 3, contaduria: -1 }
  pista: "Si el libro es para las Cuidadoras, llévalo a la Ermita."
  escena: "El libro se va con el enfermero de la Ermita. Las Cuidadoras devolverán cada nombre a quien lo perdió, sin ruido, casa por casa."

hito:
  id: el-libro-a-la-plaza
  acto: 2
  titulo: El libro, en voz alta
  abre: "tras_hito: los-nombres-del-libro"
  pide: "llegar: brasa"
  cambia:
    cierra: [el-libro-a-la-ermita]
    abre_hito: [las-ruinas]
    reputacion: { acogida: 3, contaduria: -2 }
  pista: "Si el libro es para la Acogida, se lee en voz alta en la plaza de Brasa."
  escena: "El portavoz de la Acogida lee los cuatrocientos nombres en la plaza de Brasa, uno por uno, delante de todo el pueblo."

## Acto 3: Las torres caídas

hito:
  id: las-ruinas
  acto: 3
  titulo: La torre que cayó
  abre: "tras_hito: el-libro-a-la-ermita"
  pide: "llegar: ruinas-torre-tres"
  cambia:
    abre_hito: [los-cristales]
  pista: "Ve a las Ruinas de la Torre Tres: allí vive la última torrera, y sabe qué son las torres."
  escena: "En las ruinas vive la última torrera. Te cuenta para qué se hicieron las torres, quién les puso los niveles y cómo se cae una. Arriba, dos escribanos de la Contaduría intentan copiar el corazón de la torre caída."

hito:
  id: los-cristales
  acto: 3
  titulo: Los cristales de la copia
  abre: "tras_hito: las-ruinas"
  pide: "ganar_tablero: enc-torre-tres"
  cambia:
    abre_hito: [la-oferta]
    reputacion: { contaduria: -1 }
  pista: "Rompe los dos cristales de la Torre Tres antes de que los escribanos acaben la copia."
  escena: "Dos escribanos del descuento copian el corazón de la torre caída en dos cristales. Si acaban, la Contaduría tendrá una segunda torre. El guardián de piedra despierta al borde del foso."

hito:
  id: la-oferta
  acto: 3
  titulo: La oferta del Contador Mayor
  abre: "tras_hito: los-cristales"
  pide: "llegar: cifra"
  cambia:
    abre_hito: [rechazar-la-oferta, aceptar-la-oferta]
  pista: "Vuelve a Cifra: la Contaduría ya sabe lo de los cristales."
  escena: "En la puerta de Cifra te espera Leandro Tallada, el Contador Mayor, con la capitana de los celadores. No viene a detenerte: viene a ofrecerte un trato. Que no se descuente a ningún huésped más, y un nivel alto para ti, si le das la mano y le dejas la torre."

hito:
  id: rechazar-la-oferta
  acto: 3
  titulo: Decirle que no
  abre: "tras_hito: la-oferta"
  pide: "llegar: brasa"
  cambia:
    cierra: [aceptar-la-oferta]
    abre_hito: [la-escalera]
    reputacion: { contaduria: -2, acogida: 1, cuidadoras: 1 }
  pista: "Si le dices que no, la Acogida subirá contigo: su gente se junta en Brasa."
  escena: "Le dices que no al Contador Mayor. La capitana de los celadores te deja en la mano, sin mirarte, la llave de la escalera de la Torre Siete. Para subir hará falta la Acogida entera."

hito:
  id: aceptar-la-oferta
  acto: 3
  titulo: Darle la mano
  abre: "tras_hito: la-oferta"
  pide: "llegar: torre-siete"
  cambia:
    cierra: [rechazar-la-oferta]
    abre_hito: [la-puerta]
    reputacion: { contaduria: 4, acogida: -3, cuidadoras: -2 }
  pista: "Si aceptas el trato, el Contador Mayor te espera en la Torre Siete."
  escena: "Aceptas el trato del Contador Mayor. A los huéspedes no se les descontará más; a ti te subirán de nivel. A cambio, defenderás la Torre Siete de quien venga a por ella."

## Acto 4: La Torre Siete

hito:
  id: la-escalera
  acto: 4
  titulo: La escalera de la Torre Siete
  abre: "tras_hito: rechazar-la-oferta"
  pide: "ganar_tablero: enc-escalera"
  cambia:
    abre_hito: [la-cumbre]
  pista: "Sube con la Acogida a la Torre Siete y aguanta en el rellano mientras los demás suben."
  escena: "La Acogida sube por la escalera de la Torre Siete. Los celadores bajan a por vosotros. Hay que aguantar en el rellano mientras pasan todos."

hito:
  id: la-cumbre
  acto: 4
  titulo: La cumbre
  abre: "tras_hito: la-escalera"
  pide: "ganar_tablero: enc-cumbre"
  cambia:
    final: la-torre-apagada
    final_segun: { cuidadoras: la-torre-que-cuida, acogida: la-torre-apagada }
  pista: "Llega a la cumbre de la Torre Siete y detén al Contador Mayor. Es el final, para nivel 4."
  escena: "En la cumbre late el corazón de la torre, sujeto por dos cristales. El Contador Mayor no se aparta. Detrás de vosotros, la Acogida y las Cuidadoras esperan para decidir qué se hace con la torre."

hito:
  id: la-puerta
  acto: 4
  titulo: La puerta de la Torre Siete
  abre: "tras_hito: aceptar-la-oferta"
  pide: "ganar_tablero: enc-puerta"
  cambia:
    final: la-cuenta-sigue
  pista: "Defiende la puerta de la Torre Siete: la Acogida viene a por ella. Es el final, para nivel 4."
  escena: "La Acogida sube a por la torre con palas y sartenes. Son gente que conoces. El Contador Mayor mira desde la ventana."

## Los finales

Cada uno con lo que fue de cada compañero y de la gente que pesó.

final:
  id: la-torre-apagada
  titulo: La torre apagada
  escena: "El corazón de la Torre Siete se rompe con un ruido de cristal, y por toda la comarca las barras se apagan a la vez. Durante un momento nadie dice nada. Luego, en la Hondonada Gris, alguien grita un nombre y otro contesta. Los apagados vuelven a la memoria de los suyos. Ya nadie ve los números de nadie: para saber cómo está alguien, hay que preguntárselo."
  epilogos:
    - quien: remedios
      texto: "Remedios Lumbre abraza en la puerta de la posada a un hombre de treinta años que se llama Abel. Lo apunta otra vez en su libro, con letra grande."
    - quien: iker
      texto: "Iker Mendaña vuelve a la cocina de la Posada del Despertar. Su primer guiso lleva demasiada sal, y nadie se queja."
    - quien: tallada
      texto: "Leandro Tallada es un hombre de nivel dos, aunque ya nadie lo ve. Ahora se acuerda de que tuvo una hija, Ainhoa, y la busca todas las tardes por la comarca."
    - quien: candela
      texto: "Candela Rima sigue cantando en Brasa, pero ahora sus canciones llevan nombres de gente que se ríe al oírlos."
    - quien: yoli
      texto: "Yoli deja de contar su vida en voz alta. Dice que ya no hace falta: aquí no se le va a olvidar a nadie."
    - quien: arel
      texto: "Arel Pinoviejo deshace su cuerda nudo a nudo, y en cada uno dice un nombre que ahora todos recuerdan."
    - quien: nieves
      texto: "Nieves Aguja se queda sin barras que pintar. Abre un puesto en la plaza de Cifra donde pinta caras, y la cola da la vuelta a la lonja."
    - quien: celso
      texto: "Celso Ruda aprende a curar sin mirar barras, como las Cuidadoras antiguas: preguntando dónde duele."
    - quien: acogida
      texto: "La Acogida sigue tocando la campanilla cada vez que alguien sale del bosque. Ahora los recién llegados despiertan sin barra, y sin deudas."

final:
  id: la-torre-que-cuida
  titulo: La torre que cuida
  escena: "Sabina Torrera y Madre Olvido cambian el corazón de la Torre Siete con lo que dejó escrito la Primera Cuidadora. Las barras no desaparecen: se quedan, pero solo dicen la vida. Ni niveles, ni precios, ni descuentos. Los apagados vuelven a la memoria de los suyos, y desde la Ermita se ve quién está herido en cada rincón de la comarca."
  epilogos:
    - quien: olvido
      texto: "Madre Olvido manda a una cuidadora a cualquier casa donde una barra baje de la mitad. Ahora llegan antes que la fiebre."
    - quien: sabina
      texto: "Sabina Torrera se queda a vivir en la Torre Siete. Canta sus coplas en la cumbre, y dice que la torre las escucha."
    - quien: remedios
      texto: "Remedios Lumbre recibe en la posada a su hijo Abel. Le pone la mejor litera y le apunta en el libro con letra grande."
    - quien: tallada
      texto: "Leandro Tallada trabaja en la Ermita, barriendo el claustro. Su barra dice que está sano. Lo que le duele no lo cuenta ninguna torre: se acuerda de su hija, Ainhoa."
    - quien: candela
      texto: "Candela Rima canta en la Ermita los domingos. Sus canciones ya no son de nombres perdidos, sino de nombres que han vuelto."
    - quien: yoli
      texto: "Yoli se hace cuidadora. Dice que es lo mismo que la ambulancia, pero sin sirena."
    - quien: arel
      texto: "Arel Pinoviejo cuelga su cuerda en la cumbre de la torre, para que el viento diga los nombres."
    - quien: nieves
      texto: "Nieves Aguja ya no pinta barras: no queda ningún número que pintar. Pinta letreros para la Ermita, y se le dan muy bien."
    - quien: celso
      texto: "Celso Ruda es el cuidador más joven de la torre. Cuenta los latidos de todo el que sube, por costumbre."
    - quien: cuidadoras
      texto: "Las Cuidadoras vuelven a llevar la torre que levantaron sus abuelas. En sus libros ya no hay precios: solo nombres y heridas."

final:
  id: la-cuenta-sigue
  titulo: La cuenta sigue
  escena: "La Acogida se retira de la puerta de la Torre Siete con sus heridos a cuestas. La torre sigue contando. Leandro Tallada cumple su palabra a medias: a los huéspedes ya no se les descuenta, pero a los deudores de siempre, sí. Tu barra brilla con un nivel que no has ganado peleando. En la Hondonada Gris siguen viviendo cuarenta y tres personas sin nombre, y solo los elfos se acuerdan de ellas."
  epilogos:
    - quien: tallada
      texto: "Leandro Tallada sigue en la lonja, sonriendo a los clientes. Lleva al cuello un medallón con un nombre que no reconoce, y a veces lo abre sin saber por qué."
    - quien: remedios
      texto: "Remedios Lumbre cierra la puerta de la posada cuando pasas. En su libro, tu nombre está tachado con una raya fina."
    - quien: iker
      texto: "Iker Mendaña sigue en la Hondonada. Cada mañana alguien le dice su nombre, y cada noche se le vuelve a olvidar."
    - quien: jonas
      texto: "Jonás Pradera lleva a la Acogida lejos de Cifra, al otro lado del bosque. Dice que empezarán de cero, sin torre."
    - quien: candela
      texto: "Candela Rima deja de cantar en Brasa. Dicen que ahora canta en el camino, y que una de sus canciones lleva tu nombre, pero no la buena."
    - quien: yoli
      texto: "Yoli vuelve a contar su vida en voz alta, cada noche, más deprisa que antes."
    - quien: arel
      texto: "Arel Pinoviejo ata un nudo más en su cuerda. No te dice de quién es."
    - quien: nieves
      texto: "Nieves Aguja pinta barras para la lonja, más que nunca. Gana mucho. Ya no se ríe al cobrar."
    - quien: celso
      texto: "Celso Ruda sigue mandando sus listas a Cifra. Su familia no debe nada, y él ya no cuenta los latidos de nadie."
    - quien: contaduria
      texto: "La Contaduría pone tu nombre en la lonja, en letras doradas, junto a una frase: «Por cuenta de la torre»."
