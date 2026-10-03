---
title: Anexo del Gem de campañas — el contrato entero y las muestras largas
tags: [gem, gemini, campanas, contrato, anexo]
created: 2026-10-02
updated: 2026-10-03
author: generado por tools/gem-instructions.mjs
---

# Anexo: el contrato del paquete de campaña

> **Generado desde el motor**, contrato versión 1. No lo edites a mano: ejecuta
> `node tools/gem-instructions.mjs`. Se sube **entero** al Gem como archivo de conocimiento; las
> instrucciones cortas de [[GEM_CREAR_CAMPANA]] le dicen cuándo mirarlo.

Para el Gem: esto es la referencia. Las reglas de cómo se escribe (conversaciones, presentaciones,
grupo de 4, facciones como reputación, plazos apagados, aspecto) están en tus instrucciones y
mandan sobre cualquier cosa de aquí.

# Contrato del paquete de campaña

Versión 1. Generado desde el motor el 2026-10-03.

Devuelve **solo JSON válido** que cumpla este esquema. Una sección por respuesta si el
libro es largo; el orden recomendado es: world → locations → confidants → npcs → bestiary → items → boards → quests → heroes → dialogues → plot.

## Esquema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Paquete de campaña",
  "description": "Una campaña completa lista para importar: el mundo, sus compañeros, su bestiario, sus tableros, sus misiones y su hilo.",
  "type": "object",
  "required": [
    "version",
    "world"
  ],
  "definitions": {
    "dialogueCondition": {
      "type": "object",
      "description": "Todo lo que se escriba tiene que cumplirse. Una lista de estos objetos: basta con uno. Lo de quién eres (species, class, background, gender), el hito y said, si no se cumplen, esconden la opción; attitude (min), item y gold la enseñan apagada, diciendo qué falta.",
      "properties": {
        "attitude": {
          "description": "Cómo os mira quien habla, de -3 a 3. Un número es «al menos»; o {\"min\": 1} / {\"max\": -1}.",
          "anyOf": [
            {
              "type": "integer"
            },
            {
              "type": "object",
              "properties": {
                "min": {
                  "type": "integer"
                },
                "max": {
                  "type": "integer"
                }
              }
            }
          ]
        },
        "milestone": {
          "description": "Un hito del hilo, por su id. Solo el id es «cumplido»; con is: open (abierto), done (cumplido) o not-done.",
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "object",
              "required": [
                "id"
              ],
              "properties": {
                "id": {
                  "type": "string"
                },
                "is": {
                  "type": "string",
                  "enum": [
                    "open",
                    "done",
                    "not-done"
                  ]
                }
              }
            }
          ]
        },
        "item": {
          "type": "string",
          "description": "Algo que lleva el grupo, por su nombre en items."
        },
        "gold": {
          "type": "integer",
          "description": "El oro que hace falta llevar."
        },
        "species": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ],
          "description": "La especie, como la llama el compendio: Enano, Elfo, Humano… Sale como «[Enano] …»."
        },
        "class": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ],
          "description": "La clase: Clérigo, Soldado, Pícaro… Sale como «[Clérigo] …»."
        },
        "background": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ],
          "description": "El trasfondo: soldado, criminal, erudito, acolito, forastero, artesano, noble, marinero, charlatan, ermitano."
        },
        "gender": {
          "type": "string",
          "enum": [
            "Mujer",
            "Hombre"
          ],
          "description": "Cómo le habla el texto a quien juega: Mujer, en femenino; Hombre, en masculino (también a quien es no binario y lo eligió así)."
        },
        "said": {
          "type": "string",
          "description": "El id de una opción de esta charla que ya se eligió."
        },
        "chose": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ],
          "description": "El id de una opción que se eligió en una escena del hilo: así alguien se acuerda de lo que hiciste."
        }
      }
    },
    "dialogueEffect": {
      "type": "object",
      "minProperties": 1,
      "description": "Una cosa por objeto. Los que hay: attitude, clue, rumor, milestone, give, take, bond, gold, time, end, board, go.",
      "properties": {
        "attitude": {
          "type": "integer",
          "description": "+1 o -1: cómo os mira. Sin who, quien habla."
        },
        "clue": {
          "type": "string",
          "description": "Algo que se aprende: queda en el Diario."
        },
        "rumor": {
          "type": "string",
          "description": "El id de un rumor de rumors: se da por oído."
        },
        "milestone": {
          "type": "string",
          "description": "El id de un hito: se cumple."
        },
        "give": {
          "type": "string",
          "description": "Un objeto que os da, por su nombre."
        },
        "take": {
          "type": "string",
          "description": "Un objeto que os quita, por su nombre."
        },
        "bond": {
          "type": "integer",
          "description": "Puntos de vínculo con un compañero. Sin who, quien habla."
        },
        "gold": {
          "type": "integer",
          "description": "Oro que os da (positivo) o que pagáis (negativo)."
        },
        "who": {
          "type": "string",
          "description": "Con attitude o bond: con quién, si no es quien habla."
        },
        "time": {
          "type": "boolean",
          "description": "Se va un rato del día."
        },
        "end": {
          "type": "boolean",
          "description": "Se acaba la charla."
        },
        "board": {
          "type": "string",
          "description": "Al acabar la charla se va a ese tablero, y la pelea empieza sola: «Bajo a la bodega». Por su nombre en boards."
        },
        "go": {
          "type": "string",
          "description": "Al acabar la charla se viaja a ese sitio, por su nombre en locations."
        }
      }
    },
    "dialogueBranch": {
      "type": "object",
      "properties": {
        "next": {
          "type": "string",
          "description": "El nudo al que lleva."
        },
        "effects": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/dialogueEffect"
          }
        },
        "journal": {
          "type": "string",
          "description": "Lo que queda en el Diario."
        },
        "end": {
          "type": "boolean"
        }
      }
    },
    "laterCard": {
      "type": "object",
      "description": "Lo que vuelve días después por haber elegido esto: una tarjeta con una situación y dos o tres opciones, como un suceso. Sale en el siguiente sitio al que se llegue, donde se descanse o en la semana. En vez de escribirla, suceso nombra uno de sucesos.json.",
      "properties": {
        "days": {
          "type": "integer",
          "minimum": 1,
          "maximum": 30,
          "description": "Cuántos días después."
        },
        "on": {
          "type": "string",
          "enum": [
            "siempre",
            "bien",
            "mal"
          ],
          "description": "Si la opción lleva tirada: con qué resultado vuelve. Sin él, siempre."
        },
        "name": {
          "type": "string",
          "description": "El título de la tarjeta: «Los graneros vacíos»."
        },
        "text": {
          "type": "string",
          "description": "Lo que pasa, en una o dos frases llanas: se lee en la tarjeta. Sin huecos como {sitio}: puede salir en cualquier sitio."
        },
        "who": {
          "type": "string",
          "description": "Quién vuelve: alguien de npcs o de confidants. Sale en la tarjeta con su cara, y lo que pasa al elegir (then) lo dice él (D-J60)."
        },
        "suceso": {
          "type": "string"
        },
        "options": {
          "type": "array",
          "minItems": 2,
          "items": {
            "type": "object",
            "required": [
              "label"
            ],
            "properties": {
              "label": {
                "type": "string",
                "description": "Lo que se hace."
              },
              "cost": {
                "type": "object",
                "properties": {
                  "oro": {
                    "type": "integer"
                  },
                  "horas": {
                    "type": "integer"
                  },
                  "dias": {
                    "type": "integer"
                  }
                },
                "description": "Lo que se paga antes."
              },
              "effects": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Los de los sucesos: oro:+N, oro:-N, oro:+1d6, hora, dia, herida:1d4, cura:1d6, comida, fama:+1, fama:-1, faccion:+1, faccion:-1, vinculo:+1, rumor, pista."
              },
              "then": {
                "type": "string",
                "description": "Lo que pasa, dicho por quien vuelve (who) con sus palabras: «Toma, y no digas de dónde sale», no «Os da una bolsa»."
              },
              "who": {
                "type": "string",
                "description": "Opcional: si lo de esta opción lo dice otro que está allí."
              },
              "check": {
                "type": "object",
                "properties": {
                  "skill": {
                    "type": "string",
                    "enum": [
                      "persuasion",
                      "deception",
                      "intimidation",
                      "insight",
                      "perception",
                      "investigation",
                      "stealth",
                      "athletics",
                      "sleight",
                      "survival"
                    ]
                  },
                  "dc": {
                    "type": "integer"
                  }
                }
              },
              "success": {
                "type": "object",
                "properties": {
                  "effects": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Los de los sucesos: oro:+N, oro:-N, oro:+1d6, hora, dia, herida:1d4, cura:1d6, comida, fama:+1, fama:-1, faccion:+1, faccion:-1, vinculo:+1, rumor, pista."
                  },
                  "then": {
                    "type": "string"
                  }
                }
              },
              "fail": {
                "type": "object",
                "properties": {
                  "effects": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Los de los sucesos: oro:+N, oro:-N, oro:+1d6, hora, dia, herida:1d4, cura:1d6, comida, fama:+1, fama:-1, faccion:+1, faccion:-1, vinculo:+1, rumor, pista."
                  },
                  "then": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    },
    "sceneLine": {
      "type": "object",
      "required": [
        "text"
      ],
      "properties": {
        "who": {
          "type": "string",
          "description": "Quién lo dice: alguien de npcs o de confidants, con su nombre exacto (sale su retrato y su placa). Todas las líneas llevan who: la historia se cuenta hablando, y en el juego sin conexión no hay narrador (D-J54, D-J60). Una línea sin who no la dice nadie: sale en un aviso pequeño fuera de la caja. No la escribas: el sitio y la hora ya se ven en pantalla."
        },
        "mood": {
          "type": "string",
          "enum": [
            "neutral",
            "alegre",
            "enfadado",
            "triste"
          ],
          "description": "La cara del retrato: neutral (la de siempre), alegre, enfadado o triste."
        },
        "text": {
          "type": "string",
          "description": "De una a tres frases llanas, sin acertijos. Con {forma|forma} donde se habla a quien juega."
        },
        "presenta": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "boolean"
            }
          ],
          "description": "Opcional: quién se da a conocer en esta línea, por su id o su nombre (true: quien la dice). Hace falta solo si el nombre no sale en la línea: «Es la capitana de la guardia», y desde ahí sale con su nombre."
        }
      }
    },
    "sceneBranch": {
      "type": "object",
      "properties": {
        "effects": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/dialogueEffect"
          }
        },
        "journal": {
          "type": "string",
          "description": "Lo que queda en el Diario."
        },
        "reply": {
          "anyOf": [
            {
              "$ref": "#/definitions/sceneLine"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/definitions/sceneLine"
              }
            }
          ],
          "description": "Lo que se oye si sale así."
        }
      }
    }
  },
  "properties": {
    "version": {
      "type": "integer",
      "const": 1,
      "description": "Versión del contrato con la que se escribió este paquete."
    },
    "world": {
      "type": "object",
      "required": [
        "name",
        "synopsis"
      ],
      "properties": {
        "name": {
          "type": "string",
          "description": "Nombre de la campaña o del libro."
        },
        "genre": {
          "type": "string"
        },
        "synopsis": {
          "type": "string",
          "description": "Un párrafo sobre el mundo."
        },
        "season": {
          "type": "string",
          "description": "La estación en la que empieza: primavera, verano, otono o invierno. Cada una dura 56 días. Sin nada, otoño."
        },
        "levels": {
          "type": "array",
          "items": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20
          },
          "minItems": 2,
          "maxItems": 2,
          "description": "Para qué nivel es, desde y hasta: [1, 4], pensado para un grupo de 4 (D-J56). Sale en el tablón del gremio, y el juego ajusta las peleas dentro de un margen si vais más o menos. Sin nada, se calcula del desafío de los bichos."
        },
        "journey": {
          "type": "object",
          "description": "A cuántos días queda del gremio de Puerto Alba y cómo se llega. Sale en el tablón y se cuenta al salir. Sin nada, 5 días.",
          "properties": {
            "days": {
              "type": "integer",
              "minimum": 1,
              "maximum": 60
            },
            "how": {
              "type": "string",
              "description": "Una frase: «Subís por el camino del norte hasta un valle de montaña»."
            }
          }
        },
        "factions": {
          "type": "array",
          "description": "Los grupos que pesan en la historia. Solo cuenta cómo os miran (su reputación) y lo que la historia escrita hace con ella: un camino que se abre, un peaje, un final (D-J58). Nada se mueve solo: sin relojes, sin sitios que cambien de manos.",
          "items": {
            "type": "object",
            "required": [
              "name"
            ],
            "properties": {
              "id": {
                "type": "string",
                "description": "Corto, en minúsculas y con guiones («los-vistani»): así la nombran el hilo y los encargos."
              },
              "name": {
                "type": "string"
              },
              "goals": {
                "type": "string"
              },
              "reputation": {
                "type": "integer",
                "description": "Cómo os miran al empezar, de -5 a 5. Sin nada, 0."
              },
              "magia": {
                "type": "string",
                "enum": [
                  "persigue",
                  "tolera",
                  "comercia"
                ],
                "description": "Cómo ve la magia. Donde manda una que la persigue no se venden componentes; donde comercia con ella, salen más baratos. Sin nada, tolera."
              }
            }
          }
        },
        "loreEntries": {
          "type": "array",
          "description": "Entradas del Lorebook: lugares, personajes, objetos, secretos.",
          "items": {
            "type": "object",
            "required": [
              "key",
              "content"
            ],
            "properties": {
              "key": {
                "type": "string",
                "description": "La palabra que la activa en el chat."
              },
              "content": {
                "type": "string"
              },
              "type": {
                "type": "string",
                "enum": [
                  "location",
                  "npc",
                  "item",
                  "faction",
                  "event",
                  "other"
                ]
              }
            }
          }
        }
      }
    },
    "locations": {
      "type": "array",
      "description": "Los sitios del mundo. Una localización puede tener 0 tableros (una aldea donde solo se habla y se comercia), 1 o varios. Opcional: las que no se declaren se deducen de los tableros que las nombren. La primera es donde empieza la campaña.",
      "items": {
        "type": "object",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "Único en el paquete. Es el nombre al que apuntan los tableros."
          },
          "type": {
            "type": "string",
            "enum": [
              "city",
              "village",
              "outpost",
              "ruins",
              "dungeon",
              "camp",
              "sanctuary",
              "wilderness"
            ]
          },
          "description": {
            "type": "string"
          },
          "region": {
            "type": "string",
            "description": "La comarca o zona a la que pertenece."
          },
          "factionName": {
            "type": "string",
            "description": "De qué facción es, si de alguna: sabor para la historia. No cambia precios ni quién manda (D-J58)."
          },
          "hidden": {
            "type": "boolean",
            "description": "Si empieza escondida: no se puede ir hasta que la revela un hito del hilo (`changes.reveal`) o un rumor que lleva a ella (`leadsTo`)."
          },
          "routes": {
            "type": "array",
            "description": "Los caminos que salen de aquí, en un sentido (el juego pone el de vuelta). Sin ninguno, se va de un sitio a otro directo.",
            "items": {
              "type": "object",
              "required": [
                "to"
              ],
              "properties": {
                "to": {
                  "type": "string",
                  "description": "Adónde: el nombre de otra localización."
                },
                "days": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "Días de camino. Sin ellos, 1."
                },
                "seasons": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Si solo se pasa en unas estaciones: [\"invierno\"]."
                },
                "sea": {
                  "type": "boolean",
                  "description": "Por mar."
                },
                "closedUntil": {
                  "type": "string",
                  "description": "Cerrado hasta que se cumple ese hito, por su id."
                },
                "opensWith": {
                  "type": "array",
                  "description": "Lo que lo abre, si está cerrado: {\"standing\": \"id-de-faccion\", \"min\": 1} (cómo os mira una facción, D-J58), {\"fame\": 3} (vuestra fama), {\"key\": \"Nombre de un objeto\"} o {\"guide\": \"Nombre de alguien\"} que os lleve. Basta con uno.",
                  "items": {
                    "type": "object"
                  }
                },
                "gateNote": {
                  "type": "string",
                  "description": "Lo que se ve mientras está cerrado: «Los de la Cofradía no dejan pasar a forasteros»."
                }
              }
            }
          },
          "places": {
            "type": "array",
            "description": "Opcional, para pueblos y ciudades: los sitios de dentro (la herrería, la posada, el templo…), en el orden en que se enseñan. Sin la lista salen de sus servicios, cada uno con quien tenga ese servicio. Lo que se puede hacer en cada sitio lo pone el juego.",
            "items": {
              "type": "object",
              "required": [
                "kind"
              ],
              "properties": {
                "kind": {
                  "type": "string",
                  "enum": [
                    "gremio",
                    "posada",
                    "herreria",
                    "tienda",
                    "templo",
                    "tablon",
                    "plaza",
                    "muelle"
                  ],
                  "description": "Qué clase de sitio es."
                },
                "name": {
                  "type": "string",
                  "description": "Su nombre aquí: «El Agua Azul». Sin él, el de su clase: «La posada»."
                },
                "keeper": {
                  "type": "string",
                  "description": "Quién lo atiende: el nombre de alguien de la gente del paquete. Sin él, el primero de aquí con ese servicio."
                },
                "description": {
                  "type": "string",
                  "description": "Una línea, si hace falta."
                }
              }
            }
          },
          "sights": {
            "type": "array",
            "description": "Lo que se puede examinar aquí (J10.2): dos o tres cosas concretas de este sitio, cada una con su tirada. Salen como «Examinar…» antes que las genéricas. Una tirada buena aquí también encuentra la pista de un hito que se busca aquí (`asks.clues`): así se esconde un secreto.",
            "items": {
              "type": "object",
              "required": [
                "text"
              ],
              "properties": {
                "verbo": {
                  "type": "string",
                  "description": "Qué se hace, en infinitivo: «examinar», «mirar», «buscar», «leer». Sin él, «examinar»."
                },
                "text": {
                  "type": "string",
                  "description": "Sobre qué, corto y concreto: «el hueco del roble», «las huellas de la nieve»."
                },
                "skill": {
                  "type": "string",
                  "enum": [
                    "persuasion",
                    "deception",
                    "intimidation",
                    "insight",
                    "perception",
                    "investigation",
                    "stealth",
                    "athletics",
                    "sleight",
                    "survival"
                  ],
                  "description": "Con qué se tira. Sin ella, investigation."
                },
                "found": {
                  "type": "string",
                  "description": "Lo que se ve si la tirada sale bien: una o dos frases llanas. Lo dice uno de los tuyos (o, a solas, quien esté allí), así que escríbelo como lo diría: «La cerradura no está forzada: la abrieron con llave», no «Ves que la cerradura…» (D-J60)."
                },
                "who": {
                  "type": "string",
                  "description": "Opcional: quién lo dice, si es alguien concreto de npcs que está aquí. Sin él, uno de los tuyos."
                },
                "place": {
                  "type": "string",
                  "enum": [
                    "gremio",
                    "posada",
                    "herreria",
                    "tienda",
                    "templo",
                    "tablon",
                    "plaza",
                    "muelle"
                  ],
                  "description": "Si está dentro de un sitio del pueblo (`places`): «gremio», «posada», «templo»… Sale al entrar en ese sitio, en «Mirar», y no en la fila. Sin él, vale para toda la localización."
                }
              }
            }
          },
          "treasure": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "El tesoro del sitio: objetos que se encuentran aquí, por su nombre en items (si no está, el juego lo crea). Van en un cofre de un tablero del sitio; si el sitio no tiene tablero, el juego dibuja uno pequeño, sin pelea, para ir a buscarlo."
          }
        }
      }
    },
    "boards": {
      "type": "array",
      "description": "Tableros tácticos. El mapa se recorre por casillas, no es una ilustración.",
      "items": {
        "type": "object",
        "required": [
          "id",
          "name"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Identificador propio del paquete, al que apuntan las misiones."
          },
          "name": {
            "type": "string"
          },
          "locationName": {
            "type": "string",
            "description": "La localización a la que pertenece."
          },
          "map": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Filas de la misma longitud, entre 8 y 40 columnas y entre 6 y 30 filas. Borde exterior siempre de muro. Solo estos caracteres: '1' runa 1 (las runas 1 a 5 se pisan en orden, de la 1 a la última que pongas; pisar una que no toca las apaga todas; con todas encendidas, se abren las puertas con llave), '2' runa 2, '3' runa 3, '4' runa 4, '5' runa 5, '.' suelo transitable, '#' muro, 'D' puerta cerrada, 'L' puerta cerrada con llave (se abre con una llave, con ganzúas o a golpes; el jefe del tablero suelta la llave), 'o' puerta abierta, '~' terreno difícil, 'c' cobertura media, 'C' cobertura de tres cuartos, 'v' precipicio (no se anda; a quien empujan dentro, cae), '>' escalera al nivel siguiente, 'w' agua poco honda (cuesta el doble; el frío la hiela), 'W' agua honda (no se cruza andando; se ve a través): el mar, un río profundo, 'i' hielo (cuesta el doble y resbala: Acrobacias CD 10 o al suelo; el trueno lo quiebra, el fuego lo funde), 'b' maleza (cuesta el doble, y arde), 'm' barro (cuesta el doble), 'T' barril (cubre; con fuego, revienta), 'k' cofre (se abre estando al lado), '^' en alto (subir cuesta el doble; desde arriba se ataca con ventaja): torres, escalones, la empalizada, 'x' salida (quien la pisa puede irse de la pelea; con un objetivo «alcanzar» encima, salir es ganar): la ventana, la trampilla, 'P' palanca (no se pisa; estando al lado, abre todas las puertas con llave del tablero): la reja del fondo, '=' barricada (corta el paso, no la vista; cubre a quien está detrás y a golpes se rompe: 15 de vida), 'H' columna, puntal o estantería que se puede tirar (corta el paso y cubre; estando al lado, se empuja y cae sobre las dos casillas de detrás: 1d10 contundente y derribado, salvación de Destreza CD 12 para la mitad), 'S' estatua con las manos vacías (no se pisa; se le pone una gema; con todas puestas, se abren las puertas con llave del tablero), 'g' gema en un pedestal (no se pisa; se coge estando al lado; pon tantas como estatuas), 'p' palanca doble (no se pisa; pon dos lejos una de otra: se bajan a la vez, en la misma ronda o con alguien en cada una, y abren las puertas con llave). Sin map, el juego lo lee del dibujo si hay image, o dibuja uno con la semilla."
          },
          "partyStart": {
            "type": "array",
            "description": "Casillas donde empieza el grupo. Tienen que ser suelo transitable.",
            "items": {
              "type": "object",
              "required": [
                "x",
                "y"
              ],
              "properties": {
                "x": {
                  "type": "integer"
                },
                "y": {
                  "type": "integer"
                }
              }
            }
          },
          "enemies": {
            "type": "array",
            "description": "Enemigos colocados aquí. El nombre tiene que estar en el bestiario.",
            "items": {
              "type": "object",
              "required": [
                "name"
              ],
              "properties": {
                "name": {
                  "type": "string"
                },
                "x": {
                  "type": "integer"
                },
                "y": {
                  "type": "integer"
                },
                "asleep": {
                  "type": "boolean",
                  "description": "Si duerme: no empieza la pelea al veros. Quien pasa a 10 pies tira Sigilo contra su Percepción pasiva (10 + su perception del bestiario, −5 dormido); si falla, despiertan todos."
                }
              }
            }
          },
          "waves": {
            "type": "array",
            "description": "Refuerzos que llegan en su ronda junto a una casilla (una puerta, el borde del bosque). La ronda antes se oye su aviso (tell), dicho llano.",
            "items": {
              "type": "object",
              "required": [
                "round",
                "names"
              ],
              "properties": {
                "round": {
                  "type": "integer",
                  "description": "La ronda en la que entran."
                },
                "names": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Quiénes, por su nombre del bestiario, uno por bicho."
                },
                "x": {
                  "type": "integer"
                },
                "y": {
                  "type": "integer"
                },
                "tell": {
                  "type": "string",
                  "description": "Lo que se oye la ronda antes: «Golpes en la puerta del este: vienen más»."
                }
              }
            }
          },
          "light": {
            "type": "string",
            "enum": [
              "luz",
              "penumbra",
              "oscuro"
            ],
            "description": "Opcional (E2.1): la luz de la sala. Sin decirlo, una cueva, una cripta, un sótano o una mina están a oscuras y lo demás con luz. En penumbra cuesta ver trampas; a oscuras no se ve sin antorcha, farol o la Luz, y quien ve en la oscuridad (un muerto, un trasgo) pega con ventaja."
          },
          "ward": {
            "type": "object",
            "description": "Alguien indefenso que está en el tablero y pelea de vuestro lado sin pelear: se cubre. Para un objetivo protect (ally: su nombre). Si cae, se pierde.",
            "required": [
              "name",
              "x",
              "y"
            ],
            "properties": {
              "name": {
                "type": "string"
              },
              "x": {
                "type": "integer"
              },
              "y": {
                "type": "integer"
              },
              "hp": {
                "type": "integer",
                "description": "Su vida. Sin ella, la de alguien que no pelea."
              },
              "gender": {
                "type": "string",
                "enum": [
                  "Hombre",
                  "Mujer"
                ]
              }
            }
          },
          "image": {
            "type": "string",
            "description": "Solo si el tablero se juega encima de un mapa dibujado: la ruta de la imagen desde public/, por ejemplo \"mundos/strahd/mapas/sotano.png\". Sin mapa, no lo escribas. Con imagen, el borde del mapa puede tener suelo."
          },
          "grid": {
            "type": "object",
            "description": "Dónde cae cada casilla sobre el dibujo: el lado de la casilla en píxeles (cell) y dónde empieza la primera (offsetX, offsetY). cols y rows tienen que ser el ancho y el alto de map.",
            "required": [
              "cell"
            ],
            "properties": {
              "cell": {
                "type": "number"
              },
              "offsetX": {
                "type": "number"
              },
              "offsetY": {
                "type": "number"
              },
              "cols": {
                "type": "integer"
              },
              "rows": {
                "type": "integer"
              }
            }
          },
          "zones": {
            "type": "array",
            "description": "Las salas con nombre del tablero (B1, «La capilla»): su nombre, sus casillas y lo que hay en ellas. Las casillas, con rect (una sala cuadrada) o con cells (\"x,y\").",
            "items": {
              "type": "object",
              "required": [
                "name"
              ],
              "properties": {
                "name": {
                  "type": "string",
                  "description": "Único en el tablero."
                },
                "rect": {
                  "type": "object",
                  "properties": {
                    "x": {
                      "type": "integer"
                    },
                    "y": {
                      "type": "integer"
                    },
                    "width": {
                      "type": "integer"
                    },
                    "height": {
                      "type": "integer"
                    }
                  }
                },
                "cells": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Casillas \"x,y\"."
                },
                "note": {
                  "type": "string",
                  "description": "Quién espera, qué se encuentra, el texto de la sala."
                },
                "enemies": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "El encuentro de la sala: quién espera en ella, uno por bicho y por su nombre del bestiario ([\"Lobo\", \"Lobo\"]). El juego los pone en casillas de la sala; tras una puerta cerrada, duermen hasta que se abre. No hace falta repetirlos en enemies."
                },
                "treasure": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "El tesoro de la sala: objetos por su nombre en items (si no está, el juego lo crea). El juego pone un cofre en la sala con ellos dentro."
                }
              }
            }
          },
          "elevation": {
            "type": "object",
            "description": "Las cotas en pies de las casillas que no están a ras de suelo, como {\"4,2\": 30}. Entre dos casillas vecinas con 10 pies o más de diferencia hay un acantilado: no se cruza andando, y desde arriba se ataca con ventaja. Los puentes y las rampas llevan su cota.",
            "additionalProperties": {
              "type": "number"
            }
          },
          "avoid": {
            "type": "array",
            "description": "Si el tablero tiene enemigos: las formas de no pelear, antes de que empiece. Una a tres, que encajen con quién espera y por qué. Tira quien mejor lo hace (esconderse, todo el grupo). Sin nada, el juego pone las de siempre.",
            "items": {
              "type": "object",
              "required": [
                "kind",
                "text"
              ],
              "properties": {
                "kind": {
                  "type": "string",
                  "enum": [
                    "hablar",
                    "pagar",
                    "huir",
                    "esconderse"
                  ]
                },
                "text": {
                  "type": "string",
                  "description": "Lo que se hace, visto desde quien juega: «Enseñarle el sello del prior»."
                },
                "skill": {
                  "type": "string",
                  "enum": [
                    "persuasion",
                    "deception",
                    "intimidation",
                    "insight",
                    "perception",
                    "investigation",
                    "stealth",
                    "athletics",
                    "sleight",
                    "survival"
                  ],
                  "description": "Con qué se tira. Sin ella: hablar, persuasion; huir, athletics; esconderse, stealth; pagar, sin tirada."
                },
                "dc": {
                  "type": "integer",
                  "description": "De 5 a 30. Sin ella, según quién espera."
                },
                "gold": {
                  "type": "integer",
                  "description": "Solo pagar: lo que cuesta."
                },
                "resolves": {
                  "type": "boolean",
                  "description": "Si salir bien cuenta como pasar el tablero para la historia. Sin decirlo: sí, salvo huir."
                },
                "success": {
                  "description": "Lo que pasa si sale bien. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                  "oneOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "who": {
                          "type": "string",
                          "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                        },
                        "text": {
                          "type": "string"
                        },
                        "effects": {
                          "type": "array",
                          "items": {}
                        }
                      }
                    }
                  ]
                },
                "partial": {
                  "description": "Opcional: si sale a medias (se falla por poco). Sin ella, sale pagando un precio. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                  "oneOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "who": {
                          "type": "string",
                          "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                        },
                        "text": {
                          "type": "string"
                        },
                        "effects": {
                          "type": "array",
                          "items": {}
                        }
                      }
                    }
                  ]
                },
                "failure": {
                  "description": "Lo que pasa si sale mal: empieza la pelea (huyendo o escondiéndose, ellos atacan primero). Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                  "oneOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "object",
                      "properties": {
                        "who": {
                          "type": "string",
                          "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                        },
                        "text": {
                          "type": "string"
                        },
                        "effects": {
                          "type": "array",
                          "items": {}
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          "parley": {
            "type": "object",
            "description": "Opcional: cómo se sale de esta pelea hablando, a mitad de ella (entregarse, sobornar, convencer, engañar). Sin nada, sale lo de siempre; lo escrito cambia el texto y lo que pasa.",
            "properties": {
              "leader": {
                "type": "string",
                "description": "Quién manda: el nombre de un enemigo del tablero."
              },
              "entregarse": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "Lo que se dice o se hace."
                  },
                  "dc": {
                    "type": "integer",
                    "description": "La CD con la pelea igualada; cómo va la pelea la sube o la baja."
                  },
                  "gold": {
                    "type": "integer",
                    "description": "Solo sobornar: lo que piden."
                  },
                  "resolves": {
                    "type": "boolean",
                    "description": "Si salir así cuenta como pasar el tablero para la historia."
                  },
                  "success": {
                    "description": "Si sale (entregarse siempre «sale»). Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "partial": {
                    "description": "Opcional: a medias. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "failure": {
                    "description": "Si no sale. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  }
                }
              },
              "sobornar": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "Lo que se dice o se hace."
                  },
                  "dc": {
                    "type": "integer",
                    "description": "La CD con la pelea igualada; cómo va la pelea la sube o la baja."
                  },
                  "gold": {
                    "type": "integer",
                    "description": "Solo sobornar: lo que piden."
                  },
                  "resolves": {
                    "type": "boolean",
                    "description": "Si salir así cuenta como pasar el tablero para la historia."
                  },
                  "success": {
                    "description": "Si sale (entregarse siempre «sale»). Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "partial": {
                    "description": "Opcional: a medias. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "failure": {
                    "description": "Si no sale. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  }
                }
              },
              "convencer": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "Lo que se dice o se hace."
                  },
                  "dc": {
                    "type": "integer",
                    "description": "La CD con la pelea igualada; cómo va la pelea la sube o la baja."
                  },
                  "gold": {
                    "type": "integer",
                    "description": "Solo sobornar: lo que piden."
                  },
                  "resolves": {
                    "type": "boolean",
                    "description": "Si salir así cuenta como pasar el tablero para la historia."
                  },
                  "success": {
                    "description": "Si sale (entregarse siempre «sale»). Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "partial": {
                    "description": "Opcional: a medias. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "failure": {
                    "description": "Si no sale. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  }
                }
              },
              "engañar": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "Lo que se dice o se hace."
                  },
                  "dc": {
                    "type": "integer",
                    "description": "La CD con la pelea igualada; cómo va la pelea la sube o la baja."
                  },
                  "gold": {
                    "type": "integer",
                    "description": "Solo sobornar: lo que piden."
                  },
                  "resolves": {
                    "type": "boolean",
                    "description": "Si salir así cuenta como pasar el tablero para la historia."
                  },
                  "success": {
                    "description": "Si sale (entregarse siempre «sale»). Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "partial": {
                    "description": "Opcional: a medias. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  },
                  "failure": {
                    "description": "Si no sale. Mejor { \"who\", \"text\", \"effects\" }: text es lo que dice who (quien manda, la persona con la que hablas o uno de los tuyos), con sus palabras (D-J60). Sin who, sale en un aviso fuera de la caja. Efectos: {\"gold\": -5}, {\"attitude\": -1, \"who\": \"Nombre\"}, {\"rumor\": \"id\"}, {\"clue\": \"texto\"}, {\"give\": \"objeto\"}, {\"take\": \"objeto\"}, \"time\", {\"milestone\": \"id\"}, {\"standing\": \"Facción\", \"amount\": -1}, {\"fame\": -1}, {\"hurt\": \"1d4\"}, {\"days\": 1}, {\"grudge\": \"Nombre\"} (alguien que os la guardará).",
                    "oneOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "who": {
                            "type": "string",
                            "description": "Un enemigo del tablero (su nombre del bestiario), o alguien de npcs o confidants."
                          },
                          "text": {
                            "type": "string"
                          },
                          "effects": {
                            "type": "array",
                            "items": {}
                          }
                        }
                      }
                    ]
                  }
                }
              },
              "no": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Las formas que aquí no valen."
              }
            }
          },
          "traps": {
            "type": "array",
            "description": "Las trampas del tablero: una losa que se hunde, dardos en la pared, un cepo. Se buscan, se desarman o se pisan. Cada una en una casilla de suelo, fuera de donde empieza el grupo; sin x e y (o en un tablero sin map), el juego la pone en el camino.",
            "items": {
              "type": "object",
              "required": [
                "name",
                "tell"
              ],
              "properties": {
                "name": {
                  "type": "string",
                  "description": "Lo que es, en pocas palabras: «Losa hundida»."
                },
                "x": {
                  "type": "integer"
                },
                "y": {
                  "type": "integer"
                },
                "tell": {
                  "type": "string",
                  "description": "Lo que se ve sin buscar: «Una losa está más baja que las demás». Lo dice quien la ve, uno de los tuyos (D-J60): escríbelo como lo diría. Sin aviso, pisarla no es culpa de nadie."
                },
                "damage": {
                  "type": "string",
                  "description": "El daño al pisarla, en dados: \"1d10\" o \"2d6\". Va esto o condition, o las dos."
                },
                "condition": {
                  "type": "string",
                  "enum": [
                    "prone",
                    "restrained",
                    "poisoned",
                    "blinded",
                    "deafened",
                    "frightened",
                    "grappled",
                    "stunned",
                    "paralyzed",
                    "incapacitated",
                    "bleeding",
                    "ralentizado"
                  ],
                  "description": "Cómo deja a quien la pisa: prone (derribado), restrained (apresado), poisoned (envenenado), blinded (cegado), frightened (asustado), grappled (agarrado), stunned (aturdido), bleeding (sangrando)."
                },
                "spotDC": {
                  "type": "integer",
                  "description": "Lo difícil de ver (Percepción), de 5 a 30. Sin ella, 13."
                },
                "disarmDC": {
                  "type": "integer",
                  "description": "Lo difícil de desarmar, de 5 a 30. Sin ella, 13."
                },
                "once": {
                  "type": "boolean",
                  "description": "Si salta una vez y se acaba (unos dardos). Sin decirlo, vuelve a armarse (una losa)."
                }
              }
            }
          }
        }
      }
    },
    "bestiary": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "name",
          "hp",
          "armorClass",
          "cr",
          "profile"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "Único en todo el paquete: el Lorebook indexa por nombre."
          },
          "hp": {
            "type": "integer"
          },
          "armorClass": {
            "type": "integer"
          },
          "cr": {
            "type": "number",
            "description": "Desafío. Decide la experiencia y el botín."
          },
          "profile": {
            "type": "string",
            "enum": [
              "aggressive",
              "skirmisher",
              "guardian",
              "coward",
              "object"
            ],
            "description": "Comportamiento táctico. Solo estos. object: lo que se rompe y no actúa (un cristal, un ídolo)."
          },
          "attackRangeFeet": {
            "type": "integer",
            "description": "5 en cuerpo a cuerpo, 30 a 120 a distancia."
          },
          "perception": {
            "type": "integer",
            "description": "Opcional: lo que suma a Percepción (el +3 de su ficha de 5e). Cuenta si duerme en un tablero (asleep)."
          },
          "seasons": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Si migra: las estaciones en que anda (primavera, verano, otono, invierno). Fuera de ellas no sale. Sin nada, todo el año."
          },
          "domable": {
            "type": "string",
            "enum": [
              "perro",
              "gato",
              "zorro",
              "halcon",
              "cuervo",
              "loro",
              "familiar",
              "espiritu",
              ""
            ],
            "description": "Si una cría suya se puede domar al vencerlo, y en qué mascota se queda. Vacío: no se doma. Sin el campo, lo decide su nombre (lobos, cuervos, zorros, halcones, gatos)."
          },
          "abilities": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Ids del catálogo de habilidades (rules.abilities) que sabe usar. El motor decide cuándo: cura a los suyos, gasta lo que tiene usos contados en cuanto llega, y usa lo de siempre si pega más que su golpe."
          },
          "description": {
            "type": "string"
          },
          "aspecto": {
            "type": "string",
            "description": "Solo si habla: en una escena, en una charla o como quien manda en un tablero al que se le habla (parley.leader, avoid). Cómo es por fuera, para dibujar su retrato y sus tres caras (alegre, enfadado, triste): edad, complexión, ropa y un rasgo que se vea a la primera, en una o dos frases. «Mujer de unos cincuenta, ancha de hombros, delantal de cuero y una quemadura en el antebrazo»."
          }
        }
      }
    },
    "quests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "name",
          "objectives"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "act": {
            "type": "integer",
            "description": "Capítulo o acto al que pertenece."
          },
          "description": {
            "type": "string"
          },
          "boardId": {
            "type": "string",
            "description": "Dónde se juega. Tiene que existir en boards."
          },
          "locationName": {
            "type": "string",
            "description": "Forma corta, sin boardId: la localización donde se juega. El juego dibuja allí su tablero."
          },
          "enemies": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Forma corta: a quién hay que vencer, uno por bicho, por su nombre (del bestiario del paquete o del juego)."
          },
          "levels": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 1,
              "maximum": 20
            },
            "minItems": 2,
            "maxItems": 2,
            "description": "Si esta misión pide más nivel que el resto: [6, 7] (D-J56)."
          },
          "objectives": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "eliminate",
                    "eliminate_all",
                    "survive_rounds",
                    "reach_cell",
                    "escort",
                    "protect",
                    "loot",
                    "escape",
                    "hold",
                    "unseen"
                  ],
                  "description": "eliminate: Derrota a los objetivos indicados. | eliminate_all: Derrota a todos los enemigos. | survive_rounds: Aguanta un número de rondas. | reach_cell: Lleva a alguien del grupo a una casilla. | escort: Lleva a un aliado concreto a una casilla, vivo. | protect: Que un aliado siga en pie al terminar. Es una condición: si cae, se pierde; si no, se gana con lo demás. | loot: Recoge los tesoros marcados. | escape: Que salgan por las salidas del tablero todos los que siguen en pie. | hold: Que ningún enemigo pise las casillas marcadas durante unas rondas. | unseen: Que los que duermen en el tablero sigan dormidos. Es una condición, como proteger."
                },
                "label": {
                  "type": "string",
                  "description": "Cómo se le enseña al jugador."
                },
                "optional": {
                  "type": "boolean",
                  "description": "Un objetivo opcional paga pero no bloquea: no impide la victoria ni causa la derrota."
                },
                "target": {
                  "type": "string",
                  "description": "Nombre del enemigo que hay que derrotar, tal y como aparece en el bestiario."
                },
                "rounds": {
                  "type": "integer",
                  "description": "Cuántas rondas hay que aguantar."
                },
                "cell": {
                  "type": "object",
                  "properties": {
                    "x": {
                      "type": "integer"
                    },
                    "y": {
                      "type": "integer"
                    }
                  },
                  "required": [
                    "x",
                    "y"
                  ],
                  "description": "Casilla a la que debe llegar alguien del grupo, contando desde 0."
                },
                "ally": {
                  "type": "string",
                  "description": "Nombre del aliado a escoltar."
                },
                "treasures": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Nombres de los tesoros que hay que recoger."
                },
                "cells": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "x": {
                        "type": "integer"
                      },
                      "y": {
                        "type": "integer"
                      }
                    },
                    "required": [
                      "x",
                      "y"
                    ]
                  },
                  "description": "Las casillas que ningún enemigo debe pisar (la puerta, lo que hay detrás), contando desde 0."
                },
                "beforeRound": {
                  "type": "integer",
                  "description": "Opcional, en cualquier objetivo menos sobrevivir, defender, proteger y sin despertar: la ronda en la que se pierde si aún no está hecho (5 = hay que hacerlo en las rondas 1 a 4)."
                }
              },
              "description": "Un objetivo. Cada tipo pide sus campos: eliminate → target · eliminate_all → nada · survive_rounds → rounds · reach_cell → cell · escort → ally, cell · protect → ally · loot → treasures · escape → nada · hold → cells, rounds · unseen → nada"
            }
          }
        }
      }
    },
    "confidants": {
      "type": "array",
      "description": "Compañeros con los que el grupo puede estrechar vínculos.",
      "items": {
        "type": "object",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "id": {
            "type": "string",
            "description": "Corto, en minúsculas y sin espacios («mira»): es el de {npc:mira} en los textos y el nombre de su retrato."
          },
          "gender": {
            "type": "string",
            "enum": [
              "Mujer",
              "Hombre"
            ],
            "description": "Para llamarle bien hasta que se presente, y para los romances."
          },
          "className": {
            "type": "string",
            "description": "Su clase, como la llama el compendio: Guerrero, Pícaro, Clérigo…"
          },
          "aspecto": {
            "type": "string",
            "description": "Cómo es por fuera, para dibujar su retrato y sus tres caras (alegre, enfadado, triste): edad, complexión, ropa y un rasgo que se vea a la primera, en una o dos frases. «Mujer de unos cincuenta, ancha de hombros, delantal de cuero y una quemadura en el antebrazo»."
          },
          "arcana": {
            "type": "string",
            "description": "Sabor, como en Persona. No cambia ninguna regla."
          },
          "initialBondPoints": {
            "type": "integer",
            "description": "Puntos de vínculo de partida. 0 es lo normal."
          },
          "arrivals": {
            "type": "array",
            "description": "Idea 45: lo que dice al llegar a un sitio, una vez, si va en el grupo.",
            "items": {
              "type": "object",
              "properties": {
                "place": {
                  "type": "string"
                },
                "line": {
                  "type": "string"
                }
              }
            }
          },
          "scenes": {
            "type": "array",
            "description": "Sus escenas de vínculo, una cada dos rangos (2, 4, 6, 8 y 10): salen al quedar con él. Mejor con beats (la conversación: say, mood y dos o tres replies, como en el romance; todo lo dice él, D-J60); con solo scene, el juego la pasa a escena solo.",
            "items": {
              "type": "object",
              "required": [
                "rank"
              ],
              "properties": {
                "rank": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 10
                },
                "title": {
                  "type": "string"
                },
                "where": {
                  "type": "string",
                  "description": "Dónde: posada, plaza, muelle…"
                },
                "scene": {
                  "type": "string",
                  "description": "Lo que pasa, en dos a cuatro frases, si no traes beats."
                },
                "beats": {
                  "type": "array",
                  "description": "De una a tres partes. say: lo que dice (todo lo dice alguien: no hay narrador, D-J60); replies: dos o tres respuestas. note es de antes: no la escribas (sale en un aviso pequeño, fuera de la conversación).",
                  "items": {
                    "type": "object",
                    "properties": {
                      "note": {
                        "type": "string"
                      },
                      "say": {
                        "type": "string"
                      },
                      "mood": {
                        "type": "string",
                        "enum": [
                          "neutral",
                          "alegre",
                          "enfadado",
                          "triste"
                        ]
                      },
                      "replies": {
                        "type": "array",
                        "maxItems": 3,
                        "items": {
                          "type": "object",
                          "required": [
                            "text"
                          ],
                          "properties": {
                            "text": {
                              "type": "string",
                              "description": "Lo que dices o haces tú."
                            },
                            "bond": {
                              "type": "integer",
                              "enum": [
                                -1,
                                0,
                                1
                              ],
                              "description": "Cómo cambia el vínculo."
                            },
                            "romance": {
                              "type": "string",
                              "enum": [
                                "avanza",
                                "amigos"
                              ],
                              "description": "avanza: la respuesta romántica (sale con un corazón); amigos: lo dejáis en amistad para siempre."
                            },
                            "then": {
                              "type": "string",
                              "description": "Lo que contesta."
                            },
                            "mood": {
                              "type": "string",
                              "enum": [
                                "neutral",
                                "alegre",
                                "enfadado",
                                "triste"
                              ],
                              "description": "Su cara al contestar."
                            },
                            "fade": {
                              "type": "boolean",
                              "description": "Solo en la noche: fundido a negro. Nada explícito."
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "romance": {
            "type": "object",
            "description": "Opcional: si con este compañero puede haber romance. Una señal, tres citas, una noche que acaba en fundido a negro, y desde ahí una pareja que el juego recuerda. Para que salga hacen falta las tres citas y la noche.",
            "properties": {
              "with": {
                "anyOf": [
                  {
                    "type": "string",
                    "enum": [
                      "todos",
                      "hombres",
                      "mujeres",
                      "no-binario",
                      "nadie"
                    ]
                  },
                  {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "enum": [
                        "todos",
                        "hombres",
                        "mujeres",
                        "no-binario",
                        "nadie"
                      ]
                    }
                  }
                ],
                "description": "Con quién, según el género del héroe: todos, hombres, mujeres, no-binario (o una lista), o nadie."
              },
              "no": {
                "type": "string",
                "description": "Lo que contesta, con cariño, si contigo no puede ser."
              },
              "escenas": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "kind"
                  ],
                  "properties": {
                    "kind": {
                      "type": "string",
                      "enum": [
                        "senal",
                        "cita",
                        "final",
                        "pareja",
                        "epilogo"
                      ],
                      "description": "senal: la escena en la que se nota (opcional: sin ella, la común). cita: una de las tres, con su step. final: la noche. pareja: frases sueltas de pareja (lines). epilogo: su línea al acabar (home, away, hall)."
                    },
                    "step": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 3,
                      "description": "Solo en cita: la 1, la 2 o la 3."
                    },
                    "title": {
                      "type": "string"
                    },
                    "where": {
                      "type": "string",
                      "description": "Dónde: posada, plaza, muelle…"
                    },
                    "beats": {
                      "type": "array",
                      "description": "De una a tres partes. say: lo que dice (todo lo dice alguien: no hay narrador, D-J60); replies: dos o tres respuestas. note es de antes: no la escribas (sale en un aviso pequeño, fuera de la conversación).",
                      "items": {
                        "type": "object",
                        "properties": {
                          "note": {
                            "type": "string"
                          },
                          "say": {
                            "type": "string"
                          },
                          "mood": {
                            "type": "string",
                            "enum": [
                              "neutral",
                              "alegre",
                              "enfadado",
                              "triste"
                            ]
                          },
                          "replies": {
                            "type": "array",
                            "maxItems": 3,
                            "items": {
                              "type": "object",
                              "required": [
                                "text"
                              ],
                              "properties": {
                                "text": {
                                  "type": "string",
                                  "description": "Lo que dices o haces tú."
                                },
                                "bond": {
                                  "type": "integer",
                                  "enum": [
                                    -1,
                                    0,
                                    1
                                  ],
                                  "description": "Cómo cambia el vínculo."
                                },
                                "romance": {
                                  "type": "string",
                                  "enum": [
                                    "avanza",
                                    "amigos"
                                  ],
                                  "description": "avanza: la respuesta romántica (sale con un corazón); amigos: lo dejáis en amistad para siempre."
                                },
                                "then": {
                                  "type": "string",
                                  "description": "Lo que contesta."
                                },
                                "mood": {
                                  "type": "string",
                                  "enum": [
                                    "neutral",
                                    "alegre",
                                    "enfadado",
                                    "triste"
                                  ],
                                  "description": "Su cara al contestar."
                                },
                                "fade": {
                                  "type": "boolean",
                                  "description": "Solo en la noche: fundido a negro. Nada explícito."
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                    "lines": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      },
                      "description": "Solo en pareja: frases de un rato juntos."
                    },
                    "home": {
                      "type": "string",
                      "description": "Solo en epilogo: si volvéis al gremio. Con {ending} y {nombre}."
                    },
                    "away": {
                      "type": "string",
                      "description": "Solo en epilogo: si os quedáis. Con {ending} y {nombre}."
                    },
                    "hall": {
                      "type": "string",
                      "description": "Solo en epilogo: su línea en el Salón de la fama. Con {heroe}, {nombre} y {day}."
                    }
                  }
                },
                "description": "Las escenas, como en compendio/romances.json, sin who (es este compañero)."
              }
            }
          },
          "misionPersonal": {
            "type": "object",
            "required": [
              "title",
              "endings",
              "steps"
            ],
            "description": "Opcional: lo suyo, que te pide al llegar al vínculo 4 y se juega como una misión pequeña: viaje, escenas, una pelea y uno de sus dos finales.",
            "properties": {
              "id": {
                "type": "string",
                "description": "Corto, con guiones. Sin él, el de su nombre."
              },
              "title": {
                "type": "string"
              },
              "where": {
                "type": "string",
                "description": "Adónde, en pocas palabras: «Robledo, una semana al norte»."
              },
              "pitch": {
                "type": "string",
                "description": "De qué va, en dos o tres frases llanas."
              },
              "rank": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10,
                "description": "El vínculo al que la pide. Sin él, 4."
              },
              "endings": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "title",
                    "summary"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "summary": {
                      "type": "string",
                      "description": "Lo que pasó, en dos frases."
                    }
                  }
                }
              },
              "start": {
                "type": "string",
                "description": "El paso por el que empieza. Sin él, el primero."
              },
              "steps": {
                "type": "array",
                "description": "viaje (to, days, text, next), escena (title, backdrop, beats como los del hilo, routes por opción o {bien, mal}, next), tablero (board con la forma de un tablero, bestiary, win, lose, flee) y final (ending: el id de uno de endings; back: días de vuelta; effects: gold, bonds, fame, flags, memory).",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "kind"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "kind": {
                      "type": "string",
                      "enum": [
                        "viaje",
                        "escena",
                        "tablero",
                        "final"
                      ]
                    },
                    "title": {
                      "type": "string"
                    },
                    "text": {
                      "type": "string",
                      "description": "Una línea corta al llegar al paso."
                    },
                    "next": {
                      "type": "string"
                    },
                    "to": {
                      "type": "string"
                    },
                    "days": {
                      "type": "integer"
                    },
                    "backdrop": {
                      "type": "string"
                    },
                    "beats": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      },
                      "description": "La conversación, con la forma de plot.milestones[].beats."
                    },
                    "routes": {
                      "type": "object",
                      "description": "Adónde lleva cada opción: {\"id-opcion\": \"paso\"} o {\"id-opcion\": {\"bien\": \"paso\", \"mal\": \"paso\"}}."
                    },
                    "board": {
                      "type": "object"
                    },
                    "bestiary": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    },
                    "win": {
                      "type": "string"
                    },
                    "lose": {
                      "type": "string"
                    },
                    "flee": {
                      "type": "string"
                    },
                    "ending": {
                      "type": "string"
                    },
                    "back": {
                      "type": "integer"
                    },
                    "effects": {
                      "type": "object",
                      "properties": {
                        "gold": {
                          "type": "integer"
                        },
                        "bonds": {
                          "type": "integer"
                        },
                        "fame": {
                          "type": "integer"
                        },
                        "flags": {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        "memory": {
                          "type": "string"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "npcs": {
      "type": "array",
      "description": "La gente del mundo que no va con vosotros: quien atiende la posada, el alcalde, quien sabe algo. Cada persona vive en una localización y sale allí para hablar con ella.",
      "items": {
        "type": "object",
        "required": [
          "name",
          "where"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "Único en el paquete, y distinto de los compañeros y del bestiario."
          },
          "where": {
            "type": "string",
            "description": "La localización donde vive, con su nombre exacto."
          },
          "trade": {
            "type": "string",
            "description": "Su oficio, corto: «Molinero», «Posadera». Hasta que se presenta, sale así: «la posadera»."
          },
          "id": {
            "type": "string",
            "description": "Corto, en minúsculas y sin espacios («tomas»): es el de {npc:tomas} en los textos."
          },
          "gender": {
            "type": "string",
            "enum": [
              "Mujer",
              "Hombre"
            ],
            "description": "Si su oficio no lo dice («Guardia»), para llamarle bien hasta que se presente."
          },
          "stranger": {
            "type": "string",
            "description": "Opcional: cómo se le llama sin conocerle, con su artículo («una mujer con capucha»). Sin él, su oficio."
          },
          "famous": {
            "type": "boolean",
            "description": "Su nombre lo sabe todo el mundo (el señor del valle): sale con él desde el principio."
          },
          "wants": {
            "type": "string",
            "description": "Lo que quiere, en una frase."
          },
          "knows": {
            "type": "string",
            "description": "Lo que sabe y puede contar, en una frase."
          },
          "secret": {
            "type": "string",
            "description": "Lo que calla: solo sale si se descubre."
          },
          "voice": {
            "type": "string",
            "description": "Cómo habla, en pocas palabras."
          },
          "aspecto": {
            "type": "string",
            "description": "Cómo es por fuera, para dibujar su retrato y sus tres caras (alegre, enfadado, triste): edad, complexión, ropa y un rasgo que se vea a la primera, en una o dos frases. «Mujer de unos cincuenta, ancha de hombros, delantal de cuero y una quemadura en el antebrazo»."
          },
          "service": {
            "type": "string",
            "enum": [
              "gremio",
              "posada",
              "herreria",
              "tienda",
              "templo",
              "tablon"
            ],
            "description": "Si atiende un servicio del sitio: la posada, la tienda, la herrería, el templo."
          }
        }
      }
    },
    "items": {
      "type": "array",
      "description": "El catálogo de objetos del mundo: lo que existe antes de que nadie lo lleve encima. La rareza decide en qué peldaño del botín cae.",
      "items": {
        "type": "object",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "Único en el paquete."
          },
          "type": {
            "type": "string",
            "enum": [
              "weapon",
              "armor",
              "gear"
            ]
          },
          "rarity": {
            "type": "string",
            "enum": [
              "Common",
              "Uncommon",
              "Rare",
              "Very Rare"
            ],
            "description": "Decide con qué facilidad cae."
          },
          "weight": {
            "type": "number",
            "description": "En kilos. 0 si no pesa nada."
          },
          "damageDice": {
            "type": "string",
            "description": "Solo las armas. Por ejemplo 1d8."
          },
          "damageType": {
            "type": "string",
            "description": "Solo las armas: cortante, perforante…"
          },
          "slot": {
            "type": "string",
            "description": "Dónde se equipa, si se equipa."
          },
          "description": {
            "type": "string"
          },
          "boundTo": {
            "type": "object",
            "description": "Reliquia (idea 132): llega al cumplir ese hito o al entregar ese encargo, una vez, y nunca cae como botín.",
            "properties": {
              "kind": {
                "type": "string",
                "enum": [
                  "milestone",
                  "contract"
                ]
              },
              "id": {
                "type": "string"
              }
            }
          }
        }
      }
    },
    "heroes": {
      "type": "array",
      "maxItems": 3,
      "description": "Tres héroes hechos, pensados para este mundo: quien juega elige uno y entra sin crear a nadie. De las razas y clases que el mundo deja entrar.",
      "items": {
        "type": "object",
        "required": [
          "name",
          "race",
          "className",
          "about",
          "pitch"
        ],
        "properties": {
          "name": {
            "type": "string"
          },
          "race": {
            "type": "string",
            "description": "Como la llama el compendio: Humano, Enano, Media elfa…"
          },
          "className": {
            "type": "string",
            "description": "Como la llama el compendio: Guerrero, Pícaro, Soldado…"
          },
          "gender": {
            "type": "string",
            "enum": [
              "Mujer",
              "Hombre",
              "No binario (en masculino)",
              "No binario (en femenino)"
            ],
            "description": "No cambia ninguna regla: dice cómo le habla el texto. Quien es no binario lleva detrás si en masculino o en femenino."
          },
          "background": {
            "type": "string",
            "enum": [
              "soldado",
              "criminal",
              "erudito",
              "acolito",
              "forastero",
              "artesano",
              "noble",
              "marinero",
              "charlatan",
              "ermitano"
            ]
          },
          "about": {
            "type": "string",
            "description": "Quién es, en dos frases. Es lo que lee el narrador."
          },
          "aspecto": {
            "type": "string",
            "description": "Cómo es por fuera, para dibujar su retrato y sus tres caras (alegre, enfadado, triste): edad, complexión, ropa y un rasgo que se vea a la primera, en una o dos frases. «Mujer de unos cincuenta, ancha de hombros, delantal de cuero y una quemadura en el antebrazo»."
          },
          "pitch": {
            "type": "string",
            "description": "Una línea para elegirlo: lo que le hace distinto."
          },
          "spells": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Ids de conjuros del grimorio, si hace magia. La magia solo existe en el grimorio del juego: no se inventa."
          },
          "pet": {
            "type": "object",
            "description": "La mascota con la que llega, si tiene: su nombre, su especie y su carácter.",
            "properties": {
              "name": {
                "type": "string"
              },
              "species": {
                "type": "string",
                "enum": [
                  "perro",
                  "gato",
                  "zorro",
                  "halcon",
                  "cuervo",
                  "loro",
                  "familiar",
                  "espiritu"
                ]
              },
              "character": {
                "type": "string",
                "enum": [
                  "cinica",
                  "leal",
                  "curiosa",
                  "miedosa",
                  "orgullosa"
                ]
              }
            }
          }
        }
      }
    },
    "dialogues": {
      "type": "array",
      "description": "Charlas escritas con ramas, para la gente que importa. Se juegan sin modelo: quien habla dice su línea con su gesto, y quien juega elige. Lo ya dicho no vuelve a salir, y lo aprendido queda en el Diario.",
      "items": {
        "type": "object",
        "required": [
          "id",
          "speaker",
          "nodes"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Único en el paquete: es lo que la partida recuerda."
          },
          "speaker": {
            "type": "string",
            "description": "Quién habla: el nombre de alguien de npcs o de confidants."
          },
          "title": {
            "type": "string"
          },
          "start": {
            "type": "string",
            "description": "El nudo por el que empieza. Sin él, el primero."
          },
          "when": {
            "anyOf": [
              {
                "$ref": "#/definitions/dialogueCondition"
              },
              {
                "type": "array",
                "items": {
                  "$ref": "#/definitions/dialogueCondition"
                }
              }
            ],
            "description": "Cuándo se ofrece. Una persona puede tener varias charlas: vale la primera que se cumpla."
          },
          "nodes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "id",
                "line"
              ],
              "properties": {
                "id": {
                  "type": "string"
                },
                "line": {
                  "type": "string",
                  "description": "Lo que dice, en una a tres frases llanas. Con {forma|forma} donde se habla a quien juega."
                },
                "again": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "array",
                      "items": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "object",
                            "properties": {
                              "if": {
                                "$ref": "#/definitions/dialogueCondition"
                              },
                              "text": {
                                "type": "string"
                              }
                            }
                          }
                        ]
                      }
                    }
                  ],
                  "description": "Lo que dice si volvéis otro día: más corto. Una frase, o una lista (la primera con if que se cumpla; si no, una sin if, distinta cada día)."
                },
                "more": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Al volver a este nudo en la misma charla: frases cortas, por turnos («¿Algo más?», «Tú dirás.»)."
                },
                "presenta": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    {
                      "type": "boolean"
                    }
                  ],
                  "description": "Opcional: quién se da a conocer en esta línea, por su id o su nombre (true: quien la dice). Hace falta solo si el nombre no sale en la línea: «Es la capitana de la guardia», y desde ahí sale con su nombre."
                },
                "mood": {
                  "type": "string",
                  "enum": [
                    "neutral",
                    "alegre",
                    "enfadado",
                    "triste"
                  ],
                  "description": "La cara del retrato."
                },
                "journal": {
                  "type": "string",
                  "description": "Lo que queda en el Diario al oírlo."
                },
                "effects": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/dialogueEffect"
                  },
                  "description": "Lo que pasa al oírlo la primera vez, se llegue por donde se llegue (el hito que cumple lo que cuenta)."
                },
                "options": {
                  "type": "array",
                  "description": "Sin opciones, el nudo acaba la charla.",
                  "items": {
                    "type": "object",
                    "required": [
                      "text"
                    ],
                    "properties": {
                      "id": {
                        "type": "string",
                        "description": "Único en la charla. Lo ya elegido no vuelve a salir."
                      },
                      "text": {
                        "type": "string",
                        "description": "Lo que dice o hace quien juega."
                      },
                      "if": {
                        "anyOf": [
                          {
                            "$ref": "#/definitions/dialogueCondition"
                          },
                          {
                            "type": "array",
                            "items": {
                              "$ref": "#/definitions/dialogueCondition"
                            }
                          }
                        ]
                      },
                      "next": {
                        "type": "string",
                        "description": "El nudo al que lleva. Sin él, se queda en este."
                      },
                      "reply": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "object",
                            "properties": {
                              "text": {
                                "type": "string"
                              },
                              "mood": {
                                "type": "string",
                                "enum": [
                                  "neutral",
                                  "alegre",
                                  "enfadado",
                                  "triste"
                                ]
                              }
                            }
                          }
                        ],
                        "description": "Lo que contesta al momento, con su cara: «Gracias» → «No me las des». Ninguna respuesta corta del héroe se queda sin contestar."
                      },
                      "effects": {
                        "type": "array",
                        "items": {
                          "$ref": "#/definitions/dialogueEffect"
                        }
                      },
                      "end": {
                        "type": "boolean",
                        "description": "Acaba la charla."
                      },
                      "repeat": {
                        "type": "boolean",
                        "description": "Se puede elegir más de una vez («Me voy»)."
                      },
                      "hidden": {
                        "type": "boolean",
                        "description": "Si no se cumple, no se enseña ni apagada."
                      },
                      "tag": {
                        "type": "string",
                        "description": "La etiqueta de delante, si no vale la de su condición."
                      },
                      "journal": {
                        "type": "string"
                      },
                      "irreversible": {
                        "anyOf": [
                          {
                            "type": "boolean"
                          },
                          {
                            "type": "string"
                          }
                        ],
                        "description": "Si pesa: true avisa con «Esto no tiene vuelta atrás» antes de elegirla, y se elige pulsando dos veces. Con texto, ese aviso (corto, y sin contar qué se pierde). Solo en las decisiones gordas."
                      },
                      "later": {
                        "$ref": "#/definitions/laterCard"
                      },
                      "check": {
                        "type": "object",
                        "required": [
                          "skill",
                          "success",
                          "failure"
                        ],
                        "description": "Una tirada: bien, a medias (sin escribirla, como bien pero pagando) o mal.",
                        "properties": {
                          "skill": {
                            "type": "string",
                            "enum": [
                              "persuasion",
                              "deception",
                              "intimidation",
                              "insight",
                              "perception",
                              "investigation",
                              "stealth",
                              "athletics",
                              "sleight",
                              "survival"
                            ]
                          },
                          "dc": {
                            "type": "integer",
                            "description": "De 5 a 30; 12 es un intento normal."
                          },
                          "success": {
                            "$ref": "#/definitions/dialogueBranch"
                          },
                          "partial": {
                            "$ref": "#/definitions/dialogueBranch"
                          },
                          "failure": {
                            "$ref": "#/definitions/dialogueBranch"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "plot": {
      "type": "object",
      "required": [
        "milestones"
      ],
      "description": "El hilo de la campaña: lo que tienes entre manos en cada momento, de la primera escena a uno de sus finales.",
      "properties": {
        "title": {
          "type": "string"
        },
        "milestones": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "title",
              "hint",
              "scene",
              "opens",
              "asks"
            ],
            "properties": {
              "id": {
                "type": "string",
                "description": "Único en el hilo: es a lo que apuntan opens, changes y las charlas."
              },
              "quest": {
                "type": "string",
                "description": "Forma corta: el id de una misión de quests. El juego pone lo que falte (title, hint, scene, opens tras el hito de antes y asks ganar su tablero). Con ella valen sueltos reveal, open, ending y endingBy, que van a changes."
              },
              "act": {
                "type": "integer",
                "minimum": 1,
                "maximum": 9,
                "description": "El acto: del 1 al 3. Si el hilo trae chapters, el capítulo, hasta el último que traiga."
              },
              "title": {
                "type": "string"
              },
              "hint": {
                "type": "string",
                "description": "Lo que se ve en pantalla mientras está abierto: qué hacer y dónde, en una frase."
              },
              "scene": {
                "type": "string",
                "description": "Lo que pasa al abrirse, en dos a cuatro frases. Hace falta aunque traiga beats: es el resumen para el Diario y para el modelo, cuando se juega con conexión."
              },
              "beats": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "text"
                  ],
                  "properties": {
                    "who": {
                      "type": "string",
                      "description": "Quién lo dice: alguien de npcs o de confidants, con su nombre exacto (sale su retrato y su placa). Todas las líneas llevan who: la historia se cuenta hablando, y en el juego sin conexión no hay narrador (D-J54, D-J60). Una línea sin who no la dice nadie: sale en un aviso pequeño fuera de la caja. No la escribas: el sitio y la hora ya se ven en pantalla."
                    },
                    "mood": {
                      "type": "string",
                      "enum": [
                        "neutral",
                        "alegre",
                        "enfadado",
                        "triste"
                      ],
                      "description": "La cara del retrato: neutral (la de siempre), alegre, enfadado o triste."
                    },
                    "text": {
                      "type": "string",
                      "description": "De una a tres frases llanas, sin acertijos. Con {forma|forma} donde se habla a quien juega."
                    },
                    "presenta": {
                      "anyOf": [
                        {
                          "type": "string"
                        },
                        {
                          "type": "array",
                          "items": {
                            "type": "string"
                          }
                        },
                        {
                          "type": "boolean"
                        }
                      ],
                      "description": "Opcional: quién se da a conocer en esta línea, por su id o su nombre (true: quien la dice). Hace falta solo si el nombre no sale en la línea: «Es la capitana de la guardia», y desde ahí sale con su nombre."
                    },
                    "alt": {
                      "type": "array",
                      "description": "Otras versiones de la línea, según quién eres o lo que elegiste antes: vale la primera cuyo if se cumpla. Sirve para que la gente reaccione a tu clase, tu especie, tu género o tu última decisión.",
                      "items": {
                        "type": "object",
                        "required": [
                          "if",
                          "text"
                        ],
                        "properties": {
                          "if": {
                            "type": "object",
                            "description": "chose (el id de una opción elegida en una escena), class, species, gender o background.",
                            "properties": {
                              "chose": {
                                "anyOf": [
                                  {
                                    "type": "string"
                                  },
                                  {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  }
                                ]
                              },
                              "class": {
                                "anyOf": [
                                  {
                                    "type": "string"
                                  },
                                  {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  }
                                ]
                              },
                              "species": {
                                "anyOf": [
                                  {
                                    "type": "string"
                                  },
                                  {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  }
                                ]
                              },
                              "gender": {
                                "type": "string",
                                "enum": [
                                  "Mujer",
                                  "Hombre"
                                ]
                              },
                              "background": {
                                "anyOf": [
                                  {
                                    "type": "string"
                                  },
                                  {
                                    "type": "array",
                                    "items": {
                                      "type": "string"
                                    }
                                  }
                                ]
                              }
                            }
                          },
                          "text": {
                            "type": "string"
                          },
                          "mood": {
                            "type": "string",
                            "enum": [
                              "neutral",
                              "alegre",
                              "enfadado",
                              "triste"
                            ]
                          },
                          "who": {
                            "type": "string"
                          }
                        }
                      }
                    },
                    "options": {
                      "type": "array",
                      "description": "Una decisión, tras esta línea: lo que puede decir o hacer quien juega. Como las opciones de una charla, pero sin next: la escena sigue. Los efectos sin who son con quien dice la línea; si la línea no tiene who, attitude y bond llevan who.",
                      "items": {
                        "type": "object",
                        "required": [
                          "text"
                        ],
                        "properties": {
                          "id": {
                            "type": "string",
                            "description": "Único en la decisión."
                          },
                          "text": {
                            "type": "string",
                            "description": "Lo que dice o hace quien juega."
                          },
                          "if": {
                            "anyOf": [
                              {
                                "$ref": "#/definitions/dialogueCondition"
                              },
                              {
                                "type": "array",
                                "items": {
                                  "$ref": "#/definitions/dialogueCondition"
                                }
                              }
                            ]
                          },
                          "effects": {
                            "type": "array",
                            "items": {
                              "$ref": "#/definitions/dialogueEffect"
                            }
                          },
                          "reply": {
                            "anyOf": [
                              {
                                "$ref": "#/definitions/sceneLine"
                              },
                              {
                                "type": "array",
                                "items": {
                                  "$ref": "#/definitions/sceneLine"
                                }
                              }
                            ],
                            "description": "Lo que se oye al elegirla: una línea o varias."
                          },
                          "tag": {
                            "type": "string"
                          },
                          "hidden": {
                            "type": "boolean"
                          },
                          "journal": {
                            "type": "string"
                          },
                          "irreversible": {
                            "anyOf": [
                              {
                                "type": "boolean"
                              },
                              {
                                "type": "string"
                              }
                            ],
                            "description": "Si pesa: true avisa con «Esto no tiene vuelta atrás» antes de elegirla, y se elige pulsando dos veces. Con texto, ese aviso (corto, y sin contar qué se pierde). Solo en las decisiones gordas."
                          },
                          "later": {
                            "$ref": "#/definitions/laterCard"
                          },
                          "check": {
                            "type": "object",
                            "required": [
                              "skill",
                              "success",
                              "failure"
                            ],
                            "properties": {
                              "skill": {
                                "type": "string",
                                "enum": [
                                  "persuasion",
                                  "deception",
                                  "intimidation",
                                  "insight",
                                  "perception",
                                  "investigation",
                                  "stealth",
                                  "athletics",
                                  "sleight",
                                  "survival"
                                ]
                              },
                              "dc": {
                                "type": "integer",
                                "description": "De 5 a 30; 12 es un intento normal."
                              },
                              "success": {
                                "$ref": "#/definitions/sceneBranch"
                              },
                              "partial": {
                                "$ref": "#/definitions/sceneBranch"
                              },
                              "failure": {
                                "$ref": "#/definitions/sceneBranch"
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                "description": "Solo en los hitos importantes: la escena jugada, de 3 a 8 líneas, con una o dos decisiones que cambien algo (cómo os mira alguien, un rumor, un objeto, un hito). Ejemplo: [{\"text\": \"Llegas al muelle al caer la tarde.\"}, {\"who\": \"Tomás\", \"mood\": \"enfadado\", \"text\": \"¡Al ladrón!\", \"options\": [{\"id\": \"yo\", \"text\": \"¡Yo lo paro!\", \"effects\": [{\"attitude\": 1}], \"reply\": {\"who\": \"Tomás\", \"mood\": \"alegre\", \"text\": \"¡Gracias!\"}}]}]."
              },
              "sceneDialogue": {
                "type": "string",
                "description": "El id de una charla de dialogues que se abre al acabar la escena."
              },
              "presenta": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "boolean"
                  }
                ],
                "description": "Opcional: quién se da a conocer en el texto de este hito (su scene), por su id o su nombre. Solo si el hito no trae beats y su scene dice el nombre de alguien que aún no se ha presentado."
              },
              "pov": {
                "type": "string",
                "description": "Punto de vista: quién cuenta esta escena, alguien de npcs o de confidants con su nombre exacto. Si el hito no trae beats, su scene sale en boca de esa persona, con su retrato; escríbela entonces como la diría ella. Sin pov ni beats, en el juego sin conexión no la dice nadie (D-J60): sale en un aviso pequeño, fuera de la caja."
              },
              "backdrop": {
                "type": "string",
                "description": "Dónde pasa la escena, para el fondo: gremio, posada, herreria, tienda, templo, tablon, plaza, muelle, o el nombre de una localización."
              },
              "prologue": {
                "type": "boolean",
                "description": "Del prólogo: los primeros hitos, hasta la prueba (el último del prólogo que pide ganar un tablero). Ganar la prueba da el prólogo entero por hecho, aunque se haya saltado algo."
              },
              "hidden": {
                "type": "boolean",
                "description": "Un secreto: no se ve hasta que se cumple por casualidad."
              },
              "within": {
                "type": "integer",
                "description": "Días para cumplirlo desde que se abre. Sin él, sin plazo. Los plazos están apagados por ahora (D-J46): se pueden escribir, pero no saltan."
              },
              "late": {
                "type": "object",
                "description": "Lo que pasa si se pasa el plazo (apagado por ahora, D-J46).",
                "properties": {
                  "reveal": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Localizaciones que se ponen en el mapa."
                  },
                  "open": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Hitos que se abren."
                  },
                  "standing": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer"
                    },
                    "description": "Cómo os mira cada facción, por su id: {\"los-vistani\": 1}."
                  }
                }
              },
              "backgrounds": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "soldado",
                    "criminal",
                    "erudito",
                    "acolito",
                    "forastero",
                    "artesano",
                    "noble",
                    "marinero",
                    "charlatan",
                    "ermitano"
                  ]
                },
                "description": "Solo para héroes con uno de estos trasfondos. Sin nada, para todos."
              },
              "opens": {
                "type": "object",
                "required": [
                  "kind"
                ],
                "description": "Qué lo abre. start: al empezar. after: al cumplirse milestone. arrive: al llegar a place. contract: al entregar el encargo id. day: el día day. clock: cuando la facción faction llena su reloj (apagado por ahora, D-J58: los relojes no avanzan; no lo uses).",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "start",
                      "arrive",
                      "after",
                      "contract",
                      "day",
                      "clock"
                    ]
                  },
                  "milestone": {
                    "type": "string"
                  },
                  "place": {
                    "type": "string"
                  },
                  "id": {
                    "type": "string"
                  },
                  "day": {
                    "type": "integer"
                  },
                  "faction": {
                    "type": "string"
                  }
                }
              },
              "asks": {
                "type": "object",
                "required": [
                  "kind"
                ],
                "description": "Qué pide. arrive: llegar a place. win: ganar el tablero board (su name). defeat: derrotar a enemy. talk: hablar con npc. check: sacar una tirada de skill. contract: entregar el encargo id, o uno de faction (against: en su contra). none: nada, se cumple al abrirse. any: cualquiera de options. clues: need pistas, cada una una tirada en un sitio.",
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "arrive",
                      "win",
                      "defeat",
                      "talk",
                      "check",
                      "contract",
                      "none",
                      "any",
                      "clues"
                    ]
                  },
                  "place": {
                    "type": "string"
                  },
                  "board": {
                    "type": "string"
                  },
                  "enemy": {
                    "type": "string"
                  },
                  "npc": {
                    "type": "string"
                  },
                  "skill": {
                    "type": "string",
                    "enum": [
                      "persuasion",
                      "deception",
                      "intimidation",
                      "insight",
                      "perception",
                      "investigation",
                      "stealth",
                      "athletics",
                      "sleight",
                      "survival"
                    ]
                  },
                  "id": {
                    "type": "string"
                  },
                  "faction": {
                    "type": "string"
                  },
                  "against": {
                    "type": "boolean"
                  },
                  "need": {
                    "type": "integer"
                  },
                  "options": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "kind"
                      ],
                      "properties": {
                        "kind": {
                          "type": "string"
                        }
                      }
                    }
                  },
                  "clues": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "place",
                        "skill"
                      ],
                      "properties": {
                        "place": {
                          "type": "string"
                        },
                        "skill": {
                          "type": "string",
                          "enum": [
                            "persuasion",
                            "deception",
                            "intimidation",
                            "insight",
                            "perception",
                            "investigation",
                            "stealth",
                            "athletics",
                            "sleight",
                            "survival"
                          ]
                        }
                      }
                    }
                  }
                }
              },
              "changes": {
                "type": "object",
                "description": "Lo que cambia al cumplirse.",
                "properties": {
                  "reveal": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Localizaciones ocultas que se ponen en el mapa."
                  },
                  "open": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Hitos que se abren."
                  },
                  "close": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Hitos que se cierran para siempre: el camino que no se tomó."
                  },
                  "standing": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer"
                    },
                    "description": "Cómo os mira cada facción, por su id: {\"los-vistani\": 1}."
                  },
                  "ending": {
                    "type": "string",
                    "description": "El final al que lleva, de endings."
                  },
                  "endingBy": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    },
                    "description": "El final según con quién os hayáis aliado: {\"id-de-faccion\": \"id-de-final\"}; decide la que mejor os mire."
                  }
                }
              }
            }
          }
        },
        "chapters": {
          "type": "array",
          "maxItems": 9,
          "description": "Los capítulos, si la campaña los tiene: uno por acto, con su nombre. El Diario se lee por capítulos y el tablón del gremio dice por cuál vais. Con ellos, el act de cada hito va del 1 al último capítulo. Sin ellos, tres actos sin nombre.",
          "items": {
            "type": "object",
            "required": [
              "act",
              "title"
            ],
            "properties": {
              "act": {
                "type": "integer",
                "minimum": 1,
                "maximum": 9
              },
              "title": {
                "type": "string",
                "description": "Corto, sin destripar: «El campamento vistani», no «La traición de la adivina»."
              },
              "summary": {
                "type": "string",
                "description": "De qué va, en una o dos frases, contado a quien juega. Sale al abrir el capítulo en el Diario."
              },
              "pov": {
                "type": "string",
                "description": "Opcional: quién cuenta el capítulo (alguien de npcs o de confidants). Vale para sus hitos que no digan otro pov."
              }
            }
          }
        },
        "endings": {
          "type": "object",
          "description": "Los finales, por su id.",
          "additionalProperties": {
            "type": "object",
            "required": [
              "title",
              "scene"
            ],
            "properties": {
              "title": {
                "type": "string"
              },
              "scene": {
                "type": "string",
                "description": "Cómo acaba, dicho por quien lo cuenta (who) con sus palabras: sale en la caja con su cara, y se lee en la tarjeta del final."
              },
              "who": {
                "type": "string",
                "description": "Quién cuenta el final: alguien de npcs o de confidants que está allí (D-J60). Sin él, la escena no la dice nadie."
              },
              "epilogues": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "who",
                    "text"
                  ],
                  "properties": {
                    "who": {
                      "type": "string",
                      "description": "De quién: alguien de npcs o de confidants, o una facción de world.factions, por su nombre."
                    },
                    "text": {
                      "type": "string",
                      "description": "Una o dos frases llanas: qué fue de él, de ella o de la facción con este final."
                    }
                  }
                },
                "description": "Qué fue de la gente con este final: una línea por persona o facción que haya pesado en la historia (3 a 5). Sin ellos, el juego los saca de cómo os miran las facciones al acabar."
              }
            }
          }
        },
        "omens": {
          "type": "array",
          "maxItems": 3,
          "description": "El presagio: hasta tres frases al empezar, cada una ligada al hito que la cumple.",
          "items": {
            "type": "object",
            "required": [
              "text",
              "milestone"
            ],
            "properties": {
              "text": {
                "type": "string"
              },
              "milestone": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
}
```

## Reglas que el esquema no puede comprobar

1. Cada `boardId` de una misión tiene que existir entre los tableros.
2. Cada nombre de enemigo colocado en un tablero tiene que existir en el bestiario.
3. Cada `target` de un objetivo `eliminate` tiene que ser un enemigo del bestiario.
4. Cada `ally` de un objetivo `escort` o `protect` tiene que ser un compañero de `confidants`.
5. Los nombres de enemigos y de compañeros no pueden repetirse: el Lorebook indexa por nombre y el segundo borraría al primero.
6. Cada mapa tiene que ser rectangular, con el borde exterior entero de muro.
7. Cada casilla de `partyStart` tiene que caer sobre suelo transitable, no sobre un muro.
8. Las coordenadas cuentan desde 0, y la primera fila del mapa es y=0.
9. Usa `optional: true` para los objetivos que pagan pero no bloquean. No existe `required`.
10. Escribe **nombres**, nunca identificadores internos: el importador los resuelve al crear las entradas.
11. Una localización puede tener **0 tableros**: una aldea donde solo se habla y se comercia es tan válida como una cripta. Declárala en `locations` aunque no tenga ninguno. La primera de `locations` es donde empieza la campaña.
12. El `locationName` de un tablero debería coincidir con el nombre de una localización de `locations`. Si no está declarada, se crea a partir del tablero.
13. Cada nombre de `zones[].enemies` es un enemigo del bestiario, y cada objeto de `zones[].treasure` o de `locations[].treasure`, uno de `items` (si no está, el juego lo crea sencillo). El `where` de cada persona de `npcs` es una localización de `locations`, y el `pov` de un hito o de un capítulo, alguien de `npcs` o de `confidants`.
14. Cada tablero mide entre 8×6 y 40×30 casillas. Uno de 14×10 ya da una escena; por encima de 24×18 se juega lento.
15. Desde donde empieza el grupo tiene que poderse llegar a toda casilla de suelo, abriendo puertas. Un enemigo en una sala incomunicada es un error; una sala vacía incomunicada, un aviso.
16. Los nombres de `items` tampoco se repiten, y su `rarity` es una de las cuatro que conocen las tablas de botín: una rareza inventada nunca cae.
17. Cada trampa de `traps` cae en una casilla de suelo del mapa, fuera de `partyStart`, y trae su `tell`: lo que se ve sin buscarla («una losa está más baja que las demás»). Hace daño (`damage`, en dados), deja a quien la pisa de alguna forma (`condition`) o las dos. Si no sabes la casilla, deja fuera `x` e `y`: el juego la pone en el camino.
18. Solo un tablero hecho de un mapa dibujado lleva `image` y `grid`. Si tienes su `map` (lo escribe `tools/mapa-a-tablero.mjs` a partir de la imagen), mide lo mismo que la cuadrícula; si no, déjalo fuera y el juego lo lee del dibujo al añadir la campaña. Sin imagen, no escribas ninguno de los dos. Las `zones` (las salas con nombre) sí valen en cualquier tablero.
19. Cada tablero con enemigos trae en `avoid` una a tres formas de no pelear que encajen con quién espera: `hablar` con la gente (convencer, engañar o espantar a una bestia con `intimidation`), `pagar` a quien se deja comprar, `huir` o `esconderse`. A los muertos y a las cosas sin mente no se les habla ni se les paga. Si salir de otra forma sigue la historia de otra manera, dilo en `success` con sus efectos; lo que pasa después del tablero tiene que seguir cuadrando.
20. En `dialogues`, el `speaker` de cada charla es alguien de `npcs` o de `confidants`, cada `next` lleva a un nudo que existe, y a todos los nudos se llega desde el de inicio. Un hito, un rumor o un objeto de una condición o de un efecto se nombra como está en el paquete (el hito y el rumor, por su id).
21. En una charla, lo que depende de quién eres (`species`, `class`, `background`, `gender`) solo le sale a quien encaja, con su etiqueta delante: «[Enano] …». Cada tirada lleva `success` y `failure`; `partial` es opcional. Las líneas son de una a tres frases llanas, sin acertijos, con `{forma|forma}` donde se habla a quien juega.
22. En `plot`, cada `opens.milestone`, `changes.open` y `changes.close` nombra un hito del hilo por su id, cada `asks.board` un tablero por su `name`, y cada `changes.ending` un final de `endings`. El primer hito se abre con `start`: es la mecha de la campaña.
23. Los hitos importantes traen su escena en `beats`: de 3 a 8 líneas, cada una de alguien de `npcs` o `confidants` (siempre con `who`: no hay narrador, D-J60), y una o dos decisiones que cambien algo: cómo os mira alguien, un rumor, un objeto o un hito. `scene` sigue haciendo falta: es el resumen para el Diario y para el modelo, cuando se juega con conexión. `sceneDialogue` nombra una charla de `dialogues` por su id.
24. Quien juega solo sabe el nombre de quien se ha presentado: hasta entonces, el juego le llama por su oficio («el posadero»). Que la gente diga su nombre al conocerse («Tomás. Llevo la posada.»), o que otro lo diga en voz alta. Antes de eso, ni una opción de quien juega ni nadie que no le conozca le nombran: se dice «el posadero». En las líneas, las opciones y las respuestas de las escenas y las charlas, `{npc:id}` sale como su nombre si ya se sabe y como «el posadero» si no. El título de un hito sale antes de su escena: no nombres en él a quien se presenta en ella.
25. Cada final de `plot.endings` trae sus `epilogues`: qué fue de 3 a 5 personas o facciones que pesaron en la historia, una línea cada una. El `who` de cada uno es un nombre de `npcs`, `confidants` o `world.factions`, letra por letra.
26. Donde se le habla a quien juega —la sinopsis, la `description` de un compañero y sus escenas, las del hilo y sus finales, los epílogos, las charlas, los rumores, las misiones y el `twist` de un encargo—, lo que concuerda con su género lleva sus dos formas entre llaves: «Eres {un mercenario|una mercenaria}»; al grupo, en plural: «estáis {hechos|hechas}». Solo dos formas: quien es no binario elige si el texto le habla en masculino o en femenino. En los demás campos (la gente, los objetos, el resto de un encargo), escribe sin nada que concuerde con quien juega. Nunca «cansado/a».
27. La historia se cuenta con conversaciones (D-J54, D-J60): en `beats`, en las charlas y en las escenas de un compañero, todas las líneas llevan `who` (alguien de `npcs` o `confidants`, que sale con su retrato y su placa) y su `mood`. En el juego sin conexión no hay narrador: ni saludo, ni resúmenes, ni líneas de ambiente. El sitio y la hora ya se ven en pantalla (el fondo y el reloj); lo que haga falta saber, que lo diga alguien que esté allí.
28. Cada persona de `npcs` y de `confidants` trae su `aspecto`: edad, complexión, ropa y un rasgo que se vea, en una o dos frases. Con él se dibujan su retrato y sus tres caras (alegre, enfadado, triste).
29. El `romance` y la `misionPersonal` de un compañero son opcionales. Un romance sale solo si trae sus tres citas (`cita` con `step` 1, 2 y 3) y la noche (`final`, con una respuesta `fade`). Una misión personal trae sus dos `endings`, y cada paso `final` nombra uno de ellos; desde `start` se llega a los dos.

## Sobre los mapas

El mapa es un tablero de combate por casillas, no una ilustración: tiene que poder
recorrerse. Deja pasillos de al menos una casilla de ancho, usa muros interiores para
crear cobertura y rutas, y no dibujes una sala vacía.

- `1` runa 1 (las runas 1 a 5 se pisan en orden, de la 1 a la última que pongas; pisar una que no toca las apaga todas; con todas encendidas, se abren las puertas con llave)
- `2` runa 2
- `3` runa 3
- `4` runa 4
- `5` runa 5
- `.` suelo transitable
- `#` muro
- `D` puerta cerrada
- `L` puerta cerrada con llave (se abre con una llave, con ganzúas o a golpes; el jefe del tablero suelta la llave)
- `o` puerta abierta
- `~` terreno difícil
- `c` cobertura media
- `C` cobertura de tres cuartos
- `v` precipicio (no se anda; a quien empujan dentro, cae)
- `>` escalera al nivel siguiente
- `w` agua poco honda (cuesta el doble; el frío la hiela)
- `W` agua honda (no se cruza andando; se ve a través): el mar, un río profundo
- `i` hielo (cuesta el doble y resbala: Acrobacias CD 10 o al suelo; el trueno lo quiebra, el fuego lo funde)
- `b` maleza (cuesta el doble, y arde)
- `m` barro (cuesta el doble)
- `T` barril (cubre; con fuego, revienta)
- `k` cofre (se abre estando al lado)
- `^` en alto (subir cuesta el doble; desde arriba se ataca con ventaja): torres, escalones, la empalizada
- `x` salida (quien la pisa puede irse de la pelea; con un objetivo «alcanzar» encima, salir es ganar): la ventana, la trampilla
- `P` palanca (no se pisa; estando al lado, abre todas las puertas con llave del tablero): la reja del fondo
- `=` barricada (corta el paso, no la vista; cubre a quien está detrás y a golpes se rompe: 15 de vida)
- `H` columna, puntal o estantería que se puede tirar (corta el paso y cubre; estando al lado, se empuja y cae sobre las dos casillas de detrás: 1d10 contundente y derribado, salvación de Destreza CD 12 para la mitad)
- `S` estatua con las manos vacías (no se pisa; se le pone una gema; con todas puestas, se abren las puertas con llave del tablero)
- `g` gema en un pedestal (no se pisa; se coge estando al lado; pon tantas como estatuas)
- `p` palanca doble (no se pisa; pon dos lejos una de otra: se bajan a la vez, en la misma ronda o con alguien en cada una, y abren las puertas con llave)

## Muestra de un paquete completo

Pequeño y completo: dos tableros para que una misión apunte a uno, un objetivo de cada tipo
incómodo, un compañero al que protege un objetivo y una charla con ramas.

```json
{
  "version": 1,
  "world": {
    "name": "El Molino de los Cuervos",
    "genre": "Fantasía oscura",
    "synopsis": "Un molino abandonado a las afueras del pueblo, donde los cuervos traen noticias que nadie pidió y el grano lleva años sin molerse.",
    "factions": [
      {
        "name": "La Orden de la Pluma",
        "goals": "Vigilar en secreto lo que duerme bajo el molino",
        "reputation": 10
      }
    ],
    "loreEntries": [
      {
        "key": "Molino",
        "content": "Tres pisos de madera podrida sobre un sótano que nadie admite haber visto.",
        "type": "location"
      },
      {
        "key": "Cuervos",
        "content": "Demasiado atentos para ser pájaros.",
        "type": "other"
      }
    ]
  },
  "confidants": [
    {
      "name": "Mira la Molinera",
      "id": "mira",
      "gender": "Mujer",
      "description": "Heredó el molino y la costumbre de no bajar al sótano.",
      "aspecto": "Mujer joven y fuerte, harina en el pelo trenzado, mandil remendado y una hoz al cinto.",
      "arcana": "La Ermitaña",
      "initialBondPoints": 0
    }
  ],
  "items": [
    {
      "name": "Hoz del molino",
      "type": "weapon",
      "rarity": "Uncommon",
      "weight": 1.5,
      "damageDice": "1d6",
      "damageType": "cortante",
      "slot": "weapon",
      "description": "Sigue oliendo a grano mojado."
    }
  ],
  "dialogues": [
    {
      "id": "mira-el-sotano",
      "speaker": "Mira la Molinera",
      "start": "puerta",
      "nodes": [
        {
          "id": "puerta",
          "mood": "triste",
          "line": "No bajéis al sótano. Mi padre bajó una noche y no volvió a ser el mismo.",
          "again": "¿Otra vez vosotros? Ya os he dicho lo que sé.",
          "options": [
            {
              "id": "padre",
              "text": "¿Qué le pasó a tu padre?",
              "next": "padre"
            },
            {
              "id": "enano",
              "text": "Los sótanos no me asustan: me crié en uno.",
              "if": {
                "species": "Enano"
              },
              "effects": [
                {
                  "attitude": 1
                }
              ],
              "next": "risa"
            },
            {
              "id": "llave",
              "text": "Déjanos la llave de la trampilla.",
              "if": {
                "attitude": 1
              },
              "next": "llave"
            },
            {
              "id": "convencer",
              "text": "Si no bajamos, los cuervos seguirán aquí.",
              "check": {
                "skill": "persuasion",
                "dc": 12,
                "success": {
                  "next": "llave",
                  "effects": [
                    {
                      "attitude": 1
                    }
                  ]
                },
                "partial": {
                  "next": "llave",
                  "effects": [
                    {
                      "attitude": -1
                    }
                  ]
                },
                "failure": {
                  "next": "no"
                }
              }
            },
            {
              "id": "adios",
              "text": "Ya volveremos.",
              "end": true,
              "repeat": true
            }
          ]
        },
        {
          "id": "padre",
          "line": "Subió con los ojos blancos y no habló nunca más de ello.",
          "journal": "El padre de Mira bajó al sótano y volvió cambiado.",
          "options": [
            {
              "id": "volver",
              "text": "Lo siento.",
              "next": "puerta"
            }
          ]
        },
        {
          "id": "risa",
          "mood": "alegre",
          "line": "Pues bajad {tranquilo|tranquila}, que ya somos dos.",
          "options": [
            {
              "id": "seguir",
              "text": "Sigamos.",
              "next": "puerta"
            }
          ]
        },
        {
          "id": "llave",
          "line": "Tomad la llave, y la hoz de mi padre: abajo os hará falta. Cerrad por fuera al salir.",
          "options": [
            {
              "id": "gracias",
              "text": "Gracias, Mira.",
              "effects": [
                {
                  "give": "Hoz del molino"
                },
                {
                  "bond": 1
                }
              ],
              "end": true
            }
          ]
        },
        {
          "id": "no",
          "mood": "enfadado",
          "line": "He dicho que no. Idos."
        }
      ]
    }
  ],
  "locations": [
    {
      "name": "El Molino de los Cuervos",
      "type": "ruins",
      "description": "El molino y lo que guarda debajo.",
      "factionName": "La Orden de la Pluma"
    },
    {
      "name": "Vado de la Rueda",
      "type": "village",
      "description": "Cuatro casas y un puente de tablones. Aquí nadie ha visto nada.",
      "region": "La ribera"
    }
  ],
  "bestiary": [
    {
      "name": "Cuervo grande",
      "hp": 7,
      "armorClass": 12,
      "cr": 0.125,
      "profile": "skirmisher",
      "attackRangeFeet": 5
    },
    {
      "name": "Guardián del grano",
      "hp": 26,
      "armorClass": 14,
      "cr": 1,
      "profile": "guardian",
      "attackRangeFeet": 5,
      "description": "Un espantapájaros que se mueve cuando nadie mira."
    }
  ],
  "boards": [
    {
      "id": "molino_planta_baja",
      "name": "Planta baja del molino",
      "locationName": "El Molino de los Cuervos",
      "map": [
        "##############",
        "#....#.......#",
        "#.c..D...~~..#",
        "#....#...~~..#",
        "#....#####D###",
        "#............#",
        "#..C......c..#",
        "#............#",
        "##############"
      ],
      "partyStart": [
        {
          "x": 2,
          "y": 7
        },
        {
          "x": 3,
          "y": 7
        }
      ],
      "enemies": [
        {
          "name": "Cuervo grande",
          "x": 9,
          "y": 2
        }
      ],
      "avoid": [
        {
          "kind": "hablar",
          "text": "Espantar al cuervo agitando la capa y gritando",
          "skill": "intimidation",
          "dc": 11,
          "success": "El cuervo grazna, se sacude y sale volando por un hueco del tejado.",
          "failure": "El cuervo no se asusta: baja en picado a por tus ojos."
        },
        {
          "kind": "esconderse",
          "text": "Pasar pegados a la pared, por debajo de la viga donde duerme",
          "dc": 12
        }
      ]
    },
    {
      "id": "molino_sotano",
      "name": "El sótano",
      "locationName": "El Molino de los Cuervos",
      "map": [
        "############",
        "#....#.....#",
        "#....#.....#",
        "#....D.....#",
        "#....#.....#",
        "#....#.....#",
        "#....#.....#",
        "#....#.....#",
        "############"
      ],
      "partyStart": [
        {
          "x": 2,
          "y": 7
        },
        {
          "x": 3,
          "y": 7
        }
      ],
      "enemies": [
        {
          "name": "Guardián del grano",
          "x": 8,
          "y": 3
        }
      ]
    }
  ],
  "quests": [
    {
      "id": "q_molino_1",
      "name": "Los cuervos del molino",
      "act": 1,
      "description": "Mira dice que los pájaros no la dejan trabajar. No es del todo mentira.",
      "boardId": "molino_planta_baja",
      "objectives": [
        {
          "type": "eliminate_all",
          "label": "Despejar la planta baja"
        }
      ]
    },
    {
      "id": "q_molino_2",
      "name": "Lo que hay debajo",
      "act": 1,
      "description": "La trampilla del sótano lleva años cerrada por fuera.",
      "boardId": "molino_sotano",
      "objectives": [
        {
          "type": "eliminate",
          "label": "Acabar con el guardián",
          "target": "Guardián del grano"
        },
        {
          "type": "protect",
          "label": "Que Mira salga entera",
          "ally": "Mira la Molinera"
        },
        {
          "type": "survive_rounds",
          "label": "Aguantar hasta el amanecer",
          "rounds": 6,
          "optional": true
        }
      ]
    }
  ]
}
```

## Muestra de un compañero con romance y misión personal

Va en `confidants`. El romance: tres citas (`cita` con `step` 1, 2 y 3), la noche (`final`, con una
respuesta `fade`: fundido a negro, nada explícito), frases de pareja y su epílogo. En cada escena,
`note` es lo que se ve (una línea corta, sin nombre) y `say` lo que dice. La misión personal: un
viaje, una conversación con una decisión, una pelea y sus dos finales; cada `routes` lleva a un paso
que existe y desde `start` se llega a los dos finales.

```json
{
  "name": "Lía Remos",
  "id": "lia",
  "gender": "Mujer",
  "className": "Pícaro",
  "description": "Hija de pescadores. Conoce cada roca de la punta, y una de las barcas hundidas era de su tío.",
  "aspecto": "Joven morena de pelo corto y rizado, chaleco de cuero gastado, una cuerda al hombro y un cuchillo de pescador al cinto.",
  "scenes": [
    {
      "rank": 2,
      "title": "Las rocas de la punta",
      "where": "muelle",
      "beats": [
        {
          "say": "Mi tío decía que cada roca de la punta tiene nombre. Me los sé todos.",
          "mood": "triste"
        },
        {
          "say": "¿Tú tienes algún sitio así? ¿Uno que te sepas de memoria?",
          "replies": [
            {
              "text": "Le hablas del sitio donde creciste.",
              "bond": 1,
              "then": "Pues algún día me llevas. Y yo te enseño mis rocas.",
              "mood": "alegre"
            },
            {
              "text": "Le dices que tú no eres de ningún sitio.",
              "bond": 0,
              "then": "Eso tiene arreglo. Quédate un tiempo en Punta Gris."
            }
          ]
        }
      ]
    }
  ],
  "romance": {
    "with": "todos",
    "no": "Tú y yo somos de las que se cubren las espaldas. Con eso me basta.",
    "escenas": [
      {
        "kind": "cita",
        "step": 1,
        "title": "Las redes",
        "where": "muelle",
        "beats": [
          {
            "say": "Estoy remendando esta red. Si me ayudas, te enseño el mejor sitio para ver entrar las barcas.",
            "mood": "alegre",
            "replies": [
              {
                "text": "Te sientas a su lado y coges la aguja.",
                "bond": 1,
                "romance": "avanza",
                "then": "Lo haces fatal. Me encanta.",
                "mood": "alegre"
              },
              {
                "text": "Le dices que tienes prisa.",
                "bond": 0,
                "then": "Otro día, entonces."
              }
            ]
          }
        ]
      },
      {
        "kind": "cita",
        "step": 2,
        "title": "La tormenta",
        "where": "posada",
        "beats": [
          {
            "say": "Con esta lluvia, mejor junto al fuego: te he guardado una taza. Mi tío decía que con tormenta solo salen los tontos y los enamorados.",
            "replies": [
              {
                "text": "Le preguntas de qué eres tú.",
                "bond": 1,
                "romance": "avanza",
                "then": "Eso lo tendrás que averiguar.",
                "mood": "alegre"
              },
              {
                "text": "Le hablas del tiempo.",
                "bond": 0,
                "then": "Ya. El tiempo."
              }
            ]
          }
        ]
      },
      {
        "kind": "cita",
        "step": 3,
        "title": "La punta",
        "where": "muelle",
        "beats": [
          {
            "say": "Esta es la roca más alta de la punta. Aquí no sube nadie más. Quería que la vieras conmigo.",
            "mood": "alegre",
            "replies": [
              {
                "text": "Le coges la mano.",
                "bond": 1,
                "romance": "avanza",
                "then": "No pienso soltártela en todo el atardecer.",
                "mood": "alegre"
              },
              {
                "text": "Le dices que la quieres como amiga.",
                "bond": 0,
                "romance": "amigos",
                "then": "Me lo imaginaba. Amigas, entonces. De las buenas.",
                "mood": "triste"
              }
            ]
          }
        ]
      },
      {
        "kind": "final",
        "title": "La noche del faro",
        "where": "posada",
        "beats": [
          {
            "say": "Mira por la ventana: ya gira la luz del faro. Quédate esta noche.",
            "mood": "alegre",
            "replies": [
              {
                "text": "Te quedas.",
                "bond": 1,
                "romance": "avanza",
                "then": "Ven. Apaga tú la vela.",
                "fade": true
              },
              {
                "text": "Le das un beso en la frente y te vas a dormir.",
                "bond": 0,
                "then": "Otra noche, entonces."
              }
            ]
          }
        ]
      },
      {
        "kind": "pareja",
        "lines": [
          "Te he guardado el mejor sitio junto al fuego.",
          "Mira: llevo tu pañuelo atado a la muñeca."
        ]
      },
      {
        "kind": "epilogo",
        "home": "Lía vuelve contigo al gremio después de «{ending}». Dice que el mar de Puerto Alba es más feo, pero que se acostumbra.",
        "away": "Lía se quedó contigo en Punta Gris después de «{ending}». Cada noche subís a ver girar la luz del faro.",
        "hall": "{heroe} y Lía Remos, {juntos|juntas} desde el día {day}."
      }
    ]
  },
  "misionPersonal": {
    "title": "La barca de mi tío",
    "where": "Cala Negra, un día al sur",
    "pitch": "La barca del tío de Lía no se hundió: alguien la vio entera en Cala Negra, con otro nombre pintado. Lía quiere saber quién la tiene.",
    "endings": [
      {
        "id": "perdonar",
        "title": "Dejarlo estar",
        "summary": "Lía deja la barca a quien la encontró. Vuelve callada, pero en paz."
      },
      {
        "id": "recuperar",
        "title": "Recuperar la barca",
        "summary": "La barca vuelve a Punta Gris con su nombre de siempre. Lía la pinta ella misma."
      }
    ],
    "start": "ida",
    "steps": [
      {
        "id": "ida",
        "kind": "viaje",
        "to": "Cala Negra",
        "days": 1,
        "text": "Un día de camino por la costa hasta Cala Negra.",
        "next": "cala"
      },
      {
        "id": "cala",
        "kind": "escena",
        "title": "Cala Negra",
        "backdrop": "muelle",
        "beats": [
          {
            "who": "Lía Remos",
            "mood": "enfadado",
            "text": "¿Ves esa barca recién pintada? Es la de mi tío. Le han tapado el nombre, pero la proa es la misma."
          },
          {
            "who": "Lía Remos",
            "mood": "triste",
            "text": "Ahí viene el que la tiene. ¿Qué hacemos?",
            "options": [
              {
                "id": "hablar",
                "text": "Hablamos con él.",
                "check": {
                  "skill": "persuasion",
                  "dc": 12,
                  "success": {
                    "reply": {
                      "who": "Lía Remos",
                      "mood": "alegre",
                      "text": "Dice que la encontró a la deriva. Me la devuelve."
                    }
                  },
                  "failure": {
                    "reply": {
                      "who": "Lía Remos",
                      "mood": "enfadado",
                      "text": "No quiere saber nada. Llama a sus amigos."
                    }
                  }
                }
              },
              {
                "id": "dejar",
                "text": "Déjalo estar, Lía.",
                "reply": {
                  "who": "Lía Remos",
                  "mood": "triste",
                  "text": "Tienes razón. Mi tío ya no la va a usar."
                }
              }
            ]
          }
        ],
        "routes": {
          "hablar": {
            "bien": "fin-recuperar",
            "mal": "pelea"
          },
          "dejar": "fin-perdonar"
        },
        "next": "fin-perdonar"
      },
      {
        "id": "pelea",
        "kind": "tablero",
        "text": "Los amigos del barquero no quieren devolver nada.",
        "board": {
          "id": "cala_negra",
          "name": "Cala Negra",
          "locationName": "Cala Negra",
          "map": [
            "############",
            "#....c.....#",
            "#..........#",
            "#..c....c..#",
            "#..........#",
            "############"
          ],
          "partyStart": [
            {
              "x": 1,
              "y": 4
            },
            {
              "x": 2,
              "y": 4
            },
            {
              "x": 3,
              "y": 4
            },
            {
              "x": 4,
              "y": 4
            }
          ],
          "enemies": [
            {
              "name": "Barquero de la cala",
              "x": 9,
              "y": 1
            },
            {
              "name": "Barquero de la cala",
              "x": 10,
              "y": 2
            }
          ]
        },
        "bestiary": [
          {
            "name": "Barquero de la cala",
            "hp": 9,
            "armorClass": 11,
            "cr": 0.125,
            "profile": "aggressive",
            "attackRangeFeet": 5,
            "description": "Un pescador con un bichero."
          }
        ],
        "win": "fin-recuperar",
        "lose": "fin-perdonar",
        "flee": "fin-perdonar"
      },
      {
        "id": "fin-recuperar",
        "kind": "final",
        "ending": "recuperar",
        "back": 1,
        "effects": {
          "bonds": 2,
          "flags": [
            "barca-recuperada"
          ],
          "memory": "Recuperasteis la barca del tío de Lía en Cala Negra."
        }
      },
      {
        "id": "fin-perdonar",
        "kind": "final",
        "ending": "perdonar",
        "back": 1,
        "effects": {
          "bonds": 1,
          "memory": "Acompañaste a Lía a Cala Negra, y la ayudaste a dejarlo estar."
        }
      }
    ]
  }
}
```

## Muestra de un tablero por salas

Como lo cuenta un módulo: quién espera en cada sala (`enemies`), qué tesoro guarda (`treasure`) y sus
trampas (`traps`). El juego pone a cada uno en su sala (tras una puerta cerrada, duermen hasta que se
abre) y el tesoro en un cofre. No hace falta repetir a los de las salas en `enemies` del tablero.

```json
{
  "id": "cripta_capilla",
  "name": "La capilla de la cripta",
  "locationName": "La cripta",
  "map": [
    "##############",
    "#....#.......#",
    "#....#.......#",
    "#....D.......#",
    "#....#.......#",
    "#....#.......#",
    "##############"
  ],
  "partyStart": [
    {
      "x": 1,
      "y": 5
    },
    {
      "x": 2,
      "y": 5
    }
  ],
  "zones": [
    {
      "name": "B1 · La escalera",
      "rect": {
        "x": 1,
        "y": 1,
        "width": 4,
        "height": 5
      },
      "note": "Una escalera de piedra mojada baja hasta aquí."
    },
    {
      "name": "B2 · La capilla",
      "rect": {
        "x": 6,
        "y": 1,
        "width": 7,
        "height": 5
      },
      "note": "Un altar partido y velas negras que alguien ha encendido hace poco.",
      "enemies": [
        "Esqueleto",
        "Esqueleto"
      ],
      "treasure": [
        "Cáliz de plata"
      ]
    }
  ],
  "traps": [
    {
      "name": "Losa suelta",
      "x": 3,
      "y": 2,
      "tell": "Al pie de la escalera, una losa baila bajo el polvo.",
      "damage": "1d6",
      "condition": "prone",
      "spotDC": 12
    }
  ]
}
```

## Los conjuros del grimorio

La magia solo existe aquí. En `spells` (un héroe) y en `abilities` (un bicho) se nombran por su id; no se
inventa ninguno. Los trucos son a voluntad; los de círculo gastan cargas.

- **truco**: `hab-rayo-fuego` (Rayo de fuego, mago), `mag-escarcha` (Dedo de escarcha, mago), `mag-latigo-espinas` (Látigo de espinas, druida), `mag-luz` (Luz, clerigo o mago o bardo), `hab-mano-lejana` (Mano lejana, mago).
- **1.er círculo**: `hab-curar` (Curar heridas, clerigo o druida), `hab-bendicion` (Bendición, clerigo), `hab-luz-severa` (Luz severa, clerigo), `hab-escudo-arcano` (Escudo arcano, mago), `hab-sueno` (Sueño pesado, mago o bardo), `hab-espinas` (Zarzas, druida), `mag-ola-trueno` (Ola de trueno, mago o druida o bardo), `mag-encanto` (Encanto, bardo o mago), `mag-detectar-mentiras` (Detectar mentiras, clerigo o bardo o mago), `mag-paso-sin-rastro` (Paso sin rastro, druida).
- **2.º círculo**: `mag-cono-escarcha` (Cono de escarcha, mago), `mag-relampago` (Relámpago, mago), `mag-oracion` (Oración de curación, clerigo), `mag-invisibilidad` (Invisibilidad, mago o bardo), `mag-toque-vampirico` (Toque vampírico, mago), `mag-hablar-muertos` (Hablar con los muertos, clerigo o mago), `hab-forma-animal` (Forma de bestia, druida).
- **3.er círculo**: `mag-bola-fuego` (Bola de fuego, mago), `mag-muro-fuego` (Muro de fuego, mago o druida), `mag-volver-orilla` (Volver de la orilla, clerigo).
