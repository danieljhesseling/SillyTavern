# Cierre del Bucle Visual: Gremio y Pueblo (J3.1 / J15.4)

Este documento detalla la integración y cierre del bucle visual e interactivo entre el Gremio y la pantalla de Pueblo (Puerto Alba), resolviendo los hitos **J3.1** (*La sala del gremio en el pueblo*) y **J15.4** (*Comandos a botones*) del roadmap.

---

## 1. Contexto y Diagnóstico Inicial

Tras la resolución del *Wiring GAP* (donde todos los módulos del motor quedaron cableados al 100%), existía una brecha en la experiencia de usuario dentro de la interfaz gráfica:

1. **Desconexión de datos de la sala (`HallData`):** `townNow()` en `party/social.js` proporcionaba la localización y NPCs de Puerto Alba, pero no enviaba el estado vivo del gremio (`hall: null`), por lo que la interfaz no tenía acceso a datos como objetos en el cofre, oro en el arca, personajes listos para subir de nivel o encargos disponibles.
2. **Visualización plana sin detalle en el pueblo:** Al entrar en «La Casa del Gremio» en la pantalla de pueblo (`town-scene.js`), las acciones se mostraban como un bloque plano sin categorías ni descripciones, ignorando el diseño estructurado por salas de `guild-hall.js` (`hallSections`).
3. **Falta de indicadores de rango y noticias:** No se mostraba la insignia del rango del gremio ni las felicitaciones/noticias de ascenso de rango en la cabecera del gremio.
4. **Dependencia de comandos de texto (Slash Commands):** Las fichas de acción (`hub-*`) pasaban por el evaluador de comandos (`executeSlashCommandsWithOptions`), ralentizando la interacción y dependiendo de la sintaxis `/cofre`, `/casa-gremio`, `/entrenar-gremio`, etc.
5. **Navegación compartimentada en el panel del gremio:** Al abrir el panel (`guild-panel.js`), solo se mostraban los encargos y el almacén básico, obligando a cerrar y usar comandos separados para revisar el cofre, el entrenamiento, los edificios, los encargos o los personajes.

---

## 2. Cambios Implementados

### 2.1. Conexión de Estado: `public/scripts/party/social.js`
- Se importó `buildHallData` desde `public/scripts/party/hub.js`.
- Se actualizó la función `townNow()` para inyectar `hall: lastHub ? buildHallData() : null`.
- Se preservó estrictamente la regla arquitectónica de importaciones aisladas (sin efectos secundarios al importarse el módulo en `tests/party-facade.test.js`).

### 2.2. Sala Estructurada y Detalle en Vivo: `public/scripts/game-engine/ui/shell/town-scene.js`
- Se importaron `hallSections` y `hallHeader` desde `../../campaign/guild-hall.js`.
- Se actualizó el tipado `TownContext` y `TownView` para albergar `hall`.
- **Detección de Pueblo del Gremio:** Se ajustó `buildTown` para reconocer también `hub-skip` (durante la prueba del prólogo).
- **Secciones del Gremio (`placeActs`):** Para `place.kind === 'gremio'`, se sustituyó la lista plana anterior por la llamada a `hallSections({ chips: town.hubChips, hall: town.hall, town: town.here })`. Las acciones ahora quedan agrupadas en:
  1. *El tablón* (Campañas activas, encargos cortos o saltar la prueba).
  2. *Tu gente* (Tus personajes del gremio y contratación de mercenarios).
  3. *La casa* (El cofre, el patio de entrenamiento y los edificios).
  4. *La memoria del gremio* (Salón de la fama y memoria histórica).
  5. *La salida* (Volver a la plaza de Puerto Alba o continuar una campaña en curso).
- **Insignia de Rango y Noticias en Escena (`renderTownScene`):**
  - Muestra un banner dorado `.gs-town-hall-news` cuando el gremio sube de rango.
  - Muestra la insignia `.gs-town-hall-rank` con el rango actual y su lema.
- **Botones con Detalle en Vivo (`gs-btn-stack` y `gs-btn-detail`):**
  - Si una acción tiene `detail` (p. ej. *«4 cosas de 20 · 120 de oro en el arca»* o *«Gerd ya puede subir de nivel»*), se renderiza en una sublínea legible directamente en el botón, además de estar disponible en el tooltip.

### 2.3. Estilos Visuales: `public/css/town-scene.css`
Se incorporaron reglas CSS coherentes con el diseño de la interfaz táctica y narrativa:
- `.gs-btn-stack`: Distribución en columna para etiqueta y subtítulo de estado.
- `.gs-btn-detail`: Tipografía compacta y atenuada con elipsis en caso de texto largo.
- `.gs-town-hall-rank`: Estilo dorado con icono de escudo y espaciado premium.
- `.gs-town-hall-news`: Notificación destacada con borde dorado e icono de megáfono.

### 2.4. Despacho Directo de Botones: `public/scripts/party/shell.js`
En `runShellChip(chip)` se añadió un enrutador directo por `chip.id` para todas las acciones del gremio, eliminando la intermediación de texto:
- `hub-chest` $\rightarrow$ `openGuildChest()`
- `hub-house` $\rightarrow$ `openGuildHouse()`
- `hub-train` $\rightarrow$ `openGuildTraining()`
- `hub-errands` $\rightarrow$ `openGuildErrands()`
- `hub-heroes` $\rightarrow$ `openHubHeroes()`
- `hub-memory` $\rightarrow$ `openMemoryView()`
- `hub-board` $\rightarrow$ `openHubCampaigns()`
- `hub-hire` $\rightarrow$ `openHubHire()`
- `hub-skip` $\rightarrow$ `skipHubTrial()`
- `hub-hall` $\rightarrow$ `openHallOfFame()`
- `hub-ending` $\rightarrow$ `openEnding()`
- `hub-home` $\rightarrow$ `returnToHub()`
- `hub-continue:*` $\rightarrow$ `continueSavedGame(id)`

### 2.5. Barra de Navegación Rápida en el Panel: `guild-panel.js` & `party/hub.js`
- Se añadió una barra de navegación (`.gd-nav`) justo debajo de la cabecera en `openGuildPanel`.
- Permite saltar con un clic directo a:
  - *Cofre*
  - *Entrenamiento*
  - *Edificios*
  - *Encargos*
  - *Personajes*
  - *Memoria*
- `openGuild()` en `party/hub.js` captura `choice.room` y abre la ventana correspondiente sin fricción.

---

## 3. Verificación y Calidad

Las modificaciones fueron validadas contra la batería de pruebas del proyecto:

1. **Integridad de Fachada y Aislamiento (`tests/party-facade.test.js`):**
   ```text
   PASS ./party-facade.test.js
     J15.1: la fachada party.js
       √ (a) da todo lo que importan los de fuera y las pruebas del navegador (72 ms)
       √ (b) ningún módulo de party/ importa la fachada (18 ms)
       √ (c) el control de tipos mira todos los módulos de party/ (2 ms)
       √ (d) ningún módulo de party/ hace nada al importarse (473 ms)

   Test Suites: 1 passed, 1 total
   Tests:       4 passed, 4 total
   ```
2. **Grafo de Cableado de Módulos (`tools/check-engine-wiring.mjs`):**
   ```text
   Engine modules: 334
   Reached by the running game: 330
   Used by the tools only (not the game): 4
   Every engine module is reachable from the running game.
   ```
3. **Linter ESLint (`npx eslint`):**
   - 0 errores y 0 advertencias en todos los archivos modificados.

---

## 4. Resultado para el Jugador

El bucle de juego entre la plaza y la vida en el gremio queda completamente visual:
- Al pasear por **Puerto Alba**, el jugador ve «La Casa del Gremio».
- Al entrar, se le recibe con la vista del gremio, su rango actual y cualquier novedad o ascenso.
- Las opciones están organizadas de forma lógica (*El tablón*, *Tu gente*, *La casa*, *La memoria*, *La salida*), mostrando de un vistazo cuántas cosas hay en el cofre, si alguien puede subir de nivel o cuántos encargos hay disponibles.
- Todo servicio se opera a través de botones y modales visuales sin necesidad de conocer ni teclear comandos de consola.
