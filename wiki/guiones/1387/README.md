---
title: 1387 — de dónde sale la campaña
tags: [1387, guion, paquete, fuente]
created: 2026-09-29
author: DanielJHesseling / Claude Opus 5.5
---

# 1387: la fuente es el paquete

> **Desde el 2026-09-29 (D-J37), 1387 se corrige en su paquete: `public/mundos/1387.pack.json`.**
> Lo que hay en esta carpeta (las rondas del Gem guionista y las de Claude) es **la historia de cómo se escribió**, no lo que se juega.

- **Para cambiar algo de 1387**, cámbialo en `public/mundos/1387.pack.json`: la sinopsis, un rumor, una escena, un final o sus epílogos.
- **El paquete va por delante de las rondas.** Tiene cosas que el guion no tiene: las frases que concuerdan con quien juega (`{atrapado|atrapada}`, D-J17), los epílogos de cada final (D-J18) y lo que se ha ido corrigiendo a mano.
- **`tools/guion-a-paquete.mjs` ya no lo pisa.** Si el paquete existe, se niega a escribirlo y lo dice. Para lo demás:
  - `node tools/guion-a-paquete.mjs wiki/guiones/1387 --check` comprueba las rondas sin escribir nada;
  - `--salida otro.json` escribe lo que saldría en otro archivo, para compararlo con el paquete;
  - `--forzar` pisa el paquete con lo de las rondas. **Se pierde todo lo que se corrigió a mano**: mira el diff antes de guardarlo.

Las dudas que se resolvieron al escribirla están en [[DUDAS_1387]].
