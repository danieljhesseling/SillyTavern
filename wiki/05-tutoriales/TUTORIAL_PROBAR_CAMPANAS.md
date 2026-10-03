---
title: Tutorial — Probar campañas con el bot (ProbarCampañas.exe)
tags: [tutorial, bot, vuelta, campanas, pruebas]
created: 2026-10-03
---

# 🎲 Probar campañas con el bot

Eliges una campaña, le das a **«Correr»** y un bot la juega a clics, sin escribir nada, como la jugarías tú. Al acabar te dice en una ventana con pestañas qué tal ha ido: **Bien**, **Regular** o **Mal**. Cada resultado dice dónde pasó, qué se veía y cuánto tardó, con la captura y los números.

Vuelve a [[Tutoriales]] · La fila del plan: J16.6 de [[ROADMAP_SIN_CONEXION]].

---

## 1. La primera vez: hacer el .exe

El `.exe` se hace con una orden, una sola vez. No hay que instalar nada: usa el compilador de C# que ya trae Windows.

```powershell
cd C:\Users\danie\SillyTavern
node tools\probar-campanas\hacer-exe.mjs --escritorio
```

- Deja **`ProbarCampañas.exe`** en la carpeta del juego, al lado de `Jugar.bat`.
- Con `--escritorio`, pone además un acceso directo **«Probar campañas»** en tu escritorio. Sin `--escritorio`, solo hace el `.exe`.
- El acceso directo también se puede poner después, desde la ventana, con el botón **«Poner en el escritorio»** de abajo.
- Si algún día cambia el lanzador, vuelve a darle a la misma orden.

## 2. Abrirlo

Doble clic en **`ProbarCampañas.exe`** o en el acceso directo del escritorio.

- Se abre una **ventana suelta** de Microsoft Edge, sin pestañas ni barra de direcciones. No abre nada en tu navegador.
- No sale ninguna ventana negra.
- Si le das otra vez al doble clic con la ventana ya abierta, se abre la misma, no otra.
- No hace falta tener el juego encendido. El bot enciende su propio juego aparte, con datos de prueba en una carpeta temporal, así que **tu partida no se toca**.

## 3. Correr una vuelta

A la izquierda, en **«Correr una vuelta»**:

1. **Campaña.** Elige una del menú:

   | En el menú | Qué juega el bot |
   | :--- | :--- |
   | El prólogo y el gremio | El prólogo entero (el muelle, Tomás, Brunilda y la bodega), contratar a alguien, 1387 hasta su segundo hito, volver al gremio y Strahd hasta su primer hito |
   | 1387 | Salta la prueba y juega 1387 entera hasta uno de sus tres finales |
   | La Maldición de Strahd | Strahd entera, los doce hitos, hasta uno de sus finales |
   | La Maldición de Strahd (solo el camino al final) | Strahd por el camino más corto |
   | La costa que no duerme, Las tierras del ocaso, El mundo tras la pantalla | Las experimentales: el juego les escribe la historia en tres actos con su semilla, y el bot la juega desde su tarjeta del tablón |
   | Un JSON tuyo… | La campaña que te ha dado tu Gem. Sale el botón **«Elegir el archivo…»**; el bot la añade al tablón como harías tú y la juega |

2. **Peleas.**
   - **Rápidas:** los enemigos caen de un golpe. Se mide el camino, no las peleas. Es lo normal.
   - **De verdad:** cada pelea se juega entera. Es mucho más lenta.
   - En «El prólogo y el gremio» no se elige: esa vuelta juega sus peleas siempre igual.
3. Dale a **«Correr»**.

Debajo del botón pone cuánto tardó la última vez esa misma campaña.

## 4. Mientras juega

Sale el cuadro **«En marcha»**:

- **El reloj** de lo que lleva.
- **La barra**, según los hitos hechos. Al principio se mueve sola: el bot está encendiendo el juego, y eso tarda un par de minutos.
- **Ahora en:** la campaña, el sitio y el día por donde va.
- **Hitos**, **Clics** y **Último**, lo último que ha pulsado.
- **Los contadores** de silencios, atascos y cosas raras que lleva.
- **«Ver lo que va escribiendo el bot»:** su registro, en directo.
- **«Parar»** corta la vuelta. Se guarda en el historial como **«Parada»**.

Puedes cerrar la ventana a mitad: la vuelta sigue y se guarda al acabar. Al abrir el `.exe` otra vez, la ves por donde va.

Cuánto tarda, más o menos, con peleas rápidas (lo que tardaron las vueltas de octubre):

- **1387:** de 5 a 10 minutos;
- **Strahd entera:** de 8 a 10 minutos;
- **una campaña corta de tu Gem:** unos 2 o 3 minutos.

Con peleas de verdad, bastante más.

## 5. Los resultados: Bien, Regular y Mal

Al acabar, sale un aviso abajo a la derecha y se abre la pestaña de su resultado.

| Pestaña | Qué quiere decir |
| :--- | :--- |
| **Bien** | Llega a un final sin silencios, sin atascos y sin errores en la página |
| **Regular** | Llega a un final, pero con algo de esto: silencios, atascos rescatados, turnos del grupo jugados con el gancho, clics lentos (de más de 1,5 s) o alguna comprobación que no pasa |
| **Mal** | Se queda antes de un final, la vuelta se rompe o hay errores en la página |
| **Historial** | Todas las vueltas, de la más nueva a la más vieja. Pulsa una fila para ir a su tarjeta |

Las palabras del bot:

- **Silencio:** un clic tras el que no cambia nada que se vea.
- **Atasco:** lo que pide la historia no está a la vista. El bot lo apunta y sigue con un comando (un «rescate»), para ver también lo que viene detrás.
- **Gancho:** un atajo de prueba. Por ejemplo, si la barra de combate no responde, el bot juega el turno del grupo por dentro.

Cada tarjeta lleva:

- **La campaña**, cuándo se corrió, cuánto tardó y con qué peleas.
- **El final** al que llegó o, si se quedó antes, **dónde se quedó** (la campaña, el sitio y el día) y **lo que se veía** en ese momento.
- **Las razones** de su pestaña, dichas en una frase cada una.
- **La captura:** la del final o la del momento en que se rompió. Púlsala para verla grande.
- **«Todo lo de esta vuelta»**, al desplegarla:
  - cada silencio y cada atasco, con dónde pasó, qué se veía y qué módulo mirar;
  - lo que se ve mal y los clics lentos;
  - las comprobaciones que no pasan y los hitos que no se cumplieron;
  - **los números de la sección 6 del plan** (hitos jugados, silencios, atascos, días, clics, peleas, charlas…);
  - todas las capturas.
- Los botones **«Ver el registro»** (lo que escribió el bot, entero), **«Abrir la carpeta»** y **«Borrar»**.

## 6. Dónde se guarda

Todo va a **`Documentos\ProbarCampañas\historial`**, en una carpeta por vuelta con la fecha y la campaña, por ejemplo `2026-10-03_14-05-22_1387`. Dentro de cada una:

- `resultado.json`: el resultado, como sale en la tarjeta;
- `registro.txt`: lo que escribió el bot, entero (es lo que se le pasa a Claude si algo sale mal);
- `captura*.png`: las capturas;
- `vuelta.json`: qué se corrió y con qué orden;
- con «Un JSON tuyo…», también una copia de tu archivo.

Tu carpeta Documentos está en OneDrive (`OneDrive\Documentos`), así que el historial se guarda también allí. El botón **«Abrir la carpeta»** de abajo la abre.

## 7. Si algo no va

| Lo que pasa | Qué hacer |
| :--- | :--- |
| «No encuentro Node.js» | Instálalo desde https://nodejs.org/ (la versión LTS). Es lo mismo que necesita `Jugar.bat` |
| «No encuentro la carpeta del juego» | El `.exe` tiene que estar en la carpeta del juego (o en su carpeta `tools`). Si lo has movido, vuelve a hacerlo con la orden del punto 1 |
| «El puerto del juego para el bot está ocupado» | Hay otra vuelta encendida (en otra ventana o en una terminal). Espera a que acabe o ciérrala |
| La ventana no se abre | Mira `Documentos\ProbarCampañas\ventana.log`: ahí apunta lo que hace |
| Todas salen en **Mal**, en el gremio, al principio | El juego ha cambiado por donde pasa el bot (por ejemplo, el prólogo). Es el bot lo que hay que poner al día, no tu campaña: pásale el registro a Claude |

## 8. Por dentro (para quien lo toque)

- **Las vueltas** son las de siempre, las de la consola: `tools\vuelta-gremio.mjs`, `vuelta-1387.mjs`, `vuelta-strahd.mjs` y `vuelta-campana.mjs`. Las experimentales van con `vuelta-campana.mjs --tablon <id>`. La ventana no juega nada por su cuenta: lanza la vuelta y lee lo que escribe.
- **`tools\probar-campanas\`:**
  - `servidor.mjs`: el servidor pequeño de la ventana, solo con lo que trae Node. Abre Edge con `msedge --app=…` y un perfil suyo, y se apaga solo cuando cierras la ventana y no hay ninguna vuelta en marcha;
  - `app.html`: la ventana;
  - `clasificar.mjs`: lee el registro y decide **Bien**, **Regular** o **Mal**. Su prueba está en `tests\probar-campanas.test.js`;
  - `lanzador.cs` y `hacer-exe.mjs`: el `.exe`, compilado con el `csc.exe` del .NET Framework 4 que trae Windows;
  - `windows.mjs`: Edge, PowerShell y el acceso directo.
- **El bot usa el puerto 8590** para su juego (o el siguiente libre, hasta el 8599). Para otro: `ProbarCampañas.exe --puerto-bot 8600`.
- **Desde la consola, sin el .exe:** `node tools\probar-campanas\servidor.mjs`. Con `--sin-ventana` no abre nada y dice la dirección; con `--carpeta D:\otra` guarda los resultados en otro sitio.
