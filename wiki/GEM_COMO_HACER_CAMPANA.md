---
title: Cómo hacer una campaña con los Gems
tags: [gem, gemini, campanas, proceso, guia, retratos]
created: 2026-10-02
updated: 2026-10-02
author: DanielJHesseling / Claude Opus 5.5
---

# 🗺️ Cómo hacer una campaña con los Gems

Esta guía es el camino entero, de una idea (o un libro) a una campaña que se juega en el tablón del gremio. Los Gems hacen casi todo el trabajo. Tú pegas, lees y decides.

---

## Los dos Gems

| Gem | Qué hace | Qué devuelve | Cómo se monta |
| :--- | :--- | :--- | :--- |
| **De campaña** ([[GEM_CREAR_CAMPANA]]) | El esqueleto: el mundo, los sitios, la gente con su aspecto, las misiones, los tableros, los bichos y el hilo | Un paquete JSON entero, que se pega en el juego | Instrucciones: la sección 3 de [[GEM_CREAR_CAMPANA]]. Conocimiento: `wiki/GEM_CREAR_CAMPANA_ANEXO.md` |
| **Guionista** ([[GEM_GUIONISTA]]) | Las voces: conversaciones, charlas con ramas, escenas de los compañeros, romances, misiones personales y salidas de una pelea | Piezas de JSON, cada una con su sitio | Instrucciones: desde «Tu papel» hasta el final de [[GEM_GUIONISTA]]. Conocimiento: el mismo anexo |

Los dos usan **el mismo formato**: lo que escribe el guionista, el de campaña lo mete en su sitio sin tocarlo.

> **Cuando cambie el juego**, `node tools/gem-instructions.mjs` regenera las instrucciones y el anexo. Vuelve a pegarlos en los dos Gems: las instrucciones, en su caja, y el anexo, como conocimiento (quita el viejo antes).

---

## El camino, paso a paso

### 1. El Gem de campaña hace el paquete (20 a 40 minutos)

1. Abre el Gem de campaña y pégale el material:
   - un libro (o sus capítulos);
   - un resumen largo;
   - o una idea de cinco líneas.
2. Pídele la forma que toque:
   - con una idea, *«Hazla corta»*: el juego pone los tableros y los bichos;
   - con un libro, *«Empieza por `world`»*, y luego *«Siguiente»* sección a sección.
3. Lee cada sección antes de seguir. Si algo no te gusta, díselo en ese momento: un nombre cambiado tarde arrastra a todo lo que lo usaba.
4. Al final, *«Ensambla»*. Te devuelve **un solo bloque JSON**: cópialo entero.

### 2. Pegarla en el juego (2 minutos)

1. **Jugar sin conexión**.
2. En el gremio, abre el **Tablón de campañas**.
3. Pulsa **Añadir una campaña** y elige una de las dos:
   - **Pegar el texto de una campaña**, si lo tienes copiado;
   - o el archivo, si lo has guardado.
4. El tablón la comprueba antes de guardarla y te enseña un **informe**:
   - **si se puede jugar de principio a fin**;
   - lo que se quedaría a medias;
   - lo que ha puesto el juego (tableros, bichos, textos), plegado;
   - cosas raras, y lo que le falta para durar como las del juego.

### 3. El bucle del informe (5 a 15 minutos por vuelta)

Si el informe dice que algo está roto o tiene huecos:

1. Pulsa **Copiar la lista para tu Gem**.
2. Pégasela al Gem de campaña, tal cual. Corrige solo eso y devuelve el paquete entero.
3. Pega el nuevo en **Añadir una campaña**. Si ya estaba, se pone al día.

Repite hasta que diga **«Se puede jugar de principio a fin»**. Suelen bastar una o dos vueltas.

> **Sin abrir el juego:** `node tools/check-world-density.mjs mi-campana.json` dice lo mismo que el tablón. Con `--gem` saca la lista para pegarla.

### 4. El guionista le pone voz (por rondas, de 15 a 30 minutos cada una)

1. Abre el guionista y pégale, en el primer mensaje, el paquete que acabas de meter en el juego.
2. Pídele las rondas en orden, de una en una:

| Ronda | Qué escribe |
| :--- | :--- |
| 1 | La gente: su voz, su oficio y su aspecto |
| 2 | El hilo, hablado: las conversaciones de las escenas importantes |
| 3 | Las charlas con ramas de quien importa |
| 4 | Las salidas de cada pelea y lo que se puede mirar en cada sitio |
| 5 | Las escenas de vínculo de los compañeros |
| 6 | Los romances y las misiones personales |
| 7 | El repaso de «que la gente suene a gente» |

3. Cada respuesta trae piezas con su **«Va en:»**. Cópialas al Gem de campaña con *«Mete estas piezas y ensambla»*.
4. Pega el paquete que te devuelve en **Añadir una campaña**: se pone al día. El informe sigue valiendo, y te avisa también de un romance o una misión personal a medias.

No hace falta hacer las siete rondas de una vez: la campaña se juega desde el paso 3, y cada ronda la mejora.

### 5. Los mapas en imagen (opcional, 10 minutos por mapa)

Si el libro trae mapas de mazmorra con cuadrícula:

1. El Gem escribe el tablero con su `image` y su `grid`, sin `map`: no ve el dibujo.
2. Al añadirla, **el juego lee el mapa del dibujo**: dónde hay muro, puerta o suelo.
3. Para retocarlo, abre el tablero en el **editor de tableros** del juego (J12.8). Ahí pintas las casillas encima del dibujo y marcas las salas con nombre.
4. Si quieres afinar a mano, `node tools/mapa-a-tablero.mjs mapa.png --salida tablero.json` hace lo mismo desde la consola y dice qué casillas son dudosas.

La imagen va en `public/mundos/<campaña>/mapas/`, o entre tus imágenes si la campaña es tuya.

### 6. Los retratos, con PixelLab (unos minutos por persona)

Cada persona sale en las conversaciones con su retrato y sus tres caras: alegre, enfadado y triste. Hasta que se dibuja, sale una silueta.

1. Mira quién no tiene retrato:
   ```
   node tools/retratos-pendientes.mjs mi-campana.json
   ```
   Te da, por persona:
   - el nombre del archivo;
   - la descripción para PixelLab, sacada de su `aspecto`;
   - y sus tres caras.

   Si a alguien le falta el `aspecto`, pídeselo al Gem.
2. Pídele a Claude: *«Haz con PixelLab los retratos pendientes de mi campaña»*. Con `--json`, la herramienta da la lista entera para hacerlos de una vez.
3. Los retratos van en `public/img/game-engine/pixel/retratos/<campaña>/`:
   - tus campañas se llaman `tuya-` y su nombre, como `tuya-la-luz-de-punta-gris`;
   - después se pasa `node tools/pixel-manifest.mjs`, para que el juego los vea.

### 7. El bot la juega (de 10 a 40 minutos, solo)

Antes de jugarla tú, el jugador automático la recorre a clics, como lo harías tú, y apunta:

- cada **silencio**: un clic tras el que no cambia nada;
- cada **atasco**: lo que pide la historia no está a la vista.

Para las campañas del juego ya hay vuelta:

- `node tools/vuelta-1387.mjs`;
- `node tools/vuelta-strahd.mjs`;
- `node tools/vuelta-gremio.mjs` (el prólogo y el tablón).

Para una tuya, no hace falta nada nuevo: guarda lo que te da el Gem en un archivo (por ejemplo `mi-campana.json`) y pásaselo a la vuelta de cualquier campaña:

- `node tools/vuelta-campana.mjs mi-campana.json`.

La añade al tablón con «Añadir una campaña», como harías tú, y la juega a clics hasta un final. Al terminar dice:

- el informe del tablón al añadirla;
- los silencios y los atascos, con el sitio y lo que se veía;
- los hitos que no se cumplieron;
- y, en una frase, si se juega de principio a fin.

Con `--headed` la ves jugar; con `--peleas`, las peleas van de verdad (más lenta). Juega sin animaciones (el golpe, el dado y el daño salen de una vez); para verlas como las ves tú, ponle delante `VUELTA_ANIMACIONES=1`. La comprobación de que una campaña pegada se juega como conversación es `node tools/e2e-gem-conversacion.mjs`.

### 8. El guion en Word (opcional: leerla y corregirla con calma)

Todo lo que se dice en una campaña, en un Word que se lee como un guion: capítulos, hitos y escenas en el orden en que se juegan, y cada línea con quién la dice y su cara, como «**Tomás (el posadero)** *(enfadado)*: ¡Al ladrón!». Debajo de cada línea, tus opciones en viñetas con lo que contestan. Salen también las charlas, las peleas con sus salidas habladas, lo que se mira en cada sitio, los rumores, los saludos, los compañeros (vínculo, romance y misión) y los finales. Las líneas que no dice nadie salen como «Narrador», en rojo: así se ven las que quedan por pasar a conversación.

1. **Exportar.** Pídele a Claude *«Sácame el guion de Strahd en Word»*, o:
   ```
   node tools/guion-word.mjs export strahd
   ```
   Vale `gremio`, `1387`, `strahd` o la ruta de tu JSON (`mi-campana.json`). Se guarda en `Documentos\Guiones`. Con `--md`, también en texto, para pegárselo a un Gem.
2. **Corregir.** En Word, cambia solo lo que va detrás de los dos puntos. No toques la marca gris del final de cada línea (`[#E:el-muelle/2~7c1f]`): es como el juego sabe qué línea es. Deja las marcas de género (`{el nuevo|la nueva}`) y los huecos (`{hola}`, `{npc:tomas}`). También puedes pasarle el Word al Gem guionista para que repase voces o tono: que devuelva las líneas con sus marcas.
3. **Importar.** Pídele a Claude *«Importa mi guion de Strahd»*, o:
   ```
   node tools/guion-word.mjs import strahd-guion.docx strahd
   ```
   (Sin ruta, lo busca en `Documentos\Guiones`.)
   Te dice, sin tocar nada:
   - las líneas cambiadas, con el antes y el después;
   - las que no se guardan, y por qué (una marca de género rota, un hueco nuevo que el juego no sabría rellenar);
   - las que el juego cambió después de exportar (se queda lo del juego);
   - las marcas que ya no encuentra;
   - y el texto nuevo sin marca: no entra solo; son notas para el Gem guionista, y se guardan al lado del Word.
4. **Aplicar.** Si te parece bien, lo mismo con `--aplicar`. Cada texto va a su sitio: el paquete en El Gremio y 1387; en Strahd, `mejoras.json` o `libro.json` (lo que venía de `original.json` va encima, en `mejoras.json`, marcado «propio:») y se vuelve a hacer el paquete. Después pasan el validador y la densidad; si algo empeora, no se guarda nada.

Por ahora el Word sirve para **corregir textos**, no para cambiar la estructura: una escena, una rama o una opción nueva se le piden al Gem guionista.

---

## Cuánto se tarda

| Paso | Tiempo |
| :--- | :--- |
| El paquete con el Gem de campaña | 20 a 40 minutos (una idea corta: 10) |
| Pegarla y leer el informe | 2 minutos |
| Cada vuelta del informe | 5 a 15 minutos |
| Cada ronda del guionista | 15 a 30 minutos |
| Los mapas en imagen | 10 minutos por mapa |
| Los retratos | Unos minutos por persona, con Claude |
| La vuelta del bot | 10 a 40 minutos, sin ti |
| El guion en Word | Exportar e importar, un minuto; corregir, lo que tardes en leer |

Una campaña corta, jugable y con voz: **una tarde**. Una como Strahd, con mapas y todos sus retratos: varios días de rondas.

---

## Lo que el juego quiere de una campaña

Los dos Gems lo saben. Si algo sale raro, esto es lo que hay que recordarles:

- **La historia se cuenta hablando, sin narrador** (D-J54, D-J60): conversaciones con retrato. Ni una línea sin quien la diga, tampoco de ambiente.
- **Nadie tiene nombre hasta que se presenta** (J13.7).
- **Las peleas, para un grupo de 4** (D-J56), con el nivel de la campaña.
- **Las facciones son reputación** (D-J58): caminos, peajes y finales, sin relojes.
- **Los plazos, apagados** (D-J46).
- **Cada persona, con su aspecto**, para su retrato.
- **Se dice «localización»**, y todo se entiende a la primera.

---

## Enlaces

- [[GEM_CREAR_CAMPANA]] — el Gem de campaña: las instrucciones cortas, y el anexo.
- [[GEM_GUIONISTA]] — el Gem guionista.
- [[EMPEZAR_UNA_CAMPANA]] — dónde se pega lo que devuelve el Gem.
- [[ROADMAP_SIN_CONEXION]] — J5 (tus campañas) y las decisiones D-J46, D-J54, D-J56, D-J57 y D-J58.
