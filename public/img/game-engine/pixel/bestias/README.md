# Bestias

Criaturas en pixel art para las fichas del tablero y las cartas de enemigo. Están hechas con PixelLab (`create_image_pixflux`) el 2026-09-29, siguiendo la guía de estilo: fantasía oscura, contorno negro y fondo transparente, sin texto.

- **Criaturas de los paquetes** (Strahd, 1387 y el gremio): `<nombre en slug>.png`, de 96×96, de cuerpo entero.
- **Arquetipos del compendio** (`public/compendio/bestiario.json`): `<id>.png`, de 96×96, de cuerpo entero.
- **Plantillas del compendio** (`plantilla-*`): son **emblemas de 64×64, no criaturas**. Una plantilla solo modifica un arquetipo (viejo, rabioso, de la nieve…), así que no tiene cuerpo propio. El bicho que sale de `bestiary.js` guarda `from.arquetipo`, así que su ficha usa la imagen del arquetipo, y el emblema puede ir al lado o encima.
- Ninguna criatura de los paquetes se llama igual que una fila del compendio, así que no hay imágenes compartidas. Algunas se parecen (Lobo gris, Lobo famélico y Lobo alfa frente a `bestia-lobo`; Rata de bodega frente a `bestia-rata`; Zombi de Strahd frente a `bestia-zombi`), pero cada una tiene su propia imagen.

## Strahd (`public/mundos/strahd.pack.json`)

| Archivo | Qué se ve |
|---|---|
| `strahd-von-zarovich.png` | Strahd en su forma de combate: un señor vampiro alto y pálido, con capa negra forrada de carmesí, ojos rojos y la garra en alto |
| `engendro-vampirico.png` | Engendro vampírico: un no-muerto pálido y agazapado, con garras largas, harapos y una capucha rota |
| `lobo-terrible.png` | Lobo terrible: un lobo gris oscuro del tamaño de un oso, de frente, gruñendo y con ojos amarillos |
| `zombi-de-strahd.png` | Zombi de Strahd: un guardia del castillo podrido, con librea carmesí y negra hecha jirones, que avanza con un brazo por delante |
| `bruja-baroviana.png` | Bruja baroviana: una mujer demacrada con túnica oscura y el pelo gris revuelto, con una llama en la mano |
| `hombre-lobo.png` | Hombre lobo: un licántropo marrón y musculoso de pie, con los pantalones rotos y las garras abiertas |
| `saga-nocturna.png` | Saga nocturna: una bruja horrible de piel azul oscuro, con sombrero puntiagudo, encorvada y con garras |
| `gargola.png` | Gárgola: un demonio de piedra gris, con cuernos y alas de murciélago abiertas |
| `revenant.png` | Revenant: un caballero no-muerto con armadura de placas plateada y un emblema en el peto, la cara de calavera y la espada en la mano |
| `kiril-stoyanovich.png` | Kiril Stoyanovich: el jefe de la manada, un hombre lobo enorme de pelo oscuro y taparrabos morado, más corpulento que el hombre lobo normal |
| `baba-lysaga.png` | Baba Lysaga: una vieja flaquísima de pelo blanco y chal gris, con magia verde en la mano |
| `espantapajaros.png` | Espantapájaros: un pelele de saco con capucha y cara cosida, con cuchillos por manos y cuervos alrededor |
| `enjambre-de-insectos.png` | Enjambre de insectos: una nube de moscas negras grandes con alas y ojos verdes |
| `druida-de-yester.png` | Druida de Yester: un hombre descalzo y desgreñado, con harapos marrones y un bastón de rama retorcida |
| `plaga-de-agujas.png` | Plaga de agujas: una figura encorvada de corteza, con una mata de agujas de pino por cabeza |
| `enjambre-de-murcielagos.png` | Enjambre de murciélagos: un racimo de murciélagos negros con ojos rojos |
| `lobo-gris.png` | Lobo gris: un lobo flaco y oscuro visto de lado, acechando |
| `engendro-hambriento.png` | Engendro hambriento: un joven pálido agazapado en el suelo, con camisa sucia y sangre en la boca |

## 1387 (`public/mundos/1387.pack.json`)

| Archivo | Qué se ve |
|---|---|
| `campesino-desesperado.png` | Campesino desesperado: un hombre encapuchado, flaco y aterido, con ropa remendada y una horca oxidada |
| `furtivo-de-los-lobos.png` | Furtivo de los Lobos: un arquero con capucha de piel de lobo sobre cuero, tensando el arco |
| `perro-del-cuervo.png` | Perro del Cuervo: un mercenario barbudo con cota de mallas abollada, espada y escudo redondo |
| `garth-el-sanguinario.png` | Garth el Sanguinario: un sargento calvo y bruto, con cuero y malla y un hacha a dos manos |
| `guardia-de-montesclaros.png` | Guardia de Montesclaros: un guardia bajito con yelmo, armadura, tabardo azul y lanza |
| `alabardero-del-castillo.png` | Alabardero del Castillo: un veterano alto con armadura completa, tabardo azul y una alabarda larga |
| `infanteria-de-keller.png` | Infantería de Keller: un soldado joven con armadura oscura, espada y escudo negro |
| `rompehielos-de-keller.png` | Rompehielos de Keller: un caballero enorme con armadura negra de placas y un martillo de guerra |
| `sombra-el-espia.png` | Sombra, el espía: un asesino encapuchado de gris blanquecino, con la cara tapada y dos dagas largas |
| `lobo-famelico.png` | Lobo famélico: un lobo gris en los huesos, con las costillas marcadas y babeando |
| `ambrosio-el-envenenador.png` | Ambrosio el Envenenador: una figura encapuchada de abrigo oscuro, con frascos al cinto, que alza un matraz de veneno verde |
| `alguacil-torres.png` | Alguacil Torres: un hombre fornido y bigotudo, con cuero tachonado, faja roja y espada corta |
| `capitana-keller.png` | Capitana Keller: una mujer rubia y pálida con armadura negra, capa y pica de acero negro |
| `lord-vane.png` | Lord Vane: un noble demacrado con jubón azul oscuro y espada ropera, en guardia |
| `lobo-alfa.png` | Lobo alfa: un lobo grande de pelo pardo y negro, gruñendo de frente |

## El gremio (`public/mundos/gremio.pack.json`)

| Archivo | Qué se ve |
|---|---|
| `rata-de-bodega.png` | Rata de bodega: una rata marrón gorda como un gato, con dientes amarillos y cola rosa |

## Compendio: arquetipos (`public/compendio/bestiario.json`)

| Archivo | Qué se ve |
|---|---|
| `bestia-lobo.png` | Lobo: un lobo gris de ojos amarillos, avanzando con los dientes fuera |
| `bestia-oso.png` | Oso: un oso pardo de pie, rugiendo con las garras abiertas |
| `bestia-jabali.png` | Jabalí: un jabalí oscuro de colmillos curvos y cerdas de punta |
| `bestia-arana.png` | Araña: una araña gigante negra con marcas rojas y las patas abiertas |
| `bestia-rata.png` | Rata gigante: una rata gris del tamaño de un perro, de lado |
| `bestia-murcielago.png` | Murciélago: un murciélago negro con las alas abiertas y los ojos rojos |
| `bestia-serpiente.png` | Serpiente: una serpiente verde enroscada y erguida, con la lengua fuera |
| `bestia-esqueleto.png` | Esqueleto: un esqueleto amarillento con espada, escudo redondo y capucha rota |
| `bestia-zombi.png` | Zombi: un zombi de piel verde grisácea con ropa de campesino, con los brazos por delante |
| `bestia-ghoul.png` | Ghoul: un no-muerto verdoso y encorvado, con garras largas y la lengua fuera |
| `bestia-espectro.png` | Espectro: un fantasma azul pálido con sudario y capucha, sin piernas y con garras |
| `bestia-trasgo.png` | Trasgo: un trasgo verde de orejas grandes, agachado y con un cuchillo grande |
| `bestia-kobold.png` | Kóbold: un kóbold rojo de cabeza de dragón, con cuernos pequeños, cola y lanza |
| `bestia-ogro.png` | Ogro: un ogro verde y gordo, con taparrabos, una porra y una piedra en la mano |
| `bestia-bandido.png` | Bandido: un bandido encapuchado con la cara medio tapada y una espada corta |
| `bestia-arquero-bandido.png` | Arquero: un arquero de capucha verde tensando un arco largo |
| `bestia-cultista.png` | Cultista: una figura con túnica carmesí y la cara en sombra, con un bastón dorado y fuego en la mano |
| `bestia-golem-barro.png` | Golem de barro: un gólem de barro marrón y grumoso, con ojos ámbar que brillan |
| `bestia-cuervo.png` | Cuervo grande: un cuervo negro con las alas abiertas y el pico abierto |
| `bestia-lagarto.png` | Lagarto de las rocas: un lagarto achaparrado de escamas pétreas, con una cresta de púas |
| `bestia-zorro.png` | Zorro: un zorro rojo agazapado, enseñando los dientes |
| `bestia-halcon.png` | Halcón: un ave rapaz bajando en picado, con las garras por delante |
| `bestia-gato-montes.png` | Gato montés: un gato salvaje leonado, agazapado y bufando |
| `bestia-chaman.png` | Chamán: un chamán con tocado de astas, pieles y collar de huesos, con un bastón de magia verde |
| `bestia-nigromante.png` | Nigromante: un encapuchado de túnica negra y morada, con un bastón de calavera y magia morada |
| `bestia-aprendiz.png` | Aprendiz de mago: un mago joven con túnica y sombrero azules y un libro, con fuego en una mano y escarcha en la otra |

## Compendio: plantillas (emblemas de 64×64)

| Archivo | Qué se ve |
|---|---|
| `plantilla-viejo.png` | Viejo: un reloj de arena casi vacío junto a una garra gris |
| `plantilla-joven.png` | Joven: un brote verde en un montón de tierra |
| `plantilla-rabioso.png` | Rabioso: la cabeza de una bestia con las fauces abiertas |
| `plantilla-sarnoso.png` | Sarnoso: una zarpa pelada con una llaga verde |
| `plantilla-hambriento.png` | Hambriento: un hueso roído |
| `plantilla-alfa.png` | Alfa: una cabeza de lobo en un aro dorado |
| `plantilla-jefe.png` | Jefe: una corona oscura con puntas doradas |
| `plantilla-herido.png` | Herido: una garra vendada con trapos ensangrentados |
| `plantilla-minas.png` | De las minas: un farol y un pico sobre una roca |
| `plantilla-pantano.png` | Del pantano: juncos sobre un charco verde |
| `plantilla-nieve.png` | De la nieve: una huella de zarpa helada, azul y blanca |
| `plantilla-quemado.png` | Quemado: unas garras carbonizadas entre llamas |
| `plantilla-gigante.png` | Gigante: un pie enorme que hunde el suelo |
| `plantilla-enano.png` | Enano: un bicho diminuto que se cuela por una grieta entre piedras |
| `plantilla-sagrado.png` | Marcado: una marca dorada con forma de llama, grabada en un escudo de cuero oscuro |
- `ratero-del-muelle.png` — Ratero del muelle (gremio): un ratero flaco del puerto, con chaqueta de pescador remendada y gorro de lana, un cuchillo curvo y una bolsa robada.
- `bandido-contrabandista.png` — Bandido contrabandista (gremio): jersey rojo de lana, gorro de punto y un garfio de estibador, con una cuerda al hombro.
- `arquero-contrabandista.png` — Arquero contrabandista (gremio): agachado en las rocas con capa encerada de pescador, tensando un arco corto.
- `arana-del-faro.png` — Araña del faro (gremio): una araña negra y gris grande como un perro, de patas largas.
- `bandido-del-camino.png` — Bandido del camino (gremio y la misión de Osric): salteador con capucha y capa parda, la cara tapada y una espada corta mellada.
- `arquero-del-camino.png` — Arquero del camino (gremio): agachado entre la maleza con capucha verde y la cara tapada, con el arco tenso.
- `zombi-ahogado.png` — Zombi ahogado (gremio): un marinero muerto, gris y empapado, con la camisa rota y algas colgando.
- `lobo-de-las-salinas.png` — Lobo de las salinas (gremio): un lobo flaco y oscuro, de patas claras, enseñando los colmillos.
- `cunado-de-lope.png` — Cuñado de Lope (misión personal de Gerd, `compendio/personales.json`): un mozo del molino con camisa de lino, mandil de cuero y un garrote enorme.
- `guarda-del-baron.png` — Guarda del barón (misión personal de Nella, `compendio/personales.json`): casco de hierro, jubón de cuero sobre tabardo verde y lanza corta.

## Los villanos de las historias en tres actos (`compendio/actos.json`, `villanos` de cada trama)

El juego los pone de jefe en el tablero del final (`pack-fill.js`) y, si hablan en una escena, sale este dibujo a falta de retrato. Uno por nombre: `<slug del nombre>.png`.

- `el-hombre-del-farol.png` — El Hombre del Farol (gente que desaparece): un hombre alto y flaco con abrigo negro raído y sombrero de ala ancha, una luz en alto.
- `la-dama-gris.png` — La Dama Gris: una mujer pálida con capucha y vestido de luto grises, un aro de llaves de hierro entre las manos.
- `el-barquero.png` — El Barquero: encorvado, con capucha y harapos mojados, ojos que brillan y un remo largo.
- `la-hilandera.png` — La Hilandera: una vieja con túnica oscura, el huso en la mano e hilo gris colgando de los dedos.
- `el-zorro-de-ceniza.png` — El Zorro de Ceniza (lo que robaron del pueblo): un ladrón con capa gris ceniza, media máscara de zorro, bufanda roja y dos dagas. Es una persona: antes salía con el zorro del bestiario.
- `mano-negra.png` — Mano Negra: un jefe de ladrones calvo y fornido, abrigo largo de cuero, guantes negros y una maza.
- `la-urraca.png` — La Urraca: una ladrona con capa de plumas blancas y negras, joyas robadas al cinto y un cuchillo curvo.
- `siete-llaves.png` — Siete Llaves: un viejo cerrajero de barba blanca, abrigo oscuro y una cadena de llaves de hierro al cuello.
- `la-bestia-blanca.png` — La Bestia Blanca (la bestia que baja de noche): un oso lobo enorme de pelo blanco, ojos rojos y garras negras.
- `la-cosa-del-pozo.png` — La Cosa del Pozo: una criatura verde pálida que asoma de un pozo de piedra, pelo negro mojado y dientes finos.
- `el-devorador-de-rebanos.png` — El Devorador de Rebaños: una bestia jabalí enorme, de colmillos curvos y pelo pardo, con huesos de oveja a los pies.
- `la-boticaria.png` — La Boticaria (el agua envenenada): una boticaria con mandil de cuero manchado que alza un frasco de veneno verde.
- `el-hombre-de-la-sal.png` — El Hombre de la Sal: un hombre flaco con túnica gris, la piel cuarteada y un saco de sal al hombro.
- `el-fraile-verde.png` — El Fraile Verde: un fraile con hábito verde musgo y cordón, un incensario que suelta humo verde.
- `hiel.png` — Hiel: un envenenador encapuchado, de cara azulada, con una daga que gotea veneno verde.
- `el-sin-cara.png` — El Sin Cara (un muerto con muchos enemigos): un asesino de negro con una máscara blanca lisa, sin rasgos, y un cuchillo largo.
- `siete-cuchillos.png` — Siete Cuchillos: un asesino de cuero oscuro con una bandolera de cuchillos al pecho y uno en cada mano.
- `la-viuda-del-puerto.png` — La Viuda del Puerto: una viuda de luto con velo negro y un estilete fino en la mano enguantada.
- `el-cuervo.png` — El Cuervo: un asesino alto con capa de plumas negras y máscara de pico de cuervo, una daga curva.
- `el-coleccionista.png` — El Coleccionista (los que llegaron de fuera): un aristócrata flaco con levita oscura que sostiene un frasco con una luz dentro.
- `la-archivera.png` — La Archivera: una mujer seria con túnica gris y anteojos, un libro grande y una luz en la otra mano.
- `el-hombre-de-los-numeros.png` — El Hombre de los Números: un hombre pálido de túnica negra con un ábaco y dos arcos de luz azul alrededor (sin cifras dibujadas).
- `la-tejedora.png` — La Tejedora: una hechicera pálida de túnica negra con hilos de luz verde colgando de los dedos.

## El enemigo sin dibujo

- `enemigo-sin-dibujo.png` — una sombra encapuchada de capa raída, ojos ámbar y garras, entre humo negro. La lleva en el tablero un enemigo que no tiene dibujo propio ni arquetipo (el jefe que trae una campaña tuya o de tu Gem), en vez de la calavera (`enemyArt` en `pixel-art.js`).
