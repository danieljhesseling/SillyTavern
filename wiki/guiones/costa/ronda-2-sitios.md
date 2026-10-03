# La costa que no duerme — ronda 2: las localizaciones

Doce localizaciones: ocho a la vista al empezar y cuatro que se descubren. Cada una tiene gente con
quien hablar, cosas que mirar (dichas por alguien de allí), un rumor o un hito, y un secreto.

Lo que se ve al mirar (`found`) lo dice alguien que está allí, por su oficio si aún no se ha presentado.

```yaml
localidad:
  id: mareaviva
  nombre: Mareaviva
  tipo: village
  descripcion: 'Casas blancas apretadas contra la ladera, redes tendidas en cada balcón y un muelle nuevo de piedra. Huele a sal y a humo de leña, y nadie habla alto.'
  bioma: costa
  faccion: cofradia
  servicios: [posada, tienda, herreria, templo, tablon]
  caminos:
    - { a: embarcadero-viejo, dias: 1 }
    - { a: el-cementerio, dias: 1 }
    - { a: la-ermita, dias: 1 }
    - { a: la-salazon, dias: 1 }
    - { a: el-faro, dias: 1 }
    - { a: arenales, dias: 2 }
  paquete:
    region: La bahía
    places:
      - { kind: posada, name: El Remo Seco, keeper: Maite Ugarte }
      - { kind: plaza, name: La plaza de la Cofradía }
      - { kind: tienda, name: Ultramarinos Zubiri, keeper: Paco Zubiri }
      - { kind: herreria, name: La fragua de Eusebio, keeper: Eusebio Garmendia }
      - { kind: templo, name: La iglesia de San Telmo, description: 'Abierta, limpia y vacía. Nadie viene a misa desde hace cinco años.' }
      - { kind: muelle, name: El muelle nuevo }
      - { kind: tablon, name: El tablón de la Cofradía }
    sights:
      - verbo: leer
        text: la lista de la Vela, en la pared de la posada
        skill: investigation
        place: posada
        found: 'La posadera se seca las manos y señala la lista: «Un nombre por noche, desde hace treinta años. El de esta semana se ha repetido cuatro veces. Ciriaco ya no puede más.»'
      - verbo: mirar
        text: los niños que juegan en el muelle nuevo
        skill: perception
        place: muelle
        found: 'Un pescador que remienda una red te ve mirar: «Saltan al agua desde el muelle con la marea alta. Ninguno sabe nadar mal. Ninguno ha sabido nunca.»'
      - verbo: examinar
        text: el libro de bautizos y entierros de la iglesia
        skill: investigation
        place: templo
        found: 'El hermano que cuida la iglesia pasa las hojas por ti: «Bautizos, todos los años. Entierros, ninguno desde hace treinta. Mirad: la última página de entierros está en blanco.»'

localidad:
  id: embarcadero-viejo
  nombre: El Embarcadero Viejo
  tipo: ruins
  descripcion: 'Un muelle de madera negra que se mete en la bahía sobre postes podridos. Desde la galerna no amarra aquí ninguna barca. En la última tabla hay una silla de enea.'
  bioma: costa
  caminos:
    - { a: la-playa, dias: 1 }
  paquete:
    region: La bahía
    sights:
      - verbo: examinar
        text: las marcas en la madera de los postes
        skill: perception
        found: 'El pescador viejo pasa la uña por los arañazos: «Son de uñas. De abajo arriba. Cada noche llegan un poco más alto.»'
      - verbo: mirar
        text: la silla de enea de la última tabla
        skill: insight
        found: 'El pescador viejo se sienta en ella sin pedir permiso: «Aquí se sienta el que vela. Mira el asiento: está gastado de treinta años de culos que no pegan ojo.»'

localidad:
  id: el-faro
  nombre: El Faro de la Punta
  tipo: outpost
  descripcion: 'Una torre blanca sobre la punta norte, con acantilados a los dos lados. Al pie hay una casa baja, un huerto de coles y un cobertizo de carpintero.'
  bioma: costa
  caminos:
    - { a: el-pecio, dias: 1 }
    - { a: arenales, dias: 2 }
    - { a: el-cementerio, dias: 1 }
  paquete:
    region: La Punta
    sights:
      - verbo: examinar
        text: el cuaderno de barcos de la farera
        skill: investigation
        found: 'El carpintero del cobertizo te ve con el cuaderno: «Cuenta cada barca que entra en la bahía. Treinta años de cuentas. Nunca le ha faltado ni una.»'
      - verbo: mirar
        text: las rocas de la punta con la marea baja
        skill: perception
        found: 'El carpintero señala hacia el mar: «¿Ves ese costillar negro entre las rocas? Es la Esperanza, el barco de la mujer del farero viejo. Con la bajamar se llega andando.»'
      - verbo: examinar
        text: el arcón del farero viejo en el cobertizo
        skill: investigation
        found: 'El carpintero aparta unas tablas: «Ese arcón era de Martín, el farero. La hija no lo abre. Dice que huele a su padre.»'

localidad:
  id: la-salazon
  nombre: La Salazón de los Arrieta
  tipo: outpost
  descripcion: 'Una nave larga de piedra junto al agua, con pilas de salmuera, barriles apilados hasta el techo y una compuerta que da al mar. Huele a sal, a escamas y a dinero.'
  bioma: costa
  faccion: cofradia
  caminos:
    - { a: la-playa, dias: 1 }
    - { a: la-boca, dias: 1 }
  paquete:
    region: El Bajo
    sights:
      - verbo: examinar
        text: los sacos de sal sin marca junto a la compuerta
        skill: investigation
        found: 'Una saladora baja la voz: «Esos sacos no van a ningún pueblo. Salen de noche, por la compuerta, y vuelven las barcas sin ellos.»'
      - verbo: mirar
        text: el retrato de la familia Arrieta en el despacho
        skill: insight
        found: 'La saladora mira el cuadro contigo: «La señora, de joven, con su marido. Él murió en la galerna. Fíjate en la mano de ella: la tiene escondida bajo el chal.»'

localidad:
  id: el-cementerio
  nombre: El Cementerio Viejo
  tipo: ruins
  descripcion: 'Un cementerio en lo alto de la colina, con cruces de hierro torcidas por el viento y una capilla sin puerta. Por un lado, el acantilado cae a pico sobre el mar.'
  bioma: costa
  caminos:
    - { a: la-ermita, dias: 1 }
  paquete:
    region: La colina
    sights:
      - verbo: examinar
        text: las fechas de las cruces
        skill: investigation
        found: 'El enterrador escupe a un lado: «La más nueva es de antes de la galerna. Desde entonces aquí no se entierra a nadie. Bueno. A nadie hasta la semana pasada.»'
      - verbo: buscar
        text: en la tierra removida junto a la capilla
        skill: survival
        found: 'El enterrador se rasca la nuca: «Ahí cavaron de noche, con prisa. Dos palas. Una de ellas era la mía, y no me la pidieron.»'

localidad:
  id: la-ermita
  nombre: La Ermita de los Ahogados
  tipo: sanctuary
  descripcion: 'Una ermita encalada al borde del acantilado del oeste. Dentro, las paredes están cubiertas de exvotos: barcas de madera, trenzas de pelo, retratos pintados de hombres con gorra. Abajo hay una cripta.'
  bioma: costa
  faccion: rezadoras
  servicios: [templo]
  caminos:
    - { a: el-cementerio, dias: 1 }
  paquete:
    region: El acantilado
    sights:
      - verbo: examinar
        text: los exvotos de la galerna
        skill: investigation
        found: 'Una rezadora joven te acerca el candil: «Treinta y siete barcas de madera, una por muerto. Las tallaron las viudas el primer invierno. Faltan nueve: esas se las llevó el mar de la pared.»'
      - verbo: mirar
        text: la pared de detrás del altar
        skill: perception
        found: 'La rezadora joven aparta un paño: «No lo mires mucho. Son manos pintadas, como en el Bajo. Las viudas las pintaron para acordarse de lo que no se puede contar.»'

localidad:
  id: la-playa
  nombre: La Playa de las Redes
  tipo: wilderness
  descripcion: 'Una playa ancha de arena gris donde se tienden las redes a secar entre barcas volcadas. Con la marea baja aparecen pozas y rocas cubiertas de algas.'
  bioma: costa
  caminos:
    - { a: la-salazon, dias: 1 }
    - { a: la-cala, dias: 1 }
  paquete:
    region: La bahía
    sights:
      - verbo: buscar
        text: huellas en la arena al amanecer
        skill: survival
        found: 'La redera no levanta la vista de la aguja: «Pies descalzos. Salen del agua, suben hasta las primeras casas y vuelven a bajar. Todas las mañanas. Yo las borro con la escoba.»'
      - verbo: examinar
        text: los cortes de las redes tendidas
        skill: investigation
        found: 'La redera te enseña un roto: «Fíjate en los hilos. Están cortados desde dentro. Como si algo que se quedó enredado hubiera querido salir.»'

localidad:
  id: arenales
  nombre: Arenales
  tipo: village
  descripcion: 'El pueblo de al lado, pasado el cabo. Casas bajas, un puerto pequeño y un cementerio lleno de cruces nuevas. Aquí el mar se lleva a la gente como en todas partes.'
  bioma: costa
  faccion: arenales
  servicios: [posada, tienda]
  caminos:
    - { a: la-cala, dias: 1, paquete: { opensWith: [{ standing: arenales, min: 1 }], gateNote: 'Los de Arenales saben un atajo por los acantilados hasta la cala, pero a la gente de Mareaviva no se lo enseñan.' } }
  paquete:
    region: Pasado el cabo
    places:
      - { kind: posada, name: La Taberna del Cabo, keeper: Íñigo Basterra }
      - { kind: muelle, name: El puerto de Arenales }
      - { kind: plaza, name: La lonja }
    sights:
      - verbo: examinar
        text: las cruces del cementerio de Arenales
        skill: investigation
        found: 'El tabernero se pone a tu lado: «Nueve pescadores en treinta años. Todos ahogados. Y allí, al otro lado del cabo, ni uno. Dime tú si eso es suerte.»'
      - verbo: mirar
        text: las barcas del puerto
        skill: perception
        found: 'El tabernero señala las barcas: «Viejas, remendadas y medio vacías. Los peces se han ido a la bahía de Mareaviva. Como si alguien los llevara allí.»'

localidad:
  id: la-cala
  nombre: La Cala del Contrabando
  tipo: camp
  descripcion: 'Una cala escondida bajo un arco de roca al sur de la playa, con una cueva al fondo. Hay fardos tapados con lona, una hoguera y un vigía que silba cuando alguien se acerca.'
  bioma: costa
  escondida: true
  paquete:
    region: El Bajo
    sights:
      - verbo: examinar
        text: los fardos tapados con lona
        skill: investigation
        found: 'El vigía de la cala se encoge de hombros: «Aguardiente, tabaco y sal de la Salazón. La sal es lo que más se vende. Pregunta por qué.»'
      - verbo: mirar
        text: el camino que sube por el acantilado
        skill: perception
        found: 'El vigía te ve mirar arriba: «Por ahí se sube a Arenales sin pasar por la playa. Cuidado con el borde: el mar está treinta pies más abajo.»'

localidad:
  id: el-pecio
  nombre: El Pecio de la Esperanza
  tipo: ruins
  descripcion: 'El casco negro de un pesquero varado entre las rocas de la punta, partido por la mitad. Con la bajamar se entra por el boquete del costado; con la pleamar desaparece.'
  bioma: costa
  escondida: true
  paquete:
    region: La Punta
    sights:
      - verbo: examinar
        text: el nombre pintado en la proa
        skill: investigation
        found: 'El raquero rasca la pintura con la navaja: «Esperanza. La patroneaba Itziar Goikoa, la mujer del farero. Se hundió la noche de la galerna con cuatro dentro.»'
      - verbo: buscar
        text: entre las tablas del camarote del patrón
        skill: perception
        found: 'El raquero levanta una tabla suelta: «Aquí escondía el farero sus cosas. Venía en la bajamar, solo, y se sentaba en este camarote a escribir.»'

localidad:
  id: la-boca
  nombre: La Boca del Bajo
  tipo: dungeon
  descripcion: 'La entrada del Bajo: un arco de roca negra que solo sale del agua en la bajamar. Dentro, el suelo está lleno de pozas hondas y huele a algas podridas y a cera.'
  bioma: costa
  escondida: true
  caminos:
    - { a: la-pared, dias: 1 }
  paquete:
    region: El Bajo
    sights:
      - verbo: examinar
        text: las argollas de hierro clavadas en la roca
        skill: investigation
        found: 'El mariscador toca una argolla: «Estas tienen treinta años, de cuando amarraron la barca los que entraron. Y estas otras son nuevas. Alguien ha venido hace poco a preparar algo.»'
      - verbo: mirar
        text: las marcas de la marea en las paredes
        skill: survival
        found: 'El mariscador cuenta las rayas con el dedo: «Hoy baja más que nunca. Tenéis lo que dura una comida antes de que vuelva a subir.»'

localidad:
  id: la-pared
  nombre: La Pared de las Manos
  tipo: dungeon
  descripcion: 'Una cueva enorme bajo el Bajo, con el techo goteando y pozas negras en el suelo. Al fondo hay una pared lisa cubierta de manos pintadas, cientos, de muchos siglos. Tres son más nuevas que las demás.'
  bioma: costa
  escondida: true
  paquete:
    region: El Bajo
    sights:
      - verbo: examinar
        text: las tres manos más nuevas de la pared
        skill: investigation
        found: 'La voz del agua habla desde la poza más honda: «Una mano de mujer que negociaba. Una mano de cura que temblaba. Y una mano de niña. La niña es la que dura.»'
      - verbo: mirar
        text: las manos más viejas, casi borradas
        skill: perception
        found: 'La voz del agua suena cansada: «Otros pueblos. Otros siglos. Todos firmaron, y todos se olvidaron de venir a verme.»'
```
