---
title: Plan — Crear una campaña a mano, repartida por categorías
tags: [plan, campanas, editor, mundo, localizaciones, personajes, objetos, bestiario]
created: 2026-09-22
updated: 2026-09-22
author: DanielJHesseling / Claude Opus 5
---

# 🏗️ Crear una campaña a mano

> [!NOTE]
> **Estado (22-09-2026)**: **Las seis fases están hechas.** Se queda como el diseño del editor. El plan vivo es [[ROADMAP_MAESTRO]].

> **Lo que pides**: poder hacer a mano lo que hoy solo sale bien si lo trae un libro — mundo, localizaciones (con tableros o sin ellos), personajes con su clase, su sitio, su pasado, su personalidad y su cara, y objetos. Repartido por categorías, como lo reparte el JSON del importador.

> **Estado (22-09-2026)**: **las seis fases están hechas**. `/campana` abre con siete pestañas — Mundo · Localidades · Personajes · Bestiario · Facciones · Objetos · Misiones — y escribe exactamente lo que escribe el importador de libros. Lo que sigue abajo es el diseño, que se deja tal cual porque explica **por qué** cada cosa está donde está.

---

## 🎯 La idea que ordena todo: un destino, dos puertas

Un libro importado y una campaña hecha a mano tienen que **acabar en la misma forma**. No parecida: la misma.

Hoy un paquete de campaña produce esto, y el juego entero lee de ahí:

```
Lorebook (world_info)
├── entries[]              fichas con `dndData`, agrupadas
│   ├── Characters         compañeros y PNJs
│   ├── Monsters           bestiario
│   ├── Factions           facciones y su reputación
│   └── Lore               todo lo demás
└── metadata
    ├── locationMaps[]     las localidades
    │   └── boards[]       terreno, salas, objetivos, colocación de enemigos
    ├── campaignMap        qué está abierto, bloqueado o hecho
    └── rulesetPack        reglas, habilidades y progresión
```

**Si el editor manual escribe otra cosa, tendrás dos medias funciones**: campañas importadas que se juegan enteras y campañas hechas a mano a las que les falta la mitad. Así que cada pestaña del editor escribe **exactamente** en el mismo sitio que el importador, y la prueba que lo demuestra ya existe a medias: *hacer a mano → exportar → validar → importar → sale lo mismo*.

---

## 📍 Qué hay hoy, categoría por categoría

| Categoría | Se puede hoy | Cómo |
| :--- | :---: | :--- |
| **Mundo** (nombre, género, sinopsis, lore) | ✅ | `/campana` → Mundo |
| **Localizaciones** | ✅ | `/campana` → Localidades. Con tableros o sin ellos |
| **Tableros** | ✅ | Se crean ahí; el terreno se pinta con el pincel de siempre |
| **Personajes del grupo** | ✅ | Ficha completa: características, inventario, progresión, vínculos |
| **Personajes del mundo** (PNJ) | ✅ | `/campana` → Personajes, con **Reclutar** para pasarlos al grupo |
| **Bestiario** | ✅ | `/campana` → Bestiario, con aviso si un tablero lo coloca |
| **Facciones** | ✅ | `/campana` → Facciones |
| **Objetos** | ✅ | `/campana` → Objetos: catálogo del mundo, y de ahí sale el botín |
| **Misiones y objetivos** | ✅ | La misión en `/campana`; sus objetivos, en `/objetivos editar` |
| **Reglas y habilidades** | ✅ | `/rules` y `/habilidades` |

*(La tabla de abajo era el estado antes de este plan; se deja el diagnóstico porque es lo que lo justifica.)*

**El agujero que había**: `dndData` — lo que convierte una ficha de Lorebook en un monstruo con CA o en un confidente con arcana — **se leía en veinte sitios y no se escribía en ninguno**. Solo lo rellenan la plantilla, el generador de IA y el importador. El formulario de World Info ni siquiera lo enseña.

Por eso tu intuición es exacta: con el JSON del libro ves las cosas repartidas porque **el libro trae la estructura**. Lo que falta es una puerta manual a esa misma estructura.

---

## 🧩 El plan: seis fases

Cada una deja algo jugable por sí sola, y ninguna depende de la siguiente.

### M1 · El marco y la ficha del mundo

Un panel único, `/campana`, con una pestaña por categoría — **Mundo · Localidades · Personajes · Bestiario · Facciones · Objetos · Misiones** — y un botón en el menú de pausa. En esta fase se construye el marco y solo la primera pestaña.

**Pasos**

1. `game-engine/ui/campaign-editor.js`: el panel, las pestañas y el guardado (leer el mundo, escribir, `saveWorldInfo`, refrescar).
2. Pestaña **Mundo**: nombre visible, género, sinopsis.
3. **Lore**: lista de entradas con *palabra que la activa* + texto. Es lo que SillyTavern inyecta en el chat cuando alguien la menciona, así que la palabra importa tanto como el texto.
4. Aviso de cambio de nombre: renombrar el mundo **no** renombra el Lorebook (eso es de upstream); se cambia el nombre visible y se dice.

**Cómo se comprueba**: cambiar la sinopsis, cerrar, reabrir y que siga ahí; y que `/prompt` la enseñe donde toca.

---

### M2 · Localizaciones, con tablero o sin él

La pieza con más juego por línea escrita, porque desbloquea todo lo espacial.

**Pasos**

1. Lista de localidades con **Añadir**, renombrar y borrar. Campos: nombre, tipo (`ciudad`, `aldea`, `ruinas`, `mazmorra`, `campamento`, `santuario`, `yermo`), descripción, región, facción que manda.
2. **Cero tableros es válido** y se dice en el propio panel: una aldea donde solo se habla ya existe desde A4.
3. Dentro de cada localidad, sus tableros: **Añadir tablero** pide nombre y tamaño (entre 8×6 y 40×30, los límites que ya valida el importador) y crea un mapa vacío con el borde de muro puesto.
4. El tablero recién creado se abre **en el pincel de terreno que ya existe**: muros, cobertura, terreno difícil y puertas. No se construye un editor nuevo.
5. **Dónde empieza el grupo**: pulsar casillas del tablero para marcarlas. Sin esto un tablero no se puede jugar, y es el error que más comete un libro generado.
6. **Colocar enemigos**: elegir uno del bestiario y pulsar su casilla. Escribe `enemyPlacements`, que es lo que hace que una sala tenga a *ese* bicho en *esa* esquina.
7. Al guardar, pasar el tablero por el **verificador de accesibilidad** (PROP2-039) y avisar si algo queda incomunicado. Un tablero hecho a mano se equivoca igual que uno generado.

**Cómo se comprueba**: crear una localidad sin tablero y viajar a ella; crear un tablero, pintar una pared, poner al grupo y a un enemigo, y pelear ahí.

---

### M3 · Personajes: clase, sitio, pasado, personalidad y cara

Aquí hay **dos cosas distintas** que conviene no mezclar:

- **Los tuyos**: los del grupo. Ya tienen ficha completa — características, inventario, progresión, vínculos.
- **Los del mundo**: PNJs, confidentes, comerciantes, el villano. Hoy **no se pueden crear**.

**Pasos**

1. Pestaña **Personajes**, dos listas separadas: *En tu grupo* y *En el mundo*.
2. Crear uno del mundo escribe una ficha de Lorebook con `dndData.entityType = 'npc'`, que es justo lo que escribe el importador.
3. Campos, en el orden en que uno piensa un personaje:
   - **Quién es**: nombre, título, una línea de resumen.
   - **Qué es**: clase, nivel, raza; características (FUE, DES, CON, INT, SAB, CAR), PG y CA. Los mismos campos que la ficha del grupo, para que reclutarlo sea copiar.
   - **Dónde está**: la localidad, de una lista. Y, si esa localidad tiene tablero, su casilla.
   - **Pasado y personalidad**: dos campos de texto. Van al contenido de la ficha, que es lo que el modelo lee cuando alguien lo menciona.
   - **Vínculo**: arcana y puntos iniciales, si es un confidente.
   - **Cara**: una dirección de imagen. Sin subidor de archivos propio — apuntar a una imagen de tu servidor o una URL, que es lo que ya hacen los avatares del grupo.
   - **Palabras que lo despiertan**: los alias por los que el chat lo menciona (*el Capitán*, *Valen*, *el de la guardia*).
4. **Reclutar**: un botón que lo mete en el grupo, copiando su ficha. Es el puente entre las dos listas, y hoy no existe.

**Cómo se comprueba**: crear un PNJ, mencionarlo en el chat y ver que su ficha entra en el contexto; reclutarlo y que aparezca en la tira del grupo.

---

### M4 · Bestiario y facciones

Los dos más cortos, porque los campos ya están decididos por el contrato del importador.

**Pasos**

1. **Bestiario**: nombre (único, que el Lorebook indexa por nombre), PG, CA, desafío, velocidad, alcance de ataque, descripción y **perfil táctico** — los cuatro que el motor de verdad juega, elegidos de una lista, no escritos a mano.
2. Aviso al borrar: si un tablero coloca a ese bicho o un objetivo lo nombra, decirlo **antes**, con la lista de quién lo usa. Es lo mismo que ya hace el editor de reglas al quitar un tipo de daño.
3. **Facciones**: nombre, metas, reputación inicial (−100 a +100) y sus rivales.
4. Decir la verdad en el panel: **la reputación todavía no hace nada** hasta que se haga P17. Un número que promete y no cumple es peor que no tenerlo.

---

### M5 · Objetos: un catálogo del mundo

Hoy un objeto solo existe **dentro de la mochila de alguien**. El formulario es bueno y completo; lo que falta es que haya objetos *del mundo* antes de que alguien los lleve encima.

**Pasos**

1. Pestaña **Objetos**: la lista del mundo, con el mismo formulario que el inventario (tipo, categoría, daño, ranura, peso, rareza, cargas…). Se reutiliza tal cual.
2. **Dárselo a alguien**: un botón que lo copia al inventario de un miembro del grupo o de un PNJ.
3. **Enchufarlo al botín**, que es lo que evita que sea una lista decorativa: hoy lo que cae al ganar sale de una tabla escrita en código (`loot-items.js`). Debe salir de este catálogo, con la rareza decidiendo la probabilidad.
4. Que viaje en el paquete: añadir `items[]` al contrato, al exportador y al importador, con su prueba de ida y vuelta.

---

### M6 · Misiones de verdad

Los objetivos ya se editan por tablero. Lo que no existe es la **misión** como cosa propia: nombre, descripción, acto y en qué tablero se juega.

**Pasos**

1. Pestaña **Misiones**: crear una, ponerle nombre y acto, elegir su tablero y editar sus objetivos con el editor que ya existe.
2. Guardarlas como misiones, no solo como objetivos sueltos de un tablero. Hoy el exportador tiene que inventarse una misión por tablero porque no hay otra cosa.
3. Encadenarlas con el mapa de campaña: qué se desbloquea al terminar cuál. El motor ya sabe (`requiresQuests`); falta poder escribirlo.

---

## 🔍 La prueba que lo sostiene todo

Al final de cada fase, la misma:

```
Construir a mano  →  Exportar  →  Validar  →  Importar  →  Contar lo mismo
```

Si una campaña hecha con el editor no sobrevive a su propio exportador, es que el editor escribió algo que el motor no lee — y eso es exactamente el fallo que este plan existe para evitar. La prueba ya corre para A2; cada fase le añade su categoría.

Y lo de siempre: **nada cuenta hasta que el recorrido lo hace con clics** en un navegador de verdad.

---

## 📏 Tamaño y orden

| Fase | Qué desbloquea | Tamaño |
| :--- | :--- | :--- |
| **M1** Marco + Mundo | Todo lo demás cuelga de aquí | ✅ Hecha |
| **M2** Localizaciones y tableros | Lo espacial entero. **La que más da** | ✅ Hecha |
| **M3** Personajes | El mundo deja de estar vacío | ✅ Hecha |
| **M4** Bestiario y facciones | Enemigos propios sin escribir JSON | ✅ Hecha |
| **M5** Objetos | El botín deja de ser una tabla fija | ✅ Hecha |
| **M6** Misiones | Campañas de varios actos | ✅ Hecha |

**Por dónde empezaría**: M1 y M2 juntas. Con esas dos ya puedes dibujar un mundo entero con sus sitios y sus mazmorras, que es el 70% de lo que pides; el resto rellena ese mundo.

---

## 🚫 Lo que dejaría fuera

- **Un pintor de mapas nuevo** (`PROP2-025`): el pincel de terreno ya existe y funciona. Añadirle un segundo editor sería mantener dos.
- **Subir imágenes desde el panel**: una dirección de imagen resuelve el 90% sin tocar el almacenamiento de archivos de upstream.
- **Generar cada categoría con IA**: ya existe para el mundo entero (Fase F) y para los objetivos. Meter un botón de *proponer* en cada pestaña es tentador y es otro proyecto; primero que se pueda escribir a mano.

---

## ✅ Lo que quedó hecho, y lo que no

**Hecho**

- El panel entero, con sus siete pestañas, en `game-engine/ui/campaign-editor.js`; las reglas, en `game-engine/campaign/campaign-editor.js` (puro, 49 pruebas).
- **Reclutar** mueve a alguien del mundo al grupo y le da casilla donde plantarse. Sacar del grupo hace lo contrario sin borrarlo del mundo.
- Guardar el editor **no rehace el grupo**: quien ya jugaba conserva vida, oro, experiencia y mochila. Solo se copia encima lo que la ficha dice.
- El **catálogo de objetos** del mundo entra de verdad en las tablas de botín, con la rareza decidiendo el peldaño, y lo que cae se equipa como el arma que se escribió.
- `items[]` viaja en el contrato del paquete, en el exportador y en el importador; las **misiones** se guardan como misiones, así que el exportador ya no tiene que inventarse una por tablero.

**Lo que sigue pendiente, dicho en claro**

- La **reputación** de una facción se guarda y viaja, pero todavía no cambia ningún precio ni abre ninguna puerta (eso es P17). El panel lo dice en su propia pestaña.
- Encadenar misiones (`requiresQuests`: qué desbloquea cuál) todavía no se puede escribir desde aquí.
- La **casilla** concreta de un PNJ dentro de un tablero no se edita: se elige la localidad, y quien entra al grupo empieza donde empieza el grupo.
- Los **objetos** solo se le pueden dar a alguien del grupo. Un PNJ no tiene mochila que mirar todavía.
- Los **rivales** de una facción, que este plan pedía, no están: el contrato del paquete no los tiene, y añadir un campo que el importador no lee sería justo la media función que este plan existe para evitar. Primero el contrato, después el formulario.
- La pestaña de **Objetos** lleva los campos que el contrato carga (qué es, rareza, peso, daño, ranura), no el formulario entero del inventario: las cargas y la capacidad se siguen editando dentro de la mochila de alguien.

---

## 🔗 Enlaces

- [[POR_HACER]] — el marcador vivo; aquí solo está el diseño.
- [[ROADMAP_INGESTA_CAMPANAS_LIBROS]] — el contrato del paquete, que es el destino que el editor tiene que respetar.
- [[DISENO_GENERADOR_MUNDOS_PROFUNDO]] — las siete categorías, de donde sale este reparto.
- [[EMPEZAR_UNA_CAMPANA]] — cómo se crea una campaña hoy.
