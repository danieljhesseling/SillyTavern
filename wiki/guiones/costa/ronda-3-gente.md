# La costa que no duerme — ronda 3: la gente

Veinticuatro personas y cinco compañeros. Cada uno con su voz (tápale el nombre y tiene que notarse
quién habla), su oficio (es como se le llama hasta que se presenta), lo que quiere, lo que sabe, lo que
calla y su aspecto para el retrato.

Una línea de ejemplo de cada uno, para oír la voz:

- **Maite** (posadera): «Siéntate, criatura, que de pie se piensa peor.»
- **Jacinto** (patrón mayor): «Nosotros no hablamos de eso. Nosotros pescamos.»
- **Uxue** despierta: «¿Tú sabes nadar mal? Yo no sé. ¿Cómo se hace?» Dormida: «Falta uno.»
- **Amaia** (saladora): «Cierro su puerta con llave cada noche. Y cada mañana está abierta.»
- **Paco** (tendero): «Velas de sebo, de cera, de las gordas. Esta semana se venden como el pan.»
- **Lucio** (pescador): «Mi padre quería tierra. Por mi padre.»
- **Eusebio** (herrero): «¡Pum! Perdona. Es que pienso mejor golpeando.»
- **Ciriaco** (pescador viejo): «Treinta años. Diez mil noches. Y esta, otra.»
- **Nicasio** (carpintero de ribera): «Madera de roble, que la de pino se pudre. Como la gente.»
- **Rosalía** (dueña de la Salazón): «Siéntate, {hijo|hija}. Aquí nadie tiene prisa.»
- **Antón** (capataz): «La señora pregunta por ti. Cuando quieras. Ahora.»
- **Josune** (saladora): «Yo no he dicho nada, ¿eh? Pero te lo digo.»
- **Lázaro** (enterrador): «Piedras. Treinta años cavando para enterrar piedras.»
- **Engracia** (rezadora mayor): «Mi Tomás salió con la galerna. Lo nombro cada noche, para que no se le olvide a nadie.»
- **Pilar** (rezadora joven): «Arrastra el pie izquierdo. Siempre lo arrastró.»
- **Juana** (redera): «La aguja no para, y la lengua tampoco.»
- **Martina** (patrona de Arenales): «Aquí enterramos a nuestros muertos. Con nombre.»
- **Íñigo** (tabernero de Arenales): «¿Mareaviva? Allí se bebe para celebrar. Aquí, para olvidar.»
- **Carmen** (viuda de Arenales): «Iker tenía quince años y nadaba como una piedra.»
- **Ramiro** (antiguo maestro): «Hice preguntas. Las preguntas tienen precio. Lo pagué.»
- **Rufino** (vigía de la cala): «Fiuuu. Ese silbido quiere decir que te he visto.»
- **Sebastián** (raquero): «Lo que el mar suelta, yo lo recojo. Y lo devuelvo, a veces.»
- **Bartolo** (mariscador): «Marea baja, marea alta. Lo demás son cuentos.»
- **La Vecina**: «Tanta gente arriba, y aquí abajo tan sola.»

```yaml
pnj:
  id: maite
  nombre: Maite Ugarte
  oficio: Posadera
  donde: mareaviva
  servicio: posada
  quiere: 'Que la Vela no le vuelva a tocar a ella, y que los forasteros paguen y no pregunten.'
  sabe: 'Quién vela cada noche en el embarcadero viejo: lleva la lista en la pared de la posada.'
  secreto: 'La noche que murió Mateo le tocaba velar a ella, y se quedó dormida en la silla. Cree que todo es culpa suya.'
  voz: 'Habla mientras trabaja, sin mirarte. Llama «criatura» a todo el mundo y suelta refranes a medias.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos cincuenta y cinco, ancha y colorada, pelo gris recogido en un moño con una aguja de red, delantal de cuadros y un trapo siempre al hombro.'

pnj:
  id: jacinto
  nombre: Jacinto Larrañaga
  oficio: Patrón mayor de la Cofradía
  donde: mareaviva
  servicio: tablon
  quiere: 'Que los forasteros se vayan antes de la bajamar grande y que el pueblo siga como está.'
  sabe: 'La costumbre de la Cofradía: los muertos de Mareaviva van al agua, sin excepción.'
  secreto: 'Hace treinta años remó con Mateo Iturbe la barca que llevó a tres personas al Bajo. Nunca lo ha contado.'
  voz: 'Formal y seco. Habla siempre en «nosotros», como si fuera todo el pueblo, y nunca dice «la Vecina».'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de sesenta y tantos, alto y huesudo, bigote blanco cuidado, chaqueta de paño azul con botones de ancla y una gorra de patrón muy limpia.'

pnj:
  id: uxue
  nombre: Uxue Lasarte
  oficio: Niña
  donde: mareaviva
  quiere: 'Dormir una noche entera sin despertarse con los pies mojados.'
  sabe: 'Lo que dice la señora del agua cuando la llama: que está sola y que falta uno.'
  secreto: 'No va dormida del todo cuando camina al mar. Va porque la señora llora y nadie más la oye.'
  voz: 'Despierta: pregunta sin parar y se ríe de todo. Cuando habla la Vecina por ella: despacio, en plural y sin ninguna risa.'
  paquete:
    gender: Mujer
    aspecto: 'Niña de nueve años, flaca y morena, pelo largo y enredado siempre húmedo, camisón blanco con los bajos llenos de arena y los pies descalzos.'

pnj:
  id: amaia
  nombre: Amaia Lasarte
  oficio: Saladora
  donde: mareaviva
  quiere: 'Que su hija duerma en su cama y que nadie de la Salazón se acerque a ella.'
  sabe: 'Que la señora Arrieta le ha preguntado tres veces esta semana por la edad exacta de Uxue.'
  secreto: 'Cierra con llave la puerta de Uxue cada noche, y cada mañana la puerta está abierta y la llave en su sitio.'
  voz: 'Cansada y directa. Frases cortas, y siempre vuelve a su hija.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos treinta, delgada y ojerosa, pañuelo negro en la cabeza, manos agrietadas por la sal y un delantal de lona de la Salazón.'

pnj:
  id: paco
  nombre: Paco Zubiri
  oficio: Tendero
  donde: mareaviva
  servicio: tienda
  quiere: 'Vender, y saber antes que nadie lo que pasa en el pueblo.'
  sabe: 'Quién compra qué. Esta semana, el capataz de la Salazón se llevó dos velas tan gruesas como un brazo.'
  secreto: 'Le vendió a Lucio Iturbe, de noche, la madera para el ataúd de su padre.'
  voz: 'Todo lo vende como si fuera una oferta. Cotillea en voz baja y luego dice que él no ha dicho nada.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos cuarenta y cinco, bajito y con barriga, calvo con cuatro pelos peinados de lado, manguitos negros y un lápiz detrás de la oreja.'

pnj:
  id: lucio
  nombre: Lucio Iturbe
  oficio: Pescador
  donde: mareaviva
  quiere: 'Que su padre descanse en tierra y que el trato se acabe, cueste lo que cueste.'
  sabe: 'Por los papeles de su padre, que el trato dura lo que viva la mano más joven que lo firmó.'
  secreto: 'Cuando sepa de quién es esa mano, piensa matar a quien sea.'
  voz: 'Rabioso y corto. Jura por su padre en cada frase y no aguanta que le miren a los ojos.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de treinta y pocos, fuerte y con la barba descuidada, jersey de lana negro de luto, botas de agua y las manos llenas de tierra seca.'

pnj:
  id: eusebio
  nombre: Eusebio Garmendia
  oficio: Herrero
  donde: mareaviva
  servicio: herreria
  quiere: 'Que le encarguen algo que no sea un anzuelo, para variar.'
  sabe: 'Que hace treinta años forjó unas argollas para clavar en las rocas del Bajo, y que este mes le han encargado otras iguales.'
  secreto: 'Le ha afilado a Lucio un arpón de ballenero. Sabe que no es para pescar.'
  voz: 'Grita sin querer porque está medio sordo, y da un martillazo cada vez que piensa.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos cincuenta, enorme y peludo, barba negra quemada en las puntas, delantal de cuero lleno de agujeros y un martillo siempre en la mano.'

pnj:
  id: ciriaco
  nombre: Ciriaco Etxanobe
  oficio: Pescador viejo
  donde: embarcadero-viejo
  quiere: 'Que otro haga la Vela, aunque sea una noche, para poder dormir.'
  sabe: 'Que los que suben por los postes son los muertos del pueblo, y los reconoce a todos.'
  secreto: 'Su mujer, Remedios, murió hace tres años y se la dieron al agua. Vela todas las noches que puede para hablar con ella.'
  voz: 'Frases muy cortas. Cuenta las noches y le habla al mar como a un vecino.'
  paquete:
    gender: Hombre
    aspecto: 'Anciano de casi ochenta, muy flaco y doblado, cara curtida como cuero viejo, boina calada, bufanda de lana gris y un farol apagado en la mano.'

pnj:
  id: nicasio
  nombre: Nicasio Ibarra
  oficio: Carpintero de ribera
  donde: el-faro
  quiere: 'Terminar la barca que le encargó Martín Goikoa hace doce años, aunque nadie vaya a recogerla.'
  sabe: 'Que el arcón del farero viejo sigue en su cobertizo, y que Martín bajaba solo al pecio de la Esperanza con la bajamar.'
  secreto: 'Vio a Martín meterse en el mar la noche que desapareció, y no le paró.'
  voz: 'Lento y pensativo. Lo compara todo con la madera.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos sesenta, bajo y fuerte, pelo blanco cortado a cepillo, gafas atadas con un cordel, camisa remangada y virutas de madera en la ropa.'

pnj:
  id: rosalia
  nombre: Rosalía Arrieta
  oficio: Dueña de la Salazón
  donde: la-salazon
  quiere: 'Que el trato dure para siempre: que firme una mano más joven antes de que alguien mate a la que lo sostiene.'
  sabe: 'Todo lo que pasó en el Bajo hace treinta años, porque lo negoció ella.'
  secreto: 'Firmó el trato. Fue ella quien ofreció a los muertos del pueblo, y ahora quiere que firme la niña Uxue en la bajamar grande.'
  voz: 'Suave y educada, nunca levanta la voz. Llama «{hijo|hija}» a todo el mundo y ofrece café antes de amenazar.'
  paquete:
    gender: Mujer
    famous: true
    aspecto: 'Mujer de setenta y uno, menuda y muy derecha, pelo blanco recogido, vestido negro de luto antiguo, chal de lana sobre los hombros y la mano derecha siempre enguantada.'

pnj:
  id: anton
  nombre: Antón Iriarte
  oficio: Capataz de la Salazón
  donde: la-salazon
  quiere: 'Que la señora Arrieta le deje la Salazón cuando muera.'
  sabe: 'La fecha de la bajamar grande y lo que la señora piensa hacer allí.'
  secreto: 'No es de Mareaviva: a él el mar sí lo puede ahogar, y le da pánico el agua.'
  voz: 'Pocas palabras y muy educadas, que suenan a amenaza. Nunca dice su opinión: dice «la señora quiere».'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos cuarenta, alto y ancho, cabeza afeitada, chaleco de cuero sobre camisa blanca y un gancho de estibador colgado del cinturón.'

pnj:
  id: josune
  nombre: Josune Aramburu
  oficio: Saladora
  donde: la-salazon
  quiere: 'Ganar lo bastante para irse a la ciudad con su novio, que es de Arenales.'
  sabe: 'Que de la Salazón salen sacos de sal de noche hacia la cala, y que los lleva el capataz.'
  secreto: 'Le pasa recados de la Salazón a los de Arenales a cambio de dinero.'
  voz: 'Cotilla y rápida. Siempre empieza con «yo no he dicho nada» y siempre lo dice todo.'
  paquete:
    gender: Mujer
    aspecto: 'Chica de unos veinte, rubia y pecosa, pañuelo rojo en el pelo, delantal de lona manchado de salmuera y unos pendientes de aro baratos.'

pnj:
  id: lazaro
  nombre: Lázaro Ochoa
  oficio: Enterrador
  donde: el-cementerio
  quiere: 'Volver a enterrar a alguien de verdad antes de morirse, que para eso aprendió el oficio.'
  sabe: 'Que en treinta años ha bajado al cementerio sesenta y una cajas llenas de piedras.'
  secreto: 'Ayudó a Lucio a enterrar a su padre por cinco monedas, y lo haría gratis otra vez.'
  voz: 'Gruñe y se ríe a la vez. Habla de los muertos con cariño y de los vivos con desprecio.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos setenta, encorvado y nervudo, sombrero de ala ancha agujereado, abrigo largo lleno de tierra y una pala al hombro.'

pnj:
  id: engracia
  nombre: Engracia Sarasola
  oficio: Rezadora mayor
  donde: la-ermita
  servicio: templo
  quiere: 'Que sus muertos descansen, aunque eso le cueste al pueblo su suerte.'
  sabe: 'Lo que pasó la noche de la galerna, y que tres personas bajaron al Bajo la primavera siguiente.'
  secreto: 'Sabe quiénes eran los tres, y se lo calla por miedo a Rosalía.'
  voz: 'Lenta y solemne. Nombra a los muertos uno por uno y se santigua al decir «el agua».'
  paquete:
    gender: Mujer
    aspecto: 'Anciana de casi noventa, pequeña y arrugada, toca negra de viuda, rosario de conchas en las manos y unos ojos azules muy claros, casi blancos.'

pnj:
  id: pilar
  nombre: Pilar Azkue
  oficio: Rezadora
  donde: la-ermita
  quiere: 'Que su marido, Joseba, deje de subir por los postes cada noche.'
  sabe: 'Que los desvelados son los muertos del pueblo, y que se les reconoce por cómo andan.'
  secreto: 'Hace dos años firmó, como todas las viudas, que su marido iría al agua. Se arrepiente cada día.'
  voz: 'Habla deprisa y en voz baja, como si alguien escuchara. Siempre acaba hablando de Joseba.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos treinta y cinco, delgada y pálida, pelo negro trenzado, vestido de luto reciente y un anillo de hombre colgado del cuello con un cordón.'

pnj:
  id: juana
  nombre: Juana Lekuona
  oficio: Redera
  donde: la-playa
  quiere: 'Que dejen de aparecerle las redes cortadas por dentro.'
  sabe: 'Que cada amanecer hay huellas de pies descalzos que salen del agua y vuelven a ella.'
  secreto: 'Borra las huellas con la escoba antes de que se despierte el pueblo, para que nadie se asuste.'
  voz: 'Charlatana y alegre aunque cuente cosas horribles. No deja de coser mientras habla.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos sesenta, rechoncha y morena, sombrero de paja roto, falda remangada, una aguja de red enorme en la mano y una sonrisa con un diente de oro.'

pnj:
  id: martina
  nombre: Martina Olazabal
  oficio: Patrona de Arenales
  donde: arenales
  quiere: 'Que el mar trate igual a los dos pueblos, o que Mareaviva pague por su suerte.'
  sabe: 'Cuántos pescadores ha perdido Arenales en treinta años, uno por uno: nueve.'
  secreto: 'Su abuela le contó que en el Bajo se puede firmar un trato. Ha pensado en ir.'
  voz: 'Dura y orgullosa. Cuenta con los dedos a los muertos de Arenales y no perdona.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos cincuenta, alta y fuerte, pelo canoso cortado como un chico, jersey grueso de pescador y una cicatriz que le cruza la ceja.'

pnj:
  id: inigo
  nombre: Íñigo Basterra
  oficio: Tabernero de Arenales
  donde: arenales
  servicio: posada
  quiere: 'Que vuelva la pesca a Arenales y con ella los clientes.'
  sabe: 'Quién entra y sale de la cala, y que el jefe de los contrabandistas se hace llamar el Gallo.'
  secreto: 'Compra el aguardiente de la cala y lo vende como suyo.'
  voz: 'Socarrón y amargo. Todo lo compara con Mareaviva, y siempre sale perdiendo Arenales.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos cuarenta, flaco y narigudo, pelo negro engominado, chaleco de rayas y un trapo de cocina remetido en el cinturón.'

pnj:
  id: carmen
  nombre: Carmen Urrutia
  oficio: Viuda de Arenales
  donde: arenales
  quiere: 'Saber de verdad cómo se ahogó su hijo Iker, hace ocho años.'
  sabe: 'Que Iker salió a pescar con un chico de Mareaviva y volvió solo la barca.'
  secreto: 'Cada domingo deja pan en la puerta de los Iturbe de Mareaviva, sin saber por qué lo hace.'
  voz: 'Muy tranquila y muy triste. Habla de su hijo en presente.'
  paquete:
    gender: Mujer
    aspecto: 'Mujer de unos cincuenta, gruesa y de cara redonda, vestido negro gastado, un chal de punto verde y un pañuelo de hombre bordado con una I.'

pnj:
  id: ramiro
  nombre: Ramiro Agirre
  oficio: Antiguo maestro
  donde: arenales
  quiere: 'Que alguien termine lo que él no se atrevió a terminar.'
  sabe: 'Que hace siete años encontró en Mareaviva los papeles de los nacimientos: desde la galerna, ningún niño ha muerto de nada.'
  secreto: 'Antón le dio una paliza y una bolsa de dinero para que se fuera. Se quedó con las dos cosas.'
  voz: 'Educado y culto, pero bebe y se le traba la lengua. Habla como si diera clase.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos sesenta, flaco y desaliñado, gafas rotas con un cristal pegado, chaqueta de pana con coderas, barba de una semana y una petaca en el bolsillo.'

pnj:
  id: rufino
  nombre: Rufino Goñi
  oficio: Vigía de la cala
  donde: la-cala
  quiere: 'Cobrar su parte y no meterse en líos con lo que hay en el agua.'
  sabe: 'Que la caja de papeles del cura muerto la tiene el Gallo, y que la usa para cobrarle a la señora Arrieta.'
  secreto: 'Está harto del Gallo y vendería la caja a quien le pague el viaje a otra costa.'
  voz: 'Silba antes de hablar y habla en clave de contrabandista, pero se le entiende todo.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos veinticinco, flaco y nervioso, pelo rojo largo atado con una cuerda, capa de hule remendada y un silbato de hueso colgado del cuello.'

pnj:
  id: sebastian
  nombre: Sebastián Mendia
  oficio: Raquero
  donde: el-pecio
  quiere: 'Encontrar en el pecio algo que valga lo bastante para dejar de buscar.'
  sabe: 'Por dónde se entra en la Esperanza con la bajamar y dónde guardaba el farero viejo sus cosas.'
  secreto: 'Lo que saca del pecio no lo vende: lo deja de noche en las puertas de las familias de la galerna.'
  voz: 'Habla con el mar y con los cangrejos más que con la gente. Ríe por la nariz.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos cincuenta, menudo y cetrino, descalzo, pantalón remangado hasta las rodillas, un saco de arpillera a la espalda y una ristra de conchas al cuello.'

pnj:
  id: bartolo
  nombre: Bartolo Unzueta
  oficio: Mariscador
  donde: la-boca
  quiere: 'Coger percebes en paz, sin que nadie le cuente historias del Bajo.'
  sabe: 'Cuándo es la bajamar grande, al día, y por dónde se entra en la Boca sin caer en una poza.'
  secreto: 'Hace treinta años vio entrar a cinco personas en el Bajo y salir a cuatro y una niña dormida en brazos.'
  voz: 'Habla de mareas y de nada más. Cuando algo le da miedo, cambia de tema hacia los percebes.'
  paquete:
    gender: Hombre
    aspecto: 'Hombre de unos setenta, chato y fuerte, piel quemada, gorro de lana rojo, botas altas de goma y un rascador de hierro en la mano.'

pnj:
  id: vecina
  nombre: La Vecina
  oficio: Voz del agua
  donde: la-pared
  quiere: 'Que alguien se quede con ella. No muertos: alguien que hable.'
  sabe: 'Todo lo que se firmó en la pared, y cuántos se le han olvidado de venir a verla en mil años.'
  secreto: 'No pidió muertos. Pidió compañía. Lo de los muertos se lo ofrecieron, y lo aceptó porque estaba muy sola.'
  voz: 'Despacio y en plural, como si fuera mucha gente a la vez. Nunca grita. Hace preguntas de niña.'
  paquete:
    gender: Mujer
    stranger: una voz desde el agua
    aspecto: 'Nadie la ha visto entera: una forma pálida y enorme bajo el agua verde de la poza, dos ojos redondos sin párpados y una mano de dedos larguísimos apoyada en la roca.'
```

## Los compañeros

Cinco compañeros, que se encuentran en la posada como en todas las campañas. Tres tienen su historia
entera (escenas, misión personal y, dos de ellos, romance): **Ane**, **Gorka** y **Begoña**. Los otros
dos, **Julián** y **Txomin**, tienen sus cinco escenas de vínculo. Las escenas, la misión y el romance
van en la ronda 8.

```yaml
confidente:
  id: ane
  nombre: Ane Goikoa
  clase: Explorador
  motivo: vinculo
  arcana: La Estrella
  descripcion: 'La farera de Mareaviva. Cuenta cada barca que entra en la bahía desde hace treinta años, y tiene la palma de la mano derecha blanca como el papel desde que tenía ocho.'
  al_llegar:
    el-faro: 'Ciento cuarenta y dos escalones. Los subo dos veces cada noche. Tú los subirás una, y con eso basta.'
    embarcadero-viejo: 'Aquí me enseñó mi padre a no mirar abajo. No lo consiguió.'
    el-pecio: 'La Esperanza. El barco de mi madre. Mira dónde ha venido a quedarse.'
  paquete:
    id: ane
    gender: Mujer
    initialBondPoints: 0
    aspecto: 'Mujer de treinta y ocho, alta y flaca, pelo negro muy corto lleno de sal, chaquetón de lana gris de su padre dos tallas grande y la palma de la mano derecha blanca como el papel.'

confidente:
  id: gorka
  nombre: Gorka Iturbe
  clase: Soldado
  motivo: vinculo
  arcana: El Carro
  descripcion: 'El pequeño de los Iturbe, braceado, dos años en la milicia de costa. Ha vuelto para el entierro de su padre y no sabe de qué lado ponerse.'
  al_llegar:
    arenales: 'Aquí no me quieren. Y tienen razón, aunque no sepan por qué.'
    el-cementerio: 'Ahí está mi padre. En tierra, como quería. Y mira la que se ha armado.'
    la-playa: 'Aquí aprendí a nadar. O a no ahogarme, que no es lo mismo.'
  paquete:
    id: gorka
    gender: Hombre
    initialBondPoints: 0
    aspecto: 'Hombre de veintitrés, ancho de espaldas y moreno, pelo rizado siempre mojado, jersey de pescador remendado en los codos y una gorra de la milicia de costa descolorida.'

confidente:
  id: begona
  nombre: Begoña Larrea
  clase: Erudito
  motivo: vinculo
  arcana: La Sacerdotisa
  descripcion: 'La maestra de Mareaviva, de ciudad. Lleva seis años en el pueblo, tiene catorce alumnos sanísimos y fue ella quien escribió al gremio.'
  al_llegar:
    la-ermita: 'Treinta y siete barcas de madera. Las conté el primer día. Las cuento cada vez.'
    arenales: 'Aquí vive Don Ramiro, el maestro de antes. O lo que queda de él.'
    la-pared: 'Cientos de manos. Siglos. Y nadie lo escribió nunca. Hasta hoy.'
  paquete:
    id: begona
    gender: Mujer
    initialBondPoints: 0
    aspecto: 'Mujer de treinta y cuatro, bajita, gafas redondas, pelo castaño recogido con un lápiz, abrigo de ciudad con los bajos manchados de barro y un cuaderno siempre bajo el brazo.'

confidente:
  id: julian
  nombre: Hermano Julián
  clase: Clérigo
  motivo: vinculo
  arcana: El Sumo Sacerdote
  descripcion: 'El hermano lego que se quedó cuidando la iglesia cuando murió Don Fermín. Lleva veintitrés llaves al cinto de una iglesia que no visita nadie.'
  al_llegar:
    el-cementerio: 'Sesenta y una cajas. Las he contado al bajarlas. Las cuento al pasar.'
    la-ermita: 'Aquí rezan ellas. Yo rezo en la iglesia, para que alguien lo haga.'
    la-pared: 'Don Fermín puso aquí su mano. Que Dios le perdone. Yo no sé si sabré.'
  paquete:
    id: julian
    gender: Hombre
    initialBondPoints: 0
    aspecto: 'Hombre de cincuenta y tantos, delgado y encorvado, hábito marrón remendado con hilo de red, sandalias con calcetines de lana y un manojo de llaves enorme al cinto.'

confidente:
  id: txomin
  nombre: Txomin Etxeberria
  clase: Pícaro
  motivo: dinero
  arcana: La Luna
  descripcion: 'Contrabandista de Arenales, cuarenta y tantos, cobra hasta los consejos. Trabajó para los de la cala hasta que el Gallo le dejó sin su parte.'
  al_llegar:
    la-cala: 'Mi antigua oficina. No toques nada, {patrón|patrona}, que aquí todo tiene dueño.'
    arenales: 'Mi pueblo. Pobre, feo y con la mitad de las cruces nuevas. Lo quiero igual.'
    la-salazon: 'Aquí se hace la sal que yo vendía. Mejor no saludar a nadie.'
  paquete:
    id: txomin
    gender: Hombre
    initialBondPoints: 0
    aspecto: 'Hombre de cuarenta y tantos, enjuto y moreno, bigote canoso, chaqueta de marinero con los botones cambiados y un aro de oro en una oreja.'
```
