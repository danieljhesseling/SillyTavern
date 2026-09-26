---
title: Sistema de Slash Commands & Motor de Macros
tags: [slash-commands, macros, parser, scripting, dnd, automation, cli]
created: 2026-09-20
updated: 2026-09-26
author: DanielJHesseling / Antigravity AI
---

# Sistema de Slash Commands & Motor de Macros

SillyTavern incorpora un motor de scripting completo que permite automatizar flujos, ejecutar lógica condicional, interactuar con la interfaz e intervenir en el estado de la partida directamente desde la caja de texto del chat o desde botones programables.

En este fork, el sistema se utiliza intensivamente para controlar el motor D&D mediante comandos dedicados para tiradas de dados, curación de personajes, gestión de equipamiento y alternancia de estados tácticos.

---

## 1. Arquitectura del Parser de Comandos (`slash-commands/`)

El sistema de comandos de barra se estructura bajo un diseño orientado a objetos en `public/scripts/slash-commands/`:

```
public/scripts/slash-commands/
├── SlashCommandParser.js      # Lexer y parser sintáctico de cadenas
├── SlashCommand.js            # Clase base para la definición de comandos
├── SlashCommandArgument.js    # Definición de tipos y validación de argumentos
├── SlashCommandEnumValue.js   # Soporte para argumentos de enumeración fija
└── SlashCommandClosure.js     # Soporte para bloques de código y subrutinas { ... }
```

### Tipos de Argumentos Soportados (`ARGUMENT_TYPE`)
- `STRING`: Cadenas de texto plano o entrecomilladas (`"cadena con espacios"`).
- `NUMBER`: Valores numéricos enteros o decimales.
- `BOOLEAN`: Banderas lógicas (`true`/`false`, `on`/`off`).
- `VARIABLE`: Nombres de variables internas guardadas en memoria o metadatos.
- `CLOSURE`: Bloques de código ejecutables `{ comando1; comando2 }` para estructuras como `/if`, `/while` o callbacks.
- `ENUM`: Lista restringida de opciones con autocompletado en el editor.

---

## 2. Los comandos del motor RPG

> [!NOTE]
> **Puesto al día con el código el 2026-09-26.** La versión anterior de esta sección describía comandos que nunca existieron (`/party heal`, `/dnd`, `/dynctx`, `/map goto`). La lista de abajo sale de los registros reales: **55 en `party.js`** y 2 en `dynamic-context-manager.js`. Casi todos tienen su botón en el Modo Juego; el comando sigue ahí porque el recorrido de pruebas entra por él.

Se registran con `SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name, callback, helpString, … }))`. `/help <comando>` enseña su ayuda dentro del juego.

**Moverse y el mundo**

| Comando | Qué hace |
| :--- | :--- |
| `/go <sitio>` · `/enter <tablero>` · `/leave` | Viajar a una localización, entrar en un tablero, salir (primero del tablero, luego del sitio) |
| `/bajar` | Bajar por la escalera al nivel siguiente, si alguien está en ella |
| `/mapa` | El mapa en texto: sitios, caminos, lo no visitado en gris y tus notas |
| `/explorar` · `/forrajear` · `/acampar` | Descubrir un sitio cerca, cazar y forrajear, acampar donde no hay posada. Gastan un rato del día |
| `/rumor` | Lo que se cuenta donde estás, uno cada vez |
| `/time` · `/descanso corto\|largo` | El día y el momento; descansar |

**Pelear**

| Comando | Qué hace |
| :--- | :--- |
| `/fight <enemigo> [n]` · `/enemigos` | Empezar un combate con lo que este tablero puede sacar; ver y editar quién puede salir |
| `/combat-attack` · `/combat-move <x> <y>` · `/combat-end` · `/combat-stop` | Atacar, mover, cerrar el turno, abandonar el combate |
| `/maniobra <esquivar\|destrabarse\|empujar\|ayudar>` | En vez de atacar |
| `/definitivo` · `/relevo` | Los golpes del vínculo de rango 10 y de rango 5 |
| `/postura` | Cómo pelea un compañero que se lleva solo |
| `/prisionero` | Qué hacer con un prisionero: interrogar, soltar, entregar |
| `/condition <nombre> <estado>` · `/objetivos` | Poner o quitar un estado; los objetivos del escenario |

**La magia y la mascota** (R4 y R5)

| Comando | Qué hace |
| :--- | :--- |
| `/grimorio [todo]` | Lo que el grupo sabe lanzar, con escuela, círculo y cargas; con `todo`, toda la magia que existe |
| `/pergamino` | Aprender el conjuro de un pergamino (el mago o el erudito). El pergamino se gasta |
| `/mascota` | Tenerla, preguntarle lo que aprieta, acariciarla |
| `/habilidades` | Escribir técnicas y recursos de clase, y repartir quién se sabe cada una. Los conjuros solo se ajustan: se crean en el código |

**La campaña y la semana**

| Comando | Qué hace |
| :--- | :--- |
| `/modo` | El modo de juego (Relajado, Normal, Supervivencia o a tu medida) y lo que está encendido |
| `/mesa` · `/cuenta` · `/gremio` | La mesa de la semana, lo que debes, el tablón y la casa |
| `/caso` · `/convencer <quién>` · `/sonsacar <quién>` | El caso abierto; el duelo de palabras; sonsacar lo que alguien esconde |
| `/bond <nombre> <evento>` · `/actitud <quién> <±n>` | Registrar algo con un compañero; mover la actitud de alguien del mundo |
| `/ofrecer-objeto` · `/aceptar-objeto` | Lo mismo que el narrador con `dar_objeto`, a mano |
| `/tirada` | Intentar algo fuera de combate: el motor tira con la ficha |
| `/punto` · `/estado` | Puntos de retorno; lo que el juego da por cierto |

**Crear y ajustar**

| Comando | Qué hace |
| :--- | :--- |
| `/campana` · `/rules` · `/narrador` · `/sonido` | El editor de la campaña, el de reglas, cuánto se extiende quien narra, qué suena en cada escena |
| `/exportar-campana` · `/esquema-campana` · `/comprobar-mundo` | Empaquetar la campaña; el contrato para el Gem; si el mundo llega al listón |
| `/modojuego` · `/sandbox` | El Modo Juego a pantalla completa; un tablero de pruebas que no guarda nada |
| `/prompt` · `/contradicciones` · `/semilla` · `/rollguard` | Qué se envía al modelo; lo que la narración dijo y el motor no confirma; fijar la semilla; la corrección de tiradas inventadas |
| `/campaign` · `/cstate <estado>` | El contexto dinámico (`dynamic-context-manager.js`): estado de la campaña, presupuesto e instrucciones |

## 3. Comandos Esenciales de SillyTavern

Además de los comandos RPG, el sistema base ofrece herramientas avanzadas de control de flujo:
- `/echo [texto]`: Imprime texto localmente en la interfaz.
- `/sys [texto]`: Inserta un mensaje del sistema en el chat.
- `/gen`: Dispara manualmente una generación de la IA.
- `/swipe [next|prev|index]`: Cambia de alternativa de respuesta generada.
- `/setvar [nombre] [valor]` / `/getvar [nombre]`: Almacena y recupera variables persistentes.
- `/if left=[val] right=[val] rule=[eq|ne|gt|lt] then={ ... } else={ ... }`: Ejecución condicional de bloques.
- `/while left=[val] right=[val] rule=[eq|ne] do={ ... }`: Bucles de ejecución para scripts complejos.

---

## 4. El Motor de Macros (`public/scripts/macros.js`)

Las macros permiten interpolar variables dinámicas en cualquier mensaje, prompt del sistema o entrada de Lorebook mediante la sintaxis `{{nombre_macro}}`:

| Macro | Valor que Retorna |
| :--- | :--- |
| `{{user}}` | Nombre del usuario activo o del líder del grupo RPG. |
| `{{char}}` | Nombre del personaje activo en el chat. |
| `{{persona}}` | Descripción de la personalidad del usuario o resumen del líder D&D. |
| `{{model}}` | Identificador del modelo de lenguaje en uso (ej. `gpt-4o`, `claude-3-5-sonnet`). |
| `{{date}}` / `{{time}}` | Fecha y hora actual del sistema o del mundo simulado. |
| `{{random::opción1,opción2,opción3}}` | Selecciona aleatoriamente una de las opciones especificadas. |
| `{{pick::clave::elemento}}` | Selector determinista de listas. |
| `{{getvar::mi_variable}}` | Obtiene el valor de una variable creada con `/setvar`. |
| `{{location}}` | Nombre de la localización activa de la campaña. |
| `{{hp}}` / `{{maxHp}}` | Vida actual y máxima del líder del grupo. |

> [!TIP]
> Las macros pueden anidarse: `{{getvar::{{random::clave1,clave2}}}}` resolverá primero la macro interna aleatoria y luego recuperará la variable correspondiente.

---

## 5. Enlaces Relacionados
- [[Ciclo-De-Vida-Prompt]]: Sustitución de macros durante la construcción del prompt.
- [[Sistema-Party]]: Modificación del estado del grupo mediante `/party`.
- [[Dynamic-Context-Manager]]: Transición de estados con `/dynctx`.
- [[Campanas-Mapas-Tableros]]: Movimiento de tokens con `/board move`.
