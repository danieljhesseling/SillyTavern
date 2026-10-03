---
title: Lo oculto — lo que se esconde, no se borra
tags: [oculto, decisiones, sin-conexion, modo-guiado]
created: 2026-10-03
---

# 🙈 Lo oculto

> **Qué es esto:** lo que el juego sin conexión **esconde** pero **no borra**. El código, los datos y las pruebas siguen ahí, detrás de un interruptor, para volver a sacarlos cuando tengan sentido: con la capa de IA (J17), con el modo mundo semiabierto o cuando estén más cuidados.
> **La regla:** nada de lo que se esconde se borra. Cada cosa dice qué es, por qué se esconde, dónde está el interruptor y cuándo volvería.

| Qué | Por qué se esconde | Interruptor | Cuándo volvería |
| :--- | :--- | :--- | :--- |
| **Los gestos de los retratos** (alegre, enfadado, triste) | Aún no quedan bien (D-J61) | `PORTRAIT_MOODS` en `public/scripts/game-engine/ui/pixel-art.js` | Cuando los gestos estén más cuidados |
| **La simulación de facciones** (relojes, quién manda, precios y sucesos de facción) | El foco es un D&D puro; tiene sentido en un mundo vivo (D-J58) | `FACTION_WORLD` en `public/scripts/game-engine/campaign/factions.js` | Con el modo mundo semiabierto |
| **Los plazos del hilo** (J9.5) | Por ahora no (D-J46) | `STORY_DEADLINES` en `public/scripts/game-engine/campaign/plot.js` | Cuando se decida |
| **El narrador** en la caja de la novela | La historia la cuenta la gente (D-J60) | El juego sin conexión no lo enseña; con conexión sigue | Con la capa de IA, si se quiere |
| **La fila de acciones libres del pueblo** (tablón, mercenarios, encargos, personajes, mirar, rumores, «Tirada»…) y **«Viajar» a cualquier sitio** | Da demasiada libertad sin la IA y sin el mundo semiabierto (D-J62). Lo del gremio ya está dentro de la Casa del Gremio | El modo guiado (lo está poniendo un agente; aquí irá su nombre) | Con la capa de IA o el modo mundo semiabierto |
| **«Tableros de aquí»** (entrar en un tablero a mano) | Entrar en un tablero no es algo que el jugador haga porque sí: se entra porque la historia o un encargo te lleva (D-J62) | El modo guiado | Con el modo mundo semiabierto |
