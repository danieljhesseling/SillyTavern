ACTO 1: El Lodo
El jugador tiene que limpiar su nombre (o al menos escapar de la soga) y asegurar un techo antes de que la nieve cierre el valle por completo.

YAML
hito:
  id: el-caliz-ensangrentado
  acto: 1
  titulo: El cáliz ensangrentado
  abre: al_empezar
  pide: "ganar_tablero: habitacion-de-la-posada"
  cambia:
    revela: [el-pueblo-de-barro]
    aparece: [alguacil-torres, el-tabernero-giles]
    abre_hito: el-precio-del-escape
    reputacion: { leales-de-montesclaros: -1 }
  pista: "Alguien te ha colado el botín del asesinato. Tienes que salir de esta habitación vivo."
  escena: >
    La madera de la puerta cede con un crujido sordo. El alguacil Torres entra con la espada desenvainada y dos guardias detrás. Su mirada va de tu cara al cáliz manchado de sangre que sostienes en las manos. «Ya tenemos al asesino del recaudador», escupe. No hay tiempo para juicios. O saltas por la ventana, o te abres paso a golpes.
YAML
hito:
  id: el-precio-del-escape
  acto: 1
  titulo: El precio del escape
  abre: "tras_hito: el-caliz-ensangrentado"
  pide: "hablar_con: el-tabernero-giles"
  cambia:
    revela: [campamento-furtivo]
    aparece: [karl-el-sordo]
    abre_hito: la-pista-en-el-barro
    reputacion: {}
  pista: "Giles vio quién entró en tu cuarto anoche, pero la información cuesta dinero."
  escena: >
    Has salido vivo del cuarto, pero el pueblo entero te busca. Te has colado por la puerta trasera de la taberna. Giles está limpiando jarras. No grita al verte. Te dice que sabe quién metió el cáliz en tu petate, pero en 1387 nadie regala nada. Tienes que convencerle, o pagarle, para que te señale la dirección correcta antes de que vuelvan los guardias.
YAML
hito:
  id: la-pista-en-el-barro
  acto: 1
  titulo: La pista en el barro
  abre: "tras_hito: el-precio-del-escape"
  pide: "llegar: campamento-furtivo"
  cambia:
    revela: [el-camino-viejo]
    aparece: []
    abre_hito: el-invierno-cierra-el-paso
    reputacion: { los-lobos-del-bosque: 1 }
  pista: "El rastro del verdadero asesino lleva al campamento de los furtivos."
  escena: >
    El barro del camino viejo está congelado, pero las huellas que te vendió Giles son claras. Llegas al lindero del bosque. Una flecha se clava a un palmo de tu bota. Los Lobos del Bosque te están apuntando desde las ramas. Tienen al hombre que puso el cáliz en tu bolsa, pero consideran que ahora les pertenece a ellos.
YAML
hito:
  id: el-invierno-cierra-el-paso
  acto: 1
  titulo: El invierno cierra el paso
  abre: "tras_hito: la-pista-en-el-barro"
  pide: "entregar: el-caliz-de-vane"
  cambia:
    revela: [castillo-de-vane]
    aparece: [lord-vane]
    abre_hito: el-hambre-de-los-lobos
    reputacion: { leales-de-montesclaros: 2, los-lobos-del-bosque: -1 }
  pista: "Devolver el cáliz al señor del valle comprará tu perdón y una cama caliente."
  escena: >
    Recuperas el cáliz, pero el cielo se ha vuelto plomo. Los primeros copos de nieve caen pesados como piedras. El paso de montaña del sur acaba de quedar sepultado. Estás atrapado en el valle hasta la primavera. Llegas a las puertas del castillo de Vane con el cáliz en la mano. Los guardias abren el rastrillo. Vas a conocer al señor de este pozo.
ACTO 2: La Nieve
El invierno se asienta. El valle es una olla a presión. Hay que sobrevivir haciendo encargos, mientras las facciones piden favores que joden a las demás.

YAML
hito:
  id: el-hambre-de-los-lobos
  acto: 2
  titulo: El hambre de los Lobos
  abre: "tras_hito: el-invierno-cierra-el-paso"
  pide: "hablar_con: karl-el-sordo"
  cambia:
    revela: []
    aparece: []
    abre_hito: la-oferta-del-castillo
    reputacion: { los-lobos-del-bosque: 1, leales-de-montesclaros: -1 }
  pista: "Los campesinos se mueren de hambre en el bosque y planean asaltar los graneros del pueblo."
  escena: >
    Llevas semanas atrapado en el hielo. Karl el Sordo te encuentra en un cruce de caminos. Los Lobos del Bosque no tienen comida. Te pide que mires hacia otro lado esta noche, cuando bajen a saquear los graneros del pueblo. Si avisas al alguacil, morirán mujeres y niños en el bosque. Si te callas, el pueblo pasará hambre. Tu espada decide quién come esta semana.
YAML
hito:
  id: la-oferta-del-castillo
  acto: 2
  titulo: La oferta del castillo
  abre: "tras_hito: el-hambre-de-los-lobos"
  pide: "tirada: persuasión"
  cambia:
    revela: [el-peaje-norte]
    aparece: [capitana-keller]
    abre_hito: la-vanguardia-de-keller
    reputacion: { leales-de-montesclaros: 1 }
  pista: "Lord Vane te ofrece oro a cambio de traicionar a los líderes furtivos."
  escena: >
    Te convocan al gran salón. Hace tanto frío dentro como fuera, pero aquí beben vino caliente. Lord Vane está desesperado. Sabe que las arcas menguan. Te pone una bolsa de plata en la mesa: es tuya si le traes las cabezas de los líderes de los Lobos. Y si no aceptas, te recuerda que la posada es suya y puede dejarte durmiendo en la nieve.
YAML
hito:
  id: la-vanguardia-de-keller
  acto: 2
  titulo: La vanguardia de Keller
  abre: "tras_hito: la-oferta-del-castillo"
  pide: "ganar_tablero: el-peaje-norte"
  cambia:
    revela: [campamento-keller]
    aparece: []
    abre_hito: el-paso-de-los-contrabandistas
    reputacion: { la-casa-keller: -2, leales-de-montesclaros: 2 }
  pista: "Exploradores acorazados del norte han tomado el peaje. Vane te paga por echarlos."
  escena: >
    Ha ocurrido lo peor. La nieve no ha detenido a la Casa Keller. Su vanguardia ha cruzado las montañas del norte a pie y han masacrado a la guardia del peaje. Has sido contratado para liderar un contraataque desesperado. Cuando llegas, ves sus armaduras negras recortadas contra la nieve. Son profesionales. Y te superan en número.
YAML
hito:
  id: el-paso-de-los-contrabandistas
  acto: 2
  titulo: El paso de los contrabandistas
  abre: "tras_hito: la-vanguardia-de-keller"
  pide: "llegar: la-mina-abandonada"
  cambia:
    revela: [la-mina-abandonada]
    aparece: [el-boticario]
    abre_hito: la-nieve-manchada
    reputacion: {}
  pista: "Hay un túnel bajo la montaña que los Keller están usando para meter armas en el valle."
  escena: >
    Un rastro de sangre del peaje te lleva hasta un lugar que no está en los mapas: la vieja mina de hierro. Huele a carbón y a sudor frío. Alguien está introduciendo acero de contrabando en el valle para armar a los furtivos y desestabilizar a Lord Vane. Descubrir quién maneja las cuerdas aquí cambiará la guerra.
YAML
hito:
  id: la-nieve-manchada
  acto: 2
  titulo: La nieve manchada
  abre: "tras_hito: el-paso-de-los-contrabandistas"
  pide: "derrotar: el-espia-de-keller"
  cambia:
    revela: []
    aparece: []
    abre_hito: el-asalto-al-peaje
    reputacion: { la-casa-keller: -1 }
  pista: "Un espía norteño tiene los planos de las defensas del castillo. No debe escapar."
  escena: >
    Lo has arrinconado cerca de la linde del bosque. El espía jadea, con la bota hundida en la nieve profunda. Tiene el pergamino apretado en el puño. Te mira y escupe sangre. Te ofrece el triple de lo que te paga Vane si le dejas marchar con esos planos. El oro pesa, pero las represalias de Vane pesan más. Toca decidir rápido.
YAML
hito:
  id: el-asalto-al-peaje
  acto: 2
  titulo: El asalto al peaje
  abre: "tras_hito: la-nieve-manchada"
  pide: "ganar_tablero: barricadas-del-norte"
  cambia:
    revela: []
    aparece: []
    abre_hito: el-deshielo
    reputacion: { la-casa-keller: -3 }
  pista: "Los Keller han roto las defensas. Es una masacre a gran escala."
  escena: >
    El cielo arde, literalmente. Flechas incendiarias llueven sobre las empalizadas del norte. El ejército principal de Keller no ha esperado a la primavera; han traído rompehielos. El caos es total. Soldados corriendo envueltos en llamas, gritos en la oscuridad y tú, en medio de todo, con la espada en la mano, cubriendo la retirada o sumándote a la carnicería.
ACTO 3: La Sangre
El hielo se derrite, revelando todo lo que estaba muerto debajo. Se acabó la guerra fría. Es la hora de cobrar y decidir quién se queda el valle.

YAML
hito:
  id: el-deshielo
  acto: 3
  titulo: El deshielo
  abre: "tras_hito: el-asalto-al-peaje"
  pide: "llegar: el-pueblo-de-barro"
  cambia:
    revela: []
    aparece: []
    abre_hito: el-ultimatum
    reputacion: {}
  pista: "La nieve se ha fundido. El pueblo está inundado de barro y refugiados."
  escena: >
    El goteo del agua sobre la madera podrida marca el fin del invierno. El deshielo ha convertido los caminos en ríos de barro y sangre vieja. El pueblo es un caos de heridos y desertores. Ya nadie tiene dinero para pagarte. El momento de la verdad ha llegado: las tres facciones están a un día de marcha de aniquilarse mutuamente.
YAML
hito:
  id: el-ultimatum
  acto: 3
  titulo: El ultimátum
  abre: "tras_hito: el-deshielo"
  pide: "hablar_con: lord-vane"
  cambia:
    revela: [el-cruce-de-caminos]
    aparece: []
    abre_hito: la-ultima-paga
    reputacion: {}
  pista: "Los líderes de las tres facciones exigen saber en qué lado de la espada vas a estar."
  escena: >
    Las cartas están sobre la mesa. Lord Vane está atrincherado; Karl el Sordo prepara las antorchas; y la Capitana Keller ha plantado su estandarte negro a las afueras. Tienes emisarios de los tres buscándote. Saben que tú, el comodín de esta partida, el perro de la guerra que sobrevivió al invierno, inclinarás la balanza. Toca elegir bando. Y no hay vuelta atrás.
YAML
hito:
  id: la-ultima-paga
  acto: 3
  titulo: La última paga
  abre: "tras_hito: el-ultimatum"
  pide: "ganar_tablero: las-puertas-del-castillo"
  cambia:
    revela: []
    aparece: []
    abre_hito: null
    reputacion: {}
  pista: "El bando que has elegido asalta a sus enemigos. Cierra tu contrato con sangre."
  escena: >
    El barro te llega a los tobillos. Huele a hierro, entrañas y humo. El choque de los escudos ahoga hasta los truenos. Esta no es una escaramuza de callejón, esto es una guerra y tú estás en la primera línea cobrando tu deuda. Aprietas los dientes, levantas el acero y cargas contra la línea enemiga. Que los dioses se apiaden del que se cruce, porque tú vienes a cobrar.
Los Finales (Lo que lee el narrador al acabar la-ultima-paga)
Final A: El yugo de hierro (Alianza con La Casa Keller)
La bandera negra ondea sobre las ruinas humeantes del castillo de Vane. La Capitana Keller te tira una bolsa pesada a los pies. Hay más oro del que has visto en tu vida. A tu alrededor, los soldados de Vane cuelgan de las almenas y los campesinos son puestos a trabajar a latigazos para reconstruir el peaje. Eres rico. Sobreviviste al invierno. Pero al salir del valle, la gente aparta la mirada, aterrorizada por el mercenario que vendió su hogar.

Final B: El status quo de sangre (Alianza con Leales de Montesclaros)
Lord Vane tose sangre sobre sus ricas alfombras, pero respira. Los Keller han sido expulsados a las montañas y los Lobos masacrados en el bosque. Te entregan tu paga en un cofre de plata fina. El valle sigue siendo de los Montesclaros, aunque los campos estén yermos y no quede apenas nadie para trabajarlos. Has cumplido tu contrato como un profesional intachable. Te marchas por el paso del sur dejando atrás un cementerio gobernado por un noble endeudado.

Final C: La anarquía del barro (Alianza con Los Lobos del Bosque)
No hay reyes en el valle de Vane. Karl el Sordo y los suyos han pasado a cuchillo a los nobles y expulsado a los invasores. El castillo es ahora una ruina saqueada donde los campesinos se reparten el grano acumulado por los señores. No hay bolsa de oro para ti, solo un abrazo tosco, una armadura de buena calidad saqueada a un oficial de Keller y un caballo para cruzar el paso. Dejas atrás un lugar sin ley, libre pero hambriento, y una leyenda sobre el lobo solitario que destrozó una corona.