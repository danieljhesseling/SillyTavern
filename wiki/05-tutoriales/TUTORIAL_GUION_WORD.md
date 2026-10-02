---
title: Tutorial — El guion de una campaña en Word
tags: [tutorial, guion, word, campanas, gem]
created: 2026-10-02
---

# 📝 El guion de una campaña en Word

Sacas todo lo que se dice en una campaña a un documento de Word, como si fuera el guion de una obra: quién lo dice, con qué cara y qué dice. Lo lees de un tirón, lo corriges (tú o tu Gem) y se lo devuelves al juego, que cambia solo lo que has tocado.

Vuelve a [[Tutoriales]] · Las filas del plan: J5.7 y J5.8 de [[ROADMAP_SIN_CONEXION]].

---

## 1. Sacar el guion

Abre una terminal (PowerShell) en la carpeta del juego y escribe una de estas órdenes:

```powershell
cd C:\Users\danie\SillyTavern
node tools\guion-word.mjs export gremio     # el prólogo y el gremio
node tools\guion-word.mjs export 1387
node tools\guion-word.mjs export strahd
node tools\guion-word.mjs export C:\ruta\a\mi-campana.json   # una campaña de tu Gem
```

- El Word se guarda en **`Documentos\Guiones`**, por ejemplo `Documentos\Guiones\1387-guion.docx`. Queda fuera del repositorio, así que no se sube a git.
- Si lo quieres en otro sitio, añade `--salida C:\otra\carpeta`.
- Si lo quieres en texto para pasárselo a un Gem, añade `--md`.

Ya están sacados los tres de ahora: `gremio-guion.docx`, `1387-guion.docx` y `strahd-guion.docx`, de unas 67 páginas cada uno.

## 2. Cómo se lee

- **Portada y dos páginas de ayuda:** «Cómo corregir» y «Cómo leerlo».
- **Títulos** por parte, capítulo, hito y conversación, en el orden en que se juega.
- **Cada línea:** «**Quién lo dice** *(su cara)*: el texto». Si tu personaje aún no conoce a esa persona, sale también lo que es: «**Tomás (el posadero)**».
- **Tus opciones**, en viñetas, cada una con lo que contestan y lo que pasa según la tirada.
- **Además de las escenas:** las charlas con sus ramas, las salidas habladas de las peleas, lo que se ve al mirar cada sitio, los rumores, los saludos de la gente, los compañeros (vínculo, romance y misión personal), las noches y los finales con sus epílogos.
- **Al final de cada línea, una marca pequeña en gris**, por ejemplo `E:el-muelle/2`. Es lo que le dice al juego de dónde salió esa línea. **No la toques.**
- **Las marcas de género** se ven tal cual: `{el nuevo|la nueva}`. El juego elige la buena según tu personaje.
- **Las líneas que no dice nadie salen como «Narrador», en rojo.** Con la decisión D-J60 no debería quedar ninguna; ahora mismo hay un agente quitándolas.

## 3. Corregir

- **Cambia solo el texto que va después de los dos puntos.** No cambies quién lo dice, ni su cara, ni la marca gris.
- **Puedes usar el control de cambios de Word.** El juego lo entiende.
- **Las marcas de género tienen que quedar completas:** `{él|ella}`, con su barra y sus dos llaves.
- **Puedes pasarle el Word a tu Gem guionista** para que revise el tono, las voces o la gramática. Gemini lee Word.
- **En Word no se cambia la estructura.** Si escribes una línea, una opción o una escena nueva, el juego no la mete. La guarda como nota para tu Gem guionista, que la convierte en una pieza del formato del juego (ver [[GEM_COMO_HACER_CAMPANA]]).

## 4. Devolverlo al juego

Primero, sin tocar nada, para ver qué haría:

```powershell
node tools\guion-word.mjs import 1387-guion.docx 1387
```

Si das solo el nombre del archivo, lo busca en `Documentos\Guiones`. Te dice:

| Lo que sale en el informe | Qué quiere decir |
| :--- | :--- |
| **Cambiadas** | Las líneas que has tocado, con el antes y el después, y a qué archivo va cada una |
| **No se guardan** | Las que tienen algo roto (una marca de género sin barra, un hueco nuevo, una línea vacía), con el porqué |
| **Cambió el juego** | Líneas que se cambiaron en el juego después de exportar. Gana lo del juego. |
| **Cambiasteis los dos** | Líneas que tocasteis tú y el juego. Se avisa para que elijas. |
| **No encuentro la marca** | La marca gris ya no está (o se borró sin querer) |
| **Texto nuevo** | Lo que escribiste sin marca: va a un archivo de notas para el Gem, al lado del Word |

Si todo está bien, otra vez con `--aplicar`:

```powershell
node tools\guion-word.mjs import 1387-guion.docx 1387 --aplicar
```

- **El gremio y 1387:** el texto va a su paquete (`public/mundos/…pack.json`).
- **Strahd:** va a sus fuentes. Si la línea venía del guion original de tu Gem (`original.json`), ese archivo no se toca: la corrección se escribe encima, en `mejoras.json` o `libro.json`, marcada «propio:». Luego se rehace el paquete.
- **Las charlas, quedadas, noches, romances, misiones y frases** van a su archivo del compendio.
- **Al acabar, el juego comprueba la campaña.** Si algo queda peor que antes, se deshace solo.

## 5. Lo que viene

- **Botones en el gremio.** «Exportar el guion» e «Importar el guion» estarán en el **taller de campañas** (J5.9), sin consola.
- **Las frases comunes del motor** (las que valen para cualquier campaña) no salen en el guion de ninguna. Si algún día quieres corregirlas, se puede hacer un guion aparte.
