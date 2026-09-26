---
title: Mapa Completo del Código & Estructura de Archivos
tags: [codigo, estructura, mapa, directorios, backend, frontend, fork, dnd]
created: 2026-09-20
updated: 2026-09-26
author: DanielJHesseling / Antigravity AI
---

# Mapa Completo del Código & Estructura de Archivos

Este documento sirve como inventario exhaustivo del repositorio, clasificando los archivos y carpetas clave entre los componentes base de SillyTavern y las extensiones introducidas en el fork de DanielJHesseling.

---

## 1. Directorios Principales del Repositorio

| Directorio | Propósito & Contenido | Origen |
| :--- | :--- | :--- |
| `src/` | Código fuente del servidor Node.js (Express, routers, middleware, utilidades). | SillyTavern Core |
| `src/endpoints/` | Más de 40 routers REST modulares para personajes, chats, IA y configuración. | SillyTavern Core |
| `src/middleware/` | Filtros HTTP: protección CSRF, whitelist de IP, host headers, auth. | SillyTavern Core |
| `src/vectors/` | Motor RAG vectorial local basado en Vectra y transformers.js. | SillyTavern Core |
| `src/png/` | Extractor e inyector de metadatos en chunks tEXt/iTXt de imágenes PNG. | SillyTavern Core |
| `public/` | Código fuente del cliente web servido al navegador (HTML, CSS, JS, libs). | SillyTavern Core + Fork |
| `public/scripts/` | Módulos ES de lógica de frontend. | SillyTavern Core + Fork |
| `public/scripts/game-engine/` | **Motor de juego del fork**: tablero, combate, campaña, reglas e interfaz. Módulos puros, probados en Node. | Fork |
| `public/scripts/party/` | Piezas extraídas de `party.js` por las costuras que los tests cubren. | Fork |
| `tools/` | Comprobaciones propias: tipos, cableado, forma del prompt, claves de estado, densidad del mundo, el conversor del guion y los recorridos en navegador. | Fork |
| `public/css/` | Hojas de estilo CSS del cliente. | SillyTavern Core + Fork |
| `public/lib/` | Bibliotecas de terceros (jQuery, jQuery UI, Select2, Toastr, etc.). | SillyTavern Core |
| `data/` | Directorio de almacenamiento de datos persistentes por usuario. | Generado en runtime |
| `default/` | Plantillas de configuración y assets por defecto (`config.yaml`). | SillyTavern Core |
| `plugins/` | Directorio para plugins de servidor adicionales en Node.js. | SillyTavern Core |
| `tests/` | Suite de pruebas automatizadas (Jest y Playwright). | SillyTavern Core |
| `docker/` | Archivos de configuración para despliegues con Docker y Docker Compose. | SillyTavern Core |
| `wiki/` | Esta base de conocimiento para Obsidian y agentes de IA. Los planes cerrados, en `wiki/archivo/`. | Documentación |
| `public/compendio/` | La biblioteca de contenido: un JSON por dominio (bestiario, armas, sitios, habilidades…). | Fork |
| `public/mundos/` | Los mundos para elegir (`mundos.json`, con sus héroes hechos) y el paquete de 1387. | Fork |

---

## 2. Inventario de Archivos Clave del Motor RPG (Fork `my-silly`)

> [!NOTE]
> **Regenerado el 2026-09-26 desde el código**: las líneas se cuentan y la descripción es la primera frase del comentario de cabecera de cada módulo. Si una descripción no se entiende, lo que hay que arreglar es ese comentario.

### 2.1. El motor de juego — `public/scripts/game-engine/` (234 archivos, 50.348 líneas)

Módulos puros: sin DOM, sin estado global, sin lecturas del chat. Por eso se prueban en Node y el coste de merge es cero. Todos los carga el juego salvo los marcados ⬜ (`node tools/check-engine-wiring.mjs` lo comprueba).

#### `board/` — El tablero: terreno, caminos, visión, niebla y el terreno vivo (9 archivos, 2.076 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `dungeon-levels.js` | 93 | Mazmorras de varios tableros, con escaleras y estado que persiste (idea 75). |
| `fog-of-war.js` | 189 | Fog of war. |
| `hazards.js` | 355 | Lo que hay en el tablero y se dispara: trampas, sucesos de ronda y estados que crecen. |
| `line-of-sight.js` | 201 | Line of sight and visible area over the board terrain. |
| `living-terrain.js` | 147 | El tablero cambia mientras se pelea: el fuego se extiende y las puertas se rompen (idea 23, que amplía el fuego de la fase T5). |
| `pathfinding.js` | 262 | A* pathfinding over the board terrain. |
| `reachability.js` | 160 | ¿Se puede llegar? La pregunta que un libro generado nunca se hace. |
| `terrain.js` | 516 | Board terrain: walls, cover, difficult ground and doors. |
| `walk.js` | 153 | Andar por el tablero cuando no hay nadie peleando. |

#### `combat/` — El combate: turnos, IA enemiga, papeles, maniobras, botín y jefes (27 archivos, 4.533 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `ally-ai.js` | 261 | Cómo pelea un compañero que se lleva solo. |
| `barks.js` | 259 | Lo que dicen los compañeros en combate, sin llamar al modelo (C7). |
| `bond-perks.js` | 191 | What a bond actually does in a fight. |
| `boss-phases.js` | 68 | Jefes con fases: al bajar de la mitad, un jefe cambia (la P22, R6 del roadmap de profundidad). |
| `boss-reaction.js` | 61 | La reacción del jefe: una por ronda (idea 24). |
| `combat-hold.js` | 53 | Las puertas que un combate cierra mientras dura, y lo que se dice al encontrarlas cerradas. |
| `condition-timers.js` | 119 | Condiciones que se van solas. |
| `crits.js` | 105 | Criticos con efecto, rol del enemigo y moral (ideas 15, 13 y 6). |
| `enemy-abilities.js` | 145 | Cuándo un enemigo usa una habilidad en vez de pegar. |
| `enemy-ai.js` | 475 | Tactical enemy AI. |
| `enemy-roles.js` | 153 | Enemigos con cabeza: cada uno tiene un papel, y su bando una forma de pelear (R7 del roadmap de profundidad). |
| `forecast.js` | 101 | Lo que va a pasar, antes de que pase: la probabilidad de un golpe y lo que hace, y a por quien va cada enemigo. |
| `initiative-tracker.js` | 247 | The initiative tracker: who is acting, who is next, and what is wrong with them. |
| `loot-items.js` | 140 | What a piece of loot actually *is*. |
| `loot.js` | 226 | What winning is worth. |
| `maneuvers.js` | 428 | Las maniobras: lo que se puede hacer en combate además de pegar. |
| `opportunity.js` | 110 | Ataques de oportunidad: por qué la posición importa. |
| `readied.js` | 74 | Preparar una acción: «si alguien se me acerca, le pego» (idea 4). |
| `retreat.js` | 62 | Huir de un combate, con su precio. |
| `roll-guard.js` | 198 | Catches dice results the model made up and replaces them with the engine's. |
| `scenario-board.js` | 102 | The bridge between a fight in progress and the scenario rules. |
| `seeded-random.js` | 97 | Dice you can roll twice and get the same answer. |
| `spawn.js` | 95 | Where the enemies stand when a fight begins. |
| `tally.js` | 140 | La cuenta de un combate: quien hizo cuanto daño, a quien tumbo y cuanto se llevo. |
| `target-card.js` | 106 | What the card over an enemy says, and which buttons it offers. |
| `throwables.js` | 190 | Lo que se lanza en combate: un frasco de aceite que arde y una red (idea 122). |
| `turn-machine.js` | 327 | Combat turn machine: initiative, rounds and the action economy. |

#### `rules/` — Las reglas: paquete de reglas, habilidades, grimorio, modos, heridas, subida de nivel (30 archivos, 6.680 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `abilities.js` | 402 | Habilidades: conjuros, técnicas y recursos de clase, con las mismas piezas. |
| `area.js` | 170 | Las formas en la cuadrícula: a quién toca una habilidad de área (R3 del roadmap de profundidad). |
| `checks.js` | 200 | Las tiradas de habilidad fuera de combate: las tira el motor, el narrador lee el resultado. |
| `class-trees.js` | 188 | Un árbol pequeño por clase: tres ramas de tres (idea 48). |
| `companions.js` | 247 | Por qué alguien va contigo, y por qué a veces no. |
| `death-saves.js` | 174 | Caer a 0 no es morir: es empezar a jugárselo. |
| `default-ruleset.js` | 369 | The default rule pack: D&D 5e as this engine plays it. |
| `editor-model.js` | 344 | The model behind the rules editor: turning a rule pack into something editable, and back, without touching the DOM. |
| `equipment-sets.js` | 88 | Juegos de equipo guardados: cambiar de todo lo que se lleva en un clic (idea 62). |
| `equipment.js` | 302 | Que lo que llevas encima signifique algo. |
| `field-uses.js` | 249 | Las habilidades fuera del combate: cada una enganchada a un sistema que ya existe (R3 del roadmap de profundidad). |
| `give-item.js` | 48 | Darle algo a otro del grupo (idea 163). |
| `grimoire.js` | 423 | El grimorio: **toda la magia que existe**, escrita en el código (R4 del roadmap de profundidad). |
| `injuries.js` | 311 | Lo que un combate te deja encima cuando ya ha terminado. |
| `languages.js` | 107 | Los idiomas, que ahora importan (idea 59). |
| `level-perks.js` | 135 | Subir de nivel como momento: una mejora a elegir entre tres (idea 46). |
| `level-up.js` | 300 | Subir de nivel: lo que cambia, y quién lo decide. |
| `magic-items.js` | 120 | Pergaminos y varitas: la magia del grimorio en un objeto (R4 del roadmap de profundidad). |
| `modes.js` | 429 | Los modos de juego: qué sistemas existen en esta partida (R1 del roadmap de profundidad). |
| `mortality.js` | 178 | Qué pasa cuando alguien se queda sin salvaciones, y cuándo se puede guardar. |
| `needs.js` | 235 | Comer, beber, dormir y no morirse de frío. |
| `pair-moves.js` | 81 | Ataques en pareja: con vínculo, dos pelean como uno (R3 del roadmap de profundidad). |
| `remedies.js` | 157 | Lo que se puede hacer con una herida que no cura. |
| `respec.js` | 70 | Rehacerse en el templo: volver a elegir las mejoras de nivel, pagando (idea 58). |
| `rest.js` | 218 | Short and long rests. |
| `roll-line.js` | 66 | Una sola forma de decir una tirada (idea 146). |
| `rule-impact.js` | 157 | What a change to the rules would break. |
| `ruleset.js` | 464 | Rule packs: the content the engine plays with, as data rather than code. |
| `tags.js` | 201 | Las etiquetas de elemento: lo que una habilidad **le hace al mundo**, además del daño (R3 del roadmap de profundidad). |
| `upkeep.js` | 247 | La cuenta: lo que cuesta tener a esta gente viva una semana más. |

#### `campaign/` — La campaña: tiempo, gremio, encargos, vínculos, casos, crónica, mascota, némesis (98 archivos, 18.927 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `act-summary.js` | 76 | Resumen por acto: el chat viejo se comprime en la memoria del mundo (idea 143). |
| `approval.js` | 180 | Lo que les parece a tus compañeros lo que haces, y cuando chocan entre ellos (ideas 28 y 32). |
| `attitudes.js` | 79 | Cambios de actitud de un PNJ, propuestos por el narrador y con límites (idea 140). |
| `backgrounds.js` | 129 | El trasfondo del personaje, con efecto en las reglas (idea 49). |
| `bench.js` | 102 | El banquillo del gremio: más compañeros que huecos, y rotar quién sale (idea 42). |
| `body.js` | 69 | Cómo está el grupo, en una línea para el narrador (C1). |
| `bonds.js` | 300 | Social bonds: ranks one to ten, and the combat perks they unlock. |
| `calendar.js` | 194 | Campaign calendar: days and the slots inside them. |
| `camp-talk.js` | 98 | Charlas de campamento entre dos compañeros, y rondas con tema en la posada (ideas 31 y 40). |
| `camp.js` | 188 | El campamento como escena: el fuego, las guardias, la charla y la cena (idea 67, y la propuesta P16 de los encuentros de noche). |
| `campaign-delete.js` | 114 | Borrar una campaña: qué se va con ella, y qué se dice antes de tocar nada. |
| `campaign-editor.js` | 818 | El editor de campaña: escribir a mano lo que hasta ahora solo traía un libro. |
| `campaign-export.js` | 352 | Empaquetar una campaña: el camino de vuelta del importador. |
| `campaign-importer.js` | 645 | From a campaign pack to a world you can play. |
| `campaign-map.js` | 403 | Rooms, doors and the campaign map. |
| `campaign-pack-schema.js` | 633 | The contract between a campaign pack and this engine. |
| `campaign-pack.js` | 548 | The campaign pack: reading one, and saying what is wrong with it. |
| `campaign-view.js` | 110 | What the campaign panel shows: the day, and where every bond stands. |
| `campaign-worlds.js` | 77 | Worlds and campaigns are two different things, and the UI had drifted into treating them as one. |
| `cases.js` | 297 | Casos con verdad: un misterio que el motor sabe y el narrador no (U8 del pegamento; la Propuesta 2 de wiki/PROPUESTAS_BUCLE_DE_JUEGO.md, fase F1). |
| `check-requests.js` | 97 | El narrador pide una tirada; la tira quien juega (idea 138). |
| `checkpoint.js` | 147 | El punto de retorno: lo que hace que probar algo difícil no dé miedo. |
| `chronicle.js` | 162 | Una sola crónica: lo que pasó, con categoría, sacado de lo que el juego ya cuenta (U4 del pegamento). |
| `companion-arcs.js` | 186 | Compañeros con arco: lo que cambia en alguien cuando se cumple lo suyo, los confidentes que ayudan sin venir, y quien se fue y vuelve (R8 del roadmap de profundidad). |
| `company.js` | 101 | El grupo como grupo: moral, oficios de campamento y duelo (ideas 39, 41 y 43). |
| `contracts.js` | 393 | El tablón de encargos: por qué sales de casa. |
| `crime.js` | 101 | Ley y crimen: robar sube «buscado», y aparecen guardias (idea 96). |
| `departures.js` | 59 | Se van: un compañero harto se marcha (idea 29). |
| `dice-log.js` | 72 | El historial de dados (idea 168): ¿el dado me odia? |
| `director.js` | 66 | Modo director: añadir un PNJ o un sitio en mitad de la partida (idea 185). |
| `dispatch.js` | 186 | Los despachos: mandar compañeros sin el héroe a un encargo menor (U8 del pegamento; la fase F3 de la Mesa de la Semana en wiki/PROPUESTAS_BUCLE_DE_JUEGO.md). |
| `economy.js` | 237 | Lo que cuesta vivir donde vives, que depende de quien mande. |
| `encounter-editor.js` | 117 | Which enemies a board can field, as rows you can edit. |
| `epilogues.js` | 81 | El epílogo de cada compañero: qué fue de él cuando todo acabó (idea 109). |
| `factions.js` | 799 | Facciones: lo unico del mundo que tiene planes propios. |
| `fame.js` | 103 | La fama del grupo, sitio a sitio (idea 52). |
| `feats.js` | 233 | Lo que cada uno lleva encima de la campaña: hazañas, apodos, rasgos y cicatrices. |
| `forage.js` | 42 | Cazar y forrajear (idea 68): el hambre tiene respuesta fuera del pueblo. |
| `guests.js` | 127 | Quien va con el grupo solo un encargo: el que se escolta y el mercenario (ideas 105 y 131). |
| `guidance.js` | 256 | Que nadie se quede sin saber que hacer: el diario, las pistas que escalan y la lista de lo que se puede hacer aqui (ideas 100, 103 y 136). |
| `guild.js` | 351 | El gremio: la capa que convierte un grupo en una compañía. |
| `guion-errors.js` ⬜ | 108 | Los errores del guion, dichos para quien lo escribe (idea 174). |
| `hero-fit.js` | 59 | El mundo se adapta al héroe: hitos opcionales según el trasfondo (idea 184). |
| `hero.js` | 245 | Quién eres tú: el personaje con el que empiezas a jugar. |
| `illustrations.js` | 76 | Ilustraciones de sitios y gente con PixelLab, opcional (idea 183). |
| `intents.js` | 39 | Leer la intención mientras se escribe (idea 137). |
| `item-lore.js` | 208 | El botín que se recuerda, y el que muerde (ideas 119 y 135). |
| `item-offers.js` | 118 | El narrador propone objetos, y quien juega los acepta (idea 139). |
| `legacy.js` | 173 | Lo que queda de quien muere (ideas 36 y 199). |
| `letters.js` | 87 | Cartas que esperan en la posada (idea 113): el mundo os busca a vosotros. |
| `masters.js` | 90 | Maestros: aprender una habilidad en un pueblo, con oro y días (idea 54). |
| `memories.js` | 93 | Lo que el grupo recuerda haber vivido junto. |
| `mix.js` | 90 | La mezcla: de dónde sale cada cosa nueva que el mundo necesita (M7). |
| `named-contracts.js` | 87 | Encargos que te nombran: el tablón habla de ti según tu trasfondo (idea 116). |
| `narration.js` | 41 | Cuánto se extiende el narrador, y el modo ahorro (ideas 149 y 148), desde la partida. |
| `narrator.js` | 212 | El narrador de una campaña: quién la cuenta, y con qué voz. |
| `nemesis.js` | 143 | La némesis: quien escapa vuelve (R7 del roadmap de profundidad). |
| `npc-secrets.js` | 108 | Secretos que se destapan (idea 110). |
| `objective-editor.js` | 351 | The objectives of a board, as rows you can edit. |
| `patronage.js` | 263 | Cuando no llega para pagar la semana: alguien paga por ti, y te cobra en favores. |
| `personal-quests.js` | 96 | El encargo personal de cada compañero, al llegar a vínculo 3 (idea 30). |
| `pet.js` | 376 | La mascota: alguien pequeño que acompaña al héroe, comenta lo que pasa y ayuda sin pelear (R5 del roadmap de profundidad). |
| `plot-graph.js` | 93 | El hilo como grafo que se toca: mover hitos de acto, cambiar cómo se abren y qué piden (idea 176). |
| `plot.js` | 709 | El hilo: lo que tienes entre manos. |
| `premade-heroes.js` | 124 | Los héroes hechos de un mundo: entrar a jugar sin crear a nadie (R1, la partida rápida). |
| `prisoners.js` | 94 | Los prisioneros (idea 7): lo que pasa con quien se rinde. |
| `recruit.js` | 174 | Los confidentes: gente del mundo que puede unirse al grupo. |
| `relics.js` | 68 | Las reliquias del mundo: objetos con nombre y con historia, ligados a un momento (idea 132). |
| `rivals.js` | 54 | Aventureros rivales: otra compañía que compite por los mismos encargos (idea 94). |
| `rumors.js` | 79 | Los rumores: lo que se oye en cada sitio. |
| `safety-net.js` | 72 | La red de seguridad: tras dos derrotas seguidas, el siguiente encuentro baja un escalón (idea 25). |
| `save-card.js` | 68 | Cargar partida de un vistazo: el día, el sitio, lo que tenéis entre manos y quién va (idea 160). |
| `scenarios.js` | 306 | Scenario objectives and quest state. |
| `scene-tone.js` | 82 | El tono de la escena: tensa, cómica, sombría o épica, en un bloque del prompt (idea 142). |
| `seed.js` | 149 | La semilla de un mundo: lo que hace que dos campanas de la misma idea no se parezcan. |
| `services.js` | 149 | Los servicios de una localidad: la posada, la herrería, el templo, el tablón (fase L). |
| `session-log.js` | 166 | El diario de sesión: en qué se ha ido esta sesión de juego (U0 del pegamento). |
| `share-code.js` | 56 | El código de un mundo: la semilla y de dónde sale, para jugar el mismo mundo sin pasarse archivos (idea 180). |
| `shop.js` | 167 | La tienda (fase L5) y lo que se hace en ella: vender la chatarra, regatear, precios que se explican y género que cambia cada semana (ideas 118, 126, 127 y 134). |
| `starter-templates.js` | 370 | Starter templates: a playable world in one click. |
| `state-registry.js` | 274 | El registro del estado: todo lo que una partida guarda, declarado una vez (U2 del pegamento). |
| `stats.js` | 64 | La partida en números (idea 200): lo que se cuenta al final, y en el diario mientras. |
| `storage.js` | 65 | El almacén del gremio: lo que no se lleva encima se deja en casa (idea 124). |
| `taller.js` | 984 | El taller: un mundo en trece pasos, con tres formas de empezarlo. |
| `tavern-dice.js` | 145 | Dados en la taberna: «A veintiuno», un minijuego (idea 128). |
| `text-map.js` | 121 | El mapa, en texto: con niebla y con notas (ideas 69 y 70, aparcadas hasta que hubiera mapa; U5 del pegamento). |
| `time-stages.js` | 121 | Un solo paso del tiempo: las etapas, en orden, declaradas una vez (U3 del pegamento). |
| `trophies.js` | 168 | Lo que se saca de los bichos, y lo que el herrero hace con ello (ideas 121 y 120). |
| `upcoming.js` | 143 | Lo que viene: los plazos de todos los relojes, en una lista con fecha (U3 del pegamento). |
| `veterans.js` | 70 | Héroes veteranos: traer tu personaje de otra campaña (idea 179). |
| `villain.js` | 74 | Un villano que se deja ver en mitad del hilo, no solo al final (idea 115). |
| `week-table.js` | 200 | La Mesa de la Semana: los asuntos que no caben todos, cómo os ven y lo que pasó (U5 del pegamento; la Propuesta 1 de wiki/PROPUESTAS_BUCLE_DE_JUEGO.md). |
| `word-duel.js` | 251 | El Duelo de Palabras: una conversación que importa, jugada en rondas (U6 del pegamento; la Propuesta 3 de wiki/PROPUESTAS_BUCLE_DE_JUEGO.md). |
| `world-density.js` | 306 | ¿Llega este mundo al listón? El comprobador de densidad (M6), como pieza del motor. |
| `world-echoes.js` | 109 | El mundo que responde: lo que hacéis deja huella (R9 del roadmap de profundidad). |
| `world-memory.js` | 190 | Que el mundo se acuerde de lo que hacéis. |
| `world-preview.js` | 72 | Vista previa del mundo: los sitios con sus caminos, las facciones y el hilo por actos (idea 175). |
| `written-contracts.js` | 199 | Los encargos que trae escritos un mundo, y cuándo salen en el tablón. |

#### `world/` — El mundo: viaje, crecimiento, estaciones (14 archivos, 1.974 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `festivals.js` | 69 | Las fiestas de cada sitio (idea 89): un calendario con vida. |
| `fortune.js` | 81 | Como le va a cada sitio por lo que hizo (o no hizo) el grupo (idea 85). |
| `growth.js` | 196 | El mundo crece mientras juegas (fase G). |
| `mounts.js` | 99 | Monturas: menos días de viaje, a cambio de oro y de pienso (idea 129). |
| `neighbours.js` | 143 | Los vecinos: que un mundo nuevo tenga a donde ir. |
| `news.js` | 108 | Las noticias que esperan a que llegues (idea 82). |
| `people-fate.js` | 126 | La gente se muda o muere por lo que pasa en el mundo (idea 87). |
| `road.js` | 148 | Lo que sale al paso por el camino: atajos, cazarrecompensas, mercaderes y paradas (ideas 72, 88, 92 y 71). |
| `seasons.js` | 150 | Las estaciones: el calendario cambia el mapa y lo que vive en él (ideas 74 y 97). |
| `ships.js` | 77 | Pasajes en barco desde los puertos (idea 130). |
| `travel-choices.js` | 129 | Viajar con decisiones: a que ritmo, y que hacer con cada contratiempo. |
| `travel-roles.js` | 86 | Papeles de viaje: quién guía, quién vigila y quién caza (idea 65). |
| `travel.js` | 420 | Viajar: el mundo es una **lista**, no un tablero. |
| `visibility.js` | 142 | El tiempo y la hora en el tablero: niebla, lluvia, viento y noche (ideas 73 y 90). |

#### `world-builder/` — Generadores: mazmorras, formas, tableros con intención, mundos con IA (4 archivos, 1.801 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `board-intent.js` | 501 | Tableros con intención: el generador sabe **para qué** es el tablero (R6 del roadmap de profundidad). |
| `dungeon-generator.js` | 435 | Un sitio donde pelear, construido con una semilla y ni un token. |
| `shapes.js` | 528 | De que forma es un sitio. |
| `world-schema.js` | 337 | The blank canvas: a playable world from one sentence. |

#### `compendio/` — El compendio: la biblioteca de contenido en disco (10 archivos, 2.340 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `ailments.js` | 220 | Lo que le queda a alguien despues: heridas con causa y enfermedades con curso. |
| `bestiary.js` | 249 | Arquetipo × plantilla = bicho. |
| `browser.js` | 93 | El compendio, leido del disco y guardado en memoria. |
| `compendio.js` | 400 | La biblioteca de contenido, y de donde sacan los generadores. |
| `forge.js` | 344 | Forma × material = objeto. |
| `kin.js` | 191 | De que esta hecha la gente y a que se dedica: razas y clases. |
| `names.js` | 150 | Nombres que suenan al sitio del que salen. |
| `people.js` | 260 | Gente que quiere algo. |
| `quests.js` | 195 | Verbo + objeto + giro + recompensa = mision. |
| `skills.js` | 238 | Lo que alguien sabe hacer, sacado del compendio. |

#### `cost/` — El coste: tokens y prompt (2 archivos, 450 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `prompt-meter.js` | 266 | What a turn actually sends, and what it costs. |
| `prompt-order.js` | 184 | A prompt whose beginning does not move. |

#### `ui/` — Interfaz: paneles, ventanas, el taller y el Modo Juego (40 archivos, 11.567 líneas)

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `abilities-panel.js` | 225 | El panel de habilidades: escribir un conjuro sin tocar código, y repartirlo. |
| `audio-settings.js` | 107 | Los ajustes de sonido: cuatro casillas y un volumen. |
| `campaign-editor.js` | 1005 | El panel de `/campana`: el mundo repartido por categorías. |
| `campaign-panel.js` | 248 | The campaign panel: the day, the bonds, and what they unlock. |
| `campaign-schema-panel.js` | 111 | The dialog that hands you the contract for your Gem. |
| `campaign-wizard.js` | 869 | The campaign wizard: one button, three questions, and you are playing. |
| `case-board.js` | 90 | El tablero del caso: lo que se sabe, los sospechosos y acusar (U8 del pegamento; la F3 de «Casos con verdad» en wiki/PROPUESTAS_BUCLE_DE_JUEGO.md). |
| `character-panel.js` | 250 | La ficha, dibujada: lo que se mira, no lo que se edita. |
| `chat-channel.js` | 86 | Who a game message is for. |
| `combat-log.js` | 396 | The combat log. |
| `compendio-panel.js` | 281 | El compendio, visto: que tienes, que te falta y que sale si lo pides. |
| `contradiction-log.js` | 252 | What the model said against what the engine knows. |
| `encounter-editor.js` | 119 | The panel that says which enemies a board can field. |
| `guild-panel.js` | 248 | El panel del gremio: el tablón, la reputación y lo que hay levantado. |
| `hero-creator.js` | 266 | «¿Quién eres?», preguntado al entrar y no al rellenar el formulario del mundo. |
| `mode-panel.js` | 133 | Elegir el modo: tres con nombre y las seis letras sueltas (R1 del roadmap de profundidad). |
| `objective-editor.js` | 203 | The panel that lets a board be *about* something, without opening World Info. |
| `prompt-preview.js` | 233 | The prompt preview: what this turn is about to send, and what the session has cost. |
| `rules-editor.js` | 297 | The rules editor: change what the game is made of without editing JavaScript. |
| `sandbox.js` | 353 | Sandbox: a self-contained board for trying the tactical engine out. |
| `shell/action-chips.js` | 284 | Las fichas de accion: lo que se puede hacer ahora mismo, sin escribirlo. |
| `shell/action-sounds.js` | 110 | Un sonido por acción: el golpe, el crítico, el fallo, la puerta, las monedas (idea 186). |
| `shell/character-sheet.js` | 202 | La ficha que enseña un videojuego, no la que edita un diseñador. |
| `shell/clock-widget.js` | 105 | El reloj del Modo Juego: que dia es, que parte del dia, y que se puede hacer con ella. |
| `shell/companion-card.js` | 177 | La ficha de un companero: quien es, cuanto le importas, y que puedes hacer al respecto. |
| `shell/dialogue-scene.js` | 118 | What the dialogue scene shows: who is talking, how the party is doing, and when it is. |
| `shell/exploration-scene.js` | 148 | What the exploration scene shows: where the party is, what else is on the map, and what is still shut. |
| `shell/game-shell.js` | 1409 | The Game Shell: the full-screen layer the game is played in. |
| `shell/notices.js` | 92 | La bandeja de avisos y el grupo de un vistazo (ideas 159 y 162). |
| `shell/party-strip.js` | 77 | The party, as a row of chips: who is standing, who is hurt, who is down and what ails them. |
| `shell/replies.js` | 55 | Respuestas sugeridas al hablar con alguien (idea 144). |
| `shell/scene-audio.js` | 186 | El sonido del Modo Juego: una pista por escena, y silencio si no la has puesto. |
| `shell/scene-director.js` | 316 | The scene director: which screen the game should be showing. |
| `shell/shortcuts.js` | 38 | Los atajos de teclado del Modo Juego (idea 152), y su chuleta. |
| `shell/speakers.js` | 76 | Quién habla en cada párrafo del narrador, para ponerle cara (idea 145). |
| `shell/tips.js` | 50 | Ayuda la primera vez y glosario (ideas 155 y 156). |
| `state-panel.js` | 70 | El panel del estado: lo que el juego da por cierto (U2 del pegamento; era la P5). |
| `taller/paso.js` | 258 | Un paso del taller. El mismo para los trece. |
| `taller/taller.js` | 1814 | El taller de campanas: la puerta de tres caminos y las pestañas. |
| `world-workshop.js` | 210 | El taller del mundo, desde la pausa: verlo, tocar el hilo, añadir gente o sitios, e ilustrarlo (ideas 175, 176, 185 y 183). |

### 2.2. El subsistema de grupo — `public/scripts/party/` (6 archivos, 963 líneas)

Extraído de `party.js` por las costuras que los tests ya cubrían.

| Archivo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `campaign-state.js` | 337 | The campaign's own state: the clock, the bonds, the rests and the map. |
| `combat-rules.js` | 275 | Combat rules: dice, board geometry, damage formulas and encounter shape. |
| `html.js` | 27 | HTML escaping for the party submodules. |
| `item-forms.js` | 183 | HTML builders for the item editor form. |
| `positions.js` | 65 | Where a party member starts on the board. |
| `types.js` | 76 | Shared domain types for the party subsystem. |

### 2.3. Archivos del fork que siguen siendo grandes

| Archivo | Líneas | Función Principal |
| :--- | ---: | :--- |
| `public/scripts/party.js` | 19.006 | El cableado: grupo, ficha, combate real, comandos, tablero y todo lo que el jugador toca. **Sigue creciendo** unas 1.500 líneas por fase (ver K1 en [[LO_QUE_FALTA]]) |
| `public/scripts/campaigns.js` | 1.723 | Tarjetas de campaña, la partida rápida y el arranque de partida |
| `public/scripts/world-map-renderer.js` | 1.336 | Mapas, tableros, capas de terreno y niebla, puertas y cofres |
| `public/scripts/dnd-system.js` | 1.230 | Fórmulas D&D 5e. Lee sus tablas del paquete de reglas |
| `public/scripts/world-content-popups.js` | 1.110 | Formularios de monstruos, objetos y facciones |
| `public/scripts/dynamic-context-manager.js` | 998 | Estados de campaña y presupuesto de tokens |
| `public/scripts/world-content-browser.js` | 674 | Navegador de entidades del Lorebook |
| `public/scripts/chat-enhancements.js` | 661 | Términos resaltados y avatares en línea |
| `public/scripts/active-instructions.js` | 279 | Instrucciones inyectadas en el prompt |

### 2.4. Archivos de upstream que el fork modifica

Cada uno cuesta en cada merge. La lista no debería crecer.

| Archivo | Cambio |
| :--- | :--- |
| `public/scripts/world-info.js` | Mapas, tableros, monstruos y el esquema `dndData` |
| `public/script.js` | Arranque de los subsistemas RPG e inyección en el prompt |
| `public/index.html` | Marcado de modales, cajón de grupo y superposiciones |
| `public/scripts/personas.js` | Estadísticas D&D en los descriptores de persona |

### 2.5. Hojas de estilo

| Archivo | Líneas | Función |
| :--- | ---: | :--- |
| `public/css/campaigns.css` | 2.438 | Tarjetas de campaña, bienvenida, partida rápida, el taller en pestañas y el selector de modos |
| `public/css/world-map.css` | 2.026 | Zoom, cuadrícula, tokens, terreno (agua, hielo, maleza, barriles, cofres), niebla y puertas |
| `public/css/game-shell.css` | 1.471 | El Modo Juego: la capa a pantalla completa y la retícula tablero/registro |
| `public/css/dnd-character.css` | 1.330 | Ficha, inventario, ranuras y estados |
| `public/css/world-content-browser.css` | 794 | Cuadrícula de entidades y modales |
| `public/css/campaign-wizard.css` | 622 | Asistente de campaña y panel de generación con IA |
| `public/css/dynamic-context-manager.css` | 355 | Modal de reglas y barra de presupuesto |
| `public/css/combat-log.css` | 262 | Registro de combate con marco de pixel art y `/sandbox` |
| `public/css/rules-editor.css` | 237 | El editor de reglas |
| `public/css/campaign-panel.css` | 174 | La pestaña Campaña: calendario, vínculos y perks |
| `public/css/chat-enhancements.css` | 149 | Términos resaltados y avatares en línea |
| `public/css/prompt-preview.css` | 130 | El desglose de coste por turno |

### 2.6. Herramientas — `tools/`

| Archivo | Para qué |
| :--- | :--- |
| `check-fork-types.mjs` | Gate de tipos sobre los archivos propios (246 hoy). Falla si aparece un error |
| `check-engine-wiring.mjs` | Lista los módulos del motor que el juego no carga. Informa, no falla |
| `check-prompt-shape.mjs` | Falla si la forma del prompt (9 bloques) cambia sin que nadie lo diga |
| `check-state-keys.mjs` | Falla si una clave de la partida no está en el registro del estado |
| `check-world-density.mjs` | Mide si un mundo llega al listón: sitios, gente, héroes hechos, bestias domables y magia en los datos |
| `gem-instructions.mjs` | Genera `wiki/GEM_CREAR_CAMPANA.md` desde el contrato; con `--check` falla si se quedó viejo |
| `guion-a-paquete.mjs` | Convierte el guion del Gem guionista en un paquete, y avisa de cada campo que no lee |
| `e2e-campaign.mjs` | Recorre el juego en un navegador real, con servidor y datos propios: 73 pasos, unos 55 minutos |
| `e2e-quick.mjs` | La partida rápida sola, con diagnóstico: unos 2 minutos |

---

## 3. Inventario de Archivos Clave de SillyTavern Core

| Archivo | Función Principal |
| :--- | :--- |
| `server.js` | Script de entrada raíz (`node server.js`). |
| `src/server-main.js` | Configuración de Express, middlewares globales y ciclo de vida del proceso. |
| `src/server-startup.js` | Enlace de puertos de red IPv4/IPv6 y registro de endpoints privados. |
| `src/command-line.js` | Definición de argumentos de consola (`--port`, `--ssl`, `--listen`, etc.). |
| `src/config-init.js` | Lectura de `config.yaml` y establecimiento de valores por defecto. |
| `src/users.js` | Gestión de cuentas de usuario, sesiones firmadas, Scrypt y carpetas en `data/`. |
| `src/endpoints/characters.js` | Lectura y escritura de tarjetas de personaje V2/V3 en imágenes PNG. |
| `src/endpoints/chats.js` | Operaciones CRUD de historiales de conversación en archivos JSONL. |
| `src/endpoints/worldinfo.js` | Operaciones CRUD de Lorebooks en archivos JSON. |
| `src/endpoints/secrets.js` | Gestión y ocultación de API keys en `secrets.json`. |
| `public/scripts/slash-commands.js` | Parser y ejecutor de comandos `/` de la interfaz. |
| `public/scripts/tokenizers.js` | Recuento local de tokens mediante WASM (`tiktoken`, `sentencepiece`). |
| `public/scripts/group-chats.js` | Lógica de conversaciones con múltiples personajes simultáneos. |
| `public/scripts/power-user.js` | Ajustes avanzados de interfaz y parámetros de comportamiento. |

---

## 4. Enlaces Relacionados
- [[Arquitectura-General]]: Visión de conjunto de la arquitectura.
- [[Guia-Desarrollo-Flujo]]: Instrucciones para ejecutar, depurar y programar en el proyecto.
- *PROBLEMAS_TECNICOS*: Diagnóstico técnico y deuda encontrada en estos archivos.
- [[PROPUESTAS_MEJORA]]: Propuestas de refactorización y desacoplamiento.
