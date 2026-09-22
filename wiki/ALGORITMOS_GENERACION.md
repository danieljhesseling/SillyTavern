# 200 ideas para que dos partidas del mismo texto no se parezcan

Todo lo de aquí se hace **sin IA**: tablas, pesos, ruido y una semilla. La IA, cuando
aparece, solo pone nombres y frases —y eso es una llamada, no doscientas—.

---

## Lo primero, porque si esto está mal lo demás da igual

Hoy `seeded-random.js` sirve para que **una pelea se repita**. Para generar mundos hace
falta lo contrario: que **la misma idea escrita produzca mundos distintos**, y que cada uno
sea reproducible después.

La regla es una sola:

> **La semilla no es el texto.** La semilla se tira al crear la campaña y **se guarda con
> ella**. El texto es un *sesgo*, no un identificador.

```
semillaCampaña = tirada aleatoria al crear   → se guarda en metadata.seed
semillaDe(cosa) = seedFrom(`${semillaCampaña}|${cosa}`)
```

Con eso, «una cripta inundada» da una cripta distinta cada vez, y la tuya vuelve exacta
siempre que la vuelvas a abrir. Todo lo que sigue cuelga de ahí.

---

## 1 · La semilla (1–12)

1. **Semilla por campaña, guardada en el mundo.** Se tira al crear, se escribe en
   `metadata.seed` y no se toca más. Es lo que hace reproducible todo lo demás.
2. **Semillas derivadas por dominio.** `seedFrom(`${seed}|terreno|${tablero}`)`: regenerar
   el botín no te cambia el mapa. Un solo flujo global significa que tocar algo lo mueve todo.
3. **Semilla legible.** Mostrarla como tres palabras (`molino-ceniza-siete`) en vez de
   `1749302811`: se puede dictar, apuntar y compartir.
4. **Campo «semilla» opcional en el asistente.** Vacío = tirada nueva. Escrito = el mundo de
   tu amigo, idéntico.
5. **El texto como sesgo, no como semilla.** «Inundada» sube el peso del agua; no decide el
   mapa. Así dos criptas inundadas son dos criptas distintas.
6. **Palabras clave con pesos declarados.** Un diccionario `palabra → {agua: +3, muros: -1}`
   editable desde `/rules`. Añadir «volcánica» es una fila, no código.
7. **Semilla por acto.** `seed|acto2` para lo que se genera al llegar al acto 2: el mundo
   crece sin rehacer lo de antes.
8. **Semilla por visita.** Una taberna tiene siempre la misma sala y clientes distintos:
   `seed|taberna|dia14`.
9. **Rerolls contados.** «Generar otra vez» usa `seed|intento3`. Guardas los intentos y
   puedes volver al 1, que es lo que ya hace el asistente con los mundos de IA.
10. **Semillas con sal por jugador.** Si algún día jugáis dos, `seed|jugador|Lyra` evita que
    los dos encontréis el mismo cofre.
11. **Semilla congelable por zona.** Marcar una localidad como «fijada» para que nunca se
    regenere aunque cambies el algoritmo: lo que ya jugaste no se te mueve bajo los pies.
12. **Versión del generador en el mundo.** `metadata.genVersion`. Si mejoras el algoritmo, un
    mundo viejo se sigue dibujando con el suyo en vez de deformarse.

---

## 2 · Terreno y tableros (13–30)

13. **Plantillas de forma, no una sola.** BSP para mazmorra, autómata celular para cuevas,
    Voronoi para campamentos, radial para templos. El generador elige por tipo de sitio.
14. **Autómata celular para cuevas.** Ruido 45 % muro, cuatro pasadas de suavizado: cuevas
    orgánicas sin una sola habitación rectangular.
15. **Voronoi para exteriores.** Semillas repartidas, cada celda un bioma o un corral: pueblos
    y campamentos que no parecen cuadrículas.
16. **Ruido de valor para altura.** Un mapa de alturas barato decide dónde hay cuesta, y la
    cuesta cuesta movimiento.
17. **Erosión de una pasada.** Recorrer el mapa quitando esquinas sueltas: el mismo BSP deja
    de parecer BSP.
18. **Simetría opcional con fallo.** Un templo simétrico al 90 %: el 10 % roto es lo que lo
    hace un sitio y no un patrón.
19. **Plantillas de sala pegadas a mano.** Un puñado de salas escritas (la cripta con nichos,
    la sala del pozo) que el generador **coloca**, no dibuja. Lo mejor de los dos.
20. **Rotación y espejo de plantillas.** Cuatro giros y dos espejos: ocho salas por cada una
    que escribas.
21. **Presupuesto de cobertura.** El tablero tiene que tener entre el 8 % y el 15 % de
    cobertura. Se añade o se quita hasta cumplirlo: ningún tablero sale pelado.
22. **Líneas de tiro medidas.** Tras generar, contar cuántas casillas se ven desde el inicio.
    Demasiadas = campo de tiro; se planta algo.
23. **Terreno difícil en manchas, no en píxeles.** El barro sale en charcos de 3–6 casillas,
    que es algo que se rodea; una casilla suelta solo es un impuesto.
24. **Terreno que hace algo.** Agua = movimiento doble y apaga fuego. Hielo = deslizas.
    Zarzas = daño al salir. Cuatro líneas de tabla y el tablero decide tácticas.
25. **Peligros con contador.** Una grieta que se ensancha cada 3 rondas: el tablero cambia
    mientras peleas.
26. **Entradas y salidas variables.** Que la salida no esté siempre enfrente: a veces detrás,
    a veces arriba, a veces es el pozo por el que caíste.
27. **Verificación de conectividad.** Inundado desde el inicio; lo que no se alcanza, se tira
    o se conecta. Un tablero con una sala inalcanzable es un tablero roto.
28. **Corredores con carácter.** Rectos = militar. Torcidos = natural. En zigzag = trampas.
    El tipo de sitio elige el tipo de pasillo.
29. **Salas de tamaño desigual a propósito.** Una sala grande domina el tablero y da forma al
    combate; ocho salas medianas dan ocho peleas iguales.
30. **Tamaño del tablero según lo que va a pasar.** Una emboscada cabe en 10×10; una defensa
    de seis rondas necesita 18×18. El escenario pide el tamaño, no al revés.

---

## 3 · Salas, puertas y llaves (31–42)

31. **Grafo de cerraduras antes que mapa.** Primero «llave A abre puerta B», luego el mapa
    que lo cumple. Al revés salen llaves imposibles.
32. **Puertas atascadas, no cerradas.** Una tirada de Fuerza es una decisión; una llave que no
    tienes es un pasillo.
33. **Atajos de vuelta.** Toda mazmorra larga deja una puerta que se abre **desde dentro**:
    volver no puede costar lo mismo que ir.
34. **Bucles, no árboles.** Al menos un ciclo en el grafo: sin él, cada exploración es ir y
    volver por lo mismo.
35. **Salas opcionales con premio.** Un 30 % del mapa fuera del camino, y lo que hay ahí tiene
    que valer el rodeo.
36. **Densidad de secretos por tipo de sitio.** Una tumba esconde; un cuartel no.
37. **Pistas de lo secreto.** Un secreto sin pista es un secreto que nadie encuentra: corriente
    de aire, alfombra gastada, una marca. La pista se genera con la sala.
38. **Habitaciones que se ven desde fuera.** Una ventana, una reja: sabes que hay algo antes
    de poder llegar, y eso es media aventura.
39. **Profundidad como presupuesto.** Cuanto más adentro, más peligro y mejor botín, por una
    curva declarada y no por si acaso.
40. **Estado de la sala.** Saqueada, inundada, quemada, habitada. La misma sala con cuatro
    estados son cuatro salas.
41. **Rastros entre salas.** Si en la sala 4 hay lobos, en la 3 hay huellas. Coherencia barata
    que parece diseño.
42. **Trampas que se anuncian.** Toda trampa deja un tell generado con ella. Sin tell no es
    una trampa, es un impuesto aleatorio.

---

## 4 · Mundo, regiones y viaje (43–56)

43. **Placas antes que costas.** Cuatro o cinco regiones grandes y sus fronteras; los detalles
    después. Un mundo hecho de detalles no tiene forma.
44. **Ríos que bajan.** Desde el punto más alto, siguiendo la pendiente del mapa de alturas.
    Un río que sube se nota a la primera.
45. **Asentamientos donde tienen sentido.** Vados, desembocaduras, cruces de caminos y minas.
    La geografía explica el pueblo.
46. **Caminos por coste, no por línea recta.** A\* con el terreno pesado: el camino rodea la
    montaña, y por eso el paso de montaña importa.
47. **Distancias en días, no en casillas.** Lo que el jugador necesita saber es si llega antes
    de que se acabe la comida.
48. **Encuentros de camino por tramo.** Cada tramo tiene su tabla: el bosque no da bandidos de
    carretera ni la carretera da lobos de bosque.
49. **Puntos de interés a media ruta.** Una ermita, un puente roto, un campamento abandonado:
    el viaje deja de ser una pantalla de carga.
50. **Rutas que se cierran.** Nieve, crecida, peaje de una facción. El mapa cambia sin que
    cambien los mapas.
51. **Nombres derivados de la geografía.** «Vado del Sauce» porque hay un vado y sauces. La
    coherencia sale gratis si el nombre se construye de los datos.
52. **Fronteras reales.** Un río o una cordillera separa facciones; dos facciones que comparten
    llanura, se pelean.
53. **Lo que exporta cada sitio.** Una tabla de recursos por bioma que luego decide precios,
    botín y de qué hablan en la taberna.
54. **Distancia al poder.** Cuanto más lejos de la capital, menos ley: bandidos, precios y
    justicia salen de esa única cifra.
55. **Historia en tres capas.** Una ruina, quién la construyó, quién la ocupa ahora. Tres
    tiradas y el sitio tiene pasado.
56. **Mapa que se revela.** El mundo existe entero desde el principio y se dibuja al ir: nada
    de generar por delante del jugador, que es de donde salen las incoherencias.

---

## 5 · Clima, estaciones y hora (57–66)

57. **Cadena de Markov para el tiempo.** El día de mañana depende del de hoy, con una matriz
    por estación. Nunca sale sol-tormenta-sol.
58. **Estaciones que cambian el mapa.** El río helado es un puente en invierno.
59. **Clima con efecto de regla, no de texto.** Lluvia = −2 a distancia. Niebla = visión 6
    casillas. Si no toca una regla, es decorado.
60. **Frentes que se ven venir.** La tormenta se anuncia una jornada antes: da una decisión
    (¿salgo o espero?), que es de lo que va el juego.
61. **Hora del día en el tablero.** De noche, la visión baja y las antorchas mandan.
62. **Luna en fases.** Tres noches al mes cambian los encuentros. Es una cifra y da leyenda.
63. **Microclima por región.** El pantano tiene su propia matriz: el clima dice dónde estás.
64. **Años malos.** Una tirada al crear la campaña: sequía, plaga, buena cosecha. Mueve precios
    todo el año.
65. **El calendario con fiestas generadas.** Tres o cuatro al año, con su nombre y su efecto:
    mercado, tregua, luto.
66. **Clima que recuerda.** Si llovió tres días, hay barro dos más. El estado del suelo es del
    mundo, no del día.

---

## 6 · Enemigos: fichas y variantes (67–82)

67. **Presupuesto de puntos, no cifras a mano.** Un enemigo de CR ½ tiene N puntos que reparte
    entre vida, CA, daño y velocidad. Dos de la misma CR salen distintos y siguen siendo justos.
68. **Arquetipos de reparto.** Tanque, matón, tirador, estorbo, bruto. El arquetipo decide en
    qué gasta los puntos.
69. **Plantillas apilables.** «Viejo», «rabioso», «de las minas», «jefe». Un esqueleto × cuatro
    plantillas son treinta esqueletos.
70. **Una habilidad de la tabla, no tres.** Un bicho con una cosa rara memorable vale más que
    uno con cuatro que nadie ve.
71. **Debilidad declarada.** Cada variante trae una: fuego, luz, plata, la espalda. Es lo que
    convierte un combate en un problema.
72. **Manías tácticas.** «Nunca se aleja del agua», «huye por debajo de la mitad», «protege al
    del centro». El perfil ya existe; esto lo particulariza.
73. **Escalado por región, no por nivel del jugador.** El pantano es duro siempre. El escalado
    invisible es lo que hace que subir de nivel no se note.
74. **Variantes por sitio.** Los lobos del norte son más grandes. Una fila de tabla, un enemigo
    con lugar de origen.
75. **Nombre propio para uno de cada banda.** El que tiene nombre es el que recuerdas.
76. **Heridas visibles heredadas.** Si huyó la última vez, vuelve cojo y con menos vida.
77. **Equipo generado, no dado.** El bandido lleva lo que robó, y por eso su botín tiene
    sentido.
78. **Bestiario derivado del bioma.** Nada de lobos en la cripta salvo que alguien los metiera,
    y si los metió, hay un motivo escrito.
79. **Contadores en vez de tropecientas reglas.** «Carga en 2 rondas», «invoca al llegar a la
    mitad». Barato de generar, legible de jugar.
80. **Grupos con papeles.** Dos matones, un tirador y uno que llama a más: una banda es una
    composición, no cinco copias.
81. **Familias de bichos.** Todo lo de la familia «hueso» comparte debilidad y aspecto. El
    jugador aprende, y aprender es progreso.
82. **Jefes por composición.** Un jefe = arquetipo + dos plantillas + una habilidad de fase.
    Así salen jefes distintos sin escribir jefes.

---

## 7 · Encuentros y bandas (83–94)

83. **Presupuesto de encuentro.** El tablero tiene N puntos de amenaza; el generador compra
    bichos hasta gastarlos. Es lo que evita la pelea imposible de la tercera sala.
84. **Presupuesto según cómo va el grupo.** Heridos y sin descansar = menos puntos. Sin
    esconder la cifra: se puede ver en `/rules`.
85. **Olas en vez de montones.** Dos oleadas de tres asustan más que seis a la vez y usan menos
    puntos.
86. **Colocación con intención.** Los tiradores lejos y altos, los matones en la puerta. Una
    regla de colocación por arquetipo.
87. **Distancia inicial variable.** A veces empiezas encima, a veces a quince metros. Cambia el
    primer turno entero.
88. **Enemigos dormidos, patrullando o esperando.** El estado inicial decide si hay emboscada,
    sigilo o pelea limpia.
89. **Refuerzos con puerta.** Llegan por un sitio concreto y anunciado: eso se puede bloquear,
    y bloquearlo es jugar.
90. **Encuentros que no son pelea.** Un mercader, un herido, un rival buscando lo mismo. La
    misma tabla, resultados distintos.
91. **Tablas por hora y clima.** De noche en el pantano sale otra cosa que al mediodía.
92. **Memoria de encuentros.** No repetir el mismo en dos jornadas: una lista corta de lo
    reciente y pesos a cero.
93. **Bandas con moral.** Un número que baja al caer los suyos; al llegar a cero, huyen. Los
    combates dejan de durar hasta el último punto de vida.
94. **Al que huye se le vuelve a ver.** Con su nombre, con refuerzos y con rencor.

---

## 8 · Botín y economía (95–108)

95. **Botín por presupuesto, no por tabla plana.** La mazmorra tiene un valor total repartido
    entre sus salas; así no te toca todo en la primera.
96. **Piedad ante la mala suerte.** Si llevas N tiradas sin nada bueno, el peso de lo bueno
    sube. Invisible y decisivo.
97. **Rarezas por curva, no por porcentaje fijo.** La rareza depende de la profundidad y del
    acto, que es lo que hace que bajar valga la pena.
98. **Botín que encaja con el enemigo.** Del arquero, flechas y un arco. De lo demás sale un
    inventario que no se cree nadie.
99. **Objetos rotos y a medias.** Una espada mellada que hay que reparar: da un destino al
    dinero y un motivo para volver al pueblo.
100. **Consumibles por encima de permanentes.** Lo que se gasta genera decisiones cada combate;
     lo permanente se equipa y se olvida.
101. **Precios por oferta y demanda.** El pueblo minero paga mal el mineral. Una tabla de
     recursos por región y ya está.
102. **Dinero que pesa.** Mil monedas son quince kilos: el peso convierte el tesoro en un
     problema logístico, que es más interesante que un número.
103. **Inflación por acto.** Lo que ganas y lo que cuesta suben juntos; si no, el acto 3 es un
     paseo.
104. **Stock del mercader generado y finito.** Tres cosas buenas esta semana, y si no las
     compras se van.
105. **Mercader con gustos.** Paga más por lo que colecciona. Una etiqueta por mercader.
106. **Botín de la banda, no de cada bicho.** Un montón al final en vez de doce cadáveres que
     registrar.
107. **Semilla de botín por cofre.** `seed|botin|sala7`: si recargas, sale lo mismo. Si no, el
     guardado se convierte en una máquina tragaperras.
108. **Tasas y peajes.** Un porcentaje por región, generado al crear el mundo, que explica por
     qué una ruta es más barata que otra.

---

## 9 · Objetos con historia (109–120)

109. **Nombre por composición.** `[Material] [Forma] de [Hecho]` → «Daga de hueso del Vado».
     Tres tablas, mil nombres coherentes.
110. **Propiedades por presupuesto.** Cada objeto tiene puntos y se los gasta: +1 daño cuesta
     lo mismo aquí que allí, así que nada sale roto.
111. **Ventaja con contrapartida.** «+2 al daño, −5 pies de velocidad». Un objeto que solo suma
     no es una decisión.
112. **Procedencia generada.** Quién lo hizo, quién lo perdió. Dos tiradas y el objeto tiene
     una línea que el narrador puede usar.
113. **Objetos que se despiertan.** Inertes hasta que pasa algo (matar a un jefe, entrar en un
     sitio). El mismo objeto, dos vidas.
114. **Sets por familia.** Tres piezas de la misma tumba que hacen algo juntas. Genera
     objetivos sin escribir misiones.
115. **Desgaste con estados.** Nuevo, usado, mellado, roto. Cuatro estados y el equipo tiene
     mantenimiento.
116. **Maldiciones que se notan tarde.** Una pega que aparece a la tercera vez: memorable, y
     recuperable pagando.
117. **Objetos de un solo uso enormes.** Lo que rompe una pelea una vez y se acaba. Barato de
     equilibrar, imposible de olvidar.
118. **Etiquetas de material con efecto.** Plata contra no-muertos, hierro frío contra hadas.
     Una columna en la tabla de materiales.
119. **Objetos que ocupan sitio raro.** Algo voluminoso que hay que soltar para correr. El
     inventario deja de ser una lista.
120. **Rareza con aspecto.** El color, el peso y la descripción salen del mismo dato: se
     reconoce lo bueno de un vistazo.

---

## 10 · PNJ (121–134)

121. **Ficha por rasgos, no por texto.** Tres rasgos de tabla (terco, endeudado, devoto) y el
     resto se deduce.
122. **Un deseo y un miedo.** Dos tiradas. De ahí salen todas sus decisiones y todo lo que el
     narrador necesita saber.
123. **Secreto con condición de salida.** Qué esconde y qué haría que se supiera. Eso es una
     trama, generada.
124. **Relaciones entre PNJ como grafo.** Hermano de, debe dinero a, odia a. Un pueblo con
     diez PNJ y veinte aristas ya tiene política.
125. **Rutina horaria.** Dónde está cada uno a cada hora. Buscarle se convierte en un plan.
126. **Precio de cada uno.** Qué haría falta para que te ayude: dinero, un favor, una amenaza.
127. **Voz por tres rasgos de habla.** Corto, formal, repite una muletilla. Le da al narrador
     con qué distinguirlos sin inventarse nada.
128. **Opinión que se mueve.** Un número por PNJ que sube y baja con lo que haces, y que decide
     precios y qué te cuenta.
129. **Oficio con consecuencia.** El herrero repara, el barquero cruza, el escriba lee lo que
     encontraste. El oficio es una mecánica.
130. **Familia generada.** Dos o tres parientes con nombre. Matar a alguien deja de ser
     gratis.
131. **PNJ que se mueren solos.** Vejez, enfermedad, la facción equivocada. El mundo se mueve
     aunque no estés.
132. **Sustitutos.** Si muere el herrero, alguien ocupa su sitio en unas semanas, peor y más
     caro.
133. **Confidentes por arcano.** Repartir los arcanos disponibles entre los PNJ con más peso:
     los vínculos tienen a quién agarrarse desde el día uno.
134. **Lo que cada uno sabe.** Una lista corta de hechos por PNJ. Preguntar se vuelve un
     sistema en vez de una conversación.

---

## 11 · Facciones (135–144)

135. **Tres ejes y ya está.** Recursos, territorio, legitimidad. Con tres números una facción
     se comporta.
136. **Objetivos generados.** Cada una quiere una cosa concreta y alcanzable: un sitio, un
     objeto, la caída de otra.
137. **Relaciones como matriz.** Quién odia a quién, con un número. Se actualiza sola con lo
     que pasa.
138. **Tics de reloj.** Cada semana, cada facción hace un movimiento según sus números. El
     mundo avanza sin ti.
139. **Guerras que empiezan por algo.** Dos facciones con el mismo objetivo y frontera común:
     la guerra sale de los datos.
140. **Tu reputación por facción.** Ayudar a una baja la otra. Eso es lo que hace que elegir
     cueste.
141. **Territorio que cambia de manos.** Un mapa de control por región que se repinta con los
     tics.
142. **Emisarios.** Cuando tu reputación con una pasa de N, te buscan. El mundo reacciona.
143. **Facciones que se rompen.** Legitimidad a cero = escisión, y nace una facción nueva con
     los datos de la vieja.
144. **Deudas y favores.** Un contador por facción que se puede gastar. Convierte la política
     en moneda.

---

## 12 · Misiones y contratos (145–158)

145. **Gramática de misiones.** `[Verbo] [Objeto] [en Sitio] [antes de Plazo] [pero Giro]`.
     Cinco tablas y no se repite una.
146. **Giros que cambian el objetivo.** «El que te contrata miente», «lo que buscas ya no está
     ahí», «hay otro buscándolo». El giro es lo que separa un recado de una misión.
147. **Misiones que salen del estado del mundo.** Si el puente se cayó, hay misión de puente.
     Generar desde lo que pasó, no desde una tabla suelta.
148. **Cadenas de tres.** La segunda depende de cómo acabó la primera. Dos ramas por eslabón
     son ocho finales con tres misiones escritas.
149. **Plazos reales.** Caducan con el calendario. Sin plazo no hay elección, solo una lista.
150. **Recompensas que no son oro.** Un favor, un contacto, una llave, un sitio donde dormir
     gratis. Más memorable y más barato de equilibrar.
151. **Misiones incompatibles a la vez.** Dos contratos que se estorban: aceptar es elegir.
152. **Fracaso con consecuencia, no con reintento.** Si se te pasa el plazo, el mundo cambia y
     la misión no vuelve.
153. **El tablón con rango.** Ya existe en `contracts.js`: mantener siempre uno por encima de
     tu rango a la vista, porque eso es lo que da ambición.
154. **Quién lo encarga importa.** El mismo contrato de una facción u otra es otra misión.
155. **Pistas repartidas, no una sola.** Tres formas de llegar a lo mismo: si fallas una, no se
     acaba el juego.
156. **Objetivos de escenario generados.** Además de «mátalos a todos»: aguantar, escoltar,
     llegar, sobrevivir, romper algo. Ya hay tipos en el motor; falta que el generador los
     reparta.
157. **Condición de derrota propia.** No solo «morís todos»: que se escape, que se queme, que
     amanezca. Perder de formas distintas es perder con sentido.
158. **Epílogos de una línea, generados.** Qué cambió en el mundo por lo que hiciste. Se
     enganchan a los tics de facción.

---

## 13 · Nombres y lengua (159–170)

159. **Sílabas por cultura.** Tres listas (inicio, medio, final) por pueblo: los nombres de una
     región suenan a esa región.
160. **Cadena de Markov con un corpus corto.** Cien nombres reales dan mil verosímiles. No hace
     falta IA para esto.
161. **Nombres compuestos por significado.** `[raíz de agua] + [raíz de paso]` = «Vado». El
     nombre significa algo y se puede traducir en pantalla.
162. **Apellidos por oficio y sitio.** «del Molino», «la barquera». Sale de los datos del PNJ.
163. **Apodos ganados.** El PNJ recibe un apodo según lo que le pasó en la partida.
164. **Un registro de nombres usados.** Nada de dos Bruna en el mismo pueblo.
165. **Topónimos que envejecen.** El sitio se llama distinto según quién lo controle: dos
     nombres para el mismo punto.
166. **Tablas de nombres editables desde `/rules`.** Añadir tu lista sin tocar código, que es
     lo que quieres.
167. **Nombres de objeto con la misma máquina.** Materiales, formas y hechos: una sola
     gramática para todo.
168. **Nombres de taberna por plantilla.** `El [Adjetivo] [Animal]`. Tonto, clásico, funciona.
169. **Iniciales que no chocan.** Evitar dos PNJ importantes con la misma letra: se confunden
     al leer.
170. **Bautizo en lote con IA, opcional.** Si hay proveedor, una sola llamada renombra
     cincuenta cosas de golpe. Sin proveedor, las tablas ya sirven.

---

## 14 · Escenarios tipo Gloomhaven (171–180)

171. **Escenario = tablero + objetivo + giro.** Las tres piezas se generan por separado y se
     combinan. De ahí sale la variedad.
172. **Condiciones de victoria en tabla.** Eliminar, aguantar, llegar, escoltar, romper,
     robar. Ya hay tipos; falta mezclarlos de dos en dos.
173. **Reglas especiales por escenario.** «La luz baja cada ronda», «los muertos se levantan».
     Una por escenario, no cinco.
174. **Puertas que abren salas con su propio contenido.** Ya existe; falta que lo de detrás se
     genere con el presupuesto de la sala y no a mano.
175. **Escenarios ramificados.** Ganar lleva a uno, perder a otro. Perder deja de ser recargar.
176. **Mapas por losetas.** Un puñado de losetas que encajan: monta mazmorras distintas con
     piezas reconocibles.
177. **Hitos de ronda.** En la ronda 3 pasa algo escrito al generar. Da ritmo sin guion.
178. **Objetivos ocultos.** Uno que se revela a mitad. Cambia el plan a media pelea.
179. **Rejugar con variante.** El mismo escenario con `seed|variante2`: otros enemigos, otro
     giro, mismo mapa.
180. **Dificultad como presupuesto visible.** Un deslizador que multiplica los puntos de
     amenaza y las recompensas. Honesto y de una línea.

---

## 15 · Supervivencia y desgaste (181–188)

181. **Cuenta semanal con variación.** El precio de la comida se mueve con la región y el año.
     Ya está `upkeep.js`; falta que los números salgan del mundo.
182. **Tabla de heridas por causa.** Caída, fuego, frío y hoja dejan heridas distintas. Ya hay
     tabla; falta que la causa elija la rama.
183. **Enfermedades con curso.** Tres etapas y una tirada por día para pasar de una a otra. Da
     una carrera contra el reloj.
184. **Provisiones por calidad.** Comer mal cansa; comer bien cura un poco. Una columna más.
185. **Refugios generados.** Cuevas, ermitas, una casa quemada: sitios donde el descanso
     funciona distinto.
186. **Rutas con coste de desgaste.** La corta cansa, la larga come. Eso es una decisión de
     mapa.
187. **Cicatrices que quedan escritas.** Cada herida permanente deja una línea en la ficha que
     el narrador puede usar.
188. **Recuperación con tiempo real de calendario.** Dos semanas de brazo roto son dos semanas
     en las que el mundo sigue.

---

## 16 · Rumores y misterios (189–194)

189. **Rumores derivados de hechos.** Cada rumor apunta a algo que **existe** en los datos.
     Uno de cada cuatro, falso pero explicable.
190. **Misterios con solución escrita al generar.** Quién fue, cómo y dónde está la prueba. Sin
     eso, un misterio es una promesa que no se cumple.
191. **Tres pistas por misterio, repartidas.** Y ninguna imprescindible.
192. **Rumores que caducan.** Lo que se oyó hace un mes ya no vale: el tablón de rumores se
     mueve.
193. **Quién te lo cuenta cambia lo que dice.** El mismo hecho con el sesgo del PNJ.
194. **Registro de lo que sabes.** Una lista de hechos confirmados, que es lo que permite al
     motor no repetir y al narrador no contradecirse.

---

## 17 · Que el azar sea justo (195–200)

195. **Nada de generar lo imposible.** Toda generación termina con una comprobación de que se
     puede jugar: se llega, se gana, se sale. Igual que ya hace `validateModel`.
196. **Bolsas en vez de tiradas.** Sacar sin reposición: veinte tiradas dan una distribución de
     verdad, no cinco pifias seguidas.
197. **Piedad declarada.** Tras N fracasos, sube la probabilidad. Escrito en las reglas, no
     escondido.
198. **Nunca dos veces seguidas lo mismo.** Una memoria corta por tabla, con pesos a cero para
     lo reciente.
199. **Todo lo generado se puede editar después.** Es la regla de la casa: lo que salga del
     algoritmo aparece en `/campana` como cualquier otra cosa escrita a mano.
200. **Un registro de por qué salió así.** `/semilla` enseñando qué decidió cada paso. Cuando
     algo salga raro, se sabrá si fue el algoritmo o la suerte.

---

## Por dónde empezaría

Si solo se hacen diez, estos diez cambian más que los otros ciento noventa:

| # | Idea | Por qué |
| :--- | :--- | :--- |
| 1 | Semilla por campaña, guardada | Sin esto, nada de lo demás es reproducible |
| 5 | El texto como sesgo | Es literalmente lo que pediste: mismo texto, mundo distinto |
| 67 | Presupuesto de puntos por enemigo | Variedad y equilibrio de una vez |
| 69 | Plantillas apilables | Multiplica el bestiario sin escribir bestiario |
| 83 | Presupuesto de encuentro | Mata la pelea imposible de la tercera sala |
| 95 | Botín por presupuesto | Mata el «me tocó todo al principio» |
| 145 | Gramática de misiones | De una tabla de recados a misiones que no se repiten |
| 109 | Nombres por composición | Coherencia gratis en todo el mundo |
| 195 | Comprobar que se puede jugar | Lo que impide que un mundo generado sea injugable |
| 199 | Todo editable después | La regla de la casa: sin código |

---

## Enlaces

- [[ROADMAP_MAESTRO]] — dónde encaja cada nivel
- [[POR_HACER]] — lo que está hecho y lo que no
- `public/scripts/game-engine/combat/seeded-random.js` — la semilla que ya existe
- `public/scripts/game-engine/world-builder/dungeon-generator.js` — el BSP que ya existe
- `public/scripts/game-engine/campaign/contracts.js` — los pesos que ya existen
