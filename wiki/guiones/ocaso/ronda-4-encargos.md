# Las tierras del ocaso — ronda 4: los encargos, los rumores y lo que se corrige

> Escrita por Claude (tanda 20, 2026-10-03). Quince encargos (ocho con pelea y siete que se resuelven hablando, en tres cadenas), veintiocho rumores y las correcciones de las rondas de antes.

## Lo que se corrige de la ronda 3

- **La esclusa**: el muelle de arriba quedaba aislado por el agua y las barricadas. Ahora se baja a él por la orilla de la izquierda.
- **El cementerio**: la casilla de detrás del cofre de la cripta no se alcanzaba. El cofre va al fondo.
- **Dos nombres de pelea** coincidían con su localización («La Boca del Grajo», «La Atalaya de la Grulla»). En el botón de «Ir a…» no se sabía si era el sitio o la pelea: ahora son «Los tótems de la mina» y «El fanal de la Atalaya».
- **El oso** se pelea en la ladera de las Hayas Rojas, no en las Sendas: así su encargo se puede aceptar antes de que las Sendas salgan en el mapa.

tablero:
  id: t-esclusa
  mapa:
    - "####################"
    - "#WWWWWWWWWWWWWWWWWW#"
    - "#WW...........WWWWW#"
    - "#...=vvvvvvvv=.....#"
    - "#...vvvvvvvvvv..c..#"
    - "#..c............T..#"
    - "#...vvvvvvvvvv.....#"
    - "#...=vvvvvvvv=..C..#"
    - "#..................#"
    - "#.T....c.....T.....#"
    - "####################"

tablero:
  id: t-cementerio
  mapa:
    - "##################"
    - "#..C..C..C..C....#"
    - "#................#"
    - "#..C..C..C..C..b.#"
    - "#...........######"
    - "#..b....c...D...k#"
    - "#...........######"
    - "#.C..C..C........#"
    - "#................#"
    - "##################"

tablero:
  id: t-sendas
  localidad: las-hayas-rojas

encuentro:
  id: enc-grajo
  nombre: Los tótems de la mina

encuentro:
  id: enc-atalaya
  nombre: El fanal de la Atalaya

encuentro:
  id: enc-oso
  nombre: El oso de las Hayas
  nota: Encargo de la guardiana de las Hayas Rojas. El oso y dos huargos se pelean por la ladera, junto al barranco donde empiezan las Sendas.

## El campamento del Cierzo tiene a alguien con quien hablar

Una cocinera del Cierzo que cobra de los suyos y vende a los demás lo que oye en el perol.

pnj:
  id: mencia
  nombre: Mencía Tostado
  oficio: Cocinera del Cierzo
  donde: campamento-del-cierzo
  quiere: Cobrar los tres meses que le debe el Cierzo y bajar al llano antes de la nieve.
  sabe: Qué come cada oficial y en qué tienda duerme, y que la sargento y el capitán no se hablan desde el verano.
  secreto: Echa a perder la carne del capitán a propósito desde que la dejó sin paga.
  voz: "Harta y deslenguada. Todo lo mide en raciones de perol: «Eso vale dos cazos»."
  paquete:
    gender: Mujer
    aspecto: Mujer de unos cuarenta y cinco, ancha y colorada, brazos fuertes, mandil grasiento sobre una capa gris del Cierzo y un cucharón de hierro colgado del cinto.

## Los sitios del pueblo que faltaban

Vadoancho y el refugio tienen tablón: se pone en su lista de sitios.

localidad:
  id: vadoancho
  paquete:
    places:
      - { kind: muelle, name: El muelle de la sal, keeper: Lupe Garbanzo }
      - { kind: tienda, name: La casa de préstamos, keeper: Marcos Fullero }
      - { kind: templo, name: El templo de la Ribera, keeper: Madre Orosia }
      - { kind: posada, name: El Sollo }
      - { kind: tablon }
      - { kind: plaza, name: La plaza de Oramar }

localidad:
  id: refugio-de-la-cabra
  paquete:
    places:
      - { kind: posada, name: El refugio, keeper: Nieves Albar }
      - { kind: tablon }
      - { kind: plaza, name: Los campamentos de las casas }

localidad:
  id: campamento-del-cierzo
  paquete:
    places:
      - { kind: posada, name: El perol del Cierzo, keeper: Mencía Tostado }
      - { kind: plaza, name: El patio de las tiendas }

## Los encargos

Los de pelea se juegan en su tablero; los que no, se resuelven allí, hablando. Las tres cadenas: la del grano de Los Sauces (tres partes), la de la sal de Vadoancho (dos) y la del robledal de Torre Brezo (dos).

### Acto 1

encargo:
  id: e-molino
  titulo: Los ladrones del molino
  verbo: limpiar
  cadena: { id: c-sauces, parte: 1, de: 3 }
  lo_pide: herminia
  acto: 1
  recompensa: 20 sueldos y un saco de harina
  giro: Los ladrones no son bandidos. Son de Los Brezales, la aldea que ardió, y el que los manda fue soldado de la torre.
  encuentro: enc-molino

encargo:
  id: e-grano
  titulo: El grano escondido
  verbo: negociar
  cadena: { id: c-sauces, parte: 2, de: 3 }
  lo_pide: herminia
  faccion: { id: casa-brezo, en_contra: true }
  donde: los-sauces
  acto: 1
  sin_pelear: true
  recompensa: 25 sueldos
  giro: El recaudador de Brezo no viene a contar sacos. Viene a por el tercio escondido en el molino, porque alguien de la aldea se lo ha contado.

encargo:
  id: e-clavos
  titulo: Los clavos del puente
  verbo: negociar
  lo_pide: ottar
  donde: tres-mojones
  acto: 1
  sin_pelear: true
  recompensa: 15 sueldos y un afilado gratis
  giro: El dinero para los clavos lo mandó Oramar hace un año, y se quedó por el camino en la casa de préstamos de Fullero.

encargo:
  id: e-mojon
  titulo: El mojón caído
  verbo: negociar
  lo_pide: damaso
  donde: la-calzada-rota
  acto: 1
  sin_pelear: true
  recompensa: 15 sueldos
  giro: Las tres casas sí mandaron piedra para el terraplén. Toda esa piedra la compró el Cierzo para su empalizada.

### Acto 2

encargo:
  id: e-carros
  titulo: Los carros de Los Sauces
  verbo: escoltar
  cadena: { id: c-sauces, parte: 3, de: 3 }
  lo_pide: herminia
  faccion: { id: casa-oramar, en_contra: false }
  acto: 2
  recompensa: 35 sueldos
  giro: Los que esperan en el tramo roto son más gente de Los Brezales, con hambre. El desertor que los manda sirvió con Ruy Zarzal.
  encuentro: enc-calzada-sal

encargo:
  id: e-sal
  titulo: La sal del paso
  verbo: investigar
  cadena: { id: c-sal, parte: 1, de: 2 }
  lo_pide: lupe
  donde: vadoancho
  acto: 2
  sin_pelear: true
  recompensa: 20 sueldos
  giro: La sal que pasa sin peaje por la esclusa no se vende en Vadoancho. Va montaña arriba, para pagar a los trasgos de la mina del Grajo.

encargo:
  id: e-esclusa
  titulo: Los contrabandistas de la esclusa
  verbo: silenciar
  cadena: { id: c-sal, parte: 2, de: 2 }
  lo_pide: lupe
  faccion: { id: casa-oramar, en_contra: false }
  acto: 2
  recompensa: 30 sueldos
  giro: El patrón de la esclusa lleva un salvoconducto firmado por la capitana de Oramar. Alguien en Oramar cobra por mirar a otro lado.
  encuentro: enc-esclusa

encargo:
  id: e-pan
  titulo: Pan para la Ribera
  verbo: entregar
  lo_pide: orosia
  donde: vadoancho
  acto: 2
  sin_pelear: true
  recompensa: 10 sueldos y la bendición del templo
  giro: El grano para los huérfanos ya está en Vadoancho, en los barcos de Oramar que no salen. Don Tristán lo suelta si se lo pide alguien que le caiga en gracia.

encargo:
  id: e-huargos
  titulo: Los huargos del robledal
  verbo: cazar
  cadena: { id: c-robledal, parte: 1, de: 2 }
  lo_pide: elvira
  acto: 2
  recompensa: 25 sueldos y un queso de oveja
  giro: Alguien deja carne en el robledal para que la manada baje. La carne lleva la marca gris del Cierzo.
  encuentro: enc-huargos

encargo:
  id: e-desertores
  titulo: Los desertores del robledal
  verbo: limpiar
  cadena: { id: c-robledal, parte: 2, de: 2 }
  lo_pide: ordono
  faccion: { id: casa-brezo, en_contra: false }
  acto: 2
  recompensa: 30 sueldos
  giro: Los desertores son la escuadra del sargento Zarzal. No huyeron por cobardes; se fueron la noche que ardió Los Brezales.
  encuentro: enc-desertores

### Acto 3

encargo:
  id: e-oso
  titulo: El oso de las Hayas
  verbo: limpiar
  lo_pide: maelis
  acto: 3
  recompensa: 25 sueldos y un talismán de haya
  giro: El oso no baja por hambre. Lo han echado de su cueva unos hombres con botas de soldado que buscaban el comienzo de las Sendas.
  encuentro: enc-oso

encargo:
  id: e-refugio
  titulo: Una noche en el refugio
  verbo: aguantar
  lo_pide: nieves
  acto: 3
  recompensa: 30 sueldos y cama gratis hasta el deshielo
  giro: Los huargos llevan collares grises. El Cierzo los suelta de noche para que las vanguardias de las casas no duerman.
  encuentro: enc-refugio

encargo:
  id: e-cementerio
  titulo: Los saqueadores del cementerio
  verbo: silenciar
  lo_pide: odon
  acto: 3
  recompensa: 25 sueldos y hierbas de la ermita
  giro: El comprador que espera el cuerno es el capitán del Cierzo. Quiere tocarlo en la Atalaya para que los enanos crean que ha vuelto su thane.
  encuentro: enc-ermita

encargo:
  id: e-clausula
  titulo: La cláusula catorce
  verbo: investigar
  lo_pide: ulfo
  faccion: { id: casa-hondaroca, en_contra: false }
  donde: ermita-del-collado
  acto: 3
  sin_pelear: true
  recompensa: 20 sueldos y un lingote de Hondaroca
  giro: En los libros de la ermita hay una copia vieja de la Carta. Su cláusula catorce dice que si nadie enciende el fanal antes de la nieve, el paso queda abierto para todos. En la copia de Oramar, esa línea está raspada.

encargo:
  id: e-mulas
  titulo: Las mulas de Ramiro
  verbo: recuperar
  lo_pide: ramiro
  donde: refugio-de-la-cabra
  acto: 3
  sin_pelear: true
  recompensa: 15 sueldos y una mula para el camino
  giro: El pagaré del Cierzo se cobra en Vadoancho, en la casa de Fullero. Pero Ramiro no quiere dinero. Quiere sus doce mulas, que están en el corral de la capitana de Oramar.

## Los rumores

Lo que se oye en cada sitio. Tres llevan a sitios escondidos: el campamento del Cierzo (lo cuenta el caminero de la calzada), la mina del Grajo (lo cuenta el archivero en las Forjas) y las Sendas Viejas (lo cuenta la guardiana de las Hayas a quien le pregunta).

rumor:
  id: r-monedas-nuevas
  dicho_por: brigida
  donde: tres-mojones
  texto: Los tres que durmieron aquí antes de que cayera el puente pagaron con monedas recién acuñadas en Vadoancho. Aquí nadie tiene monedas nuevas.
  verdad: si

rumor:
  id: r-barca-lejos
  dicho_por: cualquiera
  donde: tres-mojones
  texto: La noche que serraron el puente, el barquero tenía la barca amarrada río abajo. Él nunca la deja tan lejos.
  verdad: si

rumor:
  id: r-sierras-grises
  dicho_por: pascual
  donde: los-sauces
  texto: Unos de capa gris compraron todas las sierras de dos manos de la aldea, y pagaron sin regatear.
  verdad: si

rumor:
  id: r-tercio-escondido
  dicho_por: cualquiera
  donde: los-sauces
  texto: La alcaldesa dice que hay doscientos sacos. En el molino hay por lo menos cien más, tapados con paja.
  verdad: si

rumor:
  id: r-campamento
  dicho_por: damaso
  donde: la-calzada-rota
  texto: Los carros del Cierzo suben de noche por la calzada y siguen hasta debajo del collado de la ermita. Allí tienen una empalizada con veinte hogueras.
  verdad: si
  lleva_a: campamento-del-cierzo

rumor:
  id: r-piedra-vendida
  dicho_por: cualquiera
  donde: la-calzada-rota
  texto: La piedra para arreglar el terraplén llegó en primavera. Se la llevaron en carros grises antes de que se descargara.
  verdad: si

rumor:
  id: r-deudas-brezo
  dicho_por: fullero
  donde: vadoancho
  texto: Casa Brezo debe hasta las rejas de su torre. Y todas esas deudas las tiene ya Don Tristán en un cofre.
  verdad: si

rumor:
  id: r-barcos-quietos
  dicho_por: lupe
  donde: vadoancho
  texto: Los seis barcos de Oramar no salen porque esperan a ver quién gana el paso. Así pondrán el precio del grano con la nieve encima.
  verdad: si

rumor:
  id: r-oramar-cierzo
  dicho_por: cualquiera
  donde: vadoancho
  texto: El capitán del Cierzo cenó en la casa de Oramar en verano. Salió con una bolsa que no llevaba al entrar.
  verdad: si

rumor:
  id: r-huerfanos
  dicho_por: orosia
  donde: vadoancho
  texto: La última guerra de las casas dejó cuarenta huérfanos en la Ribera. Si este invierno no hay grano, serán el doble.
  verdad: si

rumor:
  id: r-brezales
  dicho_por: elvira
  donde: torre-brezo
  texto: Los Brezales no ardió por un rayo. Yo vi las antorchas desde el monte, y eran de la torre.
  verdad: si

rumor:
  id: r-media-racion
  dicho_por: ordono
  donde: torre-brezo
  texto: En la torre comemos media ración desde agosto. Si el paso lo cierra otro, en enero no comemos.
  verdad: si

rumor:
  id: r-zarzal-muerto
  dicho_por: cualquiera
  donde: torre-brezo
  texto: Al sargento Zarzal lo colgaron en el robledal por cobarde. Eso dicen en la torre.
  verdad: "no"

rumor:
  id: r-hojas-rojas
  dicho_por: cualquiera
  donde: las-hayas-rojas
  texto: Las hayas se han puesto rojas un mes antes. Los elfos dicen que la última vez que pasó, el invierno duró hasta mayo.
  verdad: si

rumor:
  id: r-sendas
  dicho_por: maelis
  texto: Las Sendas Viejas empiezan detrás del barranco de las Hayas. Suben al paso en dos días, si sabes leer las piedras.
  verdad: si
  lleva_a: las-sendas-viejas

rumor:
  id: r-mapa-vendido
  dicho_por: caelan
  donde: las-sendas-viejas
  texto: Alguien de las Hayas vendió una copia del mapa de las Sendas al Cierzo. Por eso suben más rápido que las casas.
  verdad: si

rumor:
  id: r-grajo
  dicho_por: ulfo
  donde: forjas-de-hondaroca
  texto: Los trasgos salen de la Boca del Grajo, la mina vieja del clan. Se baja por el túnel de los guardias, detrás de la forja grande.
  verdad: si
  lleva_a: boca-del-grajo

rumor:
  id: r-oro-de-oramar
  dicho_por: cualquiera
  donde: forjas-de-hondaroca
  texto: La thane ha recibido oro de Oramar este otoño. Nadie sabe a cambio de qué, pero en la sala del consejo no se habla de otra cosa.
  verdad: si

rumor:
  id: r-sal-trasgos
  dicho_por: berta
  donde: boca-del-grajo
  texto: Los trasgos de la mina no cobran en plata. Cobran en sal, y la sal se la sube el Cierzo.
  verdad: si

rumor:
  id: r-hielo-conjuro
  dicho_por: cualquiera
  donde: boca-del-grajo
  texto: El hielo de las paredes de la mina crece un palmo cada noche. Eso no lo hace el frío; lo hace alguien.
  verdad: si

rumor:
  id: r-tumba-removida
  dicho_por: odon
  donde: ermita-del-collado
  texto: Alguien ha cavado de noche en la tumba del último thane de la Atalaya. Buscaban su cuerno de guerra.
  verdad: si

rumor:
  id: r-peajes
  dicho_por: cualquiera
  donde: ermita-del-collado
  texto: Hace sesenta años, en el paso pagaban lo mismo Brezo, Oramar y los enanos. Lo dicen los libros de la ermita.
  verdad: si

rumor:
  id: r-tuerta
  dicho_por: mencia
  donde: campamento-del-cierzo
  texto: La sargento y el capitán no se hablan desde el verano. Él la dejó atrás en una pelea y le costó el ojo.
  verdad: si

rumor:
  id: r-sin-paga
  dicho_por: cualquiera
  donde: campamento-del-cierzo
  texto: El Cierzo lleva tres meses sin pagar a los suyos. Dicen que el capitán cobrará todo junto en primavera, cuando venda el paso.
  verdad: medias

rumor:
  id: r-nevadas
  dicho_por: nieves
  donde: refugio-de-la-cabra
  texto: Quedan dos nevadas grandes antes de que se cierre el paso. Después, hasta abril no sube ni una cabra.
  verdad: si

rumor:
  id: r-cornisa
  dicho_por: ramiro
  donde: refugio-de-la-cabra
  texto: Por la cornisa de las grullas se llega a la Atalaya por detrás. Es un paso de cabras, pero lo usan los contrabandistas.
  verdad: si

rumor:
  id: r-guardian
  dicho_por: brokk
  donde: refugio-de-la-cabra
  texto: En la puerta de la Atalaya duerme un guardián de hierro. Despierta si alguien entra sin el sello de la grulla.
  verdad: si

rumor:
  id: r-fanal-lena
  dicho_por: cualquiera
  donde: la-atalaya
  texto: El capitán subió leña seca al fanal para tres noches. Quiere encenderlo con su bandera antes de la próxima nevada.
  verdad: si
