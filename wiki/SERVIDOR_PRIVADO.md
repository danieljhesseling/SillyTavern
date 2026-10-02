---
title: El servidor privado — abrir el juego a tus amigos
tags: [servidor, amigos, red, seguridad, arranque, movil, J0.9, J20.8]
created: 2026-09-29
updated: 2026-10-01
author: DanielJHesseling / Claude Opus 5.5
---

# 🔐 Abrir el juego a tus amigos

> [!NOTE]
> **Qué es esto.** Cómo dejar que tus amigos entren en tu juego desde su ordenador o su móvil, en tu casa o desde fuera, **con contraseña**. Es J0.9 de [[ROADMAP_SIN_CONEXION]].
>
> **Todo se cambia en un solo archivo**: `config.yaml`, en la carpeta del juego (`C:\Users\danie\SillyTavern`). Se abre con el Bloc de notas. Después de cambiarlo, cierra la ventana negra del servidor y vuelve a abrir `Jugar.bat`: el servidor solo lee el archivo al arrancar.

---

## 1. Arrancar con un doble clic

- **Windows:** doble clic en `Jugar.bat`.
- **Linux o Mac:** `./jugar.sh` (o doble clic, si tu escritorio lo permite).

Si el servidor está apagado, lo enciende (instala lo que falte, como `Start.bat`) y abre el navegador cuando está listo. Si ya estaba encendido, solo abre el navegador. El juego sale directo en su portada.

La ventana negra **es** el servidor: mientras esté abierta, se puede jugar. Al cerrarla, se para.

---

## 2. Las claves de `config.yaml`

| Clave | Qué hace | Lo normal | Para tus amigos |
| :--- | :--- | :--- | :--- |
| `listen` | Si otros aparatos pueden entrar | `false`: solo tu ordenador | `true` |
| `whitelistMode` | Si solo entran las direcciones de la lista | `true` | `true` en casa; `false` desde fuera |
| `whitelist` | La lista de direcciones que pueden entrar | la tuya (`127.0.0.1` y `::1`) | añade tu red de casa |
| `basicAuthMode` | Si pide usuario y contraseña | `false` | **`true`, siempre** |
| `basicAuthUser` | El usuario (`username`) y la contraseña (`password`) | `user` y `password` | los vuestros |
| `port` | El puerto: el número que va tras los dos puntos en la dirección | `8000` | `8000` vale |

Dos cosas que conviene saber:
- **La contraseña solo se pide con `listen: true`.** Con `listen: false` nadie de fuera puede entrar, así que no hace falta.
- **Con `listen: true`, el servidor no arranca** si no hay lista (`whitelistMode`) ni contraseña (`basicAuthMode`). Lo hace a propósito: no lo fuerces.

---

## 3. En tu casa, con la misma wifi

**Paso 1: la dirección de tu ordenador en casa.** Pulsa la tecla de Windows, escribe `cmd` y abre el *Símbolo del sistema*. Escribe `ipconfig` y pulsa Intro. Busca tu wifi (o tu cable) y la línea **Dirección IPv4**: algo como `192.168.1.35`. Esa es tu dirección en casa.

**Paso 2: `config.yaml`.** Cambia estas líneas (las demás, como estén). Pon **tus** tres primeros números en la lista: si tu dirección es `192.168.1.35`, tu red es `192.168.1.0/24`, que quiere decir «cualquier aparato de casa que empiece por `192.168.1.`».

```yaml
listen: true
whitelistMode: true
whitelist:
  - ::1
  - 127.0.0.1
  - 192.168.1.0/24
basicAuthMode: true
basicAuthUser:
  username: "gremio"
  password: "una frase larga que solo sepáis vosotros"
port: 8000
```

**Paso 3: el aviso de Windows.** La primera vez que arranques así, Windows pregunta si deja a *Node.js* comunicarse en la red. Marca **Redes privadas** y **no** marques *Redes públicas*. Luego pulsa *Permitir*.
- Si le diste a *Cancelar*: menú Inicio, escribe *Permitir una aplicación a través del Firewall de Windows*, busca *Node.js* y marca **Privada**.
- Y tu wifi tiene que ser una red privada: *Configuración → Red e Internet → Wi-Fi →* tu red *→ Tipo de perfil de red: Privada*. Si es pública, Windows no deja entrar a nadie.

**Paso 4: tus amigos.** En su navegador escriben `http://192.168.1.35:8000` (tu dirección y tu puerto). Les pide el usuario y la contraseña, y entran en la portada del juego. **A ti también te la pide**, una vez por sesión.

Desde tu móvil es igual: lo cuenta el [apartado 5](#5-jugar-desde-el-móvil).

---

## 4. Desde fuera de casa

Fuera de casa la dirección de tus amigos cambia cada día, así que la lista no sirve: **la contraseña es la única puerta**.

```yaml
listen: true
whitelistMode: false
basicAuthMode: true
basicAuthUser:
  username: "gremio"
  password: "una frase larga que solo sepáis vosotros"
```

Y para que te lleguen desde internet, lo más sencillo es **`Remote-Link.cmd`**, que está en la carpeta del juego: abre un túnel de Cloudflare y te da una dirección temporal que empieza por `https://`. Se la pasas a tus amigos, y al cerrar su ventana el túnel se cierra.
- Usa el puerto `8000`: el túnel apunta ahí.
- **Con el túnel, `listen: true` también.** Si no, la contraseña no se pide y cualquiera con la dirección entra.

La otra forma es abrir el puerto en el router de casa, pero no la recomiendo: deja tu ordenador a la vista de todo internet, sin cifrar, todo el tiempo.

---

## 5. Jugar desde el móvil

El juego está hecho para el teléfono (J20 de [[ROADMAP_SIN_CONEXION]]): se ve de pie y tumbado, todo va a toques, el tablero se mueve con un dedo y se amplía con dos, y no hace falta teclado. **El juego sigue en tu ordenador**: el móvil solo lo abre, así que el ordenador tiene que estar encendido con `Jugar.bat` abierto.

Tus partidas se guardan en el ordenador, no en el móvil. Puedes empezar en uno y seguir en el otro, pero no juguéis en los dos a la vez en la misma partida.

### En casa, con la misma wifi

1. **El ordenador**, preparado como en el [apartado 3](#3-en-tu-casa-con-la-misma-wifi): `listen: true`, tu red en la lista y la contraseña puesta.
2. **El móvil, en la wifi de casa.** Con los datos del móvil no llega: tiene que ser la misma wifi que el ordenador.
3. **La dirección.** En Chrome (Android) o Safari (iPhone), escribe la dirección de tu ordenador y el puerto, con `/?juego` al final:

   ```
   http://192.168.1.35:8000/?juego
   ```

   Pon **tu** dirección (la del `ipconfig`) y **tu** puerto. El `?juego` del final hace que entre directo en la portada del juego.
4. **Usuario y contraseña**, los de `config.yaml`. El móvil está en tu red de casa, así que la lista ya lo deja pasar.

**Si no carga:**
- Mira que el móvil esté en la misma wifi, y no en los datos.
- Mira que Windows deje pasar a *Node.js* en las redes privadas (paso 3 del [apartado 3](#3-en-tu-casa-con-la-misma-wifi)).
- La dirección del ordenador puede cambiar de un día a otro (la reparte el router). Si ayer iba y hoy no, vuelve a mirar `ipconfig`. Para que no cambie nunca, el router suele tener una opción para *reservar* una dirección para tu ordenador (se llama «DHCP estático» o «reserva de IP»; cada router lo pone en un sitio).

### Fuera de casa, con la contraseña

1. En el ordenador, `config.yaml` como en el [apartado 4](#4-desde-fuera-de-casa): sin lista y **con contraseña**.
2. Abre `Remote-Link.cmd`. En su ventana sale una dirección que empieza por `https://` y acaba en `trycloudflare.com`.
3. En el móvil, con datos o con cualquier wifi, abre esa dirección con `/?juego` al final. Pide el usuario y la contraseña.
4. **La dirección cambia cada vez** que abres `Remote-Link.cmd`. Mándatela al móvil (por ejemplo, en un mensaje a ti mismo) cada vez que lo abras.

Al acabar, cierra la ventana del túnel.

### Añadir a la pantalla de inicio

Así el juego tiene su icono, **DnD Coin**, como una app más. Abre antes el juego con `/?juego` al final: el icono entrará directo en la portada.

**Android (Chrome):**
1. Toca el menú **⋮** (arriba a la derecha).
2. Toca **«Añadir a pantalla de inicio»** (o **«Instalar aplicación»**, si sale) y luego **«Añadir»** o **«Instalar»**.

Lo que se consigue depende de la dirección:
- **Con la de casa** (`http://192.168.…`), Chrome pone un acceso directo: el icono abre el juego en una pestaña de Chrome, con la barra de la dirección arriba. Se juega igual.
- **Con una `https://`** (la del túnel), Chrome lo instala como una app: se abre a pantalla entera, sin barra. Pero la dirección del túnel cambia cada vez, y el icono se quedaría con la vieja. Para fuera de casa, mejor abrir la dirección nueva cada vez.
- **Truco para tenerlo a pantalla entera en casa** (opcional): en Chrome, escribe `chrome://flags` en la barra de la dirección, busca **«Insecure origins treated as secure»**, escribe en su casilla tu dirección con el puerto (`http://192.168.1.35:8000`), ponlo en **Enabled** y toca **Relaunch**. Vuelve a abrir el juego: ahora el menú ofrece **«Instalar aplicación»**. Si la dirección del ordenador cambia, hay que hacerlo otra vez.

**iPhone (Safari):**
1. Toca el botón de **compartir** (el cuadrado con una flecha hacia arriba).
2. Baja y toca **«Añadir a pantalla de inicio»**, y luego **«Añadir»**.

El icono abre el juego a pantalla entera, sin la barra de Safari. La primera vez que lo abras desde el icono, puede que vuelva a pedir el usuario y la contraseña: el iPhone guarda aparte lo de cada icono.

### Si el teléfono va lento o se calienta

- En la pausa, toca **Opciones** y luego **Animaciones** hasta que diga **«Ninguna»**. El juego deja de animar los dados, los golpes y los viajes, y el teléfono trabaja menos.
- En un teléfono, el juego ya acorta las animaciones él solo y no pone el desenfoque detrás de las ventanas.
- Cierra las otras pestañas del navegador: cada una gasta su parte.

### Más adelante: un APK de Android

Cuando el juego esté a punto, la idea es hacer **un APK de Android**: el juego se instala como cualquier app, guarda en el propio teléfono y se juega sin tener el ordenador encendido. Es el plan de [[ROADMAP_PWA_SIN_SERVIDOR]]. Hasta entonces, el móvil juega contra tu ordenador, como cuenta este apartado.

---

## 6. Lo que hay que saber antes de abrirlo

- **Quien entra puede hacer lo mismo que tú.** Ve y borra tus partidas y tus personajes. Si algún día pones claves de una IA, las puede gastar. Dáselo solo a gente de confianza.
- **Cambia `user` y `password`.** Son los de ejemplo, y los conoce cualquiera. Una frase larga es mejor que una palabra rara.
- **En casa, la contraseña viaja sin cifrar** (la dirección empieza por `http://`, no `https://`). En tu wifi vale; en una wifi pública o de otros, no.
- **Todos jugáis en tus datos.** Hoy el juego es de un jugador: jugar juntos en la misma partida (J6) está aparcado. Cada amigo puede empezar su propia partida desde «Jugar sin conexión», pero **no juguéis dos a la vez en la misma**: uno pisaría lo que guarda el otro. (Hay una clave, `enableUserAccounts`, que da a cada uno su usuario y sus partidas aparte, pero enseña pantallas de SillyTavern: no está pensada para el juego todavía.)
- **Al acabar, ciérralo.** Cierra el túnel o vuelve a `listen: false`. Un servidor abierto sin nadie jugando es una puerta abierta.
- **Si alguien falla la contraseña cinco veces** en un minuto, el servidor le hace esperar un minuto. Es normal.
