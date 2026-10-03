---
title: El mundo tras la pantalla — ronda 8, las salidas de cada pelea y lo que se puede mirar
tags: [pantalla, guion, tableros, avoid, parley, trampas, sights]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 8: fuera del hilo

> Lo que el YAML de la ronda 3 no sabía decir: cómo no pelear (`avoid`), cómo salir a mitad de la pelea hablando (`parley`), las trampas (`traps`) y los objetivos de más de una línea (`mision:`, que va a la misión del tablero). Y en cada localización, dos cosas que mirar (`sights`).
>
> - **A los muertos y a lo que no tiene mente no se le habla:** los lobos se espantan, las copias sin cara y las sombras se esquivan, los ahogados se dejan atrás. A la gente, sí: celadores, cobradores, escribanos, el huésped mercenario, el Contador Mayor y los vecinos de la Acogida.
> - **Seis trampas en cinco tableros:** un cepo en la Contaduría, la cuerda de la campana del fielato, el peldaño suelto de la escalera, las dos losas con número de la Torre Cuatro y la estantería floja del Archivo. Cada una con lo que se ve sin buscarla.
> - **Empujar importa** donde hay vacío o agua honda: el barranco del claro y del fielato, el foso de la Torre Tres, la cumbre sin barandilla, el caz del molino y la orilla del lago.
> - **Los dos finales son para nivel 4** (D-J59, `levels: [4, 4]`): el aviso lo dice antes de entrar.
>
> **Comprobación:** cada pelea con gente tiene su salida hablada, escrita como lo diría quien manda; cada sitio tiene dos cosas que mirar; y lo que se ve lo dice alguien de allí cuando hay alguien. ✔

## Las peleas

encuentro:
  id: enc-lobos-repetidos
  paquete:
    avoid:
      - kind: hablar
        text: "Gritar y golpear dos piedras para espantarlos"
        skill: intimidation
        dc: 12
        success:
          who: "{companero}"
          text: "¡Parpadean, se duplican… y salen corriendo hacia los árboles! El rastro de Iker sigue limpio hacia el este."
        failure:
          who: "{companero}"
          text: "Enseñan los dientes. ¿Eran tres? Ahora parece que son seis."
      - kind: esconderse
        text: "Rodear el claro por la maleza, lejos del barranco"
        dc: 13
        success:
          who: "{companero}"
          text: "Ni nos han olido. Al otro lado de las zarzas, el rastro baja hacia una hondonada."
        failure:
          who: "{companero}"
          text: "¡Ha crujido una rama! Tres cabezas grises se giran a la vez."

encuentro:
  id: enc-la-loba
  paquete:
    avoid:
      - kind: hablar
        text: "Plantarte delante de la loba vieja con una antorcha encendida"
        skill: intimidation
        dc: 15
        success:
          who: "{companero}"
          text: "Te mira con los ojos turbios… gruñe… y se tumba. Sus copias se deshacen como humo. Esa ya no parirá más lobos."
        failure:
          who: "{companero}"
          text: "¡Aúlla! ¡Y del bosque salen dos copias más!"

encuentro:
  id: enc-copias
  paquete:
    avoid:
      - kind: huir
        text: "Salir de las veredas repetidas corriendo, siempre por la izquierda"
        dc: 12
        success:
          who: "{companero}"
          text: "¡Ya está! Los árboles han dejado de repetirse. Las copias se quedan quietas entre los troncos, mirando sin cara."
        failure:
          who: "{companero}"
          text: "Cada vereda nos devuelve al mismo claro… ¡y las copias ya están aquí!"
      - kind: esconderse
        text: "Quedaros quietos entre los árboles copiados, como un tronco más"
        dc: 12
        success:
          who: "{companero}"
          text: "Pasan a un palmo, tanteando el aire… No nos ven: no tienen ojos."
        failure:
          who: "{companero}"
          text: "Se ha parado delante de ti… Gira la cara lisa hacia tu respiración."

encuentro:
  id: enc-cuervos
  paquete:
    avoid:
      - kind: hablar
        text: "Hacer mucho ruido con una cazuela de la cocina de la Ermita"
        skill: intimidation
        dc: 10
        success:
          who: "{companero}"
          text: "¡Levantan el vuelo, una nube negra! Se llevan un par de números, pero los enfermos ya están dentro."
        failure:
          who: "{companero}"
          text: "Graznan como si se rieran… ¡y bajan en picado!"

encuentro:
  id: enc-registro
  paquete:
    avoid:
      - kind: esconderse
        text: "Entrar por la cocina con el cambio de guardia y subir sin que os oigan"
        dc: 14
        success:
          who: "{companero}"
          text: "Siguen con sus cartas en la sala grande. Ya tengo el libro del cofre: salgamos por la ventana de la cocina."
          effects: [{ give: Libro de descuentos }]
        failure:
          who: "Celador de la Contaduría"
          text: "¿Ha crujido la escalera? ¿Quién anda ahí? ¡Los faroles!"
      - kind: hablar
        text: "Fingir que venís de parte de la escribana, a recoger unos papeles"
        skill: deception
        dc: 15
        success:
          who: "Celador de la Contaduría"
          text: "Arriba a la izquierda. Y cerrad al salir."
          effects: [{ give: Libro de descuentos }]
        failure:
          who: "Celador de la Contaduría"
          text: "¿A medianoche? ¿Papeles? ¡Quietos ahí!"
    parley:
      leader: Celador de la Contaduría
      entregarse:
        text: "Soltar las armas y levantar las manos"
        success:
          who: "Celador de la Contaduría"
          text: "Atadlos y sacadlos por la puerta de atrás. Mañana, que decida la capitana. La bolsa se queda aquí."
          effects: [{ gold: -10 }]
      sobornar:
        text: "Ofrecerles una paga de un mes por mirar a otro lado"
        gold: 25
        success:
          who: "Celador de la Contaduría"
          text: "¿Un mes de paga? Nosotros no hemos visto nada. Ni vosotros a nosotros."
        failure:
          who: "Celador de la Contaduría"
          text: "¿Eso? Eso no llega ni a nivel uno."
      convencer:
        text: "Decirles qué hay en ese libro: sus propios nombres, el día que deban algo"
        dc: 14
        success:
          who: "Celador de la Contaduría"
          text: "Mi madre debe a la lonja… Apartaos de la escalera. No he dicho nada."
        partial:
          who: "Celador de la Contaduría"
          text: "¿Nuestros nombres? …Esperad. Quietos un momento."
        failure:
          who: "Celador de la Contaduría"
          text: "Nosotros no debemos nada. Somos celadores."
      engañar:
        text: "Gritar que la capitana sube por la escalera"
        dc: 13
        success:
          who: "Celador de la Contaduría"
          text: "¿La capitana? ¡Al rellano, a cuadrarse! …Eh, ¿y los de la escalera?"
        failure:
          who: "Celador de la Contaduría"
          text: "La capitana no sube escaleras de noche."
    traps:
      - name: Cepo de la Contaduría
        x: 8
        y: 5
        tell: "Una losa del pasillo grande está más limpia que las demás, como si nadie la pisara nunca."
        damage: 1d6
        condition: restrained
        spotDC: 12
        disarmDC: 12
        once: true
  mision:
    objectives:
      - type: loot
        label: "Sacar el libro del cofre del archivo"
        treasures: [Libro de descuentos]
      - type: reach_cell
        label: "Salir por la ventana de la cocina"
        cell: { x: 2, y: 10 }

encuentro:
  id: enc-redada
  paquete:
    avoid:
      - kind: hablar
        text: "Hacer que el teniente lea su lista en voz alta, delante de todo el patio"
        dc: 15
        success:
          who: "Teniente de la lonja"
          text: "Uno… dos… tres… …Retirada. Nos vamos."
          effects: [{ standing: La Acogida, amount: 1 }]
        failure:
          who: "Teniente de la lonja"
          text: "Las listas no se leen: se tachan."
      - kind: pagar
        text: "Pagar la deuda más pequeña de la lista, para que se vayan con algo"
        gold: 30
        success:
          who: "Teniente de la lonja"
          text: "Un nombre tachado. Nos vamos. Esta vez."
    parley:
      leader: Teniente de la lonja
      sobornar:
        text: "Ofrecerle más de lo que le paga la lonja"
        gold: 30
        success:
          who: "Teniente de la lonja"
          text: "Por esta noche, el libro se ha quemado. ¡Celadores, nos vamos!"
        failure:
          who: "Teniente de la lonja"
          text: "Lo que me paga la lonja no lo juntáis vosotros en un año."
      convencer:
        text: "Decirle que, sin su lista, sus celadores no saben a quién buscan"
        dc: 14
        success:
          who: "Teniente de la lonja"
          text: "Volveremos con otra lista. Retirada."
        partial:
          who: "Teniente de la lonja"
          text: "Quietos… Que lo piense."
        failure:
          who: "Teniente de la lonja"
          text: "La lista me la sé de memoria."
      engañar:
        text: "Gritar que la lista de Jonás ya ha salido por detrás, hacia el bosque"
        dc: 13
        success:
          who: "Teniente de la lonja"
          text: "¡Al bosque! ¡Por detrás, rápido!"
        failure:
          who: "Teniente de la lonja"
          text: "La lista está en la cocina. La huelo desde aquí."
      no: [entregarse]

encuentro:
  id: enc-fielato-noche
  paquete:
    avoid:
      - kind: pagar
        text: "Pagar el peaje doble de los apagados, uno por uno"
        gold: 6
        success:
          who: "Celador de la Contaduría"
          text: "Pasad. Y que no os vea el de la madrugada."
      - kind: esconderse
        text: "Cruzar por la orilla del barranco, pegados a la roca"
        dc: 13
        success:
          who: "Abuela Ceniza"
          text: "No me sueltes la mano… No me la sueltes hasta el otro lado. …Ya está. Gracias."
        failure:
          who: "Celador de la Contaduría"
          text: "¡Alto! ¿Quién va?"
    parley:
      leader: Celador de la Contaduría
      sobornar:
        text: "Pagarle lo mismo que cobra el sargento de noche"
        gold: 8
        success:
          who: "Celador de la Contaduría"
          text: "El de noche cobra poco. Yo, lo justo."
        failure:
          who: "Celador de la Contaduría"
          text: "Yo no soy el de noche."
      convencer:
        text: "Decirle que uno de estos apagados podría ser su madre, y él no lo sabría"
        dc: 15
        success:
          who: "Celador de la Contaduría"
          text: "…Abro la barrera. Pasad."
        partial:
          who: "Celador de la Contaduría"
          text: "Esa abuela… ¿Quién es? Quietos."
        failure:
          who: "Celador de la Contaduría"
          text: "Mi madre está en Cifra, en su casa. Lo sé."
      no: [entregarse]
    traps:
      - name: Cuerda de la campana
        x: 12
        y: 7
        tell: "Una cuerda fina cruza el camino a la altura del tobillo, atada a una campana."
        damage: 1d4
        condition: prone
        spotDC: 11
        disarmDC: 11
        once: true

encuentro:
  id: enc-cobro-camino
  paquete:
    avoid:
      - kind: hablar
        text: "Pasarle un dedo mojado por la barra al más chulo: la pintura se corre"
        skill: intimidation
        dc: 12
        success:
          who: "Cobrador de porra"
          text: "¡Mi barra! ¡Se corre la pintura! …¡Pies, para qué os quiero!"
        failure:
          who: "Cobrador de porra"
          text: "¡Es de verdad, es de verdad!"
      - kind: pagar
        text: "Pagar el peaje que piden"
        gold: 10
        success:
          who: "Cobrador de porra"
          text: "Pagado. ¡A repartir, muchachos!"
    parley:
      leader: Cobrador de porra
      sobornar:
        text: "Darle la mitad de lo que lleváis encima"
        gold: 12
        success:
          who: "Cobrador de porra"
          text: "Medio cobro es mejor que ninguno."
        failure:
          who: "Cobrador de porra"
          text: "Media bolsa no paga ni mi porra."
      convencer:
        text: "Decirle que el cobrador de verdad sabe lo que hacen, y viene detrás"
        dc: 12
        success:
          who: "Cobrador de porra"
          text: "¿El de verdad? ¿Detrás? ¡Corred!"
        partial:
          who: "Cobrador de porra"
          text: "¿Sabe lo que hacemos…? Esperad un momento."
        failure:
          who: "Cobrador de porra"
          text: "Que venga. Le cobramos a él también."
      engañar:
        text: "Decirles que se les está corriendo la pintura"
        dc: 11
        success:
          who: "Cobrador de porra"
          text: "¿Se corre? ¡Frotad, frotad! …Bah. Se me han quitado las ganas de pelear."
        failure:
          who: "Cobrador de porra"
          text: "Pintura buena, de Cifra. No se corre."

encuentro:
  id: enc-molino
  paquete:
    avoid:
      - kind: hablar
        text: "Enseñarles el papel de cuentas: ninguna cifra lleva sello de la Contaduría"
        dc: 14
        success:
          who: "Cobrador de porra"
          text: "Sin sello no se cobra. Nos vamos, y el chico se queda."
        failure:
          who: "Cobrador de porra"
          text: "El sello lo ponemos después."
      - kind: pagar
        text: "Pagar la deuda de Severino entera"
        gold: 40
        success:
          who: "Cobrador de porra"
          text: "Treinta y ocho… treinta y nueve… cuarenta. Cuarenta otra vez. Está bien: el chico se queda."
    parley:
      leader: Cobrador de porra
      sobornar:
        text: "Pagarle su parte del cobro, sin que la vea la Contaduría"
        gold: 15
        success:
          who: "Cobrador de porra"
          text: "Mi parte es mi parte. Nos vamos."
        failure:
          who: "Cobrador de porra"
          text: "Mi parte es más grande que eso."
      convencer:
        text: "Decirle que, si se lleva al chico, en Los Molinos nadie le volverá a abrir la puerta"
        dc: 13
        success:
          who: "Cobrador de porra"
          text: "Tantas caras enharinadas en las ventanas… Otro día."
        partial:
          who: "Cobrador de porra"
          text: "Hmm… Quietos todos."
        failure:
          who: "Cobrador de porra"
          text: "Ya no me la abren."
      engañar:
        text: "Gritar que el chico se ha escapado por el caz"
        dc: 12
        success:
          who: "Cobrador de porra"
          text: "¿Por el caz? ¡A la orilla! …¿Y la puerta? ¡Atrancada!"
        failure:
          who: "Cobrador de porra"
          text: "El caz está demasiado frío. No se ha escapado nadie."
      no: [entregarse]

encuentro:
  id: enc-ahogados
  paquete:
    avoid:
      - kind: huir
        text: "Apartaros del agua corriendo, sin mirar atrás"
        dc: 11
        success:
          who: "{companero}"
          text: "Fuera del agua se secan y se agrietan. No nos siguen."
        failure:
          who: "{companero}"
          text: "¡Te agarra del tobillo… con tu propia mano!"

encuentro:
  id: enc-torre-tres
  paquete:
    avoid:
      - kind: hablar
        text: "Decir a los escribanos que la Contaduría ha cancelado la copia"
        skill: deception
        dc: 15
        success:
          who: "Escribano del descuento"
          text: "¿Cancelada? ¿Otra vez? Maldita burocracia… Recoged los libros. Y sin nadie que los cuide, que se rajen los cristales."
        failure:
          who: "Escribano del descuento"
          text: "¿Cancelada? Enseña el sello."
    parley:
      leader: Escribano del descuento
      convencer:
        text: "Decirles que lo que copian les borrará también a ellos, el día que deban algo"
        dc: 14
        success:
          who: "Escribano del descuento"
          text: "¿A nosotros también? …Dejad las plumas. ¡Abajo, todos!"
        partial:
          who: "Escribano del descuento"
          text: "Esperad… Dejad de escribir un momento."
        failure:
          who: "Escribano del descuento"
          text: "Nosotros anotamos. No debemos."
      engañar:
        text: "Gritar que el guardián se ha despertado por su culpa"
        dc: 13
        success:
          who: "Escribano del descuento"
          text: "¿Despierto, por nuestra culpa? ¡Soltad los libros y corred!"
        failure:
          who: "Escribano del descuento"
          text: "El guardián obedece al que escribe."
      no: [entregarse, sobornar]

encuentro:
  id: enc-escalera
  paquete:
    avoid:
      - kind: hablar
        text: "Decirle al huésped mercenario que su nivel nueve también tiene dueño"
        dc: 16
        success:
          who: "Huésped mercenario"
          text: "Mi nivel nueve… ¿también tiene dueño? Yo no firmé esto para morir en una escalera. Me voy."
        failure:
          who: "Huésped mercenario"
          text: "Mi nivel es mío. Lo he pagado."
    parley:
      leader: Huésped mercenario
      sobornar:
        text: "Ofrecerle más de lo que le paga la Contaduría"
        gold: 40
        success:
          who: "Huésped mercenario"
          text: "Más es más. Me aparto. Los celadores, que hagan lo que quieran."
        failure:
          who: "Huésped mercenario"
          text: "Me pagan en niveles. Vosotros no tenéis de eso."
      convencer:
        text: "Decirle que en su mundo nadie le pagaría por esto"
        dc: 15
        success:
          who: "Huésped mercenario"
          text: "Ja… En mi mundo me echaban de las tiendas. Tienes razón. Me voy escaleras abajo."
        partial:
          who: "Huésped mercenario"
          text: "En mi mundo… Déjame pensar."
        failure:
          who: "Huésped mercenario"
          text: "En mi mundo no tenía barra. Aquí sí."
      no: [entregarse]
    traps:
      - name: Peldaño suelto
        x: 8
        y: 5
        tell: "Un peldaño del rellano tiene la piedra partida, y se mueve cuando sopla el viento."
        damage: 1d6
        condition: prone
        spotDC: 12
        disarmDC: 13
        once: true

encuentro:
  id: enc-cumbre
  paquete:
    avoid:
      - kind: hablar
        text: "Decirle al Contador Mayor el nombre de su hija: Ainhoa"
        dc: 20
        success:
          who: "El Contador Mayor"
          text: "Ainhoa… Lo pone en el medallón: Ainhoa. …Basta. Yo mismo romperé los cristales."
        failure:
          who: "El Contador Mayor"
          text: "Un nombre. Otro nombre. ¡Tengo cuatrocientos en un libro!"
    parley:
      leader: El Contador Mayor
      convencer:
        text: "Decirle que, debajo de sus doce niveles, hay un hombre de nivel dos con miedo"
        dc: 18
        success:
          who: "El Contador Mayor"
          text: "Doce… El doce parpadea. Dos. Soy un dos. …Bajo las manos."
        partial:
          who: "El Contador Mayor"
          text: "El medallón… Espera. Espera."
        failure:
          who: "El Contador Mayor"
          text: "Doce. Por cuenta de la torre, doce."
      engañar:
        text: "Gritar que la torre también se está quedando con sus niveles"
        dc: 17
        success:
          who: "El Contador Mayor"
          text: "¿También mis niveles? Esa luz… ¡Atrás, escribanos, atrás!"
        failure:
          who: "El Contador Mayor"
          text: "La torre es mía. No me cobra."
      no: [entregarse, sobornar]
  mision:
    levels: [4, 4]
    objectives:
      - type: eliminate
        label: "Detener al Contador Mayor"
        target: El Contador Mayor
      - type: eliminate
        label: "Romper los dos cristales del corazón"
        target: Cristal de la cuenta
        optional: true

encuentro:
  id: enc-puerta
  paquete:
    avoid:
      - kind: hablar
        text: "Decirles a los vecinos de Brasa que se vayan a casa: esta noche no gana nadie"
        dc: 17
        success:
          who: "Acogido en armas"
          text: "Hoy no gana nadie… Está bien. Recoged a los heridos. Nos vamos a casa."
        failure:
          who: "Acogido en armas"
          text: "¡Tú eras de los nuestros!"
    parley:
      leader: Acogido en armas
      convencer:
        text: "Decirles que no quieres pelear contra ellos"
        dc: 13
        success:
          who: "Acogido en armas"
          text: "Bajad las palas. De uno en uno. Volvemos a Brasa."
        partial:
          who: "Acogido en armas"
          text: "¿Y si dice la verdad? Quietos…"
        failure:
          who: "Acogido en armas"
          text: "Pues no haber dado la mano."
      no: [sobornar, engañar]
  mision:
    levels: [4, 4]

encuentro:
  id: enc-torre-cuatro
  paquete:
    avoid:
      - kind: esconderse
        text: "Bajar sin luz, pegados a la pared, pisando solo las losas sin número"
        dc: 14
        success:
          who: "{companero}"
          text: "Las sombras se van hacia donde no estamos. Ya tengo el cuaderno del cofre. Subamos."
          effects: [{ give: Cuaderno de la Primera Cuidadora }]
        failure:
          who: "{companero}"
          text: "¡Clic! Esa losa se ha hundido… Las sombras se giran hacia el ruido."
    traps:
      - name: Losa del siete
        x: 7
        y: 5
        tell: "Una losa del pasillo tiene un siete grabado. Las de alrededor no tienen nada."
        damage: 1d8
        spotDC: 13
        disarmDC: 13
        once: true
      - name: Losa del tres
        x: 10
        y: 7
        tell: "Otra losa con un número grabado, un tres, un poco más hundida que las demás."
        damage: 1d6
        condition: frightened
        spotDC: 13
        disarmDC: 13
        once: true
  mision:
    objectives:
      - type: loot
        label: "Sacar del cofre el cuaderno de la Primera Cuidadora"
        treasures: [Cuaderno de la Primera Cuidadora]

encuentro:
  id: enc-archivo
  paquete:
    avoid:
      - kind: esconderse
        text: "Cruzar el agua por encima de los estantes caídos, de uno en uno"
        dc: 13
        success:
          who: "{companero}"
          text: "Las sombras se quedan entre los estantes. Ya tengo el medallón del archivero. Salgamos."
          effects: [{ give: Medallón de Ainhoa }]
        failure:
          who: "{companero}"
          text: "¡Cruje el estante! Las sombras se vuelven hacia el ruido."
    traps:
      - name: Estantería floja
        x: 12
        y: 6
        tell: "Una estantería se inclina hacia el pasillo, con los libros a punto de caer."
        damage: 1d8
        condition: prone
        spotDC: 12
        disarmDC: 14
        once: true
  mision:
    objectives:
      - type: loot
        label: "Recuperar el medallón del cofre del archivero"
        treasures: [Medallón de Ainhoa]

## Lo que se puede mirar

localidad:
  id: brasa
  paquete:
    sights:
      - verbo: leer
        text: "los nombres de la Pared de los Nombres, en la plaza"
        skill: investigation
        found: "Hay nombres raspados a cuchillo. Al pie de la pared, entre la hierba, brilla un botón gris de celador."
      - verbo: mirar
        text: "la campanilla de la Acogida, junto a la puerta de la posada"
        skill: insight
        found: "La posadera lo explica sin dejar de remover el guiso: «La tocamos cuando alguien sale del bosque. Que nadie despierte solo, criatura.»"

localidad:
  id: casa-acogida
  paquete:
    sights:
      - verbo: mirar
        text: "las mesas largas del comedor de la Acogida"
        skill: perception
        found: "Hay platos para cuarenta y solo comen doce. El portavoz los pone igual: «Por si llega alguien del bosque. ¡Vamos!»"
      - verbo: leer
        text: "la lista clavada detrás de la puerta"
        skill: investigation
        found: "Treinta y un nombres de huéspedes, con lo que deben y a quién. Al lado de algunos, a lápiz: «ya no se acuerda»."

localidad:
  id: bosque-copiado
  paquete:
    sights:
      - verbo: examinar
        text: "el roble torcido que se repite tres veces"
        skill: perception
        found: "Los tres robles tienen la misma muesca. En el tercero, la muesca está al revés: ese es el de verdad."
      - verbo: seguir
        text: "las huellas de la vereda de las setas"
        skill: survival
        found: "Unas botas de huésped bajan hacia el este. Las acompañan huellas de lobo, siempre de dos en dos."

localidad:
  id: ermita
  paquete:
    sights:
      - verbo: buscar
        text: "entre los planos viejos de la biblioteca"
        skill: investigation
        found: "Debajo de un herbario hay un plano de las torres de la comarca. Tiene una cuarta torre que no sale en ningún mapa de la Contaduría."
      - verbo: mirar
        text: "el huerto de hierbas del claustro"
        skill: perception
        found: "El enfermero, sin levantar la vista: «Romero, tila y ortiga. Con eso y una mano en la frente se cura medio pueblo.»"

localidad:
  id: molinos
  paquete:
    sights:
      - verbo: escuchar
        text: "la rueda del molino grande"
        skill: perception
        found: "La rueda gira bien. Entre vuelta y vuelta se oye toser a alguien, ahí dentro."
      - verbo: leer
        text: "el papel de cuentas clavado en la puerta del molino"
        skill: investigation
        found: "Cuarenta monedas, tachado. Cincuenta y dos, tachado. Ochenta. Ninguna cifra lleva sello de la Contaduría."

localidad:
  id: fielato
  paquete:
    sights:
      - verbo: leer
        text: "la tarifa del peaje pintada en la barrera"
        skill: investigation
        found: "«Nivel 1 y 2: dos monedas. Del 3 al 8: una. Del 9 en adelante: nada.» Debajo, a carbón: «el que menos tiene, más paga»."
      - verbo: mirar
        text: "el barranco que cae junto al camino"
        skill: perception
        found: "Muy abajo, entre las piedras, hay un escudo gris de celador. Nadie ha bajado a por él."

localidad:
  id: cifra
  paquete:
    sights:
      - verbo: leer
        text: "los avisos de la lonja de niveles"
        skill: investigation
        found: "«¡Nivel 5 en una tarde! Pague en cómodos plazos.» En letra pequeña: «si no hay monedas, se cobra en niveles»."
      - verbo: mirar
        text: "la Torre Siete desde la plaza"
        skill: perception
        found: "La luz de la cumbre late despacio, como un corazón. Cada vez que late, a alguien de la plaza le baja un número."

localidad:
  id: lago-espejo
  paquete:
    sights:
      - verbo: mirarte
        text: "en el agua del lago"
        skill: insight
        found: "En el agua, tu barra dice tu nivel de verdad. Al lado de tu reflejo, un momento, hay otro que no se mueve contigo."
      - verbo: buscar
        text: "en el muelle viejo de la orilla"
        skill: investigation
        found: "La pescadora señala con la caña: «Ahí se me enganchó la red. Y ahí se la llevó alguien de Los Molinos, que se le notaba la harina.»"

localidad:
  id: ruinas-torre-tres
  paquete:
    sights:
      - verbo: examinar
        text: "los números grabados en las piedras caídas"
        skill: investigation
        found: "No son niveles: son latidos. La torre contaba los latidos de los heridos, y nada más."
      - verbo: mirar
        text: "el foso de la torre"
        skill: perception
        found: "La torrera canta desde arriba: «Lo que cae al foso, ya no sube.» Abajo hay piedras talladas y una espada de celador."

localidad:
  id: torre-siete
  paquete:
    sights:
      - verbo: contar
        text: "las luces que suben por la escalera de la torre"
        skill: perception
        found: "Siete luces suben cada minuto. Tres se quedan arriba. Las otras cuatro bajan hacia la lonja."
      - verbo: mirar
        text: "la puerta de hierro de la torre"
        skill: investigation
        found: "Tiene un siete en relieve y una cerradura nueva. Por dentro se oye a alguien contar en voz baja: «ciento doce, ciento trece…»."

localidad:
  id: hondonada-gris
  paquete:
    sights:
      - verbo: mirar
        text: "las mantas remendadas de las chozas"
        skill: perception
        found: "Una manta azul tiene un remiendo nuevo, cosido con hilo gris de celador. Alguien viene los jueves."
      - verbo: escuchar
        text: "lo que se dicen los apagados junto al fuego"
        skill: insight
        found: "El elfo les dice sus nombres uno por uno, y ellos los repiten bajito, como quien aprende una canción."

localidad:
  id: torre-cuatro
  paquete:
    sights:
      - verbo: examinar
        text: "el círculo de piedras de la entrada"
        skill: investigation
        found: "Las piedras no tienen números: tienen nombres de mujer. Los de las primeras Cuidadoras."
      - verbo: escuchar
        text: "lo que sube por la escalera de la cripta"
        skill: perception
        found: "Una voz amable, muy lejos, da una lección: «Primero se mira la herida. Luego, a la persona. Nunca el número.»"

localidad:
  id: archivo-hundido
  paquete:
    sights:
      - verbo: leer
        text: "las cajas de pagarés empapados"
        skill: investigation
        found: "Tinta corrida de hace treinta años. En todos, la misma firma de escribano: Teodoro Polilla."
      - verbo: seguir
        text: "la luz de vela que se mueve al fondo"
        skill: perception
        found: "El archivero estornuda entre los estantes: «Perdón, perdón. No se asusten. Solo copio nombres.»"
