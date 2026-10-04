# Roadmap: Actualización de Contenido D&D 2024

## 📍 Cómo va (2026-10-04)

**Hecho casi todo.** Lo que queda, para que decidas:
- **Acciones legendarias:** el motor no las tiene (los jefes contestan una vez por ronda). ¿Se hacen?
- **Números de los bichos:** siguen la curva del juego, algo más baja que el SRD (el trol, 86 PV en vez de 94). ¿Exactos al SRD?
- **Armaduras de 2024:** la Cota de malla y la Coraza cambian para quien ya las lleva (el guerrero pasa de CA 16 a 18).
- **El ki y la Imposición de manos** van por usos de cada habilidad, no como bolsa compartida (el motor no tiene bolsas compartidas). ¿Se hace la bolsa?
- **El paladín** lanza desde el nivel 2 (como el explorador; en 2024, desde el 1) y prepara pocos conjuros. Cambiarlo toca también al explorador.
- **Falta:** Aura de protección (nivel 6), Desviar ataques, Sentido divino; 7 de los 10 linajes del dracónido y el aliento que sube con el nivel; otras herencias del Goliat; pociones de resistencia, escalada y aliento de fuego (el motor no sabe aplicarlas).
- **Arte:** unos 55 dibujos (iconos de clase, raza, equipo y habilidad, retratos y 13 bichos), apuntados en [[PIXELLAB_PENDIENTE]].

Este documento detalla el plan de acción para integrar el contenido faltante oficial de D&D 2024 (y 5e) en el motor del juego. Aunque el motor (la lógica subyacente en JavaScript) ya soporta la mayor parte de estas mecánicas, falta definirlas en los archivos del compendio (JSON).

## 1. Clases Faltantes (`clases.json`)
Hecho el 2026-10-04 (Paladín y Monje): sus filas en `clases.json` (dado, equipo con 5 antorchas, magia del paladín), se eligen al crear y salen de mercenarios de paso; el paladín lleva el retrato del clérigo hasta tener el suyo (`wiki/PIXELLAB_PENDIENTE.md`). Prueba: `tests/game-engine-paladin-monje.test.js`.
Hecho el 2026-10-04 (Brujo y Hechicero): sus filas (d8 y d6, Carisma, magia de pacto y lanzador completo, los dos «se los saben» con las tablas de 2024), su lista de conjuros en `conjuros.json`, se eligen al crear y salen de mercenarios de paso; llevan el retrato del mago hasta tener el suyo (`wiki/PIXELLAB_PENDIENTE.md`). Prueba: `tests/game-engine-brujo-hechicero.test.js`.
El motor de reglas ya las contempla en archivos como `checks.js` y `spell-slots.js`, pero hay que darlas de alta para que puedan ser elegidas por los personajes y asignadas a los NPCs.

* **Paladín** ✅:
  * *Dado de golpe*: 1d10
  * *Características*: Fuerza, Carisma
  * *Magia*: Medio lanzador (`half`), modo `prepared`, foco divino.
* **Monje** ✅:
  * *Dado de golpe*: 1d8
  * *Características*: Destreza, Sabiduría
  * *Especial*: Requiere revisión de artes marciales en `weapon-mastery.js` y reglas de combate desarmado (`unarmed.js`).
* **Brujo (Warlock)** ✅:
  * *Dado de golpe*: 1d8
  * *Características*: Carisma
  * *Magia*: Progresión de pacto (`pact`), modo `known`, foco arcano.
* **Hechicero (Sorcerer)** ✅:
  * *Dado de golpe*: 1d6
  * *Características*: Carisma
  * *Magia*: Lanzador completo (`full`), modo `known`, foco arcano.

## 2. Habilidades de Clase (`habilidades.json`)
Hecho el 2026-10-04 (Paladín y Monje): Imposición de manos (nivel 1), Castigo del paladín (2, gratis una vez) y el conjuro Castigo divino con espacio; su lista de medio lanzador, con Arma elemental. Monje: Artes marciales (dado de monje con Fuerza o Destreza, `unarmed.js`), Defensa sin armadura y Movimiento sin armadura (`rules/class-features.js`), Ráfaga de golpes, Defensa paciente y Paso del viento (2). Estilo de combate del paladín: Defensa, +1 a la CA desde el 2. Al subir de nivel ya se aprende lo de la clase (antes solo con un maestro). Sin hacer: Aura de protección (nivel 6) y el ki como bolsa compartida.
Hecho el 2026-10-04 (Brujo y Hechicero): Descarga sobrenatural (truco nuevo que sube en rayos: 2 en el 5, 3 en el 11, 4 en el 17) con la Descarga agonizante sola desde el nivel 2 (columna `addModifierFrom`); Brazos de Hadar; los espacios de pacto vuelven con el descanso corto; patrón Celestial con Luz sanadora (3). Hechicero: Magia innata (1: +1 a la CD y ventaja al atacar con conjuros), puntos de hechicería (su nivel desde el 2, vuelven con el largo), Conjuro rápido (2 puntos: el conjuro va con la acción adicional) y Conjuro cuidadoso (1 punto: el área no toca a los suyos), en `rules/sorcery.js`. Sin hacer: elegir invocaciones y patrón (hoy salen solos), crear espacios con puntos y la subclase del hechicero.
Actualmente, `habilidades.json` solo tiene configuradas las habilidades de nivel bajo para Guerrero, Bárbaro, Pícaro, Bardo, Explorador y Druida (ej. Ataque furtivo del Pícaro, Furia del Bárbaro).

* **Para las nuevas clases**:
  * **Paladín** ✅: Imposición de manos, Castigo divino (Divine Smite), Aura de protección (esta no: es de nivel 6).
  * **Monje** ✅: Ráfaga de golpes, Defensa sin armadura, Ki.
  * **Brujo** ✅: Descarga sobrenatural (Eldritch Blast), Invocaciones sobrenaturales (la agonizante, sola).
  * **Hechicero** ✅: Puntos de hechicería, Metamagia.
* **Para las clases existentes**:
  * Faltan la mayoría de habilidades pasivas y activas a partir de nivel 2-3 para casi todas las clases. Hay que mapear los árboles de subclase (`class-trees.js`).

## 3. Razas (`razas.json`)
Hecho el 2026-10-04: Dracónido rojo, azul y blanco (cada linaje su aliento y su resistencia), Aasimar (Manos curativas, resiste necrótico y radiante) y Goliat (Golpe de las colinas, +5 de velocidad). Los rasgos de raza son habilidades con `when.race` en `habilidades.json`; las resistencias cuentan contra el daño con tipo de habilidades y conjuros (`combat/monster-traits.js`).

El juego cuenta actualmente con un buen surtido de razas base (Humano, Enano, Elfo, Mediano, Semiorco, Gnomo, Tiflin) y varias originales (Marcado, Braceado, Huésped, Sangre alta).

* **Faltantes Oficiales a considerar**:
  * Dracónido (Dragonborn): Faltaría añadir su arma de aliento. ✅ (tres linajes: rojo, azul y blanco; faltan los otros siete)
  * Aasimar (opcional, contraparte del Tiflin). ✅
  * Goliat, Tabaxi u otras razas populares de expansiones si se desea ampliar. ✅ Goliat (de las colinas); Tabaxi no (no es del SRD)

## 4. Equipo y Objetos (`armas.json`, `armaduras.json`, `trastos.json`)
El equipo está bastante completo, cubriendo la mayoría del SRD, pero podemos refinarlo:

Hecho el 2026-10-04: ocho armas del SRD con su maestría de 2024 (también en `weapon-mastery.js`), Cota de escamas y Cota de bandas, la Cota de malla, la Coraza y las Pieles con los números de 2024, y las pociones de curación superior y suprema.

* **Armas**: Faltan algunas sutiles como el Látigo, Hoz, Estrella del alba (Morningstar), Dardo, o las armas de fuego (si la ambientación lo permite). ✅ Hoz, Látigo, Lucero del alba, Dardo, Pico de guerra, Martillo ligero, Gran clava y Ballesta pesada; sin armas de fuego
* **Armaduras**: Tienes una buena selección. Faltaría revisar si están las equivalencias exactas de "Cota de escamas" o "Camisa de mallas" según las estadísticas actualizadas de 2024. ✅ Cota de escamas nueva (CA 14 + Des hasta 2); la Camisa de anillas ya era la camisa de mallas (CA 13 + Des hasta 2); la Cota de malla pasa a 16 sin Destreza
* **Objetos mágicos**: Habría que revisar `objetos.json` (si existe o si se maneja en `magic-items.js`) para añadir la lista oficial de pociones y equipo mágico inicial. ✅ Curación superior y suprema (en `combat/loot-items.js` y el botín). Las de resistencia, escalada o aliento de fuego, no: el motor no sabe aplicarlas al beberlas

## 5. Bestiario (`bestiario.json`)
El bestiario actual tiene una base sólida (Lobos, Osos, Arañas, Esqueletos, Zombis, Trasgos, Kóbolds, Bandidos), y un sistema ingenioso de prefijos/sufijos ("viejo", "rabioso", "alfa").

Hecho el 2026-10-04: trece bichos del SRD con su desafío (`cr`) y el tramo en que salen (`when.cr`), sus resistencias, inmunidades y vulnerabilidades (las usa Arma elemental) y la regeneración del trol. Sin acciones legendarias: el motor no las tiene.

* **Grandes Ausencias**:
  * **Monstruos Icónicos**: Dragones (por edades/colores), Contempladores (Beholders), Cubos gelatinosos, Mímicos. ✅ Dragón rojo joven, Dragón blanco joven, Cubo gelatinoso y Mímico; el contemplador no (no es del SRD)
  * **Humanoides y Gigantes**: Orcos, Trolls, Goblins (además de los trasgos), Hobgoblins. ✅ Orco, Trol y Hobgoblin; el goblin es el Trasgo, que ya estaba
  * **Elementales y Fiends**: Elementales (fuego, agua, tierra, aire), Diablos y Demonios base (Diablillos, Quasits). ✅ los cuatro elementales, el Diablillo y el Quasit
  * **Jefes**: Se necesitan más bloques de estadísticas complejos para enemigos finales que usen acciones legendarias. ⏳ El motor no tiene acciones legendarias (los jefes contestan una vez por ronda, `boss-reaction.js`): queda por decidir si se hacen

---

## 🚀 Próximos Pasos (Propuesta de Ejecución)

1. **Fase 1: Alta de Clases**: Escribir los 4 bloques JSON para Paladín, Monje, Brujo y Hechicero en `clases.json`.
2. **Fase 2: Mapeo de Habilidades Base**: Añadir a `habilidades.json` las habilidades de nivel 1 y 2 de las clases recién añadidas (ej. Ki, Castigo Divino).
3. **Fase 3: Expansión de Bestiario**: Añadir un paquete de 10-15 monstruos icónicos de D&D a `bestiario.json` para dar más variedad al combate. ✅ (trece, el 2026-10-04)
4. **Fase 4: Árboles de Subclase**: Conectar las clases con `class-trees.js` para asegurar que el progreso a partir del nivel 3 funciona sin errores.
   * Paladín y Monje ✅ (2026-10-04): árboles propios en `class-trees.js`. «Juramento» (Devoción → Arma sagrada, Venganza → Voto de enemistad, Gloria → Golpe inspirador) y «Disciplina» (Mano abierta, Sombra, Misericordia); cada rama acaba enseñando su habilidad (`tec-*` de `habilidades.json`).
