# La costa que no duerme — ronda 9: los encargos

Quince encargos en el tablón de la Cofradía, con tres cadenas de tres. Siete se resuelven sin pelear
(hablando, buscando o llevando algo); los otros ocho se juegan en su tablero, que con el modo guiado
(D-J62) es la forma de llegar a él: se acepta el encargo y el juego dice adónde ir.

Cada uno tiene su giro: lo que se descubre al hacerlo y no se sabía al aceptarlo.

| Cadena | Encargos | De qué va |
|---|---|---|
| La sal de noche | 3 | La sal que sale de la Salazón sin que lo sepa nadie, y a quién le sirve |
| Los de Arenales | 3 | El pueblo de al lado, que entierra a sus muertos y no perdona |
| Los muertos de la ermita | 3 | Las Rezadoras, las cajas de piedras y lo que se llevaron del osario |

```yaml
encargo:
  id: e-velas
  titulo: Velas para la Vela
  verbo: traer
  lo_pide: paco
  donde: mareaviva
  acto: 1
  sin_pelear: true
  recompensa: '10 monedas'
  giro: 'Las velas gordas de la Vela se las llevó todas el capataz de la Salazón. Paco solo tiene las de cera buena que guarda para los entierros que no hay, y hay que convencerle de que las saque.'

encargo:
  id: e-congrios
  titulo: El que corta las redes
  verbo: cazar
  lo_pide: juana
  acto: 1
  recompensa: '20 monedas y un cuchillo de redera'
  giro: 'El congrio gigante no corta las redes: se come lo que se queda enredado. Lo que las corta desde dentro sube del agua por las noches.'
  encuentro: enc-congrios

encargo:
  id: e-salmuera
  titulo: Las pilas de salmuera
  verbo: limpiar
  lo_pide: anton
  acto: 1
  faccion: { id: cofradia }
  recompensa: '15 monedas'
  giro: 'Los cangrejos no entraron solos: alguien dejó abierta la compuerta del mar una noche. La misma noche que salieron diez sacos de sal sin marca.'
  encuentro: enc-salmuera

encargo:
  id: e-ermita-1
  titulo: Los que cavan de noche
  verbo: vigilar
  cadena: { id: c-ermita, parte: 1, de: 3 }
  lo_pide: lazaro
  acto: 1
  faccion: { id: rezadoras }
  recompensa: '15 monedas'
  giro: 'Los que cavan son forasteros que creen que en las cajas hay oro. Lo que de verdad les sorprende es encontrar piedras.'
  encuentro: enc-saqueadores

encargo:
  id: e-gaviotas
  titulo: Las gaviotas del faro
  verbo: espantar
  lo_pide: nicasio
  acto: 1
  recompensa: '12 monedas y una noche en el cobertizo'
  giro: 'Las gaviotas no atacan por hambre: desde que la marea no baja, los peces se han ido de la punta y ellas se han quedado sin nada.'
  encuentro: enc-gaviotas

encargo:
  id: e-lista
  titulo: La lista nueva
  verbo: buscar
  lo_pide: maite
  donde: mareaviva
  acto: 1
  sin_pelear: true
  recompensa: '10 monedas y cama gratis tres noches'
  giro: 'Nadie quiere apuntarse a la Vela. Solo se ofrece Uxue Lasarte, de nueve años, que dice que la señora del agua le ha pedido que vaya.'

encargo:
  id: e-sal-1
  titulo: Los sacos sin marca
  verbo: investigar
  cadena: { id: c-sal, parte: 1, de: 3 }
  lo_pide: josune
  donde: la-salazon
  acto: 2
  sin_pelear: true
  recompensa: '12 monedas'
  giro: 'Nadie roba los sacos: los saca el capataz de noche por la compuerta y los vende en la cala. La señora Arrieta no lo sabe, o hace como que no.'

encargo:
  id: e-sal-2
  titulo: La bodega de la compuerta
  verbo: recuperar
  cadena: { id: c-sal, parte: 2, de: 3 }
  lo_pide: josune
  acto: 2
  faccion: { id: cofradia, en_contra: true }
  recompensa: '25 monedas'
  giro: 'En el libro de cuentas no solo está la sal. En la última hoja, con letra del capataz: «Dos velas negras, argollas nuevas. Para la bajamar grande. Lo paga la señora».'
  encuentro: enc-bodega

encargo:
  id: e-sal-3
  titulo: Las cuentas de la Salazón
  verbo: entregar
  cadena: { id: c-sal, parte: 3, de: 3 }
  lo_pide: martina
  donde: arenales
  acto: 2
  sin_pelear: true
  faccion: { id: arenales }
  recompensa: '30 monedas y la confianza de Arenales'
  giro: 'Con el libro, Martina puede cobrarle a la Salazón la sal que se vende en su puerto. Pero lo que más le importa es la última hoja: ahora sabe que en la bajamar grande alguien bajará al Bajo.'

encargo:
  id: e-arenales-1
  titulo: Pelea en la lonja
  verbo: calmar
  cadena: { id: c-arenales, parte: 1, de: 3 }
  lo_pide: inigo
  acto: 2
  faccion: { id: arenales }
  recompensa: '15 monedas'
  giro: 'El chico de Mareaviva que han cogido en la lonja no vino a pescar: vino a dejar flores en el cementerio de Arenales, en la tumba de un amigo.'
  encuentro: enc-lonja

encargo:
  id: e-arenales-2
  titulo: Lo que le pasó a Iker
  verbo: averiguar
  cadena: { id: c-arenales, parte: 2, de: 3 }
  lo_pide: carmen
  donde: arenales
  acto: 2
  sin_pelear: true
  recompensa: '8 monedas y un chal de punto'
  giro: 'El chico que salió a pescar con Iker hace ocho años era el pequeño de los Iturbe. Volcaron juntos: Iker se hundió y el otro nadó hasta la barca como si nada.'

encargo:
  id: e-ermita-2
  titulo: El alijo de la cripta
  verbo: recuperar
  cadena: { id: c-ermita, parte: 2, de: 3 }
  lo_pide: engracia
  acto: 2
  faccion: { id: rezadoras }
  recompensa: '20 monedas'
  giro: 'Los contrabandistas no se llevaron los exvotos para venderlos: el Gallo los quería para enseñárselos a la señora Arrieta y subirle la cuota.'
  encuentro: enc-cripta

encargo:
  id: e-ramiro
  titulo: Las notas del maestro
  verbo: buscar
  lo_pide: ramiro
  donde: mareaviva
  acto: 2
  sin_pelear: true
  recompensa: '10 monedas'
  giro: 'Las notas no se perdieron: Begoña las encontró en el cajón de la mesa el primer día de clase, y las ha leído todas. Por eso escribió al gremio.'

encargo:
  id: e-arenales-3
  titulo: El atajo del acantilado
  verbo: escoltar
  cadena: { id: c-arenales, parte: 3, de: 3 }
  lo_pide: martina
  acto: 3
  faccion: { id: arenales }
  recompensa: '30 monedas y el atajo de Arenales'
  giro: 'Arriba no espera Martina sola: espera medio Arenales, que quiere saber qué ha averiguado el gremio sobre el mar.'
  encuentro: enc-acantilado

encargo:
  id: e-ermita-3
  titulo: El nombre de Joseba
  verbo: consolar
  cadena: { id: c-ermita, parte: 3, de: 3 }
  lo_pide: pilar
  donde: embarcadero-viejo
  acto: 3
  sin_pelear: true
  faccion: { id: rezadoras }
  recompensa: 'El anillo de Joseba'
  giro: 'Pilar no quiere que Joseba deje de subir. Quiere que alguien le diga a él, en la Vela, que ella se arrepiente de haber firmado.'
```
