¡Por todos los dados cargados de la taberna! Me pongo la bufanda y saco el tintero, que vamos a trazar la geografía de nuestro valle helado.

En 1387, el mapa no es tu amigo. Aquí viajar cuesta tiempo, el tiempo quema comida, y la comida cuesta plata que no tienes. He diseñado el valle de Vane como un cuello de botella. Las distancias no son enormes (1 o 2 días), pero lo suficiente para que ir a comprar vendas te cueste el almuerzo de mañana.

Aquí tienes las 11 localidades (7 visibles desde el principio y 4 escondidas que se irán abriendo).

Las Localidades Visibles
YAML
localidad:
  id: el-pueblo-de-barro
  nombre: El Pueblo de Barro
  tipo: village
  bioma: costa # (En 1387 es valle nevado/barro, uso el equivalente mecánico rural)
  escondida: false
  faccion: leales-de-montesclaros
  descripcion: "Un amasijo de cabañas de madera podrida hundiéndose en la nieve negra y el fango. Huele a humo de turba, a sudor rancio y a coles hervidas."
  caminos:
    - { a: el-camino-viejo, dias: 1 }
    - { a: castillo-de-vane, dias: 1 }
    - { a: la-granja-quemada, dias: 1 }
    - { a: el-cruce-de-caminos, dias: 1, cerrado_hasta: el-ultimatum }
  servicios: [posada, herreria, tienda, tablon]
  pnj: [el-tabernero-giles, alguacil-torres, el-herrero-dunstan]
  tableros: [habitacion-de-la-posada, callejon-del-barro]
YAML
localidad:
  id: castillo-de-vane
  nombre: Castillo de Vane
  tipo: city
  bioma: urbano
  escondida: false
  faccion: leales-de-montesclaros
  descripcion: "Una mole de piedra gris mal mantenida, con estandartes rasgados por el viento gélido. Huele a leña de pino quemada y a la sangre seca del patíbulo."
  caminos:
    - { a: el-pueblo-de-barro, dias: 1 }
    - { a: el-peaje-norte, dias: 2 }
    - { a: la-ermita-derruida, dias: 1 }
    - { a: el-cruce-de-caminos, dias: 1, cerrado_hasta: el-ultimatum }
  servicios: [tienda, templo]
  pnj: [lord-vane, el-pagador-fantasma]
  tableros: [las-puertas-del-castillo, el-gran-salon]
YAML
localidad:
  id: el-peaje-norte
  nombre: El Peaje Norte
  tipo: outpost
  bioma: montaña
  escondida: false
  faccion: leales-de-montesclaros
  descripcion: "Dos torres de vigilancia de madera a medio pudrir bloqueando el desfiladero que da al norte. Huele a hierro oxidado, a miedo y a viento cortante."
  caminos:
    - { a: castillo-de-vane, dias: 2 }
    - { a: el-lago-helado, dias: 1 }
    - { a: campamento-keller, dias: 1, cerrado_hasta: la-vanguardia-de-keller }
    - { a: la-mina-abandonada, dias: 2, cerrado_hasta: el-paso-de-los-contrabandistas }
  servicios: [tablon]
  pnj: [el-vigia-tuerto]
  tableros: [el-peaje-norte, barricadas-del-norte]
YAML
localidad:
  id: el-camino-viejo
  nombre: El Camino Viejo
  tipo: wilderness
  bioma: bosque
  escondida: false
  faccion: los-lobos-del-bosque
  descripcion: "Una antigua calzada imperial devorada por los pinos y cubierta por un palmo de nieve virgen. Huele a resina, a humedad profunda y al aliento de los lobos."
  caminos:
    - { a: el-pueblo-de-barro, dias: 1 }
    - { a: campamento-furtivo, dias: 1, cerrado_hasta: el-precio-del-escape }
  servicios: []
  pnj: []
  tableros: [emboscada-en-el-bosque]
YAML
localidad:
  id: la-ermita-derruida
  nombre: La Ermita Derruida
  tipo: sanctuary
  bioma: montaña
  escondida: false
  faccion: null
  descripcion: "Cuatro paredes de piedra sin techo donde un monje medio loco cose a los moribundos. Huele a alcohol de quemar, a hierbas amargas y a carne cauterizada."
  caminos:
    - { a: castillo-de-vane, dias: 1 }
    - { a: el-lago-helado, dias: 1 }
  servicios: [templo]
  pnj: [el-monje-cirujano]
  tableros: [el-patio-de-la-ermita]
YAML
localidad:
  id: la-granja-quemada
  nombre: La Granja Quemada
  tipo: ruins
  bioma: rural
  escondida: false
  faccion: null
  descripcion: "Los esqueletos carbonizados de un granero y una casa, sobresaliendo como huesos negros en la nieve. Huele a ceniza fría y a cadáveres que nadie ha enterrado."
  caminos:
    - { a: el-pueblo-de-barro, dias: 1 }
    - { a: la-mina-abandonada, dias: 2, cerrado_hasta: el-paso-de-los-contrabandistas }
  servicios: []
  pnj: [la-viuda-hambrienta]
  tableros: [los-campos-yermos]
YAML
localidad:
  id: el-lago-helado
  nombre: El Lago Helado
  tipo: wilderness
  bioma: hielo
  escondida: false
  faccion: null
  descripcion: "Una inmensa llanura de hielo grisáceo que cruje con cada paso pesado. Huele a escarcha pura y a pescado podrido en las orillas."
  caminos:
    - { a: el-peaje-norte, dias: 1 }
    - { a: la-ermita-derruida, dias: 1 }
  servicios: []
  pnj: [el-pescador-loco]
  tableros: [el-hielo-quebradisimo]
Las Localidades Escondidas
(El motor las mantendrá ocultas en el mapa hasta que sus respectivos hitos o rumores levanten la bandera).

YAML
localidad:
  id: campamento-furtivo
  nombre: Campamento Furtivo
  tipo: camp
  bioma: bosque
  escondida: true
  faccion: los-lobos-del-bosque
  descripcion: "Un laberinto de tiendas hechas con pieles y ramas, escondido en la espesura más densa del bosque. Huele a carne asada, a humedad y a acero afilado con piedra."
  caminos:
    - { a: el-camino-viejo, dias: 1 }
    - { a: el-cruce-de-caminos, dias: 1, cerrado_hasta: el-ultimatum }
  servicios: [tienda, tablon]
  pnj: [karl-el-sordo, la-cazadora-nils]
  tableros: [el-fuego-del-campamento]
YAML
localidad:
  id: campamento-keller
  nombre: Campamento Keller
  tipo: camp
  bioma: montaña
  escondida: true
  faccion: la-casa-keller
  descripcion: "Líneas perfectas de tiendas negras y estacas afiladas, un campamento militar de libro plantado en el hielo. Huele a aceite de armas, a caballos y a disciplina militar."
  caminos:
    - { a: el-peaje-norte, dias: 1 }
  servicios: [herreria, tienda]
  pnj: [capitana-keller, el-intendente-norteño]
  tableros: [tienda-de-mando-keller]
YAML
localidad:
  id: la-mina-abandonada
  nombre: La Mina Abandonada
  tipo: dungeon
  bioma: cueva
  escondida: true
  faccion: la-casa-keller
  descripcion: "Una herida negra en el costado de la montaña, apuntalada con vigas que están a punto de ceder. Huele a carbón, a azufre y al sudor de los contrabandistas."
  caminos:
    - { a: la-granja-quemada, dias: 2 }
    - { a: el-peaje-norte, dias: 2 }
  servicios: []
  pnj: [el-boticario, el-espia-de-keller]
  tableros: [galeria-de-contrabando]
YAML
localidad:
  id: el-cruce-de-caminos
  nombre: El Cruce de Caminos
  tipo: ruins
  bioma: rural
  escondida: true
  faccion: null
  descripcion: "Donde convergen los caminos principales del valle, el deshielo ha convertido la tierra en un lago de fango infranqueable. Huele a barro, a lluvia inminente y a muerte."
  caminos:
    - { a: el-pueblo-de-barro, dias: 1 }
    - { a: castillo-de-vane, dias: 1 }
    - { a: campamento-furtivo, dias: 1 }
  servicios: []
  pnj: []
  tableros: [el-barrizal-final]