# 💡 Ideas para el juego: las que quedan

> Una batería para mejorar la jugabilidad, profundizar lo que ya existe, pulir la comodidad (QoL) y hacer el juego mejor en sí. Escrita el 2026-09-24, con el motor tal como está tras las partes 4–7 de [Mundos vivos](ROADMAP_MUNDOS_VIVOS.md).

**Cómo leerla**

- **Tipo**: 🔧 profundiza algo que ya existe · ✨ sistema nuevo · 🪶 comodidad (QoL).
- **Esf.** (esfuerzo): **S**, una sesión · **M**, varias · **L**, una fase entera.
- **Tokens**: salvo que la idea diga «llamada», cuesta **0 tokens**, porque lo decide el motor. Las que llaman al modelo lo dicen.
- Lo que ya está en [POR_HACER](POR_HACER.md) (P2–P23) o en el roadmap (T2–T5, L4–L7, C2–C8) **no se repite**. Cuando una idea lo amplía, lo pone.
- Algunas pueden solaparse con [PROPUESTAS_MEJORA](PROPUESTAS_MEJORA.md) y su V2, que no he vuelto a repasar una a una. Donde sospecho que algo existe a medias, pone **revisar**.

**Qué sale aquí**: solo las **22** que quedan por hacer, más las 3 aparcadas al final. Las hechas y las quitadas están en «Decisiones de Daniel»; el detalle de lo hecho, en el roadmap. La numeración es la original, por eso hay saltos.

## 🗂️ Decisiones de Daniel

**Quitadas (2026-09-24):** 50 (Defecto opcional), 51 (Meta personal), 112 (Nueva partida+), 133 (Desgaste ligero), 154 (Punto de guardado), 157 (Tamaño de letra y alto contraste), 161 (Saltar a sucesos), 165 (Medir distancias), 167 (Confirmar lo irreversible), 170 (Modo foto), 171 (La partida como relato), 196 (Logros por mundo), 197 (Reto semanal).

**Quitadas en la segunda criba (2026-09-24):** 12 (Ruido), 16 (Pifia leve), 19 (Modo rápido), 60 (Carga y mochila), 76 (Paredes falsas), 79 (Entrar sin ser visto), 80 (Descanso corto), 83 (Territorio en el mapa), 98 (Te ganan el sitio), 99 (Cambios de acto), 158 (Tablero táctil), 177 (Probar un tablero), 194 (Paleta por mundo).

**Más adelante:** 69 y 70 (cosas del mapa: aún no hay mapa) y 187 (música por contexto).

**Hechas** (detalle en [Mundos vivos](ROADMAP_MUNDOS_VIVOS.md), apartado «Hecho»):

- **Batería 1 (2026-09-24):** 2, 14, 22, 26, 27, 34, 49, 64, 66, 82, 85, 100, 103, 136, 138, 147, 159, 162, 174, 191. La 27 ampliada después con seis frases por caso, sin repetir, y carácter propio para cada confidente.
- **Batería 2 (2026-09-24):** 1, 3, 6, 13, 15, 38, 44, 47, 56, 63, 68, 78, 81, 86, 91, 108, 153, 164, 188, 190.
- **Batería 3 (2026-09-24):** 7, 9, 10, 17, 18, 21, 35, 39, 41, 43, 57, 72, 77, 88, 92, 95, 150, 151, 152, 168.
- **Batería 4 (2026-09-24):** 55, 61, 89, 104, 113, 117, 118, 126, 127, 134, 137, 148, 149, 155, 156, 169, 172, 182, 198, 200. Con ella, la tienda (L5 del roadmap).
- **Batería 5 (2026-09-24):** 5, 11, 20, 36, 37, 45, 52, 71, 84, 106, 111, 114, 119, 122, 125, 132, 135, 141, 146, 199. La 124 (almacén del gremio) se cambió por la 36: sin la 60 (carga), el almacén no servía para nada.
- **Batería 6 (2026-09-24):** 4, 24, 46, 54, 65, 73, 90, 101, 102, 107, 109, 110, 128, 129, 144, 160, 181, 189, 192, 195.
- **Batería 7 (2026-09-24):** 8, 23, 28, 30, 32, 42, 58, 59, 62, 67, 74, 87, 97, 116, 120, 121, 139, 142, 145, 163, 180, 186. De 22, para que las que quedan sean otra de 22.
- **Ya existía:** 33 (regalos): la ficha del compañero ya tenía «regalar», con veredicto y vínculo. Y al preparar la batería 5: 53 (agotamiento por no dormir), 93 (encargos que caducan, con su castigo desde la 85), 123 (edificios del gremio), 166 (alcance y ruta antes de mover), 173 («Anteriormente…», la 108) y 193 (iconos de estado: grupo, iniciativa y tablero usan los mismos).
- **La 104, a medias antes:** la reputación ya bajaba con las facciones enemigas; faltaba decirlo.

---

## ⚔️ 1. Combate táctico (1–25) · quedan 1

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 25 | **Red de seguridad opcional**: tras dos derrotas seguidas, el siguiente encuentro baja un escalón, avisando. **Decisión tuya** | Corta la espiral de derrota | 🔧 | S | encuentros |

## 🤝 2. Compañeros y vínculos (26–45) · quedan 3

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 29 | **Se van** si el vínculo cae mucho o si ignoras lo que quieren demasiado tiempo. **Decisión tuya** | El vínculo deja de ser decorativo | ✨ | M | `bonds.js` |
| 31 | **Charlas de campamento** entre dos compañeros. Una llamada, opcional | El grupo cobra vida propia | ✨ | M | acampar, P16 |
| 40 | **Invitar a una ronda con tema** (pasado, miedo, ambición) que abre escenas distintas | Profundiza L3 | 🔧 | M | L3, escenas de vínculo |

## 🧙 3. Personaje y progresión (46–63) · quedan 1

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 48 | **Árbol pequeño por clase** (3 ramas de 3) | Dos guerreros distintos | ✨ | L | clases |

## 🗺️ 4. Exploración y viaje (64–81) · quedan 1

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 75 | **Mazmorras de varios tableros** con escaleras y estado que persiste | Incursiones de verdad | ✨ | M | generador de mazmorras |

## 🌍 5. Mundo vivo (82–99) · quedan 2

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 94 | **Aventureros rivales** que compiten por los mismos encargos | Presión y un enemigo con cara | ✨ | M | tablón |
| 96 | **Ley y crimen**: robar sube «buscado», y aparecen guardias. **Decisión tuya**: el roadmap lo aparcó | Consecuencias para el pícaro | ✨ | L | — |

## 📜 6. Hilo, misiones y narrativa (100–117) · quedan 2

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 105 | **Escoltas** con un PNJ en el tablero | Otro tipo de combate | ✨ | M | `ally-ai.js` |
| 115 | **Un villano que se deja ver** en mitad del hilo, no solo al final | Un antagonista con presencia | 🔧 | M | guion del Gem |

## 🏪 7. Localidades, economía y objetos (118–135) · quedan 3

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 124 | **Almacén del gremio** | No lo cargas todo encima | 🪶 | S | `guild.js` |
| 130 | **Pasajes en barco** desde los puertos | Mundos más grandes | ✨ | M | caminos |
| 131 | **Mercenarios** de un solo encargo | Oro contra riesgo | ✨ | M | `ally-ai.js` |

## 💬 8. El chat y el motor (136–151) · quedan 2

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 140 | **Cambios de actitud propuestos** para un PNJ, con límites | El diálogo mueve la reputación | 🔧 | M | reputación |
| 143 | **Resumen por acto**: el chat viejo se comprime en la memoria del mundo. Una llamada por acto | Partidas largas más baratas | ✨ | M | `world-memory.js` |

## 🖥️ 9. Interfaz y comodidad (152–173) · todas hechas

Todas hechas.
## 🛠️ 10. Crear mundos (174–185) · quedan 7

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 175 | **Vista previa del mundo**: mapa, facciones y grafo de hitos | Ver el mundo antes de jugarlo | ✨ | M | paquete |
| 176 | **Editor visual de hitos**, un grafo que se arrastra | Crear hilos sin YAML | ✨ | L | `plot.js` |
| 178 | **Plantillas de mundo** (terror, piratas) para empezar de cero con más base | Mundos de cero menos vacíos | ✨ | M | compendio |
| 179 | **Héroes veteranos**: traer tu personaje de otra campaña | Continuidad | ✨ | S | personajes |
| 183 | **Ilustraciones** de sitios y PNJ con PixelLab, opcional. Cuesta créditos | Mundos con cara | ✨ | M | PixelLab |
| 184 | **El mundo se adapta al héroe**: el taller elige hitos opcionales según el trasfondo | Encaje de verdad | ✨ | M | premisa, `plot.js` |
| 185 | **Modo director**: añadir un PNJ o un sitio en mitad de la partida | Arreglar sobre la marcha | 🔧 | M | `campaign-editor.js` |

## 🎨 11. Sensación (186–195) · todas hechas

Todas hechas.
## 🔁 12. Rejugabilidad (196–200) · todas hechas

Todas hechas.

---

## ⏳ Más adelante

Aparcadas por Daniel: las dos del mapa esperan a que haya mapa, y la música también va para luego.

| # | Idea | Por qué | Tipo | Esf. | Se apoya en |
| :--- | :--- | :--- | :---: | :---: | :--- |
| 69 | **Mapa con niebla**: sitios sin visitar en gris, caminos desconocidos punteados | Ganas de explorar | 🔧 | S | mapa |
| 70 | **Notas en el mapa**: chinchetas con texto | Recordar tus propias pistas | 🪶 | S | mapa |
| 187 | **Música por contexto**: combate, pueblo, viaje | Ambiente | 🔧 | S | audio |

---

## 🔗 Enlaces

- [Mundos vivos](ROADMAP_MUNDOS_VIVOS.md): el roadmap en curso.
- [POR_HACER](POR_HACER.md): donde pasan las ideas que marques con ✅.
- [PROPUESTAS_MEJORA](PROPUESTAS_MEJORA.md) y [V2](PROPUESTAS_MEJORA_V2.md): las baterías anteriores.
