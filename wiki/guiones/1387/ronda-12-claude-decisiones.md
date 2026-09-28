# Ronda 12 (Claude): lo que no cuadraba, decidido

> Daniel pidió el 2026-09-28 aplicar las recomendaciones de [[DUDAS_1387]]: lo que no cuadraba
> entre textos del guion. Aquí sí cambian hechos, pero solo para que los textos digan lo mismo;
> cada bloque lleva al lado el número de la duda. Lo que se deja como estaba, y por qué, está
> en [[DUDAS_1387]].

## La historia principal

mundo:
  # 1: el paso del sur se cierra durante la partida, no antes.
  sinopsis: 'Eres un mercenario en el Valle de Vane, un rincón olvidado de la frontera, y una nevada adelantada está a punto de cerrar los pasos del sur: te vas a quedar atrapado. Aquí no hay magia, ni razas fantásticas, ni heroísmo gratis: cada día cuesta una ración, cada herida se infecta y la posada cobra los viernes. Tres facciones se despedazan por el valle: el señor de Montesclaros, Lord Vane, en su castillo; los Lobos del Bosque, en la espesura; y la Casa Keller, que baja del norte. Las tres necesitan una espada que se pueda comprar.'

hito:
  # 2 y 3: plata, y la tirada de Persuasión es para que te adelante la mitad.
  id: la-oferta-del-castillo
  pista: 'Lord Vane te ofrece plata por las cabezas de los líderes de los Lobos. Convéncele de que te adelante la mitad.'
  escena: 'Te convocan al gran salón del castillo. Dentro hace tanto frío como fuera, pero aquí se bebe vino caliente. Lord Vane está desesperado: sabe que las arcas se vacían. Pone una bolsa de plata sobre la mesa: es tuya si le traes las cabezas de los líderes de los Lobos. Si no aceptas, te recuerda que la posada es suya y que puede dejarte durmiendo en la nieve. Si quieres ver esa plata antes de jugarte el cuello, tendrás que convencerle de que te adelante la mitad.'

hito:
  # 4: la pista ya no destripa quién mete las armas; la mina sí está en el mapa.
  id: el-paso-de-los-contrabandistas
  pista: 'Ve a la mina abandonada: alguien mete armas en el valle por un túnel bajo la montaña.'
  escena: 'Un rastro de sangre que sale del peaje te lleva a un sitio del que casi nadie se acuerda: la vieja mina de hierro. Huele a carbón y a sudor frío. Alguien mete acero de contrabando en el valle para armar a los furtivos y debilitar a Lord Vane. Descubrir quién está detrás cambiará la guerra.'

hito:
  # 5: el espía está en la mina, y lo que lleva es el plano del túnel hasta las bodegas.
  id: la-nieve-manchada
  pista: 'Derrota al espía norteño en la mina: lleva el plano de un túnel que llega a las bodegas del castillo, y no debe escapar.'
  escena: 'Has arrinconado al espía norteño a la entrada de los túneles de la mina, y su sangre mancha la nieve. Jadea, con el plano de cuero apretado en el puño. Te mira, escupe sangre y te ofrece el triple de lo que te paga Vane si le dejas irse con ese plano. El oro tienta, pero las represalias de Vane pesan más. Decide rápido.'

hito:
  # 10: Karl no te encuentra «en un cruce de caminos» (se confundía con El Cruce de Caminos, que aún no existe).
  id: el-hambre-de-los-lobos
  escena: 'Llevas semanas atrapado por el hielo cuando Karl el Sordo te sale al paso en el bosque. Los Lobos del Bosque no tienen comida y esta noche bajarán a saquear los graneros del pueblo: Karl te pide que mires hacia otro lado. Si avisas al alguacil, morirán mujeres y niños en el bosque. Si callas, el pueblo pasará hambre. Tu espada decide quién come esta semana.'

hito:
  # 7: en el acto 3 ya no hay primavera que esperar.
  id: la-ultima-paga-norte
  escena: 'Lord Vane te da la última bolsa de plata que le queda, y ni siquiera es suya. Si la Capitana Keller cae, el norte se retirará del valle. Su tienda de mando está al otro lado del peaje.'

encuentro:
  # 6: en el asalto al peaje ataca Keller, y tú defiendes las empalizadas.
  id: enc-asalto-peaje
  nota: 'Derrota a todos. El ejército de Keller asalta las empalizadas del peaje, y tú las defiendes.'

## La gente

pnj:
  # 8: Darek era soldado de Vane; le colgaron los suyos.
  id: el-desertor-ahorcado
  secreto: 'Era soldado de Vane: le colgaron los suyos por robar comida, no por desertar. Sobrevivió porque la rama cedió.'

pnj:
  # 18: la pólvora viene del norte; Garret no dice de dónde.
  id: el-guardia-corrupto
  secreto: 'Se durmió en la guardia la noche que robaron la pólvora, y nadie lo sabe.'

pnj:
  # 21: la deuda de Vane, dicha entera: con Keller, y al rey tampoco le paga.
  id: el-pagador-fantasma
  sabe: 'Cuánto debe exactamente Lord Vane a la Casa Keller, y que al rey tampoco le paga.'

confidente:
  # 11: la compañera se llama Aldara en todas sus escenas (Elara es la Capitana Keller).
  # 14: la cabaña de su padre está en el bosque; la granja solo se la recuerda.
  id: elara-escarcha
  escenas:
    - rango: 2
      escena: 'Aldara te enseña a despellejar un conejo congelado. Es seca y habla poco. Te explica que el valle no es cruel, solo indiferente, y que espera que no seas otro noble estúpido que se cree inmortal.'
    - rango: 6
      escena: 'Mientras exploráis, un furtivo le hace a Aldara un corte feo. Ella se niega a parar. Tienes que obligarla a sentarse, por las buenas o por las malas, para vendarla, y enseñarle que aceptar ayuda no es ser débil.'
  al_llegar:
    la-granja-quemada: 'Así acabó la cabaña de mi padre hace diez años. Los Montesclaros no cambian.'

confidente:
  # 13: su hijo murió en el sur; no salió por el Peaje Norte.
  id: bran-el-viejo
  al_llegar:
    el-peaje-norte: 'Por un peaje como este salió mi hijo hacia el sur, y nunca volvió.'

## El mundo

objeto:
  # 19 y 12: los frascos son de Maese Ambrosio, el boticario (no del hermano Silas).
  id: viales-de-acido
  historia: 'Llevan una mezcla inestable de azufre y brea. Maese Ambrosio los usa para cegar a los cobradores de deudas.'

encargo:
  # 12: a quien hay que hacer callar en la mina es a Ambrosio, el boticario.
  id: e-silenciar-silas
  giro: 'Ambrosio te ofrece más del doble de lo que te pagan si lo escoltas fuera del valle, en vez de matarlo o asustarlo para que calle.'

encargo:
  # 17: el vigía se llama El Tuerto.
  id: e-robar-la-polvora
  giro: 'Puedes entrar a cuchillo. Pero es más fácil sobornar al Tuerto, el vigía, para que mire hacia otro lado mientras vacías los barriles en sacos.'

localidad:
  # 22: el barro se traga a quien va cargado; no es «imposible de cruzar».
  id: el-cruce-de-caminos
  descripcion: 'Aquí se juntan los caminos principales del valle. El deshielo ha convertido la tierra en un lodazal que se traga a quien va cargado. Huele a barro, a lluvia cercana y a muerte.'

## Los tableros

encargo:
  # 23: el tablero del Cruce se gana aguantando seis rondas.
  id: e-defender-el-cruce
  giro: 'Los furtivos traen la pólvora robada en una carreta encendida. Tu trabajo es aguantar seis rondas cortándoles el paso, no matarlos a todos.'

encuentro:
  # 24: el tablero pide derrotarlos a todos; sin promesa de que huyan antes.
  id: enc-los-falsos-desertores
  nota: 'Derrótalos a todos. Son granjeros que defienden leña, no soldados.'

encuentro:
  # 25: cinco rondas; las antorchas explican por qué se van.
  id: enc-asedio-a-la-granja
  nota: 'Aguanta cinco rondas dentro de la granja, abajo. Para entonces se habrán quedado sin antorchas y huirán.'
