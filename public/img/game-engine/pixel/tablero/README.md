# Casillas del tablero táctico

Un dibujo por tipo de terreno de `TERRAIN_TYPES` (`public/scripts/game-engine/board/terrain.js`). 48×48, vista cenital, hechos con PixelLab (pixflux).

Hay dos clases de casilla:

- **Llenas** (opacas, sin transparencia): se pintan en lugar del suelo y se repiten lado a lado sin costuras. Son el suelo y el muro de cada bioma, el agua, el hielo, la maleza, el abismo y lo alto.
- **Encima** (fondo transparente): se pintan sobre el suelo del bioma. Son las puertas, la escalera, la salida, los barriles, los cofres, la palanca, la barricada, las coberturas y los escombros del terreno difícil. Así valen para cualquier bioma.

## Terreno → archivo

| Tipo (`TERRAIN_TYPES`) | ASCII | Archivo | Clase |
|---|---|---|---|
| `floor` | `.` | `suelo-<bioma>.png` | llena |
| `wall` | `#` | `muro-<bioma>.png` | llena |
| `difficult` | `~` | `dificil.png` | encima |
| `cover_half` | `c` | `cobertura-media.png` | encima |
| `cover_three_quarters` | `C` | `cobertura-tres-cuartos.png` | encima |
| `door` cerrada | `D` | `puerta-cerrada.png` | encima |
| `door` cerrada con llave (`locked`) | `L` | `puerta-cerrojo.png` | encima |
| `door` abierta (`open`) | `o` | `puerta-abierta.png` | encima |
| `door` rota (`broken`) | — | `puerta-rota.png` | encima |
| `chasm` | `v` | `abismo.png` | llena |
| `stairs` | `>` | `escalera.png` | encima |
| `water` | `w` | `agua.png` | llena |
| `deep_water` | `W` | `agua-honda.png` (sin ella, `agua.png`) | llena |
| `ice` | `i` | `hielo.png` | llena |
| `brush` | `b` | `maleza.png` | llena |
| `mud` | `m` | `barro.png` | llena |
| `barrel` | `T` | `barril.png` | encima |
| `chest` | `k` | `cofre.png` | encima |
| `high` | `^` | `alto.png`, y `alto-borde.png` en la fila de abajo de cada zona alta | llena |
| `exit` | `x` | `salida.png` | encima |
| `lever` | `P` | `palanca.png` | encima |
| `barricade` | `=` | `barricada.png` | encima |
| puente (suelo que cruza agua, abismo o un barranco) | `.` | `puente-ns.png` o `puente-eo.png`, y `puente-baranda-*.png` en los bordes | llena + encima |
| acantilado de las cotas (`elevation`, J12.10) | — | `acantilado-<hacia dónde cae>.png`, en la casilla de abajo | encima |

### Puentes y acantilados (tanda 12)

El motor no tiene un tipo «puente»: un puente es **suelo** (`.`) que cruza agua (`w`, `W`), un abismo (`v`) o un barranco de las cotas (10 pies o más por debajo), de 1 a 3 casillas de ancho, y que llega a tierra por las dos puntas. Se anda como el suelo. `bridgeTiles` en `pixel-art.js` los encuentra y el tablero los pinta por capas: la baranda del lado que da al hueco, encima, y las tablas debajo. Un embarcadero que acaba en el agua o una isla no son puentes. Sobre un mapa dibujado no se pinta nada: el puente ya está en el dibujo.

Un acantilado es el borde entre dos casillas con 10 pies o más de diferencia de cota (`cliffEdges` en `board/heights.js`). Su cara de roca va en la casilla de abajo, pegada al borde, un tercio de casilla de grueso (`cliffFace`). El nombre dice hacia dónde se cae: `acantilado-sur` es lo alto al norte y la caída hacia el sur. En el borde de un puente alto, y sobre un mapa dibujado, se queda la raya de antes.

Las puertas se dibujan de frente, con su marco, para que se lean de un vistazo dentro de una fila de muro.

## Biomas

El tablero elige un bioma y usa su pareja de suelo y muro:

- `mazmorra`: losas grises grandes; muro de sillares oscuros azulados.
- `madera`: tablas de madera cálida (taberna, casa); muro de tablones oscuros.
- `exterior`: hierba baja apagada; muro de peñascos grises con musgo.
- `cueva`: tierra y grava malva; muro de roca morada.
- `calle`: adoquines grises de pueblo; muro de ladrillo de una casa.
- `nieve`: nieve pisada gris azulada (el valle en invierno de 1387); muro de rocas con nieve encima.
- `pantano`: barro verde oliva oscuro con matas de musgo (Barovia); muro de árboles muertos retorcidos.
- `cripta`: losas oscuras agrietadas (el castillo de Ravenloft); muro de osario, calaveras entre piedras.
- `muelle`: tablas grises de embarcadero; muro de sillares del puerto con musgo y algas (tanda 12: «El muelle de Puerto Alba» salía de hierba).
- `playa`: arena mojada gris tostada; muro de rocas negras del mar con percebes y algas (la cala, las salinas).

### Casillas por bioma (tanda 12)

El terreno difícil y las coberturas cambian fuera de la mazmorra: `<casilla>-<bioma>.png`. Si el del bioma no está, se usa el que hace sus veces y, al final, el de siempre (`terrainTile` y `artFor('tile')` en `pixel-art.js`):

| Bioma | `dificil-…` | `cobertura-media-…` | `cobertura-tres-cuartos-…` |
|---|---|---|---|
| `exterior` | raíces y ramas caídas | una peña con musgo | un roble |
| `nieve` | un montón de nieve con hielo roto | una peña con nieve encima | un pino nevado |
| `cueva` | (escombros) | (la caja) | una estalagmita morada |
| `cripta` | (escombros) | un sarcófago de piedra | (la columna) |
| `playa` | las raíces del exterior | la peña del exterior | el roble del exterior |
| `pantano` | `barro.png` | la peña del exterior | el roble del exterior |

## Archivos

- `suelo-mazmorra.png` — losas de piedra gris, grandes e irregulares, con juntas oscuras.
- `muro-mazmorra.png` — la parte de arriba de un muro de sillares, gris azulado oscuro.
- `suelo-madera.png` — tablas de madera marrón en horizontal, con clavos.
- `muro-madera.png` — tablones oscuros apretados, marrón morado.
- `suelo-exterior.png` — hierba corta verde apagado, uniforme.
- `muro-exterior.png` — peñascos grises apretados con musgo en las grietas.
- `suelo-cueva.png` — tierra y grava malva oscura.
- `muro-cueva.png` — roca morada maciza, con grietas.
- `suelo-calle.png` — adoquines grises redondeados, con barro en las juntas.
- `muro-calle.png` — pared de ladrillo marrón rojizo con llagas grises.
- `suelo-nieve.png` — nieve pisada gris azulada, con montoncitos de nieve.
- `muro-nieve.png` — rocas grises apretadas con capas de nieve encima.
- `suelo-pantano.png` — barro verde oliva oscuro y encharcado, con matas de musgo y juncos secos.
- `muro-pantano.png` — troncos muertos retorcidos, grises y sin hojas, muy juntos.
- `suelo-cripta.png` — losas de piedra gris oscura, agrietadas.
- `muro-cripta.png` — pared de osario: filas de calaveras en nichos de piedra oscura.
- `barro.png` — barro marrón oscuro, liso (casilla llena).
- `agua.png` — agua poco honda verde azulada, con ondas.
- `hielo.png` — hielo azul claro con escarcha.
- `maleza.png` — matorral verde oscuro muy tupido.
- `abismo.png` — negro casi puro con jirones de bruma morada: el vacío.
- `alto.png` — losas claras de piedra arenisca, más claras que cualquier suelo: la parte de arriba de una zona alta.
- `alto-borde.png` — las mismas losas, con el borde y la caída en sombra abajo: va en la última fila de una zona alta (la casilla de debajo no es alta), para que se vea el escalón.
- `dificil.png` — un montón de escombros y piedras rotas.
- `puerta-cerrada.png` — puerta de roble oscuro con bisagras de hierro y aldaba, en su marco.
- `puerta-cerrojo.png` — la misma puerta, con dos cadenas en aspa y un candado dorado.
- `puerta-abierta.png` — la misma puerta, abierta hacia dentro.
- `puerta-rota.png` — la misma puerta, reventada, con un agujero astillado en medio.
- `escalera.png` — escalones de piedra oscura que bajan en diagonal.
- `salida.png` — una trampilla abierta con escalera de mano y luz que sube de abajo.
- `barril.png` — un barril de madera con aros de hierro.
- `cofre.png` — un cofre cerrado con herrajes y cerradura dorada.
- `palanca.png` — una palanca de hierro sobre una base de piedra.
- `barricada.png` — una valla de troncos cruzados en aspa.
- `cobertura-media.png` — una caja de madera grande con esquinas de hierro (cobertura baja).
- `cobertura-tres-cuartos.png` — una columna de piedra alta y gruesa.
- `trampa.png` — un cepo de hierro abierto, visto desde arriba (encima): va dentro del recuadro de una trampa ya descubierta (`hazardTile` en `pixel-art.js`).
- `fuego.png` — un charco de aceite ardiendo con su llama (encima): el fuego que arde en el tablero. Se le quitó a mano un rizo de humo que parecía un «?».

### Tanda 12: el arte del tablero

- `agua-honda.png` — agua honda azul marino, con ondas pequeñas (llena): el mar del muelle, un río profundo. Se distingue de un vistazo del agua poco honda (`agua.png`, verde azulada).
- `suelo-muelle.png` — tablas de embarcadero grises y viejas, en vertical, con juntas oscuras.
- `muro-muelle.png` — sillares grises del muelle con musgo y algas en las juntas.
- `suelo-playa.png` — arena mojada gris tostada, con chinas y trocitos de concha.
- `muro-playa.png` — rocas negras del mar, muy juntas, con percebes y algas.
- `dificil-exterior.png` — un montón de raíces y ramas caídas con su sombra (encima). Se le cambió a mano el disco de arena de debajo por una sombra.
- `cobertura-media-exterior.png` — una peña gris con musgo (encima).
- `cobertura-tres-cuartos-exterior.png` — un roble pequeño (encima).
- `dificil-nieve.png` — un montón de nieve con trozos de hielo roto (encima).
- `cobertura-media-nieve.png` — una peña gris con nieve encima (encima).
- `cobertura-tres-cuartos-nieve.png` — un pino cargado de nieve (encima).
- `cobertura-tres-cuartos-cueva.png` — una estalagmita de roca morada (encima).
- `cobertura-media-cripta.png` — un sarcófago de piedra oscura con ribetes dorados (encima). Se le borró a mano una inscripción que parecía letras.
- `casilla-salida.png` — un círculo de runas azules, hueco por dentro (encima): las casillas donde se coloca al grupo antes de la pelea. Dibujado a mano, píxel a píxel.
- `marco-aliado.png`, `marco-enemigo.png`, `marco-jefe.png`, `marco-invocacion.png`, `marco-gente.png` — los aros de metal de las fichas en la mesa virtual (42×42, para una cara de 32): dorado, rojo, rojo con oro y seis remaches, violeta y gris. Dibujados a mano, píxel a píxel; los pone `combat-vtt.css` (sección 5).
- `puente-ns.png` — tablas de madera cálida atravesadas, con rendijas oscuras (llena): el piso de un puente que se cruza de norte a sur. Son las tablas de `suelo-muelle.png`, giradas y pasadas a madera marrón.
- `puente-eo.png` — las mismas tablas, giradas: un puente que se cruza de este a oeste.
- `puente-baranda-oeste.png`, `puente-baranda-este.png` — la baranda de un puente de norte a sur (encima): la viga del borde, una cuerda retorcida y dos postes por casilla, con su sombra sobre las tablas. Dibujadas a mano, píxel a píxel.
- `puente-baranda-norte.png`, `puente-baranda-sur.png` — la misma baranda, girada, para un puente de este a oeste.
- `acantilado-sur.png` — la cara de un acantilado (48×16, encima): el borde de arriba con luz, roca marrón grisácea que se oscurece hacia abajo, una línea oscura al pie y la sombra en el suelo. La roca es de PixelLab (pixflux, una generación); el borde y la sombra, a mano.
- `acantilado-norte.png`, `acantilado-este.png`, `acantilado-oeste.png` — la misma cara, volteada o girada (las dos de lado son de 16×48), con el borde de luz siempre hacia lo alto.

## Costuras

Las casillas llenas se revisaron repitiéndolas 4×4. Las que salían con marco o con un dibujo en medio se arreglaron sin generar otra vez: se cambian los bordes por una copia desplazada media casilla de la misma imagen y la unión va por el camino donde las dos se parecen más. No hay difuminado, así que siguen siendo pixel art. Quedan costuras leves en `suelo-mazmorra` y `suelo-madera` (las juntas de las losas y de las tablas caen en el borde). `abismo` y `muro-exterior` repiten un poco su dibujo.

Los biomas `calle`, `nieve`, `pantano` y `cripta` y el `barro` salen de dibujos de 64×64 (o 96×96): se recorta la ventana de 48×48 cuyos bordes opuestos casan mejor y, si hace falta, se le pasa el mismo arreglo de costuras. Luego se apagaron los colores para que casen con el resto (el suelo del pantano pasó de morado a verde oliva). Quedan costuras leves en `muro-nieve`, `muro-pantano` y `suelo-cripta`, y `muro-cripta` repite su dibujo a propósito (filas de nichos).
