---
title: Tutoriales
tags: [tutoriales, moc, guias]
created: 2026-10-02
---

# 📚 Tutoriales

Las guías para **hacer** algo, paso a paso. Vuelve a [[HOME]].

## Jugar

| Tutorial | Para qué |
| :--- | :--- |
| [[EMPEZAR_UNA_CAMPANA]] | De no tener nada a estar jugando: el gremio, el tablón y tu primera campaña |
| [[SERVIDOR_PRIVADO]] | Arrancar el juego con doble clic (`Jugar.bat`), el servidor privado y **jugar desde el móvil** |

## Crear campañas

| Tutorial | Para qué |
| :--- | :--- |
| [[GEM_COMO_HACER_CAMPANA]] | **El proceso entero con los Gems**: qué Gem hace qué, qué se pega y dónde, el informe y el bucle con el Gem, las rondas del guionista, los mapas en imagen, los retratos con PixelLab, la vuelta del bot y cuánto tarda cada paso |
| [[GEM_CREAR_CAMPANA]] (sección 1) | **Montar el Gem que crea campañas**: qué se pega en sus instrucciones y qué se sube como anexo |
| [[GEM_GUIONISTA]] | **El Gem guionista**: cómo escribe las escenas, las charlas y los romances, por rondas |
| [[TUTORIAL_GUION_WORD]] | **El guion en Word**: sacar todo lo que se dice en una campaña, corregirlo y devolverlo al juego |

## Herramientas

Se lanzan desde una terminal en la carpeta del juego.

| Herramienta | Para qué | Dónde se explica |
| :--- | :--- | :--- |
| `node tools\guion-word.mjs` | El guion en Word, ida y vuelta | [[TUTORIAL_GUION_WORD]] |
| `node tools\retratos-pendientes.mjs` | Quién no tiene retrato, y la descripción para PixelLab sacada de su aspecto | [[GEM_COMO_HACER_CAMPANA]] |
| `node tools\vuelta-campana.mjs` | Un bot juega una campaña entera y dice dónde se calla o se atasca | [[GEM_COMO_HACER_CAMPANA]] |
| `node tools\check-world-density.mjs` | El informe de una campaña desde la consola (lo mismo que sale al añadirla) | [[GEM_COMO_HACER_CAMPANA]] |

## Próximamente

- **El taller de campañas en el juego** (J5.9): subir el guion, el informe, la simulación de las peleas y el guion en Word, todo con botones y sin consola.
- **`ProbarCampañas.exe`** (J16.6): eliges una campaña, le das a «Correr» y ves los resultados en pestañas (Bien, Regular, Mal).

Cuando salgan, su tutorial se añade aquí.
