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
