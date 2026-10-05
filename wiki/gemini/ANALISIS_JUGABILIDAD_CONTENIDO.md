# Análisis de Jugabilidad y Contenido (Actualizado)

*Nota: Este documento ha sido corregido para reflejar el estado real del motor y los documentos de diseño del proyecto tras la revisión.*

El motor de rol no solo cubre las mecánicas tácticas de D&D, sino que ya tiene integrados (o diseñados en su hoja de ruta bajo los códigos E y J) los pilares de supervivencia, gestión y vínculos sociales. 

A continuación, nos centramos en las **piezas que faltan por diseñar/refinar (Grupo E9)** para terminar de cohesionar el bucle de juego, descartando mecánicas que no encajan (como el estrés a lo Darkest Dungeon o los plazos estrictos que expiran).

## 1. La Presión del Tiempo sin Plazos Estrictos (E9.1)
El sistema de partes del día (Mañana, Tarde, Noche - J14.11) ya funciona, y acciones como trabajar, entrenar o quedar consumen esas partes.

* **El Problema**: Sin plazos estrictos (D-J46), gastar una parte del día no cuesta nada a largo plazo. Elegir con quién quedar pierde su peso estratégico.
* **La Solución**: Conseguir tensión sin castigar al jugador.
  * **Agendas Limitadas**: Cada persona está libre solo ciertos días o ratos. Tienes que adaptarte a su horario.
  * **Eventos de Calendario**: Sucesos que solo ocurren en un momento concreto (el mercado, la feria).
  * **Coste de Vida**: Las semanas cuestan oro. Si solo "pasas el rato", el mantenimiento del gremio y la vida te dejarán sin blanca, forzándote al calabozo.

## 2. Botín Específico y Artesanía Adictiva (E9.2)
Las recetas de trofeos y la mejora de edificios (E5) ya son una realidad, pero las recetas de botín actuales son genéricas.

* **El Objetivo**: Crear el bucle de cacería ("Monster Hunter") que es puro veneno adictivo.
* **La Solución**: Que cada monstruo "jefe" o grande deje su pieza única, atada a una receta concreta. (Ej: *Piel de Lobo Alfa* para una capa sigilosa, *Sangre de Troll* para guanteletes de regeneración).

## 3. Sumideros de Oro para Niveles Altos (E9.3)
En las reglas de D&D el oro suele sobrar estrepitosamente a niveles altos.

* **El Objetivo**: Mantener el valor del dinero (loot) durante expansiones de nivel alto (ej. la expansión de Strahd).
* **La Solución**: Inversiones colosales. Comprar un título de nobleza, expandir la sede del gremio a nivel de castillo, o lujos desmedidos que den prestigio.

## 4. Encargos como Cadenas de Pasos (E9.4)
Para misiones secundarias o encargos del mundo semiabierto, donde no hay un mapa o tablero diseñado a mano.

* **El Objetivo**: Dar estructura a los encargos para que no sean "ir, pegar y volver".
* **La Solución**: Un mapa corto generado por código, de 3 a 5 pasos secuenciales (ej. Trampa -> Suceso -> Pelea -> Descanso). Esto encaja perfectamente en el mundo semiabierto sin consumir recursos masivos de diseño de niveles.

---

## 5. El Nuevo Paradigma: La Dupla Inicial (Estratega + Guardaespaldas) y Brunilda (E10)

Esta solución armoniza el rol de Manager con el contenido existente, permitiendo que la historia, el prólogo y los guiones sigan funcionando casi sin cambios.

### 5.1 Identidad: La Dupla de Campo y la Intendente del Gremio
* **El Jugador (Estratega / Propietario):** Es la mente táctica, el diplomático y el dueño del caserío/compañía. **NO aparece en el tablero de casillas**: no tiene token, no ocupa casilla, no tiene barra de PV que puedan golpear ni estorba en la cuadrícula. Su presencia es de mando (diálogos, descansos, contratos y la barra de órdenes/«Hablar»).
* **El Guardaespaldas (Primer Combatiente):** Es el primer miembro físico del grupo (`partyMembers[0]`) y quien sí tiene token en el tablero, empuña el arma y recibe los golpes en el fango.
* **Brunilda (Administrativa / Intendente):** Ex-guerrera de escudo retirada con libro de cuentas y pluma (ya en el compendio). Os espera en el gremio para gestionar contratos, cuentas, bajas y mantenimiento.

### 5.2 Creación de Personaje: La Dupla al Inicio
* **Al Empezar la Partida:**
  1. **El Estratega:** Se define con rapidez (Nombre/Título, estandarte del Caserío/Compañía, retrato de líder y trasfondo de gestión). Cero estadísticas de combate.
  2. **El Guardaespaldas:** Se crea usando el **Creador Completo de Personajes D&D 2024** (`hero-creator.js`), eligiendo su clase de combate (Guerrero, Paladín, Bárbaro, etc.), raza, tiradas de atributos y equipo inicial. Este es el personaje que entra físicamente al tablero.
* **En el Gremio / Caserío:**
  * La mesa de reclutamiento de Brunilda mantiene abierta la opción de **«Crear aventurero personalizado»** para incorporar nuevos combatientes a la compañía más adelante, además de contratar mercenarios locales de paso.

### 5.3 El Prólogo del Muelle se Conserva (Adaptación Orgánica)
* **No se descarta el prólogo:** Llegas a Puerto Alba junto a tu guardaespaldas.
* **El Encuentro con el Ratero en el Tablero:**
  * En el tablero de casillas del muelle solo hay dos tokens: el **Guardaespaldas** y el **Ratero** (el Estratega no está en la cuadrícula).
  * Narrativamente, el ratero increpa al Estratega, pero es el Guardaespaldas quien se planta en combate para batirse.
  * **Didáctica Impecable:**
    * El jugador controla al guardaespaldas (o lo deja en combate automático con la IA aliada).
    * La opción **«Hablar»** la ejecuta el Estratega para disuadir o negociar con el ratero desde la barra de mando.
  * Tras resolver la pelea, la comitiva avanza hacia Tomás y el gremio donde Brunilda os recibe.
* **Impacto en el código:** Mínimo. Los tests e2e existentes (`e2e-calabozo.mjs`, `e2e-entrada.mjs`, etc.) y las escenas siguen funcionando exactamente igual: el token aliado del muelle es el Guardaespaldas.

### 5.4 Control Flexible de la Escuadra en Combate (0 a Todos / Modo Manager)
* Las posturas tácticas de `ally-ai.js` son dinámicas **entre la propia escuadra de combatientes**:
  * *En formación / Guardia (`cerca`):* Mantenerse cubriendo al líder de campo (el guardaespaldas) y no romper la línea.
  * *A la carga (`carga`):* Ir al frente al cuerpo a cuerpo.
  * *Atrás (`atras`):* Guardar distancias con armas a distancia/magia.
* El jugador decide libremente su grado de intervención:
  * **Modo Manager Puro (0 Manual):** Todos los combatientes del tablero pelean solos con su IA.
  * **Modo Híbrido (1 a 3 Manuales):** El jugador maneja al guardaespaldas (o al que prefiera) y la IA lleva al resto.
  * **Modo Táctico Clásico (Todos Manuales):** Control total de cada combatiente.

---

## 📋 Roadmap Técnico de Implementación (E10)

| Tarea | Módulo / Archivos | Acción a Realizar | Estado |
| :--- | :--- | :--- | :--- |
| **E10.1** | `campaign/strategist.js`, `strategist-creator.js`, `campaigns.js` | Flujo de creación de la Dupla: Paso 1 (Estratega con trasfondo de gestión) y Paso 2 (Guardaespaldas con creador D&D 2024). | ✅ Hecho |
| **E10.2** | `ui/hub-panel.js`, `party/hub.js`, `hero-creator.js` | Acción «Crear Aventurero Personalizado» en el tablón de reclutamiento de la Guild / Brunilda para incorporar nuevos miembros a la compañía. | ✅ Hecho |
| **E10.3** | `party/spell-turn.js` | Desbloquear `partyMembers[0]` para permitirle `control = 'engine'` si se desea jugar en Modo Manager puro. | ✅ Hecho |
| **E10.4** | `party/spell-turn.js`, `combat-flow.js` | Control flexible manual/engine para toda la escuadra sin bloqueos artificiales. | ✅ Hecho |
| **E10.5** | UI de Combate / `board-view.js` | Añadir selector rápido de modo de control: `[Todo Manual]`, `[Modo Manager (IA)]` e individuales. | ✅ Hecho |
| **E10.6** | `mundos/gremio.pack.json` | Ajustar líneas y pistas del prólogo del muelle para que el ratero increpe al estratega y el guardaespaldas intervenga en el tablero. | ✅ Hecho |

---

## 🎯 Conclusión de Diseño

La dupla **Estratega + Guardaespaldas** resuelve magistralmente la ecuación:
1. **Mantiene intacto el valor del trabajo previo:** No hay que tirar a la basura el prólogo del muelle, ni los tests e2e, ni el creador de personajes inicial.
2. **Da sentido total al rol de Manager:** El estratega manda y el guardaespaldas actúa en el fango.
3. **Flexibilidad total para el jugador:** El que quiera jugar como siempre, controla al guardaespaldas; el que quiera jugar como manager de D&D, pone a todos en automático y disfruta de la táctica y la gestión.
