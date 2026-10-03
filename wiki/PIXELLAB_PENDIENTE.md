# Arte pendiente de PixelLab

Lo que hay que dibujar con PixelLab cuando haya créditos. Ahora no se genera nada: Daniel avisa en el chat cuando haya créditos, y entonces se hacen las entradas de esta lista y se borran de aquí.

Cada entrada dice:

- **Quién o qué**, y de qué campaña.
- **Prompt**: lo que se le pide a PixelLab, sacado de su `aspecto` y de la línea de estilo de la campaña.
- **Tamaño**: retratos 128×160 (busto), iconos 64×64, criaturas 96×96, escenas 320×180; fondo transparente salvo las escenas.
- **Caras** (solo retratos): alegre, enfadado y triste, como `<archivo>--alegre.png`, `--enfadado.png` y `--triste.png`. Ahora el juego enseña todas las caras neutras (`PORTRAIT_MOODS` en `ui/pixel-art.js`), pero se piden igual para más adelante.
- **Dónde va**: la ruta bajo `public/img/game-engine/pixel/`. Después, `node tools/pixel-manifest.mjs`.

Los retratos que faltan de cada campaña los lista `node tools/retratos-pendientes.mjs` (con `--json`, ya con el prompt).

## Retratos

### Furtivo de los Lobos (1387, El valle de Vane)

- **Quién**: los furtivos de Karl el Sordo; habla en las escenas del valle. Está en el bestiario de `public/mundos/1387.pack.json`.
- **Prompt**: `Pixel art bust portrait, 128x160, transparent background, late medieval, earthy realistic palette, no text, no frame. Hombre de unos treinta, flaco y curtido, con barba de varios días y la cara manchada de tierra. Pieles de lobo sobre un peto de cuero endurecido y capucha de piel; un arco corto en la mano.`
- **Tamaño**: 128×160.
- **Caras**: `Same character, same clothes, framing and colors; expression:` + `happy, a warm smile` (alegre), `angry, frowning, jaw clenched` (enfadado), `sad, worried eyes, mouth turned down` (triste).
- **Dónde va**: `public/img/game-engine/pixel/retratos/1387/furtivo-de-los-lobos.png` y sus tres caras al lado.

## El mundo tras la pantalla (pantalla)

Lo que le falta a `public/mundos/pantalla.pack.json` (tanda 20). Estilo de la campaña: isekai luminoso, colores vivos y limpios; los huéspedes llevan algo de nuestro mundo (un chándal, una chaqueta reflectante, una gorra). Las caras de los retratos están apagadas en el juego (D-J61): lo que hace falta es el retrato neutro; si se piden también las caras para más adelante, con las tres frases de arriba y `--alegre`, `--enfadado` y `--triste` al lado de cada archivo.

### Retratos (128×160, fondo transparente)

Prompt: `Pixel art bust portrait, 128x160, transparent background, bright fantasy, clean saturated palette, no text, no frame.` + el aspecto de cada uno.

| Quién | Aspecto (va detrás del prompt) | Dónde va |
| :--- | :--- | :--- |
| Candela Rima (compañero) | Mujer de unos veinticinco, pelo negro rizado con una cinta roja, chaleco bordado de colores y un laúd con la tapa llena de rayas. | `retratos/pantalla/candela-rima.png` |
| Yolanda Ferrán (compañero) | Huésped de unos treinta, morena y fuerte, coleta alta, chaqueta reflectante de ambulancia de otro mundo encima de la cota de malla y una espada al cinto. | `retratos/pantalla/yolanda-ferran.png` |
| Arel Pinoviejo (compañero) | Elfo alto y delgado, de cara joven y ojos muy viejos, capa verde gastada, arco a la espalda y una cuerda larga llena de nudos enrollada al hombro. | `retratos/pantalla/arel-pinoviejo.png` |
| Nieves Aguja (compañero) | Media elfa de unos veinticinco, pelo blanco corto y desigual, ropa oscura con manchas de pintura de colores y un estuche de pinceles finos al cinto. | `retratos/pantalla/nieves-aguja.png` |
| Celso Ruda (compañero) | Hombre joven, de unos veintidós, delgado y pálido, hábito blanco de la Ermita con las mangas remangadas y un cuaderno pequeño atado a la muñeca. | `retratos/pantalla/celso-ruda.png` |
| Remedios Lumbre (posadera) | Mujer de unos sesenta, baja y ancha, delantal de cuadros lleno de harina, el pelo gris recogido con un lápiz y un libro gordo de tapas rojas bajo el brazo. | `retratos/pantalla/remedios-lumbre.png` |
| Tomasa Brezo (herrera) | Mujer de unos cuarenta, brazos enormes y pecosos, mandil de cuero con quemaduras y una tiza detrás de la oreja con la que apunta números en todo. | `retratos/pantalla/tomasa-brezo.png` |
| Fausto Remolino (tendero) | Hombre flaco de unos cincuenta, bigote fino engominado, chaleco de rayas lleno de bolsillos y una sonrisa con un diente de oro. | `retratos/pantalla/fausto-remolino.png` |
| Benita Plumas (escribiente del concejo) | Mujer menuda de unos treinta, gafas redondas, manguitos de tela para no mancharse y los dedos negros de tinta. | `retratos/pantalla/benita-plumas.png` |
| Jonás Pradera (portavoz de la acogida) | Huésped de unos cuarenta y cinco, fuerte y algo barrigón, con un chándal gris de otro mundo remendado con cuero y un silbato colgado al cuello. | `retratos/pantalla/jonas-pradera.png` |
| Florián Leñador (leñador) | Hombre grande de unos treinta y cinco, barba castaña, camisa de cuadros y un hacha al hombro. Mira a los lados como quien busca a alguien igual que él. | `retratos/pantalla/florian-lenador.png` |
| Iker Mendaña (huésped apagado) | Huésped joven y flaco, con un delantal de cocinero manchado y una manta sobre los hombros. Su barra flota encima de la cabeza, gris y apagada. | `retratos/pantalla/iker-mendana.png` |
| Abuela Ceniza (apagada) | Anciana menuda y encorvada, envuelta en mantas de colores, con un cucharón de madera en la mano y la barra gris de los apagados. | `retratos/pantalla/abuela-ceniza.png` |
| Madre Olvido (superiora de las cuidadoras) | Mujer de unos setenta, alta y delgada, hábito blanco de las Cuidadoras con un delantal de huerto encima y una taza humeante siempre en la mano. | `retratos/pantalla/madre-olvido.png` |
| Basilio Manos (enfermero) | Hombre de unos cincuenta, calvo y de brazos fuertes, mandil blanco con las mangas remangadas y una bolsa de vendas a la cintura. | `retratos/pantalla/basilio-manos.png` |
| Leandro Tallada (contador mayor) | Hombre de unos sesenta, delgado y muy erguido, levita gris impecable con botones numerados y un medallón de plata al cuello. Su barra brilla con un doce dorado. | `retratos/pantalla/leandro-tallada.png` |
| Fermina Lacre (escribana de la lonja) | Mujer de unos cincuenta, moño apretado, gafas en la punta de la nariz, chaqueta gris de la Contaduría y un sello de lacre en cada mano. | `retratos/pantalla/fermina-lacre.png` |
| Pelayo Ojeda (tasador) | Hombre rechoncho de unos cuarenta, gafas de cristales verdes y una cinta de medir colgada al cuello como una bufanda. | `retratos/pantalla/pelayo-ojeda.png` |
| Amparo Ribera (posadera) | Mujer de unos cuarenta, redonda y risueña, rizos teñidos de rojo, pendientes grandes y un trapo al hombro. | `retratos/pantalla/amparo-ribera.png` |
| Valeria Cerrojo (capitana de los celadores) | Mujer de unos treinta y cinco, alta y fibrosa, uniforme gris de celador con galones, el pelo rapado por los lados y una cicatriz en la barbilla. | `retratos/pantalla/valeria-cerrojo.png` |
| Severino Muela (molinero) | Hombre de unos cincuenta y cinco, ancho y encorvado, cubierto de harina de la cabeza a las botas, con las cejas blancas de polvo. | `retratos/pantalla/severino-muela.png` |
| Anacleto Pellejo (cobrador de la contaduría) | Hombre flaco y largo de unos cuarenta, sombrero de ala corta, una porra de roble al cinto y un cuaderno de cuentas asomando del bolsillo del pecho. | `retratos/pantalla/anacleto-pellejo.png` |
| Nuria Calado (pescadora) | Huésped de unos treinta, morena de sol, con una gorra de béisbol de otro mundo, botas de agua hasta la rodilla y una caña al hombro. | `retratos/pantalla/nuria-calado.png` |
| Eloy Barrera (sargento del fielato) | Hombre barrigón de unos cincuenta, bigote poblado, casaca gris desabrochada, una ballesta apoyada en el hombro y cara de sueño. | `retratos/pantalla/eloy-barrera.png` |
| Sabina Torrera (torrera) | Mujer de unos setenta, enjuta y morena, pañuelo rojo en la cabeza, falda remangada y un martillo de cantero al cinto. | `retratos/pantalla/sabina-torrera.png` |
| Cornelio Sumas (vigilante de la torre) | Hombre viejo y muy delgado, con ojeras hondas, túnica gris con números bordados y un ábaco pequeño colgado del cinturón. | `retratos/pantalla/cornelio-sumas.png` |
| Eco de Aurelia (eco de la primera cuidadora) | Una mujer de mediana edad hecha de luz azulada, con el hábito de las primeras Cuidadoras y un cuaderno abierto en las manos. Se ve la pared a través de ella. | `retratos/pantalla/eco-de-aurelia.png` |
| Teodoro Polilla (archivero) | Hombre de unos sesenta, encorvado y miope, bata gris con manchas de humedad, una vela en una mano y una pluma detrás de la oreja. | `retratos/pantalla/teodoro-polilla.png` |

### Escenarios (320×180, sin transparencia, vista lateral)

Prompt: `Pixel art side-view landscape, 320x180, bright fantasy, clean saturated palette, no text, no frame.` + lo que se ve. Un fondo por localización.

| Localización | Lo que se ve | Dónde va |
| :--- | :--- | :--- |
| Brasa | Un pueblo de tejados rojos al borde del Bosque Copiado. En la plaza hay una pared llena de nombres escritos a mano, y en la Posada del Despertar duermen los huéspedes recién llegados. | `escenarios/pantalla/brasa.png` |
| El Bosque Copiado | Un bosque donde los árboles se repiten: el mismo roble torcido tres veces seguidas, la misma piedra con el mismo musgo. Por aquí llegan los huéspedes. | `escenarios/pantalla/el-bosque-copiado.png` |
| La Ermita de las Cuidadoras | Un claustro de piedra blanca con un huerto de hierbas y una biblioteca pequeña. Aquí se cura sin preguntar el nivel. | `escenarios/pantalla/la-ermita-de-las-cuidadoras.png` |
| Los Molinos | Cuatro molinos de agua sobre un caz rápido y una aldea enharinada. Casi todas las familias deben dinero a la Contaduría. | `escenarios/pantalla/los-molinos.png` |
| El Fielato | Un puesto de peaje de la Contaduría en el camino de Cifra, colgado sobre un barranco. Se paga según el nivel. | `escenarios/pantalla/el-fielato.png` |
| Cifra | La ciudad de la Contaduría: calles de piedra gris, la lonja de niveles en la plaza y, al fondo, la Torre Siete, que se ve desde cualquier esquina. | `escenarios/pantalla/cifra.png` |
| El Lago Espejo | Un lago tan quieto que refleja las barras. El reflejo no enseña los niveles comprados: solo los de verdad. | `escenarios/pantalla/el-lago-espejo.png` |
| Las Ruinas de la Torre Tres | Un muñón de torre partido en dos sobre un foso. Hace cincuenta años, cuando cayó, trescientas personas se acordaron de golpe de alguien. | `escenarios/pantalla/las-ruinas-de-la-torre-tres.png` |
| La Torre Siete | La última torre en pie: una aguja de piedra gris con una luz en la cumbre que late como un corazón. Desde ahí se cuentan todas las barras de la comarca. | `escenarios/pantalla/la-torre-siete.png` |
| La Hondonada Gris | Una hondonada al otro lado del bosque, con chozas de mantas y fuegos pequeños. Aquí viven los apagados: gente con la barra gris a quien ya nadie recuerda. | `escenarios/pantalla/la-hondonada-gris.png` |
| La Torre Cuatro | Una torre que no sale en ningún mapa de la Contaduría: apenas un círculo de piedras y una escalera que baja a una cripta. | `escenarios/pantalla/la-torre-cuatro.png` |
| El Archivo Hundido | El archivo viejo de la Contaduría, debajo de la lonja. Se inundó hace treinta años y nadie bajó a sacar los papeles. | `escenarios/pantalla/el-archivo-hundido.png` |

### Bichos (96×96, fondo transparente)

Prompt: `Pixel art creature sprite, 96x96, transparent background, full body, facing left, bright fantasy, clean saturated palette, no text, no frame.` + cómo es. Sin el suyo, el juego enseña el dibujo de «enemigo sin dibujo» (el lobo repetido usa el lobo de siempre).

| Bicho | Cómo es | Dónde va |
| :--- | :--- | :--- |
| Lobo repetido | Un lobo gris que parpadea: a veces hay dos donde había uno. | `bestias/lobo-repetido.png` |
| La loba que se repite | La loba vieja de la que salen todas las copias. Su barra está rota y el número no para de cambiar. | `bestias/la-loba-que-se-repite.png` |
| Copia sin cara | Tiene ropa de huésped y forma de persona, pero donde va la cara hay una mancha lisa. | `bestias/copia-sin-cara.png` |
| Cuervo de cifras | Arranca números de las barras que brillan y se los lleva al nido. | `bestias/cuervo-de-cifras.png` |
| Celador de la Contaduría | Uniforme gris con botones numerados y escudo con el sello de la torre. | `bestias/celador-de-la-contaduria.png` |
| Ballestero de la Contaduría | Celador con ballesta, siempre buscando un sitio alto. | `bestias/ballestero-de-la-contaduria.png` |
| Cobrador de porra | Cobra lo que se debe y lo que no. Le gusta empujar a la gente contra la pared. | `bestias/cobrador-de-porra.png` |
| Teniente de la lonja | Manda la guardia de noche de la lonja. Lleva una lista de nombres y la va tachando. | `bestias/teniente-de-la-lonja.png` |
| Escribano del descuento | Lleva una pluma que brilla y un libro abierto: anota, y te quita. | `bestias/escribano-del-descuento.png` |
| Cristal de la cuenta | Un cristal del tamaño de una cabeza, lleno de numeritos que suben. No se mueve, pero chisporrotea si te acercas. | `bestias/cristal-de-la-cuenta.png` |
| Guardián de la Torre Tres | Un gigante de piedra con números grabados en el pecho. Despierta cuando alguien toca el corazón de su torre. | `bestias/guardian-de-la-torre-tres.png` |
| Ahogado del espejo | Tu reflejo, mojado y con los ojos en blanco. Quiere llevarte al fondo del lago. | `bestias/ahogado-del-espejo.png` |
| Sombra de nivel | Niveles quitados que no encontraron dueño: una forma oscura a la que se le caen los números. | `bestias/sombra-de-nivel.png` |
| Huésped a sueldo | Un huésped que subió a nivel nueve en un mes y ahora vende su espada a la Contaduría. | `bestias/huesped-a-sueldo.png` |
| Acogido en armas | Huéspedes de la Acogida con lo que han podido coger: palas, sartenes, una espada vieja. | `bestias/acogido-en-armas.png` |
| El Contador Mayor | Leandro Tallada, con su barra de nivel doce. Debajo de los números comprados hay un hombre de nivel dos que tiene miedo. | `bestias/el-contador-mayor.png` |
| Copia que sigue a Alma | Una copia sin cara con una manta de cuadros igual que la de Alma. | `bestias/copia-que-sigue-a-alma.png` |
| Copia del prado | Una copia sin cara que se acerca cuando suena la radio, con la cabeza ladeada, escuchando. | `bestias/copia-del-prado.png` |

Después de dibujarlos: `node tools/pixel-manifest.mjs`.

## Las tierras del ocaso (ocaso)

Todo lo de la campaña `public/mundos/ocaso.pack.json` (tanda 20, 2026-10-03). Línea de estilo (fantasía épica): `dark fantasy, muted palette with gold accents`. Un reino de montaña a finales de otoño: brezo morado, hayas rojas, piedra gris y la primera nieve.

### Retratos de ocaso (32)

- **Tamaño**: 128×160, fondo transparente.
- **Caras**: `Same character, same clothes, framing and colors; expression:` + `happy, a warm smile` (alegre), `angry, frowning, jaw clenched` (enfadado), `sad, worried eyes, mouth turned down` (triste).
- **Dónde va**: `public/img/game-engine/pixel/retratos/ocaso/<archivo>.png`, y sus tres caras al lado (`--alegre`, `--enfadado`, `--triste`).
- **Prompt**: `Pixel art bust portrait, 128x160, transparent background, dark fantasy, muted palette with gold accents, no text, no frame.` + el aspecto de cada uno.

| Quién | Aspecto (va detrás del prompt) | Dónde va |
| :--- | :--- | :--- |
| Ilvana Hojarrubia (compañero) | Elfa de aspecto joven y siglos a la espalda, alta y delgada, pelo cobrizo trenzado con cuentas de madera, capa de lana rojiza del color de las hayas y un arco largo de madera clara a la espalda. | `retratos/ocaso/ilvana-hojarrubia.png` |
| Ruy Zarzal (compañero) | Semiorco de unos treinta y cinco, enorme y ancho, piel verdosa curtida, colmillos cortos, cabeza rapada con una quemadura en la nuca, jubón de Brezo con el escudo arrancado y un hacha de leñador al hombro. | `retratos/ocaso/ruy-zarzal.png` |
| Gudrun Hondaroca (compañero) | Enana de unos ochenta años, joven para su pueblo, baja y maciza, trenzas castañas recogidas bajo un casco de cuero, delantal de forja sobre la cota de malla y un martillo de culto al cinto. | `retratos/ocaso/gudrun-hondaroca.png` |
| Pía Rueda (compañero) | Gnoma de unos cincuenta, menuda, gafas de latón sobre la frente, chaqueta de cuero llena de bolsillos con reglas y lápices, y las manos manchadas de tinta y de serrín. | `retratos/ocaso/pia-rueda.png` |
| Telmo Avellano (compañero) | Mediano de unos cuarenta, regordete y de mejillas rojas, pelo rizado gris, abrigo de piel de cabra lleno de remiendos y un manojo de ganzúas colgado del cuello como un amuleto. | `retratos/ocaso/telmo-avellano.png` |
| Rufino Albarda (notario del rey) | Mediano de unos sesenta, menudo y calvo, anteojos redondos, toga negra de notario empapada y una pierna entablillada; los dedos manchados de tinta. | `retratos/ocaso/rufino-albarda.png` |
| Brígida Cantueso (posadera) | Mujer de unos cincuenta, alta y huesuda, pelo gris en un moño tirante, delantal de lino con una tiza colgando de un cordel y un trapo al hombro. | `retratos/ocaso/brigida-cantueso.png` |
| Anselmo Rejas (barquero) | Hombre de unos cuarenta, flaco y moreno, barba rala, gorro de lana rojo, camisa remangada y una pértiga de barquero al hombro. | `retratos/ocaso/anselmo-rejas.png` |
| Ottar Brasa (herrero) | Enano de unos ciento veinte años, ancho como un tonel, barba negra quemada en las puntas, mandil de cuero lleno de chispazos y un martillo pequeño al cinto. | `retratos/ocaso/ottar-brasa.png` |
| Herminia Sauce (alcaldesa) | Mujer de unos sesenta, robusta y morena de sol, pañuelo verde en la cabeza, chaleco de lana sobre la camisa y las manos blancas de harina. | `retratos/ocaso/herminia-sauce.png` |
| Pascual Trigo (molinero) | Hombre de unos treinta, delgado y pecoso, pelo rubio despeinado, blusón de molinero enharinado y un lápiz detrás de la oreja. | `retratos/ocaso/pascual-trigo.png` |
| Dámaso Losa (caminero) | Hombre de unos setenta, bajo y nervudo, piel curtida, sombrero de paja roto, chaqueta de pana y un pico de cantero al hombro. | `retratos/ocaso/damaso-losa.png` |
| Tristán Oramar (señor de Casa Oramar) | Hombre de unos treinta, esbelto y bien afeitado, pelo castaño peinado hacia atrás, jubón azul de terciopelo con hilo de plata y un anillo con un sello de barco. | `retratos/ocaso/tristan-oramar.png` |
| Marcos Fullero (prestamista) | Hombre de unos cincuenta, gordo y sonrosado, pelo engominado, ropa negra de buen paño y una cadena de llaves que tintinea a cada paso. | `retratos/ocaso/marcos-fullero.png` |
| Lupe Garbanzo (mercader de sal) | Mediana de unos cuarenta, regordeta y de mejillas coloradas, delantal de cuero manchado de sal, rizos negros bajo una cofia y una balanza pequeña colgada del cinto. | `retratos/ocaso/lupe-garbanzo.png` |
| Madre Orosia (sacerdotisa de la Ribera) | Mujer de unos setenta, menuda y encorvada, hábito pardo del templo de la Ribera, toca blanca y un rosario de cuentas de madera de río. | `retratos/ocaso/madre-orosia.png` |
| Ilduara de Brezo (señora de Casa Brezo) | Mujer de unos cincuenta, delgada y muy erguida, pelo canoso recogido con una peineta de hueso, vestido de luto morado oscuro y un libro de cuentas bajo el brazo. | `retratos/ocaso/ilduara-de-brezo.png` |
| Ordoño Galindo (castellano de Torre Brezo) | Hombre de unos sesenta, grande y cansado, bigote gris caído, cota de malla vieja bajo un tabardo morado de Brezo y un manojo de llaves al cinto. | `retratos/ocaso/ordono-galindo.png` |
| Elvira Breña (pastora) | Mujer de unos treinta y cinco, fuerte y colorada, pelo rojizo trenzado, capa de piel de oveja y un cayado de pastora con la punta de hierro. | `retratos/ocaso/elvira-brena.png` |
| Maelis Cortezaroja (guardiana de las sendas) | Elfa de edad imposible de adivinar, alta y delgadísima, pelo blanco largo hasta la cintura, túnica del color de las hayas en otoño y un bastón tallado con marcas. | `retratos/ocaso/maelis-cortezaroja.png` |
| Dagna Hondaroca (thane de Hondaroca) | Enana de unos doscientos años, baja y muy ancha, trenzas grises recogidas con anillas de hierro, capa de piel de oso sobre una armadura de placas y una cicatriz que le parte el labio. | `retratos/ocaso/dagna-hondaroca.png` |
| Ulfo Piedrafría (archivero del clan) | Enano de unos ciento cincuenta años, flaco para ser enano, barba blanca metida en el cinturón, anteojos de cristal grueso, túnica parda manchada de tinta y un rollo de pergamino en la mano. | `retratos/ocaso/ulfo-piedrafria.png` |
| Berta Cascajo (minera) | Enana de unos noventa años, compacta y musculosa, pelo castaño cortado a cuchillo, ropa de minera cubierta de polvo, marcas de cuerda en las muñecas y un pico al hombro. | `retratos/ocaso/berta-cascajo.png` |
| Fray Odón (ermitaño) | Hombre de unos setenta, flaco y calvo, hábito de lana gris remendado, sandalias con calcetines de lana y una pala pequeña de enterrador colgada del cordón. | `retratos/ocaso/fray-odon.png` |
| Nieves Albar (refugiera) | Mujer de unos cuarenta y cinco, recia y de cara curtida por el viento, pelo negro con mechones blancos, capa de lana gruesa con capucha y guantes de cuero cosidos a mano. | `retratos/ocaso/nieves-albar.png` |
| Ramiro Cuesta (arriero) | Hombre de unos sesenta, enjuto y encorvado, bigote blanco de puntas, sombrero de ala ancha, chaleco de piel de cabra y una vara de arriero. | `retratos/ocaso/ramiro-cuesta.png` |
| Sancho de Brezo (heredero de Casa Brezo) | Hombre de unos veinte, alto y atlético, pelo negro rizado, armadura de placas brillante con un brezo morado pintado en el peto y una capa nueva sin una mancha. | `retratos/ocaso/sancho-de-brezo.png` |
| Bea Ladera (capitana de Oramar) | Mujer de unos treinta y cinco, nervuda, pelo rubio corto, brigantina de cuero con el barco azul de Oramar, una ballesta a la espalda y una pluma de escribiente detrás de la oreja. | `retratos/ocaso/bea-ladera.png` |
| Brokk Pedernal (capitán de Hondaroca) | Enano de unos ciento treinta años, bajo y macizo, barba roja recogida en dos trenzas, casco con nasal, hacha de batalla y un escudo con el yunque de Hondaroca. | `retratos/ocaso/brokk-pedernal.png` |
| Bermudo Lanzagrís (capitán del Cierzo) | Hombre de unos cuarenta y cinco, alto y apuesto, barba gris recortada con cuidado, capa gris de buen paño sobre una armadura negra y una sonrisa de dientes perfectos. | `retratos/ocaso/bermudo-lanzagris.png` |
| Caelan Hojarrubia (guía a sueldo) | Elfo de aspecto joven, flaco y anguloso, pelo cobrizo corto y mal cortado, capa raída del color de las hayas y una bolsa de monedas atada al cuello. | `retratos/ocaso/caelan-hojarrubia.png` |
| Mencía Tostado (cocinera del Cierzo) | Mujer de unos cuarenta y cinco, ancha y colorada, brazos fuertes, mandil grasiento sobre una capa gris del Cierzo y un cucharón de hierro colgado del cinto. | `retratos/ocaso/mencia-tostado.png` |

### Escenarios de ocaso (13)

- **Tamaño**: 320×180, sin transparencia, vista lateral.
- **Dónde va**: `public/img/game-engine/pixel/escenarios/ocaso/<archivo>.png` (y un README como el de `escenarios/1387/`).
- **Prompt**: `Pixel art background, 320x180, side view, no text, no frame, dark fantasy, muted palette with gold accents, late autumn mountain kingdom.` + lo que se ve.

| Localización | Lo que se ve | Dónde va |
| :--- | :--- | :--- |
| Tres Mojones | Un cruce de caminos de otoño: una posada de piedra con tejado de pizarra, una herrería con humo y un puente de madera partido por la mitad sobre un río crecido, con un carro colgando en el hueco. | `escenarios/ocaso/tres-mojones.png` |
| Los Sauces | Una aldea de molineros entre sauces junto a un río: un molino de agua con la rueda girando, sacos de grano apilados en una era y casas bajas de adobe. | `escenarios/ocaso/los-sauces.png` |
| La Calzada Rota | Una calzada vieja empedrada que se hunde al borde de un barranco, con mojones de piedra caídos, zarzas en la cuneta y montañas al fondo. | `escenarios/ocaso/la-calzada-rota.png` |
| Vadoancho | Una ciudad de río con muelles llenos de barcos amarrados de velas azules, almacenes de sal, una esclusa de piedra y una casa con una puerta enorme de hierro. | `escenarios/ocaso/vadoancho.png` |
| Torre Brezo | Una torre cuadrada de piedra gris sobre un brezal morado, con un estandarte morado, un patio de armas embarrado y un granero medio vacío. | `escenarios/ocaso/torre-brezo.png` |
| Las Hayas Rojas | Un hayedo en la ladera con las hojas rojas como el fuego, piedras talladas con marcas élficas entre las raíces y luz dorada de tarde. | `escenarios/ocaso/las-hayas-rojas.png` |
| Las Forjas de Hondaroca | Una ciudad enana excavada en el flanco de una montaña: una puerta grande de hierro con rejas, chimeneas de forja encendidas y escaleras de piedra. | `escenarios/ocaso/las-forjas-de-hondaroca.png` |
| La Boca del Grajo | La boca de una mina vieja en la ladera, apuntalada con vigas, con las paredes cubiertas de un hielo azul que brilla y grajos posados en las vigas. | `escenarios/ocaso/la-boca-del-grajo.png` |
| La Ermita del Collado | Una ermita pequeña de piedra en un collado de montaña, con un cementerio de lápidas enanas detrás y la primera nieve en el suelo. | `escenarios/ocaso/la-ermita-del-collado.png` |
| El Campamento del Cierzo | Una empalizada de troncos bajo un collado, con tiendas grises de mercenarios, estandartes grises y el humo de muchas hogueras entre pinos. | `escenarios/ocaso/el-campamento-del-cierzo.png` |
| El Refugio de la Cabra | Una casa de piedra con corral y una campana en la puerta, en lo alto de un puerto nevado, rodeada de tiendas moradas, azules y gris acero. | `escenarios/ocaso/el-refugio-de-la-cabra.png` |
| La Atalaya de la Grulla | Una fortaleza enana de piedra que cierra un paso de montaña nevado, con una puerta de hierro, un patio helado y un fanal apagado en lo alto de la torre; una bandera gris ondea en la muralla. | `escenarios/ocaso/la-atalaya-de-la-grulla.png` |
| Las Sendas Viejas | Un sendero estrecho por una ladera boscosa, marcado con piedras talladas que señalan la siguiente, entre hayas rojas y rocas, con el paso nevado al fondo. | `escenarios/ocaso/las-sendas-viejas.png` |

### Criaturas de ocaso (23)

- **Tamaño**: 96×96, cuerpo entero, fondo transparente, contorno negro.
- **Dónde va**: `public/img/game-engine/pixel/bestias/<archivo>.png`. Las tres últimas son de las misiones personales de Ilvana, Ruy y Gudrun. Sin el suyo, el juego enseña «enemigo sin dibujo».
- **Prompt**: `Pixel art creature sprite, 96x96, full body, transparent background, dark fantasy, black outline, no text, no frame.` + cómo es.

| Bicho | Cómo es | Dónde va |
| :--- | :--- | :--- |
| Mercenario del Cierzo | Un mercenario con capa gris, cota de malla y espada corta, de pie y en guardia. | `bestias/mercenario-del-cierzo.png` |
| Ballestero del Cierzo | Un ballestero con capa gris, una ballesta pesada apuntando y un pavés a la espalda. | `bestias/ballestero-del-cierzo.png` |
| Cabo del Cierzo | Un veterano con capa gris y armadura de placas gastada, un silbato de hueso al cuello y una espada. | `bestias/cabo-del-cierzo.png` |
| Tamborilero del Cierzo | Un chaval flaco con una capa gris demasiado grande, tocando un tambor de guerra. | `bestias/tamborilero-del-cierzo.png` |
| La Tuerta, sargento del Cierzo | Una sargento con un parche de cuero en el ojo izquierdo, capa gris y dos cuchillos largos; un mapa enrollado al cinto. | `bestias/la-tuerta-sargento-del-cierzo.png` |
| El capitán del Cierzo | Un capitán alto y apuesto de barba gris recortada, armadura negra, capa gris de buen paño y espada de mano y media. | `bestias/el-capitan-del-cierzo.png` |
| Guardián de hierro | Una armadura enana hueca y enorme, movida por runas azules que brillan en las juntas, con un martillo de piedra. | `bestias/guardian-de-hierro.png` |
| Huargo | Un lobo enorme del tamaño de un poni, de pelo blanco escarchado, gruñendo. | `bestias/huargo.png` |
| Loba blanca | Una loba gigante blanca como la nieve, con una cicatriz en el hocico, aullando. | `bestias/loba-blanca.png` |
| Trasgo de la mina | Un trasgo pequeño, verde y rápido, con un pico de minero robado. | `bestias/trasgo-de-la-mina.png` |
| Chamán trasgo | Un trasgo viejo cubierto de pieles y huesos, con un bastón que echa escarcha azul. | `bestias/chaman-trasgo.png` |
| Tótem de hielo | Un poste de huesos atados y hielo azul, con un cráneo arriba que escupe escarcha. | `bestias/totem-de-hielo.png` |
| Oso de las Sendas | Un oso pardo enorme y flaco, de pie sobre las patas traseras. | `bestias/oso-de-las-sendas.png` |
| Matón de Fullero | Un matón grande con garrote, ropa negra de criado y cara de pocos amigos. | `bestias/maton-de-fullero.png` |
| Contrabandista de la esclusa | Un contrabandista con un saco de sal a la espalda y una honda en la mano. | `bestias/contrabandista-de-la-esclusa.png` |
| Patrón de la esclusa | El jefe de los contrabandistas, robusto, con un garfio en lugar de mano izquierda y un frasco de aceite encendido. | `bestias/patron-de-la-esclusa.png` |
| Saqueador de tumbas | Un saqueador flaco y encorvado, con una pala y un saco vacío. | `bestias/saqueador-de-tumbas.png` |
| Cabecilla de saqueadores | Un cabecilla de saqueadores con capucha, una daga y una bolsa de polvo en la mano. | `bestias/cabecilla-de-saqueadores.png` |
| Desertor de Brezo | Un soldado demacrado con el tabardo morado de Brezo roto, lanza y escudo abollado. | `bestias/desertor-de-brezo.png` |
| Ladrón de grano | Un campesino flaco y hambriento con un saco vacío y un palo. | `bestias/ladron-de-grano.png` |
| Batidor del Cierzo | Un explorador ligero con capa gris corta, arco corto y botas de montaña. | `bestias/batidor-del-cierzo.png` |
| Soldado de Brezo | Un soldado con lanza, cota de malla y capa morada de Brezo. | `bestias/soldado-de-brezo.png` |
| Guardia de Fullero | Un guardia de noche con porra y farol, vestido de negro. | `bestias/guardia-de-fullero.png` |

Después de dibujarlos: `node tools/pixel-manifest.mjs`.

## La costa que no duerme (costa)

Lo que le falta a `public/mundos/costa.pack.json` (tanda 20). Estilo de la campaña: terror, una costa del norte con niebla, sal y madera negra; colores fríos y apagados. Las caras de los retratos están apagadas en el juego (D-J61): lo que hace falta es el retrato neutro; si se piden también las caras para más adelante, con las tres frases de arriba y `--alegre`, `--enfadado` y `--triste` al lado de cada archivo.

### Retratos (128×160, fondo transparente): 29

Prompt: `Pixel art bust portrait, 128x160, transparent background, gothic horror, cold desaturated palette, no text, no frame.` + el aspecto de cada uno.

| Quién | Aspecto (va detrás del prompt) | Dónde va |
| :--- | :--- | :--- |
| Ane Goikoa (compañero) | Mujer de treinta y ocho, alta y flaca, pelo negro muy corto lleno de sal, chaquetón de lana gris de su padre dos tallas grande y la palma de la mano derecha blanca como el papel. | `retratos/costa/ane-goikoa.png` |
| Gorka Iturbe (compañero) | Hombre de veintitrés, ancho de espaldas y moreno, pelo rizado siempre mojado, jersey de pescador remendado en los codos y una gorra de la milicia de costa descolorida. | `retratos/costa/gorka-iturbe.png` |
| Begoña Larrea (compañero) | Mujer de treinta y cuatro, bajita, gafas redondas, pelo castaño recogido con un lápiz, abrigo de ciudad con los bajos manchados de barro y un cuaderno siempre bajo el brazo. | `retratos/costa/begona-larrea.png` |
| Hermano Julián (compañero) | Hombre de cincuenta y tantos, delgado y encorvado, hábito marrón remendado con hilo de red, sandalias con calcetines de lana y un manojo de llaves enorme al cinto. | `retratos/costa/hermano-julian.png` |
| Txomin Etxeberria (compañero) | Hombre de cuarenta y tantos, enjuto y moreno, bigote canoso, chaqueta de marinero con los botones cambiados y un aro de oro en una oreja. | `retratos/costa/txomin-etxeberria.png` |
| Maite Ugarte (posadera) | Mujer de unos cincuenta y cinco, ancha y colorada, pelo gris recogido en un moño con una aguja de red, delantal de cuadros y un trapo siempre al hombro. | `retratos/costa/maite-ugarte.png` |
| Jacinto Larrañaga (patrón mayor de la Cofradía) | Hombre de sesenta y tantos, alto y huesudo, bigote blanco cuidado, chaqueta de paño azul con botones de ancla y una gorra de patrón muy limpia. | `retratos/costa/jacinto-larranaga.png` |
| Uxue Lasarte (niña) | Niña de nueve años, flaca y morena, pelo largo y enredado siempre húmedo, camisón blanco con los bajos llenos de arena y los pies descalzos. | `retratos/costa/uxue-lasarte.png` |
| Amaia Lasarte (saladora) | Mujer de unos treinta, delgada y ojerosa, pañuelo negro en la cabeza, manos agrietadas por la sal y un delantal de lona de la Salazón. | `retratos/costa/amaia-lasarte.png` |
| Paco Zubiri (tendero) | Hombre de unos cuarenta y cinco, bajito y con barriga, calvo con cuatro pelos peinados de lado, manguitos negros y un lápiz detrás de la oreja. | `retratos/costa/paco-zubiri.png` |
| Lucio Iturbe (pescador) | Hombre de treinta y pocos, fuerte y con la barba descuidada, jersey de lana negro de luto, botas de agua y las manos llenas de tierra seca. | `retratos/costa/lucio-iturbe.png` |
| Eusebio Garmendia (herrero) | Hombre de unos cincuenta, enorme y peludo, barba negra quemada en las puntas, delantal de cuero lleno de agujeros y un martillo siempre en la mano. | `retratos/costa/eusebio-garmendia.png` |
| Ciriaco Etxanobe (pescador viejo) | Anciano de casi ochenta, muy flaco y doblado, cara curtida como cuero viejo, boina calada, bufanda de lana gris y un farol apagado en la mano. | `retratos/costa/ciriaco-etxanobe.png` |
| Nicasio Ibarra (carpintero de ribera) | Hombre de unos sesenta, bajo y fuerte, pelo blanco cortado a cepillo, gafas atadas con un cordel, camisa remangada y virutas de madera en la ropa. | `retratos/costa/nicasio-ibarra.png` |
| Rosalía Arrieta (dueña de la Salazón) | Mujer de setenta y uno, menuda y muy derecha, pelo blanco recogido, vestido negro de luto antiguo, chal de lana sobre los hombros y la mano derecha siempre enguantada. | `retratos/costa/rosalia-arrieta.png` |
| Antón Iriarte (capataz de la Salazón) | Hombre de unos cuarenta, alto y ancho, cabeza afeitada, chaleco de cuero sobre camisa blanca y un gancho de estibador colgado del cinturón. | `retratos/costa/anton-iriarte.png` |
| Josune Aramburu (saladora) | Chica de unos veinte, rubia y pecosa, pañuelo rojo en el pelo, delantal de lona manchado de salmuera y unos pendientes de aro baratos. | `retratos/costa/josune-aramburu.png` |
| Lázaro Ochoa (enterrador) | Hombre de unos setenta, encorvado y nervudo, sombrero de ala ancha agujereado, abrigo largo lleno de tierra y una pala al hombro. | `retratos/costa/lazaro-ochoa.png` |
| Engracia Sarasola (rezadora mayor) | Anciana de casi noventa, pequeña y arrugada, toca negra de viuda, rosario de conchas en las manos y unos ojos azules muy claros, casi blancos. | `retratos/costa/engracia-sarasola.png` |
| Pilar Azkue (rezadora) | Mujer de unos treinta y cinco, delgada y pálida, pelo negro trenzado, vestido de luto reciente y un anillo de hombre colgado del cuello con un cordón. | `retratos/costa/pilar-azkue.png` |
| Juana Lekuona (redera) | Mujer de unos sesenta, rechoncha y morena, sombrero de paja roto, falda remangada, una aguja de red enorme en la mano y una sonrisa con un diente de oro. | `retratos/costa/juana-lekuona.png` |
| Martina Olazabal (patrona de Arenales) | Mujer de unos cincuenta, alta y fuerte, pelo canoso cortado como un chico, jersey grueso de pescador y una cicatriz que le cruza la ceja. | `retratos/costa/martina-olazabal.png` |
| Íñigo Basterra (tabernero de Arenales) | Hombre de unos cuarenta, flaco y narigudo, pelo negro engominado, chaleco de rayas y un trapo de cocina remetido en el cinturón. | `retratos/costa/inigo-basterra.png` |
| Carmen Urrutia (viuda de Arenales) | Mujer de unos cincuenta, gruesa y de cara redonda, vestido negro gastado, un chal de punto verde y un pañuelo de hombre bordado con una I. | `retratos/costa/carmen-urrutia.png` |
| Ramiro Agirre (antiguo maestro) | Hombre de unos sesenta, flaco y desaliñado, gafas rotas con un cristal pegado, chaqueta de pana con coderas, barba de una semana y una petaca en el bolsillo. | `retratos/costa/ramiro-agirre.png` |
| Rufino Goñi (vigía de la cala) | Hombre de unos veinticinco, flaco y nervioso, pelo rojo largo atado con una cuerda, capa de hule remendada y un silbato de hueso colgado del cuello. | `retratos/costa/rufino-goni.png` |
| Sebastián Mendia (raquero) | Hombre de unos cincuenta, menudo y cetrino, descalzo, pantalón remangado hasta las rodillas, un saco de arpillera a la espalda y una ristra de conchas al cuello. | `retratos/costa/sebastian-mendia.png` |
| Bartolo Unzueta (mariscador) | Hombre de unos setenta, chato y fuerte, piel quemada, gorro de lana rojo, botas altas de goma y un rascador de hierro en la mano. | `retratos/costa/bartolo-unzueta.png` |
| La Vecina (voz del agua) | Nadie la ha visto entera: una forma pálida y enorme bajo el agua verde de la poza, dos ojos redondos sin párpados y una mano de dedos larguísimos apoyada en la roca. | `retratos/costa/la-vecina.png` |

### Escenarios (320×180, sin transparencia, vista lateral)

Prompt: `Pixel art side-view landscape, 320x180, gothic horror, cold desaturated palette, foggy northern sea coast, no people, no text, no frame.` + lo que se ve. Un fondo por localización.

| Localización | Lo que se ve | Dónde va |
| :--- | :--- | :--- |
| Mareaviva | Casas blancas apretadas contra la ladera, redes tendidas en cada balcón y un muelle nuevo de piedra. Huele a sal y a humo de leña, y nadie habla alto. | `escenarios/costa/mareaviva.png` |
| El Embarcadero Viejo | Un muelle de madera negra que se mete en la bahía sobre postes podridos. Desde la galerna no amarra aquí ninguna barca. En la última tabla hay una silla de enea. | `escenarios/costa/el-embarcadero-viejo.png` |
| El Faro de la Punta | Una torre blanca sobre la punta norte, con acantilados a los dos lados. Al pie hay una casa baja, un huerto de coles y un cobertizo de carpintero. | `escenarios/costa/el-faro-de-la-punta.png` |
| La Salazón de los Arrieta | Una nave larga de piedra junto al agua, con pilas de salmuera, barriles apilados hasta el techo y una compuerta que da al mar. Huele a sal, a escamas y a dinero. | `escenarios/costa/la-salazon-de-los-arrieta.png` |
| El Cementerio Viejo | Un cementerio en lo alto de la colina, con cruces de hierro torcidas por el viento y una capilla sin puerta. Por un lado, el acantilado cae a pico sobre el mar. | `escenarios/costa/el-cementerio-viejo.png` |
| La Ermita de los Ahogados | Una ermita encalada al borde del acantilado del oeste. Dentro, las paredes están cubiertas de exvotos: barcas de madera, trenzas de pelo, retratos pintados de hombres con gorra. Abajo hay una cripta. | `escenarios/costa/la-ermita-de-los-ahogados.png` |
| La Playa de las Redes | Una playa ancha de arena gris donde se tienden las redes a secar entre barcas volcadas. Con la marea baja aparecen pozas y rocas cubiertas de algas. | `escenarios/costa/la-playa-de-las-redes.png` |
| Arenales | El pueblo de al lado, pasado el cabo. Casas bajas, un puerto pequeño y un cementerio lleno de cruces nuevas. Aquí el mar se lleva a la gente como en todas partes. | `escenarios/costa/arenales.png` |
| La Cala del Contrabando | Una cala escondida bajo un arco de roca al sur de la playa, con una cueva al fondo. Hay fardos tapados con lona, una hoguera y un vigía que silba cuando alguien se acerca. | `escenarios/costa/la-cala-del-contrabando.png` |
| El Pecio de la Esperanza | El casco negro de un pesquero varado entre las rocas de la punta, partido por la mitad. Con la bajamar se entra por el boquete del costado; con la pleamar desaparece. | `escenarios/costa/el-pecio-de-la-esperanza.png` |
| La Boca del Bajo | La entrada del Bajo: un arco de roca negra que solo sale del agua en la bajamar. Dentro, el suelo está lleno de pozas hondas y huele a algas podridas y a cera. | `escenarios/costa/la-boca-del-bajo.png` |
| La Pared de las Manos | Una cueva enorme bajo el Bajo, con el techo goteando y pozas negras en el suelo. Al fondo hay una pared lisa cubierta de manos pintadas, cientos, de muchos siglos. Tres son más nuevas que las demás. | `escenarios/costa/la-pared-de-las-manos.png` |

### Bichos (96×96, fondo transparente)

Prompt: `Pixel art creature sprite, 96x96, transparent background, full body, facing left, gothic horror, cold desaturated palette, black outline, no text, no frame.` + cómo es.

| Bicho | Cómo es | Dónde va |
| :--- | :--- | :--- |
| Desvelado | Un ahogado de pie, con la piel gris y arrugada del agua, ropa de pescador hecha jirones, algas en el pelo y los ojos blancos abiertos. | `bestias/desvelado.png` |
| Ahogado viejo | Un ahogado alto y abotargado, con un chaquetón de hule podrido, percebes pegados a los hombros y una cuerda de barca atada a la cintura. | `bestias/ahogado-viejo.png` |
| El patrón de la galerna (jefe) | Un ahogado enorme con gorra de patrón y un chaquetón de botones de latón verdes de óxido, barba blanca llena de algas y un farol apagado colgado del cinto. | `bestias/el-patron-de-la-galerna.png` |
| El brazo de la Vecina (jefe) | Un brazo enorme, blanco como la cera, con dedos largos como remos y uñas de nácar, que sale de una poza verde y negra. | `bestias/el-brazo-de-la-vecina.png` |
| Congrio de poza | Un congrio negro y gordo como un brazo, con la boca abierta llena de dientes finos, asomando de una poza entre algas. | `bestias/congrio-de-poza.png` |
| Congrio gigante | Un congrio gris como un tronco, más largo que una barca, con cicatrices de anzuelos en la cabeza y un ojo blanco. | `bestias/congrio-gigante.png` |
| Cangrejo de salmuera | Un cangrejo rojo del tamaño de un perro, con el caparazón cubierto de costras de sal blanca y una pinza mucho más grande que la otra. | `bestias/cangrejo-de-salmuera.png` |
| Cangrejo del pecio | Un cangrejo pardo del tamaño de una mesa, con el caparazón cubierto de percebes y tablas de barco clavadas encima. | `bestias/cangrejo-del-pecio.png` |
| Anguila de la bodega | Una morena verde y moteada, larga como una persona, con la boca abierta y dientes torcidos, asomando de un agujero entre tablas negras. | `bestias/anguila-de-la-bodega.png` |
| Gaviota negra | Una gaviota grande con las plumas grises casi negras, el pico ganchudo y amarillo con una mancha roja, las alas abiertas. | `bestias/gaviota-negra.png` |
| Contrabandista de la cala | Hombre de unos treinta, flaco y moreno, capa de hule, pañuelo atado a la cabeza, una honda en la mano y una faca al cinto. | `bestias/contrabandista-de-la-cala.png` |
| El Gallo (jefe) | Hombre de unos cuarenta, bajo y musculoso, pelo rojo de punta, chaleco de terciopelo granate robado, dos cuchillos curvos y una pluma de gallo en el sombrero. | `bestias/el-gallo.png` |
| Hombre de Lucio | Pescador de unos cuarenta, rudo y con barba, jersey de lana gris, botas de agua y un bichero de barca en las manos. | `bestias/hombre-de-lucio.png` |
| Lucio con el arpón (jefe) | Hombre de treinta y pocos, fuerte, barba descuidada, jersey negro de luto empapado y un arpón de ballenero de hierro más largo que él. | `bestias/lucio-con-el-arpon.png` |
| Estibador de la Salazón | Hombre joven y ancho de espaldas, camisa sin mangas, delantal de lona manchado de salmuera y un gancho de hierro en la mano. | `bestias/estibador-de-la-salazon.png` |
| Antón el capataz (jefe) | Hombre de unos cuarenta, alto y ancho, cabeza afeitada, chaleco de cuero sobre camisa blanca empapada y un gancho de estibador en cada mano. | `bestias/anton-el-capataz.png` |
| Pescador de Arenales | Hombre de unos treinta y cinco, delgado y quemado por el sol, gorra de lana azul, jersey remendado y un remo partido en las manos. | `bestias/pescador-de-arenales.png` |
| Arponera de Arenales | Mujer de unos treinta, fuerte y morena, trenza larga, falda remangada sobre pantalón de faena y un haz de arpones cortos a la espalda. | `bestias/arponera-de-arenales.png` |
| Saqueador de tumbas | Hombre de unos veinticinco, flaco y sucio, gorra calada, abrigo robado dos tallas grande y una pala de cavar al hombro. | `bestias/saqueador-de-tumbas.png` |

Después de dibujarlos: `node tools/pixel-manifest.mjs`.
