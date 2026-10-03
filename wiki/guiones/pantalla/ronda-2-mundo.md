---
title: El mundo tras la pantalla — ronda 2, los sitios, los rumores, los objetos y los bichos
tags: [pantalla, guion, localizaciones, rumores, bestiario]
created: 2026-10-03
author: DanielJHesseling / Claude Opus 5.5
---

# Ronda 2: el mundo

> Trece localizaciones (diez a la vista, tres que se descubren), veintinueve rumores, veinticuatro objetos, diecisiete bichos y los tres héroes hechos de la tarjeta del tablón.
>
> **Los secretos**, de tres formas: la Hondonada Gris se oye en Brasa (un rumor); el Archivo Hundido, en Cifra (un rumor); la Torre Cuatro la cuenta Sabina (una persona) y la marca un plano de la Ermita (un objeto).

## Las localizaciones

localidad:
  id: brasa
  nombre: Brasa
  tipo: village
  bioma: rural
  servicios: [posada, herreria, tienda, tablon]
  descripcion: "Un pueblo de tejados rojos al borde del Bosque Copiado. En la plaza hay una pared llena de nombres escritos a mano, y en la Posada del Despertar duermen los huéspedes recién llegados."
  caminos:
    - { a: bosque-copiado, dias: 1 }
    - { a: ermita, dias: 1 }
    - { a: molinos, dias: 1 }
    - { a: fielato, dias: 1 }
    - { a: torre-siete, dias: 2, cerrado_hasta: la-oferta }
    - { a: casa-acogida, dias: 1 }

localidad:
  id: casa-acogida
  nombre: La Casa de la Acogida
  tipo: camp
  bioma: rural
  descripcion: "Un caserón de piedra a las afueras de Brasa, con un patio grande y una campanilla en la puerta. Aquí la Acogida da de comer a los recién llegados y guarda la lista de los que deben a Cifra."

localidad:
  id: bosque-copiado
  nombre: El Bosque Copiado
  tipo: wilderness
  bioma: bosque
  descripcion: "Un bosque donde los árboles se repiten: el mismo roble torcido tres veces seguidas, la misma piedra con el mismo musgo. Por aquí llegan los huéspedes."
  caminos:
    - { a: hondonada-gris, dias: 1 }

localidad:
  id: ermita
  nombre: La Ermita de las Cuidadoras
  tipo: sanctuary
  bioma: rural
  servicios: [templo]
  descripcion: "Un claustro de piedra blanca con un huerto de hierbas y una biblioteca pequeña. Aquí se cura sin preguntar el nivel."
  caminos:
    - { a: ruinas-torre-tres, dias: 2 }

localidad:
  id: molinos
  nombre: Los Molinos
  tipo: village
  bioma: rural
  descripcion: "Cuatro molinos de agua sobre un caz rápido y una aldea enharinada. Casi todas las familias deben dinero a la Contaduría."
  caminos:
    - { a: lago-espejo, dias: 1 }

localidad:
  id: fielato
  nombre: El Fielato
  tipo: outpost
  bioma: montaña
  descripcion: "Un puesto de peaje de la Contaduría en el camino de Cifra, colgado sobre un barranco. Se paga según el nivel."
  caminos:
    - { a: cifra, dias: 1 }

localidad:
  id: cifra
  nombre: Cifra
  tipo: city
  bioma: urbano
  servicios: [posada, tienda, tablon]
  descripcion: "La ciudad de la Contaduría: calles de piedra gris, la lonja de niveles en la plaza y, al fondo, la Torre Siete, que se ve desde cualquier esquina."
  caminos:
    - { a: lago-espejo, dias: 1 }
    - { a: ruinas-torre-tres, dias: 1 }
    - { a: torre-siete, dias: 1, cerrado_hasta: la-oferta }
    - { a: archivo-hundido, dias: 1 }

localidad:
  id: lago-espejo
  nombre: El Lago Espejo
  tipo: wilderness
  bioma: costa
  descripcion: "Un lago tan quieto que refleja las barras. El reflejo no enseña los niveles comprados: solo los de verdad."

localidad:
  id: ruinas-torre-tres
  nombre: Las Ruinas de la Torre Tres
  tipo: ruins
  bioma: montaña
  descripcion: "Un muñón de torre partido en dos sobre un foso. Hace cincuenta años, cuando cayó, trescientas personas se acordaron de golpe de alguien."
  caminos:
    - { a: torre-cuatro, dias: 1 }

localidad:
  id: torre-siete
  nombre: La Torre Siete
  tipo: dungeon
  bioma: mazmorra
  descripcion: "La última torre en pie: una aguja de piedra gris con una luz en la cumbre que late como un corazón. Desde ahí se cuentan todas las barras de la comarca."

localidad:
  id: hondonada-gris
  nombre: La Hondonada Gris
  tipo: camp
  bioma: bosque
  escondida: true
  descripcion: "Una hondonada al otro lado del bosque, con chozas de mantas y fuegos pequeños. Aquí viven los apagados: gente con la barra gris a quien ya nadie recuerda."

localidad:
  id: torre-cuatro
  nombre: La Torre Cuatro
  tipo: ruins
  bioma: cripta
  escondida: true
  descripcion: "Una torre que no sale en ningún mapa de la Contaduría: apenas un círculo de piedras y una escalera que baja a una cripta."

localidad:
  id: archivo-hundido
  nombre: El Archivo Hundido
  tipo: dungeon
  bioma: cueva
  escondida: true
  descripcion: "El archivo viejo de la Contaduría, debajo de la lonja. Se inundó hace treinta años y nadie bajó a sacar los papeles."

## Los rumores

rumor:
  id: r-hondonada
  dicho_por: benita
  donde: brasa
  texto: "Los que se apagan acaban en una hondonada al otro lado del Bosque Copiado. Hay quien les lleva pan los jueves."
  verdad: si
  lleva_a: hondonada-gris

rumor:
  id: r-pared-raspada
  dicho_por: benita
  donde: brasa
  texto: "De noche alguien raspa nombres de la Pared de los Nombres. Esta semana han sido tres."
  verdad: si

rumor:
  id: r-pociones-aguadas
  dicho_por: cualquiera
  donde: brasa
  texto: "Las pociones de Fausto dicen «más cinco de vida» en la etiqueta. Mira tu barra cuando te bebas una: sube tres."
  verdad: si

rumor:
  id: r-tomasa-listas
  dicho_por: cualquiera
  donde: brasa
  texto: "La herrera apunta el nivel de cada huésped que entra en su taller. Dicen que manda la lista a Cifra."
  verdad: si

rumor:
  id: r-jonas-comision
  dicho_por: cualquiera
  donde: brasa
  texto: "Jonás Pradera fue el primero que llevó huéspedes a firmar a Cifra. Hace mucho, pero hay quien no se olvida."
  verdad: si

rumor:
  id: r-lista-de-jonas
  dicho_por: cualquiera
  donde: casa-acogida
  texto: "El portavoz de la Acogida lleva una lista con los treinta y un huéspedes de Brasa que deben a Cifra. Dicen que la Contaduría pagaría bien por ella."
  verdad: si

rumor:
  id: r-iker-setas
  dicho_por: remedios
  donde: brasa
  texto: "Iker salía al Bosque Copiado a por setas para la cocina. Siempre por la vereda de los lobos."
  verdad: si

rumor:
  id: r-dos-florianes
  dicho_por: cualquiera
  donde: bosque-copiado
  texto: "En el bosque hay dos leñadores iguales. Uno de los dos no tuvo madre."
  verdad: si

rumor:
  id: r-veredas
  dicho_por: florian
  donde: bosque-copiado
  texto: "Si una vereda te parece conocida, no la sigas: es la copia de otra, y no lleva a ningún sitio."
  verdad: si

rumor:
  id: r-cuarenta-y-tres
  dicho_por: ceniza
  donde: hondonada-gris
  texto: "En la Hondonada viven cuarenta y tres apagados. Casi todos firmaron algo en Cifra."
  verdad: si

rumor:
  id: r-elfos-recuerdan
  dicho_por: arel
  donde: hondonada-gris
  texto: "Los elfos no se olvidan de los apagados: la torre no sabe contarnos bien."
  verdad: si

rumor:
  id: r-primeras-torres
  dicho_por: olvido
  donde: ermita
  texto: "Las siete torres no las levantó la Contaduría. Las levantaron las Cuidadoras, para ver de lejos quién estaba herido."
  verdad: si

rumor:
  id: r-escribir-nombres
  dicho_por: basilio
  donde: ermita
  texto: "Si escribes cada día el nombre de un apagado, se olvida más despacio. No se para, pero se frena."
  verdad: si

rumor:
  id: r-niveles-a-plazos
  dicho_por: fermina
  donde: cifra
  texto: "En la lonja se compran niveles a plazos. Se pagan en monedas o, si no hay monedas, en niveles."
  verdad: si

rumor:
  id: r-archivo-hundido
  dicho_por: amparo
  donde: cifra
  texto: "Debajo de la lonja hay un archivo viejo que se inundó. Dicen que un archivero sigue allí abajo, copiando nombres a la luz de una vela."
  verdad: si
  lleva_a: archivo-hundido

rumor:
  id: r-tallada-nivel
  dicho_por: amparo
  donde: cifra
  texto: "El Contador Mayor tiene nivel doce, pero nadie le ha visto pelear nunca."
  verdad: si

rumor:
  id: r-capitana-jueves
  dicho_por: cualquiera
  donde: cifra
  texto: "La capitana de los celadores sale de Cifra todos los jueves al amanecer, y vuelve con los ojos rojos."
  verdad: si

rumor:
  id: r-pintabarras
  dicho_por: cualquiera
  donde: cifra
  texto: "Hay una media elfa que te pinta la barra para que parezcas de nivel seis. Cobra por número."
  verdad: si

rumor:
  id: r-intereses
  dicho_por: severino
  donde: molinos
  texto: "El cobrador sube la cuenta cada semana, y nunca enseña el papel."
  verdad: si

rumor:
  id: r-rueda-rota
  dicho_por: cualquiera
  donde: molinos
  texto: "El molinero ya no deja a nadie acercarse a la rueda. Dice que está rota. No lo está."
  verdad: si

rumor:
  id: r-lago-verdad
  dicho_por: nuria
  donde: lago-espejo
  texto: "El lago te enseña tu barra de verdad, sin lo comprado. Hay quien llora al mirarse."
  verdad: si

rumor:
  id: r-contador-en-el-lago
  dicho_por: nuria
  donde: lago-espejo
  texto: "Una noche el Contador Mayor vino a mirarse al lago. Se fue corriendo, sin la capa."
  verdad: si

rumor:
  id: r-peaje-doble
  dicho_por: eloy
  donde: fielato
  texto: "Por debajo de nivel tres, el peaje es doble. Por encima de nueve, no se paga."
  verdad: si

rumor:
  id: r-turno-de-noche
  dicho_por: cualquiera
  donde: fielato
  texto: "El sargento de noche deja pasar a los apagados por una moneda. El de la madrugada los devuelve a palos."
  verdad: si

rumor:
  id: r-torre-tres-cayo
  dicho_por: sabina
  donde: ruinas-torre-tres
  texto: "Cuando cayó la Torre Tres, trescientas personas se acordaron de golpe de alguien que habían olvidado."
  verdad: si

rumor:
  id: r-torre-cuatro
  dicho_por: sabina
  texto: "Hay una cuarta torre que no sale en ningún mapa. Mi abuela decía que allí guardó la Primera Cuidadora su cuaderno."
  verdad: si
  lleva_a: torre-cuatro

rumor:
  id: r-la-torre-se-queda
  dicho_por: cornelio
  donde: torre-siete
  texto: "La torre se queda la mitad de lo que se descuenta. La otra mitad va a quien la compra."
  verdad: si

rumor:
  id: r-la-primera-torre
  dicho_por: aurelia
  donde: torre-cuatro
  texto: "La primera torre no medía niveles. Solo decía quién sangraba, y cuánto."
  verdad: si

rumor:
  id: r-hija-del-contador
  dicho_por: teodoro
  donde: archivo-hundido
  texto: "El Contador Mayor tuvo una hija. Se apagó hace veinte años, y él no se acuerda de ella."
  verdad: si

## Los objetos

objeto:
  id: libro-de-descuentos
  nombre: Libro de descuentos
  tipo: gear
  rareza: Rare
  historia: "Un libro de tapas grises con cuatrocientos nombres. Cada uno con su fecha, los niveles que se le quitaron y a quién se vendieron."

objeto:
  id: pagare-de-iker
  nombre: Pagaré de Iker
  tipo: gear
  rareza: Common
  historia: "Contaduría de Cifra. Doscientas monedas prestadas a Iker Mendaña, huésped. Si no hay monedas, se cobran en niveles."
  ligado_a: la-hondonada-gris

objeto:
  id: plano-de-la-primera
  nombre: Plano de la Primera Cuidadora
  tipo: gear
  rareza: Rare
  historia: "Un plano viejo de las torres de la comarca. Marca una cuarta torre que no sale en ningún mapa de la Contaduría."
  ligado_a: el-plano-de-la-primera

objeto:
  id: cuaderno-de-la-primera
  nombre: Cuaderno de la Primera Cuidadora
  tipo: gear
  rareza: Very Rare
  historia: "Cómo se hizo la primera torre, y cómo se le quita todo lo que no sea contar la vida."

objeto:
  id: medallon-de-ainhoa
  nombre: Medallón de Ainhoa
  tipo: gear
  rareza: Rare
  historia: "Un medallón de plata con un nombre grabado por dentro: Ainhoa Tallada. Es la hija del Contador Mayor, y él no se acuerda de ella."

objeto:
  id: llave-de-la-escalera
  nombre: Llave de la escalera
  tipo: gear
  rareza: Uncommon
  historia: "Una llave de hierro con el número siete. La capitana de los celadores te la dejó en la mano sin mirarte."
  ligado_a: rechazar-la-oferta

objeto:
  id: espada-prestada
  nombre: Espada de nivel prestado
  tipo: weapon
  rareza: Uncommon
  dados: 1d8
  historia: "Brilla con un más uno que no es suyo: alguien lo pagó."

objeto:
  id: escudo-de-celador
  nombre: Escudo de celador
  tipo: armor
  rareza: Common
  historia: "Gris, con el sello de la torre. Pesa lo que pesa la ley."

objeto:
  id: peto-de-celador
  nombre: Peto de celador
  tipo: armor
  rareza: Uncommon
  historia: "Cuero gris con botones numerados. A cada botón le falta un número."

objeto:
  id: ballesta-del-fielato
  nombre: Ballesta del fielato
  tipo: weapon
  rareza: Common
  dados: 1d8
  historia: "Tiene grabada la tarifa del peaje en la culata, por si alguien discute."

objeto:
  id: porra-de-cobrador
  nombre: Porra de cobrador
  tipo: weapon
  rareza: Common
  dados: 1d6
  historia: "Corta, de roble, con muescas: una por cada cobro."

objeto:
  id: daga-de-pintabarras
  nombre: Daga de pintabarras
  tipo: weapon
  rareza: Uncommon
  dados: 1d4
  historia: "Fina como un pincel. Tiene pintura azul seca en el mango."

objeto:
  id: martillo-de-la-herrera
  nombre: Martillo de la herrera
  tipo: weapon
  rareza: Uncommon
  dados: 1d8
  historia: "Tomasa lo usa para las espadas de los huéspedes. Dice que pega dos de más."

objeto:
  id: hoz-de-molinero
  nombre: Hoz de molinero
  tipo: weapon
  rareza: Common
  dados: 1d4
  historia: "Enharinada hasta el mango. Corta trigo y cuerdas."

objeto:
  id: arpon-del-lago
  nombre: Arpón del lago
  tipo: weapon
  rareza: Common
  dados: 1d6
  historia: "Hecho con un palo de escoba de otro mundo y una punta de hierro de este."

objeto:
  id: pocion-contada
  nombre: Poción de vida contada
  tipo: gear
  rareza: Common
  historia: "La etiqueta dice «más cinco». La barra dirá la verdad."

objeto:
  id: tinta-de-nombres
  nombre: Tinta de nombres
  tipo: gear
  rareza: Uncommon
  historia: "Tinta de la Ermita. Lo que se escribe con ella tarda un mes en borrarse de la memoria."

objeto:
  id: gafas-de-tasador
  nombre: Gafas de tasador
  tipo: gear
  rareza: Uncommon
  historia: "Cristales verdes que enseñan el nivel de verdad, sin lo comprado."

objeto:
  id: cristal-roto
  nombre: Cristal de cuenta roto
  tipo: gear
  rareza: Uncommon
  historia: "Todavía se ven numeritos dentro, cada vez más quietos."

objeto:
  id: manta-azul
  nombre: Manta azul
  tipo: gear
  rareza: Common
  historia: "La manta de un apagado de la Hondonada. Alguien la remienda todos los jueves."

objeto:
  id: campanilla-de-la-acogida
  nombre: Campanilla de la Acogida
  tipo: gear
  rareza: Common
  historia: "Se toca cuando alguien nuevo sale del bosque, para que no despierte solo."

objeto:
  id: botas-copiadas
  nombre: Botas del Bosque Copiado
  tipo: gear
  rareza: Uncommon
  historia: "Dejan dos huellas por cada paso: una tuya y otra que no."

objeto:
  id: laud-rayado
  nombre: Laúd rayado
  tipo: gear
  rareza: Uncommon
  historia: "Cada raya de la tapa es un nombre que alguien canta todavía."

objeto:
  id: piel-de-la-loba
  nombre: Piel de la loba repetida
  tipo: armor
  rareza: Uncommon
  historia: "Gris y brillante. Si la miras de reojo, parece que hay dos."

## Los bichos

bicho:
  id: lobo-repetido
  nombre: Lobo repetido
  pg: 11
  ca: 13
  desafio: 0.25
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate]
  domable: ""
  descripcion: "Un lobo gris que parpadea: a veces hay dos donde había uno."
  debilidad: "Empújalo al barranco: las copias no saben trepar."

bicho:
  id: la-loba
  nombre: La loba que se repite
  pg: 45
  ca: 13
  desafio: 2
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate, hab-aguantar]
  jefe: true
  domable: ""
  descripcion: "La loba vieja de la que salen todas las copias. Su barra está rota y el número no para de cambiar."
  debilidad: "Sola, sin sus copias, se cansa enseguida."

bicho:
  id: copia-sin-cara
  nombre: Copia sin cara
  pg: 16
  ca: 12
  desafio: 0.5
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-esfumarse]
  descripcion: "Tiene ropa de huésped y forma de persona, pero donde va la cara hay una mancha lisa."
  debilidad: "Se deshace con la luz y con el fuego."

bicho:
  id: cuervo-de-cifras
  nombre: Cuervo de cifras
  pg: 6
  ca: 12
  desafio: 0.125
  perfil: skirmisher
  alcance: 5
  habilidades: [tec-polvo-ojos]
  descripcion: "Arranca números de las barras que brillan y se los lleva al nido."
  debilidad: "Un ruido fuerte los dispersa un momento."

bicho:
  id: celador
  nombre: Celador de la Contaduría
  pg: 16
  ca: 15
  desafio: 0.5
  perfil: guardian
  alcance: 5
  habilidades: [tec-cerrar-filas]
  descripcion: "Uniforme gris con botones numerados y escudo con el sello de la torre."
  debilidad: "Cumple órdenes: sin quien mande, duda."

bicho:
  id: ballestero
  nombre: Ballestero de la Contaduría
  pg: 13
  ca: 13
  desafio: 0.5
  perfil: skirmisher
  alcance: 80
  habilidades: [hab-disparo-certero]
  descripcion: "Celador con ballesta, siempre buscando un sitio alto."
  debilidad: "Cuerpo a cuerpo no vale casi nada."

bicho:
  id: cobrador
  nombre: Cobrador de porra
  pg: 22
  ca: 12
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [hab-empujon, tec-pisoton]
  descripcion: "Cobra lo que se debe y lo que no. Le gusta empujar a la gente contra la pared."
  debilidad: "Si ve que no va a cobrar, se le pasan las ganas."

bicho:
  id: teniente
  nombre: Teniente de la lonja
  pg: 38
  ca: 16
  desafio: 2
  perfil: guardian
  alcance: 5
  habilidades: [tec-embestida, hab-gritar]
  jefe: true
  descripcion: "Manda la guardia de noche de la lonja. Lleva una lista de nombres y la va tachando."
  debilidad: "Si cae su lista, sus celadores no saben a quién buscan."

bicho:
  id: escribano
  nombre: Escribano del descuento
  pg: 18
  ca: 12
  desafio: 1
  perfil: skirmisher
  alcance: 60
  habilidades: [mag-escarcha, hab-sueno]
  descripcion: "Lleva una pluma que brilla y un libro abierto: anota, y te quita."
  debilidad: "Sin su libro en la mano no sabe hacer nada."

bicho:
  id: cristal
  nombre: Cristal de la cuenta
  pg: 12
  ca: 10
  desafio: 0
  perfil: guardian
  alcance: 5
  descripcion: "Un cristal del tamaño de una cabeza, lleno de numeritos que suben. No se mueve, pero chisporrotea si te acercas."
  debilidad: "Se rompe con cualquier golpe fuerte."

bicho:
  id: guardian
  nombre: Guardián de la Torre Tres
  pg: 52
  ca: 15
  desafio: 3
  perfil: guardian
  alcance: 5
  habilidades: [tec-pisoton, tec-embestida]
  jefe: true
  descripcion: "Un gigante de piedra con números grabados en el pecho. Despierta cuando alguien toca el corazón de su torre."
  debilidad: "Pesa demasiado para trepar: si cae al foso, no sube."

bicho:
  id: ahogado
  nombre: Ahogado del espejo
  pg: 13
  ca: 11
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [tec-lazo]
  descripcion: "Tu reflejo, mojado y con los ojos en blanco. Quiere llevarte al fondo del lago."
  debilidad: "Fuera del agua se seca y se agrieta; dentro del agua honda, desaparece."

bicho:
  id: bandido
  nombre: Bandido del camino
  pg: 11
  ca: 12
  desafio: 0.125
  perfil: aggressive
  alcance: 5
  habilidades: [hab-burla]
  descripcion: "Lleva la barra pintada de nivel cinco para asustar. Debajo es un uno."
  debilidad: "Si se le corre la pintura, sale corriendo."

bicho:
  id: sombra
  nombre: Sombra de nivel
  pg: 22
  ca: 13
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [hab-embate]
  descripcion: "Niveles quitados que no encontraron dueño: una forma oscura a la que se le caen los números."
  debilidad: "La luz la deshace más deprisa que el acero."

bicho:
  id: huesped-a-sueldo
  nombre: Huésped a sueldo
  pg: 30
  ca: 15
  desafio: 2
  perfil: aggressive
  alcance: 5
  habilidades: [hab-segundo-aliento, tec-barrido]
  descripcion: "Un huésped que subió a nivel nueve en un mes y ahora vende su espada a la Contaduría."
  debilidad: "Pelea como en un juego de su mundo: siempre al más débil, sin cubrirse."

bicho:
  id: acogido
  nombre: Acogido en armas
  pg: 14
  ca: 12
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [hab-gritar]
  descripcion: "Huéspedes de la Acogida con lo que han podido coger: palas, sartenes, una espada vieja."
  debilidad: "No quieren pelear contigo. Si les hablas, escuchan."

bicho:
  id: contador-mayor
  nombre: El Contador Mayor
  pg: 80
  ca: 15
  desafio: 5
  perfil: skirmisher
  alcance: 60
  habilidades: [mag-relampago, hab-escudo-arcano, mag-cono-escarcha]
  jefe: true
  descripcion: "Leandro Tallada, con su barra de nivel doce. Debajo de los números comprados hay un hombre de nivel dos que tiene miedo."
  debilidad: "Los cristales del corazón le dan los niveles: si se rompen, se le apaga la barra comprada."

## Los héroes hechos

Los mismos de la tarjeta del tablón (`mundos.json`), para entrar sin crear a nadie.

heroe:
  id: kaito
  nombre: Kaito Arenas
  raza: Huésped
  clase: Guerrero
  genero: Hombre
  pasado: forastero
  gancho: Aún no sabe si esto es un juego
  quien: "Hace tres semanas trabajaba en una tienda de otro mundo. Ahora ve su barra de vida flotando sobre la cabeza y le cuesta dormir."

heroe:
  id: lia
  nombre: Lía Sotomonte
  raza: Humano
  clase: Mago
  genero: Mujer
  pasado: erudito
  gancho: Los números ya estaban antes
  quien: "Nació aquí y lleva toda la vida leyendo los números que los huéspedes creen haber traído ellos. Quiere saber quién los puso, y para qué."
  conjuros: [hab-rayo-fuego, mag-luz, hab-escudo-arcano]

heroe:
  id: nerea
  nombre: Nerea Valdés
  raza: Media elfa
  clase: Clérigo
  genero: Mujer
  pasado: acolito
  gancho: Ha visto una barra llegar a cero
  quien: "Cura a los huéspedes que llegan rotos. Ha visto lo que pasa cuando la barra llega a cero, y no se lo ha contado a nadie."
  conjuros: [mag-luz, hab-curar, hab-bendicion]
  mascota: { nombre: Eco, especie: espiritu, caracter: miedosa }
