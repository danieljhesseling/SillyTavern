# La costa que no duerme — ronda 5: lo que pelea, lo que se lleva y lo que se cuenta

Diecinueve criaturas y gente con la que se pelea, cinco de ellas jefes; veinticuatro objetos y
veintiocho rumores. Las criaturas también traen su `aspecto`, para dibujarlas.

Lo que hay en el agua no se mata: los **desvelados** se devuelven al agua. Por eso su debilidad dice
cómo se les echa (empujarlos al agua honda, hablarles), y por eso tantas peleas se ganan aguantando,
llegando a un sitio o llevándose algo, y no tumbando a todos.

## Las habilidades propias

```yaml
habilidad:
  id: abrazo_del_ahogado
  name: Abrazo del ahogado
  description: 'Te agarra con unos brazos fríos y mojados y tira de ti hacia el agua.'
  cost: action
  resource: at_will
  rangeFeet: 5
  target: enemy
  resolution: attack
  damage: 1d6
  damageType: Bludgeoning
  condition: Restrained
  conditionRounds: 1

habilidad:
  id: gancho_de_estibador
  name: Gancho de estibador
  description: 'Un garfio de cargar sacos, clavado en la ropa, y un tirón seco que te tira al suelo.'
  cost: action
  resource: short_rest
  usesPerRest: 2
  rangeFeet: 5
  target: enemy
  resolution: attack
  damage: 1d6
  damageType: Piercing
  condition: Prone
  conditionRounds: 1

habilidad:
  id: voz_de_la_poza
  name: La voz de la poza
  description: 'Una voz de mucha gente a la vez, desde debajo del agua. Quien la oye se queda helado de miedo.'
  cost: action
  resource: short_rest
  usesPerRest: 1
  rangeFeet: 30
  target: enemy
  resolution: save
  saveAbility: wisdom
  saveDc: 13
  condition: Frightened
  conditionRounds: 1
```

## El bestiario

```yaml
bicho:
  id: desvelado
  nombre: Desvelado
  pg: 22
  ca: 10
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [abrazo_del_ahogado]
  descripcion: 'Un muerto del pueblo que sube del agua. Anda despacio, chorreando, y busca a los vivos para que le hagan compañía.'
  debilidad: 'No se mata: se devuelve al agua. Empújalo al agua honda y no vuelve hasta la otra marea. Si le hablas, se para a escuchar.'
  paquete:
    aspecto: 'Un ahogado de pie, con la piel gris y arrugada del agua, ropa de pescador hecha jirones, algas en el pelo y los ojos blancos abiertos.'

bicho:
  id: ahogado-viejo
  nombre: Ahogado viejo
  pg: 30
  ca: 11
  desafio: 1
  perfil: guardian
  alcance: 5
  habilidades: [abrazo_del_ahogado, hab-aguantar]
  descripcion: 'Uno de los treinta y siete de la galerna. Lleva treinta años despierto y ya no busca a nadie: solo no deja pasar.'
  debilidad: 'Es lento. Rodéalo y empújalo al agua; en tierra firme aguanta mucho.'
  paquete:
    aspecto: 'Un ahogado alto y abotargado, con un chaquetón de hule podrido, percebes pegados a los hombros y una cuerda de barca atada a la cintura.'

bicho:
  id: patron-ahogado
  nombre: El patrón de la galerna
  pg: 72
  ca: 13
  desafio: 4
  perfil: guardian
  alcance: 5
  jefe: true
  habilidades: [abrazo_del_ahogado, hab-gritar, hab-aguantar]
  descripcion: 'El patrón de la barca que salió la primera la noche de la galerna. No quiere dormir: si él duerme, sus hombres se quedan solos.'
  debilidad: 'Mientras le quede alguno de sus hombres en pie, aguanta. Devuelve antes a los suyos al agua.'
  paquete:
    aspecto: 'Un ahogado enorme con gorra de patrón y un chaquetón de botones de latón verdes de óxido, barba blanca llena de algas y un farol apagado colgado del cinto.'

bicho:
  id: brazo-vecina
  nombre: El brazo de la Vecina
  pg: 95
  ca: 14
  desafio: 5
  perfil: guardian
  alcance: 15
  jefe: true
  habilidades: [abrazo_del_ahogado, voz_de_la_poza, hab-empujon]
  descripcion: 'Un brazo pálido y larguísimo que sale de la poza más honda y tantea la roca. No quiere hacer daño: no quiere que nadie se vaya.'
  debilidad: 'No sale de la poza. Quien no se acerca al borde no le llega; quien llega a la pared ya no le importa.'
  paquete:
    aspecto: 'Un brazo enorme, blanco como la cera, con dedos largos como remos y uñas de nácar, que sale de una poza verde y negra.'

bicho:
  id: congrio-poza
  nombre: Congrio de poza
  pg: 13
  ca: 12
  desafio: 0.25
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-esfumarse]
  descripcion: 'Un congrio gordo como un brazo que vive en las pozas de la bajamar. Muerde y se esconde.'
  debilidad: 'Fuera del agua se cansa enseguida. Sácalo a la arena seca.'
  paquete:
    aspecto: 'Un congrio negro y gordo como un brazo, con la boca abierta llena de dientes finos, asomando de una poza entre algas.'

bicho:
  id: congrio-gigante
  nombre: Congrio gigante
  pg: 34
  ca: 13
  desafio: 1
  perfil: aggressive
  alcance: 5
  habilidades: [abrazo_del_ahogado]
  descripcion: 'El congrio más grande que ha visto nadie en la bahía. Las rederas dicen que es el que corta las redes por dentro.'
  debilidad: 'Si lo sacas de su poza, pierde la mitad de la fuerza.'
  paquete:
    aspecto: 'Un congrio gris como un tronco, más largo que una barca, con cicatrices de anzuelos en la cabeza y un ojo blanco.'

bicho:
  id: cangrejo-salmuera
  nombre: Cangrejo de salmuera
  pg: 9
  ca: 13
  desafio: 0.125
  perfil: aggressive
  alcance: 5
  descripcion: 'Cangrejos rojos del tamaño de un perro que viven en las pilas de sal. Comen lo que cae.'
  debilidad: 'Por debajo son blandos. Un golpe que los voltee los deja patas arriba.'
  paquete:
    aspecto: 'Un cangrejo rojo del tamaño de un perro, con el caparazón cubierto de costras de sal blanca y una pinza mucho más grande que la otra.'

bicho:
  id: cangrejo-pecio
  nombre: Cangrejo del pecio
  pg: 26
  ca: 15
  desafio: 1
  perfil: guardian
  alcance: 5
  habilidades: [hab-cubrirse]
  descripcion: 'Un cangrejo viejo y enorme que vive en el casco de la Esperanza. Se mete entre las tablas y no sale.'
  debilidad: 'Su caparazón para casi todo. Dale en las patas, o empújalo al agua honda.'
  paquete:
    aspecto: 'Un cangrejo pardo del tamaño de una mesa, con el caparazón cubierto de percebes y tablas de barco clavadas encima.'

bicho:
  id: anguila-bodega
  nombre: Anguila de la bodega
  pg: 18
  ca: 13
  desafio: 0.5
  perfil: skirmisher
  alcance: 5
  habilidades: [hab-esfumarse]
  descripcion: 'Una morena que vive en la bodega inundada del pecio y muerde a lo que pisa su agua.'
  debilidad: 'No sale del agua. Pisa las tablas secas y no te alcanza.'
  paquete:
    aspecto: 'Una morena verde y moteada, larga como una persona, con la boca abierta y dientes torcidos, asomando de un agujero entre tablas negras.'

bicho:
  id: gaviota-negra
  nombre: Gaviota negra
  pg: 6
  ca: 12
  desafio: 0
  perfil: skirmisher
  alcance: 5
  descripcion: 'Gaviotas grandes y oscuras que anidan en el faro. Desde que la marea no baja, atacan a todo lo que sube.'
  debilidad: 'Se asustan con el fuego y con los gritos.'
  paquete:
    aspecto: 'Una gaviota grande con las plumas grises casi negras, el pico ganchudo y amarillo con una mancha roja, las alas abiertas.'

bicho:
  id: contrabandista
  nombre: Contrabandista de la cala
  pg: 14
  ca: 12
  desafio: 0.5
  perfil: skirmisher
  alcance: 30
  habilidades: [hab-esfumarse, tec-bomba-humo]
  descripcion: 'Gente de Arenales que vive de la cala: aguardiente, tabaco y la sal de la Salazón. Tiran con honda y no quieren morir por la mercancía.'
  debilidad: 'Pelean por dinero. Si el Gallo cae, se rinden o se van.'
  paquete:
    aspecto: 'Hombre de unos treinta, flaco y moreno, capa de hule, pañuelo atado a la cabeza, una honda en la mano y una faca al cinto.'

bicho:
  id: el-gallo
  nombre: El Gallo
  pg: 46
  ca: 14
  desafio: 3
  perfil: aggressive
  alcance: 5
  jefe: true
  habilidades: [hab-burla, hab-embate, hab-ataque-furtivo]
  descripcion: 'El jefe de los contrabandistas de la cala. Canta antes de pelear para que se le oiga desde el acantilado.'
  debilidad: 'Es vanidoso. Una burla o un buen golpe delante de los suyos le hace perder la cabeza y la guardia.'
  paquete:
    aspecto: 'Hombre de unos cuarenta, bajo y musculoso, pelo rojo de punta, chaleco de terciopelo granate robado, dos cuchillos curvos y una pluma de gallo en el sombrero.'

bicho:
  id: hombre-de-lucio
  nombre: Hombre de Lucio
  pg: 12
  ca: 11
  desafio: 0.25
  perfil: aggressive
  alcance: 5
  habilidades: [hab-empujon]
  descripcion: 'Pescadores de Mareaviva que han enterrado a alguien en el agua y quieren que se acabe. Llevan bicheros y remos.'
  debilidad: 'No son soldados. Si cae Lucio, o si les dices algo que les haga dudar, se van a casa.'
  paquete:
    aspecto: 'Pescador de unos cuarenta, rudo y con barba, jersey de lana gris, botas de agua y un bichero de barca en las manos.'

bicho:
  id: lucio-arpon
  nombre: Lucio con el arpón
  pg: 42
  ca: 13
  desafio: 2
  perfil: aggressive
  alcance: 10
  jefe: true
  habilidades: [hab-furia, hab-embate]
  descripcion: 'Lucio Iturbe con el arpón de ballenero que le afiló el herrero. No pelea para ganar: pelea porque no sabe qué otra cosa hacer.'
  debilidad: 'Le pesa el arpón. Si le cansas, o si le hablas de su padre, baja la guardia.'
  paquete:
    aspecto: 'Hombre de treinta y pocos, fuerte, barba descuidada, jersey negro de luto empapado y un arpón de ballenero de hierro más largo que él.'

bicho:
  id: estibador
  nombre: Estibador de la Salazón
  pg: 18
  ca: 12
  desafio: 0.5
  perfil: aggressive
  alcance: 5
  habilidades: [gancho_de_estibador, tec-cerrar-filas]
  descripcion: 'Los mozos de carga de la señora Arrieta. Hacen lo que manda el capataz y cobran por no preguntar.'
  debilidad: 'Sin el capataz, no saben qué hacer.'
  paquete:
    aspecto: 'Hombre joven y ancho de espaldas, camisa sin mangas, delantal de lona manchado de salmuera y un gancho de hierro en la mano.'

bicho:
  id: anton-capataz
  nombre: Antón el capataz
  pg: 58
  ca: 14
  desafio: 3
  perfil: guardian
  alcance: 5
  jefe: true
  habilidades: [gancho_de_estibador, hab-gritar, hab-embate]
  descripcion: 'El capataz de la Salazón, que hace lo que la señora quiere. Le da pánico el agua: a él, que no es del pueblo, el mar sí lo puede ahogar.'
  debilidad: 'Tiene miedo al agua. Si la marea sube o lo acercas al borde, solo piensa en salir.'
  paquete:
    aspecto: 'Hombre de unos cuarenta, alto y ancho, cabeza afeitada, chaleco de cuero sobre camisa blanca empapada y un gancho de estibador en cada mano.'

bicho:
  id: pescador-arenales
  nombre: Pescador de Arenales
  pg: 11
  ca: 11
  desafio: 0.25
  perfil: aggressive
  alcance: 5
  habilidades: [hab-empujon]
  descripcion: 'Pescadores del pueblo de al lado, hartos de enterrar a los suyos mientras en Mareaviva no se ahoga nadie.'
  debilidad: 'Quieren justicia, no sangre. Si les das la razón, bajan los puños.'
  paquete:
    aspecto: 'Hombre de unos treinta y cinco, delgado y quemado por el sol, gorra de lana azul, jersey remendado y un remo partido en las manos.'

bicho:
  id: arponera-arenales
  nombre: Arponera de Arenales
  pg: 16
  ca: 12
  desafio: 0.5
  perfil: skirmisher
  alcance: 30
  habilidades: [hab-disparo-certero]
  descripcion: 'Las mujeres de Arenales tiran el arpón de mano mejor que nadie en la costa.'
  debilidad: 'Tira desde lejos. Si llegas a su lado, suelta el arpón.'
  paquete:
    aspecto: 'Mujer de unos treinta, fuerte y morena, trenza larga, falda remangada sobre pantalón de faena y un haz de arpones cortos a la espalda.'

bicho:
  id: saqueador
  nombre: Saqueador de tumbas
  pg: 11
  ca: 11
  desafio: 0.25
  perfil: coward
  alcance: 5
  habilidades: [hab-esfumarse]
  descripcion: 'Forasteros que han oído que en el cementerio de Mareaviva se entierran cajas cerradas y creen que dentro hay oro.'
  debilidad: 'Son unos cobardes. Si cae uno, los demás echan a correr.'
  paquete:
    aspecto: 'Hombre de unos veinticinco, flaco y sucio, gorra calada, abrigo robado dos tallas grande y una pala de cavar al hombro.'
```

## Los objetos

```yaml
objeto:
  id: farol-de-la-vela
  nombre: Farol de la Vela
  tipo: gear
  rareza: Common
  historia: 'Un farol de aceite con el cristal ahumado que pasa de mano en mano cada noche. Si se apaga en la Vela, mal asunto.'

objeto:
  id: caja-de-don-fermin
  nombre: Caja de Don Fermín
  tipo: gear
  rareza: Rare
  historia: 'Una caja de hojalata con la tapa soldada. Dentro está el diario del cura muerto, con su letra de araña.'

objeto:
  id: cuaderno-del-farero
  nombre: Cuaderno del farero
  tipo: gear
  rareza: Rare
  historia: 'El cuaderno de Martín Goikoa, envuelto en hule. Barcas, mareas y, en la última hoja, las cuatro frases de la pared.'

objeto:
  id: carta-de-marear
  nombre: Carta de marear de Martín
  tipo: gear
  rareza: Uncommon
  historia: 'Un pliego de piel con las rocas de la punta pintadas a mano y un camino marcado en rojo hasta el pecio de la Esperanza.'
  ligado_a: la-carta-de-marear

objeto:
  id: velas-de-la-llamada
  nombre: Velas de la llamada
  tipo: gear
  rareza: Rare
  historia: 'Dos velas gordas como un brazo, de cera negra. Con ellas encendidas en el Bajo, algo contesta desde el agua.'
  ligado_a: la-bajamar

objeto:
  id: arpon-de-ballenero
  nombre: Arpón de ballenero
  tipo: weapon
  rareza: Uncommon
  dados: 1d8
  historia: 'Un arpón de hierro de los de antes, afilado hace poco por Eusebio. Pesa, pero lo que pincha no se suelta.'
  paquete:
    damageType: perforante
    weight: 4

objeto:
  id: gancho-de-estibador
  nombre: Gancho de estibador
  tipo: weapon
  rareza: Common
  dados: 1d4
  historia: 'Un garfio de hierro con mango de madera, para cargar sacos de sal. También sirve para otras cosas.'
  paquete:
    damageType: perforante
    weight: 1

objeto:
  id: cuchillo-de-redera
  nombre: Cuchillo de redera
  tipo: weapon
  rareza: Common
  dados: 1d4
  historia: 'Una hoja corta y curva para cortar nudos. Juana dice que corta mejor que cualquier espada.'
  paquete:
    damageType: cortante
    weight: 0.5

objeto:
  id: bichero
  nombre: Bichero de barca
  tipo: weapon
  rareza: Common
  dados: 1d6
  historia: 'Una vara larga con un gancho de hierro en la punta. Sirve para acercar barcas y para apartar lo que sube del agua.'
  paquete:
    damageType: perforante
    weight: 2

objeto:
  id: chaqueton-de-hule
  nombre: Chaquetón de hule
  tipo: armor
  rareza: Common
  historia: 'Un chaquetón de pescador encerado, tieso como una tabla. No para una cuchillada, pero sí el agua y el frío.'
  paquete:
    weight: 3

objeto:
  id: peto-de-cuero-salado
  nombre: Peto de cuero salado
  tipo: armor
  rareza: Uncommon
  historia: 'Un peto de cuero curtido en salmuera, duro como la madera. Lo llevaban los estibadores de la Salazón.'
  paquete:
    weight: 5

objeto:
  id: rosario-de-conchas
  nombre: Rosario de conchas
  tipo: gear
  rareza: Uncommon
  historia: 'Un rosario de conchas blancas que tallaron las viudas de la galerna. Engracia se lo da a quien vela por sus muertos.'

objeto:
  id: exvoto-esperanza
  nombre: Exvoto de la Esperanza
  tipo: gear
  rareza: Uncommon
  historia: 'Una barca de madera tallada, con «Esperanza» pintado en la proa. Una de las treinta y siete de la ermita.'

objeto:
  id: libro-de-cuentas-salazon
  nombre: Libro de cuentas de la Salazón
  tipo: gear
  rareza: Uncommon
  historia: 'Un libro de tapas de hule con las cuentas de la sal que sale de noche: cuánto, adónde y quién lo cobra.'

objeto:
  id: silbato-de-hueso
  nombre: Silbato de hueso
  tipo: gear
  rareza: Common
  historia: 'El silbato del vigía de la cala. Un silbido largo quiere decir «todo bien»; dos cortos, «corred».'

objeto:
  id: panuelo-azul
  nombre: Pañuelo azul de Remedios
  tipo: gear
  rareza: Common
  historia: 'Un pañuelo azul de mujer, desteñido por el agua. Ciriaco lo encontró una mañana atado al último poste del embarcadero.'

objeto:
  id: anillo-de-joseba
  nombre: Anillo de Joseba
  tipo: gear
  rareza: Common
  historia: 'Un anillo de hombre, de plata gastada. Pilar lo lleva colgado del cuello con un cordón.'

objeto:
  id: sal-sin-marca
  nombre: Saco de sal sin marca
  tipo: gear
  rareza: Common
  historia: 'Un saco de sal gruesa de la Salazón, sin el sello de los Arrieta. Pesa, y en Arenales se paga bien.'
  paquete:
    weight: 10

objeto:
  id: aguardiente-de-la-cala
  nombre: Aguardiente de la cala
  tipo: gear
  rareza: Common
  historia: 'Una botella de aguardiente de contrabando. Quema la garganta y calienta los huesos después de una noche en la Vela.'

objeto:
  id: tabla-de-mareas
  nombre: Tabla de mareas de Bartolo
  tipo: gear
  rareza: Uncommon
  historia: 'Una tabla de madera con las mareas del año grabadas a navaja. La de la bajamar grande lleva una cruz.'

objeto:
  id: llave-de-la-compuerta
  nombre: Llave de la compuerta
  tipo: gear
  rareza: Common
  historia: 'Una llave de hierro grande y oxidada. Abre la compuerta de la Salazón que da al mar.'

objeto:
  id: medalla-de-san-telmo
  nombre: Medalla de San Telmo
  tipo: gear
  rareza: Uncommon
  historia: 'Una medalla de latón con el santo de los marineros. El hermano Julián las guardaba en un cajón: nadie las pedía.'

objeto:
  id: tinta-de-calamar
  nombre: Tinta de calamar
  tipo: gear
  rareza: Rare
  historia: 'Un tarro de tinta negra y espesa que huele a mar. Con esta tinta se pintaron las tres manos nuevas de la pared.'

objeto:
  id: percebes
  nombre: Cesta de percebes
  tipo: gear
  rareza: Common
  historia: 'Percebes de la Boca del Bajo, los mejores de la costa. Bartolo los cobra caros y los da con una sonrisa.'
```

## Los rumores

Cada rumor lo cuenta alguien, o se oye en un sitio. Los que llevan a un sitio escondido son la forma de
encontrarlo sin esperar a la historia.

```yaml
rumor:
  id: r-la-lista-de-la-vela
  dicho_por: maite
  donde: mareaviva
  texto: 'A Ciriaco le ha tocado velar cuatro noches seguidas. Tiene ochenta años y fiebre, y nadie más se apunta.'
  verdad: si

rumor:
  id: r-la-cala
  dicho_por: txomin
  donde: la-ermita
  texto: 'Al sur de la Playa de las Redes, donde las rocas hacen un arco, hay una cala con cueva. Ahí guarda el Gallo lo que vende.'
  verdad: si
  lleva_a: la-cala

rumor:
  id: r-anton-vende-sal
  dicho_por: rufino
  donde: la-cala
  texto: 'El capataz de la Salazón trae sacos de sal a la cala de noche, por la compuerta, y se lleva el dinero sin que lo sepa su señora.'
  verdad: si

rumor:
  id: r-la-galerna
  dicho_por: engracia
  donde: la-ermita
  texto: 'La noche de la galerna salieron veintidós barcas y volvieron siete. Treinta y siete muertos, y ninguno enterrado en tierra.'
  verdad: si

rumor:
  id: r-tres-al-bajo
  dicho_por: bartolo
  donde: la-boca
  texto: 'La primavera después de la galerna entraron cinco personas en el Bajo con la bajamar grande. Salieron cuatro y una niña dormida en brazos.'
  verdad: si

rumor:
  id: r-la-pared
  dicho_por: engracia
  texto: 'Debajo del Bajo hay una cueva con una pared llena de manos pintadas. Las viudas pintaron unas iguales detrás del altar de la ermita, para acordarse.'
  verdad: si
  lleva_a: la-pared

rumor:
  id: r-la-boca
  dicho_por: juana
  texto: 'Con la bajamar grande, al sur de la Salazón asoma un arco de roca negra. Es la Boca del Bajo. Bartolo coge percebes allí.'
  verdad: si
  lleva_a: la-boca

rumor:
  id: r-el-pecio
  dicho_por: nicasio
  donde: el-faro
  texto: 'Con la marea baja se llega andando al pecio de la Esperanza, entre las rocas de la punta. El farero viejo bajaba allí solo.'
  verdad: si
  lleva_a: el-pecio

rumor:
  id: r-sin-entierros
  dicho_por: julian
  donde: mareaviva
  texto: 'En el libro de la iglesia no hay un entierro desde hace treinta años. Bautizos, todos los años.'
  verdad: si

rumor:
  id: r-cajas-de-piedras
  dicho_por: lazaro
  donde: el-cementerio
  texto: 'En el cementerio hay sesenta y una cajas enterradas, y todas llevan piedras dentro. A los muertos de verdad se los lleva el mar.'
  verdad: si

rumor:
  id: r-mateo-en-tierra
  dicho_por: paco
  donde: mareaviva
  texto: 'Lucio Iturbe enterró a su padre en tierra hace nueve días, de noche. Desde entonces la marea no baja.'
  verdad: si

rumor:
  id: r-uxue-firma
  dicho_por: amaia
  donde: mareaviva
  texto: 'La señora Arrieta pregunta mucho por la edad de Uxue. Exacta, al día. ¿Para qué querrá saber eso una vieja rica?'
  verdad: si

rumor:
  id: r-argollas-nuevas
  dicho_por: eusebio
  donde: mareaviva
  texto: 'Este mes me han encargado argollas de hierro para clavar en roca. Iguales que unas que hice hace treinta años para el Bajo.'
  verdad: si

rumor:
  id: r-velas-gordas
  dicho_por: paco
  donde: mareaviva
  texto: 'El capataz de la Salazón se ha llevado dos velas tan gordas como un brazo. Ni para un entierro se gastan velas así.'
  verdad: si

rumor:
  id: r-mano-blanca
  dicho_por: nicasio
  donde: el-faro
  texto: 'La farera tiene la palma de la mano derecha blanca como el papel desde los ocho años. Su padre decía que fue lejía.'
  verdad: a medias

rumor:
  id: r-farero-al-mar
  dicho_por: nicasio
  donde: el-faro
  texto: 'Martín Goikoa, el farero viejo, se metió en el mar una noche de hace doce años y no volvió a salir. Nadie lo buscó.'
  verdad: si

rumor:
  id: r-arenales-ahogados
  dicho_por: martina
  donde: arenales
  texto: 'Nueve pescadores de Arenales ahogados en treinta años. En Mareaviva, al otro lado del cabo, ni uno. Eso no es suerte.'
  verdad: si

rumor:
  id: r-peces-a-la-bahia
  dicho_por: inigo
  donde: arenales
  texto: 'Los bancos de peces se han ido todos a la bahía de Mareaviva. Como si alguien los llevara allí cada mañana.'
  verdad: a medias

rumor:
  id: r-iker
  dicho_por: carmen
  donde: arenales
  texto: 'Mi Iker salió a pescar con un chico de Mareaviva, un Iturbe. Volvió la barca y volvió el chico. Iker, no.'
  verdad: si

rumor:
  id: r-ramiro-paliza
  dicho_por: ramiro
  donde: arenales
  texto: 'Hace siete años hice preguntas en Mareaviva sobre los niños que no se mueren. Me dieron una paliza y una bolsa de dinero para que me fuera.'
  verdad: si

rumor:
  id: r-el-gallo
  dicho_por: inigo
  donde: arenales
  texto: 'El jefe de la cala se hace llamar el Gallo. Canta antes de pelear y nunca pelea solo.'
  verdad: si

rumor:
  id: r-caja-del-cura
  dicho_por: rufino
  donde: la-cala
  texto: 'El Gallo tiene una caja de hojalata que era del cura muerto. Con ella le saca una bolsa de dinero a la señora Arrieta cada mes.'
  verdad: si

rumor:
  id: r-huellas
  dicho_por: juana
  donde: la-playa
  texto: 'Cada amanecer hay huellas de pies descalzos que salen del agua, suben hasta las primeras casas y vuelven a bajar.'
  verdad: si

rumor:
  id: r-redes-cortadas
  dicho_por: juana
  donde: la-playa
  texto: 'Algo corta las redes desde dentro. Yo digo que es un congrio gigante. Los viejos dicen que son ellos, que no quieren quedarse enredados.'
  verdad: a medias

rumor:
  id: r-remedios
  dicho_por: ciriaco
  donde: embarcadero-viejo
  texto: 'Los que suben por los postes no son monstruos. Son los nuestros. Mi Remedios sube cada noche con su pañuelo azul.'
  verdad: si

rumor:
  id: r-sebastian-regalos
  dicho_por: cualquiera
  donde: el-pecio
  texto: 'Alguien deja cosas del pecio en las puertas de las familias de la galerna: un botón, una hebilla, un anzuelo. Nadie sabe quién.'
  verdad: si

rumor:
  id: r-bajamar-grande
  dicho_por: bartolo
  donde: la-boca
  texto: 'Esta bajamar grande baja más que ninguna. Se podrá entrar en el Bajo hasta el fondo, lo que dura una comida, y luego ni una gota de suerte.'
  verdad: si

rumor:
  id: r-la-vecina-sola
  dicho_por: cualquiera
  donde: la-pared
  texto: 'Los viejos dicen que lo que vive en el Bajo no es malo. Que está sola, y que la soledad hace cosas peores que la maldad.'
  verdad: a medias

rumor:
  id: r-anton-miedo
  dicho_por: josune
  donde: la-salazon
  texto: 'El capataz no es de aquí, y le da pánico el agua. A él el mar sí lo puede ahogar. Nunca pisa el muelle.'
  verdad: si
```
