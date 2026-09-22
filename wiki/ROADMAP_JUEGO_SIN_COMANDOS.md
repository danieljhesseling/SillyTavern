---
title: Roadmap — Juego 100% por Clics (Adiós a los Comandos)
tags: [roadmap, ui-ux, point-and-click, no-commands, hud, combate-tactico, experiencia-juego]
created: 2026-09-21
author: DanielJHesseling / Antigravity AI
---

# 🖱️ Roadmap: Juego 100% por Clics (Zero Comandos)
## *Transformando la Consola de Comandos en una Experiencia Táctil y Visual de Videojuego*

> **Tu Visión**: *"Dejar de lado los comandos para jugar; que la gran mayoría funcione mediante clics en la interfaz"*.
> 
> **Filosofía**: Los comandos de barra (`/fight`, `/combat-attack`, `/combat-move`, `/time`, `/bond`, `/relevo`) fueron los **andamios** necesarios para programar y verificar el motor. Ahora que el motor funciona, **el jugador nunca debería tener que abrir una consola ni memorizar sintaxis para jugar al rol**.

---

## ⚠️ 0. Revisión del 2026-09-21: qué falta de verdad

Antes de la matriz, tres correcciones al plan original. Dos de las cuatro baterías **ya están hechas en su mayor parte**, y el hueco de verdad no estaba nombrado.

**Lo que ya funciona hoy, sin escribir nada:**

| Se dijo que faltaba | Estado real |
| :--- | :--- |
| Clic en la puerta abre y revela la sala | ✅ **Hecho.** Y despierta a quien dormía dentro, en su casilla. Es el paso 24 del recorrido |
| Descanso corto y largo por botón | ✅ **Hecho.** Cuatro botones en la pestaña **Campaña**: *Pasar el rato*, *Dormir*, *Descanso corto*, *Descanso largo* |
| Registrar un evento de vínculo por botón | ✅ **Hecho.** Un botón por evento y compañero, en la misma pestaña |

En esos tres casos lo que falta **no es la mecánica, es dónde está**: mudarlos al HUD es un trabajo mucho menor que construirlos, y conviene no pagarlo dos veces.

**El hueco que sí existe, y que no estaba escrito:**

> `world-map-renderer.js` tiene `onTokenClick`, pero **no tiene `onCellClick`**. Hoy hacer clic en una casilla vacía no hace nada en absoluto. Y `handleCombatTokenClick` solo alterna la selección de tu propia ficha: si pulsas un enemigo, sale por un `return` en la primera línea.

**Toda la batería K1 cuelga de ese primitivo que no existe.** Por eso es la tarea cero.

### La regla del clic

Atacar es irreversible y gasta la acción del turno. Si «clic en el enemigo» atacara, un clic mal dado te costaría el turno. Así que una regla sola, fácil de recordar y de comprobar:

> ### Un clic nunca gasta nada. Un botón sí.

| Gesto | Qué hace | Por qué |
| :--- | :--- | :--- |
| Clic en tu ficha | La selecciona y enciende las casillas alcanzables | No gasta nada |
| Clic en casilla iluminada | Mueve | El movimiento es reversible dentro del turno |
| Clic en un enemigo | Abre su tarjeta: *Objetivo · CA · distancia* | No gasta nada |
| **Botón** de la tarjeta | Ataca, o usa el definitivo | Gasta la acción, y lo has pedido |

La tarjeta es además donde caben *Atacar*, *Definitivo* y lo que venga después, sin inventar otro sitio.

### Hecho el 2026-09-21: K0 y K1

- **`onCellClick`** existe. Solo las casillas **encendidas** lo reciben: la capa de resaltado lleva `pointer-events: none` y cada casilla pulsable lo recupera. Una casilla apagada es una a la que no puedes ir, y un clic ahí no hace nada.
- **Pulsar un enemigo abre su tarjeta** (`combat/target-card.js`, 11 tests): PG, CA con la cobertura desglosada, distancia, y los botones *Atacar* y *Golpe definitivo*. Cuando algo no se puede, **dice por qué** — *«Fuera de alcance: 30 ft de 5 ft»*— en vez de no responder.
- **La regla se comprueba en el navegador**, paso 29: pulsar al enemigo **no gasta la acción del turno**, y pulsar el botón sí.

**Un fallo que salió al montar esto**, y que llevaba dos pasadas colgando el recorrido: `/objetivos editar` abre un popup, y su promesa no resuelve hasta que alguien lo cierra. El paso la esperaba con `await`, así que el recorrido se quedaba esperando para siempre — sin fallar, sin avanzar. Ahora se lanza sin esperarla, como el resto de comandos que abren interfaz.

### Hecho el 2026-09-21: K2, K3, K4a y K4b

**K2 — los encuentros ya no se anuncian solo en el registro.**

- **Cartel de *¡INICIATIVA!*** cuando despierta una sala o cuando empieza un combate. No se puede pulsar a propósito (`pointer-events: none`): avisa, no decide, y no roba un clic destinado al tablero.
- **Botón *Iniciar combate*** junto al tablero cuando el libro dibujó enemigos en una sala ya revelada y nadie pelea. Empieza el encuentro con **esos** enemigos, en **sus** casillas — que es media razón de ser de un libro de mazmorras.
- **El relevo, con botones**: al derrotar a alguien salen los compañeros válidos y se pulsa uno. La oferta se retira sola a los 20 segundos; el combate no se queda esperando una decisión.

**K3 — el reloj.** Día, momento del día y los cuatro botones (*Pasar el rato*, *Dormir*, *Descanso corto*, *Descanso largo*) en la cabecera del Modo Juego. Peleando se quedan **apagados con el motivo escrito** (*«No mientras peleas»*), y el descanso corto se apaga si al grupo no le quedan dados de golpe. Siguen estando en la pestaña Campaña: con el Modo Juego apagado, ese es el único sitio donde existen.

**K4a — las fichas de acción.** Una fila bajo el chat, justo donde escribirías lo mismo a mano. Todas salen del estado: las puertas cerradas del tablero (con su casilla), los compañeros, el descanso corto si hay heridas y dados, entrar en un tablero, viajar, salir. Lo único que sale del texto es **a quién nombra la última narración**, y solo para ponerlo primero: nombrar a alguien no lo crea. Peleando desaparecen — la barra de combate ya manda.

**K4b — la ficha de compañero.** Pulsar una cara de la franja del grupo abre su ficha: rango, progreso, perks, los botones de evento de vínculo de siempre, y dos nuevos. *Pasar tiempo* suma 2 y **gasta un bloque del día**. *Regalar* le da un objeto de los que lleva el líder: lo que le parezca sale de `likes` y `dislikes` de su ficha — sin esas listas, un regalo **no da puntos**, que es mejor que dar puntos por cualquier cosa.

> **Lo que todavía no hace**: `likes` y `dislikes` se escriben hoy en el Lorebook del personaje; no hay casilla para ellos en la ficha del grupo. Y las fichas de acción no traen nada del modelo: lo que se puede hacer sale del motor, y por eso es gratis y no puede mentir.

### Tres fallos que **solo** salieron en el navegador

Los tres pasaban los tests de unidad sin despeinarse. Son el argumento entero de por qué el paso 29 y el 30 existen:

1. **Pulsar tu propia ficha no encedía nada.** La culpa no era del clic sino del arrastre: soltar el ratón sin haber movido avisaba igualmente de un movimiento, eso redibujaba el tablero entero, y el redibujado se llevaba por delante la ficha **antes** de que el `click` llegara a dispararse. Ahora soltar sin mover es un clic, no un movimiento.
2. **La casilla en la que ya estás se encendía como destino.** Pulsarla gastaba cero pies y tu propia ficha, dibujada encima, se comía el clic. Ya no se enciende: quedarse quieto no es moverse.
3. **Pulsar una casilla te movía a la de arriba a la izquierda.** `/combat-move` habla en los números que el tablero dibuja en los ejes, que empiezan en **1**; el renderizador cuenta desde **0**. Un único `+1` de diferencia, invisible para cualquier test que no mire dónde acabó la ficha de verdad.

### Lo que el recorrido **no** comprueba

El botón de **Relevo** no le llega: aparece solo al derrotar a alguien teniendo el perk de rango 5 y movimiento de sobra, y eso depende de los dados. Lo que sí está comprobado es la decisión (`planBatonPass`, con tests) y que el botón y `/relevo` llaman a **la misma** función, porque ahora solo hay una.

### Y los comandos **no se borran**

Son por donde entra el recorrido de navegador, y el recorrido es lo que ha cazado casi todos los fallos de este proyecto. Se quedan como la **API probada**; los clics son la piel por encima. Si un clic y su comando hacen cosas distintas, eso es un fallo — y así se puede detectar.

---

## 📊 1. Matriz de Migración: De la Consola al Ratón

Todo lo que hoy requiere escribir un comando tiene un equivalente natural en un videojuego:

| Acción de Juego | Cómo se hace hoy (Comando) | Cómo se hará (100% Visual / Clics) |
| :--- | :--- | :--- |
| **Iniciar combate** | `/fight Goblin 3` | **Clic en el enemigo en el mapa** o botón *"Iniciar Encuentro"* en el panel de sala. |
| **Mover a un personaje** | `/combat-move 12 8` (o arrastrar) | **Clic en el personaje** ➔ Celdas alcanzables se iluminan en verde ➔ **Clic en casilla destino**. |
| **Atacar a un enemigo** | `/combat-attack Goblin 1` | **Clic directo en el token del enemigo** dentro del alcance ➔ Salta retícula de objetivo y animación de impacto. |
| **Terminar turno** | `/combat-end` | Botón grande y destacado **"Fin de Turno"** (o tecla `Espacio`). |
| **Huir / Abandonar combate** | `/combat-stop` | Botón **"Retirada Táctica"** con confirmación en la barra de combate. |
| **Usar Relevo (Baton Pass)** | `/relevo <compañero>` | Al matar a un enemigo, aparece un **botón dorado flotante "Relevo"** sobre los aliados válidos. |
| **Avanzar el día / Descanso corto** | `/descanso corto` | **Clic en el widget del Sol** en la barra superior ➔ *"Tomar un respiro (1 hora)"*. |
| **Dormir / Descanso largo** | `/descanso largo` | **Clic en la Luna** en la barra superior ➔ *"Acampar hasta mañana"*. |
| **Subir vínculo de compañero** | `/bond Lyra confidant_scene` | Clic en el avatar en el Party Strip ➔ Botón **"Pasar tiempo juntos"** o **"Hacer regalo"**. |
| **Consultar objetivos de misión** | `/objetivos` | Widget lateral desplegable de **Misiones Activas** con casillas marcables (`[x]`). |
| **Viajar a otra localización** | `/go <sitio>` | **Clic directo en el marcador del mapa** ➔ Tarjeta con botón *"Viajar aquí"*. |
| **Entrar a una mazmorra / sala** | `/enter <tablero>` | **Clic en la puerta o escalera** en el mapa ➔ Botón *"Entrar a la Cripta"*. |
| **Abrir el compendio de reglas** | `/rules` | Opción **"Compendio"** en el Menú de Pausa (`Esc`) o botón de libro en HUD. |
| **Configurar guardián de dados** | `/rollguard estricto` | Interruptor selector en el menú de pausa: `[Imposibles | Estricto | Off]`. |
| **Ver la ventana de prompt/gasto** | `/prompt` | Botón **"Inspeccionar Sesión"** en las herramientas de pausa. |
| **Alternar Modo Juego / Clásico** | `/modojuego` | Tecla **`Esc`** ➔ Menú de Pausa ➔ *"Modo Clásico SillyTavern"*. |

---

## 🎮 2. Los 5 Sistemas de Interacción por Clics

```mermaid
graph TB
    subgraph S1["⚔️ 1. Tablero Point-and-Click"]
        ClickToken[Clic en tu Token] --> HighlightCells[Celdas verdes de movimiento A*]
        HighlightCells --> ClickCell[Clic en Celda = Movimiento fluido]
        ClickEnemy[Clic en Enemigo en Rango] --> AttackPopup[Retícula de Ataque + Tirada]
    end

    subgraph S2["🚪 2. Puertas y Encuentros Dinámicos"]
        ClickDoor[Clic en Puerta 'D'] --> OpenDoor[Abre puerta + Revela sala con niebla]
        OpenDoor --> AmbushCheck{¿Hay enemigos dentro?}
        AmbushCheck -- Sí --> AutoEncounter[Dispara tirada de Iniciativa automática]
    end

    subgraph S3["☀️ 3. Reloj y Descansos Interactivos"]
        ClickClock[Clic en Widget Sol/Luna] --> RestModal[Modal de Descanso: Corto / Largo]
        RestModal --> AdvanceTime[Avanza reloj y recupera PG]
    end

    subgraph S4["🤝 4. Ficha Social de Compañeros"]
        ClickParty[Clic en Avatar del Party Strip] --> BondModal[Ficha de Confidente Persona]
        BondModal --> HangoutBtn[Botón 'Pasar tiempo' = Dispara diálogo LLM]
        BondModal --> GiftBtn[Botón 'Regalar' = Abre inventario]
    end

    subgraph S5["📜 5. Acciones Rápidas en Diálogo"]
        LLM_Turn[Mensaje del Narrador/DM] --> ActionChips[Chips clicables: [1] [2] [3]]
        ActionChips --> AutoSend[Clic envía la acción sin teclear]
    end
```

---

### Sistema 1: El Tablero Point-and-Click (Gloomhaven Real)
Actualmente para mover arrastras el token o usas comandos, y para atacar usas un select en la barra inferior. El nuevo sistema permite jugar **directamente sobre el lienzo**:

1. **Movimiento Táctico**:
   * Haces **clic sobre tu personaje** activo en el tablero.
   * El motor calcula con `pathfinding.js` y `buildReachableCells` todas las casillas a las que puede llegar con sus pies restantes.
   * Las casillas se iluminan con un resplandor verde esmeralda. Si pasar por una casilla cuesta el doble (terreno difícil `~`), el cálculo lo refleja automáticamente.
   * Haces **clic en la casilla destino**: el personaje se desplaza y el coste se resta de su movimiento de la ronda.

2. **Ataque Táctico con el Ratón**:
   * Si tienes acción disponible, los enemigos dentro del alcance (`attackRangeFeet`) muestran un borde rojo pulsante.
   * Al hacer **clic directo sobre el token enemigo**:
     * Aparece un pequeño indicador flotante sobre él: `Objetivo: Goblin 1 | CA: 12 | Rango: 15 ft | Ventaja: No`.
     * Clic en **"Atacar"**: Se resuelven los dados de inmediato, se resta el daño a su barra de vida y sale el número flotante (`-8`).

3. **Relevo (Baton Pass) Visual**:
   * Cuando tu ataque reduce a un enemigo a 0 PG, sobre los compañeros a los que puedas ceder turno aparece un icono dorado brillante de **"Relevo"**. Un solo clic en su token le transfiere el movimiento restante.

---

### Sistema 2: Exploración de Salas y Disparador de Encuentros (Sin `/fight`)
Ya no tendrás que saber qué enemigos hay para escribir `/fight Goblin 3`:

1. **Puertas Interactivas**:
   * En el mapa de mazmorra, las casillas de puerta (`D`) son interactivas.
   * Al situarte adyacente y hacer **clic en la puerta**, se reproduce el sonido de apertura, la casilla cambia a `o` (puerta abierta) y la niebla de guerra de la sala contigua se desvanece.
2. **Activación Automática de Combate**:
   * Si la sala contiene enemigos, el motor los "despierta" (usando la lógica de `openDoor` que ya tienes en `campaign-map.js`).
   * Salta un banner cinemático en pantalla: **"¡INICIATIVA!"** con la tirada de todos los combatientes y entra al Modo Combate a pantalla completa sin teclear nada.
3. **Encuentros Manuales**:
   * En tableros donde haya monstruos visibles, la barra superior muestra el botón **"⚔️ Iniciar Combate"**.

---

### Sistema 3: Widget de Calendario y Descansos (Sin `/time`)
En la cabecera superior del HUD, el reloj no es solo texto informativo: es un **centro de control temporal**:

```text
[ 🌅 Día 4 · Tarde ]  <-- Clic aquí despliega:
+----------------------------------------------------+
| ☀️ Pasar el rato (1 hora) - Descanso corto         |
| 🌙 Acampar hasta mañana (8 horas) - Descanso largo |
| 🛡️ Organizar guardias nocturnas                   |
+----------------------------------------------------+
```
* **Clic en "Descanso corto"**: Abre el modal de Dados de Golpe para curar vida sin avanzar todo el día.
* **Clic en "Descanso largo"**: Restablece la vida al 100%, recarga recursos y pasa la pantalla a la mañana del **Día 5**.

---

### Sistema 4: Ficha Social y Vínculos Persona (Sin `/bond`)
En el **Party Strip** (la franja inferior que muestra la vida de tus compañeros):
* Cada avatar es un botón interactivo.
* Al hacer clic en **Lyra**:
  * Se abre su **Ficha de Confidente Persona**:
    * Retrato grande y Arcano.
    * Barra de afinidad visual con su rango actual (ej. *Rango 4: 28/36 puntos*).
    * Árbol de Perks: cuáles tiene activas y qué desbloquea el Rango 5 (*Relevo*) o Rango 8 (*Aguantar*).
    * **Botón "Pasar la tarde con ella"**: Consume el bloque horario actual y envía automáticamente un prompt al LLM para abrir una escena íntima de confidente en la pantalla de Diálogo.
    * **Botón "Ofrecer un regalo"**: Despliega los objetos del inventario para seleccionar uno.

---

### Sistema 5: Diálogo con Opciones Rápidas (Action Chips)
Para no tener que escribir siempre en el teclado durante los momentos de exploración o investigación:
* Al final de cada turno narrativo, debajo del mensaje aparecen **3 o 4 botones contextuales** (Action Chips):
  * `[ 🔍 Investigar el sarcófago ]`
  * `[ 🚪 Cruzar la puerta norte sigilosamente ]`
  * `[ 💬 Preguntar a Lyra por las runas ]`
* **Hacer clic en cualquiera de ellos lo envía como tu acción al instante**.
* Y si quieres rolear algo creativo, la caja de texto sigue ahí abajo para escribir libremente.

---

## 🛠️ 3. Hoja de Ruta Ejecutable (4 Baterías)

**El orden importa**: K0 no tiene sustituto —sin ella no hay nada que pulsar— y K3 y K4b son mudanzas, no construcciones.

| Batería | Nombre | Tareas concretas | Estado |
| :---: | :--- | :--- | :--- |
| **K0** | **El primitivo que falta** | • `onCellClick` en `world-map-renderer.js`: una casilla que se puede pulsar.<br>• `handleCombatTokenClick` deja de rechazar a los enemigos.<br>• La regla del clic, escrita y con tests. | ✅ **Hecho el 2026-09-21** |
| **K1** | **Point-and-Click en el tablero** | • Clic en tu ficha → casillas alcanzables encendidas.<br>• Clic en casilla iluminada → mover, descontando el coste.<br>• Clic en enemigo → tarjeta de objetivo.<br>• Botón *Atacar* y *Golpe definitivo* en la tarjeta. | ✅ **Hecho el 2026-09-21** |
| **K2** | **Lo que falta de los encuentros** | • Banner de *¡INICIATIVA!* al despertar una sala.<br>• Botón *Iniciar combate* cuando hay enemigos visibles y nadie pelea.<br>• Botón flotante de *Relevo* sobre los aliados válidos al derrotar a alguien. | ✅ **Hecho el 2026-09-21** |
| **K3** | **El reloj del HUD** | • Los cuatro botones de la pestaña Campaña, ahora también en la cabecera del Modo Juego.<br><br>*Siguen estando en la pestaña: con el Modo Juego apagado es el único sitio donde existen.* | ✅ **Hecho el 2026-09-21** |
| **K4a** | **Action Chips** | • Fichas clicables bajo el chat, **todas derivadas del motor**: las puertas cerradas que hay, los compañeros presentes, si se puede descansar, a dónde se puede ir.<br>• Lo único que sale del texto es **a quién nombra la última narración**, y solo para ponerlo delante. | ✅ **Hecho el 2026-09-21** |
| **K4b** | **Ficha social** | • Pulsar una cara de la franja del grupo abre su ficha, con los botones de evento de vínculo.<br>• *Pasar tiempo* gasta un bloque del día; *Regalar* gasta el objeto. | ✅ **Hecho el 2026-09-21** |

---

## 🧪 4. Verificación: La Prueba del "Ratón Exclusivo"

✅ **Hecha el 2026-09-21**, en los pasos **29** y **30** de `tools/e2e-campaign.mjs`. El recorrido entero: **237 comprobaciones, todas verdes, y ni un error de consola.**

Lo que hacen esos dos pasos, todo con `.click()` de verdad sobre Edge:

1. Clic en tu ficha → se encienden las casillas alcanzables, y son pulsables.
2. Clic en la casilla que más te acerca al enemigo → la ficha acaba **en esa casilla exacta**.
3. Clic en el enemigo → se abre su tarjeta con sus números, y **la acción del turno sigue sin gastarse**.
4. Botón *Atacar* → el golpe se resuelve, queda en el registro, gasta la acción y cierra la tarjeta. Si el tablero no deja llegar al cuerpo a cuerpo, lo que se comprueba es que el botón **diga por qué** (*«Fuera de alcance: 10 ft de 5 ft»*) — las dos ramas están cubiertas.
5. El reloj: cuatro botones, *Pasar el rato* mueve el día de verdad, y peleando se apagan con el motivo escrito.
6. Una cara de la franja → su ficha → *Pasar tiempo* sube el vínculo **y** gasta un bloque del día.
7. Las fichas de acción salen del estado, y la de hablar deja la frase empezada sin enviarla.
8. *Iniciar combate* → empieza con lo que el libro dibujó, sale el cartel de **¡INICIATIVA!**, y el cartel no roba clics.
9. *Fin de turno* → el turno pasa de verdad.

La puerta ya la pulsa el paso 24, que además comprueba que despierta lo que dormía detrás.

---

## 🔗 Enlaces Relacionados
- [[HOME]]: Hub central de la wiki.
- [[PROPUESTA_FRONTEND_MODO_JUEGO]]: Arquitectura del Game Shell y las 3 pantallas.
- [[PLAN_JUEGO_TIPO_FRIENDS_AND_FABLES]]: El plan hacia la experiencia completa de rol con IA.
