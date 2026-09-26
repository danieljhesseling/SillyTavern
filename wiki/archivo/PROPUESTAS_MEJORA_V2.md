---
title: Catálogo V2 de 200 Propuestas de Mejora — Hacia el CRPG Definitivo
tags: [propuestas, mejoras-v2, roadmap, dnd, gloomhaven, persona, game-shell, ia, tactico]
created: 2026-09-22
updated: 2026-09-22
author: DanielJHesseling / Antigravity AI
---

# 🚀 Catálogo V2: 200 Propuestas de Mejora para SillyTavern & Motor RPG
## *De Chatbot de Texto a Videojuego de Rol Completo (D&D 5e + Gloomhaven + Persona)*

> **Contexto de la Versión 2 (V2)**:
> El catálogo original (`PROP-001` a `PROP-200`) se redactó cuando el proyecto era un compendio de módulos dispersos alrededor de `party.js`. Hoy el motor ya cuenta con combate determinista a 0 tokens (`game-engine/combat/`), salas con niebla y puertas dinámicas (`campaign-map.js`), vínculos sociales Persona (`bonds.js`), 7 tipos de objetivos Gloomhaven (`scenarios.js`), y un pipeline formal de ingesta y generación de mundos profundos.
>
> Este catálogo **V2** recoge **200 nuevas propuestas técnicas y de diseño**, articuladas en **10 áreas estratégicas de 20 propuestas cada una**, enfocadas en consolidar la experiencia visual sin comandos, la riqueza del mundo y la inmersión tipo videojuego comercial (estilo *Baldur's Gate*, *Divinity* y *Friends & Fables*).

---

## 📍 Lectura del 2026-09-22

Un catálogo de **ideas**, no una lista de tareas: lo que se hace y en qué orden vive en **[[POR_HACER]]**. Aquí no se lleva la cuenta de nada, porque una cuenta metida en un catálogo de 200 entradas se pudre en dos días.

**Se escribió hoy y ya hay una quincena hechas**, que dice más del ritmo del proyecto que del documento:

| Ya está | Dónde |
| :--- | :--- |
| `PROP2-007` registro de combate · `PROP2-009` pantalla de título · `PROP2-017` iniciativa visual · `PROP2-018` fin de turno | Fases B y H |
| `PROP2-022` **localidades con cero tableros** | A4 |
| `PROP2-049` cobertura por trazado · `PROP2-124` descanso corto con dados · `PROP2-128` subida de nivel | Fase A y A1 |
| `PROP2-061` catálogo universal de conjuros | D5, la capa ligera |
| `PROP2-141` segmentación para caché · `PROP2-142` poda del combate resuelto | El prefijo estable |
| `PROP2-183` aislamiento del fork · `PROP2-186` gate de tipos | La disciplina de la casa |
| `PROP2-039` accesibilidad topológica · `PROP2-053` ataques de oportunidad · `PROP2-059` salvaciones de muerte · `PROP2-005` previsualización de trayectoria · `PROP2-163` puntos de retorno | **Hechas el 2026-09-22** |

**Y dos que están descartadas a propósito**, no pendientes:

- `PROP2-062`, `PROP2-066`, `PROP2-080` — ranuras de conjuro, *upcasting*, libro de conjuros: es la magia pesada, y **D5 decidió la ligera**. Se añadirían encima si alguna vez hacen falta.
- `PROP2-121`, `PROP2-122`, `PROP2-123` (la mitad de tiradas) — el DM que pide tiradas: es **D6, decidido que no**. Cuesta tokens en todos los turnos y el motor ya tira, audita y corrige.

**Tres cosas que el catálogo da por hechas y no lo están:**

1. `PROP2-184`/`PROP2-185` hablan de **60 FPS y capas de lienzo**. El tablero es **DOM, no canvas**: no es optimizar un bucle de dibujado, es reescribir el renderizador.
2. `PROP2-170` (nube) choca con tu *«solo local»*, que es una decisión tomada (D4).
3. `PROP2-200` (congelar la API del motor) con un único consumidor es ponerse una camisa de fuerza.

> La **matriz de prioridades del final** nació desfasada: pone en *alta* cosas ya hechas y magia que se descartó. Se conserva como foto de lo que parecía importante el 22 de septiembre.

---

## 🗺️ Índice General de Áreas V2

1. [Área 1: Game Shell, UI/UX Inmersiva & Experiencia Videojuego (Zero Comandos)](#área-1-game-shell-uiux-inmersiva--experiencia-videojuego-zero-comandos-prop2-001-a-prop2-020) (`PROP2-001` a `PROP2-020`)
2. [Área 2: Generador de Mundos Profundo & Ingesta Estructurada](#área-2-generador-de-mundos-profundo--ingesta-estructurada-prop2-021-a-prop2-040) (`PROP2-021` a `PROP2-040`)
3. [Área 3: Combate Táctico Avanzado, Terreno & IA Enemiga](#área-3-combate-táctico-avanzado-terreno--ia-enemiga-prop2-041-a-prop2-060) (`PROP2-041` a `PROP2-060`)
4. [Área 4: Sistema de Magias, Habilidades & Spell Slots](#área-4-sistema-de-magias-habilidades--spell-slots-prop2-061-a-prop2-080) (`PROP2-061` a `PROP2-080`)
5. [Área 5: Bucle Social Persona, Confidentes & Calendario Dinámico](#área-5-bucle-social-persona-confidentes--calendario-dinámico-prop2-081-a-prop2-100) (`PROP2-081` a `PROP2-100`)
6. [Área 6: Facciones Vivas, Reputación & Economía Reactiva](#área-6-facciones-vivas-reputación--economía-reactiva-prop2-101-a-prop2-120) (`PROP2-101` a `PROP2-120`)
7. [Área 7: DM Autónomo, Tiradas de Habilidad & Friends & Fables Parity](#área-7-dm-autónomo-tiradas-de-habilidad--friends--fables-parity-prop2-121-a-prop2-140) (`PROP2-121` a `PROP2-140`)
8. [Área 8: Optimización de Tokens, Context Caching & Arquitectura Híbrida](#área-8-optimización-de-tokens-context-caching--arquitectura-híbrida-prop2-141-a-prop2-160) (`PROP2-141` a `PROP2-160`)
9. [Área 9: Persistencia Robusta, Guardado en Ranuras & Portabilidad de Campañas](#área-9-persistencia-robusta-guardado-en-ranuras--portabilidad-de-campañas-prop2-161-a-prop2-180) (`PROP2-161` a `PROP2-180`)
10. [Área 10: Rendimiento, Calidad del Código, Testing & Fork Discipline](#área-10-rendimiento-calidad-del-código-testing--fork-discipline-prop2-181-a-prop2-200) (`PROP2-181` a `PROP2-200`)

---

## Área 1: Game Shell, UI/UX Inmersiva & Experiencia Videojuego (Zero Comandos) (`PROP2-001` a `PROP2-020`)

* **PROP2-001 · Transiciones Cinemáticas entre Pantallas**: Crear un gestor de animación por CSS (`fade-to-black`, `cross-fade`) entre las tres escenas principales (Diálogo, Mapa Mundi y Tablero Táctico), eliminando cualquier parpadeo de recarga del DOM.
* **PROP2-002 · Dock Flotante de Party con Estado Vital**: Barra fija inferior o lateral que muestra los avatares de los miembros del grupo con barras fluidas de HP, mana/slots y pequeños iconos de estados alterados con tooltip al pasar el cursor.
* **PROP2-003 · Action Chips Contextuales Generados**: Botones de acción rápida bajo el diálogo sugeridos por el DM (ej. `[Examinar estatua]`, `[Negociar precio]`, `[Desenvainar arma]`), ejecutables con un solo clic sin tener que teclear.
* **PROP2-004 · Menú Radial Contextual sobre Tokens y Entidades**: Al hacer clic izquierdo o derecho sobre un personaje, puerta o enemigo en el tablero, desplegar un menú circular con opciones inmediatas (`Atacar`, `Hablar`, `Inspeccionar`, `Empujar`).
* ✅ **PROP2-005 · Previsualización de Trayectoria A* y Coste de Movimiento** *(hecho el 2026-09-22)*: Al pasar el ratón sobre una celda del tablero con un token seleccionado, dibujar una línea segmentada que indique la ruta óptima y los pies de movimiento requeridos antes de confirmar.
* **PROP2-006 · Cursor Dinámico con Estado del Puntero**: Punteros visuales temáticos (espada para ataque disponible, bota para movimiento, engranaje para interactuable, candado para puerta cerrada).
* **PROP2-007 · Registro de Combate (Combat Log) Retráctil**: Panel semitransparente que detalla las tiradas mecánicas (d20 + bono vs CA = Impacto, dados de daño) accesible con un clic o tecla rápida, sin mezclar números con la prosa literaria del chat.
* **PROP2-008 · Retrato Parlante Animado (Bust Shot)**: En la escena de diálogo, mostrar la ilustración del personaje activo a medio cuerpo a la izquierda/derecha con animación sutil de respiración y cambio de expresión según la emoción detectada.
* **PROP2-009 · Pantalla de Título Autónoma**: Una pantalla inicial limpia al arrancar SillyTavern con opciones de "Nueva Campaña", "Continuar Partida", "Cargar Ranura" y "Configuración", relegando la UI tradicional de chat a un subpanel de ajustes.
* **PROP2-010 · Feedback Sonoro Háptico / UI Audio Engine**: Motor ligero basado en Web Audio API para reproducir efectos de sonido sutiles (clic en dados, crujido de puertas de madera, choque de espadas, éxito en tirada) sin librerías externas pesadas.
* **PROP2-011 · Notificaciones Toast Temáticas de Rol**: Mensajes emergentes elegantes estilo pergamino al subir de nivel, obtener un objeto legendario, ganar reputación con una facción o cambiar de hora del día.
* **PROP2-012 · Panel de Inspección Rápida de Monstruos**: Al hacer clic en un enemigo en combate, abrir un panel lateral con su nombre, tamaño, CA estimada, resistencias conocidas e historial de ataques sufridos.
* **PROP2-013 · Barra Superior de Estado Global (HUD Top Bar)**: Visualizador constante de la moneda de oro del grupo, fecha y hora del calendario, climatología actual y nombre de la localidad en la que se encuentran.
* **PROP2-014 · Modo Teatro / Pantalla Completa Limpia**: Botón de un solo clic que oculta todos los docks y barras para disfrutar de ilustraciones de escenario completas o combates tácticos con máximo espacio de pantalla.
* **PROP2-015 · Selector Visual de Objetivos Mágicos**: Al seleccionar un conjuro en combate, iluminar en verde o rojo las celdas válidas del tablero según el alcance y el tipo de objetivo (amigo/enemigo).
* **PROP2-016 · Diálogos con Decisiones Ramificadas**: Componente de interfaz que renderiza opciones de conversación con etiquetas de impacto (ej. `[Persuasión CD 12]`, `[Facciones: Guardia Plateada]`, `[Vínculo: Rango 3]`).
* **PROP2-017 · Indicador de Iniciativa Visual Superior**: Tira horizontal superior que ordena los turnos de combate mostrando el retrato de cada personaje y enemigo, con un marco dorado sobre quien tiene el turno actual.
* **PROP2-018 · Marcador de Fin de Turno Evidente**: Botón prominente `[Terminar Turno]` con atajo de teclado (Espacio/Enter) que avanza la máquina de turnos inmediatamente.
* **PROP2-019 · Mini-Mapa Esquemático de Localización**: En la esquina superior derecha, un minimapa de orientación que sitúa al grupo dentro del edificio o mazmorra actual con respecto a las salas ya exploradas.
* **PROP2-020 · Temas Visuales Configurables (Dark Fantasy / Pergamino / Cyberpunk)**: Paletas de CSS variables para adaptar la estética del Game Shell al género de la campaña importada.

---

## Área 2: Generador de Mundos Profundo & Ingesta Estructurada (`PROP2-021` a `PROP2-040`)

* **PROP2-021 · Validador de Esquema en Tiempo de Importación**: Ejecutar automáticamente la validación del esquema `DEEP_WORLD_SCHEMA` v2 antes de guardar nada en `world_info`, avisando de cualquier campo faltante o ID errónea.
* ✅ **PROP2-022 · Soporte para Localidades con Cero Tableros** *(hecho el 2026-09-22, A4)*: Adaptar el gestor de campañas para permitir asentamientos sin mapa táctico (`boardIds: []`), gestionando estancias puramente narrativas, comerciales y de descanso.
* **PROP2-023 · Pipeline de Generación en Cuatro Fases con Caché de IDs**: Un asistente guiado para procesar novelas o libros extensos en 4 pasos (Mundo $\rightarrow$ Geografía $\rightarrow$ Personajes/Bestiario $\rightarrow$ Tableros/Misiones) reteniendo los identificadores.
* **PROP2-024 · Visualizador de Grafos de Rutas del Mapa Mundi**: Renderizar el grafo de localidades y caminos usando Canvas o SVG interactivo para que el jugador haga clic en un destino y viaje automáticamente.
* **PROP2-025 · Editor Visual de Tableros ASCII en el Navegador**: Una herramienta visual tipo "Pintor de Mapas" donde se seleccionan símbolos (`#`, `.`, `D`, `c`, `C`, `~`) y se dibuja sobre la cuadrícula con el ratón, exportando directamente a JSON.
* **PROP2-026 · Sistema de Semillas (Seeds) para Generación de Mundos**: Incorporar una clave numérica que permita reproducir exactamente la misma estructura de mazmorras y nombres en generaciones algorítmicas procedimentales.
* **PROP2-027 · Generador de Alias y Sinónimos para Lorebooks**: Extractor que asocia automáticamente alias a cada entrada (ej. para *Valen*: `Capitán`, `Comandante`, `Valen de la Guardia`), maximizando la inyección contextual en SillyTavern.
* **PROP2-028 · Calculadora de Balance de Desafío (CR Calculator)**: Analizar la composición del grupo (nivel medio y cantidad de personajes) y comparar con el valor de CR total de los tableros del mundo generado, avisando si un encuentro es letal.
* **PROP2-029 · Empaquetador de Campañas a Archivo Único (.campaign.zip)**: Función de exportación integral que une en un ZIP comprimido el archivo JSON de mundo, las imágenes de personajes, mapas y el estado inicial de partida.
* **PROP2-030 · Importador Drag & Drop de Libros y Campañas**: Zona de arrastre en la pantalla de bienvenida que detecta si el archivo soltado es un paquete de campaña, un JSON de mundo o un módulo y lo instala al instante.
* **PROP2-031 · Generador de Tablas de Encuentros Aleatorios por Bioma**: Crear tablas de eventos basadas en el `dangerLevel` de las rutas de viaje (ej. clima severo, emboscada de bandidos, mercader ambulante).
* **PROP2-032 · Sistema de Arquetipos de Asentamiento**: Plantillas prediseñadas para poblar aldeas rápidamente (una posada, un herrero, un templo y 3 rumores) en caso de que la IA omita servicios en una localidad.
* **PROP2-033 · Normalizador de Nombres Únicos de Criaturas**: Lógica que previene que dos enemigos compartan exactamente el mismo nombre (ej. rebautizar a *Goblin* como *Goblin Explorador* y *Goblin Lancero*) para evitar colisiones en Lorebook.
* **PROP2-034 · Extractor Automático de Trasfondo para Tarjetas de Personaje**: Convertir los personajes generados en el JSON (`characters[]`) en tarjetas de SillyTavern completas con descripción, personalidad y primer mensaje de saludo.
* **PROP2-035 · Mapeador de Climas y Estaciones**: Calendario anual estructurado (primavera, verano, otoño, invierno) con efectos ambientales automáticos sobre el mapa y las descripciones del DM.
* **PROP2-036 · Soporte para Mazmorras Multiescala (Superficie y Subsuelo)**: Jerarquía de tableros anidados que permite enlazar una celda de escalera (`v`) de un tablero con la celda de inicio (`^`) de un segundo tablero.
* **PROP2-037 · Constructor de Facciones con Generador de Lema y Filosofía**: Creación automática de contradicciones dramáticas (ej. meta pública benevolente vs doctrina secreta autoritaria) para dotar de profundidad política al mundo.
* **PROP2-038 · Generador de Rumores de Taberna Dinámicos**: Inyección de entradas breves de Lorebook que el posadero o los parroquianos pueden soltar de forma natural según las misiones pendientes del mapa.
* ✅ **PROP2-039 · Verificador de Accesibilidad Topológica en Tableros** *(hecho el 2026-09-22)*: Algoritmo de inundación (Flood Fill) que comprueba antes de jugar que todas las salas y cofres son alcanzables desde el punto de entrada sin quedar bloqueados por muros cerrados.
* **PROP2-040 · Migrador de Campañas de Versión 1 a Versión 2**: Script de conversión hacia atrás para transformar mundos planos antiguos (`world-schema.js` v1) al formato jerárquico multicapa (`DEEP_WORLD_SCHEMA` v2).

---

## Área 3: Combate Táctico Avanzado, Terreno & IA Enemiga (`PROP2-041` a `PROP2-060`)

* **PROP2-041 · Incorporación de Terreno de Agua Profunda y Fosos (`W`)**: Implementar en `terrain.js` la celda de agua con reglas de reducción de velocidad a la mitad y desventaja en ataques sin armas adaptadas.
* **PROP2-042 · Terreno Letal y Superficies Peligrosas (`L`)**: Soporte para lava, ácido y pinchos que aplican daño elemental automático al entrar o iniciar el turno sobre ellas.
* **PROP2-043 · Trampas Ocultas con Detección Pasiva (`T`)**: Celdas que se renderizan como suelo normal hasta que la percepción pasiva del grupo o una tirada de investigación las detecte, activando inmovilización o daño si se pisan sin desactivar.
* **PROP2-044 · Celdas con Elevación y Plataformas (`^` / `v`)**: Bonificador mecánico de **+2 al ataque a distancia** para atacantes situados en terreno elevado con respecto a su objetivo.
* **PROP2-045 · Perfil Táctico de IA: `controller`**: Comportamiento de IA que analiza el tablero para lanzar conjuros en racimo sobre el mayor número de personajes agrupados y aplicar estados (`stunned`, `restrained`).
* **PROP2-046 · Perfil Táctico de IA: `sniper`**: Comportamiento que busca activamente celdas elevadas o coberturas pesadas y se mantiene en el rango máximo de disparo (60-120 pies), huyendo si un atacante entra en cuerpo a cuerpo.
* **PROP2-047 · Sistema de Fases de Jefe (Boss Phases)**: Cambio dinámico de perfil táctico o activación de habilidades de emergencia cuando un monstruo cae por debajo del 50% de HP.
* **PROP2-048 · Oleadas de Refuerzos Dinámicas por Evento**: Disparar la aparición de nuevos enemigos en coordenadas designadas al alcanzar la ronda X o al forzar una puerta protegida con alarma.
* **PROP2-049 · Cobertura Dinámica por Trazado de Rayos (Raycast Cover)**: Calcular la cobertura trazando líneas desde el centro de la celda atacante hacia los vértices de la celda objetivo para asignar con precisión quirúrgica cobertura ligera (+2 CA) o pesada (+5 CA).
* **PROP2-050 · Cofres Tácticos e Interactuables en Batalla**: Celdas de cofre que pueden ser saqueadas consumiendo una acción en pleno combate (con tirada de ganzúa si están selladas).
* **PROP2-051 · Palancas y Mecanismos de Apertura a Distancia**: Interruptores que el grupo o los enemigos pueden activar para cerrar rejas, drenar agua de un foso o abrir pasadizos secretos.
* **PROP2-052 · Barricadas y Elementos Destructibles**: Objetos con puntos de vida y CA propios en el tablero que bloquean el paso y pueden ser derribados a golpes o con magia.
* ✅ **PROP2-053 · Ataques de Oportunidad Automáticos** *(hecho el 2026-09-22)*: Si una criatura abandona una celda adyacente a un enemigo cuerpo a cuerpo sin usar la acción de Retirada (Disengage), el motor ejecuta un ataque de reacción inmediato.
* **PROP2-054 · Acción Preparada (Ready Action)**: Permitir a un combatiente reservar su acción bajo un disparador condicional (ej. "Disparar al primer enemigo que cruce la puerta").
* **PROP2-055 · Mecánicas de Empujón (Shove) y Derribo (Prone)**: Opción de gastar un ataque para realizar una tirada opuesta de Atletismo y empujar a un rival 5 pies hacia atrás (ideal contra fosos o fuego) o derribarlo.
* **PROP2-056 · Maniobra de Agarre (Grapple)**: Reducir la velocidad del rival a 0 mediante una tirada enfrentada, impidiéndole moverse hasta que gaste una acción en liberarse.
* **PROP2-057 · Sistema de Fuentes de Luz y Visión en la Oscuridad (Darkvision)**: Celdas oscuras que imponen desventaja a tiradas de ataque a personajes sin visión nocturna o que no porten una antorcha.
* **PROP2-058 · Selección y Despliegue de Aliados Invadidos/Convocados**: Soporte para mascotas del explorador, familiares mágicos o aliados invocados que actúan en su propio turno de iniciativa.
* ✅ **PROP2-059 · Muerte y Estabilización (Death Saving Throws)** *(hecho el 2026-09-22)*: Cuando un personaje del grupo cae a 0 HP, inicia el bucle de salvaciones de muerte D&D (3 éxitos = estabilizado, 3 fallos = muerte) antes de que la partida termine.
* **PROP2-060 · Reparto y Animación de Experiencia y Botín Post-Combate**: Pantalla resumen de fin de encuentro con recuento de bajas, oro obtenido, reparto equitativo de XP y reparto de objetos a los inventarios.

---

## Área 4: Sistema de Magias, Habilidades & Spell Slots (`PROP2-061` a `PROP2-080`)

* ✅ **PROP2-061 · Catálogo Universal de Conjuros y Técnicas** *(hecho el 2026-09-22, D5)*: Implementar un repositorio centralizado de magias y habilidades en `game-engine/rules/` con acceso por identificador único.
* **PROP2-062 · Gestor Visual de Ranuras de Conjuro (Spell Slots)**: Visualizador de casillas o perlas de nivel 1 a 9 en la ficha de cada lanzador de conjuros, con consumo automático al lanzar y recarga en descanso largo.
* **PROP2-063 · Plantillas de Área de Efecto en Cuadrícula (AoE Templates)**: Herramienta gráfica que resalta las celdas afectadas al seleccionar un cono de 15 pies, esfera de 20 pies, línea de 30 pies o cubo en el tablero táctico.
* **PROP2-064 · Mecánica de Concentración D&D**: Si un personaje mantiene un conjuro activo que requiere concentración y recibe daño, el motor dispara automáticamente una salvación de Constitución (CD 10 o mitad del daño).
* **PROP2-065 · Escalado Automático de Trucos (Cantrips)**: Ajustar el daño de los trucos según el nivel del lanzador (aumento de dados en niveles 5, 11 y 17).
* **PROP2-066 · Lanzamiento con Ranura Superior (Upcasting)**: Menú modal al lanzar un conjuro para seleccionar si se gasta una ranura de mayor nivel y añadir dados adicionales o efectos extendidos.
* **PROP2-067 · Furia del Bárbaro (Rage Engine)**: Habilidad con botón de activación que otorga resistencia a daño físico (contundente, perforante, cortante) y bonificador al daño cuerpo a cuerpo durante 1 minuto.
* **PROP2-068 · Acción Súbita del Guerrero (Action Surge)**: Recurso por descanso corto que concede una acción estándar adicional en el mismo turno de combate.
* **PROP2-069 · Castigo Divino del Paladín (Divine Smite)**: Al impactar un golpe cuerpo a cuerpo, opción de gastar una ranura de conjuro para añadir daño radiante extra (`2d8` + `1d8` por nivel de ranura superior).
* **PROP2-070 · Ataque Furtivo del Pícaro (Sneak Attack)**: Detección automática en el motor de si el pícaro ataca con ventaja o si tiene un aliado a menos de 5 pies del objetivo para añadir dados de daño furtivo.
* **PROP2-071 · Forma Salvaje del Druida (Wild Shape)**: Transformación temporal que sustituye el avatar, HP y estadísticas físicas del druida por las de una bestia seleccionada del bestiario.
* **PROP2-072 · Maniobras Marciales del Maestro de la Batalla**: Dados de superioridad (d8) para ejecutar réplicas, fintas y ataques de desarme sobre la cuadrícula.
* **PROP2-073 · Motor Completo de los 15 Estados Alterados D&D**: Aplicar de forma determinista los modificadores de *Cegado*, *Encantado*, *Ensordecido*, *Asustado*, *Apresado*, *Incapacitado*, *Invisible*, *Paralizado*, *Petrificado*, *Envenenado*, *Derribado*, *Apresado*, *Aturdido*, *Inconsciente* y *Extenuación*.
* **PROP2-074 · Sistema de Reacciones y Conjuros Defensivos**: Activación del conjuro *Escudo* (+5 CA hasta el inicio del siguiente turno) ante un ataque que superaría la CA base.
* **PROP2-075 · Fórmulas de Tiradas de Salvación y Mitigación**: Cálculo automático de mitad de daño en salvaciones exitosas contra conjuros de área tipo *Bola de Fuego*.
* **PROP2-076 · Componentes de Conjuro y Regla de Manos Libres**: Comprobación opcional de si el lanzador tiene una mano libre para componentes somáticos o un foco arcano equipado.
* **PROP2-077 · Curación y Regeneración Temporal de Puntos de Vida**: Soporte para puntos de vida temporales (temp HP) que se consumen antes que la reserva de vida real y no se acumulan.
* **PROP2-078 · Interrupción Mágica (Counterspell)**: Habilidad de reacción para neutralizar el lanzamiento de un conjuro enemigo comparando niveles de ranura o tirada de característica.
* **PROP2-079 · Efectos Mágicos Persistentes sobre el Tablero**: Celdas que conservan efectos durante varias rondas (ej. *Nube Tóxica*, *Muro de Fuego*, *Grasa*) e infligen daño o caídas a quienes las crucen.
* **PROP2-080 · Libro de Conjuros y Preparación Diaria**: Panel para magos y clérigos donde eligen qué conjuros tienen preparados para el día antes de partir de la posada.

---

## Área 5: Bucle Social Persona, Confidentes & Calendario Dinámico (`PROP2-081` a `PROP2-100`)

* **PROP2-081 · Escala Formal de 10 Rangos de Vínculo (Social Links)**: Estructurar la relación con cada confidente del rango 1 al 10, requiriendo puntos de afinidad progresivos y un evento cinemático para subir de nivel.
* **PROP2-082 · Perks Tácticas Reales Desbloqueables por Rango**: Conectar cada rango de confidente con beneficios mecánicos tangibles en combate (ej. Rango 3: el confidente avisa de emboscadas; Rango 7: ataque combinado de apoyo; Rango 10: resurrección de emergencia una vez por descanso largo).
* **PROP2-083 · Calendario Cuatrisemanal con 4 Franjas Horarias**: División estricta de la jornada en Mañana, Tarde, Noche y Madrugada, avanzando de fase al realizar actividades (viajar, explorar mazmorras o socializar).
* **PROP2-084 · Horarios y Rutinas Espaciales de PNJs (`schedule`)**: Personajes que cambian de localidad o estancia según la hora (el herrero trabaja de mañana, acude a la taberna de tarde y duerme en su casa de noche).
* **PROP2-085 · Estadísticas Sociales del Protagonista**: Cinco atributos personales (Coraje, Conocimiento, Encanto, Destreza, Empatía) que se incrementan leyendo libros, trabajando en oficios o entrenando, y que desbloquean opciones de diálogo exclusivas.
* **PROP2-086 · Sistema de Regalos con Afinidad de Gustos**: Posibilidad de entregar objetos a los confidentes en momentos de descanso, sumando puntos de vínculo extra si coinciden con sus preferencias personales.
* **PROP2-087 · Eventos de Campamento y Diálogos de Hoguera**: Espacio social durante los descansos largos donde los miembros del grupo charlan entre sí, revelan sus miedos y forjan relaciones de confianza o romance.
* **PROP2-088 · Tensiones y Reconciliaciones de Vínculo**: Si el jugador toma decisiones que contradicen radicalmente la filosofía de un confidente, el vínculo puede "bloquearse" temporalmente requiriendo una disculpa o misión de lealtad.
* **PROP2-089 · Bonificadores de Fusión o Forja por Arcana**: Si el jugador crea o mejora objetos mágicos, recibir bonificadores pasivos según el rango alcanzado con el confidente de la Arcana correspondiente.
* **PROP2-090 · Despedidas y Epílogos Personalizados**: Al concluir una campaña, generar un epílogo narrativo único para cada confidente basado en el rango de vínculo final alcanzado.
* **PROP2-091 · Indicador Visual de Humor y Disposición**: Pequeño icono en el avatar del PNJ que refleja su estado emocional actual hacia el grupo (alegre, pensativo, hostil, angustiado).
* **PROP2-092 · Actividades de Ocio Compartidas**: Minieventos de una franja horaria (pescar, jugar al ajedrez, beber en la posada) que otorgan puntos sociales y descansan al personaje.
* **PROP2-093 · Conexión entre Reputación de Facción y Vínculo de Confidente**: Los confidentes afiliados a una facción reaccionan positiva o negativamente según los actos del jugador con su organización madre.
* **PROP2-094 · Misiones Personales de Lealtad (Loyalty Quests)**: A partir de rango 7 u 8, desbloquear una misión exclusiva del confidente para resolver su conflicto personal definitivo.
* **PROP2-095 · Habilidad de Asistencia Táctica en Espera**: Confidentes que no están en el combate activo pueden proporcionar beneficios desde la reserva (ej. análisis de debilidades enemigas estilo *Navi*).
* **PROP2-096 · Registro Histórico de Momentos Compartidos**: Álbum dentro del diario donde se guardan resúmenes de los momentos clave vividos con cada compañero.
* **PROP2-097 · Límite de Tiempo en Misiones Críticas (Deadlines)**: Misiones de campaña con una fecha tope en el calendario (ej. "La luna llena ocurrirá en 14 días"), obligando a gestionar cuidadosamente el tiempo.
* **PROP2-098 · Clima Afectando las Rutinas Sociales**: Días lluviosos o de tormenta de nieve que congregan a los habitantes en la posada o cierran los mercados al aire libre.
* **PROP2-099 · Celebraciones y Festividades de Calendario**: Días señalados en el año del mundo donde hay justas, ferias o rituales religiosos con descuentos especiales y eventos únicos.
* **PROP2-100 · Compatibilidad del Modo Social con el Game Shell**: Escena visual dedicada para las interacciones sociales con interfaz limpia de novela visual moderna.

---

## Área 6: Facciones Vivas, Reputación & Economía Reactiva (`PROP2-101` a `PROP2-120`)

* **PROP2-101 · Reputación Reactiva con Consecuencias Reales (P17)**: Conectar el valor numérico de reputación (-100 a +100) con la lógica del juego, alterando diálogos, acceso a zonas y hostilidad en combate.
* **PROP2-102 · Modificadores de Precios Dinámicos en Comercios**: Aplicar un descuento automático del 20% en tiendas aliadas y un recargo del 50% en territorios de facciones desconfiadas.
* **PROP2-103 · Matriz de Rivalidades y Alianzas Automáticas**: Acciones a favor de una facción que aplican un factor inverso (-50% o -100%) sobre la reputación de sus facciones rivales declaradas.
* **PROP2-104 · Emboscadas de Cazarrecompensas en Rutas de Viaje**: Si la reputación con una facción cae por debajo de -50 (Hostil), aumentar la probabilidad de encuentros de combate armados por sus sicarios en los caminos.
* **PROP2-105 · Armerías y Rangos Militares de Facción**: Desbloqueo de equipo único, armaduras con escudo heráldico y títulos honoríficos al alcanzar los rangos de *Amistoso* (+25) y *Venerado* (+75).
* **PROP2-106 · Apoyo Armado de Facción en Escenarios de Asedio**: Posibilidad de solicitar refuerzos de soldados de la facción aliada para que combatan como PNJ en tableros tácticos difíciles.
* **PROP2-107 · Cambios de Control Territorial por Misiones**: Si el grupo completa una cadena de misiones en una localidad, cambiar el `controllingFactionId` de la misma y sustituir a los guardias urbanos.
* **PROP2-108 · Inventarios de Tienda Finitos con Reposición**: Comerciantes con una cantidad determinada de pociones y flechas que reabastecen sus existencias tras el paso de varios días de juego.
* **PROP2-109 · Sistema de Préstamos y Crédito Bancario**: Gremios de mercaderes donde solicitar préstamos de oro a devolver con intereses en una fecha límite de calendario so pena de persecución.
* **PROP2-110 · Sistema de Sobornos y Negociación con Guardias**: Opciones de interacción para pagar una fianza o sobornar a patrullas urbanas antes de que inicien combate tras cometer un delito.
* **PROP2-111 · Rutas Comerciales Interrumpidas por Monstruos**: Si una ruta de viaje tiene un peligro elevado, los precios de los productos importados en la ciudad destino aumentan hasta que el grupo limpie el camino.
* **PROP2-112 · Reclutamiento de PNJ de Facción para el Grupo**: Permitir contratar mercenarios o aprendices de la facción para suplir bajas en el grupo principal.
* **PROP2-113 · Subastas y Mercados Negros Secretos**: Asentamientos con mercados clandestinos accesibles únicamente con una contraseña o con reputación neutral/positiva en los bajos fondos.
* **PROP2-114 · Tablones de Anuncios de Facción Actualizables**: Contratos de caza de monstruos con recompensa en oro y reputación que rotan periódicamente.
* **PROP2-115 · Estatus Diplomático y Salvoconductos**: Documentos de viaje que anulan los peajes en puentes y permiten portar armas visibles dentro de palacios y ciudadelas.
* **PROP2-116 · Sabotaje y Misiones de Infiltración Política**: Misiones diseñadas para debilitar la economía o la defensa de una facción rival sin recurrir al combate frontal.
* **PROP2-117 · Impuestos y Tasas de Alojamiento por Asentamiento**: Coste variable por estancia en posadas según la riqueza del distrito y la tasa municipal de la facción.
* **PROP2-118 · Donaciones a Templos y Bendiciones de Gracia**: Ofrendas de oro a instituciones religiosas que proporcionan ventajas temporales a las tiradas de salvación durante 24 horas.
* **PROP2-119 · Insignias y Capas de Facción con Impacto Social**: Objetos de equipamiento en la ranura de cuerpo/cuello que camuflan al grupo o revelan su afiliación al entrar a un nuevo asentamiento.
* **PROP2-120 · Panel Visual de Facciones en el Menú de Campaña**: Pantalla con la heráldica de cada organización, barra de progreso de reputación, historia, líderes y zonas de control.

---

## Área 7: DM Autónomo, Tiradas de Habilidad & Friends & Fables Parity (`PROP2-121` a `PROP2-140`)

* **PROP2-121 · Detector Automático de Intenciones de Tirada**: El motor analiza la intención del mensaje del jugador (ej. *"Intento trepar por el muro"* o *"Registro los cajones del escritorio"*) y sugiere la tirada correspondiente (Atletismo o Investigación) con su CD.
* **PROP2-122 · Botón Rápido "Pedir Tirada al DM"**: Botón en la interfaz donde el jugador elige la habilidad D&D que desea poner a prueba y el motor ejecuta la tirada d20 sumando su bonificador de forma transparente.
* **PROP2-123 · Generador de Action Chips de Opciones Rápidas**: El DM genera de 2 a 4 alternativas plausibles al final de su narración para jugadores que prefieren no escribir prosa libre.
* **PROP2-124 · Descanso Corto Interactivo con Gasto de Dados de Golpe (Hit Dice)**: Diálogo modal que permite elegir cuántos dados de vida gasta cada personaje herido para sanar sin quemar un descanso largo.
* **PROP2-125 · Descanso Largo con Detección de Zona Segura**: Solo permitir descanso largo en posadas o campamentos protegidos; en mazmorras, someter el descanso a tirada de encuentro de emboscada.
* **PROP2-126 · Regla de "Éxito con Coste" (Success at a Cost)**: Si una tirada falla por 1 o 2 puntos respecto a la CD, el DM propone tener éxito pero sufriendo un inconveniente (perder una antorcha, hacer ruido, recibir daño menor).
* **PROP2-127 · Tiradas Secretas del DM (Blind Rolls)**: Ocultar el resultado numérico del d20 al jugador en tiradas de Sigilo, Engaño o Percepción para preservar el misterio narrativo.
* **PROP2-128 · Subida de Nivel Interactiva (Level-Up Wizard)**: Asistente visual al acumular suficiente XP que guía el incremento de HP, selección de nuevos conjuros, mejoras de característica (ASI) o dotes.
* **PROP2-129 · Sistema de Inspiración Heroica**: Entrega de un punto de inspiración por buenas ideas o interpretación destacada, canjeable por ventaja en cualquier tirada futura.
* **PROP2-130 · Generador Procedural de Rumores de Posada**: Creación al vuelo de pistas narrativas sobre tesoros ocultos en el mapa basándose en los tableros aún no explorados.
* **PROP2-131 · Resumen de Continuidad al Reanudar Partida**: Breve texto introductorio al cargar una partida guardada tras días de inactividad que recapitula la situación actual y los objetivos inmediatos.
* **PROP2-132 · Control de Peticiones Imposibles por Reglas**: Interceptar automáticamente acciones absurdas en el chat (ej. *"Salto hasta la luna"* o *"Mato al rey de un puñetazo en la plaza pública"*) ofreciendo una alternativa coherente.
* **PROP2-133 · Diálogos con Chequeos Pasivos Invisibles**: El DM compara en silencio la Percepción Pasiva (10 + Sabiduría) del personaje para revelar detalles ocultos en la descripción de una sala sin pedir tirada.
* **PROP2-134 · Sistema de Peligros Ambientales (Environmental Hazards)**: Reglas automáticas para caídas, asfixia bajo el agua, temperaturas extremas y venenos de viaje.
* **PROP2-135 · Adjudicación de Trampas y Rompecabezas Lógicos**: Puzzles con pistas repartidas en los objetos del inventario o inscripciones de Lorebook que se resuelven mediante deducción.
* **PROP2-136 · Asignador Automático de Dificultad (DC Estimator)**: Asignar CDs según la escala oficial 5e: Muy Fácil (5), Fácil (10), Moderada (15), Difícil (20), Muy Difícil (25), Casi Imposible (30).
* **PROP2-137 · Modo DM Asistido / Modo Solo**: Interruptor para elegir si la IA actúa como Dungeon Master completo o si el usuario humano controla manualmente los eventos del mundo.
* **PROP2-138 · Desglose Narrativo de Críticos (Natural 20 y Natural 1)**: Instrucción para enriquecer con prosa especial los golpes críticos y las pifias catastróficas.
* **PROP2-139 · Gestión de Inventario y Peso de Carga (Encumbrance)**: Aviso visual si el peso de los objetos equipados supera la capacidad de carga (Fuerza $\times$ 15 libras), penalizando la velocidad.
* **PROP2-140 · Historial de Decisiones Éticas y Registro de Crónica**: Diario automático que anota los hitos morales de la aventura (a quién se perdonó la vida, a quién se traicionó).

---

## Área 8: Optimización de Tokens, Context Caching & Arquitectura Híbrida (`PROP2-141` a `PROP2-160`)

* **PROP2-141 · Segmentación Estricta de Prompts para Prompt Caching**: Separar el contexto invariable del mundo (facciones, lore histórico, reglas base) del estado volátil de la conversación para aprovechar el 90% de descuento en caché de Anthropic y Gemini.
* **PROP2-142 · Poda de Mensajes de Combate Resuelto**: Al terminar una batalla en el tablero, condensar las 30 tiradas intermedias en una sola frase de crónica narrativa, liberando 3.000 tokens de contexto para la siguiente escena.
* **PROP2-143 · Inyección de Lorebook por Proximidad Espacial**: Configurar SillyTavern para que solo active entradas de Lorebook pertenecientes a la `locationId` actual y a los personajes presentes en ella.
* **PROP2-144 · Arquitectura Dual de Modelos (Flash + Pro)**: Utilizar un modelo ultrarrápido y barato (ej. Gemini 2.0 Flash o Llama 3.1 8B local) para generar action chips, verificar tiradas y resumir; y reservar el modelo potente para la prosa de diálogo.
* **PROP2-145 · Presupuesto de Tokens por Fase de Juego**: Dynamic Context Manager que asigna 4.000 tokens en fase social/narrativa y reduce a 1.000 tokens en combate táctico (donde la lógica es local).
* **PROP2-146 · Memorias Ancla Permanentes (Anchor Memories)**: Marcar recuerdos clave e inmutables del personaje que jamás son eliminados ni resumidos por la compresión de contexto.
* **PROP2-147 · Contador en Tiempo Real de Tokens y Coste Estimado**: Indicador discreto en el pie de página que muestra los tokens consumidos en la sesión y el coste aproximado acumulado.
* **PROP2-148 · Compresión Jerárquica de Conversaciones Antiguas**: Algoritmo que resume capítulos pasados en párrafos ejecutivos a medida que la campaña avanza hacia nuevos actos.
* **PROP2-149 · Vectorización Local de Lorebooks con Embeddings WASM**: Búsqueda semántica de entradas de información del mundo ejecutada 100% en el navegador del usuario sin llamadas de API externas.
* **PROP2-150 · Supresión de Tokens Mecánicos en el Envío de Chat**: Evitar enviar tablas de estadísticas completas en cada turno; enviar únicamente el delta de cambios (HP restante y estados activos).
* **PROP2-151 · Caché en Memoria de Fichas de Monstruos**: Evitar parsear y formatear repetidamente los datos de criaturas idénticas en un mismo encuentro.
* **PROP2-152 · Desactivación de Herramientas de Chat Innecesarias en Batalla**: Durante el combate táctico, deshabilitar herramientas de búsqueda de extensiones que no aplican a la escaramuza.
* **PROP2-153 · Plantillas de Salida Estructurada con Gramáticas Locales**: En conexiones con Ollama/vLLM, usar gramáticas GBNF para garantizar JSON estricto sin gastar tokens de reintento.
* **PROP2-154 · Reutilización de Tokens de Saludo Inicial**: No reenviar el saludo inicial completo si ya ha sido resumido en el archivo de crónica de la sesión.
* **PROP2-155 · Filtro de Menciones Duplicadas en el Mismo Mensaje**: Si dos términos apuntan a la misma entrada de Lorebook, inyectar el contenido una sola vez.
* **PROP2-156 · Medición de Latencia de Inferencia por Proveedor**: Registro comparativo del tiempo de respuesta (Time to First Token) entre conectores configurados para elegir la ruta más ágil.
* **PROP2-157 · Desconexión de Modelos en Segundo Plano**: Pausar llamadas activas si la pestaña del navegador pierde el foco durante más de 5 minutos.
* **PROP2-158 · Normalización de Espacios en Blanco y Metadatos**: Sanitizador previo al envío que elimina saltos de línea innecesarios y JSON identado redundante en los prompts.
* **PROP2-159 · Modo Offline Completo con Modelos Cuantizados**: Configuración validada para ejecutar el Game Shell al 100% con modelos locales GGUF de 8B sin conexión a Internet.
* **PROP2-160 · Telemetría Local de Rendimiento del Contexto**: Informe descargable en JSON sobre el tamaño medio de prompt por turno y la efectividad de la activación de Lorebook.

---

## Área 9: Persistencia Robusta, Guardado en Ranuras & Portabilidad de Campañas (`PROP2-161` a `PROP2-180`)

* **PROP2-161 · Sistema de Guardado Atómico en Múltiples Ranuras (Slots)**: Permitir tener múltiples ranuras de guardado manual por campaña más una ranura de autoguardado rápido (`QuickSave` y `AutoSave`).
* **PROP2-162 · Guardado Automático al Cambiar de Localidad o Concluir Batalla**: Disparar la persistencia de estado inmediatamente tras transiciones espaciales o victoria táctica.
* ✅ **PROP2-163 · Instantáneas de Seguridad (Snapshots)** *(hecho el 2026-09-22)*: Crear un punto de retorno automático antes de batallas contra jefes o diálogos críticos de historia.
* **PROP2-164 · Formato Estándar de Exportación de Partida (.sav.json)**: Archivo descargable que reúne el estado exacto de la party, el calendario, las relaciones, las misiones y la niebla de guerra revelada.
* **PROP2-165 · Asistente de Resolución de Conflictos al Importar**: Si un paquete contiene una facción o personaje que ya existe en la base de datos local, ofrecer renombrar, sobrescribir o combinar.
* **PROP2-166 · Migrador Semántico de Versiones de Partida Guardada**: Garantizar que actualizaciones del motor de juego no corrompan partidas guardadas creadas con esquemas anteriores.
* **PROP2-167 · Modo Creador / Dungeon Master en Vivo**: Opción de activar una barra de herramientas de DM para modificar el HP de un monstruo, añadir un cofre al tablero o forzar una tirada sin reiniciar la partida.
* **PROP2-168 · Registro Histórico de Deshacer / Rehacer (Undo / Redo)**: Posibilidad de deshacer el último movimiento de token erróneo antes de presionar el botón de fin de turno.
* **PROP2-169 · Clonación de Campañas**: Duplicar una campaña para explorar ramificaciones argumentales alternativas sin perder la partida principal.
* **PROP2-170 · Sincronización en la Nube Personal (Google Drive / WebDAV)**: Exportación/importación automática de partidas guardadas a servicios de almacenamiento personal del usuario.
* **PROP2-171 · Integridad Criptográfica de Archivos de Campaña**: Comprobación de suma de verificación (SHA-256) para asegurar que un paquete de campaña no ha sido alterado o dañado.
* **PROP2-172 · Separación Clara entre Datos de Campaña y Metadatos de Chat**: Almacenar la lógica RPG en un bloque desacoplado dentro de `chat_metadata` para que el chat de texto estándar pueda exportarse limpiamente.
* **PROP2-173 · Soporte para Múltiples Grupos de Aventureros en el Mismo Mundo**: Poder jugar con un segundo grupo de personajes en el mismo mapa del mundo, compartiendo el impacto en las facciones.
* **PROP2-174 · Gestor de Modificadores Caseros (Homebrew Rules Toggle)**: Panel donde el usuario activa o desactiva reglas opcionales (ej. descanso severo, flanqueo táctico, pifias críticas).
* **PROP2-175 · Registro de Estadísticas de Toda la Campaña**: Estadísticas globales visibles al final (turnos jugados, daño total infligido, enemigos derrotados, oro amasado, kilómetros viajados).
* **PROP2-176 · Bloqueo de Escritura Concurrente en Guardado**: Evitar que dos eventos asíncronos intenten persistir el estado a la vez sobreescribiendo el progreso.
* **PROP2-177 · Purga de Datos Huérfanos de Campañas Borradas**: Función de mantenimiento que limpia imágenes no utilizadas o variables de chats eliminados en el almacenamiento local.
* **PROP2-178 · Copia de Seguridad Automática Semanal**: Exportación automática comprimida de todas las campañas activas a una carpeta de backups locales.
* **PROP2-179 · Modo Solo Lectura / Galería de Campañas Concluidas**: Archivar campañas completadas para poder releer el diario y ver los mapas sin riesgo de modificar los datos.
* **PROP2-180 · Importador desde Formatos de VTT Populares (Foundry / Roll20 JSON)**: Convertidor de mapas y bestiarios exportados de otros entornos de rol a tableros del motor SillyTavern.

---

## Área 10: Rendimiento, Calidad del Código, Testing & Fork Discipline (`PROP2-181` a `PROP2-200`)

* **PROP2-181 · Suite de Pruebas Unitarias para el Esquema de 7 Categorías**: Crear un archivo de test automatizado (`tests/deep-world-schema.test.mjs`) que verifique exhaustivamente la integridad del nuevo esquema JSON.
* **PROP2-182 · Test E2E de Viaje y Combate en SillyTavern**: Ampliar `tools/e2e-campaign.mjs` para validar la transición de mapa a localidad, apertura de puerta y resolución de objetivo de escenario.
* **PROP2-183 · Regla de Oro del Fork: Aislamiento Total en Módulos Nuevos**: Garantizar que todo el Game Shell y la lógica de campañas se carguen mediante inyección modular dinámica sin modificar `index.html` de upstream.
* **PROP2-184 · Renderizado del Tablero con requestAnimationFrame**: Optimizar el bucle de dibujado del lienzo de combate para alcanzar 60 FPS estables incluso en tableros grandes (40x30 casillas).
* **PROP2-185 · Capas de Dibujado Desacopladas en el Lienzo**: Separar el renderizado en tres capas independientes (Capa 1: Terreno estático; Capa 2: Niebla de guerra y luz; Capa 3: Tokens y animaciones) evitando redibujar el fondo en cada frame.
* **PROP2-186 · Gate de Tipos Estricto con JSDoc y TypeScript CLI**: Mantener 0 errores de tipado en `tools/check-fork-types.mjs` sobre todos los archivos del fork en cada integración.
* **PROP2-187 · Monitoreo y Prevención de Fugas de Memoria en DOM**: Implementar un método `.destroy()` riguroso en los contenedores del visor de mapas para liberar texturas y listeners de eventos al cerrar la escena.
* **PROP2-188 · Diagnóstico de Salud de Campaña en Caliente (`/diagnostics-rpg`)**: Comando interno que audita en consola la coherencia de los datos en memoria y avisa si hay IDs rotas o referencias circulares.
* **PROP2-189 · Cobertura de Tests para Todas las Nuevas Condiciones D&D**: Añadir pruebas deterministas para verificar que cada uno de los 15 estados alterados aplica correctamente sus ventajas y desventajas mecánicas.
* **PROP2-190 · Verificación de Rendimiento de Pathfinding A***: Medir que el cálculo de rutas en tableros con obstáculos complejos se resuelva en menos de 5 milisegundos por token.
* **PROP2-191 · Sanitización Estricta de HTML en Tooltips y Popups**: Prevenir cualquier vector de inyección XSS en nombres de monstruos, descripciones de hechizos o textos importados de libros.
* **PROP2-192 · Documentación de Código con JSDoc Exhaustivo**: Comentar todos los métodos y tipos exportados con definiciones de parámetros y valores de retorno para asistencia en el IDE.
* **PROP2-193 · Pipeline de Integración Continua (GitHub Actions) Blindado**: Ejecutar linting, verificación de tipos y suite de tests completa antes de autorizar cualquier fusión a la rama `my-silly`.
* **PROP2-194 · Manejador Global de Excepciones del Game Shell**: Si un módulo de interfaz sufre un error imprevisto, capturarlo y mostrar un aviso de recuperación en lugar de congelar la pestaña del navegador.
* **PROP2-195 · Medición de Tiempo de Carga de Módulos (Profiling)**: Auditoría de los tiempos de importación de scripts en el arranque para garantizar que el Game Shell cargue en menos de 500 milisegundos.
* **PROP2-196 · Mocking Inteligente para Pruebas sin Conexión**: Simulador de respuestas de LLM en las suites de pruebas para testear el flujo de generación sin gastar llamadas de API reales.
* **PROP2-197 · Desacoplamiento de Estilos CSS con Espacio de Nombres Seguro**: Todos los estilos del Game Shell encapsulados bajo el prefijo `.st-rpg-` para evitar interferencias con los temas visuales de SillyTavern.
* **PROP2-198 · Banco de Pruebas con Mapas Tácticos Extremos**: Pruebas de estrés con mapas gigantescos y 50 enemigos simultáneos para garantizar la escalabilidad del motor de IA determinista.
* **PROP2-199 · Sincronización Automática con Wiki y Documentación**: Scripts en `tools/` que actualizan los recuentos de propuestas y archivos cubiertos en la wiki tras cada avance importante.
* **PROP2-200 · Congelación de Contratos de API del Motor (Stable API v2)**: Fijar la firma de los métodos públicos del motor de juego para asegurar estabilidad total a futuro y compatibilidad con futuras expansiones.

---

## 📊 Matriz de Clasificación y Prioridades V2

A continuación se resumen las 200 propuestas clasificadas por impacto y horizonte de ejecución:

| Prioridad | Enfoque Principal | Propuestas Clave |
| :--- | :--- | :--- |
| **Alta (Inmediata)** | **Game Shell, Zero Comandos & Contratos de Generación** | `PROP2-001` a `PROP2-009`, `PROP2-021`, `PROP2-022`, `PROP2-041` a `PROP2-044`, `PROP2-061`, `PROP2-062`, `PROP2-121` a `PROP2-123`, `PROP2-181`, `PROP2-183` |
| **Media (Medio Plazo)** | **Bucle Social Persona, Facciones Reactivas & Magia Táctica** | `PROP2-045` a `PROP2-050`, `PROP2-063` a `PROP2-073`, `PROP2-081` a `PROP2-088`, `PROP2-101` a `PROP2-106`, `PROP2-124` a `PROP2-128`, `PROP2-141` a `PROP2-144` |
| **Baja (Evolución)** | **Economía Profunda, Modding, Sonido & Herramientas Avanzadas** | `PROP2-010`, `PROP2-025`, `PROP2-089` a `PROP2-100`, `PROP2-107` a `PROP2-120`, `PROP2-129` a `PROP2-140`, `PROP2-161` a `PROP2-180` |

---

> [!TIP]
> **Relación con el Plan de Trabajo**:
> Las propuestas de este catálogo alimentan las fases de trabajo recogidas en [[ROADMAP]] y las tareas activas en [[POR_HACER]]. A medida que se implementen o descarten, se anotará su estado como se hizo en la V1.
