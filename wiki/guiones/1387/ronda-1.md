Premisa y tono
Eres un mercenario solitario (o un desertor, tú sabrás) que intentaba cruzar las montañas hacia el sur antes de que cayeran las primeras nevadas. Mala suerte: el invierno se ha adelantado a traición. Te has quedado atrapado en el Valle de Vane, una región fronteriza olvidada por los dioses, con los pasos cerrados por la nieve hasta la primavera.
Estás solo, tienes los bolsillos vacíos, la posada cobra cada viernes y el frío aprieta. El juego trata de vender tu espada al mejor postor para pagarte un techo y un plato caliente cada semana, mientras tres facciones se despedazan por controlar el valle. Sobrevivir al invierno será tu única victoria.

Lo que este mundo NO tiene
Cero magia. Ni bolas de fuego ni curaciones milagrosas. Si te rompes una pierna, te quedas cojo el resto de la campaña a menos que pagues al herrero para que te haga una prótesis.

Cero razas fantásticas. Solo humanos: campesinos muertos de hambre, bandidos desesperados y «sangre alta» (nobles que se creen intocables).

Cero heroísmo gratuito. Cada día gasta una ración. Cada herida se infecta. Si trabajas gratis por ser buenazo, el viernes acabarás durmiendo al raso y el frío te matará antes que la espada de un orco que aquí no existe.

El conflicto central
El Valle de Vane está aislado. El señor feudal local, de la Casa Montesclaros, está atrincherado en su castillo cobrando impuestos asfixiantes para financiar una guerra que no puede ganar. En el bosque, los campesinos desesperados y los desertores se han unido para saquear los caminos. Y al norte del valle, la Casa Keller avanza implacable para tomar la región antes del deshielo. Tú eres una anomalía: una espada profesional sin ataduras en un tablero donde todos necesitan mercenarios.

Las Facciones
YAML
faccion:
  id: leales-de-montesclaros
  nombre: Leales de Montesclaros
  sede: castillo-de-vane
  controla: [castillo-de-vane, el-pueblo-de-barro]
  enemigos: [la-casa-keller, los-lobos-del-bosque]
  meta: { tipo: aguantar, objetivo: el-pueblo-de-barro, ritmo_dias: 21 } 
  si_la_cumple: "El señor de Montesclaros impone la ley marcial. Confisca toda la comida del valle para su castillo, condenando a todos los demás a morir de inanición."
  reputacion_inicial: 0

faccion:
  id: los-lobos-del-bosque
  nombre: Los Lobos del Bosque
  sede: campamento-furtivo
  controla: [campamento-furtivo, el-camino-viejo]
  enemigos: [leales-de-montesclaros, la-casa-keller]
  meta: { tipo: destruir, objetivo: castillo-de-vane, ritmo_dias: 14 }
  si_la_cumple: "Asaltan el castillo y matan al señor. El valle cae en la anarquía absoluta, sin ley, donde el más fuerte roba lo poco que queda."
  reputacion_inicial: 0

faccion:
  id: la-casa-keller
  nombre: La Casa Keller
  sede: campamento-keller
  controla: [campamento-keller, el-peaje-norte]
  enemigos: [leales-de-montesclaros, los-lobos-del-bosque]
  meta: { tipo: conquistar, objetivo: el-pueblo-de-barro, ritmo_dias: 28 }
  si_la_cumple: "Los Keller arrasan el pueblo para dar un escarmiento y cuelgan de los árboles a todo aquel que no jure lealtad."
  reputacion_inicial: -1
La Mecha
El juego empieza el viernes por la mañana. Te acabas de despertar en la habitación más barata de la posada de El Pueblo de Barro. Hoy toca pagar la semana por adelantado y no tienes un duro.

Te pones las botas y notas algo raro dentro de tu petate. Lo abres y encuentras un cáliz de oro macizo cubierto de sangre seca. No es tuyo. Alguien te lo ha metido ahí mientras dormías.
De repente, escuchas gritos abajo. El alguacil del pueblo y tres guardias están pateando la puerta de la posada. Buscan al forastero que ha asesinado al recaudador de Montesclaros esta misma noche. Se oyen pasos pesados subiendo las escaleras hacia tu cuarto. Quedan diez segundos para que echen tu puerta abajo. Tienes el botín del asesinato en las manos y la espada envainada.