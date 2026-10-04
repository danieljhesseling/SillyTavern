---
title: Tutorial — El guion de una campaña en Word
tags: [tutorial, guion, word, campanas, gem]
created: 2026-10-02
updated: 2026-10-04
---

# 📝 El guion de una campaña en Word

Sacas lo que se dice en una campaña a un documento de Word, como si fuera el guion de una obra: quién lo dice, con qué cara y qué dice. Puedes sacarlo **entero** o **por categorías** (solo la historia, solo las charlas…). Lo lees, lo corriges (tú o tu Gem) y se lo devuelves al juego, que cambia solo lo que has tocado.

Todo se hace con **`GuionEnWord.exe`**: doble clic, sin consola. Si prefieres la consola, está al final (sección 8).

Vuelve a [[Tutoriales]] · Las filas del plan: J5.7 y J5.8 de [[ROADMAP_SIN_CONEXION]].

---

## 1. La primera vez: hacer el .exe

El `.exe` se hace con una orden, una sola vez. No hay que instalar nada: usa el compilador de C# que ya trae Windows (igual que `ProbarCampañas.exe`).

```powershell
cd C:\Users\danie\SillyTavern
node tools\guion-en-word\hacer-exe.mjs --escritorio
```

- Deja **`GuionEnWord.exe`** en la carpeta del juego, al lado de `Jugar.bat`. Su icono es una hoja azul con renglones.
- Con `--escritorio`, pone además un acceso directo **«El guion en Word»** en tu escritorio. También se puede poner después, con el botón **«Poner en el escritorio»** de abajo de la ventana.
- Si algún día cambia el lanzador, vuelve a darle a la misma orden.

## 2. Abrirlo

Doble clic en **`GuionEnWord.exe`** o en el acceso directo.

- Se abre una **ventana suelta** de Microsoft Edge, sin pestañas ni barra de direcciones. No abre nada en tu navegador.
- No sale ninguna ventana negra.
- No hace falta tener el juego encendido, ni se enciende.
- Si le das otra vez al doble clic con la ventana ya abierta, se abre la misma.
- Al cerrar la ventana, se apaga sola.

## 3. Elegir la campaña

Arriba, en **«Campaña»**. Debajo del menú pone adónde va lo que corrijas y cuántas líneas tiene su guion.

| En el menú | Adónde va lo corregido |
| :--- | :--- |
| El prólogo y el gremio, 1387 | A su paquete (`public/mundos/…pack.json`). Las charlas, quedadas, noches, romances, misiones de los tuyos y saludos, a su archivo del compendio |
| La Maldición de Strahd | A sus fuentes (`wiki/campanas/strahd`), y el paquete se vuelve a hacer. Lo que viene del guion original de tu Gem no se toca: la corrección se escribe encima, marcada «propio:» |
| Las experimentales (la costa, el ocaso, la pantalla) | A una **ronda nueva** de su guion, `wiki/guiones/<campaña>/ronda-N-correcciones.md`, y el paquete se vuelve a hacer de las rondas. Así, si se vuelven a convertir las rondas, las correcciones no se pierden |
| Un .json suelto… | Sale el botón **«Elegir el .json…»**. Lo corregido va a ese mismo archivo |

## 4. Sacar el guion

A la izquierda, en **«1. Sacar el guion»**:

1. **Qué texto sale.** Marca **«Todo el guion»**, o quítalo y marca solo las categorías que quieras. Cada una dice cuántas líneas tiene:

   | Categoría | Qué trae |
   | :--- | :--- |
   | La historia | Los capítulos y los hitos: sus escenas, lo que dice la gente en ellas y tus opciones |
   | Conversaciones | Las conversaciones con la gente, con todas sus ramas |
   | Tableros y peleas | Lo que se dice al empezar, durante y al acabar cada pelea, y sus salidas habladas |
   | Misiones y encargos | El nombre, la descripción y los objetivos de las misiones, y los encargos del tablón |
   | Los finales | Los finales, lo que fue de cada uno (los epílogos) y los presagios |
   | Los sitios | Lo que se ve al mirar cada sitio y lo que te ofrecen allí |
   | La gente | Quién es cada uno, lo que sabe, sus secretos y sus saludos |
   | Rumores y sucesos | Lo que se oye por ahí y lo que pasa de repente (las tarjetas de sucesos) |
   | Charlas | Las charlas sueltas con la gente y con los tuyos, con sus ramas |
   | Los compañeros | Cómo se presentan, sus escenas de vínculo, lo que dicen al llegar a cada sitio y sus misiones personales |
   | Quedadas, noches y romance | Las quedadas con los tuyos, las noches en la posada y las escenas de romance |
   | La presentación | De qué va la campaña: lo que se lee antes de empezar |

   Solo salen las categorías que tiene esa campaña. Por ejemplo, las experimentales no tienen «Charlas» ni «Quedadas», porque lo de sus compañeros va en «Los compañeros».

2. **Se guarda en.** Por defecto, en **`Documentos\Guiones`**, con un nombre que dice qué trae: `1387-guion.docx` si va entero, `1387-guion-historia-charlas.docx` si lleva esas dos. Con **«Cambiar…»** sale el cuadro de «Guardar como» de Windows para elegir otro sitio u otro nombre.
   - `Documentos` es la del Explorador. En tu ordenador está en OneDrive: `C:\Users\danie\OneDrive\Documentos\Guiones`. Los guiones que se sacaron antes del 4 de octubre están en la otra, `C:\Users\danie\Documents\Guiones`; la consola los sigue encontrando por su nombre.
3. Si también lo quieres en texto para pegárselo a un Gem, marca **«También en texto (.md)»**.
4. Dale a **«Sacar el guion en Word»**. Al acabar salen dos botones: **«Abrir el Word»** y **«Enseñarlo en la carpeta»**.

Un guion por partes trae, debajo del título, la nota «Este guion trae solo: …». Dentro salen los títulos de capítulo, hito o compañero que hacen falta para saber dónde estás, aunque sean de otra categoría. Esos títulos salen sin marca gris: son solo para leer.

## 5. Cómo se lee

- **Portada y dos páginas de ayuda:** «Cómo corregir» y «Cómo leerlo».
- **Títulos** por parte, capítulo, hito y conversación, en el orden en que se juega.
- **Cada línea:** «**Quién lo dice** *(su cara)*: el texto». Si tu personaje aún no conoce a esa persona, sale también lo que es: «**Tomás (el posadero)**».
- **Tus opciones**, en viñetas, cada una con lo que contestan y lo que pasa según la tirada.
- **Al final de cada línea, una marca pequeña en gris**, por ejemplo `E:el-muelle/2`. Es lo que le dice al juego de dónde salió esa línea. **No la toques.**
- **Las marcas de género** se ven tal cual: `{el nuevo|la nueva}`. El juego elige la buena según tu personaje.
- **Las líneas que no dice nadie salen como «Narrador», en rojo.** Con la decisión D-J60 no queda ninguna en las campañas del juego; si sale alguna, hay que darle a alguien que la diga.

## 6. Corregir

- **Cambia solo el texto que va después de los dos puntos.** No cambies quién lo dice, ni su cara, ni la marca gris.
- **Puedes usar el control de cambios de Word.** El juego lo entiende.
- **Las marcas de género tienen que quedar completas:** `{él|ella}`, con su barra y sus dos llaves.
- **Puedes pasarle el Word a tu Gem guionista** para que revise el tono, las voces o la gramática. Gemini lee Word.
- **En Word no se cambia la estructura.** Si escribes una línea, una opción o una escena nueva, el juego no la mete. La guarda como nota para tu Gem guionista, que la convierte en una pieza del formato del juego (ver [[GEM_COMO_HACER_CAMPANA]]).

## 7. Devolverlo al juego

A la derecha, en **«2. Devolverlo al juego»**. La campaña es la de arriba: tiene que ser la misma de la que sacaste el Word.

1. Dale a **«Elegir el Word corregido…»**. Sale el cuadro de «Abrir» de Windows. Vale un `.docx`, o un `.md` o `.txt` con las mismas marcas.
2. **Primero se ve qué cambiaría. Todavía no se guarda nada.** Sale:
   - Unas etiquetas con la cuenta: líneas iguales, cambiadas, las que no se guardan, las que cambiasteis el juego y tú…
   - **Una tabla por categorías:** cuántas líneas trae el Word de cada una, cuántas cambian y cuántas no se pueden guardar.
   - **«Las líneas que cambian»:** cada una con quién la dice, su categoría, lo de antes tachado y lo de ahora debajo, y sus avisos.
   - **«Las que no se guardan»:** las que tienen algo roto (una marca de género sin barra, un hueco nuevo, una línea vacía), con el porqué.
   - **«El informe entero»:** lo mismo que diría la consola.
3. **Elige qué categorías guardar.** En la tabla, cada categoría con cambios lleva una casilla, marcada al principio. Quita las que no quieras guardar todavía: sus líneas no se tocan.
4. Dale a **«Guardar en el juego»**. Te pregunta antes: cuántas líneas, de qué categorías, y dónde va la copia. Dile **«Sí, guardar»**.
5. Al acabar te dice en qué archivos lo ha guardado y lo que dicen las comprobaciones. Con **«Abrir la copia de antes»** ves lo que había.

Qué pasa por dentro al guardar:

- **Antes de tocar nada, copia lo que hay** en `Documentos\Guiones\copias\<fecha>_<campaña>\`, con las mismas carpetas que en el juego (`public\mundos\1387.pack.json`…). Para deshacer a mano, copia de ahí a la carpeta del juego.
- **Cada archivo se vuelve a leer justo antes de escribir.** Si alguien cambió esa misma línea mientras tanto, no se pisa.
- **Al acabar, comprueba la campaña** (el validador de paquetes y la densidad del mundo). Si queda peor que antes, se deshace solo y te dice por qué.

| Lo que sale en la tabla o en el informe | Qué quiere decir |
| :--- | :--- |
| **Cambian** | Las líneas que has tocado. Se guardan si su categoría está marcada |
| **No se guardan** | Las que tienen algo roto, con el porqué |
| **Cambió el juego** | Líneas que se cambiaron en el juego después de sacar el Word. Gana lo del juego |
| **Cambiasteis el juego y tú** | Se avisa y no se toca. Vuelve a sacar el guion y corrígela otra vez |
| **Marca que no encuentro** | La marca gris ya no está (o se borró sin querer) |
| **Líneas nuevas para el Gem** | Lo que escribiste sin marca. Va a un archivo de notas al lado del Word, `…-notas-para-el-gem.txt`, para pegárselo a tu Gem |

En un Word por partes, las líneas de las categorías que no trae no cuentan como «no están en el Word»: se quedan como están, sin avisos.

## 8. Desde la consola

Lo mismo, con órdenes, en una terminal en la carpeta del juego:

```powershell
cd C:\Users\danie\SillyTavern
node tools\guion-word.mjs categorias 1387                               # qué categorías tiene y cuántas líneas
node tools\guion-word.mjs export 1387                                   # el guion entero, en Documentos\Guiones
node tools\guion-word.mjs export 1387 --categorias historia,charlas     # solo esas dos
node tools\guion-word.mjs export ocaso --salida C:\otra\carpeta\x.docx  # cualquier paquete de public\mundos, donde quieras
node tools\guion-word.mjs export C:\ruta\a\mi-campana.json --md         # un .json de tu Gem, y también en texto
node tools\guion-word.mjs import 1387-guion.docx 1387                   # qué cambiaría (no toca nada)
node tools\guion-word.mjs import 1387-guion.docx 1387 --categorias historia --aplicar   # guarda solo la historia
```

- Los nombres de las categorías para `--categorias`: `historia`, `conversaciones`, `peleas`, `misiones`, `finales`, `sitios`, `gente`, `rumores`, `charlas`, `companeros`, `quedadas`, `mundo` (la presentación) y `otros`. Separadas por comas. Con `todo`, o sin `--categorias`, va todo.
- En `import`, si das solo el nombre del archivo, lo busca en `Documentos\Guiones`.
- Con `--aplicar` también copia antes lo que va a tocar, en `Documentos\Guiones\copias`.

## 9. Si algo no va

- **«No encuentro Node.js».** Instálalo desde https://nodejs.org/ (la versión LTS) y vuelve a abrir el `.exe`.
- **La ventana no se abre.** Lo que pasó queda apuntado en `%LOCALAPPDATA%\GuionEnWord\ventana.log`. El `.exe` enseña las últimas líneas si se cae al empezar.
- **El cuadro de «Abrir» o «Guardar como» no aparece.** Sale siempre delante; si no lo ves, mira en la barra de tareas.
- **«El paquete no es el que sale de las rondas».** En una experimental, alguien cambió su paquete a mano. No se toca nada. Hay que pasar esa corrección a una ronda, o volver a convertir las rondas con `node tools\guion-a-paquete.mjs wiki\guiones\<campaña> --forzar`.

## 10. Lo que viene

- **Botones en el gremio.** «Exportar el guion» e «Importar el guion» también estarán en el **taller de campañas** (J5.9).
- **Las frases comunes del motor** (las que valen para cualquier campaña) no salen en el guion de ninguna. Si algún día quieres corregirlas, se puede hacer un guion aparte.

## Para quien toque el código

- `tools/guion-word.mjs` hace el trabajo: las categorías (`CATEGORIES`, `categoryOf`, `filterScript`), exportar e importar, las copias (`backupFiles`) y la ronda de las experimentales (`applyRound`, con `correctionsRound` de `campaign/guion-round.js`).
- `tools/guion-en-word/`: `servidor.mjs` (la ventana y su API, en 127.0.0.1), `app.html` (la ventana), `windows.mjs` (los cuadros de Windows y el acceso directo), `lanzador.cs` y `hacer-exe.mjs` (el `.exe`). Es el mismo método que `tools/probar-campanas/`.
- Las pruebas: `tests/game-engine-script-doc.test.js` (lo de «por categorías» y la ronda de ocaso, en una carpeta temporal).
