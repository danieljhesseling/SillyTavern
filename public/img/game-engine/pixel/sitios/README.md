# Sitios del pueblo

Fondos para la pantalla del pueblo (J3.11), el selector de sitios. 320×180, sin transparencia, vista lateral, hechos con PixelLab (pixflux). Dos versiones de cada sitio: `<sitio>.png` es la de día (mañana y tarde) y `<sitio>-noche.png` la de noche.

- `gremio.png` — la sala del gremio de día: mesa larga, tablón lleno de papeles en blanco, estandartes rojos y dorados, escudos y ventanales con luz.
- `gremio-noche.png` — la misma sala de noche: velas en la mesa, ventanas oscuras, el tablón de papeles y los estandartes.
- `herreria.png` — la forja de día: el yunque delante del hogar de ladrillo con brasas, herramientas colgadas y la puerta abierta a la calle.
- `herreria-noche.png` — la forja de noche: el fuego encendido, un farol y la puerta abierta a un muelle oscuro.
- `muelle.png` — el muelle de pesca de día: pasarela de madera sobre el mar, cajas, dos barcas y la costa verde.
- `muelle-noche.png` — el muelle de noche: la pasarela con un farol encendido y la luna sobre el agua.
- `plaza.png` — la plaza del pueblo de día: adoquines, un pozo de piedra, casas de entramado y toldos.
- `plaza-noche.png` — la plaza de noche: el pozo, ventanas y faroles encendidos y luna llena.
- `taberna.png` — la sala de la posada de día: chimenea de piedra con fuego, mesas, bancos, barriles y ventanas con luz.
- `taberna-noche.png` — la posada de noche: fuego grande, faroles colgados y velas en las mesas.
- `templo.png` — la capilla de piedra de día: bancos de madera, altar lleno de velas y luz por la vidriera.
- `templo-noche.png` — la capilla de noche: solo la luz de las velas del altar y una ventana con estrellas.
- `tienda.png` — la tienda de día: mostrador largo, estanterías de tarros y pociones, sacos y la puerta abierta.
- `tienda-noche.png` — la tienda cerrada de noche: lámparas encendidas sobre el mostrador y la puerta a la calle oscura.
- `calabozo.png` — la celda del calabozo de la guardia (D-J47): paredes de piedra, un ventanuco con barrotes, un banco, un cubo y una antorcha en el pasillo. Una sola versión: dentro no se nota si es de día. La usa la escena del calabozo (`campaign/jail.js`); no es un sitio del selector.
- `biblioteca.png` — la biblioteca del gremio: estanterías altas de libros viejos, una mesa con un libro abierto y una vela, y una ventana estrecha. Una sola versión: con las velas vale de día y de noche. La usa el rato de leer cuando el gremio ya tiene biblioteca (J14.11, `party/pastimes.js`); sin ella se lee en la sala.
- `patio.png` — el patio de entrenamiento detrás de la sala del gremio, de día: muros de piedra, suelo de tierra y armeros con espadas, lanzas y escudos a los lados. Solo de día: de noche no se entrena. La usa el rato de entrenar en el patio (J14.11).

Retoques a mano: en `taberna.png` dos cuadros de la pared tenían garabatos con forma de letra y en `tienda.png` dos placas tenían rayas de texto falso; se pintaron lisos. En `templo-noche.png` y `tienda-noche.png` se rellenaron unas franjas negras finas arriba y abajo; en `calabozo.png`, en espejo, unas de diez píxeles. En `patio.png` la puerta traía una placa con rayas; se pintó de madera.
