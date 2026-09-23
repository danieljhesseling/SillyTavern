Cadena 1: El Acero Robado
Dunstan necesita buen metal, pero en este valle nada es gratis.

YAML
encargo:
  id: e-acero-robado-1
  titulo: El carro desaparecido
  verbo: investigar
  cadena: { id: c-acero-robado, parte: 1, de: 3 }
  lo_pide: el-herrero-dunstan
  faccion: null
  donde: el-pueblo-de-barro
  acto: 1
  sin_pelear: true
  recompensa: "15 monedas de plata y un afilado gratis"
  giro: "Nadie asaltó el carro. El carretero vendió el hierro a los furtivos y fingió el robo."
  encuentro: null
YAML
encargo:
  id: e-acero-robado-2
  titulo: Recuperar la carga
  verbo: recuperar
  cadena: { id: c-acero-robado, parte: 2, de: 3 }
  lo_pide: el-herrero-dunstan
  faccion: { id: los-lobos-del-bosque, en_contra: true }
  donde: el-camino-viejo
  acto: 1
  sin_pelear: false
  recompensa: "30 monedas de plata"
  giro: "Los lobos ya han fundido parte del hierro, los lingotes pesan el doble por el hielo."
  encuentro: enc-emboscada-por-el-hierro
YAML
encargo:
  id: e-acero-robado-3
  titulo: Doble juego
  verbo: entregar
  cadena: { id: c-acero-robado, parte: 3, de: 3 }
  lo_pide: karl-el-sordo
  faccion: { id: leales-de-montesclaros, en_contra: true }
  donde: campamento-furtivo
  acto: 2
  sin_pelear: true
  recompensa: "Cota de mallas abollada (armadura media) y favor de los Lobos"
  giro: "Karl te paga más que Dunstan para que lleves armas forjadas de contrabando al pueblo saltándote el control de Vane."
  encuentro: null
Trabajos sueltos (I)
YAML
encargo:
  id: e-desertores-granja
  titulo: Limpiar la escoria
  verbo: cazar
  cadena: null
  lo_pide: alguacil-torres
  faccion: { id: leales-de-montesclaros, en_contra: false }
  donde: la-granja-quemada
  acto: 1
  sin_pelear: false
  recompensa: "20 monedas de plata, si traes sus orejas"
  giro: "Los 'desertores' no son soldados, son campesinos armados con horcas que solo querían leña de la granja."
  encuentro: enc-los-falsos-desertores
YAML
encargo:
  id: e-deudas-de-juego
  titulo: El pagador moroso
  verbo: negociar
  cadena: null
  lo_pide: el-tabernero-giles
  faccion: null
  donde: castillo-de-vane
  acto: 1
  sin_pelear: true
  recompensa: "Giles te perdona la cuenta de la posada de esta semana"
  giro: "El guardia corrupto del castillo es quien debe el dinero, y te ofrece un pase rápido por la puerta trasera a cambio de que le mientas a Giles."
  encuentro: null
YAML
encargo:
  id: e-escolta-medica
  titulo: Sangre en el hielo
  verbo: escoltar
  cadena: null
  lo_pide: el-monje-cirujano
  faccion: null
  donde: el-lago-helado
  acto: 2
  sin_pelear: false
  recompensa: "El monje te curará dos heridas graves gratis"
  giro: "A mitad del lago el hielo cede, atrayendo a carroñeros ahogados. Hay que proteger al monje mientras el hielo cruje."
  encuentro: enc-escolta-quebradiza
YAML
encargo:
  id: e-provisiones-podridas
  titulo: Sabotaje en las tripas
  verbo: robar
  cadena: null
  lo_pide: el-intendente-norteño
  faccion: { id: la-casa-keller, en_contra: false }
  donde: castillo-de-vane
  acto: 2
  sin_pelear: true
  recompensa: "50 monedas de plata (mucho dinero)"
  giro: "No te pide que robes la comida, sino que robes los gatos del castillo para que las ratas arruinen el grano de Vane desde dentro."
  encuentro: null
Cadena 2: El Boticario Envenenador
Silas juega a dos bandas, y eso en la guerra se paga caro.

YAML
encargo:
  id: e-hierbas-congeladas
  titulo: Remedios bajo cero
  verbo: recuperar
  cadena: { id: c-el-boticario, parte: 1, de: 2 }
  lo_pide: el-boticario
  faccion: null
  donde: el-lago-helado
  acto: 2
  sin_pelear: false
  recompensa: "10 ungüentos coagulantes (consumibles)"
  giro: "Las hierbas están en una carreta hundida, pero unos bandidos la están usando como cobertura para una emboscada."
  encuentro: enc-carreta-en-el-hielo
YAML
encargo:
  id: e-silenciar-silas
  titulo: Cortar la lengua
  verbo: silenciar
  cadena: { id: c-el-boticario, parte: 2, de: 2 }
  lo_pide: el-pagador-fantasma
  faccion: { id: leales-de-montesclaros, en_contra: false }
  donde: la-mina-abandonada
  acto: 2
  sin_pelear: true
  recompensa: "60 monedas de plata"
  giro: "Silas te ofrece más del doble de dinero si lo escoltas fuera del mapa en lugar de matarlo o intimidarlo para que calle."
  encuentro: null
Trabajos sueltos (II)
YAML
encargo:
  id: e-lobos-hambrientos
  titulo: Noche en la granja
  verbo: aguantar
  cadena: null
  lo_pide: la-viuda-hambrienta
  faccion: null
  donde: la-granja-quemada
  acto: 2
  sin_pelear: false
  recompensa: "El cofre de plata antigua de su difunto marido"
  giro: "No vienen lobos salvajes, vienen saqueadores de Keller hambrientos. Tienes que aguantar 5 rondas defendiendo la puerta hasta que se rindan."
  encuentro: enc-asedio-a-la-granja
YAML
encargo:
  id: e-mensajes-interceptados
  titulo: Papeles al fuego
  verbo: investigar
  cadena: null
  lo_pide: capitana-keller
  faccion: { id: leales-de-montesclaros, en_contra: true }
  donde: el-camino-viejo
  acto: 2
  sin_pelear: true
  recompensa: "Salvoconducto de la Casa Keller"
  giro: "Los mensajes interceptados no son órdenes militares, son cartas de amor entre la cazadora Nils y un guardia del castillo."
  encuentro: null
Cadena 3: La Pólvora de Keller
Si hay explosivos en 1387, alguien tiene que encender la mecha.

YAML
encargo:
  id: e-fuego-en-la-nieve
  titulo: Purgar los alrededores
  verbo: limpiar
  cadena: { id: c-polvora, parte: 1, de: 3 }
  lo_pide: la-forjadora-hilda
  faccion: { id: la-casa-keller, en_contra: false }
  donde: campamento-keller
  acto: 2
  sin_pelear: false
  recompensa: "Una espada ancha forjada a medida (arma)"
  giro: "Tienes que limpiar la zona exterior de patrullas de los Lobos del Bosque que están marcando objetivos para los arqueros."
  encuentro: enc-patrullas-en-la-nieve
YAML
encargo:
  id: e-robar-la-polvora
  titulo: El oro negro
  verbo: robar
  cadena: { id: c-polvora, parte: 2, de: 3 }
  lo_pide: karl-el-sordo
  faccion: { id: la-casa-keller, en_contra: true }
  donde: el-peaje-norte
  acto: 3
  sin_pelear: true
  recompensa: "50 monedas de plata y un barril de pólvora pequeño para ti"
  giro: "Puedes entrar a cuchillo, pero es más fácil sobornar al Vigía Tuerto para que mire a otro lado mientras vacías los barriles en sacos."
  encuentro: null
YAML
encargo:
  id: e-defender-el-cruce
  titulo: Que no pase la carreta
  verbo: aguantar
  cadena: { id: c-polvora, parte: 3, de: 3 }
  lo_pide: lord-vane
  faccion: { id: los-lobos-del-bosque, en_contra: true }
  donde: el-cruce-de-caminos
  acto: 3
  sin_pelear: false
  recompensa: "Título nobiliario sin tierras y 100 de plata"
  giro: "Los furtivos traen la pólvora robada en una carreta encendida. Tienes que destruir la carreta antes de que cruce el mapa, no matar a los asaltantes."
  encuentro: enc-frenar-la-carreta
Trabajos sueltos (III)
YAML
encargo:
  id: e-el-anillo-del-desertor
  titulo: Petición de un ahorcado
  verbo: recuperar
  cadena: null
  lo_pide: el-desertor-ahorcado
  faccion: null
  donde: el-pueblo-de-barro
  acto: 1
  sin_pelear: true
  recompensa: "El ahorcado te cuenta un atajo secreto en el Camino Viejo"
  giro: "El enterrador Yorick tiene el anillo. Te lo dará si le consigues un cadáver fresco o le pagas el equivalente en oro."
  encuentro: null