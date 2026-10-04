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

## 🎯 Conclusión de Diseño

La arquitectura actual del proyecto ya soluciona brillantemente el desgaste con el cansancio (E5.2), el uso de recursos vitales como la luz (E2.1), la supervivencia (acampar en zona hostil) y la utilidad táctica de los vínculos (ataques definitivos y de pareja E3.2). 

El verdadero reto final de diseño (E9) es pulir la **gestión del tiempo** en el pueblo (para que las agendas y el mantenimiento del oro generen tensión orgánica) y convertir el farmeo en algo específico e ilusionante con el botín con nombre. Con esto, la experiencia será redonda.
