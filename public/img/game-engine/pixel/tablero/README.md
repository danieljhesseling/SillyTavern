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
| `ice` | `i` | `hielo.png` | llena |
| `brush` | `b` | `maleza.png` | llena |
| `barrel` | `T` | `barril.png` | encima |
| `chest` | `k` | `cofre.png` | encima |
| `high` | `^` | `alto.png`, y `alto-borde.png` en la fila de abajo de cada zona alta | llena |
| `exit` | `x` | `salida.png` | encima |
| `lever` | `P` | `palanca.png` | encima |
| `barricade` | `=` | `barricada.png` | encima |

Las puertas se dibujan de frente, con su marco, para que se lean de un vistazo dentro de una fila de muro.

## Biomas

El tablero elige un bioma y usa su pareja de suelo y muro:

- `mazmorra`: losas grises grandes; muro de sillares oscuros azulados.
- `madera`: tablas de madera cálida (taberna, casa); muro de tablones oscuros.
- `exterior`: hierba baja apagada; muro de peñascos grises con musgo.
- `cueva`: tierra y grava malva; muro de roca morada.

## Archivos

- `suelo-mazmorra.png` — losas de piedra gris, grandes e irregulares, con juntas oscuras.
- `muro-mazmorra.png` — la parte de arriba de un muro de sillares, gris azulado oscuro.
- `suelo-madera.png` — tablas de madera marrón en horizontal, con clavos.
- `muro-madera.png` — tablones oscuros apretados, marrón morado.
- `suelo-exterior.png` — hierba corta verde apagado, uniforme.
- `muro-exterior.png` — peñascos grises apretados con musgo en las grietas.
- `suelo-cueva.png` — tierra y grava malva oscura.
- `muro-cueva.png` — roca morada maciza, con grietas.
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

## Costuras

Las casillas llenas se revisaron repitiéndolas 4×4. Las que salían con marco o con un dibujo en medio se arreglaron sin generar otra vez: se cambian los bordes por una copia desplazada media casilla de la misma imagen y la unión va por el camino donde las dos se parecen más. No hay difuminado, así que siguen siendo pixel art. Quedan costuras leves en `suelo-mazmorra` y `suelo-madera` (las juntas de las losas y de las tablas caen en el borde). `abismo` y `muro-exterior` repiten un poco su dibujo.
